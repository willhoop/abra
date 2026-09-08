# `item/hp-floor` APPLIED ITS OWN BREAK AND CAUGHT NOTHING — the mechanism, the fix, and what Focus Sash actually does

2026-09-07. ENGINE. Full account. The verdict is at the top of the returned message; this is the
working.

**Pins used for every figure below:** engine release `f30bf025ae28`, census digest `4e024058c29b`
(830 rows, generated 2026-09-07T23:30:24.705Z, identical to the live census — **not regenerated on
this pass**), format `gen9championsvgc2026regmb`, arm `top-tie-first` (the roster's own primary pin).
**No engine byte moved.** Every change on this pass is in `tests/roster.js`.

---

## 1. THE STATE THAT WAS HANDED OVER

`data/roster.items.json` `reds[9]`:

```json
{ "rule": "item/hp-floor", "ok": false,
  "why": "the HP floor stops holding the body up — the item is still held and still read",
  "moved": null }
```

with `plant_anchors {checked: 18, dead: []}` — so the anchor MATCHED exactly once, the engine WAS
deliberately broken, and the stage still reported clean. The rule's only member is `focussash`, and
its row read `FIRED-AND-BOARDS-MATCH`.

Reproduced before anything was touched:

```
tools\lownode.cmd tests\roster.js --stage items --rule item/hp-floor --reds --release f30bf025ae28
  →  THE PLANT ANCHORS   1 of 1 apply exactly once
     FIRED-AND-BOARDS-MATCH   1     Focus Sash  [item/hp-floor]
     NOT CAUGHT item/hp-floor
```

`tests/probe_reds_plant_reaches.js` — which exists precisely to separate "the demonstration is
miswritten" from "the engine genuinely does not react" — was the failing probe:

```
tools\lownode.cmd tests\probe_reds_plant_reaches.js --release f30bf025ae28 --stage items --rule item/hp-floor
  →  NO REACH item/hp-floor      Focus Sash: 0 leaf/leaves
```

So the plant reached OUR OWN board zero times, with Showdown not involved at all. The cancellation
was not in the two-engine comparison. It was in the fixture.

---

## 2. THE MECHANISM — TWO INDEPENDENT FAULTS, AND EITHER ONE ALONE WOULD HAVE HIDDEN THE PLANT

### 2.1 THE FIXTURE NEVER PUT A BODY AT THE HP FLOOR, BECAUSE THE ROSTER'S OWN CONTROL CLICK RETYPED IT

The rule's `note` reads:

> AT THE LINE: meowscarada at FULL takes a lethal X-Scissor (**1.8x its HP**) and must survive;
> whimsicott beside it, chipped 22 off 135 by Aura Sphere, takes a lethal Dire Claw and must NOT

The boards say otherwise. Played clean on `f30bf025ae28`, reading medicham2's and Showdown's boards
at every boundary (both engines identical throughout — this is not a divergence, it is the fixture):

| boundary | meowscarada | its types |
|---|---|---|
| turn 0 | 151/151, Focus Sash | `dark/grass` |
| turn 1 | 151/151, Focus Sash | **`normal`** |
| turn 2 | **82/151**, Focus Sash still held | `normal` |
| turn 3 | **13/151**, Focus Sash still held | `normal` |

`carrierAbility()` handed Meowscarada its **Protean**. The body then clicked the roster's own CONTROL
CLICK — Focus Energy, a Normal-type status move, handed to every derived body so it has something to
do when it must do nothing — and Protean rewrote the carrier `dark/grass → normal` **on the board**.

`lethalMove()` had sized X-Scissor against Meowscarada's DEX typing: Bug is 2x into Grass and 2x into
Dark, so 4x, so 1.8x its HP. Against a Normal-type body the same click is neutral and lands for
**69 of 151 — 0.46x**. `69 x 4 = 276`, `276 / 151 = 1.83`, which is the rule's own 1.8 recovered
exactly. The arithmetic was never wrong; the body was.

**So no body in this fixture ever reached the HP floor, Focus Sash never fired in either engine, and
removing the floor from the simulator therefore moved nothing.** The `FIRED-AND-BOARDS-MATCH` above
it was two engines agreeing about a game the item was not in.

The negative half was broken the same way for a different reason and is worth recording: the chip is
predicted as `22 off 135` by `chipFor(KILLABLE2.species)`, which sizes it off `CAST.ATTACKER()`
(Dragapult) — but the SCRIPT throws it from `CAST.ATTACKER2()` (Weavile), whose special attack is far
lower. It landed for **11**. That one did not hide the plant (Dire Claw still killed the chipped
body), so it is reported and **not fixed here**; see §6.

### 2.2 THE `FIRED` GATE WAS SATISFIED BY THE CONTROL ARM DESCRIBING ITSELF

`runEntryRaw` refuses to grade a row whose staging is inert:

```js
if (!sdMoved.length) return { ...base, verdict: 'COULD-NOT-STAGE',
  why: 'THE STAGING IS INERT. Showdown\'s own board is identical with and without it ...' };
```

That guard should have caught §2.1 on its own. It did not. Measured — the ENTIRE `sd_delta` for the
Focus Sash row before this pass:

```
0  p2.party.meowscarada.item  "focussash" -> ""
1  p2.party.meowscarada.item  "focussash" -> ""
2  p2.party.meowscarada.item  "focussash" -> ""
3  p2.party.meowscarada.item  "focussash" -> ""
```

Four leaves, all of them the held-item field. `board_state.js` writes the held item **twice** — once
on the active slot and once on the party row keyed by species — and `controlOf()` ignored only the
first:

```js
if (sc.kind === 'item') {
  body.item = '';
  ignore.push((sideKey === 'A' ? 'p1' : 'p2') + '.active[' + idx + '].item');
}
```

The control arm takes the item off. The party row says so. `armDelta` counts it. So *"Showdown's board
moved when the item was added"* was **true of every item row in the stage by construction**, and the
inert gate could not fire on any of them.

**This is the more general defect of the two.** §2.1 broke one fixture; §2.2 disabled the guard that
exists to catch exactly that class, across all 148 item rows.

---

## 3. THE FIX

Both changes are in `tests/roster.js`. **The plant was not weakened, not re-aimed, and not touched at
all** — the anchor and its replacement are byte-identical to what was handed over.

### 3.1 A carrier may not rewrite itself as the move leaves

`INTERFERES` — the handler-shaped filter that decides which of a species' abilities may be its derived
quiet carrier — gained `onPrepareHit`.

**Printed before it was wired**, per the standing rule. Asked of the format, not of memory:

```
LEGAL ABILITIES REGISTERING onPrepareHit (3):
  Libero          [onPrepareHit]                          type changes to the type of the move it is using
  Parental Bond   [onPrepareHit,onSourceModifySecondaries] damaging moves hit twice
  Protean         [onPrepareHit]                          type changes to the type of the move it is using
```

All three are disqualifying and **none of them is an over-match**: two are the type rewrite,
the third makes every damaging move hit twice. `QUIET_EXCLUDE` already names this exact class in its
own words — *"rewrites the holder's TYPE ... and a type change is on the board"* — for Multitype and
RKS System. Those two register no handler at all so they had to be named by hand; these register one,
so they are derived.

**Blast radius, measured rather than argued.** Four legal species carry one of the three; two are mega
formes, which `CANDIDATES` already excludes. The change moves two carriers and **no candidate**:

| species | carrier before | carrier after |
|---|---|---|
| Greninja | Protean | Torrent |
| Meowscarada | Protean | Overgrow |

### 3.2 The control arm's own footprint is ignored, in both places it is written

`controlOf()` now also ignores the party-row copy of the subject's held item.

**Measured before it was added**, because a change that could flip greens to COULD-NOT-STAGE is not
one to make on an argument. Across all 148 item rows on `f30bf025ae28`, classifying each row's
`sd_delta` by whether it contains any leaf that is *not* a held-item field:

```
0 of 140 FIRED-AND-BOARDS-MATCH item rows rest ONLY on the held-item leaf.
140 move a leaf the item actually caused.
```

Exactly one row had ever rested on it — `focussash`, before §3.1 — and it no longer does. **The hole
is plugged and no row moves.** The subject's OWN party row only: a held-item leaf on another body is
a real consequence (Symbiosis hands the item on) and stays visible.

---

## 4. RED → GREEN, SHOWN EXPLICITLY

Same command, same release, same pins, only `tests/roster.js` changed:

```
tests\probe_reds_plant_reaches.js --release f30bf025ae28 --stage items --rule item/hp-floor

BEFORE   NO REACH item/hp-floor      Focus Sash: 0 leaf/leaves
AFTER    REACHES  item/hp-floor      Focus Sash: 29 leaf/leaves
         t2 p2.party.meowscarada.hp       clean=1     planted=0
         t2 p2.party.meowscarada.fainted  clean=false planted=true
         t2 p2.party.meowscarada.status   clean=""    planted="fnt"
         t2 p2.active[0].species          clean="meowscarada" planted="corviknight"
```

and in the roster itself:

```
BEFORE   NOT CAUGHT item/hp-floor
AFTER    CAUGHT     item/hp-floor   via focussash -> DID-NOT-FIRE on party.hp, party.fainted,
                                    party.status, species, hp, maxhp, types, ability,
                                    vol.focusenergy, pp.focusenergy, pp.xscissor
```

The planted verdict is `DID-NOT-FIRE` rather than `FIRED-AND-BOARDS-DIFFER` **because of §3.2**: with
the construction leaf ignored, a planted engine that does nothing at all reads as doing nothing at
all. That is the stronger statement of the two and the reds loop counts both.

---

## 5. AND NOW THE QUESTION NOBODY HAD AN ANSWER TO — DOES FOCUS SASH AGREE WITH SHOWDOWN?

**Yes.** All three clauses of the rule now land, and the two engines are identical leaf for leaf on
every one of them.

The rule under test, derived from the format rather than recalled. **Champions does not override Focus
Sash**, checked two ways: the mod overrides eight files under `/data/mods/champions/`, and a `grep`
of its `items.ts` returns no `focussash` entry; and asked of the format directly, the resolved handler
is byte-identical to `Dex.mod('gen9')`'s —

```
legal in format: true   isNonstandard: null
champions onDamage === mainline onDamage: true
```

So mainline governs. `pokemon-showdown/data/items.ts:2265`, the `focussash` block, read to cite it:

```js
onDamagePriority: -40,
onDamage(damage, target, source, effect) {
    if (target.hp === target.maxhp && damage >= target.hp && effect && effect.effectType === 'Move') {
        if (target.useItem()) {
            return target.hp - 1;
        }
    }
},
```

Three conditions and the fixture now exercises all three: the body must be at **full** HP
(`target.hp === target.maxhp`), the hit must be lethal (`damage >= target.hp`), and it must come from
a MOVE. `useItem()` spends it, and the `return` is gated on the spend succeeding.

Measured on the fixed fixture, `f30bf025ae28`, both engines:

| clause | what the board says | medicham2 | Showdown |
|---|---|---|---|
| a FULL-HP body survives a lethal hit at 1 HP, item spent | meowscarada 151/151 → **hp 1/151, item gone** on turn 2 | same | same |
| a body ONE CHIP OFF FULL is **not** saved | whimsicott 124/135 takes a lethal Dire Claw → **fainted**, replaced by corviknight | same | same |
| the survivor is **not saved twice** | meowscarada on 1 HP with the sash spent takes a second X-Scissor → **fainted**, replaced by milotic | same | same |

Row verdict: `FIRED-AND-BOARDS-MATCH`, and it is now backed by a demonstration that goes red when the
floor is removed.

**This is new information.** The previous green proved nothing — §2 is the whole reason. Focus Sash is
one of the most-played items in this format and, until this pass, nothing in this repository had ever
watched it hold a body up **against the authority**. The census had it
(`item / survivesFromFull / "Focus Sash leaves 1 HP from full"`, and a companion row asserting the
half-HP body dies and the item is spent) — but the census probes call into medicham2 and carry their
own typed expectation. Showdown was not in the path. It is now.

**No engine defect was found.** That is the honest headline: the demonstration was blind, the engine
was right.

---

## 6. THE OTHER SEVENTEEN, CHECKED THE SAME WAY

`checked: 18` with one failure means seventeen passed, and the brief is right that "passed" is not
the same as "caught something". Each one names the board leaves the plant actually moved, so the
question is answerable from the artifact rather than from the `ok` flag:

```
CAUGHT item/mega-stone              via abomasite   -> party.species, species
CAUGHT item/resist-berry            via babiriberry -> party.hp, hp
CAUGHT item/drain-scaled            via bigroot     -> party.hp, hp
CAUGHT item/type-scoped-power       via blackbelt   -> party.hp, hp
CAUGHT item/accuracy-scaled         via brightpowder-> party.hp, hp
CAUGHT item/status-cure             via cheriberry  -> party.status, party.item, status, item
CAUGHT item/speed-scaled            via choicescarf -> party.hp, party.fainted, party.status, hp,
                                                       fainted, status, species, maxhp, item, types,
                                                       ability, vol.choicelock, pp.flamethrower
CAUGHT item/extends-a-duration      via damprock    -> field.weather_turns
CAUGHT item/super-effective-power   via expertbelt  -> party.hp, hp
CAUGHT item/hp-floor                via focussash   -> party.hp, party.fainted, party.status, ...
CAUGHT item/residual-heal           via leftovers   -> party.hp, hp
CAUGHT item/all-damage-and-cost     via lifeorb     -> party.hp, hp
CAUGHT item/species-locked-stat     via lightball   -> party.hp, hp
CAUGHT item/cures-a-volatile        via mentalherb  -> party.item, item, vol.taunt, vol.focusenergy, pp.focusenergy
CAUGHT item/category-scoped-power   via muscleband  -> party.hp, hp
CAUGHT item/heals-at-threshold      via oranberry   -> party.hp, party.item, hp, item
CAUGHT item/heal-on-attack          via shellbell   -> party.hp, hp
CAUGHT item/restores-lowered-stats  via whiteherb   -> party.item, party.boosts.atk, item, boosts.atk
```

**None of the seventeen is the same blindness in a different costume**, and there is a structural
reason as well as an empirical one:

- **Empirically**, every one of them names a substantive leaf — HP, a status, a forme, a weather
  clock, a boost, a volatile. The blindness in §2.2 would show as a plant whose only moved field is
  a held-item leaf; no row has that shape. `item/status-cure`, `item/heals-at-threshold` and
  `item/restores-lowered-stats` each name `party.item` **beside** a status, an HP and a boost
  respectively — those are genuine consumption, observed alongside the effect that caused it.
- **Structurally**, the reds loop reads `br.subject_diffs` — the two-engine comparison in the PLANTED
  arm — and not `sd_delta`. The §2.2 leak lives in `armDelta` and never entered the reds fields at
  all. The two faults compounded on `item/hp-floor` and only one of them can touch the other
  seventeen.

`item/all-damage-and-cost` is the one row that still reads `FIRED-AND-BOARDS-DIFFER` under its plant
rather than `DID-NOT-FIRE`, and that is its rule working as written: its break drops the damage
multiplier and deliberately leaves the self-cost standing, so our engine's board still moves. Stated
in the rule's own `break.why`.

**Zero `NOT CAUGHT` across all three stages** on this release: items 18 of 18, abilities 40 of 40,
moves 36 of 36.

---

## 7. WHAT MOVED, AND WHAT DID NOT

Every stage re-run with `--reds --write --release f30bf025ae28`:

| clause | before | after |
|---|---|---|
| roster / items | **FAIL** — 140 of 148, 0 DIFFER, 0 DID-NOT-FIRE, **1 red demonstration did not behave as its rule predicted** | **PASS** — clean: 140 of 148 tested |
| roster / abilities | PASS — 146 of 202 | **PASS — 146 of 202, unchanged** |
| roster / moves | PASS — 487 of 500 | **PASS — 487 of 500, unchanged** |
| whole-game BOARD-MATERIAL | PASS — 0 of 958 | **PASS — 0 of 958, untouched** |
| whole-game NARRATION | FAIL — 63 of 961 | FAIL — 63 of 961, **not this pass's** |
| census live | 830 of 830 | **830 of 830, not regenerated** |

Counts in full, all three stages, after the fix:

```
items       0 DIFFER   0 DID-NOT-FIRE   0 DEFERRED   140 MATCH    0 CONTROL-NOT-QUIET    8 COULD-NOT-STAGE  / 148
abilities   0 DIFFER   0 DID-NOT-FIRE   1 DEFERRED   146 MATCH   45 CONTROL-NOT-QUIET  124 COULD-NOT-STAGE  / 316
moves       0 DIFFER   0 DID-NOT-FIRE   3 DEFERRED   487 MATCH    0 CONTROL-NOT-QUIET   10 COULD-NOT-STAGE  / 500
```

**The gate now reads 8 of 9 PASS.** The remaining failure is `whole-game NARRATION`, which is another
agent's.

**BOARD-MATERIAL WAS NOT RE-MEASURED AND DID NOT NEED TO BE.** `git diff --stat engine/` is empty —
no engine byte moved on this pass, and `data/engine-release.json` still points at `f30bf025ae28`.
`engine/game_differential.js` reads the simulator out of the frozen release and does not read
`tests/roster.js` at all, so the figure is structurally untouched rather than assumed untouched.

**THE CENSUS WAS DELIBERATELY NOT REGENERATED.** No probe and no engine mechanic changed, so
`tests/test-mechanics.js` would write 830 identical rows with a new `generated` timestamp and a new
digest — and that digest is the pin (`4e024058c29b`) steering the standing board-material sample.
Rewriting it would break the pin's comparability to buy nothing. `data/mechanics-census.json` is
untouched in `git status`.

---

## 8. OWED, NAMED, NOT FIXED HERE

- **`chipFor()` SIZES THE CHIP OFF THE WRONG ATTACKER.** It computes `maxRoll(CAST.ATTACKER(), mv, def)`
  while the `item/hp-floor` script throws the chip from `CAST.ATTACKER2()`. Measured: predicted 22 off
  Whimsicott, landed 11. It does not hide anything today — the chipped body still takes a lethal hit
  and still dies — but the rule's printed `note` states a number the game does not produce, and a
  fixture whose stated margin is 2x off is one bulk change away from being wrong in the direction that
  matters (a chip that kills, or one that rounds to zero). One-line fix, its own pass, because it
  changes what every `KILLABLE2` fixture stages.
- **THE CONTROL ARM ONLY STRIPS THE ITEM FROM THE SUBJECT.** `item/hp-floor` puts the item on `b0` AND
  `b1`; `controlOf` removes it from `b0` only, so the negative body holds a Focus Sash in both arms
  and cancels out of the delta entirely. The two-engine comparison still covers it (which is why the
  negative clause in §5 is a real result), but the "the SAME scenario with no item at all comes back
  THE STAGING IS INERT" selftest is asking a narrower question than it reads as asking.
- **THE INERT-CLICK ASSERTION IS PROVED ON THE CAST, NOT ON THE DERIVED CARRIERS.** The selftest shows
  Focus Energy moves no board leaf in either engine — on the fixed cast bodies. Protean was a derived
  carrier, and on it the control click moved `types`. That is the general form of §2.1 and there may
  be other abilities for which the roster's control click is not inert; `onPrepareHit` closes the
  three that rewrite or duplicate, and nothing has enumerated the rest.

---

## 8b. A RED INSTRUMENT I DID NOT CAUSE AND DID NOT FIX — `tests/probe_red_demo.js`, EXIT 1

Reported rather than filed, because "known failure" is a banned phrase here.

```
200 demonstrations: 2 HOLLOW, 15 COULD NOT BE APPLIED, 2 not in this format
ABRA-EXIT 1 VERDICT-RED
```

**Fifteen certificates whose patch no longer matches the engine** — WIRE 117, 121, 129, ROADMAP #81
WIRE 2 / 7 (x3) / 8 (x2) / 9 / 10 (x4), and ROADMAP #84. The file says it itself: *"Each one needs its
edit re-aimed at what the engine says TODAY. Until then it has not run, and a certificate that has not
run is not a certificate."*

**It is the same defect class this whole pass is about, one file over** — a plant whose anchor has
drifted is a check that cannot fail. It is not the same INSTANCE: `item/hp-floor`'s anchor matched
exactly once and the plant landed, which is strictly worse than an anchor that misses and says so.

**It is pre-existing and this pass provably did not cause it.** `probe_red_demo.js` reads
`engine/medicham2-browser.js`, `engine/tags.js`, `engine/mc_key.js`, `data/engine-data.js` and
`data/tags.json` from the LIVE tree. `git status --porcelain` over exactly those five paths is
**empty** — none of them moved on this pass, so the probe's verdict is byte-for-byte the verdict it
gave at `b8c123cb`. The engine moved a great deal today under other agents (batches J, K, the narration
batch, the horizon change); that is where the fifteen anchors drifted.

**And nothing surfaces it.** `tests/run-all.js` deliberately does not wire it — the entry at
`run-all.js:449` says so and points at `engine/register_reality.js` as its runner — and
`node engine/status.js` currently prints `PASS  no open, known engine defect`. So a red instrument is
sitting outside every clause anybody reads, which is the shape of the finding rather than an aside.
**Not mine to repair in this pass**: fifteen re-aims against engine internals that other agents hold
tonight is a batch of its own, and re-aiming an anchor while somebody else is moving the line is how
they went stale in the first place.

## 9. COMMANDS, VERBATIM

```
MSYS_NO_PATHCONV=1 SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  cmd.exe /c "tools\lownode.cmd tests\probe_reds_plant_reaches.js --release f30bf025ae28 --stage items --rule item/hp-floor"

MSYS_NO_PATHCONV=1 SHOWDOWN_PATH=... cmd.exe /c "tools\lownode.cmd tests\roster.js --stage items     --reds --write --release f30bf025ae28"
MSYS_NO_PATHCONV=1 SHOWDOWN_PATH=... cmd.exe /c "tools\lownode.cmd tests\roster.js --stage abilities --reds --write --release f30bf025ae28"
MSYS_NO_PATHCONV=1 SHOWDOWN_PATH=... cmd.exe /c "tools\lownode.cmd tests\roster.js --stage moves     --reds --write --release f30bf025ae28"

node engine/status.js
```

`--reds` is not the default and `--write` without it stamps `reds: []`. All three writes above carry
it; `data/roster.items.json` now reads `plant_anchors.reds_ran: true`, `18` red rows, **`0` not ok**.
