# Pinned re-run chain against release `8ad06030e129` — 2026-09-03/04

Run serially inside one agent, every stage through `tools\lownode.cmd` (BELOWNORMAL), nothing else
playing a game at the same time. Will was gaming.

## The one-line answer

**Four of the five failing gate clauses were never failing on the engine. They were failing on
staleness.** Re-measured against the current tree they come back clean, and `node engine/status.js`
now reads **7 of 8 PASS, 1 FAIL**. The remaining FAIL is the whole-game differential clause, and it
is still FAIL for the *same* reason it was this morning — `data/game-differential.json` has not been
re-run — because the chain wrote the empirical arm to `data/verification/`, which that clause does
not read.

---

## The wrapper was verified before it was trusted

`cmd //c 'tools\lownode.cmd' <script>` is the form that works from the Bash tool on this box. It was
proved rather than assumed, with a control in both directions:

| probe | through the wrapper | bare `node` (control) |
|---|---|---|
| a script that `process.exit(3)` | printed its line, **exit 3** | — |
| `os.getPriority(process.pid)` | **10** (`PRIORITY_BELOW_NORMAL`) | **0** (`PRIORITY_NORMAL`) |

So the priority class is real and the exit code propagates. `tools\lownode.cmd` derives
`--max-old-space-size` from an `ABRA-HEAP:` line in the child's source; **none of the four scripts in
this chain declares one**, so every stage ran at node's default old space and none hit exit 134.

## What was pinned

| pin | value | how it was chosen |
|---|---|---|
| engine release | `8ad06030e129` | named in the brief; `engine_release.js list` reports **0 of 26 files moved since**, so the snapshot is the current tree |
| census | `data/verification/census-pin-9446a684709d.json` (digest `9446a684709d`, 643 rows) | the same bytes the 2026-08-29 empirical arm was steered by, so the pair is a controlled before/after on the engine alone |
| team pool | `data/team-pool-frozen` (digest `0d103fb9fa87`, 8,778 teams, 1,968 picked) | identical digest and identical pick count in both arms |

`data/engine-release.json` was already modified in the working tree when this session started
(`53e3e90dce8d` → `8ad06030e129`, pointer written 01:08:54Z, ~4 minutes before the first command
here). That is somebody else's cut, not this chain's. **No release was cut by this agent.**

---

## Stage 1 — whole-game differential, EMPIRICAL arm

### It was run three times, and the first two runs are void. Say so plainly.

The brief's command was `--games 1200 --team-store … --write --out …` plus "check the header for how
to select the EMPIRICAL steering arm". Two further flags turn out to be load-bearing and are not in
that command:

1. **Run 1** (`--steering empirical`, no `--state`): came back `state_mode: false`. Without `--state`
   a game stops at its first divergent *line*, so no board is ever compared and
   `state.games_board_never_diverged` — the published headline — **does not exist in the artifact**.
   It also defaulted to all three pin arms, giving pin digest `da2f3902e33c` against the published
   `ccb365985023`. VOID for the headline.
2. **Run 2** (`--arm middle --state`): produced the headline, but the 2026-08-29 baseline and the
   published coverage artifact were both taken with `--end-state`, and the driver's own header says
   *"A RUN WITH IT IS NOT THE SAME SAMPLE AS A RUN WITHOUT IT… its protocol counts are its own bar
   and must not be read against a protocol-mode run's."* Not comparable. VOID as a pair.
3. **Run 3 — the one reported.** `--release 8ad06030e129 --steering empirical --arm middle
   --end-state --census … --games 1200 --team-store data/team-pool-frozen --write --out
   data/verification/game-differential.empirical.json`

Only run 3's artifact is on disk. The 2026-08-29 bytes of that path are recoverable with
`git show HEAD:data/verification/game-differential.empirical.json`; the untouched baseline used for
the comparison below is `data/verification/game-differential.empirical-after.json`.

### The pair is certified comparable

