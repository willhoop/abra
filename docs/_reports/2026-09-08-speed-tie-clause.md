# ROADMAP #376 — the three Protect/Detect orderings are NOT the tie device

ENGINE, 2026-09-08. Full account. The verdict is four lines at the top; everything under it is the
evidence and the caveats.

---

## VERDICT

- **The discriminator reads 100.0% — 112 of 112.** Two bodies at an identical authority
  `getActionSpeed()`, both clicking Protect, over every base-Speed group in the regulation that has
  two Protect carriers, staged three geometries deep. Zero turn-order disagreements. By the row's own
  branch table, that is *"these three are something else entirely"*.
- **The coordinator's hypothesis — "we pinned one side's die and left the other rolling" — is
  REFUTED at the line.** `engine/game_differential.js:1842` already hands medicham2 `o.tie = () => 0`
  in the middle arm, the mirror of `pinShuffle`'s no-op. Both devices have been pinned since #290.
- **Nothing was fixed, because nothing in the tie device is broken.** No engine file was edited. The
  live player is untouched, so the branch behaviour cannot have leaked.
- **The three #376 causes are ABSENT from the current pinned run**, and the instrument #376 names is
  red for a completely different pair. That is the live finding and it is written up in §5.

---

## 1. The sample, stated so it can be reproduced

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node tests/probe_protect_tie_order.js --n 400 --release 1415f271058e
```

| pin | value |
|---|---|
| engine release | `1415f271058e` (cut 2026-09-08T16:10:12Z) |
| arm | `middle` (primary), `sdShuffleReverses: false` — Showdown's shuffle is a no-op |
| arrangements | 112 (the exhaustive set; `--n 400` does not truncate) |
| turns scripted | 2 |
| team source | **constructed, not drawn from a pool.** No `--team-store`, no `--games`, no census steering — this is a lab probe, not a pool run. |

The fixture pool is derived at run time from `Dex.forFormat('gen9championsvgc2026regmb')` filtered
`exists && !isNonstandard && tier !== 'Illegal'`, then `!requiredItem` (a mega forme is not a sheet
entry), then `!battleOnly`, then `TeamValidator#checkCanLearn(protect)`. No species is typed.

## 2. The result

```
  112 AGREE, 0 DISAGREE on turn order, out of 112 scored
  0 fixture, 0 threw, 0 diverged for a DIFFERENT reason
  AGREEMENT = 100.0%   (112/112)

  CONTROL — medicham2's `tie` stream on a ramp instead of the arm's constant:
    2 AGREE, 110 DISAGREE out of 112 scored
    THE KNOB REACHED THE RULE
```

**The control is the load-bearing half.** A green sweep proves nothing on its own — this is a harness
where `pinShuffle` is a no-op, so an arrangement that could never disagree reads exactly like an
alignment that is right. The knob turned is the tie die itself, and it is turned in the only
direction that can move a tie: a **ramp**, not a different constant. A different constant is no
control at all — every action gets the same key either way, the comparator returns 0, the group keeps
its order and the run comes back byte-identical, which is indistinguishable from a knob that was
never wired.

Under the ramp, 110 of 112 arrangements produce **exactly #376's cause shape**:

```
  showdown |move|p2a: Aromatisse|Protect|p2a: Aromatisse
  medicham |move|p1a: Musharna|protect|p1a: Musharna     [ordering]

  showdown |move|p1a: Slowbro|Protect|p1a: Slowbro
  medicham |move|p1b: Ariados|protect|p1b: Ariados       [ordering]  (same side — #376's second pair)

  showdown |move|p1a: Stunfisk|Protect|p1a: Stunfisk
  medicham |move|p2b: Araquanid|protect|p2b: Araquanid   [ordering]
```

So the instrument **can** manufacture #376's three causes on demand, and with the shipped tie rule it
manufactures none of them.

## 3. Why "N seeds" became N arrangements, and why that is not a loosening

The row says *"across N seeds"*. Under this harness a seed cannot move the answer, and saying so is
the whole point: `pinShuffle` (`game_differential.js:1735`) is a no-op in every shipped arm and
`o.tie = () => 0` (`:1842`) is a constant, so re-running one arrangement under a thousand seeds
re-runs one deterministic comparison a thousand times. The variable that can move the verdict is the
SHAPE of the tied group, so that is what the probe varies:

| geometry | what it refuses |
|---|---|
| `cross-r0` — p1a vs p2a, identical base Speed | nothing on its own |
| `same-side` — p1a vs p1b, rungs 32 and 22 | a rule phrased about SIDES ("take the later side") |
| `cross-r1` — p1a vs p2b, rungs 32 and 22 | a rule phrased about SLOT INDEX |

