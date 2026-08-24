# The faint restructure: fourteen classes derived, two converted, and three of the four faint-ordered divergences are a different mechanism

**ENGINE, 2026-08-23.** Historical record, per `docs/_reports/` convention. Not current state;
superseded by the register rows it feeds. Every figure is read out of a run whose command is printed
beside it, or cited to a line in the pinned Showdown checkout
(`20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`).

---

## 0. VERDICT

**Fourteen classes derived from the call sites. TWO converted. Stopped there, on purpose.**

Whole-game differential, arm `middle`, 961 games, `--team-store data/team-pool-frozen`,
`--census data/verification/census-pin-9446a684709d.json`, `--end-state`, three releases:

| quantity | baseline `3e00ea2575a9` | stage 1 `e507bcce0248` | stage 2 `3929459bb195` |
|---|---|---|---|
| **undeclared (`diverged − declared`), the gate's headline** | 53 of 961 = 5.5% | — | **52 of 961 = 5.4%** |
| protocol parted (raw), arm `middle` | 58 | **57** | **57 — unmoved** |
| board-material games | 24 | **24 — did not move** | **24 — did not move** |
| narration-only games | 34 | **33 — fell by one** | **33 — did not rise** |
| DIFFERENT-END-STATE | 18 | **17** | **17** |
| census probed / live / missing | 658 / 658 / 0 | 659 / 659 / 0 | **660 / 660 / 0** |

**The one divergence stage 1 removed is exactly the one it was aimed at** — the whole
first-divergence cause table is identical either side except for
`ordering :: |-damage|p2a|H/H|[from]sandstorm <> |faint|p1a`, which goes 1 → 0. Nothing else
appeared. That is the attribution the brief asked for and it is the only reason a one-game move is
worth reporting.

**The finding that matters more than the number.** The pinned pool carries four first-divergences
whose medicham line is a `|faint|`. Only ONE of them is a faint-timing defect. The other three are
the SAME missing mechanism wearing a `|faint|` costume: the authority runs `eachEvent('Update')` at
`sim/battle-actions.ts:967`, INSIDE the hit loop and one statement above `faintMessages()` at :976,
and this engine has no update pass there at all. So the Sitrus, the Fling `-enditem` and the Stone
Axe hazard are all owed ABOVE a faint line this engine writes at the right moment. Moving the faint
would not fix them; it would move the mismatch. See §4.

---

## 1. THE TWO COUNTS IN THE BRIEF, VERIFIED

Both were relayed and both hold.

**`faintMessages()` is called at EIGHT places**, `grep -rn "faintMessages(" sim/ data/mods/champions/`:

```
sim/battle-actions.ts:336    inside the Dancer loop
sim/battle-actions.ts:347    the tail of runMove
sim/battle-actions.ts:976    the tail of hitStepMoveHitLoop   (+ data/mods/champions/scripts.ts:547)
sim/battle.ts:565            fieldEvent — AFTER EVERY HANDLER
sim/battle.ts:1554           lose()
sim/battle.ts:2180           the instafaint arm of spreadDamage
sim/battle.ts:2832           the tail of runAction
sim/battle.ts:2897           after BeforeSwitchOut
```
(`sim/battle.ts:2532` is the definition, not a call. The Champions mod overrides one of the eight
and adds none.)

**`Pokemon#faint()` only queues**, `sim/pokemon.ts:1587-1598`, and its own doc comment says so:
*"This function only puts the pokemon in the faint queue; actually setting of this.fainted comes
later when the faint queue is resolved."* It sets `hp = 0`, `switchFlag = false`,
`faintQueued = true` and pushes `{target, source, effect}`.

**This engine announces at 27 `TR.faint(` sites.** Verified with
`grep -c "TR\.faint(" engine/medicham2-browser.js` = 27 before the change, and 27 after (two inline
sites removed, two added inside `queueFaint`/`drainFaints`). **25 are real inline announce sites now.**

---

## 2. THE FOURTEEN CLASSES, DERIVED FROM THE TRIGGER

Not invented. Each site was walked back to what puts the HP on zero, and each trigger was matched to
the `faintMessages()` call the authority reaches next. Line numbers are post-change.

