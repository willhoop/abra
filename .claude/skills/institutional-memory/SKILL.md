---
name: institutional-memory
description: Capture what a session learned into the files a new session actually loads. Use at the end of a working session, when Will asks for a handoff or asks how to carry knowledge forward, or whenever a lesson was just paid for in real time. Sorts what was learned into state (never record), decisions (memory), operational rules (CLAUDE.md) and narrative (CHANGELOG + sprint notes).
---

# Institutional memory, not a handoff document

Will, 2026-08-21: **"so we create an institutional memory rather than copy pasting"**.

He is right, and the anti-handoff rule in `CLAUDE.md` is right too — they are not in conflict. The rule
says **do not put STATE in prose**, because state rots: fourteen `docs/HANDOFF-*.md` files exist and the
2026-08-04 one was wrong within a day. It does not say do not record. **Judgement does not rot.**

## The problem this exists to solve — measured, not assumed

```
CLAUDE.md                    ~550 lines    <- auto-loaded every session
memory/  (20+ files)                       <- auto-loaded every session
docs/MEDICHAM-SPRINT-NOTES  10,000+ lines  <- loaded by NOBODY
CHANGELOG.md                13,000+ lines  <- loaded by NOBODY
docs/ROADMAP.md              1,200+ lines  <- read on demand
```

On 2026-08-21 a session had written **14 sprint-note entries and 20 CHANGELOG versions** that day. Eight
of its operational lessons were checked against the two loaded files. **Zero of eight were present.**
Nothing had been lost — it had all been written into channels a new session never opens.

## The sort — four destinations, and most of what you learned goes nowhere

Work through what the session actually paid for and put each item in exactly one place.

**1. STATE -> nowhere. Do not write it down.**
Gate counts, divergence rates, census numbers, "N of M rows open". These rot in hours and a stale one is
worse than none. They are PRINTED:
```bash
node engine/status.js        # every figure read out of an artifact
node engine/open_work.js     # unclosed rows + defects an instrument measures
node engine/quarantine.js    # the gate
```
If a number must appear anywhere, stamp it with its commit and mark it *re-derive, do not quote*.

**2. A DECISION WILL MADE -> `memory/` as a `feedback` file.**
His words verbatim, the reason, and how to apply it. These are the most durable thing in the project and
the most expensive to relearn. Examples that already exist: MAG is rebuilt only after MEDICHAM; stop using
CHOMP data; the bar is state not protocol; the reach shelf stays at 25.

**3. AN OPERATIONAL RULE OR A DIAGNOSTIC PATTERN -> `CLAUDE.md` (rules) or `memory/` (patterns).**
A rule is something that changes how you RUN work — pin three things not one, never read an artifact
mid-write. A pattern is something that changes how you FIND things — an unwired knob gives identical
output, a green test can be asking nothing. Rules go in `CLAUDE.md` beside the section they extend;
patterns go in `memory/` as `reference` files so they arrive without bloating the always-loaded file.

**4. NARRATIVE AND EVIDENCE -> `CHANGELOG.md` + `docs/MEDICHAM-SPRINT-NOTES.md`.**
What changed, what it measured, what was retracted. This is the archive and it is correct that it is long.
It is not the handoff and must not be treated as one.

## The test for whether something belongs at all

**Would a fresh session make this mistake again tomorrow, and would the loaded files stop it?**

If yes to the first and no to the second, write it. If the mistake is already covered by an existing rule,
do NOT add a second copy — strengthen the one that is there. Two statements of one rule drift apart, which
is the failure this repo names against itself repeatedly.

## Before writing anything, check it is not already there

```bash
grep -ic "<the phrase>" CLAUDE.md
grep -ril "<the phrase>" ~/.claude/projects/C--Users-willj-Projects-Pokemon-ABRA/memory/
```
Zero hits is the licence to write. A hit means edit that file instead.

## Writing the memory file

One fact per file, kebab-case name matching the `name:` field, `type:` one of
`user | feedback | project | reference`. Quote Will verbatim where he said it — his words carry the
reason better than a paraphrase, and a paraphrase is what drifts. Link related files with `[[name]]`.
**Then add the one-line pointer to `MEMORY.md`**, or the file is written and never loaded — which is the
whole failure this skill exists to prevent.

## Then say what moved

Report which files gained what, and say plainly what you deliberately did NOT record and why. A capture
pass that claims to have saved everything is the same shape as a handoff that claims to be current.
