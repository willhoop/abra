# WHAT REMAINS — the ranked worklist for both failing clauses

Read at HEAD `aab7a25e`, all three artifacts stamped on release **`7f7de860723b`**, which is the
current tree. Every figure below is `git show HEAD:<file>`; nothing was re-run and no game was played.

```
whole-game clause     9 of 961      (14 raw, less 5 declared)   data/game-differential.json
  of which board-material                  1                    state.first_board_divergences
mechanics clause      8 of 16       (1 declared, 7 below shelf) data/all-mechanics-fire.json
census              754 live / 754 probed / 0 missing
```

## THE CAP IS TWELVE TURNS AND IT IS DOING WORK

`turns_cap: 12`. **Five of the nine whole-game divergences happen on turn 7 or later** (turns 10, 12, 7,
10, 10), and only ONE is on turn 2. Two of the mechanisms below — the mid-multi-hit berry and the batched
switch-in — are the sort that compounds, so a run at cap 30 will not simply reproduce these nine. Any
comparison against a cap-12 number is a comparison of a different question.

Likewise: arm `middle` for the whole-game clause, arm `bottom-tie-first` (MIN damage, crits forced) for
the mechanics clause. Different arms, different questions.

---

# A. THE WHOLE-GAME CLAUSE — nine games, grouped by mechanism

## A0. THE ONE BOARD-MATERIAL GAME — Outrage lands on the wrong body

*(Being fixed right now by the play-layer agent. Confirmed here so the identification is not taken on
trust.)*

`state.first_board_divergences` holds exactly one entry, and it is the same game as the
`-damage: a different body` protocol row: baseline, `2635122796 vs 2634861011`, turn 2. Garchomp clicks
Outrage into a foe pair; the authority damages Staraptor, we damage Incineroar.

- **Board or narration:** BOARD. Four leaves part — `p2.party.staraptor.hp` 160 vs 87 and
  `p2.party.incineroar.hp` 106 vs 170, plus the two active views. **Instrument:** the state comparator's
  `first_board_divergences`, not a reading of the stream.
- **Not a tie.** Two engines picked different bodies for a `randomNormal` target — a draw at a different
  address or a differently-ordered candidate list, not a speed comparison.
- **Note for whoever lands it:** the reducer's `move-target-field` rule slices `|move|` lines to four
  fields, so Outrage's *nominal* target is invisible to the comparator. The `|move|` line agreeing is not
  evidence that the target agreed — the `-damage` one line later is where it shows.

## A1. FAINT REPLACEMENTS — the authority announces every switch, THEN runs every entry effect

**3 of the 8 narration games. The single biggest fix on this clause.**

Two symptoms, one root:

- **A hazard fires between two switch announcements.** `2656492881`, turn 7. Venusaur switches in; the
  authority's next line is `|switch|p1b: Garganacl`, ours is
  `|-damage|p2a: Venusaur|53/155|[from] Stealth Rock`. We run Venusaur's entry the moment it lands; the
  authority holds it until Garganacl has been announced too.
- **The two replacement switches come out in a different order.** `2659972415` turn 10 (Garchomp before
  Blastoise on the authority, the reverse here) and `2655745450` turn 7 (Staraptor before Incineroar, the
  reverse here).

**The authority, read whole** (`sim/battle-actions.ts`): `switchIn` writes the `|switch|` line and then
queues a *separate* `runSwitch` action (`:157`, `this.battle.queue.insertChoice({choice:'runSwitch', ...})`).
`runSwitch` (`:175-183`) then drains **every consecutive queued `runSwitch`** into one list and calls
`fieldEvent('SwitchIn', switchersIn)` **once**. So the announcements and the entry effects are two
different phases, and the entry effects are sorted together by `comparePriority` — switch-in priority
above speed, which this engine already models (`SWITCHIN_PRIORITY`). The switch ACTIONS themselves get
`action.speed = action.pokemon.getActionSpeed()` (`sim/battle.ts:2657`), where `action.pokemon` is the
body **leaving** — for a faint replacement, the corpse.

- **Board or narration:** narration in these three games. **Instrument:** `protocol_diverged_board_never_did: 13`,
  and none of the three appears in `first_board_divergences`. **It is not narration as a class** — a
  Stealth Rock that KOs the incoming body changes who is standing, and the batching decides whether the
  second body was announced before the first one died.
