# NARRATION BATCH T — a board defect, ten mis-ordered call sites, and one ordering cause

ENGINE. Written as the work happened; the verdict block is the last thing added.

---

## 0. THE SAMPLE, EVERY FLAG AND EVERY PIN

Identical for all three measurements; only `--release` moves.

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node engine/game_differential.js --steering empirical --release <id> \
  --arm middle --end-state --games 1200 --team-store data/team-pool-frozen --turns 50 --write
```

| pin | value |
|---|---|
| census | **830 rows**, `identical to the live census` on every run |
| arm pins | `de38d17e15a2` |
| team pool | `data/team-pool-frozen`, digest `0d103fb9fa87`, 1968 teams from a corpus of 8778 |
| games played | **961** offered against `--games 1200`, 958 non-void |
| turns cap | 50 |

The releases, in order: `5381b07ea2fa` (baseline, batch S's published run) -> `88ad0cd7c052`
(T1+T2) -> `4446a4d58966` (T3, first cut) -> `eb46032d332c` (T3 narrowed, the published run).

**THE CENSUS DIGEST MOVED THREE TIMES AND THE CONTENT DID NOT.** The brief named `de38d17e15a2` for
the arms and a census of 830 rows; the runs report `cb42df023f5e` (T1+T2 and T3) and `2179a382f90d`
(the final run, taken after `tests/test-mechanics.js` regenerated the file). Every one of them prints
**830 rows** and `identical to the live census`. The digest moves on the `generated` timestamp, exactly
as the brief warned; recorded rather than smoothed over, because a census digest is part of a sample
definition.

**`--out` WAS NEVER USED.** Every measurement wrote `data/game-differential.json` directly, which is
the slot `engine/status.js` reads. The dump run below is the only one without `--write`, and it also
carries no `--out` for the artifact.

---

## 1. WHAT WAS FIXED, AND WHAT EACH ONE COST

| # | what the authority does | probe | knob |
|---|---|---|---|
| **T1** | `safeguard.condition.onTryAddVolatile` names `yawn` and `confusion` EXPLICITLY and refuses the drowse with `-activate\|TARGET\|move: Safeguard`. **A BOARD DEFECT** — this engine landed the drowse and slept the body two turns later. | `tests/probe_yawn_safeguard_refusal.js` | `MEDI_YAWN_THROUGH_SAFEGUARD=1` |
| **T1b** | the same handler's FIRST line exempts an INFILTRATING move aimed at a foe. Found because a probe assertion written to declare the case unreachable went RED. | same probe, INFIL-FOE / INFIL-ALLY arms | `MEDI_SIDEBUFF_IGNORES_INFILTRATOR=1` |
| **T2** | inside `hitStepTryHitEvent`, `findPokemonEventHandlers` gathers VOLATILES before ABILITIES, so Protect answers above Good as Gold and above the absorbers; the Prankster/Dark refusal is two whole steps lower. Ten `tryHitRefusal` sites asked in the wrong order. | `tests/probe_shield_before_ability.js` | `MEDI_ABILITY_BEFORE_SHIELD=1` |
| **T2b** | `protect.condition.onTryHit` returns `NOT_FAIL`, which SUPPRESSES the generic `-fail`. The `healdesc` shield road wrote both lines. | same probe, PLAIN-SHIELD arm | `MEDI_SHIELDED_HEAL_FAILS=1` |
| **T3** | `isActive` is cleared INSIDE `faintMessages`, in the same statements that write the line — so on the update pass a corpse is still ACTIVE and a `!source.isActive` handler owes its `-end` to the NEXT pass, below the `\|faint\|`. | `tests/probe_faint_before_source_gone_end.js` | `MEDI_FAINT_CLEARS_ACTIVE_EARLY=1` |

Every knob was **demonstrated RED** before the fix was believed, and each is a separate knob for a
separate defect: with T1 and T1b under one knob an infiltrating Yawn would land for the WRONG REASON
and the arm would pass.

---

## 2. T1 — SAFEGUARD REFUSES THE DROWSE (PRIORITY 1, A BOARD DEFECT)

**Probe:** `tests/probe_yawn_safeguard_refusal.js`. **Knobs:** `MEDI_YAWN_THROUGH_SAFEGUARD=1`,
`MEDI_SIDEBUFF_IGNORES_INFILTRATOR=1`.

### The scoreboard, said before the run

**A RARE MECHANIC: the pinned pool sits still and the lab moves.** No pinned-pool game witnesses a
Yawn into a Safeguard — that is exactly why batch S could leave it — so the 1,200-game run was
predicted to report the SAME narration count and the SAME board-material count, with the probe going
RED -> green and nothing else moving. **That is what happened, to the cause.**

### The rule

```
safeguard.condition.onTryAddVolatile(status, target, source, effect) {
  if (!effect || !source) return;
  if (effect.effectType === 'Move' && effect.infiltrates && !target.isAlly(source)) return;
  if ((status.id === 'confusion' || status.id === 'yawn') && target !== source) {
    if (effect.effectType === 'Move' && !effect.secondaries)
      this.add('-activate', target, 'move: Safeguard');
    return null; } }                                                        data/moves.ts
