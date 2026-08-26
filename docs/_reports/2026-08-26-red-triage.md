# The 29 reds, triaged — MEASURE, 2026-08-26

**The count was the problem.** `tests/run-all.js` has been reported as "29 red" for a day and nobody
had said what any of them were. This turns the count into a list with a disposition each.

Session was under a NO-PLAY, NO-WRITE clause: an ENGINE agent holds `engine/game_differential.js`
and is running the differential. Nothing here played a game, nothing wrote into `engine/`, `tests/`,
`data/` or `docs/ROADMAP.md`, and no git command was run. Verified at the end with `git status`:
the only modified paths are the ENGINE agent's.

---

## 0. WHERE THE RED LIST CAME FROM, AND WHAT IT IS WORTH

**The suite was not re-run.** The list is read out of the completed run an ENGINE agent left in the
shared session scratchpad:

```
<scratchpad>/runall-final.txt    2026-08-25 21:57   164 checks discovered (144 tests/, 20 gates)
                                                    135 passed, 29 failed, 0 skipped
```

Three corroborations, because a single log is a single log:

- The **22:26 partial run** in the repo at `.scratch_eng/suite.txt` (the ENGINE agent's, abandoned
  after 62 of 164 checks) reports the **same 7 reds** in the alphabetical range it covers —
  `test-assert-mode`, `test-board-browser`, `test-engine-diff` (exit 3), `test-fixture-legality`,
  `test-forced-switch`, `test-fragility`, `test-mc-key` — with the same exit codes. That is
  corroboration for the first 62 and **not** proof for the remaining 22.
- `docs/_reports/2026-08-25-trap-timing-fix.md` records every one of the 29 re-run at HEAD sources,
  one at a time, and the per-check outputs are in the scratchpad as `base-*.txt` / `base2-*.txt` /
  `f-*.txt`. Those are what the mechanisms below are read from — the suite's own tails are
  truncated to 14 lines and hide the failing assertion on several checks.
- Two ENGINE agents separately report the red SET unchanged across today's four landings.

**Two honesty notes on the sample.**

1. **There is a THIRTIETH failure and the count does not include it.** The coverage assertion is
   red — *"FAIL — UNACCOUNTED-FOR CHECK. 11 file(s) report a pass/fail verdict but are neither a
   listed gate, nor discovered in tests/, nor named in NOT_A_CHECK / PENDING_WIRE"*. It is inside
   the runner's exit expression (`process.exit(fail.length || coverageFailures ? 1 : 0)`) but it is
   not part of "29 failed", so a summary that quotes the failure count alone silently drops it.
   The eleven: `engine/move_result_state.js`, `engine/orient.js`, `engine/preflight.js`,
   `tests/probe_ability_volatile_line.js`, `probe_announce_failure.js`, `probe_mental_herb_order.js`,
   `probe_phaze_empty_bench.js`, `probe_poltergeist_item_line.js`, `probe_punish_announce.js`,
   `probe_regenerator_line.js`, `probe_volatile_start_field.js`.
2. **One of the 29 I could not resolve and did not guess.** `engine/validate_selfplay.js` reads
   *16 passed, 1 failed, 1 inconclusive*; the failing assertion is above the 14-line tail in every
   committed log, and re-running it plays 300 battles. It is UNDETERMINED and it is in OWED below.

---

## 1. THE TABLE

Category key: **1 REAL DEFECT** · **2 STALE / NOT RE-CERTIFIED** · **3 PENDING-WIRE or RED BY
DESIGN** · **4 THE CHECK ITSELF IS BROKEN**.

