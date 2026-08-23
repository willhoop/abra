# The eighteen real silent catches, fixed — 2026-08-23, ENGINE

Historical findings record. Not maintained, not current state, superseded by the register row proposed
in §6. Instrument: `node tests/test-no-silent-failure.js`.

Input: [`docs/_reports/2026-08-23-eighty-silent-catches-triage.md`](2026-08-23-eighty-silent-catches-triage.md)
(MEASURE, read-only). Every fix was re-derived at the line rather than applied from the table.

## 1. The number

| | before | after |
|---|---|---|
| NEW since the baseline | **80** | **62** |
| of those, MANUFACTURE a value | 28 | 27 |
| of those, skip / continue only | 52 | 35 |
| FIXED since the baseline | 5 | 6 |
| baselined floor | 201 | 201 (untouched — no `--update`, no `--accept`) |

**62 was the projection and 62 is what landed.** The gate is green only at zero, so it is **still RED
and that is correct**: the remaining 62 are blocks the triage read and found correct as written.

It did not go 80 → 62 in one step. The first pass landed on **64** with MANUFACTURE going **up** by one
(28 → 29), which is §3.

## 2. What was changed — nineteen blocks, seventeen edits

Ranked as the triage ranked them.

| # | file | what it does now |
|---|---|---|
| 1 | `engine/gate_fail_and_silent.js` | an unreadable (or id-less) `data/engine-release.json` sets `relWhy`, so the count is **WITHHELD** instead of published. Demonstrated: with the file moved aside the gate printed `CANNOT ANSWER … THE CURRENT RELEASE ID COULD NOT BE READ` and exit 2; with it back, `LIVE 2 causes` and exit 1 exactly as before. |
| 2 | `engine/medicham2-browser.js` | a failed `require('./mc_key.js')` writes `MEDFAILS.mcKeyModuleUnloadable`. Declared in the MEDFAILS literal with its reason. Demonstrated by intercepting that one require: the counter carries the message and `buildMon('Vivillon-Pokeball')` goes null — which is now readable rather than silent. |
| 3 | `engine/feature_shift.js` (two arms, one edit) | the `weatherTurns` throws are counted. `n === 0` **refuses** with a worded error; a partial loss prints that the horizon is a lower bound. Demonstrated: with `weatherTurns` stubbed to throw, the file refuses instead of ageing boards by 1 turn. Healthy run measured — 745 calls, 0 throws, horizon 9. |
| 4 | `engine/mega_census.js` | `badLines` counted, carried in the artifact as `store_lines_that_did_not_parse`, printed when non-zero. |
| 5 | `tests/test-artifact-rerunnable.js:322` | ENOENT is a first run; any other error is named, fails by name, **and refuses `--stamp`** so a corrupt floor cannot be written over unread. |
| 6 | `tests/test-effective-identity.js` | an empty slot was already handled by `slot()` returning null, so a throw meant the read-trap FAILED TO ARM. It now refuses by name rather than leaving that slot green and unwatched. |
| 7 | `engine/replay_differential.js` | `ROLLID.threw` + `threwFirst`, printed beside unique/ambiguous/none so the published distribution keeps its denominator. |
| 8 | `engine/fixture_preflight.js` | a PARTIAL authority-source load now refuses and names the missing files. Only the all-empty case did before. Measured: all 15 sources present today. |
| 9 | `tests/test-artifact-rerunnable.js:156` | an `unreadable` bucket beside `prose` and `scratch`, printed. |
| 10 | `tests/test-web-quarantine.js` | quarantined artifacts that would not read are collected and printed, so a leak of **their** verdict is not invisible. |
| 11 | `engine/mega_sets_from_sheets.js` | `stats.unparsed` + first message, printed. Verified on the live store: 83,892 games, **0 unparsed**. |
| 12 | `tests/test-rollout-switch.js` | ENOENT still skips; an **unparseable** `policy-weights.json` now fails the existing assertion instead of satisfying its skip arm. No new assertion was added — the check count is 16 before and after. |
| 13 | `tests/test-artifact-rerunnable.js:278` | unreadable release manifests counted and named against `audited`. |
| 14 | `engine/explain_divergence.js` | a pair whose game throws is counted and named in the footer: "a crash is a divergence, not a skip". |
| 15 | `engine/tag_dex.js` **:8623 and :8709 together** | both record through one `noteThrow`, and every dropped tag is named at the end of the build. See §4. |
| 16 | `engine/engine_release.js` | a caller file that will not read joins the existing `error` field of `callerNeeds()`, rather than dropping out of the compat census. |
| 17 | `engine/fixture_legality.js` | a fixture file that will not read is named; silence there read as "clean". |

Nothing on a success path moved. Every file was run or syntax-checked, and the four tests among them
report the same pass counts as before (`test-artifact-rerunnable` 5 checks green,
`test-effective-identity` 24/0, `test-rollout-switch` 16/0, `test-web-quarantine` ALL PASS).

