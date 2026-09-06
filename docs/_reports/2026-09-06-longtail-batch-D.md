# LONG-TAIL BATCH D — board-material 50 → 46, protocol 114 → 111, plus the `any` dice bucket made measurable

2026-09-06, ENGINE. Historical record. Not maintained, not current state, superseded by whatever
`node engine/status.js` prints.

---

## THE HEADLINE

| | before | after |
|---|---|---|
| **board-material** (`state.games` − `games_board_never_diverged`) | **50 of 961** | **46 of 961** |
| protocol first-divergence | 114 | 111 |
| games whose board never diverged | 911 | 915 |
| void / threw | 5 / 1 | 5 / 1 |
| `DIFFERENT-END-STATE` | 30 | 29 |
| mechanics census | 829 live / 829 probed / 0 missing | **829 / 829 / 0** (level, 0 hollow, 0 threw, 0 unarmed) |
| `node engine/status.js` | 7 of 9 | **7 of 9** — the same two whole-game clauses |

`data/game-differential.json` is republished at **46 / 111 on release `2a5fd78725e7`**, reproducing
the step-2 verification run to the byte on `classes`, `first_divergences`,
`state.first_board_divergences` and `end_state`.

**BOARD-MATERIAL MOVED FOR THE FIRST TIME IN THREE BATCHES.** Batch C moved narration by 37 and the
bar by 0 — correctly, because everything in it was a narration line. Both fixes here were chosen off
the BOARD-MATERIAL half of the by-cause table and both were called as board-material before the run.

Pins IDENTICAL on every whole-game run: census `data/verification/census-pin-9446a684709d.json`,
pool `data/team-pool-frozen`, arm `middle`, `--end-state`, steering `empirical`, cap 20, 1200-pair
budget → 961 games, `driver_code_stable` true throughout.

| step | what landed | release | board-material | protocol |
|---|---|---|---|---|
| baseline | as published | `a985300cb8ed` | 50 | 114 |
| 1 | King's Shield's stat punish goes through `applyStatDrop` | `583f3f5ff815` | **48** | **113** |
| 2 | an ability arriving mid-battle runs its own `Start` | `2a5fd78725e7` | **46** | **111** |
| 3 | the `any` dice bucket is measured (INSTRUMENT, decides nothing) | `2a5fd78725e7` | 46 | 111 |

---

## THE PREDICTION RECORD

Both predictions were written to `data/verification/_prediction-longtail-D-*.json` **before** their
runs.

| step | quantity | predicted | measured | |
|---|---|---|---|---|
| 1 | board-material | **48** | 48 | hit |
| 1 | boards never diverged | **913** | 913 | hit |
| 1 | protocol | **112** | 113 | **MISS by 1** |
| 1 | threw / void | 1 / 5 | 1 / 5 | hit |
| 2 | board-material | **46** | 46 | hit |
| 2 | boards never diverged | **915** | 915 | hit |
| 2 | protocol | **111** | 111 | hit |
| 2 | threw / void | 1 / 5 | 1 / 5 | hit |

**Nine of ten, one named miss.** The step-1 protocol miss is exactly the failure mode the prediction
file called *"why it might miss HIGH"*: both named cause rows went to zero, and one of the two games
played on and re-parted on a NEW cause —
`extra event emitted by medicham2 :: |faint|p1a <> |detailschange|p1a|aegislash,l50`, a Stance
Change / faint ordering question that the shield punish had been standing in front of. Its board
still never diverges, which is why board-material hit at 48 while protocol landed at 113.

---

## FIX 1 — KING'S SHIELD LOWERS ATTACK THROUGH `Battle#boost`, NOT THROUGH A WRITE TO `boosts`

`data/moves.ts:9946-9948`, `kingsshield.condition.onTryHit` (Champions inherits it whole —
`data/mods/champions/moves.ts:555-559` changes only `pp` and `isNonstandard`):

```
if (this.checkMoveMakesContact(move, source, target)) {
  this.boost({ atk: -1 }, source, target, this.dex.getActiveMove("King's Shield"));
}
```

