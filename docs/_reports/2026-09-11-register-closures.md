# 2026-09-11 — Register closures from the planning pass

MEASURE. This is a historical record (see CLAUDE.md on `docs/_reports/`). It is not maintained and is not current state.

This pass edited **`docs/ROADMAP.md` only**, 18 rows. It played no game and did not run `engine/register_reality.js`, `engine/open_work.js` (which writes `data/open-work.json`) or `engine/quarantine.js` (which writes a stamp). It did not commit.

## Verdict

- **11 rows closed**: #218 #289 #300 #301 #314 #315 #319 #413 #438 #439 #542.
- **7 rows edited and left open**:
  - #370 is fixed in code, but the instrument that decides it is red today.
  - #446, #500 and #549 now declare NOT A DEFECT.
  - #364 is unmeasured and now asserts nothing.
  - #412 and #440 have their markers demoted.
- **Open-defect clause, evidence-free (debt): 44 → 32** against today's `data/register-reality.json`. **After the next register pass it reads 34**, because demoting the #412 and #440 markers turns two stale rows into debt, which is where they belong. Rows with a red instrument: 0 before and 0 after.
- **Register: 235 → 224 open of 547.** The open count fell by exactly the 11 closed rows, and 0 rows are UNREGISTERED.
- **Gates:**
  - `node tests/test-roadmap-register.js` is GREEN, 3/0.
  - `node tests/test-register-cell-parse.js` is GREEN.
  - **`node tests/test-docs-current.js` is RED, 36/1, and not because of this pass** (see §4).

## 1. What was read

The plan (`docs/_reports/2026-09-11-plan-register.md`) read HEAD `ea437935` and release `5973a4e3c768`. **HEAD had moved to `b439bc2b` before this pass began**, so every figure below was re-read at `b439bc2b` rather than taken from the plan.

| Input | Stamp |
|---|---|
| `data/register-reality.json` | generated 2026-09-11T07:09:29Z |
| `data/game-differential.json` | 2026-09-11T06:19:32Z, release `2b5a6585d8cf`, middle arm, 961 games |
| `data/roster.moves.json` / `roster.items.json` / `roster.abilities.json` | 06:19:37Z / 06:13:27Z / 06:16:18Z, release `2b5a6585d8cf` |
| `data/all-mechanics-fire.json` | 06:19:39Z, release `2b5a6585d8cf` |
| Engine and test source | `git show HEAD:` |
| Authority | the sibling `pokemon-showdown` checkout, `20ad99f` |

Every artifact was read through `git show HEAD:`. The working-tree copies of `docs/ROADMAP.md`, `data/register-reality.json` and `data/interaction-matrix.json` were confirmed byte-identical to HEAD before the edit.

**Headline figures from `data/game-differential.json` at HEAD:**
- 961 of 961 boards never parted.
- One protocol divergence: `omit-spread`, turn 12, `|upkeep <> |faint|p1a`, preceded by three `perish0` starts.
- 0 void games.
- 42 plants: 42 applied, 42 caught, 42 with `moved_a_compared_leaf` true.
- `planted_state_proof_ok` and `mappings_all_proved` both true.
- `switch_addressing` lookup misses: 0 and 0 over 5,248 switches sent.
- `forced_switch_unmirrorable`: 1 (the plan read 6 on the older release).

## 2. Per-row

Each closed cell keeps its prior cell after `EARLIER STATUS, UNCHANGED:`. That is the house form, and a cell that begins `closed` is read as closed whatever follows it.

### Closed

