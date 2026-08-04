/* build_guru_js.js — generate data/guru.js, the browser bundle the site's GURU booth reads.
 *
 *   node build/build_guru_js.js            regenerate data/guru.js from data/guru-matchups.json
 *   node build/build_guru_js.js --check    fail if the committed data/guru.js is not what this
 *                                          generator would write (ignoring the stamp date)
 *
 * WHY THIS EXISTS. As of 2026-07-25 data/guru.js had NO GENERATOR. Its only reference anywhere in
 * the repository was engine/sanity_check.py checking that the file exists. It had been produced once
 * — by hand or by a script since deleted — and could not be refreshed, so the site's matchup
 * authority was frozen at whatever the store looked like on 2026-07-23: two days stale, computed
 * before the store was repaired, and computed on the UNFILTERED store.
 *
 * That is S1 in the most user-visible place in the project: a derived artifact with no definitive
 * source and no way to regenerate it.
 *
 * guru.py writes data/guru-matchups.json. This projects that into the shape the site expects
 * (window.GURU with archetypes / decisive / matrix / n_games) and adds the provenance the booth
 * needs in order to describe its own population honestly.
 *
 * WHY IT WAS REWRITTEN, 2026-08-04 (MEASURE, PRIORITIES #17)
 * ---------------------------------------------------------
 * data/guru.js published `n_decisive: 0` while data/guru-matchups.json, THE FILE IT IS GENERATED
 * FROM, published `n_decisive: 6`. Cause: guru.py writes the list under the key
 * `decisive_matchups`; this generator read `g.decisive`, which does not exist, fell back to `[]`,
 * and then RECOMPUTED n_decisive as the length of its own empty fallback. It also emitted a
 * provenance note asserting "ZERO statistically-decisive matchups on this population", which was
 * not a finding — it was the key mismatch talking.
 *
 * That is `venusaurmega` / `venusaur-mega` in a new pair of files: a derived artifact keyed off a
 * name the source does not use, failing silently because a missing key is indistinguishable from a
 * legitimate empty answer. The matrix — 144 cells — was byte-identical throughout, which is exactly
 * why nobody noticed: the file looked right everywhere a reader would check.
 *
 * THREE THINGS NOW STOP IT RECURRING, and every one of them is derived rather than remembered:
 *
 *   1. EVERY SOURCE KEY MUST BE ACCOUNTED FOR. A key in guru-matchups.json is either projected into
 *      the bundle or named in DELIBERATELY_UNUSED with a reason. A rename in guru.py therefore fails
 *      this build instead of silently zeroing a field. A fallback to `[]` for a key that does not
 *      exist is the bug; there are no silent fallbacks left.
 *   2. THE COUNT IS CARRIED, NOT RECOMPUTED. n_decisive comes from the source. The one thing this
 *      file recomputes is an ASSERTION that the source's own count and its own list agree, allowing
 *      for guru.py's `decisive[:20]` truncation.
 *   3. --check MODE, run by tests/test-guru-derived.js on every suite run. The comparison is against
 *      what this generator would write TODAY, so an edit to guru-matchups.json that is never
 *      followed by a rebuild is a red test rather than a quiet disagreement.
 *
 * A FOURTH THING THAT IS A MEASUREMENT, NOT A BUILD FIX. `n_decisive` is the count of cells whose
 * 95% Wilson interval excludes 50%, one cell at a time, over a matrix of 66 unordered pairs. Three
 * distinct matchups clear that bar. The expected number of cells clearing it BY CHANCE ALONE, if no
 * archetype beat any other, is 0.05 x (pairs examined) — which on this matrix is about the same
 * number. So the raw count is not evidence of anything on its own, and the bundle now carries the
 * multiplicity arithmetic beside it (`multiplicity`, `decisive_corrected`) so a reader is not left
 * to assume that "the interval excludes 50%" means "this matchup is real". Both numbers are
 * published; neither is hidden behind the other.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const CHECK = process.argv.includes('--check');

const SRC = D('data', 'guru-matchups.json');
if (!fs.existsSync(SRC)) {
  console.error(`missing ${path.relative(ROOT, SRC)} — run: python engine/guru.py`);
  process.exit(1);
}
const g = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const fail = msg => { console.error('BUILD FAIL: ' + msg); process.exit(1); };

/* ---- 1. EVERY SOURCE KEY IS ACCOUNTED FOR ----------------------------------------------------
 * PROJECTED names the source key each bundle field reads, so the mapping is data rather than a
 * scatter of `g.something` expressions. DELIBERATELY_UNUSED is the escape hatch, and it costs a
 * sentence — which is the point: dropping a field should be a decision somebody wrote down. */
