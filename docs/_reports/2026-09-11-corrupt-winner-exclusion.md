# 2026-09-11 — ROADMAP #558: the two corrupt-winner ladder rows are EXCLUDED by declaration

MEASURE. Historical findings record (`docs/_reports/`), not maintained, not current state.

## Verdict

**Done. No store byte written, no game played, nothing committed.** Both ids are declared in
`data/quality-filter.json` (version 1.3.0 → 1.4.0) under a new rule, `exclude_corrupt_winner`. The
rule's reason code is `corrupt_winner`, and it carries the evidence and re-fetch receipts for each id.
`engine/quality.js` and `engine/quality.py` honour it in `reasons()`. `engine/sanity_check.py`'s winner
clause goes **2 bad → 0 bad undeclared**, and the total goes **94 passed, 2 failed → 95 passed, 1 failed**.
The remaining failure is #550's brought-6 row (`…-2676161109`).

**Two frozen release SOURCES moved: `engine/quality.js` and `data/quality-filter.json`.** The
exclusion cannot move a differential figure. The proof is below.

## What was declared, and where

| file | frozen SOURCE? | change |
|---|---|---|
| `data/quality-filter.json` | **yes** | 1.4.0; changelog entry; rule `exclude_corrupt_winner` (`on`, `reason`, `test`, `register`, `report`, `declared` with 2 ids, `rationale`, `why_a_declaration_and_not_a_check`, `expires`, `measured`, `known_limitation`) |
| `engine/quality.js` | **yes** | `reasons()` pushes `corrupt_winner` for a declared id; `FUNNEL_STEPS` appends `after_corrupt_winner` last; `funnel()` returns `corrupt_winner {on, register, declared, found, removed_from_clean, flagged_anywhere}`; the CLI prints it |
| `engine/quality.py` | no | a line-for-line mirror of the above (the parity test compares selections by hash) |
| `tests/test-quality.js` | no | 7 rules; the rule must be a declaration (each id has `defect` and `refetched_log_sha256`); declared ids found in the store carry the reason and are absent from `loadGames()`; the new stage is monotone and is the last stage |
| `engine/sanity_check.py` | no | the winner clause reads the declaration: a declared bad winner is attributed to the rule, an undeclared bad winner FAILS, and a declared id whose winner is now a player FAILS (a stale declaration) |

**It is a declaration, not a filter.** Nothing tests `winner ∉ {p1, p2}`. A rule keyed on the winner
would absorb the next corrupt row without a register entry. Each declared id carries its
players, the U+FFFD count in the stored winner, the re-fetched winner, and both sha256 receipts from
`docs/_reports/2026-09-10-corrupted-winners.md`. **The typed evidence was checked against the store rows,
not trusted**: the players match p1/p2, the re-fetched winner is a player, and the stored winner holds
3 and 2 U+FFFD respectively.

**`engine/quality_bots.js` was left unchanged, on purpose.** Its `BOT_REASONS` stays
`bot | behavioural_bot | illegal_team`. Its three callers (`joint_click_census.js`,
`rollout_switch_census.js`, `mega_sets_from_sheets.js`) contain zero reads of `winner`. A corrupt winner
does not make a game non-human or out of format. This is recorded as limitation (3) under the rule.

### Why two frozen files, not zero

Every clean-store analysis enters through `quality.js` or `quality.py`, so `quality.js` has to change
whatever else is done. The only alternative was to hold the declaration in a new data file outside
`SOURCES`. That still moves `quality.js`. It also creates a data read by a frozen source that the
release does not freeze, which is the gap `engine/engine_release.js:1436` already names for
`data/store-validation.json`. Keeping the declaration in the file that is the definition of a usable
game means a release photographs it. **Two files is the minimum that keeps the release a faithful
photograph.**

Before this edit, `data/quality-filter.json` was content-identical to release `5973a4e3c768`'s copy
(`diff --strip-trailing-cr`: equal; only line terminators differ). `engine/quality.js` was
byte-identical (`e8a3b0a14884`). **Of the 27 `SOURCES`, the live tree now differs from
`5973a4e3c768` in exactly these two files.**

## The proof that the exclusion cannot move a differential figure

1. **The team pool never contains the ladder store.** `engine/diff_swarm.js` `loadTeams()` reads
   `data/games.bo3.jsonl` and `data/games.ots.jsonl` only, live or under `--team-store`. It reads them
   raw (`RAW-STORE-OK`), with no quality filter. `data/team-pool-frozen/` holds exactly `FROZEN.md`,
   `games.bo3.jsonl` (109,006,606 B) and `games.ots.jsonl` (31,928,037 B). A `grep -c` for both ids
   returns **0** in all four files, live and frozen.
