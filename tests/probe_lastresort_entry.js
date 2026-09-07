#!/usr/bin/env node
/* tests/probe_lastresort_entry.js — LAST RESORT'S PRECONDITION IS PER STAY ON THE FIELD
 *   node tests/probe_lastresort_entry.js        node tests/probe_lastresort_entry.js --red
 * ==================================================================================================
 *
 * THE RULE, READ RATHER THAN RECALLED. `lastresort.onTry` walks the user's slots and refuses the
 * move unless every OTHER one is `used` (data/moves.ts:10069-10088; the Champions mod overrides
 * neither the move nor the flag — `grep lastresort data/mods/champions/moves.ts` is empty). And
 * `moveSlot.used` is the ONLY field in that object with a reader outside `deductPP`:
 *
 *     grep -rn "moveSlot.used" sim/ data/   ->   data/moves.ts:10086, and nothing else
 *
 * IT IS CLEARED ON EVERY ENTRY, AND PP IS NOT:
 *
 *     pokemon.activeTurns = 0;
 *     pokemon.activeMoveActions = 0;
 *     for (const moveSlot of pokemon.moveSlots) { moveSlot.used = false; }
 *                                              sim/battle-actions.ts:136-140, inside `switchIn`
 *
 * `deductPP` sets `ppData.used = true` ABOVE its own `if (!ppData.pp) return 0` (sim/pokemon.ts:898),
 * so a click on an empty slot still marks it — and the mark dies the next time the body walks in.
 *
 * STAGED IN THE AUTHORITY ALONE BEFORE A BYTE OF THIS ENGINE MOVED, with no ABRA code in the path:
 *
 *     Fake Out used, NO switch          fakeout=USED     ->  |move|…|Last Resort|p2a: …   LANDS
 *     Fake Out never used               fakeout=unused   ->  |move|…|[still]  |-fail|     FAILS
 *     Fake Out used, switch out+back    fakeout=unused, pp 11/12  ->  |[still]  |-fail|   FAILS
 *
 * The third row is the whole finding: the slot is BELOW its maximum and NOT used.
 *
 * WHAT THIS ENGINE DID. The gate read `ppSpentMap` — PP spent for the whole battle — under a comment
 * asserting *"`used` IS `spent > 0` HERE, AND THAT EQUIVALENCE IS THE FORMAT'S"*. It is not. Measured
 * on the pinned pool, release `c28ad0815782`, `omit-spread ...bo3-2662243229` t11: a Kangaskhan whose
 * only two moves are Fake Out and Last Resort used Fake Out on t8, pivoted out on t9, came back as a
 * faint replacement at the end of t10, and on t11 the authority printed `|-fail|p1a: Kangaskhan`
 * while this engine landed a 140 BP Normal move. Board leaf `p2.party.kingambit.hp medi 14 / sd 65`.
 *
 * THE ARMS, AND WHAT EACH ONE REFUSES.
 *
 *   RED-1   Fake Out, then OUT and BACK, then Last Resort   -> must FAIL. The defect.
 *   CTRL-A  Fake Out, then Last Resort, NO switch           -> must LAND. This is the arm that says
 *           the knob reached the RULE and not merely "Last Resort is broken": if the fix refused the
 *           move everywhere, CTRL-A goes red.
 *   CTRL-B  Last Resort on turn one, nothing used           -> must FAIL in both arms. Without it,
 *           deleting the gate outright would pass RED-1 under --red and be caught nowhere.
 *   CTRL-C  OUT and BACK, then Fake Out, then Last Resort   -> must LAND. The marks are re-earned
 *           after the entry, so this proves the clear is an ENTRY event and not a switch curse.
 *
 * EVERY ARM ASSERTS THE FIXTURE REACHED THE RULE BEFORE IT ASSERTS ANYTHING ELSE: the click must be
 * on Showdown's request (`scriptMoveNotOnRequest` at 0), the switch arms must actually have moved a
 * body (`MEDSEEN.slotUsedClearedOnEntry` above zero), and the user must still be alive to click.
 * Six self-tests in this repo were quiet rather than green.
 *
 * THE OUTCOME AND NOT THE CLASSIFICATION: what is compared is the TARGET'S HP at the end of the
 * scripted game and the board leaf the differential itself reads — never the presence of a `-fail`
 * line, which both engines could get right while dealing different damage.
 *
 * RED FIRST: `MEDI_LASTRESORT_BATTLE_USED=1` restores the PP reading exactly as it stood before this
 * file existed. Under `--red` RED-1 must PART and the three controls must NOT.
 * ================================================================================================ */
