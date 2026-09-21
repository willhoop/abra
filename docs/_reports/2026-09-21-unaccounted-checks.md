# The 35 unaccounted-for checks — 2026-09-21, MEASURE

`tests/run-all.js --coverage` read **35 unaccounted for** at the start of this pass and reads
**0 unaccounted for, 0 stale exemptions, exit 0** at the end. Nine were WIRED IN; twenty-six were
named with a reason. Nothing was silenced by narrowing the detector and no pattern-based exemption
was added.

Every figure below was measured in this worktree with
`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`.

## Before / after

```
COVERAGE — 339 file(s) outside the run list report their own verdict.
  24 named NOT A CHECK, 47 named PENDING-WIRE, 233 derived PENDING-WIRE, 35 unaccounted for.   exit 1

COVERAGE — 330 file(s) outside the run list report their own verdict.
  24 named NOT A CHECK, 73 named PENDING-WIRE, 233 derived PENDING-WIRE, 0 unaccounted for.    exit 0
```

`discovered` falls 339 → 330 because nine files moved into `GATES`, which discovery excludes.

## 1. WIRED IN — nine

Each was run alone first, then run again **through the runner** with
`node tests/run-all.js --only …`, which reported `9 passed, 0 failed, 0 waived, 0 skipped`.
None plays a game against the authority; none writes into `data/` in the mode it is registered in;
none opens a frozen release for a mechanic verdict. That is why these nine and not the other
twenty-six.

| file | arg | verdict | cost |
|---|---|---|---|
| `engine/exit_codes.js` | `--selftest` | 11 passed, 0 failed | ~0.1 s |
| `engine/model_versions.js` | `--selftest` | 7 passed, 0 failed | ~1.0 s |
| `engine/build_battle_formes.js` | `--check` | 131 previous, 131 derived, no row moved | ~8 s |
| `tests/probe_format_id_derivation.js` | — | 0 live call sites fail to derive | ~24 s |
| `tests/probe_future_scope_readmission.js` | — | all checks passed | ~0.8 s |
| `tests/probe_tag_derivation_without_prose.js` | — | all checks passed | ~0.5 s |
| `tests/probe_rotated_ladder.js` | — | 3 states, 3 answers | ~0.3 s |
| `tests/probe_release_drift_diagnosis.js` | — | 17 of 17 | ~0.1 s |
| `tests/probe_instrument_digest.js` | — | all expectations met | ~1.2 s |

Total added suite cost: **~36 s**, all but 32 s of it in two files.

Three needed an `EXTRA` argument, and in all three cases the argument **is the question**:

- `engine/exit_codes.js` and `engine/model_versions.js` bare are libraries that ask nothing and exit
  0 — the registered no-op `run-all.js` already rates worse than an unregistered check.
- `engine/build_battle_formes.js` bare **rewrites** `data/battle-formes.json`. `--check` derives,
  compares, writes nothing, exits 1 on a moved row.

`plan()` derives `needsSim` from the source, so the six that name `champions_sim` or `SHOWDOWN_PATH`
skip visibly rather than failing when no checkout is present.

### The one that was worth the most

`engine/exit_codes.js`. `tests/run-all.js` **requires it at line 40** and reads every child's verdict
through it, so a defect there mis-reports the entire suite at once — a red as a skip, a crash as a
pass. It was landed 2026-09-11 and nothing had run its selftest since.

## 2. NAMED — twenty-six, all in `PENDING_WIRE`

Nothing went into `NOT_A_CHECK`. Every one of the twenty-six really does assert a contract, so
calling any of them "not a check" would have been the move this clause exists to catch.

### 2a. `engine/docs_scan.js` — a runner this suite already reaches

`tests/test-docs-current.js` **requires it directly** (line 68) and is DISCOVERED by the
`tests/test-*.js` glob; that file re-decides `recordableChanges()` and the owed-backlog cap through
this module on every suite run. `--note-check` has a second runner in `.githooks/pre-commit`. Wiring
it here buys a second execution and a second place for one verdict to be decided — the
`engine/derive_protocol_events.js` reasoning, applied to a second file.

### 2b. Five that play games or read the real store **through a child process**

The derived PENDING-WIRE rule cannot see these: the `require` is in the child, so the file itself
loads no game module. This is the `tests/probe_amf_default_populations.js` case, four more times.

