/* instrumentation_rate.js — MEASURE, 2026-09-08. HOW MUCH INSTRUMENTATION RUNS PER TURN?
 *
 * WHY A RATE AND NOT AN ABLATION. A V8 sampling profiler cannot see `MEDSEEN.x++`: it is inlined
 * into whatever function encloses it, so its cost is attributed to the mechanic around it. There
 * are 829 MEDSEEN increment sites, 327 MEDFAILS sites and 1,412 distinct counter keys in
 * medicham2-browser.js, plus `ASKED[tag]++` and `COUNT[tag]++` on EVERY `tags.param`/`tags.has`
 * call. None of that is visible in a profile and all of it is instrumentation by definition — it
 * exists so a capability can prove it ran (CLAUDE.md: "a capability that cannot prove it ran is
 * assumed broken").
 *
 * So this measures the RATE — how many counter writes a turn actually performs — and prices one
 * write with a micro-benchmark on the same object shapes. That is a COST MODEL and it is labelled
 * as one; it is an upper bound in the sense that it charges every write at the measured rate and
 * assumes nothing is optimised away.
 *
 * IT EDITS NOTHING. The engine is opened as a frozen release and read, never written.
 *
 * Usage: node instrumentation_rate.js --release <id> [--playouts 400] [--cap 60]
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const REL_ID = arg('--release', null);
if (!REL_ID) throw new Error('--release is required; this run must be pinned');
const PLAYOUTS = +arg('--playouts', 400);
const CAP = +arg('--cap', 60);
const TEAM_STORE = arg('--team-store', 'data/team-pool-frozen');

const REL = require(path.join(ROOT, 'engine', 'engine_release.js')).open(REL_ID);
const MEDI = REL.require('engine/medicham2-browser.js', { need: ['battleInit', 'buildMon'] });
const RL = REL.require('engine/rollout_leaf.js', { need: ['runPlayout'] });
const TAGS = REL.require('engine/tags.js');
const SWARM = require(path.join(ROOT, 'engine', 'diff_swarm.js'));
const GD = require(path.join(ROOT, 'engine', 'game_differential.js'));
const TEAMS = SWARM.loadTeams({ storeDir: TEAM_STORE });
const CENSUS = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'rollout-switch-census.json'), 'utf8'));
  const pc = j.pooled && j.pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch;
  return (typeof pc === 'number' && pc > 0) ? pc / 100 : 0;
})();
function mulberry(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
const FAIL = { pair: 0, threw: 0 };
function bodies(sheet) {
  try { const p = GD.buildPair(sheet, { max: 4 });
    if (!p || p.filter(x => x && x.medi).length < 4) { FAIL.pair++; return null; }
    return p.filter(x => x && x.medi);
  } catch (e) { FAIL.pair++; return null; }
}
const pairs = [];
{ const k = 20, step = Math.max(1, Math.floor(TEAMS.length / (k * 2 + 4)));
  for (let i = 0; pairs.length < k && i + step < TEAMS.length; i += step * 2) {
    const A = bodies(TEAMS[i].team), B = bodies(TEAMS[i + step].team);
    if (A && B) pairs.push({ A, B, ia: i });
  } }
if (!pairs.length) throw new Error('no buildable pair from ' + TEAM_STORE);

const sum = o => { let t = 0; for (const k in o) { const v = o[k]; if (typeof v === 'number') t += v; } return t; };
const snap = () => ({ seen: sum(MEDI.MEDSEEN || {}), fails: sum(MEDI.MEDFAILS || {}),
                      asked: sum(TAGS.asked()), found: sum(TAGS.hits()) });
if (typeof TAGS.asked !== 'function' || typeof TAGS.hits !== 'function') {
  throw new Error('release ' + REL.id + ' exports no tags.asked()/tags.hits(); the tag-coverage '
    + 'counters cannot be read and this probe would silently report zero for them');
}
/* warm up so V8 has tiered up before the counted batch (bench_speed.js documents a 5.6x effect) */
let turns = 0;
for (let w = 0; w < 2; w++) for (const p of pairs) {
  const S = MEDI.battleInit(GD.freshBodies(p.A).filter(Boolean), GD.freshBodies(p.B).filter(Boolean), {});
  S.maxTurns = CAP; S._explore = 1.0;
  try { RL.runPlayout(S, mulberry(p.ia * 7919 + w + 13), 1.0, 'uniform', null, CENSUS); }
  catch (e) { FAIL.threw++; }
}
const a = snap();
const t0 = process.hrtime.bigint();
let games = 0;
outer: for (let i = 0; ; i++) for (const p of pairs) {
  if (games >= PLAYOUTS) break outer;
  const S = MEDI.battleInit(GD.freshBodies(p.A).filter(Boolean), GD.freshBodies(p.B).filter(Boolean), {});
  S.maxTurns = CAP; S._explore = 1.0;
  try { RL.runPlayout(S, mulberry(p.ia * 7919 + i * 104729 + 13), 1.0, 'uniform', null, CENSUS); }
  catch (e) { FAIL.threw++; }
  turns += S.turn || 0; games++;
}
const el = Number(process.hrtime.bigint() - t0) / 1e6;
const b = snap();