'use strict';
/* THE KNOB IS SET BEFORE ANY REQUIRE — it is read once at medicham2's module load, and
 * `game_differential.js` loads medicham2 at ITS require time. */
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_LASTRESORT_BATTLE_USED = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
/* `--state` BEFORE THE REQUIRE, or `playGame` never fills `r.stateDiv` and every board claim below
 * is vacuous. Batch I lost two probes to exactly this. */
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

/* ---- THE FIXTURE, DERIVED. Nothing here is typed from memory. ------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};

/* THE USER CARRIES EXACTLY TWO MOVES, WHICH IS THE POOL'S OWN KANGASKHAN
 * (`omit-spread ...bo3-2662243229`, built for both engines as `fakeout, lastresort`). Two is the
 * minimum `onTry` accepts (`moveSlots.length < 2` returns false) and it makes the arm unambiguous:
 * there is exactly ONE other slot to have used. Scrappy, not the mega stone — the scripted chooser
 * never megas, and Parental Bond would put a second arrival into the HP reading. */
const KANG = ['kangaskhan', '', 'Scrappy', ['Fake Out', 'Last Resort']];
/* THE TARGET MUST SURVIVE 140 BP OF NORMAL IN BOTH ARMS, or "it fainted" and "the move failed" leave
 * the same HP reading and the probe asks nothing. Corviknight is Flying/Steel — Steel resists Normal
 * — and is asserted below to take a resisted hit. */
