/* backtest_winrate.js — IS THE LEAF CALIBRATED? When it says 90%, is it 90%?
 *
 *   SHOWDOWN_PATH=... node engine/backtest_winrate.js
 *
 * MEASURE's one number. Every MILTANK decision is an argmax over this leaf, so a leaf that reads
 * 100% and loses is not a tuning problem — it is the error the search is amplifying (LESSONS 2).
 *
 * WHAT CHANGED ON 2026-08-04, AND WHY THE OLD NUMBER COULD NOT CARRY ITS CLAIM
 * ---------------------------------------------------------------------------
 * data/winrate-backtest.json said "MEDICHAM does NOT beat coin; does NOT beat Elo" off 350 games.
 * Four things were wrong with it, and none of them was the leaf:
 *
 *   1. IT MEASURED A LEAF THE SEARCH DOES NOT CALL. It scored `winProb2`, which is `battle()` with
 *      MEDICHAM's DEFAULT 20-turn horizon, entry effects re-fired (seeded:false), and a
 *      deterministic-greedy playout. MILTANK calls neither of those things. Its team-preview leaf is
 *      a greedy playout at maxTurns=60 with seeded:true; its in-game leaf is
 *      rollout_leaf.rolloutWinProb at explore=1.0 / foePolicy=uniform / maxTurns=60. A calibration
 *      claim about winProb2 is a claim about a function no live decision reads.
 *   2. IT WAS STALE. The artifact was written 2026-08-02 19:54; medicham2-browser.js moved
 *      2026-08-04 00:47 across 22 commits, one of which ("one mega per side") states that 45% of
 *      rollouts had been on an illegal board. Nothing on the file said so, which is the exact class
 *      engine/provenance.js exists to catch — so the engine SOURCE is now stamped INTO the artifact.
 *   3. n=350 COULD NOT CARRY "DOES NOT BEAT A COIN". At 342 decisive calls the 95% interval on 52.6%
 *      accuracy is +-5.3 points. That sample can rule out a large effect. It cannot distinguish a
 *      small one from zero, and reporting the absence of evidence as evidence of absence is what made
 *      the line un-actionable. The n is now derived from a power calculation, printed below.
 *   4. IT COMPARED MEDICHAM AND ELO ON DIFFERENT SAMPLES. MEDICHAM's mean was over all 350 games,
 *      Elo's over the 238 that had ratings. Every comparison here is PAIRED on the games where both
 *      judges have an opinion.
 *
 * AND THE SPLIT WAS NOT TEMPORAL. The old header says "the split stays TEMPORAL". loadGames returns
 * STORE ORDER, and the store has 4,775 date inversions, so slice(0.8) cut on append order. It is
 * sorted by date here before splitting.
 *
 * WHAT IT PUBLISHES: A RELIABILITY CURVE, NOT A VERDICT STRING
 * -----------------------------------------------------------
 * Predicted probability bucketed against observed frequency, with a count and a Wilson interval per
 * bucket. A verdict string collapses "overconfident but ranks correctly" and "no signal at all" into
 * the same four words, and those need completely different responses. The curve separates them:
 * SLOPE is discrimination, DISTANCE FROM THE DIAGONAL is calibration.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));                       // globalThis.MC / mcEff

const CS = require('./champions_sim.js');
const B = require('./board.js');
const RL = require('./rollout_leaf.js');
const MEDI = require('./medicham2-browser.js');
const { mcKey } = require('./mc_key.js');                   // the ONE species -> MC.mons resolver
const { loadGames } = require('./quality.js');              // the ONE definition of a usable game
const { DEFAULTS } = require('./miltank.js');               // the LIVE search config, not retyped

const dex = CS.sim().Dex.forFormat(CS.FORMAT);

/* ---- WHAT WAS MEASURED, STAMPED INTO THE ARTIFACT --------------------------------------------
 * provenance.js compares artifact mtimes and is the authority on staleness, but it can only say
 * "this file is older than that one". It cannot say WHICH build produced a number. mtime + content
 * hash of every source the leaf reads goes into the output, so the next session can diff instead of
 * infer. Hash as well as mtime because a checkout or a touch moves an mtime without moving code. */
