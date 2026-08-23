# The whole-game divergences, grouped by mechanism — 2026-08-23

ANALYSIS ONLY. Nothing in `engine/`, `tests/`, `data/` or any ledger was touched. Every count below
is derived from `data/game-differential.json` by a throwaway classifier over the `classes[].causes[]`
cause strings; the classifier is reproduced in §8 so the grouping can be re-derived rather than
trusted.

Historical record, per `docs/_reports/` convention. Not current state, not versioned, superseded by
whatever register rows it feeds.

---

## 0. Two corrections before any finding, because both outrank the findings

### 0a. The pin is good. Read it and stop worrying about it.

`data/game-differential.json` `.steering.team_store_pinned_to` = **`data\team-pool-frozen`**, pool
digest `0d103fb9fa87`, 8,778 teams available, 1,968 picked. Census `8c778268919e`, `matches_live:
true`, 634 rows. Engine release `c36782953dee` cut `2026-08-23T05:58:15Z`, artifact generated
`2026-08-23T06:10:58Z`. Showdown commit `20ad99ffc9a5`. **The run was pinned exactly as claimed.**

### 0b. The headline "77 of 961 = 8.0%" is the WRONG ARM. The primary arm reads 82.

```
arms[0]  middle            961 games   82 diverged   <-- pins.primary
arms[1]  top-tie-first     961 games   68 diverged
arms[2]  bottom-tie-first  961 games   77 diverged
```

Top-level `diverged` is **82**. `77` is `arms[2].diverged` — the bottom-tie-first corner. The commit
body `da53059` and the brief both carry `77 of 961 = 8.0%`; the primary-arm figure is **82 of 961 =
8.5%**, or **80 of 959 usable = 8.3%** once the 2 mid-void games are removed
(`mid_void.diverged_rate_over_usable` = `0.0834`, which is the only rate the artifact actually
computes — 8.0% appears nowhere in it).

This does not change the story — 68 / 77 / 82 across three corners is a tight band, and the drop from
39.6% is real either way. It changes which number gets written down. **This report groups the
primary `middle` arm's 82**, because `classes[]` is the middle arm's cause table and nothing else in
the artifact is broken out per arm at cause level.

---

## 1. Verdict

**The 82 collapse to 31 distinct mechanisms.** All 82 are attributed — the `classes[].causes[]` table
enumerates every one with a count, so nothing is unattributed by construction.

**61 of 82 (74%) are backed by a sampled card** with six lines of board context in
`first_divergences` (60 entries). Another 3 are backed elsewhere in the artifact (2 mega
`detailschange` in `mega.cost_of_the_megas.on_a_detailschange_line`, 2 Protect/Detect in
`order_probe` — overlapping set, net +3). **So 64 of 82 (78%) are read from evidence and 18 are read
from the cause STRING alone.** The 18 are named in §7 and every claim about them is marked inferred.

**How many are board-material: I cannot tell you, and neither can this artifact.** See §2. That is
the single most important sentence in this report.

**Instrument, not engine: 9 of 82 (11%).** Moody 8, off-field-body 1. Plus 2 more that are filed NOT
A DEFECT (exact speed ties). See §3.

---

## 2. THE BOARD-MATERIAL SPLIT CANNOT BE READ OFF THIS RUN AT ALL

`data/game-differential.json`:

```
state_mode:             false
end_state_mode:         false
state:                  null
end_state:              null
end_state_not_compared: null
```

**This run was a PROTOCOL run. No board was compared at any turn boundary and no end board was
compared.** There is therefore no measurement anywhere in this artifact that says any of these 82 is
narration-only, and by Will's standing rule — *"a divergence is narration-only when something
MEASURED it as narration-only, never when it looks cosmetic"* — I am not entitled to say so.

The obvious place to look instead is `data/state-ladder.json`. **It must not be used.** It is
`2026-08-07T22:26Z` (16 days old), carries no `engine_release`, and predates the `baseline_reset`
boundary the artifact declares in its own words: *"NO NUMBER IN THIS ARTIFACT MAY BE COMPARED WITH
ANY RUN TAKEN BEFORE 2026-08-07 … not `data/state-ladder.json`."*

So every row in the table below is **UNKNOWN** except where a *different* kind of evidence settles it,
and there are exactly three such kinds:

| verdict | what earns it |
|---|---|
| **NARRATION (declared)** | Showdown itself tags the line `[silent]` — the client is told not to render it — AND the effect state behind it provably does not exist. One group qualifies. |
| **BOARD-MATERIAL (structural)** | the divergence IS a state change: a forme that did not change, a weather that was not set, an item that did not move, a type that did not change, an HP number that differs. Reading the two lines is the measurement. |
| **NOT A DEFECT** | `order_probe` measured `speed_gap: 0`, `same_priority: true`. Neither engine is wrong. |

**The one command that settles the rest**, same three pins, and it is the single highest-value thing
anyone can run next:

```bash
node engine/game_differential.js --games 961 --end-state \
     --release c36782953dee --team-store data/team-pool-frozen --write
```

`--end-state` implies `--state` (`game_differential.js:96-97`) and does not stop at the first
divergent board, so it answers *where do the two engines ARRIVE* rather than *when did they first
part*. Until that runs, "board-material zero" has no denominator.

**And the warning from this session applies directly.** `engine/move_result_state.js` caught two
state defects on arms whose boards were identical and one of whose protocol was byte-identical. So
even a clean `--end-state` run does not clear the `-fail` family (§4, rank 2) — that family needs
`move_result_state.js` specifically, because `mvFail()` writes a protocol line AND `_mvRes`, and
`board_state.js` compares no move-result field at all.

---

## 3. Ranked work list

**Ranked by:** (1) board-material-by-structure above everything, then (2) usage of the entity involved
(derived from `data/tags.json` `.uses`, printed in the table — a sheet count, so read it as an upper
bound, per the Blaze lesson), then (3) how many of the 82 it accounts for, then (4) how cheap the fix
looks from the two cited sites. Instrument rows are ranked LAST regardless of count, because fixing
the engine there fixes nothing.

Board-material outranks narration. Narration outranks unknown-and-cheap only where the fix is a
one-line protocol string.

