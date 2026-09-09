# ABRA — architecture review, 2026-09-09

**Dated record, not current state.** Every number in this document cites the command that produced
it or the artifact field (`path:field`) it was read from. Do not take a number out of this file:
`node engine/status.js` is the state, `node engine/open_work.js` is the open work.

- **Commit reviewed:** `d6789951` (2026-09-09 11:53 -0400, "Five failure shapes and six sources this
  session paid for, written where the next one already reads").
- **Produced by** seven read-only division agents (ENGINE, MEASURE, OPS, a code review, a
  test-mutation pass, a store-and-authority forensics pass, a causal-claims-and-boundary audit) plus one
  worktree mutation pass, coordinated and verified by the session coordinator. Where a claim below says
  "coordinator confirmed", the command and output are in the coordinator's verification log for this
  session; where it says "per report", the receipt is in the named report and was not independently
  re-run.
- **Serves three commands Will invoked today:** the CTO engineering review (verdict), the
  principal-architect systems audit (rules with originating failure and enforcing check), and the
  "everything to address before 6.0.0" list. It also carries the audit-report deliverable (findings,
  changes, corrected numbers, causal-claims audit, what could not be done).
- **Reports it draws on** (all dated 2026-09-09, all historical by construction):
  - `docs/_reports/2026-09-09-pre-600-engine-review.md`
  - `docs/_reports/2026-09-09-pre-600-measure-review.md`
  - `docs/_reports/2026-09-09-pre-600-ops-review.md`
  - `docs/_reports/2026-09-09-pre-600-code-review.md`
  - `docs/_reports/2026-09-09-pre-600-test-breaks.md`
  - `docs/_reports/2026-09-09-pre-600-store-and-authority.md`
  - `docs/_reports/2026-09-09-pre-600-causal-and-boundary.md`
  - `docs/_reports/2026-09-09-thesis-defence-notes.md` (companion to
    `docs/THESIS-DEFENCE-REVIEW-2026-09-09.md`, which this document links and does not duplicate)
- **Vocabulary, expanded once.** MEDICHAM is the in-house battle simulator
  (`engine/medicham2-browser.js`). "The authority" is the pinned checkout of Pokémon Showdown, the
  official simulator, at commit `20ad99ff`. "The gate" is the computed quarantine gate in
  `engine/status.js` / `engine/quarantine.js` that decides whether MEDICHAM is correct enough for
  anything downstream of it to be quoted. "The differential" is `engine/game_differential.js`, which
  plays the same games in both engines and compares them turn by turn; its artifact is
  `data/game-differential.json`. "The store" is the append-only corpus of real ladder games. "A release"
  is a frozen copy of the engine's source files cut by `engine/engine_release.js`, identified by a
  twelve-character digest. "The pinned pool" is `data/team-pool-frozen`, a frozen sample of real ladder
  teams. MAG, MILTANK, PORYGON2, DODUO and the R1–R4 series are models and measurements downstream of
  MEDICHAM; they are QUARANTINED and none of their figures is quoted here — the word "withheld" marks
  each place one would otherwise appear.

---

## Executive summary

**What was found.** The headline claim 6.0.0 would publish — "MEDICHAM agrees with Showdown on every
board, 0 of 958 games" — is true of the 958 games it counts and is not yet a claim about the run. The
run played 961 games. Three were removed by a rule that voids a game when the two engines' dice
addresses stop agreeing, and every one of those three is a game whose boards parted
(`data/game-differential.json:mid_void.void_game_tags[].board_parted_at_turn` = 4, 6, 3; coordinator
confirmed). The counterexamples left the denominator before the ratio was taken. Separately, the corpus
under every store-derived figure is missing 15,862 games: the 2026-09-06 sharding cutover cut shards
from a local file two weeks behind the tracked one, and the notes row for that change reads
"Supersedes. Nothing." — 11,110 ladder and 4,752 bo3 game ids are in the last committed monolith
(`d2a418a5`) and in no tracked shard (coordinator confirmed by id-set difference). The release every
6.0.0 artifact stamps, `b730e44f3314`, is not in the repository (0 tracked files under
`data/releases/b730e44f3314`; 26 of 636 releases tracked; `.gitignore:174`). A scheduled GitHub job
rewrites a frozen engine source on 2026-09-11 07:00 UTC. The documentation-currency gate cannot see a
wrong headline number (a mutation changing `27 of 961` to `41 of 961` in `docs/MODELS.md` passed
byte-identically). The test suite is 150 passed / 27 failed / 0 skipped of 177 with no red waived by
name, including a registered gate at exit 1. Five refuted causal claims stand in living documents, one
in `CLAUDE.md` itself. The white paper states the opposite of three of its own artifacts. The thesis
defence returned MAJOR REVISIONS with twelve required analyses.

**What was fixed this session.** Three of the findings above are closed, each with a receipt the
coordinator re-ran. **The store** (finding 1): the 11,110 ladder and 4,752 bo3 games are back in five
new write-once shards — tracked ids ladder 81,269 → 92,379, bo3 28,049 → 32,801, ots 4,167 unchanged;
`comm -23` of `d2a418a5`'s ids against all shards reads 0 for ladder and 0 for bo3 (coordinator
confirmed, both stores); no existing shard changed. The check that would have caught it now exists:
`build/compress-stores.js --check` asserts the shards carry every id git tracked at `HEAD~1`, shown red
on a one-row break and red on a worktree replay of the cutover (`LOST 11513` / `LOST 5764`). **The
cron** (finding 5): `smogon-stats.yml` now writes `data/smogon-priors.observed.json` and restores the
frozen source; workflow-only, so `engine_release.js drift b730e44f3314` reads NO-DRIFT (coordinator
confirmed). **The documents** (findings 7 and 8): five refuted causal claims rewritten across 8
locations, 22 figures withdrawn or replaced across 21 locations in 7 documents, and
`tests/test-docs-current.js` went 32/1 → 33/0 (coordinator re-ran: 33 passed, 0 failed). The three
white-paper sections now state what their artifacts say; the re-analyses the defence asked for (T1–T5)
are still owed. This lands as MINOR 5.275.0 — 22 published figures moved under an unchanged basis.
Every file, diff and test result is in §3; the corrected numbers are in §4.

**What is still broken.** Everything in §2 marked BLOCKS 6.0.0 that §3 does not close: the three void
games need a per-game attribution (engine or instrument) before "0 of 958" can be printed as "correct";
the roster gate passes on 139 of 202 abilities compared; the narration clause is red at 12 of 961 across
13 causes; 27 reds; the docs gate's two blind spots; the release evidence chain.

**What could not be verified.** The stranded-release count across all 636 releases (the instrument
dies at a 2–3 GB heap); whether `engine/side_selection_census.js` is red (code review says exit 1,
coordinator observed exit 0); the cause of the residual trio; the share of living-document paragraphs
the docs gate's `QUALIFIED` exemption removes; the thesis's twelve generators under the current quality
filter (none re-run). Full list in §6.

**VERDICT: FIX THEN SHIP.**

This is not a rebuild candidate. The instruments that found every item above are this project's own —
the void tags, the by-cause totals, the release stamps, the id sets in git history — and most of the
fixes are hours. It is not shippable today because, if 6.0.0 ran as the tree stands and was wrong, the
failure is not a crash. It is a published sentence, "MEDICHAM agrees with Showdown on every board",
resting on a denominator that excluded its own three counterexamples, measured on a release nobody can
re-open, over a corpus missing 15,862 games nobody knew were gone — a confidently wrong number wearing a
receipt, which is the exact failure this project says it exists to prevent.

**What the team must change to keep confidence** (the pre-6.0.0 list in §8, condensed): restore the
15,862 games and add the id-superset check to the cutover; attribute the three void games and print
"0 of 958 usable, 3 voided, N engine" in those words; track `b730e44f3314` with `git add -f`; stop
the smogon cron writing a frozen source before Thursday; make the docs gate compare the value at the
claim; fix or waive by name every one of the 27 reds; strike the five refuted causal claims; rewrite
the three white-paper sections from their artifacts' verdict fields; state the compared set (139 of
202) wherever the roster is cited; add the second publisher to the WHO MAY WRITE table.

---

## Findings, ranked by blast radius

Ranking rule: what could put a wrong number in front of a reader first; untidiness last. Severity is
one of BLOCKS 6.0.0 / SHOULD FIX BEFORE / DEFER WITH REASON. "Fixed" is stated only where a fix report
or a coordinator command says so; otherwise "No".

### 1. The sharding cutover silently dropped 11,110 ladder and 4,752 bo3 games from the tracked store

- **What is wrong.** On 2026-09-06 the monolithic compressed stores were replaced by dated shards cut
  from the LOCAL plain file, which had diverged from origin's tracked copy for two weeks. The
  comparison that would have caught it — shards versus the tracked `.gz` they replaced — was never
  made; the cutover was verified against the live local file ("IDENTICAL 12 shard(s) -> 76833 rows",
  `docs/_reports/2026-09-06-store-sharding-and-reclaim.md:41-56` per the forensics report) and the
  notes row (`docs/RUNNING-NOTES.md:573` block) declares "**Supersedes.** Nothing. No published figure
  changed value."
- **How it was proved** (coordinator):
  `git show d2a418a5:data/games.ladder.jsonl.gz | gzip -dc | grep -o '"id":"[^"]*"' | sort -u | wc -l`
  → 88346; the same over `data/parsed/games.ladder/*.jsonl.gz` → 81269; `comm -23 mono.ids shard.ids |
  wc -l` → **11110** (in the monolith, in no shard); `comm -13` → 4033 (new since cutover); bo3
  `comm -23` → **4752**. `git log -1 d2a418a5` → 2026-09-06 15:34:02 +0000 (an `abra-bot` ingest);
  `git log -1 18432bcb` → 2026-09-06 16:25:38 -0400 (the cutover, 51 minutes later).
- **What it could have put in front of a reader.** Every store-derived figure (usage, bring rates,
  `data/meta-usage.json`, the legality verdict, the quality funnel) computed on a corpus 15,862 games
  short, under a row that says nothing changed. The workflow's own shrink guard could not see it: its
  baseline is `wc -l` of the store restored from shards, so a shard set that starts short is the new
  floor (per the forensics report, `ingest.yml` "Refuse to proceed if a store shrank").
- **Recoverable.** History is permanent; `git show d2a418a5:...` holds every row. 3,510 of the 11,110
  also have raw logs in tracked `data/raw/` shards; 7,600 exist only as parsed rows (per report).