- **Not a tie.** The switch-order half was previously reported as "neither incoming nor outgoing speed";
  the authority's own key is the **outgoing** body's action speed, and that is the thing to test first.
- **The fix:** model the replacement phase as the authority's queue — sort the switch actions, emit all
  `|switch|` lines, then run ONE batched entry event. One change closes all three.

## A2. SIX PER-BODY CLOCKS RUN OUT BELOW THE END-OF-TURN WALK INSTEAD OF INSIDE IT

**1 game. The engine already names this defect in its own source; nothing has been done about it.**

`2654016071`, turn 10: the authority ends Disable, then ticks Perish Song. We tick Perish Song, then end
Disable. `data/residual-order.json` publishes Disable at **order 17** and Perish Song at **order 24**, so
this is not a speed question — 17 comes before 24 on any board.

The cause is one line, `medicham2-browser.js:6163`:

```js
const RESIDUAL_EXPIRY_SITES = new Set(['side', 'pseudoweather', 'terrain']);
```

`volatile` is not in it. The comment beneath it says so and prints the casualties: *"the rest still tick
in the block UNDERNEATH the walk — a position no effect in this format declares… Measured on this build
it names six: **taunt@15, disable@17, magnetrise@18, healblock@20, throatchop@22, yawn@23**."* The same
comment names the sibling family it cannot reach: Encore@16, Perish Song@24, Uproar@28 and `lockedmove`
own a handler AND a duration, so they tick in that same misplaced block.

- **Board or narration:** narration in this game. It stops being narration the moment a clock that should
  have expired at order 15 is still on a body at order 24 — Taunt and Heal Block both gate what a body may
  legally do next turn.
- **Not a tie.** Declared orders, twenty apart.
- **The fix:** admit `volatile` to `RESIDUAL_EXPIRY_SITES` so those six get a group in the walk. Closes
  this game and structurally corrects five more clocks nothing has staged.

## A3. A BERRY IS EATEN BETWEEN THE HITS OF A MULTI-HIT MOVE

**1 game, and the mechanism is board-material in general even though this game's board held.**

`2655780718`, turn 12. Dragonite clicks Scale Shot into Incineroar (170 max). Hits land at 140, 110, 80 —
and 80 is under half. The authority's next line is `|-enditem|p2a: Incineroar|Sitrus Berry|[eat]`; ours is
a fourth `|-damage|` to 50.

`sim/battle-actions.ts:890` opens `for (hit = 1; hit <= targetHits; hit++)` and `:967` runs
`this.battle.eachEvent('Update')` **inside that loop**. Sitrus, Oran and the whole `onUpdate` family
therefore fire **between hits**, and the remaining hits land on the healed bar.

- **Board or narration:** narration *here* only because the divergence is at turn 12 and the run stops
  there. HP is not in `board_not_compared`; the board simply had no turn left to part on. In any longer
  game the arithmetic differs — the authority's later hits come off a bigger bar, and a body we kill on
  hit 4 survives on the authority.
- **Not a tie.**
- **The fix:** run the `onUpdate` berry check after each hit of a multi-hit, not after the move.

## A4. TWO TAILWINDS ENDING ON THE SAME TURN — AN EXACT TIE. WILL'S CALL, NOT A BUG.

**2 games. Neither engine is wrong.**

`smogtours-958539 vs 2654206587` and `2659846315 vs 2659952564`, both turn 5: the authority writes
`|-sideend|p2: B|move: Tailwind` first, we write p1's first.

Derived from the authority rather than argued:

- Tailwind declares `onSideResidualOrder: 26, onSideResidualSubOrder: 5` — identical on both sides.
- `resolvePriority` (`sim/battle.ts:950`) takes `handler.speed` from `handler.effectHolder.speed`, and for
  a side condition the holder **is the `Side`**, which has no `speed` at all.
- `handler.effectOrder` is filled **only** when the callback name ends in `SwitchIn` or `RedirectTarget`
  (`:994`) — not for `Residual`.
- So both handlers tie on all five keys of `comparePriority`, and `speedSort` (`:455`) calls
  `this.prng.shuffle(...)`.

`data/residual-order.json` records the same fact on the Tailwind row — *"speedFrom: none — the holder is a
Side/Field and has no speed, so this sorts as 0"* — and `medicham2-browser.js:6757` already declares this
exact pair as a case its residual tie-break **does not fix**, with the reasoning in
`docs/_reports/2026-08-24-residual-order.md`.

