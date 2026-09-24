# The -ate abilities and Weather Ball — 2026-09-24 (abra/regmc 0.106.0, ENGINE)

Gate finding (0.87.0, release `ec377f6f8159`): **Pixilate parts boards** (Feraligatr HP: Showdown 924, MEDICHAM 894)
and **Refrigerate is unproven** (its control arm clicked a different move). Both staged rows used **Weather Ball**.

## 1. The rule, read from both checkouts

- `data/mods/champions/abilities.ts` overrides **none** of Pixilate, Refrigerate, Aerilate, Galvanize or Normalize in
  either checkout (`pokemon-showdown`, `pokemon-showdown-mc`). It carries only `dragonize: { inherit: true,
  isNonstandard: null }`. So mainline `data/abilities.ts` is the rule, identical in both.
- Each -ate handler, read in full: `onModifyTypePriority: -1`; `onModifyType` converts only when `move.type ===
  'Normal'` and the move is **not** on the literal `noModifyType` list (`judgment, multiattack, naturalgift,
  revelationdance, technoblast, terrainpulse, weatherball`), then sets `move.typeChangerBoosted = this.effect`.
  `onBasePowerPriority: 23`, `onBasePower` applies `chainModify([4915, 4096])` only when `typeChangerBoosted` is
  set. Normalize is the mirror (every move to Normal, list also has `hiddenpower` and `struggle`).
- So the multiplier is **[4915,4096] in the BasePower chain, unchanged from mainline**. STAB and effectiveness read the
  new type (`modifyDamage` in the Champions `scripts.ts` reads `move.type` after the events). An excluded move gets
  **no retype and no x1.2**, in any weather. A Normal move that converts is no longer Normal, so a Ghost is hit.
- Event order (`sim/battle-actions.ts` `useMoveInner`, identical in both checkouts): `singleEvent ModifyType` (the
  move's own, e.g. Weather Ball's sky) → `singleEvent ModifyMove` → `runEvent ModifyType` (the ability) →
  `runEvent ModifyMove`.

## 2. Scope, derived

TeamValidator over the legal species (strict filter plus `Future` re-admission):

| ability | Reg M-B holders | Reg M-C holders |
|---|---|---|
| Pixilate | Gardevoir-Mega, Altaria-Mega, Sylveon | same |
| Refrigerate | Glalie-Mega, Aurorus | same |
| Aerilate | Pinsir-Mega | Pinsir-Mega, Salamence-Mega |
| Dragonize | Feraligatr-Mega | same |
| Galvanize | none | none |
| Normalize | none | none |

Of the exclusion list only Weather Ball and Terrain Pulse are legal in either format. **Weather Ball** is learned by
Sylveon, Aurorus, Altaria and Glalie. **Terrain Pulse** is learned by no -ate holder. So the live defect is Weather
Ball on four holders, in both regulations.

## 3. The defect

`convertsMoveType` (tag_dex) carried `{converts, into, damageMult}` and not the list. `convertsMoveTypeTo` (the single
type authority for `dmgRange` and the battle loop's `effMoveType`) therefore converted Weather Ball. Result: a
no-weather Weather Ball became a boosted STAB Fairy/Ice hit, and hit a Ghost the authority is immune to. In sun or
rain the sky retyped it correctly but the x1.2 still applied.

## 4. The fix

- `engine/tag_dex.js`: `convertsMoveType` now also derives `except` from the handler's `noModifyType` literal (always
  written, `[]` for Liquid Voice).
- `data/tags.json`, `data/tags-regmc.json`: a regeneration in this worktree has no store, so every usage count reads
  zero. Per ROTATION row "Regenerating ... moves every usage-weighted block", the two files were regenerated to
  scratch, diffed structurally (tags and params of every move, item and ability, usage ignored), and **only** the
  five `convertsMoveType` params were spliced onto the committed files, line endings kept. The structural diff found
  **0** other differences in either regulation. `data/abra-tags.js` rebuilt; `build_tags_js.js --check` passes.
- `engine/medicham2-browser.js` `convertsMoveTypeTo`: a move on `except` gets no conversion (`MEDSEEN.ateExcludedMove`);
  a param without `except` is counted (`MEDFAILS.convertsExceptMissing`). Knob `MEDI_ATE_EXCLUSION_BLIND=1`.
- `tests/probe_pair.js`: new `runModifyType` option runs the four `useMoveInner` events before `moveHit`. It also now
  **refuses** an attacker ability with `onModifyType` without that option. Before, a Pixilate Body Slam went through
  as a Normal move on the authority side with no warning. Self-test and `tests/test-pinch-family.js` still green.

## 5. Proof

`tests/probe_ate_abilities.js`: the family and holders are derived; the cast is validated. Every row compares all 16 rolls
against the authority, subject ability and a quiet control (Illuminate, same body, same move). The CONVERTS rows
(Body Slam) need a LIVE knob. The EXCLUDED rows (Weather Ball in no weather / sun / rain into Feraligatr, and no weather
into Gengar) need a DEAD knob and MEDICHAM equal to the authority.

