# 2026-09-11 — Integration: twenty owed instruments registered, the staging planner inside the harness, the faint epoch per battle

ENGINE, one game-playing slot, three batches. This is a historical record (CLAUDE.md on `docs/_reports/`): not
maintained, not current state. Current state is `node engine/status.js` and `node engine/open_work.js`.

Nothing was committed or pushed, per the brief.

## Verdict

| | before | after | source |
|---|---|---|---|
| staged mechanics that fired | 740 of 845 | **783 of 845** | `engine/coverage.js` over `data/all-mechanics-fire.json` |
| fired with a board compared | 740 of 845 | **783 of 845** | same |
| by kind (moves / abilities / items) | 496/497 · 105/200 · 139/148 | **497/497 · 139/200 · 147/148** | same |
| census | 872 live / 0 missing | **872 live / 0 missing** (never lower) | `data/mechanics-census.json` |
| pinned pool, board-material (middle / top / bottom) | 0 / 1 / 2 of 961 | **0 / 1 / 2 of 961** | the three `game-differential` artifacts |
| `test-engine-diff` | 0 of 6000 | **0 of 6000** | `data/engine-diff.json` |
| roster FIRED-AND-BOARDS-DIFFER (items / abilities / moves) | 0 / 0 / 0 | **0 / 0 / 0** | `data/roster.{items,abilities,moves}.json` |
| gate (`engine/quarantine.js`) | OPEN, 9 of 9 | **CLOSED, 1 of 9** — the mechanics clause, 9 of 16 | batch-1 and batch-2 runs |

**Releases:** `cfab4786683a` (batches 0 + 1), `aefcb93baf14` (batch 2). Both are gitignored until force-added (OWED 1).

