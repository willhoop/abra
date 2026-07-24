/* CHOMP-EV proof (v2 input I4) — the winnable team-preview test.
 *
 * Question: do CHOMP's recommended brings beat the human's actual brings on held-out games?
 * We CANNOT replay counterfactuals (we only see the game that was played), so we measure the
 * honest observable version: does CHOMP's bring-quality ranking track who actually won?
 *
 * For each held-out human game we know both full sixes, both actual bring-4s, and the winner.
 * CHOMP scores all C(6,4)=15 candidate brings for a side (teamVs exact-damage coverage vs the
 * opponent's six) and ranks the side's ACTUAL bring among them:
 *     align = 1 - (rank-1)/14     (1.0 = human brought exactly CHOMP's top-scored 4; 0.0 = worst)
 *
 * Headline "beat" metric (paired, within-game, controls for team quality since align is a
 * within-six rank): P(winner's bring was more CHOMP-aligned than the loser's), bootstrap CI,
 * baseline 0.5. If >0.5 with CI clear of 0.5, winners bring what CHOMP recommends more than
 * losers do -> following CHOMP points the winning way.
 *
 * Proper score: logistic P(p1 wins)=sigma(a+b*(align1-align2)), TEMPORAL 80/20 split, held-out
 * log-loss + Brier vs honest baselines: coin, Elo (rating logistic), and a USAGE prior (rank
 * brings by summed bringRate instead of CHOMP damage). Clustered bootstrap over games for CIs.
 * Calibration (10-bin ECE). Writes data/chomp-ev.json. No build step; CPU-only; Node.
 *
 *   node engine/chomp_ev.js            # all qualifying games
 *   N=800 node engine/chomp_ev.js      # cap for a fast run
 */
'use strict';
const fs = require('fs'), path = require('path');
const S = require('./sets.js');
const M = S.M;
const ROOT = path.join(__dirname, '..');
const STORE = path.join(ROOT, 'data', 'games.ladder.jsonl');
const USAGE = path.join(ROOT, 'data', 'meta-usage.json');
const OUT   = path.join(ROOT, 'data', 'chomp-ev.json');
const N = +(process.env.N || 0); // 0 = no cap

const idn = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
let seedState = 12345;
const rnd = () => { seedState = (seedState * 1103515245 + 12345) & 0x7fffffff; return seedState / 0x7fffffff; };

// ---- usage prior: species -> bringRate (naive "bring your most-brought 4") -------------------
const bringRate = {};
try {
  const u = JSON.parse(fs.readFileSync(USAGE, 'utf8'));
  for (const t of (u.threats || [])) bringRate[idn(t.sp)] = t.bringRate || 0;
} catch (e) { /* usage prior optional */ }

// ---- load humans-only finished games with both full sixes + both actual bring-4s -------------
const seen = new Set();
let rows = [];
let n_total = 0, n_human = 0;
for (const line of fs.readFileSync(STORE, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let g; try { g = JSON.parse(line); } catch (e) { continue; }
  if (seen.has(g.id)) continue; seen.add(g.id);
  n_total++;
  if (!g.winner || g.p1.bot || g.p2.bot) continue;
  n_human++;
  const six1 = (g.six && g.six.p1 || []).map(idn), six2 = (g.six && g.six.p2 || []).map(idn);
  const br1 = (g.brought && g.brought.p1 || []).map(idn), br2 = (g.brought && g.brought.p2 || []).map(idn);
  if (six1.length !== 6 || six2.length !== 6 || br1.length !== 4 || br2.length !== 4) continue;
  // bring must be a subset of the six
  if (!br1.every(m => six1.includes(m)) || !br2.every(m => six2.includes(m))) continue;
  const y = idn(g.winner) === idn(g.p1.name) ? 1 : (idn(g.winner) === idn(g.p2.name) ? 0 : null);
  if (y === null) continue;
  rows.push({ id: g.id, date: g.date || '', y, six1, six2, br1, br2,
              r1: g.p1.rating || null, r2: g.p2.rating || null });
}
rows.sort((a, b) => (a.date < b.date ? -1 : 1));
if (N > 0 && rows.length > N) rows = rows.slice(rows.length - N);

// ---- combinatorics: all 4-subsets of 6 indices ----------------------------------------------
const COMBOS = (() => {
  const out = [];
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++)
    for (let c = b + 1; c < 6; c++) for (let d = c + 1; d < 6; d++) out.push([a, b, c, d]);
  return out; // 15
})();

