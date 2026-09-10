# NARRATION BATCH Y — FOUR CAUSES CLOSED, EACH SHOWN RED ON THE PRE-FIX BYTES FIRST; THE CENSUS WENT 835 → 834 BECAUSE ONE PROBE PINS A RULE THE AUTHORITY REFUTES, AND THAT FILE IS NOT MINE THIS WAVE

ENGINE. Written as the work happened; the measurement block and the verdict are the last things added.
Historical by construction; superseded by the register rows it feeds. **No commits were made.** Nothing in
`docs/RUNNING-NOTES.md`, `CHANGELOG.md`, `docs/ROADMAP.md` or a living document was edited; proposed rows are at
the end. `docs/ENGINE.md` gained one section (the hand list), as the brief requires.

---

## 0. READ THIS FIRST — THE ONE NUMBER THAT WENT DOWN, AND WHY IT IS NOT THE ENGINE

`node tests/test-mechanics.js` on the fixed tree: **835 probed, 834 live, 1 MISSING** (it read 835/835 before this
batch — 830 at HEAD `71771f0b` plus another agent's five uncommitted screen probes).

The missing row is `move/trickSwapsItems` (`tests/test-mechanics.js:15571`), whose third arm stages a **Gengarite
on a Milotic** and asserts that Trick "moves nothing". The authority's stone handler is

```
onTakeItem(item, source) { return !item.megaStone?.[source.baseSpecies.baseSpecies]; }     data/items.ts (every stone; Champions inherits)
```

— a Gengarite refuses a GENGAR and nobody else. A Gengarite on a Milotic is Tricked away like any other item, and
`tests/probe_trick_refusal.js` shows the authority doing exactly that (`trick-of-a-foreign-stone-into-another-species`:
a Metagrossite on a Rotom-Heat swaps into a Hydreigon, `|-activate|…|move: Trick` on the authority's stream, and the
pre-fix engine parts there by refusing in silence). **The probe pins the engine's old coarse guard, not the game** —
the same shape batch U found (`docs/_reports/2026-09-09-narration-batch-U.md`, "a census probe was asserting the bug").

`tests/test-mechanics.js` is owned by another agent this wave (the brief: do not touch). The one-line fix for its
owner: in the `stone` arm, put the Gengarite on a Gengar —

```
-    const stone = stage('quickclaw', 'gengarite', 'trick');            // f1 is bare('milotic')
+    // the stone arm needs the body the stone BELONGS TO: bare('gengar') holding gengarite
```

(the `stage` helper builds `f1 = bare('milotic')`; give it a species parameter, or build the third arm with
`bare('gengar')`). `tests/probe_red_demo.js`'s `WIRE 111 megaStone` demonstration had the identical Milotic fixture
and IS mine: re-aimed to a Gengar, and the file is green again (§4). **Until the census probe is re-aimed the
mechanics count reads 834 live / 1 missing, and I am saying so here rather than editing a file I was told not to.**

---

## 1. THE SAMPLE, EVERY FLAG AND EVERY PIN

Identical before and after; only `--release` and the census pin move.

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
  tools\lownode.cmd engine\game_differential.js --steering empirical --release <id> --arm middle --end-state --state
    --games 1200 --team-store data/team-pool-frozen --turns 50 --census data/verification/census-pin-<digest>.json --write
```

| pin | before | after |
|---|---|---|
| release | `b0f5c159c46e` | `7d66b526659e` |
| census pin | `census-pin-098de5770623.json` (HEAD's 830 rows) | `census-pin-c716f46ab0a7.json` (the LIVE 835-row census this tree regenerates; HEAD's is 830 rows and no longer equals the tree, so the pin is the bytes the run reads) |
| team pool | `data/team-pool-frozen`, digest `f807cbc40299` (8778 teams) | same |
| `--games` / `--turns` | 1200 / 50 | same |
| steering | empirical (the census is CREDITED ONLY) | same |

Authority checkout `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4` = `PINNED_COMMIT` (`engine/champions_sim.js:85`), checked before the cut.

---

## 2. THE FOUR CAUSES CLOSED — CARD, AUTHORITY LINE, FIX, PROBE, KNOB

Every card below was first REPLAYED whole with `engine/replay_one.js` on `b0f5c159c46e` (`--steering empirical
--games 1200 --arm middle --turns 50 --end-state --team-store data/team-pool-frozen`), and every probe was run
TWICE: `--release b0f5c159c46e` (the pre-fix bytes — the red arm must part on the CLEAN load, line for line the
card) and then on the live tree (must PASS, the knob must put the red arm apart again, controls must hold under both).

### 2a. FUTURE SIGHT INTO AN IMMUNE COLLECTOR — `omit-spread …2657358877 vs …2657413811`, t5

```
event missing from medicham2 :: |-end|p2a|futuresight <> |-sideend|p1:|reflect
  showdown   |-end|p2a: Morpeko|move: Future Sight   |-immune|p2a: Morpeko
  medicham2  (nothing)
```

**Authority.** `futuremove.onEnd` (`data/conditions.ts:395-415`, no Champions override): after the fainted/user
check, `this.add('-end', target, 'move: ' + move.name)` UNCONDITIONALLY, then `trySpreadMoveHit([target], source,
hitMove, true)`; the booked `moveData` carries `ignoreImmunity: false` (`data/moves.ts:6408`), so step 2
`hitStepTypeImmunity` (`sim/battle-actions.ts:654`) → `runImmunity(move, true)` writes `|-immune|` and returns false;
`getDamage` is never reached, no die.

**Engine.** The payout priced first, drew crit and dmg, and wrote `-end` INSIDE `if(_d.max>0)` — into a Dark type
that was two dice the authority never drew (the ex-void game's identity loss) and two lines it wrote. Fix in
`condition:futuremove`'s residual: `-end` hoisted above the pricing; `typeEffAgainst(...)===0` (the SAME predicate
`_stepTypeImm` asks, with the same Levitate attribution) → `-immune`, `MEDSEEN.delayedHitImmune++`, no die; the
old `-end` site fires only under the knob; a zero band on a non-immune body is now counted LOUDLY
(`MEDFAILS.delayedHitZeroBandUnannounced`). Knob `MEDI_DELAYED_HIT_SILENT_IMMUNE=1`, stamped at LOAD.

**Probe** `tests/probe_delayed_hit_immune.js` — 3 arms. Pre-fix: the red arm parts on the clean load at
`|-end|p2a: Umbreon|move: Future Sight` vs `|upkeep`, `delayedHitCritDrawn 1` (the second half of the defect). Live:
RED PROVEN (`delayedHitImmune 1/1`, `delayedHitCritDrawn 0/0` clean, `1/1` knob), neutral-collector CONTROL HELD
(payout lands, `-end` written once, crit drawn), direct-Psychic-into-Dark CONTROL HELD.

**Observed and NOT fixed, with a number:** the authority's payout runs `hitStepAccuracy` on a printed 100 and DRAWS
(`randomChance(100,100)`); this engine's payout takes no `acc` draw — the neutral arm prints
`acc|futuresight` addresses **showdown 1, medicham 0**. A die-count gap on every landing payout, tolerated by the
identity floor. Named in the engine comment, not folded in.

### 2b. TRICK REFUSED BY `onHit` — `pair-protect-bust …2654619049 vs …2654751965`, t4

```
event missing from medicham2 :: |-fail|p2a <> |move|p2b|rockslide
  showdown   |move|p2a: Rotom|Trick||[still]   |-fail|p2a: Rotom
  medicham2  |move|p2a: Rotom|trick|p1a: Metagross   (nothing)
```

The replay shows the target: a **Metagross-Mega holding its own Metagrossite**.

**Authority.** `trick.onHit` (`data/moves.ts`; Champions overrides Trick nowhere and every stone only by
`inherit: true`): `yourItem === false || myItem === false || (!yourItem && !myItem)` → `return false`; then the
RECEIVER's `singleEvent('TakeItem', myItem, …, target, …)` → `return false`. `Pokemon#takeItem` is false exactly
when `runEvent('TakeItem')` refuses, and every mega stone's handler is `return !item.megaStone?.[source.baseSpecies
.baseSpecies]`. A false out of `moveHit` is `|-fail|SOURCE` + `attrLastMove('[still]')`, which BLANKS the `|move|`
line's target (`sim/battle.ts:3120-3134`).

**Engine.** `TAGS.has('item', …, 'megaStone')` on EITHER body → silent `continue` (the item CLASS, not the body's
claim); two empty hands fell through to `-activate`. Fix: `itemRefusesTake` (the fine rule Knock Off, Thief and
Pickpocket already ask) refactored over a shared `stoneRefusesBody(item, body)` so the RECEIVER can be asked too;
refusal = holder's own stone on either side, `refusesItemLoss`, both hands empty, or the receiver's species
refusing → `TR.attrStill(); TR.fail(m)`, `MEDSEEN.swapRefusedAnnounced++`. Knob `MEDI_TRICK_REFUSAL_SILENT=1`.

**Probe** `tests/probe_trick_refusal.js` — 6 arms. Pre-fix: FIVE arms part on the clean load (the card:
`|-fail|p1a: Rotom` vs the partner's next move; the foreign-stone arm the OTHER way round — the authority writes
`-activate` and the engine refused). Live: 5 RED PROVEN, `trick-scarf-for-leftovers` CONTROL HELD. **The probe was
wrong before the engine was, twice, and both are recorded in the file:** it asserted `stone.megaEvolves`, a field
this checkout no longer carries (the shape is `megaStone: { Metagross: "Metagross-Mega" }`), and on that wrong read
it declared the `myItem === false` arm unreachable — Metagross learns Trick; the arm is staged.

### 2c. THE REPLACEMENT QUEUE'S TIE — `pair-protect-bust …2635037737 vs …2635936827`, t4

```
ordering :: |switch|p2a|archaludon,l50|H/H <> |switch|p1a|gholdengo,l50|H/H
```

The replay (Swampert p2a, Swampert-Mega p1a and Annihilape p2b faint in one turn) run through the differential's own
driver read **`MEDFAILS.replaceOrderTie = 1`**: the two Swampert corpses tie on raw Speed. Batch X's lead ("the sort
key is the FAINTED body's Speed") was already the engine's key — `_corpseSpe` reads `m.st.sp` since 2026-08-27 —
so the card was never the KEY. It was the SORT.

**Authority.** `Side#chooseSwitch` queues `{choice: 'instaswitch', pokemon: <corpse>, target: <entrant>}` per empty
slot, p1's then p2's (`sim/side.ts:1009`); `getActionSpeed` writes the corpse's `getActionSpeed()` (`sim/battle.ts:
2657`; the corpse is `isActive = false` after `faintMessages`, so no handler is collected and `storedStats.spe` is
the number); then ONE `speedSort` (`sim/battle.ts:429-459`) — a SELECTION sort whose first pass swaps the fastest
action to the front, and on this card that swap (`list[0] <-> list[2]`) carries p1a's action behind p2a's before the
tied pair is ever resolved. A stable sort cannot produce that permutation from any comparator (WIRE 134's finding,
one queue over).

**Engine.** `_refills.sort(compareTurnOrder)` — `Array.prototype.sort`, stable, no die. Fix: `entrySpeedSort(_refills,
field)`, the selection sort with the tie die the entry pass has used for the SwitchIn ranking since 2026-08-24 —
one implementation, two callers. `MEDSEEN.replaceTieResolved` counts a tied refill; `MEDFAILS.replaceOrderTie`
increments only under the knob now. Knob `MEDI_REPLACE_ORDER_STABLE=1`.

**Probe** `tests/probe_replacement_tie.js` — 2 arms. **Two fixture errors, both recorded in the file:** a TWO-corpse
tie does not separate the sorts (no swap crosses the pair — both loads agreed), so the fixture is three Mementos with
a faster third corpse on p2's side; and the second Memento's target had to be made deterministic (a Choice Scarf on
p1a decides the move-order tie; the corpse's raw Speed ignores the Scarf) or the tie staged only half the time.
Pre-fix: the red arm parts on the clean load at `|switch|p2a: Froslass` vs `|switch|p1a: Milotic` — the card's shape.
Live: RED PROVEN (`replaceTieResolved 1/1`), untied CONTROL HELD.

### 2d. `DamagingHit` WALKED IN THE AUTHORITY'S SORT ORDER — `baseline …2634643227 vs …2635701832`, t2

```
ordering :: |-boost|p1a|def|1 <> |-status|p2b|brn|[from]spicyspray
```

**Authority.** One `runEvent('DamagingHit', damagedTargets, …)`; `findEventHandlers` over the ARRAY tags each
target's handlers with `index = i` (`sim/battle.ts:1035-1047`; per body: status, volatiles, ability, item, then the
source's `onSource…`) and sorts ONCE by `compareLeftToRightOrder` (`:789 → :421`): `onDamagingHitOrder` ASC with an
undeclared order LAST, then priority DESC, then TARGET INDEX ASC. **Deterministic — no speed, no die.** Stamina and
Spicy Spray both leave `order` undeclared, so the index decides. Electromorphosis declares 1 (`data/abilities.ts:
1179`), so it runs before every undeclared handler regardless of index.

**Engine.** Four step-major steps — [every row's punish], [thaw], [buff], [late pair] — so a buff on row 0 landed
below a punish on row 1. Batch X had deferred this on "`speedSort`ed together … reorders draws at a shared address";
**the premise was false and both sentences in `_stepBuffOnHit`'s header are corrected in place** (kept as dated
evidence, correction beside), as is the `_stepDamagingHitLate` header's claim that `electromorphosis` lives in
`_stepDamagingHit` (it is `buffsHolderOnHit`; the six-member list was derived over the unfiltered table — filtered,
the order-1 members are aftermath, innardsout, roughskin and electromorphosis; ironbarbs and windpower have no legal
carrier).

Fix in two parts. **The tag learned the number** — `engine/tag_dex.js` now derives `order` on `punishesAttacker`
and `buffsHolderOnHit` from the handler's own `onDamagingHitOrder`; membership printed before wiring:
`aftermath 1, innardsout 1, roughskin 1, electromorphosis 1`, everything else `null`. `data/tags.json` regenerated:
**params/tags diff vs HEAD = 0 rows besides the new field** (checked with a params-only comparison; the
usage-derived fields — `uses`, `sheet_entries`, `examples` — move because the store moved, a regeneration with NO
code change produces the same 2,218-line structural diff). `data/abra-tags.js` rebuilt, `--check` clean. **The walk
became two steps** — `_stepDamagingHitEarly` (every row's order-1 handler) then `_stepDamagingHitBody` (per row:
thaw → ability punish or buff → `_dhAbil` → `_dhSrc`); the four old payers are kept and called from there, the
per-arrival interior calls inside `_stepApply` are untouched, `R._buffDone` stops a double payment. Knob
`MEDI_DH_STEPS_SPLIT=1` restores the four-step list exactly (a spread inside the `_STEPS` literal).

**Probe** `tests/probe_damaginghit_walk.js` — 3 arms (batch Q2's `probe_damaginghit_order.js` owns the STEP the event
runs at and is untouched and still green; this file owns the walk within it). **Two fixture errors, recorded:** the
card's own Muddy Water is 85 and its second arrival MISSED on both engines under the pin, so no second reactor ever
fired — the attacker clicks Dazzling Gleam (100, foes only, no contact, derived); and the inert-reactor control
declared `dhOrder1Early 0` and measured 1, because Rough Skin declares order 1 so its handler IS collected and runs
early and then refuses on contact — the counter counts handlers run, not tolls paid. Pre-fix: BOTH red arms part on
the clean load — the card line for line (`|-boost|p2a: Archaludon|def|1` vs `|-status|p1a: Clefable|brn|[from]
ability: spicyspray`) and the order-1 half (`|-start|p2b: Bellibolt|Charge|…Electromorphosis` vs the Stamina boost).
Live: 2 RED PROVEN, CONTROL HELD. Scovillain must be MEGA to carry Spicy Spray (the only legal carrier is
Scovillain-Mega — derived); the arm asks `mega: true` and asserts `scriptMegaRefused 0`.

---

## 3. THE TWO ENGINE REDS I WAS HANDED

- **`tests/test-counter-init.js`** — `MEDFAILS.sideBuffVolatileIdsUnknown++` (`:19607`) and
  `MEDFAILS.yawnRefusalSecondaryUnknown++` (`:32383`) incremented fields the literal never declared (`NaN` forever).
  Declared on MEDFAILS with their `…First` companions. **4 passed, 0 failed.**
- **`tests/test-pinch-family.js`** — red on a HAND LIST: clause 4 typed five zero-use members (dragonsmaw, firemane,
  rockypayload, steelworker, transistor) and `data/tags.json` is derived over the LEGAL format, so the four with no
  legal carrier in Reg M-B are not in the artifact at all (derived: only Fire Mane has a carrier, Pyroar-Mega). Not
  the engine. The clause now DERIVES its expectation — a historical member must be in the ungated set iff the format
  has a legal carrier for it, the set must be non-empty, and a member with no carrier must be absent from the
  artifact. **All 62 green.**

---

## 4. THE OTHER INSTRUMENTS ON THE FINAL BYTES

| instrument | result |
|---|---|
| `tests/test-mechanics.js` | **835 probed, 834 live, 1 MISSING (`trickSwapsItems`, §0), 0 threw, 0 hollow, 0 unarmed** |
| `tests/test-resolution-order.js` (heap 6144) | first run: 1 arm OVER-FIRES — the `buff-above-secondaries` plant's first edit (`,_stepBuffOnHit,`) now matched only the knob branch of `_STEPS`, so under the break the buff was paid twice. **Re-anchored** to delete the body pass's call (RE-ANCHORED note in the file, batch W's pattern). Second run: **26 arms staged, 0 failing, exit 0 — PASS** |
| `tests/probe_red_demo.js` | first run: 1 HOLLOW — `WIRE 111 megaStone` staged a Gengarite on a MILOTIC (§0). **Re-aimed** to a Gengar. Second run: still 1 HOLLOW — the green arm held but the STRIPPED arm still refused, because `stoneRefusesBody` consulted the cached `megaIntoTable()` and the demo swaps the tag DB in place (`TAGS.__setDB`) without reloading the engine. `stoneRefusesBody` now reads `TAGS.has('item', item, 'megaStone')` LIVE before the table (no production change — the tag set never moves mid-process). Third run: **200 demonstrations, 0 HOLLOW, 0 COULD NOT BE APPLIED, 2 not in this format — exit 0, VERDICT-GREEN** |
| `tests/probe_damaginghit_order.js` (batch Q2) | green — every assertion held |
| `tests/probe_replacement_entry.js` | green — every assertion held |
| `tests/probe_ohko_type_immunity.js`, `tests/probe_redirect_volatile_already_up.js` (batch X) | PASS, PASS |
| `tests/test-counter-init.js`, `tests/test-tag-params-derived.js`, `tests/test-engine-consistency.js` | 4/0; PASS; all checks passed |
| `build/build_tags_js.js --check` | `data/abra-tags.js` is exactly what `data/tags.json` would produce |
| new probes on the live tree | `probe_delayed_hit_immune` 3/0, `probe_trick_refusal` 6/0, `probe_replacement_tie` 2/0, `probe_damaginghit_walk` 3/0 |

---

## 5. THE CHAIN, ON ONE RELEASE

Release cut over the final tree: `node engine/engine_release.js cut "narration batch Y: Future Sight immune payout, Trick
refusal, replacement-queue tie, DamagingHit walk order"` → **`7d66b526659e`** (first frozen 2026-09-09T23:38:55Z; the same id
the live-tree probe runs had been reporting through `_live_release.js`, because identical bytes give an identical id).
`data/engine-release.json` moved with it. Every step via `MSYS_NO_PATHCONV=1 cmd /c <scratch>\run_chain.cmd`, which calls
`tools\lownode.cmd` per step; logs in the session scratchpad (`chainY-*.log`). Success judged by the artifact stamps.

