# RUNNING NOTES — every change, in the same pass, between major releases

**This page is the living-docs pass now.** Will, 2026-09-06: *"we can update the documents every
major release and just keep a running notes page in between change the documentation rules"*.

- **Every change writes a row here, in the same pass as the code, with the same rigour as the white
  paper.** Figures trace to an artifact. A number that has been superseded is struck out, not
  softened. A quarantined figure is withheld, not captioned.
- **The full living-document set — white paper, deck, technical docs, `SUMMARY.md`, `MODELS.md`, and
  every PDF — is folded in on a MAJOR release**, from the rows below.
- `CHANGELOG.md` and the version bump are unchanged. This page is additional to them, not instead.

**This is not a handoff document and it is not state.** It is a LOG: append-only, newest first, never
edited to agree with today. `node engine/status.js` remains the only statement of what is true now,
and `docs/HANDOFF-*.md` is what happens to a page that forgets that.

**What is owed to the next major is derived, never counted by hand:**

```bash
node engine/docs_scan.js --owed     # the backlog, and how close it is to the cap
node engine/open_work.js            # prints the same block beside the open register rows
```

The backlog is every row below that is newer than the lowest unpinned version header among the living
documents, plus everything still under `[Unreleased]`. It empties itself when a documentation pass
bumps those headers. `tests/test-docs-current.js` FAILS when the backlog goes over the cap, when this
page is missing, when git shows a commit that moved code without moving this page, and when a row's
version disagrees with what the row declares happened (clause 5d).

**Going over the cap owes a DOCUMENT PASS, not a major.** Fold the rows in at any version. A major is
declared by a basis change and by nothing else — see *What counts as a major* in `CLAUDE.md`, which
reads SemVer 2.0.0 clauses 6, 7 and 8 against an API that is the figures this project publishes:

- **PATCH** — no published figure moved. The row says `**Supersedes.** Nothing.`
- **MINOR** — a published figure moved under an unchanged basis. **A simulator fix is a MINOR here**,
  not a patch, because it moves the figures.
- **MAJOR** — the basis moved, so the old figures cannot be linked to the new ones and the documents
  have to be rewritten rather than restamped. The quarantine gate opening is the archetypal case.

---

## How to write a row

Copy this shape. Four lines is a good row; a paragraph is a report and belongs in `docs/_reports/`.

```
## [5.267.0] — 2026-09-06 — one line naming what moved
- **What changed.** The mechanic, the instrument, or the document. Name the file.
- **Measured.** <figure> — `data/<artifact>.json`, n=<sample>, against <baseline>.  Or: NO FIGURE.
- **Basis.** unchanged.  Or: CHANGED — <what a reader can no longer be told>.
- **Supersedes.** ~~<old figure>~~ retracted — it stood in `docs/<doc>.md` and has been DELETED there.
- **Owed to the next major.** Which living document has to absorb this, or `none`.
```

Three rules about the figures in a row, all of them already enforced elsewhere:

- **Cite the artifact by name.** A figure attributed to an artifact that does not contain it fails
  the citation clause of the documentation gate, on this page exactly as on the white paper.
- **Write a retraction as a strikethrough with the word `retracted` on the same line.** That is the
  form the derived retraction registry reads. Once a row here retracts a figure, any living document
  still stating it as fact fails the build — which is the point: **deferring the documentation pass
  never defers a retraction.** The stale number comes OUT of the white paper in this pass; only the
  rewrite waits for the major.
- **A quarantined figure is not written here at all.** A caption is not a quarantine.
- **`Basis.` is a JUDGEMENT and is written as one.** Absent reads as `unchanged` and prints as
  `[basis not stated]` in `node engine/docs_scan.js --owed`, so the omission is visible rather than
  silent. Declaring `CHANGED` obliges the release to be `X.0.0` with the full document set folded in,
  and clause 5d fails the build otherwise.

---

