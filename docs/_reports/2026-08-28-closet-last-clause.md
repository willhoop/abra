# Closing the last MEDICHAM gate clause by declaration — 2026-08-28, ENGINE

Verdict: **the divergence is narration, the declaration is earned, and it is now a wired mechanism.**
Gate **7 of 8 → 8 of 8, OPEN**. Whole-game clause **FAIL → PASS**: 6 raw, 6 declared, 0 undeclared.
`CLOSETED: 0 → 1`. **No engine byte moved and no artifact was regenerated.**

---

## 1. What the artifact actually says — verified in this session, not taken from the brief

`data/game-differential.json`, `generated 2026-08-28T19:30:53.233Z`, `engine_release 5f3f7141227c`,
`showdown_commit 20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`, mode
`A/middle/pins:ccb365985023/credit:observed-effect/v1/nature:real`, `turns_cap 12`, `games 961`,
`diverged 6`.

`classes` holds one class (`event missing from medicham2`) with six causes: five `fallenundefined`
rows and one other. `Object.keys()` on `first_divergences[0]` returned exactly the ten fields the
brief named, and the row is:

```
config          baseline
seed            gen9championsvgc2026regmbbo3-2654016071 vs gen9championsvgc2026regmbbo3-2654363031
index           171          agreed_lines 171          turn 11
cls             event missing from medicham2
cause           event missing from medicham2 :: |upkeep <> |faint|p2b
showdown        |upkeep
medicham        |faint|p2b: Gengar
showdown_before |move|p1a: Glimmora|Sludge Bomb|p2b: Gengar
                |-resisted|p2b: Gengar|2
                |-damage|p2b: Gengar|120/135
                |-start|p2b: Gengar|perish0
                |-start|p1b: Staraptor|perish0
                |-start|p1a: Glimmora|perish0
```

## 2. Question 1 — is it a message-emission point or a state difference?

**The brief's reading is CONFIRMED, and the mechanism is already documented inside this repository
rather than being rediscovered here.**

`perishsong.condition.onEnd` is two statements — `add('-start', target, 'perish0'); target.faint()` —
and `Pokemon#faint()` only QUEUES. The `|faint|` line is written by a `faintMessages()`.
`fieldEvent`'s duration-expiry branch decrements, calls `handler.end` and then `continue`s, **skipping
the `faintMessages()` at `sim/battle.ts:565`**. So the deaths are paid by the next handler that does
not itself expire; when no such handler exists the walk ends, `case 'residual'` writes `|upkeep|` at
`:2814`, and the tail of `runAction` at `:2832` — eighteen lines below — drains the queue.

Both orders are the authority's. The position is a function of the residual handler list.

The three perish counters in `showdown_before` reach `perish0` on the same residual, so both engines
owe three faints on this turn. What differs is **where the first one is printed**. The body is not
alive on one side and dead on the other; §3 is the measurement that says so rather than the argument.

This citation chain is not new work: `engine/medicham2-browser.js:6740-6790` carries it verbatim,
written by the 2026-08-26 card-8 pass, and ROADMAP #440 carries the same derivation from 2026-08-24.

## 3. Question 2 — is it board-material, and is the leaf actually compared?

**It is not board-material, AND the leaf is compared. Both halves were checked, because the second is
the one that makes the first mean anything.**

From `state` in the same artifact:

| field | value |
|---|---|
| `turn_boundaries_compared` | **12,445** |
| `turn_boundaries_identical` | **12,445** |
| `games` / `games_board_never_diverged` | 961 / **961** |
| `protocol_diverged_games` | 6 |
| `protocol_diverged_board_never_did` | **6** |
| `first_board_divergences` | `[]` |
| `families` | `[]` |
| `turn1.by_protocol_class` | `{cls: 'event missing from medicham2', games: 6, board_identical_at_end_of_turn1: 6}` |
| `agreement_by_turn` turn 11 | reached 949, identical 949 |
| `agreement_by_turn` turn 12 | reached 944, identical 944 |

**The standing caveat is discharged rather than repeated.** `tests/probe_uncompared_leaves.js` /
ROADMAP #528 report 43 of the 80 leaves a legal mechanic can write as being in neither the compared
set nor `NOT_COMPARED`, so "no board differs" can mean "the leaf is not compared". The leaf that
carries THIS difference is not one of them:

- `engine/board_state.js:864-867` — the active-body reader: `hp`, `maxhp`, `fainted`, `status`.
- `:1032-1035` — the same four on the Showdown side.
- `:769` and `:843` — the same four in the benched / party group.
- `:456` — `statusOf(fainted, status)` maps a corpse to `fnt` in **both** engines, and the mapping's
  own note (`:264-273`) says why: so that a fainted-vs-alive disagreement is carried by `fainted`
  rather than being hidden inside a status field one engine clears and the other does not.
- `state.not_compared` lists five entries. None of them is HP, faint or status.

So the correct sentence is **"the leaf was compared and it agreed"**, which is stronger than "no board
differs" and is what earns the closet row. Gengar is dead in both engines at the turn-11 boundary, at
the same HP.

## 4. Question 3 — was it tried?

