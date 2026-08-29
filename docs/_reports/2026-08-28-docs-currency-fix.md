# `tests/test-docs-current.js` red → green — 2026-08-28, MEASURE

**Final: `23 passed, 0 failed`, exit 0, 80 lines of output.** Both failures were today's work. The
cited-artifact count came **DOWN to 65**, the baseline number, and **no entry was added to
`data/docs-currency-baseline.json`** — the file was not written at all (the run ends
*"no ratchet movement — data\docs-currency-baseline.json left untouched"*).

Command, from PowerShell, output read in full rather than piped through a truncating filter:

```
cmd /c tools\lownode.cmd tests\test-docs-current.js
```

---

## 1. WHAT WAS RED, AND WHY

```
== 2.     FAIL  every version-headed document is at 5.208.0 or is a declared pin
                (25 versioned, 19 pinned) — undeclared and stale:   6 documents @ 5.207.0
== 3b(b). FAIL  figures a cited artifact does not contain: no new entries (baseline 65, now 71)
```

WIRE 158 (the Metronome item consumer) landed and then five gate instruments were re-run on release
`4e5c7b3400de`. Two artifacts stopped containing values that four documents had recorded:

| artifact | field | was | now |
|---|---|---|---|
| `data/mechanics-census.json` | `probed` / `live` / `missing` | 780 / 780 / 0 | **782 / 782 / 0** |
| `data/roster.items.json` | `scope.tested` | 139 | **140** |
| `data/roster.items.json` | `counts.DEFERRED-BY-OWNER` | 1 | **0** |
| `data/all-mechanics-fire.json` | `summary.items.shelved_by_owner` | 1 | **0** |
| `data/all-mechanics-fire.json` | `closet.ids` | 7 ids | **6 ids** |
| engine release on all five | — | `5f3f7141227c` | **`4e5c7b3400de`** |

Unmoved, and checked rather than assumed: `data/roster.abilities.json` `tested` **129**,
`data/roster.moves.json` `tested` **475**, reds **18 / 29 / 35**, `data/game-differential.json`
**961 games / 6 raw divergences** with the same six first divergences in the same order and
**12,445 turn boundaries compared, 12,445 identical**, `data/all-mechanics-fire.json`
**1,289 games / 0 threw**, `data/engine-diff.json` **0 of 6000** (not re-run — nothing feeding it
changed).

## 2. THE FINDING THAT DECIDED HOW TO FIX IT

**All six new 3b(b) entries were inside DATED-HISTORY blocks, and not one of them was a wrong claim.**

| flagged | version block it sits in | verdict |
|---|---|---|
| `docs/ABRA-technical-docs.md:93` — 139 | the 5.206.0 block | dated history |
| `docs/ABRA-technical-docs.md:151` — 780 | the 5.206.0 block | dated history |
| `docs/ABRA-whitepaper.md:172` — 780 | the 5.206.0 block | dated history |
| `docs/MODELS.md:31` — 139 | the 5.206.0 block | dated history |
| `docs/MODELS.md:78` — 780 | the 5.205.0 block (headed *"MEDICHAM'S OWN NUMBERS, TODAY"*) | dated history |
| `docs/SUMMARY.md:102` — 780 | the 5.205.0 block | dated history |

These documents keep newest-block-on-top and declare each older block superseded rather than editing
it. Overwriting `139` with `140` inside a 5.206.0 record would have falsified the record — and the
brief's warning about blanket replacement is real in the other direction too. Counted, not assumed:
the six documents hold **10 occurrences of `139`**, of which **6 are the roster items count and 4 are
something else entirely** — Iron Ball's 139 recorded uses (deck and white paper), Choice Scarf's 139
uses (SUMMARY), and `WIRE 139` (DAMAGE-STAGES). A blanket replacement would have corrupted four
sentences that were correct.

`engine/docs_scan.js` already provides the right answer. `citationMismatches()` skips a block that is
itself about staleness (`const QUALIFIED = /retract|withdraw|superseded|…|prior|previously|…/i`), with
the comment *"A block that is itself ABOUT staleness quotes the old number on purpose."* Each dated
block now says so in its own words, and the current figures live in a **new 5.208.0 block above it**.

