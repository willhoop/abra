# The last four inert families, and a real engine defect underneath one of them — ENGINE, 2026-09-12

Release **`48ac1c228e02`** (cut in this pass — see *Releases cut*), census
`data/mechanics-census.json` (**883 probed / 883 live / 0 missing**, re-derived at the end and
UNMOVED), team store `data/team-pool-frozen`. `engine/board.js`, `engine/magnemite.js` and
`data/engine-data.js` were **not** touched. `aerilate`, `magmaarmor` and `opportunist` were **not**
attempted — each belongs to a different rule whose change would have made this batch unattributable,
which is what the brief asked and is stated here so the omission is deliberate rather than missed.

## Counts, before → after

| stage | before (artifacts at git HEAD, release `534442d71183`) | after (release `48ac1c228e02`) | artifact |
|---|---|---|---|
| **items** | 148 MATCH / 0 CNS / 0 CNQ / 0 DEF | **148 / 0 / 0 / 0 — UNMOVED** | `data/roster.items.json` |
| **abilities** | 164 MATCH / 29 CNS / 2 CNQ / 5 DEF | **183 MATCH / 10 CNS / 2 CNQ / 5 DEF** | `data/roster.abilities.json` |
| **moves** | 487 MATCH / 7 CNS / 0 CNQ / 3 DEF | **487 / 7 / 0 / 3 — UNMOVED** | `data/roster.moves.json` |

All three stages: **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE, 0 rows threw.** Plant anchors
**22 / 61 / 36 apply exactly once, none dead**; red demonstrations **22 / 61 / 36 with 0 `ok: false`
and 0 WEAK / NOT CAUGHT**. Items and moves are the **controls** and neither moved a single row.

**Nineteen rows close green.** All twenty-one inert rows leave the list: nineteen become
FIRED-AND-BOARDS-MATCH and two — `frisk` and `goodasgold` — become measured refusals. **`THE STAGING
IS INERT` no longer appears anywhere in the abilities stage.**

## The five rules, and what each one derives

Nothing below is a typed Pokémon fact. Every part of every fixture is read off the format on the run,
and every rule's membership was **printed over the whole dex before a line was wired**.

### `ability/an-item-is-eaten-taken-or-handed-on` — 7 rows

`item` IS a compared leaf (`board_state.js` writes it on the active slot AND on the party row) and the
generic staging never makes one move. A better control cannot reach any of these; only a fixture in
which an item actually moves can.

```
ITEM MOTION: 8 in the dex — cheekpouch {eats}; cudchew {eats}; klutz {suppresses-own-item};
magician {steals-on-hitting}; pickpocket {steals-on-being-hit}; ripen {eats}; stickyhold {refuses};
symbiosis {passes-to-ally}
PROPS: berry = Sitrus Berry (spent at 1/2 max hp, heals 1/4);  carried item = Leftovers;
take-item clicks = Bug Bite, Covet, Knock Off, Pluck, Switcheroo, Trick, Thief
```

Exactly the seven inert rows plus `ripen`, which is owned by `ability/stat-drop-reaction` above and
never reaches this rule. **No over-match.**

- **The two props are derived, not named.** The berry is the legal berry whose `onUpdate` spends it at
  an HP fraction and whose `onEat` heals a FRACTION — a flat heal is REFUSED rather than ranked lower,
  because it does not scale with a body and the same fixture would be a different experiment on every
  carrier. The carried item is the legal item with EXACTLY ONE function-valued handler, a residual
  heal, so its motion is visible twice: on the `item` leaf and on the hp the heal pays.
- **The remover is the click the handler itself names.** Sticky Hold's own source tests
  `this.activeMove.id === "knockoff"`, so Knock Off is used; the fallback is the least entangled
  derived take-item click (not berry-gated, not a Status swap).
- **Contact is asked for only where the handler asks for it.** Pickpocket reads
  `move.flags["contact"]`; Magician does not.
