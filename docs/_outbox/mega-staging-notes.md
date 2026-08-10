# ROADMAP #138 — mega-tier abilities, and the Floette pointer

ENGINE, 2026-08-10. Everything below is measured against the **pinned release `07ffb4e75207`**
(`tests/roster.js --stage abilities --release 07ffb4e75207`), because another agent was editing
`engine/medicham2-browser.js` in the live tree while this ran. `engine/status.js` and
`engine/quarantine.js` read the live tree and are NOT quoted here.

---

## JOB 1 — staging a mega-tier ability

### The investigation the task asked for: can the mega forme stand on the board as itself?

`tests/probe_mega_direct.js` (new) asks the authority rather than reasoning about it. Both halves are
printed per forme, over all fourteen.

| question | answer |
|---|---|
| does the battle stream keep the forme on the field? | **YES, 14 of 14.** Gengar-Mega, Pinsir-Mega, Floette-Mega… all stay in the slot |
| does the format's own `TeamValidator` accept the set? | **NO.** Without the stone: *"Gengar-Mega transforms in-battle with Gengarite, please fix its item"* and *"Gengar-Mega can't have Shadow Tag"*. With the stone: accepted, and the validator **rewrites `set.species` to `Gengar`** (team-validator.js:1387, `set.species = species.battleOnly`) — it blesses the BASE body, not the one we would play |

So direct staging reaches a position the battle allows by a route the validator refuses. It was not
used. **The subject arm was never the problem anyway** — base + stone + a mega ask is validator-clean
and always was. The blocker was, and only was, the CONTROL.

### What actually opened the tier

`carrierFor` puts these fourteen in the MEGA tier, whose only control was **Gastro Acid**, which
`gastroWorks()` measures at **6 board leaves in Showdown and 0 here**. A control that does nothing
returns an arm identical to the subject arm, so every row in the tier would have read DID-NOT-FIRE for
the control's failure. The roster refused, correctly, and printed that as the reason.

`noQuietControlWhy()` states the limitation in its own words — *"A quiet ability CANNOT be lent from
another species: buildPair clamps an ability to its species' own list"*. **That is true of the sheet
and false of the battle. Skill Swap lends one, in play.** Side A slot 1 is a body whose own ability is
quiet; in the control arm it clicks Skill Swap at the carrier on the setup turn (the mega resolves at
queue order 104, a move at 200, so the exchange lands on the forme the change has already produced),
and in the subject arm it idles. Everything else is identical by construction.

Proven before use, on the same fixture and by the same method as the Gastro Acid proof —
`swapControlWorks()` re-stages **Rough Skin** (which scores FIRED-AND-BOARDS-MATCH under an ordinary
swapped-ability control, so both engines demonstrably have it) with a Skill Swap control:

```
usable: 6 leaves in Showdown and 6 here, lending Shell Armor off Goodra-Hisui
```

The swapper is DERIVED from the quiet set, not named, and printed on every finding.

### Shown RED before it was trusted green

`--no-swap-control` restores the pre-change state exactly. Full abilities stage, same release:

| | TESTED | FIRED-AND-BOARDS-DIFFER | COULD-NOT-STAGE | exit |
|---|---|---|---|---|
| `--no-swap-control` (before) | 86 | 0 | 214 | 0 |
| swap control on (after) | **89** | **1** | 211 | **1** |

A knob that changes nothing means it is unwired. This one changes three rows and one verdict.

### Per ability — all fourteen

| ability | forme | verdict | why |
|---|---|---|---|
| **Parental Bond** | Kangaskhan-Mega | **FIRED-AND-BOARDS-DIFFER** | board diff below |
| **Fire Mane** | Pyroar-Mega | FIRED-AND-BOARDS-MATCH | staged, both engines agree leaf for leaf |
| **Spicy Spray** | Scovillain-Mega | FIRED-AND-BOARDS-MATCH | staged, both engines agree leaf for leaf |
| Eelevate | Eelektross-Mega | COULD-NOT-STAGE | staged and played; **Showdown's own board is identical with and without it** over 655 compared leaves. The generic script does not reach the mechanic — an honest coverage limit, not a pass |
| Innards Out | Victreebel-Mega | COULD-NOT-STAGE | same — inert staging |
| Mega Sol | Meganium-Mega | COULD-NOT-STAGE | same — inert staging |
| Piercing Drill | Excadrill-Mega | COULD-NOT-STAGE | same — inert staging |
| Unseen Fist | Golurk-Mega | COULD-NOT-STAGE | same — inert staging |
| Electric Surge | Raichu-Mega-X | COULD-NOT-STAGE | ENTRY ability. Every control available to this tier is a CLICK, and the forme change writes the ability at queue order 104 while a move resolves at 200 — the effect is on the board in BOTH arms before any control can touch it. Reason text updated; it used to name Gastro Acid |
| Fairy Aura | Floette-Mega | COULD-NOT-STAGE | same as Electric Surge. Also field-wide, so Skill Swap moving it to an idle body leaves it on the field |
| Aerilate | Pinsir-Mega | COULD-NOT-STAGE | claimed by a SPECIALISED rule that builds through `stageAbility`, which can only put an ALTERNATE-tier body on the field |
| Dragonize | Feraligatr-Mega | COULD-NOT-STAGE | same |
| Filter | Aggron-Mega | COULD-NOT-STAGE | same |
| Shadow Tag | Gengar-Mega | COULD-NOT-STAGE | same. Reason text rewritten: **the control is no longer the obstacle, the FIXTURE is** |

