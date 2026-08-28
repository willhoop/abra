# The thirty dormant red demonstrations — classified, then closed

2026-08-27. ENGINE. Release `345f4193d440` (`0 of 26 files have moved since` — **no engine file was
touched by this pass**). ROADMAP `#513` closed, `#514` filed. CHANGELOG 5.192.0.

## THE THREE BUCKET COUNTS

| bucket | n |
|---|---|
| 1 — **the demonstration is miswritten** (the deliberate break does not actually break anything) | **23** |
| 2 — **the rule is wrong** (something breaks, but the predicted response is not what the engine does) | **7** |
| 3 — **the engine genuinely does not react** (a real gap the net would have missed) | **1** |

**The third number is 1: nothing in `medicham2-browser.js` gates Belch on having eaten a berry.**
Everything else was the instrument.

`--reds` now reads **18 of 18 items, 29 of 29 abilities, 34 of 35 moves CAUGHT**, with **no WEAK
rows** (`move/plain-attack` was CAUGHT-WEAK before and is attributable now). 30 → 1.

## HOW THE CLASSIFICATION WAS MADE — `--reds` CANNOT ASK THE QUESTION

`--reds` measures a **verdict flip**, and a verdict runs through the control arm, the delta
subtraction against that arm, the second control and the usage shelf. Any of those can cancel a plant
that is perfectly live, so a NOT CAUGHT has three causes and the loop cannot separate them.

`tests/probe_reds_plant_reaches.js` (new, this session) asks the narrower question, the same shape
`healStagingWorks()` already used for one rule: apply the plant to the frozen release's bytes and
compare **our own board against our own**. Showdown is not involved, so nothing can cancel it.

- `MOVED > 0` → the plant reaches; a NOT CAUGHT is a cancellation elsewhere.
- `MOVED = 0` → the plant does not reach on this fixture. **That is a verdict on the demonstration,
  never on the mechanic.**

It printed both REACHES and NO REACH on the same run before any of its zeroes were believed. Its
first version reported NO REACH on a rule whose plant reaches fine, because it had dropped `--state`
from `process.argv` and every boundary compared zero leaves — fixed and documented in the file, and a
useful reminder that this probe is as capable of lying as the thing it audits.

Where the probe could not distinguish two causes, a **counter was planted inside the patched line**
and the execution count printed. That is what settled the damage family and the two dead branches.

## BUCKET 1 — 23 MISWRITTEN DEMONSTRATIONS

### 1a. Thirteen anchors had never matched (0 or 2 times, never exactly once)

