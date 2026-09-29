/* THE FIRST REG M-C INTERACTION MATRIX'S FOUR NON-AGREEING ROWS, RE-RUN ONE PAIR AT A TIME.
 *
 *   ABRA_REGULATION=regmc node tests/probe_regmc_matrix_offgate.js
 *
 * `data/interaction-matrix-regmc.json` (2026-09-29T21:21Z, --full) read 1683/1683 live and agreeing,
 * with four rows outside that count. All four were the INSTRUMENT, and none of them changes the engine.
 * Report: docs/_reports/2026-09-29-regmc-matrix-disagreements.md.
 *
 *   gastroacid -> quickclaw   off-gate, `.B.active[0].ability` medi "" vs "honeygather". medicham2 PARKS a
 *                             suppressed ability (`abSuppress`: `_abParked` holds the identity, `ability`
 *                             empties). The authority keeps `pokemon.ability` and adds the volatile, and its
 *                             projection reads that. `projMedi` read what can act, not the identity.
 *   curse -> goodasgold,      THREW, "You can't choose a target for Curse". The generator gave Curse to a
 *   curse -> quickclaw        non-Ghost user; the authority's move request rewrites a non-Ghost Curse to
 *                             `self` (sim/pokemon.ts getMoveRequestData, `case 'curse'`), so it is not a
 *                             foe-aimed carrier for that body.
 *   aurawheel -> weakarmor    KO-timing. medicham2 KO'd Skarmory in BOTH arms and the authority left it on
 *                             2/140 in both: not Weak Armor. The two pinned dice picked different damage
 *                             rolls -- the authority's `random(16)` pinned to 8 is the 92% roll, and
 *                             medicham2's `rng() = 0.5` is `damageRollIndex(0.5) = 7`, the 93% roll.
 *                             138 against 140 damage into 140 HP.
 *
 * Each arm below is the OUTCOME the matrix would record, from the same generator and the same staging. */
'use strict';
const T = require('./test-interaction-matrix.js');
const IM = require('./interaction_matrix.js');
const G = require('./test-game-diff.js');

const gen = IM.generate({ depth: Infinity });
const find = (a, b) => gen.cases.find(c => c.carrier.id === a && c.reactor.id === b);
let red = 0;
const say = (ok, what) => { console.log((ok ? '  GREEN ' : '  RED   ') + what); if (!ok) red++; };

/* 1. Gastro Acid: the engines must agree, and the witness must still exist -- the medicham2 body really
 * is suppressed, so the fix is a READ, not a change to what the engine does. */
{
  const c = find('gastroacid', 'quickclaw');
  if (!c) say(false, 'gastroacid -> quickclaw was not emitted; the control for this probe is gone');
  else {
    const r = T.runState(c);
    say(!r.failure && r.agrees, 'gastroacid -> quickclaw agrees  ' + JSON.stringify(r.failure || r.diffs));
    /* the suppression itself, on the medicham2 side, so a projection that stopped reading the ability
     * at all could not pass this */
    const st = T.stageState(c, 'test'); let S = null;
    G.runScript('gastro/probe', st.A, st.B, st.script, { pinDice: true, inject: (t, s) => { S = s; } });
    const v = S && S.actB[0];
    say(!!v && v.ability === '' && v._abParked === 'honeygather',
      'the target is still suppressed in medicham2 (ability "' + (v && v.ability) + '", parked "' + (v && v._abParked) + '")');
  }
}

/* 2. Curse: no emitted case may throw, and every emitted user must be one whose REQUEST aims Curse at a foe. */
for (const reactor of ['goodasgold', 'quickclaw']) {
  const c = find('curse', reactor);
  if (!c) { say(true, 'curse -> ' + reactor + ' not emitted (dropped by name)'); continue; }
  const user = IM.dex.species.get(c.carrier.user);
  const r = T.runState(c);
  say(user.types.includes('Ghost') && !r.failure,
    'curse -> ' + reactor + ' user ' + c.carrier.user + ' [' + user.types + ']  ' + (r.failure || 'ran'));
}
{
  const dropped = Object.keys(gen.dropped).filter(k => /request/.test(k));
  console.log('    drop reasons naming the request target: ' + JSON.stringify(dropped));
}

/* 3. Aura Wheel -> Weak Armor: the KO split must be gone, and the HP left must be EQUAL, not merely both
 * alive -- the dice are pinned to one roll, so any residual difference is a real damage disagreement. */
{
  const c = find('aurawheel', 'weakarmor');
  if (!c) say(false, 'aurawheel -> weakarmor was not emitted');
  else {
    const r = T.runState(c);
    say(!r.failure && r.agrees && !r.koTiming, 'aurawheel -> weakarmor agrees  ' + JSON.stringify(r.diffs));
    for (const arm of ['test', 'ctl']) {
      const st = T.stageState(c, arm); const col = [];
      G.runScript('aw/' + arm, st.A, st.B, st.script, { collect: col, pinDice: true });
      const mh = col[0].mediHp[2], sh = col[0].sdHp[2];
      say(Math.abs(mh - sh) < 1e-9, 'aurawheel ' + arm + ' arm: Skarmory HP fraction medi ' + mh.toFixed(4) + ' sd ' + sh.toFixed(4));
    }
  }
}

console.log(red ? '\nRED: ' + red + ' arm(s)' : '\nGREEN');
process.exit(red ? 1 : 0);
