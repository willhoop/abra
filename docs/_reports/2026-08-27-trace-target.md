# Trace's target — the turn-0 board-material divergence, `pair-redirect-priority`

ENGINE, 2026-08-27. Full account. Verdict lives in the handback; this file is the working.

---

## 1. THE QUESTION I WAS TOLD TO LEAD WITH: DOES THE AUTHORITY'S TRACE CONSUME A RANDOM DRAW?

**YES, AND IT DRAWS EVEN WHEN THERE IS ONLY ONE CANDIDATE.**

`data/mods/champions/abilities.ts` is **100 lines** and contains **no `trace` entry** — grepped
case-insensitively over the whole file, not a head read. So Champions inherits mainline.

Mainline `data/abilities.ts:5110`, read in full (`onStart` at :5111 through `num: 36` at :5150):

```js
onUpdate(pokemon) {
  if (!this.effectState.seek) return;
  const possibleTargets = pokemon.adjacentFoes().filter(
    target => !target.getAbility().flags['notrace'] && target.ability !== 'noability'
  );
  if (!possibleTargets.length) return;
  const target = this.sample(possibleTargets);      // <- THE DRAW
  const ability = target.getAbility();
  pokemon.setAbility(ability, target);
},
```

The chain, each link read rather than recalled:

| link | file:line | what it does |
|---|---|---|
| `Battle#sample` | `sim/battle.ts:355` | `return this.prng.sample(items)` |
| `PRNG#sample` | `sim/prng.ts:132` | `const index = this.random(items.length)` |
| `PRNG#random` | `sim/prng.ts:91` | `const result = this.rng.next();` — **unconditional**, so `random(1)` still advances |

So the pick is a **uniform index into the ELIGIBLE list**, not into the slots, and it costs one draw
whatever the list length.

---

## 2. THE DIAGNOSIS — TRACE, NOT A MIS-KEYED PARTY. ESTABLISHED THREE WAYS.

