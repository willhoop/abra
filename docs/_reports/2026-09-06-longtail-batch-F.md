# LONG-TAIL BATCH F — board-material 41 → 34, five fixes, five probes, and the list the bar actually reads

2026-09-06, ENGINE. Historical record. Not maintained, not current state, superseded by whatever
`node engine/status.js` prints.

---

## THE HEADLINE

| | before | after |
|---|---|---|
| **board-material** (`games` − `games_board_never_diverged`) | **41 of 961** | **34 of 961** |
| protocol first-divergence | 108 | **100** |
| narration-only (the second gate) | 72 | **71** |
| games whose board never diverged | 920 | **927** |
| void / threw | 5 / 1 | 5 / 1 |
| mechanics census | 829 live / 829 probed / 0 missing | **829 / 829 / 0** — level, 0 hollow, 0 threw, 0 unarmed |
| `node engine/status.js` | 7 of 9 | **7 of 9** — the same two whole-game clauses |
| shared-coin board-parted causes in the `any` join | 8 | **4** |

`data/game-differential.json` is republished at **34 / 100 on release `d9e551ed0d5a`**, the settled
tree.

Pins IDENTICAL on every whole-game run: census `data/verification/census-pin-9446a684709d.json`,
pool `data/team-pool-frozen`, arm `middle`, `--end-state`, steering `empirical`, cap 20, 1200-pair
budget → 961 games, `driver_code_stable` true throughout.

| step | what landed | release | board-material | protocol |
|---|---|---|---|---|
| baseline | as batch E published | `14b62cd5aeec` | 41 | 108 |
| 1 | `Battle#boost` refuses when the boosted body's FOE SIDE is empty | `c273d4301fd1` | **38** | **105** |
| 2 | a damaging pivot that emptied a side does not pivot | `5927782b7aa3` | **36** | **103** |
| 3 | an ability may SCALE a status chip — Heatproof's burn is half size | `a35ef476d6db` | **35** | **102** |
| 4 | the mega phase runs BELOW the previous action's `Update` pass | `8f446527f6f4` | 35 | **101** |
| 5 | a fainted body's ability is ignored — Pickpocket steals nothing from a corpse | `03160242219b` | **34** | **100** |
| — | the browser tag bundle rebuilt; settled tree; reproduced to the number | `d9e551ed0d5a` | 34 | 100 |

**THE BASELINE WAS NOT RE-RUN AND DID NOT NEED TO BE.** The live tree's
`engine/medicham2-browser.js` had CRLF line endings on arrival (`core.autocrlf` is `true`, so a
checkout rewrites them) and release `14b62cd5aeec` had frozen the LF copy. Normalising the working
file to LF made `engine_release.js drift 14b62cd5aeec` read **NO-DRIFT** — every one of its 26 frozen
files byte-identical in the live tree — so batch E's 41 / 108 is byte-reproducible and was taken as
given. Every edit after that was written LF and the CR count was asserted at **0** before each cut.

---

## THE PREDICTION RECORD — NINE OF TEN, ONE NAMED MISS

All five predictions were written to `data/verification/_prediction-longtail-F-*.json` **before**
their runs.

| step | quantity | predicted | measured | |
|---|---|---|---|---|
| 1 | board-material | **38** | 38 | hit |
| 1 | protocol | **105** | 105 | hit |
| 2 | board-material | **36** | 36 | hit |
| 2 | protocol | **103** | 103 | hit |
| 3 | board-material | **35** | 35 | hit |
| 3 | protocol | **102** | 102 | hit |
| 4 | board-material | **34** | **35** | **MISS by 1** |
| 4 | protocol | **101** | 101 | hit |
| 5 | board-material | **34** | 34 | hit |
| 5 | protocol | **100** | 100 | hit |

`threw` 1 and `void` 5 were predicted and measured on all five.

**THE MISS IS THE BATCH-D/E RE-PARTING MECHANISM, THIS TIME ON THE BOARD HALF, AND ITS OWN PREDICTION
FILE NAMED IT UNDER "why it might miss HIGH".** Diffed game by game out of
`divergence-turns-F3.json` against `divergence-turns-F4.json`, not inferred:

- `…-2655010751`, the second `whiteherb <> detailschange` row (against an Abomasnow-Mega,
  instrument-suspect), **LEFT the diverging set entirely** — it was narration-only, which is why
  protocol fell 102 → 101 and narration fell 72 → 71 while the bar did not move.
