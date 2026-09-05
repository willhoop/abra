/* pin_guard.js — MAY THIS CLAUSE ANSWER, GIVEN WHAT ITS ARTIFACT DECLARES IT WAS MEASURED UNDER?
 *
 * ================= WHAT WENT WRONG ================================================================
 *
 * `node engine/sweep.js` §2 derives, from the gate's own clause list, how many clauses read an
 * artifact that does not record — or does not check — what it was measured under. On 2026-09-04 it
 * read 3 of 8, and all three were the SAME defect wearing three spellings:
 *
 *   data/engine-diff.json      NO release pin of any kind. Its producer requires the live tree, so
 *                              there was no way to stamp one without cutting a release it had not
 *                              read from. MEASURED: 4 of the 26 frozen sources — medicham2-browser.js,
 *                              engine-data.js, tags.json, abra-tags.js — moved between the artifact's
 *                              `generated` stamp (2026-08-29T06:49Z) and now. The clause published
 *                              "clean at BOTH corners, 0 of 6000" throughout and structurally could
 *                              not notice.
 *   data/all-mechanics-fire.json   hand-rolls `release: <id>` instead of spreading `REL.stamp()`, so
 *                              it carries no `showdown_commit` — and the AUTHORITY selects its
 *                              population (`dex.moves.all()` filtered to the format is where its 500
 *                              moves come from) — and no `source_digests`, which is the only thing
 *                              `provenance.js` can verify BY CONTENT.
 *   data/game-differential.json    records `steering.team_pool_digest` and the clause read only
 *                              `steering.policy`. A run against the wrong team pool passed.
 *
 * AND THE SHAPE UNDERNEATH ALL THREE IS ONE SENTENCE, COPIED FIVE TIMES: *"this refuses a MISMATCH,
 * not an absence."* `rosterStage`, `mechanicsClause`, `orderProbeClause`, `decisionImpact` and
 * `wholeGameClause` each carried their own copy. Every one of them therefore read an artifact that
 * declared NOTHING as agreement — which is the equivalence CLAUDE.md calls this repository's single
 * most expensive failure mode, five times over, in one file.
 *
 * ================= WHY A SHARED GUARD RATHER THAN THREE FIXES =====================================
 *
 * Will's acceptance test is *would this catch a second instance, spelled differently, through another
 * door?* Three targeted fixes answer no: a FOURTH clause added tomorrow, reading a fourth artifact
 * with no pin at all, would pass on its first run and nothing would say so. `sweep.js` would report
 * it — and `sweep.js` is itself in §1, the list of checks that no runner invokes.
 *
 * So the refusal is one function, and `audit()` below applies it to the clause LIST rather than to
 * three named clauses. A clause that does not hand back a RECEIPT saying which artifact it read and
 * what it checked is WITHHELD by the assembler. There is no way to add a fourth unpinned clause and
 * have it pass, because passing now requires saying out loud what you were measured on.
 *
 * ================= THE THREE RULES IT OBEYS =======================================================
 *
 * 1. THE FIELD NAMES ARE DERIVED, NEVER TYPED. `engine_release.js` exports `STAMP_SHAPE`; this file
 *    reads the key names out of it. Rename the pin and the producer and the guard move together.
 *    A typed spelling here would be the hand-maintained ban list of four in a new costume — and this
 *    repository already has the receipt for that, in the `j.engine_release || j.release || null`
 *    chain that four separate readers carry.
 * 2. ABSENCE REFUSES. An artifact that declares nothing is not an artifact that was measured on the
 *    right bytes; it is one whose bytes nobody recorded.
 * 3. NOTHING MEASURED COMES BACK ON A REFUSAL. Not the rate, not the count, not the composition.
 *    CLAUDE.md: *"the figure must be WITHHELD, not annotated. Printing it with a caveat is the bug."*
 *    `PRE-CHANGE` was rendered beside the quarantined numbers for days and they were quoted anyway,
 *    including by the agent that printed them. So the refusals below are built from the PIN ALONE —
 *    they are handed the artifact and take only its `generated` stamp and its declarations out of it,
 *    which is why there is no path by which a figure can leak into one.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO, said out loud rather than implied. It cannot tell whether
 * a pin is TRUE — a stamp says which bytes the producer believed it read, and only re-running proves
 * it. `provenance.js` closes half of that by verifying `source_digests` BY CONTENT, which is exactly
 * why the guard requires the digests and not only the id.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ER = require('./engine_release.js');
const STEERING = require('./steering.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const K = ER.STAMP_SHAPE;                 /* the pin vocabulary, derived from its producer */

