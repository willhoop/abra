# Mechanics by reach, pass three — 2026-08-24 (ENGINE, overnight)

Five diverging mechanics closed, ranked by the corpus usage they cover. Every one was written as a
failing census probe first, with a control that was already green and stayed green, and every one is
confirmed gone from `data/all-mechanics-fire.json` by a re-run against a release cut from this tree.

**Uncleared diverging mechanics: 15 → 10.** Same script both times —
`engine/quarantine.js --reach` over `engine/all_mechanics_fire.js --kind all`. Before is the artifact
published at HEAD (release `ffdec64bed0c`, generated 2026-08-25T01:05Z); after is release
`294a529b83c8`, arm `bottom-tie-first`, written this pass. **The five removed are exactly the five
below, and nothing was added.** The five carry **1,559 corpus clicks** between them
(scaleshot 543, dragondarts 452, chillyreception 236, dragoncheer 216, ficklebeam 112).

**Census: 687 → 693 probed, 693 live, 0 missing, 0 threw.** Six new probes (Chilly Reception needed
two — its `-prepare` and the `[from]` on the entry line it exposed), all armed, all spending a real
turn.

**All three populations were present in the artifact before any count was taken** — moves 500,
abilities 316, items 148 — checked rather than assumed, because `--kind` defaults to `moves` and a
move-only artifact makes the clause blind rather than red.

---

## Which scoreboard each one should have moved, said before the run

Per CLAUDE.md's ranking rule. **All five are narration**, and that was expected rather than discovered:
four of them add or remove a LINE and touch no state, and the fifth (Dragon Darts) writes a line for a
refusal whose board this engine already had right. So the LAB (census + `all_mechanics_fire`) was
expected to move and the PINNED POOL to sit still.

It did exactly that. Whole game, arm **`middle`**, release **`294a529b83c8`**,
`--team-store data/team-pool-frozen`, census pinned to `census-pin-9446a684709d.json`, `--games 1200`
→ **961 pairs**:

| | before (HEAD, release `ffdec64bed0c`) | after (`294a529b83c8`) |
|---|---|---|
| raw parted | 35 | **35** |
| undeclared (the clause) | 22 of 961 = 2.3% | **22 of 961 = 2.3%** |
| end-state SAME | — | 949 of 961, DIFFERENT 12 |

**Unmoved. This is a re-baseline, not a delta** — the standing baseline is stamped under a different
pin (`top-tie-first`), so `quarantine.js` withholds a direction of travel and is right to.

