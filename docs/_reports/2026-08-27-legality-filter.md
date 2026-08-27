# The legality filter — species and item, never moves

**2026-08-27 · MEASURE · ROADMAP #471 · CHANGELOG 5.160.0**

Will, 2026-08-27: *"lets continue to use showdowns validation feature. if somethings not valid then
throw it out right?"* and, widening it: *"but also items too for open team sheets, we know which
choice items are legal."*

`engine/validate_store.js` has said since it was written that *"IT MARKS, IT DOES NOT DELETE …
quality.js decides what to do with it."* `quality.js` had never read the file. This is that decision,
wired at the one place every model shares.

---

## VERDICT

**The rule removes 49 games. The clean ladder corpus moves 18,908 → 18,859, −0.259%.**

It excludes a game when Showdown's own `TeamValidator` rejects the revealed team on a **species-level
or item-level** reason. **77 stored games carry such a reason — 0.114% of 67,384.** The other 28 were
already excluded by the bot, forfeit, turn-floor or full-bring rules.

**Move-level rejections are NOT keyed and the Illusion corpus survives intact.** 1,175 games are
move-only rejections; 1,020 of them have an Illusion carrier on the same side. That sentence — *"X
can't learn Y"* — is what `engine/illusion.js` uses to PROVE a disguise, so it is produced by legal
teams as a matter of mechanics. The exclusion is written into the rule's own comment in
`data/quality-filter.json`, `engine/quality.js` and `engine/quality.py`, and **pinned by a test** so
that "completing" the rule fails `tests/test-quality.js` instead of silently deleting a corpus.

---

## THE NUMBER AND ITS DENOMINATOR

Source: `data/store-validation.json`, `generated 2026-08-27T05:14:06.849Z`, written by the OPS/MEASURE
refresh that landed while this work was in progress. **The stamp was checked before the file was
read** — the standing hazard is a torn read of an artifact another process is writing, and the stale
copy on disk this morning was twenty days old.

**It covers the current store exactly.** The verdict records
`data/games.ladder.jsonl → 5cbb8e98b7f3` and the live store hashes to the same twelve. Not an mtime
comparison — the same content.

| | games | of 67,384 |
|---|---:|---:|
| flagged, any class (UPPER BOUND — not a filter key) | 1,252 | 1.858% |
| species | 76 | 0.113% |
| item, any phrasing | 35 | 0.052% |
| **species ∪ item — what the rule keys on** | **77** | **0.114%** |
| move-only — deliberately kept | 1,175 | 1.744% |
| …of those, an Illusion carrier on the same side | 1,020 | |

**76 + 35 = 111 is not the answer.** The classes overlap almost completely: **34 of the 35 item games
also carry a species reason**, so the deduplicated union is **77**. Widening the rule from species to
species-or-item therefore added **exactly one game** — a team declaring Covert Cloak and Choice Specs,
both on this format's explicit ban list.

The union is derived, not typed: `split.combos` partitions the flagged games exactly, so the expected
count is the sum of every combo naming a keyed class (39 + 3 + 26 + 8 + 1 = 77), and the reader
asserts that it resolved that many ids. Today: **77 resolved of 77 expected, 0 unresolved.**

**Enrichment: 2.27×.** The flagged rate is **0.114% of the raw store and 0.259% of the clean corpus**,
because the bot and forfeit rules strip bot games and bots do not play custom-rules rooms. **The
corpus the models read is dirtier than the store is.**

## THE FUNNEL PRINTS WHAT IT REMOVED

```
  after requiring all four brought to be revealed     18908  (28.1% of collected)   -7234
  after removing teams Showdown rejects (species/item)  18859  (28.0% of collected)   -49

  USABLE: 18859 of 67384 (28.0%)

LEGALITY EXCLUSION
  verdict      data/store-validation.json  generated 2026-08-27T05:14:06.849Z  (67,384 games judged)
  keyed on     species | item   — move-level rejections are NOT keyed (Illusion; see the rule's comment)
  ids          77 resolved of 77 flagged
  removed      49 games that passed every other rule (0.259% of the previously-clean corpus)
  flagged      77 of 67,384 collected (0.114%) — the rest were already excluded by another rule
```

