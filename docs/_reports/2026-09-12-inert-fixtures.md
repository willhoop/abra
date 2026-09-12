# The inert rows get fixtures built around what the ability reads — ENGINE, 2026-09-12

Release `534442d71183`, census `data/mechanics-census.json` (**883 probed / 883 live / 0 missing**,
unmoved), team store `data/team-pool-frozen`. **No engine byte was modified and no release was cut.**
The only code file changed is `tests/roster.js`, which is **not** one of the frozen `SOURCES`.
`engine/board.js`, `engine/magnemite.js` and `data/engine-data.js` were **not** touched.

## Counts, before → after

| stage | before (artifacts at git HEAD) | after | artifact |
|---|---|---|---|
| **items** | 148 MATCH / 0 CNS / 0 CNQ / 0 DEF | **148 / 0 / 0 / 0 — UNMOVED** | `data/roster.items.json` |
| **abilities** | 147 MATCH / 46 CNS / 2 CNQ / 5 DEF | **154 MATCH / 39 CNS / 2 CNQ / 5 DEF** | `data/roster.abilities.json` |
| **moves** | 487 MATCH / 7 CNS / 0 CNQ / 3 DEF | **487 / 7 / 0 / 3 — UNMOVED** | `data/roster.moves.json` |

All three stages: **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE, 0 rows threw.** Plant anchors
**52 / 22 / 36 apply exactly once, none dead**; red demonstrations **52 / 22 / 36 CAUGHT with 0
`ok: false` in all three**. Items and moves are the **controls** and neither moved a single row.

Seven rows closed: `heavymetal`, `lightmetal`, `plus`, `minus`, `surgesurfer`, `infiltrator`,
`longreach`. One row — `quickfeet` — left the inert list for a MEASURED refusal.

## THE PREMISE WAS TESTED FIRST AND IT HELD

The brief's premise is that `THE STAGING IS INERT` means the generic fixture is one where the ability
changes nothing **in the authority either**, so a green would be vacuous. That is exactly what the
verdict computes (`runEntryRaw`: `if (!sdMoved.length) return COULD-NOT-STAGE`), it is what the
previous pass concluded from the other direction, and nothing found here contradicts it. The work is
therefore fixture work and not engine work, and no engine byte was touched.

**But the premise is not sufficient, and one of the 41 was inert for a second reason nobody had
named.** See ROADMAP #612 below: `surgesurfer` was inert because its CONTROL ARM WAS ITS SUBJECT ARM.
An inert row cannot distinguish "the entity did nothing" from "the control did nothing", and only one
of those is a coverage limit.

## The five rules, and what each one derives

Every part of every fixture is read off the format on the run. Nothing below is a typed Pokémon fact.

### `ability/weight-decides-the-power` — `heavymetal`, `lightmetal`

Weight is not a leaf `board_state.js` compares and is not going to become one: neither engine writes
a weight onto a board. So the ability reaches a board only through a move that PRICES off a weight.

- **The multiplier is the handler's own return.** `e.onModifyWeight.call({trunc: Math.trunc}, w)` —
  so Light Metal's truncation is the format's and not this file's, and an odd weight rounds the way
  Showdown rounds it. A handler that throws or returns the weight unchanged is a hard refusal, never
  a guessed `x2`.
- **Which END of the click each move reads is MEASURED**, by calling the callback with the attacker's
  weight varied and then the target's. Printed on demand (`ROSTER_PRINT_WEIGHT_MOVES=1`):

```
WEIGHT-PRICED MOVES: 4 — Grass Knot [Grass Special reads TARGET], Heat Crash [Fire Physical reads
ATTACKER], Heavy Slam [Steel Physical reads ATTACKER], Low Kick [Fighting Physical reads TARGET]
0 threw
```

  Exactly four, no over-match, and every other `deliveryOf` disqualifier still applies —
  `basePowerCallback` is the ONE clause waived, because it is the mechanism being read.
