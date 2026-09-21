# Reg M-C: the items that came back from `Past` — Rocky Helmet, Air Balloon, Red Card, Eject Button — and Emergency Exit

**Date.** 2026-09-21. **Division.** ENGINE. **Line.** abra/regmc 0.18.0, then 0.20.0 onward (0.19.0 is MEASURE's census). **Status.** Findings record,
historical by construction; never cited as current state.

**No Reg M-C figure is published here.** The smoke is unpinned (no census pin, a release cut by the run,
`--games 100`). It says what parts, by first cause, before and after on the same sample. Nothing else.

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-a37bfb834bf51543e`, base `f199efb2`, main `78cfa9d6` merged in before the first commit |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` `f10d679`, selected by the regulation (`SHOWDOWN_PATH` unset) |
| M-B authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit on every M-B arm) |
| launcher | `tools\lownode.cmd` through `cmd.exe /c` from node argv launchers in a PRIVATE scratch subdirectory (`items-a37b/`); shown to propagate exit code 3 before use |

The smoke, every arm: `node engine/game_differential.js --regulation regmc --games 100 --team-store
C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --steering empirical --arm middle --end-state
--dump-games 200 --write --out <scratch> --dump-out data/_scratch-items-smoke-<tag>.json`. Pool digest
`f5ac48e5f924` (written by the first run, read from the cache by every later one); 87 played in every arm.
Board-material is `state.games − state.games_board_never_diverged`. First causes are bucketed by my own script over
the FULL `--dump-games` output, never the capped lists.


## 0. The verdict

| | |
|---|---|
| **now matches** | Rocky Helmet (`tests/probe_regmc_rocky_helmet.js`), Air Balloon (`tests/probe_regmc_air_balloon.js`), Red Card and Eject Button including the Champions pivot rule and each other (`tests/probe_regmc_eject_items.js`), Emergency Exit including the pivot rule (`tests/probe_regmc_emergency_exit.js`). Every probe: exit 0 clean, exit 1 under each of its knobs and on the engine bytes before its commit. |
| **pinned Reg M-C differential** (§5, not published) | state bar **215 / 941 → 127 → 120 → 108 → 78 / 941**; every item family at 0 |
| **Reg M-B** (§7) | `data/tags.json` and `data/protocol-events.json` byte-identical; damage differential identical but for its output-path line at every commit (control seed differs); M-B lattice at `--games 1200` 0 of 961 at every commit |
| **item 5** (§6) | Double Shock `-fail` field, the Inner Focus stat name and the fallen counter are all **narration**, by the pinned differential's own per-cause board accounting |
| **left** | damage values (incl. an order-dependent Aura Guard card), faint HP `0fnt`, terrain, `other`; `data/move-effects.js` is not per-regulation (§8) |
| **versions** | 0.18.0, 0.20.0, 0.21.0, 0.22.0 — MEASURE took 0.19.0 in parallel; the later three were renumbered in a rebase |

---

## 1. Rocky Helmet (abra/regmc 0.18.0)

### The authority, read whole

M-C checkout `data/items.ts` rockyhelmet :5295-5309; the Champions mod (`data/mods/champions/items.ts`) does not
name it:

```
onDamagingHitOrder: 2,
onDamagingHit(damage, target, source, move) {
  if (this.checkMoveMakesContact(move, source, target)) this.damage(source.baseMaxhp / 6, source, target);
},
```

- Raised once per ARRIVAL by `data/mods/champions/scripts.ts:399-410`, over the targets that took a number (a doll's
  HIT_SUBSTITUTE is not one).
- Paid through `Battle#spreadDamage` (`sim/battle.ts:2091-2170`): an attacker already on 0 HP takes nothing and
  writes nothing; the amount is floored and clamped to at least 1; Magic Guard's `onDamage` refuses a non-Move
  effect; the line is `-damage|ATTACKER|hp|[from] item: Rocky Helmet|[of] HOLDER`.
- `compareLeftToRightOrder` (`sim/battle.ts:421`): declared order first, so Rough Skin (order 1) pays before the
  helmet (order 2), and every undeclared handler after both.

### Tag, membership printed before wiring

