/* CARD C2 — LIGHTNING ROD DRAWS AN ALLY'S CLICK, AND BOTH DRAW SITES WERE HANDED THE FOE ARRAY ONLY.
 *
 *   node tests/probe_ally_lightning_rod.js
 *   MEDI_REDIRECT_FOE_ONLY=1 node tests/probe_ally_lightning_rod.js     (the red demonstration)
 *
 * THE DEFECT, out of `docs/_reports/2026-08-29-empirical-divergence-cards.md` card C2, 2 games. Both
 * of its cards are ALLY-side draws — the rod holder is the ATTACKER'S OWN PARTNER:
 *     |move|p2b: Rotom|voltswitch        SHOWDOWN |-activate|p2a: Sceptile|ability: Lightning Rod
 *     |move|p1b: Archaludon|electroshot   SHOWDOWN |-activate|p1a: Raichu|ability: Lightning Rod
 *
 * THE CARD'S TITLE — "Lightning Rod does not redirect" — IS A LOCATION, NOT A CAUSE. Foe-side draws
 * have worked since WIRE 25 and block 3 below is the receipt. `redirectDrawnTo` was correct; its two
 * CALLERS each handed it `it.side==='A'?actB:actA`, so no candidate on the user's own side was ever
 * offered and the ability knob moved nothing at all — the unwired-knob signature.
 *
 * THE AUTHORITY, READ WHOLE (data/abilities.ts `lightningrod`; Champions overrides neither abilities
 * nor moves for this id — checked with a grep of data/mods/champions/, not recalled):
 *
 *     onAnyRedirectTarget(target, source, source2, move) {
 *       if (move.type !== 'Electric' || move.flags['pledgecombo']) return;
 *       const redirectTarget = ['randomNormal','adjacentFoe'].includes(move.target) ? 'normal' : move.target;
 *       if (this.validTarget(this.effectState.target, source, redirectTarget)) { ... return this.effectState.target; }
 *     }
 *
 * `onAny` is the whole finding. Follow Me and Rage Powder declare `onFoeRedirectTarget` and can only
 * ever be asked on the far side; Lightning Rod is asked of EVERY active body, including the user's
 * partner. `validTargetLoc` (sim/battle.ts:2395) then tests, for `normal`/`randomNormal`/`scripted`,
 * `isAdjacent` — ADJACENCY ONLY, NOT SIDE — so in doubles a partner is a valid `normal` target and
 * the draw succeeds. `any` tests `!isSelf`, which is why block 7 exists: the rod cannot pull a move
 * out of its OWN mouth.
 *
 * STAGED IN THE OFFICIAL SIMULATOR before anything was edited, ally ability the only knob:
 *     Static        |move|p1a: Rotom|Thunderbolt|p2a: Clefable      |-damage|p2a: Clefable|109/170
 *     Lightning Rod |move|p1a: Rotom|Thunderbolt|p1b: Manectric
 *                   |-activate|p1b: Manectric|ability: Lightning Rod
 *                   |-ability|p1b: Manectric|Lightning Rod|boost    |-boost|p1b: Manectric|spa|1
 *
 * WHAT THIS FILE ASSERTS THAT THE CENSUS ROWS DO NOT. The census rows are the ratchet; this is the
 * knob. `MEDI_REDIRECT_FOE_ONLY=1` hands both sites the foe array again and must red block 2 ALONE.
 * Blocks 3-8 are the negative arms an over-firing fix breaks, and every one of them must read the
 * SAME on both arms — a fix that draws everything onto the nearest rod is worse than the gap it
 * closes, because it changes boards that are correct today.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = require(D('data', 'tags.json'));

const OFF = process.env.MEDI_REDIRECT_FOE_ONLY === '1';
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

const bare = (sp) => { const b = M.buildMon(sp, {}); if (!b) throw new Error('no MC row ' + sp);
  b.item = ''; b.ability = 'none'; return b; };
const rng5 = () => 0.5;

console.log('\n  CARD C2 — Lightning Rod on the ATTACKER\'S OWN SIDE'
  + (OFF ? '   [MEDI_REDIRECT_FOE_ONLY=1]' : ''));

/* ---- THE MEMBERSHIP, PRINTED BEFORE ANYTHING IS WIRED TO IT ------------------------------------
 * A derived set over-matches on its first try, so the set that gains the ally axis is printed rather
 * than described. `redirectsType` is the `onAnyRedirectTarget` family and is the ONLY family that
 * moves; `redirects` is the `onFoeRedirectTarget` family and must not. */
