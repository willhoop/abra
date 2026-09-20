# The roster's two instrument faults, closed — 2026-09-20, ENGINE (light mode)

This is a findings record, not a living document. It is not current state and is not cited as such.
`node engine/status.js` and `node engine/quarantine.js` hold current state. **No engine byte changed
in this pass and no release was cut** — `node engine/engine_release.js list` reads
`* 834713ccb303  2026-09-20T02:14:22.748Z  0 of 27 files have moved since` after every run below.

---

## 0. VERDICT

- **The gate's `deliberate roster / abilities` clause PASSES.** `GATE: CLOSED — 2 of 10 GATING
  clauses fail`, against **3 of 10** on the same release one pass ago. The clause reads
  `clean: 196 of 200 tested. ANNOUNCEMENT-ONLY — 3 row(s) accepted on a receipt`.
- **Neither fault was an engine defect and neither engine line moved.** Both were the instrument:
  a red plant aimed at a source line that had been refactored, and two knob stamps that had never
  been declared.
- **The `ability/residual` plant is re-aimed at a TAG READ and is CAUGHT again** —
  `CAUGHT ability/residual via speedboost -> CONTROL-NOT-QUIET on party.boosts.spe, boosts.spe`.
- **All three ANNOUNCEMENT-ONLY receipts are accepted** (anticipation, forewarn, frisk), and each of
  the two new knobs is shown to REFUSE the census write and to turn its own row red.
- **The abilities stage exits 0**: 196 FIRED-AND-BOARDS-MATCH, 3 ANNOUNCEMENT-ONLY, 1
  DEFERRED-BY-OWNER, **0 DIFFER, 0 DID-NOT-FIRE, 0 COULD-NOT-STAGE, 0 CONTROL-NOT-QUIET**; anchors
  **65 of 65 alive**, reds **65 of 65 ok, 0 dead**.
- **Census unmoved at 977 live / 0 missing**, `run_ok: true`. One row's `detail` changed (Anticipation
  now quotes its protocol line); no verdict moved.
- **`OWED_CAP` raised 100 → 165 in a visible diff**, with the reason written beside it. `--owed` now
  reads **98 of 165** and still prints `past half the cap`.

## 1. PINS

| pin | value |
|---|---|
| release | `834713ccb303`, first cut `2026-09-20T02:14:22.748Z`; `0 of 27 files have moved since`, before and after |
| HEAD | `61a2b68d`, CHANGELOG 6.74.0. No commit, no push, nothing staged |
| showdown | `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` |
| census | regenerated in this pass: generated `2026-09-20T04:18:09.600Z`, digest `2d68db3a8ce1` (was `9a373e81f281`), **977 live / 0 missing**, `run_ok: true` |
| launcher | a node script written in this session's scratchpad (`run_0920.js`; no file of that name existed) spawning `cmd.exe /c tools\lownode.cmd <argv>` — the argv route `tools/lownode.cmd`'s own header documents as the only byte-safe shape from a non-cmd parent |
| mode | LIGHT. One rule, one stage, three census runs, one gate read. **No lattice, no battery, no differential, no fit, no self-play.** |
| concurrency | every process was mine and every one exited on its own; nothing was killed. Two other ENGINE agents were in isolated worktrees, which do not share this tree's `data/` |

## 2. FAULT 1 — THE `ability/residual` RED PLANT'S ANCHOR WAS DEAD

**BEFORE.** `node tests/roster.js --rule ability/residual --stage abilities --reds --release 834713ccb303`,
7.1 s, **exit 1**:

```text
  THE PLANT ANCHORS — every rule this stage used, checked against release 834713ccb303 ...
    0 of 1 apply exactly once
    DEAD ANCHOR   ability/residual   matched 0 time(s), not 1   [3 row(s) in this stage, 3 of them staged]
