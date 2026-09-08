# THE OPTIMISATION QUEUE — parked until MEDICHAM is correct

**Will, 2026-09-08: *"lets just get medicham updated before we go optimizing."*** This page exists so
that decision does not quietly become a lost list. Nothing here is work in progress; it is work
DEFERRED, with the measurement that motivates it recorded beside it so the next session does not have
to re-derive the case.

**Two measurement passes were already in flight when the call was made and were allowed to finish**
— they measure, they change nothing, and stopping them would have wasted the runs:
`docs/_reports/2026-09-08-speed-regression-bisect.md` and `docs/_reports/2026-09-08-decision-profile.md`.
**No optimisation work follows them until the gate opens.**

---

## WHAT IS MEASURED, AND WHAT IS STILL AN ASSUMPTION

| | measured |
|---|---|
| MEDICHAM | **1,482 turns/sec**, 134 whole games/sec |
| Showdown, raw `Battle` | **375 turns/sec**, 33.7 games/sec — ratio **3.94x** |
| Showdown, its DOCUMENTED interface (`BattleStream` + `RandomPlayerAI`) | ratio **16.1x** |
| what 20 s of decision budget buys today | **~15 leaf calls** on MEDICHAM, ~4 on Showdown |
| what Will wants | **thousands** of rollouts — roughly **130x** short |
| ~~the direction of travel~~ | **WITHDRAWN 2026-09-08 — see below. There is no measured slowdown figure.** |

Method: 12,000 games per engine, arms INTERLEAVED in one process so contention hits both equally, 8
contention-free reps spanning 3.75-4.07, noise floor 0.3%/2.7%, release `fb0058fb5702`, Showdown
`20ad99ff`. Full account: `docs/_reports/2026-09-08-engine-speed-comparison.md`.

**SHOWDOWN DID NOT GET FASTER. WE GOT SLOWER** — about **8.8x** of MEDICHAM's throughput spent while
the correctness work landed, with only the mechanics count on the status board.

**AND THE PREMISE UNDER ALL OF IT IS NOT YET TESTED.** Whether search is engine-bound at all is what
the decision profile answers. If a decision's time goes into board evaluation, feature construction or
policy inference rather than into playing turns, **a ten-fold faster simulator buys almost nothing**
— Amdahl, and the exact shape of "optimising the wrong half" this repository already has a rule about.

---

## THE QUEUE, ranked by measured value

### 1. Recover the 8.8x — the largest number on the table, and it is a REGRESSION
Not optimisation: throughput nobody was watching. The bisection attributes it across ~590 frozen
releases and splits **INSTRUMENTATION** from **MECHANICS**. The split is the whole decision:
- cost paid to make the engine PROVABLE — above all the shared dice addressing, which builds a string
  key per draw so both engines can be shown to have thrown the same coin — is a candidate to **strip in
  a play build and keep in the differential**;
- cost paid because the engine now models the game CORRECTLY is **not recoverable and must not be
  chased**.

### 2. Threads — one core of sixteen is in use
Rollouts are independent by construction. `worker_threads` or Web Workers is a scheduling change, not
an engine change. **Worth ~10x — but it favours nobody: Showdown could be threaded too.**

### 3. Shorten the rollout — probably the biggest lever, and it is NOT an engine change
A rollout plays to the end, mean ~11 turns. Standard practice is to play 3-4 turns and evaluate the
position. **That is PORYGON2's job**, so the ceiling here is whether the value function can be trusted
at shallow depth — an accuracy question needing its own experiment, not an assertion.

### 4. Out of the browser
Browsers throttle unfocused tabs, which is precisely when search would be thinking. Node does not, and
a tab's memory ceiling is lower. Pairs naturally with threads. **No JIT gain — Chrome and Node are both
V8, and an Electron wrapper is V8 again.**