- **IT SITS ABOVE `ability/entry` AND `ability/residual` DELIBERATELY.** Klutz registers `onStart` and
  Cud Chew registers `onResidual`, so both were owned by a rule that stages the MOMENT. Neither moment
  is the mechanic: Klutz's `onStart` does nothing but END the holder's own item, and Cud Chew's
  residual is the DELAYED HALF of eating a berry — its own counter (`counter = 2`) is read off the
  handler and the script is lengthened to match.

### `ability/a-status-is-refused-cured-or-reflected` — 5 rows

```
STATUS FAMILY: 5 in the dex — corrosion {ignores-type-immunity ["tox","psn"]}; earlybird
{extra-status-tick {"slp":1}}; hydration {weather-cures ["raindance","primordialsea"]};
leafguard {weather-refuses ["sunnyday","desolateland"]}; synchronize {reflects ["slp","frz"]}
STATUS CLICKS: par=Glare, psn=Toxic Thread;  with their own receipt: Toxic Thread
```

Exactly the five, and `ability/refuses-one-status` sits ABOVE this rule and keeps every member it had.

**TWO OF THE FIVE REGISTER NO HANDLER AT ALL, AND THAT IS WHAT THEY ARE.** Corrosion and Early Bird
are implemented BY NAME inside the authority (`sim/pokemon.ts` `setStatus` consults the attacker's
ability; `data/conditions.ts:68-70` spends a second sleep tick for it) and `data/tags.json` records
exactly that as `nameImplementedBySim`. They are matched off the SHAPE of that param — an
`ignoresStatusImmunityFor` list, an `extraStatusTicks` map — never off a name. Asked of the format,
only ten legal abilities register no handler at all and only those two carry the tag.

**THE RECEIPT PROBLEM DECIDES THE CLICK ON TWO OF THE BRANCHES, AND IT IS THE HARD PART.** A
precondition is read off the SUBJECT arm, and on both weather branches the subject arm ends every
boundary with NO STATUS — Leaf Guard refuses it, Hydration wipes it before the turn ends. "The carrier
is poisoned" is therefore unreadable there. So those two branches DEMAND a status click that also
writes a stat stage, and the stage — which lands in both arms and cancels out of the delta exactly —
is what proves the click landed. The other branches prefer the cleanest click, for the opposite and
equally deliberate reason.

**Corrosion's defender comes out of `CANDIDATES`, not `moveBodies`,** and the difference is the whole
branch: the quiet pool is ranked for a DAMAGE reading and holds no body whose TYPE refuses poison,
which is the one property this fixture cannot do without. Measured — with the quiet pool the row read
`no carrier this rule can use exists`, which would have been a sentence about the FORMAT for a reason
about the pool.

### `ability/it-rewrites-its-own-click` — 2 rows

```
CLICK REWRITE: 3 in the dex — propellertail {tracks-its-target}; skilllink {multihit-index index 1};
stalwart {tracks-its-target}
```

`propellertail` has no legal carrier and is out of scope. No over-match.

- **`skilllink` runs on `bottom-tie-first`, and THE ARM IS THE WHOLE FIXTURE.** This file's primary
  corner scalar is `1 - 1e-9`, so `sample([2,2,3,3,4,5])` already returns the TOP of the range — which
  is exactly the number Skill Link writes. The ability is provably inert on the primary arm and only
  there. On the other published corner the pin selects the BOTTOM, so with the ability Bullet Seed
  lands 5 times and without it 2.
- **`stalwart` needed a redirector and this format has no ability that is one.** Asked on the run:
  ZERO legal abilities register `onFoeRedirectTarget`, so the redirect has to be a CLICK — a Status
  move whose own condition registers one, at positive priority so it is already up. That is Follow Me.
  The tracked click is aimed at the opposing SECOND slot because the control builder writes that slot
  itself and the rule cannot choose it.

### `ability/an-arrival-a-field-or-a-refusal` — 4 rows + 2 measured refusals

```
FIELD/ARRIVAL FAMILY: 9 in the dex — airlock {suppresses-the-sky}; cloudnine {suppresses-the-sky};
damp {refuses-a-move-outright}; frisk {announces-only}; goodasgold {refuses-status-moves};
powerofalchemy {inherits-from-a-fallen-ally}; receiver {inherits-from-a-fallen-ally};
screencleaner {clears-side-conditions}; wonderguard {refuses-status-moves}
```