| # | Check | Cat | Mechanism, in plain words | Owns | What clears it |
|---|---|---|---|---|---|
| 1 | `engine/validate_damage.js` | **4** | The damage golden master is red on 3 of 36 rows and **all three stage things this regulation does not have**: two rows hold **Choice Band** and **Choice Specs** (`isNonstandard: 'Past'` — banned since the 2026-08-04 list correction), and one gives **Charizard Tinted Lens**, an ability with **zero legal carriers** in Reg M-B. MEDICHAM is right on all three; `@smogon/calc` is mainline and applies them. | ENGINE (fixture) | Delete or re-aim the three illegal rows in the `S` table (`engine/validate_damage.js` ~lines 56–77). Then 36/36 and the gate means something again. |
| 2 | `tests/test-rollout-effects.js` | **4** (6 of 7 arms) | Same disease, bigger. It asserts **nine moves that are `isNonstandard: 'Past'`** — Dark Void, Lovely Kiss, Grass Whistle, Poison Gas, Vital Throw, Revenge, Teleport, Headbutt, Astonish — and calls the engine's `undefined` a failure. It demands **Iron Head 30% flinch when the Champions format says 20** (`D.moves.get('ironhead').secondary.chance === 20`), so the engine agrees with the format and the test does not. And **Full Metal Body and Guard Dog each have zero legal carriers**. | ENGINE (fixture) | Derive the move/ability list from `Dex.forFormat` with the legal filter instead of typing it, as `tests/test-engine-diff.js` already does. |
| 3 | `tests/test-fragility.js` | **4** | Two assertions stage **Storm Drain**, which has **zero legal carriers** in Reg M-B. Lightning Rod (5 carriers) is the legal analogue; every other arm in the file uses real things and passes. | ENGINE (fixture) | Re-aim both assertions at a redirect ability that exists here. |
| 4 | `tests/test-wiring.js` | **4** | The suite sets `ABRA_STRICT_SEMANTICS=1`, which turns the standing REFIT-OWED warning into a throw. `test-wiring` spawns `engine/mew.js` with `env: process.env`, mew dies at `loadWeights`, and **`runCapture` never looks at `r.status`** — it returns the stack as if it were the run report. Every counter is absent, so the file prints ***"10 capabilities are NOT WIRED"***. The check written to catch "a capability that cannot prove it ran" cannot tell a dead run from a missing capability. | ENGINE / MEASURE | One line: fail loudly on `r.status !== 0` instead of parsing the corpse. Then the refit (below) clears the rest. |
| 5 | `tests/test-engine-diff.js` (exit 3) | **4** | Every clause inside it reads **zero disagreements**. It exits 3 because `publish_guard.withhold()` correctly **refuses to republish at a smaller sample**: the suite runs it at its default **150** matchups and `data/engine-diff.json` holds **6000**. It can never be green as the runner has it wired. | ENGINE | Give it a runner argument — either `--n 6000` (minutes) or a "verify, do not publish" mode. The guard is right; the question the runner asks is wrong. |
| 6 | `tests/test-forced-switch.js` | **3** | Red *only* under the suite. Green standalone. The throw is `magnemite.js:101 checkSemantics` → REFIT OWED. | MEASURE | The refit. Gated behind MEDICHAM, not behind compute. |
| 7 | `tests/test-team-preview-race.js` | **3** | Identical cause, reached through `showdown_bot.js` → `ScoringPlayerAI`. | MEASURE | The refit. |
| 8 | `engine/artifact_audit.js` | **1** | **`data/abra-tags.js` is not what `build/build_tags_js.js` would write from `data/tags.json`** — *"the browser engine and the node engine are reading different rulebooks."* Both files carry the **same** `generated` stamp (`2026-08-25T03:37:49.224Z`), so every mtime and stamp heuristic reads them as in sync. | ENGINE | `node build/build_tags_js.js`, then re-run the audit. |
| 9 | `tests/test-board-browser.js` | **1** | 55 of 58 board features agree node-vs-browser to 6 dp; **3 NEW disagreements** — `tgtMayProtect` (worst gap 0.076), `koTarget` (0.052), `stallIntoEncore` (0.007). Plausibly the same root as #8 (a browser bundle behind its node source) — `data/board-data.js` has a builder and **no `--check`**, so nothing compares it. Hypothesis, not a claim. | ENGINE | Rebuild `data/board-data.js` and re-measure; if the gaps survive, it is a real feature divergence. |
| 10 | `tests/test-mutation-coverage.js` | **1** | **The planted-stub gate catches 0 of 2.** Both plants (`item:choicescarf:speedMult.mult:=11.5`, `move:rockslide:spreadFoes:REMOVE-TAG`) read LIVE with the stub in AND with it out. Every one of 1,563 operator verdicts (565 LIVE / 998 READ-AND-IGNORED) rests on an instrument that cannot show it detects a plant. A dead safety net looks exactly like a working one. | ENGINE | Make the plant reach the mutated table; the gate is the only thing that licenses the sweep's numbers. |
| 11 | `engine/em_validation.js --check` | **1** | *"the amplified regime's censoring bias did not exceed its own noise floor."* The estimator's own **positive control** fails — the amplified arm, built to be detectable, is not distinguishable from the floor. LESSONS §9 working correctly and saying no. | MEASURE | Re-run the Stage C measurement, or withdraw the click-censoring verdict until the amplified control clears. |
| 12 | `tests/test-assert-mode.js` | **1** | **The only live two-engine board disagreement in the 29.** Two staged rows where an ally has Levitate against a spread Ground move: `levitate-refuses-bulldoze` Clefable HP **us 119 / showdown 115**, `levitate-refuses-earthquake` **us 86 / showdown 73**, both turn 2, both `off-by-4-or-more` on `active[].hp` and `party.hp`. HP is a board leaf, so this is board-material by construction. A third row (`goodasgold-refuses-cottonspore`) is **HOLLOW** — it agrees with the mechanism DELETED, so it is evidence of nothing. | ENGINE | Fix the spread-Ground damage number; separately, re-aim the hollow row so it can fail. |
| 13 | `tests/test-mc-key.js` | **1** | **`engine/immunity_sweep.js:184,377` reaches a mon table without going through `mcKey`.** One file, two sites. This is the `buildMon("Scizor") -> null` class — a hand-rolled species lookup beside the one door. | ENGINE | Route both through `mcKey`, or add the file to the named holders with a written reason. |
| 14 | `tests/test-pin-arms.js` | **1** | Two instrument defects. **The tie pin has leaked into the range form of the die** — `random(2,5)`, which is the SLEEP DURATION, reads `(4, 2, 2)` across the three arms instead of one value. And in the `middle` arm **a move at accuracy 1,2,3,4,5 does not hit**. The file's own line: *"the INSTRUMENT is wrong, which is the only thing this file fails on."* | ENGINE | Separate the tie pin from the range form; re-derive the middle arm's accuracy boundary. |
| 15 | `tests/test-prng.js` | **1** | Three files still multiply their state by **1103515245 in float arithmetic** — the overflowing LCG that gave mean 0.4954 and 16,403 distinct values in 200,000. `tests/bench-medicham.js`, `tests/test-mechanics.js`, `tests/test-protocol-trace.js`. | ENGINE | Replace the three with the fixed generator. Note **`test-mechanics.js` is a live gate**, so its randomness is currently short-period. |
| 16 | `tests/test-tag-consumed.js` | **1** | Two tags are DEAD outside the ratchet floor: **`immunityGate` [ARRIVED]** — a tag that landed and nothing consumes — and **`punishesMinimize` [STILL DEAD]**. The check correctly refused to rewrite its own baseline on a failing run. | ENGINE | Wire a consumer for each, or `--accept` deliberately with a reason. |
| 17 | `tests/test-pinch-family.js` | **1** | The **positive control** expects all five 0-use ungated members and finds **one** (`firemane`). Either four members got gated or the control is stale — a positive control that shrank is the thing you check before believing any green beside it. 1 of 61. | ENGINE | Establish which of the two it is before touching either. |
| 18 | `tests/test-fixture-legality.js` | **1** + broken clause | Three real things and one broken one. **REAL:** one NEW illegal fixture — *Milotic can't learn Calm Mind*, staged at `tests/probe_mental_herb_order.js:105`. **REAL:** 7 verdicts and 8 declarations in the baseline are no longer produced and must be removed so the next illegal set cannot hide under a stale allowance. **BROKEN:** the literal scanner reports *"5 string literals inside a set declaration name nothing in this format"* and all five are **English prose out of `console.log` lines** — `"the mega fired on BOTH engines"`, `"showdown="`, `" refused="`, `"and medicham2 wrote exactly as many"`, `"  "` — at `tests/test-imposter-transform-line.js:203` and `tests/test-precharge-order.js:279,290`. | ENGINE | Fix the Milotic set; prune the 8 stale allowances; narrow the literal scanner to strings in move/item/ability position. |
| 19 | `engine/selftest.js` | **1** | The GARBODOR rule. **10 files read the ladder store with neither a clean filter nor a `RAW-STORE-OK` declaration**: `click_counts.js`, **`medicham2-browser.js`**, `mega_census.js`, `mega_sets_from_sheets.js`, `replay_differential.js`, `rollout_switch_census.js`, `sheet_usage.js`, `tests/test-parse.js`, `tests/test-side-guard-chooser.js`, `tests/test-workflow-paths.js`. It is a MISSING DECLARATION, not a corrupt read. | MEASURE | Each file declares why, or filters. It was 9 on 2026-08-12 and is 10 now — it is growing. |
| 20 | `engine/conformance.js --strict` | **1** | Four S13 regressions: `data/published-samples.json`, `data/replay-differential-freezes.json`, `data/whole-game-baseline.json` are *generated but do not say so*, and `data/scenarios-from-will.json` has *no generator that writes it*. The baseline is not rewritten while anything is a regression, so the discoveries beside them are also held. | MEASURE | Give each a generator declaration, or fix the standard and say so. |
| 21 | `engine/provenance.js --strict` | **1** | Artifacts UNSAFE TO QUOTE. The named one: **`exploitability-holdout.json` — nothing in this repository can be shown to generate it**; it matches `engine/exploit.js`'s output pattern and was revoked on shape because its keys disagree with `exploitability.json`. | MEASURE | Regenerate or withdraw. Do not quote it meanwhile. |
| 22 | `tests/test-quality.js` | **1** | **The recorded corpus stamp is stale.** Clean share is **27.5% now against 17.3% recorded**, drift 10.3 points on a tolerance of 3, because the store grew **20,688 → 65,287**. LESSONS §10 exactly: the recorded funnel describes a corpus that no longer exists. | MEASURE | Regenerate the recorded funnel provenance. Anything that quotes the 17.3% share is quoting a dead corpus. |
| 23 | `engine/sanity_check.py` | **1** | **1 of 65,287 stored games has a `winner` that matches neither player.** Named: `gen9championsvgc2026regmb-2662690089`, winner `blackred123永雏<mojibake>菲侠` against p1 `blackred123永雏塔菲侠`. The name is intact in the player field and **corrupted in the winner field only** — an ingest encoding defect on one path, not a bad game. | OPS | Decode the winner line with the same encoding as the player lines; the one record then re-derives. |
| 24 | `tests/test-model-map.js` | **1** | One ledger heading, **`THE PER-TURN PIPELINE`** in `docs/MODELS.md`, has no box on `web/models.html` and no declared reason. 32 ledger models, 19 on the map, 12 declared out. The file also REPORTS (does not fail on) that **ALAKAZAM has no heading of its own in `docs/MODELS.md`** — a real ledger gap. | MEASURE + WEB | Add the box, or declare the omission with the reason it does not belong on a decision-flow map. |
| 25 | `tests/test-site-sync.js` | **1** | `web/` and `app/` copies have diverged for **stadium.html (207,007 vs 177,312 bytes)**, **status.html (76,026 vs 63,989)** and **tower.html (43,444 vs 42,685)**. Four other pairs are byte-identical. Visitors and local readers are on different pages. | WEB | Re-sync the three. |
| 26 | `tests/test-web-status.js` | **1** | 12 failures. The status board describes values that had already moved when it was built — `data/live.js`, `engine/board.js`, `engine/medicham2-browser.js`, `engine/quarantine.js`. One of the 12 is discounted correctly by the runner's `ABRA_SUITE_STARTED_AT` (the suite itself rewrote `data/mechanics-census.json`). | WEB | `node web/build-status.js` after the tree settles, then re-measure. |
| 27 | `tests/test-site-data-fresh.js` | **1** | **12 regenerable bundles the site serves are older than the newest game data**, most at 19.2 days — `abra-meta.js`, `guru.js`, `mag.js`, `mew.js`, `roles.js`, `scoreboard.js`, `slowking-playstyle.js`, `status.js` and four more. Three of those need a REFIT, not a rebuild (`nmf.js`, `pory.js`, `xatu.js`). | WEB + OPS | Run each named builder. The three fits are separate and the check says so. |
| 28 | `tests/test-workflow-paths.js` | **4** + **1** | Two arms, one of each. **BROKEN:** *"no `git add` path was found in any workflow — this test asserted nothing, which is worse than failing"* — the staging moved out of the workflow files and the check has nothing to check. **REAL:** the tracked `.gz` copies of `games.ladder.jsonl` and `games.bo3.jsonl` are **older than the stores**, so origin carries an out-of-date corpus while every local run reads a newer one. | OPS | Re-aim the staging clause at wherever staging lives now; `node build/compress-stores.js`. |
| 29 | `engine/validate_selfplay.js` | **UNDETERMINED** | *16 passed, 1 failed, 1 inconclusive.* Which assertion failed is above the 14-line tail in every committed log and the file plays 300 battles, so it was not re-run here. **Not guessed.** The three visible rate assertions (mega 98.1% vs ladder 98.3%, immune 2.21%, failed 5.68%) all pass. | OPS / MEASURE | See OWED. |

