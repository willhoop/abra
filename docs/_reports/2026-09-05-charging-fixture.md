# The release turn had never been played, and when it was, the engine aimed at the wrong body

2026-09-05. ENGINE. Release **`688e696f00c8`**, cut from the tree these fixes are in.
`data/game-differential.json` was **not** touched and still holds the published 46 on release
`0dec37ff5ad9`. `data/policy-weights.json`, `data/abra-tags.js`, `data/tags.json` and
`docs/ROADMAP.md` were not touched either.

---

## HEADLINE

**1. `scripted()` now replays a locked move.** One line, and it is the line `docs/_reports/2026-09-05-fix-batch-8.md`
OWED 1 named. Every directed scenario in this repository can now reach a two-turn release turn; none
ever had.

**2. `vol.charging` was TWO defects, not one, and only the smaller of them is the one the card named.**

- **The big one, which nobody had proposed: the release turn aimed at the wrong body.** medicham2
  rebuilt the release action against `live(foes)[0]` — the lowest live foe index — where the authority
  replays the `targetLoc` it stored on the sub-volatile at the charge. A Phantom Force charged at the
  foes' slot **b** and released with both foes standing struck slot **a**.
- **The small one, which the card DID name and which is real: the wrapper survived a BeforeMove
  refusal.** A flinched, slept or Disabled charge kept its `twoturnmove` clock where
  `twoturnmove.onMoveAborted` drops it. It fires **2 times in 961 games**.

**3. The two arms, both re-measured on the new release, both with a knob-cleared control that
reproduces the old numbers EXACTLY.**

| | `empirical-click/v1` (control) | `joint-empirical-click/v1` |
|---|---|---|
| board-material **before** | 35 | **110** |
| board-material **knobs ON, new release** | **35** | **110** |
| board-material **after** | **34** | **53** |
| protocol before / knobs / after | 120 / **120** / **121** | 191 / **191** / **138** |
| VOID before / knobs / after | 4 / **4** / **4** | 38 / **38** / **4** |
| end state DIFFERENT | 17 / 17 / **16** | 81 / 81 / **35** |
| ENDED-APART | 0 / 0 / 0 | 18 / 18 / **9** |
| both engines ended | 485 / — / 485 | 481 / 481 / **500** |
| threw | 1 / 1 / 1 | 0 / 0 / 0 |

The knob rows are the attribution and they are not decoration: `engine_release.js drift` says the
only frozen source that moved between `a5c736283129` and `688e696f00c8` is
`engine/medicham2-browser.js`, and with `MEDI_CHARGE_REAIMS_FIRST_LIVE_FOE=1
MEDI_CHARGE_WRAP_SURVIVES_ABORT=1` the new release reproduces **every one of the six figures** on
both arms. So the whole movement belongs to these two changes and to nothing else in the tree.

Artifacts: `data/verification/charge-fixture-{empirical,joint}.json` and
`…-{empirical,joint}-knobs.json`. Census **829 live / 829 probed / 0 missing**, `run_ok: true`.
Gate back to **2 of 9**.

---

## 1. THE INSTRUMENT — `scripted()` SUPPLIED A TARGET FOR A MOVE THAT HAS NONE

`Pokemon#getMoves(lockedMove)` (`sim/pokemon.ts:971-990`) returns `{ move, id }` and nothing else.
`Side#chooseMove` reads `targetType = request.moves[moveIndex].target!` (`sim/side.ts:581`), gets
`undefined`, and refuses any choice that names a target (`sim/side.ts:667-670`). Every one of the ten
two-turn moves legal in this regulation is `normal` or `any` — derived at run time by the probe, not
recalled:

```
bounce(any) dig(normal) dive(normal) electroshot(normal) fly(any)
meteorbeam(normal) phantomforce(normal) skyattack(any) solarbeam(normal) solarblade(normal)
```

so the refusal was total. Reproduced before any edit:

```
turns 1  err  p1 choice rejected p1 "move 1 2, move 1":
              Can't move: You can't choose a target for Phantom Force
```

The fix is the rule the **unscripted** chooser in the same file already had, with a comment recording
the four games the guess cost it:

```js
const tt = ('target' in act.moves[k]) ? act.moves[k].target : null;   // was: : dm.target
```

