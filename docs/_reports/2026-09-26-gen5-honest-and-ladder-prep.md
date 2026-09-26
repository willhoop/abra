# 2026-09-26 — gen5 under honest information, ROTOM `miltank-gen5`, and the gen5-vs-prior ladder arms

SOLVER. Engine: frozen release `eaa5becc54eb`. Team store: `data/team-pool-frozen-regmc` (pool digest `792daded918f`,
`games.bo3.jsonl` sha256 `a68263bb568d`), both copied from the main checkout into this worktree's gitignored paths.
The sandbox refused `cmd.exe`, so `tools\lownode.cmd` could not be called from this session: every heavy run went
through a node launcher that sets itself BELOW_NORMAL before it spawns (Windows children inherit the class), and
`solver/mew/play.js` also sets BELOW_NORMAL in-process. At most 3 workers from this work at any time; one run at a time.
A live ladder run (aa2, main checkout) shared the machine throughout. Nothing in the main checkout was touched.

## Verdict

- **The margin survives honest information.** gen5 against DODUO-greedy, pre-registered SPRT (elo0 0, elo1 +20,
  α = β = 0.05, ≤ 2,000 games), same seeds as the omniscient run:

  | budget | honest (this report) | omniscient (2026-09-26 earlier run) |
  |---|---|---|
  | 1 s | **H1 at 100 games, 71–29 = 0.710 [0.615, 0.790]** | H1 at 180 games, 0.628 [0.555, 0.695] |
  | 5 s | **H1 at 104 games, 74–30 = 0.712 [0.618, 0.790]** | H1 at 64 games, 0.766 [0.649, 0.853] |

  Wilson 95% at a data-dependent stopping time (conditional on the stop, slightly optimistic). The honest arm plays a
  different GAME (spreads exist in the true battle), so the two columns are not a test of each other; the intervals
  overlap at both budgets. Clock-safe at both: slowest gen5 decision 1.37 s / 6.50 s, heaviest game 17.4 s / 89.7 s
  of gen5 decision time, against the 55 s turn and 420 s bank.
- **ROTOM is ready to play gen5**, pending Will's OK for a ladder series. New policy `miltank-gen5`: 3 local bo3 sets
  (7 games) against `prior` and a 16-series ladder DRY RUN with the new arms file, **0 timeouts, 0 invalid choices,
  0 fallbacks** in both; every gen5 decision searched with XATU's posterior.
- **test-machamp REBUILD is fixed**: the vocabulary `build_doduo.js` needs is now tracked beside the model and checked
  against it; it no longer reads an untracked build output.
- **Correction to the earlier report (abra/regmc 1.15.0, renumbered from 1.14.0 at the merge with the ROTOM throttle fix)**: the omniscient arena did NOT let the search see the opponent's unrevealed
  back line — `rollout.js sampleWorld` redrew it uniformly per world. What it saw that a player cannot was exact HP,
  and it faced no hidden spreads because none existed.

## 1. test-machamp REBUILD (task 1)

`solver/machamp/build_doduo.js` read `--meta solver/out/mag/meta.json` by default — the untracked output of
`solver/mag/build_features.js`, present in three agent worktrees and in neither the main checkout nor this one.

- **Located, verified, pinned.** The three copies (`agent-aab7de2f…`, `agent-acd109a9…`, `agent-ae26f145…`) all carry
  dataset digest `9d07c522…4c8`, the digest MAG v1 and DODUO v1 record, and differ only in `generated` and
  `seconds`. Their vocabulary and feature names are now tracked as `solver/mag/model/mag-v1.vocab.json` (26.7 KB,
  with the source file's sha256).
- **The default moved to the tracked file**, and whatever `--meta` names is REFUSED unless its dataset digest equals
  the MAG model's and every embedding row of the model (`move_rows`, `species_rows`) is in its vocabulary. The output
  meta records `human_meta.file` and `human_meta.sha256`, so the source is never silent.
- `train_doduo.py` still needs the full human tensors (`--human solver/out/mag`) for a real MACHAMP generation; its
  own assertion (self-play vocabulary == human build vocabulary) holds because the pinned vocabulary is identical.
- Result: `test-machamp --only RECORD,REBUILD` GREEN 35/35; the full run is in §6.

## 2. The honest arena (task 2)

`solver/mew/play.js --info honest|omniscient`. **Honest is the default for a match**, so `sprt.js` and `gate.js`
(both now take `--info`, default honest, recorded in the result) make every new strength claim honestly.
`omniscient` is kept as a labelled option. Self-play keeps `omniscient` as its default, and the MACHAMP loops
(`loop.js`, `loop_sprt.js`) now pass `--info omniscient` explicitly, because their recipes were pre-registered on
that arena; moving them is a new pre-registration.

The one implementation is `solver/xatu/worlds.js`, shared with ROTOM (§4).

**The true battle has hidden information.** Every body on both sides carries a Stat Point spread drawn per team pair
by XATU's own self-play generator (`selfplay.js randomSpread`), seeded by the battle seed (both seatings of a pair play
the same truth), under the sheet's nature. The sheet carries the nature (Champions `|showteam|`); the pool's `evs` is
null on every row, so the spread is exactly what a player does not know.

