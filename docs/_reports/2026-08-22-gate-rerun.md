# Gate re-run against release 603d9a69d5a3 — 2026-08-22

Historical findings record. Not maintained, not current state, never cite as such.
Superseded by the register rows it feeds.

## What was run, and how it was pinned

All five instruments through `tools\lownode.cmd` (BelowNormal), one at a time, in the order
given, with repo-relative paths. No release was cut; `603d9a69d5a3` already existed and reports
`0 of 26 files have moved since`.

| # | command | exit |
|---|---|---|
| 1 | `tests\roster.js --stage items --write --release 603d9a69d5a3` | 1 |
| 2 | `tests\roster.js --stage abilities --write --release 603d9a69d5a3` | 1 |
| 3 | `tests\roster.js --stage moves --write --release 603d9a69d5a3` | 1 |
| 4 | `engine\game_differential.js --games 1200 --write --release 603d9a69d5a3 --census data\gate-census.pin.json --team-store data\team-pool-frozen` | 0 |
| 5 | `engine\all_mechanics_fire.js --kind all --write --release 603d9a69d5a3 --census data\gate-census.pin.json --team-store data\team-pool-frozen` | 0 |

`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` on every run.

Pin verification before any run:
- `data/gate-census.pin.json` sha256-12 = **80e648f34d56** — matches the brief.
- release `603d9a69d5a3` exists, 0 of 26 SOURCE files moved.
- `data/team-pool-frozen/` holds `games.bo3.jsonl` (13,214 lines) + `games.ots.jsonl` (4,167).

Two deviations from the literal brief, both deliberate and both recorded here:

1. **`--kind all` was added to run 5.** The default is `--kind moves`, the writer at
   `all_mechanics_fire.js:3611` does a whole-file `writeFileSync` with no merge, and the
   superseded artifact carried `summary.moves`, `summary.abilities` and `summary.items`.
   Running the default would have silently deleted two thirds of the artifact's scope and
   broken the gate's `mechanicsClause`.
2. **`tests/roster.js` accepts `--release` only.** It has no `--census` and no `--team-store`
   flag; it stages its own boards from upstream entity data and does not draw from the store.
   The other two accept all three, and `all_mechanics_fire.js` forwards them to
   `game_differential.js` through shared `process.argv` (confirmed: the new artifact's
   `steering.input_read_from` reads `data/gate-census.pin.json`).

`node engine/status.js --write` was **not** run. It rewrites `data/open-work.json` and
`data/provenance-stamp.json`, which are not outputs of these five runs, and the brief forbids
touching anything under `data/` that is not. The docs GENERATED blocks are therefore one
restamp behind. Flagged for the coordinator, not actioned.

## The headline

**All five instruments now describe the tree.** Every artifact carries
`engine_release`/`release` = `603d9a69d5a3`.

**Not one of the five clauses cleared.** The staleness was hiding real breakage, and the
breakage is much larger than the superseded artifacts suggested — the roster went from a clean
sweep to 168 differing entities. The gate still reads 6 of 8 failing, but the reasons have
changed completely: before, three roster clauses refused to answer; now they answer and the
answer is red.

---

## 1-3. The deliberate roster

Old figures read with `git show HEAD:data/roster.<stage>.json` before any run started, so
nothing was read while a process was writing.

| stage | | FIRED-AND-BOARDS-DIFFER | DID-NOT-FIRE | MATCH | CONTROL-NOT-QUIET | COULD-NOT-STAGE | DEFERRED | tested / in scope |
|---|---|---|---|---|---|---|---|---|
| **items** | old (96361d523e20) | 0 | 0 | 139 | 0 | 8 | 1 | 139 / 148 |
| | **new (603d9a69d5a3)** | **3** | **0** | 136 | 0 | 8 | 1 | 139 / 148 |
| **abilities** | old | 0 | 0 | 120 | 13 | 178 | 5 | 120 / 202 |
| | **new** | **8** | **1** | 116 | 47 | 144 | 0 | 125 / 202 |
| **moves** | old | 0 | 0 | 480 | 0 | 11 | 9 | 480 / 500 |
| | **new** | **157** | **0** | 298 | 0 | 20 | 25 | 455 / 500 |

Total: **168 FIRED-AND-BOARDS-DIFFER** against 0 in the superseded set, and **1 DID-NOT-FIRE**
(`hustle`) against 0.

### items — the three

| id | staging | leaves |
|---|---|---|
| `bigroot` | chipped, then draining with Bitter Blade | Kangaskhan hp: showdown 525 / ours 524 — **off-by-one** |
| `shellbell` | chipped turn 1, attacking turns 2-3 | Kangaskhan hp: showdown 635 / ours 634 — **off-by-one** |
| `greninjite` | Greninja -> Greninja-Mega | `types`: showdown `normal` / ours `dark/water` — **different-value** |

