# The wrong-arm callers — audit, rank and withdrawal candidates — 2026-08-22

Historical findings record. Not maintained, not current state, never cite as such.
Superseded by the register rows it feeds.

READ-ONLY audit. Nothing in `engine/`, `tests/` or `docs/` (outside this file) was edited. Nothing
was committed. `tests/roster.js`, `engine/quarantine.js`, `engine/game_differential.js` (as a run),
`tests/test-engine-diff.js`, `engine/register_reality.js` and `status.js --write` were not run.

---

## VERDICT

**The 27 is 22.** Derived from the current tree by parsing every `playGame` call site rather than by
grepping for the string `arm:`, five of the report's 27 were never affected: three pass the arm as an
ES6 **shorthand property** (`{ script, arm }`, no colon, invisible to the original grep) and two do
not call the driver's `playGame` at all.

**And it is bigger than 27 in the other direction.** The audit found two caller classes the report
did not reach:

- **four indirect callers** through `tests/staged_board.js`'s exported `runOne(sc, patchedSrc)`,
  which takes no arm parameter at all — `test-assert-mode.js`, `test-perish-song.js`,
  `test-volatile-duration.js`, `test-middle-stall-address.js`. All four are `test-*.js` and therefore
  **are** discovered by `tests/run-all.js`;
- **the driver's own seven internal call sites.** `engine/game_differential.js` calls its own
  `playGame` without an arm in `plantedProof`, `statePlantedProof`, the directed-scenario runner and
  the two KO/Sitrus probes. Three published blocks of `data/game-differential.json` —
  `planted_divergence_proof`, `directed`, `knock_off_roadmap_80`, artifact generated **2026-08-22
  21:17Z** — ride them. The driver's *measurement* path (L5155/5158) is pinned; its *self-proofs* are
  not.

**14 of the 22 publish a figure; 8 are verdict-only.** Eight were screened for inertness with a
paired, controlled measurement: **seven are byte-identical across `middle`, `top-tie-first` and
`bottom-tie-first` and are INERT with evidence; one — `tests/test-precharge-order.js` — MOVES.**

**The three ungated `staged_board` failures are NOT the arm.** All three produce the identical
verdict, at the identical turn, with the identical `endReason`, under all four arms. They are one
mechanism: the driver's Showdown mirror is keyed by **species name**, and it cannot express a body
that has been renamed (transform, forme change) or one that is already on the field.

**Two further red gates found, both arm-independent and both in `run-all.js`'s discovery set:**
`tests/test-end-state-severity.js` and `tests/test-state-differential.js` exit 1 on the current tree.

---

## 0. METHOD, AND WHY THE REPORT'S LIST WAS OFF BY FIVE

The report derived its list with *"a `playGame` call and no `arm:` mention anywhere in the file"*.
Two failure modes:

1. **`arm:` misses the shorthand.** `{ script: c.script, arm }` has no colon. Three files pin the arm
   correctly and were accused anyway.
2. **`playGame` is a substring of `replayGame`.** `rePLAYGAMe` matches. `engine/replay_differential.js`
   has no `playGame` call of any kind.

This audit instead extracts each call site's full balanced argument list and classifies it
(`ARM-EXPLICIT` / `ARM-SHORTHAND` / `NO-ARM`), then discards files whose `playGame` is a **local
function of their own** rather than the driver's. Scripts are in the session scratchpad
(`scan_arm.js`, `scan2.js`, `scan3.js`, `arm_probe.js`, `arm_probe2.js`, `armshim.js`); they write
nothing into the repo.

**Cleared — these five were never on the middle arm:**