## 3. Where I disagreed with the triage — one place, and it is about the detector, not the call

**The triage's classification held on all 18.** I found no block it had mis-read.

What it could not know is that **`noteThrow(kind, tag, o, e)` does not satisfy the detector's SPEAKS
list.** Passing the caught binding as a bare argument matches none of the clauses — not `.push(`
(that is inside the helper, not inside the catch), not `.message`, not a counter. So the first version
of the `tag_dex` fix left both blocks flagged, and because `:8623` and `:8709` no longer hashed alike,
the count read **64 with MANUFACTURE up one**. Passing `(e && e.message) || e` instead makes the reason
travel in a shape the detector already recognises, and the count fell to 62.

**That is a real property of the detector worth stating:** a catch can carry the reason perfectly well
into a recorder and still be counted silent. The right response was to change the call site, not the
detector — a detector change here may only ever SHRINK the silent set, and this one is the enforcement
agent's file, not ENGINE's.

## 4. The two identical `tag_dex` hashes — both, not one

`:8709` was the flagged one; `:8623` — the main tag-derivation loop that writes `data/tags.json` — sat
in the **baselined floor of 201** with an identical catch body. **Both were changed together.** Fixing
only `:8709` would have lowered the count while leaving the dangerous one exactly as it was.

Proven with a control rather than asserted: an ability whose predicate INPUT throws (one dex row
wrapped in a Proxy, no file edited, no artifact written) makes the build print

```
3 TAG PREDICATE(S) THREW and the entity was recorded as carrying NOTHING for that tag.
  ability  healsAllyOnSwitchIn   on Intimidate  -- DELIBERATE: predicate input unreadable
```

and a clean run prints nothing — measured, **0 throws over the whole live build**. `data/tags.json` was
NOT regenerated: the write was suppressed in-process for both runs, and the file is byte-identical.

## 5. Must-not-move, checked at the end

| | required | measured after |
|---|---|---|
| damage differential | 0 of 6000 @ `--n 6000 --seed 20260804` | **0 of 6000**, and 0 at every one of the 16 corners |
| census | 658 probed / 658 live / 0 missing | **658 / 658 / 0** |

Neither moved, so no swallowed error in the eighteen was load-bearing.

**Two side effects of my own verification runs, reported rather than hidden:**

- `data/provenance-stamp.json` — `verified` **4 → 3**. Cause identified: `data/game-differential.json`
  stamps `engine/medicham2-browser.js`, whose digest changed when I added the MEDFAILS field. That is
  provenance doing its job on any engine edit, and it is **not the ratchet** — `mtime_only` is 171
  before and after, with no file added or removed from the list.
- A 50-game smoke run of `engine/replay_differential.js` **cut an engine release** (`9a1c503567ce`,
  because that file cuts one when `--release` is not passed) and overwrote
  `data/replay-differential-freezes.json` — a 12-day-old full-store artifact — with a 50-game sample.
  **Both tracked files were restored** with `git checkout`; the pointer reads `3e00ea2575a9` again and
  `tests/test-engine-release.js` is 66/0. The release directory itself is under `data/releases/`, which
  is gitignored; it is left in place, not deleted.

## 6. Proposed register row (ROADMAP not edited)

> **#258 (silent-catch backlog) — the eighteen REAL blocks are closed; 62 remain and are correct as
> written.** `node tests/test-no-silent-failure.js` reads **80 → 62 NEW**, baseline untouched at 201,
> `accepted: {}` still empty. The gate is green only at zero and therefore **stays RED**, deliberately:
> closing it needs a decision on `--accept` granularity (its unit is a FILE, judgement is per BLOCK,
> and three files mix a real block with correct ones), not more code. **`engine/tag_dex.js:8623`, which
> the triage reported as an unlisted hazard inside the baselined floor, was fixed in the same pass as
> its identical twin `:8709`.**

## 7. OWED, NOT RUN

| owed | why not |
|---|---|
| `node engine/mega_census.js` | it rewrites `data/mega-usage.json`, 13 days old, off a store that has grown since. Regenerating it is a data decision, not a silent-catch fix. Syntax-checked only. |
| `node engine/replay_differential.js` over the full store | it CUTS a release when `--release` is not given (see §5). The edit was exercised on a 50-game smoke run — `ROLL ID unique 10 ambiguous 16 none 195`, no `THREW` line — and then reverted. |
| `node engine/fixture_preflight.js` inside a real `all_mechanics_fire` run | the corpus loader was exercised directly instead (`readByOthers`, 15/15 sources present, no refusal). |
| the `--accept` granularity decision | Will's call, unchanged from the triage. |
| `--update` / any re-baseline | deliberately not run. It would drop the floor 201 → 197 off a detector change made today. |
| `node tests/run-all.js` | not run: the individual gates touched were each run, and a full sweep would rewrite artifacts this pass has no claim on. |
