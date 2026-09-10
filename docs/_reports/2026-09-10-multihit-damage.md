# The damage differential runs the authority's volley loop — 2026-09-10

**Verdict.** `data/engine-diff.json` read `0 of 6000` with `skipped_multihit: 134` and
`skipped_ability_multihit: 17` beside it. It now reads **`0 of 6000` with both skips at ZERO and
142 of those 6,000 rows run as VOLLEYS** — 130 multi-hit-move rows and 12 Parental Bond rows, each
through `hitStepMoveHitLoop`, the authority's own hit loop. **Zero disagreements at the midpoint, at
both corners and at all fourteen interior indices.** One engine defect was found on the way and is
fixed. Two skips remain, named: Dragon Darts (1 row — the authority's own loop throws at a 1v1 entry
point) and four rows the authority refused before their first arrival (Sucker Punch x3, Last Resort
x1).

---

## 1. The pins, the flags, and what was measured against what

| | BEFORE | AFTER |
|---|---|---|
| artifact | `data/engine-diff.json` | `data/engine-diff.json` |
| generated | `2026-09-10T09:53:03.560Z` | `2026-09-10T17:54:22.737Z` |
| engine release | `cbd510bc2b13` | **`3c2b2f9ac845`** (cut this pass, 27 files, 0 moved since) |
| Showdown commit | `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4` | same |
| flags | `--n 6000 --seed 20260804` | `--n 6000 --seed 20260804` |
| census | `2026-09-10T09:11:48.830Z`, sha256-12 `257acf955593` | regenerated **`2026-09-10T17:36:49.524Z`, sha256-12 `599026a516d9`** |

`tests/test-engine-diff.js` has **no `--write` flag**; publishing is the default path through
`engine/publish_guard.js`, and `--out <path under data/verification/>` is how a run is kept off the
published artifact. The brief's command carried `--write`; it is inert and was dropped.

**The census moved.** `tests/test-mechanics.js` was re-run because an engine byte moved. It came back
**835 probed / 835 live / 0 missing**, identical to the pin, and the whole diff is the `generated`
stamp plus one Monte-Carlo detail string (Iron Head 19.6% → 19.1% over 6,000 turns). The pin
`257acf955593` no longer resolves; `599026a516d9` is the same census.

## 2. The prediction, written before any code moved

`data/verification/_prediction-2026-09-10-multihit.json`.

- Newly comparable rows: **151** predicted (134 + 17). **Measured: 142** compared + 5 still skipped =
  147. The shortfall is the four Sucker Punch / Last Resort rows and one Dragon Darts row, which the
  old counters had filed under the two skips and which are now separated out by their real reason.
- Disagreements: **15 predicted, range 5–40. Measured: 0.**
- The prediction named five mechanisms in rank order. **Two of the five were real and both were the
  HARNESS, not the engine** — see §4. The three it expected to be clean (flat-road arithmetic, the
  bond quarter, per-hit escalation) were clean.
- It predicted `bonerush`, `doublehit` and `tailslap` would **still not be drawn** and that this is a
  fact about the metagame rather than a hole. That held; §6.

## 3. The wire — VOLLEY FIX 17

The reference used to enter at `battle.actions.moveHit` (`sim/battle-actions.ts:1370`), and one
`moveHit` call is **one arrival**. It now enters one level up at `hitStepMoveHitLoop` for a volley row
only — **Champions OVERRIDES that method at `data/mods/champions/scripts.ts:428`** (mainline is
`sim/battle-actions.ts:857`); reading the mainline file here is the mistake CLAUDE.md records, and it
is what the Dragon Darts row in §5 was first diagnosed against.

That entry point is step 7 of `trySpreadMoveHit`'s eight — **above `moveHit`, below
`hitStepAccuracy`** — so the harness gains the volley and gains no accuracy roll, which keeps its
declared scope. The three lines before the loop are the authority's own
(`sim/battle-actions.ts:590-592`: `singleEvent('Try')`, `singleEvent('PrepareHit')`,
`runEvent('PrepareHit')`); the third is where Parental Bond writes `move.multihit = 2`.

