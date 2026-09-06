# LONG-TAIL BATCH E — board-material 46 → 41, four fixes, four probes, one shared root cause

2026-09-06, ENGINE. Historical record. Not maintained, not current state, superseded by whatever
`node engine/status.js` prints.

---

## THE HEADLINE

| | before | after |
|---|---|---|
| **board-material** (`state.games` − `games_board_never_diverged`) | **46 of 961** | **41 of 961** |
| protocol first-divergence | 111 | 108 |
| narration-only (the second gate) | 69 | **71** — it went UP, see below |
| games whose board never diverged | 915 | **920** |
| void / threw | 5 / 1 | 5 / 1 |
| mechanics census | 829 live / 829 probed / 0 missing | **829 / 829 / 0** (level, 0 hollow, 0 threw, 0 unarmed) |
| `node engine/status.js` | 7 of 9 | **7 of 9** — the same two whole-game clauses |
| shared-coin causes in the `any` join | 13 | **8** |

`data/game-differential.json` is republished at **41 / 108 on release `14b62cd5aeec`**.

Pins IDENTICAL on every whole-game run: census `data/verification/census-pin-9446a684709d.json`,
pool `data/team-pool-frozen`, arm `middle`, `--end-state`, steering `empirical`, cap 20, 1200-pair
budget → 961 games, `driver_code_stable` true throughout.

| step | what landed | release | board-material | protocol |
|---|---|---|---|---|
| baseline | as published by batch D | `2a5fd78725e7` | 46 | 111 |
| 1 | the authority's SECOND in-move `eachEvent('Update')`, below the recoil | `9af3f4fcad16` | **44** | **109** |
| 2 | Pickpocket is paid on `AfterMoveSecondary`, below that pass | `57778abd6073` | **43** | **108** |
| 3 | the STATUS road settles its Update before a body that paid its own HP leaves | `cfe46f67bf1f` | **42** | 108 |
| 4 | a redirect clears `move.smartTarget`, so a drawn Dragon Darts stops splitting | `14b62cd5aeec` | **41** | 108 |

**FOUR OF THE FIVE GAMES CLOSED THIS PASS SHARE ONE ROOT CAUSE**, and it is one the engine had
already written down and never priced: `_updateEvent`'s own header has declared *"the authority's
SECOND in-move pass at :1003 … is NOT added here"* since 2026-08-23, and `_hpThresholdBoost` repeated
it as a "DECLARED REMAINDER". Nothing measured what it cost until the `any`-dice join sorted the
board-material half of the by-cause table into SHARED-COIN and INSTRUMENT and put five of the thirteen
actionable rows on one berry.

---

## THE PREDICTION RECORD — SIX OF EIGHT, TWO NAMED MISSES, BOTH THE SAME SHAPE

All four predictions were written to `data/verification/_prediction-longtail-E-*.json` **before**
their runs.

| step | quantity | predicted | measured | |
|---|---|---|---|---|
| 1 | board-material | **44** | 44 | hit |
| 1 | protocol | **109** | 109 | hit |
| 2 | board-material | **43** | 43 | hit |
| 2 | protocol | **108** | 108 | hit |
| 3 | board-material | **42** | 42 | hit |
| 3 | protocol | **107** | 108 | **MISS by 1** |
| 4 | board-material | **41** | 41 | hit |
| 4 | protocol | **107** | 108 | **MISS by 1** |

`threw` 1 and `void` 5 were predicted and measured on all four.

**BOTH MISSES ARE THE MECHANISM EACH PREDICTION FILE NAMED UNDER "why it might miss HIGH", and both
are the same one game re-parting on a NEW cause after its board stopped parting.** Measured by
diffing the full dumps game-by-game, not inferred:

- step 3, `pair-protect-bust …2659228530`: was *`event missing from medicham2 :: |-enditem|p2a|
  sitrusberry|[eat] <> |switch|p2a|clefable,l50|H/H`*, now *`ordering :: |-heal|p1b|H/H|[from]
  leftovers <> |-heal|p2a|H/H|[from]leftovers`* — a Leftovers residual ordering the Shed Tail defect
  had been standing in front of.
