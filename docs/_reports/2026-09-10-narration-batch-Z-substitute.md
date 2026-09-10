# NARRATION BATCH Z — THE SUBSTITUTE FAMILY IS CLOSED WITH A STEP, NOT THE LOOP-NESTING JOB THE RECORD PLANNED; THREE CARDS' GAMES STOPPED, THE FOURTH PARTED TWO LINES LATER ON THE NEXT CARD

ENGINE. Written as the work happened; the measurement block and the verdict are the last things added. Historical by
construction; superseded by the register rows it feeds. **No commits were made.** Nothing in `docs/RUNNING-NOTES.md`,
`CHANGELOG.md`, `docs/ROADMAP.md` or a living document was edited; proposed rows are at the end. `docs/ENGINE.md` gained one
section (with the hand list), as the brief requires, and `node engine/status.js --write` restamped the generated blocks.

---

## 0. READ THIS FIRST — THE RECORD'S PLAN WAS WRONG, AND THE RECEIPT IT NAMED DOES NOT EXIST

**The plan.** Five batches converged on: "this engine's arrival loop lives INSIDE `_stepApply` while the authority's is OUTSIDE
`spreadMoveHit`, so a step-0 doll slot fixes arrival 1 only; make the arrival loop the OUTER loop over the
`_stepDamage`…`_stepAfterHitField` segment." That premise requires a click that is **both multi-arrival and multi-row**. Derived
on the pinned authority checkout (`20ad99ffc9a5…`), and re-derived by the probe on every run:

- **14 legal multi-hit moves, every one `target: normal`** (Dragon Darts is `smartTarget` and is already walked row-major by batch N);
  legal moves that are multi-hit AND multi-target: **`[]`**.
- **Parental Bond refuses `move.spreadHit`** (`data/abilities.ts`, `parentalbond.onPrepareHit`: `… || move.spreadHit || …) return;`;
  Champions does not override it).

So at one row the step-major and the row-major walks are the same permutation, and a step-0 step that owns EVERY doll arrival is
the whole fix — one doll implementation, one position, no "arrival 1 only". `tests/probe_substitute_family.js` exits NOT RUN the
day either fact stops holding, so the loop-nesting question re-opens itself rather than waiting to be remembered.