**Every single-hit row still enters at `moveHit` and is byte-identical.** That is what keeps a new red
row attributable to the volley rather than to a changed entry point.

### The arrival count is READ BACK, never computed

`hitStepMoveHitLoop` samples the 2–5 family with `battle.sample`, which goes **straight to
`this.prng`** (`sim/battle.ts:355`) and cannot be reached by this file's `battle.random` override. A
count computed in the harness would be a guess wearing a control's clothes — the King's Rock lesson in
the damage half. So `spreadMoveHit` is wrapped for the duration of the call and every invocation is
one arrival; the authority's own `|-hitcount|` (`data/mods/champions/scripts.ts:550`) is read out of
`battle.log` and cross-checked. **`hitcount_mismatch` reads 0.**

**That cross-check earned its keep immediately.** The first counter read **four** arrivals for a
Parental Bond Fake Out. `secondaries()` (`sim/battle-actions.ts:1336`) and `selfDrops()` (`:1317`)
both re-enter through `moveHit` → `spreadMoveHit` carrying `isSecondary` / `isSelf`, so a move with a
secondary counted twice per arrival — and **Scale Shot would have handed MEDICHAM ten hits instead of
five.** Guarded on the authority's own two flags.

### Asked per index, because the count can legitimately differ per index

The top roll can kill the target on arrival 3 of 5 and the loop breaks on
`targets.every(target => !target?.hp)`. So all sixteen reference calls carry their own arrival count
and MEDICHAM is asked for **that** count at **that** index (`hit.hits`, the same field its battle loop
hands in). **16 rows of 6,000 had a count that varied across the sixteen indices** — first
`heracrossmega pinmissile -> rotomwash`, 4–5.

**A bond row is handed NO count.** `hitPlanOf`'s `bondMultFor` refuses the quarter-power second packet
when `rolled > 1` — that clause is the authority's own `move.multihit` early return — so `hits: 2`
would have priced two FULL packets.

### Shown red first

- **`--plant volley`** asks MEDICHAM for ONE arrival of every volley, which is precisely the engine
  the old skip assumed it was looking at. At `--n 250`: midpoint `6` disagreements (all six volley
  rows), top `5`, bottom `6`, interior `83` across the fourteen indices, and the 244 single-hit rows
  unmoved. It writes to `data/engine-diff-PLANTED-volley.json` and never touches the gate's artifact.
- **`MEDI_MULTIHIT_ONE_INDEX=1` was tried FIRST and moved nothing** — 0 disagreements at `--n 250`.
  That flag restores the BATTLE LOOP's shared-index packet split, which `dmgRange` does not go
  through. An arm with no plant that can move it is an arm nobody has checked, which is why
  `--plant volley` exists rather than being assumed unnecessary.
- **`MEDI_DIFF_MULTIHIT=skip`** restores the old skip. At `--n 250` it reports
  `skipped_multihit 5 (pinmissile, bulletseed, rockblast, tripleaxel, dualwingbeat)` and
  `skipped_ability_multihit 1 (parentalbond)`, prints
  `*** MEDI_DIFF_MULTIHIT=skip IS ON — the old skip is back ***`, and stamps
  `volley.skip_restored: true` into the artifact.

## 4. The two controls the volley needed, and why neither is the engine being let off

The prediction's top-ranked mechanism was real. Measured with the knob cleared each time, **before**
either control was written:

| row | before | after | knob-cleared control |
|---|---|---|---|
| `heracross rockblast -> mimikyu` (Disguise) | showdown `100-116`, medicham `84-100`, rel 14.8% | `84-100` / `84-100`, 0.0% | `-> aggron` (Sturdy) read 0.0% throughout |
| `toucannon dualwingbeat -> mimikyu` | `59-68` / `43-52`, 25.2% | `43-52` / `43-52`, 0.0% | same |
| `heracross pinmissile -> archaludon` (Stamina) | `17-21` / `20-24`, 15.8% | `20-24` / `20-24`, 0.0% | same |
| `maushold populationbomb -> archaludon` | `19-25` / `36-42`, **77.3%** | `36-42` / `36-42`, 0.0% | same |
| `toucannon dualwingbeat -> polteageist` (Weak Armor) | `127-137` / `102-122`, 15.2% | `102-122` / `102-122`, 0.0% | same |

**CONTROL FIX 18 — the board may not move under a price.** `dmgRange` is a PURE price: one board in,
one number out, no arrival state. The authority's loop HAS arrival state — it raises
`eachEvent('Update')` and the whole `onDamagingHit` chain between arrivals — so arrival 2 lands on a
body arrival 1 already changed. The reference's boosts and `storedStats` are re-cleared between
arrivals, exactly as CONTROL FIX 7 clears the switch-in before the click. HP is deliberately NOT put
back, or the arrivals already landed would be undone and the loop's faint break could never fire.

**This was checked against the engine BEFORE the control was written, not after.**
`tests/probe_arrival_reprice.js` stages Stamina, Weak Armor and a resist berry through MEDICHAM's
**battle loop** with a red knob (`MEDI_ARRIVAL_PRICE_ONCE=1`) and a single-hit control arm:
`arrivalRepriceOffered 4`, `arrivalRepriceRan 4`, `arrivalRepriceMoved 3` — moved on exactly the three
arms that change something between arrivals and not on the one that does not. **The loop already
re-prices arrival k against the board arrival k-1 left behind. The loop is right and the price is a
price.**

**CONTROL FIX 19 — the move's damage, not the target's HP delta.** `moveHit` raises no `Update`, so on
the single-hit path the two quantities are the same number. `hitStepMoveHitLoop` raises
`eachEvent('Update')` after every arrival (`data/mods/champions/scripts.ts:538`), which is where
Disguise deals its `baseMaxhp / 8` (`data/abilities.ts:996`) — the ABILITY's damage, not the move's.
The gap on the Mimikyu rows is **exactly 16 at both corners**, and Mimikyu's 131 maxhp / 8 = 16. The
compared quantity is now `move.totalDamage`, the authority's own per-arrival accumulator.

**Both controls read ZERO on the published 6,000-row run and are therefore UNTESTED BY IT.** That is
printed on every run and written into the artifact (`mid_volley_board_held: 0`,
`ability_hp_rows: 0`). Their evidence is the five `--case` rows above; no Mimikyu, Archaludon or
Polteageist was drawn as a defender on a volley row in this sample.

## 5. The engine defect this found — the first click of a process had no move identity

Found while checking the wire with `--case`, which is the mode every fix in this file gets checked in.

```
kangaskhanmega fakeout -> pinsir    run alone:              medicham 44-45
                                    with any row before it: medicham 44-55
```

**Order-dependent output from a pure pricing function.** Reduced outside the harness entirely — plain
`require` plus four `dmgRange` calls on the same bodies and the same field:

```
fakeout x4: 37-45   44-55   44-55   44-55        parentalBondPlanned 0 after call 1, 1 after call 2
fakeout x3 with att.ability = 'none': 37-45  37-45  37-45      <- the control
```

**The first call priced a Kangaskhan-Mega with no Parental Bond.** `stampMoveIds()` writes the table's
own key onto each `MC.moves` row and is lazy (in the browser this module can load before `window.MC`
does). It was called from `dmgRangeOneHit`, `printedAccuracy` and `effMoveType` — and `dmgRange` calls
`hitPlanOf` **before** it reaches any of them. `hitPlanOf` is keyed on `mv.id` at every clause it has:
`variablePower` (Beat Up), `bondMultFor` (Parental Bond), `expectedHitsOf` and `hitWeightsOf` (the
multi-hit family). Traced with a property setter:

