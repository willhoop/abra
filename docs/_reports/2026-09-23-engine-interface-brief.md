# MEDICHAM solver interface — ENGINE brief (2026-09-23)

Historical findings record; not maintained, superseded by the register rows it feeds.

**Status: a brief, not a change.** Nothing was run. No node, no python, no git: another session was
editing the engine. Every `file:line` below was read from the LIVE tree on 2026-09-23. The live file
is moving, so re-grep the symbol before you trust a line number. Figures quoted from other reports
name those reports.

**When: after the Reg M-C gate work closes.** Every step below is ordered so that a gate stays
byte-identical until the one step that cannot avoid touching a turn (step 6). That step goes last.

---

## 0. Verdict

- Most of the API is a **wrapper over code that exists already**. `battleInit` / `battleTurn` /
  `battleOver` / `battleResult` / `playerAction` / `rngStreams` / `midEventDice` / `switchTrapVerdict`
  / `canMegaNow` are exported. `rollout_leaf.runPlayout` already plays out from a live `S`.
- **Sequential stepping of several live battles in one process is already proven independent.**
  `docs/_reports/2026-09-11-interleave.md`: 0 differences in 768 comparisons. The one real leak it
  found, `_FAINT_EPOCH`, was made per-battle since then (`medicham2-browser.js:29922-29947`).
- **Three real gaps:**
  1. **No clone.** Nothing is exported that copies a battle, and `battleTurn` mutates `S` in place
     (`:32005`).
  2. **Mid-turn decisions are pre-committed, not asked.** The faint replacement comes from
     `S.replaceWith` (`:53262`) and the pivot target from `action.pivotTo` (`:50717`); the default
     is `live(bench)[0]` (`bringIn`, `:28449`). Showdown stops and asks at both moments
     (`game_differential.js:4059-4075`).
  3. **`battleOver` mixes up two questions.** It treats a horizon cap as the end of the game
     (`:30926`, default `maxTurns` 20). `battleResult` then scores the HP fraction at the cap
     (`:53655-53669`).
- **Rule for the whole brief: no parallelism inside one isolate.** Parallelism means worker
  processes, each with its own copy of the module.

---

## 1. The state object

### 1.1 What `S` contains today (`battleInit`, `:30699-30780`)

| Field | What | Note for clone |
|---|---|---|
| `S.field` | `weather, weatherT, terrain, terrainT, twA, twB, tr, gravity, fairylock, sgA{}, sgB{}` + later additions | plain data |
| `S.sfA`, `S.sfB` | side objects: `fainted`, `side`, `sc{}` (screens/hazards), `team[]`, `megaUsed`, `_S` | **`sfX._S === S` is a cycle** (`:30727`) |
| `S.actA/actB`, `S.benchA/benchB` | arrays of **body objects** that are shared by reference with `sfX.team` | aliasing must be kept: the engine finds bodies with `indexOf` (e.g. `canMegaNow`, `:26771`) |
| body `m` | `curHP, st, boosts, moves, item, ability, fainted, _sf` (back-pointer to its side, `:30728`), dozens of `_`-prefixed volatiles, e.g. `_seededBy` (**a body reference**), `_charging`, `_ttmTgtSlot`, `_encoreMove`, `_sealed`, `_perish`, `_fEpoch`, `_faintSeq`, `_leftEpoch`, `_rtieGen` | graph, not a tree |
| `S.turn`, `S.maxTurns`, `S._autoMega`, `S._faintEpoch`, `S._leadSnap`, `S.replaceWith` | control | `replaceWith` holds body references |
| `S._trace` | the caller's protocol sink (`:30746`) | **exclude from a clone**. It is an I/O handle, not state |

`buildMon` copies its table rows (`m.t.slice()`, `{...m.st}`, `:12711-12716`). The 2026-09-11
clone-cost bench found no object shared with `MC`, but only on the rebuild path it measured
(`2026-09-11-clone-cost.md` §2). A body that mega-evolves mid-battle was not in that sample. The
clone test (§4 T1) must include post-mega positions.

### 1.2 Module-level variables a battle writes (live-tree lines)

Classes as in the interleave audit (`2026-09-11-interleave.md` §1). "Safe" means proven safe for
**sequential** stepping of interleaved battles. None of these is safe under re-entrancy.

