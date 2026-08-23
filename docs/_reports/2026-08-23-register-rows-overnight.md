# Register rows for the overnight work — MEASURE, 2026-08-23

Historical findings record. Not maintained, not current state, superseded by the register rows it
feeds and by `node engine/status.js`.

**Light mode.** No game was played. Nothing on the forbidden list was run: no `tests/roster.js`, no
`game_differential.js`, no `tests/test-engine-diff.js`, no `all_mechanics_fire.js`, no
`tests/test-mechanics.js`, no `quarantine.js` as a script, no `status.js --write`, and
**`engine/register_reality.js --list` was NOT run** (it overwrites the verdict artifact — #369).
`data/register-reality.json` was read only. The only file changed is `docs/ROADMAP.md`.

---

## VERDICT

**14 rows opened, 3 of them closed on landing, 2 rows re-scoped, 0 rows closed that were already
open.** Seven of the eleven open rows assert breakage and every one of them carries either a
`VERIFIED BY` or an explicit `INSTRUMENT OWED`.

The most important single row is **#391 — the effective-identity ratchet — which is a DECISION for
Will and states three options so it can be answered in one line.**

---

## 1. WHAT WAS LANDED, ROW BY ROW

| # | subject | verdict |
|---|---|---|
| #388 | a Substitute refuses an on-entry stat drop | **closed** — census probe live, knob red, tags derived |
| #389 | `test-unmodelled-clicks.js` republishes its artifact on a RED run | open — instrument DEFECT, fix in flight |
| #390 | the living-docs gate rewrote its own baseline on the class of commit it fires on | **closed** — shown red four ways |
| #391 | the effective-identity raw-count ratchet | open — **DECISION NEEDED FROM WILL (A/B/C)** |
| #392 | a body built as the already-busted Mimikyu forme absorbed the hit | **closed** — probed and measured twice |
| #393 | the damage harness never runs `ModifyMove`, so five mega abilities are invisible to the ruler | open — INSTRUMENT DEFECT, holds a gate clause shut |
| #394 | a Castform-Snowy body is never reconciled to an empty sky | open — engine or instrument NOT ADJUDICATED |
| #395 | the damage differential publishes 40 rows of however many it found | open — instrument reporting, NOT A DEFECT |
| #396 | the whole-game 82 → 31 mechanisms, and the board-material split is UNMEASURED | open — measurement index |
| #397 | six switch-in / on-hit effects do not fire at all in a real game | open — engine DEFECT |
| #398 | a zero-magnitude boost family of 5 sitting under the CLOSED #289 | open — engine DEFECT SUSPECTED |
| #399 | `divergence_cards.js` renders a two-day-old dump with no staleness warning | open — instrument DEFECT |
| #400 | a semi-invulnerable body is hit anyway, under the CLOSED #123 | open — engine DEFECT SUSPECTED |
| #401 | Future Sight's delayed damage is off by 1-2 HP | open — engine DEFECT SUSPECTED |

**Re-scoped, not opened:**

- **#351 (Moody) — SETTLED as the INSTRUMENT and the status cell now forbids editing the engine for
  it.** The row's own open question (*do the two engines share the die*) is answered in
  `engine/game_differential.js`, read tonight rather than quoted: `MID_CATS = ['acc','crit','sec',
  'dmg','stall']` at :699, restated as `OUT` at :872, with the comment above naming exactly what is
  excluded — *"the `any` bucket is every draw with no move in scope — target selection, sleep
  timers, multihit counts"*. Moody's pick is `this.sample(stats)` on a residual and is that class.
  The row still carries its original *what would decide it* (print the address each side uses) as
  **owed confirmation**, because the verdict is a construction argument plus a signature and not
  that print.
- **#176 — now points at #391** and its diagnosis (*"most of the gap is files written after the
  baseline"*) is quantified at **62% of the red**: 24 of the 30 over-baseline files did not exist on
  2026-08-11.

---

## 2. WHAT I VERIFIED RATHER THAN RELAYED

Every number below was read out of an artifact or a source file in this pass; the briefing figures
that differed are corrected in the rows.

| claim as briefed | measured |
|---|---|
| census "642 probed / 642 live / 0 missing" | **643 / 643 / 0**, `data/mechanics-census.json` generated 2026-08-23T09:02:29Z |
| the substitute probe reads `intimidate[true]`, subbed `at:0`, open `at:-1`, `-immune` | **confirmed verbatim in the artifact**, plus the same shape for `supersweetsyrup` and a CONTROL flat in both arms |
| `blockedBySubstitute` is still bridged | **no longer true** — `data/tags.json` carries the derived key `true` on both members, committed at `7f28584`, so the bridge is unreachable and gets no row |
| the damage differential shows 56 disagreements | **41**, `data/engine-diff.json` re-run at 2026-08-23T09:07:44Z, same seed 20260804, same 6,000 comparisons |
| Mimikyu-Busted is an open engine defect (15 of 56) | **already fixed in the working tree** — `formeOnHitAbsorbs` now carries a species test and a `FORMEONHIT_SPECIES_BLIND` knob; a census probe *"a body that is ALREADY the busted forme absorbs nothing"* is live; the family is gone from the published 40 |
| `test-unmodelled-clicks.js` writes unconditionally | **confirmed at `HEAD`** (`git show HEAD:` — the `writeFileSync` is outside every conditional); a green-only fix is in the working tree, uncommitted, and I did not run it |
| the effective-identity baseline is untouched | **confirmed** — `data/effective-identity-baseline.json` still reads `generated: 2026-08-11`, `count: 1198`, 80 files, sum of `allowed` = 1198 |
| the whole-game headline `77 of 961` | **the primary arm is 82**; my cause-count reproduction of the report's classifier agrees on zero-magnitude 5, `fallenundefined` 5, drain 4, Moody 8, Intimidate 1, and total 82 |
| `test-mechanics.js` is the gate that decides #388 | **it is not** — its exit code tracks the unarmed, direct-call and hollow ratchets, not a named probe going dark. #388 says so and files an INSTRUMENT OWED rather than a false `VERIFIED BY` |

---

## 3. WHAT I REFUSED TO CLOSE, AND WHY

- **#389 (`test-unmodelled-clicks.js`).** The brief said open it and not close it, and that is also
  what the evidence supports: the fix is another agent's, uncommitted, and I ran nothing. Closing on
  a fix I did not measure is the failure this register exists to prevent.
- **#397 (the six absent entry effects).** Six board-material absences with a populated tag row
  each and **no probe covering any of them today**. A row asserting breakage with no instrument is
  DEBT, so each carries an INSTRUMENT OWED.
- **#394 (Castform).** The instrument-versus-engine call rests on a read of the source, not on an
  execution, and the settling probe requires playing a battle init — forbidden tonight. Filed with
  **no verdict**, and with the consequence stated: if the body reads `["Ice"]`, it is a second
  engine defect and outranks #393.
- **#396 (the whole-game index).** It would have been easy to publish a board-material split. The
  run was `state_mode: false` / `end_state_mode: false`, so **no measurement in it says any of the
  82 is narration-only**, and `data/state-ladder.json` is 16 days old and predates the artifact's
  own declared `baseline_reset`. The `--end-state` command is written into the row.
- **The cross-references in #396 are matched by SUBJECT and are not a row-by-row audit.** 342
  register rows were not individually adjudicated against 31 mechanisms tonight. That gap is
  labelled inside the row, and it is exactly the work #386 says `open_work.js` must learn to do.
- **Two rows were filed specifically because a CLOSED row sits over a live family** — #398 under
  #289 (the zero-magnitude emitter is fixed; five games still diverge on a zero-magnitude boost,
  and the census proves the emitter half works) and #400 under #123 (the exception LIST was settled;
  whether the invulnerable turn is respected was not). Anyone grepping the register would have
  stopped at "closed" in both cases.

