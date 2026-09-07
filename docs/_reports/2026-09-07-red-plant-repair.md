# Four dead red demonstrations, repaired — and the class of failure that hid them

**Division:** MEASURE. **Date:** 2026-09-07. **Engine release:** `1be57a100d59` (pinned by name on
every run below; `data/engine-release.json` `current`).
**Files changed:** `tests/roster.js`, `engine/quarantine.js`. No engine file was touched.

## 1. What was found, before anything was changed

`tests/roster.js` proves each shape rule can still SEE a defect by planting one break in the frozen
release's bytes and requiring a member's board to flip. The plant is an exact string replace that
must match **exactly once**; if it matches zero or two times the plant is never applied, and — in the
file's own words — *"an unapplied plant reads exactly like a comparator that found nothing."*

An audit of **every** rule's anchor against release `1be57a100d59` found **seven dead anchors across
six rules**, not four:

| rule | matched | why it died |
|---|---|---|
| `move/plain-attack` | 0 | `dmgRangeOneHit`'s single-hit return grew `,type:mvT` |
| `move/variable-power` | 0 | same anchor, shared |
| `move/recharge` | 0 | same anchor, shared |
| `item/status-cure` | **2** | a second road to the same effect landed the same morning |
| `ability/trap-arrives-with-a-mega` | 0 | the refusal moved into `switchTrapVerdict`; `_held` is gone |
| `ability/traps-and-somebody-tries-to-leave` | 0 | same anchor, shared |
| `ability/speed-on-item-loss` | 0 | the guard grew `&&(ROOM_ITEM_IS_LOST||m._roomItem==null)` and the payment moved from `s*=` to `_mods.push(...)` |

**The three ability rules were not in the brief and `--reds` cannot see them.** Every member of all
three is `COULD-NOT-STAGE` in this format, and the reds loop is keyed on rules with at least one
staged member — so the abilities stage read **29 of 29 CAUGHT** with three dead anchors inside it.
Nothing green rested on them, which is precisely why nothing was ever going to ask.

