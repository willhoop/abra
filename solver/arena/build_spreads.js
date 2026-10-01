/* solver/arena/build_spreads.js — build the arena's `role-v1` spread table: the Stat Point spread of every sheet row an
 * arena game can field, by solver/rotom/spreads.js's rule, against the SAME top-meta population ROTOM's ladder
 * rotations were spread against. (2026-09-30, abra/regmc 1.49.0; docs/_reports/2026-09-30-arena-real-spreads.md.)
 *
 *   tools\lownode.cmd solver\arena\build_spreads.js --plan --release eaa5becc54eb
 *        --store solver/out/rotom/store-fe78202a.jsonl.gz --team-store <main>/data/team-pool-frozen-regmc [--human <games.jsonl>]
 *   tools\lownode.cmd solver\arena\build_spreads.js --worker K --workers N --release eaa5becc54eb     (N processes)
 *   tools\lownode.cmd solver\arena\build_spreads.js --merge N --release eaa5becc54eb
 *
 * OUTPUT (tracked; both small):
 *   solver/arena/spreads/population-role-v1.json   the population the rule ran against (store sha256, floor, slots)
 *   solver/arena/spreads/role-v1.json              { provenance, spreads: { setKey: "hp/atk/def/spa/spd/spe role" } }
 * Scratch (gitignored): solver/out/arena/spreads/{plan.json, part-K.json}.
 *
 * THE RULE IS NOT RE-WRITTEN HERE. Every spread is solver/rotom/spreads.js's Deriver rule; its two table oracles (speed
 * over SP 0..32, damage over the defending stat's SP 0..32) are read from MEDICHAM on the named frozen release through
 * solver/chomp/v2/spreads.js's MediDeriver (0.25-0.4 s a set against the Showdown oracle's ~34 s), exactly as CHOMP v2's
 * table was built. The OBSERVED hook is pinned OFF for this version (`observed: null`): role-v1 is the derived rule. When
 * Smogon's Reg M-C moveset files land (about 2026-10-04) the observed table is a NEW version, never a silent change.
 *
 * THE POPULATION is the ladder's: the store the rotations' spread_source names (store-fe78202a, restorable with
 * `git show 27825c32:data/games.gen9championsvgc2026regmcbo3.jsonl.gz`), its top-meta sides through
 * build_top_rotation.topSides and rowOf — the function the ladder used. --merge checks the table against every
 * rotation's RECORDED spreads (the Showdown oracle's answers) and writes the agreement into the provenance.
 *
 * THE SETS: every sheet row of every pair in the frozen team store (train, val and test: self-play, gates and SPRTs),
 * every sheet row of every eligible human-dataset game (solver/arena/arena.js's pool) and every rotation set.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
try { os.setPriority(0, os.constants.priority[process.env.ARENA_SPREADS_IDLE ? 'PRIORITY_LOW' : 'PRIORITY_BELOW_NORMAL']); } catch (e) { /* lownode set it */ }
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = k => argv.includes(k);
require('./env.js');
const ROOT = path.join(__dirname, '..', '..');
const REL_ID = flag('--release', null);
if (!REL_ID) { console.error('build_spreads: --release is required'); process.exit(2); }
const ENGINE = require('./engine.js').load(REL_ID);
const SPR = require('../rotom/spreads.js');
const S2 = require('../chomp/v2/spreads.js');
const SS = require('./spread_source.js');

const OUT = path.join(ROOT, 'solver', 'out', 'arena', 'spreads');
fs.mkdirSync(OUT, { recursive: true });
const planFile = path.join(OUT, 'plan.json');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const rel = f => path.relative(ROOT, path.resolve(f)).split(path.sep).join('/');
const t0 = Date.now();
const lean = fn => (has('--no-lean') || typeof ENGINE.API.M.leanRun !== 'function') ? fn() : ENGINE.API.M.leanRun(fn);

function rotationFiles() {
  const dir = path.join(ROOT, 'solver', 'rotom', 'teams');
  return fs.readdirSync(dir).filter(f => /^ladder-rotation.*\.json$/.test(f)).map(f => path.join(dir, f))
    .filter(f => { const J = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(J.teams) && J.teams.every(t => Array.isArray(t.spreads)); });
}
function rotationSets() {
  const out = [];
  for (const f of rotationFiles()) {
    const J = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const t of J.teams) for (const z of t.spreads) out.push({ file: rel(f), store_sha256: J.spread_source && J.spread_source.store_sha256, row: { species: z.species, item: z.item, ability: z.ability, nature: z.nature, moves: z.moves.slice() }, evs: z.evs });
  }
  return out;
}

