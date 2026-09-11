# Clone cost — copying a mid-game position, MEDICHAM vs Showdown (SEARCH, 2026-09-11)

## Verdict

**Copying is not what limits rollout search, in either engine. Playing the turns is.** A copy costs
about **0.3x one turn in MEDICHAM** and **0.4x one turn in Showdown**. Measured to the end, from the
same position, a whole rollout costs 4.9x a turn in MEDICHAM and 6.1x in Showdown, and the copy is
about 6% of that in both engines.

**Independence of the copy:**

- **MEDICHAM's rebuild is independent.** No object is shared with the board, with the `MC` table or
  with another copy, and every check passes on all 48 positions.
- **Showdown's string round trip is independent**, with every check passing on all 48 positions.
- **Showdown's in-memory `fromJSON(toJSON())` is NOT independent.** It fails every check on all 48
  positions. This is the form Showdown's own `runner.ts` uses.

Measured on frozen release `2b5a6585d8cf`, with the Showdown checkout at `20ad99ff`, on the pinned
pool `data/team-pool-frozen`. Every absolute time below was taken **under contention**, because an
ENGINE agent was pinning every core. The ratios are the figures of record, and a quiet re-run is owed.

Artifact: `data/verification/clone-cost-2026-09-11.json`.
Harness: `data/verification/clone-cost-2026-09-11/bench_clone.js`.

## 1. The copy paths that exist

| Engine | Copy path | Source |
|---|---|---|
| MEDICHAM | **There is no state-copy function.** For each rollout, MILTANK's leaf rebuilds a fresh battle from the board.js `Board`: `buildSide` x2, then `battleInit(seeded)`, then the field/clock/side appliers and `applyMegaWeather` | release `rollout_leaf.js:1241` (`rolloutWinProb`); the per-sample rebuild is `:1299-1343`; `:1289` reads "Fresh bodies EVERY rollout" |
| Showdown | `Battle#toJSON` / `Battle.fromJSON`, which is `State.serializeBattle` / `State.deserializeBattle` | `sim/battle.ts:318-323`; `sim/state.ts:61-155`; used in memory at `sim/tools/runner.ts:218,233-234` |

**The bench times the real function, not a copy of it.** `applyMegaWeather` is not exported, so the
rebuild cannot be reproduced from outside the module. The bench therefore calls
`rolloutWinProb({maxTurns:-1})`. With that setting `battleOver` is true before turn one
(`medicham2-browser.js:25845`), so the call rebuilds the position and plays no turns. A pass-through
wrapper on `MEDI.battleInit` captures the rebuilt state for the checks. The copy cost is taken per
rollout from calls of K=10, which amortises the call's one-off double pre-check build
(`rollout_leaf.js:1269-1270`) to a tenth.

**Showdown's in-memory round trip shares the original's log and sets. This was found by reading the
source first.** `serializeBattle` stores `state.log = battle.log` (`state.ts:72`),
`deserializeBattle` assigns it back (`:153`), and `serializePokemon` stores
`state.set = pokemon.set` (`:214`). Three Showdown variants were measured:

- `mem`, the runner's form;
- `str`, which passes the state through `JSON.stringify`;
- `memfix`, which is `mem` plus `c.log = c.log.slice()`. This is the smallest change that stops
  sharing the log. It is not a Showdown API.

## 2. Is the copy independent? (the red demo was run first)

Positions came from 16 games, taken at a stride of 800 lines over the frozen bo3 store. Each game was
played with the harness's random policy, with one mega per side at the first chance, and positions
were taken at the start of turns 2, 5, 8 and 12. That gave 48 positions: 16, 15, 10 and 7.

**The checks:**

| Check | What it asks |
|---|---|
| C1 / M1 | After a copy is played for three turns, is the ORIGINAL byte-identical? For Showdown the original is the full `toJSON` state. For MEDICHAM it is the Board. |
| C2 / M2 | Do two copies played on the same dice finish identical? |
| C3 / M3 | Is a copy taken after another copy was played identical to one taken before? |
| C4 / M4 | Do the two object graphs share any object? Showdown's dex-class objects are excluded. |

**Red first.** Each check was first run against a deliberately wrong copy, and it had to fail:

| Scratch copy (wrong on purpose) | Result |
|---|---|
| Showdown: lead's `moveSlots` aliased to the original | C1 fails 45 of 48, C3 fails 45 of 48 |
| Showdown: second copy reuses the first copy's PRNG | C2 fails 46 of 48 |
| MEDICHAM: lead body's `_pp` pointed at the board's PP ledger | M1 fails 48 of 48, M3 fails 45 of 48 |
| MEDICHAM: second copy continues the first copy's rng stream | M2 fails 48 of 48 |

The few passes are positions where the aliased lead never used a move in the three turns. If a check
had passed a deliberately aliased copy, the run would have exited 3; it did not.

**The real copy paths:**