- **The carrier is chosen for CROSSING A THRESHOLD, and that is what makes it a measurement.** The
  base-power table saturates at 2000 hg. Asked of the format:

| body | ability | as TARGET (Low Kick / Grass Knot) | as ATTACKER (Heavy Slam) |
|---|---|---|---|
| Aggron 3600 hg | Heavy Metal | 120 → 120 — **dead** | 40 → 60 vs Goodra-Hisui 3341 hg — **live** |
| Metagross 5500 hg | Light Metal | 120 → 120 — **dead** | learns neither — n/a |
| Scizor 1180 hg | Light Metal | **100 → 80 — live** | learns neither — n/a |

  So Light Metal lands on SCIZOR and not on the bulkier Metagross the ranking would otherwise prefer,
  and Heavy Metal is only expressible from the attacking side. A rule that assumed one shape would
  have refused whichever of the two did not fit it, with a sentence about the format.

### `ability/ally-gated-stat` — `plus`, `minus`

`ability/unconditional-stat-multiplier` excludes this shape BY NAME and says why: its own name is
"NO type and NO HP gate", which Plus satisfies while being thoroughly gated on the ALLY. Its exclusion
clause ends *"They are covered by the census probe `ability/damageBoost`, which stages the partner
this rule structurally cannot"* — true of the census, and it left the roster with nothing.

The partner is drawn from the handler's own `hasAbility([...])` list, and **never from the ability
under test**: `controlOf` strips the ability under test from EVERY body on the subject's side, so a
partner carrying the same one would lose it in the control arm too and the row would be measuring two
removals at once. The negative is a click of the other category, which `onModifySpA` cannot touch.

### `ability/conditional-speed` — `surgesurfer` (and `quickfeet`, refused)

`ability/weather-speed` requires `weatherNamed()` to be non-empty and is right to: it raises the sky
with a partner's ENTRY ability. **No legal body in this format carries a terrain-setting ability** —
asked of the format, every `setTerrain` ability (`electricsurge`, `grassysurge`, `hadronengine`,
`mistysurge`, `psychicsurge`) has ZERO legal carriers here — so the condition is created by a CLICK on
a turn before the reading, and the authority is asked whether it landed.

The ORDER is read by the same two helpers the weather rule uses (`speedFlipFoe` / `speedOrderFoe`),
never a second copy.

### `ability/ignores-screens` — `infiltrator`

`move.infiltrates` is consumed by exactly two things, a Substitute and a screen, and the generic
staging raises neither. The screen AND the category it halves are both read off the move's own
`condition.onAnyModifyDamage`: Light Screen names `Special`, Reflect names `Physical`, and **Aurora
Veil names neither** — it defers to whichever of the other two is up — so it is excluded by the
derivation rather than by a hand-written exception. The foe sets the screen on ITS OWN side, which
leaves the carrier's slots free for the swap control.

### `ability/removes-its-own-move-flag` — `longreach`

A deleted flag is not a board leaf, so it needs a body that READS the flag — and Showdown does not
test `move.flags['contact']` inside Rough Skin, it calls `Battle#checkMoveMakesContact`. So the reader
is derived in two steps: every method on `Battle.prototype` whose OWN source tests the flag this
ability deletes, then every legal ability whose `onDamagingHit` names the flag or calls one of those
methods. That generalises to any flag a future ability deletes.

The reactor must deal damage **unconditionally**: no `randomChance` (Static, Flame Body, Poison Point
at 30% never fire under this pin) and no `!target.hp` (Aftermath requires the reactor to have
FAINTED). What survives in this regulation is Rough Skin, and Iron Barbs, which has no legal carrier.

## THE LEAVES WERE READ BEFORE THE COUNT WAS BELIEVED

This is the test ROADMAP #609 exists for, applied to every row this pass claims:

```
heavymetal    3   p1.active[0].hp
lightmetal    6   p2.party.scizor.hp, p2.active[0].hp
plus          3   p1.active[0].hp
minus         3   p1.active[0].hp
surgesurfer   4   p1.party.meowscarada.hp, p1.active[0].hp
infiltrator   4   p1.party.whimsicott.hp, p1.active[0].hp
longreach     6   p2.party.decidueye.hp, p2.active[0].hp
```

**Not one `.ability`, `.pp` or `.vol` leaf in any of them.** Each of the five new rules is CAUGHT by
its own red demonstration, and none is WEAK — every flip is off a member that was
FIRED-AND-BOARDS-MATCH against the clean source:

```
CAUGHT  ability/weight-decides-the-power    via heavymetal   -> DID-NOT-FIRE on hp
CAUGHT  ability/ally-gated-stat             via minus        -> DID-NOT-FIRE on hp
CAUGHT  ability/conditional-speed           via surgesurfer  -> DID-NOT-FIRE on party.hp, hp
CAUGHT  ability/ignores-screens             via infiltrator  -> DID-NOT-FIRE on party.hp, hp
CAUGHT  ability/removes-its-own-move-flag   via longreach    -> DID-NOT-FIRE on party.hp, hp
```

## TWO INSTRUMENT DEFECTS THE FIXTURES FOUND, BOTH FIXED, BOTH WITH THE BLAST RADIUS MEASURED FIRST

### ROADMAP #611 — a guard that tested how a handler is SPELLED

`speedFlipFoe` and `speedOrderFoe` refuse a foe whose own ability lifts its click out of the Speed
bracket. The predicate was `/Status/.test(String(ab.onModifyPriority))` — a test of the handler's
WORDING. Prankster gates on `move.category === "Status"` and matched it; **Gale Wings gates on
`move.type === "Flying"` and did not.** So Talonflame passed the guard, the helper handed it FEATHER
DANCE (Flying, Status), and its +1 landed before the carrier under either Speed:

```
[SPEED PLAN] surgesurfer  carrier Raichu-Alola  162 -> 324 against 178
             foe Talonflame (Gale Wings)  holder clicks Body Slam  foe clicks Feather Dance
```

The row staged, its precondition proved Electric Terrain was on the authority's field, and Showdown's
own board came back identical over **2,184 compared leaves** — because a priority bracket is read
before Speed is.

**Fixed:** `priorityLifts(sp, mv)` CALLS the handler with the move the foe will actually click and a
full-HP body; a non-zero answer refuses the pairing, and the check moved from the top of the loop to
after the drop is chosen, so a Gale Wings body throwing a NON-Flying drop is correctly admitted. A
handler that throws is counted in `PRIORITY_PROBE_THREW` and refuses the body.

**Printed before it was wired.** Exactly three legal abilities in this format register
`onModifyPriority`: `prankster` (six carriers; lifts every Status move, so every body it refused is
still refused), `galewings` (one carrier, Talonflame — the whole change) and `triage` (ZERO legal
carriers). **Blast radius measured, not argued: no row in any of the three roster artifacts at HEAD
names Talonflame in its note.** The post-change run confirms it — items and moves unmoved.

### ROADMAP #612 — a non-ALTERNATE carrier got no control at all

With the priority guard fixed the foe became Meowscarada, the window was 162 → 324 against 175, and
the row was **still inert**. Dumping both arms settled in four lines what an argument had not:

```
[DUMP SUBJ] t2  p1[0]=meowscarada hp559 ... | p2[0]=raichualola hp135 ab=surgesurfer | terrain=electric
[DUMP CTRL] t2  p1[0]=meowscarada hp559 ... | p2[0]=raichualola hp135 ab=surgesurfer | terrain=electric
```

Identical in every field, with the ability under test still on the carrier IN THE CONTROL ARM.
`stageAbilityQuiet`'s guard read `C.tier === 'ALTERNATE' && ...` and sent every other tier to
`stageAbility`, which writes `sc.controlAbility = C.control` — **NULL for a SUPPRESS body, whose only
ability is the one under test.** `controlOf`'s sheet branch finds no alternate, falls through to
`body.ability = null`, and `buildPair` silently restores ability slot 0.