`airlock`, `powerofalchemy` and `wonderguard` have no legal carrier and are out of scope, so the six
in-scope members are exactly the six rows.

**TWO PREDICATES WERE LOOSE AND THE PRINT SAID SO BEFORE ANYTHING WAS WIRED.** The first draft matched
**nineteen** abilities: ten announce themselves on entry and then do their work in another handler
(Mold Breaker, Pressure, Curious Medicine, the auras), and **WONDER GUARD tests
`move.category === "Status"` in its `onTryHit` and does the OPPOSITE with it** — it lets status through
and refuses everything else. So `announces-only` demands that the onStart be the ability's ONLY
function-valued handler AND that every call in its body be on a printed reader list (a mutating call
this rule has not heard of is a NON-match, which is the safe direction), and `refuses-status-moves`
demands a `return null`. The narrowed print reads nine.

### `ability/it-counts-the-fallen-when-it-arrives` — `supremeoverlord`

Left open by the previous pass rather than given a weak refusal, and correctly: the counter is taken
at switch-in, so the carrier has to ARRIVE after an ally has died, and the swap-control builder cannot
express a bench start. **It is expressed.** The carrier starts benched, a derived killer takes its ALLY
off the field in one click, and the carrier walks in with `side.totalFainted` already at 1.

**THE FIRST VERSION OF THIS FIXTURE WAS WRONG AND THE AUTHORITY SAID SO IN ONE LINE.** It killed the
ally AND asked for a switch on the next turn; Showdown rejected the whole game — *"Can't pass: Your
Torkoal must make a move"* — because the corpse's slot had already been refilled at the end of turn 1,
and its own narration named the body that refilled it: `|-start|p2b: Kingambit|fallen1|[silent]` before
`|turn|2`. **The arrival IS the forced switch.** The replacement is medicham2's pick and
`mirrorForcedSwitch` gives Showdown the same one, so it is deterministic; the two preconditions (the
ally is really dead; the carrier really took a slot) are what make that a receipt rather than an
assumption.

Its attribution is the SECOND CONTROL, not a quiet one: both of Kingambit's other abilities are live,
and both are inert ON THIS BOARD (nothing lowers a stat, nothing is aimed at the carrier). The
arithmetic says so rather than this paragraph — the row is re-measured against the third ability and
only what survives both is charged. Visible in the dump: `930 → 831 → 732` with the ability against
`930 → 840 → 750` without, which is the handler's own `4506/4096`.

## THE LEAVES WERE READ BEFORE THE COUNT WAS BELIEVED

This is the test ROADMAP #609 exists for. **Every previous pass could only show `hp` and `boosts`
leaves; this one carries `.item`, `.status`, `.status_counter`, `.ability`, `.screens`, `.fainted`,
`.species` and `.pp`:**

