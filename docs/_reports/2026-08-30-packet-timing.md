# G3 AND G4 ARE TWO FIXES, NOT ONE — AND THE BERRY WAS NEVER ABOUT THE PACKET LOOP AT ALL

**2026-08-30. ENGINE. Both landed, both probed, both shown red under their own knob first.**

| | before | after |
|---|---|---|
| census (`data/mechanics-census.json`) | 808 probed / 808 live / 0 missing | **810 / 810 / 0** |
| empirical protocol-diverged games | 191 of 961 | **181** |
| empirical board-parted | 84 of 961 | **84 — unmoved, as predicted** |
| `ordering` class, games | 43 | **31** |
| end-state verdicts | 903 / 55 / 2 / 0 / 1 | **903 / 55 / 2 / 0 / 1 — identical** |
| `test-resolution-order.js` KNOWN-OPEN arms | 1 | **0** |
| engine release | `b45e6b257029` | **`a18431d6dbe2`** |

---

## 0. THE PREDICTION, WRITTEN BEFORE THE RUN

Stated in this file and committed to disk before `game_differential.js` was started:

| | baseline | predicted | accepted band | **measured** |
|---|---|---|---|---|
| protocol-diverged games | 191 | **183** | 179–189 | **181** |
| board-parted games | 84 | **84 — unmoved** | 82–85 | **84** |
| `ordering` class, games | 43 | **31** | 28–34 | **31** |
| end-state verdicts | 903 / 55 / 2 / 0 / 1 | **identical** | identical | **identical** |

**Why a band and not a point on protocol, said in advance.** Twelve games leave the `ordering` class,
and at least one of them cannot leave the run: row 133 is a Parental Bond Drain Punch into a Chople
Berry, and this engine halves EVERY arrival of the volley where the authority halves only the one that
ate the berry — measured in the lab on the probe's own board, Triple Axel into a Yache Berry reading
`1464 -> 1434 -> 1374 -> 1284` with the berry against `1404 -> 1284 -> 1104` without. The drain heal on
that same row is also paid once per row rather than per hit. Fixing the LINE ORDER there simply
promotes one of those to first place. **That game did resurface, on the drain heal.**

**Why the board was predicted flat.** The 2026-08-29 breakdown attributes 1 board-parted game to G3
and 1 to G4 and explicitly declined to claim attribution; `first_board_divergence_turns` is 5–10 turns
downstream on most of these rows. An unmoved board here is not a failure and was said so before the
run.

**Three of four exact, one inside the band in the improving direction.**

---

## 1. ONE FIX OR TWO — MEASURED, NOT ARGUED

The brief's hypothesis was *"both are our packet loop defers something the authority does per
arrival"*. **Refuted, and not merely unconfirmed.** The 2x2 over the two revert knobs, one staged
board per defect:

```
                       G3 board (Dual Wingbeat / Rough Skin)   G4 board (Heat Wave / Occa Berry)
  neither knob         T R T R C            CORRECT            B W A H            CORRECT
  MEDI_REACT_BATCHED   T T R R C            WRONG              B W A H            CORRECT
  MEDI_BERRY_AT_APPLY  T R T R C            CORRECT            A B W H            WRONG
  both                 T T R R C            WRONG              A B W H            WRONG
```

T = an arrival landing on the target, R = its `DamagingHit` reaction, C = `-hitcount`; B/W = the
berry's `[eat]`/`[weaken]` pair, A = the OTHER spread target's damage, H = the holder's own. Each knob
moves its own board and leaves the other **byte-identical** — asserted on the full canonical line
arrays, not on the shape strings — under **both** settings of the other knob.

The census agrees in both directions: `MEDI_REACT_BATCHED=1` takes `ability/reactionPerArrival`
MISSING and leaves `item/resistBerryAtCalculation` LIVE (809 live / 1 missing), and the reverse holds.
Both knobs are registered in `DELIBERATE_BREAK`, so both runs REFUSED to write the census and the
message named the right `MEDFAILS` key.

