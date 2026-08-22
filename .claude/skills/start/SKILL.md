---
name: start
description: Start an ABRA session. Prints the real state, the open work and what is red, then says what to pick up next. Use at the beginning of any ABRA session, or whenever Will says "start", "where are we", "what's the state", "catch me up", or opens a new session on this project.
---

# Start the session by PRINTING the state, never by reading prose

Six steps, in order. The order is load-bearing twice: step 1 must precede step 2 because step 2
writes, and step 5 must precede any real work because the coordinator's job is to route it.

---

## 1. Check the tree FIRST, because step 2 writes to it

```bash
git status                     # must be clean, and NO rebase in progress
ls docs/_inbox/                # Cowork drafts waiting to be applied
```

**`git status` goes before `status.js`, not after.** `status.js` rewrites
`data/provenance-stamp.json` (a timestamp, every run) and `open_work.js` rewrites
`data/open-work.json`. Run them first and the clean-tree check is polluted by this skill's own
commands — you then cannot tell your own noise from work someone left half-finished. When those two
files show up modified later, they are yours; say so rather than committing them as a result.

If a rebase is in progress, **finish it** (`git rebase --continue`). Never `git checkout` away from
one — that abandons every commit already replayed.

Anything in `docs/_inbox/` beyond `.gitkeep` and `applied/` is Cowork work waiting on you. Say it is
there. Do not apply it unless Will says "apply inbox", and treat any figure in it that is not
`<<MEASURED>>` as suspect — Cowork never authors a number.

## 2. Print the state

```bash
node engine/status.js
node engine/open_work.js
git log --oneline -8
ls docs/_reports/ | tail -5
```

`status.js` is the project's state — the MEDICHAM gate clause by clause, the census, provenance, and
every figure WITHHELD because the artifact under it is stale or downstream of a broken engine.
`open_work.js` is every unclosed register row plus every defect a live instrument is measuring, and it
prints **UNREGISTERED** — a defect something measures with no roadmap row — because a register cannot
audit itself. **Every number in both is read out of an artifact.** `NOT DERIVED` means no artifact
says it.

The commit subjects in this repo are full sentences stating a finding. Eight of them are the last
sessions' conclusions, and they are worth more than any document.

**This is the entire budget for finding out where you are.** Do not go reading engine files,
artifacts or reports to enrich the picture — that is the coordinator doing a division's job, and it is
what actually destroys a session's context. If a `docs/_reports/` file looks relevant, read its
`## VERDICT IN ONE PARAGRAPH` block and nothing else. If the print leaves a question open, that
question is a brief.

**If a command here errors or has been renamed, fix this skill in the session that saw it.** A start
procedure that no longer runs is the fourteen handoffs again.

## 3. Read the gate: a FAILING clause is not the same as a BROKEN engine

Work this out before saying anything. It decides the whole session, and `status.js` words the kinds
differently on purpose:

| The clause says | What it means | What clears it |
|---|---|---|
| `MEASURED AGAINST A DIFFERENT ENGINE — this artifact ran on release X and the tree is Y` | **Nothing is known.** The engine moved after the measurement. Not evidence of breakage in either direction. | A re-run. No fix. |
| a named instrument is RED, or a row asserts breakage with an instrument that decides it | **Something is actually wrong**, and the row names it. | A fix. |
| a row asserts breakage with **no** instrument that decides it | DEBT, not evidence. It does not hold the clause shut. | A `VERIFIED BY` line naming a gate. |

Count them separately and lead with the split. On 2026-08-22 six of eight clauses failed and **five of
the six were the first row** — the roster's three stages, the whole-game differential and the mechanics
census had all been measured before an overnight engine change. Reporting "six of eight failing"
without that split would have described a broken simulator when the true state was an unmeasured one.

The same test governs green: **a PASS measured against an old release is not a pass.** Check the
release id against the tree id before quoting one.

## 4. What NOT to do

- **Do not do the work yourself.** See §5. This is the one this skill kept failing at.
- **Do not read a `docs/HANDOFF-*.md`.** Fourteen of them, each typed by hand, each stale within a
  day. History.