2. **The frozen engine reaches the clean ladder store by one path, and the gate does not take it.**
   The only frozen file that requires `quality.js` is `engine/set_priors.js`:
   - `gearPriors()` reads `loadGames({clean:false})`, so the exclusion has no effect there;
   - `observedSets()` reads clean bo3 and ots, where the ids are absent;
   - `coocc()` reads the clean ladder. This is the one reachable path. It is reached only through
     `fillSet()` → `sampleMoves()`. `fillSet`'s callers are `build_lab, champions_sim(packTeam), mag_bot,
     mew, play, policy, prior_player, selftest, showdown_bot, stab_audit, validate_selfplay` and two
     tests. **No gate instrument calls it**, and `packTeam` has no caller in `game_differential.js`,
     `diff_swarm.js`, `all_mechanics_fire.js`, `quarantine.js`, `tests/roster.js` or
     `tests/staged_board.js`.
   - Independently of that: `REL.require` loads the snapshot path (`engine_release.js:1559`,
     `require(abs)`). So a release's `quality.js` resolves `STORE` to
     `data/releases/<id>/data/games.ladder.jsonl`, and **no release contains a `games.*` file**
     (checked on `5973a4e3c768`, `6fb9ebd3b704` and `84f466e7e0d2`). Under a release, `coocc()`'s catch
     yields an empty table whether or not the exclusion exists.
3. **The gate's other inputs do not filter.** `quarantine.js` reads `all-mechanics-fire`,
   `click-counts`, `decision-impact`, `engine-diff`, `engine-release`, `game-differential`,
   `mechanics-census`, `quarantine-stamp`, `roster.moves`, `sheet-usage`, `tags` and
   `whole-game-baseline`. Only `click-counts` (`engine/click_counts.js`) and `sheet-usage`
   (`engine/sheet_usage.js`) read the ladder store, and both are `RAW-STORE-OK` with no quality filter.
   `all_mechanics_fire.js` and `tests/staged_board.js` make zero store reads.
4. **Size of the change: one clean game.** `…-2662690089` passed every other rule. `…-2672145722` was
   already excluded by `partial_bring` (p1 revealed 3).

**The one thing that does move is the release DIGEST.** Gate clauses will read "MEASURED AGAINST A
DIFFERENT ENGINE" until ENGINE re-cuts and re-measures. That is a change in bytes, not in figures,
and it was accepted in the brief.

## Before / after (the same store throughout: 92,594 lines, 482,549,325 B, mtime 2026-09-10 22:14:07)

| check | before | after |
|---|---|---|
| `python engine/sanity_check.py` | 94 passed, 2 failed (winner 2 bad) | **95 passed, 1 failed** (winner: 0 bad undeclared; 2 declared corrupt_winner, ROADMAP #558) |
| clean ladder (`quality.js` funnel) | 32,193 | **32,192** (`after_corrupt_winner` −1) |
| `tests/test-quality.js` (lownode) | — | **35 passed, 0 failed**; JS 32,192 = Python 32,192, selection sha `71fd63c1bf9fb15e` both; "2 of 2 found, 1 removed from clean" |
| `node engine/quality.js` / `python engine/quality.py` | — | both print `DECLARED EXCLUSION — corrupt_winner (ROADMAP #558)`, in store 2 of 2 with both ids, removed 1, flagged 2 |
| `node build/compress-stores.js --check` | — | exit 0, "every store row is carried by a shard." |
| `node tests/test-workflow-paths.js` | — | 6 passed, 0 failed |
| `node engine/validate_store.js` (lownode) | — | exit 0, 92,594 ladder lines judged; it wrote nothing (`git status` clean for `data/store-validation.json`) |
| `wc -l data/games.ladder.jsonl` | 92,594 | 92,594 |

## Shown RED before being trusted

A scratch tree (a copy of `sanity_check.py`; the two corrupt rows plus one good row; a modified
declaration). It runs only the winner clause:

```
CONTROL  declaration as shipped      ok    0 bad undeclared; 2 declared
ARM A    one id removed              FAIL  1 bad undeclared; 1 declared
ARM B    a good row declared         FAIL  ...; STALE DECLARATION - winner now valid, remove from `declared`: …-2653451938
ARM C    rule switched off           FAIL  2 bad undeclared; 0 declared
```

## Side effect, reverted

The provenance baseline (`node engine/provenance.js`, plain run) rewrote `data/provenance-stamp.json`.
The only change was the `generated` timestamp, with an mtime matching my run to the tenth of a second.
It was restored with `git checkout -- data/provenance-stamp.json`. I did not re-run provenance after the
change, for that reason. Baseline status counts: 159 UNSAFE, 5 VOID, 35 ok; 174 rows already read
"OLDER THAN THE QUALITY FILTER".

Not touched: `engine/docs_scan.js` (modified by the other MEASURE agent),
`tests/test-docs-current.js`, `data/docs-currency-baseline.json`, `docs/RUNNING-NOTES.md`,
`CHANGELOG.md`, `docs/ROADMAP.md`.

## Register text for the coordinator

**Notes row** (my call is PATCH, since no living document states the clean-ladder count this moves;
if one does, it is a MINOR):

```
## [x.y.z] — 2026-09-11 — the two corrupt-winner ladder rows (#558) are excluded by declaration, not repaired
- **What changed.** `data/quality-filter.json` 1.4.0 declares `exclude_corrupt_winner`: reason `corrupt_winner`, ids `gen9championsvgc2026regmb-2662690089` and `gen9championsvgc2026regmb-2672145722`, each with its defect and re-fetch receipts. `engine/quality.js` and `engine/quality.py` honour it in `reasons()` as the last funnel stage; `engine/sanity_check.py`'s winner clause attributes a declared id to the rule and fails on an undeclared bad winner or a stale declaration. Two frozen SOURCES moved (`engine/quality.js`, `data/quality-filter.json`), so the release digest moved; no differential figure can — the pool is bo3+ots and neither id is in it (`docs/_reports/2026-09-11-corrupt-winner-exclusion.md`).
- **Measured.** Clean ladder 32,193 -> 32,192 on 92,594 games (`data/quality-filter.json`); `engine/sanity_check.py` 94 passed, 2 failed -> 95 passed, 1 failed; no store byte written.
- **Basis.** unchanged.
- **Supersedes.** Nothing.
- **Owed to the next major.** none. Owed as work: the hash-bound store correction (OPS), after which each id comes OUT of `declared` in the same pass.
```

**#558 `VERIFIED BY`**, replacing the current sentence:

```
VERIFIED BY: `python engine/sanity_check.py` — the winner clause 2 -> 0 (reads "0 bad undeclared; 2 declared corrupt_winner"), total 94/2 -> 95/1. After the store repair it must read "0 declared", and the entries must be gone from `declared`, or the clause fails as a STALE DECLARATION.
```

#579 will still reject this marker because it does not begin with `node`. No `node` command
checks the winner clause. `node tests/test-quality.js` checks the exclusion side only.

**#558 status**: `open — EXCLUDED 2026-09-11 by declaration (data/quality-filter.json 1.4.0, exclude_corrupt_winner); the store repair (a hash-bound correction) stays open. Owner OPS.`

**#550 correction**. Replace "two pre-existing bad-winner records (…-2662690089, …-2672145722,
non-ASCII names) keep engine/sanity_check.py red — parser, not store" with:

