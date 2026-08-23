# The board-material remainder: five mechanisms, 21 → 15, and one of the two "instrument" families was the engine

**ENGINE, 2026-08-23.** Historical record, per `docs/_reports/` convention. Not current state;
superseded by the register rows it feeds. Every figure is read out of `data/game-differential.json`,
`data/mechanics-census.json`, `data/roster.{items,abilities,moves}.json` or
`data/all-mechanics-fire.json`, or cited to a line in the pinned Showdown checkout.

---

## 0. VERDICT

**Five mechanisms landed. ENGINE board-material 21 → 15 games. Narration 34 → 34 — it did not rise.**

The brief handed over nine games as THE INSTRUMENT — Moody's stat pick (8) and one off-field
`??:farigiraf` body (1). **Both still hold.** What did not hold was the implicit assumption that the
other corner-zero family was instrument too: **Future Sight's two damage rows read zero in both
corners and are a REAL ENGINE DEFECT**, and the reason they read zero at the corners is stated in this
engine's own ROADMAP #304 comment — `band[0]` IS `d.max` and `band[15]` IS `d.min`, so an index and a
span coincide at exactly the two points a corner compares.

| # | mechanism | board-material games cleared | state? |
|---|---|---|---|
| 1 | **A field-driven forme follows a sky that was already there when the body arrived** (Forecast, Mimicry) | **2** | yes — `types` |
| 2 | **The delayed hit SELECTS out of the sixteen-roll band instead of interpolating a span** | **2** | yes — HP |
| 3 | **A STATUS move misses a semi-invulnerable body** (~40 action kinds, one gate) | **1** | yes — the whole effect |
| 4 | **Symbiosis answers a WHITE HERB spend, not only a berry** | **1** | yes — two `party.item` leaves |
| 5 | **The delayed hit writes its `-supereffective` / `-resisted` line** | 0 (narration; it is the follow-on #2 exposed) | no |

---

## 1. THE NUMBERS — A RE-BASELINE, NOT A DELTA

Arm **`middle`** (real dice, the default). Release **`3e00ea2575a9`**, `--games 1200` resolving to
**961 played games**, turn cap 12, `--end-state`, `--team-store data/team-pool-frozen`,
`--census data/verification/census-pin-9446a684709d.json` (the same 643-row pin the standing figure
used, so the steering is identical and the sample is the same 961 games).

```
SHOWDOWN_PATH=... tools\lownode.cmd engine\game_differential.js \
    --games 1200 --end-state --release 3e00ea2575a9 \
    --team-store data/team-pool-frozen \
    --census data/verification/census-pin-9446a684709d.json \
    --dump-games 200 --dump-out data/verification/divergence-turns-bmr.json --write
```

| quantity, arm `middle` | before (`985a28a22653`) | after (`3e00ea2575a9`) |
|---|---|---|
| protocol parted (raw `diverged`) | 64 | **58** |
| **undeclared = diverged − declared** (the published headline) | 59 of 961 = 6.1% | **53 of 961 = 5.5%** |
| distinct causes | 58 | **53** |
| **board-material games (all)** | 30 | **24** |
| of those, THE INSTRUMENT (Moody 8 + off-field 1) | 9 | **9** |
| **ENGINE board-material — THE GATE NUMBER** | **21** | **15** |
| narration-only games | 34 | **34 — did not rise** |
| unknown games | 0 | **0** |

Per arm, never pooled:

| arm | parted | board-material | of which instrument | ENGINE board-material | narration |
|---|---|---|---|---|---|
| `middle` (real dice, the default) | 58 | 24 | 9 (Moody 8, off-field 1) | **15** | 34 |
| `top-tie-first` | 53 | 16 | 0 | 16 | 37 |
| `bottom-tie-first` | 61 | 17 | 0 | 17 | 44 |

**THE MOODY SIGNATURE STILL HOLDS AND IT WAS RE-CHECKED RATHER THAN INHERITED.** The seven
`-boost field 3` / `-unboost field 3` causes total **8 games in `middle` and ZERO in each corner** —
computed off this run's own artifact, not copied from the brief. The one off-field row
(`|upkeep <> |move|??:farigiraf|roar`) is the run's declared `trace_body_off_field = 10`.

### THE EXACT CAUSE DIFF, BEFORE AGAINST AFTER

Read by joining the two artifacts' `by_cause` tables (`git show HEAD:data/game-differential.json`):

```
GONE   bm2  |-formechange|p2a|castformrainy|[msg]|[from]forecast <> |switch|p2b|rotomwash
GONE   bm1  |-activate|p2b|symbiosis|lifeorb <> |switch|p2b|incineroar
GONE   bm1  |-damage|p1a:hippowdon|35/183 vs 34/183          (Future Sight)
GONE   bm1  |-damage|p2a:sylveon|95/170  vs 97/170           (Future Sight)
GONE   bm1  |-miss|p1a|p2a <> |-boost|p2a|atk|0              (Decorate onto a vanished body)
NEW    nar1 |-supereffective|p2a|1 <> |-damage|p2a|H/H       (a THIRD Future Sight game, see §4)
CHANGED (none)
```

**Nothing else in the table moved by a single game**, which is the strongest evidence available that
five fixes did what they claim and nothing else.

---

## 2. FORECAST — THE SYNC HAD TWO MOMENTS AND ARRIVING WAS NOT ONE OF THEM. 2 games.

`forecast` is `onSwitchInPriority: -2` with `onStart(pokemon) { this.singleEvent('WeatherChange', …) }`
(`data/abilities.ts:1461-1464`), and `mimicry` is the identical shape on `TerrainChange`. So a body
walking into a sky or a terrain that is ALREADY THERE retypes **at its own entry**.

This engine synced the field-driven formes at exactly two moments — the whole-lead pass in
`battleInit` and once at the top of every turn — and **a mid-turn switch is at neither**. Measured on a
staged board before a line changed:

```
before   |switch|p2a:castform|castform,l50|147/147      <- and nothing after it
         (next turn)  |-formechange|p2a:castform|castformrainy|
after    |switch|p2a:castform|castform,l50|147/147
         |-formechange|p2a:castform|castformrainy|[msg]|[from] ability: forecast
```

The board parts on `active[].types` on the turn of the switch, which changes what a Water move does to
the body for the rest of that turn. Both divergent games are `same-turn` attribution.

**THE LINE WAS THE OTHER HALF AND IT MATTERED AS MUCH.** `sim/pokemon.ts:1487` is the else-of-the-else:

```js
this.battle.add('-formechange', this, species.name, message, `[from] ability: ${source.name}`);
```

with `message = '[msg]'` from Forecast's own call (`data/abilities.ts:1486`). Firing the sync without
those two fields would have moved a BOARD-MATERIAL divergence onto the NARRATION gate instead of
closing it. `TR.formechange` grew two optional parameters; **`push()` drops an empty field wherever it
sits, so every existing caller emits byte-identical lines.**

**ONE CALLER HAD TO BE CORRECTED TO STAY THE SAME.** `medicham2:17303` (Stance Change) read
`TR.formechange(m,_want,m.ability)` against a two-parameter emitter that dropped the third argument.
Under the new signature that argument would have become the `message` field, so the call is now
written in its two-argument form with a comment saying the omission is a DECISION. Whether the
authority writes `[from] ability: Stance Change` there is an open question the comment names; it is
not settled by this edit.

**THE SYNC RUNS OVER ALL FOUR ACTIVES, NOT THE ARRIVAL**, because the body that just landed may be the
weather SETTER — `applyEntryEffects` sets the field off `weatherSetter`/`terrainSetter` on the line
above, and the authority's `setWeather` runs `WeatherChange` on every active. Staged and checked:

```
|switch|p2a:pelipper|…   |switch|p2b:castform|…
|-weather|raindance|[from]ability:drizzle|[of]p2a:pelipper
|-formechange|p2b:castform|castformrainy|[msg]|[from]ability:forecast
```

which is the authority's own order. The sync is idempotent — it returns without a line when the types
already match — so the once-a-turn pass that follows emits nothing.

**Probe:** `tests/test-mechanics.js`, `ability`/`formeFollowsWeather`, *"Forecast fires the moment
Castform ARRIVES under a standing sky, not a turn later"*. Two controls kill the two halves of the
condition — the same body arriving under a CLEAR sky, and a body with no ability arriving under the
same rain — and **Mimicry is asserted on the same board as the second member of the same sync** (it
retypes with no line of its own, `data/abilities.ts:2592`, so only the type is asserted for it).

**Revert knob:** `MEDI_NO_ENTRY_FIELD_SYNC=1`, counted by `MEDFAILS.entryFieldSyncSkipped`.

---

## 3. THE DELAYED HIT DREW A POSITION IN A SPAN. 2 games, and it is ROADMAP #304 surviving in the one path that was not converted.

```
sim/battle.ts:2390   randomizer(d) { return tr(tr(d * (100 - this.random(16))) / 100); }
```

`random(16)` picks one of SIXTEEN percentages and everything after it is applied to an
already-truncated integer, so the authority's support has REPEATS and HOLES and is never more than
sixteen values. The main damage path asks `dmgRange` for the whole band and SELECTS out of it
(`_band[damageRollIndex(_u)]`). **`condition:futuremove`'s payout still read
`d.min + floor(u * (d.max - d.min + 1))`.** Measured, Oranguru's Future Sight into an unfaintable
Hippowdon, sixteen buckets:

```
the authority's band   139 138 136 135 133 132 130 129 127 126 124 123 121 120 118 118
this engine, by bucket 118 120 121 122 124 125 126 128 129 131 132 133 135 136 137 139
```

**Five of them — 122, 125, 128, 131, 137 — are numbers the authority cannot produce at all.**

**AND THE DIE WAS THE WRONG STREAM.** The payout spent `rng()` — the generic `any` stream — where every
other damage roll spends `_R.dmg()` (ROADMAP #222). The authority derives the category from the method
executing (`getDamage`), and a delayed payout goes through `trySpreadMoveHit` like any other hit, so it
is a `dmg` draw on that side. Two engines that name one event differently can never agree about it,
which is the ROADMAP #262 address rule. The address's MOVE and SLOTS are now set around the draw (the
booked move, the booked source, the collecting body) and restored immediately afterwards, because at
the residual they still held whatever the last ACTION left.

**WHY NO CORNER INSTRUMENT COULD SEE THIS, AND WHY THAT IS NOT AN EXCUSE FOR CALLING IT THE
INSTRUMENT.** `tests/test-engine-diff.js` reads **0 of 6000 at all sixteen corners** and the two
divergences sat only in `middle` — the same arm signature the brief attributes to Moody's unshared
die. It is not the same thing. `band[0]` IS `d.max` and `band[15]` IS `d.min`, so an index and a span
coincide at exactly the two points a corner compares; the middle-only signature here is a consequence
of the DEFECT, not of an unshared address. The engine's own ROADMAP #304 comment says so in the file.

**Probe:** `tests/test-mechanics.js`, `move`/`delayedHit`, *"the delayed hit SELECTS out of the
sixteen-roll band, and does not interpolate a span"*. The assertion is the **support**, not one number
— sixteen buckets against the band read back out of `dmgRange`'s own out-parameter — because asserting
a single roll would pass an engine that still interpolated and happened to agree at that point, which
at the ends it always does. The two ends are the control and they agreed before the fix.

**Counters:** `MEDSEEN.delayedHitBandSelected` (expected equal to `delayedHitLanded`) and
`MEDFAILS.delayedHitBandMissing` / `…First`, kept apart from the main path's so a regression in one
cannot be masked by the other.

---

## 4. AND THE FIX EXPOSED A THIRD FUTURE SIGHT GAME. Narration, and it was closed in the same pass.

The first re-run read narration **35**, up one, and the brief's stop condition is that narration must
not rise. The single new cause was:

```
event missing from medicham2 :: |-supereffective|p2a|1 <> |-damage|p2a|H/H
    |-end|p2a: Venusaur|move: futuresight
    |-supereffective|p2a: Venusaur|1        <- the authority
    |-damage|p2a: Venusaur|…
```

**It is not the Decorate game wearing a new label** — checked against the dump rather than assumed:
different seed, different configuration, a third game whose course changed because the delayed damage
changed. The payout block wrote the `-end` and then the `-damage` with nothing between them. Staged
three ways before the fix and all three were bare:

```
venusaur (Psychic SE)  ["|-end|…futuresight","|-damage|…"]
scizor   (resisted)    ["|-end|…futuresight","|-damage|…"]
snorlax  (neutral)     ["|-end|…futuresight","|-damage|…"]
```

`TR.eff(m,_d.eff)` now runs above the damage under the same `damageIsComputed` guard the attack branch
uses, so the fixed-damage family announces neither line here for the reason it announces neither there.
The three arms are asserted in the same probe, **and the neutral arm must carry NEITHER line** — an
engine that printed one unconditionally would pass a single-arm check.

**NO CRIT LINE, STATED RATHER THAN MISSED.** This payout takes no crit draw at all, so emitting
`-crit` would require inventing one. Separate gap, filed below.

After the follow-on, narration is **34 — flat**.

---

## 5. A STATUS MOVE MISSES A SEMI-INVULNERABLE BODY. 1 game, and it is roughly forty action kinds.

`hitStepInvulnerabilityEvent` is step **ZERO** of `trySpreadMoveHit` (`sim/battle-actions.ts:556, 621`)
and `trySpreadMoveHit` is the path EVERY move takes — the step list is not per-category. This engine
implements it as `_stepInvuln` **inside the ATTACK branch only**, and ~40 non-attack kinds resolve in
branches below it. Staged before a line changed, a Dragapult mid-Phantom-Force:

```
decorate   CHARGING  |-boost|p2a:dragapult|atk|2      CONTROL (no charge)  identical
charm      CHARGING  |-unboost|p2a:dragapult|atk|2    CONTROL              identical
willowisp  CHARGING  |-status|p2a:dragapult|brn       CONTROL              identical
taunt      CHARGING  |-start|p2a:dragapult|move:taunt CONTROL              identical
```

**Byte-identical across the knob on every member, which is what an unwired gate looks like.**

**ONE GATE, NOT FORTY.** It is placed at the common commit site — the point where the `|move|` line is
written and the aimed body is resolved for every kind (`reaimToSlot`). `a.kind === 'attack'` is
skipped: the attack branch walks MULTIPLE targets with per-target pierce lists, a `smartTarget` rule
and a `spreadHit` rule that suppresses the `[miss]` attribute, none of which a single resolved target
can express, **so nothing about the damaging path moves.**

**THE THREE EXEMPTIONS ARE THE AUTHORITY'S OWN AND A BLANKET RULE IS WRONG IN ALL THREE DIRECTIONS:**

```js
if (move.id === 'helpinghand') return new Array(targets.length).fill(true);
else if (gen >= 8 && move.id === 'toxic' && pokemon.hasType('Poison')) hitResults[i] = true;
```

plus `guaranteedAgainst` (Lock-On), which is the shared predicate the attack step already calls, so the
two cannot drift. Helping Hand onto a charging PARTNER and a Poison-type Gengar's Toxic are both arms
of the probe and both must NOT miss.

**BOTH EVENTS ARE EMITTED.** `attrLastMove('[miss]')` APPENDS to the `|move|` line already in the log
and `add('-miss', pokemon, target)` writes a new one. Emitting only the second would have traded a
board divergence for a narration one — which is what the divergent game's own authority line shows:
`|move|p1a: Alcremie|Decorate|p2a: Dragapult|[miss]` followed by `|-miss|p1a: Alcremie|p2a: Dragapult`.

**STATE: YES, AND IT IS THE ATTACK BRANCH'S OWN EXPRESSION RATHER THAN `mvFail`.** `mvFail` also emits
`|-fail|<mover>` and the authority writes no such line for a miss. The attack branch reaches the value
through `m._mvRes = _reached ? true : (_explicitFail ? false : null)` with `_explicitFail` set by its
own invulnerability step, and this is that same case: every target returned literal `false`, so
`useMoveInner` returns false and `useMove` writes `moveThisTurnResult = false`
(`sim/battle-actions.ts:374`). Written as `m._mvRes = false` with the citation at the site.

**Probe:** `tests/test-mechanics.js`, `move`/`semiInvulnerable`, *"a STATUS move misses a
semi-invulnerable body — and Helping Hand and a Poison-type's Toxic still reach it"*.
**Counter:** `MEDSEEN.statusMissedInvuln`.

---

## 6. SYMBIOSIS ANSWERS A HERB. 1 game.

The handler is `onAllyAfterUseItem`, and `Pokemon#useItem` is what raises `AfterUseItem` — so EVERY
item spend is a trigger, not just an eaten berry. This engine hung Symbiosis on `consumeBerry`, its one
berry door, and **declared the shortfall by name** in `MEDFAILS.symbiosisNonBerrySites`. The divergent
game is exactly that: a Torkoal pops its White Herb against an Intimidate and the authority hands it
the Oranguru's Life Orb.

```
|-enditem|p2b: Torkoal|White Herb
|-clearnegativeboost|p2b: Torkoal|[silent]
|-activate|p2a: Oranguru|ability: Symbiosis|Life Orb|[of] p2b: Torkoal
```

`passItemFromAlly(m)` now runs at the bottom of `restoreStatsUpdate`, **after** the
`-clearnegativeboost`, which is the authority's own order (`useItem` writes `-enditem`, `onUse` writes
the clear, `AfterUseItem` runs after both).

