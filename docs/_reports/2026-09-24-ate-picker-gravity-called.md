# The staged harness's -ate trigger, and Gravity's called-move half — 2026-09-24 (ENGINE)

Worktree branch `worktree-agent-a222541d6335eb8a2`, reset onto `f9052917` (abra/regmc 0.106.0, the -ate engine fix) before
any edit: the worktree had been created on `fb138058`, which does not contain that commit. Scratch:
`scratchpad/agent-a222541d/` only. Heavy runs went through `cmd.exe /c tools\lownode.cmd` (a spawnSync argv, see
`scratchpad/agent-a222541d/run.js`); every log ends in a `##EXIT` line.

## Task 1 — the move picker chose the one Normal move the -ate handler skips (abra/regmc 0.107.0)

### 1.1 The defect

`fixture_preflight.cuesOf` derived Pixilate's need as `type=Normal` and nothing else. `stage_planner.triggersOf` then
copied only `{kind, values, damagingOnly}` off each need. So any Normal move met it, including Weather Ball, which is on
the handler's own `noModifyType` literal. The planner staged:

| artifact | Pixilate trigger | Refrigerate trigger |
|---|---|---|
| committed `data/all-mechanics-fire.json` (Reg M-B, older planner) | Hyper Voice | Hyper Voice |
| committed `data/all-mechanics-fire-regmc.json` | **Weather Ball** | **Weather Ball** (control: Ancient Power) |
| this tree, exclusion blinded, **both** regulations | **Weather Ball** | **Weather Ball** |

On the fixed engine (0.106.0) the Weather Ball arm for Pixilate reads **DID-NOT-FIRE** on the planner stage (both
layouts). The row still printed FIRED only because the legacy fallback (`stage: legacy-fallback`, Body Slam from the
safe pool) rescued it. So the planner's own verdict was the defect, and the published row hid it.

### 1.2 The fix (derived, no list)

- `engine/fixture_preflight.js` `excludedMoveIds(src, guards)`: reads three shapes off the handler text, a literal list
  bound to a name and tested with `<name>.includes(move.id)`, an inline `[...].includes(move.id)`, and
  `move.id ===/!== "<id>"`. It uses the flags' `polarity` rule: an id is an EXCLUSION when it is seen in a guard and is
  not required. `cuesOf` attaches the list as `except` to every need that handler emits. `satisfiesNeed` refuses a move
  on `except`. Knob `FIXTURE_PREFLIGHT_EXCLUSION_BLIND=1` drops the list.
- `engine/stage_planner.js` `triggersOf`: carries `except` onto the click need (it was the line that dropped it).
- `engine/all_mechanics_fire.js` needed no edit. Its legacy stage calls `PRE.moveNeeds` / `PRE.satisfiesNeed` directly.

### 1.3 Every handler that excludes a move id (printed by the probe, both regulations identical)

| handler | excluded | carried on a need? |
|---|---|---|
| Pixilate / Refrigerate / Aerilate / Dragonize / Galvanize `onModifyType` | judgment, multiattack, naturalgift, revelationdance, technoblast, terrainpulse, weatherball | yes, `type=Normal` |
| Normalize `onModifyType` | the same + hiddenpower, struggle | no need (converts every type); no legal holder |
| Magician `onAfterMoveSecondarySelf` | fling | no need |
| Cursed Body, Gorilla Tactics (x2), Wonder Guard | struggle (+ skydrop) | no need |

Dazzling, Queenly Majesty, Armor Tail (`!targetAllExceptions.includes(move.id)` in a bare return) and Stance Change
(`move.id !== "kingsshield"`) read as REQUIRED ids, not exclusions, and are correctly left out. The only rows the
picker could steer onto an excluded move "in the same way" are the five -ate abilities, four with a legal carrier
(Galvanize has none). Magician is the one need-less row with a stageable excluded move (Fling). Its fixture clicks
Facade on both committed artifacts, so it is not live. The exclusion cannot steer a need-less pick. That is a gap,
named here and printed by the probe, not wired.

### 1.4 Proof

`tests/probe_ate_picker.js` plans every derived row with the real planner (no games) and asserts that the carrier's
click is off every `except` list and meets the need:

| run | Reg M-B | Reg M-C |
|---|---|---|
| fixed | 4 fixtures, 0 RED, exit 0 (Pixilate / Refrigerate Hyper Voice, Aerilate Facade, Dragonize Mega Kick) | 4 fixtures, 0 RED, exit 0 |
| `FIXTURE_PREFLIGHT_EXCLUSION_BLIND=1` | 2 RED (Pixilate, Refrigerate click weatherball), exit 1 | 2 RED, exit 1 |

The staged instrument, `engine/all_mechanics_fire.js --kind abilities --only pixilate,refrigerate,aerilate,dragonize
--write --out <scratch>`, on the fixed-engine releases (`3cc68128f33d` Reg M-B, `7a1792f8f929` Reg M-C, the 0.106.0
tree):