## [Unreleased] — 2026-09-07 — a cure berry that eats a step late, a confusion chance typed as a third, and a residual walk that stops a handler too late
- **What changed.** `engine/medicham2-browser.js` and `engine/tag_dex.js`, three fixes measured one at a time. (1) `curesStatus` now carries `onSet`, derived from the presence of `onAfterSetStatus` — one match in this format, `lumberry` — and `applyStatus` eats such a berry inside `setStatus`, below Synchronize, so a same-action Poison Touch reaches an unstatused body. (2) The confused body's self-hit is the authority's `randomChance(33, 100)` (`u < 0.33`), not `1/3`; under the shared middle-arm die that band is a whole outcome. (3) The residual walk stops at a HANDLER rather than at a group, scoped to the group holding a fainting duration expiry. Probes `tests/probe_cure_berry_on_set.js`, `tests/probe_confusion_selfhit_chance.js`, `tests/probe_residual_stop_body.js`; knobs `MEDI_NO_CURE_ON_SET`, `MEDI_CONFUSION_THIRD`, `MEDI_RESIDUAL_STOP_GROUP_ONLY`.
- **Measured.** Board-material **11 → 8 of 961**, protocol **80 → 77**, narration **68 → 68** — `data/game-differential.json`, release `3f9830acc467`, `--games 1200` (961 played), `--turns 20`, arm `middle`, `empirical-click/v1`, census pin `9446a684709d`, `--team-store data/team-pool-frozen`. Census 830/830/0 (`data/mechanics-census.json`); roster 140/129/475 matched with 0 DIFFER and 0 DID-NOT-FIRE (`data/roster.{items,abilities,moves}.json`); `data/engine-diff.json` 0 of 6000, seed 20260804 — all re-run on `3f9830acc467`.
- **The third fix's first version made the number WORSE and is recorded rather than quietly replaced.** Release `276822231c52` read board-material **10 of 961, UP from 9**: it stopped the walk on residual iterations that had no handler to run and threw away a Light Screen turn the authority spends. The shipped version is scoped three ways and the two games v1 broke are carried inside the probe as controls.
- **Supersedes.** Board-material ~~11~~ and protocol ~~80~~ on release `aa7b80f9a038`.
- **Basis.** unchanged — same instrument (`driver_code 228006b5faca`), same pins, same pinned pool, same census pin.
- **Owed to the next major.** The white paper, the deck, `docs/SUMMARY.md` and `docs/MODELS.md`.


## [Unreleased] — 2026-09-07 — a thaw ordered against its own secondary, and a resist berry keyed to the wrong type
- **What changed.** `engine/medicham2-browser.js`. (1) The freeze cure is deferred out of `_stepApply` into `_stepThawDamagingHit` (the Fire route, beside `_stepDamagingHit`) and `_stepThawAfterSecondary` (the `thawsTarget` route, at the `AfterMoveSecondary` slot) — two different events, and the line ORDER is the observable half. The closure re-reads status when it fires, so a body that fainted to the hit carries `fnt` and is left alone, matching `Pokemon#cureStatus`. (2) A type-resist berry was keyed to the move's BASE type rather than its RESOLVED one. Probes `tests/probe_thaw_after_secondary.js`, `tests/probe_resist_berry_resolved_type.js`; knobs `MEDI_THAW_BEFORE_SECONDARY`, `MEDI_RESIST_BERRY_BASE_TYPE`.
- **Measured.** Board-material **13 → 11 of 961**, protocol **83 → 80** — `data/game-differential.json`, release `aa7b80f9a038`, `--games 1200` (961 played), `--turns 20`, arm `middle`, `empirical-click/v1`, census pin `9446a684709d`, `--team-store data/team-pool-frozen`. Both probes GREEN with the restore knob shown to move the fixture (thaw: 1 board disagreement and the narration order red on all 8 cells; berry: 7 of 7 scored cells move).
- **Supersedes.** Board-material ~~13~~ and protocol ~~83~~ on release `791c9fd873f3`.
- **Basis.** unchanged — same instrument (`driver_code 228006b5faca`, held still across the run), same pins, same pool.
- **Owed to the next major.** The white paper, the deck, `docs/SUMMARY.md` and `docs/MODELS.md`.