**The receipt.** The brief named `tests/test-resolution-order.js`'s "declared KNOWN-OPEN arm" closing. There is no such arm:
`a1-multihit-frequency` was promoted from `known-open` to `red` on 2026-08-30 (the file's own comment at the arm) and already reads
RED PROVEN; the run prints `0 of them KNOWN-OPEN`. The file is 26/26 before and after this batch with every anchor CAUGHT. The
receipt is the new probe (§3): five arms RED on release `7d66b526659e`, green on the live tree, each PARTING again under the knob at
the card's own line.

**And the prediction missed by one on every narration count**, for a reason worth more than the miss: the fourth card's game did
not STOP — it played past the substitute line and parted two lines later on a Shed Tail `-fail` this engine writes bare (§6). Three
stopped, zero started, one CHANGED CAUSE.

---

## 1. THE SAMPLE, EVERY FLAG AND EVERY PIN

Identical to batch Y's; only `--release` and the census pin move.

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
  tools\lownode.cmd engine\game_differential.js --steering empirical --release 489bea0577bc --arm middle --end-state --state
    --games 1200 --team-store data/team-pool-frozen --turns 50 --census data/verification/census-pin-1da84d77888e.json
    --dump-games 60 --dump-out <scratchpad, via a repo-relative ../../../ path> --write
```

| pin | before (batch Y) | after (this batch) |
|---|---|---|
| release | `7d66b526659e` | `489bea0577bc` (first frozen 2026-09-10; the live-tree probe runs reported the same id, identical bytes give an identical id) |
| census pin | `census-pin-c716f46ab0a7.json` | `census-pin-1da84d77888e.json` — a copy of the 835-row census this tree regenerated at 02:07Z; digest of the bytes the run read |
| team pool | `data/team-pool-frozen` | same |
| `--games` / `--turns` | 1200 / 50 | same |
| steering / arm | empirical / middle | same |

Authority checkout `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4` = `PINNED_COMMIT`, checked before the cut. The dump went to the session
scratchpad through a repo-relative path (`D(DUMP_OUT)` is `path.join(__dirname, '..', …)`, so `../../../AppData/…` resolves; an
absolute path does not — batch Y's finding).

---

## 2. THE LOOP, BEFORE AND AFTER, AGAINST THE AUTHORITY

### The authority (`data/mods/champions/scripts.ts`, which overrides `spreadMoveHit`; `substitute` is not overridden)

```
:343-347   // 0. check for substitute   damage = this.tryPrimaryHitEvent(damage, targets, pokemon, move, moveData, isSecondary);
:351-354   if (damage[i] === this.battle.HIT_SUBSTITUTE) { damage[i] = true; targets[i] = null; }
:360-361   // 1. call to this.battle.getDamage   damage = this.getSpreadDamage(damage, targets, ...)   (`-supereffective` :271, `-resisted` :278, `-crit` :285)
:367-368   // 2. call to this.battle.spreadDamage damage = this.battle.spreadDamage(damage, targets, pokemon, move);   (`-damage`)
:385-388   // 4. self drops   // 5. secondaries
```

and the doll's handler, `data/moves.ts:18335-18365` (`substitute.condition.onTryPrimaryHit`): `let damage = this.actions.getDamage(source,
target, move)` — so the doll row's own effectiveness and crit lines are STEP 0 lines — then the clamp to the doll's hp, then
`-activate|…|[damage]` or `removeVolatile` (`-end`), then that arrival's `applyRecoilDamage` and drain. Every step is walked over
every target before the next step begins; within an arrival the separation is BETWEEN STEPS, not between rows.

### This engine, before

```
_STEPS = [ …gates…, _stepDamage, _stepApply, _stepSelfPay, _stepEffects, … ]        walked step-outer / row-inner

_stepDamage(R):   price the row (all arrivals, all dice)  →  for a SINGLE-PACKET row write TR.eff / TR.crit HERE, spend the
                  resist berry HERE, write the Unseen Fist `-ability` HERE                                   ← step-1 writes
_stepApply(R):    damageCallback KO → dealt/_rowDealt → if(subBlocks(...)){ per-arrival doll loop: clamp, -activate/-end;
                  break-through → R.pkFrom; eaten → R.out=true; return }  → Disguise → Endure → Sash → packet loop (-damage …)
                                                                                                             ← the doll at step 2
```

Stream for a spread hit into [body (resists), doll]: `-resisted|body`, `(doll's eff)`, `-damage|body`, `-end|doll`.

### This engine, after

```
_STEPS = [ …gates…, _stepDamage, _stepSubAbsorb, _stepPriceLines, _stepApply, _stepSelfPay, _stepEffects, … ]

_stepDamage(R):     price the row exactly as before; BUILD `R._priceLines` (eff/crit for a single-packet row, the berry's spend,
                    the pierce `-ability`) and write nothing.  Under the knob: run it inline (the old order).
_stepSubAbsorb(R):  if(!subBlocks(m,tg,a.move.id))return;   ← STEP 0, over every row, before any row's step-1 line
                    _damageCallbackKO(); run R._priceLines (the doll row's OWN step-0 lines); connected=true;
                    the per-arrival doll loop, unchanged from batch V, PLUS TR.eff/TR.crit per doll arrival (R.effShow, R.crits[i]);
                    break-through → R._dollPaid, R.pkFrom, R.first, R.dmg;  eaten → dealt += doll's share, drain, R.out=true
_stepPriceLines(R): run R._priceLines for every row still live       ← STEP 1's writes
_stepApply(R):      const _dollPaid=(R._dollPaid|0); dealt += min(dmg,curHP)+_dollPaid; … everything else byte-identical
```

Stream for the same hit: `(doll's eff)`, `-end|doll`, `-resisted|body`, `-damage|body` — the authority's.

**What did not move.** No die: every crit and damage index is drawn in `_stepDamage` at the doll's lingering address before the new
step runs, as before. The DECISIONS in `_stepDamage` (which berry, against which type, whether Protect was pierced, the quarter
itself) stay where they were; only the WRITES moved one step down. `_dealtEach` has no readers (write-only since ROADMAP #339) and
keeps one entry per priced row. The `selfko-below-the-target` plant in `test-resolution-order.js` quotes the four-line
damageCallback block, so that block is kept byte-identical inside `_damageCallbackKO` (one function, two callers) and the plant still
matches. The `_smartRowMajor` segment is looked up by `indexOf`, so the two new steps fall inside it and Dragon Darts stays row-major.

**Knob.** `MEDI_SUB_ABSORB_AT_APPLY=1`: `_STEPS` carries neither new step, `_stepApply` calls `_stepSubAbsorb` at its head, `_stepDamage`
writes its lines inline, the per-doll-arrival lines are suppressed — the pre-batch stream byte for byte. Stamps
`MEDFAILS.subAbsorbAtApplyRestored` at LOAD.

**New counters.** `MEDSEEN.subAbsorbAtStepZero` (rows absorbed at step 0; not incremented under the knob), `subVolleyDollArrivalLines`
(doll arrivals of a volley that wrote a line), `priceLinesDeferred`.

---

## 3. THE PROBE — `tests/probe_substitute_family.js`

Harness: `probe_damaginghit_walk.js`'s pattern — both engines play a directed one-turn script under the differential's `middle` pin
and the pass is that the streams do not part. Nothing typed: every species/move/ability is checked legal and on-learnset; the
step numbering, the doll handler's own `getDamage`, the "no multi-hit spread move" fact and Parental Bond's `spreadHit` refusal are
derived on every run. A build with no `subAbsorbAtApplyRestored` field is treated as PRE-FIX BYTES and the knob legs are not asked.

| arm | fixture | on `7d66b526659e` (pre-fix) | live, clean | live, knob |
|---|---|---|---|---|
| `spread-doll-at-index-1-body-resists-at-index-0` | Clefable Dazzling Gleam → Toxapex (resists, row 0) + Dragapult doll (row 1) | PARTS: `-supereffective\|p2b` vs `-resisted\|p2a` | AGREE | PARTS at the same line |
| `spread-doll-at-index-0-body-resists-at-index-1` | rows swapped | PARTS: `-end\|p2a` vs `-resisted\|p2b` | AGREE | PARTS |
| `spread-doll-on-the-attackers-own-ally` (card 1) | Garchomp Earthquake, Dragapult ally doll, Sinistcha resists | PARTS: `-end\|p1b` vs `-resisted\|p2a` | AGREE | PARTS |
| `spread-with-a-secondary-doll-at-index-1` | Garchomp Bulldoze (100% spe drop) | PARTS: `-end\|p2b` vs `-supereffective\|p1b` | AGREE | PARTS |
| `volley-into-a-doll-supereffective` (the latent half) | Farigiraf Twin Beam → Sneasler doll | PARTS: `-supereffective\|p2a` vs `-end\|p2a` | AGREE, `subVolleyDollArrivalLines 1` | PARTS |
| `spread-no-doll-control` | the first arm, Dragapult clicks Agility | AGREE | AGREE, `subAbsorbAtStepZero 0` | AGREE |
| `volley-through-a-broken-doll-control` (batch V's shape) | Farigiraf Twin Beam → Dragapult doll, neutral | AGREE | AGREE | AGREE |

Pre-fix run: `7 arms staged, 0 failing [release 7d66b526659e, PRE-FIX BYTES] RED`. Live: `7 arms staged, 0 failing [release 489bea0577bc]
PASS` — 5 RED PROVEN, 2 CONTROL HELD.

**The probe was wrong before the engine was, twice, both recorded in the file's history here:** (1) the step-0 counter was asserted
0 under the knob but the knob calls the same step from `_stepApply`, so the engine now increments it only when not under the knob;
(2) the line counter treated a neutral `effShow` of 1 as a line (`TR.eff` writes nothing at 1), so it counts `effShow>0 && !==1 || crit`.
One engine error found by the probe: the first cut's `R._priceLines` read `_multiPk`, which is scoped inside the crit block — every
arm THREW `_multiPk is not defined` on the first live run; hoisted as `_multiPkRow`.

---

## 4. THE OTHER INSTRUMENTS ON THE FINAL BYTES

| instrument | result |
|---|---|
| `tests/test-mechanics.js` (census, regenerated, `lownode`) | **835 probed, 835 live, 0 MISSING, 0 unarmed** — unchanged; no row pinned the old order |
| `tests/test-resolution-order.js` (heap 6144) | **26 arms, 0 KNOWN-OPEN, 0 failing — PASS**; every plant CAUGHT (the `selfko-below-the-target` plant still matches inside `_damageCallbackKO`) |
| `tests/probe_red_demo.js` | first run: every demo THREW on `_multiPk` (§3); WIRE 130's anchor re-aimed to the new step's condition line (`if(!subBlocks(m,tg,a.move.id))return;` → `if(!(tg._sub>0))return;`). Final: **200 demonstrations, 0 HOLLOW, 0 COULD NOT BE APPLIED, 2 not in this format — VERDICT-GREEN** |
| `tests/probe_multihit_through_doll.js` | ALL CLAUSES PASS; under `MEDI_VOLLEY_STOPS_AT_DOLL=1` 9 failing (unchanged) |
| `tests/probe_sub_clamp.js`, `probe_multihit_update.js`, `probe_drain_per_arrival.js`, `probe_bond_arrival_reprice.js`, `probe_volley_collapse.js` | all green |
| `tests/test-engine-consistency.js`, `tests/test-counter-init.js` | all checks passed; 4/0 |

---

## 5. THE CHAIN, ON ONE RELEASE — `489bea0577bc`

Every step via `MSYS_NO_PATHCONV=1 cmd /c <scratch>\run_chainZ.cmd`, which calls `tools\lownode.cmd` per step, one at a time; logs
`chainZ-*.log` in the session scratchpad; success judged by the artifact stamps (all `2026-09-10T02:1x` on release `489bea0577bc`).

| step | command | result |
|---|---|---|
| census | `tests\test-mechanics.js` | 835 / 835 / 0 missing; wrote `data/mechanics-census.json` (02:07:00Z) |
| (a) | `tests\test-engine-diff.js --n 6000 --seed 20260804` | **6000 compared / 6000 agreed / 0 disagreed**, both corners |
| (b) | `tests\roster.js --stage items/abilities/moves --reds --write --release 489bea0577bc` | **142 / 139 / 487 MATCH, 0 DIFFER, 0 DID-NOT-FIRE**; 14 CONTROL-NOT-QUIET, 5+3 DEFERRED, 6/158/10 COULD-NOT-STAGE — identical to batch Y |
| (c) | `engine\all_mechanics_fire.js --kind all --write --release 489bea0577bc --census <pin>` | **1313 games, 0 threw, 0 unassembled**; `summary` identical to HEAD's field for field except `seconds`; moves STATE 4 / ANNOUNCEMENT-ONLY 4 / NO-DIVERGENCE 488, abilities ANNOUNCEMENT-ONLY 2 / NO-DIVERGENCE 168, items NO-DIVERGENCE 73 |
| (d) | `engine\game_differential.js …` (§1) | **961 played / 0 void; BOARD-MATERIAL 0 of 961; NARRATION-ONLY 7 causes / 7 games, all SAME END STATE; protocol agreed 954/961; THREW 1** (the pre-existing harness case, `p1 "move 4, move 1": Can't move: Floette's Protect is disabled`, at 1 before too); dump 7 of 7 |
| (e) | `engine\status.js` (read-only) | the two clause lines below |

```
PASS  whole-game differential / BOARD-MATERIAL — games whose boards part BOARD-MATERIAL: 0 of 961 games. Every
      compared turn boundary in every game holds the SAME BOARD on both engines.
FAIL  whole-game differential / NARRATION — protocol divergence with no board effect NARRATION-ONLY: 6 of 961 =
      0.6% of games diverge in NARRATION and never part a board (7 narration-only raw, less 1 declared).
MEDICHAM is not correct — 1 of 9 gate clauses fail (whole-game differential / NARRATION — protocol divergence with no board effect)
```

**THE FOUR CARDS' OWN GAMES** — `first_divergences` before (HEAD's artifact, release `7d66b526659e`, 10 of 10) against after
(`489bea0577bc`, 7 of 7; both uncapped at these sizes), keyed on config + seed:

| | |
|---|---|
| STOPPED | **3** — `omit-protect …2655715488` (Earthquake), `pair-protect-bust …2653957635` (Rock Slide, `-damage\|0 fnt`), `pair-protect-bust …2654266369` (Matcha Gotcha) |
| STARTED | **0** |
| CAUSE CHANGED | **1** — `pair-speedctrl …2654408616 vs …2654492165` t2: `ordering :: -end\|p1b\|substitute <> -resisted\|p1a\|1` → `-fail field 3 :: \|-fail\|p1a\|shedtail\|[weak] <> \|-fail\|p1a` (§6) |
| the 7 that remain | Shed Tail `[weak]` (new), the residual trio (brn, psn, leftovers), the perish `\|upkeep\|` (closeted), Sucker Punch / Psychic Terrain, Lightning Rod / `-prepare` |

---

## 6. THE CARD THAT CHANGED CAUSE — SHED TAIL'S `[weak]`

The dump, `pair-speedctrl …2654408616`, turn 2, both streams now agreeing through the substitute lines:

```
agreed    |move|p2a: Tyranitar|rockslide|p1a: Orthworm   |-end|p1b: Sinistcha|Substitute   |-resisted|p1a: Orthworm|1
          |-damage|p1a: Orthworm|54/145   |move|p1a: Orthworm|shedtail|p1a: Orthworm
showdown  |-fail|p1a: Orthworm|move: Shed Tail|[weak]
medicham2 |-fail|p1a: Orthworm
```

Authority, `data/moves.ts:16156-16182` (`shedtail`, no Champions override — `grep shedtail data/mods/champions/moves.ts` → 0),
`onTryHit(source)`: no ally to switch to → `this.add('-fail', source)` (bare, :16168); already behind a substitute →
`this.add('-fail', source, 'move: Shed Tail')` (:16172); `source.hp <= Math.ceil(source.maxhp / 2)` →
`this.add('-fail', source, 'move: Shed Tail', '[weak]')` (:16176). Orthworm stood on 54/145 after the Rock Slide, so the third arm.
This engine writes the bare form for the third. **Not fixed here — the brief is the substitute family and nothing else.** It is on
the hand list with its line numbers; same shape as batch S's `-fail names the move` family (`tests/probe_fail_names_the_move.js`).

---

## 7. PREDICTION VS RESULT

`data/verification/_prediction-2026-09-10-batch-Z.json`, written before the cut.

| clause | predicted | measured |
|---|---|---|
| games played | 961 | **961** |
| void | 0 (0-1) | **0** |
| BOARD-MATERIAL | 0 (0-1) | **0 of 961** |
| NARRATION-ONLY raw | 6 (5-7) | **7** — in range, off the point |
| NARRATION clause | 5 (4-6) | **6** — in range, off the point |
| causes | 6 (5-7) | **7** — in range, off the point |
| pool moves by exactly the four games | 4 stopped / 0 started / 0 changed | **3 stopped / 0 started / 1 CHANGED** — the miss, §6 |
| census | 835 / 0 missing, must not go down | **835 / 0** |
| roster | 0 DIFFER / 0 DID-NOT-FIRE, 142/139/487 | **0 / 0, 142/139/487** |
| engine-diff | 6000 / 0 | **6000 / 0** |
| all-mechanics-fire threw | 0 | **0** |

The point estimates on the three narration counts assumed a fixed game STOPS; one game instead surfaced its next card. The
scoreboards behaved as named before the run: the POOL moved (by the four cards), the LAB did not (census, roster and
all-mechanics-fire field for field).

---

## 8. DEBRIS AND STATE OF THE TREE

**Nothing was deleted by this batch.** Nothing under `engine/quarantine.js`, `engine/status.js`, `engine/docs_scan.js`,
`engine/engine_release.js`, `build/`, `.github/`, `tests/roster.js`, `tests/test-mechanics.js`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md`
or `docs/ROADMAP.md` was touched.

- New, mine: `tests/probe_substitute_family.js`, `data/verification/census-pin-1da84d77888e.json`,
  `data/verification/_prediction-2026-09-10-batch-Z.json`, this report.
- Edited, mine: `engine/medicham2-browser.js`, `tests/probe_red_demo.js` (one anchor re-aimed, RE-AIMED note in the file),
  `docs/ENGINE.md` (one section, outside the generated block; `status.js --write` restamped the block).
- Rewritten by the runs: `data/mechanics-census.json`, `data/engine-diff.json`, `data/published-samples.json`,
  `data/roster.{items,abilities,moves}.json` + `.prev.json`, `data/roster.json`, `data/all-mechanics-fire.json`,
  `data/game-differential.json`, `data/engine-release.json`, `data/provenance-stamp.json` (status.js writes it);
  `node engine/status.js --write` restamped the generated blocks of `docs/ENGINE.md`, `docs/MEASURE.md`, `docs/OPS.md`,
  `docs/SEARCH.md`, `docs/WEB.md` (`_stamped 2026-09-09 22:27` local = 02:27Z); `node tests/test-docs-current.js` (35/35,
  run to check the new ledger section) tightened the ratchet in `data/docs-currency-baseline.json` — its own output says
  that belongs in the same commit.
- Other agents' untracked files that appeared during the batch, not mine: `docs/_reports/2026-09-10-fixture-legality-batch2.md`,
  `tests/probe_residual_trio_handlerless_body.js`, `tests/probe_residual_trio_lower_order_handler.js`.
- **Other agents' uncommitted work in the same tree, not mine, not touched:** `git status` lists ~26 modified files under `tests/`
  (`probe_ally_forced_switch.js`, `probe_choicelock_cleared.js`, … `test-effect-credit.js`, `test-encore-fail-silent.js`,
  `test-imposter-transform-line.js`, and `tests/test-resolution-order.js`, which I ran but did not edit). They are CONTENT
  changes, not line-ending churn: `git diff --ignore-cr-at-eol --stat -- tests/` reads 26 files, +334 / -273, with 49 changed
  lines in `test-resolution-order.js` alone. The 26/26 PASS reported in §4 is therefore that file AS IT STOOD IN THE TREE at run
  time, not HEAD's copy. HEAD moved from `bf4ff432` to `48b26d01` during the batch; nothing here read the working tree for a
  measurement — every run is release-pinned.
- Scratch under the session scratchpad: `edit_batchZ.py` (the scripted edit, exact-once anchors), `run_chainZ.cmd`, `chainZ-*.log`,
  `dumpZ-after.json` (7 games).
- `data/releases/489bea0577bc/` — gitignored; batch Y tracked its release with `git add -f`; the same is owed here.

---

## 9. PROPOSED ROWS (NOT APPLIED)

**RUNNING-NOTES row (ENGINE).** What changed: the substitute family closed in `engine/medicham2-browser.js` — the doll is absorbed at
step 0 of `spreadMoveHit` over every row (`_stepSubAbsorb`, moved out of `_stepApply`), the step-1 lines are written by
`_stepPriceLines` below it, and each doll arrival of a volley writes its own effectiveness/crit line; knob
`MEDI_SUB_ABSORB_AT_APPLY=1`. Measured: release `489bea0577bc`, pins `--steering empirical --arm middle --end-state --state --games 1200
--turns 50 --team-store data/team-pool-frozen --census data/verification/census-pin-1da84d77888e.json`: 961 played / 0 void /
**BOARD-MATERIAL 0 of 961** / **NARRATION-ONLY 7 raw, clause 6 of 961, 7 causes**; 3 cards' games stopped, 0 started, 1 changed cause
(Shed Tail `[weak]`); `test-engine-diff` 6000/6000/0; roster 142/139/487, 0 DIFFER / 0 DID-NOT-FIRE; `all_mechanics_fire` 1313 / 0 threw;
census 835 / 835 / 0 missing. Supersedes: `NARRATION-ONLY 10 raw / clause 9 of 961 / 10 causes` on `7d66b526659e`. **Basis.** unchanged.
Owes: the Shed Tail `-fail` line (one cause, `data/moves.ts:16166-16177`).

**CHANGELOG (MINOR) bullets.** Fixed: a Substitute on one row of a spread hit was absorbed at step 2, after every other row's
effectiveness line and `-damage`; it is absorbed at step 0 over every row, and every doll arrival of a volley writes its own
effectiveness and crit line. Changed: gate artifacts re-measured on `489bea0577bc` — BOARD-MATERIAL 0 of 961 with 0 void,
NARRATION-ONLY 7 raw / clause 6 of 961 across 7 causes (was 10 / 9 / 10); 8 of 9 clauses PASS. Notes: batch X's loop-nesting plan
is retired — no legal move is multi-hit and multi-target, and Parental Bond refuses `spreadHit`; `tests/probe_substitute_family.js`
derives both on every run.

**ROADMAP rows (proposed).** (1) Shed Tail's `onTryHit` refusals: `[weak]` and `move: Shed Tail` forms are written bare —
`data/moves.ts:16166-16177`; one narration cause on the pinned pool. (2) `tests/test-mechanics.js`'s `DELIBERATE_BREAK` list should
name `subAbsorbAtApplyRestored` so a census run under the new knob refuses to write, as it does for every other restore knob; the
file was not mine this wave. (3) Batch X's "loop-nesting job" and batch Y's "the most dangerous edit available" rows: close as
NOT NEEDED with the derivation in §0. (4) Batch V's "declared remainder" that a resist berry is spent on a doll arrival is wrong:
`chopleberry.onSourceModifyDamage` (and the family) returns on `hitSub` before `eatItem()`, so the engine's `!subBlocks` guard is
the authority's rule, not a gap — correct the sentence where it is carried.

---

## OWED, NOT RUN

- Commit: everything under §8 "New, mine" and "Edited, mine", plus the re-measured artifacts and the census pin — sole publisher's
  job; `git add -f data/releases/489bea0577bc` if the artifacts are to cite an openable snapshot.
- The RUNNING-NOTES row, CHANGELOG bullets and ROADMAP rows above.
- The Shed Tail `-fail` line (§6) — the next narration card, not this batch's.
- Nothing in the chain was cut short.