**WHITE HERB IS THE MEMBER WORTH WIRING AND THE REST ARE NAMED RATHER THAN SWEPT.** `restoresStats` is
White Herb and nothing else (`docs/LESSONS.md` §4), it is the second most-held item in this format, and
it has ONE spend site. Mental Herb spends at `freeVolatileByItem` and Power Herb is
`isNonstandard: 'Past'` in Champions — the counter's string was rewritten to name what is LEFT rather
than deleted, because the gap is smaller, not gone.

**AND THE LINE HAD THREE FIELDS WHERE THE AUTHORITY WRITES FOUR.** `MEDFAILS.symbiosisLineShort` had
been counting the missing ITEM token, which sits between the effect and the `[of]`. Firing the herb
trigger without it would have turned a BOARD-MATERIAL divergence into a NARRATION one rather than
closing it. `TR.actOf` grew a `mid` parameter; `push()` drops an empty field, so every existing
three-argument caller emits exactly the line it emitted before. **The counter is now expected to stay
at ZERO** and its comment says a non-zero reading means a caller found the short form again.

**Probe:** `tests/test-mechanics.js`, `ability`/`passesItemToAlly`, *"Symbiosis answers a WHITE HERB
spend, not only a berry, and names the item it hands over"*.

**MY PROBE WAS WRONG BEFORE THE ENGINE WAS, ON SCHEDULE.** The first version pasted the divergence
card's identifiers verbatim (`p2a:oranguru`), but on the probe's own board the Oranguru is **p2b** — so
it went red against an engine that had just been fixed. The OUTCOME assertions (the item moved, the
giver is empty) were green throughout. The corrected line and the reason are in the probe's source.

