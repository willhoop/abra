# What the site claims about the engine, and whether it is true — 2026-08-25

WEB division, read-mostly pass. Historical findings record; not a living document, not current state.
Every artifact below was read with `git show HEAD:<file>` or with its mtime checked against the clock
first, because a MEASURE agent was writing `data/game-differential.json` and `data/roster.*.json`
during this pass.

---

## LEAD: does the site tell a visitor the simulator is clean?

**`web/` does not. `app/` does.**

No page under `web/` claims the engine is correct, validated or finished. Every room that touches the
simulator withholds rather than captions:

- `web/tower.html` loads `../engine/medicham2-browser.js` and renders the root plate over the whole
  room (`heldFor('../engine/medicham2-browser.js')`).
- `web/index.html` withholds the MEW viewer and the MAG scorer room, with the paragraph explaining
  that a visitor who watches a battle concludes the engine plays Champions correctly.
- `web/replay.html`, `web/scoreboard.html`, `web/models.html` all consult `Q.heldFor` before drawing.
- `web/status.html` and `web/models.html` both mark their own bundle SUPERSEDED and refuse to print
  the clause list at all.

**`app/stadium.html` and `app/quarantine-data.js` say `"1 of 6 gate clauses fail"`** — five of six
passing, from the era before the deliberate-roster clauses existed. Today the gate is **3 of 8**.
That copy is twelve days old and is the one shipped page that reads as *the simulator is nearly
clean*. It was not touched in this pass; see OWED.

---

## 1. `node web/build-quarantine.js --check` — exit code and output

At the start of the pass:

```
DRIFT: web/quarantine-data.js is not what this builder emits now.
DRIFT: web/stadium.html's inline quarantine block is stale.
  gate: CLOSED — 3 of 8 clauses fail
  60 artifact(s) withheld; 33 of 33 page figure(s) held back
  root: engine/medicham2-browser.js plus 85 file(s) that reach it
2 drift(s). Run: node web/build-quarantine.js
EXIT=1
```

Diffed the committed block against a fresh in-memory build before rebuilding. What had drifted:

| field | committed (built 2026-08-22) | gate today |
|---|---|---|
| `root.clause` | `6 of 8 gate clauses fail (deliberate roster / items; …abilities; …moves; whole-game differential; mechanics; no open, known engine defect)` | `3 of 8 gate clauses fail (whole-game differential; mechanics; no open, known engine defect)` |
| `deliberate roster / items` | FAIL — *"MEASURED AGAINST A DIFFERENT ENGINE … release 603d9a69d5a3, tree e12ef20e7910"* | **PASS** — `clean: 139 of 148 tested` |
| `deliberate roster / abilities` | FAIL — same | **PASS** — `clean: 130 of 202 tested` |
| `deliberate roster / moves` | FAIL — same | **PASS** — `clean: 475 of 500 tested` |
| `game differential` | `midpoint 0 of 6000, top 0/6000, bottom 0/6000` | same, plus `idx01…idx14 0/6000` |
| whole-game clause | withheld — *"THE RATE … ARE ALL WITHHELD"* | **`18 of 961 = 1.9% DIVERGE`** |
| open-defect clause | `3 OPEN roadmap row(s) … #218, #241, #258` | **`2 OPEN … #218, #273`** |
| `n_quarantined` / `n_artifacts` | `58` / `227` | `60` / `234` |

The two gate movements the brief named are both visible and both land as expected: whole-game
**18 of 961** (commit `84c0a0bb`) and open-defect **3 red rows → 2** (commit `36b2ecdb`).

**Rebuilt.** `node web/build-quarantine.js` → wrote `web/quarantine-data.js`, restamped
`web/stadium.html`. `--check` now exits 0 and `tests/test-web-quarantine-loaders.js` is ALL PASS.

**No figure was released by the rebuild.** `withheld_keys` is `33 of 33` before and after; `R` gained
nothing. The rebuild made the withholding *more accurate*, not looser.

### The lesson in the direction of the drift

The published verdict was **harsher** than the artifacts support. This project's stated fear is a page
saying the simulator is clean; what actually happened is the reverse, and that is exactly why it
survived three days: nobody audits over-pessimism, and `web/figure-audit.js` scored every one of those
stale numbers as **traced**, because each cited an artifact.

