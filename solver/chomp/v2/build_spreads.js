/* solver/chomp/v2/build_spreads.js — the set spread of every sheet row CHOMP v2's rows and tables can meet.
 *
 *   ONE PROCESS (slow: ~hours on a loaded machine):
 *   node solver/chomp/v2/build_spreads.js --release eaa5becc54eb --team-store <main>/data/team-pool-frozen-regmc [--agree 20]
 *   -> solver/out/chomp/v2/spreads.json
 *
 *   SHARDED (the same derivation, split by DEFENDING body so each worker's cache is its own):
 *   ... --plan                      -> solver/out/chomp/v2/spreads-plan.json (every set) + solver/chomp/v2/model/population.json
 *   ... --worker K --workers N      -> solver/out/chomp/v2/spreads-part-K.json   (reads only the plan and the population)
 *   ... --merge N [--agree 20]      -> solver/out/chomp/v2/spreads-sharded.json
 *
 * Output: { provenance, spreads: { setKey: { evs, source, role, speed_sp } } }. solver/chomp/v2/model/population.json is the
 * top-meta population the rule ran against (tracked, small), so a set CHOMP has never met can be derived at play time.
 *
 * Sets: every row of every sheet in the frozen pool's pairs (all splits), the p2v1-c0 corpus and the human dataset.
 * The rule and its oracles: solver/chomp/v2/spreads.js. --agree N: N TEST-pair sets (a stride) are also derived with the
 * Showdown-oracle Deriver (solver/rotom/spreads.js, ~34 s a set) and the agreement is recorded.
 * --lean (default in the sharded modes): the MEDICHAM oracles run under the engine's lean binding (the same answers from a
 * lookup table; the two builds are compared when both exist).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = k => argv.includes(k);
require('../../arena/env.js');
const ROOT = path.join(__dirname, '..', '..', '..');
const ENGINE = require('../../arena/engine.js').load(flag('--release'));
const SPR = require('../../rotom/spreads.js');
const S2 = require('./spreads.js');
/* THE SPREAD RULE IS PINNED (abra/regmc 1.73.0). CHOMP v2's table is the DERIVED rule (solver/rotom/spreads.js RULE_TEXT)
 * and nothing else: the observed hooks (the Smogon moveset chain, folded in at 1.72.0, and the tournament hook) are OFF
 * here, so a rebuild cannot silently move the table when a month of Smogon stats or a tournament paste lands. A table
 * built on observed spreads is a NEW CHOMP v2 version, chosen on purpose. Every Deriver this builder makes takes HOOKS. */
const HOOKS = { observed: null, tournament: null };
const HOOKS_NOTE = 'pinned off (abra/regmc 1.73.0): the derived rule only; no Smogon chain, no tournament hook';

const OUT = path.join(ROOT, 'solver', 'out', 'chomp', 'v2');
fs.mkdirSync(OUT, { recursive: true });
const store = flag('--team-store');
const corpus = flag('--corpus', 'C:/Users/willj/Projects/Pokemon/ABRA/solver/out/selfplay/eaa5becc54eb/p2v1-c0');
const popFile = path.join(__dirname, 'model', 'population.json');
const planFile = path.join(OUT, 'spreads-plan.json');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const t0 = Date.now();

function collectSets(P) {
  const D = require('../data.js');
  const sets = new Map();
  const add = r => { if (r && r.species && r.nature) sets.set(SPR.setKey(r), r); };
  for (const s of ['train', 'val', 'test']) for (const G of P[s]) for (const sd of ['p1', 'p2']) for (const r of G.sheets[sd]) add(r);
  const man = JSON.parse(fs.readFileSync(path.join(corpus, 'manifest.json'), 'utf8'));
  for (const sh of man.shards) {
    const buf = fs.readFileSync(path.join(corpus, path.basename(sh.file)));
    let txt; try { txt = zlib.gunzipSync(buf).toString(); } catch (e) { txt = zlib.gunzipSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString(); }
    for (const l of txt.split('\n')) { if (!l) continue; let g; try { g = JSON.parse(l); } catch (e) { continue; } if (g.sheets) for (const sd of ['p1', 'p2']) for (const r of g.sheets[sd]) add(r); }
  }
  const H = D.headers(flag('--human', D.DEFAULT_FILE));
  for (const G of H.games) for (const sd of ['p1', 'p2']) for (const r of G.sheets[sd]) add(r);
  return { sets, human: { file: H.file, sha256: H.pool_sha256 } };
}
function savedPopulation() {
  const P = JSON.parse(fs.readFileSync(popFile, 'utf8'));
  return { P, pop: { teams: P.teams, slots: P.slots.map(s => ({ row: s.row, w: s.w, key: SPR.setKey(s.row) })) } };
}
function testPick(P, n) {
  const test = new Map(); for (const G of P.test) for (const sd of ['p1', 'p2']) for (const r of G.sheets[sd]) test.set(SPR.setKey(r), r);
  const rows = [...test.values()], pick = [];
  for (let i = 0; i < rows.length && pick.length < n; i += Math.max(1, Math.floor(rows.length / n))) pick.push(rows[i]);
  return pick;
}
const lean = fn => (has('--no-lean') || typeof ENGINE.API.M.leanRun !== 'function') ? fn() : ENGINE.API.M.leanRun(fn);