- step 4, `pair-redirect-priority …2657802642`: was *`extra event emitted by medicham2 ::
  |-enditem|p1b|sitrusberry|[eat] <> |-damage|p1a|H/H`*, now *`ordering :: |-activate|p1a|protect <>
  |move|p2a|flareblitz`*.

In both cases **no game entered or left the diverging set** and **no new cause row appeared in the
`any` table** — one game changed its label. The board half is what the bar reads, and it hit 4/4.

**NARRATION WENT UP, 69 → 71, AND THAT IS THE SAME FACT SAID FROM THE OTHER SIDE.** Narration-only is
`protocol_diverged_board_never_did`, so a game whose board stops parting while its protocol still
parts MOVES from the board column into the narration column. Two of the five board closures did
exactly that. The second gate is not being neglected here; it is being handed a game the first gate
used to own.

---

## FIX 1 — THE AUTHORITY RAISES `Update` TWICE INSIDE A MOVE, AND THE SECOND ONE IS BELOW THE RECOIL

`data/mods/champions/scripts.ts` — the mod overrides `hitStepMoveHitLoop` and keeps **both** passes
verbatim (mainline line numbers in brackets):

```
this.battle.eachEvent('Update');                                 :538   [:967]
this.battle.faintMessages(false, false, !pokemon.hp);            :547   [:976]
if (move.multihit …) this.battle.add('-hitcount', …);            :550   [:978]
if (move.totalDamage) this.applyRecoilDamage(…);                 :554   [:982]
if (!damage.some(val => !!val || val === 0)) return damage;      :572   [:1001]
this.battle.eachEvent('Update');                                 :575   [:1003]   <-- THIS
this.afterMoveSecondaryEvent(…);                                 :577   [:1005]
```

**WHY IT IS BOARD-MATERIAL AND NOT AN ORDERING NOTE.** medicham2 calls `_updateAll()` from exactly two
sites (`:25190` and `:37700`) and **both sit under `if(sideWiped(S)){…break _TURN;}`**. A move that
ENDS THE BATTLE therefore never reaches the pass at all, and the attacker walks off the field holding
a berry the authority ate. Everywhere else the two engines coincide — nothing is emitted between the
recoil and the next action's pass — which is why the population is two games in 961 and not two
hundred, and why a one-turn fixture cannot express it.

```
showdown   |-damage|p2b: Incineroar|81/170|[from] Recoil
           |-enditem|p2b: Incineroar|Sitrus Berry|[eat]
           |-heal|p2b: Incineroar|123/170|[from] item: Sitrus Berry
medicham2  |-damage|p2b: Incineroar|81/170|[from] Recoil        (and nothing further)
```

The gate is `_reached > 0`, the same one `_stepUpdate` carries, and it is the authority's own
population: `damage[i]` is `0` for a substitute hit (`md === true`), so the `val === 0` clause passes
there, while a miss / a Protect / a type immunity leaves `damage` filled with `false` and returns
above the call.

**PROBE — `tests/probe_second_update_pass.js`, knob `MEDI_NO_SECOND_INMOVE_UPDATE`.** The fixture is a
SIDE WIPE, because that is the only shape the defect is visible in, and every number in it is derived
on the run: a 100-accuracy recoil move whose hit is LETHAL FROM FULL (so `dealt` is the clamp, a
constant under any roll and any crit) into a target whose max HP makes `round(dealt·r0/r1)` land
strictly between half the attacker's built max HP and all of it. The other three bodies on the
defending side are **Memento** carriers — `selfdestruct: 'ifHit'`, aimed at the attacker's PARTNER, so
each removes itself with no damage to anything. Healing Wish was the first choice and is **wrong**:
its `onTryHit` fails when the side cannot switch, so the third one would have survived and the side
would never have been wiped.