| # | class | sites | the authority's drain | status |
|---|---|---|---|---|
| 1 | move damage on a TARGET | 24048 (`_stepFaint`) | battle-actions:976 | **already at its boundary** |
| 2 | self-KO above or at the hit (`selfdestruct`, Final Gambit) | 21702, 24046, 25056 | :976 / the shield exit | **already queued** — ROADMAP #331's `_selfKOPending` |
| 3 | an `onDamagingHit` punish kills the ATTACKER | (was 22976) | :976, below the target | **CONVERTED — stage 2** |
| 4 | a SHIELD's contact punish kills the attacker | 21676 | :976 | **already correct** — verified in the authority, §3 |
| 5 | in-move self cost paid BELOW the hit loop — recoil x2, Life Orb, crash-on-miss | 21554, 24617, 24670, 24854 | battle-actions:347 | **not converted, declared** — §6 |
| 6 | in-move self cost paid INSIDE the hit — Substitute x3, Curse's Ghost toll | 17880, 18882, 20028, 20076 | :976 | not converted |
| 7 | `userFaints` descriptors — Memento / `ifHit` / Healing Wish | 18317, 20573, 25051 | :976 | not converted |
| 8 | Pain Split, both bodies | 18447, 18448 | :976 | not converted |
| 9 | fixed-fraction damage in the `affect` branch (Super Fang) | 19549 | :976 | not converted |
| 10 | hazards on ENTRY (`bringIn`) | 14324 | battle.ts:565, per handler | **already correct** |
| 11 | confusion self-hit before the move | 12819 | :347 / :2832 | not converted |
| 12 | residual groups whose handler is PER BODY — status chip, trap, the delayed hit, the group close | 25653, 25919, 26117 | :565, after each handler | **already correct** — proven by the burn control, §3 |
| 13 | the residual WEATHER group — the sand chip's close and the `onWeather` ability chip | (was 25435, 25968) | :565, after the ONE field handler | **CONVERTED — stage 1** |
| 14 | Perish Song | 26231 | :565 | **already correct** |

**Six classes were already at their boundary before this pass** and are recorded as such rather than
touched. That is most of the 27 and it is why "27 inline sites against 8 boundaries" overstated the
work: the sites are inline, but the code they sit in is usually already standing at one of the eight.

---

## 3. THE AUTHORITY WAS ASKED, NOT RECALLED

Every expectation below was OBSERVED by staging the board in the official simulator
(`new Battle({formatid: gen9championsvgc2026regmb, seed:[1,2,3,4]})`, HP set directly, `default`
choices) and printing `battle.log`. Nothing here is typed from a source read alone.

**Stage 1 — the weather group is ONE handler over every body.** Gengar on 1 HP in a Tyranitar's
sand, doubles, everything else Protecting:

```
|-weather|Sandstorm|[upkeep]
|-damage|p2b: Alakazam|122/130|[from] Sandstorm
|-damage|p2a: Gengar|0 fnt|[from] Sandstorm
|-damage|p1b: Milotic|160/170|[from] Sandstorm     <- the OTHER SIDE, still above the corpse's line
|faint|p2a: Gengar
|upkeep
```

**Stage 1's over-fire control — a burn is a handler PER body.** The same board burned instead, with
the FASTEST body (Alakazam, 120) on 1 HP so that it is chipped first:

```
|-damage|p2b: Alakazam|0 fnt|[from] brn
|faint|p2b: Alakazam
|-damage|p2a: Gengar|127/135 brn|[from] brn
```

The mechanism behind the asymmetry, read out of the source: `sandstorm.onFieldResidual`
(`data/conditions.ts:655-659`) is `add('-weather'); if (isWeather('sandstorm')) eachEvent('Weather')`,
and `eachEvent` (`sim/battle.ts:465-476`) walks every active body with **no** `faintMessages` between
them; `fieldEvent` drains once the handler returns. `brn.onResidual(pokemon)` is registered per body,
so `fieldEvent` drains between them.

**Stage 2 — a lethal punish is drained with the target, and the target is first.** Weavile on 1 HP
clicks Fake Out into a Rough Skin Garchomp on 1 HP:

```
|-damage|p2a: Garchomp|0 fnt
|-damage|p1a: Weavile|0 fnt|[from] ability: Rough Skin|[of] p2a: Garchomp
|faint|p2a: Garchomp
|faint|p1a: Weavile
```

**Stage 2's over-fire control — the SHIELD's punish, which was already right.** The same Weavile into
a Spiky Shield Chesnaught:

```
|-activate|p2a: Chesnaught|move: Protect
|-damage|p1a: Weavile|0 fnt|[from] Spiky Shield|[of] p2a: Chesnaught
|faint|p1a: Weavile
```

One faint, immediately below its damage, because the shield refused the whole move and nothing else
is in the queue. An engine that deferred every faint to some later boundary satisfies the Rough Skin
arm and breaks this one, which is why both are asserted.

