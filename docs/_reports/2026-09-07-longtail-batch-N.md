# LONG-TAIL BATCH N — THE LAST THREE BOARD-MATERIAL GAMES

**Started** 2026-09-07. ENGINE division, sole agent.

## STATE AT START (read, not typed)

- `data/engine-release.json` -> `current: c28ad0815782`, cut `2026-09-07T19:17:33Z`,
  why `batch M: fractional-priority die order`.
- `data/game-differential.json` -> `state.games 958`, `state.games_board_never_diverged 955`,
  `state.games_void_excluded 3`. **Board-material = 958 - 955 = 3.**
- Census pin `data/verification/census-pin-9446a684709d.json`.

Sample line (identical for every run in this batch except the release and the dump path):

```
node engine/game_differential.js --steering empirical --release <id> --arm middle \
  --end-state --state --census data/verification/census-pin-9446a684709d.json \
  --games 1200 --turns 20 --team-store data/team-pool-frozen \
  --dump-games 60 --dump-out <path> --write
```

`--games 1200` is part of the SAMPLE DEFINITION, not a budget (961 played, 958 readable).

## THE THREE, READ OFF `state.first_board_divergences`

| # | config | seed | board t | protocol t | first board leaf |
|---|---|---|---|---|---|
| 1 | `omit-spread` | `...bo3-2662243229 vs ...bo3-2662159754` | 11 | 11 | `p2.party.kingambit.hp  medi 14 / sd 65` |
| 2 | `pair-protect-bust` | `...bo3-2661266222 vs ...bo3-2661402381` | 6 | 5 | `p1.party.incineroar.hp  medi 127 / sd 119` |
| 3 | `pair-redirect-priority` | `...bo3-2654621676 vs ...bo3-2654695243` | 8 | 6 | `p1.party.excadrill.hp  medi 107 / sd 122` |

## LOG

- Baseline re-run with `--dump-games 60` launched to render fresh cards.

## BASELINE REPRODUCED ON THE CURRENT BYTES

`data/verification/batchN/run-baseline.log`, artifact `data/game-differential.json`,
dump `data/verification/batchN/dump-baseline.json`, cards `data/verification/batchN/cards-baseline.html`.

Read back: `games 958`, `games_board_never_diverged 955`, `games_void_excluded 3` -> **board-material 3**,
`mid_void 73/958` diverged among usable, 76 diverging games total. Same three games, same turns.
The instrument held still (`driver code f360a8681749 over 11 files`).

## GAME 1 — `omit-spread ...bo3-2662243229` t11, LAST RESORT

From the dump (`before_raw` + `after`):

```
|switch|p1a: Kangaskhan|kangaskhan, L50|22/180     <- faint replacement at the end of t10
|turn|11
|move|p2b: Staraptor|protect|p2b: Staraptor
|move|p1a: Kangaskhan|lastresort|p2a: Kingambit
showdown  |-fail|p1a: Kangaskhan                   <- the move is REFUSED
medicham  |-resisted|p2a: Kingambit|1 ; |-damage|p2a: Kingambit|41/175 brn
```

Kingambit then eats Life Orb + burn residuals in both, ending 65 (sd) / 14 (medi). One move.

### THE STANDALONE REPLAY DID NOT FAIL FOR THE REASON IT WAS RECORDED AS FAILING

Batch M's row says *"that game does not reproduce in a standalone pinned replay"*. The first attempt
here reproduced that verdict — and it was the SHELL, not the pool:

```
SEED NOT IN THIS POOL — asked for : "gen9championsvgc2026regmbbo3-2662243229
```

The seed arrived with a leading double-quote and truncated at the first space. Passing the seed as a
literal inside a `.cmd` instead of through `%2` is the fix. **Suspect the instrument before the engine.**

### GAME 1 REPRODUCES STANDALONE, AND THE DEFECT IS A REAL RULE

`data/verification/batchN/replay-g1.txt` — **REPRODUCED, every stored field matches** (132 agreed
lines, the same split line, the same stop reason, the same class). 1082 warm-up games to reach
`omit-spread` pair #102.

Kangaskhan's set, as built for BOTH engines:

```
3. kangaskhan   hp 180  spe 121  silkscarf  scrappy   fakeout, lastresort
```

Two moves. Fake Out was used on **turn 8**. Kangaskhan then **switched out on turn 9** and came back
as a faint replacement at the end of turn 10. On turn 11 it clicks Last Resort.