Chosen this run: Pikachu [Static] + Sitrus Berry, Volt Tackle into a Moxie Gyarados (170 built HP,
4x). `dealt` 170 → recoil 56 against a built 110, half = 55; the berry heals 27. **Authority 81/110,
engine-before 54/110 holding the berry.** The silent control removes the berry, both engines read 54,
and the knob does not move it.

---

## FIX 2 — PICKPOCKET IS `onAfterMoveSecondary`, WHICH IS BELOW THE RECOIL *AND* BELOW THAT PASS

`data/abilities.ts:3230` (no Champions override — `pickpocket` does not occur in
`data/mods/champions/abilities.ts`):

```
onAfterMoveSecondary(target, source, move) {
  if (source && source !== target && move?.flags['contact']) {
    if (target.item || target.switchFlag || …) return;
    const yourItem = source.takeItem(target);        <- THE SOURCE'S HAND, READ AT :1005
```

This engine paid the theft inside the per-hit reaction block — twelve steps, one faint pass and one
recoil ABOVE the event — and its own header called that position correct. The header's argument was
about the PUNISHES (Rough Skin fires first, which is true and is not the question). What it missed is
that everything between the arrival and :1005 can **change the hand the handler reads**:

```
showdown   |-damage|p2a: Incineroar|58/170|[from] Recoil
           |-enditem|p2a: Incineroar|Sitrus Berry|[eat]     <- eaten at :1003
           |-heal|p2a: Incineroar|100/170|[from] item: Sitrus Berry
medicham2  |-enditem|p2a: Incineroar|sitrusberry|[silent][from] ability: pickpocket…
           |-item|p1b: Weavile|sitrusberry|[from] ability: pickpocket
           |-enditem|p1b: Weavile|sitrusberry|[eat]         <- a berry that no longer existed
           |-heal|p1b: Weavile|37/145|[from] item: sitrusberry
           |-damage|p2a: Incineroar|58/170|[from] Recoil
```

Two bodies' items and two bodies' HP wrong at once. The theft is now DECIDED in the per-hit block
(only that code knows which arrival made contact) and PAID below the second Update, and **every hand
read is re-taken at payment time** — `requiresEmptyHand`, `itemOn(source)` and `itemRefusesTake` are
all asked at :1005 in the authority, so they are asked at :1005 here. Carrying the decision's answers
forward would have reproduced the defect one function down.

**THE NARRATION HALF IS IN THE SAME FIX AND IT WAS NOT VISIBLE BEFORE.** With the theft paid twelve
steps early the two `-enditem` lines never landed on the same index, so the aligner reported the
ORDERING and never reached the fields. The moment the order was right, the probe's SILENT CONTROL went
red on this:

```
authority  |-enditem|p1a: Pikachu|Sitrus Berry|[silent]|[from] ability: Pickpocket|[of] p1a: Pikachu
medicham2  |-enditem|p1a: Pikachu|sitrusberry|[silent][from] ability: pickpocket|[of] p1a: Pikachu
```

`[silent]` and `[from]` are TWO fields in the authority and this engine folded them into one — and the
`enditem` emitter's own header had already written down why that is not cosmetic: **the differ's
display-flags rule drops a FIELD matching `/^\[silent\]/`, so the folded string is dropped WHOLE and
the attribution goes with it.** New emitter `TR.enditemRobbed`, on `stealeat`'s pattern one field over.

**PROBE — `tests/probe_pickpocket_event_position.js`, knob `MEDI_PICKPOCKET_IN_HIT_LOOP`.** It does NOT
reproduce the real game's Focus Sash, which is scenery. What the case needs is a thief with an empty
hand, an attacker holding a pinch berry, and a recoil that crosses the attacker's pinch line — and the
last is arranged with a **fixed-damage chip** (`damage: 'level'` deals exactly the level, so the HP
going into the swing is an exact number rather than a roll). Chosen: Pikachu + Sitrus, Volt Tackle
into an empty-handed Pickpocket Grimmsnarl, chipped 50 by an Annihilape Night Shade.

