# The eighty silent catches, read and sorted — 2026-08-23, MEASURE

Historical findings record. Not maintained, not current state, superseded by ROADMAP #258.
Instrument: `node tests/test-no-silent-failure.js`. **Read-only pass — nothing was edited, nothing
was committed, no game was played and the simulator was never loaded.**

## The headline

**Sixty-two of the eighty are correct as written. Eighteen are real.**

| | blocks |
|---|---|
| **REAL** — swallows a failure that can happen and lets a caller carry on | **18** |
| LOUD ALREADY — the failure is reported one or two lines down, which the gate cannot see | 38 |
| CANNOT FAIL — the guarded call provably does not throw here | 15 |
| CORRECT SILENCE — failure is the expected, handled outcome | 9 |
| | **80** |

The eighteen are **17 fixes** (`engine/feature_shift.js:119` and `:121` are two arms of one
`Math.max` and one edit).

**After they are fixed the gate reads 62 NEW and is still RED**, because it is green only at zero.
That is the decision this triage actually surfaces, and it is in §5.

## 1. The number, re-measured rather than relayed

```
files scanned 393   catch blocks 885   silent 276 (31%)
baselined 201       FIXED 5      NEW 80      of those MANUFACTURE 28, skip/continue 52     exit 1
```

Identical to the figure I was handed. Run twice, 30 minutes apart: the tree moved under me
(`catch blocks` 885 → 886, a live agent editing `engine/`) and **NEW held at 80 with the same 28/52
split both times.** So the number is not drifting while two agents work.

`data/silent-catch-baseline.json` is unchanged (stamped 2026-08-18, `accepted: {}` still empty).
`tests/test-no-silent-failure.js` was last written at 18:57 by the enforcement agent; my reading of
its logic is from that copy.

**Every one of the eighty was read in its source context** and classified. The classification was
cross-checked against the detector's own site list: 80 in, 80 out, no site missing and none invented.

## 2. The eighteen REAL ones, ranked by consequence

Ranked by *what does a caller do with the made-up value*, not by file. A swallowed error in an
instrument outranks one in a reporting script, per the brief — with one deliberate exception at
rank 1, explained under the table.

