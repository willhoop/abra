# Changelog — ABRA on Reg M-C

<!-- LINE: id=abra/regmc; label=ABRA on Champions Reg M-C; format=gen9championsvgc2026regmc -->

All notable changes to ABRA's **Reg M-C** line are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**This is a separate version series and it starts at 0.1.0.** A leading `0` means NOT USABLE YET
(SemVer 2.0.0 clause 4). This line reaches **1.0.0 the day the Reg M-C gate opens** — computed by
`node engine/quarantine.js`, never declared by anyone.

**Reg M-B's record is `CHANGELOG.md` and is CLOSED at 7.0.0.** Nothing here renumbers it, rewrites a
released row, or moves a published figure. A version in this file is not comparable to a version in
that one: they answer different questions about different regulations. See
[`docs/REGMC.md`](docs/REGMC.md) — *The version scheme* — for what a number means and when it resets.

**Rule.** Every change is logged here in the same pass as the code, together with the matching row in
`docs/RUNNING-NOTES.md` (tagged `## [abra/regmc <version>]`). A prior conclusion is never silently
rewritten; what changed and why is stated.

---

## [0.12.0] — 2026-09-21

### Added
- **The regulation is selectable at RUN TIME.** `engine/regulation.js` is the one resolver:
  `--regulation <id>` on any script, then `ABRA_REGULATION=<id>`, then `data/regulations.json`
  `active`. `<id>` may be a key or a full Showdown format id. `champions_sim.FORMAT` reads it, so all
  **490 readings across 357 files** follow with no edit — the differential, the roster, the census and
  the staged battery included, because each resolves through `CS.FORMAT`.
- **Selecting a regulation selects its Showdown CHECKOUT.** `data/regulations.json` gains a `runtime`
  block carrying each regulation's checkout and pinned commit; `engine/showdown_path.js` tries the
  selected regulation's checkout first. An explicit `SHOWDOWN_PATH` still wins over everything.
  `showdown_path.js` also gained the git-worktree anchor, so a worktree can now find a sibling checkout
  at all.
- **`tests/test-regulation-runtime.js`** — 35 clauses, every varying clause paired with a cleared
  control. Shown RED at 17/35 on a deliberate one-line unwiring before being trusted.

### Changed
- **`PINNED_COMMIT` / `PINNED_DATE` are per regulation**, read from `data/regulations.json` `runtime`
  rather than being literals in `engine/champions_sim.js`. One constant cannot pin two authorities.
  Absent is reported as UNKNOWN by `verify().commit_matches`, never as a mismatch.
- **`verify()` reports `regulation`, `regulation_source` and `regulation_explicit`**, so an artifact
  that stamps it can say whether a caller NAMED a regulation or the config decided.
- **`engine/engine_release.js` SOURCES gains `engine/regulation.js`** (the sixth growth, and the second
  refused at the cut rather than found by a crash). Existing releases are untouched and nothing is
  stranded; every future release id changes, which is correct.

### Fixed
- **Nine inlined reads of `data/regulations.json`, each with its own silent fallback literal, are
  gone** — `analyze.js`, `chomp_ev.js`, `durable-ingest.js`, `fetch_smogon_stats.js`, `meta-ingest.js`,
  `smogon_priors.js`, `validate_damage_sim.js`, `sim/champions-battle.js`, `champions_sim.js`.
  Hardcoded regulation sites **26 → 19** — nine deleted, two created and both declared: the resolver's
  one surviving literal, and `tests/test-regulation-runtime.js`'s independent re-reading of the
  expression it replaced, which is the control that makes clause 1 mean anything.
- **`engine/durable-ingest.js` refuses an empty format list** (exit 2) instead of running clean over
  zero formats.
- **`engine/regulation.js` was unpinned in `.gitattributes`** — caught by `tests/test-engine-release.js`
  in the same pass it was written; an LF source with no pin moves the release id on a fresh checkout
  with no code change. 79/1 → **80/0**.

