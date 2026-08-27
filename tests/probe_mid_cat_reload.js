/* probe_mid_cat_reload.js — THE MIDDLE ARM'S CATEGORY WRAPPER OUTLIVES THE MODULE THAT OWNS ITS
 * STATE, AND EVERY INSTRUMENT THAT SWAPS THE SIMULATOR SOURCE HAS BEEN MEASURING WITHOUT IT.
 *
 *   SHOWDOWN_PATH=... node tests/probe_mid_cat_reload.js
 *   SHOWDOWN_PATH=... node tests/probe_mid_cat_reload.js --red     the demonstration, must FAIL
 *
 * ================= WHAT THIS IS ABOUT ============================================================
 *
 * The `middle` arm gives both engines the SAME die for the SAME kind of roll by hashing an ADDRESS:
 *
 *     <seed>|<turn>|<category>|<move>|<target>|<nth>          category ∈ acc crit sec dmg stall any
 *
 * The authority does not announce which kind of roll it is making, so `midWrapShowdown` wraps three
 * `BattleActions` methods — `hitStepAccuracy`, `secondaries`, `getDamage` — and records the category
 * in a module variable while each one runs. `game_differential.js` says so at its own install site:
 *
 *     "It THROWS if a method it names has moved, because a wrapper that silently fails to attach
 *      would leave every roll in the 'any' bucket and the arm would quietly stop being what it
 *      says it is."
 *
 * That is exactly what happened, through a door the guard does not cover.
 *
 * ================= THE DOOR: THE WRAPPER IS ON A CLASS THAT IS NEVER RELOADED ====================
 *
 * `BattleActions.prototype` comes out of SHOWDOWN's require cache. `game_differential.js` comes out
 * of ours — and `tests/staged_board.js`'s `harness()` DELETES it from the cache every time it swaps
 * the simulator source, which is once per row in `tests/test-assert-mode.js`, once per arm in
 * `tests/test-resolution-order.js`, and on every `--reds` pass of `staged_board.js` itself.
 *
 * So on the second load the guard `if (BattleActions.__midWrapped) return;` fires, the wrapper is NOT
 * reinstalled, and the one still standing keeps writing `MID_CAT` into the DEAD module instance. The
 * live instance reads `'any'` for the rest of the process. Nothing throws. Nothing is counted.
 *
 * ================= WHAT IT COSTS, MEASURED BEFORE THE FIX =======================================
 *
 * Two things go at once, and the second is damage:
 *
 *   1. every authority draw is addressed `any`, so the two engines' addresses stop matching and the
 *      shared die stops being shared. Measured on one staged Earthquake turn, second load:
 *          showdown  <seed>|2|any|earthquake|p11|0   |1   |2
 *          medicham  <seed>|2|acc|earthquake|p11|0   <seed>|2|dmg|…   <seed>|2|crit|…
 *   2. `pinRandom`'s damage-index inversion is gated on `MID_CAT === 'dmg'`, so it never fires and
 *      Showdown's `random(16)` is read as `floor(u*16)` — the ANTI-CORRELATED read the pin's own
 *      header warns about, not merely a different one.
 *
 * On `tests/test-assert-mode.js` that read as a live damage divergence with a plausible story behind
 * it — a Ground move refused by Levitate where the ALLY's HP parts, `earthquake` 86 vs 73 and
 * `bulldoze` 119 vs 115, WE DEAL LESS, exactly the direction of a spread reduction applied where the
 * authority applies none. It is none of that. Play the same board with ONE load and both engines say
 * 86. The damage index was 13 against 0.
 *
 * ================= WHY THE CONTROL IS A NO-OP EDIT ==============================================
 *
 * The three arms below hand the harness THE SAME ENGINE three times; only arm 2's bytes carry a
 * trailing comment, which changes nothing a battle can observe and everything about the harness's
 * cache key. So a verdict that moves between arm 1 and arm 2 cannot be the engine — there is no
 * engine difference to be. That is what separates this from the mutant arms the failing instruments
 * actually run, where a source change and a reload arrive together and cannot be told apart.
 *
 * ARM 1 IS THE POSITIVE CONTROL AND IT IS ASSERTED, NOT ASSUMED: the first load's Showdown addresses
 * MUST carry `dmg`, `acc` and `crit`. A probe whose instrument cannot see the good case cannot be
 * believed about the bad one.
 *
 * `--red` restores the per-module state and every arm after the first MUST go red. */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* ---- `--red` RUNS IN A CHILD, BECAUSE THE DEMONSTRATION NOW KILLS THE PROCESS ------------------
 *
 * The fix carries a second half: `game_differential.js`'s PIN_CLAIMS gained
 *
 *     '...and the installed wrapper writes into THIS module load’s holder'
 *
 * and a false pin claim is `process.exit(1)` at module load — deliberately, and it is not catchable.
 * So under the knob the SECOND load never returns to this file at all. That is a STRONGER red than
 * four parted boards and it cannot be asserted in-process, so the red arm spawns a child and reads
 * its exit code and its output.
 *
 * WHAT THE CHILD MUST SHOW, and both halves matter: it must DIE, and it must have printed the two
 * FIRST-LOAD rows green before dying. A child that fell over at load would also exit non-zero and
 * would prove nothing. */