/* A counter per refusal kind. A guard that cannot prove it ran is assumed broken (CLAUDE.md), and
 * this one is expected to be LOUD rather than silent — a zero across the board while clauses pass
 * would mean every artifact is pinned, which is a claim worth being able to check. */
const PIN_COUNTERS = { checked: 0, no_release: 0, wrong_release: 0, no_digests: 0,
                       population: 0, no_receipt: 0 };

/* NOT SILENT. The caller treats null as "no pin to check", which is correct for an artifact that is
 * ABSENT and WRONG for one that is present and CORRUPT — the second is a torn or truncated write, and
 * this repo has already reported a plausible, well-formed, completely fictitious answer read out of an
 * artifact mid-rewrite. ENOENT is the expected case and stays quiet; anything else is named and
 * counted, so a corrupt artifact cannot masquerade as a missing one. */
function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) {
    if (e && e.code !== 'ENOENT') {
      PIN_COUNTERS.unreadable = (PIN_COUNTERS.unreadable || 0) + 1;
      console.error('pin_guard: ' + p + ' exists and could not be read (' + e.message
        + '). Treated as UNPINNED, which understates the problem.');
    }
    return null;
  }
}

/* THE TREE'S OWN ID. Read from the pointer, which is what every existing clause compared against;
 * `inject` is the selftest's door, on the same reasoning as `wholeGameClause`'s second argument —
 * a parameter is visible in the caller where a flag is not. */
function currentId(inject) {
  if (inject !== undefined) return inject;
  const cur = readJson(D('data', 'engine-release.json'));
  return cur && (cur.id || cur.release || cur.current) || null;
}

/* WHAT DOES THIS ARTIFACT SAY IT WAS MEASURED ON? Reads only the names `STAMP_SHAPE` declares.
 *
 * `legacy` is the one concession and it is NAMED rather than silent: `data/all-mechanics-fire.json`
 * writes `release: <id>` because it predates `stamp()` being the one door. That spelling carries the
 * ID and nothing else — no `showdown_commit`, no `source_digests` — so it is reported as a partial
 * declaration and the caller decides. It is not treated as equal to a stamp, because it is not one. */
function releasePin(j) {
  const id = j ? j[K.id] : undefined;
  const legacy = (id === undefined && j) ? j.release : undefined;
  const digests = j ? j[K.digests] : undefined;
  return {
    declared: !!(id || legacy),
    id: id || legacy || null,
    from: id ? K.id : (legacy ? 'release (legacy spelling — carries the id and nothing else)' : null),
    stamped: !!id,
    digests: digests && typeof digests === 'object' ? Object.keys(digests).length : 0,
    showdown: j ? (j[K.showdown] || null) : null,
  };
}

/* ================================================================================================
 * WHY DID THE ID MOVE — THE COST THIS REFUSAL WAS PAID BLIND, TWICE — 2026-09-05
 * ================================================================================================
 *
 * The refusal below is CORRECT and it was expensive. 2026-08-28 09:58Z->10:06Z the gate fell from 7
 * of 8 clauses to 5; 2026-09-04/05 it read 7 FAILING of 9 and an agent re-ran five heavy clauses to
 * restore it. Both times the whole cause was that `engine/medicham2-browser.js` had its LINE ENDINGS
 * changed. All 26 frozen sources were content-identical — `diff --strip-trailing-cr` gave zero
 * differences. The re-runs bought the discovery that nothing had changed.
 *
 * NOTHING IS EXCUSED HERE, AND THAT IS THE DESIGN. The id still moved, the artifact is still measured
 * against other bytes, every figure in it is still WITHHELD, and this branch still fires. The only
 * thing that changes is that the refusal now says WHICH of the two causes it was, so the next reader
 * spends seconds instead of five heavy runs. `.gitattributes:70-77` explains why the two obvious
 * fixes — pin the nine CRLF sources to LF, or normalise the digest — are both shut on purpose.
 *
 * ONE IMPLEMENTATION. The classification lives in `engine/engine_release.js` (`driftDiagnosis`), not
 * here, and it is a PROPERTY of two byte strings rather than a list of the nine filenames. It is put
 * in `why` rather than in a new field because `status.js` and `quarantine.js` both already render a
 * clause's `why` verbatim — so neither needs an edit, and there is no second version of this fact to
 * drift away from the first. Two implementations of one fact is this repository's most expensive
 * recurring failure.
 *
 * IT CANNOT TAKE THE GATE DOWN AND IT CANNOT LEAK A FIGURE. It reads digests and bytes only; it never
 * touches the artifact's contents, so rule 3 above holds. And a failure inside it degrades to one
 * printed sentence — never a throw — because a gate that dies while explaining itself has turned a
 * diagnosis into an outage. NO SQUARE BRACKETS: `tests/test-divergence-composition.js` reads a
 * bracketed block back out of `why` as a shape composition, and a bracketed aside is indistinguishable
 * from a figure to anything that greps. */
