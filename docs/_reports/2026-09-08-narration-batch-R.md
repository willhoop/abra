# NARRATION BATCH R — five mechanisms, sixteen causes

ENGINE. Written as the work happened; the verdict block is the last thing added.

---

## 0. THE SAMPLE, EVERY FLAG AND EVERY PIN

Identical for all four measurements; only `--release` moves.

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node engine/game_differential.js --steering empirical --release <id> \
  --arm middle --end-state --games 1200 --team-store data/team-pool-frozen --turns 50 --write
```

| pin | value |
|---|---|
| census | **`0b88d51b3463`**, 830 rows, `identical to the live census` |
| arm pins | `de38d17e15a2` |
| team pool | `data/team-pool-frozen`, digest `0d103fb9fa87` |
| games played | 961 (of `--games 1200` offered) |
| turns cap | 50 |

**The brief named census `87d990cf3634` and every run of this batch reports `0b88d51b3463`.** Same
830 rows, same `matches_live: true`. Both the before-run and every after-run read the same census, so
the comparison inside this batch is sound; the discrepancy is recorded here rather than smoothed over
because a census digest is part of a sample definition.

The releases, in order: `0c5a4da9c512` (baseline, cut by batch Q) -> `5495f4d9dbd8` (R1) ->
`af6a898e02f2` (R2) -> `8772eb46927c` (R3) -> `2c4e125866cc` (R5+R6, the final one).

---

## 1. THE POPULATION, RE-DERIVED AND VERIFIED

Taken from `end_state[0].summary.by_cause` filtered to `materiality === 'NARRATION-ONLY'` on release
`0c5a4da9c512` — **48 causes, 50 games**, never from `first_divergences`. The coordinator's bucketing
was checked row by row against the artifact before any of it was trusted. Two corrections:

- **cluster 3 is FIVE causes, not four.** Rows 23 and 26 are both `|-boost|p2a|atk|0` and are two
  distinct causes because their against-events differ (`|move|p1a|calmmind` and
  `|switch|p1a|metagross,l50|H/H`).
- **cluster 4 (`-fail` field 3) is THREE causes and four games.** The "4" in the brief is the game
  count; row 1 carries two games.

Everything else held exactly.

Cards were read from a dump generated on the baseline release
(`--dump-games 60 --dump-out data/_narrationR-dump.json`, 50 of 53 diverging games; the 3 excluded
are the instrument's own void games).

---

## 2. R1 — THE NON-PERMANENT FORME REVERT IS SILENT (3 causes)

**Probe:** `tests/probe_forme_revert_silent.js`. **Knob:** `MEDI_FORME_REVERT_ANNOUNCES=1`.

### The rule

Champions overrides `clearVolatile` and its own version still closes with
`this.setSpecies(this.baseSpecies)` — so the revert IS Champions behaviour and not mainline's. And it
is silent: `Pokemon#setSpecies` assigns the species and calls `setType`, and writes no protocol line.
The only `detailschange` a faint can produce is guarded by `if (pokemon.formeRegression)` in
`faintMessages` and carries `[silent]`; Champions' `formeChange` sets `formeRegression` in the **Tera
branch alone**, having deleted mainline's second assignment in the Item/mega branch ("Don't revert
Mega Evolutions after fainting"). Counted rather than asserted: **champions 1, mainline 2.** Stance
Change calls `formeChange(targetForme)` with no `isPermanent` at all, so it reaches neither branch.

### What this engine did

`revertTempFormeOnLeave` paid the revert through `formeSwap`, whose whole job is to ANNOUNCE a forme
change — so it wrote `|detailschange|pXY: Aegislash|aegislash, L50` immediately above the `|faint|`.
The trace is now parked around the swap (the same `TR=null` idiom the Stance Change door itself has
used since 2026-08-11) and the swap still runs, because Blade and Shield carry different base stats.

**It closed the switch-out road too, which the pool never surfaced.** Measured before the fix on a
staged pivot: `|-formechange|p2a: Aegislash|Aegislash-Blade|` then, on the switch turn,
`|detailschange|p2a: Aegislash|aegislash, L50|` where the authority writes nothing at all.

