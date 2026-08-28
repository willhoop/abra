# Sand Force — the tag named one type of three, and nothing spent even that

ENGINE, 2026-08-27. ROADMAP `#515` filed and closed. Releases `fb73f82ea1ed` then
`f3d423e19e88` (re-cut over the settled tree — see the last section). CHANGELOG 5.193.0.

## LEAD — the two things asked for, first

**THE SIXTEEN-CORNER DAMAGE FIGURE: `0/6000` BEFORE AND `0/6000` AFTER, at every one of the sixteen
indices.** Predicted before the run, and predicted from the instrument rather than hoped:
`tests/test-engine-diff.js` builds its field as `{weather: '', terrain: '', ...}` and its own artifact
says *"this file's field is an empty sky by construction"*. The new branch requires a non-empty
matching sky, so it cannot fire there. (The default run is `--n 150`; the published artifact is 6000,
so the comparable figure needs `--n 6000` — the smaller run REFUSES to republish, correctly.)

**THE SANDSTORM-IMMUNITY HALF WAS ALREADY CORRECT.** It is asked apart rather than assumed, because
"both halves work" and "one half works and the other is unreachable" print the same on a single-number
probe. The residual reads `weatherChipImmune.weathers` out of the artifact and Sand Force carries
`{chipImmune: true, weathers: ["sand"]}`. Staged: the control loses **10** (a sixteenth of 160), the
Sand Force holder loses **0**.

## THE DEFECT — verified, and bigger than the brief said

The brief's diagnosis was right and incomplete. There are **two** defects and each kept the other
invisible.

**HALF ONE, THE ARTIFACT.** `data/mods/champions/abilities.ts` has no `sandforce` key (grepped), so
mainline governs — `data/abilities.ts:3946-3954` returns `chainModify([5325, 4096])` when the field is
a sandstorm AND the move is Rock, Ground or Steel. `tag_dex.js` read the type with a `match` carrying
no `/g` flag, so `data/tags.json` held `onType: "Rock"`, the first of three.

**HALF TWO, THE ENGINE, AND IT IS THE BIGGER ONE.** All three `damageBoost` consumers in `dmgRange`
require `!_db.inWeather` — a clause written when the family was narrowed (ROADMAP #92). Sand Force
carries `inWeather: ["sand"]`, so **nothing spent the boost on ANY type, including Rock.** The
engine's own comment said so out loud and had gone stale in the other direction: *"Analytic and Sand
Force ... are NOT here, because nothing reads them."*

Consequence for the fixture design: **a Rock arm is NOT the control the tag bug suggests.** It has to
be asserted to MOVE like the other two, and a fixture that used Rock as a "should not change" control
would have been green on a broken engine.

## MEMBERSHIP, PRINTED BEFORE ANYTHING WAS WIRED

Over the **316 legal abilities** the format defines, handlers whose
`onBasePower`/`onModifyAtk`/`onModifySpA` test `move.type`:

| | members |
|---|---|
| ONE type (10) | blaze, dragonsmaw, firemane, overgrow, rockypayload, steelworker, swarm, torrent, transistor, waterbubble |
| MULTI (1) | **sandforce [Rock, Ground, Steel]** |

In the ARTIFACT the set is seven — the four with no legal carrier are not derived — and Sand Force is
still the sole multi-type member. The NEW consumer's own shape (a multiplier, an `onType` list, an
`inWeather` list, stage `basePower`, no condition) matches exactly **one** ability. The only other
weather-gated `damageBoost` in the artifact is Solar Power, which is `attackStat` with no type and is
already spent under a sharper tag; the branch cannot reach it.

## THE FIX

1. **`engine/tag_dex.js`** — `onType` is a list, always, even when it holds one. `matchAll`, deduped.
2. **`engine/medicham2-browser.js`** — `dbTypeHits(p, mvT)`: ONE reader of the field, returning
   TRUE / FALSE / NULL on `condHolds`'s three-way convention. Both existing type-comparing sites call
   it.
