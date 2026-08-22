# THE UNREGISTERED MECHANISMS FROM THE WIRE QUEUE — FILED, AND THREE OF THE REPORT'S CLAIMS DID NOT SURVIVE

Historical findings record. Not maintained, not current state, never cite as such.
Superseded by the register rows it feeds.

Input: `docs/_reports/2026-08-22-wire-queue.md` (the 121 whole-game divergences grouped into 35
mechanisms, of which it named 13 with no register row plus 1 regression of a closed row).

**Register work only.** `docs/ROADMAP.md` and this file were the only files written. No engine, no
test, no data artifact, no commit, no push. `engine/quarantine.js`, `tests/roster.js`,
`engine/game_differential.js`, `tests/test-engine-diff.js` and `engine/status.js --write` were NOT
run. Nothing was re-measured; every number below is read out of a committed artifact or derived from
the Showdown checkout, and each is stamped with which.

---

## 1. WHAT WAS FILED

**Eleven new rows, `#351`–`#361`. Three REOPENS of closed rows, `#223`, `#224`, `#289`.** Fourteen
register actions covering the report's 13 unregistered mechanisms plus its 1 regression.

The report's grouping was changed in four places, each for a reason stated below:

| the report said | what was filed | why |
|---|---|---|
| ZERO-MAGNITUDE boost is unregistered | **REOPEN `#289`** | `#289` IS that mechanism, closed 2026-08-18, and its fix is opt-in per call site. Two sites did not opt in |
| REGENERATOR switch-out heal is unregistered | **REOPEN `#223`** | `#223` owns it and closed it on a MAINLINE read of an ability this format OVERRIDES |
| Poltergeist / Telepathy / Substitute = one row | **three rows, `#358` `#359` `#360`** | Substitute is not an announcement shape at all — see §4 |
| MULTI-HIT COUNT is a defect | **`#361`, no verdict** | it does not reproduce on the current artifact |

---

## 2. THE TWO ARTIFACTS ARE NOT THE ONE THE REPORT READ, AND THAT IS THE FIRST THING TO SAY

The wire-queue triage read `data/game-differential.json` at **release `603d9a69d5a3`, generated
2026-08-22T06:47Z**. That file has since been regenerated and committed (`239dd16`): the artifact on
disk now reads **release `13ba05093aa3`, generated 2026-08-22T19:15:31Z, 961 games, 126 raw
divergences across 116 cause strings** — the same headline as the report, and the same mode string
`A/middle/pins:1fd77b835ee2/credit:observed-effect/v1/nature:real`.

Every per-mechanism count in the report was therefore re-derived here against the CURRENT artifact
rather than carried across. **Ten of the eleven reproduce exactly** (Moody 8, weather `[upkeep]` 5,
zero-magnitude 5, switch order 3, flinch 2, Tailwind 2, Regenerator 1, Protean 1, Poltergeist 1,
Telepathy 1, Substitute 1, `??:` 1). **One does not: MULTI-HIT COUNT.** `scaleshot` appears twice in
the current artifact and both are coverage lists, not divergence causes.

**And the tree has already moved past both.** `data/engine-release.json` reads **`97252065ac4b`, cut
2026-08-22T19:30Z**, *"ROADMAP #317 Fur Coat: condStatMult derives when:always, dmgRange spends it"*
— cut while this task was running. Under `#298`'s rule every figure in the new rows describes
release `13ba05093aa3` and says so; none of them describes the live tree.

The honest headline from the current artifact, which is not the one usually quoted:
`mid_void.diverged_rate_over_usable = 0.1293` — **124 of 959 usable games**, 2 void.

---

## 3. THE THREE CLAIMS FROM THE REPORT THAT DID NOT SURVIVE A CHECK

### 3.1 MOODY's second instrument now reads MATCH

The report's strongest argument for Moody was corroboration: *"`moody` is one of the eight
`FIRED-AND-BOARDS-DIFFER` abilities on the roster (Glalie `boosts.atk 0 / +2`, `def 0 / -1`,
`spa -1 / 0`)"*.

