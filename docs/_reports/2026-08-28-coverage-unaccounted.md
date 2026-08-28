# The 33 unaccounted checks, classified — 2026-08-28

`node tests/run-all.js --coverage` exits **1** at **34 unaccounted-for checks** (it was 33 when this
task was written; `tests/probe_volley_collapse.js` appeared on disk in between. My own two rescued
probes were already on disk and already counted, so landing them changed the number not at all — the
scanner reads the filesystem, not the index).

**Nothing here was fixed and nothing was run.** The classification is entirely static: the marker
table in `docs/ROADMAP.md`, the `SAFE` regex in `engine/register_reality.js`, and `git log`.
`--coverage` runs no child (`tests/run-all.js:37`), so producing this cost no game slot.

---

## THE HEADLINE

**The buckets do not fall the way the brief guessed, and the difference is the finding.**

| asked | answer |
|---|---|
| (a) a real gap | **31 of 34** |
| (b) a check that moved and lost its accounting | **0 of 34 — measured, not assumed** |
| (c) an accounting artefact that never existed | **0 of 34.** The nearest real category is *"the check runs and only the row is missing"* — **3 of 34** |

**(b) IS EMPTY AND THAT IS A MEASUREMENT, NOT A SHRUG.** `run-all.js` carries its own stale-exemption
arm — any name in `NOT_A_CHECK` / `PENDING_WIRE` that no longer describes a file fails BY NAME — and
it printed **nothing**. Independently, `git log --diff-filter=R -M -200 -- tests/` finds **no renames
into `tests/` at all**. No check moved. Every one of the 34 was born unaccounted.

**32 of the 34 were added on 2026-08-27 or later.** This is not old debt. It is one night's probe
output, and the assertion is doing exactly the job it was built for.

---

## THE WORST CLASS IS NOT ON THE UNACCOUNTED LIST AT ALL

**Three files are recorded as ACCOUNTED FOR on the strength of a runner that does not run.**

`tests/run-all.js`'s `PENDING_WIRE` says of them, in its own words, *"`VERIFIED BY: ...` is in the
register, so `register_reality.js` runs it"* and *"`engine/register_reality.js` execFileSyncs every
marker it finds."* **That claim is false for these three.** Their markers carry a
`node -r ./tests/_live_release.js` preload prefix, and `register_reality.js` starts a marker only if
it matches (`engine/register_reality.js:110`):

    const SAFE = /^node\s+((?:engine|tests|build)[\\/][A-Za-z0-9_.\-]+\.js)((?:\s+--[A-Za-z0-9_\-=]+)*)\s*$/;

which requires the string to **begin with `node`** and permits **flags only**, never a bare value.
A marker that fails it returns:

> *the marker is not a plain `node <repo script>.js [--flags]` command, so it was NOT run*

| file | its marker | why it never starts |
|---|---|---|
| `tests/probe_hazard_recap_fail.js` | `node -r ./tests/_live_release.js tests/probe_hazard_recap_fail.js` | `-r` preload prefix |
| `tests/probe_protect_stage_order.js` | `node -r ./tests/_live_release.js tests/probe_protect_stage_order.js` | `-r` preload prefix |
| `tests/probe_sound_lock_restart.js` | `node -r ./tests/_live_release.js tests/probe_sound_lock_restart.js` | `-r` preload prefix |

This is worse than an unaccounted check, because an unaccounted check is **red** and these read
**green**. It is the exact shape `run-all.js`'s own header warns about — *"a check nothing runs reads
as coverage in a review"* — arriving inside the table built to prevent it.

**`register_reality.js` is not at fault and is honest about it**: it reports `NOT_STARTED` with a
reason. The false sentence is in `run-all.js`'s `PENDING_WIRE` prose, which asserts the marker runs
without ever having asked `SAFE`. Six other probes' markers DO pass `SAFE` and genuinely run
(`probe_mental_herb_order`, `probe_mid_cat_reload`, `probe_poltergeist_item_line`,
`probe_regenerator_line`, `probe_spread_secondary_address`, `probe_red_demo`), so the table is right
about those and wrong about these three.

---

## CLASS 2 — A REAL GAP WEARING A RECEIPT. **15 files. Rank 1 of the unaccounted.**

Each carries a `VERIFIED BY` marker in `docs/ROADMAP.md`, so the register row **looks verified**, and
each marker fails `SAFE`, so `register_reality.js` reports `NOT_STARTED` and the probe has never been
executed by anything but its author.

