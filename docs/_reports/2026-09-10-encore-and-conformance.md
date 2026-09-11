# 2026-09-10 — Encore ends at 0 PP (ROADMAP #580), and the engine's conformance debt

ENGINE division. Historical record (see CLAUDE.md on `docs/_reports/`): not maintained, not current state.

## Verdict

| | before | after | receipt |
|---|---|---|---|
| Encore ends in the residual when the encored move reaches 0 PP | RED on `cee38e7e9891` | **FIXED** on `5973a4e3c768` | `tests/probe_encore_pp_end.js --assert` exits 1 → 0; red again under `MEDI_ENCORE_NO_PP_END=1` |
| top-tie-first corner, board-material | 12 of 961 | **8 of 961** | exactly the four predicted Encore seeds gone, none new |
| bottom-tie-first corner, board-material | 11 of 961 | **11 of 961** | identical seed set, as predicted |
| middle arm, board-material | 0 of 961 | **0 of 961** | identical first divergences, errors and order probe |
| `engine/conformance.js` ratchet regressions | **21** | **5** | the 16 assigned (12 S12 names, 4 S12 format literals) all cleared; the 5 left are S13 writer findings owed by MEASURE |
| quarantine gate | OPEN, 9 of 9 | **OPEN, 9 of 9** | `engine/quarantine.js`, 2026-09-11T03:19:46Z |
| open-known-engine-defect clause | expected to FAIL on #580 | **PASSES** — #580 read `STALE ROW` (instrument green), then closed | `engine/register_reality.js` 03:51:11Z (§6) |
| census | 839 live | **840 live**, 0 missing | `tests/test-mechanics.js` 03:52:31Z (§7) |
| provenance RULE 5 | — | **RED until tracked**: `5973a4e3c768` is untracked and the living documents' artifacts now cite it | `engine/provenance.js` (through `tools/lownode.cmd`; plain `node` dies of heap, exit 134) |

Board-material is `state.games` less `state.games_board_never_diverged`, read off each artifact.

**Releases cut, in order:** `3ac8810a59af` (superseded before any measurement — it froze a `data/abra-tags.js`
that had not been regenerated beside the new `data/tags.json`), **`5973a4e3c768`** (measured; every figure
below is on it). Neither is tracked in git.

## 1. The authority, re-opened

- Mainline `data/moves.ts:4725-4784`, `encore.condition`: `duration: 3`, `onResidualOrder: 16`, and
  `onResidual(target) { const moveSlot = target.getMoveData(this.effectState.move); if (!moveSlot || moveSlot.pp <= 0) target.removeVolatile('encore'); }` (`:4758-4765`).
- Champions `data/mods/champions/moves.ts:286-322`: `encore: { inherit: true, condition: { inherit: true, onStart(...) } }` — it replaces `onStart` only, so the residual end is the format's.
- `sim/battle.ts:515-523` (`fieldEvent`): for a Residual handler with a `duration`, the duration is spent first; if it reaches 0 the end callback runs and the handler is skipped, otherwise the handler runs in the SAME slot. So the PP end is at order 16, immediately after the clock.

## 2. The fix

