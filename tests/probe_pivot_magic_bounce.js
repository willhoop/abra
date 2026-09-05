#!/usr/bin/env node
/* tests/probe_pivot_magic_bounce.js — THE ONE DOOR `bounceOff` WAS NEVER FITTED TO
 * ==================================================================================================
 * DOES A REFLECTABLE **PIVOT** STATUS MOVE COME BACK AT ITS USER?
 *
 * THE AUTHORITY, `data/abilities.ts` `magicbounce.onTryHit`, and it is not a re-aim:
 *
 *     onTryHit(target, source, move) {
 *       if (target === source || move.hasBounced || !move.flags['reflectable']) return;
 *       const newMove = this.dex.getActiveMove(move.id);
 *       newMove.hasBounced = true;
 *       newMove.pranksterBoosted = false;
 *       this.actions.useMove(newMove, target, { target: source });
 *       return null;
 *     }
 *
 * THE BOUNCER **USES** THE MOVE. So for Parting Shot — `flags: {reflectable:1, ...}`, `selfSwitch:
 * true`, `data/moves.ts` — the whole move changes hands: the drop lands on the ORIGINAL CLICKER, and
 * the pivot belongs to the BOUNCER. The clicker stays on the field.
 *
 * WHAT THIS ENGINE DID. `bounceOff` has existed since WIRE 33 and is called at SIX sites. The
 * `kind === 'switch'` branch — the pivot road, and the only road Parting Shot takes — is not one of
 * them: it resolved its target with a bare `reaimToSlot` and never asked. So a Parting Shot at a
 * Magic Bounce body dropped THE BOUNCER's stats and pivoted THE CLICKER, which is both halves
 * backwards. 15,702 sheet uses on the move; the ability is on Espeon, Hatterene and three megas
 * including Clefable-Mega.
 *
 * LIVE TODAY, NAMED, ON THE PINNED POOL: game `…-2655360057` of
 * `data/verification/fix-batch-7.json`, board-material row 18 —
 *     showdown  |move|p2a: Clefable|Parting Shot|p1a: Grimmsnarl|[from] ability: Magic Bounce
 *     medicham  |-unboost|p2a: Clefable|atk|1
 * and the boards then part on eight leaves, including WHICH BODY IS STANDING IN p1a for the rest of
 * the game, both screens and the Tailwind clock.
 *
 * THE FOUR BOARDS. Verdicts come from `engine/board_state.js` against the authority's own board;
 * nothing here declares an expected value.
 *
 *   1. magic-bounce-returns-parting-shot   THE LIVE ARM.
 *   2. synchronize-espeon-takes-the-drop   THE KNOB-CLEARED CONTROL. The SAME board and the SAME
 *                                          click, with Espeon carrying its OTHER legal ability. The
 *                                          drop must land on Espeon and Incineroar must pivot. If
 *                                          this arm and arm 1 ever agree, the ability knob is
 *                                          unwired and arm 1 proves nothing.
 *   3. uturn-is-not-reflectable            THE OVER-FIRE CONTROL. U-turn is a pivot with NO
 *                                          `reflectable` flag, so it must go straight through the
 *                                          same ability. A fix keyed on "is this a pivot" rather
 *                                          than on the FLAG would pass arm 1 and fail here.
 *   4. taunt-still-bounces                 THE ALREADY-RIGHT CONTROL. A reflectable status move that
 *                                          is NOT a pivot takes a different branch, which has always
 *                                          called `bounceOff`. It must be identical clean AND under
 *                                          the knob — that is what says this was one shut door and
 *                                          not a broken ability.
 *
 * RED-FIRST KNOB: `MEDI_PIVOT_IGNORES_BOUNCE=1` restores the pre-fix engine. Under it arm 1 goes RED
 * and arms 2, 3 and 4 stay green.
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

const KNOB = process.env.MEDI_PIVOT_IGNORES_BOUNCE === '1';
console.log('\ntests/probe_pivot_magic_bounce.js — the pivot branch never asked bounceOff');
console.log('  MEDI_PIVOT_IGNORES_BOUNCE=' + (KNOB ? '1  (PRE-FIX ENGINE)' : '0'));

/* ---- 0. THE MEMBERSHIP, DERIVED AND PRINTED ---------------------------------------------------- */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard;

