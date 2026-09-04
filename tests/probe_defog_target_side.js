#!/usr/bin/env node
/* tests/probe_defog_target_side.js — DEFOG SWEEPS THE **TARGET'S** SIDE, NOT "THE OTHER SIDE"
 * ==================================================================================================
 * THE SIDE-SELECTION CLASS AGAIN: A BAD SELECTOR HANDING A CORRECT PREDICATE THE WRONG BODY.
 *
 * `sweepField` (engine/medicham2-browser.js) is one implementation of "what does this click take off
 * the field", called from three places. Its second side argument is consumed by exactly one clause
 * that can tell the two sides apart — `screensFrom: 'target'`, which only `defog` carries — and by
 * the `hazardsFrom` bag list. Every call site handed it `m._sf === sfA ? sfB : sfA`: **the side the
 * MOVER is not on.** That is not what any of the three handlers say.
 *
 * ---- THE AUTHORITY, READ WHOLE (data/moves.ts `defog.onHit`; §0 greps the mod on every run) ------
 *
 *     onHit(target, source, move) {
 *       if (!target.volatiles['substitute'] || move.infiltrates) success = !!this.boost({evasion:-1});
 *       const removeAll    = ['spikes','toxicspikes','stealthrock','stickyweb','gmaxsteelsurge'];
 *       const removeTarget = ['reflect','lightscreen','auroraveil','safeguard','mist', ...removeAll];
 *       for (const c of removeTarget) if (TARGET.side.removeSideCondition(c)) { ... }   <-- TARGET
 *       for (const c of removeAll)    if (SOURCE.side.removeSideCondition(c)) { ... }   <-- SOURCE
 *       this.field.clearTerrain();
 *
 * `defog.target` is `"normal"` (derived from the format in §0, not typed), and `Battle#validTargetLoc`
 * asks only ADJACENCY for `normal` — so a negative targetLoc naming the PARTNER is a legal choice and
 * `target.side === source.side`. Two things follow that the old selector gets backwards:
 *
 *   - the screens come off the ALLY'S side, which is the user's own. The engine took them off the FOE.
 *   - `removeTarget ∪ removeAll` is target.side ∪ source.side, which for an ally aim is ONE side. The
 *     engine emptied both hazard bags, deleting hazards the opponent still has.
 *
 * AND THE SAME SELECTOR IS WRONG ON A COMMONER ROAD. Defog is `reflectable`, and Magic Bounce
 * (Hatterene, Espeon, three megas — derived in §0) re-uses it with the BOUNCER as source and the
 * original user as target. `bounceOff` returns the user, so `_tl` is the user's own body and
 * `target.side` is the user's side, while `source.side` is the bouncer's. The old selector had BOTH
 * halves wrong at once and they cancelled on hazards, which is why nothing caught it.
 *
 * ---- WHY THIS WAS SILENT, WHICH IS THE POINT OF FILING IT AS SIDE-SELECTION ---------------------
 *
 * Nothing throws. `sweepField` returns a count, every caller ignores it, and a sweep of the wrong
 * bag looks exactly like a sweep of the right one — five of the six historical members of this class
 * were an `indexOf` returning -1 that was read as "nothing here". A Defog that removes the wrong
 * side's Reflect still emits a plausible turn.
 *
 * ---- WHAT IS **NOT** WRONG, AND IS ASSERTED SO THE FIX CANNOT OVERREACH ------------------------
 *
 * The OTHER two `sweepField` call sites are NOT copies of this selection and must not be consolidated
 * with it. Read the handlers:
 *
 *   Tidy Up   `const sides = [pokemon.side, ...pokemon.side.foeSidesWithConditions()]`  — genuinely
 *             the user's side and the FOE's, and it is `target: 'self'`, so "the target's side" would
 *             collapse to one side and delete the fix. Its site keeps `the other side`.
 *   Rapid Spin / Mortal Spin  `hazardsFrom: 'self'`, so the second argument is never read at all.
 *             §0 derives that membership from `data/tags.json` rather than asserting it, so a new
 *             damaging carrier turns this red BY NAME instead of silently inheriting the assumption.
 *
 * RED-FIRST KNOB: `MEDI_DEFOG_FOE_SIDE_LEGACY=1` puts the old `m._sf === sfA ? sfB : sfA` selector
 * back at the one site that changed. Arms B and C go RED under it, arm A stays GREEN, and any run
 * carrying it also carries `MEDFAILS.defogFoeSideLegacyRestored === 1`.
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '12');

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

const KNOB = process.env.MEDI_DEFOG_FOE_SIDE_LEGACY === '1';
console.log('\ntests/probe_defog_target_side.js — Defog sweeps the TARGET\'s side');
console.log('  MEDI_DEFOG_FOE_SIDE_LEGACY=' + (KNOB ? '1  (PRE-FIX ENGINE)' : '0'));

/* ---- 0. THE AUTHORITY AND THE MEMBERSHIP, DERIVED ON EVERY RUN --------------------------------- */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const MODDIR = process.env.SHOWDOWN_PATH + '/data/mods/champions/';
const SIMDIR = process.env.SHOWDOWN_PATH + '/';