const RED = process.argv.includes('--red');
if (RED) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [__filename, '--red-child'],
    { env: { ...process.env, MEDI_MID_CAT_UNSHARED: '1' }, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const greenFirstLoad = (out.match(/^ {2}PASS .*1\. first load/gm) || []).length;
  const died = r.status !== 0;
  const guard = /THE PIN IS WRONG[\s\S]*writes into THIS module load/.test(out);
  console.log('THE RED DEMONSTRATION — MEDI_MID_CAT_UNSHARED=1 in a child process\n');
  console.log('  first-load rows green before the reload: ' + greenFirstLoad + ' (2 expected)');
  console.log('  the child exited non-zero:               ' + died + '  (status ' + r.status + ')');
  console.log('  and the holder-identity pin claim named itself as the cause: ' + guard);
  const ok = greenFirstLoad === 2 && died && guard;
  console.log('\n  ' + (ok ? '--red PASSES: the knob restores the defect and the guard catches it at the '
    + 'second load,\n  after the first load has been shown working.'
    : '--red FAILED: the demonstration is not measuring what it claims. Fix it, do not delete it.') + '\n');
  process.exit(ok ? 0 : 1);
}
/* THE KNOB IS SET BEFORE `staged_board.js` IS REQUIRED, because that require loads
 * `game_differential.js`, which reads the environment at module scope. An agent set exactly this
 * kind of knob BELOW the require once and read the result as "unwired". */

const SB = require(D('tests', 'staged_board.js'));
const SRC = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));
const PASS = { m: 'protect' };

/* THE BOARD IS THE ONE THAT WAS LYING. Garchomp's Earthquake is `allAdjacent`, so it reaches its own
 * Clefable, the Levitate Chimecho (immune) and the Snorlax — a spread hit with an immune body in it,
 * which is what the divergence was mistaken for. The damage only lands once a Protect FAILS, and
 * which one fails is a live `randomChance(1, counter)` on this arm.
 *
 * ---- 2026-08-27 -- IT WAS TWO TURNS AND THAT STOPPED BEING ENOUGH, WHICH IS A FIXTURE THAT DECAYED
 * UNDER A DIE RATHER THAN AN ENGINE THAT BROKE.
 *
 * Two turns rested on "the foes' second Protect fails and the damage lands on turn 2". Under the
 * hash that ships from 2026-08-27 (ROADMAP #489, fmix32) the Protect that fails on turn 2 is
 * CHIMECHO'S — and Chimecho is immune to Earthquake, so the move still reached nobody. MEASURED, the
 * authority's own stream on the two-turn script:
 *
 *     |move|p2a: Chimecho|Protect||[still]   |-fail|p2a: Chimecho     <- its Protect DID fail
 *     |-activate|p1b: Clefable|move: Protect                          <- and both other guards held
 *     |-activate|p2b: Snorlax|move: Protect
 *     |-immune|p2a: Chimecho|[from] ability: Levitate                 <- so NOTHING was hit
 *
 * With no body hit there is no accuracy roll, no crit and no damage roll, and this file's own
 * assertion — "every load's showdown draws carry acc/crit/dmg" — went red on all SIX arms, first
 * load included. That is the assertion working: it refused to score a wrapper claim on a board where
 * the wrapper had nothing to categorise.
 *
 * A THIRD TURN RESTORES IT AND IT IS NOT A THRESHOLD MOVED TO GET A PASS. Showdown's stall counter
 * triples the denominator per consecutive success (`randomChance(1, counter)`), so a guard that has
 * held twice holds a third time one time in nine. The file still REFUSES rather than passes if no
 * damage roll happens — the missing-category clause below is unchanged — so a future die that
 * strands this board again reports itself instead of going quiet. */
