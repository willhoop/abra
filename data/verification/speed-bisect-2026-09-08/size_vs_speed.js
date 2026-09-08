/* size_vs_speed.js — MEASURE, 2026-09-08. Does the slowdown track how much CODE the simulator has?
 *
 * WHY IT IS ASKED. The measurable window starts 2026-08-12 because today's `game_differential.js`
 * refuses every older release. Both disputed historical figures were taken on 2026-08-06, inside
 * the blind window. If the relationship between simulator size and cost is tight ACROSS THE WINDOW
 * WE CAN SEE, that is a basis for saying what the blind window plausibly holds — clearly labelled as
 * an extrapolation, never as a measurement.
 *
 * SIZE IS NON-COMMENT BYTES, NOT FILE BYTES. medicham2-browser.js is ~68% comment lines and comments
 * cost parse time (which is excluded from every figure here) and nothing else. A curve against file
 * size would be a curve against how much this project writes down.
 *
 * The comment stripper is deliberately crude — it removes /* ... *​/ blocks and // lines and does not
 * try to respect strings or regexes containing those sequences. It is applied IDENTICALLY to every
 * release, so a constant bias cancels in a ratio; it is not a source-of-truth line count.
 */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = __dirname;
const ROOT = path.join(DIR, '..', '..', '..');
const curve = JSON.parse(fs.readFileSync(path.join(DIR, 'curve.json'), 'utf8'));
function codeBytes(file) {
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.split(/\r?\n/).map(l => l.replace(/^\s*\/\/.*$/, '')).filter(l => l.trim().length).join('\n');
  return s.length;
}
const rows = [];
for (const r of curve.rows) {
  const f = path.join(ROOT, 'data', 'releases', r.id, 'engine', 'medicham2-browser.js');
  let cb = null;
  try { cb = codeBytes(f); } catch (e) { console.log('  UNREADABLE ' + r.id + ': ' + e.message); continue; }
  rows.push({ id: r.id, cut: r.cut, code: cb, all: fs.statSync(f).size, norm: r.norm });
}
if (rows.length < 3) throw new Error('too few resolved points to relate size to speed');
const base = rows[0];
console.log('\n  cut               release        code KB   x(code)   norm    x(speed)   ratio speed/code');
for (const r of rows) {
  const xc = r.code / base.code, xs = r.norm / base.norm;
  console.log('  ' + r.cut.slice(0, 16) + '  ' + r.id + '  ' + (r.code / 1024).toFixed(0).padStart(7)
    + '   ' + xc.toFixed(3).padStart(6) + '  ' + r.norm.toFixed(4) + '   ' + xs.toFixed(3).padStart(6)
    + '        ' + (xs / xc).toFixed(3));
}
const xs = rows.map(r => Math.log(r.code)), ys = rows.map(r => Math.log(r.norm));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const mx = mean(xs), my = mean(ys);
const cov = xs.map((x, i) => (x - mx) * (ys[i] - my)).reduce((a, b) => a + b, 0);
const vx = xs.map(x => (x - mx) ** 2).reduce((a, b) => a + b, 0);
const vy = ys.map(y => (y - my) ** 2).reduce((a, b) => a + b, 0);
const slope = cov / vx, r2 = (cov * cov) / (vx * vy);
console.log('\n  log(normalised cost) = ' + slope.toFixed(3) + ' * log(non-comment bytes) + c'
  + '     R^2 = ' + r2.toFixed(3) + '   over ' + rows.length + ' resolved releases');
console.log('  (slope 1.0 would mean cost grows exactly in proportion to code)');
fs.writeFileSync(path.join(DIR, 'size-vs-speed.json'),
  JSON.stringify({ generated: new Date().toISOString(), slope, r2, rows }, null, 1) + '\n');
console.log('  wrote size-vs-speed.json\n');