## [Unreleased] — 2026-09-07 — the spread move's named target is a DIE, and picking the first live foe moved every address behind it
- **What changed.** `engine/medicham2-browser.js`. The authority picks a spread move's named target with `battle.sample()` — `validTargetLoc` refuses a chosen target for `allAdjacentFoes` — where this engine picked the first live foe. It moves the `|move|` line **and every `any` dice address in the action**. Probe `tests/probe_spread_target_die.js`, knob `MEDI_NAMED_TGT_CLICKED=1`.
- **Measured.** Board-material **16 → 13 of 961**, protocol **87 → 83** — `data/verification/batchJ/after-791c9fd873f3.json`, release `791c9fd873f3`, `--games 1200` (961 played), `--turns 20`, arm `middle`, `empirical-click/v1`, census pin `9446a684709d`, `--team-store data/team-pool-frozen`. The delta rests on the **third-arm pair** (same release, knob vs no knob), which `arms_comparable` calls COMPARABLE at exit 0.
- **Supersedes.** Board-material ~~16~~ and protocol ~~87~~ on release `0c8b0dc63766`.
- **Basis.** CHANGED — the dice addressing moved, so a board-material or protocol level measured before this fix cannot be quoted in the same series as one measured after it. `arms_comparable` answers COMPARABLE for the cross-release pair **because it checks steering and run parameters and not dice addressing**; that is a limit of the checker, not a licence, and it was predicted in advance rather than discovered afterwards.
- **Owed to the next major.** The white paper, the deck, `docs/SUMMARY.md` and `docs/MODELS.md`.


## [Unreleased] — 2026-09-06 — two dice addresses and a replacement's missing Update pass, and one owed defect that turned out not to exist
- **What changed.** `engine/medicham2-browser.js`, three fixes, each shown RED on the published bytes first and measured ALONE. (1) A `DamagingHit` reaction is addressed to the body `getSpreadDamage` left `activeTarget` on, not to the body the handler runs on — `sim/battle-actions.ts:1093/1101/1117`, and the die is Cursed Body's `randomChance(3, 10)`. (2) A SUBSTITUTE's own damage and crit rolls are addressed to the last body `hitStepAccuracy` reached, because the authority prices a doll at `spreadMoveHit` step 0 before `getSpreadDamage` writes anything. (3) The faint replacements now run the `Update` pass their own action closes with (`sim/battle.ts:2858`), so a body that walks in at or below its berry's threshold eats BEFORE the turn boundary rather than after it. Knobs `MEDI_REACT_ADDR_PER_TARGET`, `MEDI_SUB_ADDR_PER_TARGET`, `MEDI_NO_REFILL_UPDATE`; probes `tests/probe_reaction_address.js`, `tests/probe_substitute_roll_address.js`, `tests/probe_refill_update_pass.js`, all green clean and green under `--red`.
- **Measured.** Board-material **18 → 16 of 961**, protocol **89 → 88**, narration **70** (71 raw less 1 declared) — `data/game-differential.json`, release `0c8b0dc63766`, `--steering empirical`, `--arm middle`, `--games 1200` (961 played), `--turns 20`, `--end-state --state`, census pin `9446a684709d`, `--team-store data/team-pool-frozen`. Turn boundaries identical 10,483 → 10,486 of 10,549. Census 830/830/0 (`data/mechanics-census.json`); roster 140/129/475 with 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE on all three stages, and `--reds` catches 17 of 17 planted defects. Each fix was measured on its own release: `0362ccffd3fe` 18 → 17, `3c5e1b1dd284` 17 (the accusing game re-entered the set at a later turn on a leaf the first fix uncovered), `0c8b0dc63766` 17 → 16.
- **Basis.** unchanged — same instrument, same pins, same arm; a figure moved and the story did not. MINOR.
- **Supersedes.** Board-material ~~18~~ and protocol ~~89~~ from release `1fc8ed7adfd7`, both retracted.
- **Owed to the next major.** The white paper, the deck, `docs/SUMMARY.md` and `docs/MODELS.md` still publish the superseded counts. **REFUTED, not fixed:** the *"non-Ghost Curse over-charged by 1 PP into Pressure"* carried on the previous row and printed by `tests/probe_pressure_terrain_target.js` **does not happen** — five staged arms read `ppPressureCharged` 0 with a Ghost-user control moving it 0 → 1 (`tests/probe_curse_pressure_pp.js`); the stale claim is corrected in that probe's own text. **Filed and NOT fixed:** the authority resolves a spread move's NAMED target through `getRandomTarget` → `side.randomFoe()` → `battle.sample()` (because `validTargetLoc` refuses a chosen target for `allAdjacentFoes`) while this engine names the first live foe — which moves the `|move|` line AND the address of every `any`-category draw in that action, measured on a staged paralysis check as `p21` against `p20`. Full account: `docs/_reports/2026-09-06-longtail-batch-I.md`.