**The decision owed:** the order is a coin flip in the authority. Either medicham2 draws the same shuffle
at the same address (which costs a die that has to line up and buys nothing but line order), or the pair
is DECLARED — both answers legal — and subtracted like the Supreme Overlord family. It should not be filed
as an engine defect, because there is no correct answer to converge on.

## A5. ZAP CANNON INTO GOLURK — the authority says immune, we say miss. CAUSE NOT IDENTIFIED.

**1 game. Reported as open, not as diagnosed.**

`2660356793`, turn 10: authority `|-immune|p1a: Golurk`, ours `|-miss|p2b: Raichu|p1a: Golurk`.

**The obvious explanation is WRONG and was checked before being written.** The authority does check type
immunity (step 2) above accuracy (step 4) — `trySpreadMoveHit`'s step list, `sim/battle-actions.ts:553-577` —
but **so do we**: `medicham2-browser.js:28980` is
`_STEPS=[_stepInvuln,_stepTryHit,_stepTypeImm,_stepTryImm,_stepAccuracy, …]` and `:29008` walks it
step-outside/target-inside. `_stepTypeImm` (`:25872`) refuses an Electric move into Golurk's Ground on
`typeEffAgainst(...) === 0`. The pipeline order is already right and is not the cause.

Two candidates remain and neither can be settled without playing the game:

1. our `-miss` came from **step 0** (`_stepInvuln`) — we believe Golurk is semi-invulnerable and the
   authority does not. The line before is a Dire Claw `-miss` at 100 accuracy, consistent with a
   semi-invulnerable Golurk in OUR engine and an evasion miss in the authority's;
2. `effMoveType`/`typeEffAgainst` returned non-zero for that pair on that board.

**Do not guess between them.** The command is in `## OWED, NOT RUN`.

---

# B. THE MECHANICS CLAUSE — eight counted of sixteen diverging

`classifyMechanics` at HEAD, over the HEAD artifact:

| bucket | rows |
|---|---|
| **COUNTED (the failing 8)** | cottonspore 31, shellsidearm 101, smackdown 59, stringshot 46, switcheroo 85, teeterdance 33 (clicks); berserk 56, sandforce 34 (teams) |
| DECLARED (1) | supremeoverlord — AUTHORITY-WRONG |
| BELOW SHELF (7) | corrosivegas 1, gastroacid 11, healbell 0, recycle 22, reflecttype 11, sweetscent 1, leppaberry 1 |
| UNKNOWN REACH / EXCUSED | 0 / 0 |

## THE DECLARED ROW HAS ALREADY GONE — nothing to delete

`ability:supremeoverlord` still DIVERGES in the artifact, but the shared declaration (`AUTHORITY-WRONG`,
"Supreme Overlord `fallenundefined`") already matches its cause and subtracts it in BOTH clauses — 5 games
on the whole-game side and this 1 row on the mechanics side, off the same declaration. That is why the
clause reads **8 of 16** and not 9. **No row needs deleting; the plumbing is done.** Leave the family alone.

## B1. A SPREAD STATUS MOVE RUNS ITS WHOLE GAUNTLET ON ONE TARGET BEFORE STARTING THE NEXT

**Closes 3 of the counted 8 plus 2 below the shelf — 5 rows. THE SINGLE FIX THAT CLOSES THE MOST.**

Cotton Spore, String Shot, Sweet Scent and Teeter Dance all part in the same shape: the authority prints
`|-activate|p2b: Charizard|move: Protect` and *then* the effect on p2a; we print the effect on p2a and then
the Protect. Corrosive Gas parts identically one branch over.

`trySpreadMoveHit` runs **step outside, target inside** — every target's step-1 answer (Protect, Wide
Guard, the absorbing abilities, Good as Gold) is given before ANY target reaches the hit loop. The
`affect` branch of medicham2 (`:21621` onward) is target-outside:
`for(const _t of _tl){ … shieldRefuses … subBlocks … refusesStatusMoves … absorbRefusal … apply … }`.
Its own comment states the wrong model in so many words — *"EVERY TARGET RUNS THE WHOLE GAUNTLET ON ITS
OWN. Showdown resolves each body through its own TryHit"* — which is true per target and false about the
ORDER.

