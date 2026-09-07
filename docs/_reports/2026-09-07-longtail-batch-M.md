# LONG-TAIL BATCH M — the ruler corrected first, then the volley price. 2026-09-07

**Release under test:** `3f9830acc467`. **Pins** `de38d17e15a2`, census `9446a684709d`,
`--team-store data/team-pool-frozen`, arm `middle`, steering `empirical-click/v1`.

Sample line (identical for every run in this batch except the named extra flag):

```
node engine/game_differential.js --steering empirical --release 3f9830acc467 --arm middle \
  --end-state --state --census data/verification/census-pin-9446a684709d.json \
  --games 1200 --turns 20 --team-store data/team-pool-frozen --write
```

`--games 1200` is part of the SAMPLE DEFINITION, not a budget. 961 games played.

Baseline at the top of the batch: **board-material 8 of 961, protocol 77, narration 68.**

---

## 1. THE INSTRUMENT WAS ACCUSING THE ENGINE — 8 of 961 -> 5 of 958. NO ENGINE BYTE MOVED.

**This is a change to the RULER. It is reported first, measured alone, and it must not be read as a
strength gain or as a mechanic landing.**

One run of `engine/game_differential.js` published two headline numbers with two different
denominators, and nothing said so:

```
mid_void.diverged_among_usable / mid_void.usable_games      74 / 958   <- protocol, FILTERED
state.games - state.games_board_never_diverged               8 / 961   <- board,    UNFILTERED
```

A `low-identity` game is one **this instrument declares unreadable**: the shared-address identity of
the two dice streams fell under `MID_OVERLAP_FLOOR` (0.90), so the two engines were not flipping the
same coins and whatever their boards did afterwards is the ruler's doing. The protocol side has
excluded those games for as long as the middle arm has existed. The board clause walked `results`
unfiltered, so the bar everybody reads charged the engine for the three games the instrument had
already refused to read.

**The fix.** `STATE_SUMMARY` is now an IIFE over `allResults` that shadows `results` with
`allResults.filter(r => !r._mid_void)`. The exclusion is **published, not netted off** —
`state.games_void_excluded` and `state.games_before_void_exclusion` are new fields, and
`--state-count-void` reproduces the old population exactly. `mid_void.void_game_tags` names the void
games and says what each one's board did, so the claim is auditable from the artifact alone rather
than by matching two lists in prose.

**Prediction** (`data/verification/_prediction-2026-09-07-batchM-void-clause.json`, written before
the run): board-material 5, `state.games` 958, `games_void_excluded` 3, protocol 77 unchanged, and
three named games leave. **HIT on every clause.**

**Measured**, `tests/probe_state_void_exclusion.js`, both runs on release `3f9830acc467`:

```
RED    board-material 8 of 961   (void excluded from the board population: 0)
GREEN  board-material 5 of 958   (void excluded from the board population: 3)
```

The three that left, read out of `mid_void.void_game_tags`, all `why=low-identity`:

| game | turns | protocol parted | board parted |
|---|---|---|---|
| `omit-protect ...bo3-2662758209` | 7 | t4 | t4 |
| `omit-spread ...bo3-2657358877` | 10 | t5 | t6 |
| `omit-spread ...bo3-2658645239` | 3 | t3 | t3 |

Every claim in the probe held, including the four that could have refuted it: no row ARRIVED, the
bar moved by exactly the count of void-and-parted games, the protocol count is byte-identical at 77
across both arms, and the void verdict itself did not move (3/958/74 on both). The probe FAILS
rather than passing quietly if the sample contains no void game — "the fixture reaches the rule" is
asserted, not assumed.

**What a reader can no longer be told:** that board-material is quoted over every game played. It is
now quoted over the games the instrument can read, which is the denominator the protocol rate beside
it has always used. `8 of 961` and `5 of 958` are the same engine measured with two different
rulers; only the second is comparable with the `74 / 958` printed next to it.


---

## 2. A STAT CHANGE BETWEEN THE ARRIVALS OF A VOLLEY WAS INVISIBLE TO THE LATER ONES

**THE FACT WAS COMPUTED AHEAD OF THE EVENTS THAT SHOULD FEED IT.** `hitStepMoveHitLoop` calls
`spreadMoveHit` once per hit (`sim/battle-actions.ts:947`) and `getSpreadDamage` -> `getDamage` runs
INSIDE each pass (`data/mods/champions/scripts.ts:361`), so the authority prices arrival k against
the board arrival k-1 left behind. This engine asked `dmgRange` ONCE, in `_stepDamage`, before any
arrival landed; `_stepApply`'s packet loop then dealt every arrival off bands that could not know
what the arrivals before them had done.

