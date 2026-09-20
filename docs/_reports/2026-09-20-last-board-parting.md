# The last board parting in the held-out 12,000-game draw — a punish ability's status arrived with no source

2026-09-20. ENGINE, light mode, worktree `agent-a516a0b4da579cfa3`.

**Verdict: a real engine defect, not the instrument.** The authority's **Flower Veil** refused the
burn, silently. This engine wrote a literal `null` into the source slot of the `punishesAttacker`
status call, and `null` is the one value that makes every source-gated guard stand down.

---

## 1. The game, and what it is

`data/verification/game-differential.g12000.json`, `state.first_board_divergences[0]`, release
`c2d68f8cab07`, generated `2026-09-20T20:43:31.521Z`.

| | |
|---|---|
| config | `omit-weather` |
| seed | `gen9championsvgc2026regmbbo3-2654574813 vs gen9championsvgc2026regmbbo3-2654567638` |
| turn | 9 (the protocol parts at the same turn) |
| sample | `--games 12000 --turns 50 --arm middle --steering empirical --team-store data/team-pool-frozen --census data/verification/census-pin-3a69f40d67f4.json` |
| clause | `state.games 7182` less `state.games_board_never_diverged 7181` = **1** |

```
p1.party.sinistcha.hp      medicham 75    showdown 84
p1.party.sinistcha.status  medicham "brn" showdown ""
p1.active[1].hp            medicham 75    showdown 84
p1.active[1].status        medicham "brn" showdown ""
```

## 2. Reproduced, with the warm-up, before anything was touched

`engine/replay_one.js` on release `c2d68f8cab07`, same pins, same flags, `--config omit-weather`.
It replays the run's own schedule: **3,054 games to reach `omit-weather` pair #177**, 481.8 s.

```
turns     9   medicham raw lines 153   showdown raw lines 152
stopped   the first divergent LINE
>>>>  THE SPLIT — index 146. They agreed for 146 reduced lines.  <<<<

  0146  SD    |faint|p2b: Primarina
  0146  US    |-status|p1b: Sinistcha|brn|[from] ability: spicyspray|[of] p2a: Scovillain
```

**The previous pass's "NOT REPRODUCIBLE standalone" was a fact about the fixture.** It staged turn 9
directly; the game only exists at pair #177 of a 3,054-game schedule, because `chooseAction` ranks
candidates off counters that accumulate across the whole run.

The teams the replay printed, which is where the answer was:

```
P1  floette-eternal  floettite  flowerveil   dazzlinggleam, drainingkiss, calmmind, protect
    garchomp         garchompite sandveil    ...
    sinistcha        leftovers  hospitality  matchagotcha, ragepowder, lifedew, protect
    sneasler         mentalherb unburden     ...
P2  scovillain       scovillainite moody     flamethrower, gigadrain, protect, ragepowder
    primarina, aerodactyl, garchomp
```

Sinistcha is **Grass**/Ghost. Its partner on that turn is a **Floette-Eternal carrying Flower Veil**.
The body it hit is a **Scovillain-Mega**, whose only ability is **Spicy Spray**.

The two leads the brief ruled out were re-checked and stay ruled out: the burned body does not faint
(it is at 126/146 when the drain finishes), and Champions overrides nothing in `spicyspray` beyond
`isNonstandard: null` (`data/mods/champions/abilities.ts:85-88`).

## 3. What refused it on the authority

`data/abilities.ts:4456-4467` — the handler that fires:

```ts
spicyspray: {
  onDamagingHit(damage, target, source, move) {
    if (!source.trySetStatus('brn', target) && !source.status && source.hasType('Fire')) {
      this.add('-immune', source);
    }
  },
  flags: {},
}
```

`trySetStatus(status, source)` — **the second argument is the SOURCE, and it is the ability HOLDER**
(`sim/pokemon.ts`, `trySetStatus` → `setStatus(this.status || status, source, ...)`). So the status
reaches `runEvent('SetStatus', this, source, sourceEffect, status)` carrying a source, and every
handler that asks who is doing it runs.

Flower Veil's is one of them (`data/abilities.ts`, `onAllySetStatus`; `flags: {breakable: 1}`):

