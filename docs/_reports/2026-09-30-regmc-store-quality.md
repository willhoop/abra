# Reg M-C store quality: the stale plain file, the M-B-keyed rules, and the bot rule — 2026-09-30

MEASURE, abra/regmc 1.35.0. Streaming store reads and one validator pass. No simulator, no games, no gate.
Run with plain `node`, not `tools\lownode.cmd`: this worktree's shell refuses a `cmd /c` it cannot prove
stays inside the worktree.

## Verdict

1. **`storePath()` now reads the newer file when both exist, and it prints the choice.** On the main
   checkout that means the Reg M-C `.gz` (09-30 01:45Z) over the plain snapshot (09-21 07:02Z). Every
   Reg M-B pair still resolves to the plain file, because the plain file is the newer one there. The
   stale plain files are untracked, and every game id in them is also in the `.gz` (0 missing of 33,743
   bo1 and 24,028 bo3). Deleting them loses nothing. I did not delete them: they are not mine to delete.
2. **Both id-keyed rules now judge Reg M-C, each by Reg M-C's own authority.** On the tracked stores
   (bo1 blob `76ef2de7`, 59,752 games; bo3 blob `d2b5041a`, 37,526 games):
   - **Legality** (`validate_store.js`, Reg M-C TeamValidator): **48** keyed ids, 35 bo1 and 13 bo3.
     All 54 offending species are illegal under the strict `Dex.forFormat` filter for the regulation, and
     none is legal. The rule removes **30** bo1 games and **10** bo3 games that no other rule removes.
     These counts include the custom rule below, because the two overlap.
   - **Custom ruleset** (`scan_custom_rulesets.js`, all 542 raw shards, 0% untestable): 2,477 infobox
     rooms. **89 are excluded**: those whose rules change legality or the pick count. The other 2,388
     rooms change only the information regime (`Force Open Team Sheets`, `Best of = 3`). They are
     published and **not excluded**, because docs/REGMC.md records that judgement as open and Will's.
3. **The bot rule changed, for Reg M-C only.** A one-team account must now also play **≥ 100 games on
   one calendar day**. That releases 16 flags that look human, including both live top-500 accounts, and
   keeps all 7 high-tempo accounts. On a Reg M-B corpus the rule is unchanged by construction.
4. **`data/meta-usage-regmc.json` was regenerated.** Most of the change is store growth: usable games go
   from 18,021 to 27,063, and the old file read the 09-21 `.gz`. On the same current stores, this pass's
   rules alone move the competitive view from 26,710 to 27,063 games (+353). No species' team rate moves
   more than 0.21 points, and the top-10 order is unchanged.

## 1. The stale plain store

`engine/quality.js` `storePath()` returned the plain `data/games.<fmt>.jsonl` whenever it existed. On the
main checkout that is the wrong file for both Reg M-C stores:

| pair (main checkout) | plain mtime | `.gz` mtime | now read |
|---|---|---|---|
| `games.gen9championsvgc2026regmc.jsonl` | 2026-09-21 07:02Z | 2026-09-30 01:45Z | `.gz` |
| `games.gen9championsvgc2026regmcbo3.jsonl` | 2026-09-21 07:02Z | 2026-09-30 01:45Z | `.gz` |
| `games.ladder.jsonl` / `bo3` / `ots` (Reg M-B) | 2026-09-21 02:33Z | 09-06 / 09-06 / 08-22 | plain (unchanged) |
| `games.gen9championsvgc2026regmabo3.jsonl` | 2026-09-01 02:13Z | 2026-09-01 05:58Z | `.gz` (byte-identical to the plain file) |

**The fix.** When both files exist, the newer mtime wins, and a stderr line names both files and the
choice, once per path. `quality.py` `_store_handle` mirrors it. `scan_custom_rulesets.js` had its own
plain-wins copy, and it now calls `Q.storePath`. The weak point is that mtime is not a content check. A
`.gz` freshly checked out over a plain file that is still being appended to would win. The printed line
is there so that case can be seen.