if (has('--plan')) {
  if (!store) throw new Error('build_spreads --plan: --team-store is required');
  const P0 = S2.populationOf(path.join(store, 'games.bo3.jsonl'));
  fs.mkdirSync(path.dirname(popFile), { recursive: true });
  fs.writeFileSync(popFile, JSON.stringify({ what: 'the top-meta population solver/chomp/v2/spreads.js derived every set spread against (solver/chomp/v2/build_spreads.js)', store: path.join(store, 'games.bo3.jsonl').split(path.sep).join('/'), store_sha256: P0.store_sha256, floor: P0.floor, teams: P0.pop.teams, slots: P0.pop.slots.map(s => ({ row: s.row, w: s.w })) }) + '\n');
  const PAIRS = require('../../mew/pairs.js');
  const P = PAIRS.load({ teamStore: store });
  const { sets, human } = collectSets(P);
  const agree = testPick(P, +flag('--agree', 20));
  fs.writeFileSync(planFile, JSON.stringify({ store, corpus, human, population_sha256: sha(fs.readFileSync(popFile)), sets: [...sets.values()], agree }) + '\n');
  console.log('plan: population ' + P0.pop.teams + ' teams / ' + P0.pop.slots.length + ' slots, floor ' + P0.floor + '; ' + sets.size + ' sets (' + (Date.now() - t0) + ' ms)');
  process.exit(0);
}

