# `open_work.js` under Reg M-C — 2026-09-29 (ENGINE, abra/regmc 1.25.1)

## Verdict

Fixed. `ABRA_REGULATION=regmc node engine/open_work.js` exited 1 on the artifact seam's write guard; it now
exits 0 and writes `data/open-work-regmc.json`. The plain run still exits 0 and writes `data/open-work.json`.
The fix is a declaration, but it was decided from the inputs, not from the refusal's suggestion, and the same
decision moved two more files.

## What `open_work.js` is built from

| input | regulation? | why |
|---|---|---|
| `docs/ROADMAP.md` (the register) | shared | one register; the Reg M-C gate (`quarantine.js`) reads the same file |
| `quarantine.js` closed/broken detectors | shared | code, no artifact |
| `data/interaction-matrix.json` (the "measured but unregistered" half) | **per regulation** | `tests/test-interaction-matrix.js` stages carrier x reactor pairs against the regulation's Showdown checkout |
| `docs_scan.owedReport()` | shared | printed only, not stored in the artifact |

So the artifact's content depends on the regulation, and it is per regulation. Before the fix the matrix was
undeclared, so a Reg M-C run read Reg M-B's matrix as its own. `ABRA_REGULATION=regmc node engine/status.js`
printed `interaction matrix: 1642/1642 ... (2026-08-11 18:00)`, a Reg M-B figure on a Reg M-C screen.

## The change

- `engine/regulation.js` `PER_REGULATION_ARTIFACTS`: `open-work.json`, `interaction-matrix.json`, `provenance-stamp.json`.
- `engine/open_work.js`: output and matrix named through `REG.artifactFor`, so the printed path is the written
  path. `regulation` is stamped in the artifact. An absent matrix gives `counts.measured_disagreements` and
  `counts.unregistered` as `null` (was 0), `instruments[0].present: false`, and the line
  `NOT MEASURED  MEASURED BUT UNREGISTERED  (data/interaction-matrix-regmc.json is absent for regmc -- ...)`.
- `engine/docs_scan.js` `isArtifactRel`: strips a `-<id>` suffix before the not-an-artifact check, so the Reg M-C
  copy of the register cannot vouch for a figure (the loop that comment describes).
- `engine/status.js`: the absent-matrix line names the regulation's path.
- `tests/test-regulation-artifacts.js` part 2 maps the three names (moved under regmc, identity under regmb).
- None of the three files is a gate input: `quarantine.js` reads none of them.

## The class: every state printer checked

| tool | writes under `data/` | under regmc before | now |
|---|---|---|---|
| `engine/open_work.js` | `open-work.json` | **crash, exit 1** | `open-work-regmc.json`, exit 0 |
| `engine/status.js` (+ `--write`) | none; `--write` stamps `docs/*.md`, which the guard does not cover | exit 0, printed Reg M-B's matrix line | matrix line NOT DERIVED with the M-C path |
| `engine/provenance.js` (spawned by `status.js` with env inherited) | `provenance-stamp.json` | refused, caught: `(could not write the ratchet stamp: regulation: REFUSING ...)`; ratcheted the M-C view against M-B's baseline | writes `provenance-stamp-regmc.json`; verified no refusal |
| `engine/register_reality.js` | `register-reality.json` | already declared | unchanged |
| `engine/where.js`, `engine/orient.js`, `engine/coverage.js` | none | ran, no refusal | unchanged |
| `engine/engine_release.js census --write` | `release-census.json` | refuses (uncaught) | **not changed**: the census reads releases and engine source only, so it is regulation-neutral; run it plain |
| `tests/test-docs-current.js` | `docs-currency-baseline.json` via `docs_scan.writeThrough` | would refuse | **not changed**: a docs gate, run plain; under regmc it would read artifacts through the seam, which is the wrong question |

Why `provenance-stamp.json` is per regulation: under the seam a Reg M-C process reads each declared
`data/<name>` as its `-regmc` sibling, so provenance's graph (and the verdicts `status.js` consumes by the
unsuffixed name) describe the Reg M-C files. The ratchet built over that view is a Reg M-C ratchet.

## Proof

| run | exit | wrote |
|---|---|---|
| `ABRA_REGULATION=regmc node engine/open_work.js`, before | 1 | nothing (REFUSING `data/open-work.json`) |
| same, after | 0 | `data/open-work-regmc.json`: `regulation: regmc`, 585 rows, 200 open, 19 asserting breakage, matrix `present: false` |
| `node engine/open_work.js`, after | 0 | `data/open-work.json`: `regulation: regmb`, 585 / 200 / 19, 0 unregistered, matrix present (48.4 days old) |
| `ABRA_REGULATION=regmc node engine/provenance.js`, after (worktree) | 1, as before | `provenance-stamp-regmc.json`, no refusal. The exit 1 is `hardCites` (published figures citing releases that are untracked and absent in a worktree), the same before and after. The worktree file was deleted, not committed. |
| `tests/test-regulation-artifacts.js` | 0 | 31 ok |
| `tests/test-regulation-runtime.js`, `-table.js`, `-steering.js` | 0 each | |
| `tests/test-docs-current.js` | 0 | 39 passed, 0 failed (re-run after merging main at `710ea7a8`) |

All runs were plain `node`: this harness refuses `cmd /c tools\lownode.cmd`. No game, gate or differential was run.

## Not fixed, reported

- `node engine/orient.js` exits 1 under either regulation: "1 COULD NOT: THE MODELS". Not regulation-related. It
  was seen in the worktree and not investigated.

## OWED, NOT RUN

```bash
# the Reg M-C interaction matrix does not exist; until it does, open_work's measured half is NOT MEASURED under regmc
ABRA_REGULATION=regmc node tests/test-interaction-matrix.js --full
# the first Reg M-C provenance ratchet: run in the MAIN checkout (a worktree lacks the releases), then commit the sibling
ABRA_REGULATION=regmc node --max-old-space-size=4096 engine/provenance.js
git add data/provenance-stamp-regmc.json
# commit the Reg M-C work list from the main checkout
ABRA_REGULATION=regmc node engine/open_work.js
git add data/open-work-regmc.json
```
