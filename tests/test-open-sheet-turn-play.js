/* test-open-sheet-turn-play.js — THE TWO OPEN-SHEET ANSWERS (Will, 2026-10-01, the decisions after abra/regmc 1.64.0)
 *
 *   node tests/test-open-sheet-turn-play.js
 *
 * engine/quality.js gives two answers from one classifier:
 *   isOpenSheetTurnPlay(g)  turn-level models: the bo3 format, and every bo1-format game in which both sheets were shown
 *                           (offered and accepted, or forced) under no rule other than a sheet or best-of rule.
 *   isOpenSheetBo3(g)       series-level uses: the bo3 format, the bo1 room under exactly Force Open Team Sheets +
 *                           Best of = 3, and the bo1 room set to Best of = 3 where both players accepted the sheets.
 * And reasons() must not charge `custom_ruleset` to a sheet-rules-only room that showed both sheets, while still
 * charging it to one that did not, and to any room under a rule that changes play.
 *
 * tests/test-open-sheet-bo3.js keeps checking the rule-text parser against Showdown's rule table; this file checks
 * the game-level answers that the rule text alone cannot give. Shown RED on a deliberate break before it was trusted:
 * docs/_reports/2026-10-01-open-sheet-turn-play.md. */
'use strict';
const fs = require('fs');
const path = require('path');
const Q = require('../engine/quality.js');

const REGS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'regulations.json'), 'utf8'));
const RT = REGS.runtime.regmc;
const BO1 = RT.showdownFormat, BO3 = RT.bo3Format;   // read, not typed

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('  FAIL ' + msg); } };

const SHEET = [{ species: 'x' }];
const shown = { p1: SHEET, p2: SHEET }, oneSide = { p1: SHEET, p2: [] };
const G = (fmt, sheets) => ({ id: fmt + '-1', sheets });
const T = (g, rules) => Q.isOpenSheetTurnPlay(g, rules), B = (g, rules) => Q.isOpenSheetBo3(g, rules);

/* ---- 1. the classes, one fixture each ---------------------------------------------------------- */
// the bo3 format: both answers
ok(B(G(BO3, shown), null) && T(G(BO3, shown), null), 'bo3 format: open-sheet bo3 AND turn play');
// bo1, sheets offered and accepted, no custom rule: turn play, not series
ok(T(G(BO1, shown), null), 'bo1, both sheets shown, no rule: turn play');
ok(!B(G(BO1, shown), null), 'bo1, both sheets shown, no rule: NOT open-sheet bo3 (one game)');
// bo1, sheets offered and declined (or one side only): neither
ok(!T(G(BO1, null), null) && !B(G(BO1, null), null), 'bo1, no sheets: neither class');
ok(!T(G(BO1, oneSide), null), 'bo1, one sheet only: not turn play (both players must accept)');
// bo1 + Force Open Team Sheets alone: turn play (sheets forced), one game
ok(T(G(BO1, shown), 'Force Open Team Sheets') && !B(G(BO1, shown), 'Force Open Team Sheets'), 'bo1 + Force OTS: turn play, not bo3');
// bo1 + Force OTS + Best of = 3: both (1.64.0), even when the caller has no sheets to show
ok(B({ id: BO1 + '-1' }, 'Force Open Team Sheets, Best of = 3') && T({ id: BO1 + '-1' }, 'Force Open Team Sheets, Best of = 3'), 'bo1 + Force OTS + Bo3: both, by rule');
// DECISION 2: bo1 + Best of = 3, both accepted the offered sheets: open-sheet bo3 by consent
const consent = Q.openSheetRegime(G(BO1, shown), 'Best of = 3');
ok(consent.bo3 && consent.turn_play && consent.bo3_by_consent, 'bo1 + Best of = 3 with both sheets shown: open-sheet bo3 BY CONSENT');
ok(!B(G(BO1, null), 'Best of = 3') && !T(G(BO1, null), 'Best of = 3'), 'bo1 + Best of = 3 with no sheets shown: neither');
ok(!B({ id: BO1 + '-1' }, 'Best of = 3'), 'bo1 + Best of = 3, caller passed no sheets: not admitted (the consent needs the sheets)');
ok(B({ id: BO1 + '-1', sheetsShown: true }, 'Best of = 3'), 'sheetsShown: true stands in for the sheets (a raw-log caller)');
// sheets switched off: neither, whatever is shown
ok(!T(G(BO1, shown), 'Best of = 3, !Open Team Sheets') && !B(G(BO1, shown), 'Best of = 3, !Open Team Sheets'), 'bo1 + Bo3 + !OTS: neither');
// any rule that changes play: neither, even with both sheets shown
ok(!T(G(BO1, shown), 'Force Open Team Sheets, +Metagross + Heavy Slam'), 'a rule that changes play: not turn play');
ok(!B(G(BO1, shown), 'Best of = 3, Evasion Moves Clause'), 'a clause: not open-sheet bo3');
ok(!T(G('nosuchformat', shown), null), 'an unknown format is never admitted');
// the series class implies the turn class
for (const [g, r] of [[G(BO3, shown), null], [G(BO1, shown), 'Best of = 3'], [G(BO1, shown), 'Force Open Team Sheets, Best of = 3']])
  ok(!B(g, r) || T(g, r), `bo3 implies turn play: ${g.id} "${r}"`);