**Staged from scratch and reproduced before a byte moved** — Aerodactyl Dual Wingbeat (6,800 corpus
uses, derived from `data/tags.json`) into a Stamina Mudsdale (4,647):

```
showdown  |-damage|p2a: Mudsdale|141/175  |-boost|def|1  |-damage|p2a: Mudsdale|119/175   [arrival 2 dealt 22]
medicham  |-damage|p2a: Mudsdale|141/175  |-boost|def|1  |-damage|p2a: Mudsdale|107/175   [dealt 34 — arrival 1 again]
```

board leaf `p2.party.mudsdale.hp  medi 107 / sd 119`.

**THE FIX. The price step keeps the roll INDEX each arrival spent and hands the apply loop a closure
that re-prices ONE arrival (`hits: 1`) against the current board. No new die is drawn** — the index
is read back — so the dice addressing of every multi-hit click in the pool is unchanged, which is
what keeps this out of the middle arm's shared-address identity and off the pin.

Scoped and counted rather than assumed:

- **It is offered only for a FLAT volley** — every arrival sharing one band. Triple Axel's escalating
  power and Parental Bond's quarter give their arrivals different bands and a `hits: 1` re-price would
  hand arrival 1's band to all of them. `MEDFAILS.arrivalRepriceRefusedNonFlat` is the declared
  remainder.
- **An invariant checks the re-price against the price on every click that offers one.** Arrival 0 has
  had nothing happen to it, so its re-price must reproduce the band the price handed back;
  `MEDFAILS.arrivalRepriceDriftsAtArrivalZero` fires and the wire DISARMS ITSELF for that click
  instead of inventing a number. It reads 0.
- **The row total follows the arrivals** through the existing `_reDealt` helper, capped on the
  pre-loop HP, so recoil, drain and `_dealtEach` read the number that was actually dealt.

`MEDI_ARRIVAL_PRICE_ONCE=1` restores the old engine. `tests/probe_arrival_reprice.js`.

### THE PROBE, AND THE TWO ARMS THAT REFUSE A LAZY FIX

RED first, five arms, all measured against the authority on the same staged board:

| arm | authority arrival 1 / arrival 2 | RED (`MEDI_ARRIVAL_PRICE_ONCE=1`) | clean |
|---|---|---|---|
| RED-1 Dual Wingbeat into **Stamina** Mudsdale | 34 / **22** | `[141,107]` vs `[141,119]` — PARTS | identical |
| RED-2 Dual Wingbeat into **Weak Armor** Armarouge | 34 / **49** | `[126,92]` vs `[126,77]` — PARTS | identical |
| RED-3 Dual Wingbeat into a **Coba Berry** Machamp | 39 / **78** | `[126,87]` vs `[126,48]` — PARTS | identical |
| CTRL-A Dual Wingbeat into a plain Snorlax | 46 / 46 | HOLDS | identical |
| CTRL-B single-hit Iron Head into the same Stamina Mudsdale | — | HOLDS | identical |

**RED-2 is the arm that matters.** Weak Armor DROPS Def, so arrival 2 must get LARGER. A fix that
only ever shrank a later arrival passes RED-1 and fails here — and it is the same wire.

**RED-3 was not predicted and is the third thing this wire changed.** The resist berry is consumed
inside arrival 1's `getDamage`, so the authority prices arrival 2 with an empty hand; this engine
halved the whole volley. Carried as its own arm because a change nobody predicted is a change nobody
measured.

Counters on the clean arm: `arrivalRepriceOffered 4`, `arrivalRepriceRan 4`, `arrivalRepriceMoved 3`
— **and the probe asserts `Moved === 3` exactly.** `Ran` with `Moved` at zero would be a re-price
reading a board that is not moving: identical output at the cost of a call per hit, indistinguishable
from the old engine. CTRL-A must NOT move it.

### TWO PROBE BUGS FOUND BEFORE THE ENGINE WAS

Both would have produced a confident wrong answer, and both were found by printing the fixture rather
than by reading the assertion:

1. **The attacker carried Unnerve**, copied from `probe_reaction_address.js`. `unnerve` is
   `blocksBerries` (derived), so the Coba arm's berry never fired **on either side** and the arm
   reported a quiet agreement about a mechanic it had disabled. Rock Head now, with the derivation
   asserted in the fixture check.
