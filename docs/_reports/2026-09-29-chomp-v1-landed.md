# CHOMP v1 lands on main (abra/regmc 1.25.0)

2026-09-29 · SOLVER · historical findings record, not a living document. No game was played for this report; every
figure below was read from a file that another run wrote on 2026-09-26/27.

## 0. Verdict

- **Landed.** CHOMP v0 and v1 (`solver/chomp/`, `solver/chomp/v1/`) are merged onto main from branch
  `worktree-agent-a1d0f3564f3c6d52c` (head `760565a9`). ROTOM `--preview chomp` serves v1.
- **The default preview did not change.** `--preview` defaults to `policy`, and no file in `solver/rotom/arms/` selects
  CHOMP. A ladder run clicks CHOMP only if Will's command adds `--preview chomp`.
- **Gate (b) passes against the human-modal preview; gate (c) shows no edge over the humans' own bring.** Details in §2.
- The 1.24.1 note from `adaptive-clock-options` (`6f688ce1`) is merged too. Only its note and documents came across,
  because that commit contains nothing else.

## 1. What was merged

| commit | what |
|---|---|
| merge of `origin/adaptive-clock-options` | CHANGELOG-REGMC 1.24.1, its RUNNING-NOTES row (put under 1.24.2), the SOLVER ledger line, the adaptive-clock report §8, and a LOG line. Only conflict: RUNNING-NOTES, where both rows were kept |
| merge of `origin/worktree-agent-a1d0f3564f3c6d52c` | `solver/chomp/**`, `solver/chomp/v1/**` (model, preregistration, specs), `solver/arena/{arena,teams}.js`, `solver/mew/play.js` (a spec's `preview`), `solver/rotom/{policy,request,rotom}.js` (the `--preview chomp` hook), `solver/tests/test-chomp{,1}.js`, the v0 and v1 reports. Only conflict: RUNNING-NOTES. The branch's two `[Unreleased]` rows were dropped and replaced by the 1.25.0 row, as the v0 merge did before |
| edits in the same commit | the stale "CHOMP v0 first" comments in `rotom.js` and `policy.js` now say v1; `solver/results/2026-09-27-chomp-v1/` (the three result JSONs plus a derived `provenance.json`); CHANGELOG-REGMC 1.25.0; the RUNNING-NOTES row; `docs/SOLVER.md`; the CHOMP row in `solver/PLAN.md`; `solver/LOG.md` |

No `engine/` byte changed. The branch's code was frozen at `760565a9` before the gates ran: no file under the branch
worktree's `solver/` or `docs/` is newer than that commit, and the served model's sha256 on the branch disk
(`7dfc0d81…`) is the same as the committed model's.

## 2. The gate figures, each read from its JSON

All runs used release `eaa5becc54eb`, `--info honest`, gen5 (1,000 ms) on both sides, `--cap 50`, and team store
`C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc` (file sha256 `a68263bb…`, pool digest `792daded…`).
The gates were pre-registered in `solver/chomp/v1/preregistration.json` (`gate_b`, `gate_c`).

| gate | file (tracked copy) | read |
|---|---|---|
| (a) held-out Δlog-loss vs the human-modal bring | `solver/chomp/v1/model/chomp1.metrics.json` | −0.0203 [−0.0309, −0.0108], n = 3,119, PASS (branch report §3) |
| (b) screen, 100 pairs, seed 61, 3 shards | `solver/results/2026-09-27-chomp-v1/screen-vs-hprior.json` | 125–75, **0.625 [0.556, 0.689]**, bar ≥ 0.500, **PASS** |
| (b) SPRT vs `gen5-hprior`, elo0 0, elo1 +20, α = β = 0.05, seed 67, 3 workers | `…/sprt-chomp1-vs-hprior.json` | **H1 at 524 games (262 pairs)**, 294–230, **0.561 [0.518, 0.603]**, LLR 3.019 against a bound of 2.944, 0 errored pairs. The interval is at a data-dependent stop, so it is slightly optimistic |
| (c) vs `gen5-human` (the humans' own recorded bring for that pair), 200 pairs, seed 71, report-only | `…/gatec-vs-human.json` | 188–212, **0.470 [0.422, 0.519]**, 400 games |

**What gate (c) says.** CHOMP v1 beats an opponent-blind bring: the most common bring for its own sheet. It does not
beat the bring a human picked after seeing that particular opponent. The point estimate is below 0.5 and the interval
includes it. Gate (c) was pre-registered as report-only, so it does not block promotion. It is still the honest ceiling
on what this lands: **no clear edge over human bring choice.**

**What ROTOM clicks today** is the pool team's single recorded human bring (`policy.js` `preview`: `teamBring`). That
bring is fixed per team and does not depend on the opponent. It resembles the SPRT's Y (the human-modal bring, also
opponent-blind) more than gate (c)'s Y. That is an analogy and has not been measured. No arena run has played CHOMP
against ROTOM's exact ladder preview.

**Counters.** CHOMP made the X preview in every game: 200 in the screen, 538 in the SPRT including the 14 played after
the stop, and 400 in gate (c). `chomp1Failed` is 0 in all six screen and gate (c) shard summaries. The SPRT rows carry
`preview.x.arm = chomp1` on 538 of 538. In-battle search had 0 fallback decisions in the screen and **1 of 7,360** in
gate (c) (shard 2). The unfilled-cell share was at most 0.00047. XATU `back_error` was 0. `backNone` counts worlds with
nothing hidden, so it is not a fallback (`solver/xatu/worlds.js`, the `else` at the end of the hidden-fill branch).

`provenance.json` was derived by a one-off script. It holds each shard's argv, release, pool receipt, counters and
shard sha256, and the sha256 of the model and of the preregistration.

## 3. Tests

On the merged tree, each run through `cmd.exe /c tools\lownode.cmd`. The output was read, not only the exit code.

| test | result |
|---|---|
| `solver/tests/test-chomp1.js` | GREEN 32/32. All 6 deliberate breaks RED (leads, sign ×2, lpdual, bo3, `CHOMP_VERSION=v0`) |
| `solver/tests/test-chomp.js` | GREEN 36/36. All 4 breaks RED (memokey, back, lpdual, posmap) |
| `solver/tests/test-rotom.js` | GREEN 105/105 |
| `solver/tests/test-rotom-ladder.js` | GREEN 114/114. **The first run was RED 110/114**: `data/releases/eaa5becc54eb` is gitignored and was not in this worktree. After copying it from the main checkout (untracked, byte copy), the run was green. This is an environment gap in a fresh worktree, not a code defect |
| `solver/tests/test-arena.js` | 15/15, SEAT break RED (run as well, because `solver/arena/arena.js` changed) |
| `tests/test-docs-current.js` | 39 passed, 0 failed |

The pre-commit hook also ran on the commit.

## 4. What this does not claim

- **v1 vs v0 was never played.** The M8 exit test (`solver/PLAN.md` §3, "CHOMP v1 beats v0") is not run. v0 against the
  same human-modal Y read 0.485 (inconclusive) in a different harness, so the two figures are not comparable.
- **Nothing was played on the ladder.** Ladder strength is unknown.
- **No bo3 arena exists.** The bo3 adjustment is tested only in its own table.
- The old `engine/` preview files (`slowking_preview.py`, `jolteon.py`, `chomp_ev.js`, `chomp-predict.js`) are
  archived at the **M4 exit** (`solver/PLAN.md` §8). M4's exit test includes the ladder burn-in, so they were **not**
  archived here.

## 5. Debris noticed, not touched

- The branch worktree `.claude/worktrees/agent-a1d0f3564f3c6d52c` still holds `solver/out/chomp/v1/` (gitignored,
  including the gen shards and the SPRT shards). Left in place.
- `solver/out/chomp/v1/gate_c/` in that worktree is an empty directory next to the real `gatec/`. Left in place.

## OWED, NOT RUN

```
REM 1. CHOMP v1 vs v0, the M8 exit test (no pre-registration exists yet: write one before the first game; one worker)
tools\lownode.cmd solver\machamp\sprt.js --release eaa5becc54eb --x solver/chomp/v1/specs/gen5-chomp1.json ^
  --y <a gen5 spec with "preview": "chomp" (v0)> --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 ^
  --seed <new> --workers 3 --info honest --team-store data/team-pool-frozen-regmc --out solver/out/chomp/v1/sprt/chomp1-vs-v0.json

REM 2. CHOMP vs ROTOM's own ladder preview (the pool team's single human bring): needs an arena arm that serves teamBring;
REM    not built. Until then the SPRT's human-modal Y is the proxy.

REM 3. Putting CHOMP on the ladder is WILL'S CALL. It is one flag on his usual ladder command:
REM    ... solver\rotom\rotom.js --ladder ... --preview chomp
REM    (a per-arm preview, for a ladder A/B of CHOMP against the team's own bring, does not exist; ROTOM's --preview applies to every arm)

REM 4. From the main checkout, not a worktree:
node engine/status.js --write
```
