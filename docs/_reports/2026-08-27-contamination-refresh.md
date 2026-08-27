# 2026-08-27 — The contamination number, refreshed and split

Follows `docs/_reports/2026-08-27-store-legality-filter.md`, which established that there is no legality
filter at ingest or at analysis and that `data/store-validation.json` is read by no consumer. That report
carried a **stale** measurement (2026-08-07, 47,210 games). This one refreshes it and splits it.

**Nothing was filtered and no artifact that inherits contamination was touched.** The filter is Will's
decision. This batch exists to make it informed.

---

## VERDICT

**1,252 of 67,384 ladder games = 1.858%** carry at least one set the official `TeamValidator` refuses.
That headline is an **UPPER BOUND** and **may not be used as a filter key.** Split:

| class | games | rate of store | share of flagged | what it is |
|---|---:|---:|---:|---|
| **species** | **76** | **0.113%** | 6.1% | **the clean signal** — a team from another regulation |
| move-only | 1,175 | 1.744% | 93.9% | **mostly the Illusion signature** — 1,020 have a Zoroark line on the same side |
| item (any) | 35 | 0.052% | 2.8% | banned/absent items; `salamencite`, `diancite`, `covertcloak` |

**A species-keyed filter removes 76 games — 0.113% of the store, and 49 games (0.259%) of the 18,908
that survive `engine/quality.js`.** It leaves every one of the 1,175 move-only games alone, which is
the point of keying on species.

**A move-keyed filter would be a mistake with a number on it.** 1,020 of the 1,175 move-only games
have an Illusion carrier on the same side as the complaint — that is not contamination, it is
`engine/illusion.js`'s detector firing, and filtering on it deletes the Zoroark games the project
deliberately collects.

---

## 1. THE REFRESH

```
node engine/validate_store.js --selftest      # 24 passed, 0 failed
node engine/validate_store.js --write
```

| | 2026-08-07 | 2026-08-27 |
|---|---|---|
| judged | 47,210 games / 410,780 revealed sets | **67,384 games / 591,457 revealed sets** |
| distinct sets validated | 63,939 | **91,254** |
| unreadable store lines | not reported | **0** |
| flagged | 735 = **1.557%** | 1,252 = **1.858%** |
| distinct reason strings | 489 | **803** |

The denominator grew **42.7%**, not "about a third". The rate rose too, so this is not only a bigger
sample of the same thing.

**PROVE THE COMMAND DID SOMETHING.** `data/store-validation.json` went **123,725 → 170,128 bytes** and
its `generated` moved **2026-08-07T01:36:16Z → 2026-08-27T05:14:06Z**. Exit code was not trusted on its
own; the artifact stamp was read back.

**NO GAME NUMBER MOVED, AS PREDICTED.** `data/games.ladder.jsonl` was byte-identical and mtime-identical
across the run (323,608,809 bytes, 2026-08-27 00:04:37.825336200). No engine byte, no release, no census.

---

## 2. THE SPLIT — AND WHY IT IS NOT COSMETIC

`classify()` returns one bit and the decision it feeds is not one decision. The classifier that produces
the split is `reasonClass()` in `engine/validate_store.js`, added this batch. **It changes no verdict:**
`classify` is untouched and `flagged_games` means exactly what it meant on 2026-08-07.

### The exact class-set per flagged game — these partition the headline

| class-set | games | rate |
|---|---:|---:|
| `move` | 1,175 | 1.744% |
| `move+species` | 39 | 0.058% |
| `item+move+species` | 26 | 0.039% |
| `item+species` | 8 | 0.012% |
| `species` | 3 | 0.004% |
| `item` | 1 | 0.001% |

**Species almost never travels alone: 73 of the 76 species-flagged games also carry a move or item
complaint.** That is the shape Will described — a *whole team* from another regulation, not one stray
mon — and it is why the species class is the clean key. A team built under other rules trips several
rules at once.

### Complaint-level, comparable across the two runs

| run | complaints | move | species | item |
|---|---:|---:|---:|---:|
| 2026-08-07 | 881 | 781 (88.6%) | 82 (9.3%) | 18 (2.0%) |
| 2026-08-27 | 1,697 | 1,359 (80.1%) | **266 (15.7%)** | 72 (4.2%) |

**Species complaints grew 3.24x while the store grew 1.43x.** The species class is growing faster than
the corpus.

**The old run's GAME-level split is not recoverable and is not published as one.** The 2026-08-07
artifact stored no split, and its `examples` list caps at 500 — 68% of its 735 flagged games. In that
truncated sample, 11 of 500 (2.2%) were species-class, against 76 of 1,252 (6.1%) now. Extrapolated
that is ~16 games = ~0.034% then against 0.113% now, **a roughly threefold rise in rate — but it is an
extrapolation from a truncated, chronologically-ordered sample and must be quoted as one.**

### The Illusion screen

`engine/illusion.js` proves a disguised Zoroark by exactly this legality contradiction: the disguise
copies the name, not the moveset. The screen here applies the same conservative restriction — the
carrier must be on the **disguised player's own side**. `g.sets` is flat across both sides, so the side
is recovered from `six`/`brought`, which are per-side.

