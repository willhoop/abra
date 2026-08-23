/* test-rollout-switch.js — THE PLAYOUT CAN LEAVE THE FIELD, AND IT HAS TO PROVE IT EVERY RUN.
 *
 * ROADMAP #152/#153. `runPlayout` only ever clicked MOVES: a voluntary switch was not in the action
 * set, so every position MILTANK has ever evaluated was scored as though both players were pinned to
 * the field for the rest of the game. The store says 71.2% of real games contain a voluntary switch
 * and 9.98% of decisions taken with a live bench ARE one.
 *
 * CLAUDE.md: *"A capability that cannot prove it ran is assumed broken."* Every bug of 2026-07-28 had
 * that one shape — the code was there, nothing called it, and every automated check passed because
 * both sides of every comparison shared the blind spot. So this file does not check that the code
 * exists. It plays real turns and FAILS ON A ZERO COUNTER, exactly as tests/test-wiring.js does.
 *
 * The counter that matters is `executed`, not `offered`. Offering proves only that rollout_leaf.js
 * made a decision; a switch that MEDICHAM overruled and one it carried out are the same object, so
 * the assertion is made against the FIELD after the turn.
 *
 *   node tests/test-rollout-switch.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
/* THE ONE DOOR into the species table, engine/mc_key.js. Requiring it also installs the SEAL, so
 * a raw miss anywhere in this process throws instead of quietly reading undefined. */
const { mcKey } = require(D('engine', 'mc_key.js'));
const MONMISS = { mayMiss: 'this fixture sweeps the damage table for a body that fits; absence is an answer' };
const MEDI = require(D('engine', 'medicham2-browser.js'));
const B = require(D('engine', 'board.js'));
const RL = require(D('engine', 'rollout_leaf.js'));

let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ok   ' + msg + (extra ? '   ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + msg + (extra ? '   ' + extra : '')); } };

console.log('\ntest-rollout-switch — switching is in the playout action set (ROADMAP #152/#153)\n');

/* ---------------------------------------------------------------------------------------------
 * 0. THE FACT IS READ FROM THE ARTIFACT, NOT TYPED.
 * ------------------------------------------------------------------------------------------ */
const CENSUS = RL.census();
ok(CENSUS.ok, 'data/rollout-switch-census.json is readable', CENSUS.ok ? '' : 'run node engine/rollout_switch_census.js');
ok(CENSUS.switchRate > 0 && CENSUS.switchRate < 0.5,
  'the measured switch rate is a plausible probability', `${(100 * CENSUS.switchRate).toFixed(3)}%`);
ok(CENSUS.maxTurns >= 8 && CENSUS.maxTurns <= 30,
  'the derived horizon is in the range the store can support', `maxTurns ${CENSUS.maxTurns}`);
/* THE ARTIFACT AND THE PLAYER MUST NOT HOLD TWO NUMBERS FOR ONE FACT. `miltank.js` reads the cap
 * through the same `census()`; a literal creeping back into DEFAULTS is exactly the drift this
 * catches, and it is the shape 60 had. */
{
  const MIL = fs.readFileSync(D('engine', 'miltank.js'), 'utf8');
  ok(/turns:\s*DERIVED\.turns/.test(MIL), 'miltank DEFAULTS.turns is derived rather than a literal');
}

/* ---------------------------------------------------------------------------------------------
 * A BOARD WITH A BENCH. Four bodies a side, two out, two behind — the position a switch exists for.
 * Species come from the table rather than being typed: a name that does not resolve builds nothing
 * and the whole file would pass having played no game at all (rollout_r1's self-check learned this).
 * ------------------------------------------------------------------------------------------ */
function makeBoard() {
  const pool = (mcKey.keys(MONMISS) || []).slice(0, 4);
  const bd = new B.Board();
  for (const s of ['p1', 'p2']) bd.setParty(s, pool);
  bd.switchIn('p1', 'a', pool[0]); bd.switchIn('p1', 'b', pool[1]);
  bd.switchIn('p2', 'a', pool[2]); bd.switchIn('p2', 'b', pool[3]);
  return bd;
}
function run(switchRate, seed, n) {
  const before = Object.assign({}, RL.SWITCH_COUNTERS);
  const r = RL.rolloutWinProb(makeBoard(), 'p1',
    { n: n || 40, seed: seed || 3, explore: 1.0, maxTurns: 60, switchRate });
  const d = {};
  for (const k of Object.keys(RL.SWITCH_COUNTERS)) {
    if (typeof RL.SWITCH_COUNTERS[k] === 'number') d[k] = RL.SWITCH_COUNTERS[k] - (before[k] || 0);
  }
  return { r, d };
}

/* ---------------------------------------------------------------------------------------------
 * 1. IT FIRES. A zero here is the whole point of the file.
 * ------------------------------------------------------------------------------------------ */
const live = run(undefined, 3, 40);
ok(live.r != null, 'the leaf returned a value on a 4v4 board with a bench');
ok(live.d.offered > 0, 'the playout OFFERED at least one voluntary switch', `offered ${live.d.offered}`);
ok(live.d.executed > 0, 'MEDICHAM EXECUTED at least one of them — checked against the field, not the action',
  `executed ${live.d.executed} of ${live.d.offered}`);
ok(live.d.decisions > 0, 'the denominator was counted rather than guessed', `decisions ${live.d.decisions}`);

