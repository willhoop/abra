# Narration timing: three rules landed, eight of the 42 cleared, board-material flat

**ENGINE, 2026-08-23.** Will: *"i want us to announce failures and generally match the timing of
narration of showdown please fix."* / *"i dont want unncessary bloat or you adding gates or tests on
gates or tests that fail, just simple bulletproof fixes."*

Historical record, per `docs/_reports/` convention. Not current state; superseded by the register rows
it feeds. Every figure is read out of `data/game-differential.json`, `data/mechanics-census.json` or
the roster artifacts, or cited to a line in the pinned Showdown checkout.

---

## 0. VERDICT

**Three rules landed. Narration 42 → 34 games. Board-material 30 → 30 games. Nothing else moved.**

The working list came from `docs/_reports/2026-08-23-narration-order-derivation.md`, which ranked
eleven rules. **The brief's rank-1 item is smaller than it reads** and that is the first thing to
record: R1's headline of 8 games includes **5 Supreme Overlord `fallenundefined` games that are
already DECLARED NOT-A-DEFECT** in `engine/quarantine.js:1118` (the authority emits the literal string
`fallenundefined`; reproducing a typo is not correctness). Those five are excluded from the headline
`undeclared` figure and no fix may claim them. R1's real size is **3** — Syrup Bomb 1, Throat Chop 2.

| rank landed | rule | narration games cleared | state? |
|---|---|---|---|
| 1 | **A move's stat change onto ANOTHER body announces its clamped zero** (R3) | **5** | no |
| 2 | **A breaking Substitute writes `-end`, not `-activate\|[damage]`** (R7) | **2** | no |
| 3 | **A `[silent]` `-end` is a protocol event; and Syrup Bomb dies with its source** (R1, one of three triggers) | **1** | **yes, and it was a real board bug** |

---

## 1. THE WHOLE-GAME NUMBERS — A RE-BASELINE, NOT A DELTA

Arm **`middle`** (real dice, the default), release **`985a28a22653`**, `--games 1200` resolving to
**961 played games**, turn cap 12, `--team-store data/team-pool-frozen`,
`--census data/verification/census-pin-9446a684709d.json` (643 rows — the same pin the standing figure
used, so the steering is identical).

| quantity, arm `middle` | before (`dd3b8bdd482f`) | after (`985a28a22653`) |
|---|---|---|
| protocol parted (raw `diverged`) | 72 | **64** |
| **undeclared = diverged − declared** (the published headline) | 67 of 961 = 7.0% | **59 of 961 = 6.1%** |
| distinct causes | 66 | **58** |
| **narration-only games** | 42 | **34** |
| **board-material games** | **30** | **30** |
| board-material causes | 28 | **28** |
| unknown games | 0 | **0** |
| VOID (instrument desync) | — | 2 of 961, not divergences |

**BOARD-MATERIAL DID NOT RISE**, which was the brief's stop condition. Nine causes cleared, one new
cause appeared, and the new one is the same game wearing a different label — see §5.

**Do not subtract the two rate figures as a trend.** The 7.0% baseline that `engine/status.js` prints
a "direction of travel withheld" note about was stamped under `A/top-tie-first/…`; both figures above
are `A/middle/…` and are directly comparable to each other only.

---

## 2. R3 — A MOVE'S STAT CHANGE ONTO ANOTHER BODY ANNOUNCES ITS CLAMPED ZERO. 5 games.

`sim/battle.ts:2072-2077`, the two `else` arms of `if (boostBy)`, which are exact inverses:

```js
} else if (effect?.effectType === 'Ability') {
    if (isSecondary || isSelf) this.add(msg, target, boostName, boostBy);   // boostBy === 0
} else if (!isSecondary && !isSelf) {
    this.add(msg, target, boostName, boostBy);                              // boostBy === 0
}
```

