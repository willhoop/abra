/* tests/test-docs-quarantine.js — A LIVING DOCUMENT MAY NOT STATE A FIGURE SOURCED FROM AN ARTIFACT
 * THE QUARANTINE GATE CURRENTLY WITHHOLDS.
 *
 * WHY THIS EXISTS. On 2026-09-06 three withheld figures were republished out of `docs/WEB.md` and
 * every check passed, because the citations were FAITHFUL: `engine/docs_scan.js`'s citation rule asks
 * "is this figure in the artifact it cites?" and a quarantined artifact answers YES. `status.js`
 * withheld the number on one screen while the docs gate cleared the document reprinting it on
 * another. CLAUDE.md: "A CAPTION IS NOT A QUARANTINE... the figure must be WITHHELD, not annotated."
 *
 * THE MEASUREMENT IS `engine/docs_scan.js`'s AND THE POLICY IS HERE, which is the split that file
 * already declares. The withheld set is DERIVED from `engine/quarantine.js` — there is no list of
 * artifacts in either file, or this becomes the hand-maintained ban list of four in a new costume.
 *
 * ================================================================================================
 * IT IS A RATCHET, AND IT WAS SEEDED AT 104 WHEN 92 OF THOSE WERE NOT OFFENDERS.
 * ================================================================================================
 * Seeded 2026-09-06 at 104 keys across 14 documents, on the honest belief that all 104 were real
 * republications of a withheld number. Re-seeded the same day, and the split matters more than the
 * number:
 *
 *   67  FIXED — a documents pass withdrew them (docs/_reports/2026-09-06-withdraw-quarantined-figures.md).
 *   18  THE CLASSIFIER WAS WRONG. `engine/quarantine.js` was withholding the mechanics census, the
 *       rate runner, the register audit, the register copy and the click-coverage probe — five
 *       INSTRUMENTS, which CLAUDE.md names in as many words as NOT quarantined. It had also
 *       quarantined ITSELF off its own test fixtures. The figures were always quotable; the ruler
 *       said otherwise. 72 artifacts withheld before, 63 after.
 *    7  THE FIGURE NEVER CAME FROM THAT ARTIFACT. `data/policy-weights.json` publishes 58 content
 *       hashes, and the scanner was cutting digit runs out of them — `docs/MEASURE.md` calls it a
 *       coincidence engine. Fixed in engine/docs_scan.js#isTokenFragment.
 *   12  REAL, and carried forward.
 *
 * PLUS 40 THAT NOTHING COULD SEE UNTIL TODAY. `quarantinedFigures` gained a second route: a figure
 * uniquely attributable to a withheld artifact, with NO citation beside it. The clause used to need
 * the citation and the figure in the same block, and `docs/ABRA-deck-plain-english.md` names an
 * artifact in 14 of its 354 paragraphs — so the document written for the least technical reader was
 * the one the gate could not see. It scores ZERO on the new route, which is a result rather than a
 * silence. See engine/docs_scan.js for why uniqueness, and not "in some withheld artifact".
 *
 * A RATCHET SEEDED ON FALSE POSITIVES PROTECTS NOTHING, which is why it was re-seeded rather than
 * left to shrink on its own: 92 permitted keys are 92 places a genuine republication could land and
 * be waved through by a line that was already there. The 52 that remain are real — MAG's weights,
 * the leaf backtest, the feature contrast, the feature shift, the censoring census, the
 * exploitability search — and correcting them is a documents pass across divisions' ledgers, not a
 * line in a test.
 *
 * So the seeded list below is the census AS MEASURED, and it MAY ONLY SHRINK. A key that is not in
 * it FAILS the build; a key in it that no longer fires is REPORTED so the line can be deleted. That
 * is the same mechanism `data/docs-currency-baseline.json` uses one rule over, and it is not a
 * tolerance: every offender is enumerated by name, nothing is absorbed by a word in a paragraph, and
 * the list cannot grow without somebody typing into it.
 *
 * THE KEY IS `doc|figure|artifact`, NEVER A LINE NUMBER. Prose moves; the claim does not.
 *
 * NOTHING HERE IS SEEDED BY THE RUN. The list is a literal. A baseline this file wrote for itself
 * would adopt whatever the tree looks like on the day it breaks, which is the failure
 * `data/provenance-stamp.json` records in its own header.
 */
'use strict';
const path = require('path');
const DS = require(path.join(__dirname, '..', 'engine', 'docs_scan.js'));

let failed = 0;
const ok = (pass, name, detail) => {
  console.log('  ' + (pass ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '\n          ' + detail : ''));
  if (!pass) failed++;
};