- **Fixed? FIXED** (`docs/_reports/2026-09-09-fix-store-recovery.md`). Recovered from `d2a418a5` into
  five new shards, `data/parsed/games.ladder/20260909T1708-{00,01,02}.jsonl.gz` and
  `data/parsed/games.bo3/20260909T1708-{00,01}.jsonl.gz`; tracked ids ladder 81,269 → 92,379, bo3
  28,049 → 32,801, ots 4,167 unchanged. Proof of closure: `comm -23` of `d2a418a5`'s ids against all
  shards → **0** ladder, **0** bo3 (coordinator re-ran both); `git diff --stat HEAD -- data/parsed`
  empty (no existing shard changed). The missing check landed too: `build/compress-stores.js --check`
  now asserts the shards ⊇ the ids tracked at `HEAD~1` in either form — green on the tree in 8.7 s,
  red on a one-row sandbox break, red on a worktree replay of `18432bcb` (`LOST 11513` ladder /
  `LOST 5764` bo3). Still owed: wiring `--check` into `ingest.yml` (it runs from
  `tests/test-workflow-paths.js` only; the runner's shrink guard still measures against itself).
- **Severity: BLOCKS 6.0.0. Owner: OPS (recovery) and MEASURE (the missing superset check).**

### 2. The three games the void rule excluded are the three games whose boards parted

- **What is wrong.** `void_games_counted_against_the_engine: false` is a rule, not a measurement. A
  game whose boards part will have disagreeing dice addresses from that turn on, so the rule is
  structurally biased toward removing exactly the games the bar exists to count. "BOARD-MATERIAL 0 of
  958" is the count after the counterexamples left the denominator.
- **How it was proved** (coordinator, `node -e` over `data/game-differential.json`): `state.games`
  958, `state.games_board_never_diverged` 958, `state.games_void_excluded` 3; `mid_void.void_games` 3,
  `mid_void.usable_games` 958, `mid_void.diverged_among_usable` 13; `mid_void.void_game_tags` three
  entries, `why` "low-identity", `board_parted_at_turn` 4 / 6 / 3; `mid_void.by_reason`
  shared-addresses-agree 958 (diverged 13), low-identity 3 (diverged 3). Also
  `end_state[0].summary.by_cause_totals.games_board_material` = 3 (2 same turn, 1 parted later) and
  `verdicts` = SAME-END-STATE 958, DIFFERENT-END-STATE 2, THREW 1.
- **What the three are** (ENGINE report §1x, from `first_divergences`): (a) a charge move that
  announced one body and struck the other — turn 3, `omit-spread ...2658645239`; the authority KO'd the
  announced target, this engine wrote a resisted hit on its partner; Phantom Force, 1,701 pool slots,
  same release path as Solar Beam (15,867) and Electro Shot (9,600); (b) a Future Sight slot-condition
  end ordered against a Reflect side-condition end differently, board parted at turn 6 —
  `omit-spread ...2657358877`; (c) a post-switch Scorching Sands burn applied here and not there,
  turn 4 — `omit-protect ...2662758209`, the shape the session-close attributes to the INSTRUMENT
  (`freshBodies` dropping `_switchKey`, proven with a control on a different game). "Probably the
  instrument" is not an attribution.
- **What it could have put in front of a reader.** "0 of 958" printed as "correct against Showdown"
  with two DIFFERENT-END-STATE games — one a KO versus a resisted hit, which is winner-shaped — sitting
  outside the count.
- **Fixed?** No. Owed: one probe per game and an attribution; then the sentence reads "0 of 958
  usable, 3 voided, of which N were the engine", with N derived.
- **Severity: BLOCKS 6.0.0. Owner: ENGINE (attribution), MEASURE (the rule's bias, stated in the
  artifact).**

### 3. The documentation-currency gate cannot see a wrong headline figure

- **What is wrong.** Two independent mechanisms in `engine/docs_scan.js`. (1) `:626` `QUALIFIED` is a
  word list (`retract|withdraw|superseded|void|...|prior|former|previously|...`) and `:807` skips the
  WHOLE paragraph if any word matches — `docs/MODELS.md:7` contains "superseded", so every figure in
  the ledger's headline paragraph is unchecked. (2) `:496-499` `artifactHas` tests membership of the
  figure in the SET OF EVERY NUMBER in the cited artifact; `data/game-differential.json` (471 KB)
  contains the token `41` on 5 lines and `27` on 7, so a wrong headline whose digits occur anywhere in
  the file passes.
- **How it was proved** (test-breaks report (h), in a worktree at `d6789951`): `27 of 961` → `41 of
  961` in `docs/MODELS.md:7`: exit 1, 7684 B / 105 lines, byte-identical to green, "no new entries
  (baseline 61, now 61)". `27 of 962`: same. A NEW paragraph with `777 of 961`: caught. The same new
  paragraph with `41`: not caught. The coordinator read the two source lines cited.
- **What it could have put in front of a reader.** Any wrong figure in any paragraph that mentions a
  retraction, and any wrong figure whose digits appear somewhere in a large artifact — with the gate
  green. MEASURE §9 adds a third, bounded gap: a figure whose only citations are `data/*.js` bundles is
  skipped entirely (`:803` `if (!sets.length) continue;`); seven such lines in the living set.
- **Fixed?** No. The fix shape is to compare the value at the claim's named field, not
  membership in the artifact, and to exempt the SENTENCE that carries the qualifier, not the paragraph.
- **Severity: BLOCKS 6.0.0** (the gate that would catch every other document error in this list is
  blind to the class that matters). **Owner: MEASURE.**

### 4. The release every 6.0.0 artifact stamps is not in the repository

- **What is wrong.** `data/game-differential.json`, `data/all-mechanics-fire.json` and
  `data/roster.{moves,items,abilities}.json` all stamp `engine_release: b730e44f3314`. That directory
  is untracked.
- **How it was proved** (coordinator): `git ls-files data/releases | grep -c release.json` → 26;
  `ls data/releases | wc -l` → 636; `git ls-files data/releases/b730e44f3314` → nothing;
  `.gitignore:174` `data/releases/`. The ignore block's own text (`.gitignore:167-173`) says to add a
  cited release deliberately with `git add -f data/releases/<id>`. It has not been.
- **What it could have put in front of a reader.** After a clone, or after this disk, the evidence
  chain for every 6.0.0 figure ends at a twelve-character id. CLAUDE.md calls a stamped release "the
  first thing in this repo that can be VERIFIED rather than assumed" — only if the bytes are in the
  repo. MEASURE §4 adds that the id is not reproducible on another machine either: nine of the 27
  SOURCES are CRLF on disk and unpinned, so a fresh checkout digests differently (the read side is
  EOL-insensitive; the ID is not).
- **Fixed?** No. One command: `git add -f data/releases/b730e44f3314`.
- **Severity: BLOCKS 6.0.0. Owner: MEASURE.**

### 5. A scheduled job rewrites a frozen engine source on 2026-09-11 07:00 UTC

- **What is wrong.** `.github/workflows/smogon-stats.yml` runs `node engine/smogon_priors.js` on a
  cron and commits `data/smogon-priors.json`. `engine/smogon_priors.js:219` stamps `generated: new
  Date().toISOString().slice(0,10)`, so the bytes change on every run even with no new month.
  `data/smogon-priors.json` is a frozen SOURCE (`engine/engine_release.js:150`). Every release cut
  before the run drifts; every measurement on it becomes "engine moved since".
- **How it was proved** (coordinator): `grep -n 'generated' engine/smogon_priors.js` → `:219`;
  `grep -n 'smogon-priors' engine/engine_release.js` → `:150` in SOURCES; the workflow → `:17` cron
  `0 7 4 * *`, `:18` cron `0 7 11 * *`, `:83` `git add data/smogon-stats data/smogon-priors.json
  data/smogon-priors-bo3.json data/mew.js`; `data/smogon-priors.json` `"generated":"2026-09-04"`;
  `git log -3 -- data/smogon-priors.json` → `441196b8` 2026-09-04, `89d86b93` 2026-08-11, `c1e2ec2f`
  2026-08-04, all `abra-bot`. The ingest workflow (`ingest.yml:236-252`, per OPS) documents this exact
  failure for `move-priors.json` and fixed it by writing an `.observed` table; the smogon workflow was
  never given the same treatment.
- **What it could have put in front of a reader.** Three prior bot commits already moved this file;
  the next one lands mid-6.0.0 and every release cut this week reads "1 of 27 files moved since".
- **Fixed? FIXED** (`docs/_reports/2026-09-09-fix-smogon-cron.md`). Workflow-only: the rebuild step
  now runs `node engine/smogon_priors.js && cp -f data/smogon-priors.json
  data/smogon-priors.observed.json`, then unconditionally `git checkout -- data/smogon-priors.json`,
  and the `git add` line stages the observed twin instead of the frozen source. The hazard was proven
  before the edit: a same-month run moved **2 lines** in each priors file, both the `generated` date,
  byte-identical with the date masked. The tree digest did not move — `node engine/engine_release.js
  drift b730e44f3314` → **NO-DRIFT** (coordinator confirmed). `tests/test-workflow-paths.js` staging
  clause 4 of 4. `data/smogon-priors.observed.json` is seeded and must be `git add`ed with the commit.
  `data/smogon-priors-bo3.json` stays on the direct path: it is NOT a frozen source (coordinator
  confirmed — `SOURCES` mentions it only in a comment; its readers are under `web/`).
- **Severity: BLOCKS 6.0.0** (time-boxed: Thursday 07:00 UTC). **Owner: OPS.**

### 6. 27 red tests, none waived by name, including a registered GATE at exit 1

- **What is wrong.** `cmd /c tools\lownode.cmd tests\run-all.js` (MEASURE §1, 16:03–16:48Z, log 848
  lines, `EXIT=1`): **150 passed, 27 failed, 0 skipped** of 177. None is waived by Will by name in any
  record the review found. The session-close report carried three reds "openly"; the suite has 27.
- **Groups** (MEASURE §1): **A** — 8 files that are deliberate consequences of two owner decisions
  (web paused: `test-site-sync`, `test-site-data-fresh`, `test-web-quarantine-loaders`,
  `test-web-status`; MAG paused: `test-forced-switch`, `test-team-preview-race`, `test-wiring`,
  `engine/em_validation.js`) — these need a named waiver each, or the decisions reversed. **B** — 17
  instrument / docs / store reds (`test-lownode` priority arm raced; `test-fixture-legality` walked
  another agent's worktree; `test-counter-init` two NaN counters; `test-mutation-coverage`;
  `test-prng`; `test-policy-promote`; `test-workflow-paths` "a store has rows in no shard";
  `test-stadium-roster`; `test-docs-quarantine` — a withheld MILTANK figure in
  `docs/RUNNING-NOTES.md:286`; `test-quality` clean share 31.3% vs 28.0% recorded; `engine/selftest.js`;
  `engine/conformance.js`; `engine/provenance.js` red by construction until the re-run;
  `engine/validate_selfplay.js` 89 duplicate ids; `engine/sanity_check.py` 2 bad winners;
  `engine/identity_audit.js`; `test-board-browser`). **C** — 2 engine reds:
  `engine/gate_fail_and_silent.js` and `test-pinch-family` (1 of 61).
- **How the gate red was proved** (coordinator): `node engine/gate_fail_and_silent.js ; echo $?` →
  exit 1 (`LIVE 1 cause(s) over 1 game(s) — event missing from medicham2 :: |-fail|p2a <>
  |move|p2b|rockslide`). `node engine/where.js --gates` lists it under a CLOSED register row (#241) per
  the code review — a closed row whose regression gate is red.
- **What it could have put in front of a reader.** A major cut over 27 unwaived reds is "one of the
  known failures" twenty-seven times, which is the banned state by name.
- **Fixed?** Not by this session's three fixes, which touched one gate directly
  (`test-docs-current` 32/1 → 33/0) and one clause of `test-workflow-paths` (the store-currency clause,
  green after the recovery per the store report). The post-fix suite count is in §3.
- **Severity: BLOCKS 6.0.0** as a process fact. **Owners:** A — Will (waivers); B — MEASURE / OPS; C —
  ENGINE.

### 7. Five refuted causal claims stand in living documents, one in CLAUDE.md

- **What is wrong.** The causal audit classified 34 claims: 20 TESTED, 9 HYPOTHESIS, **5
  REFUTED-BUT-STILL-STATED** (plus one in a live script header). Every refuted one is a claim about
  infrastructure — git, a timer, a heading — where the retraction registry cannot help because there is
  no number to strike.
- **The one the coordinator confirmed.** `sed -n '354,358p' CLAUDE.md` → "The union driver is the
  confirmed cause of the store duplicating ... See CHANGELOG 3.1.2." `sed -n '26611,26620p'
  CHANGELOG.md` (under 3.23.0) → "a fourth event — 009af26 'store: dedupe after rebase (137 duplicate
  lines)' — sits at depth 625, with no active union attribute, 208 commits after the driver was removed
  ... Recorded as a hypothesis with a known counter-example rather than as the cause. A fifth event is
  visible at depth 14: a commit published a store of 0 lines." CLAUDE.md states as confirmed what the
  CHANGELOG downgraded to hypothesis-with-counter-example. The forensics report goes further (§5 below):
  three of six duplications happened with no driver at all.
- **The other four** (per the causal report, file:line): `docs/ARCHITECTURE.md:42-43` blames `merge
  -X ours`, the diagnosis 3.1.2 retracted the same day; `docs/SEARCH.md:2506` says an auto-commit
  timer "publishes on a timer here" — dead since 2026-07-25, measured dead 2026-08-06;
  `docs/ENGINE.md:404` heading "ABOUT ONE IN SIX" and `:410-411`, `:419-420` "3 of the 19 causes ...
  6.0.0 should say so in those words" — retracted to 2 of 19 at 5.273.0 and at `:306-311` of the same
  file; `CLAUDE.md:577-579` STALE marker says four MEDICHAM defects "were not re-checked" when the
  record shows all four re-checked (five living-document copies say Weather Ball, Sand Rush and Damp
  "are retracted as defects and are correct").
- **What it could have put in front of a reader.** The `ENGINE.md:420` instruction is the dangerous
  copy: a 6.0.0 fold-in that follows it publishes a retracted rate.
- **Fixed? FIXED** (`docs/_reports/2026-09-09-fix-retractions.md` §A). All five rewritten across 8
  locations: `CLAUDE.md` (union driver → hypothesis supported inside the driver's window and
  unsupported outside, the prohibition on restoring it kept verbatim, and the sharding cutover recorded
  as the sixth shape; the DAMP marker's "not re-checked" sentence replaced with the four receipts),
  `docs/ARCHITECTURE.md:42-43`, `docs/SEARCH.md:2506` (clause struck with the date),
  `docs/ENGINE.md:404/412-413/418-419/423` (heading and instruction now read 2 of 19 per 5.273.0).
  `tests/test-docs-current.js` 33 passed / 0 failed after (coordinator re-ran). **One discrepancy with
  this review:** the record shows THREE doublings inside the union driver's window (7,040, 401 and
  8,139 lines — `CHANGELOG.md:26613-26615`, `.gitattributes:10-11`), not two; `CLAUDE.md` now states
  the record. Not edited, reported: `.gitattributes:9-11`, `ingest.yml:355-357` and `push-all.bat:9-10`
  are live files, not living documents, and still name the driver as THE mechanism.
- **Severity: BLOCKS 6.0.0** for R4 (an instruction to publish a retracted number); **SHOULD FIX
  BEFORE** for the rest. **Owner: MEASURE** (documents), ENGINE (`ENGINE.md`).

### 8. The white paper states the opposite of three of its artifacts — thesis defence MAJOR REVISIONS

- **Coordinator confirmed all three.** (a) WAR: `data/war.json:verdict` = "WORSE THAN A COIN AT EVERY
  REGULARISATION STRENGTH TESTED ... lambda=200 at 0.69358 against a coin's 0.69315";
  `docs/ABRA-whitepaper.md:1968` quotes 0.7048, `:1986` "WAR barely clears it". (b) NMF:
  `engine/nmf_roles.py:154` `ARCH_RANK = 6`; `data/nmf-roles.json` generated 2026-08-04,
  `archetype_rank` 6, `archetype_recon_error` 0.682; `data/nmf-rank-selection.json:shipped_rank`
  stability 0.8148 against a null of 0.9218, `excess_over_null` −0.107; the white paper `:1978` says
  "(error 0.53)" and `:1981-1983` calls topic coherence "the next refinement". Two prior committees
  asked for this item. (c) CHOMP-EV: `engine/chomp_ev.js:120` `if (!CLEAN.has(g.id)) continue;` sits
  ABOVE the qualify test at `:128-129`, so the selection audit can never receive a game;
  `data/chomp-ev.json:selection_audit` reads `eval_mean_turns 8.12, excluded_mean_turns null`; the
  white paper `:1697-1699` reports "6.5 turns / 1280 rating vs 6.08 / 1267 excluded ... making the null
  conservative" — four numbers in no artifact, from a comparison never made.
- **What it could have put in front of a reader.** It already has. These are published sentences.
- **Fixed? FIXED as a retraction** (`docs/_reports/2026-09-09-fix-retractions.md` §B): 22 figures
  withdrawn or replaced across 21 locations in 7 documents, every replacement READ from the artifact on
  disk (`war.json`, `nmf-roles.json`, `nmf-rank-selection.json`, `chomp-ev.json`, `policy-eval.json`),
  none re-run. The derived retraction registry now refuses 35.9%, 71.6% and 1,205 repo-wide; 52.4% and
  1280/1267 were deliberately NOT registered because a strong entry would accuse `docs/MEASURE.md`'s
  majority-class cells and `docs/ENGINE.md:35712` ("1,280 lines"). `tests/test-docs-current.js` 33/0.
  **The re-analyses remain owed** — T1–T5 in §8: the WAR split, the NMF rank, a real CHOMP-EV audit,
  the §1-ceiling artifact, and the store-layer re-run on quality filter 1.3.0 (every artifact read
  predates 2026-08-27).
- **Severity: BLOCKS 6.0.0** for the three sentences (a retraction never waits for a major; CLAUDE.md
  living-docs rule). The other nine defence items are SHOULD FIX BEFORE. **Owner: MEASURE.** See §9.

### 9. The store-duplication history: six duplications, the union driver supported for two, and no test asserts id uniqueness or monotone growth across a commit

- **What is wrong.** The forensics report walked all 101 commits of `data/games.ladder.jsonl` across
  all refs. Of six duplication events it counts on the ladder store, the union driver was active for
  three (#3, #4, #5) and a rebase replay is visible for two (#3, #5); three (#2, #6, #8) happened with
  no driver. The one merge commit in the whole history (`1d70e0f6`, blamed by CHANGELOG 2.10.0)
  added exactly 169 lines and duplicated nothing. No check anywhere asserts tracked-store ⊇
  previously-tracked-store, local plain store == HEAD shards, bo3 id uniqueness, or gz/shard integrity
  except when `--verify-parsed` is run by hand (report §1c). Per-incident table in §5.
- **What it could have put in front of a reader.** Finding 1 is the seventh row of this table. The
  bo3 store was ~40% duplicate lines for ~2.3 days (#7) and nothing said so.
- **Severity: SHOULD FIX BEFORE** (the check); the recovery is finding 1. **Owner: MEASURE.**

### 10. The engine work proper: 13 narration causes, the Infiltrator-through-screens hole, the substitute family

- **Narration count, reconciled.** `status.js` prints "12 of 961"; ENGINE reports "13 of 958 plus 3
  void". Both are read from the same artifact and both are right about their population:
  `mid_void.diverged_among_usable` = 13 narration-only games among the 958 usable;
  `engine/quarantine.js:2316` subtracts the one CLOSETED perish-drain row (a protocol declaration), so
  `undeclared` = 12; the clause's denominator is the artifact's `games` = 961, which includes the 3
  void games. So "12 of 961" is a 958-population numerator over a 961-population denominator. Say
  "12 undeclared of 13 narration-only among 958 usable; 3 void" — never one bare ratio.
- **The 13 causes by mechanism** (ENGINE §1): the substitute family, 4 causes, one mechanism (this
  engine's arrival loop is INSIDE `_stepApply`, the authority's is outside `spreadMoveHit`; plan
  written in commit `b2508865`, not edited); the residual trio, 3 causes, UNEXPLAINED after six
  batches; Spicy Spray, 1, unblocked by reading `sim/battle.ts:789-790` (`DamagingHit` sorts by
  `compareLeftToRightOrder`, deterministic) with two false engine comments still standing at `:40323`
  and `:40250`; the perish `|upkeep|` drain, 1 (Perish Song 4,259 pool slots); Trick's `-fail`, 1 (a
  coarse mega-stone guard at `:31377` where the fine rule `itemRefusesTake` already exists at `:9909` —
  the FACTS-ARE-GLOBAL shape); post-KO switch-in order, 1; two singletons with derivations only.
- **Infiltrator through screens** (ENGINE §2): exactly one of 830 census rows carries
  `ignoresScreensAndSubs`, and it stages the substitute half. The screens half IS implemented
  (`:13785`) and has never been probed. A bypassed screen is a doubled damage roll — board-material.
  Four screens, not five: the fifth the brief named is `isNonstandard: "Past"` in the mod
  (`data/mods/champions/moves.ts:644-647`). The only tag whose name joins halves.
- **Severity:** the substitute family, Spicy Spray, perish drain, Trick, post-KO order — SHOULD FIX
  BEFORE; Infiltrator screens — BLOCKS 6.0.0 on the cheap-and-named grounds the session-close gave it;
  residual trio — DEFER WITH REASON (say the mutual-residual-KO corner is unmeasured). **Owner: ENGINE.**

### 11. The roster gate passes on 139 of 202 abilities compared

- **What is wrong.** `data/roster.abilities.json` (11:55:09Z, release `b730e44f3314`): matched 139,
  could-not-stage 44, control-not-quiet 14, deferred 5 (`scope`: in_scope 202 = 139 + 5 + 14 + 44).
  Items 142 of 148 (6 could-not-stage); moves 487 of 500 (10 could-not-stage, 3 deferred). The gate
  condition is "no FIRED-AND-BOARDS-DIFFER and no DID-NOT-FIRE"; COULD-NOT-STAGE and CONTROL-NOT-QUIET
  are neither. 32 of the 44 are "THE STAGING IS INERT" — a claim about the fixture, never about the
  mechanic. By pool usage the uncovered ones that matter: Compound Eyes (1,671 pool bodies, 0 census
  rows, roster inert), Imprison (1,046 slots) and Memento THREW on `pass, move 1` — a harness defect.
- **What it could have put in front of a reader.** A 6.0.0 sentence claiming 202 on evidence for
  139.
- **Severity: BLOCKS 6.0.0** as wording (state the compared set), SHOULD FIX BEFORE for the Compound
  Eyes probe and the Imprison/Memento throw. **Owner: ENGINE.**

### 12. The Cowork / Claude Code boundary is convention, and there is a second publisher not in the table

- **Per the causal-and-boundary report:** of five boundary clauses, 1 is ENFORCED (push credentials),
  1 is enforced for the race (git fast-forward + bound merge driver + serialised workflow), **4 are
  CONVENTION ONLY** (inbox-only, outbox-only, one-agent-at-a-time, suspect-figures). `git log -n 300`:
  250 commits by Will Hooper, **50 by `abra-bot`**; the WHO MAY WRITE table (`CLAUDE.md:194-198`) does
  not list it, and the cadence it does state ("hourly") is stale — `ingest.yml:5-16` moved the cron to
  every six hours on 2026-08-21. The merge-driver binding is per-clone and manual; nothing tests that
  it is bound.
- **Two instances this session of the one-at-a-time clause failing silently:** a peer session was
  running on this repo when the review started (it landed `d6789951`); and a git worktree at
  `.claude/worktrees/agent-af59bcfe6a6444960` was walked by `tests/test-fixture-legality.js` as repo
  source, making the main tree's suite red (MEASURE §1.B, §12).
- **Severity: SHOULD FIX BEFORE** (table row, `orient.js` driver-binding clause, worktree exclusion
  in sweeps). **Owner: OPS / MEASURE.**

### 13. Documentation debt: 51 of 100 notes rows owed, 119 figure edits, 40 lift / 24 stay, and no basis declared

- **Coordinator:** `node engine/open_work.js` → 51 of 100 notes rows owed, documents last folded at
  5.266.0, CHANGELOG top 5.274.0; `node engine/major_readiness.js` → living-doc rewrite 13 withheld +
  84 stale + 22 untraceable = 119 figure edits across 5 documents; re-run 40 LIFT / 24 STAY (STAY =
  MAG family + MILTANK); VERDICT NOT READY.
- **MEASURE §6/§11:** clause 5d would REFUSE a `6.0.0` entry today (`major_without_basis`), while two
  rows already declaring `Basis. CHANGED` (`docs/RUNNING-NOTES.md:366`, `:444`) sit unversioned and
  would refuse any `5.x`. 48 of 51 rows are `[Unreleased]` and unjudged. `engine/mew.js` is misfiled in
  LIFT — it loads MAG through `magnemite.js` (`:376`, `:661`) and MILTANK (`:550`); the predicate greps
  the generator's own source only.
- **Severity: BLOCKS 6.0.0** (write the basis row); SHOULD FIX BEFORE (mew.js to STAY; predicate
  follows one `require` hop). **Owner: MEASURE.**

### 14. The authority pin is stamped everywhere and consumed nowhere

- **Per the forensics and code reviews:** `engine/champions_sim.js:85` pins `20ad99ffc9a5…`;
  `actualCommit()` reads `git rev-parse HEAD`; **636 of 636** releases carry `showdown_commit`
  (`grep -l '"showdown' data/releases/*/*.json | wc -l`). `commit_matches` has **zero consumers**
  outside the file; `engine_release.js:608` only `console.error`s on a re-cut against a different
  commit. The checkout is not locally modified (`git -C ../pokemon-showdown status --short` → empty)
  and is 72 commits behind upstream as of the 2026-08-31 fetch. **4,335** `<file>.ts:<line>` citations
  (engine 1,266; tests 965; docs 2,104) are valid exactly as long as the checkout stays put, and none
  is content-verified.
- **Severity: SHOULD FIX BEFORE** (consume `commit_matches` in the differential's preflight; a
  `--fail-on-drift` on `cut`). **Owner: ENGINE.**

### 15. Everything else the reports carry, in one pass

| item | receipt | severity | owner |
|---|---|---|---|
| The test suite and instruments write to the tree: 15 tracked files modified by the run, including `data/mechanics-census.json` rewritten by `tests/test-arm-steering.js` (11:54:09Z → 16:21:25Z) — a pinned gate input | MEASURE §12 | SHOULD FIX BEFORE | MEASURE |
| The gate run carried no census pin: `steering.pinned false` (coordinator read) | `data/game-differential.json:steering.pinned` | SHOULD FIX BEFORE (pin on the re-run) | MEASURE |
| A frozen release still reads the live stores: `set_priors.js:286-296 observedSets()` opens `data/games.bo3.jsonl` / `games.ots.jsonl` at play time; `--team-store` pins the POOL, not the SET FILLER | code review §1.6 | SHOULD FIX BEFORE | ENGINE |
| `engine/mew.js` and `test-wiring.js` need a 6 GB heap and declare none; `test-wiring` red on the real tree (10 NOT WIRED, "consistent with, not proven" the MAG weights refusal) | test-breaks §3.1, MEASURE §1.A | SHOULD FIX BEFORE (re-run the day the weights load) | MEASURE |
| The oldest release `d3d04b669e18` fails its own manifest in the worktree (`medicham2-browser.js` manifest 645b93a3878f, snapshot f4bfddbb997d); real tree unverified | test-breaks §3.3 | SHOULD FIX BEFORE (verify) | MEASURE |
| Two hand-typed Pokémon tables in code: `MEGA_ABIL` (`medicham2-browser.js:8191-8207`, has a comparator in `test-effective-identity.js`); the 18×18 type chart `TC` in `engine/validate_damage.js:10-25` inside a GATE, no comparator | code review §3 | SHOULD FIX BEFORE (derive) | ENGINE |
| 45 of 237 `MEDI_*` knobs are named in no test — their red arm exists only in prose | code review §2 | SHOULD FIX BEFORE | ENGINE |
| 17 `tests/probe_*.js` are run by nothing (not the suite, not the register); `data/mutation-coverage.json` last generated 2026-08-22 | code review §2 | SHOULD FIX BEFORE | MEASURE |
| Three readers, three meanings for exit codes: run-all (2 = SKIP), `register_reality.js` (2 = UNDECLARED unless declared), `wire_ladder.js` (4 = refused) — ROADMAP #380 | code review §1.1 | SHOULD FIX BEFORE | MEASURE |
| `engine/where.js --artifacts` WHO-WRITES index is a 400-char proximity heuristic with verified false positives | code review §4 | DEFER WITH REASON | MEASURE |
| The pinned pool is gitignored — one laptop copy; only FROZEN.md digests are tracked | OPS §3 | SHOULD FIX BEFORE (copy out, verify sha256) | OPS |
| Local plain stores are five days behind origin (last written 2026-09-04 01:30); every unpinned local reader is behind | OPS §3, forensics §1d | SHOULD FIX BEFORE (`--restore-parsed`) | OPS |
| The legality verdict is a 2026-08-27 snapshot over 67,384 games; games since are unjudged | OPS §8 | SHOULD FIX BEFORE (refresh before any clean-store figure) | OPS |
| The live bot loads the quarantined weights; nothing shows it running since 2026-08-04 | OPS §5 | SHOULD FIX BEFORE (say so in the release) | OPS |
| Self-play store: 89 duplicate ids (#536); the generator is fixed, the store is not | OPS §4, forensics §1d | DEFER WITH REASON (quarantined, nothing in 6.0.0 reads it) | OPS |
| `register-reality.json` verdicts (2026-09-08T16:34Z) are a day and seven engine commits older than the engine they clear | MEASURE §12 | SHOULD FIX BEFORE | MEASURE |
| `docs/THESIS-DEFENCE-REVIEW-2026-09-09.md` has no version header and is not in the docs-currency baseline — clause 2b red on the next suite run | MEASURE §11 | SHOULD FIX BEFORE | MEASURE |
| Seven of eighteen named register rows are closed on the tree and open in the register (#315 refuted for Champions, #362, #393, #403, #319, #318, #528) | ENGINE §6 | DEFER WITH REASON (hygiene) | ENGINE |
| Two empty `catch(e){}` around tag reads (`:5500`, `:6275`): priority blocking silently becomes an empty map | ENGINE §10 | SHOULD FIX BEFORE | ENGINE |
| `tools/lownode.cmd` is LF on disk; LESSONS records an LF `.cmd` opening a prompt instead of running; `test-lownode` has no arm for the `:derive` path | code review §7 | SHOULD FIX BEFORE | OPS |
| 380 `split('\n')` sites vs 20 `split(/\r?\n/)`; 14 files pair a file read with a `$`-anchored regex; the docs_scan blindness was this class | code review §7 | DEFER WITH REASON (one `readText()`) | MEASURE |
| Damage differential has never applied a multi-hit move (`skipped_multihit 134`, `skipped_ability_multihit 17`); covered by roster + probe + census; declared band gap | ENGINE §5 | DEFER WITH REASON (state it) | ENGINE |
| The 100 MB wall is retired for the store: the `.gz` is untracked; largest tracked blob `data/games.r4-decided.jsonl` 44,940,683 B; pack still grows ~1.2 MB/day | MEASURE §12, forensics §1e | none | OPS |

---

## Changes made

Every file touched this session, what changed and why, from `git diff --stat` and `git status --short`
read at fill time (15 tracked files modified, 192 insertions / 87 deletions; 21 untracked additions)
plus the three fix reports. Nothing is committed at fill time. Test results before, from MEASURE §1:
**150 passed / 27 failed / 0 skipped of 177**, `EXIT=1`. After:

**151 passed / 26 failed / 0 skipped of 177**, `EXIT=1` (`cmd /c tools\lownode.cmd tests\run-all.js`
from PowerShell, 838 lines of output, after every fix above and after the restamp). Three reds went
green: `tests/test-lownode.js`, `tests/test-policy-promote.js`, `tests/test-workflow-paths.js` (the last
because the shard-superset guard is what it wanted). Two went red, **both caused by this session's own
store recovery**: `tests/test-medicham-coverage.js` and `tests/test-degradation-budgets.js` died at the
default Node heap (exit 134) because `data/games.bo3.jsonl` grew to 32,801 rows / 298 MB and both read a
store whole. Four scripts already red for their own reasons (`tests/test-quality.js`, `engine/selftest.js`,
`engine/provenance.js`, `tests/test-site-data-fresh.js`'s child) also began dying of heap instead of
reaching their verdict. All six now carry an `ABRA-HEAP: 4096` declaration that `tools/lownode.cmd` and
`tests/run-all.js` honour, `engine/status.js` passes the child's declaration when it spawns
`engine/provenance.js`, and each was re-run individually: medicham-coverage 134 → 0,
degradation-budgets 134 → 0 (11 of 11), provenance 134 → 0, quality 134 → 1 (its own pre-existing red),
selftest 134 → 1 (its own), site-data-fresh 1 → 1 with its "artifacts current" clause no longer passing
vacuously on an empty provenance text (`docs/_reports/2026-09-09-fix-heap-declarations.md`). The suite
was NOT run a third time; the after figure stands at 151 / 26 with those six re-run singly. The
remaining 26 reds are listed by name in `docs/_reports/2026-09-09-pre-600-measure-review.md` §1 and none
is waived; the worse half of the provenance finding — a plain `node engine/status.js --write` restamping
every ledger with `provenance: NOT DERIVED` and exiting 0 — is closed by the spawn fix.

**Version.** MINOR **5.275.0** — 22 published figures moved under an unchanged basis (SemVer clause 7;
the notes rows declare `Basis. unchanged`). No engine byte moved: `node engine/engine_release.js drift
b730e44f3314` → NO-DRIFT (coordinator confirmed), so no release re-cut is owed and every current gate
artifact still stamps a release that matches the tree.

### 3.1 The store recovery (finding 1) — `docs/_reports/2026-09-09-fix-store-recovery.md`

| file | diff | what changed and why |
|---|---|---|
| `data/parsed/games.ladder/20260909T1708-00.jsonl.gz` | new, untracked, 5,287 rows | recovered ladder rows, `date` span 2026-08-22 → 09-01; three ladder shards rather than one because the 32 MiB source cap split 66.5 MB of source |
| `data/parsed/games.ladder/20260909T1708-01.jsonl.gz` | new, untracked, 5,414 rows | same, 2026-09-01 → 09-06 |
| `data/parsed/games.ladder/20260909T1708-02.jsonl.gz` | new, untracked, 409 rows | same, 2026-09-05 → 09-06; the three carry **+11,110** rows in total |
| `data/parsed/games.bo3/20260909T1708-00.jsonl.gz` | new, untracked, 3,457 rows | recovered bo3 rows, 2026-08-22 → 09-04 |
| `data/parsed/games.bo3/20260909T1708-01.jsonl.gz` | new, untracked, 1,295 rows | same, 2026-09-04 → 09-05; the two carry **+4,752** rows in total |
| `build/compress-stores.js` | 63 (+45 / −18) | `--check` compared the shards to the LOCAL plain file, which was the thing that was wrong. It now also reads the ids git tracked at `HEAD~1` — both forms, `data/parsed/<store>/*.jsonl.gz` and the retired `data/<store>.jsonl.gz`, so a cutover between forms is inside the claim — and fails if any is absent from the shards on disk; it THROWS when `HEAD~1` cannot be read rather than passing quietly. The 18 deletions are `shardedCount()` and its comment, which existed for a 58 s measurement that re-measures at 2.2 s today. No new flag, file or knob. |
| `engine/dedupe_store.py` | 5 (+3 / −2) | wrote CRLF on Windows (`os.fdopen(fd, 'w', encoding='utf-8')` → `os.linesep`); shown red on a 5-row probe (5 CR bytes, sha moved) and fixed with `newline='\n'` BEFORE it touched the real store. Unfixed, the 15,862 recovered rows would have been published CRLF and `--verify-parsed` would have failed. |

Method: `--restore-parsed` the local plain stores to HEAD's shards (76,833 → 81,269 ladder, 25,522 →
28,049 bo3; the local file was a strict subset), append the `d2a418a5` monoliths, dedupe keeping the
first occurrence so every shared id keeps its tracked shard bytes (169,615 lines → 92,379 unique
ladder; 59,335 → 32,801 bo3; 0 unparseable), cut shards. ots needed nothing: its shard and the
monolith decompress to the same sha256 (`cd21077a4578afa3`).

Receipts, before → after: tracked ids ladder **81,269 → 92,379**, bo3 **28,049 → 32,801**, ots 4,167
unchanged (coordinator confirmed). `comm -23` of `d2a418a5`'s ids against all shards: **0 / 0 / 0**
(coordinator re-ran ladder and bo3). `--verify-parsed` IDENTICAL on all three stores (ladder
`cde0fa05d5177469`, 25 shards, 481,072,929 B; bo3 `072c4c61ed23bea3`, 19 shards, 298,313,305 B). `git
diff --stat HEAD -- data/parsed` empty — no existing shard changed (coordinator confirmed). The new
`--check` clause: green on the tree in 8.7 s (`carries every id HEAD~1 tracked (81269 / 4167 /
28049)`); **red** on a one-row sandbox break (`LOST 1 id(s)`, exit 1); **red** on a worktree replay of
`18432bcb` with `HEAD~1 = 0601a600` (`LOST 11513` ladder, `LOST 5764` bo3, exit 1 — the loss AT the
cutover; later ingests re-pulled 403 and 1,012 from the rolling replay pool, leaving today's 11,110 /
4,752). `tests/test-workflow-paths.js` 5 passed / 0 failed, 9.3 s. `engine/sanity_check.py` **95/1 →
94/2**: the added red is `brought` = 6 on both sides of `gen9championsvgc2026regmb-2676161109`, a record
`d2a418a5` already tracked — the recovery surfaced a pre-existing ingest defect, it did not create one.

Still owed (store report §11): wire `--check` into `ingest.yml` after its shard step (on a
`fetch-depth: 1` checkout it throws on `HEAD~1`, which is the loud answer); the runner's shrink guard
still measures against itself; `sanity_check.py` stays red on 2 parser clauses (OPS).

### 3.2 The Smogon cron (finding 5) — `docs/_reports/2026-09-09-fix-smogon-cron.md`

| file | diff | what changed and why |
|---|---|---|
| `.github/workflows/smogon-stats.yml` | 19 (+16 / −3) | the rebuild step now runs `node engine/smogon_priors.js && cp -f data/smogon-priors.json data/smogon-priors.observed.json` followed by an unconditional `git checkout -- data/smogon-priors.json`; the `git add` line stages the observed twin instead of the frozen source; a comment block states the defect, the proof and where promotion lives (a hand run of `node engine/smogon_priors.js`, the command that already exists). Done in the workflow and not the script because `engine/smogon_priors.js` is itself in `SOURCES` (entry :138) and a flag would have moved the digest and stranded `b730e44f3314` — moving the digest to stop the digest moving is the wrong trade. |
| `data/smogon-priors.observed.json` | new, untracked, 1.3 MB | seeded from the same run (`generated: 2026-09-09`) so the path exists on the first cron run even if the derivation fails — a `git add` on a missing path exits 128 under `bash -e`, the exact `test-workflow-paths` defect. **Must be added with the commit.** |

Receipts: the hazard proven before the edit — a same-month run (`2026-08` in, `2026-08` out) moved
**2 lines** in `data/smogon-priors.json` and 2 in `-bo3.json`, both the `generated` date, JSON
byte-identical with the date masked; the three bot commits (08-04, 08-11, 09-04) were each that
rewrite. After the edit: `node engine/engine_release.js drift b730e44f3314` → **NO-DRIFT** (coordinator
confirmed). YAML parses, six steps. `tests/test-workflow-paths.js` staging clause **4 of 4**, including
`smogon-stats.yml stages data/smogon-priors.observed.json`. `data/smogon-priors-bo3.json` stays on the
direct path — it is not a frozen source (coordinator confirmed: `SOURCES` names it only in a comment;
its readers are under `web/`). Nothing under `engine/` edited.

### 3.3 The retractions (findings 7 and 8) — `docs/_reports/2026-09-09-fix-retractions.md`

| file | diff | what changed and why |
|---|---|---|
| `CLAUDE.md` | 23 (+20 / −3) | R1: the union driver "confirmed cause" → hypothesis supported inside the driver's window (three doublings, not two — see finding 7) and unsupported outside, prohibition on restoring the driver kept verbatim, the sharding cutover added as the sixth shape. R5: the DAMP marker's "not re-checked" sentence replaced with the four receipts (3.79.0, ROADMAP #100, `chargeSkippedByWeather`, `tests/probe_transform_faint_revert.js`); the dated 2026-08-08 paragraph untouched. |
| `docs/ARCHITECTURE.md` | 8 | R2: "7,040 duplicates from `merge -X ours`" → divergent reconciliations, with 3.1.2's withdrawal and 3.23.0's counter-example in a parenthetical; header v1.2 pin untouched |
| `docs/SEARCH.md` | 4 | R3: the auto-commit-timer clause struck (`~~…~~`) with the date; the digest-set conclusion stands on the dirty-tree reason alone |
| `docs/ENGINE.md` | 17 | R4: "ABOUT ONE IN SIX", "3 of the 19 causes", the Instruct/perish survivor and "about 3 causes … 6.0.0 should say so" each struck and restated as **2 of 19** with the 5.273.0 receipt; the instruction to 6.0.0 now carries the right number |
| `docs/ABRA-whitepaper.md` | 70 (+43 / −27) | 6 figure locations: WAR (`:1968`, `:1986`), NMF (`:1978`, `:1981-1983`), CHOMP-EV (`:1691-1698`), XATU (`:1676-1678`), §1 ceiling (`:1491-1495`) — see §4 |
| `docs/MODELS.md` | 9 | 4 locations: WAR row struck and artifact row added (`:1783`), NMF (`:1798`), CHOMP-EV (`:1687`), XATU (`:1405`) |
| `docs/ROLE-FAMILY.md` | 20 | 4 locations: WAR (`:62-63`, `:98-99`), NMF (`:81`, `:102-104`) |
| `docs/PUBLICATION.md` | 13 | 3 locations: WAR item heading (`:31-32`), CHOMP-EV n (`:21`), §1 ceiling (`:16`) |
| `docs/SUMMARY.md` | 7 | 2 locations: WAR (`:1310`), §1 ceiling 52.4% (`:1392`) |
| `docs/DEFENSE.md` | 3 | 1 location: `:247` 35.9% → 29.8% with the artifact field (a living document, corrected in place when the registry accused it) |
| `docs/MEASURE.md` | 5 | 1 dated correction note at `:5337`, where a 71.6% is PORY-NN's auc — a different measurement — so the registry does not accuse it |
| `data/docs-currency-baseline.json` | 13 | `unversioned_exempt` gains the two 2026-09-09 reviews; `known.retraction_violations` gains three entries for the dated thesis review (`1,205`, `35.9%`, `71.6%`), on the 07-28 review's precedent; the test itself rewrote `generated` → `2026-09-09T17:12:42Z`, `changelog_top_at_baseline` 5.270.0 → 5.274.0, and dropped two `citation_mismatches` (the XATU paragraph is now a QUALIFIED block) — its ratchet behaviour on a green run |

Receipts: **5 causal claims** rewritten across 8 locations; **22 numeric values** withdrawn or replaced
across **21 figure locations** in 7 documents (whitepaper 6, MODELS 4, ROLE-FAMILY 4, PUBLICATION 3,
SUMMARY 2, DEFENSE 1, MEASURE 1 note). Every living document in the brief's list was grepped for every
old value; the deck, technical docs, README, SLOWKING paper and the OPS / WEB ledgers carried none.
`node tests/test-docs-current.js` **32 passed / 1 failed → 33 passed / 0 failed** (coordinator
re-ran; the 1 was clause 2b, the undeclared 09-09 review, closed by the baseline entry). An intermediate
run went red on 3b(a) with 4 NEW restatements produced by the registration itself — `DEFENSE.md:247` and
three lines of the dated thesis review — and was closed in the same pass; none is left standing and
none was waived. `node engine/docs_scan.js --quarantine`: 23 untraceable across 3 documents before and
after — no living document gained an untraceable figure. `--owed`: 51 of 100, unchanged (no row
written by this pass). Every replacement was READ from an artifact already on disk; nothing re-ran a
generator.

### 3.4 Review deliverables and reports (new, untracked)

| file | source |
|---|---|
| `docs/ARCHITECTURE-REVIEW-2026-09-09.md` | this file (no PDF on disk at fill time) |
| `docs/THESIS-DEFENCE-REVIEW-2026-09-09.md`, `.pdf` | the thesis defence agent; PDF via headless Chrome (§6). No `.html` is on disk, contrary to the draft's earlier `{md,html,pdf}`. |
| `docs/_reports/2026-09-09-pre-600-{engine-review,measure-review,ops-review,code-review,test-breaks,store-and-authority,causal-and-boundary}.md` (7) | the read-only division agents |
| `docs/_reports/2026-09-09-thesis-defence-notes.md` | the thesis defence agent |
| `docs/_reports/2026-09-09-fix-{store-recovery,smogon-cron,retractions}.md` (3) | the three fix agents |

Twelve `_reports` files in all (the record-keeping pass added `2026-09-09-fix-rows.md`). The 15
tracked `data/*` files MEASURE §12 reported rewritten by the suite run were reverted by the coordinator
with `git checkout -- data/` before the fix pass began (they are the suite's incidental rewrites of
`data/mechanics-census.json`, `data/provenance-stamp.json`, `data/open-work.json` and twelve more, not
an outcome); the final suite run at the end of the session was reverted the same way, so no
suite-written artifact is committed with this release.

### 3.5 Landed by the record-keeping pass this session

`docs/RUNNING-NOTES.md` (three rows: store recovery, cron, retractions — all `Basis. unchanged`),
`CHANGELOG.md` (the `[5.275.0]` entry), `docs/ROADMAP.md` (the store-loss DEFECT row, #550 or the next
free id), and the division ledgers `docs/{ENGINE,MEASURE,OPS}.md`. Those files are owned by a
concurrent rows agent and are not in the `git diff --stat` read above.

---

## Numbers corrected

The table below is the NUMBERS CORRECTED table of `docs/_reports/2026-09-09-fix-retractions.md` §B,
verbatim. Every artifact field was opened with `node -e` in that pass (commands at the report's §E).
Every living document in the brief's list was grepped for each old value — white paper, deck,
technical docs, SUMMARY, MODELS, ROLE-FAMILY, SLOWKING-whitepaper, PUBLICATION, README, ENGINE,
MEASURE, SEARCH, OPS, WEB — plus CLAUDE.md, ARCHITECTURE.md and DEFENSE.md. "Checked-and-clean" lists
the documents that were searched and carried NO copy.

| old value | new value, or WITHDRAWN (reason; artifact field) | every file:line it appeared in (all edited) | checked-and-clean |
|---|---|---|---|
| **WAR** clean-store **0.7048** log-loss, **accuracy 0.502** (the v3.2.0 run, 1,061 games) | **0.6936** vs coin 0.6931, **accuracy 0.504**, n_games **3,663**, λ=200 selected on held-out — `data/war.json:held_out.log_loss / .coin / .accuracy`, `n_games`, `ridge`; `verdict` "WORSE THAN A COIN AT EVERY REGULARISATION STRENGTH TESTED" | whitepaper:1968; MODELS.md:1783 (table row struck, artifact row added); SUMMARY.md:1310; ROLE-FAMILY.md:62; PUBLICATION.md:32 | deck, technical-docs, README, SLOWKING-whitepaper, ENGINE, MEASURE, SEARCH, OPS, WEB. (MODELS.md:1775 restates 0.6905 only inside an explicit "The previous entry read:" quotation — left.) |
| "which specific species you bring at preview carries a **small real signal**" | WITHDRAWN — `war.json:verdict`: "Do not quote WAR as evidence that a species wins games" | whitepaper:1968; ROLE-FAMILY.md:63; PUBLICATION.md:31 (item heading) | deck, technical-docs, README, SUMMARY (already "Null"), SLOWKING-whitepaper, ledgers |
| "WAR **barely clears** it" / "WAR **only edges** it" / "beats the **rating baseline (0.6905)**" | WITHDRAWN — `war.json` contains no rating baseline; verdict as above | whitepaper:1986; ROLE-FAMILY.md:98-99; ROLE-FAMILY.md:62-63 | all others |
| **NMF** archetype reconstruction **error 0.53** | **0.682** — `data/nmf-roles.json:archetype_recon_error` (generated 2026-08-04, `archetype_rank` 6) | whitepaper:1978; MODELS.md:1798; ROLE-FAMILY.md:81 | SUMMARY.md:1311 and PUBLICATION.md:41 already record 0.53 as withdrawn; deck, technical-docs, README, ledgers |
| "topic coherence (Mimno 2011) … the **next** refinement" | DELETED; replaced by the criterion actually run: rank 6 excess over null **−0.107** (stability 0.8148 vs null 0.9218), rank 4 most reproducible **+0.0775** — `data/nmf-rank-selection.json:shipped_rank`, `most_reproducible`, `results` | whitepaper:1981-1983; MODELS.md:1798; ROLE-FAMILY.md:102-104 | all others |
| **CHOMP-EV** "On **1,205** games" | **1,102** — `data/chomp-ev.json:n_test` | whitepaper:1691; MODELS.md:1687; PUBLICATION.md:21 | deck, technical-docs, SUMMARY, README, ledgers |
| CHOMP-EV log-loss **0.6918** | **0.6921** — `chomp-ev.json:proper_score_logloss.chomp_align` (coin 0.6931 unchanged) | whitepaper:1692; MODELS.md:1687 | all others |
| CHOMP-EV sign test **0.512, CI [0.493, 0.535]** | **0.5123 [0.4997, 0.5246]** — `chomp-ev.json:headline_beat_test.p_winner_more_aligned / .ci95` | whitepaper:1694; MODELS.md:1687 | all others |
| CHOMP-EV forfeit-robustness **0.505** | **0.5082** — `chomp-ev.json:robustness_no_forfeits.p_winner_more_aligned` | whitepaper:1694 | MODELS.md:1687 states it without a number (kept, number added) |
| CHOMP-EV selection audit "eval **6.5** turns / **1280** rating vs **6.08** / **1267** excluded … **making the null conservative**" | WITHDRAWN — `chomp-ev.json:selection_audit.n_excluded_human` = **0**, `excluded_mean_turns` = **null**: `engine/chomp_ev.js:120` `if (!CLEAN.has(g.id)) continue;` sits above the qualify test at `:128`, so `audExcl` can never receive a game. No artifact establishes the bias direction. The thesis-notes measurement (7.81 vs 6.74 turns, +4.44 points) is referenced by PATH only, not restated — see the report's §E for why. | whitepaper:1696-1698; MODELS.md:1687 ("null is conservative") | PUBLICATION.md:21-22 carries no audit claim; deck, technical-docs, SUMMARY, README, ledgers |
| **XATU** clone **top-1 35.9% (CI 35.2–36.5), top-3 71.6%, CE 2.27**, baselines **4.54 / 2.91** | WITHDRAWN — in no artifact. `data/policy-eval.json:species_only_clone` (committed 2026-07-31) reads top-1 **0.2979 [0.2914, 0.3045]**, top-3 **0.6564**, CE **2.6353**; `baselines.global_move_freq_ce` **4.7346**, `uniform_moveset_ce` **3.0286** — stated beside the withdrawal | whitepaper:1676-1678; MODELS.md:1405; DEFENSE.md:247 (35.9% → 29.8% with the artifact field) | SUMMARY (no copy today, despite MEASURE.md:5337 saying it quotes one), deck, technical-docs, README. **MEASURE.md:5337's 71.6% is PORY-NN's auc, a different measurement** (already recorded at MEASURE.md:5239); a dated correction note was added there so the registry does not accuse it. |
| **§1 ceiling** Elo log-loss **0.687 vs coin 0.693** on 600+ games | WITHDRAWN — `engine/predictability.py` has no `json.dump` (grep: none); `data/skill-variance.json` and `engine/skill_variance.py` do not exist (`ls`) | whitepaper:1491-1492; PUBLICATION.md:16 | MODELS.md:1404 "player-Elo ≈ coin (0.687)" sits inside a paragraph headed "The 2026-07-23 reading, **superseded**, kept" — a dated record, left. deck, technical-docs, SUMMARY, README, ledgers clean. |
| §1 ceiling **52.4%, 95% CI [49.9, 54.9]** | WITHDRAWN — same reason | whitepaper:1494-1495; SUMMARY.md:1392 | PUBLICATION.md has no copy. **MEASURE.md:6271, :6272, :6342 write "52.4%" as the majority-class baseline of the turn-0 leaf arms — a different quantity — left, and deliberately NOT registered.** |

Counts: **5 causal claims** rewritten across 8 locations; **22 numeric values** withdrawn or replaced
across **21 figure locations** in 7 documents. The derived retraction registry
(`engine/docs_scan.js:585`) now refuses **35.9%, 71.6% and 1,205** repo-wide, from the living
documents' own struck lines. **52.4%** and **1280 / 1267** were deliberately NOT registered: a strong
entry would accuse `docs/MEASURE.md:6271-6272, 6342` (the turn-0 arms' majority-class baseline) and
`docs/ENGINE.md:35712` ("1,280 lines into an unrelated file") — the 9.7%-accuses-10% failure. Both are
named as literals only in the CHANGELOG (exempt); the report proposes phrase-scoped entries for the
hand-typed `RETRACTED` list in `tests/test-docs-current.js:103`, not written (no test edits in that
brief).

**Identified by the reviews and NOT corrected this pass** (out of scope for the retraction brief;
listed in the report's OWED block and in §8):

| figure | document says | artifact says | where |
|---|---|---|---|
| GURU predictive log-loss | 0.7122 | `predictive_test.log_loss_matchup_prior` 0.7124 | whitepaper `:1667-1672` |
| SLOWKING archetype count / uniform exploitability / cycle / Rain vs Sun | 13 / 0.109 / TrickRoom→HyperOffense→Sand / 51% n=236 | 12 / 0.0761 / `supported: false` / 0.538 [0.466, 0.609] n=182 | whitepaper `:1716-1729` |
| role-matchup median cell | n = 20 across 1,051 cells | 1,101 cells, median n = 74 (computed by the defence) | whitepaper `:1954`; `docs/SUMMARY.md:1309` |
| functional roles | 26 | 52 in `ROLE_SIGNALS`; 46 matrix columns | whitepaper `:1945`; `ROLE-FAMILY.md:25`; `SUMMARY.md:1309` |
| ROLE-FAMILY §4 archetype table and names | the 2026-07-24 run's | `data/nmf-roles.json:archetypes` | `docs/ROLE-FAMILY.md` §4; whitepaper, MODELS |
| store sharding | "Supersedes. Nothing." | 11,110 + 4,752 ids dropped from the tracked store — superseded by the record-keeping pass's store-recovery row (§3.5) | `docs/RUNNING-NOTES.md:573` block |
| MILTANK profile figures in a notes row | eight values from a STAY artifact — not restated here, because quoting a withheld figure to say it is withheld still publishes it | withheld (STAY artifact `data/search-decision-profile.json`) | `docs/RUNNING-NOTES.md:286` |
| SOURCES count | "twenty-five" | 27 (`require('./engine/engine_release.js').SOURCES.length`) | `CLAUDE.md`; `.gitattributes` says 26 |
| ingest cadence | "hourly" | every six hours since 2026-08-21 (`ingest.yml:5-16`) | `CLAUDE.md:286`, `:706` |

---

## Causal claims audit

Every "X caused Y" the causal report classified, and the store-duplication history built from the
forensics report's per-incident table — never from a handoff note.

### Classification (causal-and-boundary report, 34 claims read in context of ~90; 2,186 causal-phrase lines seen, 295 strong-form; `docs/ENGINE.md`'s 167 strong-form lines SAMPLED, not audited)

| class | count | examples with receipt |
|---|---|---|
| **DISPROVEN, still stated** | 5 (+1 script header) | R1 union driver "confirmed cause" (`CLAUDE.md:356-357` vs CHANGELOG 3.23.0 — coordinator confirmed); R2 `merge -X ours` (`ARCHITECTURE.md:42-43` vs 3.1.2's same-day retraction); R3 the auto-commit timer (`SEARCH.md:2506` vs `CLAUDE.md:330-335`); R4 "one in six" (`ENGINE.md:404,410-411,419-420` vs 5.273.0 and `ENGINE.md:306-311`); R5 "not re-checked" STALE marker (`CLAUDE.md:577-579` vs five living-doc copies); R6 `push-all.bat:9-10` |
| **UNVERIFIED (hypothesis stated as fact)** | 9 | H1 the driver/-X ours pair (5 copies); H2 DODUO "the constraint is the objective" (quarantined anyway); H3 concurrent runs "pushed RAM toward swap" (`CLAUDE.md:167-171`, no RAM measurement cited); H4 statistical models "never touch damage, which is why" (`ARCHITECTURE.md:229`); H5 open sheets ~1% "need both players to agree" (`technical-docs:1697`); H6 "six of those thirteen games have a second thing wrong" (`deck:213`, no field cited); H7 Sand Rush 140/280 reading left open (`ENGINE.md:26795-26796`); H8 dead API vs quiet day (`OPS.md:87`); H9 "hourly" ingest (`CLAUDE.md:286`) |
| **VERIFIED** | 20 | speed ties are the SORT (knob `MEDI_ENTRY_STABLE_SORT=1`, 4 copies); 777 vs 961 is the `--games` flag (reproduced, 5.79.0); blank gate clauses were a line ending (`stripCR`, pinned both directions); joint 110 / empirical 35 attributed by knob-cleared runs on one release; `brought` inflated by forme changes (1,003 of 1,033 offenders contain `mega`); the speed-ratio series re-measured over 8 contention-free reps; the event die "translating rather than re-drawing" (closed-form) |

Pattern the report states once and this review endorses: every DISPROVEN item is about
infrastructure. The retraction registry (`engine/docs_scan.js:585`, `:689`) works for FIGURES and
cannot see a MECHANISM, which is why R1–R3 survived — there is no number in them to strike.

### The store duplications, per incident (forensics report §1a; `git log --all --full-history`, `git cat-file -s`, `awk` over blobs, `git show <h>:.gitattributes` for the driver)

| # | when | commit | lines/ids parent → this | driver active | verdict on "the union driver did it" |
|---|---|---|---|---|---|
| 1 | 07-24 03:31 | `b66aaecb` | 6539/6539 → 6645/6639 (+6 dup) | no (12 h before it existed) | UNSUPPORTED; not in the CHANGELOG |
| 2 | 07-24 15:01 | `e59c3bda` | 6645/6639 → 7449/7042 (+401 dup) | no — added two minutes later | UNSUPPORTED; single-parent, author = committer |
| 3 | 07-24 15:43 | `072e00d2`, `34532938` | 7449/7042 → 14188/7142 (+7046 dup); bo3 1492/897 | yes | SUPPORTED for union-on-rebase (replays). The merge `1d70e0f6` that 2.10.0 blamed added exactly 169 lines and duplicated nothing |
| 4 | 07-24 18:04 | `71de227c` | 7716/7716 → 7948/7547 (+401 dup, **−169 ids**) | yes | PARTIAL; no reconciliation commit; the store LOST 169 games; mechanism not recoverable |
| 5 | 07-24 20:12 | `8917698d`, `608288de` | → 16540/8000 and 16139/8000 | yes | SUPPORTED; 3.1.2's "16,139 → 8,000"; the 45-commit rebase stopped at 43 is real |
| 6 | 07-24 21:07 | `ceaf5c1b` | 8356/8356 → 8757/8356 (+401 dup) | no (removed 35 min earlier) | UNSUPPORTED; 3.3.0's "8,757 unique, 0 duplicates … removal is holding" is true of a DIFFERENT store with the same number |
| 7 | 07-24 → 07-26 | bo3 store | 595 duplicate ids from #3 persisted through every ladder dedupe until `72066189` | — | consequence of #3; `dedupe_store.py` hardcoded to the ladder path; bo3 ~40% duplicate for ~2.3 days |
| 8 | 07-26 12:42 | `6d1a3627` | 14447/14447 → 14931/14794 (+137 dup) | no | UNSUPPORTED; 3.23.0's counter-example, confirmed |
| 9 | 07-29 → 08-21 | (no commits) | — | — | not a duplication: a 24-day hole in the tracked store, closed by `6ecc96de` "the only complete copy was on one laptop" |
| 10 | 09-06 16:25 | `18432bcb` | 88,346 ids → 76,833 ids (shards from the local file) | — | NEW, UNRECORDED, OPEN — finding 1 |

**Aggregate.** The report counts **six** duplication events on the ladder store (#2, #3, #4, #5, #6,
#8); #1 (+6 duplicate lines) is a seventh row with duplicate lines gained that the report's aggregate
does not count — flagged here, not resolved. Driver active for three (#3, #4, #5); a rebase replay
visible for two (#3, #5); three with no driver (#2, #6, #8). So `.gitattributes`' sentence "Duplicates
have only ever entered this repository through git reconciliation" is not demonstrable from the
repository; 2.10.0's `merge -X ours` diagnosis is UNSUPPORTED; 3.1.2's re-diagnosis is SUPPORTED for #3
and #5 and over-general for the rest. **Not reproduced:** 3.23.0's "a fifth event at depth 14: a
commit published a store of 0 lines" — no zero-byte blob exists for any of the four store paths across
all refs, and the depth-14 ancestor holds 70,278,317 / 17,138,942 / 31,923,870 bytes. **Removing the
driver was correct. Calling it THE cause is not supported.**

---

## What I could not do, and why

Honest and complete. Each line is an instrument that did not run, a claim that could not be
confirmed, or a disagreement that was not resolved.

**Instruments that died or were not run**

- `node engine/engine_release.js census` (dry run) died at `FATAL ERROR: Reached heap limit` after
  177 s at the 2 GB default; `node --max-old-space-size=3072 engine/engine_release.js compat
  engine/medicham2-browser.js` died the same way. Neither declares `ABRA-HEAP`. **The stranded-release
  count across all 636 releases is NOT DERIVED**; the last `data/release-census.json` is dated
  2026-08-11 (118 releases). `tests/test-artifact-rerunnable.js` (heap 6144) passed inside the suite —
  99 stamped artifacts over 36 releases, 57 re-runnable, 1 STRANDED and undeclared (known, was 1) — so
  the ratchet that matters holds (MEASURE §4).
- No engine script that plays a game was run by this draft, `status.js` was not re-run, and the
  differential was not re-run. The gate reading is the coordinator's 11:59 print and MEASURE's
  `medichamIsCorrect()` call at 16:35Z.
- None of the thesis's store-derived generators was re-run (seven agents live; each rewrites its
  artifact unconditionally; ROADMAP #288 — no store digest — means a re-run would be a new
  unstampable number replacing an old one). The list is in the thesis notes' OWED block.
- `tests/test-wiring.js` was not run on the real tree; in the worktree it needed
  `NODE_OPTIONS=--max-old-space-size=6144` and a restored plain store to go green (test-breaks §3.1).
- `node engine/engine_release.js verify d3d04b669e18` — whether the oldest release's manifest
  mismatch is real-tree or worktree-only is unverified.
- `gh api repos/willhoop/ABRA/branches/main/protection` — branch protection was not queried.
- Whether the live bot is running is not determinable from files (OPS §5).
- ROADMAP #547's on-disk receipt (the pool cache's `store_dir`) was not located (MEASURE §5).
- `engine/next_regulation.js` was not re-run on the day its own comment says a new regulation is
  announced (OPS §6).

**The census was not pinned.** The gate run's receipt reads `steering.pinned false`,
`input_read_from data/mechanics-census.json`, `matches_live true` at run time — and the suite
rewrote that census at 16:21:25Z, so `matches_live` would now read false. Because the census is
credited-only for the differential (it does not select the sample) this does not void the run; the
receipt no longer matches the live file and the re-run must carry `--census
data/verification/census-pin-<id>.json` (MEASURE §2, §12).

**The side-selection claim is unconfirmed.** The code review reports `engine/side_selection_census.js`
at **exit 1: `undeclared: 88   ratchet 78   >> ROSE`**. The coordinator ran it and observed it print
UNCLASSIFIED rows (42751, 43091, …) and **exit 0**. MEASURE's PENDING-WIRE entry cites `undeclared 84`
measured 2026-09-04. Three numbers, two exit codes, one instrument that nothing runs (`PENDING_WIRE`,
`tests/run-all.js:542`). Flagged, not resolved.

**The exit-2 disagreement, reconciled as far as it can be.** The code review says 44 of 144
discovered tests carry an `exit(2)` path and that `tests/run-all.js` reads exit 2 as SKIP, so a
COULD-NOT-STAGE fixture launders into a green suite. MEASURE's run reports **0 skipped of 177**. Both
are true: `tests/run-all.js:770-777` reads exit 2 as SKIP **by design** ("EXIT 2 MEANS 'I COULD NOT
RUN', NOT 'I FAILED'"; coordinator read the lines) and `:819` exits 0 on skips; on this run no test
took that path. The hazard is latent, not manifest today. It remains a defect: the exit-code vocabulary
is decided in three files with three meanings (finding 15), and a fixture that stops staging tomorrow
turns nothing red.

**The test-wiring disagreement, resolved.** The test-breaks pass says `tests/test-wiring.js` is "not
referenced anywhere in `tests/run-all.js`" (`grep -n test-wiring` → nothing). MEASURE lists it red in
the run. Both are literally true: `tests/run-all.js:51-52` DISCOVERS every `tests/test-*.js` by glob
(`fs.readdirSync(D('tests')).filter(f => /^test-.*\.(js|py)$/.test(f))`), so the file is run without
being named. It ran, and it is red (10 NOT WIRED) — MEASURE attributes that to the MAG weights refusing
to load ("consistent with, not proven"). Re-run the day the weights load.

**Leaf coverage — three figures, one current.** The ENGINE brief's premise was "compared 33 /
declared 4 / neither 43 of 80" — that is the 2026-08-28 figure `engine/coverage.js` quotes in its own
header (lines 10–11) as the reason the file exists. ENGINE's read-only probe today
(`tests/probe_uncompared_leaves.js`): **80 leaves, COMPARED 54, DECLARED 6, NEITHER 20** — 18 with an
authority duration of 1 ended in the residual, 2 self-removing, 0 with a clock of 2+. MEASURE
(`node engine/coverage.js`): **54 compared — the ceiling — 6 declared uncomparable, 18 duration-1, 2
removed inside their own action, 0 widenable**. ENGINE's 20 is MEASURE's 18 + 2; the two agree, and
**54 / 6 / 20 of 80 is current**. The brief's 33/4/43 is stale. The six DECLARED leaves are what a
reader should know — Unburden's volatile is declared uncompared, which is why register row #535 cannot
show up on the bar.

**Not measured:** the share of living-document paragraphs the `QUALIFIED` exemption removes from
clause 3b(b) — the number that decides whether finding 3 is a corner or a hole (test-breaks §4);
whether WAR's gradient descent converges at low λ; the sign and magnitude of the noisy-OR error in the
role model; the full pass over `docs/ENGINE.md`'s 167 strong-form causal lines.

**PDF toolchain.** `python -c "import weasyprint"` fails (`OSError: cannot load library
'libgobject-2.0-0'`). `build/omnibus.py` fell back to headless Chrome ("weasyprint unavailable ...
trying headless Chrome; rendered with chrome.exe") and produced a 55 KB probe and the 551 KB thesis
PDF. The route works; it is not the documented one.

**Agents that could not write.** The OPS agent has no write tool; its report was saved to disk by the
coordinator.

**What the fix pass itself surfaced, and left owed** (each with the report that carries the command):

- The recovered store is larger than several readers assumed. Six scripts died at the default heap and
  now declare one (`2026-09-09-fix-heap-declarations.md`); any OTHER script that reads a store whole with
  `readFileSync(...).split('\n')` and has no declaration will die the same way the first time it runs on
  this store. Streaming the read is the durable fix and is owed.
- `data/live.js` is stale against the recovered store: the OPS ledger's generated block reads 81,269
  ladder games where the store holds 92,379. The ingest workflow regenerates it on its next run; until
  then the ledger prints the pre-recovery count (`2026-09-09-fix-rows.md`).
- The shard-superset guard (`build/compress-stores.js --check`) exists and is red on a replay of the
  cutover, but nothing in `.github/workflows/ingest.yml` calls it yet. Until it is wired, the class it
  catches can recur unattended (`2026-09-09-fix-store-recovery.md`).
- `data/smogon-priors.observed.json` must be committed with this release or the cron's first `git add`
  exits 128 on 2026-09-11 (`2026-09-09-fix-smogon-cron.md`). It is staged in this commit.
- Four retracted figures (`0.7048`, `52.4%`, `0.687`, `1280 / 1267`) could not be entered in the
  derived retraction registry without accusing unrelated cells in two ledgers; phrase-scoped `RETRACTED`
  entries are proposed in `2026-09-09-fix-retractions.md` §D and not written.
- The record-keeping agent exited once mid-restamp with its background `status.js --write` still
  running, and the coordinator's concurrent suite run had to be stopped to keep a writer from sitting
  beside a measurement. The suite was re-run clean afterwards; the figure above is from the clean run.
- Register rows #551 (the three void games are the three board-parted games, ENGINE) and #552 (the
  docs gate is blind to a wrong headline, MEASURE) now exist, so `engine/open_work.js` prints both.

---

## The rules

A system of rules across the whole project, ranked by blast radius. Each carries the ORIGINATING
FAILURE (a real event with a receipt), the ENFORCING CHECK (a named test, script or hook, or "NONE — this
is a preference until a check exists"), and LITERATURE (only from the list the coordinator confirmed;
otherwise "no literature found"). They are written against the failure shapes this repository already
names about itself: a silent default looks exactly like a working feature (LESSONS §1); every
derivation over-matches on the first try (§4); a check nobody acts on is not a check; prose outlives
what it described.

### R1. A store's id set may not shrink across a commit

- **RULE.** For every tracked store, `ids(HEAD) ⊇ ids(HEAD~1)`. A cutover that changes the store's
  FORM compares against the previously TRACKED form, never against a local file.
- **ORIGINATING FAILURE.** Finding 1: 11,110 + 4,752 ids dropped at `18432bcb` under a row saying
  "Supersedes. Nothing." The workflow's shrink guard counted lines of the shard-restored store, so a
  short shard set became the floor. Incident #4 (`71de227c`, −169 ids) is the only other shrink in the
  ladder history and was never noticed either.
- **ENFORCING CHECK.** At draft time NONE: `build/compress-stores.js --check` compared to the local
  file (forensics §1c). **Since the fix pass (§3.1)** `--check` asserts the shards ⊇ the ids tracked at
  `HEAD~1` in either form, shown red on a replay of the cutover. It is run by
  `tests/test-workflow-paths.js` only; the ingest workflow and the pre-commit hook do not call it yet
  (§8 item 2).
- **LITERATURE.** Sandve, Nekrutenko, Taylor, Hovig (2013), "Ten Simple Rules for Reproducible
  Computational Research", PLoS Comput Biol — version everything, record every result's provenance.

### R2. A denominator may not exclude the games that failed the test

- **RULE.** Any ratio published as a correctness claim states its population as "N usable, M voided,
  of which K failed the test", with K derived. A void rule that correlates with the failure it is
  meant to count is a selection, and the artifact says so beside the number.
- **ORIGINATING FAILURE.** Finding 2: all three void games parted a board
  (`mid_void.void_game_tags[].board_parted_at_turn` = 4, 6, 3); "0 of 958" was printed and repeated
  for eleven batches (session-close) without the three beside it.
- **ENFORCING CHECK.** NONE. `engine/quarantine.js` reads `state.games` less
  `state.games_board_never_diverged`; the `by_cause_totals.games_board_material 3` is in the same
  artifact and nothing compares the two. Owed: a clause in the board-material row that prints
  `void_games` and `by_reason_detail['low-identity'].diverged` beside the bar and refuses to print the
  bar alone when the second is non-zero and unattributed.
- **LITERATURE.** Gelman & Loken (2014), "The Statistical Crisis in Science", American Scientist —
  the garden of forking paths: an exclusion rule chosen after seeing the data is a degree of freedom.

### R3. A figure gate compares the value at the claim, not membership in the artifact

- **RULE.** A living-document figure that cites an artifact is checked against the artifact FIELD the
  claim names, at the claim's precision. A word-list exemption applies to the sentence carrying the
  word, never to the paragraph.
- **ORIGINATING FAILURE.** Finding 3: `27 of 961` → `41 of 961` passed byte-identically
  (`engine/docs_scan.js:626` `QUALIFIED` skips the paragraph; `:496-499` `artifactHas` is set
  membership). The start skill already records "`231 live of 232 probed` counted as traceable because
  `231` appears inside a 308 KB census" — the same class, still live.
- **ENFORCING CHECK.** `tests/test-docs-current.js` clause 3b(b) exists and was shown NOT CAUGHT on
  the mutation. Until it is rewritten it is a preference. Owed: the H1/H2/H4 mutations from the
  test-breaks report as the red arm of the rewritten clause.
- **LITERATURE.** DeMillo, Lipton, Sayward (1978), "Hints on Test Data Selection", IEEE Computer;
  Jia & Harman (2011), "An Analysis and Survey of the Development of Mutation Testing", IEEE TSE — a
  test that survives the mutation it exists to catch is not a test.

### R4. A release cited by a published figure is tracked or re-cuttable

- **RULE.** The moment an artifact that a living document cites stamps a release id, that release's
  directory is `git add -f`'d in the same commit. A release that cannot be opened from a clone is not
  evidence.
- **ORIGINATING FAILURE.** Finding 4: `b730e44f3314` stamped by all five gate artifacts, 0 tracked
  files; the `.gitignore` block (`:167-173`) describes the rule and nothing does it. LESSONS §12
  already recorded 168 of 200 releases stranded by a reader that kept moving.
- **ENFORCING CHECK.** NONE for tracking. `tests/test-artifact-rerunnable.js` ratchets openability
  for releases on disk, not presence in git. Owed: a clause in `engine/provenance.js` (or the
  pre-commit hook) that fails when a living document cites an artifact whose `engine_release` is not in
  `git ls-files data/releases`.
- **LITERATURE.** Peng (2011), "Reproducible Research in Computational Science", Science 334:1226 —
  code and data available at the version that produced the result; Buneman, Khanna, Tan (2001), "Why
  and Where: A Characterization of Data Provenance", ICDT.

### R5. No scheduled job writes a frozen source

- **RULE.** A workflow may write a `.observed` table beside a frozen SOURCE; promotion into the
  SOURCE is a human commit with a notes row and a release re-cut.
- **ORIGINATING FAILURE.** Finding 5: `smogon-stats.yml` commits `data/smogon-priors.json` (a
  SOURCES entry, `engine_release.js:150`) on a cron with a fresh `generated` date every run; three bot
  commits already (`441196b8`, `89d86b93`, `c1e2ec2f`). `ingest.yml:236-252` fixed the identical
  failure for `move-priors.json` — "every write here minted a NEW ENGINE and withheld every artifact
  measured before it" — and the lesson did not reach the second workflow.
- **ENFORCING CHECK.** NONE as a rule; the one offending workflow was fixed by hand (§3.2) and
  `tests/test-workflow-paths.js` now asserts it stages the `.observed` twin. Owed: the general clause —
  no `git add` line in any workflow names a path in `engine_release.js` SOURCES.
- **LITERATURE.** Sculley et al. (2015), "Hidden Technical Debt in Machine Learning Systems", NeurIPS
  — undeclared consumers and unstable data dependencies.

### R6. A red test is fixed in the session that saw it, or waived by Will by name

- **RULE.** Unchanged from CLAUDE.md. There is no third state. A release is cut over zero unwaived
  reds.
- **ORIGINATING FAILURE.** Finding 6: 27 reds, none waived, the session-close reported three; the
  docs-currency gate "red on every run and reported as one of the two known failures" for two days
  (CLAUDE.md, 2026-07-30); `engine/provenance.js` "red for weeks and read as expected" (MEASURE §1.B).
- **ENFORCING CHECK.** `tests/run-all.js` exits 1 on any fail; `tests.yml` runs it on every push.
  What is missing is the WAIVER as data: a named-waiver file the runner reads, so that "waived by Will"
  is a row and not a memory. Owed.
- **LITERATURE.** Fowler, "Continuous Integration" (martinfowler.com) — fix broken builds
  immediately; a broken build is the top priority.

### R7. A causal claim in a living document names its control or is marked hypothesis

- **RULE.** "X caused Y" in a living document carries the knob, probe or reproduction that showed it,
  or the word HYPOTHESIS. The mechanism is a claim like a number is.
- **ORIGINATING FAILURE.** Finding 7: `CLAUDE.md:357` "confirmed cause" against CHANGELOG 3.23.0's
  counter-example and the forensics table's three no-driver duplications; 9 hypotheses stated as fact.
  The retraction registry cannot see a mechanism because there is no number in it to strike.
- **ENFORCING CHECK.** NONE — this is a preference until a check exists. The cheapest instrument: a
  `docs_scan` clause that flags a strong-form causal phrase (`confirmed cause|root cause|the cause
  was|which is why`) in a living document with no `knob|probe|reproduced|HYPOTHESIS` token in the same
  paragraph, ratcheted from today's count.
- **LITERATURE.** no literature found.

### R8. A living document may not state the opposite of its artifact's verdict field

- **RULE.** Where an artifact carries a `verdict`, `supported`, or a named CI, the sentence that
  cites it is rewritten from that field; a sentence that contradicts it is a retraction owed NOW, not
  at the next major.
- **ORIGINATING FAILURE.** Finding 8: `war.json:verdict` "WORSE THAN A COIN" vs "barely clears it";
  `slowking-eval.json:top_nontransitive_cycle.supported = false` vs a cycle paragraph naming a
  different cycle; `chomp-ev.json:selection_audit.excluded_mean_turns null` vs four numbers in the
  paper.
- **ENFORCING CHECK.** NONE for verdict strings; R3's rewritten clause covers the numbers. Owed: a
  `docs_scan` clause that, for every cited artifact carrying a `verdict` or `supported` field, checks
  the citing sentence for its negation words — small, bounded, and it would have caught all three.
- **LITERATURE.** Eurostat, ESS Guidelines on Revision Policy (2013), KS-RA-13-016 — a revision is
  documented with its reason and its impact; it is not silently overwritten.

### R9. Only one publisher, and every publisher is in the table

- **RULE.** The WHO MAY WRITE table lists every agent that can land a commit, with its cadence and
  what it touches. A second Claude Code session, a worktree, and a bot are publishers.
- **ORIGINATING FAILURE.** Finding 12: `abra-bot` at 50 of the last 300 commits, absent from the
  table; a peer session running at review start; another agent's worktree walked as repo source by
  `test-fixture-legality`; the merge-driver binding per-clone and untested.
- **ENFORCING CHECK.** Partial: git's fast-forward rejection and `concurrency: group: ingest`
  serialise the bot; `/start` asks the session to run `ListAgents` (convention). Owed: `engine/orient.js`
  fails when `git config merge.jsonl-store.driver` is empty; a lock file written by `/start` and read by
  the pre-commit hook; every repo-wide sweep excludes `.claude/worktrees`.
- **LITERATURE.** no literature found.

### R10. Measure before asserting — a gate existing is not evidence it fires; mutation-test it

- **RULE.** A check is trusted only after it has been shown red on a deliberate break of the thing it
  protects, and the break is recorded in the check's own header. A check whose red arm has never been
  shown is a preference wearing a test's name.
- **ORIGINATING FAILURE.** The test-breaks pass: 12 of 13 CAUGHT, 1 NOT CAUGHT (`test-docs-current`,
  finding 3), two blind spots inside CAUGHT tests (`test-mc-key` skips any line beginning with `/*`;
  `test-sprt-arm-sign`'s spelling clause stayed green on an inverted sign). 171 of 366 test files have
  no documented red arm; 45 of 237 engine knobs are named in no test. The memory file records five
  CLAUDE.md violations in one session, all this shape.
- **ENFORCING CHECK.** `tests/test-mutation-coverage.js` (red today: "the planted-stub gate catches
  both stubs (0/2 caught)", artifact on release `6fb9ebd3b704`); `tests/mutation_harness.js` and
  `data/mutation-coverage.json` (last generated 2026-08-22). The instrument exists and is stale.
- **LITERATURE.** DeMillo, Lipton, Sayward (1978); Jia & Harman (2011); Luo, Hariri, Eloussi,
  Marinov (2014), "An Empirical Analysis of Flaky Tests", FSE — for the priority arm that raced and the
  worktree reds that were not findings.

### R11. A measurement pins the engine, the pool, the census, and the flags — and the receipt names the path it opened

- **RULE.** Every differential run records `--release`, `--team-store`, `--census`, `--games`,
  `--turns`, the arm and the steering policy, and every digest in the receipt is taken from the file
  the run actually opened.
- **ORIGINATING FAILURE.** CLAUDE.md's own record: 995 vs 982 games an hour apart; 777 vs 961 from
  an unwritten `--games`; ROADMAP #547's receipt stamped from the live paths. This session: the gate
  run carried no census pin and a test rewrote the census under it (finding 15); a frozen release still
  opens the live bo3 store through `set_priors.js` (finding 15).
- **ENFORCING CHECK.** `engine/provenance.js` (content digests; `void: true` honoured);
  `engine/arms_comparable.js` for a pair. NONE for "the census was pinned" — the artifact records
  `steering.pinned false` and nothing refuses it. Owed: the differential refuses `--write` without a
  census pin when the census steers the run.
- **LITERATURE.** Sandve et al. (2013); Sculley et al. (2015).

### R12. State is printed, never typed; a count in prose is stale the day it is written

- **RULE.** Unchanged from CLAUDE.md, restated because it was broken again this session: "twenty-five"
  SOURCES (27), "hourly" ingest (six-hourly), "23 tags with no consumer" (11), "43 uncompared leaves"
  (20), "157 of 500 moves part" (0).
- **ORIGINATING FAILURE.** The fourteen handoffs; the ban list of four; and today, eleven premise
  corrections in the ENGINE brief alone (ENGINE §0).
- **ENFORCING CHECK.** `engine/status.js`, `engine/open_work.js`, `engine/where.js`,
  `engine/orient.js` — for STATE. NONE for counts typed into CLAUDE.md prose; the file says to read
  them from `SOURCES`, and readers do not.
- **LITERATURE.** no literature found.

### R13. A published figure states what it does NOT cover, in the same sentence

- **RULE.** The one sentence 6.0.0 must print (MEASURE §3) is the template: population, pins, what was
  compared, and then the named exclusions — voided games, uncompared leaves, fields not compared,
  mechanics nobody brought, real EV spreads (0 of 17,536 bodies carry one).
- **ORIGINATING FAILURE.** "BOARD-MATERIAL 0 of 958" quoted for eleven batches as if it were "no
  board difference occurred"; the session-close's own last section says it means "none survived to a
  compared boundary", measured at 2 of 19 narration windows.
- **ENFORCING CHECK.** NONE — the sentence exists in no living document yet
  (`docs/RUNNING-NOTES.md:91` owes it to the next major).
- **LITERATURE.** Eurostat ESS (2013) Item 3.4 — documentation of the reasons, impact, and
  comparison for a revision.

---

## Pre-6.0.0 list

Every item that should be addressed before 6.0.0, ranked, with owner, severity, and the one command
that proves it done. **Decisions Will has already made** (do not re-ask): the MAG refit is sequenced
AFTER 6.0.0 (never restamp `data/policy-weights.json`; the FEATURE SEMANTICS print is correct
withholding); WEB is paused (the four web tests and the two quarantine DRIFTs are the owner's, and get a
named waiver); the narration clause is its own gate, not on the board-material critical path
(2026-08-22); rank by the pinned pool, the roster and census carry the obscure tail (2026-08-23);
documents fold in at the major, a notes row every change (2026-09-06); ledgers get no PDF.

| # | item | owner | severity | proves it done |
|---|---|---|---|---|
| 1 | ~~Restore the 11,110 ladder + 4,752 bo3 games to the tracked shards; supersede the "Supersedes. Nothing." row; CHANGELOG entry for the sharding (none exists)~~ **DONE 2026-09-09** (§3.1): `comm -23` → 0 ladder, 0 bo3, coordinator re-ran; the row and the CHANGELOG entry land with the record-keeping pass (§3.5) | OPS | ~~BLOCKS~~ closed | `comm -23 <d2a418a5 ids> <shard ids> \| wc -l` → 0, for ladder and bo3 — **read 0 / 0** |
| 2 | ~~Add `ids(HEAD shards) ⊇ ids(HEAD~1 shards)` to `compress-stores.js --check`~~ **DONE 2026-09-09** (§3.1: red on a one-row break, red on a replay of `18432bcb`, green on the tree in 8.7 s). **STILL OWED:** run it in `ingest.yml` after the shard step and in the hook on any commit touching `data/parsed/`; the runner's shrink guard still measures against itself | MEASURE / OPS | SHOULD FIX (the wiring) | `grep -n 'compress-stores.js --check' .github/workflows/ingest.yml` → a hit after the shard step |
| 3 | Attribute the three void games (charge-move release target; Future Sight vs side-end order; post-switch secondary) — one probe each; print "0 of 958 usable, 3 voided, N engine" | ENGINE | BLOCKS | the three probes exit 0 in both engines, and `by_reason_detail['low-identity'].diverged` is attributed in the artifact |
| 4 | ~~Stop the smogon cron writing a frozen source before 2026-09-11 07:00 UTC (`.observed` table; drop the SOURCE from `git add`)~~ **DONE 2026-09-09** (§3.2): workflow-only, `drift b730e44f3314` → NO-DRIFT; `data/smogon-priors.observed.json` must be added with the commit | OPS | ~~BLOCKS~~ closed | `node engine/smogon_priors.js && git diff --stat -- data/smogon-priors.json` → empty — **the same-month run moved 2 lines before the fix; the workflow now restores the file in the same step** |
| 5 | `git add -f data/releases/b730e44f3314`; a provenance clause failing on a cited untracked release | MEASURE | BLOCKS | `git ls-files data/releases/b730e44f3314 \| wc -l` > 0 |
| 6 | Rewrite `docs_scan` clause 3b(b): value at the named field; qualifier exempts the sentence | MEASURE | BLOCKS | the H1/H2/H4 mutations from the test-breaks report turn `tests/test-docs-current.js` red |
| 7 | Fix or waive-by-name every one of the 27 reds; a named-waiver file the runner reads | all; Will for group A | BLOCKS | `cmd /c tools\lownode.cmd tests\run-all.js` → 0 failed, waivers printed by name |
| 8 | ~~Strike the five refuted causal claims (`CLAUDE.md:357`, `ARCHITECTURE.md:42-43`, `SEARCH.md:2506`, `ENGINE.md:404/410-411/419-420`, `CLAUDE.md:577-579` marker)~~ **DONE 2026-09-09** (§3.3, 8 locations; `test-docs-current` 33/0). **STILL OWED:** `push-all.bat:9-10`, `.gitattributes:9-11`, `ingest.yml:355-357` — live files, not living documents, still naming the driver as THE mechanism | MEASURE / ENGINE / OPS | ~~BLOCKS (R4)~~ closed; SHOULD FIX (the live files) | `grep -n "confirmed cause\|ONE IN SIX\|publishes on a timer" CLAUDE.md docs/*.md` → nothing |
| 9 | ~~Rewrite the three white-paper sections from their artifacts' verdict fields (WAR `:1968,:1986`; NMF `:1978-1983`; CHOMP-EV `:1691-1699`) — retractions do not wait~~ **DONE as a retraction 2026-09-09** (§3.3, §4: 22 figures across 21 locations, every replacement read from the artifact). **The re-analyses are not done** — T1–T5 below | MEASURE | ~~BLOCKS~~ closed for the sentences; the analyses stay owed | `node tests/test-docs-current.js` 33/0 and `node engine/docs_scan.js --quarantine` unchanged at 23 — **both read**; the sentences now quote `war.json:verdict` |
| 10 | Write the 6.0.0 notes row with `**Basis.** CHANGED — …`; version the two `:366`/`:444` rows under it; say PARTIAL LIFT (24 stay) in words | MEASURE | BLOCKS | `node tests/test-docs-current.js` clause 5d passes on a `6.0.0` entry |
| 11 | State the roster's compared set wherever it is cited: 139 of 202 abilities, 142 of 148 items, 487 of 500 moves | ENGINE | BLOCKS (wording) | `node -e` over `data/roster.*.json` verdict counts matches the sentence |
| 12 | Infiltrator through the four screens — four census probes | ENGINE | BLOCKS | `node tests/test-mechanics.js` and `all_mechanics_fire.js --kind all --write --release <id>` show four new rows FIRED-AND-BOARDS-MATCH |
| 13 | The one-sentence bound on "0 of 958" (MEASURE §3) into every living document | MEASURE | SHOULD FIX | `grep -c "3 were voided" docs/ABRA-whitepaper.md docs/SUMMARY.md docs/MODELS.md` ≥ 1 each |
| 14 | Substitute family: step-0 doll slot, then the outer arrival loop with #500/#511/#361, bar checked between stages | ENGINE | SHOULD FIX | `tests/test-resolution-order.js`'s KNOWN-OPEN arm closes; differential re-run board-material unchanged |
| 15 | Spicy Spray order + correct the two false comments at `:40250`, `:40323`; Trick's guard → `itemRefusesTake`; perish `\|upkeep\|` drain; post-KO switch order; Unburden as a volatile | ENGINE | SHOULD FIX | narration causes fall by five on the re-run at the same pins |
| 16 | Compound Eyes probe; fix the Imprison/Memento `pass, move 1` throw | ENGINE | SHOULD FIX | `tests/roster.js --stage abilities` / `--stage moves --write` → the rows leave COULD-NOT-STAGE |
| 17 | `engine/mew.js` to STAY; `major_readiness` predicate follows one `require` hop | MEASURE | SHOULD FIX | `node engine/major_readiness.js` lists `mew.js` under STAY |
| 18 | Pin the census on the re-run; stop `tests/test-arm-steering.js` writing `data/mechanics-census.json` | MEASURE | SHOULD FIX | artifact `steering.pinned true`; `git status` clean after the suite |
| 19 | Consume `commit_matches`: the differential's preflight fails on drift; `engine_release.js cut --fail-on-drift` | ENGINE | SHOULD FIX | move the checkout one commit, the differential refuses |
| 20 | `ABRA-HEAP` headers on `engine/engine_release.js`, `engine/mew.js`, `tests/test-wiring.js`; run the release census at 6144 | MEASURE | SHOULD FIX | `node --max-old-space-size=6144 engine/engine_release.js census` finishes |
| 21 | One exit-code classifier imported by `run-all`, `register_reality`, `wire_ladder`; a COULD-NOT-STAGE exit counts as red unless `ABRA-EXIT 2 CANNOT-ANSWER` is printed for an environment reason | MEASURE | SHOULD FIX | a test made to exit 2 on an illegal fixture turns the suite red |
| 22 | WHO MAY WRITE: add `abra-bot` (six-hourly, `data/` only); `orient.js` fails on an unbound merge driver; exclude `.claude/worktrees` from every sweep | OPS / MEASURE | SHOULD FIX | `node engine/orient.js` prints the driver clause; `tests/test-fixture-legality.js` green with a worktree present |
| 23 | Back up the pinned pool outside the tree; `--restore-parsed` the local stores; refresh the legality verdict | OPS | SHOULD FIX | `sha256sum data/team-pool-frozen/*.jsonl` matches FROZEN.md; `node tests/test-quality.js` green |
| 24 | Derive `MEGA_ABIL` and `validate_damage.js`'s type chart; count the two empty catches at `:5500`, `:6275` | ENGINE | SHOULD FIX | `tests/test-effective-identity.js` and `engine/validate_damage.js` green with the literals gone |
| 25 | `register_reality.js --list` (verdicts a day old); flip the seven closed-on-tree register cells | ENGINE | SHOULD FIX | `node engine/open_work.js` shows the rows closed |
| 26 | ~~Version header or baseline exemption for `docs/THESIS-DEFENCE-REVIEW-2026-09-09.md` and this file~~ **DONE 2026-09-09** (§3.3: both added to `unversioned_exempt` in `data/docs-currency-baseline.json`; clause 2b green, baseline 59 / now 59) | MEASURE | ~~SHOULD FIX~~ closed | `node tests/test-docs-current.js` clause 2b green — **read green, 33/0** |
| 27 | Residual trio: say the mutual-residual-KO corner is unmeasured; 16 zero-census tags; damage-differential multi-hit band; self-play 89 dups; the nine CRLF sources; `where.js --artifacts` heuristic | ENGINE / MEASURE / OPS | DEFER WITH REASON | stated in the 6.0.0 release note |

### The thesis's twelve (sub-block; owner MEASURE unless stated; from `docs/THESIS-DEFENCE-REVIEW-2026-09-09.md` "Required to reach a pass")

| # | analysis | size | proves it done |
|---|---|---|---|
| T1 | NMF: read the rank from `nmf-rank-selection.json:most_reproducible.rank` or state rank 6 ships below null; delete "error 0.53"; replace the archetype table; re-run `nmf_rank.py` at ≥50 pairs with cophenetic correlation | hours + a run | `data/nmf-roles.json:archetype_rank` equals the criterion's, or the three documents say why not |
| T2 | WAR: three-way id-hash split; select λ on validation; report test once; record split, seed, grid, store digest | a day | `data/war.json` carries `split`, `seed`, `store_digest` |
| T3 | CHOMP-EV: populate `audExcl` below the qualify test; replace 1,205 / 6.5 / 6.08 / 1280 / 1267 with fields | a day | `chomp-ev.json:selection_audit.n_excluded_human` > 0 |
| T4 | SLOWKING: replicates at the point estimate's iteration count; remove "substantially less exploitable"; rewrite §4.5 from `supported` and the CI | a day | `slowking-eval.json` intervals contain their point estimates |
| T5 | §1 ceiling: build `engine/skill_variance.py → data/skill-variance.json` or withdraw 0.687 / 0.693 / 52.4% | real work | the artifact exists, or the figures are gone from §1 and `PUBLICATION.md` |
| T6 | XATU: reconcile `:1676-1678` and `MODELS.md:1405` with `data/policy-eval.json` | hours | the sentence quotes 0.2979 / 0.6564 / 2.6353 or names the artifact carrying 35.9 / 71.6 |
| T7 | Noisy-OR: state the assumption; measure direct vs noisy-OR P(team has role) per role; publish the signed gap | real work | an artifact field per role |
| T8 | GURU in the white paper: the family (53 cells, 3 decisive, 2.65 expected); 0.7122 → 0.7124; in-sample stated; silhouette 0.126 beside K | hours | §4.1 quotes `predictive_test` and the family |
| T9 | Roles count: 26 → derived (52 signals / 46 columns) | hours | the number is generated in the doc build |
| T10 | Bring-rate bias magnitude from one pinned pass into `bring-bias.json` or `quality-filter.json`; cite at `:1707` | a day | both operands (kept/dropped, mean turns, per-species shift) in the artifact |
| T11 | Reproducibility (#288): store digest + game-id-set digest + split + seed in every store-derived artifact; then re-run the store layer once on filter 1.3.0 | real work; makes the rest checkable | `data/provenance-stamp.json:mtime_only` falls by the twelve artifacts named |
| T12 | Citations: RAPM (Rosenbaum 2004 / Sill 2010), Pearl 1988, Hart & Mas-Colell 2000; resolve two VGC-Bench titles; fix or remove the 2603 arXiv id; mark Geng 2016 and arXiv 2304.08272 as motivation | hours | the reference list resolves |

---

## The thesis defence

The third defence returned **MAJOR REVISIONS**. The blocking item from July — the NMF rank — was not
merely left open; the artifact was regenerated at the undefended rank four days after that committee
sat (`data/nmf-roles.json:generated` 2026-08-04, rank 6, excess over null −0.107), and the white paper
still justifies it with a number its own script cannot produce. Beyond that, at least twelve figures
in the white paper disagree with the artifact the sentence cites, one "measured" selection audit
structurally measured zero games, a regularisation parameter was selected on the partition its score is
reported on, and confidence intervals the generator annotates as "unusable" are quoted as evidence. Not
one store-derived artifact records which games it read. The doctoral claim itself — exploitability — is
unmeasured and the paper says so. The measurement culture the July committees praised is real and has
improved; the defects are in exactly that layer, which is why the grade is what it is. Twelve required
analyses, five of them hours, are listed above and in full at
[docs/THESIS-DEFENCE-REVIEW-2026-09-09.md](THESIS-DEFENCE-REVIEW-2026-09-09.md); every command and
raw output is in `docs/_reports/2026-09-09-thesis-defence-notes.md`.

---

*Reviewed against commit `d6789951`. Findings 1, 2, 4, 5 and the union-driver claim were confirmed by
the coordinator's own commands; everything else is cited to the division report that carries it.
Nothing under `engine/`, `tests/` or `data/` was edited by the review draft; the three fix passes it
records (§3) edited `build/compress-stores.js`, `engine/dedupe_store.py`, `data/parsed/` (additions
only) and `data/docs-currency-baseline.json`, and nothing under `tests/`. This file is a dated record.*

---

## Corrections, same day

*Added 2026-09-09, after the review was written. The body above is a dated record and is not edited
(the scope report's precedent); each line here names what changed and where the receipt is.*

- **Finding 11 and pre-6.0.0 item 11 are WITHDRAWN.** Will, 2026-09-09: *"the abilities not tested are
  not in the game so we removed them please stop quoting them."* The abilities the roster gate did not
  test have no legal carrier in Reg M-B — `data/roster.abilities.json:scope.out_of_scope_by` reads
  `no-legal-carrier` 114 and those rows are gone from `results` — so "139 of 202" was never evidence
  for a claim about legal abilities the gate skipped: the in-scope remainder is 44 COULD-NOT-STAGE, 14
  CONTROL-NOT-QUIET and 5 DEFERRED-BY-OWNER beside 139 FIRED-AND-BOARDS-MATCH, and the three real
  ones are the instrument's debt (item 16 stands). The owed wiring is that `tests/roster.js` derives
  `in_scope` by LEGAL CARRIER so the gate's SCOPE line stops printing them: ROADMAP #555, ENGINE, not
  a 6.0.0 blocker. Item 11's "state the compared set" wording goes with it.
- **The pre-commit hook cannot pass on a fresh clone — finding 4 predicted the shape and the hook
  demonstrated it.** A clean checkout at `49793320` fails `tests/test-artifact-rerunnable.js` ("99
  stamped artifacts over 36 releases: 99 STRANDED" — `data/releases/` is gitignored except the
  force-added few), the generated-bundle gate's MTIME clause ("`data/engine-data.js` is older than
  source" on bytes identical to a commit that passed), and the archive-index clause (rebuilt and
  committed in 5.276.0, the only one of the three now closed). Every commit therefore comes from this
  laptop. ROADMAP #554, MEASURE. Receipts: the coordinator's log, 2026-09-09.
- **The "Numbers corrected" row for the MILTANK profile figures no longer restates the withheld
  values.** `tests/test-docs-quarantine.js` flagged the row (eight figures read from
  `data/search-decision-profile.json`, a STAY artifact); the coordinator replaced them with the
  withholding. A caption is not a quarantine, and a review table quoting a withheld figure to say it
  is withheld is a caption.
- **Landed after this document was written**, one line each (all in CHANGELOG 5.276.0):
  - Void games: two of three were the engine and are closed (Misty Terrain's `onSetStatus`; a charge
    move's release at the CHOSEN slot), one is the instrument (`game_differential.js:1623`, a stale
    `activeTarget`) — item 3, `docs/_reports/2026-09-09-void-games-attribution.md`.
  - Board clause: `engine/quarantine.js` counts a void game whose board parted — **3 of 961** on the
    same artifact where this review read 0 of 958; MEASURE §3's bound, made a count.
  - Release `b730e44f3314` tracked, 29 files — item 5.
  - Pin refusal: `engine_release.js cut` and the differential's `--release` path refuse when the
    Showdown checkout is off `PINNED_COMMIT` — item 19.
  - Ingest guard wired: `compress-stores.js --check` runs in `ingest.yml` before commit, depth-2
    checkout — item 2's remainder.
  - Self-play store: 3,090 lines / 3,090 unique ids — #536 closed.
  - Docs gate: rule 3d, `tests/test-docs-current.js` 35/0, the 27 → 41 mutation caught by name —
    item 6, #552 closed.
  - Seven waivers by name in `data/test-waivers.json`, printed by the runner — item 7's second half.
  - Hourly Reg M-C collector (`next-regulation.yml`) and the ingest gap detector; Reg M-C's own move
    and item changes are #553, sequenced after the Reg M-B gate opens.
  - NMF ships rank 4, read from `data/nmf-rank-selection.json`; `data/policy-eval.json` re-run under
    quality filter 1.3.0 — T1, T6, T8 and T9 in part.