3. **`engine/medicham2-browser.js`** — a new base-power consumer for the weather-gated shape, folded
   into the same `BPCH` relay as Technician, the type items, Charge and the terrains, so it truncates
   once with them. The sky is the shadowed `field.weather`, which `dmgRange` has already put through
   `effWeatherOf`, so Cloud Nine and Air Lock reach it without a gate of its own — and the authority
   agrees, because `isWeather` is false under suppression.
4. **`CH_EXACT` gains `sandforce: [5325,4096]`.** The tag's float 1.3 truncates to
   `tr(1.3*4096) = 5324`, one 4096th below the authority's literal.

**A SCALAR `onType` IS REFUSED, NEVER WRAPPED.** Coercing it would make an engine running against a
pre-2026-08-27 artifact look like it works — correct on the ten single-type abilities and silently
wrong on the one that needed the fix, which is this bug reappearing inside its own repair.
`MEDFAILS.damageBoostScalarType` reads **2** under the restore knob and **0** on the shipped artifact.

**`tags.length === 1` IS NOT ASKED, AND THAT IS THE HUSTLE RULE, NOT A RELAXATION.** The guard's real
question is whether anything else THIS FUNCTION spends already pays it. Sand Force's only other tag is
`weatherChipImmune`, spent in the residual, which cannot reach a damage stage. The double-pay it IS
guarded against is the four hard-coded stat lines, via the same `STAT_MULT_BY_NAME` check.

## THE PROBE — red first, unpiped; green after; the SAME red under the knob

`tests/probe_sand_force.js`. Five damage arms plus the immunity half. Every arm is one Excadrill (a
derived legal carrier), one single-target move, ability set explicitly on BOTH readings so neither can
be handed Excadrill's own Sand Rush by the builder.

| arm | staging | shipped | `--restore` (the pre-fix scalar) |
|---|---|---|---|
| ground | Drill Run, sand | 97 -> **126** (x1.299) | 97 -> 97 |
| steel | Iron Head, sand | 97 -> **126** (x1.299) | 97 -> 97 |
| rock | Rock Tomb, sand | 45 -> **58** (x1.289) | 45 -> 45 |
| CONTROL wrong-type | X-Scissor (Bug), same sand | 65 -> 65 | 65 -> 65 |
| CONTROL no-weather | Drill Run, CLEAR sky | 97 -> 97 | 97 -> 97 |
| immunity half | Milotic in sand | control -10, holder -0 | unchanged (already correct) |

The knob reproduces the **identical six failures**, not a third behaviour.

**ONE REASON PER CELL, DERIVED AND PRINTED — AND IT CAUGHT ITS OWN FIRST FIXTURE.** The reading is the
aimed body's HP loss over a whole turn, so the sandstorm residual is the one contaminant: additive in
both readings, it leaves `on - off` alone and DILUTES `on / off`, breaking the [5325,4096] band. Every
target is chip-immune by type, read from the authority's own `dex.getImmunity('sandstorm', types)`.

The first staging fired a Rock move at the Garchomp the other arms use — **Rock is 0.5 into Ground**,
so the control read 24 and the probe refused the cell for qualifying twice. **No body is chip-immune
AND neutral to Rock unless it pairs the type with Flying**, so the Rock arm gets its own target
(Corviknight, Flying/Steel: Rock x2 into Flying, x0.5 into Steel = x1).

**AND THE IMMUNITY HALF'S HOLDER IS DELIBERATELY NOT A SAND FORCE CARRIER.** All four legal carriers —
Excadrill, Hippowdon, Garchomp-Mega, Steelix-Mega — are Rock, Ground or Steel and are sand-immune BY
TYPE. Staging one of them there would be the two-reasons failure exactly: the arm reads 0 whether or
not the ability does anything. The probe asserts the holder is not intrinsically immune before it
believes the reading.

## PREDICT, THEN MEASURE