**AND THE ARITHMETIC IS ASSERTED AS A RELATION, NOT AGAINST A MODEL.** The probe's own damage model was
one point out on its first run (60 modelled, 59 played) — a reimplementation of the authority's
rounding is a second copy of a fact. So the verdict asserts `control(bare recoil) + heal ===
authority`, which needs no model at all; the modelled figure only proposes the fixture.

The SILENT CONTROL is the half that matters most here: with no chip the recoil does not cross, the
berry is still in the attacker's hand at :1005, and **Pickpocket must still fire** — in both engines
and under both knob settings. That is what says the event moved rather than the ability being deleted.

---

## FIX 3 — A STATUS MOVE THAT PAYS ITS OWN HP AND THEN LEAVES MUST SETTLE FIRST

`eachEvent('Update')` is raised inside the hit loop for every move that CONNECTS, **status moves
included**: a status move's `spreadMoveHit` returns `true`, which becomes `damage[i] = 0`, so
`if (!moveDamage.some(val => val !== false)) break;` does not fire above the pass. Shed Tail's HP is
paid inside that same call (`moveHit` applies `volatileStatus` and then `onHit`, and `onHit` is
`this.directDamage(Math.ceil(source.maxhp / 2))`). The SWITCH is later still — `useMove` queues
`selfSwitch` after `useMoveInner` returns. **Authority: cost, Update, leave. This engine: cost, leave.**

`_stepUpdate` cannot reach here and its own header says why: it lives in the DAMAGING step list, and
*"STATUS moves do not reach this step list at all"*. Harmless for every status move that STAYS — the
between-action pass settles it a moment later, at the same point in the stream — and not harmless for
one that LEAVES, because by then the body is on the bench and out of `actA`/`actB` entirely.

```
showdown   |-damage|p2a: Orthworm|72/145
           |-enditem|p2a: Orthworm|Sitrus Berry|[eat]
           |-heal|p2a: Orthworm|108/145|[from] item: Sitrus Berry
           |switch|p2a: Clefable|Clefable, L50|170/170|[from] Shed Tail
medicham2  |-damage|p2a: Orthworm|72/145
           |switch|p2a: Clefable|clefable, L50|170/170|[from] shedtail
```

A party HP leaf and a party item leaf at once, on a body that comes back later.

**PROBE — `tests/probe_selfswitch_update_pass.js`, knob `MEDI_NO_SELFSWITCH_UPDATE`. It needs no search
at all, and that is derived rather than lucky:** the cost is `ceil(maxhp/2)` and the move's own failure
clause is `hp <= ceil(maxhp/2)`, so a user at full HP always lands on `floor(maxhp/2)` — at or below
the pinch threshold for every body in the regulation. One turn, one click, no roll, no accuracy die.
Chosen: Heliolisk, 137 built HP, cost 69 → 68, berry 34 → 102 on the bench with an empty hand.

**NOT CLAIMED:** the other pivot family (`pivotStatus` — Parting Shot, Chilly Reception) does not get
the pass. Its members change no HP and no status on the body that leaves, so there is nothing to
settle, and widening it without a failing probe would be adding a call on an argument rather than on a
measurement.

---

## FIX 4 — A REDIRECT CLEARS `move.smartTarget`, SO A DRAWN DRAGON DARTS STOPS SPLITTING

`Pokemon#getMoveTargets` runs the redirect event FIRST and calls `getSmartTargets` SECOND:

```
target = this.battle.priorityEvent('RedirectTarget', this, this, move, target);   sim/pokemon.ts:836
if (move.smartTarget) { targets = this.getSmartTargets(target, move); … }                        :838
```

