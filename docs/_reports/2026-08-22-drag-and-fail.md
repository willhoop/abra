# DRAG / BENCH ORDER (#340) AND A FAILED ROOST'S SELF-RIDER (#343)

Historical findings record. Not maintained, not current state, never cite as such.
Superseded by the register rows it feeds.

Two fixes, landed and measured strictly one at a time. Nothing committed, nothing pushed,
`docs/ROADMAP.md` untouched.

---

## HEADLINE

| | before | after batch 1 | after batch 2 |
|---|---|---|---|
| **census live / missing** | 626 / 0 | 627 / 0 | **628 / 0** |
| whole-game divergences (usable) | 129 of 772 | 93 of 770 | **89 of 770** |
| `drag: a different body` | **19** | 1 | 1 |
| `extra event emitted by medicham2` | 13 | 11 | **7** |
| `event missing from medicham2` | 42 | 34 | 34 |
| `ordering` | 20 | 17 | 17 |
| `unrelated event mismatch` | 22 | 22 | 22 |
| `-boost field 3` | 9 | 9 | 9 |
| `-damage field 3` | 4 | 2 | 2 |
| `-damage: a different body` | 2 | 2 | 2 |
| `medicham2 stopped emitting` | 1 | 0 | 0 |
| `-status: a different body` | 1 | 0 | 0 |
| `-activate: a different body` | 1 | 0 | 0 |
| `-start field 4` | 0 | 1 | 1 |
| VOID (instrument desync) | 5 | 7 | 7 |

Releases: **`18b227eee69f`** (before), **`fda4b805651e`** (after batch 1), **`39631097fcc7`** (after
batch 2).

## THE SAMPLE IS PROVEN IDENTICAL, NOT ASSUMED

All three differential runs: `--games 961 --state --team-store data/team-pool-frozen --census <a copy
of the 627-row census>`, differing ONLY in `--release`. Each run printed the same
`digest 61ee3d9789ae  627 rows`, the same `team pool b2b61ec40281  (1597 teams picked from a corpus of
8778 — PINNED)`, the same `777` games played, `0` threw. The three pinned tie arms all improved
together (middle 134→99→95, top-tie-first 95→86, bottom-tie-first 127→118).

The census was pinned to a COPY in the scratchpad precisely because the live census moved twice
during this pass (626→627→628 rows) and the census STEERS which games are played. A run either side of
a census regeneration is not a before/after.

---

## BATCH 1 — ROADMAP #340, THE BENCH ORDER

### The authority, derived

```
sim/battle-actions.ts:118-132   oldActive.position = pokemon.position;
                                pokemon.position   = pos;
                                side.pokemon[pokemon.position]   = pokemon;
                                side.pokemon[oldActive.position] = oldActive;
sim/battle.ts:1572-1581         possibleSwitches walks side.pokemon from active.length upward,
                                skipping only the fainted
sim/battle.ts:1567              getRandomSwitchable -> this.sample(canSwitchIn)
```

The outgoing body takes the ARRIVING body's party index. The party ORDER is therefore the drag die's
index space. This engine did `switchOut: bench.push(out)` then `bringIn:
bench.splice(bench.indexOf(nx),1)` — remove and append.

The die hypothesis was already refuted by `tests/probe_drag_body.js` before this pass: both engines
roll a uniform die, spend exactly one draw and draw the SAME value at the SAME address.

### Shown red first, on the current tree

`tests/probe_drag_body.js --release 18b227eee69f`, SUBJECT arm (p2a pivots on turn 1, the arriving
body mirrored, then is Roared):

```
p2 party   showdown snorlax,milotic,corviknight,weavile
ELIGIBLE   showdown [corviknight, weavile]
           medicham [weavile, corviknight]     -> same members: YES   same ORDER: NO
DRAGGED    showdown=weavile   medicham=corviknight   -> DIFFERENT BODY
```

CONTROL (nobody switches on turn 1) agreed on both order and body, which isolates the ORDER from the
die.

### The fix

`switchOut` no longer pushes; it hands `out` to `bringIn` as a tenth argument, and `bringIn` writes it
into the arriving body's bench slot instead of splicing that slot out.

**A faint replacement passes no `outgoing`, and that is derived rather than skipped.** The authority
swaps the corpse in too (`if (oldActive.fainted) oldActive.status = ''` sits INSIDE the same block),
but `possibleSwitches` skips the fainted and a swap moves no other element — so the LIVE order the die
indexes is identical whether the corpse is parked at that index or dropped. Dropping it is what this
engine has always done and `fallenCount` reads `sf.team`, never the arrays. The only thing the two
differ on is a full-party walk that includes corpses, and nothing indexes one.

