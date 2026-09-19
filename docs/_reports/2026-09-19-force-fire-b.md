# Force-fire B: controls for the 32 uncontrolled ability rows — 2026-09-19

ENGINE division. Isolated worktree `.claude/worktrees/agent-a598342c370beb891`. Light mode: only the named rows
were played. No battery, lattice or `quarantine.js` run. The published artifact was not written.

## Verdict

- **24 of the 31 non-closeted rows now read `FIRED` with a control.** Before this pass there were 0.
  - **23 of the 24 pass the stronger test.** The authority's final board differs between the two arms, and ours
    differs on the same leaves (`ab_board.authority_moved && same_leaves`).
  - **Cud Chew** is `FIRED` on streams only. The authority's board does not move between its arms (see below).
- **From the UNPROVEN-UNCONTROLLED twelve:** 10 now read `FIRED`. Shadow Tag is still unproven. Illusion is
  closeted and was left untouched.
- **From the FIRED-UNCONTROLLED twenty:** 14 now read `FIRED`. Six still have no control: Eelevate, Electric
  Surge, Hunger Switch, Innards Out, Parental Bond and Zero to Hero.
- **No board parted.** Every fixture arm and every control arm reads `NO-DIVERGENCE`. No engine defect was found,
  and no engine byte changed.
- **The chooser was fixed; no row was hand-written.** `engine/stage_planner.js` has a second control chain and six
  new trigger derivations. `engine/all_mechanics_fire.js` gains an additive `ab_board` attribution field.

Release `4c9b0cc4a4da`, cut in this worktree. The tree is identical to the one frozen at 12:55Z, so this is cut 2 of
the same bytes. `data/engine-release.json` was restored afterwards.

## The runs

| run | command (from the worktree) | artifact (scratch) |
|---|---|---|
| before | `node engine/all_mechanics_fire.js --release 4c9b0cc4a4da --kind abilities --only <32 rows> --write --out <scratch>/before.json` | reproduces the published rows exactly: 12 UNPROVEN, 20 FIRED-UNCONTROLLED |
| after | same, with the 32 rows plus the 8 rows outside the brief whose fixture or control the chooser change moved | `<scratch>/after1.json`, 82.6 s |
| dump | `ROWS=piercingdrill,cudchew,levitate … --dumplog` | read by eye; see "Two logs read" |

Scratch is `…/scratchpad/force-fire-b/`. `--only` is the existing row filter and does not change a full run.
`--state` is forced, as always. There was no `--team-store`, because the ability path plays planner fixtures and
no pool teams.

## Per row

In the table below, "moved" means `ab_board.authority_moved`: the arms' final authority boards differ on a leaf
other than PP or the swapped ability. "Same" means our engine's differing leaves are the same set.