| Row | Evidence checked on this pass | Marker |
|---|---|---|
| #218 | The gating half landed 2026-08-12. The pool reads 961/961 boards, and its one protocol divergence is #440's closeted line. The marker was green at 07:09:29Z. | `node engine/quarantine.js --whole-game` (already on the row) |
| #289 | The fix is recorded at `tests/test-mechanics.js:30699-30714`, with the `move/boostsTarget` probe at `:30730` (HEAD). The marker was green at 07:09:29Z (on 31 rows). There is no stat-line divergence in the pool. `tests/probe_ability_zero_boost_line.js` was **not run**. | `node tests/test-mechanics.js` |
| #300 | **Static check, which passed** (Appendix A). `let MID_WRAP_ERROR` is top-level statement 44 at `engine/game_differential.js:439`. The catch writes at `:543` and `:550` sit in later top-level `try` statements. No earlier statement touches the name or calls `armClaims`, the one function that reads it. The plan's dynamic arm was not run, because loaded without the `-r ./tests/_live_release.js` preload the driver cuts a real release. | none (the row names no runnable decider) |
| #301 | `switch_addressing` reads 0/0 in the committed artifact, published at `game_differential.js:9378-9381`. The gate is **indirect**: a miss parts a compared board, and `wholeGameClause` is `ok: material === 0` (`quarantine.js`, at HEAD). No clause reads the counter itself. | `node engine/quarantine.js --whole-game` |
| #314 | `applied = truthy && moved` at `game_differential.js:6193`. `all_ok` at `:6217` requires applied, caught, planted-boundary and localised. The artifact matches (the 42 plants above). `quarantine.js:2392` returns CANNOT-ANSWER if either proof flag is false. | `node engine/quarantine.js --whole-game` |
| #315 | Champions `formeChange` (`data/mods/champions/scripts.ts:57`, in the `pokemon:` block at `:44`, under `// Don't revert Mega Evolutions after fainting` at `:55`) sets `formeRegression` only in the Tera branch (`:78`). The revert (`sim/battle.ts:2555-2571`) is gated on that flag. Mainline's setters (`sim/pokemon.ts:1457`, `:1474`) are inside the replaced `formeChange` (`:1433`). MEDICHAM agrees at `medicham2-browser.js:22073` and `:23107`. Species and maxhp are not in `POST_FAINT` (`board_state.js:746`), so they are compared on corpses, and 961/961 agree. **Worded WRONG AUTHORITY, NOTHING TO FIX, deliberately not NOT A DEFECT:** see §3. | `node engine/quarantine.js --whole-game` (pool coverage only) |
| #319 | `roster.moves` reads DIFFER 0, DNF 0, MATCH 487. All five named moves MATCH, and `bigroot` MATCHES in items. The marker was green at 07:09:29Z. | `node tests/roster.js --stage moves` (carried) |
| #413 | The third edit is at `tests/probe_red_demo.js:3149-3165`. The probe exits 1 on HOLLOW (`:4894`). It was green at 07:09:29Z as #273's and #449's marker. | `node tests/probe_red_demo.js` |
| #438 | AMF `magicbounce`: board NO-DIVERGENCE, 5/5 boundaries, no diffs. The Synchronize control agreed on the 4 boundaries it reached before it threw. The marker was green at 07:09:29Z. | `node engine/all_mechanics_fire.js --kind abilities` (already on the row) |
| #439 | Board-material 0/961. The pool's single protocol divergence is #440's. The old `game_differential.js` marker was demoted to `FORMERLY NAMED:`, because that script exits 0 on any divergence (`register_reality.js:149-151`). | `node engine/quarantine.js --whole-game` |
| #542 | Per its own cell: (a) was applied and closed 2026-09-06, (b) was re-filed as #544, and (c) closed 2026-09-05. (d) is absent from the pool, which is not the same as fixed. The probes were **not run**. | `node engine/quarantine.js --whole-game` |

### Left open

