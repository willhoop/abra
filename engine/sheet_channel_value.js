/* sheet_channel_value.js — WHAT IS THE OPEN TEAM SHEET WORTH, measured rather than argued.
 *
 * THE QUESTION
 * ------------
 * `engine/magnemite.js:522` hands the board all four channels an open team sheet declares — nature,
 * item, ability, moves. Until 2026-08-04 `engine/fit_policy.js` and `engine/joint_rows.js` handed it
 * two. So MAG's weights were fitted against a board that did not know the opponent's declared ability
 * or declared moves, while the bot playing those weights did. That is CLAUDE.md's *fitting environment
 * and playing environment must match*, broken in the opposite direction from 2026-07-28 — and in this
 * direction nothing could catch it, because both sides of every head-to-head shared the handicap and
 * it cancelled out exactly.
 *
 * docs/MEASURE.md §13a measured the SIZE OF THE GAP: 50.47% of decisions move, 20 of 58 columns.
 * That is a statement about the feature matrix. It says nothing about whether the sharper board is
 * WORTH anything, and this file measures that:
 *
 *     does a model that can see the declared ability and the declared moves predict a human click
 *     better than one that cannot?
 *
 * HOW, AND WHY EACH CHOICE
 * ------------------------
 * PAIRED PER DECISION. Every arm scores the IDENTICAL held-out decisions, keyed by
 * game/turn/side/slot rather than by row order, so a decision that exists in one arm and not the
 * other is dropped from both instead of silently shifting the alignment. docs/MEASURE.md §13 is
 * explicit that comparing two artifacts' own `heldOut` blocks compares two SAMPLES — the confound
 * this division keeps finding in other people's work.
 *
 * BOOTSTRAPPED OVER GAMES, NOT DECISIONS. Decisions inside one game share a team, a board and two
 * players. Resampling decisions would treat ~26 correlated observations as independent and produce an
 * interval several times too narrow.
 *
 * ONE PROCESS, BOTH CHANNEL SETS. `engine/tags.js` loads `data/tags.json` once per process with no
 * way to pin it, and that file changed twice in fifteen minutes on 2026-08-04 while ENGINE worked. Two
 * processes with SHEET_CHANNELS set differently could therefore differ by the TAG DATABASE as well as
 * by the channel set, and neither would say so. A measurement is a photograph; nothing in frame may
 * move. `decisionsFor(g, tally, channels)` takes the override for exactly this reason.
 *
 * AGAINST ITS OWN NOISE FLOOR. Twenty split-half cuts of one arm, in the same unit as the effect. An
 * effect smaller than the spread between two halves of the same arm is not an effect. The previous
 * refit's floor was 0.192 top-1 points; this run recomputes its own rather than quoting that.
 *
 * WHAT THIS DOES NOT MEASURE, stated because the number will be quoted:
 *   - top-1 agreement with a human click IS NOT A WIN RATE. Whether MILTANK plays better is an H2H
 *     and belongs to SEARCH.
 *   - every game here is an OPEN-SHEET game. It cannot say how weights fitted on four channels
 *     degrade against an opponent who declines OTS, which is the debt Will accepted knowingly.
 *
 * USAGE
 *   SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/sheet_channel_value.js
 *     WEIGHTS_NEW=data/policy-weights.json          the four-channel refit (what ships)
 *     WEIGHTS_OLD=<release copy>                    the two-channel-fitted incumbent
 *     WEIGHTS_2CH=data/policy-weights-2ch.json      optional: a 2-channel refit on the SAME corpus
 *     BOOT=10000  MAXG=0
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FP = require('./fit_policy.js');
const B = require('./board.js');
const SC = require('./sheet_channels.js');
const CS = require('./champions_sim.js');
const REL = require('./engine_release.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const OUT = D('data', 'sheet-channel-value.json');

const BOOT = +(process.env.BOOT || 10000);
const MAXG = +(process.env.MAXG || 0);
const CH2 = ['nature', 'item'];
const CH4 = SC.CHANNELS;

/* A file this cannot read gets digest null IN THE ARTIFACT (visible) — but the miss must also be
 * said out loud, because a typo'd FITTER_SOURCES path would otherwise be silently exempt from the
 * moved-during-the-run check: null before === null after reads as "unmoved" forever. */
