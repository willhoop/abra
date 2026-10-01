# Smogon September 2026 Reg M-C stats: fetched, folded into the spread hook, rotations re-spread (abra/regmc 1.72.0)

2026-10-01. SOLVER. Branch `worktree-agent-a603c160de3f04de2`. No games played; no ladder touched.

## Verdict

- The September files are in (16 files, 5.4 MB, tracked). Their spreads are already Champions Stat Points
  (no stat above 32, no total above 66 over 12,932 listed spreads). Nothing is converted.
- The observed hook now asks a chain. It starts with the bo3 file at 1760, then 1630, 1500 and 0, then the bo1 files in
  the same order. At each level it reads the set's battle forme (a mega stone keys the mega block) and the sheet nature.
  A spread is taken only if its weighted count is at least 25, and a Choice Scarf or Trick Room set only takes a spread
  that fits its Speed role.
- **Our role-derived spreads were far from what players run.** On the top-meta rotation the mean distance is 32 SP out
  of 66, and the Speed stat differs on 14 of 30 sets. On the 869 distinct tournament-store sets the mean distance is
  43 SP, and Speed differs on 441 of 804 covered sets. Hisuian Arcanine (Focus Sash, Jolly) reproduces 138 vs 156.
- All three ladder rotations are re-spread. The teams are unchanged, every team passes the TeamValidator, and 75 of 90
  sets changed spread.
- **The arena default is still `role-v1`.** A new table, `observed-v1`, is built beside it. At the default the arena
  now fields a different body from the ladder on 88 of 90 rotation sets.
- Choice Scarf at 1500+ is on 22.0% of bo3 teams and 28.7% of bo1 teams (both lower bounds). That supports Will's
  hypothesis.
- One test harness defect was found and fixed: `test-rotom-throttle`'s fake server.

## 1. The fetch

`ABRA_REGULATION=regmc node engine/fetch_smogon_stats.js 2026-09`. Runs 2026-10-01T20:05:21Z to 20:05:27Z, one request at
a time, user agent `ABRA-stats-archiver`.
Source: `https://www.smogon.com/stats/2026-09/<format>-<cutoff>.txt` and `.../moveset/<format>-<cutoff>.txt`, formats
`gen9championsvgc2026regmcbo3` (open sheet) and `gen9championsvgc2026regmc` (bo1), cutoffs 0/1500/1630/1760. The tool
needed no change: it reads both format ids from `engine/regulation.js`. Chaos JSON was not fetched because nothing reads it.

| | files | size |
|---|---|---|
| `data/smogon-stats/2026-09/usage/` | 8 | 228 KB (27 KB each) |
| `data/smogon-stats/2026-09/moveset/` | 8 | 5.2 MB (largest 931 KB, bo1-0) |

**Tracked**, like the Reg M-B months, under a new `.gitattributes` rule (`gen9championsvgc2026regmc*.txt -text`) so the bytes pinned by sha256 survive a CRLF checkout. Growth budget: 5.4 MB, with no file within two orders of magnitude of the
100 MB wall. `solver/arena/spreads/observed-v1.json` (2.6 MB) is tracked too.

`Total battles` (the month, before the cutoff weighting): bo3 223,477; bo1 1,631,943. Both formats carry Item
Clause. This was read from the validator's rule table (`itemclause`), not assumed.

**Encoding check.** All 12,932 listed spreads across the eight moveset files have max stat 32 and max total 66, which
are the format's per-stat cap and `evLimit`. These are Stat Points, not EVs, and no conversion is applied. A mega is
its own block under the mega forme name (for example "Salamence-Mega", items: Salamencite 100%).

## 2. The hook (`solver/rotom/spreads.js`)

- `parseMovesetFull` reads Raw count, Avg. weight, abilities, items, spreads and moves per block. `parseMoveset`
  keeps its 1.35.0 shape.