| figure | before | **predicted** | measured |
|---|---|---|---|
| census live / probed / missing | 765 / 765 / 0 | 766 / 766 / 0 | **766 / 766 / 0** |
| damage, all sixteen corners | 0/6000 | 0/6000 | **0/6000** |
| whole-game | 1 of 961 (6 raw − 5 declared) | 1 of 961 | **1 of 961 (6 raw − 5 declared)** |
| board-material | 0 of 961 | 0 of 961 | **0 of 961** |
| mechanics clause | 5 of 12 | 4 of 12 | **4 of 11** |
| roster items / abilities / moves | 139 / 129 / 475, 0 DIFFER, 0 DID-NOT-FIRE | identical | **identical** |
| roster red demonstrations | 1 NOT CAUGHT (Belch, #514) | 1 | **1 (Belch)** |
| gate | 5 of 8 clauses PASS | 5 of 8 | **5 of 8** |
| pin digest / DICE_MODEL | `ccb365985023` / v5 | unmoved | **unmoved** |
| `CH_EXACT` overrides, wrong | 4, 0 | 5, 0 | **5, 0** |
| `all_mechanics_fire` abilities diverged | 3 | 2 | **2** |
| `ability:sandforce` row | FIRED + diverged, board **STATE** | FIRED, NO-DIVERGENCE | **FIRED, NO-DIVERGENCE** |

**THE PREDICTION THAT MISSED IS A FINDING.** The mechanics clause was predicted at *4 of 12* and read
**4 of 11**. The numerator was right; the DENOMINATOR moved too, because it counts every diverging
mechanic INCLUDING the declared one, and Sand Force was in it. Read as a rate rather than a count, the
improvement is slightly larger than predicted, not smaller.

**THE POOL SITTING STILL WAS DERIVED BEFORE THE RUN, NOT EXPLAINED AFTERWARDS.** Before the fix Sand
Force gave no boost in any sky, so had it fired inside the 961 sampled games it would ALREADY have
been a divergence — and it was not among the 6 raw. The frozen pool holds **19 games of 17,381
mentioning Sand Force, 9 of them with sand.** After the run the same six first-divergences came back
in the same shapes: the `|upkeep <> |faint|p2b` row and five `fallenundefined` declared rows.

## THE NO-OP REGENERATION, RUN FIRST

`data/tags.json` carries usage counts read live off the store, so a regeneration moves leaves that
have nothing to do with the change.

| | leaves moved | of which a mechanic parameter |
|---|---|---|
| no-op regeneration (no code change at all) | 1,082 | **0** |
| the real regeneration, against that baseline | **16** | **16** |

Every one of the 1,082 was a usage count, a usage-sorted linkage ordering, a tag-summary row or
`sheet_entries`. The 16 are `damageBoost.onType` on seven abilities, and **only `sandforce` gained
types.**

## THE PROOF THAT THE BRANCH RUNS

A capability that cannot prove it ran is assumed broken. `MEDSEEN.damageBoostWeather` reads **2** on a
staged sandstorm Drill Run (`...First = sandforce/Ground/sand`) and does not move on either negative
arm — the same click in a clear sky, and the same sand with the ability cleared.

## HOW THIS WAS MEASURED

- Release `fb73f82ea1ed`, cut once and passed explicitly to every instrument.
- `engine/game_differential.js --release fb73f82ea1ed --arm middle --games 1200 --turns 12
  --team-store data/team-pool-frozen --census data/verification/census-pin-9446a684709d.json
  --state --end-state --write` (yields 961).
- `tests/roster.js --stage {items,abilities,moves} --reds --write --release fb73f82ea1ed`.
- `engine/all_mechanics_fire.js --release fb73f82ea1ed --kind all --write` (1289 games, 0 threw).
- `tests/test-engine-diff.js --n 6000`.
- Whole-game and board-material read from `data/game-differential.json`, never off stdout:
  `diverged = 6`, `state.games_board_never_diverged = 961` of `state.games = 961`.
- Every run at BELOWNORMAL through a `--require` preload that exits 96 if `os.getPriority` does not
  confirm the drop. `tools/lownode.cmd` is unreachable from an agent shell, as the brief said.

## THE READER I BROKE, CAUGHT BY DIFFING AGAINST CLEAN HEAD

The scalar-to-list reshape has one more reader than the first sweep found, and the sweep missed it
because the grep was truncated at 30 lines. `tests/test-pinch-family.js:280` passed the artifact's
`onType` straight to `hitOfType(type, category)`, so with an array it looked for a move whose type is
spelled `["Fire"]`, found none, and failed a control for a reason with nothing to do with the member.

**IT WAS FOUND BY MEASUREMENT, NOT BY READING.** Every test that failed in the working tree was re-run
in a `git worktree` at clean HEAD and the failure sets diffed by name:

| test | HEAD | working tree, before the fix | after |
|---|---|---|---|
| `tests/test-fixture-legality.js` | exit 1 | exit 1, **identical failure set** | unchanged |
| `tests/test-game-differential.js` | exit 1, 5 failures | exit 1, 4 — a strict SUBSET | unchanged |
| `tests/probe_red_demo.js` | exit 2, the same four patches by name | exit 2, same four | unchanged |
| `tests/test-pinch-family.js` | exit 1, **1** of 61 | exit 1, **2** of 61 | **1 of 61, identical to HEAD** |
| `tests/test-forced-switch.js` | exit 0 | exit 0 standalone; FAILED once inside `run-all.js` and did not reproduce | reported, not chased |

Only one of the five moved, and it was mine. The fixed line reads the first type and prints the whole
field in its failure message, so a member that ever names more is visible rather than silently reduced.

**AND IT LEFT BEHIND A POSITIVE CONTROL WORTH HAVING.** With the reader fixed, `firemane / Burn Up`
reads **ok — fires at FULL HP and both engines agree**, which is a two-engine confirmation that the
list reshape did not break the ten single-type members it also touched.

## THE WHOLE SUITE, BEFORE AND AFTER, DIFFED BY NAME

`tests/run-all.js` was run on the working tree and again in a `git worktree` at clean HEAD.

| | failing checks |
|---|---|
| working tree | **27** |
| clean HEAD worktree | 39 |

**THE COMPARISON IS NOISY IN BOTH DIRECTIONS AND IS A BOUND, NOT A PROOF.** All 16 HEAD-only failures
are worktree artefacts — a fresh checkout has no `data/releases/` (gitignored), no untracked probes,
and freshly-stamped mtimes, which is enough to fail `test-engine-release`, `test-artifact-rerunnable`,
`test-medicham` and the rest. The four working-tree-only failures were each opened and attributed:

| working-tree-only failure | what it actually says | whose |
|---|---|---|
| `tests/test-no-silent-failure.js` | 4 NEW silent catches, all in `tests/probe_berserk_switcheroo.js` — another agent's untracked file, absent from the HEAD worktree | not this pass |
| `tests/test-set-realism.js` | exit **134**, OUT OF HEAP, no `ABRA-HEAP` declared | resource, not this pass |
| `tests/test-workflow-paths.js` | *"a tracked .gz store is STALE"* — `games.ladder.jsonl` and `games.bo3.jsonl` | OPS |
| `engine/validate_selfplay.js` | *"no duplicate ids (89)"* in the self-play store | OPS |

None of the four touches damage, tags or the census. The targeted per-test comparisons above are the
stronger evidence; this table is what bounds the rest.

## THE RE-CUT, AND THE ORDERING MISTAKE THAT FORCED IT

**REBUILDING `data/abra-tags.js` AFTER CUTTING THE RELEASE MOVED THE TREE DIGEST**, and the bundle is
one of the 26 frozen SOURCES. `status.js` then reported four clauses as *MEASURED AGAINST A DIFFERENT
ENGINE — this artifact ran on release `fb73f82ea1ed` and the tree is `f3d423e19e88`* and WITHHELD every
count in them. That is the guard working exactly as designed, and the right response is a re-run rather
than an annotation.

**A SECOND RELEASE WAS CUT OVER THE SETTLED TREE (`f3d423e19e88`) AND ALL FOUR INSTRUMENTS RE-RUN.**
The only byte difference between the two releases is the browser bundle, which node never reads — so
the prediction was that every figure comes back identical, and the re-run is therefore also an
IDENTITY CHECK rather than a repeat.

| | `fb73f82ea1ed` | `f3d423e19e88` |
|---|---|---|
| games / raw diverged / threw | 961 / 6 / 0 | **identical** |
| board never diverged | 961 | **identical** |
| whole-game, board-material | 1 of 961, 0 of 961 | **identical** |
| the six first-divergences | `\|upkeep <> \|faint\|p2b` + five `fallenundefined` | **identical, same order** |
| roster items / abilities / moves | 139 / 129 / 475, 0 DIFFER, 0 DID-NOT-FIRE | **identical** |
| `all_mechanics_fire` | 1289 games, 0 threw; moves STATE 5, abilities ANN-ONLY 3, items STATE 1 | **identical** |
| `ability:sandforce` | FIRED, NO-DIVERGENCE | **identical** |
| gate | 5 of 8 clauses PASS | **5 of 8 PASS** |

**THE LESSON IS AN ORDER, NOT A FLAG.** Every generated bundle that is a frozen source must be rebuilt
BEFORE the cut, not after. Nothing warned at the time; the gate caught it two hours later, which is
the whole reason the digest comparison exists.

## OWED, NOT RUN

- **ROADMAP #516 — Analytic into `CH_EXACT`.** It is spent through the same `exact4096` call at the
  basePower site and its handler is `chainModify([5325, 4096])`, so it is currently paid at 5324/4096.
  `tests/test-damage-stages.js` cannot see it: that gate fails on a table which DISAGREES with the
  dex, never on a spent member MISSING from it. Left out here because it moves a damage number this
  pass did not predict and could not then attribute. One line, its own prediction, its own
  before/after. Carriers in Reg M-B: Starmie, Watchog.
- **A POOL-SCALE READING OF `MEDSEEN.damageBoostWeather`.** `game_differential.js` surfaces no
  MEDSEEN, so the new branch's reach inside real games is unknown; it has only been read on a staged
  board.
- **`tests/probe_red_demo.js` EXITS 2 WITH FOUR COULD-NOT-BE-APPLIED PATCHES** — Protect's last
  action, the mega stone and Knock Off, and two Electro Shot charge rows. Not introduced here (every
  hunk in this pass is inside the `damageBoost` / `CH_EXACT` / counter region) and not filed away
  either: each needs its edit re-aimed at what the engine says today, exactly as the ROADMAP #112
  patch did in this pass.
- **`tests/test-pinch-family.js` REPORTS 1 OF 61 FAILED** on its positive control — the same failure,
  by name, that clean HEAD reports. The ungated set is `firemane` alone, because four of the five
  0-use members the control names have no legal carrier in Reg M-B and are therefore not derived into
  the artifact; the gated/ungated membership is byte-identical before and after this change. The
  control is asserting something the regulation no longer contains.
- **THE CENSUS PIN WAS NOT RE-CUT.** This run steered from
  `data/verification/census-pin-9446a684709d.json`, the same pin the previous batch used, so the two
  runs are comparable. A census that gained a row does not change which scenarios play unless the pin
  is re-cut.
- **THE WHOLE-GAME BASELINE IS STILL STAMPED UNDER `2efbc9ed1946`** against this run's
  `ccb365985023`, so `quarantine.js` withholds direction of travel and is right to. Re-stamping is a
  decision about which pin is meant to be held and was not taken here.
- **`data/archetypes.json`, `data/kad-replays.js`, `data/live.js` and `data/provenance-stamp.json`
  were already modified in the working tree** when this pass started. They were not touched and not
  committed by name here. Reported, not tidied.
