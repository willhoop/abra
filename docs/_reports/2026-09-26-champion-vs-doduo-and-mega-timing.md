# 2026-09-26 — The gen5 champion against DODUO-greedy at clock-safe budgets, and mega TIMING against humans

SOLVER. Branch `worktree-agent-a0e29027ba742f35a` (not merged, not pushed). Engine: frozen release `eaa5becc54eb`,
copied from the main checkout's `data/releases/` into this worktree's gitignored `data/releases/`. Team store:
`data/team-pool-frozen-regmc` (pool digest `792daded918f`, `games.bo3.jsonl` sha256 `a68263bb568d`), copied the same way.

## Verdict

- **gen5 is proven stronger than DODUO-greedy at 1 s.** SPRT H1 (elo0 0, elo1 +20, α = β = 0.05) after 180 games:
  113–67 = **0.628 [0.555, 0.695]**. It is clock-safe: gen5's slowest decision was 10.9 s and its heaviest game summed
  21.4 s, against the 55 s per-turn and 420 s bank limits.
- **gen5 is proven stronger at 5 s too.** SPRT H1 after 64 games: 49–15 = **0.766 [0.649, 0.853]**. Slowest
  decision 5.6 s, heaviest game 56.9 s, no prior fallback, no empty cell. Both budgets are clock-safe. **The ladder
  bot should be gen5, not DODUO-greedy**; 5 s is the stronger arm and still far inside the clock.
- **Mega timing.** Humans make **22.25%** of their megas after the first turn they could (10,223 of 45,952,
  [0.2187, 0.2263]). gen5 delays **22.8%** (36/158), DODUO-greedy **15.5%** (23/148), both inside the human band
  0.2225 ± 0.15. The sharpest board reason is Will's: with a sand mega, **129 of 658 delayed megas were made after the
  sand had gone** — the mega brings it back. New check `solver/tests/test-mega-timing.js`: GREEN 14/14, and RED under both deliberate breaks
  (never delay: 0/66 and 0/69; always delay: 51/51 and 53/53).

## 1. The ladder-bot decision: gen5 against DODUO-greedy

### Protocol (pre-registered before the first game)

`solver/results/2026-09-26-champ-vs-doduo/preregistration.json`, written before either arm played.

| item | value |
|---|---|
| X, 1 s | `solver/machamp/league/gen5.json` — MILTANK, gen5 MAG/DODUO/PORYGON2, k 4×4, depth 0, 1 reserved switch row, `budgetMs` 1000 |
| X, 5 s | `solver/results/2026-09-26-champ-vs-doduo/gen5-5s.json` — identical except `budgetMs` 5000 |
| Y | `solver/machamp/league/human-clone.json` — MAG v1 + DODUO v1, argmax legal joint, no search. This is ROTOM's `prior` policy (`solver/rotom/policy.js`). |
| test | `solver/machamp/sprt.js`: normal-approximation GSPRT on pair scores (Fishtest), elo0 0, elo1 +20, α = β = 0.05, ≤ 2,000 games, pairs walked in index order, read once at the bound |
| pairs | TEST team pairs of the frozen store, cycled; each pair twice on one battle seed, seats swapped |
| seeds | 1 s: `--seed 26001`; 5 s: `--seed 26005` |
| flags | `--workers 3 --cap 50 --max-games 2000 --team-store data/team-pool-frozen-regmc --release eaa5becc54eb` |
| clock rule | no gen5 decision over 55 s (Timer Max Per Turn) and no game whose summed gen5 decision time is over 420 s (Timer Starting). Both read from the format's ruleTable through `solver/rotom/clock.js` `readRule()`: `ruleTable of gen9championsvgc2026regmcbo3`, 55 / 420 / grace 90. |
| order | one arm at a time: 1 s, then 5 s. Never more than 3 workers from this work. |

**Priority.** The sandbox refused `cmd.exe` (as it did for the mega-rate work), so `tools\lownode.cmd` could not be
called. Each worker (`solver/mew/play.js`) sets BELOW_NORMAL priority in-process; the SPRT parent is idle between polls.