- **Board or narration:** ANNOUNCEMENT-ONLY on all five, and that is measured, not assumed —
  `board.verdict: "ANNOUNCEMENT-ONLY"`, `diffs: []`, `state_parted_on_turn: null`, 402 leaves compared.
- **Not a tie.**
- **The fix:** give the `affect` branch the same `_STEPS` shape the damaging branch already has, ideally by
  sharing it. **Corrosive Gas is the fifth row and needs the same in the `trickitem` branch** —
  `playerAction` classifies it there, so the `affect` fix alone leaves it open.

## B2. SMACK DOWN PLANTS ITS VOLATILE ON A BODY THAT IS ALREADY ON THE FLOOR

**1 counted (59 clicks) + gastroacid below the shelf. A DERIVATION gap, not an engine branch.**

We write `|-start|p2a: Feraligatr|move: smackdown` where the authority writes nothing. The authority's
Smack Down condition (`data/moves.ts`) computes `applies` from Flying type, Levitate/Earth Eater, Iron
Ball, Ingrain, Gravity and the Fly/Bounce/Magnet Rise/Telekinesis volatiles, and `if (!applies) return
false;` — no volatile, no line.

**This was checked on tag shape, not by grep.** `data/tags.json` gives `smackdown`
`statusInflict: {volatile:"smackdown", chance:100, to:"target"}` — an unconditional 100%. **There is no tag
anywhere that carries a volatile's own `onStart` gate**, which is the same hole `immunityGate` already
fills for `onTryImmunity` (Switcheroo carries it, with `hook`, `handler`, `announces` and `step`). Derived
over the format, **eight legal moves have a `volatileStatus` whose condition can refuse itself**:
dragoncheer, encore, attract, disable, focusenergy, gastroacid, smackdown, torment.

- **Board or narration:** ANNOUNCEMENT-ONLY, with the honest caveat the artifact itself prints —
  `uncomparable_leaves: ["volatile:smackdown"]`, `core_leaf_unchecked: true`. The comparator could not see
  the volatile it is arguing about. Read the verdict as "no OTHER leaf parted".
- **The fix:** derive the gate the way `immunityGate` was derived. Closes Smack Down and Gastro Acid and
  guards six more.

## B3. SAND FORCE BOOSTS ONE TYPE OF THREE, AND ITS MULTIPLIER IS A DECIMAL WHERE THE AUTHORITY USES 4096ths

**1 counted (34 teams). BOARD-MATERIAL, and the smallest fix on this list.**

`data/tags.json`: `sandforce → damageBoost {mult: 1.3, onType: "Rock", inWeather: ["sand"]}`.
The authority: `if (move.type === 'Rock' || move.type === 'Ground' || move.type === 'Steel') return
this.chainModify([5325, 4096]);` — Champions overrides nothing (`data/mods/champions/abilities.ts` carries
no `sandforce`). **Two errors in one row:** the derivation kept the first arm of a three-arm disjunction,
and `5325/4096 = 1.30005`, not `1.3`.

The staged trigger is Bulldoze — a **Ground** move — so the boost never fires on our side at all: the
authority deals more, we deal less, and the gap is one hit.

- **Board or narration:** BOARD. `board.verdict: "STATE"`, `p2.active[0].hp` 658 (us) vs 642 (authority),
  bucket `off-by-4-or-more`, and the control arm (Sand Rush on the same body) reads NO-DIVERGENCE — the
  knob was cleared and the instrument could have seen a difference.
- **Blast radius, printed rather than assumed:** `onType` is a single string on all 29 `damageBoost` rows
  in `tags.json`, and Sand Force is the only ability in this format whose handler names more than one type.
  So the shape must become a list, and today it has exactly one member. The `1.3` vs `5325/4096` half is
  the same class of error `MEDI_FALLEN_APPROX` documents as worth a whole HP.

## B4. BERSERK BOOSTS BEFORE THE HIT COUNT IS ANNOUNCED

**1 counted (56 teams).**

Scale Shot into Drampa: the authority writes `|-hitcount|p1a: Drampa|2` and then `|-boost|…|spa|1`; we
boost first. `hitStepMoveHitLoop` emits `-hitcount` at `sim/battle-actions.ts:978`, at the very end of the
loop; Berserk's hook is `onAfterMoveSecondary`, run by `afterMoveSecondaryEvent` (`:814`) **after** the
loop returns.

