# Fix batch — M6's instrument half, and Defog's target side

Release cut: **`252025cfcddc`** (showdown `20ad99ffc9a5`).
Measurement: `data/verification/fix-batch-M6instr-defog.json`, generated 2026-09-04T20:08:18Z.
Baseline: `data/verification/fix-batch-M6-sidesel.json`, release `7ffc58da8ef8`.

| Quantity | Before | After |
|---|---|---|
| **board-material** (961 games, games whose boards part) | **53** | **46** |
| protocol-diverged games | 154 | 141 |
| VOID (instrument desync) | 7 | 7 |
| `-damage field 3` class | 22 | **9** |
| `[from]confusion` value causes | **13** | **0** |
| mechanics census | 829 / 829 | 829 / 829 |
| side-selection undeclared / ratchet | 80 / 80 | **78 / 78** |

---

## THE SCOREBOARD WAS CALLED BEFORE THE RUN, AND ONE CALL MISSED

Written down before the differential was started:

- board-material **39, range 39–43** — M6's stated size is 14 and this is the half that was
  mismeasuring them; caveat named at the time, *"a game with a second cause stays counted"*.
- `-damage field` class ~14 and **zero** confusion causes.
- protocol **140–148, low confidence**.
- VOID 7 or lower.
- **Defog: exactly zero movement in the pool.**
- census unchanged.

Result: **board-material MISSED (predicted 39, got 46).** Protocol HIT (141, in range). VOID HIT.
Defog HIT. Census HIT. The class prediction HIT on direction and on the zero, and the magnitude was
right for causes rather than games.

**The miss has one cause and it is the caveat I wrote and then under-weighted.** Thirteen
`[from]confusion` value causes went to zero and the `-damage field 3` class fell by exactly 13
games — but board-material fell by only 7, because **6 of those 13 games carry a second board
divergence and stay counted.** Every other class in the table is unchanged to the game
(`event missing` 55, `extra event` 24, `ordering` 24, `unrelated event mismatch` 19, `-status
field 4` 5, and the six singletons), so the six survivors were already in another class rather than
having moved into one.

Running record on called scoreboards: 2-of-3, 4-of-4, a one-off miss on protocol by a single game,
and now **4-of-5 with the miss on the headline number**.

---

## DID M6's FULL 14 CLOSE? — 13 of 14, AND THE 14th IS NOT M6

The 14 were **causes**, not games. Before:

- **13 × `-damage field 3`**, every one `|-damage|pXY|H/H|[from]confusion <> |-damage|pXY|H/H|[from]confusion
  [values differ: ...]` — the two engines naming the same event and disagreeing about the number.
  **All 13 are gone.**
- **1 × `unrelated event mismatch`**, `|-damage|p1b|H/H|[from]confusion <> |move|p1b|makeitrain`.
  **Still present, unchanged.** This is not a confusion-damage disagreement at all: the two streams
  are at different positions, so it is a pairing/ordering defect that happens to have a confusion
  line on one side of it. Fixing the die could not have touched it and did not.

So: **the confusion self-hit's damage value is closed. M6 as a damage defect is finished; one
ordering cause carrying a confusion line survives and belongs to a different family.**

---

## TASK 1 — THE INSTRUMENT HALF

### The authority, read whole

`data/conditions.ts` `confusion.onBeforeMove` (Champions has **no** `confusion` row —
`tests/probe_confusion_selfhit_address.js` §0 greps `/data/mods/champions/conditions.ts` on every run):

```
if (!this.randomChance(33, 100)) return;                        <- draw 1
this.activeTarget = pokemon;                                    <- the repoint (fixed last batch)
const damage = this.actions.getConfusionDamage(pokemon, 40);    <- draw 2
```

`getConfusionDamage` (`sim/battle-actions.ts:1850-1862`) ends `damage = this.battle.randomizer(damage)`,
and `randomizer` (`sim/battle.ts:2388`) is `tr(tr(baseDamage * (100 - this.random(16))) / 100)` — one
`random(16)`, taken **directly**, never through `getDamage`.

### What that cost

`midWrapShowdown` wraps `hitStepAccuracy`, `secondaries` and `getDamage` and nothing else, so this
draw ran with `MIDW.cat` at its default `any`. Two consequences, and the second is the expensive one:

1. the address category was `any` on the authority side, matching ours only because ours was `any` too;
2. **`pinRandom`'s damage-index inversion is gated on `cat === 'dmg'`**, so the authority read the
   draw as `floor(u*16)` — an index where 0 is *maximum* damage — against an engine whose
   `damageRollIndex(u) = 15 - floor(u*16)` runs the other way. One shared die, read backwards on one
   side: **anti-correlated**, which this file's own pin header says is worse than an independent one.