> **A citation proves a figure HAS a source. It never proves the source still says it.**

Only the rebuild-and-diff guard can decide that, which is `tests/test-web-quarantine-loaders.js`'s
whole argument restated with a fresh example.

**The block is a snapshot and goes stale by construction.** Re-run `--check` immediately before any
publish, not at the start of a pass.

---

## 2. Claim inventory — read from an artifact, or typed into the page

### READ FROM AN ARTIFACT (correct as it stands)

| Page | Claim | Mechanism |
|---|---|---|
| `web/stadium.html` | the whole gate — 8 clauses, each verdict, each magnitude, each `[read from …]` | stamped generated block, `web/build-quarantine.js` |
| `web/index.html`, `models`, `replay`, `scoreboard` | same, via `<script src="quarantine-data.js">` | same builder |
| `web/tower.html` | the room is withheld whole because it loads the simulator | `Q.heldFor('../engine/medicham2-browser.js')`, `Q.root` |
| `web/models.html` | mechanics census, two-engine agreement | `web/status-data.js`, gated by `BOARD_SUPERSEDED` |
| `web/status.html` | every card | `web/status-data.js`, gated by `SUPERSEDED` |
| `web/index.html` | MEW viewer, MAG scorer room | `Q.heldFor('data/mew.js')`, `Q.heldFor('data/mag.js')` |
| `web/index.html` | MEDICHAM's win meter reduced to a `QUARANTINED` chip, caveat kept | `Q.chip('data/winrate-backtest.json')` |
| `web/stadium.html` | MEDICHAM cabinet's `honest` paragraph replaced by a plate | `qText` → `honest_q` |

### TYPED INTO THE PAGE — and wrong (all fixed this pass)

| Where | Typed | Artifact says | Status |
|---|---|---|---|
| `web/quarantine-data.js` + stadium block | `6 of 8`, `58 of 227`, three roster clauses FAIL | `3 of 8`, `60 of 234`, all three clean | **rebuilt** |
| `web/stadium.html` `CTRLDATA.medicham` | `cmp:"150", agreed:"149", diff:"1"` | `data/engine-diff.json`: 6000 / 6000 / **0** | **fixed** |
| `web/stadium.html` `CTRLDATA.medicham` | `worst:"3%"` | `data/damage-validation.json` `result.worst_pct` = **0**, since 2026-08-08 | **fixed** |
| `web/stadium.html` canvas | 150-tick loop, red tick hardcoded at index 103, `badMv/badTgt/sd/md` callout | no disagreement exists | **fixed** |
| `web/stadium.html` stat card | `generated 2026-08-18` | artifact regenerated **2026-08-25T21:58:51Z** | **fixed** — cited, not reproduced |
| `web/stadium.html` button hint | `"150 damage rolls"` | — | **fixed** |
| `web/index.html:916` | `"about 30 points on average"`, no citation | ADR-001: **31.1 percentage points** | **fixed** |
| `web/index.html:916` | `"wrong winner in three out of eight"`, no citation | ADR-001: **3 of 8** | **fixed** |

### TYPED INTO THE PAGE — and still correct

- `web/stadium.html` MEDICHAM stat card `"0 / 6,000"` — matches `data/engine-diff.json` exactly, cites
  the three fields by name, and carries the artifact's own `scope` caveat. Typed, correct, and it
  **will** drift again; the only structural fix is a second generated block, which the page can carry
  (the quarantine markers prove it) but does not yet.
- `web/stadium.html` `"Damage vs Smogon calc 100%"`, `36` scenarios, `worst 0%` — matches
  `data/damage-validation.json` (`scenarios: 36`, `within_5pct: 100`, `worst_pct: 0`).
- `web/index.html:919` *"the win-percent calibration against the real simulator has not been
  re-measured since these fixes"* — still true; nothing has re-measured it.

### CLAIMS THAT ARE PROSE, NOT FIGURES, AND WERE CHECKED ANYWAY

- `web/stadium.html` MEDICHAM `job`: *"…and a validated ability layer"*. Weak and not artifact-backed
  as a correctness claim, but the same sentence ends *"Everything else on this screen is downstream of
  it being right"* and the card immediately below it is `SUPERSEDED`. **Left as prose.** Worth a
  rewrite the next time this cabinet is opened — "validated" is the exact adjective this brief asks
  about, sitting on a page where 3 of 8 clauses fail.
