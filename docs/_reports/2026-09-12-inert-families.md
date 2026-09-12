# Three inert families get fixtures, and the fixtures find a third instrument defect — ENGINE, 2026-09-12

Release `534442d71183`, census `data/mechanics-census.json` (**883 probed / 883 live / 0 missing**,
unmoved — re-derived at the end of the pass), team store `data/team-pool-frozen`. **No engine byte was
modified and no release was cut.** The only code file changed is `tests/roster.js`, which is not one
of the frozen `SOURCES`. `engine/board.js`, `engine/magnemite.js` and `data/engine-data.js` were
**not** touched.

## Counts, before → after

| stage | before (artifacts at git HEAD) | after | artifact |
|---|---|---|---|
| **items** | 148 MATCH / 0 CNS / 0 CNQ / 0 DEF | **148 / 0 / 0 / 0 — UNMOVED** | `data/roster.items.json` |
| **abilities** | 154 MATCH / 39 CNS / 2 CNQ / 5 DEF | **164 MATCH / 29 CNS / 2 CNQ / 5 DEF** | `data/roster.abilities.json` |
| **moves** | 487 MATCH / 7 CNS / 0 CNQ / 3 DEF | **487 / 7 / 0 / 3 — UNMOVED** | `data/roster.moves.json` |

All three stages: **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE, 0 rows threw.** Plant anchors
**22 / 56 / 36 apply exactly once, none dead**; red demonstrations **22 / 56 / 36 with 0 `ok: false`
and 0 WEAK**. Items and moves are the **controls** and neither moved a single row.

Of the 33 rows that read `THE STAGING IS INERT` at the start of this pass, **twelve leave that list**:
ten close green (`aftermath`, `berserk`, `justified`, `moxie`, `steadfast`, `unaware`, `merciless`,
`analytic`, `rivalry`, `sandforce`) and two become measured refusals (`angerpoint`, `sniper`).
`innardsout` was already green and keeps its green on a stronger fixture. **21 remain.**

## THE #612 QUESTION WAS ASKED BEFORE ANYTHING WAS BUILT

The brief is explicit that an `INERT` row is suspect evidence, because a non-ALTERNATE carrier handed
to `stageAbility` gets a null control ability and `buildPair` restores slot 0 — the control arm becomes
the subject arm, and the row parks a mechanic as unstageable while accusing nobody.

So it was measured rather than assumed, off the note every row carries in `data/roster.abilities.json`:

```
26 of 33   control = Skill Swap lends Shell Armor off Goodra-Hisui
 7 of 33   control = a NAMED live sheet ability, flagged NOT A QUIET ABILITY in the note —
                     cloudnine/Natural Cure, cudchew/Armor Tail, frisk/Pickup, hydration/Gooey,
                     klutz/Healer, screencleaner/Tangled Feet, supremeoverlord/Defiant
 0 of 33   no control at all
```

Read off `git show HEAD:data/roster.abilities.json` — the artifact as it stood before this pass, not
the one this pass rewrote. **Not one of the 33 is a #612.** They are inert about the FIXTURE, which is
what the rest of this report is.

## The four rules, and what each one derives

Nothing below is a typed Pokémon fact. Every part of every fixture is read off the format on the run.

### `ability/reacts-to-an-event-a-plain-hit-never-creates` — 6 rows

The generic staging throws one neutral contact hit each way and stands through three residual phases.
It creates no crit, no flinch, no faint, no half-HP crossing and no Dark click, so six handlers are
armed and none is ever asked.

**The trigger is derived from the handler and the membership was PRINTED OVER THE WHOLE DEX before a
line was wired** (`ROSTER_PRINT_REACT_TRIGGERS=1`):

```
REACT TRIGGERS: 18 in the dex — angershell {threshold 0.5}; berserk {threshold 0.5}; eelevate {ko};
aftermath {ownfaint,contact}; angerpoint {crit}; asoneglastrier {ko}; asonespectrier {ko};
battlebond {ko}; beastboost {ko}; chillingneigh {ko}; colorchange {ownfaint}; grimneigh {ko};
innardsout {ownfaint}; justified {movetype Dark}; moxie {ko}; steadfast {flinch};
thermalexchange {movetype Fire}; watercompaction {movetype Water}
```

Eight of the eighteen are in scope; `eelevate` is owned by `ability/ground-immunity`, which sits above
this rule and keeps it. What is left is exactly the six inert rows plus `innardsout`. **No over-match.**