| # | file:line | what it swallows, and what proceeds on it | the one-line fix |
|---|---|---|---|
| 1 | `engine/gate_fail_and_silent.js:254` | An unreadable `data/engine-release.json` → `cur = null` → `curId = null` → the `MEASURED AGAINST A DIFFERENT ENGINE` clause **cannot fire**, and `const c = (art && !relWhy) ? count(art) : null` then **prints the count**. A number that must be WITHHELD gets published instead. | on a read failure set `relWhy = 'the current release id could not be read — WITHHELD'` |
| 2 | `engine/medicham2-browser.js:5581` | `require('./mc_key.js')` throwing → `MCK = null` → `monKey()` silently loses the cosmetic-forme fallback, so Vivillon-Pokeball, Maushold-Four and Sinistcha-Masterpiece stop building. **The only one of the eighty inside the play layer**, and it is `buildMon("Scizor") returned null` exactly. | `MEDFAILS.mcKeyModuleUnloadable = e.message` |
| 3 | `engine/feature_shift.js:119` **and** `:121` | `MEDI.weatherTurns` throwing → skipped inside a `Math.max`, so `AGE` collapses from ~8 turns to **1**. Boards are then "aged past the weather" with the weather still up, and the instrument reports NO feature shift while measuring nothing. `engine/board.js:870` already does this right (`weatherCounters.noEngine++`) — same call, one file over. | count the throws; refuse if `n === 0` |
| 4 | `engine/mega_census.js:95` | A torn store line is dropped and `games` is never incremented — the census denominator shrinks with no receipt. | `badLines++`, printed beside `games` |
| 5 | `tests/test-artifact-rerunnable.js:322` | An **unparseable** ratchet baseline reads as `/* first run */`, so the stranded-release ratchet silently stops ratcheting and can then be re-stamped over. Identical shape to the `test-unmodelled-clicks.js` block fixed earlier today. | ENOENT is a first run; any other error fails |
| 6 | `tests/test-effective-identity.js:462` | `poison(this.slot(...))` throwing → that slot is silently left un-poisoned, so today's identity gate passes vacuously **on that slot** while looking green. A trap that quietly fails to arm. | skip only when the slot is empty; otherwise fail by name |
| 7 | `engine/replay_differential.js:1314` | A throwing `rollsFor` increments none of `ROLLID.unique/ambiguous/none`, and those three are **published** (`roll_identification` in the artifact, and printed). The distribution loses its denominator. Its comment says "already counted by the verdict path" — the verdict path counts a different thing. | `ROLLID.threw = (ROLLID.threw \|\| 0) + 1` |
| 8 | `engine/fixture_preflight.js:1032` | A missing authority source is skipped; **only the all-empty case throws** (:1038). Load 5 of 8 and the reverse item scan reports "read by nobody" for every row whose reader lives in the 3 that did not load. | name the missing files — throw, or record them on the corpus |
| 9 | `tests/test-artifact-rerunnable.js:156` | An unparseable `data/*.json` drops out of the "which artifacts name a release" scan entirely, so a corrupt artifact escapes the stranding check. The file already has `prose` and `scratch` buckets. | add an `unreadable` bucket beside them |
| 10 | `tests/test-web-quarantine.js:144` | An unreadable downstream artifact is skipped from the leak probe set, so a leak of **that** artifact's verdict onto the web board is invisible. The existing guard only catches the case where the probe set is entirely empty. | collect the skipped files and print them |
| 11 | `engine/mega_sets_from_sheets.js:95` | Torn store line dropped uncounted; `stats` already carries five named counters. | `stats.unparsed++` |
| 12 | `tests/test-rollout-switch.js:172` | A **corrupt** `data/policy-weights.json` gives `nWeights = null`, and the assertion is `nWeights === null \|\| nFeat === nWeights` — so the features-vs-weights dimensionality check passes vacuously. Absent is genuinely not this file's business; unparseable is. | ENOENT skips; a parse error fails |
| 13 | `tests/test-artifact-rerunnable.js:278` | An unreadable release manifest is skipped and `audited` silently shrinks — the exact "audited ZERO manifests and printed a green tick" failure the comment eight lines above describes. | count and name the skipped ids |
| 14 | `engine/explain_divergence.js:72` | A pair whose game **throws** is skipped, so an engine crash never appears in the tool whose job is explaining divergences. A crash is the most interesting divergence there is. | count `threw` and print it in the header |
| 15 | `engine/tag_dex.js:8709` | A throwing tag predicate makes a dropped ability read as "would have carried nothing". The comment directly above says these two cases *"must not look alike"* — and here they do. Bounded: the loop covers only abilities with no legal carrier, so no engine behaviour rides on it. | name the throw in the printed list |
| 16 | `engine/engine_release.js:842` | An unreadable file in the release directory drops out of the `REL.require` compat census, so a release can read "can still serve this caller" on a scan that never saw the caller. The dir-scan failure nine lines up **is** reported (`error:`); the per-file one is not. | append to the same `error` field |
| 17 | `engine/fixture_legality.js:170` | An unreadable fixture file is skipped from the legality scan and therefore reads clean. | count and name it |

*(Seventeen rows, eighteen blocks: rank 3 is two arms of one `Math.max` and one edit.)*

**Why rank 1 is a reporting tool and still first.** The house rule is that a quarantined figure is
WITHHELD, not annotated, and this block is the single place in the eighty where a swallowed error
flips a withhold into a publish. Everything below it corrupts a measurement; this one publishes one.

**Ranks 16 and 17 are the weakest and are still listed**, because the precedent is the detector's
own header: a scanner that could not read a file *"may not report that file clean"* — it counts it,
names it and fails on it. Two one-line fixes to match a rule this repo already enforces on itself.

## 3. What I did NOT find, and it matters

**No catch among the eighty swallows an `mcKey` throw.** Checked directly rather than assumed: every
`mcKey(` call site in `engine/` and `tests/` was listed, and the two undeclared ones
(`engine/position_features.js:141`, guarded by `mcKey.has`; `tests/test-mega-timing.js:173`) are not
inside any of the eighty. `tests/test-forme-assert.js:113` wraps `buildMon`, and `buildMon` reaches
`mcKey` only through `monKey`, which passes `{mayMiss: …}` — a declared miss returns null and does
not throw. `MC.mons[key]` inside `buildMon` is only ever indexed with a key `monKey` already
resolved, so the sealed Proxy cannot fire there either.

**Today's seal is not being defeated by anything in this backlog.**

## 4. The previously-judged set — 28 re-read, 27 held, 1 re-filed

The brief asked for a sample of the manufacturing blocks. All 28 are one-liners, so I read all 28
rather than sampling.

