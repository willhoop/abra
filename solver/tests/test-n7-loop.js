/* solver/tests/test-n7-loop.js — the N7 self-play loop (solver/machamp/n7/) proves it resumes, keeps its manifests and
 * promotes only on H1.
 *
 *   node solver/tests/test-n7-loop.js [--no-red] [--only RESUME,MANIFEST,PROMOTE,NET,POLICY,PCR,PCRCUT,PAUSE] [--keep]
 *        exit 0 GREEN, 1 RED
 *
 * Runs the real loop (solver/machamp/n7/loop.js) on a TINY pre-registration written here (4 self-play games in 2 chunks, one
 * worker, 3-pass FULL / 1-pass FAST searches, one short epoch, no anchor), on the frozen release df172ccd2aaf and the frozen team
 * store, into solver/out/n7/test-<pid>/ (removed at the end unless --keep). Every child lowers its own priority.
 *
 *   RESUME    the loop is KILLED (taskkill /T /F of the child this test started, by pid) while self-play chunk 1 runs, after
 *             chunk 0 finished: the state file still parses (written by rename), chunk 0 is recorded done with its digests,
 *             chunk 1 is not. The same command then finishes the generation through training without replaying chunk 0
 *             (its manifest's start time and digests are unchanged), and the state records the resume. The learner's own
 *             checkpoint resumes too: train.py run for 1 epoch, then asked for 2 on the same directory, plays exactly one more.
 *   MANIFEST  every corpus and model the state names carries a sha256 (chunk manifests and shards, the dataset, the net, the
 *             checkpoint); build.js verify passes on the dataset, fails on a one-byte edit, and finds no game in both train and
 *             val; one byte appended to a finished chunk's shard makes the next resume REFUSE ("MANIFEST INTEGRITY").
 *   PROMOTE   promote() refuses H0, INCONCLUSIVE, VOID, a failed bar, another pre-registration's read, a read whose X arm does
 *             not carry this generation's net, and a missing read; it promotes only H1 with every bar met.
 *   NET       the exported net: solver/machamp/n7/net.js and the deployed leaf solver/porygon2/v3/infer.js reproduce the Python
 *             float64 logits, and net.js the policy outputs of both chairs, to 1e-9; the fixture names the file's sha256; the
 *             value is antisymmetric under a chair swap.
 *   POLICY    a net whose head favours switches, served through solver/machamp/n7/policy.js on a real position: the call is
 *             counted, joints are tilted, the scores move off DODUO's and still sum to 1, and a head pinned to another DODUO is
 *             refused.
 *   PCR       playout-cap randomisation: the run played FULL and FAST decisions, recorded ONLY full ones as targets, and
 *             recorded exactly one encoded view (the decider's) per recorded decision, at its turn and side.
 *   PCRCUT    one FULL decision cut short of its pass cap by the budgetMs ceiling is counted cut (info.pcr_cut, pcr.full_cut),
 *             and one that reached its cap is not. Plays no game.
 *   PAUSE     with a ladder process present (N7_FAKE_LADDER) and no --allow-beside-ladder the loop exits 3 before any stage.
 *
 * RED, unless --no-red (each must turn this test red):
 *   N7_LOOP_BREAK=resume     finished chunks are replayed on resume        -> RESUME
 *   N7_TRAIN_BREAK=nosave    the learner writes no checkpoint              -> RESUME
 *   N7_LOOP_BREAK=integrity  a resume does not re-hash finished outputs    -> MANIFEST
 *   N7_BUILD_BREAK=split     the val split is drawn per position           -> MANIFEST
 *   N7_LOOP_BREAK=promote    promote() accepts any read                    -> PROMOTE
 *   N7_NET_BREAK=chair       the policy reads p1's hidden for both chairs  -> NET
 *   N7_POLICY_BREAK=off      the head passes the base scores through      -> POLICY
 *   N7_RECORD_BREAK=fast     fast decisions are recorded as targets        -> PCR
 *   N7_PCR_BREAK=nocut       a search cut short of its cap is not counted  -> PCRCUT
 *   N7_LOOP_BREAK=ladder     the loop ignores a ladder process             -> PAUSE
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const zlib = require('zlib');
try { require('os').setPriority(0, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
const ROOT = path.join(__dirname, '..', '..');
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const MAIN = 'C:/Users/willj/Projects/Pokemon/ABRA';
if (!process.env.SHOWDOWN_PATH) { const sib = path.join(MAIN, '..', 'pokemon-showdown-mc'); if (fs.existsSync(path.join(sib, 'dist', 'sim'))) process.env.SHOWDOWN_PATH = sib; }
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red'), KEEP = argv.includes('--keep');
const ONLY = argv.includes('--only') ? (argv[argv.indexOf('--only') + 1] || '').split(',').filter(Boolean) : [];
const want = c => !ONLY.length || ONLY.includes(c);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const LOOP = path.join(ROOT, 'solver', 'machamp', 'n7', 'loop.js');
const STORE = path.join(MAIN, 'data', 'team-pool-frozen-regmc');
const TMP = path.join(ROOT, 'solver', 'out', 'n7', 'test-' + process.pid);
fs.mkdirSync(TMP, { recursive: true });

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log(`  FAIL [${clause}] ${msg}`); } };

/* ---- the tiny pre-registration ---- */
function testPrereg(dir) {
  const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'machamp', 'n7', 'preregistration-gen1.json'), 'utf8'));
  P.what = 'TEST pre-registration written by solver/tests/test-n7-loop.js (not a run)';
  P.tag = 'test'; P.generation = 1; P.team_store = STORE;
  Object.assign(P.selfplay, { games: 4, chunks: 2, seed_base: 49001, workers: 1, league_weights: { current: 1, previous: 0, clone: 0 },
    pcr: { p: 0.5, full: { maxPasses: 3, budgetMs: 4000 }, fast: { maxPasses: 1, budgetMs: 2000 } }, am_rate: 0.5, am_n: 2 });
  P.selfplay.bars = Object.assign({}, P.selfplay.bars, { pcr_full_share_tolerance: 0.5, max_pass_cut_share: 1 });   // a test asks about the machinery, not the machine's load
  Object.assign(P.train, { epochs: 1, bs: 16, threads: 1, max_steps: 2, anchor: { required: false, data: 'none', teacher: 'none' } });
  const f = path.join(dir, 'prereg-test.json');
  fs.writeFileSync(f, JSON.stringify(P, null, 1));
  return f;
}
const loopArgs = (pre, out) => [LOOP, '--prereg', pre, '--out', out, '--stop-after', 'train', '--no-anchor', '--no-guard', '--gens', '1'];
const env = extra => Object.assign({}, process.env, { N7_TEST_MODE: '1' }, extra || {});
function runLoop(pre, out, extra) {
  return cp.spawnSync(process.execPath, loopArgs(pre, out), { cwd: ROOT, env: env(extra), encoding: 'utf8', maxBuffer: 64 << 20 });
}
const stateOf = out => JSON.parse(fs.readFileSync(path.join(out, 'state.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* a completed tiny run (through training), made once per process and shared by the clauses that only read it */
let RUN = null;
async function completedRun() {
  if (RUN) return RUN;
  const out = path.join(TMP, 'run');
  const pre = testPrereg(TMP);
  const r = runLoop(pre, out);
  if (r.status !== 0) { console.log(r.stdout.slice(-2000), r.stderr.slice(-2000)); throw new Error('the tiny loop run failed: exit ' + r.status); }
  RUN = { out, pre, state: stateOf(out) };
  return RUN;
}

async function RESUME() {
  const out = path.join(TMP, 'resume');
  const pre = testPrereg(TMP);
  const ch = cp.spawn(process.execPath, loopArgs(pre, out), { cwd: ROOT, env: env(), stdio: 'ignore', windowsHide: true });
  let killedAt = null, exited = false;
  ch.on('exit', () => { exited = true; });
  const tmp1 = path.join(out, 'gen1', 'selfplay', 'chunk-01.tmp');
  for (let i = 0; i < 2400 && !exited; i++) {
    await sleep(250);
    let S = null; try { S = stateOf(out); } catch (e) { continue; }
    const c0 = S.gens[0] && S.gens[0].stages.selfplay && S.gens[0].stages.selfplay.chunks[0];
    if (c0 && c0.done && fs.existsSync(tmp1)) {
      await sleep(1500);                                   // chunk 1's workers are playing
      try { cp.execFileSync('taskkill', ['/PID', String(ch.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { ch.kill(); }
      killedAt = new Date().toISOString();
      break;
    }
  }
  for (let i = 0; i < 40 && !exited; i++) await sleep(250);
  ok('RESUME', killedAt, 'the loop finished before it could be killed mid-chunk (the clause asked nothing)');
  let S1 = null;
  try { S1 = stateOf(out); } catch (e) { ok('RESUME', false, 'the state file does not parse after the kill: ' + e.message); return; }
  const c0 = S1.gens[0].stages.selfplay.chunks[0], c1 = S1.gens[0].stages.selfplay.chunks[1];
  ok('RESUME', c0 && c0.done && c0.digests && Object.keys(c0.digests).length >= 2, 'chunk 0 is not recorded done with digests after the kill');
  ok('RESUME', !(c1 && c1.done), 'chunk 1 is recorded done although it was killed mid-run');
  const m0 = path.join(ROOT, c0.dir, 'manifest.json');
  const started0 = JSON.parse(fs.readFileSync(m0, 'utf8')).started, dig0 = JSON.stringify(c0.digests);
  const r = runLoop(pre, out);
  ok('RESUME', r.status === 0, 'the resumed loop exited ' + r.status + ' ' + (r.stderr || '').slice(-600));
  const S2 = stateOf(out);
  const d0 = S2.gens[0].stages.selfplay.chunks[0];
  ok('RESUME', JSON.parse(fs.readFileSync(path.join(ROOT, d0.dir, 'manifest.json'), 'utf8')).started === started0, 'chunk 0 was REPLAYED on resume (its manifest start time changed)');
  ok('RESUME', JSON.stringify(d0.digests) === dig0, 'chunk 0 digests changed on resume');
  ok('RESUME', S2.gens[0].stages.selfplay.chunks[1] && S2.gens[0].stages.selfplay.chunks[1].done, 'chunk 1 was not finished by the resume');
  ok('RESUME', S2.gens[0].stages.train && S2.gens[0].stages.train.done && S2.gens[0].stages.train.parity.pass, 'the resumed generation did not train and pass parity');
  ok('RESUME', S2.events.some(e => e.kind === 'resumed'), 'the state does not record the resume');
  /* the learner's checkpoint: 1 epoch, then 2 on the same directory = exactly one more epoch, RESUMED */
  const tdir = path.join(TMP, 'train-resume');
  fs.rmSync(tdir, { recursive: true, force: true });
  const targs = e => [path.join(ROOT, 'solver', 'machamp', 'n7', 'train.py'), 'train', '--data', path.join(out, 'gen1', 'data'), '--init', 'solver/porygon2/v3/model/porygon2-v3-student.json',
    '--out', tdir, '--epochs', String(e), '--bs', '16', '--threads', '1', '--max-steps', '2', '--no-anchor', '--patience', '0',
    '--base-mag', 'solver/machamp/models/gen5/mag-gen5.json', '--base-doduo', 'solver/machamp/models/gen5/doduo-gen5.json'];
  const t1 = cp.spawnSync('python', targs(1), { cwd: ROOT, env: process.env, encoding: 'utf8' });
  const t2 = cp.spawnSync('python', targs(2), { cwd: ROOT, env: process.env, encoding: 'utf8' });
  const ep2 = (t2.stdout.match(/\] epoch \d+:/g) || []).length;
  ok('RESUME', t1.status === 0 && t2.status === 0, `train.py exited ${t1.status} / ${t2.status} ${(t2.stderr || '').slice(-400)}`);
  ok('RESUME', /RESUMED after epoch 0/.test(t2.stdout) && ep2 === 1, `the learner did not resume from its checkpoint (RESUMED: ${/RESUMED/.test(t2.stdout)}, epochs run by the second call: ${ep2})`);
}

async function MANIFEST() {
  const R = await completedRun();
  const G = R.state.gens[0];
  const hex = h => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h);
  for (const c of G.stages.selfplay.chunks) {
    const ks = Object.keys(c.digests || {});
    ok('MANIFEST', ks.some(k => /manifest\.json$/.test(k)) && ks.some(k => /shard-\d+\.jsonl\.gz$/.test(k)) && ks.every(k => hex(c.digests[k])), 'a chunk does not carry the sha256 of its manifest and every shard: ' + JSON.stringify(ks));
  }
  ok('MANIFEST', Object.keys(G.stages.build.digests || {}).some(k => /rows\.jsonl\.gz$/.test(k)), 'the dataset digest is not in the state');
  const td = Object.keys(G.stages.train.digests || {});
  ok('MANIFEST', ['net.json', 'model.pt', 'fixture.json', 'metrics.json'].every(n => td.some(k => k.endsWith('/' + n))), 'the model digests are incomplete: ' + td.join(', '));
  const B = require('../machamp/n7/build.js');
  const data = path.join(R.out, 'gen1', 'data');
  const v = B.verify(data);
  ok('MANIFEST', v.ok, 'build verify failed on the untouched dataset (a game in both splits, or a hash mismatch): ' + JSON.stringify(v.problems));
  const copy = path.join(TMP, 'data-tamper');
  fs.rmSync(copy, { recursive: true, force: true }); fs.mkdirSync(copy);
  for (const f of fs.readdirSync(data)) fs.copyFileSync(path.join(data, f), path.join(copy, f));
  const rows = path.join(copy, 'rows.jsonl.gz'); const buf = fs.readFileSync(rows); buf[buf.length >> 1] ^= 0xff; fs.writeFileSync(rows, buf);
  let tv; try { tv = B.verify(copy); } catch (e) { tv = { ok: false }; }
  ok('MANIFEST', !tv.ok, 'build verify passed a dataset with one byte changed');
  /* one byte appended to a finished chunk's shard: the next resume must refuse */
  const shardRel = Object.keys(G.stages.selfplay.chunks[0].digests).find(k => /shard-\d+\.jsonl\.gz$/.test(k));
  const shard = path.join(ROOT, shardRel);
  const orig = fs.readFileSync(shard);
  fs.writeFileSync(shard, Buffer.concat([orig, Buffer.from([0])]));
  const r = runLoop(R.pre, R.out);
  fs.writeFileSync(shard, orig);
  ok('MANIFEST', r.status !== 0 && /MANIFEST INTEGRITY/.test(r.stderr), `a resume over an edited shard did not refuse (exit ${r.status}): ${(r.stderr || '').slice(-300)}`);
}

async function PROMOTE() {
  const loop = require('../machamp/n7/loop.js');
  const net = path.join(ROOT, 'solver', 'porygon2', 'v3', 'model', 'porygon2-v3-student.json');
  const gen5 = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'machamp', 'league', 'gen5.json'), 'utf8'));
  const S = { tag: 'test', champion: { spec: gen5 } };
  const G = { g: 1, prereg: { sha256: 'a'.repeat(64) }, stages: { train: { net: path.relative(ROOT, net).split(path.sep).join('/'), net_sha256: sha(net) }, screen: { read: { verdict_code: 'PASS' } } } };
  const good = { kind: 'sprt', verdict_code: 'H1', capability_ok: true, preregistration_sha256: 'a'.repeat(64), x_spec: Object.assign({}, gen5, { pory2: G.stages.train.net }), sprt: { games_used: 640 } };
  const cases = [
    ['H0', { verdict_code: 'H0' }], ['INCONCLUSIVE', { verdict_code: 'INCONCLUSIVE' }], ['VOID', { verdict_code: 'VOID', capability_ok: false }],
    ['a failed bar', { capability_ok: false }], ['another pre-registration', { preregistration_sha256: 'b'.repeat(64) }],
    ["an X arm without this generation's net", { x_spec: gen5 }], ['a screen read, not an SPRT read', { kind: 'screen' }]];
  for (const [name, patch] of cases) {
    const f = path.join(TMP, 'read-' + name.replace(/\W+/g, '_') + '.json');
    fs.writeFileSync(f, JSON.stringify(Object.assign({}, good, patch)));
    let refused = false; try { loop.promote(S, G, f); } catch (e) { refused = !!e.refused; }
    ok('PROMOTE', refused, 'promote() did not refuse ' + name);
  }
  let refused = false; try { loop.promote(S, G, path.join(TMP, 'no-such-read.json')); } catch (e) { refused = !!e.refused; }
  ok('PROMOTE', refused, 'promote() did not refuse a missing read');
  const f = path.join(TMP, 'read-good.json'); fs.writeFileSync(f, JSON.stringify(good));
  let ch = null; try { ch = loop.promote(S, G, f); } catch (e) { ok('PROMOTE', false, 'promote() refused a clean H1: ' + e.message); }
  ok('PROMOTE', ch && ch.spec.pory2 === G.stages.train.net && !ch.spec.adaptive, 'a clean H1 did not make the candidate net the champion leaf');
}

async function NET() {
  const R = await completedRun();
  const tdir = path.join(R.out, 'gen1', 'train');
  const N = require('../machamp/n7/net.js').load(path.join(tdir, 'net.json'));
  const I = require('../porygon2/v3/infer.js').load(path.join(tdir, 'net.json'));
  const F = JSON.parse(fs.readFileSync(path.join(tdir, 'fixture.json'), 'utf8'));
  ok('NET', F.model.sha256 === sha(path.join(tdir, 'net.json')), 'the fixture does not name the exported file');
  ok('NET', F.rows.length >= 4, 'fixture rows ' + F.rows.length);
  let wl = 0, wi = 0, wt = 0, wa = 0;
  const swapX = X => ({ tok: { p1: X.tok.p2, p2: X.tok.p1 }, ids: { p1: X.ids.p2, p2: X.ids.p1 }, side: { p1: X.side.p2, p2: X.side.p1 }, field: X.field,
    facts: { p1: X.facts.p2, p2: X.facts.p1 }, base: X.base.map(v => -v), rating: [X.rating[1], X.rating[0]] });
  for (const r of F.rows) {
    const f = N.forward(r.x);
    wl = Math.max(wl, Math.abs(f.logit - r.python_logit)); wi = Math.max(wi, Math.abs(I.logit(r.x) - r.python_logit));
    const a = N.tilt(f.hidA), b = N.tilt(f.hidB);
    for (let q = 0; q < a.length; q++) wt = Math.max(wt, Math.abs(a[q] - r.python_tilt_A[q]), Math.abs(b[q] - r.python_tilt_B[q]));
    wa = Math.max(wa, Math.abs(f.logit + N.logit(swapX(r.x))));
  }
  ok('NET', wl <= 1e-9, 'net.js logit vs python ' + wl);
  ok('NET', wi <= 1e-9, 'the deployed v3 leaf (infer.js) vs python ' + wi);
  ok('NET', wt <= 1e-9, 'net.js policy outputs vs python (both chairs) ' + wt);
  ok('NET', wa <= 1e-9, 'antisymmetry ' + wa);
  ok('NET', N.hasPolicy && N.policy.base_prior && /^[0-9a-f]{64}$/.test(N.policy.base_prior.doduo), 'the exported head is not pinned to its DODUO');
}

async function POLICY() {
  require('../arena/env.js');
  const E = require('../arena/engine.js').load('df172ccd2aaf');
  const API = E.API, M = API.M;
  const T = require('../arena/teams.js');
  const P = require('../mew/pairs.js').load({ teamStore: STORE });
  const mag = path.join(ROOT, 'solver/machamp/models/gen5/mag-gen5.json'), doduo = path.join(ROOT, 'solver/machamp/models/gen5/doduo-gen5.json');
  /* a head that favours every switch joint: the student's file plus a policy block whose bias puts +4 on switch_any */
  const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/porygon2/v3/model/porygon2-v3-student.json'), 'utf8'));
  const SIT = require('../gary/situation.js');
  const NB = SIT.NB, f32 = a => Buffer.from(new Float32Array(a).buffer).toString('base64');
  const bias = new Array(1 + NB).fill(0); bias[1 + SIT.CLASS_NAMES.indexOf('switch_any')] = 4;
  J.policy = { arch: 'tilt-v1', class_names: SIT.CLASS_NAMES, base_prior: { mag: sha(mag), doduo: sha(doduo) },
    weights: { 'p.weight': { shape: [1 + NB, 64], f32_b64: f32(new Array((1 + NB) * 64).fill(0)) }, 'p.bias': { shape: [1 + NB], f32_b64: f32(bias) } } };
  const nf = path.join(TMP, 'policy-net.json'); fs.writeFileSync(nf, JSON.stringify(J));
  const prior = require('../mag/infer.js').load({ mag, doduo });
  const PA = require('../miltank/prior_adapter.js').create(API, prior);
  const POL = require('../machamp/n7/policy.js');
  const W = POL.create(API, { net: nf, prior, priorFiles: { mag, doduo } });
  const PW = W.wrap(PA);
  let moved = 0, positions = 0, swUp = 0;
  for (const G0 of P.train.slice(0, 6)) {
    const a = T.buildTeam(M, G0, 'p1'), b = T.buildTeam(M, G0, 'p2');
    if (!a || !b) continue;
    const S = API.newBattle(a.team, b.team, { rng: API.makeRng(5) });
    const ctx = PA.newGame(G0);
    const la = API.legalActions(S, 'A');
    if (la.joint.length < 2) continue;
    positions++;
    const base = PA.scoreJoints(ctx, S, 'A', 'A', la), tl = PW.scoreJoints(ctx, S, 'A', 'A', la);
    const sum = Array.from(tl).reduce((p, q) => p + q, 0);
    ok('POLICY', Math.abs(sum - 1) < 1e-9, 'the tilted scores do not sum to 1: ' + sum);
    let d = 0; for (let i = 0; i < base.length; i++) d = Math.max(d, Math.abs(tl[i] / tl.reduce((p, q) => p + q, 0) - base[i] / base.reduce((p, q) => p + q, 0)));
    if (d > 1e-3) moved++;
    const sw = la.joint.map(j => j.some(x => x && x.kind === 'switch'));
    const massSw = (s) => s.reduce((p, q, i) => p + (sw[i] ? q : 0), 0) / s.reduce((p, q) => p + q, 0);
    if (sw.some(Boolean) && massSw(Array.from(tl)) > massSw(Array.from(base)) + 1e-6) swUp++;
  }
  ok('POLICY', positions >= 3, 'fewer than 3 positions with a choice');
  ok('POLICY', W.COUNTERS.calls >= positions && W.COUNTERS.tilted > 0, 'the head was not served: ' + JSON.stringify(W.COUNTERS));
  ok('POLICY', moved === positions && swUp > 0, `the head did not move the scores (moved ${moved} of ${positions}; switch mass up on ${swUp})`);
  let refused = false;
  try { POL.create(API, { net: nf, prior, priorFiles: { mag: path.join(ROOT, 'solver/mag/model/mag-v1.json'), doduo: path.join(ROOT, 'solver/mag/model/doduo-v1.json') } }); } catch (e) { refused = /different DODUO/.test(e.message); }
  ok('POLICY', refused, 'a head pinned to gen5 DODUO was served over another DODUO');
}

async function PCR() {
  const R = await completedRun();
  const G = R.state.gens[0];
  let full = 0, fastRec = 0, featsMissing = 0, games = 0;
  for (const c of G.stages.selfplay.chunks) {
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, c.dir, 'manifest.json'), 'utf8'));
    ok('PCR', man.agent_counters.pcr && man.agent_counters.pcr.full > 0 && man.agent_counters.pcr.fast > 0, 'the chunk did not play both FULL and FAST decisions: ' + JSON.stringify(man.agent_counters.pcr));
    ok('PCR', man.n7 && man.n7.fast_skipped > 0, 'no fast decision was skipped as a target: ' + JSON.stringify(man.n7));
    for (const s of man.shards) for (const l of zlib.gunzipSync(fs.readFileSync(path.join(ROOT, s.file))).toString('utf8').split('\n').filter(Boolean)) {
      const g = JSON.parse(l); games++;
      for (const d of g.decisions) { if (d.pcr === 'full') full++; else fastRec++; }
      const ft = new Set(g.n7.feats.map(f => f.t + ':' + f.side));
      for (const d of g.decisions) if (!ft.has(d.t + ':' + d.side)) featsMissing++;
      if (g.n7.feats.length !== g.decisions.length) featsMissing += Math.abs(g.n7.feats.length - g.decisions.length);
    }
  }
  ok('PCR', games >= 4 && full > 0, `games ${games}, full recorded ${full}`);
  ok('PCR', fastRec === 0, fastRec + ' FAST decisions were recorded as training targets');
  ok('PCR', featsMissing === 0, featsMissing + ' recorded decisions have no encoded position at their turn');
}

