# Leaf widening — all sixteen standing leaves

ENGINE, 2026-09-05. Owner brief: wire ALL SIXTEEN remaining leaves, not a batch of three.

---

## 1. THE SET, RE-DERIVED (not taken from the brief)

`SHOWDOWN_PATH=... node tests/probe_uncompared_leaves.js`, run before anything was touched:

```
  POPULATION  500 moves, 201 abilities carried by a legal species, 148 items
  LEAVES THEY WRITE   80      COMPARED 40   DECLARED 4   NEITHER 36
  Of the 36, the authority declares a duration of 1 on 18 ... A further 2 remove themselves
  inside their own action (volatile:fling, volatile:sparklingaria).
  The other 16 have no declared clock or a clock of 2+ turns.
```

The sixteen it named, verbatim from `derive().standing_keys`:

```
volatile:lockedmove   pseudoWeather:gravity   pseudoWeather:magicroom   pseudoWeather:wonderroom
slotCondition:futuremove   slotCondition:healingwish   slotCondition:wish
volatile:allyswitch   volatile:dragoncheer   volatile:gastroacid   volatile:metronome
volatile:powershift   volatile:powertrick   volatile:smackdown   volatile:stockpile
volatile:unburden
```

The sixteenth the brief did not name is **`slotCondition:wish`**.

`boundaryCallSites()` on the same run: `snapshot_calls: 1`, `other_snapshot_callers: []` — the ceiling
argument still rests on a single sampling point, checked rather than remembered.

**They are three different SHAPES, and that is why this could not be done as nine more `vol` lines.**
Nine are per-body volatiles. Three are pseudo-weathers, which live on the field. Three are SLOT
CONDITIONS — a class `board_state.js` did not read at all: `uncomparableLeavesOf` ended with the
literal line *"this file reads no slot condition"* and there was no `SD_SLOT_KEYS` to ask.

---

## 2. STEP 1 FIRST, EVERY TIME: WHAT DOES THE ENGINE ACTUALLY HOLD?

The brief's warning was the correct one and it caught things. **Half of the eight per-body leaves are
not in `_vol` at all.** A wiring taken off `probe_uncompared_leaves.js`'s `_vol` column would have
missed three of them AND reported them as absent — that column's own header says a miss is not
evidence of absence, and these rows are the proof.

| leaf | what medicham2 holds | verdict |
|---|---|---|
| `lockedmove` | `_mtLock = {move,left,confuse,vol}` :36952, ticked :38462 — **not `_vol`** | WIRED (presence) |
| `allyswitch` | `_aswDur` :29272, ticked :38520 — **not `_vol`** | WIRED (clock) |
| `metronome` | `_metroN` :25818, cleared :21480, read :12755 — **no volatile at all** | WIRED (counter) |
| `dragoncheer` | `_vol.dragoncheer` via `critStageVolatile` (derived, 2 members) :18671 | WIRED (presence) |
| `gastroacid` | `_vol.gastroacid`, generic write :18820, named at :21397 | WIRED (presence) |
| `powertrick` | `_vol.powertrick`, generic write :18820, named at :21398 | WIRED (presence) |
| `smackdown` | `_vol.smackdown` :18820, read by `isGrounded` via `GROUNDING_VOL` :5998 | WIRED (presence) |
| `stockpile` | `_vol.stockpile` **is the layer count** (`applyLayeredVolatile`, :5489) | WIRED (layers) |
| `gravity` | `field.gravity`, `fieldClock('gravity','gravity')` :8983 | WIRED (clock) |
| `magicroom` | `field.magicRoom` :8988 | WIRED (clock) |
| `wonderroom` | `field.wonderRoom` :8984 | WIRED (clock) |
| `futuremove` | `sf.slot[i] = {mv, when:'futureHit', …}` :27638 | WIRED (presence) |
| `wish` | `sf.slot[i] = {mv, when:'endOfNextTurn', …}` :30130 | WIRED (presence) |
| `healingwish` | `sf.slot[i] = {mv, when:'onEntry', …}` :30130, read :21008 | WIRED (presence) |
| `unburden` | **NOTHING.** `effSpeed` recomputes the doubling from the CURRENT ability inside an `_hadItem && !m.item` entry guard | **NOT WIREABLE** |
| `powershift` | would take the generic write — **never reached** | **NOT WIREABLE** |