| Class | Variables (`medicham2-browser.js`) | Status |
|---|---|---|
| "Current battle" pointers, re-assigned at every `battleTurn` entry (`:32017-32027`) and in `battleInit` (`:30740-30745`) | `MID_S, MID_TURN, MID_MOVE, MID_TGT, MID_ATT` `:31610`; `MED_RNG` `:27869`; `MED_TIE_RNG` `:27878`; `ACTION_PROMOTED` `:18533`; `_FAINT_EPOCH_ACTIVE` `:29922`; `TR` `:5598` (rebound by `traceBind` `:6284`) | safe sequentially |
| Per-turn scratch, cleared at the turn's exits | `ENCORE_Q` `:21742`; `TTM_INFLIGHT` `:31674`; `_FAINTQ` `:30487` (a leftover is counted at `:30701`); `PIVOT_DEPTH` `:29219`; **`ELEC_CHG_INFLIGHT` `:31703`: newer than the 09-11 audit, NOT AUDITED** | safe, except `ELEC_CHG_INFLIGHT` is unproven |
| Monotonic stamps. Only their order or equality is read | `TURN_EPOCH` `:5603` (compared with the body stamp `_leftEpoch`); `_RES_TIE_GEN` `:11832`; `_VOL_SEQ_N` `:12240`; `_FAINT_SEQ` / `_FAINT_EPOCH` `:29922`; `_RES_SHADOW_GEN/RANK/LIST` `:12376` | Safe, and **safe for clones too**: a stale stamp copied from a parent can never equal a later process value, and ordering inside one battle is kept. A state digest must **rank-normalise** these (the interleave bench already does). |
| **LEAKS: instrument** | `MID_NTH`, `MID_LOG` `:31611-31612`. Repeat counts are keyed on `seed/turn/cat/move/target` with no battle identity, and cleared only by `midEventDice()` (`:31805`). | Two battles on one event-dice seed share the counter: 48 of 96 self pairs diverge (interleave report). **Tree search with keyed dice hits this at once.** |
| **LEAKS: trace singleton fields** | `TRACE.drag` `:5666`, `TRACE._pendRedir` `:5683`, `TRACE._mvLine` `:5693`. `traceBind` (`:6284-6290`) does not reset them. | Only matters when a trace is bound. Narration only. |
| Config, set by a caller | `PURE_PRIORS` `:20382`; `TRACE_LIST_SINK` `:27890`; every `MEDI_*` environment knob, read at load (e.g. `:29940`) | Workers must inherit **identical** environment variables, or they are running different engines. |
| Process counters | `MEDSEEN` `:90`, `MEDFAILS` `:3484` | Write-only. Get a per-battle figure by diffing snapshots. Never copy them into a clone. |
| Pure lazy caches of static data | `_TPTH, _prioBar, _forbidVol, _volNoRestart, _volRetype, _volDur, _volPTHP, _volPTB, _volOneTurnSurv, _volGuarantee, _volExposed, _volEmptySlot, _PSCOPE, _layTab, _critVolTab, _SGRATE, _MEGA_INTO, _MONIDX, _mvIdsStamped, _impSeal, _FX, _RES_TERRAIN_KEY` (`:6474-13120`, `:20463`, `:22001`, `:12046`) | harmless |

### 1.3 Proposal: a battle as a self-contained value

**Do not refactor the 54k-line file off its globals.** That is a rewrite of every call site. It is
not needed, because the globals are already re-loaded from `S` at every turn entry. Do three small
things instead:

1. **Move the per-battle instrument state onto `S`.** At `battleTurn` entry, swap in `MID_NTH` and
   `MID_LOG` from `S._midNth` / `S._midLog`, and write them back at every exit. `_trPrev` at
   `:32032` already does this save/restore for the trace. The dice are then a pure function of
   (battle history, seed), which is what a chance node needs.
2. **Reset `TRACE.drag/_pendRedir/_mvLine` in `traceBind`.**
3. **Refuse re-entrancy loudly.** Add a module flag `_IN_TURN`. If `battleTurn` is entered while it
   is set, count `MEDFAILS.reentrantTurn` and throw. The contract becomes: **one battle steps at a
   time per isolate, and many may be alive.** That is exactly what the interleave bench proved.

