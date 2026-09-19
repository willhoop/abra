# Sucker Punch into an Encored click, and Focus Sash against a Future Sight payout — 2026-09-19, ENGINE

A findings record, not a living document. Superseded by the register rows it feeds; not cited as current
state. `node engine/status.js` holds the current state.

Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a2e79feda63abf996`, branch
`worktree-agent-a2e79feda63abf996`, on HEAD `86ccc49e` (6.54.0). LIGHT MODE. No lattice run, no roster stage, no
`quarantine.js` and no `all_mechanics_fire`. No git command other than `git restore` of two data files that my own
probe runs had rewritten (see §5).

---

## 0. VERDICT

| lead | true? | fixed? | probe + knob | replay on `edddcbcfb0c7` |
|---|---|---|---|---|
| 1. Sucker Punch into an Encored Swords Dance (g1350 `…2636045527`, t15) | **TRUE**, and it is a class of two defects | yes | `tests/probe_sucker_reads_queued_move.js`. Knobs `MEDI_SUCKER_READS_PRE_ENCORE=1` and `MEDI_SUCKER_READS_ACTION_KIND=1` | **no split**: 223 of 223 reduced lines agree, and both engines end the battle |
| 2. Future Sight payout KOs a full-HP Focus Sash Kleavor (g1950 `…2657391947`, t6) | **TRUE**, and the class has a second member (the confusion self-hit) | yes | `tests/probe_delayed_hit_survival.js`. Knobs `MEDI_DELAYED_HIT_NO_SURVIVAL=1` and `MEDI_SELFHIT_NO_SURVIVAL=1` | **no split**: 126 of 126 reduced lines agree, and both engines end the battle |

**Census 925 → 929 live, 0 missing, 0 threw, 0 hollow** (`data/mechanics-census.json` in the worktree, generated
2026-09-19T09:13:16Z). Four new rows. Each was shown MISSING under its own knob, and no other row moved.

Releases cut in this worktree: `8a4140de3eaa` (the unchanged HEAD tree, the baseline), `40ef97ea4355` (lead 1 only),
`6b55101f9d02` (+ the payout fix), and **`edddcbcfb0c7` (final: every fix)**. `data/engine-release.json` is restored
to its original bytes (`current: 8a4140de3eaa`, identical to HEAD).

---

## 1. LEAD 1 — SUCKER PUNCH READS THE QUEUED MOVE

### The authority (read, not recalled)

- `suckerpunch.onTry`, `data/moves.ts:18399-18405`. Champions has no suckerpunch row (the mod grep returns nothing):
  `const action = this.queue.willMove(target); const move = action?.choice === 'move' ? action.move : null;
  if (!move || (move.category === 'Status' && move.id !== 'mefirst') || target.volatiles['mustrecharge']) return false;`
- Champions' `encore.condition.onStart`, `data/mods/champions/moves.ts:286-320`, lines 303-318:
  `const action = this.queue.willMove(target); if (!action) duration++; else if (action.moveid !== move.id &&
  !target.hasItem('mentalherb')) { ...; this.queue.changeAction(target, { choice: 'move', moveid: move.id, order });
  this.queue.willMove(target)!.priority = priority; }`
- `changeAction` → `cancelAction` + `insertChoice` (`sim/battle-queue.ts:296-300`, `:364`). `insertChoice` →
  `resolveAction` (`:166`) rebuilds `action.move` from `moveid`. **The answer to the brief's question:** Sucker Punch checks
  the target's queued action at the moment its own `Try` runs. After a Champions Encore lands on a body that has
  not yet acted, that action IS the encored move. The rewrite happens inside Encore's `onStart`, at the instant
  the volatile is added. It does not happen at the target's execution (that is mainline's `OverrideAction` road,
  `sim/battle-actions.ts:226-234`).

### What this engine did

`encoreRelocateQueued` already modelled the bracket half of `changeAction` (`_selMv`), and it marked the action
for the execution-time rebuild (`_encoreRewrite`). The Sucker Punch refusal read `_their.a.kind === 'attack'`, which
is the action as CLICKED. **Second defect, found while testing the class:** "attacking" was this engine's action
SHAPE, not the queued move's CATEGORY. So Future Sight (`futurehit`), Pollen Puff at a partner (`allyheal`) and the
Struggle sentinel all read "not attacking", and Sucker Punch failed into them. The authority lands it.

### The class, derived

Every legal move, ability or item whose handler reads the CONTENT of a queued action (`willMove(...)` or
`queue.list` followed by `.move`). The walk is printed in §0 of the probe:
`move:encore, move:trickortreat, move:round, move:suckerpunch, move:upperhand, ability:colorchange` (Encore is the writer itself, and Me First is `Past`).

| member | reachable by an Encore rewrite? | staged | result |
|---|---|---|---|
| Sucker Punch (category) | yes, from Prankster Encore at +1 ahead of a slower Sucker Punch user | 2 arms (attack→status, status→attack) | red → fixed |
| Sucker Punch (non-`attack` damaging kinds) | n/a (the kind defect) | 2 arms (Future Sight, Pollen Puff at a partner) | red → fixed |
| Round's `queue.list` scan | yes: an Encore rewrites a queued Amnesia into Round, and the partner's Round then promotes it | 1 arm | **red → fixed** (ours did not promote it: Whimsicott 102 against 72) |
| Upper Hand | **no.** Upper Hand is +3, and an Encore resolves at 0 or +1 (Prankster). No legal reorder puts an Encore ahead of it this turn | none | the shared reader is used anyway |
| Colour Change / Trick-or-Treat (re-aim a queued Curse) | in principle | none | **this engine models neither.** OWED |

### The fix (`engine/medicham2-browser.js`)

- `encoreRelocateQueued` writes `it._queuedMv = mvId` after the authority's two guards and before either
  pre-existing restore knob, because this is the authority's state.
- `queuedMoveIdOf(e)` (new, top level) is the one reader for "`willMove(target).move.id`": the rewritten id, then
  the Struggle sentinel, then `actionMoveId`. Sucker Punch, Upper Hand's `_theirId` and `promoteQueuedSameMove`
  (Round) all call it.
- `queuedMoveDamages(e)` asks `hasPower` of that move. That is the engine's one "damaging vs status" reader,
  because `MC.moves[id].c` reads 'S' for both Special and Status. An id missing from the move table is COUNTED
  (`MEDFAILS.queuedMoveUnreadable`) and answered by the old kind test, so the fallback is loud.

### Probe — `tests/probe_sucker_reads_queued_move.js` (two engines, staged boards, middle arm)

On `8a4140de3eaa` (before): 5 red arms DIFFER, 3 controls IDENTICAL. On `edddcbcfb0c7`: all 8 IDENTICAL. Under
`MEDI_SUCKER_READS_PRE_ENCORE=1` the three Encore arms (attack→status, status→attack, Round) DIFFER and nothing
else does. Under `MEDI_SUCKER_READS_ACTION_KIND=1` the two kind arms DIFFER and nothing else does. Every arm also
asserts the authority's own stream (the Sucker Punch was used, and `-fail` is present or absent as claimed; the
Round arm needs a `[from] move: Round` line ahead of Kingambit), so an arm that stops staging its shape cannot read
green. The controls are: no Encore with an attack, no Encore with a status move (the refusal is visible), and a
Mental Herb holder (the authority's own exclusion).

Board diffs on `8a4140de3eaa`, for the record: `encored-attack-into-status` Garchomp 107 vs 183, Kingambit 154 vs
175. `future-sight-is-special` Clefable 170 vs 128. `pollen-puff-at-partner` Florges 153 vs 110.

### Census rows (tests/test-mechanics.js)

- `move/failsIfTargetNotAttacking`, "Sucker Punch reads the move a mid-turn Encore rewrote the target into
  (Champions changeAction)". Encored: 0. No Encore: 85.
- `move/failsIfTargetNotAttacking`, "Sucker Punch reads the queued move's CATEGORY: it lands on a Future Sight
  click". Future Sight: 38. Calm Mind: 0.

---

## 2. LEAD 2 — FULL-HP SURVIVAL AGAINST DELAYED AND INDIRECT MOVE-TYPED DAMAGE

### The authority (read, not recalled)

- `futuremove.onEnd`, `data/conditions.ts:394-422`. Champions has no futuremove row. It strips `Protect` and
  `Endure` (`:404-405`), then `this.actions.trySpreadMoveHit([target], data.source, hitMove, true)` (`:415`).
  `hitMove = new this.dex.Move(data.moveData)`, and Future Sight's booked moveData carries
  `effectType: 'Move'` (`data/moves.ts` futuresight.onTry).
- `focussash.onDamage`, `data/items.ts:2272-2277`: `if (target.hp === target.maxhp && damage >= target.hp &&
  effect && effect.effectType === 'Move') if (target.useItem()) return target.hp - 1;`
- `sturdy.onDamage`, `data/abilities.ts:4673-4677`: the same test, then `add('-ability', target, 'Sturdy')` and
  `return target.hp - 1`.
- **The answer to the brief's question:** yes, the Sash applies to a Future Sight payout. The full-HP test reads
  the collector's HP **at payout**, inside the payout's own `Damage` event. Endure does NOT apply, because the
  payout strips it first.
- The payout lands at the **end of turn 3** when booked on turn 1 (measured off the authority's log).

### The class, derived (printed in §0 of the probe)

- Full-HP handlers among legal items and abilities: `focussash.onDamage`, `sturdy.onDamage`,
  `multiscale.onSourceModifyDamage`, `shadowshield.onSourceModifyDamage`. No legal species carries Shadow
  Shield.
- Legal delayed payouts: `futuresight` only. Doom Desire, Bide and Mind Blown are `Past`.
- Move-typed synthetic damage effects in the authority: `data/conditions.ts:193` (the confusion self-hit), and
  `data/moves.ts` Bide / Doom Desire / Future Sight. Only Future Sight and confusion are legal.

| survival effect × path | staged | before | after |
|---|---|---|---|
| Focus Sash × Future Sight payout | yes | ours fainted Salazzle (0 vs 1) | IDENTICAL |
| Sturdy × Future Sight payout | yes (Avalugg) | ours fainted it (0 vs 1) | IDENTICAL |
| Multiscale × Future Sight payout | yes (Dragonite) | IDENTICAL (priced through `dmgRange` at payout) | IDENTICAL |
| Focus Sash × confusion self-hit | yes (Weavile +6/−2) | ours fainted it (0 vs 1) | IDENTICAL |
| Sturdy × confusion self-hit | not staged: no legal Sturdy carrier can hit itself for lethal damage from full within a PP-bounded script. It uses the same clamp as the Sash arm | — | — |

The confusion member was confirmed on the authority before any engine change, on a raw `Battle` (seeds 3 and 5):
`|-activate|p1a: Weavile|confusion`, `|-enditem|p1a: Weavile|Focus Sash`, `|-damage|p1a: Weavile|1/145|[from] confusion`.
The staged arm was FOUND by a search over scripts. It needed one whose shared middle-arm die gives a self-hit,
and 12 variants gave none. The arm asserts that the authority's stream carries the self-hit, so it reads NOT
STAGED rather than green if the dice stop producing one.

### The fix (`engine/medicham2-browser.js`)

- The attack step's `_fromFullClamp` closure body is lifted **verbatim** to a top-level
  `fromFullSurvival(tg, x, rng)`. The closure is now a one-line call, so the attack road is byte-for-byte the
  same logic.
- The Future Sight payout's body road now writes effectiveness, then crit, then asks `fromFullSurvival`, then
  subtracts, then writes `-damage`. That is the authority's line order (`-end`, `-supereffective`, `-enditem`,
  `-damage`). Counter: `MEDSEEN.delayedHitSurvived`. Knob: `MEDI_DELAYED_HIT_NO_SURVIVAL=1`. A doll-absorbed
  payout is unchanged, because the clamp is a body handler.
- The confusion self-hit asks `fromFullSurvival` before subtracting. Counter: `MEDSEEN.confusionSelfHitSurvived`.
  Knob: `MEDI_SELFHIT_NO_SURVIVAL=1`.

### Probe — `tests/probe_delayed_hit_survival.js`

On `8a4140de3eaa` the Sash and Sturdy payout arms DIFFER. On `6b55101f9d02` the confusion arm DIFFERS. On
`edddcbcfb0c7` all six arms are IDENTICAL. `MEDI_DELAYED_HIT_NO_SURVIVAL=1` parts exactly the two payout arms, and
`MEDI_SELFHIT_NO_SURVIVAL=1` parts exactly the confusion arm. The controls are: a Sash holder chipped before the
payout (it must die on both), no carrier (the payout is lethal on both), and Multiscale.

### Census rows

- `move/delayedHit`, "a lethal Future Sight payout into a full-HP Focus Sash or Sturdy body leaves 1 HP, and not
  from below full". No carrier 0, Sash 1 (spent), Sturdy 1, chipped Sash fainted.
- `item/survivesFromFull`, "a lethal confusion self-hit from full HP spends the Focus Sash and leaves 1 HP (the
  self-hit is Move-typed)". No item 0, Sash 1 (spent), chipped fainted.

---

## 3. THE TWO LATTICE GAMES, REPLAYED

`engine/replay_one.js --no-warmup --steering empirical --arm middle --end-state --turns 50 --team-store
C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen` (the main tree's pool, read in place), with the card's
`--games` and `--config`. `data/divergence-turns.json` holds neither seed, so replay_one labels both replays
UNCHECKED. **Reproduction is shown by the baseline replay hitting the card's own split:**

| game | on `8a4140de3eaa` (baseline) | on `edddcbcfb0c7` (final) |
|---|---|---|
| g1350 baseline `…2636045527 vs …2634678601` | parts at reduced index 197, turn 15: SD `-fail|p2a: Kingambit`, US `-damage|p1b: Scolipede|85/135`. That is the card (85 vs 135) | **0 split lines**, 223 / 223 reduced, 17 turns, both engines ended the battle |
| g1950 pair-protect-bust `…2657391947 vs …2657358877` | parts at reduced index 83, turn 6: SD `-enditem Kleavor Focus Sash`, US `Kleavor 0 fnt`. That is the card | **0 split lines**, 126 / 126 reduced, 9 turns, both engines ended the battle |

Neither game parts on anything next. On the baseline, the g1950 game's old turn-2 Trace split was already gone
(the a1c7 report's observation), and it does not return.

---

## 4. REGRESSION PROBES RUN ON `edddcbcfb0c7` (all exit 0)

`probe_confusion_selfhit_address`, `probe_rampage_length`, `probe_fatigue_tag`, `probe_delayed_crit`,
`probe_delayed_hit_immune`, `probe_future_sight_doll`, `probe_gameend_residuals`, `probe_volley_collapse_clamp`,
`probe_item_disposition`, `test-future-sight`, `probe_accuracy_roads`, `probe_lifeorb_toll`,
`probe_sucker_redirect_refusal`, `probe_sucker_try_above_terrain`, `probe_encore_bracket`, `probe_round_promotion`,
and the two new probes. `probe_struggle_announce`, `probe_volley_collapse` and `probe_recoil_after_clamp` force
the temp release store, so they ran against the live worktree tree, which is the same bytes (exit 0). `tests/test-mechanics.js`:
929 of 929 live.

---

## 5. FILES CHANGED (worktree)

- `engine/medicham2-browser.js`: four knobs; `queuedMoveIdOf`, `queuedMoveDamages`, `fromFullSurvival` (lifted);
  `_queuedMv` in `encoreRelocateQueued`; the Sucker Punch, Upper Hand, Round, Future Sight payout and confusion
  self-hit call sites; MEDFAILS/MEDSEEN declarations.
- `tests/probe_sucker_reads_queued_move.js` (new), `tests/probe_delayed_hit_survival.js` (new).
- `tests/test-mechanics.js`: four census rows; four stamps added to the deliberate-break list.
- `data/mechanics-census.json`: regenerated, 929 live.
- `docs/ENGINE.md`: one section and the hand list.
- `docs/_reports/2026-09-19-sucker-sash.md`: this file.
- Not touched: `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `data/tags.json` / `data/abra-tags.js`, `board.js`,
  `magnemite.js`, `engine-data.js`. `status.js --write` was not run.