**`bench.push(out)` was never selectable anyway**, so nothing about WHO arrives changed: the push ran
below `if(!_live(bench).length) return null`, which is computed BEFORE it, and the drag's `wanted` is
drawn from a list built before the call.

### The probe

`tests/test-mechanics.js` `move/forcesSwitch` — *"a drag indexes into the bench in the AUTHORITY's
order — a body that switches out takes the incoming body's party slot"*.

Four arms, and BOTH die faces are read, because a probe that reads one index cannot tell a reordered
list from a reversed one:

| arm | bench | drag @ idx 0 | drag @ idx 1 |
|---|---|---|---|
| control — nobody switched | `snorlax,weavile` | snorlax | weavile |
| test — p2a switched to the FIRST bench member | `corviknight,weavile` | corviknight | weavile |

Expected bodies are the authority's own, read off `probe_drag_body.js` on this exact cast, never typed
from recall.

- **RED FIRST**: `626 live, 1 missing, 627 probed` on the shipped tree.
- **GREEN**: `627 live, 0 missing`.
- **RED AGAIN ON DEMAND**: `MEDI_BENCH_APPEND=1` restores remove-and-append (both halves at once — the
  append AND the splice, because a flag that reverted one half would drop the body off the team) and
  the census reads `626 live, 1 missing`. Any run carrying it also carries a non-zero
  `MEDFAILS.benchOrderAppendRestored`.
- **TWO-ENGINE**: `probe_drag_body.js` on `fda4b805651e` — same order, same body, every boundary. Its
  two SUBJECT clauses were inverted (they asserted DISAGREEMENT, which was the hypothesis test) and a
  new `THE KNOB MOVED` clause was added, because "the two engines agree" is trivially satisfiable by a
  fixture whose pivot silently stopped happening. Both clauses invert back under `MEDI_BENCH_APPEND=1`.

---

## SUCTION CUPS (#341) — NOT THE SAME DERIVATION, LEFT ALONE, AND HERE IS WHY

Re-probed red on this tree (`probe_drag_body.js`, both doors):

```
roar          showdown |-activate|p2a: Malamar|ability: Suction Cups   nobody moves
              medicham |-activate|p2a: Malamar|ability: suctioncups    nobody moves      AGREE
dragontail    showdown |-activate|p2a: Malamar|ability: Suction Cups   nobody moves
              medicham |drag|p2a: Snorlax|snorlax, L50|235/235                           DISAGREE
```

Membership derived over `Dex.forFormat('gen9championsvgc2026regmb')`: exactly two abilities carry
`onDragOut` — `suctioncups` and `guarddog` — plus the move `ingrain`. Champions overrides none. This
matches ROADMAP #341 and #175.

**It is a different derivation from #340.** #340 is the ORDER of a list; #341 is a tag read
(`refusesForcedSwitch`) present in the phaze branch (`a.kind==='phaze'`) and absent from the damaging
branch (`pivotDamaging`/`forcesSwitch` after the hit). Nothing about fixing one produces the other.

**And fixing it alone would not clear its differential row.** The authority prints
`ability: Suction Cups`; we print the raw id `suctioncups`. Honouring the refusal in the damaging
branch converts a `drag` divergence into an `-activate` TEXT divergence unless the display name is
fixed in the same pass — which is a second change at a site that also serves the phaze branch. Two
changes at once would have destroyed the attribution the whole drag measurement rests on, so both are
filed.

`tests/probe_drag_body.js` exits 1 on that one clause and on nothing else. That is #341's red, and it
is declared here rather than filed as a status.

---

## BATCH 2 — ROADMAP #343, A FAILED PRIMARY DOES NOT SPEND ITS `self` RIDER

### The authority, derived

```
sim/battle-actions.ts:1203-1208   if (target.hp >= target.maxhp) {
                                    this.battle.add('-fail', target, 'heal');
                                    this.battle.attrLastMove('[still]');
                                    damage[i] = combineResults(damage[i], false);
                                    didAnything = combineResults(didAnything, null);
                                    continue;
                                  }
sim/battle-actions.ts:1290        for (const i of targets.keys())
                                    if (!damage[i] && damage[i] !== 0) targets[i] = false;
sim/battle-actions.ts:1317-1325   selfDrops(...) { for (const target of targets) {
                                    if (target === false) continue; ... } }
```

Roost is `heal:[1,2]` with `self:{volatileStatus:'roost'}`. A Roost at full HP therefore fails as a
heal AND never applies its rider, so the user keeps its Flying type.

