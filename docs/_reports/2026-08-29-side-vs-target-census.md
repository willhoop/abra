# SIDE OR TARGET — ALL TWENTY-TWO CLASSIFIED, TWO WRONG AND FIXED, THREE WRONG AND FILED (2026-08-29, ENGINE)

**Verdict in six lines.**

- **Of the twenty-two: SEVEN are SIDE questions and FIFTEEN are TARGET questions.** Every one carries
  the authority line that decides it in `data/side-selection-declarations.json`. §2.
- **FIVE of the fifteen are WRONG, and they are one cause:** a body that the aim already resolved is
  looked up in the mover's FOE array, scores `-1`, and the site does nothing in silence.
- **TWO were fixed here** — the two halves of `forcesSwitch`, which are ONE authority function
  (`sim/battle-actions.ts:1353`) and therefore one batch. **THREE are separate mechanics with separate
  fixtures and are FILED, not fixed** (the redirect gate, the delayed-hit booking, Defog's target
  side). §7 — **re-dispatch them; they are not one batch with these two.**
- **What I left behind: `engine/side_selection_census.js`.** It scans this engine, not the authority,
  finds **102 side-selecting sites** and ratchets the UNDECLARED count downward. **Yes, it catches a
  sixth spelled differently** — it already found three spellings the brief's regex misses, including
  `m._sf===sfA?sfB:sfA`, which does not contain the word `side`. **It would NOT catch a site that picks
  a side without an `A`/`B` ternary.** §5.
- **Board-parted 90 before, 90 after, of 961. PREDICTED, and stated before the run** — with a
  structural reason rather than a hope: **neither driver can aim a `normal` move at a partner**, so the
  pool has never once exercised this class. Protocol 205 → 205, threw 1 → 1, end-state 898/60/2/1
  unchanged.
- **Census 801 → 803 live / 803 probed / 0 missing.** Probe `tests/probe_ally_forced_switch.js`,
  **6 arms, 3 red and 3 controls, 0 failing.**

Release `e8f7c7dba595` → **`070890fc77a2`**.

---

## 1. THE SCOREBOARD PREDICTION, WRITTEN BEFORE THE DIFFERENTIAL WAS LAUNCHED

> **The lab must move: +2 census rows and 3 red probe arms. The pool must NOT move — board-parted
> stays at exactly 90 of 961 and protocol at 205.** Not a hope: `game_differential.js`'s
> `chooseAction` (:4805) and `empiricalPick` both write `target = j + 1` over the FOES for
> `normal` / `any` / `adjacentFoe`, and the scripted encoder (:4471) did the same until this batch
> added `{ ally: true }`. **No pooled game has ever aimed a `normal` move at a partner**, and for a
> foe-aimed action `sideBoxOf` returns byte-identically what the old ternary returned.