The previous pass filed this here rather than fixing it in the engine, and that was right: both pinned
corner arms answer `random(16)` with `spec.damageIndex` whatever the category says, so flipping the
engine's direction would have parted `bottom-tie-first` on every confusion self-hit.

### The fix, both halves under one knob

- `engine/game_differential.js` — `around('getConfusionDamage', 'dmg', 0, 'confusionDmgEnters')`,
  beside the three existing wraps. There is no two-argument `random` inside that method (read whole),
  so the `dmg`→`crit` relabel cannot fire there. `pokemon` is argument 0, the same signature position
  `getDamage` uses for its source.
- `engine/medicham2-browser.js` — `confusionSelfDamage` draws `_R.dmg` instead of the generic `rng`.
- `MEDI_CONFUSION_DMG_CAT_LEGACY=1` is read by **both files under that one name**, so the restore is
  the original red and not a third behaviour — the policy `MEDI_TGT_ADDR_LEGACY` already sets.

### The corners are untouched, and it is checked rather than claimed

`rngStreams(f)` for a plain function aliases every stream to `f`, so under a corner arm and in every
rollout `_R.dmg === _R.any` and this line is byte-identical to what it was. Only the middle arm and a
seeded split struct can tell the two apart. §4 of the probe asserts both directions:
`rngStreams(()=>0.25).dmg === .any` **and** `rngStreams({seed:7}).dmg !== .any` — the second is there
so the first cannot pass by the streams being aliased everywhere, which would make the whole change
vacuous.

### The probe

`tests/probe_confusion_selfhit_address.js`. §3 used to PRINT the residual and assert nothing, because
it belonged to another file; it is an **assertion** now.

```
clean                            all checks passed
MEDI_CONFUSION_DMG_ADDR_LEGACY=1 FAILED 2 checks  (the address half, unchanged)
MEDI_CONFUSION_DMG_CAT_LEGACY=1  §3 asserts the boards PART, and they do:
    [foe-aimed]  p2.active[0].hp  medicham 204 vs showdown 202
    [self-aimed] p2.active[0].hp  medicham 202 vs showdown 204
```

Those two lines are byte-identical to the pre-fix baseline, which is what says the knob restores the
defect rather than inventing a new one. Anti-vacuity: `confusionSelfHit` delta > 0 on each arm,
`confusionDmgOnDmgStream > 0`, `confusionDmgStreamMissing === 0`, and the **instrument's own**
`midWrapState().confusionDmgEnters > 0` — the last because our side drawing on `dmg` while the
authority still drew `any` would be exactly the half-fix that made the first attempt worse.

The §1 address filter was widened from `|any|` to `|any|` **or** `|dmg|` in the same pass. Left at
`any` it would have gone on passing while comparing nothing about the draw the probe is named for.

### PIN_DIGEST MOVED, AND IT WAS SAID BEFORE THE RUN

`ccb365985023` → `bcb38e47d94f`. Two pin claims joined the list and the authority's confusion draw
changed category. **This before/after therefore spans a changed instrument as well as a changed
engine — two variables, not one.** The 13→0 cause count is robust to that (a cause either names the
same event on both sides and disagrees, or it does not); the exact board-material integer is not
strictly one-variable, and should not be quoted as if it were.

---

## TASK 2 — DEFOG SWEEPS THE TARGET'S SIDE

### The authority

`data/moves.ts` `defog.onHit` (Champions does not override `defog`; §0 greps
`/data/mods/champions/moves.ts` on every run):

```
for (const c of removeTarget) if (TARGET.side.removeSideCondition(c)) ...   // screens + hazards
for (const c of removeAll)    if (SOURCE.side.removeSideCondition(c)) ...   // hazards only
```

`defog.target` is `"normal"` (derived from the format, not typed), and `Battle#validTargetLoc` asks
only **adjacency** for `normal` — so a negative targetLoc naming the partner is a legal choice and
`target.side === source.side`.

### The defect, live at the `affect`-branch `sweepField` call