| row | before | after | control | fixture board | control board | authority board moved | ours same |
|---|---|---|---|---|---|---|---|
| Aerilate | UNPROVEN-UNCONTROLLED | **FIRED** | C click Facade → X-Scissor (supplies no type=Normal) | NO-DIVERGENCE | NO-DIVERGENCE | yes (R hp) | yes |
| Anger Point | FIRED-UNCONTROLLED | **FIRED** | C.ability Magma Armor | NO-DIVERGENCE | NO-DIVERGENCE | yes (C atk boost, R hp) | yes |
| Cud Chew | FIRED-UNCONTROLLED | **FIRED** | C.ability Armor Tail | NO-DIVERGENCE | NO-DIVERGENCE | **no** | yes |
| Disguise | FIRED-UNCONTROLLED | **FIRED** | R click Earthquake → Protect (supplies no damaging hit) | NO-DIVERGENCE | NO-DIVERGENCE | yes (C hp, species) | yes |
| Dragonize | UNPROVEN-UNCONTROLLED | **FIRED** | C click Mega Kick → Dragon Claw (supplies no type=Normal) | NO-DIVERGENCE | NO-DIVERGENCE | yes (R hp …) | yes |
| Drought | FIRED-UNCONTROLLED | **FIRED** | C.ability Flash Fire | NO-DIVERGENCE | NO-DIVERGENCE | yes (field.weather, R hp) | yes |
| Eelevate | FIRED-UNCONTROLLED | FIRED-UNCONTROLLED | — | NO-DIVERGENCE | — | — | — |
| Electric Surge | FIRED-UNCONTROLLED | FIRED-UNCONTROLLED | — | NO-DIVERGENCE | — | — | — |
| Fire Mane | UNPROVEN-UNCONTROLLED | **FIRED** | C click Burning Jealousy → Hyper Voice (supplies no type=Fire) | NO-DIVERGENCE | NO-DIVERGENCE | yes (R hp) | yes |
| Forecast | FIRED-UNCONTROLLED | **FIRED** | CA click Rain Dance → Sleep Talk | NO-DIVERGENCE | NO-DIVERGENCE | yes (weather, C species/types) | yes |
| Fur Coat | UNPROVEN-UNCONTROLLED | **FIRED** | R click Earthquake → Surf (supplies no category=Physical) | NO-DIVERGENCE | NO-DIVERGENCE | yes (C hp) | yes |
| Good as Gold | FIRED-UNCONTROLLED | **FIRED** | R click Spite → Dragon Pulse (supplies no category=Status) | NO-DIVERGENCE | NO-DIVERGENCE | yes (C hp) | yes |
| Hunger Switch | FIRED-UNCONTROLLED | FIRED-UNCONTROLLED | — | NO-DIVERGENCE | — | — | — |
| Illusion | UNPROVEN-UNCONTROLLED | UNPROVEN-UNCONTROLLED (closeted, untouched) | — | ANNOUNCEMENT-ONLY | — | — | — |
| Innards Out | FIRED-UNCONTROLLED | FIRED-UNCONTROLLED | — | NO-DIVERGENCE | — | — | — |
| Levitate | FIRED-UNCONTROLLED | **FIRED** | R click Earthquake → Brutal Swing | NO-DIVERGENCE | NO-DIVERGENCE | yes (C hp) | yes |
| Mega Launcher | UNPROVEN-UNCONTROLLED | **FIRED** | C click Dragon Pulse → Hydro Pump (supplies no flag=pulse) | NO-DIVERGENCE | NO-DIVERGENCE | yes (R hp) | yes |
| Mega Sol | UNPROVEN-UNCONTROLLED | **FIRED** | C click Weather Ball → Pollen Puff (supplies no Fire/Water, reads no effectiveWeather) | NO-DIVERGENCE | NO-DIVERGENCE | yes (R hp) | yes |
| Mimicry | UNPROVEN-UNCONTROLLED | **FIRED** | CA click Psychic Terrain → Sleep Talk | NO-DIVERGENCE | NO-DIVERGENCE | yes (terrain, C types) | yes |
| Parental Bond | FIRED-UNCONTROLLED | FIRED-UNCONTROLLED | — | NO-DIVERGENCE | — | — | — |
| Piercing Drill | UNPROVEN-UNCONTROLLED | **FIRED** | R click Protect → Agility | NO-DIVERGENCE | NO-DIVERGENCE | yes (R hp, spe boost, stall) | yes |
| Sand Spit | FIRED-UNCONTROLLED | **FIRED** | C.ability Sand Veil | NO-DIVERGENCE | NO-DIVERGENCE | yes (weather, hp) | yes |
| Sand Stream | FIRED-UNCONTROLLED | **FIRED** | C.ability Sand Force | NO-DIVERGENCE | NO-DIVERGENCE | yes (weather, hp) | yes |
| Shadow Tag | UNPROVEN-UNCONTROLLED | UNPROVEN-UNCONTROLLED | — | NO-DIVERGENCE | — | — | — |
| Spicy Spray | FIRED-UNCONTROLLED | **FIRED** | R click Dragon Pulse → Sleep Talk | NO-DIVERGENCE | NO-DIVERGENCE | yes (C hp) | yes |
| Stance Change | FIRED-UNCONTROLLED | **FIRED** | C click Brutal Swing → Protect | NO-DIVERGENCE | NO-DIVERGENCE | yes (C species, R hp) | yes |
| Surge Surfer | UNPROVEN-UNCONTROLLED | **FIRED** | CA click Electric Terrain → Sleep Talk | NO-DIVERGENCE | NO-DIVERGENCE | yes (terrain) | yes |
| Sweet Veil | FIRED-UNCONTROLLED | **FIRED** | C.ability Aroma Veil | NO-DIVERGENCE | NO-DIVERGENCE | yes (CA status) | yes |
| Unseen Fist | UNPROVEN-UNCONTROLLED | **FIRED** | R click Protect → Agility | NO-DIVERGENCE | NO-DIVERGENCE | yes (R hp, spe boost, stall) | yes |
| Water Absorb | FIRED-UNCONTROLLED | **FIRED** | C.ability Water Bubble | NO-DIVERGENCE | NO-DIVERGENCE | yes (C hp) | yes |
| Weak Armor | FIRED-UNCONTROLLED | **FIRED** | C.ability Flash Fire | NO-DIVERGENCE | NO-DIVERGENCE | yes (C def/spe boosts) | yes |
| Zero to Hero | FIRED-UNCONTROLLED | FIRED-UNCONTROLLED | — | NO-DIVERGENCE | — | — | — |