The brief flagged the alternative explicitly ("a party keyed to the wrong body is a completely
different bug"), so it is refuted rather than assumed away.

**(a) The shape of the diff.** Both paths — `p1.party.gardevoir.ability` and `p1.active[0].ability` —
carry the same pair and **nothing else differs**. A body read under the wrong key would move
`species`, `hp` and `maxhp` with it. Only `ability` moved.

**(b) The sheets.** The pair's tag names two store records. Read out of
`data/team-pool-frozen/games.bo3.jsonl`:

```
p1  gardevoir/Trace  incineroar/Intimidate  sinistchamasterpiece/Hospitality
    blastoise/Torrent  talonflame/GaleWings  kingambit/Defiant
p2  gengar/CursedBody  swampert/Torrent  incineroar/Intimidate
    politoed/Drizzle  archaludon/Stamina  vivillon/CompoundEyes
```

`cursedbody` exists on exactly one body on the board, p2's **Gengar**. `torrent` is ambiguous — it is
on p2's Swampert AND on p1's own Blastoise — which is precisely why (a) is load-bearing and why "the
p1 body got its own Blastoise's ability" had to be ruled out on the diff shape rather than on the name.

**(c) The game, replayed.** Rebuilt the pair through `G.pairsFor('pair-redirect-priority')`, matched
on the tag, played it under `--arm middle`:

```
showdown  |-ability|p1a: Gardevoir|Cursed Body|Trace|[from] ability: Trace|[of] p2a: Gengar
medicham  |-ability|p1a: Gardevoir|torrent|[from] ability: trace
```

The leads are Gengar (slot 0) and Swampert (slot 1). Neither ability carries `notrace`, so
**eligible = 2** and `MEDSEEN.traceAmbiguousChoice = 1`, `traceChoiceDie = 1`, `traceChoiceNoDie = 0`
— the die was in scope on our side and was read. Showdown took index 0, medicham took index 1.

**It is a target-choice divergence. Not a party key.**

---

## 3. THE MECHANISM — THE `nth` OFFSET, MEASURED FROM BOTH SIDES

The middle arm addresses every draw `seed|turn|category|move|target|nth`. At the lead-in
`battle.turn === 0` and there is no active move, so the whole lead-in shares one bucket
`20260813|0|any|-|-` and only `nth` separates its members.

Wrapping `Battle.prototype.{random,randomChance,sample}` and capturing a stack for every draw with
`this.turn === 0` on that exact game:

```
[0] random(2,4)      BattleQueue.insertChoice  <- sim/battle-queue.js  <- BattleActions.switchIn
[1] sample([len 2])  Battle.onUpdate           <- data/abilities.js:5079  (Trace)
```

Two authority draws. `G.midAddresses()` on the same game:

```
authority   20260813|0|any|-|-|0     the queue tie
            20260813|0|any|-|-|1     Trace
medicham    20260813|0|any|-|-|0     Trace          <- the SAME event, a different nth
```

`BattleQueue#insertChoice` (`sim/battle-queue.ts:395`) is

```js
const index = firstIndex === lastIndex ? firstIndex : this.battle.random(firstIndex, lastIndex + 1);
```

— the RANGE form, drawn only when the four lead-in `runSwitch` actions contain a tie in
`comparePriority`. medicham2 models no such queue and takes no such draw, so its Trace sat at `nth 0`
while the authority's sat at `nth 1`.

**The arithmetic closes it exactly.** With the finalised hash:

```
20260813|0|any|-|-|0   u = 0.653086479   floor(u*2) = 1   -> eligible[1] = Swampert  -> torrent
20260813|0|any|-|-|1   u = 0.486125964   floor(u*2) = 0   -> eligible[0] = Gengar    -> cursedbody
```

which is the observed pair, on both sides, with nothing left over.

---

## 4. NEWLY VISIBLE, NOT NEWLY BROKEN — AND THE FIGURE THAT SAYS SO

The brief asked me to say which. Recomputing the same two addresses under the **bare FNV-1a** that
`midHash` used until ROADMAP #489 landed this morning:

| hash | `nth=0` | `nth=1` | `floor(u*2)` | verdict |
|---|---|---|---|---|
| bare FNV-1a (pre-2026-08-27) | 0.429382539 | 0.425476195 | 0 and 0 | **the two engines agreed BY ACCIDENT** |
| finalised (`f646b0163bc0`) | 0.653086479 | 0.486125964 | 1 and 0 | they part |

The old hash translated rather than re-drew on a change to the trailing field, so an `nth` offset of
one moved `u` by 0.0039 — a 2-way choice only flips inside a window of that width around 0.5, i.e.
about 0.4% of addresses. **The defect is as old as the arm. The finaliser made it observable.**

---

## 5. IS IT A SHARED ROOT WITH THE OTHER ELEVEN? — MEASURED, AND NO

The brief said to STOP for a decision if it is. It is not, so I did not.

Instrumented every authority draw with its call site over **183 games** (all seven configs, 30 pairs
each, arm `middle`), and asked per game: *is there an `insertChoice` draw followed by another draw at
the SAME base address `turn|move|target`?*

```
games 183   games with a POISONED bucket: 1
   pair-redirect-priority :: ...2654427821 vs ...2654364770   base=0|-|-   after=[Battle.onUpdate]
```

**Exactly one, and it is this game.** The wider draw-site census over 60 games:

```
   349 randomChance  Battle.onStallMove          311 one  Battle.randomizer
   311 randomChance  BattleActions.hitStepAccuracy   311 randomChance  BattleActions.getDamage
   221 sample  Side.randomFoe                   112 one  BattleActions.secondaries
    36 sample  Battle.onResidual                 20 sample  Battle.getRandomSwitchable
    17 sample  Battle.onUpdate                    9 range BattleQueue.insertChoice
     8 one     BattleActions.selfDrops            8 randomChance Battle.onFractionalPriority
     3 sample  Battle.onStart                     2 randomChance Battle.onBeforeMove
     2 randomChance BattleActions.hitStepMoveHitLoop
     1 range   Battle.onStart                     1 range Battle.durationCallback
```

Three range-form callers, all three dice medicham2 does not roll (`durationCallback` and the
condition `onStart` are durations, which this engine takes at the authority's minimum —
`MEDSEEN.confusionMinDuration`).

---

## 6. THE FIX — THE ARM'S OWN RULE, APPLIED WHERE IT WAS MISSED

`engine/game_differential.js`, `makeArm`'s `pinRandom`, four lines:

```js
if (n !== undefined && cat === 'any' && !MID_RANGE_LIVE) { MID_RANGE_PINNED++; return m; }
```

The three scalar arms have always returned `m` for the range form — the header says so in as many
words (*"the sleep duration, a multi-hit count and a queue insertion index"*). The middle arm did not,
and it is the only one that consumes a shared address.

**This is the same argument the arm already makes twice, in mirror.** `pinShuffle` is a no-op in every
shipped arm and medicham2's tie coin is `() => 0` here, both because *"what is removed is a die the
authority does not roll"* — that was written about medicham2 rolling one the authority does not. The
queue insertion index is the same tie through a different door, with the sides swapped, and it was
missed.

**Narrowed to `cat === 'any'`** so the damage machinery is untouched: inside `getDamage` the only
draws are `randomChance` (crit) and the one-argument `randomizer` — read in `sim/battle-actions.ts`,
not assumed — and `MIDW.cat` there is `dmg`/`crit`.

`MEDI_MID_RANGE_DRAWS=1` restores the draw. `range_form_pinned` / `range_form_live_draws` /
`range_form_knob` are published in the artifact.

**`DICE_MODEL` bumped `split/v2` -> `split/v3`, so `PIN_DIGEST` moves `f646b0163bc0` ->
`44bd49403231`** and `engine/arms_comparable.js` refuses to table a run either side of it. That is
required, not incidental: pinning the insertion index changes queue order in tied games, so a run
before and a run after are two instruments.

---

## 7. THE PROBE — `tests/probe_trace_target.js`

`tests/probe_trace_choice.js` was **green on the `middle` arm the whole time**, including while this
divergence sat in the artifact. Its fixture never staged the collision. That is a fixture verdict, and
the new file exists because of it.

- Everything is derived from `Dex.forFormat('gen9championsvgc2026regmb')`, filtered
  (`exists && !isNonstandard && tier !== 'Illegal'`), and printed: the Trace carrier, the two foes,
  the `notrace` membership.
- **Eligible foes are derived and REFUSED below two** — the file exits 1 if
  `traceAmbiguousChoice < staged` or if `traceChoiceNoDie > 0`, because a one-candidate board has no
  choice to get wrong and a green cell there proves nothing.
- The ALLY on p1b is the knob. **Which allies tie is MEASURED**, off `G.midRangeCounters()`, never
  guessed. A sweep of 24 derived species produced **3 TIE boards and 21 NO-TIE controls**; the file
  refuses to pass if either set is empty.
- No typed expectation anywhere: the verdict is Showdown's own `|-ability|…|[from] ability: Trace`
  against medicham2's, folded to ids.

Clean arm:

```
RANGE-FORM RECEIPT   pinned=4  live=0  knob=false
AUTHORITY   TIE boards -> [pressure]    NO-TIE boards -> [pressure]
BOARDS      TIE 3/3 agree;   NO-TIE 21/21 agree
```

Red arm (`MEDI_MID_RANGE_DRAWS=1`, a child because the knob is read at module load):

```
RANGE-FORM RECEIPT   pinned=0  live=4  knob=true
AUTHORITY   TIE boards -> [snowwarning]    NO-TIE boards -> [pressure]
BOARDS      TIE 0/2 agree;   NO-TIE 22/22 agree
```

The authority's own answer **moves** across the knob (`pressure` -> `snowwarning`), which is what says
the fixture reached the die at all; medicham2's does not move, which is the defect. 22 of 22 no-tie
controls hold under the knob, so it is not over-firing.

**The parent judges the child on NUMBERS, not on its exit code**, and the first draft got that
backwards — under the knob the child's own clauses assert the defect is PRESENT, so a working knob
makes it exit 0, and reading that as "the red arm passed" is the inverted control this repo keeps
paying for. It prints a `KNOB-VERDICT` line and the parent asserts `live > 0`, `pinned === 0`,
`tie > 0`, `tieDiff === tie`, `noDiff === 0` and `sdTie !== sdNo`, each failing by name.

A pin claim was added beside it, asserted in BOTH directions so it cannot pass by being dead:

```
'the RANGE form consumes NO shared address in this arm  [MEDI_MID_RANGE_DRAWS=1 restores it]'
```

---

## 8. AN INSTRUMENT FAULT THAT NEARLY PUBLISHED A 30x REGRESSION

Recorded because it is the whole reason the number below is trustworthy.

The first re-run took `--release 6272fa445b73` from a scratch `.cmd` left in the tree, and reported
**diverged 19 -> 366, board-material 12 -> 370, void 1 -> 31**. That is not what my change did. The
baseline artifact records `engine_release: f9f3a61481cb`; the scratch file was stale by a release.
**Two different simulators, one of them not the one the baseline was measured on.** Re-run on
`f9f3a61481cb` the number is 11.

Read the release id out of the artifact you are comparing against. Never off a leftover command.

---

## 9. THE MEASUREMENT — LIKE FOR LIKE

Release `f9f3a61481cb`, arm `middle`, `--games 1200` (yields 961), cap 12,
`--team-store data/team-pool-frozen`, census pin `9446a684709d`, `--state --end-state`.

| | before | after |
|---|---|---|
| pin digest | `f646b0163bc0` | **`44bd49403231`** (moved on purpose) |
| games | 961 | 961 |
| raw diverged | 19 | 19 |
| threw | 0 | 0 |
| void (instrument desync) | 1 | 1 |
| whole-game (19 raw less 5 declared) | **14 of 961** | **14 of 961** |
| board never diverged | 949 | **950** |
| **board-material** | **12 of 961** | **11 of 961** |
| median turn of first board divergence | 5 | 5 |
| board parted before the protocol did | 5 | **4** |
| range-form draws pinned | n/a | 405 |
| range-form live draws | n/a | 0 |

**PREDICTED BEFORE THE RUN: 12 -> 11 if this is one game.** It is 11.

**The board-material row set was diffed, not just counted:**

```
GONE:  pair-redirect-priority | t0 | p1.party.gardevoir.ability, p1.active[0].ability
NEW:   (none)
```

Exactly one row removed, the right one, and nothing else appeared. Whole-game is unmoved and that is
correct rather than a disappointment: this divergence carried `protocol_diverged_at_turn: null`, so it
was never in the protocol-based count.

**UNMOVED, checked rather than assumed:**

- census **764 live / 764 probed / 0 missing** (`tests/test-mechanics.js`) — unchanged; my change is
  instrument-side and cannot reach it, and the run says so rather than the sentence;
- three roster stages on release `f9f3a61481cb`, **byte-identical verdict distributions**:
  items 139 / abilities 129 / moves 475 `FIRED-AND-BOARDS-MATCH`, **0 `FIRED-AND-BOARDS-DIFFER` and
  0 `DID-NOT-FIRE`** in all three;
- `all_mechanics_fire --kind all --write` summary identical — moves diverged 8, abilities 3, items 1;
- `test-middle-identity`, `test-middle-draw-scope`, `test-middle-damage-roll`,
  `test-middle-stall-address`, `test-roster-arm-pin`, `test-damage-roll-support`, `test-end-state`,
  `test-game-diff`, `test-coverage-stop`, `test-volatile-duration`, `probe_trace_choice` — all exit 0;
- the damage gate stays `0 of 6000` at all sixteen corners (`status.js` PASS clause). The brief warned
  an ability change can reach damage; this one does not touch the `dmg`/`crit` categories at all, and
  the corner arms are bit-identical because the branch is inside `if (spec.middle)`.

**SERIALISATION.** I waited. `data/game-differential.json` was last written 10:24:49 and I checked its
mtime at 10:39, 10:49, 11:00 and 11:04 before starting — 40 minutes stable — and re-checked
immediately before the run. All the diagnostic work above was done first and none of it writes that
artifact.

---

## OWED, NOT RUN

- **The other two range-form callers have no staged board of their own.** `Battle.durationCallback`
  and a condition `onStart` were each measured drawing once in 60 games and are neutralised by the
  same change. They are now pinned to the authority's minimum, which is what the three scalar arms
  already do and what medicham2 already takes — but that is an argument, not a staged measurement.
  Named here rather than covered.
- **The `any` bucket is a catch-all and this fix does not narrow it.** Every non-move authority draw
  on a turn shares one address separated only by `nth`, and `Side.randomFoe` (221 draws in 60 games)
  and `Battle.onResidual` (36) live in it too. The `nth` collision class is smaller now, not gone.
  Making the authority's category finer would be a second, larger change to the arm.
- **Whether the value the shared address yields is the value the real game would yield.** The middle
  arm's die is a hash; there is no ground truth for which foe Trace picks, only the claim that both
  engines read the same one. The probe asserts agreement, never correctness of the pick.
- **The pool did not get a chance to move and I did not ask it to.** This is a rare mechanic — one
  game in 961, one poisoned bucket in 183 — so the scoreboard I said before the run I would check is
  the board-material count on the pinned pool, and it moved by exactly the predicted one.
- **`arms_comparable.js` was not run across the new digest.** The refusal is the mechanism; I asserted
  the digest moved (`f646b0163bc0` -> `44bd49403231`) and did not exercise the refusal itself.
- **The remaining eleven board-material games are untouched** and no shared root with them was found
  (1 poisoned bucket in 183 games). That is evidence against a shared root, not proof of its absence
  over the whole 961.
