/* cores.js — 2-mon CORES (pairs brought together) and which cores beat which.
 * Enumerates the C(4,2)=6 pairs inside each side's actual bring, keeps the most common K cores,
 * and builds a core x core matchup matrix from real outcomes (Wilson CIs), same shape as
 * data/guru-matchups.json so SLOWKING and the Hodge decomposition can consume it.
 *   node engine/cores.js   ->  data/core-matchups.json     (K via env CORES, default 24)
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const STORE = path.join(ROOT, 'data', 'games.ladder.jsonl');
const OUT = path.join(ROOT, 'data', 'core-matchups.json');
const K = +(process.env.CORES || 24);
const idn = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const pairsOf = four => {
  const out = [];
  for (let i = 0; i < four.length; i++) for (let j = i + 1; j < four.length; j++)
    out.push([four[i], four[j]].sort().join('+'));
  return out;
};

// pass 1: rows + core frequency
const seen = new Set(); const rows = []; const freq = {};
for (const line of fs.readFileSync(STORE, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let g; try { g = JSON.parse(line); } catch (e) { continue; }
  if (seen.has(g.id)) continue; seen.add(g.id);
  if (!g.winner || g.p1.bot || g.p2.bot) continue;
  const b1 = (g.brought && g.brought.p1 || []).map(idn), b2 = (g.brought && g.brought.p2 || []).map(idn);
  if (b1.length < 2 || b2.length < 2) continue;
  const p1win = idn(g.winner) === idn(g.p1.name);
  const c1 = pairsOf(b1), c2 = pairsOf(b2);
  for (const c of c1.concat(c2)) freq[c] = (freq[c] || 0) + 1;
  rows.push({ c1, c2, p1win });
}
const top = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, K);
const inTop = new Set(top);

// pass 2: core x core matchups (only cross pairs among the top-K cores)
const G = {}, N = {};
const bump = (o, a, b) => { o[a] = o[a] || {}; o[a][b] = (o[a][b] || 0) + 1; };
for (const r of rows) {
  const A = r.c1.filter(c => inTop.has(c)), B = r.c2.filter(c => inTop.has(c));
  for (const ca of A) for (const cb of B) {
    if (ca === cb) continue;
    bump(G, ca, cb); bump(G, cb, ca);
    if (r.p1win) bump(N, ca, cb); else bump(N, cb, ca);
  }
}
const wilson = (w, n) => {
  if (!n) return null;
  const z = 1.96, ph = w / n, d = 1 + z * z / n;
  const c = (ph + z * z / (2 * n)) / d, m = z * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n)) / d;
  return { p: +ph.toFixed(3), lo: +(c - m).toFixed(3), hi: +(c + m).toFixed(3), n };
};
const pretty = c => c.split('+').map(cap).join(' + ');
const labels = top.map(pretty);
const matrix = {};
for (let i = 0; i < top.length; i++) {
  const a = top[i]; matrix[labels[i]] = {};
  for (let j = 0; j < top.length; j++) {
    if (i === j) { matrix[labels[i]][labels[j]] = null; continue; }
    const b = top[j], n = (G[a] && G[a][b]) || 0, w = (N[a] && N[a][b]) || 0;
    matrix[labels[i]][labels[j]] = n ? wilson(w, n) : null;
  }
}
const out = {
  generated: 'engine/cores.js — 2-mon core (pair) matchup matrix from REAL brings & outcomes (Wilson CIs)',
  n_games: rows.length, n_archetypes: top.length, archetypes: labels,
  core_frequency: Object.fromEntries(top.map((c, i) => [labels[i], freq[c]])),
  matrix,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`core matrix: ${rows.length} games, top ${top.length} cores`);
console.log('  top cores:', top.slice(0, 8).map(c => `${pretty(c)} (${freq[c]})`).join(' | '));