- **Tag, derived.** `engine/tag_dex.js` gains `endsWhenMoveOutOfPP`, read off `condition.onResidual`'s own source (`getMoveData(this.effectState.move)` + an empty-slot test + `removeVolatile`), params `{volatile, orNoSlot, order}`. **Membership printed before wiring, over the 500 legal moves: `encore` only.** A wider net (any legal move, ability or item handler reading `effectState.move` and `pp`) adds `encore.onStart` and `disable.onStart`, which are refusals at application and already implemented. `data/tags.json` regenerated: **one row's tags/params changed (Encore); `uses` moved on 304 rows** because the stores had been restored from their shards. `data/abra-tags.js` rebuilt from it.
- **Engine.** `engine/medicham2-browser.js`: `volEndsOnEmptySlot(m, vol)` is asked right after a clock decrement that left the volatile standing, at the two places the clock is spent (`residualClockTick`, which the walk places at the artifact's order 16, and the foot loop under `MEDI_ENDTURN_CLOCKS_AT_FOOT=1`). The set comes from the tag; where this engine keeps the held move (`_encoreMove`) is a one-entry reader map, and a tagged volatile without a reader is counted (`MEDFAILS.volEmptySlotNoReader`). "No slot" is `moveSlotOnBody`, now shared with `encoreOnStartRefusal` (one implementation); "no PP" is `ppLeft`, whose `null` is counted and never ended. Loud doors: `volEmptySlotPPUnknown`, `volEmptySlotNoHeldMove`, `volEmptySlotTableFailed`, `volEmptySlotTagAbsent`. Receipts: `MEDSEEN.volEmptySlotAsked / EndedNoPP / EndedNoSlot`.
- **Knob.** `MEDI_ENCORE_NO_PP_END=1` restores the old behaviour and stamps `MEDFAILS.encoreNoPPEndRestored`; `tests/test-mechanics.js` now lists that stamp in `DELIBERATE_BREAK`, so a knobbed run refuses to write the census.

**The one confound inside the release, declared before the run.** The engine reads tag `uses` in exactly one place, `sideGuardClickRate`: Quick Guard's chooser rate moves 0.35 × 3440/8705 = 0.13831 → 0.35 × 3444/8718 = 0.13827 (Wide Guard stays the top, 0.35). §5 shows it moved no game.

## 3. The probe — right turn AND right order

`tests/probe_encore_pp_end.js`, under `top-tie-first`. It gained an **ORDER** arm: RUN-OUT with the encorer's
partner clicking a derived bracket move (a legal Status move whose condition writes a line every residual at
an order above Encore's — Perish Song@24 is the only one), so the run-out turn carries the weather upkeep
(order 1), the Encore end (16) and the perish count (24), and both engines must print them in the same
sequence. No legal Perish Song learner has a handler-free ability, so for that one body the probe accepts an
ability whose only handlers are damage-side hooks (every click is a Status move): Absol / Super Luck, printed.
`FORMAT` is derived from `engine/champions_sim.js`.

| run | RUN-OUT (t8 end) | ORDER sequence, showdown / medicham2 | `--assert` |
|---|---|---|---|
| `cee38e7e9891` (pre-fix) | authority `-end` t8, medicham2 none; board `vol.encore` 2/0 | `weather-upkeep > encore-end > perish` / `weather-upkeep > perish` | **exit 1** |
| `5973a4e3c768` | both end at t8; boards agree | `weather-upkeep > encore-end > perish` / same | **exit 0** |
| `5973a4e3c768` + `MEDI_ENCORE_NO_PP_END=1` | medicham2 none; board 2/0 | ... / `weather-upkeep > perish` | **exit 1** |
| `3ac8810a59af` + `MEDI_ENDTURN_CLOCKS_AT_FOOT=1` | both end at t8; boards agree | ... / `weather-upkeep > perish > encore-end` | **exit 1** (ORDER parts) |

The last row is the order check's own red: an end that fires on the right turn but at the foot of the turn is
caught. FULL-PP control holds in every run; NATURAL expiry (t10) agrees in every run.

**Census row.** `move/endsWhenMoveOutOfPP` in `tests/test-mechanics.js`: a real Prankster Encore, the slot set
to 3 (control) or 2 (test) before it lands. Under the knob it reads **MISSING** — `1 PP left: vol.encore 1
(must stand), 0 PP left: vol.encore 1 (must be 0; slot at 0)` — and the census was refused, as designed.

## 4. Prediction, written first

`data/verification/_prediction-2026-09-10-encore.json`: top 12 → **8**, interval [8, 9], naming the four
`vol.encore` seeds to leave and `…2661290217` (the Encored Incineroar that repeats Flare Blitz in the
authority) to stay; bottom 11 → 11; middle 0 → 0. **All three hit exactly.**

## 5. The measurement chain on `5973a4e3c768`, and the sample-identity proof

Pins for every whole-game arm: `--release 5973a4e3c768 --census data/mechanics-census.json --team-store data/team-pool-frozen --games 1200 --turns 50 --steering empirical --end-state`. The census file was HEAD's bytes throughout the chain (checked with `git diff --quiet HEAD`; 839 rows, digest `061db6abc2fd`); it was regenerated only after every census-reading run had finished.

| instrument | result | artifact |
|---|---|---|
| damage differential, n=6000, seed 20260804 | **0 of 6,000** disagree | `data/engine-diff.json` 2026-09-11T03:12:01Z |
| roster items | 142 of 148 tested, 0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE, reds 18/18 | `data/roster.items.json` 03:14:27Z |
| roster abilities | 139 of 201 tested, 0 / 0, 5 deferred by owner, reds 44/44 | `data/roster.abilities.json` 03:16:05Z |
| roster moves | 487 of 498 tested, 0 / 0, 3 deferred by owner, reds 36/36 | `data/roster.moves.json` 03:17:49Z |
| all mechanics fire | 1,313 games, 0 threw; moves 4 diverged (6 incl. shelved), abilities 1 (2), items 0; `red_ok` true | `data/all-mechanics-fire.json` 03:18:26Z |
| middle arm | **0 of 961**, 1 protocol divergence, 0 void | `data/game-differential.json` 03:16:02Z |
| top-tie-first | **8 of 961**, 18 protocol-diverged | `data/verification/game-differential-top-tie-first.json` 03:12:24Z |
| bottom-tie-first | **11 of 961**, 28 protocol-diverged | `data/verification/game-differential-bottom-tie-first.json` 03:09:01Z |
| quarantine | **OPEN, 9 of 9** | `engine/quarantine.js` 03:19:46Z |

**Samples identical, proved rather than assumed** (each against `git show HEAD:<artifact>`, measured on `cee38e7e9891`):
- **top**: board-material seeds — left exactly `…2635949496`, `…2662294385`, `…2635107764`, `…2635366005`, new none, and no surviving game moved its turn or first diff; protocol first divergences 22 → 18, the same four left, none new; `errors` identical (the one pre-existing Floette refusal), `order_probe` and `mid_void` identical.
- **bottom**: seed set identical, protocol first divergences 28 → 28 identical, `errors` identical (two pre-existing refusals).
- **middle**: first divergences 1 → 1 identical, `errors` and `order_probe` identical.
- **all mechanics fire**: every row identical; the summaries differ only in wall-clock `seconds`.

**So nothing moved beyond the fix** — not the 47 extra bo3 games `engine/set_priors.js` now sees, not the
`uses` refresh. Three fields differ and none is behaviour: `coverage` (+4 measurable, because HEAD's corner
artifacts were steered by the **835-row** census and HEAD's committed census is now 839 rows), `classes`
(`uses` annotations from the regenerated tags), and `steering.driver_code` (batch 2 edited
`engine/divergence_shape.js` and `engine/empirical_driver.js`, both driver files, value-identically).

## 6. Register refresh

`engine/register_reality.js`, run LAST with #580 still marked open, so the row's own instrument decided it
(`data/register-reality.json`, 2026-09-11T03:51:11Z, 86 distinct commands):

- **#580: `STALE ROW`, `VERDICT-GREEN`, exit 0** — an open row whose instrument now passes. It is closed in this pass (`docs/ROADMAP.md`), and `roadmapRowIsClosed` reads it closed.
- **The "no open, known engine defect" clause does NOT fail.** No open row that asserts breakage has a red instrument (`open_asserting_breakage_and_marked` 6, none red). The gate's own run of the clause (`engine/quarantine.js`, 03:19:46Z) read PASS as well.
- register_reality itself exits 1, on register hygiene that predates this batch: 10 stale rows (#218, #319, #402, #412, #438, #439, #440, #444, #528, and #580 — 9 before #580), 1 premature close (#577, as before), 2 unrunnable, 1 cannot-answer, 9 rejected markers (ROADMAP #579). None asserts an engine defect.
- **Releases it touched:** its game-differential rows cut without `--release`, over a tree byte-identical to `5973a4e3c768`, so they appended **26 cut events to that id** (`data/releases/5973a4e3c768/cuts.jsonl`, 27 in all with mine) and minted no new id. The `tests/_live_release.js` rows cut into a temp store.
- It also ran `node tests/test-mechanics.js` as a row, which wrote the census at 03:27:16Z — after every census-reading measurement had finished.

## 7. Census

`tests/test-mechanics.js`, clean, 2026-09-11T03:52:31Z: **839 → 840 live**, 840 probed, 0 missing, 0 hollow,
0 threw, `run_ok: true` (`data/mechanics-census.json`). The new row `move/endsWhenMoveOutOfPP` is LIVE:
`1 PP left: vol.encore 1 (must stand), 0 PP left: vol.encore 0`. Under `MEDI_ENCORE_NO_PP_END=1` the same row
read MISSING and the census write was refused.

## 8. Batch 2 — conformance, 21 → 5

- **12 × S12 names.** Each file gets one `GAME_RULES` block, values MOVED out of the source by a script that asserts every anchor matched exactly once (regex and list literals are captured from the file, never retyped). `engine/orient.js` needed no block — its one hit was the English word in a printed sentence (now "does not freeze them"). `engine/faces.js` declares its existing staging table as the block through a getter. Verified: `node --check` on all 12; `engine/divergence_shape.js --selftest` 8/8; `engine/quarantine.js --selftest` **239 passed, 0 failed**; and the chain above ran on the edited `quarantine.js`, `all_mechanics_fire.js`, `divergence_shape.js` and `empirical_driver.js` with the samples identical to HEAD.
- **4 × format literals.** `tests/probe_accuracy_roads.js`, `tests/probe_disguise_crit.js`, `tests/probe_encore_pp_end.js` derive `FORMAT` from `engine/champions_sim.js`; `tests/test-stadium-roster.js:202` names `<the active format>` in its reason string.
- **`engine/selftest.js`'s declaration.** `RAW-STORE-NOT-READ:` added beside the 2026-08-10 corpus-scan comment in `engine/medicham2-browser.js` (a SOURCE, so it rode in `5973a4e3c768`; it is a comment and has no behaviour).
- **Left, not mine:** the 5 S13 regressions (`data/all-mechanics-fire.boardstate.json`, `data/artifact-rerunnable-baseline.json`, `data/divergence-middle.json`, `data/medicham-bench.json`, `data/smogon-priors.observed.json`), owed by their writers per `docs/_reports/2026-09-10-conformance-and-unaccounted.md`. `data/conformance-baseline.json` was **not** rewritten — conformance refuses while any regression stands.

## 9. Things found on the way

- **`tools/lownode.cmd` from Git Bash:** with `MSYS_NO_PATHCONV=1` set, `cmd //c` is no longer rewritten to `/c` and opens a bare interactive shell that runs nothing and exits 0 — the first tag regeneration "succeeded" and wrote nothing (caught by comparing the file, not the exit code). Use `cmd /c` under that variable.
- **Every roster plant still reaches:** no plant or mutation source anchors on the three medicham2 lines this fix rewrote (grepped), and reds are 18/18, 44/44, 36/36 with no dead anchor.
- `node engine/status.js --write` still prints two reds that predate this batch and are MEASURE's: `FEATURE SEMANTICS CHECK FAILED` for `data/policy-weights.json`, and the provenance ratchet on six `data/_diag*.json` files.
- **My own scanner was wrong, not conformance.** The scratch script I used to list the S12 hit lines stripped `//` comments without normalising CR, so on CRLF files (e.g. `engine/empirical_driver.js`) it reported comment text as code. `engine/conformance.js` reads every file through `engine/read_text.js`, which normalises CR first (its own comment at `:66-73` records the 169-file version of this defect, fixed). Retracted here before it reached a register row.

## 10. Files

Mine, changed: `engine/medicham2-browser.js`, `engine/tag_dex.js`, `data/tags.json`, `data/abra-tags.js`,
`tests/probe_encore_pp_end.js`, `tests/test-mechanics.js`, the eleven batch-2 engine files, `tests/probe_accuracy_roads.js`,
`tests/probe_disguise_crit.js`, `tests/test-stadium-roster.js`, `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `docs/ENGINE.md`,
`docs/ROADMAP.md`, the five ledgers' GENERATED blocks (`status.js --write`), every artifact in §5, the census, the
register and the conformance artifact. New: this report, `data/verification/_prediction-2026-09-10-encore.json`, and
the release directories `data/releases/3ac8810a59af/` and `data/releases/5973a4e3c768/` (gitignored, untracked).
Not mine, left alone: `docs/_reports/2026-09-10-corrupted-winners.md` (untracked). Nothing committed.

## OWED, NOT RUN

Track the two releases this batch cut. `data/releases/` is gitignored, so they need `-f`; until `5973a4e3c768` is
tracked, every figure the notes row, the CHANGELOG, `docs/ENGINE.md` and ROADMAP #580 cite on it rests on an
untracked release (`engine/provenance.js` RULE 5):

```bash
git add -f data/releases/5973a4e3c768 data/releases/3ac8810a59af
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/provenance.js
```

The fifth Encore-grouped top-corner game, still never staged and not this mechanism:

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/replay_one.js --release 5973a4e3c768 --team-store data/team-pool-frozen --games 1200 --turns 50 --steering empirical --end-state --arm top-tie-first --config omit-weather --seed "gen9championsvgc2026regmbbo3-2661290217 vs gen9championsvgc2026regmbbo3-2661324628"
```

The eight top-corner games and eleven bottom-corner games still parting, card by card:

```bash
node -e "for(const a of ['top','bottom']){const j=require('./data/verification/game-differential-'+a+'-tie-first.json');for(const d of j.state.first_board_divergences)console.log(a,d.config,d.seed,'t'+d.turn,d.diffs.slice(0,2).map(x=>x.path+' '+x.medicham+'/'+x.showdown).join(', '))}"
```

Conformance's five remaining regressions are S13 writer findings, MEASURE's (from `docs/_reports/2026-09-10-conformance-and-unaccounted.md`); the baseline is written only by the first clean run:

```bash
grep -n "fs.writeFileSync(D(DUMP_OUT)" engine/game_differential.js
grep -n "fs.writeFileSync(f, JSON.stringify(report" engine/all_mechanics_fire.js
node tests/test-artifact-rerunnable.js --stamp
node engine/conformance.js
```

Register hygiene that makes `engine/register_reality.js` exit 1 — nine stale rows other than #580, one premature close (#577), nine rejected markers (#579):

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/register_reality.js
```

The fold-in owed to the next major (the new top-corner reading into the white paper, technical docs and summary):

```bash
node engine/docs_scan.js --owed
```