function stampOf(rel) {
  const p = D(rel);
  try {
    const st = fs.statSync(p);
    return { mtime: new Date(st.mtimeMs).toISOString(), bytes: st.size,
             sha256_12: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 12) };
  } catch (e) {
    /* A STAMP THAT FAILED IS NOT A STAMP, AND IT USED TO LEAVE NO TRACE ANYWHERE A HUMAN LOOKS.
     * The `error` key does reach the artifact — but `status.js` then skipped every entry without a
     * `sha256_12` and printed "CURRENT — every engine source the leaf reads still hashes to what it
     * was measured against". With every stamp failed that sentence was printed over ZERO
     * comparisons. status.js now counts the unstamped ones; this end says so at the time it
     * happens, because a 15-minute run that quietly lost its provenance should not have to wait for
     * somebody to read the artifact. */
    console.error(`backtest_winrate: COULD NOT STAMP ${rel} — ${e.message}. `
      + 'The artifact will record no hash for it and status.js cannot check it.');
    return { mtime: null, error: String(e.message) };
  }
}
const MEASURED_AGAINST = {};
for (const f of ['engine/medicham2-browser.js', 'engine/rollout_leaf.js', 'engine/board.js',
                 'engine/miltank.js', 'engine/quality.js', 'data/engine-data.js', 'data/abra-tags.js',
                 'data/games.ladder.jsonl']) MEASURED_AGAINST[f] = stampOf(f);

/* ---- THE CORPUS -------------------------------------------------------------------------------
 * Clean games only, through engine/quality.js. This used to read the store line by line, which meant
 * the "real game outcomes" the leaf was validated against were ~87% bots, forfeits and stubs.
 * Sorted by DATE, then split 80/20, so the held-out fifth is genuinely the newest fifth. */
const clean = loadGames().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
const SPLIT = Math.floor(clean.length * 0.8);

const MAY = { mayMiss: 'backtest keeps only mons the damage engine has a row for' };
const rows = [];
let noBring = 0, noLabel = 0;
for (let gi = 0; gi < clean.length; gi++) {
  const g = clean[gi];
  const br = g.brought || {};
  const p1 = (br.p1 || g.six?.p1 || []).filter(Boolean);
  const p2 = (br.p2 || g.six?.p2 || []).filter(Boolean);
  if (p1.length < 3 || p2.length < 3) { noBring++; continue; }
  const w = g.winner;
  const y = w && w === g.p1?.name ? 1 : (w && w === g.p2?.name ? 0 : null);
  if (y === null) { noLabel++; continue; }
  rows.push({ gi, g, p1, p2, y, held: gi >= SPLIT,
              r1: g.p1?.rating || null, r2: g.p2?.rating || null, date: g.date });
}

/* SMOKE ONLY. MAXG thins the corpus by taking every k-th game, which keeps the date span and the
 * held/not-held mix rather than a tail. Unset in every published run, and the artifact records the n
 * it actually scored, so a thinned run cannot be mistaken for a full one. */
const MAXG = +(process.env.MAXG || 0);
if (MAXG && rows.length > MAXG) {
  const step = Math.ceil(rows.length / MAXG);
  const thin = rows.filter((_, i) => i % step === 0);
  rows.length = 0; rows.push(...thin);
  console.log(`  MAXG=${MAXG}: THINNED to ${rows.length} — a smoke run, not a published number.`);
}

/* ---- THE POWER CALCULATION, DONE BEFORE THE RUN -----------------------------------------------
 * The claim under test is a two-sided one about DISCRIMINATION: does the leaf pick the eventual
 * winner more often than a coin? Under H0 the per-game outcome is Bernoulli(0.5).
 *
 *   n = ( z(1-a/2)*sqrt(0.25) + z(power)*sqrt(p(1-p)) )^2 / (p-0.5)^2
 *
 * The prior effect is the 52.63% the 2026-08-02 artifact measured on 342 decisive calls. That is the
 * only observed effect size available before this run, and it is what the sizing has to use — sizing
 * on the effect this run finds would be circular.
 *
 * MDE is the inverse: the smallest true accuracy this n can separate from 0.5 at 80% power. It is
 * the number that decides what the result may be reported as, because an n that cannot resolve 2
 * points is not entitled to say "no effect" when it sees 1. */