2. **The authority writes every `-damage` twice** — `cur/maxhp` for the owning side and `cur/100` for
   the observer — and medicham2's trace carries the first form only. The first cut compared
   `[189,80,143,60]` against `[189,143]` and called four arms red for it.

A third, cheaper one: `BENCH('toxapex','gastrodon')` returned a null pair and every arm printed
NOT-STAGED. NOT-STAGED counts as a FAILURE in this file, which is why it was visible at all.

### AND ONE CENSUS ROW WENT DOWN BEFORE IT CAME BACK — IT WAS THE PROBE PINNING A KO

`ability|reactorPerHit` ("Weak Armor triggers once per hit of a multi-hit move") flipped
**true -> false** on the first census run after the wire: `830/830` became `829/830`.

Diagnosed rather than waived. The fixture is a Garchomp Bullet Seed (3 hits) into a Weak Armor
Milotic. Under the old engine every arrival was priced off the first, so 170 HP became 38 and the
body survived to react three times. With the compounding Def drop the volley reads
`-1 / -2 / -3` on the way in, the same Milotic **dies on hit 3**, and a fainted body reacts to
nothing — in this engine and in Showdown alike. **The probe was measuring a KO clamp, not the
mechanic**, which is exactly what this file's own header says makes a probe hollow.

`unfaintable(f1); unfaintable(f2);` — the harness's own helper. **Measured both ways before the line
was written:** with the foes unfaintable all four arms read `-1/2`, `-3/6`, `-1/2/-1/2` and `-2/4`
under `MEDI_ARRIVAL_PRICE_ONCE=1` AND on the clean engine, so the staging removes a KO and changes no
reaction count. The damage still differs across the arms (1168 against 1228 of 1360), which is what
says the wire is still doing its work in that fixture. Census back to **830 live, 0 missing, 830
probed.**

---

## 3. THE MEASUREMENT, AND THE ATTRIBUTION BETWEEN RULER AND ENGINE

Four runs, the same sample line every time, the same census pin `9446a684709d`, the same
`--team-store data/team-pool-frozen`, the same `--games 1200` (961 played), the same driver bytes.
`--state-count-void` is the knob that restores the pre-2026-09-07 board population.

| ruler | release | board-material | protocol diverged | re-price counters |
|---|---|---|---|---|
| **OLD** (`--state-count-void`) | `3f9830acc467` — the batch baseline | **8 of 961** | 77 | offered 0 |
| **OLD** | `830350135192` — the engine fix | **7 of 961** | 76 | offered 349, ran 633, moved 10 |
| **NEW** | `3f9830acc467` | **5 of 958** | 77 | offered 0 |
| **NEW** | `830350135192` | **4 of 958** | 76 | offered 349, ran 633, moved 10 |

**READ THE COLUMN, NOT THE CORNERS.** The instrument correction removes **3** games (and 3 from the
denominator) on either release. The engine fix removes **1** on either ruler. The two are separable
and neither is doing the other's work.

**The series LINKS.** The current driver bytes reproduce the pre-batch `8 of 961` exactly under
`--state-count-void`, which is the back-cast that makes `8 -> 4` a single series rather than two
questions. It is asserted, not assumed: `arrivalRepriceOffered` reads **0** on the frozen
`3f9830acc467` engine and **349** on `830350135192`, so the counters travel with the release and the
old arm is genuinely the old engine.

**`engine/arms_comparable.js`, verbatim**, on the published baseline against the published result:

```
ARE THESE TWO ARMS COMPARABLE?
  before  <scratch>/gd-before-batchM.json
          release 3f9830acc467   steering 9446a684709d   961 games
  after   data/game-differential.json
          release 830350135192   steering 9446a684709d   961 games

  NOT COMPARABLE — shown to differ:
    - the INSTRUMENT differs: driver code 228006b5faca vs f360a8681749. 1 file(s) moved between the
      arms — engine/game_differential.js. The code that reads the tables selects the sample just as
      much as the tables do; on 2026-09-05 one such edit moved a whole-game run from 138 to 167
      divergences under pins that were otherwise byte-identical.

  DO NOT PUBLISH THIS AS A BEFORE/AFTER.
```

**It is right and it is answered rather than argued with.** The instrument DID move — twice, and both
deliberately. The four-run table above is the answer: every pair in it holds one of the two variables
fixed, and the `--state-count-void` row on the current driver reproduces the old number to the game.
**Do not quote `8 of 961` against `4 of 958` without the table.**

