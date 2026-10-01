/* solver/tests/test-answer-map.js — the live answer map (solver/results/2026-10-01-lost-last-answer/answer_map.js) reads
 * the LIVE position, not the team sheets (2026-10-01).
 *
 *   node solver/tests/test-answer-map.js [--release eaa5becc54eb]
 *
 * Built on a saved ladder log (fixtures/rotom/postmortem/sdkvndfv-g1, turn 2, our side p2), staged on the frozen release.
 *   LIVE-HP   every opposing body set to 1 HP: mean P(my i beats their j) reaches 0.9 and closes more than half of its
 *             headroom (1 - the full-HP mean), and no pair falls by more than the duel noise. RED under ANSWER_MAP_BREAK=fullhp (the duel restores full HP).
 *   SIDES     the same duel asked from the other side: P_A(i beats j) + P_B(j beats i) is about 1 (mean |sum - 1| < 0.15).
 *   READONLY  the battle's digest is the same before and after a map.
 *   COUNTERS  duels and steps were played; no duel had no move.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const path = require('path');
require('../arena/env.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = flag('--release', 'eaa5becc54eb');
let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL [' + clause + '] ' + msg); } };

const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API;
const T = require('../arena/teams.js');
const WB = require('../rotom/world.js').create(API);
const LR = require('./ladder_replay.js');
const AM = require('../results/2026-10-01-lost-last-answer/answer_map.js').create(API);
const FX = path.join(__dirname, 'fixtures', 'rotom', 'postmortem');
const hpOf = row => { const b = T.buildBody(API.M, row); return b ? b.st.hp : 100; };

const w = LR.worldAt(WB, { log: path.join(FX, 'sdkvndfv-g1.battle.txt'), me: 'p2', bring: [0, 5, 2, 4], cut: '|turn|2', hpOf });
const d0 = API.digest(w.S);
const full = AM.answerMap(w.S, w.side, { n: 16, seed: 3 });
ok('READONLY', API.digest(w.S) === d0, 'the map changed the battle it read');

/* LIVE-HP */
const low = API.clone(w.S);
for (const m of (w.side === 'A' ? low.sfB : low.sfA).team) if (m.curHP > 0 && !m.fainted) m.curHP = 1;
const lowMap = AM.answerMap(low, w.side, { n: 16, seed: 3 });
let rise = 0, n = 0, worst = 0;
full.P.forEach((row, i) => row.forEach((p, j) => { const q = lowMap.P[i][j]; rise += q - p; n++; worst = Math.min(worst, q - p); }));
rise /= n || 1;
const meanFull = full.P.flat().reduce((s, x) => s + x, 0) / (n || 1), meanLow = meanFull + rise;
ok('LIVE-HP', n > 0 && meanLow >= 0.9 && rise > 0.5 * (1 - meanFull), 'their bodies at 1 HP took mean P(i beats j) from ' + meanFull.toFixed(3) + ' to only ' + meanLow.toFixed(3) + ' (want >= 0.9 and a rise over half the headroom): the map is not reading live HP');
ok('LIVE-HP', worst > -0.3, 'a pair fell by ' + worst.toFixed(3) + ' when the foe was set to 1 HP');
console.log('  LIVE-HP  ' + n + ' pairs, mean P full ' + (full.P.flat().reduce((s, x) => s + x, 0) / n).toFixed(3) + ' -> at 1 HP ' + (lowMap.P.flat().reduce((s, x) => s + x, 0) / n).toFixed(3));

/* SIDES */
const other = w.side === 'A' ? 'B' : 'A';
const rev = AM.answerMap(w.S, other, { n: 16, seed: 5 });
let dev = 0, k = 0;
full.mine.forEach((mi, i) => full.theirs.forEach((tj, j) => {
  const ii = rev.mine.findIndex(x => x.team === tj.team), jj = rev.theirs.findIndex(x => x.team === mi.team);
  if (ii < 0 || jj < 0) return;
  dev += Math.abs(full.P[i][j] + rev.P[ii][jj] - 1); k++;
}));
dev /= k || 1;
ok('SIDES', k > 0 && dev < 0.15, 'P_A(i beats j) + P_B(j beats i) is off 1 by ' + dev.toFixed(3) + ' on average over ' + k + ' pairs');
console.log('  SIDES    ' + k + ' pairs, mean |P + P_rev - 1| ' + dev.toFixed(3));

ok('COUNTERS', AM.C.duels > 0 && AM.C.steps > 0 && AM.C.probes > 0, 'no duel was played: ' + JSON.stringify(AM.C));
ok('COUNTERS', AM.C.noMove === 0, AM.C.noMove + ' duel turns had no move');
console.log('  COUNTERS ' + JSON.stringify(AM.C));

console.log(fails ? `RED  ${fails} of ${checks} checks failed${process.env.ANSWER_MAP_BREAK ? ' (ANSWER_MAP_BREAK=' + process.env.ANSWER_MAP_BREAK + ')' : ''}` : `GREEN  ${checks} checks`);
process.exit(fails ? 1 : 0);