- `…-2660048410`, the shared-coin `raichumegay` row, **RE-LABELLED**: its White Herb ordering closed
  and it began parting on
  `extra event emitted by medicham2 :: |move|p2a|waterfall <> |-enditem|p2b|widelens|[from]pickpocket`.

**That relabelling is where step 5 came from.** It is not a consolation: the revealed row was a real
board-material defect that nothing could see while the White Herb ordering stood in front of it, and
closing it took the bar to 34.

---

## THE LIST THE BAR ACTUALLY READS IS NOT THE ONE THE BATCH WAS HANDED

This is the methodological finding of the pass and it is worth more than any single fix.

`mid_void.any_bucket.by_cause` — the table batches D, E and F have all been steered by — is keyed on
each game's **first PROTOCOL divergence**, and its `board_parted` column says *"how many games with
this protocol cause also parted a board at some point"*. It does **not** say the protocol cause IS
the board cause. `state.first_board_divergences` is the list that answers the bar: 34 entries, one
per board-material game, each carrying the turn and the exact leaves.

Measured, not argued. The board-material `-hitcount` game is
`…-2661266222` (`pair-protect-bust`), and its **board** divergence is at turn 6:

```
p1.party.incineroar.hp    medicham 127   showdown 119
p2.party.kangaskhan.hp    medicham  76   showdown  80
p2.active[0].hp           medicham  76   showdown  80
```

— an HP mismatch around a Parental Bond volley, not the `-hitcount` line at all.

**SO BATCH E's JUDGEMENT ON THE `-hitcount` CLAUSE IS CONFIRMED, and now by the board list rather than
by argument.** It was handed forward as *"derived fully and deliberately NOT taken, because it cannot
move the bar — check that judgement before repeating it."* Checked: taking it would relabel that
game's first protocol divergence and leave its board parting on the Parental Bond HP. It moves the
narration gate and not the bar, exactly as batch E said. **One correction to the filing:** its
`any`-bucket verdict is `neither-drew`, not shared coins — the game takes no `any` draws on either
side, so `min_rate` is `null` and `instrument_suspect` is false by the "a null rate is not evidence"
rule. It is UNREADABLE rather than SHARED, and that is a different thing.

### WHAT THE 34 ACTUALLY ARE

Grouped by the leaves that parted, with each game's protocol cause's `any`-bucket verdict beside it:

| games | the leaf that parted | verdicts |
|---|---|---|
| **12** | **a STATUS landed in one engine and not the other** | 10 instrument-suspect, 2 have no protocol divergence at all |
| **6** | a body DEAD in one engine only (downstream of a status or a damage difference) | 1 suspect, 2 shared-coin, 3 no protocol divergence |
| **5** | HP only | 3 suspect, 2 shared-coin |
| **4** | PP | 3 suspect, 1 no protocol divergence |
| **3** | the Protect stall counter | all 3 have no protocol divergence |
| **2** | a Disable volatile (Cursed Body, Mental Herb) | both suspect |
| **1** | an item (Roseli Berry) | suspect |
| **1** | a forme / type | no protocol divergence |

The status column is Poison Touch six times, Flame Body, a sleep counter, a freeze thaw. **Every one
of them is the 30%-proc family the batch-D `any`-bucket join MEASURED as instrument-suspect**, and
its fix is the one batch D named and did not take: give the post-hit ability proc its own address
CATEGORY on both sides, as ROADMAP #478 did for `tgt`. That moves `PIN_DIGEST` and belongs in its own
pass with its own before/after — it cannot ride inside a batch that publishes engine deltas.

**FIVE GAMES PART A BOARD WITH NO PROTOCOL DIVERGENCE AT ALL** (`board_parted_before_the_protocol_did`
= 5, and `protocol_diverged_at_turn` is `null` on exactly those five). Three of them are the Protect
stall counter, one is PP, one is a forme. Those cannot be steered from the by-cause table by
construction, because they have no cause row — a second reason the board list is the one to read.

**BOARD-MATERIAL IS NOT ZERO. `node engine/status.js` reads 7 of 9 and names board-material 34 of 961
(3.5%) and narration-only 70 of 961.** That is read off the gate, not decided here.

---

## FIX 1 — `Battle#boost` REFUSES OUTRIGHT WHEN THE BOOSTED BODY'S FOE SIDE IS EMPTY

