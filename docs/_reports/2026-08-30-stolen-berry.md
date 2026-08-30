# BUG BITE AND PLUCK NEVER MADE THE ATTACKER EAT THE STOLEN BERRY — AND FOR ONCE THE POOL MOVED

**2026-08-30. ENGINE. Landed, probed, shown red under its own knob first.**

| | before | after |
|---|---|---|
| census (`data/mechanics-census.json`) | 813 probed / 813 live / 0 missing | **814 / 814 / 0** |
| empirical protocol-diverged games | 175 of 961 | **173** |
| empirical board-parted | 84 of 961 | **83** |
| distinct divergence causes | 153 | **151** (3 removed, 1 added) |
| the `-enditem field 4` class | 3 games | **the class no longer exists** |
| `ordering` class, games | 24 | **24** |
| end-state verdicts | 903 / 55 / 2 / 0 / 1 | **905 / 53 / 2 / 0 / 1** |
| engine release | `f933a01b792a` | **`0e8ec5729a7b`** |

---

## 0. THE PREDICTION, WRITTEN TO DISK BEFORE THE RUN

`data/verification/prediction-stolenberry.json`, written before a line of engine changed.

| | baseline | predicted | accepted band | **measured** |
|---|---|---|---|---|
| census | 813 / 813 / 0 | **814 / 814 / 0** | exactly | **814 / 814 / 0** |
| protocol-diverged games | 175 | **172** | 170–175 | **173** |
| board-parted games | 84 | **83** | 82–84 | **83** |
| distinct causes | 153 | **150** | 147–153 | **151** |
| `-enditem field 4` class | 3 | **0** | exactly | **0 — the class is gone** |
| `ordering` class | 24 | **24** | 22–26 | **24** |
| end-state verdicts | 903/55/2/0/1 | **identical** | ≤2 in any cell | **905/53/2/0/1** |

**Five of seven at the point estimate, seven of seven inside the band.** The two that missed
missed by one in the same direction and for the same reason, stated in advance in the prediction
file: *"removing a first divergence lets the game run further and it may find a later one, so the
drop is 0..3 and the point estimate is the full 3."* One of the three games did exactly that (§5).

**WHICH SCOREBOARD, SAID IN ADVANCE.** Unlike the last five batches this one was predicted to move
the **pool**, and the arithmetic was written down rather than hoped for. Derived from
`data/team-pool-frozen/games.bo3.jsonl` (13,214 games) before the run:

```
  games MENTIONING bugbite anywhere      369       mentioning pluck    0
  games that actually CLICK bugbite       81       total clicks      117
  clicks into a body whose SHEET item is a berry   53, in 41 games
  41 / 13214 * 961  =  2.98 expected games
```

**369 is a MENTION count and most of it is sheets.** The click count is what can diverge, and the
961-game sample itself settles it exactly: the differential's `-enditem field 4` class was **3
games, and all three of its causes were this line.** So the prediction was arithmetic against a
measured ceiling, not a guess.

---

## 1. THE MEMBERSHIP, DERIVED — AND FOR THE FIRST TIME IN THIS RUN OF BATCHES IT IS THE TWO NAMED

The brief warned to expect the membership to differ from the two moves it named. Derived over the
format (`exists && !isNonstandard && tier !== 'Illegal'`, 500 legal moves), it does not:

| | move | `takeItem` | `singleEvent('Eat')` | who eats | in this fix |
|---|---|---|---|---|---|
| 1 | **`bugbite`** | yes | yes | the **ATTACKER** | **yes** |
| 2 | **`pluck`** | yes | yes | the **ATTACKER** | **yes** |
| 3 | `corrosivegas` | yes | no | nobody | no |
| 4 | `covet` | yes | no | nobody | no |
| 5 | `knockoff` | yes | no | nobody | no |
| 6 | `switcheroo` | yes | no | nobody | no |
| 7 | `thief` | yes | no | nobody | no |
| 8 | `trick` | yes | no | nobody | no |
| 9 | `fling` | **no** | yes | the **FOE** | no — landed the previous batch (row 7) |
| 10 | `stuffcheeks` | no | `eatItem(true)` | itself | no — already raised |