```

Champions overrides neither `safeguard` nor `yawn` (asserted on every run). The CONFUSION half has had
a reader since WIRE 133; the YAWN half had **none**.

### THE TAG LEARNED A FIELD, AND PRINTING THE MEMBERSHIP IS WHAT MADE IT SAFE

`sideBuff.blocksVolatile` is derived as *"the condition HAS an `onTryAddVolatile`"*, which is not the
same fact as *"it refuses THIS volatile"*. Read at face value it would have turned Safeguard into a
Leech Seed, Taunt and Encore shield. That was unreachable while `applyConfusion` was the only caller —
it can only ever ask about confusion — and became reachable the moment the yawn road got a reader.

`engine/tag_dex.js` now derives `blocksVolatileIds` from the handler's own
`status.id === 'x'` occurrences. Membership printed before anything read it: **one member in this
format, `safeguard`, 37 uses, and no other move carries `sideBuff.blocksVolatile` at all.**
Regenerated and diffed entity by entity: **exactly one row moved, and it gained exactly one field** —
`blocksVolatileIds: ["confusion","yawn"]`. No tag membership changed anywhere.

The check lives inside `sideBuffRefuses` and not at either call site, because two copies of "which
volatiles does this refuse" is the drift the FACTS-ARE-GLOBAL rule forbids. A tag row with no ids list
is **counted** (`MEDFAILS.sideBuffVolatileIdsUnknown`) rather than defaulted; the behaviour on that
path is deliberately the old one, so the counter is the only thing that moves.

### THE CLAUSE THE ENGINE COMMENT DECLARED UNREACHABLE, AND THE PROBE REFUTED

The first draft of the fix said in its own header that the `infiltrates` exemption could not arise —
*"no legal Infiltrator carrier learns Yawn"*. **That claim was written into the probe as a question to
the format instead of typed into the engine as a fact, and it came back RED naming Meowstic and
Meowstic-F.** Both are legal, both carry Infiltrator, both learn Yawn. Had the claim stayed in a
comment, T1 would have shipped a NEW board defect: an infiltrating Yawn refused where the authority
lets it through.

The exemption is now modelled in `sideBuffRefuses`, beside the near-side rule it mirrors — the clause
is the FIRST line of all three handlers in the family (`safeguard.onSetStatus`,
`safeguard.onTryAddVolatile`, `mist.onTryBoost`), so it is a property of the family and belongs at the
shared reader. `move.infiltrates` is set by the ABILITY, and the tag that carries that fact is the one
`subBlocks` already reads (`ignoresScreensAndSubs.ignoresSubstitute`), so the two cannot drift.
**Membership printed: one ability, `infiltrator`, 221 uses.** Two MOVES also set the flag
(`pollenpuff` only when aimed at an ally, `present` on a 2-in-10 branch); neither can write a status,
a confusion or a drowse, and Pollen Puff's is ally-only, which `!isAlly` excludes anyway — so no move
road is modelled and that is stated rather than assumed.

### The arms

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| SG-YAWN | `-activate\|p2a: Clefable\|move: Safeguard`, and the body NEVER sleeps | `-start\|move: Yawn` -> `-status\|slp`, **and the board parts at `party.clefable.status`** | matches |
| NO-SG | the drowse lands and the sleep arrives | matches | matches |
| SG-STATUS | Thunder Wave -> `-activate\|move: Safeguard` (the `onSetStatus` half) | matches | matches |
| SG-SEED | Leech Seed **LANDS** through the Safeguard | matches | matches |
| ALLY-YAWN | a Yawn at the user's OWN partner under its OWN Safeguard is refused and announced | **lands it** | matches |
| INFIL-FOE | an infiltrating Yawn at a FOE **lands**, and the foe sleeps | matches | matches |
| INFIL-ALLY | the same infiltrating body at its OWN partner **is refused** | **lands it** | matches |

SG-SEED is the over-match negative that stops `blocksVolatile` being read as a blanket. SG-STATUS is
what stops a red SG-YAWN reading as "no Safeguard was up". INFIL-ALLY is what stops the exemption
being read as "Infiltrator ignores Safeguard". ALLY-YAWN is the near-side road — the authority's
clause is `target !== source`, IDENTITY and not side.

Counters: `MEDSEEN.yawnRefusedBySideBuff` (+ `First`), `MEDSEEN.yawnSideBuffRefusalAnnounced`,
`MEDSEEN.sideBuffInfiltrated`, `MEDFAILS.sideBuffVolatileIdsUnknown`,
`MEDFAILS.yawnThroughSafeguardRestored`, `MEDFAILS.sideBuffIgnoresInfiltratorRestored`. The refusal
and the SENTENCE are two counters for the Dire Claw reason: the authority announces only for a Move
with no secondaries, and `formatSecondaryCount.count` is read rather than collapsed.

---

## 3. T2 — THE SHIELD SPEAKS BEFORE THE ABILITY, AT TEN MORE SITES (PRIORITY 1b)

**Probe:** `tests/probe_shield_before_ability.js`. **Knobs:** `MEDI_ABILITY_BEFORE_SHIELD=1`,
`MEDI_SHIELDED_HEAL_FAILS=1`.

### The scoreboard, said before the run

**The pinned pool sits still and the lab moves.** Batch R had already measured that no pinned-pool
card names any of these branches — the three pool causes it closed were all Parting Shot, the pivot
road it did fix. **That is what happened.**

### The count is TEN, not eight, and the window is why

Batch R counted "eight other sites" over a 14-RAW-LINE window. Counted again over CODE lines only
(several of these carry a twenty-line comment between the two checks) it is **twelve sites with a
shield below a `tryHitRefusal`**, of which one is the pivot road batch R already fixed and one is
`kind === 'boostally'`, which is a different defect (below). **Ten were converted.**

### The rule, read off the authority's own lists

`moveSteps` is STEP-MAJOR and `hitStepTryHitEvent` is step 1; the Prankster/Dark refusal lives in
`hitStepTryImmunity`, step 4. Inside step 1, `findPokemonEventHandlers` gathers the STATUS, then the
VOLATILES, then the ABILITY, then the ITEM. Protect is a volatile; Good as Gold and the absorbers are
abilities. `tryHitRefusal` answers all three of those clauses, so at every site it belongs BELOW the
shield.

### IT IS A REORDER, WHICH IS WHY IT TAKES THE SITE'S OWN GUARD

`abilityRefusalUnderShield(m, t, mv, willAnswer)` suppresses the ability answer EXACTLY when the
site's own shield block is going to speak — `_isFoe` at five of them, `t !== m` at two, nothing at the
rest — and never when it would stay silent. **A blanket hoist would have broken one site for real:**
`kind === 'boostally'` computes `_blocked` from `shieldRefuses` and then says NOTHING AT ALL, so
suppressing Good as Gold there would have replaced a wrong line with no line. That site is
deliberately NOT converted and is on the hand list as its own defect.

The counter is taken where the order CHANGED an answer — `tryHitRefusal` is still ASKED under the
shield and its answer discarded — so `MEDSEEN.shieldBeforeAbility` is the exact number of refusals the
reorder moved rather than a count of shields.

### THE MOVE SET IS DERIVED FROM THE FORMAT, AND THAT IS WHAT REACHED THE BRANCHES NOBODY AIMED AT

The probe does not name branches. It takes **every legal Status move carrying the `protect` flag and
aimed at one body**, pairs each with a derived legal carrier, and plays it twice at a Gholdengo: once
Protecting, once bare. **Sixty moves staged** (one skipped — Parting Shot, batch R's road; one with no legal carrier — Spore). Nineteen SHIELDED arms were RED on the pre-fix bytes;
every BARE arm was green, which is what stops the shielded arms passing because the ability had
stopped refusing.

Two of those nineteen were **not** the reorder and would never have been found by aiming at a branch
list:

- **`healdesc` wrote a second line the authority does not write.** `protect.condition.onTryHit` ends
  `return this.NOT_FAIL`, the value that SUPPRESSES `useMoveInner`'s generic failure — so a Heal Pulse
  into a Protect is ONE line. This engine wrote `-activate|move: Protect` and then `|-fail|<mover>`.
  It was invisible until the shield stopped being shadowed by the ability refusal above it, which is
  what a reorder does: it moves the next defect into view. It has its own arm (PLAIN-SHIELD, a
  Protecting body with no ability refusal at all) and its own knob.
- **`kind === 'lockon'` had no shield check of any kind**, and **`kind === 'pass'` — an unmodelled
  click — asked only the ability.** Lock-On carries `flags.protect`, so a Protecting body answers it
  at step 1; and an unmodelled move still reaches step 1, which is how Reflect Type
  (`MEDFAILS.typeWriterCopyUnmodelled`) wrote `-immune|[from] ability: Good as Gold` where the
  authority writes the shield line. Both are MISSING checks rather than misplaced ones and are written
  out at the site. **Reflect Type's EFFECT is still not modelled**; only its narration is fixed.

The `-immune` attribution fold (`good as gold` against `goodasgold`) is `traceCanon`'s own and is
applied per field from index 2 — folding the whole line ate the hyphen in `-activate` and thirty arms
went red on it before that was corrected. **The probe's normaliser is the differential's `EQUIV` rules
rule for rule**, because a probe that compares more strictly than the gate goes red on lines the gate
has already declared equal.

---

## 4. T3 — A BODY WHOSE `|faint|` IS STILL OWED IS STILL ON THE FIELD (PRIORITY 2c)

**Probe:** `tests/probe_faint_before_source_gone_end.js`. **Knob:**
`MEDI_FAINT_CLEARS_ACTIVE_EARLY=1`.

One pool cause: `ordering :: |faint|p2b <> |-end|p1a|syrupbomb`.

### The scoreboard, said before the run

**The pool moves by exactly one cause and the lab sits still.** Not a rare mechanic — it has a pool
witness, which is why it was taken. Predicted narration 22 -> 21 causes with no transfer. **Hit at the
point estimate.**

### The mechanism, and it is NOT an `Update` ordering bug

Both engines already run the update pass ABOVE `faintMessages`, which is the authority's own order
(`sim/battle-actions.ts`: `eachEvent('Update')` at :967, `faintMessages(false, false, …)` at :976).
What differs is what the handler SEES. Syrup Bomb's condition is

```
onUpdate(pokemon) {
  if (this.effectState.source && !this.effectState.source.isActive) {
    pokemon.removeVolatile('syrupbomb'); } }              data/moves.ts
