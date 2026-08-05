# ADR-002 — Showdown is the authority, MEDICHAM is the runtime

**Version 3.43.0 · 2026-08-05 · Status: ACCEPTED · Supersedes the migration half of
[ADR-001](ADR-001-use-the-champions-mod.md), which stands as a record and is not deleted.**

---

## Context

ADR-001 decided that `data/mods/champions/` becomes the authoritative rules engine, driven through
the Showdown simulator API, and that `engine/medicham2-browser.js` becomes a lookup over precomputed
matchup tables with the hand-written engine as fallback only.

The forcing evidence was severe and correctly read: the official simulator and the hand-written
engine disagreed by **31.1 percentage points** of win probability on identical teams under identical
policy, flipping the favourite in **3 of 8** matchups. Every hand-fix made that day moved the engine
**4.35 points**. ADR-001's conclusion follows from those numbers:

> *"The remaining disagreement is seven times larger than everything we fixed. Fixing this engine by
> hand was never going to converge."*

**Migration steps 5–8 were never executed.** The opposite happened. `medicham2-browser.js` is now the
property of a standing division whose one number — mechanics live — may never fall, and it is the
leaf of the live search player. That is ADR-001's explicitly rejected alternative, adopted in
practice, with nothing recording the change. The repository's stated authority and its actual
authority have been different files for over a week.

This ADR does not discover that drift. It ends it, by deciding which of the two is right.

## Decision

**Showdown is the AUTHORITY. MEDICHAM is the RUNTIME. They are different jobs and both are kept.**

- **Showdown decides what is correct.** This is not a preference, it is wired into the tests:
  `tests/test-engine-diff.js` and `tests/test-interaction-matrix.js` both treat the official engine's
  answer as truth and score any disagreement as a MEDICHAM bug, never the reverse. The matrix authors
  no expected outcome at all — it asks the reference engine. It extends past mechanics to the format
  itself: what is banned and what is legal is read out of the mod (`isNonstandard: 'Past'`), never
  remembered.
- **MEDICHAM executes.** It is what actually runs in rollouts, self-play and the live bot.
- **The gap between them is measured, published, and ratcheted.** It is not assumed to be zero.

## Why the decision reverses, stated as evidence rather than preference

**1. The premise was falsified by events.** ADR-001 held that hand-fixing would never converge. It
converged. Read at the moment of the decision, from artifacts, not prose:

| instrument | agreement with the official engine |
|---|---|
| `data/engine-diff.json` (damage, seed 20260804) | **149 / 150** — the one residual is a documented harness-layer boundary, both engines right |
| `data/interaction-matrix.json` (carrier × reactor) | **1,027 / 1,031 — 99.6%**; the four are UNWIRED knobs (Shield Dust ×3, Steadfast ×1), not wrong arithmetic |
| `data/mechanics-census.json` | **208 / 211 live**, 3 missing with written reasons |

*(Those are a snapshot, and the census in particular moves — it read 202/211 four hours before this
was written and 208/211 when it was checked. That is the point rather than a caveat: the number
climbs because the instruments exist. Read it from the artifact, never from this table.)*

What made the difference is not stubbornness. **The differential harness and the interaction matrix
did not exist when ADR-001 was written.** Hand-fixing did not converge; *instrumented* fixing did.
ADR-001 was right about the engine it could see and wrong about the engine that could be built once
something was measuring it.

**2. The migration is technically impossible for the thing we now build.** ADR-001 accepted, openly,
that the official simulator is **117× slower** (29 vs 3,401 battles/sec/core) and that live browser
simulation would be lost. That cost was acceptable for a precomputed matchup table. It is not
survivable under MILTANK, which decides by playing positions out thousands of times per turn. You
cannot put a 117× slowdown beneath a rollout search. The project acquired a search player after
ADR-001 was written, and that changes what the runtime has to be.

**3. Nothing about this weakens the oracle.** Keeping MEDICHAM as the runtime does not promote it to
the authority. Every disagreement remains MEDICHAM's fault by construction.

## What we accept, and it is not small

**Conformance is proven only where we have looked.** The matrix stages **1,675 of a theoretical
8,676** carrier × reactor pairs. The honest claim is *"the engine agrees with the official engine on
the 1,675 pairs that ran"*, never *"the engine is correct"*. That coverage fraction **is** the answer
to how much of the law we actually follow, and raising it is the entire point of the coverage
programme (mutation → unified generator → registry → differential).

**The failure mode to watch is the quiet one.** When a differential row goes red there are two ways
to make it green: fix the engine, or fix the test. Both are sometimes correct — when the engine
learned crits the residual went 1/400 → 5/400 and the *harness* was wrong. Do that carelessly a few
times and the hand-written engine becomes the authority without anyone deciding. The standing guard:
**a flagged row is still counted in the residual.** Flagging never moves the number.

**The store is not public and the pin is a commit.** Both carried over from ADR-001 and both stand.

## Consequences

- `engine/medicham2-browser.js` stays a first-class, division-owned component. Its census may never fall.
- The precomputed matchup table is **not** built. ADR-001's steps 5–8 are formally withdrawn.
- `engine/champions_sim.js` stays the oracle, pinned by commit, resolved from a sibling checkout.
- Any claim about mechanics cites an instrument and its coverage, not the engine's self-report.
- **If the coverage programme stalls, this decision weakens.** The justification is the measured
  agreement above; it is not a licence, and it expires if the instruments stop being run.

## Sources

**Measured, from artifacts on disk 2026-08-05.** `data/engine-diff.json`,
`data/interaction-matrix.json`, `data/mechanics-census.json`. These are the figures this decision
rests on and each traces to a file.

**Quoted from ADR-001, not re-measured.** The 31.1-point win-probability disagreement, the
4.35-point hand-fix delta and the 117× simulator timing appear nowhere in the artifacts above and
must not be attributed to them. They are ADR-001's record of what was known in July, kept because a
decision reversal is only legible beside the evidence it reverses. If any of them matters again it
gets re-measured before it is quoted.

*(The doc-currency check flagged those three as figures a cited artifact does not contain. It was
right to. They are historical quotes sitting in a document that also cites live artifacts, and the
check cannot tell those apart from a paragraph — so the document says which is which instead.)*

## Revision, 3.43.0 — the matrix figures in this ADR moved, and the direction is uncomfortable

This ADR was written citing **1,514 of 8,506 pairs staged** and **899 / 899 — 100.0% agreement**. Both
are now superseded: **1,675 of 8,676 staged**, **1,027 / 1,031 — 99.6%**. Nothing about the decision
changes, but the record has to say which way the number went and why.

The matrix never checked its own arithmetic. Once `theoretical = staged + dropped` was asserted per
axis it failed immediately, on three separate faults (an understated denominator, a depth-cap
off-by-one, and outcome buckets that were not a partition — see `CHANGELOG.md` 3.43.0). Closing it
recovered 161 pairs the generator had been discarding without naming them, and among those pairs sit
four the engine gets wrong.

**So the 100.0% in the table above was an artefact of a denominator that dropped 5,090 pairs in
silence.** It is exactly the failure this ADR argues *against* — a conformance claim that reads as
proof and is really a statement about where nobody looked. A 99.6% that knows its own denominator is
the stronger evidence for keeping MEDICHAM, not weaker.