`boost(boost, target, source, effect)` — the Attack that moves belongs to the ATTACKER and the SOURCE
of the drop is the shielder. Three facts hang off that call and this engine's `punishesContact`
consumer had none of them, because it wrote the vector straight into `m.boosts`:

- **Contrary** inverts the sign (`runEvent('ChangeBoost')`, `sim/battle.ts:2020`) — the punish becomes
  **+1 Attack**;
- **Defiant / Competitive** retaliate per stat lowered by a non-ally (`AfterEachBoost`, `:2073`);
- **the Clear Body class** refuses it and writes `|-fail|<attacker>|unboost|[from] ability: …`.

Every other stat-drop site in `medicham2-browser.js` already goes through `applyStatDrop` — twelve of
them carry the WIRE 100b marker. This one never did. It is CLAUDE.md's FACTS-ARE-GLOBAL rule broken:
*what happens when a foe lowers my Attack* is a fact about the game, not a property of the branch that
applied it. Same shape as WIRE 138, one site late.

**MEASURED, NOT INFERRED.** Two BOARD-MATERIAL first-divergence rows on `a985300cb8ed`:

```
unrelated event mismatch :: |-boost|p2a|atk|1 <> |-unboost|p2a|atk|1
unrelated event mismatch :: |-boost|p2b|atk|1 <> |-unboost|p2b|atk|1
```

Both are a Staraptor-Mega Brave Bird into an Aegislash King's Shield.
`D.species.get('staraptormega').abilities` is `{"0":"Contrary"}` — DERIVED off the species row, never
typed — which is why the authority writes `-boost` where this engine wrote `-unboost`.

**Membership printed before wiring:** `punishesContact` has three members in this format
(`kingsshield`, `banefulbunker`, `spikyshield`) and **King's Shield is the only one carrying
`boosts`**. `invertsBoosts` has exactly one carrier (`contrary`, 299 sheets). The probe prints both
memberships on every run, so a second member arriving upstream is named rather than silently untested.

A raise is not a drop and is not routed through `applyStatDrop` (which subtracts a magnitude); a
positive entry arriving upstream keeps the raw write and is COUNTED
(`MEDFAILS.shieldPunishNotADrop`), never silently inverted.

`tests/probe_shield_punish_boost.js`, knob `MEDI_SHIELD_PUNISH_RAW_BOOST`. Five arms:

| arm | | authority `boosts.atk` |
|---|---|---|
| `contrary` Malamar/Contrary | UNDER TEST | 0 → **+1** |
| `defiant` Kingambit/Defiant | UNDER TEST | 0 → −1 then **+2** |
| `clearbody` Metagross/Clear Body | UNDER TEST | 0 → 0, plus `-fail … unboost` |
| `plain` Malamar/**Suction Cups** | CONTROL | 0 → −1 |
| `protect` plain Protect instead | CONTROL | no line at all |

`plain` is the knob-cleared control the Choice Scarf lesson demands: the SAME Malamar, the SAME
Facade, the SAME shield, one ability changed. The authority reads `0,-1` there and `0,+1` on
`contrary`, so the knob demonstrably moves the AUTHORITY — an identical pair would have meant the
fixture never exercises the mechanic. **RED FIRST: 13 FAILED.** After the fix: ALL CLAUSES HELD; the
knob reproduces exactly those 13.

**Result:** board-material **50 → 48**, protocol **114 → 113**. Both named rows to zero, one row added
(the Stance Change one), `unrelated event mismatch` 20 → 18, everything else identical.

---

## FIX 2 — AN ABILITY THAT ARRIVES MID-BATTLE RUNS ITS OWN `Start`

Two doors in the authority, and this engine had neither:

```
Battle#skillSwap      sim/battle.ts:1339-1340
  this.singleEvent('Start', sourceAbility, target.abilityState, target);
  this.singleEvent('Start', targetAbility, source.abilityState, source);   // TARGET first, then SOURCE
Pokemon#setAbility    sim/pokemon.ts:1946-1949
  if (ability.id && this.battle.gen > 3 && ...)
    this.battle.singleEvent('Start', ability, this.abilityState, this, source);
```

`abRewrite()` here already carried the outgoing ability's `End` (the Flash Fire volatile clause added
2026-08-29) and was the ONLY half. So **every entry handler in the format was dead on a mid-battle
rewrite** — no weather, no terrain, no Intimidate, no Screen Cleaner, no Frisk.

**MEASURED, NOT INFERRED.** Two BOARD-MATERIAL rows on `583f3f5ff815`, both a Skill Swap, both read
off `data/divergence-turns.json` with the `-activate` line sitting immediately above the split:

```
event missing from medicham2 :: |-unboost|p1b|atk|1 <> |upkeep
   |-activate|p1b: Wyrdeer|Skill Swap|flashfire|intimidate|[of] p2a: Ceruledge
   then |-unboost|p1b: Wyrdeer|atk|1     — Ceruledge's NEW Intimidate, on the body that handed it over

event missing from medicham2 :: |-weather|sandstorm|[from]sandstream <> |move|p1b|knockoff
   |-activate|p2a: Medicham|Skill Swap|sandstream|purepower|[of] p1b: Tyranitar
   then |-weather|Sandstorm|[from] ability: Sand Stream|[of] p2a: Medicham
```

The second one is the expensive shape: that battle then ran its whole remaining length with a
sandstorm on the authority's side and **no weather at all** on ours — a residual chip on every
subsequent turn that we were not paying.

**IT IS `applyEntryEffects` + `applyEntryDrops`, THE SAME TWO THE SWITCH-IN PASS CALLS.** "What does
this ability do when it starts" is one fact and a second implementation would drift from the
switch-in one exactly as the Mold Breaker seam did (WIRE 128). `runEntryPass` itself is deliberately
NOT called: it also lays side conditions, resolves hazards and re-syncs the field, none of which a
Skill Swap does. An entry PASS is a bigger event than an ability's `Start`, and firing the pass is
precisely what the `swap-inert` and `no-swap` controls exist to catch.

Four call sites, one helper (`abilityStarted`): both ends of Skill Swap in the authority's order
(target first), the one-ended write (Worry Seed / Entrainment / Simple Beam) and Role Play.

`tests/probe_ability_start_on_rewrite.js`, knob `MEDI_NO_ABILITY_START_ON_REWRITE`. Five arms:
`swap-into-intimidate` (target end), `swap-into-weather` (source end), `entrain`, `swap-inert`
(CONTROL), `no-swap` (CONTROL). **RED FIRST: 8 FAILED**, both swap arms parting on the BOARD
comparator — `p1.active[].boosts.atk` on one, `field.weather` plus four `hp` leaves on the other.
After the fix: ALL CLAUSES HELD; the knob reproduces exactly those 8.

**Result:** board-material **48 → 46**, protocol **113 → 111**. Exactly the two named rows removed,
**zero causes added**, and `DIFFERENT-END-STATE` improved 30 → 29.

### THE PROBE WAS WRONG BEFORE THE ENGINE WAS, TWICE, AND BOTH ARE THE LESSON

1. **The weather arm's first draft was VACUOUS.** Tyranitar stands on the field, so the sandstorm its
   own entry set was ALREADY UP, and a Sand Stream arriving by swap re-set a sky that was already
   there — the authority wrote nothing, both engines agreed on nothing, and the probe would have gone
   **green straight through the defect**. It now spends turn 1 putting RAIN up and asserts that the
   authority's sky is DIFFERENT either side of the swap.
2. **`global.window = {}` broke the first arm.** Created to read `data/abra-tags.js`, it made
   `data/move-effects.js` write to the invented window while medicham2 reads back off `globalThis`,
   so the first arm threw `MOVE_EFFECTS not loaded` — which reads exactly like a broken engine.
   `tests/probe_imprison_seal.js:93` documents this trap; both new probes now read the tags in a `vm`
   sandbox.

A third probe error was the same class: comparing the raw weather string across engines. Showdown
spells it `sandstorm` and medicham2 `sand`; `board_state.js` maps them and calls those boards
identical, so a raw comparison reports a defect the measurement it defends cannot see — the mistake
four separate probes made in batch C.

### WHAT IS NOT FIXED AND IS STATED

`imposterCopy` and `traceCopy` sit ABOVE `applyEntryEffects` in `runEntryPass` and are NOT called
from `abilityStarted`, so **a Trace arriving by Skill Swap still copies nothing.** Real, remaining,
and it belongs in its own pass with its own probe rather than folded in silently — Trace has to pick
a target off a live foe list, and the authority reaches it through the same `Start`.

---

## FIX 3 (INSTRUMENT) — THE `any` DICE BUCKET IS MEASURED NOW, AND IT STILL VOIDS NOTHING

**THIS IS THE HALF OF THE BRIEF THAT SAID "MAKING IT MEASURABLE IS WORTH MORE THAN GUESSING AT A
FIX", AND THE FIRST THING IT DID WAS OVERTURN A FILING.**

`midGameVoid()` restricts its identity check to five OUTCOME categories — `acc`, `crit`, `sec`,
`dmg`, `stall` — and says why: pooling `any` dragged a 98-99% identity to 70-78% and voided three
quarters of a run, and the same engine measured 95.2% on one sample and 37.0% on another. **That
decision stands and is not reopened.** Nothing here voids a game, consumes an address, applies
`MID_OVERLAP_FLOOR` or moves `PIN_DIGEST`.

What it changes is that the bucket stops being invisible. Twelve of the 46 board-material
first-divergence rows turn on a coin the authority flips OUTSIDE the four wrapped methods — the
post-hit ability procs (Poison Touch ×6, Flame Body, Cursed Body) fire inside
`runEvent('DamagingHit')`, and full paralysis is `randomChance(1,8)` in `conditions.ts` — so all of
them address as `any`, and nothing could tell *"our simulator applies this wrongly"* from *"the two
engines flipped different coins"*.

**PROVEN TO DECIDE NOTHING, THREE TIMES.** The same release `2a5fd78725e7` was re-run after each
version of the block: protocol 111, board-material 46, and `classes`, `first_divergences`,
`state.first_board_divergences` and `end_state` **byte-identical strings** every time.

### THE POPULATION

```
games 961        both sides drew an `any` value 727
  identical                      669
  neither-drew                   118
  medicham2-drew-none            110
  partly-shared                   48
  authority-drew-none              6
  nothing-shared                   5
  agrees-above-the-void-floor      5

which field of `seed|turn|cat|move|target|nth` disagreed
  no-counterpart on the authority side   717
  target differs                          26
  target+nth / turn+target / turn          3
```

The dominant unshared shape is **`any closecombat [sd only]` ×449**, then `makeitrain` 105,
`dracometeor` 60, `overheat` 37, `superpower` 17, `leafstorm` 14 — every one a SELF-DROP move.
`BattleActions#selfDrops` (`battle-actions.ts:1325`) takes `this.battle.random(100)` for the
self-drop chance **even when `chance` is undefined**, and this engine never takes that die. Harmless
to the outcome; decisive for reading the identity rate.

### THE ASYMMETRY THAT WOULD HAVE FILED THE ROWS THE WRONG WAY

The first version published only `shared / min(|sd|,|me|)` — the same denominator the void check uses.
On this pool the smaller side is almost always medicham2's, so `identical` means *"every address the
SMALLER side computed is on the other side"* and a game can read `identical` **while the authority is
flipping a coin at an address this engine never named**. That is exactly the Poison Touch shape.
`shared / max(...)` is published beside it as `rate_over_larger`, together with per-game `sd_only`
and `me_only` counts, and the per-cause verdict is built off THOSE.

A second version marked `neither-drew` as instrument-suspect because its rate was `null`. That is
backwards, and `midGameVoid`'s own `no-addresses` clause already says so: neither engine flipped a
coin, so there is nothing to disagree about and it is the STRONGEST evidence in the run. Corrected.

### THE JOIN, WHICH IS THE WHOLE POINT

`mid_void.any_bucket.by_cause` puts the per-game `any` verdict on the same row as the game's own
first-divergence CAUSE. Of the **39 board-material causes** it can join:

- **13 have SHARED coins → the SIMULATOR is wrong, and these are the ones to fix.**
- **26 are INSTRUMENT-SUSPECT → withhold, do not fix.**

The thirteen actionable ones, and note that **five of them are one family**:

```
1  medicham2 stopped emitting while showdown continued :: |-enditem|p2b|sitrusberry|[eat]
1  medicham2 stopped emitting while showdown continued :: |-enditem|p1b|sitrusberry|[eat]
1  event missing from medicham2 :: |-enditem|p2a|sitrusberry|[eat] <> |switch|p2a|clefable,l50|H/H
1  extra event emitted by medicham2 :: |-damage|p2a|H/H|[from]recoil <> |-enditem|p2a|sitrusberry
1  extra event emitted by medicham2 :: |-enditem|p1b|sitrusberry|[eat] <> |-damage|p1a|H/H
1  -crit: a different body :: |-crit|p2a <> |-crit|p2b
1  unrelated event mismatch :: |move|p1a|moonblast <> |-damage|p1a|H/H|[from]confusion
1  extra event emitted by medicham2 :: |faint|p2b <> |-start|p1b|perish0
1  showdown stopped emitting while medicham2 continued :: |switch|p2a|pelipper,l50|H/H
1  ordering :: |-enditem|p1b|whiteherb <> |detailschange|p2a|raichumegay,l50
1  extra event emitted by medicham2 :: |move|p2b|rockslide <> |-hitcount|p1:|1
1  extra event emitted by medicham2 :: |-damage|p2b|H/H|[from]lifeorb <> |-unboost|p2b|def|1
1  -damage field 3 :: |-damage|p2b|H/Hbrn|[from]brn ... [142/146 vs 137/146]
```

**THE SITRUS BERRY TIMING FAMILY IS THE LARGEST ACTIONABLE BOARD-MATERIAL BUCKET LEFT — 5 GAMES, ALL
WITH SHARED COINS.** It is the natural head of batch E.

And the 26 suspect ones include **all six Poison Touch rows** (`sd_only` 1–5, `rate_over_larger`
0.43–0.88), **all three `|cant|par` rows**, both `slp` rows, Cursed Body, Flame Body and both `-damage
field 3` rows. Those are a verdict to WITHHOLD on, not defects to chase in the simulator — which is
the same discipline the outcome categories already get from the void rule, now extended to a bucket
that had none.

**THE REAL FIX FOR THAT FAMILY IS NAMED AND NOT TAKEN:** give the post-hit ability proc its own
address CATEGORY on both sides, exactly as ROADMAP #478 did for `tgt` and the M6 pass did for the
confusion `dmg` read. That moves `PIN_DIGEST`, so a run after it is not comparable draw-for-draw with
a run before it, and it belongs in its own pass with its own before/after — not inside a batch that
is publishing two engine deltas.

---

## THE CLAUSES THIS PASS STALED WERE RE-RUN ON `2a5fd78725e7` AND NONE MOVED

- **Damage differential:** 0 disagreements of **6000** at the midpoint, 0/6000 at both endpoint arms,
  0/6000 at all fourteen interior indices. Seed 20260804.
- **Roster:** items **140 of 148 tested**, abilities **129 of 202**, moves **475 of 500**;
  `FIRED-AND-BOARDS-DIFFER` **0** and `DID-NOT-FIRE` **0** on all three stages; `reds` not-ok **0** on
  all three (18 / 29 / 35 demonstrations).
- **`all_mechanics_fire.js --kind all --write`:** 1313 games, **0 threw, 0 sheets unassembled**,
  artifact re-stamped onto `2a5fd78725e7`.
- **`tests/test-game-diff.js`:** green — the instrument test over the file this pass edited.
- **Census:** regenerated after the last engine change — **829 live / 829 probed / 0 missing, 0
  hollow, 0 threw, 0 unarmed.** Level. It has never gone down.

`node engine/status.js` reads **7 of 9**, and the two failures are exactly the two whole-game clauses
on their measured counts (board-material 46 of 961 = 4.8%, narration 69 of 961). The third clause
that was momentarily red — `mechanics / each one staged and compared against showdown` — was an
UNSTAMPED artifact, not a divergence: `all-mechanics-fire.json` still recorded release
`a985300cb8ed`. Re-running it with `--write` cleared it. It is recorded here rather than quietly
fixed because "measured against a different engine" reading as a mechanics failure is exactly the
shape `docs/LESSONS.md` §12 is about.

---

## FILES

- `engine/medicham2-browser.js` — the `punishesContact` boost branch through `applyStatDrop`; new
  `abilityStarted()` and its four call sites; two knobs; six counters. **LF endings preserved and
  checked** (0 CR bytes) — the batch C CRLF incident moved every release digest with zero code change.
- `engine/game_differential.js` — `midAnyIdentity()`, the `mid_void.any_bucket` block and the
  per-game stamp. Decides nothing; proven three times over.
- `tests/probe_shield_punish_boost.js` — new, 5 arms, knob `MEDI_SHIELD_PUNISH_RAW_BOOST`.
- `tests/probe_ability_start_on_rewrite.js` — new, 5 arms, knob
  `MEDI_NO_ABILITY_START_ON_REWRITE`.
- `data/verification/_prediction-longtail-D-shieldpunish.json`,
  `data/verification/_prediction-longtail-D-abilitystart.json` — written before their runs.
- `data/verification/longtail-D-shieldpunish.json`, `longtail-D-abilitystart.json`,
  `longtail-D-anybucket.json` — the three measured artifacts.
- `data/game-differential.json` — republished at 46 / 111 on `2a5fd78725e7`.
- `data/mechanics-census.json`, `data/all-mechanics-fire.json`, `data/roster.{items,abilities,moves}.json`,
  `data/game-diff.json`, `data/verification/engine-diff.n150.json` — regenerated.

**NOT TOUCHED, as instructed:** `engine/status.js`, `engine/quarantine.js`, `engine/docs_scan.js`
(another agent held those), `engine/steering.js`, `data/policy-weights.json`, `engine/board.js`,
`engine/magnemite.js`, `data/engine-data.js`. **`data/tags.json` and `data/abra-tags.js` are
UNTOUCHED** — neither fix needed a tag regeneration; both defects were a consumer bypassing a
derivation that was already correct.

**Nothing downstream becomes quotable.** No model was fitted, no weight vector was written, the
quarantine does not lift, and every withheld figure stays withheld.

---

## THE LIVING-DOCUMENT UPDATE IS OWED, AND THE REASON IS A CONCURRENT WRITER

`CHANGELOG.md` is **NOT** bumped and no 5.261.0 block was added to the white paper, the deck, the
technical docs, `docs/SUMMARY.md` or `docs/MODELS.md`.

**MEASURED, NOT ASSUMED.** At 06:00 the working tree carried `docs/SUMMARY.md` modified 57 seconds
earlier, `docs/MODELS.md` 2.5 minutes earlier and `docs/ABRA-whitepaper.md` 10 minutes earlier — none
of them opened by this session — and their diffs are whole blocks being deleted and replaced, not
appends. CLAUDE.md's single-writer rule says two agents that cannot see each other's edits produce a
silent later-write-wins, and this is that case.

**AND BUMPING THE CHANGELOG ALONE WOULD HAVE SHIPPED A RED TEST**, which batch C already paid for:
raising it to 5.260.0 stranded six documents at 5.259.0 and turned `tests/test-docs-current.js` RED.
Leaving the version at 5.260.0 keeps that gate at **24 passed, 0 failed** with the `docs/ENGINE.md`
block in place — verified this pass.

**What is owed:** a 5.261.0 block in each of the five, and the white paper's lead paragraph — which
still publishes *"BOARD-MATERIAL HELD AT 50 OF 961 AND PROTOCOL FIRST-DIVERGENCE FELL 151 -> 114"* —
superseded by 46 / 111 on `2a5fd78725e7`.
