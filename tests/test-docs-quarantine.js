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
 * IT IS A RATCHET, AND THE HONEST REASON IS THAT THE DEBT IS 104 AND NONE OF IT IS MINE TO FIX.
 * ================================================================================================
 * Measured 2026-09-06 on a closed gate: 104 figures across 14 documents are sourced from an artifact
 * the gate withholds. Every one is a real republication of a withheld number — the MAG weights, the
 * leaf backtest, the censoring census — and correcting them is a documents pass across four
 * divisions' ledgers, not a line in a test.
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

/* ---- THE SEEDED CENSUS — 2026-09-06, gate CLOSED, 72 artifacts withheld. MAY ONLY SHRINK. ----- */
const BASELINE = new Set([
  "docs/ABRA-technical-docs.md|49.3%|data/policy-weights.json",
  "docs/ABRA-technical-docs.md|6000|data/policy-weights.json",
  "docs/ABRA-whitepaper.md|1,336|data/policy-weights.json",
  "docs/ABRA-whitepaper.md|1,851|data/censoring-value.json",
  "docs/ABRA-whitepaper.md|10,009|data/click-censoring-census.json",
  "docs/ABRA-whitepaper.md|241,927|data/policy-weights.json",
  "docs/ABRA-whitepaper.md|25.6%|data/winrate-backtest.json",
  "docs/ABRA-whitepaper.md|48,274|data/censoring-value.json",
  "docs/ABRA-whitepaper.md|49.3%|data/policy-weights.json",
  "docs/ABRA-whitepaper.md|50.48%|data/leaf-engine-contrast.json",
  "docs/ABRA-whitepaper.md|52.48%|data/leaf-engine-contrast.json",
  "docs/ABRA-whitepaper.md|6,000|data/policy-weights.json",
  "docs/ABRA-whitepaper.md|7,994|data/leaf-engine-contrast.json",
  "docs/ABRA-whitepaper.md|8,320|data/leaf-engine-contrast.json",
  "docs/ABRA-whitepaper.md|8,601|data/leaf-engine-contrast.json",
  "docs/ABRA-whitepaper.md|8,883|data/leaf-engine-contrast.json",
  "docs/ABRA-whitepaper.md|8,942|data/policy-weights.json",
  "docs/ENGINE-COVERAGE-PLAN.md|960,000|data/exploit-step-probe.json",
  "docs/ENGINE.md|1,136,845|data/feature-engine-contrast.json",
  "docs/ENGINE.md|1200|data/register-reality.json",
  "docs/ENGINE.md|1596|data/policy-weights.json",
  "docs/ENGINE.md|6,000|data/register-reality.json",
  "docs/ENGINE.md|6,055|data/feature-engine-contrast.json",
  "docs/EXTERNAL-EVIDENCE.md|55.5%|data/rollout-r4.json",
  "docs/GAME-DIFFERENTIAL-DESIGN.md|8,883|data/leaf-engine-contrast.json",
  "docs/MEASURE.md|1,046|data/winrate-backtest.json",
  "docs/MEASURE.md|1,144|data/medicham-speed.json",
  "docs/MEASURE.md|1,270|data/medicham-speed.json",
  "docs/MEASURE.md|186,494|data/policy-weights.json",
  "docs/MEASURE.md|2,500|data/rollout-r1-explore-sweep.json",
  "docs/MEASURE.md|232,815|data/policy-weights.json",
  "docs/MEASURE.md|241,927|data/policy-weights.json",
  "docs/MEASURE.md|46,321|data/policy-weights.json",
  "docs/MEASURE.md|5,248|data/rollout-r4.json",
  "docs/MEASURE.md|50.99%|data/winrate-backtest.json",
  "docs/MEASURE.md|6,886|data/winrate-backtest.json",
  "docs/MEASURE.md|63.2%|data/exploitability.json",
  "docs/MEASURE.md|68.18%|data/rollout-r1-explore-sweep.json",
  "docs/MEASURE.md|69.84%|data/rollout-r1-explore-sweep.json",
  "docs/MEASURE.md|8,942|data/policy-weights.json",
  "docs/MEASURE.md|9,201|data/rollout-r1-explore-sweep.json",
  "docs/MEASURE.md|9,201|data/rollout-r1.json",
  "docs/MILTANK.md|65.72%|data/rollout-r1.json",
  "docs/MILTANK.md|9,201|data/rollout-r1-explore-sweep.json",
  "docs/MODELS.md|1,116|data/policy-weights.json",
  "docs/MODELS.md|1,336|data/policy-weights.json",
  "docs/MODELS.md|1,600|data/exploitability.json",
  "docs/MODELS.md|1.60%|data/policy-weights.json",
  "docs/MODELS.md|10,009|data/click-censoring-census.json",
  "docs/MODELS.md|101,459|data/policy-weights-joint.json",
  "docs/MODELS.md|186,494|data/policy-weights.json",
  "docs/MODELS.md|2.92%|data/policy-weights.json",
  "docs/MODELS.md|23.4%|data/policy-weights.json",
  "docs/MODELS.md|232,815|data/policy-weights.json",
  "docs/MODELS.md|241,927|data/policy-weights.json",
  "docs/MODELS.md|26,232|data/all-mechanics-fire.json",
  "docs/MODELS.md|3,260|data/policy-weights.json",
  "docs/MODELS.md|42.0%|data/policy-weights.json",
  "docs/MODELS.md|44,982|data/sheet-channel-value.json",
  "docs/MODELS.md|46,321|data/policy-weights.json",
  "docs/MODELS.md|49.3%|data/policy-weights.json",
  "docs/MODELS.md|6,937|data/policy-weights.json",
  "docs/MODELS.md|63.2%|data/exploitability.json",
  "docs/MODELS.md|8,883|data/leaf-engine-contrast.json",
  "docs/MODELS.md|8,942|data/policy-weights.json",
  "docs/MODELS.md|95,886|data/policy-weights-joint.json",
  "docs/MODELS.md|99.7%|data/sheet-channel-value.json",
  "docs/PRIORITIES.md|63.2%|data/exploitability.json",
  "docs/ROADMAP.md|0.687%|data/feature-shift.json",
  "docs/ROADMAP.md|0.889%|data/feature-shift.json",
  "docs/ROADMAP.md|1,970|data/million-run.json",
  "docs/ROADMAP.md|12,806|data/medicham-represented-clicks.json",
  "docs/ROADMAP.md|12.5%|data/million-run.json",
  "docs/ROADMAP.md|1200|data/register-reality.json",
  "docs/ROADMAP.md|13.00%|data/million-run.json",
  "docs/ROADMAP.md|2212|data/open-work.json",
  "docs/ROADMAP.md|28.33%|data/feature-shift.json",
  "docs/ROADMAP.md|29.54%|data/million-run.json",
  "docs/ROADMAP.md|298,888|data/medicham-represented-clicks.json",
  "docs/ROADMAP.md|298,910|data/medicham-represented-clicks.json",
  "docs/ROADMAP.md|30.34%|data/million-run-staged.json",
  "docs/ROADMAP.md|30.42%|data/million-run.json",
  "docs/ROADMAP.md|31.90%|data/million-run-staged.json",
  "docs/ROADMAP.md|39.6%|data/register-reality.json",
  "docs/ROADMAP.md|51,399|data/feature-shift.json",
  "docs/ROADMAP.md|6,000|data/register-reality.json",
  "docs/ROADMAP.md|99.9926%|data/medicham-represented-clicks.json",
  "docs/SEARCH.md|1,314|data/winrate-backtest.json",
  "docs/SEARCH.md|1,600|data/exploitability.json",
  "docs/SEARCH.md|5,500|data/policy-weights.json",
  "docs/SEARCH.md|51.0%|data/winrate-backtest.json",
  "docs/SEARCH.md|56.6%|data/exploitability.json",
  "docs/SUMMARY.md|1,336|data/policy-weights.json",
  "docs/SUMMARY.md|23.4%|data/policy-weights.json",
  "docs/SUMMARY.md|232,815|data/policy-weights.json",
  "docs/SUMMARY.md|241,927|data/policy-weights.json",
  "docs/SUMMARY.md|3,260|data/policy-weights.json",
  "docs/SUMMARY.md|32.9%|data/policy-weights.json",
  "docs/SUMMARY.md|8,883|data/leaf-engine-contrast.json",
  "docs/SUMMARY.md|8,942|data/policy-weights.json",
  "docs/WEB.md|134,648|data/winrate-backtest.json",
  "docs/WEB.md|16.9%|data/policy-weights.json",
  "docs/WEB.md|63.2%|data/exploitability.json",
  "docs/WEB.md|84.3%|data/policy-weights.json",
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