```
cheekpouch       8   p2.party.diggersby.hp, p2.active[0].hp
cloudnine       12   p1.party.torkoal.hp, p1.active[0].hp, p2.party.drampa.hp, p2.active[0].hp
corrosion       12   p1.party.venusaur.hp, p1.party.venusaur.STATUS, p1.active[0].hp, p1.active[0].STATUS
cudchew          6   p2.party.farigiraf.hp, p2.active[0].hp
damp            45   p1.party.glimmora.hp, p1.party.glimmora.FAINTED, p1.party.glimmora.status,
                     p1.party.corviknight.hp, p1.active[0].SPECIES, p1.active[0].hp,
                     p1.active[0].maxhp, p1.active[0].types, p1.active[0].ability,
                     p1.active[1].hp, p1.PP[0].explosion, p2.party.bellibolt.hp,
                     p2.party.corviknight.hp, p2.active[0].hp, p2.active[1].hp
earlybird        8   p2.party.kangaskhan.STATUS_COUNTER, p2.active[0].STATUS_COUNTER,
                     p2.party.kangaskhan.status, p2.active[0].status, p2.pp[0].focusenergy
hydration       12   p2.party.goodra.hp, p2.party.goodra.STATUS, p2.active[0].hp, p2.active[0].STATUS
klutz            6   p2.party.audino.hp, p2.active[0].hp
leafguard       12   p2.party.meganium.hp, p2.party.meganium.STATUS, p2.active[0].hp, p2.active[0].STATUS
magician        18   p1.party.torterra.hp, p1.party.torterra.ITEM, p1.active[0].hp,
                     p1.active[0].ITEM, p2.party.klefki.ITEM, p2.active[0].ITEM
pickpocket      18   p1.party.torterra.ITEM, p1.active[0].ITEM, p2.party.barbaracle.hp,
                     p2.party.barbaracle.ITEM, p2.active[0].hp, p2.active[0].ITEM
receiver         4   p2.party.passimian.ABILITY, p2.active[0].ABILITY
screencleaner    4   p1.SCREENS.special, p1.SCREENS.named.lightscreen
skilllink        6   p1.party.torterra.hp, p1.active[0].hp
stalwart        12   p1.party.maushold.hp, p1.party.goodrahisui.hp, p1.active[0].hp, p1.active[1].hp
stickyhold      12   p2.party.hydrapple.hp, p2.party.hydrapple.ITEM, p2.active[0].hp, p2.active[0].ITEM
supremeoverlord  4   p1.party.goodrahisui.hp, p1.active[0].hp
symbiosis       18   p2.party.florges.ITEM, p2.party.torterra.hp, p2.party.torterra.ITEM,
                     p2.active[0].ITEM, p2.active[1].hp, p2.active[1].ITEM
synchronize      6   p1.party.serperior.STATUS, p1.active[0].STATUS
```

`receiver`'s `.ability` leaves are the case the swap-leaf correction was deliberately built to KEEP:
it drops a leaf only where the subject value IS the ability under test, and here it is the ability the
carrier INHERITED. Each of the five new rules is CAUGHT by its own red demonstration and none is WEAK.

## A REAL ENGINE DEFECT, FOUND BY THE EARLY BIRD FIXTURE

The one row that came back **FIRED-AND-BOARDS-DIFFER** rather than green:

```
SHOWDOWN  Kangaskhan on the bench is on status counter 2
OURS      Kangaskhan on the bench is on status counter 1        [p2 party.status_counter / off-by-one]
SHOWDOWN  Kangaskhan is on status counter 2
OURS      Kangaskhan is on status counter 1                     [p2a status_counter / off-by-one]
```

**BOTH HALVES OF THAT ARE THE POINT.** The authority spends TWO ticks off `statusState.time` for this
ability, and `board_state.js` publishes `startTime - time` — so the authority's own compared number is
TICKS SPENT. medicham2 counted TURNS ELAPSED and paid for the accelerator by subtracting it from the
wake THRESHOLD (`slpTurns >= slpTime - extra`). **The two arithmetics agree on WHEN the body wakes and
disagree on WHAT THE COUNTER SAYS** — which is exactly the shape of a defect a behavioural test cannot
see and a board comparison can.

**Fixed at the counter, not at the comparator:** `slpTurns += 1 + extra` and the ceilings return to the
raw `slpTime` / 3 / 2. The wake turn is unchanged for every value the format can produce, and that is
arithmetic rather than a hope — with `extra = 1` the counter is `2t`, so `2t >= 2` and `2t >= 3` first
hold at `t = 1` and `t = 2`, which is what `t >= 2-1` and `t >= 3-1` gave; with `extra = 0` nothing in
the expression changes at all.

**Red before, green after, red again under its knob**, all three measured:

| | release | verdict |
|---|---|---|
| before the fix | `534442d71183` | **FIRED-AND-BOARDS-DIFFER**, the four leaves above |
| after the fix | `48ac1c228e02` | **FIRED-AND-BOARDS-MATCH** |
| `MEDI_SLEEP_TICKS_AS_TURNS=1` | `48ac1c228e02` | **FIRED-AND-BOARDS-DIFFER**, the same four leaves |