`Battle#boost` opens with three refusals and this engine implemented the first two:

```
if (!target?.hp) return 0;                                              sim/battle.ts:2026
if (!target.isActive) return false;                                                 :2027
if (this.gen > 5 && !target.side.foePokemonLeft()) return false;                    :2028
```

`pokemonLeft` is decremented inside `faintMessages` (`if (pokemon.side.pokemonLeft)
pokemon.side.pokemonLeft--;`, :2550) **independently of its `checkWin` argument**, and
`hitStepMoveHitLoop` calls it as `faintMessages(false, false, !pokemon.hp)` (scripts.ts:547) — so on
the swing that empties the other side the count reaches zero while the battle is not yet declared
over, and `useMoveInner`'s `selfBoost` call one frame later (battle-actions.ts:520) is refused by
this clause and by nothing else. `AfterMoveSecondarySelf` at :537 is BELOW it and still runs, which
is why the authority's stream carries the Life Orb toll and no `-unboost` above it.

```
showdown   |-damage|p1b: Dragalge|0 fnt   |faint|p1b: Dragalge   (nothing further)
medicham2  …the same two lines, and then  |-unboost|p2b: Kommo-o|def|1
```

**THE ASYMMETRY IS WHY THE GUARD GOES AT EXACTLY ONE SITE.** Close Combat's `self.boosts` is paid by
`selfDrops` INSIDE the hit loop (scripts.ts:385), which is ABOVE the decrement — the authority pays
that one on the winning swing and must keep paying it. Only the after-loop `selfBoost` payment sits
below. `foeSideEmptyFor(S, f)` is written as its own function beside `sideWiped` because "may this
body be boosted" is one fact, and it is NOT `sideWiped` renamed: it asks about ONE side, the foe of
whoever is being boosted. A body found on neither side refuses nothing and increments
`MEDFAILS.foeSideUnlocatable`.

The engine's own `_stepAfterFaint` header had **filed this clause and declined it** —
*"On every board reachable here `checkWin` gets there first, so adding it would be a clause with no
arm that can distinguish it. Filed."* That was correct about the AfterFaint site and it is not the
site the differential caught.

**PROBE — `tests/probe_selfboost_empty_foe_side.js`, knob `MEDI_SELFBOOST_IGNORES_EMPTY_FOE_SIDE`.**
The defect needs a side WIPE, so it cannot be a one-turn scenario: the defending side is a target
that never moves plus self-removing Memento bodies, and the fourth defender is what the two arms
swap — a third Memento (the side empties) against a body IMMUNE BY TYPE to the move (one left
standing). Chosen this run: Kommo-o [Bulletproof] Clanging Scales into a Flapple, beside a third
Memento or an Alcremie (Fairy, immune to Dragon).

Three of its assertions were red first, exactly the engine ones; every fixture and authority
assertion was green, including the authority reading **0 drops on the wipe and 1 on the survivor**.

---

## FIX 2 — A PIVOT THAT TOOK THE LAST BODY DOWN DOES NOT PIVOT

`selfSwitch` does not switch anybody. It sets a FLAG (`source.switchFlag = move.id`,
battle-actions.ts:1311) and `Battle#runAction` turns the flag into a request LATER, with two
statements in between:

```
this.faintMessages();                                                   sim/battle.ts:2832
if (this.ended) return true;                                                         :2833
…
const switches = this.sides.map(side => side.active.some(p => p && !!p.switchFlag));  :2874
for (const playerSwitch of switches) if (playerSwitch) { this.makeRequest('switch');  :2906
```

**That `faintMessages()` takes its DEFAULT `checkWin = true`**, unlike the one inside the hit loop, so
a move that empties the other side wins the battle there and `:2833` returns above the switch block.

```
showdown   |move|p2a: Swampert|Flip Turn|p1a: Pelipper … |faint|p1a: Pelipper   (nothing further)
medicham2  …and then |switch|p2a: Pelipper|pelipper, L50|71/135|[from] flipturn
```

`sideWiped(S)` is this engine's own `checkWin` and not a second copy of the rule. **NOT widened to the
status pivot and said rather than left to be found:** `pivotStatus` (Parting Shot, Chilly Reception,
Baton Pass, Shed Tail) deals no damage, so it cannot be the click that empties a side and the clause
would have no arm to fire on.