`onTry` reads `moveSlot.used` (`data/moves.ts:10086`, the only reader of that field in the whole
tree). And `used` is **reset on every switch-in**:

```js
    pokemon.activeTurns = 0;
    pokemon.activeMoveActions = 0;
    for (const moveSlot of pokemon.moveSlots) {
      moveSlot.used = false;
    }                                    sim/battle-actions.ts:137-140, inside switchIn
```

**PP is not reset; `used` is.** Staged in pure Showdown, no ABRA code in the path
(`<scratch>/sd_lastresort.js`), three arms:

| arm | slots before the Last Resort click | Showdown |
|---|---|---|
| Fake Out used, NO switch | `fakeout=USED` | **lands** — `\|move\|...\|Last Resort\|p2a: Kingambit` |
| Fake Out never used | `fakeout=unused` | `\|move\|...\|[still]` + `-fail` |
| Fake Out used, switch out and back | `fakeout=unused`, **pp 11/12** | `\|move\|...\|[still]` + `-fail` |

So `used` is **per stay on the field**, not per battle. This engine reads `ppSpentMap` — PP spent,
which is battle-lifetime — and its own comment asserts the equivalence:

> `used` IS `spent > 0` HERE, AND THAT EQUIVALENCE IS THE FORMAT'S RATHER THAN A CONVENIENCE.

That is false across a switch, and it is the whole defect. Blast radius is exactly Last Resort:
`moveSlot.used` has one reader in `sim/` and `data/` combined.

## GAME 2 — `pair-protect-bust ...bo3-2661266222` t6, A RESIST BERRY CARRIED INTO ARRIVAL 2

`data/verification/batchN/replay-g2.txt` — **REPRODUCED** (77 agreed lines, same split, same stop
reason, same class). Kangaskhan holds `kangaskhanite` -> Mega -> **Parental Bond**; Incineroar holds
a **Chople Berry**.

Turn 6, Drain Punch into the freshly switched-in Incineroar:

```
arrival 1   SE, Chople Berry EATEN + WEAKEN     170 -> 135  (35)   Kangaskhan heals +18 -> 72
arrival 2   SE   showdown                       135 -> 119  (16)   heals +8  -> 80
                 medicham                       135 -> 127  ( 8)   heals +4  -> 76
```

Exactly half. **The berry the first arrival consumed is still halving the second one here.** That is
the same defect batch M closed for a FLAT volley — and batch M's re-price is **refused for a non-flat
one**, which Parental Bond is (arrival 2 is a quarter of the base power). `arrivalRepriceRefusedNonFlat`
is the counter that says so. The board leaf is `p1.party.incineroar.hp medi 127 / sd 119`.

## GAME 3 — `pair-redirect-priority ...bo3-2654621676` t8, A BURN THAT ARRIVES BETWEEN TWO DARTS

`data/verification/batchN/replay-g3.txt` — **REPRODUCED** (87 agreed lines, same split, same stop
reason, same class). p1a is a **Scovillain-Mega (Spicy Spray)**; p2a is a Dragapult with **Dragon
Darts**, which is `smartTarget` — two darts, one into each foe.

Turn 8:

```
showdown  |move| Dragon Darts -> Scovillain
          Scovillain 64 -> 15
          Dragapult is brn  [from] ability: Spicy Spray       <- dart 1's DamagingHit
          Excadrill resists 1
          Excadrill 137 -> 122                                 (15)
medicham  |move| Dragon Darts -> Scovillain
          Excadrill resists 1
          Scovillain 64 -> 15
          Excadrill 137 -> 107                                 (30)
          Dragapult is brn  [from] ability: spicyspray         <- both darts already dealt
```

**Exactly double.** Dragon Darts is Physical and burn halves the attacker's Attack, so the authority's
dart 2 is thrown by a BURNED Dragapult and this engine's is not. The `-fail` on the earlier turn is
narration and is not the cause.

The authority resolves a `smartTarget` volley one target at a time — `hitStepMoveHitLoop` takes
`targetsCopy = [targets[hit - 1]]` and calls `spreadMoveHit` on it, then `eachEvent('Update')`, then
the next hit (`data/mods/champions/scripts.ts:461-537`). This engine's driver is STEP-MAJOR
(`for (const _step of _STEPS) for (const R of _rows)`), which is right for a spread hit and wrong for
this one: dart 2 is priced before dart 1's `DamagingHit` has run.