```
SET id= fakeout
    at stampMoveIds (engine/medicham2-browser.js:10623)
    at dmgRangeOneHit (engine/medicham2-browser.js:12613)
    at Object.dmgRange (engine/medicham2-browser.js:14583)
```

**FIXED**: `dmgRange` pre-stamps. **`MEDI_NO_MOVEID_PRESTAMP=1` restores the defect** and stamps
`MEDFAILS.moveIdPrestampRestored = 1`, same shape as `MEDI_MULTIHIT_ONE_INDEX` and
`MEDI_DAMAGE_SPAN_DRAW`. Red-then-green, one command:

```
--- env=''                          fakeout x3: 44-55  44-55  44-55   moveIdPrestampRestored= 0
--- MEDI_NO_MOVEID_PRESTAMP=1       fakeout x3: 37-45  44-55  44-55   moveIdPrestampRestored= 1
```

**Blast radius, stated honestly.** One row per process inside a 6,000-row differential; everything
inside `--case` and inside every one-shot probe in `tests/`. **It did not move the whole-game
differential** — that artifact read `protocol_diverged_games: 1` on release `cbd510bc2b13` and reads
`1` on `3c2b2f9ac845`, board-material 0 of 961 both times.

## 6. What is still skipped, named

**`skipped_multihit: 0` and `skipped_ability_multihit: 0`.** The remainder is smaller and it is
carried under its own names in `data/engine-diff.json` → `volley`:

- **`unstageable: {"dragondarts": 1}`.** The AUTHORITY'S OWN loop throws:
  `Cannot read properties of undefined (reading 'hp')`. `move.smartTarget` is `true` in the dex and
  the three sites that clear it (`sim/battle-actions.ts:607`, `:634`, `:740`) **all fire on a
  FAILURE**, so a click that succeeds keeps it. With ONE target the Champions loop pushes a second
  entry into `moveDamage` (`data/mods/champions/scripts.ts:521`) and writes `damage[1]`, and the
  EmergencyExit sweep below reads `targets[1].hp` on a one-element `targets`. **NOT patched here** —
  forcing `move.smartTarget = false` would be this file editing the authority to get an answer out of
  it, which a differential may never do. **ROADMAP #574.**
- **`no_arrival: 4` — `suckerpunch x3`, `lastresort x1`.** The authority refused the click at
  `singleEvent('Try')`, before any arrival. Sucker Punch's `onTry` fails unless the target is about to
  use a damaging move and **nobody is attacking in a one-click damage harness**; Last Resort's fails
  until every other slot has been used. Scoring these would put a real MEDICHAM price against a zero
  the authority produced for a reason `dmgRange` does not model — a SUSPECT phantom zero, which this
  file already refuses to call an engine bug. These four rows were previously inside
  `skipped_ability_multihit` under the wrong name.
- **`bonerush`, `doublehit`, `tailslap` are still not drawn, and that is not a hole to close.** They
  have **zero owners in `data/move-priors.json`** — nobody in this corpus clicks them — and the
  sampler draws attackers and moves from real usage on purpose. They are legal and learnable in the
  pool (`bonerush`: 1 learner, lucario; `doublehit`: 23; `tailslap`: 6) and were exercised by name
  instead. **All fourteen `multiHit` moves, one learner each, all AGREE:**