### The code's own comment already said this and the code did the opposite

`medicham2-browser.js` carried, three lines above the block:

> *A FAILED ROOST APPLIES NOTHING … which is why this sits inside the `if(_hp)`-bearing branch and
> after `amt(m)` rather than at the top.*

Sitting after `amt(m)` is not the same as being conditional on it. The rider fired whenever the tag
existed. This is the fourteen-stale-handoffs shape arriving inside a function.

### Shown red first

Engine-only, `board('garchomp','skeledirge','talonflame','farigiraf')`, Talonflame 126 vs Garchomp 102
so the Roost always resolves first:

```
healAlone   half HP, Roost, nobody attacks   +76
landed      half HP, Roost + Earthquake      -77      (heal minus a real Earthquake)
failed      FULL HP, Roost + Earthquake     -153      <- the defect
noRoost     FULL HP, Tailwind + Earthquake     0      <- the over-fire control
```

153 of a 155-HP body, from a move the authority answers `|-immune|`.

Both streams, staged through `game_differential.js` on release `18b227eee69f`:

```
showdown  |move|p1a: Corviknight|Roost||[still]        |-fail|p1a: Corviknight|heal
medicham  |move|p1a: Corviknight|roost|p1a: ...        |-fail|p1a: Corviknight|heal   |-singleturn|p1a: Corviknight|move: roost
```

Census: `627 live, 1 missing, 628 probed`.

### Membership, printed before wiring

25 legal moves in Reg M-B carry `self`. Exactly **one** is a heal-primary Status move — `roost`.
`batonpass` and `shedtail` are the other Status members and both carry `self:{}` (nothing to apply).
The remaining 22 are damaging moves — Close Combat, Draco Meteor, Leaf Storm, Overheat, Make It Rain,
Armor Cannon, Superpower, Hammer Arm, Ice Hammer, Headlong Rush, the four `mustrecharge` moves, the
four `lockedmove` moves, Uproar, Burn Up — **whose primary fails through a different door, and THAT
DOOR WAS NOT MEASURED IN THIS PASS.** Their riders are still applied unconditionally here. That is
declared open rather than swept in: a sweep across the damage branch is a different blast radius and
would have ridden in on this fix unmeasured.

### The fix

`amt()` already computes the boolean the `-fail` line is drawn from; it is now recorded for the USER
(`_healLanded`) and read by the rider gate, rather than re-derived. Three states, deliberately:
`true` (landed), `false` (failed), `null` (this move declared no heal primary — impossible today, and
`MEDFAILS.roostRiderNoPrimary` says so if the family grows). Every skip increments
`MEDSEEN.selfRiderSkippedOnFailedPrimary`, so the fix cannot become a silent no-op the way its own
comment did.

### The proof

- **census** `move/typeRemovedForTurn` — four arms as above; the bar is `failed === noRoost`, an
  EQUALITY against an over-fire control, so an engine that simply stopped grounding anything fails the
  `landed` arm. `628 live, 0 missing`.
- **two engines, no typed expectation** — `tests/staged_board.js a-failed-roost-grounds-nothing`.
  Talonflame (Roost, Brave Bird) vs Mudsdale (Bulldoze), three turns: turn 1 the defect (full-HP Roost
  into a Ground move), turn 2 a second negative (Brave Bird recoil, no Roost, the same Ground move must
  still do nothing), turn 3 the positive (damaged, the Roost succeeds, the identical Ground move must
  LAND).
  - CLEAN on `39631097fcc7`: **293 of 293 fields identical at all four boundaries.**
  - Under its declared break (the one condition removed): **CAUGHT AND LOCALISED** on turn 1 —
    `party.hp, party.boosts.spe, hp, boosts.spe, party.fainted, party.status, species, maxhp, types,
    ability, pp.roost, pp.bravebird`.
  - The same scenario on release `18b227eee69f` reads `DIFFERS`.
  - **THE FIXTURE WAS CORRECTED ONCE AND THE REASON IS RECORDED**: the first version used Earthquake,
    which is a clean OHKO on a full-HP Talonflame, so the POSITIVE turn ended in a faint the script
    cannot answer and the whole scenario reported `THREW`. A fixture that kills its own subject tests
    nothing.
- **differential**: the cause string `|upkeep <> |-singleturn|p1a|roost` is present in the PRE and
  batch-1 runs and **absent** from the batch-2 run, and `extra event emitted by medicham2` fell 11 → 7
  with nothing rising.

---

## WHAT MOVED THAT I DID NOT EXPECT