| step | command | result | stamp |
|---|---|---|---|
| (a) | `tests\test-engine-diff.js --n 6000 --seed 20260804` | **6000 compared / 6000 agreed / 0 disagreed**, both corners | moved |
| (b) items | `tests\roster.js --stage items --reds --write --release 7d66b526659e` | **142 MATCH, 0 DIFFER, 0 DID-NOT-FIRE**, 6 COULD-NOT-STAGE | moved |
| (b) abilities | `--stage abilities …` | **139 MATCH, 0 / 0**, 14 CONTROL-NOT-QUIET, 5 DEFERRED, 158 COULD-NOT-STAGE | moved |
| (b) moves | `--stage moves …` | **487 MATCH, 0 / 0**, 3 DEFERRED, 10 COULD-NOT-STAGE | moved |
| (c) | `engine\all_mechanics_fire.js --kind all --write --release 7d66b526659e --census data/verification/census-pin-c716f46ab0a7.json` | **1313 games, 0 threw, 0 sheets unassembled**; abilities 316 exist / 104 fired / 1 diverged; items 148 / 64 / 0; moves 495 fired here, STATE 4 / ANNOUNCEMENT-ONLY 4 / NO-DIVERGENCE 488 — field for field the previous run | moved |
| (d) first run | `engine\game_differential.js --steering empirical --release 7d66b526659e --arm middle --end-state --state --games 1200 --team-store data/team-pool-frozen --turns 50 --census data/verification/census-pin-c716f46ab0a7.json --dump-games 60 --dump-out <ABSOLUTE scratch path> --write` | the artifact was WRITTEN (`-> data/game-differential.json`, 23:45:21Z) and then the process **exited 1** on the dump: `--dump-out` is resolved repo-relative (`D(DUMP_OUT)`, `game_differential.js:9609`) and an absolute path produces `C:\…\ABRA\C:\…` → ENOENT. My flag, not the instrument. | moved |
| (d) clean re-run | the same command with `--dump-out data/_narrationY-after-dump.json` | **exit 0. 961 played / 961 readable / 0 void; BOARD-MATERIAL 0 of 961; NARRATION-ONLY 10 causes / 10 games, all SAME END STATE; protocol agreed 951/961; THREW 1** (the pre-existing harness case, `p1 "move 4, move 1": Can't move: Floette's Protect is disabled`, present at 1 before too). Dump: `data/_narrationY-after-dump.json`, 10 of 10 diverging games. The two runs' results are identical field for field; only `generated` differs (23:45:21Z → 23:50:36Z). | moved |
| (e) | `engine\status.js` (read-only) | 8 of 9 PASS; the two whole-game clause lines are below | — |