---

## 7. THE MUST-NOT-MOVE LIST, CHECKED

| | required | measured |
|---|---|---|
| damage differential `--n 6000 --seed 20260804` | 0 of 6000, all 16 corners | **0 of 6000, midpoint and all 16 corners** — run twice, once mid-batch and once on the final engine |
| census | 654 probed / 654 live / 0 missing | **658 / 658 / 0** — four probes added, none missing |
| census ratchet (`unarmed` / `directCall`) | may not rise | **0 / 1 — unchanged, no `--accept` needed** |
| hollow probes | 0 | **0** |
| probes that THREW | 0 | **0** |
| **narration-only games** | must not rise from 34 | **34 — flat** (35 after the first re-run; §4 closed it) |
| roster items | 0 DIFFER, 0 DID-NOT-FIRE, 139 of 148 | **identical** |
| roster abilities | 0, 0, 130 of 202 | **identical** |
| roster moves | 0, 0, 475 of 500 | **identical** |
| `all_mechanics_fire --kind all` | moves 20 / abilities 9 / items 1 | **identical** |

**THE ROSTER WAS RE-RUN TWICE AND THE SECOND RUN IS THE ONE THAT COUNTS.** `engine/status.js` withholds
a roster artifact measured on a different release, so the three stages were re-run on the FINAL release
`3e00ea2575a9`. All three clauses now PASS. Gate shape: **3 of 8 clauses fail — the whole-game
differential, the staged-mechanics comparison, and the open-defect register clause — the same three as
before this pass.**