---

## 2. THE THREE SPECIFICS I WAS ASKED TO VERIFY — ALL THREE CONFIRMED, AND **NONE OF THEM IS ONE OF THE 29**

All three are `PENDING_WIRE` entries. They are reds on the board and they are not in the failure
count, which is worth saying plainly: **the count of 29 understates the red board by three named
checks plus the coverage assertion.**

**`tests/probe_red_demo.js` — CONFIRMED, and the structural cause is real.**
`grep -c "ABRA-EXIT" tests/probe_red_demo.js` returns **0**. The file has exactly one exit,
`process.exit(1)` at line 4576, and it is reached by a genuinely failed demonstration **and** by a
stale reversal whose patch text no longer matches the engine (the file counts those in its own
`stale` array at lines 117–149 and 1121). `classifyExit` in `engine/register_reality.js:254` reads
an undeclared exit 1 as `VERDICT-RED`, so a wire that was never demonstrated is recorded as a wire
that failed. **Owner: ENGINE** — it is the wires' probe and the declaration is one line
(`ABRA-EXIT 2 CANNOT-ANSWER` on the stale path). **The consequence is MEASURE's**: those verdicts
land in `data/register-reality.json`, which is the only evidence `quarantine.js`'s
`openDefectClause` has.

**`tests/staged_status_counters.js` — CONFIRMED STRANDED, withhold rather than resurrect.**
Its BEFORE arm is release `6155acc0fb26`, cut **2026-08-12T19:54:49Z** for *"spreadL50 exported"*.
Read directly: **`provides` is an empty object — 0 keys.** The release predates the `provides`
recorder entirely, so `engine_release.js compat` cannot certify it for any caller and the snapshot
throws `M.midEventDice is not a function` on all 11 scenarios. All eleven then read *"release THREW
/ live IDENTICAL ⇒ FIXED"* while the file's own controls print *"SO THE RED ABOVE IS NOT EVIDENCE"*.
LESSONS §12: re-pin to a release `compat` says can serve it and re-measure. Do not read the eleven
FIXED verdicts in either direction.