const Z_A = 1.959963985, Z_B = 0.8416212336;      // two-sided 5%, 80% power
function nNeeded(p) { return Math.ceil(Math.pow(Z_A * 0.5 + Z_B * Math.sqrt(p * (1 - p)), 2) / Math.pow(p - 0.5, 2)); }
function mde(n) {                                  // solved by bisection; p(1-p) makes it implicit
  let lo = 0.5, hi = 1;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (nNeeded(m) > n) lo = m; else hi = m; }
  return hi;
}
const PRIOR_EFFECT = 0.5263;                       // data/winrate-backtest.json, 2026-08-02
const heldRows = rows.filter(r => r.held);
const POWER = {
  test: 'two-sided binomial, H0: P(leaf names the eventual winner) = 0.5',
  alpha: 0.05, power: 0.80,
  prior_effect_used_for_sizing: PRIOR_EFFECT,
  prior_effect_source: 'data/winrate-backtest.json 2026-08-02: 0.5263 on 342 decisive calls',
  n_required_for_prior_effect: nNeeded(PRIOR_EFFECT),
  arithmetic: `n = (1.95996*sqrt(0.25) + 0.84162*sqrt(p(1-p)))^2 / (p-0.5)^2 with p=${PRIOR_EFFECT}` +
              `  ->  (0.97998 + ${(Z_B * Math.sqrt(PRIOR_EFFECT * (1 - PRIOR_EFFECT))).toFixed(5)})^2 / ${Math.pow(PRIOR_EFFECT - 0.5, 2).toExponential(4)} = ${nNeeded(PRIOR_EFFECT)}`,
  n_available_heldout: heldRows.length,
  n_available_full_clean: rows.length,
  mde_heldout: +mde(heldRows.length).toFixed(4),
  mde_full_clean: +mde(rows.length).toFixed(4),
  note: 'MDE is the smallest true accuracy separable from 0.5 at 80% power on that n. An n whose MDE ' +
        'exceeds the observed effect may report "not detected", never "no effect".',
};

console.log('BACKTEST — leaf calibration on real held-out games\n');
console.log(`  clean games ${clean.length.toLocaleString()}  ->  scorable ${rows.length.toLocaleString()}` +
            `  (${noBring} without a bring, ${noLabel} without a labelled winner)`);
console.log(`  temporal split at ${clean[SPLIT]?.date} — held-out newest fifth = ${heldRows.length.toLocaleString()}`);
console.log('\n  POWER (computed BEFORE the run, on the prior effect, not this one)');
console.log(`    ${POWER.arithmetic}`);
console.log(`    to detect ${(100 * PRIOR_EFFECT).toFixed(2)}% vs a coin at 80% power / alpha 0.05 needs n=${POWER.n_required_for_prior_effect.toLocaleString()}`);
console.log(`    held-out n=${heldRows.length.toLocaleString()}  -> MDE ${(100 * POWER.mde_heldout).toFixed(2)}%   ` +
            `full clean n=${rows.length.toLocaleString()} -> MDE ${(100 * POWER.mde_full_clean).toFixed(2)}%`);
console.log(`    ${rows.length >= POWER.n_required_for_prior_effect
  ? 'the full clean corpus IS large enough for the prior effect size.'
  : 'NO available sample reaches ' + POWER.n_required_for_prior_effect.toLocaleString() + '; the largest feasible n is run and the MDE bounds the claim.'}`);

/* ---- THE LEAVES ACTUALLY UNDER TEST -----------------------------------------------------------
 * Three, on identical positions with identical labels, so the differences between them are about the
 * leaf and not about which games each happened to see.
 *
 * The board is built through engine/board.js — setParty + switchIn, the same constructor
 * rollout_r1.js seeds its self-check with — and handed to rollout_leaf.rolloutWinProb. Nothing here
 * builds a body: buildSide/dmgMon does, exactly as it does in a live game. Hand-rolling a second
 * body builder is what produced buildMon("Scizor") -> null (LESSONS 8).
 *
 * NO SHEETS ARE SET. g.sets in the store is OBSERVED play from the whole replay, so feeding it in
 * would leak the game's own future into the prediction of its outcome. The closed-sheet ladder is
 * also the condition the live bot actually plays under. */
