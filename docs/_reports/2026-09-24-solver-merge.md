# Solver merge into main — 2026-09-24

Merge coordinator. Seven branches, one at a time, in main (`C:\Users\willj\Projects\Pokemon\ABRA`). Every merge was
`git merge --no-ff --no-commit`, then conflicts resolved, then the branch's tests and `tests/test-docs-current.js`
on main, then commit (pre-commit hook green every time, never `--no-verify`), `git pull --rebase=merges`, push.
Historical record; not maintained.

## Start state

- `main` at `3c9085d7` (abra/regmc 0.112.1). No rebase in progress.
- **The tree was not clean.** `solver/LOG.md` held the coordinator's uncommitted 2026-09-24 section (61 lines), and
  seven untracked files existed: `docs/SOLVER-PLAN.md`, `data/engine-release-regmc.json` (+ a `.tmp8920`),
  `data/roster-regmc.json`, three `data/roster.*.prev-regmc.json`. None was touched by any branch except `solver/LOG.md`,
  so the LOG edit was backed up and stashed (`git stash`, "coordinator WIP solver/LOG.md, held during solver merge")
  and folded back in at the end (below). The untracked `data/` files were left alone and are still untracked.

## What merged

| # | Branch (tip) | Landed as | Conflicts and how resolved | Tests on main |
|---|---|---|---|---|
| 1 | `worktree-agent-a142c8ae14d6ae515` (b93c9797) — `norm()` / `_shadowId` memo | **0.112.2** (was 0.108.1), PATCH | ledger/changelog/notes heads: branch block on top, renumbered | identity differential, below |
| 2 | `worktree-agent-ae26f145ebead8fac` (76883f3f) — MAG v1 + DODUO v1 | **0.113.0** (new rows; branch had none) | none | `test-mag-doduo` 3,826/3,826 |
| 3 | `worktree-agent-aae6baa63246ab32f` (d9be8073) — XATU v1 | **0.114.0** (new rows) | none | `test-xatu-api` 6,335, `-bring` 33, `-sd` 584, `-selfplay` 6, 0 failed |
| 4 | `worktree-agent-a849abbf8c6348200` (562dc055) — SLOWKING v1, MILTANK v1, arena | **0.115.0** (new rows) | carried a cherry-pick of the API commit (43053310 = main's 8ae6561a, merged at 0.95.0). All 9 conflicted files from that commit taken as main's bytes (`--ours`): engine, `medicham_api.js`, `engine_release.js`, ledgers, changelog, notes, the API report. The staged diff against main then held no engine/test/ledger change. `solver/LOG.md`: both blocks kept | `test-slowking` 1,559/1,559, `test-miltank` 3,414/3,414, `test-arena` 15/15 |
| 5 | `playout-speed` (eaf93368) — worker pool, playout fixes | **0.116.0** (new rows) | none (stacked on 4) | `test-playout-speed` 1,184/1,184, miltank, arena, slowking green |
| 6 | `worktree-agent-a48f2802cb3153322` (9fa55fa5) — lean mode | **0.116.1** (was 0.111.3), PATCH | carried cherry-picks of the memo and the four playout-speed commits. Proof of no duplicate code: each auto-merged file (`medicham2-browser.js`, `medicham_api.js`, `tags.js`, `tests/medicham_api_diffhook.js`) and the resolved `solver/miltank/rollout.js` equals main's file with exactly the lean commit's diff (`9fa55fa5^..9fa55fa5`) applied, line endings aside. Docs: main's side kept, and only the lean commit's own added blocks inserted, renumbered | lean test + identity differential below; playout-speed, miltank, arena, `tests/test-medicham-api.js` (Reg M-C) green |
| 7 | `worktree-agent-aa8012f2866b8d4dc` (0639653a..91230995) — Supreme Overlord `fallenundefined`, Revival Blessing / Leppa order | **0.117.0, 0.118.0, 0.118.1, 0.119.0** (were 0.113.0, 0.114.0, 0.114.1, 0.115.0) | `MEDSEEN` / `MEDFAILS` declarations: lean made them `let`, the branch added one key to each (`reviveAppliedAfterUpdate`, `reviveDeferredLost`). Resolved to `let` + the branch's keys; checked that nothing else on either line differs | both probes + differential below |

Branch 6's merge had to be redone once by `pull --rebase=merges` (the bot pushed `b9be7dae`, data only); the resolved
files were re-taken from the first merge commit `97f7a568`. One cosmetic line in `docs/_reports/2026-09-24-lean-mode.md`
was lost in that replay and was restored in the narration merge commit (46a27f8c).

## Engine identity proofs (Reg M-C only; Reg M-B is retired)

All runs: `ABRA_REGULATION=regmc`, through `cmd.exe /c tools\lownode.cmd`, flags
`engine/game_differential.js --steering empirical --arm middle --end-state --census
data/verification/census-pin-regmc-ccd979c30997.json --team-store data/team-pool-frozen-regmc --games 1200 --write
--out <scratch>`, with `MEDI_SAMPLE_DUMP` per game. The census pin is the one `data/game-differential-regmc.json`
names. Releases were cut on main's live tree immediately before and after each engine merge.

| Merge | Before release | After release | Per-game `MEDI_SAMPLE_DUMP` rows | Artifact differs in |
|---|---|---|---|---|
| 1 memo | `11a681c6a683` | `eff9468cefc0` | **955 / 955 identical** (config, seed, turns, lines, divergence, board result, trace digest) | release id, cut time, two source digests, `generated`, `elapsed_s` |
| 6 lean | `eff9468cefc0` (re-cut on main before the merge: same id, so merges 2–5 moved no engine byte) | `7403f5d61204` | **955 / 955 identical** | the same fields plus the `medicham_api.js` digest |
| 7 narration | `7403f5d61204` | `21d6c31b6ab1` | same 955 games drawn; 952 identical, 3 with a changed stream; protocol divergences **3 → 0**; board partings **0 → 0** | expected: this branch changes narration |

Branch 7's own artifact (release `aed9780fc4e3`, its tree) read 955 games, 954 never board-diverged; the merged-engine
run reads the same (954 of 954 counted, 0 narration at 1200), so the fix carries onto the merged engine.

`solver/tests/test-lean-mode.js --release 7403f5d61204 --games 1200` (census pin and pool as above): **PASS**. Lattice:
955 games' fingerprints byte-identical under the hook; 22,283 lean turns, 22,283 agree, 0 disagree, 0 untranslated.
Human sheets: 300 games, 2,518 turns, all agree, 300/300 winners equal. Red arm `MEDI_LEAN_BREAK=1`: red on both
(102 and 383 lean turns differ).

Branch 7 probes (`--regulation regmc`): `probe_fallen_undefined.js` green, `probe_regmc_revive_leppa_order.js` green,
and with `MEDI_REVIVE_HEAL_INLINE=1` it exits 1 as it must.

## Tracked model files (all under 20 MB)

`solver/mag/model/mag-v1.json` 1.5 MB, `solver/tests/fixtures/mag-doduo-v1-agree.json` 0.9 MB,
`solver/mag/model/doduo-v1.json` 0.46 MB, `solver/mag/model/mag-doduo-v1.metrics.json` 0.18 MB,
`solver/xatu/model/bring-v1.json` 10 KB. `solver/out/` stays ignored (`solver/.gitignore`). Nothing flagged.

## Final pass

- `solver/LOG.md`: the coordinator's stashed 2026-09-24 section restored verbatim (stash content checked equal to the
  backup first), with one "Landed in main" entry on top; the branch rows kept below it.
