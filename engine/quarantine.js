/* quarantine.js — EVERYTHING DOWNSTREAM OF MEDICHAM IS WITHHELD UNTIL MEDICHAM IS CORRECT.
 *
 *   node engine/quarantine.js            print the gate, the failing clauses and the withheld set
 *   node engine/quarantine.js --graph    print the derivation: why each artifact is in or out
 *   node engine/quarantine.js --check    GATE — fails if a quarantined figure is being printed
 *   node engine/quarantine.js --selftest drive every branch on synthetic input, red and green
 *
 * WHY THIS EXISTS
 * ---------------
 * Will, 2026-08-08: "all engines that take medicham's output should be regarded as out of date and we
 * should stop referencing them until medicham is up to date and we can rerun them."
 *
 * CLAUDE.md states the rule. This file is the mechanism, because this repository's whole history says
 * a rule that exists only in prose is a preference: the fourteen stale handoffs, the hand-maintained
 * ban list of four, the auto-commit paragraph kept twelve days past the thing it described.
 *
 * A CAPTION IS NOT A QUARANTINE, AND THAT IS THE SPECIFIC BUG THIS CLOSES.
 * `status.js` has printed `PRE-CHANGE — measured against a different build of: ...` and
 * `[engine moved since; transfer assumed, not measured]` beside these numbers for days, and the
 * numbers went on being quoted anyway — including to Will, by the session that wrote the caption. It
 * is the identical failure to a red gate reported for two days as "one of the two known failures":
 * the figure is rendered, the warning is skimmed, the figure gets used. So the figure is WITHHELD.
 * Printing it with a caveat IS the bug, and a reader who wants it can run the generator.
 *
 * THE GATE IS READ, NOT REMEMBERED. It lifts on a measured condition and on nothing else. There is
 * deliberately no flag anybody can set by hand: a field that can silence a gate eventually silences
 * it wrongly, which is why `provenance.js`'s `void` is one-way and has no `valid: true` counterpart.
 *
 * A MISSING STAGE IS A FAILING CLAUSE. The deliberate roster has three stages that matter and only
 * one has ever produced an artifact. Absence must never read as success — that is the single failure
 * mode CLAUDE.md says this project actually has ("a capability was absent, and everything reported
 * success"), and reading two-out-of-three as a pass would reproduce it inside the guard written to
 * stop it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };

/* ================================================================================================
 * 1. THE GATE — is MEDICHAM correct?
 * ================================================================================================
 * Two conditions, both read out of artifacts that MEASURE the simulator rather than consume it:
 *
 *   the game differential shows no disagreements with Showdown, and
 *   the deliberate roster shows no FIRED-AND-BOARDS-DIFFER and no DID-NOT-FIRE across the items,
 *   abilities and moves stages.
 *
 * Each clause reports its MAGNITUDE, not a boolean. "false" tells a reader nothing about how far away
 * the lift is, and a gate whose distance cannot be seen is a gate that gets argued with.
 */

/* SWALLOWED READS ARE COUNTED, NOT SILENT. Every `catch` in this file guards a read that is allowed
 * to be absent — an optional directory, an artifact not written yet, a stamp helper that may not
 * exist. A bare `catch (e) {}` is the right CONTROL FLOW and the wrong REPORTING: it is exactly the
 * shape CLAUDE.md opens on, "a capability was absent and everything reported success". So each one
 * records where it fired, and `--check` prints the tally. If this gate ever goes quiet because it
 * could not read the thing it polices, the count says so instead of the gate reading clean.
 * `tests/test-no-silent-failure.js` found all eleven the day they were written. */
const SWALLOWED = [];
const why = e => (e && e.message) || String(e);

/* THE THREE STAGES THAT THE RULE NAMES. `tests/roster.js --stage` also accepts `spine` (its own
 * selftest) and `pairs`; neither is part of the condition, so neither is read here. */
const ROSTER_STAGES = ['items', 'abilities', 'moves'];

/* WHERE A STAGE'S ARTIFACT LIVES, AND WHY THIS TAKES THREE GUESSES RATHER THAN ONE.
 *
 * `tests/roster.js --write` writes `data/roster.json` unconditionally, whatever stage it ran, so the
 * file holds only the NEWEST stage and a second run destroys the first. Reading that one file and
 * calling it three stages would be the "capability absent, everything reports success" failure
 * exactly: two thirds of the condition would be silently satisfied by an artifact that never
 * described them.
 *
 * So a stage is satisfied only by an artifact whose OWN `stage` field names it. Three shapes count,
 * in the order tried:
 *   data/roster.<stage>.json   a per-stage artifact (what a stage-preserving writer would produce)
 *   data/roster.all.json       a `--stage all` run, which covers item, ability and move together
 *   data/roster.json           the shared file, and ONLY when its `stage` field matches
 * Anything else is MISSING, and MISSING FAILS. tests/roster.js is held by another division as this is
 * written, so the per-stage filename is a convention this reader accepts rather than one it imposes. */
function rosterStage(stage) {
  const tried = [];
  for (const f of [`roster.${stage}.json`, 'roster.all.json', 'roster.json']) {
    tried.push('data/' + f);
    const j = readJson(D('data', f));
    if (!j) continue;
    /* AN `all` ARTIFACT SATISFIES THE THREE STAGES THE RULE NAMES, AND NOTHING ELSE. Accepting
     * `stage: 'all'` for ANY requested name made this function answer for a stage that does not
     * exist — so the selftest's own "a MISSING stage must FAIL" probe started matching
     * data/roster.all.json the moment that file first landed, and went red. The probe was right and
     * the reader was wrong: `all` is a claim about items, abilities and moves, not a wildcard. This
     * is the one case the whole file turns on, so it is scoped to ROSTER_STAGES explicitly rather
     * than to "any truthy stage name". */
    if (j.stage !== stage && !(j.stage === 'all' && ROSTER_STAGES.includes(stage))) continue;
    const c = j.counts || {};
    const differ = c['FIRED-AND-BOARDS-DIFFER'] || 0;
    const silent = c['DID-NOT-FIRE'] || 0;
    /* A RED THE ROSTER ITSELF DECLARES BAD counts too. `reds` carries the red demonstrations, each
     * with an `ok` flag; a red that did not behave as the rule predicted means the rule is not proven,
     * so the stage's greens are not evidence either. */
    const badReds = (j.reds || []).filter(r => r && r.ok === false).length;
    /* THE CLOSET DOES NOT HOLD THE GATE — BUT A STALE SHELF DOES. An entity the owner deferred by
     * name (tests/roster.js DEFERRED) is still staged and still played; it is simply not counted as a
     * failure. What IS counted is a deferral whose row would now pass on its own: that shelf has
     * quietly become a false claim, and the roster marks it `would_pass_now`. Same discipline as the
     * DECLARED staleness check, which once retracted its own author's declaration. */
    const deferred = (j.results || []).filter(r => r && r.verdict === 'DEFERRED-BY-OWNER');
    const staleShelf = deferred.filter(r => r.would_pass_now).length;
    /* ---- THE DENOMINATOR, AND THE ROWS THAT COUNT IN NEITHER COLUMN (ROADMAP #120, #121) --------
     *
     * THIS CLAUSE SAID "clean: 84 fired and matched" AND PASSED. It did not say of how many, and 84
     * of 316 is 26.6% while 84 of the 201 rows that HAVE a legal carrier in this format is 42%. It
     * also said nothing at all about fifteen CONTROL-NOT-QUIET rows sitting inside that green — rows
     * where the control arm was ANOTHER LIVE ABILITY, so the measurement is (subject minus a live
     * control) and names neither of them. Those are UNMEASURED, not passing.
     *
     * A bare PASS is the same failure this file was built to stop one level up: `status.js` printed
     * `PRE-CHANGE` beside a figure for days and the figure went on being quoted. A caption is not a
     * quarantine, and a verdict with no denominator is not a result.
     *
     * THE NUMBERS ARE READ OFF THE ARTIFACT'S OWN `scope` BLOCK, written by tests/roster.js at the
     * refusal, never re-derived here by matching prose. An artifact predating that block says
     * DENOMINATOR NOT CARRIED rather than defaulting to zero — a missing count must not read as
     * "none", which is the whole shape of the bug above.
     *
     * WHY UNATTRIBUTABLE ROWS ARE REPORTED AND DO NOT HOLD THE GATE. Four of them (Aroma Veil, Flower
     * Veil, Fluffy, Imposter) are untestable in this format by construction: their only legal carriers
     * have exactly one alternative ability, that alternative is live, and this format has 8 quiet
     * abilities of which none shares a species with them. A clause that can never open is not a gate.
     * They are named in the text on every run instead, so nobody has to go and look. If Will wants
     * them to fail, the flag is one `&&` on the line below. */
    const sc = j.scope || null;
    /* A ZERO IS A RESULT AND `|| null` EATS IT. An artifact that carries `results` can be counted
     * whatever its scope block says; only an artifact with no rows at all cannot answer. */
    const unattributable = sc ? sc.unattributable
      : (Array.isArray(j.results)
          ? j.results.filter(r => r && r.verdict === 'CONTROL-NOT-QUIET').length : null);
    /* WHAT IS NOT IN THE REGULATION IS NOT A DENOMINATOR. Will, 2026-08-11, reading this line on his
     * phone: *"Can we remove all the irrelevant numbers then and just have a quarantined closet
     * section. Like not legal in the regulation should be gone"*.
     *
     * This used to print `94 TESTED of 202 IN SCOPE, of 316 total (114 have NO LEGAL CARRIER in this
     * format — a fact about the regulation)`. The 316 and the 114 describe the National Dex, not the
     * game we play. Printing them next to the real ratio invites exactly the reading CLAUDE.md spends
     * a section forbidding — a number that looks authoritative because it sits beside one that is.
     * An entity no legal body can carry is not untested coverage; it does not exist here.
     *
     * The out-of-scope count is still CARRIED in the returned object (`scope`), so nothing that wants
     * it has lost it — it is dropped from the SENTENCE, not from the artifact. The deliberate
     * deferrals keep their own clause because those ARE in the regulation and someone chose to
     * shelve them, which is a different fact and belongs in the closet. */
    const denom = sc
      ? `${sc.tested} of ${sc.in_scope} tested`
      : `DENOMINATOR NOT CARRIED by ${'data/' + f} — it predates the scope block; re-run `
        + `tests/roster.js --stage ${stage} --write`;
    const unattrib = unattributable === null
      ? '. UNATTRIBUTABLE ROWS NOT COUNTED — this artifact carries no rows to count'
      : unattributable === 0 ? ''
      : `. ${unattributable} row(s) count in NEITHER column — the control arm is itself a live ability`
        + (sc && sc.unattributable_ids ? `: ${sc.unattributable_ids.join(', ')}` : '');
    return {
      stage, file: 'data/' + f, generated: j.generated || null, release: j.engine_release || null,
      differ, silent, badReds, matched: c['FIRED-AND-BOARDS-MATCH'] || 0,
      couldNotStage: c['COULD-NOT-STAGE'] || 0,
      deferred: deferred.length, staleShelf, scope: sc, unattributable,
      ok: differ === 0 && silent === 0 && badReds === 0 && staleShelf === 0,
      /* THE DEFERRAL COUNT MOVED TO THE CLOSET SECTION and is deliberately not repeated here — it
       * was printing in both places once the closet existed, and a number shown twice is a number
       * a reader has to reconcile. The count is still on the returned object for anything that
       * wants it programmatically. */
      why: (differ === 0 && silent === 0 && badReds === 0 && staleShelf === 0
        ? `clean: ${denom}`
        : `${differ} FIRED-AND-BOARDS-DIFFER, ${silent} DID-NOT-FIRE — ${denom}`
          + (badReds ? `, ${badReds} red demonstration(s) did not behave as their rule predicted` : '')
          + (staleShelf ? `, ${staleShelf} DEFERRAL(S) NOW PASS ON THEIR OWN — take the shelf down` : ''))
        + unattrib,
    };
  }
  return {
    stage, file: null, ok: false, missing: true, differ: null, silent: null,
    why: `NO ARTIFACT FOR THIS STAGE — none of ${tried.join(', ')} declares stage "${stage}". `
       + `A missing stage is a FAILING clause, never a passing one: run `
       + `SHOWDOWN_PATH=... node tests/roster.js --stage ${stage} --write`,
  };
}