```
lucario       bonerush       -> garchomp   showdown x5  90-110   medicham  90-110   0.0%  AGREE
venusaur      bulletseed     -> garchomp   showdown x5   60-75   medicham   60-75   0.0%  AGREE
sneasler      doublehit      -> garchomp   showdown x2   52-62   medicham   52-62   0.0%  AGREE
dragapult     dragondarts    -> garchomp   UNSTAGEABLE — the authority's own hit loop threw
pelipper      dualwingbeat   -> garchomp   showdown x2   26-32   medicham   26-32   0.0%  AGREE
ninetalesalola iciclespear   -> garchomp   showdown x5-4 183-183 medicham 183-183   0.0%  AGREE
toxapex       pinmissile     -> garchomp   showdown x5   35-45   medicham   35-45   0.0%  AGREE
maushold      populationbomb -> garchomp   showdown x6  96-114   medicham  96-114   0.0%  AGREE
aerodactyl    rockblast      -> garchomp   showdown x5   55-65   medicham   55-65   0.0%  AGREE
basculegion   scaleshot      -> garchomp   showdown x5 160-183   medicham 160-183   0.0%  AGREE
meowstic      tailslap       -> garchomp   showdown x5   50-60   medicham   50-60   0.0%  AGREE
milotic       tripleaxel     -> garchomp   showdown x3 124-152   medicham 124-152   0.0%  AGREE
farigiraf     twinbeam       -> garchomp   showdown x2   80-96   medicham   80-96   0.0%  AGREE
greninja      watershuriken  -> garchomp   showdown x5   75-90   medicham   75-90   0.0%  AGREE
```

## 7. What the volley run actually ran

```
multi-hit MOVE rows compared        130
Parental Bond (ability) rows         12
arrival counts landed   x1:7  x2:66  x3:20  x4:7  x5:36  x6:6
by move   dualwingbeat x47  rockblast x24  pinmissile x13  tripleaxel x13  bulletseed x10
          populationbomb x7  twinbeam x5  iciclespear x5  fakeout x4  drainpunch x4
          doubleedge x3  watershuriken x3  scaleshot x2  icepunch x1  dragondarts x1
`-hitcount` vs counted spreadMoveHit calls   0 mismatches
band_missing 0
```

Twelve Parental Bond rows across six moves (`fakeout`, `drainpunch`, `doubleedge`, `icepunch`, and the
four refused Sucker Punch / Last Resort rows). Parental Bond had left this file's surface entirely on
2026-08-23 with `tests/test-mechanics.js` named as the only remaining guard; it is back.

## 8. The full chain, re-run on release `3c2b2f9ac845`

| instrument | result |
|---|---|
| `tests/test-mechanics.js` (census) | **835 probed / 835 live / 0 missing** — unmoved |
| `tests/test-engine-diff.js --n 6000 --seed 20260804` | **0 of 6000**, all 16 arms 0, skips 0 / 0 |
| `tests/roster.js --stage items --reds --write` | 0 DIFFER, 0 DID-NOT-FIRE, 142 of 148 tested |
| `tests/roster.js --stage abilities --reds --write` | 0 DIFFER, 0 DID-NOT-FIRE, 139 of 201 tested |
| `tests/roster.js --stage moves --reds --write` | 0 DIFFER, 0 DID-NOT-FIRE, 487 of 498 tested |
| `engine/all_mechanics_fire.js --kind all --write --release 3c2b2f9ac845` | 1313 games, 0 threw |
| `engine/game_differential.js` (flags below) | **BOARD-MATERIAL 0 of 961**, 10,705/10,705 boundaries identical, 1 protocol divergence (declared), 0 cut off at cap 50 |
| `engine/quarantine.js` | **GATE: OPEN — nothing withheld.** Every clause PASS |

The whole-game flags in full:
`--steering empirical --release 3c2b2f9ac845 --arm middle --end-state --census data/mechanics-census.json --games 1200 --team-store data/team-pool-frozen --turns 50 --write`
→ 961 games played (pool-limited from the 1,200 asked).

**Nothing in the whole-game differential moved**, and that was checked against
`git show HEAD:data/game-differential.json` rather than against a remembered figure: both artifacts
carry `protocol_diverged_games: 1`, `protocol_diverged_board_never_did: 1`,
`games_board_never_diverged: 961`.

## 9. The one thing this pass leaves BROKEN and does not own

**`engine/status.js` now prints a false sentence about this artifact, and `--write` stamps it into
`docs/ENGINE.md`.** The block at `engine/status.js:476-493` is unconditional, so with
`skipped_multihit` at 0 it reads:

> *"the skip is a FAMILY, not a rounding error: 14 of 500 legal moves carry the multiHit tag and are
> skipped by construction, so the volley loop has never been damage-compared. 0 were drawn and
> skipped; 14 were never drawn at all (bonerush, bulletseed, doublehit, dragondarts, dualwingbeat,
> iciclespear, pinmissile, populationbomb, rockblast, scaleshot, tailslap, tripleaxel, twinbeam,
> watershuriken)."*

Every clause of that is now wrong: the family is compared, 130 rows were drawn and RUN, and three
moves are undrawn, not fourteen. `engine/coverage.js:647-652` derives the same sentence and the
COVERAGE row *"moves the damage diff can compare 486 of 500"*. **Both files are MEASURE's**, so this
is FILED and not fixed — `docs/DIVISIONS.md`: *if you trip over another division's bug, you file it*.
**ROADMAP #575.** The fix is one condition and one field: gate the block on `skipped_multihit > 0`
and read `volley.moves` / `volley.multihit_moves_not_drawn`, both of which the artifact now carries.

---

## OWED, NOT RUN

```bash
# 1. MEASURE owns this: engine/status.js and engine/coverage.js print "the volley loop has never
#    been damage-compared" unconditionally, so the ENGINE handoff and docs/ENGINE.md's GENERATED
#    block now carry a false sentence. ROADMAP #575. After the fix, re-stamp:
node engine/status.js
node engine/status.js --write
node engine/coverage.js

# 2. CONTROL FIX 18 and CONTROL FIX 19 read ZERO on the published run and are UNTESTED BY IT.
#    They are proved by --case only. A seed that draws a Disguise / Stamina / Weak Armor defender
#    onto a volley row would exercise them inside a published sample:
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node tests/test-engine-diff.js --n 6000 --seed 20260910 \
  --out data/verification/2026-09-11-multihit-seed-sweep.json

# 3. Dragon Darts is the one family still unstageable (ROADMAP #574). It needs a TWO-TARGET
#    reference, which this harness is not; the whole-game differential is where it is exercised.
#    Confirm it is exercised there rather than assumed:
node engine/game_differential.js --steering empirical --release 3c2b2f9ac845 --arm middle \
  --end-state --census data/mechanics-census.json --games 1200 \
  --team-store data/team-pool-frozen --turns 50 --dump-games \
  --out data/verification/2026-09-11-dragondarts-reach.json

# 4. The engine byte that moved (dmgRange pre-stamps move ids) was NOT measured against the
#    downstream leaf/board figures, because those are MEASURE's and are quarantined-by-staleness.
#    The paired arm, if anyone wants the isolation:
MEDI_NO_MOVEID_PRESTAMP=1 node engine/game_differential.js --steering empirical \
  --release 3c2b2f9ac845 --arm middle --end-state --census data/mechanics-census.json \
  --games 1200 --team-store data/team-pool-frozen --turns 50 \
  --out data/verification/2026-09-11-moveid-prestamp-RED.json

# 5. THE PUBLISHER MUST FORCE-ADD THE NEW RELEASE, OR THE EVIDENCE CHAIN ENDS AT A 12-CHARACTER ID
#    ON A FRESH CLONE. `data/releases/` is gitignored; SIX artifacts now stamp `3c2b2f9ac845`
#    (engine-diff, all-mechanics-fire, game-differential and the three roster stages) and
#    `git ls-files data/releases/3c2b2f9ac845` returns 0. This is exactly the 6.0.2 defect, one
#    release later. 6.8 MB, 4 top-level entries. ENGINE does not commit, so this is the
#    coordinator's:
git add -f data/releases/3c2b2f9ac845

# 6. The census pin in the brief (257acf955593) no longer resolves; this pass regenerated it to
#    599026a516d9 with the same 835/835/0. Anything quoting the old pin needs re-pointing:
node -e "const c=require('crypto'),f=require('fs');console.log(c.createHash('sha256').update(f.readFileSync('data/mechanics-census.json')).digest('hex').slice(0,12))"
```