| file | marker | why it fails `SAFE` |
|---|---|---|
| `tests/probe_corpse_in_slot.js` | `node -r ./tests/_live_release.js tests/probe_corpse_in_slot.js --games 1200 --verify-inert` | `-r` prefix + bare-value arg |
| `tests/probe_doll_blind_family.js` | `SHOWDOWN_PATH=... node tests/probe_doll_blind_family.js` | `SHOWDOWN_PATH=` prefix |
| `tests/probe_endturn_clock_order.js` | `SHOWDOWN_PATH=... node tests/probe_endturn_clock_order.js` | `SHOWDOWN_PATH=` prefix |
| `tests/probe_fractional_priority_draw.js` | `SHOWDOWN_PATH=... node tests/probe_fractional_priority_draw.js` | `SHOWDOWN_PATH=` prefix |
| `tests/probe_hp_pair.js` | `SHOWDOWN_PATH=... node tests/probe_hp_pair.js` | `SHOWDOWN_PATH=` prefix |
| `tests/probe_mega_trace_entry.js` | `SHOWDOWN_PATH=... node tests/probe_mega_trace_entry.js` | `SHOWDOWN_PATH=` prefix |
| `tests/probe_multihit_update.js` | `SHOWDOWN_PATH=... node tests/probe_multihit_update.js` | `SHOWDOWN_PATH=` prefix |
| `tests/probe_noguard_invuln.js` | `SHOWDOWN_PATH=... node tests/probe_noguard_invuln.js` | `SHOWDOWN_PATH=` prefix |
| `tests/probe_random_target_die.js` | `SHOWDOWN_PATH=... node tests/probe_random_target_die.js` | `SHOWDOWN_PATH=` prefix |
| `tests/probe_replacement_entry.js` | `SHOWDOWN_PATH=... node tests/probe_replacement_entry.js` | `SHOWDOWN_PATH=` prefix |
| `tests/probe_spread_status_steps.js` | `SHOWDOWN_PATH=... node tests/probe_spread_status_steps.js` | `SHOWDOWN_PATH=` prefix |
| `tests/probe_substitute_status_step.js` | `SHOWDOWN_PATH=... node tests/probe_substitute_status_step.js` | `SHOWDOWN_PATH=` prefix |
| `tests/probe_trace_list.js` | `SHOWDOWN_PATH=... node tests/probe_trace_list.js --cells 60` | `SHOWDOWN_PATH=` prefix + bare-value arg |
| `tests/probe_trace_target.js` | `SHOWDOWN_PATH=... node tests/probe_trace_target.js` | `SHOWDOWN_PATH=` prefix |
| `tests/probe_yawn_substitute.js` | `SHOWDOWN_PATH=... node tests/probe_yawn_substitute.js` | `SHOWDOWN_PATH=` prefix |

**FOURTEEN OF THE FIFTEEN CARRY THE SAME PREFIX, AND THE PREFIX IS DECORATIVE.** The string
`SHOWDOWN_PATH=... node …` was written so a human could copy-paste it. It is not needed:
`engine/showdown_path.js` **resolves and sets `process.env.SHOWDOWN_PATH` as a require side effect**,
by its own stated design — *"requiring this SETS `process.env.SHOWDOWN_PATH`, so a child process
spawned by a test inherits the resolved path without that test knowing this module exists"*
(`engine/showdown_path.js:24-25`). `register_reality.js` passes no `env` option to `execFileSync`, so
a child inherits it.

**Demonstrated this session rather than argued.** `SHOWDOWN_PATH` was empty in the shell:

    $ echo "SHOWDOWN_PATH=[${SHOWDOWN_PATH}]"
    SHOWDOWN_PATH=[]
    $ node -e "require('./engine/showdown_path.js'); console.log(process.env.SHOWDOWN_PATH)"
    C:\Users\willj\Projects\Pokemon\pokemon-showdown

and `tests/probe_instruct_shield.js` — which exits 2 if the variable is unset — ran all five of its
arms to completion under exactly that empty environment.

So for thirteen of the fifteen, deleting that decorative prefix is the whole of the difference between a receipt and a runner. **I did not
delete them.** Two of the fifteen need more than that: `probe_trace_list.js` also passes a bare value
(`--cells 60`), and `probe_corpse_in_slot.js` fails on both a `-r` prefix and `--games 1200`.

**THE UNDERLYING TENSION IS WORTH NAMING BEFORE ANYONE EDITS THESE.** A `VERIFIED BY` marker is doing
two jobs that pull opposite ways: it is human copy-paste documentation, and it is an executable
contract parsed by a deliberately narrow regex. `register_reality.js`'s own header says the syntax was
chosen so that *"it must be impossible for ordinary prose to produce"* — and the cost of that
narrowness is that a perfectly sensible piece of documentation silently becomes a non-runner, with no
warning at the moment it is written. Whoever fixes this should decide which job the marker has, rather
than editing fourteen strings and leaving the next author to write the fifteenth the same way.

---

## CLASS 1 — NO RUNNER AND NO RECEIPT. **16 files. Rank 2.**

No `VERIFIED BY` marker anywhere, no `require(` edge from any discovered test, not in `GATES`. These
are the honest gaps: the coverage assertion is red about them and it is right.

| file | named in `docs/ROADMAP.md` prose? |
|---|---|
| `tests/probe_berserk_switcheroo.js` | no |
| `tests/probe_fatigue_tag.js` | yes, prose only |
| `tests/probe_instruct_shield.js` | no |
| `tests/probe_knockoff_megastone.js` | no |
| `tests/probe_mega_spread_stat.js` | yes, prose only |
| `tests/probe_poltergeist_use_time.js` | no |
| `tests/probe_reds_plant_reaches.js` | yes, prose only |
| `tests/probe_residual_shadow.js` | yes, prose only |
| `tests/probe_sand_force.js` | yes, prose only |
| `tests/probe_shield_refusal_line.js` | yes, prose only |
| `tests/probe_stat_pick.js` | no |
| `tests/probe_status_blocksstatus.js` | yes, prose only |
| `tests/probe_two_gates.js` | yes, prose only |
| `tests/probe_unburden_herb_paths.js` | yes, prose only |
| `tests/probe_upkeep_lines.js` | yes, prose only |
| `tests/probe_volley_collapse.js` | no |