**ONE TRAP WORTH RECORDING.** `tests/roster.js --stage all` reports **2 FIRED-AND-BOARDS-DIFFER**
(`axekick`, `electrify`) where the three per-stage runs report **0**. Both rows are `DEFERRED-BY-OWNER`
in the per-stage `moves` artifact, so the `all` stage is applying the usage shelf differently. **This
is not a regression from this pass** — `data/roster.all.json` on disk was from 2026-08-11 and read 4
DIFFER / 4 DID-NOT-FIRE at that release, so the `all` stage IMPROVED to 2 / 0. It is named here because
a reader comparing an `all` run against a per-stage run will see two numbers that cannot both be the
roster, and neither is wrong. **Filed below; not investigated.**

---

## 8. NO STATE RODE IN WHERE IT WAS NOT MEANT TO, AND THAT IS CHECKED RATHER THAN ASSERTED

`engine/move_result_state.js` compares `moveLastTurnResult` against `_mvResLast`. Four of the five
fixes touch no `_mvRes` path at all — the entry sync writes `types` and a trace line; the Symbiosis
wire moves two item slots and a trace line; the band fix changes which integer a draw selects; the
effectiveness line is a pure `TR` push. **The fifth writes `_mvRes` deliberately** and §5 states which
value, why, and the authority line it is read from.