This is the un-swept half of a fix that already landed: `MEDI_SELFBOOST_IN_LOOP` moved Scale Shot's *own*
stat lines below `-hitcount`; the `AfterMoveSecondary` hook was not moved with it.

- **Board or narration:** ANNOUNCEMENT-ONLY (`diffs: []`, control arm NO-DIVERGENCE).
- **Blast radius:** derived over legal carriers, exactly two abilities ride `onAfterMoveSecondary` in this
  format — **Berserk** (Drampa, Drampa-Mega) and **Pickpocket** (Weavile, Barbaracle, Grimmsnarl,
  Tinkaton). Pickpocket steals an item, so the position is not cosmetic there.

## B5. SWITCHEROO ANNOUNCES ITSELF; THE AUTHORITY ANNOUNCES TRICK

**1 counted (85 clicks). Pure naming, one line.**

`data/moves.ts` switcheroo's `onHit` literally writes `this.add('-activate', source, 'move: Trick', '[of] …')`
— Switcheroo borrows Trick's activation message and then attributes the two `-item` lines to
`[from] move: Switcheroo`. We write `move: switcheroo` for the activation.

- **Board or narration:** ANNOUNCEMENT-ONLY, `diffs: []`. The item swap itself agrees.
- Cheapest row on the list. It is a string, and it must come off the handler rather than a name table.

## B6. SHELL SIDE ARM IS MISPRICED — AND THE OBVIOUS CAUSE IS RULED OUT

**1 counted (101 clicks). BOARD-MATERIAL. Cause not identified; do not start from the assumption below.**

Slowbro-Galar into Feraligatr: the authority leaves the target at 861/960, we leave it at 872/960 —
`board.verdict: "STATE"`, `active[0].hp` 752 (us) vs 741 (them), `off-by-4-or-more`.

**The mechanic IS absent**, and that part is solid: Shell Side Arm's `onModifyMove` recomputes the physical
and special damage formulas and flips `move.category` to Physical when physical wins (coin flip on a tie).
`data/tags.json` has no category-choosing tag at all — the closest thing is
`dualPurpose: {atFoe: "90 BP attack", atAlly: "different effect"}`, which is **prose**, and medicham2's only
reader of `dualPurpose` is Pollen Puff's ally heal.

**But it does not explain this row.** Derived from the Champions dex at level 50 / 0 EV / 31 IV:
Slowbro-Galar atk 120 = spa 120, Feraligatr def 120, spd 103, giving physical 39 against special 46 — so
the authority keeps **Special**, which is what we already use. Under `bottom-tie-first` (min damage, crit
forced) the two engines are about 5 units of base damage apart, and neither the category nor the roll
accounts for it.

**The probe must therefore do two separate things**, or it will "fix" Shell Side Arm and leave this row
red: (a) stage a pair where physical actually beats special and assert the category flips; and (b) re-derive
this fixture's stat lines on both sides and find where the 5 base-damage units come from.

## B7. THE SEVEN BELOW THE SHELF, NAMED SO THEY ARE NOT REDISCOVERED

corrosivegas (1 click, **same root as B1**), gastroacid (11, **same root as B2**), recycle (22),
reflecttype (11, STATE), healbell (0, STATE), sweetscent (1, **same root as B1**), leppaberry (1 team).
Three of the seven fall out of fixes already on this list. `reflecttype` and `healbell` carry
`board.verdict: "STATE"` and are the only board-material rows in the shelved set.

---

# THE RANKING — by what one fix closes, not by count

| # | fix | closes | board-material? |
|---|---|---|---|
| 1 | **Spread status moves: step outside, target inside** (share `_STEPS` with the damaging branch; do the `trickitem` branch too) | **5 mechanics rows**, 3 of the failing 8 | no (measured) |
| 2 | **Faint replacements: announce every switch, then ONE batched entry event, sorted by the authority's key** | **3 of the 8 narration games** | not in these three; yes as a class (a hazard KO) |
| 3 | **Derive a volatile condition's own `onStart` gate**, the way `immunityGate` was derived | 2 mechanics rows, guards 6 more moves | leaf uncomparable — treat as unknown |
| 4 | **`RESIDUAL_EXPIRY_SITES` must admit `volatile`** | 1 whole-game game, corrects 6 clocks | no here; Taunt/Heal Block gate legality |
| 5 | **Sand Force: `onType` becomes a list, `mult` becomes 5325/4096** | 1 mechanics row | **YES** |
| 6 | **Run the `onUpdate` berries after each hit of a multi-hit** | 1 whole-game game | **YES as a class** (masked by the 12-turn cap) |
| 7 | **`AfterMoveSecondary` below `-hitcount`** | 1 mechanics row (+ Pickpocket) | no |
| 8 | **Switcheroo says `move: Trick`** | 1 mechanics row | no |
| 9 | **Shell Side Arm** — category choice absent AND an unexplained 5 base damage | 1 mechanics row | **YES** |
| — | **Zap Cannon / Golurk** — cause unknown; step order already correct | 1 whole-game game | no |
| — | **Two Tailwinds** — an EXACT TIE in the authority | 2 whole-game games | no |