**PROBE — `tests/probe_pivot_after_battle_end.js`, knob `MEDI_PIVOT_AFTER_BATTLE_END`.** The pivot
moves are single-target, so unlike fix 1 both arms swing at exactly one body and there is no spread
modifier anywhere: the two boards differ ONLY in whether the side emptied. Chosen: Scizor's U-turn
into a Meowscarada, beside a third Memento or an Abomasnow that simply stands there.

**THE OUTCOME COUNT WAS WRONG BEFORE THE ENGINE WAS, TWICE.** Counting `|switch|p1a:` over the whole
log read THREE pivots in every arm — the script is four turns and the driver keeps playing to the
turn cap afterwards, switching on its own policy — so the count was measuring the driver. Bounded to
the swinging turn it read TWO, because **the authority's raw `battle.log` carries every `|split|`
line twice**, the omniscient view and the spectator view. Both are fixed in the probe, with the
reason written next to the fix; the second is now shared by
`tests/probe_entry_update_before_mega.js`.

---

## FIX 3 — AN ABILITY MAY *SCALE* A STATUS CHIP, AND THE ARTIFACT KNEW ONLY THE OTHER TWO

`-damage field 3 :: |-damage|p2b: Sinistcha|142/146 brn vs |-damage|p2b: Sinistcha|137/146 brn`.
146 − 137 = 9 is `floor(146/16)`, the plain burn; 146 − 142 = 4 is that number halved. Sinistcha's
hidden ability is **Heatproof**, DERIVED off the species row.

```
heatproof.onDamage(damage, target, source, effect) {
  if (effect && effect.id === 'brn') { return damage / 2; }        data/abilities.ts:1838-1841
}
```

and the burn is `this.damage(pokemon.baseMaxhp / 16)` at `onResidualOrder: 10`
(data/conditions.ts:15-18 — the Champions mod does not override the `brn` condition). `spreadDamage`
clamps with `clampIntRange(targetDamage, 1)` on **both sides** of the `Damage` event and
`clampIntRange` floors before it clamps, so the arithmetic is `max(1, floor(maxhp/16))` and then
`max(1, floor(that × mult))` — 9 then 4. Halving the FRACTION instead gives `floor(146/32) = 4` here
and is one point out wherever the two roundings disagree.

**A NEW TAG, `scalesOwnStatusDamage`, derived in `engine/tag_dex.js` — and it is a THIRD tag rather
than a param on either of the existing two.** `refusesIndirectDamage` (Magic Guard) refuses a CLASS;
`healsFromOwnStatus` (Poison Heal) CONVERTS one status into a heal. Folding a multiplier into either
would make a consumer read one field to choose between three opposite behaviours.

**MEMBERSHIP PRINTED BEFORE IT WAS WIRED (LESSONS §4) AND IT IS ONE.** Every legal ability in the
format carrying an `onDamage` at all was listed first — eleven of them: `angershell`, `berserk`,
`disguise`, `gluttony`, `heatproof`, `iceface`, `magicguard`, `poisonheal`, `rockhead`, `sturdy`. Of
those, `heatproof` is the only one that returns a scaled `damage` for a named status; the two that
return `false` are the two tags above and are excluded explicitly; the four that answer a MOVE name
no status; Rock Head answers `recoil`, which is not a status either. The derivation printed
`heatproof {"statuses":["brn"],"mult":0.5}` and nothing else.

The engine applies it through ONE function gated by the tag's own `statuses` list, so an ability that
scales poison joins by EXISTING rather than by an edit.

**PROBE — `tests/probe_status_chip_scaled.js`, knob `MEDI_STATUS_CHIP_UNSCALED`.** Flame Orb, the
deterministic way to burn a body, is `isNonstandard: 'Past'` in Champions — checked against the
format rather than remembered — so the burn comes from Will-O-Wisp at 85 accuracy and the arm is
re-seeded until it lands, with the attempt count printed. The CONTROL is the **same Sinistcha
carrying Hospitality**, which scales nothing: both engines take the full 9 there, in the default and
under the knob.

**The probe read a board that had not been played, for the second time in two batches.**
`onBoundary` fires BEFORE turn 1 as well as after it, so `seen[0]` reported the burn as having missed
on all twelve seeds. Caught, fixed to the LAST boundary, and the script shortened to ONE turn so that
exactly one residual has run at the boundary it reads.

---

## FIX 4 — THE MEGA PHASE IS AN ACTION AND IT WAS STANDING IN THE PREVIOUS ACTION'S TAIL