/* `artifact` IS AN INJECTION POINT FOR THE SELFTEST AND NOTHING ELSE. The roster clause's selftest
 * reimplements its rule in three lines and therefore proves nothing about the rule that ships; this
 * one drives THE SHIPPING FUNCTION on synthetic artifacts. Absent, it reads the real file exactly as
 * before. */
function differentialClause(artifact) {
  const j = artifact === undefined ? readJson(D('data', 'engine-diff.json')) : artifact;
  if (!j) {
    return { name: 'game differential', ok: false, missing: true,
             why: 'NO ARTIFACT — data/engine-diff.json is absent. Run tests/test-engine-diff.js.' };
  }
  const dis = j.disagreed || 0;
  const worst = (j.worst || [])[0];
  /* ---- ROADMAP #88 — THE CLAUSE ASKS BOTH CORNERS, NOT ONE AVERAGED NUMBER ---------------------
   *
   * `disagreed` above is a MIDPOINT residual: the instrument averages Showdown's two endpoints, averages
   * MEDICHAM's, and compares those. A range that is wrong by the SAME AMOUNT AT BOTH ENDS has an
   * identical midpoint and cannot move it — demonstrated in the instrument itself by `--plant spread`,
   * which reads 0 on the midpoint and 196/218 of 300 on the corners. So "0 of 6000" was a weaker claim
   * than it read, and this gate was resting on it.
   *
   * IT HAD ALREADY HIDDEN ONE. CHANGELOG 3.75.0: the rolled crit sat in the wrong position in the
   * damage formula — 46.5% of rows wrong at the bottom roll, invisible at the top — while every check
   * in the repository stayed green.
   *
   * AN ARTIFACT WITH NO `arms` FAILS, and that is deliberate rather than lenient. A clause that cannot
   * be computed must fail (the same rule `coverageClause` states); reading a missing arm as "nothing
   * disagreed" is exactly the silent default this file exists to stop. A PLANTED run fails too — a red
   * demonstration is not a measurement, and the instrument already refuses to write it here. */
  if (j.plant) {
    return { name: 'game differential', ok: false, generated: j.generated || null,
      why: `THIS ARTIFACT IS A PLANTED RED DEMONSTRATION (--plant ${j.plant.kind}) and is not a `
         + 'measurement. Re-run tests/test-engine-diff.js without --plant.' };
  }
  const arms = Array.isArray(j.arms) ? j.arms : null;
  if (!arms || !arms.length) {
    return { name: 'game differential', ok: false, generated: j.generated || null,
      why: 'THE CORNER ARMS ARE ABSENT from data/engine-diff.json. `disagreed` is a MIDPOINT residual '
         + 'and cannot see a range wrong by the same amount at both ends, so it is not a sufficient '
         + 'claim on its own. Re-run: SHOWDOWN_PATH=... node tests/test-engine-diff.js --n 6000 '
         + '--seed 20260804' };
  }
  const badArms = arms.filter(a => (a.disagreed || 0) > 0);
  const ok = dis === 0 && badArms.length === 0;
  const armTxt = arms.map(a => `${a.arm} ${a.disagreed || 0}/${a.compared}`).join(', ');
  return {
    name: 'game differential', ok, generated: j.generated || null,
    arms: arms.map(a => ({ arm: a.arm, compared: a.compared, disagreed: a.disagreed || 0 })),
    why: ok
      ? `clean at BOTH corners of the damage roll: midpoint 0 of ${j.compared}, ${armTxt} (seed ${j.seed})`
      : (dis > 0
          ? `${dis} of ${j.compared} comparisons disagree with Showdown at the MIDPOINT`
            + (worst ? ` — worst: ${worst.att} ${worst.mv} -> ${worst.def} (showdown ${worst.showdown}, medicham ${worst.medicham})` : '')
          : `the midpoint is clean and a CORNER IS NOT — ${armTxt}`)
        + (badArms.length
            ? '. ' + badArms.map(a => {
                const w = (a.worst || [])[0];
                return `${a.arm}: ${a.disagreed} of ${a.compared}`
                     + (w ? ` — worst ${w.att} ${w.mv} -> ${w.def} (showdown ${w.showdown}, medicham ${w.medicham})` : '');
              }).join('; ')
            : ''),
  };
}

/* ---- COVERAGE: A USED MECHANIC THAT NO INSTRUMENT MEASURES IS A FAILING CLAUSE ------------------
 *
 * Will, 2026-08-10, on the things the gate was ignoring: *"those things need to block the gate man
 * (except for the under 25 clicks)"*. He is right, and the reason is the one this whole file exists
 * for: a gate that passes while we KNOW something is unmeasured is a preference, not a bar.
 *
 * THE FIRST VERSION OF THIS CLAUSE WAS WRONG AND WAS PRICED BEFORE IT WAS WIRED. The obvious rule —
 * "COULD-NOT-STAGE stops being a free pass" — fails 42 moves above the shelf including Rage Powder
 * (9,626 clicks), Wide Guard (6,615) and Follow Me (4,005). Every one of those IS measured, by the
 * mechanics census, which probes the TAG. COULD-NOT-STAGE is a statement about one harness's fixture,
 * not about the mechanic, and a clause built on it would have cried wolf on the busiest moves in the
 * format on its first run.
 *
 * SO THE CLAUSE ASKS THE ONLY QUESTION THAT MATTERS: does ANY instrument measure this?
 *   - the deliberate roster STAGED it (a FIRED-AND-BOARDS verdict), or
 *   - the census probes EVERY tag it carries, so no aspect of it is unexercised
 * Untagged is covered by nothing, and that is the honest verdict rather than a pass — an entity the
 * tagger never described cannot be tested by anything downstream of the tagger.
 *
 * EVERY tag, not "some tag". A move carrying `priority, noExtraHit` whose `priority` is probed is not
 * covered: the probed half says nothing about the unprobed one. "Some tag probed" would mark every
 * priority move green and is the kind of bar that looks like a gate and is a formality.
 *
 * THE USAGE SHELF APPLIES, at Will's explicit exception. Below 25 real clicks in the store a row is
 * shelved rather than failing — the same threshold, from the same artifact, as the roster's own shelf,
 * so the two can never drift apart. `engine/click_counts.js` is the authority; `tags.json.uses`
 * undercounts by up to 8.6x and must not be used here.
 *
 * MEASURED THE DAY IT WAS WIRED: 410 moves above the shelf, 402 covered, 8 covered by nothing, across
 * four distinct unprobed tags. 2,022 clicks of 1,004,407. A clause that fails on 0.2% of clicks and
 * names four tags is actionable; one that fails on 42 rows including the top three is noise. */
function coverageClause() {
  const clicks = readJson(D('data', 'click-counts.json'));
  const census = readJson(D('data', 'mechanics-census.json'));
  const tags = readJson(D('data', 'tags.json'));
  const missing = [];
  if (!clicks) missing.push('data/click-counts.json (run engine/click_counts.js)');
  if (!census) missing.push('data/mechanics-census.json');
  if (!tags) missing.push('data/tags.json');
  if (missing.length) {
    return { name: 'coverage / every used mechanic is measured by something', ok: false, missing: true,
      why: `CANNOT ANSWER — absent: ${missing.join(', ')}. A clause that cannot be computed FAILS; `
         + 'reading it as "nothing is uncovered" is the shape of bug this gate exists to stop.' };
  }
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const live = new Set((census.results || []).filter(r => r && r.live !== false).map(r => norm(r.tag)));
  const rm = readJson(D('data', 'roster.moves.json'));
  const rows = (rm && (rm.rows || rm.results || rm.entries)) || [];
  const measured = new Set(rows.filter(r => /FIRED-AND-BOARDS/.test(r.verdict || '')).map(r => norm(r.id || r.name)));
  const shelved = new Set(rows.filter(r => r.verdict === 'DEFERRED-BY-OWNER').map(r => norm(r.id || r.name)));

  const SHELF = 25;
  let above = 0;
  const uncovered = [];
  for (const [mv, n] of Object.entries(clicks.moves || {})) {
    if (n < SHELF) continue;
    above++;
    const mid = norm(mv);
    if (measured.has(mid) || shelved.has(mid)) continue;
    const t = ((tags.moves || {})[mid] || {}).tags || [];
    const untagged = !t.length || t.includes('untagged');
    const unprobed = untagged ? [] : t.filter(x => !live.has(norm(x)));
    if (!untagged && !unprobed.length) continue;
    uncovered.push({ move: mid, clicks: n, why: untagged ? 'UNTAGGED — nothing describes it' : 'tag(s) never probed: ' + unprobed.join(', ') });
  }
  uncovered.sort((a, b) => b.clicks - a.clicks);
  const lost = uncovered.reduce((s, u) => s + u.clicks, 0);
  const tagsAtFault = [...new Set(uncovered.flatMap(u => (u.why.match(/probed: (.*)$/) || [, ''])[1].split(', ').filter(Boolean)))];
  return {
    name: 'coverage / every used mechanic is measured by something',
    ok: uncovered.length === 0, uncovered, above_shelf: above,
    why: uncovered.length === 0
      ? `clean: all ${above} moves above ${SHELF} clicks are measured by the roster or the census`
      : `${uncovered.length} of ${above} moves above ${SHELF} clicks are measured by NOTHING `
        + `(${lost.toLocaleString()} clicks) — ${tagsAtFault.length} tag(s) at fault: ${tagsAtFault.join(', ')}. `
        + `Worst: ${uncovered.slice(0, 4).map(u => u.move + ' (' + u.clicks + ')').join(', ')}`,
  };
}

