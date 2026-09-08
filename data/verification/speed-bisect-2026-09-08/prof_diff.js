/* prof_diff.js — MEASURE, 2026-09-08. Two .cpuprofile files, self time by FUNCTION NAME, differenced.
 *
 * Line numbers move between releases and names mostly do not, so the join is on
 * bucket + function name. A name that appears in one profile and not the other is printed as NEW or
 * GONE rather than dropped — an absent row is the most interesting kind here.
 *
 * The two runs must be the same sample (same pairs/per-pair/reps/cap) or this is meaningless; that
 * is the caller's job and the report states it.
 *
 * Usage: node prof_diff.js <old.cpuprofile> <new.cpuprofile> [--top 40] [--grep RE] */
'use strict';
const fs = require('fs');
function selfByName(file) {
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  const byId = new Map();
  for (const n of p.nodes) byId.set(n.id, n);
  const out = new Map();
  let total = 0;
  for (let i = 0; i < p.samples.length; i++) {
    const d = p.timeDeltas[i] || 0;
    if (d < 0) continue;
    total += d;
    const n = byId.get(p.samples[i]);
    if (!n) continue;
    const cf = n.callFrame || {};
    const url = cf.url || '';
    let b = 'other';
    if (/data[\\/]releases[\\/][0-9a-f]+[\\/]engine[\\/]medicham2-browser\.js/.test(url)) b = 'medicham2';
    else if (/data[\\/]releases[\\/][0-9a-f]+[\\/]engine[\\/]rollout_leaf\.js/.test(url)) b = 'rollout_leaf';
    else if (/data[\\/]releases[\\/][0-9a-f]+[\\/]/.test(url)) b = 'release-other:' + url.replace(/^.*[\\/]/, '');
    else if (/pokemon-showdown/.test(url)) b = 'showdown';
    else if (/node:/.test(url)) b = 'node';
    else if (/game_differential|diff_swarm|bench_two_engines/.test(url)) b = 'harness';
    else if (!url) b = 'vm';
    const k = b + '  ' + (cf.functionName || '(anonymous)');
    out.set(k, (out.get(k) || 0) + d);
  }
  return { out, total };
}
const A = selfByName(process.argv[2]);
const B = selfByName(process.argv[3]);
const TOP = +((process.argv.indexOf('--top') >= 0 && process.argv[process.argv.indexOf('--top') + 1]) || 40);
const GREP = process.argv.indexOf('--grep') >= 0 ? new RegExp(process.argv[process.argv.indexOf('--grep') + 1], 'i') : null;
const keys = new Set([...A.out.keys(), ...B.out.keys()]);
const rows = [];
for (const k of keys) {
  if (GREP && !GREP.test(k)) continue;
  const a = (A.out.get(k) || 0) / 1000, b = (B.out.get(k) || 0) / 1000;
  rows.push({ k, a, b, d: b - a, r: a > 0 ? b / a : Infinity });
}
const isMedi = k => k.startsWith('medicham2') || k.startsWith('rollout_leaf') || k.startsWith('release-other');
const sumA = rows.filter(r => isMedi(r.k)).reduce((s, r) => s + r.a, 0);
const sumB = rows.filter(r => isMedi(r.k)).reduce((s, r) => s + r.b, 0);
console.log('\n  OLD ' + process.argv[2]);
console.log('  NEW ' + process.argv[3]);
console.log('  MEDICHAM-side self time: ' + sumA.toFixed(0) + ' ms -> ' + sumB.toFixed(0) + ' ms  ('
  + (sumB / sumA).toFixed(2) + 'x)');
console.log('\n  BIGGEST ABSOLUTE INCREASES (ms of self time added)');
console.log('    ' + 'old'.padStart(8) + ' ' + 'new'.padStart(8) + ' ' + 'delta'.padStart(8) + ' '
  + 'x'.padStart(6) + '  ' + '%of rise'.padStart(8) + '  function');
const rise = sumB - sumA;
for (const r of rows.filter(x => isMedi(x.k)).sort((x, y) => y.d - x.d).slice(0, TOP)) {
  console.log('    ' + r.a.toFixed(1).padStart(8) + ' ' + r.b.toFixed(1).padStart(8) + ' '
    + r.d.toFixed(1).padStart(8) + ' ' + (r.a > 0 ? r.r.toFixed(2) : 'NEW').padStart(6) + '  '
    + (100 * r.d / rise).toFixed(1).padStart(7) + '%  ' + r.k);
}
console.log('');