### 5. A native rewrite — LAST RESORT, and only on evidence
`pkmn/engine` reached ~1000x over Showdown in Zig, but for **RBY/GSC**, and it rules format MODS out by
design, so it is not available for this format at any speed. A rewrite means re-proving 43,506 lines
against the same differential. **Do not open this without a measured bottleneck that nothing above
fixes.**

---

## TWO JUDGEMENT CALLS FOR WILL, NOT CHORES

- **Strip the dice instrumentation in a play build?** It is what makes the differential possible and it
  may be most of the 8.8x. Splitting play from proof is an architecture decision.
- **Is search engine-bound at all?** If the profile says no, items 1, 2, 4 and 5 are all aimed at the
  wrong half and the real work is somewhere nobody is looking.

---

## ALSO PARKED HERE, adjacent and cheap

- **`pokemon-showdown@0.11.11` on npm ships the Champions mod** (published 2026-07-28). Switching the
  oracle from a built master checkout to a published version costs one `npm install` and makes the
  oracle IMMUTABLE rather than a checkout pinned by convention. **Blocked on one check**: 7 of 8 mod
  files are byte-identical, `formats-data.js` differs, and nothing may switch until the LEGAL SETS are
  proven identical.
- **The 24.9x figure is dead** and stands in three living documents. It is a retraction, not a caption,
  and it is being handled now rather than parked.


---

## MEASURED AFTER THIS PAGE WAS FIRST WRITTEN — the premise held, and two figures died

**The decision IS engine-bound, decisively.** One real `chooseMove` at the shipped `n=200`/`budgetMs=20000`:
simulator + its lookup layer **87.2-92.0%** of self time; leaf inclusive **99.3-99.5%**; `battleTurn`
**77.2-83.7%** on an independent wall-clock seam. **`magnemite.js` (MAG) 0.0%. `position_features.js`
0.0%.** So the engine is the right target and the policy is not even measurable — Amdahl was the right
question and it came back the other way. `docs/_reports/2026-09-08-decision-profile.md`.

**TWO FIGURES THE COORDINATOR PUT IN FRONT OF WILL ARE WITHDRAWN:**
- **"20 s buys ~15 rollouts"** — those were leaf CALLS, and a call at `n=200` is 200 playouts. The real
  figure is **534-5,277 playouts** per decision. Thousands of rollouts already exist.
- **"we got 8.8x slower"** — see above. Never a measured quantity.

**WHAT REPLACES THEM AS THE REAL FINDING: menu coverage, not throughput.** On the slow decisions the
screen evaluated **2 of 30 legal pairs** before its allowance ran out, because `screenN` keys off MENU
WIDTH and never off OBSERVED PLAYOUT COST. **No amount of engine speed removes that.** It is a
scheduling defect and it was invisible while everyone argued about the simulator.

**Revised ranking, by measurement:**
1. **Memoise the tag layer** — 24.6-27.1% of self time; `norm` alone 8.7-10.3%, and `withTag` is a full
   table scan. ENGINE.
2. **Hoist `applySideState`'s four per-playout table rescans** — 4.2-10.0%, identical every playout. SEARCH.
3. **Threads** — serial fraction under 3%, Amdahl ceiling ~50x, so 8-10x is real.
4. **Fix `screenN`** so the candidate count reacts to observed cost. This is the one that changes what the
   search actually considers.