**OWED, and named rather than dressed up as a control failure:** `stageAbility` (the builder every
specialised ability rule goes through) writes the ability onto the sheet and has no mega ask and no
setup turn, so it cannot stage a MEGA-tier carrier. Giving it one would carry Aerilate, Dragonize,
Filter and Shadow Tag's trap. It is a fixture change inside `tests/roster.js` and it needs care: a
type-scoped rule must derive against the **mega forme's** types (Aggron is Steel/Rock, Aggron-Mega is
pure Steel), so handing it the base species would stage the wrong hit.

### The negative control, because "the extra click did it" is the obvious objection

If the Skill Swap click by itself moved the board, EVERY row in the tier would show a delta. Five show
none (Eelevate, Innards Out, Mega Sol, Piercing Drill, Unseen Fist) over 655 compared leaves. The
delta tracks the ability, not the click.

### The finding — Parental Bond, Kangaskhan-Mega

```
Parental Bond   [ability/generic]   MEGA carrier Kangaskhan -> Kangaskhan-Mega via Kangaskhanite
control = Skill Swap lends Shell Armor off Goodra-Hisui
   SHOWDOWN  Dragapult is on 94 of 163 HP
   OURS      Dragapult is on 95 of 163 HP        [off-by-one]
   SHOWDOWN  Dragapult is on 25 of 163 HP
   OURS      Dragapult is on 27 of 163 HP        [off-by-2-or-3]
```

Per neutral contact hit: Showdown 69, ours 68. `hitsTwice {hits: 2, secondHitMult: 0.25}` IS consumed
(`medicham2-browser.js:4313`), so this is not a missing second hit — it is the two-hit damage being
rounded or ordered differently from Showdown's per-hit computation. **Belongs to whoever owns
`medicham2-browser.js`; this division did not touch that file.**

**The abilities stage now exits 1.** That is correct and is stated rather than filed: a real
FIRED-AND-BOARDS-DIFFER was found. It keeps the MEDICHAM quarantine shut, which it should — the defect
was always there and was invisible because the row could not be staged.

---

## JOB 2 — the Floette pointer

### Measured first

`engine/artifact_audit.js` gained **check E**, and it was RED on exactly the reported defect before
anything was changed:

```
E. TWO ROWS, ONE BODY — artifact keys the FORMAT resolves to the same species
  GAP  1 species is/are carried by MORE THAN ONE artifact row
       Floette-Mega  <- floette-eternal-mega [mv=0 ab=null]  ||  floette-mega [mv=0 ab=Fairy Aura]
  GAP  2 forme row(s) did not inherit from the source the format names
       floette-mega: mv is EMPTY while its source floette-eternal carries 4 move(s)
```

Check C could not see it: it groups by `norm()`, and `floettemega` and `floetteeternalmega` are
different strings. **The authority on whether two names are one body is the dex, not a regexp** —
check E asks `Dex.forFormat(champions).species.get(key).id`. Membership was printed before it was
wired: exactly one collision group in 318 rows, no over-match.

### The cause, from the format rather than from the symptom

`Floette-Mega.changesFrom = "Floette-Eternal"` and `Floette-Mega.baseSpecies = "Floette"`, and **plain
Floette is illegal in this format**. `merge_mega_into_engine.js` inherited a mega's moves through
`base_species`, which lands on a body with no row — hence `mv: []`.

Three formes in this format have `changesFrom !== baseSpecies`, so it is a class:

- Floette-Mega (changesFrom Floette-Eternal, baseSpecies Floette) — **was broken**
- Meowstic-F-Mega (changesFrom Meowstic-F, baseSpecies Meowstic) — pointer was wrong, moves happened
  to be populated already, now fixed
- the three Ogerpon Teras — not mega rows, unaffected

### The fix

`engine/merge_mega_into_engine.js`:

- resolves a forme's source through the dex's `changesFrom`, falling back to `base_species`, and
  **refuses to run without the dex** rather than silently using `base_species` — that silent default
  is what emptied the row;
