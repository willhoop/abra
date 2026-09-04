#!/usr/bin/env node
/* tests/probe_multiaccuracy_address.js — M1, THE MULTI-ACCURACY VOLLEY
 * ==================================================================================================
 * DOES A MULTI-ACCURACY VOLLEY LAND THE SAME NUMBER OF ARRIVALS AS THE AUTHORITY?
 *
 * EXACTLY TWO MOVES IN THIS REGULATION CARRY `multiaccuracy`, AND THAT IS DERIVED HERE RATHER THAN
 * TYPED — §0 walks `Dex.forFormat('gen9championsvgc2026regmb')` and refuses to run if the set is not
 * the pair the fixture stages. Today: `populationbomb` (10 hits, printed 90) and `tripleaxel` (3, 90).
 *
 * THE AUTHORITY, READ IN FULL: data/mods/champions/scripts.ts:482-506, inside `hitStepMoveHitLoop`.
 * Champions OVERRIDES that method (`data/mods/champions/scripts.ts:428`), so `sim/battle-actions.ts`
 * is a different game and is not the citation. Arrivals 2..n each take ONE `randomChance(accuracy,100)`
 * and the FIRST failure ends the volley — and `accuracy` there is the move's REAL accuracy, after the
 * stages, after `runEvent('ModifyAccuracy')` and after `runEvent('Accuracy')`.
 *
 * WHAT THIS FILE MEASURES, IN THREE LAYERS, EACH OF WHICH CAN FAIL ON ITS OWN:
 *
 *   §2/§3  THE ARM'S PREMISE. `engine/game_differential.js`'s middle arm gives both engines
 *          `value = FNV1a(seed|turn|category|move|target|nth)`, so a shared event must produce a
 *          shared STRING. These sections read the two address logs the ENGINES built — never a string
 *          this file recomputes — and assert medicham2 draws at no address the authority did not use.
 *          They were GREEN before the fix and are here because a green §4 over a mis-addressed die
 *          would be a coincidence rather than a result.
 *
 *   §4     THE OUTCOME. A Wide Lens carrier's volley, read off BOTH protocol streams' own
 *          `|-hitcount|` lines. Wide Lens is `onSourceModifyAccuracy` — the authority rolls each
 *          arrival at 99, this engine rolled the printed 90 — so a shared draw in [0.90, 0.99) makes
 *          the two engines land a different number of arrivals off the SAME die. The fixture is placed
 *          on turns and slots whose shared values sit in that band by construction; §4a prints them.
 *
 *   §5     THE CONTROL. The same two volleys with NO accuracy modifier on the field or the body. The
 *          two engines must agree there in BOTH knob states — otherwise §4 is measuring "volleys
 *          disagree" rather than "the accuracy modifier does not reach the volley".
 *
 * RED-FIRST KNOB: `MEDI_MULTIACC_RAW_ACC=1` puts the printed accuracy back into the per-arrival roll,
 * which is the pre-fix engine exactly. Under it §4 goes RED and §5 stays green.
 *
 * WHAT THIS FILE DOES NOT DO: it never recomputes an accuracy, a hit count or a hash and compares the
 * engine against its own stand-in. Every assertion is over strings and lines the two engines emitted.
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');

if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');

const GD = require(path.join(ROOT, 'engine', 'game_differential.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

const RAW = process.env.MEDI_MULTIACC_RAW_ACC === '1';
console.log('\ntests/probe_multiaccuracy_address.js — M1 multi-accuracy volley');
console.log('  release ' + GD.REL.id + '   MEDI_MULTIACC_RAW_ACC=' + (RAW ? '1  (PRE-FIX ENGINE)' : '0'));

/* ---- 0. THE MEMBER SET IS DERIVED --------------------------------------------------------------- */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard;
const MULTIACC = D.moves.all().filter(m => legal(m) && m.multiaccuracy)
  .map(m => ({ id: m.id, hits: m.multihit, acc: m.accuracy }));