---

## 4. THE TRAP THE BRIEF NAMED, AND IT WAS REAL

The brief warned that the board comparison checks the END state, so the differential can go green
while turn-by-turn behaviour is wrong, and asked for a board where the timing is observable directly.

**It could be staged, twice, and both probes were shown RED first.**

- `tests/test-mechanics.js`, `condition`/`weatherResidualFaintQueue`. RED read
  `["|-damage|…alakazam|0fnt|…sandstorm","|faint|…alakazam","|-damage|…gengar|…","|-damage|…milotic|…","|-damage|…clefable|…"]`
  — the faint after 1 of 4 chips. GREEN reads the faint after 4 of 4. The burn arm read
  `faint after 1` on both, which is the control holding.
- `tests/test-mechanics.js`, `ability`/`punishesAttacker`,
  *"a punish that kills the attacker is announced BELOW the target it just killed"*. RED read
  `["|faint|p1a:weavile","|faint|p2a:garchomp"]` — the queue in reverse. GREEN reads
  `["|faint|p2a:garchomp","|faint|p1a:weavile"]`. The Spiky Shield arm read `["|faint|p1a:weavile"]`
  on both.

Neither is a board question and neither pretends to be. Both read the protocol stream out of
`battleInit({trace})` and assert a POSITION, which is the only thing a timing defect can be seen as.

**The knob is wired and it was proved by moving output, not by existing.** 40 staged sand kills,
clean: `faintLineQueued 40, faintDrains 40, faintDrainWeatherGroup 40, faintLineInline 0,
MEDFAILS.faintQueueLeaked 0`. The same board under `MEDI_FAINT_INLINE=1` reproduces the pre-change
stream exactly and stamps `MEDFAILS.faintInlineRestored = 1` with `faintLineQueued 0`.

---

## 5. WHAT EACH STAGE MOVED

**Stage 1 — the weather group.** Release `e507bcce0248`.

```
diverged 58 -> 57
the ONLY row that moved in the first-divergence cause table:
  1 -> 0   ordering :: |-damage|p2a|H/H|[from]sandstorm <> |faint|p1a
BOARD-MATERIAL  23 causes / 24 games  ->  23 causes / 24 games   (unmoved, as predicted)
NARRATION-ONLY  30 causes / 34 games  ->  29 causes / 33 games
DIFFERENT-END-STATE  18 -> 17
```

Which scoreboard it should move, said before the run: **narration in the pool, and the lab.** Both
did. Board-material did not, and a rise there would have been the failure signal.

**Stage 2 — the `onDamagingHit` punish.** Release `3929459bb195`.

Which scoreboard it should move, said BEFORE the run: **the lab only.** A punish that kills the
attacker on the same hit that kills its holder is a two-corpses-one-hit board; the pinned pool was
expected to sit still. It did:

```
diverged 57 -> 57
NO CHANGE in the first-divergence cause table — not one row
BOARD-MATERIAL  23 causes / 24 games   (unmoved)
NARRATION-ONLY  29 causes / 33 games   (unmoved)
DIFFERENT-END-STATE  17 -> 17
```

The two run logs are identical line for line apart from the release id and the wall clock, and the
team-pool digest in every game row is `0d103fb9fa87` on both — so this is the same 961 games and not
a resampling that happened to land on the same total. The lab did move: the probe went RED → GREEN
and the census went 659 → 660.

**"The pool did not move" is one instrument confirming, not zero information** — CLAUDE.md's own
wording. What it rules out here is a REGRESSION, which is the thing a 25-site file with a new shared
helper in it could plausibly have caused.

---

## 6. WHAT WAS NOT CONVERTED, AND WHY IT WOULD NOT HAVE HELPED

**Class 5 (recoil, Life Orb, the High Jump Kick crash) is the tempting one and it is a step-list
problem, not a queue problem.** In the authority `applyRecoilDamage` is at `battle-actions.ts:982` —
BELOW `faintMessages()` at :976 and below `-hitcount` at :978 — and Life Orb's
`onAfterMoveSecondarySelf` is reached from `afterMoveSecondaryEvent` at :1005, lower still. In this
engine both live in `_stepSelfPay`, which is step 3 of 9 and therefore ABOVE `_stepFaint`. So it is
the DAMAGE line that is mis-placed as much as the faint line, and queueing the faint alone moves the
first divergence from one line to another without removing it. The correct fix is to split
`_stepSelfPay` and put the recoil and orb halves below `_stepFaint`; `selfDrops` and the drain must
stay above it. That is a step-list restructure and it is left named rather than half-done.

