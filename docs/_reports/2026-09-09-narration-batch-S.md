# NARRATION BATCH S — the `-fail` family, four mechanisms, ten causes

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
| census | **830 rows**, `identical to the live census`, digest `e6cb76df93f5` on every run of this batch |
| arm pins | `de38d17e15a2` |
| team pool | `data/team-pool-frozen`, digest `0d103fb9fa87` |
| games played | **961** (of `--games 1200` offered), 958 non-void |
| turns cap | 50 |

The releases, in order: `2c4e125866cc` (baseline, batch R's last) -> `ccdda3181a45` (S1+S2) ->
`5381b07ea2fa` (S3+S4, and the published run).

**THE CENSUS DIGEST IS `e6cb76df93f5` AND THE BRIEF SAID `0b88d51b3463`, AND THE CONTENT DID NOT
MOVE.** Checked the way batch R was told to: 830 rows on the before-run and on every after-run,
`matches_live: true` on all of them, and the file's only diff across the whole batch is its
`generated` timestamp plus one stochastic detail string (Iron Head 19.8% -> 19.2%, control Rock Slide
26.9% -> 26.6%). The digest moves on the timestamp alone. Recorded, not smoothed over.

**THE FIRST TWO MEASUREMENTS USED `--out` AND THAT COST A RE-RUN.** `--out <file>` diverts the write
away from `data/game-differential.json`, which is the file `engine/status.js`'s two whole-game clauses
read — so after the last engine edit the gate said **3 of 9 clauses fail**, two of them
*"MEASURED AGAINST A DIFFERENT ENGINE"* against a stale artifact rather than against anything this
batch did. The final measurement was re-run WITHOUT `--out` so the published slot is written by the
run that produced it, and `engine/all_mechanics_fire.js --kind all --write` was re-run for the same
reason. Both are recorded here because the failure mode is exactly the one this repository keeps
paying for: a number that looks wrong for a reason that is nothing to do with the engine.

---

## 1. THE POPULATION, RE-DERIVED

Taken from `end_state[0].summary.by_cause` filtered to `materiality === 'NARRATION-ONLY'`, never from
`first_divergences`. On the baseline release: **32 causes, 34 games.** The coordinator's bucketing was
checked row by row against the artifact. One correction, and it is the same one batch R had to make
one cluster over:

- **the `-fail` field-3 cluster is THREE causes and FOUR games**, not four causes. Row 0
  (`|-fail|p2b|allyswitch`) carries two games. The brief's "4" is the game count.
- the bare-`|-fail|` cluster is **NINE** causes and ten games, not eight. Rows 1, 10, 11, 17, 21, 27,
  28, 30, 31.

So the `-fail` family is **12 causes / 14 games**, 37% of the clause, exactly as the brief said.

Cards were read from a dump generated on the baseline release
(`--dump-games 60 --dump-out data/_narrationS-dump.json`, 34 of 37 diverging games; the 3 excluded are
the instrument's own void games) and read one by one.

**THE READING, CARD BY CARD.** The nine bare `-fail` rows are SEVEN mechanisms, not one:

| cards | what the authority was doing | fixed here |
|---|---|---|
| 8, 9 | Yawn clicked at a body that is already ASLEEP | S3 |
| 17, 27 | Leech Seed clicked at a body that is already SEEDED | S3 |
| 32, 33 | Dire Claw's Champions-only refusal on an already-statused body | S2 |
| 21 | Trick that finds no item to swap | no |
| 28 | Rage Powder clicked twice in a turn through Instruct | no |
| 30 | Instruct refused, and this engine executes it | no |
| 31 | Sucker Punch's `onTry` refusal — the target had already moved | no |

---

## 2. S1 — A `-fail` THE HANDLER WRITES ITSELF NAMES THE MOVE (3 causes, 4 games)

**Probe:** `tests/probe_fail_names_the_move.js`. **Knob:** `MEDI_BARE_FAIL_LABELS=1`.

### The rule

`useMoveInner`'s generic failure is two fields and that is what `mvFail` emits. A handful of handlers
announce their OWN refusal, name the move in field 3, and return `NOT_FAIL` so the generic line never
runs:

```
allyswitch.onHit     this.add('-fail', pokemon, 'move: Ally Switch');           data/moves.ts:326
                     this.attrLastMove('[still]'); return this.NOT_FAIL;
substitute.onTryHit  this.add('-fail', source, 'move: Substitute', '[weak]');   data/moves.ts:18314
```

Champions overrides neither move (asserted on every run).

**AND THE OTHER ALLY SWITCH ROAD IS A DIFFERENT SHAPE.** The consecutive-use refusal is
`condition.onRestart`, which deletes the volatile and returns `false` with no `add` of its own — so
`onPrepareHit` fails and `useMoveInner` writes the BARE line. Two roads, two shapes, and this engine
was writing the bare one for both.

### What this engine did

Both sites called `mvFail`. ROADMAP #241 had already wired substitute's OTHER branch (a doll already
standing) and left the threshold branch alone.

### THE TAG HAD TO LEARN A NEW FIELD, AND PRINTING THE MATCH IS WHAT SAVED IT

The first draft was going to emit `move: <name>` + `[weak]` for every member of `costsUserHP`. The
probe's §0 printed the membership before anything read it and **CLANGOROUS SOUL DOES NOT ANNOUNCE**
— its `onTry` is a bare `return false`, so the generic two-field line is CORRECT for it and this
engine was already right. A tag-keyed fix would have invented a line on 190 corpus clicks.

`costsUserHP.announcesFailBelow` is therefore derived per member from the FOUR-ARGUMENT
`this.add('-fail', X, 'move: N', '[flag]')` in the move's own try phase. Regenerated and diffed
entity by entity: **exactly three rows moved** — `substitute` and `shedtail` gained
`announcesFailBelow`, `direclaw` gained the field S2 needs, and **`clangoroussoul` and `triattack`
gained nothing**. No tag membership changed anywhere.

### The arms

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| ASW-DEAD-PARTNER | `-fail|p2a: Farigiraf|move: Ally Switch` | **bare** | matches |
| ASW-STALLED | bare `-fail|p2b: Farigiraf` | matches | matches |
| SUB-WEAK | `-fail|p2a: Farigiraf|move: Substitute|[weak]` | **bare** | matches |
| SUB-REPEAT | `-fail|p2a: Farigiraf|move: Substitute` (no flag) | matches | matches |

ASW-STALLED and SUB-REPEAT are the two controls and they are what stop a blanket fix: one is the same
MOVE failing by a different road with a different line, the other is the same HANDLER failing by a
different clause with a different field count. SUB-WEAK and SUB-REPEAT ride in the same game on the
same body, so the two differ in nothing but the HP.

The DEAD-PARTNER arm is staged by killing the partner with a **+2** move (Extreme Speed, from a body
that outruns the Ally Switch user inside that bracket) in the same turn the +2 Ally Switch is clicked
— the replacement does not arrive until the end of the turn, so the slot holds a corpse when `onHit`
asks. That is the pool card's own shape. Every arm asserts **0 board diffs at every boundary**.

Counters: `MEDSEEN.failNamedByHandler` (+ `First`), `MEDFAILS.bareFailLabelsRestored`.

---

## 3. S2 — CHAMPIONS GIVES DIRE CLAW A REFUSAL LINE MAINLINE DOES NOT HAVE (1 cause, 2 games)

**Probe:** `tests/probe_direclaw_refusal_line.js`. **Knob:** `MEDI_NO_PROCEDURAL_REFUSAL_LINE=1`.

### The rule, and reading `data/moves.ts` here would have been reading the wrong game

The mod rewrites Dire Claw's whole secondary (`data/mods/champions/moves.ts:191-209`, chance 50 -> 30)
and inserts, ABOVE `trySetStatus`:

```
if (target.status) {
  if (target.status === status) { this.add('-fail', target, status); }   <- names the status
  else                          { this.add('-fail', target); }           <- bare
  return;
}
```

with its own comment, *"This seems to only happen with Dire Claw"*. **TRI ATTACK IS NOT OVERRIDDEN**
and goes straight to `trySetStatus`, which refuses an already-statused body in silence. So the
announcement is one member's and not the tag's — and `proceduralStatus.announcesRefusalOnStatus` is
derived per member for exactly that reason.

### The arms, and the two shapes fall out of the ARM rather than a seed hunt

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| SAME-STATUS (`bottom-tie-first`) | `-fail|p2a: Garchomp|psn` x2 | **nothing** | matches |
| OTHER-STATUS (`middle`) | bare `-fail|p2a: Garchomp` x2 | **nothing** | matches |
| KO-ON-A-CORPSE | `-fail|p2a: Milotic|psn` BETWEEN the lethal `-damage` and the `|faint|` | **nothing** | matches |
| NO-SECONDARY (`top-tie-first`) | no `-fail` at all | matches | matches |
| TRI-CLEAN | `-status|p2a: Milotic|brn` — the 20% secondary DOES fire under this arm | matches | matches |
| TRI-STATUSED | **NOTHING** | matches | matches |

**TRI-STATUSED is the over-match negative and TRI-CLEAN is what stops it being vacuous.** An arm in
which Tri Attack's secondary never fired would pass by writing nothing; TRI-CLEAN proves the same arm
lands a status on a clean body.

**KO-ON-A-CORPSE is the pool's own shape and it is the opposite of batch R's corpse rule.**
`cureStatus` and `removeVolatile` both open `if (!this.hp) return false`; `this.add` opens with
nothing at all. So the line is owed at ANY HP, and the arm asserts the ORDER — the `-fail` sits
between the lethal `-damage` and the `|faint|`.

Sneasler is the ONLY legal carrier of Dire Claw in this regulation and the Tri Attack user is the
first legal carrier that also learns Thunder Wave; both are read off `Dex.forFormat` on every run.

Counters: `MEDSEEN.proceduralStatusRefusedOnStatus`, `MEDSEEN.proceduralRefusalAnnounced` (+ `First`),
`MEDFAILS.proceduralRefusalLineRestored`. The two counters are separate on purpose: one is *the
refusal fired*, the other is *the refusal spoke*, and Tri Attack does the first and not the second.

---

## 4. S3 — A REFUSAL THIS ENGINE ALREADY MADE, AND MADE IN SILENCE (4 causes, 4 games)

**Probe:** `tests/probe_refusal_this_engine_swallowed.js`. **Knob:** `MEDI_SWALLOW_REFUSALS=1`.

### The rule

`runMoveEffects` ends a status move that achieved nothing with the generic line:

```
if (didAnything === false) { this.battle.add('-fail', source); this.battle.attrLastMove('[still]'); }
                                                              sim/battle-actions.ts
```

Two doors reach it and this engine walked through both without saying anything, because the refusal
was a **silent conjunct in a guard** rather than a branch with a consequence:

- **Yawn.** `onTryHit(target) { if (target.status || !target.runStatusImmunity('slp')) { return false; } }`.
  The engine tested `canTakeStatus(t,'slp')` as an `else if` and fell off the end.
- **Leech Seed.** `volatileStatus: 'leechseed'`, and `addVolatile` returns a bare `false` for a
  volatile already present with no `onRestart`. The engine had `!t._seededBy` as a conjunct at the TOP
  of its `perTurnHP` block, so the whole block was skipped.

### THE DIE MOVES ON THE SEED ROAD, AND THAT IS THE PART THAT NEEDED CARE

Leech Seed is **90%** accurate and `hitStepAccuracy` sits ABOVE `runMoveEffects` in `moveSteps` — so
the authority ROLLS on a repeat click and this engine rolled nothing. Moving the test below the die
therefore ADDS a draw. Under the middle arm the die is an ADDRESS
(`FNV1a(seed|turn|category|move|slot|nth)`), so a draw taken at the address the authority already
spends is an ALIGNMENT and not a shift. **That is asserted rather than argued:** the SEED-REPEAT arms
compare the whole `-start`/`-fail`/`-miss` list IN ORDER over six clicks on two arms, and the middle
arm's list contains a **`-miss` in position 5** which both engines now produce at the same click.

The other two conjuncts stayed where they were: the Grass refusal is `onTryImmunity` and the
Prankster one is `hitStepTryImmunity`, both ABOVE `hitStepAccuracy`, so they must keep skipping the
roll — which is what the SEED-GRASS control asserts (`-immune`, no `-fail`, no `-miss`).

Yawn's printed accuracy is `true`, so its road draws nothing on either engine.

### The arms

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| YAWN-AT-PAR | `-fail|p1a: Chimecho` | **nothing** | matches |
| YAWN-AT-SLP (the pool's shape) | `-start|Yawn`, then `-fail|p1a: Chimecho` | one line short | matches |
| YAWN-CLEAN | `-start|Yawn`, no `-fail` | matches | matches |
| YAWN-DROWSING | `-start|Yawn`, then `-fail` | matches | matches |
| SEED-REPEAT (middle) | `-start`, `-fail` x3, **`-miss`**, `-fail` | one line | matches, in order |
| SEED-REPEAT (bottom) | `-start`, `-fail` x5 | one line | matches, in order |
| SEED-GRASS | `-immune` x2 | matches | matches |

Counters: `MEDSEEN.yawnRefusedOnStatus` (+ `First`), `MEDSEEN.seedRefusedAlreadySeeded`,
`MEDFAILS.swallowedRefusalsRestored`.

### THE OVER-MATCH NEGATIVE FOUND A DEFECT, AND IT IS NOT FIXED

The fix is keyed on `t.status` and DELIBERATELY not on `canTakeStatus`, which is wider than the
authority's clause. The arm written to prove that — a Yawn into a SAFEGUARDED body — turned out to
disagree for a reason that is not this batch's, and it **falsifies a comment that has been standing
in the yawn branch**:

> *"SAFEGUARD is an `onSetStatus`, so a Safeguarded body takes the drowse in the authority and only
> fails the SLEEP two turns later."*

It does not. Safeguard carries an `onTryAddVolatile` that names `yawn` **explicitly**
(`data/moves.ts:15601-15607`) and returns null with `-activate|TARGET|move: Safeguard`. Measured on
every run of the probe:

```
showdown   |-activate|p2a: Milotic|move: Safeguard
medicham   |-start|p2a: Milotic|move: Yawn
```

**This engine lands a drowse the authority refuses**, which is a BOARD defect — the target then falls
asleep two turns later in one engine and not the other. It has **no pinned-pool witness**, so it was
not fixed inside a narration pass. The comment in the engine has been corrected in place to say what
was measured; the arm asserts only that this engine writes no `-fail` there, which is the over-match
claim, and PRINTS the disagreement. The other half of yawn's clause —
`!runStatusImmunity('slp')`, an Insomnia or Vital Spirit body with no status — is a real `-fail` and
is also not wired. Named, not assumed absent.

---

## 5. S4 — A BODY AT 0 HP PAYS NO RECOIL (2 causes, 2 games)

**Probe:** `tests/probe_recoil_on_a_corpse.js`. **Knob:** `MEDI_RECOIL_ON_A_CORPSE=1`.

### THE THIRD MECHANISM WEARING BATCH R'S RULE, AND THE BRIEF PREDICTED IT

```
if (!target || !target.hp) { retVals[i] = 0; continue; }          sim/battle.ts:2102-2105
```

inside `Battle#spreadDamage`, which is where `applyRecoilDamage`'s
`this.battle.damage(recoilDamage, pokemon, pokemon, effect)` lands. A corpse pays nothing and no line
is written — the same shape as `cureStatus` and `removeVolatile`.

**THE GAP IS REAL AND VERY NARROW.** The only thing that can kill the attacker between its own hit
landing and its recoil being paid is the target's damaging-hit punisher, which in this regulation is
Rough Skin (derived: Sharpedo and Garchomp are the only carriers). Both pool cards are exactly that.

It is narration and not a board because the HP was already 0 — the deduction was a no-op and only the
line was invented. The ORDER this engine already had right (the payment sits BELOW the faint) is what
made the invented line visible at all.

### The arms

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| CORPSE | **no recoil line at all** (Rough Skin 2, attacker faints 1) | `-damage|0 fnt|[from] Recoil` | matches |
| PUNISHED | 1 recoil line (Rough Skin 1, attacker LIVES) | matches | matches |
| SURVIVES | 1 recoil line (Rough Skin 0) | matches | matches |

**PUNISHED is the sharper control.** SURVIVES stops "never pay recoil"; PUNISHED stops "do not pay
recoil when a punisher fired", which is the wrong reading a hurried fix would take. The fixture is
SEARCHED frailest-first over every legal carrier of a contact recoil move that also learns Endure, and
the refusal it printed is worth keeping: *"Pikachu (Rough Skin never fired on the authority)"*. The
accepted pair is Sharpedo / Double-Edge into Garchomp, chipped onto Endure with Brick Break — Endure
puts the attacker on exactly 1 HP whatever the roll was, so the arm does not depend on a damage
number.

Counter: `MEDSEEN.recoilRefusedOnCorpse`, `MEDFAILS.recoilOnCorpseRestored`.

### THE OTHER RECOIL ROAD IS NOT FIXED, AND IT IS NAMED

Struggle and Steel Beam pay a share of the user's own MAXIMUM through `directDamage`, whose guard is
the identical `if (!target?.hp) return 0;` (`sim/battle.ts:2210`) — asserted by the probe's §0. Steel
Beam is not a contact move, so nothing can kill its user in the gap; Struggle is, but reaching it
costs a body's whole PP and no pinned-pool game does that. **Left unfixed because it could not be
staged, not because it is believed correct.**

---

## 6. THE MEASUREMENTS

Every row is the six-flag sample of §0 at the stated release.

| | baseline `2c4e125866cc` | S1+S2 `ccdda3181a45` | S3+S4 `5381b07ea2fa` |
|---|---|---|---|
| **BOARD-MATERIAL** (`state.games` less `state.games_board_never_diverged`) | 0 / 958 | **0 / 958** | **0 / 958** |
| NARRATION-ONLY causes | 32 | 28 | **22** |
| NARRATION-ONLY games | 34 | 28 | **22** |
| protocol diverged (raw) | 37 | 31 | **25** |
| transfers (new causes) | — | **0** | **0** |

**Ten causes closed, twelve games, zero transfers at either step.** Every closed cause is one the
probe named in advance; nothing else moved.

### THE SCOREBOARD PREDICTIONS, SAID BEFORE EACH RUN

Every cluster predicted **the pinned pool moves and the lab sits still** — no new mechanic fires in
any of the four, a line either starts or stops being written. That is what happened: census **830
live / 0 missing / 830 probed**, unchanged, and every roster stage unchanged in scope and verdict.

The one clause where that prediction was NOT obviously safe is S3's Leech Seed road, which adds an
accuracy draw. It was said in advance that the draw is at the authority's own address and would
therefore align rather than shift, and the SEED-REPEAT arms were written to catch it if that were
wrong. Nothing moved in the lab and no cause transferred in the pool.

### The instruments, re-run after the last engine edit

| instrument | result |
|---|---|
| `tests/test-mechanics.js` (regenerates the census) | **830 live, 0 missing, 830 probed**; the file's only diff is its timestamp and one stochastic detail |
| `engine/all_mechanics_fire.js --kind all --write` | **1313 games, 0 threw, 0 sheets unassembled** |
| `tests/roster.js --stage items --reds --write` | 142, **0 DIFFER, 0 DID-NOT-FIRE, 18 of 18 anchors live** |
| `--stage abilities` | 139, **0 DIFFER, 0 DID-NOT-FIRE, 44 of 44 anchors live** |
| `--stage moves` | 487, **0 DIFFER, 0 DID-NOT-FIRE, 36 of 36 anchors live** |
| `--stage spine` | **0 DIFFER, 0 DID-NOT-FIRE, 17 of 17 anchors live** |
| `tests/test-engine-diff.js --n 6000 --seed 20260804` | **6000 agreed, 0 disagreed**, clean at all 16 damage indices |

**No anchor died on any edit** — checked deliberately, because batch Q's edit killed two.

---

## 7. THE RESIDUAL TRIO — THE STEP THE BRIEF NAMED, TAKEN, AND IT REFUTES A SINGLE STORY

Batch Q left the three residual-order rows open and said the next step was to read those games'
ACTUAL speeds rather than build a third fixture. Read:

| cause | the two bodies | base Speed |
|---|---|---|
| `-damage|p2b|brn <> -damage|p1b|brn` | Sinistcha vs **Sinistcha** | 70 vs 70 |
| `-heal|p1b|leftovers <> -heal|p2a|leftovers` | Primarina vs Clefable | 60 vs 60 |
| `-damage|p1a|psn <> -damage|p1b|psn` | Umbreon vs Scovillain | **65 vs 75** |

**Two of the three are same-base-Speed pairs and the third is not.** So "the residual order is a
speed tie" cannot be the whole story, and batch Q was right not to give it a clean bill. The third row
is a pair where the SLOWER body on paper moves FIRST in the authority and second here, which points at
a speed READING rather than at a sort — and this run's own instrument prints
**560 disagreeing speed readings in 236 of 961 games**, every one of the top rows carrying
`status=…/sd:fnt`, i.e. taken on a body Showdown has already fainted, and every one differing by
exactly a Choice Scarf, an Unburden, a Swift Swim or a paralysis multiplier. That reads like the
INSTRUMENT reading a modifier-free stat off an inactive body rather than an engine defect, and it is
recorded here as an observation with no diagnosis attached.

Both engines DO have a tie device on the residual walk (`residualOrder`'s `_rtie`, drawn per body per
generation, against the authority's `speedSort` + `prng.shuffle` over the tied slice) and this run
reports `speed_ties.shuffle_calls 35766`, `tied_groups_resolved 35766`,
`medicham_tie_sequence_saturated 0`. **The class stays OPEN and unexplained.** No fix was attempted.

---

## 8. WHAT IS STILL OPEN

- **The four remaining bare-`|-fail|` causes, now DIAGNOSED and not attempted:** Trick that finds no
  item to swap; Rage Powder clicked a second time in one turn through Instruct (this engine re-writes
  the `-singleturn`); Instruct refused by the authority and EXECUTED here; and Sucker Punch's `onTry`
  refusal when the target has already moved, which this engine lets through to the Psychic Terrain
  block instead. The last two are behavioural, not narration, and each needs its own probe.
- **The Yawn / Safeguard board defect** in §4. Measured, unfixed, no pool witness.
- **Yawn's `runStatusImmunity('slp')` half** — an Insomnia or Vital Spirit body with no status is a
  real `-fail` and is not wired.
- **The max-HP recoil road** (`directDamage`) in §5. Same authority guard, unstageable.
- **The residual trio** in §7. Open, and now known not to be one mechanism.
- **The other eight `tryHitRefusal` sites** — carried unchanged from batch R, still no pool witness.
- **The 560 speed-reading disagreements** in §7, which look like the instrument.
- Everything else carried forward on batch R's hand list.

---

## 9. DEBRIS LEFT IN THE WORKING TREE

Named rather than removed:

- `data/_narrationS-dump.json` — the 34-card debugging dump this batch was read from. Untracked.
- `data/_narrationS-before.json`, `data/_narrationS-after12.json`, `data/_narrationS-after34.json` —
  the three `--out` artifacts. The FINAL number is in `data/game-differential.json`, written by a run
  with no `--out`; these three are the intermediate steps and are untracked.
- Four new probes, all intended: `tests/probe_fail_names_the_move.js`,
  `tests/probe_direclaw_refusal_line.js`, `tests/probe_refusal_this_engine_swallowed.js`,
  `tests/probe_recoil_on_a_corpse.js`.
- `data/roster.{items,abilities,moves,spine}.json`, `data/roster.json`, `data/roster.spine.prev.json` —
  written by the roster runs themselves.
- Nothing was committed.

---

## 10. VERDICT

- **Four mechanisms closed, ten NARRATION-ONLY causes**, each with a probe shown RED on the pre-fix
  bytes and a knob that reproduces the old behaviour exactly.
- **NARRATION 32 -> 22 causes, 34 -> 22 games. BOARD-MATERIAL 0 of 958, checked after both
  measurements and never moved.**
- **Zero transfers at every step**, and every prediction hit at the point estimate.
- One over-match negative was written to prove a fix was narrow and **found a board defect instead** —
  Safeguard refuses the Yawn volatile and this engine lands it. Reported, not fixed, and the engine
  comment that said otherwise has been corrected in place.
- The residual trio was investigated as instructed and **stays open**: it is not one mechanism.
