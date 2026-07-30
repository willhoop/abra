/* THE POLICY GRADIENT, PINNED AGAINST FINITE DIFFERENCES.
 *
 * engine/train_policy.js turns self-play games into weight updates using
 *
 *     d/dw log P(j)  =  x_j  -  SUM_k p_k x_k
 *
 * A wrong version of that does not crash and does not look wrong. It produces a smooth learning
 * curve, a plausible weight vector, and a completely meaningless model — the exact shape of failure
 * this repository has paid for most often. So the analytic gradient is checked here against the
 * numerical derivative of log P(j), which shares no code with it.
 *
 * The numerical side recomputes the softmax from scratch at w+h and w-h and takes the central
 * difference. If the two agree to a few parts in a million on random problems, the formula and its
 * implementation are both right.
 *
 * Also pinned: the two properties that make the accumulator usable at all —
 *   - the gradient of a decision with only ONE legal option is exactly zero (nothing was chosen)
 *   - the gradient components SUM to zero across the options of a decision, because the probabilities
 *     do; this is what makes symmetric self-play's +1/-1 baseline exact rather than approximate.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const { accumulateLogitGrad } = require(path.join(ROOT, 'engine', 'magnemite.js'));

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
  if (!cond) fails++;
};

/* A deterministic PRNG so a failure is reproducible rather than "it went red once".
 *
 * mulberry32, the same generator engine/chomp_ev.js uses, and NOT the textbook LCG this file
 * originally reached for. tests/test-prng.js exists precisely to ban `state * 1103515245` in float
 * arithmetic — the multiply overflows 2^53, the low bits stop being random, and the sequence cycles
 * after ~16,000 of 200,000 draws. It caught this file on its first run, which is the guard doing
 * exactly its job: a short-period generator would have made these gradient checks sample the same
 * handful of problems over and over while appearing to test forty. */
let _s = 12345;
const rnd = () => {
  _s = (_s + 0x6D2B79F5) | 0;
  let t = _s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const softmax = (vecs, w) => {
  const s = vecs.map(x => x.reduce((a, v, k) => a + v * w[k], 0));
  const max = Math.max(...s);
  const e = s.map(v => Math.exp(v - max));
  const t = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / t);
};
const logP = (vecs, w, j) => Math.log(softmax(vecs, w)[j]);

console.log('POLICY GRADIENT — ANALYTIC vs FINITE DIFFERENCE\n');

/* ---- 1. random problems, every weight checked ------------------------------------------------ */
let worst = 0, checks = 0;
for (let trial = 0; trial < 40; trial++) {
  const nW = 6 + Math.floor(rnd() * 6);
  const nC = 2 + Math.floor(rnd() * 6);
  const w = Array.from({ length: nW }, () => rnd() * 4 - 2);
  const vecs = Array.from({ length: nC }, () => Array.from({ length: nW }, () => rnd() * 2 - 1));
  const j = Math.floor(rnd() * nC);

  const probs = softmax(vecs, w);
  const g = accumulateLogitGrad(new Array(nW).fill(0), vecs, probs, j, nW);

  const h = 1e-5;
  for (let k = 0; k < nW; k++) {
    const wp = w.slice(); wp[k] += h;
    const wm = w.slice(); wm[k] -= h;
    const num = (logP(vecs, wp, j) - logP(vecs, wm, j)) / (2 * h);
    const err = Math.abs(num - g[k]);
    if (err > worst) worst = err;
    checks++;
  }
}
ok(worst < 1e-6, 'analytic gradient matches finite differences on 40 random problems',
  `${checks} partial derivatives, largest disagreement ${worst.toExponential(2)}`);

/* ---- 2. accumulation is additive -------------------------------------------------------------- */
{
  const nW = 5;
  const w = Array.from({ length: nW }, () => rnd() * 2 - 1);
  const A = Array.from({ length: 3 }, () => Array.from({ length: nW }, () => rnd()));
  const Bv = Array.from({ length: 4 }, () => Array.from({ length: nW }, () => rnd()));
  const gBoth = new Array(nW).fill(0);
  accumulateLogitGrad(gBoth, A, softmax(A, w), 1, nW);
  accumulateLogitGrad(gBoth, Bv, softmax(Bv, w), 2, nW);
  const g1 = accumulateLogitGrad(new Array(nW).fill(0), A, softmax(A, w), 1, nW);
  const g2 = accumulateLogitGrad(new Array(nW).fill(0), Bv, softmax(Bv, w), 2, nW);
  const diff = Math.max(...gBoth.map((v, k) => Math.abs(v - (g1[k] + g2[k]))));
  ok(diff < 1e-12, 'accumulating two decisions equals the sum of their gradients',
    `largest difference ${diff.toExponential(2)}`);
}

/* ---- 3. a decision with one option carries no information ------------------------------------- */
{
  const nW = 5;
  const v = [Array.from({ length: nW }, () => rnd())];
  const g = accumulateLogitGrad(new Array(nW).fill(0), v, [1], 0, nW);
  ok(g.every(x => Math.abs(x) < 1e-12), 'a forced decision (one option) has zero gradient',
    'nothing was chosen, so nothing is learned');
}

/* ---- 4. the per-decision gradients across options sum to zero --------------------------------- */
{
  const nW = 5, nC = 4;
  const w = Array.from({ length: nW }, () => rnd() * 2 - 1);
  const vecs = Array.from({ length: nC }, () => Array.from({ length: nW }, () => rnd() * 2 - 1));
  const probs = softmax(vecs, w);
  const tot = new Array(nW).fill(0);
  for (let j = 0; j < nC; j++) {
    const g = accumulateLogitGrad(new Array(nW).fill(0), vecs, probs, j, nW);
    for (let k = 0; k < nW; k++) tot[k] += probs[j] * g[k];
  }
  const m = Math.max(...tot.map(Math.abs));
  ok(m < 1e-12, 'the probability-weighted gradients over all options sum to zero',
    `largest residual ${m.toExponential(2)} — this is what makes the +1/-1 self-play baseline exact`);
}

console.log(fails ? `\nPOLICY GRADIENT: ${fails} FAILED` : '\nPOLICY GRADIENT: all checks passed');
process.exit(fails ? 1 : 0);