**That is what happened.** The run's own AIM counter is the corroboration: `31216 at a foe, 467 at an
ally, 0 at self, 42650 naming nobody`. **All 467 ally aims are `adjacentAlly` moves** — the four
chooseable ones the Armor Tail pass enumerated — and not one is a `normal` move pointed sideways.

| | before (`e8f7c7dba595`) | after (`070890fc77a2`) |
|---|---|---|
| games / threw | 961 / 1 | 961 / 1 |
| **board-parted** | **90** | **90** |
| games the board never parted | 871 | 871 |
| protocol diverged | 205 | 205 |
| turn boundaries identical | 10260 / 10566 | 10260 / 10566 |
| median turn of first board divergence | 5 | 5 |
| end-state SAME / DIFFERENT / ENDED-APART / THREW | 898 / 60 / 2 / 1 | 898 / 60 / 2 / 1 |
| of the parted 205: same-end / different / apart / threw | 149 / 53 / 2 / 1 | 149 / 53 / 2 / 1 |
| by shape EMISSION / RULE / FIELD / ORDERING / UNPARSED | 86 / 55 / 36 / 24 / 4 | 86 / 55 / 36 / 24 / 4 |
| distinct causes | 184 | 184 |
| BOARD-MATERIAL causes / cause-games | 75 / 86 | 75 / 86 |
| NARRATION-ONLY causes / cause-games | 109 / 119 | 109 / 119 |

Pins, both arms: `--games 1200` (yields 961), `--arm middle`, `--turns 12`, `--steering empirical`,
`--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`,
pool digest `0d103fb9fa87`. After-artifact `data/verification/game-differential.sidetarget.json`.
`arms_comparable.js` reads **COMPARABLE** (steering digest `9446a684709d` on both).
**`data/game-differential.json` was NOT written** — verified by mtime, still 2026-08-28 23:14:37.

**`arms_comparable.js` SAYS IT CANNOT SEE THE DRIVER, AND THIS BATCH CHANGED THE DRIVER — SO IT IS
ASSERTED BY HAND.** `engine/game_differential.js` is the instrument and is not in the engine release.
The only edit to it is inside `scriptChoice`, which builds a choice from a `{ m, t, ally }` script
step. **The empirical arm never calls `scriptChoice`** — its actions come from `chooseAction` /
`empiricalPick` — so no byte of this change is on the path either arm took. The three FOE-axis control
arms of the probe are the same claim measured on a board.

---

## 2. THE CLASSIFICATION — ALL TWENTY-TWO, WITH THE AUTHORITY LINE

Line numbers are the PRE-batch tree (`e8f7c7dba595`), which is the tree the brief counted.
`data/side-selection-declarations.json` carries the same table keyed so it survives an edit.

| # | line | site | question | authority | verdict |
|---|---|---|---|---|---|
| 1 | 16860 | `statusMoveTargets` — the spread target list | **SIDE** | `sim/pokemon.ts:809-816` `case 'allAdjacent': targets.push(...this.adjacentAllies()); // falls through` | CORRECT |
| 2 | 20843 | `reaimToSlot` — slot → body on the foe axis | TARGET | `sim/pokemon.ts:770 getAtLoc` — one SIGNED targetLoc reads both directions | CORRECT |
| 3 | 21935 | `switchTrapVerdict` — who traps | **SIDE** | `data/abilities.ts` shadowtag / arenatrap / magnetpull are all `onFoeTrapPokemon` | CORRECT |
| 4 | 22981 | Encore's execution-time override — the draw pool | TARGET | `sim/battle.ts:2517` `return pokemon.side.randomFoe() \|\| ...` | CORRECT |
| 5 | 23046 | the `randomTarget` draw pool | TARGET | `sim/battle.ts:2508-2517` — the `activePerHalf > 2` clause is skipped in a double | CORRECT |
| 6 | 23161 | the REDIRECT GATE for a single-target status move | TARGET | `sim/pokemon.ts:829-836` — RedirectTarget runs on ANY resolved target | **WRONG — filed §7** |
| 7 | 23742 | Pressure's apparent-target list | TARGET | `data/abilities.ts:3431` `onDeductPP(target, source) { if (target.isAlly(source)) return; return 1; }` | CORRECT |
| 8 | 24273 | the pre-dispatch priority refusal | TARGET | `data/abilities.ts:223` `if ((source.isAlly(armorTailHolder) \|\| move.target === 'all') && move.priority > 0.1)` | CORRECT |
| 9 | 25317 | the called-move draw pool (Copycat / Metronome / Sleep Talk / Mirror Move) | TARGET | `sim/battle.ts:2517` | CORRECT |
| 10 | 25352 | the spliced called-move SLOT SIGNING | TARGET | `sim/pokemon.ts:770` | CORRECT |
| 11 | 25530 | the delayed-hit booking (Future Sight / Doom Desire) | TARGET | `data/moves.ts` futuresight `target: 'normal'` | **WRONG — filed §7** |
| 12 | 25570 | the STATUS phaze address book | TARGET | `sim/battle-actions.ts:1353 forceSwitch` — no side test | **WRONG — FIXED §4** |
| 13 | 25703 | where a hazard layer lands | **SIDE** | `sim/pokemon.ts:796-804` — every hazard in this format is `foeSide` | CORRECT |
| 14 | 26505 | Instruct's foe array | TARGET | `data/moves.ts:9670` `targetLoc: target.lastMoveTargetLoc` — and the side is already derived from the instructed BODY | CORRECT |
| 15 | 27184 | a bare SWITCH | **SIDE** | `sim/battle-actions.ts:118-132 switchIn` — the swap is entirely within `side.pokemon` | CORRECT |
| 16 | 27388 | `passstate` (Baton Pass and family) | **SIDE** | same | CORRECT |
| 17 | 28585 | the in-branch priority refusal, which covers the SPREAD case | TARGET | `data/abilities.ts:223`; `psychicterrain.condition.onTryHit` `if (target.isSemiInvulnerable() \|\| target.isAlly(source)) return;` | CORRECT |
| 18 | 28603 | the attack branch's address book | TARGET | `sim/pokemon.ts:809-849` | CORRECT |
| 19 | 32978 | `hazardOnHit` (Stone Axe / Ceaseless Edge) | **SIDE** | `data/moves.ts:18074` `for (const side of source.side.foeSidesWithConditions())` | CORRECT |
| 20 | 32987 | `removesHazards` (Defog) | TARGET | `data/moves.ts:3463` `if (target.side.removeSideCondition(targetCondition))` | **WRONG — filed §7** |
| 21 | 33658 | the damaging PIVOT's own switch-out | **SIDE** | `sim/battle-actions.ts:118-132` | CORRECT |
| 22 | 33673 | the DAMAGING forced switch | TARGET | `sim/battle-actions.ts:1353` | **WRONG — FIXED §4** |