## [Unreleased] — 2026-09-06 — seventeen unstamped arms re-taken under the instrument stamp, and the state ladder is withdrawn rather than re-run
- **What changed.** No engine or instrument code. **MEASURE re-ran seventeen `steering` artifacts that carried no `driver_code`**, each at the exact pins of the artifact it re-measures — `--games 1200` (961 played), `--turns 12`, `--end-state`, `--arm middle`, `--steering empirical`, `--census data/verification/census-pin-9446a684709d.json`, `--team-store data/team-pool-frozen`, `--release <that artifact's own id>`. Results in `data/verification/restamp/*.961.json`; the seventeen originals were **not overwritten and not deleted**. `data/state-ladder.json`'s ladder figures were **deleted from six living documents** (white paper, deck, technical docs, `GAME-DIFFERENTIAL-DESIGN`, `MODELS`, `SUMMARY`).
- **Measured.** On **identical engine bytes and an identical sample** — same release, same 961 games, same pool `0d103fb9fa87`/1,968 picked, same 643-row census, verified per arm 17 of 17 — **board-material rose by a mean of +22.2 (range +15 to +24)** and **protocol first-divergence by +32.6 (+20 to +38)**. Example: `data/verification/fix-batch-7.json` release `316669459d67` reads board-material 37 of 961 / protocol 122; `data/verification/restamp/fix-batch-7.961.json`, same release, reads **53 / 143**. The whole difference is the ruler. `engine/arms_comparable.js`: **NEW vs NEW `COMPARABLE` 16 of 16**, driver CHECKED both sides; **OLD vs NEW `NOT COMPARABLE` 17 of 17**, the only proven-different reason in all seventeen being `mode` (pin digest `bcb38e47d94f` → `de38d17e15a2`, the `sdrop` address category) plus `UNKNOWN — only the after-arm records driver_code` 17 of 17. Nothing about the sample is refused anywhere. Fifteen of sixteen adjacent steps keep their sign; the exception is `M5M7M8 → M6-sidesel`, a derived +3 regression that reads 0 on today's instrument.
- **Basis.** unchanged — and the judgement is stated so it can be argued with. No published figure is replaced: each living document names the artifact it quotes, that artifact still contains that number, and it remains a true statement about the ruler that took it. What is added is a second, stamped series that must **never** be tabled against the first — which `arms_comparable` refuses seventeen times rather than leaving to a reader.
- **Supersedes.** The turn-1 and whole-game board-agreement figures drawn from `data/state-ladder.json` are **retracted and not replaced**; they have been DELETED from the six living documents named above, not captioned. Three measured reasons: the artifact carries no `steering.driver_code` so every pair drawn from it reads UNKNOWN and no work today can repair that; its own `determinism.verdict` is red and no document quoting it ever mentioned that; and its pool was drawn live from `data/games.bo3.jsonl` at `ff6529f6a6d7`, a month of hourly appends ago, so the sample cannot be re-taken. A re-run would answer a different question, which is worse than a withdrawal. **Nothing was back-stamped, and no tool that could was built or found** — re-checked independently tonight.
- **Owed to the next major.** `docs/ENGINE.md` still carries the retracted state-ladder figures at `:35070` and `:35089` — it is ENGINE's ledger and carries no version header, so it is outside the living-document set; **filed, not edited.** `data/wire-ladder.json` was NOT re-run (already UNSAFE and WITHHELD; its August pool cannot be recovered either) and `data/protocol-events.json` is still in no digest set at all. A suspected false alarm in `engine/wire_ladder.js`'s determinism check is filed and unfixed — the per-arm artifacts needed to settle it were not kept. Full account: `docs/_reports/2026-09-06-comparability-restore.md`.