const rods = Object.keys(TAGS.abilities || {})
  .filter(k => (TAGS.abilities[k].tags || []).indexOf('redirectsType') >= 0)
  .map(k => k + ' {' + JSON.stringify((TAGS.abilities[k].params || {}).redirectsType || {}) + ', '
    + TAGS.abilities[k].uses + ' uses}');
const drawers = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('redirects') >= 0)
  .map(k => k + ' (' + TAGS.moves[k].uses + ' uses)');
console.log('\n  DERIVED — abilities carrying `redirectsType` (onAnyRedirectTarget; GAIN the ally axis): '
  + (rods.join(', ') || 'NONE'));
console.log('  DERIVED — moves carrying `redirects` (onFoeRedirectTarget; MUST NOT gain it): '
  + (drawers.join(', ') || 'NONE') + '\n');

/* ---- THE FIXTURE -------------------------------------------------------------------------------
 * Manectric carries BOTH Lightning Rod and Static on its own legal sheet, so the knob is one word on
 * one body and nothing else about the board moves. Rotom-Heat is the attacker because it is not
 * Electric-immune and its click is aimed at a FOE in every arm — the draw has to cross sides to be
 * the thing being measured. Clefable takes Electric neutrally; a Ground foe would read 0 damage for
 * the wrong reason and was the first fixture written here, which is why it is named. */
