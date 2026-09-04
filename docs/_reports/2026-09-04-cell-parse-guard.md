# The guard for the cell-parse class: a property, red on seven doors and on the real register — 2026-09-04 (MEASURE)

Scope: **one new file, `tests/test-register-cell-parse.js`, and this report. Nothing else on disk was
written.** `docs/ROADMAP.md` was READ ONLY — it is byte-identical to what the repair pass left (18
insertions / 18 deletions against HEAD, none of them mine). `engine/quarantine.js` and
`tests/run-all.js` are **byte-identical to HEAD** (`git diff --stat HEAD` returns nothing for either);
`roadmapRowStatusCell` and `roadmapRowIsClosed` were IMPORTED and never edited. Nothing that plays a
game ran, nothing heavy ran, `engine/status.js` and `engine/register_reality.js` were not run in any
mode, and nothing was committed. `engine/medicham2-browser.js` and `engine/board_state.js` are held by
a live ENGINE agent and were not opened.

HEAD is `8519e071`. `docs/ROADMAP.md` last changed at **18:45:03**; every measurement below was taken
between 18:50 and 19:09 against a file that had been settled for 24 minutes, so no reading here is torn.

---

## THE ANSWER, IN THE THREE THINGS THAT WERE ASKED

| | |
|---|---|
| **property or enumeration** | **PROPERTY.** One invariant per row, with one stated limit (below). No list of defeating forms appears anywhere in the check. |
| **what it finds on the current register** | **GREEN on verdicts — 0 of 506 rows.** 15 cut-but-harmless cells reported by name, 4 rows reported as not readable, 2 with an empty status cell. |
| **wired?** | **YES, by its name.** `tests/run-all.js` globs `tests/test-*.js`; `--list` goes 156 → 157 and prints `RUN tests/test-register-cell-parse.js`. It is NOT in `GATES` and must not be — that list exists for checks living in `engine/` "because other tooling imports them, so they cannot be found by globbing tests/". 0.17s, byte-identical output on repeat runs, writes no file. |

---

## 1. THE PROPERTY

> For every register row, the **gate-visible verdict** must be the same whether the row's status cell
> is read as the shipping detector reads it, or read as the column the author wrote and then rendered
> to plain text.

Two independent halves, neither of which names a defeating form:

- **WHICH TEXT IS THE STATUS CELL.** READ-A is the shipping `roadmapRowStatusCell`. READ-B is the text
  between the last two pipes that are actually column delimiters — not backslash-escaped, not inside an
  inline code span. Any non-delimiter pipe, arriving through any door, makes the two disagree.
- **WHAT THAT TEXT SAYS.** The cell is rendered by a general Markdown-inline renderer — code fences,
  links, reference links, footnote markers, inline HTML, emphasis runs, backslash escapes — and the
  detectors are asked again. Any decoration that hides a verdict word is caught.

**The gate-visible verdict is a pair**, `isClosed` and `!isClosed && saysBroken`, composed exactly as
`openDefectClause` composes them: it `continue`s past a closed row before it ever asks about breakage.
Comparing the pair rather than the two detectors separately is what keeps the check off **#502** — a
closed §5.6 row whose `saysBroken` flag genuinely differs between the two readings and is consulted by
nobody — **without carving out an exception anyone could argue their row into.**

**The honest limit, stated rather than dressed up:** the renderer knows Markdown inline syntax. A
verdict word hidden behind something that is not Markdown — an HTML entity, a Unicode look-alike — is
outside what this can see. It is a property of Markdown notation, not of all possible notation.

**Will's test — a third habit, spelled differently, through another door.** Four of the seven red arms
are doors nobody in this register has used yet: a **link** at the cell head, an **inline HTML tag**, the
whole status wrapped in a **code span**, and a **backslash-escaped pipe**. None required an edit to the
check.

---

## 2. SHOWN RED FIRST — TWICE, AND THE SECOND TIME ON REAL DATA

### 2.1 Seven synthetic doors, each with a repaired twin

Every red arm asserts the check reports **exactly one** finding and **names the row number**. Every red
arm has a twin carrying the same claim written unambiguously, which must go quiet — a knob-cleared
control, so the finding is attributable to the defect and not to the row.

