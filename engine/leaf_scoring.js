/* leaf_scoring.js — HOW A LEAF IS SCORED. One implementation, verified against the published one.
 *
 *   node engine/leaf_scoring.js --verify        replay data/winrate-backtest-rows.jsonl and diff
 *                                               every scalar against data/winrate-backtest.json
 *
 * WHY THIS FILE EXISTS, AND WHY IT IS NOT A SECOND IMPLEMENTATION
 * --------------------------------------------------------------
 * `engine/backtest_winrate.js` holds the project's definition of what a leaf score IS — Brier against
 * a coin, log-loss at a named clamp, discrimination on decisive calls, ECE, the ten-bucket reliability
 * curve, the split-half noise floor. It holds them as private functions inside a script that also runs
 * fifteen minutes of rollouts and overwrites `data/winrate-backtest.json` on exit. Nothing else can
 * call them.
 *
 * CLAUDE.md's rule is that a FACT has one implementation and everybody calls it, and "what the Brier
 * score of this leaf is" is a fact. The alternative on offer was to retype the eight formulas inside
 * the next measuring script, which is exactly how `buildMon("Scizor")` came to return null and how
 * `data/guru.js` came to say 0 where its own source said 6.
 *
 * SO THE SPLIT IS NOT TRUSTED, IT IS PROVEN. `--verify` replays the committed per-game predictions in
 * `data/winrate-backtest-rows.jsonl` through the functions below and compares EVERY scalar against the
 * corresponding block of the published `data/winrate-backtest.json` — 4 leaves x 2 scopes, Brier,
 * log-loss, both paired intervals, discrimination, Wilson bounds, the p-value, ECE, MCE, all ten
 * reliability buckets and both noise floors. A single mismatch is a failure. That is a stronger claim
 * than a refactor: the published artifact was written by the other file, and this one reproduces it
 * from the evidence without touching it.
 *
 * WHAT WAS DELIBERATELY NOT DONE: `backtest_winrate.js` was NOT edited to import this. It is the
 * generator of a published artifact, it cannot be smoke-tested without overwriting that artifact (it
 * has no --out), and editing a generator you cannot run is how a red gate gets filed. Pointing it here
 * is a one-line change that belongs in the pass that next re-runs it, and it is filed in docs/MEASURE.md.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

/* WILSON COMES FROM `engine/rollout_leaf.js`, which already owns it and is byte-identical in the live
 * tree and in every release cited here. A second binomial interval in this repository is precisely the
 * thing the paragraph above is about. */
const { wilson } = require('./rollout_leaf.js');

/* ---- THE PRIMITIVES ---------------------------------------------------------------------------
 * EPS is 0.02 because that is what the 2026-08-02 and 2026-08-04 artifacts used and the numbers have
 * to stay comparable. The clamp is load-bearing and says so wherever log-loss is reported: a
 * finite-rollout leaf emits exact 0 and exact 1, so log-loss partly reports the epsilon. Brier needs
 * no clamp and is the primary. */
const EPS = 0.02;
const clamp = p => Math.max(EPS, Math.min(1 - EPS, p));
const logloss = (p, y) => -(y * Math.log(clamp(p)) + (1 - y) * Math.log(1 - clamp(p)));
const brier = (p, y) => (p - y) * (p - y);
const eloP = (a, b) => (a && b) ? 1 / (1 + Math.pow(10, (b - a) / 400)) : null;
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const r4 = x => x == null ? null : Math.round(x * 1e4) / 1e4;

/* mulberry32 — the generator `rollout_leaf` threads through its playouts and `backtest_winrate`
 * bootstraps with. Reproduced here, as it is there, because rollout_leaf does not export it; it is
 * four lines of arithmetic with no semantics of its own. The bootstrap SEED is a parameter with the
 * published default, so a second measurement can resample independently and still reproduce the first. */
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Abramowitz-Stegun 7.1.26 — the two-sided normal p-value, not worth a dependency. */
function erf(x) {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const normP = z => 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)));

/* PAIRED AND BOOTSTRAPPED. Two judges seeing the same games carry their information in the per-game
 * DIFFERENCE, not in two independent means — and log-loss differences are heavy-tailed because of the
 * clamp, which is exactly where a normal-approximation interval misleads. */
function pairedCI(d, iters, seed) {
  const m = mean(d), n = d.length;
  const rng = mulberry(seed == null ? 20260804 : seed);
  const bs = [];
  for (let it = 0; it < (iters || 2000); it++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += d[(Math.floor(rng() * n)) % n];
    bs.push(s / n);
  }
  bs.sort((a, b) => a - b);
  return { mean: r4(m), ci95: [r4(bs[Math.floor(0.025 * bs.length)]), r4(bs[Math.floor(0.975 * bs.length)])] };
}