console.log('\n0. WHO BOUNCES, WHAT IS REFLECTABLE, AND WHICH OF THOSE ARE PIVOTS');
const BOUNCERS = D.species.all().filter(legal)
  .filter(s => Object.values(s.abilities).some(a => D.abilities.get(a).id === 'magicbounce'));
console.log('     Magic Bounce in this regulation: '
  + BOUNCERS.map(s => s.name + (s.name.includes('-Mega') ? ' [MEGA — a script cannot stage one]' : '')).join(', '));
ok(BOUNCERS.some(s => s.id === 'espeon'),
   'Espeon carries it WITHOUT megaing, so the arms below can be scripted at all',
   'matched: ' + BOUNCERS.map(s => s.id).join(', '));

/* THE SET THE FIX ACTUALLY WIDENS: reflectable moves that take the PIVOT road. Printed, because a
 * count in a comment is stale the day the regulation moves and because a rule that over-matched here
 * would send a U-turn back at its user. */
const REFL = D.moves.all().filter(m => legal(m) && m.flags && m.flags.reflectable);
const REFL_PIVOT = REFL.filter(m => m.selfSwitch);
const PIVOTS = D.moves.all().filter(m => legal(m) && m.selfSwitch);
console.log('     reflectable moves: ' + REFL.length + ';  pivots: ' + PIVOTS.length
  + ';  BOTH (the set this fix reaches): ' + REFL_PIVOT.map(m => m.id).join(', '));
console.log('     pivots that are NOT reflectable and must stay unbounced: '
  + PIVOTS.filter(m => !(m.flags && m.flags.reflectable)).map(m => m.id).join(', '));
ok(REFL_PIVOT.length >= 1 && REFL_PIVOT.some(m => m.id === 'partingshot'),
   'the intersection is non-empty and contains Parting Shot',
   'matched: ' + REFL_PIVOT.map(m => m.id).join(', '));
ok(!(D.moves.get('uturn').flags || {}).reflectable && !!D.moves.get('uturn').selfSwitch,
   'and U-turn is a pivot that is NOT reflectable, so arm 3 is a real over-fire control',
   'uturn reflectable=' + !!(D.moves.get('uturn').flags || {}).reflectable
   + ' selfSwitch=' + !!D.moves.get('uturn').selfSwitch);

/* AND THE ENGINE'S OWN JOIN, read out of the artifact the engine reads, not out of the dex. If the
 * tag stopped carrying `reflectable` for Parting Shot the fix would be inert and every arm would be
 * green for the wrong reason. */
const vm = require('vm');
const TAGS_SANDBOX = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data', 'abra-tags.js'), 'utf8'), TAGS_SANDBOX,
                { filename: 'data/abra-tags.js' });
const TDB = TAGS_SANDBOX.window.ABRA_TAGS;
const PS_CLASSES = ((TDB.moves.partingshot.params || {}).moveClass || {}).classes || [];
const ESP = (TDB.abilities.magicbounce.params || {}).reflectsStatusMoves || null;
ok(PS_CLASSES.indexOf('reflectable') >= 0 && !!ESP && (ESP.requiresFlag || 'reflectable') === 'reflectable',
   '`data/abra-tags.js` — the file the engine reads — joins them: partingshot.moveClass carries '
   + '`reflectable` and magicbounce.reflectsStatusMoves requires that flag',
   'partingshot classes ' + JSON.stringify(PS_CLASSES) + '   magicbounce ' + JSON.stringify(ESP));

/* ==================================================================================================
 * THE FOUR BOARDS
 * ================================================================================================== */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* Incineroar carries BLAZE and not Intimidate on purpose: an Intimidate on the lead would put a
 * second `-unboost|atk` on the very leaf these arms are read on. */
const A_SIDE = () => [mon('incineroar', '', 'Blaze', ['Parting Shot', 'U-turn', 'Taunt', 'Protect']),
                      mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'toxapex'));
/* Espeon clicks CALM MIND and not Protect: `protect`'s condition carries `onTryHitPriority: 3` and
 * Magic Bounce's `onTryHit` carries none, so a Protect would refuse the move ABOVE the ability and
 * every arm would be vacuous. Measured, not assumed — the priority is in `data/moves.ts`. */