Three of the five ARE state changes and none is smuggled: `types` on a body (§2), HP (§3), and the
whole effect of a status move (§5). Each is asserted directly in its probe rather than through the
protocol.

---

## 9. WHAT WAS DERIVED AND DELIBERATELY NOT LANDED

### 9.1 Psychic Fangs breaks a screen through a TYPE IMMUNITY. 1 game. ARCHITECTURAL — do not patch it narrowly.

`psychicfangs.onTryHit` (`data/moves.ts:14072-14077`) removes the target side's screens, and
`onTryHit` for a MOVE runs at `sim/battle-actions.ts:1044` — **inside `moveHit`**, which is after
step 0 (invulnerability), step 1 (the TryHit event / Protect), step 2 (type immunity), step 3
(move-specific immunity) and step 4 (accuracy). A Psychic Fangs into a Dark Grimmsnarl is `-immune` and
**the screens survive**.

This engine clears them **once per use, before target resolution** (`medicham2:21309`, `clearsScreens`).
The site's own comment says it "fires on USE, before damage, which is the real rule" — true about
damage, and wrong about the five gates above it.

**A narrow patch here would be a silent partial.** Gating the pre-use clear on type immunity closes
THIS game and leaves Protect and a miss wrong, with nothing recording it. The correct shape is to move
the clear into the per-target hit loop where the authority runs it, which is the same relocation the
faint queue and the Update pass need. **Scoped, not attempted.**