console.log('\n0. WHERE THE HANDLER LIVES, AND WHO CONSUMES THE ARGUMENT THAT MOVED');
const MODMOVES = fs.readFileSync(MODDIR + 'moves.ts', 'utf8');
ok(!/^\tdefog:/m.test(MODMOVES),
   'Champions carries no `defog` row — data/moves.ts is the authority for this handler',
   /^\tdefog:/m.test(MODMOVES) ? 'the mod DOES override it — read that block instead' : null);
const MOVES = fs.readFileSync(SIMDIR + 'data/moves.ts', 'utf8');
const DBLOCK = /\n\tdefog:\s*\{([\s\S]*?)\n\t\},/.exec(MOVES);
ok(!!DBLOCK && /target\.side\.removeSideCondition\(targetCondition\)/.test(DBLOCK[1]),
   'the authority removes the `removeTarget` list from **target.side**',
   DBLOCK ? null : 'the defog block did not parse — the citation is unverified');
ok(!!DBLOCK && /source\.side\.removeSideCondition\(sideCondition\)/.test(DBLOCK[1]),
   'and the hazard-only `removeAll` list from **source.side** — two sides, named separately',
   DBLOCK && /source\.side/.test(DBLOCK[1]) ? null : 'the source.side loop did not match');
ok(D.moves.get('defog').target === 'normal',
   'and `defog.target` is `normal`, which `validTargetLoc` allows to name the PARTNER — so '
   + 'target.side CAN be the user\'s own side',
   'derived: target=' + D.moves.get('defog').target);
const TIDY = /\n\ttidyup:\s*\{([\s\S]*?)\n\t\},/.exec(MOVES);
ok(!!TIDY && /\[pokemon\.side, \.\.\.pokemon\.side\.foeSidesWithConditions\(\)\]/.test(TIDY[1])
        && D.moves.get('tidyup').target === 'self',
   'Tidy Up names `pokemon.side` + the FOE sides and is `target: \'self\'` — a DIFFERENT selection, '
   + 'which is why its call site is not folded into this fix',
   TIDY ? null : 'the tidyup block did not parse');

/* THE MEMBERSHIP, DERIVED. Only a carrier with `screensFrom: 'target'` or `hazardsFrom` naming the
 * far side can tell the two sides apart at all, so this is the exact set the change can reach. */
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tags.json'), 'utf8'));
const CARRIERS = Object.entries(TAGS.moves)
  .map(([id, v]) => [id, (v.params || {}).removesHazards])
  .filter(([, p]) => !!p);
const SIDE_AWARE = CARRIERS.filter(([, p]) => p.screensFrom === 'target'
                                          || p.hazardsFrom === 'target' || p.hazardsFrom === 'both');
console.log('     removesHazards carriers: '
  + CARRIERS.map(([id, p]) => id + ' (' + D.moves.get(id).category + '/' + D.moves.get(id).target
      + ', hazardsFrom ' + p.hazardsFrom + (p.screensFrom ? ', screensFrom ' + p.screensFrom : '') + ')')
      .join('\n                              '));