| # | Mechanism, in plain words | n/82 | verdict | likely site — ours | likely site — authority | derived usage |
|---|---|---|---|---|---|---|
| 1 | **A Substitute does not block Intimidate.** The authority prints `-immune` and applies nothing; we apply `-unboost atk 1` straight through the sub. | 1 | **BOARD-MATERIAL (structural)** | `engine/medicham2-browser.js:11244-11249` — the per-foe loop in `applyEntryDrops` guards only `!f \|\| f.fainted` | `data/abilities.ts:2191-2192` — `if (target.volatiles['substitute']) { this.add('-immune', target); }` | Intimidate **18,772**, Substitute **1,222** |
| 2 | **A move that failed in Showdown did something in ours.** Showdown writes `\|-fail\|`; we write the next event. Two of the seven have us writing `-damage \|0 fnt` where the authority failed outright. | 7 | 2 **BOARD-MATERIAL (structural)**, 5 UNKNOWN | `mvFail()` / `_mvRes`; see `engine/move_result_state.js` header for the four deferral sites it quotes | twelve `\|-fail\|` sites, each guarded by a strict `=== false`; `combineResults` ranks number above boolean | Role Play 40, Stealth Rock 198, Curse — the *carriers* are tail; the *shape* is not |
| 3 | **A switch-in / on-hit effect never fires at all.** Six separate entities, same shape: the tag row exists in `data/tags.json`, the effect is absent from the stream. | 7 | **BOARD-MATERIAL (structural)** — forme, weather, item location, type, HP, move-block | see §5 per entity | see §5 per entity | Regenerator **1,855**; Symbiosis 69; Sand Spit 34; Forecast 15; Protean 571; Psychic Terrain (move) |
| 4 | **`\|faint\|` is written the instant HP reaches 0**, instead of drained from a queue after the step completes. Hazards, Fling's `-enditem`, a survivor's Sitrus and the sandstorm chip on the OTHER bodies all land on the wrong side of it. | 6 (+1 perish variant) | UNKNOWN — ordering within a turn; material wherever an effect reads a body that is or is not still standing | wherever `TR.faint` is written from the damage step | `sim/battle.ts:2532` `faintMessages()` — drains `this.faintQueue`, called at six sites (`565`, `1554`, `2180`, `2832`, `2897`) | universal — every KO in the format |
| 5 | **The weather-upkeep line is missing.** `\|-weather\|<w>\|[upkeep]` present in Showdown, absent in ours. In all four sampled cards the whole turn was switches only. **Root NOT established — see §6.** | 5 | UNKNOWN, and possibly material (a weather that ticked in one engine and not the other) | `engine/medicham2-browser.js:24062-24068` — `if(field.weather && !field.wSup) TR.wx(...,true)` | `data/conditions.ts:506-508` (rain), 655, 721 etc. — `onFieldResidual` | rain/sand/snow are everywhere |
| 6 | **A spread move's drain heal is batched instead of interleaved.** Showdown heals after EACH target's damage; we damage every target first. Every instance is **Matcha Gotcha**. | 4 | UNKNOWN — ordering; totals may reconcile at turn end, and 3 of 4 are classed "event missing" rather than "ordering", which would mean the heal is *absent*, not late | the spread-hit loop's drain application | per-target `-heal … [from] drain … [of] <target>` | Matcha Gotcha **8,668** — the highest-usage entity in this whole table |
| 7 | **The wrong BODY takes the effect.** Discharge paralyses p1b in Showdown and p2b in ours; Outrage hits p2a there and p2b here; one spread-order case. | 3 | **BOARD-MATERIAL (structural)** — a different Pokemon is statused / damaged | spread secondary target selection; locked-move retargeting after the original slot switched | — | Discharge 692, Outrage 113 |
| 8 | **A semi-invulnerable turn is not respected.** Decorate hits a Phantom-Forced Dragapult (`-miss` there, `-boost atk 2` here); a locked Phantom Force announces and deals nothing. | 2 | **BOARD-MATERIAL (structural)** | the invulnerability check / the lockedmove second turn | — | Phantom Force **698** |
| 9 | **Supreme Overlord emits a `[silent]` `-end\|fallenundefined` on every Kingambit switch-out.** We emit nothing. | 5 | **NARRATION (declared)** — see §4 | nothing implements it; `credit` lists `ability:boostsFromFallen` twice under `rows_clicked_or_present_that_did_nothing` | `data/abilities.ts:4731-4733` — `onEnd` adds `-end … fallen${this.effectState.fallen}` `[silent]`, and `effectState.fallen` is `undefined` when `onStart` never ran | Supreme Overlord **129** |
| 10 | **A `-boost`/`-unboost` of magnitude ZERO at the ±6 cap.** Decorate into a maxed Attack, Parting Shot into a −6 Attack. Showdown prints the line; we print nothing. | 5 | UNKNOWN — no stat moved, but the move's RESULT is not measured here | wherever the boost application returns early on a zero delta | `sim/battle.ts` `boost()` — the `else if (!isSecondary && !isSelf) { this.add(msg, target, boostName, boostBy); }` branch, plus `if (boost[boostName] < 0 \|\| target.boosts[boostName] === -6) msg = '-unboost'` | Parting Shot **12,589**, Decorate 55, Tearful Look 3 |
| 11 | **Order of simultaneous switch emissions** — post-double-KO replacements, two switches on one side, and one switch-vs-move. | 5 | UNKNOWN | `data/switchin-order.json` is already a modelled fact and is in `source_digests` | the action queue's switch ordering | universal |
| 12 | **Residual/entry order between the two SIDES.** Two Tailwinds expiring the same turn (p2 first there, p1 first here); Intimidate-vs-Drizzle and Intimidate-vs-Intimidate on a shared entry. | 4 | UNKNOWN — ordering | `residualExpireAt` per order-group (the ROADMAP #242 restructure at `medicham2-browser.js:24070+`) | `speedSort(handlers)` in the residual event | Tailwind **21,266**, Intimidate **18,772** |
| 13 | **The target's HP-triggered berry resolves AFTER the attacker's self-damage.** Showdown: defender eats Sitrus, then recoil / Life Orb. Ours: the reverse. | 2 | UNKNOWN — ordering | the post-hit sequence | `onUpdate` on the berry vs the recoil step | Sitrus + Life Orb — both top-5 items |
| 14 | **Announcement FORM differs where the outcome agrees.** Telepathy: authority `-activate … ability: Telepathy`, ours `-immune … [from] ability: telepathy`. Toxic Debris: authority `-activate … ability: Toxic Debris` then the hazard, ours the hazard alone. | 3 | UNKNOWN by the rule, though both are the same outcome by two names — see §4 for why this is also an INSTRUMENT question | `medicham2-browser.js:10517` (Telepathy refusal) | `data/abilities.ts:4926` (Telepathy), Toxic Debris's `-activate` | Telepathy 297, Toxic Debris **1,918** |
| 15 | **A volatile's `[silent]` `-end` on expiry or switch-out** — Throat Chop, Syrup Bomb. | 2 | NARRATION-shaped (`[silent]`), but unlike #9 the volatile REALLY EXISTS, so its absence in our stream may mean the volatile itself is absent → UNKNOWN | — | `[silent]` `-end` on the volatile | Throat Chop 5,071 (from the artifact's own `mentions`) |
| 16 | **Mega `detailschange` ordering.** Two megas the same turn; which side's `detailschange` is written first. | 2 | UNKNOWN — ordering. The artifact already isolates it: `first_divergence_is_a_mega_line: 0`, `first_divergence_is_a_detailschange_line: 2` | mid-turn mega evolution on a CHOICE | — | 26% of format usage is mega |
| 17 | **Future Sight's delayed damage is off by 1-2 HP.** Hippowdon 35 vs 34, Sylveon 95 vs 97 — **both** `-damage field 3` divergences follow `-end … move: Future Sight`. | 2 | **BOARD-MATERIAL (structural)** — the HP number differs | Future Sight's stored damage | the delayed-move slot's attacker snapshot | Future Sight **18** — rank-suppressed on usage alone |
| 18 | Substitute's HP: authority breaks the sub (`-end`), we keep it (`-activate … [damage]`). | 1 | **BOARD-MATERIAL (structural)** | — | — | Substitute 1,222 |
| 19 | Spread flinch: Rock Slide's flinch fires on Metagross here and not there; and a `-immune` / `cant flinch` order case. | 2 | UNKNOWN — likely the per-target secondary draw index (see §3 on dice) | — | — | Rock Slide is ubiquitous |
| 20 | We `-fail` a Copycat the authority does not. | 1 | UNKNOWN | last-move tracking | — | Copycat 17 |
| 21 | We emit a second, spurious `-activate … item: sitrusberry` after the berry was already eaten. | 1 | UNKNOWN | — | — | Sitrus is top-5 |
| 22 | We write `-damage \|0 fnt` for a Perish Song death; the authority writes no damage line. | 1 | UNKNOWN — same family as #4 | — | `faintMessages()` | Perish Song is a real archetype |
| — | **INSTRUMENT: Moody's stat pick is drawn from unshared dice.** | **8** | **INSTRUMENT — do not fix the engine** | — | `data/abilities.ts:2704` — `this.sample(stats)` | Moody 988 |
| — | **INSTRUMENT: a body named `??:farigiraf` moved while off the field.** | 1 | **INSTRUMENT — already declared** | `declared_gaps.trace_body_off_field: 6`, `trace_body_off_field_first: "farigiraf"` | — | — |
| — | **NOT A DEFECT: exact speed ties, Protect vs Protect and Protect vs Detect.** | 2 | **NOT A DEFECT — measured** | `order_probe[0..1]`: `speed_gap: 0`, `same_priority: true`, speeds 122/122 and 228/228 | — | — |