function whyTheIdMoved(pinnedId) {
  if (!pinnedId) return { sentence: '', verdict: null };
  let d;
  try { d = ER.driftDiagnosis(pinnedId); }
  catch (e) {
    const msg = String((e && e.message) || e).split('\n')[0];
    console.error('pin_guard: could not diagnose why release ' + pinnedId + ' differs from the tree — ' + msg);
    return { sentence: ' WHY THE ID MOVED: could not be determined — ' + msg
      + '. Treat this as a real engine change until something says otherwise.', verdict: 'UNDIAGNOSABLE' };
  }
  return { sentence: ' ' + d.summary, verdict: d.verdict };
}

/* THE RECEIPT A CLAUSE HANDS BACK. `audit()` refuses any clause that does not produce one.
 *
 * It is DATA and not prose, so `status.js`, `sweep.js` and any later reader can see what a clause
 * checked without parsing a sentence — the same reasoning as `declared_register` in the whole-game
 * clause, which was moved out of prose for exactly this. */
function receipt(o) {
  return { artifact: (o && o.file) || null, checked: (o && o.checked) || [],
           release: (o && o.release) || null, why: (o && o.why) || null };
}

/* A CLAUSE WITH NO ARTIFACT IS NOT UNPINNED — it recomputes off the live tree on every run, so there
 * is nothing for it to be stale against. It must still say so, because "no receipt" and "no artifact"
 * are opposite facts and only one of them is fine. */
function noArtifact(why) {
  if (!why) throw new Error('pin_guard.noArtifact: a clause claiming it has no artifact must say why '
    + '— an unexplained exemption is the invisible exception this whole file is against.');
  return receipt({ file: null, checked: ['no-artifact'], why });
}

/* ================================================================================================
 * THE REFUSAL. Returns null when the clause may answer, or a WITHHELD clause result when it may not.
 * ================================================================================================
 *   name     the clause name, carried through so the caller's line does not change shape
 *   file     'data/x.json', for the message and the receipt
 *   artifact the parsed artifact
 *   need     ['release'] and optionally 'digests' / 'population'
 *   policy   for 'population': the steering policy this reader is answerable by
 *   rerun    the exact command that repairs it. REQUIRED — a withheld figure with no route back is
 *            just a hole, which is the note status.js already carries about its own withholding.
 */
