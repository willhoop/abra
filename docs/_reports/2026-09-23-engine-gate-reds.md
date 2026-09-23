# ENGINE pass 9: the engine reds the gate run found. 2026-09-23 (abra/regmc 0.71.0 to 0.77.1)

Branch `worktree-agent-a99602fa9a4f15c96`, based on main `7fa84fe6` (CHANGELOG-REGMC 0.70.0). The gate was read on
Reg M-B release `89ac57f1f81b` and Reg M-C release `485d0a6840ad`
(`docs/_reports/2026-09-23-gates-on-finished-engine.md`). The authorities were
`C:/Users/willj/Projects/Pokemon/pokemon-showdown` (Reg M-B) and `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc`
(Reg M-C). For every cause the Champions mod (`data/mods/champions/`) was read first, and then the whole mainline
handler.

Every engine fix has a `MEDI_*` knob and a probe. Each probe is red under its knob. Each is red on the prior release
with the 0.70.0 engine bytes (`--release 89ac57f1f81b|485d0a6840ad --medi <HEAD 7fa84fe6 medicham2-browser.js>`). Each
is green clean. `data/tags.json` is byte-identical after every commit. That was checked every time by regenerating it
with `engine/tag_dex.js` into a copy and diffing the params and tags of every move, ability and item row: 0 rows
differ, and the committed file was restored. Every Reg M-C tag change is a key written ONLY when true, on a row that
has no Reg M-B carrier or does not exist in Reg M-B. `data/protocol-events.json` and `data/move-effects.js` were not
touched. No `status.js --write` was run. Nothing was pushed.

## Commits

| version | item | cause (authority, read) | fix | knob | proof |
|---|---|---|---|---|---|
| 0.71.0 | 1 | Reg M-B `onAfterHit` of Stone Axe / Ceaseless Edge asks `!move.hasSheerForce && source.hp` (data/moves.ts :18072-18078, :2229-2235); Reg M-C's asks only `!move.hasSheerForce` (:18078-18084, :2229-2235). Both Champions `spreadMoveHit` raise AfterHit with no HP test. 0.60.0 read only the M-C checkout | `hazardOnHit.laysForFaintedUser` read off the handler (Reg M-C only); the engine lays for a fainted user only on it | `MEDI_HAZARD_ON_HIT_FAINTED_ALWAYS` | `tests/probe_regmc_hazard_on_hit_fainted_user.js` (now both regulations, both moves; Reg M-B has no legal toll item, so finer chip steps were added) and a census row `hazardOnHit` |
| 0.72.0 | 2 | Multiscale is `onSourceModifyDamage: if (target.hp >= target.maxhp) chainModify(0.5)` (data/abilities.ts, both, no override), asked per arrival. `dmgRange`'s flat road cut every arrival. The BATTLE was already right (per-arrival re-price) | `_volleyFullHPSplit`, price road only | `MEDI_VOLLEY_SHIELD_EVERY_ARRIVAL` | `tests/probe_volley_first_hit_shield.js` SCALE: authority 19 then 39, control 39 then 39, price 58 = 58 (was 38) |
| 0.73.0 | 2 | Reg M-B's Champions Disguise (data/mods/champions/abilities.ts:14-33) holds `effectState.neutral` for the whole volley; Reg M-C's mod has no disguise entry, so mainline (:970-1016) asks the species on every arrival and the busted forme takes its real matchup | `flattensTypeMatchup.endsWithSpecies` (Reg M-C only). Reg M-B battle: hold (`_flatHeld`). Reg M-C price: priced on the busted forme. Reg M-C narration: `-resisted` re-read at the bust | `MEDI_DISGUISE_VOLLEY_OLD` | same probe, DISGUISE: Reg M-B board 97 = 97 (was 110); Reg M-C price 4 = 4 (was 17) and the protocol matches |
| 0.74.0 | 3 | Guard Dog `onTryBoost` deletes the drop and calls `this.boost({atk: 1}, target, target, null, false, true)` | `preventsStatDrop.answersWith`; the refusal answers through `abilityBoostRun` | `MEDI_GUARD_DOG_REFUSES_ONLY` | `tests/probe_intimidate_reactors.js` GUARDDOG and a census row |
| 0.75.0 | 3 | Rattled `onAfterBoost`: `if (effect?.name === "Intimidate" && boost.atk) this.boost({spe: 1})`. The `boostsWhenLowered` derivation demanded a `< 0` and dropped it | `boostsWhenLowered.onlyFrom/whenStat/quietAtCap`; only the Intimidate road passes the gate | `MEDI_RATTLED_IGNORES_INTIMIDATE` | same probe, RATTLED, and a census row |
| 0.76.0 | 3 | the Reg M-C refusers write `-fail|…|unboost|atk` (innerfocus :2160; 'def' for Big Pecks); Reg M-B writes 'Attack' (:2150). `STAT_LABEL` is Reg M-B's spelling | `preventsStatDrop.failLabel` where the literal is a stat id | `MEDI_REFUSAL_LABEL_DISPLAY` | same probe, 4 arms, and a census row; the existing refusal-announce census row now reads its label off the authority |
| 0.77.0 | 4 | fixtures (below) | `engine/stage_planner.js` trigger shapes; the scope's re-admissions in the planner and in `all_mechanics_fire` | — (instrument) | `all_mechanics_fire --only` the seven |
| 0.77.1 | — | `tests/probe_narration_d.js` typed Reg M-B's 'Attack' in two fixture shape checks | reads Hyper Cutter's label off the selected authority | — | green in both |