`punishesAttackerItem {trigger:'contact', fraction, order}`: an item whose `onDamagingHit` matches
`this.damage(source.baseMaxhp / N, source, target)` behind `checkMoveMakesContact(`. Over the whole item dex in both
checkouts, the other `onDamagingHit` items (Absorb Bulb, Cell Battery, Jaboca, Luminous Moss, Rowap, Snowball,
Weakness Policy, Air Balloon) do not match. **Members: `rockyhelmet` only** — legal in `gen9championsvgc2026regmc`,
`Past` in `gen9championsvgc2026regmb`. `data/tags-regmc.json` regenerated with `node engine/tag_dex.js --regulation
regmc`; a structural diff that ignores usage counts and stamps shows exactly the new tag descriptor and the Rocky
Helmet row. The usage counts moved too (the store gained games since 0.16.0 derived it); no membership moved.
`data/tags.json` was not touched.

### Engine

`payItemPunish(m, tg, n, moveId, use)` beside `payOrbToll`. The deferred call is `R._dhItem`, built beside `R._dh`
and paid by `_stepDamagingHitItem`, a new ORDER-2 pass between `_stepDamagingHitEarly` (order 1) and
`_stepDamagingHitBody` (undeclared), each pass target-index-major like the authority's one sorted list. Interior
arrivals of a volley are paid from the packet loop, before `_damagingHit(1)` when the holder's ability punisher is
undeclared and after it when it is order 1.

**A trap in the first cut:** the interior call went through `R._dhItem`, which is stored BELOW the packet loop, so a
volley paid only its last arrival. The VOLLEY arm caught it (one toll where the authority has two).

### Probe — `tests/probe_regmc_rocky_helmet.js --regulation regmc`

| arm | staged | authority | this engine |
|---|---|---|---|
| CONTACT | a quiet attacker's weakest plain contact move into a helmet holder | one toll on the attacker | match, boards 0 |
| NONCONTACT | the same attacker's plain non-contact move | nothing | match, boards 0 |
| ROUGHSKIN | a Rough Skin carrier holding the helmet | Rough Skin's toll, then the helmet's | match, boards 0 |
| VOLLEY | a fixed two-arrival contact move (no legal one is 100% accurate; the fixture check asserts both landed) | two tolls, each under its own arrival | match, boards 0 |
| KO | two foes hit a frail holder in one turn; it falls | the killing blow is still tolled | match, boards 0 |

| run | exit | red |
|---|---|---|
| clean | 0 | none |
| `MEDI_ROCKY_HELMET_INERT=1` | 1 | CONTACT, ROUGHSKIN, VOLLEY, KO |
| `MEDI_ROCKY_HELMET_ONCE=1` | 1 | VOLLEY |
| `--medi` HEAD's engine (pre-fix bytes) | 1 | CONTACT, ROUGHSKIN, VOLLEY, KO |

Every staged set passed buildPair's Reg M-C `TeamValidator` fixture check (16 sets, 0 illegal).

### Reg M-B unmoved

- `data/tags.json` `c34d6465c3b6…` and `data/protocol-events.json` `4e2f810b338a…`: sha256 unchanged.
- Damage differential `tests/test-engine-diff.js --n 6000 --seed 20260804`, SHOWDOWN_PATH = the M-B checkout:
  HEAD's engine bytes vs this change, 150 lines each, differing ONLY on the `wrote data/verification/…` line (the
  output path). Control: seed `20260805` on HEAD's bytes differs from the base on 154 diff lines.
- The step list gained a pass that Reg M-B also runs, so the lattice was run: `--steering empirical --arm middle
  --end-state --census <a copy of HEAD's census> --team-store <main tree>/data/team-pool-frozen --games 1200`,
  release cut by the run `7282513b2123`, pool digest `f807cbc40299`: **0 of 961 board-material**, 0 VOID,
  0 protocol-parted.

### The smoke