| file | blocker |
|---|---|
| `tests/probe_corner_arm_measures.js` | spawns a whole `game_differential` run — three pins and hundreds of games. Has a `VERIFIED BY:` marker. |
| `tests/probe_state_void_exclusion.js` | same spawn. No runner anywhere. |
| `tests/probe_state_credit_red.js` | spawns `all_mechanics_fire` children at 6 GB heap, 900 s timeout; release-pinned. No runner anywhere. |
| `tests/probe_protect_amplification.js` | spawns `game_differential` through `tools/lownode.cmd` for a trace dump. No runner anywhere. |
| `tests/probe_usage_regulation_pool.js` | **fixable, see §4.** Reads the real ladder store and THROWS on ENOENT instead of exiting 2. |

### 2c. Twenty that play a game and have no ledger row

Each loads `champions_sim`, `medicham2-browser`, `staged_board`, `_live_release` or
`engine_release`. They are **hand** entries only because the derived rule needs BOTH halves — a game
module AND a backticked name in `docs/ENGINE.md` — and **no ledger row names any of these twenty**.

    probe_accuracy_roads          probe_ally_safeguard           probe_apparent_type_broadcast
    probe_berserk_switcheroo      probe_corpse_priority_galewings probe_disguise_crit
    probe_heal_bell_party         probe_heldout_board_partings   probe_mental_herb_update
    probe_metronome_game          probe_pivot_magic_bounce       probe_protect_stall_lifecycle
    probe_refill_second_wave      probe_resist_berry_resolved_type probe_spread_item_order
    probe_spread_target_die       probe_stat_pick                probe_status_blocksstatus
    probe_thaw_after_secondary    probe_weather_forme_faint

**Three** (`probe_accuracy_roads`, `probe_disguise_crit`, `probe_protect_stall_lifecycle`) carry a
`VERIFIED BY:` marker and are reached by `engine/register_reality.js`. **Seventeen are reached by
nothing** — verified by scanning every file under `engine/`, `tests/`, `build/`, `tools/` and
`.github/workflows/` for a reference within 250 characters of a spawn/exec/require, and by checking
`docs/ROADMAP.md`'s marker lines. That distinction is stated per entry, never shared, because
"covered elsewhere" read where "covered nowhere" is true is how a check goes missing.

**THE OWED WORK IS ENGINE'S, AND IT IS ONE LINE EACH.** A `docs/ENGINE.md` row naming the probe in
backticks moves it into the derived class automatically and the hand entry goes. MEASURE did not
write those rows: describing what an ENGINE probe measures, in ENGINE's ledger, from a header read
once, is exactly the typed-prose failure this repository keeps paying for.

## 3. No check went RED when it finally ran

Nine ran for the first time and all nine were green. That is a weaker result than a red would have
been — a red is a finding — and it is the honest one.

**One red is on the board and it is NOT mine and NOT real.** `tests/test-claim-truth.js` exits 1 in
this worktree with two FALSE `NAMES-A-PATH` claims, both in
`tests/test-effective-identity.js:DECLARED`, both asserting `data/games.ladder.jsonl`. That file is
untracked and therefore absent from a worktree; it is **494 MB and present in the main checkout**,
so the claims are true where the suite actually runs. My twenty-six new entries produced **zero**
false claims. Re-run `tests/test-claim-truth.js` from the main tree to confirm.

## 4. The one real defect found on the way

`tests/probe_usage_regulation_pool.js` reads the gitignored ladder store and **throws `ENOENT`
(exit 1)** when it is absent, instead of exiting 2. Wiring it as it stands would turn the suite red
on any checkout without the store — a missing input reported as a broken check. The fix is
`engine/validate_selfplay.js`'s guard: absent store → print the reason, exit 2 (SKIP). Once it has
that, it should be wired: the question it asks is that `data/meta-usage.json` may pool two
regulations under one label, and CHOMP reads that file.

## 5. What is still owed

- **20 `docs/ENGINE.md` ledger rows** (§2c) — ENGINE's, one line each, and each one deletes a hand
  entry from `tests/run-all.js`.
- **1 guard** (§4) — `probe_usage_regulation_pool` exit 2 on an absent store, then wire it.
- **4 heavy probes** (§2b) need a home that is not the suite, the same open question
  `engine/register_reality.js`'s own entry carries.
- **`node engine/status.js --write` is NOT run**, per the standing constraint that a worktree writes
  the absence of untracked files as fact. It is owed from the main checkout.

## 6. Commands

```bash
node tests/run-all.js --coverage          # the clause alone, no child, ~1 s
node tests/run-all.js --list              # shows every EXTRA argument binding actually fired
node tests/run-all.js --only exit_codes,model_versions,build_battle_formes,probe_format_id,\
probe_future_scope,probe_tag_derivation,probe_rotated,probe_release_drift,probe_instrument_digest
```