```
two pre-existing bad-winner records (…-2662690089, …-2672145722) whose `|win|` line was corrupted by the pre-2026-08-28 FETCH (chunk-split UTF-8 decode) — not the parser, which read the line it was given correctly. They are #558's, excluded by declaration 2026-09-11; what keeps engine/sanity_check.py red is the one brought-6 record (95/1).
```

In #550's status cell, "(94/2)" becomes "(95/1)", and "the two parser defects" becomes "the brought-6 record".

## OWED, NOT RUN

1. The release moved. ENGINE re-cuts and re-measures (per the brief, next):

```bash
node engine/engine_release.js cut "quality-filter 1.4.0: #558 corrupt-winner rows excluded by declaration"
node engine/status.js
```

2. Provenance after the change. Not run, because a plain run rewrites `data/provenance-stamp.json`:

```bash
node engine/provenance.js
```

3. Not run, because it restamps ledgers while another agent is editing the docs-currency path:

```bash
node engine/status.js --write
```

4. When the hash-bound correction mechanism lands (OPS), repair both rows, remove both ids from
   `declared` in the same pass, and prove it:

```bash
node build/compress-stores.js --verify-parsed
node build/compress-stores.js --check
python engine/sanity_check.py        # winner: 0 bad undeclared; 0 declared
node tests/test-quality.js
```
