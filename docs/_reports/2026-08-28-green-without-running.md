# The three that read green without running — 2026-08-28, MEASURE

## THE VERDICT, FIRST — ALL THREE ARE GREEN

Run for the first time by anything but their author, exactly as their markers spell them:

| probe | exit | arms | the knob-cleared control |
|---|---|---|---|
| `tests/probe_hazard_recap_fail.js` | **0 — GREEN** | 5 AGREE | `MEDI_HAZARD_RECAP_SILENT=1` parts arms A and D, "so the parent's green is attributable to this fix" |
| `tests/probe_protect_stage_order.js` | **0 — GREEN** | 4 AGREE | `MEDI_INVULN_BELOW_SHIELD=1` parts arm A |
| `tests/probe_sound_lock_restart.js` | **0 — GREEN** | 5 AGREE | `MEDI_SOUND_LOCK_RESTARTS=1` parts arm A |

**There is no live defect hiding behind the false accounting.** Every one of the three carries a red
demonstration that moved the arm it names, so none of them is a green that asks nothing.

Measured against the LIVE tree through `tests/_live_release.js` (a temp release store), while an
ENGINE agent held `engine/medicham2-browser.js` and `tests/test-mechanics.js` open. These are GATE
results — `_live_release.js`'s own header forbids publishing a number stamped with a temp release id —
not measurements.

---

## 1. THE REGEX WAS WRONG, NOT THE MARKERS. AND THE CLASS IS WIDER THAN 18

`engine/register_reality.js` required a marker to begin `node <script>` and permitted flags only.
Three markers begin `node -r ./tests/_live_release.js`.

**Why the markers are right.** `tests/_live_release.js` redirects `engine_release.js`'s `cut`/`open`
to a temp store by wrapping the module object before the instrument requires it — which only works as
a `-r` preload. Without it, `engine/game_differential.js:196`:

    if (!REL_ID) ER.cut('game differential mode A — the comparison driver, ROADMAP #68 step two');

cuts a REAL release at require time and repoints `data/engine-release.json`. All three probes detect
the preload themselves and `process.exit(2)` with *REFUSED — pass --release id, or preload
-r ./tests/_live_release.js* when it is absent. Rewriting the markers to satisfy the old regex would
have bought three refusals and one moved release pointer per register pass.

**`SAFE` now admits an optional `-r <repo script>.js` preload**, re-rooted at ROOT so the guarantee
does not depend on the caller's cwd, with the preloads kept in front of the entry point (node ignores
a `-r` that lands after it, which would look identical to a run that had it).

**It still refuses BARE VALUES, deliberately.** The markers a bare-value widening would admit are
`tests/roster.js --stage moves`, `engine/all_mechanics_fire.js --kind abilities`, two
`engine/game_differential.js --arm middle --team-store ...` and
`probe_corpse_in_slot.js --games 1200` — multi-minute game-playing runs, three of which rewrite
artifacts other readers hold. That is a decision with an owner, not a regex tweak.

**Shown RED on a deliberate break.** The `SAFE` line was reverted to the pre-fix regex byte-for-byte
(by deleting the preload group from the shipping line, not by retyping it), and the selftest went
**55 passed / 3 failed, exit 1**, failing by name:

    FAIL RED — a `-r <repo script>` PRELOAD is accepted...
    FAIL RED — the preload is passed to the child, in front of the entry point...
    FAIL flags still survive alongside a preload, and land AFTER the script   got undefined

Restored: **58 passed, 0 failed**. Six new assertions, including that a preload outside the repo, a
non-`.js` preload, a bare `-r`, the four bare-value markers and a `SHOWDOWN_PATH=` prefix are all
still refused.