---

## 4. OWED, NOT RUN

- **`node engine/status.js --write`** — forbidden by the brief. The generated blocks do not reflect
  this pass.
- **`docs/MEASURE.md`** — my own division ledger has no row for this pass. Outside the ownership
  list I was given (ROADMAP plus this report), and possibly open in another session. **The
  living-docs rule is therefore unsatisfied for this change until that lands.**
- **`CHANGELOG.md` and a version bump** — the coordinator's, deliberately, so agents do not collide
  on that file.
- **Nothing was committed.** `docs/ROADMAP.md` is modified on disk only.
- **`engine/register_reality.js`** was not run in any mode, so none of the fourteen new rows has
  been through the row-versus-instrument check. The three closed ones would be the first to run.
- **The pinned-pool reading for #388.** The Substitute fix is rank 1 of the whole-game 82 and no
  differential has been run since it landed; Intimidate is 18,772 uses and Substitute 1,222, so the
  prediction on the record is that the pool moves. That is a prediction, not a result.
- **The `--end-state` differential run** named in #396. Twenty of the 31 mechanisms are UNKNOWN on
  board-materiality and the bar is board-material zero; ranking fixes before that run is ranking
  blind.
- **The `ModifyMove` re-measure** named in #393, and the Castform init probe named in #394.

---

## 5. NOT DELETED, REPORTED

- `data/_pair-pilot.json` — untracked, not mine, left in place.
- Modified by other agents while I worked and untouched by me: `.githooks/pre-commit`,
  `data/engine-diff.json`, `data/engine-release.json`, `data/mechanics-census.json`,
  `data/published-samples.json`, `data/unmodelled-clicks.json`, `engine/medicham2-browser.js`,
  `tests/test-docs-current.js`, `tests/test-effective-identity.js`, `tests/test-mechanics.js`,
  `tests/test-unmodelled-clicks.js`.
- Two untracked reports from tonight's other agents (`2026-08-23-docs-gate-self-dirties.md`,
  `2026-08-23-effective-identity-ratchet.md`) — read, not touched.

---

## 6. ONE PROCESS FAILURE OF MY OWN, RECORDED BECAUSE IT NEARLY COST A LINE

A regex built inside `node -e "…"` from a bash double-quoted string degraded — the escaped pipe
became an ALTERNATION — so `^\|\s*#351\s*\|` matched every line and `findIndex` returned 0. Two
addenda were appended to `docs/ROADMAP.md`'s **title line** instead of to rows #351 and #176. Caught
within a minute by diffing rather than by trusting the script's own "patched" message, and repaired
by running the same edit from a script FILE with the title line restored byte-for-byte
(`git diff` now shows only the intended 16 insertions / 2 deletions). **Do not build a regex inside
`node -e` in this shell.** The same pass also caught two literal `||` operators inside row text that
would have rendered as extra table columns; every new row is now verified at exactly four unescaped
pipes.

---

## 7. LATE ADDITION — the class gate landed while this was being written

`tests/test-red-run-writes.js` appeared in the tree (untracked) during this pass: a structural gate
for the whole "a check publishes on a path where it already failed" property, rather than a list of
known-bad files. Its own header reports **five more instances found the same night**, one of them
`tests/test-game-diff.js` publishing its artifact **after its comparator had failed its own
planted-divergence proof**, and it records that four instruments already carried an ad-hoc
write-detecting regex with nothing enforcing the property. #389 was extended to say so.

**No `VERIFIED BY` marker was placed on #389.** The file is untracked at filing time and MEASURE has
not run it; the marker belongs there the moment it is committed and has been run once. That is the
#381 rule applied to my own row rather than to somebody else's.
