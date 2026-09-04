# The whole-game clause now reads the empirical arm — and it is RED

MEASURE, 2026-09-03. Release `8ad06030e129`, census pin `9446a684709d`, pool `0d103fb9fa87`
(`--team-store data/team-pool-frozen`), cap 12, arm `middle`, `--end-state`.

---

## 1. The defect, verified rather than re-derived

The coordinator's diagnosis is confirmed against the files, not restated.

| | `census-coverage-seeking/v1` | `empirical-click/v1` |
|---|---|---|
| games played | 961 | 961 |
| **both engines ended the battle** | **17 (1.8%)** | **474 (49.3%)** |
| stopped at the 12-turn cap | 944 | 469 |
| truncated — medicham2's placement not mirrorable | 0 | 16 |
| THREW | 0 | 1 |
| **board-material games** (`state.games − state.games_board_never_diverged`) | **0 of 961** | **77 of 961** |
| protocol first-divergence games (`diverged`) | 6 | 168 |
| turn boundaries compared / identical | 12,445 / 12,445 | 10,572 / 10,312 |

Both rows are on **one set of pins** — same release, same census digest, same pool digest, same
`pins.digest ccb365985023`, same cap, same 961 games. The driver is the only difference.

The artifact that `wholeGameClause()` read at the start of this pass was the coverage one
(`steering.policy: census-coverage-seeking/v1`, generated 2026-09-04T01:41:12Z) and the gate read
**GATE: OPEN — 8 of 8 PASS**, with the whole-game clause saying *"ZERO divergences across 961 games
that anything is asked to answer for"*.

**How the coverage artifact got into the published slot is on the record and is not a mystery.** The
OWED block of `docs/_reports/2026-09-03-pinned-rerun-chain.md` carries this command:

```
cmd /c tools\lownode.cmd engine\game_differential.js --release 8ad06030e129 --arm middle --end-state --census data/verification/census-pin-9446a684709d.json --games 1200 --team-store data/team-pool-frozen --write
```

Every pin is there and `--steering` is not. It was run verbatim at 01:41 and published a coverage
arm into the gate's slot. Omission is the whole bug.

---

## 2. What was changed, and which of the two options was taken

**Option taken: the empirical arm IS `data/game-differential.json`. There is ONE published
quantity, not two files.** The clause was not repointed at `data/verification/`.

That choice is not a preference. `data/game-differential.json` is read by
`engine/coverage.js`, `engine/divergence_report.js`, `engine/explain_divergence.js`,
`engine/gate_fail_and_silent.js` and `engine/gate_offfield_target.js` as well as by the gate.
Repointing only the gate would have left every one of those describing a different population from
the clause — two copies of one fact, drifting, both passing their own checks.

### 2a. `engine/game_differential.js` — the published slot belongs to the empirical arm

A refusal at argument-parse time (second zero, not after four minutes of games):

```js
if (WRITE && !OUT && !EMPIRICAL) { ...; process.exit(2); }
```

Demonstrated red: `node engine/game_differential.js --games 2 --write` exits **2** and prints
*"REFUSING TO PUBLISH A COVERAGE-ARM RUN INTO data/game-differential.json"*, naming both the
`--steering empirical` fix and the `--out` escape.

**The `--steering` default was deliberately NOT flipped.** Two reasons, both measured:

1. Will, 2026-08-29: *"thats why we have both."* 48 legal moves are clicked zero times in 21,726
   real games; the empirical driver cannot reach that tail by construction.
2. Dozens of `tests/probe_*.js` **`require`** this module and inherit the steering at require time.
   Under `empirical` the module throws if the opened release does not carry
   `data/move-priors.json` as a frozen SOURCE. Flipping the default would have stranded every probe
   that opens an older release — a large blast radius for a change whose whole point is the
   published slot.

What moved is **which arm may occupy the published slot**, not what a coverage run is.

### 2b. `engine/quarantine.js` — the clause refuses a population it was not asked about