### The arms

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| REAL-FAINT | 0 `detailschange` | **1** | 0 |
| REAL-PIVOT | 0 | **1** | 0 |
| CONTROL-FLIP (the `-formechange` INTO Blade) | 1 | 1 | 1 |
| CONTROL-MEGA (a mega evolution) | 1 | 1 | 1 |

CONTROL-MEGA is what separates "the revert is silent" from "`detailschange` was switched off";
CONTROL-FLIP is what stops a simulator with no Stance Change at all sweeping the board. Every arm
also asserts **0 board diffs**, which is what makes "delete the revert" unable to pass.

Counters: `MEDSEEN.formeRevertSilent` (+ `First`), `MEDFAILS.formeRevertAnnounceRestored`.

---

## 3. R2 — A BODY KILLED BY ITS OWN THAWING HIT IS NOT CURED (3 causes)

**Probe:** `tests/probe_thaw_on_a_corpse.js`. **Knob:** `MEDI_THAW_CURES_A_CORPSE=1`.

### The rule

```
cureStatus(silent = false) {
  if (!this.hp || !this.status) return false;                     sim/pokemon.ts:1680-1681
```

Both thaw routes go through it and both are handlers on the `frz` CONDITION —
`onAfterMoveSecondary` for `thawsTarget` and `onDamagingHit` for a Fire move
(`data/conditions.ts:112-121`). Champions overrides `frz`'s `onStart` and `onBeforeMove` and
**neither thaw handler** (asserted in the probe, which prints the mod's own handler list:
`onStart, onBeforeMove`).

### What this engine did, and the comment that was wrong

`_thawCure` re-read the STATUS and its own comment explained why: *"a body that fainted to this hit
carries 'fnt', and `Pokemon#cureStatus` does nothing for it in the authority either"*. **The second
clause is true and the first is not** — this engine leaves `status` at `'frz'` on a corpse, so the
status re-read let every one of them through. The guard is now on the HP, at the same site, and the
comment says so.

All three pool cards are a frozen body killed by its own thawing hit: Scorching Sands, Matcha Gotcha
and Flare Blitz. Two of the three are the `thawsTarget` route and one the Fire route, so both of this
engine's deferred slots (`_thawAms`, `_thawDh`) had to be covered — they share the closure, and the
probe exercises both anyway.

### The arms, and the fixture search

The freeze is a 10% secondary, so the arm is `bottom-tie-first` (every secondary fires, MIN damage)
and the choreography has to hold: the FREEZER must be slower than the victim so the freeze lands after
the victim has already acted, and the KILLER must be faster so the kill lands before the victim's next
action — a frozen body that gets to move thaws itself in `onBeforeMove`. Candidate
(killer, victim) pairs are enumerated in a derived order and the first the AUTHORITY stages is taken;
every earlier one is refused BY NAME. Three were, and one of the refusals is the trap itself:
*"Sharpedo/Scald -> Arcanine-Hisui (the authority DID cure — it thawed before dying)"*.

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| KO-FIRE — Volcarona Flare Blitz into a frozen Scizor | 0 cure lines | **1** | 0 |
| KO-THAWS — Starmie Scald into a frozen Arcanine-Hisui | 0 | **1** | 0 |
| SURVIVES — the same Fire hit into a Toxapex that LIVES | **1** | 1 | 1 |

SURVIVES is the knob-cleared control and is what stops the fix reading as "never thaw". Boards
identical on all three.

Counters: `MEDSEEN.thawRefusedOnFaint` (+ `First`), `MEDFAILS.thawOnCorpseRestored`.

---

## 4. R3 — AN ABILITY'S CLAMPED STAT CHANGE STILL ANNOUNCES, AT ZERO (5 causes)

**Probe:** `tests/probe_ability_zero_boost_line.js`. **Knob:** `MEDI_NO_ABILITY_ZERO_BOOST=1`.

### The rule, and the line that makes it counter-intuitive

```
if (boostBy) { ... }
else if (effect?.effectType === 'Ability') {
  if (isSecondary || isSelf) this.add(msg, target, boostName, boostBy);
} else if (!isSecondary && !isSelf) {
  this.add(msg, target, boostName, boostBy);
}                                                            sim/battle.ts, Battle#boost
```