const CORV = ['corviknight', '', 'Pressure', ['Protect', 'Iron Defense']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
/* THE BODY THE USER PIVOTS TO. Milotic is what the arrival probe's bench uses and builds cleanly. */
const MILO = ['milotic', '', 'Marvel Scale', ['Protect', 'Scald']];

const PROT = { m: 'protect' };
/* p1b and p2b both brace. p2a — the target this probe reads — spends its action on IRON DEFENSE, a
 * SELF-targeted boost, so nothing on the board can damage p1a or p1b for the whole arm and no faint
 * can end a script early. `t: 1` is written for shape and is IGNORED by the encoder for a `self`
 * move, which is deliberate: the arm must not depend on where it aims.
 *
 * IT DOES RAISE Def EVERY TURN, and that is stated rather than hidden — the arms therefore have
 * DIFFERENT absolute damage numbers (CTRL-A reads 47, CTRL-C reads 18, because CTRL-C spent two more
 * turns under the boost). Nothing here compares one arm's number to another's; every claim is
 * showdown-against-medicham inside ONE arm, where both engines see the same stack. */
const IDLE = m => ({ m, t: 1 });
const LR = { m: 'lastresort', t: 0 };
const FO = { m: 'fakeout', t: 0 };
const OUT = { sw: 'milotic' };
const BACK = { sw: 'kangaskhan' };
const FOE = [IDLE('irondefense'), PROT];
const TURN = p1 => ({ p1, p2: FOE });

const CASES = [
  { name: 'RED-1   Fake Out, OUT and BACK, then Last Resort   [must FAIL]',
    part: true, lands: false, entries: true, expect: 1, p1aSwitches: 3,
    what: 'switchIn clears every `used` mark. The slot is below its maximum and unused, so the '
        + 'authority refuses the move; this engine read PP spent and landed 140 BP.',
    script: [TURN([FO, PROT]), TURN([OUT, PROT]), TURN([BACK, PROT]), TURN([LR, PROT])] },

  { name: 'CTRL-A  Fake Out, then Last Resort, NO switch   [must LAND]',
    part: false, lands: true, entries: false, expect: 2, p1aSwitches: 1,
    what: 'The identical unlock with the switch removed. THIS IS THE ARM THAT SAYS THE KNOB REACHED '
        + 'THE RULE: a fix that simply refused Last Resort would pass RED-1 and fail here.',
    script: [TURN([FO, PROT]), TURN([LR, PROT])] },

  { name: 'CTRL-B  Last Resort on turn one, nothing used   [must FAIL in BOTH arms]',
    part: false, lands: false, entries: false, expect: 0, p1aSwitches: 1,
    what: 'The gate as it already worked. Carried because deleting the precondition outright would '
        + 'pass RED-1 under --red and be caught by nothing else here.',
    script: [TURN([LR, PROT])] },

  { name: 'CTRL-C  OUT and BACK, then Fake Out, then Last Resort   [must LAND]',
    part: false, lands: true, entries: false, expect: 2, p1aSwitches: 3,
    what: 'The mark is re-earned AFTER the entry. This is the arm that says the clear is an ENTRY '
        + 'event rather than "a body that has ever switched can never use Last Resort".',
    script: [TURN([OUT, PROT]), TURN([BACK, PROT]), TURN([FO, PROT]), TURN([LR, PROT])] },
];

/* ---- LEGALITY AND THE FACTS EVERY ARM RESTS ON, ASKED OF THE FORMAT ------------------------------ */
let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
for (const row of [KANG, CORV, CLEF, MILO]) {
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
  const lr = dex.moves.get('lastresort');
  if (typeof lr.onTry !== 'function') bad('Last Resort no longer carries an onTry precondition');
  if (lr.category !== 'Physical') bad('Last Resort is ' + lr.category + ', so the HP reading is not damage');
  const TAGS = require(D('data', 'tags.json'));
  const p = TAGS.moves.lastresort && TAGS.moves.lastresort.params
         && TAGS.moves.lastresort.params.failsUnlessOtherMovesUsed;
  if (!p) bad('the derived tag failsUnlessOtherMovesUsed is gone from Last Resort — the engine gate reads it');
  if (p && (+p.minSlots || 2) !== 2) bad('failsUnlessOtherMovesUsed.minSlots is ' + p.minSlots + ', not 2');
  /* KANGASKHAN CARRIES EXACTLY TWO SLOTS, which is what makes "every OTHER slot" a single fact. */
  if (KANG[3].length !== 2) bad('the user no longer carries exactly two moves');
  /* THE TARGET RESISTS AND SURVIVES. Both asserted rather than assumed. */
  if (dex.getEffectiveness('Normal', dex.species.get('corviknight').types) >= 0)
    bad('Normal is no longer resisted by Corviknight, so the target may not survive the hit');
  if (dex.species.get('corviknight').types.includes('Ghost'))
    bad('Corviknight has become Ghost-typed; Scrappy would then be the variable rather than the gate');
  /* A max HP of exactly 100 collapses the authority's two `-damage` series onto each other. */
  for (const row of [KANG, CORV, MILO]) {
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
 * observer — and medicham2's trace carries the first form only. Keep the largest denominator. */
const hpOf = (lines, who) => {
  const re = new RegExp('^\\|-damage\\|' + who);
  const rows = lines.filter(l => re.test(String(l)))
    .map(l => { const m = /\|(\d+)\/(\d+)/.exec(String(l)); return m ? { hp: +m[1], max: +m[2] } : null; })
    .filter(x => x != null);
  if (!rows.length) return [];
  const mx = Math.max(...rows.map(r => r.max));
  return rows.filter(r => r.max === mx).map(r => r.hp);
};

console.log((RED ? 'RED ARM — MEDI_LASTRESORT_BATTLE_USED=1 (the engine as it stood before this file)'
                 : 'CLEAN ARM') + NL);

const b0 = { marked: SEEN.slotUsedMarked | 0, cleared: SEEN.slotUsedClearedOnEntry | 0,
             refused: SEEN.lastResortRefused | 0, notOnReq: G.scriptCounters ? 0 : 0 };

for (const c of CASES) {
  const a = G.buildPair(stage([KANG, CLEF]).concat(BENCH('milotic', 'incineroar')));
  const b = G.buildPair(stage([CORV, CLEF]).concat(BENCH('toxapex', 'milotic')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const cl0 = SEEN.slotUsedClearedOnEntry | 0, rf0 = SEEN.lastResortRefused | 0;
  const r = G.playGame(a, b, 'directed', 'probe_lastresort_entry :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdL = G.lastSdLog(), meL = r.mediTrace || [];
  const sdD = hpOf(sdL, 'p2a'), meD = hpOf(meL, 'p2a');
  const cleared = (SEEN.slotUsedClearedOnEntry | 0) - cl0;
  const refused = (SEEN.lastResortRefused | 0) - rf0;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  target HP after each -damage: ' + JSON.stringify(sdD));
  console.log('    medicham  target HP after each -damage: ' + JSON.stringify(meD));
  console.log('    MEDSEEN.slotUsedClearedOnEntry +' + cleared
    + '   .lastResortRefused +' + refused + '   stop: ' + r.endReason);

  /* ---- THE FIXTURE REACHED THE RULE, BEFORE ANY EQUALITY IS ASSERTED --------------------------- */
  /* 1. THE AUTHORITY DID WHAT THE ARM SAYS IT DOES. If this is wrong the arm is mislabelled and
   *    every claim under it is about something else. */
  claim(sdD.length === c.expect,
    c.name + ' — the AUTHORITY ' + (c.lands ? 'LANDED' : 'REFUSED') + ' the move, and the '
      + 'whole arm dealt exactly ' + c.expect + ' -damage line(s) to the target',
    'showdown -damage lines on the target: ' + JSON.stringify(sdD));
  /* THE PIVOT ACTUALLY HAPPENED. A switch arm whose switches were refused is a control wearing the
   * wrong name, and `{ sw: ... }` resolves to a silent `pass` when the ask is illegal. */
  /* THE AUTHORITY WRITES EVERY `|switch|` TWICE, exactly as it writes every `-damage` twice — once
   * in `cur/maxhp` for the owning side and once in `cur/100` for the observer. The `/100` copy is
   * dropped BY ITS DENOMINATOR — not by the string `100/100`, which only matches a body that walks
   * in at full HP and would have counted RED-1's wounded re-entry twice. The fixture above already
   * refuses a body whose real max HP is 100, where the two forms coincide. Counting raw gave 6 for
   * a two-pivot arm and 2 for a no-pivot one. */
  const sw = sdL.filter(l => {
    if (!/^\|switch\|p1a:/.test(String(l))) return false;
    const d = /\|(\d+)\/(\d+)/.exec(String(l));
    return !!d && +d[2] !== 100;            // drop the observer's percentage copy
  }).length;
  claim(sw === c.p1aSwitches, c.name + ' — p1a entered the field ' + c.p1aSwitches + ' time(s)',
    '|switch|p1a: entries in the authority stream: ' + sw);
  /* 2. THE SWITCH ARMS ACTUALLY MOVED A BODY THAT WAS CARRYING MARKS. A zero here means the pivot
   *    never happened and RED-1 would be a control wearing a red name. */
  if (c.entries) {
    claim(cleared > 0, c.name + ' — a body arrived carrying `used` marks and lost them',
      'MEDSEEN.slotUsedClearedOnEntry +' + cleared);
  }
  /* 3. NOBODY FAINTED, so "no damage" means "the move failed" and not "the target is gone". */
  const koLines = meL.filter(l => /^\|faint\|/.test(String(l))).length
                + sdL.filter(l => /^\|faint\|/.test(String(l))).length;
  claim(koLines === 0, c.name + ' — nobody fainted', koLines + ' faint line(s) across the two streams');

  /* ---- THE OUTCOME ----------------------------------------------------------------------------- */
  const same = JSON.stringify(sdD) === JSON.stringify(meD);
  claim(same === (RED ? !c.part : true),
    c.name + ' — the two engines leave the target on the same HP'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    same ? 'identical' : 'showdown ' + JSON.stringify(sdD) + '  vs  medicham ' + JSON.stringify(meD));

  /* ---- AND THE BOARD LEAF THE DIFFERENTIAL ACTUALLY READS -------------------------------------- */
  const boardSame = !r.stateDiv;
  claim(boardSame === (RED ? !c.part : true),
    c.name + ' — the BOARD at the turn boundary'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    boardSame ? 'identical at every boundary'
              : 'parts at t' + r.stateDiv.turn + ': ' + JSON.stringify(r.stateDiv.diffs.slice(0, 3)));
}

/* ---- THE ENGINE'S OWN RECEIPTS ------------------------------------------------------------------- */
console.log(NL + '  MEDSEEN.slotUsedMarked ' + ((SEEN.slotUsedMarked | 0) - b0.marked)
  + '   .slotUsedClearedOnEntry ' + ((SEEN.slotUsedClearedOnEntry | 0) - b0.cleared)
  + '   .lastResortRefused ' + ((SEEN.lastResortRefused | 0) - b0.refused));
console.log('  MEDFAILS.lastResortBattleUsedRestored ' + (FAILS.lastResortBattleUsedRestored | 0));

/* THE WIRE RAN AT ALL. A zero in `slotUsedMarked` means no PP was ever spent through `ppDeduct` and
 * every claim above is about an engine that never reached the mark. */
claim((SEEN.slotUsedMarked | 0) - b0.marked > 0,
  'the `used` mark was written at least once — a zero means ppDeduct never ran',
  'MEDSEEN.slotUsedMarked +' + ((SEEN.slotUsedMarked | 0) - b0.marked));
claim((SEEN.slotUsedClearedOnEntry | 0) - b0.cleared > 0,
  'at least one entry cleared marks — a zero means no arm ever pivoted a used body',
  'MEDSEEN.slotUsedClearedOnEntry +' + ((SEEN.slotUsedClearedOnEntry | 0) - b0.cleared));

if (RED) {
  claim((FAILS.lastResortBattleUsedRestored | 0) === 1,
    'the RED arm actually ran with the knob — a restore that did not fire is a green arm in a red name',
    'MEDFAILS.lastResortBattleUsedRestored = ' + (FAILS.lastResortBattleUsedRestored | 0));
} else {
  claim((FAILS.lastResortBattleUsedRestored | 0) === 0,
    'the CLEAN arm did NOT carry the restore knob',
    'MEDFAILS.lastResortBattleUsedRestored = ' + (FAILS.lastResortBattleUsedRestored | 0));
}
/* A SCRIPTED CLICK THAT WAS NOT ON SHOWDOWN'S REQUEST FALLS BACK TO `pass`, AND THAT IS SILENT.
 * ROADMAP #174: twelve green rows once proved nothing this way. */
{
  const sc = G.scriptCounters();
  claim((sc.moveNotOnRequest | 0) === 0, 'every scripted click was on the authority\'s request',
    'moveNotOnRequest = ' + sc.moveNotOnRequest + (sc.firstMissing ? '  (' + sc.firstMissing + ')' : ''));
}

console.log(NL + (fails ? 'RED   ' + fails + ' failing claim(s).' : 'GREEN  every claim held.'));
process.exit(fails ? 1 : 0);
