# Docs refresh (b) — the project re-described as the Reg M-C solver; SEARCH renamed SOLVER

2026-09-24. Branch `docs-1.0.0-b`, cut from `origin/draft/regmc-1.0.0` (`09bda887`). Historical record, not
maintained. Part of the abra/regmc 1.0.0 documentation fold-in; the white paper, deck and technical docs are a
separate agent's pass and were not touched.

## Verdict

- Every file in scope now describes Reg M-C, open sheets, the `solver/` rebuild and the model roles in
  `solver/PLAN.md` §2, and leads with the plan: MEDICHAM correct → the solver searches on it → the ladder.
- SEARCH is SOLVER: `.claude/agents/search.md` → `solver.md`, `docs/SEARCH.md` → `docs/SOLVER.md`.
- `tests/test-docs-current.js` 39/39; `tests/test-roadmap-register.js` 3/3; `tests/test-docs-quarantine.js`
  passes. `build/build_pdfs.js --check` lists SOLVER.md as a division ledger (derived from `.claude/agents/`),
  and SEARCH.md is gone from the set. No PDF was built.

## What changed, file by file

| file | change |
|---|---|
| `CLAUDE.md` | New top section *Reg M-B is retired* (Will's decisions, the pipeline, CHOMP and ROTOM, the ladder). New *SOLVER* section under the routing table. Routing row `@search` → `@solver`; ledger list and division names → SOLVER. Dated correction notes (not rewrites) under *What ABRA is*, *The CHOMP loop* and the quarantine graph. `solver/` and `engine/medicham_api.js` added to *Where things are*. |
| `docs/ORIENTATION.md` | Rewritten for the current project. The two CI-generated blocks (FUNNEL, RAWREADERS) kept, labelled as the Reg M-B ladder store `engine/quality.js` reads by default. Previous edition cited at `09bda887`. Unversioned, as before. |
| `docs/SUMMARY.md` | Rewritten as Version 1.0.0, **Line abra/regmc**. Reg M-B edition cited at `git show 1be7343c:docs/SUMMARY.md`. |
| `docs/MODELS.md` | Rewritten as the Reg M-C ledger, Version 1.0.0, Line abra/regmc. The whole Reg M-B edition moved to `docs/archive/MODELS-regmb-7.0.0.md` with an ARCHIVED/SUPERSEDED header; `docs/archive/INDEX.md` regenerated (`build/build_archive_index.js`). |
| `docs/DIVISIONS.md` | Reg M-C graph added above the Reg M-B one (kept); SOLVER row; OPS row loses the live bot; dated notes on the rename and on MAG no longer being the seam. |
| `docs/GLOSSARY.md` | Moved from the pinned 3.71.0 to Version 1.0.0, Line abra/regmc (at the line's floor, which the pin clause allows). New §4b (joint action, top-k joint recall, RM+, successive halving, ε-safe exploitation, per-series residual); four rows in §7 (PRE-GATE, store-only, lean playout, SOLVER); dated notes on the Reg M-B MILTANK and core-count entries; "23 engine files" replaced by a pointer to `SOURCES`. |
| `docs/REGULATION-ROTATION.md` | Dated note under §14 (CHOMP is no longer a downstream consumer); new §15 (the model stack on a rotation); one trap row (renaming a division is not a file move). Stays at 1.0.0. |
| `README.md` | Rewritten around the plan. |
| `.claude/agents/` | `solver.md` new brief (the two dated "one more rule" sections kept verbatim); dated notes in `ops.md`, `measure.md`, `engine.md`; `web.md` names SOLVER. |
| `.claude/skills/abra/SKILL.md` | Routing table and ledger list → SOLVER (+ WEB, which it was missing). |
| `docs/SOLVER.md` | New head and a *Reg M-C solver* section; everything from R20 down kept under *ARCHIVED — the Reg M-B SEARCH ledger*. The GENERATED block was not hand-edited. |

## The rename needed code, and nothing would have caught it

Four places typed the ledger name. Fixed in the same commit:
`engine/status.js` `SECTIONS` key (it IS the ledger's file name; `--write` would have printed
`skip SEARCH.md (not present)` and never stamped SOLVER.md), `tests/test-roadmap-register.js` `LEDGERS` (it
filters missing files silently), a baseline key in `tests/test-docs-quarantine.js`, and the unversioned-exempt
list in `data/docs-currency-baseline.json`. Recorded as a trap row in `docs/REGULATION-ROTATION.md`. Code
comments citing `docs/SEARCH.md` §Rn were left; `docs/SOLVER.md` and `CLAUDE.md` say they resolve there.

## Figures: what was published and what was withheld

- Published, each bound to its CHANGELOG-REGMC entry or a `data/*-regmc.json` artifact: the Reg M-C gate
  readings (1.0.0), MAG/DODUO (0.113.0), XATU (0.114.0), SLOWKING/MILTANK/arena test counts (0.115.0, 0.116.0),
  lean-playout identity (0.116.1). Recall@k and the prior-v0 baselines are fenced readouts from the tracked
  `solver/mag/model/mag-doduo-v1.metrics.json` and `solver/prior/model/prior-v0.metrics.json`, command above
  the digits, run on this branch.
- **Withheld, not captioned:** every MILTANK arena strength figure (e.g. the 1 s and 5 s runs against
  prior-greedy). They were played before release `eaa5becc54eb`, so under CLAUDE.md's quarantine rule and the
  1.0.0 Basis note they may not be quoted until re-run. The brief asked for "PRE-GATE where applicable"; the
  label is used, the numbers are not.
- GURU and human-dataset counts from the 2026-09-23 reports are not restated (no tracked artifact binds them);
  the documents point at the reports.

## Found while checking claims (corrected before commit)

- MILTANK v1 has no successive halving (nothing under `solver/miltank/` implements it) and its world is
  uniform, not XATU's posterior (`solver/miltank/rollout.js` header). The drafts said otherwise; fixed in
  MODELS, SUMMARY, ORIENTATION and GLOSSARY.

## Side effects and owed

- `tests/test-docs-current.js` tightened its ratchet: 378 grandfathered trace entries for the old
  `docs/MODELS.md` retired with the move (`data/docs-currency-baseline.json`).
- `docs/MODELS.pdf` still renders the Reg M-B edition; no PDFs were built, per the brief.
- `node engine/status.js --write` was not run (it corrupts from a worktree). The next run from main restamps
  `docs/SOLVER.md` under its new SECTIONS key.
- `docs/DIVISIONS.pdf` is stale against its source (reported by `build_pdfs.js --check`).
- Not in scope and still naming Reg M-B: the umbrella `../CLAUDE.md` (format line), the white paper, deck and
  technical docs (the other agent's pass).