**SEVEN SIDE, FIFTEEN TARGET. SEVENTEEN CORRECT, FIVE WRONG.**

### 2.1 WHY THE SEVENTEEN ARE CORRECT, AND IT IS NOT "IT LOOKED FINE"

Three of them are the interesting ones, because the far side there is not an assumption at all — it
is the authority's own near-side test written the other way round in a two-sided game:

- **Pressure (7).** `onDeductPP` returns early for an ally, so restricting the apparent-target list to
  foes is that early return. It even gets `foeSide` right by a different route: `pressureScopeOf` reads
  `none` for a `foeSide` move without `mustpressure`, which is `pressureTargets = []` on
  `sim/pokemon.ts:855`.
- **Armor Tail / Queenly Majesty (8 and 17).** In `onFoeTryMove(target, source, move)` the handler's
  `source` **is the move's target**. `source.isAlly(armorTailHolder)` therefore asks *does the move's
  target stand on the holder's side*, and the holder is by construction a foe of the mover — so "the
  target is in the mover's foe array" is the same predicate. This is the fact card C6 rests on and it
  is unchanged.
- **`hazardOnHit` (19).** Stone Axe and Ceaseless Edge name `source.side.foeSidesWithConditions()`
  **explicitly**, so even an ally-aimed hit lays its rocks across the field. That one is a SIDE
  question that *looks* like a target question, which is why it is written down rather than left to
  the next reader.

**`getRandomTarget`'s draw pools (4, 5, 9) are correct for a reason worth keeping**: the authority's
own comment at `sim/battle.ts:2510` says *"even if a move can target an ally, auto-resolution will
never make it target an ally"*. Read whole, not recalled.

---

## 3. THE CAUSE THE FIVE SHARE

`reaimToSlot` has answered BOTH axes since ROADMAP #223 — `allySlot` first, `tgtSlot` second — so the
body it returns can legitimately stand on the mover's own side. Five callers then asked *where does
that body live* and answered with `it.side==='A'?…B:…A`.

The trigger is a `normal`-target move aimed at one's own partner, which is a legal choice:

```
case 'randomNormal': case 'scripted': case 'normal': return isAdjacent;      sim/battle.ts validTargetLoc
```

