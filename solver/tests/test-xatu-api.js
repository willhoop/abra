/* solver/tests/test-xatu-api.js — the module the search calls (solver/xatu/index.js), fed real replays.
 * Exits non-zero on any failure.   node solver/tests/test-xatu-api.js
 * Replays are read from data/raw (tracked). The bring prior runs with an empty store memory so the test
 * does not need the 500 MB human dataset; the fitted weights come from solver/xatu/model/bring-v1.json. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const XATU = require('../xatu/index.js');
let fail = 0, pass = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL ' + msg); } };

const dir = path.join(__dirname, '..', '..', 'data', 'raw', 'games.gen9championsvgc2026regmcbo3');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.gz')).sort();
const logs = [];
for (const f of files.slice(1, 3)) {
  for (const line of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8').split('\n')) {
    if (!line) continue;
    const log = JSON.parse(line).log;
    if (/\|showteam\|/.test(log) && !/\|replace\|/.test(log) && /\|turn\|4/.test(log)) logs.push(log);
    if (logs.length >= 12) break;
  }
}
ok(logs.length >= 6, 'fixture replays found');

let seededRng = 5; const rng = () => { seededRng = (seededRng * 1103515245 + 12345) & 0x7fffffff; return seededRng / 0x7fffffff; };
let applied = 0;
for (const log of logs) {
  const bel = XATU.createBelief({});
  const lines = log.split('\n');
  let checkedPre = false;
  for (const l of lines) {
    // before the leads are out there is no back-two belief, and the API says so rather than guessing
    if (!checkedPre && l.startsWith('|start')) { ok(bel.backTwo('p2') === null, 'no back-two before leads'); checkedPre = true; }
    bel.feed(l);
    if (l.startsWith('|turn|')) {
      for (const s of ['p1', 'p2']) {
        const d = bel.backTwo(s);
        if (!d) { ok(false, 'back-two exists once the turn starts'); continue; }
        const z = d.reduce((a, x) => a + x.p, 0);
        ok(d.length === 6 && Math.abs(z - 1) < 1e-9, 'six pairs summing to one');
        const seenBack = [...bel.seen[s]].filter(i => !bel.leads[s].includes(i));
        ok(d.filter(x => x.p > 0).every(x => seenBack.every(i => x.pair.includes(i))), 'mass only on pairs holding every seen back member');
        ok(d.some(x => x.p > 0), 'never empty');
        const mg = bel.backMarginals(s);
        ok(Math.abs(mg.reduce((a, b) => a + b, 0) - 4) < 1e-9, 'bring marginals sum to four');
      }
    }
  }
  bel.feedAll([]);
  const c = bel.counters();
  applied += (c.order_applied || 0) + (c.damage_applied || 0);
  ok(c.reveals >= 4, 'reveals counted');
  for (const w of bel.worlds(5, rng)) {
    for (const s of ['p1', 'p2']) {
      const seenBack = [...bel.seen[s]].filter(i => !bel.leads[s].includes(i));
      ok(seenBack.every(i => w.back[s].includes(i)), 'sampled world keeps the seen back members');
      for (let i = 0; i < 6; i++) {
        const v = w.spreads[s][i];
        const tot = Object.values(v).reduce((a, b) => a + b, 0);
        ok(tot <= require('../xatu/sd.js').SP_TOTAL, 'sampled spread within the budget');
        for (const st of Object.keys(v)) ok(bel.spread.dom[s][i].d[st][v[st]] === 1, 'sampled SP value is alive');
      }
    }
  }
  const sm = bel.spreads('p2');
  ok(sm.length === 6 && sm.every(m => m.spe.n >= 1 && m.spe.stat[0] <= m.spe.stat[1]), 'spread summary well formed');
}
ok(applied > 0, `constraints applied through the API (${applied})`);

console.log(`test-xatu-api: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