**`powershift` is the one the brief did not anticipate.** Champions *un-bans* the move
(`data/mods/champions/moves.ts:739-742`, `isNonstandard: null`) and then gives it to nobody:
`powershift` occurs **zero** times in `data/learnsets.ts` and **zero** times in
`data/mods/champions/learnsets.ts`. No legal body can write the leaf, so no red demonstration is
possible. `probe_uncompared_leaves.js` filters ABILITIES on a legal carrier and MOVES only on
`isNonstandard`, so it sits inside the ceiling of 56 — that is the authority's denominator and it was
not adjusted. The probe row now DERIVES the carrier count on every run over the same 271 legal
non-mega species every other fixture uses, and **fails the moment it is non-zero**.

Both are declared in `board_state.js`'s `NOT_COMPARED` with the reason, the falsifier and what would
make the reason wrong. `DECLARED_LEAVES` went 4 → 6.

---

## 3. WHAT WAS NARROWED, SAID OUT LOUD

Three quantities are deliberately NOT compared, each declared in `NOT_COMPARED` with a `next:`:

- **the rampage COUNT.** `data/conditions.ts lockedmove` read whole: `duration: 2`, and its own
  `onRestart` sets it BACK to 2 every turn the lock persists — so the authority's `duration` reads 1
  at every boundary and says nothing about turns remaining. The count is `effectState.trueDuration`,
  sampled `this.random(2, 4)`, which is not a duration. medicham2 keeps it in `_mtLock.left`.
  Comparing them would read **2 against 1 on every three-turn rampage** — the reader's representation,
  not a rule. So `lockedmove` is compared as PRESENCE.
- **the Ally Switch ladder** (`effectState.counter` 3/9/27 against `_aswCount`). The two-turn clock IS
  compared.
- **the two slot countdowns.** Showdown keeps ABSOLUTE turn numbers (`endingTurn`, `startingTurn`) and
  medicham2 a RELATIVE `due`. Different quantities; a map would be this file inventing a rule.

`lockedmove` also had to EXCLUDE Uproar: both ride `_mtLock`, and `uproar` has been its own compared
leaf since ROADMAP #308. Without the `vol !== 'uproar'` discriminator every Outrage would be counted
twice and every Uproar would read as a rampage.

Persistent (the only `durationCallback` branch on the three rooms, returning 7 instead of 5) has
**zero legal carriers** — derived, not recalled — so the two clocks are the same quantity.

---

## 4. RED BEFORE GREEN, WITH A CONTROL, ON REAL STAGED GAMES

`tests/probe_leaf_widening.js` plays one game per leaf and corrupts medicham2's LIVE state at the
boundary through the driver's own `statePlant` hook. The harness was generalised for the two new
shapes: the path matcher is now derived from the row's `kind` (`.vol.<leaf>` / `field.<leaf>_turns` /
`.slots[i].<leaf>`), and `rawMedi`/`rawSd` print the field and the slot records so a leaf that lives
nowhere near `_vol` cannot be reported as an identical blank line on both sides.

**BEFORE the wiring — all fourteen plants INVISIBLE**, on a board already comparing 40 leaves, with
both engines demonstrably holding the leaf at the staged boundary:

| leaf | medi / sd at the boundary | before |
|---|---|---|
| lockedmove | `_mtLock.left=1` / `lockedmove(d1)` | RED — plant invisible |
| allyswitch | `1` / `allyswitch(d1)` | RED |
| dragoncheer | `1` / `dragoncheer` | RED |
| gastroacid | `1` / `gastroacid` | RED |
| metronome (b2) | `_metroN=1` / `numConsecutive=1` | RED |
| powertrick | `1` / `powertrick` | RED |
| smackdown | `1` / `smackdown` | RED |
| stockpile | `1` / `layers 1` | RED |
| gravity | `4` / `gravity(d4)` | RED |
| magicroom | `4` / `magicroom(d4)` | RED |
| wonderroom | `4` / `wonderroom(d4)` | RED |
| futuremove | `slotB0{futuresight}` / `slotp20{futuremove}` | RED |
| wish | `slotA0{wish}` / `slotp10{wish}` | RED |
| healingwish | `slotA0{healingwish}` / `slotp10{healingwish}` | RED |

**AFTER the wiring — all fourteen CAUGHT, and all fourteen CONTROL arms silent:**