The step is appended **last** on purpose: the funnel is cumulative, so inserting a rule earlier would
move the number printed against every stage below it and break comparison with every funnel recorded
before today. `after_legality` is a new stage; the five historical stages mean exactly what they meant.

The reader also prints **NOT APPLIED** if the verdict will not read, and **UNJUDGED n** if the store
has grown past the verdict's judged-game count. A rule that cannot prove it ran is assumed broken.

## THE ITEM CLASS IS NARROWED, AND THE COORDINATOR'S ITEM LIST WAS WRONG

The brief said *"the three items named are `salamencite`, `diancite` and `covertcloak` … none is
ambiguous."* **Derived from `by_reason`, the population is eleven items across 26 complaint rows:**
Booster Energy (12), Throat Spray (10), Eviolite (7), Salamencite (9), Covert Cloak (5), Diancite (4),
Misty Seed (3), Choice Specs, Clear Amulet, Red Card, Assault Vest (1 each). Four are on this format's
explicit ban list, two are mega stones for bodies the format does not contain, the rest are held by
bodies that are themselves out of format.

**And the class is not unambiguous — one of its three phrasings is a false-positive path.**
`reasonClass()` returns `item` for *"ogerponwellspring needs to hold Wellspring Mask to be in its
Wellspring forme."* and the *"(It will revert to its Teal forme…)"* note that follows it. Those fire
because the replay revealed a **forme** and never revealed the **item** — our closed-sheet storage
convention, not anybody's team. So the rule keys on the declared-item phrasing only, via
`item_reason_pattern` in the config.

**It costs nothing today, and that is measured rather than assumed:** all 18 forme-requirement
complaints sit in games that are *also* species-flagged, so narrowing removes zero games from the
union. It is there so a legal Ogerpon game in a future regulation is not deleted silently. The reader
counts what the pattern skipped (`forme_only_skipped`, currently 0) and prints it.

## WHAT IT DOES TO THE INHERITING ARTIFACTS

Definition, so the numbers are readable: a species key **loses all clean support** when every clean
ladder game naming it was one of the removed 49. Such a key cannot be written by any generator that
reads the clean corpus — it is gone on the next regeneration, not merely smaller.

| artifact | keys/rows | support changes | **lose ALL clean support** | regenerated by |
|---|---:|---:|---:|---|
| `data/meta-usage.json` (threat rows, table + both views) | 796 | 295 | **19** | six-hourly ingest (`analyze.js`) |
| `data/bring-priors.json` (species) | 339 | 157 | **65** | six-hourly ingest (`bring_priors.js`) |
| `data/sheet-usage.json` (species) | 277 | 110 | **18** | manual (`engine/sheet_usage.js`) — OWED |

**Distinct species with any clean-corpus support: 335 → 270.** Sixty-five names leave, and they leave
because they were never in this regulation.

**Nothing here was hand-edited and nothing should be.** `data/meta-usage.json`, `data/bring-priors.json`
and `data/move-priors.observed.json` are rewritten by the six-hourly ingest and clear themselves.
`data/sheet-usage.json` and `data/xatu.json` are not on that schedule and are owed a manual
regeneration by the divisions that own them.

**#471's Floette trap does not apply and that is by construction.** The row warned that a
name-keyed legality check deletes the largest usage row in the table, because artifacts collapse to
base formes and a legal Floette-Eternal collapses onto an `Illegal` base Floette. This rule never
tests a species name: it excludes a **game** on a verdict the validator returned about the **team the
replay actually revealed**. There is no name list anywhere in it.

## THE COVERAGE GATE'S DENOMINATOR MOVES, AND IT MOVES THE EASY WAY