Ten of the sixteen ARE named in `docs/ROADMAP.md` prose but not in a backticked `VERIFIED BY:`
marker — which is the distinction `register_reality.js`'s header says the marker syntax exists to make
impossible to blur by accident. Here it worked as intended: prose bought nothing, and the register
does not pretend otherwise.

`tests/probe_volley_collapse.js` is in this class and is **untracked and another agent's live work**.
It is listed for completeness and was left alone.

---

## CLASS 3 — THE CHECK RUNS; ONLY THE ROW IS MISSING. **3 files. Rank last, cheapest.**

| file | marker | |
|---|---|---|
| `tests/probe_recoil_after_clamp.js` | `node tests/probe_recoil_after_clamp.js` | passes `SAFE` — runs |
| `tests/probe_refill_entry_herb.js` | `node tests/probe_refill_entry_herb.js` | passes `SAFE` — runs |
| `tests/probe_transform_faint_revert.js` | `node tests/probe_transform_faint_revert.js` | passes `SAFE` — runs |

All three markers pass `SAFE`, so `register_reality.js` really does `execFileSync` them. They have
**exactly** the standing of `probe_mental_herb_order.js` and `probe_poltergeist_item_line.js`, which
are already named in `PENDING_WIRE` with that reason. The gap is a missing row in a table, not a
missing runner. This is the closest thing in the 34 to bucket (c), and it is not "never existed".

---

## A CROSS-CUTTING DEFECT THAT AFFECTS EVEN THE THREE THAT RUN

**Not one of the 34 declares `ABRA-EXIT`, and every one of the 34 has a `process.exit(2)` refusal
path.** Counted: **34 of 34** with an exit-2 path, **0 of 34** with an `ABRA-EXIT` line.

`register_reality.js`'s `classifyExit` reads an undeclared code outside `{0,1}` as `UNDECLARED`:

> *a code outside {0,1} that the instrument never declared, so it is NOT read as a verdict. Declare it
> with a line `ABRA-EXIT <n> <VERDICT-RED|CANNOT-ANSWER>`*

So for the three probes the register genuinely runs, a fixture that **could not be staged** and a
fixture that **staged and agreed** are not distinguishable in the verdict column unless the exit lands
on 0 or 1. `tests/probe_red_demo.js` fixed precisely this — it declares `ABRA-EXIT 0/1/2` so that *"a
refusal can no longer be read as a measured engine defect"* — and it is the model none of these 34
followed.

This matters more than it looks, because **a COULD-NOT-STAGE verdict is a claim about the fixture,
never about the mechanic.** An undeclared exit 2 is that claim being made silently.

---

## RANKED, BY WHAT IT COSTS

1. **The 3 false receipts inside `PENDING_WIRE`** — counted as accounted, do not run, read green.
   Not on the unaccounted list, and the only entries here that are actively misleading.
2. **Class 2, 15 files** — a ROADMAP row says VERIFIED BY and nothing executes. Fourteen are one
   deletion from running, and that cheapness is the argument for doing it deliberately rather than
   fast.
3. **The `ABRA-EXIT` gap, 34 files** — cheap per file, and it is what makes a refusal look like a
   result the moment any of these is wired.
4. **Class 1, 16 files** — honest gaps, correctly red. Each needs a real decision (wire it, or name it
   with a blocker), not a text edit.
5. **Class 3, 3 files** — one `PENDING_WIRE` row each.

---

## OWED, NOT RUN

- **Nothing in this report was executed.** No probe was run, no marker was fixed, no table was edited.
- **The classification is static, and could be wrong in the one way static analysis always can be:**
  a file that trips `looksLikeACheck` may still assert nothing worth running. I checked the seven
  files containing the words "asserts nothing" and **five are describing a CONTROL ARM, not the
  file**; only `probe_berserk_switcheroo.js` and `probe_volley_collapse.js` declare themselves
  DIAGNOSTIC ONLY at file level, and both still exit non-zero on a real internal failure, so neither
  was classified as a non-check. That judgement is the softest one here.
- **The exit code of all 34 is unknown to me** except the two run for the rescue task
  (`probe_berserk_switcheroo.js` exit 1, `probe_instruct_shield.js` exit 1). Whether the other 32 are
  green, red or refusing is NOT established here and must not be inferred from this file.
- **Whether `register_reality.js` currently reports these as `NOT_STARTED` in its artifact was not
  observed.** It writes `data/*` unconditionally and another agent held the game slot, so the verdict
  was derived from the `SAFE` regex rather than from a run. **That derivation is the single claim here
  most worth re-checking against a real run**, and it is the one the top-ranked finding rests on.