**Dragon Darts is the one that could have been board-material and is measured as not.** A Dragon Darts
into a Protecting body already redirected both darts onto the other foe here (HP lost `[98, 0]`, the
authority's numbers), and the probe asserts that board on both arms of its own knob as the thing that
must not move.

---

## 1. `selfBoost` is not `self`, and the faint is between them — Scale Shot 543 clicks, and Berserk with it

`[ordering] showdown |-hitcount|p2a: Feraligatr|2 <> medicham |-unboost|p1a: Arbok|def|1`.

**Two artifact rows, one fact.** The Berserk row's fixture stages **Scale Shot** as the receiver's
move (`trigger_staged.receiver: ["scaleshot"]`), so `ability:berserk` was reporting the same defect
under another name.

**`data/engine-data.js` folds THREE dex fields into one `mv.self` key** and the authority pays two of
them in different places:

```
self       selfDrops, called from spreadMoveHit          sim/battle-actions.ts:936
           -> INSIDE the hit loop, above faintMessages (:976) and above |-hitcount| (:978)
selfBoost  if (move.selfBoost && moveResult)
               this.moveHit(pokemon, pokemon, move, move.selfBoost, false, true);      :520
           -> AFTER trySpreadMoveHit has returned, so below the faint, below the hitcount
              and below the recoil — and still above AfterMoveSecondarySelf (Life Orb) at :540
```

**Measured in the authority, one staged doubles turn each, target pinned to 1 HP:**

```
Close Combat KO      -damage 0 fnt, -unboost def, -unboost spd, |faint|
Clanging Scales KO   -damage 0 fnt, |faint|, -unboost def
Scale Shot KO        -damage 0 fnt, |faint|, -hitcount, -unboost def, -boost spe
```

The same drop on the same slot, on opposite sides of the faint, decided only by which dex field
carried it. **The control is the authority's own other answer** — Close Combat — so an engine that
simply moved every self stat change below the faint fails.

**`via` is derived, not named.** `engine/tag_dex.js` now emits `via: 'self' | 'selfBoost' | 'boosts'`
on both `boostsUser` and `lowersUser`, off the dex field itself. **Printed before it was wired:**
`self` 10 moves, `selfBoost` **2** (Clanging Scales, Scale Shot), `boosts` 22. An unknown `via` on a
move that has a `mv.self` table increments `MEDFAILS.selfBoostViaUnknown` rather than falling through
to the old position.

Knob `MEDI_SELFBOOST_IN_LOOP=1`. Probe: `move/lowersUser — Scale Shot and Clanging Scales pay their
own stats AFTER the faint — and Close Combat pays before it`.

**Berserk did not clear.** It moved to a *different* line of the same turn:
`|-hitcount|p1a: Drampa|2 <> |-boost|p1a: Drampa|spa|1`. Berserk hangs off `AfterMoveSecondary`,
which the authority runs at battle-actions.ts:1005 — **below** `-hitcount`. That is a separate defect
of where this engine runs the `AfterMoveSecondary` family, it is scoped and not started, and it is on
the hand list.

## 2. The shield gate read a FEATURE-scoped tag — Dragon Cheer 216 clicks

`[unrelated event mismatch] showdown |-start|p1b: Venusaur|move: Dragon Cheer <> medicham
|-activate|p1b: Venusaur|move: Protect`. The move landed in the authority and this engine refused it.

**The authority is one clause** (`sim/battle.ts:1300-1303`, `checkMoveBypassesProtect`):

```
if ((move.category !== 'Status' || blockStatus) && move.flags['protect'] && ...) return false;
return true;
```

No `flags.protect`, no refusal, whoever the move is aimed at. Dragon Cheer's flags are
`{bypasssub, allyanim, metronome, sound}`.

**What `shieldRefuses` read instead was `ignoresProtect`, which `tag_dex.js` narrows on purpose:**
`if (m.category === 'Status' && !hitsFoe) return null`. In singles that scope costs nothing. **In
doubles it deletes the case that matters** — the body Protecting is very often YOUR OWN PARTNER, and
Dragon Cheer, Coaching, Helping Hand and Aromatic Mist are all aimed there.

**A NEW tag rather than a widening, deliberately.** `ignoresProtect` is read by a board feature;
widening it from 14 members to 111 changes what that feature MEANS, which is a refit and not an engine
fix. `noProtectFlag` carries the unscoped fact. **Membership printed before it was wired:** 111 legal
moves, **containing all 14** `ignoresProtect` members, so nothing already exempt moved; the 97 extra
are the self-buffs, the field/side moves and the ally-facing family, and the first two never meet a
foe's shield at all. The DAMAGING path's `_thruProtect` was switched to the same tag as well — the two
give the identical answer for every damaging move (the narrowing clause cannot fire on one), so no
board changed, and it was switched anyway because a fact with two readers is how the two come to
disagree later.

Control: String Shot, which DOES carry the flag, into TWO Protecting foes — both refusals still owed.
Knob `MEDI_SHIELD_SCOPED_FLAG=1`. Probe: `move/noProtectFlag — a Protecting PARTNER does not refuse
Dragon Cheer — and String Shot is still refused by both foes`.

## 3. A smart-target move is refused in SILENCE — Dragon Darts 452 clicks, the largest row in the artifact

`[extra event emitted by medicham2] showdown |-crit|p2a: Feraligatr <> medicham
|-activate|p2b: Charizard|move: Protect`.

**The authority says it four times, identically** — Protect, Spiky Shield, Baneful Bunker and King's
Shield each open `condition.onTryHit` (`data/moves.ts`; no Champions override on any of them):

```
if (this.checkMoveBypassesProtect(move, source, target)) return;
if (move.smartTarget) { move.smartTarget = false; }
else { this.add('-activate', target, 'move: Protect'); }
```

The shield still REFUSES the dart; it just says nothing about it. **Only the line is silenced** — the
`return this.NOT_FAIL` and the contact punish are below the branch in all four conditions.

**One move in the format carries `smartTarget`** and it is Dragon Darts, read off the dex field.

**Measured in the authority, and the board was already right here:**

```
p2b Protecting:  |-damage|p2a 126/160  |-anim|  |-damage|p2a 87/160     (no -activate anywhere)
this engine:     both darts on p2a, HP lost [98, 0]
```

Control: Shadow Ball from the same Dragapult into the same Protecting Charizard — the refusal must
still be announced. Knob `MEDI_SMART_PROTECT_LINE=1`. Probe: `move/smartTarget — a Protect refuses a
dart WITHOUT announcing it — and still announces an ordinary move`.

## 4. Chilly Reception's two missing lines — 236 clicks, and the second was found by fixing the first

`[event missing from medicham2] showdown |-prepare|p1a: Slowking|Chilly Reception|[premajor] <>
medicham |move|p1a: Slowking|chillyreception`.

**a) The `-prepare`, and it lives in the CONDITION** (`data/moves.ts chillyreception`, no Champions
override):