const B_SIDE = (ab) => [mon('espeon', '', ab, ['Calm Mind', 'Protect']),
                        mon('kingambit', '', 'Defiant', ['Protect'])].concat(FILL('garchomp', 'corviknight'));

const SCEN = [
  { id: 'magic-bounce-returns-parting-shot',
    kind: 'ability', shape: 'a reflectable PIVOT comes back, and the pivot comes with it',
    census: 'ability/reflectsStatusMoves — data/abilities.ts magicbounce.onTryHit',
    what: 'Incineroar clicks Parting Shot at a Magic Bounce Espeon. The authority has Espeon USE '
        + 'Parting Shot back: Incineroar takes -1 Attack / -1 Special Attack and stays, and ESPEON '
        + 'switches out. This engine dropped Espeon and pivoted Incineroar — both halves backwards.',
    negative: 'arm 2 is the same board with the other legal ability; arm 3 is the same pivot without '
            + 'the flag; arm 4 is the same ability on a move that already bounced.',
    A: A_SIDE(), B: B_SIDE('Magic Bounce'),
    script: [
      { p1: [{ m: 'partingshot', t: 0 }, { m: 'protect' }], p2: [{ m: 'calmmind' }, { m: 'protect' }] },
    ] },

  { id: 'synchronize-espeon-takes-the-drop',
    kind: 'ability', shape: 'THE KNOB-CLEARED CONTROL — the same click, the other legal ability',
    census: 'ability/reflectsStatusMoves — the negative case',
    what: 'THE KNOB-CLEARED CONTROL, and the reason arm 1 means anything. The identical board and '
        + 'the identical click, with Espeon carrying SYNCHRONIZE — its other legal ability. Nothing '
        + 'reflects, so Espeon takes the drop and Incineroar pivots out. Identical results across '
        + 'this knob would say the ability is unwired, not that it does not matter.',
    negative: 'this arm IS the negative for arm 1.',
    A: A_SIDE(), B: B_SIDE('Synchronize'),
    script: [
      { p1: [{ m: 'partingshot', t: 0 }, { m: 'protect' }], p2: [{ m: 'calmmind' }, { m: 'protect' }] },
    ] },

  { id: 'uturn-is-not-reflectable',
    kind: 'ability', shape: 'THE OVER-FIRE CONTROL — a pivot with no `reflectable` flag',
    census: 'ability/reflectsStatusMoves — the `requiresFlag` clause',
    what: 'THE OVER-FIRE CONTROL. The same Incineroar clicks U-TURN at the same Magic Bounce Espeon. '
        + 'U-turn carries no `reflectable` flag, so the ability lets it through: Espeon takes the '
        + 'damage and INCINEROAR pivots. A fix keyed on "this move is a pivot" instead of on the flag '
        + 'would pass arm 1 and fail here.',
    negative: 'this arm IS a negative for arm 1.',
    A: A_SIDE(), B: B_SIDE('Magic Bounce'),
    script: [
      { p1: [{ m: 'uturn', t: 0 }, { m: 'protect' }], p2: [{ m: 'calmmind' }, { m: 'protect' }] },
    ] },

  { id: 'taunt-still-bounces',
    kind: 'ability', shape: 'THE ALREADY-RIGHT CONTROL — a reflectable move on a different branch',
    census: 'ability/reflectsStatusMoves — the standing case',
    what: 'THE ALREADY-RIGHT CONTROL. The same Incineroar clicks TAUNT at the same Magic Bounce '
        + 'Espeon. Taunt is reflectable and is NOT a pivot, so it takes a branch that has called '
        + '`bounceOff` since WIRE 33 and comes back at Incineroar. It must be identical clean AND '
        + 'under the restore knob — which is what says this defect was one shut door on one branch '
        + 'and not a broken ability.',
    negative: 'this arm is the proof the bounce machinery itself was never the defect.',
    A: A_SIDE(), B: B_SIDE('Magic Bounce'),
    script: [
      { p1: [{ m: 'taunt', t: 0 }, { m: 'protect' }], p2: [{ m: 'calmmind' }, { m: 'protect' }] },
    ] },
];

function counters() {
  const G = SB.harness();
  const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
  return { seen: Object.assign({}, M.MEDSEEN), fails: Object.assign({}, M.MEDFAILS) };
}