## 1. Stone Axe / Ceaseless Edge after the user faints (Reg M-B held-out)

The suspicion was right, and the cause was sharper than "double-laying". The 0.60.0 fix was correct for Reg M-C and
wrong for Reg M-B, because the two checkouts' handlers differ. Stone Axe is the same handler, and it is now staged in
both regulations (Reg M-B: Kleavor, brought to 10/145 by Garchomp's Shadow Claw and Goodra-Hisui's Dragon Claw, then
knocked out by Rough Skin). Every other hit-driven hazard (Rapid Spin, Mortal Spin) has the same handler in both
checkouts, and 0.61.0 is unchanged.

## 2. Volleys into Multiscale and Disguise; Overdrive

- Multiscale: the price only; the battle already re-priced per arrival.
- Disguise: three defects in one mechanic. **One of them is a pre-existing Reg M-B BOARD defect**: a multi-hit into a
  Mimikyu that the Champions handler holds neutral was re-priced at its real matchup after the bust. No instrument had
  staged it.
- Engine-diff under Reg M-C on the interim bytes (Multiscale fixed only): 3 → 1. On the final bytes: 0/6000.
- **Overdrive: STOPPED.** `SUBPASS` is a hand-copied snapshot of the `bypasssub` flag, and no artifact the engine reads
  carries that flag. Deriving it needs a per-move tag in `engine/tag_dex.js`, and that adds a catalogue row (and 51
  member rows) to Reg M-B's `data/tags.json`. Hand-adding `overdrive` is the thing the brief forbids. `sound` is no
  proxy either: Clangorous Soul is a sound move without `bypasssub` in both checkouts. The damage differential
  therefore still exits 1 under Reg M-C, on this conformance clause alone.

## 3. The Intimidate reactors, and why the roster and the mechanics instrument disagreed

Neither instrument was wrong about what it reads. They read different things:

- **Inner Focus, Oblivious, Own Tempo, Scrappy (and Big Pecks):** narration only. The roster's
  `ability/stat-drop-reaction` rule grades BOARDS, and the boards were right. `all_mechanics_fire` also compares the
  protocol line, and the refusal label was Reg M-B's spelling. So the roster was right and blind to the line.
- **Guard Dog and Rattled:** real board defects. The roster's shape rule stages ONE handler per ability: Guard Dog as
  `ability/refuses-a-forced-switch` (a Roar, `onDragOut`) and Rattled as `ability/speeds-up-when-hit-by-a-type` (a
  Crunch, `onDamagingHit`). Neither stages the Intimidate half (`onTryBoost` / `onAfterBoost`), so their
  FIRED-AND-BOARDS-MATCH is true only of the half they staged. `all_mechanics_fire` saw the Intimidate half and was
  right.