### THE POOL RECEIPT — the wire fired outside its own probe

`per-arrival volley re-price: offered 349, ran 633, MOVED a number 10  [refused non-flat 180
(tripleaxel x3), drifted at arrival 0 0, total not corrected 0]`

349 volleys were offered a re-price, 633 later arrivals took one, and **10 numbers actually moved**
across 961 games. `Ran` high with `Moved` at zero would have been the silent-default shape — output
identical to the old engine at the cost of a `dmgRange` call per arrival — so it is printed with that
warning attached. **180 arrivals were REFUSED as non-flat, all Triple Axel**, which is the declared
remainder and not a silent skip. The arrival-0 invariant held everywhere: 0 drifts, 0 uncorrected
totals.

### PREDICTIONS

`data/verification/_prediction-2026-09-07-batchM-void-clause.json` — **HIT on every clause.**
5 of 958, 3 excluded, protocol unchanged at 77, and the three named games left.

`data/verification/_prediction-2026-09-07-batchM-arrival-reprice.json` — **HIT.** Predicted
board-material 4, the game that leaves named as `pair-protect-bust ...bo3-2653991758` t7, protocol
"77 or lower, not predicted to rise", `mid_void.void_games` unchanged at 3.

Measured: **4 of 958**, that exact game left, **protocol 77 -> 76**, `mid_void.void_games` 3,
`diverged_among_usable` 74 -> 73. **No game arrived and no game transferred** — the other four rows
are the same games, on the same causes, at the same turns.

**One thing was NOT predicted and was found by the probe rather than by the run:** the re-price also
un-halves a volley whose resist berry arrival 0 consumed (RED-3). That is a third behaviour this one
wire changes, and it is now staged.

### BOARD-MATERIAL IS **4 OF 958**. IT IS NOT ZERO.

The four that remain, read off `state.first_board_divergences` after the fix:

| game | board t | protocol t | first board leaf |
|---|---|---|---|
| `omit-spread ...bo3-2662243229` | 11 | 11 | `p2.party.kingambit.hp  medi 14 / sd 65` |
| `pair-protect-bust ...bo3-2661266222` | 6 | 5 | `p1.party.incineroar.hp  medi 127 / sd 119` |
| `pair-redirect-priority ...bo3-2654621676` | 8 | 6 | `p1.party.excadrill.hp  medi 107 / sd 122` |
| `pair-speedctrl ...bo3-2654408616` | 5 | 2 | `p1.pp[1].shellsidearm  medi 0 / sd 1` |

---

## 4. THE ITEM'S FRACTIONAL-PRIORITY DIE WAS DRAWN BEFORE THE ABILITY'S — 4 of 958 -> 3 of 958

**THIS WAS OWED IN WRITING AND THE ENGINE SAID SO ITSELF.** The fractional-priority loop's own header
read: *"The item's die is still taken first, so every seeded run in this repo reads the same stream
(the paragraph above is explicit that moving it is a separate change with its own probe)."*

**READ, NOT RECALLED.** `runEvent` sorts handlers by `onFractionalPriorityPriority` DESCENDING, and
the Champions mod overrides neither file (`grep quickdraw data/mods/champions/abilities.ts` -> 0,
`grep quickclaw data/mods/champions/items.ts` -> 0):

```
quickdraw       onFractionalPriorityPriority: -1    data/abilities.ts:3725
myceliummight   onFractionalPriorityPriority: -1    data/abilities.ts:2785
quickclaw       onFractionalPriorityPriority: -2    data/items.ts:4986
custapberry     onFractionalPriorityPriority: -2    data/items.ts:1243
```

so **-1 (the ABILITY) runs first and -2 (the ITEM) runs last.** This loop drew them the other way
round. Who WINS is unchanged and is also the authority's rule — the last handler to return a value
wins, and -2 is last — so only the DRAW ORDER moved.

**It is observable in exactly one population: a body carrying BOTH.** With one carrier there is one
die at one address. With two, the addresses share the base `seed|turn|any|-|-` and differ only at
`nth`, so swapping the order hands each handler **the other one's number**. Quick Draw is 30% and
Quick Claw is 20%, so a die in `[0.2, 0.3)` fires one and not the other.

