# 2026-09-11 — the speed-tie corner mechanisms, closed or declared

ENGINE division. Historical record (see CLAUDE.md on `docs/_reports/`): not maintained, not current state.

## Verdict

| # | mechanism | pool game(s) | verdict | knob |
|---|---|---|---|---|
| 1 | Encore's same-turn `changeAction` rewrites a queued pivot / Struggle | T …2661290217, B …2635374300 | **FIXED** | `MEDI_ENCORE_REWRITE_KEEPS_GUARDS` |
| 2a | an entrant a hazard already KO'd runs none of its own handlers | B …2662004374 | **FIXED** | `MEDI_ENTRY_DEAD_STILL_STARTS` |
| 2b | an ability acquired by a body this hit KO'd still runs its Start | B …2661305652 | **FIXED** | `MEDI_ACQUIRED_START_NEEDS_HP` |
| 3 | a connected packet deals at least 1 | T …2663746491 | **FIXED** | `MEDI_DAMAGE_NO_MIN_ONE` |
| 4 | Feint compares Detect's VOLATILE (`protect`), not its move id | B …2659466378 | **FIXED** | `MEDI_FEINT_READS_MOVE_ID` |
| 5 | a defrost thaw waits for the move to be USED (below flinch) | B …2634612764 | **FIXED** | `MEDI_THAW_ABOVE_FLINCH` |
| 6 | a pivot with nothing to aim at fails and does not switch | B …2655672115 | **FIXED** | `MEDI_PIVOT_NO_TARGET_SWITCHES` |
| 7 | Thief/Covet take nothing when the thief holds an item | T …2657567717 | **FIXED** | `MEDI_STEAL_IGNORES_FULL_HAND` |
| 8 | Belly Drum fails at +6 before paying | T …2654931424 | **FIXED** | `MEDI_COST_BOOST_NO_CAP_FAIL` |
| 9 | a Speed/Guard/Power swap is undone on switch-out (ROADMAP #571) | T …2656451791 | **FIXED** | `MEDI_STAT_REWIRE_SURVIVES_SWITCH` |
| 10 | Super Fang floors at 1 on the damage-range road every real click takes | B …2662677462 | **FIXED** | `MEDI_HALF_HP_NO_FLOOR` |
| 11 | end-of-battle residual clocks (Light Screen; two stall counters) | T …2654571284, B …2662099996, B …2634155984 | **DECLARED** — ROADMAP #584 | none |
| 12 | Stockpile's refund is a `boost`, refused with no foe left | B …2635658823 | **FIXED** | `MEDI_LAYER_REFUND_IGNORES_NO_FOE` |
| 13 | Reflect Type modelled (a copy of the target's typing onto the user) | T …2659556207 | **FIXED** | `MEDI_REFLECT_TYPE_UNMODELLED` |
| 14 | Kommo-o 103 vs 102: Knock Off's ×1.5 belongs in the base-power chain beside Helping Hand | T …2655635795 | **ATTRIBUTED AND FIXED** | `MEDI_KNOCKOFF_FLOORED_ALONE` |
| 15 | Staraptor 125 vs 59: a volley stops when its USER faints between arrivals (Rough Skin) — not the perish drain | B …2659828909 | **ATTRIBUTED AND FIXED** | `MEDI_VOLLEY_IGNORES_USER_FAINT` |

Board-material corners (`state.games` less `state.games_board_never_diverged`), every run pinned
`--census data/mechanics-census.json --team-store data/team-pool-frozen --games 1200 --turns 50 --steering empirical --end-state`, 961 games per arm:

| release | top-tie-first | bottom-tie-first | middle | source |
|---|---|---|---|---|
| `5973a4e3c768` (before) | 8 | 11 | 0 | the artifacts as they stood at 2026-09-11T03:12Z |
| `09b2b98feb98` (batch 1) | **2** | **3** | **0** | `data/verification/game-differential-{top,bottom}-tie-first.json`, `data/game-differential.json` |
| `2b5a6585d8cf` (batches 2+3) | **1** | **2** | **0** | same files, overwritten at 06:25:49Z / 06:29:37Z / 06:19:32Z |

Predictions were written before each release was cut: `data/verification/_prediction-2026-09-11-corners-batch1.json`
(top 2 in [2,3], bottom 3 in [3,4]) — **both hit the point, no new game**; `_prediction-2026-09-11-corners-batch2.json`
(top 1 in [1,2], bottom 2 in [2,3]) — **both hit the point, no new game**. The three games left are exactly the
three DECLARED clock cards (§3). Batches 2 and 3 were released together because batch 2 carried one code fix; each
game still maps to one mechanism.

Census: **840 → 856 live, 0 missing, 0 hollow, `run_ok: true`**; no previously-live row lost (`data/mechanics-census.json`, 2026-09-11T06:05:33Z).

## 1. How every card was read

All 19 cards were replayed with `engine/replay_one.js` on `5973a4e3c768`, then again on the fixed tree. The
brief's pre-diagnosis report was not in the repository; every line below was re-read at both ends.

Two cards had the wrong cause in the pre-diagnosis, as the brief warned, and two more were unattributed:
- **Basculegion** (…2635374300) is the Encore rewrite over a queued Struggle — the replay shows the authority's
  `|cant|…|Disable` where medicham2 Struggled into Sableye.
- **Stockpile** (…2635658823) is the no-foe refusal: the authority writes only `-end … Stockpile` and keeps +3/+3.
- **Kommo-o** (…2655635795): the only differing hit is the FIRST Knock Off, while Kommo-o still holds its Sitrus
  and Farigiraf has Helping-Handed Scrafty. The authority chains ×1.5 × ×1.5 once (`ch4096(6144,6144) = 9216`,
  65 → 146); medicham2 floored Knock Off first (97) and then chained Helping Hand (145). Replayed on the fixed
  tree: 102 in both.
- **Staraptor** (…2659828909): nothing links it to the perish drain. Turn 8: Talonflame's Dual Wingbeat is
  crit on hit 1, Rough Skin KOs Talonflame, and the authority stops (`-hitcount 1`, `scripts.ts`: `if (!pokemon.hp
  && targets.length === 1) { hit++; break; }`) — so Garchomp lives to Dragon Claw Staraptor to 59. medicham2 landed
  hit 2, KO'd Garchomp, and the Dragon Claw never happened. The earlier protocol split (the perish faint above
  `|upkeep|`) is the closeted narration row and moves no board. Replayed on the fixed tree: both 59.

## 2. The fixes, each with its own knob and probe

Every fix is in `engine/medicham2-browser.js`, cites its authority line in place, stamps `MEDFAILS.<knob>Restored`
under its knob, and increments one `MEDSEEN` counter. Memberships were printed before wiring: shield volatile ≠ id
is `detect → protect` only; damaging `removesItem.steals` is Thief and Covet only; `statChangeInCode` with a
`costFraction` is Belly Drum only. Notes that are not visible from the table:

- **1.** `encoreRelocateQueued` marks the queued action `_encoreRewrite`; the execution override then rebuilds it
  whatever it was. Mainline's three exclusions stay on the other road (an Encore standing from an earlier turn).
- **2a.** `fieldEvent('SwitchIn')` runs `faintMessages()` after every handler (sim/battle.ts:565), so a
  hazard-KO'd entrant is `fainted` before its own ability comes up and :511-513 skips it — Intimidate, weather,
  Trace, Imposter and the announcement alike. The probe's SETTER arm shows it for Drizzle too.
- **2b.** `_faintOut === false` is this engine's record of "HP 0, faint not yet written" — the authority's
  `fainted: false` window in which `skillSwap` still runs Start.
- **3.** Floored inside `roll()`, only when `eff > 0` (an immune target never reaches `modifyDamage`).
- **10.** Why the generic road: `hasPower` admits a `fixedDamage` move, so `playerAction` returns
  `{kind:'attack'}` and the dedicated `kind:'fixeddmg'` branch (which does floor) is never reached from a click.
- **12.** `releaseLayeredVolatile(who, vol, S)` asks `foeSideEmptyFor` — the engine's one reader of
  `sim/battle.ts:2028` — and a caller with no `S` is counted.
- **13.** New action kind `typecopy`: shield, Good as Gold, move-class and Prankster refusals, the empty-type
  refusal, then `|-start|SOURCE|typechange|[from] move: reflecttype|[of] TARGET`. The copy is undone on leaving by
  the existing `typesRestoredOnSwitchOut`.

`tests/probe_corner_mechanisms.js` — 15 mechanisms, a red arm and a same-body control each, Showdown as the
expectation, a fixture read off the authority, a counter, and one knob child per mechanism. Shown RED on
`5973a4e3c768` (batch 1) and on `09b2b98feb98` (batches 2+3); green with every child on `09b2b98feb98` and
`2b5a6585d8cf`. Sixteen census rows in `tests/test-mechanics.js`, shown MISSING under their knobs with the census
refusing to write (the knobs are in `DELIBERATE_BREAK`).

**My probe was wrong six times before the engine was:** Kangaskhan's Scrappy blocks Intimidate (read the drop on
the attacker instead); the authority's stream ends with the next turn's empty block; a lead's own switch-in counted
as a pivot; a Roost healed the Pelipper out of its own fixture; a +2 Knock Off KO'd its ×3 target in both engines
(a fainted body cannot show a one-point gap); two equal census arms read as hollow. Each failed loudly.

