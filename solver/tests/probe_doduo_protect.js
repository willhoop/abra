'use strict';
/* solver/tests/probe_doduo_protect.js — DODUO's Protect pull on held-out HUMAN decisions (2026-09-26,
 * docs/_reports/2026-09-26-protect-overuse.md, candidate (d)). A MEASUREMENT: prints, exits 0. Reads only.
 *
 *   node solver/tests/probe_doduo_protect.js [v1|gen5] [max test games] [--human <games.jsonl>]
 *
 * Every slot-decision of a TEST-split game (both players held out, solver/mew/pairs.js splitOf) that offers a
 * protect-family candidate: DODUO's mass on those candidates (the slot marginal of its joint), the humans' actual
 * rate, and how often DODUO's ARGMAX joint clicks one. Split by the `stall_repeat` feature (the body's last move was
 * a stalling move) vs fresh.
 */
const path = require('path');
const WT = path.join(__dirname, '..') + '/';
process.chdir(path.join(__dirname, '..', '..'));
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
require(WT + 'arena/env.js');
const fs = require('fs'), readline = require('readline');
const MAGI = require(WT + 'mag/infer.js');
const F0 = require(WT + 'prior/features.js');
const PAIRS = require(WT + 'mew/pairs.js');
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const which = process.argv[2] || 'v1';
const NMAX = +(process.argv[3] || 1500);
const hi = process.argv.indexOf('--human');
const HUMAN = hi > 0 ? process.argv[hi + 1] : path.join(__dirname, '..', 'out', 'human', 'games.jsonl');
const model = which === 'gen5' ? MAGI.load({ mag: 'solver/machamp/models/gen5/mag-gen5.json', doduo: 'solver/machamp/models/gen5/doduo-gen5.json' }) : MAGI.load();
const CI = Object.fromEntries(F0.CAND_NAMES.map((n, i) => [n, i]));
const T = { repeat: { n: 0, pred: 0, act: 0, argmax: 0 }, fresh: { n: 0, pred: 0, act: 0, argmax: 0 } };
let games = 0;
const rl = readline.createInterface({ input: fs.createReadStream(HUMAN) });
rl.on('line', line => {
  if (games >= NMAX) return;
  const row = JSON.parse(line);
  const g = row.game;
  if (PAIRS.splitOf(toID(g.players.p1.name)) !== 2 || PAIRS.splitOf(toID(g.players.p2.name)) !== 2) return;
  games++;
  for (let t = 0; t < row.turns.length; t++) for (const side of ['p1', 'p2']) {
    let r; try { r = model.predict(row, t, side); } catch (e) { continue; }
    if (!r) continue;
    const d = r.decision;
    const best = r.cells[0];
    for (let k = 0; k < 2; k++) {
      const s = d.slots[k]; if (!s) continue;
      const st = s.cands.map((c, i) => c.attr && c.attr.stall ? i : -1).filter(i => i >= 0);
      if (!st.length) continue;
      const rep = st.some(i => s.cands[i].f[CI.stall_repeat] === 1);
      const a = row.turns[t].actions && row.turns[t].actions[side] && row.turns[t].actions[side][k === 0 ? 'a' : 'b'];
      if (!a) continue;
      const bucket = T[rep ? 'repeat' : 'fresh'];
      let p = 0; for (const c of r.cells) if (st.includes(k === 0 ? c.a : c.b)) p += c.p;
      bucket.n++; bucket.pred += p;
      if (a.kind === 'move' && s.cands.some((c, i) => st.includes(i) && c.attr.mv === toID(a.move))) bucket.act++;
      if (best && st.includes(k === 0 ? best.a : best.b)) bucket.argmax++;
    }
  }
});
rl.on('close', () => {
  console.log('DODUO', which, 'test-split games', games);
  for (const [k, b] of Object.entries(T)) console.log(' ', k.padEnd(7), 'slot-decisions', b.n, ' predicted P(protect)', (b.pred / b.n).toFixed(3), ' humans', (b.act / b.n).toFixed(3), ' argmax', (b.argmax / b.n).toFixed(3));
});
