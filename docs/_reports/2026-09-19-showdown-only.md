# The six SHOWDOWN-ONLY abilities — 2026-09-19 (ENGINE, light mode)

**Verdict.** None of the six is an effect gap. Each effect is performed, and the boards of the two engines agree
in staged two-engine games. Three rows were a missing announcement, which is narration. I fixed it in the engine.
Two rows were the CONTROL's announcement credited to the carrier. That is an instrument defect, and I fixed it in
`engine/all_mechanics_fire.js`. One row is the declared AUTHORITY-WRONG `fallenundefined` line. It is still refused
on purpose, and the row now names that line.

| ability | class | fixed? | proof |
|---|---|---|---|
| Pressure | (a) narration: the switch-in `-ability` was missing | yes | `tests/probe_start_announce.js`, knob `MEDI_START_ANNOUNCE_SILENT=1`, census `announcesOnStart` |
| Mold Breaker | (a) narration: same, including the mega door | yes | same |
| Unnerve | (a) narration: same | yes | same |
| Rock Head | (c) instrument: the control Pressure's announcement was the only movement | detector fixed; the row now reads DID-NOT-FIRE | `control_announcement_only` on the row; the Aerodactyl carrier learns no legal recoil move |
| Natural Cure | (c) instrument: the control Cloud Nine's announcement was the only movement | detector fixed; the row now reads CANNOT-FIRE-IN-THIS-FIXTURE | same field; the preflight's status-present clause |
| Supreme Overlord | declared: AUTHORITY-WRONG `fallenundefined` (`engine/quarantine.js:1897`) | refused on purpose | the row's `why` now names the line |