**1. `tests/test-end-state.js` PART 2 went red because the engine got right.** It searched the first
12 pairs for a game whose protocol parted at `divTurn <= 1`. After these fixes no pair in the pool
parts before turn 2 — and the pool is FIVE pairs, not twelve, so the window was never the constraint.
Isolated properly: census bytes (626 rows, digest `5f4cb6861c5d`) and team pool (`9e0af19d6449`, 87
teams) held identical, only `medicham2-browser.js` swapped between HEAD and the fixed tree. GREEN on
HEAD, RED on the fix.

The clause never needed turn 1; it needs a divergence STRICTLY BEFORE the last turn played, which is
the identical red if the stop rule had not moved. It now takes the earliest-parting pair in the whole
pool and PRINTS which turn that was, so the demonstration can be watched weakening rather than
disappearing. **It is still a FOUND fixture and that is declared in the file:** the proper repair is a
`protoPlant` hook on `playGame` alongside the existing `statePlant`, which is a change to
`engine/game_differential.js` and belongs in its own pass with its own red. The assertion itself
(`turns <= divTurn`) is unchanged, so its red is inherited rather than newly claimed.

**2. `tests/staged_board.js` has three CLEAN scenarios that part, and they are NOT from this pass.**
`imposter-copies-the-body-opposite`, `hungerswitch-flips-every-turn`,
`roar-drags-whoever-is-standing-there`, all `SHORT`, byte-identical on releases `18b227eee69f` and
`39631097fcc7`. That file is not discovered by `tests/run-all.js` (it is not `test-*.js`), so nothing
gates it. **Reported, not touched.**

A caution for whoever reads that file next: **it plays a RELEASE SNAPSHOT, not the live tree.** With
no `--release` it opens the newest release, which is not necessarily the bytes you just wrote. Two
"control" runs of it here — one on HEAD's engine, one on the fixed engine — produced identical output
because both were reading the same frozen snapshot. That is the instrument working as designed and it
is very easy to misread as evidence.

**3. VOID (instrument desync) rose 5 → 7 of 777.** Games that used to stop at a drag divergence now
run longer and have more chances to desync a die address. Expected in direction, stated, not
investigated.

**4. `MEDFAILS.traceBodyOffField = 4` on all three runs, unchanged.** That is the wire queue's "ROAR
emitted by an OFF-FIELD body" row, whose register row `#224` is CLOSED — a regression with no open
row. Not mine, not moved, reported.

**5. The residual `drag: a different body` row is not a bench-order row.** It reads
`|drag|p1b|froslass <> |drag|p1a|sinistcha` — a different SLOT, which is an ordering shape, not an
index-into-the-bench shape.

**6. `docs/ENGINE.md` and three other ledgers were rewritten inside their `<!-- GENERATED -->` blocks
by a test run before I got to `status.js --write`.** No hand edit was made inside a generated block.

---

## GATES RUN GREEN AFTER BOTH BATCHES

`test-mechanics`, `test-forced-switch`, `test-forced-switch-mirror`, `test-entry-effects`,
`test-volatile-duration`, `test-end-state`, `test-resolution-order`, `test-encore-fail-silent`,
`test-bracket-regain`, `test-immunity-gate`, `test-nature-differential`, `test-protocol-trace`,
`test-wiring`, `test-engine-consistency`, `test-battle-api`, `test-tag-params-derived`,
`test-middle-identity`, `test-roster-arm-pin`, `test-charge`, `test-dead-volatile` — 20 of 20 PASS.

`node engine/status.js` reads **628/628 probed mechanics live, 0 missing**. Nothing else in the ENGINE
block moved: damage differential 5/6000, interaction matrix 1642/1642, tag coverage 273/292.

## FILES CHANGED

```
engine/medicham2-browser.js     #340 bench swap + MEDI_BENCH_APPEND revert; #343 self-rider gate;
                                two new counters
tests/test-mechanics.js         two new probes (move/forcesSwitch, move/typeRemovedForTurn)
tests/probe_drag_body.js        SUBJECT verdict inverted post-fix; a KNOB-MOVED clause added;
                                MEDI_BENCH_APPEND arm
tests/staged_board.js           new scenario a-failed-roost-grounds-nothing, with its break
tests/test-end-state.js         PART 2 fixture no longer requires a turn-1 divergence to exist
docs/ENGINE.md                  new section + hand list (generated block restamped by status.js)
data/mechanics-census.json      regenerated: 628/628
```

Nothing committed. Nothing pushed. `docs/ROADMAP.md` untouched.