const shot = (o) => {
  const me = bare(o.user || 'rotomheat');
  const ally = bare(o.ally || 'manectric');
  const f1 = bare(o.foe1 || 'clefable');
  const f2 = bare(o.foe2 || 'incineroar');
  if (o.userAb) me.ability = o.userAb;
  if (o.allyAb) ally.ability = o.allyAb;
  if (o.foe2Ab) f2.ability = o.foe2Ab;
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const h0 = [ally.curHP, f1.curHP, f2.curHP];
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, o.move, f1, S.field)],
             [ally, o.allyMove ? M.playerAction(ally, o.allyMove, null, S.field) : { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { allyLost: h0[0] - ally.curHP, foe1Lost: h0[1] - f1.curHP, foe2Lost: h0[2] - f2.curHP,
           allySpa: ally.boosts.sa, userSpa: me.boosts.sa, foe2Spa: f2.boosts.sa };
};
const show = (r) => '[ally lost ' + r.allyLost + ', foe1 lost ' + r.foe1Lost + ', foe2 lost '
  + r.foe2Lost + ', ally SpA ' + r.allySpa + ']';

/* ---- 1. THE CONTROL ARM: no rod on the ally, so the click lands where it was aimed -------------- */
const st = shot({ move: 'thunderbolt', allyAb: 'static' });
ok(st.allyLost === 0 && st.foe1Lost > 0 && st.allySpa === 0,
  'with Static on the partner the Thunderbolt hits the foe it named', show(st));

/* ---- 2. THE DEFECT: the partner's Lightning Rod takes it -------------------------------------- */
const rod = shot({ move: 'thunderbolt', allyAb: 'lightningrod' });
ok(rod.foe1Lost === 0 && rod.allyLost === 0 && rod.allySpa === 1,
  'the partner\'s Lightning Rod draws the click, absorbs it and gains +1 SpA',
  show(rod) + '  — expected foe1 lost 0, ally lost 0, ally SpA +1.'
  + (OFF ? '  This is the arm the knob reds.' : ''));
ok(!(st.foe1Lost === rod.foe1Lost && st.allySpa === rod.allySpa) || OFF,
  'the ability knob MOVES the outcome',
  'static ' + show(st) + '  rod ' + show(rod)
  + '  — identical readings across a varied ability mean the axis is unwired, not that it does not matter');

/* ---- 3. THE REGRESSION CONTROL: the FOE side still draws, and reads the same on both arms ------ */
/* This is the arm that proves the card's title is a location. WIRE 25 wired the foe axis and it has
 * been live since; if it ever moves under the knob, this fix reached the wrong array. */
const foeRod = shot({ move: 'thunderbolt', allyAb: 'static', foe2Ab: 'lightningrod' });
ok(foeRod.foe1Lost === 0 && foeRod.foe2Lost === 0 && foeRod.foe2Spa === 1,
  'a FOE-side Lightning Rod still draws — unchanged, both arms',
  '[foe1 lost ' + foeRod.foe1Lost + ', foe2 lost ' + foeRod.foe2Lost + ', foe2 SpA ' + foeRod.foe2Spa + ']');

/* ---- 4. THE NEGATIVE ARM THAT MATTERS MOST: Follow Me and Rage Powder ARE foe-only -------------- */
/* `onFoeRedirectTarget`, not `onAnyRedirectTarget`. Maushold is a legal Follow Me carrier; the move
 * is raised on MY OWN side and must do nothing to MY OWN attack. A fix that offered the ally axis to
 * the volatile family too would turn every Follow Me into a partner-blocker. */
for (const drawMove of ['followme', 'ragepowder']) {
  const r = shot({ move: 'thunderbolt', ally: 'maushold', allyMove: drawMove });
  ok(r.foe1Lost > 0 && r.allyLost === 0,
    'my own partner\'s ' + drawMove + ' does NOT draw my own click', show(r)
    + '  — it is onFoeRedirectTarget; only the far side can be asked');
}

/* ---- 5. THE TYPE GATE: a non-Electric move walks past the rod ---------------------------------- */
const ghost = shot({ move: 'shadowball', allyAb: 'lightningrod' });
ok(ghost.foe1Lost > 0 && ghost.allySpa === 0,
  'a non-Electric move is not drawn by the partner\'s Lightning Rod', show(ghost));

/* ---- 6. THE SPREAD GATE: `getMoveTargets` never reaches redirection for a spread move ----------- */
/* Electroweb is this format's only legal Electric `allAdjacentFoes` move, so the partner is not a
 * target of it at all — which makes "both foes were hit" and "the rod ate it" two different readings
 * rather than one. A spread move pulled onto a partner would be silent and catastrophic. */
const web = shot({ move: 'electroweb', allyAb: 'lightningrod' });
ok(web.foe1Lost > 0 && web.foe2Lost > 0 && web.allySpa === 0,
  'a spread Electric move is not redirected onto the partner', show(web));

/* ---- 7. THE SELF GATE: the rod cannot pull a move out of its own mouth -------------------------- */
/* `validTargetLoc` for `normal` is `Math.abs(targetLoc - sourceLoc) === 1` on the near side, so the
 * user's own slot is NOT adjacent to itself and is never a valid draw target; `any` says `!isSelf`
 * outright. Same body, same ability, only the seat differs. */
const self = shot({ user: 'manectric', userAb: 'lightningrod', ally: 'clefable', move: 'thunderbolt' });
ok(self.foe1Lost > 0 && self.userSpa === 0,
  'the ATTACKER\'s own Lightning Rod does not draw the attacker\'s own click',
  '[foe1 lost ' + self.foe1Lost + ', user SpA ' + self.userSpa + ']');

/* ---- 8. STALWART TURNS THE WHOLE EVENT OFF, ON THE ALLY AXIS TOO -------------------------------- */
/* `getMoveTargets` gates the entire `RedirectTarget` event on `!move.tracksTarget`, so an attacker
 * that tracks is not drawn by anything, near side or far. Stamina is Archaludon's other legal
 * ability, so the control is the same body on the same sheet with only the clause removed. */
const stam = shot({ user: 'archaludon', userAb: 'stamina', move: 'thunderbolt', allyAb: 'lightningrod' });
const stal = shot({ user: 'archaludon', userAb: 'stalwart', move: 'thunderbolt', allyAb: 'lightningrod' });
ok(stam.foe1Lost === 0 && stam.allySpa === 1 && stal.foe1Lost > 0 && stal.allySpa === 0,
  'Stalwart refuses the ally-axis draw exactly as it refuses the foe-axis one',
  'Stamina user ' + show(stam) + '  Stalwart user ' + show(stal)
  + '  — equal arms would mean the gate is unread');

/* ---- THE DEFECT'S OWN NUMBERS ------------------------------------------------------------------- */
const seen = M.MEDSEEN || {}, fails = M.MEDFAILS || {};
console.log('\n  COUNTERS  redirectedToAlly=' + (seen.redirectedToAlly || 0)
  + '  redirectFoeOnlyRestored=' + (fails.redirectFoeOnlyRestored || 0)
  + '  redirectAllyAxisMissing=' + (fails.redirectAllyAxisMissing || 0));

console.log('\n  ' + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