**The stale files.** `git ls-files` lists only the `.gz` files, so the plain ones are untracked. Streamed
by id, the plain bo1 file holds 33,743 ids and the plain bo3 file 24,028, and none of them is missing
from the `.gz`. **Recommendation: Will may delete the two plain Reg M-C files.** I did not.

**Callers that could have been served the stale file** (a Reg M-C plain path handed to
`quality.readStore`, `loadGames`, `funnel` or the scanner's copy of the rule, on the main checkout):

| caller | read the plain snapshot? |
|---|---|
| `engine/tag_dex.js` → `fit_policy.loadCorpus({files})` → `Q.readStore` (the Reg M-C tag catalogue's usage weighting) | **Probably.** The `usage_from` field of `data/tags-regmc.json` (generated 2026-09-24 14:28Z) names the plain paths. The file writes the canonical path, not the path it opened, so this cannot be told from the artifact. If it ran on the main checkout, it read the 09-21 snapshot. ENGINE's artifact: regenerate it. |
| `engine/scan_custom_rulesets.js` (its own plain-wins copy) | Only if run without `--store <.gz>`. The one Reg M-C run on record (docs/REGMC.md) passed the `.gz` explicitly. |
| `engine/validate_store.js` | No. It had never been run on Reg M-C. |
| any ad-hoc `Q.loadGames({path: 'data/games.gen9championsvgc2026regmc*.jsonl'})` | Yes. The 1.33.0 recount found this and passed the `.gz` explicitly. |
| `engine/usage_regulation.js`, `engine/next_regulation_ingest.js` reconcile, `solver/meta/extract.js`, `solver/human/build_dataset.js`, `engine/regulation_stores.js` | No. They name the `.gz` explicitly, read both files as a union, or read the raw shards. |
| `engine/quality.py` callers | No Python caller names a Reg M-C store. |

## 2. The two id-keyed rules

**Design.** Each verdict is now per regulation. `data/store-validation.json` and
`data/custom-ruleset-ids.json` are declared in `PER_REGULATION_ARTIFACTS` (`engine/regulation.js`), so a
Reg M-C run writes `data/store-validation-regmc.json` and `data/custom-ruleset-ids-regmc.json`. The new
files carry a `regulation` field. `quality.js` and `quality.py` read every `-<id>` sibling and union
their ids. This is safe because a game id carries its format, and the union means a caller reading a
Reg M-C store is filtered by the Reg M-C verdict whether or not it selected the regulation. Reg M-B's
legacy files keep their shape and are read by the old code, whose arithmetic is unchanged. Old and new
`quality.js` select the identical set on the Reg M-B `ots` store: 2,860 games, with an identical funnel.
JS and Python select identical ids on both Reg M-C stores: bo3 25,807 (sha `f29b19c5`) and bo1 30,215
(sha `eb7e1f4e`).

**The legality verdict.** `ABRA_REGULATION=regmc node engine/validate_store.js --write` uses the Reg M-C
checkout (`pokemon-showdown-mc`) and judges both stores with both rulers. It took 404 s. It keys on the
species class or a declared banned item, on either ruler and in either store. It never keys on moves,
because of the Illusion rule in `quality.js`.

| store | ruler | judged | flagged (any class) | species | item | keyed |
|---|---|---:|---:|---:|---:|---:|
| bo3 | revealed | 37,526 | 979 | 13 | 13 | 13 |
| bo3 | declared | 37,524 | 895 | 11 | 11 | 11 |
| bo1 | revealed | 59,370 | 2,222 | 35 | 11 | 35 |
| bo1 | declared | 2,289 | 69 | 0 | 0 | 0 |

The "other" class (884 bo3 complaints) is the validator's second line after a nickname-length complaint
("(It's 20 characters long…)"). The `OBSERVED` list in `validate_store.js` misses it, but it is not
keyed, so no game is removed for it. It is a classifier gap and it is listed as owed.

**The custom-ruleset scan.** `ABRA_REGULATION=regmc node engine/scan_custom_rulesets.js` read 97,279 raw
logs from 542 shards. Every store id has a raw log (0 untestable). It found 2,477 infobox rooms in 30
rule strings: 1,162 `Best of = 3`, 860 `Force Open Team Sheets`, 283 `Force Open Team Sheets, Best of =
3`, and 21 `!Obtainable`, among others. **89 rooms are excluded** (71 bo1, 13 bo3, 5 smogtours ids),
using the `alter_legality_union` classifier (`!Obtainable`, `natdex mod`, `+past`, `-X` bans,
`!Picked Team Size` and the like). **2,388 rooms are published under
`ids_information_regime_not_excluded`.** Reg M-B excluded every infobox room. Reg M-C cannot copy that
rule: docs/REGMC.md records that `Force Open Team Sheets` is what makes a game open-sheet, and that
whether to drop `Best of = 3` "is a judgement and it has not been taken". The first version of this pass
excluded all 2,476 and cut bo1 clean to 28,499. That version was withdrawn before commit.

The first scan died at the 2 GB heap limit. A regex capture is a V8 sliced string that keeps its parent
line alive, so the set of ids retained all 97,000 raw logs. Reg M-B's single flat file never reached the
limit. The fix copies each id and each rule string (`Buffer.from(...).toString()`).

**What each rule now removes.** These are games no other rule removes, on the tracked stores:

| store | legality flags | custom flags | removed by these two alone |
|---|---:|---:|---:|
| bo3 (37,526) | 13 | 13 | 10 (all 10 carry both reasons) |
| bo1 (59,752) | 35 | 75 | 30 (10 custom only, 20 both, 0 legality only) |

## 3. The behavioural-bot rule

Accounts were profiled on both stores: games, distinct teams, active days, busiest day, forfeit losses
and maximum rating. They were crossed with the live ladders, fetched 2026-09-30 01:33Z from
`pokemonshowdown.com/ladder/<format>.json` (500 listed per format).

Under the old rule (≥ 50 games, exactly one team), 15 bo1 accounts and 8 bo3 accounts are flagged.
They fall into two clusters:

| cluster | accounts | busiest day | forfeit losses | on the live top 500 |
|---|---|---|---|---|
| high tempo | Thornlace48812 (1,299 games, 600 in one day), kevdan42 (393), Scorecard-Pokemon (322), SC-SME (294), SC-Control (263), AI_Paku (132), Crituvyn72957 (120) | 120–600 | 0–0.6% | none |
| low tempo | bo1: HospitalityCheck, monfish, Tulpeon, Novicebest, stupid春bigㄟ, underabridgevgc, cosmonaut.009, ednasbreakout. bo3: monfish, swedish yonkagor, AI damage calc, Anne Choa, Afmoad, CemitaVGC, zinso45, NoMoreRegMC | 12–48 | 11 of 16 lose 1–33% by forfeit | Novicebest (bo1 #290, 1617), Afmoad (bo3 #109, 1495) |

Among one-team accounts with ≥ 50 games, no account's busiest day falls between 48 and 120. On Reg M-C,
the old rule's premise ("active humans … never 100%" one team) is false. The bo3 store holds 25
one-team accounts with 30–118 games, spread continuously, and none of them plays at bot tempo. Losing by
forfeit is something a person does. The high-tempo cluster almost never does it.

**Precision against the live ladder.** Under the old rule, 2 of 23 flags are ladder-verified top-500
accounts. The ladder cannot tell a bot from a human, so this is a lower bound on the false-positive
rate, not a measurement of it. Tempo and forfeit behaviour carry the rest of the argument.

**The change.** In `data/quality-filter.json`, `min_games_in_one_day: 100` applies to accounts with a
game whose id matches `tempo_applies_id_pattern` (`^gen9championsvgc2026regm[c-z]`). No Reg M-B, Reg M-A
or smogtours id matches, so every Reg M-B bot set is unchanged. That was checked by the id-prefix tally
of all four Reg M-B stores and by the old-against-new comparison on `ots`. The same logic is in
`quality.js` and `quality.py`.

**What moved.**

| store | bots | games touched by a behavioural bot | clean (per-store `loadGames`) |
|---|---|---:|---:|
| bo3 | 8 → 0 | 539 → 0 | 25,460 → 25,807 |
| bo1 | 15 → 7 | 8,188 → 7,426 | 29,749 → 30,215 |

The clean columns include the two id-keyed rules. **HospitalityCheck is readmitted.** It played 195 bo1
games over 18 days with one team, its busiest day was 15 games, and it never lost by forfeit. It was
also flagged on Reg M-B (576 games, 50 days, busiest day 36). It is the weakest case for "human" among
the 16, and the rule's text names it.

## 4. Published artifacts that move

- **`data/meta-usage-regmc.json`: regenerated** (`ABRA_REGULATION=regmc node engine/analyze.js
  --regulation regmc`, 120 s, in this worktree). Nothing live reads the worktree copy. Against the
  committed file (generated 2026-09-21 on the `.gz` of that day): usable 18,021 → 27,063 and bo3
  after-pool 25,080 → 37,189. Behavioural bots go from 12 to 7. The provenance block
  `not_asked_of_this_regulation` is replaced by `verdicts_of_this_regulation`. `source_digests` now
  includes the two verdict files, so provenance marks the model stale when either is re-run. **This
  pass's rules alone**, on the same current stores, move the competitive view by +353 games (26,710 →
  27,063). The largest team-rate moves are garchomp +0.21 pp, arcaninehisui +0.17 and floetteeternal
  +0.12. The top 10 is unchanged.
- **New:** `data/store-validation-regmc.json`, `data/custom-ruleset-ids-regmc.json`.
- **Not regenerated:** `data/tags-regmc.json` (ENGINE's; see §1). The frozen pool
  `data/team-pool-frozen-regmc` is cut and pinned; it is not re-cut.
- **For PORYGON2 v2:** `solver/human/build_dataset.js` reads `min_games` and `max_distinct_teams` from
  the config and runs its own bot rule, custom-rule check and illegal-entity check. It does **not** read
  the new tempo clause, so it still applies the old rule. `solver/meta/extract.js`
  hard-codes 50/1. Both are SOLVER's files, and neither was edited here.

## Files

`engine/quality.js`, `engine/quality.py`, `engine/regulation.js`, `engine/validate_store.js`,
`engine/scan_custom_rulesets.js`, `engine/usage_regulation.js`, `data/quality-filter.json`,
`data/meta-usage-regmc.json`, new `data/store-validation-regmc.json`, new `data/custom-ruleset-ids-regmc.json`.

## OWED, NOT RUN

- **Delete the two stale plain Reg M-C stores on the main checkout** (Will's call; they are untracked and
  hold no id the `.gz` lacks). Until then `storePath()` picks the `.gz` by mtime and prints the choice.
- **Regenerate `data/tags-regmc.json`** (ENGINE). Its usage weighting probably read the 09-21 snapshot,
  and its `usage_from` field records the canonical path rather than the one it opened (the ROADMAP #547
  class).
- **SOLVER: take the tempo clause into `solver/human/build_dataset.js` and `solver/meta/extract.js`**
  before PORYGON2 v2 trains. Otherwise its dataset still drops the low-tempo accounts: 539 bo3 games
  (1.4%) and 762 bo1 games on the stores measured here.
- **Will's judgement: the 2,388 information-regime custom rooms.** In particular, the 283 bo1-store games
  under `Force Open Team Sheets, Best of = 3` are open-sheet bo3 games filed in the bo1 store. They may
  belong in the bo3 corpus rather than out of both.
- **The nickname-length continuation line** ("(It's N characters long…)") is unclassified in
  `validate_store.js`. It is 884 bo3 complaints. No game is removed for it, but it inflates the `other`
  class.
- **`tests/test-quality.js` was not run.** It needs the Reg M-B `data/games.ladder.jsonl`, which this
  worktree does not hold. The Reg M-B path was checked instead by the old-against-new comparison on
  `ots` and by the id-prefix argument.
- **`node engine/status.js --write` was not run from this worktree.** From a worktree it writes missing
  untracked files as fact. Run it from the main checkout after merge.
- **Re-run both verdicts as the stores grow.** Each is a snapshot of blobs `76ef2de7` / `d2b5041a`. A game
  appended later has not been judged.