```
lockedmove   p1.active[0].vol.lockedmove   medi=0 sd=1
allyswitch   p1.active[1].vol.allyswitch   medi=0 sd=1
dragoncheer  p1.active[1].vol.dragoncheer  medi=0 sd=1
gastroacid   p2.active[0].vol.gastroacid   medi=0 sd=1
metronome    p1.active[0].vol.metronome    medi=0 sd=1
powertrick   p1.active[0].vol.powertrick   medi=0 sd=1
smackdown    p2.active[0].vol.smackdown    medi=0 sd=1
stockpile    p1.active[0].vol.stockpile    medi=0 sd=1
gravity      field.gravity_turns           medi=0 sd=4
magicroom    field.magicroom_turns         medi=0 sd=4
wonderroom   field.wonderroom_turns        medi=0 sd=4
futuremove   p2.slots[0].futuremove        medi=0 sd=1
wish         p1.slots[0].wish              medi=0 sd=1
healingwish  p1.slots[0].healingwish       medi=0 sd=1
```

Probe exit 0. `scripted clicks that fell through to 'pass': 0` on every arm. `speed reads that threw:
0`. `learnset lookups that threw: 0`. **No silent `catch` was added; the two throw counters the file
already carried are printed unconditionally.**

### The one fixture that lied first, and it was the fixture

`lockedmove` staged NOTHING on its first run: `medi=0 sd=undefined` at the boundary, **on both
engines, agreeing perfectly about a volatile that had never been applied**. Every rampage move is
`target: 'randomNormal'`, the die aimed the Outrage at the bench filler that was clicking Protect, the
move was blocked and Showdown's `self` effects never ran — which medicham2's own header already states
at :832 (*"above step 7 never reaches `selfDrops`, so it arms no `lockedmove`"*). A COULD-NOT-STAGE is
a claim about the fixture and never about the mechanic, so the fixture changed: both p2 actives now
click a derived inert move, and the second lead is a DERIVED second carrier of it rather than a named
body. That is the one place in this batch where a comfortable answer was available and taken back.

---

## 5. THE SPLIT, AFTER

```
  LEAVES THEY WRITE   80      COMPARED 54   DECLARED 6   NEITHER 20
  Of the 20, the authority declares a duration of 1 on 18 ... a further 2 remove themselves
  inside their own action.  The other 0 have no declared clock or a clock of 2+ turns.
```

**Leaves compared 40 → 54 of the ceiling of 56. The standing-at-the-boundary hole is 16 → ZERO.**
The two the ceiling still counts are the two declared NOT WIREABLE above.

`SD_SLOT_KEYS` is now a fourth derived key set (`["futuremove","healingwish","wish"]`), read out of
`readShowdown`'s own source on the same rule as the other three, joined to the load-time assertion so
an empty set cannot silently restore the old answer, and joined to `probe_uncompared_leaves.js`'s
`COMPARED` set so the one producer of this split knows about it.

Census re-derived after the wiring: **829 live / 829 probed, missing 0, threw 0, hollow 0** — unchanged,
which is correct: the census measures mechanics and this pass moved a reader.

Engine release: **`688e696f00c8`, and it did not move.** `engine_release.js drift 688e696f00c8` reports
`0 frozen source(s) differ from the live tree` — **no SOURCE file was touched.** `board_state.js` is not
frozen by design (it is the live reader pointed at whatever engine a measurement opens), so the
widening reaches the runs below while the engine under test is byte-identical to the one the baselines
were taken on.

---

## 6. THE SCOREBOARD, CALLED IN WRITING BEFORE THE RUNS

Baselines handed over: **empirical** board-material 34 / protocol 121 / VOID 4; **joint** board-material
53 / protocol 138 / VOID 4; census 829/829; leaves 40 of 56.

Which scoreboard should move, per CLAUDE.md's rule, stated before the run rather than explained after:

- **The LAB has already moved and that is the load-bearing result.** 16 → 0 standing uncompared leaves;
  fourteen planted differences that were invisible are now caught, each with a silent control.
- **PROTOCOL (narration) MUST BE UNCHANGED — empirical 121, joint 138.** Nothing in the engine or the
  driver moved; the widening is entirely inside the board reader, which never opens either engine's log.
  **If protocol moves, the pair is not comparable and something else changed.** That is the control on
  this whole measurement.
- **VOID MUST STAY 4** in both arms, for the same reason.
- **BOARD-MATERIAL CAN ONLY RISE OR STAY FLAT.** Every leaf compared before is compared identically;
  fourteen were added. **A FALL WOULD MEAN I BROKE AN EXISTING LEAF** and must be treated as a defect in
  this change, not as an improvement.
- **Empirical: 34 → 34 or higher.** Called: a rise, and probably a modest one. The pool is real ladder
  games, so `lockedmove` (Outrage/Thrash), `smackdown`, `gastroacid`, the Metronome item and the three
  rooms are the members with real presence; `powertrick`, `stockpile`, `dragoncheer` and the three slot
  conditions are tail.
