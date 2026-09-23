# Both MEDICHAM gates, read on the finished engine: 2026-09-23 (MEASURE, abra/regmc 0.70.0)

Measured in the MAIN checkout at HEAD `e58a2f55` (abra/regmc 0.69.1). No file under `engine/`, `tests/` or `tools/`
moved during the pass. One release was cut per regulation, because a release id is a function of the tree AND the
regulation (`engine/engine_release.js`). Every run in this pass opened the release for its own regulation:

| | release | authority |
|---|---|---|
| Reg M-B | `89ac57f1f81b` | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit) |
| Reg M-C | `485d0a6840ad` | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` (selected by `ABRA_REGULATION=regmc`) |

These are the same ids that the worktree passes 7 and 8 cut. The two trees are the same bytes. Before this pass, the
Reg M-C manifest was absent in main, so the Reg M-C gate could not open it. The re-cut appended a cut event and
rewrote `data/engine-release-regmc.json` (still untracked).

Every heavy run went through `tools\lownode.cmd` at BelowNormal, one at a time. They were started through a node
`spawnSync('cmd.exe', ['/c', 'tools\\lownode.cmd', ...])` argument vector, as the wrapper's header requires from Bash.
Exit codes were checked, and so was each artifact's `generated` stamp, its `engine_release` and its size. No run was
diverted by `publish_guard`.

## What was regenerated

| artifact | generated (Z) | release | result |
|---|---|---|---|
| `data/mechanics-census.json` | 04:17:33 | live tree = `89ac57f1f81b` bytes | 1004/1004 live, run_ok. Pinned as `data/verification/census-pin-833a997d7e42.json` |
| `data/mechanics-census-regmc.json` | 04:18:49 | live tree = `485d0a6840ad` bytes | 1006/1006 live, run_ok. Pinned as `data/verification/census-pin-regmc-0d03e83f0e65.json` |
| `data/game-differential.json` (1200) | 04:23:45 | `89ac57f1f81b` | board-material **0 / 961**, protocol-only 0 |
| `data/game-differential.g1350.json` | 04:28:58 | `89ac57f1f81b` | **0 / 1069**, protocol-only 1 |
| `data/game-differential.g1950.json` | 04:38:30 | `89ac57f1f81b` | **0 / 1497**, protocol-only 2 |
| `data/roster.{items,moves}.json` | 04:38 / 04:47 | `89ac57f1f81b` | see the gate |
| abilities stage, Reg M-B | 04:42 | `89ac57f1f81b` | **NOT republished.** Kept at `data/verification/roster.abilities-89ac57f1f81b-proxy-threw.json` (see below) |
| `data/all-mechanics-fire.json` | 04:47:55 | `89ac57f1f81b` | 4632 games, 0 threw |
| `data/engine-diff.json` | 04:53:01 | `89ac57f1f81b` | 0 / 6000 at every roll index |
| `data/verification/game-differential.g12000.json` (held out) | 05:44:04 | `89ac57f1f81b` | **1 / 7182** board-material (below) |
| `data/engine-diff-regmc.json` | 05:46:53 | `485d0a6840ad` | **3 / 6000** at every roll index; the run exits 1 (below) |
| `data/roster.{items,abilities,moves}-regmc.json` | 05:49 / 05:50 / 05:53 | `485d0a6840ad` | see the gate |
| `data/game-differential-regmc.json` (1200) | 06:00:38 | `485d0a6840ad` | **0 / 955** (954 usable + 1 void), protocol-only 64 |
| `data/game-differential.g1600-regmc.json` | 06:56:48 | `485d0a6840ad` | **0 / 1266**, protocol-only 82 |
| `data/game-differential.g1900-regmc.json` | 07:02:51 | `485d0a6840ad` | **0 / 1497**, protocol-only 92 |
| `data/all-mechanics-fire-regmc.json` | 07:03:24 | `485d0a6840ad` | 4877 games, 0 threw |

The lattice pins for both regulations were `--steering empirical --arm middle --end-state`, the census pin above, and
`--team-store data/team-pool-frozen` or `data/team-pool-frozen-regmc`. The flags were `--games 1200/1350/1950` for
Reg M-B and `1200/1600/1900` for Reg M-C. The Reg M-C lattice is 1600/1900, not 1350/1950, because that is what
`engine/lattice_walk.js` derives for it and what the Reg M-C gate reads. The bar is `state.games −
state.games_board_never_diverged`.

The coordinator's resume check: the previous session ended after the Reg M-C 1200 lattice. Every artifact above was
already written by then. Each carried the correct release, a full-size body and an `##EXIT 0` line in its own log, so
none was re-run. The Reg M-C 1600 and 1900 lattices and `all-mechanics-fire-regmc` had not been started, and they ran
after the resume.