A move's primary table reaches `boost(moveData.boosts, target, source, move, isSecondary, isSelf)`
with both flags **false** (`sim/battle-actions.ts:1198`), so it announces. The word is chosen at
`:2040` — `-unboost` when `boost[boostName] < 0 || target.boosts[boostName] === -6` — and after
`getCappedBoost` the clamped delta is 0, so **+6 gives `-boost|stat|0` and −6 gives `-unboost|stat|0`.**

**THE SELF HALF WAS ALREADY DONE AND THAT IS WHY THIS SURVIVED.** The `setup` branch has passed the
`zero` opt-in since 2026-08-18 (`c6dbf65`), so a +6 Swords Dance already printed `atk|0`. **All five
surviving games aim at a body that is not the user** — three Decorate onto a +6 Attack ally, one
Parting Shot and one Tearful Look onto a −6 Attack foe.

Three sites opted in, each on a derived predicate rather than a name:

| site | branch | membership check made before wiring |
|---|---|---|
| `medicham2:18813` | `boostsTarget` (the ally/foe boost move) | 6 members — Howl, Aromatic Mist, Coaching, Decorate, Flatter, Swagger. **None carries `secondaryStatEffect`**, so no secondary is in this branch. |
| `medicham2:17885` | `sc.target` (a status move's declared table) | **63 entries over 500 moves. 23 have no `secondaryStatEffect` — those announce. 40 do, and for all 40 the `statChange.target` boosts are byte-identical to the `secondaryStatEffect` boosts (checked, zero mismatches) — those stay silent.** |
| `medicham2:19530` | `statChangeInCode.on === 'target'` | 3 members — Defog, Parting Shot, Strength Sap. All are `this.boost(...)` out of a move handler with neither flag. |

**`chance` CANNOT ANSWER THE QUESTION AND THAT IS THE WHOLE DERIVATION.** Icy Wind, Snarl, Low Sweep,
Breaking Swipe and 15 more are `secondary: {chance: 100, boosts: {...}}` — a secondary that always
fires — and would read as primary on `chance` alone. All 17 entries under chance 100 are in the
secondary group, so the two predicates never disagree today; `chance` is kept as a second conjunct so
that a sub-100 PRIMARY arriving later reads as silent rather than being announced by an assumption.

**THE NEGATIVE CONTROL IS A DIFFERENT ARM OF THE SAME `if`.** A `self:` rider goes through `selfDrops`
→ `moveHit(source, source, move, moveData.self, isSecondary, true)` (`sim/battle-actions.ts:1327`)
with isSelf TRUE, so the authority writes **nothing** at the cap. Close Combat into a body already at
−6 Defence is that case, and it is asserted in the probe. A blanket "emit whenever the delta is zero"
passes the two capped arms and fails this one.

**Probe:** `tests/test-mechanics.js`, `move`/`boostsTarget`,
*"a move's stat change onto ANOTHER body announces its clamped zero"*. Red before, green after:

```
before  Decorate onto a +6 ally ["|-boost|p1b:vaporeon|spa|2"]              <- the atk line missing
        Parting Shot onto a -6 foe ["|-unboost|p2a:garchomp|spa|1"]         <- the atk line missing
after   ["|-boost|p1b:vaporeon|atk|0","|-boost|p1b:vaporeon|spa|2"]
        ["|-unboost|p2a:garchomp|atk|0","|-unboost|p2a:garchomp|spa|1"]
control at +4 / -4 unchanged; Close Combat's self rider at -6 still prints NOTHING
```

**STATE:** none. `TR.bst` is a trace push plus two counters — read at `medicham2:2436-2452`. The stage
itself was already clamped and written on the line above every one of the three sites, so the only
thing that changed is whether the line is printed. `_mvRes` is not on any of these paths.

---

## 3. R7 — A BREAKING SUBSTITUTE WRITES `-end`, NOT `-activate|[damage]`. 2 games.

`data/moves.ts:18350-18356` — the two lines are the two arms of one `if`:

```js
if (target.volatiles['substitute'].hp <= 0) {
    if (move.ohko) this.add('-ohko');
    target.removeVolatile('substitute');       // -> onEnd -> add('-end', target, 'Substitute')  (:18367)
} else {
    this.add('-activate', target, 'move: Substitute', '[damage]');
}
```

`-activate|…|[damage]` is the **else** arm: the doll reporting that it soaked a hit and is still
standing. This engine printed **both** on a break, which says the doll survived and then vanished.
Both cards read `extra event emitted by medicham2 :: |-end|…|substitute <> |-activate|…|[damage]`.

**STATE: none, and it is checkable rather than claimed.** `tg._sub` is already clamped to 0 on the
line above and `TR.vend` already fired on exactly this condition; the edit only chooses which of two
pure trace pushes runs (`TR.act` and `TR.vend` are one-line `this.push(...)` at `medicham2:2329` and
`:2478`).

**THE BRIEF'S WARNING ABOUT SUBSTITUTE IS ACKNOWLEDGED AND IT DOES NOT BITE HERE.**
`end_state_not_compared` names Substitute HP, so the board comparator could not vouch for a fix that
changed whether the doll is removed. This fix does not touch removal — it was already correct, and the
probe asserts the doll's remaining HP (0 on the break arm, 12 on the survive arm) directly out of the
engine rather than out of the protocol.

**Probe:** `tests/test-mechanics.js`, `move`/`substitute`, *"a substitute that BREAKS writes `-end`,
and only one that survives writes `-activate|[damage]`"*. Both directions are asserted — a break may
carry no `-activate` AND a survival may carry no `-end` — so a fix that merely swapped which line is
always printed fails it.

**ONE THING FOUND HERE AND NOT FIXED, REPORTED:** the authority CLAMPS `damage` to the doll's
remaining HP and assigns the clamped value to `source.lastDamage`, which recoil and drain then read
(`data/moves.ts:18345-18348`). This engine passes the unclamped `dmg` to both. **That is state, not
narration**, and it is left for the road that owns it.

---

## 4. R1 (ONE OF THREE TRIGGERS) — SYRUP BOMB. 1 narration game, and a real board bug behind it.

Two halves of one condition, and the first is the expensive one:

```js
data/moves.ts:18770-18774   onUpdate(pokemon) { if (source && !source.isActive)
                              pokemon.removeVolatile('syrupbomb'); }
data/moves.ts:18778-18780   onEnd(pokemon) { this.add('-end', pokemon, 'Syrup Bomb', '[silent]'); }
```

**(a) `[silent]` MEANT "EMIT NOTHING" IN THIS ENGINE, AND IT MEANS "SUPPRESS THE ANIMATION".** The tag
`endsSilently` records the `[silent]` argument on the condition's own `onEnd`; the reader at
`medicham2:25668` was `if(TR && !endsSilently) TR.vend(...)`. The line is in the authority's log, and
the differential's `display-flags` rule strips the flag before comparing, so the authority reduced to
`|-end|p2a|syrupbomb` and this engine reduced to nothing. **One member in the whole format**
(`syrupbomb.perTurnBoost`), printed before the change. The flag is now EMITTED rather than dropped —
`TR.vend`'s third field, which `push()` omits when undefined, so every non-silent member is
byte-identical to before.

**(b) THE VOLATILE HAD NO SOURCE-LEFT READER AT ALL, AND THAT IS A BOARD BUG.** Measured on a staged
board before a line changed — Hydrapple Syrup Bombs a Feraligatr on turn 1 and pivots out on turn 2:

```
before   t1 spe -1   t2 spe -2   t3 spe -3   t4 (clock out, no line)      final -3
after    t1 spe -1   t2 |-end|p2a:feraligatr|syrupbomb|[silent]           final -1
```

**Three whole stages of Speed taken from a body the source had abandoned.** The removal is placed in
`_updateAll` — this engine's Update pass — in the same loop position as Fling's spend, for Fling's
reason: both are VOLATILE `onUpdate` handlers and run above the item handlers on the same body. That
position is what puts the `-end` in front of the next action's `|switch|` line, which is exactly where
the differential reads the authority's (`|-end|p2a: Annihilape|Syrup Bomb|[silent]` immediately before
`|switch|p2a: Gengar`).