const CFG = {
  live_preview: {
    label: 'MILTANK team-preview leaf: greedy playout, seeded, horizon 60',
    source: 'engine/miltank.js chooseTeamPreview (battleInit seeded:true, S.maxTurns=60, chooseAction both sides)',
    n_rollouts: DEFAULTS.previewN,
  },
  live_ingame: {
    label: 'MILTANK in-game leaf: rolloutWinProb explore=1.0 foePolicy=uniform horizon 60',
    source: 'engine/rollout_leaf.js rolloutWinProb, config from engine/miltank.js DEFAULTS',
    n_rollouts: DEFAULTS.n,
    explore: DEFAULTS.explore, foePolicy: DEFAULTS.foePolicy, maxTurns: DEFAULTS.turns,
  },
  live_ingame_n40: {
    label: 'the same in-game leaf at 40 rollouts — is it NOISY or is it WRONG?',
    source: 'engine/rollout_leaf.js rolloutWinProb at the preview budget',
    n_rollouts: 40, explore: DEFAULTS.explore, foePolicy: DEFAULTS.foePolicy, maxTurns: DEFAULTS.turns,
  },
  legacy_winProb2: {
    label: 'WHAT THE 2026-08-02 ARTIFACT MEASURED: winProb2, horizon 20, entry effects re-fired',
    source: 'engine/medicham2-browser.js winProb2 — called by ditto.js and futureSight, by no live decision',
    n_rollouts: 40,
  },
};

function mkBoard(r) {
  const bd = new B.Board();
  bd.setParty('p1', r.p1); bd.setParty('p2', r.p2);
  const lead = r.g.lead || {};
  const L1 = (lead.p1 && lead.p1.length ? lead.p1 : r.p1).slice(0, 2);
  const L2 = (lead.p2 && lead.p2.length ? lead.p2 : r.p2).slice(0, 2);
  bd.switchIn('p1', 'a', L1[0]); if (L1[1]) bd.switchIn('p1', 'b', L1[1]);
  bd.switchIn('p2', 'a', L2[0]); if (L2[1]) bd.switchIn('p2', 'b', L2[1]);
  return bd;
}

/* mulberry32, the same generator rollout_leaf threads through its playouts. Copied rather than
 * imported because rollout_leaf does not export it; it is four lines of arithmetic with no semantics
 * of its own, and the alternative — exporting it — would be an ENGINE-adjacent edit this division
 * may not make mid-freeze. */
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* The preview leaf, reproduced at the level of the ENGINE CALLS miltank makes rather than by calling
 * miltank (which needs a live Showdown player). The bring is FIXED to what was actually brought —
 * miltank searches over brings, this scores the one that was played, which is the only bring that has
 * an outcome attached. */
function previewLeaf(r, seed, N) {
  const build = names => names.map(s => mcKey(s, MAY)).filter(Boolean).map(k => MEDI.buildMon(k)).filter(Boolean);
  let w = 0, ran = 0;
  for (let i = 0; i < N; i++) {
    const A = build(r.p1), Bt = build(r.p2);
    if (A.length < 2 || Bt.length < 2) return null;
    const rng = mulberry(seed * 1000003 + i);
    const S = MEDI.battleInit(A, Bt, { seeded: true });
    S.maxTurns = 60;
    while (!MEDI.battleOver(S)) MEDI.battleTurn(S, rng);
    w += MEDI.battleResult(S); ran++;
  }
  return ran ? w / ran : null;
}

function legacyLeaf(r, N) {
  const a = r.p1.map(s => mcKey(s, MAY)).filter(Boolean);
  const b = r.p2.map(s => mcKey(s, MAY)).filter(Boolean);
  if (a.length < 2 || b.length < 2) return null;
  return MEDI.winProb2(a, b, N);
}

/* ---- SCORE EVERY POSITION ---------------------------------------------------------------------
 * ONE PASS. The expensive in-game leaf at the full 200-rollout budget runs on the held-out fifth
 * only; everything else runs on the whole clean corpus, because the leaf reads no outcome and the
 * powered discrimination claim needs the n. Both are reported separately and the difference between
 * them is itself the check on whether the split mattered.
 *
 * A SIDE-SYMMETRY WITNESS on the first 400 positions: the same board scored as p1 and as p2 must sum
 * to 1 up to rollout noise. If it does not, side A has an advantage inside the engine and every
 * number on this page is measuring that as well as the leaf. */