## 3. Batch 2's clock cards are DECLARED — the authority was traced, not argued

A `node -r` preload wrapped the authority's `fieldEvent`, `singleEvent` and `faintMessages` and recorded every
residual's handler sequence and the side/stall durations before and after, on all three games:

- …2654571284 t12: Politoed's perish expiry ends p2. Reflect (order 26, sub 1) ticks 2 → 1; **Light Screen (sub 2)
  stays 6**; `faintMessages` ends the battle.
- …2634155984 t10: Gengar's expiry ends p1; **Tailwind ticks 2 → 1**, Raichu's stall stays.
- …2662099996 t11: two expiries end the battle; a callback handler runs next, **nothing ticks**, Swampert keeps
  `stall 1 / counter 9`.

So the rule is: a duration expiry `continue`s past `faintMessages()` (sim/battle.ts:519-523), so the walk spends
**exactly one more handler** — ticking it if it carries a duration — and the next `faintMessages()` ends the
battle. medicham2 keeps walking every remaining group and the foot stall lapse, because `faintQueueOwed()` holds its
group-top stop (and the stall hold) open. A faithful fix is "exactly one more handler across group boundaries", which
this group-major walk can only answer from its shadow handler list; it cannot change play (the battle is over). It
is registered as ROADMAP #584 and not fixed.

