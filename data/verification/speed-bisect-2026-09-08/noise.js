/* noise.js — MEASURE, 2026-09-08. Is the Showdown-normalised figure actually contention-proof?
 *
 * LESSONS §9: measure the noise floor before believing an effect. Here the question is narrower and
 * has to be answered before any filtering rule is chosen — does dividing by the Showdown leg
 * measured in the SAME process remove the contention, or only look like it does? If it does, the
 * cleanliness filter is unnecessary and throwing 80% of the legs away is a choice that costs points
 * for nothing. If it does not, the filter is load-bearing and its threshold has to be stated.
 *
 * Prints: the Showdown-inflation distribution, the correlation of inflation with the raw MEDICHAM
 * figure and with the normalised one, and the within-release half-split spread of each. */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = __dirname;
const ids = fs.readFileSync(path.join(DIR, 'candidates.txt'), 'utf8').trim().split(/\r?\n/);
const all = [];
const files = fs.readdirSync(DIR);
for (const id of ids) {
  for (const f of files) {
    const m = f.match(new RegExp('^r-' + id + '-p(\\d+)\\.json$'));
    if (!m) continue;
    let j; try { j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); }
    catch (e) { console.log('  UNREADABLE ' + f + ': ' + e.message); continue; }
    const c = j.by_cap && j.by_cap['60'];
    if (!c) { console.log('  NO CAP60 ' + f); continue; }
    for (const l of c.legs) all.push({ id, pass: +m[1], sd: l.showdown.play_ms_per_turn,
      me: l.medicham.play_ms_per_turn, norm: l.medicham.play_ms_per_turn / l.showdown.play_ms_per_turn });
  }
}
if (!all.length) throw new Error('no legs found in ' + DIR);
const sdmin = Math.min(...all.map(a => a.sd));
const sorted = all.map(a => a.sd).sort((x, y) => x - y);
const q = p => sorted[Math.floor(p * (sorted.length - 1))];
console.log('\n  legs ' + all.length + '   showdown ms/turn  min ' + sdmin.toFixed(3)
  + '  p25 ' + q(.25).toFixed(3) + '  p50 ' + q(.5).toFixed(3) + '  p75 ' + q(.75).toFixed(3)
  + '  p90 ' + q(.9).toFixed(3) + '  max ' + sorted[sorted.length - 1].toFixed(2));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
function corr(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  const cov = xs.map((x, i) => (x - mx) * (ys[i] - my)).reduce((a, b) => a + b, 0);
  const sx = Math.sqrt(xs.map(x => (x - mx) ** 2).reduce((a, b) => a + b, 0));
  const sy = Math.sqrt(ys.map(y => (y - my) ** 2).reduce((a, b) => a + b, 0));
  return cov / (sx * sy);
}
const infl = all.map(a => Math.log(a.sd / sdmin));
console.log('  corr(log showdown inflation, log RAW medicham ms/turn)  = ' + corr(infl, all.map(a => Math.log(a.me))).toFixed(3));
console.log('  corr(log showdown inflation, log NORMALISED medicham)   = ' + corr(infl, all.map(a => Math.log(a.norm))).toFixed(3));
/* Within-release spread: the same engine measured more than once. This IS the noise floor for a step. */
const byRel = new Map();
for (const a of all) { if (!byRel.has(a.id)) byRel.set(a.id, []); byRel.get(a.id).push(a); }
const spreads = { raw: [], norm: [] };
for (const [, ls] of byRel) {
  if (ls.length < 2) continue;
  const r = ls.map(l => l.me).sort((a, b) => a - b), n = ls.map(l => l.norm).sort((a, b) => a - b);
  spreads.raw.push(100 * (r[r.length - 1] - r[0]) / r[0]);
  spreads.norm.push(100 * (n[n.length - 1] - n[0]) / n[0]);
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
console.log('  WITHIN-RELEASE SPREAD (max/min over its own legs, ' + spreads.raw.length + ' releases with >=2):');
console.log('    raw ms/turn   median ' + med(spreads.raw).toFixed(1) + '%   worst ' + Math.max(...spreads.raw).toFixed(0) + '%');
console.log('    normalised    median ' + med(spreads.norm).toFixed(1) + '%   worst ' + Math.max(...spreads.norm).toFixed(0) + '%');
console.log('');
/* ---- THRESHOLD SWEEP. Choosing the filter by looking at the answer is exactly the failure this
 * project keeps paying for, so the criterion is fixed FIRST and is about the noise floor only:
 * take the LOOSEST showdown-inflation threshold whose median within-release normalised spread is
 * below 10%, which is the size of the smallest step this curve is asked to resolve. */
console.log('  THRESHOLD SWEEP — showdown inflation cap vs kept legs and the noise floor');
console.log('    cap    legs  releases>=2   median norm spread   worst');
for (const cap of [1.1, 1.15, 1.2, 1.25, 1.4, 1.5, 2.0, 3.0, 99]) {
  const keep = all.filter(a => a.sd <= sdmin * cap);
  const m = new Map();
  for (const a of keep) { if (!m.has(a.id)) m.set(a.id, []); m.get(a.id).push(a); }
  const sp = [];
  for (const [, ls] of m) { if (ls.length < 2) continue;
    const n = ls.map(l => l.norm).sort((a, b) => a - b);
    sp.push(100 * (n[n.length - 1] - n[0]) / n[0]); }
  console.log('    ' + String(cap).padStart(5) + String(keep.length).padStart(7)
    + String(sp.length).padStart(13) + (sp.length ? med(sp).toFixed(1) : 'n/a').padStart(21) + '%'
    + (sp.length ? Math.max(...sp).toFixed(0) : 'n/a').padStart(8) + '%'
    + '   (releases with >=1 leg: ' + new Set(keep.map(a => a.id)).size + ')');
}
console.log('');