**Nine legal moves call `takeItem` and exactly two make the attacker eat what they took.** Champions
overrides neither: `grep -n "bugbite\|pluck" data/mods/champions/moves.ts` returns nothing, so
`data/moves.ts:1911-1934` and `:13442-13465` are inherited whole and are the SAME BODY.

**Pluck has ZERO mentions in the 13,214-game pool and is still in the fix**, because the fix is not
keyed on a move id and the probe stages Pluck on a Corviknight to prove it.

---

## 2. THE AUTHORITY, READ WHOLE — FOUR STATEMENTS, AND THIS ENGINE HAD ONE

```js
onHit(target, source, move) {
  const item = target.getItem();
  if (source.hp && item.isBerry && target.takeItem(source)) {
    this.add('-enditem', target, item.name, '[from] stealeat', '[move] Bug Bite', `[of] ${source}`);
    if (this.singleEvent('Eat', item, target.itemState, source, source, move)) {
      this.runEvent('EatItem', source, source, move, item);
      if (item.id === 'leppaberry') target.staleness = 'external';
    }
    if (item.onEat) source.ateBerry = true;
  }
}
```

Three facts that decide how this is written, each read rather than assumed:

- **`singleEvent` RETURNS TRUE FOR EVERY LEGAL BERRY, so the inner `if` is a straight line here.**
  `Battle#singleEvent` (`sim/battle.ts:623-651`) returns `relayVar` (true) when the callback is
  `undefined`, and otherwise the callback's own return. Derived over the format's **28 legal
  berries: all 28 carry an `onEat` FUNCTION.** The 18 resist berries' bodies are EMPTY
  (`onEat() { }`, `data/items.ts` `chopleberry:1050`, the same on every member), so they return
  `undefined` and `singleEvent` hands back true. **This nearly went in as a branch on
  `onEat === false`, which is what a resist berry looks like from memory and is not what the file
  says.**
- **The `[from] stealeat` and `[move] <Name>` are TWO SEPARATE FIELDS**, either side of nothing and
  above the `[of]`. Six arguments. The existing `TR.enditem` emitter places `of` at field 4 and
  `extra` at field 5, so it can write any two of the three and never all three in order —
  hence a dedicated `TR.stealeat` emitter rather than a concatenated string, which is the same
  mistake that emitter's own `[silent]`/`[from]` note already records.
- **The authority writes NO `lastItem`, NO `usedItemThisTurn` and NO `AfterUseItem` on the thief.**
  That is why this road is deliberately NOT routed through `consumeBerry`, exactly as Fling's is
  not: `consumeBerry` is `Pokemon#eatItem`'s body and this handler is not `eatItem`.

---

## 3. WHAT MOVED IN THE ENGINE

One site (`_stepAfterHit`, the strip), one new emitter, one knob.

- **The `-enditem` line** now reads `[from] stealeat|[move] <dex name>|[of] <thief>`. The move NAME
  comes off the tag record's own `name` field — the dex's — and is never typed.