- `web/index.html:1458` *"Re-run that seed and you get the same game, move for move — verified
  byte-identical"* — a determinism claim, not a correctness claim. Untouched.

---

## 3. The blind spot in this division's own instrument

`web/figure-audit.js`, Definition 1(b): a token counts as a figure only if it has a decimal point, a
thousands comma, a `%`, or a value **≥ 100**.

So `30` is not a figure, and `three out of eight` is not a figure. `web/index.html` scored **100%
traced (40/40)** while carrying a rounded, uncited, four-week-old measurement in a warning panel.

**Not patched here, deliberately.** Lowering the threshold sweeps in every `2`, `4` and `50` in page
prose — the over-firing gate CLAUDE.md #148 warns about, and this page has `C(6,4)×C(4,2) = 15×6` in
it. The narrower thing worth building is (a) a spelled-out-number scan (`three`…`twenty`) and (b) a
small-integer check that fires only on a line already carrying a comparison word (*off by*, *out of*,
*wrong in*, *agrees on*). Filed in `docs/WEB.md`, not built.

After the fix: `web/index.html` 41/41, `web/stadium.html` 112/112, site **162 of 162, 100%**.

---

## 4. Guards — before and after

| Guard | before | after |
|---|---|---|
| `web/build-quarantine.js --check` | **exit 1**, 2 drifts | exit 0 |
| `tests/test-web-quarantine-loaders.js` | **2 FAIL** | ALL PASS |
| `tests/test-stadium-roster.js` | **1 FAIL** (2 undeclared generators) | ALL PASS |
| `tests/test-web-parses.js` | 12/0 | 12/0 |
| `tests/test-web-figures.js` | 9/0, 140 figures | 9/0, 162 figures |
| `tests/test-web-quarantine.js` | ALL PASS | ALL PASS |
| `tests/test-site-engine.js` | 12/0, worst divergence 0.00% | 12/0 |
| `tests/test-docs-current.js` | 23/0 | 23/0 |
| `tests/test-roadmap-register.js` | 3/0 | 3/0 |
| `tests/test-model-map.js` | **1 FAIL** | **1 FAIL — see OWED** |
| `tests/test-web-status.js` | **12 FAIL** | **12 FAIL — see OWED** |
| `tests/test-site-sync.js` | **5 FAIL** | **5 FAIL — see OWED** |

The three still red are all outside what this pass could close: one needs a file outside the WEB write
set, one needs a two-minute `engine/status.js` run that must not happen beside a live MEASURE agent,
and one is effectively a publish.

---

## 5. Red and NOT closed — stated, not filed

### 5a. `tests/test-model-map.js` — `THE PER-TURN PIPELINE` has no box and no declaration

`docs/MODELS.md:411` gained `## THE PER-TURN PIPELINE — WHO DOES WHAT, 2026-08-13`. The map's forward
check reads every `## NAME — job` heading and requires a box or a `DECLARED` reason.

It is **not a model** — it is the composition block, and every model in its table (MAG, DODUO,
MILTANK, SLOWKING, DUSK) already has a box. Drawing a box for it would put the map inside the map.

`DECLARED` lives in `tests/test-model-map.js`, which is outside the WEB write set
(`web/`, `tests/test-*web*.js`, `tests/test-stadium-roster.js`). The exact patch is in OWED below,
including the matching `#notonmap` note the guard also requires on the page — which **is** in the
write set, so whoever lands the declaration should land both in one pass or the guard stays red.

### 5b. `tests/test-web-status.js` — the board is fourteen days old

`web/status-data.js` built 2026-08-11. Twelve scalars no longer equal the artifacts they name:

| key | board says | artifact says |
|---|---|---|
| `engine.live` / `engine.probed` | 423 / 423 | 706 / 706 (`data/mechanics-census.json`) |
| `engine.matrix_live` | 1643 | 1642 (`data/interaction-matrix.json`) |
| `engine.matrix_agree` | 1624 | 1642 |
| `engine.matrix_part` | 19 | 0 |
| `engine.matrix_ran` | 2300 | 2250 |
| `ops.games` | 52,089 | 69,932 (`data/live.js`) |
| `ops.usable` | 11,255 | 20,528 |
| `ops.usablePct` | 21.6 | 29.4 |
| `ops.teams` | 10,810 | 18,695 |
| `ops.turns` | 84,727 | 2,044 |

