/* solver/tests/test-body-parity.js — every body the search plays is built the way the battle's own bodies are
 * (abra/regmc 1.69.0; docs/_reports/2026-10-01-rollout-body-spreads.md).
 *
 *   node solver/tests/test-body-parity.js [--no-red] [--only FRESH,OWN,PUBLIC,MEGA] [--release <id>]
 *        exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND (a deliberate break stayed green)
 *
 * Over EVERY set ROTOM plays (every solver/rotom/teams/ladder-rotation*.json team with recorded spreads):
 *   FRESH   the searcher's fresh body for a sheet row (solver/arena/teams.js bodyBuilder, view 'truth' — what
 *           solver/miltank/rollout.js `body` builds when a world redraws a hidden body) equals the TEAM body
 *           solver/arena/teams.js buildTeam fields for that row: all six stats, the nature, the Stat Points `_sp` (HP
 *           included), and the whole object key for key (the battle digest reads key order), under the default spread
 *           mode. Until 1.69.0 the fresh body was the table's flat line with no nature (test-miltank SWAP went red).
 *   OWN     our own side matches what ROTOM fields: solver/rotom/world.js reads each set's Stat Points out of the team
 *           we SEND (Showdown's packed format), equal to the rotation's recorded spread, and the line it lays is the
 *           checkout's own statModify at those points and the sheet's nature (solver/xatu/sd.js statValue — what the
 *           |request| reports), all six stats, with `_sp` carrying the HP points.
 *   PUBLIC  the opponent's fresh body under honest information (view 'public') is the zero-SP line under the sheet's
 *           nature, `_sp` all zero: no body the honest search builds carries the true spread.
 *   MEGA    every set holding its own mega stone with Stat Points in HP: mega evolving the team body on the frozen release
 *           RECOMPUTES the line from `_sp` (MEDSEEN.megaStatFromSpread moves; the 1.51.0 engine fix now reaches the
 *           arena) and lands on statValue at the mega forme for the five battle stats, HP unchanged.
 *
 * RED, unless --no-red: SPREAD_FRESH_BREAK=flat (the fresh body is the flat line again) must turn FRESH red;
 * SPREAD_SP_BREAK=1 (applySpread stamps no `_sp`) must turn MEGA red.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
require('../arena/env.js');
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red');
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const want = c => !ONLY || ONLY.includes(c);
const REL = argv.includes('--release') ? argv[argv.indexOf('--release') + 1] : 'df172ccd2aaf';
if (!fs.existsSync(path.join(ROOT, 'data', 'releases', REL))) { console.log('CANNOT ANSWER: release ' + REL + ' is not in data/releases'); process.exit(2); }

let fails = 0, checks = 0;
const failed = new Set();
const shown = {};
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); shown[clause] = (shown[clause] || 0) + 1; if (shown[clause] <= 6) console.log('  FAIL [' + clause + '] ' + msg); } };
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const KEY = { hp: 'hp', atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp' };

const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const SD = require('../xatu/sd.js');
const X = require('../human/dex.js');
const SS = require('../arena/spread_source.js');
const WB = require('../rotom/world.js').create(API);
const R = require('../miltank/rollout.js').create(API, { buildBody: T.bodyBuilder(M, { view: 'truth' }) });
const truth = T.bodyBuilder(M, { view: 'truth' }), pub = T.bodyBuilder(M, { view: 'public' });
const line = b => STATS.map(s => b.st[KEY[s]]).join('/');
const strip = b => { const o = Object.assign({}, b); delete o._sf; return JSON.stringify(o); };
const want6 = (species, nature, evs) => STATS.map(s => SD.statValue(species, nature, s, evs ? evs[s] : 0)).join('/');

const dir = path.join(ROOT, 'solver', 'rotom', 'teams');
const rots = fs.readdirSync(dir).filter(f => /^ladder-rotation.*\.json$/.test(f)).map(f => [f, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))])
  .filter(([, J]) => Array.isArray(J.teams) && J.teams.every(t => Array.isArray(t.spreads)));
if (!rots.length) { console.log('CANNOT ANSWER: no ladder rotation with recorded spreads'); process.exit(2); }
console.log('test-body-parity: release ' + REL + ', spread mode ' + T.defaultSpreads(M).mode + ', ' + rots.length + ' rotation files');
/* DEFAULT (1.73.0): with no ARENA_SPREADS override the searcher's bodies are built at observed-v1, the ladder's spreads.
 * SPREADS_SOURCE_BREAK=default (the default back at role-v1) must turn this red. */
if (want('DEFAULT') && !process.env.ARENA_SPREADS) ok('DEFAULT', T.defaultSpreads(M).mode === 'observed-v1', 'the default spread mode is observed-v1 (it is ' + T.defaultSpreads(M).mode + ')');