Membership is the `perTurnBoost` table, not a name; `_volSrc` was already booked for exactly this
family and no other, so there is no new lifetime to keep in step. "Still active" is membership of the
four slots, which is what `Pokemon#isActive` means — a body that has FAINTED but not been replaced is
still active in both engines, so a KO'd source does not end the volatile early.

New counter `MEDSEEN.perTurnVolatileSourceLeft`, declared with its zero-reading.

**STATE: YES, AND IT IS THE POINT.** `engine/move_result_state.js` compares `moveLastTurnResult`
against `_mvResLast`; **no edit in this pass touches `_mvRes` on any path** — the three R3 sites, the
Substitute arm and both Syrup Bomb halves are `TR.*` calls plus, in (b), a `delete` on `_vol` /
`_volSrc`. The state that moved is the volatile's own lifetime, and it moved TOWARD the authority,
asserted directly in the probe (stage −1 vs −3) rather than through the protocol.

**Probe:** `tests/test-mechanics.js`, `move`/`perTurnBoost`, *"Syrup Bomb ends when its SOURCE leaves
the field, and its `[silent]` end is still a line"*. Both the LINE and the STAGE are asserted, because
the line alone would pass an engine that announced the end and kept draining Speed.

---

## 5. THE ONE NEW CAUSE, AND WHY IT IS NOT A REGRESSION