Every call site handed `sweepField` `m._sf === sfA ? sfB : sfA` — *the side the mover is not on*,
which is neither of the two sides the authority names. On an ally-aimed Defog that is wrong **twice,
in opposite directions**: the screens came off the FOE (leaving the ally's Reflect standing) and the
FOE's hazard bag was emptied (deleting rocks the opponent still had).

**And the source moves too.** Defog is `reflectable`, and Magic Bounce (Hatterene, Espeon, and three
megas — derived) re-uses the move with the **bouncer** as source and the original user as target.
`bounceOff` returns the user, so the target's side is the user's; the source's side is the bouncer's.
The old selector had both halves wrong and they cancelled on hazards, which is why nothing caught it.

### The fix

- `bounceOff` takes an optional `info` and writes `info.bouncedBy` — the one place that knows a bounce
  happened is the one place that reports it, rather than the call site re-deriving the bounce rule
  from the tag.
- `statusMoveTargets` forwards it.
- The `affect`-branch site resolves `tgtSf` from the row that survived the gauntlet and `srcSf` from
  `_bInfo.bouncedBy` when there is one. The old expression survives only as `_far`, the fallback the
  loud counter reports on.
- `sweepField`'s parameters are renamed `srcSf` / `tgtSf`, and the `hazardsFrom: 'both'` bag list is
  de-duplicated by identity — the ally aim legitimately passes the same object for both, and that is
  exactly the case that must not empty the opponent's bag.
- `MEDI_DEFOG_FOE_SIDE_LEGACY=1` restores the old selector at that one site.

### Red-first, three arms

`tests/probe_defog_target_side.js`. Measured **before** any byte moved:

```
[defog-at-a-foe]                 IDENTICAL              (control, green before and after)
[defog-at-the-ally]              p1.screens.physical      medicham 3 vs showdown 0
                                 p1.screens.named.reflect medicham 3 vs showdown null
                                 p2.hazards.stealthrock   medicham 0 vs showdown 1
[defog-bounced-by-magic-bounce]  p1.screens.physical      medicham 2 vs showdown 0
                                 p1.screens.named.reflect medicham 2 vs showdown null
```

All three identical after; both governed arms part again under the knob and the control does not.

**Arm C is the reason the fix is not just "read the target's side".** A target-side-only fix would
have made the screens right and the hazards *wrong* on the bounce road — arm C stages hazards on both
sides specifically so that regression is visible. Hatterene sits on the bench and walks in on turn 2,
because a Magic Bounce body standing on turn 1 bounces the Stealth Rock that sets the fixture up, and
the arm would then be green for want of anything to sweep.

Anti-vacuity per arm: `scriptCounters().moveNotOnRequest === 0` (no click silently became a `pass`),
`allyAimRefused === 0` (the `{ally:true}` aim was not coerced to a foe), and `hazardSwept +
sideConditionSwept > 0`. Discrimination: `defogSweptTargetSide` is 0 on the foe arm and 1 on each
governed arm — it counts only calls where the chosen side *differs* from the far side, so it measures
the selection and not the sweep.

### The pool did not move, and that was called first

Zero. The three hazard/screen-adjacent causes in the class table are byte-identical before and after
and none is a Defog. An ally-aimed Defog is a play nobody makes and `empirical` steering replays real
human clicks, so the lab is the only scoreboard that could move here. Said before the run, not after.

---

## TASK 3 — THE THREE `sweepField` SITES ARE **NOT** THREE COPIES OF ONE SELECTION

They were reported as three copies. They are not, and consolidating them would have broken one.

| site | authority | second side argument |
|---|---|---|
| `affect` branch (Defog) | `target.side` + `source.side` | **fixed** — target's side, bouncer's as source |
| `statcode` branch (Tidy Up) | `[pokemon.side, ...pokemon.side.foeSidesWithConditions()]`, and `tidyup.target === 'self'` | correct as *the other side*; "target's side" would collapse the two bags into one and leave the opponent's hazards standing |
| damaging branch (Rapid/Mortal Spin) | `hazardsFrom: 'self'` | **never read** |

Both memberships are **derived, not asserted**: the probe's §0 walks `data/tags.json` and fails by
name if a damaging carrier ever gains `hazardsFrom: 'target'/'both'` or `screensFrom: 'target'`, and
it parses the two handler blocks out of `data/moves.ts` on every run. Comments at both unchanged sites
now say why they are unchanged.

---

## THE SIDE-SELECTION CENSUS: 80 → 78, AND A FILE I DAMAGED AND REPAIRED

Two sites declared — `kind:affect | sfB:sfA | 2db5fab0` (FIXED) and
`kind:statcode | sfB:sfA | b28c2fd1` (CORRECT). Undeclared **80 → 78**; the artifact was restamped, so
the ratchet moved **down** to 78.

**I ran `git checkout -- data/side-selection-declarations.json` while tidying a formatting mistake of
my own, and it destroyed four uncommitted declaration rows written by the previous session.** They
were re-declarations under drifted anchors (`kind:pass | ed9b865e`, `kind:pass | 7feb3be1`,
`fn:<module> | 934a23c7`, `fn:<module> | 79cd0d52`); the session-start `git status` snapshot did not
list the file, so I believed it clean. The symptom was `undeclared` jumping 78 → 82 with no engine
change, and I chased it for some time before recognising it as my own damage rather than a drift.

Repaired, and how faithfully, stated per row:

- `fn:<module> | 934a23c7` and `fn:<module> | 79cd0d52` — **restored verbatim.** Their full
  `question`/`verdict`/`authority`/`note` had been printed by the census before the checkout and were
  still in this session's transcript. Each carries a bracketed `[RESTORED VERBATIM 2026-09-04 …]`
  preamble naming the loss.
- `kind:pass | ed9b865e` and `kind:pass | 7feb3be1` — **reconstructed, and labelled as such.** I never
  saw their text. Each carries the *expired* key's `question`/`verdict`/`authority`/`note` verbatim
  plus a preamble stating that the previous session's wording was destroyed and that this row is built
  from the expired key rather than from memory. **These two should be re-read by whoever wrote them.**

`data/side-selection-census.json` was clean at session start (verified: its content was the committed
2026-08-29 artifact) and its restore cost nothing. `engine/side_selection_census.js`,
`data/open-work.json` and `docs/ROADMAP.md` carry other sessions' uncommitted work and were not touched.

---

## WHAT WAS RUN, AND ONE RED THAT IS NOT MINE

Green: `test-mechanics` (census regenerated, **829/829**, `directCall` ratchet 1, `unarmed` 0),
`test-middle-identity`, `test-middle-damage-roll`, `test-damage-roll-support`, `test-middle-draw-scope`,
`test-middle-stall-address`, `probe_mid_cat_reload`, `test-mc-key`, `test-mc-seal`, `test-game-diff`,
`test-end-state`, `test-immunity-gate`, `test-volatile-duration`, `test-resolution-order`
(exit 0 at its declared `ABRA-HEAP: 6144`; it OOMs at node's default heap and that is documented in
`tests/run-all.js`, not a finding).

`tests/staged_board.js` — **25 of 25 clean and board-identical**, exit 1 on a *pre-existing* red that
is not mine: the `fakeout-flinch` proof plant's anchor `if(m._flinch){m._flinch=false;m._mvRes=false;`
spans a line break in the engine and matches zero times. The anchor is absent at `HEAD` as well as in
the working tree, and the scenario's own header (filed 2026-08-19) says the second half of the fix
lives in `engine/engine_release.js`, which is MEASURE's file. Reported, not patched.

The `status.js` `FAIL` rows against the roster, `engine-diff.json`, `all-mechanics-fire.json` and
`data/game-differential.json` are all the expected *"measured against a different engine"* withholding
that a new release always produces. They are re-runs owed, not regressions.

---

# OWED

- **`docs/ENGINE.md`'s hand list is not updated, deliberately** — the docs agent owns `docs/`, and I
  was told not to write there beyond this file. The two rows that leave it are the confusion self-hit
  damage value (now carried by `tests/probe_confusion_selfhit_address.js`) and the Defog target-side
  defect (now `tests/probe_defog_target_side.js`). **`node engine/status.js --write` was NOT run**, for
  the same reason.
- **The two `kind:pass` declaration rows are reconstructions and are labelled so.** Whoever wrote them
  on 2026-09-04 should re-read them; the code they cover is byte-identical and the census verifies that
  by digest, but the wording is mine, not theirs.
- **The pinned differential publishes no `MEDFAILS` for the two new loud fallbacks.**
  `confusionDmgStreamMissing` and `sweepFieldNoTargetSide` are asserted at zero by the probes on staged
  boards only. For the 961-game pool the evidence that the fix fired is indirect but positive:
  `getConfusionDamage wrapped as dmg: yes, 38 entries` on the run receipt, and 13 of 13 confusion
  causes closing — a fallback to the generic stream would have parted the addresses and either voided
  those games or left them diverging.
- **The surviving M6-adjacent cause is an ordering defect, not a damage one**, and has no probe:
  `|-damage|p1b|H/H|[from]confusion <> |move|p1b|makeitrain`, class `unrelated event mismatch`. It is
  one game and it belongs to whatever pass takes the `ordering` / `unrelated event mismatch` families.
- **Six of the thirteen games whose confusion cause closed remain board-material on a second cause.**
  They are not attributed here. The class table says they did not move *into* another class, so they
  were already in one — but which one, per game, is unmeasured.
- **`data/game-differential.json` is still on release `8ad06030e129`.** Nothing was written over it, as
  instructed; the batch's number lives in `data/verification/fix-batch-M6instr-defog.json`.
