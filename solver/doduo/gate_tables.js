/* solver/doduo/gate_tables.js — the ablation tables, read out of a finished solver/doduo/eval_gates.js run.
 *
 *   node solver/doduo/gate_tables.js <out-dir>      -> prints the tables and writes <out-dir>/tables.json
 *
 * Reads only the run's decisions-<shard>.jsonl files (never an unfinished run: it refuses when summary.json is
 * missing). What it adds to summary.json is the SHAPE of each gate's removals — which moves MAG calls dead or soft,
 * which (click, partner click) move pairs the pair gate cuts, and whether any removal is claimed by both gates — so
 * the claim "the two gates remove different things" is a table and not a sentence.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const dir = path.resolve(process.argv[2] || '.');
if (!fs.existsSync(path.join(dir, 'summary.json'))) { console.error('gate_tables: no summary.json in ' + dir + ' — the run is not finished'); process.exit(2); }
const recs = [];
for (const f of fs.readdirSync(dir).filter(f => /^decisions-\d+\.jsonl$/.test(f))) {
  for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) if (l) recs.push(JSON.parse(l));
}
const ok = recs.filter(r => !r.error && !r.unmatched);
const moveOf = key => { const m = /^\d:m:([a-z0-9]+)/.exec(key) || /^m:([a-z0-9]+)/.exec(key); return m ? m[1] : key.replace(/^\d:/, ''); };
const tally = (arr) => { const t = {}; for (const x of arr) t[x] = (t[x] || 0) + 1; return Object.entries(t).sort((a, b) => b[1] - a[1]); };
const dead = tally(ok.flatMap(r => r.dead.map(moveOf)));
const soft = tally(ok.flatMap(r => r.soft.map(moveOf)));
/* pair-cut examples carry "<a> + <b> @slot": the cut click is the one at @slot, its partner the other */
const pairShape = tally(ok.flatMap(r => (r.pair_cut_examples || []).map(e => {
  const m = /^(.*) \+ (.*) @(\d)$/.exec(e); if (!m) return e;
  const a = [m[1], m[2]], k = +m[3];
  const cut = a[k], partner = a[1 - k];
  const nm = x => (x.startsWith('sw') ? 'switch' : x.startsWith('m:') ? x.split(':')[1] + (/:-\d/.test(x) ? '@ally' : '') : x);
  return nm(cut) + '  beside  ' + nm(partner);
})));
const out = {
  run: dir, decisions: ok.length,
  mag_dead_by_move: dead.slice(0, 40), mag_soft_by_move: soft.slice(0, 40),
  pair_cut_shapes_from_examples: pairShape.slice(0, 40),
  caption: 'pair shapes are read from the first 12 cut joints each decision recorded (pair_cut_examples), so they show what exists and its rough weight, not the full population; the totals are summary.json\'s',
};
fs.writeFileSync(path.join(dir, 'tables.json'), JSON.stringify(out, null, 1));
console.log('decisions', ok.length);
console.log('MAG dead, by move:', dead.slice(0, 20).map(([k, v]) => k + ' ' + v).join(', '));
console.log('MAG soft, by move:', soft.slice(0, 20).map(([k, v]) => k + ' ' + v).join(', '));
console.log('pair cuts, by shape (from examples):'); for (const [k, v] of pairShape.slice(0, 25)) console.log('  ' + v + '  ' + k);