The RNG stays **outside** `S`. It is a function, it cannot be cloned, and the caller must own it
anyway so that a cell's dice can be shared across actions (turn-search report §3.3).

---

## 2. The API: new file `engine/medicham_api.js`

It is a module **beside** the engine, not inside it. Everything below is a wrapper, except where it
is marked "ENGINE EDIT".

```js
const A = require('./medicham_api.js');   // loads THE SAME medicham2 instance the caller uses

A.makeRng(seed)                 // -> { any, tie, ... } via rngStreams(:31505) over mulberry(seed)
                                //    (rollout_leaf.js:511 -- export it, do not copy it)
A.makeEventDice(seed)           // -> midEventDice({seed}) (:31802), keyed dice for chance nodes

A.clone(S)                      // -> independent deep copy (see 2.1)
A.legalActions(S, side)         // -> { kind:'move'|'switch'|'wait', slots:[...], joint:[...] } (2.2)
A.step(S, jA, jB, rng)          // -> NEW state; S untouched   = clone + stepInPlace
A.stepInPlace(S, jA, jB, rng)   // -> S; for playouts only
A.isTerminal(S)                 // -> sideWiped(S)  (:30922), NOT battleOver
A.atHorizon(S, cap)             // -> S.turn >= cap
A.winner(S)                     // -> 1 | 0 | null(not terminal); double wipe via the last-faint rule (:53658-53665)
A.horizonScore(S)               // -> battleResult(S), labelled as the HP heuristic it is
A.digest(S)                     // -> sha of canonical JSON: _trace dropped, stamps rank-normalised
A.publicSignature(S, side)      // -> digest over what that side can observe (chance-node/belief key)
A.playouts(S, jA, jB, n, {policy, cap, seedBase})   // -> {wins, n, counters}
```

### 2.1 `clone(S)`

- Implement it as `structuredClone` over `S`, with `_trace` removed and put back after.
  `structuredClone` keeps cycles (`sfX._S`, `m._sf`) and shared references (`actA[i] === sfA.team[j]`,
  `_seededBy`, `replaceWith`) inside the copied graph. That is the exact property the engine's
  `indexOf` lookups need.
- It throws `DataCloneError` on a function-valued field. If one exists, find it with the test in §4
  and move it off the state. Do not paper over it with a hand-written walker.
- Cost: unknown for `structuredClone`. The only measured copy is the **rebuild** path, at about 0.3×
  one turn (`2026-09-11-clone-cost.md`). Measure it under the photograph rule before a search is
  sized on it.

### 2.2 `legalActions(S, side)`

The encoding is **Showdown choice strings** per slot (`move 2 -1 mega`, `switch 4`, `pass`). One
spelling serves the solver, the live bot and the request-JSON test. The translation to MEDICHAM
actions is the one in `game_differential.js:5119-5155` (`mk`: `playerAction` + `.mega = true` +
`{kind:'switch', to}` + `aimBody`). **Extract it to `engine/choice_map.js` and have the differential
call it.** Facts are global: a second copy of target resolution is the defect class CLAUDE.md names.

Per active slot, built only from rules that already exist:

| Part | Source |
|---|---|
| move menu | `selectableMoves(m)` `:20732` (ENGINE EDIT, export only: it is not exported today); Struggle when `mustStruggle(m)` `:20746` |
| locked / charging | `m._charging` means one forced action (`:32311`); `_mtLock` and `lockMenuMove` are inside `selectableMoves` |
| targets | from the move's `target` class: `AIM_BY_LOC` `:9214` needs a target; `DEFAULT_TARGET_SELF` `:31072` and spread moves take none; an ally target is valid only for `adjacentAlly*` |
| switch | live bench bodies, minus trapped: `switchTrapVerdict(m, foes, field)` `:20249` |
| mega | `canMegaNow(S, m)`. **There are two declarations, at `:26528` and `:26767`; the later one wins by hoisting.** Delete one only after a diff shows the bodies are identical. |

Joint constraints: two slots may not switch to the same body; at most one mega per side; an empty or
fainted slot gets `pass`. `kind:'switch'` is the forced-replacement request (see step 6);
`kind:'wait'` is the side with nothing to choose.

### 2.3 `step` and the mid-turn decisions

