/* protect_calibration.js — is the Protect excess in the WEIGHTS, or in the states MAG reaches?
 *
 * THE QUESTION, AND WHY IT HAS A CLEAN ANSWER
 * -------------------------------------------
 * MAG Protects far more than a human: measured 2026-08-02 on a single-lever paired corpus,
 * 215.2 per 1,000 moves greedy and 159.9 sampling against a human 128.5, and it converts them
 * worse — 59.0% / 54.9% of its Protects block something against a human 70.6%.
 *
 * Greedy explains part of it and cannot explain the rest, because SAMPLING over-Protects too. That
 * left two candidates, and they call for opposite fixes:
 *
 *   THE WEIGHTS      the fitted model over-predicts Protect wherever it is asked. Then it should
 *                    over-predict on the FIT CORPUS ITSELF, where the answer is known.
 *   THE STATES       the model is right, and MAG simply reaches more Protect-favourable boards than
 *                    the humans it was fitted on. Then it is calibrated here and diverges in play,
 *                    and no amount of reweighting is the fix.
 *
 * A conditional logit fitted by maximum likelihood is calibrated ON ITS FIT SET almost by
 * construction — the gradient of the log-likelihood is exactly (observed - predicted) summed over
 * rows, so at the optimum the predicted count of any feature-aligned subset matches the observed
 * count. That makes this a sharp test rather than a vague one: a gap here is not "the model is a bit
 * off", it is the fit failing to do the one thing it is guaranteed to do, and it localises the cause.
 *
 * WHAT IS COMPARED
 * ----------------
 * Over the human open-sheet decisions, for every decision offering at least one Protect-family
 * candidate:
 *
 *   observed    the human pressed a Protect-family move
 *   predicted   sum of the model's P over the Protect-family candidates in that decision
 *
 * Summed, those two are the human Protect rate and the model's expected Protect rate on IDENTICAL
 * choice sets. Same decisions, same candidates, no self-play involved, so the states are held fixed
 * and only the model varies. Whatever gap appears is the weights and nothing else.
 *
 * The family is the dex's own `stallingMove` flag — Baneful Bunker, Spiky Shield, Burning Bulwark and
 * King's Shield are covered without any of them being named here, the same derivation board.js uses
 * at board.js:2775.
 *
 *   SHOWDOWN_PATH=... node engine/protect_calibration.js
 *   SHOWDOWN_PATH=... node engine/protect_calibration.js --weights data/policy-weights-nopop.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const B = require('./board.js');
const FP = require('./fit_policy.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const WFILE = arg('weights', 'data/policy-weights.json');
const MAXG = +(process.env.MAXG || 600);

const wj = JSON.parse(fs.readFileSync(path.isAbsolute(WFILE) ? WFILE : D(WFILE), 'utf8'));
/* `j.weights` IS the shipped vector, and this must read exactly what the PLAYER reads or the whole
 * comparison is against a model nobody runs. magnemite.js:227 takes `W.weights`; fit_policy.js:825
 * writes `weights: shipW` after choosing between the variants, and the `shipped` field is a LABEL
 * saying which one it picked -- "reweighted_to_closed" -- not a key into the file.
 *
 * The first version here read `wj[wj.shipped || 'weights'] || wj.weights`, which looks careful and
 * is not: `wj['reweighted_to_closed']` is undefined for every weight file this project has ever
 * written, so the expression ALWAYS fell through to the fallback. It happened to land on the right
 * vector, so it produced correct numbers for the wrong reason and would have gone on doing so until
 * the day the fallback and the truth diverged. Verified rather than assumed: `weights` and
 * `weights_reweighted_to_closed` are identical element-for-element in the shipped file. */
const W = wj.weights;
if (!Array.isArray(W)) {
  console.error(`${WFILE} has no \`weights\` array — that is the field magnemite.js loads, so there\n` +
    'is no vector here to compare against. Refusing to report.');
  process.exit(1);
}
if ((wj.features || []).join(',') !== B.FEATURES.join(',')) {
  console.error(`REFUSING: ${WFILE} was fitted against a different feature list than board.js exposes.\n` +
    'Comparing a model to a corpus it cannot score is worse than not comparing it.');
  process.exit(1);
}
if (!B.damageEngine()) {
  console.error('the damage engine did not load — every damage feature would read zero and the\n' +
    'predicted distribution would be of a different model than the one that ships. Refusing.');
  process.exit(1);
}

/* The family, derived. Kept as a set of ids so the report can name what it found and a reader can
 * check the derivation caught what they expected. */
const STALLING = new Set();
for (const m of dex.moves.all()) if (m.stallingMove) STALLING.add(m.id);
if (!STALLING.size) { console.error('derived ZERO stalling moves — the probe is broken. Refusing.'); process.exit(1); }

const softmax = (xs) => {
  let mx = -Infinity;
  for (const v of xs) if (v > mx) mx = v;
  if (!isFinite(mx)) return null;
  const ex = xs.map(v => Math.exp(v - mx));
  const t = ex.reduce((a, b) => a + b, 0);
  return t > 0 ? ex.map(e => e / t) : null;
};

