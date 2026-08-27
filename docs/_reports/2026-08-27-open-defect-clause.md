# The open-defect clause, #218, and the nine excused rows — 2026-08-27, MEASURE

Read-only audit. No game was played, no artifact was written, `quarantine.js` was not run as a
program — its `openDefectClause` / `roadmapRowIsClosed` / `roadmapRowSaysBroken` were called through
`module.exports` (the file only executes under `require.main === module`, line 2603).
`docs/ROADMAP.md` and `data/register-reality.json` were both byte-identical to `HEAD` at read time
(`git status --porcelain` on each: empty, checked before and after), so the live read and the `HEAD`
read are the same bytes.

---

## VERDICT ON THE PREMISE — NEITHER THE ROW NOR THE CLAUSE IS MISREADING

The brief offered two possibilities. The answer is a third: **#218 is genuinely OPEN, its status cell
says so in as many words, and the `CLOSED 2026-08-12` in its title refers to a different half of the
row.** The clause is reading it exactly as designed.

`docs/ROADMAP.md:1030`, status cell, verbatim opening:

```
open — engine DEFECT. NOT MEASURED 2026-08-24 (instrument banned that session); ...
```

and later in the same cell:

```
**CLOSED 2026-08-12** — the gating half landed: `wholeGameClause()` is clause 7 of 7 ...
The quoting half of this row is fixed by the clause existing; the divergences it counts are
#81's queue, not this row.  **2026-08-18:** 696 of 995 = 69.9% on release 978ca8fe72c9, and the
row now has a runnable instrument that exits 1.
```

The deciding line is `engine/quarantine.js:1020`:

```js
if (/^\s*\(?open\b/i.test(roadmapRowStatusCell(l))) return false;
```

