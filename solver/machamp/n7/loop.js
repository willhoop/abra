/* solver/machamp/n7/loop.js — PLAN N7: the LOCAL Expert Iteration loop for the PORYGON2 v3 policy+value net, one resumable
 * script. MEW is the actor fleet, MACHAMP the learner and the gate (solver/PLAN.md §2, §3 N7).
 *
 *   cmd.exe /c tools\lownode.cmd solver\machamp\n7\loop.js --prereg solver/machamp/n7/preregistration-gen1.json
 *        [--tag n7g1] [--gens 1] [--stop-after selfplay|build|train|offline|screen|sprt] [--workers N]
 *        [--harness-src <dir>] [--anchor-data <dir> --anchor-teacher <dir> | --no-anchor] [--retry-void]
 *   ... --dry-run      print every stage, its exact argument vector, the paths, the pins, the preflight and the compute
 *                      estimate; run nothing, write nothing
 *   ... --estimate     the compute estimate alone (hours per stage at the local rate; solver/PLAN.md §6a)
 *   ... --status       the state file, summarised
 *   ... --smoke        the pre-registration's `smoke` block: a tiny run (games, chunks, workers <= 2, one epoch, the offline gate
 *                      on a seeded subsample, stop after the offline gate). Its figures are NOT results.
 *   ... --allow-beside-ladder   run while a ladder process is up (smoke only; workers <= 2; never a screen or an SPRT)
 *
 * ONE GENERATION (g = 1, 2, …), from the champion C (a league spec + its net):
 *   selfplay  MEW (solver/mew/run.js --n7 --pcr …) in --chunks chunks; chunk c plays games/chunks games on seed seed_base + c
 *             into chunk-c.tmp/ and is renamed chunk-c/ only after its shards hash to its manifest. Capability bars
 *             (pre-registration selfplay.bars) refuse a starved corpus.
 *   build     solver/machamp/n7/build.js -> data/ (one row per position with a FULL decision; split by game)
 *   train     solver/machamp/n7/train.py train (epoch checkpoints: a kill resumes at the next epoch) + export -> net.json and
 *             the parity fixture; then the Node forward (solver/machamp/n7/net.js) and the deployed leaf
 *             (solver/porygon2/v3/infer.js) must reproduce the Python float64 outputs to 1e-9 (parity.json)
 *   offline   solver/machamp/n7/offline_gate.js: the v3 harness (ranking, calibration incl. the human sources, cost) against
 *             the champion's net, and the policy head's held-out test. Value FAIL = rejected, no game played.
 *   screen    solver/machamp/gate.js --rule notlose at the gate clock, guarded; solver/machamp/n7/read.js once. Not PASS = rejected.
 *   sprt      solver/machamp/sprt.js, guarded; read once at its stop.
 *   promote   promote(): the champion moves ONLY on an SPRT read of H1 with every bar met, under THIS pre-registration.
 * Then the next generation self-plays with whichever net is champion.
 *
 * STATE (<out>/state.json, written to a temporary file and renamed: a kill never leaves half a state file). Every finished
 * stage records the sha256 of every corpus and model it wrote; a resumed run RE-HASHES them and refuses to go on if one
 * changed (the manifest-integrity rule). The pre-registration's sha256 is in the state: a resume under a different file is
 * refused. A stage that did not finish is redone from its own start (its .tmp directory removed); a finished one is never
 * redone. Training resumes inside its stage from its last epoch checkpoint.
 *
 * THE LADDER HAS PRIORITY. Before every stage: a run_ladder.js / rotom.js / reparse_store.js process = exit 3 (PAUSED, resume
 * later). While a stage's child runs, the machine is sampled every --guard-sec (60) s into <stage>/guard.jsonl; a ladder
 * process = THIS run's child tree is stopped by pid (taskkill /PID <child> /T /F; never by image name) and the loop exits 3.
 * A screen or SPRT stopped that way is VOID; it is replayed from its first game only with --retry-void.
 *
 * DELIBERATE BREAKS (env N7_LOOP_BREAK), each turns solver/tests/test-n7-loop.js red:
 *   promote    promote() accepts any SPRT read                                    -> PROMOTE
 *   integrity  a resumed run does not re-hash finished stages' outputs            -> MANIFEST
 *   resume     a resumed run redoes finished self-play chunks                     -> RESUME
 *   ladder     the ladder check sees nothing                                       -> PAUSE
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const os = require('os');
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* lownode already set it */ }
const ROOT = path.join(__dirname, '..', '..', '..');
const BREAK = process.env.N7_LOOP_BREAK || '';
const shaFile = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
/* a TEXT file's identity with its line endings normalised: core.autocrlf checks a pre-registration out as CRLF on this
 * machine and as LF elsewhere, and the same registration must hash the same in both (it is a document, not a corpus) */
