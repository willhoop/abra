# Eighteen rows that lied about their own status, repaired in notation only — 2026-09-04 (MEASURE)

Scope: `docs/ROADMAP.md` and this file. **Nothing else on disk was written except `data/open-work.json`,
which `node engine/open_work.js` rewrites as its job.** No engine byte moved, nothing that plays a game
ran, nothing heavy ran, `engine/register_reality.js` was not run in any mode, `engine/status.js` was not
run in any mode, and `engine/quarantine.js` was IMPORTED (for its exported detectors) and never edited.
`engine/board_state.js` and `engine/medicham2-browser.js` are held by a live ENGINE agent and were only
`grep`ped, never opened for edit. Nothing committed.

HEAD is `aa4aca01`.

---

## THE NUMBER

| | before | after |
|---|---|---|
| register rows | 506 | 506 |
| **OPEN** | **237** | **222** |
| **open AND asserting breakage** (what the gate counts) | **50** | **51** |
| rows carrying an unescaped pipe inside inline code | 96 | 90 |
| such pipes, in total | 653 | 631 |
| rows whose status cell is cut by one | 23 | 15 |
| `VERIFIED BY` markers the runner accepts | 123 | **123** |
| occurrences of `NOT A DEFECT` | 19 | **19** |

Both open readings are `node engine/open_work.js`. **Seventeen verdicts moved and every one is named
below; a whole-register diff against `git show HEAD:docs/ROADMAP.md` through the shipping detectors
confirms that no eighteenth row moved by accident.** Sixteen closed, one re-opened.

---

## 1. WHAT THE CLASS ACTUALLY IS — IT IS TWO DEFECTS, NOT ONE, AND THE SECOND IS THE BIGGER HALF

The brief named the pipe defect. Measuring the repair before applying it turned up a second, independent
producer of the same symptom in the same clause:

```js
if (/\|\s*(closed|done|page closed)\b[^|]*\|\s*$/i.test(l)) return true;
```

- **(A) THE PIPE HALF.** `roadmapRowStatusCell` captures after the last pipe, so a pipe inside a code span
  pushes the capture past the row's own status. Escaping as `\|` changes nothing — the capture is a
  negated-pipe character class. **Seven closures and one open row were hidden this way.**
- **(B) THE EMPHASIS HALF.** `\s*` does not skip `**`. A cell authored `| **CLOSED 2026-08-13** |` fails
  the clause outright, with no pipe involved anywhere in the row. **NINE rows read OPEN for this reason
  alone** — more than the pipe half produced.

Both were fixed the same way #531 was: **the notation was rewritten, the detector was not touched.**
`roadmapRowStatusCell` and `roadmapRowIsClosed` are byte-identical to HEAD.

---

## 2. THE PIPE HALF — nine rows, and one of them was pointed the dangerous way

| row | was | now | what the cut did |
|---|---|---|---|
| #167 | open | closed | `\|move\|p2b: whimsicott\|struggle…` in the trace quote |
| #170 | closed | closed | same quote; **no verdict moved** — the title already carried the closure |
| #172 | open | closed | same quote |
| **#175** | **closed** | **OPEN + asserting breakage** | see below |
| #196 | open | closed | not a pipe — a **trailing empty fourth column**, so the cell parsed to `""` |
| #282 | open | closed | `` `\|-start\|` `` |
| #293 | open | closed | `` `\|cant\|` `` |
| #294 | open | closed | `` `move\|spreadFoes` `` — **authored with the escape, and the escape does not work** |
| #465 | open | closed | `` `m._switchKey \|\| null` `` and `` `\|\| null` ``, plus a leading `**` |

Rewrites follow #531's convention exactly — `` `|-start|` `` became `` `-start` ``, the Struggle trace
became *a `move` line from `p2b: whimsicott` clicking `struggle` at `p1b: kingambit`*. Every claim is
preserved; the edit script refuses to write a cell that still contains a pipe.