| reg | arm | Pixilate | Refrigerate | Aerilate / Dragonize |
|---|---|---|---|---|
| M-C | blind | FIRED via **legacy-fallback**; planner DID-NOT-FIRE on Weather Ball | planner, Weather Ball vs Ancient Power | planner FIRED |
| M-C | fixed | **planner FIRED**, Hyper Voice, Cute Charm control, NO-DIVERGENCE, authority 873 vs 912 | planner FIRED, Hyper Voice vs Blizzard, NO-DIVERGENCE | planner FIRED, NO-DIVERGENCE |
| M-B | blind | FIRED via legacy-fallback; planner DID-NOT-FIRE on Weather Ball | planner, Weather Ball | not run |
| M-B | fixed | planner FIRED, Hyper Voice, NO-DIVERGENCE | planner FIRED, Hyper Voice vs Blizzard, NO-DIVERGENCE | planner FIRED |

The first run of the fixed arm matched the blind arm byte for byte, because the need still lost `except` inside
`stage_planner.triggersOf`. That is the "identical results across a varied knob" signature, and it is how the second
dropped field was found.

`tests/test-stage-planner.js` (full, with every red demonstration): GREEN in both regulations (Reg M-B 147 s).

### 1.5 Not done, and why

- **Refrigerate's control is still a move swap** (Hyper Voice → Blizzard, "the second chain"), because the planner
  rejects the ability-swap control: Aurorus's other ability, Snow Warning, writes state on its own. That is a
  weaker control than an ability swap, but it is the planner's documented fallback. It is not the picker defect.
  `tests/probe_ate_abilities.js` carries the same-move quiet control (Illuminate) for exact rolls.
- The committed `data/all-mechanics-fire*.json` artifacts are not rewritten. They belong to the instrument's full
  run, and a four-row `--only` run must not overwrite them.

## Task 2 — Gravity refuses a gravity-flagged move, called or chosen (abra/regmc 0.108.0)

### 2.1 The rule, read from both checkouts

`data/moves.ts` `gravity.condition` is identical in `pokemon-showdown` and `pokemon-showdown-mc`, and
`data/mods/champions/` overrides nothing of Gravity (only learnsets). It has two refusals with one body:

    onBeforeMovePriority: 6,
    onBeforeMove(pokemon, target, move) { if (move.flags['gravity'] && !move.isZ) { this.add('cant', pokemon, 'move: Gravity', move); return false; } },
    onModifyMove(move, pokemon, target)  { if (move.flags['gravity'] && !move.isZ) { this.add('cant', pokemon, 'move: Gravity', move); return false; } },

`sim/battle-actions.ts` is identical in both. `runMove` runs `BeforeMove` for the move a body CHOSE. A caller's
`this.actions.useMove(id, pokemon)` goes to `useMoveInner`, which skips BeforeMove, makes the called move the active
move, and runs `runEvent('ModifyMove')`. A false there returns before the `|move|` line. `runAction`'s bare
`clearActiveMove()` then commits the refused called move as `battle.lastMove`. A chosen move refused at BeforeMove
calls `clearActiveMove(true)` and never becomes the last move.

### 2.2 Which callers are legal (derived by the probe, both regulations)

The dex's move callers (`actions.useMove(` in a handler) are Metronome, Assist, Me First, Mirror Move and Nature Power.
All five are `isNonstandard: 'Past'` in both regulations. The other two are **Copycat and Sleep Talk, both legal in
both**. Magic Bounce also calls `useMove`, but the only gravity-flagged status move, Magnet Rise, targets self and is
not reflectable, so it cannot reach this path. The gravity-flagged moves in the regulation are Bounce, Fly, Flying
Press, High Jump Kick and Magnet Rise. Sleep Talk skips Bounce and Fly (`charge` / `nosleeptalk`). A Copycat reaches
the refused called move through `battle.lastMove`. The authority shows this in the COPYCAT arm below.

### 2.3 What MEDICHAM did

Neither half was wired. No artifact carried the move flag `gravity`, and nothing in the engine read it. So:
- a Sleep Talk under Gravity played High Jump Kick (the called half, `onModifyMove`);
- a Copycat after it copied and played High Jump Kick again;
- a body that chose Bounce the turn Gravity went up started its charge and spent the PP (the chosen half,
  `onBeforeMove`).

The menu half (`onDisableMove`) is separate. It is still open and on the ENGINE hand list.

### 2.4 The fix

- `engine/tag_dex.js`: new move tag `refusedByPseudoWeather {by:[{pseudoWeather, flag, line, beforeMove, modifyMove,
  exceptZ}]}`. It is derived from every legal pseudo-weather setter whose condition's `onBeforeMove` / `onModifyMove`
  writes `add('cant', ..., '<line>', move); return false` behind `move.flags['<flag>']`. No name is typed. Members,
  printed before wiring: bounce, fly, flyingpress, highjumpkick, magnetrise (5, both regulations; Reg M-C usage 109).
