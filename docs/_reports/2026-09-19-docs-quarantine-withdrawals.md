# 2026-09-19 — the open gate's docs-quarantine clause: 15 charges, 6 real, 9 collisions

MEASURE division. Light mode: no games, no lattices, no roster stage. HEAD `ae372ad8`, current engine release
`4c9b0cc4a4da` (`engine/engine_release.js currentId()`), gate OPEN.

## Verdict

- `tests/test-docs-quarantine.js` charged 15 figures on main. **6 are REAL** (the sentence reports the downstream
  artifact's own quantity) and are withdrawn. **9 are DIGIT COLLISIONS** (the sentence reports a different
  quantity that shares digits with the artifact) and are bound to their true source.
- **All 15 were charged by route 2 (uniqueness, no citation), and all 15 exist only because of a scanner defect.**
  `uniqueOwners` applied the open gate's same-scale bar to the witness count as well as to the accuser. On route 2
  uniqueness is the evidence, so a stricter denominator makes more figures look uniquely attributable. Measured
  per figure (scratch script over `DS.listFiles('data')`, `artifactHas` strict vs loose): each of the 15 had
  exactly 1 owner at the same scale and 2 to 31 owners at the loose scale. The three baseline route-2 keys
  checked the same way (`8,855`, `1,136,845`, `48,274`) have 1 owner at both scales.
- Fix: the witness count is loose; the one owner must still hold the published figure at the caller's scale.
  The new test arm was **RED on the old code** (`["3,403"]` charged) and is green on the new code. Its control (a
  figure one artifact holds at every scale, `8,855` from `data/leaf-engine-contrast.json`) stays charged. After
  the fix, the hit list lost exactly those 15 and nothing else. 12 standing, all in the baseline. After the two
  `8,855` withdrawals: 10 standing.
- **Limit of the fix, stated plainly:** route 2 now has the recall it had under the closed gate. Three of the six
  REAL figures (`5,506`, `8,887`, `7,992`) and both `9,230`s have coincidental loose witnesses, so **the fixed
  scanner would not have charged them.** They were withdrawn because I read them, not because the gate found them.

## The split

