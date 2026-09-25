/* solver/tests/test-machamp.js — MEW (self-play) and MACHAMP (the training loop) prove what they recorded, rebuilt
 * and compared.
 *
 *   node solver/tests/test-machamp.js [--no-red] [--release <id>]        exit 0 GREEN, 1 RED, 3 BLIND
 *
 * Plays two tiny self-play games and one tiny match on the frozen release (env ARENA_TEST_RELEASE or
 * eaa5becc54eb), into a temporary directory, then:
 *
 *   RECORD   every game is stamped with the release; every searched decision's row mix sums to 1, its value is the
 *            matrix game's value (x·A·y = v), at least 90% of its rows have a DODUO cell, the history holds one
 *            public state per turn played, and the result is 0, 1/2 or 1.
 *   REBUILD  build_doduo.js rebuilds EVERY recorded decision's candidates identically (0 key and 0 slot
 *            mismatches, > 0 kept) — the DODUO target is attached to the candidates the search actually scored.
 *   TARGETS  build_pory2.js writes one position per recorded turn, z = the game's result for p1, and v = the mean
 *            of the turn's roots in p1's frame (side B's value flipped), recomputed here from the records.
 *   LEAF     a MILTANK agent's PORYGON2 leaf is the model file its spec names: two different model files give two
 *            different values on the same position, and the leaf counter moves.
 *   GATE     a 1-pair match through gate.js: 2 games, the pair played once from each seat on one battle seed,
 *            stamped with the release, the rule applied; plus the Wilson/rule arithmetic on known values.
 *   DEEP     deep_value.js replays both games exactly (0 mismatches) and writes one deep value per recorded position.
 *   SPRT     s(+20 Elo), a strong and a weak synthetic player each reach their bound, an unfinished pair blocks the
 *            test at its index, an errored pair is excluded.
 *   PARITY   for every trained generation on disk (solver/machamp/models/gen*): the Node forward passes reproduce
 *            the Python float64 logits of the EXPORTED files on the trainer's fixture — PORYGON2 to 1e-9 and
 *            MAG+DODUO to 1e-9 — and each fixture names the file's own digest. With no generation trained this
 *            clause is BLIND (exit 3), never GREEN.
 *
 * RED, unless --no-red — each must turn this test red:
 *   MACHAMP_BREAK=row      build_doduo rebuilds the row one turn late            -> REBUILD
 *   MACHAMP_BREAK=vside    build_pory2 forgets to flip side B's value            -> TARGETS
 *   MACHAMP_BREAK=seat     a match seats X on side A twice                       -> GATE
 *   MACHAMP_BREAK=replay   the deep-value replay uses the wrong battle seed      -> DEEP
 *   MACHAMP_BREAK=sprtsign the SPRT's log-likelihood ratio has its sign flipped  -> SPRT
 *   MILTANK_BREAK=leaf     the heuristic is served when PORYGON2 is asked for    -> LEAF
 *   PORY2_INFER_BREAK=pool the PORYGON2 forward pass drops its max pool          -> PARITY (only when a generation exists)
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const zlib = require('zlib');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
require('../arena/env.js');
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red');
const ONLY = (argv[argv.indexOf('--only') + 1] || '').split(',').filter(Boolean);
const REL = process.env.ARENA_TEST_RELEASE || (argv.includes('--release') ? argv[argv.indexOf('--release') + 1] : 'eaa5becc54eb');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

let fails = 0, checks = 0, blind = false;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log('  FAIL [' + clause + '] ' + msg); } };
const want = c => !ONLY.length || ONLY.includes(c);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'machamp-test-'));
const nodeRun = (script, args, env) => cp.spawnSync(process.execPath, ['--max-old-space-size=1536', script, ...args], { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, env || {}), maxBuffer: 1 << 26 });

const SPEC = { name: 'test-gen', kind: 'miltank', mag: 'solver/mag/model/mag-v1.json', doduo: 'solver/mag/model/doduo-v1.json',
  pory2: 'solver/porygon2/model/porygon2-v0.json', budgetMs: 150, k1: 4, k2: 4, depth: 0, reserveSwitch: 1 };
const CLONE = { name: 'test-clone', kind: 'greedy', mag: 'solver/mag/model/mag-v1.json', doduo: 'solver/mag/model/doduo-v1.json' };

/* ---------------- self-play games (shared by RECORD, REBUILD, TARGETS) ---------------- */
function selfplay(dir, env) {
  const league = path.join(TMP, 'league.json');
  fs.writeFileSync(league, JSON.stringify({ current: SPEC, clone: CLONE, weights: { current: 1, previous: 0, clone: 0 } }));
  fs.mkdirSync(dir, { recursive: true });
  const r = nodeRun(path.join(ROOT, 'solver', 'mew', 'play.js'), ['--mode', 'selfplay', '--release', REL, '--league', league, '--games', '2', '--seed', '3',
    '--cap', '12', '--out', path.join(dir, 'shard-0.jsonl.gz')], env);
  if (r.status !== 0) { console.log(r.stdout, r.stderr); return null; }
  return zlib.gunzipSync(fs.readFileSync(path.join(dir, 'shard-0.jsonl.gz'))).toString('utf8').trim().split('\n').map(JSON.parse);
}