const t0 = Date.now();
let nulls = 0, sym = [];
const SYM_N = 400;
for (let k = 0; k < rows.length; k++) {
  const r = rows[k];
  const seed = r.gi * 7919 + 13;
  const bd = mkBoard(r);
  const call = (n) => {
    const rr = RL.rolloutWinProb(bd, 'p1', { n, dex, seed, explore: CFG.live_ingame.explore,
      foePolicy: CFG.live_ingame.foePolicy, maxTurns: CFG.live_ingame.maxTurns });
    return rr ? rr.p : null;
  };
  r.p = {};
  r.p.live_preview = previewLeaf(r, seed, CFG.live_preview.n_rollouts);
  r.p.live_ingame_n40 = call(CFG.live_ingame_n40.n_rollouts);
  r.p.legacy_winProb2 = legacyLeaf(r, CFG.legacy_winProb2.n_rollouts);
  if (r.held) r.p.live_ingame = call(CFG.live_ingame.n_rollouts);
  if (r.p.live_ingame_n40 === null) nulls++;
  if (k < SYM_N) {
    const back = RL.rolloutWinProb(bd, 'p2', { n: CFG.live_ingame_n40.n_rollouts, dex, seed,
      explore: CFG.live_ingame.explore, foePolicy: CFG.live_ingame.foePolicy, maxTurns: CFG.live_ingame.maxTurns });
    if (back && r.p.live_ingame_n40 != null) sym.push(r.p.live_ingame_n40 + back.p - 1);
  }
  if (k && k % 500 === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`    ${k}/${rows.length}  ${el.toFixed(0)}s elapsed, ~${(el / k * (rows.length - k)).toFixed(0)}s left`);
  }
}
const runMs = Date.now() - t0;

/* ---- SCORING ----------------------------------------------------------------------------------
 * Brier is the primary. It is bounded, it needs no clamp, and the clamp is doing real work in
 * log-loss: a 40-rollout leaf emits exact 0 and exact 1, so log-loss is largely a report on the
 * epsilon. Log-loss is kept at eps=0.02 because that is what the 2026-08-02 artifact used and the
 * two numbers have to be comparable. */
const EPS = 0.02;
const clamp = p => Math.max(EPS, Math.min(1 - EPS, p));
const logloss = (p, y) => -(y * Math.log(clamp(p)) + (1 - y) * Math.log(1 - clamp(p)));
const brier = (p, y) => (p - y) * (p - y);
const eloP = (a, b) => (a && b) ? 1 / (1 + Math.pow(10, (b - a) / 400)) : null;
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const r4 = x => x == null ? null : Math.round(x * 1e4) / 1e4;

/* PAIRED, and bootstrapped. The two judges see the same games, so the information is in the
 * per-game DIFFERENCE, not in two independent means — and log-loss differences are heavy-tailed
 * because of the clamp, which is exactly where a normal-approximation interval misleads. */
function pairedCI(d, iters) {
  const m = mean(d), n = d.length;
  const rng = mulberry(20260804);
  const bs = [];
  for (let it = 0; it < (iters || 2000); it++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += d[(Math.floor(rng() * n)) % n];
    bs.push(s / n);
  }
  bs.sort((a, b) => a - b);
  return { mean: r4(m), ci95: [r4(bs[Math.floor(0.025 * bs.length)]), r4(bs[Math.floor(0.975 * bs.length)])] };
}

/* THE RELIABILITY CURVE. Ten fixed buckets, so two runs are comparable; a quantile binning would
 * move the buckets when the predictions move and hide exactly the change worth seeing. Wilson from
 * rollout_leaf, not a second implementation of the same interval. */
