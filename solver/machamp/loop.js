/* solver/machamp/loop.js — MACHAMP, the training loop: self-play (MEW) -> build -> train -> gates -> accept or reject.
 *
 *   cmd.exe /c tools\lownode.cmd solver\machamp\loop.js --release eaa5becc54eb --gens 2 [--games 1600] [--workers 4]
 *        [--state solver/out/machamp/<release>/loop-state.json]
 *
 * RESUMABLE: every stage writes its artifact and the state file records it; a rerun skips finished stages.
 *
 * One generation step, from champion c_g (solver/machamp/league/<name>.json):
 *   1. MEW self-play: the league { current: c_g, previous: c_{g-1} (if any), clone: the human clone } plays --games
 *      games on TRAIN team pairs (solver/mew/run.js) into solver/out/selfplay/<release>/gen<g>/
 *   2. build: DODUO targets (build_doduo.js) and PORYGON2 positions (build_pory2.js) from those games
 *   3. train: PORYGON2 then MAG/DODUO, warm-started from c_g, into solver/machamp/models/gen<g+1>/ (small, tracked)
 *   4. gates (solver/machamp/preregistration.json, read once each):
 *        G_pory2_human     read from the PORYGON2 metrics (held-out human test log-loss vs v0)
 *        G_beats_previous  candidate vs c_g, 100 TEST pairs x 2 seats, rule `beats`
 *        G_not_lose_clone  candidate vs the human clone, same pairs, rule `notlose`
 *   5. ACCEPT iff all three pass: the candidate becomes the champion and c_g becomes `previous`. Else the champion is
 *      unchanged and the next generation's self-play is played by it again (with a new seed).
 * Every child runs at the parent's priority (BELOWNORMAL under lownode); node children are process-level, and the
 * Python trainers are capped at 4 threads.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const REL = flag('--release', 'eaa5becc54eb');
const GENS = +flag('--gens', 2), GAMES = +flag('--games', 1600), WORKERS = +flag('--workers', 4);
const OUTR = path.join(ROOT, 'solver', 'out', 'machamp', REL);
const STATE = path.resolve(ROOT, flag('--state', path.join('solver', 'out', 'machamp', REL, 'loop-state.json')));
const PRE = JSON.parse(fs.readFileSync(path.join(__dirname, 'preregistration.json'), 'utf8'));
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const HUMAN_PORY = 'solver/out/porygon2/human-' + REL;
const HUMAN_MAG = 'solver/out/mag';

function load() { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { return null; } }
function save(S) { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(S, null, 1)); }
function stamp(S, key, t0, extra) { S.stages[key] = Object.assign({ done: true, seconds: Math.round((Date.now() - t0) / 1000), at: new Date().toISOString() }, extra || {}); save(S); }

function run(cmd, args, logName) {
  const logf = path.join(OUTR, 'logs', logName + '.log');
  fs.mkdirSync(path.dirname(logf), { recursive: true });
  console.log(`[${new Date().toISOString()}] ${cmd} ${args.join(' ')}   (log ${rel(logf)})`);
  const fd = fs.openSync(logf, 'a');
  const r = cp.spawnSync(cmd, args, { cwd: ROOT, stdio: ['ignore', fd, fd], env: process.env, maxBuffer: 1 << 26 });
  fs.closeSync(fd);
  if (r.status !== 0) throw new Error(`${logName} failed (exit ${r.status}); see ${rel(logf)}`);
}
const node = (script, args, logName, heap) => run(process.execPath, [...(heap ? ['--max-old-space-size=' + heap] : []), script, ...args], logName);
const py = (script, args, logName) => run('python', [script, ...args], logName);

function main() {
  /* a training loop never runs with a deliberate break armed: the break would be trained into a generation */
  const armed = Object.keys(process.env).filter(k => /_BREAK$/.test(k) && process.env[k]);
  if (armed.length) throw new Error('machamp/loop: refusing to run with a deliberate break armed: ' + armed.join(', '));
  let S = load();
  if (!S) {
    S = { what: 'MACHAMP loop state (solver/machamp/loop.js)', release: REL, started: new Date().toISOString(), preregistration: 'solver/machamp/preregistration.json',
          champion: 'solver/machamp/league/gen0.json', previous: null, clone: 'solver/machamp/league/human-clone.json', gen: 0, history: [], stages: {} };
    save(S);
  }
  while (S.history.length < GENS) {
    const g = S.history.length;                 // self-play index
    const cand = g + 1;
    const K = k => `gen${g}:${k}`;
    const spDir = path.join(ROOT, 'solver', 'out', 'selfplay', REL, `gen${g}`);
    const candDir = path.join(OUTR, `cand${cand}`);
    const modelDir = path.join(ROOT, 'solver', 'machamp', 'models', `gen${cand}`);
    fs.mkdirSync(candDir, { recursive: true }); fs.mkdirSync(modelDir, { recursive: true });
    const champ = JSON.parse(fs.readFileSync(path.join(ROOT, S.champion), 'utf8'));

    // 1. self-play
    if (!(S.stages[K('selfplay')] || {}).done) {
      const league = { current: champ, previous: S.previous ? JSON.parse(fs.readFileSync(path.join(ROOT, S.previous), 'utf8')) : null,
                       clone: JSON.parse(fs.readFileSync(path.join(ROOT, S.clone), 'utf8')), weights: { current: 0.6, previous: 0.2, clone: 0.2 } };
      const lf = path.join(candDir, 'league.json'); fs.writeFileSync(lf, JSON.stringify(league, null, 1));
      const t0 = Date.now();
      node(path.join(ROOT, 'solver', 'mew', 'run.js'), ['--release', REL, '--league', rel(lf), '--games', String(GAMES), '--seed', String(100 + g),
        '--workers', String(WORKERS), '--out', rel(spDir)], `gen${g}-selfplay`);
      const man = JSON.parse(fs.readFileSync(path.join(spDir, 'manifest.json'), 'utf8'));
      stamp(S, K('selfplay'), t0, { dir: rel(spDir), games: man.counts.games, games_per_hour: man.games_per_hour, warnings: man.warnings });
    }
    // 2. build
    if (!(S.stages[K('build')] || {}).done) {
      const t0 = Date.now();
      node(path.join(__dirname, 'build_doduo.js'), ['--selfplay', rel(spDir), '--out', rel(path.join(candDir, 'doduo'))], `gen${g}-build-doduo`, 3072);
      node(path.join(__dirname, 'build_pory2.js'), ['--release', REL, '--selfplay', rel(spDir), '--out', rel(path.join(candDir, 'pory2'))], `gen${g}-build-pory2`, 3072);
      stamp(S, K('build'), t0, { doduo: JSON.parse(fs.readFileSync(path.join(candDir, 'doduo', 'meta.json'), 'utf8')).counts,
                                 pory2: JSON.parse(fs.readFileSync(path.join(candDir, 'pory2', 'meta.json'), 'utf8')).counts });
    }
    // 3. train
    const poryOut = path.join(modelDir, `porygon2-gen${cand}.json`);
    const poryMet = path.join(modelDir, `porygon2-gen${cand}.metrics.json`);
    if (!(S.stages[K('train-pory2')] || {}).done) {
      const t0 = Date.now();
      py(path.join('solver', 'machamp', 'train_pory2.py'), ['--init', champ.pory2, '--human', HUMAN_PORY, '--selfplay', rel(path.join(candDir, 'pory2')),
        '--out', rel(poryOut), '--metrics', rel(poryMet), '--name', `PORYGON2 gen${cand}`, '--threads', '4',
        '--fixture', rel(path.join(modelDir, `porygon2-gen${cand}.fixture.json`))], `gen${g}-train-pory2`);
      stamp(S, K('train-pory2'), t0, { gate: JSON.parse(fs.readFileSync(poryMet, 'utf8')).gate_nonworse_vs_v0 });
    }
    if (!(S.stages[K('train-doduo')] || {}).done) {
      const t0 = Date.now();
      py(path.join('solver', 'machamp', 'train_doduo.py'), ['--init-mag', champ.mag, '--init-doduo', champ.doduo, '--human', HUMAN_MAG,
        '--selfplay', rel(path.join(candDir, 'doduo')), '--out-dir', rel(modelDir), '--tag', `gen${cand}`,
        '--metrics', rel(path.join(modelDir, `doduo-gen${cand}.metrics.json`)), '--threads', '4',
        '--fixture', rel(path.join(modelDir, `doduo-gen${cand}.fixture.json`))], `gen${g}-train-doduo`);
      stamp(S, K('train-doduo'), t0, { human_test_vs_v1: JSON.parse(fs.readFileSync(path.join(modelDir, `doduo-gen${cand}.metrics.json`), 'utf8')).human_test_vs_v1.joint_ll });
    }
    const candSpec = Object.assign({}, champ, { name: `gen${cand}`, mag: rel(path.join(modelDir, `mag-gen${cand}.json`)),
      doduo: rel(path.join(modelDir, `doduo-gen${cand}.json`)), pory2: rel(poryOut) });
    const candFile = path.join(__dirname, 'league', `gen${cand}.json`);
    fs.writeFileSync(candFile, JSON.stringify(candSpec, null, 1) + '\n');
    // 4. gates
    const gateOut = (n) => path.join(OUTR, 'gates', `gen${cand}-${n}.json`);
    const seeds = PRE.seeds.gate_battle_seed;
    for (const [name, y, rule, seed] of [['beats-previous', S.champion, 'beats', seeds.beats_previous], ['not-lose-clone', S.clone, 'notlose', seeds.not_lose_clone]]) {
      if ((S.stages[K('gate-' + name)] || {}).done) continue;
      const t0 = Date.now();
      node(path.join(__dirname, 'gate.js'), ['--release', REL, '--x', rel(candFile), '--y', y, '--pairs', '100', '--pair-seed', String(PRE.seeds.gate_pair_seed),
        '--seed', String(seed + 10 * g), '--workers', String(WORKERS), '--rule', rule, '--out', rel(gateOut(name))], `gen${g}-gate-${name}`);
      const r = JSON.parse(fs.readFileSync(gateOut(name), 'utf8'));
      stamp(S, K('gate-' + name), t0, { score: r.result.score_x, ci95: r.result.ci95_x, pass: r.pass, warnings: r.warnings });
    }
    // 5. accept or reject
    const pm = JSON.parse(fs.readFileSync(poryMet, 'utf8')).gate_nonworse_vs_v0;
    const gb = JSON.parse(fs.readFileSync(gateOut('beats-previous'), 'utf8')), gc = JSON.parse(fs.readFileSync(gateOut('not-lose-clone'), 'utf8'));
    const verdict = { gen: g, candidate: rel(candFile), champion_before: S.champion,
      G_pory2_human: { diff: pm.diff, ci95: pm.ci95, pass: pm.pass },
      G_beats_previous: { score: gb.result.score_x, ci95: gb.result.ci95_x, W: gb.result.W, D: gb.result.D, L: gb.result.L, paired: gb.paired, pass: gb.pass, warnings: gb.warnings },
      G_not_lose_clone: { score: gc.result.score_x, ci95: gc.result.ci95_x, W: gc.result.W, D: gc.result.D, L: gc.result.L, paired: gc.paired, pass: gc.pass, warnings: gc.warnings },
      selfplay: S.stages[K('selfplay')], at: new Date().toISOString() };
    verdict.accepted = !!(pm.pass && gb.pass && gc.pass);
    fs.writeFileSync(path.join(modelDir, 'gates.json'), JSON.stringify(verdict, null, 1));
    S.history.push(verdict);
    if (verdict.accepted) { S.previous = S.champion; S.champion = rel(candFile); }
    save(S);
    console.log(`[${new Date().toISOString()}] generation ${cand}: ${verdict.accepted ? 'ACCEPTED' : 'REJECTED'}  pory2 ${pm.pass} beats ${gb.pass} (${gb.result.score_x}) notlose ${gc.pass} (${gc.result.score_x})`);
  }
  console.log('loop finished: champion ' + S.champion);
}

try { main(); process.exit(0); } catch (e) { console.error(e.stack || e); process.exit(1); }
