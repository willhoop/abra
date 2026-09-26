/* solver/arena/click_rates_read.js — the Protect-repeat and immune-hit rates of both arms of a finished SPRT, over the
 * games the SPRT COUNTED (pairs up to its stopping index, both games finished), from the `clicks` field every match
 * row carries (solver/arena/click_rates.js, solver/mew/play.js).
 *
 *   node solver/arena/click_rates_read.js <sprt result .json | a fixed match's shard directory> [--out <file>]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const file = argv[0];
const OUT = (i => (i >= 0 ? argv[i + 1] : null))(argv.indexOf('--out'));
const wilson = (k, n, z = 1.96) => { if (!n) return [0, 1]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - h) / d, (c + h) / d]; };
/* a directory instead of an SPRT result: a fixed match's shards (every finished pair counted) */
const isDir = fs.statSync(file).isDirectory();
const R = isDir ? { verdict: 'fixed match (no SPRT)', stop_pair_index: null } : JSON.parse(fs.readFileSync(file, 'utf8'));
const dir = isDir ? file : file.replace(/\.json$/, '') + '.shards';
const lines = [];
for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl$/.test(f))) lines.push(...fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
const cut = R.stop_pair_index != null ? R.stop_pair_index : Infinity;
const byPair = new Map();
for (const l of lines) { const a = byPair.get(l.pi) || []; a.push(l); byPair.set(l.pi, a); }
const counted = [];
for (const [pi, a] of byPair) if (pi <= cut && a.length === 2 && !a.some(g => g.vX == null)) counted.push(...a);
const blank = () => ({ games: 0, decisions: 0, clicks: 0, protect: 0, protect_repeat: 0, aimed: 0, immune: 0, priced_errors: 0 });
const arm = { x: blank(), y: blank() };
let missing = 0;
for (const g of counted) {
  if (!g.clicks) { missing++; continue; }
  for (const s of ['x', 'y']) { arm[s].games++; for (const k of Object.keys(g.clicks[s])) arm[s][k] += g.clicks[s][k]; }
}
const rates = s => ({
  protect_repeat_rate: arm[s].protect ? arm[s].protect_repeat / arm[s].protect : null, protect_repeat_ci95: wilson(arm[s].protect_repeat, arm[s].protect),
  immune_hit_rate: arm[s].aimed ? arm[s].immune / arm[s].aimed : null, immune_hit_ci95: wilson(arm[s].immune, arm[s].aimed),
  protect_per_decision: arm[s].decisions ? arm[s].protect / arm[s].decisions : null });
const out = { sprt: file, verdict: R.verdict, stop_pair_index: R.stop_pair_index, counted_games: counted.length, rows_without_clicks: missing,
  x: Object.assign({ name: (R.x && R.x.name) || (R.specs && R.specs.x && R.specs.x.name) || 'x' }, arm.x, rates('x')),
  y: Object.assign({ name: (R.y && R.y.name) || (R.specs && R.specs.y && R.specs.y.name) || 'y' }, arm.y, rates('y')) };
console.log(JSON.stringify(out, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
