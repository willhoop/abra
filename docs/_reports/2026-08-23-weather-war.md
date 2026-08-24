# The weather war and the five missing upkeep lines — derivation only, nothing edited

Written 2026-08-23 by ENGINE. **No file under `engine/` was touched, no battle was opened, and no
instrument was run.** Everything below is either a citation into the authority, a citation into
`engine/medicham2-browser.js`, or a sub-second read of an artifact already on disk.

---

## VERDICT

1. **Will's SECOND hypothesis (Cloud Nine) is CONFIRMED as far as an artifact can confirm it, and it
   explains all five games.** All five divergent pairs carry a Cloud Nine body; **none of the other
   forty carded pairs does.** Base rate is 1.08% of sheets.
2. **Will's FIRST hypothesis (the slower weather setter wins a simultaneous switch-in) is CORRECT as
   a rule about the authority** — derived and cited below — **but it is NOT the cause of these five,
   and our engine already appears to implement it.** It is not the `onSwitchInPriority` row either;
   that row was closed and is a different table.
3. This **closes** ROADMAP **#352** rather than opening a new row. #352 already names the `wSup` gate
   as a derived defect and explicitly does not claim the five games. It should now claim them.
4. There is a **second, smaller defect in the same neighbourhood** that is **board-material, not
   narration**: our `field.wSup` is computed once at the top of the turn and never recomputed after a
   mid-turn switch, where the authority evaluates suppression **live** at the residual.

---

## 1. The authority's rule for two setters arriving together

Chain, all Champions-checked (`data/mods/champions/` overrides **none** of these files for weather —
`grep raindance|sandstorm|onFieldResidual data/mods/champions/conditions.ts` returns nothing):

| step | file:line | what it says |
|---|---|---|
| the sort | `sim/battle.ts:404-411` `comparePriority` | order **ASC**, priority **DESC**, **speed DESC**, subOrder ASC, effectOrder ASC |
| the queue order table | `sim/battle-queue.ts:181-183` | `runSwitch: 101`, `switch: 103` — so the simultaneous switches are one order-103 group sorted by speed, faster first |
| the entry effect is queued | `sim/battle-actions.ts:157` | `switchIn` pushes `{choice:'runSwitch'}`; `insertChoice` (`battle-queue.ts:376-397`) places order 101 **ahead of the remaining order-103 switches**, so each entrant's abilities fire immediately after its own `\|switch\|` line |
| the batched case | `sim/battle-actions.ts:175-190` | `runSwitch` swallows only **consecutive** `runSwitch` actions, `speedSort`s all actives into `battle.speedOrder`, then one `fieldEvent('SwitchIn', switchersIn)` |
| the batched sort | `sim/battle.ts:1007-1012` | `handler.speed = pokemon.speed` minus a fraction taken from that pre-sorted array; the comment is explicit — *"Pokemon speeds including ties are resolved before all onSwitchIn handlers and aren't re-sorted in-between"* |
| the overwrite | `sim/field.ts:39-53` `setWeather` | refuses **only** when `this.weather === status.id`. A **different** weather overwrites unconditionally |

**So the LAST setter to resolve owns the sky, and the last to resolve is the SLOWEST. Will is right.**
It holds through both routes — the per-entrant route (mid-turn switches) and the batched
`fieldEvent` route (battle start, simultaneous post-faint refill) — because both keys are speed DESC.

**The card in the artifact shows the per-entrant route happening**, which is worth more than the
reading: `data/game-differential.json`, seed `…-2659448819 vs …-2659553017`, the authority stream is
`|switch|p2b: Pelipper` → `|-weather|RainDance|[from] ability: Drizzle|[of] p2b: Pelipper` →
`|switch|p2a: Farigiraf`. The Drizzle line is interleaved **between** two switch lines.

**Two caveats, both derived:**

- **Trick Room inverts it.** `sim/pokemon.ts:641-648` `getActionSpeed()` returns `10000 - speed`
  under Trick Room, and `pokemon.speed` is what both the action sort and the `onSwitchIn` handler
  sort read. Under Trick Room the **faster** setter wins. The rule is really *"whoever resolves last
  wins"*.
- **`onSwitchInPriority` would outrank speed and cannot arise here.** Derived over the format:
  `drizzle`, `drought`, `sandstream`, `snowwarning`, `orichalcumpulse`, `desolateland`,
  `primordialsea`, `deltastream` all read `onSwitchInPriority === undefined`. The sixteen abilities
  that declare one are in `data/switchin-order.json`; only Klutz, Unnerve, Mimicry, Forecast and
  Hospitality have a legal carrier and none sets weather.

### What our engine does