/* ---- THE SEEDED CENSUS — 2026-09-06, gate CLOSED, 63 artifacts withheld. MAY ONLY SHRINK. ----- */
const BASELINE = new Set([
  "docs/ABRA-technical-docs.md|14.757%|data/policy-weights.json",
  "docs/ABRA-technical-docs.md|44,982|data/sheet-channel-value.json",
  "docs/ABRA-technical-docs.md|49.3%|data/policy-weights.json",
  "docs/ABRA-whitepaper.md|14.757%|data/policy-weights.json",
  "docs/ABRA-whitepaper.md|232,815|data/policy-weights.json",
  "docs/ABRA-whitepaper.md|44,982|data/sheet-channel-value.json",
  "docs/ABRA-whitepaper.md|49.3%|data/policy-weights.json",
  "docs/COVERAGE-PLAN-REVIEW.md|960,000|data/exploit-step-probe.json",
  "docs/ENGINE.md|1,136,845|data/feature-engine-contrast.json",
  "docs/ENGINE.md|48,274|data/censoring-value.json",
  "docs/ENGINE.md|5,878|data/leaf-position-contrast.json",
  "docs/ENGINE.md|6,055|data/feature-engine-contrast.json",
  "docs/ENGINE.md|6,167|data/leaf-position-contrast.json",
  "docs/ENGINE.md|6,371|data/leaf-position-contrast.json",
  "docs/EXTERNAL-EVIDENCE.md|6,890|data/winrate-backtest.json",
  "docs/GAME-DIFFERENTIAL-DESIGN.md|8,855|data/leaf-engine-contrast.json",
  "docs/MEASURE.md|1,136,845|data/feature-engine-contrast.json",
  "docs/MEASURE.md|14.757%|data/policy-weights.json",
  "docs/MEASURE.md|202,343|data/policy-weights-joint.json",
  "docs/MEASURE.md|202,918|data/policy-weights-joint.json",
  "docs/MEASURE.md|220,932|data/feature-engine-contrast.json",
  "docs/MEASURE.md|395,130|data/policy-weights-joint.json",
  "docs/MEASURE.md|396,288|data/policy-weights-joint.json",
  "docs/MEASURE.md|44,982|data/sheet-channel-value.json",
  "docs/MEASURE.md|48,274|data/censoring-value.json",
  "docs/MEASURE.md|51.25%|data/winrate-backtest.json",
  "docs/MEASURE.md|55.92%|data/leaf-position-contrast.json",
  "docs/MEASURE.md|6,890|data/winrate-backtest.json",
  "docs/MEASURE.md|7,994|data/leaf-engine-contrast.json",
  "docs/MEASURE.md|8,855|data/leaf-engine-contrast.json",
  "docs/MEASURE.md|91,240|data/feature-engine-contrast.json",
  "docs/MODELS.md|14.757%|data/policy-weights.json",
  "docs/MODELS.md|2.92%|data/policy-weights.json",
  "docs/MODELS.md|23.4%|data/policy-weights.json",
  "docs/MODELS.md|48,274|data/censoring-value.json",
  "docs/MODELS.md|49.3%|data/policy-weights.json",
  "docs/MODELS.md|81,515|data/redirect-audit.json",
  "docs/OPS.md|1.744%|data/collinearity-joint.json",
  "docs/PRIOR-ART.md|186,494|data/policy-weights.json",
  "docs/PRIORITIES.md|6,890|data/winrate-backtest.json",
  "docs/ROADMAP.md|0.687%|data/feature-shift.json",
  "docs/ROADMAP.md|0.889%|data/feature-shift.json",
  "docs/ROADMAP.md|28.33%|data/feature-shift.json",
  "docs/ROADMAP.md|51,399|data/feature-shift.json",
  "docs/ROADMAP.md|6779|data/leaf-position-contrast.json",
  "docs/ROADMAP.md|81,515|data/redirect-audit.json",
  "docs/SEARCH.md|1,600|data/exploitability.json",
  "docs/SEARCH.md|1.576%|data/feature-shift.json",
  "docs/SEARCH.md|51,399|data/feature-shift.json",
  "docs/SEARCH.md|64.24%|data/rollout-r1-explore-sweep.json",
  "docs/SEARCH.md|66.645%|data/rollout-r1-explore-sweep.json",
  "docs/SEARCH.md|960,000|data/exploit-step-probe.json",
]);

console.log('\n  QUARANTINED FIGURES IN LIVING DOCUMENTS — the citation was faithful and that is the bug\n');

const r = DS.quarantinedFigures(DS.liveDocs());

/* A CLAUSE THAT CANNOT SEE THE GATE IS NOT A PASSING CLAUSE. `quarantinedFigures` returns
 * `cannot_answer` when engine/quarantine.js would not load or would not compute, and "nothing was
 * checked" must never read as "nothing is wrong" — that is the silent-default shape this repository
 * opens with. */
ok(!r.cannot_answer, 'the withheld set could be computed at all', r.why);

/* AND EVERY DOCUMENT WAS ACTUALLY READ. A file the scan could not open is a HOLE in the scan, not a
 * clean document, and it would otherwise show up as silence — which is the shape this whole rule is
 * about. */