**Machine load.** A live ladder run (ROTOM, main checkout) shared the machine throughout. The budget is wall-clock,
so the load reduces the compute behind "1 s" and "5 s". The counters below show how much.

### Results

| arm | verdict | games | W–L | score | Wilson 95% (at the stop) | pairs both / split / lost | artifact |
|---|---|---|---|---|---|---|---|
| gen5 1 s | **H1 — stronger** (LLR 3.008 ≥ 2.944) | 180 | 113–67 | **0.628** | 0.555–0.695 | 32 / 49 / 9 | `solver/results/2026-09-26-champ-vs-doduo/sprt-gen5-1s-read.json` |
| gen5 5 s | **H1 — stronger** (LLR 2.968 ≥ 2.944) | 64 | 49–15 | **0.766** | 0.649–0.853 | 18 / 13 / 1 | `solver/results/2026-09-26-champ-vs-doduo/sprt-gen5-5s-read.json` |

The Wilson interval is taken at a data-dependent stopping time. It is conditional on the stop and slightly optimistic.
`sprt_read.js` recounts the games from the shards and agrees with the SPRT's own count (`agrees_with_sprt: true`).

### Clock and search counters

| arm | gen5 ms/decision mean / p50 / p95 / p99 / max | per-game sum mean / p95 / max (s) | over 55 s | over 420 s | DODUO-greedy ms mean / p95 / max |
|---|---|---|---|---|---|
| 1 s | 1,027 / 955 / 1,247 / 2,033 / **10,881** | 7.4 / 12.0 / 21.4 | 0 | 0 | 100 / 262 / 5,641 |
| 5 s | 4,722 / 4,711 / 4,750 / 4,836 / **5,622** | 32.0 / 51.9 / 56.9 | 0 | 0 | 61 / 110 / 1,256 |

| arm | searched decisions | playouts per searched decision | unfilled cells | MILTANK prior fallback (too empty to solve) | agent fallbacks (search threw) |
|---|---|---|---|---|---|
| 1 s | 1,349 | 76.1 | 15.7% | **3.9%** (53: 35 sparse, 18 empty) | 0 |
| 5 s | 434 | 449.6 | 0.0% | **0** | 0 |

The counters cover every game the workers played, including the few past the stop. They come from new per-line
snapshots in `solver/mew/play.js` (`ctr`), because the SPRT kills its workers at the bound and a killed worker writes
no summary. A prior fallback plays gen5's OWN DODUO top joint (`solver/miltank/search.js`, `minFill` 0.25); it is not
DODUO v1, and it is counted.

**Reading.** At 1 s under this load, 3.9% of gen5's searched decisions fell back to its prior and the median search
filled about 76 playouts. That was enough: it beat DODUO-greedy clearly. The 10.9 s maximum is a tail under load (the
hard deadline in `search.js` bounds the fill, not a starved process); it is 5× under the per-turn limit. DODUO-greedy's
own maximum was 5.6 s on a decision that costs about 5 ms alone, which is the load, not the bot.

### The decision

**gen5 is proven stronger than DODUO-greedy at both clock-safe budgets, and 5 s is the stronger arm** (0.766 against
0.628; the two arms are separate SPRTs and are not compared with each other by a test). This replaces the provisional
"DODUO-greedy, by default of evidence" of `docs/_reports/2026-09-25-first-solver-measurements.md` §4, which was about
MILTANK with v1 nets and the heuristic leaf at depth 2 — a different configuration from the self-play champion.

Two things stand between this result and a ladder series, and neither is measured here:

1. **ROTOM cannot play gen5 yet.** Its `miltank` policy (`solver/rotom/policy.js`) is MILTANK v1 with MAG v1 + DODUO
   v1, the heuristic leaf, depth 2 and k 8×8 — not gen5's nets, PORYGON2 leaf, depth 0, k 4×4 and reserved switch
   row. A ROTOM policy that loads a league spec (`solver/mew/agent.js`) is owed before gen5 can be the ladder bot.