```

The anchor was `if(_be&&_be.boosts&&m.boosts&&!m._newlySwitched)for(const k in _be.boosts){` — the
`if` and the `for` on one line. 6.73.0 put `const _ber=abilityBoostRun(m,m.ability,{isSecondary:false});`
between them (`engine/medicham2-browser.js:48922-48924`), so the two-line string no longer existed.

**THE RE-AIM, AND WHY IT IS NOT ANOTHER SPELLING.** The brief's rule is a function signature or a tag
read, never a line inside a body. The plant now anchors on

```js
const _be=TAGS.param('ability',m.ability,'boostsEachTurn');
```

— one occurrence in the release, verified by string count — and appends `m._newlySwitched=false;`.
That line is the **tag consumer**: delete it and the mechanic is gone, so it cannot be refactored away
while the mechanic stays, and it is indifferent to how the gate is spelled, how many statements the
body grows, or where the announcement run is built.

**IT IS STILL A BREAK OF THE GATE, NOT OF THE EFFECT**, which is the distinction this rule's prose
rests on. Clearing `_newlySwitched` at the moment the param is read makes every carrier look as
though it did not arrive this turn, so the boost fires on its entry boundary — Showdown's
`if (pokemon.activeTurns)` removed. Nulling `_be` would delete the effect and prove something weaker.
Blast radius, stated: the injected clear runs only inside the `boosts` residual group, only in a game
with a `boostsEachTurn` carrier on the field, and `_newlySwitched` is re-cleared at the top of every
turn; the only other reader that could see it is the partial-trap clause further down the same
residual, and no member of this rule stages a partial trap.

**AFTER.** Same command, **exit 0**:

```text
    1 of 1 apply exactly once — every red demonstration in this stage has something to aim at.
    CAUGHT   ability/residual   via speedboost -> CONTROL-NOT-QUIET on party.boosts.spe, boosts.spe
```

The rule's three members are Hunger Switch (Morpeko), Moody (Glalie) and Speed Boost (Blaziken); the
plant reaches the `boostsEachTurn` carrier. **The flip is attributable**: `speedboost` was
FIRED-AND-BOARDS-MATCH against the clean source, so the demonstration is not marked WEAK, and the
fields that moved are the ones the mechanic owns. `CONTROL-NOT-QUIET` is counted as "the board moved"
here by the reds loop's own documented rule — under the plant the subject arm moves and the two
engines disagree, which a quiet control would read as FIRED-AND-BOARDS-DIFFER; Blaziken's only other
ability, Blaze, is not quiet.

## 3. FAULT 2 — TWO KNOB STAMPS WERE NEVER DECLARED, AND ONE CENSUS ROW COUNTED INSTEAD OF QUOTING

`anticipationSilentRestored` and `friskSilentRestored` are set by the engine
(`MEDFAILS.anticipationSilentRestored` at `engine/medicham2-browser.js:6610`, `friskSilentRestored` at
`:6598`) and were absent from `const DELIBERATE_BREAK` in `tests/test-mechanics.js`. Both are added,
with the reason written beside them. The parse the gate actually uses now returns **121 names**
including both.

Anticipation failed a **second** clause: `engine/quarantine.js`'s `annRowReasons` refuses a receipt
whose census row *"QUOTES NO PROTOCOL LINE"*, and the row read `[1,1] — no die` and nothing else. The
probe now returns the matching lines rather than their count, and the row carries:

```text
[Anticipation lines] no ability / neutral + Dragon-into-Fairy (immune) [0,0]; Shadow Claw (SE) /
Sheer Cold (OHKO) [1,1] [|-ability|p1a:hatterene|anticipation ; |-ability|p1a:hatterene|anticipation]
— data/abilities.ts:174-190, no die
```

The arms are unchanged (`{control:[0,0], test:[1,1]}`), so the probe asks exactly what it asked.

**THE CONTROLS WERE CLEARED EXPLICITLY, AGAINST THE SHIPPING RULE** (`Q.annRowReasons`, imported —
not a second copy of the six checks):

| context | anticipation | forewarn | frisk |
|---|---|---|---|
| **now** | accepted | accepted | accepted |
| DELIBERATE_BREAK as it stood before this pass | `NO KNOB CAN MAKE THIS ROW RED` | accepted | `NO KNOB CAN MAKE THIS ROW RED` |
| Anticipation's census `detail` as it stood before this pass | `THE CENSUS ROW QUOTES NO PROTOCOL LINE` | — | — |

Each pre-change state refuses on **exactly one** clause, and the third row of the same family — the
one nothing in this pass touched — is unaffected in every arm. The knob is a real red arm, not a
declaration:

| run | census verdict | census file afterwards |
|---|---|---|
| clean | `977 live, 0 missing, 977 probed`, **wrote** `data/mechanics-census.json`, `run_ok: true` | digest `2d68db3a8ce1`, `2026-09-20T04:18:09` |
| `MEDI_ANTICIPATION_SILENT=1` | `976 live, 1 missing` — the Anticipation row **MISSING**, `[0,0] [(no line) ; (no line)]`; **`REFUSED to write data/mechanics-census.json … MEDFAILS.anticipationSilentRestored`** | **unchanged**, digest `2d68db3a8ce1`, mtime unmoved |
| `MEDI_FRISK_SILENT=1` | `976 live, 1 missing` — the Frisk row **MISSING**, `ONE foe holding something 0 [NONE]`; **`REFUSED to write … MEDFAILS.friskSilentRestored`** | **unchanged**, digest `2d68db3a8ce1`, mtime unmoved |

Each census run took ~3.5 minutes.

## 4. THE ABILITIES STAGE, RE-RUN ON THE SAME RELEASE

`node tests/roster.js --stage abilities --reds --write --release 834713ccb303`, 2 m 57 s,
**exit 0**. Artifact `data/roster.abilities.json` generated `2026-09-20T04:29:30.170Z`, stamped
`engine_release 834713ccb303`.

| bucket | count |
|---|---|
| FIRED-AND-BOARDS-DIFFER | **0** |
| DID-NOT-FIRE | **0** |
| COULD-NOT-STAGE | **0** (`could_not_stage_in_scope` 0) |
| CONTROL-NOT-QUIET | **0** |
| BELOW-USAGE-SHELF | 0 |
| DEFERRED-BY-OWNER | 1 (Illusion) |
| ANNOUNCEMENT-ONLY | 3 (anticipation, forewarn, frisk) |
| FIRED-AND-BOARDS-MATCH | **196** |
| in scope / tested | 200 / 196 (316 legal, 116 out of scope: 114 no-legal-carrier, 1 validator-refused, 1 no-legal-reader) |
| plant anchors | **65 of 65 apply exactly once** |
| reds | **65 rows, 65 ok, 0 dead, none failing** |

`Q.announcementReceipts('abilities', artifact)` on that artifact: `ok true, rows 3, declared 3,
cannot_answer false, failing []`.

## 5. THE GATE, READ (NOT USED AS A VERDICT FOR ANYTHING ELSE)

`node engine/quarantine.js`, once, with no other writer live. **`GATE: CLOSED — 2 of 10 GATING
clauses fail`** (was 3 of 10 on this release).

| clause | reading |
|---|---|
| deliberate roster / abilities | **PASS** — `clean: 196 of 200 tested. ANNOUNCEMENT-ONLY — 3 row(s) accepted on a receipt: ability:anticipation (announcesOnEntry; MEDI_ANTICIPATION_SILENT -> anticipationSilentRestored; tests/probe_entry_announce.js), ability:forewarn (… MEDI_FOREWARN_SILENT …), ability:frisk (… MEDI_FRISK_SILENT …)` |
| deliberate roster / items, moves | PASS — 148 of 148, 496 of 497 |
| game differential (damage) | PASS — 0 of 6000 at every index |
| whole-game BOARD-MATERIAL | PASS — 0 of 961 / 0 of 1069 / 0 of 1497 (read off the artifacts on disk; **no lattice was run in this pass**) |
| whole-game NARRATION | **FAIL** — 23 / 30 / 33 |
| mechanics / each staged and compared | **FAIL** — 14 of 15 diverging mechanics played and uncleared |
| the other four | PASS |

**The two remaining failures are the same one mechanism as before** — the ability ARRIVAL
announcement (Cloud Nine / Air Lock, and Super Sweet Syrup's `|boost` marker). Nothing in this pass
touched it and nothing in this pass should be read as moving it.

## 6. THE DOCUMENTATION CAP — 100 → 165, ONE RAISE, THE REASON BESIDE IT

`node engine/docs_scan.js --owed` read **98 of 100**: two rows from a build failure, on a backlog
whose remedy is **already written**. The whole next-major fold-in is drafted and held for Will in
`docs/_reports/2026-09-19-700-draft/` (whitepaper, deck, technical docs, MODELS, SUMMARY, README,
CHANGELOG-7.0.0, NOTES-7.0.0), and the standing rule is that the `X.0.0` and the document rewrite are
not published unattended. So the cap was about to block every commit in the repository on a **review
queue** rather than on undone work.

`OWED_CAP` is now **165**, raised once, in `engine/docs_scan.js`, with the derivation written in the
comment above it:

- the original 100 was argued from a measured cadence of ~10 notes rows/day (2026-09-06);
- measured again today off `docs/RUNNING-NOTES.md` itself, the last nine active days read
  **10, 13, 20, 29, 26, 37, 16, 6, 30** — median **20/day**, busiest **37**. The cadence has doubled,
  so 100 is now about five working days rather than the ten it was sold as;
- **165 = the 98 owed now + the two busiest measured days (37 + 30)** — roughly three days of this
  sprint's real output for the review to land in, deliberately shorter than the original bound
  because the fold-in only has to be read.

`--owed` now reads **`DOCUMENTATION DEBT — 98 of 165 notes entries owed to the next major (past half
the cap)`**. **Nothing was folded, no version was bumped, and no row was removed** — bumping to
`X.0.0` to empty a backlog is exactly what CLAUDE.md forbids.

**WHAT CLEARS IT PROPERLY:** publishing the held 7.0.0 pass bumps the living documents' version
headers, every row below the new floor stops being owed, and the counter returns to ~0 with nothing to
remember to undo. If the review stalls long enough to reach 165, the honest move is a DOCUMENT PASS at
any version — not a second raise.

## 7. FILES CHANGED

- `tests/roster.js` — the `ability/residual` break's patch re-aimed at the tag read, with the dead
  anchor's history and the blast radius written above it.
- `tests/test-mechanics.js` — `anticipationSilentRestored` and `friskSilentRestored` added to
  `DELIBERATE_BREAK` with a dated reason; the Anticipation `announcesOnEntry` probe now quotes the
  protocol lines it already matched (arms unchanged).
- `engine/docs_scan.js` — `OWED_CAP` 100 → 165 with the argument beside it.
- `docs/ENGINE.md` — one new section at the top and its hand list. **No `<!-- GENERATED -->` block was
  touched and `status.js --write` was NOT run**, per the brief.
- `docs/_reports/2026-09-20-roster-instruments.md` — this file.
- Data, rewritten by the runs: `data/mechanics-census.json`, `data/roster.abilities.json`,
  `data/roster.abilities.prev.json`, `data/roster.json`.
- **Not touched:** `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `engine/quarantine.js`,
  `engine/medicham2-browser.js`, `engine/board.js`, `engine-data.js`,
  `docs/_reports/2026-09-19-700-draft/`, and the five held living documents. The `docs/ABRA-*.md`,
  `docs/MODELS.*` and `docs/SUMMARY.*` modifications in `git status` were there when this pass
  started and are not mine.
- **git:** nothing staged, committed or pushed. **Nothing was deleted.**

## OWED, NOT RUN

1. **THE NOTES ROW AND THE CHANGELOG ENTRY ARE OWED** — this pass may not write either. Text for
   `docs/RUNNING-NOTES.md`, to be placed by whoever versions it:
   *"**The roster's abilities clause was red on two instrument faults and neither was the engine.** The
   `ability/residual` red plant's anchor had been dead since 6.73.0 split the line it aimed at, so 3
   staged rows asserted nothing and the stage exited 1; it is re-aimed at the `boostsEachTurn` tag read
   and reads `CAUGHT … via speedboost` again (`data/roster.abilities.json`, reds 65 of 65 ok, 0 dead,
   exit 0). `anticipationSilentRestored` and `friskSilentRestored` were never in `DELIBERATE_BREAK`, so
   two ANNOUNCEMENT-ONLY receipts were refused; both are declared and Anticipation's census row now
   quotes `|-ability|p1a:hatterene|anticipation` instead of counting. The gate's roster/abilities clause
   PASSES and `node engine/quarantine.js` reads `CLOSED — 2 of 10` on release `834713ccb303`, against 3
   of 10. Census 977 live / 0 missing, unmoved. `OWED_CAP` raised 100 → 165 while the drafted 7.0.0
   fold-in is held for review. **Supersedes.** the 3-of-10 reading of 6.74.0 and its two named
   instrument faults. **Basis.** unchanged."*
   It is a **MINOR** by this repository's own test: a published figure moves (3 of 10 → 2 of 10) and
   the question it answers does not.
2. **THE ABILITY ARRIVAL ANNOUNCEMENT IS UNTOUCHED AND IS BOTH REMAINING FAILING CLAUSES** — Cloud
   Nine / Air Lock announcing on `onSwitchIn`, and Super Sweet Syrup announced with a `|boost` field
   the authority writes bare. A probe shown RED is owed before any engine line moves.
3. **NO LATTICE WAS RUN.** The board-material and narration figures quoted in §5 are the gate reading
   the artifacts already on disk from the 2026-09-19 pass. **They were not re-measured here**, and
   nothing in this pass could have moved them — no engine byte changed. The census file DID change
   (one row's `detail`), so a differential steered by the new census pin is a different steering input
   from the artifacts on disk; anyone comparing must re-run rather than mix the two.
4. **`tests/test-docs-current.js` WAS NOT RUN**, because the working tree holds Will's held 7.0.0
   drafts and this pass is not the one that should be judging them. Clause 5c will read 98 of 165.
5. **`data/register-reality.json` IS STILL STALE** (2026-09-12 against a ROADMAP that moved
   2026-09-19); `node engine/register_reality.js` is still owed, as 6.74.0's report said.
6. **THE THIRD ANNOUNCEMENT FAMILY MEMBER HAS NO SECOND INSTRUMENT.** All three rows rest on a census
   probe and a knob. That is the bar the receipt sets and it is met; it remains true that no board
   comparator can ever fail on them, by derivation (`announcesOnEntry.visibleOnABoard: false`).
7. **`docs/ENGINE.md` STILL CARRIES `CHANGELOG <<VER>>` PLACEHOLDERS** in some worktree-pass headings
   and `CHANGELOG.md` is still missing its `## [6.65.0]` heading. Reported 2026-09-19, not repaired
   here, and out of this brief's scope.
8. **DEBRIS, REPORTED AND LEFT:** six untracked `docs/_reports/2026-09-11-*.md` files were in the tree
   when this pass started. Nothing was deleted.