```
PASS  whole-game differential / BOARD-MATERIAL — games whose boards part BOARD-MATERIAL: 0 of 961 games. Every
      compared turn boundary in every game holds the SAME BOARD on both engines.
FAIL  whole-game differential / NARRATION — protocol divergence with no board effect NARRATION-ONLY: 9 of 961 =
      0.9% of games diverge in NARRATION and never part a board, across 10 cause(s) (10 narration-only raw, less 1
      declared and 0 cleared on decision impact).
MEDICHAM is not correct — 1 of 9 gate clauses fail (whole-game differential / NARRATION — protocol divergence with no board effect)
```

**THE FOUR CARDS' OWN GAMES, SHOWN FIXED** — `first_divergences` before (b0f5c159c46e, 14 listed of 14 diverged) against
after (7d66b526659e, 10 of 10; both lists are uncapped at these sizes), keyed on config + seed:

| | |
|---|---|
| games that STOPPED diverging | **4** — `baseline …2634643227` (Spicy Spray), `omit-spread …2657358877` (Future Sight), `pair-protect-bust …2654619049` (Trick), `pair-protect-bust …2635037737` (replacement tie) |
| games that STARTED diverging | **0** |
| games whose CAUSE changed | **0** |
| the 10 that remain | the four substitute cards, the residual trio, the perish `|upkeep|` (closeted), Sucker Punch / Psychic Terrain, Lightning Rod / `-prepare` |

