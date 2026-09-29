# 2026-09-29 — orient.js THE MODELS: reads the solver registry (abra/regmc 1.25.2)

## Verdict

Fixed. `node engine/orient.js` exits 0 again: 8 of 8 sections, 20 models, one for every row of the
`solver/PLAN.md` §2 registry. `node tests/test-orient.js` is GREEN and all six `ORIENT_BREAK` knobs are
still red. No published figure moves, so this is a PATCH.

## Cause

Section 5 of `engine/orient.js` parsed `docs/MODELS.md` for two shapes:

- a `**Job:**` line under an ALL-CAPS `## CODENAME` heading
- a row of the per-turn pipeline table (`| 3 | **MILTANK** | ... |`)

The Reg M-C 1.0.0 docs fold-in (`ccf447fc`, "Docs fold-in (b) for abra/regmc 1.0.0") rewrote
`docs/MODELS.md`. It now has mixed-case headings (`## MAG v1 and DODUO v1 — ...`), no `**Job:**` lines and
no pipeline table, and it points at `solver/PLAN.md` §2 as the full registry. Neither shape matched, so the
section found 0 models and called `fail()`. That exit 1 is correct behaviour for a source that has moved.
The 1.25.1 row records orient.js as "checked and not changed", but it checked the per-regulation write
guard, not this section.

## Fix (the parser side, not the document)

Section 5 now reads the **Model registry** table in `solver/PLAN.md` §2, which CLAUDE.md names as the
Reg M-C model registry:

- The heading is found with `/Model registry/i` through the existing `mdSection` helper.
- The `Name` and `Role` columns are located from the header row, not by position.
- A model's name is the first ALL-CAPS token in the Name cell. `**MAG** (= MAGNEMITE)` reads MAG and
  `**The live client** (ROTOM)` reads ROTOM.
- Only the Role column is printed. Status, test and baseline are state, and they are not read.
- The fail paths are: file unreadable; no `## ` heading matching /Model registry/; no `Name`/`Role` header
  cells; 0 parsed rows. Each prints `CANNOT DERIVE: THE MODELS` and exits 1.
- A row with no ALL-CAPS name or no role is printed as unclassified, never dropped.

No list of models is written anywhere, and `docs/MODELS.md` is not edited. The header comments of
`orient.js` now name the registry as a declared-registry source. The output strings that
`tests/test-orient.js` matches (`N models carry a question`, `CANNOT DERIVE: THE MODELS`) are unchanged,
so the test needed no edit.

## Proof

| run | result |
|---|---|
| `node engine/orient.js` before the fix (main `d8515ccf`) | exit 1, `CANNOT DERIVE: THE MODELS — no model heading carried a **Job:** line or a pipeline-table row` |
| `node engine/orient.js` after the fix | exit 0, `ORIENT: 8/8 sections derived`. 20 models: MEDICHAM, MAG, DODUO, PORYGON2, SLOWKING, MILTANK, XATU, GARY, HYPNO, DUSK, MEW, MACHAMP, WOBBUFFET, CHOMP, JOLTEON, GURU, DITTO, ROTOM, ALAKAZAM, KADABRA. That is all 20 registry rows, with 0 unclassified |
| `node tests/test-orient.js` | GREEN, exit 0. `5 divisions, 82 modules downstream, 20 models`; all six `ORIENT_BREAK` knobs exit 1 and name their section |
| Break 1: rename `## 2. Model registry` to `## 2. Models` in `solver/PLAN.md` | orient.js exit 1, `CANNOT DERIVE: THE MODELS — solver/PLAN.md has no ## heading matching /Model registry/`. test-orient exit 1 (`exited 1 on the real repo`, `derived 0 models`) |
| Break 2: rename the header cell `Role` to `Job` | orient.js exit 1, `CANNOT DERIVE: THE MODELS — the registry table has no Name and Role header cells` |
| Restore `solver/PLAN.md` from its copy | orient.js exit 0, and `git status` shows `solver/PLAN.md` clean |

## Limits

- This is still a parse of a markdown table. If the §2 heading or the `Name`/`Role` header cells are
  renamed, the section fails by name. It does not print a shorter list without saying so.
- `docs/MODELS.md`'s "registry at a glance" table is not cross-checked against PLAN §2. It is already
  behind PLAN on some rows, for example MAG "per-slot action scorer v1" against PLAN's "v2: dead-click
  gate". That is owed to the next major docs pass. It is not a problem for orient.js.

## Landed

`engine/orient.js`, `CHANGELOG-REGMC.md` [1.25.2], `docs/RUNNING-NOTES.md` row (`**Basis.** unchanged`),
`docs/REGULATION-ROTATION.md` row, `solver/LOG.md` line, and this report.

## OWED, NOT RUN

```
node engine/status.js --write        # from the main checkout, not this worktree
```