## 4. The chain

| instrument | batch 1 (`09b2b98feb98`) | batches 2+3 (`2b5a6585d8cf`) |
|---|---|---|
| damage differential | **0 of 6,000**, every roll index | **0 of 6,000**, every roll index (`data/engine-diff.json` 06:13:10Z) |
| roster items / abilities / moves | 0/0, 0/0, 0/0 (DIFFER / DID-NOT-FIRE) | 0/0, 0/0, 0/0 (`data/roster.{items,abilities,moves}.json`) |
| all mechanics fire | moves 4, abilities 1, items 0 diverged — unchanged | moves 4, abilities 1, items 0 — unchanged (`data/all-mechanics-fire.json`) |
| middle arm | **0 of 961** | **0 of 961** (`data/game-differential.json`) |
| corners | top **2**, bottom **3** | top **1**, bottom **2** |
| quarantine | **OPEN**; open-defect clause PASS | **OPEN, 9 of 9**; open-defect clause PASS |

The two lanes ran side by side — lane A (engine-diff, roster x3, all-mechanics-fire) and lane B (the three
differential arms, one after another) — both on the named release; nothing in either reads the other's artifact.

**Register refresh, after the ROADMAP rows were written** (`data/register-reality.json`, 2026-09-11T07:09:29Z):
exit 1 on 13 rows that disagree with their own instrument — the same classes as HEAD's 03:51Z artifact, none of them
this batch's: STALE ROW 10 → 9, PREMATURE CLOSE 1 → 1 (#577), CANNOT ANSWER 1, UNRUNNABLE 2; CONFIRMED 119 → 122,
including #571 and #583 (closed, instrument green). #584 names the corner arms in prose rather than as a runnable
marker, so it is DEBT, not evidence, and does not touch the gate. Quarantine re-read after the refresh: **GATE OPEN,
9 of 9; the open-defect clause PASSES** (144 verdicts read). `engine/open_work.js`: **0 MEASURED BUT UNREGISTERED**.
`tests/test-docs-current.js`: 37 passed, 0 failed.

