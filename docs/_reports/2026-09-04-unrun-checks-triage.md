# Unrun checks — triage of the `run-all.js` coverage clause

MEASURE, 2026-09-04. Subject: the 66 files the coverage assertion in `tests/run-all.js` reports as
UNACCOUNTED FOR, plus an audit of the 36 existing `PENDING_WIRE` entries.

Everything below was derived from the tree at run time. No count in this file was typed from the
brief; `node tests/run-all.js --coverage` was re-read at the start of the pass and the list it gave
was 66, not the ~60 the brief estimated.

---

## 1. THE FOUR CATEGORY COUNTS

| Category | Count | What happened to it |
|---|---:|---|
| **RUNNABLE NOW** — cheap, deterministic, no pin, no preload, green | **0** | nothing was wired |
| **NEEDS A BASELINE CHOICE** — real check, named blocker | **65** | 2 named in the runner today; 63 classified here and deliberately NOT named (see §5) |
| **NOT A CHECK** — no contract to be red about | **1** | `engine/smogon_coverage.js`, named in `NOT_A_CHECK` today |
| **DEAD** — asserts nothing, or duplicates a wired check | **0 identified** | see the honesty note in §5 |

**Nothing was wired, so nothing turned red on wiring.** That is the headline and it is not a
non-result: the reason is measured, not assumed, and it is in §2.

`unaccounted` went 66 → 63. `NOT A CHECK` 23 → 24, `PENDING-WIRE` 36 → 38. The clause is still RED,
correctly, and `STALE EXEMPTION` is still empty.

---

## 2. WHY THE FIRST CATEGORY IS EMPTY

**63 of the 66 load a simulator.** Derived by scanning every `require(...)` edge, including the
`require(D('engine','x.js'))` idiom that a plain string-literal scan misses — that idiom is why a
first pass of this classification read "3 files require nothing", which was wrong and is recorded
here so the next pass does not repeat it. The 63 require at least one of `medicham2-browser.js`,
`champions_sim.js`, `game_differential.js`, `staged_board.js` or `tests/roster.js`.

An ENGINE agent was live in `engine/medicham2-browser.js` throughout this pass — the file was dirty
and its mtime was three minutes old when measured. A probe run against it is a photograph of a
moving subject, and the precedent this runner sets for wiring a game-playing probe is explicit
(commit `75e96de3`, for `probe_delayed_crit.js` and `probe_sub_clamp.js`): *"BOTH WERE RUN ALONE
BEFORE BEING LISTED, GREEN ARM AND RED ARM."* Neither arm could be run today.

**The remaining 3 do not play a game, and none of them is wirable either:**

| File | Verdict | Evidence |
|---|---|---|
| `engine/smogon_coverage.js` | NOT A CHECK | its only non-zero exit is line 287, `main().then(ok, e => { console.error('FAILED: '+e.stack); process.exit(1) })` — an unhandled rejection. That plus the word FAIL is exactly what trips `looksLikeACheck`'s bare-literal clause. Its header calls its own output a PRIOR "merged into nothing". Named rather than detected around, per the rule at the head of the two lists. |
| `engine/side_selection_census.js` | REAL CHECK, RED TODAY | measured below |
| `engine/sweep.js` | REAL REPORTER, RED BY CONSTRUCTION | `process.exit(sumFindings ? 1 : 0)` at line 754, and §1's findings ARE this runner's unaccounted list. It also spawns `tests/run-all.js --coverage` at line 124, so a GATES entry puts the runner inside itself. |

---

## 3. THE ONE NEW RED FOUND, AND IT IS DAYS OLD

`engine/side_selection_census.js` — measured 2026-09-04 05:56, **exit 1**:

```
undeclared: 84   ratchet 81   >> ROSE — a new side selection entered with nobody saying what it answers
```

The settled `data/side-selection-census.json` is stamped `2026-08-29T16:44:10.421Z` with
`undeclared: 81` and 102 rows. Four UNCLASSIFIED sites are present now that are not in it:

| line | anchor | expression |
|---:|---|---|
| 29955 | `kind:pass` | `const _foes=it.side==='A'?actB:actA;` |
| 29973 | `kind:pass` | `const foes=it.side==='A'?actB:actA;` |
| 35133 | `fn:<module>` | `const _hsf=(it.side==='A'?actB:actA).map(x=>x&&x._sf).find(Boolean);` |
| 35142 | `fn:<module>` | `const _osf=m._sf, _fsf2=(it.side==='A'?actB:actA).map(x=>x&&x._sf).find(Boolean);` |

**Attributed rather than assumed.** `engine/medicham2-browser.js` was dirty when this ran, so the
red could have been the live edit. It is not: all four sites fall outside all 31 hunks of
`git diff -U0 -- engine/medicham2-browser.js`. They arrived in commits made since the artifact was
stamped, which means **this ratchet has been red for days and nothing ran it.** That is the exact
class the coverage assertion exists to surface, arriving through the door it was built for.