**Newly parting mechanics, every one registered and left unfixed:** Oblivious lets Taunt through (#593),
Magic Bounce does not bounce Spite (#594), a Super Luck / Scope Lens holder misses the crit after Focus Energy at the
top corner (#595), a mega stone held under Klutz does not evolve here (#596) — board-material — and Cute Charm
(#597), Own Tempo (#598), Sweet Veil (#599), Covet (#600) — narration only.

## Batch 0 — the twenty owed instruments

**What landed.** The three silent catches (`probe_amf_default_populations.js`, `probe_census_reproduces.js`,
`probe_divergence_rank_side.js`) now carry the caught error's message onto the line they print;
`node tests/test-no-silent-failure.js --in` reads 0 on all twenty. The eleven game-loading probes are derived
PENDING-WIRE by a new `docs/ENGINE.md` mechanism table; the nine that load none carry a hand `PENDING_WIRE` entry
each in `tests/run-all.js`. Every row carries a `VERIFIED BY:` marker; every engine-facing one names
`--release aefcb93baf14`. `engine/register_reality.js --list` reads all twenty and rejects none (its `SAFE` rule
admits post-entry argv verbatim, so `--release <id>` with a real id is fine).

**Two knobs, inert by design.** `MEDI_HITCOUNT_DROP_ON_COLLAPSE` (#511, both collapse roads) and
`MEDI_UNBURDEN_FROM_CURRENT_ABILITY` (#535, effSpeed's current-ability read). Each stamps `MEDFAILS.*Knob` on load
(0 clean, 1 under its own switch, 0 under the other's) and counts `MEDSEEN.*Knobbed` at its site. Until each fix
lands both knob positions play identically; the two probes read RED under the knob as well as without it.

**One probe fixed so it can answer.** `probe_census_reproduces.js` extracted its temp tree with `tar -xf C:\…`,
which Git Bash's GNU tar reads as `host:path`; it now extracts with relative paths from inside the temp directory.

**Probe verdicts on `aefcb93baf14`** (my runs, 11:17–11:29Z):

| row | verdict | note |
|---|---|---|
| #318 #348 #375 #380 #412 #425 #467 #511 #529 #535 | **RED** (10) | cells in each row; #511 and #535 RED under their knobs too |
| #323 #325 #349 #350 #524 | **GREEN** (5) | fixed by MEASURE's `cc1dabf5` (6.12.1) between the owed report and this run; rows left open, closing is the owner's |
| #310 · #440 · #541 (second half) | **GREEN = REFUTED** (3) | recorded in the rows' cells; #440 stays closeted |
| #442 | **GREEN**, and RED under `--plant` | the committed tree reproduces the committed census, 872 / 872 / 0 |
| #399 | **CANNOT-ANSWER** (exit 2) | MEASURE's renderer now refuses a stale dump; the probe's own control fails under that contract — owed a re-aim |

The owed report said sixteen RED on `2b5a6585d8cf`. The difference is MEASURE's fixes, not the engine.

## Batch 1 — the staging planner inside the harness

**Predicted first** (`data/verification/_prediction-2026-09-11-integration.json`): fired 795, range 778–812;
abilities ~150 (135–165); items 147; moves 497; the pool unmoved; the gender trio and the duration rocks most likely
to part. **Measured:** 783 (in range); abilities 139 (in range, below the point); items 147 and moves 497 on the
point; the pool unmoved exactly. The gender trio: Attract and Rivalry agree, Cute Charm parts (narration). The
duration rocks fired and did not part. What parted instead was not predicted: Oblivious, Magic Bounce, the crit
stage and the Klutz mega.

**The design.** Abilities and items play the planner fixture first — fixture against its one-leaf control, `abRow`,
on every rendered variant — and fall back LOUDLY to the legacy ladder when the planner row does not fire, cannot be
staged, or did not play as scripted. Moves keep the legacy ladder as the verdict (it owns `leaf_effect` and
`announcement_only`, which coverage reads) and also play the planner fixture on every variant; a move the ladder
cannot resolve takes the planner's resolution (Attract). A parting on any variant marks the row. `--no-plan`
restores the old harness.

**Seams landed with it.**
- `engine/game_differential.js` `buildPair({declaredSpread, declaredGender})`, both opt-in and counted
  (`seamCounters()`: 46,032 bodies on the declared spread, 20 carrying M/F). No other caller moves.
- medicham2 `detailsGender`: `, M` / `, F` on `switch`, `drag` and `detailschange`, byte-identical for a genderless body.
- `engine/stage_planner.js`: a legal gender pair where a handler reads gender (same-gender where `damageByGender.sameMult > 1`, else opposite); the real HP pool where the carrier mega-evolves or changes forme; a gender fixture is no longer refused once the driver has the seam.
- `engine/fixture_preflight.js` reads `?.` as `.` at every handler read — diffed over every legal entity against HEAD: exactly four gained a need (Gale Wings, Pickpocket, Prankster, Triage); the planner's own normalisation now adds 0.
- One scope: the harness, `tests/roster.js` and `engine/tag_dex.js` ask `engine/legal_scope.js`; `champions_sim.unreachable()` (0 callers, wrong on three rows) is deleted. `data/tags.json` regenerated: Battle Bond's row and nothing else left (`sheet_entries` unchanged, so no store churn swept in). The roster now counts 200 abilities in scope (was 201), and its old Soft-Boiled "match" had been staged on Torkoal, which cannot learn it (#318).

**Instrument faults found in this batch, before any result was trusted.**
1. **The x6 pool on mega and forme fixtures.** The first integrated run parted 73 stones and 13 mega-carrier abilities on `party.hp` at ~6x (Abomasite 134 vs 959) and Disguise at 114 vs 683 — the authority's `setSpecies` recomputes max HP on a permanent forme change. Items diverged 76 → 3 once fixed.
2. **The planner's genders.** Its report said the three gender rows declared genders; every body carried `''`.
3. **A release-closure false positive of my own:** a comment in `champions_sim.js` spelled a require call, and the release cut read it as a dependency.
4. **A dead roster plant of my own:** `ability/speed-on-item-loss` was anchored on the effSpeed line the #535 knob rewrote; re-pointed, 44 of 44 anchors live.
5. **ROADMAP cell-parse of my own:** escaped pipes in four status cells cut them for the gate (#412, #440, #511, #592); rewritten without pipes, the guard is back to 0.

**The partings, with the authority's lines** — each checked against the logs before it was called the engine's
(the Klutz case looked like the harness until the carriers were read: the legacy stone rows evolve because their
carriers hold another ability):

| # | mechanic | authority | medicham2 | board |
|---|---|---|---|---|
| 593 | Oblivious vs Taunt | `-immune\|p1a: Mamoswine\|[from] ability: Oblivious` | `-start …\|move: taunt`, then `cant` | `vol.taunt` 0 vs 2 |
| 594 | Magic Bounce vs Spite | Spite bounced (`[from] ability: Magic Bounce`) | Spite lands | PP leaves |
| 595 | Focus Energy + Super Luck / Scope Lens, top corner | `-crit`, 891/960 | no crit, 914/960 | `party.hp` |
| 596 | mega stone under Klutz | `-mega`, Audino-Mega | no mega | `party.species` |
| 597 | Cute Charm | `-start …\|Attract\|[from] ability: Cute Charm\|[of] …` | `-start …\|Attract` | clean |
| 598 | Own Tempo | `-immune …\|confusion\|[from] ability: Own Tempo` | nothing | clean |
| 599 | Sweet Veil | partner's `move … Sleep Talk` | `-fail` | clean |
| 600 | Covet | `-item\|thief\|…\|[from] move: Covet` | extra `-enditem` on the victim | clean |

The mechanics clause counts 16 diverging mechanics and fails on 9: it subtracts five moves below its reach shelf
(Gastro Acid, Reflect Type, Corrosive Gas, Covet, Heal Bell — all but Covet present at HEAD) and Supreme Overlord
(declared: the authority is wrong).

## Batch 2 — `_FAINT_EPOCH` per battle

`battleInit` records `S._faintEpoch`; `battleTurn` rebinds the active epoch from the state it is handed, so a faint
is stamped with the epoch of the battle being stepped (building Q while P is alive and then stepping P stamps P's
corpses with P's epoch); `battleResult` compares against the state's own. A state `battleInit` never stamped falls
back to the process epoch, counted at `MEDFAILS.faintEpochUnstamped` (0 on every bench run). Knob
`MEDI_FAINT_EPOCH_GLOBAL=1` restores the old rule exactly.

| run | release | after one unrelated build | natural late read |
|---|---|---|---|
| before | `cfab4786683a` | **43 of 43** read 0.5 | 1 of 1 differs |
| after | `aefcb93baf14` | **0 of 43** (winners 19 × 0, 24 × 1, as read at the finish) | 0 of 1 |
| knob | `aefcb93baf14`, `MEDI_FAINT_EPOCH_GLOBAL=1` | **43 of 43** read 0.5 | 1 of 1 |

Artifacts: `data/verification/interleave-2026-09-11/interleave-cfab4786683a.json`, `interleave-aefcb93baf14.json`,
`interleave-aefcb93baf14-knob-global.json`, all written with `--no-red` beside SEARCH's `interleave.json`, which was
not touched. The bench's red-variant patch anchor `  _FAINT_EPOCH++;` still matches the rewritten line exactly once.

## The register pass and the open-defect clause

`node engine/register_reality.js` (11:33–12:06Z, exit 1 on its disagreements; 113 distinct instruments run, 175
markers read, 9 refused — none of them this pass's): **148 CONFIRMED, 12 STALE ROW, 2 PREMATURE CLOSE, 2
UNRUNNABLE**. The ten red owed probes read CONFIRMED on their open rows. Nine of the twelve STALE ROWs are this
pass's green rows (#310, #323, #325, #349, #350, #440, #442, #524, #541): open rows whose instrument now reads
green — five fixed by MEASURE, three refuted, one reproduced. Closing them is left to their owners; the evidence
is in each cell. #399 is one of the two CANNOT-ANSWER instruments (the other is #424, not this pass's). The two
PREMATURE CLOSEs (#390, #577) predate this pass; #577's clause refuses a published figure on a release git does not
hold, and this pass's two releases are untracked until OWED 1 is run. #578 and #579 timed out at the register's
ten-minute limit; neither is this pass's.

`node engine/quarantine.js` on the fresh verdicts: **GATE CLOSED, 2 of 9**.

- **The open-defect clause is RED**: 10 OPEN rows name a RED instrument — #535 (5,036 uses), #529 (105 uses), #318,
  #348, #375, #380, #412, #425, #467, #511. This is the direction the brief predicted; nothing was narrowed to
  reopen it.
- **The mechanics clause is RED**: 9 of 16 diverging mechanics played and uncleared — the eight new partings above.
- The other seven pass: the damage differential at every index, the three roster stages, coverage,
  board-material 0 of 961 and narration zero undeclared.

## Living documents corrected in the same pass

The one scope moved published roster figures, and `tests/test-docs-current.js` caught the first of them
(`docs/ABRA-whitepaper.md:1696` stated 487 tested, which no roster artifact holds any more). Every place the moved
figures stood as fact was corrected in this pass rather than deferred: the white paper (the scope paragraph and the
6.0.0 correctness sentence) and the technical documentation (the ROSTER and RE-RUN paragraphs) now read abilities
200 in scope / 116 out / 13 CONTROL-NOT-QUIET and moves 497 in scope / 486 tested, off `data/roster.abilities.json`
and `data/roster.moves.json`, with scope named as `engine/legal_scope.js`. The 6.14.0 notes row strikes the old
figures as retracted. After the fix: `tests/test-docs-current.js` green; `tests/test-register-cell-parse.js` and
`tests/test-roadmap-register.js` green; `tests/test-stage-planner.js` (full population, every red demonstration)
green; `node engine/status.js --write` restamped the ledgers.

## Collisions and debris, reported, not touched

- **Another agent wrote files this brief assigned to ENGINE.** MEASURE's `cc1dabf5` (committed 10:56Z) added
  6.12.1 entries to `CHANGELOG.md` and `docs/RUNNING-NOTES.md`; a later, uncommitted and STAGED 6.12.2 entry (a
  MEDICHAM optimisation plan, #130) sits in both files. Mine were inserted above them; theirs are untouched.
- **`tests/run-all.js --coverage` is RED** on 25 unaccounted files, none of them this pass's; the list grew 24 → 25
  while MEASURE worked. Not mine to classify.
- No file was deleted. Scratch work stayed in the session scratchpad.

## OWED, NOT RUN

1. Track the two releases this pass cut (gitignored; `status.js` withholds a figure on an untracked release):
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
git add -f data/releases/cfab4786683a data/releases/aefcb93baf14
node engine/status.js --write
```

2. Fix and probe the eight registered partings, one knob each, showing each red first:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
node engine/all_mechanics_fire.js --kind all --only oblivious,magicbounce,superluck,scopelens,audinite,golurkite,unseenfist,cutecharm,owntempo,sweetveil,covet --dumplog --release aefcb93baf14 --census data/mechanics-census.json
```

3. Re-aim #399's probe at the renderer's refusal, and adopt MEASURE's shared exit classifier in `tests/run-all.js` (#380):
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node tests/probe_divergence_cards_stale.js
node tests/probe_open_defect_refusal_holds.js
```

4. Fix the two defects the inert knobs name, then show each probe green and RED again under its knob:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
node tests/probe_volley_collapse_clamp.js --release <new release>
MEDI_HITCOUNT_DROP_ON_COLLAPSE=1 node tests/probe_volley_collapse_clamp.js --release <new release>
node tests/probe_unburden_acquired.js --release <new release>
MEDI_UNBURDEN_FROM_CURRENT_ABILITY=1 node tests/probe_unburden_acquired.js --release <new release>
```

5. `MID_NTH` carries no battle identity (the interleave report's second leak); the differential is unaffected today.
