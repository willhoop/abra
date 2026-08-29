/* CARD C3 — WIDE GUARD PROTECTS A SIDE, AND THIS ENGINE ONLY EVER ASKED THE FOE'S SIDE.
 *
 *   node tests/probe_ally_wide_guard.js
 *   MEDI_GUARD_FOE_SIDE_ONLY=1 node tests/probe_ally_wide_guard.js     (the red demonstration)
 *
 * THE DEFECT, out of `docs/_reports/2026-08-29-empirical-divergence-cards.md` card C3, 1 game:
 * Rotom's Discharge hits its own ally, which had Wide Guard up. The authority writes
 * `-activate|p2a: Bastiodon|move: Wide Guard`; the damage landed here.
 *
 * THE CARD'S TITLE IS A LOCATION. Against a FOE's spread move this engine protects both bodies and
 * has since ROADMAP #126 — block 6 is the receipt. What was missing is the near half, and the reason
 * is written in this file's own comment at the `_allyHit` site:
 *     "the ally is appended AFTER the Wide Guard check below because Wide Guard protects a SIDE,
 *      and the attacker's own side never raised it against its own quake."
 * That sentence is the bug. It is not the authority's rule and no handler says it.
 *
 * THE AUTHORITY, READ WHOLE (data/moves.ts `wideguard.condition`; Champions overrides neither
 * wideguard nor quickguard — `data/mods/champions/moves.ts` was grepped for both ids, not recalled):
 *
 *     onTryHitPriority: 4,
 *     onTryHit(target, source, move) {
 *       if (move?.target !== 'allAdjacent' && move.target !== 'allAdjacentFoes') return;
 *       if (this.checkMoveBypassesProtect(move, source, target)) return;
 *       this.add('-activate', target, 'move: Wide Guard');
 *       ...
 *       return this.NOT_FAIL;
 *     }
 *
 * There is NO test of whose side the source is on. It is a `TryHit` handler on the side condition, so
 * it fires for whichever TARGET stands on the guarded side — and `allAdjacent` puts the user's own
 * partner in the target list (`getMoveTargets` pushes `adjacentAllies()` first, sim/pokemon.ts:809).
 * Quick Guard's condition is byte-identical in this respect and gains the same half; its class test
 * is `move.priority <= 0.1` and Earthquake is priority 0, which is block 4.
 *
 * STAGED IN THE OFFICIAL SIMULATOR before anything was edited, the ally's click the only knob:
 *     Agility     |move|p1a: Garchomp|Earthquake|p2b: Incineroar|[spread] p1b,p2a,p2b
 *                 |-damage|p1b: Manectric|0 fnt      <- the partner died to its own side's quake
 *     Wide Guard  |move|p1a: Garchomp|Earthquake|p2a: Clefable|[spread] p2a,p2b
 *                 |-activate|p1b: Manectric|move: Wide Guard
 *                 |-damage|p2a: Clefable|100/170     |-damage|p2b: Incineroar|38/170
 * Both foes are still hit and both are still spread-reduced — the guarded partner stays in the count
 * that decides the 0.75, because `move.spreadHit` is set at the TOP of `trySpreadMoveHit`, above the
 * step that removes it. Block 3 asserts exactly that, because the fix is one line from breaking it.
 *
 * WHAT THIS FILE ASSERTS THAT THE CENSUS ROWS DO NOT. The census rows are the ratchet; this is the
 * knob. `MEDI_GUARD_FOE_SIDE_ONLY=1` asks only the far side again and must red block 3 ALONE.
 * Blocks 4-7 are the negative arms an over-firing fix breaks: a guard that blocked everything on its
 * own side would eat our own spread damage against the FOES, which is a board that is correct today.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = require(D('data', 'tags.json'));

const OFF = process.env.MEDI_GUARD_FOE_SIDE_ONLY === '1';
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

const bare = (sp) => { const b = M.buildMon(sp, {}); if (!b) throw new Error('no MC row ' + sp);
  b.item = ''; b.ability = 'none'; return b; };
const rng5 = () => 0.5;

console.log('\n  CARD C3 — Wide Guard on the ATTACKER\'S OWN SIDE'
  + (OFF ? '   [MEDI_GUARD_FOE_SIDE_ONLY=1]' : ''));

/* ---- THE MEMBERSHIP, PRINTED BEFORE ANYTHING IS WIRED TO IT ------------------------------------
 * Two moves in five hundred carry `oneTurnGuard`, and the CLASS each one refuses is a param rather
 * than a name — so the near half lands on both at once and neither is spelled into the engine. */