`node engine/arms_comparable.js data/verification/game-differential.empirical-after.json
data/verification/game-differential.empirical.json` → **exit 0, COMPARABLE.** Same steering policy
(`empirical-click/v1`), same census digest, same pin digest `ccb365985023`, same single arm
`middle`, same team pool, same 961 games, same 12-turn cap, same five declared `not_compared` fields.

Its own stated blind spots: it does not stamp `engine/game_differential.js` itself,
`data/protocol-events.json` (the declared skip list), or uncommitted edits inside `SHOWDOWN_PATH`.

### The numbers, each named by the quantity it is

`--games 1200` is a **pair budget**, not a game count. **961 games were actually played** in both
arms — identical denominators, so these may be read against each other.

**THE PUBLISHED QUANTITY — the whole-game headline, `state.games − state.games_board_never_diverged`,
read out of the artifact:**

| | before `e129bca605e3` | after `8ad06030e129` |
|---|---|---|
| **whole-game board divergences / 961** | **117** (12.2%) | **77** (8.0%) |
| games whose board never parted | 844 | 884 |
| games that threw | 2 | 1 |

**A DIFFERENT QUANTITY — protocol first-divergence** (this is what the per-cause class table is
computed on, and a fix that closes a protocol divergence drops a game out of the cause table while
its board may go on parting):

| | before | after |
|---|---|---|
| protocol diverged / 961 | 233 | **168** |

Per-cause class table, protocol first-divergence, before → after:

```
  ordering                              54 -> 24
  event missing from medicham2          62 -> 52
  extra event emitted by medicham2      29 -> 21
  unrelated event mismatch              37 -> 35
  -damage field 3                       20 -> 18
  -activate: a different body            6 ->  5
  -unboost: a different body             5 ->  0
  -status field 4                        5 ->  5
  -enditem field 4                       3 ->  0
  showdown stopped emitting while medicham2 continued   3 -> 1
  -activate field 4                      2 ->  2
  -crit / -heal / move / switch / -fail / -weather      6 ->  3
```

**A THIRD QUANTITY — end-state verdicts** (`--end-state`: play to the cap or the battle's end
whatever either comparator already found, then compare the last board both engines produced):

| | before | after |
|---|---|---|
| SAME-END-STATE | 875 | **910** |
| DIFFERENT-END-STATE | 81 | **49** |
| ENDED-APART | 3 | 1 |
| THREW | 2 | 1 |

Severity ladder over the DIFFERENT-END-STATE games only:

```
  1 DIFFERENT-WINNER                    0 ->  0
  2 DIFFERENT-BODIES-ALIVE             27 -> 17
  3 HP-BEYOND-A-TYPICAL-HIT            11 ->  4
  4 DIFFERENT-IDENTITY-ON-A-LIVE-BODY   5 ->  4
  5 OTHER-STATE-DIFFERENCE             24 -> 14
  6 SMALL-HP-OR-BOOST-ONLY             14 -> 10
```

### SCOPE, printed before the headline is cited

- **turn cap 12.** Every board-material figure above is a claim about the first twelve turns only.
- games that ended naturally: **474 of 961 (49.3%)**; the turn cap ended 469. (The coverage arm ends
  17 of 961. This is the arm the brief asked for and it is the one where the ending bands are
  reachable at all.)
- `coverage.exercised` **556 of 580 measurable** (before: 557). The selector bytes are identical; the
  one-row move is a consequence of the engine playing differently, not of a different sample.
- `closet.teams_dropped` **43** (both arms).
- `state.not_compared` **5 declared fields**, identical in both arms: ability trapping (Shadow Tag);
  item disposition (`lastItem`/`ateBerry`); yawn/attract/curse/heal-block; the `trapper` mark on the
  source; the durations on magnet rise and syrup bomb.
- `planted_divergence_proof_ok: true` in both arms — the instrument can see a divergence it planted.
- 0 undeclared protocol drops.

### AND THIS ARTIFACT IS NOT WHAT THE GATE READS