### #175 IS THE ONE THAT MATTERS AND IT RUNS THE OTHER WAY

`#175` was reading **CLOSED** while its own cell begins `open — engine DEFECT`. Two pipes inside
`` `ab==='stalwart'||` `` split the cell in two, and the detector read the *appended* `CLOSED 2026-08-11 —
seven wired, one tossed` narrative as the row's whole verdict. **The row is 23 unconsumed tags; eight are
accounted for and the cell says "21 rows untouched because EACH IS A DECISION".** It has been invisible to
the open-defect clause. It now reads open and asserting breakage, which is the whole of the +1 in the gate
column. Nothing about the mechanics was investigated and nothing was claimed about them here.

---

## 3. THE EMPHASIS HALF — nine rows, closed by their authors and unreadable

`#254`, `#255`, `#256`, `#259` (2026-08-13/15), `#299`, `#302`, `#303`, `#304` (2026-08-18), `#308`
(2026-08-19). Each cell was `**CLOSED <date>**…`; each is now `CLOSED <date>…`. **Two characters per row,
no claim touched.**

---

## 4. WHAT I COULD AND COULD NOT VERIFY — READ THIS BEFORE TREATING ANY ROW AS CHECKED

**NOT ONE of the sixteen closures was re-run.** Every one carries, in its own cell, a dated sentence
saying the closure is the author's and was not re-verified by this pass, so a later reader cannot mistake
a parse repair for a verification. What was checked is only what a committed artifact could answer:

| row | cheap check that passed | what remains unverified |
|---|---|---|
| #167 | census `item/healsAtThreshold` *"Sitrus Berry heals when it drops below half"* **live**; `tests/test-tag-wire.js` on disk | the 10 FAIL → 0 FAIL was not re-run |
| #172 | census `move/spreadAll` *"Earthquake hits your own partner too"* and `move/spreadFoes` *"Rock Slide hits both foes…"* **live** | the fixture was not re-run |
| #196 | `data/million-run-staged.json` exists and holds **17 rows**, matching the closure's 17 staged fixtures | the 176,209-trial run was not repeated |
| #282 | `data/seed-source-audit.json` carries the `volatileDurationTable` and `basePowerCallbackClass` keys the closure names | `tests/test-seed-clock.js` §7 was not run |
| #293 | **both** probes named are live census rows with those exact labels | not re-run |
| #294 | the probe named is a live census row with that exact label | not re-run |
| #465 | `MEDI_PARTY_KEY_DISPLAY` present in `engine/board_state.js` at 4 sites | none of the published figures re-measured |
| #254, #255 | `tests/test-engine-diff.js` on disk | nothing else — **cell carries "closure not re-verified 2026-09-04"** |
| #256 | `tests/probe_red_demo.js` and `tests/test-engine-diff.js` on disk | as above |
| #259 | `moves.partingshot.params.pivotStatus` present in `data/tags.json` | as above |
| #299, #302 | `tests/test-middle-draw-scope.js` on disk, `--mid-carry-nth` arm at 7 sites | not run |
| #303 | `tests/test-middle-damage-roll.js` on disk, `--mid-damage-uninverted` arm at 5 sites | not run |
| #304 | `tests/test-damage-roll-support.js` on disk | as above |
| #308 | `tests/test-mechanics.js` and `engine/all_mechanics_fire.js` on disk | not run |
| #170 | n/a — no verdict moved | n/a |

**A file existing on disk is the weakest evidence in this table and is labelled as such in the rows that
rest on it.** It says the instrument the author cited is real; it says nothing about the row.

---

## 5. THREE ROWS THE BRIEF NAMED THAT ARE **NOT** THIS DEFECT — measured, not assumed

- **#122 has no pipe defect at all.** Its cell parses in full and reads `PART DONE 2026-08-10 — …`.
  The clause accepts `closed|done|page closed` at the cell's start; `PART DONE` is not `DONE`, and the row
  is a part-done row. **OPEN is the correct verdict.** Untouched.