async function PCRCUT() {
  /* THE PASS-CAP CUT IS COUNTED: one FULL decision under a 1 ms ceiling cannot reach 40 passes and must be counted cut;
   * the same decision under a generous ceiling must not be */
  require('../arena/env.js');
  const E = require('../arena/engine.js').load('df172ccd2aaf');
  const API = E.API, M = API.M;
  const T = require('../arena/teams.js');
  const P = require('../mew/pairs.js').load({ teamStore: STORE });
  const AG = require('../mew/agent.js').create(API, { buildBody: T.buildBody });
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'machamp', 'league', 'gen5.json'), 'utf8'));
  const a = AG.load(spec);
  let pos = null;
  for (const G0 of P.train.slice(0, 6)) { const ta = T.buildTeam(M, G0, 'p1'), tb = T.buildTeam(M, G0, 'p2'); if (ta && tb) { pos = { G0, S: API.newBattle(ta.team, tb.team, { rng: API.makeRng(3) }) }; break; } }
  const ctx = a.PA.newGame(pos.G0);
  const cut = a.bot(7, { pcr: { p: 1, full: { maxPasses: 40, budgetMs: 1 }, fast: { maxPasses: 1, budgetMs: 1 } } }).choose(pos.S, 'A', ctx);
  const c1 = Object.assign({}, AG.COUNTERS.pcr);
  const whole = a.bot(8, { pcr: { p: 1, full: { maxPasses: 2, budgetMs: 600000 }, fast: { maxPasses: 1, budgetMs: 600000 } } }).choose(pos.S, 'A', ctx);
  const c2 = Object.assign({}, AG.COUNTERS.pcr);
  ok('PCRCUT', cut.info.pcr === 'full' && cut.info.pcr_cut === true && (c1.full_cut || 0) >= 1, 'a FULL search under a 1 ms ceiling was not counted cut: ' + JSON.stringify({ info: { pcr: cut.info.pcr, cut: cut.info.pcr_cut, passes: cut.info.passes, fallback: cut.info.fallback }, c1 }));
  ok('PCRCUT', whole.info.pcr === 'full' && !whole.info.pcr_cut && (c2.full_cut || 0) === (c1.full_cut || 0), 'a FULL search that reached its cap was counted cut: ' + JSON.stringify({ passes: whole.info.passes, c1, c2 }));
}