```
- event missing from medicham2   :: |-miss|p1a|p2a <> |upkeep
+ unrelated event mismatch       :: |-miss|p1a|p2a <> |-boost|p2a|atk|0
```

**Same game, same materiality (BOARD-MATERIAL, board parted turn 11), same count.** The board-material
totals are 28 causes / 30 games before and after. Before the fix this engine printed nothing at the
split; now it prints the clamped Decorate line, so the cause string changed.

**AND IT NAMES A REAL DEFECT THAT IS NOT MINE.** The authority's line is
`|move|p1a: Alcremie|Decorate|p2a: Dragapult|[miss]` into a Dragapult that is semi-invulnerable from
Phantom Force. **This engine lands Decorate on a vanished body.** A `boostsTarget` move is not gated on
invulnerability here. Board-material, pre-existing, unfixed, filed below.

---

## 6. WHAT I DID NOT DO, AND WHY — EACH WITH ITS EVIDENCE

### 6.1 R4, the weather upkeep line, 5 games. STILL UNATTRIBUTED, and three hypotheses are now dead.

The derivation report said the cause was unattributed and named the suppressor clause
(`medicham2:24881`, `field.weather && !field.wSup`) as a certain but probably-irrelevant defect. **I
staged the upkeep line four ways and it fires correctly in every one**, so that clause is not it
either:

```
rain set by the MOVE, turns 1-4                       -weather|raindance|[upkeep] on all four
rain set by DRIZZLE at battle start, turns 1-4        -weather|raindance|[upkeep] on all four
rain set by DRIZZLE switched in MID-TURN on turn 1    upkeep fires on turn 1
all four bodies switching on the same turn (0/1/2/4)  upkeep fires on every one
```

The last arm was the specific hypothesis the cards suggested — every one of the five divergent games
has all four slots switching on the turn the line goes missing — and it is refuted.

**A REPLAY WOULD SETTLE IT AND I COULD NOT GET ONE.** `engine/replay_one.js --release dd3b8bdd482f
--games 1200` answered `SEED NOT IN THIS POOL` because the pool selection is steered by the LIVE
census, which this pass moved (651 → 654 rows). Re-running it under `--census
data/verification/census-pin-9446a684709d.json` is the next step and it belongs to whoever picks this
up. **OWED, NOT RUN.**

### 6.2 R2, `|faint|` at the step boundary, 5 games. NOT ATTEMPTED — it is a faint QUEUE, not a line.

`Pokemon#faint()` (`sim/pokemon.ts:1587`) queues and writes nothing; the line comes from
`faintMessages()` at **eight** step boundaries. **This engine has 27 sites that write `|faint|` inline
at the moment HP reaches zero**, each of them also doing `noteFaint`, `fainted=true` and (in some) a
side counter. Deferring the line is a real architectural change with 27 call sites and a live risk of
moving a board, which is the brief's stop condition. Left whole rather than half-done.