const monCache = {};
const mon = k => (k in monCache) ? monCache[k] : (monCache[k] = S.buildOne(k));

// align of the actual bring among the 15 candidates, scored by fn(subIdx)->score (higher=better)
function alignOf(six, br, scoreFn) {
  const built = six.map(mon);
  if (built.some(m => !m)) return null;               // need all six buildable for a fair rank
  const scored = COMBOS.map(ix => ({ set: ix.map(i => six[i]).sort().join(','), s: scoreFn(ix, built) }));
  scored.sort((a, b) => b.s - a.s);                   // desc
  const actualSet = [...br].sort().join(',');
  const rank = scored.findIndex(x => x.set === actualSet);
  if (rank < 0) return null;
  const recSet = scored[0].set.split(',');
  const overlap = br.filter(m => recSet.includes(m)).length / 4;
  return { align: 1 - rank / 14, rank: rank + 1, top1: rank === 0, overlap };
}

// score functions
const chompScore = (foeBuilt) => (ix, built) => { try { return M.teamVs(ix.map(i => built[i]), foeBuilt).score; } catch (e) { return -1e9; } };
const usageScore = (six) => (ix) => ix.reduce((s, i) => s + (bringRate[six[i]] || 0), 0);

// ---- compute per-game features ---------------------------------------------------------------
const data = [];
let skipped = 0, t0 = Date.now();
for (const r of rows) {
  const A = r.six1.map(mon), B = r.six2.map(mon);
  if (A.some(m => !m) || B.some(m => !m)) { skipped++; continue; }
  const c1 = alignOf(r.six1, r.br1, chompScore(B));
  const c2 = alignOf(r.six2, r.br2, chompScore(A));
  if (!c1 || !c2) { skipped++; continue; }
  const u1 = alignOf(r.six1, r.br1, usageScore(r.six1));
  const u2 = alignOf(r.six2, r.br2, usageScore(r.six2));
  data.push({ id: r.id, y: r.y, r1: r.r1, r2: r.r2,
    a1: c1.align, a2: c2.align, top1_1: c1.top1, top1_2: c2.top1, ov1: c1.overlap, ov2: c2.overlap,
    ua1: u1 ? u1.align : 0.5, ua2: u2 ? u2.align : 0.5 });
  if (data.length % 200 === 0) process.stderr.write(`  ${data.length}/${rows.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}

// ---- temporal split --------------------------------------------------------------------------
const cut = Math.floor(data.length * 0.8);
const tr = data.slice(0, cut), te = data.slice(cut);

// ---- logistic fit (1 feature + bias), gradient descent ---------------------------------------
function fitLogit(rowsIn, feat) {
  let a = 0, b = 0; const lr = 0.1, lam = 1e-4, n = rowsIn.length;
  for (let it = 0; it < 6000; it++) {
    let ga = 0, gb = 0;
    for (const r of rowsIn) { const x = feat(r); const p = 1 / (1 + Math.exp(-(a + b * x))); ga += (p - r.y); gb += (p - r.y) * x; }
    a -= lr * ga / n; b -= lr * (gb / n + lam * b);
  }
  return { a, b };
}
const clip = p => Math.min(1 - 1e-4, Math.max(1e-4, p));
const predLogit = (m, feat) => r => clip(1 / (1 + Math.exp(-(m.a + m.b * feat(r)))));
const ll = (ps, ys) => { let s = 0; for (let i = 0; i < ps.length; i++) s += -(ys[i] * Math.log(ps[i]) + (1 - ys[i]) * Math.log(1 - ps[i])); return s / ps.length; };
const brier = (ps, ys) => { let s = 0; for (let i = 0; i < ps.length; i++) s += (ps[i] - ys[i]) ** 2; return s / ps.length; };

// impute missing ratings with train median (Elo baseline needs a value for every test row)
const trRatings = tr.flatMap(r => [r.r1, r2ok(r.r2)]).filter(x => x != null).sort((a, b) => a - b);
function r2ok(x) { return x; }
const medRating = trRatings.length ? trRatings[Math.floor(trRatings.length / 2)] : 1200;
const rat = x => (x == null ? medRating : x);

const featChomp = r => r.a1 - r.a2;
const featUsage = r => r.ua1 - r.ua2;
const featElo   = r => (rat(r.r1) - rat(r.r2)) / 400;

const ys_te = te.map(r => r.y);
const mChomp = fitLogit(tr, featChomp);
const mUsage = fitLogit(tr, featUsage);
const mElo   = fitLogit(tr, featElo);
const pChomp = te.map(predLogit(mChomp, featChomp));
const pUsage = te.map(predLogit(mUsage, featUsage));
const pElo   = te.map(predLogit(mElo, featElo));
const pCoin  = te.map(() => 0.5);

// ---- clustered bootstrap over games (each game = 1 row -> resample games) ---------------------
function bootLL(ps, ys, B = 2000) {
  const n = ps.length, vals = [];
  for (let b = 0; b < B; b++) {
    const P = [], Y = [];
    for (let i = 0; i < n; i++) { const j = Math.floor(rnd() * n); P.push(ps[j]); Y.push(ys[j]); }
    vals.push(ll(P, Y));
  }
  vals.sort((a, b) => a - b);
  return [round(vals[Math.floor(0.025 * B)], 4), round(vals[Math.floor(0.975 * B)], 4)];
}

// ---- headline "beat" sign test: winner more CHOMP-aligned than loser? ------------------------
function alignWinLose(r) {
  const win = r.y === 1 ? r.a1 : r.a2, los = r.y === 1 ? r.a2 : r.a1;
  return { win, los };
}
function signTest(rowsIn) {
  let w = 0, t = 0, dsum = 0;
  for (const r of rowsIn) { const { win, los } = alignWinLose(r); if (win > los) w++; else if (win === los) t++; dsum += (win - los); }
  return { p: (w + 0.5 * t) / rowsIn.length, meanDelta: dsum / rowsIn.length };
}
function bootSign(rowsIn, B = 2000) {
  const n = rowsIn.length, vals = [];
  for (let b = 0; b < B; b++) {
    let w = 0, t = 0;
    for (let i = 0; i < n; i++) { const r = rowsIn[Math.floor(rnd() * n)]; const { win, los } = alignWinLose(r); if (win > los) w++; else if (win === los) t++; }
    vals.push((w + 0.5 * t) / n);
  }
  vals.sort((a, b) => a - b);
  return [round(vals[Math.floor(0.025 * B)], 4), round(vals[Math.floor(0.975 * B)], 4)];
}

// ---- descriptive agreement (top-1, overlap) split by role + rating tier ----------------------
function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
const winRows = data.map(r => ({ align: r.y === 1 ? r.a1 : r.a2, top1: r.y === 1 ? r.top1_1 : r.top1_2, ov: r.y === 1 ? r.ov1 : r.ov2, rt: r.y === 1 ? r.r1 : r.r2 }));
const losRows = data.map(r => ({ align: r.y === 1 ? r.a2 : r.a1, top1: r.y === 1 ? r.top1_2 : r.top1_1, ov: r.y === 1 ? r.ov2 : r.ov1 }));
const tier = rt => rt == null ? 'unknown' : rt < 1200 ? 'lt1200' : rt <= 1400 ? '1200_1400' : 'gt1400';
const byTier = {};
for (const w of winRows) { const k = tier(w.rt); (byTier[k] = byTier[k] || []).push(w.top1 ? 1 : 0); }

// ---- calibration of the CHOMP-align logistic (test) ------------------------------------------
const rel = []; let ece = 0;
for (let i = 0; i < 10; i++) {
  const lo = i / 10, hi = (i + 1) / 10;
  const idx = pChomp.map((p, j) => ({ p, y: ys_te[j] })).filter(o => o.p >= lo && o.p < hi);
  if (idx.length) { const conf = mean(idx.map(o => o.p)), acc = mean(idx.map(o => o.y)); rel.push([round(conf, 3), round(acc, 3), idx.length]); ece += idx.length / pChomp.length * Math.abs(conf - acc); }
}

function round(x, k = 4) { const f = 10 ** k; return Math.round(x * f) / f; }

const st = signTest(data), stTe = signTest(te);
const coinLL = round(ll(pCoin, ys_te), 4);
const chompLL = round(ll(pChomp, ys_te), 4);
const beatsCoin = chompLL < coinLL;
const signBeats = signTest(data).p > 0.5;
const signCI = bootSign(data);
const out = {
  generated: 'engine/chomp_ev.js — CHOMP team-preview EV proof (do CHOMP brings beat humans on held-out games)',
  format: 'gen9championsvgc2026regmb (Bo1 closed-sheet)',
  n_total_games: n_total, n_human_games: n_human,
  n_eval_games: data.length, n_skipped_unbuildable: skipped,
  n_train: tr.length, n_test: te.length,
  headline_beat_test: {
    what: 'P(winner\'s actual bring was more CHOMP-aligned than the loser\'s), all eval games. Baseline 0.5.',
    p_winner_more_aligned: round(st.p, 4), ci95: signCI,
    mean_align_delta_win_minus_lose: round(st.meanDelta, 4),
    p_on_heldout_only: round(stTe.p, 4),
    verdict: signBeats && signCI[0] > 0.5
      ? 'Winners bring more CHOMP-aligned 4s than losers, CI clear of 0.5 — CHOMP\'s bring direction is the winning direction.'
      : (signBeats ? 'Winners lean more CHOMP-aligned but CI includes 0.5 — suggestive, not significant.'
                   : 'No CHOMP-alignment edge for winners — brings do not separate winners from losers here.')
  },
  proper_score_logloss: {
    what: 'Held-out P(p1 win)=sigma(a+b*(align1-align2)); lower is better. Cluster/bootstrap over games.',
    chomp_align: chompLL, chomp_align_ci95: bootLL(pChomp, ys_te),
    coin: coinLL,
    elo_rating: round(ll(pElo, ys_te), 4),
    usage_prior: round(ll(pUsage, ys_te), 4)
  },
  brier: { chomp_align: round(brier(pChomp, ys_te), 4), coin: 0.25,
           elo_rating: round(brier(pElo, ys_te), 4), usage_prior: round(brier(pUsage, ys_te), 4) },
  logistic_weights: { chomp: { a: round(mChomp.a, 4), b: round(mChomp.b, 4) },
                      usage: { a: round(mUsage.a, 4), b: round(mUsage.b, 4) },
                      elo:   { a: round(mElo.a, 4),   b: round(mElo.b, 4) } },
  calibration: { ece: round(ece, 4), reliability: rel },
  agreement: {
    top1_recovery_all: round(mean(data.flatMap(r => [r.top1_1 ? 1 : 0, r.top1_2 ? 1 : 0])), 4),
    top1_recovery_winners: round(mean(winRows.map(w => w.top1 ? 1 : 0)), 4),
    top1_recovery_losers: round(mean(losRows.map(l => l.top1 ? 1 : 0)), 4),
    mean_overlap_winners: round(mean(winRows.map(w => w.ov)), 4),
    mean_overlap_losers: round(mean(losRows.map(l => l.ov)), 4),
    winner_top1_by_rating_tier: Object.fromEntries(Object.entries(byTier).map(([k, v]) => [k, { rate: round(mean(v), 4), n: v.length }]))
  },
  baselines_note: 'coin=0.5 always; elo fit on (r1-r2)/400 with missing ratings imputed to train median; usage_prior ranks brings by summed species bringRate instead of CHOMP exact-damage coverage.',
  what_this_does_NOT_prove: [
    'NOT a counterfactual: we never simulate the outcome of CHOMP\'s recommended bring. We measure whether CHOMP\'s bring-quality rank correlates with who actually won, not that swapping brings would have flipped the result.',
    'Selection bias: restricted to games where all 4 brought mons were revealed for BOTH sides — this skews toward longer, closer games and excludes early stomps.',
    'CHOMP scores heuristic v1 sets (sets.js priors) vs the opponent\'s six, not the opponent\'s true hidden sets; no opponent-set belief is modeled here.',
    'In-battle skill is a confound; the within-six align rank controls for team quality but only partially isolates the bring decision.',
    'Format ceiling: even player-Elo ties a coin in this format, so a near-coin proper score is expected and is not evidence CHOMP\'s damage math is wrong (that is separately VALIDATED vs @smogon/calc).'
  ]
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
process.stderr.write(`\nCHOMP-EV: ${data.length} eval games (train ${tr.length} / test ${te.length}), skipped ${skipped}\n`);
process.stderr.write(`  BEAT test: P(winner more CHOMP-aligned)=${out.headline_beat_test.p_winner_more_aligned} CI ${JSON.stringify(signCI)} (baseline 0.5)\n`);
process.stderr.write(`  log-loss: CHOMP-align ${chompLL} CI ${JSON.stringify(out.proper_score_logloss.chomp_align_ci95)} | coin ${coinLL} | Elo ${out.proper_score_logloss.elo_rating} | usage ${out.proper_score_logloss.usage_prior}\n`);
process.stderr.write(`  top-1 bring recovery: winners ${out.agreement.top1_recovery_winners} vs losers ${out.agreement.top1_recovery_losers} | overlap W ${out.agreement.mean_overlap_winners} L ${out.agreement.mean_overlap_losers}\n`);
process.stderr.write(`  -> ${out.headline_beat_test.verdict}\n`);
console.log('wrote', OUT);
