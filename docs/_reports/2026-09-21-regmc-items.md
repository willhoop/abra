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
