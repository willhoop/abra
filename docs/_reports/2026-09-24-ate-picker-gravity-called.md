# The staged harness's -ate trigger, and Gravity's called-move half — 2026-09-24 (ENGINE)

Worktree branch `worktree-agent-a222541d6335eb8a2`, reset onto `f9052917` (abra/regmc 0.88.0, the -ate engine fix) before
any edit: the worktree had been created on `fb138058`, which does not contain that commit. Scratch:
`scratchpad/agent-a222541d/` only. Heavy runs went through `cmd.exe /c tools\lownode.cmd` (a spawnSync argv, see
`scratchpad/agent-a222541d/run.js`); every log ends in a `##EXIT` line.

## Task 1 — the move picker chose the one Normal move the -ate handler skips (abra/regmc 0.89.0)

### 1.1 The defect

`fixture_preflight.cuesOf` derived Pixilate's need as `type=Normal` and nothing else. `stage_planner.triggersOf` then
copied only `{kind, values, damagingOnly}` off each need. So any Normal move met it, including Weather Ball, which is on
the handler's own `noModifyType` literal. The planner staged:

| artifact | Pixilate trigger | Refrigerate trigger |
|---|---|---|
| committed `data/all-mechanics-fire.json` (Reg M-B, older planner) | Hyper Voice | Hyper Voice |
| committed `data/all-mechanics-fire-regmc.json` | **Weather Ball** | **Weather Ball** (control: Ancient Power) |
| this tree, exclusion blinded, **both** regulations | **Weather Ball** | **Weather Ball** |

On the fixed engine (0.88.0) the Weather Ball arm for Pixilate reads **DID-NOT-FIRE** on the planner stage (both
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
--write --out <scratch>`, on the fixed-engine releases (`3cc68128f33d` Reg M-B, `7a1792f8f929` Reg M-C, the 0.88.0
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
