/* solver/porygon2/v1/calplot.js — the calibration (reliability) plot of gate (b), as a self-contained SVG, drawn from the
 * metrics artifact train.py wrote (no number is computed here; every point is read from `test.<set>.calibration`).
 *
 *   node solver/porygon2/v1/calplot.js <metrics.json> <out.svg>
 */
'use strict';
const fs = require('fs');
const [, , MET, OUT] = process.argv;
const m = JSON.parse(fs.readFileSync(MET, 'utf8'));
const sets = ['human', 'selfplay'].filter(k => m.test[k]);
const W = 360, H = 360, P = 44, GAP = 30;
const X = v => P + v * (W - 2 * P), Y = v => H - P - v * (H - 2 * P);
const COL = { v1: '#c0392b', gen5: '#2471a3' };
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sets.length * (W + GAP)}" height="${H + 20}" font-family="sans-serif" font-size="11">\n`;
sets.forEach((k, si) => {
  const ox = si * (W + GAP);
  svg += `<g transform="translate(${ox},0)">\n<rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}" fill="none" stroke="#999"/>\n`;
  svg += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}" stroke="#bbb" stroke-dasharray="4 3"/>\n`;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) svg += `<text x="${X(t)}" y="${H - P + 14}" text-anchor="middle">${t}</text><text x="${P - 6}" y="${Y(t) + 4}" text-anchor="end">${t}</text>\n`;
  svg += `<text x="${W / 2}" y="${H - 8}" text-anchor="middle">predicted P(p1 wins)</text><text x="12" y="${H / 2}" transform="rotate(-90 12 ${H / 2})" text-anchor="middle">observed win rate</text>\n`;
  const cal = m.test[k].calibration;
  let ly = P + 14;
  for (const name of ['gen5', 'v1']) {
    const pts = cal[name].bins.map(b => [X(b.pred), Y(b.won), b.n_views]);
    svg += `<polyline fill="none" stroke="${COL[name]}" stroke-width="1.6" points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>\n`;
    for (const p of pts) svg += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${Math.max(2, Math.min(6, Math.sqrt(p[2]) / 12)).toFixed(1)}" fill="${COL[name]}" fill-opacity="0.6"/>\n`;
    svg += `<text x="${P + 8}" y="${ly}" fill="${COL[name]}">${name}  ECE ${cal[name].ece}</text>\n`; ly += 14;
  }
  svg += `<text x="${W / 2}" y="${P - 10}" text-anchor="middle" font-weight="bold">${k} test (${m.test[k].v1.logloss.n_views} views)</text>\n</g>\n`;
});
svg += '</svg>\n';
fs.writeFileSync(OUT, svg);
console.log('wrote', OUT);