`effect` is **not** the argument the handler passed. `boost()` opens with `effect ||= this.effect`,
so Defiant, Competitive and Gooey — all three of which pass an explicit `null` — still land in the
ABILITY branch, because `this.effect` while a handler runs IS that ability. Read this run rather than
recalled; the probe asserts it.

The flags, parsed out of the handlers on every run:

| ability | call | flag | zero branch |
|---|---|---|---|
| defiant | `this.boost({ atk: 2 }, target, target, null, false, true)` | isSelf | announces |
| competitive | `this.boost({ spa: 2 }, target, target, null, false, true)` | isSelf | announces |
| gooey | `this.boost({ spe: -1 }, source, target, null, true)` | isSecondary | announces |

Champions overrides none of the three.

### What this engine did

ROADMAP #289 built the emitter (`TR.bst`'s `zero` argument) and made it **opt-in per call site**,
deliberately — *"a blanket `emit whenever d === 0` would invent lines"*. Two ability sites had never
opted in: `retaliateWhenLowered` (Defiant/Competitive) and the punisher boost loop (Gooey). Four of
the five pool causes are the first, one is the second.

The opt-in goes through one new function, `abilityZeroAnnounces(secondaryOrSelf)`, so the two sites
cannot drift on the rule; it takes the flag rather than hard-coding `true`, because a future carrier
that passed NEITHER flag would be silent. Gooey's site reads `_pun.boostsSecondary !== false`, the
SAME expression `_abSaid` was already initialised from, so the two cannot disagree about what the
call passed.

### The arms

| arm | showdown zero lines | medicham2 pre-fix | post-fix |
|---|---|---|---|
| DEFIANT-AT-CAP — Falinks at +6 eats Parting Shot | **2** (the capped Swords Dance, a MOVE primary, and the second retaliation, the ABILITY) | 1 | 2 |
| GOOEY-AT-FLOOR — Pikachu driven to -6 Speed, seventh Nuzzle | **1** | 0 | 1 |
| NOT-AT-CAP — the same Parting Shot from a neutral stage | 0 | 0 | 0 |
| MOVE-SECONDARY-AT-CAP — Lucario at +6 clicks Meteor Mash | **0** | 0 | 0 |

**MOVE-SECONDARY-AT-CAP is the over-match negative and it is the arm that matters.** A clamped raise
arriving as a MOVE SECONDARY refuses in BOTH zero branches — the effect is not an Ability, and
`!isSecondary` is false — so the authority writes nothing. Without it, "emit every zero" would pass.
Every arm also compares the **whole `-boost`/`-unboost` list in order**, not a count, because a count
can be right with the lines on the wrong body.

Counters: `MEDSEEN.abilityZeroBoostAnnounced` (+ `First`), `MEDFAILS.abilityZeroBoostRestored`. The
pre-existing `MEDFAILS.boostZeroSuppressed` reads 2 under the knob and 0 without it, on the same
boards.

---

## 5. R5 — THE ABSORBED GIFT ENDS WHEN THE BODY LEAVES (2 causes), AND THE FAINT ROAD DOES NOT

**Probe:** `tests/probe_absorb_gift_end_on_leave.js`. **Knob:** `MEDI_NO_ABSORB_GIFT_END_ON_LEAVE=1`.

### The rule

`flashfire.onEnd(pokemon)` removes the volatile; the condition's `onEnd(target)` writes
`|-end|TARGET|ability: Flash Fire|[silent]`. The ability's End fires from three places, two of them a
body leaving the field: `setAbility` (the rewrite), and
`this.battle.singleEvent('End', oldActive.getAbility(), ...)` in `sim/battle-actions.ts` at the
comment *"will definitely switch out at this point"*, above the replacement's `|switch|`.

`abRewrite` had paid this line for the rewrite road since 2026-08-29 and said in its own comment that
*"the switch-out road already empties `_vol` wholesale"*. It does — **silently**. One shared function
`endAbsorbGiftVolatile` now serves both roads.