const sets = [];
for (const [f, J] of rots) for (const t of J.teams) {
  const rows = t.spreads.map(z => ({ species: z.species, item: z.item, ability: z.ability, nature: z.nature, moves: z.moves.slice() }));
  rows.forEach((row, s) => sets.push({ f, t, rows, row, s, z: t.spreads[s] }));
}

/* ---------------- FRESH ---------------- */
if (want('FRESH')) {
  let n = 0, same = 0, keyForKey = 0, viaRollout = 0, differed = 0;
  for (const x of sets) {
    const brought = x.s < 4 ? [0, 1, 2, 3] : [2, 3, 4, 5];
    const G = { id: 'parity', sheets: { p1: x.rows, p2: x.rows }, brought: { p1: brought, p2: brought } };
    const got = T.buildTeam(M, G, 'p1');
    if (!got) { ok('FRESH', false, x.f + ' ' + x.t.id + ': buildTeam could not build the team'); continue; }
    const tb = got.team[got.sheetOf.indexOf(x.s)];
    const fb = truth(M, x.row); fb._solverSheet = x.s;
    const rb = R.body(x.row, x.s);
    n++;
    const eq = line(fb) === line(tb) && fb._nature === tb._nature && JSON.stringify(fb._sp) === JSON.stringify(tb._sp);
    if (eq) same++; else ok('FRESH', false, `${x.f} ${x.t.id} ${x.row.species}: fresh ${line(fb)} ${fb._nature} ${JSON.stringify(fb._sp)} vs team ${line(tb)} ${tb._nature} ${JSON.stringify(tb._sp)}`);
    if (strip(fb) === strip(tb)) keyForKey++; else ok('FRESH', false, `${x.f} ${x.t.id} ${x.row.species}: the fresh body is not the team body key for key`);
    if (rb && strip(rb) === strip(tb)) viaRollout++; else ok('FRESH', false, `${x.f} ${x.t.id} ${x.row.species}: rollout.body is not the team body`);
    const flat = T.buildBody(M, x.row);
    if (flat && line(flat) !== line(tb)) differed++;
  }
  ok('FRESH', n > 0 && same === n && keyForKey === n && viaRollout === n, `fresh body = team body on every rotation set (${same}, ${keyForKey} key for key, ${viaRollout} via rollout.body, of ${n})`);
  ok('FRESH', differed > 0, 'the flat line equals the team line on every set: the clause could not see the old defect');
  console.log(`  FRESH: ${n} rotation sets, line+nature+_sp equal ${same}, key for key ${keyForKey}, rollout.body ${viaRollout}; the flat line differs from the team line on ${differed}`);
}

/* ---------------- OWN ---------------- */
if (want('OWN')) {
  let n = 0, read = 0, same = 0, hpSp = 0, hpInvested = 0;
  for (const x of sets) {
    n++;
    const ev = WB.ourSpreadOf(x.t.packed, x.row);
    const recorded = x.z.evs;
    if (ev && STATS.every(s => (ev[s] | 0) === (recorded[s] | 0))) read++;
    else { ok('OWN', false, `${x.f} ${x.t.id} ${x.row.species}: the packed team gives ${JSON.stringify(ev)}, recorded ${JSON.stringify(recorded)}`); continue; }
    const b = T.buildBody(M, x.row); WB.applySpread(b, ev, x.row);
    const w = want6(x.row.species, x.row.nature, null);
    const exp = STATS.map(s => SD.statValue(x.row.species, x.row.nature, s, ev[s] | 0)).join('/');
    if (line(b) === exp && b._nature === x.row.nature) same++; else ok('OWN', false, `${x.f} ${x.t.id} ${x.row.species}: world line ${line(b)} vs the request's ${exp} (zero-SP ${w})`);
    if (b._sp && b._sp.hp === (ev.hp | 0)) hpSp++; else ok('OWN', false, `${x.f} ${x.t.id} ${x.row.species}: _sp ${JSON.stringify(b._sp)} does not carry HP ${ev.hp}`);
    if ((ev.hp | 0) > 0) hpInvested++;
  }
  ok('OWN', n > 0 && read === n && same === n && hpSp === n, `our side = what ROTOM fields on every set (${read} read from the packed team, ${same} lines equal, ${hpSp} with HP in _sp, of ${n})`);
  ok('OWN', hpInvested > 0, 'no set invests HP: the HP half of _sp is unasked');
  console.log(`  OWN: ${n} sets, spread read from the packed team ${read}, line = statModify ${same}, _sp carries HP ${hpSp} (${hpInvested} invest HP)`);
}