`isAdjacent` for a negative targetLoc is `Math.abs(targetLoc - sourceLoc) === 1` — the partner. There
is no `isFoe` test in that arm; `adjacentFoe` has one and `normal` does not.

**THE SYMPTOM IS ALWAYS SILENCE, WHICH IS WHY NONE OF THE FIVE HAD EVER BEEN NOTICED.** `indexOf`
returns `-1`, and every one of the five sites reads `-1` as *there is nothing here*: the status phaze
failed the move, the damaging drag `continue`d, the delayed hit counted `delayedHitNoSlot`, the
redirect gate skipped the whole draw, and Defog swept the wrong half of the field.

---

## 4. THE FIX — ONE READER, TWO CALL SITES, ONE AUTHORITY FUNCTION

`engine/medicham2-browser.js`.

**`sideBoxOf(body, it, actA, actB, benchA, benchB, sfA, sfB)`** returns `{own, bench, sf, foes}` for
the side the body actually stands on. Two things about it are deliberate:

- **The fallback is LOUD.** A body on neither active array gets the mover's far side — the
  pre-2026-08-29 answer, unchanged — and bumps `MEDSEEN.targetSideNotOnField`. A silent fallback here
  would look exactly like a working feature.
- **`MEDSEEN.targetSideIsMoversOwn` counts the branch that did not exist before**, and the probe
  asserts it at an EXACT per-arm value (1 on the three red arms, 0 on the three controls), so "the two
  engines agree" cannot be read off a branch that never ran.

The two callers are the two halves of `forcesSwitch`, and they are ONE batch because the authority has
one function for both — the file's own Suction Cups note already says so:

```
sim/battle-actions.ts:1353  forceSwitch() -> runEvent('DragOut', target, source, move)
sim/battle-actions.ts:1104  the DAMAGING half, inside spreadMoveHit
sim/battle-actions.ts:1260  the STATUS half, in the same function's other arm
```

The damaging door's box is computed **per row inside the loop**, not once above it, because the row is
what carries the body.

`MEDI_TARGET_SIDE_FOE_ONLY=1` restores the far-side-only answer at every caller and stamps
`MEDFAILS.targetSideFoeOnlyRestored` at load — which is what makes "the knob reached the module the
driver played" checkable rather than assumed.

### 4.1 THE INSTRUMENT HAD TO GROW BEFORE THE FIXTURE COULD BE BUILT

`game_differential.js`'s scripted encoder wrote `target = want.t + 1` for every `normal` move, so
**there was no way to express the ask at all**. `{ ally: true }` now writes the negative targetLoc; an
ally ask on a class that cannot legally name a partner (`adjacentFoe`) is **REFUSED and counted**
(`scriptCounters().allyAimRefused`), asserted at exact zero by the probe — an ally ask that quietly
became a foe aim would be an arm that agrees while testing nothing.

That change is additive and cannot touch the empirical arm, which never calls `scriptChoice`.

---

## 5. WHAT I LEFT BEHIND — `engine/side_selection_census.js`

```
node engine/side_selection_census.js              # the census and the ratchet verdict
node engine/side_selection_census.js --undeclared # only the rows nobody has classified
node engine/side_selection_census.js --write      # restamp data/side-selection-census.json
```

It is **ENGINE-side**, which is the whole point: the Safeguard pass enumerated *the authority's
handlers* and could not see a SELECTOR, because `Battle#getRandomTarget` is a plain method with no
`on…` name to walk for. This asks of THIS file: *where does a line pick one half of the field, and is
that a SIDE question or a TARGET question?*

**Measured on the post-fix tree: 102 sites, 21 declared (7 SIDE, 13 TARGET, 1 READER), 81
UNDECLARED.** The ratchet is on the undeclared count — it may fall and may never rise, the same shape
as the direct-call ratchet in `tests/test-mechanics.js`. It does **not** claim the 81 are fine; it
claims a new side selection cannot enter this file with nobody saying what it answers.

