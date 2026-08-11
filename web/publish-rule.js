/* web/publish-rule.js — MAY THE SITE PUBLISH THIS FIGURE? One answer, for every WEB builder.
 *
 *   const RULE = require('./publish-rule.js');
 *   const decide = RULE.publishRule(gate, rows);   // gate + rows straight out of engine/quarantine.js
 *   decide('data/rollout-r4.json')                 // -> null | {state:'quarantined'} | {state:'rerunnable'}
 *
 * WHY THIS FILE EXISTS — THE GATE OPENED AND THE MECHANISM ONLY HAD TWO STATES
 * ---------------------------------------------------------------------------
 * On 2026-08-11 the MEDICHAM quarantine gate read OPEN for the first time: six of six clauses pass.
 * `engine/quarantine.js`'s `withholder(gate, rows)` is BINARY — gate closed, withhold; gate open,
 * return null — so at that instant every consumer of it flipped 48 artifacts from WITHHELD straight
 * to PUBLISHED. `web/build-status.js` and `web/build-quarantine.js` are two of those consumers.
 *
 * Those 48 artifacts were not re-measured when the gate opened. On the night this was written the six
 * this board reads were between 148 and 190 HOURS old, and `engine/medicham2-browser.js` and
 * `data/tags.json` had been rewritten within the hour. Publishing them would have put six-to-eight-day-
 * old results on the page as current, which is a worse lie than withholding them was.
 *
 * QUARANTINE.JS ALREADY KNOWS THIS AND SAYS SO — IT JUST DOES NOT ENFORCE IT. With the gate open its
 * own report prints, verbatim:
 *
 *   "48 of 181 artifacts are downstream of MEDICHAM and are now RE-RUNNABLE. They are NOT withheld
 *    and they are NOT current — every one was measured under an engine that has since changed, so
 *    each must be re-run before it is quoted (ROADMAP #57)."
 *
 * That sentence is PRINTED, and `withholder()` — the thing every caller actually asks — does not
 * implement it. `engine/status.js` shows exactly what that costs: with the gate open it prints R4's
 * "ACCEPT H1 — arm 1 (MILTANK) beats arm 2 (MAG): 55.5% of 535 decisive pairs" followed by
 * "[engine moved since; transfer assumed, not measured]". A caption. That is the failure CLAUDE.md
 * names by name, arriving through the one door the guard did not cover — not the gate closing, the
 * gate OPENING.
 *
 * SO THE THIRD STATE IS COMPOSED HERE, AND NOTHING ABOUT IT IS AUTHORED
 * --------------------------------------------------------------------
 * WEB may not author a number and it may not author a judgement about one either. Both facts this
 * rule stands on are READ from `engine/quarantine.js` and neither is recomputed:
 *
 *   1. the GATE            — `medichamIsCorrect()`, passed in
 *   2. the DOWNSTREAM SET  — `classify().rows`, passed in; `r.quarantined` is graph topology
 *
 * The composition is the only thing added, and it is the module's own printed sentence turned into a
 * return value:
 *
 *   gate CLOSED + downstream  -> `quarantined`  (delegated to quarantine.withholder, byte for byte)
 *   gate OPEN   + downstream  -> `rerunnable`   (no value; the artifact predates the corrected engine)
 *   not downstream            -> null           (publish)
 *
 * BOTH WITHHELD STATES CARRY NO VALUE, AND THEY ARE NOT THE SAME STATE. A reader who meets a
 * `quarantined` card is told the simulator is wrong and nothing can be trusted through it. A reader
 * who meets a `rerunnable` card is told the simulator is FIXED and this particular number has not
 * caught up yet, and the command in front of them will fix it. Folding them together would lose the
 * difference between "wait" and "run this", which is the whole reason ROADMAP #57 exists.
 *
 * THE EXIT IS NOT MINE AND I HAVE NOT INVENTED ONE — READ THIS BEFORE "FIXING" IT
 * ------------------------------------------------------------------------------
 * `classify().rows[f].quarantined` is a statement about the DEPENDENCY GRAPH: winrate-backtest.json's
 * generator loads the simulator, and it always will. The flag therefore never clears on its own, so
 * under this rule those artifacts stay withheld even after somebody re-runs them. That is a real
 * limitation and it is stated rather than papered over:
 *
 *   **engine/quarantine.js has no exit from RE-RUNNABLE.** Nothing in it records "this artifact was
 *   regenerated under the corrected engine". Giving it one — a `current` flag on the row, computed
 *   off the artifact's own engine-release stamp, or off provenance.js's content comparison, both of
 *   which already exist — belongs to MEASURE. It is not WEB's fact to derive, and deriving a second
 *   opinion about staleness here is precisely CLAUDE.md's FACTS ARE GLOBAL failure.
 *
 * Until that lands the site errs toward withholding, which is the safe direction and is not a resting
 * state: it is ROADMAP #57's re-run list, rendered. `tests/test-web-quarantine.js` proves the lift is
 * real by clearing the rows synthetically — the moment the classifier says an artifact is current,
 * every figure comes back and equals its artifact. The board is not the blocker; the classifier is.
 *
 * THERE IS NO FLAG THAT SILENCES THIS, for the same reason quarantine.js has none: the gate and the
 * rows are ARGUMENTS, visible in the caller. A `--force-publish` would eventually be used.
 */
