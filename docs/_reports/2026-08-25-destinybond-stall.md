# Destiny Bond and the stall counter — 2026-08-25 (ENGINE)

Both were rows in `data/game-differential.json`'s `end_state_not_compared`: fields that **nothing in
this repository read**, so a regression in either would have shown up as agreement. This pass wired
both, and wiring the first one found that **Destiny Bond was not implemented at all**.

---

## 1. THE AUTHORITY, DERIVED AT THE LINE

Re-derived on every run of `tests/probe_dbond_stall.js`, printed at the top of its output, never typed.

**Destiny Bond** — `data/moves.ts:3483-3526`. **No Champions override of the move**; `grep destinybond
data/mods/champions/*.ts` returns learnsets only. Confirmed this pass, not inherited.

```
accuracy: true      priority: 0     volatileStatus: 'destinybond'   noCopy: true
onFaint(target, source, effect) {
  if (!source || !effect || target.isAlly(source)) return;
  if (effect.effectType === 'Move' && !effect.flags['futuremove']) {
    this.add('-activate', target, 'move: Destiny Bond');  source.faint(); } }
onBeforeMovePriority: -1
onBeforeMove(pokemon, target, move) { if (move.id === 'destinybond') return;
                                      pokemon.removeVolatile('destinybond'); }
onMoveAborted(pokemon)             { pokemon.removeVolatile('destinybond'); }
onPrepareHit(pokemon)              { return !pokemon.removeVolatile('destinybond'); }
```

**The stall counter** — `data/conditions.ts:439-462`, condition `stall`. **No Champions override.**

```
duration: 2   counterMax: 729
onStart()      { counter = 3 }
onRestart()    { if (counter < counterMax) counter *= 3;  duration = 2 }
onStallMove()  { const ok = randomChance(1, counter); if (!ok) delete volatiles['stall']; return ok }
```

**The legal member set, derived BY CARRIER rather than assumed.** `stallingMove: true` is eleven moves
in the dex; five are `isNonstandard: 'Past'` and cannot be clicked here. The six legal ones, with the
count of legal species that can learn each:

```
banefulbunker(1)  kingsshield(1)  protect(231)  spikyshield(2)  detect(27)  endure(231)
[Past] burningbulwark  obstruct  silktrap  matblock  maxguard
```

All six carry identical `stallCounterChecks` params — asserted, not assumed:
`STALL_SHARED = {params:{firstCounter:3,growsBy:3,counterMax:729}, members:6, disagree:0}`.

---

## 2. WHAT BOTH ENGINES ACTUALLY HELD, PRINTED BEFORE ANYTHING WAS WIRED

`tests/probe_dbond_stall.js` (new, this run). Doubles, the differential's own driver, a legal Destiny
Bond carrier derived from the format's learnsets (Houndoom), a Toxic user derived the same way
(Garbodor). It asserts nothing and exits 0 whatever it finds.

### The probe was wrong before the engine was — twice

1. **Both slots must act.** The first version scripted slot 0 only; Showdown rejects a `pass` from a
   healthy body and all six scenarios threw at turn 1 with empty tables.
2. **The boundary index is 1-based with a lead-in row at `b0`.** `TDEATH` came out one turn late, the
   varied step landed on a turn the game never reached, and arms A1/A2/A3 printed **byte-identical
   tables**. Identical results across a varied knob mean the knob is unwired — and here the unwired
   knob was the probe's. Proved rather than assumed afterwards: a three-turn script yields four rows,
   and the bond appears at `b1` for a turn-1 click.

### Destiny Bond — BEFORE

| arm | what happens | medicham2 | Showdown |
|---|---|---|---|
| A1 chip KO, bond up | Toxic residual kills the holder | killer alive | killer alive |
| A2 **move** KO, bond up | Crunch kills the holder | **killer alive** | **KILLER FAINTED** |
| A3 move KO, **no** bond | control | killer alive | killer alive |
| A4 bond turn 1, user moves turn 2 | read at `b2` | **bond still 1** | bond 0 |
| A5 Destiny Bond twice | read at `b2` | **bond still 1** | bond 0 |