- **#511 and #514 are not authored closures.** Their cells are cut, but the text under the cut is an open
  ENGINE filing (*"FILED 2026-08-27 BY ENGINE"*), not a closure. **OPEN is the correct verdict**, and
  repairing their notation would have moved nothing. Untouched.

---

## 6. THE 15 CUT ROWS LEFT ALONE, AND WHY THAT IS NOT LAZINESS

**90 rows still carry 631 unescaped pipes inside inline code. 15 of them still have a cut status cell.
Every one was checked, and NONE has a verdict at risk today:**

- **13 read closed and are closed** — `#321`, `#332`, `#497`, `#501`, `#502`, `#503`, `#506`, `#508`,
  `#510`, `#512`, `#517`, `#518`, `#519`. All but two sit in §5.6, which is a **two-column** table
  (`| # | item |`), so the "status cell" the detector reads is the whole narrative and the closure is
  carried by the prose fallback over the row's title.
- **2 read open and are open** — `#511`, `#514`.

Rewriting 631 pipes out of 90 long narratives for no verdict change is a diff nobody can review against a
benefit nobody can measure. **Reported and left.**

**The residual hazard is real and is stated rather than fixed:** in §5.6 those 13 rows are closed *only*
because their TITLE shouts `CLOSED`. A §5.6 row whose closure lives in the narrative tail and whose title
does not shout it will be hidden by exactly this defect again, silently. The durable fix is a check, not a
sweep — see OWED.

---

## 7. WHAT MOVED ON DISK

- `docs/ROADMAP.md` — **18 lines rewritten, 18 insertions / 18 deletions, no line added or removed.**
- `data/open-work.json` — rewritten by `node engine/open_work.js` doing its job; now reflects 222 open.
- This file.

`node tests/test-roadmap-register.js` is **GREEN** after the edit (3 passed, 0 failed, 509 items named).
`roadmapRowStatusCell` and `roadmapRowIsClosed` were not touched. No `VERIFIED BY` marker was added,
removed or reworded — the runner-visible count is **123 before and 123 after**. The string `NOT A DEFECT`
was not written; its 19 occurrences are HEAD's 19.

---

## OWED

1. **`node engine/status.js --write` was NOT run, deliberately, for the second pass running.** It computes
   through `engine/quarantine.js` and reads artifacts an ENGINE agent is writing right now; running it
   would take a torn read and then stamp the result into five division ledgers' generated blocks. It is
   owed once ENGINE's tree settles, by whoever holds it — and the register's open count has moved 237 →
   222 since the ledgers were last stamped.
2. **Sixteen rows are now closed on their authors' word and NOT on a re-run.** Each says so in its own
   cell, dated. The four weakest are `#254`, `#255`, `#256` and `#304`, whose only support is that the
   instrument named exists on disk. If any of them matters to a decision, run its instrument first.
3. **#175 is open again and asserts breakage, and nobody has looked at it since 2026-08-11.** It is 21
   derived tags with no consumer, each of which its own cell says is a DECISION rather than a batch. It is
   now in the gate's debt bucket; it was not there yesterday, and that is a correction, not a regression.
4. **NOTHING PREVENTS THE NEXT ROW DOING THIS.** Both halves are still authorable: a pipe in a code span
   at the end of a cell, and a `**` at the start of one. The cheap durable guard is a register check that
   compares each row's parsed cell against its authored final column and fails on a mismatch — it costs no
   run, reads no artifact, and would have caught all eighteen of these on the day they were written. It is
   NOT written here because `tests/test-roadmap-register.js` is not mine to extend tonight without saying
   so first.
5. **The two-column §5.6 shape is a standing trap.** In it the "status cell" is the entire item narrative,
   so `roadmapRowSaysBroken` fires on the word `DEFECT` anywhere in the row and the closure clause can only
   ever be satisfied by prose. It works today by luck of authoring convention.