## Why the Reg M-B abilities stage was not republished

The living-docs gate refused the first commit attempt. `docs/SUMMARY.md` and `docs/ABRA-technical-docs.md` publish
"196 of 200 in scope tested" out of `data/roster.abilities.json`, and the re-run reads 189. Those 7 rows were lost to
the ruler (the proxy throw below), not to the engine. Replacing a published artifact with a reading from a known-broken
ruler would put a wrong figure behind a published one. So `data/roster.abilities.json` and its `.prev` stay at HEAD
(release `2e9db8bb11fd`), and this pass's reading sits in `data/verification/`. The abilities clause therefore reads
MEASURED AGAINST A DIFFERENT ENGINE until the ruler is fixed and the stage is re-run.

## Reg M-B gate: CLOSED, 3 of 10 gating clauses fail. All three are the roster, and none is an engine defect

| clause | verdict | reading |
|---|---|---|
| game differential (damage) | PASS | 0 / 6000 at the midpoint, at both corners and at all 14 interior indices |
| deliberate roster / items | **FAIL** | 0 DIFFER, 0 DID-NOT-FIRE, 148/148 tested. Fails on **17 fixture sets the TeamValidator refuses** |
| deliberate roster / abilities | **FAIL** | Read on the regenerated artifact before it was withdrawn: 0 DIFFER, 0 DID-NOT-FIRE, 189/200 tested, **7 COULD-NOT-STAGE** plus **77 refused fixture sets**. As committed: STALE (release `2e9db8bb11fd`) |
| deliberate roster / moves | **FAIL** | 0 DIFFER, 0 DID-NOT-FIRE, 496/497 tested. Fails on **47 refused fixture sets** |
| coverage | PASS | all 412 moves above 25 clicks are measured |
| board leaves | PASS | 0 uncompared leaves |
| whole-game BOARD-MATERIAL | PASS | 0/961, 0/1069, 0/1497 |
| whole-game NARRATION | PASS | 0 undeclared on every lattice |
| mechanics staged | PASS | 0 diverge, and no control arm parted a board |
| no open known engine defect | PASS | 194 verdicts read. **The verdicts are STALE**: `data/register-reality.json` dates from 2026-09-12 and is older than `docs/ROADMAP.md` |

**Why the roster turned red on a re-measurement: two RULER causes.**

1. **Fixture legality is new in the roster's receipt.** `tests/roster.js` has stamped `fixture_legality` since
   0.40.0, and `engine/quarantine.js` counts every NOT-baselined refused set against the clause (line ~898). The
   comment there says *"an artifact written before the field existed (every Reg M-B roster artifact) carries none …
   so the closed regulation's verdict is unchanged."* **That held only until a Reg M-B roster was re-run**, which this
   pass did. The previous artifacts (`*.prev.json`, release `2e9db8bb11fd`) carry no block. The refusals are learnset
   problems in the fixtures ("Kangaskhan can't learn Bitter Blade", "Beedrill can't learn Baneful Bunker"). They say
   nothing about the engine. Reg M-C refuses 17/80/47 of its own fixture sets.