### Rows outside the brief that the chooser change moved. All 8 were played; each gives the same kind of verdict as before.

| row | published | after | what moved |
|---|---|---|---|
| Aroma Veil | DID-NOT-FIRE (legacy) | DID-NOT-FIRE (legacy fallback) | the planner fixture gained the Sweet Veil control. It is still DID-NOT-FIRE, as before. |
| Blaze | FIRED (legacy, Speed Boost) | FIRED (planner) | the STAT_CALC fixture fix. The control is the first chain's Temper Flare → Assurance swap. |
| Cursed Body | FIRED (planner, Frisk) | FIRED (planner, Frisk) | the fixture gained a receiver hit (`punishesAttacker` anyHit). Authority board moved (R disable). |
| Heatproof | FIRED (planner) | FIRED (planner) | **The old fixture had R click Sunny Day as its "Fire hit", which never reaches `onSourceModifyAtk`.** It now clicks Flamethrower. |
| Huge Power | FIRED (legacy, Thick Fat) | FIRED (planner, Thick Fat) | the second chain accepted Thick Fat, so the planner row now wins. |
| Purifying Salt | FIRED (legacy, Sturdy) | FIRED (planner, Clear Body) | STAT_CALC fixture fix |
| Sniper | FIRED (legacy, Swarm) | FIRED (planner, Insomnia) | the second chain |
| Water Bubble | FIRED (planner) | FIRED (planner) | STAT_CALC fixture fix |

**Whole-population plan diff** (`plansnap.js`, planning only, all 964 mechanics):
- 924 are byte-identical.
- 22 have a changed fixture and 10 a changed control only.
- 8 changed only their trigger text; their fixtures and controls are identical: Dragon's Maw, Overgrow,
  Rocky Payload, Steelworker, Swarm, Thick Fat, Torrent, Transistor.
- 0 refusals changed.

## What was wrong, and where

Every one of the 32 was refused `NO-SINGLE-VARIABLE-CONTROL` by `buildControl`. The refusal had three causes, all in
the instrument:

1. **`reactsTo` read every click with the carrier as both user and target**
   (`{ userTypes: typesOf(C), targetTypes: typesOf(C) }`). It also counted a handler as "writing state on its own"
   whenever the handler's source mentioned a write, even when the handler needs a status, a weather or a click that
   the board never supplies.
   - Flash Fire was ruled loud beside Drought and Weak Armor on boards where no Fire move is aimed at the carrier.
   - Solid Rock "reacted" to Camerupt's own High Horsepower.
   - Magma Armor, Shed Skin and Water Bubble were ruled loud for a status cure on a board with no status.