- `findObservedChain` takes the newest month and returns bo3 files with the highest cutoff first, then bo1 files.
  `findObserved` is unchanged: it returns the bo3 file at the highest cutoff.
- `loadObserved()` loads the whole chain. `loadObserved(file)` loads one level.
- `observedSpread(row, obs)` walks the chain. At each level it takes the highest-share listed spread for the set's
  BATTLE forme (`forme(row)`: a set holding its own mega stone reads the mega block) with the sheet's nature, under
  three conditions:
  - it is within the total and the cap;
  - its weighted count (Raw count x Avg. weight x share) is at least `OBS_MIN_WEIGHT` = 25, which was fixed before
    any coverage was read;
  - **Choice Scarf sets take only a spread with Speed at the cap, and Trick Room sets take only Speed 0.**
- The rule text is `OBSERVED_RULE_TEXT`, recorded in every `spread_source.observed`. `RULE_TEXT` (the derivation) is
  unchanged, so `role-v1` still opens.

**Why the item is only partly in the key.** Smogon publishes spreads and items as separate per-species marginals, so
the file cannot say which item a spread ran with. The item enters in the two places the data allows:

- **The mega stone selects the forme block.**
- **Choice Scarf constrains Speed.** This was found on the first pass: Choice Scarf Gholdengo (Modest) took the modal
  Modest spread with 10 Speed SP, 114 Speed against 136. A species+item+nature key as Will framed it needs joint data,
  and Smogon does not publish it. The tournament hook is keyed by species+item+nature, and it still runs first.

The order is: tournament hook, then the Smogon chain, then derived.

## 3. How far the role-derived spreads were (`solver/rotom/observed_compare.js`)

Writes `solver/out/rotom/observed-compare.json`. The derived spread is the rotation's recorded `derived` spread at HEAD
`1aa9b076` (what the ladder played), or for tournament sets the arena `role-v1` entry. 136 tournament sets the table did
not hold were derived the way the arena derives at play time (MediDeriver, the table's population, release
`eaa5becc54eb`). The Speed figures below are the Speed stat at the battle forme and sheet nature.

| sets | covered | L1 SP mean / median | Speed stat differs | mean abs Speed diff | observed faster / slower |
|---|---|---|---|---|---|
| top-meta rotation (30 derived) | 30 (all bo3-1760) | 32.3 / 32 | 14 | 5.5 | 5 / 9 |
| tournament rotation (28 derived) | 26 | 51.1 / 50 | 17 | 7.2 | 6 / 11 |
| default rotation (30) | 30 (28 bo3-1760, 1 bo3-1630, 1 bo3-0) | 32.1 / 30 | 14 | 5.3 | 6 / 8 |
| tournament store, 869 distinct sets | 804 (92.5%) | 43.3 / 42 | 441 | 8.1 | 163 / 278 |

The tournament store has 3,232 set uses, of which 3,145 are covered. On 1,826 of those uses the observed Speed differs
from the derived one.

On the tournament store's covered sets, the levels used are:

| level | sets |
|---|---|
| bo3-1760 | 590 |
| bo3-1630 | 131 |
| bo3-1500 | 59 |
| bo3-0 | 6 |
| bo1, all cutoffs | 18 |

Examples (Speed stat derived -> observed):

| set | Speed |
|---|---|
| Hisuian Arcanine, Focus Sash, Jolly | 138 -> 156 (94 tournament uses) |
| Garchomp, Life Orb, Jolly | 138 -> 169 |
| Kingambit, Adamant | 81 -> 71 |
| Raichu (Raichunite Y), Timid | 200 -> 190 |
| Incineroar, Careful | 103 -> 80 |
| Pelipper, Sitrus Berry, Bold | 117 -> 96 |

The derivation's main bias is that it over-invests Speed on slow bulky sets and under-invests it on fast attackers that
players max.

## 4. The rotations (re-spread, teams unchanged)