| file | why it is not affected |
|---|---|
| `engine/replay_one.js` | `const ARM_ID = arg('--arm','middle'); const arm = G.ARM_BY_ID.get(ARM_ID)` — resolved **by id**, three call sites, shorthand. Line present since `11bab14`, 2026-08-22 00:23, i.e. before the report. |
| `tests/probe_trace_choice.js` | `const arm = G.ARM_BY_ID.get(pinId)`, shorthand. Present at `4c9b93b`, 2026-08-21. |
| `tests/test-resolution-order.js` | `const ARM_ID = 'bottom-tie-first'`, resolved by id, refuses to run if the driver has no such arm. Present at `c903a10`, 2026-08-22 01:18. Its header explains *why* it pins a corner. |
| `engine/lookahead_divergence.js` | declares its **own** `async function playGame(gameIdx, sink, budget)`; requires `champions_sim` and `magnemite`, never `game_differential`. |
| `engine/replay_differential.js` | no `playGame` identifier exists in the file. The match was `replayGame`. |

`engine/million_run.js` was not on the report's list and would have been a sixth false positive for
the same reason (its own `playGame(rng, half, teamRng)`).

**A correction is owed to `docs/ENGINE.md`.** It publishes the figure **27** in two places (the
"BLAST RADIUS" section and THE HAND LIST). The derived number is **22 direct + 4 indirect + 7 in the
driver itself**. Not edited here: ENGINE owns that ledger and an ENGINE agent is live in it.

---

## 1. THE LIST — 22 confirmed, on the current tree

`PRIMARY_ARM` on the live driver was read directly during this audit: **`middle`**. Confirmed, not
assumed.

Column meanings: **PUBLISHES** = writes an artifact, or a figure of its is quoted in a living doc.
**GATED** = `tests/run-all.js` discovers it (`test-*.js` only). **SCREEN** = measured under three
arms, this pass.

| # | file | calls | PUBLISHES | GATED | SCREEN |
|---|---|---|---|---|---|
| 1 | `tests/test-precharge-order.js` | 1 | figure: ENGINE.md "five arms, 83 checks" (2026-08-22) | yes | **MOVES — 4 lines of output differ under `bottom-tie-first`** |
| 2 | `tests/test-forme-assert.js` | 1 | **artifact** `data/forme-assert.json` (2026-08-22 06:22) | yes | not screened (writes an artifact; would clobber under a live agent) |
| 3 | `tests/test-switch-back-renamed.js` | 1 | **artifact** `data/switch-back-renamed.json` (2026-08-22 06:22) | yes | not screened (same reason) |
| 4 | `tests/staged_board.js` | 1 (`runOne`, exported) | scenario verdicts quoted in ENGINE.md; **rides 4 gates** | **no** | 3 failing scenarios identical under 4 arms |
| 5 | `tests/test-encore-fail-silent.js` | 1 | figure: "ten arms, four RED, six over-fire" (2026-08-22) | yes | **INERT** — byte-identical, 10 injections |
| 6 | `tests/test-bracket-regain.js` | 1 | figure: "3 arms, authority-compared" (2026-08-21) | yes | **INERT** — byte-identical, 3 injections |
| 7 | `tests/test-imposter-transform-line.js` | 1 | figure: "three arms" (2026-08-21) | yes | **INERT** — byte-identical, 3 injections |
| 8 | `tests/probe_drag_body.js` | 2 | ENGINE.md eligible-list evidence (2026-08-22) | no | not screened |
| 9 | `tests/probe_mega_priority.js` | 1 | ENGINE.md fix claim, `e3313a0` (2026-08-21) | no | not screened |
| 10 | `tests/probe_turn_order.js` | 2 | ENGINE.md *"voluntary switch order is not the defect"* (2026-08-19) | no | not screened |
| 11 | `tests/probe_fail_and_silent.js` | 1 | ENGINE.md "stages six refusals" (2026-08-19) | no | not screened |
| 12 | `tests/probe_volatile_leaves.js` | 1 | ENGINE.md "gained three candidates" (2026-08-19) | no | not screened |
| 13 | `tests/probe_bench_leaves.js` | 1 | ENGINE.md candidate list (2026-08-19) | no | not screened |
| 14 | `engine/leaf_engine_contrast.js` | 1 | **artifact** `data/leaf-engine-contrast.json` — generated **2026-08-07**, before the change | no | n/a |
| 15 | `tests/test-state-differential.js` | 3 | verdict only | yes | **INERT** — identical but for the pool-cache line; **exits 1** |
| 16 | `tests/test-end-state-severity.js` | 2 | verdict only | yes | **INERT** — byte-identical; **exits 1** |
| 17 | `tests/test-end-state.js` | 3 | verdict only | yes | not screened |
| 18 | `tests/test-speed-tie.js` | 1 | verdict only (its doc figure is 2026-08-08) | yes | **INERT** — byte-identical, 5 injections |
| 19 | `tests/test-effect-credit.js` | 1 | verdict only | yes | **INERT** — byte-identical, 2 injections |
| 20 | `tests/probe_drag_exposure.js` | 1 | verdict only, no doc citation | no | not screened |
| 21 | `tests/probe_mega_direct.js` | 1 | verdict only, no doc citation | no | not screened |
| 22 | `engine/explain_divergence.js` | 1 | cited in ENGINE.md 2026-08-08 only; a diagnosis tool | no | not screened |