| earlier call | held |
|---|---|
| LOUD CALLER (16) | **all held** |
| CANNOT FAIL / correct silence (11, plus the probe paths written since) | **all held but one** |
| | **`engine/tag_dex.js:8709` re-filed CANNOT FAIL → REAL (rank 15)** |

Verified individually rather than taken on trust: `orient.js` :105 :158 :192 :306 :329 all reach
`fail(...)` or print the sentinel verbatim; `roster.js:231` throws on the next line;
`roster.js:9305/:9323` print `(unreadable — its bytes are kept anyway)`;
`game_differential.js:2342` is `console.error` + `exit 2`; both `medicham2` receipts write
`MEDFAILS.*` with a worded `…Why`; `policy.js:81`'s caller prints the refusal; `staged_board.js:1007`
fails **strict**, not lax; `test-farm-ram-guard.js:67` is the assertion itself;
`test-forme-assert.js:113` was re-checked against the sealed `mcKey` (§3) and still holds.

`tag_dex.js:8709` had been filed as a `dex.*.get()` wrapper that cannot throw. It is not one — it
wraps `t.of(a)`, a source-parsing predicate. The consequence is small, which is why it sits at rank 15.

## 5. Two properties of the ratchet that change what "fix the 80" means

**(a) The key is a hash of the catch BODY, so identical trivial bodies collapse and the line the gate
names is arbitrary.** `fresh` is built as `list.slice(allowed)`, which reports the *later*
occurrences as new. Three cases in the current eighty:

| flagged as NEW | its identical, already-baselined siblings | allowed |
|---|---|---|
| `engine/tag_dex.js:8709` | **`:8623`** | 1 |
| `engine/medicham2-browser.js:5581, :6729, :10559` | `:2829`, `:3318` | 2 |
| `engine/champions_sim.js:587` | `:344` | 1 |

**This is a live laundering hazard.** `engine/tag_dex.js:8623` is the MAIN tag-derivation loop —
`catch (e) { v = null; }` around `t.of(o)` for every move, item and ability written into
`data/tags.json`, which is what the engine reads for every mechanic. It is **in the baselined floor
of 201 and on nobody's list**, and because it hashes identically to `:8709`, *fixing `:8709` alone
lowers the gate count and leaves `:8623` exactly as it is.*

Partial mitigation exists and was checked rather than assumed: `tag_dex.js:9003` fails if a tag loses
**every** carrier, so the total-loss case is caught. The partial case — one entity silently losing
one tag — is not. Out of scope for this brief: reported, not touched.

**(b) The gate is green only at zero NEW, and fixing cannot get there.** 80 − 18 = **62**, and those
62 are blocks that should not be changed. The only remaining door is `--accept`, whose unit is a
**FILE** while judgement is per **BLOCK**:

| file | real | correct as written | can it be accepted whole? |
|---|---|---|---|
| `engine/orient.js` | 0 | 5 | yes |
| `tests/test-lownode.js` | 0 | 4 | yes |
| `tests/test-artifact-rerunnable.js` | 3 | 0 | n/a — all three get fixed |
| `engine/tag_dex.js` | 1 | 3 | **no** |
| `tests/test-web-quarantine.js` | 1 | 3 | **no** |
| `engine/medicham2-browser.js` | 1 | 4 | **no** |
| `engine/feature_shift.js` | 2 | 0 | n/a |

`accepted` is still `{}`, ten days after the door was built. That is evidence the door is the wrong
shape, not that nobody tried.

**So the honest sentence: fixing every real one takes the number 80 → 62 and the gate stays red.**
Getting to green needs a decision about `--accept`, not more code.

## 6. The full sort — every one of the eighty

`M` marks the ones the gate classed as manufacturing a value. The REAL eighteen are in §2.

### LOUD ALREADY — 38 (leave)