| | before (release `c3faaa4d5a4f`) | after Rocky Helmet (release `18b19518b799`) |
|---|---|---|
| played / VOID | 87 / 1 | 87 / 0 |
| **board-material** | **16 / 86** | **6 / 87** |
| Rocky Helmet first causes | 11 | 0 |
| Air Balloon | 3 | 3 |
| Double Shock `-fail` field | 3 | 3 |
| Inner Focus stat name | 2 | 2 |
| Emergency Exit | 1 | 0 — that game is absent from the after dump; not explained in this pass (see §6) |
| Red Card / Eject Button | 1 | 1 |
| fallen counter | 1 | 1 |
| Sirfetch'd display name | 0 | 1 |
| a damage value (Wave Crash into Lucario) | 0 | 1 (the game that was VOID) |
| total dumped | 22 | 12 |

### Two findings on the way

1. **The per-regulation seam (MEASURE, abra/regmc 0.17.0) stopped every Reg M-C staged probe and the smoke at load.**
   Under `--regulation regmc` the steering reads `data/mechanics-census-regmc.json`, which does not exist, and
   refuses. The 0.16.0 seeds probe on main died the same way. Fixed on the ENGINE side: `tests/regmc_probe_kit.js`
   `scriptedCensusPin` gives a scripted probe a declared one-row stub outside `data/` (its games never consult the
   census), and both Reg M-C probes call it. The smoke pins a copy of Reg M-B's census with `--census`, which reads
   the same bytes 0.16.0's smoke read implicitly; the sample was shown unchanged by re-running the after-helmet
   smoke on the merged tree (6 / 87, identical first causes).
2. **The damage-value card is order-dependent across games.** It appears on game `…2678317676` (config
   `omit-spread`, Wave Crash from a Basculegion into a Lucario-Mega-Z, whose Aura Guard halves contact damage;
   Showdown 45, this engine 91 — Aura Guard not applied). That game agreed in the before run. Run ALONE
   (`--config omit-spread`) on the after engine, it agrees again (0 of 11 board-material). So something carried
   over from an earlier game in the same process changes this one; this pass did not find what. Neither Rocky Helmet
   nor any helmet holder is in that game. Recorded for the next pass, not fixed.

---

## 2. Air Balloon (abra/regmc 0.20.0)

### The authority, read whole

M-C checkout `data/items.ts` airballoon :185-212; the Champions mod does not name it:

```
onStart(target) { if (!target.ignoringItem() && !this.field.getPseudoWeather('gravity')) this.add('-item', target, 'Air Balloon'); }
// airborneness implemented in sim/pokemon.js:Pokemon#isGrounded
onDamagingHit(damage, target, source, move) {
  this.add('-enditem', target, 'Air Balloon'); target.item = ''; this.clearEffectState(target.itemState);
  this.runEvent('AfterUseItem', target, null, null, this.dex.items.get('airballoon'));
},
onAfterSubDamage(damage, target, source, effect) { if (effect.effectType === 'Move') { the same four lines } },
```

- `sim/pokemon.ts:2148-2160` `isGrounded` ends `return item !== 'airballoon'`; `runImmunity` (:2237-2267) answers a
  Ground move with a bare `-immune`. This engine's `isGrounded` already mirrors that clause off the item SLOT, so the
  immunity was right and the balloon simply never left.
- `sim/battle.ts:1018-1030`: an item's `onStart` runs as its `onSwitchIn` (priority 0), and within one body an Item
  handler sorts after the Ability handler. So the announcement belongs at the end of each entrant's own slot.
- The pop is an undeclared-order `DamagingHit` handler: after the holder's ability handlers, before the attacker's
  `onSource…` handler; once per arrival (the next finds an empty hand). No `lastItem`; `AfterUseItem` runs.

### Tag and engine

`poppedOnHit {announceOnStart, gravitySilences, onSubDamage, afterUseItem, switchInPriority}`. Membership printed
before wiring, whole dex, both checkouts: `airballoon` only; legal in Reg M-C, `Past` in Reg M-B. The structural diff
of `data/tags-regmc.json` against the 0.18.0 commit is the descriptor and the Air Balloon row, nothing else.

`balloonAnnounce(m, field)` at the end of each entrant's slot in the lead wave and in `runEntryPass` (refill and single
switch), skipped under Gravity and on a dead arrival. `balloonPop(tg)` in `_stepDamagingHitLate` between `_dhAbil` and
`_dhSrc`, and per interior arrival in the packet loop at the same position. Counted, not modelled:
`balloonGainedUnannounced` (a balloon handed over mid-battle; `setItem` raises its Start), `balloonBehindDollUnmodelled`
(`onAfterSubDamage`), `balloonAnnounceOrderApprox` (a holder whose ability has a non-zero switch-in priority).

