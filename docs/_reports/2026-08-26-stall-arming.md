# The stall counter was not an arming failure — 2026-08-26, ENGINE

Historical findings record. Not maintained, not current state, superseded by ROADMAP #463 and the
`docs/ENGINE.md` ledger section it feeds.

## The verdict

The card — `baseline turn 8 p2.active[1].stall  medicham 0 / showdown 3`, seeds
`gen9championsvgc2026regmbbo3-2662815123 vs -2662930043` — was dispatched as an **arming** failure, on
the reasoning that 3 is `stall.onStart`'s first value, so the authority armed once and this engine
armed zero times.

**That is wrong.** Both engines armed the counter on turn 7, to the same value, and the board agreed
there. The divergence is that this engine **spent the duration on turn 8**, and the authority never
opened turn 8's residual because the battle ended inside it.

## What the authority actually did, read off the replayed game

`playGame` with `onBoundary`, reading `battle.p1/p2.active[i].volatiles.stall` beside this engine's
`tookProtectTurns` at every turn boundary:

```
  t6  showdown ABSENT             medicham 0    |upkeep| emitted
  t7  showdown 3 (duration 1)     medicham 3    |upkeep| emitted     p2a Garchomp clicks Protect
  t8  showdown 3 (duration 1)     medicham 0    NO |upkeep|          p2a Garchomp clicks Earthquake
      |move|p2b: Tsareena|Taunt||[still]  |move|p2a: Garchomp|Earthquake|[spread] p2b,p1b  |win|B
```

`turnLoop` (`sim/battle.ts:2947-2950`):

```js
  while ((action = this.queue.shift())) { this.runAction(action);
                                          if (this.requestState || this.ended) return; }
```

The residual is a **queued action**. A battle that ends mid-turn never reaches it, so
`handler.state.duration--` (`sim/battle.ts:516`) never runs and the counter is still standing on the
last board the authority writes. The absent `|upkeep|` is the receipt: `case 'residual'` emits it, and
conditionally (`if (!this.ended) this.add('upkeep')`).

### The reproduction is not free, and this is worth recording

`game_differential.js` cannot replay one game in isolation from the CLI. The game is reachable from a
script that

1. builds the swarm from the pinned store with the same `--games` budget,
2. finds both teams by id in `SW.out.find(c => c.config === 'baseline').picked_teams`,
3. plays the **stones-removed control game first** — `playOne` runs it before the measured game and
   `midClearNth()` only fires after the measured one, so the measured game's `nth` addressing inherits
   the control's draws.

Without step 3 the pair plays a different, non-diverging game (9 turns, `stateDiv null`). With it, the
turn-8 `stall 0 / 3` reproduces. The slot differs (`active[0]` here against `active[1]` in the 1,200-game
artifact) because coverage steering across a full run changes the clicks; the mechanism is identical.

## The staged control

Two-body pairs (`buildPair(sheet, { max: 2 })` works and the battle runs), one script, the only knob
being whether the last Rock Slide wipes the foe side:

```
  ARM   foes MILOTIC (survive the chip, die on the last slide)
    t5  showdown 3 (duration 1)   medicham 3   |upkeep| 5   ended=false     <- the shield arms
    t6  showdown 3 (duration 1)   medicham 0   |upkeep| 5   ended=true      <- THE DEFECT
  ARM   an ordinary turn on the same board
    t(n) armed 3   t(n+1) ABSENT / 0                                        <- already agreed
```

After the fix the t6 row reads `showdown 3 / medicham 3`.

## The cause: two doors the authority does not have, and one door on the wrong side of a break

`volatiles.stall` is deleted in exactly three places in the authority:

| | where |
|---|---|
| a LOST roll | `stall.onStallMove`: `if (!success) delete pokemon.volatiles['stall'];` |
| a BREAK | `hitStepBreakProtect`, `sim/battle-actions.ts:775`: `if (gen >= 6) delete target.volatiles['stall'];` |
| THE RESIDUAL | `duration: 2`, decremented once per residual and removed at zero |

