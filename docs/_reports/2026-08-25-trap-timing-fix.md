# THE TRAP IS EVALUATED AT CHOICE TIME NOW. GATE 18 → 17 OF 961, BOARD-MATERIAL 10 → 8.

2026-08-25. ENGINE. BEFORE leg on release `2ecd3bdc274b` (MEASURE's, at `HEAD`); AFTER leg on release
`d38d117e68e9` (cut by this pass). Everything else pinned identically.

---

## 0. VERDICT

**The gate clause reads `17 of 961 = 1.8% DIVERGE`, from `18 of 961 = 1.9%`.** Raw parted 23 → 22,
board-material **10 causes / 10 games → 8 / 8**, narration-only 12/13 → 13/14.

`tests/probe_trap_timing.js` proves it: eight arms, green on the fixed tree, and it re-runs ITSELF
under `MEDI_TRAP_AT_EXECUTION=1` and asserts the child exits non-zero. It does — `child exit 1 — RED,
as required`.

**AND THE MOVE-TRAP BRANCH SHARED THE BUG.** The brief asked whether the other refusal branches on the
same block have the same phase gap. Staged and measured: **yes for `_trapHard` (Block / Mean Look),
with the opposite sign** — the engine's own counter prints
`snorlax choice=move exec=null`. It is fixed by the same lines. Fairy Lock and the partial trap are on
the same lines too but were NOT staged; see §5.

---

## 1. THE PREDICTION, AND WHAT ACTUALLY HAPPENED

MEASURE put the expected effect on the record before the fix. Scored against it:

| | predicted (honest range) | measured | verdict |
|---|---|---|---|
| raw parted | 21 (21–22) | **22** | in range, at the upper end |
| gate clause of 961 | 16 (16–17) | **17** | in range, at the upper end |
| board-material causes | 8 (8–9) | **8** | **exactly** |

**NOTHING MOVED THAT WAS NOT PREDICTED. Two games changed and no others**, diffed game-by-game on the
`config|seed` key rather than eyeballed:

```
GONE
  omit-protect  ...2656624602 vs ...2657402800   t8
      event missing from medicham2 :: |switch|p2a|crabominable <> |cant|p1b|recharge
MOVED
  pair-redirect-priority  ...2656847681 vs ...2656808520   t11 -> t12
      was:  event missing from medicham2 :: |switch|p1a|krookodile <> |detailschange|p1b|charizardmegay
      now:  unrelated event mismatch     :: |-fail|p1a <> |-start|p2a|torment
NEW
  (none)
```

**Both target rows left.** The reason the count is 22 and not 21 is the caveat MEASURE wrote down —
*"the game carries a second, later disagreement in the same config and may simply re-part at a later
turn"* — **and it landed on the other game.** MEASURE expected `omit-protect` to re-part;
`omit-protect` cleared outright and `pair-redirect-priority` re-parted at t12 on Torment, which has
nothing to do with trapping. The board-material figure is unaffected because the new t12 row is
narration-only (narration causes 12 → 13, games 13 → 14).

**This is not an over-delivery and it is not a shortfall.** Exactly the two rows aimed at left the
list, and one of the two games kept playing far enough to hit an unrelated pre-existing defect.

---

## 2. THE DEFECT

`Side#chooseSwitch` refuses a trapped switch when the REQUEST is built — `Pokemon#runTrapped` runs
during `makeRequest`, before a single action of the turn — and **nothing re-asks it**. Once a switch is
in the queue, `Battle#runAction`'s `case 'switch'` performs it; there is no second trap test between
the commit and `actions.switchIn`.

medicham2 asked the question inside the switch's own execution branch. A bare switch is order 103 and
the four of them resolve in OUTGOING-speed order, so a Shadow Tag body brought in by a FASTER switch
was on the field by the time a slower switch on the other side came up — and **retro-cancelled a
switch the authority had already accepted and performed.**

In both corpus games the arriving body is a **Gengar-Mega**, the format's only legal `preventsSwitch`
carrier (derived from `data/tags.json` × the format dex, not recalled).

---

## 3. THE FIX

`engine/medicham2-browser.js`, three edits:

1. **`switchTrapVerdict(m, foes, field)`** — a PURE function holding all four refusal branches
   (`preventsSwitch`, `_trapHard`, Fairy Lock, `_trap`) and all their exemptions (Ghost, `escapesTrap`,
   the Shadow-Tag mirror, `onlyTypes`, `onlyGrounded`). It returns `{block, shed}`; `shed` is a COUNT
   rather than a flag so the pre-fix `shedShellEscapedTrap` arithmetic (once per branch walked past) is
   preserved exactly.
2. **The stamp**, immediately after the commit-queue sort and before any action runs — the authority's
   `makeRequest` moment. Only a bare switch is stamped, tested with the file's own `sdChoiceOf`, which
   is the same test the execution branch's `!a.mv` gate expresses.
3. **The read**, at the switch's execution. The live verdict is computed anyway and compared, so the
   size of the phase gap is MEASURED per branch instead of argued about.

**All four branches moved, because the authority has one `runTrapped` and not four.** The ability trap
is the branch a trapper can newly ARRIVE on; the other three are branches a trap can newly LAPSE on.
Splitting them would put two rules where the authority has one.

New counters: `MEDSEEN.trapChoiceTimeDiffered{,Ability,Move,Fairy,Partial,First}`,
`MEDFAILS.trapVerdictUnstamped{,First}` (the loud fallback — a bare switch that reached execution with
no stamp; must read 0), `MEDFAILS.trapAtExecutionRestored` (set only when the knob actually changed an
answer).

Knob: **`MEDI_TRAP_AT_EXECUTION=1`** restores the pre-fix read.

---

## 4. THE PROBE — RED FIRST, WITH THE KNOB

`tests/probe_trap_timing.js`, release `d38d117e68e9`. Not a gate, not in `run-all.js`.

```
  trapper    Gengar-Mega / Shadow Tag   (derived: the only legal `preventsSwitch` carrier)
  victim     snorlax spe 30   leaves AFTER whimsicott spe 116
  move trap  Meowstic-M-Mega spe 124 / meanlook   (derived: fastest legal carrier of block/meanlook
                                                   that is not itself an ability trapper)

  A TEST     trapper ARRIVES this turn     expect AGREES             -> AGREES
      trapChoiceTimeDiffered +1   trapChoiceTimeDifferedAbility +1
  B CONTROL  entrant carries no trap       expect AGREES             -> AGREES
  C CONTROL  victim holds a Shed Shell     expect AGREES             -> AGREES
  D CONTROL  victim is a Ghost             expect AGREES             -> AGREES
  E POSITIVE trapper ALREADY on field      expect AUTHORITY REFUSES  -> THREW: Can't switch: The
                                                                        active Pokémon is trapped
      trapBlockedSwitch +1
  F POSITIVE as E + a Shed Shell           expect AGREES             -> AGREES   shedShellEscapedTrap +1
  G POSITIVE as E + a Ghost victim         expect AGREES             -> AGREES
  H SECOND   the MOVE trap, lapsing mid-turn                         -> THREW (the authority refuses)
      moveTrapBlockedSwitch +1   trapChoiceTimeDiffered +1   trapChoiceTimeDifferedMove +1
```

**WHY THREE POSITIVES AND NOT ONE.** MEASURE's original arms C and D (Shed Shell, Ghost victim) no
longer hold their exemptions down after the fix: with the trapper ARRIVING mid-turn, nobody is trapped
at choice time and neither exemption is ever consulted, so both arms would pass on an engine that had
simply deleted the trap. **F and G move the same two exemptions to the phase where they ARE
consulted** — trapper already on the field — and the authority accepts both switches. E is what stops
the trap being deleted outright: same trapper, same victim, same switch, one phase earlier, and
Showdown refuses in its own words. C and D are kept because they still control the ARRIVAL arm.

**THE KNOB IS RUN, NOT DESCRIBED.** The probe re-executes itself with `MEDI_TRAP_AT_EXECUTION=1` and
one exit rule for both runs (it asserts the FIXED state and nothing else — an inverted expectation
under the knob would pass on an engine that had stopped playing the fixture):

```
  --- re-running THIS FILE under MEDI_TRAP_AT_EXECUTION=1; it MUST exit non-zero ---
    A TEST     trapper ARRIVES this turn     expect AGREES  -> *** PARTS *** at reduced index 6
    FAIL  A  the arriving trapper no longer cancels a chosen switch
    child exit 1 — RED, as required
```

Under the knob **only arm A moves**. B–G are unmoved and H's `moveTrapBlockedSwitch` goes 1 → 0 with
`trapAtExecutionRestored` 1, which is the move branch's half of the same knob.

---

## 5. THE OTHER THREE BRANCHES — WHAT WAS MEASURED AND WHAT WAS NOT

The brief asked whether the move-trap and Fairy Lock branches share the mechanism. They sit on the same
block and the fix covers all four with the same lines. What is MEASURED differs per branch and is said
per branch:

| branch | can its answer change mid-turn? | evidence |
|---|---|---|
| `preventsSwitch` (ability) | **YES — it can ARRIVE.** A trapper walks in on a faster bare switch. | arm A, plus the two corpus games |
| `_trapHard` (Block / Mean Look) | **YES — it can LAPSE.** The trap dies with its source, and the source leaving is itself a bare switch that can resolve first. | **arm H, staged and measured**: `trapChoiceTimeDifferedMove +1`, first instance printed as `snorlax choice=move exec=null`. Knob OFF refuses (matching the authority, which rejects the choice); knob ON lets the body out. |
| `_trap` (partial trap — Fire Spin, Infestation…) | **the same LAPSE shape** — `_trap` is cleared when its trapper leaves the field. | **NOT STAGED.** Every partial-trap move deals damage and carries a 4–5 turn duration RANGE, so a damage-free, die-free fixture of the kind arms A–H use cannot be built from one. `trapChoiceTimeDifferedPartial` exists to catch it. OWED below. |
| Fairy Lock | **no, within a turn** — it is a FIELD pseudo-weather set by a MOVE (all moves resolve after all bare switches) and decremented only at the residual, so its value is constant across the switch phase. | **NOT STAGED, and the reasoning is not the evidence.** `trapChoiceTimeDifferedFairy` is the counter that would say otherwise. OWED below. |

**`game_differential.js` surfaces no MEDSEEN**, so none of these four counters has a pool-scale reading.
That is the same standing gap ENGINE.md already records for `roomItemIsLostRestored`, and this pass
could not close it: ENGINE may not edit `game_differential.js` in this batch.

---

## 6. THE MEASUREMENT — PINS AND IDENTITY

Both legs: `--games 1200` (a PAIR budget → **961 played**), `--arm middle`, turn cap **12**,
`--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`,
`--end-state`.

| | BEFORE (`2ecd3bdc274b`, MEASURE's leg at HEAD) | AFTER (`d38d117e68e9`, this pass) |
|---|---|---|
| `generated` | 2026-08-25T22:37:01.443Z | **2026-08-26T00:14:52.442Z** |
| games played | 961 | **961** |
| DIVERGED | 23 | **22** |
| gate clause | 18 of 961 = 1.9% | **17 of 961 = 1.8%** |
| BOARD-MATERIAL | 10 causes / 10 games | **8 / 8** |
| NARRATION-ONLY | 12 causes / 13 games | 13 / 14 |
| shape RULE / EMISSION / ORDERING | 10 / 9 / 4 | **10 / 8 / 4** |
| `planted_divergence_proof_ok` | true | **true** |
| switch addressing: sent / permuted / MISADDRESSED | 63,258 / 43,125 / **0** | 63,258 / 43,125 / **0** |
| medicham switch lookups MISSED | 3 | **2** |

The stamp moved and `publish_guard.js` did not divert the run — `data/game-differential.json` itself
carries the new figures.

**`medicham_lookup_missed` 3 → 2 is a consequence, not a second fix.** MEASURE named the third miss as
`omit-protect t9 wanted metagross` and attributed it to the t8 trap defect leaving Metagross standing
here and benched on Showdown's side. t8 is fixed and the miss is gone, exactly as that attribution
predicted.

### Everything else, re-run because the tree moved

An engine change strands every artifact cut against the old release, so three gate clauses went to
WITHHELD and were re-earned rather than left annotated:

| instrument | before | after |
|---|---|---|
| roster / items | 0 DIFFER, 0 DID-NOT-FIRE, 139 match | **0 / 0 / 139** |
| roster / abilities | 0 / 0 / 130 | **0 / 0 / 130** |
| roster / moves | 0 / 0 / 475 | **0 / 0 / 475** |
| `all_mechanics_fire` STATE rows | 8 (moves 5, abilities 2, items 1) | **8 (5 / 2 / 1)** |
| mechanics clause | 10 of 17 played-and-uncleared [moves 13, abilities 3, items 1] | **identical** |
| census | 706 probed / 706 live / 0 missing | **706 / 706 / 0** |

**The census is unmoved and that is correct, not a miss.** All four trap branches already carry LIVE
census rows (`ability preventsSwitch`, `move trapsTarget` ×5, `move partialTrap` ×3, `move setsRoom`
for Fairy Lock). What changed is *when* the question is asked, and a single-turn staged census probe
structurally cannot ask a phase question — that is what `probe_trap_timing.js` exists for.

**WHICH SCOREBOARD THIS SHOULD MOVE, SAID BEFORE THE RUN.** Gengar-Mega is the format's only trapper
and it must switch in on the same turn as an opposing bare switch, so the LAB was expected to gain
nothing (the mechanic was already probed) and the POOL to lose exactly the two games the mechanism was
found in. That is what happened.

---

### The suite, and the attribution of every red in it

`tests/run-all.js` on this tree: **132 passed, 29 failed, 2 skipped.** MEASURE measured **29 failing**
on the same tree two hours earlier, before this change. **The count is identical, and so is the list.**

Not asserted — measured. Every one of the 29 was re-run at **HEAD sources** (`git checkout HEAD --
engine/medicham2-browser.js tests/probe_trap_timing.js`, both files digest-verified back afterwards),
one at a time and by name, under the suite's own `ABRA_STRICT_SEMANTICS=1`. **Every one exits with the
same code at HEAD as it does with this change**, `test-engine-diff.js` on 3 and the rest on 1. None of
them is this pass's.

The comparison isolates the SOURCE change, which is what this pass controls; it does not revert the
artifacts regenerated above, and it does not need to — the question asked is whether the simulator
edit turned anything red.

*(Worth recording because it wasted twenty minutes: `test-forced-switch.js` exits **0** standalone and
**1** under the suite. The suite sets `ABRA_STRICT_SEMANTICS=1`, which turns the standing
`feature_fixture --check` warning — fixture identity AND a regenerated damage table, i.e. REFIT OWED —
into a throw. That is a MEASURE-owned condition of this tree, not a switch defect.)*

### One process error, corrected, and recorded rather than tidied away

Those HEAD baseline runs required `engine/game_differential.js` **without `--release`**, which CLAUDE.md
records as CUTTING A RELEASE at require time. It did: `data/engine-release.json` was rewritten at
`00:30:12Z` to point at **`2ecd3bdc274b`** — the reverted tree — and the first clean `quarantine.js` run
afterwards therefore reported *"this artifact ran on release d38d117e68e9 and the tree is
2ecd3bdc274b"* on five clauses. **The artifacts were right and the pointer was wrong.** Corrected by
re-cutting the restored tree (identical content → the same id `d38d117e68e9`) and re-running
`provenance.js` and `quarantine.js`, plus the four artifact writers that had run against the reverted
bytes (`conformance.js`, `em_validation.js`, `artifact_audit.js`, `validate_damage.js`,
`tests/test-engine-diff.js`). The gate then reads roster items/abilities/moves **PASS** and whole-game
**17 of 961**, which is the figure quoted throughout this report.

## 7. WHAT THIS DOES NOT LICENSE

- It is one release, one pool, one census pin, **cap 12**. Every board-material figure here is a claim
  about the first twelve turns; the same mechanics part 28 → 80 between cap 12 and cap 30.
- **The gate is not clean.** `whole-game differential` still fails at 17 of 961, and the eight remaining
  board-material causes are listed in `data/game-differential.json`. Nothing here says MEDICHAM is
  correct.
- **No strength claim.** ENGINE cannot measure one and none is made.

---

## OWED, NOT RUN

```bash
# the partial trap (`_trap`), staged rather than reasoned about. Needs a fixture that tolerates a
# damage roll and a 4-5 turn duration RANGE, which arms A-H deliberately avoid.
node tests/probe_trap_timing.js --release d38d117e68e9      # after adding a partial-trap arm

# Fairy Lock, likewise — the claim "its value cannot change inside a turn" is a reading of the code,
# not a measurement. Stage a Fairy Lock turn with a bare switch on both sides and read
# trapChoiceTimeDifferedFairy.
node tests/probe_trap_timing.js --release d38d117e68e9      # after adding a Fairy Lock arm

# a POOL-SCALE reading of the four trapChoiceTimeDiffered* counters and of
# MEDFAILS.trapVerdictUnstamped (which MUST read 0). game_differential.js surfaces no MEDSEEN and
# ENGINE may not edit it in this batch — route to MEASURE.

# the positive control for MEASURE's addressing audit, not re-run on this release
MEDI_SWITCH_BY_INITIAL_INDEX=1 node engine/game_differential.js --games 1200 --arm middle \
  --release d38d117e68e9 --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --end-state

# the same run at a LONGER cap — nothing here says anything about turn 13 onward
SHOWDOWN_PATH=... node engine/game_differential.js --games 1200 --arm middle \
  --release d38d117e68e9 --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --end-state --turns 30

# not re-run on this release by this pass
node tests/interaction_matrix.js
node tests/mutation_harness.js
node engine/quarantine.js
node engine/wire_ladder.js      # data/wire-ladder.json is UNSAFE and its figure is withheld

# reported, not touched — carried over from MEASURE's report and still true:
# data/provenance-stamp.json moved `verified 3 -> 2` under an earlier session and nobody said which.
node engine/provenance.js
```
