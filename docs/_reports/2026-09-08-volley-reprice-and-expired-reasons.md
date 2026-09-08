# Batch O — the per-arrival re-price stops disarming itself, and seven expired staging reasons

ENGINE, 2026-09-08. Two jobs, both filed and neither finished before today.

- **JOB 1** — the per-arrival volley re-price fell back to whole-volley pricing on **39 of 180**
  non-flat clicks, at its own arrival-0 invariant.
- **JOB 2** — seven `COULD-NOT-STAGE` reasons in `tests/roster.js` had outlived the thing they
  described.

Nothing was committed. `node engine/status.js --write` was not run, per the brief.

---

## THE SAMPLE LINE, IN FULL — AND `--steering` IS PART OF IT

```
--release <id> --steering empirical --arm middle --state --end-state
--census data/verification/census-pin-9446a684709d.json
--team-store data/team-pool-frozen --games 1200 --turns 50
```

| | release | what it holds |
|---|---|---|
| BASELINE | `1415f271058e` | the settled tree at the start of this session (batch N's engine) |
| AFTER | `7f012a9afe01` | the same tree plus this batch's `engine/medicham2-browser.js` |

Every figure in this report is a BEFORE/AFTER pair over those two releases with **every other token
identical**. 961 games in all four runs; `--games 1200` is a request and the pinned pool yields 961.

### `--steering` IS A SAMPLE DEFINITION AND I GOT IT WRONG FIRST. IT COST TWO FULL RUNS.

The brief names the release, the arm, the census pin, the team store, `--games` and `--turns`. It
does not name `--steering`, whose default is `coverage` (`census-coverage-seeking/v1`) — and **every
published figure this batch is measured against was produced under `empirical`**
(`empirical-click/v1`). It is written in the artifact and nowhere else:

```
node -e "console.log(require('./data/game-differential.json').steering.policy)"   ->  empirical-click/v1
```

The two are not the same question and the receipts say so out loud. Under `coverage`, on the
UNTOUCHED baseline engine, the same pins give **961 games, `state.games` 958 → 961, board-material
2/961, 26 non-flat volleys**. Under `empirical`: **958, 0/958, 180 non-flat volleys.** I spent two
13-minute runs measuring a real before/after on the wrong instrument and briefly wrote up "the
brief's `0 of 958` does not reproduce" — it reproduces exactly, under the driver that produced it.
**A flag that is not in the command line is still in the sample.**

Both instruments are reported below. The `empirical` pair is the one that answers the brief; the
`coverage` pair is kept because it is a second, independently-steered confirmation of the same
arithmetic.

The `--state --end-state` pair is also part of the sample: **without it the run prints no
board-material bar at all**, which is how a missing figure looks when nothing refuses it.

---

## JOB 1 — WHAT THE INVARIANT WAS PROTECTING AGAINST, MEASURED BEFORE ANYTHING MOVED

The counter said *that* and never *why*, so the first change was to make it say why: 40 capped
sample rows carrying the shape of both sides (`MEDFAILS.arrivalRepriceDriftsAtArrivalZeroSamples`).
On a 150-game pinned run they came back unanimous:

```
populationbomb  10 packets  crit0=true   price 42  reprice 420      (x10)
watershuriken    5 packets  crit0=false  price  6  reprice  30      (x5)
watershuriken    5 packets  crit0=false  price  7  reprice  35      (x5)
```

**The re-price was handing back exactly N times the arrival.** Two independent causes, both now
closed:

### 1. THE CLOSURE WAS ROUTED ON THE BANDS, AND THE CALLEE BRANCHES ON THE MOVE

`dmgRange` honours `onlyHitNo` **only inside its per-hit loop**, and a volley whose power does not
vary by arrival never reaches that loop — it returns from the `!perHitPower` road above it with the
**whole volley's** band. Batch N chose between the two closures by asking whether the arrivals'
BANDS happened to be equal. That is a fact about the dice, not about the move: a power-flat volley
whose per-arrival **crit vector is mixed** — `crits=[false,false,false,true]` on a Bullet Seed — has
four different bands and one base, so it took the `onlyHitNo` road and got the whole-volley answer.

**So the invariant was protecting against the re-price inventing N times the damage on every
arrival of those clicks.** Without it, 39 clicks in the pool would have dealt four to ten times
their real damage. It is kept exactly as it was; only the ROUTE moved, onto `hitPlanOf`'s own
`perHitPower` — the same field, off the same call, that decides which road `dmgRange` takes.

`dmgRange` now reports which road it took as an out-parameter (`hit.planPerHitPower`) beside the
packets it already writes, rather than the call site making a second `hitPlanOf` call — a second
call would double-count `MEDSEEN.parentalBondPlanned` and would be a second copy of a fact with one
owner. A price that hands back packets and no road reading increments
`MEDFAILS.arrivalRepricePlanRoadUnreported` and falls back loudly.

### 2. A FORME ABSORB MAKES ARRIVAL 0 UNREPRODUCIBLE

`_absMulti` overwrites `hit.packets[0]` with sixteen zeroes **after** `dmgRange` returned, so the
number the invariant compared against was not one `dmgRange` produced. An Icicle Spear into a fresh
Mimikyu read `price 0 reprice 84`, and the whole click disarmed. Asked again at price time it cannot
come back the other way either — the forme is still intact there, so a single-arrival question is
absorbed whole and answers 0.

The invariant now asks **the other half of the same question**: on an absorbed volley the re-price
must AGREE THAT THE CLICK IS ABSORBED. The closure stays armed because the arrivals it actually
serves are priced at APPLY time, below `_absPending.bust()` — `formeAbsorbBustBetweenArrivals` runs
at the foot of arrival 0's pass and the re-price runs at the head of arrival 1's.

### THE POOL RECEIPT — ALL 180 NOW PRICE PER ARRIVAL

`--steering empirical`, the instrument every published figure here uses:

| `per-arrival volley re-price` | BASELINE `1415f271058e` | AFTER `7f012a9afe01` |
|---|---|---|
| offered | 500 | **539** |
| ran | 861 | **935** |
| MOVED a number | 15 | 15 |
| refused non-flat (the census of the population) | 180 | 180 |
| **drifted at arrival 0** | **39** | **0** |

**500 + 39 = 539, exactly, and 141 + 39 = 180.** The 39 the batch-N report left open are the whole
remainder, they are now served, and the refusal census is unchanged — which is what says the
POPULATION did not move, only which closure serves it.

The `coverage`-steered pair says the same thing on a different sample: offered **102 → 116**, ran
139 → 156, drifted **14 → 0**, non-flat 26 → 26. `102 + 14 = 116`.

### BOARD-MATERIAL AND NARRATION — BOTH UNCHANGED

`--steering empirical`:

| | BASELINE | AFTER |
|---|---|---|
| games | 961 | 961 |
| DIVERGED (protocol) | 57 | 57 |
| GAMES whose board NEVER diverged | 958/958 | **958/958 — 100.0%** |
| **BOARD-MATERIAL GAMES** (the bar: `state.games` less `state.games_board_never_diverged`) | **0/958** | **0/958** |
| NARRATION-ONLY | 52 causes, 54 games | 52 causes, 54 games |

**Board-material holds at 0 of 958 and narration does not move** (54 raw less the 1 declared row is
the brief's 53). Read the CLAUSE and not the field: the by-cause table in the same receipt prints
`BOARD-MATERIAL 3 causes, 3 games`, which is the attribution and is a different number from the bar
— identical in both runs either way.

The `coverage`-steered pair also holds: board-material **2/961 → 2/961**, narration 23 causes / 26
games in both. Its 2 are pre-existing and nothing to do with volleys — one cause, identical in both
runs, `event missing from medicham2 :: |-activate|p1b|cudchew <> |upkeep` at turn 22.

### WILL'S TWO CASES, DEMONSTRATED

`tests/probe_arrival_drift_zero.js`. Five arms, all on the `middle` arm, all against the authority.

| arm | what changes mid-volley | CLEAN | `--red` |
|---|---|---|---|
| **RED-1** Venusaur Bullet Seed → Milotic + **Rindo Berry** | the berry is EATEN on arrival 1 | boards identical | **PART** |
| **RED-2** Lycanroc Tail Slap → Volcarona + **Flame Body** | the attacker is BURNED on arrival 1 | boards identical | **PART** |
| CTRL-A the same Bullet Seed into the same Milotic, **empty hand** | nothing | identical, `MOVED 0` | identical |
| CTRL-B the same Tail Slap into a Volcarona carrying **Swarm** | nothing | identical, `MOVED 0` | identical |
| CTRL-D Mamoswine Icicle Spear into an **intact Disguise** | the forme absorb | `invariant-absorbed +1` | `drifted +1` |
| CTRL-C a **single-arrival** Giga Drain into the Rindo Milotic | the berry, once | identical | identical |

The measured HP series, target's HP after each arrival:

```
RED-1   showdown [154, 116,  78,  28]      arrivals 2-4 are FULL, the berry is gone
        medicham [154, 135, 116,  91]      pre-fix: still halved
        medicham [154, 116,  78,  28]      after

RED-2   showdown [138, 123, 114]           arrivals 2-3 are HALVED by the burn
        medicham [138, 107,  88]           pre-fix: not halved
        medicham [138, 123, 114]           after
```

**The `--red` arm reproduces the pre-fix engine byte-for-byte** — `[154,135,116,91]` and
`[138,107,88]` are exactly what the live tree produced before a byte moved, measured and recorded
first. `MEDI_ARRIVAL_REPRICE_BANDROUTE=1` restores batch N's two decisions (route on band equality,
invariant at arrival 0) and nothing else; it is narrower than `MEDI_ARRIVAL_REPRICE_FLAT_ONLY` and
narrower again than `MEDI_ARRIVAL_PRICE_ONCE`.

**THE KNOB IS ASSERTED TO HAVE REACHED THE RULE.** `MEDFAILS.arrivalRepriceBandRouteRestored` must
read **1** in the red arm and **0** in the clean one, and it is gated on a volley whose bands
actually DIFFER having reached the site — a restore nothing could observe is not a restore. Each
volley arm also asserts `arrivalRepriceRefusedNonFlat +1` (the click is in the population this file
is about, not a plain flat volley batch M already served) and, in the clean arm,
`arrivalRepriceFlatPowerMixedBand +1` (it took the new route).

**THE CONTROLS ARE SILENT IN THE COUNTER, NOT ONLY IN THE PROSE.** CTRL-A and CTRL-B play the SAME
drifting volley as their red partners — same crit vector, same price — and assert
`arrivalRepriceMoved +0`. A control that only compared HP could not tell "nothing changed" from
"two errors cancelled".

**CTRL-D IS THE ONLY WITNESS THE ABSORB BRANCH HAS**, and it needs one: a disarmed volley is unfixed
rather than wrong, so its boards hold in both arms and the HP series can say nothing. What separates
them is the counter — `arrivalRepriceInvariantAbsorbed +1` clean, `drifted +1` red.

**AND CTRL-D FOUND A DEFECT THAT IS NOT THIS BATCH'S, WHICH IS WHY IT IS DECLARED RATHER THAN
WAIVED.** Its boards DO part, identically on both engines:

```
showdown   -activate Disguise | -damage 130/130 | detailschange Busted
           -damage 114/130 [from] Mimikyu-Busted | -crit | 69 | 41 | 13 | -hitcount 4
medicham   -activate Disguise | -damage 130/130 | detailschange Busted
           -damage 114/130 [from] mimikyu-busted |       | 84 | 56 | 28 | -hitcount 4
```

The absorb, the bust, the chip (114 on both) and arrivals 3 and 4 (28 each on both) all agree. The
whole difference is **one `|-crit|` the authority draws on arrival 2 of an absorbed volley and this
engine does not** — 45 against 30. That is the per-arrival CRIT vector on a volley whose first
arrival was eaten, a different wire, and it goes on the hand list. The arm asserts the parting is
EXACTLY that shape (chip identical, one authority crit against none, and every arrival after it
equal), so it fails the day anything else moves AND the day the crit is fixed — a declared remainder
that cannot quietly become a permanent exemption.

Probe results: **clean — all assertions green, exit 0. `--red` — all assertions green, exit 0** (the
red arm asserts the opposite outcomes, so green there means the fixture parted exactly where it must).

### WHAT WAS PREDICTED AND WHAT MISSED

`data/verification/_prediction-2026-09-08-arrival-reprice-route.json`, written before the pool run.

| | claim | outcome |
|---|---|---|
| P1 | drift → 0, offered rises from 490 to about 529 | **HIT on the mechanism, off by nine on the number.** 39 → 0, and offered rose 500 → 539. The 490 in the prediction was quoted from batch N's receipt on a different release; the arithmetic (`+39`) was exactly right. |
| P2 | `arrivalRepriceMoved` rises above 14 | **MISS.** 15 → 15 on the empirical pair, 0 → 0 on the coverage pair. Nothing happens between the arrivals of those 39 clicks in either pool sample, so the fix is visible in the staged probe and not in the pool. |
| P3 | board-material does not rise | **HIT** — 0/958 → 0/958 |
| P4 | narration does not rise | **HIT** — 52 causes / 54 games, both runs |
| P5 | roster counts and census hold | **HIT for abilities, moves and the census; items MOVED ON PURPOSE**, 140 → 142 |
| P6 | the Parental Bond probes stay green | **HIT** |
| P7 | `arrivalRepricePlanRoadUnreported` reads 0 | **HIT** |

P2 is the interesting miss and it is the same shape as the note in CLAUDE.md about which scoreboard
to check: **this is a lab fix**, and the pool is not where it shows. The prediction should have said
so before the run rather than after.

**AND THE PREDICTION FILE ITSELF NAMED THE WRONG INSTRUMENT**, because the brief did and I did not
check. See the `--steering` note at the top: two of the four pool runs in this pass exist only
because of that.

### THE OTHER PROBES

Re-run on the live tree: `probe_arrival_reprice`, `probe_bond_arrival_reprice`,
`probe_drain_per_arrival`, `probe_multihit_corners`, `probe_multihit_update`, `probe_volley_collapse`,
`probe_kingsrock_volley`, `probe_bond_one_arrival_hitcount`, `test-multihit-roll`,
`test-multihit-damage-game` — **all exit 0**. `probe_volley_reactor_count` refuses to run without an
explicit `--release` (by design) and is run against `7f012a9afe01`.

### CENSUS

`node tests/test-mechanics.js` re-run on the fixed bytes: **830 live / 830 probed / 0 missing**,
0 probes threw, 0 hollow, 830 of 830 return `{control, test}` arms. Unchanged.

### NOTED IN PASSING, NOT CHASED — POPULATION BOMB AND FLAME BODY

While searching for a drifting fixture, a Maushold Population Bomb into a Flame Body body parted the
boards at **every** priming offset with `drift 0` — the two engines burn the attacker on **different
arrivals** (the authority halves from arrival 2, this engine from arrival 4), and at one offset
medicham landed one arrival where the authority landed six. That is a different wire (per-arrival
reaction dice / multiaccuracy), it is NOT this batch's, and it is reported rather than touched.

---

## JOB 2 — SEVEN EXPIRED REASONS: TWO FELL, FIVE WERE REPAIRED

Every claim was checked against the tree before it was touched.

| row | the claim it carried | verdict | what happened |
|---|---|---|---|
| `leppaberry` | *"board_state.js does not compare PP in either engine (medicham2 does not track it at all)"* | **FALSE, both halves** | **STAGED** |
| `shedshell` | *"the script language has no switch action and board_state.js does not compare ability trapping"* | **FALSE** | **STAGED** |
| `focusenergy` | (a) it IS the inert control click; (b) *"not a leaf board_state.js compares"* | (a) binds, (b) **expired** | repaired |
| `struggle` | (a) Showdown disables it; (b) *"medicham2 does not track PP at all"* | (a) binds, (b) **expired** | repaired |
| `focusband` | *"game_differential.js PRIMARY_ARM: no secondary fires"* | claim true, **anchor dead** | re-anchored |
| `kingsrock` | same | same | re-anchored |
| `quickclaw` | same | same | re-anchored |
| `galewings` | *"its own Flying click (Drill Peck)"* | **FALSE** — Talonflame does not learn it | repaired |

### THE TWO THAT FELL

**LEPPA BERRY — `FIRED-AND-BOARDS-MATCH`, staged for the first time.** The reason was false on both
halves: `engine/board_state.js` carries a live leaf `pp-is-what-has-been-spent` read through
medicham2's own `ppSpentMap`, and `engine/game_differential.js` compares PP on every board unless a
caller declares `ppHold` — which `tests/roster.js` does not. (Will spotted this one himself.)

The fixture is derived end to end (`PP_DRAIN`): the smallest-`pp.max` **boring delivery move**, a
buildable legal body **type-immune** to it, and a buildable legal body that **learns** it. The holder
clicks it once per turn, `pp.max` times, at a body that cannot be hurt by it — so the only leaf that
can move is the PP the click spent. Derived today: **Charizard clicks Dragon Pulse at a Fairy body
for 16 turns**, the berry answers on the emptying turn, and the control ends on 16 spent while the
subject ends on 6.

Two things the derivation refuses on purpose. Neither body may carry **Pressure** — `carrierAbility`'s
`INTERFERES` list is about damage and does not name `onDeductPP`, so a Pressure body would spend two
points a click and empty the slot on a turn nobody scheduled: a fixture that half-works and reports a
pass. And the script is **exactly `pp.max` turns, not one more** — the first cut had one more, and
the control arm (no berry) hit an empty slot and threw
`Can't move: Charizard's Dragon Pulse is disabled`. That is in the code comment, measured.

**SHED SHELL — `FIRED-AND-BOARDS-MATCH`, staged for the first time.** `{ sw: '<species>' }` has been
a legal step since 2026-08-08 and ten rows including Shadow Tag use it today. The second half of the
old reason — that `board_state.js` does not compare ability trapping — is TRUE and was never the
obstacle: `switchVerdict` compares the two engines **in the two forms they answer in** (Showdown
rejects the choice string, medicham2 leaves the body in the slot), which needs no leaf.

The trap is a **move**, derived off the `trapsTarget` tag rather than named — this format's only
`preventsSwitch` ability sits on a mega forme, which the item stage cannot build. The authority runs
the item through the same `TrapPokemon` event either way (`onTrapPokemonPriority: -10` clears
`pokemon.trapped` last, whatever set it — `data/items.ts:5635`) and medicham2 spends the same
`escapesTrap` param on its move-laid branch, so both engines are asked one question. Staged today:
**Venusaur lays Block on Charizard on turn 1; on turn 2 the holder asks to leave for Beedrill.**

**THE POLARITY IS INVERTED AND IT GOT ITS OWN READER, `escapeVerdict`.** The trap is in BOTH arms and
the ITEM is the variable — the holder must LEAVE and the same body holding nothing must be REFUSED.
That is not a flag inside `switchVerdict`: every sentence of that function is written for "the entity
TRAPS" ("with the move in place", "with the trap removed"), and an inverted arm reading its prose
would print the opposite of what happened. The control is checked FIRST, exactly as it is one
function up — a trap that never bound makes the subject leaving vacuous — and there is a
`FIRED-AND-BOARDS-DIFFER` branch for the case where medicham2 does not honour the trap in the first
place, because the item cannot be read until that is true.

**AND THE FIRST RUN CAUGHT A FIXTURE BUG BY THROWING RATHER THAN BY PASSING.**
`scaffold`'s `build(lead, second, third)` pushes `third` straight after `lead` when `second` is
absent — so passing `b0` and `b2` only put the arriving body in the **active ally slot**,
`{ sw: ... }` found nobody on the bench by that name, resolved to `pass`, and Showdown rejected the
choice with `Can't pass`. Named in the code comment where the fix is.

### THE THREE THAT WERE RE-ANCHORED

`focusband`, `kingsrock` and `quickclaw` cited `game_differential.js PRIMARY_ARM` for *"no secondary
fires"*. **`PRIMARY_ARM` has meant the `middle` arm since 2026-08-13 (commit `cf7a2c5`), whose own
`what` string says the opposite: "secondaries fire at their printed chance".** The claim is still
true — but of `tests/roster.js`'s OWN `PRIMARY_ARM_ID = 'top-tie-first'`, which is what the sentence
now names. This is the same failure as the fourteen stale handoffs: a citation outliving the thing it
cited, still reading as authoritative.

**The repair says more than the old one did, and deliberately.** The old sentence ended *"nothing
staged here could distinguish a wired mechanic from an absent one"*, which is now an overclaim: the
**live-die lane** (`arm: 'middle'` with a coin receipt) landed on 2026-09-07 and eight ability rules
declare it. No item rule does. The reason names that as the open route rather than asserting an
impossibility that has stopped being one.

### THE TWO WHOSE SECOND CLAUSE STILL BINDS

**`focusenergy`** — clause (b), *"not a leaf board_state.js compares"*, has been false since
2026-08-12, when `board_state.js` began comparing nine per-body volatiles with `focusenergy` among
them (`tests/roster.js`'s own header records the date). Clause (a) binds on its own and is
structural: this move IS the inert control click, so both arms run an identical script and the delta
is empty by construction. No leaf could rescue that. **The stale half was deleted rather than
rewritten to agree with today** — the reason now says the effect IS expressible and that there is
simply no arm to express it against.

**`struggle`** — clause (b), *"medicham2 does not track PP at all (board_state.js NOT_COMPARED)"*, is
false for the same reason Leppa's was, and `item/pp-restore` in this very file now empties a slot by
clicking it. Clause (a) binds: Showdown disables Struggle for any body with a usable move. **What
refuses it is arithmetic, not tracking**, and the reason now says so — `scaffold` appends the inert
click to every body it builds, so a Struggle fixture has to empty EVERY slot, and the inert click
cannot be chosen once the tested slot is dry. Named as owed work in the file, not as a limit of the
engine.

### GALE WINGS

The reason called Drill Peck *"Talonflame's own Flying click"*. **Talonflame cannot learn Drill
Peck** — derived, not recalled. `hitOfType` reads a format-wide DELIVERY table (the highest-power
move of that type passing `deliveryOf`, taken over the whole dex) and **nothing in
`ability/priority-mod` asks whether the carrier can learn it.**

The refusal is real; it belongs to the delivery pick. The repaired reason now derives and prints
three checkable facts, none of them typed:

```
of the 1 carrier(s) of this ability, 0 learn Drill Peck.
A HIGHER-POWER Flying MOVE A CARRIER DOES LEARN EXISTS AND IS REFUSED BY `deliveryOf`:
Brave Bird (120 BP), Fly (90 BP), Hurricane (110 BP), Sky Attack (140 BP)
```

Brave Bird is refused on `m.recoil` (recoil would move the carrier's own HP inside the experiment);
Fly and Sky Attack on `flags.charge`; Hurricane on 70 accuracy. So this is **owed work in
`tests/roster.js` — a learnset-aware delivery pick for this rule — and not a fact about the
simulator**, which is what the reason now says. Nothing about the delivery table was changed: it is
shared by many rules and moving it moves the sample.

---

## THE ROSTER AFTER THE PASS — release `7f012a9afe01`

| stage | FIRED-AND-BOARDS-MATCH | DIFFER | DID-NOT-FIRE | COULD-NOT-STAGE | CONTROL-NOT-QUIET | DEFERRED |
|---|---|---|---|---|---|---|
| items | **142** (was 140) | 0 | 0 | **6** (was 8) | 0 | 0 |
| abilities | **139** (unchanged) | 0 | 0 | 158 | 14 | 5 |
| moves | **487** (unchanged) | 0 | 0 | 10 | 0 | 3 |

**The only movement is the two rows that were deliberately staged.** Abilities and moves are
byte-identical in their counts; the Gale Wings, Focus Energy and Struggle edits change reason TEXT
only.

`tests/test-roster-arm-pin.js` — **all clauses pass** on `7f012a9afe01`.

---

## FILES

| file | what changed |
|---|---|
| `engine/medicham2-browser.js` | the route (`perHitPower`), the absorbed-arrival invariant, `hit.planPerHitPower`, the `MEDI_ARRIVAL_REPRICE_BANDROUTE` knob, four counters and the 40-row drift sample |
| `tests/probe_arrival_drift_zero.js` | NEW — five arms, red via the knob |
| `tests/roster.js` | `PP_DRAIN`, `TRAP_ESCAPE`, `escapeVerdict`, `item/pp-restore`, `item/trapping-escape`, `item/chance-gated`, `move/is-the-control-click`, the Struggle clause, `ability/priority-mod`'s no-carrier reason |
| `data/verification/_prediction-2026-09-08-arrival-reprice-route.json` | NEW — written before the pool run |
| `data/roster.{items,abilities,moves}.json`, `data/mechanics-census.json` | regenerated |

### THE THREE ARTIFACTS THIS BATCH INVALIDATED WERE RE-PUBLISHED, NOT LEFT STALE

Moving `engine/medicham2-browser.js` staled `data/game-differential.json`, `data/engine-diff.json`
and `data/all-mechanics-fire.json`, and `engine/status.js` correctly withheld all three (*"that is
not a weaker answer, it is an answer about other bytes"*). Each was re-run on `7f012a9afe01` with the
command the gate itself prints:

```
node engine/game_differential.js --steering empirical --release 7f012a9afe01 --arm middle \
     --state --end-state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 50 --team-store data/team-pool-frozen --write
node tests/test-engine-diff.js --n 6000 --seed 20260804
node engine/all_mechanics_fire.js --kind all --write
```

### THE GATE AFTERWARDS — BACK TO WHERE THE BRIEF FOUND IT

```
the LIVE gate says 2 of 9 GATING clauses fail  (CLOSED)

  PASS  game differential                          0 of 6000 at BOTH corners of the damage roll
  PASS  deliberate roster / items                  142 of 148 tested
  PASS  deliberate roster / abilities              139 of 202 tested
  PASS  deliberate roster / moves                  487 of 500 tested
  PASS  whole-game differential / BOARD-MATERIAL   0 of 958
  PASS  mechanics / each one staged and compared against showdown
  FAIL  whole-game differential / NARRATION        53 of 961   (unchanged, and its own gate)
  FAIL  no open, known engine defect               #376 — the OTHER agent's row
  census                                           830/830 probed, 0 missing
```

Both failing clauses are the two the brief named. Nothing else moved.

**LINES TOUCHED IN `engine/medicham2-browser.js`, FOR THE AGENT ON ROADMAP #376.** Nothing in the
turn-order path. The edits are: the `MEDSEEN`/`MEDFAILS` counter blocks (~1509, ~3393, ~3409), the
knob declaration beside `ARRIVAL_REPRICE_FLAT_ONLY` (~13856), `dmgRange`'s `wantPackets` block
(~13963, one added line), and `_stepDamage`'s re-price closure inside `battleTurn` (~35460–35560).
No line that decides who moves first was read or written.