| run | Reg M-B | Reg M-C |
|---|---|---|
| pre-fix engine + tags (HEAD bytes) | 16 of 23 rows RED | 16 of 24 rows RED |
| fixed | 0 RED, exit 0 | 0 RED, exit 0 |
| fixed, `MEDI_ATE_EXCLUSION_BLIND=1` | 16 RED, exit 1 | 16 RED, exit 1 |

Pre-fix example rolls (Reg M-B, top to bottom): Sylveon Weather Ball, no weather, into Feraligatr: authority
29…24, MEDICHAM 52…43. Into Gengar: authority 0 on every roll, MEDICHAM 28…24. In sun: authority 42…36, MEDICHAM
51…43. Aurorus, no weather: authority 27…22, MEDICHAM 24…20 (Ice, resisted). Every Body Slam row agreed before and
after, so the type-and-power half was already right. Only the exclusion was missing.

**Refrigerate's control is now non-live.** It is the same Aurorus and Glalie-Mega with a quiet ability and the same
move. The Body Slam knob moves (Refrigerate 28…24 against Illuminate 32…27 into Feraligatr) and the Weather Ball knob
is dead in the authority.

Census row `convertsMoveTypeExcept` (tests/test-mechanics.js): a Pixilate Sylveon through a real `battleTurn` into a
Ghost. Body Slam > 0, no-ability Weather Ball 0, Pixilate Weather Ball 0. Under the knob it reads MISSING
(Weather Ball 39).

| census | before | after |
|---|---|---|
| `data/mechanics-census.json` (Reg M-B) | 1004 live | 1007 live, run_ok, 0 hollow. New rows: this one, plus two from earlier passes that the committed census lacked. **Parked** at `data/verification/mechanics-census-3cc68128f33d.json`, NOT published. The living-docs gate refused it because `docs/SUMMARY.md`, the deck and the technical docs cite the closed Reg M-B census; 0.87.0 made the same call. The fold-in is Will's decision. |
| `data/mechanics-census-regmc.json` | 1010 live | 1011 live, run_ok, 0 hollow |

No row went from live to dead in either census.

## 6. Pinned differential

`--steering empirical --arm middle --end-state --games 300`, and the same census pin and frozen pool on both arms
(the pool is read from the main checkout's `data/team-pool-frozen{-regmc}`, which is not in the worktree). The baseline
is the 0.87.0 gate release. The fix arm is a release cut from this tree.

| reg | arm | release | games | board-material |
|---|---|---|---|---|
| Reg M-C | baseline | `ec377f6f8159` | 259 | 0 |
| Reg M-C | fix | `7a1792f8f929` | 259 | 0 |
| Reg M-B | baseline | `7822a83cc49b` | 260 | 1 |
| Reg M-B | fix | `3cc68128f33d` | 260 | 1 (the same game) |

The Reg M-B divergence is the same game on both arms. It is seed `…2659015200 vs …2659155127`, turn 3, where MEDICHAM
has `p1.party.alakazam.item` empty and Showdown has `alakazite`. That divergence predates this change, has nothing to
do with the -ate abilities, and is not on any gate lattice (the lattices use 1200/1350/1950). There is no new board
divergence. As expected, the pool does not click an -ate Weather Ball, so this fix moves the lab
(the probe and the census) and does not move the pool.

## 7. Owed, not done here

- **The staged harness chose Weather Ball as the trigger for both abilities.** That is the move the handler skips. On
  this engine the Pixilate arm (control: Cute Charm) will correctly show the ability as inert, so the "mechanics
  staged" clause will not read it as FIRED. The planner (`engine/stage_planner.js` / `engine/all_mechanics_fire.js`)
  must choose a trigger that is not on `convertsMoveType.except`. Refrigerate's control must be the same move with
  the ability removed. This is instrument work, not ENGINE work.
- The census, roster and staged harness must be re-read on a release cut after this change.
- In this worktree, a Reg M-B `tag_dex` run exits 1 with "12 tag(s) matched nothing". The worktree has no store, so
  every usage count is zero. The printed regeneration was not committed, so this is not a result.

## 8. Incident

The session scratchpad is shared. During this pass another agent's runner (`worktree agent-aace036dabfd3b91c`)
overwrote `scratchpad/low.js`. Every run of this pass wrote a `##EXIT` line to its own log, which the other runner
does not do. The fix-arm release `7a1792f8f929` was checked to be in this worktree's `data/releases` and to hold the
fixed engine bytes. So no run of this pass executed the other agent's script. The remaining runs used
`scratchpad/ate-ae31/`.

**The same collision cost the other agent something.** This pass wrote `scratchpad/legal.js`, `scratchpad/low.js`
and `scratchpad/gdsum.js` with the Write tool, and each write reported "updated", not "created". So a file with that
name was already there, very probably the other session's, and this pass overwrote its contents. The other agent
has since rewritten `low.js`. Whatever `legal.js` and `gdsum.js` held before is lost, and it may be that session's
work. **Lesson: create a private sub-directory in the scratchpad before the first write, and treat an "updated" on a
new file name as a collision.**