`data/roster.abilities.json`, **generated 2026-08-22T19:08:07Z on release `13ba05093aa3`** — the
same release as the differential, run 7 minutes before it — reads:

```
moody | ability/residual | verdict: FIRED-AND-BOARDS-MATCH
  second_control: Ice Body, ran: true — "THE TWO DELTAS DIFFER on 28 leaf/leaves, which means at
  least one control is LIVE on this fixture ... 24 of 38 leaf/leaves survive BOTH controls and the
  verdict is computed on those alone."
```

The DIFFER the report cited was a fixture whose control was live; the row now carries a second
control, and on the leaves that survive both controls the boards MATCH. **Moody stands on the
differential alone.**

### 3.2 AND THE DIFFERENTIAL CANNOT SAY THE TWO ENGINES SHARE MOODY'S DIE

The report: *"Under the middle arm's pinned dice both engines draw the same value at the same
address, so this is a stat-SELECTION or draw-ORDER difference, not randomness."*

That premise is not supported by the instrument. `engine/game_differential.js:965-971` wraps exactly
**three** authority methods to derive a die's category — `hitStepAccuracy` → `acc`,
`secondaries` → `sec`, `getDamage` → `dmg` (with `crit` split out of it) — with its own comment
*"THE CATEGORY IS DERIVED FROM WHICH METHOD IS EXECUTING"*. Moody's draw is `this.sample(stats)`
inside `abilities.ts onResidual`; it executes in none of the three. The artifact's own address ledger
confirms the scope: `mid_void.unshared_address_shapes` holds 12 entries and **every one is `acc`,
`crit` or `dmg`**, and `low_identity_by_category` names the same three.

So whether the two engines even receive the same `u` at Moody's residual is **not established by
this run**, and the MORPEKO precedent (`#328`, two of three causes were the instrument) is exactly
what that shape looks like.

**Both selection rules were read and they agree**, which is what makes the die the live question:

- authority, `data/abilities.ts:2691-2719` (Champions does not override `moody`): two `this.sample`
  draws, the first over boosts `< 6`, the second over boosts `> -6` excluding the stat just raised,
  both excluding accuracy and evasion, iterating `pokemon.boosts` key order `atk, def, spa, spd, spe`;
- ours, `engine/medicham2-browser.js:23030-23042`: `_ST = ['at','df','sa','sd','sp']`, `_pool(k => m.boosts[k] < 6)`,
  then `_pool(k => m.boosts[k] > -6 && k !== _plus)`, picked with `Math.floor(rng()*l.length)`.

Same membership, same order, same count of draws, same mapping of a uniform to an index. **What is
left is the draw itself.**

### 3.3 SUBSTITUTE IS NOT AN ANNOUNCEMENT SHAPE

The report filed it under the emission-only tail: *"`-end substitute` vs our `-activate substitute
[damage]`"*. Those two lines are the two branches of ONE `if` in `data/moves.ts:18350-18355`:

```js
if (target.volatiles['substitute'].hp <= 0) {
  if (move.ohko) this.add('-ohko');
  target.removeVolatile('substitute');        // -> the condition's onEnd writes |-end|...|Substitute
} else {
  this.add('-activate', target, 'move: Substitute', '[damage]');
}
```

`-end` means the substitute BROKE and `-activate [damage]` means it SURVIVED. They are mutually
exclusive states, so the cause
`extra event emitted by medicham2 :: |-end|p2a|substitute <> |-activate|p2a|substitute|[damage]` is a
substitute-HP disagreement — board-material — not a naming difference. Filed as `#358` on that
basis, with the cause left unprobed.

---

## 4. THE ONE THAT IS WORTH MORE THAN THE ROW IT CORRECTS — REGENERATOR, `#223`

`#223` closed on 2026-08-12 with an 80-game improvement attributed to REMOVING our `-heal` line, and
its stated reason is a source derivation:

> *"the deciding detail is one word: the ability calls `pokemon.heal()` — `Pokemon#heal` trims,
> mutates `this.hp`, RETURNS THE DELTA and adds nothing, while `Battle#heal` is what emits `-heal`.
> So the authority is silent by construction and we were producing a line it never makes."*

That is true of `data/abilities.ts:3823-3831`. **It is not true of this format.**
`data/mods/champions/abilities.ts:77-84`, in the pinned checkout `20ad99ffc9a5` (the same commit the
artifact stamps as `showdown_commit`):

```js
regenerator: {
  inherit: true,
  onSwitchOut(pokemon) {
    if (pokemon.heal(pokemon.baseMaxhp / 3)) {
      this.add('-heal', pokemon, pokemon.getHealth, '[from] ability: Regenerator', '[silent]');
    }
  },
},
```

**Champions overrides Regenerator specifically to add the line.** This is the failure CLAUDE.md names
by name — *"Reading `/data/abilities.ts` is reading MAINLINE"* — inside a row that closed on being
"decided from the source rather than by taste".

The current artifact carries the divergence pointed the other way:

```
event missing from medicham2 :: |-heal|p1a|H/H|[from]regenerator <> |switch|p1a|aurorus,l50|H/H
  SD:  |-heal|p1a: Slowbro|170/170|[from] ability: Regenerator|[silent]
  MED: |switch|p1a: Aurorus|aurorus, L50|198/198
```