The knob stamps `MEDFAILS.sleepTicksAsTurnsRestored`, on the same rule as `MEDI_SLEEP_WAKE_COIN`: a run
carrying the defect on purpose says so out loud.

## THREE INSTRUMENT DEFECTS, ALL OF THEM THE SAME SHAPE AS ROADMAP #612

The brief said to expect the measurement to be wrong before the engine is. It was, three times, and
every one is a DEAD CONTROL manufacturing an INERT row — a false coverage limit, which accuses nobody.

### 1. GOOD AS GOLD REFUSES THE CONTROL ITSELF

Skill Swap is a Status move aimed at the carrier, and this ability returns `null` for exactly that.
`swapRefused` only read `flags.failskillswap`, which Good as Gold does not carry, so the builder built
the arm and the arm did nothing. Dumped, both arms, five boundaries
(`ROSTER_DUMP_BOARDS=goodasgold`, release `534442d71183`):

```
[DUMP SUBJ] t0..t4  p2[0]=gholdengo hp972 ab=goodasgold
[DUMP CTRL] t0..t4  p2[0]=gholdengo hp972 ab=goodasgold
```

**`swapRefused` now covers that door**, narrowed to a handler that RETURNS NULL because Wonder Guard's
`onTryHit` tests the same category and does the opposite with it. Printed membership: one legal
ability (`goodasgold`); everything else on the refusal list is there by flag, and the flagged set is
unchanged. Blast radius: one row, which was already COULD-NOT-STAGE and is now COULD-NOT-STAGE with a
MEASURED reason instead of a fabricated one.

### 2. THE SWAP CONTROL CANNOT CONTROL A FIELD-WIDE ABILITY

`stageAbilitySwap` EXCHANGES the ability; it does not delete it. For a holder-scoped ability that
costs nothing. For a FIELD-WIDE one the control arm still has it, one slot to the left:

```
damp       [CTRL] t1  p1[1]=goodrahisui ab=damp        | p2[0]=bellibolt ab=shellarmor
cloudnine  [CTRL] t1  p1[1]=goodrahisui ab=cloudnine   | p2[0]=altaria   ab=shellarmor
```

Damp on ANY active refuses the explosion and Cloud Nine on ANY active suppresses the sky, so both arms
were the same experiment and both rows read INERT over ~2,700 leaves. **Read off the data, not off a
name:** `suppressWeather` is Showdown's own field on the ability and `onAny*` is Showdown's own prefix
for "this fires wherever it happens". Such a carrier is now routed to a SHEET control — which really
does remove it — and is required to have a THIRD ability, because every sheet control this format
offers these two is itself live and the attribution has to be the second control.

### 3. AN INHERITED ABILITY THAT LANDS ON THE CONTROL'S OWN VALUE IS INVISIBLE

Receiver's first fixture picked the bulkiest quiet ally, which carries SHELL ARMOR — exactly what the
swap control lends the carrier. The inheritance HAPPENED in the authority (`ab=receiver` →
`ab=shellarmor` at boundary 3 of the SUBJECT arm) and the `.ability` leaf came out identical anyway.
The rule now refuses an ally whose ability is the swapper's.

**And a fourth, smaller one, recorded rather than quietly corrected.** Screen Cleaner's first setter
was AURORA VEIL, whose own `onTry` is `return this.field.isWeather(['hail','snowscape'])`, so on a
clear field the screen never went up and the row read THE PRECONDITION DID NOT LAND. The first
narrowing looked for a literal `return false` and MISSED it, which is why the clause is now the
PRESENCE of any `onTry*` handler: a gate this rule cannot read is a gate it must not stage under.

**A fifth, about the comparator rather than the fixture.** Stalwart's first precondition read the
`followme` volatile off Showdown's active row. `board_state.js` publishes nine named per-body
volatiles and `followme` is not one of them, so the clause failed on a board where the redirector was
standing there with the volatile up. Showdown's own spent-PP meter is compared, is per move id, and is
the receipt.

