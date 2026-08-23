---
name: finish
description: Finish an ABRA session cleanly and make the next one start better. Use when Will says "finish", "wrap up", "done for now", "end the session", or when work is stopping for the day. Stops agents, lands verified work, records what is OWED, and feeds this session's surprises back into the start skill.
---

# Finish the session by LEAVING NOTHING HALF-DONE, then improve the start

A session ends well when the next one can begin from a printed state and no landmines. Seven steps, in
order. **Step 6 is the one that compounds** — it is why this skill exists rather than just "commit and
push".

---

## 1. Stop the work, then prove it stopped

```bash
# stop every running agent first, then:
```
```powershell
Get-Process node -ErrorAction SilentlyContinue | Sort-Object WorkingSet64 -Descending |
  Select-Object -First 8 Id, @{n='RAM_MB';e={[math]::Round($_.WorkingSet64/1MB)}}
```

**Killing an agent does not always kill what it started.** Anything above ~200 MB is a live heavy run,
not the harness. A stopped chain that is still holding cores is the difference between "the machine is
free" and Will force-quitting you.

## 2. Look for a half-applied edit — this is the landmine step

A killed agent leaves the tree mid-change, and **the file will still load**: JavaScript does not resolve
a call until it runs. One session found 26 call sites to a function that was never written; the engine
loaded fine and would have thrown on the first faint of any battle.

```bash
git status --short
git diff --stat engine/ tests/
```

For every dirty engine or test file with no owning agent still alive: **read the diff.** If it is
coherent and verified, land it. If it is mid-edit, **revert it** — `git checkout HEAD -- <file>` — and
say so in the report, because the agent's transcript can redo the work cheaply and a landmine cannot be
found cheaply later.

## 3. Land what is verified, and only what is verified

- **THE COMMIT BODY IS THE HANDOFF, SO WRITE IT LIKE ONE.** `/start` §2 reads full bodies — never
  `--oneline` — because a subject reads like a complete answer and stopping there cost one session
  **two wrong statements to Will in a single hour**. The body is already durable, already dated and
  already read, which makes it the highest-value place a lesson can land: nobody has to remember to
  look. So each commit body states what was shown RED first, what the control ruled out, what was
  fixed, **what was deliberately NOT fixed**, and what could not be published and why. A subject
  alone is a write-only commit.
- **Stage precisely.** Never `git add -A` while any agent is alive; it sweeps their in-progress files
  into your commit.
- Each landing needs its CHANGELOG entry, its version bump, and — while the MEDICHAM sprint is active —
  a row in `docs/MEDICHAM-SPRINT-NOTES.md`, or the pre-commit hook will refuse it. **Read what the hook
  says rather than retrying**; it names the failing clause.
- **Never pass `--no-verify`.** If the gate is wrong, fix the gate and say so.
- Write CHANGELOG entries and sprint notes with a **script file, not an inline shell string**.
  Backticks in a double-quoted bash string get command-substituted and will eat the code identifiers out
  of your prose. **Make the script idempotent** — refuse if its own marker is already present. A re-run
  once duplicated 46 lines of a ledger silently.
- Then `git pull --rebase` and `git push`. The hourly ingest pushes on its own, so expect to rebase.
- **A rebase needs a clean tree.** If agents are still mid-edit, commit yours and say "written locally,
  not yet pushed" rather than stashing files another process is writing.

## 4. Record what is OWED, as commands

Anything measured-but-not-re-run, deferred, or blocked goes into the CHANGELOG as **exact commands**,
not prose. A light-mode agent's own `OWED, NOT RUN` block is already in this form — carry it verbatim.

**AND IT MUST STAY IN THE AGENT'S `docs/_reports/` FILE UNDER A HEADING CONTAINING THE WORD `OWED`,
because that is the copy the next session actually reads.** `engine/orient.js` scans every report,
collects those blocks as COMMANDS, and prints them under IN FLIGHT in `/start` §0 — newest first,
with the file's age. **That is the join that makes ending a session cheap**, and it is mechanical:
nobody has to remember to go and look. The generator also prints how many reports carry no OWED
heading at all, so an agent that skipped one is visible as a number rather than as silence.

The CHANGELOG copy is the durable record; the report copy is what gets picked up. **Write both.**

**A measurement left half-run is worse than one not started**, because the artifact on disk looks
finished. If a chain was killed mid-way, say which stages wrote and which did not.