const shaText = f => crypto.createHash('sha256').update(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const abs = p => (p == null ? p : path.isAbsolute(p) ? p : path.join(ROOT, p));
const nowIso = () => new Date().toISOString();
const STAGES = ['selfplay', 'build', 'train', 'offline', 'screen', 'sprt', 'promote'];
const LADDER = /run_ladder\.js|rotom[\\/]rotom\.js|reparse_store\.js/i;
const EXIT = { OK: 0, FAIL: 1, USAGE: 2, PAUSED: 3, VOID: 4 };

class Paused extends Error { constructor(m) { super(m); this.code = EXIT.PAUSED; } }
class Void extends Error { constructor(m) { super(m); this.code = EXIT.VOID; } }

/* ------------------------------------------------------------------ options */
function parseArgs(argv) {
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const has = k => argv.includes(k);
  return { prereg: flag('--prereg'), tag: flag('--tag', null), gens: +flag('--gens', 1), stopAfter: flag('--stop-after', null), workers: flag('--workers', null) ? +flag('--workers') : null,
    harnessSrc: flag('--harness-src', null), anchorData: flag('--anchor-data', null), anchorTeacher: flag('--anchor-teacher', null), noAnchor: has('--no-anchor'),
    dryRun: has('--dry-run'), estimate: has('--estimate'), status: has('--status'), smoke: has('--smoke'), besideLadder: has('--allow-beside-ladder'), retryVoid: has('--retry-void'),
    out: flag('--out', null), guardSec: +flag('--guard-sec', 60), noGuard: has('--no-guard'), measured: flag('--measured', null),
    testMode: process.env.N7_TEST_MODE === '1' };
}

/* the effective configuration: the pre-registration, with the smoke block's overrides under --smoke */
function config(o) {
  if (!o.prereg) throw Object.assign(new Error('n7/loop: --prereg <file> is required'), { code: EXIT.USAGE });
  const file = abs(o.prereg);
  const PR = JSON.parse(fs.readFileSync(file, 'utf8'));
  const C = JSON.parse(JSON.stringify(PR));
  C._file = file; C._sha256 = shaText(file);
  C._smoke = !!o.smoke;
  if (o.smoke) {
    const S = PR.smoke || {};
    Object.assign(C.selfplay, { games: S.games, chunks: S.chunks, seed_base: S.seed_base, workers: Math.min(S.workers || 2, 2) });
    Object.assign(C.train, { epochs: S.epochs, max_steps: S.max_steps || 0, threads: Math.min(C.train.threads || 2, 2) });
    C.offline_gate = Object.assign({}, C.offline_gate, { workers: Math.min(S.workers || 2, 2), subsample: S.subsample || 10 });
    C._stopAfter = S.stop_after || 'offline';
  }
  if (o.workers) { C.selfplay.workers = o.workers; C.offline_gate.workers = o.workers; }
  if (o.besideLadder) {
    if (!o.smoke && !o.testMode) throw Object.assign(new Error('n7/loop: --allow-beside-ladder is for a smoke only'), { code: EXIT.USAGE });
    if (C.selfplay.workers > 2 || C.offline_gate.workers > 2) throw Object.assign(new Error('n7/loop: beside the ladder at most 2 workers'), { code: EXIT.USAGE });
  }
  C._stopAfter = o.stopAfter || C._stopAfter || null;
  if (o.besideLadder && (!C._stopAfter || STAGES.indexOf(C._stopAfter) > STAGES.indexOf('offline'))) throw Object.assign(new Error('n7/loop: no screen or SPRT beside the ladder (it would be VOID): --stop-after offline at the latest'), { code: EXIT.USAGE });
  C._tag = o.tag || (o.smoke ? 'smoke-' + nowIso().slice(0, 10) : PR.tag);
  C._out = abs(o.out || path.join('solver', 'out', 'n7', C._tag));
  C._harnessSrc = abs(o.harnessSrc || (C.offline_gate.harness && C.offline_gate.harness.src));
  C._anchor = o.noAnchor ? null : { data: abs(o.anchorData || C.train.anchor.data), teacher: abs(o.anchorTeacher || C.train.anchor.teacher) };
  C._besideLadder = !!o.besideLadder;
  C._guardSec = o.guardSec; C._noGuard = !!o.noGuard;
  return C;
}

/* ------------------------------------------------------------------ the machine */
function nodeProcs() {
  if (process.platform !== 'win32') return [];
  const ps = "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }";
  const out = cp.execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', maxBuffer: 1e8, windowsHide: true });
  return out.split(/\r?\n/).filter(Boolean).map(l => { const i = l.indexOf('\t'); return { pid: +l.slice(0, i), cmd: l.slice(i + 1) }; });
}
function ladderPids() {
  if (BREAK === 'ladder') return [];                                                    // deliberate break: the ladder is ignored
  if (process.env.N7_FAKE_LADDER) return [Number(process.env.N7_FAKE_LADDER)];       // tests only: a pretend ladder pid
  if (process.env.N7_TEST_MODE === '1') return [];                                     // tests read the pretend ladder only, never the machine
  try { return nodeProcs().filter(p => LADDER.test(p.cmd)).map(p => p.pid); } catch (e) { return []; }
}
function preflightMachine(C, stage) {
  const L = ladderPids();
  if (L.length && !C._besideLadder) throw new Paused(`PAUSED before ${stage}: a ladder process is running (pids ${L.join(', ')}). The ladder has priority; resume the same command in a gap.`);
  return L;
}

/* run one child (node or python) under the guard; resolve with its exit code */
function runChild(C, cmd, args, o) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(o.log), { recursive: true });
    const out = fs.openSync(o.log, 'a');
    const env = Object.assign({}, process.env, { ABRA_REGULATION: 'regmc' }, o.env || {});
    const ch = cp.spawn(cmd, args, { cwd: ROOT, env, stdio: ['ignore', out, out], windowsHide: true });
    const glog = o.guard;
    const gw = x => { if (glog) fs.appendFileSync(glog, JSON.stringify(Object.assign({ t: nowIso() }, x)) + '\n'); };
    gw({ kind: 'start', pid: ch.pid, argv: [cmd, ...args], beside_ladder: C._besideLadder });
    console.log(`[${nowIso()}] ${o.label}: pid ${ch.pid}  (log ${rel(o.log)})`);
    let killed = null;
    const sample = () => {
      if (C._noGuard) return;
      const L = ladderPids();
      gw({ kind: 'sample', ladder: L });
      if (L.length && !C._besideLadder && !killed) {
        killed = L;
        gw({ kind: 'void', why: 'a ladder process appeared mid-stage; stopping this run by pid', ladder: L, killing: ch.pid });
        try { cp.execFileSync('taskkill', ['/PID', String(ch.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { try { ch.kill(); } catch (e2) {} }
      }
    };
    sample();
    const timer = setInterval(sample, Math.max(1, C._guardSec) * 1000);
    ch.on('error', e => { clearInterval(timer); fs.closeSync(out); reject(e); });
    ch.on('exit', code => {
      clearInterval(timer); fs.closeSync(out);
      gw({ kind: 'end', exit: code, killed_for_ladder: !!killed });
      if (killed) return reject(o.voidOnLadder ? new Void(`${o.label} VOID: a ladder process appeared (pids ${killed.join(', ')}); this run's processes were stopped by pid`)
        : new Paused(`PAUSED in ${o.label}: a ladder process appeared (pids ${killed.join(', ')}); this run's processes were stopped by pid. Resume the same command in a gap.`));
      resolve(code);
    });
  });
}
const nodeArgs = (script, args) => [abs(script), ...args];

/* ------------------------------------------------------------------ state */
function loadState(C) {
  const f = path.join(C._out, 'state.json');
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
function saveState(C, S) {
  fs.mkdirSync(C._out, { recursive: true });
  const f = path.join(C._out, 'state.json');
  S.updated = nowIso();
  fs.writeFileSync(f + '.tmp', JSON.stringify(S, null, 1));
  fs.renameSync(f + '.tmp', f);
}
const event = (S, kind, x) => { S.events.push(Object.assign({ t: nowIso(), kind }, x || {})); };
function digestAll(files) { const o = {}; for (const f of files) o[rel(f)] = shaFile(f); return o; }
function verifyDigests(where, D) {
  if (BREAK === 'integrity') return;
  for (const [f, h] of Object.entries(D || {})) {
    const p = abs(f);
    const got = fs.existsSync(p) ? shaFile(p) : null;
    if (got !== h) throw Object.assign(new Error(`n7/loop: MANIFEST INTEGRITY — ${where}: ${f} was ${h ? h.slice(0, 16) : null}, is now ${got ? got.slice(0, 16) : 'missing'}. A finished stage's output changed; refusing to build on it.`), { code: EXIT.FAIL });
  }
}
function specDigests(spec) {
  const d = {};
  for (const k of ['mag', 'doduo', 'pory2', 'policyNet']) if (spec[k]) d[k] = shaFile(abs(spec[k]));
  return d;
}
function initState(C) {
  const spec = JSON.parse(fs.readFileSync(abs(C.champion.spec), 'utf8'));
  return { what: 'N7 loop state (solver/machamp/n7/loop.js)', tag: C._tag, created: nowIso(), smoke: C._smoke, beside_ladder: C._besideLadder,
    first_prereg: { file: rel(C._file), sha256: C._sha256 }, engine_release: C.engine_release, harness_release: C.harness_release,
    champion: { spec, spec_file: C.champion.spec, net: C.champion.net, digests: specDigests(spec), since: 'prereg' },
    gens: [], promotions: [], events: [] };
}
/* EACH GENERATION RUNS UNDER ITS OWN PRE-REGISTRATION (its `generation` field names it): its seeds, bars and arms are
 * written before its first game. A generation is started only under the file registered for it, and resumed only under the
 * same bytes. */
function genOf(S, g, C) {
  let G = S.gens.find(x => x.g === g);
  if (!G) {
    if (C.generation !== g) throw Object.assign(new Error(`n7/loop: generation ${g} needs its own pre-registration ("generation": ${g}); ${rel(C._file)} registers generation ${C.generation}. Write it before its first game, then run it with --prereg.`), { code: EXIT.USAGE });
    G = { g, status: 'running', started: nowIso(), prereg: { file: rel(C._file), sha256: C._sha256 }, champion_at_start: JSON.parse(JSON.stringify(S.champion)), stages: {} };
    S.gens.push(G);
  } else if (G.prereg.sha256 !== C._sha256) {
    throw Object.assign(new Error(`n7/loop: generation ${g} was started under pre-registration ${G.prereg.sha256.slice(0, 16)} (${G.prereg.file}); this file is ${C._sha256.slice(0, 16)}. A pre-registration is not revised mid-generation.`), { code: EXIT.USAGE });
  }
  return G;
}

/* ------------------------------------------------------------------ stages */
const chunkGames = (C, c) => { const n = C.selfplay.games, k = C.selfplay.chunks; return Math.floor(n / k) + (c < n % k ? 1 : 0); };

async function stageSelfplay(C, S, G, dir) {
  const st = G.stages.selfplay || (G.stages.selfplay = { chunks: [] });
  const SP = C.selfplay;
  const league = { current: S.champion.spec, previous: null, clone: JSON.parse(fs.readFileSync(abs(C.clone_spec), 'utf8')), weights: SP.league_weights };
  const lf = path.join(dir, 'league.json');
  if (!fs.existsSync(lf)) fs.writeFileSync(lf, JSON.stringify(league, null, 1));
  else if (JSON.stringify(JSON.parse(fs.readFileSync(lf, 'utf8'))) !== JSON.stringify(league)) throw new Error('n7/loop: the generation league changed under a resume (' + rel(lf) + ')');
  for (let c = 0; c < SP.chunks; c++) {
    const done = st.chunks[c];
    const cdir = path.join(dir, 'selfplay', `chunk-${String(c).padStart(2, '0')}`);
    if (done && done.done && BREAK !== 'resume') { verifyDigests(`selfplay chunk ${c}`, done.digests); continue; }
    preflightMachine(C, `selfplay chunk ${c}`);
    const tmp = cdir + '.tmp';
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(cdir, { recursive: true, force: true });
    const args = ['--release', C.engine_release, '--league', rel(lf), '--games', String(chunkGames(C, c)), '--seed', String(SP.seed_base + c), '--workers', String(SP.workers),
      '--cap', String(SP.cap), '--out', rel(tmp), '--team-store', C.team_store, '--info', SP.info, '--spreads', SP.spreads, '--n7', '--pcr', JSON.stringify(SP.pcr),
      '--am-rate', String(SP.am_rate), '--am-n', String(SP.am_n)];
    const t0 = Date.now();
    const code = await runChild(C, process.execPath, nodeArgs('solver/mew/run.js', args), { label: `g${G.g} selfplay chunk ${c}`, log: path.join(dir, 'logs', `selfplay-${c}.log`), guard: path.join(dir, 'logs', `selfplay-${c}.guard.jsonl`) });
    if (code !== 0) throw new Error(`n7/loop: self-play chunk ${c} exited ${code} (see ${rel(path.join(dir, 'logs', `selfplay-${c}.log`))})`);
    const man = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
    for (const s of man.shards) if (!s.sha256 || shaFile(abs(s.file)) !== s.sha256) throw new Error('n7/loop: chunk ' + c + ' shard ' + s.file + ' does not hash to its manifest');
    /* rename the chunk to its final name; the manifest's shard paths name the .tmp directory, so it is rewritten once */
    fs.renameSync(tmp, cdir);
    man.shards = man.shards.map(s => Object.assign({}, s, { file: s.file.replace(rel(tmp), rel(cdir)) }));
    man.flags.out_final = rel(cdir);
    fs.writeFileSync(path.join(cdir, 'manifest.json'), JSON.stringify(man, null, 1));
    const files = [path.join(cdir, 'manifest.json'), ...man.shards.map(s => abs(s.file))];
    st.chunks[c] = { done: true, at: nowIso(), seconds: Math.round((Date.now() - t0) / 1000), dir: rel(cdir), games: man.counts.games, games_per_hour: man.games_per_hour,
      started: man.started, warnings: man.warnings, digests: digestAll(files) };
    saveState(C, S);
  }
  /* the corpus bars, over every chunk */
  const mans = st.chunks.map(c => JSON.parse(fs.readFileSync(abs(path.join(c.dir, 'manifest.json')), 'utf8')));
  const sum = (f) => mans.reduce((a, m) => a + (f(m) || 0), 0);
  const games = sum(m => m.counts.games), errors = sum(m => m.counts.errors);
  const searched = sum(m => m.search.decisions), fb = sum(m => m.counts.fallback_decisions) + sum(m => m.agent_counters.fallbacks);
  const cellsUnf = mans.reduce((a, m) => a + m.search.unfilled_share * m.search.decisions, 0) / Math.max(1, searched);
  const n7 = {}; for (const m of mans) for (const [k, v] of Object.entries(m.n7 || {})) n7[k] = (n7[k] || 0) + v;
  const pcr = { full: sum(m => m.agent_counters.pcr && m.agent_counters.pcr.full), fast: sum(m => m.agent_counters.pcr && m.agent_counters.pcr.fast),
    full_cut: sum(m => m.agent_counters.pcr && m.agent_counters.pcr.full_cut), fast_cut: sum(m => m.agent_counters.pcr && m.agent_counters.pcr.fast_cut) };
  const fullShare = pcr.full / Math.max(1, pcr.full + pcr.fast);
  const B = SP.bars, bars = [];
  const bar = (name, pass, value, limit) => bars.push({ name, pass: !!pass, value, limit });
  bar('errored games share', errors / Math.max(1, games) <= B.max_error_share, { errors, games }, '<= ' + B.max_error_share);
  bar('fallback decisions share', fb / Math.max(1, searched) <= B.max_fallback_share, { fallbacks: fb, searched }, '<= ' + B.max_fallback_share);
  bar('unfilled cell share', cellsUnf <= B.max_unfilled_share, +cellsUnf.toFixed(5), '<= ' + B.max_unfilled_share);
  bar('encoded positions recorded', (n7.feats || 0) >= B.min_feats, n7.feats || 0, '>= ' + B.min_feats);
  bar('policy targets recorded', (n7.pt || 0) >= B.min_pt, n7.pt || 0, '>= ' + B.min_pt);
  bar('full decisions without a policy target', (n7.pt_null || 0) / Math.max(1, n7.decisions_full || 0) <= B.max_pt_null_share, { pt_null: n7.pt_null || 0, full: n7.decisions_full || 0 }, '<= ' + B.max_pt_null_share);
  bar('FULL share of decisions near p', Math.abs(fullShare - SP.pcr.p) <= B.pcr_full_share_tolerance, { full: pcr.full, fast: pcr.fast, share: +fullShare.toFixed(4) }, `${SP.pcr.p} +- ${B.pcr_full_share_tolerance}`);
  if (B.max_pass_cut_share != null) bar('searches cut short of their pass cap (the budgetMs ceiling bound)', (pcr.full_cut + pcr.fast_cut) / Math.max(1, pcr.full + pcr.fast) <= B.max_pass_cut_share,
    { full_cut: pcr.full_cut, fast_cut: pcr.fast_cut, searched: pcr.full + pcr.fast }, '<= ' + B.max_pass_cut_share);
  if (SP.am_rate > 0) bar('answer maps computed', (n7.am || 0) > 0 && !(n7.am_errors > 0), { am: n7.am || 0, errors: n7.am_errors || 0 }, '> 0, 0 errors');
  st.corpus = { games, searched, n7, pcr, bars, pass: bars.every(b => b.pass), games_per_hour: +(mans.reduce((a, m) => a + m.games_per_hour, 0) / mans.length).toFixed(1),
    worker_s_per_game: +(mans.reduce((a, m) => a + m.wall_s * m.flags.workers, 0) / Math.max(1, games)).toFixed(2) };
  st.done = true; st.at = nowIso();
  saveState(C, S);
  if (!st.corpus.pass) throw Object.assign(new Error('n7/loop: the self-play corpus FAILED its capability bars: ' + bars.filter(b => !b.pass).map(b => b.name).join('; ')), { code: EXIT.FAIL, reject: 'corpus' });
}

async function stageBuild(C, S, G, dir) {
  const st = G.stages.build || (G.stages.build = {});
  const out = path.join(dir, 'data');
  if (st.done) { verifyDigests('build', st.digests); return; }
  fs.rmSync(out, { recursive: true, force: true });
  /* THE REPLAY WINDOW (build.replay_generations; the 2026-09-25 lesson "accumulate data", docs/_reports/2026-09-25-selfplay-v0.md
   * §11 item 4): this generation's chunks plus those of the previous W - 1 generations of this state, every one re-hashed,
   * all on the same release (build.js refuses a mix). Uniform over the window, as AlphaZero's buffer of recent games. */
  const W = Math.max(1, (C.build && C.build.replay_generations) || 1);
  const window = S.gens.filter(x => x.g > G.g - W && x.g <= G.g && x.stages.selfplay && x.stages.selfplay.done);
  for (const x of window) if (x.g !== G.g) x.stages.selfplay.chunks.forEach((c, i) => verifyDigests(`replay gen ${x.g} chunk ${i}`, c.digests));
  st.replay = window.map(x => ({ g: x.g, chunks: x.stages.selfplay.chunks.length, games: x.stages.selfplay.corpus && x.stages.selfplay.corpus.games }));
  const chunks = [].concat(...window.map(x => x.stages.selfplay.chunks.map(c => c.dir))).join(',');
  preflightMachine(C, 'build');
  const code = await runChild(C, process.execPath, nodeArgs('solver/machamp/n7/build.js', ['--chunks', chunks, '--out', rel(out), '--val-mod', String(C.build.val_mod), '--seed', C.build.seed]),
    { label: `g${G.g} build`, log: path.join(dir, 'logs', 'build.log'), guard: path.join(dir, 'logs', 'build.guard.jsonl') });
  if (code !== 0) throw new Error('n7/loop: build exited ' + code);
  const man = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  Object.assign(st, { done: true, at: nowIso(), counts: man.counts, rows_sha256: man.output.sha256, digests: digestAll([path.join(out, 'manifest.json'), path.join(out, 'rows.jsonl.gz')]) });
  saveState(C, S);
}

function parity(netFile, fixtureFile) {
  const N = require('./net.js').load(netFile);
  const I = require('../../porygon2/v3/infer.js').load(netFile);
  const F = JSON.parse(fs.readFileSync(fixtureFile, 'utf8'));
  let mx = 0, mi = 0, mt = 0;
  for (const r of F.rows) {
    const f = N.forward(r.x);
    mx = Math.max(mx, Math.abs(f.logit - r.python_logit)); mi = Math.max(mi, Math.abs(I.logit(r.x) - r.python_logit));
    const a = N.tilt(f.hidA), b = N.tilt(f.hidB);
    for (let q = 0; q < a.length; q++) mt = Math.max(mt, Math.abs(a[q] - r.python_tilt_A[q]), Math.abs(b[q] - r.python_tilt_B[q]));
  }
  return { rows: F.rows.length, max_abs_logit_n7net: mx, max_abs_logit_v3infer: mi, max_abs_tilt: mt, pass: F.rows.length > 0 && mx <= 1e-9 && mi <= 1e-9 && mt <= 1e-9,
    fixture_names_file: F.model && F.model.sha256 === shaFile(netFile) };
}

async function stageTrain(C, S, G, dir) {
  const st = G.stages.train || (G.stages.train = {});
  const out = path.join(dir, 'train');
  if (st.done) { verifyDigests('train', st.digests); return; }
  const T = C.train;
  const init = S.champion.n7_net || C.init_net;           // the first generation starts from the student; later ones from the champion net
  const args = [abs('solver/machamp/n7/train.py'), 'train', '--data', rel(path.join(dir, 'data')), '--init', init, '--out', rel(out), '--epochs', String(T.epochs), '--lr', String(T.lr), '--bs', String(T.bs),
    '--threads', String(T.threads), '--patience', String(T.patience), '--base-mag', S.champion.spec.mag, '--base-doduo', S.champion.spec.doduo,
    '--w-z', String(T.weights.z), '--w-aux', String(T.weights.aux), '--w-sv', String(T.weights.sv), '--w-am', String(T.weights.am), '--w-pol', String(T.weights.pol), '--w-l2', String(T.weights.l2),
    '--w-anchor', String(T.weights.anchor), '--anchor-aux', String(T.weights.anchor_aux), ...(T.max_steps ? ['--max-steps', String(T.max_steps)] : [])];
  if (C._anchor && fs.existsSync(C._anchor.data) && fs.existsSync(C._anchor.teacher)) {
    /* the anchor is pinned: the teacher cache manifest must be the registered one (it names the teacher and both inputs) */
    const pin = T.anchor.teacher_manifest_sha256, got = shaFile(path.join(C._anchor.teacher, 'manifest.json'));
    if (pin && got !== pin) throw Object.assign(new Error(`n7/loop: the anchor's teacher cache manifest is ${got.slice(0, 16)}, the pre-registration pins ${pin.slice(0, 16)}`), { code: EXIT.USAGE });
    args.push('--anchor-data', C._anchor.data, '--anchor-teacher', C._anchor.teacher);
  }
  else if (T.anchor.required && !C._smoke) throw Object.assign(new Error('n7/loop: the human anchor is REQUIRED and its data are not at ' + JSON.stringify(C._anchor) + ' (pre-registration train.anchor). Copy them (OWED step 1) or pass --anchor-data/--anchor-teacher.'), { code: EXIT.USAGE });
  else args.push('--no-anchor');
  st.anchor = args.includes('--no-anchor') ? 'OFF' : { data: C._anchor.data, teacher: C._anchor.teacher };
  preflightMachine(C, 'train');
  const code = await runChild(C, 'python', args, { label: `g${G.g} train`, log: path.join(dir, 'logs', 'train.log'), guard: path.join(dir, 'logs', 'train.guard.jsonl') });
  if (code !== 0) throw new Error('n7/loop: train.py exited ' + code + ' (see ' + rel(path.join(dir, 'logs', 'train.log')) + ')');
  const code2 = await runChild(C, 'python', [abs('solver/machamp/n7/train.py'), 'export', '--out', rel(out)], { label: `g${G.g} export`, log: path.join(dir, 'logs', 'train.log'), guard: path.join(dir, 'logs', 'export.guard.jsonl') });
  if (code2 !== 0) throw new Error('n7/loop: export exited ' + code2);
  const net = path.join(out, 'net.json'), fx = path.join(out, 'fixture.json');
  const P = parity(net, fx);
  fs.writeFileSync(path.join(out, 'parity.json'), JSON.stringify(P, null, 1));
  if (!P.pass || !P.fixture_names_file) throw Object.assign(new Error('n7/loop: Node/Python parity FAILED ' + JSON.stringify(P)), { code: EXIT.FAIL });
  const met = JSON.parse(fs.readFileSync(path.join(out, 'metrics.json'), 'utf8'));
  Object.assign(st, { done: true, at: nowIso(), net: rel(net), net_sha256: shaFile(net), init: { file: init, sha256: shaFile(abs(init)) }, selected_epoch: met.selected_epoch, history: met.history,
    parity: P, digests: digestAll([net, fx, path.join(out, 'metrics.json'), path.join(out, 'val_policy.jsonl'), path.join(out, 'model.pt'), path.join(out, 'parity.json')]) });
  saveState(C, S);
}

async function stageOffline(C, S, G, dir) {
  const st = G.stages.offline || (G.stages.offline = {});
  const out = path.join(dir, 'offline');
  if (st.done) { verifyDigests('offline', st.digests); return st.verdict; }
  if (!C._harnessSrc || !fs.existsSync(path.join(C._harnessSrc, 'manifest.json'))) throw Object.assign(new Error('n7/loop: the frozen v3 harness is not at ' + C._harnessSrc + ' (pre-registration offline_gate.harness.src). Copy it (OWED step 1) or pass --harness-src.'), { code: EXIT.USAGE });
  preflightMachine(C, 'offline');
  const OG = C.offline_gate;
  const args = ['--prereg', C._file, '--harness-src', C._harnessSrc, '--dir', rel(out), '--champ-net', S.champion.net, '--cand-net', G.stages.train.net, '--train-dir', rel(path.join(dir, 'train')),
    '--workers', String(OG.workers), '--release', OG.release, ...(OG.subsample ? ['--subsample', String(OG.subsample)] : [])];
  const code = await runChild(C, process.execPath, nodeArgs('solver/machamp/n7/offline_gate.js', args), { label: `g${G.g} offline gate`, log: path.join(dir, 'logs', 'offline.log'), guard: path.join(dir, 'logs', 'offline.guard.jsonl') });
  if (code !== 0) throw new Error('n7/loop: offline gate exited ' + code + ' (see ' + rel(path.join(dir, 'logs', 'offline.log')) + ')');
  const vf = path.join(out, 'verdict.json');
  const v = JSON.parse(fs.readFileSync(vf, 'utf8'));
  Object.assign(st, { done: true, at: nowIso(), verdict: { value: v.value, smoke: v.smoke, policy_head: v.policy_head, bars: v.bars }, digests: digestAll([vf]) });
  saveState(C, S);
  return st.verdict;
}

function gateSpecs(C, S, G, dir, headOn) {
  const ch = S.champion.spec, gc = C.gate_clock;
  const clock = { budgetMs: gc.budgetMs, k1: gc.k1, k2: gc.k2, depth: gc.depth, reserveSwitch: gc.reserveSwitch, adaptive: gc.adaptive };
  const base = { kind: 'miltank', mag: ch.mag, doduo: ch.doduo };
  const champ = Object.assign({ name: `${C._tag}-g${G.g}-champion-${ch.name}` }, base, { pory2: ch.pory2 }, ch.policyNet ? { policyNet: ch.policyNet } : {}, clock);
  const cand = Object.assign({ name: `${C._tag}-g${G.g}-candidate` }, base, { pory2: G.stages.train.net }, headOn ? { policyNet: G.stages.train.net } : {}, clock);
  fs.mkdirSync(path.join(dir, 'specs'), { recursive: true });
  const fc = path.join(dir, 'specs', 'cand-2s.json'), fy = path.join(dir, 'specs', 'champ-2s.json');
  for (const [f, s] of [[fc, cand], [fy, champ]]) {
    if (fs.existsSync(f) && fs.readFileSync(f, 'utf8') !== JSON.stringify(s, null, 1) + '\n') throw new Error('n7/loop: ' + rel(f) + ' differs from the spec this generation must play');
    fs.writeFileSync(f, JSON.stringify(s, null, 1) + '\n');
  }
  return { x: fc, y: fy, cand, champ };
}

async function stageGame(C, S, G, dir, kind, o) {
  const st = G.stages[kind] || (G.stages[kind] = { attempts: 0 });
  if (st.done) { verifyDigests(kind, st.digests); return st.read; }
  if (st.void && !o.retryVoid) throw new Void(`${kind} of generation ${G.g} is VOID (${st.void}); re-run it from its first game only on the coordinator's say: --retry-void`);
  if (C._besideLadder) throw Object.assign(new Error('n7/loop: no ' + kind + ' beside the ladder'), { code: EXIT.USAGE });
  preflightMachine(C, kind);
  const sp = gateSpecs(C, S, G, dir, G.stages.offline.verdict.policy_head.on);
  const P = kind === 'screen' ? C.screen : C.sprt;
  const kd = path.join(dir, kind);
  fs.rmSync(kd, { recursive: true, force: true }); fs.mkdirSync(kd, { recursive: true });
  const resF = path.join(kd, 'result.json');
  const common = ['--release', C.engine_release, '--x', rel(sp.x), '--y', rel(sp.y), '--seed', String(P.seed), '--workers', String(P.workers), '--cap', String(P.cap),
    '--info', P.flags.info, '--spreads', P.flags.spreads, '--team-store', C.team_store, '--out', rel(resF)];
  const args = kind === 'screen' ? ['solver/machamp/gate.js', '--pairs', String(P.pairs), '--pair-seed', String(P.pair_seed), '--rule', P.rule, ...common]
    : ['solver/machamp/sprt.js', '--elo0', String(P.elo0), '--elo1', String(P.elo1), '--alpha', String(P.alpha), '--beta', String(P.beta), '--max-games', String(P.max_games), ...common];
  st.attempts++; st.void = null; saveState(C, S);
  const guard = path.join(kd, 'guard.jsonl');
  let code;
  try { code = await runChild(C, process.execPath, nodeArgs(args[0], args.slice(1)), { label: `g${G.g} ${kind}`, log: path.join(kd, kind + '.log'), guard, voidOnLadder: true }); }
  catch (e) { if (e instanceof Void) { st.void = e.message; saveState(C, S); } throw e; }
  if (code !== 0 && kind === 'screen') throw new Error('n7/loop: the screen exited ' + code);
  if (code !== 0) throw new Error('n7/loop: the SPRT exited ' + code);
  const R = require('./read.js').read({ kind, result: resF, prereg: C._file, xNet: abs(G.stages.train.net), yNet: abs(S.champion.spec.pory2), guard });
  fs.writeFileSync(path.join(kd, 'read.json'), JSON.stringify(R, null, 1) + '\n');
  Object.assign(st, { done: true, at: nowIso(), read: { verdict_code: R.verdict_code, verdict: R.verdict, score: R.score, sprt: R.sprt, clock_ratio: R.clock_ratio, capability_ok: R.capability_ok },
    specs: { x: rel(sp.x), y: rel(sp.y), x_digests: specDigests(sp.cand), y_digests: specDigests(sp.champ) }, digests: digestAll([resF, path.join(kd, 'read.json'), sp.x, sp.y]) });
  saveState(C, S);
  return st.read;
}

/* THE PROMOTION RULE (pre-registration `promotion`). Pure: given the state, the generation and the SPRT read file, it returns
 * the new champion or throws with the reason. Nothing else in this file moves the champion. */
function promote(S, G, readFile) {
  const why = [];
  if (!readFile || !fs.existsSync(readFile)) why.push('no SPRT read');
  const R = why.length ? null : JSON.parse(fs.readFileSync(readFile, 'utf8'));
  if (BREAK !== 'promote' && R) {
    if (R.kind !== 'sprt') why.push('the read is not an SPRT read (' + R.kind + ')');
    if (R.verdict_code !== 'H1') why.push('the SPRT verdict is ' + R.verdict_code + ', not H1');
    if (R.capability_ok !== true) why.push('a capability bar failed');
    if (!G.prereg || R.preregistration_sha256 !== G.prereg.sha256) why.push("the read was made under a different pre-registration than this generation's");
    const want = G.stages.train && G.stages.train.net_sha256;
    const gotSpec = R.x_spec || {};
    if (!want || !gotSpec.pory2 || shaFile(abs(gotSpec.pory2)) !== want) why.push("the read's X arm does not carry this generation's net");
    if (G.stages.screen && G.stages.screen.read && G.stages.screen.read.verdict_code !== 'PASS') why.push('the screen did not PASS');
  }
  if (why.length) { const e = new Error('n7/loop: PROMOTION REFUSED — ' + why.join('; ')); e.refused = why; throw e; }
  const net = G.stages.train.net;
  const spec = Object.assign({}, S.champion.spec, { name: `${S.tag}-g${G.g}`, pory2: net }, R && R.x_spec && R.x_spec.policyNet ? { policyNet: net } : {});
  delete spec.adaptive;
  if (S.champion.spec.budgetMs != null) spec.budgetMs = S.champion.spec.budgetMs;
  return { spec, net, n7_net: net, digests: specDigests(spec), since: `generation ${G.g} (SPRT H1, ${R && R.sprt ? R.sprt.games_used + ' games' : 'n/a'})` };
}

async function stagePromote(C, S, G, dir) {
  const st = G.stages.promote || (G.stages.promote = {});
  if (st.done) return;
  const readFile = path.join(dir, 'sprt', 'read.json');
  try {
    const ch = promote(S, G, readFile);
    /* the tracked copy: a promoted net is small (about 0.23 MB) and is what the next generation and any later spec name */
    const md = path.join(ROOT, 'solver', 'machamp', 'models', `${S.tag}-gen${G.g}`);
    fs.mkdirSync(md, { recursive: true });
    for (const f of ['net.json', 'metrics.json', 'parity.json']) fs.copyFileSync(path.join(dir, 'train', f), path.join(md, f));
    ch.spec.pory2 = rel(path.join(md, 'net.json')); if (ch.spec.policyNet) ch.spec.policyNet = ch.spec.pory2;
    ch.net = ch.spec.pory2; ch.n7_net = ch.spec.pory2; ch.digests = specDigests(ch.spec);
    S.promotions.push({ g: G.g, from: S.champion.spec.name, to: ch.spec.name, at: nowIso(), net: ch.net });
    S.champion = Object.assign({ spec_file: null }, ch);
    G.status = 'promoted';
    Object.assign(st, { done: true, at: nowIso(), promoted: true });
  } catch (e) {
    if (!e.refused) throw e;
    G.status = 'rejected-sprt';
    Object.assign(st, { done: true, at: nowIso(), promoted: false, refused: e.refused });
  }
  saveState(C, S);
}

/* ------------------------------------------------------------------ the compute estimate (solver/PLAN.md §6a) */
const RATES = {
  ms_per_playout: { value: 1751 / 382.4, source: 'the 2 s reference arm on df172ccd2aaf: 382.4 playouts per searched decision at 1,751 ms mean (solver/results/2026-10-01-screens/screen2-k2x8-2s.read.json, arms.y)' },
  cells_per_pass: { value: 16, source: 'rows 4.00 x columns 3.99 in the same arm' },
  decisions_per_side_per_game: { value: 1613 / 200, source: '1,613 decisions in 200 games, the same arm' },
  answer_map_s_per_position_n16: { value: 3, source: 'about 3 s of CPU per position at 16 duels a pair (docs/_reports/2026-10-01-lost-last-answer.md, abra/regmc 1.58.0)' },
  gate_worker_s_per_game_2s: { value: 1479 * 4 / 200, source: '200 games in 1,479 s on 4 workers at the 2 s clock (screen 2, 1.68.0)' },
  harness_worker_min_per_net: { value: 8 * 14 / 4, source: 'four nets scored in about 14 min on 8 workers (solver/out/p2v3/evalset score files, 2026-10-01 03:51-04:05)' },
  sprt_stops_games: { value: [416, 1268], source: 'the SPRTs of the week to 2026-10-01 stopped at 416-1,268 games (solver/PLAN.md §6a)' },
};
function estimate(C, measured) {
  const SP = C.selfplay, W = SP.workers;
  const tFull = SP.pcr.full.maxPasses * RATES.cells_per_pass.value * RATES.ms_per_playout.value / 1000;
  const tFast = SP.pcr.fast.maxPasses * RATES.cells_per_pass.value * RATES.ms_per_playout.value / 1000;
  const tDec = SP.pcr.p * tFull + (1 - SP.pcr.p) * tFast;
  const wCur = SP.league_weights.current + SP.league_weights.previous, wClone = SP.league_weights.clone;
  const decPerGame = RATES.decisions_per_side_per_game.value * (2 * wCur + 1 * wClone);
  const featsPerGame = decPerGame * SP.pcr.p;                    // one encoded view per recorded FULL decision
  const turnsFull = RATES.decisions_per_side_per_game.value * (1 - Math.pow(1 - SP.pcr.p, 2 * wCur + wClone));   // turns with a FULL decision: the answer map's draws
  const amS = SP.am_rate * turnsFull * RATES.answer_map_s_per_position_n16.value * SP.am_n / 16;
  let wsGame = decPerGame * tDec + amS, basis = 'derived from the measured rates below';
  if (measured && measured.worker_s_per_game) { wsGame = measured.worker_s_per_game; basis = 'MEASURED by ' + measured.source; }
  const spWH = SP.games * wsGame / 3600;
  const pos = SP.games * featsPerGame, epochs = C.train.epochs;
  const trainH = measured && measured.train_s_per_step ? Math.ceil(pos / C.train.bs) * epochs * measured.train_s_per_step / 3600 : null;
  const offH = (2 * RATES.harness_worker_min_per_net.value / 60) / C.offline_gate.workers + 0.1;
  const scrH = C.screen.games * RATES.gate_worker_s_per_game_2s.value / 3600 / C.screen.workers;
  const sprtH = RATES.sprt_stops_games.value.map(g => g * RATES.gate_worker_s_per_game_2s.value / 3600 / C.sprt.workers);
  const sprtMax = C.sprt.max_games * RATES.gate_worker_s_per_game_2s.value / 3600 / C.sprt.workers;
  const r = x => (x == null ? null : +x.toFixed(2));
  const wall = { selfplay: r(spWH / W), train: r(trainH), offline: r(offH), screen: r(scrH), sprt_typical: sprtH.map(r), sprt_max: r(sprtMax) };
  const lo = spWH / W + (trainH || 0.5) + offH + scrH + sprtH[0], hi = spWH / W + (trainH || 2) + offH + scrH + sprtMax;
  return { per_generation: { games: SP.games, decision_s: { full: r(tFull), fast: r(tFast), mean: r(tDec) }, decisions_per_game: r(decPerGame), recorded_positions_per_game: r(featsPerGame),
      worker_s_per_game: r(wsGame), worker_s_per_game_basis: basis, selfplay_worker_hours: r(spWH), training_positions: Math.round(pos), wall_hours_at_workers: W, wall_hours: wall,
      total_wall_hours: { low: r(lo), high: r(hi), note: 'self-play + training + offline gate + screen + SPRT (typical stop to the 2,000-game budget). A generation rejected at the offline gate still pays for its self-play, which is most of the cost; it saves only the screen and the SPRT.' } },
    cloud_note: 'Scale-out prices are solver/PLAN.md §6a; N8 needs N3 (the speed pass) and Will first. No spending.', rates: RATES };
}

/* the rates a finished run measured (normally the smoke): self-play worker-seconds per game at the SAME playout caps, and
 * training seconds per position-epoch. A run at other caps is not used. */
function measuredFrom(dir, C) {
  const S = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
  const G = S.gens[0];
  if (!G || !G.stages.selfplay || !G.stages.selfplay.corpus) return null;
  const lf = JSON.parse(fs.readFileSync(path.join(dir, 'gen1', 'league.json'), 'utf8'));
  const man = JSON.parse(fs.readFileSync(abs(path.join(G.stages.selfplay.chunks[0].dir, 'manifest.json')), 'utf8'));
  if (JSON.stringify(man.flags.pcr) !== JSON.stringify(C.selfplay.pcr)) return { note: 'measured at other playout caps: not used', pcr: man.flags.pcr };
  const out = { source: rel(dir) + ' (' + (S.smoke ? 'smoke' : 'run') + ', ' + G.stages.selfplay.corpus.games + ' games, ' + man.flags.workers + ' workers' + (S.beside_ladder ? ', BESIDE THE LIVE LADDER' : '') + ')',
    worker_s_per_game: G.stages.selfplay.corpus.worker_s_per_game, pcr: man.flags.pcr, league_weights: lf.weights };
  const T = G.stages.train;
  if (T && T.done && T.history && T.history.length) {
    const m = JSON.parse(fs.readFileSync(abs(path.join(path.dirname(T.net), 'metrics.json')), 'utf8'));
    const ep = T.history[0];
    out.train_s_per_step = +(ep.seconds / Math.max(1, ep.steps)).toFixed(3);
    out.train_note = 'epoch 0: ' + ep.steps + ' optimiser step(s) at batch ' + m.flags.bs + (m.anchor.on ? ' plus an equal human anchor batch' : ' (no anchor)') +
      ' in ' + ep.seconds + ' s INCLUDING the VAL evaluation (' + (ep.anchor_val_rows || 0) + ' human rows): an UPPER bound per step';
  }
  return out;
}

/* ------------------------------------------------------------------ the plan (dry-run) */
function plan(C, S) {
  const g = S ? S.gens.length + (S.gens.length && S.gens[S.gens.length - 1].status === 'running' ? 0 : 1) : 1;
  const dir = path.join(C._out, `gen${g}`);
  const champ = S ? S.champion : { spec: JSON.parse(fs.readFileSync(abs(C.champion.spec), 'utf8')), net: C.champion.net };
  const SP = C.selfplay;
  const lines = [];
  for (let c = 0; c < SP.chunks; c++) lines.push({ stage: `selfplay chunk ${c}`, argv: ['node', 'solver/mew/run.js', '--release', C.engine_release, '--league', rel(path.join(dir, 'league.json')), '--games', String(chunkGames(C, c)),
    '--seed', String(SP.seed_base + c), '--workers', String(SP.workers), '--cap', String(SP.cap), '--out', rel(path.join(dir, 'selfplay', `chunk-${String(c).padStart(2, '0')}.tmp`)), '--team-store', C.team_store,
    '--info', SP.info, '--spreads', SP.spreads, '--n7', '--pcr', JSON.stringify(SP.pcr), '--am-rate', String(SP.am_rate), '--am-n', String(SP.am_n)] });
  lines.push({ stage: 'build', argv: ['node', 'solver/machamp/n7/build.js', '--chunks', '<every chunk dir>', '--out', rel(path.join(dir, 'data')), '--val-mod', String(C.build.val_mod), '--seed', C.build.seed] });
  lines.push({ stage: 'train', argv: ['python', 'solver/machamp/n7/train.py', 'train', '--data', rel(path.join(dir, 'data')), '--init', (S && S.champion.n7_net) || C.init_net, '--out', rel(path.join(dir, 'train')),
    '--epochs', String(C.train.epochs), '--threads', String(C.train.threads), '--base-mag', champ.spec.mag, '--base-doduo', champ.spec.doduo,
    ...(C._anchor ? ['--anchor-data', C._anchor.data, '--anchor-teacher', C._anchor.teacher] : ['--no-anchor'])] });
  lines.push({ stage: 'export + parity', argv: ['python', 'solver/machamp/n7/train.py', 'export', '--out', rel(path.join(dir, 'train'))] });
  lines.push({ stage: 'offline gate', argv: ['node', 'solver/machamp/n7/offline_gate.js', '--prereg', rel(C._file), '--harness-src', C._harnessSrc, '--dir', rel(path.join(dir, 'offline')), '--champ-net', champ.net,
    '--cand-net', rel(path.join(dir, 'train', 'net.json')), '--train-dir', rel(path.join(dir, 'train')), '--workers', String(C.offline_gate.workers), '--release', C.offline_gate.release, ...(C.offline_gate.subsample ? ['--subsample', String(C.offline_gate.subsample)] : [])] });
  const gs = ['--release', C.engine_release, '--x', rel(path.join(dir, 'specs', 'cand-2s.json')), '--y', rel(path.join(dir, 'specs', 'champ-2s.json')), '--cap', String(C.screen.cap), '--info', C.screen.flags.info, '--spreads', C.screen.flags.spreads, '--team-store', C.team_store];
  lines.push({ stage: 'screen (only on an offline PASS)', argv: ['node', 'solver/machamp/gate.js', '--pairs', String(C.screen.pairs), '--pair-seed', String(C.screen.pair_seed), '--rule', C.screen.rule, '--seed', String(C.screen.seed), '--workers', String(C.screen.workers), ...gs, '--out', rel(path.join(dir, 'screen', 'result.json'))] });
  lines.push({ stage: 'sprt (only on a screen PASS)', argv: ['node', 'solver/machamp/sprt.js', '--elo0', String(C.sprt.elo0), '--elo1', String(C.sprt.elo1), '--alpha', String(C.sprt.alpha), '--beta', String(C.sprt.beta), '--max-games', String(C.sprt.max_games),
    '--seed', String(C.sprt.seed), '--workers', String(C.sprt.workers), ...gs, '--out', rel(path.join(dir, 'sprt', 'result.json'))] });
  lines.push({ stage: 'promote', argv: ['(in process) promote(): H1 with every bar, under this pre-registration, or the champion is unchanged'] });
  const pre = [];
  const chk = (name, ok, detail) => pre.push({ name, ok: !!ok, detail });
  chk('pre-registration', true, { file: rel(C._file), sha256: C._sha256 });
  chk('engine release present', fs.existsSync(path.join(ROOT, 'data', 'releases', C.engine_release)), C.engine_release);
  chk('harness release present', fs.existsSync(path.join(ROOT, 'data', 'releases', C.harness_release)), C.harness_release);
  chk('team store present', fs.existsSync(path.join(C.team_store, 'games.bo3.jsonl')), C.team_store);
  chk('champion spec and net', fs.existsSync(abs(C.champion.spec)) && fs.existsSync(abs(champ.net)), { spec: C.champion.spec, net: champ.net });
  chk('init net', fs.existsSync(abs(C.init_net)), C.init_net);
  const hm = C._harnessSrc && path.join(C._harnessSrc, 'manifest.json');
  let hs = null; try { hs = JSON.parse(fs.readFileSync(hm, 'utf8')).output.sha256; } catch (e) {}
  chk('frozen harness present and the pre-registered set', hs && hs === C.offline_gate.harness.positions_sha256, { dir: C._harnessSrc, sha256: hs });
  chk('human anchor data present', C._anchor && fs.existsSync(C._anchor.data) && fs.existsSync(C._anchor.teacher), C._anchor || 'OFF (--no-anchor)');
  let L = []; try { L = ladderPids(); } catch (e) {}
  chk('no ladder process running', !L.length, L.length ? { ladder_pids: L, note: C._besideLadder ? 'allowed (smoke beside the ladder)' : 'the loop would exit 3 PAUSED' } : 'none');
  chk('python + torch', (() => { try { cp.execFileSync('python', ['-c', 'import torch'], { stdio: 'ignore' }); return true; } catch (e) { return false; } })(), 'python -c "import torch"');
  return { generation: g, dir: rel(dir), out: rel(C._out), smoke: C._smoke, stop_after: C._stopAfter, champion: { name: champ.spec.name, net: champ.net }, preflight: pre, stages: lines };
}

/* ------------------------------------------------------------------ main */
async function run(o) {
  const C = config(o);
  if (o.estimate || o.dryRun) {
    const measured = o.measured ? measuredFrom(abs(o.measured), C) : null;
    const est = estimate(C, measured);
    if (o.estimate) { console.log(JSON.stringify(est, null, 1)); return EXIT.OK; }
    console.log(JSON.stringify({ dry_run: true, plan: plan(C, loadState(C)), estimate: est.per_generation }, null, 1));
    return EXIT.OK;
  }
  let S = loadState(C);
  if (o.status) { console.log(JSON.stringify(S ? { tag: S.tag, champion: S.champion.spec.name, gens: S.gens.map(G => ({ g: G.g, status: G.status, stages: Object.fromEntries(Object.entries(G.stages).map(([k, v]) => [k, v.done ? 'done' : v.void ? 'VOID' : 'open'])) })), promotions: S.promotions } : 'no state at ' + rel(C._out), null, 1)); return EXIT.OK; }
  const armed = Object.keys(process.env).filter(k => /_BREAK$/.test(k) && process.env[k]);
  if (armed.length && !o.testMode) throw Object.assign(new Error('n7/loop: refusing to run with a deliberate break armed: ' + armed.join(', ')), { code: EXIT.USAGE });
  if (!S) { S = initState(C); event(S, 'created', { smoke: C._smoke }); saveState(C, S); }
  else {
    event(S, 'resumed', { pid: process.pid }); saveState(C, S);
    /* every finished stage of every generation is re-hashed before anything builds on it */
    for (const G of S.gens) for (const [k, st] of Object.entries(G.stages)) {
      if (k === 'selfplay') (st.chunks || []).forEach((c, i) => c && c.done && verifyDigests(`gen ${G.g} selfplay chunk ${i}`, c.digests));
      else if (st.done) verifyDigests(`gen ${G.g} ${k}`, st.digests);
    }
  }
  const stopAt = C._stopAfter;
  const stop = k => stopAt && STAGES.indexOf(k) >= STAGES.indexOf(stopAt);
  const target = S.gens.filter(G => G.status !== 'running').length + o.gens;
  while (S.gens.filter(G => G.status !== 'running').length < target) {
    const open = S.gens.find(G => G.status === 'running');
    const g = open ? open.g : S.gens.length + 1;
    const G = genOf(S, g, C); saveState(C, S);
    const dir = path.join(C._out, `gen${g}`);
    fs.mkdirSync(dir, { recursive: true });
    try {
      await stageSelfplay(C, S, G, dir); if (stop('selfplay')) break;
      await stageBuild(C, S, G, dir); if (stop('build')) break;
      await stageTrain(C, S, G, dir); if (stop('train')) break;
      const ov = await stageOffline(C, S, G, dir);
      if (ov.value !== 'PASS') { if (!C._smoke) { G.status = 'rejected-offline'; saveState(C, S); continue; } }
      if (stop('offline')) break;
      const sc = await stageGame(C, S, G, dir, 'screen', o);
      if (sc.verdict_code !== 'PASS') { G.status = 'rejected-screen'; saveState(C, S); continue; }
      if (stop('screen')) break;
      await stageGame(C, S, G, dir, 'sprt', o);
      if (stop('sprt')) break;
      await stagePromote(C, S, G, dir);
    } catch (e) {
      if (e.reject === 'corpus') { G.status = 'rejected-corpus'; saveState(C, S); throw e; }
      throw e;
    }
  }
  S = loadState(C) || S;
  console.log(JSON.stringify({ done: true, out: rel(C._out), champion: S.champion.spec.name, gens: S.gens.map(G => ({ g: G.g, status: G.status })), stopped_after: stopAt || null }, null, 1));
  return EXIT.OK;
}

if (require.main === module) {
  const o = parseArgs(process.argv.slice(2));
  run(o).then(c => process.exit(c), e => { console.error((e && e.message) || e); if (e && e.stack && !(e instanceof Paused) && !(e instanceof Void) && !e.code) console.error(e.stack); process.exit(e && e.code != null ? e.code : EXIT.FAIL); });
}

module.exports = { run, config, parseArgs, promote, estimate, plan, verifyDigests, parity, STAGES, EXIT, RATES };
