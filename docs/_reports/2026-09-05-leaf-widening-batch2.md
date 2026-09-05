# Leaf widening batch 2 — Lock-On, Minimize and No Retreat now reach the board comparison

2026-09-05. ENGINE. Release **`6f96db9da019`**, cut over the tree these three wirings are in.
Measurement: `data/verification/leaf-widening-batch2.json` (`--write --out`;
`data/game-differential.json` was **not** touched and still holds the published figure on release
`0dec37ff5ad9`).

---

## Headline

| | before | after |
|---|---|---|
| **leaves compared / comparable at this boundary** | **37 of 56** | **40 of 56** |
| standing at the boundary and NOT compared | 19 | **16** |
| **board-material** (`state.first_board_divergences.length`) | **35** | **35** |
| protocol (`diverged`) | 120 | **120** |
| VOID (`mid_void.void_games`) | 4 | **4** |
| games | 961 | 961 |
| threw | 1 | 1 |
| end state DIFFERENT | 17 | 17 |
| census | 829 live / 829 probed / 0 missing | **829 / 829 / 0** (re-derived after EACH of the three) |
| quarantine gate | 2 of 9 failing (found shape) | **2 of 9 failing** |

**The scoreboard was called in writing before the run**
(`data/verification/2026-09-05-leaf-widening-batch2-prediction.json`, written 03:30Z, run started
after it): board-material 35, protocol EXACTLY 120, VOID EXACTLY 4, games EXACTLY 961.
**Four of four landed exactly**, including the two that were predicted with a zero-width range
precisely so that a miss would be unambiguous.

---

## 1. THE NINETEEN, RE-DERIVED FIRST — the previous list had moved

`tests/probe_uncompared_leaves.js` on the tree as found, 2026-09-05:

```
POPULATION  500 moves, 201 abilities carried by a legal species, 148 items
LEAVES THEY WRITE   80      COMPARED 37   DECLARED 4   NEITHER 39
Of the 39: 18 carry duration 1 (ended in the residual, sim/battle.ts:1097-1115)
            2 remove themselves inside their own action (volatile:fling, volatile:sparklingaria)
           19 CAN BE STANDING when this comparator reads a turn boundary
```

The nineteen, in the probe's own order:

```
volatile:lockedmove        pseudoWeather:gravity      pseudoWeather:magicroom
pseudoWeather:wonderroom   slotCondition:futuremove   slotCondition:healingwish
slotCondition:wish         volatile:allyswitch        volatile:dragoncheer
volatile:gastroacid        volatile:lockon            volatile:metronome
volatile:minimize          volatile:noretreat         volatile:powershift
volatile:powertrick        volatile:smackdown         volatile:stockpile
volatile:unburden
```

`throatchop`, `mustrecharge` and `flashfire` are **gone from the list**, which is the check that the
re-derivation is live rather than remembered — they were wired earlier the same night and the list
shrank by exactly those three.