`engine/quarantine.js` `wholeGameClause()` reads **`data/game-differential.json` and nothing else**.
The brief directed this run to `--out data/verification/game-differential.empirical.json`, so the
published artifact keeps its 2026-08-29 numbers and **the scoped figures above are not current
state as far as the gate is concerned.** `publish_guard.js` did not refuse anything — this diversion
was the explicit instruction, not a guard firing. The one command that settles the clause is under
OWED.

For the record, at the same old release the two arms disagreed hard about this very question:
coverage arm **0 of 961**, empirical arm **117 of 961**. The published clause is answered by the
coverage arm.

---

## Stages 2–4 — the deliberate roster, all three stages

`--release 8ad06030e129 --write`. The roster stages its own fixtures from the format and never draws
the team pool or the census, so the pool/census pins do not apply to it and it records none.

| stage | FIRED-AND-BOARDS-DIFFER | DID-NOT-FIRE | tested / in scope | COULD-NOT-STAGE | other |
|---|---|---|---|---|---|
| items | **0** | **0** | 140 / 148 | 8 | — |
| abilities | **0** | **0** | 129 / 202 | 27 | 114 out of scope (no legal carrier); **45 UNATTRIBUTABLE** (control is itself a live ability); 1 DEFERRED-BY-OWNER |
| moves | **0** | **0** | 475 / 500 | 22 | 3 DEFERRED-BY-OWNER |

Arms that actually reached the driver (a label is not a receipt): items 280 `top-tie-first`;
abilities 444 `top-tie-first` + 19 `bottom-tie-first`; moves 741 + 246.

**Every count is byte-identical to the 2026-08-29 run at `e129bca605e3`.** The roster clauses were
not measuring a broken engine this morning; they were measuring a dead release.

**`--reds` was NOT passed, per the brief's command, and the file's own header calls that out:**
*"`--reds` IS NOT DEFAULT AND `--write` WITHOUT IT SILENTLY STAMPS `reds: []`."* No information was
lost — the three artifacts already carried `reds: []` from 2026-08-29 — but the eighty-two shape
rules have still not been asked whether they can say anything other than "fine" on this release.
Command under OWED.

---

## Stage 5 — `all_mechanics_fire.js`

**Run as `--kind all --release 8ad06030e129 --write`, which is a deliberate deviation from the
brief's `--write` alone, for two reasons read out of the file:**

- `--kind` defaults to **`moves`**. A `--kind moves --write` would have stamped a moves-only artifact
  over one carrying all three populations, and the gate's mechanics clause reads
  `[moves, abilities, items]`. There is no publish guard on this file to catch the shrink.
- `--red` was **not** passed on purpose. Line 3603 is
  `if (RED) { if (WRITE) fs.writeFileSync(…, JSON.stringify({ red: REDS })); return; }` — the flag
  writes the red block **and nothing else**. The red demonstration runs on every normal run anyway:
  **21 plants, `red_ok: true`.**

Arm is hard-wired to `bottom-tie-first` (under the primary arm every sub-100-accuracy move misses,
and a missed move has not resolved). 1,313 games played, 0 threw, 0 sheets unassembled.

| population | diverged | before (e129) |
|---|---|---|
| moves | **4** | 4 |
| abilities | **1** | 1 |
| items | **0** | 0 |

Row counts unchanged at 500 / 316 / 148 — no shrink.

SCOPE: `moves.resolved` 495 of 500; `abilities.fired` 104 of 316 (129 unreachable — no legal
carrier — 58 staged and never fired, 38 cannot fire in this fixture, 20 did-not-fire unexplained);
`items.fired` 64 of 148 (75 out of scope, 9 staged and never fired); `preflight.trigger_unstaged` 10;
**67 mechanics staged and never fired — a harness gap, not counted in the verdict.**

### The clause PASSES, and here is exactly what it subtracts

`5 diverge, 1 declared, 4 below the reach shelf, 0 cleared on decision impact, leaving 0.`

