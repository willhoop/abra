# Interleave — do two live MEDICHAM battles stay independent when stepped alternately? (SEARCH, 2026-09-11)

## Verdict

**Stepping two battles turn by turn is independent.** Two live battles stepped alternately (P, Q, P,
Q, …) end identical to the same two battles stepped one after the other. That holds for state,
protocol, result and counters: **0 differences in 768 battle comparisons**. The sample was 96 cross
pairs and 96 self pairs, at 3 turns and to the end, 2 seeds each. The one qualification is that three
process-wide stamps are compared by rank, since only their order is ever read.

A second rebuild of the same position on the same dice, stepped alongside the first, matches it
**192 of 192**. The check was shown red first:
- a scratch copy that leaks the dice stream fails 184 of 192;
- a scratch copy that leaks the trace sink fails only the protocol check.

**One module variable leaks between builds, not between turns: `_FAINT_EPOCH`.** On a double wipe,
`battleResult` is valid only until the next `battleInit` anywhere in the process. After one unrelated
build it reads **0.5 instead of the winner**. That happened on 43 of 43 constructed double wipes, and
on the 1 natural double wipe found in 1,824 random full playouts.

The build is the cause. Reading again with nothing built changes 0 of 43. Building the other battle
while this one is still alive also changes 0 of 43.

**A second variable leaks, but only in the differential's instrument: `MID_NTH`.** Two battles on the
same event-dice seed, stepped alternately, share its repeat counter. 48 of 96 self comparisons and
46 of 96 cross comparisons diverge; with distinct seeds, 96 of 96 agree.

**Nothing today is affected.** The leaf, MILTANK and the game differential each build a battle,
finish it and read the result before building the next. A tree search would be exposed to
`_FAINT_EPOCH` as soon as it re-read a finished node after expanding another. It would have to read
the result when the node finishes, or ENGINE would have to make the epoch per-battle. Not fixed
here; the ENGINE filing text is in §6.

Release `2b5a6585d8cf` (Showdown `20ad99ff`), pinned pool `data/team-pool-frozen`. MEDICHAM is
quarantined for accuracy; this is independence only.

Harness: `data/verification/interleave-2026-09-11/bench_interleave.js`.
Artifacts: `data/verification/interleave-2026-09-11/interleave.json` (the release), `red-dice.json` and
`red-trace.json` (the two deliberately broken scratch copies).

## 1. The static audit — every module-level variable a turn writes

Line numbers are the release copy `data/releases/2b5a6585d8cf/engine/medicham2-browser.js` unless stated.
"Safe" below means: written or reset at every place a battle starts a turn, so battle A's turn cannot
read what battle B's turn left behind. The bench is what tests that; this table says where to look.

### "Current battle" pointers — reassigned unconditionally at the top of every turn