### Notes
- **THIS IS A REFACTOR AND NOTHING MOVED.** Damage differential `--n 6000 --seed 20260804`:
  byte-for-byte identical. Lattice `--games 1200 --team-store data/team-pool-frozen`, no `--regulation`
  on either arm: 35,980 bytes, **two lines differ** — the release id and the wall clock. All 10
  divergences, the pool digest `0d103fb9fa87` and the census digest are identical.
  **The 10 is a fingerprint, not a gate reading**: these runs omit `--steering empirical --arm middle
  --end-state` and answer a different question from `engine/quarantine.js`.
- **`regmc` is in `runtime` and deliberately NOT in `regulations`.** `engine/next_regulation.js` walks
  `regulations` to decide what is already known, so an entry there would tell the hourly collector that
  M-C is known and stop it collecting. Being selectable is not being active; `active` is still `regmb`.
- **NO REG M-C FIGURE IS PUBLISHED and none was measured.** MEDICHAM still cannot build an M-C team —
  `data/engine-data.js` has no row for any of the 35 added species. The flag is necessary and not
  sufficient. Full account: `docs/_reports/2026-09-21-regulation-runtime.md`.

## [0.11.0] — 2026-09-21

### Added
- Nine checks wired into `tests/run-all.js` that nothing ran before: three selftests and six game-free
  probes. 9 passed, 0 failed, ~36 s added.

### Changed
- Twenty-six files named `PENDING_WIRE` with a reason. **None was named `NOT_A_CHECK`** — each asserts a
  contract, and calling one otherwise would be the failure the clause catches.

### Notes
- **The UNACCOUNTED-FOR clause is closed: 35 → 0**, from 30 before this session plus five of our own.
- No check went red once it ran — the weaker result, not the better one.
- One real defect named and not fixed: a usage probe throws `ENOENT` on an absent store instead of
  exiting 2. Twenty ledger rows are owed to ENGINE.

## [0.10.0] — 2026-09-21

### Fixed
- `tests/test-knob-control-arm.js` — three probes that gained a seal line had their recorded knob
  verdicts invalidated by the edit. Re-measured; 81 of 81 green.
- `engine/provenance.js` — the release the current artifacts were measured on (`adb08f5360f1`) was
  gitignored while the living documents cited artifacts stamped with it, so the citation chain ended at
  a string. Tracked, and **the rule written into `.gitignore`**: a release is tracked when a published
  record or the current living-document citations rest on it; a working release is not.

### Notes
- **Full 184-check suite: 172 pass, 9 waived, 4 fail** — from 17 at the start of this session.
- Remaining: `engine/conformance.js` (10 findings, 5 waiting on the model rebuild), the UNACCOUNTED-FOR
  clause (35 files nothing runs and nothing names, 30 of them pre-existing), and `test-mag-page`.

## [0.9.0] — 2026-09-21

### Fixed
- **Three classes of roster fixture never reached the legality judge.** `tests/roster.js` repairs only a
  scenario that becomes a row, so the rig's own proof fixtures, the control arm's appended click and the
  stat pricer were never judged. Illegal sets **152 → 141**; `probe_control_self_name` receipt **9 → 2**
  and GREEN. No roster count moved: items 148/148, abilities 196/200, moves 496/497 over six runs.

### Notes
- **Two illegal fixtures remain and cannot be staged legally**: no Reg M-B set both carries a quiet
  ability and clicks Skill Swap — 8 abilities, 9 carriers, 63 learners, intersection empty — and **84 of
  the 200 ability rows rest on that control**. Nothing baselined; the baseline serves a static sweep and
  this set is built at run time.
- The 9 baselined staged-board fixtures are deferred repairs, all but one repairable. Carry them, do not
  bless them.
- `tests/test-roster-arm-pin.js` builds four sets and all four are illegal — same shapes, another file.
  Reported, not repaired.

## [0.8.0] — 2026-09-21

### Changed
- **`data/meta-usage.json` regenerated on the filtered corpus** — the file CHOMP reads. `usable`
  33,539 → 28,454, with the custom-ruleset stage recorded (6,952 flagged, 5,085 removed) and the
  18.57% untestable share carried through so the count is not mistaken for a census.
- The division ledgers are restamped; `docs/ENGINE.md` records the re-measure.