**This is the mirror image of ROADMAP #609 and it is the harder of the two to see.** There a dead
correction manufactured GREENS; here a dead control manufactures an INERT row, which accuses nobody
and reads as an honest coverage limit. `gastroWorks()` and `swapControlWorks()` exist because "a
control that does not work does not fail loudly" — and neither of them covers this door.

**Fixed:** a non-ALTERNATE carrier routes to `stageAbilitySwap` (the in-play Skill Swap, with the same
`hpB` clamp `stageAbilityAnyTier` applies to a MEGA body), and where the rule cannot take that control
the row is REFUSED OUT LOUD with the reason rather than handed a dead arm.

**Blast radius measured before the change:** every pre-existing caller of `stageAbilityQuiet` supplies
a carrier from `abilityCarrier`, which returns ALTERNATE and nothing else, or builds one with
`tier: 'ALTERNATE'` literally. No standing row could reach the branch.

**OWED, and named so it is not re-discovered:** the same shape is reachable by any FUTURE rule that
calls `stageAbility` directly with a non-ALTERNATE carrier. The durable repair is for `stageAbility`
itself to refuse a null control ability instead of letting `buildPair` restore slot 0.

### A third, smaller one, recorded rather than quietly corrected

The terrain precondition first compared the handler's `electricterrain` against the board's value and
read `THE PRECONDITION DID NOT LAND` on a fixture whose terrain was up. `board_state.js` writes
`xl('terrain', ...)`, so the board carries the engine's SHORT name (`electric`). Matched by prefix
now, which is this repository's established seam for exactly this pair, with an empty board value
refused first because `''` is a prefix of everything.

## `quickfeet` — a refusal that carries its measurement

It leaves the inert list without becoming a green, and every clause is derived on the run:

> its Speed multiplier is gated on the holder being STATUSED and this regulation cannot open that gate
> on its carrier without putting a SECOND Speed modifier on the same body. Measured on this run —
> carrier Jolteon (Electric); the in-scope 100-accuracy single-target status clicks are Toxic Thread
> (psn) REFUSED — it carries boosts {"spe":-2}, a SECOND Speed modifier inside a fixture whose whole
> reading is Speed; Glare (par) REFUSED — the dex says Jolteon (Electric) is immune to it; legal items
> that status their own holder at the residual: ZERO, scanned across the whole format; and the sleep
> road (`sleepClick`) puts the carrier ASLEEP, so it cannot throw the click the order is read off.

## What is still unstaged, and the measured reason

**Items: none. Moves: 7 COULD-NOT-STAGE, unchanged and re-read** — `focusenergy` IS the control click,
`struggle` is disabled while any move is usable, `extremespeed`/`iceshard`/`jetpunch` keep the MEASURED
`wideAbility` refutation, `upperhand` reads a target's priority intent, `ragingbull` is forme-keyed
with no flip ability.

**Abilities — 2 CONTROL-NOT-QUIET, unchanged:** `magmaarmor` and `opportunist`. Both were left alone
deliberately, for the third pass running: #608's fix is a change to the quiet set, and making it in
the same pass as a seven-row move would leave neither attributable. `magmaarmor` additionally cannot
be closed by a better carrier — its only legal body is Camerupt and both alternates are live on the
corner its rule needs.

**Abilities — 39 COULD-NOT-STAGE:**

- **33 read `THE STAGING IS INERT`**, grouped by the family a rule would have to stage:

| family | rows | the anchor a rule would derive |
|---|---|---|
| reacts to being hit / KO'd | `aftermath`, `angerpoint`, `berserk`, `justified`, `moxie`, `steadfast` | `onDamagingHit` / `onHit` / `onDamage` / `onFlinch` / `onSourceAfterFaint`; the boost or chip is a compared leaf, but the TRIGGER (a crit, a faint, a flinch, crossing half HP) is what the generic fixture never creates |
| base power under a condition | `analytic`, `rivalry`, `sandforce`, `supremeoverlord` | `onBasePower` whose handler names `willMove`, a gender, a weather + type list, or `side.totalFainted` |
| item motion | `cheekpouch`, `cudchew`, `klutz`, `magician`, `pickpocket`, `stickyhold`, `symbiosis` | `onEatItem` / `onTakeItem` / `onAfterMoveSecondary(Self)` / `onAllyAfterUseItem`; `item` IS a compared leaf, so these want a fixture in which an item actually moves |
| status, refused or reflected | `corrosion`, `earlybird`, `hydration`, `leafguard`, `synchronize` | a status must be inflicted first; `corrosion` and `earlybird` act through a FIELD the authority reads rather than through a handler (`MOVE_FIELD_ACTORS` names both) |
| damage read under a condition | `merciless`, `sniper`, `unaware` | a crit must land (`critsLand()` says it does on `bottom-tie-first` only) or a stat stage must exist for `unaware` to ignore |
| move rewriting | `skilllink`, `stalwart` | `onModifyMove` touching `multihit` (a die the pin fixes) and `tracksTarget` (needs a redirector on the field) |
| field / entry effects | `cloudnine`, `damp`, `frisk`, `goodasgold`, `receiver`, `screencleaner` | weather suppression, a self-destruct refusal, a message, a status-move refusal, an ally faint, a screen removal |

  `frisk` is the one in that list whose whole effect is a MESSAGE, and it should be expected to stay
  refused for the same reason Anticipation and Forewarn are shelved.
- **`aerilate`, `galewings`, `ripen`, `simple`, `zerotohero`** — unchanged, with the reasons the
  previous two passes measured.
- **`quickfeet`** — above.

## The gate, run at the end of this pass

```
  GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld
    PASS  deliberate roster / items      clean: 148 of 148 tested
    PASS  deliberate roster / abilities  clean: 154 of 200 tested. 2 row(s) count in NEITHER column — the control arm is itself a live ability: magmaarmor, opportunist
    PASS  deliberate roster / moves      clean: 487 of 497 tested
```

`engine/quarantine.js` exit 0, all nine clauses PASS. Board-material **0 of 961** with 10,705 of
10,705 turn boundaries identical, narration **zero undeclared across 961**.

## Releases cut

**None.** No engine byte changed. Files touched: `tests/roster.js`, the three roster artifacts (plus
`data/roster.json`, the convenience copy, and the three `.prev.json` files), `docs/ENGINE.md`,
`docs/ROADMAP.md`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md` and this report.

`engine/status.js --write` was **NOT** run: it restamps the generated blocks of all five division
ledgers, four of which are already modified in this working tree by other work, and this pass was
scoped to the four documents above. Nothing inside a `<!-- GENERATED -->` block was hand-edited.

`data/mechanics-census.json` was re-derived from scratch during this pass (`engine/register_reality.js`
runs `tests/test-mechanics.js` as one of its instruments) and the counts are **UNMOVED at 883 probed /
883 live / 0 missing**. Its only content diff is a sampling-noise detail string on a flinch-rate row.

**`data/register-reality.json` was refreshed after the ROADMAP edit and the gate's `STALE VERDICTS`
note is GONE** — 0 occurrences in the final run, against a run earlier in the pass that carried it.
`register_reality.js` itself exits 1 on its own bar (9 rows disagreeing with their instrument, 10
rejected markers, 8 instruments answering nothing); that bar was red before this pass, it is not the
MEDICHAM gate, and **none of the three rows added here appears in any of its three problem lists.**

Unrelated and NOT from this pass: `docs/MEASURE.md`, `docs/OPS.md`, `docs/SEARCH.md`, `docs/WEB.md`
and the four living documents the HELD 7.0.0 release owns are modified in this working tree by other
work. `changed.txt` is untracked and is not mine — reported, left in place.