ok(SIDE_AWARE.every(([id]) => D.moves.get(id).category === 'Status'),
   'every carrier that can tell the two sides apart is a STATUS move, so the DAMAGING branch\'s copy '
   + 'of this selection is unread and is deliberately left alone',
   SIDE_AWARE.filter(([id]) => D.moves.get(id).category !== 'Status').map(([id]) => id).join(', ') || null);
const SCREEN_CARRIERS = CARRIERS.filter(([, p]) => p.screensFrom === 'target');
ok(SCREEN_CARRIERS.length === 1 && SCREEN_CARRIERS[0][0] === 'defog',
   '...and `screensFrom: \'target\'` has exactly one carrier, `defog` — the blast radius of the '
   + 'screen half is one move',
   SCREEN_CARRIERS.map(([id]) => id).join(', '));
const BOUNCERS = D.species.all()
  .filter(s => s.exists && !s.isNonstandard && s.tier !== 'Illegal'
               && Object.values(s.abilities).includes('Magic Bounce'))
  .map(s => s.name);
console.log('     Magic Bounce in this regulation (derived): ' + BOUNCERS.join(', '));
ok(BOUNCERS.length > 0,
   'the bounce road that arm C stages exists in this format at all',
   BOUNCERS.length ? null : 'no legal Magic Bounce body — arm C is testing something unreachable');

/* ==================================================================================================
 * THE THREE BOARDS
 * ================================================================================================== */
const mon = (species, ability, moves) => ({ species, item: '', ability: ability || '', moves });

/* Corviknight learns BOTH Defog and Reflect (derived above the fixture by the learnset walk in
 * §0's spirit — the driver refuses an unlearnable click and `scriptMoveNotOnRequest` is asserted
 * below, so a bad build cannot pass silently). */
const P1 = () => [mon('corviknight', 'Pressure', ['Defog', 'Reflect', 'Protect']),
                  mon('clefable', 'Magic Guard', ['Stealth Rock', 'Calm Mind', 'Protect']),
                  mon('milotic', 'Marvel Scale', ['Protect']),
                  mon('gholdengo', 'Good as Gold', ['Protect'])];
const P2_PLAIN = () => [mon('garchomp', 'Rough Skin', ['Stealth Rock', 'Swords Dance', 'Protect']),
                        mon('weavile', 'Pressure', ['Protect']),
                        mon('milotic', 'Marvel Scale', ['Protect']),
                        mon('gholdengo', 'Good as Gold', ['Protect'])];
/* Hatterene sits on the BENCH and walks in on turn 2, because a Magic Bounce body standing on turn 1
 * would bounce Clefable's Stealth Rock and the fixture would never get hazards onto p2's side at all
 * — the arm would then be green for want of anything to sweep. */
const P2_BOUNCE = () => [mon('garchomp', 'Rough Skin', ['Stealth Rock', 'Swords Dance', 'Protect']),
                         mon('weavile', 'Pressure', ['Protect']),
                         mon('hatterene', 'Magic Bounce', ['Calm Mind', 'Protect']),
                         mon('gholdengo', 'Good as Gold', ['Protect'])];

/* TURN 1 IS THE SAME EVERYWHERE: p1 puts Reflect on its own side and Stealth Rock on p2's; p2 puts
 * Stealth Rock on p1's. Every arm therefore starts from a board with something to lose on BOTH
 * sides, which is the only way a wrong-side sweep is visible at all. */
const SETUP = { p1: [{ m: 'reflect' }, { m: 'stealthrock' }],
                p2: [{ m: 'stealthrock' }, { m: 'protect' }] };

