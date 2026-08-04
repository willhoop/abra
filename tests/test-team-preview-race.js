/* test-team-preview-race.js — MAG must not commit its bring before the opponent's sheet arrives.
 *
 * WHY THIS EXISTS. Will, 2026-08-01: "like how does it choose its pokemon before team sheet
 * selection". Measured off the live protocol log of battle 26, in this order:
 *
 *     |teampreview
 *     acceptopenteamsheets          <- MAG agrees to open sheets
 *     /choose team 4251             <- ...and then answers
 *     showteam|p1                   <- the sheet arrives, after the decision it should have informed
 *     showteam|p2
 *
 * Nothing errored. MAG agreed to see the opponent's sets and then chose in the dark, and the only
 * way anyone found out was by playing a game and reading a protocol dump — which is exactly why this
 * is a test and not a note. showdown_bot.js is importable now for the same reason: a race in message
 * ORDERING can only be checked by driving the real handler with real lines in a chosen order.
 *
 * WHAT IS ASSERTED, and it is deliberately about order rather than content: at the moment MAG sends
 * `/choose team`, the opponent's sheet must already be on its board. What MAG then DOES with that
 * sheet is a separate question and a separate piece of work — prior_player.js chooseTeamPreview(team)
 * still reads only its own team, so today it will look and then ignore. This test is the
 * precondition, and it is honest about being only that.
 */
'use strict';
require('../engine/showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const path = require('path');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('TEAM PREVIEW RACE — the bring must not be chosen before the sheet arrives\n');

if (!process.env.SHOWDOWN_PATH) {
  console.log('  FAIL SHOWDOWN_PATH is not set, so the bot cannot be loaded');
  console.log('\nTEAM PREVIEW RACE TESTS: 0 passed, 1 failed');
  process.exit(1);
}

const bot = require(path.join(ROOT, 'engine', 'showdown_bot.js'));

const ROOM = 'battle-gen9championsvgc2026regmb-26';
const sent = [];
bot.setSink(msg => sent.push(msg));

/* A team-preview request as the server really sends it: MAG is p2, six Pokemon, teamPreview true. */
const six = ['Garchomp', 'Gyarados', 'Incineroar', 'Whimsicott', 'Torkoal', 'Grimmsnarl'];
const reqJSON = JSON.stringify({
  teamPreview: true, maxTeamSize: 4, rqid: 3,
  side: {
    name: 'MAG', id: 'p2',
    pokemon: six.map((s, i) => ({
      ident: `p2: ${s}`, details: `${s}, L50`, condition: '100/100',
      active: i < 2, stats: { atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
      moves: ['protect'], baseAbility: 'intimidate', item: 'sitrusberry', pokeball: 'pokeball',
    })),
  },
});

/* The foe's open team sheet, in the |showteam| shape magnemite.js parses. */
const foeSix = ['Venusaur', 'Charizard', 'Blastoise', 'Clefable', 'Alakazam', 'Machamp'];
const showteam = '|showteam|p1|' + foeSix
  .map(s => `${s}||sitrusberry|intimidate|protect,tackle,growl,swagger|Adamant|`)
  .join(']');

const feed = l => bot.feed('>' + ROOM + '\n' + l);
const chooseTeamSent = () => sent.filter(m => /\/choose\s+team/.test(m));
const foeSheetCount = () => {
  const e = bot.players.get(ROOM);
  return e && e.player && e.player.board ? Object.keys(e.player.board.sheet.p1 || {}).length : 0;
};

/* ---- 1. the room opens and MAG accepts open sheets -------------------------------------------- */
feed('|init|battle');
feed('|uhtml|otsrequest|<button name="send" value="/acceptopenteamsheets">Accept</button>');
ok(sent.some(m => m.includes('/acceptopenteamsheets')), 'MAG accepts open team sheets');
ok(bot.otsSent.has(ROOM), '...and records that it did, so it does not answer twice');

/* ---- 2. THE RACE. The request arrives BEFORE any sheet, exactly as it did live ---------------- */
feed('|teampreview');
feed('|request|' + reqJSON);

ok(chooseTeamSent().length === 0,
  'MAG does NOT answer team preview while the opponent sheet is still unseen — this is the bug');
ok(bot.teamPreviewHeld.has(ROOM), 'the request is held rather than dropped');
ok(bot.bringStats.held === 1, 'the hold is counted');
ok(foeSheetCount() === 0, 'and at this point it genuinely has no sheet to have used');

/* ---- 3. the sheet arrives, and only then may the bring go out --------------------------------- */
feed(showteam);

ok(foeSheetCount() === foeSix.length,
  `the opponent's ${foeSix.length} sets are on the board (${foeSheetCount()} read)`);
ok(chooseTeamSent().length === 1, 'the bring is sent exactly once, after the sheet');
ok(!bot.teamPreviewHeld.has(ROOM), 'nothing is left held');
ok(bot.bringStats.releasedOnSheet === 1 && bot.bringStats.releasedOnTimeout === 0,
  'released because the sheet arrived, not because the clock ran out');

/* THE ACTUAL ORDERING CLAIM, stated as the thing that was wrong before: the sheet must be on the
 * board at the moment the choice goes out, not merely at some point in the battle. */
ok(foeSheetCount() > 0 && chooseTeamSent().length === 1,
  'at the moment MAG committed its four, the opponent sheet was available to it');

/* ---- 4. the fallback must exist, fire, and be counted ----------------------------------------- */
/* A server that never sends a sheet must not hang MAG until team preview times out and forfeits. */
const ROOM2 = ROOM + '-nosheet';
const feed2 = l => bot.feed('>' + ROOM2 + '\n' + l);
feed2('|init|battle');
feed2('|uhtml|otsrequest|<button name="send" value="/acceptopenteamsheets">Accept</button>');
feed2('|teampreview');
feed2('|request|' + reqJSON.replace('"rqid":3', '"rqid":4'));
ok(bot.teamPreviewHeld.has(ROOM2), 'a second battle with no sheet also holds');

const held = bot.teamPreviewHeld.get(ROOM2);
ok(held && typeof held.timer === 'object', 'a timeout is armed, so this cannot wait forever');
ok(bot.SHEET_WAIT_MS > 0 && bot.SHEET_WAIT_MS < 60000,
  `the wait (${bot.SHEET_WAIT_MS}ms) is bounded and well under any team-preview clock`);

const before = chooseTeamSent().length;
setTimeout(() => {
  ok(chooseTeamSent().length === before + 1, 'after the timeout the bring goes out anyway — no hang');
  ok(bot.bringStats.releasedOnTimeout === 1,
    'and the blind bring is COUNTED, so a run where it always happened is distinguishable from one where it never did');
  console.log(`\nTEAM PREVIEW RACE TESTS: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
}, bot.SHEET_WAIT_MS + 400);