### Probe — `tests/probe_regmc_air_balloon.js --regulation regmc`

| arm | staged | authority | this engine |
|---|---|---|---|
| LEAD | holder leads; foe: Ground move, then a plain hit, then the Ground move | `-item`; `-immune`; hit + `-enditem`; the Ground move lands | match, boards 0 |
| CONTROL | the same, no item | nothing announced; every hit lands | match, boards 0 |
| SWITCH | holder switches in on turn 2 | `-item` at that entry | match, boards 0 |
| VOLLEY | a two-arrival move into the holder | popped by the first arrival, once | match, boards 0 |

| run | exit | red |
|---|---|---|
| clean | 0 | none |
| `MEDI_AIR_BALLOON_SILENT=1` | 1 | LEAD, SWITCH, VOLLEY protocol lines only — **boards identical**: the announcement is narration |
| `MEDI_AIR_BALLOON_UNPOPPED=1` | 1 | LEAD, VOLLEY, protocol AND boards: the pop is board-material |
| `--medi` the 0.18.0 engine bytes | 1 | LEAD (lines + boards), SWITCH (lines), VOLLEY (lines + boards) |

The holder's own click is its weakest plain hit back at the attacker. The first cast gave it Focus Energy as an idle
click, and a SECOND Focus Energy writes `-fail` in the authority and nothing here: a narration defect, recorded, not
this mechanic.

### Reg M-B unmoved

sha256 of `data/tags.json` and `data/protocol-events.json` unchanged. Damage differential seed `20260804`: identical to
the base but for the output-path line. Lattice `--games 1200` (same flags and pins as §1), release cut by the run
`6b729c1e1ebc`: **0 of 961 board-material**, 0 VOID, 0 protocol-parted.

### The smoke

| | after Rocky Helmet (`18b19518b799`) | after Air Balloon (`20453e22e822`) |
|---|---|---|
| played / VOID | 87 / 0 | 87 / 0 |
| **board-material** | **6 / 87** | **3 / 87** |
| Air Balloon | 3 | 0 |
| Double Shock `-fail` field | 3 | 3 |
| Inner Focus stat name | 2 | 2 |
| Red Card / Eject Button | 1 | 1 |
| fallen counter | 1 | 1 |
| Sirfetch'd display name | 1 | 1 |
| the Aura Guard damage value | 1 | 0 — gone again, with nothing in this fix touching it (the cross-game effect, §1) |
| total dumped | 12 | 8 |

---

## 3. Red Card and Eject Button (abra/regmc 0.21.0)

### The authority, read whole

- Red Card, M-C checkout `data/items.ts` :5146-5164 (the Champions mod does not name it): `onAfterMoveSecondary` —
  source alive, target alive, damaging; `!source.isActive || !canSwitch(source.side) || source.forceSwitchFlag ||
  target.forceSwitchFlag` returns; `target.useItem(source)` (`-enditem|TARGET|Red Card|[of] SOURCE`), then
  `runEvent('DragOut', source, target, move)` → `source.forceSwitchFlag = true`.
- Eject Button, `data/mods/champions/items.ts` :266-280, overriding `data/items.ts` :1680-1700 (priority 2 inherited):
  target alive, damaging, not a future move; `!canSwitch(target.side) || target.forceSwitchFlag || beingCalledBack ||
  isSkyDropped()` returns; commanding/commanded returns; any active body with `switchFlag === true` returns;
  `target.switchFlag = true; if (!target.useItem()) target.switchFlag = false`. Mainline also writes
  `source.switchFlag = false` on success; the override (Showdown `aa6d5f0856`, 2026-09-13) does not.
- `sim/battle-actions.ts:1311`: a pivot sets `source.switchFlag = move.id` — a STRING, so it never trips `=== true`.
- `sim/battle.ts:2820-2828`: every `forceSwitchFlag` body is dragged (`dragIn`, a random switchable body, `|drag|`) at
  the end of the action; `:2874-2907` then requests the flagged switches. `sim/battle-queue.ts:250-254`: a string flag
  becomes the switch's `[from]`, `true` a bare `|switch|`.