- reconciles two artifact keys that the format resolves to one species: non-empty fields folded into
  the survivor (chosen by the dex's own id spelling), the loser removed, both printed;
- counts and prints all three recoveries including a zero.

**The reconciliation lives in the merge script and not in the artifact on purpose.** The duplicate
originates in `CHOMP/engine/champ-model.js`, which `build/build_engine_data.js` copies wholesale — a
hand-edit to `data/engine-data.js` would last until the next regeneration. The merge runs after the
builder, so the repair is re-applied every pipeline run.

### Result

```
merge_mega_into_engine - dex 318 -> 317 species
  source pointer taken from changesFrom rather than baseSpecies: 2
     floette-mega: source is Floette-Eternal (changesFrom), NOT Floette (baseSpecies)
     meowstic-f-mega: source is Meowstic-F (changesFrom), NOT Meowstic (baseSpecies)
  forme rows whose source has NO ROW here, so nothing could be inherited: 4
     salamence-mega, latias-mega, latios-mega, diancie-mega
  duplicate bodies reconciled: 1
     Floette-Mega: kept floette-mega, folded in and removed floette-eternal-mega
```

Diffed field by field against the pre-change artifact: **exactly two rows changed and one was
removed.** Nothing else moved.

```
floette-mega     mv: [] -> ["protect","dazzlinggleam","lightofruin","moonblast"]
                 base: "floette" -> "floetteeternal"
meowstic-f-mega  base: "meowstic" -> "meowsticf"
removed          floette-eternal-mega
```

`artifact_audit.js` is now green: `no gaps found`. And through the live engine:

```
floette-mega   {"ab":"fairyaura","mv":["protect","dazzlinggleam","lightofruin","moonblast"]}
megaRowNoMoves 0 | megaRowNoAbility 0
```

Floette-Mega is in ~10.4% of stored games and, until this pass, `buildMon` handed back a body with no
moves — which every scorer in this project reads as threatening NOTHING.

The four `mv: []` megas that remain — Salamence, Latias, Latios, Diancie — are a fact about the
**regulation**: their source species has no row in this artifact at all. Check E excludes them
explicitly and says so rather than passing them silently.

---

## Not done, and why

- **`stageAbility` cannot stage a MEGA-tier carrier.** Four abilities (Aerilate, Dragonize, Filter,
  Shadow Tag) are held by it. Named in the roster's own COULD-NOT-STAGE text.
- **`node engine/status.js --write` was NOT run.** It reads the live tree, which another agent was
  rewriting; stamping generated blocks off a moving simulator is the thing the release mechanism
  exists to prevent. Owed once that agent lands.
- **`docs/ENGINE.md` hand list not edited** — same reason, and the other agent holds the sprint notes.
- **The census was not regenerated.** `tests/test-mechanics.js` writes `data/mechanics-census.json`,
  which the other agent's work also steers. Not run, to avoid clobbering it.
- **`data/engine-data.js` is a frozen release source.** Changing it changes future release ids;
  release `07ffb4e75207` still carries the old copy, which is why every measurement above was pinned
  to it and why the Floette fix is proven at the ARTIFACT level rather than through that release.

---

# ADDENDUM — Will's fixtures (Shadow Tag, Filter, Electric Surge, Fairy Aura)

Same pin: release `07ffb4e75207`. `engine/medicham2-browser.js` untouched.

## THE ANSWER TO THE QUESTION THAT WAS ASKED TWICE

**Yes, the shape generalises — and it has a sharp, measurable boundary.** `stageAbility` never needed
to survive the forme change. Three fixtures are now landed on this shape, so it is worth stating the
rule rather than the instances:

> **A mega-tier ability can be measured through a CONSEQUENCE THAT IS NOT ON THE CARRIER'S OWN BODY,
> using the un-mega'd game as its control. It cannot be measured through a consequence that IS on the
> carrier, because a forme change moves stats, typing and ability at one instant and a delta on that
> body cannot be charged to any one of the three.**

| consequence lands on | control that works | example |
|---|---|---|
| a REFUSAL (binary) | the pre-mega turn, in the same game | Shadow Tag — no stat can refuse a switch |
| the FIELD | the stone stripped | Electric Surge — no stat can set a terrain |
| ANOTHER BODY | the stone stripped | Fairy Aura — read on the foe's HP when the *partner* attacks |
| the CARRIER'S OWN BODY | **neither** | Eelevate's Ground immunity, Filter's damage taken |

That last row is why Filter is a `dmgRange` probe and not a roster row: `dmgRange` takes a built body,
so the carrier can simply BE the mega forme and no forme change and no team validation is involved.

## SCOREBOARD — the abilities stage, same release, same command

| | TESTED | DIFFER | COULD-NOT-STAGE |
|---|---|---|---|
| before any of this (`--no-swap-control`) | 86 | 0 | 214 |
| + the Skill Swap control | 89 | 1 | 211 |
| **+ Will's three roster fixtures** | **92** | **2** | **208** |

Items stage unchanged throughout: 139 MATCH, 0 DIFFER.

## SHADOW TAG — `ability/trap-arrives-with-a-mega`, and it found a defect

Built exactly as specified. Gengar holds Gengarite; the forme grants Shadow Tag itself; nothing is
written onto any body. Two controls, both measured:

```
IN-GAME   turn 1, pre-mega: Venusaur leaves for Charizard.  showdown=charizard  ours=charizard
ARM       the stone stripped, so no mega happens:           showdown_switched_control=true
                                                            ours_switched_control=true
SUBJECT   turn 2, post-mega:
          Showdown  p1 choice rejected "switch 3, move 1": Can't switch: The active Pokemon is trapped
          ours      the body stayed in its slot
```

**RED FIRST, and it is a strong red.** With the exception arms suppressed (`--no-trap-exceptions`) the
row is FIRED-AND-BOARDS-MATCH on the clean source; planting the break on the trap line flips it to
FIRED-AND-BOARDS-DIFFER. `--reds` reports `CAUGHT`, not `WEAK`. Without that knob the row is already
red for the Shed Shell arm and the instrument correctly refuses to credit the plant.

### The three exceptions, each its own game

| arm | verdict |
|---|---|
| Ghost-type is not trapped | **BOTH-ALLOWED** — Typhlosion-Hisui left in both engines |
| a switching move still works | **BOTH-ALLOWED** — U-turn (derived from `selfSwitch`, not named) left in both |
| **Shed Shell holder is not trapped** | **OURS-REFUSED-AND-THE-AUTHORITY-DID-NOT** |

```
shed-shell-holder-is-not-trapped
  Showdown moved Charizard out (slot now venusaur) and our engine kept it in the slot
```

**THE FINDING: we OVER-REFUSE.** Shed Shell is legal in this format (`isNonstandard` null — asked, not
assumed) and makes its holder untrappable; medicham2 traps it anyway. This is exactly the defect the
main arm alone would have called a clean pass, which is why Will's "except for" clause was the
important half of the design. **Routed to whoever holds `engine/medicham2-browser.js`; not fixed here.**

The third exception Will told me to check for rather than take from him: Shadow-Tag-versus-Shadow-Tag
is in the handler's own source (`!pokemon.hasAbility("shadowtag")`) and is **NOT reachable** here — the
only carrier is a mega forme and a second one needs a second mega evolution, which this format forbids.
Declared with the reason rather than silently omitted.

**One fixture bug caught by printing the rejection string**, worth recording because it wore a
finding's clothes: the Ghost arm first read `AUTHORITY-REFUSED`, which would have said Ghosts are
trappable in Champions. The rejection was `Can't pass: Your Venusaur must make a move` — the turn-1
walk-in was hard-coded to a body that arm did not have, so `{ sw: ... }` resolved to a pass. The
destination is now a parameter.

**And a second one caught the same way:** the entry builder copies a WHITELIST of fields from
`match()`, so `trapExceptions` was dropped and the row returned MATCH with *"NO EXCEPTION ARM RAN"*
underneath — a pass whose own text said it had not ruled out the thing it exists to rule out. The
whitelist comment three lines above says exactly this hazard about `switchProbe`. Fixed.

## FILTER — `tests/probe_mega_damage_abilities.js`, dmgRange, both arms

Built to Will's spec, element-wise across the 16 rolls, roll held constant.

```
Filter on Aggron-Mega  [Steel]   tag says x0.75 only when superEffective
  SUPER-EFFECTIVE, must be reduced   ok   Eruption (Fire, x2)   with=93..109  without=124..146  ratio 0.75
  NEUTRAL, must be UNCHANGED         ok   Water Spout (Water)   with=62..73   without=62..73    ratio 1.00
  reference (Solid Rock on Camerupt, byte-identical tag)              both arms ok
```

**RED FIRST:** `--break` builds the carrier with a quiet ability instead. Both "must be reduced" arms
go RED (ratio 1.00 against an expected 0.75) and both "must be UNCHANGED" arms stay green — the correct
signature, since removing a multiplier cannot change a case it never applied to.

The types are derived from the **MEGA forme** (Aggron-Mega is pure Steel; base Aggron is Steel/Rock).
That trap is real: a move chosen against the base is not the same experiment.

## ELECTRIC SURGE AND FAIRY AURA — the stone control, in the roster

Both were COULD-NOT-STAGE with the reason *"an entry effect has already fired by the time any click
resolves"*. That reason was right about a CLICK-based control and is now beside the point: **the
control is not a click, it is the absence of the stone.**

- **Electric Surge** — `FIRED-AND-BOARDS-MATCH`. Raichu -> Raichu-Mega-X on turn 1; the reading is the
  FIELD. Nothing is clicked at the carrier.
- **Fairy Aura** — `FIRED-AND-BOARDS-MATCH`. Floette-**Eternal** -> Floette-Mega (the JOB 2 pointer fix
  is what makes that body exist with moves at all); the **PARTNER** throws **Moonblast** at the bag on
  turn 2 and a Steel move on turn 3 as the negative. Moonblast is chosen on `target === 'normal'`
  rather than by name — **Dazzling Gleam is a SPREAD Fairy move and carries its own 0.75**, which would
  put two multipliers inside one reading.

Neither row can be vacuous: the instrument only issues a verdict when Showdown's OWN board moved
between the two arms, and prints `THE STAGING IS INERT` otherwise.

`controlOf`'s `stone` kind excludes the carrier's own slot and party row from the comparison, by
prefix, because the forme change rewrites species, types, stats, hp and maxhp together. That exclusion
is what makes the control honest and it is also the limit named in the table at the top.

## NOT BUILT, WITH THE PRECISE BLOCKER

- **Mega Sol, Eelevate, Innards Out, Piercing Drill, Unseen Fist** — designs received, not built. Out
  of session, not out of route. Mega Sol and Eelevate arm B fit the stone control as-is (consequences
  off the carrier); **Eelevate arm A and Innards Out do NOT** — both land on the carrier's own body,
  the row the table above says this control cannot reach. They want a `dmgRange` probe like Filter's.
- **BLOCKED ON TAGS, NOT ON ME:** `piercingdrill` and `unseenfist` carry `tags: ["untagged"]`;
  `innardsout` carries `buffsHolderOnHit {boosts: null}`, which is not the mechanic. Until
  `tag_dex.js` derives something, the engine cannot act on them at all and the honest verdict is **the
  tag is missing**, not that the engine is wrong. `engine/tag_dex.js` is the other agent's file.
- **Aerilate / Dragonize / Galvanize / Normalize** — confirmed a STAGING problem only. `convertsMoveType`
  is proven live by Pixilate and Refrigerate, which both pass. They are claimed by a specialised rule
  that goes through `stageAbility` (ALTERNATE-tier only). Note **Normalize converts `"its moves"` and
  not `"Normal moves"`** — a different param value on the same tag, so it does not follow from the
  Pixilate fixture and must be checked separately.
- **Parental Bond** — diagnosis received and agreed; routed to the simulator agent. We apply a single
  x1.25 to the whole figure where Showdown performs two separate hits. Not fixed here.

## THE CONTROL CAUTION, ADOPTED

Will's correction — *"IT CANT HAVE SCRAPPY AND PARENTAL"* — is now a property of every fixture above.
None writes an ability onto a body that could not legally carry it: Shadow Tag, Electric Surge and
Fairy Aura all get theirs from the forme change and control by removing the stone or by using the
pre-mega turn. The one place an ability IS written onto a body is `probe_mega_damage_abilities.js`,
which plays no game and validates no team — it calls `dmgRange` on a built body — and says so in its
header rather than implying legality.

---

# ADDENDUM 2 — the switching axes, and the tagger-ahead-of-engine pattern

Same pin: release `07ffb4e75207`. `engine/medicham2-browser.js` and `engine/tag_dex.js` untouched.

## SCOREBOARD

| | TESTED | DIFFER | DID-NOT-FIRE | DEFERRED | COULD-NOT-STAGE |
|---|---|---|---|---|---|
| session start (`--no-swap-control`) | 86 | 0 | 0 | 0 | 214 |
| **now** | **93** | **2** | **1** | **2** | **205** |

Items unchanged all session: 139 MATCH, 0 DIFFER, 1 DEFERRED.

## 1. `selfSwitch` — the concern was right, the diagnosis was one step off

The membership test was **already truthiness** (`m.selfSwitch &&`), so Baton Pass and Shed Tail were not
excluded by an equality bug. They were excluded by two OTHER filters sitting beside it —
`category !== 'Status'` and `accuracy === 100` — and then `.find` took exactly one member, which was
always a damaging `selfSwitch === true` move. **The effect is what was reported: only the easy half was
proven, and the arm that passed could not have told you otherwise.**

Now: one arm per DISTINCT `selfSwitch` SHAPE, `accuracy === true` admitted alongside `100` (both string
members carry `true`, meaning never-misses), and self-targeted pivots get a click with no target.

```
a-switching-move-still-works[true]                 -> BOTH-ALLOWED   (U-turn)
a-switching-move-still-works[string:copyvolatile]  -> BOTH-ALLOWED   (Baton Pass)
a-switching-move-still-works[string:shedtail]      -> BOTH-ALLOWED   (Shed Tail)
```

**And the engine is right for a better reason than the arms show.** Its gate is `!a.mv` — ANY
move-based action escapes the trap, so the `selfSwitch` shape never reaches the decision. That is the
correct rule and it is why all three shapes pass. Worth knowing: this axis is safe by construction, not
by luck.

## 2. FORCED SWITCHING — a second axis, and it now has two rows

**The counterintuitive interaction is CORRECT in our engine.**

```
a-trapped-body-is-still-phazed[roar]  -> BOTH-ALLOWED
```

A body held by Shadow Tag is still thrown out by Roar in both engines. The trap is modelled as a
restriction on CHOOSING, not as a slot lock. The mover is derived from `forceSwitch` and filtered on
the pin — **Dragon Tail and Circle Throw are 90-accuracy and the primary arm makes them MISS**, so an
arm staged with either would have left the body in its slot in both engines and reported a pass having
tested nothing.

*Observed, not judged:* the two engines drag in DIFFERENT replacements (Showdown Corviknight, ours
Venusaur). A phaze picks a random bench member and the arm asks only whether the body left, so this is
outside what it measures. Flagging it because somebody should decide whether the pin is meant to align
that draw.

### NEW ROW — `ability/refuses-a-forced-switch`, and it is RED

**Suction Cups: DID-NOT-FIRE.** A refusal to be dragged IS an ordinary board leaf — the body is in the
slot or it is not — so this needs none of the `switchVerdict` machinery; the standard subject-minus-
control comparison reads it.

```
Suction Cups   [carrier Malamar, control Contrary, second control Infiltrator]
  turn 1  the body in that slot is Malamar   (without it: the body in that slot is Clefable)
  SHOWDOWN'S BOARD MOVED WHEN THE ENTITY WAS ADDED. OURS DID NOT MOVE AT ALL.
  the two deltas are IDENTICAL against both controls, so the delta is not the control's
```

Showdown keeps Malamar in the slot; with any other ability it is dragged out. **Our engine does not
implement it at all.**

**Guard Dog has NO legal carrier in this format** — measured, every body with it is `isNonstandard`
here. Out of scope as a fact about the regulation, recorded rather than silently omitted.

**Arm 4 (Suction Cups + a VOLUNTARY switch must still succeed) NOT BUILT.** It is the arm that proves
the two axes are separate rather than one boolean, and it is worth building — but its outcome is
already determined by the row above: an ability with no representation cannot collapse two axes it does
not participate in. It should be built when Suction Cups is wired, as the guard against the fix
over-reaching.

## 3. THE PATTERN — the tagger is ahead of the engine, and the two Suction-Cups-shaped gaps are NOT the same gap

The coordinator's read is right and the distinction inside it matters for routing:

| entity | tag in `data/tags.json` | who owes the fix |
|---|---|---|
| **Shed Shell** | `escapesTrap {escapes: true, scope: "ability"}` — **derived and present** | **the ENGINE.** medicham2's own source says so in as many words: *"SHED SHELL IS NOT HONOURED ON THIS BRANCH and that is a stated gap"* |
| **Suction Cups** | **no entry at all** | **`tag_dex.js` first.** Nothing to read; a reader cannot be written against an absent fact |
| `piercingdrill`, `unseenfist` | `["untagged"]` | `tag_dex.js` |
| `innardsout` | `buffsHolderOnHit {boosts: null}` — wrong mechanic | `tag_dex.js` |

So "the cheapest wins left are readers, not derivations" holds for Shed Shell and does **not** hold for
Suction Cups. Two different queues.

**One correction worth making to the record:** medicham2's Shed Shell comment claims *"Zero corpus
exposure today"*. That is a USAGE claim and it is not a correctness claim — the fixture reaches the
branch deliberately, so the gap is now measured and reachable regardless of how often the ladder hits
it. The stated gap has a failing test against it.

## 4. ANTICIPATION AND FOREWARN — shelved, and the shelf had to be moved to be visible

Both added to the named `DEFERRED` map with Will's words and the date. Not routed through the usage
shelf: that is a moves-only THRESHOLD (the store cannot say which ability a body carried — 891 open
sheets in 52,377 games), and this is an owner judgement about a mechanic with no observable effect,
which is what the named map is for. The reason states the real obstacle: **the effect is a MESSAGE**,
so no board comparison can ever read it and the only instrument that could is the protocol trace.

**The shelf did not work when it was first added, and that is worth recording.** `DEFERRED` was checked
AFTER the inert-staging gate, so both abilities returned COULD-NOT-STAGE and never reached it —
`DEFERRED-BY-OWNER` read 0 with two entries sitting in the map. An invisible exception is precisely
what the named map exists to prevent. The check now runs before the inert gate and names the underlying
verdict inside the deferral text. Metronome, the pre-existing entry, is unaffected and still reports.
`DEFERRED-BY-OWNER` now reads 2 on abilities and 1 on items.

## OWED

- **Suction Cups** — needs `tag_dex.js` to derive `onDragOut` before the engine can read it. Other
  agent's file.
- **Shed Shell on the ability trap branch** — the tag is there; the reader is not. Simulator agent.
- **Arm 4** — Suction Cups + voluntary switch, once the above lands.
- **Mega Sol, Eelevate, Innards Out, Piercing Drill, Unseen Fist** — still designs without builds; two
  blocked on tags. Mega Sol's tag is `privateWeather {actsAsWeather:["sun"], visibleOnField:false}`,
  which the stone control CAN reach (the consequence is a damage multiplier on somebody the carrier
  attacks), and it is the next one I would take.

---

# ADDENDUM 3 — the phaze-draw declaration, and Mega Sol

Same pin: release `07ffb4e75207`. `engine/medicham2-browser.js`, `engine/tag_dex.js` and
`engine/replay_differential.js` all untouched.

## 1. THE PHAZE DRAW — declared, printed, and scoped

Will, 2026-08-10: *"I MEAN ROAR IS RANDOM IT DOESNT REALLY MATTER WHAT IT DRAGS IN"*. The arm's
granularity stands as built.

Recorded as a **declaration, not a tolerance**, in two places — the source, beside the arm, and the
**verdict text, on every run**, because the second is the one that actually stops a number being quoted
without its caveat:

```
a-trapped-body-is-still-phazed[roar] -> BOTH-ALLOWED
  [both engines let Charizard go (showdown slot now corviknight, ours venusaur)]
  DECLARED, Will 2026-08-10 ("I MEAN ROAR IS RANDOM IT DOESNT REALLY MATTER WHAT IT DRAGS IN"):
  THIS ARM DOES NOT COMPARE WHICH BODY ARRIVED. The replacement is a random draw and the two engines
  flip it independently (measured: Showdown drew Corviknight, ours drew Venusaur off the same bench).
  Pinning it would align a die rather than test a mechanic. SCOPE: the ROSTER does not compare the
  draw -- this is NOT the claim that the draw never matters, and an all-turns replay differential
  would carry it forward into every later turn
```

Both required clauses are in it: **why the identity is not compared** (so a later session does not
"repair" it by pinning the draw and then wonder why the arm went flaky — the same reasoning the order
comparator uses when it REFUSES a genuine speed tie rather than scoring it), and **the limit** — the
sentence is *the roster does not compare the draw*, never *the draw does not matter*. The all-turns
replay case is named as belonging to `engine/replay_differential.js`, which I did not touch.

The declaration is emitted by a general mechanism: anything from the word `DECLARED` onward in an
exception arm's design text travels into the verdict. Previously only the RUNTIME reading printed, so a
judgement written in a source comment would have been invisible to every report — which is this repo's
signature failure, one layer over.

**Suction Cups stays RED and is explicitly not covered by this.** It is about *whether* the body left,
not *which one* arrived. `ability/refuses-a-forced-switch` -> DID-NOT-FIRE, attributed against two
different controls. Its derivation is with the `tag_dex.js` owner.

## 2. MEGA SOL — 5 arms, all green, and the assertion restates nothing

`tests/probe_mega_damage_abilities.js` now carries a second family. Mega Sol is a **private weather**
(`privateWeather {actsAsWeather:["sun"], visibleOnField:false, affects:"only this Pokemon"}`), which
medicham2 reads in `effWeatherOf` **off the ATTACKER only** (WIRE 99) — and that decides the whole
shape: the carrier has to be the one throwing.

**The assertion is deliberately not "Fire goes up by 1.5".** That number belongs to the WEATHER, not to
this ability, and typing it here would be the "two files that both decide Choice Scarf is x1.5" defect
CLAUDE.md names. The tag says the holder acts as if its weather were up, so that is the assertion:

```
Mega Sol on Meganium-Mega   acts as "sun" (engine weather id "sun"), only this Pokemon
  types this engine says "sun" MOVES: Fire, Water   |   unaffected: Bug, Dark, Dragon, Electric, +11
  AFFECTED Fire   ok EQUIVALENCE private=181..214 real-sun=181..214   ok LIVE     no-weather=121..143
  AFFECTED Water  ok EQUIVALENCE private=60..71   real-sun=60..71     ok LIVE     no-weather=121..143
  NEGATIVE Bug    ok EQUIVALENCE private=43..51   real-sun=43..51     ok UNCHANGED no-weather=43..51
  PRIVATE  as DEFENDER  ok  a foe's Fire move into the holder: with=90..108 without=90..108
```

Three assertions per type, none of them a restated constant:

- **EQUIVALENCE** — the holder with no field weather must equal, roll for roll, a control body under
  real sun.
- **LIVE** — the holder must NOT equal the control with no weather, or the equivalence is vacuous.
- **PRIVATE** — as DEFENDER the reading must be identical either way. `affects: only this Pokemon`, so
  an implementation that raised REAL weather would leak to the attacker and pass every other arm.

**Which types the weather moves is DERIVED, not listed:** a control body throws one move of every type
under no weather and under the weather, and a type whose 16-roll ladder changes is a member. It found
Fire and Water; the other fifteen become the negative arm. Nothing is named anywhere in the probe.

**RED FIRST, with the correct signature.** `--break` gives the carrier a quiet ability instead:

```
AFFECTED Fire   RED EQUIVALENCE private=121..143 real-sun=181..214   RED LIVE
AFFECTED Water  RED EQUIVALENCE private=121..143 real-sun=60..71     RED LIVE
NEGATIVE Bug    ok  ...                                              ok  UNCHANGED
6 RED
```

Both affected types fail both assertions; the negative and the privacy arm stay green — correct, since
removing an ability cannot change a type it never touched.

**One weakness, stated rather than left for someone to find:** the PRIVATE arm cannot demonstrate its
own red under `--break`, because that break removes the ability from both defenders. A real red for it
needs a break that makes the ability set GLOBAL weather, which is an engine patch and not mine. The arm
is therefore a live assertion that has never been shown to fail — weaker than the other four, and
recorded as such.

## RUNNING TOTALS

| stage | |
|---|---|
| abilities (roster) | 93 TESTED, 2 DIFFER, 1 DID-NOT-FIRE, 2 DEFERRED, 205 COULD-NOT-STAGE |
| items (roster) | 139 MATCH, 0 DIFFER, 1 DEFERRED |
| `probe_mega_damage_abilities.js` | 11 arms, 0 RED (Filter 4, Mega Sol 7) |

## STILL OWED

- **Eelevate, Innards Out, Piercing Drill, Unseen Fist.** Piercing Drill and Unseen Fist are
  `["untagged"]`; Innards Out has the wrong param. All three are with the `tag_dex.js` owner. Eelevate
  is tagged (`boostsOnKO` + `typeImmunity`) and buildable — its Ground-immunity arm lands on the
  carrier's own body, so it wants a `dmgRange` arm in this probe rather than a roster row, and it is
  the next one I would take.
- **Suction Cups** — derivation first, then a reader, then arm 4 (a voluntary switch must still succeed)
  as the guard against the fix over-reaching.
- **Shed Shell on the ability-trap branch** — tag present, reader absent. Simulator agent.

---

# ADDENDUM 4 — the filler movesets, from the team sheets

`engine/medicham2-browser.js`, `engine/tag_dex.js` and `engine/replay_differential.js` untouched.
`data/engine-data.js` not hand-edited — every change is a builder output.

## IT WAS NOT SIX ROWS. IT WAS SEVENTY-SIX.

Measured before touching anything, on mega rows whose source forme has a real moveset:

```
76 mega rows judged | 8 identical to their source | 68 DIFFER
and all 68 that differ carry NO set_source at all
while their bases carry: charizard n=3,180  swampert n=1,567  gengar n=633  observed ["mv",...]
```

**Nothing had ever observed a mega row.** The store names only the base species in `brought[]`, so the
set generator had ~0 samples per mega forme and filled the slots. The six named rows were the visible
tip.

## THE FIX IS THE SHEETS, AND THE COVERAGE IS FAR BETTER THAN THE LADDER SUGGESTS

`engine/mega_sets_from_sheets.js` (new). A sheet declares species + item, and a **mega stone identifies
the forme** — `Venusaur + Venusaurite` IS Venusaur-Mega with its four declared moves. The stone→forme
map is read from the dex (`item.megaStone`), never a hand list.

```
games.bo3.jsonl      12,239 games, 12,221 with a sheet
games.ladder.jsonl   52,607 games,    895 with a sheet
64,846 scanned | 13,116 carried a sheet | 44,163 sheet entries holding a mega stone
76 distinct mega formes observed
```

The **bo3 store is the open-sheet ladder** and carries 12,221 sheet games — 13.7x the ladder's 895. So
every row is backed far more heavily than the ladder-only counts suggested: Meganium-Mega 226
observations rather than 18, Venusaur-Mega 841 rather than 51, Glimmora-Mega 716 rather than 59.

**Meganium-Mega's declared set is `dazzlinggleam, protect, solarbeam, weatherball` (167 of 226).**
Weather Ball, exactly the move Will named. The data agrees with him.

The set taken is the **MODAL declared set**, not a union and not a per-slot vote: a union invents a
five-move body nobody brought, and a per-slot vote blends two archetypes into a set that exists on no
team. The modal set is one somebody actually declared.

## THE OVER-MATCH THAT THE BASE-FORME RULE WOULD HAVE CAUSED

Printed before wiring, per the standing rule. Scoping on `changesFrom` rather than on mega/primal would
have overwritten four **correct, heavily observed** rows with base Rotom's:

```
rotom-heat  ["thunderbolt","overheat","voltswitch","discharge"]  n=260
rotom-wash  ["electroweb","hydropump","voltswitch","trick"]      n=819
rotom-frost ["blizzard","discharge","trick","voltswitch"]        n=22
rotom-mow   ["willowisp","protect","leafstorm","voltswitch"]     n=50
rotom       ["thunder","hex","uproar","protect"]
```

Overheat and Hydro Pump are the *whole point* of those formes. The scope is `requiredItem`/mega, and
the diff confirms it landed: **76 mv rows changed, all mega, zero non-mega, zero other fields.**

## PROVENANCE TRAVELS, AND FILLER IS NEVER WRITTEN

Every mega row now carries `mv_provenance {source, observations, modal_n, distinct_sets}`. Where
neither sheets nor Smogon have it, the row is **EMPTIED with a stated reason** — because an empty row
is a *visible* gap and a filler row is an *invisible* one, which is the entire reason this survived
checks A, B and E. medicham2 already recovers an empty mega row through its `base` pointer and counts
when it cannot, so an emptied row degrades into a counted recovery rather than into silence.

```
movesets REWRITTEN from open team sheets: 76
movesets the sheet AGREED with:            0     <- nothing had ever been right
movesets from the SMOGON prior:            0
movesets EMPTIED (no evidence):            0     (4 rows were already empty and stay so, with a reason)
```

The builder **refuses to rewrite at all if the sheet pass observes zero formes** — a missing store and
a genuinely unobserved forme are different accidents, and only the second justifies clearing a row.

## AUDIT CHECK F — and it is RED on the old artifact

`artifact_audit.js` gained check F. **The test is PROVENANCE, not a list of filler moves** — "which
moves are filler" is a judgement that rots; "how many observations back this row, and from where" is a
fact the builder records.

```
against the PRE-FIX artifact:  80 mega rows, 0 record a source
                               GAP 76 mega row(s) carry moves that nothing observed
against the artifact now:      80 mega rows, 80 record a source
                               ok  every mega row with a moveset records an observed source
                               4 row(s) EMPTY with a stated reason (salamence/latios/latias/diancie-mega)
```

THIN rows (< 10 observations) are reported separately and are **not** failures — two observations is a
real set, it is just not a distribution, and a consumer should see which it holds.

`artifact_audit`: **no gaps found.**

## MEGA SOL, ON THE MOVE THE BODY ACTUALLY HAS

Confirmed independently, now that the row is right:

```
Weather Ball off Meganium-Mega   private 122..144   real sun 122..144   no weather 41..49
```

Identical to real sun, and 3x the no-weather figure — the Fire type change and the sun boost both land.

## THE PROBE'S BODIES COULD NOT EXIST, AND IT NOW SAYS SO

Added to `probe_mega_damage_abilities.js`'s header, in its own section. Two things about every arm are
illegal and the TeamValidator would refuse both: **the move is picked from the whole dex, not the
body's learnset** (Aggron-Mega does not learn Eruption), and **the control ability is written onto a
body that cannot carry it**.

That is sound *here* because `dmgRange` is arithmetic — two bodies, a move, a field, a damage ladder;
no team, no turn, no validator, so an illegal pairing cannot reach a rule that depends on legality. The
header states plainly that this stops being acceptable the moment a fixture PLAYS a turn — a Scrappy
Kangaskhan-Mega cannot exist — which is why every roster fixture in this batch takes its ability from
the forme change and never writes one.

## SCOPE NOTE ON THE MEASUREMENTS ABOVE

`data/engine-data.js` is a **frozen release input**. Release `07ffb4e75207` still carries the old
filler movesets, so every roster figure quoted in the earlier addenda is unaffected by this change and
remains valid as stated. The moveset fix will reach the roster only at the next release cut — which is
not mine to make.