## [Unreleased] — 2026-09-06 — a weather forme comes off a corpse, and the class that parts a board silently is empty
- **What changed.** `engine/medicham2-browser.js`, four fixes, each shown RED on the published bytes first. `revertWeatherFormeOnLeave` is now called from `noteFaint` — a weather forme comes off a CORPSE, not only off a body that switched. Pressure's extra PP is priced off the terrain-widened target list rather than `targetClass`'s static `move.target` word. Plus a Mental Herb update-pass fix and an accuracy-modifier chain fix. `tests/roster.js` also moved: its `--reds` stage had **4 unapplied plants NOT CAUGHT** before this batch, and reads 0 after.
- **Measured.** Board-material **22 → 18 of 961**, protocol **91 → 89**, narration **70** (71 raw less 1 declared) — `data/game-differential.json`, release `1fc8ed7adfd7`, `--games 1200` (961 played), `--turns 20`, arm `middle`, `empirical-click/v1`, census pin `9446a684709d`, pool `data/team-pool-frozen`. **The class of games that part a board with NO protocol divergence anywhere is now EMPTY, 2 → 0.** Turn boundaries identical 10,465 → 10,483 of 10,548. Census 830/830/0, roster 140/129/475 with 0 DIFFER and 0 DID-NOT-FIRE on all three. Probes `tests/probe_weather_forme_faint.js`, `tests/probe_pressure_terrain_target.js`, `tests/probe_mental_herb_update.js`, `tests/probe_accuracy_modifier_chain.js`.
- **Basis.** unchanged — same instrument, same pins, same arm; a figure moved and the story did not. MINOR.
- **Supersedes.** Board-material ~~22~~ and protocol ~~91~~ from release `ab22bc503717`, both retracted.
- **Owed to the next major.** The white paper, the deck, `docs/SUMMARY.md` and `docs/MODELS.md` still publish the superseded counts. **Not fixed and named:** a Cursed Body dice-address collision (measured — both engines drew one die for the same Hyper Voice and addressed it to different SLOTS); a non-Ghost Curse over-charged by 1 PP into Pressure; and the remaining 18, of which eleven are HP-only or HP-plus-faint.


## [Unreleased] — 2026-09-06 — the counter tables get the reader they always had, and the PDF rule grows from the ledger to the working document

- **What changed — the red test.** `tests/test-artifact-keys.js` had been red since before this
  session on `UNDECLARED: million-run-150k.json:engine_counters, million-run.json:engine_counters`.
  **The artifact side was right and the 2026-09-04 premise was wrong.** *Nothing reads them* held for
  PROGRAMMATIC readers and was read as true of all readers. The dead-counters audit derives its
  PROVEN BY RUN / UNMEASURED split — 134 fields and 363 — from which keys are present in those two
  artifacts and nowhere else, and `tests/test-counter-init.js` exists BECAUSE both carry
  `retaliateWhenLowered: null`, the only non-finite value in either. Both tables are now declared
  against the one function that indexes them, `instrumentChecks(rows, counters)` at
  `engine/million_run.js:1269`, two keys by hard-coded literal — with the limit stated in the entry:
  nothing reads the FILE’s copy by key. `engine/million_run.js` is UNCHANGED. The other remedy could
  not clear the red and would have destroyed that evidence: the gate judges the two files ON DISK,
  both were generated 2026-08-11 and both carry `GENERATED — do not hand-edit`, and regenerating them
  means playing games through MEDICHAM. ROADMAP #539 is closed with the refutation written beside the
  original text rather than over it; its `engine_counters_zero` half stays open. The fitted weights
  were not touched.
- **What changed — the PDF rule.** `build/build_pdfs.js` now excludes WORKING DOCUMENTS rather than
  only division ledgers. Clause 1 stays derived from `.claude/agents/*.md`; clause 2 is a DECLARED
  RESIDUAL — `docs/ROADMAP.md` and `docs/RUNNING-NOTES.md` — with a reason each, and the clause is
  printed beside every excluded name so a declared entry can never read as a derived one. **The shared
  property could not be derived, and five candidates were measured over all 78 `docs/*.md` before
  saying so:** named-by-a-program matched 56 of them; named-in-code-with-comments-stripped still 45,
  and it catches DEFENSE, METHODOLOGY and ORIENTATION, which have published PDF links; only 24 carry
  a version header, so the currency clause would drop 54 PDFs; body shape does not separate at all
  (ROADMAP 44.3% table rows, RUNNING-NOTES 0.0%, SUMMARY 22.4%, ROLE-ATLAS 98.8%); and a git-history
  rule cannot classify a document created this week, which is the one that most needed classifying.
  **The residual is CHECKED, not trusted.** The build THROWS on an entry naming a document that is not
  there, on an entry that has become a ledger, and — the clause that protects the saving — on ANY
  excluded document whose PDF is still tracked. `docs/ROADMAP.pdf` is untracked (`git rm --cached`,
  file left on disk) and both names are in `docs/.gitignore`.
