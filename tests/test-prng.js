/* test-prng.js — any generator that feeds a bootstrap must actually be uniform.
 *
 * WHY THIS EXISTS. `engine/chomp_ev.js` computed every confidence interval it publishes with a
 * clustered bootstrap driven by this generator:
 *
 *     seedState = (seedState * 1103515245 + 12345) & 0x7fffffff
 *
 * That is the textbook LCG, and it is correct in C where the arithmetic is 32-bit. In JavaScript every
 * number is a float64. A mid-range state times 1103515245 is about 1.4e18, well past
 * Number.MAX_SAFE_INTEGER (9.0e15), so the product loses its LOW bits to floating-point rounding — and
 * the low bits are exactly what the mask and `Math.floor(rnd() * n)` depend on. Measured over 200,000
 * draws: mean 0.4954, chi-square 159.5 on 9 df against a 5% critical value of 16.9, and 16,403 distinct
 * values — it cycles.
 *
 * WHAT IT COST. The headline CHOMP-EV sign test reported p = 0.5129 with ci95 [0.5021, 0.5395] — an
 * interval asymmetric by a factor of 2.5 around a proportion near 0.5, which a healthy bootstrap cannot
 * produce at n = 2,124. The correct Wilson interval is [0.4916, 0.5341] and it CONTAINS 0.5. The verdict
 * string in that file is gated on `signCI[0] > 0.5`, so the broken generator is the only reason it
 * printed "CI clear of 0.5" rather than the "suggestive, not significant" branch already sitting in the
 * same expression.
 *
 * A bad PRNG is the ideal silent failure: it produces plausible numbers, no exception, no warning, and
 * the output is a confidence interval — the one artifact a reader is least likely to re-derive.
 *
 * The three checks are cheap and each would have caught it: the mean, a chi-square for uniformity, and
 * a distinct-value count for the short period. The structural check greps for the overflowing constant
 * so a copy-paste of the same recurrence fails rather than shipping.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('PRNG — generators that feed a bootstrap must be uniform and long-period\n');

const N = 200000;
const BINS = 10;
/* 9 degrees of freedom, upper 0.1% point. Deliberately not the 5% point: a correct generator fails a
 * 5% test one time in twenty, and a test suite that goes red on a fifth of a percent of runs gets
 * ignored, which is how the project lost selftest.js. This still rejects the old generator by a factor
 * of five. */
const CHI_LIMIT = 27.877;

function measure(rnd) {
  const bins = new Array(BINS).fill(0);
  const seen = new Set();
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const v = rnd();
    if (!(v >= 0 && v < 1)) return { bad: `produced ${v}, outside [0,1)` };
    sum += v;
    bins[Math.min(BINS - 1, Math.floor(v * BINS))]++;
    seen.add(v);
  }
  const exp = N / BINS;
  const chi = bins.reduce((s, o) => s + (o - exp) * (o - exp) / exp, 0);
  return { mean: sum / N, chi, distinct: seen.size };
}

/* The generator actually shipped in chomp_ev.js, lifted by evaluating the source so this test cannot
 * drift from it the way a re-typed copy would. */
function liftRnd(relPath, declName) {
  const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const i = src.indexOf(`const ${declName} = `);
  if (i < 0) return null;
  /* Take from the declaration to the first line that closes it at depth zero. */
  let depth = 0, started = false, end = -1;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{' || c === '(') { depth++; started = true; }
    else if (c === '}' || c === ')') { depth--; }
    if (started && depth === 0 && src[j] === ';') { end = j + 1; break; }
    if (started && depth === 0 && src[j] === '}' && src[j + 1] === ';') { end = j + 2; break; }
  }
  if (end < 0) return null;
  const decl = src.slice(i, end);
  try {
    // eslint-disable-next-line no-new-func
    return new Function(`let seedState = 12345; let rng = 12345; ${decl} return ${declName};`)();
  } catch (e) { return null; }
}

for (const [rel, name] of [['engine/chomp_ev.js', 'rnd'], ['build/build_mew_bundle.js', 'rand']]) {
  const rnd = liftRnd(rel, name);
  if (!rnd) { ok(false, `could lift ${name}() out of ${rel} to test it`); continue; }
  const r = measure(rnd);
  if (r.bad) { ok(false, `${rel} ${name}(): ${r.bad}`); continue; }
  ok(Math.abs(r.mean - 0.5) < 0.005,
    `${rel} ${name}() mean is 0.5 (measured ${r.mean.toFixed(5)}; the overflowing LCG gave 0.4954)`);
  ok(r.chi < CHI_LIMIT,
    `${rel} ${name}() is uniform across ${BINS} bins (chi-square ${r.chi.toFixed(1)} < ${CHI_LIMIT}; ` +
    `the overflowing LCG gave 159.5)`);
  ok(r.distinct > N * 0.9,
    `${rel} ${name}() does not cycle (${r.distinct.toLocaleString()} distinct of ${N.toLocaleString()}; ` +
    `the overflowing LCG gave 16,403)`);
}

/* STRUCTURAL. The defect is a specific recurrence whose product overflows float53. Anything that
 * multiplies a 31-bit state by this constant in JavaScript is broken however it is spelled, so the
 * constant itself is the thing to refuse. */
const OFFENDER = /\*\s*1103515245/;
const scanned = [];
for (const dir of ['engine', 'build', 'tests', 'web', 'app']) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (!/\.(js|py)$/.test(f)) continue;
    if (dir === 'tests' && f === 'test-prng.js') continue;   /* this file names it to forbid it */
    let src = fs.readFileSync(path.join(d, f), 'utf8');
    /* Comments are stripped first. Both fixed files now DESCRIBE the old recurrence in a comment
     * explaining why it was wrong, and matching that would make the check fire forever on its own
     * documentation. Stripping comments is safe for THIS check in a way it was not for the
     * ladder-store guard in engine/selftest.js: a real path lives inside a string literal, but a real
     * use of this constant is executable arithmetic, which a comment by definition is not. */
    src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1').replace(/^\s*#.*$/gm, '');
    if (OFFENDER.test(src)) scanned.push(dir + '/' + f);
  }
}
ok(scanned.length === 0,
  `no file multiplies its state by 1103515245 in float arithmetic` +
  (scanned.length ? ` — found in: ${scanned.join(', ')}` : ''));

console.log(`\nPRNG TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