const sha12 = p => {
  try { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 12); }
  catch (e) { console.error(`  sha12: cannot read ${p} (${e.message}) — digest recorded as null`); return null; }
};

/* THE FITTERS ARE NOT IN THE ENGINE RELEASE, and this measurement reads them.
 * engine_release.js freezes what a LEAF measurement reads — the simulator, the board, the weights.
 * This one runs `fit_policy.decisionsFor`, so `fit_policy.js`, `joint_rows.js` and `sheet_channels.js`
 * are inputs to the number and nothing else would record which build of them produced it. Stamped
 * here explicitly rather than by widening SOURCES, which is engine_release's call and not this
 * file's. */
const FITTER_SOURCES = ['engine/fit_policy.js', 'engine/joint_rows.js', 'engine/sheet_channels.js',
  'engine/click_match.js', 'engine/quality.js'];

/* The same split fit_policy.js uses, character for character. If these ever diverge the "held-out"
 * set stops being held out and every number below is fitted-on. */
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const isHeldOut = id => hash(String(id || '')) % 5 === 0;

function loadW(p, label) {
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const w = j.weights;
  if (!Array.isArray(w) || w.length !== B.FEATURES.length) {
    throw new Error(`${label} (${p}) has ${Array.isArray(w) ? w.length : 'no'} weights against ` +
      `${B.FEATURES.length} features — refusing to score, this is the allyHit failure mode`);
  }
  /* THE FEATURE ORDER MUST BE THE SAME LIST, not merely the same length. A weight vector is
   * meaningless against a reordered feature list and the lengths would still agree. */
  if (Array.isArray(j.features)) {
    const bad = j.features.findIndex((f, i) => f !== B.FEATURES[i]);
    if (bad >= 0) throw new Error(`${label}: feature ${bad} is '${j.features[bad]}' in the artifact and ` +
      `'${B.FEATURES[bad]}' in board.js — refusing to score`);
  }
  return { w, meta: j };
}

/* Softmax log-likelihood of the chosen candidate, and whether the argmax was the chosen one.
 * Max-subtracted, because a 58-term dot product overflows exp() on a wide candidate list and the
 * resulting NaN would propagate into the mean as a silent zero. */
function score(feats, chosen, w) {
  let best = -Infinity, bestI = -1, mx = -Infinity;
  const s = new Array(feats.length);
  for (let i = 0; i < feats.length; i++) {
    let v = 0; const x = feats[i];
    for (let k = 0; k < w.length; k++) v += w[k] * x[k];
    s[i] = v;
    if (v > mx) mx = v;
    if (v > best) { best = v; bestI = i; }
  }
  let z = 0;
  for (let i = 0; i < s.length; i++) z += Math.exp(s[i] - mx);
  return { ll: (s[chosen] - mx) - Math.log(z), top1: bestI === chosen ? 1 : 0 };
}