`step` is `clone` + `battleTurn(T, rng, mapA, mapB)`, with `mapX` built by `choice_map`. **Version 1
keeps the pre-commit model.** A joint action may carry `replaceWith` and `pivotTo`, which the engine
already reads. Version 2 (ENGINE EDIT, step 6) adds a synchronous callback,
`S._decide(kind, side, slot, options) -> choice`, called exactly where the engine now reads
`S.replaceWith` (`:53262`) and `a.pivotTo` (`:50717`). With no callback, the old behaviour stands
byte for byte. This makes the solver's information set at a replacement equal Showdown's pause
point. The pre-commit model cannot, because it answers before seeing who fainted.

### 2.4 `playouts` and workers

- `playouts` = n × (`clone(S)` → `stepInPlace` with the given first joint → `rollout_leaf.runPlayout(T,
  rng, explore, foePolicy, counters, switchRate)` `:834`). `runPlayout` already takes a live `S`, so
  no Board re-seed is needed.
- Workers are **`child_process` workers, long-lived, launched through `tools/lownode.cmd` via
  `cmd.exe /c`**. Each one `REL.require`s the same frozen release and the same regulation
  (`engine/regulation.js`), with the same `MEDI_*` environment. Messages carry
  `{S (structured-clonable), jA, jB, n, seedBase}` and return summed results plus the counter diff.
- Size: 8–10 workers on this machine, a few hundred MB each (learning report). Warm each worker past
  the tier-up (about 4,000 playouts, `data/medicham-speed.json`) before timing anything.

---

## 3. Building `S` from an observed Showdown battle (live play)

**Keep one protocol parser.** `board.js`'s `Board` (`class Board` `:583`, `setSheet` `:976`) is fed
the live stream by `magnemite.js` (`|showteam|` at `:607`). Its field order matches
`durable-ingest.js` on purpose. Do not write a second parser.

`A.fromBoard(board, side, world, {request})` is a factoring of what the leaf already does inline in
`rolloutWinProb` (`rollout_leaf.js:1242-1330`):
`buildSide` ×2 (`:359`) → `battleInit(A, B, {seeded:true})` → `applyField` (`:1225`),
`applySideState` (`:1037`), `applySpeedClocks` (`:1153`), `applyFieldClock` (`:1182`),
`applyMegaWeather` (`:588`, **not exported, so export it**) → `checkFallenSeeded` (`:479`).

- **Our side: OBSERVED over DECLARED.** The `|request|` JSON gives exact stats, HP, PP, the current
  item and the current ability. Use it in place of sheet + priors.
- **Their side: open sheet** (species, item, ability, moves, nature), plus `world` = one sampled SP
  spread and any hidden-state hypothesis. Champions sheets publish the nature, not the SP.
- **Known losses, declared and not hidden:** `unseededVolatiles()` (`rollout_leaf.js:274-289`):
  substitute HP, the Leech Seed source, and Perish (off by one). `fromBoard` must return this list
  with the state. A search node built on a position with one of these active is flagged, not trusted.

The long-term fix, a state built from the protocol with no loss, is out of scope here. Do not invent
the numbers the protocol does not state.

---

## 4. Acceptance tests

All of these run on a **frozen release, a census pin and `--team-store data/team-pool-frozen`**,
through `lownode`, with the `--games` value recorded. Each is **shown red on a deliberate break
first**.

| # | Test | Pass | Red demo |
|---|---|---|---|
| T1 | **Clone round trip.** For the 48 positions of `data/verification/clone-cost-2026-09-11/bench_clone.js`, plus post-mega and mid-charge positions: step `S` and `clone(S)` on the same `makeRng(seed)` for 3 turns and to the end. | `digest` equal at every turn; the protocol equal; the ORIGINAL unchanged after playing the clone (the M1 check) | a shallow `{...S}` copy must fail |
| T2 | **No cross-battle leakage.** Re-run the interleave arms A0–A3 (`data/verification/interleave-2026-09-11/bench_interleave.js`) through the API, plus a double-wipe `winner` read after an unrelated build, plus two same-seed event-dice battles stepped alternately. | 0 differences, **including the `MID_NTH` case** that fails today | `MEDI_FAINT_EPOCH_GLOBAL=1` must fail the double-wipe arm; per-battle `MID_NTH` reverted must fail the dice arm |
| T3 | **`legalActions` agrees with Showdown's request.** Inside the differential's game loop, at every request, derive the legal choice set from `side.activeRequest` (`moves[].disabled`, `canMegaEvo`, `trapped`, `forceSwitch`) and compare it with `legalActions(S)`. | exact set equality per slot. `maybeTrapped` is hidden information: declare it and count it separately | force `canMegaNow` to true and it must fail |
| T4 | **`step` agrees with the differential.** Run `game_differential.js` with the `M.battleTurn` call at `:5161` routed through `A.stepInPlace`, then through `A.step(A.clone(S))`. | byte-identical per-game protocol and board, and the same board-material count, at `--games` 1200/1350/1950 against the same run without the API | drop one field from the clone and T4 must show it |
| T5 | **Determinism across processes.** The same `S`, joint and `seedBase` in the main process and in a worker. | identical `playouts` result and counter diff | a worker with a different `MEDI_*` environment must differ |
| T6 | **Capability counters.** `clones`, `steps`, `decideCalls`, `workerPlayouts`. | printed every run; a zero fails `tests/test-wiring.js`-style | — |