| door | gate reads | the row states |
|---|---|---|
| unescaped pipe inside inline code (#531 shape) | `false/false` | `true/false` |
| **backslash-escaped pipe (#294 shape) — escaping does not fix it** | `false/false` | `true/false` |
| emphasis at the cell head (#254 shape) | `false/false` | `true/false` |
| **a link at the cell head** | `false/false` | `true/false` |
| **the status wrapped in a code span** | `false/false` | `true/false` |
| **an inline HTML tag at the cell head** | `false/false` | `true/false` |
| **the dangerous direction (#175 shape)** — a live DEFECT claim read as not-broken | `false/false` | `false/true` |

The synthetic filler is >600 characters on purpose: both detectors fall back to a prose scan over the
row HEAD, so a synthetic short enough to fit inside that window is decided by the fallback and tests
nothing. **The filler's neutrality is asserted, not assumed** — the first arm fails if a padded row
with a plain status does not read `false/false`.

### 2.2 The check cannot go green by asking nothing

Three arms exist for this:

- a **mixed corpus** of all 7 violations plus 3 clean rows must report exactly 7 and none of the 3.
  Deleting the comparison makes this fail by name, in the shape `tests/test-counter-init.js` uses.
- three **controls** must stay quiet: a clean closed row, a clean open+DEFECT row, and a row with a
  pipe in its cell whose verdict is the same either way (reported as cut, not failed).
- the **lift arm** asserts the lifted reader both reads a clean row AND still cuts on a pipe. If the
  shipping reader were ever made robust, this check would become a tautology — the arm says so by name
  instead of passing silently.

### 2.3 Red on the register as it actually stood

```
git show 8519e071:docs/ROADMAP.md > /tmp/roadmap-pre-repair.md
node tests/test-register-cell-parse.js --register /tmp/roadmap-pre-repair.md
```

**exit 1, 15 rows named**: #167, #172, #254, #255, #256, #259, #282, #293, #294, #299, #302, #303, #304, #308,
#465. That is the repair pass's own list, reproduced by an instrument that had not seen it. The other
three rows it moved are reported rather than failed and are named in the output: **#175** under NOT
READABLE (with reading A printed as `open — engine DEFECT` beside a gate reading of `true`), **#196**
under EMPTY STATUS CELL, and **#170**, which moved no verdict.

The `--register` flag exists precisely so that this demonstration is a command anyone can re-run,
rather than a sentence in a report.

---

## 3. WHAT IT FINDS ON THE CURRENT REGISTER

```
506 register rows
  0 with a GATE-VISIBLE VERDICT that depends on the parse   <- fails
 15 with a cut status cell and the same verdict either way  <- reported
  4 whose inline-code delimiters do not pair                <- reported
  2 with an empty status cell                               <- reported
```

- **The 15 cut cells** are exactly the 15 the repair pass reported and deliberately left: #321, #332,
  #497, #501, #502, #503, #506, #508, #510, #511, #512, #514, #517, #518, #519. **Two instruments, two
  methods, the same fifteen.**
- **The 4 not-readable rows** are #166, #332, #517, #519.
- **The 2 empty status cells** are #6 and #30. This category would have named **#196**, whose cell
  parsed to `""` against an authored `closed — measure` — the one member of the class that the cut
  clause cannot see, because its authored cell is empty too.

### Why "cut but the verdict is unchanged" REPORTS rather than FAILS

Three reasons, in order of weight:

1. **The verdict clause already covers every cut that has a consequence.** A cut with no consequence is
   a latent hazard, and a gate that fires on latent hazards is the over-firing gate #148 warns about —
   the one people learn to ignore.
2. **Failing here would force a diff nobody can review.** 90 rows still carry 631 non-delimiter pipes.
   Rewriting them for no verdict change is exactly the trade the repair pass declined, and the only
   other way out would be a waiver — which is the "known failure" filing this repo bans.
3. **It is not a ratchet.** There is no count anyone must keep below a number. Every cut row is printed
   by name on every run, so the list can grow or shrink without anybody arguing their row is special.

### Why a stability test exists, and why it is not an escape hatch

A row whose backtick runs do not pair has **no recoverable cell structure** — one stray backtick
re-pairs every span after it. **#332 is one, and it is the reason this arm exists rather than a reason
invented after the fact:** its title carries a corrupt `AND\|upkeep` fragment, and reading the row two
defensible ways yields two different cells with opposite verdicts. **That corruption is present at
`8519e071` and was NOT introduced by the repair pass** — checked directly against `git show`.

So the recovery is computed under **both** treatments of an unpaired backtick run (literal, per
CommonMark; and opening a span to end of line) and a verdict divergence is asserted **only when the two
agree**. Asserting one otherwise would be asserting a claim from an instrument that is broken on that
input — the failure this project already has a memory note about.

It is not an escape hatch because **every such row is printed by name on every run, at zero as well as
at four**, with both readings and the gate's own answer beside them — the receipt convention
`quarantine.js` already uses for `NOT A DEFECT`, for the same reason: a door nobody can see being used
is not a door, it is a hole.

### One model that was built, measured and thrown away

READ-B was first defined as **the column a Markdown reader sees** — GFM splits a table row on unescaped
pipes before inline parsing and renders only as many cells as the header declares. It is the most
principled definition available and it is **unusable here**: measured on the current register it reports
**173 cut cells and 66 verdict moves**, with recovered "status cells" reading `cant`, `switch` and
`-miss`. The reason is a real and separate finding, recorded here and not acted on: **the register does
not render as a table.** Measured on the current file: **157 of 506 rows carry at least one pipe that is
not a column delimiter, 1,458 such pipes in total**, and **§5.6 declares two columns (`| # | item |`)
while 90 of its 124 rows author three or more** — so on GitHub the status column of every one of those
90 rows **is dropped from the render entirely**. That is a different defect with a different owner; it
is named here so the next pass does not rediscover it as this one.

*(The 157 / 1,458 is a wider count than the repair pass's 90 rows / 631 pipes and does not contradict
it: that count was pipes inside INLINE CODE specifically, this one is every pipe that is not a
delimiter, including backslash-escaped ones and bare pipes in prose.)*

---

## 4. WHAT THE CHECK DOES NOT DO

- It does not reimplement any detector. `roadmapRowIsClosed` and `roadmapRowSaysBroken` are `require`d
  from `engine/quarantine.js`. `roadmapRowStatusCell` is **not exported**, so its source text is cut out
  of the shipping bytes and compiled — never re-typed. If it is renamed or moved the check **throws by
  name** rather than checking a stale copy.
- It does not read an artifact, does not spawn a process, and does not write a file.
- It contains no `try`/`catch` at all, so it cannot swallow anything.
- **It says nothing about whether a closure is TRUE.** It compares a row against ITSELF. Sixteen rows
  are still closed on their authors' word and not on a re-run; that is the previous pass's OWED item and
  this check does not touch it.

---

## OWED

1. **#332 is a corrupt row and this check will not judge it.** Its title carries a stray `AND\|upkeep`
   fragment — present at `8519e071`, not introduced by the repair pass — which makes its two readings
   disagree about whether the row is closed or open-and-broken. **The fix is a six-character deletion in
   `docs/ROADMAP.md`, which this brief forbade me to make.** Until it lands, #332 is printed on every run
   as NOT READABLE and its verdict rests on notation.
2. **Three more rows are not readable for the same structural reason** — #166, #517, #519 — and their
   two readings agree today, so nothing is at risk. They are printed anyway, because that is what stops
   the category becoming an escape hatch.
3. **#6 and #30 have no status cell at all.** The detector falls through to a prose scan over the row
   head for both. Neither is at risk today; both are authored one column short.
4. **The register does not render as a table** (§3, last block). 157 of 506 rows carry a non-delimiter
   pipe (1,458 of them), and §5.6's declared width is two while 90 of its 124 rows author three or more,
   so those status cells are invisible on GitHub. Not this check's business, not fixed here.
5. **`node engine/status.js --write` was NOT run, for the third pass running.** It computes through
   `engine/quarantine.js` and reads artifacts a live ENGINE agent is writing right now; the tree gained
   four data files and two reports while this check was being built. Owed once ENGINE's tree settles.
6. **Nothing is committed.** `tests/test-register-cell-parse.js` is untracked.