- `docs/SOLVER-PLAN.md` (version 0.2.0; **still untracked**, see the red list): status column "v1 built" for MAG, DODUO,
  XATU, SLOWKING, MILTANK; summary "Done" and "Blocking" rows updated (the API was merged at 0.95.0). **Will's CHOMP
  decision applied**: new CHOMP registry row (team-preview solver in `solver/chomp/`, both open sheets → mixed strategy
  over the 90 bring/lead options, scored by PORYGON2, solved by SLOWKING; old CHOMP repo reference only); JOLTEON
  demoted to CHOMP's optional pre-screen; DITTO depends on CHOMP; M4 and M8 rewritten; archive rows; a preview stage
  added to the Appendix C flow.
- `node engine/status.js --write` from main (through lownode): ledgers restamped.

## Red, owed, or worth knowing

- **`data/provenance-stamp.json` `verified` fell 11 → 3.** Same shape as 0.112.1: the gate artifacts are stamped on
  releases (`78fb4a85b1a0` etc.) that the merged engine no longer matches, because three engine merges landed. It is
  committed as measured. A gate re-read on a fresh release is owed before any gate verdict is quoted for this tree.
- `status.js` printed a **FEATURE SEMANTICS CHECK FAILED** on the old `data/policy-weights.json` (fixture and damage
  table moved). That is the retired Reg M-B MAG, which is being rebuilt; not touched here.
- `status.js` diagnostic: "provenance ratchet tripped" on six `_diag*` files. Pre-existing; not touched.
- The untracked `data/engine-release-regmc.json` pointer now names `21d6c31b6ab1` (the last cut). Releases cut here
  (`11a681c6a683`, `eff9468cefc0`, `7403f5d61204`, `21d6c31b6ab1`) sit under the ignored `data/releases/`.
- The stash entry is dropped after the final commit lands.
- **`docs/SOLVER-PLAN.md` could not be committed.** Staged, it failed `tests/test-docs-current.js` on four clauses:
  its version header defaults it onto the closed abra/regmb line (floor 7.0.0), which also pushes that line's owed
  backlog to 197 of 165 and makes a living document trail the last major; and 44 of its figures carry no trace. The
  edits are on disk only. Tracking it needs a decision: a declared pin/exemption in `data/docs-currency-baseline.json`
  (as `docs/_reports/` has), or an `abra/regmc` line with every figure traced.