---

## 6. PREDICTION VS RESULT

`data/verification/_prediction-2026-09-09-batch-Y.json`, written before the cut: 961 played, void 0 (0-1),
BOARD-MATERIAL **0** (0-1), NARRATION-ONLY raw **10** (9-12), clause **9** (8-11), causes **10** (9-12); pool moves
by exactly the four games; census must not go down; roster unchanged.

| clause | predicted | measured |
|---|---|---|
| games played | 961 | **961** |
| void | 0 (0-1) | **0** |
| BOARD-MATERIAL | 0 (0-1) | **0 of 961** |
| NARRATION-ONLY raw | 10 (9-12) | **10** |
| NARRATION clause | 9 (8-11) | **9 of 961** |
| causes | 10 (9-12) | **10** |
| pool moves by exactly the four games | yes | **yes — 4 stopped, 0 started, 0 changed** |
| census does not go down | must hold | **MISSED — 835 → 834 live / 1 MISSING, and the reason is a probe (§0), not the engine** |
| roster unchanged | 0 / 0 | **0 DIFFER / 0 DID-NOT-FIRE, 142 / 139 / 487** |

Every whole-game clause hit at the point estimate. The one miss is the census, and it is the finding of §0.

---

## 7. THE CAUSES LEFT, EACH WITH ITS REASON