Totals: 31 mechanisms, 82 games, 82 classified. 11 games (13%) are the instrument or not a defect.

---

## 4. The two groups where I can actually settle the verdict, and why

### 4a. Supreme Overlord — NARRATION, declared by the authority (5 games, 6.1%)

`data/abilities.ts:4722-4733`:

```ts
onStart(pokemon) {
    if (pokemon.side.totalFainted) {
        this.add('-activate', pokemon, 'ability: Supreme Overlord');
        const fallen = Math.min(pokemon.side.totalFainted, 5);
        this.add('-start', pokemon, `fallen${fallen}`, '[silent]');
        this.effectState.fallen = fallen;
    }
},
onEnd(pokemon) {
    this.add('-end', pokemon, `fallen${this.effectState.fallen}`, '[silent]');
},
```

`onEnd` is **unguarded**. When Kingambit switches in with zero fainted allies, `onStart` returns
without setting `effectState.fallen`; on switch-out `onEnd` fires anyway and template-interpolates
`undefined`, producing the literal token **`fallenundefined`**. Every one of the five cards shows
exactly that on a Kingambit switching out on turn 2 with nobody fainted.

This is narration on both available tests: the line is `[silent]` (the client is instructed not to
render it), and there is provably **no state behind it** — the `-start` it purports to end never
happened, and `effectState.fallen` is `undefined`, which is the same falsy value the `onBasePower`
guard reads. Nothing in either engine's board can differ.