## FIX 1 — LAST RESORT'S `used` MARKS ARE PER ENTRY.  BOARD-MATERIAL **3 -> 2**

Probe `tests/probe_lastresort_entry.js`, four arms.

RED (`MEDI_LASTRESORT_BATTLE_USED=1`): RED-1 parts on the HP series AND on the board leaf
(`p2.party.corviknight.hp medi 140 / sd 158`); CTRL-A, CTRL-B and CTRL-C all hold; the knob receipt
`MEDFAILS.lastResortBattleUsedRestored = 1`. CLEAN: **every claim held**, and CTRL-A still LANDS —
the arm that refuses a fix which simply banned the move.

Engine: `_usedEntry` written inside `ppDeduct` (the mirror of `deductPP` setting `ppData.used` above
its own PP check), cleared in `bringIn` beside `_mvActs`, cleared again on a transform. **No die is
drawn anywhere**, so the dice addressing does not move and the pin is unaffected.

Release cut: **`a31d271995e3`**, `"batch N: Last Resort's used marks are per entry"`.

Sample line as recorded above, `--games 1200`, `--release a31d271995e3`,
dump `data/verification/batchN/dump-fix1.json`, log `data/verification/batchN/run-fix1.log`.

**Prediction `data/verification/_prediction-2026-09-07-batchN-lastresort.json` — HIT ON EVERY CLAUSE:**

| clause | predicted | measured |
|---|---|---|
| board-material | 2 | **2** |
| the game that leaves | `omit-spread ...2662243229` t11 | that game, and only it |
| games that remain | the two named | exactly those two |
| diverging games total | 75 | **75** |
| `diverged_among_usable` | 72 | **72** |
| `mid_void.void_games` | 3 | **3** |
| a game arrives / transfers | no | none |

`958 games`, `956 never diverged`, `3 void excluded`.

## FIX 2 — THE PER-ARRIVAL RE-PRICE SERVES A NON-FLAT VOLLEY.  BOARD-MATERIAL **2 -> 1**

Batch M's own comment said the refusal out loud, and `MEDFAILS.arrivalRepriceRefusedNonFlat` read
**180 on the pinned pool** with nothing reading it. `dmgRange` gains `onlyHitNo`, which runs its
existing per-hit loop for ONE value of `h` — so Parental Bond's quarter and Triple Axel's escalation
are applied by the code that already owns them. **`hits` is deliberately NOT set to 1 on this road**:
`hitPlanOf` reads it as a rolled count and `hits: 1` would collapse Triple Axel's plan to one arrival.
No new die is drawn — `R.pkIdx[i]` is the index the arrival already spent.

Probe `tests/probe_bond_arrival_reprice.js`, four arms, knob `MEDI_ARRIVAL_REPRICE_FLAT_ONLY=1`
(narrower than `MEDI_ARRIVAL_PRICE_ONCE`, which turns off both roads).