### THE FAINT ROAD IS A NEGATIVE, AND THE PROBE FOUND THAT BY BEING WRONG FIRST

The FAINT arm was written expecting a second line: `faintMessages` DOES fire the corpse's ability End,
below `this.add('faint', pokemon)`, so the argument for a second call site looked airtight. **It was
RED on the AUTHORITY.** The refusal is one level down and is the same shape as `cureStatus`:

```
removeVolatile(status) {
  if (!this.hp) return false;                                    sim/pokemon.ts:2040-2041
```

The arm is kept as the negative that stops this fix being applied to both roads because both roads
"obviously" run the same event. **There is deliberately no faint counter.**

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| SWITCH — Ninetales absorbs Heat Crash, then pivots | 1 `-end`, ABOVE the `|switch|` | **0** | 1, above |
| FAINT — the same, then killed by Golurk's Headlong Rush | **0** | 0 | 0 |
| NEVER-FED — the same body pivots having absorbed nothing | 0 | 0 | 0 |

NEVER-FED is the over-match negative: a fix keyed on the ABILITY rather than on the VOLATILE fails
there. Each arm also asserts the `-start` that GRANTS the volatile appears in both streams, so an arm
in which the absorb never happened cannot pass by writing nothing — which is exactly what the first
draft did, because the carrier idled on Protect and the Fire move never reached it.

Counters: `MEDSEEN.absorbGiftEndedOnSwitch` (+ `First`), `MEDFAILS.absorbGiftEndOnLeaveRestored`.

---

## 6. R6 — THE SHIELD SPEAKS BEFORE THE ABILITY ON THE PIVOT ROAD (3 causes)

**Probe:** `tests/probe_pivot_shield_before_ability.js`. **Knob:** `MEDI_PIVOT_ABILITY_BEFORE_SHIELD=1`.

### The rule, twice over

`trySpreadMoveHit`'s `moveSteps` list is STEP-MAJOR, and the probe reads it off the list itself:

```
hitStepInvulnerabilityEvent -> hitStepTryHitEvent -> hitStepTypeImmunity -> hitStepTryImmunity
  -> hitStepAccuracy -> hitStepBreakProtect -> hitStepStealBoosts -> hitStepMoveHitLoop
```

The Dark-is-immune-to-Prankster refusal lives in `hitStepTryImmunity` — **two steps below** the shield.
And inside step 1 the handlers for one target are collected `getStatus -> volatiles -> volatiles ->
getAbility -> getItem` (`findPokemonEventHandlers`, read this run): Protect is a volatile, Good as Gold
is an ability, so the shield speaks and the ability never does.

### What this engine did

The `kind === 'switch'` branch ran `tryHitRefusal` — Good as Gold, the Prankster block, the absorbers —
and only THEN the shield. **All three pool causes are Parting Shot**, which is why one branch fixes all
three: one bare `-immune` (a Prankster Grimmsnarl into a Protecting Kingambit) and two
`[from] ability: Good as Gold` (into a Protecting Gholdengo).

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| GAG-SHIELDED | `-activate move: Protect` | **`-immune [from] ability: Good as Gold`** | matches |
| PRANK-SHIELDED | `-activate move: Protect` | **bare `-immune`** | matches |
| GAG-BARE | `-immune [from] ability: Good as Gold` | matches | matches |
| PRANK-BARE | bare `-immune` | matches | matches |

The two BARE arms are the same boards with one knob turned — whether the target clicked its shield —
so they are what stops the fix reading as "Protect always wins". Boards identical on all four.

Counters: `MEDSEEN.pivotShieldBeforeAbility` (+ `First`), `MEDFAILS.pivotAbilityBeforeShieldRestored`.

### WHAT WAS DELIBERATELY NOT DONE, AND IT IS AN OPEN QUESTION

The hoist is **scoped to this one branch**. Counted over the file: **21 `tryHitRefusal` call sites, 9
of which have a `shieldRefuses` check within 14 lines below them** — i.e. eight more sites in the same
wrong order. They are not touched, because each guards its shield on a different condition (`_isFoe`,
`t !== m`) and announces differently, no pinned-pool card names any of them, and a blanket hoist is the
over-match this project has paid for. **That is an open question, not a clean bill.**