| rule | drift |
|---|---|
| `item/resist-berry` | `&& !berryRefusedByFoeNew(def)` inserted mid-line (Unnerve, 2026-08-23) |
| `item/hp-floor`, `ability/survives-from-full` | one `_sv` line split into `_svIt` + `_sv` |
| `item/cures-a-volatile` | parameter renamed `_who` → `who` |
| `ability/stat-drop-reaction` | matched **twice** — the ally refusal and the body's own |
| `ability/absorbs-a-type` | `suppressedAbility(att,def)` hoisted into a local `_sa` |
| `ability/refuses-one-status` | `canTakeStatus` gained `src, why` |
| `ability/pierces-protect` | parameter renamed `m` → `attacker`, and the line grew spaces |
| `ability/blocks-foe-berry` | inline `foes.some(...)` extracted into `berryRefusedByFoe` |
| `move/boosts-self` | matched **twice** — the HP-cost site and the boost site |
| `move/self-boosts-after` | the line grew the `SELFBOOST_IN_LOOP` guard |
| `move/needs-a-berry-already-eaten` | bare `m.item=''` became `consumeBerry(m,_it)` (ROADMAP #128) |
| `move/status-inflict` | `applyStatus` gained `eff, why` |

Every one is re-aimed and every one now CAUGHT except the last, which is bucket 3 (below).

### 1b. Ten applied and demonstrated nothing

| rule(s) | what the plant hit | why the board did not move |
|---|---|---|
| `move/plain-attack`, `move/variable-power`, `move/recharge` | the `{min,max}` **return** of `dmgRangeOneHit` | that is the PRICE. The battle loop applies `hit.rolls` — the sixteen-entry band written as an out-parameter two lines *above* the return. **Counted: the patched line ran 4 times on Acrobatics and moved 0 leaves. Halving the band moves 4.** |
| `move/multihit` | the same return's `_hits>1` early exit | the band already carries the multiplier. The count a played game uses is the ROLLED one in `hitPlanOf`; pinning it to 1 moves 4 leaves. |
| `move/drain` | `const _dr=…'drain'` | that copy is inside `if(DRAIN_LUMP_ROUND)`, dead by default since the drain moved to a per-target payment on 2026-08-24. The live read is `_drTag`. |
| `ability/weather-residual` | `boostsEachTurn` | the wrong tag entirely. Every member (Ice Body, Rain Dish, Solar Power) is `weatherResidualHP`; re-aimed, all three move 6 leaves. |
| `ability/damage-taken-scoped` | the base-power route of `halvesTypeDamage` | one tag, two routes. Every halving member uses the attacker-stat route (`_htdA`); the base-power route's only carrier is Dry Skin. |
| `move/fixed-damage` | `a.kind==='fixeddmg'` | **counted at ZERO executions** on all nine members, Super Fang included. Fixed damage is computed from the `fixedDamage` tag inside `dmgRangeOneHit`. |
| `move/needs-a-stat-stage-to-act-on` | a boost-write site | **counted at ZERO executions** on Acupressure, Belly Drum, Guard Swap and Strength Sap. The stage the subject acts on is written by the SETUP branch. |
| `move/self-switch` | the pivot classifier | **it reached.** The reds loop refused to score it — see below. |
| `item/heals-at-threshold` | the pinch-berry read | **the fixture was staging nothing.** See below. |

### 1c. Two things the loop itself was doing

**A plant that makes the fixture UNPLAYABLE was scored as a staging failure.** `move/self-switch`
stops a pivot being classified as one; the body then stands where the script expects an empty slot,
the game ends a turn early, `play()` returns SHORT and `runEntry` calls that COULD-NOT-STAGE — which
was not in the accepted set. That is the engine reacting as loudly as it can. Now counted, **narrowly**:
only when the member is GREEN against the clean source (so the fixture demonstrably plays without the
plant), and printed as its own outcome with the reason, because COULD-NOT-STAGE is also what a broken
harness returns. `move/the-user-faints-and-the-replacement-arrives-restored` is scored the same way.

**`item/heals-at-threshold` was crediting two vacuous greens.** `HALVER` picked its fixture by
MAXIMISING a predicted damage fraction — as close to 90% of the holder's HP as it could get. `maxRoll`
is a prediction off `flatL50` spreads and the fixture is built by `buildPair`; they disagreed by
enough that **the staging hit KILLED the holder, in both engines**. Measured directly: the holder is
gone at boundary 1 and replaced, in the clean arm, in the planted arm, and with no item at all — the
three runs are identical HP for HP. So Oran and Sitrus were credited `FIRED-AND-BOARDS-MATCH` on
exactly one leaf, `p2.party.<holder>.item` at boundary 0, which is the item being written on the board
and nothing else.

Two fixes: the picker aims at the MIDDLE of its band (0.55–0.80, target 0.65) instead of the top, and
the rule carries a **precondition read off Showdown's own board** — the holder alive in its slot AND
the berry eaten. A fixture that cannot show both is COULD-NOT-STAGE with that as its reason, never a
pass. The rule is CAUGHT now via Oran Berry on `hp` and `item`.

## BUCKET 2 — 7 STALE `noBreak` DECLARATIONS

Seven rules declared that the simulator has no implementation of their family at all. All seven were
false, and **the declaration's own check is what said so** — it fails the moment a member FIRES, and
every one had a member reading `FIRED-AND-BOARDS-MATCH`. That check working is the single best thing
in the file.

| rule | member | the implementation that arrived | leaves moved by the new anchor |
|---|---|---|---|
| `item/drain-scaled` | Big Root | `healMultBySource` in the per-target drain | 4 |
| `item/species-locked-stat` | Light Ball | `statMult {mult, stats, onlySpecies}` in the stat chain | 2 |
| `item/heal-on-attack` | Shell Bell | `healFromDamageDealt` after the attack | 4 |
| `move/full-heal-that-also-writes-a-status-onto-its-user` | Rest | `healDescriptor.setsStatus`, status first then HP | 12 |
| `move/heals-the-slot-a-turn-later-across-a-switch` | Wish | the slot condition, booked with the WISHER's max HP | 4 |
| `move/the-user-faints-and-the-replacement-arrives-restored` | Healing Wish | `healDescriptor.userFaints` | fixture unplayable |
| `move/needs-a-volatile-set-first` | Spit Up / Swallow | `spendsVolatile` on a real `stockpile` volatile | 8 (Swallow; Spit Up 0, which is why the loop tries every green member) |

## BUCKET 3 — THE ONE THAT IS THE ENGINE (ROADMAP #514)

**Nothing in `medicham2-browser.js` gates Belch on having eaten a berry.**

- The authority: `onTry(source) { return source.ateBerry; }` — the click is refused outright.
- Here: Belch resolves as an ordinary damaging move whatever the body has eaten.
- **Measured, not inferred.** `_ateBerry` is WRITTEN in `consumeBerry` and READ in **exactly one place
  in the whole file** — Harvest. Planting `m._ateBerry=false` moves **zero** board leaves on Belch's
  own fixture.
- **The roster's green for it is vacuous.** Belch reads `FIRED-AND-BOARDS-MATCH` because the fixture
  feeds the body a berry first, so the gate is open in the authority and ABSENT here, and the two
  boards agree for different reasons. This is the class of vacuous green the red demonstration exists
  to find, and it is the only one of thirty that was not the instrument.
- **The tag is missing too.** `data/tags.json` gives Belch `pp / targetClass / formatSecondaryCount /
  callRefusalFlags` and no gate, so there is nothing to read even if a reader existed. The fix is a
  `tag_dex` derivation plus a reader, and regenerating `data/tags.json` moves the release — which is
  why it was not done inside a pass whose whole claim is that nothing downstream moved.
- **Not declared undemonstrable.** `move/needs-a-berry-already-eaten` aims its break at `_ateBerry`
  and reads NOT CAUGHT, so the instrument says this out loud on every run.
- **Ranking, stated before the fact.** Belch is legal (`isNonstandard: null`) and has ZERO corpus
  uses. By Will's 2026-08-23 call this is obscure tail: the lab should move and the pinned pool should
  not.

## THE ZEROES, RE-READ

No engine file was touched, so none of these could have moved — and each was read rather than assumed.

| | before | after |
|---|---|---|
| roster `FIRED-AND-BOARDS-DIFFER` / `DID-NOT-FIRE` | 0 / 0 | **0 / 0** |
| roster `FIRED-AND-BOARDS-MATCH` (items / abilities / moves) | 139 / 129 / 475 | **139 / 129 / 475** |
| roster `COULD-NOT-STAGE` | 8 / 141 / 22 | **8 / 141 / 22** |
| roster reds NOT OK | 7 / 8 / 15 | **0 / 0 / 1** |
| census | 765/765 live, 0 missing | **765/765, 0** |
| damage | 0/6000 at all sixteen corners | **0/6000 at all sixteen** |
| whole-game | 1 of 961 | **1 of 961** |
| `BOARD_MATERIAL` | 0 of 961 | **0 of 961** |
| release | `345f4193d440` | `345f4193d440`, `0 of 26 files have moved since` |
| gate clauses | 3 of 8 PASS | **5 of 8 PASS** |

`engine/all_mechanics_fire.js --kind all --write` was re-run: the artifact is byte-identical but for
its own `seconds` fields.

## THE COMMAND, RECORDED WHERE IT RUNS

```
for st in items abilities moves; do
  SHOWDOWN_PATH=... node --max-old-space-size=6144 tests/roster.js \
    --stage $st --reds --write --release <id>
done
```

This is now in the **header of `tests/roster.js`**, with the reason. It was already in
`docs/MEDICHAM-SPRINT-NOTES.md` and that was not enough — the flag was named in a document nobody
reads while running the file. A flag nobody knows to pass is the same bug one level up.

Single-rule form, for the next person auditing one:

```
SHOWDOWN_PATH=... node tests/roster.js --stage moves --rule move/drain --reds --release <id>
SHOWDOWN_PATH=... node tests/probe_reds_plant_reaches.js --stage moves --rule move/drain --members 8 --release <id>
```

## OWED, NOT RUN

- **ROADMAP #514 — the Belch gate.** Needs a `tag_dex` derivation (Showdown's `onTry` reading
  `source.ateBerry`) and a reader in `medicham2-browser.js`. Regenerating `data/tags.json` moves the
  release, so it needs its own pass with the census, the damage corners and the board-material zero
  re-measured after it. **`tests/roster.js --stage moves --reds` exits 1 until this is closed, and
  that is one true red rather than fifteen instrument faults — it is not a "known failure" and must
  not be filed as one.**