Releases: the baseline is `4c9b0cc4a4da` (the main tree's release, re-cut here with the same bytes). The fix
release is **`d8526fc9ba28`**, cut in this worktree. `data/engine-release.json` is restored to `4c9b0cc4a4da`.

## 1. What the authority did, read from the staged games

I replayed each row's legacy fallback game on `4c9b0cc4a4da` with `--dumplog`, then took the difference of the
authority's ON and OFF streams (timestamps and transport removed):

| row (carrier / control) | authority lines ON-only / OFF-only |
|---|---|
| Pressure (Absol / Super Luck) | ON `\|-ability\|p1a: Absol\|Pressure` |
| Mold Breaker (Basculegion / Swift Swim) | ON `\|-ability\|p1a: Basculegion\|Mold Breaker` |
| Unnerve (Aerodactyl / Rock Head) | ON `\|-ability\|p1a: Aerodactyl\|Unnerve` |
| Rock Head (Aerodactyl / Pressure) | OFF `\|-ability\|p1a: Aerodactyl\|Pressure` |
| Natural Cure (Altaria / Cloud Nine) | OFF `\|-ability\|p1a: Altaria\|Cloud Nine` |
| Supreme Overlord (Kingambit / Defiant) | ON `\|-end\|p1a: Kingambit\|fallenundefined\|[silent]` |

In each row, that one line was the whole difference. The medicham trace did not move in any of the six (the
artifact's `medicham_moved: false`). The board verdict was NO-DIVERGENCE in five rows and ANNOUNCEMENT-ONLY in
Supreme Overlord's row.

Source, Champions mod first. `data/mods/champions/abilities.ts` overrides only `naturalcure` (:63-71, the
switch-out cure with `[silent]`). The other five come from mainline `data/abilities.ts`: pressure :3427-3439 (onStart
announce, onDeductPP), moldbreaker :2679-2690 (onStart announce, onModifyMove ignoreAbility), unnerve :5250-5266
(latch, announce, onFoeTryEatItem), rockhead :3896-3907 (onDamage refuses `recoil` except Struggle), and
supremeoverlord :4722-4746 (onStart guarded on `totalFainted`, onEnd NOT guarded, hence `fallen${undefined}`).

## 2. The effects, on the board, on both engines

Script: `effects_two_engine.js` (scratchpad, not shipped). It stages one game per arm through
`game_differential.playGame` in state mode, so the boards are compared at every boundary, on the live tree
(`tests/_live_release.js`):

| case | carrier arm, authority | control arm, authority | boards |
|---|---|---|---|
| Rock Head: Aggron Double-Edge ×2 into Milotic | no recoil line | `-damage\|p1a: Aggron\|117/145\|[from] Recoil`, then 100/145 | 3/3 and 3/3 agree |
| Natural Cure: Rotom Thunder Wave, then Altaria switches out | `-curestatus\|p1a: Altaria\|par\|[from] ability: Natural Cure\|[silent]` | paralysis kept | 4/4 and 4/4 |
| Mold Breaker: Excadrill High Horsepower into Levitate Rotom | `-damage\|p2a: Rotom\|0 fnt` | `-immune\|p2a: Rotom\|[from] ability: Levitate` | 2/2 and 2/2 |
| Unnerve: Stone Edge + Iron Head into a Sitrus Milotic | 65/170 → 16/170, berry never eaten | Sitrus eaten at 65 → 107 | 4/4 and 4/4 |
| Pressure: Rotom Thunderbolt ×2 at Absol | PP compared by the board | same | 3/3 and 3/3 |
| Supreme Overlord: an ally explodes, Kingambit enters, Iron Head | 54 damage (170→116), `-activate`/`-start fallen1` | 49 damage (170→121) | 4/4 and 4/4 |

The first cut of this script staged Double-Edge into a Ghost and Thunder Wave into a Protect, so the probe was
wrong before the engine (LESSONS §5). Both cuts were re-staged, and the numbers above come from the corrected cut.

## 3. The fixes

**Engine (narration).** New derived tag `announcesOnStart` in `engine/tag_dex.js`. The rule reads the WHOLE
`onStart` body: it must be exactly `this.add('-ability', <subject>, '<own name>')`, and it may carry a
`this.effectState.X` latch or a `suppressingAbility` guard. Membership was printed before wiring:
**pressure, moldbreaker, unnerve, fairyaura**. The rule drops the illegal members (the Ruin abilities,
Teravolt, Turboblaze, Dark Aura, Aura Break, Comatose) because they have no legal carrier. Cloud Nine
(`onSwitchIn`) is left out on purpose. `applyEntryEffects` writes the line first. That function is the engine's
Start: lead pass, refill, mega, ability rewrite and acquired ability. Counter `MEDSEEN.startAnnounced`. Knob
`MEDI_START_ANNOUNCE_SILENT=1`, which is stamped as `MEDFAILS.startAnnounceSilentRestored` and listed in the
census DELIBERATE_BREAK.

`data/tags.json` was **patched, not regenerated**. The worktree holds no store, so a `tag_dex.js` run here writes
every usage count as zero (`sheet_entries` 316,656 → 0). I ran it with the rule and took the four members, their
params, their tag order and the index row's `consumedBy`. I carried those into the committed file. A check
refused any other ability whose tag list differed between the two files, and none did. `uses` (5,874) and
`examples` were recomputed from the committed usage in the same way `collect()` does it. `data/abra-tags.js` was
rebuilt, and `build/build_tags_js.js --check` passes. The `generated` stamp was left alone. A real
regeneration in the main tree is owed.

**Instrument.** In `abRow` (`engine/all_mechanics_fire.js:3762`), a bare `|-ability|BODY|<control>` line is set
aside on both engines before the verdict. That line is the control's own announcement, with no fields after it.
The raw flags are kept when this changes a verdict (`control_announcement_only`, `showdown_moved_raw`,
`medicham_moved_raw`). SHOWDOWN-ONLY and MEDICHAM-ONLY rows now carry a `why` that lists the lines that moved (up
to 4). Nothing else is set aside, so a control that DOES something (an Intimidate drop, a `[from]` heal) still
moves the game.

**Named rows re-run on `d8526fc9ba28`** (`--kind abilities --only …`, 133 games, 0 threw):

| row | before (`4c9b0cc4a4da`) | after |
|---|---|---|
| pressure / moldbreaker / unnerve | SHOWDOWN-ONLY | **FIRED** |
| rockhead | SHOWDOWN-ONLY | DID-NOT-FIRE, `control_announcement_only` |
| naturalcure | SHOWDOWN-ONLY | CANNOT-FIRE-IN-THIS-FIXTURE, `control_announcement_only` |
| supremeoverlord | SHOWDOWN-ONLY, `why` empty | SHOWDOWN-ONLY, `why`: `ON \|-end\|p1a: Kingambit\|fallenundefined\|[silent]` |
| adaptability, intimidate, justified, limber, mirrorarmor, sandforce, sandrush, shedskin, unburden, cloudnine | FIRED | FIRED (no regression) |

`--red` on `d8526fc9ba28`: every plant CAUGHT.

**Proofs.**
- `tests/probe_start_announce.js`: 8 arms (LEAD-PRESSURE, LEAD-UNNERVE, SWITCH-MB, MEGA-MB and a control for each).
  It passes on the live tree and exits 1 under `MEDI_START_ANNOUNCE_SILENT=1`: the 4 member arms fail and the
  controls hold. With `--release 4c9b0cc4a4da` (the pre-fix bytes) it also exits 1, with the same 4 member arms red.
  `--red` mode passes.
- Census: **955 → 956 live, 0 missing**. The new row is `ability announcesOnStart`. It is MISSING under the knob,
  and the census REFUSES to write under the knob. Before that knob was added to DELIBERATE_BREAK, a knob run
  wrote 955/1 once. That run was caught, the knob was listed, and the clean census was regenerated.
- `tests/test-tag-params-derived.js`, `tests/test-protocol-trace.js` and `build/build_tags_js.js --check` pass.
  `engine/status.js` (read-only) prints `956/956 probed mechanics live, 0 missing` and `301 of 301 in-scope tags
  carry a probe`.

## 4. Pinned-pool exposure, and why the lattices did not see it

This is taken over `data/team-pool-frozen` in the main tree (bo3 + ots, deduplicated by id): **17,381** open-sheet
games.

| ability | games with it on a sheet | carrier BROUGHT | brought, no mega stone | other |
|---|---|---|---|---|
| Unnerve | 3,343 | 1,980 | 800 | |
| Rock Head | 2,117 | 1,266 | 979 | 936 bring a Rock Head carrier with a recoil move |
| Mold Breaker | 405 | 226 | 190 | +269 games bring Gyarados, Ampharos or Emboar holding its stone (Mold Breaker megas) |
| Pressure | 292 | 203 | 183 | |
| Supreme Overlord | 142 | 77 | 77 | |
| Natural Cure | 141 | 103 | 14 | |

These counts are common, and the lattices still saw nothing, for three reasons:
1. **The effects are right.** No board could part, so the board-material clause had nothing to find (§2).
2. **Every missing line was an `-ability` line**, and `engine/game_differential.js:2642` (`ability-announcement`)
   drops every `-ability` line on both sides by declaration. The narration clause is therefore blind to all
   three by construction.
3. **Supreme Overlord's `fallenundefined`** is declared AUTHORITY-WRONG (`engine/quarantine.js:1897`), and
   `SHOWDOWN-ONLY` is a verdict that no gate clause reads (`engine/quarantine.js:2140`).

So the gate reading OPEN on `4c9b0cc4a4da` was correct. These rows were never a threat to it.

## 5. Files changed (worktree `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-ab812db733cfd7e72`)

- `engine/medicham2-browser.js`: the knob, the `startAnnounced` counter, and the announcement in `applyEntryEffects`.
- `engine/tag_dex.js`: the `announcesOnStart` rule.
- `data/tags.json`, `data/abra-tags.js`: the four members (patched, see §3).
- `engine/all_mechanics_fire.js`: the control-announcement attribution in `abRow`, and a `why` on the
  one-sided verdicts.
- `tests/test-mechanics.js`: the census probe and the DELIBERATE_BREAK entry.
- `tests/probe_start_announce.js`: new.
- `data/mechanics-census.json`: regenerated, 956/0.
- `docs/ENGINE.md`: a ledger section and hand-list lines.
- `data/releases/4c9b0cc4a4da/{cuts.jsonl,release.json}`: my baseline re-cut appended one cut event (same bytes).
  This file is append-only by design and was left in place.

`data/all-mechanics-fire.json` was NOT rewritten. The named-row run went to the scratchpad.

## 6. Addendum (coordinator follow-up): the pinned probe, and fixtures for the three inert rows

**Why `--release d8526fc9ba28` failed.** It was not stale bytes. `engine_release.js list` shows
`d8526fc9ba28  0 of 27 files have moved since`, and a re-cut of the final tree returns the same id. The
probe was at fault. `game_differential.js` opened `--release d8526fc9ba28` and played the games on it, but the
probe's own `ER.open()` took no id and opened `data/engine-release.json`'s pointer. That pointer had been
restored to `4c9b0cc4a4da`, so the probe read `startAnnounced` from a second, pre-fix module instance and got
+0, while every arm passed on the pinned games. Fix: the probe now opens the `--release` id it was given.
`tests/probe_entry_announce_batched.js` has the same shape. I did not touch it; the gap is noted here.

**Verified on `d8526fc9ba28`, cut from the final tree, with the pointer deliberately at `4c9b0cc4a4da`**
(the condition that failed before):
- `node tests/probe_start_announce.js --release d8526fc9ba28` gives PASSED, `startAnnounced +4`, exit 0.
- `MEDI_START_ANNOUNCE_SILENT=1 node tests/probe_start_announce.js --release d8526fc9ba28` gives 6 claims FAILED
  (the 4 member arms and the 2 counter claims), controls hold, exit 1.

**Fixtures, all derived.** Each derivation had its membership printed before it was wired
(`print_needs.js`, scratchpad), over legal abilities and items. Each has exactly one member.

| row | derivation (file) | fixture the planner now builds | control |
|---|---|---|---|
| Rock Head | `onDamage` reads `effect.id === "recoil"` becomes an ACTOR recoil need (`engine/fixture_preflight.js`) | Aerodactyl refused NO-TRIGGER-SUPPLIER (it learns no recoil move); **Aggron** clicks Double-Edge into Feraligatr | the same Aggron with Heavy Metal |
| Natural Cure | `onSwitchOut` reads the holder's status gives a `switch-out` trigger (`engine/stage_planner.js`) | T1 Feraligatr Ice Beam into Altaria (the bottom arm lands the freeze), T2 Altaria switches to the bench; leaf: the carrier's status | the same Altaria with Cloud Nine |
| Supreme Overlord | `onStart` reads `side.totalFainted` gives the entry need `side-fainted` (`engine/stage_planner.js`) | T1 lead Alcremie Misty Explosion (tag `userFaints.faints === 'always'`), Kingambit replaces it; T2 Kingambit X-Scissor into Feraligatr; leaf: the receiver's HP | the same Kingambit with Defiant |

`render` and `finish` in the planner learned that a user-fainting click hands its slot to the named replacement
(`faintsInto`). The driver sends the first healthy bench body, which is C by the lineup.

**Named rows on `d8526fc9ba28`** (`--kind abilities --only …`, 90 games, 0 threw, written to the scratchpad):

| row | before (`4c9b0cc4a4da`) | after | variants | boards (carrier arm / control arm) |
|---|---|---|---|---|
| rockhead | SHOWDOWN-ONLY | **FIRED** (planner) | near-a, far-a FIRED | NO-DIVERGENCE / NO-DIVERGENCE |
| naturalcure | SHOWDOWN-ONLY | **FIRED** (planner) | near-a, far-a FIRED | NO-DIVERGENCE / NO-DIVERGENCE |
| supremeoverlord | SHOWDOWN-ONLY | **FIRED** (planner) | near-a, far-a FIRED | NO-DIVERGENCE / NO-DIVERGENCE |
| pressure, moldbreaker, unnerve | SHOWDOWN-ONLY | FIRED (planner) | all FIRED | NO-DIVERGENCE / NO-DIVERGENCE |
| reckless (shares the recoil need) | FIRED | FIRED | unchanged | unchanged |
| regenerator, zerotohero (switch-out neighbours) | FIRED / FIRED-UNCONTROLLED | same | planner variants unchanged | unchanged |

`tests/test-stage-planner.js` is GREEN, and every red demonstration is still caught.

## PROPOSED NOTES ROW

```
### <<VER>> — 2026-09-19 — The six SHOWDOWN-ONLY abilities: three missing announcements written, two control-credit rows fixed in the instrument, one declared

**What changed.** Pressure, Mold Breaker and Unnerve now write their own `|-ability|` line when they start: at switch-in, at a mega (Gyarados into Mold Breaker) and after a copied ability. The rule is the derived tag `announcesOnStart` (engine/tag_dex.js; members pressure, moldbreaker, unnerve, fairyaura). `engine/all_mechanics_fire.js` no longer credits a carrier with its CONTROL's own entry announcement, and every one-sided verdict now names the lines that moved. The effects of all six were already right on both engines (staged two-engine games, boards agree at every boundary).
**Figures.** Census 955 → 956 live / 0 missing (data/mechanics-census.json, row `ability announcesOnStart`). all-mechanics-fire named rows on release d8526fc9ba28: pressure, moldbreaker and unnerve SHOWDOWN-ONLY → FIRED; rockhead → DID-NOT-FIRE (control announcement only; the carrier learns no legal recoil move); naturalcure → CANNOT-FIRE-IN-THIS-FIXTURE; supremeoverlord stays SHOWDOWN-ONLY (declared AUTHORITY-WRONG `fallenundefined`). The artifact itself was not rewritten (light mode).
**Proof.** tests/probe_start_announce.js: passes on the live tree, red under MEDI_START_ANNOUNCE_SILENT=1 and red on the pre-fix release 4c9b0cc4a4da.
**Supersedes.** Nothing published. The six SHOWDOWN-ONLY rows in data/all-mechanics-fire.json (4c9b0cc4a4da) are superseded when the artifact is next written.
**Basis.** unchanged
**Owes.** A lattice re-run on the new engine bytes (1200/1350/1950); a full all_mechanics_fire --kind all --write; a main-tree tag_dex regeneration; the fold-in to docs/ABRA-technical-docs.md at the next major.
```

## OWED, NOT RUN

- **The lattice re-run** on the new engine bytes (`--games` 1200/1350/1950, pinned pool, census pin). Engine bytes
  changed, so the gate is CANNOT-ANSWER until this runs. I expect board-material to stay at 0 and narration to be
  unchanged, because every new line is an `-ability` line that the differential drops. Only the per-rule
  `normalisation` count for `ability-announcement` should rise. That is a prediction, not a measurement.
- **`engine/all_mechanics_fire.js --kind all --write`**, so the artifact carries the new verdicts. The abRow change
  can move any row whose only ON/OFF difference was a bare control announcement. I re-ran 16 named rows, not the
  population.
- **`engine/tag_dex.js` in the main tree**, to regenerate `data/tags.json` with the store present, and to confirm
  it matches the patch.
- **The deliberate roster stages** and `tests/test-wiring.js` were not run (light mode).
- ~~Fixtures for the three inert rows~~: done in §6. The **full planner run** (`node engine/stage_planner.js`,
  every mechanic) was not run. Only the named rows and `tests/test-stage-planner.js` were run, so the other
  mechanics' fixtures are asserted unchanged by the test's clauses, not by a diff of the whole plan.
- `tests/probe_entry_announce_batched.js` has the same unpinned-counter shape the new probe had. It was not fixed.
- **Siblings not wired:** Cloud Nine's `onSwitchIn` announcement (Altaria, Drampa). Unnerve's `onSwitchInPriority: 1`
  ordering at a lead. A two-engine arm for Fairy Aura on Floette-Mega.