- `data/tags.json`, `data/tags-regmc.json`: the tag file cannot be regenerated wholesale from a worktree (usage).
  Each was regenerated to scratch and structurally diffed, with usage ignored. The catalogue row and the 5 member rows
  were spliced onto the committed file, with its line endings kept. Diff result:
  - Reg M-C: 0 other differences.
  - Reg M-B: 0 entity differences, plus 11 catalogue rows that exist only in the regeneration (tags that match
    nothing in Reg M-B, such as `revivesFainted` and `poppedOnHit`). Those rows were NOT spliced.
  - `data/abra-tags.js` rebuilt; `build_tags_js.js --check` passes.
- `engine/medicham2-browser.js` `pseudoWeatherRefusal(mvId, field, called)` reads the tag. `called` picks the half.
  A pseudo-weather with no field clock is counted (`MEDFAILS.pseudoWeatherRefusalUnmapped`). It is asked at Heal
  Block's site: above the kind dispatch, and reached by a `_copied` (called) action as well as a chosen one. It writes
  `|cant|<body>|move: Gravity|<move>`, sets `_mvRes=false`, spends no PP and sets no `_lastMove`. A CALLED move
  refused here replaces the caller's pending last move, so Copycat sees it.
- Knobs: `MEDI_GRAVITY_CALLED_MOVE_PLAYS=1` (the called half) and `MEDI_GRAVITY_CLICKED_MOVE_PLAYS=1` (the chosen half).
- Order caveat, not changed: this site sits below the engine's sleep / flinch / confusion / paralysis gate. The
  authority orders Gravity (6) above confusion (3) and paralysis (1). Throat Chop and Heal Block have the same
  inexactness. It changes nothing unless a confused or paralysed body clicks a gravity-flagged move under Gravity.

### 2.5 Proof — `tests/probe_gravity_called_move.js`

The cast is derived: Tsareena (Sleep Talk + High Jump Kick only, so Sleep Talk has one candidate), Sylveon Yawn,
Glaceon Gravity, Samurott Copycat (slower), and Stunfisk choosing Bounce after Glaceon's Gravity. Every set is
validated by the regulation's TeamValidator. The authority's own stream is asserted first on every arm:
- SLEEPTALK: `|cant|p1a: Tsareena|move: Gravity|High Jump Kick`, with no `|move|` line for the called move.
- COPYCAT: `|cant|p1b: Samurott|move: Gravity|High Jump Kick`.
- CONTROL (no Gravity): the called move lands, so the knob is live in the authority.
- DIRECT: `cant ... Bounce`.

| run | Reg M-B | Reg M-C |
|---|---|---|
| pre-fix engine bytes (`--medi` = HEAD `f9052917` engine) | 6 RED, exit 1: SLEEPTALK boards `sylveon.hp` 96 vs 170, COPYCAT 44 vs 170, DIRECT `vol.charging` 1 vs 0 and `pp.bounce` 1 vs 0 | 6 RED, exit 1, same |
| fixed (release `f801ab8410ce` / `7105842356a2`) | green, every assertion, exit 0 | green, exit 0 |
| `MEDI_GRAVITY_CALLED_MOVE_PLAYS=1` | 4 RED (SLEEPTALK, COPYCAT), exit 1 | 4 RED, exit 1 |
| `MEDI_GRAVITY_CLICKED_MOVE_PLAYS=1` | 2 RED (DIRECT), exit 1 | 2 RED, exit 1 |

The comparison folds one declared narration difference. The authority's called-move `|move|` line carries
`[from] move: Sleep Talk` and this engine's does not. The driver's first-divergence field is NONE on the CONTROL arm,
where that is the only difference.

### 2.6 Census

New census row `move/refusedByPseudoWeather` in `tests/test-mechanics.js`, through a real `battleTurn`. The body is a
sleeping Sleep Talk with High Jump Kick as its only other move.
- No Gravity: 31 dealt, so the called move lands.
- Under Gravity: 0 dealt, with the cant line.
- High Jump Kick chosen under Gravity: 0 dealt, with the cant line.

| census | before | after |
|---|---|---|
| `data/mechanics-census-regmc.json` | 1011 live | **1012 live**, run_ok, 0 missing, 0 hollow |
| Reg M-B on this tree | 1007 (0.106.0's parked census) | **1008 live**, parked at `data/verification/mechanics-census-f801ab8410ce.json` |

The published `data/mechanics-census.json` stays at HEAD (1004). This is the call 0.87.0 and 0.106.0 made, because the
closed Reg M-B documents cite that file. No row went from live to dead in either regulation.

### 2.7 Not run

- No pinned whole-game differential this pass. The change can act only while `field.gravity > 0` and one of five
  moves (Reg M-C sheet usage 109) is chosen that turn or called. Only two things reach it: a choice made before
  Gravity went up the same turn, and a Sleep Talk or Copycat. The probe shows both moving the board toward the
  authority. Whether the pinned pool contains either is not measured here; the next pinned run will say.
- `node engine/status.js --write` was NOT run. From a worktree it writes missing untracked files as fact (the memory
  note "status.js --write corrupts from a worktree"). The coordinator runs it after the merge.