**This is a treadmill the file already diagnosed for the OTHER clause.** `changelogHas()` exists
because *"the moment an artifact is republished, every figure it used to hold becomes 'in no artifact'
and the per-document count grows — on every release, for every document that honours the rule."* That
escape hatch is wired into 3b(c) and **not** into 3b(b), which has only the `QUALIFIED` prose test. So
every future engine change that moves a headline count will re-open 3b(b) against the blocks that
recorded the previous one. Labelling is the correct action each time; it is structural, not
carelessness. Not filed as a defect — 3b(b) is the stronger clause and a second automatic escape would
weaken it — but it is why the pattern will recur.

**The clause deduplicates and that hides half the work.** Its key is `doc|figure|cites`, so the two
rows in `docs/SUMMARY.md` quoting `780` against `data/mechanics-census.json` (lines 37 and 102) are
ONE reported entry. Fixing the reported line left the clause red until the second, unreported line was
found by grep. Read the count, then grep the document.

## 3. WHAT WAS CHANGED, FIGURE BY FIGURE

Every figure below was read out of the artifact named beside it in the same pass, not carried over
from the brief's table.

**New 5.208.0 version blocks** (current figures; each block's citations verified against the artifact
by the gate itself):

- `docs/MODELS.md` — roster 140 / 129 / 475, reds 18 / 29 / 35, `DEFERRED-BY-OWNER` 1 → 0; whole-game
  961 / 6 raw / 6 declared / 0 undeclared, 12,445 boundaries; sample identity (643-row census pin,
  pool `0d103fb9fa87`, 1,968 of 8,778 teams); census 782 / 782 / 0; staged mechanics 1,289 games.
- `docs/SUMMARY.md` — the same set as a `question / artifact / answer` table, plus two rows this
  division owes: 72 of 250 artifacts moved WITHHELD → RE-RUNNABLE with none re-run, and the stale
  `data/quarantine-stamp.json` (below).
- `docs/ABRA-whitepaper.md` — the five clauses as a table, plus the argument for why the whole-game
  differential needed a census PIN to be a before/after and the staged-mechanics harness did not
  (it reads no census).
- `docs/ABRA-technical-docs.md` — the same, in Simplified Technical English.
- `docs/ABRA-deck-plain-english.md` — the same in plain English, including the honest note that
  Metronome is 19 of 26,232 teams in the frozen pool, so the lab saw the fix and the pool correctly
  did not.
- `docs/DAMAGE-STAGES.md` — **this chain gained a member.** The two blocks below it both open
  *"nothing in this chain is touched"*; that is no longer true. Stage 13 (`ModifyDamage`) now carries
  Metronome, and the row is updated in place. The placement is derived, not chosen:
  `data/items.ts:4022` is `onModifyDamage` returning `chainModify([dmgMod[numConsecutive], 4096])`,
  `data/mods/champions/items.ts` carries no `metronome` key, and
  `data/mods/champions/scripts.ts:293` spends that event with the ATTACKER as relay target — which is
  why it sits beside Life Orb and not beside the resist berries.

**Dated blocks labelled, figures left exactly as written:** `docs/MODELS.md` (the 5.206.0 gate bullet;
the 5.205.0 *"MEDICHAM'S OWN NUMBERS, TODAY"* heading, whose word *TODAY* was the actively misleading
part), `docs/SUMMARY.md` (both `780` table rows), `docs/ABRA-whitepaper.md` (the behavioural-census
bullet), `docs/ABRA-technical-docs.md` (*"THE RESULT."* and *"THE CENSUS IS COMPLETE."*).

**Version headers** 5.207.0 → 5.208.0 on all six. The 19 declared pins were not touched and the gate
confirms it: *"no pinned document moved to a version that is neither its pin nor the CHANGELOG top."*

**`CHANGELOG.md` 5.208.0** — three gaps filled, no new version opened:

1. `engine/coverage.js` was missing from `### Added` entirely. Added, with what it derives (a key
   vocabulary, an arithmetic residual, and declared ranges out of `data/tags.json`) and what its own
   header says it cannot catch.