## The two measured refusals

- **`frisk`** — its ONLY handler is an `onStart` whose entire body is `this.add(...)`. It emits a
  protocol line and writes no state anywhere; `board_state.js` compares species, hp, status,
  status_counter, item, last_item, ate_berry, types, ability, boosts, nine per-body volatiles, PP,
  screens, hazards, tailwind and the field, and NOTHING in that set is written by `Battle#add`. The
  foes' `item` leaves are identical in both arms by construction, because this ability reveals an item
  and moves none. Same refusal as Anticipation and Forewarn, reached by derivation rather than by name.
- **`goodasgold`** — above. Both in-play controls are Status moves at the carrier and its only carrier
  holds it in ability slot 0 with nothing beside it. What WOULD open it is a swapper carrying an
  ability that pierces `breakable`, which is a change to the derived `SWAPPER` and its own batch.

## What is still unstaged, and the measured reason

**Items: none. Moves: 7 COULD-NOT-STAGE, unchanged and re-read** — `focusenergy` IS the control click,
`struggle` is disabled while any move is usable, `extremespeed`/`iceshard`/`jetpunch` keep the MEASURED
`wideAbility` refutation, `upperhand` reads a target's priority intent, `ragingbull` is forme-keyed
with no flip ability.

**Abilities — 2 CONTROL-NOT-QUIET, unchanged:** `magmaarmor` and `opportunist`. Left alone for the
fifth pass running, and the brief said so: #608's fix is a change to the quiet set and making it in
the same pass as a nineteen-row move would leave neither attributable.

**Abilities — 10 COULD-NOT-STAGE, and NOT ONE of them now reads `THE STAGING IS INERT`:**

| row | rule | the measured reason |
|---|---|---|
| `frisk` | the new rule | the effect is a protocol line; no compared leaf can carry it |
| `goodasgold` | the new rule | the ability refuses both in-play controls; dumped, both arms |
| `aerilate` | `ability/type-conversion` | no unconverted-type delivery move exists against either body the conversion is worth anything on |
| `angerpoint` | `ability/reacts-to-an-event-…` | the crit has to land on its OWN holder and no control stays out of the way |
| `sniper` | `ability/prices-a-critical-hit` | it only PRICES a crit somebody else obtained; all three roads shut |
| `quickfeet` | `ability/conditional-speed` | its gate needs a status and every road puts a SECOND Speed modifier on the body |
| `galewings` | `ability/priority-mod` | the delivery table hands it a move Talonflame does not learn; a learnset-aware delivery pick is owed |
| `ripen` | `ability/stat-drop-reaction` | its boost hook fires only for a berry's own boost |
| `simple` | `scope/in-scope-no-sheet-body` | in scope as CONFERRED; this roster has no conferral rule |
| `zerotohero` | `ability/entry` | `failskillswap` AND `cantsuppress` are both set; all three control shapes are shut by the regulation |

**`ripen` is worth one line, because this pass nearly took it.** Its `onEatItem` half doubles a berry
HEAL and is exactly the Cheek Pouch fixture; it did not move because `ability/damage-taken-scoped`
owns it several rules above and the new rule never sees it. That is a re-ordering question, not a
fixture question, and it is left for a pass that can attribute it.

## The gate, run at the end of this pass

```
  GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld
    PASS  deliberate roster / items      clean: 148 of 148 tested
    PASS  deliberate roster / abilities  clean: 183 of 200 tested. 2 row(s) count in NEITHER column — the control arm is itself a live ability: magmaarmor, opportunist
    PASS  deliberate roster / moves      clean: 487 of 497 tested
```

`engine/quarantine.js` **exit 0, all nine clauses PASS.** Board-material **0 of 961** with every
compared turn boundary in every game identical, narration **ZERO undeclared across 961**, damage
differential **0 of 6000** at the midpoint and at both corners and all fourteen interior indices.
End state **960 SAME-END-STATE / 0 DIFFERENT / 0 ENDED-APART / 1 THREW**, protocol never parted in
961 of 961.

