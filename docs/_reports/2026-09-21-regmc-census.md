# 2026-09-21 — Reg M-C gets its own census and its own steering inputs; the first pinned Reg M-C differential (MEASURE, abra/regmc 0.19.0)

Historical findings record. Not maintained. `node engine/quarantine.js --regulation regmc` is the state.
**Nothing here is published and nothing here is a gate verdict: every reading was taken in a worktree.**

## Verdict

- **Reg M-C has a census.** `tests/test-mechanics.js --regulation regmc` writes `data/mechanics-census-regmc.json`
  through the artifact seam: **1007 probed, 990 live, 17 missing, 0 threw, 0 hollow**, 1007 of 1007 armed.
  Pinned as `data/verification/census-pin-regmc-98c69a4fee7f.json` (content digest = name).
- **The steering inputs follow the regulation.** Under any regulation but Reg M-B, click counts, sheet usage,
  the behaviour table (move priors) and the voluntary-switch census are counted from that regulation's
  **frozen pool**, verified against its receipt (`engine/regulation_stores.js`). The behaviour table is a
  per-regulation ENGINE file (`runtime.regmc.movePriors`) and an M-C release freezes it. The joint census
  refuses under Reg M-C until it is converted.
- **Three seed-era census rows exist for Reg M-C only**: the seed on entry, the seed on terrain change, and
  the Grassy heal skipping a semi-invulnerable body. All LIVE; each goes MISSING under its knob.
- **Reg M-B unmoved** (section 5): census rows identical, click counts and sheet usage identical on the same
  stores, no tracked Reg M-B artifact changed, the default gate's output identical to HEAD.
- **First pinned Reg M-C reading** (section 6), release `9298380d80f5`, `--games 1200`: the gate's own clause
  reads **228 of 955 board-material + 6 THREW**; the differential's state bar reads **215 of 941** (14 void
  games excluded). Rocky Helmet is the largest first cause by far.

## 1. The census

`data/mechanics-census.json` is built by `tests/test-mechanics.js` from the table and tags the selected
regulation loads. Since 0.17.0 its writer lands on `mechanics-census-regmc.json` under Reg M-C, so the census
needed no new instrument, only a run:

```
node engine/... launch  tools\lownode.cmd tests\test-mechanics.js --regulation regmc      (exit 0)
  1007 probed, 990 live, 17 missing; 0 threw; hollow 0; armed 1007/1007; direct-call 1
  NOTE: the unarmed / directCall ratchets have no baseline this run — ENOENT (first Reg M-C census)
```

