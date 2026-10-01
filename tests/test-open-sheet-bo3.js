/* test-open-sheet-bo3.js — IS THIS GAME OPEN-SHEET BO3 PLAY? (Will, 2026-10-01)
 *
 *   node tests/test-open-sheet-bo3.js
 *
 * engine/quality.js customRuleRegime() is the one classifier. This test asks it two things.
 *
 *   1. FIXTURES. A bo1 game under `Force Open Team Sheets, Best of = 3` IS open-sheet bo3 play. A bo1
 *      game with no custom rules is NOT. Neither is a bo1 room that only adds Best of = 3 (sheets offered,
 *      not forced) or only forces sheets (one game). A bo3 game with no custom rules IS. Any other rule
 *      excludes the room. Our own accounts are excluded by reasons().
 *   2. THE ORACLE IS SHOWDOWN. For every (format, rule string) the Reg M-C scan has seen, Showdown's own
 *      rule table for `<format>@@@<rules>` is compared with the bo3 format's rule table. The parser must
 *      say open-sheet bo3 exactly when the two tables are the same game. One normalisation, stated:
 *      `forceopenteamsheets` subsumes `openteamsheets` (the sheets are shown either way), and a `!x` key
 *      that removes a rule the table never had changes nothing.
 *
 * Shown RED on a deliberate break before it was trusted: docs/_reports/2026-10-01-custom-ots-bo3.md. */
'use strict';
const fs = require('fs');
const path = require('path');
const Q = require('../engine/quality.js');

const ROOT = path.join(__dirname, '..');
const REGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'regulations.json'), 'utf8'));
const RT = REGS.runtime.regmc;
const BO1 = RT.showdownFormat, BO3 = RT.bo3Format;   // read, not typed

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('  FAIL ' + msg); } };

/* ---- 1. fixtures ------------------------------------------------------------------------------- */
const R = (fmt, rules) => Q.customRuleRegime(fmt, rules);
ok(R(BO1, 'Force Open Team Sheets, Best of = 3').open_sheet_bo3, 'bo1 + Force Open Team Sheets, Best of = 3 must be open-sheet bo3');
ok(R(BO1, 'force open team sheets,best of=3').open_sheet_bo3, 'the rule text is compared case- and space-insensitively');
ok(!R(BO1, null).open_sheet_bo3, 'a bo1 game with no custom rules is NOT open-sheet bo3');
ok(!R(BO1, 'Best of = 3').open_sheet_bo3, 'bo1 + Best of = 3 alone offers sheets, does not force them: NOT open-sheet bo3');
ok(!R(BO1, 'Force Open Team Sheets').open_sheet_bo3, 'bo1 + Force Open Team Sheets alone is one game: NOT open-sheet bo3');
ok(!R(BO1, 'Force Open Team Sheets, Best of = 3, Evasion Moves Clause').open_sheet_bo3, 'any other rule excludes the room');
ok(R(BO3, null).open_sheet_bo3, 'a bo3 game with no custom rules IS open-sheet bo3');
ok(!R(BO3, '!Force Open Team Sheets').open_sheet_bo3, 'bo3 with sheets switched off is NOT open-sheet bo3');
ok(!R(BO3, 'Best of = 5').open_sheet_bo3, 'bo3 played as best of five is NOT open-sheet bo3');
ok(R('nosuchformat', null).verdict === 'unknown_format', 'an unknown format is never admitted');
ok(Q.formatOfId('smogtours-' + BO1 + '-123') === BO1 && Q.formatOfId(BO3 + '-9') === BO3, 'formatOfId strips the room number and the smogtours prefix');
ok(Q.isOpenSheetBo3({ id: BO1 + '-1' }, 'Force Open Team Sheets, Best of = 3'), 'isOpenSheetBo3 takes the rule text from a caller holding the raw log');
ok(!Q.isOpenSheetBo3({ id: BO1 + '-1' }, null), 'isOpenSheetBo3: bo1, no rules');
ok(Q.isOpenSheetBo3({ id: BO3 + '-1' }, null), 'isOpenSheetBo3: bo3, no rules');

/* the store-backed path: a room the scan saw under OTS + Bo3 in the bo1 format is read as bo3 play */
const C = Q.customRuleset();
const seen = [...(C.rules_of || new Map())].find(([id, t]) => Q.formatOfId(id) === BO1 && R(BO1, t).open_sheet_bo3);
ok(!!seen, 'the Reg M-C scan holds at least one bo1-format OTS + Bo3 room');
if (seen) {
  ok(Q.isOpenSheetBo3({ id: seen[0] }), `scanned room ${seen[0]} is open-sheet bo3 through the store path`);
  ok(!C.ids.has(seen[0]), `scanned room ${seen[0]} is not excluded as a custom ruleset`);
}
const excludedBo1 = [...(C.rules_of || new Map())].find(([id, t]) => Q.formatOfId(id) === BO1 && R(BO1, t).verdict === 'not_open_sheet');
/* 2026-10-01, Will's second decision: a sheets-offered room is no longer excluded by its text. It is decided by its
 * sheets (tests/test-open-sheet-turn-play.js); with no sheets shown it is neither class and is charged custom_ruleset. */