function checkRecord(recs) {
  ok('RECORD', recs && recs.length === 2, 'two self-play games recorded');
  if (!recs) return;
  let nDec = 0, rows = 0, mapped = 0, worstV = 0;
  for (const g of recs) {
    ok('RECORD', g.release === REL, `game ${g.g} stamped with the release (${g.release})`);
    ok('RECORD', [0, 0.5, 1].includes(g.vA), `game ${g.g} result is 0, 1/2 or 1 (${g.vA})`);
    ok('RECORD', g.hist.length === g.turns && g.hist.every((h, i) => h.n === i + 1 && h.state && h.actions), `game ${g.g} history has one public state per turn (${g.hist.length} vs ${g.turns})`);
    for (const d of g.decisions) {
      nDec++;
      const sx = d.x.reduce((a, b) => a + b, 0);
      ok('RECORD', d.x.length === d.m && Math.abs(sx - 1) < 1e-3, `decision ${g.g}/${d.t}/${d.side}: row mix of ${d.m} sums to 1 (${sx})`);
      let v = 0; for (let i = 0; i < d.m; i++) for (let j = 0; j < d.nc; j++) v += d.x[i] * d.A[i][j] * d.y[j];
      worstV = Math.max(worstV, Math.abs(v - d.v));
      rows += d.m; if (d.cells) mapped += d.cells.filter(Boolean).length;
    }
  }
  ok('RECORD', nDec >= 4, `searched decisions recorded (${nDec})`);
  ok('RECORD', worstV < 5e-3, `the recorded value is the matrix game's value x·A·y (worst |diff| ${worstV.toExponential(2)})`);
  ok('RECORD', rows > 0 && mapped / rows >= 0.9, `at least 90% of rows carry a DODUO cell (${mapped}/${rows})`);
  console.log(`  RECORD: ${recs.length} games, ${nDec} decisions, ${mapped}/${rows} rows mapped, worst |x·A·y − v| ${worstV.toExponential(2)}`);
}

function rebuild(dir, env) {
  const out = path.join(TMP, 'doduo-' + (env ? 'red' : 'ok'));
  const r = nodeRun(path.join(ROOT, 'solver', 'machamp', 'build_doduo.js'), ['--selfplay', dir, '--out', out, '--max-unfilled', '1.01', '--min-mass', '0'], env);
  if (r.status !== 0) { console.log(r.stderr); return null; }
  return JSON.parse(fs.readFileSync(path.join(out, 'meta.json'), 'utf8')).counts;
}
function checkRebuild(c, nDec) {
  ok('REBUILD', !!c, 'build_doduo ran');
  if (!c) return;
  ok('REBUILD', c.key_mismatch === 0 && c.slot_mismatch === 0, `every decision rebuilt identically (key mismatches ${c.key_mismatch}, slot mismatches ${c.slot_mismatch})`);
  ok('REBUILD', c.kept > 0 && c.kept + c.no_cells + c.low_mass === nDec, `kept ${c.kept} of ${nDec} (no cells ${c.no_cells}, low mass ${c.low_mass})`);
}