### 5.1 WOULD IT CATCH A SIXTH SPELLED DIFFERENTLY? YES — AND HERE IS THE PROOF, NOT THE CLAIM

It matches a ternary whose branches are a matched `<name>A`/`<name>B` pair, either order, receiver
optional. **It found three spellings the brief's own regex misses, and one of them is a live member of
this very defect class:**

| spelling | where | the brief's regex |
|---|---|---|
| `_side==='A'?actB:actA` | Instruct | **missed** — `\bside` does not match after an underscore |
| `it.side==='A'?field.sgB:field.sgA` | the Wide Guard reads | **missed** — dotted receiver |
| **`m._sf===sfA?sfB:sfA`** | **two `sweepField` callers, the Defog defect's siblings** | **missed** — the word `side` never appears |
| `(actA.indexOf(m)>=0?actB:actA)` | the residual pass | **missed** |
| `(sf===S.sfA)?S.actB:S.actA` | `traceSweep`, `activeAllyOf` | **missed** |

The third row is the honest test of this instrument: the Defog site I filed in §7 has **two siblings
spelled with no `side` token at all**, and the census lists them.

### 5.2 WHAT IT WOULD NOT CATCH — SAID THE WAY THE SAFEGUARD PASS SAID ITS OWN

A site that picks a side **without an `A`/`B` ternary**: a named helper that returns the far array and
is then called by name, index arithmetic like `sides[1 - i]`, or a filter written out in full. A gate
built from an instance catches that instance. What this one genuinely adds is not omniscience — it is
that a NEW site of the shape that has burned this project six times cannot arrive silently.

The key is `anchor | expr | digest-of-the-line`, never a line number. **Editing a site invalidates its
declaration**, which is the safety property: a line that now selects something else has to be
re-answered.

---

## 6. THE PROBE — `tests/probe_ally_forced_switch.js`, 6 ARMS, 0 FAILING

Both engines play the identical script under the differential's own `middle` pin. **No expectation is
typed**: Showdown's stream is the answer, and the file asserts only that the two agree on four counted
facts, that the knob parts the red arms, and that the controls do not move under the knob.

The facts are **coarse on purpose** — a drag draws a body out of the bench and the two engines take
that draw from different streams, so `entry` records the SLOT a `|drag|`/`|switch|` line names and
never the species that arrived. What the defect changes is whether a drag happens at all and on which
half of the field, which is exactly what a slot records.

| arm | kind | what it clears | clean | knob |
|---|---|---|---|---|
| `roar-at-ally` | red | the STATUS door: Garchomp Roars its own Toxapex | agree, `drag/p1b` | PART — no drag, `-fail` |
| `roar-at-ally-mirror` | red | the sides exchanged whole | agree, `drag/p2b` | PART |
| `dragontail-at-ally` | red | the DAMAGING door, a separate site | agree, `dmg[p1b] drag/p1b` | PART — **damage stays, drag vanishes** |
| `roar-at-foe` | control | the road every pooled Roar takes | agree | agree |
| `dragontail-at-foe` | control | the road every pooled Dragon Tail takes | agree | agree |
| `no-phaze-protect` | control | no forced switch anywhere | agree | agree |

The knob arm of `dragontail-at-ally` is the diagnosis in one line: `dmg[p1b]` is still there and
`drag/p1b` is gone. That is what a `continue` in a loop looks like from outside.

**THE FIXTURE WAS WRONG TWICE BEFORE THE ENGINE WAS, and the instrument caught both** — the
fifteen-times warning arriving on schedule:

- **The first `dragontail-at-ally` had the partner clicking Protect**, which blocks Dragon Tail
  outright. The arm staged **no damage and no drag on EITHER engine** and agreed while testing
  nothing. The AUTHORITY'S OWN EMPTY `dmg[]` is what said so.
- **The second filler was Recover**, and it imported someone else's defect: on a `self`-target heal
  this engine writes the user into the `|move|` line's target field where the authority writes nothing
  (`recover->p1b` against `recover->none`), **present with the knob ON as well**, so neither this
  batch's doing nor this batch's to fix. Routed out and FILED (§7), the way the sibling probe routed
  out the stall die.