`ordering :: |-enditem|p1b|whiteherb <> |detailschange|p2a|raichumegay,l50`. An Intimidate switched
in, lowered Attack on both foes, and the authority spent the White Herb THERE — before evolving a
Raichu — while this engine evolved first and ate the herb afterwards.

`Battle#runAction` closes EVERY action, the switch included, with

```
if (this.gen >= 5 && action.choice !== 'start') { this.eachEvent('Update'); … }   :2857-2858
```

and a mega is its own action at queue order **104**, between `switch` (103) and every move (200) —
which `TURN_ORDER` in `medicham2-browser.js` already says. White Herb is an `onUpdate`, so it is
settled one whole action before the mega.

medicham2 has no `megaEvo` action; it re-derives the mega order inside the action loop, and
`_megaPhase` was triggered at the TOP of the loop iteration — i.e. inside the block that stands for
the tail of the PREVIOUS action (`midClearActiveMove` at :2828, the settles,
`faintMessages(); if (this.ended) return true;` at :2832-2833, `eachEvent('Update')` at :2858). The
call now sits one line below `_updateAll()`.

**THE GATE IS STILL READ WHERE IT WAS READ AND ONLY THE CALL IS DEFERRED.** The gate asks
`acts[actIdx]._pri < 6`, i.e. *the bare switches are done*, and `_resortTail` below it can change
which entry sits at `actIdx` — so evaluating it after the re-sort would be asking a different
question, not the same one later. One boolean serves both phases because the two gates are the
identical expression and both functions carry their own done-flag; ROADMAP #322's "104 THEN 107"
ordering is preserved exactly. The phases are now also below the `sideWiped` break, which is correct
rather than incidental: the authority's `if (this.ended) return true` is above the mega action too.

**PROBE — `tests/probe_entry_update_before_mega.js`, knob `MEDI_MEGA_BEFORE_UPDATE`.** One turn: the
defending side switches an entry-drop ability in, one attacker holds the herb, and a body on the
switching side mega-evolves on the same turn. No damage, no accuracy die, no KO. The SILENT CONTROL
is the same board with no stone: nothing megas, the herb still eats, and neither engine moves under
the knob.

**THE FIRST DRAFT READ MAINLINE'S MEGA SHAPE AND FOUND ZERO STONES IN A FORMAT THAT HAS 75.** In
Champions `item.megaStone` is an OBJECT — `{ Raichu: 'Raichu-Mega-Y' }` — and `item.megaEvolves` is
`undefined`; requiring `megaEvolves` reported *"NO LEGAL MEGA STONE — a claim about the format"*,
which would have been a false statement about the regulation. The base species is the object's own
key. A second draft asserted the herb's LINE INDEX was equal across the two engines, which is
meaningless — showdown's raw log carries a `|player|`/`|teamsize|`/`|gen|` preamble medicham2's trace
has no equivalent of. **Every order claim in that probe is now made WITHIN one stream; across streams
only "did it happen at all" is.**

---

## FIX 5 — A FAINTED BODY'S ABILITY IS IGNORED, AND IT WAS REVEALED BY FIX 4

`extra event emitted by medicham2 :: |move|p2a|waterfall <> |-enditem|p2b|widelens|[from]pickpocket`.
A Talonflame's Dual Wing Beat killed a Tinkaton and this engine then handed the CORPSE the attacker's
Wide Lens — two bodies' items wrong, one of them a party leaf that lasts the rest of the game.

**Pickpocket's own handler is not where the rule lives.** `onAfterMoveSecondary` (data/abilities.ts:3230)
has no hp test and no fainted test in it. The refusal is one level up:

```
} else if (eventid !== 'End' && effect.effectType === 'Ability' &&
           (effectHolder instanceof Pokemon) && effectHolder.ignoringAbility()) { … continue; }
                                                                          sim/battle.ts
ignoringAbility() { if (this.battle.gen >= 5 && !this.isActive) return true; … }
                                                                          sim/pokemon.ts
faintMessages(): … pokemon.fainted = true; pokemon.isActive = false;      sim/battle.ts:2563-2564
```

So `faintMessages` clears `isActive`, `ignoringAbility()` answers true, and **every** ability handler
on that body is skipped for the rest of the event, `End` alone excepted.

