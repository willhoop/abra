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

/* ---- THE SEEDED CENSUS — 2026-09-06, gate CLOSED, 63 artifacts withheld. MAY ONLY SHRINK. -----
 *
 * 2026-09-11, SHRUNK BY 17, DERIVED BY RUNNING THIS FILE. The ledger passes of 2026-09-11 withdrew
 * the figures behind 15 keys, and the quarantine-classifier pass withdrew SEARCH R20's two. This file
 * printed exactly those 17 under "DELETE these lines"; none was hand-picked
 * (docs/_reports/2026-09-11-quarantine-classifier.md).
 *
 * 2026-09-11, AND FOUR KEYS WERE ADDED: THE ONE PLACE THIS LIST GREW, AND WHY. engine/quarantine.js
 * learned to hold an artifact with no discoverable writer by what it says about itself, and
 * data/policy-weights-pre-censoring.json is a key-for-key twin of the MAG vector. Its corpus counts
 * (the 3.40.0 fit's decisions and held-out split) were ALREADY standing in the four documents below
 * when the classifier started seeing them. No document gained a figure in that pass. This is the
 * 2026-09-06 re-seed's shape ("PLUS 40 THAT NOTHING COULD SEE UNTIL TODAY"), not a republication
 * waved through. The documents belong to passes that brief did not own, so the figures are OWED OUT
 * of them; delete each key the day its figure goes.
 *
 * 2026-09-11, SHRUNK BY 7 MORE, DERIVED BY RUNNING THIS FILE. The four keys above went the day their
 * figures went: the pre-censoring corpus counts were withdrawn from the white paper, the technical docs
 * and the engine coverage plan. Three more fell with them, because they shared the rewritten
 * sentences or the artifact: the white paper's MAG decision count, and the step probe's cheapest-split
 * budget in SEARCH R9 and in the coverage-plan review. This file printed exactly those 7 under "DELETE
 * these lines" (docs/_reports/2026-09-11-withdrawals-2.md).
 *
 * 2026-09-11, SHRUNK BY 4 MORE, DERIVED BY RUNNING THIS FILE. The third withdrawals pass took out the
 * channel-value sample (white paper and technical docs), the censoring value's sample and the
 * 2026-08-02 joint refit's turn count (docs/MODELS.md). This file printed exactly those 4 under
 * "DELETE these lines" (docs/_reports/2026-09-11-withdrawals-3.md). The `14.757%` and `49.3%` keys
 * that stand in those three documents match a MAG weight by digits only: `14.757%` is a store-derived
 * human click rate and `49.3%` is a game-differential share (474 of 961). In docs/MODELS.md the 49.3%
 * key also covers a DODUO harness rate that traces to no artifact at all. They stay because they still
 * fire, and a key is deleted only when this file says so.
 *
 * 2026-09-11, SHRUNK BY 2 MORE, DERIVED BY RUNNING THIS FILE. The fourth withdrawals pass took the leaf
 * backtest's usable-game count out of docs/EXTERNAL-EVIDENCE.md and docs/PRIORITIES.md, and this file
 * printed exactly those 2 under "DELETE these lines" (docs/_reports/2026-09-11-withdrawals-4.md). The
 * DODUO harness rate the MODELS.md `49.3%` key used to cover is withdrawn too; the key still fires on
 * the game-differential share, so it stays. */