**Each decision of BOTH bots is taken on the decider's public view** (`arenaView`):

| | what the view holds |
|---|---|
| own side | exact (a player knows their own spreads) |
| opponent, revealed | identity, status, boosts, item, mega forme as they are; stats at ZERO SP under the sheet nature; HP laid at the middle of the percentage the Champions client shows, `floor(100·hp/max) \|\| 1` (pokemon-showdown-mc `sim/pokemon.ts` getHealth, `champions` branch, L2066–2068 at `f10d679`) |
| opponent, unrevealed | the MAP back pair of XATU's posterior (never the truth) |

**gen5's worlds** draw the back pair from XATU's back-pair posterior (`bring.js`, game 1 of a series, no memory —
what ROTOM holds at a series' first game) and every opponent body's spread from XATU's spread belief (the uniform
prior; **no observations are fed, in the arena or in ROTOM** — feeding the tracker's order and damage observations is
owed to both at once). Max HP follows the sheet species (Showdown never recomputes it on a forme change); the other
stats follow the current forme. `applySpread` is checked stat-for-stat against the checkout's `statModify`.

**Residual differences from a ladder player**, declared: the opponent's in-body hidden counters that `world.js` does
not lay either (sleep and confusion counters, PP) stay as in the truth; the public history DODUO features read rounds
HP to the nearest percent instead of the Champions floor (±1%). Neither is a spread or a back-line leak.

**The check**: `solver/tests/test-honest-info.js`, GREEN 1954/1954:

- STATS: 720 stats on 120 real sheet rows under random spreads equal the checkout's `statModify` (HP included).
- DISPLAY: the display rule, and `hpFromPct` round-trips for every HP of five max-HP values.
- VIEW: 68 decisions on 6 TEST pairs: own side exact; every revealed opponent body at the true displayed percentage
  and at its zero-SP line (the true line differed on 199 of 199); every hidden slot from the MAP pair (it differed from
  the truth on 34 of 73); a posterior that sums to 1 and contains every revealed back row.
- WORLDS: filled rows only from pairs with p > 0; each revealed body takes ≥ 5 distinct stat lines over 40 worlds.
- MATCH: `play.js` with no `--info` is honest on every line; truth spreads on 16/16 bodies; views = decisions.
- **RED**: `HONEST_BREAK=peek` (the view is the true battle, no belief) turns VIEW red. Shown before trusting green.

## 3. gen5 against DODUO-greedy, honest (task 3)

