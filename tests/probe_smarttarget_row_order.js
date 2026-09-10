#!/usr/bin/env node
/* tests/probe_smarttarget_row_order.js — A `smartTarget` VOLLEY IS RESOLVED ONE BODY AT A TIME
 *   node tests/probe_smarttarget_row_order.js        node tests/probe_smarttarget_row_order.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY'S OWN LOOP IS THE WHOLE ARGUMENT. `trySpreadMoveHit` walks its first six steps over
 * EVERY target and then hands the rest to `hitStepMoveHitLoop`, which for a `smartTarget` move takes
 * ONE target per iteration and runs the whole of `spreadMoveHit` on it:
 *
 *     if (move.smartTarget && targets.length > 1) {
 *       targetsCopy = [targets[hit - 1]];
 *       damage = [damage[hit - 1]];
 *     } else { targetsCopy = targets.slice(0); }
 *     [moveDamageThisHit, targetsCopy] = this.spreadMoveHit(targetsCopy, pokemon, move, moveData);
 *                                                   data/mods/champions/scripts.ts:467-518
 *
 * So dart 2 is priced AFTER dart 1's damage, its `DamagingHit` handlers and its secondaries. THIS
 * ENGINE'S DRIVER IS STEP-MAJOR — `for (const _step of _STEPS) for (const R of _rows)` — which is
 * right for a spread hit (`trySpreadMoveHit` really does walk all targets per step) and wrong here.
 *
 * MEASURED BEFORE A BYTE MOVED, release `c28ad0815782`, `pair-redirect-priority ...bo3-2654621676`
 * t8. Dragon Darts from a Dragapult into a Scovillain-Mega (SPICY SPRAY) and an Excadrill:
 *
 *     showdown  Scovillain 64->15 ; Dragapult is brn [Spicy Spray] ; Excadrill 137->122   (15)
 *     medicham  Excadrill resists ; Scovillain 64->15 ; Excadrill 137->107 (30) ; brn
 *
 * EXACTLY DOUBLE. Dragon Darts is Physical and a burn halves the attacker's Attack, so the
 * authority's second dart is thrown by a burned body and this engine's was not. Board leaf
 * `p1.party.excadrill.hp medi 107 / sd 122`.
 *
 * WHY SPICY SPRAY IS THE KNOB AND NOT A CONTACT ABILITY. Derived from `data/tags.json`, not chosen
 * by name: `punishesAttacker` holds thirteen abilities and Spicy Spray's params are
 * `trigger: 'anyHit'` with `inflicts: [{status:'burn', chance:1}]` — no contact requirement (Dragon
 * Darts has no contact flag) and NO DIE. Flame Body and Static are contact-only and 30%, so an arm
 * built on either would be a coin flip wearing a control's name. The one carrier in this regulation
 * is Scovillain-Mega, which is why the fixture megas.
 *
 * THE ARMS.
 *
 *   RED-1   Dragon Darts aimed at the SPICY SPRAY body, partner second  -> dart 2 must be HALVED.
 *   CTRL-A  the identical click at a Scovillain that did NOT mega       -> must HOLD in both arms.
 *           Same species, same bodies, same aim; the ONLY difference is the mega, so this is the
 *           knob cleared explicitly rather than a different fixture.
 *   CTRL-B  BREAKING SWIPE (a real spread move) into the same two bodies -> must HOLD in both arms.
 *           `trySpreadMoveHit` walks a spread hit step-major, so this arm is the one that fails if
 *           the fix reorders every multi-target move instead of only the split volley.
 *   CTRL-C  Dragon Darts aimed at the PARTNER, so the Spicy Spray body takes the SECOND dart
 *           -> must HOLD in both arms. Same bodies, same abilities, only the AIM differs: the
 *           reaction now happens with no arrival left after it, so order cannot matter. This is the
 *           arm that says the defect is ORDER and not "Spicy Spray is mispriced".
 *
 * EVERY ARM ASSERTS THE FIXTURE REACHED THE RULE FIRST: the mega must be accepted by the authority's
 * own request (`megaRefused` at 0), the split must have happened (`MEDSEEN.smartTargetSplit` up), the
 * row-major road must have been taken exactly on the arms that should take it
 * (`MEDSEEN.smartTargetRowMajor`), and the burn must actually be on the board in the arms that claim
 * it. Six self-tests in this repo were quiet rather than green.
 *
 * RED FIRST: `MEDI_SMARTTARGET_STEP_MAJOR=1` restores the single step-major walk exactly as it stood
 * before this file existed. Under `--red` RED-1 must PART and the three controls must NOT.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_SMARTTARGET_STEP_MAJOR = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
const M = REL.require('engine/medicham2-browser.js');
const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
const NL = String.fromCharCode(10);
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* ---- THE FIXTURE, DERIVED ------------------------------------------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
/* ROADMAP #565 — THE LEGALITY GATE ASKS THE VALIDATOR, NOT THE RAW ROWS. The prevo walk this line
 * replaced accepted any entry on the species or on a prevo whatever its SOURCE tag, so a move a prevo
 * learned by a gen-7 TM (`7M`, `7V`) read as legal here while `TeamValidator` refused it — which is how
 * illegal fixtures passed their own gates (tests/test-fixture-legality.js, batch 2).
 * `champions_sim.canLearn` IS `checkCanLearn`, cached per pair. */