and `engine/medicham2-browser.js:13474-13497` still suppresses the emission by design, citing that
derivation in its own comment (*"ROADMAP #223 — AND IT HEALS SILENTLY. THE AUTHORITY EMITS NO LINE
FOR THIS"*).

**What is NOT claimed.** The 80-game improvement is not called false here. It cannot be explained by
the stated mechanism, and one game rather than dozens reaching the comparator (Regenerator is 6.08%
of teams) points at first-divergence truncation mediating it. Whether the improvement is real is
UNPROBED and the row says so. The checkout was checked and has NOT moved:
`data/mods/champions/abilities.ts` last changed in `077fb45`, well before 2026-08-12, and the
checkout HEAD `20ad99ffc9a5` (2026-07-22) equals the artifact's `showdown_commit`. **The authority
did not change under us; the file we read was the wrong one.**

---

## 5. THE ROWS, WITH WHAT WAS OBSERVED AND WHAT WOULD DECIDE EACH

All counts are from `data/game-differential.json`, release `13ba05093aa3`, 961 games, 126 raw / 121
non-declared divergences, unless another artifact is named.

| row | mechanism | observed | verdict filed |
|---|---|---:|---|
| `#351` | MOODY picks a different stat | 8 | **no verdict** — engine or instrument NOT ADJUDICATED |
| `#352` | weather `[upkeep]` never emitted | 5 | engine DEFECT on the `wSup` gate (derived); the 5 games NOT attributed to it |
| `#353` | `\|switch\|` order among simultaneous switches | 3 | **no verdict** — authority's key derived, ours unprobed |
| `#354` | FLINCH where the authority moves | 2 | **no verdict** — cause unprobed |
| `#355` | Tailwind two-side `-sideend` order | 2 | **no verdict** — ordering, not a die |
| `#356` | PROTEAN on a mega forme | 1 | engine DEFECT — two instruments, one release, board-material |
| `#357` | RAGE FIST / `timesAttacked` | 1 | engine DEFECT — derived, the state is not tracked |
| `#358` | SUBSTITUTE break against survive | 1 | **no verdict** — board-material, cause unprobed |
| `#359` | POLTERGEIST `-activate` not emitted | 1 | engine DEFECT (emission), derived from the format |
| `#360` | TELEPATHY announcement shape | 1 | engine DEFECT (emission shape), derived from the format |
| `#361` | MULTI-HIT COUNT | 1, on the SUPERSEDED artifact | **no verdict** — not reproduced |
| `#223` | REGENERATOR switch-out heal | 1 | REOPENED — engine DEFECT, mainline read |
| `#224` | `??:` off-field slot placeholder | 1 | REOPENED — regression |
| `#289` | zero-magnitude boost at the cap | 5 | REOPENED — the opt-in did not reach two sites |

### `#351` MOODY — 8, no verdict

Causes (current artifact): `-boost field 3` ×6 and `-unboost field 3` ×2, always magnitude `2` and
`1` on BOTH sides with only the stat identity differing — so both engines chose a raise and a drop,
and the selection is what parts. Evidence and its limits are §3.1 and §3.2.

**What would decide it:** print the address string each side uses for the Moody residual draw, on the
same staged residual, and compare — i.e. extend the arm's category wrapper past the three
`BattleActions` methods, or accept that a residual ability draw is unshared and say so in the
artifact. Only then is a stat-selection probe meaningful.

### `#352` WEATHER `[upkeep]` — 5, a derived defect that probably does not explain its own five games

Authority, `data/conditions.ts:504-508`, not overridden by Champions (`data/mods/champions/conditions.ts`
contains no `raindance`, no `sandstorm`, no `onFieldResidual`):

```js
onFieldResidualOrder: 1,
onFieldResidual() {
  this.add('-weather', 'RainDance', '[upkeep]');
  this.eachEvent('Weather');
},
```

Unconditional. Ours, `engine/medicham2-browser.js:22880`:

```js
if(TR){if(field.weather&&!field.wSup)TR.wx(field.weather,null,null,true);else if(_wx0&&!field.weather)TR.wxNone();}
```

`field.wSup` is a suppression flag the authority's residual does not consult, so under a suppressor
we go silent where the authority still writes the line. **That much is a defect and it is derived.**

**It probably does not explain these five games.** `suppressesWeather(m)` is
`TAGS.param('ability', m.ability, 'weatherSuppression')` and **`cloudnine` is the only carrier of that
param in `data/tags.json`**. I read the four actives in every one of the five games and none carries
Cloud Nine (Raichu/Starmie/Annihilape/Sneasler; Archaludon/Venusaur/Whimsicott/Raichu;
Greninja/Gengar/Archaludon/Kingambit; Maushold/Pelipper/Farigiraf/Heracross). If `wSup` is false then
the else-branch decides, and it emits nothing only when `_wx0` is ALSO falsy — **a sky that is
already gone on our side with no `-weather|none` ever emitted**, which is board-material (rain
multipliers, Swift Swim, Thunder) rather than an announcement.

Two of the five sit at `agreed_lines: 17`, turn 2, immediately after **all four actives switched
out** — in one of them the rain was set by a Pelipper Drizzle inside the agreed prefix, so our
engine did have the sky.

**What would decide it:** stage rain from Drizzle, switch the setter out, and read `field.weather` and
`field.weatherT` on both engines on the following turn. Then a separate one-line arm with a Cloud
Nine body for the gate itself.

### `#353` `|switch|` ORDER — 3, no verdict

Authority's key, derived and verified line by line: `sim/battle-queue.ts:270`
`if (!deferPriority) this.battle.getActionSpeed(action);` → `sim/battle.ts:2657`
`action.speed = action.pokemon.getActionSpeed();`, and `SwitchAction` (`sim/battle-queue.ts:56-69`)
documents its own fields — `pokemon` is *"the pokemon doing the switch"* (OUTGOING) and `target` is
*"pokemon to switch to"*. So the `|switch|` line order is keyed on the DEPARTING body's speed.

Receipt: `ordering :: |switch|p1b|whimsicott,l50|H/H <> |switch|p1a|alakazam,l50|H/H`, turn 2, a
same-side double switch; plus `|switch|p1a|staraptor <> |switch|p2a|incineroar` and
`|switch|p1a|palafin <> |move|p2b|helpinghand`.

`#330` does not cover this — `#328` says so in as many words: `switchin_order.js` governs entry
ABILITY order, not which `|switch|` lines are emitted.

**What would decide it, and an instrument gap found while looking:** `MEDFAILS.entryOrderTie` and
`MEDFAILS.replaceOrderTie` are the engine's own declared approximations — on equal departing speeds
it keeps side order where Showdown shuffles, *"because drawing a number here would move the RNG
stream of every seeded run in the repo"* (`medicham2-browser.js:1866-1874`). **Neither counter is
published in `data/game-differential.json`**, so the artifact cannot distinguish a declared tie from
an ordering defect. Publish them, then stage two double-switches with a known speed spread.

### `#354` FLINCH — 2, no verdict

`|-immune|p1b <> |cant|p2a|flinch` and `|move|p2a|psychicfangs <> |cant|p2a|flinch`. In the second,
the authority's Metagross MOVES and ours cannot. Board-material in both directions.

Unlike Moody, this draw IS inside the arm's addressed set — `secondaries` is one of the three wrapped
methods (`sec`) — so a shared-die argument is available here and is not available there. `#84` is
the adjacent `false`-vs-`null` question and is CLOSED; this is not it.

**What would decide it:** Fake Out into a body under the same pinned `sec` stream, and assert
`|cant|...|flinch` fires on both or neither.

### `#355` TAILWIND, BOTH SIDES — 2, no verdict

One cause, `n=2`: `ordering :: |-sideend|p2:|tailwind <> |-sideend|p1:|tailwind`. `#242` is CLOSED and
placed Tailwind at `onSideResidualOrder 26 / subOrder 5` on both sides; it settled WHERE in the walk,
never WHICH SIDE first when both expire on the same turn.

**It is not a die.** `engine/game_differential.js:2854` installs `battle.prng.shuffle = ARM.shuffle`,
the identity, in every arm — so Showdown's `speedSort` tie resolution is deterministic on input
order here and the two `-sideend` lines are comparable.

**What would decide it:** Tailwind up on both sides, same expiry turn, assert which `-sideend` lands
first; and read `findSideEventHandlers` / `speedSort`'s input order for the authority's answer.

### `#356` PROTEAN ON A MEGA FORME — 1, engine DEFECT, two instruments on one release

Differential: `|-start|p1b|typechange|normal|[from]protean <> |-singleturn|p1b|protect`.

Roster, `data/roster.items.json`, release `13ba05093aa3`, generated 2026-08-22T19:07:58Z —
`greninjite`, `FIRED-AND-BOARDS-DIFFER`, and its `diffs` are **four leaves and all four are the same
fact**:

```
turn 1 party.types  showdown normal  ours dark/water
turn 1 p2a types    showdown normal  ours dark/water
turn 2 party.types  showdown normal  ours dark/water
turn 2 p2a types    showdown normal  ours dark/water
```

Derived from the format, not typed: `D.species.get('greninjamega').abilities` is `{"0":"Protean"}`,
`D.moves.get('protect')` is type **Normal**, category Status — which is why the authority retypes to
Normal on a Protect click and then writes `-singleturn`. Our body stays Water/Dark.

**Board-material and not an announcement**: every damage calculation after it reads the wrong types.

### `#357` RAGE FIST — 1, engine DEFECT, derived

`-damage field 3 :: |-damage|p2a|0fnt <> |-damage|p2a|H/H` — Annihilape's Rage Fist into a 43/170
Avalugg-Hisui: `SD |-damage|p2a: Avalugg|0 fnt`, `MED |-damage|p2a: Avalugg|15/170`.

The power law, derived: mainline `data/moves.ts:14578-14592`
`basePowerCallback(pokemon) { return Math.min(350, 50 + 50 * pokemon.timesAttacked); }`, and Champions
**does** override the entry (`data/mods/champions/moves.ts:787-791`) — `inherit: true` with the
Champions rule stated in its own text: *"X cannot be greater than 6 and resets to 0 when the user
leaves the field"*, implemented in `Pokemon#clearVolatile`.

Ours: `data/tags.json` gives `ragefist` the tag `needsUntrackedState` with the param
`{"needs":"times hit -- NOT TRACKED"}` and `variablePower {"computed":true,"note":"idiom not yet
derivable"}` — one of the twelve with no `kind`, so no branch of the `variablePower` consumer
(`medicham2-browser.js:6726`) applies and the base power stays at the dex 50. **`timesAttacked`
appears in `engine/medicham2-browser.js` exactly once, inside a comment citing Showdown**; nothing
reads it. `needsUntrackedState` has no consumer anywhere under `engine/` outside `tag_dex.js`.

`#283` and `#287` are `board.js` and the seed audit; neither is the simulator.

### `#358` SUBSTITUTE — 1, no verdict, board-material

See §3.3.

### `#359` POLTERGEIST — 1, engine DEFECT (emission), derived

`data/moves.ts:13607-13612`, not overridden by Champions:

```js
onTry(source, target) { return !!target.item; },
onTryHit(target, source, move) {
  this.add('-activate', target, 'move: Poltergeist', this.dex.items.get(target.item).name);
},
```

Observed: `SD |-activate|p2b: Metagross|move: Poltergeist|Scope Lens`, ours goes straight to
`|-supereffective|p2b: Metagross|1`. The observed instance is emission-only — the refusal half
(`onTry`) is not what parted here. 1,093 clicks, and `move:poltergeist` is independently divergent on
`all_mechanics_fire` per the wire-queue triage (not re-verified here).

### `#360` TELEPATHY — 1, engine DEFECT (emission shape), derived

`data/abilities.ts:4923-4929`, not overridden by Champions:

```js
onTryHit(target, source, move) {
  if (target !== source && target.isAlly(source) && move.category !== 'Status') {
    this.add('-activate', target, 'ability: Telepathy');
    return null;
  }
},
```

`-activate ... ability: Telepathy`, then `return null` — *handled, stay silent*, which is exactly
`#342`'s four-valued result. Ours writes `|-immune|p2a: Oranguru|[from] ability: telepathy`: the
right board, the wrong line type and the wrong shape.

### `#361` MULTI-HIT COUNT — observed once, NOT REPRODUCED, no verdict

The wire-queue read one game on release `603d9a69d5a3` where Showdown's Scale Shot hit **4** times
and ours hit **5**. On the current artifact (`13ba05093aa3`, 961 games) `scaleshot` appears twice and
**both occurrences are coverage lists, not divergence causes**. It is not in the cause table at all.

Three explanations and nothing here separates them: it was fixed between the two releases; the game
that carried it now stops at an earlier divergence; or the pool moved. **No verdict is filed.**
`#103` (the count was the mean) is DONE and this is not that defect — a constant 3.1 cannot produce a
5 — and `#333` is multi-hit DAMAGE. The count's draw is
`sim/battle-actions.ts` `random(h[0], h[1]+1)`, which is **outside** the arm's three wrapped methods,
so it carries the same address caveat as Moody.

**What would decide it:** re-read the causes of the run that produced it, or stage Scale Shot under a
pinned die and assert the same number of `-damage` lines. Not worth an evening at 1 game.

---

## 6. THE THREE REOPENS

Filing any of these fresh would have lost the history that they were once fixed, which is the whole
value of the row.

- **`#224`** — `??:` off-field slot placeholder. Closed 2026-08-18 on a measurement
  (*"995 games, release `978ca8fe72c9`: 0 `??:` occurrences, engine counter 0, gate exits 0"*). The
  current artifact carries `declared_gaps.trace_body_off_field = 4`, `trace_body_off_field_first =
  "farigiraf"`, and exactly one `??:` in the whole file, in the cause
  `extra event emitted by medicham2 :: |upkeep <> |move|??:farigiraf|roar`. Both of the gate's own
  arms are red. `engine/gate_offfield_target.js` is the instrument and it was NOT run: the artifact is
  release `13ba05093aa3` and the live release is `97252065ac4b`, so the gate would refuse the artifact
  as stale (its own `#298` rule) rather than answer the question.
- **`#289`** — zero-magnitude boost at the cap. Closed 2026-08-18, and its own text says the fix is
  **opt-in per call site** with three sites opted in. Five divergences remain and the two with a
  readable context are both MOVE-primary status moves:
  `SD |-unboost|p1a: Metagross|atk|0` after `|move|p2a: Incineroar|Parting Shot` (we emit only the
  `spa|1` half), and `SD |-unboost|p1a: Ceruledge|atk|0` after `|move|p2b: Whimsicott|Charm` (we emit
  nothing). Authority: `sim/battle.ts:2076-2077` — for an effect that is a MOVE and neither
  `isSecondary` nor `isSelf`, `this.add(msg, target, boostName, boostBy)` fires with `boostBy === 0`.
  (The report cited `2079-2081`; the line in this checkout is `2076-2077`.)
- **`#223`** — Regenerator. §4.

---

## 7. `data/register-reality.json` — WHAT BRINGING IT CURRENT WOULD TAKE, AND WHY IT WAS NOT DONE

It is the artifact `openDefectClause` in `engine/quarantine.js` computes the *no open, known engine
defect* clause from, and it is stamped **2026-08-21 21:55**. The register has moved a long way since:
rows `#329`–`#350` were filed today before this task, and rows `#351`–`#361` plus three reopened
cells were filed by it. **None of them is visible to the gate**, and `#350` already records the
adjacent failure — the clause reads *"no instrument decides it"* when what it means is *"my verdict
artifact is older than that row"*.

**Bringing it current means running `engine/register_reality.js`, which RUNS the instruments the
register names.** That is a measurement, and while an ENGINE agent is editing the simulator and its
tests it is the photograph rule broken by definition: the verdicts would describe bytes that changed
between the first instrument and the last. `data/engine-release.json` moved to `97252065ac4b` at
19:30Z during this task, which is the evidence rather than the assumption.

**What it would cost, when the engine is quiet:**

1. the engine still, and a release cut first, so every verdict names one set of bytes;
2. `tools\lownode.cmd engine\register_reality.js` from PowerShell — it shells the gates the rows
   name, so its wall time is the sum of those gates, and the heavy ones in the set are the roster
   stages and the whole-game differential (tens of minutes each), not the register walk;
3. a re-read afterwards of `openDefectClause`'s output, because the clause counts rows whose STATUS
   CELL carries the token `DEFECT`. Checked with the canonical detectors themselves rather than by
   eye — `engine/quarantine.js`'s `roadmapRowIsClosed` and `roadmapRowSaysBroken` run over the
   edited register — **all 14 rows read OPEN, 8 assert an engine `DEFECT` (`#223` `#224` `#289`
   `#352` `#356` `#357` `#359` `#360`) and 6 deliberately do not** (`#351` `#353` `#354` `#355`
   `#358` `#361`). `NOT_A_DEFECT` is empty: nothing here was ruled on. The whole register now reads
   325 rows, 191 open, 42 asserting breakage, and `tests/test-roadmap-register.js` is 3/3.

**The six that deliberately do not are the point of the exercise.** `#351`, `#353`, `#354`, `#355`,
`#358` and `#361` describe divergences whose cause is not adjudicated between the engine and the
instrument. A row that overclaims is worse than a row that is missing: `#328` has already refuted one
ordering hypothesis in this area with a control, and §3.1 and §3.2 above are two more claims that did
not survive being checked. `NOT A DEFECT` was not used either — that cell is an explicit ruling, and
nothing here has been ruled on.

---

## 8. WHAT THIS TASK DID NOT DO

- **Nothing was re-measured.** No engine, no roster, no differential, no gate. Every count is read out
  of a committed artifact and every mechanic fact is either derived from
  `Dex.forFormat('gen9championsvgc2026regmb')` or cited to a source line in checkout `20ad99ffc9a5`.
- **The living-docs obligations were not discharged**, on instruction: no ledger entry, no CHANGELOG,
  no `status.js --write`, because `--write` rewrites generated blocks and `data/open-work.json` while
  another agent is live. These are register filings, not a model or result change.
- **`engine/gate_offfield_target.js` was not run** — see §6.
- **The `|faint| <> |-status| brn` row** the wire-queue flagged as possibly a Heat Wave secondary
  remains under FAINT (`#331`) and was not touched.
