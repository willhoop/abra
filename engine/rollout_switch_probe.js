/* rollout_switch_probe.js — WHAT MOVED WHEN THE PLAYOUT LEARNED TO LEAVE. (ROADMAP #152/#153, SEARCH)
 *
 * *** THIS IS NOT AN IMPROVEMENT AND IT IS NOT A LEAF NUMBER. ***
 *
 * MEDICHAM is out of gate, so every rollout-derived figure in this project is WITHHELD, not
 * captioned. That applies here in full: nothing below may be read as MILTANK getting stronger, as a
 * comparison against a baseline, or as evidence about win rates. What it is entitled to say is
 * narrower and is the whole point of running it:
 *
 *   1. a state that could not previously be represented now can — the playout emits voluntary
 *      switches and MEDICHAM executes them;
 *   2. a MEASURED PROPERTY of the rollout (its switch rate, its turn-length distribution) now
 *      matches what the human stores say the real game does;
 *   3. the size of the consequence — how many positions the leaf now scores differently, and by how
 *      much — so that nobody mistakes a mechanism change for a rounding error.
 *
 * **This change INVALIDATES FURTHER every board-derived number**, which is expected and is the right
 * moment for it: before the refit, not after. R1, R2, R3, R4, the calibration and the weights were
 * already withheld behind MEDICHAM; they are now also behind a playout that plays a different game.
 *
 * ONE PROCESS, ALL ARMS, IDENTICAL BOARDS AND SEEDS. The 2026-08-04 mega-weather parity ran this way
 * for a stated reason and it is the same reason here: the engine cannot differ between arms if there
 * is no window between them. NO ENGINE RELEASE IS CUT — this is a mechanism receipt, exactly as
 * `pp_board_probe.js` is, and cutting a release is a shared pointer that is not SEARCH's to move
 * while ENGINE is mid-band. The source digests are stamped at start and re-read at the end, and the
 * artifact writes itself `void: true` if anything moved underneath it.
 *
 * THE ARMS
 *   before          switchRate 0,        maxTurns 60   <- what shipped
 *   switch-only     switchRate measured, maxTurns 60
 *   cap-only        switchRate 0,        maxTurns 14
 *   after           switchRate measured, maxTurns 14   <- what this lands
 *   uniform-actions switchRate 'uniform',maxTurns 14   <- the arm NOT taken, priced so the choice is visible
 *
 * `switchRate: 0` reproduces the old playout dice-for-dice (the rng draw is short-circuited before it
 * is taken), so `before` is the incumbent and not an approximation of it.
 *
 *   GAMES=120 EVERY=3 N=60 node --max-old-space-size=4096 engine/rollout_switch_probe.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const MEDI = require('./medicham2-browser.js');
const CS = require('./champions_sim.js');
const FP = require('./fit_policy.js');
const JR = require('./joint_rows.js');
const B = require('./board.js');
const RL = require('./rollout_leaf.js');
/* ROADMAP #258 — run_stamp is optional, and "it is not installed" must not look like "it is broken".
 * The null is kept; the reason is printed, because an artifact silently losing its run stamp is
 * exactly the provenance hole this repository has paid for twice. */
const RS = (() => {
  try { return require('./run_stamp.js'); }
  catch (e) {
    console.error('  NO RUN STAMP — engine/run_stamp.js would not load ('
                + String((e && e.message) || e).split(String.fromCharCode(10))[0]
                + '); this run will publish WITHOUT a stamp');
    return null;
  }
})();

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const GAMES = parseInt(process.env.GAMES || '120', 10);
const EVERY = parseInt(process.env.EVERY || '3', 10);
const N = parseInt(process.env.N || '60', 10);
const MAXB = parseInt(process.env.MAXB || '250', 10);

const CENSUS = RL.census();
if (!CENSUS.ok) { console.error('REFUSING TO RUN: data/rollout-switch-census.json is missing. Run engine/rollout_switch_census.js first — the arms are DEFINED by its measured numbers.'); process.exit(1); }
const CAP = CENSUS.maxTurns, RATE = CENSUS.switchRate;