**The previous batch's guess at the next three cheapest was `lockon`, `minimize`, `noretreat`, and it
verified.** Those are the three of the nineteen this engine already keys under the **authority's own
spelling** in `_vol` (`ours_vol: yes` in the probe's own column) — the cheap end, not the important
end, and the report says so rather than dressing it up.

`boundaryCallSites()` on every run of this pass: `snapshot_calls 1`,
`other_snapshot_callers []`. The ceiling of 56 still rests on a single sampling point.

---

## 2. WHAT THE ENGINE ACTUALLY HOLDS — checked before anything was wired

This is the Unburden lesson applied rather than quoted. Unburden passes every derived column and this
engine holds **no state at all** under that name — `effSpeed` recomputes the doubling from the current
ability. So each of the three was traced to a real write site and a real read site before a line was
added to the comparator:

| leaf | medicham2 holds | authority |
|---|---|---|
| `lockon` | `_vol.lockon`, written at `medicham2-browser.js:29657` from `guaranteeVolatiles()`'s own volatile name, ticked in its own end-of-turn loop at `:38438` | `data/moves.ts:10397-10426` — `onHit` does `source.addVolatile('lockon', target)` (**the USER holds it**), condition `noCopy: true, duration: 2` |
| `minimize` | `_vol.minimize = 1` via the composed rider (`:26545`) into the generic volatile write (`:18787`); **read** at `:10540` and `:12666` (the doubled damage and the never-miss) | `data/moves.ts:11920-11951` — condition `noCopy`, `onRestart: () => null`, `onSourceModifyDamage`, `onAccuracy`; **NO duration** |
| `noretreat` | `_vol.noretreat = 1`, same rider, same generic write (`:18787`) | `data/moves.ts:12790-12822` — condition has an `onStart` and an `onTrapPokemon` calling `pokemon.tryTrap()`; **NO duration** |

**Champions overrides none of the three, checked rather than assumed.** `lockon`, `minimize` and
`noretreat` appear under `data/mods/champions/` **only in `learnsets.ts`** — no key in `moves.ts`,
`conditions.ts`, `abilities.ts`, `items.ts`, `scripts.ts`, `formats-data.ts` or `rulesets.ts`. So
mainline is the authority and every line number above is mainline's, read as a whole block.

**Legal carriers, derived from the format's own learnsets** (not typed): `lockon` — **1**
(Dragapult). `minimize` — **5** (Starmie, Qwilfish, Chandelure, Sandaconda, Overqwil). `noretreat` —
**1** (Falinks).

### The residual/self-removal split is evidence, not proof — so it was falsified

Each leaf was staged in a real game and **both engines were read at every boundary** before the
wiring, which is the falsifier `tests/probe_volatile_leaves.js` exists to be. All three are genuinely
standing:

```
lockon      b0 medi=0 sd=undefined | b1 medi=1 sd=1 | b2 medi=0 sd=undefined
minimize    b0 medi=0 sd=0         | b1 medi=1 sd=1 | b2 medi=1 sd=1
noretreat   b0 medi=0 sd=0         | b1 medi=1 sd=1 | b2 medi=1 sd=1
```

Lock-On's turn-2 boundary is in the script **on purpose**: a clock that only ever agrees on the turn
it was written is not evidence that two clocks run alike. Both engines apply 2, both decrement once in
their own residual, both read 1 at the boundary that closes the applying turn and both are gone at the
next. That is why it is compared as a **clock** and the other two as **presence** — and the presence
narrowing collapses nothing, because neither condition declares a duration on either side.

---

## 3. RED FIRST, THEN GREEN, EACH WITH A CONTROL — one leaf at a time

`tests/probe_leaf_widening.js` gained three arms. Each plays a real staged game through the driver's
own `statePlant` hook, corrupting **medicham2's live state** at the boundary (not the snapshot, so the
plant travels through the reader), and asserts the comparison reports it. The CONTROL arm is the
identical game with no plant and must stay silent.

| arm | before the wiring | after |
|---|---|---|
| `volatile:lockon` | **RED — the plant was INVISIBLE to the comparator (0 diffs, none on this leaf)** | **PASS — caught `p1.active[0].vol.lockon` medi=0 sd=1** |
| `volatile:minimize` | **RED — the plant was INVISIBLE (0 diffs, none on this leaf)** | **PASS — caught `p1.active[0].vol.minimize` medi=0 sd=1** |
| `volatile:noretreat` | **RED — the plant was INVISIBLE (0 diffs, none on this leaf)** | **PASS — caught `p1.active[0].vol.noretreat` medi=0 sd=1** |

Every one of the three CONTROL arms passed **before and after** — "no difference reported on this
leaf" at all three boundaries. Without that arm the comparator would have been made noisy rather than
correct.

**They were landed and proved ONE AT A TIME**, and the intermediate runs are the evidence the change
is scoped: after `lockon` was wired, its arm went green while `minimize` and `noretreat` were still
printing `RED — the plant was INVISIBLE`; after `minimize`, `noretreat` alone was still red. Census
re-derived at 829/829/0 after each of the three.

### Two instrument defects found while doing this, both fixed in the probe

1. **The script's own fallback counter was never read.** `scripted()` returns `pass` for a click that
   is not on Showdown's request and **counts it**; this probe did not read that count. A fixture whose
   carrier never learned `Protect` would have both engines pass, the boards agree, and the arm report a
   clean CONTROL **while testing nothing**. `runArm` now resets and reads `G.scriptCounters()` per arm,
   prints it unconditionally so a zero is evidence rather than an absence, and FAILS the arm on
   non-zero. It reads **0** on all seven arms.
2. **The Minimize fixture was an illegal team.** The first legal `minimize` carrier in dex order *is*
   Clefable, which is also `FILLER[0]` — so the unfiltered carrier search built a p1 with **two
   Clefable**, which Species Clause forbids. `buildPair` does not run the validator, so it played
   anyway. The carrier search now excludes the fillers and resolves to Starmie.