T4 is also the proof that step 6's default path is unchanged. Run it before and after that edit.

---

## 5. `engine/engine_release.js` `SOURCES` (`:101-184`)

Add each file **in the commit that lands it**, because each one changes a number:

- `engine/medicham_api.js`
- `engine/choice_map.js` (the extracted `mk`)
- `engine/playout_worker.js` (the worker entry)
- `engine/board_state.js`, only if `digest` / `publicSignature` read `readMedi` (`board_state.js:1568`).
  Preferred: they do, so one canonical board exists.

`board.js`, `rollout_leaf.js`, `regulation.js` and `pp.js` are already listed. **Do not add a new
engine symbol to any existing caller's `need:` list** (for example `game_differential.js:532-535`).
That strands every earlier release (CLAUDE.md, LESSONS §12). Use `want:` and branch on presence, or
check it with `engine_release.js compat`.

---

## 6. Risks to existing gates and the smallest safe order of work

**Risks**

- **Any byte change to `medicham2-browser.js` changes every future release id.** That is expected.
  Export-only edits must not move an RNG call. Prove it with T4.
- **The `_decide` callback (step 6) is the only edit inside a turn.** With no callback it must be
  identical. If it is not, it moves the differential, the roster and `quarantine.js` at once.
- **Moving `game_differential.js` onto `choice_map.js`** changes the instrument. That is the
  "suspect the instrument" trap. Land it alone, and show the differential byte-identical at all three
  lattices.
- **A torn read.** Do not read `data/game-differential.json` while T4 is writing it. Use per-run
  output paths.
- **Worker environment drift.** A `MEDI_*` knob set in the parent and not in a worker is a different
  engine. Stamp the environment into every artifact.
- **Deleting a duplicate `canMegaNow`** is safe only if the two bodies are identical. Diff them first.
- **Everything is still downstream of MEDICHAM's Reg M-C correctness.** An API test that passes
  certifies the API, not the game.

**Order. Each step is its own commit, and T4 is re-run after each engine edit.**

1. **Wait for the Reg M-C gate to close.** Cut a release as the baseline, R0.
2. **Export only** (ENGINE EDIT, PATCH): `selectableMoves`, `mustStruggle`, `sideWiped`; from
   `rollout_leaf`: `mulberry`, `applyMegaWeather`. No behaviour change. Show it with T4 against R0.
3. **`medicham_api.js`, version 1** (no engine edit): `makeRng`, `clone`, `step`/`stepInPlace`,
   `isTerminal`/`winner`/`horizonScore`, `digest`, `fromBoard`. Add it to SOURCES. Tests T1, T4, T5.
4. **Per-battle `MID_NTH`/`MID_LOG`, the `traceBind` reset and the `_IN_TURN` guard** (ENGINE EDIT,
   small). Test T2. Differential at the three lattices.
5. **`choice_map.js` extracted; `legalActions`.** Test T3. The differential is switched to
   `choice_map` in its own commit, with a byte-identical check.
6. **The `_decide` callback for replacements and pivots** (ENGINE EDIT, highest risk, last). T4 with
   no callback must match R0 byte for byte. Then T3 is extended to `forceSwitch` requests.
7. **Workers and `playouts`.** Test T5 and T6. Measure the clone cost and the tier-up in a worker
   under the photograph rule before any search is sized.