RED: RED-1 (Chople Berry) and RED-2 (Weak Armor) part on the damage series, on the final drained HP
and on the board leaf; CTRL-A (plain body) and CTRL-B (non-mega, one arrival) hold; the knob receipt
reads 1. CLEAN: **all green**, `arrivalRepriceMoved +2`, drift 0, out-of-plan 0.
`tests/probe_arrival_reprice.js` (batch M's) re-run green in BOTH arms.

**Two probe faults caught before they became findings**, both recorded in the file:
the drain reading was VACUOUS at first (a full-HP user heals nothing, and two empty lists are equal),
so the RED arms now open with a wounding turn; and the wounding turn's recoil made a bare
`-damage|p2a` count read 3 for a two-arrival volley, so each series names the `[from]` tag it wants.

Release cut: **`09fde54aa1df`**, `"batch N: the per-arrival re-price serves a non-flat volley"`.
Dump `data/verification/batchN/dump-fix2.json`, log `data/verification/batchN/run-fix2.log`.

**Prediction `data/verification/_prediction-2026-09-07-batchN-bondreprice.json` — HIT ON EVERY CLAUSE:**

| clause | predicted | measured |
|---|---|---|
| board-material | 1 | **1** |
| the game that leaves | `pair-protect-bust ...2661266222` t6 | that game |
| games that remain | `pair-redirect-priority ...2654621676` | exactly that one |
| diverging games total | 75, unchanged (its first protocol split is a `-hitcount`) | **75** |
| `diverged_among_usable` | 72 | **72** |
| `mid_void.void_games` | 3 | **3** |
| **named risk**: the re-price now runs on every non-flat volley in the pool (180 at baseline), so a game could ARRIVE | none should | **none did** |

`958 games`, `957 never diverged`, `3 void excluded`.

### OWED, FOUND BY THIS PROBE AND NOT FIXED HERE

**This engine pays the drain of a multi-arrival volley ONCE at the foot instead of once per arrival.**
`showdown 2 drain lines, medicham 1`, with the same final HP — so it is NARRATION, not board. The
probe prints it on every run rather than asserting it, because a probe that went red for a defect it
was not written about would be a red test filed as a status.

## FIX 3 — A SPLIT `smartTarget` VOLLEY IS RESOLVED ONE BODY AT A TIME

The driver was `for (const _step of _STEPS) for (const R of _rows)`. That is the authority's shape for
a SPREAD hit — `trySpreadMoveHit` really does walk each step over every target — and the wrong shape
for a `smartTarget` one, where `hitStepMoveHitLoop` takes ONE target per iteration and runs the whole
of `spreadMoveHit` on it (`data/mods/champions/scripts.ts:467-518`).

The segment made row-major is `_stepDamage` .. `_stepAfterHitField`, which is exactly `spreadMoveHit`:

- **above it** — `_stepInvuln` .. `_stepClearScreens` are `trySpreadMoveHit`'s first six steps, which
  the authority runs over ALL targets before the loop. They stay step-major.
- **below it** — `_stepUpdate` is deliberately left step-major. Its own header already declares that
  this engine wraps the step list once per MOVE and raises one `eachEvent('Update')` where the
  authority raises one per hit; moving it inside the segment would fire it after body 1 and never
  after body 2, trading a declared and measured gap for an undeclared one. `_stepFaint` onward are
  below the loop in the authority too.

The segment boundaries are looked up in `_STEPS` rather than typed, and a lookup that fails falls back
to the single walk and increments `MEDFAILS.smartTargetSegmentNotFound`.

**The dice do not move in VALUE.** `MID_TGT` is an address, not a position in a stream: the middle arm
keys every draw on (category, address, nth), so re-ordering the visits re-orders the draws and not
their values.

Probe `tests/probe_smarttarget_row_order.js`, four arms, knob `MEDI_SMARTTARGET_STEP_MAJOR=1`.

**Spicy Spray is the knob and it was DERIVED, not chosen by name.** `data/tags.json` holds thirteen
`punishesAttacker` abilities; Spicy Spray's params are `trigger: 'anyHit'` with
`inflicts: [{status:'burn', chance:1}]` — no contact requirement (Dragon Darts has no contact flag)
and no die. Flame Body and Static are contact-only and 30%, so an arm built on either would be a coin
flip wearing a control's name. The one carrier in this regulation is Scovillain-Mega.

RED: RED-1 parts on both bodies' HP and on the board leaf (`p2b` sd 168 / medi 150);
CTRL-A (the same click with the mega removed — the knob cleared explicitly), CTRL-B (Breaking Swipe,
a real spread move) and CTRL-C (the same bodies with the aim reversed, so the burn is raised by the
LAST dart) all hold; `smartTargetRowMajor` reads 0 on every arm and the knob receipt reads 1.
CLEAN: **all green**, `smartTargetRowMajor +3` of four arms, segment lookup never failed.

**A probe fault caught before it became a finding:** the first cut had p2b click Protect, so the
second body was `out` before `_stepDamage`, the volley never SPLIT on either side
(`MEDSEEN.smartTargetSplit` read 0 on every arm) and both engines agreed about a dart that was never
thrown. Both foes now aim at the braced p1b.

Release cut: **`1be57a100d59`**, `"batch N: a split smartTarget volley is resolved one body at a time"`.

Dump `data/verification/batchN/dump-fix3.json`, log `data/verification/batchN/run-fix3.log`.

**Prediction `data/verification/_prediction-2026-09-07-batchN-smarttarget.json` — HIT ON EVERY CLAUSE:**

| clause | predicted | measured |
|---|---|---|
| board-material | 0 | **0** |
| the game that leaves | `pair-redirect-priority ...2654621676` t8 | that game |
| games that remain | none | `state.first_board_divergences` is `[]` |
| diverging games total | 75, unchanged (its first protocol split is at t6) | **75** |
| `diverged_among_usable` | 72 | **72** |
| `mid_void.void_games` | 3 | **3** |
| **named risk**: every split Dragon Darts in the pool takes the new road, so a game could ARRIVE | none should | **none did** |

`958 games`, `958 never diverged`, `3 void excluded`.

---

## WHAT `engine/status.js` SAYS — READ, NOT DECLARED

`data/verification/batchN/status-after-fix3.txt`:

```
PASS  whole-game differential / BOARD-MATERIAL — games whose boards part
      BOARD-MATERIAL: 0 of 958 games. Every compared turn boundary in every game holds the SAME
      BOARD on both engines. This is the quantity Will named on 2026-08-22 — commentary may differ,
      boards may not — and it is met. RAW, AND NOT BY OVERSIGHT: no `DECLARED_DIVERGENCE` row and no
      data/decision-impact.json row can be subtracted from this count.
```

**AND THE QUARANTINE HAS NOT OPENED.** The gate is still **6 of 9 clauses failing**, and the reason
matters because five of the six are not the same kind of thing:

| clause | why it fails |
|---|---|
| `whole-game differential / BOARD-MATERIAL` | **PASS — 0 of 958** |
| `whole-game differential / NARRATION` | **RED on its own merits — 71 of 961** (72 raw less 1 declared). This is the second gate Will called for on 2026-08-22, deliberately separate. |
| `game differential` (`data/engine-diff.json`) | **STALE** — ran on `c28ad0815782`, tree is `1be57a100d59`. Owed a re-run, not a defect. |
| `deliberate roster / items` | **STALE** — same reason |
| `deliberate roster / abilities` | **STALE** — same reason |
| `deliberate roster / moves` | **STALE** — same reason |
| `mechanics / staged and compared` (`data/all-mechanics-fire.json`) | **STALE** — same reason |

Four of those are artifacts this batch invalidated by moving the engine and did not re-publish. They
are re-runnable and the commands are printed by the gate itself.

## OWED, AND LOUD — THE NON-FLAT RE-PRICE DISARMS ITSELF ON 39 CLICKS

The run receipt on `1be57a100d59`:

```
per-arrival volley re-price: offered 490, ran 850, MOVED a number 14
  [refused non-flat 180 (tripleaxel x3), drifted at arrival 0 39  <-- MUST READ 0, the wire
   disarmed itself, total not corrected 0]
```

Baseline and fix 1 read `offered 349 / drifted 0`; fix 2 introduced both the +141 offers and the 39
drifts. **141 + 39 = 180, which is exactly the non-flat population** — so the new road serves 141 of
the 180 non-flat clicks in this pool and REFUSES 39 of them at its own arrival-0 invariant.

A drifted click is **disarmed, not mispriced**: `R.reprice` is set to null and the click behaves
byte-for-byte as it did before this batch, which is why board-material still reached zero. But the fix
is incomplete on those 39, and `arrivalRepriceDriftsAtArrivalZero` is designed to say so rather than
let it pass quietly. **This is an open ENGINE item, not a clean landing.**

## THE CENSUS DID NOT MOVE

`tests/test-mechanics.js` re-run on the fixed bytes: **830 live, 0 missing, 830 probed**,
0 probes threw, 0 hollow, 830 of 830 return `{control, test}` arms, 829 of 830 spend a real turn or a
real entry. `data/mechanics-census.json` rewritten. Batch M lost a row to a probe that was pinning a
KO; this batch lost none.

## STOPPED HERE, DELIBERATELY

The brief says board-material zero means STOP and start nothing else. `engine/status.js` reads
`PASS ... BOARD-MATERIAL: 0 of 958`, so this batch stops. What was NOT done, and is owed:

- **the four stale artifacts** — `data/engine-diff.json`, `tests/roster.js` for items / abilities /
  moves, and `data/all-mechanics-fire.json`, all owed a re-run on `1be57a100d59`. Four gate clauses
  turn on them and the gate prints each command.
- **the 39 arrival-0 drifts** introduced by fix 2, diagnosed only as far as the arithmetic
  (141 + 39 = 180, the whole non-flat population).
- **the multi-arrival drain line count**, narration.
- `node engine/status.js --write`, the CHANGELOG entry and the version bump — the brief withholds all
  three from this agent.

Nothing was committed. The tree carries three new probes, three predictions, the batch directory, this
report, the `docs/ENGINE.md` section and the `docs/RUNNING-NOTES.md` row.

Three releases were cut on the way: `a31d271995e3`, `09fde54aa1df`, `1be57a100d59`.