**It is also arguably the instrument's to absorb, and that decision is not mine.** The normalisation
block (`normalisation.rules`) already collapses `-ability` announcements and `[from]`/`[of]`
attributions, with a red demonstration in both directions for each (`all_rules_proved: true`). A rule
for `[silent]` `-end`/`-start` of a volatile would be the same shape. **It must NOT be a blanket
`[silent]` rule**: `|-heal|p1a: Slowbro|170/170|[from] ability: Regenerator|[silent]` is also
`[silent]` and carries HP (it is rank 3 in the table above). Whoever picks this up owes the red
demonstration before the rule, exactly as the existing eight do.

### 4b. Moody — INSTRUMENT, by construction (8 games, 9.8%)

`data/abilities.ts:2704`: `let randomStat = stats.length ? this.sample(stats) : undefined;`

The middle arm shares dice **by category**, and the categories are exactly five
(`game_differential.js:699`): `['acc','crit','sec','dmg','stall']`. Line 872 restates it and the
file's own comment at 866 names what is deliberately excluded: *"target selection, sleep timers,
multihit counts"*. **`sample()` on a stat list is that class.** There is no shared address for it, so
the two engines draw independently and cannot agree except by luck.

The signature confirms it rather than the argument alone: across all 8 games the body is the same,
the protocol index is the same, the magnitude is the same (+2 on the boost half, −1 on the unboost
half), and **only the stat name differs** — 5 distinct stat pairs with no repeated pattern. That is
what an unshared draw looks like; a rule defect would pick the same wrong stat repeatedly.

Six of the 8 are backed by a card and all six name Scovillain. The other two (`-unboost field 3`) are
inferred: `|-unboost|p1a|spa|1 <> |-unboost|p1a|spe|1` and `|-unboost|p2a|def|1 <> |-unboost|p2a|spd|1`
are Moody's −1 half by shape, and they are **not** sampled, so that is an inference and is marked as
one. If they are something else the instrument count drops to 6.

**Nobody should touch `medicham2-browser.js:24140` for this.** It is either a new shared dice
category or it is permanently excluded from the rate, and both of those are `game_differential.js`
decisions, not ENGINE ones.

---

## 5. The six absent entry/on-hit effects, broken out (rank 3, 7 games)

Every one has a live tag row in `data/tags.json` and none has a Champions override
(`grep -c "^\tX:" data/mods/champions/abilities.ts` = 0 for all six), so the mainline handler is the
authority.

| entity | n | what the authority does that we do not | tag row | uses |
|---|---|---|---|---|
| **Forecast** (Castform) | 2 | `-formechange … Castform-Rainy \|[msg]\|[from] ability: Forecast` in rain. The forme carries a **different type** (Water) — board-material without argument. | `formeFollowsWeather` with the full `byWeather` / `typesByWeather` map already populated | 15 |
| **Symbiosis** | 1 | `-activate … ability: Symbiosis\|Life Orb\|[of] p2b: Torkoal`, then the item moves. We emit **neither** the announcement nor the transfer. | `passesItemToAlly` | 69 |
| **Sand Spit** | 1 | `-weather Sandstorm \|[from] ability: Sand Spit` when the holder is hit. **The weather is not set in ours.** | `punishesAttacker` with `setsWeather: "sandstorm"` — the param is there | 34 |
| **Protean** | 1 | `-start … typechange\|Normal\|[from] ability: Protean` on Meowscarada clicking Protect. **The type does not change in ours.** | `typeBecomesMoveType`, `oncePerSwitchIn: true` | 571 |
| **Regenerator** | 1 | `-heal … 170/170 \|[from] ability: Regenerator\|[silent]` on switch-out. `[silent]` but HP-bearing. | — | **1,855** |
| **Psychic Terrain** (move) | 1 | `-activate … move: Psychic Terrain` blocking a Prankster-boosted Thunder Wave into a grounded Annihilape. **We let the paralysis land.** | — | — |

Regenerator is the one to pick up first on usage; Psychic Terrain is the one to pick up first on
consequence (a status that should not exist).

Caveat I owe: `grep -ci` on `medicham2-browser.js` returns 0 for `sandspit` and 0 for
`supremeoverlord`, and non-zero for the other four. **That is weak evidence and I am labelling it as
such** — this engine matches on tag SHAPE, not on names, exactly so that a new ability is picked up
without editing it. A zero name-count is a hint, not a finding.

---

## 6. The weather-upkeep group: a named unknown, not a guess (rank 5, 5 games)

What I can state as fact:

- 5 games, always `|-weather|<w>|[upkeep]` present in Showdown and absent in ours (4× rain, 1× sand).
- 4 are backed by cards; in **all four the entire turn consisted of switches** and nothing else.
- Our emission is `engine/medicham2-browser.js:24068`:
  `if(TR){if(field.weather&&!field.wSup)TR.wx(field.weather,null,null,true); else if(_wx0&&!field.weather)TR.wxNone();}`
- The authority's is `data/conditions.ts:506-508` — the weather condition's `onFieldResidual`, reached
  through `findFieldEventHandlers`, whose duration logic (`sim/battle.ts`, the `Residual` branch) ends
  the weather and SKIPS the residual when the counter hits zero. That matches our structure.

**Three hypotheses I could not separate, and I am not picking one:**

1. Our weather was never set in that game (then we would emit nothing at all — which is what we do).
2. Our weather clock expired a turn early (but then we would emit `-weather|none`, and we do not).
3. The residual is skipped on a switch-only turn.

**One thing I DID settle while looking, and it is a separate defect worth its own probe.**
Line 24068 gates the upkeep line on `!field.wSup`. **Showdown does not.**
`findFieldEventHandlers` reads `field.getWeather()`, the RAW weather — not `effectiveWeather()` —
so the authority prints `|-weather|X|[upkeep]` **even while Cloud Nine suppresses the weather.** Our
line goes silent. `suppressesWeather()` (`medicham2-browser.js:6753`) matches exactly one ability —
I printed the match set: **`cloudnine` and nothing else** — so this is not an over-match, it is a
narrow and real asymmetry. **It is almost certainly NOT the cause of these five**, because no Cloud
Nine carrier is on the field in any of the four sampled cards. Two separate things; do not let the
second one absorb the first.

Settling command for the group:

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node engine/explain_divergence.js --live --cls "event missing from medicham2" --n 30
```

`--live` plays fresh games, because an artifact seed is not replayable (the file says so in its own
header: the pool moves, the first stored divergence's seed no longer resolves). If that is too
scattershot, a two-body staged probe — Pelipper leads, both sides switch everything on turn 2, assert
the `[upkeep]` line — costs a second and answers it outright.

---

## 7. Coverage, honestly stated

**Attributed: 82 of 82 (100%) at cause-string level.** `classes[].causes[]` enumerates every
divergence with a count, so there is no unattributed residue. The classifier in §8 matches all 82 and
leaves nothing over.

**Backed by evidence: 64 of 82 (78%).** 61 from `first_divergences` (60 cards, several sharing a
cause), plus 2 from `mega.cost_of_the_megas.on_a_detailschange_line` and 2 from `order_probe`, net +3.

**Inferred from the cause string alone — 18 games.** Every mechanism claim about these is weaker:

```
1  |-weather|sandstorm|[upkeep] <> |upkeep            -> weather-upkeep (shape matches the 4 rain cards)
1  |-immune|p1b <> |cant|p2a|flinch                   -> spread flinch / immune order
1  |-end|p1b|fallenundefined <> |switch|p1b|gengar    -> Supreme Overlord (4 siblings ARE carded)
1  |upkeep <> |move|??:farigiraf|roar                 -> off-field body (declared_gaps confirms it)
1  |-fail|p2b <> |-supereffective|p1b|1               -> -fail announce
1  |-fail|p2a <> |-resisted|p1a|1                     -> -fail announce
1  |-fail|p1a <> |-damage|p2a|0fnt                    -> -fail announce, MATERIAL if the shape holds
1  |-fail|p2b <> |-damage|p1a|0fnt                    -> -fail announce, MATERIAL if the shape holds
1  |-damage|p1b|H/H <> |-supereffective|p1a|1         -> spread target order
1  |switch|p1a|palafin <> |move|p2b|helpinghand       -> switch order (switch-vs-MOVE, odd; may be its own thing)
1  |-unboost|p1a|atk|1 <> |-unboost|p2a|atk|1         -> two-side entry order
1  |detailschange|starmiemega <> charizardmegay       -> mega order (context IS in mega.cost_of_the_megas)
1  |detailschange|mawilemega <> mawilemega            -> mega order (ditto)
1  |move|p1a|protect <> |move|p2a|detect              -> speed tie (order_probe HAS this one)
1  |-enditem|p2a|sitrusberry|[eat] <> ...lifeorb      -> berry vs self-damage
2  |-sideend|p2:|tailwind <> |-sideend|p1:|tailwind   -> two-side residual order
1  |-boost|p2a|atk|2 <> |-boost|p2a|spd|2             -> Moody
1  |-boost|p1a|spa|2 <> |-boost|p1a|spd|2             -> Moody
1  |-unboost|p1a|spa|1 <> |-unboost|p1a|spe|1         -> Moody MINUS half, INFERRED
1  |-unboost|p2a|def|1 <> |-unboost|p2a|spd|1         -> Moody MINUS half, INFERRED
```

The two `|-fail| <> |-damage| … 0fnt` rows are the ones I most want carded — if the shape holds they
are a move failing in the authority and **killing something** in ours, which would be the most
serious single finding in this report. **They are not carded and I am not claiming it.**

Raise the sample with `--dump-games`:

```bash
node engine/game_differential.js --games 961 --end-state \
     --release c36782953dee --team-store data/team-pool-frozen \
     --dump-games 200 --dump-out data/divergence-turns.json --write