- The coordinator's lead (the `'atk'` literal at :2160) was confirmed by the probe. The fix is derived off each
  checkout's handler and never keyed on the regulation id.

## 4. The seven unproven Reg M-C mechanics

Each fixture gap is a claim about the fixture. Each one was constructed in `engine/stage_planner.js` off a handler or
a tag param:

| mechanic | why it could not fire | fixture now | verdict on `ca7aa5f578ed` |
|---|---|---|---|
| Liquid Ooze | `onSourceTryHeal`: the planner made the HOLDER drain | the receiver drains the holder (TryHeal runs before the full-HP test) | FIRED, control Gluttony |
| Stakeout | nobody switched | the receiver switches in; the holder hits the arrival | FIRED, control Guard Dog |
| Binding Band | no handler; read in `partiallytrapped`'s onStart | the holder clicks a move applying that volatile (Aggron, Sand Tomb) | FIRED, control: no item |
| Emergency Exit | no control (Golisopod has one ability) | Super Fang from full; control = the receiver's Protect | FIRED, control R.click@1 |
| Aura Guard | NO ROW: the scope re-admits it, and both the planner and `all_mechanics_fire` kept the strict filter | both take the scope's re-admissions | FIRED, control R.click@1 |
| Revival Blessing | nobody had fainted | the partner Healing Wishes first (userFaints, self-aimed) | resolved on both, board clean |
| Court Change | no side condition up | the receiver raises Reflect first | **resolved on the authority only; board STATE** |