const learns = (sp, mv) => CS.canLearn(sp, mv);

const PULT = ['dragapult', '', 'Clear Body', ['Dragon Darts', 'Breaking Swipe', 'Protect']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
/* THE REACTION BODY. Scovillain + Scovillainite is Spicy Spray; the SAME row without the stone is the
 * control, so the arms differ by the mega and by nothing else. */
const SCOV_MEGA = ['scovillain', 'Scovillainite', 'Chlorophyll', ['Giga Drain', 'Protect']];
const SCOV_BASE = ['scovillain', '', 'Chlorophyll', ['Giga Drain', 'Protect']];
/* THE SECOND DART'S BODY. Excadrill is Ground/Steel, so Steel RESISTS Dragon and it survives the
 * dart comfortably — which is what makes "halved" readable rather than "fainted". */
const EXCA = ['excadrill', '', 'Sand Rush', ['Protect', 'Iron Head']];

const PROT = { m: 'protect' };
/* THE REACTION BODY MUST NOT BRACE — Protect blocks the dart and the whole arm asks nothing. It aims
 * Giga Drain at the BRACED p1b instead, so it spends its action without moving a number read here. */
const IDLE = m => ({ m, t: 1 });
/* NEITHER FOE MAY BRACE. The first cut of this file had p2b click Protect and the whole probe asked
 * nothing: a shielded second body is `out` before `_stepDamage`, so the volley never SPLIT on either
 * side — `MEDSEEN.smartTargetSplit` read 0 on every arm and both engines agreed about a dart that
 * was never thrown. Both foes aim at the BRACED p1b instead. */
const P2 = mega => [Object.assign({ m: 'gigadrain', t: 1 }, mega ? { mega: true } : {}),
                    { m: 'ironhead', t: 1 }];

const CASES = [
  { name: 'RED-1   Dragon Darts at the SPICY SPRAY body first   [dart 2 must be HALVED]',
    part: true, mega: true, split: true, rowMajor: true, burn: true,
    A: [PULT, CLEF], B: [SCOV_MEGA, EXCA],
    what: 'Dart 1 burns the attacker. Dragon Darts is Physical, so the authority throws dart 2 at '
        + 'half Attack; this engine priced both darts before either landed.',
    script: [{ p1: [{ m: 'dragondarts', t: 0 }, PROT], p2: P2(true) }] },

  { name: 'CTRL-A  the same click at a Scovillain that did NOT mega   [must HOLD in BOTH arms]',
    part: false, mega: false, split: true, rowMajor: true, burn: false,
    A: [PULT, CLEF], B: [SCOV_BASE, EXCA],
    what: 'Identical species, identical aim, no Spicy Spray. Nothing changes between the darts, so '
        + 'the row-major walk must produce exactly what the step-major one produced. THE KNOB, '
        + 'CLEARED EXPLICITLY.',
    script: [{ p1: [{ m: 'dragondarts', t: 0 }, PROT], p2: P2(false) }] },

  { name: 'CTRL-B  BREAKING SWIPE, a real spread move, into the same two   [must HOLD in BOTH arms]',
    part: false, mega: true, split: false, rowMajor: false, burn: true,
    A: [PULT, CLEF], B: [SCOV_MEGA, EXCA],
    what: 'A spread hit IS walked step-major by the authority (`trySpreadMoveHit` runs each step over '
        + 'every target). This is the arm that fails if the fix reorders every multi-target move '
        + 'instead of only a split volley.',
    script: [{ p1: [{ m: 'breakingswipe' }, PROT], p2: P2(true) }] },

  { name: 'CTRL-C  Dragon Darts aimed at the PARTNER, reaction body takes dart 2   [must HOLD]',
    part: false, mega: true, split: true, rowMajor: true, burn: true,
    A: [PULT, CLEF], B: [SCOV_MEGA, EXCA],
    what: 'Same bodies, same abilities, only the AIM differs — the burn is raised by the LAST dart, '
        + 'so there is no arrival left for it to reach. THIS IS THE ARM THAT SAYS THE DEFECT IS '
        + 'ORDER and not that Spicy Spray is mispriced.',
    script: [{ p1: [{ m: 'dragondarts', t: 1 }, PROT], p2: P2(true) }] },
];

/* ---- LEGALITY AND THE FACTS EVERY ARM RESTS ON --------------------------------------------------- */
let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { bad(row[0] + ' is not in this format'); continue; }
  if (row[1] && !legal(dex.items.get(row[1]))) bad(row[1] + ' is not a legal item in this format');
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) bad(sp.name + ' does not have ' + row[2]);
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { bad(mv + ' is not in this format'); continue; }
    if (!learns(row[0], mv)) bad(sp.name + ' does not learn ' + m.name);
  }
}
{
  const TAGS = require(D('data', 'tags.json'));
  const dd = dex.moves.get('dragondarts');
  if (dd.smartTarget !== true) bad('Dragon Darts is no longer smartTarget: ' + JSON.stringify(dd.smartTarget));
  if (dd.category !== 'Physical') bad('Dragon Darts is ' + dd.category + ', so a burn would not halve it');
  if (!TAGS.moves.dragondarts || !TAGS.moves.dragondarts.params.smartTarget)
    bad('the derived tag smartTarget is gone from Dragon Darts — the engine splits on it');
  const bs = dex.moves.get('breakingswipe');
  if (!/^allAdjacent/.test(String(bs.target))) bad('Breaking Swipe is ' + bs.target + ', not a spread move');
  if (bs.smartTarget) bad('Breaking Swipe has become smartTarget; CTRL-B is no longer a control');
  /* SPICY SPRAY'S OWN PARAMS, READ OUT OF THE DERIVED ARTIFACT. `anyHit` and `chance: 1` are what
   * make this arm deterministic; a contact-gated or 30% ability would be a coin flip. */
  const ss = TAGS.abilities.spicyspray && TAGS.abilities.spicyspray.params.punishesAttacker;
  if (!ss) bad('Spicy Spray no longer carries punishesAttacker');
  else {
    if (ss.trigger !== 'anyHit') bad('Spicy Spray trigger is ' + ss.trigger + ', not anyHit — Dragon Darts has no contact flag');
    const inf = (ss.inflicts || [])[0];
    if (!inf || inf.status !== 'burn') bad('Spicy Spray no longer inflicts a burn: ' + JSON.stringify(ss.inflicts));
    if (inf && +inf.chance !== 1) bad('Spicy Spray burn chance is ' + inf.chance + ', not 1 — this arm would be a die');
  }
  const sm = dex.species.get('scovillainmega');
  if (!legal(sm)) bad('Scovillain-Mega is not in this format');
  if (dex.abilities.get(Object.values(sm.abilities)[0]).id !== 'spicyspray')
    bad('Scovillain-Mega\'s ability is ' + JSON.stringify(sm.abilities) + ', not Spicy Spray');
  if (Object.values(dex.species.get('scovillain').abilities).map(a => dex.abilities.get(a).id).includes('spicyspray'))
    bad('base Scovillain now has Spicy Spray, so CTRL-A is no longer the knob cleared');
  /* THE ATTACKER MUST NOT BE IMMUNE TO THE BURN, and Spicy Spray's own params name the exemption. */
  if (dex.species.get('dragapult').types.includes('Fire'))
    bad('Dragapult is Fire-typed, and Spicy Spray exempts a Fire attacker');
  /* THE SECOND DART'S BODY MUST BE ABLE TO TAKE ONE AND LIVE. */
  if (!dex.getImmunity('Dragon', dex.species.get('excadrill').types))
    bad('Excadrill is immune to Dragon, so dart 2 lands on nothing');
  if (dex.getEffectiveness('Dragon', dex.species.get('excadrill').types) >= 0)
    bad('Excadrill no longer resists Dragon — it may not survive the dart');
  for (const c of CASES) for (const row of c.B) {
    const sp = dex.species.get(row[0]);
    const mx = Math.floor(Math.floor(2 * sp.baseStats.hp + 31) * 50 / 100) + 50 + 10;
    if (mx === 100) bad(sp.name + ' has a max HP of exactly 100, which breaks the -damage read');
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
/* The authority writes every `-damage` twice — `cur/maxhp` for the owner and `cur/100` for the
 * observer — and medicham2's trace carries the first form only. Keep the largest denominator, and
 * drop anything carrying a `[from]` tag (a residual, a recoil) so only the move's own hits are read. */
const dmgOf = (lines, who) => {
  const re = new RegExp('^\\|-damage\\|' + who);
  const rows = lines.filter(l => re.test(String(l)) && String(l).indexOf('|[from]') < 0)
    .map(l => { const m = /\|(\d+)\/(\d+)/.exec(String(l)); return m ? { hp: +m[1], max: +m[2] } : null; })
    .filter(x => x != null);
  if (!rows.length) return [];
  const mx = Math.max(...rows.map(r => r.max));
  return rows.filter(r => r.max === mx).map(r => r.hp);
};
const burned = lines => lines.some(l => /^\|-status\|p1a[^|]*\|brn/i.test(String(l)));

console.log((RED ? 'RED ARM — MEDI_SMARTTARGET_STEP_MAJOR=1 (the engine as it stood before this file)'
                 : 'CLEAN ARM') + NL);

const b0 = { split: SEEN.smartTargetSplit | 0, rowMajor: SEEN.smartTargetRowMajor | 0,
             notFound: FAILS.smartTargetSegmentNotFound | 0 };

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(BENCH('milotic', 'toxapex')));
  const b = G.buildPair(stage(c.B).concat(BENCH('toxapex', 'milotic')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const sp0 = SEEN.smartTargetSplit | 0, rm0 = SEEN.smartTargetRowMajor | 0;
  const r = G.playGame(a, b, 'directed', 'probe_smarttarget_row_order :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdL = G.lastSdLog(), meL = r.mediTrace || [];
  /* p2b IS THE BODY THE ORDER MOVES. In RED-1 and CTRL-A it takes dart 2; in CTRL-C it takes dart 1.
   * Both sides of the pair are read, because a fix that moved the wrong one would still "differ". */
  const sdA = dmgOf(sdL, 'p2a'), meA = dmgOf(meL, 'p2a');
  const sdB = dmgOf(sdL, 'p2b'), meB = dmgOf(meL, 'p2b');
  const split = (SEEN.smartTargetSplit | 0) - sp0, rowMajor = (SEEN.smartTargetRowMajor | 0) - rm0;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  p2a ' + JSON.stringify(sdA) + '   p2b ' + JSON.stringify(sdB)
    + '   attacker burned: ' + burned(sdL));
  console.log('    medicham  p2a ' + JSON.stringify(meA) + '   p2b ' + JSON.stringify(meB)
    + '   attacker burned: ' + burned(meL));
  console.log('    MEDSEEN.smartTargetSplit +' + split + '   .smartTargetRowMajor +' + rowMajor);

  /* ---- THE FIXTURE REACHED THE RULE ------------------------------------------------------------- */
  claim(sdA.length > 0 && sdB.length > 0,
    c.name + ' — the AUTHORITY put damage on BOTH bodies',
    'p2a ' + JSON.stringify(sdA) + '   p2b ' + JSON.stringify(sdB));
  claim(burned(sdL) === !!c.burn && burned(meL) === !!c.burn,
    c.name + ' — the attacker is ' + (c.burn ? 'BURNED' : 'NOT burned') + ' on BOTH sides',
    'showdown ' + burned(sdL) + ', medicham ' + burned(meL));
  claim((split > 0) === !!c.split,
    c.name + ' — the click ' + (c.split ? 'SPLIT' : 'did NOT split') + ' across two bodies',
    'MEDSEEN.smartTargetSplit +' + split);
  /* THE ROAD, NOT THE OUTCOME. In the RED arm the row-major walk is switched off, so this counter
   * must read zero everywhere — which is the only proof the knob reached the driver. */
  claim(rowMajor === (RED ? 0 : (c.rowMajor ? 1 : 0)),
    c.name + ' — the ' + (RED ? 'RED arm took NO row-major walk'
                              : (c.rowMajor ? 'volley was walked ROW-MAJOR' : 'click stayed STEP-MAJOR')),
    'MEDSEEN.smartTargetRowMajor +' + rowMajor);
  const koLines = meL.filter(l => /^\|faint\|/.test(String(l))).length
                + sdL.filter(l => /^\|faint\|/.test(String(l))).length;
  claim(koLines === 0, c.name + ' — nobody fainted', koLines + ' faint line(s) across the two streams');

  /* ---- THE OUTCOME ----------------------------------------------------------------------------- */
  const same = JSON.stringify(sdA) === JSON.stringify(meA) && JSON.stringify(sdB) === JSON.stringify(meB);
  claim(same === (RED ? !c.part : true),
    c.name + ' — the two engines leave BOTH bodies on the same HP'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    same ? 'identical'
         : 'showdown p2a ' + JSON.stringify(sdA) + ' p2b ' + JSON.stringify(sdB)
           + '  vs  medicham p2a ' + JSON.stringify(meA) + ' p2b ' + JSON.stringify(meB));

  /* ---- AND THE BOARD LEAF THE DIFFERENTIAL READS ----------------------------------------------- */
  const boardSame = !r.stateDiv;
  claim(boardSame === (RED ? !c.part : true),
    c.name + ' — the BOARD at the turn boundary'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    boardSame ? 'identical at every boundary'
              : 'parts at t' + r.stateDiv.turn + ': ' + JSON.stringify(r.stateDiv.diffs.slice(0, 3)));
}

/* ---- THE ENGINE'S OWN RECEIPTS ------------------------------------------------------------------- */
console.log(NL + '  MEDSEEN.smartTargetSplit ' + ((SEEN.smartTargetSplit | 0) - b0.split)
  + '   .smartTargetRowMajor ' + ((SEEN.smartTargetRowMajor | 0) - b0.rowMajor));
console.log('  MEDFAILS.smartTargetStepMajorRestored ' + (FAILS.smartTargetStepMajorRestored | 0)
  + '   .smartTargetSegmentNotFound ' + ((FAILS.smartTargetSegmentNotFound | 0) - b0.notFound));

/* THE SEGMENT LOOKUP IS NOT ALLOWED TO FAIL. It falls back to the single walk, which is the fix
 * quietly doing nothing — the exact shape a green probe would hide. */
claim(((FAILS.smartTargetSegmentNotFound | 0) - b0.notFound) === 0,
  'the driver found its own segment boundaries in _STEPS on every split volley',
  'smartTargetSegmentNotFound +' + ((FAILS.smartTargetSegmentNotFound | 0) - b0.notFound));

if (RED) {
  claim((FAILS.smartTargetStepMajorRestored | 0) === 1,
    'the RED arm actually ran with the knob — a restore that did not fire is a green arm in a red name',
    'MEDFAILS.smartTargetStepMajorRestored = ' + (FAILS.smartTargetStepMajorRestored | 0));
} else {
  claim((FAILS.smartTargetStepMajorRestored | 0) === 0,
    'the CLEAN arm did NOT carry the restore knob',
    'MEDFAILS.smartTargetStepMajorRestored = ' + (FAILS.smartTargetStepMajorRestored | 0));
  claim(((SEEN.smartTargetRowMajor | 0) - b0.rowMajor) === 3,
    'three of the four arms took the row-major road — a zero would mean the wire never fired',
    'MEDSEEN.smartTargetRowMajor +' + ((SEEN.smartTargetRowMajor | 0) - b0.rowMajor));
}
{
  const sc = G.scriptCounters();
  claim((sc.moveNotOnRequest | 0) === 0, 'every scripted click was on the authority\'s request',
    'moveNotOnRequest = ' + sc.moveNotOnRequest + (sc.firstMissing ? '  (' + sc.firstMissing + ')' : ''));
  claim((sc.megaRefused | 0) === 0, 'every mega this probe asked for was accepted by the authority',
    'megaRefused = ' + sc.megaRefused);
}

console.log(NL + (fails ? 'RED   ' + fails + ' failing claim(s).' : 'GREEN  every claim held.'));
process.exit(fails ? 1 : 0);