console.log('\n0. THE `multiaccuracy` MEMBERS OF THIS REGULATION, WALKED AND PRINTED');
for (const m of MULTIACC) console.log('     ' + m.id + '  hits=' + JSON.stringify(m.hits) + '  acc=' + m.acc);
const IDS = MULTIACC.map(m => m.id).sort().join(',');
ok(IDS === 'populationbomb,tripleaxel',
   'the derived member set is exactly the pair this fixture stages',
   'derived `' + IDS + '` — if this moved, the fixture stages the wrong moves and every verdict '
   + 'below is about something else');
/* AND THE ITEM IS DERIVED TOO. Wide Lens is what makes §4 discriminating; if it left the format the
 * fixture would silently become the control. */
ok(legal(D.items.get('widelens')), 'Wide Lens is legal in this regulation',
   'isNonstandard=' + JSON.stringify(D.items.get('widelens').isNonstandard));

const MIDDLE = GD.ARM_BY_ID.get('middle');
if (!MIDDLE) { console.log('  FAIL  the `middle` arm is gone from game_differential'); process.exit(1); }
const mon = (species, moves, item) => ({ species, item: item || '', ability: '', moves });
const hitcounts = log => log.map(String).filter(l => /^\|-hitcount\|/.test(l))
  .map(l => l.split('|').pop().trim());

/* ==================================================================================================
 * THE FIXTURE
 * ==================================================================================================
 * Maushold is the ONLY legal carrier of Population Bomb; Weavile carries Triple Axel. Both attack
 * from side p1, so the address's TARGET field is a p2 slot and the turn/slot pairs below are the ones
 * whose shared value falls in the discriminating band:
 *
 *     turn 1, populationbomb -> p21   u(nth 0) = 0.9649
 *     turn 3, tripleaxel     -> p20   u(nth 0) = 0.9549
 *
 * Both are >= 0.90 (this engine's printed accuracy, so it STOPS) and < 0.99 (the authority's Wide Lens
 * accuracy, so it CONTINUES). Those two numbers are printed in §4a straight out of the address log
 * rather than trusted from this comment.
 *
 * THE TARGETS RESIST. Empoleon is Water/Steel (Normal x0.5) and Aggron is Steel/Rock (Ice x0.5), so a
 * ten-arrival volley does not end the game before turn 3 and the slot in the address does not move.
 * The p2 side clicks Protect on the turns it is not being hit, and Recover/Iron Defense otherwise —
 * never Protect INTO the volley, which would end the fixture above the die.
 */
const A = [mon('maushold', ['Population Bomb', 'Protect'], 'widelens'),
           mon('weavile', ['Triple Axel', 'Protect'], 'widelens'),
           mon('clefable', ['Protect']), mon('milotic', ['Protect'])];
const B = [mon('aggron', ['Iron Defense', 'Protect']), mon('empoleon', ['Iron Defense', 'Protect']),
           mon('toxapex', ['Protect']), mon('garchomp', ['Protect'])];
const SCRIPT = [
  { p1: [{ m: 'populationbomb', t: 1 }, { m: 'protect' }], p2: [{ m: 'irondefense' }, { m: 'irondefense' }] },
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'irondefense' }, { m: 'irondefense' }] },
  { p1: [{ m: 'protect' }, { m: 'tripleaxel', t: 0 }], p2: [{ m: 'irondefense' }, { m: 'irondefense' }] },
];
/* THE CONTROL IS THE SAME SCRIPT WITH NO WIDE LENS. Nothing else changes — same species, same moves,
 * same turns, same slots, therefore the SAME shared dice. */
const A_CTRL = A.map(m => ({ ...m, item: '' }));

const play = (sideA, sideB, script, tag) => {
  GD.midResetAddresses();
  const a = GD.buildPair(sideA), b = GD.buildPair(sideB);
  if (!a || !b) return { err: 'buildPair returned null for ' + (!a ? 'side A' : 'side B') };
  const r = GD.playGame(a, b, 'directed', tag, { script, arm: MIDDLE });
  return { r, addr: GD.midAddresses(), sd: GD.lastSdLog(), me: (r.mediTrace || []) };
};

const W = play(A, B, SCRIPT, 'm1-multiacc-widelens');