**`engine/feature_fixture.js` — CONFIRMED red by design, and the distinction matters.**
Reproduced without playing anything:

```
$ ABRA_STRICT_SEMANTICS=1 node -e "require('./engine/magnemite.js').loadWeights()"
THREW: FEATURE SEMANTICS — policy-weights.json
  the fixture itself changed (rounding 6 -> 6, scenarios 10 -> 12). Old hashes cannot be compared…
  the DAMAGE TABLE these weights were fitted against has been regenerated
  (318 species -> 322, digest 405c836793d1 -> 1bda9df11d73).
```

**The damage table moved. That is a REFIT, not a restamp, and there is no version where the
shortcut is fine.** A restamp answers the fixture clause and *silences* the table clause, writing
over the evidence. Wiring this gate today ships a red; it is correctly held.

*(Recorded in passing, already known and deliberately left: this same fixture gives Venusaur a
**Rocky Helmet**, banned in this format since 2026-08-04. Changing a fixture body moves every
stored hash, so it is left alone — but it belongs in the class below.)*

---

## 3. THE CLASS THAT CAN BE DRIVEN TO THE BOTTOM

Ranked by what closes, not by count.

**THE CHECK NAMES AN ENTITY OR A VALUE THIS REGULATION DOES NOT HAVE. Three whole checks, one fix
pattern.** `engine/validate_damage.js`, `tests/test-rollout-effects.js`, `tests/test-fragility.js`
— plus `engine/feature_fixture.js` adjacent. Every one of them fails because a fixture was TYPED
instead of DERIVED, and in every case **the engine is right and the test is wrong**:

| what the check demands | what `Dex.forFormat('gen9championsvgc2026regmb')` says |
|---|---|
| Choice Band, Choice Specs | `isNonstandard: "Past"` — banned |
| Tinted Lens on Charizard | **0 legal carriers in the whole regulation** |
| Storm Drain | **0 legal carriers** (Lightning Rod has 5) |
| Full Metal Body, Guard Dog | **0 legal carriers each** |
| Dark Void, Lovely Kiss, Grass Whistle, Poison Gas, Vital Throw, Revenge, Teleport, Headbutt, Astonish | all `isNonstandard: "Past"` |
| Iron Head flinch 30% | **20%** — `secondary.chance === 20` |

The pattern that fixes all of them already exists in this repository: `tests/test-engine-diff.js`
derives its accuracy table from the format and prints
*`ability:victorystar … ENGINE: OFF — ZERO legal carriers in Reg M-B`* and
*`item:laxincense … [isNonstandard: Past — banned in this format]`* instead of failing on them.

**And the ratchet that was built for this does not cover it.** `tests/test-fixture-legality.js`
validates **`set` declarations** — a body with an item and moves. It does not see an ability string
handed to `dmgRange`, or a move id asserted against a table. That is a named coverage hole, not a
bug in that file.

---

## 4. WHICH OF THESE IS HIDING A REAL DEFECT RIGHT NOW