| move-only games | 1,175 |
|---|---:|
| Illusion carrier on the same side | **1,020 (86.8%)** |
| no Illusion carrier anywhere in the game | 153 |
| carrier present but on the other side | 2 |

**The carrier set is DERIVED, never typed** — every legal species in the format whose ability list
contains Illusion, filtered `exists && !isNonstandard && tier !== 'Illegal'`. It returns
`zoroark, zoroarkhisui`, which independently reproduces the list `engine/illusion.js` hard-codes.

This is a **screen, not a proof**: `illusion.js` additionally requires that Zoroark can learn the move.
So 1,020 is an upper bound on Illusion and 153 is a floor on "move-level contamination that is not
Illusion". Either way the conclusion is one-directional — **a move-keyed filter destroys the detector.**

---

## 3. THE COST OF A SPECIES-KEYED FILTER

### Confirmed by a second, independent ruler

The validator sees only **revealed sets**. A separate walk — every key in `sets` / `six` / `brought` /
`lead` checked against `Dex.forFormat(...)`, with battle-only formes of a legal base excluded as
observation artifacts — returns **the same 76 games**, from 73 distinct out-of-format keys. All 73 are
`isNonstandard: 'Past'`; **`tier` plays no part** (0 keys were `tier === 'Illegal'` with
`isNonstandard` null), which matches the standing rule that legality is `isNonstandard`, not tier.

Top offenders: `salamence` 18, `revavroom` 9, `riolu` 9, `rillaboom` 9, `tapukoko` 9, `amoonguss` 8,
`ironvaliant` 8, `ogerponwellspring` 8, `chienpao` 8, `ursalunabloodmoon` 8.

### What leaves the corpus

| | games | rate |
|---|---:|---:|
| raw ladder store | 76 of 67,384 | 0.113% |
| **after `engine/quality.js`** | **49 of 18,908** | **0.259%** |

**Contamination is enriched 2.3x by the quality filter.** Bots do not play custom-rules rooms; the
existing filter removes bots, so the contaminated games are disproportionately in the set the models
actually read. Any intuition that "it is a tenth of a percent" understates the exposure of every
downstream artifact by more than double.

### What the artifacts that inherit it would change

Measured, not assumed. **None of these files was modified.**

| artifact | out-of-format keys | weight they carry | effect of removing them |
|---|---|---|---|
| `data/meta-usage.json` — the model CHOMP reads | **19 of 796 threat rows** (4/260 `threats`, 4/260 `views.competitive`, **11/276 `views.ladder`**) | 40 of 256,490 and 116 of 644,016 counted appearances = **0.016–0.018%** | 19 rows disappear; every surviving rate moves in the fourth decimal |
| `data/bring-priors.json` | **69 of 339 species keys** | 244 of 256,752 team-sides = **0.095%**; max `n_team` among them is 12, against 352 for a mid-tier legal mon | 69 keys disappear; `n_species` 339 → 270 |
| `data/sheet-usage.json` | **19 of 277 species keys** | 77 of 157,392 team appearances = **0.049%**; max 10 teams | 19 keys disappear |
| `data/regulation-usage.json` — the coverage gate's own denominator | no species bucket; contamination enters as **14 of 503 raw move ids / 11 of 486 clean**, and **11 of 155 raw item ids / 9 of 152 clean** | 101 of 2,257,340 raw move uses = **0.004%**; 62 of 212,360 raw item uses = **0.029%** | **the gate's BAR does not move — see below** |

**THE COVERAGE GATE DOES NOT NEED THIS FILTER, AND THAT WAS CHECKED RATHER THAN ASSUMED.**
`tests/test-medicham-coverage.js` takes the union of the two 99%-of-usage prefixes. **Zero
out-of-format ids fall inside any of the four prefixes.** The smallest count admitted by the tightest
prefix is 51; the largest count carried by any contaminated id is 14. Every one is deep in the 1% tail.

**The one number the brief supplied that did not reproduce.** The earlier filing gave "11 of 796 threat
rows". 11 is the count for `views.ladder.threats` **alone**, whose denominator is 276; 796 is the total
across all three lists, whose numerator is **19**. Numerator and denominator came from different
questions. Likewise "21 of 339" for `bring-priors.json` does not reproduce — the measured figure is
**69 of 339**, every one `isNonstandard: 'Past'`, listed in full in the run above.

### The honest summary of the cost

**A species-keyed filter is cheap and it is also not a fix for anything currently wrong.** It removes
49 clean games (0.259%), deletes 19 threat rows and 69 bring-prior keys that are visibly junk, and
moves no rate that anyone quotes by more than ~0.1%. It does not move the coverage gate at all. The
argument for it is not that the numbers are wrong today; it is that **nothing is watching**, the
species class is growing 2.3x faster than the store, and a `bring-priors` key for a species that
cannot be brought is a lie whatever its weight.

---

## 4. THE STALE OPS LINE — STRUCK

`docs/OPS.md`'s backlog carried: *"`data/games.ots.jsonl` has not been written since July. Confirm
whether OTS ingest is still landing in it or has moved to the ladder store."* **Verified before
striking, on three independent grounds:**