```

and `isActive` is cleared INSIDE `faintMessages`, in the same statements that write the line:

```
this.add('faint', pokemon);  ...  pokemon.fainted = true;  pokemon.isActive = false;   sim/battle.ts
```

So on the update pass the corpse is at 0 HP and **still active**, the handler declines, and the `-end`
is owed to the NEXT update — below the `|faint|`. This engine's `sourceOffField` read
`src.fainted || src.curHP <= 0` and answered "gone" at the HP transition, one whole step early. **Its
own comment cited `sim/battle.ts` and then tested the wrong thing.**

Champions DOES carry a `syrupbomb` key — `{ inherit: true, accuracy: 90 }` and nothing else — so the
condition is mainline's. The probe asserts that rather than describing it, and the first draft of that
assertion (*"Champions does not override syrupbomb"*) was RED.

### THE FLAG CANNOT BE THE TRACE'S, AND THE FIRST DRAFT MADE IT THE QUEUE'S

Two wrong attempts, both instructive:

1. **`_FAINTQ` membership.** Wrong, because `_stepFaint` writes the line directly and does not use the
   queue at all — so the guard never fired and the probe stayed red.
2. **`TR._traceFainted`.** Wrong for a worse reason: it is set by the TRACE, so a run with no trace
   would answer differently from one with a trace. That is a BOARD fact decided by whether anybody was
   watching — the exact shape the FACTS-ARE-GLOBAL rule forbids.

The stamp is therefore made on the BODY by one function, `faintLineOut(m)`, which **all 28 call sites
of `TR.faint` now go through**, whether or not a trace is attached. `noteFaint` opens the window
(undefined -> `false`) and `faintLineOut` closes it (-> `true`).

### THE CENSUS CAUGHT THE THIRD MISTAKE, AND IT IS THE INTERESTING ONE

The first working version read `!src._faintOut`, and `tests/test-mechanics.js` went **829 live / 1
missing**: `move/trapEndsWithTrapper` turned MISSING. That probe stages its corpse by writing
`curHP = 0; fainted = true` onto the trapper BY HAND — no `noteFaint`, no line — so `_faintOut` was
`undefined` and the loose reading treated it as a body whose faint line was owed **forever**, keeping
the partial trap alive. There are **three** states here, not two, and only the middle one is this
guard's: the test is `src._faintOut === false`. Census back to **830 live, 0 missing**.

### The arms

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| KO-SOURCE | `\|faint\|p2a: Hydrapple` THEN `-end\|p1a: Milotic\|Syrup Bomb` | the two lines the other way round | matches |
| ALIVE | `-start\|syrupbomb` and no `-end` while the source stands | matches | matches |
| DRAGGED-OUT | the source is Whirlwinded off ALIVE; the volatile ends, no faint line | matches | matches |

DRAGGED-OUT is the other half of `sourceOffField` and is what stops "never end the volatile" passing
KO-SOURCE. It is a PHAZE rather than a pivot because **the only legal Syrup Bomb carrier learns no
pivot in this format** — printed by the arm rather than assumed, after the first draft tried and
could not stage it.

Counters: `MEDSEEN.sourceStillActiveFaintOwed`, `MEDFAILS.faintClearsActiveEarlyRestored`.

---

## 5. THE MEASUREMENTS

Every row is the six-flag sample of §0 at the stated release.

| | baseline `5381b07ea2fa` | T1+T2 `88ad0cd7c052` | T3 `eb46032d332c` |
|---|---|---|---|
| **BOARD-MATERIAL** (`state.games` less `state.games_board_never_diverged`) | 0 / 958 | **0 / 958** | **0 / 958** |
| NARRATION-ONLY causes | 22 | **22** | **21** |
| NARRATION-ONLY games | 22 | **22** | **21** |
| protocol diverged (raw) | 25 | **25** | **24** |
| gate NARRATION (declared-adjusted) | 21 of 961 | 21 of 961 | **20 of 961** |
| transfers (new causes) | — | **0** | **0** |

An intermediate run at `4446a4d58966` (T3 before the census-driven narrowing of §4) reported the
identical 21 / 21 / 24, so the narrowing changed nothing in the pool and is recorded rather than
hidden.

**T1 and T2 were batched into ONE measurement and that was the point of the prediction.** Both
predicted the pool would not move at all; a pool that HAD moved would have been attributable to
neither and the batch would have had to be split. It did not move — the 22 causes on `88ad0cd7c052`
are the SAME 22 strings, in the same order, as the baseline.

### The instruments, re-run on the final bytes

| instrument | result |
|---|---|
| `tests/test-mechanics.js` (regenerates the census) | **830 live, 0 missing, 830 probed** |
| `engine/all_mechanics_fire.js --kind all --write` | **1313 games, 0 threw, 0 sheets unassembled** |
| `tests/roster.js --stage items --reds --write --release eb46032d332c` | 142, **0 DIFFER, 0 DID-NOT-FIRE, 18 of 18 anchors live** |
| `--stage abilities` | 139, **0 DIFFER, 0 DID-NOT-FIRE, 44 of 44 anchors live** |
| `--stage moves` | 487, **0 DIFFER, 0 DID-NOT-FIRE, 36 of 36 anchors live** |
| `--stage spine` | 20, **0 DIFFER, 0 DID-NOT-FIRE, 17 of 17 anchors live** |
| `tests/test-engine-diff.js --n 6000 --seed 20260804` | **6000 agreed, 0 disagreed** (run after T2 and again after T3) |
| `engine/status.js` | **1 of 9 gate clauses fail** — NARRATION, at **20 of 961**, and nothing else |

**No anchor died on any edit**, checked after each stage.

The probe set was re-run on the final bytes and every one is green:
`probe_yawn_safeguard_refusal`, `probe_shield_before_ability`, `probe_faint_before_source_gone_end`,
`probe_refusal_this_engine_swallowed`, `probe_recoil_on_a_corpse`, `probe_thaw_on_a_corpse`,
`probe_pivot_shield_before_ability`, `probe_syrupbomb_source_faint`, `probe_fail_names_the_move`,
`probe_direclaw_refusal_line`, and `probe_trap_timing --release eb46032d332c`.

---

## 6. PRIORITY 2 — WHAT WAS READ AND NOT FIXED

The cards were read off a dump taken on release `88ad0cd7c052`
(`--dump-games 40 --dump-out data/_narrationT-dump.json`, 22 of 25 diverging games; the 3 excluded are
the instrument's own void games). Everything below is a DIAGNOSIS with the card behind it, and no
edit was made.

### 2a. The residual trio — STILL OPEN, STILL NOT ONE MECHANISM

Not re-attempted. Batch Q built two fixtures and batch S read the three games' Speeds (70/70, 60/60,
**65/75**); two ties and one that is not. Nothing this batch did touches it and no clean bill is
given. It is the third batch in a row to leave it open, which is the correct outcome for a class
nobody can explain.

### 2b. Substitute — THREE CAUSES, ONE MECHANISM, AND IT CAN MOVE A BOARD

All three cards are the SAME shape, and reading them together is what makes it one mechanism rather
than three:

| card | the volley | showdown | medicham2 |
|---|---|---|---|
| `-end\|p1b\|substitute <> -damage\|p1a\|0fnt` | Rock Slide into Klefki (behind a doll) and Meowstic | `-resisted\|p1b`, **`-end\|p1b`**, `-damage\|p1a` | `-resisted\|p1b`, `-damage\|p1a`, **`-end\|p1b`** |
| `-activate\|p2b\|substitute\|[damage] <> -damage\|p2a\|H/H` | Matcha Gotcha into Overqwil (doll) and Froslass | `-resisted\|p2b`, **`-activate\|p2b`**, `-damage\|p2a` | `-resisted\|p2b`, `-damage\|p2a`, **`-activate\|p2b`** |
| `-end\|p1b\|substitute <> -resisted\|p1a\|1` | Rock Slide into Sinistcha (doll) and Orthworm | **`-end\|p1b`**, `-resisted\|p1a`, `-damage\|p1a` | `-resisted\|p1a`, `-damage\|p1a`, **`-end\|p1b`** |

**This engine DEFERS a substitute's `-activate|[damage]` / `-end` line until after the OTHER target's
damage; the authority finishes each target in turn order.** The HP outcomes are identical — all three
are NARRATION-ONLY and the boards agree — so a fix that moved only the emission would be board-safe in
principle. It is still not attempted, for batch R's reason: the substitute's absorption is
`onTryPrimaryHit` at spreadMoveHit's step 0, ABOVE the damage step, and moving where the engine
resolves it (rather than only where it announces it) is a change that can part a board. **A written
diagnosis and no edit is the correct outcome here, and this is the second batch to say so.**

### 2c. The four singles

- **`|faint|p2b <> |-end|p1a|syrupbomb` — FIXED, see §4.**
- **`|-boost|p1a|def|1 <> |-status|p2b|brn|[from]spicyspray`.** Muddy Water hits Archaludon (Stamina)
  and Scovillain (Spicy Spray). The authority pays Stamina's `-boost` first and this engine pays Spicy
  Spray's burn first. Both are after-hit ability responses on two different bodies, so the question is
  the ORDER of the `DamagingHit` handlers across targets — a **speed-sorted handler list**, which is
  the same family as the residual trio. Not attempted while that class is unexplained. (The
  `[from] ability: Stamina` field difference on the `-boost` line is NOT the divergence: the
  differential's `stat-attribution` rule drops `[from]`/`[of]` on boost lines.)
- **`|-activate|p1a|lightningrod <> |-prepare|p1b|electroshot`.** `useMoveInner` resolves
  `RedirectTarget` BEFORE `singleEvent('TryMove')`, which is where the charge writes `-prepare`. This
  engine's charge block sits at the top of the attack branch and its redirect block ~400 lines below
  it, so the two are inverted. Fixing it means hoisting the target resolution above the charge —
  structural, and it moves `targets` before the charge decides whether it fires at all (Electro Shot
  in rain skips the charge, which is exactly this card). **Diagnosed, not attempted.**
- **`|switch|p2a|archaludon <> |switch|p1a|gholdengo`.** A double post-KO replacement. The authority
  sends p2a first and this engine sends p1a first, i.e. this engine uses SIDE order where the
  authority uses something else. Archaludon's base Speed is 85 and Gholdengo's 84, which is consistent
  with a speed sort — **but base Speed is not the answer under SP spreads and a tie rule, so that is
  a hypothesis and not a finding.** Not attempted.

### 2d. The remaining twelve

Unchanged and unread this batch, other than the two `-fail` rows batch S already diagnosed
(Rage Powder through Instruct, and Instruct refused by the authority and EXECUTED here).

---

## 7. WHAT IS STILL OPEN

- **`kind === 'boostally'` HAS A SHIELD THAT SAYS NOTHING.** `_blocked` is computed from
  `shieldRefuses` and suppresses the boost SILENTLY, where the authority writes
  `-activate|move: Protect`. It is deliberately not part of T2 because it is a MISSING announcement
  and not a wrong order, and folding it in would have made a reorder into a new line. **Named, not
  fixed.**
- **REFLECT TYPE'S EFFECT IS STILL UNMODELLED.** T2 fixed only the narration of the branch it falls
  into. `MEDFAILS.typeWriterCopyUnmodelled` still counts it.
- **THE SUBSTITUTE TRIO** (§2b), now diagnosed as one mechanism and still board-risky.
- **THE RESIDUAL TRIO** (§2a), and the Stamina / Spicy Spray card, which look like the same
  speed-sorted-handler family.
- **THE REDIRECT vs `-prepare` ORDER** and **THE POST-KO SWITCH-IN ORDER** (§2c), both diagnosed.
- **YAWN'S `runStatusImmunity('slp')` HALF** — an Insomnia or Vital Spirit body with no status is a
  real `-fail` and is still not wired. Carried from batch S.
- **THE MAX-HP RECOIL ROAD** (`directDamage`), carried from batch S, unstageable.
- **THE 560 SPEED-READING DISAGREEMENTS**, carried from batch S; looks like the instrument.
- The four remaining bare `|-fail|` causes, carried from batch S.
- Everything else on the hand lists in `docs/ENGINE.md`.

---

## 8. DEBRIS LEFT IN THE WORKING TREE

Named rather than removed:

- `data/_narrationT-dump.json` — the 22-card dump this batch was read from. Untracked.
- Three new probes, all intended: `tests/probe_yawn_safeguard_refusal.js`,
  `tests/probe_shield_before_ability.js`, `tests/probe_faint_before_source_gone_end.js`.
- `data/roster.{items,abilities,moves,spine}.json`, `data/roster.json`,
  `data/roster.spine.prev.json` — written by the roster runs themselves.
- `data/mechanics-census.json`, `data/game-differential.json`, `data/all-mechanics-fire.json`,
  `data/engine-diff.json`, `data/engine-release.json` — rewritten by the runs above.
- `data/tags.json` — one row, one new field (`safeguard.sideBuff.blocksVolatileIds`).
- **Pre-existing and NOT this batch's:** `data/verification/_prediction-2026-09-08-gap-286-ordering.json`
  and `tests/probe_midturn_herb_resort.js` were already untracked in the working tree when this batch
  started. Left alone.
- **A PROBE THAT LOADS `engine/game_differential.js` CUTS A RELEASE AS A SIDE EFFECT** unless it is
  given `--release`. `tests/probe_trap_timing.js` refuses outright and says so; the `staged_board`
  harness does not, so several `data/releases/<id>/` directories were created by probe runs during
  this batch. Reported, not cleaned.
- Nothing was committed.

---

## 9. VERDICT

- **THE SAFEGUARD BOARD DEFECT IS FIXED**, together with the `infiltrates` exemption a probe assertion
  refuted before it could ship as a comment. **The pinned pool did not move, as predicted.**
- **Ten `tryHitRefusal` sites reordered, plus two missing shield checks and one spurious `-fail`.**
  Nineteen shielded arms RED -> green. **The pinned pool did not move, as predicted.**
- **One ordering cause closed** — a corpse is still on the field until its `|faint|` is written.
  **NARRATION 22 -> 21 causes, gate 21 -> 20 of 961**, exactly the predicted movement.
- **BOARD-MATERIAL 0 of 958 after every measurement**, and after every edit.
- **Zero transfers at every step.** Every prediction hit at the point estimate; the two misses were
  both caught by probe assertions before any measurement (Meowstic's Infiltrator, and the census's
  hand-made corpse).
- The substitute trio, the residual trio, the redirect-vs-`-prepare` order and the post-KO switch-in
  order are **diagnosed and left open**.