`'target' in mv` is the authority answering whether the click names a body; `mv.target || dm.target`
is a second object answering a question it was not asked. The `act.moves[k] &&` guard went with it
because it was **dead** — `k` comes from a `findIndex` over `act.moves`, so the entry always exists,
and the guard was hiding the real branch behind a condition that can never be false.

**A new loud counter, `scriptCounters().lockedNoTarget`,** counts locked clicks encoded with no
target. It read **0 on every run in this repository's history**; both new probes assert it at exactly
1 per release turn, so a regression here shows as a fixture failure rather than as a green arm.

**DID THE `directed` BLOCK MOVE?** No. Every existing scenario's clicks are still encoded
identically — the branch only changes behaviour for a request entry with no `target` field, which
only a locked move produces, and no existing scenario reached one. Evidence rather than assertion:
`tests/roster.js` on all three stages, `engine/all_mechanics_fire.js --kind all`, and nine adjacent
directed probes (`probe_encore_bracket`, `probe_imprison_seal`, `probe_pivot_magic_bounce`,
`probe_two_gates`, `probe_instruct_shield`, `probe_ally_lightning_rod`, `probe_volatile_leaves`,
`probe_noguard_invuln`, `probe_protect_stage_order`) are all green and all unchanged in their counts.

---

## 2. THE DEFECT — THE RELEASE AIMED AT `live(foes)[0]`

**The authority remembers.** `twoturnmove.onStart` (`data/conditions.ts:287-306`):

```js
let moveTargetLoc: number = attacker.lastMoveTargetLoc!;
attacker.volatiles[effect.id].targetLoc = moveTargetLoc;
```

and `Side#chooseMove`'s locked branch (`sim/side.ts:673-686`) replays it. Champions carries no
override for `twoturnmove` — grepped at run time by the probe, not taken from prose.

**medicham2 remembered nothing.** `engine/medicham2-browser.js`, in `mk`:

```js
if(mon._charging&&MC.moves[mon._charging]){
  const _t=live(foes)[0]||null;                    // <- the whole defect
  _a=playerAction(mon,mon._charging,_t,field);
```

Staged, first run, before any edit — Gengar charges at Sylveon and releases into Meowstic:

```
showdown  T2   p1a: Gengar -> p2b: Sylveon
medicham  T2   p1a: Gengar -> p2a: Meowstic
-damage   showdown ["p2b: Sylveon"]   medicham ["p2a: Meowstic"]
```

**WHY IT SURVIVED SO LONG, AND IT IS NOT LUCK.** `game_differential.js`'s driver resolved every
single-foe click with `foes.findIndex(q => q && !q.fainted)` — the *same* lowest live index — so every
charge in every measured game was aimed at slot a and re-aiming a release to slot a was a **no-op by
construction**. `joint-empirical-click/v1` draws a real joint target, aims at slot b, and the charge
family immediately dominated its unshared-address shapes. This is the second candidate mechanism
`docs/_reports/2026-09-05-driver-joint-model.md` §6 named and declined to claim; it is now measured.

**The fix stores an INDEX, not a body.** `_ttmTgtSlot` is written at the charge site beside
`m._charging`, from `a.target` **above** `reaimToSlot` — which is the authority's own "the location of
the originally targeted slot before any redirection". At release the slot is resolved against the live
foe array, so a replacement standing there takes the hit, exactly as `reaimToSlot` already handles
every other aim. Handing a body reference over instead would follow an Ally Switch the authority does
not follow.

**The fallback is the old rule and it is COUNTED, not silent.** An empty or dead remembered slot puts
the authority in `getRandomTarget`; this engine keeps `live(foes)[0]` there rather than inventing a
die the differential cannot share, and says so through `chargeReleaseSlotVacated` /
`chargeReleaseNoRememberedSlot`.

### What the new branches actually matched, printed before being trusted

961 joint games, whole-run `MEDSEEN`:

```
chargeWrapApplied                 512     charges committed
chargeReleasedAtRememberedSlot    450     releases that used the memory
chargeReleaseSlotVacated            0     declared fallback — never taken
chargeReleaseNoRememberedSlot       0     a charge with no body attached — never happened
chargeWrapAbortedAtGate             2     wrappers dropped by a BeforeMove refusal
chargeWrapAbandoned                 0
```