'use strict';

const QUARANTINE = require('../engine/quarantine.js');

/* quarantine.js's own sentence for the open-gate state, quoted rather than paraphrased so a grep
 * across the terminal and the site finds one wording. ROADMAP #57 is the re-run list it points at. */
const RERUN_CLAUSE =
  'the gate is OPEN and this artifact has not been re-run since. engine/quarantine.js: "downstream of '
  + 'MEDICHAM and now RE-RUNNABLE — NOT withheld and NOT current; every one was measured under an '
  + 'engine that has since changed, so each must be re-run before it is quoted (ROADMAP #57)."';

const HEADLINE = {
  quarantined: 'QUARANTINED — the figure is withheld, not annotated.',
  rerunnable: 'RE-RUN OWED — the figure is not withheld and it is not current.',
};

/** The one question every WEB builder asks about every figure.
 *  @param gate  engine/quarantine.js `medichamIsCorrect()` (or a synthetic one, in a test)
 *  @param rows  engine/quarantine.js `classify().rows` (or a synthetic map, in a test)
 *  @returns fn(file) -> null (publish) | {state, file, because, clause, rerun, headline}
 */
function publishRule(gate, rows) {
  /* THE CLOSED-GATE ANSWER IS NOT REIMPLEMENTED. It is quarantine.js's, called, so the two can never
   * disagree about who is withheld while the gate is shut. */
  const withheldBy = QUARANTINE.withholder(gate, rows);

  const fn = function decide(file) {
    const h = withheldBy(file);
    if (h) return { ...h, state: 'quarantined', headline: HEADLINE.quarantined };
    if (!rows) return null;
    const f = String(file).replace(/^data\//, '');
    const r = rows.get(f);
    /* Not in the graph at all, or in it and not downstream: publish. An artifact the graph cannot see
     * is quarantine.js's UNCLASSIFIED set and it deliberately defaults neither way; a builder that
     * needs the three-valued answer asks `classified` for it, as web/build-quarantine.js does. */
    if (!r || !r.quarantined) return null;
    return {
      state: 'rerunnable',
      file: 'data/' + f,
      because: r.reason || ('downstream of ' + QUARANTINE.SIMULATOR),
      rerun: r.by ? 'node ' + r.by : null,
      clause: RERUN_CLAUSE,
      headline: HEADLINE.rerunnable,
    };
  };
  /* The downstream set, exactly as withholder() exposes it — membership, not a publishing decision. */
  fn.set = withheldBy.set;
  fn.gateOpen = !!(gate && gate.ok);
  return fn;
}

/** Is this slot state one that carries no value? Used by the builders and by the tests, so "withheld"
 *  means one thing in all of them rather than three slightly different things. */
function isHeld(state) { return state === 'quarantined' || state === 'rerunnable'; }

module.exports = { publishRule, isHeld, RERUN_CLAUSE, HEADLINE };