2. **Seven abilities are COULD-NOT-STAGE because a shape rule throws**: Iron Fist, Mega Launcher, Reckless,
   Sharpness, Strong Jaw, Technician and Tough Claws. The error is `'get' on proxy: property 'shortDesc' is a
   read-only and non-configurable data property … expected '' but got 'Var…'`. Cause, derived: the text-filling proxy
   that `tests/roster.js` added in 0.40.0 (lines ~209-235) wraps any entity whose `desc`/`shortDesc` is empty. Reg
   M-B's checkout carries 16 Hidden Power typings (plus Nihil Light, which has no text) with those properties set to a
   frozen `''`, while the text table holds "Varies in type…". A Proxy may not report another value for a frozen
   property, so every rule that walks `moves.all()` throws. On the previous release all seven were
   FIRED-AND-BOARDS-MATCH. A one-line guard (leave an entity unwrapped when its text property is non-configurable)
   was written, and **reverted without being run**. The environment refused to run a modified instrument in this
   pass, and MEASURE does not ship an unmeasured ruler change. It is owed below.

## Reg M-C gate: CLOSED, 7 of 10 gating clauses fail

| clause | verdict | reading |
|---|---|---|
| game differential (damage) | **FAIL, REAL RED** | 3 / 6000 at every index. Worst by use: **Scizor-Mega Dual Wingbeat → Dragonite-Mega** (8105 uses; authority x2 61-73, MEDICHAM 40-48); **Heracross-Mega Pin Missile → Dragonite-Mega** (authority x5 67-81, MEDICHAM 35-45); **Forretress Pin Missile → Mimikyu** (authority x5 24-28, MEDICHAM 96-112). All three are a **multi-hit volley into a first-hit damage shield**: Dragonite-Mega's only ability is Multiscale, and Mimikyu's is Disguise (read from `Dex.forFormat('gen9championsvgc2026regmc')`). Reg M-B reads 0 on the same harness. **Separately, the run exits 1**: `SUBPASS` lacks **Overdrive**, a Reg M-C move with 0 uses. |
| deliberate roster / items | **FAIL, RULER** | 0 DIFFER, 166/166. 17 refused fixture sets |
| deliberate roster / abilities | **FAIL, RULER** | 0 DIFFER, 210/214. 80 refused fixture sets |
| deliberate roster / moves | **FAIL, RULER** | 0 DIFFER, 510/511. 47 refused fixture sets |
| coverage | PASS | 269 moves |
| board leaves | PASS | 0 uncompared |
| whole-game BOARD-MATERIAL | PASS | 0/955, 0/1266, 0/1497 |
| whole-game NARRATION | **FAIL, CANNOT-ANSWER** | No `whole-game-baseline-regmc`, so the first run fails by design and someone must stamp it deliberately (`--stamp-whole-game`). **Not stamped here; that is a decision.** The undeclared protocol-only counts are 64/955, 82/1266 and 92/1497 (field, emission, ordering, rule) |
| mechanics staged | **FAIL, REAL RED plus UNPROVEN** | 4 of 8 diverging mechanics are played and uncleared: **Inner Focus, Oblivious, Scrappy, Own Tempo**. `all-mechanics-fire-regmc` also prints **Guard Dog** and **Rattled** as STATE divergences: the authority ends at +1 (Atk and Spe) and MEDICHAM at 0 on the turn-0 entry. The whole family is **the Reg M-C Intimidate-reaction abilities**. Also 7 in-scope mechanics are unproven: Court Change and Revival Blessing (resolved on neither engine), Liquid Ooze, Stakeout and Binding Band (did not fire), Emergency Exit (fired, no control arm), Aura Guard (no row). |
| no open known engine defect | **FAIL, CANNOT-ANSWER** | `register-reality-regmc` has never been produced |

The Reg M-C roster reads 0 DIFFER on the Intimidate family while `all_mechanics_fire` reads a STATE divergence on
Guard Dog and Rattled. The two instruments stage those abilities differently. ENGINE should reproduce the divergence
with a probe before treating either reading as settled.