```

### What the sampling structurally leaves out

- **Everything after the first divergence.** The middle arm stops at `the first divergent LINE` in 81
  of 82 games (`arms[0].end_reasons`). A game with three mechanisms wrong contributes one. So these
  31 mechanisms are the 31 that fire EARLIEST, not the 31 that exist.
- **The mirroring limit the brief named is real and measured**: `forced_switch_slots_mirrored: 899`,
  `forced_switch_slots_passed: 5`, **`forced_switch_unmirrorable: 4`**, and one game ended
  `the boards parted — medicham2's placement cannot be expressed to showdown (p1: slot 1 holds
  metagross, which showdown has but cannot switch in (fainted/active))`. Up to 4 games carry an
  instrument-manufactured constraint. None of them surfaced as a divergence CAUSE, so no group above
  rests on it — but rank 11 (switch ordering, 5 games) is the group most exposed to it and should be
  checked against it before anyone edits the engine.
- **2 games are void** (`mid_void.low_identity_by_category`: acc 2, crit 2, dmg 2; the unshared
  addresses are `outrage` and `iceshard` in both directions). **One of my rank-7 rows is an Outrage
  retargeting.** It may be the same game. That is a real risk to that row and I am flagging it rather
  than burying it: check whether the Outrage divergence and the Outrage void game are the same seed
  before treating it as an engine defect.

---

## 8. The classifier, so this can be re-derived

```js
const d = require('./data/game-differential.json');
const R = [ /* regex -> mechanism name, longest-specific first */ ];
for (const c of d.classes) for (const x of c.causes) {
  const g = R.find(([re]) => re.test(x.cause));   // tally[g] += x.n
}
```

Full rule list, in order, matching all 82 with zero unmatched:

```
MOODY-STAT-PICK              /moody|-boost field 3 ::|-unboost field 3 ::/          8
FAIL-ANNOUNCE                /:: \|-fail\|p\d[ab]?\b/                               7
FAINT-EAGER                  /<> \|faint\|/  +  /:: \|-fail\|p2a\|psn <> \|faint/   6
WEATHER-UPKEEP-MISSING       /-weather\|\w+\|\[upkeep\] <> \|upkeep/                5
ZERO-MAGNITUDE-BOOST         /\|(atk|def|spa|spd|spe)\|0 <>/                        5
SILENT-END-FALLEN            /fallenundefined/                                      5
SIMULTANEOUS-SWITCH-ORDER    /:: \|switch\|.* <> \|(switch|move)\|/                 5
SPREAD-DRAIN-INTERLEAVE      /\[from\]drain/                                        4
ABILITY-ACTIVATE-ANNOUNCE    /toxicdebris/ /telepathy/                              3
WRONG-BODY-TARGETED          /-(damage|status): a different body/ + spread-order    3
SILENT-END-VOLATILE          /-end\|\w+\|(throatchop|syrupbomb)/                    2
ENTRY-EFFECT-ABSENT:forecast /castformrainy|forecast/                               2
SPREAD-FLINCH                /psychicfangs <> \|cant\|.*flinch/ + immune-order      2
SEMI-INVULNERABLE            /-miss\|.* <> \|-boost/ + /gravity/                    2
SWITCHIN-ABILITY-ORDER       /-unboost\|p1a\|atk\|1 <> \|(-weather.*drizzle|-unb)/  2
EXACT-SPEED-TIE              /\|move\|\w+\|protect <> \|move\|\w+\|(protect|detect)/2
BERRY-VS-SELF-DAMAGE         /sitrusberry\|\[eat\] <> \|-damage.*(recoil|lifeorb)/  2
MEGA-DETAILSCHANGE-ORDER     /detailschange/                                        2
TWO-SIDE-RESIDUAL-ORDER      /-sideend\|p2:\|tailwind <> \|-sideend\|p1/            2
FUTURE-SIGHT-DAMAGE          /-damage field 3/                                      2
ENTRY-EFFECT-ABSENT:*        symbiosis, sandspit, psychicterrain, regenerator,
                             protean                                            1 each