const guards = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('oneTurnGuard') >= 0)
  .map(k => k + ' {blocks: ' + JSON.stringify(((TAGS.moves[k].params || {}).oneTurnGuard || {}).blocks)
    + ', ' + TAGS.moves[k].uses + ' uses}');
const hitsAlly = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('spreadAll') >= 0);
console.log('\n  DERIVED — moves carrying `oneTurnGuard` (the side guards; BOTH gain the near half): '
  + (guards.join(', ') || 'NONE'));
console.log('  DERIVED — moves carrying `spreadAll` (the ones that put a partner in the list): '
  + hitsAlly.length + ' — ' + (hitsAlly.slice(0, 12).join(', ') || 'NONE')
  + (hitsAlly.length > 12 ? ', …' : '') + '\n');

/* ---- THE FIXTURE -------------------------------------------------------------------------------
 * Gallade learns BOTH Wide Guard and Quick Guard and is grounded, so the knob is one clicked move on
 * one body — the guard, the wrong guard, or no guard at all — and nothing else about the board moves.
 * Earthquake is `allAdjacent`, so the partner is a genuine target of its own side's move. */
const turn = (o) => {
  const me = bare(o.user || 'garchomp');
  const ally = bare(o.ally || 'gallade');
  const f1 = bare(o.foe1 || 'clefable');
  const f2 = bare(o.foe2 || 'incineroar');
  const trace = [];
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true, trace });
  const h0 = [me.curHP, ally.curHP, f1.curHP, f2.curHP];
  const act = (mon, mv, tgt) => mv ? M.playerAction(mon, mv, tgt || null, S.field) : { kind: 'pass' };
  M.battleTurn(S, rng5,
    new Map([[me, act(me, o.move, f1)], [ally, act(ally, o.allyMove)]]),
    new Map([[f1, act(f1, o.foeMove, me)], [f2, { kind: 'pass' }]]));
  return { userLost: h0[0] - me.curHP, allyLost: h0[1] - ally.curHP,
           foe1Lost: h0[2] - f1.curHP, foe2Lost: h0[3] - f2.curHP, trace };
};
const show = (r) => '[user lost ' + r.userLost + ', ally lost ' + r.allyLost
  + ', foe1 lost ' + r.foe1Lost + ', foe2 lost ' + r.foe2Lost + ']';

/* ---- 1/2. THE CONTROL ARM: nothing up, so our own quake hits our own partner -------------------- */
const none = turn({ move: 'earthquake', allyMove: 'agility' });
ok(none.allyLost > 0 && none.foe1Lost > 0 && none.foe2Lost > 0,
  'with no guard up, our own Earthquake hits our partner and both foes', show(none));

/* ---- 3. THE DEFECT: our own Wide Guard shields our own partner and NOTHING ELSE ----------------- */
const wg = turn({ move: 'earthquake', allyMove: 'wideguard' });
ok(wg.allyLost === 0, 'our own Wide Guard stops our own Earthquake reaching our partner',
  show(wg) + '  — expected ally lost 0.' + (OFF ? '  This is the arm the knob reds.' : ''));
ok(wg.foe1Lost === none.foe1Lost && wg.foe2Lost === none.foe2Lost,
  'and it changes NOTHING about the foes — same damage, still spread-reduced',
  'no guard ' + show(none) + '  Wide Guard ' + show(wg)
  + '  — the guarded partner stays in the count that decides the 0.75, so these must be EQUAL');