**Court Change is an engine gap: STOPPED.** MEDICHAM has no Court Change handler at all (there is no tag and no code).
The authority moves Reflect to the other side, and ours leaves it. The fix needs a derived `swapsSideConditions`-style
tag (the list is the handler's own literal), and a new tag adds a catalogue row to Reg M-B's `data/tags.json`.

The Reg M-B plan is unchanged: 964 mechanics and 0 changed fixtures, measured by diffing the plan before and after with
the same tags. `tests/test-stage-planner.js` is green in both regulations after its population learned the scope's
re-admissions.

## Re-runs on the final engine (Reg M-B `56fc6976821e`, Reg M-C `ca7aa5f578ed`)

Everything was written to `data/verification/*.pass9*.json`. Nothing published was rewritten.

| instrument | release | before (gate run) | after (this pass) | artifact |
|---|---|---|---|---|
| damage differential Reg M-C, `--n 6000 --seed 20260804` | live tree = `ca7aa5f578ed` | 3/6000, exit 1 | **0/6000**; still exit 1 on the Overdrive conformance alone | `data/verification/engine-diff-regmc.pass9.json` |
| damage differential Reg M-B, same flags | live tree = `56fc6976821e` | 0/6000 | 0/6000, exit 0 | `data/verification/engine-diff.pass9.json` |
| census Reg M-B (`tests/test-mechanics.js`) | live tree | 1004/1004 | **1006/1006** (+Stone Axe fainted user, +refusal label) | worktree run, restored; not republished |
| census Reg M-C | live tree | 1006/1006 | **1010/1010** (+Stone Axe, +Guard Dog, +Rattled, +refusal label) | worktree run, restored; not republished |
| `all_mechanics_fire --kind all` Reg M-C | `ca7aa5f578ed` | in-scope unproven: moves 2, abilities 4, items 1; diverging abilities 8 | unproven: moves 1 (Court Change), abilities 0, items 0; diverging abilities 1 (Illusion, declared) | `data/verification/all-mechanics-fire-regmc.pass9.json` (4,867 games, 0 threw) |
| `all_mechanics_fire --kind all` Reg M-B | `56fc6976821e` | unproven 0; diverging 1 ability (Illusion) | unchanged | `data/verification/all-mechanics-fire.pass9.json` (4,632 games, 0 threw) |
| lattice Reg M-C `--games 1200` | `ca7aa5f578ed` | 0/954 board-material, 64 protocol-only | **0/954**, 26 protocol-only (1 void) | `data/verification/game-differential.pass9.regmc.g1200.json` |
| lattice Reg M-C `--games 1600` | `ca7aa5f578ed` | 0/1266, 82 | **0/1266**, 38 | `…pass9.regmc.g1600.json` |
| lattice Reg M-C `--games 1900` | `ca7aa5f578ed` | 0/1497, 92 | **0/1497**, 41 | `…pass9.regmc.g1900.json` |
| lattice Reg M-B `--games 1200` | `56fc6976821e` | 0/961, 0 | 0/961, 0 | `…pass9.mb.g1200.json` |
| lattice Reg M-B `--games 1350` | `56fc6976821e` | 0/1069, 1 | 0/1069, 1 | `…pass9.mb.g1350.json` |
| lattice Reg M-B `--games 1950` | `56fc6976821e` | 0/1497, 2 | 0/1497, 2 | `…pass9.mb.g1950.json` |
| **Reg M-B held-out `--games 12000`** | `56fc6976821e` | **1/7182** (Ceaseless Edge) | **0/7182** (1 void, 73 protocol-only) | `…pass9.mb.g12000.json` |

The lattice pins are the gate's: `--steering empirical --arm middle --end-state`, the census pins
`data/verification/census-pin-833a997d7e42.json` / `census-pin-regmc-0d03e83f0e65.json`, and the frozen team stores
read from main's `data/team-pool-frozen{,-regmc}`. Those stores are ignored and absent from the worktree, and the
first attempt against the worktree path played 0 games; it was caught and re-run. The samples match the gate's
(954+1 void, 1266, 1497, 961, 1069, 1497 and 7182+1 void). The Reg M-C protocol-only drop is the refusal label: the
gate's triage put about three fifths of the Reg M-C narration games on that one line shape.

## Also run

- All 43 `tests/probe_regmc_*.js` under Reg M-C: green.
- The volley, re-price and Disguise probes (`probe_arrival_drift_zero`, `probe_arrival_reprice`, `probe_volley_collapse`,
  `probe_multihit_*`, `test-multihit-*`) are green in both regulations.
- `probe_ability_boost_announce`, `probe_charge_turn_protean` and `probe_protean_contrary` are green in both.
- `probe_narration_d` is green in both after 0.77.1.
- Found RED and not mine (pre-existing on HEAD, reported, not touched):
  - `tests/probe_disguise_crit.js --regulation regmc` has 3 reds. It asserts the Reg M-B Champions disguise override
    exists.
  - `tests/probe_volley_collapse_clamp.js` reads CANNOT ANSWER in both regulations (a stale pinned release and a
    protocol-events digest).
  - `tests/probe_ability_zero_boost_line.js --regulation regmc` throws (its harness resolves the Reg M-B checkout).

## OWED, NOT RUN

- **STOPPED, needs a Reg M-B `data/tags.json` change (a decision):** the Court Change engine implementation and
  Overdrive in `SUBPASS`. Each needs a new derived tag, and so a new catalogue row in Reg M-B's tags.
- **MEASURE:** republish from main: both censuses, `engine-diff{,-regmc}`, `all-mechanics-fire{,-regmc}`, the
  lattices and the Reg M-B held-out draw, on releases cut in main from this branch's tree. `status.js --write` from
  main.
- **MEASURE (roster):** the Guard Dog and Rattled roster rules stage one handler each. The Intimidate half of each is
  unstaged in the roster (it is staged here, in the census, the probe and `all_mechanics_fire`).
- **Not mine (left as briefed):** roster fixture-legality refusals, the `tests/roster.js` Hidden Power parse crash,
  the Reg M-C narration baseline, and the Reg M-C register audit.
- The three pre-existing reds under "Also run".
- Releases `56fc6976821e`, `ca7aa5f578ed` and the interim ones (`da59231d7348`, `0fd078bba8bc`, `2e4088e6e240`,
  `878d0bb09c18`, `6bd6cd15bbb1`, `00ae3fdf0a09`, `344512bddacd`, `42a80e6bb9c4`, `f952e0bd131b`, `de08764b7be4`) are
  in the worktree's ignored `data/releases/`. `data/engine-release.json` and `data/engine-release-regmc.json` were
  modified by the cuts and are NOT committed.
- Not pushed.
