# The composition test now asks the narration clause, and the "3 pre-existing failures" were a vintage mismatch

2026-09-04, MEASURE. Owned file: `tests/test-divergence-composition.js`. Nothing committed. No game
played, no artifact written, `engine/quarantine.js` not touched.

## The verdict on the 3, one line each

| pre-existing failure | fixed / hidden / neither |
|---|---|
| `CONTROL — an artifact with NO release stamp is REFUSED` (`ARM_NO_PIN`) | **NEITHER** — already green before the rename |
| `and no composition and no headline are printed beside THAT refusal either` (`ARM_NO_PIN`) | **NEITHER** — already green before the rename |
| `CONTROL — the right POLICY with no team_pool_digest is REFUSED` (`ARM_NO_POOL`) | **NEITHER** — already green before the rename |

They are not an undiagnosed defect. They are the WORKING-TREE test file — written on 2026-09-04
against `engine/pin_guard.js`, which is **untracked and uncommitted** — run against
`git show HEAD:engine/quarantine.js`, which predates the pin guard entirely. Two vintages, one
command. The rename is a no-op for all three arms.

## How that was established, rather than argued

**1. The 3 were reproduced exactly, without touching the tree.** HEAD's `quarantine.js` bytes were
compiled under the real filename (so its relative requires resolve normally), injected into
`require.cache`, and the CURRENT test run against them:

```
  FAIL  CONTROL — an artifact with NO release stamp is REFUSED …
          ok=false withheld=undefined
  FAIL  and no composition and no headline are printed beside THAT refusal either
          composition {"ORDERING":7,"EMISSION":3,"RULE":2}, headline [12,1000]
  FAIL  CONTROL — the right POLICY with no `team_pool_digest` is REFUSED …
          ok=false withheld=undefined why=12 of 1000 = 1.2% DIVERGE …
  3 CHECK(S) FAILED
```

Identical to the three the previous agent named, including `withheld=undefined` and the clause
answering `12 of 1000`. The runner is `<scratch>/run-head-quarantine.js`.

The tree itself was never modified to get this. A **sparse worktree at HEAD** was cut in the
scratchpad first (`git worktree add --no-checkout` + `/engine/ /tests/ /data/*.json`, 79 MB) and
removed afterwards; `git status --porcelain` reads **34 entries before and 34 after**, same
files, same categories. `core.autocrlf` is `true` here, which is why `git stash` was refused as a
method: a stash/pop across 24 modified files owned by other work can rewrite line endings.

**2. The same 3 arms PASS in the working tree BEFORE the rename.** In the 10-red pre-rename run they
are three of the seven PASS lines. A rename cannot fix — or hide — a check that was already green.

**3. Both clauses behave identically on those fixtures, measured on five of them.** `wholeGameDoor`
(`engine/quarantine.js:2131`) is called by `wholeGameClause` (2287) and `narrationVerdict` (2457).
Probed with the test's own fixtures through BOTH clauses:

| fixture | both clauses return | `pins.checked` |
|---|---|---|
| fully pinned `ARM_A` | composes, `withheld` absent | success receipt |
| no `engine_release` + no `source_digests` | `withheld: true` | `["release","digests"]` |
| `engine_release` but no `source_digests` | `withheld: true` | `["release","digests"]` |
| right policy, no `team_pool_digest` | `withheld: true` | `["population"]` |
| no `steering` block | `withheld: true` | `["population"]` |

Same verdicts, same receipts, both callers. So the repoint moves which clause is asked and changes
nothing those three arms assert.

**4. The condition they assert is genuinely true, not merely unlooked-at.** Each refusal names a
DIFFERENT reason (`pins.checked` and `pins.why` differ per fixture) and the pinned control composes,
so the clause is discriminating rather than refusing wholesale.

## The rename, and the one weakness closed while here

`Q.wholeGameClause(` → `Q.narrationClause(` at **5 lines / 7 calls** (127, 169, 192, 203, 229) plus
the `typeof` export guard. A dated block at the top records WHY the file moved: every assertion in it
is about `classes[].causes[]`, which are protocol causes; a board divergence is a leaf PATH and
carries no cause, so there is nothing here the board clause could compose.

**`ARM_NO_PIN` asserted only `ok === false && withheld === true`** — the weakest of the three, and the
one a repoint genuinely could have carried green, because four fixtures in this file are refused for
four different reasons and a bare `withheld` cannot tell them apart. It now also asserts the refusal
NAMES the field the fixture deleted, with the field name **imported** from
`engine_release.STAMP_SHAPE` rather than typed, and that its `pins.checked` differs from the steering
refusal's.

**One new arm: BOTH clauses refuse the unpinned artifact.** That shared door is the property that made
this repoint safe, so it is asserted instead of believed. It asserts the OUTCOME, not the receipt, so
a cosmetic change to either clause is free.

**Shown red on deliberate breaks, both by monkeypatch — no file edited, nothing to restore:**

| break | arms red |
|---|---|
| the pin refusal stops naming its field (still refuses, still withholds, still prints no figures) | **2** — the strengthened pin arm and the `team_pool_digest` arm |
| the board clause stops refusing the unpinned artifact — the door on one caller only | **1** — the shared-door arm |

Scripts: `<scratch>/break1-unnamed-refusal.js`, `<scratch>/break2-one-caller.js`.

**Result: 18 checks, all pass.** Was 17 checks / 10 red.

## One thing the repoint introduced, named rather than left to be found

`narrationClause(artifact)` takes a second parameter, `wgDecisionImpact`, and the test calls it with
one argument. The default reads `data/decision-impact.json` and `data/engine-release.json` LIVE. Today
that is inert — a `cause:` row only CLEARS causes, and the fixtures' synthetic causes match none, so
composition, headline and trend are all untouched. If such a row ever matched, all 12 fixture
divergences would clear, the clause would take its `ok` branch, and the shape line would not be
printed — the arms would go **red and say so**, not silently green. Noted, not defended against: a
fixture-supplied inert DI would need `decisionImpact` exported, and that is ENGINE's file.

# OWED

1. **`engine/pin_guard.js` is UNTRACKED and its integration into `engine/quarantine.js` is
   UNCOMMITTED.** That is the whole content of the "3 pre-existing failures": at HEAD this repository
   really does answer an unpinned, unpooled differential artifact instead of withholding it. The three
   arms are green on the working tree only. Until that lands, a fresh clone is red by three and the
   guard does not exist. Coordinator — not mine to commit.
2. **The previous agent's OWED item 1 is RETIRED** — "a separate undiagnosed defect: an unpinned
   artifact not being withheld" is not a defect in this tree, it is the vintage gap in item 1. Its
   other five OWED items are untouched by this work.
3. **`node engine/status.js --write` was NOT run.** It stamps division ledgers this task does not own
   while a large uncommitted change sits across `data/` and `engine/`. A test repoint changes no
   published figure, so nothing in a `<!-- GENERATED -->` block is stale because of it.
4. **`tests/run-all.js` was not run** — the brief allowed nothing heavy. This file is seconds and is
   green standalone.