const PROJECTED = {
  archetypes: 'archetypes',
  matrix: 'matrix',
  n_games: 'n_games',
  decisive: 'decisive_matchups',
  n_decisive: 'n_decisive',
  predictive_test: 'predictive_test',
};
const DELIBERATELY_UNUSED = {
  generated: 'a prose sentence about guru.py; the bundle states its own generator in provenance',
  n_archetypes: 'equals archetypes.length, and the site reads the list — a second copy of a length '
    + 'is a thing that can disagree with itself',
};
{
  const used = new Set(Object.values(PROJECTED));
  const orphans = Object.keys(g).filter(k => !used.has(k) && !(k in DELIBERATELY_UNUSED));
  if (orphans.length) {
    fail(`data/guru-matchups.json has ${orphans.length} key(s) this generator does not know about: `
      + `${orphans.join(', ')}. Either project them into the bundle or add them to `
      + `DELIBERATELY_UNUSED with a reason. THIS IS THE CHECK THAT WOULD HAVE CAUGHT n_decisive: `
      + `guru.py renamed nothing, but reading a key that does not exist is the same failure.`);
  }
  const missing = Object.entries(PROJECTED).filter(([, src]) => !(src in g));
  if (missing.length) {
    fail(`data/guru-matchups.json is missing ${missing.map(([k, s]) => `${s} (for ${k})`).join(', ')}. `
      + `Re-run: python engine/guru.py`);
  }
}

/* ---- 2. THE SOURCE MUST AGREE WITH ITSELF ----------------------------------------------------
 * guru.py writes `decisive_matchups: decisive[:20]` and `n_decisive: len(decisive)`, so the count
 * legitimately exceeds the list once there are more than twenty. Anything else is the source
 * disagreeing with itself and must not be projected onward. */
const TRUNCATE_AT = 20;
const decisive = g.decisive_matchups;
const nDecisive = g.n_decisive;
if (!Array.isArray(decisive)) fail('decisive_matchups is not an array');
if (typeof nDecisive !== 'number') fail('n_decisive is not a number');
if (decisive.length !== Math.min(nDecisive, TRUNCATE_AT)) {
  fail(`data/guru-matchups.json disagrees with itself: n_decisive=${nDecisive} but `
    + `decisive_matchups holds ${decisive.length} entries (expected `
    + `min(n_decisive, ${TRUNCATE_AT})=${Math.min(nDecisive, TRUNCATE_AT)}).`);
}

/* ---- 3. MULTIPLICITY -------------------------------------------------------------------------
 * Every cell of the matrix is its own hypothesis test. guru.py calls a cell decisive when its 95%
 * Wilson interval excludes 50%, which is a 5% false-positive rate PER CELL. Run over every
 * unordered pair, a handful of "decisive" cells is what the null hypothesis predicts.
 *
 * Computed here rather than in guru.py because it is a property of the WHOLE matrix and guru.py
 * decides cell by cell. Exact two-sided binomial p-values (log-gamma, no normal approximation), then
 * Benjamini-Hochberg at q=0.05 — FDR rather than Bonferroni, because Bonferroni on 66 tests would be
 * an unfairly high bar and BH is already decisive here. */