- Generated and gitignored: `data/releases/{8a4140de3eaa,40ef97ea4355,6b55101f9d02,edddcbcfb0c7}` and
  `data/diff-team-pool.json` (the pool cache replay_one rebuilt). They were left in place.
- `data/provenance-stamp.json` and `data/verification/probe-item-disposition.json` were rewritten as side effects of my
  `status.js` and probe runs, and I restored both to HEAD. The provenance ratchet had "shrunk" only because the
  worktree lacks an untracked main-tree scratch file.

## PROPOSED NOTES ROW

```
| 2026-09-19 | **Sucker Punch reads the move Encore rewrote the target into, and its category; a Future Sight payout and a confusion self-hit meet a full-HP Focus Sash or Sturdy.** Champions' Encore rewrites the target's queued action (`queue.changeAction`, data/mods/champions/moves.ts:303-318), and Sucker Punch refuses on `willMove(target).move.category` (data/moves.ts:18399-18405). This engine read the action as clicked, and read its shape (`kind === 'attack'`) instead of its category. One reader, `queuedMoveIdOf`, now serves Sucker Punch, Upper Hand and Round's queue scan. The payout (`trySpreadMoveHit`, data/conditions.ts:415) and the confusion self-hit (data/conditions.ts:193-194) are `Move`-typed damage events, so `focussash.onDamage` / `sturdy.onDamage` answer them. The attack step's from-full clamp is lifted to `fromFullSurvival`, and both roads call it. Knobs `MEDI_SUCKER_READS_PRE_ENCORE`, `MEDI_SUCKER_READS_ACTION_KIND`, `MEDI_DELAYED_HIT_NO_SURVIVAL`, `MEDI_SELFHIT_NO_SURVIVAL`. Probes `tests/probe_sucker_reads_queued_move.js` (8 arms), `tests/probe_delayed_hit_survival.js` (6 arms): red on `8a4140de3eaa`, green on `edddcbcfb0c7`, each knob parts only its own arms. Census **925 → 929 live / 0 missing** (`data/mechanics-census.json`). The two remaining lattice games (g1350 `…2636045527`, g1950 `…2657391947`) replay on `edddcbcfb0c7` with no split (`engine/replay_one.js`, unchecked: no stored record). **Supersedes.** Nothing published; lattice board-material 0 / 1 / 2 on `a1c7dcd5696b` stands until re-measured. **Basis.** unchanged. **Owes.** `docs/ENGINE.md` (done in this pass); the three lattices re-run on a release that carries these bytes. |
```