Also left alone: `moveClassBlocked` (Soundproof) is an ABILITY handler at the same tier as Good as
Gold, so re-ordering it against the ability would change nothing measurable — one body cannot carry
both. Against the PRANKSTER refusal it IS two steps early, and that is the same open question.

---

## 7. THE MEASUREMENTS

Every row is the six-flag sample of §0 at the stated release. `--write` on all four.

| | baseline `0c5a4da9c512` | R1 `5495f4d9dbd8` | R2 `af6a898e02f2` | R3 `8772eb46927c` | R5+R6 `2c4e125866cc` |
|---|---|---|---|---|---|
| **BOARD-MATERIAL** (`state.games` less `state.games_board_never_diverged`) | 0 / 958 | **0 / 958** | **0 / 958** | **0 / 958** | **0 / 958** |
| NARRATION-ONLY causes | 48 | 45 | 42 | 37 | **32** |
| NARRATION-ONLY games | 50 | 47 | 44 | 39 | **34** |
| gate narration (declared-adjusted) | 49 of 961 | — | — | — | **33 of 961** |
| protocol diverged (raw) | 53 | — | — | — | **37** |
| transfers (new causes) | — | **0** | **0** | **0** | **0** |

**Every prediction hit at the point estimate, and no cause transferred at any step.** The predictions
were written to `data/verification/_prediction-2026-09-09-narration-batch-R.json` before each release
was cut, with the scoreboard named in advance.

R5+R6 were batched into one measurement because their cause sets are disjoint (two `flashfire` rows,
three Parting Shot rows), so a bad result would still have been attributable to one fix or the other.

### The scoreboard predictions, and how they landed

Every cluster predicted **the pinned pool moves and the lab sits still** — no new mechanic fires in any
of the five; a line either starts or stops being written. That is what happened: census **830 live /
830 probed**, unchanged, and the roster stages unchanged in scope and verdict.

### The instruments, re-run after the last engine edit

| instrument | result |
|---|---|
| `tests/test-mechanics.js` (regenerates the census) | **830 live, 0 missing, 830 probed**; the file's only diff is its timestamp and one stochastic detail string (Iron Head 20.0% -> 19.8%) |
| `engine/all_mechanics_fire.js --kind all --write` | 1313 games, **0 threw**, 0 sheets unassembled |
| `tests/roster.js --stage items --reds --write` | **142 of 148**, 0 DIFFER, 0 DID-NOT-FIRE, 18 of 18 anchors live |
| `--stage abilities` | **139 of 202**, 0 DIFFER, 0 DID-NOT-FIRE, **44 of 44 anchors live** |
| `--stage moves` | **487 of 500**, 0 DIFFER, 0 DID-NOT-FIRE, 36 of 36 anchors live |
| `--stage spine` | 0 DIFFER, 0 DID-NOT-FIRE, 17 of 17 anchors live |
| `tests/test-engine-diff.js --n 6000 --seed 20260804` | **6000 agreed, 0 disagreed**, clean at all 16 damage indices |
| `engine/status.js` | **1 of 9 gate clauses fail** — NARRATION, and nothing else |

**No anchor died on any of these edits.** That was checked deliberately, because the previous batch's
edit killed two.

---

## 8. WHAT IS STILL OPEN

- **The other eight `tryHitRefusal` sites** (§6). Same wrong order, no pool witness, not fixed.
  Explicitly an open question.
- **Cluster 4, `-fail` field 3** — 3 causes, 4 games. Not attempted.
- **Cluster 7, the bare `|-fail|`** — 9 causes, 10 games, and the coordinator's own note that it is
  probably several mechanisms wearing one shape is the reason it was left last rather than taken
  first. Not attempted, not diagnosed.