**G4 is not a packet question at all.** It is visible on a **single-hit** spread click, where there is
no packet loop: `getSpreadDamage` runs `getDamage` for every target (`scripts.ts:361`) before
`spreadDamage` moves any HP (`:368`), and this driver is step-outer / row-inner — so a berry spent in
the apply step lands between the other targets' `-damage` lines. Five of its six pool games are
single-hit spread clicks.

## 2. G3 WAS RE-MEASURED ON THE CURRENT TREE, AS THE BRIEF ASKED

It was counted on release `26787be1b8b4` and the tree had moved twice. Re-read from the
`b45e6b257029` dump: **the same six games and the same six cause strings**, four Rough Skin
(`|-damage|…|[from]roughskin` against a later `-damage` / `-supereffective`) and two Stamina
(`|-boost|…|def|1` against a later `-resisted`). **The 2026-08-29 `_react` fix had not changed its
shape, and that is the right answer rather than a coincidence:** that fix corrected HOW MANY times the
event fires (a volley stopped by a KO tolled per DRAWN hit instead of per LANDED hit); this one
corrects WHERE each firing lands. Same family, different question, separate knobs.

## 3. THE AUTHORITY'S TWO STATEMENTS — CHAMPIONS CHECKED FIRST

`data/mods/champions/scripts.ts` overrides **both** `spreadMoveHit` (`:315`) and `hitStepMoveHitLoop`
(`:428`). It changes the `-hitcount` clause and nothing about either position.

- **`runEvent('DamagingHit', damagedTargets, pokemon, move, damagedDamage)` is at `:409`, INSIDE
  `spreadMoveHit`**, which `:518` calls once per hit. The event fires per hit, interleaved with its
  own damage.
- **`ModifyDamage` is at `sim/battle-actions.ts:1825`, inside `getDamage`** — BELOW the
  `-supereffective`/`-resisted` line (`:1800`/`:1807`) and BELOW `-crit` (`:1814`), ABOVE the return.
  The resist berry is `onSourceModifyDamage` calling `target.eatItem()` (which writes `[eat]`) and
  then adding `[weaken]` beside it — `data/items.ts:1038-1049`, the same body on every member.
  **`data/mods/champions/items.ts` carries no berry at all**, so Champions overrides none of them.

## 4. WHAT MOVED IN THE ENGINE

**G3.** `_damagingHit(_n)` and `_stepBuffOnHit(R, _n)` now take "how many arrivals am I being paid
for". The packet loop calls each with a literal `1` for every interior arrival, immediately under that
arrival's `-damage` and above that hit's `eachEvent('Update')`; `R._reactPaid` / `R._buffPaid` are
what the deferred call subtracts from `_react`, so nothing is paid twice and the total is unchanged.
The **last** arrival stays with `_stepDamagingHit`, which is where the authority raises it relative to
that hit's `runMoveEffects`, `selfDrops` and `secondaries`.

`tg.curHP > 0` is what makes "arrivals 0..n-2" a fact rather than an index: a body killed by arrival k
means the loop breaks and k WAS the last arrival, so its reaction is owed to the deferred step.

**Both halves of the one event move together.** `punishesAttacker` (Rough Skin) and `buffsHolderOnHit`
(Stamina) are two adjacent steps reproducing one authority event; paying only one per arrival would
have split it. `_stepBuffOnHit`'s `!R.hit && !R.fainted` gate is asked on the deferred call only —
those fields are written at the BOTTOM of `_stepApply` (`:32021`), so asking them from the packet loop
would have refused every interior arrival **silently**, which is the shape this project has a rule
about. The inline caller has already established what the gate asks.

**Passing the count explicitly is load-bearing, not style.** `_react` is a `const` declared BELOW the
packet loop — it needs `_landed` — so an inline call that evaluated it would enter its temporal dead
zone. The literal `1` takes the other branch of the ternary and never reads it.