**THE GATE WAS CLOSED IN BETWEEN, ON PURPOSE, AND THAT IS THE PROCESS WORKING.** The moment the
release was cut, three clauses read *"MEASURED AGAINST A DIFFERENT ENGINE"* and WITHHELD every count
in `data/engine-diff.json`, `data/game-differential.json` and `data/all-mechanics-fire.json` rather
than repeating a figure about other bytes. All three were re-run on `48ac1c228e02` in this pass:
6,000 damage comparisons, 961 whole games (`--steering empirical --arm middle --end-state --games 1200
--team-store data/team-pool-frozen`, the same flags the previous run used) and 4,702 mechanics games,
0 threw. The census was re-derived from scratch and is **883 probed / 883 live / 0 missing — unmoved**.

`engine/quarantine.js` prints a `STALE VERDICTS` note because `data/register-reality.json` predates
this pass's ROADMAP edit; it is not a gate clause and it clears on `node engine/register_reality.js`.

## Releases cut

**One: `48ac1c228e02`**, for the sleep-counter fix above — the only engine byte changed in this pass.
`engine/engine_release.js list` shows it as the current tree.

**IT IS GITIGNORED AND MUST BE ADDED BY NAME.** `.gitignore:174` ignores `data/releases/`, and the
comment there is explicit: *"When a NEW release becomes evidence for a published number, add it
deliberately: `git add -f data/releases/<id>`."* Every count in this report is stamped with
`48ac1c228e02`, so it is evidence. **This is the third time in three days that a cited release nearly
went unpushed** (`f2849c18`, `a97115a3`), so it is stated here rather than assumed:

```
git add -f data/releases/48ac1c228e02
```

Files touched: `engine/medicham2-browser.js` (the sleep counter, the knob, the `MEDFAILS` counter),
`tests/roster.js` (five new rules, `swapRefused`, `fieldWide`, the two-slot debug dump), the three
roster artifacts (plus `data/roster.json` and the `.prev.json` files), `data/mechanics-census.json`,
`data/all-mechanics-fire.json`, `data/engine-diff.json`, `data/game-differential.json`,
`data/engine-release.json`, `data/forme-assert.json`, `data/provenance-stamp.json`,
`data/published-samples.json` and `data/register-reality.json` (all written by the cut and the gate),
`docs/ENGINE.md`, `docs/ROADMAP.md`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md`, four figures in
`docs/ABRA-whitepaper.md` and this report.

**THE RETRACTION WAS MADE, NOT DEFERRED.** `docs/ABRA-whitepaper.md` carried the roster ability stage
at **164 tested** in four places (three summary tables and the 6.0.0 evidence paragraph) and now reads
**183**. That document is NOT part of the held 7.0.0 set. `tests/test-docs-current.js` went RED on the
stale figure by name and GREEN on the correction: **36 of 37 clauses pass**. The one that does not is
3b(d), and every NEW entry in it is in `docs/ABRA-technical-docs.md` (10) or `docs/MODELS.md` (2) —
**zero lines name `docs/ENGINE.md`, `docs/ROADMAP.md`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md`,
`docs/ABRA-whitepaper.md` or `docs/_reports/`**, which is the whole of what this pass edited. Both
named documents were already modified in this working tree by the HELD 7.0.0 release and this pass was
instructed not to touch them. Flagged here rather than filed, because the pre-commit hook runs this
gate and a red nobody names is how "one of the two known failures" started.

`engine/status.js --write` was **NOT** run: it restamps the generated blocks of all five division
ledgers, four of which are already modified in this working tree by the HELD 7.0.0 release and by
other work. Nothing inside a `<!-- GENERATED -->` block was hand-edited.

Unrelated and NOT from this pass: `docs/ABRA-deck-plain-english.md`, `docs/ABRA-technical-docs.md`,
`docs/MODELS.md`, `docs/SUMMARY.md` and their PDFs are modified in this working tree by the HELD 7.0.0
release, and `docs/MEASURE.md`, `docs/OPS.md`, `docs/SEARCH.md`, `docs/WEB.md` by other work. None was
touched here.