**Rollout-length lever is smaller than claimed: 1.89x at depth 4, 2.38x at depth 3, not 3x** — mean
playout is 8.28 turns against a census-derived horizon of 14 (NOT the 60 in `MILTANK.md`'s flag table),
and 9.0% of a playout is fixed setup. **The accuracy cost is NOT measured**: `battleResult` scores an
unfinished playout on living bodies then HP, so depth 3-4 makes the leaf a material comparator. That is
MEASURE's calibration question and must not be assumed away.

**Three defects filed by the profile, not fixed:** a frozen release **cannot serve `rollout_leaf.census()`**
— the census JSON is not in `SOURCES`, so a snapshot-path load silently plays a SWITCHLESS playout at
horizon 60 **and reports success**; `miltank.js` seeds `evalPair` from `Date.now()`, so a decision cannot
be replayed; and `budgetMs` overran to 2.1x (26.9-42.8 s against a declared 20 s, under a 55 s cap).


---

## THE BISECTION LANDED — and it refuted the coordinator's hypothesis outright

**47 release points, 470 timed legs, 5 passes, noise floor 7.3%.**

**The 8.8× is dead for a second, independent reason.** Its 2026-08-06 endpoint has a **same-day sibling
disagreeing by 4.06×**: one release records 3,212 turns/sec at **2.0 turns/battle**, another five hours
later records 13,041 at **60.1 turns/battle** — every battle running to the cap. Today's engine plays
10.1 turns and finishes **100%** of games. **Three different populations of "a turn."**

**What IS measured: 2.19× slower since 2026-08-12.** Three instruments sharing only the pool agree —
curve 2.19×, uncontended 400-playout probe 2.15×, CPU profile 1.96×. Extrapolating across the
unopenable window gives **~6.0×** since 2026-08-06, not 8.8×.

**AND THERE IS NO STEP TO FIND.** Biggest interval step **+11.2%** across two commits against a 7.3%
floor; three of the top six sit inside the floor. `log(cost) = 0.945·log(non-comment bytes)`, **R² 0.934,
n=47.** Cost arrives at **one unit per unit of code** — there is no single bad commit, and looking for
one is looking for something that does not exist.

**THE COORDINATOR'S LEADING HYPOTHESIS IS REFUTED.** The shared dice addressing — string key, repeat
map, FNV+fmix — is built by `game_differential.js` **for the middle arm and never runs in `runPlayout`**,
which hands `rngStreams()` a plain function and takes the back-compatible path. The play path pays only
the field writes: **12.7 ms of 1,745 = 0.73%.**

**So "strip the instrumentation in a play build" is worth +9%, not a step change.** Counters
(149.6 `MEDSEEN` + 1,454 `tags.ASKED` + 1,491 `tags.COUNT` per turn at 17 ns) = **7.2%**; address writes
and trace = **1.2%**. Strip both and today's 1,365 turns/sec becomes ~1,490. **The other ~90% is the game
being modelled and is NOT RECOVERABLE.** The three mechanics suspects are confirmed: residual family
**13.7% of the rise**, `dmgRangeOneHit` **2.37×**, `effSpeed` **3.42×**.

**ONE REAL LEVER SURVIVES, AND TWO INDEPENDENT MEASUREMENTS POINT AT IT.** `engine/tags.js` is **15.7%
of engine self-time at 1,454 lookups per turn**, and `norm()` — an uncached `toLowerCase()` plus regex
strip on every one — is **5.6% of the whole engine**. The decision profile found the same thing from the
other end (tag layer 24.6–27.1% of self time, `norm` 8.7–10.3%, `withTag` a full table scan). **Neither
instrumentation nor mechanics: just an uncached hot path.**

**Stranded: 172 of 599 releases** refuse to open (pre-2026-08-12, missing `spreadL50`/`rngStreams`), 4
carry no bytes, 1 is rot. **The window holding both disputed figures is unmeasurable with today's
instrument** — which is why the 8.8× can be refuted but not replaced.

### The queue, as measurement leaves it
1. **Memoise the tag layer** — the only lever both instruments agree on. ENGINE.
2. **Fix `screenN`** so candidate count reacts to observed playout cost — 2 of 30 legal pairs evaluated
   is a scheduling defect no engine speed touches.
3. **Threads** — serial fraction under 3%, 8–10× real.
4. **Hoist `applySideState`'s four per-playout rescans** — 4.2–10.0%, identical every playout.
5. ~~Strip instrumentation~~ — **+9%. Not the architecture decision it looked like.**
