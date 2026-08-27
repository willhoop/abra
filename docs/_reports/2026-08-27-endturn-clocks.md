# The end-of-turn clocks: one root, seven members, and the singleton was one of them

2026-08-27. ENGINE. Release cut for this work: **`6b7d032f6376`**. Prior release: `e5957689f94f`.

## LEAD — THE SIX CLOCKS AND THE SINGLETON ARE THE SAME ROOT, AND IT WAS TESTED, NOT ASSUMED

**Confirmed.** The brief's hypothesis was right, and the establishing evidence is a probe rather than
an argument.

The card was:

```
showdown : |-end|p1a: Archaludon|Disable
medicham2: |-start|p1b: Staraptor|perish1
```

`disable.condition` declares `onResidualOrder: 17` and no `onResidual` at all
(`pokemon-showdown/data/moves.ts:3649`). `perishsong.condition` declares `onResidualOrder: 24` and
does own one (`:13236`). Champions overrides neither — `data/mods/champions/moves.ts` carries no
`disable` and no `perishsong` row, and `data/mods/champions/conditions.ts` names neither, so the
mainline blocks are what this format plays. 17 < 24, so the authority writes the Disable end first.

`Battle#fieldEvent` (`sim/battle.ts:484-566`) is why a handler-less duration is in the walk at all:

```js
let getKey; if (eventid === 'Residual') getKey = 'duration';            // :487-489
...  if (callback !== undefined || (getKey && volatileState[getKey]))   // :1107-1112, the collector
...  this.speedSort(handlers);                                          // :507
...  if (eventid === 'Residual' && handler.end && handler.state?.duration) {
       handler.state.duration--;
       if (!handler.state.duration) { handler.end.call(...); continue; }   // :514-524
     }
```

and `resolvePriority` (`:950`) fills `handler.order` from `effect['onResidualOrder']` **whether or
not the callback exists**, with `comparePriority` (`:404-411`) sorting ORDER first and speed only
third. So Disable is an ordinary step of the walk at position 17, purely to expire.

`medicham2-browser.js` ran **every** per-body duration clock in a body-major block BELOW the whole
walk — Perish Song and Yawn in one loop, Taunt/Encore/Disable in a second loop below that. The
Disable-vs-perish card is one visible instance of that; the six clocks
`residualExpiryDeferred()` already named are the same defect where nothing had happened to stage it.

**How it was established rather than reasoned.** `tests/probe_endturn_clock_order.js` stages one
board per member and plays both engines over it:

| arm | verdict | what parted |
|---|---|---|
| `disable-vs-perish` | RED PROVEN | `\|-end\|p2b: Snorlax\|Disable` vs `\|-start\|p1a: Alakazam\|perish1` — **the card rebuilt** |
| `disable-vs-speedboost` | RED PROVEN | `\|-end\|…\|Disable` vs `\|-boost\|…\|spe\|1` |
| `taunt-vs-speedboost` | RED PROVEN | `\|-end\|…\|move: Taunt` vs `\|-boost\|…\|spe\|1` |
| `yawn-vs-speedboost` | RED PROVEN | `\|-end\|…\|move: Yawn` vs `\|-boost\|…\|spe\|1` |
| `speedboost-alone` | CONTROL HELD | nothing of the family on the board |
| `leechseed-vs-speedboost` | CONTROL HELD | order 8, already correctly placed |
| `perish-vs-speedboost` | KNOWN-OPEN | perishsong@24 still ticks at the foot, DECLARED |

Four different members, one shape, one fix, and both controls unmoved. That is what makes it one
root and not four coincidences.

## THE SCOREBOARD, SAID BEFORE THE RUN AND HELD

Predicted: **whole-game falls by 1, board-material stays 1.** Both held.

| quantity | before (release `e5957689f94f`) | after (release `6b7d032f6376`) |
|---|---|---|
| whole-game | **4 of 961** (9 raw, less 5 declared) | **3 of 961** (8 raw, less 5 declared, 0 cleared) |
| board-material (`games − games_board_never_diverged`) | **1 of 961** (961 − 960) | **1 of 961** (961 − 960) |
| census | 755 live / 755 probed / 0 missing | 755 live / 755 probed / 0 missing |
| `M.residualExpiryDeferred()` | 6 rows | **1 row** (`magnetrise@18`) |

Both figures are read out of `data/game-differential.json` (`diverged`, and
`state.games_board_never_diverged`), not off stdout.

**Board-material did NOT move, and that is the right answer rather than a disappointment.** Every
line this change moves is a `-end`, a `-boost` or a `-start|perishN`; the perish COUNTER and the
Disable STATE were already correct in both engines and only their announcement order differed. If
board-material had risen, that would have been the signal to stop, and it did not.

The 8 remaining raw rows are: five declared Supreme Overlord `fallenundefined`, two declared
Tailwind orderings, and one `-damage: a different body`. Nothing left in the pinned pool is
actionable without Will.

## WHAT LANDED

`engine/medicham2-browser.js`:

- `RESIDUAL_CLOCK_READER` — the six-plus-one members this engine has a reader for, and what kind.
- `RESIDUAL_CLOCK_ORDER` — id → `{order, sub}`, read off `data/residual-order.json` (which CALLS
  `Battle#resolvePriority`, so the numbers are the authority's own). No order is typed in the engine.
- `RESIDUAL_GROUPS` gains one step per member, pushed rather than written into the literal, so a
  member with no reader never reaches the walk.
- `RESIDUAL_CLOCKS_AT` — per group index, which clocks it spends. Precomputed; empty on almost every
  group.
- `residualClockTick(m, id)` — one clock, one residual. The bodies of its branches are the exact
  lines that stood in the foot block.
- `residualClockPlacement()` — exported. Prints `placed` and, crucially, `unread`.
- The foot-block lines are kept and gated on `ENDTURN_CLOCKS_AT_FOOT`, so the knob moves the POSITION
  and never deletes the mechanic.

Placed, off the artifact: `taunt@15, encore@16, disable@17, healblock@20, throatchop@22, yawn@23`.
All of those orders are ABOVE this walk's own groups at 25 (roost), 26 and 27 (the side/field
expiries), 28 (Speed Boost, Moody, Harvest) and 29 (White Herb, Zen Mode) — so the change moves them
above those as well as above each other, which is what the three `*-vs-speedboost` arms measure.

## WHAT DID NOT LAND, NAMED

- **`magnetrise@18` has NO READER IN THIS ENGINE AT ALL.** It is the only row left in
  `residualExpiryDeferred()`, and it is a **missing tick, not a misplaced one** — `durationVolatiles()`
  is keyed off `sealsMoves` and Magnet Rise does not carry it, so nothing ever counts that clock down
  and the volatile does not end on its own. That is a different defect with a different fix, and
  inventing a decrement for a field whose representation I had not verified would have been a guess.
  It is now reported by `residualClockPlacement().unread` on every run instead of by a sentence.
- **`perishsong@24`, `uproar@28` and `lockedmove`** still tick at the foot. They own `onResidual`
  handlers, a faint at zero, and a drain position that is Will's card 8 (`RESIDUAL_AFTER_PERISH` and
  `residualFollowerRuns` are built around perish sitting where it sits). Moving them is a second
  change with a second set of consequences. `perish-vs-speedboost` is staged as a KNOWN-OPEN arm so
  that gap carries a running measurement.

## THE INSTRUMENT FAULT THIS RUN PRODUCED, RECORDED BECAUSE IT ALMOST PASSED

The probe's first knob run reported `residualClockInWalk` **identical across the knob on all seven
arms** — CLAUDE.md's "an unwired knob gives identical output" arriving exactly on cue. The cause:
`game_differential.js` with no `--release` CUTS a release from the live tree and loads the engine out
of `data/releases/<id>/engine/medicham2-browser.js`. Deleting `require.cache` for
`engine/medicham2-browser.js` therefore deleted nothing that was in use, and the second load reused
the cached snapshot. Fixed by dropping every cached module whose filename is this engine, whatever
directory it came from, and by asserting `MEDFAILS.endturnClocksAtFoot === 1` on the knob load and
absent on the clean one before any arm is classified. Without that assertion the file would have
printed seven green controls and proved nothing.

Two earlier fixture faults, same session, same shape: the first Disable arm had the target holding a
Protect, which is priority +4 and simply blocks a priority-0 Disable — `volDurationTicked` read 0 and
the arm agreed while staging nothing. And `Defense Curl` is not in this format; the probe's own
legality gate said so and refused to run rather than skipping.

## GREEN AFTER

- `tests/probe_endturn_clock_order.js` — 7 arms, 1 KNOWN-OPEN, 0 failing. PASS.
- `tests/test-resolution-order.js` at `--max-old-space-size=6144` — 26 arms, 1 KNOWN-OPEN, 0 failing.
  PASS. (ROADMAP #446, the OOM at the default heap, is unchanged and is not mine.)
- `tests/test-volatile-duration.js` — 4 of 4 IDENTICAL, including `perishsong-still-correct`.
- `tests/test-mechanics.js` — 755 live / 755 probed / 0 missing, 0 threw, 0 hollow.
- `test-game-diff`, `test-engine-consistency`, `test-wiring`, `probe_volatile_leaves`,
  `test-end-state`, `test-protocol-trace`, `test-mc-seal`, `test-immunity-gate`,
  `test-encore-fail-silent`, `test-bracket-regain` — all exit 0.
- `tests/test-docs-current.js` 23/0, `tests/test-roadmap-register.js` 3/0.
- Three roster stages on `6b7d032f6376`: items 0 DIFFER / 0 DID-NOT-FIRE (139 of 148), abilities 0/0
  (129 of 202), moves 0/0 (475 of 500) — byte-identical verdict vectors to the previous release.
- `all_mechanics_fire --kind all --write` on the same tree: the diverging SET is the **identical 16
  rows** (`berserk, forewarn, sandforce, supremeoverlord, leppaberry, metronome, bittermalice,
  corrosivegas, gastroacid, healbell, nightdaze, recycle, reflecttype, shellsidearm, smackdown,
  switcheroo`) — zero cleared, zero newly diverging, diffed by id and not by count.

## OWED, NOT RUN

```bash
# The whole batch was NOT run end to end this session — only the twelve gates listed above.
node tests/run-all.js

# The two gate clauses that are still FAIL and are NOT this change:
#   whole-game differential  3 of 961 — five declared Supreme Overlord rows, two declared
#                            Tailwind rows and one `-damage: a different body`. All need Will.
#   mechanics                5 of 12 — unmoved by this change, identical set.
#   #218                     the differential row itself, open because the number is non-zero.

# NOT OWED, and saying so rather than leaving it implied: the 6,000-row damage differential at
# all sixteen corners. No damage path was touched — this change moves only WHERE a duration is
# spent — and status.js reads 0/6000 at the midpoint and at each of the fifteen other corners.

# NOT MINE, and both are printed rather than described:
#   magnetrise@18 has no clock reader in this engine  -> M.residualClockPlacement().unread
#   perishsong@24 / uproar@28 / lockedmove at the foot -> the `perish-vs-speedboost` KNOWN-OPEN arm
```