function targets(dir, env) {
  const out = path.join(TMP, 'pory2-' + (env ? 'red' : 'ok'));
  const r = nodeRun(path.join(ROOT, 'solver', 'machamp', 'build_pory2.js'), ['--release', REL, '--selfplay', dir, '--out', out, '--max-unfilled', '1.01', '--val-pct', '0'], env);
  if (r.status !== 0) { console.log(r.stderr); return null; }
  const meta = JSON.parse(fs.readFileSync(path.join(out, 'meta.json'), 'utf8'));
  const rd = f => { const b = fs.readFileSync(path.join(out, f)); return Array.from(new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))); };
  return { meta, z: rd('z.f32'), v: rd('v.f32') };
}
function checkTargets(T, recs) {
  ok('TARGETS', !!T, 'build_pory2 ran');
  if (!T || !recs) return;
  const n = recs.reduce((a, g) => a + g.hist.length, 0);
  ok('TARGETS', T.meta.N === n, `one position per recorded turn (${T.meta.N} vs ${n})`);
  ok('TARGETS', T.meta.engine_release === REL, 'encoded on the release the games were played on');
  let k = 0, worst = 0, nv = 0;
  for (const g of recs) for (let t = 0; t < g.hist.length; t++, k++) {
    ok('TARGETS', Math.abs(T.z[k] - g.vA) < 1e-6, `z of game ${g.g} turn ${t + 1} is p1's result`);
    const vs = g.decisions.filter(d => d.t === t).map(d => (d.side === 'A' ? d.v : 1 - d.v));
    if (!vs.length) { ok('TARGETS', Number.isNaN(T.v[k]), `no root at game ${g.g} turn ${t + 1} -> v is NaN`); continue; }
    const want = vs.reduce((a, b) => a + b, 0) / vs.length;
    worst = Math.max(worst, Math.abs(T.v[k] - want)); nv++;
  }
  ok('TARGETS', nv > 0 && worst < 1e-5, `v is the turn's roots in p1's frame (${nv} positions, worst |diff| ${worst.toExponential(2)})`);
}