| # | where (line at run time) | figure | charged to | what the sentence reports | verdict | action |
|---|---|---|---|---|---|---|
| 1 | `docs/ABRA-technical-docs.md` (HEAD 1474) | 9,230 | `censoring-value.json` `corpus.clean_open_sheet_games` | the corpus of the 3.47.0 feature check. It is the same corpus and count that `censoring-value.json` and `click-censoring-census.json` (both withheld) record, and no quotable artifact holds it | REAL | withdrawn in the INDEX only, using the draft's own wording (`identical on 1,751,688 rows.`) |
| 2 | `docs/ENGINE.md` 45661 | 9,230 | same | "3.47.0 recording 9,230": same count | REAL | withdrawn ("recording a different count again") |
| 3 | `docs/GAME-DIFFERENTIAL-DESIGN.md` 39 | 5,506 | `leaf-engine-contrast.json` `joint.depth_instrument_reliability.identical_readings` | the reversed-order control | REAL | withdrawn with the rest of that control's figures in the sentence: rho, CI, the baseline-keyed position count, and the "84%" size verdict |
| 4 | `docs/MEASURE.md` 5212 | 8,887 | `leaf-engine-contrast.json` `corpus.clean_games` | that run's store count, "grew 8,887 → …" | REAL | withdrawn with its end count. The same bullet list's reversed-order control figures and its "world, not the ruler" verdict are withdrawn too |
| 5 | `docs/MEASURE.md` 5389 | 5,248 | `rollout-r4.json` `corpus_shape.lines` | R4's corpus line count | REAL | withdrawn with the game and seed-pair counts. The unit lesson is kept in words. The fields named are checked against `corpus_shape`'s keys |
| 6 | `docs/MEASURE.md` 7272 | 7,992 | `porygon2-separation-gate.json` `corpus.clean_games_in_store` | the gate's pinned id-set size | REAL | withdrawn. The sha256 stays |
| 7 | `docs/ABRA-deck-plain-english.md` (HEAD 805) | 22,000 | `exploit-step-probe.json` `budget_sweep[].totalGames` | the `lowersUser` tag's uses. CHANGELOG 3.94.0 has 22,277 | COLLISION | **no edit.** The paragraph already opens with its version, `3.94.0` |
| 8 | `docs/ABRA-whitepaper.md` 1924 | 7,234 | `collinearity-joint.json` `features.focusFireKills.decisionsWithContrast` | 26,142 − 18,908, the full-bring drop | COLLISION | bound to `78bff6c1:data/quality-filter.json` (the 2026-08-27 funnel, which holds both counts) |
| 9 | `docs/SUMMARY.md` (HEAD 1379) | 7,234 | same | same | COLLISION | same binding, **INDEX only** |
| 10 | `docs/ENGINE.md` 29675 | 2,017 | `opponent-calibration.json`, a **string**: "Guo et al. 2017" | the protocol-mode swarm's picked pairs | COLLISION | bound to `team_pool_picked` in `7e06d5a0:data/game-differential.json` (`games` 982, `team_pool_picked` 2017, read) |
| 11 | `docs/ENGINE.md` 41751 | 5,248 | `rollout-r4.json` `corpus_shape.lines` | Last Respects' use count | COLLISION | bound to `uses` in `5da0b0d2:data/tags.json` (lastrespects 5248, temperflare 48, stompingtantrum 3545, read) |
| 12 | `docs/ENGINE.md` 45002 | 3,403 | `winrate-backtest.json` `discrimination.correct` | Armor Tail's use count | COLLISION | bound to the 53,796-game derivation in the same section, and CHANGELOG 3.53.0 ("3,403 uses, 2.894%, rank 8 of 185"). No artifact ever held it (`git log -S3403` over `data/*.json`, 2026-08-04..09: only `tags.json` 23403 and the PORYGON2 gate) |
| 13 | `docs/FINDINGS-2026-07-26.md` 78 | 40,000 | `medicham-speed.json`, a **string**: "~40,000 turns" | the redundant-protection sample | COLLISION | pointer to CHANGELOG 3.5.0, which has the same figure. No artifact found |
| 14 | `docs/MEASURE.md` 6260 | 64.15% | `porygon2-separation-gate.json` CI bound | the clear-weather share of turn-boards | COLLISION | **no edit.** The table's caption names the store census across three stores |
| 15 | `docs/ROADMAP.md` 1113 | 5,248 | `rollout-r4.json` | switches sent in the 961-game differential | COLLISION | bound to `b439bc2b:data/game-differential.json` (`generated` 2026-09-11T06:19:32Z, `games` 961, `sent` 5248, lookup misses 0/0, read) |

Earlier passes classified 9,230 (tech docs) and 7,234 as collisions (`2026-09-11-withdrawals-3.md`, `-4.md`).
This pass agrees on 7,234. It **reverses 9,230**. The count's only records are two withheld censoring artifacts
and CHANGELOG 3.47.0, and the sentence reports that same corpus count, not a different quantity.

## Files

Staged (index), nothing committed:

- `engine/docs_scan.js`: the `uniqueOwners` witness/accuser split.
- `tests/test-docs-quarantine.js`: the route-2 open-gate arm and its control. BASELINE shrunk by the two `8,855`
  keys (GAME-DIFFERENTIAL-DESIGN, MEASURE), with a dated note. The other 5 retired keys are left. Their
  figures still stand in `docs/ENGINE.md`, `docs/ROADMAP.md` and `docs/SEARCH.md`. They stopped firing when the
  gate opened, not because a document changed.