`node solver/rotom/respread.js --observed-only <rotation>` is a new mode. Each set takes the tournament hook first,
then the Smogon chain. A set neither serves keeps its RECORDED spread byte for byte, so the population, speed tiers and
store pin the file records are untouched. No store is needed. Every team re-validates (respread throws otherwise), and
only `evs` differ.

| file | spread changed | Speed stat changed (faster / slower) | sources now |
|---|---|---|---|
| `ladder-rotation.json` | 26 of 30 | 15 (6 / 9) | Smogon 27 (bo3-1760 25, 1630 1, 0 1), tournament 3 |
| `ladder-rotation-top.json` | 27 of 30 | 17 (5 / 12) | Smogon 25, tournament 5 |
| `ladder-rotation-tour.json` | 22 of 30 | 17 (6 / 11) | Smogon 26, tournament 2, derived 2 |

The tournament hook now serves the top-meta and default rotations as well (Sneasler Grassy Seed, Hisuian Arcanine,
Kingambit Chople Berry). It runs first by 1.66.0's design, and the store now holds pastes with Stat Points.

## 5. The arena (`observed-v1`, a new version; `role-v1` untouched)

`node solver/arena/build_observed_spreads.js` builds `solver/arena/spreads/observed-v1.json`. It needs no engine and no
store. Its keys are role-v1's 14,247 keys plus every rotation set. Each set is resolved in this order:

1. a rotation set takes its recorded spread (68);
2. otherwise the tournament hook (244);
3. otherwise the Smogon chain (11,227);
4. otherwise role-v1's entry (2,708).

Smogon sets by level:

| level | sets |
|---|---|
| bo3-1760 | 5,368 |
| bo3-1630 | 2,509 |
| bo3-1500 | 2,053 |
| bo3-0 | 631 |
| bo1-1760 | 104 |
| bo1-1630 | 221 |
| bo1-1500 | 231 |
| bo1-0 | 110 |

10,244 entries differ from role-v1, 6,695 of them in Speed.

`spread_source.js` gains mode `observed-v1`:

- It refuses to open if role-v1, the observed rule, or any pinned Smogon file (by sha256) has moved.
- An unseen set takes the pinned Smogon chain at play time (counted `observed_at_play`), and otherwise is derived as in
  role-v1.
- `bodyBuilder`, `stamp`, `mergeStamps` and `sprt.js`'s warnings now treat every table mode alike.
- **`DEFAULT` stays `role-v1`.**