const ARMS = [
  { key: 'before',          switchRate: 0,         maxTurns: 60,  what: 'what shipped — the playout cannot switch, 60-turn horizon' },
  { key: 'switch_only',     switchRate: RATE,      maxTurns: 60,  what: 'switching in, horizon unchanged' },
  { key: 'cap_only',        switchRate: 0,         maxTurns: CAP, what: 'horizon re-derived, still cannot switch' },
  { key: 'after',           switchRate: RATE,      maxTurns: CAP, what: 'both — what this change lands' },
  { key: 'uniform_actions', switchRate: 'uniform', maxTurns: CAP, what: 'the arm NOT taken: uniform over legal ACTIONS rather than the measured rate' },
];

/* `refused` is a TOTAL and reading it as a bug count is the first mistake available. The engine
 * overrules a handed-in switch for three reasons and only one of them wastes the turn — a TRAP.
 * These are MEDICHAM's own counters, asked of MEDICHAM, rather than a fourth opinion about what a
 * trap is written in this file. */
const TRAP_KEYS = ['trapBlockedSwitch', 'moveTrapBlockedSwitch', 'trapBlockedSwitchByMove', 'shedShellEscapedTrap'];
function snapshotTraps() { const o = {}; for (const k of TRAP_KEYS) o[k] = (MEDI.seen && MEDI.seen[k]) || 0; return o; }
function snapshotCounters() { return Object.assign({}, RL.SWITCH_COUNTERS); }
function deltaCounters(a, b) { const o = {}; for (const k of Object.keys(b)) o[k] = b[k] - (a[k] || 0); return o; }

console.log('ROLLOUT SWITCH PROBE — the playout could not leave the field. (ROADMAP #152/#153)\n');
console.log(`  census   ${CENSUS.generated}`);
console.log(`  rate     P(a chosen action is a voluntary switch) = ${(100 * RATE).toFixed(3)}%   [measured, both human stores]`);
console.log(`  cap      maxTurns ${CAP}, was 60   [p99 of occurrence-weighted remaining turns]`);
console.log(`  arms     ${ARMS.map(a => a.key).join(', ')}\n`);

const digests0 = RS && RS.sourceDigests ? RS.sourceDigests() : null;

let w1;
try { w1 = JR.loadRanker(); } catch (e) { console.error(e.message); process.exit(1); }
const { games } = FP.loadCorpus();
console.log(`  corpus   ${games.length.toLocaleString()} clean open-sheet games, first ${GAMES} sampled, every ${EVERY}th board, n=${N} playouts/arm\n`);

const rows = [];
const armStats = {};
for (const a of ARMS) armStats[a.key] = { switches: 0, meanTurnsSum: 0, truncated: 0, boards: 0, counters: null };