### 9.2 The three "the authority `-fail`s and we apply" rows. NOT ONE MECHANISM.

`|-fail|p2b <> |-start|p1a|disable|protect`, `|-fail|p1a <> |move|p2b|roleplay`,
`|-fail|p2b <> |move|p1a|curse` — three games, three different failure preconditions, and two of the
three are `earlier` attribution (the board had already parted before the named line). They were
grouped as one in the brief's shape table and they are not one; each needs its own derivation.

### 9.3 The sleep and flinch rows. SUSPECT THE DIE FIRST.

`|cant|p2a|slp <> |-curestatus|p2a|slp|[msg]` and `|move|p2a|psychicfangs <> |cant|p2a|flinch` are both
one game, both `middle`-only. Sleep duration is `random(2,5)` and a flinch is a secondary roll, so both
have the Moody shape and neither was investigated. **Check the corner arms before touching either.**

### 9.4 The ties, as the brief instructed.

Two Tailwind rows are derived ties (`effectOrder` is assigned only for `SwitchIn`/`RedirectTarget`,
`sim/battle.ts:994-1000`). **The owed correction on the three Protect/Detect rows is STILL OWED** — I
touched none of those rows, so I inherited nothing and settled nothing.

### 9.5 Everything the previous pass filed and did not land

The faint queue (27 inline sites against 8 step boundaries), the Update pass inside the hit loop,
Throat Chop's one-turn-long `_noSound`, the broken Substitute's unclamped `lastDamage`, the Perish Song
`-damage`, and the weather-upkeep 5. **None was touched.** Throat Chop remains the one the brief flagged
as state-first, and it is still state-first.