- **THE SUBSTITUTE FAMILY (4 causes)** — the loop-nesting job batch X planned; the most dangerous edit available and
  not a one-cause batch. Not started.
- **THE RESIDUAL TRIO** (brn<>brn, psn<>psn, leftovers<>leftovers) — skipped as instructed; no new derivation.
- **THE PERISH `|upkeep|` DRAIN** — CLOSETED by Will; skipped.
- **SUCKER PUNCH vs PSYCHIC TERRAIN** and **LIGHTNING ROD vs `-prepare`** — the structural trade batch X named (the
  move's own `onTry` above the pre-dispatch terrain gate; the redirect resolved ~270 lines late). Not attempted.
- **`kind === 'boostally'`'s silent shield** — not in the 14; not attempted.

---

## 8. DEBRIS AND STATE OF THE TREE

Named rather than removed. **Nothing was deleted by this batch.** One thing was OVERWRITTEN and RESTORED: the Write
of my new probe landed on the tracked `tests/probe_damaginghit_order.js` (batch Q2's, 276 lines). Restored from HEAD
with `git checkout --` — the only uncommitted content in it was my own, already copied out — and my file is
`tests/probe_damaginghit_walk.js`; the engine comment that named it was updated.

- New, intended: `tests/probe_delayed_hit_immune.js`, `tests/probe_trick_refusal.js`, `tests/probe_replacement_tie.js`,
  `tests/probe_damaginghit_walk.js`, `data/verification/census-pin-c716f46ab0a7.json`,
  `data/verification/_prediction-2026-09-09-batch-Y.json`, this report.
- Edited: `engine/medicham2-browser.js`, `engine/tag_dex.js`, `data/tags.json`, `data/abra-tags.js`,
  `tests/test-pinch-family.js`, `tests/probe_red_demo.js` (WIRE 111 re-aim), `tests/test-resolution-order.js`
  (one anchor re-aimed), `docs/ENGINE.md` (the hand list).
- Rewritten by the runs: `data/mechanics-census.json`, `data/engine-diff.json`, `data/published-samples.json`, `data/roster.{items,abilities,moves}.json` + `.prev.json`, `data/roster.json`, `data/all-mechanics-fire.json`, `data/game-differential.json`, `data/engine-release.json`, `data/provenance-stamp.json` (status.js writes it), `data/_narrationY-after-dump.json` (the 10-game dump, batch X's convention for dumps).
- **Other agents' uncommitted work in the same tree, not mine, not touched:** `tests/test-mechanics.js` (five screen
  probes), `tests/roster.js`, `tests/test-stadium-roster.js`, `engine/gate_fail_and_silent.js`,
  `build/compress-stores.js`, `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `docs/ROADMAP.md`, `docs/MEASURE.md`,
  `docs/OPS.md`, four untracked `docs/_reports/2026-09-09-*.md`. HEAD moved once during the batch (`bf4ff432` →
  `71771f0b`); nothing here read the working tree for a measurement — every run is release-pinned.
- Scratch under the session scratchpad: the four whole-game replays (`replay_*.txt`), `measure_switch.js` (the
  replay that read `replaceOrderTie = 1`), `dh_streams.js`, the edit scripts, every probe log.
- `data/releases/` gained the releases named in §5. Every probe run used `tests/_live_release.js` (a temp store).

---

## 9. PROPOSED ROWS (NOT APPLIED)

**RUNNING-NOTES row (ENGINE).** What changed: four narration causes closed in `engine/medicham2-browser.js` — Future
Sight's payout into a type-immune collector writes `-end` then `-immune` and draws no die; a Trick refused by `onHit`
is `-fail` + `[still]` and the stone rule is the body's (`stoneRefusesBody`); the end-of-turn replacement queue is
sorted by the authority's selection sort with the tie die (`entrySpeedSort`); `DamagingHit` is walked order-1-first
then index-major, with `punishesAttacker.order` / `buffsHolderOnHit.order` derived in `engine/tag_dex.js`. Measured:
release `7d66b526659e`, pins `--steering empirical --arm middle --end-state --state --games 1200 --turns 50 --team-store data/team-pool-frozen --census data/verification/census-pin-c716f46ab0a7.json`: 961 played / 0 void / **BOARD-MATERIAL 0 of 961** / **NARRATION-ONLY 10 raw, clause 9 of 961, 10 causes**; the four cards' games stopped, 0 started, 0 changed cause; `test-engine-diff` 6000/6000/0; roster 142/139/487 with 0 DIFFER / 0 DID-NOT-FIRE; `all_mechanics_fire` 1313 games / 0 threw; census **835 → 834 live / 1 MISSING** (`trickSwapsItems` pins the coarse stone guard — owed to the file's owner). Supersedes: `NARRATION-ONLY 14 raw / clause 13 of 961 / 14 causes` on `b0f5c159c46e`. **Basis.**
unchanged. Owes: the `trickSwapsItems` probe re-aim (the census reads 834/835 until it lands).

**CHANGELOG (MINOR) bullets.** Fixed: a Future Sight that came due on a body immune to its type priced it, spent two
dice and wrote nothing; it writes the condition's `-end` and the target's `-immune` and spends no die. Fixed: Trick
refused by its own `onHit` (a stone on the body it belongs to, on either side or as the receiver; two empty hands)
`continue`d in silence or announced a swap of nothing; it fails with `[still]`, and a foreign stone swaps. Fixed: two
corpses on equal raw Speed refilled in side order; the replacement queue now goes through the selection sort and tie
die the entry pass uses. Fixed: a spread hit's `DamagingHit` handlers ran step-major; they run order-1-first then by
target index, and the tags carry `onDamagingHitOrder`. Changed: `tests/test-pinch-family.js` derives its positive
control from the format; `tests/test-counter-init.js` green (two MEDFAILS fields declared). Changed: gate artifacts
re-measured on `7d66b526659e` — BOARD-MATERIAL 0 of 961 with 0 void, NARRATION-ONLY 10 raw / clause 9 of 961 across 10 causes (was 14 / 13 / 14); 8 of 9 clauses PASS. Census 834 live / 1 MISSING until `tests/test-mechanics.js`'s `trickSwapsItems` fixture puts the Gengarite on a Gengar..

**ROADMAP rows (proposed).** (1) `tests/test-mechanics.js:15571` `trickSwapsItems` pins a coarse stone guard the
authority refutes — one-line fixture change, owner: whoever holds the file; the census reads 834 live until then.
(2) Future Sight's payout takes no `acc` draw where the authority draws one on a printed 100 — measured 1 vs 0
addresses; a die-count gap, not a board one until an evasion stage is on the field. (3) The two remaining engine
reds handed to me are green; `tests/test-resolution-order.js` and `tests/probe_red_demo.js` each needed one re-aim
after this batch's restructure and both are green.

---

## OWED, NOT RUN

- Commit: everything under §8 "New" and "Edited", plus the re-measured artifacts and the census pin — sole
  publisher's job. `data/releases/`7d66b526659e`` is gitignored; the previous wave tracked its release explicitly
  (`git add -f`); the same is owed here if the artifacts are to cite an openable snapshot.
- The `trickSwapsItems` probe re-aim in `tests/test-mechanics.js` (§0) and the census regeneration after it —
  expected to restore 835/835 with NO engine change.
- The RUNNING-NOTES row, CHANGELOG bullets and ROADMAP rows above.
- Nothing in the chain was cut short.