- **Measured.** NO MODEL FIGURE MOVED. `node tests/test-artifact-keys.js` reads **5 passed / 1 failed
  / exit 1 before** and **6 passed / 0 failed / exit 0 after**, with the detector untouched: 53 tables
  found, 37 flat-lowercase and structurally immune, **16 that can be missed before and after**, all 16
  now declared. Shown RED on a deliberate break first — removing one declaration reprints the
  UNDECLARED clause by name, and pointing another at a missing file fails the dangling-accessor clause
  (4 passed / 2 failed). The repository figures are derived from git rather than from an artifact:
  `docs/ROADMAP.pdf` is **7,229,637 B** in the tree across **eight** tracked versions holding **16.42
  MB raw / 5.19 MB packed**, and the version at the most recent bump `d7ed4b75` packs to **4,092,583 B
  — 4.09 MB of pack per rebuild**. `docs/RUNNING-NOTES.pdf` has never been built; priced once to a
  scratch path it is **241,109 B** today at 190 lines, about 0.14 MB packed at ROADMAP’s 57% ratio.
  **Per-bump saving ≈ 4.2 MB of pack**, on top of the 16.6 MB the ledger clause already removed.
  **UNTRACKING RECOVERS ZERO BYTES OF EXISTING HISTORY** — the blobs stay in the pack, only a history
  rewrite removes them, and the saving is entirely future. `node build/build_pdfs.js --check` **exited
  1 before** on exactly two items, a stale `ROADMAP.pdf` and a missing `RUNNING-NOTES.pdf`, and **exits
  0 after** — not because anything was rebuilt, but because those two items were the two documents the
  rule now excludes. Each of the three new refusals was shown red on a deliberate break.
- **Basis.** unchanged. No published figure moved, and nothing in either job touches a model, a
  simulator or a fitted weight.
- **Supersedes.** Nothing. No figure changed value; the 2026-09-04 DEAD TABLE disposition was a
  judgement, not a figure, and it is recorded as superseded rather than deleted.
- **Owed to the next major.** `docs/ABRA-technical-docs.md` and `docs/SUMMARY.md` describe the
  publishing procedure and must record that a working document — ledger, register or notes log —
  carries no PDF. `docs/ARTIFACT-ACCESS-RULES.md` must record that the engine counter delta is
  declared against an in-generator reader.

---
## [Unreleased] — 2026-09-06 — a major release is defined, and the counter that was to bound the deferral had never read a row

- **What changed.** `CLAUDE.md` gained *What counts as a major*: ABRA's declared public API is the
  FIGURES it publishes (SemVer 2.0.0 clause 1 permits an API existing "strictly in documentation"), so
  PATCH moves no published figure, MINOR moves one under an unchanged basis, and MAJOR moves the basis
  — the ESS *Guidelines on Revision Policy* (Eurostat 2013, KS-RA-13-016) Items 2.0/3.0/3.2/3.4
  routine-versus-major revision distinction, whose back-casting and re-documentation obligations are
  exactly the living-document fold-in. The judgement is DECLARED in one word per row (`**Basis.**`);
  `engine/docs_scan.js` gained `majorPolicy()` and `tests/test-docs-current.js` gained clause 5d,
  which refuses a basis change released as anything but `X.0.0`, an `X.0.0` naming no basis change,
  and a PATCH bump whose row supersedes a figure.
- **AND A DEFECT WAS FOUND IN THE INSTRUMENT THE WHOLE RULE RESTS ON.** `notesEntries()` anchors its
  row pattern with `$`; `core.autocrlf` is `true` here, so the LF blob of this page checks out CRLF,
  and a CR is a JavaScript line terminator that `$` cannot reach past. The backlog therefore reported
  **`0 of 100` — "nothing owed"** against a page holding **four** rows, while
  `tests/test-docs-current.js` passed **30 of 30**. A counter stuck at zero can never reach
  `OWED_CAP`, so the cap could never have fired and the deferral was unbounded. Fixed at the read
  (`stripCR`), not in the pattern; `.gitattributes` already carries a block headed *"A LINE ENDING
  BLANKED THE GATE TWICE IN THREE DAYS"* and this is the third occurrence.