One contained member of it is worth naming for whoever takes it: `medicham2:25787`, the Perish Song
death, writes `TR.dmg(x)` **and** `TR.faint(x)` where the authority calls `faint()` and writes no
`-damage` at all (card: `|upkeep <> |-damage|p1b|0fnt`). That one is a two-line fix and it IS state —
`damage()` runs the Damage event and sets `hurtThisTurn` / `lastDamage`; `faint()` does none of it.

### 6.3 R6, the target's berry above the attacker's recoil / Life Orb, 3 games. DERIVED, NOT LANDED.

Confirmed at the lines (`sim/battle-actions.ts:971` `eachEvent('Update')` inside the hit loop,
`faintMessages` at `:976`, `applyRecoilDamage` at `:983`) and reproduced on a staged board:

```
lifeorb + sitrus   |-damage|p2a:milotic|58/170
                   |-damage|p1a:scizor|131/145|[from]item:lifeorb    <- ours, too early
                   |-enditem|p2a:milotic|sitrusberry|[eat]
                   |-heal|p2a:milotic|100/170|[from]item:sitrusberry
```

**The fix is to run the Update pass at the authority's position — inside the hit loop — and this
engine runs it at the TOP of the next action.** `_updateAll` fires Fling's spend, three berry families
and the White Herb triggers over ALL four bodies; calling it mid-move is a broad reordering with real
board risk, not a line move. It is the right fix and it is a batch of its own.

### 6.4 R1's third trigger, Throat Chop, 2 games. DEFERRED WITH A FINDING THAT MATTERS MORE.

The `-end` is genuinely missing (`data/moves.ts:19417-19419`, `onResidualOrder: 22`). **But the clock
underneath it looks one turn long and emitting the line would have printed it in the wrong place.**
Traced by hand from `medicham2`'s own tick:

```
authority  duration 2. applied turn 1. residual t1: 2->1. t2 blocked. residual t2: 1->0 END. t3 FREE.
this engine _noSound = turns+1 = 3. residual t1: 3->2. t2 blocked. residual t2: 2->1.
            t3 STILL BLOCKED (1 > 0). residual t3: 1->0.  t4 free.
```

**One extra turn of silence, which is state and not narration**, and it needs a paired check against
the authority before either half moves. `throatchop@22` is also on this engine's own declared
`residualExpiryDeferred()` list — it ticks in the foot-of-turn block, not at order 22 — so the line's
POSITION is separately open. Reported, not fixed.

### 6.5 The ties — excluded, as the brief instructed.

**Tailwind on both sides, 2 games. NOT A DEFECT, derived, no measurement needed.** `effectOrder` is
assigned only for `SwitchIn` and `RedirectTarget` (`sim/battle.ts:994-1000`) and Showdown's own TODO
at `:996` says the in-game rule is different. Two Tailwinds expiring together tie on all five
`comparePriority` keys and go to `prng.shuffle` at `:455`. There is no correct answer to implement.

**The suspected ties were not settled and I did not invest in any row that smells like one** — the
three Protect/Detect rows, one of the two mega rows, one switch row, one switch-in ability row. The
brief's owed correction (the "exact speed tie, NOT A DEFECT" filing resting on a reason
`game_differential.js:1229-1257` retired in 3.74.0) is **still owed**: I touched none of those rows,
so I inherited nothing and settled nothing.

---

## 7. WHAT ELSE THIS PASS TOUCHED, AND WHAT IT COST

**THE ROSTER AND `all_mechanics_fire` WERE RE-RUN, NOT BECAUSE THEY CHANGED BUT BECAUSE THEY WOULD
OTHERWISE HAVE READ AS FAILING.** `engine/status.js` withholds a roster artifact measured on a
different release, so cutting `985a28a22653` turned three PASS clauses into three
`MEASURED AGAINST A DIFFERENT ENGINE` FAILs. Re-run against the new release, all three verdict vectors
are **byte-identical** to the previous release's:

```
items      DIFFER 0  DID-NOT-FIRE 0  MATCH 139  COULD-NOT-STAGE 8   DEFERRED 1
abilities  DIFFER 0  DID-NOT-FIRE 0  MATCH 130  COULD-NOT-STAGE 141 CONTROL-NOT-QUIET 45
moves      DIFFER 0  DID-NOT-FIRE 0  MATCH 475  COULD-NOT-STAGE 22  DEFERRED 3
```

`data/all-mechanics-fire.json` likewise: moves 20 / abilities 9 / items 1 diverged, identical to the
artifact it replaced. **One trap on the way:** the first re-run used the default `--kind moves`, which
wrote an artifact with no ability or item rows at all and made the clause read
*"THE REACH FILTER CANNOT BE APPLIED"*. Re-run with `--kind all`. A narrower artifact is not a cleaner
one.

**Gate shape unchanged: 3 of 8 clauses fail, the same three as before this pass** — the whole-game
differential, the staged-mechanics comparison, and the open-defect register clause.

---

## 8. THE MUST-NOT-MOVE LIST, CHECKED

| | required | measured |
|---|---|---|
| damage differential `--n 6000 --seed 20260804` | 0 of 6000 | **0 of 6000, midpoint and all 16 corners** |
| census | 651 probed / 651 live / 0 missing | **654 / 654 / 0** — three probes added, none missing |
| census ratchet | `unarmed` / `directCall` may not rise | **0 unarmed, 1 direct-call — unchanged, no `--accept`** |
| hollow probes | 0 | **0** |
| board-material games | must not rise | **30 → 30** |

---

## 9. OWED, NOT RUN

```
node engine/replay_one.js --census <the pin> …          NOT RUN — needed to attribute the weather
                                                        upkeep 5; the live census moved under it (§6.1)
node engine/explain_divergence.js --dump-speeds          NOT RUN — the tie-settling command in the
                                                        derivation report; no tie row was touched
node engine/quarantine.js                                NOT RUN — its roster and differential clauses
                                                        were run directly, at the pins
node tests/run-all.js                                    NOT RUN — several of its gates predate this pass
node engine/argmax_paired.js (decision impact)           NOT RUN — data/decision-impact.json is still
                                                        absent, so nothing is excused on it
tests/interaction_matrix.js                              NOT RUN
node engine/million_run.js                               NOT RUN
```

**No fit, no self-play, no `mew.js`.** `board.js`, `magnemite.js` and `engine-data.js` were not
touched. `docs/ROADMAP.md` was not edited — register row text is proposed in `docs/ENGINE.md`.

**Two untracked files were left alone as instructed:** `data/_pair-pilot.json` and
`data/medicham-represented-clicks.json`.

---

## 10. DEFECTS FOUND AND NOT FIXED — for the register

1. **Decorate lands on a semi-invulnerable body.** `boostsTarget` is not gated on invulnerability;
   the authority writes `|[miss]` + `|-miss|`. Board-material, 1 game, §5.
2. **Throat Chop's silence lasts one turn too long** (`_noSound = turns + 1` against `duration: 2`),
   and its `-end` is missing. State + narration, 2 games, §6.4.
3. **A broken Substitute's `lastDamage` is the unclamped hit**, where the authority clamps it to the
   doll's remaining HP before recoil and drain read it. State, §3.
4. **The Perish Song death writes a `-damage` line the authority does not write**, because it calls
   `damage()` where the authority calls `faint()`. State, 1 game, §6.2.
5. **Growl does nothing in this engine.** Found incidentally while staging R3 —
   `|move|p1a:scizor|growl|p1a:scizor`, target resolved to SELF, no stat moved on either foe, on a
   board where Charm, Tearful Look and Parting Shot all worked. Not investigated; it may be a
   learnset-legality artefact of the fixture rather than an engine defect, and it is named here so the
   next pass stages it deliberately rather than rediscovering it.