- **DECLARED — `ability:supremeoverlord`.** `fallenundefined` on a `[silent]` line: Showdown guards
  `onStart` on `side.totalFainted` and not `onEnd`, so it emits a literal typo players never see.
  Reproducing a typo is not correctness.
- **BELOW THE REACH SHELF — four moves, still staged and played, not counted:**
  `gastroacid` (11 clicks / 64,846 stored games), `reflecttype` (11), `corrosivegas` (1),
  `healbell` (0). Shelf is 25+ clicks for moves.
- **SHELVED BY THE OWNER (not counted, still played):** `move:bittermalice`, `move:nightdaze`
  (Illusion is in the closet), `ability:forewarn` (the effect is a message).
- **DECISION IMPACT: none.** `data/decision-impact.json` is absent, so nothing is excused on it and
  every played divergence counts.

**Defects seen and left alone** (a measurement is a photograph; nothing was fixed):

- `STATE healbell` — boards parted at turn 4: `p1 venusaur party.status` showdown `""` vs ours
  `"slp"`, `status_counter` 0 vs 2. Heal Bell is not clearing sleep on the bench.
- `STATE reflecttype` — boards parted at turn 1: `p1 gengar party.types` showdown `"water"` vs ours
  `"ghost/poison"`. Reflect Type is not retyping.
- `gastroacid` writes `volatile:gastroacid`, a leaf the board comparator does not read — **UNASKED,
  not clean.**
- `abilities.showdown_only: 8` — eight abilities where the authority's game changed and ours did not.
  The header calls that an engine bug; the clause counts `diverged` and does not count these.

---

## The prediction the brief asked for, and the honest bookkeeping on it

The brief asked me to call, **before** reading the pool, whether these were rare mechanics — lab
moves, pinned pool sits still. **I cannot claim that call: the chain order put the pool first and I
read it before the lab.** What actually happened is the *opposite* of that shape, and it is worth
saying:

- **The LAB did not move at all.** Roster: identical counts across all three stages.
  `all_mechanics_fire`: identical 4 / 1 / 0. Both were already at their floor on the gated counters,
  so there was no room to move — this is not evidence the fixes did nothing.
- **The PINNED POOL moved a lot.** 117 → 77 whole-game, 233 → 168 protocol, DIFFERENT-END-STATE
  81 → 49, `ordering` 54 → 24, `-unboost: a different body` 5 → 0, `-enditem field 4` 3 → 0.

Read together: **the delayed-hit crit draw and the Substitute clamp are not rare mechanics.** They
land in real ladder play, on games the deliberate roster's one-turn staged fixtures cannot reach.
That is the pinned pool doing the job it was ranked first for.

Caveat that must travel with it: the whole-game headline moved on the **empirical arm**, which is a
verification-side artifact. The published coverage arm has not been re-run.

---

## Clause by clause, what `node engine/status.js` says NOW

Before this chain: **3 PASS, 5 FAIL** — all five FAIL reading `MEASURED AGAINST A DIFFERENT ENGINE`.
After: **7 PASS, 1 FAIL.**

| clause | before | after | which state |
|---|---|---|---|
| game differential (damage corners) | PASS | **PASS** | — clean at both corners, 0 of 6000 at every index |
| deliberate roster / items | FAIL | **PASS** | was (a); now measured, clean |
| deliberate roster / abilities | FAIL | **PASS** | was (a); now measured, clean |
| deliberate roster / moves | FAIL | **PASS** | was (a); now measured, clean |
| coverage / every used mechanic is measured | PASS | **PASS** | — |
| whole-game differential / same game both engines | FAIL | **FAIL** | **(a) still measured against a different engine.** `data/game-differential.json` is 5.9 days old and stamped `e129bca605e3`. NOT a named instrument red — the rate, the diverged count, the game count and the class composition are all withheld, so nothing is known about it |
| mechanics / staged and compared against showdown | FAIL | **PASS** | was (a); now measured — 5 diverge, all of them declared or below the reach shelf |
| no open, known engine defect | PASS | **PASS** | 112 verdicts read; **59 open rows assert breakage with NO instrument that decides them — that is state (c), DEBT not evidence**, and they do not hold the clause shut. 7 more name an instrument that WOULD NOT RUN, which is not agreement either |