**IT IS THE OTHER HALF OF BATCH E's PICKPOCKET FIX AND IT WAS INVISIBLE UNTIL THAT LANDED.** The theft
used to be paid inside the per-hit reaction block, ABOVE `faintMessages`, where the thief was not a
corpse yet. Batch E moved it to the authority's own position (`AfterMoveSecondary`,
battle-actions.ts:1005, below `faintMessages` at scripts.ts:547) — correct, and what put the handler
on a dead body for the first time.

**ONLY THIS SITE IS WIRED FOR THE GENERAL CLAUSE, AND THAT IS SAID PLAINLY RATHER THAN LEFT TO BE
DISCOVERED.** The other ability roads in the file are not audited against `ignoringAbility()`'s
`!isActive` arm; a second one arriving needs its own probe.

**PROBE — `tests/probe_pickpocket_on_a_corpse.js`, knob `MEDI_PICKPOCKET_ON_A_CORPSE`.** The attacker
holds a stealable item, the thief has Pickpocket and an empty hand, and the ONLY thing that varies is
which contact move is clicked: a lethal one (the thief dies, nothing is stolen) against a weaker one
from the SAME attacker on the SAME body (the theft happens). Chosen: Crabominable holding Focus Sash,
Focus Punch against Payback, into a Weavile.

**`basePower > 0` IS LOAD-BEARING IN THAT FILTER AND WAS MISSING ON THE FIRST RUN.** Without it the
control arm was staged with ENDEAVOR, whose base power is 0 and which simply fails from a full-HP
user — so no contact was made and the authority stole nothing in EITHER arm, which reads as the
authority contradicting the rule rather than as a fixture that was never set.

**AND THE ROSTER PROJECTIONS CARRY NO `item` FIELD.** `mediSide`
(`engine/game_differential.js:4585`) and `sdSide` (:4611) both stop at name/key/hp/fainted/where, so
an item read there is `undefined` on both sides and an assertion on it would have compared undefined
with undefined and passed on a broken engine too. Every claim about either engine in that probe is
made on its STREAM, where the `|-item|` line either exists or does not, and the reason is written in
the file.

---

## THE INSTRUMENT WAS SUSPECTED FIRST AND WAS THE ANSWER FOUR TIMES

Every one of these was a PROBE being wrong before the engine was, and each was caught by the probe's
own fixture assertions rather than by reading the result and liking it:

- **the attacker's ability refusal list was the DEFENDER'S.** `probe_selfboost_empty_foe_side.js`
  inherited `immuneToMoveClass` into the attacker's refusal set, which refused all three of Kommo-o's
  abilities and reported *"EVERY ABILITY ON THE ATTACKER TOUCHES THE BOOST — a claim about the
  fixture"* on a body whose abilities touch nothing of the kind.
- **the candidate walk gave up after ONE try.** Keying `seen` on `move/attacker` stopped the search
  dead, because this format has exactly one legal carrier of the only usable `selfBoost` move — and a
  search that gives up after one candidate reports NOT STAGED as if it were a fact about the format.
- **the modelled damage was 292 and the swing dealt 138.** `buildOne` builds a body with a filler
  moveset and the SP budget the real fixture spends is not the same one, and the doubles spread
  modifier is a further 0.75. The model is now demoted to ORDERING the candidate list and every
  candidate is PLAYED before it is used; a derived fixed-damage chip (`damage: 'level'`) makes the KO
  exact in both arms.
- **`onBoundary` fires before turn 1**, so the first snapshot is the board before anything was
  clicked. Second batch running to hit this one.

---

## THE CLAUSES THIS PASS STALED WERE RE-RUN ON `d9e551ed0d5a` AND NONE MOVED

- **Damage differential:** `--n 6000`, **0 disagreements** at the midpoint and at both endpoint arms,
  and *"the interior is clean across all 14 indices"*. Seed 20260804.
- **Roster:** items **140 of 148 tested**, abilities **129 of 202**, moves **475 of 500**;
  `FIRED-AND-BOARDS-DIFFER` **0** and `DID-NOT-FIRE` **0** on all three stages.
- **`all_mechanics_fire.js --kind all --write`:** 1313 games, **0 threw, 0 sheets unassembled**.
- **Census:** regenerated after the last engine change — **829 live / 829 probed / 0 missing,
  0 hollow, 0 threw, 0 unarmed.** Level. It has never gone down.
- **`tests/test-game-diff.js`** green, **`tests/walk_tags.js`** ran clean (0 threw),
  **`tests/test-engine-consistency.js`** all checks passed, **`tests/test-docs-current.js`**
  24 passed / 0 failed.
