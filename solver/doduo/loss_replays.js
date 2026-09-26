/* solver/doduo/loss_replays.js — WHAT THE REPLAY SAYS about every human click a gate cut (eval_gates.js losses).
 *
 *   node solver/doduo/loss_replays.js <eval summary.json> [--raw <dir of raw .jsonl.gz>] [--out <file>]
 *
 * For each loss: the replay's block for that turn, the lines that follow each CUT click of the human's side (the click's
 * `|move|` line and what the log says next, up to the next `|move|`), and a first-pass reading of what happened, from
 * the protocol alone: `failed` (-fail / -immune / -miss / a Protect -activate on the target / "But it failed" notes),
 * `not used` (the body never clicked it: fainted, flinched, fully paralysed, switched), `landed` (a status / volatile /
 * boost / damage line on the target), or `no visible effect`. For a flinch move it also reads whether the target
 * then `|cant|...|flinch`. The reading is a triage for a human reading the lines, which are printed in full.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SUM = argv[0];
const RAW = flag('--raw', 'C:/Users/willj/Projects/Pokemon/ABRA/data/raw/games.gen9championsvgc2026regmcbo3');
const OUT = flag('--out', null);
const S = JSON.parse(fs.readFileSync(SUM, 'utf8'));
const need = new Set(S.losses.map(l => l.id));
const logs = new Map();
for (const f of fs.readdirSync(RAW).filter(f => f.endsWith('.jsonl.gz')).sort()) {
  const txt = zlib.gunzipSync(fs.readFileSync(path.join(RAW, f))).toString('utf8');
  for (const line of txt.split('\n')) {
    if (!line) continue;
    const m = /^\{"id":"([^"]+)"/.exec(line);
    if (!m || !need.has(m[1]) || logs.has(m[1])) continue;
    logs.set(m[1], JSON.parse(line).log);
  }
}
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const out = [];
for (const l of S.losses) {
  const log = logs.get(l.id);
  const rec = { id: l.id, turn: l.turn, p: l.p, mag: l.mag, pair: l.pair, actives: l.actives, foes: l.foes, cut: [] };
  if (!log) { rec.missing = true; out.push(rec); continue; }
  const L = log.split('\n');
  const a = L.findIndex(x => x === '|turn|' + l.turn);
  const b = L.findIndex((x, i) => i > a && /^\|turn\|/.test(x));
  const block = a >= 0 ? L.slice(a, b > 0 ? b : L.length) : [];
  rec.block_lines = block.length;
  const verd = (l.loss && l.loss.verdicts) || [];
  const pairSlot = l.pair && l.loss && l.loss.pair ? l.loss.pair.slot : null;
  l.human.forEach((h, k) => {
    if (!h) return;
    const v = verd[k];
    const isCut = (v && v.v === 'dead') || (pairSlot === k);
    if (!isCut) return;
    const mv = h.split(':')[1];
    const slot = l.p + (k === 0 ? 'a' : 'b');
    const i = block.findIndex(x => x.startsWith('|move|' + slot + ':') && toID(x.split('|')[3]) === mv);
    const c = { slot: k, click: h, verdict: v && v.v, purpose: v && v.purpose, why: v && v.why, by: isCut && v && v.v === 'dead' ? 'MAG' : 'PAIR' };
    if (i < 0) {
      const cant = block.find(x => x.startsWith('|cant|' + slot + ':'));
      c.reading = 'not used' + (cant ? ' (' + cant + ')' : '');
      c.lines = block.filter(x => x.includes(slot + ':')).slice(0, 6);
    } else {
      const j = block.findIndex((x, q) => q > i && /^\|(move|turn|upkeep)\|/.test(x));
      const after = block.slice(i, j > 0 ? j : Math.min(block.length, i + 8));
      c.lines = after;
      const tgt = (block[i].split('|')[4] || '').split(':')[0];
      const txt = after.slice(1).join('\n');
      if (/\|-(fail|immune|miss)\|/.test(txt) || /\|-activate\|[^|]+\|move: (Protect|Detect|Spiky Shield|Baneful Bunker|Wide Guard|Quick Guard)/.test(txt) || /\[still\]/.test(block[i]) && /-fail/.test(txt)) c.reading = 'failed';
      else if (mv && /fakeout|upperhand/.test(mv)) {
        const cant = tgt && block.some(x => x.startsWith('|cant|' + tgt + ':') && /flinch/.test(x));
        c.reading = cant ? 'landed (flinched the target)' : 'no flinch (the target was not stopped)';
      } else if (/\|-(status|start|boost|unboost|damage|sidestart|fieldstart|weather|setboost|clearboost)\|/.test(txt)) c.reading = 'landed';
      else c.reading = 'no visible effect';
    }
    rec.cut.push(c);
  });
  out.push(rec);
}
const tally = {};
for (const r of out) for (const c of r.cut) { const k = c.by + ' ' + c.reading.split(' (')[0]; tally[k] = (tally[k] || 0) + 1; }
const res = { summary: SUM, losses: S.losses.length, replays_found: out.filter(r => !r.missing).length, tally, losses_read: out };
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log(JSON.stringify(tally, null, 1));
for (const r of out) for (const c of r.cut) console.log(`${r.id} t${r.turn} ${r.p} ${c.by} ${c.click} [${c.purpose}] -> ${c.reading}\n    ` + (c.lines || []).slice(0, 5).join('\n    '));