A3 is what makes A2 attributable: the same lethal Crunch with no bond leaves the killer standing on
both engines, so the A2 difference is the bond and not the attack.

### The stall counter — BEFORE (and after; it did not move)

`3^n` against `stall.counter`, every boundary, two scripts, twelve boundaries:

```
B1 five consecutive Protects      b0 0/0   b1 3/3   b2 9/9   b3 0/0   b4 3/3   b5 0/0
B2 Protect, skip, Protect, idle   b0 0/0   b1 3/3   b2 0/0   b3 3/3   b4 0/0   b5 0/0
```

Twelve boundaries, twelve exact matches, **including both resets** (`b3` in B1 is the turn the 1/9 roll
was lost and the counter deleted). The `NOT_COMPARED` row argued *"they are different quantities, not
two spellings of one, and a mapping between them would be this file inventing a rule."* The first half
is true and the conclusion does not follow: the map is medicham2's OWN, and its three constants come
off `stallCounterChecks` and therefore off `data/conditions.ts`.

---

## 3. WHAT LANDED

### `engine/medicham2-browser.js` — Destiny Bond, which was a 5-PP no-op

`grep destinybond` returned one substitute-bypass entry and three comments. The volatile was written by
the generic `statusInflict` applier and **read by nothing**. Three clauses, one knob:

- **the KO.** `destinyBondOnFaint(victim, source)` called from the move-damage faint step inside the
  hit loop (`_stepFaint`, the analogue of `faintMessages()`) and from Super Fang's halving branch. Four
  refusals asked separately: no source, an ally (`victim._sf === source._sf`), a source already dead,
  and — wired by WHERE the hook is called rather than by a test — **only a MOVE**. No residual site
  calls it, and the delayed-move payout (Future Sight) is not a call site, which is
  `!effect.flags['futuremove']`.
- **the window.** One line at the head of the `onBeforeMove` gate strips the volatile on **any** move
  attempt. Five cases enumerated first; every path that reaches an attempt ends with the old bond gone,
  which is why one line is the whole rule rather than a strip repeated at six `continue`s.
- **consecutive use.** `applyMoveVolatile` refuses a second Destiny Bond and removes the first — the
  authority's `onPrepareHit` verbatim. `_dbHeldAtGate` carries the evidence past the strip; the raw
  `_vol` test beside it is the CALLED-move path (`it._copied` skips the gate).

Keyed on the **volatile id** the tag already derives (`statusInflict.effects[].volatile`), never on the
move name — `engine/faces.js` makes exactly this argument for the seven moves whose whole mechanic is
which volatile they write.

Knob: `MEDI_NO_DESTINY_BOND=1` restores the no-op, stamps `MEDFAILS.destinyBondSuppressed`.
Counters: `destinyBondAsked / KO / RefusedAlly / SourceAlreadyDead / NoSource / ClearedOnMove /
ConsecutiveFail` — seven, not one, because the four refusals are four rules and a single total could not
tell "it never fired" from "it fired and was correctly declined".

### `engine/medicham2-browser.js` — the stall arithmetic lifted into one function

`stallCounter(n, sc)` / `stallCap(sc)` / `stallBoardCounter(n)`, exported. Not one number changed;
`_stallRoll` still reads the CLICKED move's own record and the shared one is now the fallback instead of
three literals. The comparator calls it rather than keeping a copy — otherwise the reader would be
checking its own belief about the decay against the authority.

### `engine/board_state.js` — two leaves

- `vol.destinybond`, presence, both sides. The condition carries no duration on either engine.
- `stall`, a **body-level** leaf rather than one inside `vol`, because it is a leaf an engine may be
  unable to express: a release cut before today exports no `stallBoardCounter`, and a `null` nested
  inside `vol` would compare null-against-null and read as **agreement**. At body level `walkBody`'s
  null rule fires and the skip is counted (`stall_leaf_skipped`). `game_differential.js` separately
  declares `stall_not_expressible_by_this_engine`, so the two reasons for a null are distinguishable.