The cell wins over the prose. Without that line the prose fallback at 1039
(`/closed 20\d\d/i.test(head)`) would match `CLOSED 2026-08-12` in the title and close a row the
register declares open. The comment above line 1020 documents that this was measured before it was
wired — five verdicts move, all closed→open, three of them assert breakage (#218, #220, #224) — so
this is the guard working, not failing.

**The row's title is a dated headline and the house rule is that dated titles are not rewritten in
place.** That is defensible, but it is why the gate line reads as a contradiction to anyone who has
not opened the cell. Nothing is broken; the cost is legibility.

## THE FINDING THAT MATTERS MORE — TWO OF THE THREE FAILING CLAUSES ARE ONE MEASUREMENT

`#218`'s `VERIFIED BY` is:

```
VERIFIED BY: `node engine/quarantine.js --whole-game`
```

That is **clause 7 itself** — the whole-game clause, which is separately failing tonight
(`FAIL whole-game 11 of 961`). So the open-defect clause's only red row is held red by the same
instrument as the whole-game clause. `#218` currently functions as a mirror of clause 7, and its
title's own subject — that the differential *gated nothing* and the damage number was quoted for it —
is the half the cell records as closed on 2026-08-12.

Consequence: **the open-defect clause has no independent content right now.** It cannot go green
until the whole-game ratchet does, and when the ratchet does, it goes green with it. Three failing
clauses is really two distinct measurements.

`data/register-reality.json` (generated `2026-08-27T10:51:55Z` = 06:51 EDT), row 218:

```json
{"n":218,"cmd":"node engine/quarantine.js --whole-game","green":false,
 "kind":"VERDICT-RED","why":"exit 1","ms":57,"verdict":"CONFIRMED"}
```

`ms: 57` — the instrument does not play games; it reads `data/game-differential.json` and evaluates
the ratchet. **That artifact was rewritten at 12:55 EDT today by the ENGINE agent**, six hours after
this verdict was taken. The RED is corroborated by the gate line quoted in my brief, so I am not
disputing it, but the stored verdict is against a superseded artifact and is OWED a re-run.

## Q3 — WHAT `94,313 uses` ACTUALLY COUNTS

The clause scrapes it at `engine/quarantine.js:1941`:

```js
const uses = +((l.match(/([\d,]{3,})\s*(uses|clicks)/) || [, '0'])[1].replace(/,/g, '')) || 0;
```

First match of that pattern **anywhere in the row**, and #218's row is 9,949 characters. The match is
at character 1,730, inside:

> by usage the head is **PROTECT, 32 games but 94,313 clicks**

So `94,313` is a **corpus click count for Protect**, describing one sub-family inside the whole-game
divergence breakdown. It is not #218's importance, not a count of anything #218 is about, and not a
count of games.

Three separate problems with it:

1. **It disagrees with the click census.** `data/click-counts.json` (generated 2026-08-10, both human
   stores) holds `moves.protect = 147242`. `94,313` appears in exactly two places in the repo —
   this row and `docs/MEDICHAM-SPRINT-NOTES.md:11682`, both from the 2026-08-11 session. It is a
   typed figure with no live source.
2. **The mechanic it counts was retracted.** `docs/ROADMAP.md:1034` is
   `#222 — PROTECT IS NOT AN ENGINE DEFECT — IT IS THE INSTRUMENT'S PIN COUPLING, AND I SENT THE
   DIVISION AFTER IT WRONGLY — 2026-08-11`. The clause is advertising #218's weight with the usage of
   a family a later row rules was the instrument.
3. **It orders the queue.** `open.sort((a,b) => b.uses - a.uses)` at line 1946 ranks every open row by
   this scrape. Row #349's scraped weight is `126,170`, matched inside a sentence that reads *"the
   report's own head read \"126,170 clicks\""* — i.e. #349 is a row **about that number being the
   output of a broken ranking**, and the clause has adopted it as #349's rank.

This is not the gate being wrong about open/closed. It is a display and ordering figure with no
provenance, presented in the position where a reader expects importance. Filed, not fixed (not mine).

## Q4 — THE NINE EXCUSED ROWS

### The test, stated before classifying, and shown able to fail

`roadmapRowSaysBroken` returns `false` the moment `/\bNOT A DEFECT\b/i` matches the status cell —
before it looks at anything else. Note that `\bDEFECT\b` matches **inside the phrase `NOT A DEFECT`
itself**, so mechanically every one of the nine would otherwise count. The question worth asking is
therefore not "is the override load-bearing" (it always is) but **"is it suppressing an independent
breakage claim, or only cancelling its own phrase?"**

For each row: (A) does the prose-breakage regex match the row's first 600 characters, and (B) does a
`DEFECT` token appear in the cell **outside** every occurrence of `NOT A DEFECT`. Either → the
override is silencing a claim somebody made, and needs a human ruling.

Controls run against synthetic rows (`scratchpad/control.js`), because an audit that clears
everything is not an audit:

| control | shape | detector |
|---|---|---|
| A | cell `open — NOT A DEFECT, cosmetic`, title `THE ABILITY NEVER FIRES` | **FLAGS** (prose `NEVER FIRES`) |
| B | cell `open — engine DEFECT; the narration half is NOT A DEFECT` | **FLAGS** (independent token) |
| C | cell `open — register hygiene, NOT A DEFECT: nothing about the game …` | clean |

All three return `saysBroken:false` from the real detector — control B confirms that **an explicit
`engine DEFECT` in the same cell loses to the excusal.** That is deliberate and tested
(`engine/quarantine.js:2922`), but it is the shape to watch: the token is matched anywhere in a cell,
and these cells run to 900 characters.

Scope check: **20 register rows carry the phrase somewhere in the row; only 9 carry it in the status
cell.** The cell-scoping is doing real work — eleven rows mention it in prose and are not excused.

### The nine

| # | subject | cell token at | verdict |
|---|---|---|---|
| 252 | futility gate carries a declared prediction (SEARCH) | 10% | **Legitimate — and the only one that suppresses anything.** Prose fallback matches `is dead`, inside the metaphor *"a Farigiraf is dead only while that Farigiraf is still there"*. The cell says exactly that. This is the case REPAIR 2 was built for. |
| 336 | sleep: distribution right, draw ADDRESS never checked | 29% | **Legitimate declaration, and the one I would re-open first.** It claims nothing and carries a `WHAT WOULD DECIDE IT`. But *"the distribution is modelled correctly and whether the draw is addressed identically has never been checked"* is the exact shape of speed ties, Tailwind and Moody — all three declared safe on an unchecked die and all three refuted. Excused correctly by the letter; it owes a pinned staged sleep printing draw counts on both engines. |
| 344 | a fainted body stays in one of our active slots | 61% | **Real ruling, weakest reason of the nine — challenge it.** The row states `CONFIRMED AS REAL STATE` (Showdown sets `isActive=false` at `sim/battle.ts:2563`; we leave the body in the active array) and is excused because *"in the repaired game it produced zero divergent lines"*. That is absence-of-consequence, not measured narration-only, and under the board-material bar active-array membership **is** state. **The zero-divergent-lines observation is dated 2026-08-22 — taken under the die that could not mix its index.** It is also the same `faintMessages` region as open rows #331 and #315. |
| 381 | register hygiene: 5 unlaunchable `VERIFIED BY`, 35 rows with nothing deciding them | 14% | Legitimate. Nothing about the game is claimed wrong. |
| 386 | `open_work.js`'s UNREGISTERED input set is one artifact wide | 16% | Legitimate. An instrument-coverage claim. |
| 387 | whole-game headline changed quantity with no label | 15% | Legitimate. A labelling claim about a correctly computed number. Directly relevant to #218's instrument. |
| 395 | damage differential publishes 40 of however many it found | 20% | Legitimate. Truncated reporting, not a wrong mechanic. |
| 396 | whole-game 82 → 31 mechanisms, board-material split unmeasured | 18% | Legitimate and conservative — it refuses to assert the split. **Its figures are release `c36782953dee`, cut 2026-08-23T05:58Z, pre-die-fix.** The index stands; any board-material reading off it does not. |
| 480 | eight comments naming a source file that is not there | 45% | Legitimate. A claim about the tree, not the game. Two references left, ENGINE-owned. |

**Prose that acquired executable force: none.** All nine cells state a reason, and eight of them state
it in the leading clause. **Two should not be left to stand unexamined: #344 (excused on an
unmeasured consequence observed under the old die) and #336 (excused on a die that was never
checked).** Neither is a bookkeeping error; both are declarations of the kind that have been refuted
three times this month.