| block | M | why |
|---|---|---|
| `engine/orient.js:105` | M | the manufactured string IS the report — printed as `age NO SUCH FILE` |
| `engine/orient.js:158` | M | `fail('THE DIVISIONS', …)` on the next line |
| `engine/orient.js:192` | M | `fail('THE INVALIDATION GRAPH', …)` two lines down |
| `engine/orient.js:306` | M | `if (!n) fail('WHAT A MEASUREMENT MUST PIN', …)` |
| `engine/orient.js:329` | M | `if (files === null) fail('IN FLIGHT', …)` |
| `tests/roster.js:231` | M | the next line throws a paragraph about the control click's crit ratio |
| `tests/roster.js:9305` | M | prints `(unreadable — its bytes are kept anyway)` |
| `tests/roster.js:9323` | M | prints `still holds stage "unreadable"` |
| `engine/game_differential.js:2342` | M | `console.error` + `process.exit(2)` on the next two lines |
| `engine/medicham2-browser.js:5198` | M | `MEDFAILS.residualUnplaced`, naming every unplaced step |
| `engine/medicham2-browser.js:5280` | M | `MEDFAILS.switchInPriorityTableMissing` plus a worded `…Why` carrying the regeneration command |
| `engine/policy.js:81` | M | the caller prints "tags.json unreadable, so the stalling family could not be DERIVED; not guessed" |
| `tests/probe_endstate_by_cause.js:118` | M | the else branch prints "NO ARTIFACT TO COMPARE AGAINST … the replay stands alone" |
| `tests/test-effective-identity.js:470` | M | prints `<source unavailable>` in place of the line |
| `tests/test-roadmap-register.js:179` | M | "skip … (not a pass: nothing was checked)" |
| `tests/test-state-differential.js:456` | M | `note('… the live half of PART 6 did not run. That is not a pass for it')` |
| `tests/test-web-quarantine.js:459` | M | prints `(mtime unreadable)` in place of the age |
| `tests/test-lownode.js:42` | | the body IS `bad(…)`. Noted: it discards `e.message`, so a missing `cmd.exe` would misreport as "a PASSING script was reported as failure" |
| `engine/medicham2-browser.js:6729` | | `_m == null` then `MEDFAILS.accModNoTagValue++` |
| `engine/medicham2-browser.js:10559` | | the next line THROWS "MOVE_EFFECTS not loaded" |
| `tests/test-policy-promote.js:50` | | the next lines FAIL and exit 1 |
| `tests/test-web-quarantine.js:296` | | the next line pushes `notRestored` with the reason |
| `tests/test-web-quarantine.js:398` | | `fail('web/status-data.js did not load — build it: node web/build-status.js')` |
| `engine/replay_differential.js:1918` | | the body IS `bump(EXCEPTIONS, 'store line did not parse')` |
| `tests/test-closet-scope.js:61` | | "SKIP … NOT a pass" and `bad++` |
| `tests/test-closet-scope.js:75` | | "FAIL data/all-mechanics-fire.json is absent — a claim that cannot be computed FAILS" |
| `engine/miltank.js:479` | | `console.error` naming the 60-turn fallback and the command that fixes it |
| `engine/policy.js:231` | | the body IS `refuse(…e.message…, 2)` — it reports the reason and exits 2 |
| `engine/tag_dex.js:5762` | | falls through to `note: 'the multiplier is UNKNOWN, not 1'` |
| `tests/bench-medicham.js:121` | | `if (!base)` prints "NO BASELINE STORED". Noted: with `--record`, a CORRUPT baseline also skips the busy-machine REFUSAL |
| `tests/probe_bracket_counters.js:59` | | `CAST.length < 8` gives "NOT RUN … a fixture failure, not a pass", exit 2, and the missing names are printed |
| `tests/probe_red_demo.js:2788` | | `if (!found.length) throw` — the demonstration retires rather than passing |
| `tests/test-board-clock-power.js:209` | | `if (!ROCK) note('no legal item extends this weather …')` |
| `tests/test-divergence-composition.js:128` | | "SKIP … cannot test the pin guard" and `bad++` |
| `tests/test-effect-kind.js:38` | | the refusal below prints "NOT RUN … This is not a pass" and exits 2 |
| `tests/test-publish-guard.js:167` | | `ok(false, 'the artifact carries no readable ' + v.key)` |
| `tests/test-residual-order-population.js:70` | | `ok(!!art, 'data/residual-order.json exists')` |
| `tests/test-tag-params-derived.js:232` | | `if (!checked) FAIL('no two-target turn could be staged — this is a claim about the fixture, not a pass')` |

### CANNOT FAIL — 15 (leave)