**1. `engine/validate_damage.js` — and it is the one I would fix first.**
It is the golden master against `@smogon/calc` on **the number every rollout, every leaf and every
board depends on**. `tests/run-all.js`'s own header calls it *"the guard on the number every other
result depends on"* and records that it caught a neutered Sword of Ruin by mutation while the full
suite stayed green. It currently reads **within-5%: 92% (needs ≥95), worst 50% (needs ≤8)** — and
all of that shortfall is three rows that cannot occur in this format. **A permanently-red golden
master certifies nothing.** A real damage regression landing tomorrow arrives on a board that is
already red, at a number already 3 points under the bar, and is indistinguishable from the illegal
rows. Three lines in one file, and the most load-bearing check in the repository starts working
again.

**2. `tests/test-mutation-coverage.js` — the planted-stub gate catches 0 of 2.**
The file's own words: *"the harness must catch a PLANTED STUB before any green from it is
believed."* It does not. So 1,563 operator verdicts — including the 148-row class-A ceiling that is
ratcheted and the *"0 regressions"* line beside it — rest on an instrument that cannot demonstrate
it detects a plant. This is the `freshBodies`/`_switchKey` shape again: a dead safety net looks
exactly like a working one, and this one is dead **while reporting its own green rows**.

**3. `engine/artifact_audit.js` — two engines, two rulebooks, one timestamp.**
`data/abra-tags.js` is not what its builder writes from `data/tags.json`, and **both files carry the
identical `generated` stamp**, so nothing that compares stamps or mtimes can see it. The browser
engine and the node engine are reading different tags right now. One command tests it.

**4. `tests/test-assert-mode.js` — the only live board disagreement among the 29.**
Clefable's HP after a spread Ground move, off by 4 and by 13, on two rows where the ally carries
Levitate. It writes to `active[].hp` and `party.hp`, so it is board-material by construction rather
than by argument. Worth noting the same file flags a **HOLLOW** row that passes with its mechanism
deleted — the instrument is honest about itself, which is why its red is worth reading.