### Tags, membership printed before wiring

`dragsAttackerOnHit {requiresDamaging, dragOutEvent, priority}` and `ejectsHolderOnHit {requiresDamaging,
notFutureMove, blockedByPendingSwitch, cancelsSourceSwitch, priority}`. Whole item dex, both checkouts: `redcard` and
`ejectbutton` only; both legal in Reg M-C, `Past` in Reg M-B. Printed:

```
pokemon-showdown-mc  gen9championsvgc2026regmc   EJECT ejectbutton:legal prio=2 cancelsSource=false   DRAG redcard:legal
pokemon-showdown     gen9championsvgc2026regmc   EJECT ejectbutton:legal prio=2 cancelsSource=true    DRAG redcard:legal
```

So the rule change is a derived fact: the checkout that loads decides it. Structural diff of `data/tags-regmc.json`
against 0.19.0: the two descriptors and the two item rows.

### Engine

At the `AfterMoveSecondary` site: Eject Button first (rows in speed order; a tie is counted), then — after Pickpocket
and Berserk — Red Card over the rows (the first qualifying holder drags; the refusals are the handler's, and
Suction Cups / Guard Dog go through `refusesForcedSwitch`). `spendItemOnHit` is `useItem`: `-enditem` (with `[of]` for
Red Card), `recordItemUsed`, the hand empties, Symbiosis. At the end of the action, below the damaging phaze: the Red Card
drag (the phaze doors' die), then the owed switches — each Eject Button holder, and the attacker's pivot if the button
did not cancel it — faster leaver first. A Red Card drag refuses the attacker's pivot.

### Probe — `tests/probe_regmc_eject_items.js --regulation regmc`

One turn plus an all-Protect turn, so the switch the authority requests at the end of turn 1 is answered and written.

| arm | staged | authority | this engine |
|---|---|---|---|
| RC | a plain hit into a Red Card holder | card spent `[of]` the attacker; attacker `|drag|`ged | match, boards 0 |
| RC-UTURN | U-turn into a Red Card holder | dragged; no pivot | match, boards 0 |
| EB | a plain hit into an Eject Button holder | button spent; holder `|switch|`es out | match, boards 0 |
| EB-UTURN | U-turn into an Eject Button holder | button spent; the pivot `[from] U-turn` AND the holder switch, faster leaver first | match, boards 0 |
| SPREAD | one spread hit into a Red Card holder and an Eject Button holder | button, then card; drag; then the holder's switch | match, boards 0 |

| run | exit | red |
|---|---|---|
| clean | 0 | none |
| `MEDI_RED_CARD_INERT=1` | 1 | RC, RC-UTURN, SPREAD (lines and boards) |
| `MEDI_EJECT_BUTTON_INERT=1` | 1 | EB, EB-UTURN, SPREAD (lines and boards; and their fixture checks, see below) |
| `MEDI_EJECT_BUTTON_MAINLINE=1` | 1 | EB-UTURN (the pivot is cancelled, the authority keeps it) |
| `--medi` the 0.19.0 engine bytes | 1 | all five |

**A limit of the harness, said:** the authority's switch REQUEST is answered by mirroring this engine's slot, so when
this engine does not switch the request cannot be answered and the game stops. Under `MEDI_EJECT_BUTTON_INERT` the
authority's own switch line therefore disappears too and the EB fixture checks read red. The `-enditem` is the
engine-independent fixture; the switch line is an engine-and-authority check. The `[from]` of a pivot's switch is the
display name on the authority (`U-turn`) and the id here (`uturn`), a spelling the driver already declares; the kit's
comparison folds hyphens inside `[from]` and nothing else.

### Reg M-B unmoved

sha256 of `data/tags.json` and `data/protocol-events.json` unchanged. Damage differential seed `20260804`: identical but
for the output-path line. Lattice `--games 1200` (same flags and pins as §1), release cut by the run `797c246b186d`:
**0 of 961 board-material**, 0 VOID, 0 protocol-parted.

### The smoke

| | after Air Balloon (`20453e22e822`) | after Red Card / Eject Button (`d9c8422ffa7b`) |
|---|---|---|
| played / VOID | 87 / 0 | 87 / 0 |
| **board-material** | **3 / 87** | **2 / 87** |
| Red Card / Eject Button | 1 | 0 |
| Double Shock `-fail` field | 3 | 3 (narration: none of the three is board-material) |
| Inner Focus stat name | 2 | 2 (one is board-material, but its board parts at turn 3, not at the stat-name line) |
| Sirfetch'd display name | 1 | 1 (narration) |
| fallen counter | 1 | 1 (board-material: the board parts two turns later, on a Lucario's HP) |
| total dumped | 8 | 7 |

The board-material list is `state.first_board_divergences` (2 rows, so not truncated): `pair-speedctrl …2682837890`
turn 5 (`p1.party.lucario.hp` 39 / 69), and `pair-speedctrl …2684673849` turn 3 (`p2.party.lucario.hp` 140 / 145).

---

## 4. Emergency Exit (abra/regmc 0.22.0)

### The authority, read whole

- `data/mods/champions/abilities.ts` emergencyexit :22-29 (and wimpout :96-103), overriding `data/abilities.ts`
  :1250-1266: `if (!canSwitch(target.side) || target.forceSwitchFlag || target.switchFlag) return; target.switchFlag =
  true; this.add('-activate', target, 'ability: Emergency Exit');`. Mainline also clears every active body's
  `switchFlag` first; the Champions override does not, so a pivot into the holder switches too.
- Raised by `data/mods/champions/scripts.ts:575-590` after `afterMoveSecondaryEvent`, unless Sheer Force boosted the
  move, for every target still standing whose HP went from above half to at or below half on this move
  (`hurtThisTurn + damage` is the HP before it); for the attacker after its recoil (`sim/battle-actions.ts:1395`), its
  DamagingHit punishers (`scripts.ts:421`) and its AfterMoveSecondarySelf (`sim/battle-actions.ts:536-546`); and at
  the residual and on a hazard entry (`sim/battle.ts:2863-2874`).

### Tag, membership printed before wiring

`switchesOutAtHalf {clearsOtherSwitches, announces}` from `onEmergencyExit`. Printed:

```
pokemon-showdown-mc  gen9championsvgc2026regmc   emergencyexit clearsOthers=false carriers=golisopod
                                                 wimpout       clearsOthers=false carriers=(none)
pokemon-showdown-mc  gen9championsvgc2026regmb   emergencyexit / wimpout: no legal carrier
pokemon-showdown     (mainline handler)          clearsOthers=true
```

The structural diff of `data/tags-regmc.json` against 0.21.0 is the descriptor and the Emergency Exit row (it was
`untagged`).

### Engine

`emergencyExitAsk(tg, box, owed, attacker)` is the handler. The TARGET door runs after the Red Card block (so after the
whole AfterMoveSecondary event) over the rows, reading the HP each row had before this move (`R.hp0`, recorded at row
creation). The ATTACKER door runs after the Life Orb toll, comparing with the attacker's HP before the action — one
crossing over the action is the same question the authority asks three times; its line lands after the target-side
events where a recoil crossing is announced above them in the authority (narration, said). The switch joins the owed
end-of-action switches (the list Eject Button uses), so a U-turn into the holder switches both, faster leaver first.
The residual and hazard doors are counted at the top of each turn (`MEDFAILS.emergencyExitOtherDoorUnmodelled`: a
holder above half at the last look and at or below it now).

### Probe — `tests/probe_regmc_emergency_exit.js --regulation regmc`

| arm | staged | authority | this engine |
|---|---|---|---|
| CROSS | the attacker's strongest plain hit takes Golisopod from full to at or below half | `-activate`, then a bare `|switch|` | match, boards 0 |
| STAY | its weakest plain hit leaves it above half | nothing | match, boards 0 |
| UTURN | a weak hit on turn 1, then a U-turn that crosses on turn 2 | `-activate` right below the U-turn's damage; the pivot `[from] U-turn` AND the holder switch | match, boards 0 |

| run | exit | red |
|---|---|---|
| clean | 0 | none |
| `MEDI_EMERGENCY_EXIT_INERT=1` | 1 | CROSS, UTURN |
| `MEDI_EMERGENCY_EXIT_MAINLINE=1` | 1 | UTURN (the pivot is cancelled; the authority keeps it) |
| `--medi` the 0.21.0 engine bytes | 1 | CROSS, UTURN |

The first UTURN cast was a Sneasler whose U-turn did NOT cross; the exit came at the end of the turn from a poison
residual — the residual door this pass does not model. The arm now requires the `-activate` directly below the U-turn's
own damage, and `poisontouch`, `toxicchain`, `stench`, `pickup` and `ballfetch` joined the kit's list of loud abilities.

---

## 5. The pinned Reg M-C differential, commit by commit

Main moved to `f4f91de2` mid-pass (MEASURE's Reg M-C census, abra/regmc 0.19.0), so every item was re-measured on the
scoreboard the gate reads. The command (`docs/_reports/2026-09-21-regmc-census.md` §6), each run on a Reg M-C release cut
from that commit's engine bytes and `data/tags-regmc.json`:

```
node engine/game_differential.js --regulation regmc --steering empirical --arm middle --end-state \
  --census data/verification/census-pin-regmc-98c69a4fee7f.json \
  --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc \
  --release <id> --games 1200 --write --out <scratch>                (via tools\lownode.cmd)
```

The team store is the main tree's (the worktree has none); the base run reproduces MEASURE's own reading exactly
(215 of 941, 14 void, 6 threw), so the sample is the same one. The state bar is `state.games −
state.games_board_never_diverged`. Families are my own grouping of `end_state[0].summary.by_cause` rows whose
materiality is BOARD-MATERIAL, games = `board_parted`.

| engine | release | state bar | void | threw | Rocky Helmet | Air Balloon | Red Card | Eject Button | Emergency Exit |
|---|---|---|---|---|---|---|---|---|---|
| main `f4f91de2` (no items) | `3abd3ccd6d63` | **215 / 941** | 14 | 6 | 89 | 10 | — | 13 | 28 |
| + Rocky Helmet, 0.18.0 (`9fe1047f`) | `20bbe443aded` | **127 / 942** | 13 | 6 | 0 | 9 | 1 | 13 | 28 |
| + Air Balloon, 0.20.0 (`25c3c7fa`) | `e41dd12afd8a` | **120 / 942** | 13 | 6 | 0 | 0 | 1 | 13 | 29 |
| + Red Card / Eject Button, 0.21.0 (`2bec9d42`) | `ed2591d7fb99` | **108 / 942** | 13 | 7 | 0 | 0 | 0 | 0 | 29 |
| + Emergency Exit, 0.22.0 (before the guard) | `31367487ac11` | **78 / 941** | 14 | 7 | 0 | 0 | 0 | 0 | 0 |
| + the `move-effects` null guard, 0.22.0 as committed | `c2cce00ddfc8` | **78 / 941** | 14 | 5 | 0 | 0 | 0 | 0 | 0 |

What is left, by the same grouping on the last run: damage values 31, `other` 28, faint HP written `0fnt` on one side
14, terrain 8, games headed by the Inner Focus stat name 7 (narration at the line; see §6).

The Red Card game that appears after Rocky Helmet had been hidden behind an earlier helmet divergence. The THREW column:
the 0.21.0 build lost two games to a null read that its changed paths reached (§8); the guard recovered them.

The unpinned 100-game smoke, for the record, read 16/86 → 6/87 → 3/87 → 2/87 → 2/87 across the same four passes
(release ids and first-cause tables in §1-§3); it held one Eject Button game and no Emergency Exit game by the end, which
is why the pinned run, not the smoke, is the scoreboard.

---

## 6. Item 5 — classified, not fixed: all three are narration

**The instrument that decided** is the pinned differential's own per-cause board accounting,
`end_state[0].summary.by_cause` (`board_parted`, `board_parted_same_turn` / `_later` / `_earlier`, `materiality`),
read on the 0.21.0 pinned run (release `ed2591d7fb99`). A cause is narration when its line writes no board leaf: every
game it heads either never parts a board, or parts it on a LATER turn for another reason.

| cause | games headed | board parted | same turn | later / earlier | verdict |
|---|---|---|---|---|---|
| Double Shock `-fail` field (`-fail|X|move: Double Shock` vs bare `-fail|X`) | 5 | 0 | 0 | 0 / 0 | **narration** (1 of the 5 threw for another reason) |
| Inner Focus stat name (`unboost|atk` vs `unboost|Attack`) | 22 | 8 | 0 | 7 / 1 | **narration**: the line never parts a board; the 8 part turns later |
| the fallen counter (`-end|X|fallenundefined|[silent]`, the authority's own unset field) | 2 | 0 | 0 | 0 / 0 | **narration** |

The unpinned smoke says the same: on the post-Eject smoke the two board-material games are a fallen-counter game whose
board parts at turn 5 (protocol parted at turn 3) and an Inner Focus game whose board parts at turn 3 (protocol parted at
turn 0) — both on a Lucario's HP, the damage-value family the coordinator has assigned to the next pass.

**A finding on the way, not fixed:** the Inner Focus label is a typed table (`STAT_LABEL`, `Attack`) that was right for
the Reg M-B checkout (`data/abilities.ts` innerfocus writes `'Attack'` there) and is wrong for the Reg M-C one (it writes
`'atk'`, :2160). The fix is to derive the label from the handler into `preventsStatDrop`, which only the new
regulation's tag file would carry.

## 7. Reg M-B unmoved, every commit

| commit | `tags.json` / `protocol-events.json` sha256 | damage differential `--n 6000 --seed 20260804` vs base | M-B lattice `--games 1200` |
|---|---|---|---|
| 0.18.0 Rocky Helmet | unchanged | identical but for the output-path line | release `7282513b2123`: 0 of 961 |
| 0.20.0 Air Balloon | unchanged | identical but for the output-path line | release `6b729c1e1ebc`: 0 of 961 |
| 0.21.0 Red Card / Eject Button | unchanged | identical but for the output-path line | release `797c246b186d`: 0 of 961 |
| 0.22.0 Emergency Exit + guard | unchanged | identical but for the output-path line | release `03ed288569bd`: 0 of 961 (and `7158c5f8ae94` before the guard) |

Control for the comparator: seed `20260805` on the base bytes differs from the base on 154 diff lines. The base is
`f199efb2`'s engine; `tests/test-engine-diff.js` was run with `SHOWDOWN_PATH` = the M-B checkout and `--out` under
`data/verification/` (never the published artifact). Every lattice: `--steering empirical --arm middle --end-state
--census <a copy of HEAD's census> --team-store <main tree>/data/team-pool-frozen --games 1200`, 0 VOID, 0
protocol-parted. No Reg M-B census or roster row was added.

## 8. Found on the way, not fixed

1. **`data/move-effects.js` is not per-regulation.** 15 legal Reg M-C moves have no row, so their secondaries and self
   effects are not modelled — Glaive Rush, Double Shock, Revival Blessing, Drum Beating (a secondary), Meteor Assault,
   Overdrive, Pyro Ball (a secondary), Snipe Shot, Slash, Milk Drink, Octolock, Zing Zap (a secondary), Court Change,
   Jaw Lock, Shift Gear. One reader assumed a row and threw (fixed with a guard and a counter, 0.22.0). The table needs a
   Reg M-C build and a `fileFor` key, like the tag file.
2. **The Aura Guard damage card depends on the games before it.** §1: the Wave Crash into a Lucario-Mega-Z agreed in
   isolation and parted in the full run. The two remaining board-material games of the late smoke part on a Lucario's
   HP too. Likely the same cause; the damage-value family is the next pass.
3. **Emergency Exit's residual and hazard doors** are counted, not modelled.
4. **The Inner Focus label** is a typed table right for Reg M-B's checkout and wrong for Reg M-C's (§6).
5. **The staged harness cannot show a switch this engine does not make** (§3). And the pivot `[from]` spelling
   (`U-turn` vs `uturn`) is folded in the kit's comparison; the driver already declares it.
6. **Unchanged from 0.16.0:** the seed GAIN door, Curse under Reg M-C, species names with an apostrophe.
7. **Scratch artifacts:** the damage-differential runs wrote `data/verification/_items-a37b-ediff-*.json`
   (untracked, mine) and the smokes `data/_scratch-items-smoke-*.json` (git-ignored, mine). Nothing else was written
   under `data/` except `data/tags-regmc.json` (committed) and the release store.