const BASELINE = new Set([
  "docs/ABRA-technical-docs.md|14.757%|data/policy-weights.json",
  "docs/ABRA-technical-docs.md|49.3%|data/policy-weights.json",
  "docs/ABRA-whitepaper.md|14.757%|data/policy-weights.json",
  "docs/ABRA-whitepaper.md|49.3%|data/policy-weights.json",
  "docs/ENGINE.md|1,136,845|data/feature-engine-contrast.json",
  "docs/ENGINE.md|48,274|data/censoring-value.json",
  "docs/ENGINE.md|5,878|data/leaf-position-contrast.json",
  "docs/ENGINE.md|6,055|data/feature-engine-contrast.json",
  "docs/ENGINE.md|6,167|data/leaf-position-contrast.json",
  "docs/ENGINE.md|6,371|data/leaf-position-contrast.json",
  "docs/GAME-DIFFERENTIAL-DESIGN.md|8,855|data/leaf-engine-contrast.json",
  "docs/MEASURE.md|14.757%|data/policy-weights.json",
  "docs/MEASURE.md|8,855|data/leaf-engine-contrast.json",
  "docs/MODELS.md|14.757%|data/policy-weights.json",
  "docs/MODELS.md|49.3%|data/policy-weights.json",
  "docs/OPS.md|1.744%|data/collinearity-joint.json",
  "docs/PRIOR-ART.md|186,494|data/policy-weights.json",
  "docs/ROADMAP.md|0.687%|data/feature-shift.json",
  "docs/ROADMAP.md|0.889%|data/feature-shift.json",
  "docs/ROADMAP.md|28.33%|data/feature-shift.json",
  "docs/ROADMAP.md|51,399|data/feature-shift.json",
  "docs/ROADMAP.md|6779|data/leaf-position-contrast.json",
  "docs/ROADMAP.md|81,515|data/redirect-audit.json",
  "docs/SEARCH.md|1,600|data/exploitability.json",
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

const keys = r.hits.map(DS.quarantineKey);
const fresh = r.hits.filter(h => !BASELINE.has(DS.quarantineKey(h)));
const gone = [...BASELINE].filter(k => !keys.includes(k));

if (r.gate_open) {
  /* THIS BRANCH USED TO PASS UNCONDITIONALLY, AND THAT IS A VACUOUS GREEN — 2026-09-11. The reasoning
   * was that an open gate withholds nothing, so no document can republish a withheld figure. True,
   * and beside the point: CLAUDE.md's own closing rule is that a quarantined number becomes
   * RE-RUNNABLE, not true. The hour the gate opened, docs/MODELS.md was still printing MAG's fitted
   * weight table out of an artifact that carries no engine release id at all, and this clause passed
   * while printing its own reason for seeing nothing. A check that switches itself off at the moment
   * its subject changes is the "known failure" pattern one level up.
   *
   * engine/docs_scan.js now keeps charging a DOWNSTREAM artifact that does not NAME the current
   * release, so the question narrows from "is it withheld" to "was it re-measured", which is the
   * question an open gate actually leaves open. */
  ok(fresh.length === 0,
    'THE GATE IS OPEN, AND NO NEW FIGURE HAS ENTERED A LIVING DOCUMENT FROM AN ARTIFACT THAT WAS NOT '
    + 'RE-MEASURED ON THE CURRENT ENGINE — re-runnable is not true',
    fresh.length
      ? fresh.map(h => h.doc + ':' + h.line + '  ' + h.figure + '  <- ' + h.cite).join('\n         ')
      : r.why);
  if (r.hits.length) console.log('         ' + r.hits.length + ' standing figure(s) of this kind; '
    + gone.length + ' retired since the baseline. They are owed a re-run or a withdrawal.');
} else {
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

  /* ---- THE OPEN-GATE PATH, SHOWN RED AND CONTROLLED — 2026-09-11 ------------------------------
   *
   * The clause above drives the CLOSED gate. The open-gate path is a different rule — "downstream and
   * not re-measured on the current release" — and it needs its own pair, because the day it went in,
   * the real run charged two figures that no artifact contained: `docs/TAGS-MASTER.md`'s Solar Beam
   * usage `4,003` and `docs/MODELS.md`'s sample-size `~4,900`. Both were x100 rescaling: the index
   * holds a, a*100 and a/100, so a stored `40.03` answers for `4,003` and a stored `49` for `4,900`.
   *
   * BOTH ARMS USE REAL ARTIFACTS, so neither can drift away from what the shipping code reads.
   * `data/leaf-engine-contrast.json` literally holds 8883 — that one must stay charged. The control
   * is the half that matters: the SAME paragraph must be charged under the loose bar and cleared
   * under the open gate's same-scale bar, or the fix is indistinguishable from switching the rule
   * off. */
  {
    const heldLEC = (f) => (String(f) === 'data/leaf-engine-contrast.json'
      ? { file: f, because: 'synthetic — open-gate arm', clause: 'synthetic' } : null);
    const TRUE_PARA = 'The tight null sits at n=8,883, cited to `data/leaf-engine-contrast.json`.';
    const redOpen = DS.quarantinedFigures(['synthetic.md'],
      { withhold: { withhold: heldLEC, exactScale: true, open: true }, read: () => TRUE_PARA });
    ok(redOpen.hits.length === 1 && redOpen.hits[0].figure === '8,883',
      'RED (OPEN GATE) — a figure the downstream artifact actually holds is still charged when the '
      + 'gate is open: re-runnable is not true',
      JSON.stringify(redOpen.hits.map(h => h.figure)));

    const heldOR = (f) => (String(f) === 'data/opponent-recall.json'
      ? { file: f, because: 'synthetic — open-gate control', clause: 'synthetic' } : null);
    const SCALE_PARA = 'Solar Beam is clicked 4,003 times, cited to `data/opponent-recall.json`.';
    const loose = DS.quarantinedFigures(['synthetic.md'],
      { withhold: { withhold: heldOR, exactScale: false, open: true }, read: () => SCALE_PARA });
    const strict = DS.quarantinedFigures(['synthetic.md'],
      { withhold: { withhold: heldOR, exactScale: true, open: true }, read: () => SCALE_PARA });
    ok(loose.hits.length === 1 && strict.hits.length === 0,
      'CONTROL — a figure that matches only after x100 rescaling (stored 40.03, published 4,003) is '
      + 'charged by the loose bar and NOT by the open gate\'s same-scale bar, so the strict path is '
      + 'narrower by exactly that coincidence and not by being switched off',
      'loose ' + JSON.stringify(loose.hits.map(h => h.figure))
      + ' / strict ' + JSON.stringify(strict.hits.map(h => h.figure)));
  }

  /* THE QUOTABLE-SOURCE CLEARANCE MUST NOT CLEAR ON A CITATION ALONE (engine/docs_scan.js, 2026-09-10).
   * A figure is cleared only when a NON-withheld artifact in the same paragraph actually CARRIES it.
   * data/regulations.json is config, never withheld, and carries no 51.0. Citing it beside the
   * withheld artifact must leave the figure charged, or citing any harmless file would launder a
   * withheld number. */
  const beside = DS.quarantinedFigures(['synthetic.md'], { withhold: held,
    read: () => PARA.replace('`data/winrate-backtest.json`.',
      '`data/winrate-backtest.json` beside `data/regulations.json`.') });
  ok(beside.hits.length === 1 && beside.hits[0].figure === '51.0%',
    'RED — citing a quotable artifact that does NOT carry the figure clears nothing; the clearance '
    + 'needs the figure to be in that artifact',
    JSON.stringify(beside.hits.map(h => h.figure)));

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