Neither is a claim about the game. Both are the kind of quiet narrowing that makes a
COULD-NOT-STAGE read like a statement about a mechanic.

**No silent `catch` was added.** The probe's existing named-throw counters (`SPE_THREW`, `LS_THREW`)
both read 0 on every run of this pass.

---

## 4. WHAT MOVED, AND WHAT DID NOT — the scoreboard called before the run

**The call, in writing, before the run:** board-material 35 (flat), protocol exactly 120, VOID exactly
4, games exactly 961, leaves 37 → 40.

**The reasoning, which is the part worth keeping.** These three are the **obscure tail** Will's
2026-08-23 ruling puts second, and the pool is the wrong scoreboard for them. Measured against the
frozen store itself rather than assumed:

```
data/team-pool-frozen  "Lock-On"     0 lines    "Dragapult"   0 lines
                       "Minimize"   37 lines
                       "No Retreat" 58 lines    "Falinks"   171 lines
```

The format's **only** legal Lock-On carrier does not appear in the pinned pool at all, so that leaf
cannot be standing in any game of this sample. A move sitting on a sheet is not a move clicked inside a
12-turn cap. And both engines were shown to hold all three leaves with identical values at every staged
boundary, so even a game that does stand one is likelier to agree than to part.

**The result: board-material 35, flat, exactly as called.** That is the correct outcome for this batch
and it is not a null result — *the lab moved and the pool did not*, which is one instrument confirming
the fix and the other correctly reporting that this mechanic is not in the metagame.

**The direction was forced and is worth restating:** three keys were added to both sides and none was
removed, so **no game that parted before can stop parting**. A widening can only raise board-material
or leave it flat. A FALL would have meant something else moved.

Protocol at exactly 120 and VOID at exactly 4 are the load-bearing confirmations here. `board_state.js`
is a **board** reader — it is not in the protocol comparison, and it is not one of the 26 frozen release
SOURCES. Both were predicted with a zero-width range so that any movement would have invalidated the
board-material figure sitting beside them. Neither moved.

---

## 5. BASELINE COMPARABILITY, MEASURED — and a benign instrument finding worth flagging

The gate was found at **7 of 9 failing**, not 2 of 9. Five clauses (`game differential`, the three
roster stages, `mechanics`) were all reporting **MEASURED AGAINST A DIFFERENT ENGINE — ran on release
`a5c736283129` and the tree is `6f96db9da019`**.

