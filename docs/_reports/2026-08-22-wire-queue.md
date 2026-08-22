# THE WIRE QUEUE — the 121 whole-game divergences grouped by MECHANISM (ROADMAP #81)

Historical findings record. Not maintained, not current state, never cite as such.
Superseded by the register rows it feeds.

**Read-only triage.** Nothing under `engine/` or `tests/` was edited. `game_differential.js`,
`quarantine.js`, `roster.js`, `all_mechanics_fire.js` were NOT run, no release was cut, nothing was
committed. One side effect to disclose: `node engine/open_work.js` was run to print the open register
(CLAUDE.md's own instruction — *never type a list of what is open, print it*) and that command
rewrites `data/open-work.json` as its artifact. It derives entirely from `docs/ROADMAP.md` plus live
artifacts and is idempotent; no other file under `data/` was touched.

## Source

`data/game-differential.json`, generated 2026-08-22T06:47Z, release **603d9a69d5a3**, mode
`A/middle/pins:1fd77b835ee2/credit:observed-effect/v1/nature:real`, 961 games, **126 raw divergences
across 116 distinct cause strings**, 5 of them DECLARED (`fallenundefined`), leaving **121**.

`data/divergence-turns.json` was read for context but is stamped release **6a05dd9ad60d** — it is the
40 cards Will read, from the PREVIOUS run (133 diverged). Every card fact used below is labelled as
coming from that run, never pooled with the 121.

Every cause string was classified. **0 unmatched**, 126 attributed, 121 non-declared. The classifier
prints its members before it counts them, so an over-matching bucket is visible rather than inferred;
the full member listing is reproduced in §7.

---

## 1. THE HEADLINE

**The 121 reduce to 35 distinct mechanisms.** The comparator's 9 classes were hiding them: `event
missing from medicham2` alone (46 games) splits across **17** different mechanisms, and one mechanism
(the faint/berry/residual sequence) is scattered across four different classes.

**21 of the 35 already have a register row.** **13 do not**, and **1 more is a regression of a row that
is CLOSED** (`#224`, the `??:` off-field slot placeholder). Those 14 are named in §4 — grouped into 11
rows there, because three of the one-game announcement-shape defects belong in one row — and they are
the only thing here that needs routing.

**The damage-roll index hypothesis does NOT hold on the 121.** It explains at most 1 of them, and the
reason is structural rather than lucky — §5.

---

## 2. THE FULL GROUPING, RANKED BY SHARE OF THE 121

`family` is what has to be changed to fix it: `state` = a board leaf differs; `rule` = a move resolves
that should not (or vice versa); `order` = the right things happen in the wrong sequence; `emission` =
the board is identical and a protocol line is missing or wrong; `dice` = a shared die is spent at a
different address; `instrument` = the harness, not the engine.

| n | % of 121 | family | mechanism | register row | usage behind it |
|---:|---:|---|---|---|---|
| 23 | 19.0% | state | **DRAG / bench ORDER** — the phaze index selects a different body | **#340** | Roar 545 + Dragon Tail 191 + Whirlwind 61 + Circle Throw 38 clicks; blast radius is far larger (see below) |
| 13 | 10.7% | rule | **THE `-fail` CONTRACT** — a refusal announced / performed | **#241 #256 #337 #343** (#342 closed) | Trick 519, Role Play 40, Endure 27, Disable 1,585 clicks |
| 10 | 8.3% | state | **MORPEKO** — the authority switches it in and we PASS | **#328** | Morpeko **0.133% of teams (35)**; Hunger Switch 4 clicks |
| 8 | 6.6% | dice | **MOODY** — a different stat is chosen | **NONE** | Moody **3.10% of teams (813)**, 332 clicks |
| 7 | 5.8% | order | **FAINT announcement inline here, batched there** | **#331** | universal |
| 6 | 5.0% | order | **SITRUS / berry timing inside the action** | **#332** | Sitrus Berry **66.88% of teams (17,543)** |
| 5 | 4.1% | emission | **WEATHER `[upkeep]` line never emitted** | **NONE** | Drizzle 13.34% of teams; Rain Dance 1,879 clicks |
| 5 | 4.1% | emission | **ZERO-MAGNITUDE boost/unboost at the ±6 cap** | **NONE** | Intimidate 52.28% of teams; Parting Shot 9,030, Charm 1,763 clicks |
| 4 | 3.3% | order | **SPREAD DRAIN heal merged and late** (Matcha Gotcha) | **#339** | Matcha Gotcha 6,463 clicks |
| 4 | 3.3% | emission | **LIFE ORB recoil not emitted** | **#338** | Life Orb **64.40% of teams (16,892)** |
| 3 | 2.5% | order | **SWITCH ORDER among simultaneous switches** | **NONE** | universal |
| 3 | 2.5% | order | **SAME-BRACKET MOVE ORDER** (Protect/Detect at +4) | **#290 #311** | Protect 96,566, Detect 4,865 clicks |
| 2 | 1.7% | emission | **TOXIC DEBRIS `-activate`** not emitted | **#329** | Toxic Debris 7.01% of teams |
| 2 | 1.7% | state | **FORECAST / Castform forme never changes** | **#204** (+#330) | Castform 0.03% of teams (8) |
| 2 | 1.7% | dice | **FLINCH** — we flinch where the authority does not | **NONE** (#84 is adjacent, not this) | Fake Out and every flinch secondary |
| 2 | 1.7% | order | **SWITCH-IN EFFECT ORDER** (`onSwitchInPriority`) | **#330** | Drizzle 13.34%, Intimidate 52.28% of teams |
| 2 | 1.7% | order | **MEGA-EVOLUTION ORDER** | **#311** | every game with two megas |
| 2 | 1.7% | order | **SIDE-CONDITION EXPIRY ORDER** (Tailwind, both sides) | **NONE** (#242 closed) | Tailwind 17,573 clicks |
| 2 | 1.7% | dice | **RANDOM / SPREAD TARGET** — a different body took the hit | **#335 #294** | Outrage 109 clicks; every spread move |
| 1 | 0.8% | state | SYMBIOSIS not modelled | #175 | 0.19% of teams |
| 1 | 0.8% | order | SAND SPIT (`onDamagingHit`) vs item recoil | #329 | 0.05% of teams |
| 1 | 0.8% | emission | POLTERGEIST `-activate <item>` not emitted | **NONE** | 1,093 clicks |
| 1 | 0.8% | emission | SYRUP BOMB `-end` not emitted | #345 | 3 clicks |
| 1 | 0.8% | state | REGENERATOR switch-out heal | **NONE** | **6.08% of teams (1,596)** |
| 1 | 0.8% | state | PROTEAN on a MEGA forme (Greninja-Mega) | **NONE** | Protean 1.65% of teams |
| 1 | 0.8% | emission | LEVITATE immunity attribution / target order | #239 #256 | 10.04% of teams |
| 1 | 0.8% | state | PERISH / residual KO one step out | #345 | Perish Song |
| 1 | 0.8% | dice | MULTI-HIT COUNT (Scale Shot: 4 hits there, 5 here) | **NONE** (#333 is multi-hit DAMAGE) | Scale Shot 328 clicks |
| 1 | 0.8% | emission | SUBSTITUTE break vs damage announcement | **NONE** | 1,070 clicks |
| 1 | 0.8% | instrument | ROAR emitted by an OFF-FIELD body (`MEDFAILS.traceBodyOffField`) | **#224 is CLOSED** — this is a regression | Roar 545 clicks |
| 1 | 0.8% | emission | TELEPATHY announcement shape | **NONE** | 0.91% of teams |
| 1 | 0.8% | order | MOVE ORDER, ordinary bracket (Gravity) | #290 | 410 clicks |
| 1 | 0.8% | emission | CURSED BODY / DISABLE announcement shape | #329 | 8.30% of teams |
| 1 | 0.8% | state | RAGE FIST / `timesAttacked` — a KO we do not make | **NONE** in the engine (#283 #287 are `board.js`) | Rage Fist 1,042 clicks |
| 1 | 0.8% | damage | DAMAGE VALUE off by one (Hippowdon 35 vs 34) | #319 #312 | — |
| *5* | *—* | *declared* | *SUPREME OVERLORD `fallenundefined`* | *#321* | *Kingambit 37.61% of teams* |

**Where the numbers come from, and the two traps.**

- **Trap 1 — `max_uses` is the max over BOTH lines of a pair.** Never used here. For each cause the
  entity was taken from the side that DIFFERS: for `event missing from medicham2` that is the
  AUTHORITY's line; for `extra event emitted by medicham2` it is ours. Worked example: the cause
  `|-start|p1b|typechange|normal|[from]protean <> |-singleturn|p1b|protect` carries `max_uses` **134,710
  (Protect)**, which is our line and is not the defect. Ranked on Protean — **571 uses / 1.65% of
  teams** — which is why it sits at the bottom of the table and not the top.
- **Trap 2 — a species carries `uses: null` and prints as 0.** Every species figure above is
  `data/sheet-usage.json` `per_team` (26,232 open-sheet teams over both human stores), never the
  artifact's null. That is what puts Kingambit's `fallen` family at **37.6% of teams** rather than at
  the bottom, and it is also what makes MORPEKO honest in the other direction: 10 games, **0.133% of
  teams**.
- Move click counts are `data/regulation-usage.json` `clean.moves` (16,116 games, 389,142 clicks,
  `games.ladder.jsonl`). Abilities/items are the artifact's own annotation cross-checked against
  `sheet-usage.json`; they agree (Toxic Debris 1,918 vs 1,840 teams).

---

## 3. THE TOP FIVE BY WHAT IT COSTS US

Ranked on **board consequence × corpus usage × share of the 121**, in that order of weight — an
announcement that changes no leaf costs the divergence RATE (which is the gate) and costs MILTANK
nothing, so it cannot outrank a mechanism that moves HP.

**1. DRAG / bench ORDER — 23 games, 19.0%, #340 open.**
The single largest mechanism and the most board-material one: a different body is standing on the
field, so every decision after it is taken against a position the authority does not have. It is one
cause, not 22 — `sim/battle-actions.ts:125-132` **swaps** the outgoing body into the arriving body's
party slot and we remove-and-append. **Its real cost is much larger than the 835 phazing clicks**,
because `bringIn`'s default replacement is `_live(bench)[0]`: every faint replacement and every pivot
without an explicit target reads the same list, in rollouts and in `board.js` features. #340 already
says this and it is the reason to do it first.

**2. THE `-fail` CONTRACT — 13 games, 10.7%, #241 / #256 / #337 / #343 open.**
Not one defect but one derivation, and **6 of the 13 are board-material rather than cosmetic**: the
authority REFUSED the move and we RESOLVED it. Those six read
`|-fail|p2b <> |-supereffective|p1b|1`, `|-fail|p2a <> |-resisted|p1a|1`,
`|-fail|p1a <> |-damage|p2a|0fnt`, `|-fail|p2b <> |-damage|p1a|0fnt` — two of which are a **KO we
score that the authority does not** — plus two Endure rows where the authority's stall counter refused
a shield we granted. The other seven are the announcement half (#241's remainder) plus two
`trapped`-shape and one `disable`-shape mismatch. #342 landed the `null`-vs-`false` model this whole
family needs; the remainder is applying it at each site.

**3. SITRUS / berry timing — 6 games, 5.0%, Sitrus is 66.9% of teams, #332 open.**
The highest-usage item in the format, and #332's own title is *this one changes who survives*. The
authority's residual runs `fieldEvent('Residual') → add('upkeep') → faintMessages() → eachEvent('Update')`
and Sitrus hooks `onUpdate`, so it eats after the upkeep marker AND after faint processing; we eat
before both. A body residual damage would kill is dead before it can eat.

**4. LIFE ORB recoil not emitted — 4 games, 3.3%, Life Orb is 64.4% of teams, #338 open.**
Only 3.3% of the divergences and second only to Sitrus on usage. It is 1/10 max HP the attacker does
not pay, in four separate games, on four different moves (Solar Beam, Brick Break, Rock Tomb, and one
after a Psychic Fangs KO). The tag carries the cost as the English string `"1/10 max HP"`, so nothing
can derive it and whatever applies it is hardcoded elsewhere — which is exactly why it fires
sometimes and not others.

**5. MOODY — 8 games, 6.6%, NO REGISTER ROW.**
The largest unregistered mechanism, and it is board-material: the two engines boost and drop
**different stats**, so speed and damage both move. Under the middle arm's pinned dice both engines
draw the same value at the same address, so this is a stat-SELECTION or draw-ORDER difference, not
randomness. Corroborated independently: `moody` is one of the eight `FIRED-AND-BOARDS-DIFFER`
abilities on the roster (Glalie `boosts.atk 0 / +2`, `def 0 / -1`, `spa -1 / 0`), which the gate
re-run already called "a boost-roll row, an RNG-alignment shape".

**Named, and deliberately NOT in the top five: MORPEKO (10 games, 8.3%).** It is the third-largest
count and it is the wrong thing to spend an evening on. Morpeko is **0.133% of teams**, and #328
already proved with a control that **two of its three causes are the INSTRUMENT** — `game_differential.js`
stamps `_switchKey` in `buildPair` and `freshBodies` (what every played game is built from) drops it,
so the resolver falls to `id(x.name)`, misses, and answers `pass` while the authority switches. My own
independent read of the same lines agrees. **The engine's share of it is C1 only** (a non-permanent
forme change is not reverted when the body leaves the field). Clearing C2 removes ~8% of the published
divergence rate and changes nothing about the game — which is worth knowing before anyone quotes a
rate improvement as an engine gain.

---

## 4. THE THIRTEEN MECHANISMS WITH NO REGISTER ROW, PLUS ONE REGRESSION

Not filed — MEASURE is in `docs/ROADMAP.md`. Named for routing, worst first. Eleven table lines; the
last line carries three separate one-game announcement-shape defects that belong in one row.

| n | mechanism | what a failing probe would stage | evidence in hand |
|---:|---|---|---|
| 8 | **MOODY picks a different stat** | Glalie under a pinned die, three consecutive residuals; assert both engines name the same `+2` and `-1` stat | 8 differential games + the roster's `moody` DIFFER row; two instruments agree |
| 5 | **WEATHER `[upkeep]` line never emitted** | rain up from Drizzle, run to the residual, assert `\|-weather\|RainDance\|[upkeep]` on both. Then repeat WITH a Cloud Nine body | derived: `data/conditions.ts` `raindance.onFieldResidual` emits the line **unconditionally** and Champions does not override it; `medicham2-browser.js:22855` gates the emission on `!field.wSup`, which only Cloud Nine / Air Lock set. `cloudnine` is independently one of the 12 diverging abilities on `all_mechanics_fire`. **Discriminator: if our sky were merely gone we would have emitted `\|-weather\|none`, and we emit nothing** — so this is a suppressed announcement, not an expired sky, in at least the common case |
| 5 | **ZERO-MAGNITUDE boost/unboost at the cap** | Intimidate a body to −6 Attack, then Parting Shot / Charm it; assert `\|-unboost\|X\|atk\|0` on both | derived: `sim/battle.ts:2079-2081` — `else if (!isSecondary && !isSelf) this.add(msg, target, boostName, boostBy)` fires with `boostBy === 0`. **Provably announcement-only** (nothing moved), so it costs the rate and no board leaf |
| 3 | **SWITCH ORDER among simultaneous switches** | two double-switches with a known speed spread; assert the `\|switch\|` line order | derived: `sim/battle-queue.ts:270` → `battle.ts:2657` — a switch action's `speed` is `action.pokemon.getActionSpeed()` and `action.pokemon` is the **OUTGOING** body, not the arriving one. #328 explicitly says `switchin_order.js` governs entry ABILITIES and not which `\|switch\|` lines are emitted, so #330 does **not** cover this |
| 2 | **FLINCH — we flinch where the authority does not** | Fake Out into a body, same pinned `sec` stream, assert `\|cant\|...\|flinch` fires on both or neither | two causes: `\|-immune\|p1b <> \|cant\|p2a\|flinch` and `\|move\|p2a\|psychicfangs <> \|cant\|p2a\|flinch`. #84 is the adjacent `false`-vs-`null` question, not this |
| 2 | **SIDE-CONDITION EXPIRY ORDER (Tailwind, both sides)** | Tailwind on both sides expiring the same turn; assert which `-sideend` lands first | #242 (a duration-only effect expiring from inside the residual walk) is CLOSED; the two-SIDES ordering was not in it |
| 1 | **MULTI-HIT COUNT** | Scale Shot under a pinned die; assert the same number of `-damage` lines | in the sample, Showdown's Scale Shot hit **4** times and ours hit **5**. #333 is multi-hit DAMAGE and its fix does not touch the count. `scaleshot` is also one of the 22 diverging moves on `all_mechanics_fire` |
| 1 | **REGENERATOR switch-out heal** | switch a chipped Regenerator body out; assert `\|-heal\|...\|[from] ability: Regenerator\|[silent]` | 6.08% of teams; also one of the 9 SHOWDOWN-ONLY abilities in the gate re-run. #313 is a different claim (abilities that cannot say why they did not fire) |
| 1 | **PROTEAN on a MEGA forme** | Greninja → Greninja-Mega, first click; assert `-start typechange` and the resulting types | the mega overwrites the ability to Protean (derived from the format); this is gate-re-run defect #2 and the `greninjite` roster DIFFER row. Two instruments, one entity |
| 1 | **RAGE FIST / `timesAttacked` in the engine** | hit a body N times, then Rage Fist; assert the same damage | Annihilape Rage Fist on a 43/170 Avalugg: the authority KOs, we leave 15. #283 and #287 are `board.js` / the seed audit, not `medicham2` |
| 1 | **POLTERGEIST / TELEPATHY / SUBSTITUTE announcement shapes** | three separate one-line probes | `-activate move: Poltergeist <item>` missing; `-activate telepathy` vs our `-immune [from] telepathy`; `-end substitute` vs our `-activate substitute [damage]` |

**One row to REOPEN rather than file: ROAR from an off-field body.** `|upkeep <> |move|??:farigiraf|roar`
— the `??:` slot placeholder is back in the protocol stream. **#224 closed that on 2026-08-12** ("the
largest single family"), and the gate re-run's counter `MEDFAILS.traceBodyOffField = 4, first offender
farigiraf` says the same thing from the other side. A closed row with a live counter and a live
divergence is the shape CLAUDE.md calls a regression, not a new defect.

---

## 5. THE DAMAGE-ROLL INDEX HYPOTHESIS — IT DOES NOT HOLD ON THE 121

The gate re-run's hypothesis was that one damage-roll INDEX error explains the roster's 157 move rows
and six of its eight ability rows. **Tested against the 121 whole-game divergences, it explains at
most one of them, and probably none.**

**Why, and it is structural rather than lucky.** The middle arm does not let a damage-index convention
error reach the comparison. `game_differential.js:1054-1057` wraps the authority's `random(16)` and
returns `midDamageIndex(u) = 15 - floor(u*16)`, and `medicham2-browser.js:8055-8058`'s
`damageRollIndex(u)` is the same expression, duplicated on purpose (the engine's own comment says the
duplication must stay, because an engine that requires its own instrument cannot be measured by it).
**Both sides therefore receive the same index from the same draw.** This run took the inversion
**2,635 times** (`mid_void.damage_roll_index_inversions`).

**And the empirical check agrees.** `-damage field 3` — the class where the same body takes a
different HP number — is **2 of 126** in this run. When the index really was read backwards on one
side (#303), that same class was **226 of 491**. So this is the instrument that would scream, and it
is quiet. Of the two survivors, one is **Rage Fist** (a base-power / `timesAttacked` question, not a
roll) and the other is **1 HP** on a Hippowdon (`35/183` vs `34/183`) — a rounding step, not a span.
The whole `damage` family across the 121 is **1 game, 0.8%**.

**Two consequences for how the queue is ordered.**

1. **The WIRE QUEUE does not wait on #319.** The roster's 157 and the differential's 121 are measuring
   near-disjoint things; fixing the 157 should move the 121 by approximately zero. Anyone who lands
   #319 and then quotes a whole-game improvement is quoting something else.
2. **The "one index error" reading of #319 itself deserves a probe before an evening is spent on it,
   and the artifacts are already in tension with it.** The roster's primary arm is `top-tie-first`
   (`CORNER_TOP`, `damageIndex: 0`) and sub-100-accuracy moves run `bottom-tie-first`
   (`damageIndex: 15`) — **both endpoints**. A wrong index INSIDE the band is invisible at an endpoint
   by exactly the argument `test-engine-diff.js` and #304 already make, and `test-engine-diff.js`
   reads **0/6000 at those same two corners**. Those two facts cannot both be true of an index error.
   The 157 are more likely a VALUE error (the band's endpoints themselves), a modifier-chain
   difference on boards the differential does not stage, or something in the 307 `party.hp` leaves
   rather than the 309 `hp` ones. **First probe for #319 should be "index or value": stage one roster
   move and print both engines' full 16-entry band side by side.** I did not run the roster and cannot
   settle it from here; this is a lead with two receipts, not a finding.

---

## 6. WHICH GROUPS ARE PLAUSIBLY ONE FIX

**A. THE RESIDUAL / FAINT / BERRY SEQUENCE — 13 games, 10.7%, the highest-yield single derivation.**
FAINT batching (7, #331) and SITRUS/berry timing (6, #332) are one ordering, not two. The authority's
`runAction` tail is a single sequence:

```
case 'residual':  this.fieldEvent('Residual');        // sandstorm chip, poison, Leftovers
                  if (!this.ended) this.add('upkeep');
...               this.faintMessages();                // deaths processed HERE
...               this.eachEvent('Update');            // Sitrus (onUpdate) fires HERE
```

Both rows are the same three lines in a different order. It also picks up the two sandstorm-vs-faint
causes and the `-enditem sitrus <> faint` cause, which currently sit in two different comparator
classes. **#331 and #332 should be worked together or the second will re-open the first.**

**B. `onDamagingHit` — 4 games, 3.3%, #329, already filed as one row.** Toxic Debris (2), Sand Spit (1)
and Cursed Body (1) are three symptoms of the hook resolving before the move's own secondaries and
firing once per move instead of once per hit. #329's own text names 20 legal abilities on the hook, so
the 4 games understate it.

**C. THE ACTION QUEUE — 9 games, 7.4%, partly #290 / #311, partly unregistered.** SAME-BRACKET MOVE
ORDER (3), SWITCH ORDER (3), MEGA ORDER (2) and the Gravity row (1) all come out of one comparator:
`order → priority → speed → subOrder`, with switch actions keyed on the **outgoing** body's speed.
#290 and #311 cover the move-vs-move and mega halves; the `|switch|` half has no row. **Plausibly one
fix; verify before assuming, because #328 has already refuted one ordering hypothesis in this area
with a control.**

**D. NOT one fix, but worth counting together: the emission-only tail — at least 18 games, 14.9%.**
Weather `[upkeep]` (5), zero-magnitude boosts (5), Toxic Debris `-activate` (2), Poltergeist, Syrup
Bomb, Telepathy, Levitate, Substitute, Cursed Body (1 each). These are separate handlers and share no
code. What they share is that **the board is identical and only the stream differs** — the
zero-magnitude family is provably so (`boostBy === 0` means nothing moved). They are ~15% of the gate's
number and ~0% of MILTANK's problem, and that asymmetry should be stated whenever the 12.6% is quoted.

**E. Explicitly NOT one fix.** MORPEKO (10) is three causes in two files (#328: C1 engine, C2 and C3
instrument). The `-fail` contract (13) is one MODEL — #342's `null`-vs-`false` — applied at many
independent refusal sites; landing the model does not land the sites.

---

## 7. THE CLASSIFIER'S MEMBERS — the top buckets, printed rather than asserted

Reproduced so an over-matching bucket is visible. Every remaining bucket has 1–2 members and is listed
by name in §2.

```
## DRAG / bench ORDER (23) — 22 cause strings, all class `drag: a different body`, all of the shape
   |drag|pXa|SPECIES <> |drag|pXa|OTHER-SPECIES.  One string carries n=2 (incineroar<>sneasler).

## THE `-fail` CONTRACT (13)
   1  |-fail|p2b <> |move|p1a|psychicfangs           (Trick refused there, we moved on)
   1  |-fail|p1a <> |move|p2b|roleplay
   1  |-fail|p2b <> |upkeep
   1  |-weather|raindance|[upkeep] <> |-fail|p1a     (Copycat: an EXTRA -fail from us)
   1  |-fail|p1b <> |-singleturn|p1b|endure          | BOARD-MATERIAL: the shield was granted here
   1  |-fail|p2a <> |-singleturn|p2a|endure          | BOARD-MATERIAL
   1  |-fail|p2a <> |-activate|p1a|trapped           (shape)
   1  |-fail|p1b <> |-activate|p2a|trapped           (shape)
   1  |-fail|p2b <> |-start|p1a|disable              (shape)
   1  |-fail|p2b <> |-supereffective|p1b|1           | BOARD-MATERIAL: the move connected here
   1  |-fail|p2a <> |-resisted|p1a|1                 | BOARD-MATERIAL
   1  |-fail|p1a <> |-damage|p2a|0fnt                | BOARD-MATERIAL: a KO we score, they do not
   1  |-fail|p2b <> |-damage|p1a|0fnt                | BOARD-MATERIAL: a KO we score, they do not

## MORPEKO (10) — every one is |switch|pXy|morpeko on the authority against something else or
   nothing from us.  No other species appears in this shape.

## MOODY (9 rows -> 8 games after removing one Intimidate-order row, see below)
   2  |-boost|p2a|spa|2  <> |-boost|p2a|def|2        (card 17 confirms `[from] ability: moody`)
   1  |-boost|p2a|spd|2  <> |-boost|p2a|spa|2
   1  |-boost|p1a|def|2  <> |-boost|p1a|spe|2
   1  |-boost|p2a|atk|2  <> |-boost|p2a|spd|2
   1  |-boost|p1a|spa|2  <> |-boost|p1a|spd|2
   1  |-unboost|p1a|spa|1 <> |-unboost|p1a|spe|1
   1  |-unboost|p2a|def|1 <> |-unboost|p2a|spd|1
   [MOVED OUT] |-unboost|p1a|atk|1 <> |-unboost|p2a|atk|1  -> SWITCH-IN EFFECT ORDER; this is two
   Intimidates resolving in a different order, NOT Moody.  Caught by printing the members.

## FAINT batching (7)
   1  |-sidestart|p2:|stealthrock <> |faint|p2a      (Stone Axe's hazard lands before the faint)
   1  |faint|p1a <> |faint|p2a                       (Final Gambit: faintMessages(lastFirst))
   1  |faint|p2a <> |faint|p1a
   1  |-enditem|p2b|ironball|[from]fling <> |faint|p1a
   1  |-damage|p2b|H/H|[from]sandstorm <> |faint|p1b
   1  |-damage|p2a|H/H|[from]sandstorm <> |faint|p1a
   1  |faint|p1a <> |-status|p1b|brn                 (ambiguous: may be a Heat Wave secondary that
                                                      fired here and not there — flagged, not claimed)

## SITRUS / berry timing (6)
   1  |-enditem|p1a|sitrusberry|[eat] <> |-damage|p2a|H/H|[from]recoil
   1  |-enditem|p1a|sitrusberry|[eat] <> |-damage|p2a|H/H|[from]lifeorb
   1  |-enditem|p2b|sitrusberry|[eat] <> |faint|p2a
   1  |-enditem|p2a|sitrusberry|[eat] <> |-damage|p1b|H/H|[from]recoil
   1  |-enditem|p2a|sitrusberry|[eat] <> |-damage|p1a|H/H|[from]lifeorb
   1  |upkeep <> |-activate|p1b|sitrusberry          (wrong shape AND at the wrong moment)

## WEATHER [upkeep] (5)     4x |-weather|raindance|[upkeep] <> |upkeep ;  1x sandstorm
## ZERO-MAGNITUDE boost (5) |-unboost|X|atk|0 and |-boost|X|atk|0 against our NEXT line, 5 distinct
## SPREAD DRAIN (4)         |-heal|p2a/b|H/H|[from]drain <> |-damage|p1b|H/H  (all Sinistcha)
## LIFE ORB (4)             |-damage|X|H/H|[from]lifeorb <> our next line, 4 distinct
```

---

## 8. CORROBORATION ACROSS INSTRUMENTS

Nine of the 35 mechanisms are independently red on a second instrument, which raises confidence that
they are engine defects rather than comparator artefacts:

| mechanism | second instrument |
|---|---|
| MOODY | roster / abilities, `FIRED-AND-BOARDS-DIFFER` |
| PROTEAN on a mega | roster / items, `greninjite` DIFFER |
| MULTI-HIT COUNT | `all_mechanics_fire`, `move:scaleshot` diverged |
| POLTERGEIST | `all_mechanics_fire`, `move:poltergeist` diverged (1,383 clicks, ranked 5th) |
| CURSED BODY / DISABLE | `all_mechanics_fire`, `ability:cursedbody` (2,177 teams, ranked 1st) and `move:disable` (1,799) |
| TOXIC DEBRIS | `all_mechanics_fire`, `ability:toxicdebris` (1,840 teams, ranked 2nd) |
| REGENERATOR | `all_mechanics_fire` SHOWDOWN-ONLY **and** ranked 4th (1,596 teams) |
| WEATHER `[upkeep]` | `all_mechanics_fire`, `ability:cloudnine` diverged — the exact ability that sets `field.wSup` |
| ROAR off-field | `MEDFAILS.traceBodyOffField = 4`, first offender `farigiraf` |

---

## 9. WHAT THIS TRIAGE DID NOT ANSWER

- **The weather `[upkeep]` cause is a hypothesis with a discriminator, not a finding.** Three
  candidates remain (`wSup` suppression; a sky that silently vanished; the residual not running). The
  discriminator is stated in §4 and the leading candidate is derived from both sources, but nobody has
  staged it.
- **The `|faint| <> |-status| brn` row** may be a Heat Wave secondary rather than faint batching. It
  is counted under FAINT and said so.
- **Nothing here re-measures anything.** Every count is read out of the committed artifact; every
  Pokémon fact is either derived from `Dex.forFormat('gen9championsvgc2026regmb')` / a cited Showdown
  source line, or read from a repository artifact with its denominator named.
- **`docs/ENGINE.md`'s hand list was not edited and `status.js --write` was not run.** No item on that
  list became a probe in this task, and `--write` rewrites generated blocks and `data/open-work.json`
  while another ENGINE agent is live.