Predicted before running: unchanged, or slightly smaller because the union takes the raw prefix too.
**It got smaller. Say it plainly: the gate is now six entries easier than it was this morning.**

| | before | after | Δ |
|---|---:|---:|---:|
| moves in the union 99% set | 293 | 293 | 0 |
| abilities | 104 | 100 | **−4** |
| items | 111 | 109 | **−2** |
| **total** | **508** | **502** | **−6** |
| things with any usage in either corpus | 854 | 854 | 0 |

Measured through `tests/regulation_usage.js`'s own `scan()` and `coverUnion()`, not a
re-implementation, with the rule toggled in memory — **no artifact was rewritten to produce this.**

The six that fall out are the abilities `magicbounce`, `thickfat`, `unaware`, `owntempo` and the items
`metalcoat`, `magnet`. **None loses all usage.** Clean-corpus counts before → after:

```
magicbounce  46 -> 32     thickfat  37 -> 16     unaware  30 -> 30     owntempo  29 -> 29
metalcoat    61 -> 41     magnet    60 -> 48
```

So it is two effects, not one. Four lose real usage — up to **57% of thickfat's clean count came from
49 games**, which is its own statement about how dense the contamination is. Two lose *nothing* and
fall out anyway, purely because the 99% cumulative boundary shifted underneath them.

**A mechanics-coverage percentage computed after this change is not comparable to one computed before
it.** The bar moved. That is not an improvement and must not be quoted as one.

## PROVENANCE: 24 UNSAFE → 233 UNSAFE

`data/quality-filter.json` changed, and provenance rule 1 is *"an artifact older than
data/quality-filter.json was computed under different rules about what counts."* Every artifact
computed before this edit is now UNSAFE by that rule. `node engine/provenance.js` reads
**233 UNSAFE, 2 VOID (declared), 1 possibly stale, 1 ok** against the 01:01 stamp's
**24 / 1 / 113 / 99**.

**That is the rule working, not a break.** The definition of a clean game genuinely changed. The
material size of the change is 0.26% of the clean corpus, and each artifact clears when its generator
is re-run. It needs saying out loud because `status.js` will look catastrophic on the next read and
the reason is one line in one config file.

Two provenance observations that are **not** mine and are reported rather than touched:

- `data/store-validation.json` is now marked **UNSAFE — OLDER THAN THE QUALITY FILTER**. That edge is
  backwards: `validate_store.js` does not read the quality filter. `FILTER_MT` is a deliberate blanket
  mtime rule and it clears the moment the verdict is regenerated, so it costs nothing today, but the
  arrow between these two files now points both ways and somebody should decide which one is upstream.
- **VOID RATCHET BROKEN** — `data/medicham-bench.json` newly declares itself void. Nothing to do with
  this change; flagged here because the ratchet is supposed to be one-way.

## THE MISSING DEPENDENCY, STATED

`engine/validate_store.js` cites `engine/format_drift.js` as the thing that separates *a contaminated
game* from *a stale rulebook*. **That file does not exist** — checked repo-wide today; the only
references to the name are that comment and reports quoting it. Its own header now says so.

So **this rule cannot tell "played under custom rules" from "our Showdown checkout is behind the
regulation."** It is safe in the direction that matters today: the eleven items and 71 species it keys
on are not marginal calls, and the whole effect is 0.26% of the clean corpus with the count, the rate
and the reason printed on every run. But if the regulation turns over and the checkout lags, this rule
will delete legitimate games and nothing will say so. That limitation is recorded in the rule itself,
not only here.

## COVERAGE, STATED

`engine/validate_store.js` judges `data/games.ladder.jsonl` **only** — its `VALIDATE_SOURCES` names
three stores and its scan loop reads one. So **the rule is a no-op on `games.bo3.jsonl` and
`games.ots.jsonl`**: those corpora are unfiltered for legality, not clean. The open-sheet regime is
the one MAG is fitted on, so this matters more than its size suggests.

## WHAT I CHANGED