**We caused the two that the brief named.** `git log -S 'eff,type:mvT}'` returns exactly one commit,
`1b5fd9f1`, 2026-09-07 — the resist-berry type fix. `item/status-cure`'s anchor started matching
twice the same morning for the mirror reason: `berryCureOnSet` (Lum's `onAfterSetStatus` road) reads
`_cs` off `m.item` with a byte-identical line.

## 2. The repairs — each still causes a real, detected divergence

- **The three move rules** re-aim the shared second patch element onto the current return
  `return {min:roll(85),max:roll(100),eff,type:mvT};`. The FIRST patch element (halving the
  sixteen-entry `hit.rolls` band) is the one that moves a board — that was already true and is
  unchanged. Nothing was weakened.
- **`item/status-cure`** is aimed at `berryStatusCureNow`, the one function both cure schedules now
  call, anchored on the function signature plus its first line so it is unique. **Strictly stronger
  than what it replaces:** the old anchor could only reach whichever of the two roads it landed on;
  this one breaks both.
- **The two trap rules** are aimed at `if(_tv.block==='ability'){MEDSEEN.trapBlockedSwitch++;continue;}`
  — the same semantic break (the trap no longer holds the switch) at the site the refactor moved it to.
- **`ability/speed-on-item-loss`** is aimed at the PAYMENT line
  `if(_ub&&_ub.speedMult)_mods.push(+_ub.speedMult);}`, which does not carry the room-item guard that
  moved.

The last three remain **UNEXERCISED** and say so in the file: no member of those rules can be staged
in this format, so the claim restored is the narrow one — *the anchor names a live site* — and not
*the plant moves a board*. Those two claims are printed as two separate lines so they cannot be read
as one.

All 87 rules with a break now apply exactly once against `1be57a100d59`.

## 3. The class fix — the two things that made this invisible

### 3a. The anchor audit is now UNCONDITIONAL, and a dead anchor is a FAILING row

The anchor-match check already existed. It lived **inside the `--reds` loop**, so the only way to ask
whether a plant could still apply was to also run the flip demonstration — which is not the default,
is not what the gate printed, and roughly triples the wall clock.

The check itself is a **string count**. It plays no game, opens no fixture and costs milliseconds.
There was no honest reason for it to sit behind a flag; the reason it did is that it was written
inside the loop that needed it rather than beside the claim it protects.

It is now hoisted out (`tests/roster.js`, `PLANT` / `deadAnchors`), and:

- it runs on **every** roster run, `--reds` or not;
- it covers **every rule this stage assigned an entity to, including the COULD-NOT-STAGE ones** —
  which is the half that found the three ability rules `--reds` structurally cannot see;
- a dead anchor is pushed into `reds` as an ordinary `{ ok: false, anchor_dead: true }` row, so it
  reaches the process exit code AND `engine/quarantine.js`'s existing `badReds` term. **No new gate
  was added.** A caption beside a number is what this repository has already paid for twice;
- the `--reds` loop no longer re-applies the patch. It consumes `PLANT[rid]`, so "does this anchor
  match once" has one implementation rather than two that can drift;
- the artifact carries `plant_anchors: { release, checked, dead[], reds_ran }`.

**It is printed on every run, pass or fail**, because "the check found nothing" and "the check did
not run" are the two readings this project keeps confusing.

### 3b. The `--reds` hole — what was chosen, and why

The brief offered two repairs: put `--reds` into the command `engine/status.js` / `engine/quarantine.js`
prints, or make an empty `reds` array fail the clause.

**Chosen: put `--reds` in the printed command. NOT: fail on an empty `reds`.**

Three reasons.

1. **The check that would actually have caught this bug is now free and unconditional.** Failing the
   clause on an absent `--reds` run would not have caught 2026-09-07's `,type:mvT` any earlier than
   the anchor audit does, and the anchor audit costs nothing.
2. **Failing on an unarmed `--reds` fails the clause for a scheduling reason, not an engine one.**
   The gate would go red because somebody ran a cheaper command, on an engine that is fine. CLAUDE.md
   is explicit that an over-firing gate is the one people learn to ignore (#148) — and this whole
   defect class is *tests nobody reads the output of*. Adding a red that means "run the slow command"
   manufactures exactly that.
3. **The thing genuinely missing was distinguishability, and that is now a field rather than an
   inference.** An empty `reds` and a `reds` nobody armed used to look identical from outside. The
   artifact now stamps `plant_anchors.reds_ran`, and the clause's sentence says
   `THE RED DEMONSTRATION WAS NOT ARMED — ... checked for EXISTENCE and none was fired at a board`,
   or `RED DEMONSTRATION NOT DECLARED` for an artifact predating the field. That is a **denominator**,
   in the same discipline as `DENOMINATOR NOT CARRIED` two clauses above it — not a gate.

`engine/quarantine.js` now prints `... --stage <stage> --reds --write` at all three sites that tell a
reader how to regenerate the artifact.

## 4. Shown RED first

With the repair in, `move/recharge`'s now-live anchor was deliberately mutated — `_hits>1` changed to
`_hits>99` inside the sixteen-roll band anchor — and the stage was run **without** `--reds`, which is
exactly the case the old code could not see:

```
  THE PLANT ANCHORS — every rule this stage used, checked against release 1be57a100d59 BEFORE anything is believed:
    0 of 1 apply exactly once
    DEAD ANCHOR   move/recharge   matched 0 time(s), not 1   [6 row(s) in this stage, 6 of them staged]
        for(let i=0;i<16;i++){const v=roll(100-i);hit.rolls.push(_hits>99?Math.floor(v*_hits):v);if(_unit)_unit.push(v);}
        Every row this rule produced is UNPROVEN until it is re-aimed. This stage cannot report clean.
```

Process exit code **1**. Before this change the same command exited **0** and printed nothing about it,
because `redRows` was only populated under `--reds`.

Driven through the SHIPPING clause rather than a restatement of it — an artifact carrying one
`anchor_dead` row, `reds_ran: false`:

```
ok=false
0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE — 140 of 148 tested, 1 red demonstration(s) did not behave
as their rule predicted. THE RED DEMONSTRATION WAS NOT ARMED — this artifact was written without
`--reds`, so its 18 plant anchor(s) were checked for EXISTENCE and none was fired at a board
```

The mutation was reverted and all 87 anchors re-audited clean.

The `redsNote` denominator was exercised on all three artifact shapes through `rosterStage`:

| artifact | sentence |
|---|---|
| predates the audit (no `plant_anchors`) | `RED DEMONSTRATION NOT DECLARED ... an empty \`reds\` cannot be told from an unarmed one` |
| `reds_ran: false` | `THE RED DEMONSTRATION WAS NOT ARMED — ... checked for EXISTENCE and none was fired at a board` |
| as written today | (silent) |

## 5. The three stages, in full

All three: `SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage <s> --reds --write --release 1be57a100d59`,
arm `top-tie-first`, engine release `1be57a100d59`. Exit 0 on all three.

| stage | anchors | red demonstrations | DIFFER | DID-NOT-FIRE | tested | total |
|---|---|---|---|---|---|---|
| items | **18 of 18** apply once | **18 of 18 CAUGHT** | 0 | 0 | 140 of 148 | 148 |
| abilities | **31 of 31** apply once | **29 of 29 CAUGHT** | 0 | 0 | 129 of 202 | 316 |
| moves | **36 of 36** apply once | **35 of 35 CAUGHT** | 0 | 0 | 475 of 500 | 500 |

Zero `NOT CAUGHT`, zero `FALSE DECLARATION`, zero `DEAD ANCHOR` across all three stages.

The four repaired-and-exercised rules, with the member each was demonstrated on:

```
  CAUGHT   item/status-cure      via cheriberry  -> FIRED-AND-BOARDS-DIFFER on party.status, party.item, status, item
  CAUGHT   move/plain-attack     via acidspray   -> FIRED-AND-BOARDS-DIFFER on party.hp, hp
  CAUGHT   move/variable-power   via acrobatics  -> FIRED-AND-BOARDS-DIFFER on party.hp, hp
  CAUGHT   move/recharge         via blastburn   -> FIRED-AND-BOARDS-DIFFER on party.hp, hp
```

**Every count is identical to the run that preceded the repair** (items 140/8/148, abilities
129/45/141/316, moves 475/22/500). That is the expected result and it is the honest one: the plants
decide whether a green row is *believable*, not what the row says. **No published figure moved.**

## 6. The gate afterwards

`node engine/status.js` — **8 pass / 1 fail** (was 6 pass / 3 fail):

```
  PASS  deliberate roster / items      clean: 140 of 148 tested
  PASS  deliberate roster / abilities  clean: 129 of 202 tested. 45 row(s) count in NEITHER column ...
  PASS  deliberate roster / moves      clean: 475 of 500 tested
  PASS  whole-game differential / BOARD-MATERIAL — 0 of 958
  FAIL  whole-game differential / NARRATION — 71 of 961
```

`NARRATION` is the only failing clause and was explicitly out of scope for this pass. The quarantine
has **not** opened; every quarantined figure stays withheld.

## 7. One red test, named rather than filed

`node engine/quarantine.js --selftest` — **232 passed, 1 failed**:

> `FAIL SPLIT / GATE — and the SHIPPING assembler is the thing being described: the live gate carries exactly one reporting clause and it is the narration one   got []`

**Pre-existing and not caused by this pass.** `reporting` is `clauses.filter(c => c.gates === false)`,
and the narration clause computes `const gates = !!(board && board.ok === true && board.pins)`
(`engine/quarantine.js:2553`) — which depends only on the BOARD-MATERIAL clause. Board-material
reached 0 of 958 earlier today, so narration flipped from REPORTING to GATING and `reporting` became
empty. Measured directly:

```
reporting: []
whole-game differential / BOARD-MATERIAL  | ok=true  gates=true
whole-game differential / NARRATION       | ok=false gates=true
```

Nothing in this pass touches `gates`, `reporting` or the narration clause; the roster clauses'
pass/fail state does not enter that computation. **It belongs to the NARRATION clause**, which this
pass was scoped out of, and is reported here rather than fixed or filed.

## 8. What was not done

- `node engine/status.js --write` was **not** run, per the brief. The `<!-- GENERATED -->` blocks in
  the ledgers are therefore stamped `2026-09-06 14:08` and are older than the artifacts.
- Nothing was committed.
- No version bump, no `CHANGELOG.md` edit.
- `engine/medicham2-browser.js` and `data/policy-weights.json` were not touched.

## 9. Files

- `tests/roster.js` — seven anchors re-aimed; the anchor audit hoisted out of `--reds`; `plant_anchors`
  on the artifact; the `--reds` loop consumes `PLANT[rid]` instead of re-applying the patch.
- `engine/quarantine.js` — `--reds` in all three printed rerun commands; the `redsNote` denominator;
  `plant_anchors` carried on the returned clause object.
- `docs/RUNNING-NOTES.md`, `docs/MEASURE.md` — the row and the ledger section.
- `data/roster.{items,abilities,moves}.json` (+ `.prev.json`), `data/roster.json` — regenerated.