**One fix closes the most: #1.** **The most valuable fix is #2** — three games, the only whole-game
mechanism that changes who is standing when hazards are up, and half of it (the replacement order) has
already been chased twice without a mechanism.

**Two of the nine whole-game divergences (A4) are not defects.** If they are declared, the clause becomes
**7 of 961** with no code change, and the honest arithmetic for the remaining work is six games, not nine.

---

## OWED, NOT RUN

Nothing below was executed. Every command assumes
`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` is exported, and heavy runs go through
`tools\lownode.cmd` per CLAUDE.md.

```bash
# 1. SETTLE A5 — the only whole-game row with no mechanism. Replay the one game, both streams.
SHOWDOWN_PATH=... node engine/replay_one.js \
  --seed "gen9championsvgc2026regmbbo3-2660356793 vs gen9championsvgc2026regmbbo3-2660492912" \
  --config pair-protect-bust --turn 10
#    read: does medicham2 hold _charging/_invuln on Golurk at that moment (step 0),
#    or does typeEffAgainst return non-zero for Zap Cannon into Ground/Ghost?

# 2. SETTLE B6 — the two halves of Shell Side Arm, separately.
#    (a) a pair where physical BEATS special, asserting the category flips  -> a new probe
#    (b) re-derive both engines' stat lines on the staged slowbrogalar/feraligatr pair
SHOWDOWN_PATH=... node engine/all_mechanics_fire.js --only shellsidearm --kind moves

# 3. RE-DERIVE THE TAG BEFORE TOUCHING SAND FORCE, and PRINT what the new shape matches.
SHOWDOWN_PATH=... node engine/tag_dex.js            # do NOT --write until the match list is read
SHOWDOWN_PATH=... node engine/mod_audit.js sandforce

# 4. AFTER ANY ENGINE CHANGE — in this order, and nothing else in flight.
node tests/test-mechanics.js                                   # regenerates data/mechanics-census.json
SHOWDOWN_PATH=... tools\lownode.cmd engine\all_mechanics_fire.js --kind all --write
SHOWDOWN_PATH=... tools\lownode.cmd engine\game_differential.js --games 961 --write \
  --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json
node engine/status.js                                          # live must not go down

# 5. THE CAP-30 QUESTION, WHICH NO NUMBER IN THIS REPORT ANSWERS.
SHOWDOWN_PATH=... tools\lownode.cmd engine\game_differential.js --games 961 --turns 30 --write \
  --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json
#    A cap-30 count is NOT comparable with the 9 above. Report it as its own figure.

# 6. A DECISION, NOT A COMMAND.
#    The two Tailwind games are an exact tie in the authority (Side handlers carry no speed;
#    effectOrder is not filled for Residual; comparePriority returns 0; speedSort shuffles).
#    Either medicham2 draws the same shuffle at the same address, or the pair is DECLARED.
#    Until that is chosen, they should not be counted as engine defects.
```

### Not re-reported — confirmed closed or declared

The five `fallenundefined` games and the one `supremeoverlord` mechanics row are the SAME declaration and
are already subtracted from both clauses. Telepathy's wording, Psych Up's copy line, Spicy Spray's immunity
line, Throat Chop's clock, the Protect stage-ordering card, the hazard recap line, White Herb's entry path,
transform-reverts-on-faint and recoil-after-clamp appear nowhere in the HEAD artifacts.

### Still open with evidence and NOT among the nine

A self-aimed volatile owing a failure line (Imprison), and a fainted mega not regressing its forme, are
real and invisible to both clauses today — no game in the pinned pool parts on either. They belong on the
roster/census side of Will's 2026-08-23 split, not on this worklist.
