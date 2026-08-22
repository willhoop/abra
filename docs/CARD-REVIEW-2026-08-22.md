# THE CARD REVIEW — 2026-08-22


**Will read the 40 divergence cards in `data/divergence-turns.json` and found roughly twenty distinct
root causes in about an hour.** The automated class rollup over the same run had them bucketed as
*"`-fail` 7 games"* and *"ordering 29 games"*. This file records every finding so none is lost before
it reaches the register; each is destined for a ROADMAP row.

Measured on release `6a05dd9ad60d`, census pin `2cab3179f5fc`, `--team-store data/team-pool-frozen`,
961 games, 133 diverged. Card numbers are the rendered viewer's; indices are into `divergences[]`.

---

## WHY READING CARDS BEAT THE ROLLUP, AND WHAT TO DO ABOUT IT

**The class name describes the COMPARATOR, not the defect.** `event missing from medicham2` means
"the authority emitted a line and we did not" — that is a property of the *diff*, and it is the same
sentence whether the cause is Encore's failure condition, Imposter's transform announcement, or a
Life Orb recoil. Two defects with nothing in common land in one bucket, and one defect can land in
several buckets depending on which line happened to differ first. So the rollup can only ever tell you
how the comparator classified things.

**A human groups by MECHANISM instead.** Will recognised *Encore*, *Roost*, *Toxic Debris*,
*Matcha Gotcha* on sight and asked the question the class name cannot ask — *why would that fail?*
That is why 40 cards yielded ~20 roots where 5 generic buckets yielded none.

**And the rollup's ranking is actively misleading, twice over** (both measured, not argued):
- `max_uses` is the max over **both** lines of a pair, so the head of a usage-ordered list can name
  the line **we** emitted rather than the one that differs. The report's own head read
  *"126,170 clicks, Protect"* when the missing line was `-start|typechange|[from] protean`.
- A species carries `uses: null`, printed as **0** (`game_differential.js:415`). So the Kingambit
  `fallen` family sat at the *bottom* of a usage-ordered list while covering **31.4%** of games.

**THE ACTION: dump far more cards.** `--dump-games 40` sampled 40 of 378 diverging games. The cost of
a card is a few hundred bytes; the cost of a missed root cause is an evening. Raise it to the low
hundreds and render with `engine/divergence_cards.js`. The viewer is the highest-yield instrument in
this repository and it was being run at ~10% of its useful size.

---

## A. ORDERING — the authority has a declared resolution order and we use a different one

These interact; they are one derivation, not four.

### A1. `onDamagingHit` is wrong twice — ORDER and FREQUENCY
`sim/battle-actions.ts:1099` runs `secondaries()`; `:1121` runs `runEvent('DamagingHit')`. **Secondaries
resolve FIRST.** We have it reversed (card 29: Flare Blitz's burn vs Stamina's Defense boost).
**And the frequency is also wrong**: the authority fires it after *each hit* of a multi-hit, we fire
once at the end (card 37: Toxic Debris lays a layer per hit; we lay after Dual Wingbeat completes).
**20 legal abilities** ride this hook: Aftermath, Cursed Body, Cute Charm, Effect Spore,
Electromorphosis, Flame Body, Gooey, Illusion, Innards Out, Justified, Mummy, Poison Point, Rough
Skin, Sand Spit, Spicy Spray, Stamina, Static, Toxic Debris, Wandering Spirit, Weak Armor.
**Several are board-material, not cosmetic**: Aftermath and Innards Out deal damage (so the attacker's
HP when the secondary lands differs), Weak Armor changes Speed (feeding turn order), Cursed Body
disables a move, and **Mummy overwrites the attacker's ability** — landing it before a secondary the
*new* ability would have modified resolves that secondary under the wrong ability entirely.

### A2. `onSwitchInPriority` is not modelled at all
Cards 26/27. Showdown sorts switch-in effects by a declared per-ability priority **before** speed;
speed is only the third tiebreak (`comparePriority`: order → priority → speed). We sort by speed alone.
Sixteen abilities declare it in mainline, Champions overrides none, and **five have legal carriers**:

| ability | priority | carriers |
|---|---|---|
| Unnerve | +1 | 6 — Arbok, Aerodactyl, Houndoom, **Tyranitar** … |
| Klutz | +1 | 3 — Lopunny, Audino, Golurk |
| Mimicry | −1 | 1 — Stunfisk-Galar |
| Forecast | −2 | 4 — Castform + formes |
| Hospitality | −2 | 2 — **Sinistcha**, Sinistcha-Masterpiece |

Card 26 is the proof: Torkoal is base-20 Speed and Sinistcha base-70, yet Drought fired first because
Hospitality carries `-2`. **We put the faster body first and got the reverse.** Same family as the
Intimidate-vs-Drizzle card.

### A3. Faint announcements are inline; the authority batches them
`this.add('faint', pokemon)` lives **inside `faintMessages()`** (`sim/battle.ts:2549`), called from
`runAction` at `:2832` — **after the action completes**. So Showdown finishes the move's own
consequences first (recharge flag, Stone Axe's hazard, Fling's item) and announces deaths after.
We announce at the moment of lethal damage (cards 28, 34).
**Two consequences beyond the ordering:**
- `faintMessages(lastFirst = false, …)` — the `lastFirst` argument is why Final Gambit faints the
  **user** before the target on the authority and the reverse here.
- **It also fixes a wording difference for free.** `Pokemon#toString()` returns `p2a: Name` while
  active and bare `p2: Name` once not, and `faintMessages` sets `isActive = false` (`:2563`). So the
  authority's `-hitcount` names an already-dead body (`p2: Azumarill`) and ours names a live one
  (`p2a: Azumarill`). **One root, two visible symptoms.**
- **Likely worth more than its card count**: a faint announced early shifts every line after it, so
  games currently filed under other classes may be downstream of it. Imposter predicted ~10 and
  delivered 13 for exactly this reason.

### A4. A berry is eaten before upkeep and before faints — THIS ONE CHANGES WHO SURVIVES
Card 30. The authority's residual case:
```js
case 'residual':
  this.fieldEvent('Residual');          // poison, sandstorm, Leftovers
  if (!this.ended) this.add('upkeep');  // the turn-end marker
  break;
...
this.faintMessages();                   // deaths processed HERE
...
this.eachEvent('Update');               // Sitrus (onUpdate) fires HERE
```
Sitrus hooks `onUpdate`, so it eats **after `|upkeep` and after faint processing.** We eat before both.
**Two ways it changes the board, not the narration:**
- A body that residual damage would kill is dead before the berry can be eaten on the authority. If we
  eat during the residual sequence it heals above zero and lives.
- With several residuals in sequence, eating mid-sequence gives a bigger HP pool to every residual that
  follows. Body at 20, poison 15 then sandstorm 7: authority 20 → 5 → 0 **dead**; ours 20 → 5 → berry
  36 → 29 **alive**.

**NOT a defect, checked and correct:** the residual ORDER itself. `data/residual-order.json` carries
sandstorm at `order 1` / `onFieldResidual` and Leftovers at `order 5 / subOrder 4`, derived from the
authority, and `medicham2-browser.js:4455` reads the numbers from that file rather than hardcoding
them. Sandstorm chip lands before a Leftovers heal exactly as it should. Snowscape and Rain Dance
carry the same order-1 stamp. **Will raised this as the KO-flipping hazard; the residual half is
sound and the switch-in and berry halves are where it actually bites.**

---

## B. DICE — the formula is right and the draw is not

### B1. Multi-hit damage does not use the authority's roll scheme — PROVED
Cards 38/39. `Battle#randomizer` is `tr(tr(base * (100 - random(16))) / 100)` — **sixteen discrete
values, 85%–100% of the base.** Twin Beam is the clean case: both hits are 40 BP, so the base is
identical for both.
```
SHOWDOWN : 185 → 130 → 75    hits of 55, 55   (one base, same index twice)
MEDICHAM : 185 → 125 → 75    hits of 60, 50
```
**No single base can produce both 60 and 50 under that scheme.** 60 requires `B ≥ 60`; 50 requires
`trunc(B×0.85) ≤ 50`, i.e. `B < 60`. Contradiction. So either our base changes between hits of a
constant-BP move, or our roll is not the sixteen-index draw.
**This is the residue of a fix that already landed.** ROADMAP #304 corrected exactly this for the
single-hit path — *"a uniform draw over the integer span; Showdown's is one of sixteen floored
indices"* — and a uniform draw **would** produce 60 and 50 from one base, because it can hit any
integer in the interval. The multi-hit path appears never to have been converted. It also explains
Will's observation that it "evens out": a uniform draw is unbiased about the same mean, so totals
converge while individual hits scatter.