```ts
onAllySetStatus(status, target, source, effect) {
  if (target.hasType("Grass") && source && target !== source && effect && effect.id !== "yawn") {
    if (effect.name === "Synchronize" || effect.effectType === "Move" && !effect.secondaries) {
      this.add("-block", target, "ability: Flower Veil", `[of] ${effectHolder}`);
    }
    return null;
  }
}
```

Every clause is satisfied — Sinistcha is Grass, the source exists and is not the target, the effect is
not Yawn — so it returns `null` and the burn never lands. **And it says nothing**: `effect.name` is
`"Spicy Spray"`, which is neither `"Synchronize"` nor a Move, so not even a `-block` is written. That
is precisely why the authority's next line is simply the faint.

### Staged in the official simulator before anything was edited

Sinistcha (Matcha Gotcha) into a Spicy Spray body, `new Battle({formatid: gen9championsvgc2026regmb,
seed:[1,2,3,4]})`, the ally's ability as the only knob:

```
ally Symbiosis      |-heal|p1a: Sinistcha|126/146|[from] drain|[of] p2a: Scovillain
                    |-status|p1a: Sinistcha|brn|[from] ability: Spicy Spray|[of] p2a: Scovillain
                    |-damage|p1a: Sinistcha|117/146 brn|[from] brn      -> status "brn", 117/146

ally Flower Veil    |-heal|p1a: Sinistcha|126/146|[from] drain|[of] p2a: Scovillain
                    (nothing at all — no -status, no -block)            -> status "",    126/146

Safeguard up        (nothing at all — no -status, no -activate|…|move: Safeguard)
                                                                        -> status "",    126/146
```

The Safeguard arm is the same rule through a different handler
(`safeguard.condition.onSetStatus`, `data/moves.ts:15589-15597`, read whole; the mod overrides no
`safeguard` key):

```ts
if (!effect || !source) return;
if (effect.id === 'yawn') return;
if (effect.effectType === 'Move' && effect.infiltrates && !target.isAlly(source)) return;
if (target !== source) {
  this.debug('interrupting setStatus');
  if (effect.id === 'synchronize' || (effect.effectType === 'Move' && !effect.secondaries)) {
    this.add('-activate', target, 'move: Safeguard');
  }
  return null;
}
```

**The refusal is unconditional once there is a source; the LINE is not.**

## 4. What this engine did instead

`engine/medicham2-browser.js`, the `punishesAttacker` consumer (WIRE 5):

```js
const _land=applyStatus(m,CODE_OF_STATUS[_inf.status]||_inf.status,null,ATTR.ability(tg.ability,tg));
//                                                                 ^^^^
//                                     the SOURCE slot, written null with the source in scope as `tg`
```

`null` is not `undefined`, and that distinction is load-bearing in the reader:

```js
function allyRefusesStatus(t,st,src){
  ...
  if(src===undefined){MEDSEEN.allyVeilSourceUnknown++;}   // unknown -> counted, and STILL refuses
  else{
    if(p.needsSource&&!src)continue;                      // null -> skips the veil entirely
    if(p.notFromSelf&&src===t)continue;
  }
  return h;
}
```

Flower Veil's tag row carries `needsSource: true` (derived from the handler's `source &&`), so the
`else` branch skipped it. **One null disarmed three guards the authority runs**:

| guard | how it was disarmed |
|---|---|
| `allyRefusesStatus` — the veil family | `p.needsSource && !src` → `continue` |
| `sideBuffRefuses` — Safeguard | `if(!t||!src||src===t)return null;` |
| the Synchronize reflect | `if(_sy&&src&&src!==t&&…)` |

The Synchronize block's own header had already predicted this: *"a future caller that DOES pass a
source would silently start reflecting"*. It is that caller, and passing the source is correct there —
`synchronize.onAfterSetStatus` (`data/abilities.ts:4849-4858`) reflects any non-slp/frz,
non-toxicspikes status back at its source.

## 5. The population, printed before the wire

`data/tags.json`. Five abilities reach that call site with a status:

| ability | sheets | trigger | inflicts |
|---|---|---|---|
| Static | 1,171 | contact | paralysis @ 0.3 |
| Flame Body | 630 | contact | burn @ 0.3 |
| Poison Point | 165 | contact | poison @ 0.3 |
| Effect Spore | 40 | contact | sleep 0.11 / paralysis 0.10 / poison 0.09 |
| Spicy Spray | 0 | anyHit | burn @ 1 |