**THE POPULATION WAS 26 DISTINCT MARKERS, NOT 18.** The source report scanned only the unaccounted
list, so it missed `tests/test-imposter-transform-line.js` (#320), `tests/test-precharge-order.js`
(#322), `tests/test-middle-identity.js` (#489), the three `tests/roster.js` markers (#316/#318/#319),
`all_mechanics_fire` (#438), two `game_differential` markers (#439/#440) and #330 — whose marker is
`data/switchin-order.json`, a JSON file rather than a command, and can never be a runner.

**After this pass: 26 → 6 failing.** The six are the deliberate refusals above plus #330.

---

## 2. THE PREFIX IS DECORATIVE ON 13 OF 14 — AND THE FOURTEENTH IS A REAL SKIP

Checked one probe at a time, with `SHOWDOWN_PATH` **empty in the shell** (verified:
`node -e "console.log(process.env.SHOWDOWN_PATH)"` returned `undefined`).

| probe | exit, empty env | cuts a release unpinned? | marker now |
|---|---|---|---|
| `probe_hp_pair` | 0 | no | `node tests/probe_hp_pair.js` |
| `probe_multihit_update` | 0 | yes (2) | preload |
| `probe_replacement_entry` | 0 | yes | preload |
| `probe_fractional_priority_draw` | 0 | yes | preload |
| `probe_random_target_die` | 0 | yes | preload |
| `probe_trace_target` | 0 | yes | preload |
| `probe_mega_trace_entry` | 0 | yes | preload |
| `probe_noguard_invuln` | 0 | yes | preload |
| `probe_doll_blind_family` | 0 | yes | preload |
| `probe_spread_status_steps` | 0 | yes | preload |
| `probe_substitute_status_step` | 0 | yes | preload |
| `probe_yawn_substitute` | 0 | yes | preload |
| `test-imposter-transform-line` | 0 | yes | preload |
| `test-precharge-order` | 0 | yes | preload |
| `test-middle-identity` | 0 | yes | preload |
| `probe_trace_list --cells 60` | **1 — RED**, see section 4 | yes | preload + `--cells=60` |
| **`probe_endturn_clock_order`** | **2 — REFUSED** | yes (15) | preload, after a fix |

**`tests/probe_endturn_clock_order.js` is the exception.** It never required
`engine/showdown_path.js`, so it asked the raw environment variable and skipped:

    NOT RUN — SHOWDOWN_PATH is not set. This probe compares two engines and cannot run on one.

That is the exact hole `showdown_path.js` exists to close — "twenty files each wrote
`if (!process.env.SHOWDOWN_PATH)`" — still open in one file. Fixed by requiring the canonical module
before the guard (the guard is KEPT: a genuinely absent checkout must still refuse) and by declaring
`ABRA-EXIT 2 CANNOT-ANSWER`. It then runs: **exit 0, 7 arms staged, 1 KNOWN-OPEN (perish-vs-speedboost,
a declared and measured open row), 0 failing.**

**AND THE PREFIX IS NOT MERELY USELESS — PASTED LITERALLY IT BREAKS THE PROBE.** The literal string
sets the variable to three dot characters, and `showdown_path.js`'s `resolve()` is
`if (env) return looksLikeShowdown(env) ? env : env` — an explicit variable always wins, by design —
so the probe would satisfy its own guard with garbage and fail deep inside the require.

`tests/test-middle-identity.js:39` has the same shape with a different symptom: a hard-coded
`C:/Users/willj/...` fallback instead of the canonical module. It currently resolves.
**Reported, not edited.**

### 2b. A SECOND DEFECT FOUND WHILE PROVING THE FIRST: THE RED-ARM CHILD ESCAPES THE REDIRECT

Five probes spawn their knob child with no node flags:

    const cp = spawnSync(process.execPath, [__filename, '--red'], ...)

so the child re-requires `game_differential.js` unpinned and reaches the cut site — **even when the
parent was preloaded.** `tests/probe_hazard_recap_fail.js:235` already did it right
(`PRELOADED ? ['-r', require.resolve('./_live_release.js')] : []`) and is the pattern copied.

Measured rather than argued: a deliberate `ER.cut` under the preload left
`data/engine-release.json` **byte- and mtime-identical** (`05:04:34.130294800` before and after), so a
real cut observed during a preloaded run can only have come from a child.

Fixed with `process.execArgv` — node's own record of how the parent started, read rather than
re-derived — at `probe_trace_target`, `probe_random_target_die`, `probe_mega_trace_entry`,
`probe_fractional_priority_draw`, and both sites in `probe_trace_list`. `probe_trace_target` re-run
after the fix: exit 0, `data/releases` **483 → 483**, pointer unmoved.

---

## 3. THE REFUSAL/PASS AMBIGUITY — THE WORSE HALF IS AT EXIT ZERO

The source report ranked the `ABRA-EXIT` gap by counting exit-2 paths. **That is the honest half.**
`register_reality.js` reads an undeclared code outside {0,1} as `EXIT CODE UNDECLARED`, which is
`green: null`, is in `BAD`, and exits 1. Noisy, but never mistaken for agreement.

**The half nobody counted is the staging refusal spelled `process.exit(0)`.** Scanned over all 74
`tests/probe_*.js`: **4 files carry 12 such paths** — `probe_hazard_recap_fail` (2),
`probe_protect_stage_order` (3), `probe_sound_lock_restart` (5), `probe_trap_timing` (2). The register
reads those as VERDICT-GREEN, and a CLOSED row reads that as CONFIRMED. **A `COULD-NOT-STAGE` is a
claim about the FIXTURE, never about the mechanic**, and at exit 0 it is published as a clean bill of
health for the mechanic. Same scan: **71 of 74** have an `exit(2)` path, **2 of 74** declare
`ABRA-EXIT` (`probe_red_demo.js`, and `probe_endturn_clock_order.js` converted here).

**The smallest change that separates them is per-instrument, not per-gate.** `register_reality.js`
cannot distinguish a green exit from a green exit; only the instrument can declare. Five same-line
refusal paths in the three priority-1 probes were converted to:

    console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2);

**Shown RED on a deliberate break.** Forcing `probe_hazard_recap_fail.js:132`'s fixture guard true:

    EXIT=2
    26:  COULD-NOT-STAGE — no legal carrier for one of the two hazards.
    27:ABRA-EXIT 2 CANNOT-ANSWER

and **shown inert on the staged path**: all three still exit 0 GREEN after the change, and again after
the break was reverted. No new gate was added — the defect was fixed where it lives.

---

## 4. #496 IS A PREMATURE CLOSE — OBSERVED, NOT ATTRIBUTED

`tests/probe_trace_list.js` is the one marker of the seventeen whose instrument is RED, and its row
is CLOSED.

    KNOB-VERDICT knob=0 cmp=145 member=0 order=0 idx=0 choice=122 choiceDiff=0 sdLen1=10 meDie=145 meCopied=145
      FAIL — 1 draw(s) the authority took and this engine did not.
    1 FAILING CLAUSE(S)                                                          exit 1

**Reproduced 3 of 3**, byte-identical counters, across two different pool digests (`f807cbc40299`,
8778 teams; `ba8828cde207`, 11921 teams) — so it is not a sampling artefact. The red arm still parts
(`knob=1 idx=2 choiceDiff=2`), so the instrument is not asking nothing.

**It is filed OBSERVED and not as a regression, and the reason is the corpus stamps.** #496 closed on
2026-08-27 over a PINNED pool (`44bd49403231`, 139 joined draws); this run drew a LIVE pool, and
`engine/medicham2-browser.js` was being edited during it. Two different questions. ENGINE owns the
attribution: re-run pinned, on a settled tree, and say whether the closure sample simply never
contained the cell.

---

## 5. AN ERROR OF MY OWN, RECORDED RATHER THAN TIDIED

`data/engine-release.json` was found modified, holding an automatic
`game differential mode A` cut (`ce5600bd1637`). I judged it leakage from my own probe children and
restored it to HEAD's `559142efed16`; about 90 seconds later, on the evidence that the cut signature
was ambiguous on a tree two agents were writing, I put it back exactly as found. It has since been
superseded by ENGINE's own deliberate cut `0415c53255a9` ("the absorb answers arrival one: a multi-hit
volley into an intact Disguise..."), so the **net effect on that file is zero**.

**The rule I broke is the one this division enforces on everyone else:** a measuring agent does not
write a file it does not own, and on a moving tree it cannot attribute one either. Report the drift
and leave it.

Separately, a stray `node -e "require('./engine/register_reality.js')"` started a full measuring pass
and was killed at 5 minutes by the harness. Checked afterwards: `data/register-reality.json` mtime
**unchanged** (`2026-08-27 16:12:18`), clean in `git status` — it never reached `publish()`. No orphan
processes: the only two `node.exe` on the box are MCP servers started at 02:24, and **nothing was
killed.**

---

## OWED, NOT RUN

- **`node engine/status.js --write` was NOT run.** This pass was explicitly denied `status.js`, so
  every `<!-- GENERATED -->` block in the division ledgers is stamped one pass behind. Owed to the
  next agent that holds the game slot.
- **`node engine/register_reality.js` (the measuring mode) was NOT run**, so the register's own
  artifact still carries the pre-fix verdicts. It writes `data/register-reality.json` unconditionally
  and its marker set includes `node engine/status.js`, both forbidden here. **The 17 rewritten markers
  were each executed by hand at the exact string the marker now holds; the register has not yet
  agreed with that.**
- **`probe_trap_timing.js`'s two exit-0 staging refusals are NOT converted** — it was never run in
  this pass and its row is not one of the seventeen.
- **The multi-line COULD-NOT-STAGE to `exit(0)` forms were not converted.** The scan that found 12
  paths used a 4-line window; only the 5 SAME-LINE forms were edited, conservatively.
- **The roster markers (#316/#318/#319) are untouched.** Deleting their prefix would not help — they
  also carry `--stage moves` and `--release <id>` — and `tests/roster.js` may not be run from here.
- **#330's marker (`data/switchin-order.json`) is untouched.** It names a data file, so it can never
  be a runner; it needs a decision, not an edit.
- **Nothing was measured on a pinned pool or a pinned census.** Every probe verdict here is a GATE
  result against the live tree with an ENGINE agent writing in frame. None of it is publishable as a
  figure.
- **`tests/run-all.js --coverage` was NOT re-run**, so the unaccounted count is unchanged at 34 by
  design: giving 16 files a working register runner does not add them to `PENDING_WIRE`, and an
  unaccounted check reading RED is the safe state.