**Routed to ENGINE, not fixed here.** Deciding whether a site is a SIDE question or a TARGET
question is a claim about the authority and belongs with the owner of
`data/side-selection-declarations.json`. Not wired, for `engine/feature_fixture.js`'s reason one
entry above it in the same list: wiring it ships a red MEASURE cannot fix.

---

## 4. AUDIT OF THE 36 EXISTING `PENDING_WIRE` ENTRIES

**How many could be wired today: ZERO.** How many name a blocker that is still true: **34 of 36
outright**, with the other 2 carrying text that had outlived its reason. Both were corrected in this
pass rather than left standing.

Blockers re-checked mechanically on this tree:

- **30 `tests/` entries** — the shared blocker is "it plays a game". Verified by require-edge scan:
  every one of the 30 pulls in a simulator module. Still true, and true again today because an
  ENGINE agent is live in the simulator.
- **`engine/feature_fixture.js`** — the entry says RED BY DESIGN, REFIT OWED. **Re-measured today:
  exit 1.** Both gates fire — fixture identity (`scenarios 10 -> 12`) and the damage table
  (`318 species -> 322`, digest `405c836793d1 -> 9d289cf77e24`). A moved damage table is a REFIT and
  not a restamp. Blocker true.
- **`engine/format_audit.js`** — "writes its artifact unconditionally". True: `fs.writeFileSync`
  at line 267, with no `--write` guard anywhere in the file.
- **`engine/orient.js`**, **`engine/derive_protocol_events.js`**, **`tests/probe_red_demo.js`** —
  "already has a runner". All three true: `tests/test-orient.js:40`,
  `tests/test-protocol-trace.js:937` (`spawnSync`), and a SAFE `VERIFIED BY:` marker respectively.
- **`tests/probe_drag_body.js`**, **`tests/probe_lifeorb_toll.js`** — "refuses without `--release`".
  True; both still exit 2 on the bare invocation.
- **`engine/preflight.js`** — NEVER, deliberately, and structural. Unchanged.
- **Library claims re-verified as real `require(` edges, not comment mentions**:
  `tests/test-interaction-matrix.js:53`, `tests/test-mutation-coverage.js:50`,
  `tests/test-pinch-family.js:63`.

### The two entries whose text had gone stale — both corrected

1. **`engine/register_reality.js`** stated two blockers and **both were false**. "It WRITES its
   artifact unconditionally" was fixed by ROADMAP #369; `tests/test-register-reality-readonly.js` is
   DISCOVERED by the glob and asserts on the real process that a `--list` leaves
   `data/register-reality.json` byte-identical AND mtime-identical. The second blocker — "the pass
   that found it was instructed not to touch `docs/ROADMAP.md`" — was never a property of the file,
   only of one pass's instructions, and a per-pass constraint written into a standing exemption is
   the stale-handoff failure in miniature. The entry now names the three real reasons: the
   `--selftest` already has a runner (same discovered test, line 130), `--list` exits 0 by
   construction so it would be a registered no-op, and the full measurement execFileSyncs dozens of
   whole-game markers and publishes an artifact.
2. **`tests/probe_selfdestruct_winner.js`** said "landed today". It landed 2026-08-22 in `cfa3cab9`
   and "today" had been read as the present for thirteen days. Re-checked: still no marker, still no
   discovered runner, so the substance holds and only the clock was wrong. Now dated.

---

## 5. THE FULL CLASSIFICATION OF THE 63 STILL UNACCOUNTED, AND WHY THEY WERE NOT NAMED

All 63 play a game. They split three ways on the question the runner would actually have to answer:

| Class | n | What wiring one would require |
|---|---:|---|
| **Has a `VERIFIED BY:` marker that `SAFE` accepts** — `engine/register_reality.js` execFileSyncs it | 19 | nothing; it has a runner, and a GATES entry buys a second execution. **But see the sting below.** |
| **Self-preloads `tests/_live_release.js` when `--release` is absent** — reads the LIVE tree, so no baseline choice is owed | 8 | one green-arm/red-arm certification on a settled tree. This is exactly the `probe_delayed_crit` shape and these are the strongest wiring candidates for the next pass. |
| **Refuses without `--release` (exit 2)** | 6 | a release pin in `EXTRA` — a baseline choice this runner may not make (`probe_drag_body`'s existing reason). |
| **Plain, requires the live simulator directly** | 30 | same certification, plus a decision about SHOWDOWN_PATH skips. |

The 8 self-preloading probes, which are the ones to wire next:
`probe_accuracy_stage_combine`, `probe_afterfaint_boundary`, `probe_ally_forced_switch`,
`probe_default_target_side`, `probe_encore_bracket`, `probe_kingsrock_volley`,
`probe_priority_modified`, `probe_shield_refusal_line`.

**Why they were not bulk-named into `PENDING_WIRE` today.** Naming 63 files would take
`unaccounted` to 0 and turn the FATAL clause green, converting a loud red into a 99-entry exemption
list — which is the thing that "reads as coverage in a review". The list's own standard is that
"a reason is not decoration… every entry was classified by READING that file's own header in the
pass that added it". I read three headers in full and classified the other 63 mechanically. A
mechanical classification is a real fact and it is in this report; it is not a read header, and
promoting it into the runner would be exactly the shortcut the file forbids.

**Honesty note on the DEAD count.** I found no dead file, and I am not in a position to claim there
is none: identifying a check that asserts nothing requires reading it, and 63 were not read.
`DEAD: 0` here means *none identified*, not *none exists*.

**Confirmed from the brief:** `tests/probe_kingsrock_volley.js` and `tests/probe_multihit_corners.js`
appear **zero** times in `docs/ROADMAP.md` and have no discovered runner. The probes ENGINE is
required to write are executed by nothing.

---

## 6. A SECOND FINDING: 9 MARKERS THAT READ AS RUNNERS AND ARE NOT

`docs/ROADMAP.md` carries **124** `VERIFIED BY:` markers. Applying `register_reality.js`'s own
`SAFE` predicate: **115 are executable, 9 are rejected** and therefore read as NOT_STARTED. An
unaccounted check is RED and these read GREEN — which is ROADMAP #521's defect exactly, and #521
fixed only the `-r` preload case:

```
SHOWDOWN_PATH=... node tests/roster.js --stage items --release <id>
SHOWDOWN_PATH=... node tests/roster.js --stage moves            (x2)
node -r ./tests/_live_release.js tests/probe_corpse_in_slot.js --games 1200 --verify-inert
data/switchin-order.json
node engine/all_mechanics_fire.js --kind abilities
node engine/game_differential.js --arm middle --team-store data/team-pool-frozen   (x2)
SHOWDOWN_PATH=... node tests/probe_volley_collapse.js
```

Three distinct causes: a `SHOWDOWN_PATH=` prefix (`SAFE` requires the string to begin `node `), a
flag taking a space-separated value (`--games 1200`, `--stage moves`, `--arm middle`), and one entry
that is not a command at all (`data/switchin-order.json`). This is why `probe_corpse_in_slot.js` and
`probe_volley_collapse.js` appear in the unaccounted list despite carrying a marker.

**And the sting on the 19.** `engine/register_reality.js` is itself in `PENDING_WIRE` and is run by
nothing in the suite. So for 19 of the 63, "it has a runner" means "a tool nobody runs would run
it". That is a weaker claim than the phrase suggests and it is stated here rather than left implied.

---

## 7. WHAT WAS CHANGED

`tests/run-all.js` only. Four edits, all inside the two by-name tables:

- `NOT_A_CHECK` += `engine/smogon_coverage.js`
- `PENDING_WIRE` += `engine/side_selection_census.js` (with the measured red)
- `PENDING_WIRE` += `engine/sweep.js` (red by construction + the recursion)
- corrected the two stale reasons (`engine/register_reality.js`, `tests/probe_selfdestruct_winner.js`)

No GATES entry was added. No probe was run. No file was deleted. Nothing was committed.

---

## OWED

- **ENGINE** — four undeclared side selections in `engine/medicham2-browser.js`
  (lines 29955, 29973, 35133, 35142). `engine/side_selection_census.js` has been exit 1 since some
  commit after 2026-08-29 and nothing ran it. Classify them, restamp
  `data/side-selection-census.json`, and the census can be wired into `GATES` the same day.
- **ENGINE / whoever owns the register** — 9 of 124 `VERIFIED BY:` markers are rejected by `SAFE`
  and read as NOT_STARTED. Two of them are the only claimed runner for a probe in the unaccounted
  list.
- **MEASURE (next pass, on a settled tree)** — certify and wire the 8 self-preloading probes, green
  arm and red arm each, per the `probe_delayed_crit` precedent. That is the largest honest reduction
  available in the unaccounted count.
- **MEASURE** — `engine/feature_fixture.js --check` is still exit 1 with the damage table moved
  318 → 322 species (`405c836793d1` → `9d289cf77e24`). **REFIT OWED, not restamp.** A restamp
  answers the fixture gate and silences the table gate.
- **Nobody yet** — `engine/register_reality.js`'s full measurement has no home. It is the only thing
  that compares the register to reality and the suite is not the right place for dozens of whole
  games. Until it has one, the "has a runner" claim on 19 probes rests on a hand-typed command.