async function PAUSE() {
  const out = path.join(TMP, 'pause');
  const pre = testPrereg(TMP);
  const r = cp.spawnSync(process.execPath, [LOOP, '--prereg', pre, '--out', out, '--stop-after', 'selfplay', '--no-anchor'], { cwd: ROOT, env: env({ N7_FAKE_LADDER: '424242' }), encoding: 'utf8' });
  ok('PAUSE', r.status === 3 && /PAUSED/.test(r.stderr), `with a ladder present the loop exited ${r.status}: ${(r.stderr || '').slice(-300)}`);
  ok('PAUSE', !fs.existsSync(path.join(out, 'gen1', 'selfplay', 'chunk-00')) && !fs.existsSync(path.join(out, 'gen1', 'selfplay', 'chunk-00.tmp')), 'a self-play chunk started beside the ladder');
}

(async () => {
  const clauses = { RESUME, MANIFEST, PROMOTE, NET, POLICY, PCR, PCRCUT, PAUSE };
  for (const [name, fn] of Object.entries(clauses)) {
    if (!want(name)) continue;
    const t0 = Date.now();
    try { await fn(); } catch (e) { ok(name, false, 'threw: ' + (e && e.stack || e).toString().slice(0, 600)); }
    console.log(`${name}: ${failed.has(name) ? 'RED' : 'GREEN'}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  const red = {};
  if (!NO_RED) {
    const REDS = [['RESUME', { N7_LOOP_BREAK: 'resume' }], ['RESUME', { N7_TRAIN_BREAK: 'nosave' }], ['MANIFEST', { N7_LOOP_BREAK: 'integrity' }], ['MANIFEST', { N7_BUILD_BREAK: 'split' }],
      ['PROMOTE', { N7_LOOP_BREAK: 'promote' }], ['NET', { N7_NET_BREAK: 'chair' }], ['POLICY', { N7_POLICY_BREAK: 'off' }], ['PCR', { N7_RECORD_BREAK: 'fast' }], ['PCRCUT', { N7_PCR_BREAK: 'nocut' }], ['PAUSE', { N7_LOOP_BREAK: 'ladder' }]];
    for (const [cl, e] of REDS) {
      if (!want(cl)) continue;
      const r = cp.spawnSync(process.execPath, [__filename, '--only', cl, '--no-red'], { cwd: ROOT, env: Object.assign({}, process.env, e), encoding: 'utf8', maxBuffer: 64 << 20 });
      const k = Object.entries(e).map(([a, b]) => a + '=' + b).join(' ');
      red[k] = r.status;
      ok('RED', r.status === 1, `${k} should turn ${cl} RED; the test exited ${r.status}`);
      console.log(`RED ${k} -> ${cl}: exit ${r.status}`);
    }
  }
  if (!KEEP) { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { console.log('could not remove ' + TMP + ': ' + e.message); } }
  console.log(JSON.stringify({ checks, fails, failed: [...failed], red }, null, 1));
  console.log(fails ? `RED ${fails}/${checks}` : `GREEN ${checks}/${checks}`);
  process.exit(fails ? 1 : 0);
})();