| Variable | Declared | Written | Read | Verdict |
|---|---|---|---|---|
| `MID_S`, `MID_TURN`, `MID_MOVE`, `MID_TGT`, `MID_ATT` | :26471 | `battleInit` :25725, `battleTurn` :26642 (every turn) | `midEventSlot` :26549, `midEventBase` :26569 | safe at turn boundaries |
| `MED_RNG` | :23318 | `battleInit` :25721, `battleTurn` :26646 (unconditional, including to null) | `medRng()` :23319 (Trace's die) | safe |
| `MED_TIE_RNG` | :23327 | `battleInit` :25724, `battleTurn` :26649 | `medTieRng()` :23328 (entry and residual tie sort, :9877) | safe |
| `TR` (the trace binding) | :4865 | `traceBind` :5471-5477 at turn entry; `traceRelease` :5479 at exit (:45599) | every emit site | safe; rebound every turn |
| `TRACE` singleton's own fields `_mvLine`, `_pendRedir`, `drag` | :4908-4941 | `_mvLine` :4932; `_pendRedir` set :28840, cleared :28797; `drag` :31632-31634, :43145-43147 | `attr`/`retarget` :4938, :5290 | **not reset by `traceBind`**. Only matters when a trace sink is attached, which the rollout never does. The bench saw no protocol difference; the table cannot rule it out. |

### Per-turn scratch — cleared on every exit from the turn

| Variable | Declared | Lifecycle | Verdict |
|---|---|---|---|
| `ENCORE_Q` | :18299 | set :28332; cleared on **every** exit, below all `break _TURN` sites, :45535 | safe |
| `TTM_INFLIGHT` | :26535 | armed :28992; disarmed at the `|move|` line :29678; swept at the top of each action :28324 and after the last action :43370 | null at every exit (the one mid-action `break _TURN`, :28413, sits after the :28324 sweep) |
| `_FAINTQ` | :25540 | drained by `drainFaints` :25613 at the authority's boundaries; `battleInit` clears a leftover **and counts it** as `MEDFAILS.faintQueueLeaked` :25642 | safe; the counter is the proof (§3) |

### Residual-phase generation

| Variable | Declared | Lifecycle | Verdict |
|---|---|---|---|
| `_RES_TIE_GEN` | :9832 | bumped once per residual phase :43399; a body's `_rtieGen`/`_rtie` compared by EQUALITY only :9878 | safe; a phase never spans two battles. The stamp is an offset (rank-normalised, as in the clone bench) |
| `_RES_SHADOW_GEN`, `_RES_SHADOW_RANK`, `_RES_SHADOW_LIST` | :10212 | memoised against `_RES_TIE_GEN`, rebuilt at :43408 immediately after the bump; the only reader that passes `order` is :43607, inside the residual | safe |
| `_RES_SHADOW_LOG` | :10240 | written only under `MEDI_RESIDUAL_SHADOW_ALWAYS=1` | not on any measuring path |

### Faint bookkeeping — **one of these leaks**

| Variable | Declared | Lifecycle | Verdict |
|---|---|---|---|
| `_FAINT_SEQ` | :25031 | `noteFaint` :25038 stamps `_faintSeq = ++_FAINT_SEQ` | safe; only the ORDER is read |
| **`_FAINT_EPOCH`** | :25031 | bumped by **every** `battleInit` :25639; `noteFaint` :25038 stamps `_fEpoch = _FAINT_EPOCH`; `lastFaintSeq` :25635-25637 counts a faint **only if** `_fEpoch === _FAINT_EPOCH`; `battleResult` :45611-45613 uses it to decide a double wipe | **LEAKS.** The epoch means "the most recent battle anybody built", not "this battle". See §3. |

Live-tree lines, for the ENGINE batch (the live file is being edited, so these will move):
`engine/medicham2-browser.js` :25134 (`let _FAINT_SEQ=0, _FAINT_EPOCH=0`), :25738 (`lastFaintSeq`),
:25742 (`_FAINT_EPOCH++`).

### Event-addressed dice — **leaks, but only in the differential's instrument**

| Variable | Declared | Lifecycle | Verdict |
|---|---|---|---|
| `MID_NTH`, `MID_LOG` | :26472-26473 | `midEventDraw` :26572-26577 counts repeats keyed on `seed\|turn\|cat\|move\|target` (:26569), with **no battle identity**; cleared only when `midEventDice()` is called :26631 | **LEAKS** when two battles on one seed are stepped alternately. Used only by callers that pass `midEventDice` dice (`engine/game_differential.js` :1874), never by the rollout. Live lines: :26583, :26685, :26739. |

### Counters, caches and configuration — written, never read to decide anything

- `MEDSEEN` :90 and `MEDFAILS` :3053 are write-only apart from `...First` string markers (for
  example :4897). Their totals are order-independent, and the bench checks that. The one exception
  in kind is `MEDSEEN.residualShadowLargest` (:10228), a high-water mark, so its delta depends on
  history by construction. It is not a leak.
- Pure caches of static data (dex, tags, `MC`), filled once and never per battle: the `TAGS` closure
  :18, `_TPTH` :5655, `_prioBar` :5701, `_forbidVol` :5735, `_volNoRestart` :5841, `_volDur` :6069,
  `_volPTHP` :6110, `_volPTB` :6141, `_volOneTurnSurv` :6230, `_volGuarantee` :6259, `_volEmptySlot`
  :6367, `_PSCOPE` :6596, `_layTab` :6645, `_critVolTab` :6671, `_SGRATE` :7919, `_MEGA_INTO` :8622,
  `_RES_TERRAIN_KEY` :9934, `_MONIDX` :10483, `_contactCache` :10699, `_mvIdsStamped` :10907 (the
  one-time `MC.moves` id stamp the clone bench found), `_impSeal` :17216, `_FX` :18492.
- Configuration set by a caller, not by a battle: `PURE_PRIORS` :17135, `TRACE_LIST_SINK` :23339.
- `engine/rollout_leaf.js` (release): counters `volCounters` :322, `SEED_COUNTERS` :357,
  `FALLEN_GUARD` :473 (its `first`/`warned` fields only print), `SWITCH_COUNTERS` :725 and
  `fieldClockCounters` :1150; caches `_volSeed` :259, `_mp` :623 and `_census` :660. None of them
  steers a playout. `runPlayout` calls only `MEDI.battleOver` :838, `MEDI.playerAction` :912,
  `MEDI.battleTurn` :924 and `MEDI.battleResult` :946, so `board.js` module state is not touched
  inside a turn.

## 2. The bench

**Positions.** 16 games, taken at a stride of 800 over the frozen bo3 store. They were played to
turns 2, 5, 8 and 12 by bench_clone.js's seeded random policy, which gives 48 positions
(16 / 15 / 10 / 7). Each position becomes a live MEDICHAM battle through **the real rebuild**,
`rolloutWinProb(maxTurns:-1)` with a pass-through capture on `battleInit`.

**Stepping.** Each battle is stepped one turn at a time through **the real playout**,
`runPlayout` (explore 1.0, uniform foe, census switch rate 0.0998), with `S.maxTurns = S.turn+1`.
`maxTurns` is read in exactly one place (`battleOver` :25846), so the cap changes nothing inside a
turn. Every battle owns its own `mulberry(seed)`, so "same dice" is literal.

**Arms, per pair (P, Q), each played from scratch:**

| Arm | Order | What it stands for |
|---|---|---|
| A0 isolated | build P, play P; build Q, play Q | the leaf today |
| A1 alive, sequential | build P, build Q; play P; play Q | the brief's arm 1 |
| A2 interleaved | build P, build Q; P, Q, P, Q, … | the brief's arm 2 |
| A3 tree-shaped | build P, step P, build Q, step Q, then alternate | a node expanded while another is alive |

- **Horizons:** each arm runs at 3 turns and again to the end of the battle (20-turn cap).
- **Pairs:** 48 cross pairs, each position with the next one (different game and depth), and 48 self
  pairs (P and a second rebuild of P, on the same dice).
- **Seeds:** 2 per horizon.

**What is compared:**

- **State.** The whole battle object, as canonical JSON with the trace sink excluded. It is compared
  in three forms:
  - raw;
  - normalised: `_faintSeq` and `_rtieGen` rank-normalised as in the clone bench, and `_fEpoch`
    reported relative to the battle's own build;
  - epoch-blind.
- **Protocol.** What the battle wrote into its own trace sink, attached after the build.
- **Results.** `battleResult`, read at three moments:
  - the step that finished the battle (what `runPlayout` returns);
  - the end of the arm;
  - after one more, unrelated `battleInit`.
- **Counters.** The `MEDSEEN`/`MEDFAILS` deltas, compared key by key.
- **Global state.** `Math.random` calls, and the `MC` table digest.

**Double wipes** are the only case `_FAINT_EPOCH` decides, and random play barely makes them.
1-HP staging alone made **0 of 16** on the smoke run: the engine ends a battle the instant one side is
wiped (the `residualBody` drain, :44824-44826), so both sides' last bodies must fall in one faint
batch. The fixture is **constructed** instead:

- after the rebuild, each side keeps one living active body, and every other living body is set
  fallen (the state the leaf's seeded roster corpses already carry);
- both lone bodies are put on 1 HP;
- both are forced to Struggle at each other through the engine's own
  `playerAction(me,'struggle',…)`, which is the action `struggleAction` builds (:7002).

Whoever moves first KOs the other and dies to its own recoil in the same action.

## 3. Results

Run: 16 games, seeds 2 and 2, 6 natural double-wipe seeds, and 5,696 `battleInit` calls. It took
195 s on one core at BELOWNORMAL:

| Phase | Time |
|---|---|
| arms | 73 s |
| event dice | 32 s |
| natural double-wipe hunt | 16 s |
| double-wipe fixture | 3 s |
| each red child | about 34 s |

Pool bo3 digest `5e10d7ba991f`; census digest `b599f8d581b5`.

### 3a. Interleaved against sequential (A2 against A1): the brief's assertion

Every comparison below is per battle, so each pair contributes P and Q.

| Block | normalised state | raw state | epoch-blind | protocol | result at finish | result at end | counters |
|---|---|---|---|---|---|---|---|
| cross pairs, 3 turns | **192/192** | 19/192 | 192/192 | **192/192** | 192/192 | 192/192 | 96/96 |
| cross pairs, to the end | **192/192** | 0/192 | 192/192 | **192/192** | 192/192 | 192/192 | 96/96 |
| self pairs, 3 turns | **192/192** | 20/192 | 192/192 | **192/192** | 192/192 | 192/192 | 96/96 |
| self pairs, to the end | **192/192** | 0/192 | 192/192 | **192/192** | 192/192 | 192/192 | 96/96 |

**Raw state is not byte-identical, and the difference is not state.** The only raw differences are
the three stamp fields: `_fEpoch`, `_faintSeq` and `_rtieGen`. Each is the absolute value of a counter
that counts across the whole process, and each arm is played from scratch, so the absolute values
differ by construction. Compared by rank within the battle, with `_fEpoch` taken relative to the
battle's own build, every comparison is identical.

The self twins, P and its rebuild stepped alongside it on the same dice, agree 192 of 192 on
epoch-blind state, protocol and result.

Every depth is inside that zero: positions at turns 2, 5, 8 and 12 (16, 15, 10 and 7 of them), and no
comparison failed anywhere.

### 3b. A sibling alive, and a tree-shaped build, against isolated

| Block | epoch-blind | protocol | result at finish | normalised | counters |
|---|---|---|---|---|---|
| alive (A1) vs isolated (A0), 3 turns | 192/192 | 192/192 | 192/192 | 108/192 | 93/96 |
| alive vs isolated, to the end | 192/192 | 192/192 | 192/192 | 96/192 | 93/96 |
| tree (A3) vs isolated, 3 turns | 192/192 | 192/192 | 192/192 | 121/192 | 93/96 |
| tree vs isolated, to the end | 192/192 | 192/192 | 192/192 | 99/192 | 93/96 |

**Every normalised failure is `_fEpoch`, and it is the leak.** A battle's faints are stamped with the
epoch of whatever was built last. A battle with a sibling alive therefore carries `<ep+1>` where an
isolated one carries `<ep+0>`; the first diff is
`$.field._pendingLastBy._sf.team[1]._fEpoch: "<ep+1>" vs "<ep+0>"`. Nothing else about the battle
differs.

The 3 counter differences out of 96 are four high-water marks, each updated as "keep the larger":
`residualShadowLargest`, `entryTieLargestGroup`, `residualTieLargestGroup` and `speedTieLargestGroup`.
Their delta depends on what ran earlier in the process. A2 against A1 agrees on them 96 of 96.

The result read at the moment a battle finished equals the isolated battle's in every arm: 97
finished battles per arm at 3 turns and 384 to the end.

### 3c. Double wipes: where `_FAINT_EPOCH` decides a result

| Measure | Constructed (Struggle fixture) | Natural (random full playouts) |
|---|---|---|
| battles | 48 fixtures | 1,536 in the full-horizon arms + 288 in the hunt |
| double wipes | **43** (5 did not wipe both sides, not investigated) | **1** (0 in the arms, 1 in the hunt) |
| read immediately | 19 read 0, 24 read 1 | 1 |
| read again, nothing built (control) | 0 of 43 differ | 0 of 1 |
| read after ONE unrelated `battleInit` | **43 of 43 read 0.5** | **1 of 1 reads 0.5** |
| read after two | 43 of 43 read 0.5 | — |
| the other battle built BEFORE the final turn, while this one is alive | 0 of 43 differ | — |
| `MEDFAILS.doubleWipeNoFaintOrder` on the late reads | +43 | +1 |

The constructed example, from game `…2653923955` turn 2: lone Primarina against lone Archaludon. Read
immediately it gives 0; read again it gives 0; after one unrelated build it gives 0.5.

**Why only builds, never turns.** A mutual wipe happens inside one action, so both last faints are
stamped with the epoch that is current during that turn. Builds happen only between turns, so the
read at the finish is always right. A later build makes every stamp in the battle stale: both sides
then read `lastFaintSeq = -1`, and `battleResult` falls through to 0.5. No corpse was ever re-stamped
(0 in every arm), so the epoch guard in `noteFaint` never fired a second time.

### 3d. Event-addressed dice (`midEventDice`, the differential's instrument)

MEDICHAM's own chooser plays both sides, 3 turns, with seed `20260911`.

| Pairing | state (epoch-blind) | protocol |
|---|---|---|
| same seed, self pairs | **48/96** | 48/96 |
| same seed, cross pairs | **50/96** | 52/96 |
| distinct seeds, cross pairs (control) | 96/96 | 96/96 |

The distinct-seed control rules out a general interleaving fault. The seed is part of the address, so
distinct seeds give distinct repeat keys, and with distinct keys nothing leaks. The first diff is
`$.field._pendingLastMove: "moonblast" vs "kowtowcleave"`, which is a different click.

### 3e. The rest of what could leak, measured

- **Epoch inference holds.** 506 of 506 faint stamps in isolated battles equal the battle's own
  `battleInit` count, so "the build count is the epoch" holds.
- **The shared `MC` table** changed once, on the primer: `cf76ac629a00` became `49b36e59f49e`, which is
  the one-time `stampMoveIds` write the clone bench found. It stayed `49b36e59f49e` for the rest of the
  run.
- **`Math.random`: 0 calls.** So no leak can come through the one RNG the process shares.
- **Over the whole run, `MEDFAILS.faintQueueLeaked`, `encoreRelocateNoQueue` and
  `residualHandlerListAbsent` are all 0.** No faint queue, Encore queue or residual list crossed a
  battle boundary.
- **The `TRACE` singleton's own fields** (`_mvLine`, `_pendRedir`, `drag`) produced no protocol
  difference in 768 comparisons. No targeted fixture for them was built, and they are narration-only
  and absent from the rollout.

## 4. Red first — the checks can see a leak

Each variant is a scratch copy of the release (in the session scratchpad, outside the repo). Every
patch target was asserted to occur exactly once. Each variant was run as a child process with the
same flags, so it used the same 48 positions.

| Variant (ONE module variable leaked) | Must fail | Interleave result (A2 vs A1) |
|---|---|---|
| **dice.** The dice-stream struct is latched in one module variable at the first `battleTurn` after a `battleInit` and handed to every battle stepped after it: the coupling the comment above `MED_RNG` (:23305-23317) exists to prevent | state | normalised state passes **8 of 192** (3-turn cross), 7 of 192 (full), 11 and 9 of 192 (self). The self twins agree **0 of 192**. The first diff is `$.field._pendingLastMove: "haze" vs "hypervoice"` |
| **trace.** `traceBind` binds only when nothing is bound, and `traceRelease` never releases | protocol | state passes **192 of 192** in every block; protocol passes **99 of 192** (only P fails, since the latched sink is P's). The self twins' protocol agrees **0 of 192**; the first diff is `line 13: "|turn|1" vs "|turn|2"` |

The trace variant is the useful control: a leak that touches only the protocol leaves every state
check green, and is caught by the protocol check alone. Both children made 0 `Math.random` calls.
Artifacts: `red-dice.json` (patched medicham `34b0b4cfccc4`) and `red-trace.json` (`bcaf49254033`),
both from release medicham `31855b504052`.

## 5. Does it affect anything today?

**No.** Every caller builds a battle, plays it to the end and reads the result before it builds the
next one.

| Caller | What it does | Exposed? |
|---|---|---|
| `engine/rollout_leaf.js` `rolloutWinProb` (release :1241) | per sample: `battleInit` :1327, then `runPlayout`, which returns `MEDI.battleResult(S)` at :946 before the loop builds again | no |
| `rollout_leaf.js` `rolloutAfterActions` | `battleInit` :1395, then one forced `battleTurn` :1462, then `runPlayout` :1466; the same shape | no |
| `engine/miltank.js` | every leaf call is synchronous and sequential (`leafWinProb`/`leafAfterActions` :545-546), with no async, generator or worker | no. **A tree search would be new code, and it would be exposed.** |
| `engine/game_differential.js` | `playGame` (:3971) builds at :4048 and reads `battleResult` at :4994 with no other build between them. Its other two `battleInit` sites (`mediSpan` :6591, `oneHitDamage` :6632) run from `knockOffArms`/`damageInterior` at top level, **after** the games loop (:7435-7441). `midEventDice` is made fresh per game (:1874) | no, because games run one at a time |

## 6. Row text (not written; the brief forbids editing existing files)

**`docs/RUNNING-NOTES.md`:**
> Interleave independence measured (SEARCH, 2026-09-11). Two live MEDICHAM battles stepped
> alternately, turn by turn, end identical to the same battles stepped in sequence: 0 differences in
> state, protocol, result or counters over 768 battle comparisons (release `2b5a6585d8cf`, pinned pool,
> 48 positions; the check was shown red first on two scratch-copy leaks). One module variable leaks
> between BUILDS: `_FAINT_EPOCH` makes `battleResult` on a double wipe read 0.5 after any later
> `battleInit` (43 of 43 constructed, 1 of 1 natural; 1 natural double wipe in 1,824 random
> playouts). `MID_NTH` leaks between event-dice battles on one seed (the differential's instrument
> only). Nothing today is affected, because every caller reads the result before building again.
> Artifact `data/verification/interleave-2026-09-11/interleave.json`.
> **Supersedes.** Nothing. **Basis.** unchanged. Fold-in owed: `docs/SEARCH.md` and `docs/MILTANK.md`
> (the tree-search precondition), `docs/ENGINE.md` (the filing below).

**`docs/ENGINE.md`, filing (SEARCH does not fix engine bugs):**
> **`_FAINT_EPOCH` is process-global, so a double-wipe result expires at the next build.** Filed by
> SEARCH, 2026-09-11.
> - `battleInit` bumps `_FAINT_EPOCH` (release `2b5a6585d8cf` :25639; live :25742).
> - `lastFaintSeq` (:25635-25637; live :25738) counts a faint only if its `_fEpoch` equals the
>   CURRENT epoch.
> - So `battleResult` on a mutual wipe is right only until any other battle is built.
>
> Measured on 43 of 43 constructed double wipes: each reads its winner immediately and 0.5 after one
> unrelated `battleInit` (`MEDFAILS.doubleWipeNoFaintOrder` +43). Re-reading with nothing built
> changes none. No caller today crosses a build between the finish and the read; a tree search would.
> A possible shape: record the epoch on `S` at `battleInit` and compare against that rather than the
> module variable. Re-run owed: see the report's OWED section; expect `after_one_build_differs: 0`.
>
> **Lower priority: `MID_NTH` (:26472; live :26583) carries no battle identity.** Two `midEventDice`
> battles on one seed, stepped alternately, share repeat indices, and 48 of 96 self pairs diverge.
> `game_differential` plays one game at a time and is unaffected. Moving the map into the closure
> that `midEventDice` returns would make it per-battle.

**`docs/SEARCH.md`, open work:**
> Tree-search precondition. Stepping live MEDICHAM battles turn by turn is safe (0 of 768,
> `data/verification/interleave-2026-09-11/interleave.json`). Before any search keeps nodes alive:
> - read `battleResult` at the moment a node finishes, never later, until ENGINE makes `_FAINT_EPOCH`
>   per-battle;
> - never share one event-dice seed across battles stepped alternately.

**`CHANGELOG.md`:**
> Added: the interleave-independence bench and its artifacts (`data/verification/interleave-2026-09-11/`).
> No published figure moves, so this is a PATCH.

The `_FAINT_EPOCH` defect has no register row, so a ROADMAP row is owed; whether to open one is the
coordinator's call. `node engine/status.js --write` was not run, because it rewrites existing ledgers
and the brief forbids editing existing files.

**One harness change after the run:** `--red-out-dir` was added so that a re-run cannot overwrite
`red-*.json`. Its default is the folder this run wrote to, so this run's command reproduces
unchanged.

## OWED, NOT RUN

**The re-run after ENGINE makes the epoch per-battle and cuts a release `<id>`.** It uses the same
sample and new files, and the red is shown again. Expect `double_wipes.struggle_fixture.after_one_build_differs: 0`
and every block in 3a unchanged:

```bash
cmd //c "tools\lownode.cmd data\verification\interleave-2026-09-11\bench_interleave.js --release <id> --games 16 --seeds 2 --full-seeds 2 --dw-seeds 6 --out data/verification/interleave-2026-09-11/interleave-<id>.json --red-out-dir data/verification/interleave-2026-09-11/red-<id>"
```

**This run's exact command**, which reproduces the artifact. The red children write
`red-dice.json` and `red-trace.json` beside it:

```bash
cmd //c "tools\lownode.cmd data\verification\interleave-2026-09-11\bench_interleave.js --games 16 --seeds 2 --full-seeds 2 --dw-seeds 6"
```

**The restamp**, once the coordinator folds in the rows:

```bash
node engine/status.js --write
```

**Not built, so no command:**
- a targeted fixture for the `TRACE` singleton's per-sink fields (`_mvLine`, `_pendRedir`, `drag`);
- the reason 5 of the 48 Struggle fixtures did not wipe both sides.
