/* test-drop-guard.js — a DROP=<feature> fit must actually drop the feature, everywhere.
 *
 * WHY THIS TEST EXISTS. `engine/fit_policy.js` supports `DROP=<feature>` to refit the model as if a
 * feature did not exist, and it implements that by zeroing the feature's column. Features were built
 * in TWO places in `decisionsFor` — once for a voluntary switch decision, once for a move decision —
 * and only the move path zeroed the column.
 *
 * Nothing failed. The fit ran, exited 0, and wrote a weight file. But the dropped column was not
 * constant: it held its real value on every switch row, so it had become a proxy for "this row is a
 * switch", and the optimiser fitted a confident coefficient to it. `priorLogP` came out at **-1.73,
 * SE 0.05** in `data/policy-weights-nopop.json` — a fit whose entire purpose was its absence — with
 * the opposite sign to the full model's +0.16.
 *
 * Two published claims were measured on that file: the no-popularity arm of the popularity x greedy
 * 2x2 (which lost to a random-clicking bot, and was blamed on a feature-count straddle), and
 * "dropping how often people click this makes MAG predict human clicks BETTER".
 *
 * The two checks below are deliberately different in kind:
 *   1. BEHAVIOURAL — assertDropped() must exit non-zero on a corpus where any row escaped the drop.
 *   2. STRUCTURAL  — `B.featuresFor(` must appear exactly once in fit_policy.js. This is the check
 *      that catches the actual defect, which was a second build path, not a bad assertion. A third
 *      call site added later fails this test even if it happens to be correct, which is the point:
 *      there is one place features are built and the drop lives inside it.
 */
'use strict';
require('../engine/showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('DROP GUARD — a dropped feature must be identically zero everywhere\n');

if (!process.env.SHOWDOWN_PATH) {
  console.log('  FAIL SHOWDOWN_PATH is not set, so fit_policy.js cannot be loaded');
  console.log('\nDROP GUARD TESTS: 0 passed, 1 failed');
  process.exit(1);
}

/* ---- 1. BEHAVIOURAL ------------------------------------------------------------------------- */

/* Run assertDropped in a child process, because it reports by exiting non-zero — which is the
 * correct behaviour for a fit that must not be allowed to produce a number. `dirty` decides whether
 * one candidate row keeps a nonzero value in the dropped column. */
function runGuard(dirty) {
  const script = `
    const F = require(${JSON.stringify(D('engine', 'fit_policy.js'))});
    const B = require(${JSON.stringify(D('engine', 'board.js'))});
    const i = B.FEATURE_INDEX.priorLogP;
    const zeros = () => new Array(B.FEATURES.length).fill(0);
    const rows = [];
    for (let r = 0; r < 600; r++) rows.push({ game: 'g' + r, sp: 'x', feats: [zeros(), zeros()], chosen: 0 });
    if (${dirty}) rows[417].feats[1][i] = -3.2;   /* one row, one candidate, deep in the corpus */
    F.assertDropped(rows);
    console.log('ASSERT_RETURNED');
  `;
  return spawnSync(process.execPath, ['-e', script], {
    env: { ...process.env, DROP: 'priorLogP' },
    encoding: 'utf8',
  });
}

const clean = runGuard(false);
ok(clean.status === 0 && /ASSERT_RETURNED/.test(clean.stdout),
  'a corpus with the column truly zeroed passes the guard');

const dirty = runGuard(true);
ok(dirty.status !== 0,
  `a corpus with ONE escaped row in 600 fails the guard (exit ${dirty.status})`);
ok(!/ASSERT_RETURNED/.test(dirty.stdout),
  'the guard stops the run rather than returning and letting the fit proceed');
ok(/DID NOT APPLY/.test(dirty.stderr || ''),
  'the guard names the failure instead of dying obscurely');

/* The bug was one escaped row class out of many, so a guard that only samples the head of the
 * corpus would have missed it exactly as the old duplicate-id check missed 401 duplicates past
 * line 7,144. Row 417 of 600 is past any plausible sample window. */
ok(/\b3\.2000\b/.test(dirty.stderr || ''),
  'the guard reports the escaped value it found (3.2000), so it read row 417 and not a leading sample');

/* ---- 2. STRUCTURAL ------------------------------------------------------------------------- */

const src = fs.readFileSync(D('engine', 'fit_policy.js'), 'utf8');
const callSites = (src.match(/B\.featuresFor\s*\(/g) || []).length;
ok(callSites === 1,
  `fit_policy.js builds features in exactly one place (found ${callSites} call sites to B.featuresFor)`);

/* And that one place must be the function that applies the drop. */
const featsFor = src.match(/function featsFor[\s\S]*?\n}/);
ok(!!featsFor && /B\.featuresFor\s*\(/.test(featsFor[0]) && /DROP_IDX/.test(featsFor[0]),
  'the single call site is inside featsFor(), which applies DROP_IDX');

console.log(`\nDROP GUARD TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