## OWED, NOT RUN

1. **The three lattices on a release that carries these bytes.** The prediction for g1350 and g1950 is that both
   games leave, with no joins. It is a prediction, not a measurement. Four die paths moved: Sucker Punch now lands
   into Future Sight and Pollen Puff users, a Sash or Sturdy now survives a payout or self-hit, and Round now
   promotes an Encore-rewritten action. Any game that touches those draws differently from there on, so joins are
   possible.
2. **Roster stages** (items / abilities / moves) on the new release. Focus Sash, Sturdy, Sucker Punch, Future Sight
   and Encore rows all ride code that changed.
3. **`tests/probe_confusion_selfhit_chance.js` was not run.** It hardcodes `data/team-pool-frozen` inside the
   worktree, and the brief forbids copying the pool. The change does not touch the 33/100 gate, but that is a
   claim, not a run.
4. **Colour Change and Trick-or-Treat re-aiming a queued Curse** (`action.targetLoc = -1`, a queued-content reader
   derived in §1). This engine does not model it. Not staged.
5. **A Mold Breaker Future Sight booker against Sturdy at payout.** By the source, Sturdy still applies (the
   payout runs no `ModifyMove`), and this engine reads `tg.ability` raw there, so the two should agree. Not
   staged.
6. **Sturdy against a confusion self-hit.** Not stageable in a legal PP-bounded script (§2). It uses the same clamp
   as the staged Sash arm.
7. **`tests/test-docs-current.js` and the pre-commit gates were not run.** Without the notes row (which the brief
   withholds from me) they are expected to refuse a commit of `engine/` and `tests/`. The row is proposed above.
