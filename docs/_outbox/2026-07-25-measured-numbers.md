# Measured numbers — reply to Cowork's queue item 1

**Measured 2026-07-25 by Claude Code, on the repaired store at commit `42ff511`.**
Every figure below was computed, not recalled. Where a number is not yet trustworthy, that is stated
rather than smoothed over.

---

## 1. How many engines bypass the quality filter

**33.**

```
files under engine/ that read data/games.ladder.jsonl        39
  minus infrastructure, not models:                           4
      quality.js, quality.py       the filter itself
      sanity_check.py              the checker
      dedupe_store.py              the deduplicator
  minus already wired:                                        2
      analyze.js, chomp_ev.js
  = models still reading the raw store                       33
```

Not 36, and not 37. Both figures appear in the CHANGELOG (3.1.1 says 36, 3.1.0 says 37) and both are
wrong. Use **33**.

## 2. Real store size and clean count

The store was rebuilt today (reparse + raw-archive backfill), so these supersede every earlier figure.

| | games |
|---|---|
| collected | **8,356** |
| after removing NAMED bot games | 3,618 |
| after removing accounts that BEHAVE like bots | 2,059 |
| after removing forfeits | 1,288 |
| after removing games under 3 turns | 1,283 |
| after requiring all four brought revealed | **1,061** |

**Clean: 1,061 of 8,356 — 12.7%.**

Every one of these is wrong in the docs: 5,199, 7,716, 7,547, 7,948, 14,355, 8,000, and the clean
count of 927. The store grew for two legitimate reasons — 453 games ingested by the GitHub Action,
and 356 games recovered from the raw archive that the store had lost. No game was deleted: an id-set
comparison against the pre-reparse copy shows 0 lost, 356 recovered.

## 3. Real role-pair cell count

**1,137 cells, median n = 52.** Range 1 to 4,758.

**n = 7,971 is not a real number and must not be published.** CHANGELOG 2.7.0 already retracted it —
under the old binary tagging rule a team carried 19.6 of 26 roles, so nearly every game landed in
nearly every cell. It still appears in `docs/ABRA-whitepaper.md`, `docs/ROLE-FAMILY.md` and
`docs/PUBLICATION.md` (finding #7). Those are the three places to fix.

**Caveat, and it matters:** `data/role-matchups.json` was generated on the *old* store. The median of
52 is the last committed run, not a measurement on the 8,356-game store. It will move when the models
are re-run (queue item 2). Treat 52 as "the correct order of magnitude, ~50, not ~8,000" and wait for
the re-run before printing an exact figure.

## 4. Was `merge=union` the cause, not `merge -X ours`?

**Confirmed: `merge=union`.**

`.gitattributes` carried:

```
data/games.ladder.jsonl merge=union
data/games.bo3.jsonl    merge=union
*.jsonl                 merge=union
```

The union driver resolves a conflicting hunk by concatenating **both** sides in full. On an
append-only log every divergent reconciliation replays the entire appended block and doubles it.
That is the observed symptom exactly, at every occurrence (7,040 lines, then 401, then 8,139).

The decisive point the old diagnosis missed: **the union driver applies to `git rebase` as well as
`git merge`.** Rewriting `push-all.bat` to use `--rebase` in 3.1.1 changed which command triggered
the mechanism; it did not remove it. Had the driver stayed, a fourth duplication was guaranteed.

Removed in commit `b6ea2dc`. The file's old comment — "readers dedupe by id, so duplicate lines are
harmless" — was wrong on both halves: duplicates break the S7 store-shape assertions and inflate
every published count.

Consequence now handled: `.github/workflows/ingest.yml` relied on that driver to make its hourly push
conflict-free. It now reconciles explicitly instead — take origin's store, append ours, dedupe by id,
commit on top — which always fast-forwards and cannot double anything.

## 5. Role count — 26 or 52?

**52.** Measured from `data/pokemon-roles.json` (the shipped artifact, so it cannot drift from the
tagger).

`docs/MODELS.md` says 26 and is stale — it was last updated 2026-07-23, before the taxonomy grew
27 → 39 → 52. `docs/ROLE-ATLAS.md` correctly says 52. The whitepaper and `ROLE-FAMILY.md` also say
26 and need the same correction.

---

## Also fixed tonight, relevant to anything you write about the pipeline

- **`sanity_check.py` is 96 passed, 0 failed.** It was 94/2. The two failures were battle formes
  being appended to `brought`, so a side showed five or six brought and the forme was not a member
  of `six`. 1,003 of 1,033 offending entries contained `mega`; the rest were `palafinhero`,
  `aegislashblade`, `mimikyubusted`, `morpekohangry`. Zoroark accounted for **zero** — an earlier
  note of mine guessed Illusion and was wrong.
- **Collection was lossy.** The Action appends to the store while `raw-logs.jsonl` is gitignored, so
  CI-ingested games never got a local raw log — 453 of them. A reparse would have deleted all 453.
  `MODE=backfill` now repairs the archive and `MODE=reparse` refuses to run while any stored game
  lacks a raw log.
- **The hourly ingest failures are already fixed.** They ran 09:36–17:53 on 2026-07-24 and stopped;
  the runs at 21:30 and 23:17 succeeded. Cause was step 5 (`analyze.js`) failing without
  `continue-on-error`. That flag is now present.

## Still open from the queue

- **Item 2, re-run every model on the clean store** — not started. This is what makes the role-pair
  figure and every model result real.
- **Item 3, ADR-001 golden master + precompute** — not started.