Every species, item, ability and move is checked against `Dex.forFormat('gen9championsvgc2026regmb')`
**and the learnset** before a game is played, and the two moves' target classes are READ at run time —
the file refuses to run if `roar.target` or `dragontail.target` stops being `normal`.

### 6.1 THE CENSUS ROWS, SHOWN RED UNDER THE KNOB WITHOUT REWRITING THE ARTIFACT

Two rows, both `move / forcesSwitch`, staged through `battleInit` + a real `battleTurn`:

```
knob off   Roar ACROSS      garchomp,corviknight | snorlax,milotic       -> LIVE
           Roar at PARTNER  garchomp,whimsicott  | incineroar,milotic
knob on    Roar at PARTNER  garchomp,corviknight | incineroar,milotic    -> MISSING (the partner never left)
knob off   DT  ACROSS       dealt 69, garchomp,corviknight | snorlax,milotic   -> LIVE
           DT  at PARTNER   dealt 30, garchomp,whimsicott  | incineroar,milotic
knob on    DT  at PARTNER   dealt 30, garchomp,corviknight | incineroar,milotic -> MISSING (damage, no drag)
```

**Census 801 → 803 live / 803 probed / 0 missing**, both ratchets held (803 of 803 armed; 802 of 803
spend a real turn, the one direct call unchanged).

---

## 7. FILED, NOT FIXED — AND THEY ARE SEPARATE BATCHES, NOT THIS ONE

The brief said *"if they are separate, land them separately or tell me and I will re-dispatch"*. **These
three are separate.** Each needs its own fixture and its own red arm; folding them in here would make
the result unattributable, which is the standing small-batch rule.

- **THE REDIRECT GATE (site 6, line 23161).** `if(it.a&&it.a.target&&it.a.kind!=='attack')` then
  `_rfoes2.indexOf(it.a.target)>=0` — redirection is not even considered for an ally-aimed status
  move. The authority runs `RedirectTarget` on **any** resolved target, gated only on
  `activePerHalf > 1 && !move.tracksTarget && !isCharging` (`sim/pokemon.ts:829-836`). Fixture: a Follow
  Me opposite an ally-aimed status click. **Not staged here.**
- **THE DELAYED-HIT BOOKING (site 11, line 25530).** `_ffoes.indexOf(_ft)` is `-1` for an ally-aimed
  Future Sight, so `delayedHitNoSlot` fires and the move fails; the authority books it onto the
  target's own side. It is a BOOKING site rather than an address book, so it does not go through
  `sideBoxOf` unchanged. **Not staged here.**
- **DEFOG'S TARGET SIDE (site 20, line 32987) — AND ITS TWO SIBLINGS.** `defog.onHit` reads
  **`target.side`** for the screens-and-hazards loop and `source.side` for the hazards-only loop
  (`data/moves.ts:3463`); this engine hands `sweepField` the mover's far side. Rapid Spin is
  `hazardsFrom: 'self'` and is unaffected. **Two more call sites spell the same assumption
  `m._sf===sfA?sfB:sfA`** (lines 25089 and 25829) — the census lists all three, which is §5.1's proof
  doing its job.

Also filed, found by a control and NOT in the twenty-two:

- **A `self`-TARGET HEAL NAMES THE USER ON ITS `|move|` LINE AND THE AUTHORITY NAMES NOBODY.**
  `recover->p1b` against `recover->none`, on identical bytes with the knob on. Narration; Protect on
  the same board reads `->none` on both engines, so the difference is per action KIND. **Its own
  batch.**

---

## OWED, NOT RUN