Two things read off that block. The memory is the **only** road a release takes — neither fallback
fired once — so nothing is being silently defaulted. And the abort fix matched **2 of 512 charges**,
which is the opposite of over-firing and matches the two `vol.charging` rows fix-batch-8 named.

---

## 3. THE SECOND DEFECT — THE WRAPPER SURVIVED A BeforeMove REFUSAL

fix-batch-8 §6 was **right**, and this is the first time it has been staged.

```js
onMoveAborted(pokemon) { pokemon.removeVolatile('twoturnmove'); }        data/conditions.ts:319
onEnd(target)          { target.removeVolatile(this.effectState.move); }              :316
```

raised on exactly one condition — `runEvent('BeforeMove')` returning false
(`sim/battle-actions.ts:255-263`). Staged: Aerodactyl (base 130) flinches Archaludon (base 85) on its
Electro Shot release turn under `bottom-tie-first`, whose corner fires every secondary, so Iron Head's
20% flinch is a certainty on both engines:

```
medicham |cant| lines      ["|cant|p1a: Archaludon|flinch"]
board divergence           {"turn":2,"diffs":[{"path":"p1.active[0].vol.charging",
                                              "medicham":1,"showdown":0}]}
```

Exactly one leaf, exactly the shape the card described.

**IT IS ONE MARKER AND NOT TEN EDITS.** The refusal doors are ~ten `continue`s inside a loop body
that carries about thirty of them, and the file's own `_gateRan` sweep says in as many words why a
rule repeated at each of them arrives incomplete. So a marker is armed at the **head of the gate** and
disarmed at the `|move|` line — which this file already names as the boundary: *"Everything above this
line is a BeforeMove refusal … Everything below is a TryMove or onTry failure"* — and swept by
`midAbortTwoTurn()` beside each `midClearActiveMove()` call. The door that has to be enumerated is
therefore the one the **authority** enumerates, and a refusal added later is covered with no edit.

It fires immediately rather than at the residual, which matters for the five semi-invulnerable
members: the authority makes an aborted Phantom Force targetable again at once, and a later body on
the same turn aims at it.

**The control that separates the two readings** is `no-flinch`: the identical board with Protect in
place of the Iron Head. The release RUNS and is stopped by the shield — a TryMove failure, not a
BeforeMove refusal — so the authority **keeps** the clock through it. A fix hung off "the move did not
connect" rather than "the gate refused it" fails there. It is green on both loads.

---

## 4. THE PROBES

| file | arms | what it asserts |
|---|---|---|
| `tests/probe_charge_release.js` | `release-at-b` (red), `mirror-side` (red), `release-at-a` (control), `direct-at-b` (control) | the release turn's `|move|` TARGET FIELD and `-damage` recipients agree with the authority, and the board does not part |
| `tests/probe_charge_abort.js` | `abort-flinch` (red), `no-flinch` (control) | the boards agree at the release boundary |

Both were **shown red first**: `probe_charge_release` failed 4 of 4 on the unfixed tree, three of them
with `THREW — Can't move: You can't choose a target for Phantom Force` and the fourth
(`direct-at-b`, which uses no charge move) held; after the encoder fix it failed on the aim with
`showdown p2b: Sylveon / medicham p2a: Meowstic`; after the engine fix all four pass.

Everything each file leans on is asserted rather than assumed:

- **the knob binds** — `MEDI_CHARGE_REAIMS_FIRST_LIVE_FOE` and `MEDI_CHARGE_WRAP_SURVIVES_ABORT` each
  stamp a `MEDFAILS` key, asserted ABSENT clean and PRESENT under the knob. A knob read by a module
  the driver never loaded reads identically on both loads and stages nothing.
- **the mechanic FIRED** — `chargeReleasedAtRememberedSlot` and `chargeWrapAbortedAtGate` are asserted
  at an exact expected count per arm, and the two declared fallbacks are asserted at exact **zero**,
  so an arm that took a fallback while claiming to test the memory is a fixture failure.