---

## 10. DEFECTS FOUND AND NOT FIXED — for the register

1. **A screen-breaking move clears screens through a type immunity, a Protect and a miss.** §9.1.
   Board-material, 1 game. Architectural — the clear belongs in the per-target hit loop.
2. **The delayed hit takes no crit draw at all**, so it can never emit `-crit` and can never crit.
   `condition:futuremove`'s payout goes through `trySpreadMoveHit` in the authority and gets the full
   step list. State + narration. Found in this pass, named in the engine at the site.
3. **`tests/roster.js --stage all` and the three per-stage runs disagree on two rows** (`axekick`,
   `electrify`): DEFERRED-BY-OWNER per-stage, FIRED-AND-BOARDS-DIFFER under `all`. An instrument
   inconsistency, not an engine defect. §7.
4. **Stance Change's `-formechange` may be missing `[from] ability: Stance Change`.** The authority's
   `attacker.formeChange(targetForme)` takes `this.battle.effect` as its source, which during
   `onModifyMove` is the ability — but this engine's own comment records a REAL battle log without the
   field. Left byte-identical on purpose and named at the site. **Settle with a measurement.**
5. **Growl does nothing in this engine** — carried forward unchanged from the previous pass's list; it
   was not staged here either.

---

## 11. OWED, NOT RUN

```
node tests/test-mechanics.js                          RUN — 658/658 live, 0 missing, 0 hollow, 0 threw
tests/test-engine-diff.js --n 6000 --seed 20260804    RUN — 0/6000, all 16 corners, twice
node tests/roster.js --stage {items,abilities,moves}  RUN — on the FINAL release, 0/0 on all three
node engine/all_mechanics_fire.js --kind all          RUN — moves 20 / abilities 9 / items 1, identical
node engine/game_differential.js (the pinned run)     RUN — twice: once after four fixes, once final
node engine/status.js --write                         RUN at the end of this pass

node tests/roster.js --stage all                      RUN once, and it DISAGREES with the per-stage
                                                        runs on two rows (§7). NOT investigated.
node engine/replay_one.js (the weather upkeep 5)      NOT RUN — still owed from the previous pass
node engine/explain_divergence.js --dump-speeds       NOT RUN — no tie row was touched
node engine/quarantine.js                             NOT RUN — its clauses were run directly, at the pins
node tests/run-all.js                                 NOT RUN — several of its gates predate this pass
node engine/argmax_paired.js (decision impact)        NOT RUN — data/decision-impact.json still absent
tests/interaction_matrix.js                           NOT RUN
node engine/million_run.js                            NOT RUN
```

- **No fit, no self-play, no `mew.js`.** `board.js`, `magnemite.js` and `engine-data.js` were not
  touched. `docs/ROADMAP.md` was not edited — register row text is proposed in `docs/ENGINE.md`.
- **Two untracked files left alone as instructed:** `data/_pair-pilot.json` and
  `data/medicham-represented-clicks.json`.
- **`data/roster.all.json` and `data/roster.all.prev.json` were rewritten** by the one `--stage all`
  run. The previous bytes (2026-08-11, release `a63f0f139f37`) are in `data/roster.all.prev.json`.