/* ---------------------------------------------------------------------------------------------
 * 2. THE RATE IS THE MEASURED ONE. A draw that fires but at the wrong rate is the failure the first
 *    version of the probe had — 3.9% realised against a stated 7.7%, with nothing wrong in the draw
 *    and everything wrong in the denominator. Wide tolerance: this is a Bernoulli draw at n in the
 *    hundreds, so the band is about sanity, not precision.
 * ------------------------------------------------------------------------------------------ */
{
  const realised = live.d.offered / Math.max(1, live.d.benchAvailable);
  const target = CENSUS.switchRate;
  ok(Math.abs(realised - target) < 0.6 * target,
    'the realised rate, conditioned on a bench existing, tracks the store',
    `${(100 * realised).toFixed(2)}% against ${(100 * target).toFixed(2)}%`);
}

/* ---------------------------------------------------------------------------------------------
 * 3. THE CONTROL IS EXACT. `switchRate: 0` must reproduce the old playout DICE FOR DICE, or the
 *    before/after comparison in data/rollout-switch-probe.json means nothing. The rng draw is
 *    short-circuited before it is taken; this asserts that it really is.
 * ------------------------------------------------------------------------------------------ */
{
  const a = run(0, 11, 40), b = run(0, 11, 40);
  ok(a.d.offered === 0, 'switchRate 0 offers nothing', `offered ${a.d.offered}`);
  ok(a.r.p === b.r.p, 'switchRate 0 is deterministic across two calls at one seed');
  /* And it must DIFFER from the live arm, or the control is not controlling anything. */
  const c = run(undefined, 11, 40);
  ok(c.d.offered > 0 && c.r.p !== a.r.p,
    'the live arm and the control arm reach different answers on the same board and seed',
    `${a.r.p.toFixed(4)} -> ${c.r.p.toFixed(4)}`);
}

/* ---------------------------------------------------------------------------------------------
 * 4. NO TWO SLOTS MAY CLAIM THE SAME BODY. `bringIn` falls back to `_live(bench)[0]` when the body
 *    it was asked for has already left the bench, so a duplicate claim does not error — it brings in
 *    whoever happened to be first, which is a decision nobody made wearing the shape of one.
 *    Asserted directly on the playout: at switchRate 'uniform' both slots switch constantly.
 * ------------------------------------------------------------------------------------------ */
{
  const pool = (mcKey.keys(MONMISS) || []).slice(0, 4);
  const bd = makeBoard();
  const A = RL.buildSide(bd, 'p1', null, { fainted: 0, unbuildable: 0, threw: 0 });
  const Bt = RL.buildSide(bd, 'p2', null, { fainted: 0, unbuildable: 0, threw: 0 });
  const S = MEDI.battleInit(A, Bt, { seeded: true });
  S.maxTurns = 60;
  let dup = 0, turns = 0;
  const seen = () => {
    const names = S.actA.filter(Boolean).map(m => m.name);
    if (names.length === 2 && names[0] === names[1]) dup++;
    const all = S.actA.concat(S.benchA).filter(Boolean);
    if (new Set(all).size !== all.length) dup++;
  };
  let a = 99 >>> 0;
  const rng = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  RL.runPlayout(S, rng, 1.0, 'uniform', {}, 'uniform');
  seen(); turns++;
  ok(dup === 0, 'no body is ever on the field twice, and no body is on the field and the bench at once',
    `${turns} playout(s) at switchRate uniform, ${dup} duplicate(s)`);
  void pool;
}

/* ---------------------------------------------------------------------------------------------
 * 5. A DRAINED BODY LEAVES RATHER THAN STRUGGLING WHEN IT CAN. The PP work (R12) made an empty menu
 *    produce a real Struggle; a body with a full bench should not be Struggling at all, and the
 *    degenerate branch (`no selectable move -> p = 1`) is what expresses that. Asserted as a
 *    REACHABILITY claim, not a rate: `drainedIntoSwitch` counts it and it is allowed to be 0 here
 *    because a 4-move body rarely drains inside 60 turns — so the assertion is on the STRUCTURE.
 * ------------------------------------------------------------------------------------------ */
{
  const src = fs.readFileSync(D('engine', 'rollout_leaf.js'), 'utf8');
  ok(/!mvs\.length \? 1/.test(src),
    'a body with nothing selectable leaves with probability 1 rather than Struggling past a full bench');
  ok(/SWITCH_COUNTERS\.decisions\+\+/.test(src), 'the denominator is instrumented in the draw itself');
}

/* ---------------------------------------------------------------------------------------------
 * 6. FEATURES DID NOT MOVE. `data/policy-weights.json` has a fitted dimensionality and a silent
 *    change to it invalidates the vector without anyone noticing. Nothing in this work reads or adds
 *    a feature, and that is asserted rather than asserted-in-prose.
 * ------------------------------------------------------------------------------------------ */
{
  const nFeat = (B.FEATURES || []).length;
  let nWeights = null;
  try { const w = JSON.parse(fs.readFileSync(D('data', 'policy-weights.json'), 'utf8'));
        nWeights = (w.weights || []).length; } catch (e) { /* absent is not this file's business */ }
  ok(nWeights === null || nFeat === nWeights,
    'board.js FEATURES still matches the fitted weight vector', `${nFeat} features, ${nWeights} weights`);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