- **the release turn was reached** — `scriptCounters().lockedNoTarget` asserted at exactly 1 per arm
  that claims one and 0 on the arm that claims none.
- **the instrument is not blind** — `direct-at-b` asserts the AUTHORITY's own target on that arm is
  DIFFERENT from `release-at-a`'s, so "the two engines agree" cannot be read off a turn where nothing
  could have moved.
- **the controls agreed and still agree** — `release-at-a` and `no-flinch` are green on the clean load
  AND under the knob. A fix that re-aimed on the fact of a charge rather than on the remembered slot
  breaks the first; one hung off "the move did not connect" breaks the second.
- **no silent `catch`** — there is not one `try` in either file. `buildPair` returning null is printed
  as NOT-STAGED and **counted as a failure**, and every fixture cell is checked against
  `Dex.forFormat('gen9championsvgc2026regmb')` and the learnset before a game is played.
- **the fixture avoids its own dice** — Sylveon runs Pixilate, not Cute Charm, because Phantom Force
  is a contact move and Cute Charm draws an infatuation die on the very body being measured;
  bystanders click Calm Mind rather than Protect because Protect has a consecutive-use roll;
  Archaludon runs Stalwart rather than Stamina and Aerodactyl Rock Head rather than Pressure, because
  one writes a `-boost` into the turn under test and the other spends a compared PP leaf.

**And the trap from the brief was hit and avoided.** `release-slot-a-empty` was written as a fourth
control and reported **NOT-STAGED — `buildPair` refused side A**: `buildPair` requires four bodies
and a two-body sheet returns null. It was replaced with `mirror-side` rather than downgraded to a
skip, because a COULD-NOT-STAGE verdict is a claim about the fixture and never about the mechanic.

---

## 5. THE SCOREBOARD, CALLED IN WRITING BEFORE ANY RUN — **3 of 8**

`data/verification/2026-09-05-charge-fixture-prediction.json`, written while both probes were green
and before the first differential game.

| arm | quantity | called | read | |
|---|---|---|---|---|
| empirical | board-material | 35 | **34** | MISS by 1 |
| empirical | protocol | 120 | **121** | MISS by 1 |
| empirical | VOID | 4 | **4** | HIT |
| joint | board-material | 95 (±10) | **53** | **MISS by 42** |
| joint | protocol | 175 (±10) | **138** | **MISS by 37** |
| joint | VOID | 15 (±10) | **4** | **MISS by 11** |
| — | census | 829 / 829 / 0 | **829 / 829 / 0** | HIT |
| — | gate clauses failing | 2 of 9 | **2 of 9** | HIT |

**Every joint miss is in the same direction: the fix is far larger than it was called.** VOID going to
4 — the control arm's own floor — was not predicted at all and is the single most informative number
here: the charge family was the *entire* remaining source of unshared dice addresses in that arm. Its
`unshared_address_shapes` block now contains **zero** charge moves, where it held 23 crit
`phantomforce`, 22 `[me only]` of the same, 18 `electroshot` and 9 `solarbeam`.