/* TEN FIXED BUCKETS, so two runs are comparable. A quantile binning moves the buckets when the
 * predictions move and hides exactly the change worth seeing. */
function reliability(ps, ys) {
  const out = [];
  for (let b = 0; b < 10; b++) {
    const lo = b / 10, hi = (b + 1) / 10;
    const idx = [];
    for (let i = 0; i < ps.length; i++) if (ps[i] >= lo && (b === 9 ? ps[i] <= hi : ps[i] < hi)) idx.push(i);
    if (!idx.length) { out.push({ bucket: `${lo.toFixed(1)}-${hi.toFixed(1)}`, n: 0 }); continue; }
    const wins = idx.reduce((s, i) => s + ys[i], 0);
    const iv = wilson(wins, idx.length);
    out.push({ bucket: `${lo.toFixed(1)}-${hi.toFixed(1)}`, n: idx.length,
      mean_predicted: r4(mean(idx.map(i => ps[i]))), observed: r4(wins / idx.length),
      observed_ci95: [r4(iv.lo), r4(iv.hi)],
      gap: r4(wins / idx.length - mean(idx.map(i => ps[i]))) });
  }
  return out;
}

/* ---- THE BLOCK ---------------------------------------------------------------------------------
 * `rows` is [{p, y, r1, r2}]. Rows whose `p` is null are dropped and counted by the caller; a null is
 * a position the leaf refused, not a 50%.
 *
 * The DECISIVE threshold is 2 points off 0.5: a 50/50 read is not a prediction and scoring it as one
 * buries the signal in coin flips. */
function evaluate(rows, opts) {
  opts = opts || {};
  const use = rows.filter(r => r.p != null);
  if (!use.length) return null;
  const ps = use.map(r => r.p), ys = use.map(r => r.y);
  const rel = reliability(ps, ys);
  const N = ps.length;

  const dBrierCoin = use.map((r, i) => brier(ps[i], ys[i]) - brier(0.5, ys[i]));
  const dLLCoin = use.map((r, i) => logloss(ps[i], ys[i]) - logloss(0.5, ys[i]));
  const withElo = use.map((r, i) => ({ i, pe: eloP(r.r1, r.r2) })).filter(x => x.pe != null);
  const dBrierElo = withElo.map(x => brier(ps[x.i], ys[x.i]) - brier(x.pe, ys[x.i]));
  const dLLElo = withElo.map(x => logloss(ps[x.i], ys[x.i]) - logloss(x.pe, ys[x.i]));

  let dec = 0, cor = 0;
  for (let i = 0; i < N; i++) if (Math.abs(ps[i] - 0.5) > 0.02) { dec++; if ((ps[i] > 0.5) === (ys[i] === 1)) cor++; }
  const accIv = wilson(cor, dec);
  const z = dec ? (cor / dec - 0.5) / (0.5 / Math.sqrt(dec)) : 0;

  /* ECE weights each bucket by how many predictions land in it; MCE is the worst bucket with a usable
   * count. A model can have a tiny ECE and be catastrophic where it is confident, which is precisely
   * the region a search spends its time in. */
  const filled = rel.filter(b => b.n > 0);
  const ece = filled.reduce((s, b) => s + b.n * Math.abs(b.gap), 0) / N;
  const conf = filled.filter(b => b.n >= 30);
  const mce = conf.length ? Math.max(...conf.map(b => Math.abs(b.gap))) : null;

  /* THE NOISE FLOOR (LESSONS 9). One arm split in half; the spread between the halves is the smallest
   * difference that means anything at this n. An effect below it is not an effect. The split is on ROW
   * ORDER, which is the caller's ordering and is date-sorted here — so it is also a crude stability
   * check over time, and that is why it is not randomised. */
  const h = Math.floor(N / 2);
  const half = (a, b2) => mean(ps.slice(a, b2).map((p, i) => brier(p, ys[a + i])));
  const accHalf = (a, b2) => {
    let d = 0, c = 0;
    for (let i = a; i < b2; i++) if (Math.abs(ps[i] - 0.5) > 0.02) { d++; if ((ps[i] > 0.5) === (ys[i] === 1)) c++; }
    return d ? c / d : null;
  };

  return {
    n_games_scored: N,
    brier: { model: r4(mean(use.map((r, i) => brier(ps[i], ys[i])))), coin: 0.25,
             elo: withElo.length ? r4(mean(withElo.map(x => brier(x.pe, ys[x.i])))) : null,
             vs_coin_paired: pairedCI(dBrierCoin, opts.iters, opts.bootSeed),
             vs_elo_paired: withElo.length ? pairedCI(dBrierElo, opts.iters, opts.bootSeed) : null,
             elo_available_on: withElo.length },
    log_loss: { model: r4(mean(use.map((r, i) => logloss(ps[i], ys[i])))), coin: r4(Math.log(2)),
                elo: withElo.length ? r4(mean(withElo.map(x => logloss(x.pe, ys[x.i])))) : null,
                vs_coin_paired: pairedCI(dLLCoin, opts.iters, opts.bootSeed),
                vs_elo_paired: withElo.length ? pairedCI(dLLElo, opts.iters, opts.bootSeed) : null,
                clamp_eps: EPS,
                note: 'the clamp is load-bearing: a finite-rollout leaf emits exact 0 and 1, so log-loss '
                    + 'partly reports the epsilon. Brier needs no clamp and is the primary.' },
    discrimination: { decisive_calls: dec, correct: cor, accuracy: r4(dec ? cor / dec : null),
                      accuracy_ci95_wilson: [r4(accIv.lo), r4(accIv.hi)], p_value_two_sided: r4(dec ? normP(z) : 0),
                      fixed_n: true,
                      note: 'n was fixed by a power calculation before the run. This is not an interim '
                          + 'look at a sequential test and must not be read as one.' },
    calibration: { ece: r4(ece), mce_buckets_over_30: r4(mce),
                   share_in_extreme_buckets: r4((rel[0].n + rel[9].n) / N) },
    reliability_curve: rel,
    noise_floor: { split_half_brier: [r4(half(0, h)), r4(half(h, N))],
                   split_half_brier_spread: +Math.abs(half(0, h) - half(h, N)).toFixed(6),
                   split_half_accuracy: [r4(accHalf(0, h)), r4(accHalf(h, N))],
                   split_half_accuracy_spread: +Math.abs(accHalf(0, h) - accHalf(h, N)).toFixed(6),
                   note: 'one arm split in half. A difference smaller than this spread is not an effect.' },
  };
}