### Notes
- **Whole battery on release `adb08f5360f1`: gate OPEN, board-material 0/0/0 across the lattices,
  narration zero on every lattice, held-out 7,182 games with 0 board partings**, damage 0 of 6000 at
  every corner, census 1004/1004/0.
- The engine reached those zeros while carrying a defect neither the gate nor the held-out draw could
  see. An open gate and a correct engine remain two different claims.
- Reg M-B's record is not restated: `abra/regmb` is closed at 7.0.0 and its closed-line clause refuses
  an entry above it.

## [0.7.0] — 2026-09-21

### Fixed
- **A body that dies the moment it arrives was never replaced.** The refill list was built once and
  never rebuilt, so a fainted replacement stood in its slot until the next turn; the authority loops
  until the board is settled. Found at turn 13 of a real game whose streams had been identical for 13
  turns. **This is a MEDICHAM defect the gate did not catch** — it reads zero on three lattices and on
  a 7,182-game held-out draw, and a mirror test outside the gate found it. Knob
  `MEDI_REFILL_ONE_WAVE`, probe `tests/probe_refill_second_wave.js` — 0 clean / 1 under the knob.
- **Three checks were passing vacuously**: a staged-board plant whose anchor a later wire had split in
  two, a control clause iterating an emptied array, and an end-state fixture starved to zero. Each now
  proves itself on a PLANT rather than on a defect that may cease to exist.
- A coverage driver was **stateful across games**, so one part's game count moved another part's
  verdict. Proved not-the-engine under the revert knob, then frozen and restored.
- `engine/scan_custom_rulesets.js` declared NOT_A_MODEL with its reason.

### Notes
- Census **1002 → 1004 live / 1004 probed / 0 missing**.
- **All seventeen reds a full-suite run found are closed, and thirteen of them were the instrument
  rather than the engine.**
- The engine moved, so the gate, the lattices and the held-out draw are owed a re-run, and no figure
  from the previous release is restated here.

## [0.6.0] — 2026-09-21

### Added
- **`exclude_custom_ruleset` — the ladder corpus is filtered of games played under custom rules.**
  Will: *"yes clean the store filter it all out"*. `engine/scan_custom_rulesets.js` streams
  `data/games.ladder.raw-logs.jsonl` and reads the `N custom rule(s):` infobox Showdown itself emits,
  writing the id set to `data/custom-ruleset-ids.json`; `data/quality-filter.json` 1.6.0 reads it.
  **The store is not edited** — `store raw, analyze on top`. **6,978 raw logs carry the infobox,
  6,952 distinct ids, all 6,952 present in the store = 7.37% of 94,360.** 129 alter what a team may
  legally contain or how many are picked; the other 6,823 set a different information regime, **5,210
  of them a bare `Best of = 3`** — bo3 tournament games misfiled in the bo1 ladder store. The clean
  ladder corpus moves **33,539 → 28,454 (−5,085, −15.16%)**, before and after on one store read.
  Contamination is **2.06× denser** in the clean corpus than in the store, because bots do not play
  custom-rules rooms.
- **The run prints the UNTESTABLE SHARE every time.** The infobox is in the raw log and **17,527 rows
  (18.57%)** have no local raw log, so the count is a **FLOOR, never a census**. Both readers carry
  that share out to `funnel()`.

### Fixed
- **`exclude_nonstandard_ruleset` had NO READER.** It was added and switched on at
  `data/quality-filter.json` 1.5.0 and neither `engine/quality.js` nor `engine/quality.py` looked at
  it — a rule written down, switched on, honoured by nobody, with every funnel printing a plausible
  number. Both readers honour it now, and `tests/test-quality.js` asks each enabled rule for a reason
  code a reader emits and a funnel stage that counts it, so a rule added without a reader fails by
  name rather than by a rule count.
- **`engine/sanity_check.py`'s `nobody brings more than four` honours the declaration** the way its
  winner clause already did: every over-four bring is counted, a declared one is attributed, an
  **undeclared one FAILS**, and a **declaration whose row no longer breaches FAILS** so it cannot
  outlive its defect. Shown red on both breaks before being trusted. `SANITY: 96 passed, 0 failed`.