### One correction to the brief's framing

The clause prints `9 open row(s) declare NOT A DEFECT … and are excused from this clause`. Of the
nine, **eight would not have counted as broken on their own merits at all** — their only `DEFECT`
token is the one inside the phrase `NOT A DEFECT`. The override is doing genuine suppression on
exactly **one** row, #252, and it is doing it correctly. The receipt overstates its own reach by 8×.

## The id in my brief does not resolve

`f646b0163bc0` — named as the die-fix boundary — is **neither a git object nor a release** in this
tree (`git cat-file -t`: *fatal: Not a valid object name*; no `data/releases/f646*`). Today's cuts
are `6afa148cbeb1` (16:53Z), `614baef42d4e` (16:34Z), `dfe95f5bd25d` (16:30Z). I applied the
pre-fix warning by timestamp instead: anything measured before 2026-08-27 is pre-fix. Worth
correcting at source, because a figure pinned to an unresolvable id cannot be compared to anything.

## Other verdict columns, for completeness

`withRed` 1 (#218) · `staleRows` 3 (#376, #389, #412 — instrument GREEN) · `unrunnable` 5 (#318,
#319, #438, #439, #440 — instrument would not start; not agreement) · `debt` 56 rows asserting
breakage with no instrument · `verdicts_read` 100, generated 06:51 EDT.

Fifty-six rows of debt against 100 verdicts is the register's real shape: the clause is decided by
one row out of sixty-five open, breakage-asserting rows.

## OWED, NOT RUN

Everything below was inside the no-play / no-`quarantine.js` fence tonight.

```bash
# 1. Re-take #218's verdict against the artifact the ENGINE agent rewrote at 12:55 EDT.
node engine/register_reality.js
node engine/quarantine.js --whole-game ; echo "EXIT=$?"        # read the code UNPIPED

# 2. #344 — does a corpse in the active array change a board? Re-run under today's die,
#    not the 2026-08-22 observation the excusal rests on.
node engine/game_differential.js --release <today's id> --team-store data/team-pool-frozen \
     --census-pin <pin> --games 961
#    then: assert no body with fainted=true is a member of either active array at the moment
#    the authority has already cleared it (the row's own WHAT WOULD DECIDE IT).

# 3. #336 — the sleep draw ADDRESS, never checked.
#    A pinned staged sleep on both engines printing the draw count and the address consumed,
#    against Champions' `slp` override read from /data/mods/champions/ and cited by line.

# 4. Re-scrape #218's and #349's weights once someone decides what `uses` should mean.
#    Current: 94,313 = Protect corpus clicks (retracted family, #222); click-counts.json
#    says 147,242. 126,170 = a number #349 exists to call a ranking artifact.
```

Not done and not mine: fixing any of it, `engine/quality.js`, `data/quality-filter.json`,
`data/engine-data.js`, the random-target row, the Scovillain HP game.