**The three remaining faint-ordered divergences are the missing in-loop Update pass.** All three read
`SHOWDOWN <something> <> MEDICHAM |faint|`, and in every one the something is emitted by
`eachEvent('Update')` at `battle-actions.ts:967` or by an `onAfterHit` inside `spreadMoveHit`:

```
|-sidestart|p2:|stealthrock  <> |faint|p2a     Stone Axe's hazardOnHit — onAfterHit, above :976
|-enditem|p2b|ironball|[from]fling <> |faint|p1a   fling.condition.onUpdate (data/moves.ts:5773-5779)
|-enditem|p2b|sitrusberry|[eat]    <> |faint|p2a   a partner's Sitrus, onUpdate
```

and the same missing pass explains three MORE of the 58 that carry no faint at all
(`|-enditem|…sitrusberry|[eat] <> |-damage|…[from]recoil` twice and once for `lifeorb`). **That is
six of the 58 on one mechanism**, and it is the largest single item left in this area. It is not a
faint fix and was deliberately not smuggled in behind one.

---

## 7. OWED, NOT RUN

```
node tests/test-mechanics.js                          RUN — 660/660 live, 0 missing, 0 hollow, 0 threw
tests/test-engine-diff.js --n 6000 --seed 20260804    RUN — exit 0, 0 disagreed
node engine/game_differential.js (the pinned run)     RUN — three times: baseline, stage 1, stage 2
node tests/probe_announce_failure.js                  RUN — 8 arms, BOARD + RESULT + NARRATION all ok
                                                            (this is engine/move_result_state.js's consumer)
node tests/test-resolution-order.js                   see §8
node engine/status.js --write                         RUN at the end of this pass
node tests/roster.js --stage {items,abilities,moves}  RUN — on the FINAL release. Every count identical
                                                            to the previous release: 0 FIRED-AND-BOARDS-DIFFER,
                                                            0 DID-NOT-FIRE on all three. Re-run because the
                                                            engine moving had STRANDED all three artifacts and
                                                            status.js was withholding them.
node engine/all_mechanics_fire.js --kind all          RUN — on the FINAL release, moves 20 / abilities 9 /
                                                            items 1, identical
node tests/test-encore-fail-silent.js                 RUN — RED on arrival, FIXED, now PASS (see below)
node tests/test-engine-consistency.js                 RUN — all checks passed
node tests/test-volatile-duration.js                  RUN — 4 scenarios identical
node tests/test-end-state.js                          RUN — ALL GREEN
node tests/test-protocol-trace.js                     RUN — ALL PASSED
node tests/probe_punish_announce.js                   RUN — ALL CLAUSES HELD
node engine/quarantine.js                             NOT RUN — its differential clause was run directly
                                                            at the pins; `undeclared` is not re-derived here
tests/interaction_matrix.js                           NOT RUN
node tests/run-all.js                                 NOT RUN
node engine/replay_one.js                             NOT RUN
```

- **No fit, no self-play, no `mew.js`.** `board.js`, `magnemite.js` and `engine-data.js` untouched.
- **Two untracked files left alone as instructed:** `data/_pair-pilot.json` and
  `data/medicham-represented-clicks.json`.
- **A RED GATE FOUND ON ARRIVAL AND FIXED RATHER THAN FILED.** `tests/test-encore-fail-silent.js`
  exited 1 on `mvFailSilentNoLine want exactly 1, got 0`. It is red on release `3e00ea2575a9` too,
  which predates this session — so it is a stale EXPECTATION, not a defect this pass caused. The
  phaze pass moved the Suction Cups site off `mvFailSilent` because the authority holds
  `moveThisTurnResult === true` there (`engine/medicham2-browser.js:463` states it), and the site now
  writes `mvOkSilentNoLine`; measured at 1 before the WANT was touched. The fix asserts BOTH
  (`mvFailSilentNoLine: 0`, `mvOkSilentNoLine: 1`), so the site stays pinned to fire exactly once.
  All ten of the file's arms read AGREES either side of the change.
- **A pre-existing red in the instrument, reported and NOT fixed here:** the whole-game differential
  prints *"THE STATE COMPARATOR FAILED ITS OWN PROOF"* and writes `planted_state_proof_ok: false`,
  because six of its plants are `NOT APPLIED` (they all want a BENCHED body the fixture does not
  have). This is true of the BASELINE artifact on disk as well — it is not caused by this pass, and
  it means the instrument's own STATE numbers carry a self-declared caveat. It belongs to MEASURE.