```
priorityChargeCallback(source) { source.addVolatile('chillyreception'); }        // turn start
condition: { onBeforeMovePriority: 100,
             onBeforeMove(source, target, move) {
               if (move.id !== 'chillyreception') return;
               this.add('-prepare', source, 'Chilly Reception', '[premajor]'); } }
```

so the line lands ABOVE the `|move|` line. `volatileAnnounce` read only `onStart` and this condition
has none, so its artifact row said `event: null, why: "the condition declares no onStart"` — **a
derivation gap, not a missing handler; a consumer learned that the move announces nothing.**

`beforeOwnMove` is derived from the handler's SHAPE — a guard on its own move id followed by one
`add()`. **Printed over every condition a legal move can apply before it was wired: NINE carry an
`onBeforeMove` and exactly ONE matches.** The other eight all do something else and a looser rule
would have swept five REFUSALS into an announcement table: Attract announces unconditionally and then
rolls, Taunt / Disable / Gravity / Throat Chop / Recharge write a `|cant|` and refuse the move,
Confusion counts down, Destiny Bond removes itself.

Control: Solar Beam's wind-up — three fields, no `[premajor]`, and BELOW the move line, because
`onTryMove` runs after it. Knob `MEDI_NO_BEFOREMOVE_LINE=1`. Probe: `move/volatileAnnounce`.

**b) The entry line then parted, one line later.** The authority writes
`|switch|p1a: Ditto|Ditto, L50|123/123|[from] Chilly Reception` and this engine wrote the bare
`|switch|`. One line covers every door (`sim/battle-actions.ts:145-148`):

```
if (sourceEffect) this.battle.add(isDrag ? 'drag' : 'switch', pokemon, getFullDetails,
                                  `[from] ${sourceEffect}`);
else              this.battle.add(isDrag ? 'drag' : 'switch', pokemon, getFullDetails);
```

A pivot sets `source.switchFlag = move.id` (:1311) and the queued switch action carries it.
**Confirmed in the authority on four families**: Chilly Reception, U-turn, Parting Shot, Baton Pass.

**The control is a voluntary switch, which has NO source effect and must stay bare** — that is the arm
that stops this being passed by an engine that appends `[from]` to every entry, and it is the
commonest entry in the game, so getting it wrong would be worse than the defect. One helper
(`pivotFrom`) wraps the three call sites rather than adding a parameter every caller has to remember.
Knob `MEDI_SWITCH_CAUSE_BLIND=1`. Probe: `move/pivotStatus`.

## 5. Fickle Beam announces the roll that doubled it — 112 clicks

`[event missing from medicham2] showdown |-activate|p1a: Hydrapple|move: Fickle Beam <> medicham
|-crit|p2a`. The engine **took** the double — the board agreed — and said nothing.