/* ---- POWER, COMPUTED BEFORE A RUN --------------------------------------------------------------
 * The claim under test is two-sided and about DISCRIMINATION: does the leaf name the eventual winner
 * more often than a coin? Under H0 the per-game outcome is Bernoulli(0.5).
 *
 *   n = ( z(1-a/2)*sqrt(0.25) + z(power)*sqrt(p(1-p)) )^2 / (p-0.5)^2
 *
 * MDE is the inverse: the smallest true accuracy this n separates from 0.5 at 80% power. It is the
 * number that decides what a result may be REPORTED as — an n that cannot resolve two points is not
 * entitled to say "no effect" when it sees one. */
const Z_A = 1.959963985, Z_B = 0.8416212336;
function nNeeded(p) { return Math.ceil(Math.pow(Z_A * 0.5 + Z_B * Math.sqrt(p * (1 - p)), 2) / Math.pow(p - 0.5, 2)); }
function mde(n) {
  let lo = 0.5, hi = 1;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (nNeeded(m) > n) lo = m; else hi = m; }
  return hi;
}
/* THE PAIRED MDE IS A DIFFERENT QUESTION AND NEEDS THE OBSERVED SD. Two engines scored on identical
 * positions with identical seeds produce highly correlated predictions, so the sd of their per-game
 * DIFFERENCE is far smaller than either arm's own sd — and that is what decides whether this
 * comparison can see the effect, not the sample size on its own. There is no prior for it, so it is
 * reported from the run's own paired sd and labelled as such. */
function pairedMDE(sd, n) { return (Z_A + Z_B) * sd / Math.sqrt(n); }

/* ---- SPEARMAN, WITH TIES ------------------------------------------------------------------------
 * The joint question — does engine fidelity at a position predict leaf error at that position — is a
 * MONOTONE one, and both variables are badly non-normal: divergence depth is a count with a long tail
 * and a spike, per-game Brier is bounded and bimodal. Pearson on either would report the tail.
 * Midranks, so the heavy tie structure in depth is handled rather than broken arbitrarily. */
