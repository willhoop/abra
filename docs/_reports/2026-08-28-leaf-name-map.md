# Phase 1 — the leaf name map, and the boundary check

ENGINE, 2026-08-28. Derivation only: no game was played, no engine file was edited, nothing was
written to a shared artifact. The one new file is `tests/probe_leaf_name_map.js`.

Everything below is printed by that probe. Re-derive rather than quoting this page:

```
node tests/probe_uncompared_leaves.js
node tests/probe_leaf_name_map.js
node tests/probe_leaf_name_map.js --pool
```

**What was read.** `engine/medicham2-browser.js` at **2,643,610 bytes**, which is the LIVE working
copy — another ENGINE agent holds it, `engine/quarantine.js` and `tests/roster.js` uncommitted while
this ran. This is a read of what is on disk, not of a frozen release, and the probe prints the byte
count on every run so two answers taken either side of that agent's edit can be told apart.

---

## 1. THE HEADLINE

| | |
|---|---|
| of the 43 uncompared leaves, MAPPED | **41** |
| ABSENT (we genuinely do not implement it) | **1** — `volatile:flashfire` |
| NO-STATE (mechanic implemented, no state under that name) | **1** — `volatile:chillyreception` |
| CANNOT-DETERMINE | **0** |
| widening target after the boundary check | **33 -> 56**, not 33 -> 58 |
| does the boundary claim hold? | **YES** — every board this repository compares is sampled at a turn boundary and nowhere else |

**The coordinator's reading was right for 41 of 43.** `ours_vol: false` in
`probe_uncompared_leaves.js` does mean "we spell it differently", and the spread of internal names is
wider than the two examples in the plan: `_mtLock`, `_recharge`, `_preTurn`, `_took`, `_lock`,
`_metroN`, `_flingBP`, `_hadItem`, `_aswDur`, `_noSound`, `_typeWas`, `_redirect`, `_helpingHand`,
`field.sgA`, `field.magicRoom`, `sf.slot[i].when`, and a generic `_vol[<authority name>]` table that
the parent probe's `_vol.<name>` grep structurally cannot see because the engine indexes it by
variable.

---

## 2. HOW THE ADDRESS IS DERIVED (four routes, strongest first)

1. **owner-table** — medicham2 already holds four maps keyed by the AUTHORITY'S OWN volatile
   spelling, written so its residual walk can find state it keeps under its own names:
   `RESIDUAL_SHADOW_VOL` (28), `RESIDUAL_FOLLOWER_VOL` (12), `RESIDUAL_CLOCK_READER` (6),
   `RESIDUAL_FOLLOWER_FIELD` (5). None is exported, so the probe parses the object literals out of
   the source by brace balance and prints the matched expression. If the engine renames `_mtLock`,
   the probe's answer changes on the next run.
2. **owned-branch** — `applyMoveVolatile`'s own `if(vol==='x')` refusals, read off the function:
   `attract encore disable substitute partiallytrapped healblock confusion`.
3. **tag -> generic `_vol`** — `applyMoveVolatile(who, vol, …)` keys `_vol[vol]` by the name the
   artifact hands it, so a leaf is reachable when a legal entity's `data/tags.json` params name it on
   a **write** path.
4. **declared+anchored** — the private fields no artifact can name. Declared in the probe, and every
   one carries anchor patterns re-checked against the live engine bytes; a failed anchor turns the row
   into `CANNOT-DETERMINE` naming the pattern rather than keeping a stale address.

### Route 3 over-matched first, and that is the finding, not an aside

The first version asked only *"does any tag param carry this string, and does the engine read that
tag"*. It produced **five false mappings out of thirty-seven, every one toward the comfortable
answer**:

| leaf | what it matched | why that is wrong |
|---|---|---|
| `quickguard` / `wideguard` | `feint.breaksProtect.sideConditions[2..3]` | a READER of the guard, and they are not volatiles at all |
| `wish` / `healingwish` / `futuremove` | `healDescriptor.slotCondition` | handed `_vol[…]`; the engine keeps all three on `sf.slot[i]` |
| `beakblast` / `focuspunch` | `instruct.instructsTarget.refuses[]` | a REFUSAL LIST |
| `chillyreception` | `volatileAnnounce` | an announcement table, not a write |
| `flashfire` | `typeImmunity.gain.volatile` | the engine's consumer of that exact field **counts it as unmodelled** |