console.log('\n1. THE FIXTURE ACTUALLY RAN');
ok(!W.err && W.r && !W.r.err, 'the staged game did not throw', W.err || (W.r && W.r.err) || null);
ok(W.r && W.r.turns === SCRIPT.length, 'all scripted turns were played',
   'turns played ' + (W.r && W.r.turns) + ' of ' + SCRIPT.length
   + ' — a game that ends early stages nothing and looks exactly like one that agreed');

const rx = new RegExp('\\|any\\|(' + MULTIACC.map(m => m.id).join('|') + ')\\|p[12]\\d\\|');
const sdAcc = W.addr.sd.filter(s => rx.test(s));
const meAcc = W.addr.me.filter(s => rx.test(s));

console.log('\n2. BOTH ENGINES REACHED A PER-ARRIVAL ACCURACY DRAW');
ok(sdAcc.length > 0, 'the authority made at least one per-arrival accuracy draw',
   sdAcc.length ? null : 'NONE — the volley never got past arrival 1 on the authority, so this '
   + 'fixture stages nothing and §3 would pass on an empty set');
ok(meAcc.length > 0, 'medicham2 made at least one per-arrival accuracy draw',
   meAcc.length ? null : 'NONE — `rollHitsOf` never rolled, so the mechanic is absent rather than '
   + 'mispriced');

console.log('\n3. THE TWO ENGINES BUILT THE SAME ADDRESSES FOR THOSE DRAWS');
const meOnly = meAcc.filter(s => !W.addr.sd.includes(s));
const shared = meAcc.filter(s => W.addr.sd.includes(s));
ok(shared.length > 0, 'at least one per-arrival address is present on BOTH sides',
   'shared ' + shared.length + '\nmedicham2 ' + JSON.stringify(meAcc.slice(0, 6))
   + '\nauthority ' + JSON.stringify(sdAcc.slice(0, 6)));
/* A volley that runs LONGER on one side legitimately leaves the other with extra addresses. What may
 * never happen is medicham2 drawing where the authority never did — that is a die nobody shares. */
ok(meOnly.length === 0, 'medicham2 drew at NO per-arrival address the authority did not also use',
   meOnly.length ? meOnly.join('\n') : null);
console.log('     authority-only (expected when the volley ran longer there): '
  + sdAcc.filter(s => !W.addr.me.includes(s)).length);

/* ---- 4a. WHICH ADDRESS EACH VOLLEY'S ARRIVAL 2 LANDED ON --------------------------------------- */
console.log('\n4a. THE FIRST PER-ARRIVAL ADDRESS OF EACH VOLLEY — printed, not asserted on');
for (const m of MULTIACC) {
  const first = sdAcc.find(s => s.indexOf('|' + m.id + '|') >= 0);
  console.log('     ' + m.id + ': ' + (first || 'the authority took no per-arrival draw'));
}

console.log('\n4. THE ARRIVAL COUNT — read off both engines\' own `|-hitcount|` lines');
const sdHC = hitcounts(W.sd), meHC = hitcounts(W.me);
console.log('     authority : ' + (sdHC.join(' / ') || '(none)'));
console.log('     medicham2 : ' + (meHC.join(' / ') || '(none)'));
ok(sdHC.length === MULTIACC.length,
   'the authority announced one `-hitcount` per staged volley',
   'got ' + sdHC.length + ' for ' + MULTIACC.length + ' volleys — a missing line means a volley '
   + 'never ran and the comparison below is over the wrong set');
ok(sdHC.length === meHC.length && sdHC.every((v, i) => v === meHC[i]),
   'the two engines landed the SAME number of arrivals under a Wide Lens'
   + (RAW ? '   [expected RED: the knob is armed]' : ''),
   (sdHC.join(' / ') === meHC.join(' / ')) ? null
   : 'authority ' + JSON.stringify(sdHC) + '  medicham2 ' + JSON.stringify(meHC)
     + '\nThe die is shared and its addresses agree (§3), so a different count is a different '
     + 'ACCURACY: the authority rolls each arrival at 99 under a Wide Lens and this engine rolled '
     + 'the printed 90.');