**THE ORDER OF THE TESTS IS THE SPECIFICATION AND IT IS NOT ALPHABETICAL.** Anger Point and Berserk
BOTH test `!target.hp` as a GUARD rather than as their trigger, so `crit` and `threshold` are asked
above `ownfaint`. A rule that read the guard would stage a faint for two abilities that need the
holder alive.

Two things the fixtures had to learn from the format:

- **A KO IN TWO CLICKS IS STILL A KO.** `lethalMove` asks for a one-shot with margin, and this
  format's bulk refuses one: measured, the largest CONTACT click any legal body lands on Garbodor is
  **Iron Head off Metagross at 99 of its 155 hp**, and the largest click Pinsir legally lands on
  Torterra is **X-Scissor at 152 of 170**. `killPlan` allows two identical clicks, caps at two because
  the script is three turns, and requires the FIRST hit not to kill so a mis-estimate cannot quietly
  move the trigger to the wrong turn.
- **CONTACT IS ASKED FOR ONLY WHERE THE HANDLER ASKS FOR IT.** Aftermath calls
  `checkMoveMakesContact`; Innards Out does not. Narrowing both to a contact click refused Innards Out
  outright — no legal body lands a lethal contact click on Victreebel-Mega — and would have cost a
  standing green.
- **A FLINCH WRITES NO COMPARED LEAF**, so the receipt is SHOWDOWN'S OWN spent-PP meter: the carrier
  idles every turn, so its spent count rises at every boundary except the one it was flinched on. The
  clause demands **exactly one flat step and at least one rise**, so a meter that never moves cannot
  pass it. And the thrower ARRIVES FROM THE BENCH, because the one 100% flincher this format has
  refuses on `source.activeMoveActions > 1` (the counter is incremented before the move is used, so
  the FIRST use reads 1 and passes — `sim/pokemon.ts:250`, `sim/battle-actions.ts:217`) and the swap
  control prepends a setup turn on which every body idles.

### `ability/ignores-stat-stages` — 1 row

The stage has to exist before it can be ignored and the generic staging raises none. The keys come off
the handler (`boosts["atk"] = 0`), and **the setter is chosen off `move.boosts` for moving ONE stat**:
Swords Dance `{atk: 2}` qualifies, and a Dragon Dance or a Shell Smash would put turn order inside a
fixture whose whole reading is a damage number. The authority is asked whether the stage went up.

### `ability/prices-a-critical-hit` — 1 row closed, 1 measured refusal

**A GUARANTEED CRIT ESCAPES THE ARM'S PIN AND A ROLLED ONE DOES NOT**, and that is the authority's own
arithmetic rather than a constant typed here. `top-tie-first`'s own description is "no crit", but gen
9 clamps the crit ratio to 0..4 and `critMult` is `[0, 24, 8, 2, 1]`, so a returned literal of 4 or
more is rolled as `randomChance(1, 1)` — TRUE under either corner's scalar
(`sim/battle-actions.ts:1629-1642`). Merciless returns 5, so its crit is certain WITH the ability and
impossible without it, on the primary arm, with no arm override.

The gate is the TARGET'S STATUS, read out of the handler's own `["psn", "tox"]`, and it is created by
a derived 100-accuracy click from the carrier's PARTNER — side B slot 1, so the swap control keeps the
side A slot it needs. **The defender is chosen for not refusing the crit**, asked of the ability it
will actually hold: four of this format's quiet bodies carry Shell Armor and one carries Battle Armor,
and a crit-armoured target would make the row inert for a reason about the target.

### `ability/base-power-under-a-board-condition` — 3 rows

`ability/base-power-scoped` stages every member whose gate is a property of the CLICK. These three are
gated on the BOARD, which is why they fell to the generic staging and read INERT.

- **`analytic`** — `this.queue.willMove(target)` for every OTHER active, so the carrier has to move
  LAST. Bought with a derived Speed-ONLY drop (Scary Face is the format's single one: 100 accuracy,
  single target, `boosts {spe:-2}`, no status and no volatile). The rule asserts the arithmetic before
  it stages: Starmie's Speed goes **167 → 83**, below Torterra (112), Venusaur (132) **and the swapper
  Goodra-Hisui (112)** — which the control builder puts in side A slot 1 and the rule cannot choose.