- Mapping `stall-counter-is-the-denominator` added to `MAPPINGS`, with a red demonstration in both
  directions run through the engine's own function (`f(1)===3 && f(0)===0`, and `f(1) !== f(2)`).
  `mappings_all_proved: true` on the run.
- `stall` added to `POST_FAINT` and `null` on a STANDING party row, both for the reasons `vol` already
  has: `clearVolatile` drops the counter on a corpse, and `sf.team` is the whole party so a standing
  body would be reported twice.

**A leaf is projected THREE times and it was in two of the lists.** `mediBody`/`sdBody` build the body,
`benchRow` projects it, `partyMap` re-projects that. `stall` was missing from `partyMap`, so every bench
row compared `undefined` against `undefined` — equal, silent. Found by planting a stall counter on a
benched body and watching **nothing** be caught.

---

## 4. THE WIRING, PROVED BY PLANTED FAILURES

Four plants added to `engine/all_mechanics_fire.js --red`, two per leaf, each aimed at a different place
the same leaf can be wrong (ACTIVE and BENCH), none of them writing a protocol line.

| plant | `board_state.js` at HEAD | with it back |
|---|---|---|
| an ACTIVE body holds a DESTINY BOND nobody announced | **NOT CAUGHT** `NO-DIVERGENCE` | **CAUGHT** `STATE` |
| a BENCHED body walked off still holding a DESTINY BOND | **NOT CAUGHT** `NO-DIVERGENCE` | **CAUGHT** `STATE` |
| an ACTIVE body has TWO consecutive Protects on its counter | **NOT CAUGHT** `NO-DIVERGENCE` | **CAUGHT** `STATE` |
| a BENCHED body took its counter to the bench | **NOT CAUGHT** `NO-DIVERGENCE` | **CAUGHT** `STATE` |

`NO-DIVERGENCE` is the strong form: with the leaves stashed out nothing noticed at all. The block's own
control (`CONTROL FOR THE BOARD PLANTS`) is clean in both runs, every catch is on the leaf it was aimed
at, at the planted boundary, with no protocol line.

## 5. THE CENSUS PROBES, SHOWN RED FIRST

Three probes on `move`/`statusInflict`, each run under `MEDI_NO_DESTINY_BOND=1` (the pre-pass engine)
and then clean. Fixture: Houndoom at an explicit Speed of 200 against a Speed of 20 so the bond is up
before the attack lands; `curHP = 1` so no damage-roll question enters.

| probe | knob ON | knob OFF |
|---|---|---|
| Destiny Bond takes the body that landed the killing MOVE | `MISSING` — control `[true,false,183]`, test `[true,false,183]` | `LIVE` — control `[true,false,183]`, test `[true,true,0]` |
| Destiny Bond does NOT fire when the KO came from POISON | `MISSING` — chip `[true,false]`, move `[true,false]` | `LIVE` — chip `[true,false]`, move `[true,true]` |
| the window closes when its user moves again, and a second one FAILS | `MISSING` | `LIVE` — ordinary `[true,false]`, second bond `[true,false]`, idle `[true,true]` |

The second is **Will's own fixture** and it is a control immune for exactly one reason: same board, same
1 HP, same Destiny Bond click, only the SOURCE of the KO varied.

---

## 6. THE NUMBERS

Arm **`middle`**, **961 games** (`--games 1200`, a PAIR budget), release **`c592445fe011`**,
`--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`,
`--end-state --write`, turn cap 12. **This is a RE-BASELINE, not a delta** — the comparison itself
changed, so the two columns are two instruments.

| quantity | HEAD (`769186b4`) | after |
|---|---|---|
| census probed / live / missing | 701 / 701 / 0 | **704 / 704 / 0** |
| damage differential, all 16 corners | 0 of 6000 | **0 of 6000** |
| whole-game, arm `middle` | 961 games, 28 parted | **961 games, 28 parted** |
| causes | 27 | **27** |
| board-material | 10 causes / 10 games | **12 causes / 12 games** |
| narration-only | 17 causes / 18 games | **15 causes / 16 games** |
| DIFFERENT-END-STATE | 7 | **7** |
| largest end-state leaf family | `active[].hp` 3 games | **`active[].stall` 4 games** |
| `end_state_not_compared` rows | 7 | **5** |
| `all_mechanics_fire` STATE rows | 8 | **8** |
| roster items / abilities / moves DIFFER | 0 / 0 / 0 | **0 / 0 / 0** |