The two empirical misses of 1 are real and attributed, not noise — the knob run reproduces 35/120
exactly, so the −1 board and +1 protocol are the fix. Two board rows left and one arrived
(`…-2658645239`, an Annihilape/Mudsdale HP-and-faint cascade at turn 3 whose protocol card is outside
the artifact's 60-row cap); the new one is a re-shuffled trajectory on an arm with live dice, not a
diagnosed regression, and it is stated as such rather than explained away. See OWED 2.

Running record across the session: 2-of-3, 4-of-4, 4-of-5, 4-of-4, 4-of-4, 3-of-4, 4-of-4, 5-of-8,
**3-of-8**.

---

## 6. `tests/test-pin-arms.js` — **A STALE ASSERTION, NOT A DEFECT.** Fixed.

`FAIL middle: a move at accuracy 1, 2, 3, 4, 5 does NOT hit`.

The loop is `for (const a of G.ARMS.filter(x => !x.top))` and asserts that **every** accuracy from 1
to 100 HITS. That filter was written when every non-top arm was corner-pinned and `chance` returned a
constant. `middle` carries `corner: CORNER_BOTTOM`, so `top` is false, and it was swept into a claim
its own `what` string contradicts — *"Moves miss at their printed accuracy"*.

Read at the line (`engine/game_differential.js`, `makeArm`):

```js
const chance = (num, den) => {
  if (spec.middle) {
    const cat = (MIDW.cat === 'dmg') ? 'crit' : midAddrCat();
    return midDraw(cat === 'any' ? 'any' : cat, this) < (num / den);   // a LIVE uniform
  }
  return random(den) < num;                                            // a pinned constant
};
```

So outside a battle the loop asserts that one draw is under 0.01, then under 0.02, and so on to 1.00.
Measured on this tree: `middle.chance(acc, 100)` is **false for acc 1..10** on a fresh load and false
for 1..5 mid-run — the value moves with how many draws Parts 1 and 2 consumed. The historical pass was
one hash landing under 0.01. **A gate that is green on a coin is not a gate**, and this is consistent
with `docs/_reports/2026-09-04-runall-triage.md`, which recorded the identical message at base and
refuted the medicham2 crit-draw hypothesis with a control.

Fixed by excluding `middle` from the corner-hit loop and asserting instead the only accuracy claim a
live-dice arm can make — its own listed claim, *"a certainty is still a certainty: 100 accuracy always
hits, 0 never does"* — over 50 live draws in **each** direction, so an arm whose `chance` had
degenerated to a constant `true` fails the second half rather than passing the first. Identity between
the two engines on a 90-accuracy move comes from the SHARED ADDRESS in this arm, which is what PART 1
measures. `tests/test-pin-arms.js` now **ALL PASSED**.

---

## 7. THE FIVE CLAUSES THIS RELEASE STALED — ALL RE-RUN

| clause | command | result |
|---|---|---|
| game differential (per-hit) | `tests/test-engine-diff.js --n 6000 --seed 20260804` | 6000 compared, 6000 agreed, **0 disagreed** |
| deliberate roster / items | `tests/roster.js --stage items --write` | 140 MATCH, 8 COULD-NOT-STAGE, **0 DIFFER, 0 DID-NOT-FIRE** |
| deliberate roster / abilities | `tests/roster.js --stage abilities --write` | 129 MATCH, 141 COULD-NOT-STAGE, 45 CONTROL-NOT-QUIET, 1 DEFERRED, **0 DIFFER, 0 DID-NOT-FIRE** |
| deliberate roster / moves | `tests/roster.js --stage moves --write` | 475 MATCH, 22 COULD-NOT-STAGE, 3 DEFERRED, **0 DIFFER, 0 DID-NOT-FIRE** |
| mechanics staged and compared | `engine/all_mechanics_fire.js --kind all --write` | 1313 games, 0 threw, clause PASSES |

`--kind all` was passed explicitly; the default `--kind moves` would have left the gate at 3 of 9.
`engine/engine_release.js drift 688e696f00c8 --against a5c736283129` was checked first and reported
**CONTENT-CHANGED** on one file, so the five re-runs were owed rather than a line-ending artefact.

**Gate: `2 of 9 gate clauses fail`** — the two whole-game clauses, both reading the unrepublished
`data/game-differential.json` on release `0dec37ff5ad9`. Nothing else fails.

All differential runs, before and after, used the SAME census pin
(`data/verification/census-pin-9446a684709d.json`) and the SAME frozen pool
(`data/team-pool-frozen`), and the census was regenerated only **after** the two headline runs, so no
comparison here straddles a census change.

---

## 8. ADJACENT CHECKS RE-RUN GREEN

`test-mechanics` (census 829/829/0), `test-charge` (18/18), `test-precharge-order` (83/83),
`test-volatile-duration`, `test-engine-consistency`, `test-middle-identity`, `test-empirical-driver`,
`test-divergence-composition`, `test-arm-steering` (exit 0 with `SHOWDOWN_PATH` exported — a bare
shell skips it at exit 2, which is not a pass), `test-protocol-trace`, `test-fragility`,
`test-tag-params-derived`, `test-no-silent-failure`, `test-switch-carry`, `test-speed-tie`,
`test-assert-mode`, `test-choice-lock`, `probe_encore_bracket`, `probe_imprison_seal`,
`probe_pivot_magic_bounce`, `probe_noguard_invuln`, `probe_volatile_leaves`,
`probe_ally_lightning_rod`, `probe_instruct_shield`, `probe_two_gates`, `probe_protect_stage_order`.

**Two reds checked and NOT mine, both with evidence rather than assertion:**

- `tests/probe_upkeep_lines.js` reports `49 arms, 4 not as expected` — **byte-identical on release
  `a5c736283129`**, i.e. on the pre-fix engine. Its `D clock volatile:phantomforce` arm AGREES on both.
  It exits 0; it is not a gate.
- `tests/test-wiring.js` fails 10 unwired capabilities including `mega 0.00 per game`. Recorded as red
  at base in `docs/_reports/2026-09-04-runall-triage.md` ("identical 10 unwired capabilities"). It is
  a MAG/self-play wiring failure and MAG is paused. **Noted: running it plays self-play games, which
  this division should not do — it was run once by mistake in a regression sweep and not repeated.**

---

## OWED

1. **`docs/ENGINE.md` has NOT been updated and `node engine/status.js --write` has NOT been run.**
   The brief for this batch says a docs agent owns the version-headed documents and that `docs/` is not
   to be touched beyond this report; the standing ENGINE instruction says to update the hand list and
   restamp. The narrower, more recent instruction was followed. So the `<!-- GENERATED -->` block at
   the top of `docs/ENGINE.md` is one restamp behind, and the hand list still carries `vol.charging`,
   which now has two probes and should leave it. Nothing inside a generated block was hand-edited.
2. **The one NEW board-material row on the control arm is attributed but not diagnosed.**
   `…-2658645239` (`omit-spread`), turn 3: Annihilape 6 vs 118, Mudsdale fainted in Showdown and alive
   here, Liepard 68 vs 139. The knob control proves it is caused by these two fixes; its protocol card
   is outside `first_divergences`' 60-row cap, so the *mechanism* is unknown. The reading offered — a
   re-shuffled trajectory on a live-dice arm — is a hypothesis and is **not** claimed.
3. **The joint arm's 53 has no per-mechanism diagnosis.** `state.first_board_divergences` is
   `.slice(0, 40)` and 53 does not fit under it, so 13 rows are unnamed. This is
   `docs/_reports/2026-09-05-driver-joint-model.md` OWED 2, now much smaller but still open. Raising
   the cap changes the artifact shape and was not done inside a run that publishes a rate.
4. **The semi-invulnerable half of the abort fix is wired but NOT staged.** `abort-flinch` uses Electro
   Shot, because a flinch source cannot hit a body that has left the field. So "a Phantom Force aborted
   by sleep comes down out of the sky" is asserted by the shared marker and by source read, never by a
   game. A fixture needs a refusal door that reaches an invulnerable body — sleep applied on the charge
   turn is the obvious one and it needs a deterministic sleep source under a pinned arm.
5. **`data/game-differential.json` is still unrepublished** and still holds 46 on release
   `0dec37ff5ad9`, which is why the gate reads 2 of 9. Republishing it is a decision about the
   published figure, not a side effect of this batch, and it was deliberately not taken.
6. **Two engine releases were cut over this tree by ordinary probe runs before the named one** —
   requiring `engine/game_differential.js` cuts one at require time; the probes route theirs to
   `tests/_live_release.js`'s temp store, and `6f96db9da019` appears in the roster artifacts from the
   pre-cut stage. Reported, not tidied.
7. **Nothing was committed and nothing was deleted.** The tree carries
   `engine/medicham2-browser.js`, `engine/game_differential.js`, `tests/test-pin-arms.js`,
   `tests/probe_charge_release.js`, `tests/probe_charge_abort.js`,
   `data/verification/2026-09-05-charge-fixture-prediction.json`,
   `data/verification/charge-fixture-{empirical,joint}.json`,
   `data/verification/charge-fixture-{empirical,joint}-knobs.json`, plus the regenerated
   `data/mechanics-census.json`, `data/engine-diff.json`, `data/roster.*.json`,
   `data/all-mechanics-fire.json`, `data/engine-release.json`, `data/provenance-stamp.json` and
   `data/published-samples.json`. `engine/empirical_driver.js` was already modified in the tree when
   this batch started and was not touched by it.
