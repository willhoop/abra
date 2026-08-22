---
name: start
description: Start an ABRA session. Prints the real state, the open work and what is red, then says what to pick up next. Use at the beginning of any ABRA session, or whenever Will says "start", "where are we", "what's the state", "catch me up", or opens a new session on this project.
---

# Start the session by PRINTING the state, never by reading prose

Run these three, in this order, and read the output before saying anything:

```bash
node engine/status.js
node engine/open_work.js
git log --oneline -8
```

`status.js` is the project's state — the MEDICHAM gate clause by clause, the census, provenance, and
every figure that is WITHHELD because the artifact under it is stale or downstream of a broken engine.
`open_work.js` is every unclosed register row plus every defect a live instrument is measuring, and it
prints **UNREGISTERED** — a defect something measures with no roadmap row — because a register cannot
audit itself.

**Every number in both is read out of an artifact.** `NOT DERIVED` means no artifact says it.

## Then, before touching anything

```bash
git status                     # must be clean, and NO rebase in progress
ls docs/_reports/ | tail -5    # what the last sessions found
```

If a rebase is in progress, **finish it** (`git rebase --continue`). Never `git checkout` away from
one — that abandons every commit already replayed.

## What NOT to do

- **Do not read a `docs/HANDOFF-*.md`.** There are fourteen, each typed by hand at the end of a
  session, each stale within a day. They are history.
- **Do not type a list of what is open.** Print it. A typed list has twice quoted work that was
  already closed.
- **Do not quote a QUARANTINED figure**, even with a caveat. A caption is not a quarantine — that
  exact mistake kept PRE-CHANGE numbers in circulation for days.
- **Do not take a number from a `docs/_reports/` file as current state.** Those are dated findings
  records, superseded by the register rows they feed.

## Reporting back

Lead with where the gate stands and what is actually blocking it, then the shortest honest answer to
"what should we do next". Will does not address subagents and should never be asked to pick one —
route it yourself (`docs/DIVISIONS.md`), and report **one answer**, not a transcript.

If the news is bad, give it plainly. Softening a result is the failure this whole structure exists to
prevent.

## Running anything heavy

Through the wrapper, at BelowNormal priority, with **repo-relative paths**:

```bash
cmd /c tools\lownode.cmd engine\quarantine.js
```

An absolute Windows path splits on its drive colon crossing the Bash→cmd boundary, and `start`
mis-parses a quoted argument containing spaces. Several agents have been caught by both.