- `engine/provenance.js` attributed `data/custom-ruleset-ids.json` to `engine/quality.py`, which only
  READS it — the reader's `open(CUSTOM_RULESET, ...)` outranked the writer's flag-bound path. The
  scanner now spells the name on its own write line and the graph says `write line`.

### Notes
- **Basis unchanged**, and **no published Reg M-B figure is affected**: `data/team-pool-frozen` holds
  `games.bo3.jsonl` and `games.ots.jsonl`, and **those two stores share zero ids with the ladder
  store** (measured 2026-09-21). This is a cleanup, not a retraction.
- **The 1,176 in `docs/_reports/2026-09-21-six-bring-game.md` §5b is superseded.** That scan's regex
  required the PLURAL `custom rules:`, so every one-rule room was invisible. Reconciled to the unit:
  its per-string joined counts (691 / 170 / 101 / 56) reproduce exactly, and the residue is 5,768
  single-rule rows plus one 8-row string.
- `data/live.js` and `data/meta-usage.json` still carry `usable 33539 / 35.5%` and are now STALE; they
  owe an OPS regeneration. `docs/SUMMARY.md` no longer cites them for that figure.
- Full account: `docs/_reports/2026-09-21-custom-ruleset-filter.md`.

## [0.5.0] — 2026-09-21

### Fixed
- **A certificate that applied and reverted nothing.** `probe_red_demo`'s mega-stone demonstration
  matched its pattern exactly once — in the arm where the stone is never taken — so it proved nothing
  while reporting fine, and its fixture had gone unreachable because the body now faints before the
  step under test runs. Four further demonstrations could not apply their patch at all after last
  night's engine work. **197 demonstrations: 0 HOLLOW, 0 COULD NOT BE APPLIED** (was 1 and 4). One
  assertion that had gone stale is now stricter, not weaker. No engine byte changed.
- **`engine/conformance.js`'s ratchet was laundering findings.** `classify()` asked *did the rule move*
  before *was this already outstanding at the seed*, and a seeded finding sits on an unchanged subject
  by definition — so editing a standard turned that standard's old findings into non-fatal DISCOVERIES,
  which **the first clean run would have adopted permanently.** Demonstrated by restoring the old order
  and reproducing it. The recorded fact now outranks the digest.
- Two further conformance checks measured the wrong thing: *"declares its generator"* read the first 400
  bytes for a word, which measures **key order** — 5 of 8 subjects were pushed past the window by a
  digest block — and the subject digest did not normalise line endings, so from a worktree every `data/`
  subject read as CHANGED and four findings carried a fictional reason.
- **`data/battle-formes.json` gets a generator, and it was derivable exactly**: `species.battleOnly`
  reproduces the hand-built map **131/131, zero missing, zero extra, zero disagreements**. The walk is
  deliberately unfiltered — filtering to the regulation drops 48 entries, which in a store spanning
  regulations are 48 silent mis-keys.
- **A withdrawn figure was still published.** `docs/ABRA-whitepaper.md` carried PORY's held-out
  log-loss with its interval and calibration error; 7.0.0 withdrew every non-MEDICHAM figure and the
  pass missed this one. Deleted, not captioned.

### Changed
- `engine/sanity_check.py`'s cross-consistency clause **REQUIRED** PORY's log-loss in the white paper
  and the summary. Will, 2026-09-21: *"dont take the previous models not named medicham as gospel i
  will likely have to change them all."* A check demanding a withdrawn figure enforces the opposite of
  the policy, so it now asserts ABSENCE, and carries the note that it flips back the day PORY is re-run.

### Notes
- `sanity_check` 94 → 95 passing. Conformance 11 → 10, all S13 artifact provenance, none exempted
  beyond a `void: true` artifact whose writer can never restamp it. **Five of the ten need a decision
  rather than a cleanup** — each requires a refit or moves a published figure — and they wait on the
  model rebuild.
- **A second tool writes absence as fact from a worktree**: `provenance.js --strict` ratcheted its stamp
  down because the worktree lacked three files main has. Reverted. Same hazard as `status.js --write`.