const ARMS = [
  { id: 'defog-at-a-foe',
    governed: false,
    P2: P2_PLAIN,
    what: 'THE CONTROL. Corviknight Defogs the Garchomp opposite. target.side and "the side the '
        + 'mover is not on" are the SAME side here, so the old selector and the new one agree and '
        + 'this arm must be green before the change and after it. p1\'s Reflect survives (screens '
        + 'come off the TARGET\'s side, which is p2, and p2 has none); both Stealth Rocks go.',
    script: [SETUP,
             { p1: [{ m: 'defog', t: 0 }, { m: 'protect' }],
               p2: [{ m: 'swordsdance' }, { m: 'protect' }] }] },

  { id: 'defog-at-the-ally',
    governed: true,
    P2: P2_PLAIN,
    what: 'THE ALLY AIM. Corviknight Defogs its own Clefable. The authority sweeps target.side = p1: '
        + 'p1\'s Reflect AND p1\'s Stealth Rock go, and p2\'s Stealth Rock SURVIVES because '
        + 'source.side is p1 as well. The old selector took the screens off p2 (leaving p1\'s Reflect '
        + 'standing) and emptied p2\'s hazard bag (deleting rocks the opponent still had) — two board '
        + 'errors in opposite directions from one wrong argument.',
    script: [SETUP,
             { p1: [{ m: 'defog', ally: true }, { m: 'calmmind' }],
               p2: [{ m: 'swordsdance' }, { m: 'protect' }] }] },

  { id: 'defog-bounced-by-magic-bounce',
    governed: true,
    P2: P2_BOUNCE,
    what: 'THE BOUNCE, and it is the regression guard as much as a second red. Hatterene switches in '
        + 'on turn 2 and Corviknight Defogs it on turn 3; Magic Bounce sends the move back with the '
        + 'BOUNCER as source and Corviknight as target, so the authority sweeps p1\'s screens AND '
        + 'p1\'s hazards AND p2\'s hazards — everything. The old selector got the screens wrong and '
        + 'the hazards right; a fix that only read the target\'s side would get the screens right and '
        + 'the hazards WRONG, which is why the source side is tracked through the bounce rather than '
        + 'assumed to be the clicker\'s.',
    script: [SETUP,
             { p1: [{ m: 'protect' }, { m: 'protect' }],
               p2: [{ m: 'swordsdance' }, { sw: 'hatterene' }] },
             { p1: [{ m: 'defog', t: 1 }, { m: 'protect' }],
               p2: [{ m: 'swordsdance' }, { m: 'calmmind' }] }] },
];

/* ==================================================================================================
 * 1. PLAY THE THREE BOARDS AND READ THE SIDE STATE OFF THE DRIVER'S OWN COMPARATOR
 * ==================================================================================================
 * Nothing here recomputes a side condition. `onBoundary` hands back `board_state.js`'s own diff list,
 * which already compares `sides.pX.hazards.*` and `sides.pX.screens.*` for both engines — so the
 * probe cannot agree with itself about a rule it also implements.
 * ================================================================================================== */
