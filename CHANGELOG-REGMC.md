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