- **`item/heals-at-threshold`'s picker is better, not proven.** It aims at the middle of its band and
  the precondition now refuses a fixture that does not stage. What was NOT done is find out *why*
  `maxRoll` and `buildPair` disagree by ~30% on the pair it used to pick — the prediction is used by
  `lethalMove` and `FOUR_X` as well, so the same gap may be quietly shaping other fixtures.
- **The remaining `COULD-NOT-STAGE` rows were not touched.** 8 / 141 / 22. Three members of
  `move/needs-a-berry-already-eaten` (Bug Bite, Pluck, Recycle) are COULD-NOT-STAGE on
  *"Can't pass: your X must make a move"*, which is a scripting fault in the fixture, not a fact about
  the mechanic.
- **`ability/stat-drop-reaction`'s ally arm is left standing deliberately** so a flip is attributable
  to the body's own refusal. Flower Veil's ally protection therefore has no demonstration of its own.
- **`move/needs-a-volatile-set-first` demonstrates through Swallow and not Spit Up.** Spit Up moves 0
  leaves through the `spendsVolatile` anchor; why was not chased.
- **The whole-game baseline is still stamped under a two-generation-old pin** (`2efbc9ed1946` against
  `ccb365985023`), unchanged by this pass and still withheld by `quarantine.js`.
- **The 45 `CONTROL-NOT-QUIET` ability rows and the abilities stage's 141 `COULD-NOT-STAGE`** are the
  largest unexamined block in the roster and none of it was in scope here.