Pre-registered before the first game: `solver/results/2026-09-26-gen5-honest/preregistration.json` (code commit
`a2c3cd88`). X = `solver/machamp/league/gen5.json` (1 s) and `solver/results/2026-09-26-champ-vs-doduo/gen5-5s.json`
(5 s); Y = `solver/machamp/league/human-clone.json` (= ROTOM `prior`). Flags `--release eaa5becc54eb --workers 3
--cap 50 --max-games 2000 --team-store data/team-pool-frozen-regmc --info honest`, seeds 26001 / 26005 (the omniscient
run's). Read once each, at the bound, with `sprt_read.js`; both recounts agree with the SPRT.

| arm | verdict | LLR | games | W–L | score, Wilson 95% | pairs both / split / lost | Elo est. |
|---|---|---|---|---|---|---|---|
| gen5 1 s honest | **H1** | 3.094 | 100 | 71–29 | **0.710 [0.615, 0.790]** | 24 / 23 / 3 | +156 |
| gen5 5 s honest | **H1** | 2.963 | 104 | 74–30 | **0.712 [0.618, 0.790]** | 26 / 22 / 4 | +157 |
| gen5 1 s omniscient | H1 | 3.008 | 180 | 113–67 | 0.628 [0.555, 0.695] | 32 / 49 / 9 | +91 |
| gen5 5 s omniscient | H1 | 2.968 | 64 | 49–15 | 0.766 [0.649, 0.853] | 18 / 13 / 1 | +206 |

Artifacts: `solver/results/2026-09-26-gen5-honest/sprt-gen5-{1s,5s}-honest{,-read}.json`.

| arm | gen5 ms/decision mean / p95 / max | per-game sum mean / p95 / max (s) | playouts / searched decision | prior fallback | agent fallback |
|---|---|---|---|---|---|
| 1 s | 962 / 994 / 1,371 | 8.5 / 14.2 / 17.4 | 84.7 | 0.55% (5 of 913) | 0 |
| 5 s | 4,714 / 4,739 / 6,498 | 42.4 / 70.7 / 89.7 | 551.2 | 0 | 0 |

**Honest capability counters** (each worker's last line, every game played): 1 s — 1,828 views, 1,828 XATU
posteriors, 0 posterior errors, 5,314 worlds, 21,256 spreads drawn, 0 uniform back-line fallbacks; 5 s — 1,932
views, 1,932 posteriors, 0 errors, 33,736 worlds, 134,944 spreads drawn, 0 uniform fallbacks.

**Reading.** At both budgets gen5 is proven stronger than DODUO-greedy when it sees only what a player sees. The
honest 1 s margin is not lower than the omniscient one; the likely reasons are that the "omniscient" arena was less
omniscient than it was called (it drew the back line uniformly, where honest mode uses XATU's posterior) and that the
game itself changed. Neither is measured here, and the arms are not tested against each other. 1 s and 5 s are not
distinguishable under honest information on these samples.

Mega timing, recorded not concluded from (human band 0.2225 ± 0.15): gen5 delays 0.396 [0.301, 0.498] of its megas at
1 s and 0.300 at 5 s; DODUO-greedy 0.192 and 0.152. The 1 s interval still reaches the band, so the pre-registered
check (`solver/tests/test-mega-timing.js` rule) would not fail it, but it sits higher than in the omniscient run (0.228).

## 4. ROTOM `miltank-gen5` (task 4)

`solver/rotom/policy.js`, selected by `--policy miltank-gen5` or a ladder arm:

- **Nets**: gen5 MAG + DODUO as the candidate prior and gen5 PORYGON2 as the leaf; k 4×4, depth 0, 1 reserved switch
  row, all read from `solver/machamp/league/gen5.json` (its `budgetMs` is not used). Digests are stamped into the run's
  provenance (`mag 65e76caf2423`, `doduo abb0b88dd573`, `pory2 cf8ad3f7bd0d`).
- **Belief, exactly as the honest arena**: the `world.js` build becomes the ROOT view through `XW.publicOpp` (zero SP
  under the nature, HP at the displayed percentage from the parsed public state); the worlds come from
  `XW.rollout({ back: XATU backTwo, spreads: XATU spread prior })`. Same module, same functions.
- **Preview**: the rotation team's own human bring, as the arena plays the humans' own bring.
- **Forced switch**: each candidate scored by the same searcher at an equal share of the budget (the arena has no
  forced-switch decision; the engine refills there).
- **Clock**: the clock's budget (`clock.js`), capped by the arm's `max_ms`; under the search floor or with an unknown
  bank after a rejoin it drops to `prior` (counted); any throw drops down the chain to `prior`. **Lean** playouts
  (`rollout.js` default), the **hard deadline** (`search.js`), and the **idle GC** after every searched choice now
  apply to every searching policy (`SEARCHES` in `rotom.js`), not only `miltank`. **Warm-up** loads the gen5 nets,
  its leaf and XATU's spread belief before connecting whenever the policy or any arm uses it (1.4 s).
- `rotom.js` changes are confined to the policy lists, the three clock/fallback/GC branches in `decide()` and the
  warm-up. Nothing in `send()` or the orphan logic (another agent's branch).

**Tests.** `test-rotom.js` GREEN 105/105, with new POLICY and GEN5 clauses: a request-legal move and forced switch,
the gen5 digests, searched worlds, every revealed opponent body at its displayed percentage and zero-SP line, forced
switch candidates scored, preview = the human bring.

**Local bo3 sets** (`run_local.js --sets 3 --a miltank-gen5 --b prior --a-args "--release eaa5becc54eb --max-ms 5000"`,
port 8791): 3 series, 7 games, **0 timeouts, 0 invalid, 0 crashed sets**; 61 gen5 decisions (7 preview, 45 move, 9
forced switch), 0 fallbacks, 0 search fallbacks, slowest decision 4.87 s (5.11 s from the request), lowest bank
404.8 s; idle GC 61 times, max 272 ms; replays 7/7 saved locally; 0 public connections. gen5 took 2 of the 3 sets
(too few to mean anything).

**Ladder DRY RUN with the new arms** (`run_ladder.js --dry-run --arms solver/rotom/arms/gen5-vs-prior.json
--ladder-seed dry-gen5-2026-09-26 --sets 8 --port 8797`): 16 series rows (arm A 11, B 5), 0 guard incidents, 0
orphans, 0 blocked public connections; both clients **0 timeouts, 0 invalid, 0 fallbacks**; 232 gen5 move and 37 gen5
forced-switch decisions, all searched, 0 search fallbacks, 0 missing XATU posteriors, slowest 5.20 s (5.69 s from the
request).

## 5. The ladder arms (task 5)

`solver/rotom/arms/gen5-vs-prior.json`, in the style of `miltank-vs-prior.json`: arm A `miltank-gen5`, `max_ms` 5000
(honest H1, 0 prior fallbacks, heaviest game 89.7 s of the 420 s bank); arm B `prior`. Same assignment (sha256 of
seed|k|arm), metric (per-series residual S − E), 1300 burn-in, SPRT (mean residual A − B, σ 0.5, H0 0 vs H1 +0.07,
α = β = 0.05, read once at a bound) and headline (mean rating over the last N ≥ 100 series ± SD, never the peak).

**The command, for Will — not run.** From the main checkout, after the ROTOM `send()` throttle fix is on main and the
LADDER.md §1 checks pass:

```cmd
node solver\rotom\run_ladder.js --public --name medicham32 --release eaa5becc54eb --arms solver\rotom\arms\gen5-vs-prior.json --ladder-seed medicham32-gen5ab-2026-09-26 --sets 50 --tag gen5ab --priority normal
```

## 6. Regression and gates

- `solver/tests/test-honest-info.js` GREEN 1954/1954; RED under `HONEST_BREAK=peek`.
- `solver/tests/test-machamp.js --release eaa5becc54eb` **GREEN 100/100**, all nine deliberate breaks RED (REBUILD
  included: it runs on the tracked vocabulary now).
- `solver/tests/test-rotom.js` GREEN 105/105; `solver/tests/test-rotom-ladder.js` GREEN 106/106.
- `solver/tests/test-miltank-deadline.js --no-red`: the first run was 15/16, SEARCH red on "pool: only 73% of decisions
  solved without load" — a load-sensitive clause (its "no load" control ran beside this session's work and the live
  ladder run), in files this change does not touch (`search.js`, `pool.js`, `cells.js`, the bench). Re-run of the
  clause: 6/6 GREEN (pool 100%, serial 87%, both over its 80% floor).
- `tests/test-docs-current.js` 39/39.

**After merging the ROTOM throttle fix (origin/main `4a24d6ea`, abra/regmc 1.14.0; this change renumbered to 1.16.0,
the gen5-vs-DODUO one to 1.15.0).** `rotom.js` keeps both: the paced send and `runVerify` after every choice, and the
gen5 policy lists and branches. `test-rotom` 105/105, `test-rotom-throttle` 33/33, `test-rotom-applied` 31/31,
`test-rotom-ladder` 114/114, `test-rotom-private-series` 25/25, `test-honest-info` 1954/1954, `test-docs-current`
39/39. (`test-rotom-throttle` and `test-rotom-applied` need `SHOWDOWN_PATH` set when run from a worktree:
`solver/human/dex.js` looks for the checkout one directory above the repository.)

Ladder dry run after the merge (`--arms solver/rotom/arms/gen5-vs-prior.json --ladder-seed dry-gen5-merge-2026-09-26
--sets 3 --port 8799`): 6 series rows (A 4, B 2), 12 games, **272 applied checks, 0 mismatches; previews 12 chosen,
12 applied, 0 mismatches**; 0 timeouts, 0 invalid, 0 fallbacks, 0 throttle notices, 0 orphans, 0 blocked public
connections; 50 gen5 move decisions, all searched, 0 search fallbacks.

## 7. Owed

- Feed XATU's order and damage observations into the spread belief, in `worlds.js`, for the arena and ROTOM together.
- The MACHAMP loop trains and gates on the omniscient arena; moving it to honest is a new pre-registration.
- The 1 s vs 5 s question under honest information (not asked here).
- `node engine/status.js --write` from the main checkout after merge.