- **`rivalry`** — `attacker.gender && defender.gender`, and `buildPair` writes `gender: 'N'` on every
  body unless a scenario declares one. medicham2's own source already says this is why the row read
  INERT (*"the ability was correctly doing nothing, which ROADMAP #205 mistook for it being
  untestable"*). The carrier is declared MALE and hits a MALE body on turn 1 (the same-gender branch);
  a FEMALE body then comes in off the bench and takes the same click on turn 3 (the opposite-gender
  branch), so **both halves of the handler's `else` are on one board**. All three species are ones the
  dex leaves free to be either gender — declaring one on a fixed-gender body would assert a Pokémon
  this format does not have, the same clause Cute Charm's rule already applies. **Gender is not a leaf
  `board_state.js` compares**, so the receipt available is that the second body really took the slot;
  a gender that failed to land would leave both multipliers at 1 and the row would read INERT, so the
  direction of that failure is safe.
- **`sandforce`** — a weather AND a type list. The sky comes from a partner's ENTRY ability
  (`setterFor('sandstorm')` → Sand Stream on Tyranitar), present identically in both arms, and the
  carrier throws one click of a named type and one of an unnamed type as the negative.

## THE LEAVES WERE READ BEFORE THE COUNT WAS BELIEVED

This is the test ROADMAP #609 exists for, applied to every row this pass claims:

```
aftermath     4   p1.party.kangaskhan.hp, p1.active[0].hp
berserk       6   p2.party.drampa.boosts.spa, p2.active[0].boosts.spa
innardsout    6   p1.party.charizard.hp, p1.active[0].hp
justified     6   p2.party.arcanine.boosts.atk, p2.active[0].boosts.atk
moxie         4   p2.party.scrafty.boosts.atk, p2.active[0].boosts.atk
steadfast     4   p2.party.machamp.boosts.spe, p2.active[0].boosts.spe
unaware       4   p2.party.skeledirge.hp, p2.active[0].hp
merciless     4   p1.party.charizard.hp, p1.active[0].hp
analytic      4   p1.party.torterra.hp, p1.active[0].hp
rivalry       6   p1.party.torterra.hp, p1.active[0].hp, p1.party.torkoal.hp
sandforce     6   p1.party.torterra.hp, p1.active[0].hp
```

**Not one `.ability`, `.pp` or `.vol` leaf in any of them.** Rivalry's third path is the FEMALE body,
so both branches of its handler are visibly paid.

Each of the four new rules is CAUGHT by its own red demonstration, and none is WEAK — every flip is
off a member that was FIRED-AND-BOARDS-MATCH against the clean source:

```
CAUGHT  ability/reacts-to-an-event-a-plain-hit-never-creates  via aftermath -> DID-NOT-FIRE on party.hp, hp
CAUGHT  ability/ignores-stat-stages                           via unaware   -> DID-NOT-FIRE on party.hp, hp
CAUGHT  ability/prices-a-critical-hit                         via merciless -> DID-NOT-FIRE on party.hp, hp
CAUGHT  ability/base-power-under-a-board-condition            via analytic  -> DID-NOT-FIRE on party.hp, hp
```

The five patch anchors of the first rule and the three of the last are each verified to apply exactly
once against the RELEASE's bytes, not against the live file: `boostsOnFlinch`, `punishesAttacker`,
`boostsAtHPThreshold`, `boostsOnKO`, the `buffsHolderOnHit` condition read, `ignoresStatStages`,
`critRatioUp`, `critDamageUp`, and the three `damageBoost` / `damageByGender` reads.

## A THIRD INSTRUMENT DEFECT, FOUND IN THE FIXTURES' OWN PRINTED NOTES

**THE SWAPPER OWNS SIDE A SLOT 1 AND THREE OF THESE FOUR RULES PUT ITS SPECIES THERE TWICE.**

`stageAbilitySwap` writes that slot itself and a rule never sees it. `moveBodies` is sorted by BULK and
its first row is **Goodra-Hisui**, which is exactly the body `SWAPPER` derives to — so every rule that
reached for "the bulkiest quiet body" picked the swapper's own species. `board_state.js` keys a party
row BY SPECIES (deliberately: index-matching manufactured a divergence larger than anything real), so
the two bodies collapse into ONE row and it counts a silent `duplicate_species_in_party`.

**The row still returned FIRED-AND-BOARDS-MATCH.** It was caught by reading the note the run printed:

```
Analytic — Goodra-Hisui clicks Scary Face at the carrier ... below Goodra-Hisui (112), Venusaur (132)
           and the swapper Goodra-Hisui (112)
```

`isSwapper()` now refuses that species on side A in every one of these rules. After the fix the same
three rows name Torterra, Torterra/Torkoal and Torterra, and the counts in the table above are the
post-fix ones. **This was not caught by a check and no check would have caught it** — it is filed here
so that whoever adds the next rule knows the slot is taken.

## The two measured refusals

### `angerpoint` — the crit has to land on its OWN HOLDER, and no control stays out of the way

Derived on the run:

> this format holds **8** quiet abilities and only **4** of them has a legal carrier to lend from:
> `battlearmor` (Falinks) REFUSES EVERY CRIT — `onCriticalHit: false`, so the control arm takes no
> crit, the two arms part on DAMAGE and the row measures the control; `corrosion` (Salazzle, Glimmora)
> is LIVE through a field the engine reads directly; `earlybird` (Kangaskhan, Houndoom) is LIVE through
> a field the engine reads directly; `shellarmor` (Torkoal, Torterra, Samurott, Goodra-Hisui) REFUSES
> EVERY CRIT. And the carrier road is shut too: of this ability's **7** legal carriers (Tauros,
> Tauros-Paldea-Combat, Tauros-Paldea-Blaze, Tauros-Paldea-Aqua, Camerupt, Krookodile, Crabominable),
> **0** has a QUIET ability on its own sheet to control with. A `willCrit` click does not help — the
> armour refuses the crit however it was obtained — and a FIXED-DAMAGE click cannot help either,
> because Showdown returns `source.level` from `getDamage` BEFORE it computes `moveHit.crit` at all
> (`sim/battle-actions.ts:1608` against `:1638`), so such a move never sets the flag this handler
> reads.