let sampled = 0, nulls = 0;
const t0 = Date.now();
JR.build(games, dex, {
  topK: 3, w1, maxGames: GAMES,
  onRow: () => {},
  onBoard: (board, g, gi) => {
    if (rows.length >= MAXB) return;
    sampled++;
    if (sampled % EVERY) return;
    const field = {
      weather: board.weather || '',
      terrain: RL.terrainOnBoard(board),
      tr: board.hasField('trickroom') ? 5 : 0,
      twA: board.hasSide('p1', 'tailwind') ? 4 : 0,
      twB: board.hasSide('p2', 'tailwind') ? 4 : 0,
    };
    /* ONE SEED FOR THE BOARD, shared across every arm. Common random numbers: without them the
     * difference between two arms sits underneath the dice, which is the identical fix the post-KO
     * replacement search and the preview both needed. */
    const seed = gi * 7919 + sampled;
    const row = { seed };
    let ok = true;
    for (const a of ARMS) {
      const c0 = snapshotCounters(), t0c = snapshotTraps();
      const r = RL.rolloutWinProb(board, 'p1', {
        n: N, dex, seed, field, explore: 1.0, foePolicy: 'uniform',
        maxTurns: a.maxTurns, switchRate: a.switchRate,
      });
      if (!r) { ok = false; break; }
      const st = armStats[a.key];
      st.boards++; st.switches += (r.switches || 0);
      st.meanTurnsSum += r.meanTurns; st.truncated += r.truncated;
      st.counters = deltaCounters(c0, snapshotCounters());
      st.cum = st.cum || { decisions: 0, benchAvailable: 0, offered: 0, executed: 0, refused: 0, noBench: 0, drainedIntoSwitch: 0 };
      for (const k of Object.keys(st.cum)) st.cum[k] += st.counters[k] || 0;
      const td = deltaCounters(t0c, snapshotTraps());
      st.traps = st.traps || {}; for (const k of TRAP_KEYS) st.traps[k] = (st.traps[k] || 0) + (td[k] || 0);
      row[a.key] = r.p;
      row[a.key + '_turns'] = r.meanTurns;
      row[a.key + '_trunc'] = r.truncated;
    }
    if (!ok) { nulls++; return; }
    rows.push(row);
    if (rows.length % 25 === 0) process.stderr.write(`    ${rows.length} boards, ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  },
});

if (!rows.length) { console.error('no boards scored — nothing below would mean anything.'); process.exit(1); }

function stats(vals) {
  const s = vals.slice().sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const q = p => s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
  return { n: s.length, mean: +mean.toFixed(4), p50: +q(0.5).toFixed(4), p90: +q(0.9).toFixed(4), max: +s[s.length - 1].toFixed(4) };
}

const compare = {};
for (const a of ARMS) {
  if (a.key === 'before') continue;
  const d = rows.map(r => r[a.key] - r.before);
  const abs = d.map(Math.abs);
  compare[a.key + '_vs_before'] = {
    boards_that_moved: abs.filter(x => x > 1e-9).length,
    boards_that_moved_more_than_5pt: abs.filter(x => x > 0.05).length,
    mean_signed_delta_pt: +(100 * d.reduce((x, y) => x + y, 0) / d.length).toFixed(3),
    mean_abs_delta_pt: +(100 * abs.reduce((x, y) => x + y, 0) / abs.length).toFixed(3),
    max_abs_delta_pt: +(100 * Math.max(...abs)).toFixed(3),
    abs_delta_distribution_pt: (() => { const s = stats(abs); for (const k of ['mean', 'p50', 'p90', 'max']) s[k] = +(100 * s[k]).toFixed(3); return s; })(),
  };
}

const perArm = {};
for (const a of ARMS) {
  const st = armStats[a.key];
  perArm[a.key] = {
    what: a.what, switchRate: a.switchRate, maxTurns: a.maxTurns,
    boards: st.boards,
    mean_playout_turns: +(st.meanTurnsSum / st.boards).toFixed(3),
    pct_playouts_truncated: +(100 * st.truncated / (st.boards * N)).toFixed(3),
    switch_actions_issued: st.switches,
    /* THE RATE THE PLAYOUT ACTUALLY REALISES, against the store's 7.677%. A rate that lands far
     * from the target means the draw is not doing what the comment says it does. */
    pct_actions_that_were_a_switch: null,
    counters_cumulative: st.cum || null,
    /* The subset of `refused` that actually COST the turn. The rest is a multi-turn lock or a charge
     * turn, both of which substitute a legal action. */
    engine_trap_counters: st.traps || null,
  };
}
/* THE DENOMINATOR IS COUNTED, NOT GUESSED. It was guessed in the first version of this file —
 * `boards x n x turns x 4 bodies` — and it reported a realised rate of 3.5% against the store's
 * 7.677%, which looked like a broken draw and was a broken denominator: a playout spends much of its
 * length at an EMPTY BENCH, where a switch is not an available action at all. `SWITCH_COUNTERS`
 * counts every body that reached the draw, so this is the number that compares to the store's
 * "P(a chosen action is a voluntary switch)". `pct_when_a_switch_was_available` is the second,
 * different question and both are printed rather than one being chosen. */
for (const a of ARMS) {
  const p = perArm[a.key], c = p.counters_cumulative || {};
  p.pct_actions_that_were_a_switch = c.decisions ? +(100 * c.offered / c.decisions).toFixed(3) : 0;
  p.pct_when_a_switch_was_available = c.benchAvailable ? +(100 * c.offered / c.benchAvailable).toFixed(3) : 0;
  p.store_target_pct = +(100 * RATE).toFixed(3);
}

const digests1 = RS && RS.sourceDigests ? RS.sourceDigests() : null;
const moved = (digests0 && digests1) ? Object.keys(digests1).filter(k => digests0[k] !== digests1[k]) : [];

const out = {
  generated: new Date().toISOString(), node: process.version,
  what: 'before/after receipt for putting voluntary switching in the rollout action set and re-deriving the horizon',
  NOT_A_LEAF_NUMBER: 'MEDICHAM is out of gate. Nothing here is a claim that MILTANK is stronger, and no figure here may be compared against a baseline or quoted as a leaf value. It says a state is representable and that a measured property of the rollout now matches the store.',
  invalidates: 'every board-derived number, further. Deliberately landed BEFORE the refit.',
  census_read: { generated: CENSUS.generated, switch_rate: RATE, derived_max_turns: CAP },
  config: { games: GAMES, every: EVERY, n_per_arm: N, boards: rows.length, explore: 1.0, foePolicy: 'uniform', side: 'p1' },
  arms: perArm,
  vs_before: compare,
  source_digests_at_start: digests0,
  source_digests_at_end: digests1,
  void: moved.length ? true : undefined,
  void_because: moved.length ? ('these files moved under the run: ' + moved.join(', ')) : undefined,
};
fs.writeFileSync(D('data', 'rollout-switch-probe.json'), JSON.stringify(out, null, 2));

console.log(`\n  ${rows.length} corpus boards, ${nulls} unbuildable, ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
console.log(`  arm               turns/playout   truncated   switch actions   % of ALL actions (store says ${(100 * RATE).toFixed(2)}%)   % when a bench existed`);
for (const a of ARMS) {
  const p = perArm[a.key];
  console.log(`  ${a.key.padEnd(16)}  ${String(p.mean_playout_turns).padStart(9)}   ${String(p.pct_playouts_truncated + '%').padStart(9)}   ${String(p.switch_actions_issued).padStart(14)}   ${String(p.pct_actions_that_were_a_switch + '%').padStart(28)}   ${String(p.pct_when_a_switch_was_available + '%').padStart(21)}`);
}
console.log('\n  counters (offered / EXECUTED by MEDICHAM / overruled / of which a trap wasted the turn / taken because nothing was selectable)');
for (const a of ARMS) {
  const c = perArm[a.key].counters_cumulative || {};
  const t = perArm[a.key].engine_trap_counters || {};
  const trapped = (t.trapBlockedSwitch || 0) + (t.moveTrapBlockedSwitch || 0) + (t.trapBlockedSwitchByMove || 0);
  console.log(`  ${a.key.padEnd(16)}  ${c.offered || 0} / ${c.executed || 0} / ${c.refused || 0} / ${trapped} / ${c.drainedIntoSwitch || 0}`);
}
if (RL.SWITCH_COUNTERS.refusedFirst) console.log(`  first overrule: ${RL.SWITCH_COUNTERS.refusedFirst}`);
console.log('\n  against `before`, same boards, same seeds:');
for (const [k, v] of Object.entries(compare)) {
  console.log(`  ${k.padEnd(28)} moved ${String(v.boards_that_moved).padStart(4)}/${rows.length}  ` +
    `mean |delta| ${String(v.mean_abs_delta_pt).padStart(6)} pt  max ${String(v.max_abs_delta_pt).padStart(6)} pt  ` +
    `>5pt on ${v.boards_that_moved_more_than_5pt}`);
}
if (moved.length) console.log('\n  *** VOID: these files moved under the run: ' + moved.join(', '));
console.log('\n  wrote data/rollout-switch-probe.json');