- `docs/ABRA-technical-docs.md`, `docs/SUMMARY.md`: **index only.** The edit was built on `git show HEAD:`,
  then `hash-object -w`, then `update-index --cacheinfo`. Blobs `b80e634c…`, `a80030c0…`. The working copies
  (Will's held drafts) were not written, so git shows `MM`.
- `docs/ABRA-whitepaper.md`, `docs/ENGINE.md`, `docs/MEASURE.md`, `docs/GAME-DIFFERENTIAL-DESIGN.md`,
  `docs/ROADMAP.md`, `docs/FINDINGS-2026-07-26.md`.
- `CHANGELOG.md` 6.62.0 (MINOR: published figures withdrawn). `docs/RUNNING-NOTES.md` row, `**Basis.** unchanged`.
  The row names no withdrawn figure: a withheld figure is not written at all. A first draft struck them and the
  quarantine clause charged the notes page for it, correctly.
- `data/docs-currency-baseline.json`: written by the green `--staged` run of `tests/test-docs-current.js`. It
  retires the grandfathered untraceable keys that went with the reversed-order control.
- `node engine/status.js --write`: the generated blocks in `docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md`, and
  `data/provenance-stamp.json` (timestamp only).
- This report.

Draft `docs/_reports/2026-09-19-700-draft/`: **no edit needed.** It already omits the white paper's and SUMMARY's
`7,234` and the tech docs' `9,230`. Its deck keeps `22,000`, which is a collision and is correct to keep.

## How it was checked

- `tests/test-docs-quarantine.js` has no `--staged`. It was run against the index by preloading a one-line
  scratch module that calls `engine/docs_scan.js`'s own `useIndex()` (the same switch `--staged` throws
  elsewhere): **all checks passed, 10 standing, 5 retired.** It was also run against the working tree (with the
  held drafts): **all checks passed.**
- `node tests/test-docs-current.js --staged`: **37 passed, 0 failed.** On the working tree it is 35/2. Both
  failures are in Will's held drafts (deck :15, tech docs :19/:23/:27, MODELS :13–17, SUMMARY :17–19, 1419):
  roster/census/harness figures their cited artifacts no longer hold, and unbound `state.*` traces. They are not
  from this pass.

## OWED, NOT RUN

- **Will's held drafts still carry the two figures this pass handles.** `docs/ABRA-technical-docs.md` (working
  copy, ~1508) still reads "from 9,230 games". `docs/SUMMARY.md` (working copy, ~1444) has `7,234` without the
  pin. After the scanner fix, neither fails a gate. The 9,230 is REAL and gets republished if that draft is staged
  as-is. The held drafts also fail `test-docs-current` on the working tree (above).
- **The 7.0.0 draft deletes `7,234`.** That figure is a collision, so the fold-in should carry main's pinned
  binding, not the deletion. The draft's "6.0.1 to 6.61.0" fold-in range and its "paste above `## [6.61.0]`"
  instructions now need 6.62.0. Its README items 1 and 111–112 describe this red as open.
- **MEASURE §5 and §8 still print `data/leaf-engine-contrast.json` figures that no clause charges.** One example
  is "games diverging 8,842/8,855 → 8,609/8,855" at ~5172, beside the per-bucket n table. They come from the same
  downstream run as the withdrawn control. They are owed a reading pass. This pass did not take them.
- **10 standing baseline figures** (feature-engine-contrast, feature-shift, censoring-value `48,274`,
  collinearity `1.744%`, policy-weights `186,494`, redirect-audit `81,515`) remain owed a re-run or withdrawal.
  **5 retired keys** (`leaf-position-contrast` ×4, `exploitability` `1,600`) stopped firing when the gate opened
  while their figures still stand. Someone has to read them.
- **The white paper's preceding paragraph cites live field paths for the 2026-08-27 counts.**
  `provenance.funnel.after_min_turns` reads 44,458 in the live `data/quality-filter.json`, not 26,142. The old
  values survive only in the file's history block. The pinned blob fixes the paragraph this pass edited, not
  that one.
- Route 2 can't bind a figure to a non-artifact source (a store derivation printed to stdout, a CHANGELOG
  entry). The scanner fix clears such collisions only when a coincidental witness exists. A future collision
  with no witness will need a pinned blob, or it will be charged.
- No commit, no push, no PDF rebuild.
