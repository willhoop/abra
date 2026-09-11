#!/usr/bin/env node
/* tests/probe_differential_void_attribution.js — ROADMAP #467, half (b). Half (a) is #543's.
 * ==================================================================================================
 * CAN A VOIDED GAME BE SUBTRACTED FROM THE CAUSE IT DIVERGED ON?
 *
 * engine/game_differential.js publishes `mid_void.void_games` and `usable_games` at the top level and
 * counts a cause's games in `classes[].causes[].n`. Nothing records WHICH cause a voided game
 * diverged on, so a clause that subtracts declared causes by `n` and void games by the top-level
 * count double-subtracts the day a void game's cause is also declared — off by one toward green
 * (the row's measurement: 17 - 6 = 11 where the truth was 12). The repair is a `void_n` beside `n`.
 *
 * THIS IS A FIELD CHECK, AND IT SAYS SO. Today's committed artifact has 0 void games, so the clause's
 * arithmetic cannot differ from the truth on it; the outcome is unobservable until a game voids. What
 * CAN be checked is whether the artifact is able to answer the question at all: every cause row must
 * carry `void_n` (0 is an answer; absent is not). When a void game exists, `sum(void_n)` must also
 * equal `mid_void.void_games`.
 *
 * READ FROM `git show HEAD:`. PLANT: `--artifact <path>`. EXIT: 0 green / 1 red / 2 cannot answer.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
let g;
try {
  g = JSON.parse(arg('--artifact') ? fs.readFileSync(arg('--artifact'), 'utf8')
    : execFileSync('git', ['show', 'HEAD:data/game-differential.json'], { cwd: ROOT, maxBuffer: 1 << 30 }).toString());
} catch (e) { cannot('the differential artifact is unreadable: ' + e.message); }
const causes = [];
for (const c of g.classes || []) for (const k of c.causes || []) causes.push({ cls: c.cls, ...k });
const mv = g.mid_void || {};
console.log('\ntests/probe_differential_void_attribution.js — ROADMAP #467 (b)');
console.log('  artifact ' + (arg('--artifact') || 'HEAD:data/game-differential.json') + '   release ' + g.engine_release
  + '   causes ' + causes.length + '   mid_void.void_games ' + mv.void_games + '   usable_games ' + mv.usable_games);
if (!causes.length) cannot('the artifact carries no cause row, so there is nothing a void game could be attributed to');
if (mv.void_games == null) cannot('the artifact carries no mid_void.void_games, so the void population is unknown');

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
const missing = causes.filter(k => typeof k.void_n !== 'number');
ok(missing.length === 0, 'every cause row carries void_n beside n',
   missing.length ? missing.length + ' of ' + causes.length + ' cause row(s) have no void_n; first cell: `' + missing[0].cause
     + '` (n=' + missing[0].n + '). No bite today: void_games=' + mv.void_games + ', so the clause arithmetic is '
     + 'unaffected on this artifact — the field is what makes it answerable when a game voids.' : null);
if (!missing.length && mv.void_games > 0) {
  const s = causes.reduce((a, k) => a + k.void_n, 0);
  ok(s === mv.void_games, 'sum(void_n) equals mid_void.void_games', 'sum ' + s + ' vs ' + mv.void_games);
}
console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