2. **The arena search sees the true battle.** `solver/mew/play.js` hands MILTANK the real MEDICHAM state, so its
   playouts know the opponent's unrevealed back line and exact spreads. On the ladder ROTOM samples worlds (XATU's
   back-pair posterior). DODUO-greedy reads only the public history, while the search uses the hidden state in every
   playout, so the arena margin probably overstates the ladder margin. That is a judgement, not a measurement. The
   same was true of every earlier arena figure.

## 2. Mega timing: humans against the bots

### Definition (one for both populations)

`solver/arena/mega_timing.js`. A side is CAPABLE at the start of a turn when one of its active mons holds the mega
stone of its own species and the side has not megaed — the same definition as `mega_rate.js`. **Delay** = mega turn −
first capable turn; a mega is **delayed** when delay > 0. For each side, a timeline from the first capable turn to the
mega records the weather, terrain, Trick Room, each active mon's identity, ability, stone and stat stages, and each
slot's action. Humans: from `solver/out/human/games.jsonl` (main checkout, read only, 26,888 games). Bots: from
`mega_rate.game(..., { trace: true })` in the arena and in MEW/MACHAMP matches.

**Reasons** (multi-label, delayed megas only, read off the board):

| label | meaning |
|---|---|
| `switched_out_and_back` | the mon that megaed was active at the first capable turn, left, and came back |
| `other_holder_first` | another stone holder made the side capable first (one mega per battle) |
| `boost_banked` | the mon's summed positive stat stages are higher at the mega turn than when it first appears |
| `mega_resets_field` | the mega forme's ability sets a weather/terrain that is DOWN at the mega turn. Mega evolution re-fires the new ability's Start: `formeChange(…, isPermanent)` → `setAbility(…, isFromFormeChange)` → `singleEvent('Start')` (pokemon-showdown-mc `sim/pokemon.ts` ~L1487 and ~L1943, commit `f10d679`). So the mega brings the field back. |
| `field_lost_while_held` | … and that weather/terrain WAS up at the first capable turn. It was lost while the mega was held. |
| `mega_overrides_other_field` | … and a different weather/terrain is up at the mega turn, which the mega replaces |
| `field_by_pre_mega_ability` | the PRE-mega ability sets a weather/terrain the mega forme's does not, and it is up at the mega turn |
| `trick_room_changed` | Trick Room went up or down between the first capable turn and the mega turn |
| `none_readable` | none of the above |

Which abilities set what is DERIVED from the regulation's Dex (the handler calls `setWeather`/`setTerrain`), never
typed. Move classes for the held actions (protect, fake_out, setup, field_move, status_other, attack) come from the
Dex too.

`mega_resets_field` alone is not evidence of a choice: for a forme whose base ability sets nothing, the field is down
before any mega. `field_lost_while_held` and `mega_overrides_other_field` are the sharp labels.

### Humans (26,888 games) — `solver/out/mega/timing-human.json`

| | value |
|---|---|
| capable sides | 48,430 |
| megas | 45,952 |
| made on the first capable turn | 35,729 (77.75%) |
| **delayed** | **10,223 = 0.2225 [0.2187, 0.2263]** |
| mean delay | 0.54 turns |
| delay 1 / 2 / 3 / 4 / 5 / 6+ turns | 4,650 / 1,690 / 1,455 / 1,080 / 666 / 682 |

The delayed share is flat across rating: <1100 0.221, 1100–1199 0.223, 1200–1299 0.220, 1300+ 0.240 [0.222, 0.259].
Games that end normally delay more (0.234) than forfeits (0.203).

Reasons for the 10,223 delayed megas (multi-label; shares of delayed):

| reason | n | share |
|---|---|---|
| switched_out_and_back | 3,932 | 38.5% |
| none_readable | 3,626 | 35.5% |
| mega_resets_field | 1,501 | 14.7% |
| trick_room_changed | 1,100 | 10.8% |
| other_holder_first | 1,052 | 10.3% |
| boost_banked | 555 | 5.4% |
| mega_overrides_other_field | 461 | 4.5% |
| field_lost_while_held | 132 | 1.3% |
| field_by_pre_mega_ability | 0 | 0% |

`field_by_pre_mega_ability` is zero by construction in this dataset: the only megaed mons whose pre-mega ability sets
a field are sand and snow setters whose mega forme keeps the same ability (348 of the first 6,000 games' megas, all of
them).