## 5. Instruments this pass rewrote the text under — re-pointed in the same pass

- `tests/probe_red_demo.js` **WIRE 4 (Life Orb)** was anchored on the roll's `return mdChain(d,_ch);`, which the
  minimum-1 floor rewrote. Re-aimed at the new line; the reversal still restores exactly the pre-WIRE-4 arithmetic.
- `tests/probe_red_demo.js` **#256 "an unmodelled click keeps its target"**: Reflect Type was the LAST legal member
  of that branch. Walked over all 500 legal moves after the fix: **zero** reach it. The arm now derives its member on
  every run and prints N/A (not a failure) while there is none. `ABRA-EXIT 0 VERDICT-GREEN`.
- `tests/roster.js` plants: every stage ran `--reds` on `09b2b98feb98` with 0 DIFFER / 0 DID-NOT-FIRE.

## 6. Found on the way, not fixed

- The chain lanes' first launch lost every backslash through `cmd.exe` and my own `echo … $?` read the exit code of
  a `$(date)` substitution; nothing ran and nothing was written. Scripts fixed; worth knowing for the next agent.
- `engine/status.js` still prints `FEATURE SEMANTICS CHECK FAILED` for `data/policy-weights.json` (MEASURE's).

## OWED, NOT RUN

Track the two releases this pass cut (the router tracks releases; neither is in git):

```bash
git add data/releases/09b2b98feb98 data/releases/2b5a6585d8cf
```

The declared clock cards, ROADMAP #584 — the three seeds, replayed with the authority's residual walk traced
(the preload is described in §3; it is a scratch file of this session and is not in the repository):

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/replay_one.js --release 2b5a6585d8cf --census data/mechanics-census.json --team-store data/team-pool-frozen --games 1200 --turns 50 --steering empirical --end-state --arm top-tie-first --config omit-intimidate --seed "gen9championsvgc2026regmbbo3-2654571284 vs gen9championsvgc2026regmbbo3-2654501849"
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/replay_one.js --release 2b5a6585d8cf --census data/mechanics-census.json --team-store data/team-pool-frozen --games 1200 --turns 50 --steering empirical --end-state --arm bottom-tie-first --config omit-spread --seed "gen9championsvgc2026regmbbo3-2662099996 vs gen9championsvgc2026regmbbo3-2662094820"
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/replay_one.js --release 2b5a6585d8cf --census data/mechanics-census.json --team-store data/team-pool-frozen --games 1200 --turns 50 --steering empirical --end-state --arm bottom-tie-first --config pair-speedctrl --seed "gen9championsvgc2026regmbbo3-2634155984 vs gen9championsvgc2026regmbbo3-2634801407"
```

The whole probe, every knob child (green on `2b5a6585d8cf`):

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/probe_corner_mechanisms.js --release 2b5a6585d8cf
```