function reliability(ps, ys) {
  const out = [];
  for (let b = 0; b < 10; b++) {
    const lo = b / 10, hi = (b + 1) / 10;
    const idx = [];
    for (let i = 0; i < ps.length; i++) if (ps[i] >= lo && (b === 9 ? ps[i] <= hi : ps[i] < hi)) idx.push(i);
    if (!idx.length) { out.push({ bucket: `${lo.toFixed(1)}-${hi.toFixed(1)}`, n: 0 }); continue; }
    const wins = idx.reduce((s, i) => s + ys[i], 0);
    const iv = RL.wilson(wins, idx.length);
    out.push({ bucket: `${lo.toFixed(1)}-${hi.toFixed(1)}`, n: idx.length,
      mean_predicted: r4(mean(idx.map(i => ps[i]))), observed: r4(wins / idx.length),
      observed_ci95: [r4(iv.lo), r4(iv.hi)],
      gap: r4(wins / idx.length - mean(idx.map(i => ps[i]))) });
  }
  return out;
}

function evaluate(rs, key) {
  const use = rs.filter(r => r.p[key] != null);
  if (!use.length) return null;
  const ps = use.map(r => r.p[key]), ys = use.map(r => r.y);
  const rel = reliability(ps, ys);
  const N = ps.length;

  const dBrierCoin = use.map((r, i) => brier(ps[i], ys[i]) - brier(0.5, ys[i]));
  const dLLCoin = use.map((r, i) => logloss(ps[i], ys[i]) - logloss(0.5, ys[i]));
  const withElo = use.map((r, i) => ({ i, pe: eloP(r.r1, r.r2) })).filter(x => x.pe != null);
  const dBrierElo = withElo.map(x => brier(ps[x.i], ys[x.i]) - brier(x.pe, ys[x.i]));
  const dLLElo = withElo.map(x => logloss(ps[x.i], ys[x.i]) - logloss(x.pe, ys[x.i]));

  /* DISCRIMINATION. A call is decisive when the leaf is off 0.5 by more than 2 points; a 50/50 read
   * is not a prediction and scoring it as one buries the signal in coin flips. */
  let dec = 0, cor = 0;
  for (let i = 0; i < N; i++) if (Math.abs(ps[i] - 0.5) > 0.02) { dec++; if ((ps[i] > 0.5) === (ys[i] === 1)) cor++; }
  const accIv = RL.wilson(cor, dec);
  const z = dec ? (cor / dec - 0.5) / (0.5 / Math.sqrt(dec)) : 0;
  const pval = 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)));

  /* ECE weights each bucket by how many predictions land in it; MCE is the worst bucket with a
   * usable count. A model can have a tiny ECE and still be catastrophic where it is confident, which
   * is precisely the region a search spends its time in. */
  const filled = rel.filter(b => b.n > 0);
  const ece = filled.reduce((s, b) => s + b.n * Math.abs(b.gap), 0) / N;
  const conf = filled.filter(b => b.n >= 30);
  const mce = conf.length ? Math.max(...conf.map(b => Math.abs(b.gap))) : null;

  /* NOISE FLOOR (LESSONS 9). One arm split in half; the spread between the halves is the smallest
   * difference that means anything at this n. An effect below it is not an effect. */
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
             vs_coin_paired: pairedCI(dBrierCoin),
             vs_elo_paired: withElo.length ? pairedCI(dBrierElo) : null,
             elo_available_on: withElo.length },
    log_loss: { model: r4(mean(use.map((r, i) => logloss(ps[i], ys[i])))), coin: r4(Math.log(2)),
                elo: withElo.length ? r4(mean(withElo.map(x => logloss(x.pe, ys[x.i])))) : null,
                vs_coin_paired: pairedCI(dLLCoin),
                vs_elo_paired: withElo.length ? pairedCI(dLLElo) : null,
                clamp_eps: EPS,
                note: 'the clamp is load-bearing: a 40-rollout leaf emits exact 0 and 1, so log-loss ' +
                      'partly reports the epsilon. Brier needs no clamp and is the primary.' },
    discrimination: { decisive_calls: dec, correct: cor, accuracy: r4(dec ? cor / dec : null),
                      accuracy_ci95_wilson: [r4(accIv.lo), r4(accIv.hi)], p_value_two_sided: r4(pval),
                      fixed_n: true,
                      note: 'n was fixed by the power calculation before the run. This is not an ' +
                            'interim look at a sequential test and must not be read as one.' },
    calibration: { ece: r4(ece), mce_buckets_over_30: r4(mce),
                   share_in_extreme_buckets: r4((rel[0].n + rel[9].n) / N) },
    reliability_curve: rel,
    /* Six decimals, not four: the first run printed a Brier spread of "0", which reads as a broken
     * instrument rather than as two halves that agreed to within 5e-5. */
    noise_floor: { split_half_brier: [r4(half(0, h)), r4(half(h, N))],
                   split_half_brier_spread: +Math.abs(half(0, h) - half(h, N)).toFixed(6),
                   split_half_accuracy: [r4(accHalf(0, h)), r4(accHalf(h, N))],
                   split_half_accuracy_spread: +Math.abs(accHalf(0, h) - accHalf(h, N)).toFixed(6),
                   note: 'one arm split in half. A difference smaller than this spread is not an effect.' },
  };
}