Every tie is **verified, never intended**: `playGame({ speedCensus: true })` records
`q.getActionSpeed()` for every body at `when === 0` — before a single choice, i.e. the queue turn 1 is
built from — and an arrangement whose two named bodies do not come back EQUAL is filed as FIXTURE and
kept out of the rate entirely. It read 0 fixtures on the final run.

## 4. JOB 2 — the Garchomp caveat

The row's caution: the second pair's authority line is `|move|p1b: Garchomp|Protect||[still]`, so
*"that Protect FAILED on the authority and may be #371(a)'s mechanism wearing an ordering class — at
most 2 of the 3 are tie-only."*

**What `[still]` is, read at the line.** `Battle#attrLastMove` (`sim/battle.ts:3128`) blanks the
target field of the last `|move|` line and appends `|[still]` when no animation plays. For Protect
the route to it is Protect's own gate in `data/moves.ts` (Champions overrides only `pp: 5`):

```js
onPrepareHit(pokemon) {
  return !!this.queue.willAct() && this.runEvent('StallMove', pokemon);
}
```

So a Protect fails **two** ways, and both print the same line:

1. `queue.willAct()` is false — the Protect is the **LAST action in the queue**. Whether it is last is
   decided by the very tie under test, so this half is *downstream of* ordering, not a rival to it.
2. `StallMove` — the **consecutive-use counter**, which is independent of ordering.

**Both are exercised by this probe and both agree.** Every arrangement has all four actives clicking
Protect for two turns, so one Protect must fail on the `willAct` gate each turn and the stall counter
gets a second turn to refuse one:

```
  112 of 112 arrangements produced a FAILED Protect;  112 of them on TURN 2,
  where the consecutive-use StallMove counter is the only thing that can refuse it.
```

**What cannot be settled, stated plainly.** The specific Garchomp game is not re-measurable: that
cause is not in `data/game-differential.json` any more (§5), and the 2026-08-23 run it came from was
a different release, a different census and therefore a different sample. So "at most 2 of the 3 are
tie-only" is neither confirmed nor refuted for that individual row. What IS settled is that the
mechanism the caveat names — a Protect refused by its own gate, alongside a tie — is measured
agreeing 112 times out of 112.

## 5. THE LIVE FINDING — #376's instrument is red, and not for #376's reason

`data/register-reality.json` marks #376 `VERDICT-RED`, `cmd: node engine/quarantine.js --order-probe`,
`exit 1`, so this row is one of the ones holding the *"no open, known engine defect"* clause shut.
Running that instrument today:

```
FAIL  turn order / no unequal-speed pair at identical priority (ROADMAP #290)
  1 of 1 PROBED ORDERING PAIR(S) ARE A REAL TURN-ORDER DISAGREEMENT
    gap 286  ordering :: |move|p2a|closecombat <> |move|p2b|tailwind
             [showdown moved Sneasler @664, medicham2 moved Aerodactyl @378]
  artifact: data/game-differential.json  generated 2026-09-08T16:15:01.893Z  release 1415f271058e
```

**None of #376's three causes is in the artifact.** Walked over `classes[].causes[]` rather than read
off a headline: 6 classes whose games sum to the artifact's `diverged: 57`, 14 causes in the
`ordering` class, and **not one of the 14 is a `protect` or `detect` pair**. The row's own sample is
gone.

The pair that IS red is an **unequal-speed** disagreement — 286 points apart, same priority — which is
#290's clause, not #376's. The card:

```
turn 2, cause: ordering :: |move|p2a|closecombat <> |move|p2b|tailwind
showdown  |move|p2a: Sneasler|Close Combat|p1a: Rotom
medicham  |move|p2b: Aerodactyl|tailwind|p2b: Aerodactyl
showdown_before:
  |move|p1a: Incineroar|Parting Shot|p2a: Sneasler
  |-unboost|p2a: Sneasler|atk|1
  |-unboost|p2a: Sneasler|spa|1
  |switch|p1a: Rotom|Rotom-Mow, L50|125/125|[from] Parting Shot
  |-enditem|p2a: Sneasler|White Herb
  |-clearnegativeboost|p2a: Sneasler|[silent]
```

Read from the format rather than recalled: Sneasler is base 120 Speed with **Unburden** in slot 1;
Aerodactyl is base 130. Under the harness ladder the two sit at 166 and 189 respectively, so
Aerodactyl is faster *until* Sneasler's White Herb is consumed and Unburden doubles it to 332. The
boundary readings (664 and 378) are both doubled again by the Tailwind that went up in the same turn.
So the authority's order is Unburden's; medicham2's is the pre-Unburden order.