| block | M | why it cannot throw here |
|---|---|---|
| `engine/tag_dex.js:749` | M | wraps `dex.conditions.get()`, which returns a non-existent object rather than throwing; and the null it hands back is this file's declared refusal, not a guess |
| `engine/tag_dex.js:915` | M | same call; null is the declared "cap unknown" sentinel a consumer must be able to tell from "a cap of 1" |
| `engine/game_differential.js:457` | M | wraps `dex.species.get()` |
| `engine/switchin_order.js:77` | M | the file exits earlier without `SHOWDOWN_PATH`, and the artifact records null honestly rather than false |
| `tests/probe_volatile_leaves.js:86` | M | `dex.species.getLearnsetData()`; the format's learnset table is loaded when the dex is built |
| `tests/staged_board.js:1007` | M | an unreadable learnset baseline makes the check STRICTER — known pairs stop being forgiven, so it fails in the safe direction |
| `tests/test-farm-ram-guard.js:67` | M | the catch IS the assertion — `threw = true` is what `ok()` tests on the next line |
| `tests/test-forme-assert.js:113` | M | `buildMon` reaches `mcKey` only with `{mayMiss}`, so it returns null rather than throwing; `false` is then reported as UNCOVERABLE |
| `tests/test-switch-carry.js:83` | M | `dex.species.getLearnsetData()` |
| `engine/champions_sim.js:511` | | `dex.species.getLearnsetData()` |
| `engine/champions_sim.js:587` | | `dex.species.getLearnsetData()` |
| `tests/probe_lifeorb_toll.js:245` | | a torn line in the PINNED `team-pool-frozen` store, read by a printed probe with no published denominator |
| `tests/probe_volatile_leaves.js:80` | | `dex.species.getLearnsetData()` |
| `tests/test-multihit-damage-game.js:88` | | `dex.species.getLearnsetData()` |
| `tests/test-red-run-writes.js:298` | | `statSync` on a path `readdirSync` returned one line earlier; the sibling error paths at `:294` and `:300` are both handled properly |

### CORRECT SILENCE — 9 (leave)

| block | M | why silence is the right answer |
|---|---|---|
| `tests/probe_phaze_empty_bench.js:194` | M | falls back to the RAW diff, which is then printed — a less readable answer, not an absent one |
| `tests/test-lownode.js:72` | | a polling loop that expects to miss the window, and `if (!seen) bad('the arm proves nothing, treat as red')` closes it |
| `tests/test-lownode.js:74` | | child cleanup, after the measurement is taken |
| `tests/test-lownode.js:80` | | child cleanup, after the measurement is taken |
| `tests/test-policy-promote.js:251` | | temp-directory teardown |
| `tests/test-policy-promote.js:296` | | temp-directory teardown |
| `engine/speed_vs_pokeenv.js:235` | | a failing `git status` outside a checkout suppresses an advisory NOTE only; documented in the body |
| `tests/test-coverage-stop.js:133` | | unlinking a scratch artifact — "leaving it is harmless", and it is |
| `tests/test-unmodelled-clicks.js:56` | | deliberate and documented; the real assertion is the `MEDFAILS.unmodelledClick` counter below |

## 7. The counts, plainly

- **18 REAL blocks = 17 fixes.**
- **62 correct as written.** 38 loud already, 15 cannot fail, 9 correct silence.
- **After fixing: 62 NEW, gate still RED.** Green needs an `--accept` decision, not more code.
- **Out of scope but reported: `engine/tag_dex.js:8623`**, sitting in the baselined floor, is the
  highest-consequence block of this shape in the repository and shares a hash key with `:8709`.

**Most of the eighty are correct as written.** Changing them would be churn in error paths, which is
how a working run breaks.

## 8. OWED, NOT RUN

| owed | why not |
|---|---|
| the 17 fixes | read-only pass by brief; two agents are live in `engine/` and `tests/` |
| `node tests/test-no-silent-failure.js` after the fixes | expected 80 → 62, still exit 1 |
| a `tag_dex.js:8623` decision — fix it, or `--accept` it with the reason | it is in the floor, not in the eighty; it needs a roadmap row, and MEASURE may not edit `docs/ROADMAP.md` |
| `--accept` granularity, FILE vs BLOCK | Will's call, unchanged from the 2026-08-23 source report; three files cannot be accepted whole (§5b) |
| `node tests/test-no-silent-failure.js --update` | **deliberately not run.** It would lower the floor 201 → 197 on the strength of a detector change |
| `node engine/status.js --write` | not run — the enforcement agent holds `tests/test-no-silent-failure.js` and the board agent holds `docs/ENGINE.md`; restamping now would race them |
| `node tests/run-all.js` | not run — nothing was changed, so its verdict cannot have moved |