/* Abramowitz-Stegun 7.1.26. Needed for the two-sided normal p-value and not worth a dependency. */
function erf(x) {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

const results = {};
for (const key of ['live_preview', 'live_ingame', 'live_ingame_n40', 'legacy_winProb2']) {
  const held = evaluate(heldRows, key);
  /* live_ingame at the full 200-rollout budget was only RUN on the held-out fifth, so its
   * "full corpus" column would be the held-out column wearing a different label — an n of 1,378
   * printed under a heading that says 6,886. Say what it is instead. */
  const full = key === 'live_ingame' ? null : evaluate(rows, key);
  if (!full && !held) continue;
  results[key] = { config: CFG[key], held_out_fifth: held,
    full_clean_corpus: full || (key === 'live_ingame'
      ? { not_run: 'the 200-rollout budget was run on the held-out fifth only; live_ingame_n40 is the ' +
                   'same leaf on the full corpus and separates budget from bias' } : null) };
}

const symMean = sym.length ? mean(sym) : null;
const out = {
  generated: 'engine/backtest_winrate.js — does the LIVE leaf predict real game outcomes?',
  measured_at: new Date().toISOString(),
  measured_against: MEASURED_AGAINST,
  runtime_seconds: Math.round(runMs / 1000),
  corpus: {
    clean_games: clean.length,
    n_games: rows.length,
    scorable: rows.length, dropped_no_bring: noBring, dropped_no_label: noLabel,
    unbuildable_positions: nulls,
    split: 'sorted by date, oldest 80% / newest 20%',
    split_date: clean[SPLIT]?.date || null,
    date_first: clean[0]?.date || null, date_last: clean[clean.length - 1]?.date || null,
    held_out_games: heldRows.length,
    position: 'turn 0: the BROUGHT four a side, real leads from g.lead, no sheets set',
    why_no_sheets: 'g.sets is observed play from the whole replay; feeding it in would leak the ' +
                   'outcome into its own prediction. The closed-sheet ladder is also what the bot plays.',
  },
  power: POWER,
  side_symmetry_witness: {
    n: sym.length, mean_p1_plus_p2_minus_1: r4(symMean),
    max_abs: sym.length ? r4(Math.max(...sym.map(Math.abs))) : null,
    note: 'the same board scored from both sides must sum to 1. A non-zero mean is a side advantage ' +
          'inside the engine and would contaminate every number here.',
  },
  results,
  /* KEPT FOR engine/status.js, WHICH READS THEM. Deliberately the LIVE in-game leaf on the held-out
   * fifth: the number that governs a live decision, on the sample that was held out. */
  n_games_scored: null, rollouts_per_game: null, verdict: null,
};

const head = results.live_ingame?.held_out_fifth || results.live_ingame_n40?.held_out_fifth;
if (head) {
  out.n_games_scored = head.n_games_scored;
  out.rollouts_per_game = CFG.live_ingame.n_rollouts;
  const b = head.brier.vs_coin_paired;
  const beat = b.ci95[1] < 0 ? 'BEATS' : (b.ci95[0] > 0 ? 'is WORSE than' : 'is not separated from');
  const a = head.discrimination;
  /* THE TOP BUCKET IS THE NUMBER THAT MATTERS TO A SEARCH. A maximiser spends its whole life in the
   * confident region, so "when it says 90-100%, how often does it win" is the quantity that decides
   * whether the argmax is being fed a lie. It goes in the headline, not three levels down in a curve. */
  const top = (head.reliability_curve || [])[9];
  out.verdict =
    `live in-game leaf ${beat} a coin on Brier (paired ${b.mean >= 0 ? '+' : ''}${b.mean}, 95% CI ` +
    `${b.ci95[0]} to ${b.ci95[1]}; negative is better)` +
    (top && top.n ? `. When it says 90-100% it wins ${(100 * top.observed).toFixed(0)}% (n=${top.n})` : '') +
    `. Names the winner on ${(100 * a.accuracy).toFixed(1)}% ` +
    `of ${a.decisive_calls} decisive calls, 95% CI ${(100 * a.accuracy_ci95_wilson[0]).toFixed(1)}-` +
    `${(100 * a.accuracy_ci95_wilson[1]).toFixed(1)}%. ECE ${head.calibration.ece}. See reliability_curve.`;
}

fs.writeFileSync(D('data', 'winrate-backtest.json'), JSON.stringify(out, null, 2));
fs.writeFileSync(D('data', 'winrate-backtest-rows.jsonl'),
  rows.map(r => JSON.stringify({ id: r.g.id, date: r.date, held: r.held, y: r.y, r1: r.r1, r2: r.r2, p: r.p })).join('\n') + '\n');

/* ---- REPORT -----------------------------------------------------------------------------------*/
const pad = (s, n) => String(s).padEnd(n);
const padl = (s, n) => String(s).padStart(n);
console.log(`\n  scored in ${(runMs / 1000).toFixed(0)}s. side-symmetry witness: mean(p1+p2-1) = ${r4(symMean)} over ${sym.length} boards\n`);
for (const [key, v] of Object.entries(results)) {
  for (const [scope, e] of [['held-out fifth', v.held_out_fifth], ['full clean corpus', v.full_clean_corpus]]) {
    if (!e || !e.n_games_scored) continue;
    console.log(`  ${key}  [${scope}]  ${v.config.label}`);
    console.log(`    n=${e.n_games_scored.toLocaleString()}  Brier ${e.brier.model} vs coin 0.25 ` +
      `(paired ${e.brier.vs_coin_paired.mean}, CI ${e.brier.vs_coin_paired.ci95.join(' to ')})` +
      `   log-loss ${e.log_loss.model} vs 0.6931 (paired ${e.log_loss.vs_coin_paired.mean}, CI ${e.log_loss.vs_coin_paired.ci95.join(' to ')})`);
    if (e.brier.vs_elo_paired) console.log(`      vs Elo on ${e.brier.elo_available_on}: Brier paired ${e.brier.vs_elo_paired.mean} (CI ${e.brier.vs_elo_paired.ci95.join(' to ')})` +
      `   log-loss paired ${e.log_loss.vs_elo_paired.mean} (CI ${e.log_loss.vs_elo_paired.ci95.join(' to ')})`);
    console.log(`      discrimination ${(100 * e.discrimination.accuracy).toFixed(2)}% of ${e.discrimination.decisive_calls} decisive ` +
      `(CI ${(100 * e.discrimination.accuracy_ci95_wilson[0]).toFixed(2)}-${(100 * e.discrimination.accuracy_ci95_wilson[1]).toFixed(2)}%, p=${e.discrimination.p_value_two_sided})` +
      `   ECE ${e.calibration.ece}  extreme-bucket share ${e.calibration.share_in_extreme_buckets}`);
    console.log(`      noise floor: split-half Brier spread ${e.noise_floor.split_half_brier_spread}, accuracy spread ${e.noise_floor.split_half_accuracy_spread}`);
    console.log('      ' + pad('bucket', 10) + padl('n', 6) + padl('pred', 8) + padl('obs', 8) + '   95% CI');
    for (const b of e.reliability_curve) {
      if (!b.n) { console.log('      ' + pad(b.bucket, 10) + padl(0, 6)); continue; }
      console.log('      ' + pad(b.bucket, 10) + padl(b.n, 6) + padl(b.mean_predicted.toFixed(3), 8) +
        padl(b.observed.toFixed(3), 8) + '   ' + b.observed_ci95.map(x => x.toFixed(3)).join(' - ') +
        '   gap ' + (b.gap >= 0 ? '+' : '') + b.gap.toFixed(3));
    }
    console.log('');
  }
}
console.log('  ' + out.verdict);
console.log('\n  wrote data/winrate-backtest.json and data/winrate-backtest-rows.jsonl');