### B2. The confusion self-hit draws a different roll
Card 36. **Our formula is correct and well-documented** (`medicham2-browser.js:11388`): no STAB, no
type chart, no crit, no screen, no burn, sixteen sides at `85+r` — matching `getConfusionDamage`
(`battle-actions.ts:1850`), with one gap *declared* rather than hidden (an `onModifyAtk` ability — a
burned Guts body hits itself harder). The move is typed `'???'`, so **no item or type boost can reach
it** — that hypothesis is ruled out. 108 → 75 on the authority against 108 → 78 here is 33 vs 30, and
30/33 = 0.909 sits inside the 85–100% band, so it is a **different index, not a different multiplier**.
Note the authority takes **two** draws here — `randomChance(33,100)` for whether to self-hit, then
`randomizer(damage)` — so a different order or category shifts every later address too.

### B3. A per-target secondary lands on the wrong body
Card 40. Muddy Water is a spread move with a 30% accuracy-drop secondary rolled **per target**.
Showdown dropped Spiritomb's accuracy; we dropped Snorlax's. Same shape as ROADMAP #294 (*"the
accuracy roll was one per move where the game rolls one per target"*).
**The sleep difference in that same card is probably DOWNSTREAM of this** — once a secondary fires on
a different body the addresses shift — so do not treat it as an independent defect until B3 is fixed.