- **Do not type a list of what is open.** Print it. A typed list has twice quoted work already closed.
- **Do not quote a QUARANTINED figure**, even with a caveat. A caption is not a quarantine — that
  exact mistake kept PRE-CHANGE numbers in circulation for days.
- **Do not take a number from a `docs/_reports/` file as current state.** Dated findings records,
  superseded by the register rows they feed.
- **Do not commit the artifacts §2 rewrote** as though they were an outcome.

## 5. ROUTE IT. THE COORDINATOR PRINTS THE STATE AND THEN HANDS OUT BRIEFS.

*(Will, 2026-08-22, on the first session that ran this skill: "ur delegating right?" — and it was not.
It had cut a release, pinned a census and checked the frozen pool inline, and was one command from
running a five-stage measurement chain itself. This skill was written in the same commit that added the
coordinator-is-the-bottleneck section to CLAUDE.md and still did not prevent it, because its only
operational section was **how to run a heavy job** — an instruction a coordinator follows by running
the thing.)*

**Everything after the state print is a brief, not a task.** One question routes it: *which artifact
does fixing this invalidate?* The table is in CLAUDE.md, the map is `docs/DIVISIONS.md`.

**DERIVE THE FACTS THE BRIEF NEEDS. DO NOT TRUST THIS FILE FOR THEM** — it is prose, and prose rots
here:

```bash
node engine/where.js --artifacts    # every artifact and who writes it -> what may run beside what
node engine/where.js --gates        # every instrument the register names -> what decides a claim
node engine/where.js <thing>        # which file owns this fact, which test would catch it
```

Instrument ordering is a data dependency and must be read off `--artifacts`, never recalled. On
2026-08-22 the roster's three stages had to finish before `all_mechanics_fire.js`, which reads their
artifacts and drives `game_differential.js`. That sentence will be wrong eventually. The command will not.

Every brief must carry:

- **The report contract.** Write the full account to `docs/_reports/<YYYY-MM-DD>-<topic>.md` and
  return a verdict of a few lines plus that path. The verdict carries what routes the next decision.
- **The wrapper, at BelowNormal, with repo-relative paths.**
  `cmd /c tools\lownode.cmd engine\quarantine.js`
  An absolute Windows path splits on its drive colon crossing the Bash-to-cmd boundary, and `start`
  mis-parses a quoted argument containing spaces. Several agents have been caught by both.
- **All three pins, when it measures** — `--release <id>`, `--census <pinfile>`,
  `--team-store data/team-pool-frozen`. Cut the release ONCE, up front, and hand the same id to every
  agent; a driver given none cuts its own over the live tree.
- **The artifacts it writes, and a ban on the others reading them.** A torn read is a plausible,
  well-formed, fictitious answer. `git show HEAD:<file>` is the stable read.
- **No fixing while measuring.** An agent re-measuring the tree must not also change it; landing a fix
  mid-chain re-stales everything it just measured. Findings get written down and left.

**Concurrency: one heavy chain at a time, and it serialises INSIDE one agent.** Several agents at once
is the point of the divisions and is not the hazard — two agents each pinning 16 cores and loading the
30 MB store is. Pair a heavy agent with light ones.

**Verify what comes back.** Agents are wrong often enough to matter, and verifying a claim is cheap
while producing it is not. That step may not be compressed.

**If nothing is red**, the session is not over — it is the only time the register's own ordering is the
answer. `open_work.js` prints it by phase; take the top of the current phase, and say plainly that the
gate is open, because that has not been true yet.

## 6. Reporting back — the contract

One answer, not a transcript. Will does not address subagents and should never be asked to pick one.

1. **Where the gate stands, and what KIND of failure holds it** (§3). The split, not the count.
2. **What is genuinely red — name the mechanic, never the row number.** *(Will: "i have no idea what
   they mean".)* Say "Fur Coat carries no defence multiplier, so we deal double physical damage
   through it", not the register index. The number belongs in the brief, not in the sentence he reads.
3. **What you dispatched**, one line each.
4. **What you deliberately did NOT dispatch, and why.** Work held back for a reason reads as work
   forgotten unless it is named.

If the news is bad, give it plainly. Softening a result is the failure this whole structure exists to
prevent.