const G = SB.harness();
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const RESULT = {};
console.log('\n1. THE BOARDS');
for (const arm of ARMS) {
  if (G.resetScriptCounters) G.resetScriptCounters();
  const sw0 = M.MEDSEEN.hazardSwept, sc0 = M.MEDSEEN.sideConditionSwept;
  const by0 = M.MEDSEEN.defogSweptTargetSide || 0, bo0 = M.MEDSEEN.defogSweptFromBouncerSide || 0;
  const a = G.buildPair(P1()), b = G.buildPair(arm.P2());
  const boards = [];
  const r = (!a || !b) ? { err: 'buildPair returned null', turns: 0 }
    : G.playGame(a, b, 'directed', 'defog-' + arm.id, { script: arm.script,
        onBoundary: (snap, t) => { boards.push({ t, diffs: (snap.diffs || []).slice() });
                                   snap.identical = true; snap.diffs = []; } });
  const sc = G.scriptCounters ? G.scriptCounters() : {};
  RESULT[arm.id] = { boards, err: r.err, turns: r.turns,
                     hz: M.MEDSEEN.hazardSwept - sw0, sc: M.MEDSEEN.sideConditionSwept - sc0,
                     tgtSide: (M.MEDSEEN.defogSweptTargetSide || 0) - by0,
                     bouncer: (M.MEDSEEN.defogSweptFromBouncerSide || 0) - bo0 };

  console.log('\n  [' + arm.id + ']' + (arm.governed && KNOB ? '   [expected RED: the knob is armed]' : ''));
  console.log('    ' + arm.what.replace(/(.{92}\s)/g, '$1\n    '));
  ok(!r.err && r.turns === arm.script.length,
     'the arm played its whole script',
     r.err ? r.err : (r.turns !== arm.script.length ? 'played ' + r.turns + ' of ' + arm.script.length : null));
  /* THE ANTI-VACUITY CHECKS. A probe whose click never reached the handler is green about nothing —
   * that happened on this batch's sibling when a fixture had the holder clicking Protect. */
  ok(!sc.moveNotOnRequest,
     'every scripted click was on Showdown\'s own request — no move silently became a `pass`',
     sc.moveNotOnRequest ? sc.moveNotOnRequest + ' refused; first: ' + sc.firstMissing : null);
  ok(!sc.allyAimRefused,
     'and the `{ ally: true }` aim was accepted rather than quietly coerced to a foe',
     sc.allyAimRefused ? sc.allyAimRefused + ' refused; first: ' + sc.allyAimFirst : null);
  ok(RESULT[arm.id].hz + RESULT[arm.id].sc > 0,
     'the sweep ACTUALLY FIRED on this board — the arm is not vacuous',
     'hazardSwept +' + RESULT[arm.id].hz + '  sideConditionSwept +' + RESULT[arm.id].sc
     + ' (a zero means Defog never reached sweepField and every reading below is about nothing)');

  const parted = boards.filter(x => x.diffs.length);
  for (const p of parted) console.log('    turn ' + p.t + '  '
    + p.diffs.map(d => d.path + ': medicham ' + d.medicham + ' vs showdown ' + d.showdown).join('\n              '));
  const want = arm.governed && KNOB;
  ok(want ? parted.length > 0 : parted.length === 0,
     want ? 'the board PARTS under the legacy selector — the wrong side was swept'
          : 'the board is IDENTICAL to the authority on every turn',
     want ? (parted.length ? null : 'boards identical under the knob — the restore is not reaching '
              + 'this site and the green above proves nothing')
          : (parted.length ? 'see the diff lines above' : null));
}

/* ==================================================================================================
 * 2. THE COUNTERS — WHICH SIDE WAS ACTUALLY CHOSEN, NOT WHICH ONE THE CODE MEANT TO CHOOSE
 * ==================================================================================================
 * `defogSweptTargetSide` counts only the calls where the target's side DIFFERS from "the side the
 * mover is not on" — so arm A must not move it and arms B and C must. A counter that ticked on every
 * Defog would be measuring "a Defog happened" and the discrimination would be fake.
 * ================================================================================================== */
console.log('\n2. THE COUNTERS');
for (const arm of ARMS) console.log('     [' + arm.id + ']  targetSideDiffered ' + RESULT[arm.id].tgtSide
  + '   sourceSideFromBouncer ' + RESULT[arm.id].bouncer);
ok(KNOB ? M.MEDFAILS.defogFoeSideLegacyRestored === 1 : M.MEDFAILS.defogFoeSideLegacyRestored === 0,
   'the restore knob reports its own state',
   'defogFoeSideLegacyRestored=' + M.MEDFAILS.defogFoeSideLegacyRestored);
ok(RESULT['defog-at-a-foe'].tgtSide === 0,
   'the foe-aimed arm moved NOTHING — the counter measures the SELECTION, not the sweep',
   'targetSideDiffered=' + RESULT['defog-at-a-foe'].tgtSide + ' — a non-zero would mean it fires on '
   + 'every Defog and the control below is meaningless');
ok(KNOB || RESULT['defog-at-the-ally'].tgtSide > 0,
   'the ally-aimed arm DID move it — the new selector is load-bearing on that board',
   'targetSideDiffered=' + RESULT['defog-at-the-ally'].tgtSide);
ok(KNOB || RESULT['defog-bounced-by-magic-bounce'].bouncer > 0,
   'and the bounced arm resolved its SOURCE side from the bouncer rather than from the clicker',
   'sourceSideFromBouncer=' + RESULT['defog-bounced-by-magic-bounce'].bouncer
   + ' — a zero means the bounce was not tracked and the hazard half of arm C is passing by luck');
ok(!M.MEDFAILS.sweepFieldNoTargetSide,
   'sweepField was never asked to sweep with no resolvable target side',
   M.MEDFAILS.sweepFieldNoTargetSideFirst || null);

console.log('\n' + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