function lgamma(x) {                       // Lanczos, g=7, n=9 — plenty for n <= a few thousand
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
const lchoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
function binomTwoSided(k, n) {             // P(|X - n/2| >= |k - n/2|) under p=0.5
  if (!n) return 1;
  const d = Math.abs(k - n / 2);
  let p = 0;
  for (let i = 0; i <= n; i++) if (Math.abs(i - n / 2) >= d - 1e-9) p += Math.exp(lchoose(n, i) - n * Math.LN2);
  return Math.min(1, p);
}

const matrix = g.matrix;
const pairs = [];                          // one entry per UNORDERED pair, deduplicated
{
  const seen = new Set();
  for (const a of Object.keys(matrix)) {
    for (const b of Object.keys(matrix[a] || {})) {
      const c = matrix[a][b];
      if (!c || typeof c.n !== 'number' || !c.n) continue;
      const key = [a, b].sort().join('||');
      if (seen.has(key)) continue;
      seen.add(key);
      const wins = Math.round(c.p * c.n);
      pairs.push({ a, b, n: c.n, p: c.p, wins, pval: binomTwoSided(wins, c.n) });
    }
  }
}
pairs.sort((x, y) => x.pval - y.pval);
const ALPHA = 0.05;
/* Benjamini-Hochberg: largest i with p(i) <= i/m * q; everything up to i is discovered. */
let bhCut = 0;
for (let i = 0; i < pairs.length; i++) if (pairs[i].pval <= ((i + 1) / pairs.length) * ALPHA) bhCut = i + 1;
const survivors = pairs.slice(0, bhCut);
const bonferroni = pairs.filter(p => p.pval <= ALPHA / pairs.length);

/* Project the survivors back into the same shape the raw `decisive` list uses, so a consumer can
 * swap one for the other without a second code path. */
const asDecisiveRow = e => {
  const hi = e.p >= 0.5 ? { a: e.a, b: e.b, p: e.p } : { a: e.b, b: e.a, p: +(1 - e.p).toFixed(3) };
  const cell = matrix[hi.a][hi.b];
  return { a: hi.a, b: hi.b, p: cell.p, ci: [cell.lo, cell.hi], n: cell.n, pval: +e.pval.toExponential(3) };
};

const multiplicity = {
  what: 'Every cell of the matrix is a separate 95% test, so some clear the bar by chance. This is '
    + 'the arithmetic of how many, and which — if any — survive a correction for the whole family.',
  pairs_examined: pairs.length,
  alpha_per_test: ALPHA,
  expected_false_positives: +(ALPHA * pairs.length).toFixed(2),
  observed_uncorrected: pairs.filter(p => p.pval <= ALPHA).length,
  n_decisive_uncorrected_directed: nDecisive,
  n_decisive_uncorrected_distinct: Math.round(nDecisive / 2),
  smallest_pvalue: +pairs[0].pval.toExponential(3),
  bonferroni_threshold: +(ALPHA / pairs.length).toExponential(3),
  survive_bonferroni: bonferroni.length,
  survive_bh_fdr_05: survivors.length,
  note: 'n_decisive counts each matchup TWICE — guru.py appends both (A,B) and (B,A) — so the '
    + 'distinct count is half of it. The site already deduplicates; nothing else does.',
};

const out = {
  archetypes: g.archetypes,
  /* CARRIED FROM THE SOURCE, NOT RECOMPUTED FROM A FALLBACK. This line is the bug. */
  decisive,
  matrix,
  n_games: g.n_games,
  n_decisive: nDecisive,
  /* What is left after correcting for the size of the family. Published beside the raw count rather
   * than instead of it, because both are true statements about different questions. */
  decisive_corrected: survivors.map(asDecisiveRow),
  n_decisive_corrected: survivors.length,
  multiplicity,
  predictive_test: g.predictive_test,
  provenance: {
    generated: new Date().toISOString().slice(0, 10),
    generator: 'build/build_guru_js.js from data/guru-matchups.json',
    /* NOT `!process.env.ABRA_UNFILTERED`. That read THIS process's environment to describe a filter
     * applied by a DIFFERENT process (guru.py, possibly days earlier), so the field asserted a fact
     * it had no access to. guru.py loads through engine/store.py, which filters by default; until it
     * records the flag it actually ran under, the honest answer is "the default, unless somebody set
     * ABRA_UNFILTERED when guru.py ran", and this says so instead of guessing. */
    filtered: g.filtered != null ? g.filtered
      : 'not recorded by engine/guru.py — it loads through engine/store.py, which filters unless '
        + 'ABRA_UNFILTERED was set for THAT run',
    source_n_games: g.n_games,
    note: survivors.length === 0
      ? `${Math.round(nDecisive / 2)} matchup(s) have a 95% interval excluding 50% taken one at a `
        + `time, and ZERO survive a correction for the ${pairs.length} pairs examined — about `
        + `${(ALPHA * pairs.length).toFixed(1)} are expected to clear that bar by chance. The matrix `
        + `is descriptive structure; it is not evidence that one archetype beats another.`
      : `${survivors.length} matchup(s) survive Benjamini-Hochberg at q=${ALPHA} across `
        + `${pairs.length} pairs. A matchup is called decisive only at n>=30 with a Wilson interval `
        + `excluding 50%; decisive_corrected is the subset that also survives multiplicity.`,
  },
};

const body = '/* GENERATED by build/build_guru_js.js from data/guru-matchups.json. Do not hand-edit. */\n' +
  'window.GURU=' + JSON.stringify(out) + ';\n';

/* THE DESTINATION IS NAMED ON THE WRITE LINE, not held in a constant, and that is not a style
 * preference. tests/test-site-data-fresh.js and engine/provenance.js both discover who generates a
 * file by looking for its NAME beside a write call; `fs.writeFileSync(DEST, body)` hides it, and
 * doing that here immediately reported data/guru.js as an orphan "the site serves and nothing can
 * regenerate" — which is the precise condition this generator was written in 2026-07-25 to end. */
const DEST = D('data', 'guru.js');

if (CHECK) {
  /* Compare everything EXCEPT provenance.generated, which is today's date by construction and would
   * make this fail one day after every legitimate build. */
  let onDisk = null;
  try {
    const txt = fs.readFileSync(DEST, 'utf8');
    const m = txt.match(/window\.GURU=([\s\S]*);\s*$/);
    onDisk = JSON.parse(m[1]);
  } catch (e) {
    console.error(`CHECK FAIL: cannot read data/guru.js as a GURU bundle (${e.message})`);
    process.exit(1);
  }
  const strip = o => { const c = JSON.parse(JSON.stringify(o)); if (c.provenance) delete c.provenance.generated; return c; };
  const want = JSON.stringify(strip(out)), got = JSON.stringify(strip(onDisk));
  if (want === got) { console.log('data/guru.js agrees with data/guru-matchups.json'); process.exit(0); }
  const wantO = strip(out), gotO = strip(onDisk);
  const keys = [...new Set([...Object.keys(wantO), ...Object.keys(gotO)])];
  console.error('CHECK FAIL: data/guru.js does not match what this generator would write.');
  for (const k of keys) {
    const w = JSON.stringify(wantO[k]), d = JSON.stringify(gotO[k]);
    if (w === d) continue;
    console.error(`  ${k}: on disk ${String(d).slice(0, 120)}`);
    console.error(`  ${' '.repeat(k.length)}  would be ${String(w).slice(0, 120)}`);
  }
  console.error('  fix: node build/build_guru_js.js');
  process.exit(1);
}

fs.writeFileSync(D('data', 'guru.js'), body);

console.log(`wrote data/guru.js — ${out.archetypes.length} archetypes, n_games=${out.n_games}`);
console.log(`  decisive (uncorrected, one test at a time): ${nDecisive} directed = ` +
            `${Math.round(nDecisive / 2)} distinct matchups`);
console.log(`  decisive (Benjamini-Hochberg q=${ALPHA} over ${pairs.length} pairs): ` +
            `${survivors.length}   [expected by chance alone: ${(ALPHA * pairs.length).toFixed(1)}]`);
if (survivors.length === 0) {
  console.log('  NOTE: nothing survives multiplicity. The site must not present this matrix as');
  console.log('  evidence of archetype superiority — no cell is distinguishable from a coin flip');
  console.log('  once the number of cells examined is accounted for.');
}