`greninjite` is not a rounding row and is the one with a named cause. Derived from the format:

```
greninja      types: [Water, Dark]  abilities: {0: Torrent, H: Protean, S: Battle Bond}
greninjamega  types: [Water, Dark]  abilities: {0: Protean}
```

The mega overwrites the ability with **Protean**, so on the mega's first click Showdown retypes
it to the move's type (Normal here). Ours keeps Water/Dark. Either the mega's overwritten
ability is not reaching the body, or Protean is not wired on the mega forme. That is a specific,
testable defect and it wants a probe before anyone touches it.

The other two are the same shape as the move stage below.

### abilities — the eight, plus one silent

| id | worst leaf | bucket |
|---|---|---|
| `eelevate` | Eelektross-Mega hp 134 / 142 | off-by-4-or-more |
| `levitate` | Hydreigon hp 154 / 158 | off-by-4-or-more |
| `megasol` | Skeledirge hp 84 / 115, then 0 / 42 (we fail to KO) | off-by-4-or-more |
| `moody` | Glalie boosts.atk 0 / +2, def 0 / -1, spa -1 / 0 | off-by-2-or-3 |
| `mummy` | Cofagrigus hp 717 / 744 | off-by-4-or-more |
| `stancechange` | Aegislash-Blade hp 753 / 772 | off-by-4-or-more |
| `unseenfist` | Venusaur hp 128 / 137 | off-by-4-or-more |
| `wanderingspirit` | Runerigus hp 717 / 744 | off-by-4-or-more |

DID-NOT-FIRE: **`hustle`** — one entity, and `hustle` also shows STATE-parted in the mechanics
instrument (Feraligatr hp 879 / 906), so two instruments agree it is broken.

Seven of the eight are HP on the carrier under a staged damage script. `moody` is a boost-roll
row, which is an RNG-alignment shape, not a magnitude one.

Two bookkeeping movements worth naming because they change what the stage is claiming:
- `CONTROL-NOT-QUIET` **13 -> 47**. Those 47 count in neither column and are UNMEASURED, not
  passing. The old artifact's `unattributable_ids` listed 13; the new list is 47.
- `COULD-NOT-STAGE` **178 -> 144**, i.e. 34 rows became stageable. Some of the new differs are
  in rows the old run never compared, so the 0 -> 8 is not purely a regression — but it is not
  purely an unmasking either, since `levitate`, `unseenfist` and `stancechange` were all in the
  old tested set at MATCH.

### moves — the 157, and the signature

This is the load-bearing number. 157 of 455 tested moves differ. The leaf population:

```
buckets   off-by-one 260   off-by-2-or-3 210   off-by-4-or-more 192   present-in-one-engine-only 32
fields    hp 309   party.hp 307   status 16+16   vol.confusion 10   vol.focusenergy 7   boosts.* ~24
rows whose every leaf is an hp field:  131 of 157
rows carrying at least one NON-hp leaf: 26
```

**616 of 694 leaves are HP.** The direction is symmetric:

```
hp leaves compared: 309    ours HIGHER (we under-damage): 156    ours LOWER (we over-damage): 153
delta  min -174   median +1   max +364
|delta| median 2   p90 8
```

A formula error is biased. **A symmetric ±small error centred on zero is a DRAW error — the
engine is picking a different index out of the 16-roll damage band than Showdown does, under
dice the roster pins on both sides.** The affected ids are ordinary damaging moves in
alphabetical order (`accelerock, aerialace, bite, bodyslam, bugbuzz, crunch, darkpulse, …`),
which is what a shared-mechanism break looks like rather than 157 independent bugs.

The 26 rows carrying a non-HP leaf are all secondary-effect rows — `bite`, `confuseray`,
`scald`, `scorchingsands`, `ancientpower`, `fierydance`, `thunderpunch` — consistent with the
same root cause: once the damage draw moves, every subsequent secondary/status draw on the
shared stream shifts with it.