**The 17 missing rows are LIVE in the Reg M-B census.** They are the Reg M-B probes run on Reg M-C's table,
tags and checkout. Not investigated here (ENGINE's): each is either a fixture the M-C table builds differently
or a real M-C gap. Rows: `megaStone` (stone-holder build), `speedCond` ×2 (Quick Feet, Slush Rush),
`forbidsStatusMoves` ×2 (Taunt), `disablesAttacker` (Cursed Body), `spreadFoes` (x0.75 rounding),
`survivesFromFull` (Focus Sash), `sealsMoves` (Disable), `drain` (spread drain — reads NOT STAGED),
`priorityModFlying` (Gale Wings), `healsAtThreshold` (Sitrus between two hits), `hitsTwice` (Parental Bond),
`clearsScreensOnEntry` (Screen Cleaner), `protectsAllyFromStatus` (Aroma Veil), `weatherSetter` (sand chip
order), `punishesAttacker` (Spicy Spray). Full lines: the run's stdout, reproducible with the command above.

**The pin.** `data/verification/census-pin-regmc-98c69a4fee7f.json`, a byte copy (LF) of the census, named by
`engine_release.sha12Content`. The `regmc-` infix keeps it from colliding with, or being read as, a Reg M-B pin.

### 1a. The seed rows — census rows for Reg M-C only

`tests/test-mechanics.js` gains one block above the aggregation line. Everything in it is derived:

| row | gate | arms (control / test) |
|---|---|---|
| item `consumedOnTerrain` — a seed is spent on switching in under its own terrain | the selected tag file carries a `consumedOnTerrain` item legal in the selected format | bench body holds a seed of ANOTHER terrain / its own terrain's seed; the terrain is set by its own move on turn 1, the switch is turn 2 |
| item `consumedOnTerrain` — a seed on the field is spent the moment its terrain starts | same | holder on the field, partner clicks the terrain move |
| move `terrainPassiveHeal` — Grassy Terrain does not heal a body on a semi-invulnerable charge turn | a non-owner regulation only | same body at half HP under Grassy Terrain: Protect (healed a sixteenth) / the charge turn of a `semiInvulnerable` move (healed 0) |

The cast is derived: seeds from the tag, the terrain move from the tag's own `terrain` param, the charge moves
from the `semiInvulnerable` tag, every body from the format's legal species filtered to rows the table builds.
Under Reg M-B the tag file has no `consumedOnTerrain` member and the regulation is the owner, so the block
registers nothing and never loads the dex. **Why the Grassy row is Reg M-C only:** it is a shared mechanic, and
one more Reg M-B row moves the `probed` count the closed line published (the seeds agent measured exactly that
and removed the row). Adding it to Reg M-B is a decision, not a side effect.

**Shown red, each on its knob** (the census write is refused under each, by the existing DELIBERATE_BREAK list):

| knob | entry row | change row | Grassy row | totals |
|---|---|---|---|---|
| none | LIVE | LIVE | LIVE | 990 live / 17 missing |
| `MEDI_SEED_UNCONSUMED` | **MISSING** | **MISSING** | LIVE | 988 / 19 |
| `MEDI_SEED_NO_TERRAIN_CHANGE` | LIVE | **MISSING** | LIVE | 989 / 18 |
| `MEDI_TERRAIN_HEAL_SEMIINV` | LIVE | LIVE | **MISSING** (healed 8, must be 0) | 989 / 18 |

(`MEDI_SEED_UNCONSUMED` refuses the spend inside `seedSpend`, which both roads call, so both rows fall.)

## 2. The steering inputs — every store reader in the steered path, found by reading code

What the empirical differential (`--steering empirical`) reads, and where each came from before this change:

| input | read how | before | now under Reg M-C |
|---|---|---|---|
| behaviour table `data/move-priors.json` | `REL.read` out of the release | Reg M-B's copy, frozen in every release | `data/move-priors-regmc.json`, a per-regulation ENGINE file (`fileFor`), frozen by an M-C cut; the steering stamp names it and digests it |
| switch rate `data/rollout-switch-census.json` | live, `D('data',…)` | Reg M-B's | declared per-regulation → `-regmc` through the seam; built from the pool's raw logs |
| joint table `data/joint-click-census.json` | live, `joint` arm only | Reg M-B's | declared per-regulation; its builder REFUSES under Reg M-C (not converted) |
| census | `--census` pin | refused (no M-C census) | the M-C pin |
| team pool | `--team-store` | pinned already | pinned already |
| protocol events, tags | live, per regulation since 0.15.0 | — | unchanged |
| `data/meta-usage.json` | live; report ranks only, never a click | Reg M-B's | **still Reg M-B's — owed** |

And the gate's coverage clause reads `click-counts` and `sheet-usage`, whose builders read Reg M-B's stores.

**The store rule.** `engine/regulation_stores.js` `pool()` returns null for Reg M-B (callers keep their own
literal store lists, byte for byte) and, for any other regulation, its frozen pool `data/team-pool-frozen-<id>/`:
both halves (`games.bo3.jsonl`, the bo3 open-sheet ladder; `games.ots.jsonl`, the bo1 ladder's open-sheet subset)
verified by size and sha256 against `pool-receipt.json`, refusing by name on an absent or altered file. The pool
IS the regulation's store with the pool's scope and quality rule applied (open sheets; the dated Eject Button
conjunction — FROZEN.md), so no further filter is applied: Reg M-B's `quality.js` / `quality_bots.js` filters
are its definition of usable and are not layered on top. Raw logs come from the tracked shards
`data/raw/games.<format>/*.jsonl.gz`, joined to the pool by game id.

**Builders converted:** `engine/click_counts.js`, `engine/sheet_usage.js`, `engine/policy.js` (derive; its
promote now defaults to the regulation's own table), `engine/rollout_switch_census.js`. Each loads
`engine/regulation.js` first so the seam is installed before it writes. `engine/joint_click_census.js` refuses.

**The Reg M-C inputs, as built** (pool digest `792daded918f`, 24,832 games; all local, none published):

| artifact | reading |
|---|---|
| `data/click-counts-regmc.json` | 24,832 games, 162,416 turns, 479,440 clicks over 432 moves |
| `data/sheet-usage-regmc.json` | 49,664 teams, 297,984 slots; 13 mega-only abilities not countable |
| `data/move-priors-regmc.json` (promoted from `move-priors.observed-regmc.json`) | 280 species, 2,115 move cells |
| `data/rollout-switch-census-regmc.json` | 24,607 finished games (bo3 23,252; ots 1,355); every pool id had a raw log; P(switch given a live bench) 14.303%; derived cap 17 |

## 3. `game_differential.js`

- The printed output path is now the file the seam wrote (`-> data/game-differential-regmc.json`); identity
  under Reg M-B.
- The empirical block stamps the behaviour table as `fileFor('data/move-priors.json')` with ITS manifest
  digest, and the switch census by `artifactFor`. Before, under Reg M-C, `REL.read` would have served one file
  while the stamp named and digested another.
- Editing the file moves its driver-code digest; the run below records `eec24a82c5fb`, stable across the run.

## 4. Guards, each shown red first

`tests/test-regulation-steering.js` (new, 29 checks): Reg M-B selects its literal stores and freezes no extra
file; Reg M-C maps the behaviour table and the censuses; in a throwaway root with a synthetic pool (placeholder
strings, real sha256 receipt) all four builders count the pool and land on `-regmc` while Reg M-B's files
(sentinels) stay byte-identical; an altered (same size) or absent pool file makes each of the four refuse by
name and write nothing; a Reg M-B control arm in the same root counts Reg M-B's stores; the joint census exits 2.
`tests/test-regulation-artifacts.js`: the three steering inputs leave NOT_YET, `engineFile` reads
`regulation.FILE_DEFAULTS`, and a new check fails a NOT_YET entry that already follows the regulation.

| deliberate break | result | restored byte-identical |
|---|---|---|
| A `pool()` always null | 8 FAIL | yes |
| B sha256 check removed | 2 FAIL (the altered-file checks) | yes |
| C joint census refusal removed | 1 FAIL | yes |
| D behaviour table left out of `REGULATION_SOURCES` | 1 FAIL | yes |
| E `move-priors` put back in NOT_YET | 1 FAIL (test-regulation-artifacts) | yes |
| F `policy.js` ignores the pool | 4 FAIL | yes |
| G switch census ignores the pool | 3 FAIL | yes |

(A–D ran before the behaviour-clone and switch-census sections were added to the sandbox; F and G after.)

## 5. Reg M-B unmoved — proof

- **No tracked Reg M-B artifact changed.** `git status` shows only `data/regulations.json` (the new
  `runtime.regmc.movePriors` key) among tracked `data/` files; every other data change is a new `-regmc` file or
  the new pin.
- **Census.** HEAD's `tests/test-mechanics.js` and the new one, both run under Reg M-B on this tree: 1004 probed,
  1004 live, every row identical except one detail string of a sampled probe (`formatSecondaryChance`, 6000 random
  turns), which differs by the same amount between HEAD's code and the committed census — the noise floor, not
  the change. The tracked census was restored afterwards (`git checkout`), so it is byte-identical.
- **Click counts and sheet usage.** HEAD's and the new builders, each in its own sandbox, hard-linked to the same
  Reg M-B stores (127,692 games): artifacts identical apart from `generated`; stdout identical apart from the
  sandbox path inside the (identical) dex-load warning.
- **The default gate.** `node engine/quarantine.js` on HEAD's tracked files and on this commit, same worktree:
  see section 5a.
- **The behaviour table and switch census under Reg M-B**: `fileFor` / `artifactFor` are identity, `pool()` is
  null, `REGULATION_SOURCES` is empty (asserted in part 1 of the new test).

### 5a. `quarantine.js` (no flag), HEAD vs this commit

Filled in by the second commit of this change (it is measured after the first is committed, by checking out
the base in this worktree and back).

## 6. The first pinned Reg M-C differential

```
node engine/game_differential.js --regulation regmc --steering empirical --arm middle --end-state \
  --census data/verification/census-pin-regmc-98c69a4fee7f.json --team-store data/team-pool-frozen-regmc \
  --release 9298380d80f5 --games 1200 --write                      (via tools\lownode.cmd; exit 0)
```

| pin | value |
|---|---|
| `--games` | 1200 (955 played; swarm picked 1,940 of 11,608 teams, team pool `3c60452ad2c5`) |
| release | `9298380d80f5` — cut in THIS worktree only; 31 files incl. `engine-data-regmc` `f6b756beabd7`, `tags-regmc` `14d418410933`, `move-priors-regmc` `277231efc455` |
| census pin | `census-pin-regmc-98c69a4fee7f` (1007 rows; identical to the live M-C census) |
| team store | `data/team-pool-frozen-regmc`, pool digest `792daded918f` (hard-linked from the main tree, read-only) |
| alignment | `data/protocol-events-regmc.json` `730f01f81c49` |
| selector | `data/move-priors-regmc.json` `277231efc455` (release), `data/rollout-switch-census-regmc.json` `f4a12e22eee7` (live) |
| authority | `pokemon-showdown-mc` `f10d6798f2ba` |
| driver code | `eec24a82c5fb`, unchanged across the run |

**Readings (not published, not a verdict):**

- Gate clause (`quarantine.js --regulation regmc`): **BOARD-MATERIAL non-zero on 1 of 3 lattices — `--games 1200`:
  228 of 955 + 6 THREW**; 1600 and 1900 CANNOT-ANSWER. The coverage clause now PASSES for Reg M-C (all 269 moves
  above 25 clicks are measured by the roster or the census); the other clauses read NO ARTIFACT / CANNOT-ANSWER
  as before, plus the known two uncompared leaves.
- The differential's own state bar: **215 of 941** board-material (14 void, low-identity dice), 726 never parted,
  9,103 of 9,886 turn boundaries identical, median first board divergence turn 4.
- The driver steered off Reg M-C: 89.2% of decisions drawn from the M-C species table, 0.7% on an unprofiled
  species; switching realised 14.37% against the census's 14.303%.
- **A must-read-0 counter is not 0:** 7 choices Showdown refused (`Can't switch: You have to pass to a fainted
  Pokémon`), each throwing its game; 301 forced switches unmirrorable after the boards had parted.

**First-cause breakdown** — board-material causes (`end_state[0].summary.by_cause`, materiality BOARD-MATERIAL,
160 causes / 226 games), grouped by the mechanism named in the cause string, games = `board_parted`:

| family | games | causes |
|---|---|---|
| Rocky Helmet chip (missing, or priced as recoil / to 0) | 89 | 50 |
| Emergency Exit activation | 28 | 24 |
| `-damage` value mismatch (HP differs, no source tag) | 27 | 25 |
| faint HP written `0fnt` on one side only | 14 | 6 |
| Eject Button | 13 | 13 |
| other event mismatch (gem, `-fail` vs switch, …) | 11 | 9 |
| Inner Focus `-fail` stat name (`atk` vs `attack`) | 10 | 4 |
| Air Balloon | 10 | 10 |
| terrain | 8 | 6 |
| a species display name spelled two ways | 5 | 2 |
| the rest: one engine stopped emitting (5), `-fail` field (2), ordering, extra event, seed, switch field | 11 | 11 |

The item families are exactly ENGINE's concurrent item batch (Rocky Helmet, Air Balloon, Red Card, Eject Button,
Emergency Exit). Rocky Helmet was UNBANNED in Reg M-C (`docs/REGMC.md`) and is the largest single first cause.

## 7. Traps (runbook rows appended to `docs/REGULATION-ROTATION.md`)

1. **The artifact seam also redirects a release cut.** `data/rollout-switch-census.json` is a release SOURCE.
   Declaring it per-regulation made the M-C cut read it through the seam, so release `9298380d80f5` froze Reg
   M-C's census bytes (`f4a12e22eee7`) under the Reg M-B name. Inside an M-C release that is the right file for
   the engine to read, but the manifest names Reg M-B's file with Reg M-C's digest. Owed: freeze it by its own
   name as the behaviour table is (a `fileFor` key), or have the cut bypass the seam.
2. **A builder that never loads `engine/regulation.js` has no seam.** Before this change `click_counts.js` did
   not; run with `ABRA_REGULATION=regmc` it would have overwritten Reg M-B's file.
3. **A positional-argument parser eats `--regulation`'s value.** `policy.js` read `--regulation regmc` as a store
   path `regmc`.
4. **A store test in a worktree passes vacuously.** The worktree has no Reg M-B stores, so "selects the literal
   stores" compared two empty lists. A control arm with stores present was added.
5. **The harness refuses `cmd /c` typed at the shell.** Launched through a node argv launcher instead.

## 8. Owed

- ENGINE: the 17 census rows live under Reg M-B and missing under Reg M-C (section 1); the item batch (section 6).
- MEASURE: the release manifest naming (trap 1); `data/meta-usage.json` per regulation (report-only reader);
  the joint census conversion; the 7 refused choices (instrument or engine — not triaged); the 1600 and 1900
  lattice samples; the census ratchet for Reg M-C starts from this run.
- `set_priors.js`, `board.js`, `rollout_leaf.js`, `prior_player.js` read `data/move-priors.json` by fs path, so
  inside an M-C release they still read Reg M-B's copy. None is on the differential's path (checked: the
  differential never calls `packTeam`, `board.js` or the rollout leaf); they matter to SEARCH on Reg M-C.
- Commits and releases here are the worktree's; the release directory is untracked and exists only here.