/* ---- NO OPEN, KNOWN, UNFIXED ENGINE DEFECT ------------------------------------------------------
 *
 * Will, 2026-08-10, on seeing the gate OPEN beside the register: *"THE GATE SHOULDNT BE OPEN, SO MANY
 * OF THESE ITEMS ARE DISQUALIFYING FOR THE ENGINE TO WORK."* He is right and the GATE was wrong, not
 * the items.
 *
 * WHAT THE OTHER FIVE CLAUSES ACTUALLY ASK. The differential asks whether Showdown disagreed about
 * what the bots HAPPENED TO CLICK. The three roster clauses ask whether OUR TWO ENGINES agree. The
 * coverage clause asks whether SOMETHING measured it. **Not one of them asks whether we already KNOW
 * a mechanic is broken.**
 *
 * And we do know. The roadmap is precisely that register, and on the day this clause was written it
 * held 22 open rows describing a live engine defect — Struggle unimplemented, PP absent, 32 moves
 * resolving to a whole no-op turn, the Choice lock not arming on a status move at 7,844 uses, Quick
 * Guard the only priority refusal that does not work, thirteen moves never recording `_lastMove` so
 * Encore cannot reach most of what it should. Any one of those is disqualifying, and the gate said
 * OPEN over all of them.
 *
 * THIS IS THE "KNOWN FAILURE IS A BANNED PHRASE" RULE, ONE LEVEL UP. That rule stops a RED TEST being
 * filed as a status. This stops a KNOWN DEFECT being filed as a roadmap row while the gate reports the
 * engine correct. Same failure, different register — and the fix is the same one the file already
 * applies everywhere else: the gate is READ, not remembered.
 *
 * HOW A ROW IS CLASSIFIED. It counts if the roadmap files it to `docs/ENGINE.md`, or if its own text
 * says the engine does not do something — "NEVER FIRED", "NOT IMPLEMENTED", "DOES NOT WORK", "IS
 * ABSENT", "no-op", "never records". Matched on the row's own words rather than a hand list of numbers,
 * so an item added tomorrow is counted without editing this file, and a row that is CLOSED says so in
 * its own text and drops out. That cuts both ways deliberately: it means a row cannot be quietly
 * excluded, and it means a stale row keeps the gate shut until somebody marks it done — which is the
 * correct direction for a bar to err.
 *
 * IT IS NOT A USAGE THRESHOLD. A defect is a defect; the shelf that exists for the roster is about
 * which rows are worth STAGING, not about which broken mechanics are acceptable. Usage is reported so
 * the queue can be ordered, and it does not excuse anything. */
/* THE TWO PREDICATES BELOW WERE INLINE IN THE CLAUSE, AND THAT IS WHY NOBODY COULD ASK THE REGISTER A
 * QUESTION. This gate answers exactly one: "is there an open row that ASSERTS BREAKAGE?" — narrow on
 * purpose, because an over-firing gate is the one people learn to ignore (#148). Correct, and it is
 * NOT a work list: #80, #84, #59 and #60 are all open and none of them trips `saysBroken`.
 *
 * On 2026-08-11 I read a hand-typed list of ~30 open defects to Will while this gate sat GREEN two
 * lines away. Eight of the rows I named had been closed for days; four had never had a register row at
 * all. Will: *"i feel like we already talked about and fixed most of these."* He was right, and it was
 * the SECOND time in one hour I had quoted a stale list — the first was the interaction matrix.
 *
 * The cause was structural, not carelessness: **nothing in this repo printed the open work.** The gate
 * printed a verdict, so the only list that existed was one somebody typed. `engine/open_work.js`
 * prints it now, and it imports these two so the work list and the gate can never disagree about
 * whether a row is closed. */
function roadmapRowIsClosed(l) {
  /* the row's STATUS CELL first — see #148's prescription below — then the prose scan, kept because
   * a row that says it is done in its title and forgets the cell should still drop out. */
  if (/\|\s*(closed|done|page closed)\b[^|]*\|\s*$/i.test(l)) return true;
  return /—\s*DONE|DONE,|RETRACTED|closed 20\d\d|GUARDED,/.test(l.slice(0, 600));
}
/* THE BREAKAGE CLAIM IS DECLARED IN THE STATUS CELL FIRST, AND ONLY THEN GUESSED FROM PROSE.
 *
 * #148's own words, quoted in the block below: *"a defect register whose enforcement depends on word
 * choice is a structural weakness"*. That lesson was cashed in for the CLOSED half — `roadmapRowIsClosed`
 * reads the status cell above — and the BROKEN half was left on a vocabulary list. It cost immediately.
 *
 * MEASURED 2026-08-11, before this was wired: ten engine defects were registered off `test-tag-wire`'s
 * own assertions and the clause matched ZERO of them, because the assertions say "does not save",
 * "lands on a Grass type", "hits your own partner", "punishes nobody", "charges a survivor nothing"
 * and "still clickable on turn two". Every one is a mechanic behaving wrongly in a real game. None is
 * in the list. The gate read `clean: the roadmap registers no open row describing a live engine defect`
 * with Focus Sash failing to save at 1 HP sitting in the register two screens above it.
 *
 * So a row now SAYS it is a defect: the token `DEFECT` in its status cell. That cannot drift with
 * phrasing, it is visible to a human reading the table, and it is the same shape as the fix above.
 *
 * THE PROSE SCAN IS KEPT, NOT REPLACED. Every row already carrying the old vocabulary keeps counting
 * with no edit, and a row whose author states breakage plainly in the title but forgets the cell still
 * holds the gate shut. Removing a working clause in the same pass as adding one is how a fix eats a
 * guard — the file says so about `roadmapRowIsClosed` and it is no less true here.
 *
 * IT STILL ERRS SHUT. A row that might be a wrong FIXTURE rather than a wrong ENGINE is marked anyway;
 * the gate reopens when somebody states plainly which it was, which is the correct direction. */
function roadmapRowStatusCell(l) {
  const m = l.match(/\|\s*([^|]*)\|\s*$/);
  return m ? m[1] : '';
}
function roadmapRowSaysBroken(l) {
  if (/\bDEFECT\b/.test(roadmapRowStatusCell(l))) return true;
  return /NEVER FIRED|NEVER FIRES|NOT IMPLEMENTED|DOES NOT WORK|DOES NOT ARM|DOES NOT FIRE|UNIMPLEMENTED|silent no-op|IS ABSENT|is not implemented|does not exist|never records|never record|resolve[sd]? to `\{kind:'pass'\}`|HAS NEVER FIRED|IS DEAD/i.test(l);
}