| file | what |
|---|---|
| `data/quality-filter.json` | 1.2.0 → **1.3.0**; `exclude_illegal_teams` added with its classes, its item pattern, its measurement and its three known limitations; provenance funnel restamped |
| `engine/quality.js` | `illegalTeams()` reader, the `reasons()` clause, `after_legality` in `FUNNEL_STEPS`, the legality block on `funnel()` and in the CLI |
| `engine/quality.py` | the same, selection-identical — the two readers agree by hash |
| `tests/test-quality.js` | rule count 5 → 6; **the move-exclusion pinned**; the new stage in the monotonicity chain; the verdict-was-read and every-id-resolves assertions |

**A pre-existing red was fixed on the way past, and it was not caused by this change.** The recorded
provenance funnel in `data/quality-filter.json` was measured on 2026-07-28 at 20,688 games and 17.3%
clean; the store is now 67,384 at 28.0%, a drift of **10.8 points against a 3-point tolerance**. The
filter had not changed — the recorded number went stale and nothing re-derived it. It is restamped and
the old block kept under `superseded`; the tolerance was **not** widened, because a tolerance that
absorbs staleness stops being a check.

`node tests/test-quality.js` → **32 passed, 0 failed**, including `same count: JS 18859, Python 18859`
and `identical selection (sha 48a0ddfb104e7338)`.

---

## OWED, NOT RUN

1. **`data/store-validation.json` does not publish `item_flagged_ids`.** Only `species_flagged_ids`
   exists, so item-only games are recovered from `examples`, which is **capped at 500 rows**. Today
   that cap costs nothing — the one item-only game is inside it and the arithmetic proves it (combos
   say item-only = 1, examples holds 1). **The next refresh may not be so lucky.** The reader detects
   the shortfall and prints `n UNRESOLVED (under-removing)`, and `tests/test-quality.js` fails on it,
   so it cannot pass silently. The fix is one array in `engine/validate_store.js`, which MEASURE/OPS
   owns and I may not edit.
2. **The ingest never refreshes the verdict.** `.github/workflows/ingest.yml` runs `durable-ingest`,
   `analyze`, `policy`, `bring_priors` and `refresh-site-data`; it does not run
   `engine/validate_store.js --write`. So every scheduled run adds games the verdict has not judged
   and the filter's coverage decays until somebody runs it by hand. The funnel prints `UNJUDGED n`
   when that gap opens. OPS owns the workflow.
3. **`tests/regulation_usage.js` caches on the corpus and not on the filter.** Its key is
   `{bytes, mtime}` of `games.ladder.jsonl` alone, so a change to `data/quality-filter.json` does
   **not** invalidate it and the coverage gate would serve a pre-filter clean pass. It is not live
   today only by luck — the store grew at 00:04 and the cache was already invalid when I checked. One
   line fixes it (hash the config into the key).
4. **`data/sheet-usage.json` and `data/xatu.json` are not on the cron** and still carry rows that can
   no longer be derived: 18 and 15 species respectively. They need a manual regeneration by their
   owners.
5. **The open-sheet and bo3 stores are unjudged.** `validate_store.js` reads the ladder store only.
   Until it reads all three, `loadGames({path: 'data/games.ots.jsonl'})` is legality-unfiltered, and
   that is the corpus MAG is fitted on.
6. **The coverage gate's denominator has moved and nothing re-ran against it.** 508 → 502. Whatever
   `tests/test-medicham-coverage.js` last reported was measured against the old denominator.
7. **`build/sync_orientation.js` re-implements the funnel** rather than calling `Q.funnel()`, and it
   has already drifted — it drops **every** forfeit, which rule 1.2.0 stopped doing on 2026-07-28. It
   will not show the legality stage either. `docs/ORIENTATION.md`'s funnel table is therefore wrong in
   two ways. Reported, not touched.
8. **No game was played and none of this is a leaf measurement.** Leaf calibration remains
   QUARANTINED behind the MEDICHAM gate, unchanged by this work.