The route now accepts only `statusInflict.effects[N].volatile`, `layeredVolatile.volatile`,
`critStageVolatile.volatile`, `volatileStartGate.volatile`, `guaranteesNextMove.volatile`, on a
VOLATILE leaf, on a tag the engine reads, with each shape anchored to the call site that consumes it.

The boundary rule over-matched too, and the guard is printed: a first version keyed on
*"a within-action handler calls `removeVolatile` on its own name"* and caught **`lockedmove`**, whose
`onAfterMove` is `if (this.effectState.duration === 1) pokemon.removeVolatile('lockedmove')` — a
conditional removal at the end of a real 2-turn clock. It would have dropped the rampage lock out of
the widening target. A declared clock now wins, and the rescued row is printed on every run.

---

## 3. THE MAP

`dur` is the authority's declared duration. `-` is none.

| leaf | dur | verdict | route | our address |
|---|---|---|---|---|
| `volatile:flinch` | 1 | MAPPED | owner-table | `m._flinch` |
| `volatile:mustrecharge` | 2 | MAPPED | owner-table | `m._recharge` |
| `volatile:lockedmove` | 2 | MAPPED | owner-table | `m._mtLock` (`.vol==='uproar'` splits Uproar off) |
| `volatile:protect` | 1 | MAPPED | owner-table | `m.protect` + `m._protectMove` via `residualShadowShield` |
| `volatile:spikyshield` | 1 | MAPPED | owner-table | `residualShadowShield(m)==='spikyshield'` |
| `volatile:kingsshield` | 1 | MAPPED | owner-table | `residualShadowShield(m)==='kingsshield'` |
| `volatile:banefulbunker` | 1 | MAPPED | owner-table | `residualShadowShield(m)==='banefulbunker'` |
| `volatile:endure` | 1 | MAPPED | owner-table | `residualShadowShield(m)==='endure'` |
| `volatile:followme` | 1 | MAPPED | owner-table | `m._redirect` |
| `volatile:ragepowder` | 1 | MAPPED | owner-table | `m._redirect` |
| `volatile:helpinghand` | 1 | MAPPED | owner-table | `m._helpingHand` |
| `volatile:roost` | 1 | MAPPED | owner-table | `m._typeWas` |
| `volatile:allyswitch` | 2 | MAPPED | owner-table | `m._aswDur` |
| `volatile:throatchop` | 2 | MAPPED | owner-table | `m._noSound` (clock reader `soundLock`) |
| `volatile:lockon` | 2 | MAPPED | owner-table | `m._vol.lockon` + `m._guarantee` |
| `pseudoWeather:gravity` | 5 | MAPPED | owner-table | `field.gravity` |
| `pseudoWeather:magicroom` | 5 | MAPPED | owner-table | `field.magicRoom` |
| `pseudoWeather:wonderroom` | 5 | MAPPED | owner-table | `field.wonderRoom` |
| `volatile:electrify` | 1 | MAPPED | tag->`_vol` | `m._vol['electrify']` |
| `volatile:minimize` | - | MAPPED | tag->`_vol` | `m._vol['minimize']` |
| `volatile:noretreat` | - | MAPPED | tag->`_vol` | `m._vol['noretreat']` |
| `volatile:gastroacid` | - | MAPPED | tag->`_vol` | `m._vol['gastroacid']` |
| `volatile:powertrick` | - | MAPPED | tag->`_vol` | `m._vol['powertrick']` |
| `volatile:powershift` | - | MAPPED | tag->`_vol` | `m._vol['powershift']` |
| `volatile:smackdown` | - | MAPPED | tag->`_vol` | `m._vol['smackdown']` (through `volatileStartGate`) |
| `volatile:stockpile` | - | MAPPED | tag->`_vol` | `m._vol['stockpile']` (layer count, not a flag) |
| `volatile:dragoncheer` | - | MAPPED | tag->`_vol` | `m._vol['dragoncheer']` |
| `volatile:sparklingaria` | - | MAPPED | tag->`_vol` | `m._vol['sparklingaria']` (written, no consumer yet) |
| `volatile:choicelock` | - | MAPPED | declared+anchored | `m._lock` with `m._lockT === Infinity`; reader `lockMenuMove` |
| `volatile:metronome` | - | MAPPED | declared+anchored | `m._metroN` + `m._metroLast` |
| `volatile:focuspunch` | 1 | MAPPED | declared+anchored | `m._preTurn = {id:'focuspunch',p,hit,hitSide}` |
| `volatile:beakblast` | 1 | MAPPED | declared+anchored | `m._preTurn = {id:'beakblast',…}` |
| `sideCondition:quickguard` | 1 | MAPPED | declared+anchored | `field.sgA/sgB['quickguard']` |
| `sideCondition:wideguard` | 1 | MAPPED | declared+anchored | `field.sgA/sgB['wideguard']` |
| `slotCondition:wish` | - | MAPPED | declared+anchored | `sf.slot[i]` with `.when==='endOfNextTurn'` |
| `slotCondition:healingwish` | - | MAPPED | declared+anchored | `sf.slot[i]` with `.when==='onEntry'` |
| `slotCondition:futuremove` | - | MAPPED | declared+anchored | `sf.slot[i]` with `.when==='futureHit'` |
| `volatile:unburden` | - | MAPPED **(INEXACT)** | declared+anchored | DERIVED, not stored: `m._hadItem && !m.item` (+ `_roomItem`) |
| `volatile:fling` | - | MAPPED **(INEXACT)** | declared+anchored | `m._flingBP` / `_flingFx` / `_flingItem` |
| `volatile:counter` | 1 | MAPPED **(INEXACT)** | declared+anchored | `m._took.byPhys` via `scriptedAimOf` |
| `volatile:mirrorcoat` | 1 | MAPPED **(INEXACT)** | declared+anchored | `m._took.bySpec` via `scriptedAimOf` |
| `volatile:chillyreception` | 1 | **NO-STATE** | declared+anchored | none; the pivot and the snow are implemented |
| `volatile:flashfire` | - | **ABSENT** | declared+anchored | **NONE** |