2. The entry's note *"THE GATE READS 3 OF 8 … the re-runs are owed"* was written **before** the
   re-runs and is superseded within its own version. A following note records the five re-runs, the
   artifact readings, the sample-identity proof, and 8 of 8 OPEN — stated as a correction rather than
   by rewriting the earlier note.
3. A note that the open gate makes nothing downstream true: 72 of 250 artifacts became RE-RUNNABLE and
   none was re-run.

**`docs/MEASURE.md`** — a ledger entry on the republication treadmill and the deduplication trap,
outside the `<!-- GENERATED -->` block. `node engine/status.js --write` was then run; it restamped
ENGINE / MEASURE / SEARCH / OPS.

## 4. WHAT WAS *NOT* TODAY'S WORK

Reported, not touched, and none of it blocks the gate:

- **`data/quarantine-stamp.json` is stamped 2026-08-28 15:33 with `gate_open: false` and one failing
  clause, while the five artifacts under it are from 20:13–20:25.** It is older than the runs it
  purports to describe and it is **not** the gate reading. The 8 of 8 reading comes from the run of
  `engine/quarantine.js` recorded in `docs/_reports/2026-08-28-gate-rerun.md`, and I corroborated it
  independently rather than taking it on trust: `node engine/status.js` printed **no quarantine
  banner**, and `docs/ENGINE.md:398` records that `status.js:1145` prints that banner *only when the
  gate is shut*. Recorded in `CHANGELOG.md` and `docs/SUMMARY.md` rather than tidied away.
- **The 65 baseline `citation_mismatches` and the 35-figure untraceable census** are all pre-existing
  and unrelated (SLOWKING, PORY, value-net, counterplay, the quality filter). Untouched.
- **The 8 known retracted-figure restatements** (`63%`, `63.2%`, `47.5%`) are pre-existing and
  unchanged at 8.
- **`data/_bench-*.json` (11 files), `data/medicham-speed.json`, and a `_scratch-scovillain-dump.json`
  reported by `tests/test-artifact-rerunnable.js`** are untracked and sit in `data/`. I did not create
  them and did not delete them. Reported, left in place.

## OWED, NOT RUN

- **The PDFs are stale and were already stale before this pass.** `docs/ABRA-WhitePaper.pdf`,
  `docs/ABRA-deck-plain-english.pdf` and `docs/ABRA-technical-docs.pdf` all carry an mtime of
  **2026-08-28 14:56**, which predates 5.206.0 and 5.207.0 as well as 5.208.0 — so three version
  blocks are now missing from them, not one. Rebuilding is `pandoc → HTML → weasyprint` per the
  `docs/` build notes; not run, and not gated by any test, so it will not announce itself.
- **`node engine/quarantine.js` was not re-run by me**, so `data/quarantine-stamp.json` is still the
  15:33 file. One run would settle both the stamp and the gate clause in the same artifact. It plays
  games and my brief excluded that.
- **The seven MEASURE/SEARCH figures remain WITHHELD** on `engine/provenance.js` calling their
  artifacts UNSAFE, including `data/winrate-backtest.json` — leaf calibration. The open MEDICHAM gate
  did not release them; it changed *which* rule withholds them. Nothing downstream was quoted here.
- **The refit is still owed and untouched.** `engine/status.js` reports
  `feature_fixture --check FAILED` on two gates (fixture identity: scenarios 10 → 12; damage table:
  318 → 322 species, digest `405c836793d1` → `1bda9df11d73`) and `engine/medicham2-browser.js` moved
  at 19:17 after the 15:46 fit. A restamp would answer the fixture gate and SILENCE the table gate, so
  the table verdict has to be settled first. Not started — a refit is expensive and it is Will's call.
- **Nothing was committed or pushed.** Will is the publisher for this change. One thing to know before
  he commits: `docs/MEDICHAM-SPRINT-NOTES.md` does not exist, so the hook's sprint clause is dormant
  and the normal living-docs rule is armed. All three hook gates are green as of this pass —
  `test-docs-current.js` 23/0, `test-roadmap-register.js` 3/0, `test-artifact-rerunnable.js` 5 checks
  ALL GREEN.