Spicy Spray's 0 is not an absence: it is a MEGA ability, so it carries no base-sheet count. It is
Scovillain-Mega's only ability (`Dex.forFormat(...).species.get('scovillainmega').abilities`
= `{"0":"Spicy Spray"}`).

Three abilities can refuse one: **Flower Veil 8,939 sheets** (`statuses: "all"`, `except: ["yawn"]`,
`onlyGrassTypes`, `needsSource`, `notFromSelf`, `coversSelf`), **Sweet Veil 53** (`["slp"]`), and
**Aroma Veil 136** — whose `statuses` list is **empty**, so it refuses no status at all and is not a
member of this change. One move can: **Safeguard, 44 uses**.

## 6. What changed

Three edits, all in `engine/medicham2-browser.js`.

1. **The source slot.** `applyStatus(m, status, PUNISH_STATUS_SOURCELESS ? null : tg, ATTR.ability(...))`.
   `tg` is the punish HOLDER, which is what `source.trySetStatus(status, target)` names.
   Counter `MEDSEEN.punishStatusSourced`. Knob **`MEDI_PUNISH_STATUS_SOURCELESS=1`**, stamp
   `MEDFAILS.punishStatusSourcelessRestored`, set at LOAD.

2. **The Safeguard `-activate` gate**, in `applyStatus`'s side-buff branch. The comment there
   *declared* the gate instead of asking it — *"the authority emits it for a MOVE with no secondaries,
   which is exactly the direct status-move path this engine routes here"* — and that stopped being
   true the moment an ability-sourced status could reach the branch. It silences only what it
   positively knows (`eff.kind === 'ability'`); a MOVE announces as before; an **absent** effect
   announces as before and is counted at `MEDFAILS.sideBuffLineEffectUnknown`, because a caller that
   named nothing and a caller that named an ability must not arrive at the same answer by default.
   Counter `MEDSEEN.sideBuffLineSilent`. Knob **`MEDI_SIDEBUFF_LINE_UNGATED=1`**, stamp
   `MEDFAILS.sideBuffLineUngatedRestored`.

   **This half was not optional.** Opening the Safeguard road to five more abilities with an ungated
   line would have been a NEW narration parting created by the first fix. It was already reachable
   through Poison Touch (`applyStatus(tg,'psn',m,ATTR.ability(...))`), which is why it is fixed here
   rather than filed.

3. Counter and stamp declarations beside their neighbours.

Both stamps are listed in `DELIBERATE_BREAK` in `tests/test-mechanics.js`, so a red demonstration
cannot write the census.

## 7. The probe

`tests/probe_punish_status_source.js`. Every body and ability is **derived**, never typed: the
punisher is chosen as the `punishesAttacker` row whose `inflicts` chances sum to 1 (so no die can
decide an arm), the veil as the `protectsAllyFromStatus` row carrying `needsSource` and a type gate,
and the carriers are looked up in `MC.mons` by the ability they hold. The run prints all of it.

Ten arms. Three are the defect; the rest are the controls an over-firing fix breaks:

| arm | what it holds |
|---|---|
| CONTROL | with no veil beside it, the punisher burns the body that hit it |
| **DEFECT** | the partner's Flower Veil refuses the burn on a GRASS body |
| narration | the refusal writes NO `-block` — a punish ability is not Synchronize and not a Move |
| **knob** | the veil knob MOVES the outcome (identical readings = the slot is unwired) |
| negative | a NON-Grass body beside the same veil is still burned — `hasType('Grass')` survives |
| negative | the veil standing beside the PUNISHER does not shield the attacker — it belongs to a side |
| **DEFECT** | our own Safeguard refuses the punish burn too |
| narration | and it announces NOTHING |
| REGRESSION | a foe's direct status MOVE under the same Safeguard is still refused AND still announces |
| negative | the hit itself is untouched on every arm |

```
node tests/probe_punish_status_source.js                                  -> exit 0
MEDI_PUNISH_STATUS_SOURCELESS=1 node tests/probe_punish_status_source.js  -> exit 1   (2 arms red)
MEDI_SIDEBUFF_LINE_UNGATED=1    node tests/probe_punish_status_source.js  -> exit 1   (1 arm red)
```