/* ---- PRICE ONE WRITE. Same shapes: a plain object literal with ~800 numeric keys (MEDSEEN) and a
 * null-prototype dictionary keyed by string (tags.js ASKED). Both are built here rather than
 * reasoned about, because V8's cost depends on whether the object is in fast or dictionary mode and
 * that is not something to guess. */
function timeWrites(obj, keys, n) {
  let t = process.hrtime.bigint();
  for (let i = 0; i < n; i++) { const k = keys[i % keys.length]; obj[k] = (obj[k] || 0) + 1; }
  return Number(process.hrtime.bigint() - t) / n;   /* ns per write */
}
const seenKeys = Object.keys(MEDI.MEDSEEN || {});
const seenClone = {}; for (const k of seenKeys) seenClone[k] = 0;
const dictKeys = seenKeys.slice(0, 400).map(k => 'tag' + k);
const dict = Object.create(null); for (const k of dictKeys) dict[k] = 0;
timeWrites(seenClone, seenKeys, 2e6); timeWrites(dict, dictKeys, 2e6);       /* warm */
const nsPlain = timeWrites(seenClone, seenKeys, 5e6);
const nsDict = timeWrites(dict, dictKeys, 5e6);

const d = { seen: b.seen - a.seen, fails: b.fails - a.fails, asked: b.asked - a.asked, found: b.found - a.found };
const perTurn = k => d[k] / Math.max(1, turns);
const msPerTurn = el / Math.max(1, turns);
const modelNs = perTurn('seen') * nsPlain + perTurn('fails') * nsPlain
              + perTurn('asked') * nsDict + perTurn('found') * nsDict;
const out = {
  generated: new Date().toISOString(), engine_release: REL.id, team_store: TEAM_STORE,
  what: 'COUNTER WRITE RATE in the rollout play path, and a cost model for it. Not an ablation.',
  playouts: games, turns, ms: +el.toFixed(1), ms_per_turn: +msPerTurn.toFixed(4),
  counter_writes_per_turn: {
    MEDSEEN: +perTurn('seen').toFixed(2), MEDFAILS: +perTurn('fails').toFixed(2),
    'tags.ASKED (every param/has call)': +perTurn('asked').toFixed(2),
    'tags.COUNT (every hit)': +perTurn('found').toFixed(2) },
  ns_per_write_measured: { plain_object_800_keys: +nsPlain.toFixed(2), null_proto_dict: +nsDict.toFixed(2) },
  modelled_instrumentation_ns_per_turn: +modelNs.toFixed(0),
  modelled_share_of_play_time_pct: +(100 * modelNs / (msPerTurn * 1e6)).toFixed(2),
  caveat: 'A cost model, not an ablation: it charges every counter write at a micro-benchmarked '
        + 'rate and cannot see writes the optimiser removed. Read it as an UPPER BOUND on what '
        + 'deleting the counters could return.',
  failures: FAIL,
};
if (FAIL.threw) console.log('  playouts that threw: ' + FAIL.threw + ' (counted, not hidden)');
if (FAIL.pair) console.log('  pair build failures: ' + FAIL.pair);
console.log(JSON.stringify(out, null, 1));
const dest = path.join(__dirname, 'instrumentation-rate-' + REL.id + '.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
console.log('wrote ' + dest);