**The two releases are content-identical.** `diff --strip-trailing-cr` over every one of the 26 frozen
SOURCE files reports **0 content differences** (the manifest `release.json` excepted, which is the
release's own record). The digest moved because the **line endings of `engine/medicham2-browser.js`
changed** at 2026-09-04 22:58 local — after fix-batch-8's own measurement at 22:47 and before this
session began. Not one byte of behaviour differs.

Two consequences, both stated rather than absorbed:

- **The baseline is directly comparable.** board-material 35 / protocol 120 / VOID 4 were measured on
  bytes that behave identically to the ones measured here, so this is a clean before/after for the
  comparator change alone.
- **A whitespace normalisation staled five gate clauses and cost five re-runs.** The staleness gate is
  *correct* — it compares digests, and a digest is what it should compare. But a CRLF pass over one
  file currently reads exactly like a rewritten simulator. Recorded as OWED 3 below; it is not a defect
  in anything that measures the game, and it was not fixed inside a pass that publishes a rate.

All five clauses were re-run on `6f96db9da019` and returned to the found shape:

```
PASS  game differential              clean at BOTH corners of the damage roll: midpoint 0 of 6000, top 0/6000
PASS  deliberate roster / items      clean: 140 of 148 tested       {DIFFER 0, DID-NOT-FIRE 0}
PASS  deliberate roster / abilities  clean: 129 of 202 tested       {DIFFER 0, DID-NOT-FIRE 0}
PASS  deliberate roster / moves      clean: 475 of 500 tested       {DIFFER 0, DID-NOT-FIRE 0}
PASS  coverage / every used mechanic is measured by something
FAIL  whole-game differential / BOARD-MATERIAL     <- the found shape: reads data/game-differential.json,
FAIL  whole-game differential / NARRATION             which was deliberately NOT overwritten
PASS  mechanics / each one staged and compared against showdown
PASS  no open, known engine defect
```

**2 of 9 — the found shape.** `all_mechanics_fire.js` was run with `--kind all`, not the default
`--kind moves`, so the mechanics clause is answered rather than half-answered.

Six tests that read `board_state.js` were re-run and are green: `test-end-state`,
`test-middle-stall-address`, `test-roster-identity`, `test-state-differential`,
`test-volatile-duration`, `test-assert-mode`.

`tests/probe_leaf_name_map.js`, which consumes the same derivation from the same producer, agrees
exactly: *"of the 40 leaves ALREADY compared, 0 carry a declared duration of 1 … leaving 16 that can
stand at a boundary. SO THE WIDENING TARGET IS 40 -> 56."* One producer, one answer.

---

## 6. THE SIXTEEN THAT REMAIN

```
volatile:lockedmove        pseudoWeather:gravity      pseudoWeather:magicroom
pseudoWeather:wonderroom   slotCondition:futuremove   slotCondition:healingwish
slotCondition:wish         volatile:allyswitch        volatile:dragoncheer
volatile:gastroacid        volatile:metronome         volatile:powershift
volatile:powertrick        volatile:smackdown         volatile:stockpile
volatile:unburden
```

None of these is a `_vol.<authority name>` hit in this engine, so **every one of them needs the
Unburden check first** — a trace to what the engine actually holds, before any line is added to the
comparator. Three shapes are visible from the probe's own output and are recorded so the next batch
does not rediscover them:

- **`volatile:smackdown`, `volatile:powershift`, `volatile:powertrick`, `volatile:stockpile`** reach
  the generic volatile write through `statusInflict`, so they are likely to be real `_vol` entries under
  a different route — cheap, but unverified.
- **`volatile:unburden`** is the known negative: the engine holds nothing under the name, and the
  existing OBSERVE-ONLY arm measures the mechanic out of `effSpeed` instead.
- **Three of the sixteen are `slotCondition:*`**, and `board_state.js` reads **no slot condition at
  all** (`uncomparableLeavesOf` says so in one line). Those are a different piece of work from a
  per-body volatile and should not be counted as three cheap wirings.

---

## FILES

- `engine/board_state.js` — three keys on each side of the per-body volatile comparison, plus the
  block that says which authority line each was read from and what the engine holds.
- `tests/probe_leaf_widening.js` — three new CONTROL/RED arms; per-arm script-fallback counter; the
  Species Clause fix in the Minimize carrier search.
- `data/verification/2026-09-05-leaf-widening-batch2-prediction.json` — the scoreboard, called first.
- `data/verification/leaf-widening-batch2.json` — the measurement.
- Re-run on release `6f96db9da019`: `data/engine-diff.json`, `data/roster.{items,abilities,moves}.json`,
  `data/all-mechanics-fire.json`, `data/mechanics-census.json`.

---

## OWED

1. **`docs/ENGINE.md` was NOT touched and `node engine/status.js --write` was NOT run.** The brief for
   this pass says *"do not touch `docs/` beyond your own report"*, which overrides the standing closing
   step. So the ENGINE hand list still carries whatever it carried, and the generated blocks in the
   division ledgers are one pass behind. **The coordinator owns restamping this** —
   `node engine/status.js --write` — and the hand list needs `lockon`, `minimize` and `noretreat`
   removed if they were on it, because the census and `probe_leaf_widening.js` now carry them.
2. **Nothing was committed.** Instructed not to. `engine/board_state.js`,
   `tests/probe_leaf_widening.js` and the artifacts above are on disk only.
3. **A line-ending-only change to one SOURCE file stales five gate clauses and costs ~12 minutes of
   re-runs.** Recorded, not fixed — fixing it means changing what a release digest is computed over,
   which is a decision about the measurement and belongs to MEASURE, not to a pass that publishes a
   rate. It is benign today and it will not stay obvious.
4. **The sixteen remaining leaves each need the Unburden check before wiring**, and three of them are
   `slotCondition:*`, which this comparator reads none of. They are not three more cheap wirings.
5. **Files in the tree that are not mine, reported and left alone** (session-cleanup rule):
   `data/verification/fix-batch-8.json`, `data/verification/fix-batch-8.sample.json`,
   `docs/_reports/2026-09-05-fix-batch-8.md`, `tests/probe_imprison_seal.js`,
   `tests/probe_pivot_magic_bounce.js`. They are fix-batch-8's, untracked, and were not touched.
6. **This run cannot say whether these three leaves ever DO part in real play.** The pinned pool holds
   zero Lock-On and zero Dragapult. That is a fact about the metagame, not a hole in the pool, and it was
   written down before the run rather than explained after it.