console.log('\n1. THE FOUR BOARDS, PLAYED AGAINST THE AUTHORITY');
const LIVE = new Set(['magic-bounce-returns-parting-shot']);
const deltas = {};
for (const sc of SCEN) {
  const c0 = counters();
  const r = SB.runOne(sc);
  const c1 = counters();
  deltas[sc.id] = {
    pivot: (c1.seen.pivotBouncedToTheBouncer || 0) - (c0.seen.pivotBouncedToTheBouncer || 0),
    announced: (c1.seen.bounceAnnounced || 0) - (c0.seen.bounceAnnounced || 0),
    knob: c1.fails.pivotIgnoresBounceRestored,
  };
  const detail = r.verdict === 'IDENTICAL' ? null
    : (r.why ? r.why : r.boards.map(b => (b.unexplained || [])
        .map(d => 'turn ' + b.turn + '  ' + d.path + '   ours ' + JSON.stringify(d.us)
                  + ' / authority ' + JSON.stringify(d.sd)).join('\n')).filter(Boolean).join('\n'));
  ok(r.verdict === 'IDENTICAL', sc.id + '  -> ' + r.verdict
     + (KNOB && LIVE.has(sc.id) ? '   [expected RED: the knob is armed]' : ''), detail);
  console.log('          leaves compared ' + (r.compared == null ? '(not staged)' : r.compared)
    + '   bounceAnnounced +' + deltas[sc.id].announced
    + '   pivotBouncedToTheBouncer +' + deltas[sc.id].pivot);
  ok(!r.script || r.script.moveNotOnRequest === 0,
     sc.id + ': every scripted click was on Showdown\'s own request',
     r.script ? JSON.stringify(r.script) : null);
}

/* ==================================================================================================
 * 2. THE ENGINE'S OWN RECEIPTS, PER ARM
 * ==================================================================================================
 * `bounceAnnounced` says the bounce HAPPENED; `pivotBouncedToTheBouncer` says the SWITCH changed
 * hands with it. They are counted apart because the second is the half that was missing after the
 * first was added, and a merged counter could not tell a half fix from a whole one. */
console.log('\n2. THE COUNTERS, AS A DELTA AROUND EACH ARM');
for (const sc of SCEN) console.log('     ' + sc.id.padEnd(38)
  + ' bounce +' + deltas[sc.id].announced + '   pivot-changed-hands +' + deltas[sc.id].pivot);
const L = deltas['magic-bounce-returns-parting-shot'];
ok(KNOB ? L.pivot === 0 : L.pivot === 1,
   'the pivot changed hands exactly once on the live arm' + (KNOB ? ' — and NOT AT ALL under the knob' : ''),
   'delta=' + L.pivot);
ok(KNOB ? L.announced === 0 : L.announced === 1,
   'and the bounce itself was announced exactly once there',
   'delta=' + L.announced);
ok(deltas['synchronize-espeon-takes-the-drop'].announced === 0
   && deltas['synchronize-espeon-takes-the-drop'].pivot === 0,
   'the SYNCHRONIZE arm bounced NOTHING — the ability knob moves the outcome, so arm 1 is not free',
   JSON.stringify(deltas['synchronize-espeon-takes-the-drop']));
ok(deltas['uturn-is-not-reflectable'].announced === 0
   && deltas['uturn-is-not-reflectable'].pivot === 0,
   'U-turn bounced NOTHING — the flag, not the pivot-ness, is what decides',
   JSON.stringify(deltas['uturn-is-not-reflectable']));
ok(deltas['taunt-still-bounces'].announced === 1 && deltas['taunt-still-bounces'].pivot === 0,
   'Taunt bounced (it always did) and moved NO pivot — a reflectable move that is not a pivot must '
   + 'not acquire one',
   JSON.stringify(deltas['taunt-still-bounces']));
ok(KNOB ? deltas['taunt-still-bounces'].knob === 1 : deltas['taunt-still-bounces'].knob === undefined,
   'the restore knob reports its own state, so a probe run with a dead knob cannot read as a pass',
   'pivotIgnoresBounceRestored=' + String(deltas['taunt-still-bounces'].knob));

console.log('\n' + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