if (has('--plan')) {
  const store = flag('--store'), teamStore = flag('--team-store');
  if (!store || !teamStore) throw new Error('build_spreads --plan: --store and --team-store are required');
  const B = require('../rotom/build_top_rotation.js');
  const buf = fs.readFileSync(store);
  const games = B.readStore(store);
  const TS = B.topSides(games);
  const pop = SPR.population(TS.top, B.rowOf);
  const P0 = { what: 'the top-meta population solver/arena/build_spreads.js derived the role-v1 table against: build_top_rotation.topSides + rowOf over the store ROTOM\'s rotations were spread from',
    store: rel(store), store_sha256: sha(buf), restore: 'git show 27825c32:data/games.gen9championsvgc2026regmcbo3.jsonl.gz', floor: TS.FLOOR, teams: pop.teams,
    slots: pop.slots.map(s => ({ row: s.row, w: s.w })) };
  fs.mkdirSync(path.dirname(SS.POP_FILE), { recursive: true });
  fs.writeFileSync(SS.POP_FILE, JSON.stringify(P0) + '\n');
  const sets = new Map(); const src = { team_store: 0, human: 0, rotation: 0, no_nature: 0 };
  const add = (r, k) => { if (!r || !r.species) return; if (!r.nature) { src.no_nature++; return; } const key = SPR.setKey(r); if (!sets.has(key)) { sets.set(key, { species: r.species, item: r.item || '', ability: r.ability || '', nature: r.nature, moves: (r.moves || []).slice() }); src[k]++; } };
  for (const z of rotationSets()) add(z.row, 'rotation');
  const PAIRS = require('../mew/pairs.js');
  const P = PAIRS.load({ teamStore });
  for (const s of ['train', 'val', 'test']) for (const G of P[s]) for (const sd of ['p1', 'p2']) for (const r of G.sheets[sd]) add(r, 'team_store');
  const T = require('./teams.js');
  const H = T.loadGames({ file: flag('--human', undefined), n: 1e9 });
  if (H.refused) console.log('human dataset: ' + H.refused + ' (its sets are derived at play time if an arena run reads it)');
  else for (const G of H.games) for (const sd of ['p1', 'p2']) for (const r of G.sheets[sd]) add(r, 'human');
  fs.writeFileSync(planFile, JSON.stringify({ release: REL_ID, store: rel(store), team_store: { dir: teamStore, file_sha256: P.file_sha256, pool_digest: P.pool_digest },
    human: H.refused ? null : { file: H.file, eligible: H.eligible }, population_sha256: sha(fs.readFileSync(SS.POP_FILE)), new_by_source: src, sets: [...sets.values()] }) + '\n');
  console.log('plan: population floor ' + TS.FLOOR + ', ' + pop.teams + ' teams / ' + pop.slots.length + ' slots; ' + sets.size + ' sets ' + JSON.stringify(src) + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  process.exit(0);
}

if (flag('--worker') != null) {
  const K = +flag('--worker'), N = +flag('--workers');
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  if (plan.release !== REL_ID) throw new Error('the plan was written for release ' + plan.release);
  const pop = SS.population();
  const MD = lean(() => S2.make(ENGINE.API, pop, { observed: null }));
  const mine = plan.sets.filter(r => (crypto.createHash('sha256').update(MD.defKey(r)).digest().readUInt32BE(0) % N) === K);
  console.log('worker ' + K + '/' + N + ': ' + mine.length + ' of ' + plan.sets.length + ' sets; speed median ' + MD.eq.median_speed + ', top tier ' + MD.eq.top_speed);
  const spreads = {}; let k = 0, failed = 0;
  for (const r of mine) {
    let z = null; try { z = lean(() => MD.spreadFor(r)); } catch (e) { failed++; }
    if (z) spreads[SPR.setKey(r)] = SS.encode(z.evs, z.role);
    if (MD._hits.size > 64) MD._hits.clear();   // memory: a defending body's damage tables are only reused by the same body
    if (++k % 500 === 0) console.log('  ' + k + ' / ' + mine.length + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  }
  fs.writeFileSync(path.join(OUT, 'part-' + K + '.json'), JSON.stringify({ K, N, lean: !has('--no-lean'), eq: MD.eq, counters: MD.counters, failed, spreads, ms: Date.now() - t0 }) + '\n');
  console.log('worker ' + K + ' done: ' + k + ' sets, ' + failed + ' failed, ' + JSON.stringify(MD.counters) + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  process.exit(0);
}

if (flag('--merge') != null) {
  const N = +flag('--merge');
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const spreads = {}, parts = [];
  for (let K = 0; K < N; K++) {
    const J = JSON.parse(fs.readFileSync(path.join(OUT, 'part-' + K + '.json'), 'utf8'));
    Object.assign(spreads, J.spreads); parts.push({ K, sets: Object.keys(J.spreads).length, failed: J.failed, counters: J.counters, lean: J.lean, ms: J.ms });
  }
  const failed = parts.reduce((a, p) => a + p.failed, 0);
  const n = Object.keys(spreads).length;
  if (n + failed !== plan.sets.length) throw new Error('merge: ' + n + ' spreads + ' + failed + ' failed for ' + plan.sets.length + ' sets');
  const roles = {}; for (const v of Object.values(spreads)) { const r = SS.decode(v).role; roles[r] = (roles[r] || 0) + 1; }
  /* the table against the ladder: every rotation set's RECORDED spread (the Showdown-oracle Deriver on the same store) */
  const popSha = sha(fs.readFileSync(SS.POP_FILE));
  const P = SS.population();
  const rot = rotationSets().map(z => ({ file: z.file, set: SPR.setKey(z.row), same_store: z.store_sha256 === P.store_sha256, recorded: SPR.evStr(z.evs), table: spreads[SPR.setKey(z.row)] ? SPR.evStr(SS.decode(spreads[SPR.setKey(z.row)]).evs) : null }));
  const agreement = { rule: 'the table vs every ladder rotation set\'s recorded spread (solver/rotom/spreads.js Deriver, Showdown oracle, same store)',
    sets: rot.length, same_store: rot.filter(x => x.same_store).length, identical: rot.filter(x => x.table === x.recorded).length,
    speed_identical: rot.filter(x => x.table && x.table.split('/')[5] === x.recorded.split('/')[5]).length, diffs: rot.filter(x => x.table !== x.recorded) };
  console.log('agreement with the ladder rotations: ' + agreement.identical + ' of ' + agreement.sets + ' identical, Speed ' + agreement.speed_identical + ' of ' + agreement.sets);
  /* A SET THE LADDER PLAYS TAKES THE LADDER'S RECORDED SPREAD. The recorded one is the rule's answer on the Showdown
   * oracle over the same store; the MEDICHAM oracle is the cost stand-in, and where the two disagree (measured
   * 2026-09-30: one set, a Stance Change attacker the MEDICHAM oracle stages in its Shield forme) the ladder's answer is
   * the one the arena must field, or the parity the arena exists for is broken by construction. Every override is named. */
  const overrides = [];
  for (const z of rotationSets()) {
    if (z.store_sha256 !== P.store_sha256) continue;
    const k = SPR.setKey(z.row), want = SS.encode(z.evs, SPR.role(z.row).role);
    if (spreads[k] !== want) { if (!overrides.some(o => o.set === k)) overrides.push({ set: k, medicham_oracle: spreads[k], recorded: want, from: z.file }); spreads[k] = want; }
  }
  agreement.overrides = overrides;
  console.log('overrides (the ladder recorded spread replaces the table entry): ' + overrides.length);
  const provenance = { version: 'role-v1', release: REL_ID, stamp: ENGINE.stamp, rule: SPR.RULE_TEXT, rule_sha256: sha(SPR.RULE_TEXT),
    oracles: 'MEDICHAM on the release above (solver/chomp/v2/spreads.js MediDeriver, lean binding); the rule is solver/rotom/spreads.js Deriver',
    observed: 'pinned off for role-v1 (Deriver opts.observed = null); an observed table is a new version',
    population_file: rel(SS.POP_FILE), population_sha256: popSha, store: P.store, store_sha256: P.store_sha256, floor: P.floor, population: { teams: P.teams, slots: P.slots.length },
    team_store: plan.team_store, human: plan.human, new_by_source: plan.new_by_source, sets: n, failed, roles, parts, agreement,
    encoding: 'spreads[setKey] = "hp/atk/def/spa/spd/spe role"; setKey = solver/rotom/spreads.js setKey', built: new Date().toISOString() };
  fs.writeFileSync(SS.TABLE_FILE, JSON.stringify({ provenance, spreads }) + '\n');
  console.log('wrote ' + rel(SS.TABLE_FILE) + ': ' + n + ' sets, ' + failed + ' failed, roles ' + JSON.stringify(roles));
  process.exit(0);
}
console.error('build_spreads: --plan | --worker K --workers N | --merge N'); process.exit(2);