| Row | Why it is open, and how the machine now reads it |
|---|---|
| #370 | **Deviation from the plan.** The over-fire is fixed in code: `docs_scan.js:743-759` and `:650`, with spec-2 of `RETRACTION_CASES` at `:794`. The retraction-matcher clause held 7/7 today. **But its decider, `node tests/test-docs-current.js`, exits 1 today on an unrelated clause (§4).** The brief closes only on a green instrument, and a closed row with a red marker reads PREMATURE CLOSE. So the row stays open with the marker kept, and it closes on that file's first green run. The 2026-08-23 cell, which carries the breakage token, moved verbatim to the end of the account. The machine reads the row as open and not asserting breakage. A red run reads CONFIRMED, which holds nothing. A green run reads STALE ROW, which is the nudge to close it. |
| #364 | This cell is **deliberately without the escape-hatch phrase.** The row is unmeasured: excusing it through a NOT A DEFECT ruling would be a ruling nobody made, and counting it as broken would be a claim nobody made. The cell no longer names the breakage token inside a negation, so the machine reads it as neither broken nor excused, with INSTRUMENT OWED. |
| #446 | NOT A DEFECT as filed. By-design accumulation is declared in `tests/test-resolution-order.js:12-15` and `ABRA-HEAP: 6144` at `:8`. Both `run-all.js:811` and `register_reality.js:345-355` honour the heap. **Deviation from the plan, which closed it:** it closes after one run exits 0 under that heap, and that run plays staged games and cuts a real release when bare (`:138`). |
| #500 | NOT A DEFECT, derived from HEAD `data/tags.json`. There are five `buffsHolderOnHit` members, and exactly one is crit-conditioned: `angerpoint`, with boosts `atk: 12`, which saturates. The row stays open for the guard its account asks for. |
| #549 | NOT A DEFECT as filed (refuted by its own same-day correction). `leppaberry` now MATCHES. The 2026-09-07 cell moved verbatim to the end of the account. What remains is the COULD-NOT-STAGE reason audit, which is a fixture work item. |
| #412 | Still true at HEAD: `position_features.js:249`. The marker was demoted to `FORMERLY NAMED:` because the test is green only through `RUNTIME_ALLOWED`, in the entry that opens at `tests/test-effective-identity.js:528`. INSTRUMENT OWED is that test with the entry deleted, which is the fix. |
| #440 | Still true. The marker was demoted, because `game_differential.js` exits 0 on any divergence. The annotation records the Staraptor attribution: game …2659828909, a Rough Skin KO that should have stopped Talonflame's Dual Wingbeat, not the perish drain (`docs/_reports/2026-09-11-corner-mechanisms.md` §1, card 15). INSTRUMENT OWED is a staged perish board with nothing following the group. Related: #584. |

The machine reading was checked row by row through `roadmapRowIsClosed` and `roadmapRowSaysBroken`. None of the three new NOT-A-DEFECT rows suppresses a live claim: `suppresses` is false for all three. The receipt now lists 11 excused rows, of which only #252 suppresses, as before.

## 3. Two hazards found in the machinery, reported rather than fixed

1. **A closed row carrying `NOT A DEFECT` would still enter the escape-hatch receipt.** `engine/open_work.js` and `engine/register_reality.js` call `roadmapRowSaysBroken` on every row, closed ones included. That function pushes into the module-level `NOT_A_DEFECT` array. If the same process later prints `openDefectClause().why`, the row's kept `engine DEFECT` history would make it read as an OPEN row that SUPPRESSES a claim. No closed row at HEAD carries the phrase (measured: 0). #315 was worded to avoid it. The array is filled per process, so the receipt depends on call order.
2. **A kept prior cell carries its breakage token into any row that later reopens.** That is why #370's and #549's old cells were moved into the account rather than kept in the cell.

## 4. The docs gate is RED, and not because of this pass

`node tests/test-docs-current.js` fails one clause of 37, twice in a row (03:35 and 03:41 EDT): `figures bound to no trace (grandfathered): NEW docs/MODELS.md:1493 925` ("925 held-out games").

This pass did not cause it:
- `docs/ROADMAP.md` is not among the 25 documents in `livingDocs()`.
- `engine/docs_scan.js` excludes register copies as traces (`:1370-1379`).
- `docs/MODELS.md`, `CHANGELOG.md`, `engine/docs_scan.js`, `tests/test-docs-current.js` and `data/docs-currency-baseline.json` are byte-identical to HEAD.

Measured through `untraceableCensus`'s own `observe` hook:
- The figure's key `docs/MODELS.md|ce793b6d9b|925` is **not** in HEAD's grandfather list.
- The one entry that retired is a different figure, `docs/MODELS.md|a5bebb2629|0.5159`, which is now bound.
- The sentence cites no artifact and names no CHANGELOG version.
- None of the live-changed data files carries 925 in any scaled form. Those files are `data/engine-release.json`, `data/provenance-stamp.json`, two files under `data/releases/2b5a6585d8cf/`, and four new untracked `data/verification/_prediction-2026-09-11-harness-hb*.json` written by a live agent between 03:30 and 03:39.

**The input that moved is not isolated.** The baseline was not written: its hash, `dc217a1a…`, is unchanged. The fix is to bind that figure in `docs/MODELS.md`, or to grandfather it in a diff somebody can see. This pass was not permitted to touch either. It is routed, not filed as known. It also means **#390's marker is red**, so #390 reads PREMATURE CLOSE on the next register pass until this is fixed.

## 5. Counts, re-derived without playing a game