**THE RISE WAS PREDICTED AND IT IS THE INSTRUMENT REACHING FURTHER, NOT A NEW POPULATION.** Computed by
set difference against `git show HEAD:data/game-differential.json`, not by eye: the cause list is
IDENTICAL — `only in HEAD: []`, `only in NOW: []`, 27 causes and 28 games on both sides. Exactly two
causes changed VERDICT, and both are Protect:

```
NARRATION-ONLY -> BOARD-MATERIAL   ordering :: |move|p1b|protect <> |move|p2a|protect
NARRATION-ONLY -> BOARD-MATERIAL   unrelated event mismatch :: |-singleturn|p2a|protect <> |-fail|p2a
```

The second is the damning one: **one engine's Protect succeeded and the other's FAILED, and that was
being scored as WORDING.**

`data/mechanics-census.json`: `probed 704, live 704, missing 0, run_ok true, hollow 0, threw 0`.

---

## 7. THE DEFECT THIS FOUND AND DID NOT FIX — RANKED #1

**`active[].stall` is the largest board leaf family in the pinned pool: 6 games / 7 leaves at any
boundary, 4 games still differing at the last board.** It is the shield itself, not the counter: the
counter is only set by a successful shield, so the two engines disagree about **which Protect went up**.

The turn-1 witness, printed in full by the run:

```
Turn 1.  Side 1: Garchomp + Venusaur.   Side 2: Politoed + Swampert.
  Garchomp switches out to Charizard.  Venusaur clicks Protect.
  Politoed clicks Protect.             Swampert clicks Protect, and mega evolves.
  SHOWDOWN: Venusaur stall 3, Politoed stall 0.
  OURS:     Venusaur stall 0, Politoed stall 3.
  394 of 396 fields identical.
  seed …2653852449 vs …2653847784   config pair-protect-bust   release c592445fe011
```

Both engines agree about Swampert. They disagree about which of the other two held the **last action** —
`willAct()`, the `failsIfMovesLast` rule — on a board where a mega mid-turn re-sorts the queue and
Swampert-Mega's Speed (base 70) meets Politoed's (base 70). That makes it a turn-order/speed-tie
question, which is the most delicate area in this engine, and it needs its own probe and its own batch.
**Named and ranked, not fixed here**, per the brief.

A second instance appears inside an existing `all_mechanics_fire` STATE row (`healbell`, `stall
showdown 0 we 3`) — same family, same shape, and it did not raise the STATE count.

---

## 8. ANOTHER WRITER IS IN THE TREE, AND ONE FROZEN FILE MOVED MID-MEASUREMENT

The brief said *"You are the only agent running."* **That was not true.** Four files I never opened
changed in the working tree, with mtimes INSIDE this session's window, and they have since landed as
commit `224c8d6b` — *"The browser tag bundle drifted from its source again, 38 minutes after the last
drift was fixed"*, another division fixing the `data/abra-tags.js` staleness that sits on this ledger's
own hand list:

```
build/build_browser_data.js   07:35 UTC   +43 lines
build/build_tags_js.js        07:35 UTC   +72 lines
data/abra-tags.js             07:37 UTC   regenerated from data/tags.json
engine/artifact_audit.js      07:39 UTC   +89 lines
```

`data/abra-tags.js` is **one of the 26 frozen SOURCE files**, and it changed between my release cut
`68132134d131` and the end of the run — verified by digest, not by mtime:
`data/abra-tags.js 27e7a3cfa369 -> 4883ee33156a`, and nothing else in the set moved.