- **Eleven of the seventeen reds are now closed.**

## [0.4.0] — 2026-09-21

### Fixed
- **Six counters incremented a field they never declared**, so each `++` yielded NaN and the counter
  counted nothing — a capability unable to prove it ran. Declared on the objects that own them.
- **`tests/test-unmodelled-clicks.js` proved itself on a real defect, and the defect ran out.** Every
  move in this format is now modelled — the sweep is EMPTY — so the three clauses that asserted the
  counter had fired went red exactly when the hunt succeeded. The proof of life is now a PLANT (a click
  that cannot be modelled by construction); the real sweep is asserted empty separately, and a
  regression is caught by the no-growth clause where that job always belonged.
- **A record in the test runner's own notes had outlived what it described.** It said a probe had never
  been measured and carried no marker; `docs/ROADMAP.md` names it, so both halves were false. Corrected
  rather than deleted. Note left for the next editor: the matcher reads a sentence as an assertion and
  cannot tell a live claim from a quotation of a retracted one — describe old wording, do not repeat it.
- **Three probes loaded the mon table without loading the door**, leaving `MC.mons` unsealed in their
  process, where a mistyped key reads `undefined` instead of throwing — the 2026-07-30 shape. One
  require line each.
- **A probe hand-rolled a species scan.** It SEARCHES for its fixture rather than resolving a key, which
  is legitimate, so it now takes the table through `mcKey.rawTable(<why>)` — the reason is greppable and
  recorded at run time rather than resting on a name in an exemption list.
- **Three identity reads went around the door.** Declared with their reason: they match this file's own
  plants by the name it chose, on inert set objects, so routing them through the resolver would be wrong
  twice over.

### Notes
- Five gates closed: `test-counter-init`, `test-unmodelled-clicks`, `test-claim-truth`, `test-mc-key`,
  `engine/identity_audit`. With `test-knob-control-arm` and `test-workflow-paths` earlier, **8 of the
  17 reds found by the full suite are now green.**
- The finding underneath the unmodelled-clicks fix: **every move in this format resolves to something.**

## [0.3.0] — 2026-09-20

### Added
- **The frozen Reg M-C team pool** — `data/team-pool-frozen-regmc/`, 24,832 games / 49,664 sides /
  11,608 distinct teams, digest `792daded918f`. Excluded: 31,888 not-open-sheet (the scope rule) and
  **363 by Will's Eject Button conjunction** — played before the fix AND the item declared on either
  sheet. A date-only cut would have discarded 8,352 to guard against 335.
- **`docs/REGULATION-ROTATION.md`** and `engine/regulation_touchpoints.js` — what changes between
  regulations, derived rather than typed. Of 1,586 tracked files: 3 configuration, 25 hardcoded,
  110 derived, 1,364 historical (86% is write-once evidence that must NOT change).
- `engine/screen_tags.js`, and two probes: `probe_future_scope_readmission`,
  `probe_tag_derivation_without_prose`.

### Fixed
- **The scope authority silently dropped a live ability.** `engine/legal_scope.js` now puts every
  `Future`-flagged candidate to the `TeamValidator` in the set it is reached through, and prints the
  re-admitted list every run. **Reg M-B re-admits NONE — all 20 candidates refused in the validator's
  own words — so the published M-B record is provably unaffected.** M-C re-admits exactly one ability.
  Ungated re-admission would have wrongly added two mega stones; it was measured before it was wired.
- **Tags were derived from prose, and the prose moved.** `tag_dex` read `move.shortDesc`; Reg M-C ships
  without the Champions descriptions, so the screens derived the wrong halved category and the
  screen-breakers lost their tag — silently, to a default. Now derived from the condition handlers:
  **0 of 500 moves move on M-B, 0 of 515 on M-C**, with every description empty.
- **Six counters incremented a field they never declared**, so each `++` yielded NaN and the counter
  counted nothing — a capability unable to prove it ran. Declared on the objects that own them.
- `tag_dex` refuses to write under a declared restore knob; it had zeroed 316,656 usage entries and
  exited 0.