- **Measured.** Backlog **0 → 4 of 100** owed, `node engine/docs_scan.js --owed`, read from
  `docs/RUNNING-NOTES.md`, `CHANGELOG.md` and the living-document headers; documents last folded at
  5.266.0, last major 5.0.0 (2026-08-10). Blast radius of the read fix over the whole document
  surface: living documents **25 → 25**, citation mismatches **78 → 78**, notes entries **0 → 4** —
  only the broken derivation moved. **23 of the live documents are CRLF on disk** and 0 now leak a CR
  to a parser. The gate went **30 passed / 0 failed → 33 passed / 0 failed**; every ratchet in
  `data/docs-currency-baseline.json` is unmoved and the file was not rewritten.
- **Basis.** unchanged. No figure this project publishes changed its meaning or its value; a counter
  that had never counted began counting.
- **Supersedes.** ~~0 of 100 notes entries owed to the next major~~ retracted — it was printed by
  `node engine/docs_scan.js --owed` and by `node engine/open_work.js` on 2026-09-06 and stood in no
  living document, so it is withdrawn here rather than deleted from one.
- **Owed to the next major.** `docs/ABRA-technical-docs.md` and `docs/SUMMARY.md` describe the
  documentation and release procedure; both must record the major/minor/patch definition and that the
  cap owes a document pass rather than a major.

---

## [5.267.0] — 2026-09-06 — a condition with no residual order sorts below every numbered handler
- **What changed.** `engine/medicham2-browser.js`. `stall`'s duration is spent at the FOOT of the residual walk — it carries no `onResidualOrder`, so `comparePriority`'s `order || 4294967296` (`sim/battle.ts:405`) sorts it below every numbered handler, and a residual that KILLS never reaches the decrement. Second fix: the sleep timer took the caller's dice stream — `slp.onStart`'s `sample([2,3,3])` is drawn inside `BattleActions#secondaries`, addressed `sec` by the middle arm, and this engine drew it under `any`.
- **Measured.** Board-material **27 → 22 of 961**, protocol **93 → 91**, narration level 70, census 830/830/0 — `data/game-differential.json`, release `ab22bc503717`, `--games 1200` (961 played), `--turns 20`, arm `middle`, `empirical-click/v1`, pool `0d103fb9fa87`. Uncaused board partings 5 → 2. Probes `tests/probe_stall_uncaused.js` and `tests/probe_status_clock_dice.js`, each shown RED under its own knob first.
- **Supersedes.** Board-material ~~27~~ and protocol ~~93~~, both from release `57679ef9a4a3`. Three claims in the dispatching brief were wrong and are corrected here: Rapid Spin's partial-trap clause ALREADY has a probe (landed 5.265.0, `live: true` in the census); freeze is NOT board-material on its accusing game (`board_div` null, `any` and `acc` logs 4/4 and 13/13 SHARED, refuting an address mismatch) and belongs to the narration gate; and a new `sleeppowder` ACCURACY divergence at t15 was found where both engines asked the SAME address.
- **Owed to the next major.** The white paper, the deck, `docs/SUMMARY.md` and `docs/MODELS.md` all still publish the superseded 27 / 93.


## [Unreleased] — 2026-09-06 — the parsed stores are sharded ahead of the 100 MB wall, and the h2h reclaim is refused

- **What changed.** `build/compress-stores.js` shards the parsed stores the way it has sharded the
  raw logs since 2026-09-04 — write-once dated gzips under `data/parsed/<store>/`, capped at 32 MiB
  of source — and gained `--restore-parsed` and `--verify-parsed`. The ingest path changed with it:
  `.github/workflows/ingest.yml` restores and reconciles from shards and stages them by glob, and no
  longer names the three `data/games.*.jsonl.gz` monoliths, which are untracked and left on disk.
  `.gitignore` and `tests/test-workflow-paths.js` follow. `engine/quality.js` and `engine/quality.py`
  were deliberately NOT touched — the first is a frozen engine source and a differential is running.