What the megaing mon did on the first turn it could have megaed and did not: protect 44.2%, switch out 34.6%,
attack 8.9%, Fake Out 4.3%, setup 3.1%, field move 2.4%.

**Per forme — where the reasons concentrate** (delayed share; reasons as counts of that forme's delayed megas):

| forme (mega ability) | megas | delayed | the readable reason |
|---|---|---|---|
| Tyranitar-Mega (Sand Stream) | 1,456 | **0.452** [0.427, 0.478] | **129 of 658: sand was up at the first capable turn and down at the mega** (`field_lost_while_held`); 102 replaced another weather |
| Charizard-Mega-Y (Drought) | 3,484 | 0.312 [0.297, 0.328] | 263 replaced another weather at the mega turn (the weather war won by moving last) |
| Froslass-Mega (Snow Warning) | 1,603 | 0.177 | 86 replaced another weather |
| Scovillain-Mega (Spicy Spray) | 269 | 0.297 | 61 of 80 banked a boost first |
| Blaziken-Mega (Speed Boost) | 237 | 0.245 | 35 of 58 banked a boost first |
| Lucario-Mega-Z (Aura Guard) | 1,181 | 0.246 | 70 of 291 banked a boost first |
| Gengar-Mega (Shadow Tag) | 1,652 | 0.081 | — (megas at once) |
| Camerupt-Mega (Sheer Force) | 952 | 0.087 | — (megas at once) |

So Will's two cases are real and visible in the human data: the weather case sits almost entirely on the sand mega
(129 of the 132 `field_lost_while_held` in the whole dataset), and boost banking concentrates on the formes that gain
from a boost before they mega.

### Bots

Release `eaa5becc54eb`. The bot figures are from the SPRT games above (counted games only).

| bot | capable sides | megas | delayed | delayed share | Wilson 95% | readable reasons (delayed) | against the human band [0.0725, 0.3725] |
|---|---|---|---|---|---|---|---|
| **human** | 48,430 | 45,952 | 10,223 | 0.2225 | [0.2187, 0.2263] | see above | — |
| gen5, 1 s | 166 | 158 | 36 | **0.228** | [0.169, 0.299] | switched out and back 12, boost banked 5, other holder 3, Trick Room 4, mega resets field 1, none 15 | inside |
| DODUO-greedy (vs gen5 1 s) | 174 | 148 | 23 | **0.155** | [0.106, 0.222] | switched out and back 9, other holder 4, Trick Room 2, none 10 | inside |
| gen5, 5 s | 60 | 55 | 16 | **0.291** | [0.188, 0.421] | switched out and back 6, other holder 3, boost banked 2, mega resets field 1, Trick Room 1, none 6 | inside |
| DODUO-greedy (vs gen5 5 s) | 63 | 52 | 12 | **0.231** | [0.137, 0.361] | switched out and back 5, other holder 2, none 5 | inside |

gen5 at 1 s delays at the human rate. DODUO-greedy delays less, and its reasons are only the incidental ones
(switched out, another holder); it never banked a boost or won back a field in these games. The samples are small:
with ~150 megas per bot, a field-reason rate of 1–5% is a handful of cases at most.

DODUO-greedy megaed on 148 of 174 capable sides here (0.851), below the human 0.949 and near the lower end of what
the mega-rate report measured for it. That is the rate question, not the timing question, and it is recorded, not
concluded from.

### The check — `solver/tests/test-mega-timing.js` (pre-registered in `mega_timing.js` before any bot was read)

- **HUMAN**: the first 3,000 human games give a delayed share within 0.03 of `HUMAN_DELAYED_SHARE` = 0.2225.
- **CLASSIFY**: constructed timelines, on a legal mega forme FOUND in the Dex whose ability sets a weather: weather
  lost while held → `mega_resets_field` + `field_lost_while_held` + `mega_overrides_other_field`; an immediate mega has
  no reason; a boost → `boost_banked`; out and back; another holder first.
- **TIMING**: arena games on the release (76 games per pairing, seed 11, cap 60): doduo vs mag, prior vs the gen5
  champion at 150 ms. A bot FAILS when its Wilson 95% interval on delayed/megas lies wholly outside human ± 0.15
  (`DELAY_MARGIN`, the same margin as the rate floor). Fewer than 50 megas = CANNOT ANSWER.
- **RED**: `ARENA_BREAK=meganow` (mega the first turn it is offered) and `ARENA_BREAK=megalate` (never on the first
  capable turn) must each fail TIMING.

**Result (log `solver/out/cvd/test-mega-timing-2.log`, worktree): GREEN 14/14, exit 0.**

| bot (test run, 76 games per pairing) | delayed / megas | Wilson 95% | verdict |
|---|---|---|---|
| doduo | 10/57 | [0.098, 0.294] | PASS |
| mag | 10/61 | [0.092, 0.276] | PASS |
| prior v0 | 4/61 | [0.026, 0.157] | PASS (the lowest; its interval still reaches the band) |
| gen5 at 150 ms | 15/62 | [0.153, 0.362] | PASS |

HUMAN: the first 3,000 games give 0.2134, within 0.03 of 0.2225. CLASSIFY: all six constructed cases pass, on
Charizard-Mega-Y (found by the Dex walk: legal, a mega, Drought sets sun).

**RED, and it caught a real defect first.** The first run of this test printed GREEN and then exited 3 (BLIND): both
breaks stayed green. Two causes, both fixed before the result above was accepted:

1. `check()` computed the band before defaulting the human share, so `band(undefined)` was `[NaN, NaN]`, every
   comparison was false and every bot passed — including 51/51 delayed under `megalate`.
2. `meganow` left 5 of 66 delays: when the megaing mon's chosen action was a switch, its "exact twin" search matched
   the original non-mega joint. It now requires the mega flag on the slot.

After the fix: `meganow` → doduo 0/66 [0, 0.055], mag 0/69 [0, 0.053], both FAIL (delays too rarely);
`megalate` → doduo 51/51 [0.93, 1], mag 53/53 [0.932, 1], both FAIL (delays too often).

## 3. What was added

- `solver/arena/mega_timing.js` — the timeline classifier, the human pass (`--human`), the match reader (`--match`),
  `check()`, `band()`, the two breaks `megaNow`/`megaLate`, `HUMAN_DELAYED_SHARE`.
- `solver/arena/mega_rate.js` — `game(API, tallies, { trace: true })` records the timing timeline; `detail()` returns
  it. Counters only; no decision changes. `_megaOfRow` exported for the human pass.
- `solver/arena/arena.js` — `mega.timing` per bot in every artifact; `ARENA_BREAK=meganow|megalate`.
- `solver/mew/play.js` — every match line carries the per-game mega timeline (`mega.x`, `mega.y`) and a cumulative
  snapshot of the search counters (`ctr`: searched, playouts, unfilled, prior fallbacks by kind, agent fallbacks), so a
  run killed at an SPRT bound still proves its search ran.
- `solver/machamp/sprt_read.js` — reads a finished SPRT once at its bound: recount, clock rule, counters, mega timing.
- `solver/tests/test-mega-timing.js`.
- `solver/results/2026-09-26-champ-vs-doduo/` — the pre-registration, the 5 s spec, and the two reads.

## 4. Owed

- `node engine/status.js --write` from the main checkout after merge (a worktree write corrupts the ledgers).
- **Regression runs after the change:** `test-arena` 15/15 + RED on `seat`; `test-mega-rate --fast` 5/5 + RED on
  `nevermega`; `test-machamp --release eaa5becc54eb` **92/93, RED on REBUILD**: `build_doduo.js` reads
  `solver/out/mag/meta.json`, which is now missing in the main checkout as well as here (the mega-rate report saw it
  only in this worktree). Not caused by this change (no file build_doduo reads was touched); it needs the MAG build
  output regenerated. Reported, not fixed.
- CHANGELOG-REGMC entry 1.13.0 on this branch. If another branch lands 1.13.0 first, renumber at merge.
- The 1 s and 5 s arms ran beside a live ladder run. A re-run on an idle machine, or with a playout budget, would say
  what gen5 is worth at a fixed compute; the verdict here is about this machine under this load.
