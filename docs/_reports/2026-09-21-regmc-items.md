# Reg M-C: the items that came back from `Past` — Rocky Helmet, Air Balloon, Red Card, Eject Button — and Emergency Exit

**Date.** 2026-09-21. **Division.** ENGINE. **Line.** abra/regmc 0.18.0 onward. **Status.** Findings record,
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