- **`berryForceEat(thief, item)`** is `singleEvent('Eat')`. It is the SAME function Stuff Cheeks,
  Teatime and Cud Chew's second helping already use, so the berry's effect has one implementation.
  Its declared shortfalls are inherited rather than re-invented, and counted separately
  (`MEDSEEN.stolenBerryEffectUnexpressed`, which is legitimately non-zero for the 18 resist berries
  because the authority's handler is empty too).
- **`runEatItemEvent(thief, item, moveId)`** raises `EatItem` on the thief, passing the MOVE ID as
  `fromEffect` — which is exactly the list Cud Chew's `notFromEffects` names.
- **`thief._ateBerry = true`.**

### THE GATE READS THE RIGHT TAG FIRST AND THE FALLBACK IS LOUD

The direct statement is `takesTargetItem.consumesAndGainsEffect`, and it is **wrong today** (§6).
So the gate reads it FIRST and falls back on `removesItem.requiresItemClass === ['isBerry'] &&
!steals` — a different, correct predicate derived off the same handler's own guard — and counts
`MEDFAILS.stealEatViaClassGuard` every time it does. **The equivalence was MEASURED, not argued**:
using `engine/tags.js`'s own `__setDB` seam (its header calls it *"the probe seam for a STAGED tag,
one whose tag_dex derivation is written but whose regeneration has not run"*), an artifact with the
two rows corrected was injected and all **eight** `takeItem` moves produced **byte-identical**
boards, with the counter reading **2 on the on-disk pass and 0 on the staged pass**. So the day
#529's regeneration lands the counter goes to zero and nothing here changes.

### TWO THINGS DELIBERATELY NOT DONE, EACH COUNTED RATHER THAN PASSED OVER

- **`source.hp` guards the STRIP as well as the eat in the authority.** Only the eat is gated here,
  because there is no failing probe on the strip half and an unprobed behaviour change makes a batch
  unattributable. The over-strip is counted (`MEDFAILS.stealEatAttackerFainted`) and is reachable —
  Bug Bite makes contact, so Rough Skin can kill the thief mid-handler.
- **`target.staleness = 'external'` on a stolen Leppa.** This engine has no staleness model at all.
  `MEDFAILS.stealEatStalenessUnmodelled`.

---

## 4. THE PROBE — RED FIRST, WITH THE FIVE CONTROLS THAT MUST NOT MOVE

`move/takesTargetItem`, seven arms, one staging, both bodies unfaintable (the target because a KO
clamps both arms and this file marks that HOLLOW; the ATTACKER because its HP is the reading).

Written and shown RED before a line of engine changed:

```
  MISSING  takesTargetItem  ... writes "|-enditem|p2a:incineroar|chopleberry|[from]move:bugbite|[of]p1a:scizor"
           Into a SITRUS the ATTACKER gains 0 of a required 290, no heal line, ateBerry=false
```

| arm | before | after | must be |
|---|---|---|---|
| **TEST** the LINE — Bug Bite into a **Chople** | `[from]move:bugbite` | **`[from]stealeat\|[move]bugbite\|[of]p1a:scizor`** | the whole string; and HP must NOT move (empty `onEat`) |
| **TEST** the EFFECT — Bug Bite into a **Sitrus** | thief +0 | **thief +290 = maxhp/4**, `[from]item:sitrusberry`, `ateBerry` | the berry heals the body that never held it |
| **TEST** the SECOND MEMBER — **Pluck** on a Corviknight | +0 | **+346 = maxhp/4** | not keyed on a move id |
| **CONTROL** `lastItem` after both eating arms | `""` | **`""`** | the authority writes none — Hydrapple learns Bug Bite AND Recycle |
| **CONTROL** a target with **no item at all** | no line, +0 | **no line, +0** | unmoved |
| **CONTROL** a target holding a **Life Orb** | survives, +0 | **survives, +0** | the class guard; not even stripped |
| **CONTROL** a berry that must **NOT** be eaten — **Sticky Hold** + Sitrus | survives, +0 | **survives, +0** | `takeItem`'s own refusal |
| **CONTROL** **KNOCK OFF** into the same Sitrus | stripped, +0 | **stripped, +0, `[from]move:knockoff`** | a fix that made every item-remover an eater fails HERE |

**The Knock Off and Sticky Hold arms are the ones that matter.** They are character-identical before
the fix, after the fix, and under the knob.

### THE KNOB

`MEDI_STEALEAT_STRIP_ONLY=1` restores the strip-without-the-eat whole, is stamped at declaration
(`MEDFAILS.stealEatStripOnlyRestored`) and is registered in `tests/test-mechanics.js`'s
`DELIBERATE_BREAK`. Under it: the census **REFUSED to write** and the message named the right key;
**exactly this probe** read MISSING — 813 live / 1 missing / 814 probed; and every control arm was
unmoved.

---

## 5. THE EMPIRICAL ARM — THE POOL MOVED, AND EVERY MOVEMENT IS ATTRIBUTED BY NAME

```
  causes before 153   after 151      ADDED 1   REMOVED 3   COUNT MOVED 0
  the `-enditem field 4` class no longer appears in the table at all
  ZERO occurrences of `stealeat` remain anywhere in the 250-game dump
```

**REMOVED — all three, and all three are this defect:**

```
  -enditem field 4 :: |-enditem|p2a|chopleberry |[from]stealeat|[move]bugbite <> |[from]bugbite
  -enditem field 4 :: |-enditem|p1a|sitrusberry |[from]stealeat|[move]bugbite <> |[from]bugbite
  -enditem field 4 :: |-enditem|p2a|passhoberry |[from]stealeat|[move]bugbite <> |[from]bugbite
```

**ADDED — exactly one, and it is the third game running FURTHER rather than a new defect:**

```
  -damage field 3 :: |-damage|p1a:milotic|161/170 vs 164/170
```

Traced game by game rather than inferred:

| seed | before | after |
|---|---|---|
| `…2657225377` (Chople) | `-enditem field 4` at turn 8 | **NOT DIVERGED — the game now runs clean to the end** |
| `…2657492148` (Sitrus) | `-enditem field 4` at turn 6 | **NOT DIVERGED — the game now runs clean to the end** |
| `…2654877056` (Passho) | `-enditem field 4` at turn 3 | diverges LATER, at an unrelated damage value |

**THE BOARD-MATERIAL HALF, IDENTIFIED IN THE PREDICTION FILE AND CONFIRMED.** Game `…2657492148`
is the one that closed the board: the authority writes
`|-heal|p2a: Scizor|125/145|[from] item: Sitrus Berry` and this engine wrote nothing, leaving its
Scizor at **89** where the authority had **125**. `games_board_never_diverged` 877 → **878**, and
the two HP families moved with it — `active[].hp` 49 → 48 games, `party.hp` 48 → 47.

**End-state improved rather than merely holding**: SAME-END-STATE 903 → **905**, DIFFERENT-END-STATE
55 → **53**. The prediction allowed ≤2 in any cell and did not predict the direction.

**Sample identity, checked and not assumed:** 961 games both runs, `turns_cap` 12, arm `middle`,
steering `empirical-click/v1`, census pin `9446a684709d`, pool digest `0d103fb9fa87` under
`data/team-pool-frozen`, `closet.teams_dropped` 43, `coverage.exercised` 556, `state.not_compared`
5, `mid_void.void_games` 9, `order_probe` 2 rows both, Showdown commit
`20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`, `mode` string identical
(`A/middle/pins:ccb365985023/credit:observed-effect/v1/nature:real`).
**`engine/arms_comparable.js` reports COMPARABLE.**

Artifacts: `data/verification/game-differential.stolenberry.json` and
`data/verification/divergence-turns.stolenberry.json`, release **`0e8ec5729a7b`**, `--dump-games
250` (164 of 173). **`data/game-differential.json` was NOT touched** — its mtime is still
2026-08-28 23:14; `--out` redirects the write.

---

## 6. THE TAG IS STILL MIS-DERIVED, AND THE BLOCKER IS NOT MERELY STILL TRUE — IT GOT WORSE

ROADMAP #529 was **re-measured, not recalled**, over the whole legal membership:

```
  the deriver, engine/tag_dex.js:2335   const eats = /eatItem|singleEvent\('Eat'/.test(src);
  the compiled body it is run against   ... singleEvent("Eat", i ...          DOUBLE QUOTES
  rows that MOVE under a quote-agnostic test:  bugbite, pluck   — and nothing else
  stuffcheeks already matches via `eatItem`; the other six match under neither
```

So the fix is still **exactly two rows** (`consumesAndGainsEffect` false → true, `removes` true →
false) and still behaviour-neutral.

**AND THE REASON IT IS NOT LANDED IS SHARPER THAN IT WAS.** #529 records that a bare regeneration
would ride a live-store usage refresh into a frozen source. Since `data/tags.json` was last
generated (`2026-08-29T13:37Z`) OPS has landed **four ingest commits** —
`acc8228c` 16:47, `e5b89eec` 21:00, `0a14bc5a` 05:29 and `7c97af86` **11:59 today, twenty-five
minutes before this batch started.** The cadence is roughly five-hourly. A regeneration today rides
four ingests' worth of `uses`/`sheet_entries` churn, and the two-row change would not be
attributable inside it.

**So the consumer was written against the tag that IS right**, with the fallback counted out loud
and the equivalence measured through `__setDB` (§3). That is the difference between a fallback and
building on sand: this one names itself and will fall silent on its own.

---

## 7. ONE FIX OR TWO — TWO, AND THE SECOND IS BLOCKED ON THE SAME REGENERATION

The brief asked this to be settled before anything landed. It was settled twice, by two independent
methods that agree.

### (a) THE 2×2 OVER TWO REVERT KNOBS, ONE PROCESS PER CELL

`A = MEDI_STEALEAT_STRIP_ONLY` (this batch) × `B = MEDI_EATEVENT_UPDATE_ONLY` (the prerequisite that
landed hours earlier and also touches berries). Board **S** = a Scizor Bug Bite into a Sitrus.
Board **E** = the resist-berry road the prerequisite owns (a Cheek Pouch Maushold at 40%, a Chople,
Close Combat).

```
  A moves S with B=0 : DIFFERS          B moves E with A=0 : DIFFERS
  A moves S with B=1 : DIFFERS          B moves E with A=1 : DIFFERS
  B leaves S, A=0    : IDENTICAL        A leaves E, B=0    : IDENTICAL
  B leaves S, A=1    : IDENTICAL        A leaves E, B=1    : IDENTICAL
  A's delta on S is character-identical under both settings of B: true
```

Each knob moves its own staged board under **both** settings of the other and leaves the other's
board **byte-identical** under both. **Two fixes.** The steal-eat is not a fifth caller of
`consumeBerry`, which is the specific hazard the shared prerequisite created.

### (b) RIPEN'S SECOND HALVE — STILL OPEN, STILL SEPARATE, AND NOT LANDABLE TODAY

Ice Beam into an Appletun (4×, so a Yache actually fires):

```
  no ability, no berry   188        RIPEN, a Yache    94   (the authority halves AGAIN: must be ~47)
  no ability, a Yache     94        RIPEN, no berry  188   (= the no-ability arm, so the knob is cleared)
  MEDFAILS.damageReduceUnknown moved by 4, first "ripen/null"
```

The reader **refuses and says so** — fail-closed, not silent — because Ripen's `damageReduce` row
carries `onlyWhen: null`. Ripen's WHOLE tag record is
`{announcesBerryEat, doublesBerryEffect{mult:2,heal,boost}, damageReduce{0.5,null}}`, and **none of
the three states the authority's condition** (`abilityState.berryWeaken`, written from `onEatItem`).
`doublesBerryEffect`'s own deriver explicitly excludes the damage road — *"plus the resist-berry
halving that `damageReduce` already carries"* — so reading it for the halve would be building on
sand in the other direction. **The fix needs `damageReduce.onlyWhen` to carry a condition, which is
a `tag_dex.js` regeneration: the same one #529 is blocked on.**

**AND THE TWO MECHANICS CANNOT EVEN INTERACT IN THIS FORMAT**, which is stronger than the 2×2.
`D.species.getMovePool` over every legal carrier of the format's three `on*EatItem` abilities —
Diggersby, Dedenne, Maushold, Maushold-Four (Cheek Pouch); Farigiraf and the three Tauros-Paldea
(Cud Chew); **Flapple and Appletun (Ripen)** — returns **neither `bugbite` nor `pluck`**, against 38
legal Bug Bite learners and 9 Pluck learners. So a stolen berry can never arm a `berryWeaken`, and
the `EatItem` event this batch raises on the thief has **no reachable consumer here**. It is raised
anyway, for the reason the previous batch honoured Cud Chew's `notFromEffects`: a later regulation
is what makes a dead branch expensive.

---

## 8. THE CLOSETED PERISH ROW (ROADMAP #440) STILL HOLDS

Checked against its four `WOULD BE WRONG IF` conditions rather than asserted. This batch touches ONE
site — the item strip inside `_stepAfterHit`, above `faintMessages` — plus a new trace emitter. It
writes no faint, reads no residual queue and moves no `|upkeep|`.

- The closet row is matched on the `|upkeep <> |faint|pXY` pair AND a `perish0` line in
  `showdown_before`. Its cause string is in neither the added nor the removed set: **the added set
  is one damage value on a Milotic and the removed set is three `stealeat` lines.**
- `tests/probe_upkeep_lines.js --release 0e8ec5729a7b` reads **4 of 49 not as expected, the same
  four by name** as the inherited baseline: `A TEST` (bare board, no follower), `C follower
  hungerswitch`, `C follower item whiteherb`, `D clock volatile:uproar`.
- Falsifier (b) — the COVERAGE arm of `data/game-differential.json` — **remains undecided**, exactly
  as it was: that artifact is still stale (release `e129bca605e3`) and was deliberately not
  republished.

---

## 9. THE TWO INHERITED REDS, NEITHER WORSENED

- **`tests/probe_red_demo.js`**: **200 demonstrations, 1 HOLLOW, 5 COULD NOT BE APPLIED**, 2 not in
  this format — the same five by name (WIRE 117 Psychic Terrain, ROADMAP #81 WIRE 2, WIRE 7 mega
  stone, WIRE 8 ×2). None of this batch's edits is anchored by any demo.
- **`tests/probe_upkeep_lines.js`** is RED at 4 of 49 and it is NOT this batch's — §8.

---

## 10. WHAT WAS RUN

| | |
|---|---|
| `tests/test-mechanics.js` | **exit 0, 814/814/0**, hollow 0, unarmed 0, threw 0 |
| under `MEDI_STEALEAT_STRIP_ONLY=1` | census REFUSED, exactly this probe MISSING (813/1/814), every control unmoved |
| the 2×2 over both revert knobs | §7(a) |
| the `__setDB` staged-tag membership control | 8 moves, all byte-identical; counter 2 → 0 |
| `tests/test-engine-consistency.js` | PASS |
| `tests/test-end-state.js` | ALL GREEN |
| `tests/test-resolution-order.js` (through `lownode.cmd`) | PASS, 26 arms, 0 KNOWN-OPEN, 0 failing |
| `tests/test-seed-clock.js` | PASS |
| `tests/probe_knockoff_megastone.js` | PASS |
| `tests/probe_hp_pair.js` | PASS |
| `tests/probe_multihit_update.js` / `probe_multihit_corners.js` | PASS |
| `tests/probe_recoil_after_clamp.js` | PASS |
| `tests/probe_innards_out.js` | PASS |
| `tests/probe_turn_order.js` | PASS |
| `tests/probe_endturn_clock_order.js` | PASS (1 declared KNOWN-OPEN, unchanged) |
| `tests/probe_residual_shadow.js` | PASS |
| `tests/probe_volley_collapse.js` | PASS (3 declared-open ENDURE rows, unchanged) |
| `tests/probe_punish_announce.js` | PASS |
| `tests/test-residual-order-observed.js` / `-population.js` | ALL GREEN (3 / 14 checks) |
| `tests/test-perish-song.js` | PASS |
| `tests/test-forme-assert.js` | PASS |
| `tests/test-wiring.js` | every capability proved it ran |
| `tests/probe_upkeep_lines.js --release 0e8ec5729a7b` | 4 of 49, the inherited four by name |
| `tests/probe_red_demo.js` | the inherited 5 + 1 hollow of 200 |
| `engine/arms_comparable.js` | COMPARABLE |
| the empirical whole-game differential | §5 |

**One thing that reads as red and is not, recorded because it cost a minute:** `probe_innards_out.js`
exits **2** with *"NOT RUN — the official simulator is absent"* unless `SHOWDOWN_PATH` is exported
into the shell that calls the wrapper. It is not a verdict.

---

## OWED, NOT RUN

- **RIPEN DOES NOT HALVE A RESIST BERRY A SECOND TIME**, measured at 94 against a required ~47 (§7b).
  **BLOCKED, and not on the diagnosis** — it needs `damageReduce.onlyWhen` to carry the authority's
  `abilityState.berryWeaken` condition, which is a `tag_dex.js` regeneration. Two legal carriers,
  2 of 13,214 pool games: a LAB fix, and it will not move the pool.
- **ROADMAP #529 IS UNCHANGED AND ITS BLOCKER IS TIGHTER** (§6). Both it and the row above want the
  SAME thing: one `tag_dex.js` pass with the store pinned. That pass is now the gating item for two
  separate mechanics, which is a stronger case for doing it than either had alone. It is not an
  ENGINE-only call — pinning the store is a MEASURE-shaped decision about a corpus.
- **A POOL-SCALE READING OF THE FOUR NEW COUNTERS.** `MEDSEEN.stolenBerryEaten`,
  `stolenBerryEffectUnexpressed`, `eatEventOffStolenBerry` and `MEDFAILS.stealEatViaClassGuard` have
  been read only on staged boards; `game_differential.js` surfaces no `MEDSEEN`. Carried forward
  from the previous batch, which owed the same for its four. The invariant worth checking when
  something does surface them: `stealEatViaClassGuard` must go to ZERO the moment #529 lands, and
  `stolenBerryEffectUnexpressed / stolenBerryEaten` should sit near 18/28 by berry population.
- **`MEDFAILS.stealEatAttackerFainted` HAS NEVER BEEN OBSERVED NON-ZERO.** It is the authority's
  `source.hp` guard on the STRIP, deliberately left unfixed for want of a probe. Staging it needs a
  contact-punishing ability that kills the thief mid-handler; it is a batch of its own.
- **THE ROSTER, ALL THREE STAGES, AND `data/all-mechanics-fire.json`.** Still on `e129bca605e3` and
  WITHHELD by the release-mismatch clause, which now predates this batch by five releases.
- **THE COVERAGE ARM of the whole-game differential** (`data/game-differential.json`). Stale on
  `e129bca605e3` and already withheld by `status.js` before this batch. It is falsifier (b) of the
  closeted ROADMAP #440 row, so that clause remains undecided.
- **`tests/test-engine-diff.js`** — not run, deliberately: it has no `--out` and would republish
  `data/engine-diff.json`. It calls `moveHit` ONCE and no damage number moved in this batch. That is
  an argument, not a measurement, and it is recorded as one.
- **THE ROWS CARRIED FORWARD** on the ENGINE.md hand list, each its own batch: Triple Axel into an
  intact Disguise dealing zero on arrivals 2 and 3; the volley halving every arrival against a
  resist berry; the drain heal paid per row rather than per hit; an attacker killed by an interior
  arrival's toll not stopping the volley.
- **ROADMAP #312 IS STALE IN ALL FOUR BULLETS** and is a documentation edit rather than work. Not
  touched here; recorded again so the next session does not treat it as open.