| Copy | C1/M1 | C2/M2 | C3/M3 | Shared objects |
|---|---|---|---|---|
| Showdown `mem` | **0 of 48** | **0 of 48** | **0 of 48** | the log array, plus 32 set objects (team sets and their `moves`/`evs`/`ivs`) |
| Showdown `str` | 48 of 48 | 48 of 48 | 48 of 48 | none |
| Showdown `memfix` | 48 of 48 | 48 of 48 | 48 of 48 | the 32 set objects; no play wrote to them |
| MEDICHAM rebuild | 48 of 48 | 48 of 48 (7 of 48 raw, see below) | 48 of 48 | 0 with another copy, 0 with the board, 0 with `MC` |
| MEDICHAM `structuredClone` (not in the engine) | 48 of 48 | 48 of 48 | — | plays exactly like a rebuild, 48 of 48 |

**Why `mem` fails.** A copy's turn appends to the original's log: the first C1 diff is
`$.log: length 80 vs 147`. The same shared array also desynchronises a per-battle index into the log:
the first C2 diff is `lastMoveLine: 141 vs 208`.

**MEDICHAM's raw M2 failures are process-global stamps.** They are not play diverging and not
aliasing. Across all 41 raw failures the only fields that differ are `_faintSeq` and `_rtieGen`:

- `_FAINT_SEQ` (`medicham2-browser.js:25031`) is stamped by `noteFaint` (`:25038`). `battleResult`
  only compares it within one battle (`:45612`).
- `_RES_TIE_GEN` (`:9832`) is bumped once per residual phase (`:43399`). A body's copy of it is only
  compared for equality with the current value (`:9878`).

Both counters keep counting across battles, so the absolute value is an offset. The check therefore
compares their rank within the battle, and the raw result stays in the artifact (`M2_raw`) so the
normalisation is visible. `Math.random` calls during the checks: 0.

**The shared `MC` table is written once, and never by a rollout.** `stampMoveIds`
(`medicham2-browser.js:10904-10913`) writes `id=<key>` onto every `MC.moves` row on first use and is
guarded by `_mvIdsStamped`. The primer caught that write. After it, the table digest `49b36e59f49e`
is unchanged at every phase boundary: red demo, real checks, timing and memory.

## 3. Cost

Every ratio is within one engine, from the same position, with all operations interleaved in one
rep loop. Positions give 12 reps each, and 4 reps include full playouts. Each value is the median
across positions, with the p90 in brackets. "Full" means playing to a result or 20 further turns,
which is the leaf's default cap.

| Depth | positions | MEDICHAM copy / turn | MEDICHAM copy + 3 turns / turn | MEDICHAM full / turn | Showdown `str` copy / turn | Showdown copy + 3 turns / turn | Showdown full / turn |
|---|---|---|---|---|---|---|---|
| 2 | 16 | 0.29 (0.32) | 2.65 | 5.84 | 0.41 (0.49) | 3.39 | 8.85 |
| 5 | 15 | 0.32 (0.39) | 2.74 | 4.57 | 0.46 (0.58) | 3.31 | 5.50 |
| 8 | 10 | 0.32 (0.46) | 2.41 | 3.10 | 0.46 (0.64) | 3.14 | 3.62 |
| 12 | 7 | 0.40 (0.66) | 1.95 | 2.16 | 0.68 (1.20) | 2.59 | 2.56 |
| all | 48 | **0.32 (0.46)** | **2.52** | 4.91 | **0.44 (0.68)** | **3.28** | 6.07 |

Other copy variants, as a multiple of one turn (all depths): Showdown `mem` 0.34x and `memfix` 0.37x.
MEDICHAM `structuredClone` of an already-rebuilt state costs **0.11x**, about three times cheaper than
a rebuild. However, the copy is only about 6% of a full rollout, so that saving is worth about 4% of
rollout time.

**The copy's cost is flat with depth, and the ratio rises only because late turns get cheaper.**
Contended medians, all in ms:

| Measure | Depth 2 | Depth 12 |
|---|---|---|
| MEDICHAM copy | 0.36 | 0.36 |
| Showdown copy | 1.38 | 1.44 |
| MEDICHAM turn | 1.21 | 0.90 |
| Showdown turn | 3.29 | 2.18 |

The Showdown log grows from 83 to 324 lines between those depths. The copy carries it and still does
not grow materially.

**Absolute times, all depths (CONTENDED):**

| Measure | MEDICHAM | Showdown |
|---|---|---|
| copy, median | 0.367 ms | 1.409 ms (`str`) |
| copy, p90 | 0.434 ms | 1.749 ms |
| one turn, median | 1.121 ms | 3.012 ms |
| copy + 3 turns | 2.884 ms | 10.07 ms |
| full rollout | 6.22 ms | 21.2 ms |

A full rollout here is short: the median is 7.1 turns for both engines, because random play from
mid-game ends quickly. In ratio terms, a Showdown turn costs 2.66x a MEDICHAM turn and a Showdown copy
costs 3.82x a MEDICHAM copy.

