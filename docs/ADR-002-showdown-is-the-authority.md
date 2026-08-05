# ADR-002 — Showdown is the authority, MEDICHAM is the runtime

**Version 3.42.0 · 2026-08-05 · Status: ACCEPTED · Supersedes the migration half of
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
converged. Current state, from artifacts, not prose:

| instrument | agreement with the official engine |
|---|---|
| `data/engine-diff.json` (damage, seed 20260804) | **149 / 150** — the one residual is a documented harness-layer boundary, both engines right |
| `data/interaction-matrix.json` (carrier × reactor) | **899 / 899 — 100.0%**, zero disagreements |
| `data/mechanics-census.json` | **202 / 205 live**, 3 missing with written reasons |

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

**Conformance is proven only where we have looked.** The matrix stages **1,514 of a theoretical
8,506** carrier × reactor pairs. The honest claim is *"the engine agrees with the official engine on
the 1,514 pairs that ran"*, never *"the engine is correct"*. That coverage fraction **is** the answer
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

Every figure above is read from an artifact on disk on 2026-08-05: `data/engine-diff.json`,
`data/interaction-matrix.json`, `data/mechanics-census.json`. The 31.1-point disagreement, the
4.35-point hand-fix delta and the 117× timing are quoted from ADR-001 and are not re-measured here —
they are the record of what was known then, which is the point of keeping it.