`wholeGameClause` now reads `j.steering.policy` and refuses anything that is not
`empirical-click/v1`, returning `cannot_answer: true, withheld: true` with **no rate, no diverged,
no games and no class composition** — withheld, not captioned, on the same rule as the #298 release
refusal one block above it.

It refuses on **absence** as well as on a named coverage policy. This is deliberately *stricter*
than its sibling #298, which allows an unstamped artifact to answer: a missing release id is a fact
about an old writer, whereas a missing `steering` block is an artifact whose sample nobody recorded.
`steering.comparable` has failed closed on exactly that since ROADMAP #81 — *"the honest answer for
those is NOT that they were comparable, it is that nothing recorded whether they were."*

Demonstrated red on the real coverage artifact before it was replaced:

```
FAIL  whole-game differential / the same game on both engines
  MEASURED ON THE WRONG POPULATION — this clause is answered by `empirical-click/v1` and the
  artifact declares `census-coverage-seeking/v1`. THE RATE, THE DIVERGED COUNT, THE GAME COUNT AND
  THE CLASS COMPOSITION ARE ALL WITHHELD. ...
  exit 2   [0 the two engines agree on every game, 1 they do not, 2 cannot answer]
```

Four new selftest assertions drive the shipping clause, not a restatement of it: a named coverage
artifact refuses; the figures are absent from the returned object *and* from the verdict string; the
refusal names both policies; an artifact with **no** steering block refuses too; and the refusal maps
to `clauseExit` **2**. `node engine/quarantine.js --selftest` → **159 passed, 0 failed**.

---

## 3. The re-run, and the proof it landed

```
cmd /c tools\lownode.cmd engine\game_differential.js --release 8ad06030e129 --steering empirical --arm middle --end-state --census data/verification/census-pin-9446a684709d.json --games 1200 --team-store data/team-pool-frozen --write
```

`--games 1200` is a **pair budget**; 961 games were played, the same denominator as every arm above.

**Evidence the write happened, not the exit code:** 76,014 bytes of run output ending `-> data/game-differential.json`, and the artifact's own `generated` moved
**2026-09-04T01:41:12.598Z → 2026-09-04T02:01:07.056Z**.

**SCOPE FIELDS OF THE PUBLISHED ARTIFACT, printed before the headline is quoted:**