2. **Trigger removal only considered clicks named in `conditions`, and only a same-category, same-target twin.**
   - A category need (Weak Armor, Good as Gold) could never be removed.
   - A field setter (Surge Surfer's partner clicking Electric Terrain) was never considered.
   - A spread trigger (Surf) had no twin.
3. **Six trigger shapes were not derived, so the fixture never reached the trigger.** This was the UNPROVEN half.
   - Fire Mane was staged with **Sunny Day**, a Fire-type status move that never reaches `onModifyAtk`.
   - Levitate was staged with no Ground move at all.
   - Piercing Drill and Unseen Fist had no shield to pierce.
   - Mimicry and Surge Surfer's terrain was not derived. Surge Surfer's fixture already set it; Mimicry's did not.
   - Mega Sol had no Fire, Water or weather-reading click.

### The second chain

The chain runs only after the first chain refuses. It uses the same `judge()`: exactly one leaf, exactly one inert
reason.

- **(a) Another of the carrier's abilities, judged by `reactsToOnBoard`.**
  - Each click is read against its real user and the body it lands on.
  - A handler gated on a weather or terrain that no click sets is counted quiet. So is one gated on a holder status
    that no click delivers (`statusesOf`, which honours the bottom corner's always-fire secondaries), and one gated
    on a click need, because the click reading decides that case.
  - A shared tag whose params list what it guards (`statuses`/`volatiles`) reacts only if a click delivers one of
    those. That rule is what clears Aroma Veil beside Sweet Veil's Sing.
- **(c) The trigger click swapped on the body that makes it.**
  - The twin keeps the same aim class and supplies none of the needs that the original click supplied.
  - A category need swaps the category, and the twin is always damaging.
  - A field setter, or a need that every damaging move supplies, takes the body's idle click. That is Protect where
    nothing aims at the body, otherwise the self move whose own `onTry` fails for a healthy body (the same rule as
    `inertFor`).
  - The twin must be unmasked into the same target.
- **(b) Suppression was derived and not built.**
  - No legal species carries Neutralizing Gas. The format walk was filtered with `exists && !isNonstandard &&
    tier !== 'Illegal'`, and it returned no carrier.
  - Gastro Acid is legal (`data/mods/champions/learnsets.ts:328`, five learners; handler at `data/moves.ts:6427-6461`),
    and Mold Breaker has legal carriers. Both change a SECOND body's click or ability, and that body must also move
    before the trigger. A same-carrier trigger swap already gave a one-leaf control on every row where (b) would
    have applied.

### New trigger derivations

Each derivation was printed over every ability in scope before it was wired (`print-derived.js`):

| clause | matched |
|---|---|
| `STAT_CALC` — a need read inside `onModify{Atk,SpA,Def,SpD}` is damaging-only. The event runs with a move only in the damage calculation, `sim/battle-actions.ts:1708-1709`; the move-less call at `sim/pokemon.ts:634` hands no move | 10: firemane, blaze, heatproof, overgrow, purifyingsalt, swarm, thickfat, torrent, waterbubble (×2). *The plan diff also shows dragonsmaw, rockypayload, steelworker and transistor. All four are refused NO-LEGAL-CARRIER (out of scope, so the printer skipped them). Their trigger text changed and they have no fixture.* |
| tag `typeImmunity` with `via: no handler`, on an ability with no handler of its own | 1 after refinement: levitate. The first print also matched eelevate. That was refused, because its base forme's sheet ability (Levitate) masks the same hit and its real trigger is `boostsOnKO`; it was excluded before the run. |
| tag `condStatMult` def/spd `when: always` | 1: furcoat |
| `onHitProtect` | 2: piercingdrill, unseenfist. Authority: `data/mods/champions/abilities.ts:89-99` (Unseen Fist). Piercing Drill is `data/abilities.ts:3272-3285`, inherited by `data/mods/champions/abilities.ts:73-76`. The bypass announces at `data/mods/champions/scripts.ts:299-303`. |
| `onTerrainChange` `case "<x>terrain"` | 1: mimicry (`data/abilities.ts:2571-2608`) |
| weather delegate (`conditions.getByID(...).onWeatherModifyDamage`) plus `effectiveWeather(` readers | 1: megasol. The event is on the attacker (`data/mods/champions/scripts.ts:217`). The holder's weather reads sun while it is the active mover (`sim/pokemon.ts:2198-2202`). Handler: `data/abilities.ts:2548-2561`, inherited by `data/mods/champions/abilities.ts:59-62`. |
| tags `formeOnHit`, `punishesAttacker` anyHit (not `onFaintOnly`), `formeOnMoveCategory` — only where PRE named nothing for that side | disguise, spicyspray, cursedbody, sandspit (receiver); stancechange (actor) |
| tag `formeFollowsWeather.byWeather` | 1: forecast |

### Two logs read (the authority's lines, `--dumplog`)

- **Piercing Drill, fixture arm.** The log reads `|move|p1a: Excadrill|X-Scissor|p2a: Feraligatr`, then
  `|-ability|p1a: Excadrill|Piercing Drill`, then `-zbroken`. The hit through Protect does 18 of 160.
  - In the control arm Feraligatr clicks Agility, and the hit does 71.
  - Our engine matched both boards.
- **Cud Chew.** In the fixture arm the log reads `-activate|p1a: Farigiraf|ability: Cud Chew`, then the Aspear Berry
  is re-eaten at the end of turn 2. The control arm (Armor Tail) does not re-eat it.
  - The Farigiraf is no longer frozen by then, so the re-eat cures nothing. The board is identical in both arms,
    which is why `ab_board.authority_moved` is `false`.
  - **This row is not counted as board-proven.** A heal berry on a damaged holder would move the board.

## Why the rest are still uncontrolled

- **Shadow Tag** (`data/abilities.ts:4146-4163`). The trigger is a trapped foe *choosing* to switch. The authority
  refuses that choice, so a script cannot ask for it without the game throwing. The trap itself writes no protocol
  line and no board leaf. The fixture would have to read `trapped` off the authority's request. That is a driver
  seam, not a chooser change.
- **Electric Surge** (on Raichu-Mega-X). The trigger is the carrier's own arrival as a mega. The only pre-set /
  not-pre-set control is a two-turn fixture: the terrain is set on turn 1, and the mega follows on turn 2. The
  planner does not build that shape yet.
- **Innards Out** (`onFaintOnly`). The fixture must KO the holder, and the planner runs no damage calculator. The
  legacy ladder proves it on `mega-real-pool-3`.
- **Parental Bond.** The twin that removes the trigger is a spread or multi-hit move of the same category. The
  handler returns early on `move.spreadHit` (`data/abilities.ts:3160-3178`). That needs a cross-aim-class twin,
  which the chain deliberately does not offer.
- **Eelevate.** The real trigger is a KO by the holder (`boostsOnKO`), with the same fixture limit as Innards Out.
- **Hunger Switch** (end-of-turn toggle) and **Zero to Hero** (switch out and back). No single-leaf removal was
  derived.
- **Illusion.** Closeted by Will; left alone.

## Tests and instruments run

- `node tests/test-stage-planner.js` (full population): **GREEN**. The new clause `k7SecondChain` passes. The new
  break `no-second-chain` turns it **RED**, with 9 fixtures carrying no control. Every existing red demonstration
  still goes red.
- `node tests/probe_amf_default_populations.js --release 4c9b0cc4a4da`: **GREEN** (a default run still publishes
  moves, abilities and items).
- **Red, and the cause is outside this change:**
  - `node tests/probe_amf_default_populations.js` with its built-in default `--release 2b5a6585d8cf` is
    CANNOT-ANSWER. That release throws at `game_differential.js:2537` because `data/protocol-events.json` records
    45 claimed events and the release plays 44 (`-block` no longer claimed). The harness never reaches this pass's
    code. It is a stale pinned release.
  - `node tests/test-red-run-writes.js`: 15 passed, 1 failed. The failure is `tests/probe_knockoff_berry_consumers.js`
    and `tests/probe_prankster_target.js`, which write before their verdict. Neither was touched here.
- **Conformance (`--strict`):** 18 regressions, all present before this pass. `engine/stage_planner.js` was already a
  regression with the same finding: it names move:protect, move:auroraveil and ability:prankster. This pass added
  three more `'protect'` literals, which is the same finding. The run rewrote `data/conformance.json`; that file was
  restored.
- **The census was not regenerated.** No engine byte changed, so `tests/test-mechanics.js` has nothing new to count.

## Files changed (worktree)

- `engine/stage_planner.js`: the second chain (`secondChainControl`, `reactsToOnBoard`, `boardClicks`,
  `statusesOf`), `derivedAbilityTriggers`, `STAT_CALC`, and the `needMet` wrapper, which is identical to
  PRE.satisfiesNeed unless a need carries `orMoves`. It also adds the target-protects staging in `composeEntity` and
  the break `no-second-chain`.
- `engine/all_mechanics_fire.js`: `lastBoards` is kept per game (one board, overwritten each boundary).
  `abBoardMoved` fills `ab_board` on every A/B row. The field is additive, and no verdict reads it.
- `tests/test-stage-planner.js`: clause `k7SecondChain` and its red demonstration.
- `docs/ENGINE.md`: section "FORCE-FIRE B".
- `data/releases/4c9b0cc4a4da/{cuts.jsonl,release.json}`: the cut record of this worktree's pin (cut 2 of identical
  bytes). Merge it or drop it. `data/engine-release.json` is restored.

## Proposed notes row, first pass (superseded by the one at the end)

```
## [<<VER>>] — 2026-09-19 — Force-fire B: the control chooser builds a control for 24 of the 31 uncontrolled ability rows
- **What changed.** `engine/stage_planner.js`: a second control chain. It runs only where the first refused, and it
  reads each click against its real user and target. It swaps a trigger click for a twin that supplies none of the
  needs, or for an idle click for a field setter or any-hit need. Six trigger shapes are now derived: STAT_CALC
  damaging-only, `typeImmunity` with no handler, `condStatMult`, `onHitProtect`, `onTerrainChange`, and a weather
  delegate plus `effectiveWeather` readers. `engine/all_mechanics_fire.js`: an additive `ab_board` on A/B rows.
  `tests/test-stage-planner.js`: clause `k7SecondChain`, red under `STAGE_PLANNER_BREAK=no-second-chain`.
- **Measured.** Release `4c9b0cc4a4da`, `all_mechanics_fire.js --kind abilities --only <40 rows>` to scratch; the
  published artifact was not written. Of the 31 non-closeted uncontrolled ability rows, 24 read FIRED with a
  control. 23 of those move the authority's board between arms, and ours moves the same leaves; Cud Chew moves
  streams only. Every fixture and control arm reads NO-DIVERGENCE. Plan diff: 924 of 964 mechanics are identical,
  22 fixtures and 10 controls moved, and the 8 moved rows outside the brief were each played and gave the same kind
  of verdict as before.
- **Basis.** unchanged.
- **Supersedes.** The next full `data/all-mechanics-fire.json` will read ~~12 UNPROVEN-UNCONTROLLED / 20
  FIRED-UNCONTROLLED~~ as 2 / 6 (Shadow Tag, Illusion / Eelevate, Electric Surge, Hunger Switch, Innards Out,
  Parental Bond, Zero to Hero). That is not measured on the published artifact until the battery is re-run.
- **Owed to the next major.** `docs/ABRA-technical-docs.md` (the instrument section: the second control chain).
```

## Owed after the first pass (superseded at the end)

- **The full `all_mechanics_fire.js` battery** (light mode forbade it). It is the only way the published artifact
  picks up these 24 controls. It also covers the 8 trigger-text-only rows, whose fixtures are identical, so they
  should not move. It should also confirm that nothing else moved, since `lastBoards` is now retained per game (one
  board per game).
- **`engine/quarantine.js`**. Its ability clause reads this artifact. None of these rows turned into DID-NOT-FIRE,
  SHOWDOWN-ONLY or MEDICHAM-ONLY in the scratch run, but that is not the gate.
- **A knob-red demonstration for a silent row.** For example, a `MEDI_*` switch that disables Fur Coat's
  `condStatMult` in the engine would show the fixture arm reading `STATE` under it. The A/B proves the fixture now
  reaches the trigger. It does not prove the instrument would catch our engine getting it wrong.
- **Cud Chew with a board-moving berry** (a heal berry on a damaged holder), so its control moves a board.
- **Shadow Tag** needs a driver seam: read `trapped` off the authority's request. **Electric Surge** needs a two-turn
  pre-set fixture. **Innards Out** and **Eelevate** need a KO fixture. **Parental Bond** needs a cross-aim-class twin.
- **Pre-existing reds seen and not touched:** `tests/test-red-run-writes.js` (two probes outside ENGINE write before
  their verdict), `tests/probe_amf_default_populations.js`'s stale default release `2b5a6585d8cf`, and 18
  conformance regressions. *(Both tests fixed in the second pass, below.)*

---

# Second pass (coordinator follow-up): the last seven, Cud Chew's board, and two red tests

## Verdict

- **All 31 non-closeted rows now read FIRED with a control.** In every one, the authority's final board differs
  between the arms, and ours differs on the same leaves. For Shadow Tag the leaf is the request's trapped flag.
  Every fixture arm and every control arm reads NO-DIVERGENCE. Illusion is closeted and was left alone.
- **One engine line changed:** `engine/medicham2-browser.js` now exports its existing pure `switchTrapVerdict`. It
  is an export only; no behaviour changed. New worktree release **`334a14dd8435`**. It is gitignored (a new
  release), so re-cut it on merge. Every row in this pass was re-played on it: 43 rows, 81.5 s.
- **Both red tests are green.** `tests/test-red-run-writes.js` reads 18 of 18: `tests/probe_knockoff_berry_consumers.js`
  and `tests/probe_prankster_target.js` declare `WRITE-POLICY: findings` and already stamp `run_ok`.
  `tests/probe_amf_default_populations.js` is GREEN: its default release is read from `data/engine-release.json`
  instead of the stale `2b5a6585d8cf`, which threw on the protocol-events claim check.

## Row by row (release `334a14dd8435`, scratch `after2.json`)

| row | control (one leaf) | what the authority's board shows moving | receipt / source |
|---|---|---|---|
| Zero to Hero | C switches to the bench, or stays in and clicks Protect | the bench row `party.palafin.species` (Hero vs base) | handler `onSwitchOut` formeChange, `data/abilities.ts:5617-5636` |
| Hunger Switch | C stays in, or switches to the bench on that turn, so no residual runs for it | `party.morpeko.species` | `onResidual`, `data/abilities.ts:1886-1897` |
| Parental Bond | C clicks Hydro Pump (single-target), or Surf (spread, same category) | R's hp | the handler returns early on `move.spreadHit`, `data/abilities.ts:3160-3178`; fixture `-hitcount` |
| Electric Surge | a setup turn is put first; the partner (Bellibolt) idles, or sets Electric Terrain; the mega comes on turn 2 | `field.terrain_turns` only | a same-terrain `setTerrain` returns false, `sim/field.ts:137` |
| Innards Out | R clicks Sheer Cold (OHKO) into the holder, or Chilling Water | the holder faints; R takes Innards Out damage and faints | log: `-damage\|p2a: Abomasnow\|0 fnt\|[from] ability: Innards Out` |
| Eelevate | turn 1: R clicks Endure and CA clicks Sheer Cold, leaving R at 1 HP; turn 2: C clicks Dragon Claw, or Protect | C's atk boost; R faints | log: `-ability\|p1a: Eelektross\|Eelevate\|boost`, `-boost\|atk\|1` |
| Shadow Tag | R holds nothing, or Shed Shell (tag `escapesTrap`) | the request's `trapped` flag for R: authority `true` vs `false`, ours `true` vs `false` | `pokemon.trapped` recomputed in `endTurn`, `sim/battle.ts:1723-1727` |
| Cud Chew (firmed) | C.ability Armor Tail | `active.0.status`: paralysis is cured by the second eat | the berry is now Cheri (par), and Body Slam lands again on turn 2 |

### Shadow Tag, shown red first

The same row on the old release `4c9b0cc4a4da`, which has no export, reads **board STATE, `request_leaf_why:
UNANSWERABLE`**. A missing answer is counted as a parting, never as "not trapped". On `334a14dd8435`,
`request_trap` reads `on {sd:true, me:true}`, `off {sd:false, me:false}`, `parted: false`.

### Cud Chew: why the first firm-up failed

Adding a second Ice Beam did not move the board. **At the bottom corner every thaw die succeeds**: freeze's own
condition cures itself in `onBeforeMove`, so the status was gone before the residual re-eat. The fix is derived,
not named. It uses a status whose own condition never calls `cureStatus`, printed over the six: frz and slp cure
themselves; brn, par, psn and tox do not.

## What was added to the instrument

- **`engine/stage_planner.js`**
  - New trigger derivations:
    - `carrier-switches-out` (tag `switchOutTrigger`).
    - `foe-trapped` (tag `preventsSwitch`), observed on a `request` channel.
    - Receiver `ohko` need (tag `punishesAttacker.onFaintOnly`).
    - `holder-kos` (tag `boostsOnKO.requiresMoveKO`) with the stager `stageHolderKOs`. The Endure-like floor move and
      the OHKO moves are derived from `condition.onDamage` returning `hp - 1` and from `move.ohko`.
    - `hitsTwice` with a spread twin, taken from the handler's own `move.spreadHit` guard.
    - The Cud Chew re-eat rule (`singleEvent('Eat'`; printed, and it matches Cud Chew only).
  - `masksFor` now counts an OHKO move into an ability that refuses it (Sturdy's `return null`) and a typed OHKO
    into its own type.
  - New second-chain strategies: switch withheld, residual escaped by a switch, escape item on the receiver,
    pre-set field before a mega's arrival, spread twin, and idle twin.
- **`engine/all_mechanics_fire.js`**
  - `trapAt`, the request reader. It asks both engines at each boundary, never by a switch choice.
  - `request_trap` on an A/B row, which feeds the verdict and turns a disagreement into a parting.
  - `ab_board.species_leaves` and `leaves_total`, because a switch-shaped control moves the whole slot and the forme
    leaves would otherwise fall off the first eight.
- **`tests/test-stage-planner.js`**: `k7SecondChain` now covers 15 rows. It is GREEN, and RED under the break with
  16 fixtures.

## Rows outside the brief that moved this pass (all played)

- **Moxie** (published FIRED, legacy, Intimidate): now FIRED on the planner with the knockout fixture and the idle
  twin. Board moved (C atk boost).
- **Natural Cure** (published **SHOWDOWN-ONLY**, planner and legacy, control Cloud Nine, board NO-DIVERGENCE): now
  **FIRED**. The new `carrier-switches-out` derivation makes the carrier actually switch out, and the published
  fixture never did. **The cause of the old SHOWDOWN-ONLY was not traced.** It came from a fixture that never
  reached Natural Cure's trigger, so the difference Showdown saw came from something else on that board, probably
  the control. That is written down here rather than assumed away.
- **Regenerator** (published FIRED, legacy): the planner fixture now switches out without prior damage, so the
  planner reads DID-NOT-FIRE and the row falls back to legacy FIRED, as before. A damage-first switch fixture is
  owed.
- **Aroma Veil**: DID-NOT-FIRE, as published.
- **Whole-population plan diff:** 914 of 964 identical, 33 fixtures and 9 controls moved, 8 trigger-text only, and 0
  refusals changed.

## PROPOSED NOTES ROW

```
## [<<VER>>] — 2026-09-19 — Force-fire B: every uncontrolled ability row gets a constructed control
- **What changed.** `engine/stage_planner.js`:
  - a second control chain that runs only where the first refused (each click read against its real user and
    target; trigger-click twin; setter or any-hit idle twin; switch withheld; residual escaped; escape item;
    pre-set field before a mega's arrival; spread twin);
  - trigger derivations read off tags and handlers (STAT_CALC damaging-only, typeImmunity with no handler,
    condStatMult, onHitProtect, onTerrainChange, weather delegate plus effectiveWeather readers, formeOnHit,
    punishesAttacker, formeOnMoveCategory, formeFollowsWeather, switchOutTrigger, preventsSwitch, OHKO knockout,
    boostsOnKO via Endure plus OHKO, hitsTwice, the Cud Chew re-eat).
  `engine/all_mechanics_fire.js`: `ab_board` and a request-leaf trap probe on A/B rows.
  `engine/medicham2-browser.js`: `switchTrapVerdict` exported (no behaviour change).
  `tests/test-stage-planner.js`: `k7SecondChain`, red under `STAGE_PLANNER_BREAK=no-second-chain`.
  `tests/test-red-run-writes.js` and `tests/probe_amf_default_populations.js` are green again.
- **Measured.** Worktree release `334a14dd8435`, `all_mechanics_fire.js --kind abilities --only <43 rows>` to
  scratch; the published artifact was not written. All 31 non-closeted formerly uncontrolled ability rows read
  FIRED with a control. In each, the authority's final board moves between the arms (Shadow Tag: the request's
  trapped flag), and ours moves on the same leaves. Every fixture and control arm reads NO-DIVERGENCE. Plan diff:
  914 of 964 mechanics identical.
- **Basis.** unchanged.
- **Supersedes.** In the next full `data/all-mechanics-fire.json`, ~~12 UNPROVEN-UNCONTROLLED / 20
  FIRED-UNCONTROLLED~~ become 1 / 0 (Illusion, closeted). Natural Cure ~~SHOWDOWN-ONLY~~ becomes FIRED on a fixture
  that reaches its trigger; the old reading's cause is not traced. Not measured on the published artifact until
  the battery is re-run.
- **Owed to the next major.** `docs/ABRA-technical-docs.md` (the instrument section: the second control chain and
  the request-leaf probe).
```

## OWED, NOT RUN

- **The full `all_mechanics_fire.js` battery and `engine/quarantine.js`**, on a re-cut of `334a14dd8435` in the
  main tree. Light mode forbade both. The battery is the only way the published artifact picks these rows up.
- **`tests/test-mechanics.js` (the census) was not regenerated.** The only engine change is one export; no
  mechanic's behaviour moved, so no census row should move. That is asserted, not measured.
- **Natural Cure's old SHOWDOWN-ONLY:** trace which line Showdown emitted and ours did not on the published fixture.
  It is a narration candidate and may be the Cloud Nine control's own announcement.
- **Regenerator:** a damage-then-switch planner fixture, so that the planner row, not the legacy ladder, carries it.
- **A knob-red for a silent row**, for example a `MEDI_*` switch that drops Fur Coat's multiplier, so that the
  fixture arm is shown reading STATE under it.
- **Illusion** stays closeted by Will.