### 1b. The four indirect callers, via `SB.runOne`

`tests/staged_board.js` exports `runOne(sc, patchedSrc)` — **no arm parameter** — and it is the only
path these four have to the driver. Fixing #4 above fixes all four at once, which makes it the single
highest-leverage entry in the whole list.

```
tests/test-assert-mode.js          SB.runOne(sc, src)        GATED
tests/test-perish-song.js          SB.runOne(sc, SRC)        GATED
tests/test-volatile-duration.js    SB.runOne(sc, SRC)        GATED
tests/test-middle-stall-address.js SB.runOne(WILLACT)        GATED  (its own direct call IS pinned;
                                                                    the SB one is not — a file can be
                                                                    half-pinned and nothing says so)
```

`tests/staged_status_counters.js` is the counter-example that proves the shape is fixable: its own
`runOne(sc, src, armId)` **does** take an arm and resolves it by id.

### 1c. The driver's own seven

```
engine/game_differential.js  L4040  plantedProof            clean game
                             L4062  plantedProof            planted game
                             L4360  statePlantedProof       clean game
                             L4380  statePlantedProof       planted game
                             L4554  directed scenario runner
                             L4607  KO probe (ROADMAP #80)
                             L4627  Sitrus probe
```

A **planted red demonstration on live dice is a weaker demonstration than one on a corner** — the
plant has to beat the noise as well as the engine. This is not in the report and belongs in the
register beside it.

---

## 2. THE RANK — ordered by what it costs to be wrong

The rank is by blast radius of a wrong answer, not by how likely the answer is wrong.

**TIER 1 — a caller whose figure is published AND is arm-dependent, or that many gates ride.**

1. **`tests/staged_board.js`.** One fix, five instruments. It is the harness for four discovered
   gates plus its own 24+ scenarios, its verdicts are quoted in `docs/ENGINE.md`, and it is gated by
   nothing (see §4). Fixing `runOne` needs an `armId` parameter that defaults to a **named** arm, on
   `staged_status_counters.js`'s pattern.
2. **`tests/test-precharge-order.js`.** The only caller MEASURED to move. Under `bottom-tie-first`
   four of its arms produce more protocol (11→12, 14→16, 12→13, 10→11 lines): secondaries fire and
   crits land that the middle arm did not draw. Its verdict does not flip today — both engines share
   the arm, so they agree either way — but **"the two protocol streams do not part" is a weaker claim
   on a board where fewer things happened**, and the published "83 checks" was measured there.