- **`engine/artifact_audit.js`** — see below.
- `node engine/status.js` reads **7 of 9**, and the two failures are exactly the two whole-game
  clauses on their measured counts: board-material **34 of 961 = 3.5%**, narration-only **70 of 961**.

### A GATE WENT RED IN THE MIDDLE OF THIS PASS AND IT WAS MINE

`engine/artifact_audit.js` reported **1 GAP**: `data/abra-tags.js` is not what
`build/build_tags_js.js` would write from `data/tags.json` — *"the browser engine and the node engine
are reading different rulebooks"*, 23 tag rows and one ability row differing.

It was caused by fix 3 and it was **entirely** fix 3: `tags.tags` is an ARRAY, the new
`scalesOwnStatusDamage` row was inserted at index 286, and the 22 rows below it shifted. Confirmed
against `git show HEAD:data/tags.json` — 308 rows before, 309 after, one added, 22 shifted, one
ability changed (`heatproof`), nothing else.

`node build/build_tags_js.js` rebuilt the bundle and the audit reads **no gaps found**. That moved
`data/abra-tags.js`, which is one of the 26 frozen release sources, so the tree was re-cut as
`d9e551ed0d5a` and the whole-game run was repeated on it — **34 / 100 / 71, reproducing step 5 to the
number.** The five other artifacts (`engine-diff`, three roster stages, `all-mechanics-fire`) were
re-run on the same release, because until they were `status.js` read
`MEASURED AGAINST A DIFFERENT ENGINE` on four clauses — a STALENESS caption that reads exactly like a
divergence, which is the trap batch D recorded.

**The node engine never read the stale bundle.** `engine/tags.js` is the node-side loader and it
opens `data/tags.json`; `data/abra-tags.js` is the browser bundle. So no measured number in this
report was taken against a stale rulebook — but the gate was red and a red gate is fixed in the
session that sees it.

---

## WHAT IS LEFT, AND WHAT IT WILL AND WILL NOT COST

**Four shared-coin board-parted causes remain, one game each**, and one of the four is not really
shared:

| cause | note |
|---|---|
| `-crit: a different body :: \|-crit\|p2a <> \|-crit\|p2b` | a spread Rock Slide crits a different body in each engine — showdown crits the target behind a SUBSTITUTE, this engine crits the one beside it. A crit-address question, and the fix may live in the dice addressing, which moves `PIN_DIGEST`. |
| `extra event emitted by medicham2 :: \|move\|p2b\|rockslide <> \|-hitcount\|p1:\|1` | **the Champions-only Parental Bond clause. NOT TAKEN, and the judgement is now confirmed off the board list** — the game's board parts on a Parental Bond HP mismatch at turn 6, not on the `-hitcount` line. Its verdict is `neither-drew`, i.e. UNREADABLE rather than shared. |
| `unrelated event mismatch :: \|move\|p1a\|moonblast <> \|-damage\|p1a\|H/H\|[from]confusion` | the confusion self-hit decision — one engine hits itself and the other does not, and the game ends with the boards unable to be expressed to each other. |
| `extra event emitted by medicham2 :: \|faint\|p2b <> \|-start\|p1b\|perish0` | **derived in full this pass and not taken — see below.** |

### THE PERISH SONG ROW IS DERIVED AND HANDED FORWARD WITH ITS MECHANISM

`Battle#fieldEvent`'s residual walk calls `this.faintMessages()` after **every** handler — and the
duration-expiry branch `continue`s past it:

```
while (handlers.length) {
  const handler = handlers.shift();
  if (handler.effectHolder.fainted) { if (!handler.state?.isSlotCondition) continue; }
  if (eventid === 'Residual' && handler.end && handler.state?.duration) {
    handler.state.duration--;
    if (!handler.state.duration) { handler.end(…); if (this.ended) return; continue; }   <- SKIPS it
  }
  …
  if (handler.callback) this.singleEvent(…);
  this.faintMessages();                                                                  <- HERE
  if (this.ended) return;
}
```

Perish Song's condition is `onEnd: add('-start', target, 'perish0'); target.faint()` and
`onResidual: add('-start', pokemon, 'perish' + duration)` (data/moves.ts:13264-13274). So a body whose
counter EXPIRES writes `perish0`, queues a faint and skips the drain, and the next body whose counter
merely TICKS drains it. That is exactly the authority's stream:

```
showdown   perish0(Gengar)  perish1(Excadrill)  faint(Gengar)  perish0(Tyranitar) …
medicham2  perish0(Gengar)  perish1(Excadrill)  perish0(Tyranitar) … then all three faints
```

**NOT TAKEN, and the reason is scope rather than derivation.** medicham2's residual walk is
group-major and drains faints only for the weather group; its own header at the walk's top DECLARES
the group granularity as an approximation. The faithful fix is a drain after each non-expiring
residual handler, which touches every residual in the game — every burn, every Leech Seed, every
weather chip — and a change with that blast radius needs its own pass and its own before/after, not a
slot at the end of a batch that has already published five engine deltas. The mechanism above is the
whole derivation; a probe needs a fixture in which the non-expiring body sits in the MIDDLE of the
speed order among four perished bodies, which is why it is not a one-turn scenario either.

### AND THE REAL SHAPE OF THE RESIDUE

25 of the 34 board-material games carry a protocol cause the `any`-bucket join **measures** as
instrument-suspect, and 12 of the 34 are one family: **a status landed in one engine and not the
other** — Poison Touch six times, Flame Body, Cursed Body, a sleep counter, a freeze thaw. Batch D
named their fix and did not take it: give the post-hit ability proc its own address CATEGORY on both
sides, as ROADMAP #478 did for `tgt`. **That is the next thing worth doing to the bar, it moves
`PIN_DIGEST`, and it belongs in a pass of its own.** Everything else left is single games.

---

## FILES

- `engine/medicham2-browser.js` — five wires, five knobs, four new counters, one new helper
  (`foeSideEmptyFor`). **LF endings preserved and asserted at 0 CR bytes after every edit**, and the
  file was normalised to LF at the start of the batch so that `drift 14b62cd5aeec` read NO-DRIFT.
- `engine/tag_dex.js` — one new derivation, `scalesOwnStatusDamage`, with its membership print.
- `data/tags.json`, `data/abra-tags.js` — regenerated; the bundle rebuilt with
  `build/build_tags_js.js`.
- `tests/probe_selfboost_empty_foe_side.js` — new, knob `MEDI_SELFBOOST_IGNORES_EMPTY_FOE_SIDE`.
- `tests/probe_pivot_after_battle_end.js` — new, knob `MEDI_PIVOT_AFTER_BATTLE_END`.
- `tests/probe_status_chip_scaled.js` — new, knob `MEDI_STATUS_CHIP_UNSCALED`.
- `tests/probe_entry_update_before_mega.js` — new, knob `MEDI_MEGA_BEFORE_UPDATE`.
- `tests/probe_pickpocket_on_a_corpse.js` — new, knob `MEDI_PICKPOCKET_ON_A_CORPSE`.
- `data/verification/_prediction-longtail-F-{selfboostemptyfoe,pivotafterend,statuschip,entryupdatemega,pickpocketcorpse}.json`
  — written before their runs.
- `data/verification/divergence-turns-F{1,2,3,4,5,}.json` — the dumps each step was bucketed from.
- `data/game-differential.json`, `data/engine-diff.json`, `data/mechanics-census.json`,
  `data/all-mechanics-fire.json`, `data/roster.{items,abilities,moves,all}.json`, `data/roster.json`,
  `data/game-diff.json`, `data/tag-walk.json` — regenerated on `d9e551ed0d5a`.

**NOT TOUCHED, as instructed:** `engine/board.js`, `engine/magnemite.js`, `data/engine-data.js`,
`data/policy-weights.json`, `engine/status.js`, `engine/quarantine.js`, `engine/game_differential.js`,
`engine/board_state.js`. No fit and no self-play run was made. `engine/status.js --write` was NOT
run and `CHANGELOG.md` was NOT bumped, per the brief.

**Nothing downstream becomes quotable.** No model was fitted, no weight vector was written, the
quarantine does not lift, and every withheld figure stays withheld.

---

## AN UNTRACKED DIRECTORY THIS SESSION CREATED, REPORTED RATHER THAN DELETED

`tmpprobe/` in the repository root holds this batch's run logs (`run-F*.log`, `roster-*.log`,
`status*.log`, and three throwaway `bt*.js` scratch scripts). It was created by this session and is
not referenced by anything. It is left in place and named here rather than removed, per the
2026-08-04 rule.