### The four INEXACT rows, because a mapping that is not an equivalence must be labelled

- **`unburden`** is a predicate, not a stored volatile, and the engine names its own gap at the
  `bringIn` site: a body that walks in with no item, is HANDED one mid-stint (Trick, Bestow, Thief,
  Pickup) and loses it again **gets the volatile in the authority and gets nothing here**. Wiring this
  leaf will part on exactly that case. That is a real defect surfacing, not a wiring error, and it
  should be predicted before the run rather than explained after it.
- **`counter` / `mirrorcoat`** — the authority puts the record on the Counter USER at `beforeTurn`;
  this engine puts it on whoever was hit and derives the aim. Same answer, different body. Both are
  `duration: 1`, so this never reaches a boundary and is moot for the widening.
- **`fling`** — the authority's `fling` volatile is a within-action marker whose own `onUpdate` spends
  the item; this engine stamps the power instead. Also never reaches a boundary.

### The one ABSENT — and it is already declared, not newly discovered

`volatile:flashfire`. `absorbGift` prices the hit at zero and **drops the gift**:

```
if(!_h && !_ab.gain.boosts && _ab.gain.volatile){ MEDFAILS.absorbGiftUnmodelled++; … }
```

Flash Fire is the only ability in this regulation whose `typeImmunity.gain` is a volatile (1,379
sheet uses). So a Flash Fire body that eats a Fire move gets no volatile and **no 1.5x on its own
Fire moves** — board-material through damage, not narration.

**This does NOT contradict the census.** `780 probed / 780 live / 0 missing` counts mechanics that
HAVE a probe; there is no census row for the Flash Fire gift (the six rows matching `typeImmunity` /
"Flash Fire" are Levitate, Scrappy, Volt Absorb, Receiver, the Gravity/Smack Down absorb gate, and
the `-immune`-is-the-else row). It is an UNPROBED mechanic, and it is already carried as a stated
remainder in **ROADMAP #432** and `docs/ENGINE.md:11480` — *"STATED, NOT FIXED: Flash Fire's gift is a
VOLATILE this engine does not grant"*.

What is new here is its **reach**: 1,177 games of the frozen pool, fifth of the 23 comparable leaves,
and the Showdown-exit plan does not list it in any group.

---

## 4. THE BOUNDARY CHECK — the claim holds, the number does not

**Where the board is sampled, read off the driver.**

- `BS.snapshot` is called **once** in the whole repository, at `game_differential.js:3433`, inside
  `stateCheck`.