function main() {
  const rel = REL.open();
  console.log(`SHEET CHANNEL VALUE — what the declared ability and moves are worth\n`);
  console.log(`  engine release ${rel.id}  (${rel.manifest.cut})`);

  const digestsBefore = {};
  for (const f of Object.keys(rel.manifest.files)) digestsBefore[f] = sha12(D(f));
  for (const f of FITTER_SOURCES) digestsBefore[f] = sha12(D(f));

  const WNEW = process.env.WEIGHTS_NEW || D('data', 'policy-weights.json');
  const WOLD = process.env.WEIGHTS_OLD || rel.path('data/policy-weights.json');
  const W2CH = process.env.WEIGHTS_2CH || '';

  const wNew = loadW(WNEW, 'new (4-channel refit)');
  const wOld = loadW(WOLD, 'old (2-channel incumbent)');
  const w2ch = W2CH && fs.existsSync(W2CH) ? loadW(W2CH, '2-channel refit') : null;
  console.log(`  new weights ${path.relative(ROOT, WNEW)}  fitted ${wNew.meta.generated}`);
  console.log(`  old weights ${path.relative(ROOT, WOLD)}  fitted ${wOld.meta.generated}`);
  if (w2ch) console.log(`  2ch control ${path.relative(ROOT, W2CH)}  fitted ${w2ch.meta.generated}`);

  /* SANITY: the two vectors must actually differ, or every paired difference below is exactly zero
   * and the run would publish a beautifully tight interval around nothing. */
  const l2 = Math.sqrt(wNew.w.reduce((a, v, i) => a + (v - wOld.w[i]) ** 2, 0));
  console.log(`  |new - old|_2 = ${l2.toFixed(4)}`);
  if (l2 === 0) { console.error('the two weight vectors are IDENTICAL — nothing to measure. Refusing.'); process.exit(1); }

  const { games } = FP.loadCorpus();
  let held = games.filter(g => g.id && isHeldOut(g.id));
  if (MAXG) held = held.slice(0, MAXG);
  console.log(`  corpus ${games.length.toLocaleString()} clean open-sheet games -> ` +
    `${held.length.toLocaleString()} held out (hash(game) % 5 === 0)\n`);

  /* ARMS. Named once here so nothing downstream has to remember which is which.
   *   A  two-channel features + the incumbent weights   = what has been shipping
   *   B  four-channel features + the incumbent weights  = the INFORMATION alone, weights frozen
   *   C  four-channel features + the refitted weights   = what ships now
   *   D  two-channel features + a two-channel refit     = the best model the narrow board can support */
  const ARMS = ['A', 'B', 'C'].concat(w2ch ? ['D'] : []);
  const per = new Map();          // game id -> { n, sum: {arm: {ll, top1}} }
  const tally2 = {}, tally4 = {};
  let paired = 0, unpairedA = 0, unpairedB = 0;

  /* THE MECHANICAL GAP, recomputed on this build rather than inherited from §13a. */
  const gap = { vectors: 0, vectorsMoved: 0, decisions: 0, decisionsMoved: 0,
                gamesWithMove: 0, colMoved: new Array(B.FEATURES.length).fill(0),
                colMaxAbs: new Array(B.FEATURES.length).fill(0) };

  const EPS = 1e-12;
  let gi = 0;
  for (const g of held) {
    gi++;
    if (gi % 250 === 0) process.stdout.write(`\r  scoring ${gi}/${held.length}`);
    /* Both arms built from the SAME game object in the SAME process, one immediately after the
     * other. Nothing can move in between. */
    const r2 = FP.decisionsFor(g, tally2, CH2);
    const r4 = FP.decisionsFor(g, tally4, CH4);
    const key = r => `${r.turn}|${r.side}|${r.slot}|${r.mvs.join(',')}`;
    const m2 = new Map();
    for (const r of r2) m2.set(key(r), r);
    let gameMoved = false;
    for (const b of r4) {
      const a = m2.get(key(b));
      if (!a) { unpairedB++; continue; }
      m2.delete(key(b));
      if (a.chosen !== b.chosen) { unpairedB++; continue; }   // same menu, different match: drop both
      paired++;

      /* --- the mechanical gap ------------------------------------------------------------- */
      gap.decisions++;
      let decMoved = false;
      for (let i = 0; i < b.feats.length; i++) {
        gap.vectors++;
        let vecMoved = false;
        for (let k = 0; k < b.feats[i].length; k++) {
          const d = Math.abs(b.feats[i][k] - a.feats[i][k]);
          if (d > EPS) {
            vecMoved = true;
            gap.colMoved[k]++;
            if (d > gap.colMaxAbs[k]) gap.colMaxAbs[k] = d;
          }
        }
        if (vecMoved) { gap.vectorsMoved++; decMoved = true; }
      }
      if (decMoved) { gap.decisionsMoved++; gameMoved = true; }

      /* --- the arms ---------------------------------------------------------------------- */
      let rec = per.get(g.id);
      if (!rec) { rec = { n: 0, sum: {} }; for (const q of ARMS) rec.sum[q] = { ll: 0, top1: 0 }; per.set(g.id, rec); }
      rec.n++;
      const sA = score(a.feats, a.chosen, wOld.w);
      const sB = score(b.feats, b.chosen, wOld.w);
      const sC = score(b.feats, b.chosen, wNew.w);
      rec.sum.A.ll += sA.ll; rec.sum.A.top1 += sA.top1;
      rec.sum.B.ll += sB.ll; rec.sum.B.top1 += sB.top1;
      rec.sum.C.ll += sC.ll; rec.sum.C.top1 += sC.top1;
      if (w2ch) { const sD = score(a.feats, a.chosen, w2ch.w); rec.sum.D.ll += sD.ll; rec.sum.D.top1 += sD.top1; }
    }
    unpairedA += m2.size;
    if (gameMoved) gap.gamesWithMove++;
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r');

  const ids = [...per.keys()];
  const N = ids.reduce((a, id) => a + per.get(id).n, 0);
  console.log(`  paired ${N.toLocaleString()} held-out decisions over ${ids.length.toLocaleString()} games ` +
    `(${unpairedA.toLocaleString()} + ${unpairedB.toLocaleString()} unpaired dropped from BOTH arms)\n`);
  if (N < 1000) { console.error('too few paired decisions to say anything. Refusing to write.'); process.exit(1); }

  const meanOf = (arm, idList) => {
    let ll = 0, t1 = 0, n = 0;
    for (const id of idList) { const r = per.get(id); ll += r.sum[arm].ll; t1 += r.sum[arm].top1; n += r.n; }
    return { ll: ll / n, top1: 100 * t1 / n, n };
  };

  const point = {};
  for (const q of ARMS) point[q] = meanOf(q, ids);

  /* ---- bootstrap over GAMES ------------------------------------------------------------------
   * One resample drives every arm and every contrast, so the differences share their resampling
   * noise exactly the way the decisions share their games. Resampling each arm separately would
   * inflate every interval and could put zero inside an effect that is really there. */
  const pairsToTest = [['B', 'A'], ['C', 'A'], ['C', 'B']].concat(w2ch ? [['C', 'D'], ['B', 'D']] : []);
  const draws = {}; for (const [x, y] of pairsToTest) draws[`${x}-${y}`] = { ll: [], top1: [] };
  const G = ids.length;
  const cache = ids.map(id => per.get(id));
  for (let b = 0; b < BOOT; b++) {
    const acc = {}; for (const q of ARMS) acc[q] = { ll: 0, t1: 0 };
    let n = 0;
    for (let i = 0; i < G; i++) {
      const r = cache[(Math.random() * G) | 0];
      n += r.n;
      for (const q of ARMS) { acc[q].ll += r.sum[q].ll; acc[q].t1 += r.sum[q].top1; }
    }
    for (const [x, y] of pairsToTest) {
      draws[`${x}-${y}`].ll.push(acc[x].ll / n - acc[y].ll / n);
      draws[`${x}-${y}`].top1.push(100 * acc[x].t1 / n - 100 * acc[y].t1 / n);
    }
  }
  const ci = arr => { const s = arr.slice().sort((p, q) => p - q); return [s[Math.floor(0.025 * s.length)], s[Math.floor(0.975 * s.length)]]; };
  const contrasts = {};
  for (const [x, y] of pairsToTest) {
    const k = `${x}-${y}`;
    contrasts[k] = {
      logL: { point: point[x].ll - point[y].ll, ci95: ci(draws[k].ll) },
      top1_points: { point: point[x].top1 - point[y].top1, ci95: ci(draws[k].top1) },
    };
    contrasts[k].logL.excludes_zero = contrasts[k].logL.ci95[0] > 0 || contrasts[k].logL.ci95[1] < 0;
    contrasts[k].top1_points.excludes_zero = contrasts[k].top1_points.ci95[0] > 0 || contrasts[k].top1_points.ci95[1] < 0;
  }

  /* ---- the noise floor -----------------------------------------------------------------------
   * Split the SHIPPING arm's own games in half twenty times and measure the spread between halves.
   * An effect smaller than this is not an effect. Computed on arm C alone, so it carries no
   * information about the contrast — which is the point. */
  const floor = { cuts: [], arm: 'C' };
  for (let c = 0; c < 20; c++) {
    const shuf = ids.slice();
    for (let i = shuf.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [shuf[i], shuf[j]] = [shuf[j], shuf[i]]; }
    const h = shuf.length >> 1;
    const a = meanOf('C', shuf.slice(0, h)), b2 = meanOf('C', shuf.slice(h));
    floor.cuts.push({ top1_spread: Math.abs(a.top1 - b2.top1), logL_spread: Math.abs(a.ll - b2.ll) });
  }
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  floor.top1_median = med(floor.cuts.map(c => c.top1_spread));
  floor.top1_range = [Math.min(...floor.cuts.map(c => c.top1_spread)), Math.max(...floor.cuts.map(c => c.top1_spread))];
  floor.logL_median = med(floor.cuts.map(c => c.logL_spread));

  const movedCols = B.FEATURES.map((f, i) => ({ feature: f, vectors: gap.colMoved[i], max_abs_delta: gap.colMaxAbs[i] }))
    .filter(c => c.vectors > 0).sort((a, b2) => b2.vectors - a.vectors);

  /* ---- report --------------------------------------------------------------------------------- */
  console.log('THE MECHANICAL GAP — what the two extra channels change about the feature matrix\n');
  console.log(`  candidate vectors that move   ${gap.vectorsMoved.toLocaleString()} of ${gap.vectors.toLocaleString()} (${(100 * gap.vectorsMoved / gap.vectors).toFixed(2)}%)`);
  console.log(`  decisions that move           ${gap.decisionsMoved.toLocaleString()} of ${gap.decisions.toLocaleString()} (${(100 * gap.decisionsMoved / gap.decisions).toFixed(2)}%)`);
  console.log(`  columns that move             ${movedCols.length} of ${B.FEATURES.length}`);
  console.log(`  games containing a move       ${gap.gamesWithMove.toLocaleString()} of ${ids.length.toLocaleString()} (${(100 * gap.gamesWithMove / ids.length).toFixed(2)}%)\n`);

  console.log('THE ARMS — identical held-out decisions, scored three ways\n');
  const NAME = { A: '2-ch features + incumbent weights (was shipping)', B: '4-ch features + incumbent weights',
                 C: '4-ch features + refitted weights (ships now)', D: '2-ch features + 2-ch refit (best narrow model)' };
  for (const q of ARMS) console.log(`  ${q}  ${NAME[q].padEnd(48)} logL/decision ${point[q].ll.toFixed(6)}   top-1 ${point[q].top1.toFixed(3)}%`);
  console.log('');
  console.log('PAIRED DIFFERENCES, bootstrapped over games\n');
  for (const [x, y] of pairsToTest) {
    const k = `${x}-${y}`, c = contrasts[k];
    console.log(`  ${k}   logL ${c.logL.point >= 0 ? '+' : ''}${c.logL.point.toFixed(6)} [${c.logL.ci95[0].toFixed(6)}, ${c.logL.ci95[1].toFixed(6)}]` +
      `${c.logL.excludes_zero ? '  CLEARS ZERO' : '  contains zero'}`);
    console.log(`  ${' '.repeat(k.length)}   top-1 ${c.top1_points.point >= 0 ? '+' : ''}${c.top1_points.point.toFixed(3)} pts [${c.top1_points.ci95[0].toFixed(3)}, ${c.top1_points.ci95[1].toFixed(3)}]` +
      `${c.top1_points.excludes_zero ? '  CLEARS ZERO' : '  contains zero'}`);
  }
  console.log(`\n  NOISE FLOOR (20 split-half cuts of arm C alone): median ${floor.top1_median.toFixed(3)} top-1 points ` +
    `(range ${floor.top1_range[0].toFixed(3)}-${floor.top1_range[1].toFixed(3)})`);
  console.log('  An effect smaller than this is not an effect.\n');

  const digestsAfter = {};
  for (const f of Object.keys(digestsBefore)) digestsAfter[f] = sha12(D(f));
  const movedDuring = Object.keys(digestsBefore).filter(f => digestsBefore[f] !== digestsAfter[f]);
  if (movedDuring.length) {
    console.error(`\n  SOURCES MOVED WHILE THIS RAN: ${movedDuring.join(', ')}`);
    console.error('  The measurement is VOID — it is not a photograph of one build. Recorded as void:true.');
  }

  const art = Object.assign({}, rel.stamp(), {
    generated: new Date().toISOString(),
    source: 'engine/sheet_channel_value.js',
    question: 'Does a MAG that can see the declared ability and declared moves predict a human click ' +
              'better than one that can only see the declared nature and item?',
    /* Recorded because engine_release.js does not freeze the fitters and this number depends on them. */
    fitter_digests: FITTER_SOURCES.reduce((o, f) => (o[f] = digestsBefore[f], o), {}),
    showdown_path_set: !!process.env.SHOWDOWN_PATH,
    format: CS.FORMAT,
    corpus: { clean_open_sheet_games: games.length, held_out_games: ids.length, held_out_decisions: N,
              split: 'hash(game.id) % 5 === 0, identical to engine/fit_policy.js',
              unpaired_dropped: unpairedA + unpairedB },
    channels: { narrow: CH2, wide: CH4, player_passes: SC.CHANNELS },
    weights: {
      A_and_B: { path: path.relative(ROOT, WOLD), generated: wOld.meta.generated, sha256_12: sha12(WOLD) },
      C: { path: path.relative(ROOT, WNEW), generated: wNew.meta.generated, sha256_12: sha12(WNEW) },
      D: w2ch ? { path: path.relative(ROOT, W2CH), generated: w2ch.meta.generated, sha256_12: sha12(W2CH) } : null,
      l2_new_minus_old: l2,
    },
    arms: ARMS.reduce((o, q) => (o[q] = { what: NAME[q], logL_per_decision: point[q].ll, top1_pct: point[q].top1 }, o), {}),
    contrasts,
    noise_floor: floor,
    mechanical_gap: {
      candidate_vectors: gap.vectors, candidate_vectors_moved: gap.vectorsMoved,
      decisions: gap.decisions, decisions_moved: gap.decisionsMoved,
      games: ids.length, games_with_a_moved_vector: gap.gamesWithMove,
      columns_moved: movedCols.length, of_columns: B.FEATURES.length,
      by_column: movedCols,
    },
    bootstrap: { resamples: BOOT, unit: 'game', note: 'one resample drives every arm, so the contrasts share their resampling noise' },
    n_measured: N,
    n_unit: 'held-out decisions, paired across arms',
    caveats: [
      'Top-1 agreement with a human click is NOT a win rate. Whether MILTANK plays better is an H2H and belongs to SEARCH.',
      'Every game scored here is an OPEN-SHEET game. This cannot say how four-channel weights degrade ' +
      'against an opponent who declines OTS — that is the debt accepted on 2026-08-04.',
      'The declared item and ability are what the sheet SAID. Knock Off, Trick and a consumed berry ' +
      'stale them mid-battle and nothing here tracks that; prefer OBSERVED over DECLARED.',
    ],
  });
  if (movedDuring.length) { art.void = true; art.void_reason = 'engine sources moved during the run: ' + movedDuring.join(', '); }

  fs.writeFileSync(OUT, JSON.stringify(art, null, 1) + '\n');
  console.log(`  -> ${path.relative(ROOT, OUT)}`);
}

if (require.main === module) main();
module.exports = { isHeldOut, score };