This is the identical withdrawal `stageAbilityQuiet` already records for `magmaarmor`, arriving from
the other direction.

### `sniper` — it only PRICES a crit somebody else obtained, and all three roads are shut

> the ALWAYS-CRIT road: this format holds **2** always-hitting single-target `willCrit` moves — Storm
> Throw, learned here by Machamp, Pinsir, Emboar, Pangoro, Annihilape; Flower Trick, learned here by
> Meowscarada — so **no carrier of this ability can throw one**. The ROLLED road: an ordinary crit
> lands only on `bottom-tie-first` (the primary arm's own pin is "no crit"), and on that arm the only
> quiet ability this format can lend as a control is a CRIT ARMOUR — `stageAbilityQuiet` withdraws the
> swap delegation there for exactly that reason, measured on magmaarmor — while this ability's
> carriers (Beedrill, Ariados, Barbaracle) have no quiet ability on their own sheets. And the FOCUS
> ENERGY road is shut by this file's own `critRatioAudit`: the control click adds 2 crit stages, so a
> high-ratio click beside it reaches the guaranteed tier in BOTH arms and the audit refuses the whole
> fixture.

## A support fix, with its blast radius measured first

**`stageAbilitySwap` now carries a declared gender.** `stageAbilityQuiet` refused the swap delegation
to any rule that declared one, on the ground that this builder did not carry it. That was true and it
was a two-word gap rather than a property of anything: `play()` already turns `declaredGender` on for
a scenario in which any body carries an M or an F, and medicham2 has written the same `|switch|`
suffix since 2026-09-11. **Blast radius measured before the change: exactly one standing rule passes
`gender` (`ability/contact-plants-a-volatile-on-the-attacker-by-chance`, Cute Charm) and it calls
`stageAbility` DIRECTLY**, so no existing row could reach that line with a gender on it. Confirmed by
the run: items and moves unmoved, and no ability row other than the eleven changed verdict.

## What is still unstaged, and the measured reason

**Items: none. Moves: 7 COULD-NOT-STAGE, unchanged and re-read** — `focusenergy` IS the control click,
`struggle` is disabled while any move is usable, `extremespeed`/`iceshard`/`jetpunch` keep the MEASURED
`wideAbility` refutation, `upperhand` reads a target's priority intent, `ragingbull` is forme-keyed
with no flip ability.

**Abilities — 2 CONTROL-NOT-QUIET, unchanged:** `magmaarmor` and `opportunist`. Left alone for the
fourth pass running: #608's fix is a change to the quiet set, and making it in the same pass as a
ten-row move would leave neither attributable. `magmaarmor` additionally cannot be closed by a better
carrier — its only legal body is Camerupt and both alternates are live on the corner its rule needs.

**Abilities — 29 COULD-NOT-STAGE:**

- **21 read `THE STAGING IS INERT`**, in four families this pass did not take plus one row of its own:

| family | rows | the anchor a rule would derive |
|---|---|---|
| item motion | `cheekpouch`, `cudchew`, `klutz`, `magician`, `pickpocket`, `stickyhold`, `symbiosis` | `onEatItem` / `onTakeItem` / `onAfterMoveSecondary(Self)` / `onAllyAfterUseItem`; `item` IS a compared leaf, so these want a fixture in which an item actually moves |
| status, refused or reflected | `corrosion`, `earlybird`, `hydration`, `leafguard`, `synchronize` | a status must be inflicted first; `corrosion` and `earlybird` act through a FIELD the authority reads rather than through a handler (`MOVE_FIELD_ACTORS` names both) |
| move rewriting | `skilllink`, `stalwart` | `onModifyMove` touching `multihit` (a die the pin fixes) and `tracksTarget` (needs a redirector on the field) |
| field / entry effects | `cloudnine`, `damp`, `frisk`, `goodasgold`, `receiver`, `screencleaner` | weather suppression, a self-destruct refusal, a message, a status-move refusal, an ally faint, a screen removal |
| — | `supremeoverlord` | `onStart` counting `side.totalFainted`; see below |

  `frisk` is the one in that list whose whole effect is a MESSAGE, and it should be expected to stay
  refused for the same reason Anticipation and Forewarn are shelved.

- **`supremeoverlord` was left rather than given a weak refusal.** It is owned by `ability/entry` and
  never reaches the new rule. Its counter is taken at switch-in (`countedAt: "switch-in"`), so the
  carrier has to ARRIVE after an ally has fainted, and `stageAbilityQuiet` cannot take the swap
  control for a bench start. A switch-out-and-back script would express it and is a fixture worth
  building; writing a refusal about the builder instead would be a claim about the instrument dressed
  up as a claim about the format.
- **`angerpoint`, `sniper`** — above. **`quickfeet`** — unchanged, from the previous pass.
- **`aerilate`, `galewings`, `ripen`, `simple`, `zerotohero`** — unchanged, with the reasons the
  previous three passes measured. `aerilate` was NOT attempted here: the brief allowed it only if it
  did not disturb attribution, and its rule (`ability/type-conversion`) is a different rule whose
  refusal is about the DEFENDER, so touching it in the same pass as a ten-row move would have made
  neither attributable. `magmaarmor`/`opportunist` were left for the same reason, stated by the brief.

## The gate, run at the end of this pass

```
  GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld
    PASS  deliberate roster / items      clean: 148 of 148 tested
    PASS  deliberate roster / abilities  clean: 164 of 200 tested. 2 row(s) count in NEITHER column — the control arm is itself a live ability: magmaarmor, opportunist
    PASS  deliberate roster / moves      clean: 487 of 497 tested
```

`engine/quarantine.js` exit 0, all nine clauses PASS. Board-material **0 of 961** with 10,705 of
10,705 turn boundaries identical, narration **zero undeclared across 961**, game differential **0 of
6000** at the midpoint, both corners and all fourteen interior indices.

`data/mechanics-census.json` was re-derived from scratch after the roster runs (`node
tests/test-mechanics.js`, exit 0) and reads **883 probed / 883 live / 0 missing / 883 armed / 0
unarmed** — unmoved.

## Releases cut

**None.** No engine byte changed. Files touched: `tests/roster.js`, the three roster artifacts (plus
`data/roster.json`, the convenience copy, and the `.prev.json` files), `data/mechanics-census.json`,
`docs/ENGINE.md`, `docs/ROADMAP.md`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md`, one figure in
`docs/ABRA-whitepaper.md` and this report.

**THE RETRACTION WAS MADE, NOT DEFERRED.** `docs/ABRA-whitepaper.md:1713` read `data/roster.abilities.json`
**154 tested** and now reads **164**. `tests/test-docs-current.js` clause 3b(b) went RED on the stale
figure (`NEW: docs/ABRA-whitepaper.md:1713 154 not in data/roster.abilities.json`) and GREEN on the
correction: **36 of 37 clauses pass**. The one that does not is 3b(d), and every NEW entry in it is in
`docs/ABRA-technical-docs.md` — a document this pass did not touch and was instructed not to touch,
already modified in this working tree by the HELD 7.0.0 release. Flagged rather than filed, because
the pre-commit hook runs this gate.

`engine/status.js --write` was **NOT** run: it restamps the generated blocks of all five division
ledgers, four of which are already modified in this working tree by other work, and this pass was
scoped to the four documents above. Nothing inside a `<!-- GENERATED -->` block was hand-edited.

Unrelated and NOT from this pass: `docs/ABRA-deck-plain-english.md`, `docs/ABRA-technical-docs.md`,
`docs/MODELS.md`, `docs/SUMMARY.md` and their PDFs are modified in this working tree by the HELD 7.0.0
release, and `docs/MEASURE.md`, `docs/OPS.md`, `docs/SEARCH.md`, `docs/WEB.md` by other work. None was
touched here. `engine/quarantine.js` prints a `STALE VERDICTS` note because `data/register-reality.json`
predates this pass's ROADMAP edit; it is not a gate clause and it clears on
`node engine/register_reality.js`.
