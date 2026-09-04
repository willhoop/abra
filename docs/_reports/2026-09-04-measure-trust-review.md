# MEASURE — what should not be believed (read-only review, 2026-09-04)

Read-only. Nothing was written, fixed, refit, restamped or committed. No game was played.
Every figure below was read from an artifact or from source at the time stamped beside it.

**Conditions of the review.** Another agent was writing `docs/` during this pass
(`docs/SUMMARY.md`, `docs/ENGINE.md`, `docs/MEASURE.md`, `docs/MODELS.md`, `docs/ABRA-*.md`
all moved at 2026-09-03 22:26 local, ~9 min before my `docs_scan.js` run). Every `docs/`
number in section 5 was read from a moving tree and should be re-read before it is acted on.
All `data/` artifacts were settled: `data/game-differential.json` last written 22:16 local,
28 min before my `status.js` run; no node process above 66 MB was resident (`tasklist`,
two Claude-owned processes only).

**Canonical paths only.** `engine/status.js` (which shells `engine/provenance.js`),
`engine/provenance.js --verdicts-out`, `engine/coverage.js --audit`,
`engine/docs_scan.js --json`, `tests/test-artifact-rerunnable.js`, and
`engine/coverage.js`'s exported `gateArtifacts()`. No second implementation of anything.

**Quantities named every time.** Two different numbers get called "the differential":

| quantity | value | source |
|---|---|---|
| whole-game **protocol first-divergence** | **168 of 961 raw; 167 after 1 declared = 17.4%** | `data/game-differential.json` `diverged`, `state.protocol_diverged_games` |
| whole-game **board-material** | **77 of 961 = 8.0%** (961 minus `state.games_board_never_diverged` 884) | `state.games_board_never_diverged`, `state.game_agreement` 0.9199 |
| turn-boundary agreement | 10,572 boundaries, 0.9754 | `state.turn_boundaries_compared` |
| damage differential | 0 of 6,000 at midpoint and at all 16 corners | `data/engine-diff.json` |

All on `--games 1200` (a PAIR budget) yielding **961 played**. No rate here is compared
against a run at another budget.

---

## 1. Every artifact a gate clause reads — age, and whether its declared inputs match disk

`data/provenance-stamp.json` ratchets **189 files resting on MTIME alone** out of **252 in
the graph**. `engine/provenance.js` verdicts as of 2026-09-04 02:32Z:
**UNSAFE 188, VOID 2, stale? 35, ok 27, missing 0** — 190 of 252 unsafe or void.
Only **4** artifacts in the whole repository carry a content-verified `source_digests` stamp
(`provenance-stamp.json.verified`).

### The eight clauses and what each one actually opens

| # | clause | verdict | artifact(s) it reads | `generated` age | provenance | digest basis |
|---|---|---|---|---|---|---|
| 1 | game differential | PASS | `data/engine-diff.json` | **5.8 d** | **stale?** — older than `abra-tags.js` and `engine-data.js` | **mtime-only** |
| 2 | deliberate roster / items | PASS | `data/roster.items.json` | 1.0 h | stale? (older than `roster.json`) | mtime-only |
| 3 | deliberate roster / abilities | PASS | `data/roster.abilities.json` | 1.0 h | stale? | mtime-only |
| 4 | deliberate roster / moves | PASS | `data/roster.moves.json` | 60 min | stale? | mtime-only |
| 5 | coverage / every used mechanic is measured | PASS | `data/click-counts.json` | **24.2 d** | **UNSAFE** — older than the quality filter | **mtime-only** |
| | | | `data/mechanics-census.json` | 2.4 h | ok | mtime-only |
| | | | `data/tags.json` | 5.5 d | ok | mtime-only |
| | | | `data/roster.moves.json` | 60 min | stale? | mtime-only |
| 6 | whole-game differential | **FAIL** | `data/game-differential.json` | 28 min | ok | **verified** (the only one) |
| | | | `data/engine-release.json` | no stamp | ok | mtime-only |
| | | | `data/decision-impact.json` | **ABSENT** | not in graph | — |
| | | | `data/whole-game-baseline.json` | no `generated` stamp | **UNSAFE** | mtime-only |
| 7 | mechanics / staged and compared | PASS | `data/all-mechanics-fire.json` | 59 min | ok | mtime-only |
| | | | `data/click-counts.json` (reach shelf) | **24.2 d** | **UNSAFE** | mtime-only |
| 8 | no open, known engine defect | PASS | `docs/ROADMAP.md` (hand-typed) | n/a | not an artifact | none |
| | | | `data/register-reality.json` | **7.4 d** | not in the gate list | mtime-only |

