/* test-guru-derived.js — data/guru.js is GENERATED from data/guru-matchups.json, so it must agree
 * with it.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-08-04 data/guru.js published `n_decisive: 0` and data/guru-matchups.json — the file it is
 * generated FROM — published `n_decisive: 6`. build/build_guru_js.js read `g.decisive`; guru.py
 * writes the list under `decisive_matchups`. A missing key gave `[]`, the generator then recomputed
 * the count from its own empty fallback, and the bundle carried a provenance note asserting "ZERO
 * statistically-decisive matchups on this population" as though it were a finding.
 *
 * The 144-cell matrix was byte-identical the whole time, which is why nobody noticed: the file
 * looked right everywhere anybody would look. That is the `mega-dex-official.json` /
 * `engine-data.js` failure exactly — A DERIVED ARTIFACT IS NOT A FACT UNTIL SOMETHING COMPARES IT TO
 * ITS SOURCE — in a new pair of files, and the site is self-consistent only by luck of which of the
 * two a given page reads.
 *
 * WHAT IT ASSERTS. It does not re-implement the projection; it runs the real generator in --check
 * mode, which rebuilds the bundle in memory and diffs it field by field against what is on disk.
 * So this stays correct when the generator changes, and it also catches the OTHER half of the
 * problem: an edit to guru-matchups.json that nobody followed with a rebuild.
 *
 * The date stamp is excluded from the comparison by the generator itself — it is today's date by
 * construction, and a test that fails one day after every legitimate build is a test that gets
 * waived.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); c ? P++ : F++; };

console.log('GURU — the bundle must agree with the file it is generated from\n');

const SRC = D('data', 'guru-matchups.json');
const DEST = D('data', 'guru.js');
ok(fs.existsSync(SRC), 'data/guru-matchups.json exists (source)');
ok(fs.existsSync(DEST), 'data/guru.js exists (derived)');

if (fs.existsSync(SRC) && fs.existsSync(DEST)) {
  const r = spawnSync(process.execPath, [D('build', 'build_guru_js.js'), '--check'], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  ok(r.status === 0,
    'data/guru.js is what build/build_guru_js.js would write from data/guru-matchups.json' +
    (r.status === 0 ? '' : '\n' + out.split('\n').map(l => '         ' + l).join('\n')));

  /* The specific number that diverged, asserted directly as well. The --check above subsumes it,
   * but a test whose failure message names `n_decisive` is the one that gets read correctly at
   * 3am, and this pair is the reason the file exists. */
  const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  let bundle = null;
  try { bundle = JSON.parse(fs.readFileSync(DEST, 'utf8').match(/window\.GURU=([\s\S]*);\s*$/)[1]); } catch (e) {}
  ok(!!bundle, 'data/guru.js parses as a window.GURU bundle');
  if (bundle) {
    ok(bundle.n_decisive === src.n_decisive,
      `n_decisive agrees: bundle ${bundle.n_decisive} === source ${src.n_decisive}`);
    ok(bundle.n_games === src.n_games,
      `n_games agrees: bundle ${bundle.n_games} === source ${src.n_games}`);
    ok(JSON.stringify(bundle.decisive) === JSON.stringify(src.decisive_matchups),
      `the decisive list agrees (${(bundle.decisive || []).length} entries)`);
    ok((bundle.decisive || []).length === Math.min(src.n_decisive, 20),
      'the list length matches the count, allowing for guru.py\'s decisive[:20] truncation');
    /* THE MULTIPLICITY BLOCK IS NOT OPTIONAL. n_decisive is a count of per-cell 95% tests over a
     * whole matrix; without the family size beside it a reader cannot tell 3 discoveries from 3
     * expected false positives. */
    ok(bundle.multiplicity && typeof bundle.multiplicity.pairs_examined === 'number',
      'the bundle carries the family size its per-cell tests were run over');
    ok(typeof bundle.n_decisive_corrected === 'number',
      `and the count that survives correction (${bundle.n_decisive_corrected} of ` +
      `${bundle.n_decisive} directed, ~${bundle.multiplicity && bundle.multiplicity.expected_false_positives} expected by chance)`);
  }
}

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