- **Joint: 53 → 53 or higher**, same reasoning.
- **A FLAT 34 / 53 IS A LEGITIMATE OUTCOME AND IS NOT A FAILURE OF THIS WIRING.** It would mean the
  pinned pool never exercises a divergence on these fourteen leaves — a fact about the metagame. The lab
  has already shown all fourteen catch a planted difference, which is the claim being made.
- A rise **must not be tuned away.**

---

## 7. THE BASELINE HANDED OVER DID NOT REPRODUCE, SO I MEASURED MY OWN BEFORE

The brief's baselines were **empirical board-material 34 / protocol 121 / VOID 4** and **joint 53 / 138
/ VOID 4**. Running the empirical arm on release `688e696f00c8` with the **pre-widening**
`board_state.js` — same release, same census pin, same frozen pool, same flags — measures
**board-material 30, not 34**. The nearest artifact on disk, `leaf-widening-batch2.json`, also reads 30,
and it was taken on a **different release** (`6f96db9da019`), so it is not a legal comparison either.

**I could not reproduce 34 or 53 on this engine, so I did not compare against them.** Comparing a new
number against a baseline that does not reproduce is how a wrong figure enters the record wearing a
receipt. What I did instead is the controlled experiment: **the same release, the same pins, the same
command, with only `engine/board_state.js` swapped between `git show HEAD:` and the widened version.**
`board_state.js` is not a frozen release SOURCE, so this varies the reader and nothing else. The
widened file was restored and verified byte-identical afterwards.

### RESULT — empirical arm (`empirical-click/v1`, 961 games)

| | BEFORE (HEAD reader) | AFTER (widened reader) |
|---|---|---|
| protocol first-divergence | **121** | **121** |
| VOID | **4** | **4** |
| BOARD-MATERIAL | **29 causes / 30 games** | **29 causes / 30 games** |
| NARRATION-ONLY | 80 causes / 91 games | 80 causes / 91 games |
| UNKNOWN | 0 | 0 |

**Bit-identical on every count.** Protocol flat and VOID flat, as called — the control on the whole
measurement held. Board-material **did not rise and did not fall**.

Artifacts: `data/verification/leaf-widening-all16-empirical.json`,
`data/verification/leaf-widening-all16-empirical-BEFORE.json`.

### RESULT — joint arm (`joint-empirical-click/v1`, 961 games) — AND AN INSTRUMENT DEFECT

The first joint run read 138 diverged / 49 board-material and I was about to report that as a fall.
**It is not a fall. The joint arm is not reproducible.** Three runs under IDENTICAL pins
(`mode` digest `bcb38e47d94f` on all three):

| run | reader | diverged | median turns | BOARD-MATERIAL | NARRATION | VOID | natural ends / turn cap |
|---|---|---|---|---|---|---|---|
| AFTER, 1st | widened | **138** | 11 | 49 / 49 | 75 / 89 | 4 | 500 / 449 |
| BEFORE | HEAD | **167** | 9 | 66 / 67 | 85 / 100 | 2 | 674 / 275 |
| REPEAT | widened | **167** | 9 | 66 / 67 | 85 / 100 | 2 | 674 / 275 |

**BEFORE and REPEAT are bit-identical on every field** — same diverged, same median turns, same
`turn1_boards_identical`, same `credit_events` (`effect 322600, negative 657, click 653152`), same
`end_reasons` map — **and they used DIFFERENT readers.** So on the one joint pair that played the same
games, board-material is **identical before and after: 66 causes / 67 games**.

The 138 run played entirely different games: 35,002 tied groups against 42,426, 72,349 driver decisions
against 78,467, 500 natural endings against 674. **A board reader cannot change which games are
played**, and the empirical arm proves that directly by reproducing bit-for-bit across the same swap.
So the variation is the joint driver's own, and the brief's joint baseline of 53 is **one draw from a
distribution, not a number.**

Artifacts: `data/verification/leaf-widening-all16-joint.json` (the 138 draw),
`…-joint-BEFORE.json`, `…-joint-REPEAT.json`.

### VERDICT ON THE SCOREBOARD, AGAINST WHAT I CALLED