ok(!r.unreadable || r.unreadable.length === 0,
  'every live document could be read, so the census covers the set it claims to',
  (r.unreadable || []).map(u => u.doc + ' — ' + u.error).join('; '));

if (r.gate_open) {
  /* THE DAY THE GATE OPENS THIS CLAUSE CORRECTLY ACCUSES NOBODY, and it says WHY rather than
   * printing a green zero that looks like the documents were cleaned up. */
  ok(true, 'THE GATE IS OPEN — nothing is withheld, so no document can be republishing a withheld '
    + 'figure. This clause is quiet for a reason about the GATE, not about the documents.', r.why);
} else {
  const keys = r.hits.map(DS.quarantineKey);
  const fresh = r.hits.filter(h => !BASELINE.has(DS.quarantineKey(h)));
  const gone = [...BASELINE].filter(k => !keys.includes(k));

  ok(fresh.length === 0,
    'NO NEW figure sourced from a quarantined artifact has entered a living document',
    fresh.length
      ? fresh.map(h => h.doc + ':' + h.line + '  ' + h.figure + '  <- ' + h.cite
          + '\n            ' + h.text).join('\n          ')
      : keys.length + ' known offender(s) stand, all of them in the seeded census');

  /* REPORTED, NOT FAILED. A key that stops firing is a document that got FIXED, and failing on
   * progress is how a ratchet teaches people to stop fixing things. */
  console.log('\n  the seeded census holds ' + BASELINE.size + '; ' + keys.length + ' still fire, '
    + gone.length + ' no longer do.');
  if (gone.length) {
    console.log('  DELETE these lines from BASELINE — the document no longer states the figure:');
    for (const k of gone) console.log('    ' + k);
  }
  console.log('  ' + r.why);
}

/* ---- SHOWN RED, ON EVERY RUN, ON SYNTHETIC INPUT ---------------------------------------------
 *
 * The standing rule here is that no check is committed until it has been seen FAILING on known-bad
 * input, and a demonstration that only ever ran once is a claim about a day rather than about the
 * check. All three arms drive the SHIPPING function through its injection points — a fake `withhold`
 * and a fake `read` — so no file is touched and nothing depends on what the real gate happens to say.
 *
 * THE FIGURE IS REAL. `51.0%` is in `data/winrate-backtest.json`, it is the leaf figure republished
 * out of docs/WEB.md on 2026-09-06, and that artifact is downstream of the simulator. */
{
  const PARA = 'The leaf reads **51.0%** on the held-out set, cited to `data/winrate-backtest.json`.';
  const held = (f) => (String(f) === 'data/winrate-backtest.json'
    ? { file: f, because: 'synthetic — this arm', clause: 'synthetic' } : null);
  const red = DS.quarantinedFigures(['synthetic.md'], { withhold: held, read: () => PARA });
  ok(red.hits.length === 1 && red.hits[0].figure === '51.0%',
    'RED — a paragraph citing a WITHHELD artifact and stating one of its figures is caught',
    JSON.stringify(red.hits.map(h => h.figure)));

  /* THE CONTROL, WHICH IS THE HALF THAT MAKES THE ARM ABOVE MEAN ANYTHING: the identical paragraph
   * with the artifact NOT withheld is clean. Without it, a clause that accused every citation would
   * pass the red arm and be useless. */
  const green = DS.quarantinedFigures(['synthetic.md'], { withhold: () => null, read: () => PARA });
  ok(green.hits.length === 0,
    'CONTROL — the identical paragraph is CLEAN when the artifact is not withheld, so the clause '
    + 'keys on the gate and not on the citation',
    JSON.stringify(green.hits.map(h => h.figure)));

  /* AND THE CAPTION, WHICH IS THE ONE THAT MUST NOT WORK. The retraction rule deliberately skips a
   * paragraph matching QUALIFIED ("previously", "stale", "was measured") because such a paragraph is
   * DISCUSSING a figure. That escape may not exist here: a quarantined figure with a caveat beside it
   * is precisely what CLAUDE.md calls the bug, and `PRE-CHANGE` was printed beside these very numbers
   * for days while they went on being quoted. */
  const captioned = DS.quarantinedFigures(['synthetic.md'], { withhold: held,
    read: () => 'PREVIOUSLY, and now stale: the leaf read **51.0%**, per '
      + '`data/winrate-backtest.json`. This figure was measured before the fix.' });
  ok(captioned.hits.length === 1,
    'RED — a CAPTION does not clear it. "previously", "stale" and "was measured" are the words the '
    + 'retraction rule honours, and this rule refuses them: the figure must be absent, not annotated',
    JSON.stringify(captioned.hits.map(h => h.figure)));
}

console.log(failed ? '\n  ' + failed + ' CHECK(S) FAILED\n' : '\n  all checks passed\n');
process.exit(failed ? 1 : 0);