### B4. Sleep — verify the draw, the distribution is already right
**Champions overrides `slp`** and uses `this.sample([2, 3, 3])` (*"1/3 chance for a Pokemon to wake up
on turn 2"*), where mainline uses `this.random(2, 5)` → {2,3,4}. Different distribution **and** a
different draw shape (`sample` calls `random(3)`). Our `SLEEP_TURNS_LOST = 1 + 2/3` is exactly the
expected value of `sample([2,3,3])` — (⅓×1)+(⅔×2) = 5/3 — so the distribution is modelled correctly.
**Whether the draw is addressed identically is unverified.** Reading mainline here is the documented
way to be wrong.

---

## C. DERIVATION GAPS — a fact that exists in the authority and has no representation on our side

The recurring shape: when a fact lives in a **handler** rather than a declarative field, `tag_dex`
does not pick it up, and the roster then credits the entity clean because nothing staged the
condition. Joins #317 (Fur Coat: `breakable` tag, no multiplier) and #312 (Sand Force).

### C1. `onTryImmunity` is not derived — 6 legal moves
Card 35. Endeavor's gate is `onTryImmunity(target, pokemon) { return pokemon.hp < target.hp; }` —
returning false produces a **type-immunity-style block** (`|-immune|`), not `|-fail|`. Both bodies were
at 135/135 (Whimsicott and Raichu share max HP at L50/0EV), `135 < 135` is false → immune. We ran the
`damageCallback` (`target.hp - pokemon.hp` = **0**) and announced a zero-damage line ("drops to 100%").
Our tags for `endeavor` carry no immunity condition at all.
**Legal moves on this hook: Attract, Endeavor, Leech Seed, Switcheroo, Trick, Worry Seed.**
**Trick and Switcheroo matter most** — a wrong immunity gate means an item swap that should be blocked
goes through, which is board-material.
**WILL'S REQUIREMENT, and it is the discipline that got the last `-fail` attempt retracted: stage the
POSITIVE arm too.** Three cases, all three asserted:
- user HP **>** target HP → `|-immune|`, no damage line
- user HP **=** target HP → `|-immune|` too, the gate is strict `<` *(the 135/135 case, easy to miss)*
- user HP **<** target HP → **it works**: target drops to exactly the user's HP, real `-damage` line

A test that only proves the immunity is a test that ships an Endeavor which never works.

### C2. Life Orb's recoil is stored as prose
Card 24-region (index 37). `tags.json` gives `lifeorb` → `{"damageMultAll":{"mult":1.3,
"costsPerAttack":"1/10 max HP"}}`. **The multiplier is machine-readable and the cost is an English
string**, so nothing can derive the recoil from the tag and whatever applies it is hardcoded elsewhere
— which is why it fires in two cards and not in a third. Gholdengo landed a resisted Shadow Ball and
never paid its 16 HP; the stream runs to `|upkeep` with no Life Orb line at all, so it is absent for
the turn, not merely late. **Life Orb appears in 17,168 of 19,401 bo3 games**, and the roster credits
it `FIRED | diverged false`.

### C3. Spread-drain heals are merged — arithmetic, not just narration
Card 1 (index 0). Showdown heals **per target**, interleaved; we heal once at the end and drop the
`[of]` attribution. **The arithmetic is merged too**: `dealt` accumulates across targets
(`medicham2-browser.js:19163`, `+=` at `:19758`) and the drain heals `round(dealt × ½)` once, where the
authority rounds per target (`battle.ts:2168`). Those disagree **exactly when both hits deal odd
damage — 25.0% of two-target spread drains — and we heal 1 HP less.**
Legal spread-drain moves: **Matcha Gotcha (8,182 uses)** and **Parabolic Charge (151)**; Parabolic
Charge is `allAdjacent`, so up to three drains.

### C4. Guard Dog — RETRACTED, NOT A GAP

I filed this as a missing derivation. **It is not.** `tests/test-tag-params-derived.js` proves the
predicate already covers it: *"Guard Dog's `onDragOut` is byte-identical to Suction Cups' once the name
is stripped — so the derivation already covers it, and its absence is the legality filter (0 legal
carriers)."* The row is absent because Guard Dog has **zero legal carriers in Reg M-B**, and a
regulation that brings one would pick it up automatically.

**Adding the row by hand would have REVERSED ROADMAP #175** — this repo's rule is match on tag SHAPE,
never on a name, precisely so an entity added later needs no edit. My "fix" would have been the defect.

The derived facts in C4 stand and are worth keeping: exactly two abilities and one move carry
`onDragOut` in the whole authority — **Suction Cups** (legal, one carrier: **Malamar**), **Guard Dog**
(zero legal carriers), **Ingrain** (legal move, zero legal species can learn it here). Champions
overrides none. That is why E2 — Dragon Tail and Circle Throw ignoring Suction Cups — is the only
member of this family that can actually fire.

---

## D. ANNOUNCEMENT SHAPE — RETRACTED. THE COMPARATOR NORMALISES ALL OF IT

**I filed two findings here and both are wrong. Recorded rather than deleted, because the reason I
was wrong is the useful part.**

`game_differential.js`'s reducer carries explicit rules that erase exactly these differences before
anything is compared:

- **`display-flags`** (`:1623-1629`) strips `[silent]`, `[still]`, `[miss]`, `[spread]` and `[anim]`
  as *"rendering hints"*, on the argument that the state each decorates is a separate event that is
  kept — `-miss` for a miss, one `-damage` per body actually hit for a spread.
- **`move-target-field`** (`:1631-1640`) does `f.slice(0, 4)` on any `|move|` line, dropping the
  target field entirely. **Its own `equal` example is literally the Mortal Spin case**:
  `|move|p2b: Garchomp|Rock Slide|p1b: Kingambit|[spread] p1a,p1b` is declared EQUAL to
  `|move|p2b: Garchomp|Rock Slide|p2b: Garchomp`. The argument is that *who was actually hit* lives in
  the `-damage`/`-status`/`-unboost` lines that follow, which are kept and compared body by body, so a
  redirection bug is caught one line later rather than not at all.
- The `-sidestart` rule (`:1620`) declares `|p1: A|Reflect` EQUAL to `|p1: |move: Reflect`.

**So: the missing `[spread]`, the different nominal target, and the missing side name are all real in
the raw stream and NONE of them can cause a divergence.** They are worth fixing for a human reading a
card and for nothing else. Card 37's actual first divergence was the `-immune` line, not the Mortal
Spin line.

**AND THE SAME ERROR NEARLY DERAILED THE ENCORE FIX.** I sent that agent an urgent "critical
refinement" arguing its fix would measure as no improvement because the `|move|` line differs one line
earlier than the `-fail`. **That was false for the same reason** — the reducer strips `[still]` and the
target field, so the instrument never saw it. The agent checked rather than accepting it, and said so.

**THE LESSON, WHICH IS THE POINT OF KEEPING THIS SECTION:** a raw-stream difference is not a
divergence. The reducer is the thing that decides, it is 20-odd declared rules with worked `equal` and
`distinct` pairs beside each, and **it must be read before any raw-line observation is called a
defect.** Two of the twenty findings in this file were raw-stream noise and I did not check.

---

## E. STATE AND BOOKKEEPING

### E1. Bench ORDER diverges — the drag die is the only thing that indexes into it
Diagnosed 2026-08-22, **die hypothesis REFUTED**: both engines roll a uniform die, consume exactly one
draw, and under pinned dice draw the **same value at the same address**. What differs is the **order of
the list the die indexes into**. `sim/battle-actions.ts:125-132` **swaps** the outgoing body into the
arriving body's party slot; we remove-and-append. Measured: **34.8% of side-boundaries hold the same
bench in a different order, and 0 of 3,118 index positions map to the same body** — zero fixed points,
so a uniform index disagrees with probability 1.
**Invisible to both instruments by construction**, which is the important part: the protocol comparison
sees no line, and `board_state.js`'s `partyMap` keys the party **by species** — correctly, because
index-keying manufactured a divergence in **123 of 179 games**. The same choice makes it blind to
*where* a body is standing.
**Blast radius larger than the drag**: `bringIn`'s default replacement is `_live(bench)[0]`, so
reordering moves every faint replacement and every pivot without an explicit target — in rollouts and
in `board.js` features. Measure it; do not assume it neutral.

### E2. Dragon Tail and Circle Throw ignore Suction Cups — CONFIRMED, probed red
The phaze branch reads `refusesForcedSwitch` (`:16406`); the damaging branch (`:21786-21798`) does not.
Staged: Tyranitar Dragon Tail into Malamar — the authority emits `|-activate|p2a: Malamar|ability:
Suction Cups` and nobody moves; we emit `|drag|p2a: Snorlax`. **Malamar is the only legal carrier and
is brought 1,340 times** across the two human stores.

### E3. Our phaze refusal emits an EXTRA `-fail` — the mirror image of the Encore family
Ours prints `-activate … suctioncups` **plus** `|-fail|p1a: Tyranitar`; the authority prints only the
`-activate`, because `onDragOut` returns **`null`** and `battle-actions.ts:1361` writes `-fail` only on
`hitResult === false`. **`null` = handled, stay silent; `false` = failed, announce it.** We are silent
where we should speak (Encore/Yawn/Roost) and speaking where we should be silent (here) — consistent
with having no model of that distinction. Ours also prints the raw id `suctioncups` where the authority
prints `Suction Cups`.

### E4. A corpse sits in one of our active slots
`fainted=true` together with `where=active` on a Dragonite. Showdown sets `pokemon.isActive = false`
inside `faintMessages` (`sim/battle.ts:2563`); we leave the body in the active array until something
replaces it. **Confirmed real state, not a labelling artifact** (`rosterSnapshot` reads membership of
`S.actB`). **NOT the cause of card 25** — see F1 — and in the repaired game it produced zero divergent
lines, so it is flagged rather than claimed.

### E5. Morpeko — switch order, and a forme with nowhere to land
10 games of the `event missing` class, *every one naming Morpeko*. Card 21 is switch **order**:
`|switch|p2b: Morpeko` first on the authority, `|switch|p2a: Espathra` first here. **Speed does not
explain it** — Morpeko is 97 and Espathra 105, both engines agree on the numbers, and the authority put
the *slower* body first. Sits alongside **ROADMAP #204**: `data/engine-data.js` carries no row for
`morpeko-hangry` (nor `mimikyu-busted`, nor the Castform formes), so **Hunger Switch cannot be asserted
at all** — a forme we cannot represent is a forme we cannot announce changing into. #204 records that
`engine-data.js` was deliberately not regenerated because a previous agent hit the same wall.

### E6. Volatile counters — do they tick and expire on the same turn?
Three cards, three counters, one question. Showdown announces the lifecycle and we are silent:
`-end … Infestation [partiallytrapped] [silent]` ×2 and `-end … Throat Chop` ×1. **The state behind
them IS compared** — `board_state.js:661` reads `trapped_by_move`, and the file notes the victim's half
is *"the half that decides whether a switch is legal"* — but `probe_bench_plants.js` lists **a MOVE TRAP
counter off by one** among its 19 applied-and-not-caught plants (7 of 8 pairs catch it). So the
comparator reads the field and mostly detects a lie about it, and its own proof is not clean.
**An unannounced expiry at the right moment is cosmetic; one a turn late is a body that cannot switch
when it should.** Infestation blocks switching, and Perish Song's last tick kills — `duration: 4`, the
cast-time `perish3` is `[silent]`, and the residual prints whatever the counter now reads, one step per
end-of-turn. Stage each, run to expiry, assert both engines end on the same turn.

---

## F. THE INSTRUMENT ITSELF

### F1. THE HARNESS MANUFACTURES DIVERGENCES — fix this before measuring anything else
`engine/game_differential.js:3398-3405` mirrors our actives into Showdown's replacement choice and its
fallback **has no memory of what the other slot just took**:
```js
let j = want == null ? -1 : side.pokemon.findIndex(q => !q.isActive && !q.fainted && id(q.species.id) === want);
if (j < 0) j = side.pokemon.findIndex(q => !q.isActive && !q.fainted);   // <- no `claimed` set
```
On a double KO with one body left it sends `"switch 4, switch 4"`. Showdown refuses
(*"The Pokémon in slot 4 can only switch in once"*) **eight times**, and **the return value of
`battle.choose` is discarded on that path**, so the refusal is swallowed. Showdown then waits forever
for a legal replacement and the next loop reports `showdown stopped asking for a move`.
**Card 25 was entirely this.** With the choice repaired to `"pass, switch 4"` the two engines agree on
**all 136 lines** and both end the battle with the same winner. There was never an engine defect in it.
`chooseAction:3660` already carries a `claimed` set — this path needs the same, and must stop
discarding `choose`'s return. Target behaviour: answer `pass` for a slot we could not fill.

### F2. The roster credits Spiky Shield on a scenario that cannot fail
`all_mechanics_fire` reports `spikyshield` as `RESOLVED / NO-DIVERGENCE` with **`setup: []`** — nothing
attacks into it — and `volatile:spikyshield` / `volatile:stall` both marked **uncomparable**. So
`punishesContact` (`{onContact:true, fraction:8}`, correctly derived) never fires in that row.
**The census does cover it, and well** — 40 rows touch protect/shield/stall, including *"Spiky Shield
hurts the attacker it blocked"* with a Protect control that must toll **0** while Spiky Shield tolls 22,
*"a Spiky Shield answers before the type chart"*, and *"Spiky Shield and Baneful Bunker refuse Encore
exactly as Protect does"* for the status half. **The mechanic is covered; the roster row is the weak
instrument.** Note also that the authority itself announces Spiky Shield as `move: Protect` on both
`-singleturn` and `-activate`, so our naming there is correct and the renderer is faithful.

### F3. `tools/lownode.cmd` argument quoting
The wrapper is **sound** — `tests/test-lownode.js` passes 4/4 including exit-code propagation, and
measured directly it returned 7 for `process.exit(7)` and 1 for a module-not-found with stdout and
stderr intact. **The hazard is argument quoting**: an absolute Windows path splits on its drive colon
across the Bash→`cmd` boundary, and `start` mis-parses a quoted argument containing spaces
(`--seed "a vs b"` launches cmd instead of node). Use repo-relative paths; a quoted `--why` string was
truncated to `"#309` on an engine-release cut this way.

### F4. `explain_divergence.js` advertised a flag that never existed — FIXED
It printed *"Re-run the differential with `--explain` to capture context"*. There is no `--explain` in
`game_differential.js`. Now names `replay_one.js` and `divergence_cards.js` instead.

---

## ALREADY FILED ELSEWHERE, LISTED SO THE SET IS COMPLETE

- **#316** — the roster's inert control is not inert (Focus Energy applies `vol.focusenergy` and spends
  PP, both leaves the comparator reads). The control did not change; **the ruler did**. Second half:
  `quarantine.js` must refuse a roster clause whose artifact is older than the engine it describes.
- **#317** Fur Coat has no defence multiplier (we deal double through it); **#312** Sand Force. Both
  `tag_dex` derivation gaps of the same shape as C1–C3.
- **#318** the learnset exemption; **#319** the 157 move-stage DIFFER rows; **#321** the `fallen`
  `[silent]` family.
- **#204** the three formes with no body to become — blocks E5.
- **#294** per-target accuracy rolls — the shape B3 belongs to.
- **#304** the sixteen-index damage roll — B1 is its unconverted residue.