function main() {
  const { games } = FP.loadCorpus();
  const tally = {};
  let decisions = 0, offered = 0, obs = 0, pred = 0, seen = 0, skipped = 0;
  /* Bucketed by how many of the choice set were Protects, because a decision offering two
   * Protect-family options is a different denominator from one offering a single Protect, and a rate
   * pooled over both hides which one carries the error. */
  const byOffer = new Map();
  /* Per-species, so a systematic error is attributable rather than a single global number. */
  const bySpecies = new Map();

  for (const g of games) {
    if (seen >= MAXG) break;
    seen++;
    let ds;
    try { ds = FP.decisionsFor(g, tally); } catch (e) { skipped++; continue; }
    for (const d of ds) {
      if (!d.mvs || d.mvs.length !== d.feats.length) { skipped++; continue; }
      decisions++;
      const isP = d.mvs.map(id => STALLING.has(id));
      const nP = isP.filter(Boolean).length;
      if (!nP) continue;
      const scores = d.feats.map(x => {
        let s = 0;
        for (let k = 0; k < W.length; k++) s += W[k] * x[k];
        return s;
      });
      const p = softmax(scores);
      if (!p) { skipped++; continue; }
      offered++;
      let pp = 0;
      for (let i = 0; i < p.length; i++) if (isP[i]) pp += p[i];
      const oo = isP[d.chosen] ? 1 : 0;
      pred += pp; obs += oo;
      const b = byOffer.get(nP) || byOffer.set(nP, { n: 0, obs: 0, pred: 0 }).get(nP);
      b.n++; b.obs += oo; b.pred += pp;
      const s = bySpecies.get(d.sp) || bySpecies.set(d.sp, { n: 0, obs: 0, pred: 0 }).get(d.sp);
      s.n++; s.obs += oo; s.pred += pp;
    }
  }

  if (!offered) {
    console.error('no decision in the corpus offered a Protect-family candidate — that cannot be\n' +
      'right for this format, so the derivation or the replay is broken. Refusing to report.');
    process.exit(1);
  }

  const pc = (a, b) => (100 * a / b).toFixed(2) + '%';
  console.log('PROTECT CALIBRATION — the fitted model against the corpus it was fitted on\n');
  console.log(`  weights   ${WFILE}`);
  console.log(`  family    ${STALLING.size} stalling moves, derived from the dex: ` +
    [...STALLING].slice(0, 8).join(', ') + (STALLING.size > 8 ? ', ...' : ''));
  console.log(`  corpus    ${seen.toLocaleString()} human open-sheet games, ` +
    `${decisions.toLocaleString()} matched decisions` + (skipped ? `, ${skipped} skipped` : ''));
  console.log(`  of those, ${offered.toLocaleString()} offered at least one Protect-family option\n`);

  console.log('  ON THOSE DECISIONS, HOLDING THE CHOICE SET FIXED');
  console.log('  ' + '-'.repeat(66));
  console.log(`    human pressed a Protect     ${obs.toFixed(0).padStart(8)}   ${pc(obs, offered).padStart(8)}`);
  console.log(`    model expects a Protect     ${pred.toFixed(0).padStart(8)}   ${pc(pred, offered).padStart(8)}`);
  const ratio = pred / obs;
  console.log(`    ratio  model / human        ${ratio.toFixed(3).padStart(8)}` +
    `   ${ratio > 1 ? 'the model OVER-predicts Protect' : 'the model UNDER-predicts Protect'}\n`);

  console.log('  BY HOW MANY PROTECTS THE CHOICE SET OFFERED');
  console.log('  ' + '-'.repeat(66));
  console.log('    protects offered      decisions      human      model      ratio');
  for (const [k, b] of [...byOffer.entries()].sort((a, b2) => a[0] - b2[0])) {
    console.log('    ' + String(k).padEnd(20) + String(b.n).padStart(9) +
      pc(b.obs, b.n).padStart(11) + pc(b.pred, b.n).padStart(11) +
      (b.pred / Math.max(1e-9, b.obs)).toFixed(3).padStart(11));
  }

  console.log('\n  LARGEST PER-SPECIES GAPS (>= 40 decisions)');
  console.log('  ' + '-'.repeat(66));
  const rows = [...bySpecies.entries()].filter(([, s]) => s.n >= 40)
    .map(([sp, s]) => ({ sp, n: s.n, o: s.obs / s.n, p: s.pred / s.n, gap: (s.pred - s.obs) / s.n }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 12);
  console.log('    species                decisions      human      model   gap (pts)');
  for (const r of rows) {
    console.log('    ' + r.sp.padEnd(22) + String(r.n).padStart(8) +
      (100 * r.o).toFixed(1).padStart(10) + '%' + (100 * r.p).toFixed(1).padStart(10) + '%' +
      (100 * r.gap >= 0 ? '+' : '') + (100 * r.gap).toFixed(1).padStart(10));
  }

  console.log('\n  HOW TO READ THIS');
  console.log('  ' + '-'.repeat(66));
  console.log('  A conditional logit at its own optimum reproduces the observed count of any subset');
  console.log('  its features can express. So a ratio near 1.000 here means the weights are NOT the');
  console.log('  cause and the Protect excess in play is DISTRIBUTION SHIFT — MAG reaching boards');
  console.log('  the fit corpus does not contain — which reweighting cannot fix and which is a');
  console.log('  statement about self-play, not about the model. A ratio well above 1 means the');
  console.log('  opposite, and localises the error to the rows above.');
}

main();