FAINT-EAGER-PERISH           /\|upkeep <> \|-damage\|\w+\|0fnt/                     1
COPYCAT-FAILS                /<> \|-fail\|p1a$/                                     1
SPURIOUS-BERRY-ACTIVATE      /<> \|-activate\|p1b\|sitrusberry/                     1
SUBSTITUTE-HP                /-end\|p2a\|substitute/                                1
OFF-FIELD-BODY               /\?\?:/                                               1
INTIMIDATE-IMMUNE-LINE       /-immune\|p1a <> \|-unboost\|p1a\|atk\|1/              1
                                                                          total   82
```

Caveats on the classifier itself, because a classifier is an instrument too:

- `FAINT-EAGER` is `<> |faint|` — a broad match. It is correct here (all 6 are "the authority does
  something, we faint") but it would over-match a genuine faint-vs-faint ordering case in a later run.
- `FUTURE-SIGHT-DAMAGE` matches on the CLASS `-damage field 3`, not on Future Sight. It is right today
  because **both** members happen to follow `-end … move: Future Sight` in their cards; a third
  `-damage field 3` from any other source would be mislabelled.
- `ABILITY-ACTIVATE-ANNOUNCE` merges Toxic Debris and Telepathy, which are two different one-line
  fixes at two different sites. Merged because the *shape* is one thing: the authority names the
  ability, we name the consequence.

---

## 9. Two instrument problems the next person will otherwise walk into

### 9a. `divergence_cards.js` renders a two-day-old run and will not say so

`data/divergence-turns.json` is **`2026-08-22T03:05:53Z`**, release **`6a05dd9ad60d`**, and its own
metadata reads `of_diverged: 378`, `arms_in_dump.diverged_in_arm: {middle:133, top-tie-first:120,
bottom-tie-first:125}`. **That is the 39.6%-era run.** The current differential is release
`c36782953dee` at `2026-08-23T06:10Z` with `middle: 82`.

Running `node engine/divergence_cards.js` today produces a beautiful, readable HTML page of the WRONG
RUN, with no staleness warning anywhere on it — its causes include `-unboost: a different body ::
|-unboost|p1a|accuracy|1` and `ordering :: |-weather|sunnyday|[from]drought <> |-heal|…hospitality|`,
neither of which is in today's 82. **This is exactly the shape CLAUDE.md warns about**: a rendering
that computes nothing, reading a file nobody re-generated, indistinguishable from a fresh result.
`--dump-games N --dump-out … --write` on the next differential run fixes it; nothing else will,
because the dump only writes alongside `--write` and only when `--dump-games` is given a COUNT.

### 9b. The three arms disagree by 20% and only one is the primary

68 / 77 / 82. Any figure quoted without its arm is ambiguous to within ±10 games, and the last one
quoted (`77`) named the non-primary corner. Worth a `mode`-string discipline the way
`arms_comparable.js` already enforces for the pin digest.

---

## 10. What I would pick up first, and why

1. **Substitute blocks Intimidate** (rank 1). One game, but: board-material with no argument needed,
   both sites cited to the line, the fix is a one-clause guard in a loop that already exists, and the
   two entities are 18,772 and 1,222 uses. Highest confidence-per-hour in the list.
2. **The six absent entry effects** (rank 3). Seven games, six independent probes, every one
   board-material by structure, every one already carrying a populated tag row — so the work is
   wiring, not modelling. Start with Regenerator (1,855) and Psychic Terrain (a status that should
   not exist).
3. **`|faint|` batching** (rank 4). Six games plus the Perish variant, and it is ONE mechanism with
   one site in the authority (`faintMessages()`, `sim/battle.ts:2532`). It is the largest single
   structural cause in the list and it touches every KO in the format. It is also the one most likely
   to move several other groups at once — rank 13 (berry vs self-damage) and rank 22 (perish) are
   plausibly the same fix.

**Before any of that, run the `--end-state` command in §2.** Twenty of these 31 mechanisms are
UNKNOWN on board-materiality and the bar is board-material zero. Fixing narration first is how the
gate stays shut while the work goes into the wrong half.
