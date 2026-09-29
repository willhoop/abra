# Reg M-C interaction matrix: the off-gate and thrown rows (2026-09-29) — PAUSED, NOT FINISHED

Source artifact: `data/interaction-matrix-regmc.json` in the main checkout, generated 2026-09-29T21:21Z,
Showdown `f10d6798`, `--full`: 2328 run, 1683 live, 1683 agree, 1 ko, 2 threw, 2 off-gate.

Work stopped at Will's pause. **No file under `engine/` or `tests/` was edited. The engine did not
change, so no Reg M-C gate figure is invalidated by this pass.** All findings below were reproduced one
pair at a time (`IM.generate({depth: Infinity})` then `runState` on the single case; scratch driver, not
committed), `ABRA_REGULATION=regmc`, checkout `pokemon-showdown-mc`.

## Item 1 and item 3 are the same row

The single KO-TIMING row is `aurawheel -> weakarmor` (bucket `ko`). The brief listed it twice.

## Aura Wheel -> Weak Armor — UNDECIDED (leaning instrument: stat alignment or turn order), not fixed

Staging: Morpeko (Honey Gather, no item) clicks Aura Wheel at Skarmory; Skarmory clicks Iron Defense.
- medicham2: Skarmory is KO'd in BOTH arms (Weak Armor and the Honey Gather control) and Corviknight
  refills. `mediWitness` is empty — the KO is not about Weak Armor at all.
- Showdown: Skarmory survives in BOTH arms, hurt; control ends at Def +2 (Iron Defense landed), test
  arm at Def +1 / Spe +2 (Iron Defense +2, Weak Armor -1/+2).
So it is a whole-hit damage-size (or order) split independent of the reactor. The Weak Armor
arithmetic itself agrees wherever Skarmory survives.

Not yet decided, and these are the three things to read next:
1. **Turn order.** If Skarmory's Iron Defense lands before Aura Wheel in Showdown and after it (or not at
   all) in medicham2, +2 Def explains the survival. `runScript` aligns `storedStats` to medicham2's
   `buildMon` bodies (`tests/test-game-diff.js` `alignStats`), so speed should agree — check it on the
   staged board, including Aura Wheel's own Spe +1 and any Champions priority change.
2. **Damage.** Read the HP each engine leaves in the control arm (`mediHp`/`sdHp` from `collect`) and
   compare against `tests/test-engine-diff.js`'s owner for Aura Wheel (Morpeko Full Belly form, Electric,
   into Steel/Flying).
3. **Only then** read both checkouts' `aurawheel` handlers (`data/moves.ts` and
   `data/mods/champions/moves.ts` in `pokemon-showdown-mc`).
Scoreboard it would move if an engine defect: the matrix `ko` bucket (1 -> 0) and, if damage,
`tests/test-engine-diff.js`; the pinned pool likely not at all (Morpeko is rare).

## Gastro Acid -> Quick Claw — INSTRUMENT, diagnosed, not yet fixed

`.B.active[0].ability` medi `""` vs showdown `"honeygather"`, identical in both arms (so INERT on the
reference side — Quick Claw on the attacker changes nothing here). Cause: medicham2 implements Gastro
Acid by PARKING the ability (`abSuppress`, `engine/medicham2-browser.js` ~21630-21680:
`m._abParked = ab; m.ability = ''`), and states that `abilityOn(m)` is the identity read for the board's
`ability` leaf. Showdown keeps `pokemon.ability` and adds the `gastroacid` volatile. The matrix
projection `projMedi` in `tests/test-game-diff.js` (~line 145) reads raw `m.ability`, i.e. what can act,
not the identity Showdown's projection reads. `engine/board_state.js` already compares Gastro Acid as
volatile PRESENCE and reads identity, so the gate's board comparator is not affected.

This is the only state case in the Reg M-C matrix where Gastro Acid lands (`gastroacid -> goodasgold`
is blocked; `gastroacid -> disguise` is a damage-evaluator case), which is why no other row showed it.

Fix owed (instrument only, no engine change): in `projMedi`, `ability: norm(m._abParked != null ?
m._abParked : m.ability)` (or `M.abilityOn` if exported). Scoreboard: the matrix off-gate count 2 -> 1;
nothing else should move. Show the row red before and green after on the single pair.

## Curse -> Good as Gold, Curse -> Quick Claw (THREW) — HARNESS, diagnosed, not yet fixed

The generator picked a non-Ghost user (Venusaur) and admitted Curse because the dex `target` is
`normal`. The authority rewrites the REQUEST target for a non-Ghost user: `sim/pokemon.ts` ~999
(`case 'curse': if (!this.hasType('Ghost')) target = 'self'`), and the Champions mod's `curse.onModifyMove`
(`data/mods/champions/moves.ts` ~165) sets `move.target = 'self'` likewise. `sim/side.ts` ~671 then
rejects any target location: "You can't choose a target for Curse". Non-Ghost Curse is a self-boost, not
a foe-aimed carrier, so these two cases should never have been emitted with that user.

Fix owed (generator, `tests/interaction_matrix.js` ~673 and the `users`/atk-side `user` picks): evaluate
`NEEDS_FOE` against the target the authority's move request gives THIS user (mirror the
`getMoveRequestData` switch, citing its line), prefer a Ghost user for Curse, and drop with a named reason
if none learns it. Scoreboard: the matrix threw count 2 -> 0; the two pairs either go live against a Ghost
user or join the drop ledger. Check the Reg M-B matrix artifact for the same two rows before calling it a
Reg M-C trap for `docs/REGULATION-ROTATION.md`.

## OWED, NOT RUN

Resume from a clean worktree, Reg M-C, single pairs only (no full matrix, gate, differential, roster):

```bash
# reproduce each pair (driver: generate --full cases, pick one, runState it)
ABRA_REGULATION=regmc node -e "const T=require('./tests/test-interaction-matrix.js'),IM=require('./tests/interaction_matrix.js');const g=IM.generate({depth:Infinity});for(const k of ['gastroacid>quickclaw','aurawheel>weakarmor','curse>goodasgold','curse>quickclaw']){const [a,b]=k.split('>');const c=g.cases.find(c=>c.carrier.id===a&&c.reactor.id===b);console.log(k,c?JSON.stringify(T.runState(c)):'not emitted')}"
```

1. Gastro Acid: patch `projMedi` identity read; re-run the line above; expect `agrees: true`.
2. Curse: patch the generator's foe-aim test to the per-user request target; re-run; expect both rows
   either live against a Ghost user or dropped by name, and no `failure`.
3. Aura Wheel: dump `collect` HP and turn order for both arms; decide instrument vs engine; if engine,
   knob + probe red-on-knob before the fix, and state that every Reg M-C gate figure then needs a re-run
   on a new release (owed, not done here).
4. Then: RUNNING-NOTES row with `**Basis.**`, CHANGELOG-REGMC entry at the next free abra/regmc version
   (merge origin/main first), `docs/ENGINE.md`, `node engine/status.js --write`.
5. Owed to whoever holds the slot, not this pass: `ABRA_REGULATION=regmc node tests/test-interaction-matrix.js --full`
   to regenerate the artifact after 1 and 2 land.