## The Reg M-B held-out draw: 1 board-material game of 7,182

`--games 12000` on `89ac57f1f81b`: 7,182 usable games, 7,181 whose boards never parted, 1 void, and 74 protocol-only
games. The one game is `gen9championsvgc2026regmbbo3-2654803462 vs …2654804597`, config `omit-intimidate`, turn 3.
**Samurott's Ceaseless Edge into Garchomp:** Samurott faints to Rough Skin on the hit. Showdown does not add a Spikes
layer (it emits `|faint|`), and MEDICHAM does (`|-sidestart|p2: |move: spikes`). So `p2.hazards.spikes` reads
MEDICHAM 2 against Showdown 1. **This is a real engine red and ENGINE owns it.** It is not a gate clause. The previous
held-out draw on `2e9db8bb11fd` read 0 / 7182, so a change since then either introduced this game or re-dealt the
sample so that it now appears.

## Commit

The regenerated artifacts (except the Reg M-B abilities stage), the census pins and `data/published-samples-regmc.json` (the publish guard's ratchet,
declared per regulation in `engine/regulation.js`) were committed on main, with `data/engine-release.json` and the
status-stamped ledgers. **Not committed:** `data/*.prev-regmc.json` and `data/roster-regmc.json`. No earlier Reg M-C
roster commit tracked them, and Reg M-B's `*.prev.json` are tracked only from before the Reg M-C line. Also not
committed: `data/engine-release-regmc.json`, which was untracked at the start and stays that way. Not pushed.

## OWED, NOT RUN

- **ENGINE: Ceaseless Edge lays Spikes after its user faints to Rough Skin** (Reg M-B held-out, 1/7182). Needs a probe.
- **ENGINE: Reg M-C multi-hit volleys into Multiscale (Dragonite-Mega) and Disguise (Mimikyu)**, 3/6000 in
  `engine-diff-regmc`. Needs a probe, and ENGINE must first rule out the harness's volley path.
- **ENGINE: Reg M-C Intimidate-reaction abilities** (Inner Focus, Oblivious, Scrappy, Own Tempo, Guard Dog, Rattled)
  diverge in `all-mechanics-fire-regmc`, while the roster calls them clean. Reconcile the two instruments first.
- **ENGINE: `SUBPASS` lacks Overdrive** under Reg M-C (the `tests/test-engine-diff.js --regulation regmc` exit 1).
- **Reg M-C proof gaps:** Court Change, Revival Blessing, Liquid Ooze, Stakeout, Binding Band, Emergency Exit and
  Aura Guard.
- **MEASURE (ruler): `tests/roster.js` text proxy on frozen properties.** Guard it and re-run
  `SHOWDOWN_PATH=… tools\lownode.cmd tests/roster.js --stage abilities --reds --write --release 89ac57f1f81b`. The 7
  COULD-NOT-STAGE rows should return to MATCH, and the Reg M-C stages should read the same.
- **MEASURE / decision: fixture legality in the roster clause.** The clause now fails both regulations on refused
  fixture sets (17/77/47 for Reg M-B, 17/80/47 for Reg M-C), and it did not fail Reg M-B before only because the old
  artifacts lacked the field. Either repair the fixtures (derive each carrier's moves from its learnset) or baseline
  them. **That is Will's call, not a restamp.**
- **Decision: the Reg M-C whole-game narration baseline** (`node engine/quarantine.js --regulation regmc
  --stamp-whole-game`). The bar must be chosen, not defaulted.
- **`node engine/register_reality.js`** for Reg M-B (verdicts are stale, dated 2026-09-12) and under
  `--regulation regmc` (never run). Each runs every marked instrument, is long, and was not run here.
- **Releases `89ac57f1f81b` and `485d0a6840ad` are untracked** (`data/releases/` is ignored). By the `.gitignore` rule,
  track them only if a published record comes to rest on them.
- Not pushed; the coordinator pushes.