/* ---- 2. reasons(): the custom-rule charge asks the game ---------------------------------------- */
const C = Q.customRuleset();
const cfg = Q.config();
const base = { p1: { name: 'a' }, p2: { name: 'b' }, turns: [], brought: {} };
const findRoom = pred => [...(C.rules_of || new Map())].find(([id, t]) => Q.formatOfId(id) === BO1 && pred(Q.customRuleRegime(BO1, t)));
const consentRoom = findRoom(r => r.verdict === 'not_open_sheet' && r.best_of === 3 && r.offer_open_sheets && !r.other.length);
const forcedRoom = findRoom(r => r.verdict === 'not_bo3' && r.force_open_sheets && !r.other.length);
const otherRoom = findRoom(r => r.verdict === 'other_rules');
ok(!!consentRoom && !!forcedRoom && !!otherRoom, 'the Reg M-C scan holds a Best of = 3 room, a Force OTS room and a play-changing room');
const charged = (id, sheets) => Q.reasons(Object.assign({ id, sheets }, base), cfg, null).includes('custom_ruleset');
if (consentRoom) {
  ok(C.conditional && C.conditional.has(consentRoom[0]), `${consentRoom[0]} ("${consentRoom[1]}") is sheet-rules-only`);
  ok(!charged(consentRoom[0], shown), `${consentRoom[0]} with both sheets shown is NOT charged custom_ruleset`);
  ok(charged(consentRoom[0], null), `${consentRoom[0]} with no sheets IS charged custom_ruleset`);
  ok(Q.isOpenSheetBo3({ id: consentRoom[0], sheets: shown }), `${consentRoom[0]} with both sheets is open-sheet bo3 through the store path`);
}
if (forcedRoom) {
  ok(!charged(forcedRoom[0], shown), `${forcedRoom[0]} ("${forcedRoom[1]}") is not charged custom_ruleset`);
  ok(Q.isOpenSheetTurnPlay({ id: forcedRoom[0], sheets: shown }) && !Q.isOpenSheetBo3({ id: forcedRoom[0], sheets: shown }), `${forcedRoom[0]} is turn play and not bo3 through the store path`);
}
if (otherRoom) {
  ok(charged(otherRoom[0], shown), `${otherRoom[0]} ("${otherRoom[1]}") IS charged custom_ruleset, sheets or not`);
  ok(!Q.isOpenSheetTurnPlay({ id: otherRoom[0], sheets: shown }), `${otherRoom[0]} is not turn play`);
}

console.log(`test-open-sheet-turn-play: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