function openDefectClause() {
  let lines;
  try { lines = fs.readFileSync(D('docs', 'ROADMAP.md'), 'utf8').split(/\r?\n/); }
  catch (e) {
    return { name: 'no open, known engine defect', ok: false, missing: true,
      why: 'CANNOT ANSWER — docs/ROADMAP.md is unreadable. A clause that cannot be computed FAILS.' };
  }
  const open = [];
  for (const l of lines) {
    const m = l.match(/^\|\s*#(\d+)\s*\|\s*\*\*(.{0,140})/);
    if (!m) continue;
    /* THE STATUS IS READ FROM THE STATUS COLUMN, AND THAT IS #148'S OWN PRESCRIPTION CASHED IN.
     *
     * The first version scanned the first 600 characters of PROSE for `— DONE`, `closed 20\d\d` and
     * friends, case-sensitively. #148 records what that costs, in its own words: *"a defect register
     * whose enforcement depends on word choice is a structural weakness"*. It cost twice on 2026-08-11
     * in one pass:
     *   - four rows CLOSED that day, each headed `— CLOSED 2026-08-11` in capitals, went on counting,
     *     because the pattern had no `/i` and `closed` is lower case in it;
     *   - **#148 counted ITSELF**, because it QUOTES the breakage vocabulary (`IS ABSENT`,
     *     `IS NOT IMPLEMENTED`) while explaining the detector. A row about the detector tripping the
     *     detector is the clearest possible statement that prose-matching is the wrong instrument.
     *
     * So the row's STATUS CELL — the last cell of the table row, which is where this register has
     * always recorded status — is consulted first, and it must BEGIN with a closed word. That is not a
     * loosening: measured over all 119 rows before it was wired (LESSONS §4, print what it matches),
     * the cell clause newly clears **16** rows and every one of them is stamped `closed 20xx-xx-xx`,
     * `DONE 2026-08-10` or `page closed 2026-08-10` in that cell. It clears NOTHING whose cell reads
     * `open — …`, `in progress`, `scoping`, `queued behind 42` or prose.
     *
     * `PART DONE` IS DELIBERATELY NOT ACCEPTED. Partly done is open, and a gate that reads it as closed
     * is the "known failure" filing this clause exists to stop.
     *
     * The prose scan is KEPT as well, not replaced: a row that says it is done in its title and forgets
     * the cell should still drop out, and removing a working clause in the same pass as adding one is
     * how a fix eats a guard. */
    if (roadmapRowIsClosed(l)) continue;   /* both clauses, extracted above and shared with open_work.js */
    /* THE ROW MUST ASSERT BREAKAGE, NOT MERELY BE FILED TO ENGINE.
     *
     * The first version also counted any row filed to `docs/ENGINE.md`, and that was too loose: it
     * held the gate shut on "hand MEDICHAM to Fable 5 and make it faster" and on a cost measurement
     * that had already been taken. Sixteen rows, of which four were not defects and three were
     * finished the same night.
     *
     * AN OVER-FIRING GATE IS THE ONE PEOPLE LEARN TO IGNORE, which is the failure this file exists to
     * prevent — "one of the two known failures" begins with a bar that cried wolf. So the test is now
     * the row's own CLAIM: it counts when it says a mechanic does not work, is absent, is
     * unimplemented, never fires, or resolves to nothing. A task, an investigation or a measurement is
     * not a defect however it is filed.
     *
     * It still errs shut rather than open: a row whose wording is ambiguous keeps the gate closed until
     * somebody states plainly whether the thing is broken, which is the correct direction. */
    if (!roadmapRowSaysBroken(l)) continue;   /* extracted above and shared with open_work.js */
    const uses = +((l.match(/([\d,]{3,})\s*(uses|clicks)/) || [, '0'])[1].replace(/,/g, '')) || 0;
    open.push({ n: +m[1], uses, title: m[2].replace(/\s+/g, ' ').slice(0, 84) });
  }
  open.sort((a, b) => b.uses - a.uses);
  const weight = open.reduce((s, r) => s + r.uses, 0);
  return {
    name: 'no open, known engine defect', ok: open.length === 0, open,
    why: open.length === 0
      ? 'clean: the roadmap registers no open row describing a live engine defect'
      : `${open.length} OPEN roadmap row(s) describe a live engine defect (${weight.toLocaleString()} `
        + `named uses between them). A gate cannot report the engine correct while the register says `
        + `otherwise — that is "known failure" filed one level up. Worst: `
        + open.slice(0, 5).map(r => '#' + r.n + (r.uses ? ' (' + r.uses.toLocaleString() + ')' : '')).join(', '),
  };
}

function medichamIsCorrect() {
  const clauses = [differentialClause(), ...ROSTER_STAGES.map(s => {
    const r = rosterStage(s);
    return { ...r, name: `deliberate roster / ${s}` };
  }), coverageClause(), openDefectClause()];
  return { ok: clauses.every(c => c.ok), clauses, failing: clauses.filter(c => !c.ok) };
}

/* ================================================================================================
 * 2. THE MEMBERSHIP TEST — what is downstream of MEDICHAM
 * ================================================================================================
 * DERIVED FROM ONE ROOT, not from a list of filenames. A hand-maintained list of quarantined
 * artifacts would be the hand-maintained-ban-list failure this project's instructions open with, and
 * it would rot the first time somebody adds a model.
 *
 * THE PLAY LAYER is the transitive closure of "requires the simulator", seeded with the single file
 * `engine/medicham2-browser.js`. board.js reaches it through damageEngine(); rollout_leaf, miltank,
 * fit_policy, mag_bot and the rest reach it through board. 63 modules fall out of one root, and a
 * module added tomorrow joins by existing.
 *
 * AN ARTIFACT IS QUARANTINED if its generator is in the play layer, or if it reads a file that a
 * play-layer module wrote, or if it reads another quarantined artifact. The second clause is what
 * catches `data/rollout-r1.json` and `data/rollout-r4.json`, whose generators require nothing at all
 * and simply read a row dump or a self-play store that the play layer produced. A number computed off
 * a dump of MEDICHAM's games is a number MEDICHAM produced, however few modules the reader imports.
 *
 * WHAT IS DELIBERATELY *NOT* QUARANTINED, AND WHY THE STRICT DIRECTION IS THE DANGEROUS ONE.
 * The census, the interaction matrix, the game differential, the deliberate roster and the release
 * ladder MEASURE MEDICHAM. They are the instruments that will say when the quarantine can lift, so
 * withholding them would blind the project to its own exit condition — a quarantine that can never
 * lift is as broken as one that never engages. Most of them fall out on their own: they are written
 * by `tests/` or they drive the official engine through a subprocess or a frozen release, so they
 * never enter the closure. ONE does not, and it is declared below with its reason.
 */

const SIMULATOR = 'engine/medicham2-browser.js';

/* THE ONE THING THE GRAPH CANNOT EXPRESS, DECLARED WITH ITS REASON — the RAW-STORE-OK convention.
 *
 * MEASURED, not assumed: `engine/game_differential.js` and `engine/backtest_winrate.js` have the same
 * graph signature. Both load the simulator, both load Showdown, both play games. The only difference
 * is which QUESTION the artifact answers — the differential's number is "how often do the two engines
 * disagree", which is a measurement OF medicham and is exactly what the gate above reads; the
 * backtest's number is "how good is the leaf", which is a measurement THROUGH medicham. That
 * distinction is not present in either file's source, so no derivation can find it and a declaration
 * is the honest instrument.
 *
 * It is CHECKED rather than trusted: an exemption naming a module that is not in the play layer is a
 * claim that has quietly become false, and `--check` fails on it. That is the same discipline
 * tests/roster.js applies to its own DECLARED divergences ("a declared divergence that matched
 * nothing is a claim that has quietly become false"). */
const MEASURES_THE_ENGINE = [
  { module: 'engine/game_differential.js',
    why: 'MEDICHAM is its SUBJECT, not its input: it drives the official Showdown engine and ours '
       + 'over identical inputs and reports the disagreements. Its value does not depend on MEDICHAM '
       + 'being right — it is how we find out. It is the first clause of the gate above.' },
  { module: 'engine/derive_protocol_events.js',
    why: 'it loads the simulator only to read the event list it CLAIMS it can emit, and checks that '
       + 'claim against Showdown\'s own add() call sites. The artifact is the comparison, not a '
       + 'quantity MEDICHAM computed — and quarantining it would have withheld the game differential '
       + 'downstream of it, which is the gate\'s own first clause.' },
];

function stripComments(s) {
  /* A NAME DISCUSSED IN PROSE IS NOT A DEPENDENCY. provenance.js records the same lesson twice (a
   * comment credited this very file with generating pokemon-roles.json; a comment one file away
   * picked the corpus for winrate-backtest.json). A require inside a comment block is a citation. */
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

function sources() {
  const src = {};
  for (const dir of ['engine', 'build']) {
    let list = []; try { list = fs.readdirSync(D(dir)); } catch (e) { continue; }
    for (const f of list) {
      if (!/\.js$/.test(f)) continue;
      try { src[dir + '/' + f] = fs.readFileSync(D(dir, f), 'utf8'); } catch (e) { SWALLOWED.push('readSource ' + dir + '/' + f + ': ' + why(e)); }
    }
  }
  return src;
}

/* Local module dependencies, in the three spellings this repository actually uses:
 *   require('./board.js')                      the ordinary one
 *   REL.require('engine/board.js')             the frozen-release loader — a real dependency that
 *                                              names the path from the repo root rather than relatively
 *   require(D('engine','board.js'))            occasionally, through the path helper
 * A module reached only by execFileSync is NOT a require: a subprocess is a separate process with its
 * own release, which is precisely how wire_ladder.js orchestrates the differential without inheriting
 * its engine. */
function requiresOf(src, id) {
  const code = stripComments(src[id] || '');
  const out = new Set();
  for (const m of code.matchAll(/require\(\s*['"]\.\/([A-Za-z0-9_.-]+?)(?:\.js)?['"]/g)) out.add('engine/' + m[1] + '.js');
  for (const m of code.matchAll(/\.require\(\s*['"](engine\/[A-Za-z0-9_.-]+\.js)['"]/g)) out.add(m[1]);
  for (const m of code.matchAll(/require\(\s*D\(\s*['"]engine['"]\s*,\s*['"]([A-Za-z0-9_.-]+\.js)['"]/g)) out.add('engine/' + m[1]);
  return [...out].filter(x => src[x]);
}

function playLayer(src) {
  const play = new Set([SIMULATOR]);
  for (let i = 0; i < 32; i++) {
    let grew = false;
    for (const id of Object.keys(src)) {
      if (play.has(id)) continue;
      if (requiresOf(src, id).some(r => play.has(r))) { play.add(id); grew = true; }
    }
    if (!grew) break;
  }
  return play;
}

/* Files a play-layer module WRITES that are not artifacts in the graph — row dumps and self-play game
 * stores. These are MEDICHAM's output in the most literal sense, and a generator that reads one is
 * reporting on games MEDICHAM played. */
function playProducts(src, play) {
  const out = new Set();
  const WRITE = /writeFileSync|createWriteStream|appendFileSync/;
  for (const id of play) {
    for (const ln of stripComments(src[id] || '').split('\n')) {
      if (!WRITE.test(ln)) continue;
      for (const m of ln.matchAll(/['"]([A-Za-z0-9_.\-]+\.jsonl)['"]/g)) out.add(m[1]);
    }
  }
  /* AND EVERY ROW DUMP AND SELF-PLAY STORE ON DISK, because the literal filename is usually not in the
   * writer at all. `rollout_r1.js` resolves its dump from a `DUMP` environment variable and `mew.js`
   * takes its output store as an argument, so scanning writers for string literals finds neither —
   * and those two are exactly the runs behind R1 and R4, the gates whose generators require nothing
   * and simply read what a previous run left behind.
   *
   * THE STORE IS UPSTREAM OF THE SIMULATOR, NOT DOWNSTREAM, and that is the boundary that must not be
   * got wrong in the strict direction. `games.ladder.jsonl`, `games.bo3.jsonl` and `games.ots.jsonl`
   * are HUMAN replays that OPS ingests; nothing MEDICHAM does can change a byte of them, so everything
   * OPS reports out of them — usable %, battles recorded, meta-usage — stays quotable while the gate
   * is closed. They are identified by their INGEST WRITER rather than by name, so a store added by a
   * new collector is exempt for the right reason instead of by spelling. Everything else under data/
   * with a .jsonl extension is something one of our own runs produced. */
  const ingested = new Set();
  /* WHO COLLECTS IS THE AUTHORITY ON WHAT IS COLLECTED. The hourly Action is what actually pulls
   * replays into this repository, so the stores it names are the ones nothing of ours produced.
   * `engine/durable-ingest.js` names none of them — it takes the path as an argument — which is why
   * reading the ingest SCRIPTS alone left `games.bo3.jsonl` classed as one of our own runs and
   * quarantined every OPS figure counted off it. */
  const collectors = ['.github/workflows/ingest.yml'];
  for (const f of fs.existsSync(D('engine')) ? fs.readdirSync(D('engine')) : []) {
    if (/ingest/i.test(f) && /\.(js|py)$/.test(f)) collectors.push('engine/' + f);
  }
  {
    for (const rel of collectors) {
      let s = ''; try { s = fs.readFileSync(D(rel), 'utf8'); } catch (e) { continue; }
      for (const m of stripComments(s).matchAll(/(games\.[A-Za-z0-9_.\-]+?)(?:\.jsonl)\b/g)) {
        /* THE GREEDY CAPTURE ATE THE EXTENSION and produced `games.ladder.jsonl.jsonl`, so NOTHING was
         * ever removed from the product set and every store reader in the repository was quarantined —
         * including data/live.js and data/meta-usage.json, which are OPS's and are explicitly NOT
         * quarantined. Caught by reading the output rather than by trusting the regex. */
        const base = m[1].replace(/\.jsonl$/, '').replace(/\.raw-logs$/, '');
        ingested.add(base + '.jsonl');
        ingested.add(base + '.raw-logs.jsonl');
      }
    }
  }
  let disk = []; try { disk = fs.readdirSync(D('data')); } catch (e) { SWALLOWED.push('scan data/ for jsonl stores' + ': ' + why(e)); }
  for (const f of disk) if (/\.jsonl$/.test(f) && !ingested.has(f)) out.add(f);
  for (const f of ingested) out.delete(f);
  return out;
}

/* WHAT MEDICHAM READS IS NOT WHAT MEDICHAM PRODUCED.
 *
 * `data/tags.json`, `data/abra-tags.js` and `data/engine-data.js` are the rulebook and the species
 * table the simulator READS. Their generators require the simulator — `tag_dex.js` uses it to resolve
 * a move's shape — so a naive closure marks them downstream and then drags in everything that reads
 * them, including the game differential itself. That is the strict-direction error CLAUDE.md warns
 * about: it would withhold the tag file the engine is fixed WITH, and the instrument that says when
 * the fixing is done.
 *
 * The set is not typed here. `provenance.js` already derives which files are ENGINE INPUTS — the same
 * list `status.js` reads for the refit edge — and an artifact that IS one, or that one is built FROM,
 * sits upstream of the arrow in docs/DIVISIONS.md rather than to the right of it. */
function engineInputArtifacts(g) {
  const out = new Set();
  try {
    const s = fs.readFileSync(D('engine', 'provenance.js'), 'utf8');
    const m = s.match(/ENGINE_INPUTS\s*=\s*\[([^\]]*)\]/);
    if (!m) return out;
    for (const n of m[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)) out.add(n);
  } catch (e) { SWALLOWED.push('parse the ingest workflow for collector names' + ': ' + why(e)); return out; }
  if (!Array.isArray(g)) return out;
  const by = new Map(g.map(a => [a.file, a]));
  for (let i = 0; i < 16; i++) {
    let grew = false;
    for (const f of [...out]) {
      const a = by.get(f);
      if (!a) continue;
      for (const dep of a.from || []) {
        if (/\.jsonl$/.test(dep) || dep.includes('/')) continue;   // stores and engine sources, not artifacts
        if (!out.has(dep)) { out.add(dep); grew = true; }
      }
    }
    if (!grew) break;
  }
  return out;
}

function graph() {
  /* ONE DERIVATION OF THE ARTIFACT GRAPH, and it is provenance.js's. status.js shells out to
   * provenance.js rather than reimplementing its staleness rules; this does the same for its edges. */
  try {
    return JSON.parse(execFileSync(process.execPath, [D('engine', 'provenance.js'), '--graph', '--json'],
      { encoding: 'utf8', maxBuffer: 1 << 26 }));
  } catch (e) {
    return { error: String((e && e.message) || e).split('\n')[0] };
  }
}

function classify(opts = {}) {
  const src = opts.src || sources();
  const play = opts.play || playLayer(src);
  const exempt = new Map((opts.exemptions || MEASURES_THE_ENGINE).map(e => [e.module, e.why]));
  const products = opts.products || playProducts(src, play);
  const g = opts.graph || graph();
  const staleExemptions = [...exempt.keys()].filter(m => !play.has(m));

  if (g.error) return { error: g.error, play, exempt, staleExemptions };

  const upstream = opts.upstream || engineInputArtifacts(g);
  /* A row dump is almost never in provenance's `from` — that arm tracks .json/.js artifacts and the
   * game stores, not an arbitrary .jsonl — so the generator's own source is asked directly. */
  /* NEAR A READ VERB, exactly as provenance.js does it, and for the reason it learned: a bare
   * substring match turned every filename mentioned anywhere into a dependency and gave one artifact
   * seventeen of them. A dump named in a usage string or an error message is not a dump being read. */
  const READ = /readFileSync|createReadStream|require\s*\(|open\s*\(|read_json|json\.load|loadGames|load_games/;
  const WROTE = /writeFileSync|createWriteStream|appendFileSync|json\.dump/;
  const namesProduct = (id) => {
    const code = stripComments(src[id] || '');
    const hits = [];
    /* A READ VERB IS THE STRONG SIGNAL, AND A BARE MENTION IS THE COMMON ONE. Both R1 and R4 — the two
     * gates this clause exists to catch — bind their input through a default:
     *     const ROWS   = argv.find(a => !a.startsWith('--')) || 'data/rollout-r1-rows.jsonl';
     *     const CORPUS = argv.find(a => !a.startsWith('--')) || 'data/games.r4-decided.jsonl';
     * There is no read verb on either line; the read happens hundreds of lines later through the
     * identifier. Requiring proximity to a read verb found NEITHER, which is how the first version of
     * this file cleared R1 and R4 — the two artifacts CLAUDE.md's quarantine list names first.
     *
     * So a product named in LIVE CODE counts unless this generator is the one that WRITES it: naming a
     * dump you do not write is reading it. Comments are stripped first, so a filename discussed in
     * prose still does not count — the fault provenance.js records twice about itself. */
    for (const p of products) {
      let i = code.indexOf(p), mention = false, written = false;
      while (i >= 0) {
        /* A SUBSTRING IS NOT A FILENAME. `rows.jsonl` is a substring of `rollout-r1-rows.jsonl`, which
         * is provenance.js's `ladder.json` inside `games.ladder.jsonl` fault in a new pair of names —
         * it credited R1 with reading a dump it has never heard of. The character before the match
         * must not continue the name. */
        if (/[A-Za-z0-9_.\-]/.test(code[i - 1] || '')) { i = code.indexOf(p, i + 1); continue; }
        const near = code.slice(Math.max(0, i - 140), i + 60);
        if (WROTE.test(near)) written = true; else mention = true;
        i = code.indexOf(p, i + 1);
      }
      if (mention && !written) hits.push(p);
    }
    return hits;
  };

  /* AN UNKNOWN ROW MAY NOT ENTER THE CLASSIFICATION, AND THIS IS THE WHOLE POINT OF THE CHANGE.
   *
   * provenance.js now emits a row for every file in data/, including the ones it cannot name a writer
   * for (`unknown: true`, `by: null`). That is what stops the set being invisible. It is also, if it
   * were fed straight into the loop below, exactly how the set would be silently CLEARED: `by` is
   * null, so `play.has(null)` is false, so no clause fires, so `quarantined` comes out false and the
   * artifact reads as examined-and-fine. `web/build-quarantine.js` asks only whether a row exists, so
   * that page would have gone from "unclassified" to "clear" for twenty artifacts on this change
   * alone — a default in the permissive direction, arriving through a fix to the thing that refuses
   * to default. They are split out here and reported as unknowns, which is what they are. */
  const known = g.filter(a => !a.unknown);
  const unknownRows = g.filter(a => a.unknown);
  const rows = new Map();
  for (const a of known) {
    const consumes = play.has(a.by) && !exempt.has(a.by);
    const reads = (a.from || []).filter(f => products.has(f) || products.has(f.replace(/^data\//, '')));
    const dumps = reads.length ? [] : namesProduct(a.by);
    let reason = null;
    if (upstream.has(a.file)) reason = null;      /* what the simulator READS is upstream of it */
    else if (consumes) reason = `its generator ${a.by} is in the play layer (it reaches ${SIMULATOR} through require)`;
    else if (reads.length) reason = `${a.by} reads ${reads.join(', ')}, which one of our own runs wrote`;
    else if (dumps.length) reason = `${a.by} reads ${dumps.slice(0, 2).join(', ')} — a dump of games MEDICHAM played`;
    rows.set(a.file, { file: a.file, by: a.by, from: a.from || [], quarantined: !!reason, reason,
                       upstream: upstream.has(a.file),
                       exempt: exempt.has(a.by) ? exempt.get(a.by) : null });
  }
  /* TRANSITIVE: an artifact that reads a quarantined artifact carries the quarantine. This is what
   * puts data/weight-multiplicity.json, data/mag.js, data/scoreboard.js and data/ladder.json in the
   * set — they read policy-weights.json, and the weights were fitted on features computed through a
   * simulator we know is wrong. The refit is exactly the event that clears them, and it is gated. */
  for (let i = 0; i < 32; i++) {
    let grew = false;
    for (const r of rows.values()) {
      if (r.quarantined || r.upstream) continue;
      const hit = r.from.find(f => rows.has(f) && rows.get(f).quarantined);
      if (hit) { r.quarantined = true; r.reason = `it reads ${hit}, which is quarantined`; grew = true; }
    }
    if (!grew) break;
  }
  return { rows, play, exempt, staleExemptions, products, unknownRows };
}

/* THE ONE ENTRY POINT EVERY CALLER USES. status.js asks two questions — is the gate open, and is this
 * artifact in the set — and must never grow its own answer to either. */
/* ARTIFACTS THE GRAPH CANNOT NAME A WRITER FOR, reported rather than guessed at.
 *
 * THEY ARE NOT DEFAULTED EITHER WAY, and that is deliberate. The set holds both instruments (the
 * census) and consumers (`exploitability-holdout.json`, seven `policy-weights-*.json` variants), so
 * defaulting to CLEAN hides a withheld figure and defaulting to HELD withholds the instrument that
 * says when the quarantine lifts. An unknown that is silently resolved either way is the failure this
 * whole file exists to stop, so it is printed as an unknown.
 *
 * IT IS READ FROM provenance.js NOW, NOT SUBTRACTED FROM A DIRECTORY LISTING.
 *
 * This function used to list `data/` and remove everything the graph had a row for. That is a second
 * derivation of provenance.js's own answer, living in the caller, and it came with its own
 * explanation of WHY the graph could not see those files — a sentence saying the writer scan reads
 * "engine/ and build/" only, which stopped being true on 2026-08-09 when it learned to read tests/.
 * Twenty artifacts were being explained by a reason that no longer applied to any of them, and
 * nothing could tell, because the subtraction produces the same list whatever the cause. provenance.js
 * now emits an explicit unknown row carrying a DERIVED reason per file, and this reads it.
 *
 * THE SUBTRACTION SURVIVES AS A CROSS-CHECK AND NOTHING MORE. If a file on disk appears in neither
 * set, that is a hole in provenance.js's own scan rather than an unknown artifact, and the two are
 * different bugs. It is reported under its own heading instead of being folded in — folding it in is
 * how the last explanation came to cover a set it did not describe. */
function unclassified(rows, unknownRows) {
  const out = (unknownRows || []).map(r => r.file);
  let disk = []; try { disk = fs.readdirSync(D('data')); } catch (e) { SWALLOWED.push('scan data/ for unclassified artifacts' + ': ' + why(e)); return out; }
  for (const f of disk) {
    if (!/\.(json|js)$/.test(f) || /^games\./.test(f) || /\.meta\.json$/.test(f)) continue;
    if ((rows && rows.has(f)) || out.includes(f)) continue;
    /* NOT pushed onto SWALLOWED: that channel means "a read this gate is allowed to miss", and this
     * is not a read that failed — it is an artifact provenance.js never examined, which is a hole in
     * the scan rather than a permitted gap. It joins the unknown set with NO reason attached, and the
     * printer says exactly that, so the two cannot be confused by a reader. */
    out.push(f);
  }
  return out.sort();
}

/* WITHHOLD is the question a caller actually has, and it is deliberately ONE function rather than two
 * facts a caller has to combine — combining them wrongly (printing while the gate is closed) is the
 * only way left to reintroduce the bug this file closes.
 *
 * IT TAKES THE GATE AS AN ARGUMENT so the selftest can drive the REAL function with a passing gate and
 * with a failing one. A `--force-open` flag would have done the same job and would have been a hole:
 * anything that can silence this from the command line eventually does, which is why provenance.js's
 * `void` is one-way and has no `valid: true`. A parameter is visible in the caller; a flag is not. */
function withholder(gate, rows) {
  const set = new Set();
  if (rows) for (const r of rows.values()) if (r.quarantined) set.add(r.file);
  const fn = function withhold(file) {
    if (gate.ok) return null;
    const f = String(file).replace(/^data\//, '');
    if (!set.has(f)) return null;
    const r = rows && rows.get(f);
    return {
      file: 'data/' + f,
      because: r ? r.reason : 'downstream of ' + SIMULATOR,
      rerun: r ? `node ${r.by}` : null,
      /* THE CLAUSE SUMMARY IS A COUNT, NOT THE FIRST CLAUSE'S PROSE. Repeating one clause's full
       * sentence under every withheld line printed the same 150 characters six times and buried the
       * fact that the other three clauses fail too. The banner carries the detail once. */
      clause: `${gate.failing.length} of ${gate.clauses.length} gate clauses fail `
            + `(${gate.failing.map(c => c.name).join('; ')})`,
    };
  };
  fn.set = set;
  return fn;
}

let CACHE = null;
function state() {
  if (CACHE) return CACHE;
  const gate = medichamIsCorrect();
  const c = classify();
  const withhold = withholder(gate, c.rows);
  CACHE = {
    ok: gate.ok, gate, rows: c.rows, error: c.error, play: c.play,
    staleExemptions: c.staleExemptions || [],
    unclassified: unclassified(c.rows, c.unknownRows),
    unknownRows: c.unknownRows || [],
    withhold,
    set: withhold.set,
  };
  return CACHE;
}

module.exports = { medichamIsCorrect, classify, state, withholder, playLayer, sources, requiresOf,
                   MEASURES_THE_ENGINE, ROSTER_STAGES, rosterStage, SIMULATOR,
                   /* EXPORTED FOR engine/open_work.js SO THERE IS ONE CLOSED-DETECTOR, NOT TWO.
                    * CLAUDE.md: two files that both decide a fact will disagree eventually, and the
                    * disagreement will be invisible because both keep working. This gate and the work
                    * list must never differ on whether a row is closed. */
                   roadmapRowIsClosed, roadmapRowSaysBroken, openDefectClause };

/* ================================================================================================
 * 3. CLI — report, derivation, gate, selftest
 * ============================================================================================== */
if (require.main === module) {
  const ARG = process.argv.slice(2);
  const has = f => ARG.includes(f);

  /* ---- SELFTEST: shown RED on a deliberately-quarantined figure before it is trusted -------------
   * `.githooks/pre-commit` was demonstrated red on a deliberate break before it was armed, and
   * `status.js --selftest` exists because `refit edge: CLEAN` printed for two days over a contrast
   * that had measured three columns moving. A gate that has only ever been green is not evidence.
   *
   * Both directions are driven. The RED cases prove the quarantine engages; the LIFT cases prove it
   * disengages, because a quarantine that can never lift is as broken as one that never fires. */
  if (has('--selftest')) {
    let bad = 0, ran = 0;
    /* THE TOTAL IS COUNTED, NOT TYPED. The first draft printed a literal 19 beside 18 cases — a
     * hand-maintained number inside the guard written against hand-maintained numbers. */
    const ok = (name, cond, got) => {
      ran++;
      if (!cond) bad++;
      console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : '   got ' + JSON.stringify(got)}`);
    };

    /* -- the gate's clauses, on synthetic artifacts ------------------------------------------- */
    const stage = (counts, reds) => ({ counts, reds: reds || [] });
    const clause = j => {
      const c = j.counts || {};
      const differ = c['FIRED-AND-BOARDS-DIFFER'] || 0, silent = c['DID-NOT-FIRE'] || 0;
      const badReds = (j.reds || []).filter(r => r && r.ok === false).length;
      return differ === 0 && silent === 0 && badReds === 0;
    };
    ok('a stage with 2 DIFFER and 4 DID-NOT-FIRE fails',
      !clause(stage({ 'FIRED-AND-BOARDS-DIFFER': 2, 'DID-NOT-FIRE': 4 })));
    ok('a clean stage passes', clause(stage({ 'FIRED-AND-BOARDS-DIFFER': 0, 'DID-NOT-FIRE': 0, 'FIRED-AND-BOARDS-MATCH': 31 })));
    ok('a clean stage with a FAILED red demonstration still fails',
      !clause(stage({ 'FIRED-AND-BOARDS-DIFFER': 0, 'DID-NOT-FIRE': 0 }, [{ ok: false }])));
    /* THE CASE THE WHOLE FILE TURNS ON. A stage with no artifact must FAIL, not pass by absence. */
    const missing = rosterStage('__no_such_stage__');
    ok('a MISSING stage is a FAILING clause, not a passing one', missing.ok === false && missing.missing === true, missing);

    /* -- ROADMAP #88: THE DIFFERENTIAL CLAUSE, THROUGH THE SHIPPING FUNCTION -------------------
     * Every case below is a WHOLE artifact handed to `differentialClause` itself, so a change to the
     * rule cannot pass by having its selftest re-state the old one. The two RED cases are the point:
     * a clean midpoint with a dirty corner, and an artifact with no corners at all. */
    const armArt = (mid, top, bot) => ({ compared: 6000, seed: 20260804, disagreed: mid,
      arms: [{ arm: 'top', compared: 6000, disagreed: top, worst: [] },
             { arm: 'bottom', compared: 6000, disagreed: bot, worst: [] }] });
    ok('both corners clean and the midpoint clean PASSES', differentialClause(armArt(0, 0, 0)).ok === true);
    ok('RED — the midpoint is clean and the BOTTOM corner is not: the clause FAILS',
      differentialClause(armArt(0, 0, 7)).ok === false, differentialClause(armArt(0, 0, 7)).why);
    ok('RED — the midpoint is clean and the TOP corner is not: the clause FAILS',
      differentialClause(armArt(0, 3, 0)).ok === false);
    ok('RED — an artifact with NO corner arms FAILS rather than passing by absence',
      differentialClause({ compared: 6000, seed: 1, disagreed: 0 }).ok === false);
    ok('RED — a PLANTED artifact is refused even when every number in it is zero',
      differentialClause({ ...armArt(0, 0, 0), plant: { kind: 'spread', halfwidth: 12 } }).ok === false);
    ok('a dirty midpoint still fails, with both corners clean',
      differentialClause(armArt(5, 0, 0)).ok === false);
    ok('the passing reason NAMES both corners rather than one pooled number',
      /top 0\/6000/.test(differentialClause(armArt(0, 0, 0)).why)
      && /bottom 0\/6000/.test(differentialClause(armArt(0, 0, 0)).why),
      differentialClause(armArt(0, 0, 0)).why);

    /* -- membership, on a synthetic source tree ------------------------------------------------ */
    const src = {
      'engine/medicham2-browser.js': 'module.exports={battle}',
      'engine/board.js': "const M=require('./medicham2-browser.js');",
      'engine/rollout_leaf.js': "const B=require('./board.js');",
      'engine/consumer.js': "const L=require('./rollout_leaf.js'); fs.writeFileSync('data/consumer.json',x)",
      'engine/instrument.js': "const R=require('./board.js'); // drives both engines",
      'engine/dumper.js': "const L=require('./rollout_leaf.js'); fs.writeFileSync('rows.jsonl',x)",
      'engine/reader.js': "JSON.parse(fs.readFileSync('rows.jsonl'))",
      'engine/store_only.js': "const Q=require('./quality.js');",
      /* A NAME IN A COMMENT IS NOT A REQUIRE — the fault provenance.js records twice. */
      'engine/prose.js': "/* this one day may require('./board.js') */ const x=1;",
    };
    const play = playLayer(src);
    ok('the play layer reaches board.js from the simulator', play.has('engine/board.js'));
    ok('the play layer reaches rollout_leaf.js transitively', play.has('engine/rollout_leaf.js'));
    ok('a store-only generator is NOT in the play layer', !play.has('engine/store_only.js'));
    ok('a require inside a COMMENT does not taint', !play.has('engine/prose.js'));
    ok('a play-layer row dump is detected', playProducts(src, play).has('rows.jsonl'));

    const g = [
      { file: 'consumer.json', by: 'engine/consumer.js', from: [] },
      { file: 'instrument.json', by: 'engine/instrument.js', from: [] },
      { file: 'reader.json', by: 'engine/reader.js', from: ['rows.jsonl'] },
      { file: 'downstream.json', by: 'engine/store_only.js', from: ['consumer.json'] },
      { file: 'clean.json', by: 'engine/store_only.js', from: [] },
    ];
    const c = classify({ src, play, graph: g,
      exemptions: [{ module: 'engine/instrument.js', why: 'it drives both engines' }] });
    const q = f => c.rows.get(f).quarantined;
    ok('a play-layer generator is QUARANTINED', q('consumer.json'));
    ok('a DECLARED instrument is not', !q('instrument.json'));
    ok('a generator reading a play-layer row dump is QUARANTINED', q('reader.json'));
    ok('an artifact reading a quarantined artifact is QUARANTINED (transitive)', q('downstream.json'));
    ok('a store-only artifact is NOT quarantined', !q('clean.json'));
    ok('an exemption naming a module outside the play layer is reported STALE',
      classify({ src, play, graph: g, exemptions: [{ module: 'engine/nope.js', why: 'x' }] })
        .staleExemptions.length === 1);

    /* -- WITHHOLDING, both directions, THROUGH THE REAL FUNCTION -------------------------------
     * The first draft of this block wrote its own two-line withhold() and asserted against that,
     * which proves the test can implement a quarantine and says nothing about the one that ships.
     * `withholder` is the function `state()` hands to status.js; only the GATE differs between the
     * two cases below, which is exactly the variable under test. */
    const CLOSED = { ok: false, clauses: [{}, {}], failing: [{ name: 'game differential' }] };
    const OPEN = { ok: true, clauses: [{}, {}], failing: [] };
    const wClosed = withholder(CLOSED, c.rows), wOpen = withholder(OPEN, c.rows);
    ok('RED — with the gate closed, a quarantined figure is withheld', !!wClosed('data/consumer.json'));
    ok('the withheld line carries the reason and what re-runs it',
      !!(wClosed('data/consumer.json').because && wClosed('data/consumer.json').rerun), wClosed('data/consumer.json'));
    ok('a NON-quarantined figure is never withheld', !wClosed('data/clean.json'));
    /* THE NEGATIVE, AND IT MATTERS AS MUCH AS THE POSITIVE. A quarantine that can never lift is as
     * broken as one that never engages: the same artifact, the same classification, gate open. */
    ok('LIFT — with the gate open, the same figure is released', !wOpen('data/consumer.json'));
    ok('LIFT — with the gate open, NOTHING is withheld',
      [...wOpen.set].every(f => !wOpen('data/' + f)));

    console.log(`\nQUARANTINE SELFTEST: ${ran - bad} passed, ${bad} failed`);
    process.exit(bad ? 1 : 0);
  }

  const S = state();

  if (has('--graph')) {
    console.log('QUARANTINE DERIVATION — nothing here is typed; the root is ' + SIMULATOR + '\n');
    console.log(`  play layer: ${S.play.size} modules reach the simulator through require`);
    for (const e of MEASURES_THE_ENGINE) console.log(`  DECLARED INSTRUMENT: ${e.module}\n    ${e.why.replace(/\s+/g, ' ')}`);
    console.log('');
    if (S.error) { console.log('  GRAPH UNAVAILABLE: ' + S.error); process.exit(1); }
    const pad = (s, n) => String(s).padEnd(n);
    console.log('  ' + pad('artifact', 34) + pad('', 6) + 'why');
    console.log('  ' + '-'.repeat(110));
    for (const r of [...S.rows.values()].sort((a, b) => a.file.localeCompare(b.file))) {
      console.log('  ' + pad(r.file, 34) + pad(r.quarantined ? 'HELD' : 'ok', 6) +
        (r.quarantined ? r.reason : (r.exempt ? 'DECLARED INSTRUMENT' : 'not downstream of the simulator')));
    }
    process.exit(0);
  }

  console.log('');
  console.log('QUARANTINE — everything downstream of MEDICHAM is withheld until MEDICHAM is correct');
  console.log('');
  console.log(`  GATE: ${S.ok ? 'OPEN — MEDICHAM passes both conditions; nothing is withheld'
                              : 'CLOSED — ' + S.gate.failing.length + ' of ' + S.gate.clauses.length + ' clauses fail'}`);
  for (const c of S.gate.clauses) console.log(`    ${c.ok ? 'PASS' : 'FAIL'}  ${pad2(c.name, 30)} ${c.why.replace(/\s+/g, ' ')}`);
  if (S.staleExemptions.length) {
    console.log('');
    console.log('  STALE EXEMPTION — a declared instrument that is no longer in the play layer:');
    for (const m of S.staleExemptions) console.log('    ' + m);
  }

  /* THE CLOSET — things IN the regulation that somebody deliberately shelved.
   *
   * Will, 2026-08-11: *"Can we remove all the irrelevant numbers then and just have a quarantined
   * closet section."* The out-of-scope counts are gone from the clause lines above, because an
   * entity no legal body can carry is not untested coverage — it is not in this game.
   *
   * What IS worth a section is the opposite: entities that ARE legal, that COULD be tested, and that
   * a human chose to defer. That is a decision with an owner and it should be visible rather than
   * folded into a parenthetical, because a deferral nobody re-reads is how a shelf becomes permanent.
   * Every row here is staged and printed by its own instrument; none of them is being hidden. */
  const closet = [];
  for (const c of S.gate.clauses) {
    if (c.deferred) closet.push(`    ${pad2(c.stage || c.name, 12)} ${c.deferred} deferred by the owner`);
  }
  if (closet.length) {
    console.log('');
    console.log('  THE CLOSET — legal in this regulation, testable, and deliberately shelved:');
    for (const l of closet) console.log(l);
    console.log('    ' + pad2('illusion', 12) + 'ROADMAP #160 — Zoroark, 384 games excluded from the fit corpus; ILLUSION_IN=1 re-admits');
    console.log('    ' + pad2('stall', 12) + 'ROADMAP #195 — zero corpus uses, one carrier; reopens if a Sableye ever appears');
    /* ~~ROADMAP #213 — tangledfeet, closeted on Will's call.~~ **OFF THE SHELF, ROADMAP #217, AND THE
     * REASON IT WAS SHELVED WAS NEVER TRUE.**
     *
     * The closet entry said its condition "cannot be ENTERED" because this engine has no confusion
     * volatile. That came from an `off:` string in `medicham2-browser.js`'s ACCMOD table which was
     * accurate when written and had been overtaken: `applyConfusion` writes `_vol.confusion` with the
     * self-hit roll, the expiry and every refusal, and the rate runner already carries targets for it.
     * The closet is for a DECISION WITH AN OWNER, and this row was never a decision — it was a stale
     * sentence quoted as a measurement, which is the failure this whole file exists to make visible.
     * Wired and probed in #217 (`ability/accuracyMod`, a 2x2 where three cells must agree). Left here
     * as a comment rather than deleted, because a closet that silently loses rows teaches nobody. */
    console.log('    Nothing here is a coverage gap. Each is a choice, and each names the way back.');
  }
  console.log('');
  if (S.error) {
    console.log('  THE ARTIFACT GRAPH COULD NOT BE READ: ' + S.error);
    console.log('  Nothing can be classified, so nothing is cleared. Fix engine/provenance.js first.');
    process.exitCode = 1;
  } else {
    const held = [...S.rows.values()].filter(r => r.quarantined).sort((a, b) => a.file.localeCompare(b.file));
    /* THE HEADING FOLLOWS THE GATE, AND UNTIL 2026-08-11 IT DID NOT — because until 2026-08-11 the
     * gate had never been open, so nobody had read this page in that state. It printed
     * `GATE: OPEN — nothing is withheld` and then, four lines down, `47 artifacts … are WITHHELD`.
     * Two contradictory statements about the same 47 files, and a reader would have been entitled to
     * believe either.
     *
     * `withholder()` is the authority on the WITHHOLDING and it is right in both states (its selftest
     * asserts the lift explicitly). This list is the DOWNSTREAM SET, which does not change when the
     * gate opens; what changes is what it means. Open, these numbers are not false and not withheld —
     * they are STALE, measured under an engine that has since been corrected, and ROADMAP #57 is the
     * re-run list. Saying so is the whole difference between "you may quote this" and "you may quote
     * this once you have re-run it". */
    console.log(S.gate.ok
      ? `  ${held.length} of ${S.rows.size} artifacts are downstream of MEDICHAM and are now RE-RUNNABLE.`
        + ` They are NOT withheld and they are NOT current — every one was measured under an engine`
        + ` that has since changed, so each must be re-run before it is quoted (ROADMAP #57):`
      : `  ${held.length} of ${S.rows.size} artifacts are downstream of MEDICHAM and are WITHHELD:`);
    for (const r of held) console.log('    data/' + pad2(r.file, 34) + ' re-run: node ' + r.by);
    console.log('');
    console.log('  Re-running is not optional once the gate opens. A quarantined number does not become');
    console.log('  true when MEDICHAM becomes correct; it becomes re-runnable. ROADMAP #57.');
    /* THE REASON IS READ, NOT RECITED. This block used to carry one typed sentence — "provenance.js
     * finds a writer only in engine/ and build/" — as the explanation for all twenty files. That was
     * true until 2026-08-09 and false afterwards, and it applied to none of the twenty by the time
     * anybody acted on it: the scan reads tests/ now, and these files are unknown for five different
     * reasons, one of which is that they are CONFIG and correctly have no generator at all. Each row
     * carries its own derived reason and this prints that. */
    if (S.unclassified.length) {
      const whyOf = new Map((S.unknownRows || []).map(r => [r.file, r.why]));
      console.log('');
      console.log(`  ${S.unclassified.length} artifact(s) on disk have NO DISCOVERABLE WRITER and are neither`);
      console.log('  cleared nor withheld. The set holds instruments AND consumers, so it cannot be');
      console.log('  defaulted either way. Reasons are derived per file by engine/provenance.js:');
      for (const f of S.unclassified) {
        console.log('    ' + f);
        const w = whyOf.get(f) || 'NO REASON RECORDED — engine/provenance.js did not examine this file at all.';
        let cur = '';
        for (const word of String(w).split(/\s+/)) {
          if ((cur + ' ' + word).trim().length > 92) { console.log('        ' + cur.trim()); cur = word; }
          else cur += ' ' + word;
        }
        if (cur.trim()) console.log('        ' + cur.trim());
      }
    }
  }
  console.log('');

  /* ---- THE GATE ---------------------------------------------------------------------------------
   * Fails when a quarantined FIGURE is being printed. The check is on `status.js`, because that is the
   * one command every session is required to run first and therefore the one place a withheld number
   * would be read from. It re-runs status.js and asserts two things at once: the withheld artifact's
   * own verdict string does not appear, and the word QUARANTINED does.
   *
   * IT DOES NOT GATE ON docs/ OR web/. Those are other divisions' files — WEB may not author a number
   * and MEASURE may not edit web/ — so failing on them would leave a gate that cannot be satisfied by
   * the division that owns it, which CLAUDE.md names as how a red check becomes "one of the known
   * failures". They are REPORTED instead, in full, every run. */
  if (has('--check')) {
    let fail = 0;
    /* THE CLASSIFIER IS PROVED BEFORE THE TREE IS JUDGED. --check asks whether a real leak exists; if
     * the classifier underneath it is broken, "no leak" is the answer it returns either way. Running
     * the selftest here rather than registering the file twice in tests/run-all.js keeps one entry and
     * makes the dependency explicit: a red selftest is a red gate. */
    try {
      execFileSync(process.execPath, [__filename, '--selftest'], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      console.log('QUARANTINE CHECK: the selftest is RED, so this gate cannot be believed:');
      console.log(String((e && e.stdout) || '').split('\n').filter(l => /FAIL/.test(l)).join('\n'));
      fail++;
    }
    if (S.staleExemptions.length) {
      console.log('QUARANTINE CHECK: a declared instrument exemption names a module that is not in the');
      console.log('play layer. The claim has quietly become false — remove it or find out why.');
      fail++;
    }
    if (S.error) { console.log('QUARANTINE CHECK: the artifact graph could not be read — ' + S.error); fail++; }

    if (!S.ok && !S.error) {
      let out = '';
      try {
        out = execFileSync(process.execPath, [D('engine', 'status.js')],
          { encoding: 'utf8', maxBuffer: 1 << 26 });
      } catch (e) { SWALLOWED.push('run engine/status.js to scan its output' + ': ' + why(e)); out = (e && (e.stdout || '')) || ''; }
      if (!out) {
        console.log('QUARANTINE CHECK: engine/status.js produced no output, so nothing could be checked.');
        fail++;
      } else {
        /* A VERDICT STRING IS THE FIGURE. Every quarantined artifact that carries one carries its whole
         * headline in it — "MILTANK takes 55.5% of 535 DECISIVE PAIRS", "is WORSE than a coin on Brier
         * (paired +0.0502...)". If that sentence is on the screen, the number was not withheld. This is
         * a stronger test than looking for a bare number: it is the exact text a reader would quote. */
        const leaked = [];
        for (const r of S.rows.values()) {
          if (!r.quarantined) continue;
          const j = readJson(D('data', r.file));
          if (!j) continue;
          for (const k of ['verdict', 'headline', 'summary']) {
            const v = j[k];
            if (typeof v !== 'string' || v.length < 24) continue;
            const probe = v.slice(0, 60);
            if (out.includes(probe)) leaked.push(`data/${r.file} (${k}): ${probe}...`);
          }
        }
        if (leaked.length) {
          console.log('QUARANTINE CHECK FAILED — engine/status.js is printing a QUARANTINED figure:');
          for (const l of leaked) console.log('  ' + l);
          console.log('  A caption is not a quarantine. Withhold the number; print what would re-run it.');
          fail++;
        }
        if (!/QUARANTINED/.test(out)) {
          console.log('QUARANTINE CHECK FAILED — the gate is CLOSED and engine/status.js never says');
          console.log('  QUARANTINED. Either the withholding is not wired, or it silently did nothing.');
          fail++;
        }
      }
    }

    /* ---- WHERE A WITHHELD NUMBER IS STILL CITED — reported, ratcheted, never edited from here ---- */
    const cites = citations(S);
    const stampPath = D('data', 'quarantine-stamp.json');
    const prev = readJson(stampPath);
    const nowList = cites.map(c => c.where).sort();
    const prevList = prev && Array.isArray(prev.citation_sites) ? prev.citation_sites : null;
    const added = prevList ? nowList.filter(f => !prevList.includes(f)) : [];
    if (cites.length) {
      console.log(`  ${cites.length} file(s) outside engine/ still quote a QUARANTINED artifact's verdict:`);
      for (const c of cites) console.log(`    ${c.where}  <- data/${c.file}`);
      console.log('  These are not edited from here — docs/ and web/ belong to other divisions, and a');
      console.log('  gate its owner cannot satisfy becomes a "known failure". RATCHETED instead.');
    }
    if (prevList && added.length) {
      console.log('');
      console.log(`  CITATION RATCHET BROKEN: ${added.length} NEW place(s) quote a withheld number —`);
      for (const f of added) console.log('    ' + f);
      console.log('  This list may shrink and may never grow while the gate is closed.');
      fail++;
    }
    try {
      fs.writeFileSync(stampPath, JSON.stringify({
        note: 'RATCHET. citation_sites may SHRINK and may never grow while the MEDICHAM quarantine is '
            + 'closed. A new entry means a withheld figure was just published somewhere.',
        /* STAMPED, BECAUSE AN UNSTAMPED NEW ARTIFACT BREAKS provenance.js's OWN RATCHET — and it did,
         * on the first run of this file: `RATCHET BROKEN: 1 artifact newly rests on mtime alone —
         * quarantine-stamp.json`. That ratchet may shrink and may never grow, and a gate that adds a
         * red row while installing itself is the "known failure" pattern arriving with the guard.
         * The two files whose CONTENT decides everything in here are the classifier and the graph it
         * reads; run_stamp owns the digest format so there is not a second one. */
        source_digests: (() => {
          try { return require('./run_stamp.js').sourceDigests(['engine/quarantine.js', 'engine/provenance.js']); }
          catch (e) { return SWALLOWED.push('stamp source digests' + ': ' + why(e)); }
        })(),
        not_store_derived: 'it records which artifacts are downstream of the simulator and where they '
            + 'are still cited. No game is counted anywhere in it, so the quality filter has no bearing.',
        gate_open: S.ok,
        failing_clauses: S.gate.failing.map(c => c.name),
        quarantined: [...S.set].sort(),
        citation_sites: nowList,
        generated: new Date().toISOString(),
      }, null, 2) + '\n');
    } catch (e) { console.log('  (could not write data/quarantine-stamp.json: ' + e.message + ')'); }

    console.log('');
    /* THE TALLY OF SWALLOWED READS, PRINTED EVERY RUN. A gate that could not read the thing it
     * polices must not report clean in silence — that is the failure this whole file exists to stop,
     * turned inward. Each entry names the read and the error, so "clean" always means "clean, and
     * here is everything I could not open" rather than "clean, as far as I got". */
    if (SWALLOWED.length) {
      console.log(`  ${SWALLOWED.length} read(s) this gate is allowed to miss DID miss — it is reporting on less than the whole tree:`);
      for (const w of SWALLOWED) console.log('    ' + w);
    }
    console.log(`QUARANTINE CHECK: ${fail ? fail + ' failure(s)' : 'clean — no withheld figure is being printed'}`
      + (SWALLOWED.length ? ` (${SWALLOWED.length} read(s) swallowed, listed above)` : ''));
    process.exit(fail ? 1 : 0);
  }
}

function pad2(s, n) { return String(s).padEnd(n); }

/* Where a quarantined artifact's headline sentence still appears outside engine/. Reported so the
 * list of places already citing a number they should not is a MEASUREMENT rather than a memory. */
function citations(S) {
  const out = [];
  if (!S.rows) return out;
  const probes = [];
  for (const r of S.rows.values()) {
    if (!r.quarantined) continue;
    const j = readJson(D('data', r.file));
    if (!j) continue;
    for (const k of ['verdict', 'headline', 'summary']) {
      const v = j[k];
      if (typeof v === 'string' && v.length >= 30) probes.push({ file: r.file, probe: v.slice(0, 50) });
    }
  }
  if (!probes.length) return out;
  const walk = (dir, depth) => {
    if (depth > 3) return;
    let list = []; try { list = fs.readdirSync(D(dir), { withFileTypes: true }); } catch (e) { SWALLOWED.push('walk ' + dir + ' for citations' + ': ' + why(e)); return; }
    for (const e of list) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) { if (!/^(node_modules|\.git|releases|_inbox)$/.test(e.name)) walk(rel, depth + 1); continue; }
      if (!/\.(md|html|js)$/.test(e.name)) continue;
      let s = ''; try { s = fs.readFileSync(D(rel), 'utf8'); } catch (e2) { SWALLOWED.push('read ' + rel + ' for citations' + ': ' + why(e2)); continue; }
      for (const p of probes) if (s.includes(p.probe)) out.push({ where: rel, file: p.file });
    }
  };
  /* `app/` IS THE DEPLOYED MIRROR AND IT WAS A BLIND SPOT IN THIS CHECKER. `tests/test-site-sync.js`
   * asserts every page under web/ is byte-identical to its app/ twin, so app/ is the copy a visitor
   * actually loads — and this walker looked at docs/ and web/ only. On 2026-08-08 that meant WEB
   * closed all five leaks in `web/status-data.js`, this check went green, and `app/status-data.js`
   * went on quoting the same five withheld verdicts to anyone opening the site. A checker whose
   * blind spot is exactly the published copy is worse than none: it certifies the leak.
   * Walked LAST so the web/ row is reported first when both carry it, which is the one to fix. */
  walk('docs', 0); walk('web', 0); walk('app', 0);
  return out;
}