- `engine/ingest_ots.js` is a **manual importer** — it takes `logs_*.json` paths as positional
  arguments and prints a usage line when given none.
- `grep -rn ingest_ots .github/` returns **nothing**. It is in no workflow, so no automated run was
  ever expected and none was missed.
- It **refuses** `--out data/games.ladder.jsonl` by name: *"REFUSING: --out is the closed-sheet ladder
  store. OTS games must not be pooled with it."* The ingest cannot have "moved to the ladder store".

The premise was stale as well: the file was last written **2026-08-21 22:35**, not July. And the
`<!-- GENERATED -->` block **on the same page** already read *"FROZEN external import, complete; date
is an import, not a heartbeat"* — the backlog line contradicted its own document. Struck with the
answer written in, not deleted.

---

## 5. WHAT ELSE THIS RUN FOUND

**`engine/format_drift.js` does not exist.** `validate_store.js`'s own header cited it as "the thing
that watches the second case" — a contaminated game versus an out-of-date rulebook. The only two
references to that name in the repository were this comment and a report quoting this comment. The
comment now names the gap instead of citing a file. Nothing watches the second case.

**`validate_store.js` judges ONE of the three stores.** It reads `data/games.ladder.jsonl` only, while
stamping `source_digests` for `games.ladder.jsonl`, `games.bo3.jsonl` **and** `games.ots.jsonl` — so the
artifact looks like it covers all three and covers 67,384 of 92,346 stored games. The 20,795 unjudged
`bo3` games are the **open-sheet** store, where a full team is declared before turn one; that is the one
corpus where the validator could judge a **complete declared team** rather than a partial revealed one,
which is a strictly stronger test than the one being run. Reported, not changed — extending the scope
mid-batch would change what the headline number means.

**The `unreadable` counter was computed and never printed.** The file's own header has said since it was
written that a line that will not parse is a game nobody judged. It is now printed and written. It reads
**0**, so nothing was hiding behind it — but that was not knowable before this run.

---

## HOW THE INSTRUMENT WAS CHECKED BEFORE ITS NUMBERS WERE BELIEVED

- **Selftest run first: 11 → 24 assertions, 0 failed.** The 13 new ones cover `reasonClass` and
  `reasonSubject`. Every string in them was taken from the 2026-08-07 artifact's `by_reason`, not
  invented — the eight shapes the corpus actually produces.
- **Shown RED on a deliberate break.** Hoisting the bare `does not exist in Gen \d` test above the
  possessive ones — the single most likely way to get this wrong, since
  *"Garchomp's item Choice Band does not exist in Gen 9."* and *"Salamence does not exist in Gen 9."*
  share a tail — gives **21 passed, 2 failed, exit 1**, naming the banned item and the banned ability
  as species. The ruler can see the exact confusion it exists to prevent.
- **A wired-knob check on the Illusion screen.** `reasonSubject` originally kept the possessive `'s`,
  yielding a key (`altarias`) matching nothing and failing open to "no carrier on that side". Fixing it
  moved the counter **30 → 31** on a 4,000-game sample. A fix that moves no counter is not known to be
  wired.
- **Exit-code propagation through `tools/lownode.cmd` proven, not assumed** — a script exiting 3 returns
  3 through the wrapper. (Note: `cmd //c "tools\lownode.cmd -e \"...\""` from this shell mangles the
  nested quotes and returns 0 regardless. Use a file, never `-e`, through that path.)
- **The headline cross-checked by a second ruler that shares no code with the first** — the Dex walk
  over `sets`/`six`/`brought`/`lead` returns the same 76 games.

---

## OWED, NOT RUN

- **The decision itself.** No filter was added; `data/quality-filter.json` and `engine/quality.js` are
  untouched. **This batch may not take the decision it was asked to inform.**
- **The 20,795 `bo3` open-sheet games and the 4,167 `ots` games are unjudged.** `validate_store.js`
  reads the ladder store only. The open-sheet store admits a stronger test (a full declared team) and
  its contamination rate is unknown. `source_digests` currently implies a coverage the run does not have.
- **`engine/format_drift.js` was never written.** Nothing distinguishes a contaminated game from an
  out-of-date rulebook. Needs a roadmap row.
- **No consumer reads `data/store-validation.json`.** That was true on 2026-08-07 and it is still true;
  this batch made the artifact current and richer without making anything read it.
- **The 2026-08-07 game-level split is unrecoverable** and the ~3x rate rise is an extrapolation from a
  68% truncated sample. Re-deriving it needs the 47,210-game store as of that date.
- **`covertcloak` appears 8 times raw / 4 clean in `regulation-usage.json`** — a banned item in the
  usage denominator. Not chased; belongs with the filter decision.
- **Nothing was re-run downstream.** `meta-usage.json`, `bring-priors.json`, `sheet-usage.json` and
  `regulation-usage.json` were READ and not regenerated; the figures above describe the artifacts as
  they stand at their own stamps (17:11, 17:11, 2026-08-10, 22:41).