function guard(o) {
  PIN_COUNTERS.checked++;
  const need = o.need || ['release'];
  const j = o.artifact;
  const gen = (j && j.generated) || null;
  if (!o.rerun) throw new Error('pin_guard.guard: ' + o.name + ' passed no `rerun` command. A '
    + 'withheld figure with no route back is a hole, not a refusal.');
  /* `note` IS PROSE AND MUST NOT LOOK LIKE A RESULT. A first draft carried the coverage-arm
   * explanation inside square brackets on the end of the re-run command, and
   * `tests/test-divergence-composition.js` — which reads a `[...]` block back out of `why` as the
   * shape composition — parsed it as an empty composition beside a refusal. A bracketed aside is
   * indistinguishable from a figure to anything that greps, which is the whole hazard here. */
  const withheld = (why, extra) => Object.assign({
    name: o.name, ok: false, cannot_answer: true, withheld: true, generated: gen,
    pins: receipt({ file: o.file, checked: need, why: 'REFUSED — ' + why }),
    why: why + (o.note ? ' ' + o.note : '') + ' Re-run: ' + o.rerun,
  }, extra || {});

  if (need.includes('release') || need.includes('digests')) {
    const p = releasePin(j);
    const cur = currentId(o.curId);
    if (!p.declared) {
      PIN_COUNTERS.no_release++;
      return withheld('MEASURED ON BYTES NOBODY RECORDED — ' + o.file + ' carries no `' + K.id
        + '` field, so it cannot say which engine produced it and cannot notice that the engine moved.'
        + ' Every figure in it is WITHHELD rather than printed with a caveat: an unpinned number reads'
        + ' exactly like a pinned one, which is how the PRE-CHANGE figures went on being quoted.');
    }
    if (cur && p.id !== cur) {
      PIN_COUNTERS.wrong_release++;
      const dx = whyTheIdMoved(p.id);
      return withheld('MEASURED AGAINST A DIFFERENT ENGINE — ' + o.file + ' ran on release ' + p.id
        + ' and the tree is ' + cur + '. That is not a weaker answer, it is an answer about other'
        + ' bytes. EVERY COUNT IN IT IS WITHHELD and none is repeated here.' + dx.sentence,
        { ranOn: p.id, staleAgainst: cur, drift_cause: dx.verdict });
    }
    if (need.includes('digests') && !p.digests) {
      PIN_COUNTERS.no_digests++;
      return withheld('THE PIN CANNOT BE VERIFIED — ' + o.file + ' names release ' + p.id + ' in `'
        + p.from + '` and carries no `' + K.digests + '`, so nothing can check BY CONTENT that it read'
        + ' those bytes. CLAUDE.md: "newer than its source" is no evidence at all, and an id is a'
        + ' claim rather than a receipt. Stamp with engine_release.js\'s own stamp() — open().stamp()'
        + ' for a frozen run, liveStamp() for an instrument that reads the live tree.');
    }
  }

  if (need.includes('population')) {
    /* ONE IMPLEMENTATION OF "WHAT SELECTED THIS SAMPLE" — steering.vouches(). A selector added there
     * tomorrow is checked here the same day with no edit in this file, which is the whole reason the
     * list does not live in the clause. */
    const v = STEERING.vouches(j && j.steering, { policy: o.policy });
    if (!v.ok) {
      PIN_COUNTERS.population++;
      return withheld('MEASURED ON THE WRONG POPULATION — ' + o.file + ' ' + v.reasons.join(' ')
        + ' THE RATE, THE DIVERGED COUNT, THE GAME COUNT AND THE CLASS COMPOSITION ARE ALL WITHHELD.');
    }
  }
  return null;
}

/* ================================================================================================
 * THE DOOR THAT CATCHES THE FOURTH CLAUSE — applied to the LIST, not to three named clauses.
 * ================================================================================================
 * Every clause must hand back `pins`. One that does not is WITHHELD, whatever its own verdict said,
 * because a clause that cannot say what it read is exactly the thing this file exists to refuse and
 * there is no reason a NEW one should be trusted more than the three that were already wrong.
 *
 * IT DOES NOT GUESS. An earlier draft found the artifact for an unreceipted clause by matching its
 * `generated` timestamp against every file under data/ (`coverage.clauseArtifact`). That returns null
 * on an ambiguous match, so the guard would have fallen silent exactly when it could not tell — the
 * silent default, rebuilt inside the thing built to stop it. A clause declares its artifact or it is
 * withheld; there is no inference step. */
function audit(clauses) {
  return clauses.map((c) => {
    if (c && c.pins) return c;
    PIN_COUNTERS.no_receipt++;
    return {
      name: (c && c.name) || '(unnamed clause)', ok: false, cannot_answer: true, withheld: true,
      generated: (c && c.generated) || null,
      pins: receipt({ file: null, checked: ['receipt'], why: 'REFUSED — no receipt' }),
      why: 'THIS CLAUSE DOES NOT SAY WHAT IT WAS MEASURED UNDER — it returned no `pins` receipt, so '
         + 'nothing can tell whether it read a fresh artifact, a stale one, or none. Its verdict is '
         + 'WITHHELD rather than printed: three clauses in this same gate published a number off an '
         + 'artifact whose engine had moved underneath it, and every one of them looked exactly like '
         + 'a pass. Add one: pins: PIN.receipt({ file, checked, release }) beside the artifact read, '
         + 'or PIN.noArtifact("<why this clause recomputes every run>") if it reads no file.',
    };
  });
}

module.exports = { guard, audit, receipt, noArtifact, releasePin, currentId, PIN_COUNTERS, K };