if (flag('--worker') != null) {
  const K = +flag('--worker'), N = +flag('--workers');
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const { pop } = savedPopulation();
  const MD = lean(() => S2.make(ENGINE.API, pop, HOOKS));
  const mine = plan.sets.filter(r => (crypto.createHash('sha256').update(MD.defKey(r)).digest().readUInt32BE(0) % N) === K);
  console.log('worker ' + K + '/' + N + ': ' + mine.length + ' of ' + plan.sets.length + ' sets; speed benchmark ' + MD.eq.median_speed);
  const spreads = {};
  let k = 0;
  for (const r of mine) {
    const z = lean(() => MD.spreadFor(r));
    spreads[SPR.setKey(r)] = { evs: z.evs, source: z.source, role: z.role, speed_sp: z.evs.spe };
    if (++k % 500 === 0) console.log('  ' + k + ' / ' + mine.length + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  }
  fs.writeFileSync(path.join(OUT, 'spreads-part-' + K + '.json'), JSON.stringify({ K, N, lean: !has('--no-lean'), speed_benchmark: MD.eq.median_speed, counters: MD.counters, spreads, ms: Date.now() - t0 }) + '\n');
  console.log('worker ' + K + ' done: ' + k + ' sets, ' + JSON.stringify(MD.counters) + ' (' + (Date.now() - t0) + ' ms)');
  process.exit(0);
}

if (flag('--merge') != null) {
  const N = +flag('--merge');
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const spreads = {}, parts = [];
  for (let K = 0; K < N; K++) {
    const J = JSON.parse(fs.readFileSync(path.join(OUT, 'spreads-part-' + K + '.json'), 'utf8'));
    Object.assign(spreads, J.spreads); parts.push({ K, sets: Object.keys(J.spreads).length, counters: J.counters, speed_benchmark: J.speed_benchmark, lean: J.lean, ms: J.ms });
  }
  const n = Object.keys(spreads).length;
  if (n !== plan.sets.length) throw new Error('merge: ' + n + ' spreads for ' + plan.sets.length + ' sets');
  const roles = {}; for (const z of Object.values(spreads)) roles[z.role] = (roles[z.role] || 0) + 1;
  const { P, pop } = savedPopulation();
  let agreement = null;
  if (+flag('--agree', 0) > 0) {
    const MD = S2.make(ENGINE.API, pop, HOOKS), SD = new SPR.Deriver(pop, HOOKS);
    const pick = plan.agree.slice(0, +flag('--agree'));
    agreement = Object.assign({ showdown_speed_benchmark: SD.eq.median_speed, medicham_speed_benchmark: MD.eq.median_speed }, S2.agreement(SD, MD, pick));
    /* and the table itself against the Showdown oracle on the same sets */
    agreement.table_vs_showdown_identical = pick.filter(r => SPR.evStr(spreads[SPR.setKey(r)].evs) === SPR.evStr(SD.spreadFor(r).evs)).length;
    console.log('agreement: ' + JSON.stringify({ n: agreement.n, identical: agreement.identical, speed_identical: agreement.speed_identical, table_vs_showdown_identical: agreement.table_vs_showdown_identical }));
  }
  const provenance = { release: ENGINE.id, stamp: ENGINE.stamp, rule: SPR.RULE_TEXT, oracles: 'MEDICHAM (solver/chomp/v2/spreads.js MediDeriver)',
    observed: HOOKS_NOTE,
    store: P.store, store_sha256: P.store_sha256, floor: P.floor, population: { teams: P.teams, slots: P.slots.length },
    population_file: 'solver/chomp/v2/model/population.json', population_sha256: sha(fs.readFileSync(popFile)),
    human: plan.human, corpus: plan.corpus, sets: n, roles, parts, agreement };
  fs.writeFileSync(path.join(OUT, 'spreads-sharded.json'), JSON.stringify({ provenance, spreads }) + '\n');
  console.log('wrote spreads-sharded.json: ' + n + ' sets, roles ' + JSON.stringify(roles));
  process.exit(0);
}

/* ---- one process ---- */
if (!store) throw new Error('build_spreads: --team-store is required');
const P0 = S2.populationOf(path.join(store, 'games.bo3.jsonl'));
const MD = S2.make(ENGINE.API, P0.pop, HOOKS);
console.log('population: floor ' + P0.floor + ', ' + JSON.stringify(MD.provenance().population) + ', speed benchmark ' + MD.eq.median_speed + ' (' + (Date.now() - t0) + ' ms)');
const PAIRS = require('../../mew/pairs.js');
const P = PAIRS.load({ teamStore: store });
const { sets, human } = collectSets(P);
console.log('distinct sets: ' + sets.size);
const spreads = {}, roles = {};
let k = 0;
for (const [key, r] of sets) {
  const z = MD.spreadFor(r);
  spreads[key] = { evs: z.evs, source: z.source, role: z.role, speed_sp: z.evs.spe };
  roles[z.role] = (roles[z.role] || 0) + 1;
  if (++k % 1000 === 0) console.log('  ' + k + ' / ' + sets.size + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
}
let agreement = null;
if (+flag('--agree', 0) > 0) {
  const SD = new SPR.Deriver(P0.pop, HOOKS);
  agreement = Object.assign({ showdown_speed_benchmark: SD.eq.median_speed, medicham_speed_benchmark: MD.eq.median_speed }, S2.agreement(SD, MD, testPick(P, +flag('--agree'))));
  console.log('agreement: ' + JSON.stringify({ n: agreement.n, identical: agreement.identical, speed_identical: agreement.speed_identical }));
}
fs.writeFileSync(path.join(OUT, 'spreads.json'), JSON.stringify({ provenance: Object.assign({ release: ENGINE.id, stamp: ENGINE.stamp, store: P0.store, store_sha256: P0.store_sha256, floor: P0.floor, human, corpus, sets: sets.size, roles, agreement, ms: Date.now() - t0 }, MD.provenance()), spreads }) + '\n');
console.log('wrote ' + path.join(OUT, 'spreads.json') + ' ' + JSON.stringify({ sets: sets.size, roles, counters: MD.counters, ms: Date.now() - t0 }));
