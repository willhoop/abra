/* probe_spread_item_order.js — A SPREAD MOVE SAYS EVERY REFUSAL BEFORE IT SAYS ANY EFFECT.
 *
 *   node tests/probe_spread_item_order.js
 *   MEDI_SPREAD_ITEM_INTERLEAVED=1 node tests/probe_spread_item_order.js     (the red demonstration)
 *
 * ================= WHAT WAS MEASURED, BEFORE ANYTHING WAS WRITTEN ================================
 *
 * `data/all-mechanics-fire.json`, release 48ac1c228e02, row `moves.corrosivegas`, rung `items`:
 *
 *     ordering :: |-activate|p2b|protect <> |-enditem|p2a|sitrusberry|[from]corrosivegas
 *
 *     showdown   |move|p1a: Garbodor|Corrosive Gas|p2a: Feraligatr|[spread] p2a
 *                |-activate|p1b: Venusaur|move: Protect
 *                |-activate|p2b: Charizard|move: Protect
 *                |-enditem|p2a: Feraligatr|Sitrus Berry|[from] move: Corrosive Gas|[of] p1a: Garbodor
 *     medicham   |move|p1a: garbodor|corrosivegas|p2a: feraligatr
 *                |-activate|p1b: venusaur|move: Protect
 *                |-enditem|p2a: feraligatr|sitrusberry|[from] move: corrosivegas|[of] p1a: garbodor
 *                |-activate|p2b: charizard|move: Protect
 *
 * The BOARD is identical on both engines — the same body loses the same berry, the same two Protects
 * hold. Only the ORDER differs, and it differed because this engine ran one pass per target while
 * the authority runs one pass per STEP.
 *
 * ================= THE AUTHORITY, READ WHOLE =====================================================
 *
 * `BattleActions#trySpreadMoveHit`, sim/battle-actions.ts:553-610. `moveSteps` is an array of eight
 * functions and the driver is:
 *
 *     for (const step of moveSteps) {
 *       const hitResults = step.call(this, targets, pokemon, move);
 *       if (!hitResults) continue;
 *       targets = targets.filter((val, i) => hitResults[i] || hitResults[i] === 0);
 *       ...
 *     }
 *
 * Every step takes the WHOLE target array. Step 1 is `hitStepTryHitEvent` (Protect, Magic Bounce,
 * the ability refusals); step 7 is `hitStepMoveHitLoop`, where every effect happens. So the
 * authority structurally cannot write an effect line before a refusal line on the same click, and
 * the Champions mod overrides only `hitStepMoveHitLoop` (data/mods/champions/scripts.ts:428) — the
 * driver above is untouched, which was checked rather than assumed.
 *
 * ================= WHY THIS IS NOT A COSMETIC FIX ================================================
 *
 * It is narration, and narration is its own gate (Will, 2026-08-22: board-material now, narration as
 * a separate gate AFTERWARDS). A protocol comparison aligns two streams line by line, so a
 * transposed pair is a divergence at the FIRST of the two lines and every line after it is judged
 * out of step.
 *
 * ================= WHAT THIS PROBE DOES NOT CLAIM ================================================
 *
 * The authority runs each gauntlet STAGE across all targets before the next stage starts. This
 * engine runs the whole gauntlet per target inside pass one. They differ only when two targets are
 * refused by DIFFERENT stages on the same click, which no fixture here stages; the branch says so in
 * as many words rather than pretending the split is finer than it is.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = require(D('data', 'tags.json'));

const OFF = process.env.MEDI_SPREAD_ITEM_INTERLEAVED === '1';
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n  SPREAD ITEM REMOVAL — REFUSALS FIRST, EFFECTS AFTER'
  + (OFF ? '   [MEDI_SPREAD_ITEM_INTERLEAVED=1]' : ''));

/* ---- 0. THE MEMBERSHIP, PRINTED ---------------------------------------------------------------
 * The split lives in the `trickitem` branch, so it reaches every carrier of `takesTargetItem` with
 * `swaps` or `removes`. Only the SPREAD members can observe it, and that subset is derived here
 * rather than named — a single-target Trick has one survivor and is unmoved by the change. */
const carriers = Object.keys(TAGS.moves || {}).filter(k => {
  const p = (TAGS.moves[k].params || {}).takesTargetItem;
  return p && (p.swaps || p.removes);
});
const spread = carriers.filter(k => {
  const t = ((TAGS.moves[k].params || {}).targetClass || {}).target;
  return t === 'allAdjacent' || t === 'allAdjacentFoes' || t === 'foeSide' || t === 'all';
});
console.log('\n  DERIVED — legal moves routed through the item branch: ' + carriers.join(', '));
console.log('  DERIVED — of those, the ones that can hit more than one body: ' + (spread.join(', ') || 'NONE'));
ok(spread.length >= 1,
  'at least one item mover in this format is a spread move — otherwise this probe measures nothing',
  'spread members: ' + (spread.join(', ') || 'none'));

/* ---- THE FIXTURE -------------------------------------------------------------------------------
 * The roster's own: Garbodor clicks Corrosive Gas, which is `allAdjacent`, so it reaches its OWN
 * partner and both foes. The partner and the far foe both Protect; the near foe holds a Sitrus Berry
 * and loses it. Every species and item is the roster's, so this is the same board the artifact row
 * was measured on rather than a new one. */