**The double and the line are ONE handler** (`data/moves.ts ficklebeam.onBasePower`, no Champions
override):

```
if (this.randomChance(3, 10)) {
  this.attrLastMove('[anim] Fickle Beam All Out');
  this.add('-activate', pokemon, 'move: Fickle Beam');
  return this.chainModify(2);
}
```

The subject is the USER's slot (`pokemon` is the handler's second argument) and the line sits between
the `|move|` line and the first `|-damage|` — read off six staged authority seeds, not assumed. The
engine already draws the die at the right address (`rollConditionalPower`, WIRE 147), so only the
announcement was missing.

**The `[anim]` half is deliberately NOT emitted, and that is recorded rather than left as a gap:**
`engine/game_differential.js:1627` strips `[anim]` from BOTH streams before comparing, so no
instrument in this repo can see it either way.

**The control is the same click on a losing roll** — silent, and roughly half the damage. The two arms
draw a different damage roll too (one rng feeds both sites), so the bar is a RATIO above 1.5, wider
than the 1.176 the 0.85..1.00 band can produce on its own. Knob `MEDI_NO_CONDPOWER_LINE=1`. Probe:
`move/conditionalPower`.

---

## Nothing here was the instrument

All five are engine defects against a derivation from `/data/mods/champions/` (or, where Champions
does not override, `/data/`), each cited to a file and line above. The one thing that *looked* like an
instrument question — whether the `[anim]` field would part the streams — was checked in
`game_differential.js` and is stripped from both sides, which is why the `-activate` was the reported
divergence and not the `|move|` line above it.

## THE NEW CODE IS NOT DEAD

Six new counters, all measured on the staged boards above:

```
selfBoostPaidAfterLoop        2      selfBoostViaUnknown             0
shieldSawNoProtectFlag        1      volatileBeforeMoveUnknownEvent  0
smartTargetShieldSilent       1      selfBoostInLoopRestored         0
volatileAnnouncedBeforeMove   1      shieldScopedFlagRestored        0
switchNamedItsCause           2      smartProtectLineRestored        0
conditionalPowerAnnounced     1      beforeMoveLineSuppressed        0
                                     switchCauseBlindRestored        0
                                     condPowerLineSuppressed         0
```

A POOL-SCALE counter sweep was NOT run — no existing script exports engine counters from
`game_differential.js` and this pass did not add one. Named in OWED below.

## THE NUMBERS

- **Damage differential 0 of 6000 at all 16 corners**, seed 20260804. Unmoved.
- **Census 687 → 693 probed / 693 live / 0 missing / 0 threw.**
- **Uncleared diverging mechanics 15 → 10.**
- **Whole game, arm `middle`, release `294a529b83c8`, `--games 1200` → 961 pairs, pinned team store
  and pinned census: raw parted 35, undeclared 22 of 961 = 2.3%. Unmoved. Re-baseline, not a delta.**
- **All four withheld artifacts re-run at `294a529b83c8`:** roster items **0 FIRED-AND-BOARDS-DIFFER /
  0 DID-NOT-FIRE** (139 of 148 tested), abilities **0 / 0** (130 of 202), moves **0 / 0** (475 of 500),
  and `all_mechanics_fire --kind all` written against the same release.
- **Gate: 5 of 8 clauses pass, exactly as before.** Nothing regressed.

## Instruments run individually, all green

`test-protocol-trace`, `test-resolution-order`, `test-encore-fail-silent`, `test-game-diff`,
`test-immunity-gate`, `test-tag-params-derived`, `test-volatile-duration`, `test-mc-seal`,
`test-bracket-regain`, `test-engine-consistency`, `test-wiring`.

`data/abra-tags.js` — the BROWSER copy of `tags.json`, frozen in every release — was **two days
stale** and is rebuilt from `build/build_tags_js.js` in this pass. That was found by the release cut,
not by a gate.

## PROPOSED REGISTER ROWS — `docs/ROADMAP.md` was NOT edited, per the brief

**CLOSE (5).** Each is carried by a census probe named above and confirmed gone from
`data/all-mechanics-fire.json` at release `294a529b83c8`:

1. *Scale Shot / Clanging Scales pay `selfBoost` at `selfDrops`' position.* CLOSED — `via` derived in
   `tag_dex.js`, paid below the hit loop. VERIFIED BY `tests/test-mechanics.js`
   (`move/lowersUser`), knob `MEDI_SELFBOOST_IN_LOOP`.
2. *A Protecting partner refuses an ally-facing move with no `flags.protect`.* CLOSED — `noProtectFlag`
   derived, `shieldRefuses` and `_thruProtect` both read it. VERIFIED BY `move/noProtectFlag`.
3. *Dragon Darts announces a shield refusal the authority silences.* CLOSED. VERIFIED BY
   `move/smartTarget`.
4. *Chilly Reception writes no `-prepare`, and no pivot entry names its cause.* CLOSED — two probes,
   `move/volatileAnnounce` and `move/pivotStatus`.
5. *Fickle Beam's double is silent.* CLOSED. VERIFIED BY `move/conditionalPower`.

**OPEN (2), both scoped by this pass and not started:**

6. *`AfterMoveSecondary` runs above `|-hitcount|` and the authority runs it below.* Berserk (56 sheets)
   is the visible member: `|-hitcount|p1a: Drampa|2 <> |-boost|p1a: Drampa|spa|1`.
   `afterMoveSecondaryEvent` is called at `sim/battle-actions.ts:1005`, below the hitcount at `:978`
   and below the recoil. VERIFIED BY `engine/all_mechanics_fire.js` (`ability:berserk`).
7. *`data/abra-tags.js` can go stale against `data/tags.json` and no gate says so.* Found this pass by
   a release cut; it was two days behind. `engine/artifact_audit.js` is the natural home. NOT a claim
   about the game.

## OWED, NOT RUN

- **`tests/run-all.js` in full.** Eleven ENGINE instruments were run individually and are listed above;
  the whole suite was not.
- **A pool-scale counter sweep.** No script exports engine counters from a `game_differential.js` run,
  and this pass did not add one. The six new counters are proved on staged boards only.
- **`engine/selftest.js`, `engine/conformance.js`, `engine/feature_fixture.js --check`** — all three
  were RED at HEAD and were not run here. The feature-fixture one is the REFIT question and belongs to
  MEASURE; a restamp silences the table gate and writes over the evidence.
- **`tests/interaction_matrix.js`** (last run 2026-08-11) and **`tests/mutation_harness.js`**.
- **`shellsidearm` (101 clicks) and `sandforce` (34 sheets)** — the two remaining in-game DAMAGE rows,
  both `off-by-4-or-more` on one `-damage` line. Not examined this pass. `sandforce` already has a
  scoped diagnosis on the previous pass's hand list (a truncated `damageBoost.onType` in `tags.json`
  AND no consumer for `type + weather` at `stage:'basePower'`).
- **`switcheroo` (85), `smackdown` (59), `supremeoverlord` (112 sheets), `stringshot` (46),
  `teeterdance` (33), `cottonspore` (31), `attract` (30)** — the rest of the counted list. Two of them
  are diagnosed and not fixed:
  - **the three spread-status rows are ONE mechanism.** `hitStepTryHitEvent` runs across ALL targets
    before any effect is applied (`sim/battle-actions.ts:600-611` — the step list is step-major), and
    the engine's `kind === 'affect'` branch is target-major, so a Protect on the second foe is
    announced AFTER the first foe's stat drop. Confirmed in the authority on all three. Fixing it
    properly is a restructure of that branch into a step list, the way WIRE 10 did the damaging path —
    a two-pass version would get the common case right and the mixed-refusal case wrong.
  - **`supremeoverlord` is the `fallenundefined` line the whole-game clause already DECLARES as "the
    authority is wrong"** (`data/abilities.ts` guards `onStart` on `side.totalFainted` and does not
    guard `onEnd`). The mechanics clause has no such declaration and counts it. That is a
    clause-consistency question, not an engine one.
- **`engine/replay_one.js`** was not used at all this pass; every divergence above was read from the
  artifact and then RE-STAGED in the official simulator by hand, which is the stronger route.
