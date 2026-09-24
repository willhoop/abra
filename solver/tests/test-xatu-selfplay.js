/* solver/tests/test-xatu-selfplay.js — the spread belief never rules out the TRUE spread.
 * Exits non-zero on any failure.   node solver/tests/test-xatu-selfplay.js [--games N]
 *
 * Showdown (the Reg M-C checkout) plays games between real open sheets with known random Stat Point
 * spreads; the spectator log goes through the tracker and the belief; after every observation the true SP
 * value of every stat of every mon must still be alive. Also: no contradiction, and the capability counters
 * must be non-zero — a belief that applied nothing would pass the truth check trivially. */
'use strict';
const SP = require('../xatu/selfplay.js');
let fail = 0, pass = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL ' + msg); } };
const args = process.argv.slice(2);
const games = +(args[args.indexOf('--games') + 1] || 0) || 12;

const seed = 11;
const R = SP.rng(seed);
const pool = SP.loadSheets(games * 2, R);
let order = 0, damage = 0, excl = 0, contra = 0, anomalies = 0, played = 0;
for (let g = 0; g < games; g++) {
  const pair = [pool[(2 * g) % pool.length], pool[(2 * g + 1) % pool.length]];
  const spreads = { p1: pair[0].map(() => SP.randomSpread(R)), p2: pair[1].map(() => SP.randomSpread(R)) };
  const r = SP.playOne(pair, spreads, seed * 100003 + g);
  const c = SP.checkGame(r.log, pair, spreads);
  played++;
  order += c.stats.order_applied; damage += c.stats.damage_applied;
  anomalies += c.anomalies.length; contra += c.contradictions.length;
  if (c.excl.length) { excl++; console.log('EXCLUDED TRUTH', JSON.stringify(c.excl[0]).slice(0, 600)); }
  for (const x of c.contradictions) console.log('CONTRADICTION', JSON.stringify(x).slice(0, 400));
}
ok(played === games, `played ${played} games`);
ok(excl === 0, `true spread never excluded (${excl} games excluded it)`);
ok(contra === 0, `no contradictions (${contra})`);
ok(anomalies === 0, `no priority-order anomalies (${anomalies})`);
ok(order > 0, `order constraints applied (${order})`);
ok(damage > 0, `damage constraints applied (${damage})`);
console.log(`test-xatu-selfplay: ${pass} passed, ${fail} failed  [games ${games}, order ${order}, damage ${damage}]`);
process.exit(fail ? 1 : 0);