/* ---------------- LEAF ---------------- */
function leafProbe(env) {
  const script = path.join(TMP, 'leaf.js');
  fs.writeFileSync(script, `'use strict';
process.chdir(${JSON.stringify(ROOT)});
require(${JSON.stringify(path.join(ROOT, 'solver', 'arena', 'env.js'))});
const E = require(${JSON.stringify(path.join(ROOT, 'solver', 'arena', 'engine.js'))}).load(${JSON.stringify(REL)});
const API = E.API, T = require(${JSON.stringify(path.join(ROOT, 'solver', 'arena', 'teams.js'))});
const P = require(${JSON.stringify(path.join(ROOT, 'solver', 'mew', 'pairs.js'))}).load({});
const AG = require(${JSON.stringify(path.join(ROOT, 'solver', 'mew', 'agent.js'))}).create(API, { buildBody: T.buildBody });
const G = P.train[5];
const S = API.newBattle(T.buildTeam(API.M, G, 'p1').team, T.buildTeam(API.M, G, 'p2').team, { rng: API.makeRng(9) });
const lctx = m => ({ mode: 'pory2', sheets: G.sheets, model: m });
const W = AG.R.prepare(AG.R.sampleWorld(S, 'B', { sheet: G.sheets.p2, revealed: new Set([0, 1]) }, API.M.rngStreams({ seed: 4 }).any));
const la = API.legalActions(S, 'A').joint[0], lb = API.legalActions(S, 'B').joint[0];
const a = AG.R.playout(W, la, lb, 77, 0, lctx(${JSON.stringify(path.join(ROOT, 'solver', 'porygon2', 'model', 'porygon2-v0.json'))}));
const b = AG.R.playout(W, la, lb, 77, 0, lctx(${JSON.stringify(path.join(ROOT, 'solver', 'porygon2', 'model', 'porygon2-v0-emb.json'))}));
const c = AG.R.playout(W, la, lb, 77, 0, lctx(${JSON.stringify(path.join(ROOT, 'solver', 'porygon2', 'model', 'porygon2-v0.json'))}));
console.log(JSON.stringify({ a, b, c, leaf: AG.R.COUNTERS.leafPory2, heur: AG.R.COUNTERS.leafHeuristic, wipes: AG.R.COUNTERS.wipes }));
`);
  const r = nodeRun(script, [], env);
  if (r.status !== 0) { console.log(r.stderr); return null; }
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
function checkLeaf(L) {
  ok('LEAF', !!L, 'the leaf probe ran');
  if (!L) return;
  ok('LEAF', L.leaf === 3 && L.heur === 0, `three PORYGON2 leaves served, no heuristic (pory2 ${L.leaf}, heuristic ${L.heur}, wipes ${L.wipes})`);
  ok('LEAF', L.a === L.c && L.a !== L.b, `the named model file is the one evaluated (v0 ${L.a}, emb ${L.b}, v0 again ${L.c})`);
}

/* ---------------- GATE ---------------- */
function gate(env) {
  const out = path.join(TMP, 'gate-' + (env ? 'red' : 'ok') + '.json');
  const x = path.join(TMP, 'x.json'), y = path.join(TMP, 'y.json');
  fs.writeFileSync(x, JSON.stringify(CLONE)); fs.writeFileSync(y, JSON.stringify(Object.assign({}, CLONE, { name: 'test-clone-y' })));
  const r = nodeRun(path.join(ROOT, 'solver', 'machamp', 'gate.js'), ['--release', REL, '--x', x, '--y', y, '--pairs', '1', '--seed', '5', '--workers', '1', '--cap', '15', '--rule', 'notlose', '--out', out], env);
  if (r.status !== 0) { console.log(r.stdout, r.stderr); return null; }
  const res = JSON.parse(fs.readFileSync(out, 'utf8'));
  const per = JSON.parse(fs.readFileSync(path.join(out.replace(/\.json$/, '') + '.shards', 'shard-0.jsonl.summary.json'), 'utf8')).per;
  return { res, per };
}
function checkGate(G) {
  const GJ = require('../machamp/gate.js');
  const w = GJ.wilson(120, 200);
  ok('GATE', Math.abs(w[0] - 0.5307) < 1e-3 && Math.abs(w[1] - 0.6649) < 1e-3, `Wilson(120/200) = [${w.map(v => v.toFixed(4))}]`);
  ok('GATE', GJ.RULES.beats([0.51, 0.6]) && !GJ.RULES.beats([0.49, 0.6]) && GJ.RULES.notlose([0.4, 0.5]) && !GJ.RULES.notlose([0.3, 0.49]), 'the two rules read the right bound');
  const m = GJ.merge([{ pi: 0, vX: 1 }, { pi: 0, vX: 1 }, { pi: 1, vX: 1 }, { pi: 1, vX: 0 }, { pi: 2, vX: 0.5 }, { pi: 2, vX: 0 }]);
  ok('GATE', m.res.W === 3 && m.res.L === 2 && m.res.D === 1 && m.pairs.both === 1 && m.pairs.split === 2 && m.pairs.lost === 0 && Math.abs(m.score - 3.5 / 6) < 1e-12, 'merge counts results and pairs');
  ok('GATE', !!G, 'a 1-pair match ran through gate.js');
  if (!G) return;
  ok('GATE', G.res.result.played === 2, `2 games scored (${G.res.result.played})`);
  ok('GATE', G.per.length === 2 && G.per[0].pi === G.per[1].pi && G.per[0].seed === G.per[1].seed, 'one pair, one battle seed, two games');
  ok('GATE', new Set(G.per.map(p => p.xSide)).size === 2, `X played the pair from both seats (${G.per.map(p => p.xSide).join(',')})`);
  ok('GATE', G.res.engine_release === REL && G.res.release_stamp && G.res.release_stamp.engine_release === REL, 'the artifact is stamped with the release');
  ok('GATE', G.res.rule.name === 'notlose' && G.res.pass === GJ.RULES.notlose(G.res.result.ci95_x), 'the named rule decides pass');
}

/* ---------------- PARITY ---------------- */
function parity(env) {
  const dirs = fs.existsSync(path.join(ROOT, 'solver', 'machamp', 'models')) ? fs.readdirSync(path.join(ROOT, 'solver', 'machamp', 'models')).filter(d => /^gen\d+$/.test(d)) : [];
  const script = path.join(TMP, 'parity.js');
  fs.writeFileSync(script, `'use strict';
process.chdir(${JSON.stringify(ROOT)});
require(${JSON.stringify(path.join(ROOT, 'solver', 'arena', 'env.js'))});
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const out = [];
for (const g of ${JSON.stringify(dirs)}) {
  const dir = path.join('solver', 'machamp', 'models', g);
  const pf = path.join(dir, 'porygon2-' + g + '.fixture.json');
  if (fs.existsSync(pf)) {
    const fx = JSON.parse(fs.readFileSync(pf, 'utf8'));
    const NET = require(${JSON.stringify(path.join(ROOT, 'solver', 'porygon2', 'infer.js'))}).load(path.resolve(fx.model.path));
    let worst = 0; fx.x.forEach((x, i) => { worst = Math.max(worst, Math.abs(NET.logit(x) - fx.python_logit[i])); });
    out.push({ g, kind: 'pory2', n: fx.x.length, worst, shaOk: sha(fx.model.path) === fx.model.sha256 });
  }
  const df = path.join(dir, 'doduo-' + g + '.fixture.json');
  if (fs.existsSync(df)) {
    const fx = JSON.parse(fs.readFileSync(df, 'utf8'));
    const mp = path.join(dir, 'mag-' + g + '.json'), dp = path.join(dir, 'doduo-' + g + '.json');
    const P = require(${JSON.stringify(path.join(ROOT, 'solver', 'mag', 'infer.js'))}).load(process.env.MACHAMP_TEST_PARITY_V1 ? {} : { mag: mp, doduo: dp });
    let worst = 0, n = 0;
    for (const e of fx.decisions) {
      const r = P.predict(fx.rows[String(e.game)], e.turn, e.side);
      e.joint.forEach((row, i) => row.forEach((x, j) => { if (x !== null) { n++; worst = Math.max(worst, Math.abs(r.logits[i][j] - x)); } }));
    }
    out.push({ g, kind: 'doduo', n, worst, shaOk: fx.mag_sha256 === sha(mp) && fx.doduo_sha256 === sha(dp) });
  }
}
console.log(JSON.stringify(out));
`);
  const r = nodeRun(script, [], env);
  if (r.status !== 0) { console.log(r.stderr); return null; }
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
function checkParity(P) {
  ok('PARITY', Array.isArray(P), 'the parity probe ran');
  if (!P) return;
  if (!P.length) { blind = true; console.log('  PARITY: BLIND — no trained generation with a fixture under solver/machamp/models/'); return; }
  for (const p of P) {
    ok('PARITY', p.shaOk, `${p.g} ${p.kind}: the fixture was written by THIS model file`);
    ok('PARITY', p.n > 0 && p.worst < 1e-9, `${p.g} ${p.kind}: Node = Python on ${p.n} logits (worst ${p.worst.toExponential(2)})`);
  }
  console.log('  PARITY: ' + P.map(p => `${p.g} ${p.kind} n=${p.n} worst=${p.worst.toExponential(2)}`).join('; '));
}

/* ---------------- DEEP (solver/machamp/deep_value.js) ---------------- */
function deep(dir, env) {
  const out = path.join(TMP, 'deep-' + (env ? 'red' : 'ok'));
  const r = nodeRun(path.join(ROOT, 'solver', 'machamp', 'deep_value.js'), ['--release', REL, '--selfplay', dir, '--out', out, '--workers', '1', '--rollouts', '1', '--depth', '1'], env);
  if (r.status !== 0) { console.log(r.stdout, r.stderr); return null; }
  return JSON.parse(fs.readFileSync(path.join(out, 'deep.summary.json'), 'utf8'));
}
function checkDeep(D, recs) {
  ok('DEEP', !!D, 'deep_value ran');
  if (!D || !recs) return;
  const n = recs.reduce((a, g) => a + g.hist.length, 0);
  ok('DEEP', D.counts.replay_mismatch === 0 && D.counts.no_joint === 0, `every game replays exactly (mismatch ${D.counts.replay_mismatch}, no joint ${D.counts.no_joint})`);
  ok('DEEP', D.counts.positions === n && D.counts.rollouts === n, `one deep value per recorded position (${D.counts.positions} of ${n})`);
  ok('DEEP', D.engine_release === REL, 'stamped with the release');
}

/* ---------------- SPRT (solver/machamp/sprt.js), in a child so the break env reaches it ---------------- */
function sprtProbe(env) {
  const script = path.join(TMP, 'sprt.js');
  fs.writeFileSync(script, `'use strict';
const S = require(${JSON.stringify(path.join(ROOT, 'solver', 'machamp', 'sprt.js'))});
const o = { elo0: 0, elo1: 20, alpha: 0.05, beta: 0.05 };
let r = 7; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
const seq = p => Array.from({ length: 1000 }, () => ((rnd() < p ? 1 : 0) + (rnd() < p ? 1 : 0)) / 2);
const strong = S.decide(seq(0.62), o), weak = S.decide(seq(0.42), o);
const gap = seq(0.62); gap[3] = undefined; const waits = S.decide(gap, o);
const err = seq(0.62); err[0] = null; const skip = S.decide(err, o);
console.log(JSON.stringify({ s20: S.sOf(20), strong, weak, waits, skip }));
`);
  const r = nodeRun(script, [], env);
  if (r.status !== 0) { console.log(r.stderr); return null; }
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
function checkSprt(X) {
  ok('SPRT', !!X, 'the SPRT probe ran');
  if (!X) return;
  ok('SPRT', Math.abs(X.s20 - 0.528751) < 1e-5, `s(+20 Elo) = ${X.s20}`);
  ok('SPRT', X.strong.verdict === 'H1' && X.strong.llr >= 2.944, `a 0.62 player is accepted as stronger (H1 after ${X.strong.pairs} pairs)`);
  ok('SPRT', X.weak.verdict === 'H0' && X.weak.llr <= -2.944, `a 0.42 player is rejected (H0 after ${X.weak.pairs} pairs)`);
  ok('SPRT', X.waits.stop === null && X.waits.prefix === 3, 'an unfinished pair blocks the test at its index (index order, never completion order)');
  ok('SPRT', X.skip.verdict === 'H1', 'an errored pair is excluded, not counted');
}

/* ---------------- run ---------------- */
const t0 = Date.now();
const spDir = path.join(TMP, 'sp');
let recs = null;
if (want('RECORD') || want('REBUILD') || want('TARGETS') || want('DEEP')) { recs = selfplay(spDir); checkRecord(recs); }
const nDec = recs ? recs.reduce((a, g) => a + g.decisions.length, 0) : 0;
if (want('REBUILD')) checkRebuild(rebuild(spDir), nDec);
if (want('TARGETS')) checkTargets(targets(spDir), recs);
if (want('DEEP')) checkDeep(deep(spDir), recs);
if (want('SPRT')) checkSprt(sprtProbe());
if (want('LEAF')) checkLeaf(leafProbe());
if (want('GATE')) checkGate(gate());
if (want('PARITY')) checkParity(parity());

const green = !fails;
console.log(`\ntest-machamp: ${checks - fails}/${checks} ${green ? (blind ? 'GREEN except PARITY BLIND' : 'GREEN') : 'RED'} [${[...failed].join(', ')}]  ${((Date.now() - t0) / 1000).toFixed(0)}s`);

/* the deliberate breaks: each must turn its clause red */
if (!NO_RED && green) {
  const reds = [];
  const redOf = (name, clause, fn) => {
    const before = fails; const f0 = new Set(failed);
    fn();
    const turned = fails > before && failed.has(clause) && !f0.has(clause);
    reds.push({ name, clause, red: turned });
    fails = before; failed.clear(); for (const c of f0) failed.add(c);
  };
  if (recs && want('REBUILD')) redOf('MACHAMP_BREAK=row', 'REBUILD', () => checkRebuild(rebuild(spDir, { MACHAMP_BREAK: 'row' }), nDec));
  if (recs && want('TARGETS')) redOf('MACHAMP_BREAK=vside', 'TARGETS', () => checkTargets(targets(spDir, { MACHAMP_BREAK: 'vside' }), recs));
  if (want('GATE')) redOf('MACHAMP_BREAK=seat', 'GATE', () => checkGate(gate({ MACHAMP_BREAK: 'seat' })));
  if (recs && want('DEEP')) redOf('MACHAMP_BREAK=replay', 'DEEP', () => checkDeep(deep(spDir, { MACHAMP_BREAK: 'replay' }), recs));
  if (want('SPRT')) redOf('MACHAMP_BREAK=sprtsign', 'SPRT', () => checkSprt(sprtProbe({ MACHAMP_BREAK: 'sprtsign' })));
  if (want('LEAF')) redOf('MILTANK_BREAK=leaf', 'LEAF', () => checkLeaf(leafProbe({ MILTANK_BREAK: 'leaf' })));
  if (want('PARITY') && !blind) {
    redOf('PORY2_INFER_BREAK=pool', 'PARITY', () => checkParity(parity({ PORY2_INFER_BREAK: 'pool' })));
    redOf('the DODUO parity read against v1 (MACHAMP_TEST_PARITY_V1)', 'PARITY', () => checkParity(parity({ MACHAMP_TEST_PARITY_V1: '1' })));
  }
  for (const r of reds) console.log(`  deliberate break ${r.name}: ${r.red ? 'RED as required' : 'STAYED GREEN — the clause cannot see it'}`);
  if (reds.some(r => !r.red)) { console.log('test-machamp: RED — a deliberate break was not seen'); process.exit(1); }
}
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
process.exit(!green ? 1 : blind ? 3 : 0);