**This is invisible to `tests/test-engine-diff.js`, which reads 0/6000.** That instrument
compares index 0 against `d.max` and index 15 against `d.min` — the two points where an index
and a span coincide (its own scope note, ROADMAP #304). A wrong index INSIDE the band produces
exactly this: endpoints agree, real games part. The last commit is
*"The dice, the formes, and a line ending that disarmed every red proof"*.

Also moved: `DEFERRED-BY-OWNER` **9 -> 25** and `COULD-NOT-STAGE` **11 -> 20**, so the tested
denominator fell 480 -> 455. The 25 deferrals are
`axekick clearsmog comeuppance copycat counter covet firelash flatter focuspunch mistyexplosion
petaldance pluck poisonfang pounce pound ragingfury rapidspin shadowpunch smartstrike
sparklingaria spiritshackle spitup steelroller triattack uproar`.

**NOT FIXED, DELIBERATELY.** No engine file was touched. Landing this mid-chain would have
re-staled everything measured after it.

---

## 4. The whole-game differential

| | old (HEAD, release 6a05dd9ad60d) | **new (603d9a69d5a3)** |
|---|---|---|
| games played | 961 | **961** |
| games requested | — | 1200 |
| diverged (raw) | 133 | **126** |
| void games | 3 | **2** |
| usable games | 958 | **959** |
| diverged among usable | 131 | **124** |
| rate over usable | 13.67% | **12.93%** |
| gate's own figure (less 5 declared) | — | **121 of 961 = 12.6%** |
| mode | `A/middle/pins:1fd77b835ee2/credit:observed-effect/v1/nature:real` | identical |

### Is the comparison legitimate?

Mostly yes, and the one gap is named. The two runs share the arm and the pin digest
(`1fd77b835ee2`), and the swarm composition is **byte-identical**:

```
baseline 129 | omit-protect 48 | omit-priority 3 | omit-weather 130 | omit-intimidate 129
omit-spread 128 | pair-protect-bust 130 | pair-redirect-priority 132 | pair-speedctrl 132
```

with the same `available`/`picked` on every config. What differs is the census steering:
old `data/verification/census-pin-2cab3179f5fc.json` (digest `2cab3179f5fc`, `matches_live: false`),
new `data/gate-census.pin.json` (digest `80e648f34d56`, `matches_live: true`). Both are 623 rows
and both `selects_from: 560`. The census SELECTS the sample, so this is a caveat on the
133 -> 126 delta, not a clean before/after. It is stated rather than absorbed.

Separately, `status.js` withholds direction of travel against the STAMPED baseline, which is
`A/top-tie-first/pins:ef342837b791` — a different corner and therefore a different instrument.
Re-stamping under this pin is `node engine/quarantine.js --stamp-whole-game` and was not run.

### Why 961 and not 1200

Not a truncation and not a pool limit. The swarm splits the request across 9 configurations and
three of them exhaust their team-pair supply: `omit-priority` has 7 pairs available and played 3,
`omit-protect` has 99 and played 48. The old run hit the same ceiling at the same 961. The
frozen pool holds 17,381 stored games; the binding constraint is configuration-eligible pairs.

### Class composition

| class | old | **new** |
|---|---|---|
| event missing from medicham2 | 42 | **46** |
| ordering | 29 | **25** |
| drag: a different body | 24 | **23** |
| unrelated event mismatch | 13 | **14** |
| extra event emitted by medicham2 | 9 | **7** |
| -boost field 3 | 6 | **6** |
| -damage field 3 | 5 | **2** |
| -unboost field 3 | 1 | **2** |
| -damage: a different body | 1 | **1** |
| -unboost: a different body | 2 | **0 (cleared)** |
| showdown stopped emitting while medicham2 continued | 1 | **0 (cleared)** |
| **total** | **133** | **126** |

The gate's own family split of the 126: `emission 53, field 34, ordering 22, rule 17`.

### ROADMAP #218 and #299

- **#218** says this instrument reported 39.6% of games diverging and gated nothing. That
  figure is superseded twice over: the rate is now **12.93% over usable / 12.6% as the gate
  counts it**, and the clause **does** gate — it is one of the six FAILs.
- **#299** asks whether the headline denominator still includes void games. **It does not.** The
  artifact carries the split explicitly in `mid_void`: `void_games 2`, `usable_games 959`,
  `diverged_among_usable 124`, `diverged_rate_over_usable 0.1293`, plus a `by_reason` table
  (`no-addresses:neither-drew 469`, `shared-addresses-agree 211`,
  `no-outcome-addresses:neither-drew 153`, `no-addresses:me-empty 108`,
  `no-addresses:sd-empty 17`, `low-identity 2`, `no-outcome-addresses:me-empty 1`). Void is 2
  games, not 350. Both rows can be closed on this artifact.

### Declared counters that must read zero and do not

Printed by the run, recorded here, not fixed:

- `switch lookups that MISSED: medicham 40, showdown 1` — **must read 0**. A miss means that
  side PASSED while the other switched.
- `MEDFAILS.traceBodyOffField = 4` — **must read 0**; first offender `farigiraf`.
  `tests/test-protocol-trace.js` PART 6 owns this.
- 6 forced switches UNMIRRORABLE (boards had already parted; each keeps its own earlier
  divergence, so this is not double-counted).
- **Zero to Hero is silent** — found by the run, not assumed. Showdown transforms Palafin on
  SWITCH-OUT (`|detailschange|`) and announces `|-activate|... ability: Zero to Hero` on the way
  back in; medicham2 transforms on the RETURN inside `bringIn()` and emits neither line.
  Different moment AND two missing lines.

Clean: 0 choices Showdown refused, 0 clicks at an empty slot, 0 undeclared events dropped,
0 teams unbuildable, 0 lookups that threw, 0 stat alignments forced.

---

## 5. Mechanics fire

| | old (b240433ae8af) | **new (603d9a69d5a3)** |
|---|---|---|
| games played | 1281 | **1281** |
| red demonstration ok | true | **true** |
| **moves** diverged | 21 (24 incl. shelved: 23) | **22** (incl. shelved **24**) |
| moves resolved / tried | 495 / 500 | **495 / 500** |
| moves resolution disagreements | 14 | **14** |
| **abilities** diverged | 12 | **12** |
| abilities fired / showdown-only / medicham-only | 103 / 9 / 0 | **103 / 9 / 0** |
| abilities did-not-fire / unreachable | 58 / 129 | **58 / 129** |
| **items** diverged | 2 | **2** |
| items fired / did-not-fire | 64 / 9 | **64 / 9** |

**This instrument barely moved: +1 diverging move, everything else identical.** That is itself
informative — it says last night's engine work did not touch what this harness exercises, while
it broke a third of the roster's move stage. The two instruments are asking different questions
(a real game with the harness's own dice vs a staged single turn with the roster's pins), and
the roster is the one that moved.

The 36 diverging mechanics, by name:

- **moves (22)** `attract bellydrum bittermalice chillyreception clangoroussoul corrosivegas
  cottonspore disable dragoncheer dragondarts ficklebeam gastroacid healbell nightdaze
  poltergeist recycle reflecttype scaleshot shellsidearm smackdown stringshot sweetscent
  switcheroo teeterdance` (24 listed incl. the 2 shelved)
- **abilities (12)** `angerpoint berserk cloudnine cursedbody electromorphosis forewarn hustle
  magicbounce regenerator sandforce sapsipper supremeoverlord toxicdebris` (13 incl. shelved)
- **items (2)** `leppaberry mentalherb metronome` (3 incl. shelved)

The gate ranks 29 of these 36 as played-and-uncleared, worst first by store usage:
`ability:cursedbody` (2,177 teams), `ability:toxicdebris` (1,840), `move:disable` (1,799 clicks),
`ability:regenerator` (1,596), `move:poltergeist` (1,383), `item:mentalherb` (967). Seven fall
below the reach anchor (25 clicks / 6 teams) and are still staged and played, just not counted:
`recycle gastroacid reflecttype corrosivegas sweetscent leppaberry healbell`.

**SHOWDOWN-ONLY abilities (9) — engine bugs by this instrument's own definition:**
`forewarn moldbreaker naturalcure pressure regenerator rockhead superluck supremeoverlord
unnerve`. The authority's game changed when the ability was removed and ours did not.
MEDICHAM-ONLY is 0.

### Never fired: harness gap or engine gap?

**Harness, unambiguously, and it is declared as such rather than inferred.** 67 rows never fired
(58 abilities + 9 items). Every single one carries the same `why`:

> `the gauntlet never reached its trigger — swapping it for <control> changed neither game`

`did_not_fire_unexplained` is 20 by the summary's own accounting and
`cannot_fire_in_this_fixture` is 38, but no row is flagged with an unexplained marker — all 67
resolve to the gauntlet not reaching the trigger. The file's header is explicit that this is
"a gap in THIS instrument, reported as such and never as a pass". The 9 items are
`brightpowder damprock heatrock icyrock lightclay scopelens smoothrock widelens zoomlens` —
four accuracy/crit items the 100%-pin cannot exercise and five duration extenders whose effect
needs a weather or screen to outlive the turn cap.

For moves the equivalent is 1: **`struggle`**, which neither this instrument nor the roster
reaches.

### Board-state divergences the protocol arm cannot see

11 rows parted on the BOARD. Four of them parted with the two protocol streams in **complete
agreement** — a silent state defect the protocol arm is structurally blind to:

```
moves     axekick     vol.confusion   showdown 2 / we 1
          clearsmog   boosts.spe      showdown 0 / we +2
          roleplay    ability         showdown "torrent" / we "synchronize"
abilities klutz       item            showdown "sitrusberry" / we ""
```

The rest: `healbell` (status `""` vs `"slp"`, counter 0 vs 2), `reflecttype` (types `water` vs
`ghost/poison`), `shellsidearm` (hp 741 / 752), `hustle` (hp 879 / 906), `magicbounce`
(`vol.trapped` 0 / 1), `sandforce` (hp 642 / 658), `metronome` (hp 859 / 868).

Five ANNOUNCEMENT-ONLY rows write a leaf `board_state.js` does not read and are UNASKED rather
than clean: `attract chillyreception dragoncheer gastroacid smackdown` (all `volatile:*`).

---

## Final gate state

`node engine/status.js`, read-only, after all five runs:

```
PASS  game differential              0/6000 at midpoint, top and bottom (seed 20260804)
FAIL  deliberate roster / items      3 DIFFER, 0 SILENT — 139 of 148 tested
FAIL  deliberate roster / abilities  8 DIFFER, 1 SILENT — 125 of 202 tested (47 in neither column)
FAIL  deliberate roster / moves      157 DIFFER, 0 SILENT — 455 of 500 tested
PASS  coverage                       all 412 moves above 25 clicks are measured by roster or census
FAIL  whole-game differential        121 of 961 = 12.6% diverge
FAIL  mechanics                      29 of 36 diverging mechanics played and uncleared
FAIL  no open, known engine defect   #218, #241, #258 open and naming a RED instrument
```

**Cleared by this re-run: nothing.** What changed is the KIND of failure. Before, the three
roster clauses did not fail on a count at all — `rosterStage()` refused them at the release
guard (`quarantine.js:488`) with *"MEASURED AGAINST A DIFFERENT ENGINE"*, and withheld every
number. They now answer, and the answer is red. Same for the differential (was
`6a05dd9ad60d`) and mechanics (was `b240433ae8af`).

The eighth clause, `no open, known engine defect`, is bookkeeping and moves only when the
register moves. It names **#218** (94,313 uses), **#241** and **#258** as open rows pointing at
a RED instrument. On the evidence above, **#218's own headline is now wrong in our favour**
(39.6% -> 12.6%) and **#299's void-denominator concern is answered by the artifact** — both
are candidates for closure by whoever owns the register. It also lists 13 open rows that assert
breakage with no instrument deciding them (`#327 #220 #300 #301 #310 #312 #314 #315 #318 #319
#323 #325 #317`) — debt, not evidence, and they do not hold the clause shut.

`623/623 probed mechanics live` is unchanged. ENGINE's one number did not move, because
`tests/test-mechanics.js` was not part of this chain and no engine file was edited.

## Defects found and deliberately left on the floor

For whoever lands the fixes after this baseline exists. Each wants a failing probe first.

1. **The damage roll index.** 157 move rows, 131 of them HP-only, symmetric ±2 median. Almost
   certainly one mechanism in last night's dice pass. `test-engine-diff.js` cannot see it by
   construction. **Fix this first — it very likely also explains `bigroot`, `shellbell` and
   six of the eight ability rows, which would take 168 reds down to a handful.**
2. **Greninja-Mega does not get Protean.** The mega overwrites ability to Protean (derived,
   above); Showdown retypes to `normal` on the first click, we stay `dark/water`.
3. **Zero to Hero fires at the wrong moment and emits nothing.** Showdown: switch-OUT +
   `|detailschange|` + `|-activate|` on return. Ours: on return inside `bringIn()`, silent.
4. **`switch lookups that MISSED: medicham 40`** — must read 0.
5. **`MEDFAILS.traceBodyOffField = 4`**, first `farigiraf` — must read 0.
6. **9 SHOWDOWN-ONLY abilities**: `forewarn moldbreaker naturalcure pressure regenerator
   rockhead superluck supremeoverlord unnerve`.
7. **Four silent state defects** the protocol arm cannot see: `axekick` (confusion counter),
   `clearsmog` (boosts not cleared), `roleplay` (ability not copied), `klutz` (item lost).
8. **`hustle`** — DID-NOT-FIRE on the roster and STATE-parted on the mechanics instrument.
   Two instruments, one entity, agreeing.

## Files written

Outputs of these runs only. Nothing else under `engine/` or `data/` was touched.

```
data/roster.items.json          (prev bytes -> data/roster.items.prev.json)
data/roster.abilities.json      (prev bytes -> data/roster.abilities.prev.json)
data/roster.moves.json          (prev bytes -> data/roster.moves.prev.json)
data/roster.json                (convenience copy of the LAST stage — moves. NOT the roster.)
data/game-differential.json
data/all-mechanics-fire.json
```