- `stateCheck` has exactly **two** call sites: `:3803` (turn index 0, the leads, before any choice)
  and `:4090` (after `turns++`, after `alignAndCheck`, after every forced switch has been mirrored,
  i.e. after medicham2's `battleTurn` residuals + `refill`).
- **No other file calls `BS.snapshot`.** `roster.js`, `all_mechanics_fire.js`, `staged_board.js`,
  `staged_status_counters.js` and `test-state-differential.js` all reach the board through the
  driver's own read-only `onBoundary` hook, which fires inside `stateCheck`. The one direct
  `BS.readMedi` pair (`:5112`/`:5116`) is inside `opts.statePlant`, which is also called from
  `stateCheck`.

**So no read happens mid-turn, mid-action or at a faint boundary. The plan's premise is correct.**

**The inverse test passes too**, which is the cheap falsifier the plan did not ask for: of the 33
leaves the comparator ALREADY reads, **0 carry a declared duration of 1**. The comparator is not
currently comparing anything vacuous.

**But the target is 56, not 58.** Two of the 25 "standing" leaves declare no clock and are removed
**inside their own action**, so they can no more stand at a boundary than the 18:

| leaf | where it ends |
|---|---|
| `volatile:fling` | `fling.condition.onUpdate` — unconditional; spends the item and removes itself |
| `volatile:sparklingaria` | `sparklingaria.onAfterMove` — `delete pokemon.volatiles["sparklingaria"]` on every active body |

43 = 18 duration-1 + 2 removed within the action + **23 that can stand**. 33 + 23 = **56**.

Two things this does not claim. It does not prove the 18 can never be present — a duration-1 volatile
applied by something running *below* the residual (a post-residual forced-switch entry effect) is not
excluded by the authority's `duration` field alone, and nothing here staged that. And the 4 DECLARED
leaves (`attract`, `curse`, `healblock`, `yawn`) are outside this count on purpose: `board_state.js`
already diagnoses them as a FIXTURE problem, not an instrument one, and medicham2 demonstrably holds
three of the four. Wiring those would make it 60.

---

## 5. THE ORDER — the plan's groups do not survive the pool

Reach measured over `data/team-pool-frozen` (17,381 games, both stores). **Upper bound**: a sheet
carrying Outrage is not a game that clicked it, and the pool brings 4 of 6.

**The single most important thing the pool says is about the leaves that are NOT comparable.** The
four biggest leaves in the whole hole are `protect` (17,344 games), `flinch` (14,366), `ragepowder`
(9,690) and `helpinghand` (6,334) — and every one is `duration: 1` and can never be read at a turn
boundary. Widening at the boundary reaches a far thinner slice of the pool than the raw hole
suggests. Will's *"rank by the pinned pool"* rule has to be applied to the **comparable** subset or it
ranks work that cannot be done.

The 23 that can stand, by pool games:

| # | leaf | pool games | writers | plan's group |
|---|---|---|---|---|
| 1 | `volatile:choicelock` | 9,488 | 1 | 2 |
| 2 | `volatile:throatchop` | 5,023 | 1 | **5** |
| 3 | `volatile:unburden` | 4,121 | 1 | **5** |
| 4 | `volatile:mustrecharge` | 3,696 | 6 | 1 |
| 5 | `volatile:flashfire` | 1,177 | 1 | **5 — and unlisted; it is the ABSENT one** |
| 6 | `volatile:allyswitch` | 324 | 1 | 5 |
| 7 | `volatile:noretreat` | 155 | 1 | 5 |
| 8 | `pseudoWeather:gravity` | 119 | 1 | 4 |
| 9 | `volatile:lockedmove` | 102 | 4 | **1** |
| 10 | `slotCondition:wish` | 97 | 1 | 3 |
| 11 | `volatile:stockpile` | 96 | 1 | 5 |
| 12 | `volatile:dragoncheer` | 50 | 1 | 5 |
| 13 | `volatile:smackdown` | 39 | 1 | 5 |
| 14 | `volatile:minimize` | 37 | 1 | 5 |
| 15 | `slotCondition:healingwish` | 29 | 1 | 3 |
| 16 | `volatile:metronome` | 29 | 1 | 5 |
| 17 | `slotCondition:futuremove` | 24 | 1 | 3 |
| 18 | `pseudoWeather:wonderroom` | 15 | 1 | 4 |
| 19 | `volatile:gastroacid` | 9 | 1 | 5 |
| 20 | `pseudoWeather:magicroom` | 5 | 1 | 4 |
| 21 | `volatile:lockon` | **0** | 1 | 5 |
| 22 | `volatile:powershift` | **0** | 1 | 5 |
| 23 | `volatile:powertrick` | **0** | 1 | 5 |

### What should change

- **Group 1 is half right.** `mustrecharge` is 3,696 games and 6 writers — keep it. `lockedmove` is
  **102 games**, two orders of magnitude below `choicelock`. It stays decision-changing and it is not
  a group-1 *pool* item; land it beside the small ones.
- **`choicelock` should lead**, not follow. 9,488 games, the largest comparable leaf by a factor of
  nearly two, and its address (`_lock` + the `_lockT === Infinity` discriminator) is one of the more
  delicate ones because a single field carries both the Choice lock and Encore's.
- **`throatchop` and `unburden` must come out of group 5.** 5,023 and 4,121 games. `unburden` is
  additionally the row with a NAMED, already-diagnosed inequivalence — wiring it will part on
  mid-stint item grants, and that must be predicted before the run.
- **`flashfire` needs a group of its own, first or second.** It is the only ABSENT, it is
  board-material, 1,177 games, and it is not in the plan's list at all. It also does not belong in a
  "widen the comparator" batch: wiring the leaf will part every Flash Fire absorb, which is a known
  answer. Fix the engine (grant the volatile and its 1.5x), *then* wire the leaf, or the widening
  batch's divergences become unattributable.
- **`lockon`, `powertrick`, `powershift` have ZERO reach in the pinned pool.** They can only ever move
  the lab. Correctly last, and worth saying out loud so nobody reads a flat pool result as a failure.
- **The field rooms (group 4) are near the bottom**, not group 4: gravity 119, wonderroom 15,
  magicroom 5.
- **The delayed effects (group 3) are small**: wish 97, healingwish 29, futuremove 24. Their argument
  is still good — an error is invisible on the turn it is made — but it is a *correctness* argument,
  which is the lab's question, not the pool's.

---

## 6. WHAT THIS DID NOT SETTLE

- **No leaf was staged.** Every address is derived from the artifact, the engine source and the
  authority's own entries. The falsifier for any single row is a staged boundary read of both engines
  (`tests/probe_volatile_leaves.js`), and a `COULD-NOT-STAGE` there would be a claim about the
  fixture, never about the mechanic.
- **`residualShadowUnread` is not a second opinion and must not be quoted as one.** The engine
  publishes `MEDFAILS.residualShadowUnread = magnetrise,beakblast,chillyreception,counter,electrify,
  focuspunch,mirrorcoat` at load. That list is the rows its residual SHADOW walk cannot see, computed
  from four named tables that deliberately exclude the generic `_vol[id]` fallback — so it
  over-reports absence: `electrify` is written through `statusInflict`, and `beakblast`, `counter`,
  `focuspunch` and `mirrorcoat` all have private fields. It agrees with this map only on
  `chillyreception`.
- **`magnetrise@18` is a real gap the engine names itself** and it is outside this brief: it is a
  COMPARED leaf with a missing residual tick (*"a clock nobody spends is a volatile that never
  ends"*), not one of the 43.
- **`docs/ENGINE.md` was not touched.** Another agent holds it modified, and this brief is read-only.

---

## OWED, NOT RUN

Re-derive the state before acting on any figure above:

```
node engine/status.js
node engine/open_work.js
node tests/probe_uncompared_leaves.js
node tests/probe_leaf_name_map.js
node tests/probe_leaf_name_map.js --pool
node tests/probe_leaf_name_map.js --json
```

Not run here, and each needs a game or an engine edit, so each belongs to the agent that holds the
engine:

```
# settle any single address by staging it in both engines and printing raw state
node tests/probe_volatile_leaves.js

# the Flash Fire gift — no probe exists for it anywhere; write one and show it RED first
node tests/test-mechanics.js

# after any widening, the pinned three-way run the plan requires
node engine/game_differential.js --release <id> --team-store data/team-pool-frozen --games 1200
```

Owed to the record once an agent holds the files: a `docs/ENGINE.md` hand-list entry for the Flash
Fire gift's REACH (the absence itself is already ROADMAP #432), and the correction of the
Showdown-exit plan's `33 -> 58` to `33 -> 56` with the two within-action leaves named.