**G4.** The spend moved to the end of `_stepDamage`, under the effectiveness and crit lines. On the
addressed-arrival road those lines are written by the packet loop instead, so there the decision is
made in `_stepDamage` and the closure is handed to the loop to fire under **arrival 0's** pair — the
same moment in the authority (hit 1's `getDamage`), differing only in which of this engine's two sites
writes hit 1's effectiveness line. `MEDI_BERRY_AT_APPLY=1` hands the same closure back to the old
site instead, which is why the knob is a restore and not a third behaviour.

**No damage number moved**, and the control for that is arithmetic: `dmgRange` already applies the
halve as a pure read, so the moved site owns the CONSUMPTION and its two lines and nothing else. The
probe's empty-hand arms assert the holder took exactly half.

**The substitute guard moved with it and is explicit now** (`subBlocks`, a pure predicate at `:9784`,
asked before `tg._sub` has moved — the same state the old site read). The old site sat under
`_stepApply`'s substitute return; the handler's own `hitSub` check refuses in the same place in the
authority, so the rule did not change, only who asks it.

## 5. THREE THINGS DELIBERATELY NOT TAKEN, NAMED RATHER THAN FOUND LATER

- **An interior arrival's reaction lands under its `-damage`, not under that hit's secondaries**,
  because this engine still wraps the effects steps once per MOVE. The two positions coincide for
  every multi-hit move in this format — none carries a target secondary — and
  `tests/probe_multihit_update.js` derives that list on every run rather than trusting the sentence.
  It is the same declared remainder the between-hits `Update` block already carries.
- **`gainsVolatile` (Electromorphosis' Charge) stays once per move.** The authority WOULD re-announce
  per hit (`charge.onRestart` re-adds the line); this engine has never fired it more than once per
  click, so paying it here would be a second change riding on a line-ordering fix, on a family with no
  row in the pinned pool.
- **`boostsAtHPThreshold` (Berserk) is skipped on an interior arrival.** It is
  `onAfterMoveSecondary`, run at `scripts.ts:577` — below the whole hit loop and below `-hitcount`.

## 6. THE PROBES — RED FIRST, WITH THE OVER-FIRE CONTROLS THAT MUST NOT MOVE

Both were written and shown RED before a line of engine changed. Red output, quoted from the run:

```
MISSING  reactionPerArrival        ... Dual Wingbeat into Rough Skin "TTRRC", Twin Beam into Stamina "TTRRC"
MISSING  resistBerryAtCalculation  ... "ABWH" must be BWAH ... "BWEHEHEH" must be EBWHEHEH
```

**`ability/reactionPerArrival`**, four arms, all through `battleInit` / `battleTurn`.

- TEST: Dual Wingbeat into a Rough Skin Garchomp, and Twin Beam into a Stamina Archaludon. Both must
  read `TRTRC`.
- **OVER-FIRE CONTROLS: single-hit clicks off the same bodies into the same reactors** — Dragon Claw
  and Flash Cannon — which must read `TR` and must not move. An engine that fired the reaction inline
  for EVERY arrival, the last one included, would print the toll above the move's own secondaries and
  fail them. Measured unmoved under every configuration of both knobs.
- The two arms are different reactor FAMILIES on purpose: an engine that wired only
  `punishesAttacker` passes the Rough Skin arm and fails Stamina.

**`item/resistBerryAtCalculation`**, five arms.

- TEST 1, SPREAD: Heat Wave into two foes with an Occa Berry on the SECOND. Must read `BWAH` — the
  berry above BOTH targets' damage. `ABWH` is the defect, five games of the pool.
- TEST 2, ADDRESSED VOLLEY: Triple Axel into a Yache Berry. Must read `EBWHEHEH` — the berry under the
  first arrival's `-supereffective`, not above it. `BWEHEHEH` is the defect, one game.
- CONTROL, both boards with an EMPTY HAND: no berry line at all, and **the holder took 79 with the
  berry against 158 without — exactly double**, which is the assertion that the halve did not move.
- CONTROL, SUBSTITUTE: a doll eats the hit and the berry must still be held.

## 7. A KNOWN-OPEN ARM THAT HAD STOPPED BEING TRUE, PROMOTED IN THE SAME PASS

`tests/test-resolution-order.js`'s `a1-multihit-frequency` staged Dual Wingbeat into a Toxic Debris
Glimmora and declared *"the COUNT is already right (WIRE 84) and the INTERLEAVING cannot be without
converting the hit loop"*. It read **`KNOWN-OPEN?`** — the harness's own word for "declared open and
no longer parting" — the moment the fix landed.

The declaration was one restructure too pessimistic: only `DamagingHit` is per-hit, so moving that one
event reproduces the authority's stream with every other step still wrapped once per move. The row now
carries a break (`react-batched`, which deletes the inline payment and nothing else) and reads **RED
PROVEN**, parting under the revert at:

```
  showdown  |-activate|p2a: Glimmora|ability: Toxic Debris
  medicham  |-resisted|p2a: Glimmora|1
```

`26 arms staged, 0 of them KNOWN-OPEN, 0 failing`. **This is a whole-turn differential against the
real simulator, independent of the pinned pool** — the arm agrees line-for-line clean and parts under
its own surgical revert.

## 8. THE EMPIRICAL ARM — ATTRIBUTED, NOT ASSUMED

**Exactly twelve causes removed and every one names one of the two mechanisms:**

```
  six resist-berry rows      |-enditem|…|occaberry|[eat] <> |-damage|…            (x2)
                             |-enditem|…|passhoberry|[eat] <> |-resisted| / |-damage|
                             |-enditem|…|shucaberry|[eat] <> |-damage|
                             |-supereffective| <> |-enditem|…|chopleberry|[eat]
  six damage-reaction rows   |-damage|…|[from]roughskin <> |-damage| / |-supereffective|  (x4)
                             |-boost|…|def|1 <> |-resisted|                                (x2, Stamina)
```

**Two causes added, both the same games diverging later:**

```
  + event missing from medicham2 :: |-heal|p2a|H/H|[from]drain <> |-supereffective|p1a|1
  + -damage field 3              :: a confusion damage value, 78/160 against 81/160
```

The first is the Parental Bond row named in the prediction — the drain heal is paid once per row here
and per hit in the authority, and it was MASKED by the berry ordering until today.

```
  ordering                        43 -> 31     exactly the twelve
  event missing from medicham2    52 -> 53     one of the twelve resurfaced later
  -damage field 3                 18 -> 19     one of the twelve resurfaced later
  every other class                unchanged
  TOTAL                          191 -> 181
```

**Sample identity checked rather than assumed:** 961 games both runs, `turns_cap` 12, arm `middle`,
steering `empirical-click/v1`, census pin `9446a684709d`, `closet.teams_dropped` 43,
`coverage.exercised` 556 of 580, `state.not_compared` 5, `mid_void.void_games` 9, `order_probe` 2 both,
`mode` string identical. `engine/arms_comparable.js` reports **COMPARABLE**.

Artifacts: `data/verification/game-differential.packettiming.json` and
`data/verification/divergence-turns.packettiming.json`, release **`a18431d6dbe2`**, pool
`data/team-pool-frozen`, `--dump-games 250` (172 of 181). `data/game-differential.json` was **not**
touched — `--out` redirects the write. The baseline was read from the tracked
`game-differential.residualorder.json`.

## 9. TWO PRE-EXISTING REDS — ONE REPAIRED (IT WAS MINE), ONE HANDED BACK WITH A CONTROL

**`tests/probe_red_demo.js` went 5 -> 6 COULD-NOT-BE-APPLIED and that WAS this batch's.** The demo
*"Knock Off cannot take the Sash that just saved the target"* anchors its revert on the resist berry's
old line in `_stepApply`, which the fix removed. Its claim is unchanged — the strip has to land ABOVE
the Focus Sash — and the anchor is re-aimed at the one statement left at exactly that position (the
knob path that hands the berry closure back). Back to **5 COULD NOT BE APPLIED and 1 HOLLOW of 200**,
the set inherited from HEAD; the file is still RED and the other five (WIRE 117 Psychic Terrain,
ROADMAP #81 WIRE 2, WIRE 7 mega stone, WIRE 8 x2) are not this batch's.

**`tests/probe_upkeep_lines.js` is RED at 4 of 49 arms and it is NOT this batch's.** Proven with a
knob-cleared control rather than argued:

| arm | run |
|---|---|
| live tree, release `a18431d6dbe2` | 4 not as expected — A TEST, C hungerswitch, C whiteherb, D uproar |
| **both knobs restored** (`MEDI_REACT_BATCHED=1 MEDI_BERRY_AT_APPLY=1`) | **character-identical** |
| pre-change release `b45e6b257029` | **character-identical** |

All four are the perish/upkeep faint-drain boundary — the residual walk, which this batch does not
touch. This is the remaining half of the perish-song red the brief flagged as outstanding.

## 10. WHAT WAS RUN

| | |
|---|---|
| `tests/test-mechanics.js` | **exit 0, 810/810/0**, hollow 0, unarmed 0, threw 0 |
| under each knob | census REFUSED, correct probe MISSING, the other LIVE |
| the 2x2 over both knobs | each moves its own board, leaves the other byte-identical |
| `tests/test-resolution-order.js` | PASS, 26 arms, **0 KNOWN-OPEN** (was 1), A1 now RED PROVEN |
| `tests/probe_multihit_update.js` | PASS |
| `tests/probe_multihit_corners.js` | PASS |
| `tests/probe_volley_reactor_count.js` | PASS (`--release a18431d6dbe2`) |
| `tests/probe_punish_announce.js` | PASS |
| `tests/probe_lifeorb_toll.js` | PASS (`--release a18431d6dbe2`) |
| `tests/probe_recoil_after_clamp.js` | PASS |
| `tests/probe_innards_out.js` | PASS |
| `tests/probe_knockoff_megastone.js` | PASS |
| `tests/probe_hp_pair.js` | PASS |
| `tests/test-wiring.js` | every capability proved it ran |
| `tests/test-end-state.js` | PASS |
| `tests/test-engine-consistency.js` | PASS |
| `tests/test-seed-clock.js` | PASS |
| `tests/probe_turn_order.js` | PASS |
| `tests/probe_endturn_clock_order.js` | PASS |
| `tests/probe_residual_shadow.js` | PASS |
| `tests/test-residual-order-observed.js` / `-population.js` | PASS |
| `tests/test-perish-song.js` | PASS |
| `tests/probe_shield_rearm.js` | PASS |
| empirical whole-game differential | above |

## OWED, NOT RUN

- **A POOL-SCALE READING OF THE THREE NEW COUNTERS.** `MEDSEEN.reactionPaidPerArrival`,
  `resistBerrySpent` and `resistBerryAtFirstArrival` have only ever been read on a staged board:
  `game_differential.js` surfaces no `MEDSEEN`. The twelve removed causes are the pool-scale evidence
  that both roads ran, but they are not the counters.
- **THE ROSTER, ALL THREE STAGES, AND `data/all-mechanics-fire.json`.** Still on `e129bca605e3` and
  WITHHELD by the release-mismatch clause, which predates this batch and now predates it by two
  releases.
- **THE COVERAGE ARM of the whole-game differential** (`data/game-differential.json`). Stale on
  `e129bca605e3` and already withheld by `status.js` before this batch. It is the arm falsifier (b) of
  the closeted ROADMAP #440 row rests on, so that clause remains undecided.
- **`tests/test-engine-diff.js`** — not run, deliberately: it has no `--out` and would republish
  `data/engine-diff.json`. It calls `moveHit` ONCE, so it cannot see a multi-hit at all (stated at
  WIRE 20), and no damage number moved in this batch.
- **THE CLOSETED PERISH ROW (ROADMAP #440)** was not re-examined this batch. Nothing here touches the
  residual walk and its cause string does not appear in either dump's added or removed set.
- **THE THREE FILED HAND-LIST ROWS**, each its own batch: the volley halving every arrival against a
  resist berry; the drain heal paid per row rather than per hit; and an attacker killed by an interior
  arrival's toll not stopping the volley (`scripts.ts:534-537`) — the third is **named, not measured**,
  since nothing in the 961 games stages it and no probe here does either.