This engine had the first two right and **four extra clears**:

- the turn pre-pass's `else it.mon.tookProtectTurns = 0` — a body that clicked something that is not a
  stalling move;
- `_shieldGate`'s three "you hold the last action" refusals (shield, Endure, side guard). The
  authority reaches none of these: `onPrepareHit` / `onTry` short-circuit on `!!this.queue.willAct()`
  **before** `StallMove`, so the volatile is untouched.

All four are invisible on an ordinary turn — the residual clears the counter by the time any board is
read — and visible on exactly one kind of turn: one that ends.

The duration sweep itself sat on the **outer exit** of `battleTurn`, below every `break _TURN`. Its
header gave the flinch clear's reasoning; the flinch clear's own header says *"THIS CHANGES NO BOARD
AND CANNOT"*, which is why the outer exit is right for it and wrong here. And ROADMAP #231's header,
on the very block those breaks belong to, already said: *"a win mid-turn cancels: every remaining
ACTION, the whole RESIDUAL, the `|upkeep|` line, and the faint REPLACEMENTS."*

## The fix

`_stallExpire` — one door, called where the residual opens, hoisted above `_TURN:` so a `break _TURN`
cannot leave it in the temporal dead zone (it did, on the first attempt, and the knob arm threw).

Two knobs, one per edit:

| knob | restores | census |
|---|---|---|
| `MEDI_STALL_EAGER_CLEAR=1` | the four eager `tookProtectTurns = 0` writes | 749 live / 4 missing |
| `MEDI_STALL_LAPSE_OFF_RESIDUAL=1` | the sweep on the outer exit | 749 live / 4 missing |

`MEDSEEN.stallSurvivedSkippedResidual`: **+1** on the wiped arm, **+0** on the control — the path is
reached, not merely present.

Declared and not fixed, in the header: a turn ending INSIDE its own residual spends the clock here
where the authority's speed-sorted walk might not have reached `stall`; and a fainted body's counter is
swept here where `fieldEvent` skips a fainted handler holder.

## Numbers

Predicted before the run: board-material 3 -> 2, whole-game clause unmoved at 10, raw diverged unmoved
at 15.

| | before `e04350588de1` | after `667278050dcf` |
|---|---|---|
| census | 749 live / 752 probed / 3 missing | **750 / 753 / 3** |
| board-material | 3 / 961 | **2 / 961** |
| whole-game clause | 15 raw − 5 declared = 10 | 15 − 5 = **10** |
| turn-1 boards identical | 961 / 961 | 961 / 961 |
| `game_agreement` | 0.9968 | 0.9979 |
| roster items / abilities / moves | 139 / 129 / 475, 0 DIFFER | identical |
| `test-engine-diff --n 6000` | 0 at 16 corners | 0 at 16 corners |

Run pinned three ways: `--release 667278050dcf --games 1200 --arm middle --turns 12 --team-store
data/team-pool-frozen --census data/verification/census-pin-9446a684709d.json --state --end-state
--write`. Pool `0d103fb9fa87`, 961 games, 5 declared `AUTHORITY-WRONG` rows on both sides.

The two board-material games that remain are the HELD Ditto body-key pair and were not touched.

## Instrument notes

- **`MECHANICS_NO_WRITE=1` is not a flag.** It was set on a knob run of `tests/test-mechanics.js`,
  silently ignored, and the run overwrote `data/mechanics-census.json` with the knobbed 749 live / 4
  missing. Caught by reading the artifact back. Regenerated clean in the same pass.
- **`cmd.exe /c "<escaped path>"` from the Bash tool opened an interactive shell** and reported
  success while running nothing. A wrapper `.cmd` invoked as `cmd //c "<path>"` works. One stray idle
  `cmd.exe` was created and killed **by pid** (12796).