/* ---- 5. THE CONTROL --------------------------------------------------------------------------- */
console.log('\n5. CONTROL — the identical script with NO Wide Lens must agree in BOTH knob states');
const C = play(A_CTRL, B, SCRIPT, 'm1-multiacc-control');
ok(!C.err && C.r && !C.r.err && C.r.turns === SCRIPT.length, 'the control fixture played every turn',
   C.err || (C.r && (C.r.err || ('turns ' + C.r.turns))));
const cSd = hitcounts(C.sd), cMe = hitcounts(C.me);
console.log('     authority : ' + (cSd.join(' / ') || '(none)'));
console.log('     medicham2 : ' + (cMe.join(' / ') || '(none)'));
ok(cSd.length > 0 && cSd.length === cMe.length && cSd.every((v, i) => v === cMe[i]),
   'with no accuracy modifier the two engines agree — so §4 is measuring the MODIFIER, not the volley',
   (cSd.join(' / ') === cMe.join(' / ')) ? null
   : 'authority ' + JSON.stringify(cSd) + '  medicham2 ' + JSON.stringify(cMe));
/* AND THE CONTROL MUST BE A DIFFERENT MEASUREMENT FROM §4, or it is agreeing for free. If the two
 * fixtures produce the same counts, the Wide Lens changed nothing on either engine and §4 could not
 * have gone red however broken the engine was. */
ok(cSd.join('/') !== sdHC.join('/'),
   'the Wide Lens moved the AUTHORITY\'s own counts — the knob under test is live',
   'control ' + JSON.stringify(cSd) + ' == wide-lens ' + JSON.stringify(sdHC)
   + '  — the item reached nothing, so §4 was a free pass');

/* ---- 6. THE ENGINE'S OWN RECEIPTS --------------------------------------------------------------- */
console.log('\n6. THE COUNTERS — a capability that cannot prove it ran is assumed broken');
/* THE SAME MODULE INSTANCE THE DIFFERENTIAL PLAYED WITH, not a fresh require of the live tree:
 * `REL.require` goes through Node's own cache on the frozen path, so this is the object whose counters
 * the two games above incremented. A second instance would read zeros and look like a dead wire. */
const MM = GD.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const S = MM.MEDSEEN || null, F = MM.MEDFAILS || null;
if (S && F) {
  console.log('     multiAccModifiedAccuracy ' + S.multiAccModifiedAccuracy
    + '   multiAccAccuracyMoved ' + S.multiAccAccuracyMoved
    + '   first: ' + (S.multiAccAccuracyMovedFirst || '-'));
  console.log('     multiAccStageArith ' + S.multiAccStageArith
    + '   multiAccNeverMisses ' + S.multiAccNeverMisses
    + '   multiHitAccuracyStopped ' + S.multiHitAccuracyStopped);
  console.log('     multiAccNoAccuracy ' + F.multiAccNoAccuracy
    + ' (' + (F.multiAccNoAccuracyFirst || '-') + ')'
    + '   multiAccRawAccRestored ' + F.multiAccRawAccRestored);
  ok(RAW ? F.multiAccRawAccRestored === 1 : F.multiAccRawAccRestored === 0,
     'the restore knob reports its own state', 'multiAccRawAccRestored=' + F.multiAccRawAccRestored);
  ok(RAW || S.multiAccModifiedAccuracy > 0,
     'the fix is wired: at least one volley rolled against `hitChance` rather than the printed value',
     'multiAccModifiedAccuracy=' + S.multiAccModifiedAccuracy + ' — a zero here with two volleys '
     + 'staged means `_stepAccuracy` never handed the accuracy over and the fix is a silent default');
  ok(RAW || S.multiAccAccuracyMoved > 0,
     'and at least one of those saw a DIFFERENT number than the printed accuracy',
     'multiAccAccuracyMoved=' + S.multiAccAccuracyMoved);
} else {
  ok(false, 'MEDSEEN / MEDFAILS are readable off the frozen engine',
     'the release does not export them, so no counter can be read and §6 is blind');
}

console.log('\n' + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