## 5. Say what is red, out loud

`KNOWN FAILURE` is a banned phrase. Every red test is either **fixed in the session that saw it** or
**waived by Will, by name**. There is no third state.

So the closing report must name every red — including ones inherited, ones another division owns, and
ones a gate would go red on if it were wired in. **Naming it is the minimum the rule allows.** A red
carried under a new label is the normalisation that has cost this project two days twice.

## 6. FEED THIS SESSION'S SURPRISES BACK INTO `/start`

*(Will, 2026-08-23: "i want to keep refining the start command to make it better and better.")*

**This is the step that makes the next session cheaper, and it is the reason this skill is not just
`commit && push`.** Ask one question of the session:

> **What did I believe at the start of today that turned out to be false — and what would have told me
> sooner?**

Then put it where it will actually be read:

**THIS TABLE IS THE SHARED CONTRACT BETWEEN THE TWO SKILLS, AND IT LIVES HERE ONLY.** `/finish`
decides WHERE a lesson goes using it; `/start` §9 states the standard entries are held to and points
back here rather than repeating the table. Two copies of one rule drift apart — that failure is named
throughout this repo. **Ranked: prefer a destination `/start` already DERIVES over one it has to
read.**

| The lesson is about… | It goes in |
|---|---|
| **a NUMBER, a count, a current state** | **NOWHERE. It gets PRINTED.** Writing it into a document is the bug — `status.js` and `open_work.js` compute it |
| **something DERIVABLE from code or the filesystem** | **`engine/orient.js`**, so it updates itself and no session has to maintain it. A new division, a new model, a new play-layer entrypoint — all of these should appear with no edit |
| a FAILURE SHAPE — an instrument lying, a check that cannot fail, a number that is not what it says | `.claude/skills/start/SKILL.md` §7, one line with its receipt |
| **a SOURCE you did not know existed** — a command, an artifact field, an authority `file:line`, a convention | **`.claude/skills/start/SKILL.md` §8** |
| how to RUN or ROUTE the work — pins, batching, concurrency, briefs | `.claude/skills/start/SKILL.md` §5 |
| an operating rule with teeth | `CLAUDE.md`, and only if it is a RULE rather than a state |
| what Will decided, and why | `CLAUDE.md` if it changes what a gate MEANS; `memory/` if it is a preference |
| what happened | `CHANGELOG.md` + `docs/MEDICHAM-SPRINT-NOTES.md` |
| a defect | `docs/ROADMAP.md`, via the register |

**§8 IS THE ONE THAT PAYS BACK FASTEST, SO BE GREEDY ABOUT IT.** Every hour this project loses to
re-discovery is an hour spent finding something that was already there. Ask specifically:

> **What did I have to go and find today that I did not know existed at the start?**

That includes every `sim/*.ts` line you opened to settle a mechanic, every artifact field you had to
learn was buried in a JSON blob, every env knob, every command with a mode you did not know it had.
**Write what QUESTION each answers, never the answer** — an answer rots, a pointer does not. Anchors
into the Showdown checkout carry a "verify the line" caveat, because that tree moves too.

**Rules for what you add to §7:**
- **One line, with the receipt.** "A regex held two raw `0x08` bytes so one alternative could never
  match" beats a paragraph about escaping.
- **Only what SURPRISED you.** A confirmed expectation teaches nothing and dilutes the section, and a
  section people skim is a section that stops working (#148).
- **Never add project STATE.** No counts, no gate clauses, no "the census is at N". Those rot exactly
  like the fourteen handoffs; `status.js` prints them. §7 is about shapes, not numbers.
- **If an existing line is now wrong, fix it in place and say so** — the same rule the CHANGELOG has.

The `institutional-memory` skill covers the wider sort (state vs decisions vs rules vs narrative). Use
it when the session produced something bigger than a §7 line.

## 7. Close with a state print, not a summary from memory

```bash
node engine/status.js
git log --oneline -5
git status
```

Report:
1. **Where the gate stands**, by kind (unmeasured / broken / debt) — not just the count.
2. **What landed**, naming mechanics rather than register numbers.
3. **What is OWED**, as commands.
4. **What is red and unwaived.**
5. **What you changed in `/start`**, so Will can see the loop working.

**If a figure moved today, the number in this report must come from the artifact, not from what an
agent told you earlier in the session.** Four of six briefed figures went stale inside two hours once.
Re-read, then report.