`engine/medicham2-browser.js:10443` gives a bare switch priority 6; `turnOrderKey` /
`compareTurnOrder` (≈10456-10480) sort order ASC → priority DESC → Quick Claw → **speed DESC, with
`if(field.tr>0) sp=-sp`** for Trick Room. Entry effects run inside the switch action
(`bringIn` → the `weatherSetter` block at `:13041`, which correctly refuses only a same-id re-set,
citing `setWeather`'s own gen check). **So the slower setter should win here too.**

**This is a reading, not a measurement.** No probe exercises it. See STAGING, arm E.

---

## 2. Cloud Nine: what the authority does, what we do

**The crux question was whether suppression stops the announcement. It does not, and the authority
carves the exemption out by name.**

- `sim/battle.ts:615-621` (`singleEvent`):
  ```
  if (effect.effectType === 'Weather' && eventid !== 'FieldStart' && eventid !== 'FieldResidual' &&
      eventid !== 'FieldEnd' && this.field.suppressingWeather()) { … return relayVar; }
  ```
  **`FieldStart`, `FieldResidual` and `FieldEnd` are exempt from Air Lock suppression.**
- `sim/battle.ts:888-894` (`runEvent`'s handler loop) makes the same exemption for `Residual` / `End`.
- `data/conditions.ts:506-508` (rain; 655 sandstorm, 721 snowscape) —
  `onFieldResidual() { this.add('-weather','RainDance','[upkeep]'); this.eachEvent('Weather'); }`
- The `eachEvent('Weather')` on the next line **is** suppressed (eventid `Weather` is not exempt), so
  under Cloud Nine the **chip does not happen and the line still prints.**
- `sim/field.ts:101-115` — `suppressingWeather()` walks `battle.sides[].active` **at call time**.

**Ours** — `engine/medicham2-browser.js:25443` (the brief's `:24881`; the file has moved under the
other live agent):

```js
if(TR){if(field.weather&&!field.wSup)TR.wx(field.weather,null,null,true);else if(_wx0&&!field.weather)TR.wxNone();}
```

The **line** is gated on `!field.wSup`. The authority has no such gate. Our chip gate at `:26350`
(`_G.has('weather')&&field.weather&&!field.wSup`) is **correct** and must not move.

**The tag is not over-matching — printed, not assumed.** `data/tags.json` tag row 242
`weatherSuppression`, `n: 1`, `uses: 360`. `TAGS.withTag('ability','weatherSuppression')` returns
**`['cloudnine']`** and nothing else; `TAGS.param('ability', null|undefined|''|'airlock', …)` all
return `null`. Legal carriers derived from the format: **Altaria (H) and Drampa (H)**. Air Lock has
no legal carrier in Reg M-B (Rayquaza), so its absence from `tags.json` is not a defect.

---

## 3. Does that explain the five games? — the control that settles it

The previous pass ruled Cloud Nine out because none of the **four visible switch-in names** on the
divergent turn carries it. That is the wrong set: `field.wSup` is a property of whoever is standing
there at the **top of the turn**, and the card only shows who **arrived**. The right question is
whether a Cloud Nine body is on the **roster of the teams that were played**.

The seed tag is the source ladder game id, so the sheets are recoverable from
`data/team-pool-frozen/games.bo3.jsonl` with no engine and no battle. All ten resolve.

| pair | Cloud Nine carrier | weather setter |
|---|---|---|
| 2659057254 / 2659094739 | **Altaria** (`…94739` p2) | Pelipper Drizzle (`…57254` p2) |
| 2656876203 / 2656809627 | **Drampa** (`…76203` p2) | Pelipper Drizzle (`…09627` p1) |
| 2657091088 / 2657136658 | **Altaria** (`…36658` p2) | Pelipper Drizzle, same sheet |
| 2659448819 / 2659553017 | **Drampa** (`…48819` p2) | Pelipper Drizzle (`…53017` p1) |
| 2653845078 / 2653813967 | **Altaria** (`…45078` p2) | Tyranitar Sand Stream (`…13967` p2) — the sandstorm card |

In each pair the *sides actually played* are identifiable from the switch-in names in the card, and
in every case the Cloud Nine sheet is one of the two sides in play (e.g. card 1's Starmie+Sneasler is
`…57254 p2` and its Raichu+Annihilape is `…94739 p2`, the Altaria team).

**The control, over every carded divergence in the same artifact:**

```
sheets in the frozen pool           26,370
sheets carrying Cloud Nine             286   = 1.08%

carded divergences resolvable to the pool   45   (8 more could not be resolved)
  weather-upkeep cards                       5   of which a Cloud Nine pair:  5
  every other card                          40   of which a Cloud Nine pair:  0
```

**Perfect separation.** Under the null that Cloud Nine is unrelated, the chance the five
CN-carrying pairs among 45 are exactly the five weather cards is `1 / C(45,5) ≈ 8.2e-7`.

**What this does NOT prove, stated plainly:** that Cloud Nine was standing on the field at the
divergent turn. That needs the replay (OWED, below). What it proves is that the presence of the
mechanism and the presence of the divergence coincide perfectly, and that no other carded class
touches it.

---

## 4. The second defect, found on the way — and it is the board-material one

`engine/medicham2-browser.js:15672` computes `field.wSup` **once, at the top of the turn**, over the
then-current actives. It is recomputed on a mega (`:13174`) and nowhere else. The authority's
`suppressingWeather()` (`sim/field.ts:106-115`) is evaluated **live**, so:

- a Cloud Nine body that **switches out or faints mid-turn** stops suppressing immediately on the
  authority, and the residual **chips**;
- here, `wSup` stays true for the rest of that turn and the residual **does not chip**.

That is **HP, not narration** — it is exactly the sandstorm card's shape. It is also part of why the
five went unexplained: on those turns the visible arrivals carry no suppressor precisely because the
suppressor **left**.

---

## 5. STAGING — the boards that would prove it. NONE OF THIS WAS RUN.

Every arm names the knob and its cleared control, because identical results across a varied knob mean
the knob is unwired.

**A · red — the gate.** Pelipper (Drizzle) and any body on side A; **Altaria with Cloud Nine** on
side B, on the field from the start. One turn, both sides Protect. Assert the residual writes
`|-weather|RainDance|[upkeep]`.
*Authority: writes it (`battle.ts:615-621` exempts `FieldResidual`). Ours today: writes nothing.*

**B · over-fire control — the knob cleared.** The identical board with the **same Altaria carrying
Natural Cure** instead of Cloud Nine. Both engines write the line. If A and B print the same thing,
the probe is not exercising `wSup` and must be discarded.

**C · over-fire control — the effect must stay suppressed.** Under arm A's board with **sandstorm**
instead of rain: assert **no body loses HP** on either engine. The fix moves the LINE only; a fix
that also un-suppresses the chip is a worse bug than the one being closed.

**D · red — the stale flag (board-material).** Sandstorm up; Cloud Nine body on the field at the top
of the turn, **switching out that same turn**. Assert every non-immune body takes 1/16 at that turn's
residual.
*Authority: chips. Ours today: does not.*

**E · the weather war itself (Will's first hypothesis, currently unprobed).** Torkoal (base Spe 20,
Drought) and Pelipper (base Spe 65, Drizzle) switching in on the same turn from opposite sides.
Assert the field ends in **SUN** — the slower setter's. **Control: the same board with Trick Room
already up**, where the order inverts and the field must end in **RAIN**. Same weather across the
Trick Room knob means the entry order is not wired to speed at all.

---

## OWED, NOT RUN

**1. The replay that confirms Cloud Nine was on the field.** The previous attempt failed with
`SEED NOT IN THIS POOL` because the pool stride is a function of `--games`, `--team-store` and the
census pin, and the live census had moved. Read off the current artifact's own stamp
(`generated 2026-08-24T02:03:11Z`, `engine_release c30534af567b`,
`steering.input_read_from data/verification/census-pin-9446a684709d.json`, `games 961`):

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
node engine/replay_one.js \
  --release c30534af567b \
  --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json \
  --games 961 --arm middle --config omit-spread \
  --seed "gen9championsvgc2026regmbbo3-2659448819 vs gen9championsvgc2026regmbbo3-2659553017"
```

That is the **cleanest of the five** — the whole divergence is on turn 1, the Drizzle set line is
inside the agreed prefix, and the Drampa team is one of the two sides. What to read: is Drampa one of
the p1 leads, and does it leave during turn 1. The other four differ only in `--config`
(`baseline`, `omit-intimidate`, `omit-intimidate`, `pair-redirect-priority`) and `--seed`.

**Caveat on the release:** `c30534af567b` was cut at 01:54Z by the other ENGINE agent's run and the
live tree has moved since. A release is a copy, so it still serves the bytes that produced the
artifact — which is what a replay wants.

**2. Arms A–E above**, as `tests/test-mechanics.js` probes, once the tree is free.

**3. Nothing else.** No `game_differential.js`, no roster, no census regeneration was run by me.

---

## Register consequence

- **#352 should absorb these five.** Its own "WHAT WOULD DECIDE IT" asked for exactly the Cloud Nine
  arm; the artifact evidence above plus the authority citation supply the other half. Its stated
  reason for not attributing them — *"I read the four actives in each of the five games and none
  carries it"* — was a read of the **arrivals**, not of the rosters.
- **The staleness of `field.wSup` needs its own row**, or an explicit second clause on #352. It is a
  different mechanism (a cached field fact) and a different severity (HP, not a line).
- **#353 (simultaneous switch order) is untouched by this.** Will's first hypothesis belongs there if
  anywhere, and arm E is the probe that would decide it.