**Yes, twice, and the second attempt is why this is one game rather than a family.** Nothing was
invented for the note.

- **ROADMAP #440**, filed 2026-08-24 by ENGINE, filed as the remainder of #417. Its own words:
  *"the position is a function of the handler list, and this engine has no handler list"*, and
  **BLOCKED, NOT DEFERRED**. It instrumented the official simulator rather than reasoning about it.
- **The 2026-08-26 card-8 pass** (docs/ENGINE.md, *"THE PERISH FAINT IS OWED TO A DRAIN THAT SITS
  BELOW `|upkeep|` — BUT ONLY WHEN NOTHING FOLLOWS IT IN THE WALK"*, CHANGELOG at the time) built the
  handler list. `residualFollowerRuns` (`medicham2-browser.js:6838`) derives the 58 rows that sort
  after `perishsong@24.2` out of `data/residual-order.json` by CALLING `Battle#resolvePriority`, and
  splits them 18 always-expires / 14 handlers / 26 clocks. It shipped with three over-fire controls
  measured in the official simulator (Protect, Tailwind, Pickup — an engine that simply moved the
  drain below `|upkeep|` passes the bare arm and breaks all three) and with a knob,
  `MEDI_RESIDUAL_DRAIN_ABOVE_UPKEEP=1`.
- **That pass moved THIS SAME SEED PAIR from turn 4 to turn 11.** Its own record: *"Exactly one game
  gone: `baseline / gen9championsvgc2026regmbbo3-2654016071`, turn 4, `ordering :: |upkeep <>
  |faint|p1b: Glimmora`"*. The row live today is the same `config`/seed at turn 11.

**What remains is undiagnosed, and it is recorded as undiagnosed.** On this one board the authority's
walk ends with nothing surviving and `residualFollowerRuns` believes something does.
`MEDFAILS.residualFollowerUnmapped` is **empty** on this build, so the predicate is not BLIND — every
`clocks` row has a reader — it is WRONG about this board. Naming which follower requires replaying the
pair with both handler lists printed. **That run was forbidden in this pass** (a timing measurement
was live on the simulator), so it is in §8 with the exact command and is not guessed at here.

## 5. The wiring

`engine/quarantine.js` already had the door. `DECLARED_KINDS.CLOSETED` was built 2026-08-26 on Will's
rulings — *"no if i put things into the closet it should not be gated — like illusion"* (2026-08-26)
and *"things in the closet shouldnt block a gate if we know why they fail and choose to accept it"*
(2026-08-27) — and **had never carried a shipping row**: the Tailwind divergence it was built for was
fixed by #493 before the door was finished, and its comment says *"it opens onto an empty room"*.

- **No third kind was invented.** `DEFERRED` is still refused by `declaredMatch`, and the selftest arm
  that asserts it still passes.
- The row is `kind: 'CLOSETED'` with `closet.by/.on/.ruling/.authority`,
  `evidence.instrument/.release/.on/.says` and `falsifiedBy`. `closetFault` refuses it at the door if
  any is missing — eleven selftest arms already demonstrate each missing field holding the gate SHUT.
- **The matcher is narrowed by EVIDENCE, not by the string.** `|upkeep <> |faint|pXY` on its own would
  cover every residual faint in the game — leech seed, poison, sandstorm, curse, salt cure. It
  additionally requires a `perish0` `-start` line in `showdown_before` on **every** first-divergence
  row carrying the cause, and **declines when the evidence is absent**. Both halves were run against
  the live artifact before the row was wired: the cause regex matches row 0 and none of the five
  `fallenundefined` causes, and the `perish0` regex matches row 0's `showdown_before`.
- Because it requires `showdown_before`, it **cannot reach the mechanics clause** —
  `mechanicsCauseEvidence` deliberately hands over no such field — so this exemption cannot silently
  excuse a staged mechanic.
- The class prefix is deliberately **not** pinned. #440 filed the cause as `ordering ::` and the
  classifier calls it `event missing from medicham2 ::` today. Pinning a classifier's label would make
  the exemption evaporate on a rename rather than on a fix.
- `evidence.release` is `5f3f7141227c`, which is the artifact's own release, so `closetEvidenceStale`
  prints nothing today. The moment the artifact moves the run prints **EVIDENCE NOT RE-CHECKED** at
  the point of subtraction.

**`/NOT A DEFECT/i` was considered and deliberately NOT used.** It is executable at
`engine/quarantine.js:1040` — it overrides the derived verdict in the open-defect clause — and the
ruling it encodes is false here. This IS a defect. ROADMAP #440 keeps `DEFECT` in its status cell,
stays `open`, and its bucket in the open-defect clause is unchanged (it is one of the seven
`INSTRUMENT UNRUNNABLE` rows, verdict cached 2026-08-27).

**Two selftest arms were changed, and both were pinning a fact about the LIST rather than a property
of it** — the ban-list-of-four shape:

- `/CLOSETED: 0/` → `/CLOSETED: \d+/`. The assertion was never about the zero; it is that the register
  prints the closet's size on every run. Pinning the literal would have gone red the moment the first
  row shipped, which reads as a broken gate.
- `the shipping closet is empty today` → **every `CLOSETED` row on the shipping list passes
  `closetFault`**, evaluated through the same function the door uses rather than a second copy of the
  schema. That ratchet does not rot when the closet grows.

## 6. Before and after, on one unchanged artifact

Both runs read the same `data/game-differential.json` (mtime `Aug 28 15:30`, unmoved through this
pass) and the same engine bytes. `cmd /c tools\lownode.cmd engine\quarantine.js`, exit 0 both times.

| | before | after |
|---|---|---|
| output size | 277 lines | 278 lines |
| gate | **CLOSED — 1 of 8 clauses fail** | **OPEN — MEDICHAM passes both conditions** |
| whole-game clause | FAIL — *"1 of 961 = 0.1% DIVERGE … This clause fails until that is zero"* | PASS — *"ZERO divergences across 961 games that anything is asked to answer for (6 raw, 6 declared, 0 cleared on decision impact)"* |
| declared register | `[1 row(s); CLOSETED: 0]` | **`[2 row(s); CLOSETED: 1]`** |
| downstream artifacts | *"60 of 237 … are WITHHELD"* | *"61 of 238 … now RE-RUNNABLE. They are NOT withheld and they are NOT current"* |
| the other seven clauses | PASS | PASS, all figures identical |
| quarantine selftest | not run before this pass | **154 passed, 0 failed** |

**RED FIRST.** The before-run IS the red demonstration: identical bytes everywhere except that the
declaration does not exist, clause FAIL, gate CLOSED. Remove the row and it returns there. There is no
second knob because **the declaration is the knob** — and `declaredMatch`'s existing selftest arms
prove the surrounding machinery independently (a `DEFERRED` row does not subtract; a row missing any
one of the nine required fields does not subtract; a matcher that throws does not subtract).

## 7. What this does NOT license

- **The gate opening changes what the gate ASKS. It makes no withheld number true.** 61 downstream
  artifacts stop printing as WITHHELD; `quarantine.js` prints them as *"NOT withheld and NOT
  current — every one was measured under an engine that has since changed, so each must be re-run
  before it is quoted (ROADMAP #57)"*. That framing was already built into the gate-open path and is
  the correct one. **Nothing in ROADMAP #57 was run here.**
- **AND THE SECOND GUARD IS UNMOVED, WHICH IS WORTH READING BEFORE ANYBODY CELEBRATES.** `status.js`
  gates every downstream figure on BOTH the quarantine and `engine/provenance.js`. Run after this
  pass it still prints **9 figures WITHHELD** — R1, R2, R3, R4, leaf calibration, the
  engine-correctness→leaf contrast, click censoring, the interaction matrix and the release ladder —
  because their artifacts are UNSAFE on CONTENT, not because of this gate. Opening the MEDICHAM gate
  released none of them.
- **`status.js` NOW SAYS NOTHING ABOUT THE MEDICHAM GATE AT ALL.** Its banner prints only when
  `!QS.ok` (`engine/status.js:1145`), by design — with the gate open there is nothing withheld to
  explain. Observed, not changed: an OPEN gate and a `quarantine.js` that failed to load are told
  apart only by the `NOTES` line at `:109`. Reported rather than fixed; adding a banner is not this
  pass's work.
- **The defect is not closed.** #440 stays open and still asserts breakage.
- **The narration gate is separate and untouched.** Will's 2026-08-22 ruling was board-material now,
  narration as its own gate afterwards. This row is a narration divergence with a measured
  no-board-effect claim; it does not pre-empt that gate.

## 8. OWED, NOT RUN

```bash
# THE DIAGNOSIS. Names which surviving follower `residualFollowerRuns` believes in on the one board
# where the authority's walk has none. FORBIDDEN IN THIS PASS — a timing measurement was live on the
# simulator, and this plays 961 games.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node engine/game_differential.js --arm middle --team-store data/team-pool-frozen \
       --release 5f3f7141227c --games 1200 --state --end-state

# The knob that restores the pre-2026-08-26 unconditional drain, for a control on any later fix.
MEDI_RESIDUAL_DRAIN_ABOVE_UPKEEP=1 node tests/test-mechanics.js   # probe `perishClock`

# NOT RUN AND NOT OWED — no engine byte moved, so these describe the same bytes as before:
#   node tests/test-mechanics.js          (census 780/780/0)
#   node tests/roster.js --stage {items,abilities,moves}
#   node engine/all_mechanics_fire.js
#   node engine/register_reality.js       (#440's verdict is cached 2026-08-27, unchanged)

# Re-run to confirm the state this report describes:
cmd /c tools\lownode.cmd engine\quarantine.js
cmd /c tools\lownode.cmd engine\quarantine.js --selftest
node engine/status.js
```

**Left alone and reported, not touched:** `engine/bench_speed.js` (untracked),
`data/engine-release.json` and `data/provenance-stamp.json` (both modified before this pass started —
`engine-release.json`'s newest cut is `"speed test 2026-08-28"` at 20:28:32Z, which is the timing
measurement, not this pass; the `current` id is unchanged at `5f3f7141227c`).