**5. The refit cluster — three checks, one cause, and it is MEASURE's.**
`test-forced-switch`, `test-team-preview-race` and `test-wiring` are all the standing REFIT OWED
becoming a throw under the suite's `ABRA_STRICT_SEMANTICS=1`. Two of the three are honestly red by
design. The third, `test-wiring`, is **not** — it reports *"10 capabilities are NOT WIRED"* on a
process that died before it printed a line, and that sentence is the loudest false alarm on the
board. The refit is gated behind MEDICHAM and is not fixable today. **The `r.status` check in
`test-wiring` is fixable today and should be**, because the one check written to catch a capability
that cannot prove it ran currently cannot prove its own run happened.

**What is NOT hiding a defect, said so nobody re-investigates it:** `tests/test-engine-diff.js`'s
exit 3 is a correct refusal by `publish_guard` at a 150-game sample against a published 6000 — every
clause inside it is at zero disagreements. It is a runner-wiring defect and nothing more.

---

## 5. THE TALLY

Of the **29**:

- **20 are real defects** — 11 in ENGINE, 6 in MEASURE, 3 in WEB/OPS.
- **6 are the check itself being broken** — `validate_damage`, `test-rollout-effects`,
  `test-fragility`, `test-wiring`, `test-engine-diff`, and one of `test-workflow-paths`' two arms.
- **2 are correctly red by design** — the two that are the standing REFIT OWED.
- **1 is undetermined** — `validate_selfplay`, not guessed at.
- **0 are stale baselines.** The stale-baseline red on this tree is `staged_status_counters`, and it
  is a `PENDING_WIRE` entry rather than one of the 29.

Plus, outside the count: **the coverage assertion (11 unaccounted-for checks)**,
`tests/probe_red_demo.js`, `tests/staged_status_counters.js` and `tests/staged_board.js`.

**Not one of the 29 is a "known failure", and none of them should be reported as a number again.**

---

## OWED, NOT RUN

```bash
# 1. THE ONE UNDETERMINED RED. Plays 300 battles — needs a settled tree and nobody else measuring.
SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/validate_selfplay.js

# 2. CONFIRM THE RED SET ON A SETTLED TREE. The list above is read from a 21:57 log plus a
#    62-check partial; the last 22 are corroborated by report, not by a run I made.
tools\lownode.cmd tests\run-all.js

# 3. THE ILLEGAL-FIXTURE CLASS — derive, then re-run each. Read-only verification first:
SHOWDOWN_PATH=/path/to/pokemon-showdown node -e "
const {Dex}=require(process.env.SHOWDOWN_PATH+'/dist/sim');
const D=Dex.forFormat('gen9championsvgc2026regmb');
const legal=x=>x.exists&&!x.isNonstandard&&x.tier!=='Illegal';
for(const ab of ['tintedlens','stormdrain','fullmetalbody','guarddog'])
  console.log(ab, D.species.all().filter(legal).filter(s=>Object.values(s.abilities||{}).some(a=>D.abilities.get(a).id===ab)).length);
for(const it of ['choiceband','choicespecs']) console.log(it, D.items.get(it).isNonstandard);
console.log('ironhead flinch', D.moves.get('ironhead').secondary.chance);
"
SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/validate_damage.js
SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/test-rollout-effects.js
SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/test-fragility.js

# 4. THE TWO-RULEBOOK DEFECT. One command, then re-audit. ENGINE's call, not run here.
node build/build_tags_js.js
node engine/artifact_audit.js
node tests/test-board-browser.js

# 5. THE DEAD POSITIVE CONTROLS.
SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/mutation_harness.js   # WRITES data/mutation-coverage.json
node engine/em_validation.js --check

# 6. THE STRANDED BEFORE ARM — find a release that can still serve it, then re-pin. Never resurrect.
node engine/engine_release.js compat tests/staged_status_counters.js midEventDice
node engine/engine_release.js list

# 7. MEASURE'S OWN HOUSEKEEPING, in the order the gates read.
node engine/provenance.js --strict
node engine/conformance.js --strict
node tests/test-quality.js          # regenerate the recorded funnel: the store went 20,688 -> 65,287

# 8. THE THIRTIETH FAILURE — the coverage assertion. Runs no child.
node tests/run-all.js --coverage

# 9. NOT RUN AND NOT TO BE RUN BY MEASURE: anything that writes into data/ or plays a game while
#    the ENGINE agent holds engine/game_differential.js.
```