/* ---------------- PUBLIC ---------------- */
if (want('PUBLIC')) {
  let n = 0, zero = 0, truthDiffers = 0;
  for (const x of sets) {
    const b = pub(M, x.row); if (!b) { ok('PUBLIC', false, x.row.species + ': no public body'); continue; }
    n++;
    const exp = want6(x.row.species, x.row.nature, null);
    if (line(b) === exp && b._nature === x.row.nature && b._sp && Object.values(b._sp).every(v => v === 0)) zero++;
    else ok('PUBLIC', false, `${x.f} ${x.t.id} ${x.row.species}: public ${line(b)} ${JSON.stringify(b._sp)} vs zero-SP ${exp}`);
    if (line(truth(M, x.row)) !== exp) truthDiffers++;
  }
  ok('PUBLIC', n > 0 && zero === n, `every public body is the zero-SP line under its nature (${zero} of ${n})`);
  ok('PUBLIC', truthDiffers > 0, 'the true line never differs from the public one: the clause asks nothing');
  console.log(`  PUBLIC: ${n} sets at zero SP under their nature ${zero}; the true line differs on ${truthDiffers}`);
}

/* ---------------- MEGA ---------------- */
if (want('MEGA')) {
  let n = 0, recomputed = 0, exact = 0;
  for (const x of sets) {
    const it = X.D.items.get(X.toID(x.row.item));
    const ms = it && it.exists && it.megaStone;
    const base = X.D.species.get(x.row.species);
    const forme = ms && typeof ms === 'object' ? ms[base.name] : null;
    if (!forme) continue;
    const brought = x.s < 4 ? [0, 1, 2, 3] : [2, 3, 4, 5];
    const G = { id: 'mega', sheets: { p1: x.rows, p2: x.rows }, brought: { p1: brought, p2: brought } };
    const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
    if (!a || !b) continue;
    const S = API.newBattle(a.team, b.team, { rng: API.makeRng(1) });
    const m = S.sfA.team.find(y => y._solverSheet === x.s);
    /* the spread the team body actually carries (the default mode's: observed-v1 since 1.73.0, ROTOM's own; role-v1 before, when a set ROTOM plays at a PUBLISHED tournament
     * spread is fielded at role-v1's in the arena, by design — test-arena-spreads PARITY) */
    if (!m || !m._sp || !(m._sp.hp > 0)) continue;
    n++;
    const hp0 = m.st.hp, sp0 = Object.assign({}, m._sp);
    const act = S.actA; let slot = act.indexOf(m), saved = null; if (slot < 0) { saved = act[0]; act[0] = m; }
    const before = M.MEDSEEN.megaStatFromSpread || 0;
    try { const run = () => M.megaEvolveNow(S, m, true); S._scope ? M.battleScopeRun(S._scope, run) : run(); } catch (e) { ok('MEGA', false, x.row.species + ': megaEvolveNow threw ' + e.message); continue; }
    if (saved) act[0] = saved;
    if ((M.MEDSEEN.megaStatFromSpread || 0) > before) recomputed++; else ok('MEGA', false, `${x.f} ${x.t.id} ${x.row.species}: the mega took the delta, not the recompute (_sp ${JSON.stringify(m._sp)})`);
    const exp = ['atk', 'def', 'spa', 'spd', 'spe'].map(s => SD.statValue(forme, x.row.nature, s, sp0[KEY[s]] | 0)).join('/');
    const got = ['atk', 'def', 'spa', 'spd', 'spe'].map(s => m.st[KEY[s]]).join('/');
    if (got === exp && m.st.hp === hp0) exact++; else ok('MEGA', false, `${x.f} ${x.t.id} ${forme}: ${got} hp ${m.st.hp} vs statModify ${exp} hp ${hp0}`);
  }
  ok('MEGA', n > 0 && recomputed === n && exact === n, `every HP-invested mega set recomputes from _sp to the authority's line (${recomputed} recomputed, ${exact} exact, of ${n})`);
  console.log(`  MEGA: ${n} HP-invested mega sets, recomputed ${recomputed}, exact ${exact}`);
}

/* ---------------- RED ---------------- */
let blind = false;
if (!NO_RED && !ONLY) {
  for (const [env, val, clause] of [['SPREAD_FRESH_BREAK', 'flat', 'FRESH'], ['SPREAD_SP_BREAK', '1', 'MEGA'], ['SPREADS_SOURCE_BREAK', 'default', 'DEFAULT']]) {
    const r = cp.spawnSync(process.execPath, [__filename, '--no-red', '--only', clause, '--release', REL], { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { [env]: val }), maxBuffer: 1 << 26 });
    const red = r.status === 1 && new RegExp('FAIL \\[' + clause + '\\]').test(r.stdout);
    console.log(`  RED ${env}=${val}: ${red ? clause + ' went red, as it must' : 'STAYED GREEN (exit ' + r.status + ') — the test is blind'}`);
    if (!red) blind = true;
  }
}

console.log(`\ntest-body-parity: ${checks - fails}/${checks} ${fails ? 'RED ' + JSON.stringify([...failed]) : blind ? 'BLIND' : 'GREEN'}`);
process.exit(fails ? 1 : blind ? 3 : 0);