**Slowbro-Galar is the whole population and it is not hypothetical.** It is this format's ONLY Quick
Draw carrier (derived; the probe refuses to run if that stops being true) and its usage item is a
Quick Claw. It is the `pair-speedctrl ...bo3-2654408616` board-material game.

### THE ARMS ARE COMPUTED, NOT FOUND BY TRIAL

`midEventValue` is a pure function of the address string, so the probe DERIVES which way each roll
goes and picks its arms off that table — an arm found by trial and error is a fixture nobody can
re-derive after a seed change.

```
turn 1  die0 0.9706  die1 0.1920   ability-first nudges YES   item-first nudges YES
turn 3  die0 0.3403  die1 0.8996   ability-first nudges no    item-first nudges no
turn 5  die0 0.2615  die1 0.8813   ability-first nudges YES   item-first nudges no   <-- THE ORDER PARTS
```

The derivation is then confirmed against the streams themselves: over six scripted turns the
authority's nudge sequence is `item, item, ability, ability` — turns 1, 2, 5, 6 — exactly what the
table predicts for the ability-first order.

| arm | RED (`MEDI_FRACPRI_ITEM_DIE_FIRST=1`) | clean |
|---|---|---|
| **RED-1** both carriers, turn 5 | first mover **showdown p1a / medicham p2a** — THE ORDER PARTS | identical |
| **RED-2** both carriers, turn 1 | order coincides, `item: Quick Claw` vs `ability: quickdraw` — the ATTRIBUTION parts | identical |
| CTRL-A ability alone | HOLDS | identical |
| CTRL-B item alone | HOLDS | identical |
| CTRL-C neither | HOLDS, and no die is drawn | identical |

**RED-2 is why RED-1 can be read.** A file whose only red arm changes the turn order cannot
distinguish "the die order moved" from "the nudge stopped working". **CTRL-A and CTRL-B are why it is
about the ORDER** rather than about either carrier being broken.

`MEDSEEN.fracPriBothCarriersOneBody` is the new receipt: the dual arms move it by 6 and every control
by 0, so an arm that never met a dual carrier fails instead of passing quietly.
`MEDFAILS.fracPriItemDieFirstRestored` is set **only when a dual carrier actually reached the loop**,
because a restore flag on a run where nothing could observe it is the loudest kind of silent default.

### MEASURED — release `c28ad0815782`, same sample line

**Board-material 4 of 958 -> 3 of 958.** `pair-speedctrl ...bo3-2654408616` left, exactly as
predicted. Protocol stayed at **76** — that game still parts its narration at t2 on a different
cause; only its BOARD came together. `mid_void.void_games` 3, unchanged. **No game arrived and no
game transferred.**

**The prediction recorded its own weakness and it did not bite.**
`_prediction-2026-09-07-batchM-fracpri-order.json` said the confidence was LOWER than the volley fix,
because the previous batch named Quick Draw from a PROTOCOL line while the bar reads the first BOARD
one, and this repo has aimed three batches off the wrong list. It happened to be right here. The
staged reproduction is what made it safe to try, not the by-cause row.

---

## THE BATCH, END TO END

| step | release | board-material | protocol | narration |
|---|---|---|---|---|
| baseline | `3f9830acc467` | 8 of 961 | 77 | 68 |
| **the ruler corrected** (no engine byte) | `3f9830acc467` | **5 of 958** | 77 | — |
| the volley priced per arrival | `830350135192` | **4 of 958** | 76 | — |
| the fractional-priority die order | `c28ad0815782` | **3 of 958** | 76 | 69 |

**Of the five games that left the bar, THREE were the instrument and TWO were the engine.** Narration
rose 68 -> 69: the Quick Draw game did not stop diverging, it stopped diverging on the BOARD.

Gate: **7 pass / 2 fail**, the same two as at the batch start (BOARD-MATERIAL and NARRATION).
Census **830/830, 0 missing**. Roster **140 / 129 / 475** with 0 FIRED-AND-BOARDS-DIFFER and 0
DID-NOT-FIRE across all three stages. Engine-diff **0 of 6000**, re-published on `c28ad0815782`;
`all-mechanics-fire.json` likewise, because both had aged onto the batch's first release and were
reading `MEASURED AGAINST A DIFFERENT ENGINE`.

**BOARD-MATERIAL IS 3 OF 958. IT IS NOT ZERO. The quarantine does not open.**

The three that remain:

| game | board t | protocol t | first board leaf | standing note |
|---|---|---|---|---|
| `omit-spread ...bo3-2662243229` | 11 | 11 | `p2.party.kingambit.hp  medi 14 / sd 65` | Last Resort lands here and fails there — and **the game does not reproduce standalone**, which is itself unexplained and part of the row |
| `pair-protect-bust ...bo3-2661266222` | 6 | 5 | `p1.party.incineroar.hp  medi 127 / sd 119` | first PROTOCOL split is a `-hitcount` on a one-hit Parental Bond click; the BOARD parts a turn later on a cause still unidentified |
| `pair-redirect-priority ...bo3-2654621676` | 8 | 6 | `p1.party.excadrill.hp  medi 107 / sd 122` | staged standalone, this engine correctly refuses the re-aimed Leech Seed and only the `-fail` line is absent, so the board cause is **still unidentified** |

**Two of the three name a protocol symptom and not a board cause.** Aiming at those lines is what the
by-cause list invites and it is not a diagnosis — both need staging from the board leaf, the way the
volley game was.

---

## TWO THINGS THAT WENT WRONG IN THE INSTRUMENTATION, RECORDED BECAUSE BOTH WERE SILENT

**1. `--out` INTO A DIRECTORY THAT DID NOT EXIST WROTE NOTHING AND SAID NOTHING.** The first pair of
`--state-count-void` back-cast runs was pointed at `data/verification/batchM/`, which had not been
created. Both runs printed their full console block, exited 0, and produced no file. It was caught
only because the running-notes row cites those artifacts by name and the directory was listed while
writing it. Both runs were repeated after `mkdir` and reproduced **8 of 961** and **7 of 961**
identically, so nothing is lost — but a figure quoted off a run whose artifact was never written is
exactly the shape this repository keeps paying for.

**2. `tests/test-docs-current.js` CLAUSE 3b(b) WENT RED, AND THE CHECK IS RIGHT — IT HAD BEEN
WRONG-GREEN.** Four living-document citations of `934` (`state.games_board_never_diverged` as 5.264.0
published it, board-material 27 of 961 on release `d9e551ed0d5a`) newly failed "a figure attributed to
an artifact is IN that artifact".

**They did not become wrong today; they stopped matching by accident.** Five long-tail batches have
superseded 27/934 and none folded the documents in — that is the deferral `docs/RUNNING-NOTES.md`
exists to carry. The clause stayed green because every re-run of `data/game-differential.json`
happened to contain `934` somewhere ELSE — `state.agreement_by_turn[4].reached` — so the citation
check was matching a different quantity that had the same value. The void-game filter takes three
games out of the state population, that incidental 934 became 931, and the coincidence ended.

Ratcheted in `data/docs-currency-baseline.json` (`known.citation_mismatches` 56 -> 60) with the reason
written into `reasons` under `docs/*|934|data/game-differential.json`, on the precedent of the
2026-08-13 entry beside it, which is the identical case in the identical words. **It retires itself
the moment the white paper, `docs/SUMMARY.md` and `docs/ABRA-technical-docs.md` are folded in**, which
is a documentation pass and not ENGINE's to do mid-batch. Doc gate: **33 passed, 0 failed.**

---

## WHAT WAS RUN, AND WITH WHAT

- `tests/probe_state_void_exclusion.js` — RED/GREEN pair, re-run on the final tree at release
  `c28ad0815782`: RED `6 of 961`, GREEN `3 of 958`, all thirteen claims held.
- `tests/probe_arrival_reprice.js` and `--red` — five arms, all claims held both ways.
- `tests/probe_fracpri_die_order.js` and `--red` — five arms, all claims held both ways.
- `tests/test-mechanics.js` — **830 live, 0 missing, 830 probed.**
- `tests/test-engine-diff.js --n 6000 --write --release c28ad0815782` — **0 disagreed of 6000.**
- `engine/all_mechanics_fire.js --kind all --write --release c28ad0815782` — 1313 games, 0 threw.
- `tests/roster.js --stage {items,abilities,moves} --write` — **140 / 129 / 475**, 0 DIFFER,
  0 DID-NOT-FIRE.
- `tests/test-docs-current.js` — 33 passed, 0 failed.
- `engine/status.js` — **7 pass / 2 fail**, the same two clauses as at the batch start.

Predictions: `data/verification/_prediction-2026-09-07-batchM-{void-clause,arrival-reprice,fracpri-order}.json`.
Back-cast arms: `data/verification/batchM/gd-oldruler-{3f9830acc467,830350135192}.json`.