const SC = (mv) => ({
  id: 'mid-cat-reload-' + mv,
  A: [mon('garchomp', '', 'Rough Skin', [mv, 'Protect']), mon('clefable', '', 'Unaware', ['Protect'])]
       .concat(FILL('toxapex', 'corviknight')),
  B: [mon('chimecho', '', 'Levitate', ['Protect']), mon('snorlax', '', 'Thick Fat', ['Protect'])]
       .concat(FILL('milotic', 'incineroar')),
  script: [
    { p1: [{ m: mv, t: 0 }, PASS], p2: [PASS, PASS] },
    { p1: [{ m: mv, t: 0 }, PASS], p2: [PASS, PASS] },
    { p1: [{ m: mv, t: 0 }, PASS], p2: [PASS, PASS] },
  ] });

/* THE THREE LOADS. Arm 2's bytes differ from arm 1's by a trailing comment and nothing else; arm 3
 * goes back to arm 1's exact bytes, which forces a THIRD load rather than reusing arm 1's cached
 * module — so "the second load is special" and "every load after the first is broken" can be told
 * apart. */
const ARMS = [
  { id: '1. first load          ', src: SRC },
  { id: '2. reload, no-op edit  ', src: SRC + '\n/* a trailing comment: not a byte a battle can see */\n' },
  { id: '3. reload, exact bytes ', src: SRC },
];

const CHILD = process.argv.includes('--red-child');
const MOVES = ['earthquake', 'bulldoze'];
let failed = 0;
console.log('THE MIDDLE ARM\'S CATEGORY WRAPPER, ACROSS A MODULE RELOAD');
console.log('  the SAME engine three times; only the harness cache key moves.'
          + (CHILD ? '   *** --red-child: MEDI_MID_CAT_UNSHARED=1 ***' : '') + '\n');

/* THE ARM IS THE OUTER LOOP AND THAT IS NOT A STYLE CHOICE. `harness()` reloads on a CHANGE of
 * source, so iterating boards inside an arm is one load per arm — three loads, six rows. Iterating
 * the other way round makes the second board's "first load" the fourth load of the process, and the
 * `--red` count below would then be counting something else. Caught by exactly that: the first
 * version of this file reported 5 failures where it predicted 4. */
for (const arm of ARMS) {
  for (const mv of MOVES) {
    const sc = SC(mv);
    const G = SB.harness(arm.src);
    const r = SB.runOne(sc, arm.src);
    const A = G.midAddresses();
    /* THE ADDRESSES ARE THE MECHANISM AND THE BOARD IS THE CONSEQUENCE; both are read, because a
     * board that happens to agree under a mis-addressed die is a green row that proves nothing.
     * The 1,000 startup uniformity draws carry no move and are dropped by construction, not by a
     * name — they are the ones with no move in scope. */
    const real = A.sd.filter(x => x.split('|')[3] !== '-');
    const cats = new Set(real.map(x => x.split('|')[2]));
    const wanted = ['acc', 'crit', 'dmg'];
    const missing = wanted.filter(c => !cats.has(c));
    const hp = (() => {
      const last = (r.boards || [])[(r.boards || []).length - 1];
      const d = (last && last.diffs || []).find(x => x.field === 'hp');
      return d ? ('  ally hp us ' + d.us + ' / sd ' + d.sd) : '';
    })();
    const ok = r.verdict === 'IDENTICAL' && !missing.length;
    if (!ok) failed++;
    console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + mv + '  ' + arm.id + '  ' + r.verdict
      + '   showdown draw categories: {' + [...cats].sort().join(',') + '}'
      + (missing.length ? '   MISSING ' + missing.join(',') : '') + hp);
  }
}

console.log('');
if (failed) {
  console.log('  ' + failed + ' of ' + (MOVES.length * ARMS.length) + ' arms FAILED. The middle arm\'s '
            + 'category wrapper is not reaching the live module,\n  so every authority draw after the '
            + 'first load is addressed `any` and the damage index is read backwards.\n');
  process.exit(1);
}
console.log('  ALL ' + (MOVES.length * ARMS.length) + ' ARMS AGREE, ON EVERY LOAD, AND EVERY LOAD\'S '
          + 'SHOWDOWN DRAWS CARRY acc/crit/dmg.\n');