**The measurement survived, and it survived because it was a photograph.** The whole-game run read
`--release 68132134d131`, i.e. the frozen copy. It was then **re-run in full on `c592445fe011`, cut from
the tree as it now stands, and every headline number is identical** — 961 games, 28 parted, 27 causes,
12/12 board-material, 15/16 narration, the same end-state family table. That is the receipt that
`abra-tags.js` is a BROWSER mirror and the node engine reads `data/tags.json`, which did not move.

The three roster stages and `all_mechanics_fire` were also re-run **with `--write`** on `c592445fe011`;
the first pass omitted `--write` and left the artifacts stamped at `c6d45355668e`, which
`engine/status.js` correctly WITHHELD. The tree was verified to still match `c592445fe011` after every
run finished.

**Nothing of theirs was staged.** `git commit -- <paths>` by name. They committed their own work while
this pass was running, so the four files left the working tree on their side rather than mine.

**THE BASELINE COLUMN IS STILL `769186b4`, AND THAT IS CORRECT.** `224c8d6b` touches the two builders,
the browser bundle and `engine/artifact_audit.js` — nothing the node engine executes — and the identical
whole-game numbers on `68132134d131` (before their bundle regeneration) and `c592445fe011` (after it) are
the measured receipt for that, not an argument.

---

## 9. TESTS

Green: `tests/test-mechanics.js` (704/704), `tests/test-engine-diff.js --n 6000 --seed 20260804`
(0 of 6000 at all 16 corners), `tests/test-end-state.js`, `tests/test-game-diff.js`,
`tests/test-volatile-duration.js`, `tests/test-resolution-order.js`, `tests/test-encore-fail-silent.js`,
`tests/test-engine-consistency.js`, `tests/roster.js` x3, `engine/all_mechanics_fire.js --kind all`
and `--red`.

**RED MID-PASS, GREEN NOW, AND NEVER THIS PASS'S — RECORDED RATHER THAN DROPPED.** For about twenty
minutes `tests/test-no-silent-failure.js` reported **3 NEW silent catch blocks, all three in
`engine/artifact_audit.js`** (`:482`, `:488`, `:494`, all `flag('GAP', …)` skips; `NEW AND THEY
MANUFACTURE A VALUE: 0`) — the other writer's file, caught mid-edit. At `224c8d6b` it reads `NEW since
the baseline 0` with six baselined blocks now speaking. No file this pass touched contributes a silent
catch. It is written down because a red gate read once and not recorded is how *"one of the two known
failures"* happened.

`engine/game_differential.js` exits 1 on `planted_state_proof_ok: false` — **unchanged and byte-identical
to HEAD**: 42 plants, 13 not caught, the SAME 13 (seven side-B actives applied-and-not-caught, six bench
plants never applied). Already on the hand list as the highest-value item there.

---

## 10. OWED, NOT RUN

- `tests/run-all.js` in full.
- `tests/interaction_matrix.js` (last run 2026-08-11), `tests/mutation_harness.js`,
  `engine/selftest.js`, `engine/conformance.js`, `engine/feature_fixture.js --check`.
- **A POOL-SCALE READING OF THE SIX DESTINY BOND COUNTERS.** `game_differential.js` surfaces no
  `MEDSEEN`, so `destinyBondKO` has been proved by three census probes and by the roster row
  (`destinybond FIRED-AND-BOARDS-MATCH`) and has never been read over 961 pool games. The pool shows
  **zero** `vol.destinybond` divergences, which is consistent with both "it agrees" and "it never
  happened inside twelve turns", and those are different sentences.
- **The `active[].stall` family (§7).** Named and ranked, not diagnosed.
- **A CLEAN RE-BASELINE ON A QUIET TREE.** Every number here is from a release that matches the tree and
  was verified by digest after the last run finished — but the tree moved once mid-pass, from another
  session, and a second run under the same conditions is the only thing that turns "it survived" into
  "it was never at risk".
- `engine/feature_fixture.js` reports the damage table regenerated (318 species -> 322) and the fixture
  changed (10 -> 12 scenarios). **That is not this pass's** — `data/engine-data.js` and the builders are
  the other writer's. It is a MEASURE question and is flagged, not touched.