- **The `ordering` residue** — 10 causes, unchanged from batch Q, whose open half is recorded in
  `docs/_reports/2026-09-08-narration-ordering-3.md` §4 (M2 substitute step 0, M3 residual order, M4
  post-KO switch-in order, M5 redirect vs `-prepare`, M6 faint vs a volatile ended by its source,
  M1's remaining half). **No clean bill is given to any of them here.**
- **The census digest discrepancy** in §0.

## 9. DEBRIS LEFT IN THE WORKING TREE

Named rather than removed:

- `data/_narrationR-dump.json` — the 50-card debugging dump this batch was read from. Untracked.
- Five new probes and one prediction card, all intended:
  `tests/probe_forme_revert_silent.js`, `tests/probe_thaw_on_a_corpse.js`,
  `tests/probe_ability_zero_boost_line.js`, `tests/probe_absorb_gift_end_on_leave.js`,
  `tests/probe_pivot_shield_before_ability.js`,
  `data/verification/_prediction-2026-09-09-narration-batch-R.json`.
- `data/roster.spine.prev.json` / `data/roster.json` — written by the roster runs themselves.

**One thing I did that should be recorded:** the first roster re-run was invoked as
`tests/roster.js --kind <k> --write`, and the flag is `--stage`. `--kind` is not read, so all three
runs executed the SPINE stage and overwrote `data/roster.spine.json` three times. It was re-run
correctly afterwards (`--stage spine --reds --write --release 2c4e125866cc`) and the artifact is
green, but the three intermediate writes happened and are stated here rather than left to a diff.
`--write` without `--reds` also silently stamps `reds: []`, which those three runs did.

---

## 9b. ONE RED GATE WAS OPENED BY THIS WORK AND CLOSED IN THIS PASS

Re-running the whole-game differential rewrote `data/game-differential.json`, and
`tests/test-docs-current.js` went red on **4 new citation mismatches** (baseline 61, now 65): four
living documents state `protocol 154 of 961` in a block that names both
`data/verification/fix-batch-M6-sidesel.json` and `data/game-differential.json`. **154 is a real
number in the first and was, until tonight, incidentally present in the second** — so the clause had
been passing for a reason that had nothing to do with the citation, and the coincidence lapsed the
moment the artifact was rewritten.

**The first attempt was wrong and is recorded because it is the useful part.** `citationsIn` in
`engine/docs_scan.js` matches `data/[A-Za-z0-9_.-]+\.json` with no `/` in the class, so every
`data/verification/<x>.json` a document names is invisible to it. Widening the class looked like the
clean fix — the check would read the artifact that actually holds the figure — and it made things
**worse, 65 -> 88**: blocks that name a census-pin or a prediction card alongside numbers sourced
elsewhere all became mismatches. Reverted; `engine/docs_scan.js` is unchanged.

**What was actually wrong is the document, and my run is what falsified it.** Each of the four blocks
asserts that `data/game-differential.json` *"was not rewritten and still holds board-material 77 of
961 and protocol 168"*. That was true at 5.249.0 and is not true now. Each block gained a dated
`SUPERSEDED 2026-09-08, narration batch R` sentence saying so; **no 5.249.0 figure was changed**, and
the retraction is recorded in `docs/RUNNING-NOTES.md` per the living-docs rule. The docs gate reads
**33 passed, 0 failed**.

Two things are worth flagging to whoever owns that check: the same *"was not rewritten"* claim appears
in roughly eight further blocks across the whitepaper and the technical docs and is equally stale
there — those were left alone because they still pass on their own merits and rewriting eight dated
blocks is not this batch's job — and the clause is coincidence-sensitive by construction, so it can go
red on any whole-game run for reasons that are nothing to do with the document.

---

## 10. VERDICT

- **Five mechanisms closed, sixteen NARRATION-ONLY causes, each with a probe shown RED on the pre-fix
  bytes and a knob that reproduces the old behaviour exactly.**
- **NARRATION 49 -> 33 of 961. BOARD-MATERIAL 0 of 958, checked after every one of the four
  measurements and never moved.** `engine/status.js` reads 1 of 9 gate clauses failing, the same one.
- **Zero transfers at every step**, and every prediction hit at the point estimate.
- One prediction was refuted *by the probe rather than by the measurement*: the Flash Fire FAINT road,
  which the authority does not narrate at all. The arm is kept as a negative.