**Nothing false is published.** Both consumers compute SUPERSEDED off the bundle's own `built_at`
against a `SUPERSEDED_ON` watermark of `2026-08-22` and render a plate. `web/models.html` would
otherwise be telling a visitor **"medicham2 agrees on 1,624 of 1,643 live pairs"** — an engine claim
that is stale in both operands.

**Two things to know before rebuilding.** (1) `web/build-status.js` runs `node engine/status.js` at
require time; it is minutes long and must not run beside a writing MEASURE agent — baking a snapshot
out of a moving tree is the defect SUPERSEDED exists to stop. (2) `SUPERSEDED_ON` is a **typed date
constant** in two files. A board rebuilt today reads `built_at: 2026-08-25 ≥ 2026-08-22` and un-blanks
everything, whether or not the scalars have caught up. It is a tripwire, not a freshness check, and it
will need re-arming the next time this happens.

### 5c. `tests/test-site-sync.js` — `app/` is the optimistic copy

Five pages diverge. Last commit dates: `app/index` 2026-08-10 vs `web/index` 2026-08-22;
`app/stadium` 08-10 vs 08-22; `app/status` 08-11 vs 08-22; `app/models` 08-09 vs 08-22; `app/tower`
08-10 vs 08-22.

`app/stadium.html` line 382 and `app/quarantine-data.js` both carry
`"clause": "1 of 6 gate clauses fail (no open, known engine defect)"`.

**This is the published false claim.** It says one clause of six fails; three of eight fail. It also
predates the roster clauses entirely, so a reader cannot even tell which gate it is describing.

Not fixed here for two reasons, both stated up front rather than discovered afterwards: `app/` is
outside the write set this pass was given, and copying into `app/` is effectively a publish, which is
confirmed before it happens.

---

## 6. Things noticed, left alone, reported

- **`data/_pair-pilot.json` and `data/medicham-represented-clicks.json` are untracked in git** and are
  now named in the committed `classified` list inside `web/quarantine-data.js`. The page therefore
  names two files a fresh clone does not have. The classification is `engine/quarantine.js`'s, not
  WEB's, so it was not filtered. Also newly classified this build: `data/_turncap-cap12/16/30.json`,
  `data/engine-diff-PLANTED-band.json`, `data/immunity-sweep.json`, `data/move-priors.observed.json`.
  Dropped from the set: `data/effective-identity-baseline.json`.
- **`divergences.html` at the repository root** — 215 KB, titled *"Where MEDICHAM and Showdown part"*,
  reads like a room, sits outside `web/`, and is covered by no WEB guard: `figure-audit.js` does not
  scan it, `test-web-parses.js` does not parse it, it loads no quarantine payload. **Untracked**, so
  it cannot ship — the only reason this is a note rather than a red row. **Left in place.**
- **Files named `0`, `11.69%` and `9.7%` at the repository root**, plus `.refresh.log` and
  `.refresh.1785643719732415918.log`. They look like redirection accidents. **Reported, not deleted**
  — an untracked file is unrecoverable and this repository has already lost one that way.
- **`data/roster.*.prev.json`, `data/roster.abilities.pre-shape-rules.json`,
  `data/roster.moves.staging-trial.json`** — sibling snapshots beside the live roster artifacts.
  MEASURE's, untouched, mentioned only so nobody mistakes them for the gate's input.

---

## 7. How artifacts were read safely

MEASURE was live throughout. Every figure above came from one of:

- `git show HEAD:data/engine-diff.json`, `git show HEAD:data/damage-validation.json` — stable by
  construction;
- `engine/quarantine.js`'s own clause readers, run twice with an identical result, and cross-checked
  against the two gate movements the brief named independently (`18 of 961`, `3 red rows → 2`) — both
  matched, which is what argues the reads were settled rather than torn;