if (excludedBo1) ok(C.conditional.has(excludedBo1[0]) && !Q.isOpenSheetBo3({ id: excludedBo1[0], sheets: null })
  && Q.reasons({ id: excludedBo1[0], sheets: null, p1: {}, p2: {}, turns: [], brought: {} }, Q.config(), null).includes('custom_ruleset'),
  `scanned room ${excludedBo1[0]} (${excludedBo1[1]}) with no sheets shown is excluded`);

/* own accounts: declared in the config, read by reasons() */
const own = Object.keys(((Q.config().rules || {}).exclude_own_accounts || {}).accounts || {});
ok(own.length > 0 && own.every(n => Q.isOwnAccount(n)), 'every declared own account is recognised');
const g = { id: BO3 + '-1', p1: { name: own[0] && own[0].toUpperCase() }, p2: { name: 'someone' }, turns: [], brought: {} };
ok(Q.reasons(g).includes('own_account'), 'a game with one of our accounts carries own_account');
ok(!Q.reasons({ ...g, p1: { name: 'someone else' } }).includes('own_account'), 'a game without our accounts does not');

/* ---- 2. Showdown is the oracle ----------------------------------------------------------------- */
function findCheckout() {
  if (process.env.SHOWDOWN_PATH) return process.env.SHOWDOWN_PATH;
  let d = ROOT;
  for (let i = 0; i < 6; i++) {
    const c = path.join(d, RT.checkout);
    if (fs.existsSync(path.join(c, 'dist', 'sim'))) return c;
    d = path.dirname(d);
  }
  return null;
}
const SD = findCheckout();
if (!SD) {
  console.log(`  CANNOT ANSWER: no ${RT.checkout} checkout found; the oracle half did not run`);
  fail++;
} else {
  const { Dex } = require(path.join(SD, 'dist', 'sim'));
  const table = spec => {
    const t = Dex.formats.getRuleTable(Dex.formats.get(spec, true));
    const keys = new Set([...t.keys()].filter(k => !k.startsWith('!')));
    if (keys.has('forceopenteamsheets')) keys.delete('openteamsheets');
    return [...keys].sort().map(k => k + (t.valueRules.has(k) ? '=' + t.valueRules.get(k) : '')).join(' ');
  };
  /* Showdown refuses a REDUNDANT rule ("bestof=3 is redundant") in a spec, while the room that played
   * accepted it. A redundant rule changes nothing, so it is dropped and the rest asked again. */
  const tableOf = (fmt, rules) => {
    let list = String(rules || '').split(',').map(s => s.trim()).filter(Boolean);
    for (let i = 0; i < 20; i++) {
      try { return table(list.length ? fmt + '@@@' + list.join(',') : fmt); }
      catch (e) {
        const m = /Rule "([^"]+)" is redundant/.exec(e.message);
        if (!m) return 'ERROR: ' + e.message.split('\n')[0];
        const before = list.length;
        list = list.filter(r => Q.toID(r.replace(/=.*/, '')) + (r.includes('=') ? '=' + r.split('=')[1].trim() : '') !== m[1].replace(/\s/g, '')
                             && Q.toID(r) !== Q.toID(m[1]));
        if (list.length === before) return 'ERROR: ' + e.message.split('\n')[0];
      }
    }
    return 'ERROR: too many redundant rules';
  };
  const target = table(BO3);
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'custom-ruleset-ids-regmc.json'), 'utf8'));
  const pairs = (v.verdict_by_format_and_rules || []).map(r => [r.format, r.rules]);
  pairs.push([BO1, null], [BO3, null], [BO1, 'Force Open Team Sheets, Best of = 3']);
  ok(pairs.length > 3, 'the scan publishes verdict_by_format_and_rules (re-run engine/scan_custom_rulesets.js --regulation regmc)');
  let asked = 0, errors = 0;
  for (const [fmt, rules] of pairs) {
    if (!Q.formatBases().has(fmt)) continue;
    const t = tableOf(fmt, rules);
    if (t.startsWith('ERROR')) {
      /* Showdown cannot build this table (a mod or a rule this checkout does not know). The parser must
       * not admit such a room: an unaskable room is never our game. */
      errors++;
      ok(!R(fmt, rules).open_sheet_bo3, `${fmt} + "${rules}": Showdown cannot build it (${t.slice(7, 80)}) and the parser admits it`);
      continue;
    }
    asked++;
    ok((t === target) === R(fmt, rules).open_sheet_bo3,
      `${fmt} + "${rules}": Showdown says ${t === target ? 'SAME GAME as' : 'NOT'} ${BO3}, the parser says ${R(fmt, rules).verdict}`);
  }
  console.log(`  oracle: ${asked} (format, rules) pairs asked of Showdown at ${path.basename(SD)}, ${errors} it could not build`);
}

console.log(`test-open-sheet-bo3: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
