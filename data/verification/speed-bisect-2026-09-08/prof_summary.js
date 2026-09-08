/* prof_summary.js — MEASURE, 2026-09-08. Reads a V8 .cpuprofile written by `node --cpu-prof` and
 * prints SELF time by function, split by which file the frame lives in.
 *
 * It exists because a profile beats an opinion and because the two arms of bench_two_engines.js are
 * in one process: frames under data/releases/<id>/engine/ are MEDICHAM, frames under the Showdown
 * checkout are the control arm, and they must never be added together.
 *
 * Usage: node prof_summary.js <file.cpuprofile> [--top 40] [--only medicham|showdown|all]
 * Every failure below throws with the path it was given. */
'use strict';
const fs = require('fs');
const file = process.argv[2];
if (!file) throw new Error('usage: node prof_summary.js <file.cpuprofile> [--top N] [--only X]');
const TOP = +((process.argv.indexOf('--top') >= 0 && process.argv[process.argv.indexOf('--top') + 1]) || 40);
const ONLY = (process.argv.indexOf('--only') >= 0 && process.argv[process.argv.indexOf('--only') + 1]) || 'all';
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map();
for (const n of p.nodes) byId.set(n.id, n);
/* self time: V8 gives samples[] and timeDeltas[] in microseconds, one delta per sample. */
const self = new Map();
let total = 0;
for (let i = 0; i < p.samples.length; i++) {
  const d = p.timeDeltas[i] || 0;
  if (d < 0) continue;
  total += d;
  self.set(p.samples[i], (self.get(p.samples[i]) || 0) + d);
}
function bucket(url) {
  if (!url) return 'vm';
  if (/data[\\/]releases[\\/][0-9a-f]+[\\/]engine[\\/]medicham2-browser\.js/.test(url)) return 'medicham2';
  if (/data[\\/]releases[\\/][0-9a-f]+[\\/]engine[\\/]rollout_leaf\.js/.test(url)) return 'rollout_leaf';
  if (/data[\\/]releases[\\/][0-9a-f]+[\\/]/.test(url)) return 'release-other';
  if (/pokemon-showdown/.test(url)) return 'showdown';
  if (/node:/.test(url)) return 'node-internal';
  if (/game_differential|diff_swarm|bench_two_engines/.test(url)) return 'harness';
  return 'other';
}
const rows = [];
const buckets = new Map();
for (const [id, us] of self) {
  const n = byId.get(id);
  if (!n) continue;
  const cf = n.callFrame || {};
  const b = bucket(cf.url);
  buckets.set(b, (buckets.get(b) || 0) + us);
  rows.push({ b, name: cf.functionName || '(anonymous)', line: (cf.lineNumber == null ? -1 : cf.lineNumber + 1), us });
}
console.log('\nprofile ' + file);
console.log('  total sampled ' + (total / 1000).toFixed(0) + ' ms across ' + p.samples.length + ' samples\n');
console.log('  BY FILE BUCKET');
for (const [b, us] of [...buckets].sort((a, c) => c[1] - a[1])) {
  console.log('    ' + b.padEnd(16) + (us / 1000).toFixed(0).padStart(8) + ' ms  ' + (100 * us / total).toFixed(1).padStart(5) + '%');
}
/* merge rows with the same bucket+name+line */
const key = r => r.b + '|' + r.name + '|' + r.line;
const merged = new Map();
for (const r of rows) {
  const k = key(r);
  if (!merged.has(k)) merged.set(k, { ...r });
  else merged.get(k).us += r.us;
}
let list = [...merged.values()];
if (ONLY !== 'all') list = list.filter(r => r.b.indexOf(ONLY) === 0 || (ONLY === 'medicham' && (r.b === 'medicham2' || r.b === 'rollout_leaf')));
list.sort((a, b) => b.us - a.us);
const sub = list.reduce((a, r) => a + r.us, 0);
console.log('\n  TOP SELF TIME' + (ONLY === 'all' ? '' : '  (only=' + ONLY + ', subtotal ' + (sub / 1000).toFixed(0) + ' ms)'));
console.log('    ' + 'ms'.padStart(8) + ' ' + '%tot'.padStart(6) + ' ' + '%sub'.padStart(6) + '  bucket           line   function');
for (const r of list.slice(0, TOP)) {
  console.log('    ' + (r.us / 1000).toFixed(1).padStart(8) + ' ' + (100 * r.us / total).toFixed(2).padStart(6)
    + ' ' + (100 * r.us / sub).toFixed(2).padStart(6) + '  ' + r.b.padEnd(15) + String(r.line).padStart(6) + '   ' + r.name);
}
console.log('');