The script uses `Q.openDefectClause()` against the live `docs/ROADMAP.md` and `data/register-reality.json` (confirmed equal to HEAD). The open_work figures use `open_work.js`'s own regex with `Q.roadmapRowIsClosed` and `Q.roadmapRowSaysBroken`. `open_work.js` itself was not run, because it writes `data/open-work.json`.

| | before | after (artifact as is) | after next register pass (projected) |
|---|---|---|---|
| open rows asserting breakage | 50 | 34 | 34 |
| with a RED instrument | 0 | 0 | 0 until run |
| **evidence-free (debt)** | **44** | **32** | **34** (#412 and #440 move from stale to debt) |
| stale (green marker on an open breakage row) | 6 | 2 (#412 #440) | 0 |
| excused (NOT A DEFECT) | 8 | 11 (+#446 #500 #549) | 11 |
| register open / closed (of 547) | 235 / 312 | 224 / 323 | — |
| UNREGISTERED | 0 | 0 | 0 |

The projection re-reads each row's first marker from ROADMAP. An unchanged command keeps its 07:09:29Z verdict, and a new one counts as not yet run.

## 6. Notes-row and CHANGELOG text (ENGINE writes both; the version is ENGINE's to assign)

The figures in the notes row sit in a line that cites no artifact. They are bound only by the CHANGELOG entry that its heading names, so **both must land together with the same version.**

```
## [6.7.1] — 2026-09-11 — eleven register rows closed on evidence already on disk, and seven re-worded so the open-defect clause reads what they say

- **What changed.** `docs/ROADMAP.md` only, eighteen rows. Closed #218 #289 #300 #301 #314 #315 #319 #413 #438 #439 #542, each on a line cited at HEAD, a green verdict already in the register artifact or a read of the committed whole-game differential, each keeping its earlier cell as history. #446 #500 #549 declare NOT A DEFECT in an open cell and none suppresses a live claim; #364 drops the breakage token its own negation carried and asserts nothing; #370 is fixed in code but stays open because its decider, the docs gate, is red today on an unrelated clause. The markers on #412 and #440 are demoted to FORMERLY NAMED: one test is green only through its own allowlist, the other instrument exits 0 on any divergence. Detail: `docs/_reports/2026-09-11-register-closures.md`.
- **Measured.** Open-defect clause, read through `engine/quarantine.js`: 50 → 34 open rows asserting breakage; evidence-free 44 → 32, and 34 once the next register pass re-reads the two demoted markers; 0 with a red instrument before and after. Register 235 → 224 open of 547, 0 unregistered.
- **Supersedes.** Nothing. No published figure moved.
- **Basis.** unchanged.
- **Owed to the next major.** none.
```

```
## [6.7.1] — 2026-09-11
### Changed
- Eleven register rows are closed on evidence already on disk, and seven are re-worded so the open-defect clause reads what they say (`docs/ROADMAP.md`, eighteen rows). Closed: #218, #289, #300, #301, #314, #315, #319, #413, #438, #439, #542. #446, #500 and #549 declare NOT A DEFECT in an open cell. #364 drops the breakage token its own negation carried. #370 stays open until the docs gate is green. The markers on #412 and #440 are demoted because neither instrument could read red on its row.
### Notes
- Open-defect clause: 50 → 34 open rows asserting breakage; evidence-free 44 → 32, then 34 after the next register pass; 0 with a red instrument before and after. Register 235 → 224 open of 547, 0 unregistered. No published figure moved. Account: `docs/_reports/2026-09-11-register-closures.md`.
```

## 7. Scratch

The working scripts are in the session scratchpad under `rc0911/`. They are not in the repository.

Early in the pass, a shell redirect wrote `gd_head.json`, `rr_head.json` and `roadmap_head.md` into the scratchpad root under generic names. If an earlier session had files with those names, they were overwritten. That affects only the scratchpad.

## Appendix A — the #300 static check (acorn from the Showdown checkout; reads a copy, runs nothing)

```js
const fs = require('fs');
const acorn = require('C:/Users/willj/Projects/Pokemon/pokemon-showdown/node_modules/acorn');
const NAME = 'MID_WRAP_ERROR';
let src = fs.readFileSync(process.argv[2], 'utf8');           // git show HEAD:engine/game_differential.js > copy
if (src.startsWith('#!')) src = '//' + src.slice(2);
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowReturnOutsideFunction: true });
const isFn = n => n && /Function/.test(n.type);
function refs(node, out, inFn) { if (!node || typeof node.type !== 'string') return;
  if (node.type === 'Identifier' && node.name === NAME) out.push({ line: node.loc.start.line, inFn });
  for (const k of Object.keys(node)) { if (k === 'loc') continue; const v = node[k], f = inFn || isFn(node);
    if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && refs(c, out, f));
    else if (v && typeof v.type === 'string') refs(v, out, f); } }
function calls(node, out) { if (!node || typeof node.type !== 'string') return;
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier') out.add(node.callee.name);
  for (const k of Object.keys(node)) { if (k === 'loc') continue; const v = node[k]; if (isFn(v)) continue;
    if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && !isFn(c) && calls(c, out));
    else if (v && typeof v.type === 'string') calls(v, out); } }
const body = ast.body;
const declIdx = body.findIndex(s => s.type === 'VariableDeclaration' && s.declarations.some(d => d.id.name === NAME));
const fnRef = new Set();
for (const s of body) if (s.type === 'FunctionDeclaration') { const o = []; refs(s.body, o, true); if (o.length) fnRef.add(s.id.name); }
let bad = 0;
for (let i = 0; i < declIdx; i++) { const s = body[i]; if (s.type === 'FunctionDeclaration') continue;
  const o = []; refs(s, o, false); if (o.some(r => !r.inFn)) bad++;
  const c = new Set(); calls(s, c); for (const n of c) if (fnRef.has(n)) bad++; }
console.log({ declIdx, declLine: body[declIdx].loc.start.line, fnRef: [...fnRef], bad });
process.exit(bad ? 1 : 0);
```

Output on HEAD `b439bc2b`: `declaration: top-level statement 44 ... line 439`; `functions reading it: armClaims`; top-level references at 543 and 550 (TryStatements) and at 8052 and 8055, all AFTER; `statements before the let that reach it: 0`; exit 0. **Scope limit:** it checks direct references and direct calls in the 44 statements before the declaration. It does not follow calls transitively.

## OWED, NOT RUN

Run these **after the live ENGINE agent commits**, so that the tree equals a committed state. Wrap the heavy ones in `tools/lownode.cmd`.

The register pass (it plays games) re-reads the new and demoted markers. After it, open_work confirms 224 open and 0 UNREGISTERED, and status restamps:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node engine/register_reality.js
node engine/open_work.js
node engine/status.js --write
```

The docs gate: red today on `docs/MODELS.md:1493`. It decides #370 and #390, and it must be green before #370 closes:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node tests/test-docs-current.js
```

#446 closes when this exits 0. Pass a committed release; this was the id the artifacts were measured on at the time, so use a newer id if ENGINE cuts one:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node --max-old-space-size=6144 tests/test-resolution-order.js --release 2b5a6585d8cf
```

Probes cited in the closed cells but not run in this pass (they play staged games):
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node tests/probe_ability_zero_boost_line.js
node tests/probe_fairy_aura.js
node tests/probe_moldbreaker_ally_guard.js
```

The plan's "closable after one run" group was not touched by this pass. These rows stay open until their instrument exits 0: #175 #220 #334 #361 #362 #365 #369 #393 #403 #530.
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node tests/test-tag-consumed.js
node tests/test-middle-stall-address.js
node tests/probe_confusion_selfhit_address.js
node tests/probe_multiaccuracy_address.js
node tests/probe_selfdestruct_winner.js
node tests/test-roster-identity.js
node tests/test-register-reality-readonly.js
node tests/test-engine-diff.js --out data/verification/engine-diff.register.json
node tests/probe_sucker_redirect_refusal.js
node --max-old-space-size=6144 tests/test-engine-release.js
```

Instruments owed, none of which exists yet:
- **#300:** the dynamic arm. Load the driver under `-r ./tests/_live_release.js` with a missing `SHOWDOWN_PATH`, and assert the require failure is reported rather than a `ReferenceError`.
- **#301:** a clause that fails while `switch_addressing.*_lookup_missed` is non-zero.
- **#500:** a guard that fails when a crit-conditioned `buffsHolderOnHit` member has a non-saturating boost.
- **#364:** one staged pair per `self` shape.
- **#440:** a staged perish board with nothing following the group.
- **#412:** the fix, plus deletion of the `RUNTIME_ALLOWED` entry.
- **#315:** optionally, a staged mega-faint arm.