3. **`tests/test-forme-assert.js`** and **4. `tests/test-switch-back-renamed.js`.** Both write a
   `data/*.json` artifact, both regenerated **2026-08-22**, both unscreened. Artifacts outrank prose:
   a stale doc line is read by a person, an artifact is read by a program.

**TIER 2 — publishes a post-2026-08-13 figure, unscreened, no artifact.**

5. `tests/probe_turn_order.js` — publishes a **negative** claim (*"voluntary switch order is not the
   defect"*, 2026-08-19). A null result from an unpinned instrument is the most expensive kind of
   wrong: it closes a line of enquiry.
6. `tests/probe_drag_body.js` (2026-08-22, and the drag path is being edited right now).
7. `tests/probe_fail_and_silent.js`, 8. `tests/probe_volatile_leaves.js`,
   9. `tests/probe_bench_leaves.js`, 10. `tests/probe_mega_priority.js`.

**TIER 3 — gated, verdict-only, unscreened.**

11. `tests/test-end-state.js` (3 call sites; ENGINE.md records it going red before).
12. `engine/game_differential.js`'s own seven (§1c) — high value, but touching `ARMS[0]` or these
    sites is a **re-baseline** of `data/game-differential.json`, not a fix. It needs its own pass.

**TIER 4 — measured INERT, no action beyond pinning for hygiene.**

13. `tests/test-speed-tie.js`, 14. `tests/test-bracket-regain.js`,
15. `tests/test-effect-credit.js`, 16. `tests/test-imposter-transform-line.js`,
17. `tests/test-encore-fail-silent.js`, 18. `tests/test-end-state-severity.js`,
19. `tests/test-state-differential.js`.

**TIER 5 — no published figure, no citation.** `probe_drag_exposure.js`, `probe_mega_direct.js`,
`explain_divergence.js`, `leaf_engine_contrast.js` (its artifact pre-dates the change).

### How INERT was decided, and the control that makes the word mean something

Not by reading the fixture and judging it dice-free. By measurement, with an over-fire control.

A scratchpad shim wraps the driver's **exported** `playGame` so that a call omitting `arm` is handed
a named arm instead of falling through, then `require()`s the target test into the same process. It
prints how many calls it injected, so a screen that reached nothing cannot be mistaken for a screen
that found nothing. Each file was run three times — control (driver default), `top-tie-first`,
`bottom-tie-first` — and the **whole stdout diffed**, not just the exit code. A test can pass with
different internals; only the byte diff catches that.

```
test-speed-tie               injected 5    control vs top: 0 lines   vs bottom: 0 lines   exit 0/0/0
test-bracket-regain          injected 3    0 / 0                                          exit 0/0/0
test-effect-credit           injected 2    0 / 0                                          exit 0/0/0
test-imposter-transform-line injected 3    0 / 0                                          exit 0/0/0
test-encore-fail-silent      injected 10   0 / 0                                          exit 0/0/0
test-end-state-severity      injected 5    0 / 0                                          exit 1/1/1
test-state-differential      injected 86   3 / 3  (pool-cache lines only)                 exit 1/1/1
test-precharge-order         injected 5    0 / 16                                         exit 0/0/0
```

**THE CONTROL.** Byte-identical output across three arms is only evidence if the instrument could
have seen a difference. It could: the same harness, on the `roar-drags-whoever-is-standing-there`
board, reads

```
top-tie-first     |-damage|p1a: Incineroar|110/170     32 protocol lines
bottom-tie-first  |-damage|p1a: Incineroar| 94/170     34 protocol lines
middle            |-damage|p1a: Incineroar|112/170     32 protocol lines
```

The arm demonstrably moves damage and line counts through this path. So a file that does not move is
a file the dice do not reach — that is the evidence, and it is why "it probably doesn't matter" is
not what this section says.

**Fourteen files are NOT screened and are not called inert.** Absence of a screen is recorded as
absence of a screen.

---

## 3. WITHDRAWAL CANDIDATES — named, NOT withdrawn

Per Will's decision, withdrawal follows the re-run. These are figures that (a) trace to one of the 22
and (b) were generated on or after 2026-08-13.

**Artifacts (`data/`):**

| artifact | generated | by | note |
|---|---|---|---|
| `data/forme-assert.json` | 2026-08-22T06:22:12Z | `tests/test-forme-assert.js` | unscreened |
| `data/switch-back-renamed.json` | 2026-08-22T06:22:10Z | `tests/test-switch-back-renamed.js` | unscreened |
| `data/game-differential.json` — the `planted_divergence_proof`, `directed` and `knock_off_roadmap_80` blocks ONLY | 2026-08-22T21:17:11Z | `game_differential.js`'s own §1c sites | the headline `mode: A/middle/...` is deliberate and is **not** a candidate |

**NOT a candidate:** `data/leaf-engine-contrast.json` and `.jsonl` — generated 2026-08-07T20:17Z,
before `cf7a2c5`. (It is quarantined for other reasons; that is not this defect.)

**NOT candidates — the ratchets are clean.** `data/conformance-baseline.json` (08-11),
`data/effective-identity-baseline.json` (08-11), `data/fixture-learnset-baseline.json` (08-12) and
`data/fixture-legality-baseline.json` (08-14) all name `staged_board.js` and several probes, so they
look exposed. They are not: each is written by `engine/conformance.js` / `engine/fixture_legality.js`,
neither of which calls `playGame`. They ratchet **static properties of the scenario definitions**
(legality, learnsets, identity), which no die can reach. **No ratchet in this repository is downstream
of a dice-bearing unpinned call.**

**Figures quoted in `docs/`, dated by `git blame`:**

| doc line | figure | added | instrument | status |
|---|---|---|---|---|
| `docs/ENGINE.md:1596`, `:1650` | "five arms, 83 checks" | 2026-08-22 (`11bab14`) | `test-precharge-order.js` | **strongest candidate — the instrument is MEASURED to move** |
| `docs/ENGINE.md:118`, `:170`, `:181` | drag eligible-list evidence | 2026-08-22 (`f17d235`) | `probe_drag_body.js` | candidate |
| `docs/ENGINE.md:740`, `:784`, `:802`, `:820` | forme-assert / switch-back rows | 2026-08-22 (`f5547a5b`) | the two artifact writers | candidate |
| `docs/ENGINE.md:2309`, `:2390`, `:2430` | *"voluntary switch order is not the defect"* | 2026-08-19 (`16209a11`) | `probe_turn_order.js` | candidate — a **negative** claim |
| `docs/ENGINE.md:2439` | "stages six refusals" | 2026-08-19 (`16209a11`) | `probe_fail_and_silent.js` | candidate |
| `docs/ENGINE.md:2534` | "gained three candidates" | 2026-08-19 (`9379873b`) | `probe_volatile_leaves.js` | candidate |
| `docs/ENGINE.md:3132` | bench-leaf candidate list | 2026-08-19 (`929de80c`) | `probe_bench_leaves.js` | candidate |
| `docs/ENGINE.md:1970`, `:1994` | the `e3313a0` mega-priority fix claim | 2026-08-21 (`55accc40`) | `probe_mega_priority.js` | candidate |
| `docs/ENGINE.md:42`, `:1983` | "3 arms, authority-compared" | 2026-08-21 (`55accc40`) | `test-bracket-regain.js` | **cleared by screen — INERT** |
| `docs/ENGINE.md:43`, `:1485` | "ten arms, four RED, six control" | 2026-08-22 (`11bab14`) | `test-encore-fail-silent.js` | **cleared by screen — INERT** |
| `docs/ENGINE.md:1844`, `:1891` | "three arms" | 2026-08-21 (`76e4a679`) | `test-imposter-transform-line.js` | **cleared by screen — INERT** |
| `docs/ENGINE.md:12934`, `:13028` | the speed-tie proof | 2026-08-08 (`def378ac`) | `test-speed-tie.js` | pre-dates AND inert — not a candidate |

**Nine candidates, three cleared by measurement.** That ratio is the argument for Will's
one-at-a-time rule: a blanket withdrawal would have taken three true figures down with the rest.

---

## 4. THE THREE UNGATED `staged_board` FAILURES — what they are, and they are NOT the arm

`imposter-copies-the-body-opposite`, `hungerswitch-flips-every-turn`,
`roar-drags-whoever-is-standing-there`, all `SHORT`, all `extra: false`.

Played on release `39631097fcc7` under **four** arms — the driver default, `top-tie-first`,
`bottom-tie-first` and `middle` — replicating `runOne` exactly, including its neutralisation of the
driver's stop rule:

```
imposter-copies-the-body-opposite      every arm -> SHORT, played 2 of 3 turns
hungerswitch-flips-every-turn          every arm -> SHORT, played 1 of 3 turns
roar-drags-whoever-is-standing-there   every arm -> SHORT, played 2 of 3 turns
```

Same verdict, same turn, every arm, with the damage control above proving the arm reaches this path.
**Not the arm defect.**

`playGame`'s own result says what it is. `err=null`, `stateDiv=null`,
`boundariesAgreed == boundaries` on all three — **the two engines agreed on every board they
compared** — `endedMedi=false`, `endedSd=false`:

```
imposter      endReason: the boards parted — medicham2's placement cannot be expressed to showdown
                         (p2: slot 1 holds clefable, which showdown does not have under that name)
hungerswitch  endReason: ... (p2: slot 1 holds morpekohangry, which showdown does not have under that name)
roar          endReason: ... (p2: slot 1 holds corviknight, which showdown has but cannot switch in
                         (fainted/active))
```

**One mechanism, three faces: the driver's Showdown mirror is keyed by SPECIES NAME.**

- Ditto transforms into Clefable → the body no longer answers to `ditto`, and `clefable` is not on
  p2's team. The scenario's own comment predicts this (*"after a transform medicham2's body NO LONGER
  ANSWERS TO ITS OWN SPECIES"*) — it was written about the replacement mirror and it also breaks the
  Showdown mirror.
- Hunger Switch renames Morpeko to `morpekohangry` at the residual of the very turn it arrives, so the
  game dies at the end of turn 1 — the earliest possible point.
- Roar drags Corviknight back into the slot it just left; Showdown **has** that body but it is already
  active, so the mirror cannot switch it in.

This is an **instrument limitation in `engine/game_differential.js`**, not an engine defect and not a
divergence — precisely the same class as the arm fall-through, and it has been producing three
scenario failures that read as engine breakage. The fix is a slot/handle-keyed mirror instead of a
name-keyed one; that is a `game_differential.js` change and belongs in its own pass with its own red.

### "GATED BY NOTHING" IS EXACT, AND THE HOLE IS WIDER THAN THIS FILE

`tests/run-all.js` discovers `/^test-.*\.(js|py)$/` in `tests/` and a hand-list of `engine/` GATES.
`tests/staged_board.js` and all **ten** `tests/probe_*.js` files match neither. They print `ok`/`FAIL`
and exit non-zero, and nothing ever reads that exit code.

`run-all.js` already has a detector for this exact hazard — `looksLikeACheck`, which flags a file that
"exits non-zero AND announces a regression". **It is applied to `engine/` only.** And even pointed at
`tests/` it would miss `staged_board.js`: its clause is `/process\.exit\(\s*1\s*\)/`, and
`staged_board.js` ends with `process.exit(bad ? 1 : 0)`.

So the three failures are real, they increment `bad`, the file exits 1, and no gate has ever looked.

---

## 5. TWO RED GATES FOUND, NEITHER THE ARM, NEITHER PREVIOUSLY REPORTED

Both are `test-*.js`, both discovered by `run-all.js`, both exit 1 on the current tree, both
byte-identical across three arms.

**`tests/test-end-state-severity.js`** — PART 5 cannot be staged. Under the screen:
`pairs skipped: {"threw":0,"no_final_board":5,...}` →
`FAIL PART 5 COULD NOT BE STAGED ... A comparator that has not been shown catching a planted death
has proved nothing, so this is not a pass.`
Re-run WITHOUT the shim to clear the instrument: still red, but with a **different** message —
`THE CONTROL GAME ALREADY HAS A BODY ALIVE ON ONE SIDE ONLY ... this fixture cannot prove the plant
was caught.` Both are the fixture-selection class, and the message varies between runs because the
**team pool is drawn live from the store**, which OPS appends to. That is the documented
store-moves-under-the-measurement hazard showing up inside a gate's own fixture search.

**`tests/test-state-differential.js`** — three failures:

```
FAIL  the proof ran 1 plants and 42 are declared — CANNOT PLANT — the clean game's very first board
      already differs, so there is no agreeing board to plant into
FAIL  no switch-in ever reordered Showdown's side.pokemon in this sample, so PART 3 tested nothing.
      That is not a pass — it means the hazard could not be reached and the regression is unguarded.
FAIL  no game in this sample held weather across two boundaries, so PART 5 tested nothing.
```

The only difference across arms is the pool-cache line. **Arm-independent.** The first clause is the
interesting one and is not a fixture complaint: *the clean game's very first board already differs*.

Both are red now. Per CLAUDE.md they are fixed in the session that saw them red or waived by Will by
name — they are recorded here as RED, not filed.

---

## 6. OBSERVED, NOT CAUSED

- **An ENGINE agent is live.** `data/releases/fda4b805651e` was cut at 20:31 today and
  `data/game-differential.json` was rewritten at 21:17. All game-playing measurements here are pinned
  to release `39631097fcc7` (one of the two the drag/`-fail` agent used) so they read the same bytes
  it did. The three unscreened gate runs (`test-end-state-severity`, `test-state-differential`,
  `test-precharge-order`) take the newest release by default and were run twice minutes apart with
  consistent verdicts.
- **`data/docs-currency-baseline.json` is modified in the working tree.** Not mine.
- **`data/verification/engine-diff.n200.json`** and **`data/_scratch-jobs3.json`** are present and are
  not mine. Reported, left in place.
- `tests/test-forme-assert.js` and `tests/test-switch-back-renamed.js` were deliberately NOT run:
  they rewrite `data/*.json` while another agent is working, and a torn artifact costs more than an
  unscreened row.
- Nothing was committed. `docs/ROADMAP.md` was not touched. `status.js --write` was not run.

---

## 7. WHAT THE REGISTER OWES

1. **The count is 22, not 27** — plus 4 indirect via `SB.runOne` and 7 inside the driver.
   `docs/ENGINE.md` publishes 27 in two places.
2. **`tests/staged_board.js`'s `runOne` takes no arm parameter**, and four discovered gates ride it.
   One fix, five instruments — the highest-leverage row in the list.
3. **`tests/test-precharge-order.js` is measured arm-dependent.** Its "83 checks" was measured on a
   board where fewer secondaries fired.
4. **Three `staged_board` scenarios fail on a species-keyed Showdown mirror**, not on the arm and not
   on the engine. Instrument defect in `engine/game_differential.js`.
5. **`run-all.js`'s `looksLikeACheck` detector is applied to `engine/` only**, and its
   `process.exit(1)` clause would miss `staged_board.js` even if it were pointed at `tests/`.
   Eleven check-shaped files in `tests/` are gated by nothing.
6. **`tests/test-end-state-severity.js` and `tests/test-state-differential.js` are RED.**
7. **The driver's own planted proofs run on live dice.** A plant that must beat the noise is a weaker
   red than one on a corner.