| field | value |
|---|---|
| `by` | `engine/game_differential.js` |
| `engine_release` | `8ad06030e129` (matches `data/engine-release.json`) |
| `mode` | `A/middle/pins:ccb365985023/credit:observed-effect/v1/nature:real` |
| `steering.policy` | **`empirical-click/v1`** |
| `steering.census_role` | `CREDITED ONLY — it measures coverage and does not select` |
| `steering.driver_inputs` | `move-priors.json@e667fe8ab457` (from release), `rollout-switch-census.json@b599f8d581b5` (live tree) |
| census pin | `data/verification/census-pin-9446a684709d.json`, digest `9446a684709d`, 643 rows, `matches_live: false` |
| team pool | `data/team-pool-frozen`, digest `0d103fb9fa87`, 8,778 teams, 1,968 picked |
| `pins` | digest `ccb365985023`, `arms_run ["middle"]`, primary `middle` |
| `games` / `turns_cap` / `elapsed_s` | 961 / 12 / 135.9 |
| `state_mode` / `end_state_mode` | true / true |
| `planted_divergence_proof_ok` | **true** |
| sample exclusion (`closet`) | 43 teams dropped for carrying Illusion (ROADMAP #160); 17 of those carry the body past the 4 a pair brings, so the rule is over-broad by that much |

**It reproduces the 2026-09-03 empirical arm exactly** — `data/verification/game-differential.empirical.json`
and the new published artifact agree on games 961, `diverged` 168, `threw` 1, board-material 77, and
all four pin/pool/census/release digests. The instrument is deterministic under these pins.

### The two headline quantities, each named

- **Board-material headline** — `state.games − state.games_board_never_diverged` = **77 of 961 = 8.0%**.
  Median turn of first board divergence 5. 40 rows in `state.first_board_divergences`.
- **Protocol first-divergence** — `diverged` = **168 of 961**, and this is the quantity the class
  table is computed on: emission 71, rule 47, field 33, ordering 15, unparsed 2 (1 of the unparsed is
  `medicham2 stopped emitting while showdown continued`, which the comparator has no grammar for).

### What the empirical arm can now see that the coverage arm structurally could not

End-state verdicts over 961: `SAME-END-STATE` 910, `DIFFERENT-END-STATE` 49, `ENDED-APART` 1, `THREW` 1.
Severity bands over the 49:

| band | | games |
|---|---|---|
| 1 | DIFFERENT-WINNER | **0** |
| 2 | DIFFERENT-BODIES-ALIVE | **17** |
| 3 | HP-BEYOND-A-TYPICAL-HIT | 4 |
| 4 | DIFFERENT-IDENTITY-ON-A-LIVE-BODY | 4 |
| 5 | OTHER-STATE-DIFFERENCE | 14 |
| 6 | SMALL-HP-OR-BOOST-ONLY | 10 |

Band 1 is zero. Band 2 — a body dead in one engine and standing in the other, 17 games — was
**unreachable** under a driver in which 98.2% of games never ended.

### The coverage cost of the swap, measured rather than assumed

Census rows credited: **563 → 556** (of 580 measurable), so 7 rows. Distinct moves *connected*:
**185 → 355**. The published slot did not lose the mechanic tail in the direction that was feared;
the coverage arm remains the deliberate tail instrument and is still runnable by id.

### Instrument caveats that travel with this number (all identical in the prior empirical run — none introduced here)

- **16 games (1.7%) truncated** because medicham2's placement could not be mirrored to Showdown, so
  the 49.3% completion rate is a **lower bound**. 37 forced switches were unmirrorable in total.
- **`switch lookups that MISSED: medicham 2, showdown 0`** — the file says this MUST read 0.
- **2 choices Showdown REFUSED** (first: *"Can't move: Floette's Protect is disabled"*) — MUST read 0.
- 8 void games under `mid_void` (`low-identity`), leaving 953 usable; `diverged_among_usable` 160.
- 1,851 draws (2.4%) where the priors row held none of the body's legal moves and fell to the 0.02
  floor — an empirical label on a uniform draw.

---

## 4. THE GATE READING AFTER THE CHANGE, CLAUSE BY CLAUSE

`node engine/quarantine.js` → **GATE: CLOSED — 1 of 8 clauses fail.**

| # | clause | verdict | reading |
|---|---|---|---|
| 1 | game differential | PASS | clean at both corners, 0 of 6000 at midpoint, top, bottom and idx01–idx14 (seed 20260804) |
| 2 | deliberate roster / items | PASS | clean: 140 of 148 tested |
| 3 | deliberate roster / abilities | PASS | clean: 129 of 202 tested; 45 rows count in neither column (the control arm is itself a live ability) |
| 4 | deliberate roster / moves | PASS | clean: 475 of 500 tested |
| 5 | coverage / every used mechanic is measured by something | PASS | all 412 moves above 25 clicks measured by the roster or the census |
| 6 | **whole-game differential / the same game on both engines** | **FAIL** | **167 of 961 = 17.4% (168 raw, less 1 declared, 0 cleared on decision impact)** |
| 7 | mechanics / each one staged and compared | PASS | 5 diverge, 1 declared, 4 below the reach shelf, 0 cleared → 0 |
| 8 | no open, known engine defect | PASS | no open row names an instrument that is RED (112 verdicts read) |

**The one FAIL is category (b): a named instrument genuinely RED.** It is not measured against a
different engine — the artifact's `engine_release` is `8ad06030e129`, which is the current tree — and
it is not a register row without an instrument. `node engine/quarantine.js --whole-game` exits **1**
(the defect is PRESENT), not 2.

Nothing was tuned. The clause's arithmetic is byte-for-byte what it was; only the population changed.

### The number the clause prints is 167, not 77, and that is a real discrepancy — read this

The brief expected the clause to go red *"at roughly 77 of 961"*. It reads **167 of 961**, and the
difference is not the run:

- **`wholeGameClause` gates on `j.diverged`** — protocol first-divergence games, 168 — less the
  declared/decision-impact subtractions. It does **not** compute
  `state.games − state.games_board_never_diverged` anywhere. Grep confirms: `games_board_never_diverged`
  appears in `engine/quarantine.js` only inside the ROADMAP #440 closet row's *evidence prose*.
- CLAUDE.md's stated bar since 2026-08-22 is **board-material zero, with narration as its own
  separate gate afterwards**. The clause is therefore **stricter than the stated bar** — it is
  currently gating on narration and board together.
- **This was deliberately NOT changed in this pass.** Moving the headline from 167 to 77 is a
  relaxation of the gate, and doing it in the same pass that turned the gate red would be
  indistinguishable from tuning. It also mixes quantities: the declared and decision-impact
  subtractions are counted over **protocol causes**, so subtracting them from a board-material total
  would be #292's error in a new place. It is listed under OWED as a decision for Will.

Both numbers are published above so neither has to be inferred.

### Two register findings that fell out of the swap

1. **The ROADMAP #440 closeted row now matches nothing.** Under the coverage arm the perish-drain
   cause subtracted 1 game; on the empirical sample it matches zero, and the clause says so:
   *"MATCHED NOTHING IN THIS RUN — a declaration that covers no cause is a claim that has quietly
   become false. Withdraw it or show the cause it excuses."* Its evidence was also already flagged
   NOT RE-CHECKED (measured on release `5f3f7141227c`, artifact on `8ad06030e129`).
2. **Supreme Overlord `fallenundefined` fell 5 games → 1.** Same declaration, different sample.

Neither is a defect; both are declarations whose support moved with the population, and both belong
to whoever holds those rows.

### `status.js` agrees, and its own row already said this

`node engine/status.js` (read-only, **not** `--write`) prints, under *driver policies the gate
quotes — 1 of 2*:

> `empirical-click/v1` (game-differential.json, 961 games): 474 reached a result (49.3%), 469 stopped
> at the turn cap, 16 truncated …, 77 games whose BOARD diverged. … ALL 3 ON ONE SET OF PINS —
> release 8ad06030e129, cap 12, pool 0d103fb9fa87, so the difference between them is the DRIVER and
> nothing else. … TWO INSTRUMENTS, NOT A BEFORE/AFTER: … "board-material zero" under a
> coverage-seeking driver is a statement about games that do not end.

The **Gated** artifact named on that row is now the empirical one.

### The trend is withheld, and that is luck rather than a guard

The clause printed `DIRECTION OF TRAVEL WITHHELD` because `data/whole-game-baseline.json` was stamped
under pin digest `2efbc9ed1946` and this run is `ccb365985023`. **`mode` does not carry the steering
policy** — both arms produce the identical `mode` string — so under one pin digest a coverage
baseline and an empirical run would have compared as `baseline_comparable: true`. The published path
can no longer hold a coverage arm, and `--stamp-whole-game` reads only the published path, so the
hole is closed in practice; it is recorded here because it is closed by construction and not by a
check. No baseline was stamped in this pass.

---

## 5. Tests run

| | |
|---|---|
| `node engine/quarantine.js --selftest` | **159 passed, 0 failed** (4 new assertions) |
| `node engine/quarantine.js --whole-game` | exit **1** on the empirical artifact; exit **2** on the coverage one |
| `node engine/game_differential.js --games 2 --write` | exit **2**, refuses to publish a coverage arm |
| `tests/test-empirical-driver.js` | **GREEN — all 20 checks passed** |
| `tests/test-arm-steering.js` | **all steering-guard demonstrations passed** (uses `--out`, unaffected) |
| `tests/test-web-quarantine.js` | **ALL PASS** |
| `tests/test-web-status.js` | **12 FAILURES — RED, and not from this change** |
| `tests/test-web-quarantine-loaders.js` | **2 FAILURES — RED, and not from this change** |

The two red WEB tests are stated rather than filed. `test-web-status` fails on stale site data
unrelated to the gate — `engine.live 423 vs census 829`, `ops.games 52089 vs 83774`, and a staleness
stamp reading 2026-08-11. `test-web-quarantine-loaders` fails because `web/quarantine-data.js` was
built **2026-08-25** and declares `open: false`, which could not have matched a builder decision
taken while the gate read OPEN immediately before this pass — so it was red before the change too.
**WEB is paused by standing decision until MEDICHAM is correct**, so this division did not rebuild
`web/`; the exact command is in OWED. A full before/after A/B was declined on purpose: it would have
required overwriting an `engine/quarantine.js` that carries ~5.6 KB of another session's uncommitted
work, and the evidence above settles it without that risk.

## 6. Files

- Changed: `engine/game_differential.js`, `engine/quarantine.js`.
- Rewritten by the re-run: `data/game-differential.json` (now the empirical arm).
- **Created, nothing deleted:** `data/verification/game-differential.coverage-2026-09-04T0141.json`
  — a byte copy of the 01:41 coverage artifact, taken **before** the publish so an uncommitted run
  was not destroyed by the overwrite. It is the coverage row of every table above.
- Untouched: `data/verification/game-differential.empirical.json`, `data/policy-weights.json`,
  `data/whole-game-baseline.json`, every division ledger, `web/`.
- Nothing was committed.

---

# OWED

Exact commands. Nothing below was run.

**1. Stamp the ledgers — held back deliberately so Will sees the new reading first.**

```
node engine/status.js --write
```

**2. The board-material-vs-protocol decision on the whole-game clause. WILL'S CALL, NOT MEASURE'S.**
No command. The clause gates on protocol first-divergence (**167**); CLAUDE.md's stated bar is
board-material (**77**) with narration as a separate gate. Changing it is a relaxation and was not
taken here. Both numbers are published above. If it is taken, the declared/decision-impact
subtraction has to move to a board-material attribution in the same pass or two quantities get mixed
in one line.

**3. Withdraw or re-evidence the ROADMAP #440 closeted row** — it now matches no cause in the
published run, and its evidence was measured on release `5f3f7141227c`. Register work, not a command.

**4. Re-stamp the whole-game baseline, if a bar under these pins is wanted.** Not run: the current
baseline (`2efbc9ed1946`, 1.9%) is a different corner and a different driver, and the ratchet refuses
a worse number by design.

```
node engine/quarantine.js --stamp-whole-game
```

**5. Rebuild the WEB quarantine payload — WEB IS PAUSED; this is listed, not recommended.**

```
node web/build-quarantine.js
```

**6. Keep a coverage arm on the current release, if the tail reading is wanted alongside.** It can no
longer land on the published path, which is the point.

```
cmd /c tools\lownode.cmd engine\game_differential.js --release 8ad06030e129 --steering coverage --arm middle --end-state --census data/verification/census-pin-9446a684709d.json --games 1200 --team-store data/team-pool-frozen --write --out data/verification/game-differential.coverage.json
```

**7. The two instrument counters that MUST read 0 and do not**, carried from the empirical arm and
not investigated here: `switch lookups that MISSED: medicham 2`, and `2 choices Showdown REFUSED`.
ENGINE-owned.

**8. MEASURE's own one number stays withheld.** Leaf calibration is still QUARANTINED — the gate is
closed, so `data/winrate-backtest.json` (739 h old), `data/leaf-engine-contrast.json`,
`data/click-censoring-census.json`, R1–R4 and `data/policy-weights.json` remain unquotable. No refit,
no restamp, no fit was run.
