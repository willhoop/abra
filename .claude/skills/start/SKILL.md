---
name: start
description: Start an ABRA session. Prints the real state, the open work and what is red, then says what to pick up next. Use at the beginning of any ABRA session, or whenever Will says "start", "where are we", "what's the state", "catch me up", or opens a new session on this project.
---

# Start the session by PRINTING the state, never by reading prose

## 1. Check the tree FIRST, because step 2 writes to it

```bash
git status                     # must be clean, and NO rebase in progress
```

**Do this before `status.js`, not after.** `status.js` rewrites `data/provenance-stamp.json` (a
timestamp, every run) and `open_work.js` rewrites `data/open-work.json`. Run them first and the
clean-tree check is polluted by this skill's own commands — you then cannot tell your own noise from
work someone left half-finished. When those two files show up modified later in the session, they are
yours; say so rather than committing them as if they were a result.

If a rebase is in progress, **finish it** (`git rebase --continue`). Never `git checkout` away from
one — that abandons every commit already replayed.

## 2. Print the state

```bash
node engine/status.js
node engine/open_work.js
git log --oneline -8
ls docs/_reports/ | tail -5    # what the last sessions found
```

`status.js` is the project's state — the MEDICHAM gate clause by clause, the census, provenance, and
every figure that is WITHHELD because the artifact under it is stale or downstream of a broken engine.
`open_work.js` is every unclosed register row plus every defect a live instrument is measuring, and it
prints **UNREGISTERED** — a defect something measures with no roadmap row — because a register cannot
audit itself.

**Every number in both is read out of an artifact.** `NOT DERIVED` means no artifact says it.

These two cost about 6k tokens and pay for themselves. **They are also the whole budget for finding
out where you are.** Do not then go reading engine files, artifacts or reports to enrich the picture —
that is the coordinator doing a division's job, and it is what actually destroys a session's context.
If the print leaves a question open, that question is a brief.

## 3. Read the gate: a FAILING clause is not the same as a BROKEN engine

This is the first thing to work out, before saying anything, because it decides the whole session.
A gate clause fails in two completely different ways and `status.js` words them differently on purpose:

| The clause says | What it means | What it costs to clear |
|---|---|---|
| `MEASURED AGAINST A DIFFERENT ENGINE — this artifact ran on release X and the tree is Y` | **Nothing is known.** The engine moved after the measurement. This is not evidence of breakage in either direction. | A re-run. No fix. |
| a named instrument is RED, or a roadmap row asserts breakage with an instrument that decides it | **Something is actually wrong**, and the row names it. | A fix. |
| a row asserts breakage with **no** instrument that decides it | DEBT, not evidence. It does not hold the clause shut. | A `VERIFIED BY` line naming a gate. |

Count them separately and lead with the split. On 2026-08-22 six of eight clauses failed and **five of
the six were the first row** — the roster's three stages, the whole-game differential and the mechanics
census had all been measured before an overnight engine change. Reporting "six of eight failing" without
that split would have described a broken simulator when the true state was an unmeasured one.

The same distinction governs `PASS`: a passing clause measured against an old release is not passing.
Check the release id against the tree id before you quote a green.

## 4. What NOT to do

- **Do not do the work yourself.** See §5 — this is the one the skill kept failing at.
- **Do not read a `docs/HANDOFF-*.md`.** There are fourteen, each typed by hand at the end of a
  session, each stale within a day. They are history.
- **Do not type a list of what is open.** Print it. A typed list has twice quoted work that was
  already closed.
- **Do not quote a QUARANTINED figure**, even with a caveat. A caption is not a quarantine — that
  exact mistake kept PRE-CHANGE numbers in circulation for days.
- **Do not take a number from a `docs/_reports/` file as current state.** Those are dated findings
  records, superseded by the register rows they feed.
- **Do not commit the artifacts §2 rewrote** as though they were an outcome.

## 5. ROUTE IT. THE COORDINATOR PRINTS THE STATE AND THEN HANDS OUT BRIEFS.

*(Will, 2026-08-22, on the first session that ran this skill: **"ur delegating right?"** — and no, it
wasn't. It had cut a release, pinned a census and checked the frozen pool inline, and was one command
away from running a five-stage measurement chain itself. This skill was written in the same commit that
added the coordinator-is-the-bottleneck section to CLAUDE.md and it still did not prevent that, because
its only operational instruction was **how to run a heavy job**, which is an instruction a coordinator
follows by running it.)*

**Everything after the state print is a brief, not a task.** One question routes it: *which artifact
does fixing this invalidate?* — the table is in CLAUDE.md, the map is `docs/DIVISIONS.md`.

Every brief must say: **write the full account to `docs/_reports/<YYYY-MM-DD>-<topic>.md` and return a
verdict of a few lines plus that path.** And it must carry the operating rules the agent needs, because
the agent cannot see what it was dispatched alongside:

- **Heavy runs go through the wrapper**, at BelowNormal, with **repo-relative paths**:
  `cmd /c tools\lownode.cmd engine\quarantine.js`
  An absolute Windows path splits on its drive colon crossing the Bash→cmd boundary, and `start`
  mis-parses a quoted argument containing spaces. Several agents have been caught by both.
- **A measurement pins three things, not one** — `--release <id>`, `--census <pinfile>`,
  `--team-store data/team-pool-frozen`. Cut the release once, up front, and hand the SAME id to every
  agent; a driver that is not given one cuts its own over the live tree.
- **Name the artifacts each agent writes, and forbid the others from reading them.** A torn read is a
  plausible, well-formed, fictitious answer. `git show HEAD:<file>` is the stable read.
- **An agent re-measuring the tree must not also fix it.** Landing a change mid-chain re-stales
  everything it just measured. Findings get written down and left for the next brief.
- **Instrument order is a data dependency.** `all_mechanics_fire.js` reads the roster artifacts and
  drives `game_differential.js`, so the roster's three stages run first, then the differential, then the
  census — sequentially, never concurrently.

**Verify what comes back.** Agents are wrong often enough to matter, and verifying a claim is cheap
while producing it is not. That is the step that may not be compressed.

## 6. Reporting back

Lead with where the gate stands and **what kind** of failure is holding it (§3), then the shortest
honest answer to "what should we do next". Will does not address subagents and should never be asked to
pick one — route it yourself and report **one answer**, not a transcript.

Say what you deliberately did NOT dispatch and why. Work held back for a reason reads as work forgotten
unless you name it.

If the news is bad, give it plainly. Softening a result is the failure this whole structure exists to
prevent.