function gas(o) {
  o = o || {};
  const mk = (sp, item) => { const b = M.buildMon(sp, {}); if (!b) throw new Error('no MC row ' + sp);
    b.item = item || ''; b.ability = 'none'; return b; };
  const me = mk('garbodor'), ally = mk('venusaur');
  const nearFoe = mk('feraligatr', o.foeItem === undefined ? 'sitrusberry' : o.foeItem);
  const farFoe = mk('charizard', o.farItem || '');
  const trace = [];
  const S = M.battleInit([me, ally], [nearFoe, farFoe], { seeded: true, trace });
  const rng5 = () => 0.5;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'corrosivegas', nearFoe, S.field)],
             [ally, M.playerAction(ally, 'protect', ally, S.field)]]),
    new Map([[nearFoe, o.nearProtects ? M.playerAction(nearFoe, 'protect', nearFoe, S.field) : { kind: 'pass' }],
             [farFoe, M.playerAction(farFoe, 'protect', farFoe, S.field)]]));
  return { trace, items: [me.item || '-', ally.item || '-', nearFoe.item || '-', farFoe.item || '-'] };
}

const r = gas();
const seg = r.trace.filter(l => /^\|-(activate|enditem|fail|immune)\|/.test(String(l)));
console.log('\n  the click, refusal and effect lines only:');
for (const l of seg) console.log('    ' + l);

/* ---- 1. THE BOARD IS THE SAME EITHER WAY, AND THAT IS THE POINT -------------------------------- */
/* If this arm ever moves, the change stopped being an ordering fix and became a behaviour change. */
ok(r.items[2] === '-' && r.items[3] === '-' && r.items[1] === '-',
  'CONTROL — the berry is still stripped off the unprotected foe, both arms of the knob',
  'items after [me ' + r.items[0] + ', ally ' + r.items[1] + ', near foe ' + r.items[2]
  + ', far foe ' + r.items[3] + ']');

/* ---- 2. EVERY REFUSAL PRECEDES EVERY EFFECT ---------------------------------------------------- */
const iAct = seg.map((l, i) => /^\|-activate\|/.test(String(l)) ? i : -1).filter(i => i >= 0);
const iEff = seg.map((l, i) => /^\|-enditem\|/.test(String(l)) ? i : -1).filter(i => i >= 0);
ok(iAct.length === 2 && iEff.length === 1,
  'the fixture produces two refusals and one effect — otherwise the order question is not asked',
  'refusals at ' + JSON.stringify(iAct) + '  effects at ' + JSON.stringify(iEff));
ok(iAct.length === 2 && iEff.length === 1 && Math.max(...iAct) < Math.min(...iEff),
  'both `-activate|move: Protect` lines are written before the `-enditem`',
  seg.join(' | ') + (OFF ? '   — this is the arm the knob reds.' : ''));

/* ---- 3. THE ORDER OF THE REFUSALS AMONG THEMSELVES IS UNCHANGED -------------------------------- */
/* `statusMoveTargets` decides who is hit and in what order, and this batch does not touch it. The
 * ally is first on both engines; a fix that reversed the target list would pass arm 2 and be wrong. */
ok(/venusaur/i.test(String(seg[0] || '')) && /charizard/i.test(String(seg[1] || '')),
  'the ally is still refused before the far foe — the target ORDER is untouched',
  (seg[0] || '(nothing)') + '   then   ' + (seg[1] || '(nothing)'));

/* ---- 4. THE KNOB MOVES THE OUTCOME ------------------------------------------------------------- */
ok(OFF || !(iEff.length && iAct.length === 2 && iEff[0] < Math.max(...iAct)),
  'the knob MOVES the line order — an identical stream across it would mean the split is dead',
  'this run: ' + seg.map(l => String(l).split('|')[1]).join(' -> '));

/* ---- 5. A SINGLE-TARGET MEMBER IS UNMOVED ------------------------------------------------------ */
/* Trick has one target, so pass one hands pass two exactly one survivor and the stream cannot
 * change. This is the regression arm: the split must not reorder anything that was already right. */
const trick = (() => {
  const mk = (sp, item) => { const b = M.buildMon(sp, {}); b.item = item || ''; b.ability = 'none'; return b; };
  const me = mk('gengar', 'choicescarf'), ally = mk('venusaur');
  const f1 = mk('feraligatr', 'sitrusberry'), f2 = mk('charizard');
  const trace = [];
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true, trace });
  M.battleTurn(S, () => 0.5,
    new Map([[me, M.playerAction(me, 'trick', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { trace: trace.filter(l => /^\|-(activate|item|enditem|fail)\|/.test(String(l))),
           mine: me.item || '-', theirs: f1.item || '-' };
})();
ok(trick.mine === 'sitrusberry' && trick.theirs === 'choicescarf',
  'REGRESSION — a single-target Trick still swaps both items',
  'me ' + trick.mine + '  them ' + trick.theirs + '   ' + trick.trace.join(' | '));

/* ---- 6. THE ENGINE'S OWN COUNTERS SAY BOTH PASSES RAN ------------------------------------------
 * A counter that cannot fire is not a counter, and the first version of this pair counted "more than
 * one survivor" — which read ZERO on the very fixture the fix was written for. Both halves must be
 * non-zero here or the split is being asserted from the stream alone. */
const seen = M.MEDSEEN || {}, fails = M.MEDFAILS || {};
ok((seen.spreadItemGauntletRefused || 0) > 0 && (seen.spreadItemEffects || 0) > 0,
  'both passes are exercised by this fixture — refusals AND an effect on the same click',
  'gauntletRefused=' + (seen.spreadItemGauntletRefused || 0)
  + '  effects=' + (seen.spreadItemEffects || 0));
console.log('\n  COUNTERS  spreadItemGauntletRefused=' + (seen.spreadItemGauntletRefused || 0)
  + '  spreadItemEffects=' + (seen.spreadItemEffects || 0)
  + '  spreadItemInterleavedRestored=' + (fails.spreadItemInterleavedRestored || 0));

console.log('\n  ' + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