**Series consequence (Will's call).** With the default left at role-v1, every arena, SPRT, gate or self-play game fields
role-derived bodies. The ladder now fields observed ones on 88 of 90 rotation sets: 78 from Smogon and 10 from the
tournament hook. Fitting and playing are mismatched again (CLAUDE.md). Switching the default to `observed-v1` restores
parity on all 90 sets: `test-arena-spreads` OBSERVED is 90/90, and 78/78 on Smogon sets. It also starts a new arena
series, because a figure at role-v1 is not comparable to one at observed-v1. `--spreads observed-v1` is available now
for any run that wants it.

## 6. bo3 vs bo1 (`solver/meta/smogon_month.js` -> `solver/out/meta/smogon-2026-09.json`)

The item rate per team is the sum of usage x the species' item share. With Item Clause, that is the share of teams
holding the item. **Every rate is a lower bound**, because blocks list top items only. The unlisted mass is 0.15
(bo3) and 0.18 (bo1) item slots per team.

**Choice Scarf at 1500+: bo3 22.0% of teams, bo1 28.7%.** This is consistent with fewer Scarves under open sheets. Our
own store's 24.5% of open-sheet teams is the figure from the brief, not re-measured here. The two are not the same
population: ours is public replays, unweighted.

Top 20 by usage, bo3 1630+:

| # | Pokémon | usage |
|---|---|---|
| 1 | Rillaboom | 55.77% |
| 2 | Sneasler | 42.59% |
| 3 | Incineroar | 40.47% |
| 4 | Kingambit | 30.59% |
| 5 | Gholdengo | 27.14% |
| 6 | Salamence-Mega | 25.22% |
| 7 | Raichu-Mega-Y | 22.21% |
| 8 | Basculegion | 17.30% |
| 9 | Floette-Mega | 16.59% |
| 10 | Arcanine-Hisui | 16.17% |
| 11 | Charizard-Mega-Y | 15.98% |
| 12 | Indeedee-F | 14.91% |
| 13 | Farigiraf | 14.44% |
| 14 | Archaludon | 13.36% |
| 15 | Sylveon | 12.93% |
| 16 | Garchomp-Mega-Z | 11.44% |
| 17 | Volcarona | 11.17% |
| 18 | Garchomp | 10.08% |
| 19 | Milotic | 9.91% |
| 20 | Staraptor-Mega | 9.91% |

The five items that differ most, bo3 minus bo1, per team, at 1500+:

| item | bo3 | bo1 | difference |
|---|---|---|---|
| Miracle Seed | 38.3% | 25.7% | +12.6 |
| Raichunite Y | 20.3% | 11.1% | +9.2 |
| Golisopite | 11.0% | 18.4% | −7.3 |
| Choice Scarf | 22.0% | 28.7% | −6.7 |
| Leftovers | 28.1% | 34.6% | −6.4 |

Two of these are mega stones, so they reflect species choice. The next two that are not stones are Life Orb (+6.0)
and Grassy Seed (+5.8).

## 7. DUSK fold-in

`node solver/dusk/smogon_foldin.js`. Before this pass it printed NOT PUBLISHED. It now reads the bo3-1760 file, and all
15 of the 15 endgame species are listed. The top-5 spread share has a median of 33%: Rillaboom is lowest at 11.1% and
Hisuian Arcanine highest at 91.2% (Golisopod-Mega 62%, Sneasler 50%). So the Smogon prior concentrates the spread worlds
only for a few endgame species. For most of them the mass is diffuse, and the "handful of world classes" premise does
not hold. The output is `solver/out/dusk/smogon-foldin.json` (untracked). No DUSK code or tracked artifact changed.

## 8. Tests

| test | result |
|---|---|
| `test-rotom-spreads` | GREEN 37/37. 1 NOT CHECKED: REPRODUCE, because store-fe78202a is not on disk, as before this pass. New clause OBSERVED: each of the 78 Smogon-served rotation sets matches an independent scan of its named file, and no earlier chain file serves it. HOOK gains a two-level chain fixture (weight floor fall-through, mega forme block, Scarf constraint). ROLE now also judges Smogon-served Scarf and Trick Room sets; TIER checks the rule over every `other` set. |
| `test-rotom-spreads`, deliberate breaks | Each goes RED: `--break observed` (OBSERVED), `scarf`, `trickroom`, `record`, `tier`, and env `SPREADS_BREAK=itemblind` (HOOK) and `SPREADS_BREAK=median` (TIER). |
| `test-arena-spreads` | GREEN 21/21. New OBSERVED clause: 90/90 parity at observed-v1. PARITY's Scarf and Trick Room checks now judge every set's role-v1 body (4/4, 2/2). The `scarf` break turns PARITY and OBSERVED red, and `stamp` turns RECORD red. Its RECORD clause plays its usual 1-pair `--cap 3` matches. |
| `test-body-parity` | GREEN 7/7 at role-v1 (both breaks red), and 7/7 with `ARENA_SPREADS=observed-v1 --no-red`. |
| `test-rotom-ladder` | GREEN 161/161. |
| `test-rotom-top-rotation` | GREEN 9/9, with 1 NOT CHECKED (the store moved), as before. |
| `test-tournaments` | GREEN 44/44. |
| `test-rotom-throttle` | **RED 16/19, then GREEN 33/33 after a harness fix.** Run in this worktree with `SHOWDOWN_PATH` set. |

The `test-rotom-throttle` failure:

- **Cause.** The fake server plays one game of the bo3 and ended the series `|win|<game-1 winner>`.
  `solver/rotom/endings.js` correctly reads a game-1 loss ended that way as OUR walkaway. That is a self-quit, so the
  ladder halted and K16's "next search" never came.
- **Why it surfaced now.** The test passed only because our seeded game 1 happened to be a win. HEAD's rotation won
  that game and the new spreads lost it (Gardevoir-Mega is now less bulky). Control: HEAD rotation green 33/33, new
  rotation red three times.
- **Fix.** The scripted opponent now forfeits the series after game 1 whatever the result. That is the only one-game
  end of a real bo3 that is not ours.
- **Client crash.** One rerun crashed the client at start with exit 3221226505 (0xC0000409). It did not reproduce on
  the next run.

## 9. Addendum (abra/regmc 1.73.0): the arena default is now `observed-v1`

Will approved this on 2026-10-01.

**The default lives in one place.** `spread_source.js` `DEFAULT` is now `observed-v1`. Every caller reads it:

- `arena.js` and `teams.js` `defaultSpreads`;
- `mew/play.js` and `mew/run.js`;
- `machamp/sprt.js` and `machamp/gate.js`;
- `chomp/plan.js` and `chomp/v1/gen.js`.

Their usage strings were updated. `role-v1`, `flat` and `xatu-random` stay selectable. `chomp/v1/gen.js` keeps games of
each mode in their own directory and refuses to resume a file of another mode.

**This is a MINOR.** Arena strength is withheld from the living documents, so the declared basis is not a published
figure, as in the 1.49.0 precedent. The Record states that a new arena series starts at 1.73.0.

**CHOMP v2 is pinned.** `chomp/v2/build_spreads.js` passes `{ observed: null, tournament: null }` to every Deriver.
`test-chomp2` PIN checks it.

**Tests**, all GREEN, with every deliberate break going red:

| test | result |
|---|---|
| `test-arena-spreads` | 24/24; RULE red under `SPREADS_SOURCE_BREAK=default` |
| `test-body-parity` | 8/8 at the default; DEFAULT red under the same break |
| `test-machamp` | 112/112 |
| `test-miltank` | 3992/3992 |
| `test-honest-info` | 1954/1954 |
| `test-chomp2` | 32/32 |

`test-honest-info` needs the frozen store, which this worktree does not hold. I hardlinked main's files in for the run
and removed the links afterwards.

## OWED, NOT RUN

- **Restart the ladder on a NEW `--out` after merging.** The rotation bytes changed and the team ids did not.
  `solver/rotom/ladder.js` records `rotation_sha256` in the plan, but its restart check compares only the digest (seed,
  arms, team ids). A resumed batch on the old `--out` would mix role-derived and observed spreads in one series with no
  refusal. Teaching the plan check to refuse a rotation-sha change is owed. It was not done here, with a batch live.
- **Arena default.** Switched to `observed-v1` at 1.73.0 (§9).
- **CHOMP v2.** Pinned at 1.73.0 (§9).
- **XATU / ROTOM opponent belief** still draws opponent spreads without this prior. Using the Smogon chain as the
  spread prior for hidden opponent bodies is the natural next use and was not attempted.
- **The derivation itself is biased** (§3). It over-invests Speed on bulky sets and under-invests it on fast attackers.
  It now serves only 2 of 90 rotation sets and 2,708 of 14,247 arena sets, but it is still the fallback.
- **REPRODUCE** remains NOT CHECKED. `git show 27825c32:data/games.gen9championsvgc2026regmcbo3.jsonl.gz` would
  restore store-fe78202a.
- `node engine/status.js --write` must be run from the main checkout after the merge. It was not run from this
  worktree.
- The monthly fetch of October (about 2026-11-01) can use the same command. `findObservedChain` takes the newest
  month, and `observed-v1` pins September by sha256, so October means a new table version.