**The probe was red before the engine was touched** — 3 FAILED, on exactly those three arms, with
every control and every negative already green.

### One probe bug found and recorded rather than quietly fixed

The first cut read `holder.curHP < holder.maxHP`. A built body carries `curHP` and `st.hp` and **no
`maxHP`**, so the comparison is `NaN` and reads false on every arm — it called the fixture dead while
the burn was landing in front of it. It is now read off the holder's HP before and after, and the
reason is written at the line.

## 8. The census

`node tests/test-mechanics.js` — **996 live / 996 probed / 0 missing → 998 / 998 / 0.** Exit 0.
Two rows, both quoting the authority's literal protocol lines from the staging in §3:

- `ability / punishesAttacker` — *a punish status carries its HOLDER as its source, so an ally veil can refuse it*
- `move / sideBuff` — *a Safeguard refuses an ABILITY-sourced status and says nothing about it*

## 9. Which scoreboard this should move, said before the run

**Both.** The lab (census, roster) must move because the mechanic is staged there. The pinned pool
must move too, and by exactly one game — this IS the pool's last board parting, and the fix is aimed
at it by seed.

## 11. The before and after, on one release, with the knob as the only variable

Worktree release **`d16f5e12caaa`** (27 files frozen, cut after the fix), same seed, same config,
same pins, same `--games 12000`, same full 3,054-game warm-up. The ONLY difference between the two
runs is the environment variable.

| | `MEDI_PUNISH_STATUS_SOURCELESS=1` (defect restored) | no knob (fix live) |
|---|---|---|
| turns played | 9 | **19** |
| raw lines | medicham 153, showdown 152 | **medicham 270, showdown 270** |
| stopped because | the first divergent LINE | **both engines ended the battle** |
| splits | 1, at reduced index 146 | **0** |
| wall clock | 293.6 s | 294.1 s |

The knob-on run matches the artifact's stored record of this game on every field the tool checks:
`agreed lines 146` ok, `showdown line at split |faint|p2b: Primarina` ok, `medicham line at split
|-status|p1b: Sinistcha|brn|[from] ability: spicyspray|[of] …` ok, `class extra event emitted by
medicham2` ok. The one DIFF is the stop reason, because `replay_one` halts at the first divergent
line while the whole-game run plays past it — that is the tool, not the game.

**So this worktree's base bytes reproduce the parting exactly, and the fix closes it.** The game then
runs ten more turns to a finish with the two engines in complete agreement.

## 12. Regression sweep

Every probe that touches the changed code, run after the fix:

```
 0  probe_ally_safeguard.js                    all checks passed
 0  probe_damaginghit_order.js
 0  probe_damaginghit_walk.js
 0  probe_innards_out.js
 0  probe_misty_terrain_status.js              green — every assertion held
 0  probe_punish_announce.js                   ALL CLAUSES HELD
 0  probe_punish_side_and_sky.js               ALL CLAUSES HELD
 0  probe_safeguard_volatile_infiltrator.js    all checks passed
 0  probe_fail_and_silent.js                   6 staged, 0 parted
 0  probe_refusal_this_engine_swallowed.js
 0  probe_unshared_reaction_dice.js
```

`tests/probe_narration_a.js` exits 2 with *"REFUSING TO RUN — pass `--release <id>`"*, which is its
harness requirement and not a result.

## 13. What is owed

- **The engine bytes moved.** The gate, the three lattices (`--games` 1200 / 1350 / 1950) and the
  held-out `--games 12000` draw are all owed a re-run on the merged tree. `status.js` withholds the
  differential, all three roster stages and `all-mechanics-fire.json` until then.
- **This worktree is behind main.** Release `c2d68f8cab07` carries four fixes this branch does not
  (the Encore override's live-foe clause, the charge-turn boost sign, the Substitute secondary die,
  the hoisted shield-before-bounce). The replay in §2 was run against the FROZEN `c2d68f8cab07`
  bytes, copied in; the before/after in §11 was run against this worktree's own release
  `d16f5e12caaa` with the knob as the only variable, which is why the knob exists.
- `data/engine-release.json` is restored to its committed contents at the end of this pass.