- **Measured.** Reassembly is byte-identical on all three stores: sha256 `412858b71f21f14d` (ladder,
  76,833 rows, 383,723,981 B), `da8597c45bb8d096` (bo3, 25,522 rows, 227,347,410 B),
  `cd21077a4578afa3` (ots, 4,167 rows, 31,928,037 B) — computed off the live files before the code
  existed, and reproduced by `node build/compress-stores.js --verify-parsed`, which is kept runnable
  and was shown red on a damaged shard first. Repository figures derive from git rather than from an
  artifact and are in `docs/_reports/2026-09-06-store-sharding-and-reclaim.md`: `.git` 526 MB to
  591 MB, all of it the 19 new shard blobs, with the pack unmoved at 524.28 MiB.
- **Supersedes.** Nothing. No published figure changed value. A pack-growth claim drafted into three
  comment blocks during this pass was measured false and corrected before it left the working tree;
  it never stood in a living document, so it is a correction and not a retraction. Report, section
  1.7.
- **Owed to the next major.** `docs/ABRA-technical-docs.md` and `docs/SUMMARY.md` describe where the
  corpus lives and how a clone materialises it; both must record `data/parsed/` and
  `--restore-parsed`. The h2h reclaim owes nothing: it was refused, and no figure moved.

---

## [Unreleased] — 2026-09-06 — the division ledgers stop getting PDFs, and tonight's rules are written down

- **What changed.** `build/build_pdfs.js` now excludes the division ledgers from the PDF set, under a
  stated rule — *a division ledger is a working document and gets no PDF* — derived from
  `.claude/agents/*.md` rather than a typed filename, and printed on every run so the exclusion can
  prove it ran. The five ledger PDFs are untracked (`git rm --cached`, files left on disk) and ignored
  via a new `docs/.gitignore`; the root `.gitignore` was not touched, because another agent holds it.
  `CLAUDE.md` and `.claude/skills/start/SKILL.md` gained tonight's operating rules: the `--games` flag
  is part of the sample definition, the capped divergence lists are not the population, the clause is
  not the field whose name looks right, a receipt is written from the path the run opened, deleting a
  tracked file recovers no history, the 100 MB push wall and its date, and why a history rewrite is
  unavailable.
- **Measured.** No model figure moved. The repository figures are derived from git, not from an
  artifact, and the commands are in the report: the five ledger PDFs hold **132.4 MB of a 524.28 MiB
  pack**, `docs/ENGINE.pdf` alone **108.4 MB across ten versions**, and one rebuild pass over the five
  costs **16.6 MB of pack, 13.9 MB of it ENGINE**. **The saving is entirely future — untracking them
  recovers zero bytes of existing history.** `node build/build_pdfs.js --check` went from 4 documents
  to rebuild to 2, both pre-existing and neither a ledger; it exits 1 before and after.
- **Supersedes.** Nothing. No published figure changed value.
- **Owed to the next major.** `docs/ABRA-technical-docs.md` and `docs/SUMMARY.md` describe the
  publishing procedure and must record that division ledgers carry no PDF.

---

## [Unreleased] — 2026-09-06 — the documentation rule itself

Rows written before the release that carries them. The publish pass renames this heading to the
version it lands as. **An `[Unreleased]` row COUNTS as owed** — a heading nobody remembers to rename
would otherwise be a debt that never appears, which is the failure the backlog exists to refuse.

- **What changed.** The documentation rule itself. `CLAUDE.md` now requires this page per change and
  the full living-document set per major release; `tests/test-docs-current.js` gained the notes-page,
  major-release and owed-backlog clauses; `.githooks/pre-commit` blocks a commit that moves code and
  records nothing here; `engine/docs_scan.js` derives the backlog and prints it under `--owed`.
- **Measured.** NO FIGURE. The reason for the change is a cost, and it is stated where the rule is —
  `CLAUDE.md`, with the PDF and repository sizes that were measured on 2026-09-06.
- **Supersedes.** Nothing. No published figure changed value in this pass.
- **Owed to the next major.** `docs/ABRA-technical-docs.md` and `docs/SUMMARY.md` describe the
  documentation procedure and will need the new rule; the white paper and the deck do not state it.

---

## Backlog at the moment this page was created

Nothing was owed. The full living-document set was published at 5.266.0 on 2026-09-06 and every
unpinned living document carried that header when this file was written, so the first major release
after it starts from a clean floor rather than inheriting an untracked debt. That is luck of timing,
not a property of the design, and it is recorded here so a later reader does not read the empty
backlog as evidence that the mechanism was never exercised.