/* THE COMPARATOR IS A THREE-WAY TEST, NOT A SUBTRACTION. `Infinity - Infinity` is NaN, and a sort
 * comparator returning NaN leaves the order engine-defined — which matters here because Infinity is a
 * real value in this data: it is how a game that NEVER diverged is ranked deepest. A subtraction would
 * have made the most interesting rows sort arbitrarily and nothing would have reported a failure. */
function rank(v) {
  const idx = v.map((x, i) => i).sort((a, b) => (v[a] < v[b] ? -1 : v[a] > v[b] ? 1 : 0));
  const r = new Array(v.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[i]]) j++;
    const mid = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = mid;
    i = j + 1;
  }
  return r;
}
function pearson(a, b) {
  const n = a.length, ma = mean(a), mb = mean(b);
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return (saa && sbb) ? sab / Math.sqrt(saa * sbb) : 0;
}
/* The interval is BOOTSTRAPPED over positions rather than taken from Fisher's z. Fisher's z assumes
 * bivariate normality, which neither variable here has, and the whole point of using a rank statistic
 * was that the marginals are the wrong shape. */
function spearman(a, b, iters, seed) {
  const ra = rank(a), rb = rank(b), n = a.length;
  const rho = pearson(ra, rb);
  const rng = mulberry(seed == null ? 20260807 : seed);
  const bs = [];
  for (let it = 0; it < (iters || 1000); it++) {
    const xa = new Array(n), xb = new Array(n);
    for (let i = 0; i < n; i++) { const j = Math.floor(rng() * n) % n; xa[i] = a[j]; xb[i] = b[j]; }
    bs.push(pearson(rank(xa), rank(xb)));
  }
  bs.sort((x, y) => x - y);
  /* The normal approximation is kept BESIDE the bootstrap, never instead of it, because it is what
   * the power statement below is computed on and the two disagreeing is itself information. */
  const se = 1 / Math.sqrt(Math.max(4, n) - 3);
  return { n, rho: +rho.toFixed(5),
           ci95_bootstrap: [+bs[Math.floor(0.025 * bs.length)].toFixed(5), +bs[Math.floor(0.975 * bs.length)].toFixed(5)],
           se_normal_approx: +se.toFixed(5),
           p_value_two_sided_normal: +normP(rho / se).toExponential(3),
           mde_at_80pct_power: +((Z_A + Z_B) * se).toFixed(5) };
}

module.exports = { EPS, clamp, logloss, brier, eloP, mean, r4, mulberry, erf, normP, pairedCI,
                   reliability, evaluate, nNeeded, mde, pairedMDE, spearman, rank, pearson, wilson };

/* ---- --verify: REPRODUCE THE PUBLISHED ARTIFACT FROM ITS OWN COMMITTED ROWS ---------------------- */
if (require.main === module && process.argv.includes('--verify')) {
  const pub = JSON.parse(fs.readFileSync(D('data', 'winrate-backtest.json'), 'utf8'));
  const rows = fs.readFileSync(D('data', 'winrate-backtest-rows.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map(l => JSON.parse(l));
  const held = rows.filter(r => r.held);
  let checked = 0, bad = [];
  const walk = (a, b, where) => {
    if (a === null || b === null || typeof a !== 'object') {
      checked++;
      /* Exact equality. Every published field is already rounded by the same r4/toFixed this file
       * uses, so "close enough" would be hiding a real difference in the rounding step itself. */
      if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(where + ': published ' + JSON.stringify(a) + ' recomputed ' + JSON.stringify(b));
      return;
    }
    for (const k of Object.keys(a)) {
      if (k === 'note') continue;                      // prose, deliberately reworded in this module
      walk(a[k], b == null ? null : b[k], where + '.' + k);
    }
  };
  for (const key of Object.keys(pub.results)) {
    for (const [scope, src] of [['held_out_fifth', held], ['full_clean_corpus', rows]]) {
      const publ = pub.results[key][scope];
      if (!publ || !publ.n_games_scored) continue;
      const got = evaluate(src.map(r => ({ p: r.p[key], y: r.y, r1: r.r1, r2: r.r2 })));
      walk(publ, got, key + '/' + scope);
    }
  }
  console.log('\n  leaf_scoring --verify: replayed data/winrate-backtest-rows.jsonl through this module');
  console.log('    ' + checked + ' scalars compared against the published data/winrate-backtest.json');
  if (bad.length) {
    console.error('    ' + bad.length + ' MISMATCH(ES) — this module is NOT the published scorer:');
    for (const b of bad.slice(0, 40)) console.error('      ' + b);
    process.exit(1);
  }
  console.log('    ALL MATCH. This module computes what backtest_winrate.js computed, to the digit.\n');
}