**The three states, kept apart as asked.** Of the one remaining FAIL: **it is (a), an unmeasured
clause, not (b) a red instrument.** There is currently **no clause in state (b)**. State (c) — a
register row asserting breakage with no instrument — is 59 rows inside the last clause, unchanged by
this chain.

Gate verdict line, verbatim from the run:
`MEDICHAM is not correct — 1 of 8 gate clauses fail (whole-game differential / the same game on both engines)`

Provenance moved with the fresh artifacts: `187 unsafe, 2 void (declared), 36 possibly stale, 27 ok,
0 missing` (was 38 stale / 25 ok).

## What this does NOT change

**Leaf calibration — this division's one number — stays QUARANTINED and withheld, not annotated.**
The gate is still shut, so `data/winrate-backtest.json`, `data/leaf-engine-contrast.json`,
`data/click-censoring-census.json`, the R1–R4 rollouts and `data/policy-weights.json` are all still
downstream and still unquotable. The standing priority — pointing `backtest_winrate.js` at the
current leaf on a sample that can carry the claim and publishing the reliability curve — is gated on
the gate opening, and one command now stands between the two.

No fit, no refit, no restamp was run. Nothing was committed.

Files written by this chain: `data/verification/game-differential.empirical.json`,
`data/roster.items.json`, `data/roster.abilities.json`, `data/roster.moves.json`, `data/roster.json`,
the three `*.prev.json` sidecars the roster keeps automatically, and
`data/all-mechanics-fire.json`. `data/engine-release.json` and `data/provenance-stamp.json` were
already modified before this session began.

---

# OWED

Exact commands for everything not run. Nothing below was attempted.

**1. The clause that is still FAIL. This is the whole remainder of the job.** The published
coverage-arm artifact is what `wholeGameClause()` reads; the chain wrote the empirical arm to
`data/verification/` instead, so this was never touched:

```
cmd /c tools\lownode.cmd engine\game_differential.js --release 8ad06030e129 --arm middle --end-state --census data/verification/census-pin-9446a684709d.json --games 1200 --team-store data/team-pool-frozen --write
```

(no `--out`: it must land on `data/game-differential.json`. `--arm middle`, `--end-state` and the
census pin reproduce the shape of the artifact it replaces — pin digest `ccb365985023`,
`state_mode: true`, `end_state_mode: true`. Without them the run is not comparable with anything and
may not even carry the headline field.)

**2. The roster red demonstration, on this release.** All three stages were written with `reds: []`.
Roughly triples the wall clock; the file's header says it is not optional for an artifact that is
going to be trusted:

```
cmd /c tools\lownode.cmd tests\roster.js --stage items --reds --release 8ad06030e129 --write
cmd /c tools\lownode.cmd tests\roster.js --stage abilities --reds --release 8ad06030e129 --write
cmd /c tools\lownode.cmd tests\roster.js --stage moves --reds --release 8ad06030e129 --write
```

**3. `status.js --write`.** The `<!-- GENERATED -->` blocks in the five division ledgers still quote
the 5-of-8 gate and are one pass behind. Deliberately not run here so that the ledgers are not
stamped with a gate reading that changes again the moment command 1 lands:

```
node engine/status.js --write
```

**4. Decision impact.** `data/decision-impact.json` is absent, so the mechanics clause excuses
nothing on decision impact and every played divergence counts:

```
node engine/argmax_paired.js
```

**5. Not run and gated, not merely skipped.** `node engine/backtest_winrate.js`,
`node engine/leaf_engine_contrast.js`, `node engine/click_census.js` and the R1–R4 rollout
regenerators become re-runnable only when the gate opens — they are quarantined, not owed today.
`node engine/feature_fixture.js --stamp data/policy-weights.json` is **Will's call and is not to be
run**; it fuses the two independent staleness causes on the weights.