The engine's existing comment — *"PLACED AFTER REDIRECTION ON PURPOSE … the partner is the partner of
whoever the darts ended up aimed at"* — is half the rule. The missing half is that **every redirector
turns the flag off on its way past**, so `getSmartTargets` is never called and both darts land on the
redirector:

```
followme.condition.onFoeRedirectTarget    if (move.smartTarget) move.smartTarget = false;   data/moves.ts:6065
ragepowder.condition.onFoeRedirectTarget  if (move.smartTarget) move.smartTarget = false;   data/moves.ts:14617
lightningrod.onAnyRedirectTarget          if (move.smartTarget) move.smartTarget = false;   data/abilities.ts:2346
stormdrain.onAnyRedirectTarget            if (move.smartTarget) move.smartTarget = false;   data/abilities.ts:4641
```

```
showdown   |-damage|p1b: Volcarona|65/160   …   |-damage|p1b: Volcarona|31/160
medicham2  |-damage|p1b: Volcarona|65/160   …   |-damage|p1a: Rotom|1/125
```

Rage Powder drew the darts onto Volcarona; the authority put BOTH into it and this engine split them,
taking a Rotom-Wash from 56/125 to 1/125 that the authority never touched.

### THE DERIVATION WAS WRONG FIRST AND THE PROBE'S OWN SOURCE CHECK CAUGHT IT

The rule I was about to wire was **"a MOVE-sourced redirect clears the flag, an ABILITY-sourced one
does not"** — reasoned from a grep that found no `smartTarget` in `data/abilities.ts` except Berserk's
damage read. `tests/probe_smart_target_redirect.js` reads the four blocks out of the authority's own
text on every run and printed

```
redirect abilities clear it        : YES — the derivation below is WRONG
RED — the authority does not say what this probe is about to assert.
```

**before a line of engine code was written.** Lightning Rod and Storm Drain clear it too; the rule is
simply *any redirect*. That check stays in the probe rather than being written down once, because a
regulation that changed one of the four would otherwise leave the comment describing an engine nobody
has.

**PROBE — `tests/probe_smart_target_redirect.js`, knob `MEDI_SMART_TARGET_SURVIVES_REDIRECT`.** Chosen:
Dragapult clicks Dragon Darts at an Abomasnow while a Maushold clicks Follow Me (preferred over Rage
Powder because it carries no powder flag, so a Grass type or Overcoat cannot silently un-stage the
fixture). Authority and fixed engine: the aimed body untouched at 165/165, the redirector on 26/149.
The SILENT CONTROL removes the redirect click and asserts the darts **still split** — 136/165 and
86/149 in both engines and under both knob settings.

A THIRD SITE IS NAMED AND NOT COVERED: `wonderguard.onTryHit` (`data/abilities.ts:5551`) clears the
same flag on an IMMUNITY and suppresses its own `-immune` line when it does. Different question, not
folded in.

---

## THE INSTRUMENT WAS SUSPECTED FIRST, TWICE, AND WAS THE ANSWER BOTH TIMES

- **The probe read a board that had not been played.** `probe_smart_target_redirect.js`'s first run
  reported every body untouched and three greens. `onBoundary` fires **before turn 1** as well as
  after it, so `seen[0]` is the board before anything was clicked. Caught by the probe's own FIXTURE
  assertion (*"the redirector was hit at all"*), which is exactly what that assertion is for. All four
  probes now read the LAST boundary.
- **The new counters read ZERO and the counters are not the engine.** `MEDSEEN.secondInMoveUpdateRan`
  and its siblings read 0 after a 260-game pinned run — **and so did `inMoveUpdateRan`, which has been
  non-zero on every real run since 2026-08-23.** `game_differential.js` runs the engine out of the
  RELEASE (`REL.require`), so a plain `require('./engine/medicham2-browser.js')` beside it returns a
  SECOND module instance nothing ever touched. Opening the same release and requiring again does not
  help either. **This is recorded as unread rather than as zero**; exporting the handle would move
  `driver_code` and make every run in this batch non-comparable with the next, and that is not done
  mid-batch. The four probes prove the paths execute, and they prove it more strongly than a counter
  would: each shows a knob-dependent CHANGE IN BEHAVIOUR, which is impossible without the code running.