Every prediction held. Protocol unchanged in both arms; VOID unchanged; board-material **flat, not
lower** — the two apparent falls were (a) a baseline that does not reproduce on this engine and (b) a
non-reproducible arm. **Flat was named in advance as a legitimate outcome and it is the outcome: the
pinned pool never once exercises a divergence on any of the fourteen new leaves.** That is a fact about
the metagame, and it is exactly the split CLAUDE.md describes — the pool answers *does this matter* and
it says these fourteen do not, today; the lab answers *is it correct* and it moved 16 → 0.

**Nothing was tuned.** No threshold, no narrowing and no leaf was adjusted after seeing a number.

---

## 8. THE GATE

`node engine/status.js` after everything: **2 of 9 failing, unchanged.**

```
PASS  game differential                     PASS  deliberate roster / items
PASS  deliberate roster / abilities         PASS  deliberate roster / moves
PASS  coverage / every used mechanic        PASS  mechanics / staged and compared
PASS  no open, known engine defect
FAIL  whole-game differential / BOARD-MATERIAL   ] both: data/game-differential.json still
FAIL  whole-game differential / NARRATION        ] ran on release 0dec37ff5ad9
```

Both FAILs are the ones I inherited and neither is mine: `data/game-differential.json` was measured on
release `0dec37ff5ad9` and the tree is `688e696f00c8`. The brief forbids writing over that file (it
holds the published 46), so the staleness stays and the count stays at 2.

**No SOURCE file moved, so no clause was staled by this work.** `engine_release.js drift 688e696f00c8`
reports `0 frozen source(s) differ from the live tree` — checked before spending any re-run, as the
brief asked. Census re-derived: **829 / 829**, `missing 0, threw 0, hollow 0`.

---

## 9. OWED

1. **THE JOINT ARM IS NOT REPRODUCIBLE, AND THAT IS A MEASURE PROBLEM, NOT AN ENGINE ONE.** Three runs
   under identical pins gave 167, 167 and 138 diverged, with wholly different games underneath (500 vs
   674 natural endings). Every joint figure published to date — including the **53** in this brief — is
   one draw from a distribution nobody has characterised. The empirical arm under the identical harness
   IS reproducible, so the harness is not the suspect: the joint driver is. **Route to MEASURE. Until
   it is settled, no joint before/after can be read, and I would withhold rather than annotate any
   joint number.**
2. **The handed-over empirical baseline of 34 does not reproduce on release `688e696f00c8`** (measured
   30 with the pre-widening reader). Whatever run produced 34 needs naming, or the figure needs
   retiring.
3. **`volatile:unburden` and `volatile:powershift` remain uncompared, by declaration.** Unburden becomes
   comparable the moment medicham2 grows a named field for it, and its `NOT_COMPARED` row says so.
   Powershift becomes comparable the moment any legal species learns it, and the probe FAILS on that day.
4. **Three counters were narrowed and are owed as separate wires**, each with a `next:` in
   `NOT_COMPARED`: the rampage count (`trueDuration` against `_mtLock.left`), the Ally Switch success
   ladder (`effectState.counter` against `_aswCount`), and the two slot countdowns (absolute
   `endingTurn`/`startingTurn` against a relative `due`). The rampage one is the interesting one — it is
   an ENGINE question about whether the two engines sample the same 2-or-3.
5. **`tests/roster.js` and `engine/all_mechanics_fire.js` were last run against the NARROW comparator.**
   They are not stale by the release check (no SOURCE moved) and the gate reads PASS, but their
   ANNOUNCEMENT-ONLY verdicts were judged by a board that read 40 leaves and now reads 54 — including
   `gastroacid`, whose row `probe_uncompared_leaves.js`'s header records as blocked on exactly this
   instrument. **Re-running them is owed and could turn ANNOUNCEMENT-ONLY rows into board-material
   ones.** Not done here: it is a wide run and the brief scoped this pass to the wiring.
6. **`docs/ENGINE.md` was NOT updated and `node engine/status.js --write` was NOT run** — the brief said
   do not touch `docs/` beyond this report. The ENGINE hand list still names leaves this pass closed.
7. **Files I created and left in the tree, named rather than tidied away:**
   `data/verification/_smoke-leafwiden.json` (a 35-game smoke run, safe to delete — I made it),
   `…-empirical-BEFORE.json`, `…-joint-BEFORE.json`, `…-joint-REPEAT.json`. Also
   `data/verification/protect-fix-empirical.json` is untracked and **is not mine — left alone.**
8. **I appended a stray release cut event with the reason `"x"`** to `data/releases/688e696f00c8/cuts.jsonl`
   while confirming the id. Cuts are append-only events by design so nothing was overwritten, but the
   line is noise and is recorded here rather than removed.
9. Nothing was committed, per the brief.