**Three candidate explanations were staged and all three were ELIMINATED**, each with a control that
moved the order:

| staged | result |
|---|---|
| Unburden triggered at switch-in (Incineroar's Intimidate drops Atk → White Herb → Unburden), then a turn-order test against Aerodactyl | authority 324 vs 182; **both engines put Sneasler first**; control with no herb reads 162 vs 182 and **both engines flip**; `div: NONE` |
| Unburden triggered MID-TURN by a Close Combat self-drop, order tested on the FOLLOWING turn | authority 324 vs 182 at `when=2`; **medicham2 orders Sneasler first**; control with no herb orders Aerodactyl first; `div: NONE` |
| the speed-tie device | 112/112, §2 |

So it is **not** the tie, **not** Unburden at entry, and **not** Unburden consumed mid-turn. What is
left unstaged and is the obvious next suspect is the combination in the card: the herb is consumed
**after a pivot switch has already resolved inside the turn** (`Parting Shot` → `|switch| … [from]
Parting Shot` → `-enditem`), which is the one arrangement where Showdown's mid-turn re-sort and our
`_updateAll`-before-each-action can disagree about when the doubling exists.

**This is one game of 961 and it writes no board** — board-material is 0 of 958 either side of tonight
(§7). It is a NARRATION-class row that happens to be the thing keeping #376's instrument red.

## 6. What was NOT done, and why

- **No engine edit.** Job 3 was conditional on Job 1 and Job 1 said 100%. `engine/medicham2-browser.js`
  carries no change of mine.
- **The live branch behaviour is intact by construction**, not by inspection: nothing in the player
  path was touched. `tests/test-speed-tie.js` independently re-confirms it on this tree — *"UNDER REAL
  DICE the tie goes to the SECOND action 211/400 times (52.8%)"* — so the engine's tie is still a coin
  and the pinned constant lives only in the differential arm. The separate question Will raised, that
  MILTANK should explore BOTH branches of a tie rather than sample one, is recorded in
  `docs/MODELS.md` under MILTANK by commit `f79d29cd` and is untouched here.
- **`data/mechanics-census.json` was not regenerated.** No mechanic changed, and regenerating it
  rewrites the artifact that steers every differential run — see §8.
- **The differential was not re-run.** Nothing that could move it changed, and see §8.
- **#376's register row was not edited.** Its story has been withdrawn once already; the honest state
  is that the tie explanation is now measured false AND the instrument it names is red for a pair the
  row does not describe. That is a re-scope, and it should be written by whoever also decides what to
  do with the Sneasler card.

## 7. The gate, before and after

| clause | before | after |
|---|---|---|
| board-material | 0 of 958 | **0 of 958, unchanged** — `data/game-differential.json`, release `1415f271058e`, generated 2026-09-08T16:15:01.893Z, mtime unmoved |
| narration | the artifact reads `state.protocol_diverged_games: 54` and `diverged: 57`; the brief quotes the clause at 53 and that subtraction was NOT re-derived here | unchanged — nothing that feeds it moved |
| census | 830 probed / 830 live | unchanged |
| no open, known engine defect | RED | **still RED.** #376 is still open and its instrument still exits 1 — on the Sneasler pair, not on a tie. |

## 8. A CONCURRENCY WARNING, AND IT IS THE MOST IMPORTANT PARAGRAPH HERE

The brief stated *"tree clean and pushed at `61b7d426`, no other agent running."* **That stopped being
true during this session.**

- `HEAD` is `f79d29cd` (2026-09-08 14:06 local), committed **after** the brief was written.
- `engine/medicham2-browser.js` — the file this division owns — has **18 uncommitted lines** stamped
  `BATCH O, 2026-09-08` (`arrivalRepriceDriftsAtArrivalZeroSamples`), last written **14:42 local**,
  mid-session. They are not mine.
- Because the tree moved, `game_differential.js` auto-cut a **new release `68531bfd1959` at 18:50 UTC**
  under one of my runs, and `data/engine-release.json` now points at it.

Every published figure in this report is pinned to `--release 1415f271058e` and re-ran identically
after the drift, so nothing here is contaminated. But CLAUDE.md's rule — *a measurement is a
photograph and nothing in frame may move* — was being broken, by another agent, on this division's own
file. **That is why the census and the differential were deliberately not regenerated tonight.**

Nothing was deleted and nothing of the other agent's was touched.