ok(!(none.allyLost === wg.allyLost) || OFF,
  'the guard knob MOVES the outcome',
  'no guard ' + show(none) + '  Wide Guard ' + show(wg)
  + '  — identical readings across a varied click mean the near axis is unwired');

/* ---- 4. THE CLASS GATE: Quick Guard blocks PRIORITY, and Earthquake has none -------------------- */
/* Same body, same side, same turn — only which guard was raised differs. A near-side check that
 * ignored `oneTurnGuard.blocks` would shield the partner here too, and would be silent about it. */
const qg = turn({ move: 'earthquake', allyMove: 'quickguard' });
ok(qg.allyLost === none.allyLost,
  'our own Quick Guard does NOT stop our own Earthquake — it is priority 0',
  show(qg) + '  — must equal the no-guard arm ' + show(none));

/* ---- 5. THE TARGET-CLASS GATE: a move that never targets the partner is untouched --------------- */
/* Rock Slide is `allAdjacentFoes`. Wide Guard's own `onTryHit` fires per TARGET, and the partner is
 * not one — so the guard must neither fire nor eat our damage on the far side. */
const rs = turn({ move: 'rockslide', allyMove: 'wideguard' });
const rsNone = turn({ move: 'rockslide', allyMove: 'agility' });
ok(rs.foe1Lost === rsNone.foe1Lost && rs.foe2Lost === rsNone.foe2Lost && rs.foe1Lost > 0,
  'our own Wide Guard does not blunt our own `allAdjacentFoes` move against the foes',
  'guard ' + show(rs) + '  none ' + show(rsNone) + '  — our guard protects OUR side, not theirs');

/* ---- 6. THE REGRESSION CONTROL: the FOE-side half, which has worked since ROADMAP #126 ---------- */
/* A foe's Earthquake into our Wide Guard must be refused for BOTH of our bodies, and must read the
 * same on both arms. If it ever moves under the knob, the fix reached the wrong map. */
const foeQuake = turn({ user: 'clefable', foe1: 'garchomp', move: null,
                        foeMove: 'earthquake', allyMove: 'wideguard' });
const foeQuakeNo = turn({ user: 'clefable', foe1: 'garchomp', move: null,
                          foeMove: 'earthquake', allyMove: 'agility' });
ok(foeQuake.userLost === 0 && foeQuake.allyLost === 0 && foeQuakeNo.userLost > 0,
  'a FOE\'s Earthquake is still refused for both of our bodies — unchanged, both arms',
  'guard ' + show(foeQuake) + '  none ' + show(foeQuakeNo));

/* ---- 7. AND IT NAMES THE BODY IT SHIELDED ------------------------------------------------------- */
/* `this.add('-activate', target, 'move: Wide Guard')` fires inside the per-target TryHit event, so
 * `target` is the shielded Pokemon. One line, naming the partner, on our own side. */
const line = wg.trace.filter(l => /Wide Guard/i.test(String(l)) && /activate/i.test(String(l)));
ok(line.length === 1 && /gallade/i.test(String(line[0])),
  'the refusal announces `-activate` naming the shielded PARTNER',
  (line.join(' | ') || '(no -activate line)')
  + '\n          full trace: ' + wg.trace.join(' | '));

/* ---- THE DEFECT'S OWN NUMBERS ------------------------------------------------------------------- */
const seen = M.MEDSEEN || {}, fails = M.MEDFAILS || {};
console.log('\n  COUNTERS  sideGuardBlocked=' + (seen.sideGuardBlocked || 0)
  + '  allyGuardBlocked=' + (seen.allyGuardBlocked || 0)
  + '  guardFoeSideOnlyRestored=' + (fails.guardFoeSideOnlyRestored || 0));

console.log('\n  ' + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