**Answer to the question asked.** Of the ~12 artifacts the eight clauses open, **exactly one
(`data/game-differential.json`) rests on content**. Every other one rests on mtime, which
`data/provenance-stamp.json`'s own note says "cannot detect an artifact written after an input
it read before" — the failure that cleared the void 7,100-game WOBBUFFET run on 2026-08-04.

Widening to the full derived set (`engine/coverage.js` `gateArtifacts()`, 23 files named by
`quarantine.js` plus `status.js`): **14 mtime-only, 6 content-mismatch, 2 verified, 1 absent**.

### Two structural notes on this table

- **`engine/quarantine.js` never consults `engine/provenance.js` for its own inputs.** Grepped:
  the string `UNSAFE` appears in no clause. `status.js` withholds the interaction matrix and the
  release ladder because provenance calls them UNSAFE — and in the same run passes clause 5 and
  clause 7 off `data/click-counts.json`, which provenance also calls UNSAFE. The withholding
  rule stops at the gate's own door.
- **`engine/coverage.js`'s `gateArtifacts()` cannot name the artifact for 2 of the 8 clauses.**
  It matches the literal forms `D('data','x.json')` and `j('x.json')`; `rosterStage` builds its
  filename as a template string, so `roster.items.json` and `roster.abilities.json` are absent
  from the derived list. Scope still prints for them because `rosterStage` sets `clause.file`
  and `clauseArtifact()` prefers that — so nothing is wrong on screen today, but the derivation
  is short by two and would go quiet if `clause.file` were ever dropped.

---

## 2. Which PASSING clauses pass on a population that cannot contain the failure

Highest-value section. Ranked by how much of the question each one is not asking.

### 2.1 Clause 8 — "no open, known engine defect". Population: 9 of 66.

`data/register-reality.json` (2026-08-27T20:06Z, **7.4 days old**, 112 rows) reports
`counts.open_asserting_breakage: 66` and `counts.open_asserting_breakage_and_marked: 9`.
The clause can only turn red on an open row whose named instrument RAN and came back RED.
Everything else is routed out of the population by name:

- **59 open rows assert breakage with no instrument at all** — printed as DEBT, explicitly
  "they do not hold this clause shut" (#349, #364, #289, #339, #397, #400, #327, #529, #220,
  #300 and 49 more).
- **27 rows are `unrunnable`**; 7 of those are open (#218, #318, #319, #376, #438, #439, #440).
  #218 is "THE WHOLE-GAME DIFFERENTIAL SAYS 39.6% OF GAMES DIVERGE, IT GATES NOTHING" and its
  instrument exits 2 — a code the register itself calls `UNDECLARED`.
- **8 rows declare NOT A DEFECT**, of which 1 (#252) would otherwise have counted as broken.
- `counts.instrument_owed: 33`, `unverifiable_open_defects: 42`, `premature_closes: 3`,
  `stale_rows: 4`, `cannot_answer: 3`, `exit_codes_undeclared: 5`.

**And nothing checks the age of `register-reality.json`.** `registerRealityRows()` returns
`{rows, why, generated}` and `openDefectClause` prints `verdicts_read: 112` with no staleness
refusal — while the roster clauses and the whole-game clause both refuse outright on a release
mismatch. The engine moved 2026-09-03 20:15; these verdicts are from 2026-08-27. Three
instruments are RED in that file today (#258 and #409 via `tests/test-no-silent-failure.js`,
#450 via `tests/probe_mid_cat_reload.js`) and the clause passes because their rows read closed.

**What its population excludes: 57 of 66 open breakage claims, and any defect that appeared in
the last 7.4 days.**

### 2.2 Clause 1 — damage differential. No release pin, no staleness refusal, no volleys.

`data/engine-diff.json` carries **no `engine_release` and no `release` field at all** — I
printed its key list to confirm. `differentialClause()` (`engine/quarantine.js:598`) refuses
exactly two things: a `--plant` demonstration, and an absent `arms` array. It has **no release
guard and no age guard**, unlike `wholeGameClause` (#298) and `rosterStage`, which both refuse a
mismatch outright with "that is not a weaker answer, it is an answer about other bytes."

So this clause has read PASS for 5.8 days across an `engine-data.js` regeneration (2026-08-31,
**318 species to 322**, digest `405c836793d1` to `9d289cf77e24`) and a `medicham2-browser.js`
rewrite (2026-09-03 20:15), and is structurally incapable of noticing. Provenance already calls
it `stale?` — older than `abra-tags.js` and older than `engine-data.js`. **This is the nearest
sibling of the bug found today**: a clause answering about a population (here, a set of bytes)
that is not the one the reader thinks it is.

Population exclusions on top of that:

- `skipped_multihit: 134` — **14 of 500 legal moves carry the `multiHit` tag and are skipped by
  construction. The volley loop has never once been damage-compared.** 11 were drawn and
  skipped; **3 were never drawn at all** (`bonerush`, `doublehit`, `tailslap`).
- `skipped_ability_multihit: 17` — Parental Bond clicks, never run.
- `pool.dropped: 9` — species that can never be drawn (`florgeswhite`, `amoonguss`, `jirachi`,
  `magnezone`, `walrein`, `ironvaliant`, `torracat`, `rillaboom`, `revavroom`).
- **ranged mechanics fully staged: 0 of 8.** Both pinned arms reach the two ENDS of a range and
  never its interior; all 8 are `multiHit` width 3-4, and the damage differential skips those
  moves outright, so nothing in the project compares them anywhere.

### 2.3 Clause 5 — coverage. Population: moves only, on a 24-day-old corpus.

`data/click-counts.json` states its own hole in a field called `not_covered`:

> "abilities and items. The store records a move CLICK; it does not record which ability a body
> carried unless the game had an open sheet (891 of 52,377)."

`coverageClause()` walks `Object.entries(clicks.moves)` and nothing else. **No ability and no
item is in the population of "every used mechanic is measured by something", at any usage.**

The corpus is 2026-08-10, `store_games: 64846`. `data/games.ladder.jsonl` plus
`data/games.bo3.jsonl` now hold **101,781 lines**. **26 moves sit in the 15-24 click band**
(`steelroller` 23, `shadowpunch` 23, `clearsmog` 22, `aquaring` 22, `sparklingaria` 22,
`spiritshackle` 22, `blastburn` 22, `recycle` 22, `aromaticmist` 21, `flyingpress` 21 and more)
and are below the `REACH_SHELF_CLICKS = 25` shelf **on a corpus that has since grown by more
than half**.

And "measured by something" is weaker than it sounds. Of the 412 moves above the shelf,
**395 are staged with a FIRED-AND-BOARDS verdict, 1 is shelved, and 16 are covered ONLY by a
census tag probe** — 15,735 clicks, led by **`infestation` (7,284)**, `extremespeed` (2,986),
`iceshard` (1,674), `jetpunch` (652), `struggle` (639), `bugbite` (597), `imprison` (518),
`ragingbull` (284), `firespin` (241), `aurawheel` (239), `upperhand` (206), `memento` (134),
`whirlpool` (132), `sandtomb` (68), `focusenergy` (56). A tag probe asks whether the tag fires,
not whether the board agrees.

### 2.4 Clause 7 — mechanics. Reads 0 after subtracting nearly everything.

Raw: 5 mechanics diverge. Then minus 1 declared (Supreme Overlord `fallenundefined`), minus 4
below the reach shelf (`gastroacid` 11 clicks, `reflecttype` 11, `corrosivegas` 1, `healbell`
**0**), minus 3 shelved by owner (`bittermalice`, `nightdaze`, `forewarn`) — leaving **0**. The
shelf is read from the same 24-day-old, UNSAFE `click-counts.json`.

Its population, from `data/all-mechanics-fire.json` `summary`:

- **abilities: `exist` 316, `fired` 104.** 129 unreachable (no legal carrier), 58 did not fire,
  20 `did_not_fire_unexplained`, 38 `cannot_fire_in_this_fixture`, **108 `control_not_quiet`**.
- **items: `exist` 148, `fired` 64.** 75 out of scope, 9 did not fire, 9 cannot fire here.
- **moves: `exist` 500, `resolved` 495**, 4 `announcement_only`, 11 `resolution_disagreements`.
- `preflight.trigger_unstaged: 10` — triggers never staged.
- 67 mechanics staged and never fired, printed as "a harness gap, not counted here."

**A defect in any of the 212 abilities or 84 items that did not fire is invisible to this
clause.** It is not a threshold question; those rows produce no comparison at all.

### 2.5 Clauses 2-4 — the roster stages. Large declared exclusions, and a source contradiction.

Exclusions, from the `scope` blocks read by `engine/coverage.js`:

- items: `tested` 140 of `in_scope` 148 — 8 `could_not_stage_in_scope`.
- abilities: `tested` **129 of 202** — 73 unaccounted: 27 `could_not_stage_in_scope`,
  **45 `unattributable` (the control arm is itself a live ability)**, 1 deferred, plus 114
  `out_of_scope`. The 45 are named on every run and explicitly do not hold the gate; the clause
  header calls them "UNMEASURED, not passing."
- moves: `tested` 475 of 500 — 22 `could_not_stage_in_scope`, 3 deferred.

**A source contradiction that needs a ruling, not a claim from me.**
`engine/quarantine.js:1878-1880` states: "the three `rosterStage` clauses — they compare OUR TWO
ENGINES to each other, so 'the authority is wrong' cannot arise." `tests/roster.js:81-83` states
the opposite: "FIRED-AND-BOARDS-MATCH — Showdown's board moved when the entity was added, ours
moved, and the two agree", and its switch verdicts read "OURS TRAPS AND THE AUTHORITY DOES NOT.
Showdown let the ...". Under the first reading, a rule that both `board.js` and
`medicham2-browser.js` get wrong the same way is invisible in three of the eight clauses — the
exact "a capability was absent and everything reported success" shape. Under the second it is
not. **One of the two comments is wrong and the consequence is material.** This routes to ENGINE
(it is a claim about what the harness compares); it is not resolvable from MEASURE.

### 2.6 Not a hole, but adjacent: `orderProbeClause` is not one of the eight.

`medichamIsCorrect()` (`engine/quarantine.js:2701`) composes `differentialClause` + three
`rosterStage` + `coverageClause` + `wholeGameClause` + `mechanicsClause` + `openDefectClause`.
**`orderProbeClause` (ROADMAP #290, the turn-order discriminator) is not in it** — it is
reachable only as `node engine/quarantine.js --order-probe`, for `register_reality.js` to
exit-code. That is deliberate per its header, and this run probed **0 pairs**, so it currently
decides nothing either way. `quarantine.js:1881` names it as "the nearest thing to the next
instance of this bug." Recorded, not called a defect.

---

## 3. Scope fields that materially change a headline figure

`engine/coverage.js` prints nine derived gaps and the clause scope lines. These are the ones
where reading the scope changes what the number means.

1. **`turns_cap: 12` — 469 of 961 games never end, even in the published empirical arm.**
   `arms[0].end_reasons`: `both engines ended the battle` **474**, `the turn cap (12)` **469**,
   16 truncated because medicham2's placement could not be mirrored to Showdown, 1 THREW,
   1 `ONLY medicham2 ended`. **The 8.0% board-material and 17.4% protocol rates are rates over
   at most 12 turns, not over games.** The 16 truncations make the 49.3% result rate a stated
   LOWER BOUND. Any severity band requiring a winner is reachable in 474 games, not 961.
2. **`declared_gaps.spreads_absent` — 0 of 17,536 differential bodies stand on a real spread.**
   Every stored open sheet reads `"evs": null`, so `game_differential.js` INVENTS one (66 points,
   32 cap, descending Speed ladder [32, 22, 11, 0] by slot, 0 into HP). The nature is real
   (`nature_declared` 17,440, `nature_fallback_to_serious` 96) and both engines get the same
   invented spread, so the run is internally consistent — **and its damage is not metagame
   damage. Nobody plays these spreads.** This scopes both whole-game rates and every board
   comparison built on them.
3. **`state.not_compared` — 5 declared-uncompared FIELDS, one of which the artifact itself says
   has a non-zero expected effect.** Item DISPOSITION (`lastItem` / `ateBerry`) is marked
   `"status": "CANDIDATE — comparable, not compared. The reason it was left out no longer
   exists."` with `"cost"`: "the expected effect is NOT zero and it must be measured before it is
   landed", citing the published `knock_off_roadmap_80` finding (Showdown records Colbur as eaten
   by itself, medicham2 as knocked off). **So 77 of 961 board-material is a LOWER BOUND by a
   known, named, already-measured unwired leaf.** The other four: ability trapping, the `trapper`
   mark, magnet-rise / syrup-bomb durations, and yawn / attract / curse / heal-block.
4. **board leaves compared: 34 of 56.** 56 is the ceiling, not 80: 4 declared uncomparable,
   18 duration-1 and ended in the residual, 2 removed inside their own action. **22 uncompared
   leaves CAN stand at a boundary** and are the whole of the widening work. 23 of the 24
   permanently uncomparable have a firing writer elsewhere; `volatile:attract` has none, so for
   that one the only evidence is the fixture agreeing with itself.
5. **`declared_gaps.forced_switch_answer_source.voluntary_excluded: 4165`** and
   `drags_excluded: 141` — the single largest exclusion in the whole-game artifact, and it is
   never printed beside the rate.
6. **`closet.teams_dropped: 43`** (Illusion), of which **17 carry the body PAST the 4 bodies a
   pair brings, so it never entered either engine** — the shelf is over-broad by that much and
   the rate is measured on the narrower pool. The artifact says so; the headline does not.
7. **`mid_void.void_games: 8`**, `threw: 1`, `declared_gaps.choices_refused: 2`,
   `declared_gaps.forced_first_slot: 23`.
8. **`coverage.exercised` 556 of `measurable` 580** — 24 measurable entities never exercised,
   63 unmeasurable by the instrument, 1 clicked and never connected.
9. **move leaves whose EFFECT was exercised: 7 of 11.** 4 rows RESOLVED on the announcement alone
   — the leaf they wrote never refused anything. **76 further leaves print NOTHING when they
   fire** (Focus Punch's cancel, Beak Blast's burn, Electrify's retype) and are out of the
   denominator entirely. `summary.moves.leaf_effect.verbsUnknown: 37` — 37 consequence verbs the
   shared table names and the move arm cannot execute; `shapeUnbuildable: {"lethal": 1}`.
10. **`summary.moves.resolution_disagreements: 11`** sits alongside `diverged: 4` and is not in
    the headline.

---

## 4. Stranded artifacts

`tests/test-artifact-rerunnable.js`, run 2026-09-04: **ALL GREEN, 5 checks.**

- **88 stamped artifacts over 31 releases: 57 re-runnable, 0 retired, 30 unknown-producer,
  1 STRANDED and undeclared.**
- The one stranded artifact is the one already in the ratchet: `data/nature-arms.json` on
  release `72e361e1bd44`, which lacks `medicham2-browser.js::rngStreams` and `::spreadL50`.
  `data/artifact-rerunnable-baseline.json` (stamped 2026-08-13) records `stranded: 1`, so the
  ratchet has not moved. **No quoted figure currently rests on an unopenable release.**
- 323 manifests audited against `surface()`, 0 legacy; 96 exports agree with `require()`.

**The real exposure is not stranding, it is absence.** Only **88 of 252** artifacts carry a
release stamp at all. Three consequences worth naming:

- **`data/all-mechanics-fire.json` — the artifact answering gate clause 7 — is
  UNKNOWN-PRODUCER**: it records no `by` field, so the stranding check declines to accuse it. It
  happens to carry the current release `8ad06030e129`, so it is fine today; nothing would say so
  if it were not.
- **`data/whole-game-baseline.json` is UNKNOWN-PRODUCER on release `6272fa445b73`, is UNSAFE in
  provenance, and carries no `generated` stamp.** The direction-of-travel comparison against it
  is already correctly WITHHELD, for a different reason (pin mismatch: `pins:2efbc9ed1946` vs
  this run's `pins:ccb365985023` — "one pin is one corner: those are two instruments, and
  subtracting one rate from the other invents a trend").
- Three scratch files carrying real release stamps sit in `data/` and are shaped exactly like
  artifacts: `_scratch-bench-smoke.json`, `_scratch-jobs3.json`, `_scratch-scovillain-dump.json`.
  The check filters them by name and says so. **Reported, left in place — not mine, not deleted.**

---

## 5. Published figures no artifact currently supports

### 5.1 The site publishes a gate reading wrong in both the count and the identity

| file | mtime | what it publishes | what is true today |
|---|---|---|---|
| `app/quarantine-data.js` | **2026-08-10** | **"1 of 6 gate clauses fail (no open, known engine defect)"** | **1 of 8**, and that clause **PASSES**; the failing one is the whole-game differential |
| `web/quarantine-data.js` | **2026-08-25** | **"3 of 8 gate clauses fail"** | **1 of 8** |
| `app/status-data.js` | **2026-08-10** | a whole embedded `status_raw` snapshot (below) | — |
| `web/status-data.js` | 2026-08-10 | the same snapshot | — |
| `web/quarantine-release.json` | 2026-08-09 | — | — |

`app/status-data.js` embeds a full 2026-08-10 status board as `status_raw`. Every headline in it
is now false:

| published in `app/status-data.js` | current |
|---|---|
| `0/150 differential comparisons disagree` | 0 of **6,000**, plus 16 corner arms that did not exist then |
| **`interaction matrix: 1624/1643 pairs agree (98.8%)`** plus six named DISAGREES | **WITHHELD** — provenance calls `data/interaction-matrix.json` UNSAFE |
| `423/423 probed mechanics live` | **829/829** |
| `tag coverage: 208/222 probed` | **285/300 probed; 271/300 have an engine consumer** |
| `store: 52089 games, 11255 usable (21.6%)` | **83,774 games, 27,920 usable (33.3%)** |
| `provenance: 21 unsafe, 1 void, 76 possibly stale, 79 ok` | **188 unsafe, 2 void, 35 stale?, 27 ok** |
| `47 artifacts are downstream` | **72** |
| roster: `139 of 148` / `94 of 202` / `427 of 500` | `140 of 148` / `129 of 202` / `475 of 500` |

The interaction-matrix row is the sharpest: **the site publishes, as a live figure with named
disagreements, a number `engine/status.js` withholds today.** That is "a caption is not a
quarantine" arriving one layer below the place the rule is enforced.

**One qualification I can support and one I cannot.** There is no `gh-pages` branch and no deploy
step for `app/` in `.github/workflows/` (`ingest.yml`, `smogon-stats.yml`, `tests.yml`). So these
files are stale **on disk**; whether a visitor is served them is not something I could establish,
and I am not asserting it. WEB is paused by the owner until MEDICHAM is correct and the site-sync
test is red on purpose — this is what that pause currently costs.

### 5.2 `data/quarantine-stamp.json` — the citation ratchet is 5.5 days stale and UNSAFE

Generated 2026-08-29T14:18Z, `gate_open: false`, `failing_clauses:` **five** — the three roster
stages, whole-game, and mechanics. Today only whole-game fails. Provenance marks it UNSAFE on a
content mismatch (its recorded `engine/quarantine.js` digest `8c4024248a3f` is not what is on
disk; that file was edited today). Its `citation_sites` ratchet — `docs/ENGINE.md`,
`web/build-status.js`, `web/publish-rule.js` — has not been re-derived since.

### 5.3 66 published figures cite an artifact that does not contain them

`engine/docs_scan.js --json`, run 2026-09-04 02:38Z **against a `docs/` tree another agent was
writing** — re-run before acting:

- **72 citation mismatches, 66 distinct.** By document: `docs/MODELS.md` **43**,
  `docs/ABRA-whitepaper.md` **21**, `docs/SUMMARY.md` **6**, `docs/ABRA-technical-docs.md` 2.
  `MODELS.md` and `SUMMARY.md` are LIVING documents under the CLAUDE.md living-docs rule.
- **35 untraceable figures** — no artifact anywhere: `docs/MODELS.md` 14,
  `docs/ABRA-whitepaper.md` 10, `docs/SLOWKING-whitepaper.md` 7, `docs/ROLE-FAMILY.md` 2,
  `docs/ARCHITECTURE.md` 1, `docs/ABRA-technical-docs.md` 1.
- **All 66 are inside the `data/docs-currency-baseline.json` ratchet. Zero are new — and zero
  have been retired since the baseline was stamped on 2026-08-27.** The baseline's own note:
  "Every entry is a REPORTED DEFECT, not an approval ... it is not a statement that any of them
  is acceptable." Eight days, no movement.
- Examples: `71.6%` and `4.54` cited to `data/xatu.json` plus `data/policy-eval.json`;
  `1.6%`, `0.548`, `0.583` cited to `data/pory-eval.json`; `1.71`, `7.4`, `19,589`, `8,713`
  cited to `data/quality-filter.json`; `0.109`, `0.073`, `31%`, `18` cited to
  `data/slowking-eval.json` plus `data/slowking-playstyle-eval.json`.
- 0 retraction violations beyond the 8 grandfathered ones. 81 docs scanned, 25 versioned,
  56 unversioned-exempt.

### 5.4 `data/policy-weights.json` — the check fires on two gates and one silences the other

`engine/feature_fixture.js --check` (via `status.js`) reports, verbatim:

> the fixture itself changed (rounding 6 -> 6, scenarios 10 -> 12) ...
> the DAMAGE TABLE these weights were fitted against has been regenerated
> (318 species -> 322, digest `405c836793d1` -> `9d289cf77e24`) ...
> **GATES THAT FIRED: fixture identity, damage table. A RESTAMP ANSWERS THE FIXTURE GATE AND
> SILENCES THE TABLE GATE — settle the table verdict first, or the evidence for the refit is
> written over.**

Provenance: `stale?`, mtime-only, 29.9 days old, fitted 2026-08-28 15:46, with
`engine/medicham2-browser.js` (2026-09-03 20:15), `data/engine-data.js` (2026-08-31 00:08) and
`data/abra-tags.js` (2026-08-29 04:34) all moved since. **Not restamped, not refitted — MAG is
under the owner's pause and a restamp here would write over the refit evidence.** Recorded only.

### 5.5 The standing item: leaf calibration

`data/winrate-backtest.json` is **UNSAFE** in provenance — "OLDER THAN THE QUALITY FILTER",
"older than its input `engine-data.js`", and **"CORPUS DRIFT — declares 6,890 games; 23,861 are
clean ladder now"** — and it is QUARANTINED because `engine/backtest_winrate.js` is in the play
layer. **The correct action today is still to withhold it, and it is being withheld.** It cannot
be re-measured while clause 6 fails; re-running it now would produce a fourth figure measured
under an engine known to be incorrect. Nothing in this review changes that, and nothing in this
review quotes it.

---

## What I did not do

No refit, no restamp, no `--write`, no commit, no file deleted, no process killed, no game
played, no interim SPRT read. `docs/` was read once for section 5 and never written except this
file.