- The local parsed store was **1,766 games behind the tracked shards** (92,594 against 94,360).
  Reconciled and re-sharded; `tests/test-workflow-paths.js` green.
- `tests/test-knob-control-arm.js` understands a defect held shut by TWO guards: a knob may declare
  `PAIRED WITH <other>`, and the measurement sets both. It had read a correct probe's single-knob green
  as an unwired knob. **81 of 81 pairs green, and the declared-red list is now EMPTY.**

### Changed
- **Will's three Reg M-C decisions** (published as `7.2.0` on the Reg M-B line before this line
  existed; the content is unchanged): the Reg M-B collector's schedule is off and the format carries
  `searchShow: false` so it cannot be laddered anyway; M-C scope is the same as M-B for now — open team
  sheets only, Illusion excluded, closed sheets and bo1 out of scope; and the Eject Button exclusion is
  a CONJUNCTION rather than a date range.

### Notes
- Census 1002 → 1003 probed/live, 0 missing. The second Showdown checkout is built and Reg M-B's legal
  species set is identical in both checkouts, so nothing published at 7.0.0 moved.
- Reg M-C is **not simulated**: the engine loads it, builds a legal team and plays a game, but builds
  0 of the 35 new species because `data/engine-data.js` is an M-B artifact. No M-C figure is published.

## [0.2.0] — 2026-09-20

### Added
- **A version is per (model, regulation), and the parsers read it.** `engine/docs_scan.js` now derives
  VERSION LINES from the changelogs present: each declares itself in its own masthead, each has its own
  top, its own major floor, its own documents and its own notes rows, and a version is compared only
  inside its own line. `node engine/docs_scan.js --lines` prints them.
- `engine/model_versions.js` — the per-(model, regulation) version, DERIVED and never typed: a model
  reaches `1.0.0` only when a gate certifies it on that regulation AND no artifact it publishes is
  quarantined or stale. `node engine/model_versions.js`.
- A closed-line clause: a changelog entry or a notes row carrying a version above the `closed=` its
  line declares is refused by `tests/test-docs-current.js`. "Closed" is machine-read, not remembered.

### Changed
- The two entries published as `7.1.0` and `7.2.0` were Reg M-C setup work carrying Reg M-B numbers.
  `7.1.0`'s content is this line's `0.1.0` below, unchanged word for word.
- A `0.x` line's documents are due EVERY release rather than at its next major, because a line that has
  never shipped a major has no deferred pass to measure a backlog against (SemVer 2.0.0 clause 4). That
  is stricter than the Reg M-B rule, and it relaxes by itself the day this line reaches 1.0.0.

### Notes
- No Reg M-B figure moved, and no Reg M-B document changed its version header. This is a documentation
  versioning change; the MEDICHAM gate's clauses are untouched.
- Full account: `docs/_reports/2026-09-20-version-per-regulation.md`.

## [0.1.0] — 2026-09-20

### Added
- A second Showdown checkout for Reg M-C (`pokemon-showdown-mc`, `f10d679`, 2026-09-20), so pulling the
  M-C authority can never move the bytes Reg M-B's published figures rest on.
- `docs/REGMC.md`, the Reg M-C ledger, opening at **0.1.0** — a leading zero means not usable yet; it
  reaches 1.0.0 when the M-C gate opens.

### Notes
- Delta against the PINNED M-B authority: species +35, moves +15, items +18, abilities +0, nothing
  removed. The ruleset is identical. The real surface is 41 mechanics (15 abilities, 14 moves, 12 held
  items), not 35 species.
- Two moves legal in both regulations had PP cut 10 → 5, and Rocky Helmet is unbanned — changes no
  added/removed list reveals.
- The strict legality filter drops one live ability in M-C (1 of 317); M-C must re-admit validator-
  accepted `Future` entries and print the list every run.
- M-B's legal species set is identical in both checkouts — 347 either way — so nothing published at 7.0.0 moved.
- Published as `7.1.0` on the Reg M-B line on the day it landed, and renumbered here with its content
  unchanged. `CHANGELOG.md` now carries no entry above 7.0.0.