**Noise floor.** On the same op, the first half of the reps was compared with the second half (the
half-split). The largest gap was Showdown copy 9.0%; MEDICHAM copy 3.3%, MEDICHAM turn 5.4% and
Showdown turn 1.0%. A ratio difference smaller than that is not a difference.

**Memory per copy.** This is the heap delta while holding 30 copies, as the median of 3 trials, and it
is an estimate:

| | MEDICHAM rebuild | Showdown `str` | Showdown `mem` | Showdown serialized JSON |
|---|---|---|---|---|
| per copy | about 7 KB at every depth | 62 KB (depth 2) to 92 KB (depth 12) | 43 KB to 67 KB | 29.9 KB to 41.2 KB |

`mem` looks smaller only because it does not own the log.

**Rollouts per second per core, including the copy. This is an ESTIMATE from contended timings.**

| | full rollouts | 3-turn rollouts |
|---|---|---|
| MEDICHAM | about 160 per second | about 350 per second |
| Showdown | about 47 per second | about 99 per second |

## 4. Caveats, stated rather than buried

- **The two turn costs include different policies.** MEDICHAM's turn includes MILTANK's own explore
  policy, which sits inside `runPlayout`. Showdown's turn includes this harness's JavaScript chooser,
  which was not subtracted. Both are what a rollout actually pays, but the cross-engine turn ratio is
  not an engine-only figure.
- **The boards are populated from Showdown's live state through the Board public API**, not from
  protocol lines as the live bot does it (`magnemite.js` is not a release source). Volatiles, the
  status clock and weather age are not populated. Cost depends on what the board holds, not on the
  route that filled it.
- **Not tested: two MEDICHAM states played alternately, turn by turn.** The rollout path builds,
  plays and discards one state at a time, and M2 built two states before playing either. But the
  engine keeps a "current battle" in module globals: `MID_S`, `MED_RNG`, `_FAINT_EPOCH` and `_FAINTQ`.
  A tree search that keeps nodes alive and steps them alternately would need that tested before it is
  trusted.
- **Not all of the run is pinned.** `data/rollout-switch-census.json` is not a release source. It was
  read live, has digest `b599f8d581b5`, and gave switch rate 0.0998.
- **A null here would say nothing about search quality.** This measures cost and independence only.
  MEDICHAM remains quarantined for accuracy.

## 5. Row text (not written — the brief forbids editing existing files)

**`docs/RUNNING-NOTES.md`:**
> Clone cost measured (SEARCH, 2026-09-11). Copying a mid-game position costs 0.32x one turn in
> MEDICHAM (its rebuild-from-board path) and 0.44x in Showdown (string round trip). A full rollout
> costs 4.91x and 6.07x a turn, so the copy is about 6% of it and is not the bottleneck. MEDICHAM's
> rebuild and Showdown's string copy are independent of the original (48 of 48 positions, checks
> shown red first on aliased copies). Showdown's in-memory `fromJSON(toJSON())` shares the log and
> fails 48 of 48. Measured under contention; quiet re-run owed. Artifact
> `data/verification/clone-cost-2026-09-11.json`, release `2b5a6585d8cf`.
> **Supersedes.** Nothing. **Basis.** unchanged. Fold-in owed: `docs/SEARCH.md` and
> `docs/MILTANK.md` (the rollout cost model).

**`docs/SEARCH.md`, open work:**
> Rollout budget. The copy is not the constraint: about 160 full MEDICHAM rollouts per second per
> core, contended estimate. If search ever keeps tree nodes alive, MEDICHAM's module-global battle
> context must first be tested under interleaved stepping.

**`CHANGELOG.md`:**
> Added — clone-cost bench and artifact (MEDICHAM rebuild vs Showdown serialize), with copy
> independence checks. No published figure moves, so this is a PATCH.

**Nothing to file in `docs/ENGINE.md`.** The two process-global stamps are by design, since only their
order or equality is ever read. The `MC.moves` id stamp is one-time and idempotent. `node engine/status.js --write`
was not run, because it rewrites existing ledgers and the brief forbids editing existing files.

## OWED, NOT RUN

The quiet-machine re-run, with nothing else pinning cores. It uses the same flags, so it is the same
sample; it writes to a new file so the contended run stays as evidence. Compare the absolute times,
and confirm the ratios move by less than the noise floor.

```bash
cmd //c "tools\lownode.cmd data\verification\clone-cost-2026-09-11\bench_clone.js --out data/verification/clone-cost-2026-09-11-quiet.json"
```

The same run, but priority-free, to show what BELOWNORMAL cost:

```bash
node data/verification/clone-cost-2026-09-11/bench_clone.js --out data/verification/clone-cost-2026-09-11-quiet-normalprio.json
```

The restamp, once the coordinator folds in the rows:

```bash
node engine/status.js --write
```