---

## THE CLAUSES THIS PASS STALED WERE RE-RUN ON `14b62cd5aeec` AND NONE MOVED

- **Damage differential:** `--n 6000`, **0 disagreements** at the midpoint and at both endpoint arms
  and at all fourteen interior indices. Seed 20260804.
- **Roster:** items **140 of 148 tested**, abilities **129 of 202**, moves **475 of 500**;
  `FIRED-AND-BOARDS-DIFFER` **0** and `DID-NOT-FIRE` **0** on all three stages.
- **`all_mechanics_fire.js --kind all --write`:** 1313 games, **0 threw, 0 sheets unassembled**.
- **`tests/test-game-diff.js`:** green — the instrument test over the file this pass did NOT edit
  (`game_differential.js` is untouched in batch E).
- **Census:** regenerated after the last engine change — **829 live / 829 probed / 0 missing, 0
  hollow, 0 threw, 0 unarmed.** Level. It has never gone down.
- `node engine/status.js` reads **7 of 9**, and the two failures are exactly the two whole-game clauses
  on their measured counts (board-material 41 of 961 = 4.3%, narration 71 of 961).

---

## WHAT IS LEFT, AND WHAT THE `any` JOIN SAYS ABOUT IT

Re-derived on `14b62cd5aeec`: **8 shared-coin causes** (the simulator's to fix) and **60
instrument-suspect** (to be WITHHELD, not fixed). Every remaining shared-coin cause is ONE game.

| cause | note |
|---|---|
| `-crit: a different body :: \|-crit\|p2a <> \|-crit\|p2b` | a spread Rock Slide crits a different body in each engine; a crit-address / spread-order question |
| `ordering :: \|-enditem\|p1b\|whiteherb <> \|detailschange\|p2a\|raichumegay,l50` | the entry White Herb against the mega, opposite order |
| `extra event emitted by medicham2 :: \|move\|p2b\|rockslide <> \|-hitcount\|p1:\|1` | **DERIVED AND NOT TAKEN — see below.** A Champions-only clause |
| `unrelated event mismatch :: \|move\|p1a\|moonblast <> \|-damage\|p1a\|H/H\|[from]confusion` | the confusion self-hit decision |
| `extra event emitted by medicham2 :: \|faint\|p2b <> \|-start\|p1b\|perish0` | Perish Song against the faint, at the residual |
| `extra event emitted by medicham2 :: \|-damage\|p2b\|H/H\|[from]lifeorb <> \|-unboost\|p2b\|def\|1` | the Life Orb toll against a `-unboost` on the same body |
| `showdown stopped emitting while medicham2 continued :: \|switch\|p2a\|pelipper,l50\|H/H` | a truncation |
| `-damage field 3 :: burn 142/146 vs 137/146` | a burn residual, five points |

**ONE OF THOSE IS FULLY DERIVED AND DELIBERATELY NOT TAKEN.** The `-hitcount` row is a Champions-only
clause the mod adds to `hitStepMoveHitLoop`:

```
if (move.multihit && typeof move.smartTarget !== 'boolean' &&
    !(move.hit === 1 && move.multihitType === 'parentalbond')) {          scripts.ts:548-551
  this.battle.add('-hitcount', targets[0], hit - 1);
}
```

Mainline has no `parentalbond` clause. A Parental Bond volley whose first strike KOs the target leaves
`move.hit === 1` (the loop breaks at the top of iteration 2, before `move.hit = hit` runs), so
**Champions writes NO `-hitcount` where mainline writes `|…|1`** — and this engine writes the mainline
line. It is real, it is one line in `_stepHitCount`, and it was left because **a `-hitcount` line
writes no board leaf**: it can move the NARRATION gate and cannot move the bar, and the bar is what
this batch was dispatched against. Handed forward with the derivation done.

---

## FILES

- `engine/medicham2-browser.js` — four wires, four knobs, eight counters, one new trace emitter
  (`TR.enditemRobbed`). **LF endings preserved and checked (0 CR bytes) after every edit** — the batch
  C CRLF incident moved every release digest with zero code change.
- `tests/probe_second_update_pass.js` — new, knob `MEDI_NO_SECOND_INMOVE_UPDATE`.
- `tests/probe_pickpocket_event_position.js` — new, knob `MEDI_PICKPOCKET_IN_HIT_LOOP`.
- `tests/probe_selfswitch_update_pass.js` — new, knob `MEDI_NO_SELFSWITCH_UPDATE`.
- `tests/probe_smart_target_redirect.js` — new, knob `MEDI_SMART_TARGET_SURVIVES_REDIRECT`.
- `data/verification/_prediction-longtail-E-{secondupdate,pickpocket,selfswitchupdate,smarttarget}.json`
  — written before their runs.
- `data/verification/longtail-E-{secondupdate,pickpocket,selfswitchupdate}.json` and
  `data/verification/divergence-turns-E{,1,2,3,4}.json` — the measured artifacts and their dumps.
  **`longtail-E-baseline.json` DOES NOT EXIST and the step-1 prediction file cites it — that citation
  is wrong and is corrected here rather than edited out of a dated record.** `--out` only takes effect
  alongside `--write`, so the baseline reproduction run wrote its DUMP
  (`divergence-turns-E.json`, the file the whole batch was bucketed from) and no artifact. The
  baseline figures 46 / 111 on `2a5fd78725e7` are batch D's, and the artifact that carries them is
  `data/verification/longtail-D-anybucket.json`. Step 4 wrote no `longtail-E-*` file either: it
  published straight into `data/game-differential.json`, which is where the gate reads.
- `data/game-differential.json`, `data/engine-diff.json`, `data/mechanics-census.json`,
  `data/all-mechanics-fire.json`, `data/roster.{items,abilities,moves,all}.json`, `data/roster.json`,
  `data/game-diff.json` — regenerated on `14b62cd5aeec`.

**NOT TOUCHED, as instructed:** `engine/status.js`, `engine/quarantine.js`, `engine/docs_scan.js`,
`engine/steering.js`, `data/policy-weights.json`, `engine/board.js`, `engine/magnemite.js`,
`data/engine-data.js`, `engine/game_differential.js`, `engine/board_state.js`. **`data/tags.json` and
`data/abra-tags.js` are UNTOUCHED** — none of the four fixes needed a tag regeneration; every one is a
consumer standing in the wrong place relative to an event, with the tag already correct.

**Nothing downstream becomes quotable.** No model was fitted, no weight vector was written, the
quarantine does not lift, and every withheld figure stays withheld.

---

## THE LIVING-DOCUMENT UPDATE IS OWED AND WAS DELIBERATELY NOT TAKEN

`CHANGELOG.md` is **NOT** bumped and no new version block was added to the white paper, the deck, the
technical docs, `docs/SUMMARY.md` or `docs/MODELS.md`. A documents agent was live in the same tree for
the whole of this batch — `docs/ABRA-whitepaper.md`, `docs/SUMMARY.md`, `docs/MODELS.md`,
`docs/MEASURE.md`, `docs/SEARCH.md`, `docs/WEB.md` and nine others were modified by a session that did
not open them here — and CLAUDE.md's single-writer rule says two agents that cannot see each other's
edits produce a silent later-write-wins.

**And bumping the version alone would ship a red `tests/test-docs-current.js`**, which batch C already
paid for: raising the top version strands every document still stamped at the old one.

**What is owed:** a version block in each of the five living documents carrying **board-material 41 of
961 and protocol 108 on release `14b62cd5aeec`**, superseding batch D's 46 / 111 on `2a5fd78725e7`.
