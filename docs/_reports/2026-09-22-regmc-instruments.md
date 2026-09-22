# Reg M-C instruments: a per-game mega slot, an answered revive, a census and a roster that ask Reg M-C (MEASURE, abra/regmc 0.40.0)

Historical findings record, 2026-09-22. Not maintained; `node engine/quarantine.js --regulation regmc` is the state.
**Every reading here was taken in a worktree. Nothing is published and nothing is a gate verdict.**

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-a7eed8067fa1da7eb`, base `6cb275fb` (abra/regmc 0.32.0) |
| Reg M-C release | **`fa68d953e73f`** — cut here, 32 files, engine bytes = 0.32.0 (`engine-data-regmc` `f6b756beabd7`, `tags-regmc` `9c0f3391fa1d`, `move-priors-regmc` `eab0c9b023df`, `move-effects-regmc` `8c57407e7641`) |
| Reg M-C census pin | **`data/verification/census-pin-regmc-f3b70bc0c47c.json`** (1006 rows, the re-staged census; identical to the committed `data/mechanics-census-regmc.json`) |
| Reg M-C pool | `data/team-pool-frozen-regmc`, hard-linked from the main tree (read only by use) |
| Reg M-B checks | release `2e9db8bb11fd` (the published 1200 lattice's), census pin `census-pin-8997cb7e1530`, pool `data/team-pool-frozen` |
| launcher | `tools\lownode.cmd` through `cmd.exe /c`, from a node argv launcher in a private scratch folder (the harness refuses `cmd /c` typed at the shell); exit codes propagated and read on every run |

## Verdict

- **Driver.** Under Reg M-C the mega-slot choice is a per-game address; the same game alone, after itself and after
  another game gives identical streams (`tests/test-driver-per-game.js`, RED under the old parity). **Reg M-B keeps the
  parity byte for byte**: its 1200 lattice asks the rule 166 times, and the address there, measured with
  `GD_MEGA_SLOT_PER_GAME=1`, still reads 0 of 961 but moves the published left/right mega split (1227/489 → 1234/481),
  so it would change a Reg M-B figure. Not applied to Reg M-B.
- **Revival.** The driver answers a revival request (`mirrorRevival`). In all four lattice runs (12, 18, 23 and 79 requests): every one answered by
  the authority's default (medicham2 revives nothing), 0 refused choices, 0 thrown games. The revive now parts the
  boards, where the state bar sees it: that is ENGINE's unmodelled road.
- **Census (Reg M-C).** 1006 probed, **1006 live, 0 missing**, 0 hollow, 0 threw (was 990 live / 17 missing).
- **Roster (Reg M-C), release `fa68d953e73f`.** items 154 MATCH / 12 COULD-NOT-STAGE of 166; abilities 199 MATCH /
  **2 DID-NOT-FIRE** / 9 COULD-NOT-STAGE / 1 deferred / 3 announcement-only of 214; moves 506 MATCH / 1
  COULD-NOT-STAGE / 3 below the usage shelf / 1 deferred of 511, plus 1 red demonstration whose plant did not apply.
  NOT-baselined illegal fixture sets: items 17, abilities 82, moves 47. **All of it counts against the gate.**
- **Lattices**, release `fa68d953e73f`, census pin `f3b70bc0c47c`, `--steering empirical --arm middle --end-state`:
  `--games 1200` **21 of 953** board-material (2 void), `--games 1600` **30 of 1266**, `--games 1900` **44 of 1495**; held-out
  `--games 12000` **132 of 7375**. 0 thrown games and 0 refused choices in every run. Not zero on any lattice.
- **Reg M-B unmoved.** Census rows identical but for the sampled `formatSecondaryChance` row; lattice 1200 **0 of 961**
  with state, mega and first-divergence blocks identical to the published artifact; `engine/quarantine.js` (no flag)
  byte-identical to HEAD's copy on the same tree; `--selftest` 383 / 0.

## 1. The mega slot is a per-game address

`MEGA_PREFER_B` flipped on every mega of the run and was outside `driverSnap` (ENGINE §2). Now, when both slots of one
side are offered `canMegaEvo` on a turn, the choice is `drv(battle, side, 0, 'megaSlot') < 0.5` — the address every
other driver randomness uses, keyed by the game's seed, the turn and the side, reset on the game boundary. When one slot
is offered nothing is drawn. The rule and how often it was asked are printed and stamped (`mega.slot_rule`,
`mega.both_slots_offered`, `mega.both_offered_chose_right`).

**Why Reg M-B keeps the parity.** The closed line's lattices ask the rule, so any change re-deals published games.
Measured on the Reg M-B 1200 lattice (release `2e9db8bb11fd`, pin `8997cb7e1530`):

| rule | board-material | rule asked | right slot chosen | left / right megas |
|---|---|---|---|---|
| parity (shipping) | 0 of 961 | 166 | 88 | 1227 / 489 |
| per-game address (`GD_MEGA_SLOT_PER_GAME=1`) | 0 of 961 | 166 | 78 | 1234 / 481 |

The parity run's `state`, `mega` (less the three new fields) and `first_divergences` blocks equal the published
`data/game-differential.json`. The address run keeps the count and moves the mega split, which the artifact publishes,
so the brief's stop rule applies: **not applied to Reg M-B.** It was also not moved into `driverSnap`, because
`withFrozenDriver` would then restore it around the planted proofs and change the parity the run starts from.

**Guard.** `tests/test-driver-per-game.js --regulation regmc` derives a pair whose p1 leads two legal stone holders
(first found: Abomasnow / Abomasite and Absol / Absolite), plays it ALONE (first game), AGAIN (straight after itself)
and AFTER (after a one-stone game), each after `driverReset()`, and requires the authority stream, the medicham2 stream
and the board comparison to be identical, with the rule asked in every arm. Green; **RED under
`GD_MEGA_SLOT_CARRIES=1`** (4 assertions: AGAIN and AFTER mega Absol where ALONE megas Abomasnow).

## 2. A revival request is answered

Showdown raises a switch request on the Revival Blessing user's slot that only a fainted party member answers (M-C
checkout `sim/side.ts` chooseSwitch). `mirrorRevival` reads the request's own `reviving` flag
(`sim/pokemon.ts` getSwitchRequestData) and answers with the body medicham2 revived, when it revived one (fainted in its
roster before the turn and standing after it), or else with Showdown's own default for a bare `switch` on a revival
slot, the first fainted body in party order. The pivot body medicham2 queued for that slot is dropped from the entry
queue. Counted: `declared_gaps.revival_requests`.

**Guard.** `tests/test-revive-mirror.js --regulation regmc` stages it (derived cast: the one legal revive learner,
Pawmot; a self-fainting status move aimed at the user, Healing Wish, on its partner). Green: one request, answered by the
authority default, 0 refused, the authority writes `|-heal|p1: Clefable|85/170|[from] move: Revival Blessing`; the boards
then part on the revived body (medicham2 pivots Snorlax in and keeps Clefable fainted, `MEDFAILS.reviveUnmodelled` 1).
**RED under `GD_REVIVE_UNANSWERED=1`**: `THREW — forced-switch choice rejected p1 "switch 4, pass": Can't switch: You have
to pass to a fainted Pokémon`.

**In the lattices.** 1200: 12 requests, all authority default, 8 pivot entries dropped; 1600: 18, all default. The
first protocol divergence of 6 of the 21 board-material games at 1200 and 7 of the 30 at 1600 is the authority's
Revival Blessing `-heal`. ENGINE's 0.32.0 reading of the 1200 lattice had 4 THREW and 6 refused choices, all on that road; these runs have 0 and 0.

## 3. The census asks Reg M-C

`tests/test-mechanics.js` gains a helper block (after `turnDamageBig`): `STAGING_CANDIDATES` (legal, buildable base
species, through `mcKey.all()`), `firstStaged` (first candidate whose control arm stages the mechanic), `withFirst`
(historical fixture first), and `tests/census_authority.js` (`damageAt`: `getDamage` at a pinned roll with the engine
body's stats copied onto the authority's; `hitTotal`: the whole `useMove` hit loop; `linesOf`: the lines the authority
writes). On Reg M-B the authority reproduces the typed numbers exactly: 64 / 52 / truncating 50 for the spread row,
34 / 42 for Parental Bond, `|-immune|p1a: Charizard` for Spicy Spray.

| row | was typed | now | Reg M-C reading |
|---|---|---|---|
| megaStone (stone-holder built base) | `gengar,cursedbody,200` | table's slot-0 ability, stoneless build's SpA | LIVE |
| speedCond (Quick Feet) | 192 / 205 / 288 | build Speeds, tag's `speedMult`, the bracket | LIVE (175 / 187) |
| forbidsStatusMoves (use) | Whimsicott's free pick | first foe whose free pick is a status move; category from `statusCategory` | LIVE (free Protect, Taunted Struggle) |
| forbidsStatusMoves (menu) | Milotic | first body whose untaunted draws reach a status move | LIVE (20 / 0) |
| disablesAttacker (Cursed Body) | Garchomp / Earthquake | first (foe, move) whose control repeats | LIVE (Energy Ball) |
| spreadFoes (x0.75) | 64 / 52 / 50 | authority, on the first defender where a truncation differs | LIVE (Aegislash: 78 / 62 / 60) |
| survivesFromFull (Sash) | Alakazam | first target the no-item hit KOs from full | LIVE |
| sealsMoves (Disable) | Garchomp / Earthquake | first (foe, move) whose control repeats | LIVE (Close Combat) |
| drain (spread) | Raichu + Kangaskhan | first pair with two odd damages | LIVE (Absol + Aggron) |
| priorityModFlying (Gale Wings) | Dragapult | first foe that hits a no-ability Talonflame first | LIVE |
| healsAtThreshold (Sitrus, two hits) | 81% | HP derived from the two measured hits | LIVE (116 HP) |
| hitsTwice (Parental Bond) | 34 / 42 | authority `useMove` | LIVE (38 / 47) |
| clearsScreensOnEntry | key `mrrime` | the incoming body's own key | LIVE |
| speedCond (Slush Rush) | 70 / 140, Watchog | build Speed, tag mult, first foe inside the bracket | LIVE (Absol 132) |
| protectsAllyFromStatus (Aroma Veil) | ally last move Twin Beam | first of the ally build's moves the control Encore lands on | LIVE |
| weatherSetter (sand order) | 205 / 101 / 80 | build Speeds, asserted distinct and not slot order | LIVE |
| punishesAttacker (Spicy Spray line) | the M-B line | registered only when the authority writes the line; the line is the authority's | not registered under Reg M-C (its handler writes no line) |

Reg M-C census: **1006 probed, 1006 live, 0 missing, 0 threw, 0 hollow** (1007 rows before: the Spicy Spray line row
is not registered). **Shown RED:** `MEDI_DRAIN_LUMP_ROUND=1` (+`MEDI_RESIDUAL_STABLE_SORT=1`) takes the re-staged spread
drain row MISSING on its searched fixture. Reg M-B: HEAD's census and the new one, run on this tree, differ in one row,
`formatSecondaryChance` (a 6,000-turn sample whose detail moves between any two runs, HEAD against HEAD included).

**A trap on the way.** The red run WROTE `data/mechanics-census-regmc.json`: neither knob is on the census's
deliberate-break refusal list. Restored from the pin (content digest re-checked). Owed: the refusal list should be
derived from every `MEDI_*` knob the engine reads, not typed.

## 4. The roster asks Reg M-C

Three instrument defects, each found by running the stage:

1. **The rules read Reg M-B's tags.** `REL.read('data/tags.json')` serves the owner's copy out of every release (an M-C
   release freezes both). Now `REL.read(fileFor('data/tags.json'))`.
2. **The Reg M-C checkout does not attach `desc` / `shortDesc` to an entity** (the text lives in `dex.loadTextData()`),
   and every rule that reads prose fell through. The roster's `dex` is now a view over the same dex whose tables hand
   back a wrapped entity with the text table's description. The shared dex the battles use is untouched. On Reg M-B
   the only entities wrapped are the `Past` Hidden Power variants.
3. **The newer text writes "1.5×"** where the rules match "1.5x". Normalised in the wrapper.

Items COULD-NOT-STAGE went 56 → 34 → 12 across the three fixes; the rest are below. `fixture_legality` now travels in
every roster artifact and `engine/quarantine.js` fails a stage on a NOT-baselined refusal or an unjudged block (three
selftest arms; RED when the term is removed from `rosterOk`: 381 / 2).

| stage | MATCH | DIFFER | DID-NOT-FIRE | COULD-NOT-STAGE | other | illegal sets (not baselined) |
|---|---|---|---|---|---|---|
| items (166 in scope) | 154 | 0 | 0 | 12 | — | 17 of 519 |
| abilities (214) | 199 | 0 | 2 | 9 | 1 deferred, 3 announcement-only | 82 of 754 |
| moves (511) | 506 | 0 | 0 | 1 | 3 below usage shelf, 1 deferred; 1 red whose plant did not apply | 47 of 835 |

- **DID-NOT-FIRE (ENGINE):** Seed Sower (the authority sets Grassy Terrain, this engine does not), Steely Spirit
  (Dragapult 840 vs 885: the boost is missing).
- **Below the usage shelf, boards differ (ENGINE, low priority):** Jaw Lock (`vol.trapped` missing), Bounce on Cinderace
  (types: the authority's Libero makes it Flying), Mirror Coat on Baxcalibur (HP).
- **COULD-NOT-STAGE, items:** Air Balloon, Binding Band, Electric / Grassy / Misty / Psychic Seed, Normal Gem, Rocky
  Helmet (no shape rule reaches an item new to this regulation: THE STAGING IS INERT); Eject Button, Red Card (THREW:
  the roster's script answers `pass` where the authority wants a move); Leek (its crit-ratio handler throws when read
  off the format); Terrain Extender (its prose names "Electric/Grassy/Misty/Psychic Terrain" as one string).
- **COULD-NOT-STAGE, abilities:** Emergency Exit, Grass Pelt, Libero, Liquid Ooze, Punk Rock, Rattled, Run Away,
  Stakeout (inert staging); Harvest (no delivery move puts Arboliva in the window).
- **COULD-NOT-STAGE, moves:** Milk Drink (the precondition did not land).
- **Red whose plant did not apply:** `move/needs-the-terrain-it-names` — the anchor matched 0 times in the 0.32.0 engine
  bytes; the plant string is stale.
- **Illegal fixtures:** mostly the inert control click (Focus Energy) on bodies that cannot learn it, plus
  moves / abilities the M-C build does not carry.

## 5. The lattices and the held-out draw

Rule for the held-out draw, re-derived: Reg M-B's held-out is `--games 12000` — ten times the base sample, a lattice
none of the gate's samples draws (`engine/quarantine.js` header, the 2026-09-12 wide sample). `engine/lattice_walk.js
--regulation regmc --anchor 1200,1600,1900 --from 12000 --to 12000`: 14,889 picks, 10,931 (73.4%) drawn by none of the
three gate sizes (Reg M-B's 12000 on its own pool: 14,746 picks). So Reg M-C's held-out is `--games 12000` too.

| `--games` | games | board-material (state bar) | void | threw | refused | revival requests | pool digest |
|---|---|---|---|---|---|---|---|
| 1200 | 953 | **21** | 2 | 0 | 0 | 12 | `3c60452ad2c5` |
| 1600 | 1266 | **30** | 0 | 0 | 0 | 18 | `2d8e6931a914` |
| 1900 | 1495 | **44** | 2 | 0 | 0 | 23 | `ede5538f9153` |
| 12000 (held out) | 7375 | **132** | 9 | 0 | 0 | 79 | `55c821241590` |

Command (each, through the launcher): `node engine/game_differential.js --regulation regmc --steering empirical --arm
middle --end-state --census data/verification/census-pin-regmc-f3b70bc0c47c.json --team-store data/team-pool-frozen-regmc
--release fa68d953e73f --games <N> --write --out <scratch> --dump-games 4000 --dump-out data/_scratch-meas-a7ee-dump-<tag>.json`.

**1200, by first protocol divergence of the 21:** Revival Blessing's `-heal` 6; Sirfetch'd display name 4; White Herb
spent by the authority and not here 2; `-damage` value 2 (Golisopod, Basculegion); Seed Sower's terrain; Liquid Ooze;
Berserk; Trace copying a different ability; Grassy Terrain's end; Psychic Terrain's `-activate` on a different body;
Double Shock's `-fail`. **1600, of the 30:** Revival Blessing 7, terrain ends / activations 8, White Herb 3, Sirfetch'd
3, Double Shock 3, and singles. **1900, of the first 40 listed** (`state.first_board_divergences` is capped at 40 of 44): terrain ends / activations 10, Revival Blessing 4, White Herb 4, Sirfetch'd 3. The 12000 run wrote its artifact and then died writing its dump (an absolute `--dump-out` is joined to the repo root; the three gate lattices used a relative path), so it has no by-cause breakdown here; its counts are read off the artifact. ENGINE's 0.32.0 1200 reading (18 of 954, 4 THREW) is not comparable one for one: the
revive games threw there, and the per-game mega slot deals some two-stone games differently.

## 6. The mechanics new to Reg M-C, by name

Roster verdict on release `fa68d953e73f`; census rows are those whose tag the entity carries in `data/tags-regmc.json`
(live / total); the probes are ENGINE's staged ones, all green on this release (run here).

| kind | name | Reg M-C roster | census rows | covering probe |
|---|---|---|---|---|
| ability | Aura Guard | **no roster row**: `engine/legal_scope.js` puts it out of scope (the checkout marks it `Future` and the re-admission ask refuses it), though Lucario-Mega-Z plays it in the pool | 3/3 live | `probe_regmc_aura_guard` green |
| ability | Emergency Exit | COULD-NOT-STAGE | none | `probe_regmc_emergency_exit` green |
| ability | Grass Pelt | COULD-NOT-STAGE | 1/1 | none |
| ability | Grassy Surge | FIRED-AND-AGREES | 1/1 | none |
| ability | Guard Dog | FIRED-AND-AGREES | 11/11 | none |
| ability | Libero | COULD-NOT-STAGE (and the Bounce row shows it unmodelled) | 4/4 | none |
| ability | Liquid Ooze | COULD-NOT-STAGE (a 1200 game parts on it) | none | none |
| ability | Psychic Surge | FIRED-AND-AGREES | 1/1 | none |
| ability | Punk Rock | COULD-NOT-STAGE | 12/12 | none |
| ability | Rattled | COULD-NOT-STAGE | 11/11 | none |
| ability | Run Away | COULD-NOT-STAGE | none | none |
| ability | Seed Sower | **DID-NOT-FIRE** | none | none |
| ability | Stakeout | COULD-NOT-STAGE | 8/8 | none |
| ability | Steely Spirit | **DID-NOT-FIRE** | none | none |
| ability | Thermal Exchange | FIRED-AND-AGREES | 16/16 | none |
| move | Court Change | FIRED-AND-AGREES | 13/13 | none |
| move | Double Shock | FIRED-AND-AGREES (lattice games part on its `-fail`) | 10/10 | none |
| move | Drum Beating | FIRED-AND-AGREES | 11/11 | `probe_regmc_move_effects` green |
| move | Glaive Rush | FIRED-AND-AGREES | 13/13 | `probe_regmc_glaive_rush` green |
| move | Jaw Lock | DIFFERS (shelved on usage: `vol.trapped`) | 25/25 | none |
| move | Meteor Assault | FIRED-AND-AGREES | 14/14 | none |
| move | Milk Drink | COULD-NOT-STAGE | 19/19 | none |
| move | Octolock | FIRED-AND-AGREES | 39/39 | `probe_regmc_octolock` green |
| move | Overdrive | FIRED-AND-AGREES | 21/21 | none |
| move | Pyro Ball | FIRED-AND-AGREES | 26/26 | none |
| move | Revival Blessing | FIRED-AND-AGREES (the no-fainted-ally road); the revive itself DIFFERS | 21/21 | `probe_regmc_revival_blessing`, `test-revive-mirror` green |
| move | Shift Gear | FIRED-AND-AGREES | 19/19 | `probe_regmc_move_effects` green |
| move | Snipe Shot | FIRED-AND-AGREES | 8/8 | none |
| move | Zing Zap | FIRED-AND-AGREES | 32/32 | none |
| item | Air Balloon | COULD-NOT-STAGE | 1/1 | `probe_regmc_air_balloon` green |
| item | Binding Band | COULD-NOT-STAGE | 1/1 | `probe_regmc_binding_band` green |
| item | Eject Button | COULD-NOT-STAGE (THREW) | 1/1 | `probe_regmc_eject_items` green |
| item | Electric Seed | COULD-NOT-STAGE | 3/3 | `probe_regmc_terrain_seeds` (derived cast) green |
| item | Grassy Seed | COULD-NOT-STAGE | 3/3 | `probe_regmc_terrain_seeds` green |
| item | Leek | COULD-NOT-STAGE | 1/1 | none |
| item | Misty Seed | COULD-NOT-STAGE | 3/3 | `probe_regmc_terrain_seeds` (derived cast) green |
| item | Normal Gem | COULD-NOT-STAGE | none | `probe_regmc_type_gem` green |
| item | Psychic Seed | COULD-NOT-STAGE | 3/3 | `probe_regmc_terrain_seeds` green |
| item | Red Card | COULD-NOT-STAGE (THREW) | 1/1 | `probe_regmc_eject_items` green |
| item | Rocky Helmet | COULD-NOT-STAGE | 1/1 | `probe_regmc_rocky_helmet` green |
| item | Terrain Extender | COULD-NOT-STAGE | 4/4 | `probe_regmc_terrain_extender` green |

Roster totals over the 41: **FIRED-AND-AGREES 16, DIFFERS 1 (Jaw Lock, shelved), DID-NOT-FIRE 2, COULD-NOT-STAGE 21,
no row 1 (Aura Guard, out of the roster's scope).** Twelve of the 21 COULD-NOT-STAGE are covered by a green ENGINE probe that compares against the authority;
the roster verdict still counts against the gate until a shape rule stages them.

**The two changes no legality list shows.** `tests/probe_regmc_changed_pp.js` derives the moves legal in both whose
`pp` differs (Strength Sap and Wish, 10 → 5 base). The engine reads PP from the `pp` tag of the selected tag file
(`medicham2-browser.js` `ppMax`, and `engine/pp.js` `maxPP` reads the same tag): both answer 8 for each, the Reg M-C
maximum. Each is played out of PP in a real game against Showdown (Arboliva, Umbreon): PP remaining agrees at every
boundary, 8 → 0 on both engines, and the authority's own slot maximum is 8. **Shown RED** on a copy of the engine
whose `ppMax` adds 4 (the Reg M-B maximum): both moves read 11 → 4 against the authority's 7 → 0. The species that lost
two moves and gained one is a learnset change, and a learnset is the validator's, not the engine's: the roster's
`fixture_legality` is the check that would see a fixture built on the lost moves.

## 7. Owed

**ENGINE:**
- The revive road: medicham2 pivots where the authority revives (`MEDFAILS.reviveUnmodelled`); 6 of 21 board-material
  games at 1200. `mirrorRevival` will mirror a revive the moment the engine performs one.
- Seed Sower and Steely Spirit DID-NOT-FIRE; Libero (types), Jaw Lock (`vol.trapped`), Mirror Coat (HP) behind the usage
  shelf; the lattice families above.
- `engine/tag_dex.js` and `engine/screen_tags.js` read `shortDesc`; the Reg M-C checkout does not attach it to the
  entity (§4). Whatever the Reg M-C tag file derived from prose should be re-checked against `dex.loadTextData()`.

**Scope (whoever owns `engine/legal_scope.js`):** Aura Guard is `isNonstandard: "Future"` in the Reg M-C checkout and the scope's re-admission ask refuses all 20 Future entities, yet Lucario-Mega-Z plays it and a probe stages it. An in-game mechanic outside the roster's scope is invisible to the roster clause. Checked: the Reg M-C TeamValidator accepts Lucario holding Lucarionite Z.

**MEASURE (this division, next pass):**
- Roster shape rules for the item classes new to this regulation (the 12 item COULD-NOT-STAGE), the `pass` answer that
  throws on Eject Button and Red Card, the Leek crit-ratio read, Terrain Extender's combined prose, and the eight inert
  ability stagings.
- The illegal fixture sets (mostly the inert control click on a body that cannot learn it).
- The stale plant anchor of `move/needs-the-terrain-it-names`.
- The census deliberate-break refusal list, derived rather than typed (§3 trap).

## 8. Reg M-B, unmoved

- No tracked Reg M-B artifact changed: `data/mechanics-census.json` was restored from HEAD after every Reg M-B census
  run (git checkout in this worktree); no Reg M-B roster, differential or pin was written.
- Census: HEAD's code and the new code, run on this tree, differ only in `formatSecondaryChance` (above). `probed`,
  `live`, `missing`, `hollow`, `armed`, `directCall` equal.
- Lattice 1200 on release `2e9db8bb11fd`: 0 of 961, `state`, `mega` (less the new fields) and `first_divergences`
  identical to the published `data/game-differential.json`; the other differing keys are `generated`, `elapsed_s`,
  the new `declared_gaps.revival_requests`, and the steering stamp (the live Reg M-B `data/protocol-events.json` has
  moved since the published run, and the driver-code digest moved with this change).
- `engine/quarantine.js` (no flag): output identical to HEAD's `engine/quarantine.js` run on the same tree, including
  the inventory line. `--selftest` 383 passed, 0 failed.
- Tests: `test-regulation-table` 24/0, `test-regulation-artifacts` 31/0, `test-regulation-steering` 29/0, `test-mc-key`
  green, `test-engine-release` 80/0, `test-docs-current` green, `test-forced-switch-mirror` all pass. `test-engine-release`
  and `test-forced-switch-mirror` first failed on the worktree alone: the pointer's release and the live stores are
  absent from a worktree; both were supplied read-only from the main tree (a release copy, hard links).

- **The commit hook refused the first commit** on `tests/test-artifact-rerunnable.js`: it opens every release under the
  default regulation, and `open()` refuses a release cut for another one, so the Reg M-C roster artifacts read STRANDED.
  Fixed: such a release is verified intact and banded ANOTHER-REGULATION (6 / 6 green; the remaining pre-existing
  STRANDED row is the baselined one). The hook also refused two unannounced `catch` blocks in the fixture search; they
  now count and print at exit (zero on both regulations).

## 9. Runbook rows appended (`docs/REGULATION-ROTATION.md`)

Census rows that hard-code the closed regulation's builds; a table field that means two things (`bp: 0`); driver state
that crosses games; a harness mirror with no answer for a new request kind; a changed value on an entity legal in both
(invisible to every added / removed list); the roster reading the closed regulation's tags and the old text layout; a
fixture legality verdict that was computed and thrown away.