- mtimes checked against the clock before any disk read. At `2026-08-25T22:59:53Z` the newest relevant
  write was `data/quarantine-stamp.json` at 18:54 local (≈6 min); `data/engine-diff.json` 17:58,
  `data/roster.*.json` 17:59, `data/game-differential.json` 18:37. None inside a write window.

`engine/register_reality.js --list` was **not** run. `engine/status.js --write` was **not** run. No
game was played, no fit, no self-play, no H2H.

---

## OWED, NOT RUN

```bash
# 1. RE-CHECK THE QUARANTINE BLOCK IMMEDIATELY BEFORE ANY PUBLISH.
#    It is a snapshot of a gate MEASURE is still moving. Exit 0 or do not ship.
node web/build-quarantine.js --check

# 2. IF IT DRIFTED AGAIN, REBUILD AND RE-VERIFY. Never hand-edit the block.
node web/build-quarantine.js
node tests/test-web-quarantine-loaders.js

# 3. CLOSE tests/test-model-map.js. TWO EDITS, ONE PASS, OR THE GUARD STAYS RED.
#    (a) tests/test-model-map.js — add to the DECLARED table. NOT the WEB write set;
#        this needs whoever owns tests/ outside test-*web*.js.
#
#    'THE PER-TURN PIPELINE':
#      'THE COMPOSITION BLOCK, NOT A MODEL. Added to docs/MODELS.md 2026-08-13 because the models '
#      + 'were each documented and their ORDER was not — it is a table saying which of MAG, DODUO, '
#      + 'MILTANK, SLOWKING, HYPNO and DUSK runs when. Every model it names already has a box, and '
#      + 'the arrows between those boxes ARE this entry: drawing it would put the map inside the '
#      + 'map. It fits nothing, decides nothing and returns nothing of its own. REVERSAL: if the '
#      + 'pipeline ever acquires a step that is not itself a ledger model, that step needs a box.',
#
#    (b) web/models.html — add THE PER-TURN PIPELINE to the #notonmap note with the same reason.
#        The guard requires the declaration to be readable by a person, not only by the test.
#        This half IS in the WEB write set.
node tests/test-model-map.js

# 4. REBUILD THE STATUS BOARD — ONLY WHEN NO MEASURE AGENT IS WRITING.
#    web/build-status.js runs engine/status.js at require time (minutes). Confirm the tree is
#    still before starting, and go through the priority wrapper.
git status --porcelain          # expect clean, or at least no data/ churn
tools\lownode.cmd web\build-status.js
node tests/test-web-status.js
#    THEN re-arm the tripwire: SUPERSEDED_ON is a typed date constant in BOTH
#    web/status.html and web/models.html. A board rebuilt today satisfies the 2026-08-22
#    watermark and un-blanks every card whether or not the scalars caught up.

# 5. SYNC app/ — THIS IS A PUBLISH. CONFIRM FIRST.
#    app/ carries "1 of 6 gate clauses fail". Run steps 1-2 first so the copy is current.
cp web/index.html   app/index.html
cp web/models.html  app/models.html
cp web/stadium.html app/stadium.html
cp web/status.html  app/status.html
cp web/tower.html   app/tower.html
cp web/quarantine-data.js app/quarantine-data.js
cp web/status-data.js     app/status-data.js
node tests/test-site-sync.js

# 6. THE FIGURE-AUDIT BLIND SPOT. Not built; the shape is in docs/WEB.md.
#    A rounded, uncited "30 points" scored as no figure at all. Do NOT fix by lowering the
#    scale filter — add a spelled-out-number scan and a small-integer check that fires only on a
#    line already carrying a comparison word.
node web/figure-audit.js

# 7. ROUTED OUT OF WEB, NOT FIXED HERE:
#    - MEASURE: docs/MODELS.md's THE PER-TURN PIPELINE heading is what turned the map guard red.
#    - MEASURE/OPS: data/_pair-pilot.json and data/medicham-represented-clicks.json are untracked
#      but are now named in the committed web/quarantine-data.js classified list.
#    - Whoever owns it: divergences.html sits at the repository root, is untracked, and no WEB
#      guard can see it. If it is meant to be a room it belongs under web/. NOT DELETED.
#    - Whoever owns it: files named `0`, `11.69%`, `9.7%` at the repository root. NOT DELETED.
```