- **`tools\lownode.cmd` COULD NOT BE INVOKED FROM THIS SHELL. SAID PLAINLY BECAUSE IT IS A DEVIATION
  FROM A STANDING RULE, AND IT IS THE SECOND SESSION IN A ROW TO HIT IT.** `cmd //c "tools\lownode.cmd …"`
  opens an interactive prompt and drops every argument — reproduced here exactly as
  `docs/_reports/2026-08-29-armor-tail-ally.md` reported it. The 961-game differential was therefore
  run as `Start-Process node … -PassThru -NoNewWindow` with `PriorityClass = 'BelowNormal'`, which is
  what the .cmd sets, waited on by pid. **This is now twice; it is an OPS item and it should be
  routed.**
- **THE FIRST DIFFERENTIAL RUN WAS LAUNCHED WITH `--out` AND WITHOUT `--write`, SO IT PRINTED THE
  NUMBERS AND WROTE NO ARTIFACT.** `--out` only redirects the path; `WRITE` is what opens the file. The
  run was repeated with both, on the same release and the same pins, and the two agree on every figure
  in §1's table. Said rather than hidden: the first run's numbers were read off stdout.
- **THE KNOB RUN OF `test-mechanics.js` OVERWROTE THE CENSUS ARTIFACT, AND IT IS NAMED RATHER THAN
  QUIETLY REPAIRED.** `--no-write` is not a flag: the census body is written by a red run BY DESIGN
  (`write_policy: FINDINGS for the rows, MONOTONE for the floors`), so demonstrating the two new rows
  MISSING under the knob left `data/mechanics-census.json` reading `801 live / 803 probed / 2 missing`
  — and `status.js` printed exactly that before it was caught. Re-run clean; the artifact now reads
  **803 / 803 / 0** and the stamp is 2026-08-29 13:05. Anyone demonstrating a knob-red census row must
  re-run without the knob afterwards.
- **THE THREE ROSTER STAGES AND `all_mechanics_fire.js` ARE STALE**, now against `070890fc77a2`.
  Carried forward from five previous passes, not created here — `status.js` withholds them by name.

  ```bash
  SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage items      --write
  SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage abilities  --write
  SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage moves      --write
  SHOWDOWN_PATH=... tools\lownode.cmd engine\all_mechanics_fire.js --write
  ```

- **`data/game-differential.json` — THE COVERAGE ARM — WAS NOT RE-RUN.** Expected unchanged:
  **961 games / 6 raw / 6 declared / 0 that count.**
- **`tests/test-engine-diff.js` WAS NOT RUN, deliberately**: it has no `--out` and would republish
  `data/engine-diff.json`, the artifact the published `0 of 6,000` is read from. Nothing in this pass
  touches a damage path — the change decides WHICH side a resolved body stands on, above every damage
  step, and the two foe-axis control arms are line-identical.
- **`data/side-selection-census.json`'s 81 UNDECLARED ROWS ARE UNDECLARED, NOT CLEARED.** The brief
  asked for the twenty-two and got the twenty-two. The other 81 are what the ratchet protects and what
  a future pass classifies.

### THE REGRESSION SWEEP, GREEN

`probe_ally_forced_switch` (6/6), `test-mechanics` (803/803/0, both ratchets held),
`probe_default_target_side` (12/12), `probe_instruct_target` (14/0), `probe_instruct_shield` (13/0),
`probe_shield_refusal_line` (13/0), `probe_random_target_address`, `probe_encore_bracket` (11/11),
`probe_drag_body`, `probe_drag_exposure` (4 drags paired, 0 different bodies),
`probe_phaze_empty_bench` (0 board clauses failing), `probe_pivot_redirect`, `probe_ally_wide_guard`,
`probe_ally_safeguard`, `probe_ally_lightning_rod`, `probe_turn_order` (12 staged, 0 not matching),
`test-engine-consistency`, `test-rollout-effects` (38/0), `test-protocol-trace`, `test-wiring`,
`test-immunity-gate`.

**No previously-carried red was inherited and none was created.** The five the Armor Tail pass listed
as red are all green on this tree.

### THE TURN CAP IS 12

Unchanged from every previous arm, and stated so the 90 is read as what it is: a divergence that would
first appear after turn 12 reads as narration here.
