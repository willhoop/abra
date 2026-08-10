# ENGINE — does the simulator do what Pokémon does

**Owns:** `engine/medicham2-browser.js`, `engine/tag_dex.js`, `data/abra-tags.js`,
`tests/test-mechanics.js`, `tests/walk_tags.js`, `tests/test-engine-diff.js`,
`tests/test-game-diff.js`, `tests/interaction_matrix.js`, `tests/test-interaction-matrix.js`,
`tests/mechanics_rank.js`, `tests/mutation_harness.js`, `tests/test-mutation-coverage.js`,
`tests/test-medicham-coverage.js`, `tests/regulation_usage.js`, `tests/probe_red_demo.js`,
`tests/test-protocol-trace.js`, `engine/derive_protocol_events.js`, `data/protocol-events.json`,
`tests/roster.js`, `data/roster.{items,abilities,moves,all}.json` (+ `data/roster.json`, a convenience
copy of whatever stage ran last — **it is not the roster**), `tests/test-nature-differential.js`,
`tests/test-volatile-duration.js`

**Nine instruments, and none substitutes for another:**

| file | asks | structurally cannot see |
|---|---|---|
| `test-mechanics.js` | is ONE mechanic live | tag x tag; and whether a LIVE verdict rests on a probe that asserts rather than proves |
| `test-engine-diff.js` | is ONE HIT's damage right | every turn counter |
| `test-game-diff.js` | do the two engines hold the same STATE after every turn | damage magnitude |
| `test-interaction-matrix.js` | does every carrier x reactor pair resolve the way the official engine says | anything the generator refuses to emit — printed on every run |
| `test-protocol-trace.js` | does the engine EMIT what it did, in Showdown's own protocol shapes, and does every event it claims actually FIRE | whether a MECHANIC is right — it is a stream, not an oracle; the comparison driver over two streams is ROADMAP #68's next step |
| `mutation_harness.js` | does the handler MATTER, or does it only FIRE — change the FACT, watch the BEHAVIOUR | a fact derived WRONG upstream (it is propagated and consumed faithfully and scores LIVE); anything outside `medicham2-browser.js`; a branch no scripted turn reaches, which it counts rather than hides |
| `roster.js` | does EVERY LEGAL ENTITY IN THE FORMAT do anything, and does it do the same thing the authority does — staged from the entity's own upstream data, with a CONTROL arm that removes only it | anything the pin refuses (a sub-100% chance, a crit), anything `board_state.js` does not compare (PP, ability trapping), and anything no shape rule matches — each named, per entity, with its reason |
| `test-volatile-duration.js` | does a duration-bearing volatile carry the number Showdown carries, at every turn boundary — applied, re-applied, and left alone. Plays the LIVE tree by default, so it fails on bytes an author just wrote; `--engine release` plays a snapshot's | anything outside the duration family, and the HP consequences of a lock the engine holds but does not ENFORCE on a caller-supplied action — Encore's remaining row |
| `test-nature-differential.js` | is the two engines' Pokemon the SAME Pokemon — chart, arithmetic, the sheet's declared nature reaching both sides, and the line surviving a mega mid-turn | whether either engine plays the game right; it compares BODIES, not turns. The SPREADS, permanently — an open team sheet does not show them |

**Its one number:** mechanics live. **It must never go down.**

**May not:** claim a strength gain (that is SEARCH, gated by MEASURE), change what board.js
*means* by a feature, or land during a fit or self-play run.

<!-- GENERATED: engine/status.js -->

```
ENGINE — does the simulator do what Pokémon does
  364/364 probed mechanics live, 0 missing   (census 2026-08-10 06:36)
  0/150 differential comparisons disagree with Showdown   (2026-08-10 06:10)
    seed 20260804, requested 150, 11 not comparable (multihit 7, non-finite 0, threw 4)
    a differential hit is NOT in the census count above — the census probes what someone thought to probe
  interaction matrix: 1624/1643 live carrier x reactor pairs agree with the official engine (98.8%)   (2026-08-06 21:50)
    2300 of 8795 theoretical pairs staged — agreement is a claim about the 2300 that ran, not about the 8795
      530 inert      not scored — the reference engine behaves identically with and without the reactor
      109 saturated  not scored — the control arm already dealt 100% of HP, so a damage ratio is clamped
       16 ko-timing  not scored — a damage-magnitude question — tests/test-engine-diff.js owns it
        2 threw      not scored — the harness could not stage it
    DISAGREES  stoneaxe -> roughskin  (secondary, 63 uses)
    DISAGREES  stoneaxe -> wanderingspirit  (secondary, 63 uses)
    DISAGREES  stoneaxe -> mummy  (secondary, 63 uses)
    DISAGREES  stoneaxe -> gooey  (secondary, 63 uses)
    DISAGREES  gigaimpact -> spikyshield  (secondary, 38 uses)
    DISAGREES  supercellslam -> kingsshield  (secondary, 85 uses)
  release ladder: 14 frozen releases x 1997 games, one pinned census   (2026-08-07 17:44)
    median completed turns before divergence: 1 at the baseline, 1 at the top rung  <-- UNMOVED by the whole series
    whole-game agreement 7/1997 -> 134/1997; first-divergence line, mean 14.78 -> 33.98
    paired against the baseline: 1295 games part later, 116 EARLIER, 586 unchanged
    the baseline ran first and last and reproduced exactly; comparability: every arm cleared
  tag coverage: 186/197 probed, 11 unprobed
```

_stamped 2026-08-10 06:39_

<!-- /GENERATED -->

## WIRE 151 — THE PROCEDURAL STAT-CHANGE FAMILY. FIVE MOVES, ONE CLASSIFIER GATE, AND THE TAG HAD NO SHAPE TO SAY "OPERATION" IN. 2026-08-10.

Census **359 live / 359 probed → 364 live / 364 probed**, `missing` **0**, `threw` **0**, `hollow`
**0**, `unarmed` **0**, `directCall` **0**. Damage stages **1728/1728 exact**, unchanged. Five new
probes, each watched RED on its own before the engine changed. **No release was cut by me** — but one
*was* cut, by a gate, and that is reported at the bottom of this section rather than buried. Neither
`tests/roster.js` nor `tests/test-engine-diff.js` was run.

Guard Swap, Power Swap, Psych Up, Topsy-Turvy and Acupressure all resolved to `{kind:'pass',mv:id}` —
a whole no-op turn — and the split was decisive rather than suggestive. The two doors out of the
`statChangeInCode` block both demand a **literal boost table**:

```js
if(_sc3&&_sc3.boosts&&_sc3.on==='user')   return {kind:'statcode',mv:id};
if(_sc3&&_sc3.boosts&&_sc3.on==='target') return {kind:'affect',...};
```

All five carry `{procedural:true}` and nothing else. The only two members that DO carry `boosts`+`on`
— Belly Drum `{atk:12}/user` and Strength Sap `{atk:-1}/target` — are the only two that read MATCH.
**5/5 red, 2/2 green, on that one param**, and both controls stayed green throughout.

### THE FIX IS AT THE DERIVATION, NOT AT THE ENGINE. `op` IS A THIRD SHAPE BESIDE `boosts`.

The old comment in `tag_dex.js` said these five "are not expressible as a stage table … they keep the
tag, get no numbers, and stay visibly unwired". The first half is true and the conclusion does not
follow. They are not tables; they are **operations**, and an operation is as derivable from a handler
as a table is. At the engine all five are one primitive — *read a body's boost vector, transform it,
write it to a named body* — so they are **one function**, `applyStatOp`. At the derivation they are
five, and that is where the work was:

| move | uses | reads | transform | writes | derived `op` |
|---|---|---|---|---|---|
| Guard Swap | 2 | both bodies | exchange | both | `{kind:'exchange', stats:['def','spd']}` |
| Power Swap | 11 | both bodies | exchange | both | `{kind:'exchange', stats:['atk','spa']}` |
| Psych Up | 68 | target | copy | user | `{kind:'copy', stats:'all', from:'target', to:'user'}` |
| Topsy-Turvy | 16 | target | negate nonzero | target | `{kind:'invert', stats:'all', nonzeroOnly:true}` |
| Acupressure | 2 | target, stats `< 6` | random pick, +2 | target | `{kind:'randomOne', stats:'all', amount:2, below:6}` |

`op` is **disjoint from `boosts`** over the whole move table — measured, every member carries one or
the other and never both — so a consumer reading `boosts` keeps working unchanged and cannot be
handed a table nobody derived. `stats` is an explicit array when the handler names one and the string
`'all'` when it iterates `for (i in target.boosts)`; **nothing is invented** when a field cannot be
read, and `applyStatOp` refuses loudly into `MEDFAILS.statOpUnreadable` rather than reaching for a
plausible +2.

### THE MEMBERSHIP PRINT CAUGHT AN OVER-MATCH, WHICH IS THE ENTIRE POINT OF DOING IT

The first `randomOne` rule was a bare `this.sample(` test. Over 954 moves it claimed **Sleep Talk,
Metronome, Assist and Conversion 2** — `sample` is Showdown's generic random pick and three of those
four choose a MOVE. The rule now also demands a `.boosts[...] < N` ceiling **and** a `this.boost(`
call, which is the shape of a stat pick and not of a move pick. Final membership: **six** —
`acupressure`, `guardswap`, `powerswap`, `psychup`, `topsyturvy`, and `heartswap`, which is
`isNonstandard: 'Past'` and unplayable here (its all-seven exchange derives correctly and is never
clicked). `clearsmog` keeps `{procedural:true}` with no `op` and its own `clearsBoosts` tag, which is
right.

### THE TAG REGENERATION, SAID LOUDLY AND DIFFED

`data/tags.json` **and** `data/abra-tags.js` were regenerated (`engine/tag_dex.js`, then
`build/build_tags_js.js` — the second is a separate step and skipping it would have left the engine
reading yesterday's bytes). Against their predecessors, both files:

**entities removed 0 · added 0 · changed 5** — acupressure, guardswap, powerswap, psychup,
topsyturvy, each gaining only `params.statChangeInCode.op`. Nothing else in the corpus moved.
ROADMAP #65's blocker is measured gone rather than assumed gone.

### THREE OF THE FOUR KINDS DELIBERATELY BYPASS THE BOOST PIPELINE, AND THAT IS THE AUTHORITY'S RULE

`setBoost` (the two swaps) and a raw `boosts[i] = …` assignment (Psych Up, Topsy-Turvy) run **no**
`onTryBoost` and **no** `onChangeBoost` — so Contrary does not invert them and Clear Body does not
refuse them. Acupressure alone calls `this.boost(...)`, so it alone goes through `invSign` and
`statDropRefusal`, the same two readers the `affect` branch's own boost loop uses. That is a real
mechanical distinction, not a shortcut, and it is why the family is one function with four arms
rather than four functions.

**ROUTING RATHER THAN A RIDER** (WIRE 146's rule): the new door returns `kind:'affect'` with `sc` and
`si` null. These are status moves aimed across the field and `affect` is where every such move
already runs its gauntlet — `reaimToSlot`, Magic Bounce (Topsy-Turvy is `reflectable`), Protect,
Substitute (all three of Guard Swap / Power Swap / Psych Up are already in `SUBPASS`, correctly: all
three carry `bypasssub`), Good as Gold, Soundproof, powder, Prankster-into-Dark and the accuracy die.
A fresh branch would have restated every one of those and got at least one wrong.

### ACUPRESSURE DRAWS FROM THE BATTLE'S OWN SEEDED DIE, NEVER `Math.random()`

`this.sample(stats)` in the authority; `rng()` here, the same function `battleTurn` already threads
to every other die in the loop. The probe's varied knob is the **die itself**: at 0.1 the draw lands
on `atk`, at 0.9 on `evasion`. A hard-coded stat, or a reach for `Math.random`, fails exactly there —
and a `Math.random` would additionally make every rollout of this move unreproducible.

**The roster's recorded `sd_delta` for Acupressure captures ONE draw (evasion +2), so that row is
reproducible only while the authority's seed is.** No claim is made here about the roster row.

### TWO STALE COMMENTS RETRACTED IN PLACE, EACH WITH THE MEASUREMENT THAT REFUTES IT

Both said evasion is *"a stat this engine has no slot for"*. Both are false, and this is the sixth
guard-kept-past-its-limitation this sprint:

- `medicham2-browser.js` (the `statChangeInCode` target door) — a real **Defog** click on a staged
  doubles board moves the target's `eva` **0 → −1**.
- `medicham2-browser.js` (`applyEntryDrops`) — a **Supersweet Syrup** switch-in puts **both** foes at
  `eva` **−1**, against 0 for the identical board with the ability removed.

`SD2ENG` is `{…accuracy:'acc', evasion:'eva'}` and every body is built with all seven slots
(`{at,df,sa,sd,sp,acc,eva}`). It matters here rather than being trivia: Psych Up **copies** accuracy
and evasion, Topsy-Turvy **inverts** them and Acupressure can **draw** them — a stat the engine
really could not hold would have made all three wrong.

### TWO THINGS THE SWEEP FOUND THAT THE DIAGNOSIS DID NOT NAME

1. **A self/ally-target op with nobody named was FAILING OUTRIGHT.** All three
   `acupressure|*|notarget` sweep rows moved no stage at all. The move's dex `target` is
   `adjacentAllyOrSelf`, so a caller naming nobody is choosing itself; the default is now read off
   `moveFx(id).target` — the same field the `boostally` branch already reads for `allies` — never off
   a name. The other four are `normal` and a null target still fails them, which is correct.
2. **A FOE named for a self/ally-only op was being OBEYED**, so `acupressure|*|aimed` handed the foe
   +2. Showdown never presents that choice. It is now ignored and the click lands on the user. This is
   deliberately **not** the `normal`-target rule WIRE 106 established for Decorate: Decorate's dex
   target ALLOWS a foe and the authority applies it there. Same field, opposite readings, both right.

### ONE PRE-EXISTING DEFECT FIXED BECAUSE THE WIRE WOULD OTHERWISE HAVE EXTENDED IT

The `affect` branch's Protect gate was a bare `if(_t.protect)`. Four other sites in the file write the
pair `(_t.protect && !TAGS.has('move',a.mv,'ignoresProtect'))` and `guardRefusalOf` reads the same
tag — one fact, two implementations, one of them missing half of itself. Psych Up has no `protect`
flag and is why it was found. **It is not only the new move:** `tearfullook` reaches the same branch
and has been blocked by a Protect it goes straight through since the branch was written. Measured
before/after bytes on a board that actually Protects, foe staged with Coil:

| click | BEFORE (user / foe) | AFTER (user / foe) |
|---|---|---|
| `psychup` | `0/0/0/0/0/0/0` / `1/1/0/0/0/1/0` | **`1/1/0/0/0/1/0`** / `1/1/0/0/0/1/0` |
| `tearfullook` | `0/0/0/0/0/0/0` / `1/1/0/0/0/1/0` | `0/0/0/0/0/0/0` / **`0/1/-1/0/0/1/0`** |
| `charm` (control, HAS the protect flag) | unchanged | **unchanged** |
| `guardswap`, `topsyturvy` (both HAVE the flag) | blocked | **still blocked** |

### THE BLAST RADIUS WAS MEASURED, WITH THE THROW COUNT BESIDE THE DIFF COUNT

Every move in `data/tags.json` (500), six scenarios each — mid roll and both pin corners, aimed and
with no target — **two** real turns apiece (turn 1 stages the board: the user Calm Minds, the foe
Coils, so every move meets a body that HAS stages, which is the only board on which a transform over a
boost vector can be told from a no-op). Digested as the whole board: every primitive on all four
active bodies and all four benched ones, plus the field and both side conditions. The BEFORE arm is
`HEAD`'s bytes compiled under the real `engine/` path so its relative requires resolve identically.

**879,848 cells. 126 differ, in 30 of 3,000 scenario rows. Five moves: `acupressure`, `guardswap`,
`powerswap`, `psychup`, `topsyturvy`. 0 THREW on both arms.** Nothing else in the corpus moved by a
single cell — Belly Drum and Strength Sap included.

**The sweep stages no Protect, so it is structurally blind to the `ignoresProtect` fix**, which is why
that has its own table above rather than being folded in and called covered.

### THE PROTOCOL RESIDUE, DECLARED — AND THREE REASONS THAT HAD GONE FALSE

Acupressure calls `this.boost(...)` and therefore emits a real `|-boost|` line; it is fully announced.
The other four use `setBoost` or a raw assignment, which produce Showdown's one-line `-swapboost` /
`-copyboost` / `-invertboost` events, and this engine emits none of them. Those three events were
already declared unemitted in `engine/derive_protocol_events.js` — with the reasons *"Topsy-Turvy is
not modelled"*, *"Psych Up is not modelled"*, *"Heart Swap / Power Swap are not modelled"*. **This
wire makes all three false**, so each was rewritten to say the STATE is modelled and probed and the
ANNOUNCEMENT is owed. `data/protocol-events.json` was regenerated (`--write`); both gates pass,
`emitted` 38 → 38 and `notEmitted` 56 → 56.

**And the regeneration surfaced drift nobody had written back:** `-anim` and `-hitcount` had their
reasons edited by WIRE 147 in the *source* and never re-derived into the *artifact*, which was dated
2026-08-07. That is CLAUDE.md's "a derived artifact is not a fact until something compares it to its
source", caught by running the generator rather than by anyone noticing.

### THE HAND LIST IS UNCHANGED

Still empty except for Rivalry. These five were never on it — they came off the derived roster, which
is the derived list doing the job the prose list cannot.

### TWO REDS THAT ARE NOT MINE, MEASURED RATHER THAN ASSUMED

Neither is filed and neither is called a known failure; each was checked against the pre-change bytes.

- **`tests/test-no-silent-failure.js`** — red on `engine/tag_dex.js:332`, a `catch (e) { return
  _ptShape; }` inside `partialTrapShape()` that predates this wire. Verified by re-running with the
  `tag_dex.js` change removed: still red, same line, `NEW since the baseline 24` either way.
- **`tests/test-effective-identity.js`** — red on *"no NEW raw read of a transforming field (1048
  total, baseline 234)"*. The baseline is dated 2026-08-02 and the file's own declared exceptions say
  `game_differential.js` has been over the ratchet since the moment it was written. This wire adds
  **zero** raw reads: the count of `.ability|.species|.types|.baseStats|.weight|.baseSpecies` in
  `medicham2-browser.js` is **221 before and 221 after**.
- **`FEATURE SEMANTICS CHECK FAILED`** against `data/policy-weights.json` for eight features is the
  same REFIT OWED WIRE 150 reported, and it belongs to MEASURE. Rather than call it pre-existing,
  `engine/feature_fixture.js`'s `hashes()` was computed over the BEFORE bytes and the AFTER bytes:
  **all 76 feature and joint-feature hashes identical, 0 moved by this wire.**

### A RELEASE WAS CUT BY A GATE, AND I DID NOT INTEND IT — REPORTED, NOT HIDDEN

`tests/test-nature-differential.js` `require`s `engine/game_differential.js` at module load, and that
file's line 126 is `if (!REL_ID) ER.cut(…)`. Running the gate therefore cut release
**`ea58415e1cd8`** ("game differential mode A — the comparison driver, ROADMAP #68 step two",
2026-08-10 06:34) over the mid-work tree, and moved `data/engine-release.json`'s `current` pointer
from **`cb831e50eafb`** to it. **Nothing was deleted and nothing was reverted** — the pointer and the
new `data/releases/ea58415e1cd8/` directory are left exactly as the gate wrote them, because undoing
another division's artifact by hand is worse than reporting it. **Anything that opens the DEFAULT
release rather than a named id will get a snapshot of a half-finished tree until somebody cuts again.**
The auto-cut is reachable from a gate that does not look like a differential run, which is worth
knowing before the next person runs the suite.

## WIRE 150 — THE HEAL TRUNCATED WHERE THE AUTHORITY ROUNDS. ONE LINE, FIVE MOVES, 6,398 USES. 2026-08-10.

Census **357 live / 357 probed → 359 live / 359 probed**, `missing` **0**, `threw` **0**, `hollow`
**0**, `unarmed` **0**, `directCall` **0**. Damage stages **1728/1728 exact**, unchanged. Two new
probes, each watched RED on its own before the engine changed. **No release was cut**, and neither
`tests/roster.js` nor anything reaching `engine/game_differential.js` was run.

`medicham2-browser.js`, the fraction arm of the `heal` branch:

```
- return Math.floor(x.st.hp*_hp.fr[0]/_hp.fr[1]);
+ return Math.round(x.st.hp*_hp.fr[0]/_hp.fr[1]);
```

`battle-actions.js:1015` — `target.baseMaxhp * heal[0] / heal[1]`, then
`(gen < 5 ? Math.floor : Math.round)(amount)`. Gen 9 rounds. Every odd division lost a point.

| move | uses | maxhp staged | authority | this engine was |
|---|---|---|---|---|
| Roost | 2,672 | Torkoal 145 | 73 | 72 |
| Recover | 803 | Torkoal 145 | 73 | 72 |
| Slack Off | 123 | Torkoal 145 | 73 | 72 |
| Soft-Boiled | 0 | Torkoal 145 | 73 | 72 |
| Life Dew | 2,800 | Torterra 170 | 43, **on both bodies** | 42 |

### IT IS `Math.round`, AND DELIBERATELY NOT THE `md4096` ON THE LINE ABOVE IT

The two arms of `_size` mirror **two different authority paths** and that is why they use two
helpers. The weather family's handler is `this.heal(this.modify(pokemon.maxhp, factor))` on a float
factor — `modify` **is** the 4096ths chain, so `md4096` is right there. The fraction arm has no
`modify` in it at all: a plain round over an **exact integer pair** taken off the move. Spending
`md4096` here would push `[1,2]` through a float and a 4096ths truncation the authority never
applies — the lossy-float trap WIRE 4's own note is about (*5448/4096, not 1.33*). The two helpers
agree at `[1,2]` and `[1,4]` and are not the same function: `md4096` truncates the multiplier to
4096ths first, so any fraction whose 4096ths form is inexact would diverge.

### WHY IT SURVIVED EVERY EXISTING HEAL PROBE — TWO BLINDFOLDS AT ONCE

The old fixture inflated max HP **fourfold**, so every fraction divided **exactly** and floor and
round could not disagree at all; and it chipped with the smallest neutral hit, so the heal
**overshot and clamped to full**. The right answer and the wrong answer were the same number, twice
over. The surviving `healsSelf` probe reads `test[0] > 0`, and a truncation is still > 0.

So the two new probes require **both** of: `maxhp * heal[0] / heal[1]` MUST NOT be whole
(145/2 = 72.5, 170/4 = 42.5), and the chip MUST be deeper than the heal (1 HP, so nothing clamps).
A probe failing either condition passes on the broken code.

### THE PROBES, AND THE CONTROL IS THE POINT

Both numbers come out of a real `gen9championsvgc2026regmb` `Battle`, not from arithmetic typed here.

| tag | control arm | test arm |
|---|---|---|
| `move\|healsSelf` — *"Recover rounds the half — it does not truncate it"* | Torterra **170,85** — 170/2 is whole, so floor and round agree and this arm **cannot move** | Torkoal **145,73**; the authority staged 14 → 87, a truncating engine reads 72 |
| `move\|healsAlly` — *"Life Dew rounds the quarter, for the partner too"* | Torkoal **145,36,36** — 145/4 = 36.25 rounds **DOWN**, so this arm is where a **ceiling** would be caught | Torterra **170,43,43**; the authority staged 17 → 60, a truncating engine reads 42 on **both** bodies |

The only varied knob is the **parity of max HP**, which is exactly what the rounding rule reads.
Max HP is returned beside the gain, so the probe fails loudly rather than quietly changing meaning if
`buildMon` ever hands back a different body.

### THE BLAST RADIUS WAS MEASURED, NOT ARGUED

Every move in `data/tags.json` (500), six scenarios each — mid roll, both pin corners, aimed and with
no target — two turns apiece so residuals and clocks land, digested as the **whole board**: every
primitive on all four active bodies and all four benched ones, plus the field and both side
conditions. The BEFORE arm is the current file with **this one character reverted**, compiled under
the real medicham path so its relative requires resolve identically.

**981,756 cells. 30 differ. Five moves: `recover`, `roost`, `slackoff`, `softboiled`, `lifedew`.**
Nothing else in the corpus moved by a single HP. Life Dew contributes one cell per scenario rather
than two, because Torkoal's 145/4 rounds down — the control arm, visible in the sweep.

**AND THE FIRST RUN OF THAT SWEEP REPORTED `0 cells differ` ON 3,000 CELLS, ALL OF WHICH HAD THROWN.**
A circular reference in the digest turned every scenario into a one-cell `THREW` row and the two arms
agreed perfectly about nothing. It was caught only because the throw count is printed beside the diff
count. That is CLAUDE.md's signature failure inside the instrument built to prevent it.

### NO SECOND ROUNDING — THE CALLERS, NAMED

- `_size`'s only caller is `amt`, which does `curHP = Math.min(st.hp, curHP + _size(x))`. A **clamp**,
  not a rounding; `Math.min` over integers cannot shift a rounding.
- `_hp.fr` is read at exactly one site. `healParam`'s other caller is `playerAction`, which uses it
  only to decide `kind:'heal'` and never touches the fraction.
- `board.js`'s `healValue` reads the same `[num,den]` off the artifact but as a **fractional feature
  in 0..1**, never an integer HP count, so there is no integer rounding to double-apply and no
  fact to diverge.

### EVERY OTHER `Math.floor` HEAL IN THE FILE WAS CHECKED AND IS CORRECT

They mirror `Battle#heal`, which does `damage = this.trunc(damage)` — a **floor** — so
`pokemon.heal(baseMaxhp / N)` truncates and these must not change: healing berries, Hospitality,
`healsOnSwitchOut` (Regenerator), the absorb-ability gains, Grassy Terrain, `passiveHeal`
(Leftovers). **Pollen Puff is the sharpest case**: its handler is literally
`this.heal(Math.floor(target.baseMaxhp * 0.5))`, so the `allyheal` branch flooring is the authority
and a blanket floor → round would have broken it. Drain and Shell Bell already carry the correct
rule with their own notes — drain rounds, Shell Bell clamps-then-truncates.

### THE HAND LIST IS UNCHANGED

Still empty except for Rivalry. This defect was never on it — it came off the derived roster, which
is the derived list doing the job the prose list cannot.

### A RED THAT IS NOT MINE, MEASURED RATHER THAN ASSUMED

`node engine/status.js` prints **FEATURE SEMANTICS CHECK FAILED** against
`data/policy-weights.json` for eight features (`koTarget`, `dmgFrac`, `killIsRoll`, `killsThreat`,
`switchSurvives1`, `switchKOSlow`, `switchDiesFirst`, `screenValue`). Rather than call it
pre-existing, `engine/feature_fixture.js`'s `hashes()` was computed over the AFTER bytes and the
BEFORE bytes: **all 58 feature hashes identical, 0 moved by this wire.** It is a REFIT OWED against
the damage-path wires and it belongs to MEASURE. Reported, not filed.

## WIRE 149 — THE MECHANIC WAS LIVE AND THE SEARCH COULD NOT SELECT IT. 2026-08-10.

Census **357 live / 357 probed → 357 live / 357 probed**, and that is the correct outcome: this wire
adds no mechanic. It makes one the search can already *execute* into one the search can *choose*.
`missing` **0**, `threw` **0**, `hollow` **0**, `unarmed` **0**, `directCall` **0** — all held. New
gate: **`tests/test-side-guard-chooser.js`**.

Will: *"its gotta be able to click it man"* — overruling ROADMAP #126's decision to file this.

### THE HAND LIST IS UNCHANGED

Still empty except for Rivalry, which has never been probeable. What LEFT the ROADMAP #126 section's
*"found and deliberately not fixed"* list is its **first bullet** — `chooseAction` name-matching
`wideguard`. That claim is now carried by a probe, so it stops being a sentence in a document.

### THE DEFECT WAS ONE FUNCTION FURTHER IN THAN THE FIX

ROADMAP #126 corrected three name matches and left a fourth standing:

```js
if(me.moves.includes('wideguard') && live.length>1 && ... && rng()<0.35){ ...SPREAD... }
```

`playerAction` is the path the live bot, the game differential and every census probe take — so every
one of them said Quick Guard worked. `chooseAction` is the path every **rollout** and every self-play
game takes, and it could not see the move at all. **A move the search cannot select is worth nothing
to the search.**

RED, reproduced first: 200 self-play games / 1,176 turns, every side-A body handed both guards, foes
usage-weighted with their own movesets — **Quick Guard 0, Wide Guard 270**.

### WHAT REPLACED IT, AND WHAT IT REFUSED TO INVENT

Membership, the class it blocks and the **rate** are all read off the artifact; the branch contains no
move name. `GUARD_PRED` — the class→predicate table the turn loop already refuses with — gained a
`chosen` counter and a `worth` predicate in the same row, so a class cannot have one and not the
others. Wide Guard is the family's most-used member, so the derived rate hands it back **0.35 to the
bit**, and its trigger set against the old bare `SPREAD.has(id)` is **0 lost, 0 gained over all 500
moves** — a set comparison, not a promise.

Three filters, each lifted off the execution path rather than invented, because "the foe holds a
priority move" is true of **99.3%** of usage-weighted foe pairs — Protect is +4:

- **aimed at the other side** (the `_pf.indexOf(a.target)` gate, asked of the move's own `target` at
  selection time): 29 moves sit above +0.1 in this format and only **17** are foe-facing. 99.3% → 50.5%.
- **cannot be used this turn**: Fake Out (16,761 uses) is entry-turn only. The rule had three copies
  by name and this needed a fourth reader, so all four now call one predicate.
- **would fail anyway**: `needsTargetToAttack` — Sucker Punch (9,178) fails against a body that is
  guarding rather than attacking. Read off the tag.

Then the situational half, which is what stops it spamming: the priority threat must FINISH a body on
my side (`dmgRange` max ≥ curHP) or carry **`flinches`**, which costs the turn at any HP. Spread's
`worth` is `true` — a statement of Wide Guard's current behaviour, left alone deliberately because its
click count is a baseline other measurements rest on.

### THE BAR WAS A RATE, NOT A NON-ZERO, AND THE HONEST ANSWER IS "CONSERVATIVE"

The corpus is the target, measured on the store — 51,445 games / 327,993 turns carrying a move:

```
HUMANS   Quick Guard 601 clicks   Wide Guard 6,460   ratio 0.093
TRIGGER  of the 482 sides that clicked Quick Guard, the OPPOSING side used one of the 17 foe-facing
         priority moves in 63.3% of those games, against 37.5% over all sides -- a 1.69x lift
```

One self-play run, 1,500 games / 8,836 turns, one guard per body assigned 50/50:

```
QUICK GUARD 48   WIDE GUARD 988   ratio 0.049      (was 0 : 270 before the wire)
```

**0.049 against 0.093 is ~2x conservative and it is reported rather than tuned away.** Nothing was
fitted: the rate came out of `tags.json` `uses` and the situational half out of the execution path.
`tags.json` says 927:3,997 = 0.232 for the same two moves where the store says 0.093 — the two
artifacts disagree by 2.5x (ROADMAP #70's standing caveat), the engine can only read the tag record,
and the probe prints both every run so the gap cannot go quiet.

**THIS IS A PLAY CHANGE AND NOT A CORRECTNESS CLAIM.** The authority has no policy; no probe can show
Showdown's player would have clicked Quick Guard on a given turn. Nothing here was compared against it.

### FOUND WHILE THERE — REPORTED, NOT ABSORBED

- **`tests/test-tag-consumed.js` is RED at HEAD and green on this tree**, three runs each way: HEAD
  exits 1 with *"1 tag(s) newly have NO consumer: `flinches`"*. The consumer it gained here is the
  situational half's flinch clause — which is a thin consumer for a mechanic tag, and the real question
  is why the flinch path stopped asking.
- **`data/engine-data.js` carries no Quick Guard set at all** — 0 of 318 species, against 8 for Wide
  Guard, and 0 of `MC.priors`' rows against 14. Even a correct chooser cannot click a move no modelled
  body holds. Not this division's artifact to edit; filed with the count.
- **The other two ROADMAP #126 gaps are NOT closed by this derivation**, checked rather than assumed:
  the `onTry()` last-action failure is execution-time, and Wide Guard's spread-**status** hole lives in
  the attack branch. Note that the chooser now *selects* Wide Guard against Cotton Spore, String Shot,
  Sweet Scent and Teeter Dance while the turn loop does not block them — pre-existing and identical
  under the old trigger, named because this wire is why someone will read that line next.
- **The counter this wire is measured by could have been corrupted by the wire itself.** The chooser
  asks the refusal question thousands of times a game hypothetically, so the pure predicate was split
  out carrying **no counter** and the probe asserts `sideGuardBlocked` is still 0 after a full
  membership sweep.

**`tests/roster.js` WAS NOT RUN AND NO RELEASE WAS CUT** — another agent is in the roster, and
`game_differential.js` auto-cuts a release when nothing is pinned.

---

## ROADMAP #126 — QUICK GUARD WAS THE ONLY BROKEN SOURCE OF PRIORITY REFUSAL, AND THE TWO GUARDS CARRY BYTE-IDENTICAL TAGS. 2026-08-10.

Census **354 live / 354 probed → 357 live / 357 probed**. `missing` **0**, `threw` **0**, `hollow`
**0**, `unarmed` **0**, `directCall` **0** — all held. New counters: `MEDSEEN.sideGuardBlocked`,
`MEDFAILS.guardClassUnknown`.

Will: *"have quick guard block all prio moves and test it against some prio moves not that hard"*,
then *"its like armor tail"*. The second sentence is the diagnosis and it turns a mechanic into a
wiring job.

### THE BOARD, MEASURED BEFORE ANYTHING WAS TOUCHED

A +1 priority attack into a defender, one source of refusal varied and nothing else. **Five of six
sources were already right**, and all five already resolve through one function
(`priorityRefusedAbove`):

```
CONTROL  no guard          25   landed
Armor Tail                  0   REFUSED
Dazzling                    0   REFUSED
Queenly Majesty             0   REFUSED
Psychic Terrain             0   REFUSED
Wide Guard                 25   landed     <- CORRECT: it stops SPREAD, not priority
Quick Guard                25   LANDED     <- the only broken source
```

### THE CAUSE IS A NAME MATCH — THE THING THIS REPO FORBIDS — IN THREE PLACES

`quickguard` and `wideguard` carry **byte-identical tag lists**: `priority, neverMisses,
oneTurnGuard, statusCategory`. So the engine told them apart by spelling.

| site | what it said | what it cost |
|---|---|---|
| `playerActionPrimary` | `if(id==='wideguard')` | Quick Guard fell through the entire cascade to `{kind:'pass'}` — **927 corpus clicks bought a wasted turn** |
| `buildMon`'s usable filter | `id==='wideguard'` | a sheet's Quick Guard was **deleted from the body** before the turn loop ever saw it |
| the field | `wgA:false, wgB:false` | a boolean pair whose **NAME was the only record of what it guarded against** |

**`engine/tag_dex.js` DID NOT CHANGE AND DID NOT NEED TO, AND THAT IS THE FINDING.**
`data/tags.json` has carried `oneTurnGuard.blocks` — `"priority moves"` / `"spread moves"` — derived
from each move's own `condition.onTryHit` since the tag was written. **Nothing read it.**
`data/tags.json` and `data/abra-tags.js` were **not regenerated**, so there is no artifact diff.

**MEMBERSHIP PRINTED BEFORE WIRING** (LESSONS §4): exactly **two** of 500 moves carry `oneTurnGuard`,
and they are these two. Crafty Shield and Mat Block are `isNonstandard: 'Past'` here and absent from
the artifact entirely. `ignoresProtect`, the bypass rule, carries **14** — all 14 genuinely lack
`flags.protect` upstream, so all 14 genuinely bypass.

### WHERE IT LANDED, AND WHY THERE

Beside the ability bar at **WIRE 85's gate, above the kind dispatch**, because *"its like armor
tail"* is literally true: same question, same `+_pk` Prankster term, same side, same "only a move
aimed at the other side" scope. Inside the attack branch it would have missed every
Prankster-boosted status move, **which is more than half of what Quick Guard is for**.

It does **not** fold into `priorityRefusedAbove`'s return. That function answers "above what priority
is a move refused" as one number over abilities and terrain; a side guard has its own announcement
and its own bypass rule, and folding it in would lose both. **Two sources, one gate.**

Spread is **excluded at that gate on purpose** and answered per body downstream — ROADMAP #81 WIRE 9
is the fix that made Wide Guard emit one `-activate` line per shielded body, and answering spread at
a whole-action gate would collapse those two lines back into one.

### THE THREE PROBES, EACH RED FIRST, EACH WITH A THIRD ARM

A two-arm probe passes on an engine that makes **every** guard block **everything** — the obvious
wrong fix. So each carries a cross-control:

| probe | red → green | the arm that stops the wrong fix |
|---|---|---|
| `move\|oneTurnGuard` Quick Guard blocks a +1 priority move | Bullet Punch at the PARTNER 28 → **0** | **Wide Guard on the same board still reads 28** |
| `move\|oneTurnGuard` Quick Guard refuses a PRANKSTER-boosted status move | Thunder Wave `par` → **`none`** | the **same** move with **no Prankster** through the **same** guard still reads `par` |
| `move\|ignoresProtect` Feint goes through Quick Guard | — | Bullet Punch behind that guard reads **0**; Feint reads **29**, equal to its unguarded 29 |

**MY FIRST PROBE WAS BROKEN AND IT IS THE INSTRUCTIVE PART.** It used **Sucker Punch**, which fails
unless the target is attacking — the defender was passing, so every arm **including the control**
read 0 and the board looked like universal refusal. The shipped probes use an *unconditional*
priority move and **always print the control landing**.

**WIDE GUARD DID NOT REGRESS** — both existing probes green: `ally took 92 without → 0 behind Wide
Guard`, and `2 -activate lines, one per body, 0 damage`.

### FOUND AND DELIBERATELY NOT FIXED

- **`chooseAction` STILL NAME-MATCHES `wideguard`, SO A ROLLOUT WILL NEVER CLICK QUICK GUARD.**
  Measured: 40 self-play games, 326 turns, bodies handed both guards — `sideGuardBlocked` **0**. The
  mechanic is live through `playerAction` (the live bot, the differential and every probe), but the
  internal heuristic chooser cannot select it. Wiring that is a **play** change with no correctness
  probe available.
- **A SIDE GUARD DOES NOT FAIL WHEN ITS USER HOLDS THE LAST ACTION** — both conditions carry
  `onTry() { return !!this.queue.willAct(); }`. WIRE 119 implements it for `kind:'protect'` and never
  has for `kind:'wideguard'`. Pre-existing Wide Guard gap; needs its own failing probe.
- **THE STALL COUNTER — WHICH BEHAVIOUR WAS ASSUMED, AND WHY.** ROADMAP #59. The authority: a side
  guard **never** rolls a consecutive-use die (neither condition calls `runEvent('StallMove')`) but
  **does** `addVolatile('stall')`, which makes a *later Protect* fail. **Assumed here: the first half
  only**, matching the authority. The engine's pre-pass **resets** `tookProtectTurns` where the
  authority advances it; that line is byte-identical to what it was, so nothing about Protect moved.
- **WIDE GUARD DOES NOT STOP SPREAD *STATUS* MOVES** — the authority's condition has no category test.
  The same derivation would close it. **Not taken on without its own failing probe.**
- **`ABRA_TAGS_OFF=1` NOW LOSES WIDE GUARD TOO**, because the classifier asks the tag and the OFF stub
  answers null. That is the switch's stated purpose (revert to pre-artifact behaviour) but it is a
  change to that arm, named here rather than discovered later.

### THE HAND LIST IS UNCHANGED

Quick Guard was never on it — it came off the ROADMAP register, where #126 points at this file. The
list is still empty except for Rivalry, which has never been probeable.

**ROADMAP #126's ROW IS NOT MARKED CLOSED BY ME**, and `tests/roster.js` was not run: another agent
is in it, and a roster verdict is not something this section may claim.

---

## WIRE 147 — THE DAMAGE WAS ONE ROLL MULTIPLIED BY N. FOUR MOVES, ONE ROOT CAUSE, AND TWO OF THEM WERE 2x. 2026-08-10.

Census **350 → 354 live, 354 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** Four new
probes, each watched RED on its own — not as a block — before a line of the engine changed. Damage
stages **1728/1728 exact**, unchanged. **No release was cut and neither `tests/roster.js` nor
`engine/game_differential.js` was run**: `game_differential.js:126` AUTO-CUTS when nothing is pinned,
which swaps the pointer other measurements read. The pointer is still `f727f7fdee4f`, mtime unmoved.
Full working: `docs/MEDICHAM-SPRINT-NOTES.md`.

**THE DEFECT IS ONE LINE AND FOUR MOVES PAID FOR IT.** `dmgRange` ended
`if(_hits>1) return {min: floor(roll(85)*_hits), max: floor(roll(100)*_hits), eff}`. Everything a hit
owns individually — its own base power, its own `+2`, its own target — was folded into a scalar:

| move | uses | what it was |
|---|---|---|
| **Triple Axel** | 753 | `basePowerCallback` is `20 * move.hit` — 20/40/60. We applied a flat 20 three times, so the move dealt **exactly half**: 8+8+8 = 24 against 8+16+23 = 47. It was **silent** too: the tag said `{computed:true, note:"idiom not yet derivable"}` and `MEDFAILS.variablePowerUnknown` is gated on a truthy `kind`, so it fell out of every branch AND out of the counter that exists to report exactly that |
| **Dragon Darts** | 126 | `smartTarget: true`. One packet cannot be aimed at two bodies, so both darts hit the aimed foe and the partner took **zero**: −72/0 against −36/−34. `smartTarget` appeared in this engine only in two comments and in no tag at all |
| **Beat Up** | 320 | `mvBP = _hits ? _sum : …` summed every ally's base power into one packet, and the formula's `+2` is paid per packet — four hits lost three of them: 24 against 28 |
| **Fickle Beam** | 38 | a 30% DOUBLE applied as a flat ×1.3 — 80 × 1.3 = **104 base power, a number the move never has**. It is 80 or 160 |

**FICKLE BEAM IS THE 3.90.0 BUG VERBATIM** — *"the multi-hit count was the MEAN, and the pin never lands
on a middle"* — surviving in the conditional-power path, with the comment above the line stating the
averaging as a deliberate choice. It is fixed with the shape ROADMAP #103 already chose and not a second
one: `hit.condPower` is drawn in the battle loop off the same rng that draws the hit count, the crit and
the damage index; a pure call keeps the expectation, because that is the right object for a PRICE, and
the two halves are counted separately so a run that never rolls one is readable.

**THE PER-HIT LOOP IS ENTERED ONLY WHERE THE BASE POWER IS A FUNCTION OF THE HIT INDEX.** `dmgRange` is
now a wrapper over `dmgRangeOneHit`, and `hitPlanOf` decides from the ARTIFACT — today
`perHitEscalates` (Triple Axel) and `alliesBaseAtk {perAlly}` (Beat Up), nothing else. Every other move,
**multi-hit included**, takes one trip with the identical `_hits` scalar the old line multiplied by. That
is what "unchanged by construction" means here, and it is why this is safe to land in the damage path.

**THE PINNED CORNER, STATED.** `min` is every hit at the 85% randomizer and `max` every hit at 100% —
exactly what a pin produces in the authority, which draws a randomizer per hit and gives every one the
same corner. **What this does NOT reproduce is the INTERIOR:** the loop still draws one index across the
summed range, so N independent mid-rolls are modelled as one. Unchanged from before this wire, and it is
the loop's question rather than the calculator's. **The COUNT is not re-derived as a mean** — `hit.hits`
wins whenever a caller drew one, and the weight vector used for a price sums to exactly `expectedHitsOf`,
CHECKED (`MEDFAILS.hitWeightsDisagree`, 0 over 1,500 real turns across all 500 moves).

**UNCHANGED BY CONSTRUCTION *AND* MEASURED.** Every move in `data/tags.json` (500), four turns each —
mid roll, both pin corners, and one with no target — digested as the whole board, against the **frozen
release `f727f7fdee4f`** opened through `engine_release.open(id)` so it serves the pre-wire bytes.
**2,000 cells. 11 differ. Four moves, and they are the four above.**

**THE AUTHORITY WAS READ DIRECTLY, AND THE FIRST HARNESS WAS WRONG IN THE FLATTERING DIRECTION.** A
pinned `new Battle` confirms all four at both corners — Triple Axel escalating, Dragon Darts writing
`|-anim|` at the second dart with damage on both bodies, Beat Up emitting four `|-damage|` steps and
`|-hitcount| 4`, Fickle Beam printing `[anim] Fickle Beam All Out` at one corner and nothing at the
other. The first version overrode `battle.random`, and `Battle#randomChance` calls
`this.prng.randomChance(...)` **directly** (sim/battle.ts:352) — so every chance event stayed unpinned
and Fickle Beam appeared never to double, which would have read as "the tag's `p` is wrong".

**A PROBE THAT WAS GREEN ON A FALSEHOOD.** `reactorPerHit` asserted Weak Armor `-2/+4` off Dragon Darts
against a Milotic standing beside a **healthy partner**, and Showdown lands one dart there. The reaction
count read the move's total while the damage step had already split. Corrected, and now staged BOTH ways
with the partner's stages read beside the aimed body's. `multiAccuracy`'s probe needed a new denominator
rather than a new claim: Triple Axel's discount now shows against `d(20)+d(40)+d(60)`.

**BEAT UP'S ELIGIBILITY FILTER WAS WRONG IN THREE COPIES AND IS ONE FUNCTION NOW.** Showdown's
`ally === pokemon || !ally.fainted && !ally.status` short-circuits, so **the user is always in the
list**; this engine applied the tests to the user too. No probe covers the statused-user case — reported,
not claimed.

**`data/tags.json` WAS REGENERATED, AND ROADMAP #65's BLOCKER IS GONE — MEASURED, NOT ASSUMED.** A
CONTROL regeneration with no changes ran first: **0 removed, 0 added, 0 changed**. Against the
pre-session artifact: **0 removed, 0 added, three hundred and seven changed, and all but two of those
are the `uses` count only**
(`data/tags.json`'s own `sheet_entries` moved by about six hundred between the control run and the real
one — the ingest is live and appended sides mid-session; read the value from the artifact). The semantic
changes are the two intended ones and the catalogue gained exactly `move|smartTarget`.

**WHAT IS NOT CLOSED, SAID PLAINLY.** A PURE PRICE for Dragon Darts still says two hits into the aimed
body: `dmgRange` is handed two bodies and cannot see a partner, so `playerAction`'s pre-computed `d`,
`bestMoveVs` and every rollout leaf overstate the aimed body and understate the board. Same shape as the
`auraBoost` finding — a fact that needs the FIELD, not the pair — and filed rather than hidden. **No
roster row is claimed closed:** the roster was not run.

**THE HAND LIST IS UNCHANGED.** Nothing on it was any of this; it has been empty except for Rivalry
since 2026-08-07, and these four rows came off the deliberate roster rather than off prose.

## WIRE 146 — `playerAction` IS A FIRST-MATCH CASCADE, SO A MOVE CARRYING TWO EFFECTS SILENTLY LOST ONE. 2026-08-10.

Census **346 → 350 live, 350 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** Four new
probes, each watched RED on its own — not as a block — before a line of the engine changed. **No release
was cut and neither `tests/roster.js` nor `engine/game_differential.js` was run**: another agent is in
both, and `engine_release.open()` with no id reads a POINTER, so a cut would swap the release under a
live measurement. Full working: `docs/MEDICHAM-SPRINT-NOTES.md`.

**THE DEFECT IS THE CONTROL FLOW, NOT FIVE MOVES.** `playerAction` was ~40 sequential
`return {kind:...}` statements, so a move whose tags describe two effects was classified by whichever
branch matched first and the second effect **never executed at all**. Chilly Reception pivoted and set
no sky. Swagger and Flatter boosted and never confused. No Retreat boosted and left no mark. Howl
boosted the partner and not its user. The file had already fixed this shape ONCE, by hand, on Toxic
Thread — one pair, not the shape, and that guard is the precedent this wire generalises.

**WHAT LANDED.** `playerActionPrimary` is the cascade, byte-for-byte what it was. `playerAction` now
hands its result to `composeResiduals`, which reads `KIND_APPLIES` — a table stating, **in the
vocabulary of EFFECTS**, what each action kind actually applies — and attaches any carried-but-unapplied
effect to the action as a rider. The riders execute at **ONE site above the kind dispatch**, which is
WIRE 77's and WIRE 85's argument: every BeforeMove refusal (flinch, paralysis, Throat Chop, Taunt, the
priority bar) has already `continue`d out above that line, so a rider inherits all of them for free.

**A DERIVED RESIDUAL WOULD HAVE OVER-MATCHED, AND IT IS WHY THE TABLE IS A TABLE.** "Every effect-bearing
tag the claiming branch did not read" catches **Yawn**, which carries `delayedSleep` *and* a
`statusInflict` volatile describing the same sleep — two tags, one effect — and would have written a
second `_vol.yawn` on every Yawn in the format. Membership was printed over all 500 moves in
`data/tags.json` before a rider ever ran: **five riders exist**, and the fifth (Shed Tail's substitute)
is refused inside `applyMoveVolatile` because `grantSubstitute` owns that volatile.

**TWO FACTS WERE EXTRACTED RATHER THAN COPIED.** `applyMoveVolatile` (Mental Herb, the no-restart rule,
Encore's lock, Disable's `_sealed`) came verbatim out of the `affect` branch — the block was the last
statement in that loop, so every `continue` is exactly a `return` — and `applyMoveWeather` (the sky, the
turns, the rocks) out of the `weather` branch. Both now have two callers and one implementation.

**UNCHANGED BY CONSTRUCTION *AND* MEASURED.** The composer returns on its first line for `kind:'attack'`;
a single-effect move gets no `also` field and the executor is gated on that field. Then, empirically:
**every one of the 500 moves in the tag corpus, three digests each** — the action object, the whole
board after a real turn with a target, and the same with no target. **After the extraction alone,
byte-identical on all 1,500.** After the whole wire, exactly **seven moves differ and they are the seven
this wire is about**.

**WHAT IS NOT CLOSED, SAID PLAINLY.** No Retreat's roster row is `sd +1 / ours +2` on the second click.
That is a second APPLICATION — Showdown's `onTry` fails the whole move against the mark. This wire
writes the mark and does **not** add the veto: nothing in `data/tags.json` carries it, and a blanket
"a user-directed volatile refuses a repeat" rule was printed and rejected because it catches `minimize`
and `charge`, which Showdown lets you re-click. It needs a `tag_dex` derivation off `onTry` plus a
regeneration of `data/tags.json`, and that artifact is being read by another agent's run right now.

**AND ONE ROW MAY STILL DIFFER FOR A REASON THAT IS NOT THIS WIRE'S.** `board_state.js` compares
`vol.confusion` as a NUMBER; ours is `CONFUSION_TURNS_MIN = 2` always and Showdown's is `random(2,6)`
decremented. A Swagger row can read FIRED-AND-BOARDS-DIFFER on the counter with the mechanic live. That
approximation is `MEDSEEN.confusionMinDuration` and predates this pass.

**TWO PRE-EXISTING REDS, MEASURED RATHER THAN ASSUMED TO BE SOMEBODY ELSE'S.**
`FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is unaffected: after
`engine/feature_fixture.js` builds and hashes every fixture feature, all four of this wire's counters
read **0**. REFIT OWED, and it is MEASURE's. `tests/test-no-silent-failure.js` is red at **21** new
silent catches; none is in `engine/medicham2-browser.js` or `tests/test-mechanics.js` — this wire added
no `catch` at all.

## WIRE 145 — A LOCKED BODY STRUGGLED RATHER THAN USING ITS STATUS MOVE. ONE GUARD, TWO CALL SITES, FAILING IN OPPOSITE DIRECTIONS. 2026-08-10.

Census **342 → 346 live, 346 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** Four new
probes, all four shown RED on the unmodified tree first. **No release was cut and `tests/roster.js` was
not run** — a read-only agent was mid-diagnosis, and `engine_release.open()` with no id reads a POINTER,
so a cut would have swapped the release under a live measurement. Full working:
`docs/MEDICHAM-SPRINT-NOTES.md`.

`_lock` is read in three places. Locked into an ATTACK all three agreed; locked into a STATUS move,
`chooseAction` returned `{kind:'struggle'}` and `mk()`'s WIRE 24 rewrite silently kept the caller's own
click. **ONE CAUSE:** both broken sites resolved the lock through `targetForMove`, which opens
`if(!mv||!hasPower(mv))return null` because its job is to **rank foes by damage**. All **175 legal
status moves in this format have base power 0**, so "cannot be used" and "no damage to rank" arrived at
the two callers as the same null. A guard doing a job it was never scoped for — the fourth instance of
that shape this sprint.

**AND `{kind:'struggle'}` MATCHES NO BRANCH IN THE DISPATCH LOOP** (`if(a.kind!=='attack')continue`), so
the turn was not merely mis-damaged, it vanished — no `|move|` line at all. Measured on the live tree
before a line changed, both foes passing:

```
lock=knockoff   -> |move|p1a|knockoff|p2b   foe -22           <- normal
lock=taunt      -> (no line at all)         foe   0
lock=trickroom  -> (no line at all)         foe   0, tr  0
lock=tailwind   -> (no line at all)         foe   0, twA 0
handed dragonclaw while locked into taunt -> dragonclaw, foe -46   <- the other direction
```

**WHY IT IS WORTH MORE THAN A GATE ROW.** Encore exists to lock a body into a move that is **useless
when repeated** — Protect, Trick Room, Tailwind, a Taunt already landed. The victim is supposed to burn
turns. This engine handed it a fresh attack, so Encore was not mis-simulated, it was **INVERTED**:
clicking it *helped* the victim, and anything fitted against it learns Encore is bad.

### THE FIX IS A RE-ROUTE, AND THE ATTACK PATH IS UNTOUCHED ON PURPOSE

`lockedAction(me,id,live,field,rng)` — one function, both sites. `hasPower` is asked *there*, as a
classification: a damaging lock still goes to `targetForMove` (best foe by damage) and draws no rng, so
the Choice holders that ride that line every turn are the control this fix must not move, and do not.
A status lock builds through `playerAction`, the same builder a normal click uses — which already
returned `{kind:'affect', mv:'taunt'}` correctly and always did. **The repeat semantics were already
correct and were not rebuilt:** Trick Room's second click ends the room, Tailwind's counter ticks rather
than refreshing. The only broken thing was that the locked move never reached them.

**WHAT A LOCKED STATUS MOVE TARGETS, STATED RATHER THAN IMPLIED: a uniform draw over the LIVING foes
from the engine's own seeded `rng`.** It is the rule this file already implements twice —
`chooseAction`'s Encore branch and WIRE 143's `getRandomTarget` re-roll — so this is a third caller of
one rule and not a third rule. `Math.random()` is never reached and the draw is taken **only when a
status lock resolves**, which before this wire never happened, so every existing seeded probe, the
differential and the roster draw the identical sequence they drew before.

The WIRE 24 skip test moved from `!(_a.kind==='attack'&&_a.move.id===mon._lock)` to
`actionMoveId(_a)!==mon._lock`, because a status action carries its id in `mv` and the old shape could
not recognise a handed action that was already the locked move.

### THE FOUR PROBES

| tag | what it proves | its control |
|---|---|---|
| `sealsMoves` | a status lock PLAYS the move, not Struggle (`chooseAction`, nothing handed in) | a **Knock Off** lock on the same board, plus a third arm — the identical Taunt hand-clicked with **no lock** — so a red can never mean "this engine cannot Taunt" |
| `choiceLock` | the lock binds a **caller-supplied** action into a status move (`mk()`) | Dragon Claw handed in on every arm; with no lock it stays Dragon Claw |
| `locksTarget` | **the payoff** — locked into Trick Room the victim re-clicks it and the room it just set comes DOWN | the identical two clicks with the lock absent: the room stands, tr 4 → 3, Dragon Claw lands |
| `sealsMoves` | the target is a uniform die (0.1 → p2a, 0.9 → p2b) | an ordinary hand-clicked Taunt named at p2a hits p2a at **both** values, so nothing else was re-aimed |

### COUNTERS

`MEDSEEN.lockedIntoStatusMove` (fires; exactly 2 after two staged status locks, 0 after an attack lock)
and `MEDFAILS.lockStatusUnbuilt` — a lock into a status move this engine has no branch for still SPENDS
the turn, because a body cannot escape a lock by holding an unmodelled move, and that must not arrive
at the same counter as the mechanic working.

### THE HAND LIST IS UNCHANGED

Nothing on it was this — the list has been empty except for Rivalry since 2026-08-07, and the row came
from a live behaviour defect measured by the router rather than off prose.

### FOUND AND DELIBERATELY NOT FIXED — reported, not absorbed

- **Struggle is not implemented AT ALL**, which corrects rather than confirms the earlier reading that
  it "does no recoil". Handed `{kind:'struggle'}` with both foes passing: **0 to the foe, 0 to the user,
  no `|move|` line**. Showdown's is typeless 50 BP physical, never misses, ignores type immunity, hits a
  random adjacent foe and costs the user 1/4 of MAX HP (270 on the probe body). A family, not a line.
- **The Choice lock still does not ARM on a status move**, and this re-route does not close it — it
  honours a lock that exists. Measured on a Scarf holder: `knockoff` → `_lock=knockoff/Infinity`;
  `taunt`, `tailwind`, `trickroom`, `swordsdance` → `_lock=undefined`, because the arming line sits
  below `if(a.kind!=='attack')continue`. Needs one shared "the move was committed" site, not 30 copies.
- **Thirteen moves execute and never record `_lastMove`** — measured over the whole 500-move table:
  `heal` 8/8 (Recover, Roost, Life Dew, Moonlight, Morning Sun...), `switch` 2/2, `tail`, `trickroom`,
  `wideguard`. Consequence: `volNeedsLastMove` correctly refuses a sealer against a body that has never
  moved, so **Encore can never lock anything into Trick Room, Tailwind, Wide Guard or a recovery move** —
  most of the list Encore exists to punish. Five one-line writes close it, but Instruct reads the same
  field, so it gets its own wire and its own probe.

**TWO PRE-EXISTING REDS, MEASURED RATHER THAN ASSUMED TO BE SOMEBODY ELSE'S.**
`tests/test-no-silent-failure.js` is red with the same **20** new silent catch blocks WIRE 144 recorded,
none of them this wire's — the one `catch` added here increments a counter and the count did not move.
And `FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is unaffected: both new counters read
**0** after `engine/feature_fixture.js` builds and hashes every fixture feature, so neither branch
executes on that board. REFIT OWED, and it is MEASURE's.

## WIRE 144 — THE LOCK-IN FIVE. TWO CAUSES STACKED ON ONE ROW, AND THE SECOND ONE IS NOT IN THIS DIVISION. 2026-08-10.

Census **335 → 342 live, 342 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** Seven
new probes. **The roster verdict is NOT claimed — `tests/roster.js` is Will's to run against a frozen
tree, and the five rows' state is unknown rather than closed.** Full working: `docs/MEDICHAM-SPRINT-NOTES.md`.

Outrage, Petal Dance, Raging Fury, Thrash and Uproar all sat at `DID-NOT-FIRE` under
`move/plain-attack`. Two independent causes were stacked on that one row, **either of which alone
produces the same silent nothing**:

1. **THE CLICK WAS A NO-OP TURN.** All five carry `target: "randomNormal"`, so Showdown's request
   names no target — and `playerAction`'s attack branch is gated on `&& target`, so the click fell
   through the whole status chain and came out as `{kind:'pass'}`. Zero damage, both turns. This is
   ROADMAP #81 WIRE 9's defect in the one family that wire deliberately left out.
2. **THERE WAS NO LOCK.** Turn 2 was a free choice and the user never fatigued.

**AND THE ROW MAY STILL NOT MOVE, WHICH IS NOT EVIDENCE ABOUT THE ENGINE.**
`engine/game_differential.js` — the driver the roster runs through — translates five Showdown target
types (`normal`, `any`, `adjacentFoe`, `adjacentAlly`, `adjacentAllyOrSelf`) and `randomNormal` is
none of them, so it passes a null target regardless of what this engine now does with one. Diagnosed
in parallel by `@measure`; **deliberately not fixed here** — it is the shared instrument and outside
ENGINE. Same root cause for Counter / Comeuppance / Metal Burst (`target: "scripted"`): **8 of the 20
DID-NOT-FIRE rows**. The engine half is real and needed; neither repair is sufficient alone.

### THE FELT NUMBER IS NOT THE INTERNAL COUNTER, AND HERE THERE ARE THREE OF THEM

`lockedmove` declares `duration: 2` and that is **not** its length. `onStart` draws
`trueDuration = this.random(2, 4)`; `onRestart` re-arms `duration` to 2 on each use (a window, not a
length); `onResidual` ticks `trueDuration`; `onEnd` fatigues only `if (trueDuration > 1) return`. So
the forced-turn count is `trueDuration` and the declared 2 is a coincidence at the low end of the
range. `uproar` has no `trueDuration`: `duration: 3`, decremented in the residual **of the turn it
lands**, so three turns, and there the declared number *is* the answer.

**THE CONVENTION IS THE MINIMUM OF THE RANGE, 2**, and it is `CONFUSION_TURNS_MIN`'s existing
decision: every arm in `engine/game_differential.js` pins Showdown's RANGE form of `random` to the
bottom, so the authority draws 2 under measurement, and a `min + floor(rng()*span)` on our single
scalar would read 3 under the top-corner arm and part from it. **Corroborated, not assumed:**
`data/roster.moves.json` recorded Showdown's own board on this exact staging *before a line was
written* — `p1.active[0].vol.confusion = 2` at **turn 2**.

### THE TAG OVER-MATCHED AND IT WAS PRINTED BEFORE IT WAS WIRED

`m.self.volatileStatus && condition.onLockMove` catches **eleven** moves, not five: the six
`mustrecharge` moves answer `onLockMove` too, because a recharge turn is also a locked menu. The
discriminator is mechanical rather than a name — `mustrecharge` carries an `onBeforeMove` that
**refuses** the action; the lock-in family carries none. Final membership: `locksIntoMove` = the five
exactly, `randomTarget` = those five **plus Struggle**, which is why they are two tags. `data/tags.json`
regenerated and diffed: **0 removed, 0 added, 6 changed.**

### THE SEVEN PROBES, AND ALL SEVEN WERE SHOWN RED FIRST

Cutting the six new branches to `if(false&&…)` reads **335 live / 7 missing**, each red for its own
reason: the targetless Outrage dealt **0** and aimed at itself, the die returned `p2a` at both rng
values, turn 2 played Dragon Claw, confusion read `[0,0]`, Outrage and Uproar each ran **1** turn, the
locked body switched out, and a Spore landed through an Uproar.

| tag | what it proves | its control |
|---|---|---|
| `randomTarget` | a click with NO named target lands | a single-target Dragon Claw with the target withheld — which the authority **refuses** — still deals 0 |
| `randomTarget` | the target is a uniform die, and NAMING one does not stop it | an ordinary Dragon Claw named at p2a hits p2a at **both** rng values, so this is not a blanket re-aim |
| `locksIntoMove` | turn 2 repeats the move whatever the caller clicked | the identical turn-2 Dragon Claw after a turn-1 Dragon Claw |
| `locksIntoMove` | the run ENDS in fatigue, and not before the last forced turn | two hand-clicked Dragon Claws read `[0,0]` |
| `locksIntoMove` | the LENGTH and the fatigue are per-move, from the condition | Outrage 2 turns + confusion 2 **vs** Uproar 3 turns + confusion 0 |
| `locksIntoMove` | a locked body is TRAPPED | the same switch to the same bench body after a move that does not lock |
| `locksIntoMove` | Uproar wakes every sleeper and refuses sleep while it runs | the same sleeping partner and the same Spore with a Dragon Claw in the slot |

### THE HAND LIST IS UNCHANGED

Nothing on it was one of these — the list has been empty except for Rivalry since 2026-08-07, and the
five rows came off `data/roster.moves.json` rather than off prose. Two things found and **not** fixed
are recorded in the sprint notes rather than added here, because neither has a failing probe:
Uproar's Throat Chop clause, and Encore over a lock-in.

**TWO PRE-EXISTING REDS, MEASURED RATHER THAN ASSUMED TO BE SOMEBODY ELSE'S.**
`tests/test-no-silent-failure.js` is red with **20** new silent catch blocks against its 2026-08-06
baseline, none in code this wire wrote (the one it *did* add was caught and made to speak, 21 → 20).
And `FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is unaffected by this wire: with
all six branches cut the eight changed digests are **bit-identical**, so it is a REFIT OWED and
belongs to MEASURE. Both are reported, not filed.

## WIRE 143 — ENCORE WAS APPLIED AT SELECTION AND SHOWDOWN APPLIES IT AT EXECUTION. TWO HALVES, AND FOUR GREEN PROBES SAW NEITHER. 2026-08-10.

Census **333 → 335 live, 335 probed, 0 missing, 0 threw.** Two new probes. Diagnosis by `@measure`
against frozen release `a59b885861cd`; the fix and the probes are this pass.
**The roster verdict is NOT claimed here — `tests/roster.js` is Will's to run against a frozen tree,
and until it is re-run the Encore row's state is unknown rather than closed.**

### THE RESIDUAL WAS NOT DAMAGE AND NOT TARGETING-IN-GENERAL. THE OVERRIDE HAD NEVER RUN.

`@measure` ruled out, with measurements, every candidate the previous pass had left standing: not
damage (the identical un-encored Dragon Claw deals 39 in **both** engines), not the volatile, not its
counter, not `targetForMove` mis-aiming — **that code never executed** — not the fixture, not the
harness. What was left is that our `mk()` collects all four bodies' actions **before the queue is
sorted**, and at that instant `mon._lock` is still null, because a mid-turn Encore is written later,
at move resolution. The WIRE 24 rewrite therefore evaluated **once per turn, at the wrong instant**.

Reproduced on the live tree before anything changed, and the CONTROL is the sharpest statement of it —
the same two turns with the Encore click replaced by a pass, at three different rng values:

```
  enc=false  vol=false   |move|p2a: garchomp|brickbreak|p1a: whimsicott
  enc=true   vol=TRUE    |move|p2a: garchomp|brickbreak|p1a: whimsicott     <- bit-identical
```

The volatile lands, and **landing it changes nothing whatsoever**.

### THE AUTHORITY PUTS BOTH HALVES ON ONE LINE, AND WE HAD NEITHER

`sim/battle-actions.ts:223-234`, inside `runMove`, i.e. **per action at execution**:

```ts
const changedMove = this.battle.runEvent('OverrideAction', pokemon, target, baseMove);
if (changedMove && changedMove !== true) {
    baseMove = this.dex.getActiveMove(changedMove);
    baseMove.priority = priority;                          // the bracket stays the SELECTED move's
    target = this.battle.getRandomTarget(pokemon, baseMove);   // and the target is RE-ROLLED
}
```

1. **The action is rewritten at execution.** Ours was rewritten at selection only.
2. **The target is re-rolled uniformly.** `getRandomTarget` in a double falls through to
   `side.randomFoe()` → `sample(this.foes())` — uniform over the **living** foes. (`activePerHalf > 2`
   is the triples branch and is not this format.) `targetForMove` picks the foe the move hits
   **hardest**. Different functions, so a deterministic pick here is a defect even when it is a good
   pick.

**THE ROW STAYS RED AFTER EITHER HALF ALONE, AND THAT WAS SHOWN RATHER THAN ASSERTED.** With half 1
landed and the target taken from `targetForMove`, the census reads **334 live, 1 missing** — the
re-roll probe goes red on its own while the override probe stays green.

### THE PRECEDENT IS IN THIS FILE AND ENCORE ONLY EVER GOT HALF OF IT

`WIRE 119 — TAUNT AT EXECUTION TIME` gave Taunt **both** handlers: `onDisableMove` as a menu filter in
`chooseAction`, and `onBeforeMove` as a second check in the dispatch loop. Encore's `onDisableMove`
half was wired twice over (WIRE 20 in the chooser, WIRE 24 for a caller-supplied action) and its
`onOverrideAction` half was never wired at all.

**PLACED ABOVE THE FIVE BeforeMove GATES, AND THE ORDER IS A CORRECTNESS CLAIM.** `OverrideAction` is
raised inside `runMove` **before** `runEvent('BeforeMove')`, so sleep, freeze, flinch, confusion,
paralysis, the recharge, Throat Chop's silence and Taunt's refusal all ask their question about the
move Encore **forces**, not about the one the player picked. A silenced body Encored into a sound move
is refused; one Encored **off** a sound move is not.

**THE BRACKET IS SAFE BY CONSTRUCTION, NOT BY A GUARD, AND IT WAS MEASURED.** `_pri` is frozen at WIRE
118's pass above the loop and `turnOrderKey` reads `it._pri` without recomputing, so nothing this wire
does can move an action. `_selMv` stays a collection-time field and is deliberately not written here.
Staged on the reachable case — a Prankster Whimsicott (116) Encoring a Garchomp (102) that clicked
**Quick Attack**, with a Dragapult (142) clicking a 0-priority move behind them:

```
  |move|p1a: whimsicott|encore|p2a: garchomp
  |move|p2a: garchomp|xscissor|p1b: dragapult     <- +1 bracket kept; the ENCORED move executed
  |move|p1b: dragapult|brickbreak|p2a: garchomp   <- 142 Speed, and still second
```

That is `baseMove.priority = priority` exactly: the bracket of what the player picked, the move Encore
forces.

### THE RE-ROLL TAKES THE ENGINE'S OWN SEEDED STREAM, AND THAT IS THE WHOLE OF WHY IT IS SAFE

`Math.random()` is never reached. The draw is the `rng` already threaded through `battleTurn` for the
accuracy, crit and damage rolls, and it is consumed **only when an override actually fires** — so
every existing seeded probe, the differential and the roster draw the identical sequence they drew
before this wire. `chooseAction`'s own Encore branch already samples a uniform live target this way;
this is a second caller of one rule, not a second rule.

### THE TWO PROBES, AND WHY THE FOUR THAT WERE ALREADY GREEN COULD NOT SEE THIS

`locksTarget` and `sealsMoves` both had live Encore probes, and both stay green against an engine that
has never once overridden an action — **they measure the selection half.** On any turn AFTER the
Encore lands, `onDisableMove` has already narrowed the victim's request, so the move it "chooses" IS
the encored one and no override has to happen.

**A FAST ENCORE INTO A SLOWER FOE IS THE WHOLE OF THE REACHABLE SET.** A probe that clicks Encore on
the turn it cannot land measures nothing, and that exact mistake was made twice in this sprint.

- `an Encore landing MID-TURN overrides the action its victim already chose` — the victim commits
  X-Scissor on turn 1; on turn 2 the Encorer is faster and the victim has **already been handed** Brick
  Break. Control arm, Encore replaced by a pass: `brickbreak`. Test arm: `xscissor`.
- `the encored move's target is RE-ROLLED, not aimed at the best foe` — the same board, the only knob
  the seeded rng. At 0.1 the forced X-Scissor hits `p1a`, at 0.9 it hits `p1b`. **Identical targets
  across that knob mean the re-roll is unwired**, which is what the file's own rule says and what the
  half-1-only run above prints.

**THE UN-ENCORED CONTROL IS ASSERTED IN EVERY ARM.** Half 2 changes target selection, so a fix that
re-aimed every click would pass the first probe and be catastrophic. The victim's partner clicks an
ordinary single-target Brick Break at a named body and lands on it — `brickbreak@p1b` — in both arms
and at every rng value; and the un-Encored victim's own Brick Break named `p1a` and hit `p1a` at both.

**THE STREAM IS THE INSTRUMENT, NOT `S.lastActs`.** `lastActs` is built from `acts` before the
dispatch loop, so it records what was CLICKED and is unchanged by this fix by design. The `|move|`
line is emitted below the BeforeMove gates and carries both halves of what is being tested — which
move ran and which body it ran at.

### COUNTERS

`MEDSEEN.encoreOverrodeAtExecution` (fires; measured 1 on the staged turn) and
`MEDFAILS.encoreOverrideUnbuilt` (0), which exists because falling through and playing the un-encored
move is a real behaviour change dressed as a no-op.

### FOUND AND NOT FIXED — reported, not absorbed

- **An Encore into a STATUS move cannot be honoured through the WIRE 24 path.** `mk()`'s rewrite goes
  through `targetForMove`, which opens `if(!mv||!hasPower(mv))return null` — so a caller handed a
  different move while the victim is locked into Swords Dance keeps its own click. The execution-time
  path added here goes through `playerAction` and does NOT have that limitation, so the two paths now
  disagree about status moves. Not touched: it is a change to the Choice-lock rewrite that every
  Choice holder rides, and it belongs with a probe of its own.
- **We still emit no `|-fail|` for a turn-1 Encore that correctly refuses** (WIRE 69's guard). Boards
  agree, so the state comparator is silent; the PROTOCOL arm of `game_differential.js` would see it.
  Carried forward from `@measure`'s note, unchanged.
- **The feature-semantics banner on `data/policy-weights.json` is pre-existing and is not this wire.**
  Proved rather than assumed: `encoreOverrodeAtExecution` reads **0** after building every fixture
  feature, so this block never executes on that board. It is a MEASURE item.

## A SPREAD *STATUS* MOVE REACHED ONE FOE. FOUR MOVES, ONE MISSING LOOP, AND `spreadFoes` HAD FOUR GREEN PROBES ALREADY. 2026-08-10.

Census **330 → 333 live, 0 missing, 0 threw.** Three new probes. Three roster rows —
`cottonspore`, `stringshot`, `sweetscent` — were DID-NOT-FIRE for this reason, and a fourth move came
with them.

**THE TAG WAS PROBED FOUR TIMES AND THE HOLE WAS STILL THERE.** `spreadFoes` carried live probes for
"Rock Slide hits both foes", the x0.75 rounding, the ordering across targets and the protecting
partner. Every one of them clicks a **damaging** move, so every one resolves through
`kind==='attack'` — which has built a real target ARRAY since WIRE 15. The `kind==='affect'` branch,
where every stat drop and every volatile lands, held a single body:

```js
let _t = reaimToSlot(a.target, it, actA, actB, a.mv);   // one Pokemon, for a move that hits two
```

Measured in a real turn before anything changed:

```
  cottonspore  foe0 sp=-2    foe1 sp=0      <- both should move
  stringshot   foe0 sp=-2    foe1 sp=0
  sweetscent   foe0 eva=-2   foe1 eva=0
  teeterdance  ally  -       foe0 confusion  foe1 -
```

**A HALF-WIRED MOVE PRODUCES THE SAME RECEIPT AS AN UNWIRED ONE, AND THAT IS THE FINDING.** The
roster stages the entity against a control arm that removes only it, and reads the DELTA. Its second
body never moved, so the delta was empty and all three printed DID-NOT-FIRE — the verdict for "this
engine does not have the mechanic". It had half of it. That is worse than absent, because the
instrument cannot tell the two apart and the honest-looking verdict points at the wrong work.

**THE FIX IS A LOOP AND NOT ONE GATE MOVED.** The branch now builds a target LIST off the tag and
runs the existing ~100-line gauntlet — Protect, Substitute, Good as Gold, `moveClassBlocked`,
`powderBlocked`, `pranksterBlocked`, the accuracy die, Strength Sap's heal, the boost loop, the
status/volatile loop — once per body, in order. Their `continue`s now end **that body's** pass through
the move instead of the whole move; for a single-target click the loop runs exactly once and every
call it makes is in the order it was already in.

- **The set comes off the TAG, and the two tags are not collapsed.** `spreadFoes` is ally-safe;
  `spreadAll` puts my own partner in the set, and **first** — `Pokemon#getMoveTargets` builds an
  `allAdjacent` list as `push(...adjacentAllies())` and only then `push(...adjacentFoes())`, the same
  order the damaging branch already takes.
- **Membership printed before wiring**, as this file's rule requires. `spreadFoes` reaches `affect`
  as cottonspore, stringshot, sweetscent; `spreadAll` as **teeterdance** alone. Corrosive Gas is
  `allAdjacent` too and `playerAction` classifies it `trickitem`, so it never arrives here — named
  rather than left to be rediscovered as a move this loop appears to cover and does not.
- **Once per move, not once per target:** `m._lastMove`, the `mvFail` for a move that found nobody, a
  user-directed `si` effect (Showdown carries `move.selfDropped` for exactly this), and `userFaints`.
  Memento's user dies once, and the comment that said *"reaching this line means the effect LANDED,
  because every refusal above `continue`s out"* is now false of a loop — so the claim is carried by a
  `_landed` count instead of by control flow, and the old sentence is corrected in place rather than
  left to be read as still true.

**THE RISK WAS THE SINGLE-TARGET CASE AND IT WAS MEASURED AS A DIFF, NOT ASSERTED.** Charm, Fake
Tears, Growl, Leer, Screech, Tickle, Thunder Wave, Will-O-Wisp, Toxic and Spore are the overwhelming
majority of this branch's traffic. 22 single-target status moves were run through a real turn against
the pre-change bytes and the post-change bytes, printing every stat stage, status and volatile of all
three non-acting bodies. **The two runs differ on exactly the four spread moves and on nothing else.**

**THE THREE PROBES, AND EACH HAS A CONTROL THAT IS THE SAME EFFECT WITH A DIFFERENT TARGET TYPE** —
not "no click", which an engine that splashed every status move across the field would also pass:

| probe | control | test |
|---|---|---|
| a spread STATUS move drops BOTH foes | Scary Face, `normal`, spe -2 → `0,-2,0` | String Shot, `allAdjacentFoes`, spe -2 → `0,-2,-2` |
| one foe's Protect does not shield the other | String Shot, nobody shielding → `0,-2,-2` | foe 1 behind a Protect → `0,0,-2`; Scary Face into that same Protect → `0,0,0` |
| `spreadAll` reaches my own partner | Confuse Ray, `normal` → `0,1,0` | Teeter Dance, `allAdjacent` → `1,1,1` |

Both bodies are legal: **Ariados** is the one species in this format that learns a `spreadFoes`
stat-drop and Scary Face, and **Mr. Rime** the one that learns Teeter Dance and Confuse Ray — checked
against the format's own learnsets rather than from memory.

**AND A SECOND CONSEQUENCE NOBODY WAS LOOKING FOR: A TARGETLESS CLICK WAS A NO-OP TURN.** A driver
that reads Showdown's request is handed **no target at all** for `allAdjacentFoes` — there is nothing
to aim — so `it.tgtSlot` is -1, `reaimToSlot` returned null and the branch took `mvFail`. Measured on
the same board, both engines:

```
  BEFORE: targetless cottonspore -> foe0 0   foe1 0        <- the whole turn, spent doing nothing
  AFTER:  targetless cottonspore -> foe0 -2  foe1 -2
```

That is exactly the shape ROADMAP #81 WIRE 9 found and fixed for the DAMAGING half of the family
(*"33 legal moves and 56,524 corpus uses dealing ZERO"*) — the status half was never touched, and the
fix here closes it for the same reason and by the same route: the turn loop never needed the aim.

**NOT FIXED, FOUND WHILE HERE.** Wide Guard does not stop a spread status move. Showdown's
`wideguard.onTryHit` refuses anything whose target is `allAdjacent` or `allAdjacentFoes` and says
nothing about category, so it should block all four of these. This branch has never checked it, and it
could not have mattered before today because the move only ever resolved as single-target. Left alone
deliberately — it is a new mechanic, not part of making this one loop, and it deserves its own failing
probe.

## THE ITEMS QUEUE: 6 → 3. EVERY ONE WAS A PRODUCER THAT COULD NOT NAME ITS MEMBER. 2026-08-10.

Roster items **6 → 3 DID-NOT-FIRE / 134 → 137 match**, 0 FIRED-AND-BOARDS-DIFFER throughout. Exactly
three verdicts changed and nothing else moved.

| item | uses | the defect |
|---|---|---|
| Iron Ball | 139 | `speedMult` matched `name === 'choicescarf'`. **The consumer worked and was starved.** |
| Light Ball | 41 | `statMult` matched four names, **all four banned here**, and nothing read the tag |
| Oran Berry | 1 | heals a **flat 10**, not a fraction; the regex read only `maxhp/N` |

**NOT ONE OF THE THREE WAS A MISSING MECHANIC.** That is the finding.

### A WORKING CONSUMER, STARVED BY A HARDCODED PRODUCER

`effSpeed` has read `speedMult` since WIRE 91 and is correct. Iron Ball halves Speed through the
**identical** `onModifySpe` handler as Choice Scarf. It read DID-NOT-FIRE for 139 uses because
`tag_dex` asked for a NAME.

CLAUDE.md's own rule is written for exactly this — *"match on tag shape, never on a name, so an
ability added later is picked up without editing the engine."* And the rule **immediately below**
`speedMult` in the same file records that lesson being learned for Life Orb, while `speedMult` sat
unfixed above it. Membership is derived now and is exactly two here: Choice Scarf x1.5, Iron Ball x0.5.

### A DEAD RULE AND A DEAD CONSUMER, DESCRIBING EACH OTHER

`statMult` hardcoded Choice Band, Choice Specs, Assault Vest, Eviolite. **All four are
`isNonstandard: 'Past'`** — CLAUDE.md names the first three on the ban list — none has a row in
`data/tags.json`, and **nothing in `engine/` read the tag.** `dmgRange` carried the mirror image:

```js
if(phys && att.item==='choiceband')  ACH(1.5);   // permanently false
if(!phys && att.item==='choicespecs')ACH(1.5);   // permanently false
if(!phys && def.item==='assaultvest')DCH(1.5);   // permanently false
```

Both derived now. The only member this format has is **Light Ball**, x2 to Atk and SpA and **only on
Pikachu** — the lock is carried in the tag and honoured in the consumer, compared on BASE species
because Showdown's own check is `baseSpecies.baseSpecies === "Pikachu"`.

### A DOCUMENTED GAP IS STILL A GAP

The residual loop said plainly: *"Oran restores a FLAT 10 HP, not a fraction — its param is honestly
null and it stays unwired."* Honest, accurate, and **the roster read it DID-NOT-FIRE regardless.**
`restoresFlat` is derived beside `restores` and is deliberately **not** scaled by max HP — that
distinction is the whole reason they are two fields. Sitrus unchanged.

### CORRECTED BY WILL, SAME DAY: WHAT IRON BALL IS ACTUALLY FOR

*(Will, 2026-08-10: "iron ball is mostly used in fling sets".)* The entry above framed 139 uses as if
the Speed halving were the item's whole value. It is not, and the correction cuts **both** ways:

- **The Fling half was already wired.** `flingable` derives base power, status and volatile straight
  from the dex, and Iron Ball's 130 BP — the highest Fling power in the game — was in the artifact
  throughout. This fix adds nothing to a Fling set.
- **The Trick Room half makes the defect WORSE than described.** Under Trick Room the SLOWER body moves
  first, so an item that halves your own Speed is a deliberate buff, not a cost. Before this fix the
  engine gave an Iron Ball holder **double its true Speed in exactly the room the item is brought
  for** — moving it last where the real game moves it first. That is a turn-order error in the item's
  primary use, not a damage rounding error in a fringe one.

**AND THE USAGE FIGURE ITSELF IS NOT SOLID, which is ROADMAP #70 again.** Attempting to characterise
the 139 against the store: `g.sheets` is populated on **1.7% of sides** (open-sheet games only) and
yields 15 Iron Ball rows; `g.sets` yields **zero**. Three sources, three answers, and no reconciliation
— so **no split between Fling and Trick Room sets is quoted here**, because n=15 cannot characterise
139 and the 139 itself is one of the disagreeing numbers. #70 is "two usage numbers disagree by up to
13x and the coverage bar ranks what gets wired by one of them"; this is that, met while using it.

**Two further Fling facts checked on the same prompt** (Will: *"fling light ball too for para"*,
*"i think fling iron ball flinches ... or is that king's rock"*) — the artifact was already right on
all three, so none of them is queue work:

| flung | BP | effect | our tag |
|---|---|---|---|
| Light Ball | 30 | **paralysis** | correct |
| Iron Ball | 130 | nothing — **no flinch** | correct |
| King's Rock | 30 | **flinch** — this is the one | correct, 96 uses |

King's Rock is the only legal item in this format whose Fling carries a volatile.

### STILL OPEN — three rows, and they are a bigger piece than these were

Big Root (53 uses, multiplies drain heals by 5324/4096), Shell Bell (44, heals 1/8 of damage dealt),
Metronome (19, powers up on consecutive same-move use). Each needs a **new tag AND a new consumer**,
where the three above needed only a producer fixed.

**Two more hardcodes of the same shape are filed and NOT fixed**, found while reading: `passiveHeal`
matches `name === 'leftovers'`, and `blocksSecondary` / `blocksPowder` match Covert Cloak and Safety
Goggles — **both of which this format bans.**

---

## THE DAMAGE CALCULATOR NEVER KNEW ABOUT DISGUISE — A WHOLE GATE CLAUSE WAS ONE ROW. 2026-08-10.

**THE GATE MOVED: 3 of 4 clauses failing → 2.** Release `a4c7f898ad0e`, all four re-measured on it.

```
PASS  game differential              0 of 150 disagree      (was FAIL, 1 of 150)
PASS  deliberate roster / abilities  84 fired and matched
FAIL  deliberate roster / items      0 differ, 6 did-not-fire
FAIL  deliberate roster / moves      23 differ, 24 did-not-fire
```

### THE ROW

```
chesnaught woodhammer -> mimikyu    showdown 0-0    medicham 120-130
```

Showdown's `disguise.onDamage` returns false: the MOVE deals zero. The `maxhp/8` that busts the
disguise is the ABILITY's damage, applied separately, and does not appear in the move's own number.

### THE CONTROL IS WHAT MADE IT UNDENIABLE

|  | with Disguise | with no ability |
|---|---|---|
| Showdown, real turn | lost **20** (= maxhp/8) | lost 117 |
| our battle **loop** | lost **16** (= maxhp/8) ✓ | lost 130 |
| our damage **calculator** | **120–142** | **120–142** |

The calculator gave **the same answer with and without the ability** — this project's own definition of
an unwired knob, borrowed from the roster.

### WHY IT SURVIVED

WIRE 136 has the loop right: it substitutes the chip and busts the forme, both engines land on the same
HP, and **ROADMAP #89 recorded the Disguise MODEL as correct while telling the truth.** Nobody asked
the other reader. `dmgRange` is what every board feature, every rollout leaf and `punishExposure`
consult — so the SEARCH believed a Wood Hammer killed a Mimikyu when the move does nothing at all.

**This is the `effMoveType` / `effWeatherOf` defect of 3.87.0 in a new place.** One fact, two readers,
one silent, each internally consistent, so nothing ever failed. `formeOnHitAbsorbs()` states it once
and both readers call it.

### ZERO AND NOT THE CHIP, DELIBERATELY

`dmgRange` answers "what does the MOVE do" — the question the authority answers with 0 and the question
the differential compares. The chip stays with the loop. **A hypothetical price therefore understates a
click into a fresh Mimikyu by `maxhp/8`**, which is stated rather than hidden and is far smaller than
the 120 it replaces.

### THE HAZARD WAS IN THE FIX, NOT THE FINDING

The loop's `dmg` comes **from** `dmgRange`. So the moment the calculator correctly returned 0, the
loop's `dmg > 0` guard would have been false **exactly when the disguise was there to bust** — no
forme change, no chip, a regression created by the fix itself. Caught by reading the call path before
running, not by a red test afterwards. The guard now asks what it always meant: a damaging move
(`bp > 0`) that is not immune (`eff > 0`).

### SIZE, STATED PLAINLY

Disguise is **149 sheet uses**, Mimikyu only; Ice Face is the family's only other member at **0**. Small
in corpus terms — and it was a quarter of the gate, and a decision error rather than a rounding one.

---

## ROADMAP #110 — THE USER'S OWN STAT DROP LIVES IN TWO SHOWDOWN FIELDS. THE BUILDER READ ONE, AND SIX WORKING MOVES HID IT. 2026-08-10.

Roster moves **25 → 23 differ / 360 → 362 match**, exactly two verdicts changed. Census unmoved at
**330 live / 330 probed / 0 missing**. Release `c587032378a3`.

### THE TWO FIELDS

`build/build_engine_data.js` enriched every move row from `d.self.boosts`. Showdown has a second,
separate field — `selfBoost.boosts` — and it is not a synonym: **`self` applies on use, `selfBoost`
only once the move has actually hit something.**

| move | field | boosts | uses | before |
|---|---|---|---|---|
| Clanging Scales | `selfBoost` | `{def:-1}` | 810 | user at 0 Def; Showdown at −1 then −2 |
| Scale Shot | `selfBoost` | `{def:-1, spe:+1}` | 199 | same, and the `+1 spe` half was the open note on its multi-hit row |

### WHY IT SURVIVED, WHICH IS THE PART WORTH KEEPING

Every move using `self.boosts` **works**, and the roster says so out loud:

```
  closecombat  dracometeor  overheat  leafstorm  superpower  makeitrain   -> FIRED-AND-BOARDS-MATCH
```

Close Combat alone is 12,155 uses. So "the user's own drop" was demonstrably live on 20,000+ uses and
looked closed. **The hole was a sibling field name, not a missing mechanic** — a shape no amount of
re-reading the working path surfaces, and the deliberate roster found it only because it stages
*every legal move* rather than the ones anybody thought to check.

`selfBoostsOf()` reads both and **warns** if a move ever carries both, rather than silently choosing.

### AN ALARM I RAISED AND THEN KILLED

Mid-investigation: the `lowersUser` tag has **no consumer anywhere in `engine/`**, across 13 moves and
**22,277 uses**, Close Combat included. That looked like a hole twice the size of the whole remaining
queue and I was about to file it as one.

**It is not a hole.** The engine applies these through `MC.moves[id].self` and the `selfBoosts`
secondary path — never through that tag. The six MATCH rows above are what killed it.

**A tag with no reader and a mechanic with no implementation are different claims**, and only
measurement separates them. Recorded here because the killing is the useful half; `docs/LESSONS.md` §5
now has enough of these that the pattern is the lesson.

### THE REGENERATION WAS ASKED BEFORE IT WAS RUN

```
  MOVES   changed 2   added 0   REMOVED 0
  SPECIES 318 -> 318   lost: []   species rows changed: 0
```

This builder was once one run from dropping ten species (3.88.0), so the diff is taken **every** time.

### TWO ROWS INVESTIGATED AND NOT FIXED — reported, not implied by silence

- ~~**Encore, 6,102 uses, the single heaviest row left.** It is **not** the missing action-override I
  first assumed. `WIRE 24` already binds a handed-in action to `_lock`, and Encore sets `_lock` when it
  lands, so the override is wired. The residual difference is **targeting**: Showdown's second
  aggressor hit Corviknight for 36, ours hit Goodra-Hisui for 55. Needs its own pass.~~
  **RETRACTED 2026-08-10 by WIRE 143 (top of this file), and the retracted half is the interesting
  one.** It WAS the missing action-override. `WIRE 24` binds a handed-in action to `_lock`, but it runs
  in `mk()` before the queue is sorted, and a mid-turn Encore is written after that — so on the one
  turn the override is reachable, `_lock` is still null and the rewrite cannot fire. The targeting
  observation was correct and was the SECOND half, not the residual: `getRandomTarget` re-rolls
  uniformly and `targetForMove` does not. Both are now probed. **The roster row's state is unknown
  until Will re-runs `tests/roster.js` against a frozen tree; it is not claimed closed here.**
- **The lock-in family** — Outrage, Petal Dance, Thrash, Raging Fury, Uproar. `DID-NOT-FIRE` because
  `self.volatileStatus: 'lockedmove'` **has no tag at all**: the engine has nothing to read, and the
  roster's control arm has nothing to strip, which is why the delta is empty rather than wrong. Real,
  and **101 sheet uses in total** — the lightest cluster in the queue. Filed, not built.

### THE QUEUE, RE-SIZED BY CORPUS WEIGHT

Measured rather than assumed, because I nearly spent a session on the 101-use family:

```
  6178  encore(6102) stockpile(66) electrify(7) teeterdance(3)     move/volatile
  1104  toxic                                                      move/status-inflict
  1047  tripleaxel(724) scaleshot(199) dragondarts(124)            move/multihit
   498  clangoroussoul(410) noretreat(88)                          move/boosts-self
   320  beatup                                                     move/variable-power
   145  the rest of move/plain-attack after this fix
```

---

## ROADMAP #110 — THE PARTIAL TRAP COUNTER STARTED ONE LOW. SEVEN ROWS, ONE FACT, AND IT IS THE VOLATILE-DURATION DEFECT A THIRD TIME. 2026-08-09.

Roster moves **32 → 25 differ / 353 → 360 match**. `DID-NOT-FIRE` unmoved at 24, `COULD-NOT-STAGE`
unmoved at 91. Census unmoved at **330 live / 330 probed / 0 missing**. Release `3683864c51c9`.

### THE SHAPE OF THE FINDING WAS THE DIAGNOSIS

Seven rows, and every one of them read the same two lines:

```
  turn 1   vol.trapped_by_move   showdown 4   ours 3    off-by-one
  turn 2   vol.trapped_by_move   showdown 3   ours 2    off-by-one
```

bind · firespin · infestation · sandtomb · snaptrap · whirlpool · wrap. Identical deltas across seven
independent rows is not seven bugs.

### TWO NUMBERS WITH THE SAME NAME

`data/tags.json` carried `partialTrap: { turns: '4-5', chipPerTurn: 0.125 }`, **typed by hand**.

`'4-5'` is the **folk quantity** — how many turns of chip the trapped side experiences. The quantity the
two engines are compared on is Showdown's `partiallytrapped` **duration**: it starts at **5**, and it is
decremented in the Residual event **of the turn the trap lands**. So the authority holds 4 at the end of
that turn. This engine initialised `_trap.turns` from the already-post-decrement 4 and then ticked it
again in the same residual → 3.

**This is the volatile-duration defect a THIRD time.** Perish Song was the first; ROADMAP #111's family
the second. It survived both because this counter lives in `_trap`, not in `_vol` — neither fix's blast
radius could reach a field they did not walk.

### DERIVED, NOT RESTATED — the only version that cannot come back

`engine/tag_dex.js:partialTrapShape()` reads the shape off Showdown's own condition:

| field | read from |
|---|---|
| `duration: 5` | `condition.duration` |
| `durationRange: [5,6]` | `durationCallback`'s `this.random(5, 7)` — Showdown's range is `[lo, hi)` |
| `durationItem: {gripclaw, 8}` | the callback's early return |
| `chipPerTurn: 1/8` | `onStart`'s `boundDivisor = source.hasItem("bindingband") ? 6 : 8` |
| `chipItem: {bindingband, 1/6}` | the same ternary's true branch |

It **fails closed**: if the condition stops parsing, `partialTrapShape` returns null, the tag is not
emitted, and the family refuses rather than guessing — #92's rule, and the reason the pinch family's
refusal was correct for as long as it lasted.

`turns: '4-5'` is **kept beside it, unchanged.** It is the honest answer to a different question, and
silently repurposing a field name is how the next one of these starts. Nothing reads it today.

Grip Claw and Binding Band are both `isNonstandard: 'Past'` here, so those two branches are **derived
and unreachable in this format** — recorded rather than pretended to be live.

### SHOWN RED ON FROZEN BYTES, NOT ASSERTED

The pre-fix release `b571cfd7a97e` — the one stamped into the roster artifact that reported the finding
— was opened and played:

```
  b571cfd7a97e   infestation   3  2  1        <- RED, one low from the landing turn
  live tree      infestation   4  3  2
  showdown                     4  3  2
```

### THE REGENERATION WAS ASKED BEFORE IT WAS RUN

Per the 3.88.0 lesson. `data/tags.json`: **7 `partialTrap` params changed, 0 removed, 0 other params
touched.** `klutz` gained a row — corpus growth, not this change; every `uses` count moved with it.

### WHAT DID NOT MOVE, SAID PLAINLY

**The whole-game differential is unchanged: 65 of 107 games diverge, on both releases, same seed.** A
game stops at its first divergence and these moves rarely reach it, so the fix is invisible at that
resolution. Stated because it is the measurement, not because it is the hoped-for result.

### AND A PROBE THAT READ AS FIVE FAILURES WAS WRONG

An ad-hoc two-engine check reported five of the seven still disagreeing after the fix. It does not
control accuracy: Bind, Fire Spin, Sand Tomb, Whirlpool and Wrap are 85–90%, and **Showdown missed on
turn 1**, shifting its whole column by a turn. The two 100%-accuracy members agreed exactly.
`docs/LESSONS.md` §5 — rule out the probe first. The roster, which pins the dice, is what settled it.

---

## ROADMAP #116 — `new Battle()` VALIDATES NOTHING, SO A PROBE COULD MEASURE A MECHANIC THIS FORMAT DOES NOT CONTAIN. 2026-08-09.

**Will's question is the whole fix:** *"why dont we use showdowns teams validator that is universal
truth"*. I had proposed a hand-rolled `isNonstandard` guard. His answer is better and it is not close.

### THE HOLE

`new Battle()` **runs no validation at all.** Every probe in this repo that does `p.ability = ab.id`,
sets `p.item`, or hands a set to `Teams.pack` walks straight past every rule in the format. Showdown
will simulate a Garchomp holding a Rocky Helmet quite happily. MEDICHAM will too. **The two agree, and
the row reads as a PASS about a mechanic no real game can reach** — the signature failure of this
project, arriving through the last door left open.

Nothing was actually broken by it, and that is luck rather than design. Measured the same day:

```
banned in gen9championsvgc2026regmb   4 abilities · 435 items · 454 moves
tests/roster.js staged                99 abilities · 140 items · 409 moves — ZERO banned
```

`roster.js` derives its population from `Dex.forFormat` and excludes `isNonstandard` before staging, so
**the roster is clean by construction and every hand-rolled probe was clean by luck.**

### WHY THE VALIDATOR AND NOT A BAN CHECK — MEASURED, NOT ARGUED

| staged | verdict | the authority's own words |
|---|---|---|
| Rocky Helmet on Garchomp | BANNED | *"Garchomp's item Rocky Helmet does not exist in Gen 9."* |
| Assault Vest, Loaded Dice, Silk Trap | BANNED | same shape |
| `Nonsense Orb` | BANNED | *"'nonsenseorb' is an invalid item."* |
| **Flamethrower on Meganium** | **PAIRING** | *"Meganium can't learn Flamethrower."* |
| Pure Power on Snorlax | PAIRING | *"Snorlax can't have Pure Power."* |
| Skill Link on Toucannon | LEGAL | — |
| Garchomp @ Choice Scarf | LEGAL | — |

**Flamethrower is a perfectly legal move.** Meganium simply cannot learn it, and only a learnset walk
knows that — an `isNonstandard` check would have waved it straight through. That exact set was
hand-staged by a session on **2026-08-08** while probing Mega Sol, and nothing stopped it.

### THE PART I GOT WRONG FIRST, AND IT WOULD HAVE MADE THE GUARD USELESS

The first draft threw on **any** validator complaint. Within the hour it was refusing every honest
probe, because `Illuminate` — `probe_pair.QUIET_ABILITY`, the named control stamped on every body — is
illegal on Snorlax, Gengar and Meganium alike. **That staging is deliberate:** a control that varies
with the species is exactly the Fluffy/Sand Rush failure (#100) that produced four false findings
across 2,049 uses. A guard that refuses everything gets switched off, and then we are back where we
started with an extra file.

So the complaints are **classified**, in `engine/champions_sim.classify`:

| class | means | policy |
|---|---|---|
| **BANNED** | the format does not contain this entity | **always fatal, never waivable** — there is no probe for which a fictional mechanic is the right subject |
| **PAIRING** | the entity is legal; this species cannot hold it | **declarable** via `iKnowThisPairingIsIllegal`, with a written reason |

`tests/test-pinch-family.js` declares it once at its single choke point: every row stages a typed
ability and its typed move on one generic Farigiraf, and holding the body fixed is what makes Blaze's
row comparable to Torrent's. The declaration waives pairing and **does not** waive the ban — a
self-test row passes the declaration alongside a Rocky Helmet and still throws.

### THE WRINKLE, RECORDED SO IT IS NOT REDISCOVERED

Probes build **flat, zero-SP bodies on purpose**, so both engines derive the same stat line
independently. Champions requires the 66-point budget **spent**, so the validator rejects a flat body
outright — *"Garchomp has exactly 0 Stat Points - did you forget to invest it?"* — and that verdict
**masks** the legality answer. `checkLegal` stamps a legal spread onto a **copy** purely to satisfy the
budget rule. Legality and stats are separate questions; the caller still battles with its own flat body.

### THE GUARD'S FIRST TWO FINDINGS WERE IN THE HARNESS THAT HOSTS IT

- **`Tackle` is `isNonstandard: 'Past'`.** It does not exist in this format, and **every inert slot in
  `probe_pair.js` carried it** — the defender's moveset and all three filler slots. Harmless, because
  those slots never move. `CS.firstLegalMove(species)` derives it now, walking the prevo chain.
- **The validator's own padding was illegal.** Champions rejects a team of one, so the subject is
  validated inside a full team — and I named the five filler species by hand. **Sandshrew is not in
  this format.** Every verdict came back carrying *"Sandshrew does not exist in Gen 9."* The pool is
  read from the format now and each candidate is validated **before** it is used as padding; filler
  complaints are reported separately as `fillerProblems` and never folded into the subject's verdict.

Both are the same defect as the Loaded Dice retraction one version below: **a name recalled instead of
read**, committed inside the function whose entire purpose is to stop that.

### THE SWEEP, 3.92.0 — FIVE MORE SITES, AND TWO OF THEM WERE DEFECTS

`Tackle` in one harness raised the obvious question: is it alone. It is not.

**The assignment surface is clean.** Every string literal assigned to `.item` or `.ability` across
**238 files in `tests/` and `engine/`** was checked against the format. One hit: `noability`, which is
the blank sentinel. So the direct-assignment hazard #116 was written about **never actually fired**.

**The move-literal surface is not.** Five sites, and they are not the same kind of thing:

| site | staged | kind |
|---|---|---|
| `test-engine-diff.js`, `test-damage-stages.js` | `Tackle` in every inert slot | cosmetic — the slot never acts |
| `test-degradation-budgets.js` | `['tackle']` as the fallback moveset | a slot with no recorded moves scored on a move the format lacks |
| **`test-priority-block.js`** | `'splash'` silencing three slots | **worked by accident** |
| **`test-dead-volatile.js`** | `Thousand Arrows`, admitted `if (ta.exists)` | **the guard could never fire** |

**The silencer worked because the engine had never heard of the move.** Splash is `Past` AND has **no
row in `MC.moves` at all**. The defender and both partners were quiet through ABSENCE, not through the
move doing nothing — a distinction with no observable difference until the day a row appears. Every
classic no-op is gone the same way: Celebrate and Hold Hands are `Past` too, so there is nothing to
swap in by reflex. `CS.INERT_MOVE` is **Recycle**, named and justified rather than derived — a filter
for status-moves-with-no-declarative-effect still returns Belly Drum, Rest and Moonlight, because
Showdown implements those in handlers. The file now **asserts the silencer has an `MC.moves` row and 0
base power before it silences anything.** Results identical: 21 HP through, 0 under each blocker, 13
under the Grassy Terrain control.

**`.exists` IS TRUE FOR A BANNED MOVE.** `test-dead-volatile.js` admitted the damaging-move-with-a-
volatile case only `if (ta && ta.exists)`, and Thousand Arrows is `isNonstandard: 'Past'`. The branch
**always** ran, always on a move this format cannot contain, and the else-branch that would have
declared the gap was unreachable. Note the trap in the obvious fix: tightening the guard makes the else
fire and the case go **untested**, which moves the hole rather than closing it. So the subject is
derived — highest-power legal move carrying a volatile, **Smack Down**, 50 BP. Eight qualify; naming
one would rot at the next regulation. 16/16.

**Nothing moved, and that is the expected result** — `test-damage-stages` 1728/1728 exact,
`test-engine-diff` 0 disagree, `test-degradation-budgets` 11/0. Each of these was an inert slot or an
unreachable branch. The value is that none can become live and wrong later.

### STILL OPEN — NAMED, NOT IMPLIED BY SILENCE

The TeamValidator guard is on `tests/probe_pair.js` only. `tests/staged_board.js` and
`engine/game_differential.js` (`buildPair`) still assign directly and are unguarded. `test-mechanics.js`
and `test-damage-stages.js` were checked by the sweep above and stage nothing the format lacks, so they
are lower priority than they looked when #116 was written. #116 stays open until the two remaining
sites are covered.

**Green:** `probe_pair` self-test 16/16 (four refusals, three forgiveness rows — the forgiven cases are
tested as hard as the refused ones), `test-pinch-family` 65/65. **No engine behaviour changed, no
artifact was regenerated, and every quarantined figure stays quarantined.**

---

## ROADMAP #103 — THE MULTI-HIT CLUSTER WAS A COUNT, NOT AN ARITHMETIC. ELEVEN ROSTER ROWS, EIGHT OF THEM CLOSED. 2026-08-09.

Census **329 → 330 live / 329 → 330 probed**, 0 missing, 0 hollow, 0 `threw`, 0 unarmed, 0
direct-call. Roster **moves 40 → 32 DIFFER · 24 DID-NOT-FIRE · 345 → 353 MATCH**; abilities **0 · 0**,
the PASS clause still green; items **0 DIFFER · 6 DID-NOT-FIRE**, unmoved. Differential **1 of 150**,
unmoved. Release **`b571cfd7a97e`** (before-arm: `9efcae3a60e2`).

### THE BASELINE THAT WAS QUOTED WAS STALE, AND SAYING SO IS THE FIRST FINDING

`data/roster.moves.json` read **50 DIFFER · 27 DID-NOT-FIRE · 332 MATCH** and was written
**2026-08-08 22:48 against release `6f7fbc538318`** — before ROADMAP #112, #101 and #102. Re-run
against `9efcae3a60e2`, which is the tree those three landed on, the same stage reads **40 · 24 ·
345**. Ten of the eighteen DIFFER rows and all three DID-NOT-FIRE rows that appear to close here had
already closed. **The attributable delta of this pass is exactly −8 DIFFER / +8 MATCH**, and it is
exactly the eight multi-hit members. The same lesson as `data/interaction-matrix.json` on 2026-08-08:
compare an artifact's mtime to the thing it measured before quoting it. All three stage artifacts
have been re-written on `b571cfd7a97e`; the old bytes are at `data/roster.<stage>.prev.json`.

### THE HYPOTHESIS THAT WAS RIGHT, AND THE NUMBER THAT DECIDED IT

Two were on the table: a **per-hit floor** (`n·floor(v)` against `floor(n·v)`), or the **hit count**.
The count, and it is not close.

`|-hitcount|` read straight out of Showdown, driven through `battle.choose` so every hit runs, under
the differential's own two pin corners:

| move | top corner | bottom corner | this engine, both corners |
|---|---|---|---|
| Icicle Spear | **5** | **2** | 3.1 |
| Water Shuriken | **5** | **2** | 3.1 |
| Rock Blast / Tail Slap / Pin Missile / Bone Rush | (misses — sub-100) | **2** | 3.1 |
| Double Hit / Dual Wingbeat / Twin Beam | — | 2 | 2 — the controls, and they always matched |

`sim/battle-actions.ts:869` samples a **twenty-element table** (`[2×7, 3×7, 4×3, 5×3]`, the 35/35/15/15
its comment states) and `PRNG.sample` is `items[random(items.length)]` — so the pin selects **element
19 or element 0**, never a middle. This engine answered the mean of that table, 3.1, to every question
ever asked about the family. **That is why the eleven rows split BOTH WAYS**: 3.1 is too few against a
5 and too many against a 2, on the same move. A fix aimed at "we do not multi-hit" would have been
aimed at a bug that was not there.

**And the per-hit floor is NOT in it, which is worth stating because it was the plausible one.**
`roll()` already returns an integer, so with an INTEGER count `Math.floor(v*n)` and `n*v` are the same
number for every v and every n. The floor only ever mattered because the count was fractional. The
line at `dmgRange`'s tail did not need to change and did not.

### WHAT LANDED

- **`rollHitsOf(moveId, rnd)`** — the count a turn actually gets, beside `expectedHitsOf`, which stays
  a PRICE and is still what a board feature, a rollout leaf and `punishExposure` read. The 2-5 table is
  **copied verbatim rather than summarised**, because the pin reads an INDEX into it: any table with
  the same distribution and a different length or order answers differently at exactly the two corners
  every instrument here measures at.
- **The per-hit accuracy is ROLLED and BREAKS**, as `battle-actions.ts:910` does — hits 2..n each roll
  and the FIRST miss ends the move. Not the same object as `expectedHitsOf`'s `1+p+p²`, which is a
  mean. It agrees with the authority at both corners (`randomChance(90,100)` is `0 < 90` and `99 < 90`)
  and it is counted (`MEDSEEN.multiHitAccuracyStopped`), because at a CONSTANT rng it can never fire:
  the whole-move roll and the per-hit roll share a threshold, so any draw that breaks hit 2 also loses
  hit 1. Demonstrated firing under a varying stream (first three draws low, then 0.95 → 1 stop).
- **ONE COUNT PER MOVE USE, DRAWN LAZILY.** The authority draws `targetHits` once, before the loop over
  targets and after the accuracy steps. Drawing per target would hit one body five times and the other
  twice off one click; drawing earlier would sit at a different position in the rng stream.
- **The REACTION count reads the same draw.** WIRE 84's comment said "3.1 → 3, which is what a seeded
  Showdown rolls" and that was simply untrue — the authority reports 5 or 2, never 3. A damage step
  that draws a count beside an effects step that rounds an expectation is two implementations of one
  fact, and Bullet Seed would have dealt five hits of damage while setting off Weak Armor three times.
- **Two refusals are counted, both reading 0:** `MEDFAILS.multiHitRangeNot2To5` (a range the authority
  resolves with `random(min,max+1)` — no such move exists in this format today, and its two engines
  would DISAGREE under the pin, so it must be visible when one arrives) and `MEDFAILS.multiHitNoCount`.

### THE PROOF — red on the unfixed engine, then green

`probe('move','multiHit', 'Icicle Spear lands FIVE hits at one rng corner and TWO at the other, as
Showdown does')` in `tests/test-mechanics.js`. **The knob is the rng corner and the measurement is a
RATIO**: the corner also moves the damage roll and the crit, so comparing the two corners directly
would prove nothing. Each corner is compared against a single-hit copy of the same move **at that same
corner** (the id is changed so the tag lookup misses), and the ratio is the hit count with everything
else divided out. Icicle Spear because it is 100-accurate — a sub-100 move misses at the top corner and
there would be no top arm to read.

```
RED   (c.hits withheld from dmgRange)   one hit [92,112] -> [285,347]   ratios 3.10 and 3.10
GREEN (the count handed over)           one hit [92,112] -> [460,224]   ratios 5.00 and 2.00
```

The red arm is the whole diagnosis in one line: **identical ratios across a varied knob mean the knob
is unwired.** The census read 330 probed / **329** live / 1 missing under it, and 330/330/0 after.

**Double Hit is the positive control and it did not move** — 2 hits, no variance, `FIRED-AND-BOARDS-
MATCH` before and after, alongside Dual Wingbeat and Twin Beam. A fix that greened the 2-5 family
while disturbing them would have broken the model.

### THREE ROWS THAT ARE NOT THIS BUG, EACH FILED AS ITS OWN

| row | uses | what it actually is | why it is not swept in |
|---|---|---|---|
| `tripleaxel` | 718 | **rising base power** — 20/40/60 by hit (`basePowerCallback: 20 * move.hit`). Ours is now the right COUNT (3) at the wrong power: 24 damage against the authority's 47 on the staged body | `data/tags.json` carries `variablePower: {computed:true, note:'idiom not yet derivable'}`. It needs a derivation in `engine/tag_dex.js`, not a count |
| `scaleshot` | 199 | **the self-boost** (`def −1 / spe +1` after the last hit) never fires: sd −1/+1, ours 0/0. Damage is not the complaint | **BLOCKED ON A FILE THIS DIVISION MAY NOT EDIT.** `MC.moves['scaleshot']` is `{t,c,bp}` with no `self` at all — `build/build_engine_data.js` writes `mv.self` for pure DROPS and Scale Shot's is mixed. The tag's params carry booleans (`raisesSpeed`, `alsoLowers`), not the table. Either route is a refit |
| `dragondarts` | 124 | **`smartTarget`** — in doubles it hits each foe once rather than the same target twice, so it moves a SECOND body (torterra 1326 against our 1360). A targeting mechanic | nothing to do with the count; it is a different step of the hit loop |

**ONE adjacent gap this wire makes reachable for the first time, filed not fixed: Skill Link**
(`onModifyMove: move.multihit = move.multihit[1]`) — it forces a 2–5 move to always land 5, and until
tonight there was no count for it to rewrite. **46 corpus uses; the only legal carriers in this format
are Heracross-Mega and Toucannon.** No failing probe yet, so it is not open work.

~~and **Loaded Dice**~~ — **RETRACTED, 2026-08-09, caught by Will within minutes of it being written.**
Loaded Dice is **`isNonstandard: 'Past'` in this format**: it does not exist here and has no corpus row.
It was named from memory in a session that had just measured the roster staging **zero** banned
entities out of 99 abilities, 140 items and 409 moves. The roster reads the ban as a mechanism; the
prose did not. `engine/game_differential.js:351` and the 3.62.0 changelog entry also mention Loaded
Dice and are CORRECT — they describe where Showdown's own rng is called in `sim/battle-actions.ts`,
which is a fact about Showdown's source and not a claim about this format.

### THE HAND LIST IS UNCHANGED

Nothing leaves it. The multi-hit cluster was a queue in `data/roster.moves.json`, not a hand claim —
`Rivalry` is still the only entry and is still blocked on `data/engine-data.js` carrying no gender.

### ONE PIECE OF PROSE IN AN INSTRUMENT IS NOW WRONG, AND IT IS NOT MINE TO EDIT

`tests/roster.js:3694` states *"`random(m, n)` is pinned to `m` in EVERY arm, so a 2-5 range lands on
TWO hits"*, and every one of the family's fourteen rows prints **"THE PIN LANDS ON 2 HIT(S)"** in its
note. **It is 5 at the top corner.** The claim is true of the authority's OTHER branch — the range form
`random(min, max+1)` — and the 2-5 family does not take that branch; it takes `sample`, which is a
single-argument `random(20)`. The note is annotation and no verdict rests on it, but it is exactly the
kind of confidently-wrong sentence that steers the next reader, and it is printed on every run. Filed
for whoever holds `tests/roster.js`.

## ROADMAP #101 + #102 — A FAMILY THAT FAILED *OPEN*, AND 1,024 USES OF A HEAL THAT HEALED 0.000 HP. 2026-08-09.

Census **326 → 329 live / 326 → 329 probed**, 0 missing, 0 hollow, 0 `threw`, 0 unarmed, 0
direct-call. Roster unmoved on all three stages (moves 50 DIFFER · 27 DID-NOT-FIRE · 332 MATCH;
abilities **0 · 0**, the PASS clause still green; items 0 DIFFER · 6 DID-NOT-FIRE). Differential
**1 of 150**, unchanged. Two unrelated mechanisms, two separate proofs.

### #101 — `buffsHolderOnHit` IGNORED THE CONDITION THAT WAS ALREADY IN THE ARTIFACT

3.88.0 landed the derivation and said so plainly: *"THE ENGINE DOES NOT READ ANY OF IT YET."* It does
now. `medicham2-browser.js` applied `_buff.boosts` on **every connecting hit**, so eleven of the
family's twelve members produced a **wrong answer on every hit** rather than no answer:

| measured on one Knock Off into a 20x-HP Garchomp | before | after |
|---|---|---|
| `angerpoint` non-crit | **atk +6** | atk 0 |
| `angerpoint` on a CRIT | atk +6 — *identical, an unwired knob* | **atk +6 (maxed)** |
| `justified` off CLOSE COMBAT (Fighting) | **atk +1** | atk 0 |
| `weakarmor` off DARK PULSE (special) | **def -1 / spe +2** | 0 / 0 |
| `stamina` — the positive control, 2,773 of the family's 2,972 uses | def +1 | def +1 |

Stamina carries `when: null` and was correct throughout, which is exactly why nothing noticed the
other eleven. **The direction of the error is what made this different from #112.** The pinch family
failed CLOSED — a missing mechanic, nothing happened. This one failed OPEN, so every landed condition
is an improvement on its own and a partial landing would still have been net positive.

**`condHolds` widened, and that was the whole cost #112 predicted.** `hpFraction` asks about the
HOLDER; every #101 condition asks about the INCOMING MOVE, so a third argument now carries the hit —
`{crit, moveType, category, moveId}`. Four shapes are readable (`crit`, `moveType`, `moveCategory`,
`moveFlag`); anything else REFUSES and is counted in `MEDFAILS.buffOnHitUnknownCond`, which reads 0.
`R.crit` is passed RAW rather than through `!!`, because coercing it would turn "the damage step never
ran, so nobody knows" into a confident `false` and Anger Point would silently never fire again.

**The second defect in the same block: the guard was `_buff.boosts && tg.boosts`, so every member
whose payload is a VOLATILE was dropped entirely** — `electromorphosis` (98 uses, `charge`),
`windpower`, `perishbody`. They are still not granted: this engine has no consumer that multiplies an
Electric move by a banked Charge, and `perishsong` has a clock but its DURATION is carried by the
MOVE's `perishClock` tag, which no ability states. **What changed is that the debt is now counted at
the moment the condition HOLDS** (`MEDFAILS.buffOnHitVolatileUnwired`), so it is a readable claim
rather than a dropped branch. Filed, not fixed, and named here rather than left to be rediscovered.

### #102 — SYNTHESIS, MOONLIGHT, MORNING SUN AND STRENGTH SAP DID NOTHING AT ALL

1,024 uses. The first three resolved to `{kind:'pass'}` — a wasted turn — and in **sand the click was
strictly worse than doing nothing**, because the residual still chipped the body that had just spent
its turn. Measured on a 155 HP Venusaur from half HP, before a line changed: `healed 0` in clear, sun
and rain, and `-9` in sand, against Recover's 77 on the same body.

The blocker was real and it expired. `healParam` could only size an `Array` fraction, and the tag says
`heal: true` — *a boolean in a fraction's clothing*, as `MEDFAILS.healProcedural`'s own comment put it.
`data/tags.json` now carries `weatherScaled.baseHealFraction` (3 moves, membership printed over the
whole table first) and `healsSelf.fromTargetStat` (**exactly one move**). So:

- the fraction comes through **`md4096`**, not a fraction. The handler is
  `this.heal(this.modify(pokemon.maxhp, factor))` with factor literally `0.5 / 0.667 / 0.25`, and
  `maxhp * 2/3` is not what the authority computes. On 155 HP: **clear 77, sun 103, rain 39.**
- the sky is the **healer's**, through `effWeatherOf`, so Cloud Nine suppression and Mega Sol's
  private sun reach the heal exactly as they reach the damage formula;
- `healParam` returns the **recipe**, not the amount, because it is called by `playerAction` at CLICK
  time and the sky can move before the move goes off — an ally's Sunny Day earlier in the same turn
  turns a Synthesis from 1/2 into 2/3.

**Strength Sap (710 uses) is deliberately NOT classified as a heal.** WIRE 79 already models its
Attack drop in the `affect` branch, and the drop is the half that decides where the move is played;
claiming it here would have traded one missing half for the other. The heal lands inside that branch
instead, where the target is in hand, and it follows the handler in all three of its parts: a target
already at **-6 Attack makes the whole move fail**, the Attack is read **before** the drop, and it is
the **stat itself**, boosted and unmodified — `statWithBoost`, spelled the way `sim/pokemon.ts` spells
it (multiply on a positive stage, **divide** on a negative one).

**A pre-existing difference found while doing that, filed not fixed:** `dmgRange` applies boost stages
as `Math.floor(x * boostMul(s))` where the authority divides on a negative stage. The two disagree
wherever the float lands just under an integer — at `s = -1, x = 3` they give 1 and 2. It is a DAMAGE
change and this was a heal, so it is named here and left alone.

### THE PROOFS — red on the unfixed engine, then green, then the census

Three probes, all through real turns, all in `tests/test-mechanics.js`:

- `ability|buffsHolderOnHit` — *"Anger Point needs the crit, and Stamina does not move"*. Four knobs
  each against its own control: the crit die (same ability, same move, only the die moves), moveType
  (Knock Off vs Close Combat), moveCategory (Close Combat vs Dark Pulse), and **Stamina read on BOTH
  sides of the crit die** — a change that greens Anger Point while moving Stamina has broken the model.
  Plus a `none` arm on the crit, so "+6 after a crit" cannot come from the crit itself. The crit lever
  is the rng: the loop draws the roll index then the crit roll from one stream, so `() => 0` lands it.
- `move|weatherScaled` — *"Synthesis heals half, two thirds in sun and a quarter in rain"*. **Staged
  on a body at 1 HP, and that is the whole staging.** A full-HP body reads 0 → 0 forever; a HALF-HP
  body caps the sun arm at max HP, so clear and sun would print 77 and 78 and the 2/3 would be
  invisible. Tailwind in the same sun is the fourth arm and heals exactly nothing.
- `move|healsSelf` — *"Strength Sap heals by the TARGET's Attack, and drops it"*. **The target is the
  varied knob**: Alakazam 63 and Milotic 72, each heal equal to that target's own Attack. An engine
  healing a flat fraction of the user's max HP passes "it healed something" and fails this.

**`+6, not +12`, and it is not a clamp bug.** The tag says `{atk: 12}` because Showdown's handler is
`setBoost({atk: 12})` — its way of writing "max it out from wherever you are". This engine clamps every
stage to ±6 and `boostMul` clamps again, so +6 IS the maxed stage and the effective Attack is
identical; a body carrying a literal 12 would be a value nothing else in this engine can read.

### NOT MINE, NOT FIXED, REPORTED

- **Growth is +1/+1 where Showdown gives +2/+2 in sun.** `weatherScaled.byWeather.boosts` has no
  consumer at all, and the current build additionally patches `growth` so a PRIVATE sun grants nothing.
  5 uses. Deliberately not swept into this pass.
- **`node engine/status.js` still opens with FEATURE SEMANTICS CHECK FAILED on the same eight
  features** (`koTarget`, `dmgFrac`, `killIsRoll`, `killsThreat`, `switchSurvives1`, `switchKOSlow`,
  `switchDiesFirst`, `screenValue`). Verified as the identical eight this file already records —
  **not caused by this pass**, and MEASURE's to clear.

## ROADMAP #96 WIRE 3 — TWO TYPE AUTHORITIES, TWO DIFFERENT SKIES. A MEGA SOL WEATHER BALL DID NOTHING AT ALL TO A GHOST. 2026-08-09.

Census **325 → 326 live / 325 → 326 probed**, 0 missing, 0 hollow, 0 `threw`, 0 unarmed, 0
direct-call. Roster unmoved on all three stages (moves 50 DIFFER · 27 DID-NOT-FIRE · 332 MATCH;
abilities **0 · 0**, the PASS clause still green; items 0 DIFFER · 6 DID-NOT-FIRE).
`test-engine-diff` unmoved at **1/150**.

### THE DEFECT: WIRE 126'S OWN HAZARD, INSIDE WIRE 126'S OWN FUNCTION

WIRE 126 exists because *"what type is this move really"* had two implementations and one was half
done. The function it created to be the single answer then disagreed with `dmgRange` about a
different input — **the weather**:

```js
effMoveType   ...field&&field.weather&&!field.wSup...      // the RAW field
dmgRange      const _ew = effWeatherOf(field, att, def);   // the EFFECTIVE sky
```

`effWeatherOf` applies the **private** sky — the `privateWeather` tag, WIRE 99, Mega Sol, whose
holder's own moves resolve as if its sun were up while the field reports none. `effMoveType` did not.
So under a private sun with a clear field the damage calc priced Weather Ball as **Fire, 128-151**,
and the battle loop's stage-5 immunity gate refused it as **Normal**. Into a Ghost that is not a
rounding error: **the mega's headline click dealt literally zero.**

`effMoveType` is the loop's authority at five sites — the immunity gate, the absorb check, the
Lightning Rod draw, Protean's retype and the Fire thaw — so all five read a sky that was not the one
the attacker was standing under.

**THE FIX IS A CALL, NOT A COPY.** `effMoveType` now asks `effWeatherOf(field, att)`. Re-deriving the
private sky inside it would have rebuilt the two-implementations defect one line later.

**THE DEFENDER'S SUPPRESSION IS THE ONE THING THIS HELPER STILL CANNOT SEE, and it is written down
rather than handled.** `effMoveType` is handed no defender. In the loop that costs nothing —
`field.wSup` is the loop's answer over all four actives and `effWeatherOf` honours it — so a `def`
parameter would be dead code at every loop site. A PURE call holding a Cloud Nine defender would see
a sky `dmgRange` blanks. Stated at the line.

### THE SECOND SITE, AND WIRE 126'S HOLD IS LIFTED WITH ITS REASON KEPT

`clickFragility` did not pass `att` — a **declared hold**, not an oversight: it feeds `benchRisk`, so
moving it owes a refit. **The hold was half-effective and the other half was a contradiction inside
one function.** `base`, computed two lines above, is `dmgRange(att,...)` and already saw both the
private sun and the -ate conversion; the fragility branch then read the raw type. Measured on a
Meganium-Mega: `base.max = 151` and, from the same call, `retention 0, "type-immune to Normal
(chart)"`.

It now passes `att`. **`benchRisk` moves for -ate bodies and private-weather bodies, so the fitted
vector is owed a refit at the next release cut — MEASURE's edge, flagged, not spent here.**

### THE PROBE IS THE CROSS, AND NEITHER HALF'S PROBE COULD EVER HAVE SEEN IT

`weatherBall` ran through the loop under **public** skies only, where the two authorities agree.
`privateWeather` ran Mega Sol with **Flamethrower**, whose type no sky can move. The new probe
`ability/privateWeatherMoveType` is the intersection: a private sky **and** a move the sky retypes
**and** a Ghost, so the comparison is zero-against-a-number and cannot hide behind a multiplier.

**THE THIRD ARM MAKES IT AN EQUALITY.** Showdown's `Pokemon.effectiveWeather()` returns `sunnyday`
outright for a `megasol` body, and *both* of Weather Ball's handlers read it (`onModifyType` for the
type, `onModifyMove` for the base power). A wire that converted the type and lost the BP doubling
would pass a bare `> 0`. So the assertion is **private sun === public sun**.

Official engine, played through `battle.makeChoices` rather than remembered (and the first attempt
had Gengar clicking Protect, which read 0 in all four cells — the probe wrong before the engine, as
usual):

| mega | sky | forme | damage into Gengar | `-immune` |
|---|---|---|---|---|
| no | clear | Meganium | 0/135 | **yes** |
| **YES** | clear | Meganium-Mega | **97/135** | no |
| no | public sun | Meganium | 62/135 | no |
| **YES** | public sun | Meganium-Mega | **97/135** | no |

Ours, same shape: control **0**, public sun **140**, private sun **0 → 140**.

### SHOWN RED BEFORE GREEN — THREE ROWS IN `probe_red_demo.js`

```
ROADMAP #96  a PRIVATE sky changes Weather Ball's type for the battle loop, not only for dmgRange
             shipped-arm=true  reverted-arm=false
ROADMAP #96  PUBLIC sun and the Normal-into-Ghost control are unmoved on BOTH builds
             shipped[control=0 publicSun=140 privateSun=140] reverted[control=0 publicSun=140 privateSun=0]
ROADMAP #96  clickFragility prices the click as the type the SKY makes it, not the printed one
             shipped-arm=true  reverted-arm=false
```

The middle row **is the positive control**: public weather was correct before this wire and is
identical on both builds, and so is the Normal-into-Ghost immunity. A change that fixed the private
sky while disturbing either would have broken the model.

### THE PAIRED DIFFERENTIAL: IDENTICAL, AND THE REASON IS MEASURED RATHER THAN ASSUMED

Two arms, same pinned team store (copied out of the tree so OPS cannot append under it), same pinned
326-row census, same pin, same `--games 2008 --turns 12 --state --nature real`, differing in
`--release` and in nothing else. `engine/arms_comparable.js`: **COMPARABLE**.

| | BEFORE `759a0d3292f5` | AFTER `2046f06452bd` |
|---|---|---|
| games (primary arm) | 1553 | 1553 |
| diverged, top-tie-first | 668 | 668 |
| diverged, bottom-tie-first | 738 | 738 |
| turn-1 boards identical | 1520 (97.88%) | 1520 (97.88%) |
| classes / state / coverage / first divergences | — | **byte-identical** |

**IDENTICAL ACROSS A VARIED KNOB USUALLY MEANS THE KNOB IS UNWIRED, so it was checked both ways.**
The arms' own `source_digests` differ in **exactly one file** (`engine/medicham2-browser.js`,
`f6c945c0261c` → `f6b25f9476e2`), and the cross case run against the two **frozen snapshots the
arms actually loaded** gives `privateSun 0` and `privateSun 140`. The instrument then says why it
saw nothing: it lists **`move:weatherBall` and `ability:privateWeatherMoveType` among the 47 census
rows it declares unmeasurable** (`why: "names"` — a census key that is not a tag in `tags.json`
steers nothing). The differential cannot reach this mechanic, and now says so by name.

**ONE COST, DECLARED: `47 census rows steer nothing` was 46.** The new probe's key is synthetic, the
same class as the existing `weatherBall` row. Naming it after a real tag would collide with a probe
that already holds that key.

**AND THE INSTRUMENT'S OWN CAVEAT REPRODUCED.** At this game count the state comparator fails its own
planted-divergence proof — one plant, `party.` (a benched member's HP off by one), caught at boundary
11 instead of 10 and reported as `field.trickroom_turns` — **in BOTH arms, including the untouched
bytes**. Every state figure above is therefore quoted only as a paired delta of zero, never as a
level.

## ROADMAP #109 — THE PHOTOGRAPH FROZE THE SUBJECT AND NOT THE CAMERA. 56 OF 65 RELEASES COULD NOT BE OPENED, AND ALL 14 LADDER RUNGS ARE AMONG THEM. 2026-08-09.

Census **unchanged at 325/325 live**, and it must be: nothing here touches a mechanic. What moved is
`engine/engine_release.js`, `tests/test-engine-release.js`, and **one call site** in
`engine/game_differential.js`.

### THE ONE SENTENCE

A release freezes the ENGINE and not the DRIVER that reads it, so when the live driver started
calling `M.natureL50` on 2026-08-08, every release cut before that export existed became unopenable —
and it announced itself as `TypeError: M.natureL50 is not a function` at `game_differential.js:1280`,
which names neither the release, nor the symbol, nor the fact that the snapshot is **intact and merely
old**.

### THE MEASUREMENT, TAKEN AGAIN RATHER THAN INHERITED

65 release directories on disk, probed by loading each snapshot's `medicham2-browser.js` and comparing
its exports against the 13 symbols the live driver reads:

```
   4  PRUNED          open() already refuses these by name — a recorded decision, not a defect
   1  file-absent     d3d04b669e18, the oldest with bodies, froze TWELVE files and has no
                      engine/mc_key.js at all -> `Cannot find module ...\d3d04b669e18\engine\mc_key.js`
  56  symbol-absent   no natureL50 (8 of them also lack traceCanon / TRACE_EVENTS)
   5  usable
```

**The reported figure was right and understated in two directions.** It said 62 on disk and 56 without
`natureL50`; three more releases have been cut since, and it did not carry the layer underneath —
`engine/mc_key.js` joined `SOURCES` on 2026-08-05, so the oldest release fails **before** the symbol
check is reached, out of `engine_release.js` itself.

### WHY `SOURCES` DID NOT GROW A THIRD TIME

`SOURCES` has grown twice, both times because a release turned out not to be **enough**: +6 loader deps
so `REL.require` resolves, +5 lazily-read data files so a snapshot can play a game. This is the third
instance of the class and **not** the third instance of the shape.

The decisive evidence is in the file that breaks. `game_differential.js` already refuses to freeze
`steering.js` and `board_state.js`, in its own words, because they are the **instrument** and freezing
them "would mean each rung was scored by its own contemporaneous reader, which is the one thing a
ladder must not do." Adding the driver to `SOURCES` would therefore:

- recover **none** of the 56 (their bytes are unchanged either way);
- change every FUTURE release id over a file that cannot change a number the ENGINE produces;
- and break the release ladder, which is the main reason anybody re-opens an old release at all.

Confirmed while deciding: adding to `SOURCES` genuinely does leave existing releases untouched — the
id is the digest of the digests, `verify()` iterates each release's OWN `files` map rather than
`SOURCES`, and the same-id-must-mean-same-digests refusal is unreachable for an id that has changed.

### WHAT WAS ACTUALLY MISSING: A CONTRACT ACROSS THAT BOUNDARY

A release knows exactly which files it froze and exactly what those bytes export. A caller knows
exactly what it needs. **Nothing ever asked.** So:

- `REL.require` / `REL.path` / `REL.read` refuse a file the release predates, naming the release, the
  count of files it froze, its first cut, and that this is *not* corruption and *cannot* be repaired;
- `REL.require(file, { need: [...] })` refuses a missing EXPORT the same way, and prints the command
  that lists the releases which have it;
- `{ want: [...] }` is the optional half, and it is **loud**, because a `? :` over an export that is
  never there is indistinguishable from a working feature.

**A Proxy was considered and rejected.** Wrapping the module so any absent key throws needs no caller
change and would also turn every legitimate feature-detect in the repo into a crash, silently. The
caller declares; the release checks.

### IT RECOVERS NOTHING, AND THE PREVIOUS TWO FIXES DID NOT EITHER

**The 56 do not become runnable.** Those bytes never held the function and no error message can put it
there. What changed is that they fail in one sentence at second zero rather than deep inside an
unrelated file, and that `compat` answers "which releases can this run use" *before* the run:

```
$ node engine/engine_release.js compat engine/medicham2-browser.js natureL50
  ...
  5 of 65 releases can serve it.  4 pruned,  0 predate the file,  56 predate an export,  0 broken.
```

Worth saying because it is the reason this is the third time: **the +6 and +5 growths did not repair a
single release cut before them either, and neither of them said so.**

### THE RED DEMONSTRATION, ON THE OLDEST RELEASE

`tests/test-engine-release.js` proved a release serves its own bytes while a live file changes
underneath it — and every one of its sections cut a release and read it back seconds later, so it had
never opened an **old** one. Section 8 does, against the real store, read-only, because a synthetic
release cannot be old and the age is the subject.

Against a reconstruction of the pre-fix loader: **8 failures and a hard crash** on `REL.compat is not
a function`. After: **59 passed, 0 failed.**

```
  ok   requiring engine/mc_key.js out of a release that predates it fails
  ok   and the refusal names the RELEASE and the FILE
  ok   not a bare MODULE_NOT_FOUND out of the resolver — that is what it used to be
  ok   requiring a symbol the oldest snapshot predates FAILS at the require
  ok   and the refusal NAMES the missing symbol
  ok   and is not a TypeError raised 1,280 lines into an unrelated file
  ok   the CURRENT release satisfies the same need list — the guard refuses by age, not always
  ok   compat() separates them rather than answering the same for all: 5 provide, 56 predate it
```

**It asserts the CONTRACT, not compatibility.** A test demanding the 56 open would be red forever, and
this project has already established that a permanently red test is the same thing as no test.

**And the control is explicit** (LESSONS §5): a guard that refused *every* release would satisfy every
assertion about the oldest one. The current release must load the same module under the same `need`
list without throwing, and does.

### FOUND WHILE HERE — NOT MINE, NOT FIXED

- **`M.MEDI_SPREAD` has never existed, on any build, including the live one.** `medicham2-browser.js`
  assigns it to `root` (line 9972) and not to `module.exports`, so `mediSpan`'s
  `M.MEDI_SPREAD ? M.MEDI_SPREAD.has(...) : false` has taken the false branch on every run this driver
  has ever done: **every spread move's staged damage span was priced as a single-target hit.** The fix
  is one name in medicham2's export list, which WIRE 2 held this session. Declared `want` so the loader
  shouts about it every run until somebody lands it.
- **`engine/wire_ladder.js` cannot run at all — all 14 rungs lack `natureL50`.** The published ladder
  on disk stands (it was measured under the driver of its day) but it is no longer *replayable*, and
  replayability is the ladder's entire premise. Recovering it needs a decision nobody has taken:
  whether a `--nature serious` arm may derive its flat level-50 line from anything other than the
  frozen engine's own `natureL50`, which would be a second copy of a FACT.
- **ROADMAP #57's re-run list is unaffected** — it classifies stamps and re-runs against the LIVE
  engine, so it never re-opens an old release. **ROADMAP #99's lift condition is affected**, because it
  runs through the differential, and the differential now has 5 usable releases out of 65.

### THE HAND LIST IS UNCHANGED

Nothing leaves it. This was not a mechanic and it landed no probe on one; the census is untouched at
325/325 and `Rivalry` is still the only entry, still blocked on `data/engine-data.js` carrying no
gender.

## ROADMAP #112 — THE PINCH FAMILY. THE CONSUMER WAS ARMED FOR THE FIVE ABILITIES NOBODY RUNS AND FAILED CLOSED ON THE FOUR EVERYBODY DOES. 2026-08-09.

Census **324 → 325 live / 325 probed, 0 missing**. New gate: **`tests/test-pinch-family.js`**.
Release **`2929deeb41f3`** (before-arm: `6f7fbc538318`).

### THE ONE SENTENCE

Blaze (6,386 uses on today's corpus), Torrent (2,017), Overgrow (689) and Swarm (49) — **9,141 uses**
— had never fired, and **the consumer's refusal of them was correct at every moment.** `data/tags.json`
carried their condition as the SENTENCE `"only below 1/3 HP"`, and `medicham2-browser.js` gated on
`!_db.onlyWhen`, which is exactly what ROADMAP #92 says to do with a condition you cannot evaluate.
Nobody ever made `onlyWhen` READABLE, so the refusal was permanent — and the shape it did admit is
`dragonsmaw, firemane, rockypayload, steelworker, transistor`, **all five of them 0 corpus uses**.

`engine/tag_dex.js` now derives the gate as a STRUCTURE out of Showdown's own handler, and
`condHolds` evaluates it. **The fail-closed rule is untouched**: an `onlyWhen` shape this engine
cannot read still returns `null`, still refuses, and is now COUNTED
(`MEDFAILS.damageBoostUnknownCond`).

```
  attacker.hp <= attacker.maxhp / 3            <- Showdown, data/abilities.ts
  {cond:'hpFraction', of:'self', cmp:'<=', num:1, den:3, says:'only below 1/3 HP'}
```

### WHAT MOVED

| | before (`6f7fbc538318`) | after (`2929deeb41f3`) |
|---|---|---|
| census | 324 live / 324 probed | **325 live / 325 probed**, 0 missing |
| roster `--stage abilities` | 0 DIFFER · **1 DID-NOT-FIRE** · 78 MATCH · 20 CONTROL-NOT-QUIET | 0 DIFFER · **0 DID-NOT-FIRE** · **82 MATCH** · 17 CONTROL-NOT-QUIET |
| roster `--stage items` | 0 DIFFER · 6 DID-NOT-FIRE · 134 MATCH | unchanged |
| roster `--stage moves` | 50 DIFFER · 27 DID-NOT-FIRE · 332 MATCH | unchanged |
| `tests/test-engine-diff.js` | 1 of 150 disagree | unchanged |
| `tests/test-damage-stages.js` | 1728/1728 exact, shape matches **5** | 1728/1728 exact, shape matches **9** |

**Exactly four entities changed verdict in the abilities stage and nothing else did**, verdict-diffed
per entity rather than read off the summary:

```
  Overgrow   DID-NOT-FIRE       -> FIRED-AND-BOARDS-MATCH
  Blaze      CONTROL-NOT-QUIET  -> FIRED-AND-BOARDS-MATCH
  Swarm      CONTROL-NOT-QUIET  -> FIRED-AND-BOARDS-MATCH
  Torrent    CONTROL-NOT-QUIET  -> FIRED-AND-BOARDS-MATCH
```

Blaze, Swarm and Torrent were **better than expected**: they were predicted to stay in
CONTROL-NOT-QUIET, because no carrier of theirs in this format has a quiet second ability to control
against. They did not need the control — CONTROL-NOT-QUIET is a *downgraded accusation*, and with the
boards now matching there is no accusation to downgrade.

### THE BOUNDARY IS THE MECHANIC, AND THE FRACTION IS NEVER COLLAPSED TO A FLOAT

`hp <= maxhp * (1/3)` is **not** the same predicate as `hp <= maxhp / 3`. The nearest double to 1/3
is below it, so `150 * (1/3) = 49.999999999999993` and a body at exactly 50 of 150 — one third — would
be refused a boost it is owed. The structure therefore keeps `num` and `den` and the engine asks
`hp*den <= maxhp*num` in integers, which is exact for every maxhp in the game. An off-by-one here
reads as correct at every HP except the one that decides games.

`tests/test-pinch-family.js` stages **both parities of maxhp** — Farigiraf 195 (divisible by three,
so "exactly one third" is the integer 65 and must PASS) and Venusaur 155 (not, so the largest passing
HP is the floor, 51) — and both sides of the line, in both engines, for all four members, on a
special and a physical delivery move. 61 rows.

### THE RED DEMONSTRATION, ON THE SAME COMMAND, IN BOTH HALVES

The defect had two halves and either one alone kept the family dark, so
`tests/probe_red_demo.js` reverts each separately:

```
  OK  ROADMAP #112  Blaze — the artifact half: onlyWhen back to the PROSE it used to carry
                    green-arm=true  stripped-arm=false
  OK  ROADMAP #112  Blaze — the engine half: the consumer refuses any condition at all
                    shipped-arm=true  reverted-arm=false
  OK  ROADMAP #112  Transistor (0 uses) is the POSITIVE CONTROL and fires on BOTH builds
                    shipped=true  reverted=true
```

**The third row is the one that makes the first two mean anything.** The five 0-use members are what
the consumer served before this change; a reversal that turned them off too would be measuring the
whole consumer rather than the condition. `tests/test-pinch-family.js` §4 asserts all five against
Showdown as well.

And `tests/test-pinch-family.js` itself was RED before the fix: **31 of 61 failed**, with §4's five
positive controls green throughout.

### THE PROBE WAS WRONG BEFORE THE ENGINE WAS (docs/LESSONS §5, again)

The first draft read the threshold out of `p.onlyWhen.den` — **the very field the fix creates**. On
the unfixed tree that is `undefined`, so it staged a body at `floor(maxhp/undefined)` = NaN HP.
`tests/probe_pair.js` refused it by name, which is the whole reason that refusal exists, but the row
would have proved nothing either way. The threshold and the type now come out of **Showdown's
handler**, and the family under test is the **authority's** set compared against the artifact's, not
taken from it.

### THE tags.json REGENERATION — MEASURED, NOT ASSUMED (ROADMAP #65's hazard is CLOSED)

Two diffs were taken, not one, so the hazard is separated from the change:

1. **A regeneration with NO code change**: 0 vanished, 0 lost a tag, 0 lost usage, 0 param diffs.
   500 moves / 148 items / 265 abilities before and after. `sheet_entries` 127,464 → 135,804 (the
   corpus grew; every `uses` rose or held). Serene Grace and Tinted Lens both survive. **#65 is closed
   and this is the measurement that says so rather than its status field.**
2. **The change, against that fresh baseline**: **5 param diffs and nothing else** — `blaze`,
   `torrent`, `overgrow`, `swarm`, `defeatist`, each one `onlyWhen` prose → structure. Zero entity
   losses.

`damageReduce` (Multiscale, Shadow Shield) is byte-identical, which is the point of the one extra
guard in its derivation: `hpGateIn` now returns an object for BOTH `>= maxhp` and `<= maxhp/N`, and
that family asks for the DIRECTION rather than the truthiness, because calling a `<=` gate `'fullHP'`
would be exactly backwards. No member has a `<=` gate today; the guard is so it stays that way.

### WHAT THE CONSUMER SERVES NOW, PRINTED BEFORE IT WAS BELIEVED

```
  SERVED   firemane(0) dragonsmaw(0) rockypayload(0) steelworker(0) transistor(0)
           blaze(6386) overgrow(689) swarm(49) torrent(2017)
  REFUSED, no type          analytic(19) reckless(97) rivalry(40) stakeout(0) technician(710)
                            guts(26) hugepower(135) purepower(26) defeatist(0) + 5 more
  REFUSED, weather          solarpower(838)
  REFUSED, unreadable cond  (none)
  REFUSED, more than one tag  18 abilities
```

**`MEDFAILS.damageBoostUnknownCond` reads 0 and that is the correct value**, which is worth saying
because a zero counter is normally this project's signature symptom. Every `onlyWhen` in the artifact
is now readable. The four still-dark abilities are refused one clause EARLIER, by `_db.onType` —
their conditions are **absent** from the artifact rather than unreadable in it.

**`defeatist` is the one member that gained a readable condition and is still refused**, deliberately:
its multiplier is 0.5 and it names no type, so it is a NERF and the `onType === mvT` clause keeps it
out. 0 corpus uses. Widening the consumer to a typeless multiplier is a second change and is not in
this one.

### FOUND WHILE HERE — NOT MINE, NOT FIXED, AND THE FIRST ONE IS THE EXPENSIVE ONE

- ~~**`data/engine-data.js` gives First Impression base power 90. The dex says 100.**~~ **FIXED 3.88.0,
  and it was one of TWELVE.** Found here because the probe's CONTROL arm disagreed with no ability on
  the body at all; found independently by a damage sweep and by the roster's own moves stage, which
  had `tropkick` (203 uses) in its queue for the same reason. `build/build_engine_data.js` now reads
  base power from `Dex.forFormat` instead of keeping the stored generic gen-9 value, and
  `engine/artifact_audit.js` check D fails if any written row disagrees with the format.
  `tests/test-pinch-family.js` printing it as NOT COMPARABLE by name — rather than blaming Swarm for
  it — is what made it findable.
- **`tests/probe_red_demo.js` had been exiting on its SECOND demonstration.** `revertedEngine` throws
  when its patch no longer matches, and the throw escaped and killed the process — so **186 of its 188
  demonstrations had not run at all**, silently, for as long as the stale patch has been there. A
  stale reversal is now a counted, named RED ROW and the run continues. It reports **3 failures, none
  of them this wire's**: two STALE reversals (both ROADMAP #81 WIRE 11 — a later wire rewrote the
  lines they patch) and one genuine red, `ARM sealsMoves`, whose stripped arm still holds, meaning
  that probe does not watch its knob. **These are red, they are named here, and they are the next
  thing this file should pick up** — they are not filed and they are not "known".
- **The state differential's own planted-divergence proof FAILS at `--games 2008` on the current
  store**, in BOTH arms, including the before-arm running bytes this wire never touched: one plant of
  26 (a benched party member's HP off by one) is caught one boundary late and localised to
  `field.trickroom_turns`. The instrument then declares its own state numbers worthless, so **the
  turn-1 / whole-game / boundary percentages are not quoted for this wire.** It is sample-dependent —
  the same proof passes 26/26 at `--games 45` on the same store and release — and it reproduces with
  the 324-row census as well as the 325-row one, so it is not caused by the new probe's steering.

### THE PAIRED DIFFERENTIAL — A HONEST NULL, AND THE ARMS ARE PROVABLY DIFFERENT BUILDS

Same pinned team store, same census pin `909dd84f06ac`, same 2008 requested / 1546 played, same four
pins, differing in `--release` and nothing else. `engine/game_differential.js` says **COMPARABLE**.

| | before `6f7fbc538318` | after `2929deeb41f3` |
|---|---|---|
| turn-1 board identical | 1511/1546 = 97.7% | **1511/1546 = 97.7%** |
| games whose board NEVER diverged | 1241/1546 = 80.3% | **1241/1546 = 80.3%** |
| turn boundaries identical | 18153/18458 = 98.3% | **18153/18458 = 98.3%** |
| median turn of first board divergence | 8 | 8 |
| protocol: games agreed | 873/1546 = 56.5% | 873/1546 = 56.5% |
| medicham2 digest | `5ff49e876bcb` | `663f8a7a5129` |
| tags.json digest | `f494532ceec8` | `16bbdcb5a54d` |

**Every state figure is byte-identical and the two builds are demonstrably different.** That is a
NULL, not a dead knob, and the distinction is not an argument — it is three independent measurements
on the SAME frozen bytes `2929deeb41f3` that the after-arm played: the roster's four verdict changes,
`tests/test-pinch-family.js` at 61/61 against Showdown, and the census probe. The wire is live in the
exact build measured; the pinch family simply does not reach this instrument's sample, which is not
surprising — the primary arm pins MAX damage and every game stops at its first board divergence, at
a median of turn 8, so a body has to fall under a third of its maximum HP *and* click a
matching-type move *and* carry one of the four, all before the boards part. **Landing a mechanic is
the result; this instrument did not move and saying so is the report.**

**These three percentages carry the instrument's own disclaimer** (see FOUND WHILE HERE): its planted
STATE proof fails at `--games 2008` on this store, in BOTH arms including the before-arm on untouched
bytes. They are printed as a paired DELTA of zero rather than as a level.

### AND ONE LINE MORE, LANDED AFTER THE MEASUREMENT ON PURPOSE — `MEDI_SPREAD` WAS EXPORTED TO NOBODY

Will, 2026-08-09: *"lets fix it and reset the baseline."*

`medicham2-browser.js:9972` publishes `root.MEDI_SPREAD=SPREAD` and **only** there, so
`require(...).MEDI_SPREAD` has always been `undefined` — `'MEDI_SPREAD' in M` is false across all 65
exports, verified against the LIVE tree, not a release artifact. `game_differential.js:2735` reads
`M.MEDI_SPREAD ? M.MEDI_SPREAD.has(id) : false`, so **that ternary has taken the FALSE branch on
every run this repository has ever done**: every spread move's staged span was priced as a
single-target hit, no doubles 0.75, against a Showdown side that comes from a real battle and applies
it. ~1.33x high on Heat Wave, Rock Slide, Earthquake, Icy Wind, Dazzling Gleam, Snarl, Discharge and
Make It Rain. The `Set` holds 38 moves and all eight are in it.

**The ordering was chosen, not stumbled into.** The export changes nothing the engine DOES — it
changes what the instrument reports through `mediSpan` — so it was added only once both arms of the
pinch measurement were in hand, and it is measured as its own third arm (`759a0d3292f5`) against the
pinch after-arm. A pinch-family delta and a spread-pricing delta arriving in one before/after is
exactly the attribution loss ROADMAP #81 exists to prevent. `SPREAD`'s contents are untouched, the
`root` assignment stays (board.js reaches this engine through the global object in a browser), and
`game_differential.js` was not edited — its `want: ['MEDI_SPREAD']` declaration at :150 is what
surfaced this and is what catches the next one.

Re-checked after the export, all on the live tree: census **325 live / 0 missing**,
`tests/test-engine-diff.js` **1 of 150**, `tests/test-pinch-family.js` **61/61**.

**AND ITS MEASURED EFFECT ON THE PUBLISHED FIGURES IS ZERO — SO THE BASELINE DOES NOT NEED RESETTING.**
A third arm, `759a0d3292f5`, on the same pins and `--baseline` the pinch after-arm, says COMPARABLE
and moves **not one number**: every `state.*` field identical, `diverged` 673 → 673, and — the ones
that actually read `mediSpan` — `damage_interior` and `knock_off_roadmap_80` byte-identical.

The reason is worth writing down rather than leaving as luck: **both damage-span probes stage
SINGLE-TARGET moves.** `knock-off order` and `contact punish — Rough Skin` are the only two, so the
branch that was permanently false is a branch neither of them ever needed. The defect was real, it
was total, and its exposure in the figures this repository publishes is nil. The `!! release … does
not export MEDI_SPREAD` warning that `game_differential.js` prints on every run is gone from
`759a0d3292f5` and present on `2929deeb41f3`, which is the before/after receipt.

**What that costs is a warning, not a retraction** — and it is an argument for the next span probe to
stage a spread move, because until one does, the fixed branch is still untested by anything except
the export check itself.

### THE SIBLING, #101 — DOES THIS GENERALISE?

**The mechanism yes, the field no, and the risk points the other way.** `buffsHolderOnHit` carries
`{compounds, boosts, gainsVolatile}` and **no condition field at all**, so #101 needs the same
tag_dex work rather than inheriting it. Its conditions are readable by shape, in five kinds, all
printed off the live dex:

| kind | members | handler shape |
|---|---|---|
| move TYPE | justified(51), rattled(0), steamengine(0), thermalexchange(0), watercompaction(0) | `move.type === "Dark"` / `[...].includes(move.type)` |
| move CATEGORY | weakarmor(37) | `move.category === "Physical"` |
| the hit CRIT | angerpoint(13) | `target.getMoveHitData(move).crit` |
| a move FLAG | windpower(0), perishbody(0) | `move.flags["wind"]`, `checkMoveMakesContact` |
| unconditional | stamina(2760), electromorphosis(98) | no test |

The cost is one real refactor: `condHolds(w, self)` is about the HOLDER, and every #101 condition is
about the incoming MOVE and the HIT. The signature has to widen to a context (`{self, move, crit}`),
which is small but belongs to #101 rather than being pre-built here on speculation.

**And the direction of the error is opposite, which makes #101 the more urgent of the two.** #112's
gate defaulted CLOSED — nothing fired, and the engine was merely missing a mechanic. #101's defaults
OPEN: Anger Point maxes Attack off ANY hit, Justified fires on non-Dark moves, Weak Armor on special
ones. That is a WRONG ANSWER on the board rather than an absent one, and every condition landed is an
improvement on its own. The `_buff.boosts` guard that drops the `gainsVolatile` members
(Electromorphosis, 98 uses) is a **separate** membership defect and wiring conditions would not touch
it.

**LANDED 2026-08-09 — see the ROADMAP #101 + #102 section at the top of this file.** Every prediction
in the three paragraphs above held: the signature widened to `condHolds(w, self, hit)`, the four shapes
were all readable from the artifact as derived, `stamina` was the positive control and did not move,
and the `gainsVolatile` membership defect was indeed separate — it is now COUNTED rather than dropped,
and still not granted, for the reasons given there.

## ROADMAP #111 — THE VOLATILE DURATION FAMILY. FOUR QUEUE ROWS, ONE MECHANISM, AND THE BUG WAS ALREADY WRITTEN DOWN IN THIS FILE. 2026-08-08.

Census **324 live / 324 probed, 0 missing → unchanged**. New gate: **`tests/test-volatile-duration.js`**.
Release **`6f7fbc538318`**.

### THE ONE SENTENCE

`Battle#residualEvent` (sim/battle.js:341-348) decrements every handler carrying both an `end` and a
`duration` **inside the Residual event**, so a volatile applied on turn N has already spent one of its
turns by the end of turn N. This engine documented that defect at line 6588 — for **Perish Song** —
fixed exactly one volatile with it, and left the general defect standing. Taunt, Encore and Disable
then each re-created it in their own way, and the moves stage came back with all three as separate
FIRED-AND-BOARDS-DIFFER rows.

### WHAT MOVED

| | before | after |
|---|---|---|
| roster `--stage moves` | 52 DIFFER · 27 DID-NOT-FIRE · 330 MATCH | **50 DIFFER · 27 DID-NOT-FIRE · 332 MATCH** |
| differential `--nature real`, turn-1 board | 1946/2008 = 96.9% | 1946/2008 = 96.9% (unmoved) |
| differential `--nature real`, whole game never parted | 1544/2008 = **76.9%** | 1585/2008 = **78.9%** |
| differential `--nature real`, turn boundaries identical | 23083/23547 = 98.0% | 23366/23789 = **98.2%** |
| differential `--nature real`, median first divergence | 8 | 8 (unmoved) |
| differential `--nature serious`, whole game never parted | 1554/2008 = 77.4% | 1561/2008 = **77.7%** |
| census | 324 live / 0 missing | 324 live / 0 missing |
| `tests/test-engine-diff.js` | 1 of 150 disagree | 1 of 150 disagree |

**The two differential arms are a PAIRED measurement and nothing else moved between them:** same
pinned team store, same census digest `f5400247040d`, same 2008 games, same pin — the two runs differ
in `--release` and in nothing else, and `engine/arms_comparable.js` says COMPARABLE. That mattered:
the first attempt read the LIVE store, OPS appended to it mid-measurement (7,777 → 7,817 teams) and
the two arms were sampling different populations.

### THE THREE RULES, ALL OF THEM SHOWDOWN'S

1. **The residual spends the application turn.** One tick site now, at end of turn, over
   `durationVolatiles()`. It replaced THREE separate lines that each ticked one member — Disable's
   own, Taunt's through the forbid table, and Encore's two thousand lines away inside `_chooseAction`.
   Encore's was the WIRE 24 defect: a clock that only moves when the ENGINE is choosing never moves at
   all in a rollout driven from outside, so `vol.encore` read the same number at every boundary of
   every scripted game this repository has ever played.
2. **Re-application FAILS.** `Pokemon#addVolatile` returns false when the volatile is present and its
   condition declares no `onRestart`. A Taunt clicked on two consecutive turns was REFRESHING the
   counter, which is why it read 2 at both boundaries where Showdown reads 2 then 1.
3. **The counter is adjusted by whether the target has already spent its turn.** `+1 when it has` is
   the general rule and it is the same statement the residual makes. Disable is the single declared
   exception (`VOL_DUR_OFFSET = {disable: -1}`), because its declared 5 is one more than the four
   turns it seals — Showdown writes that as `if (this.queue.willMove(pokemon) || ...) duration--`.

**And the membership is the artifact's, printed before it was believed** (docs/LESSONS §4):
`durationVolatiles` = `taunt 3, encore 3, disable 5`; **excluded** are Torment and Imprison (`turns:
null` — no duration in gen 9, and giving them a counter would EXPIRE them, which is worse than the
gap), Gravity and Throat Chop (no `statusInflict` volatile). The no-restart rule is scoped to that set
on purpose: **a blanket one would have caught Protect, Follow Me, Rage Powder and Helping Hand**,
which are per-turn volatiles that must be re-settable.

**Which members need the target's LAST MOVE is derived, not listed.** A `sealsMoves` volatile that
also declares a category (`forbidsStatusMoves`) seals a category; one that does not must be naming a
move, and Showdown refuses both of those against a target that has never moved. So the set is
`durationVolatiles − forbidByVolatile` = `{encore, disable}` — which is what WIRE 69 hand-wrote as
`_e.volatile === 'encore'` and **what Disable never had at all**. That single missing guard is the
whole of the `vol.disable showdown=0 ours=4` row: the engine applied a Disable on the turn before its
target had ever moved.

### THE RED DEMONSTRATION, ON THE SAME FILE AND THE SAME COMMAND

`tests/test-volatile-duration.js` plays the LIVE tree by default and `--engine release` plays a
snapshot's own bytes, so the before-arm is reachable without swapping a file:

```
node tests/test-volatile-duration.js --engine release --release 72e361e1bd44   ->  3/4 DIFFER
  taunt    t2 vol.taunt    showdown=1  ours=2      t3  showdown=0  ours=1
  disable  t1 vol.disable  showdown=0  ours=4      t2  showdown=3  ours=4   t3  showdown=2  ours=3
  encore   t2 vol.encore   showdown=2  ours=3      t3  showdown=1  ours=3
node tests/test-volatile-duration.js                                          ->  4/4 IDENTICAL
```

**Perish Song is the positive control and it is the fourth scenario.** It is the one member of the
family that was already right, so a change to the shared model that breaks it has broken the model.
It read IDENTICAL on the unfixed release and reads IDENTICAL now. No number in that file is an
expectation: every scenario is played in both engines through `tests/staged_board.js`, whose rule is
that Showdown is the expectation.

### THE INSTRUMENT WAS WRONG BEFORE THE ENGINE WAS — THREE TIMES

1. **The target's click did nothing.** The first draft gave Snorlax `Tackle`, which is not one of the
   500 legal moves and has no row in `MC.moves`, so medicham2 dealt 0 with it and the probe reported a
   42 HP divergence that had nothing to do with a duration. It also meant `_lastMove` was never set,
   so Encore read `ours=0` — the engine refusing correctly, printed as a defect.
2. **Two consecutive Protects.** Showdown failed the second one and medicham2 did not, on the body
   being attacked. That is a REAL divergence and it is not this row; it is filed, and the scenarios
   now never click Protect twice running on a body anyone is hitting.
3. **Disable made the target's own scripted click illegal**, which throws rather than diverging. The
   target alternates two clicks, which is the same correction `tests/roster.js` records for its own
   `move/volatile` rule.

### AND A FOURTH, WHICH WAS THE ENGINE BREAKING AN INSTRUMENT

`tests/roster.js` demonstrates its `move/volatile` rule RED by nulling **one literal line** of engine
source: `const _sm=TAGS.param('move',a.mv,'sealsMoves');`. The first version of this fix rewrote that
line, so the patch would have matched nothing and **the red demonstration would have quietly stopped
demonstrating**. `volDurationOnApply` therefore takes the tag params as an ARGUMENT rather than
looking them up: the table decides the SET, the call site supplies the NUMBER, and severing either one
is visible. `tests/roster.js` is not this division's to edit and was not edited.

### ENCORE FELL OUT HALFWAY, AND THE OTHER HALF IS A DIFFERENT MECHANIC

Encore's counter row is gone — `vol.encore` no longer appears in its diffs. It is still
FIRED-AND-BOARDS-DIFFER on **HP only**, and that is a separate defect: Showdown's
`encore.condition.onOverrideAction` replaces the target's chosen move, and medicham2 honours the lock
only inside `_chooseAction`, so a SCRIPTED or caller-supplied action walks straight past it. Filed as
its own row, not swept in here.

### FILED, NOT MINE

- **`infestation` / `partiallytrapped` still parts** (`vol.trapped_by_move` showdown=4/3, ours=3/2).
  It runs one LOWER than Showdown — the opposite direction from Taunt — and it has no plain duration
  at all (`durationCallback`, `this.random(5,7)`, Grip Claw changes it). Deliberately not swept into
  this model.
- **`tests/test-no-silent-failure.js` is RED**, with 22 NEW silent catch blocks. **None is mine** —
  one was (`tests/test-volatile-duration.js:172`) and it was fixed in this pass by making it speak on
  stderr. The remaining 22 are in `engine/quarantine.js` (11), `tests/test-web-quarantine.js` (3),
  `engine/diff_swarm.js` (2), `engine/leaf_engine_contrast.js` (2), `tests/roster.js` (3) and
  `engine/explain_divergence.js` (1) — every one of those files is outside this division's hands.
  Saying so rather than filing it.
- **`data/interaction-matrix.json` was not republished.** A `--full` run over the current tree stages
  1,582 live cases against the published artifact's 1,643 and the instrument correctly refuses to let
  a shallower run replace a deeper one. It agrees on 1,567/1,582 (99.1%) and **no taunt, encore or
  disable pair is among the disagreements**, which is the check this change needed.
- **`tests/test-tag-wire.js` asserted the bug.** Its Encore check read `_lockT === 3`, which is what
  survived one tick of the `turns + 1` lock the old code wrote to compensate for the double decrement.
  It now asserts `turns − 1` out of the artifact AND that the lock agrees with the volatile, because
  two clocks for one effect is exactly how the lock came to outlive the Encore that made it.

## THE INERT 124 — FIFTEEN ABILITY SHAPE RULES, AND `--write` STOPS DESTROYING THE STAGE BESIDE IT. 2026-08-08. (ROADMAP #98 + #107)

**"INERT" WAS NOT "NOTHING TO TEST". IT WAS "THE CONDITION WAS NEVER CREATED."** The abilities stage
had six rules and three of them were refusals, so **124 of the 316 legal abilities — 72,609 corpus
uses — fell through to `ability/generic`**, which stages a plain attack. Showdown's own board came
out identical with and without every one of them and the roster honestly reported
COULD-NOT-STAGE / *THE STAGING IS INERT*. Blaze needs the user under a third of its HP; Defiant needs
a stat drop; Chlorophyll needs sun; Prankster needs a status click on a turn where the order decides
something; Lightning Rod needs an Electric move aimed at its **ally**. A plain attack creates none of
those.

### THE RESULT

| | INERT abilities | the usage they cover |
|---|---|---|
| before | **124** | **72,609** |
| after | **59** | **4,261** |

`0 DIFFER · 1 DID-NOT-FIRE · 78 MATCH · 20 CONTROL-NOT-QUIET · 217 COULD-NOT-STAGE` (was
`0 · 0 · 29 · 8 · 279`). **Zero regressions** — no ability that scored FIRED-AND-BOARDS-MATCH before
this pass scores anything else after it, checked entity by entity against the pre-change artifact.
**22 of 22 staging rules CAUGHT AND LOCALISED their own break**, including the two that did not on
the first attempt and were re-anchored rather than declared.

### THE ONE FINDING, AND IT IS ALREADY DOCUMENTED AS DELIBERATE

**Overgrow — DID-NOT-FIRE, 648 uses.** Showdown's board moves when the ability is added and ours does
not move at all, over a staging that chips the carrier to 11% and then throws Energy Ball. This is
ROADMAP #92's narrowed `damageBoost` family behaving exactly as that section says it does: the
consumer at `medicham2-browser.js` requires no `onlyWhen`, and Blaze / Torrent / Overgrow / Swarm all
carry `onlyWhen: "only below 1/3 HP"` as **prose**. The roster is now the instrument that says so from
the outside. Its three siblings read CONTROL-NOT-QUIET rather than DID-NOT-FIRE because **no carrier
of any of them in this format has a quiet second ability** — Charizard, Skeledirge, Primarina and
Volcarona all pair the pinch ability with something live.

### WHAT EACH RULE READS, AND WHERE ITS NEGATIVE IS

Fifteen new rules, every one reading the ability's **own upstream data** — the handler NAMES, and the
shapes inside the handler source (`move.type === "Electric"`, `pokemon.effectiveWeather()`,
`move.flags["sound"]`, `attacker.hp <= attacker.maxhp / 3`). Not `data/tags.json`, which is ours and
derived. Membership is printed by `--rules` before any count is believed.

| rule | reads | the condition it creates | the on-board negative |
|---|---|---|---|
| `pinch-offense` | HP gate + type in `onModifyAtk`/`onModifySpA` | a derived hit lands the carrier between 2/3 and 95% of its HP | the SAME typed click at full HP on turn 1 |
| `stat-drop-reaction` | `onTryBoost`/`onAfterEachBoost`/`onChangeBoost` | Intimidate at boundary 0 + a greedy 4-click cover over atk/spa/spd/spe/def | the aggressors' own stages |
| `redirects-a-type` | `onAnyRedirectTarget` + the type in `onTryHit` | the drawn move aimed at the carrier's ALLY | an undrawn neutral click at the same ally |
| `absorbs-a-type` | a TYPE or FLAG in `onTryHit`/`onAllyTryHitSide` | the carrier chipped, then hit by that type/flag | a neutral click on turn 3 |
| `type-conversion` | the type `onModifyType` reads and the type it ASSIGNS | a defender the chart treats differently under the two types | an unconverted click |
| `no-recoil` | `recoil` inside `onDamage` | the carrier throws a real recoil move (the delivery table refuses every one) | a non-recoil click of the same category |
| `survives-from-full` | `maxhp` + a floor of 1 in `onDamage` | `lethalMove` at a 1.5x margin, twice | the second, on a body no longer at full |
| `unconditional-stat-multiplier` | `onModifyAtk`/`SpA`/`Def`/`SpD`, no type, no HP gate | a click of the CATEGORY the handler name implies | a click of the other category |
| `base-power-scoped` | a flag, a base-power threshold or `move.recoil` in `onBasePower` | the strongest in-scope click | an out-of-scope click, same category, also neutral |
| `damage-taken-scoped` | a type, or `typeMod > 0`, in `onSourceModify*` | a scoped hit on the carrier | an unscoped neutral hit |
| `speed-on-item-loss` | `addVolatile` inside `onAfterUseItem`/`onTakeItem` | a threshold berry eaten, then a speed-flip pair | boundary 1, where the item is still held |
| `weather-speed` | a weather id in `onModifySpe` | the partner SETS the sky; a foe whose speed sits strictly between | — the foe's click is a drop that only lands if it moved first |
| `weather-evasion` | a weather id in `onModifyAccuracy` | the same sky; a 100-acc click becomes 80 and the pin MISSES it | the same click at the partner, which must land |
| `weather-residual` | a weather id in `onWeather` | the same sky + a derived chip so a heal has somewhere to land | the partner, standing under the same sky |
| `priority-mod` | `category === "Status"` or a type in `onModifyPriority` | a slower carrier that dies before it can act | — with the shift its drop lands, without it nothing does |
| `blocks-priority` | `onFoeTryMove` | the format's strongest 100-acc positive-priority move, at the carrier AND at its ally | an ordinary 0-priority click that must land |
| `aids-its-ally` | the three `onAlly*` hooks + `onAnyModifyDamage` | everything aimed at the ALLY: a hit, a drop, a sleep, a Taunt | the carrier, standing beside it |
| `entry-aids-ally` | `adjacentAllies()` inside `onStart` | the carrier starts ON THE BENCH; the ally is chipped and dropped, then it walks in | boundary 1 (away) and boundary 3 (no second entry) |
| `blocks-foe-berry` | `onFoeTryEatItem` | a derived threshold berry on the aggressor, chipped past its line | — |

### THE POSITIVE CONTROL WAS DEMANDED AND IT PASSED

Sand Rush, Swift Swim, Chlorophyll and Slush Rush were verified BY HAND earlier the same day
(`effSpeed` reads `speedCond` and gives 100 → 200 in the right sky only). **A rule family that cannot
confirm a known-correct ability is not measuring anything.** All four now come back
FIRED-AND-BOARDS-MATCH under `weather-speed`; Damp is untouched and still uninvolved. Any future
accusation against one of those four is the RULE being wrong.

### SIX TIMES THE INSTRUMENT WAS WRONG BEFORE THE ENGINE WAS — ALL SIX CAUGHT BY ITS OWN CHECKS

- **PURE POWER IS THE HEADER EXAMPLE AND IT IS MEASURED, NOT ILLUSTRATIVE.** It doubles ATTACK, its
  only carrier is Medicham (Fighting/Psychic), the generic staging picks the carrier's click BY TYPE,
  Fighting is immune against the Dragon/Ghost aggressor — so it fell through to **Psychic, which is
  SPECIAL**. An ability that doubles Attack was being measured through a Special Attack click: two
  arms, one number, nothing staged. `unconditional-stat-multiplier` takes the category from the
  handler NAME instead.
- **THE STAT-DROP COVER WAS A TOP-N BY COUNT AND COVERED THE SAME TWO STATS TWICE.** Noble Roar and
  Tearful Look both lower atk + spa, so Big Pecks (Defense) had nothing to block. Replaced by a
  GREEDY COVER over stats — each further click adds the most stats not already covered.
- **AND WIDENING IT WAS NOT ENOUGH: KEEN EYE GUARDS ACCURACY, AND NO LEGAL MOVE IN THIS FORMAT LOWERS
  IT.** Sand Attack, Smokescreen, Flash and Kinesis are all `isNonstandard: 'Past'` here and Sweet
  Scent lowers EVASION at every foe. The first fix REFUSED Keen Eye with that reason and **cost it a
  FIRED-AND-BOARDS-MATCH it already held** — because this rule owns the entity the moment it returns
  anything, and Keen Eye's other half (ignoring the target's evasiveness, `onModifyMove`) is a
  different mechanic the rule never looked at. It now DECLINES — returns null — and the entity falls
  to a rule that can say something about it.
- **`speedOnItemLoss` CAUGHT STICKY HOLD. AGAIN, BY NAME.** CLAUDE.md records that exact over-match;
  it arrived a second time because both abilities register `onTakeItem`. The discriminator is the
  SHAPE inside the handler — Unburden calls `addVolatile("unburden")`, Sticky Hold returns `false` —
  and it was caught by printing the membership, which is the only defence that has ever worked here.
- **THE ALLY RULE THREW SIX GAMES, AND THE CAUSE WAS THIS FILE'S OWN INERT CLICK.** Taunt forbids
  STATUS moves and `INERT` is Focus Energy, a status move — so a body taunted on turn 2 had no legal
  choice on turn 3, `scripted()` answered `pass`, and Showdown rejected it outright. The taunt is now
  the LAST click in the script.
- **A MUTUAL-KO REQUIREMENT RETIRED THREE KNOWN-CORRECT ABILITIES.** `weather-speed`'s first version
  wanted a foe that could kill the carrier AND be killed by it; Excadrill, Basculegion and Beartic are
  bulky enough that nothing in the format one-shots them back, so Sand Rush, Swift Swim and Slush Rush
  all refused for a reason entirely about this file. One lethal direction is enough, because the FOE'S
  CLICK IS A STAT DROP that only lands if it moved first.

### THE MIRROR TEST STILL REPORTS, AND HALF ITS ACCUSATIONS ARE GONE

25 pairs in the abilities stage, **4 reporting the same numbers swapped** (was 6): Corrosion ↔ Toxic
Debris, Gooey ↔ Shell Armor, Keen Eye ↔ Weak Armor, Refrigerate ↔ Snow Warning. **Fluffy ↔ Sand Rush
and Water Absorb ↔ Water Bubble are no longer among them** — not because anything was quietened, but
because each member now has a staging of its own that does not use the other as its control.

### ROADMAP #107 — `--write` WAS DESTROYING THE STAGE BESIDE IT

It wrote `data/roster.json` unconditionally, whatever stage ran. One file cannot carry three stages,
so a moves run silently destroyed the abilities results — **twice on 2026-08-08**, both times
recovered only because they had been copied aside by hand. `engine/quarantine.js` reads a stage only
from an artifact whose own `stage` field names it, so **two of its four clauses were failing purely on
ABSENCE**, not on a red.

`--write` now writes **`data/roster.<stage>.json`** — the file the gate reads — and keeps
`data/roster.json` as a clearly-labelled convenience copy of the last stage run. `--stage all` runs
items, abilities and moves together and writes `data/roster.all.json`, which the gate accepts as a
fallback for all three. **An overwrite is announced**: the outgoing artifact's stage, release,
timestamp and counts are printed and its bytes are kept at `data/roster.<stage>.prev.json`, because a
silent replacement looks exactly like a first write.

Measured after: `node engine/quarantine.js` reads `data/roster.items.json`,
`data/roster.abilities.json` and `data/roster.moves.json` and reports **content** for all three —
`0 DIFFER / 6 DID-NOT-FIRE`, `0 / 1`, `52 / 27` — where two of them previously read *NO ARTIFACT FOR
THIS STAGE*.

**Wall clock, release `72e361e1bd44`:** items 4 s · abilities 6 s (14 s with `--reds`, 38 s for the
full red demonstration) · `--stage all` 1 min 20 s.

## THE ROSTER'S MOVES STAGE — 26 SHAPE RULES BUILT, AND THE ABILITIES STAGE'S ENTIRE FINDING QUEUE RETRACTED. 2026-08-08.

Will, on being shown that the moves stage was a stub: *"lets do it"*.

**THE STUB WAS REAL AND IT WAS PROSE.** `tests/roster.js`'s own header described move rules reading
"a move's `target`, `category`, `basePower`, `status`, `boosts`, `volatileStatus`, `weather`,
`flags`". `--rules` printed **23 item rules, 6 ability rules, 0 move rules**, and `--stage moves`
answered *"no shape rule in this file matches its data shape. Handlers: none"* for all 500 legal
moves, with `all 0 derived clicks are guaranteed hits`. The repository's signature failure, inside
the file whose entire purpose is to stop hand-maintained lists.

### THE RESULT — all 500 legal moves, release `72e361e1bd44`, 15 s wall clock

`52 FIRED-AND-BOARDS-DIFFER · 27 DID-NOT-FIRE · 330 FIRED-AND-BOARDS-MATCH · 0 CONTROL-NOT-QUIET ·
91 COULD-NOT-STAGE`, and **26 of 26 staging rules CAUGHT AND LOCALISED their own break**. The
79-row queue totals **15,000 corpus uses** and is led by **Encore 5,599 · Taunt 1,714 · Toxic 1,062 ·
Infestation 971 · Disable 808 · Clanging Scales 749 · Triple Axel 674**.

### SAID FIRST, BECAUSE IT RETRACTS A NUMBER THIS FILE ALREADY PUBLISHED

**ALL SIX FINDINGS OF THE ABILITIES STAGE WERE THE CONTROL'S, NOT THE SUBJECT'S.** That stage
controls by swapping in ANOTHER REAL ABILITY of the same species, and where the species has no quiet
alternative the "control" is a second live mechanic. `data/roster.abilities.json` reported Sand Rush
`with=818/without=850` and Fluffy `with=850/without=818` — **one 32-HP fact, two accusations**, and
the gap is Fluffy halving contact damage. Anger Point and Justified both reported `boosts.atk -1`,
which is INTIMIDATE being removed by the control.

**THE FILE ALREADY KNEW AND SAID IT IN THE WRONG FIELD.** Every one of those rows carried the note
*"(NOT A QUIET ABILITY — see the caveat on any finding)"* while the VERDICT kept saying
DID-NOT-FIRE. The verdict is what gets read, quoted and queued — the same shape as a `PRE-CHANGE`
caption under a headline number. So the caveat is now **the verdict**: a new `CONTROL-NOT-QUIET`
outcome, emitted from `runEntry` before anything downstream (the artifact, `--reds`, the exit code)
can read a contaminated row as a subject failure. The abilities stage now reads
`0 DIFFER · 0 DID-NOT-FIRE · 29 MATCH · 8 CONTROL-NOT-QUIET · 279 COULD-NOT-STAGE`.

**AND THE INSTRUMENT NOW CHECKS ITSELF FOR IT.** THE MIRROR TEST: if A's control is B and B's
control is A, their deltas are one measurement with the sign flipped and the pair cannot say which
member moved the board. It costs nothing — no game is replayed — and it finds **25 such pairs in the
abilities stage, 6 of them reporting the same numbers swapped**, including Fluffy ↔ Sand Rush and
Refrigerate ↔ Snow Warning. The moves stage has **zero** such pairs by construction, and that is
printed rather than left as silence: a move's control is the inert click, which the selftest proves
moves no board leaf in either engine.

### THE PIN COSTS 121 MOVES, AND THE OTHER SHIPPED ARM BUYS THEM BACK

The primary arm makes every sub-100-accuracy move MISS. For an ITEM that costs almost nothing; for a
MOVE it silences **121 of 500** — Will-O-Wisp, Hypnosis, Thunder Wave, Toxic, every OHKO move, every
raised-crit-ratio move — each of which would have read *"identical"* on two boards where nothing
happened. `bottom-tie-first` is the other arm already shipped in `game_differential.js` and its
corner is the exact inverse. The arm is now a property of the SCENARIO, chosen from the move's own
`accuracy` and `critRatio`, and printed on every entry staged under it: **379 primary, 121 bottom**.

### FOUR TIMES THE INSTRUMENT WAS WRONG BEFORE THE ENGINE WAS, ALL FOUR CAUGHT BY ITS OWN CHECKS

- **THE BODY POOL OVER-MATCHED, AND `--rules` IS WHY IT WAS SEEN.** The item stage's
  `carrierAbility` filter is right for a DAMAGE reading and wrong for a move stage: printed, it hands
  out **SHIELD DUST to 20 species** (it deletes every secondary), **AROMA VEIL to 9** (it blocks
  Taunt, Encore, Disable), plus Sweet Veil, Flower Veil, Contrary, Unaware and Prankster. The move
  pool is the strict one — **no `on*` KEY AT ALL**, not "no `on*` FUNCTION", because Shell Armor's
  handler is the literal `false` and a handler-shaped filter waves it straight through. Three members
  of even that set are excluded by hand with the reason: **Early Bird** moves the sleep counter,
  **Dancer** copies the Dragon Dances this stage clicks, **Corrosion** breaks the poison immunity the
  status rule leans on. What survives is **five species**, all wearing Battle Armor or Shell Armor.
- **THE CRIT-ARMOUR GATE WAS ITSELF A CONTAMINATED CONTROL — INSIDE THE FIX FOR CONTAMINATED
  CONTROLS, FOUR HOURS LATER.** It compared Shell Armor against the species' alternate, and every
  legal carrier's alternate is Overgrow, Torrent, Sap Sipper or Defiant. Replaced by a question that
  needs no control ability: break the crit's x1.5 and watch. **MEASURED: 2 leaves on
  `bottom-tie-first`, 0 on the primary — a crit lands exactly where that arm's pin says. With Shell
  Armor on the same body the plant moves 0 leaves and the two engines part on 0**, so the armour is
  one fact BOTH engines hold and cancels out of every delta.
- **AND THE FIRST VERSION OF THAT MEASUREMENT SAID NO CRIT LANDS ANYWHERE** — because its defender
  was wearing the Shell Armor under test. `move/crit` therefore draws its defender from the ITEM
  stage's pool, which is the one place the two pools must differ: `carrierAbility` lists
  `onCriticalHit` in INTERFERES, so a body chosen by it provably cannot block one.
- **THE CONTROL-QUIET AUDIT FIRED ON 42 FALSE POSITIVES ON ITS FIRST RUN** — it flagged the entity's
  own later clicks, which are replaced too. The real hazard it exists for is narrow and is now
  exactly stated: a body that throws a DIFFERENT damaging move after its own click was silenced
  carries Focus Energy's two crit stages into the control arm only.

### FOUR ANCHORS WERE THE WRONG LINE, AND `--reds` SAID SO EACH TIME

None of these is a defect; each is the file's own red demonstration refusing a rule that could not
express its mechanic. **`move/status-inflict`** was aimed at `if(_e.status) applyStatus(...)` inside
the `affect` branch — but `playerAction` classifies Glare, Spore and Thunder Wave as `kind:'status'`,
so control never reaches it; re-aimed at the shared writer. **`move/ohko`** was aimed at the damage
roll, and an OHKO never goes through the randomizer (`_fd.source === 'ohko'` returns the target's
whole HP flat). **`move/priority`** carried a double-quoted anchor the source does not contain.
**`move/type-changing`** was aimed at `effMoveType` and moved nothing — **which is the live defect
wearing its own clothes**: `effMoveType` (:2167) is the battle loop's authority for the stage-5
immunity gate and `dmgRange` (:2360) reads `weatherScaled` AGAIN for itself, so breaking one leaves
the other pricing the converted type. **Two readers of one fact is the defect** (CLAUDE.md: facts are
global). Filed, not fixed — the simulator is not this file's to edit.

> **The defect this rule named was FIXED by ROADMAP #96 WIRE 3 on 2026-08-09** — `effMoveType` now
> asks `effWeatherOf`, so the loop and `dmgRange` read one sky. The rule's own anchor is unchanged and
> still aimed at the damage-side copy, which is correct: two readers remain, and what was closed is
> their DISAGREEMENT about the weather. **`tests/roster.js` still carries the old prose in the rule's
> `why` field** ("the known live defect is `effMoveType` reading `field.weather` RAW…"). That file was
> out of scope for this pass and the sentence is now stale; it is named here rather than left to be
> read as current.

**WEATHER BALL IS CORRECT AND IS NOW PROVEN CATEGORICALLY RATHER THAN BY A DAMAGE NUMBER.** It is
staged against a GHOST — Skeledirge — because a neutral defender turns a type change into a damage
number where a missing 2x and a defensive x0.5 are the same factor and cancel, which is exactly how a
false red was manufactured against this move earlier the same day. Turn 1 is the click under a clear
sky (Normal, so a Ghost takes literally nothing), turn 2 sets the sun, turn 3 is the identical click
(Fire, full damage). **Identical damage on turns 1 and 3 would mean the type never changed.** Both
engines agree. The known live defect needs a PRIVATE sky — a Mega Sol ability with a clear field —
which is an ABILITY carrier and therefore out of reach of a move-shape rule; named on the rule rather
than quietly missed.

### THE RESIDUE, REPORTED WITH ITS SIZE AND ITS USAGE BECAUSE THAT IS THE MEASURE OF THE JOB

`ability/generic` swallowed 124 abilities over 72,899 uses and called them inert, which is how a
coverage hole last disguised itself as a completed run.

| bucket | moves | uses | staged | what it actually tests |
|---|---|---|---|---|
| `move/plain-attack` | 175 | 171,323 | 168 | a DAMAGE NUMBER against the authority, on moves no ladder team brought — the coverage a usage-driven differential cannot buy |
| `move/generic-status` | 54 | 5,878 | 23 | **the weak one.** A zero-power move whose effect lives in an `onHit` handler; it reaches the board only if that handler touches a compared leaf, and 31 of the 54 come back THE STAGING IS INERT |

`move/plain-attack` is large and is NOT the `ability/generic` shape: every member of it that stages
is a real leaf-for-leaf damage comparison, and 8 of the 79 queue rows came out of it.
`move/generic-status` **is** that shape and is labelled as such rather than counted as coverage.

### THREE LIMITS THAT BELONG TO THE DRIVER, FILED NOT FIXED

`engine/game_differential.js` is not this file's to edit and all three are recorded on the rules that
hit them. **A charge move's RELEASE turn is unscriptable**: `scripted()` falls back to the DEX target
when the request omits one, and Showdown's request for a body mid-wind-up omits it precisely because
a locked move takes no target — so every scripted release turn is emitted as `move 1 1` and rejected
with *"You can't choose a target for Dig"*. The wind-up turn alone is staged and Electro Shot's
`+1 SpA` on it is a real comparison. **A recharge turn is unscriptable** for the mirror-image reason:
the subject arm is offered the single pseudo-move `recharge` and the control arm is not, which is two
experiments rather than a control. **Struggle cannot be clicked at all** — Showdown disables it for
any body with a usable move, and every body here carries the inert click.

## THIS DIVISION IS NOW THE GATE ON EVERY NUMBER TO ITS RIGHT — 2026-08-08 (MEASURE)

`engine/quarantine.js` withholds every figure downstream of MEDICHAM until MEDICHAM is correct, and
**the condition is read out of ENGINE's own instruments**. Nothing here is a judgement about the
engine; it is a computed gate, and `node engine/quarantine.js` prints which clause fails and by how
much. Today all four fail:

- the **game differential** at 1 of 150 (`chesnaught woodhammer -> mimikyu`);
- the **deliberate roster** at 2 FIRED-AND-BOARDS-DIFFER and 4 DID-NOT-FIRE on the abilities stage;
- the **items** and **moves** stages, which have **no artifact at all** — and a missing stage is a
  FAILING clause, never a passing one.

**Two things this asks of ENGINE, neither of them a change to the simulator.**

1. **`tests/roster.js --write` overwrites `data/roster.json` whatever stage it ran**, so only the
   newest stage survives and two thirds of the gate can never be satisfied at once. The gate accepts
   `data/roster.<stage>.json` and `data/roster.all.json` as well, so a stage-preserving filename (or
   a `--stage all` run) closes it. This was NOT changed here — the file was held by another division
   at the time.
2. **`engine/derive_protocol_events.js` is a DECLARED instrument** in `engine/quarantine.js`, with its
   reason: it loads the simulator only to read the event list it claims to emit and checks that claim
   against Showdown's own `add()` call sites, so MEDICHAM is its subject rather than its input.
   Quarantining it would have withheld `game-differential.json` downstream of it — the gate's own
   first clause. `engine/game_differential.js` is declared for the same reason. **Both declarations are
   checked**: one naming a module that is no longer in the play layer fails the gate.

Nothing ENGINE reports is withheld. The census, the differential, the interaction matrix, the roster
and the release ladder all print in full, deliberately — they are the instruments that say when the
quarantine can lift, and blinding them would be the one way to make it permanent.

## THE REAL NATURE NOW REACHES BOTH ENGINES, AND THE TURN-1 NUMBER FELL. THAT IS THE INSTRUMENT GETTING HONEST. 2026-08-08.

Census **324 live, 0 missing, 324 probed — UNCHANGED**, which is the point: this is an instrument
change and it must not move the engine's number. New gate `tests/test-nature-differential.js`, **13
checks, all green, with the mega case red-demonstrated on a planted break**.

Will, 2026-08-08: *"lets add the sp spreads and rerun"*, then — correctly, before anyone had to tell
him — *"we wont have evs from team sheets"* and *"just nature"*.

### SAID FIRST, BECAUSE IT IS THE THING THAT IS NOT A DEFECT

**THE SPREADS ARE NOT MISSING FROM OUR INGEST. THEY ARE NOT IN THE GAME.** A Showdown open team sheet
reveals species, item, ability, moves, nature, gender and level. It does **not** reveal the spread:
every stored sheet reads `"evs": null`, on **173,784 of 173,784 bodies** in the frozen store. So there
are no real spreads to carry, there never will be, and **ROADMAP #68's declared gap is NARROWED by
this pass and is not closed.** That sentence is in the run's own output and in `rate_excludes`, so the
next reader does not have to find this section.

**AND THE NATURE WAS BEING THROWN AWAY.** `buildPair` hardcoded `nature: 'Serious'` while the stored
sheet beside it said `Modest`. Nature is the single largest legal lever on a body we can actually
observe, and it was discarded on 100% of them.

### WHY IT MATTERS MORE THAN 10% ON A STAT: THE RIG WAS MANUFACTURING ITS OWN SPEED TIES

With every body flat AND Serious, **326 of 357 species in the format (91.3%) share a Speed with at least one other
species** (ROADMAP #86 records 91.4% over the wider legal set). The differential was testing turn
order in the one configuration where turn order is hardest to get wrong. The receipt is not an
argument, it is the run's own `speed_ties` counter over the same 1,998 games:

| | flat/Serious | the sheet's own nature |
|---|---|---|
| tied groups the resolver had to break | **348,595** | **243,467** |

**A 30.2% fall.** A hundred thousand speed comparisons per run that were ties by construction are now
real differentials, and the engine is being asked about them for the first time.

### THE MEASUREMENT. THE TURN-1 NUMBER FELL, AND THAT IS THE HEADLINE

Two arms, **1,998 games each**, differing in ONE run parameter and in no bytes at all: the same
frozen release `72e361e1bd44`, the same pinned census `data/wire-ladder-census.pin.json`, the same
frozen team store, the same pool digest `32b2abcbfeb7`, `--nature serious` against `--nature real`.
`threw` is 0 in both. Every figure below is read out of **`data/nature-arms.json`**, which also carries
an `identical_inputs` block asserting all five of those are equal across the pair — a controlled A/B
that cannot say so is not one.

**AND `engine/arms_comparable.js` REFUSES THIS PAIR, ON PURPOSE.** `mode` carries `/nature:`, so
nobody can table it beside `data/state-ladder.json` or any pre-2026-08-08 rung. The two arms are
different INSTRUMENTS; what is claimed here is the narrower thing — the rig measured against itself
with one parameter moved.

| | `--nature serious` | `--nature real` | |
|---|---|---|---|
| board identical at end of turn 1 | 1947/1998 **97.4%** | 1944/1998 **97.3%** | −3 games |
| games whose board NEVER parted | 1615/1998 **80.8%** | 1574/1998 **78.8%** | **−41 games** |
| median turn of first board divergence | 8 | **7** | one turn earlier |
| turn boundaries identical | 98.40% | 98.21% | |
| protocol: games that diverged | 839 | **874** | +35 |

**A DROP IS THE RIGHT RESULT AND WAS PREDICTED BEFORE THE RUN.** The instrument now reaches boards it
could not previously construct. Reporting the fall is the finding; a rise would have meant the knob
was not wired.

**WHICH FIELDS THE NATURES EXPOSED** — games in which that leaf differed, `real` minus `serious`:

| field | serious | real | delta |
|---|---|---|---|
| `party.hp` | 163 | 176 | **+13** |
| `active[].hp` | 215 | 227 | **+12** |
| `active[].boosts.atk` | 107 | 118 | **+11** |
| `active[].vol.encore` | 10 | 19 | **+9 — nearly doubled** |
| `active[].item` | 71 | 77 | +6 |
| `active[].boosts.def` | 11 | 17 | +6 |
| `field.weather_turns` | 23 | 27 | +4 |
| `active[].species` / `active[].maxhp` / `active[].boosts.spa` | 70 / 60 / 22 | 73 / 63 / 25 | +3 each |
| `tailwind` | 9 | 7 | −2 |

The protocol classes move the same way — `ordering` 238 → 245, `event missing from medicham2`
206 → 216. **Encore is the one worth naming**: it is a duration volatile whose whole behaviour is
"which move did the target use", so it only comes apart when the turn order does, and it had almost
nothing to bite on while every body was tied.

### NEITHER ENGINE IS TOLD THE OTHER'S ANSWER, AND `ALIGN_MOVED` STILL READS 0

The old flat build existed for a real reason and the reason survives. Stats used to be **copied** from
the medicham side onto the Showdown body, which papered over disagreement rather than removing it, and
could not survive a mega — `formeChange` calls `setSpecies`, which **recomputes `storedStats` from the
SET** mid-turn, with no seam for a harness to re-align in. So the rule is that both engines DERIVE, and
`alignStats` exists only to assert they landed on the same number.

Nature is compatible with that; copying is not. Both sides are told the **nature** and each computes.
`M.natureL50` is a FACT and lives in `medicham2-browser.js` beside `md4096` — the differential calls it
rather than growing a third copy of the chart, and the paste path's own `Math.floor(x * 1.1)` was
folded into it. The arithmetic is Showdown's fixed-point form verbatim,
`tr(tr(stat * 110, 16) / 100)`; the 16-bit wrap is unreachable at level 50 (it first bites at 596
against a largest legal line of ~232) and is carried anyway, because "the same in the range we use" is
how two engines come apart later. Measured: the float form and this one agree on every value below 596
and part on 405 values above it.

**AND THE MEGA CASE IS THE ONE THAT BROKE THE OLD DESIGN, so it was tested first.** medicham2's swap is
`megaL50 + (st - baseL50)`. With `st` natured and the anchors not, the delta becomes
(mul − 1) × baseL50 and the mega lands short on exactly the stat the nature moved. Staged as PART 4:
a **Jolly Abomasnow @ Abomasite** megaing mid-turn — unnatured anchors give Speed **58**, the authority
says **55**. Both engines and the authority agree on all six stats before and after the forme change,
and `updateMaxHp` emits **no phantom `-heal`**. The break was planted and the probe caught it,
reporting exactly the 58 it predicted.

### THE CONTROL WAS CLEARED EXPLICITLY, NOT ASSUMED

`l50` grew an argument and `megaEvolveNow` grew two, so **every body this engine has ever built** went
through edited arithmetic — every rollout, every board feature, every census probe. PART 7 measures the
no-op against frozen release `6b5447db1738` rather than arguing it from the source: **all 344 un-natured
`buildMon` stat lines and all 75 un-natured mega swaps are identical.**

### WHAT THE FIRST RUN FOUND, WHICH WAS NOT THE NATURE — `ALIGN_MOVED` READ 21, AND ALL 21 ARE DITTO

The alignment counter had never been anything but 0. At 1,998 games it read **21 — in BOTH arms
equally**, so it was not the nature; it had simply never been run at a game count that reached a Ditto.
And a bare `21` cannot be acted on, so the counter now carries its own witness, which named it in one
line:

```
Ditto  showdown 123/68/68/68/68/68     medicham 123/75/110/150/101/106
```

`battleInit` applies ENTRY effects, and since 3.76.0 that includes **Imposter** — so by the time the
alignment read the medicham body, that Ditto had already transformed and was carrying the stat line of
whatever it copied. Showdown's Ditto had not entered yet (the alignment runs before `team 1234`), so it
still read its own 68s. **The alignment then wrote medicham's copied line onto Showdown's `storedStats`
AND `baseStoredStats`** — the field a transform reverts to — rebasing Showdown's Ditto onto another
Pokemon's stats before the game began.

That is the papering-over the buildPair header forbids, arriving by a road nobody had covered. *"Do the
two engines' Imposters copy the same thing"* is a REAL question and the harness was answering it in
medicham's favour, silently, on every Ditto in the pool. The alignment now compares the line **as
built**, snapshot before `battleInit` touches anything, and `ALIGN_MOVED` is back to 0 with the question
restored.

### THE NATURE IS A RUN PARAMETER, SO A BEFORE/AFTER SPANNING IT IS REFUSED

`mode` now reads `A/<arm>/pins:<digest>/credit:<rule>/nature:<real|serious>`.
`engine/arms_comparable.js` already compares `mode`, so the nature run cannot be quietly tabled beside
`data/state-ladder.json` or any pre-2026-08-08 rung. It changes which games get played, exactly as the
pin set and the credit rule do.

**AND A MISSING NATURE IS COUNTED, NEVER SILENT.** 68,736 bodies built from the sheet's own nature, 96
fell back. The frozen store carries a dex-valid nature on 100% of bodies, so an unexplained fallback
would be a silent default wearing a number — the counter therefore NAMES what fell back, and all 96 are
this file's **own hand-written fixtures** (Clefable, Milotic, Snorlax, Corviknight, Incineroar, Toxapex
— the directed-scenario cast), which declare species/item/ability/moves and no nature. The authority
decides whether a string is a nature: `natureShift` answers `{plus:null,minus:null}` for a NEUTRAL
nature and for a typo alike, so asking it would count `Modset` as declared and flatten the body in
silence.

### FILED, NOT MINE

- **`tests/test-effective-identity.js` is RED and was red before this pass**: `no NEW raw read of a
  transforming field (869 total, baseline 234)`, from `tests/roster.js` 0 → 97 and
  `tests/staged_board.js` 0 → 13. Both files landed with the roster work; neither is touched here. The
  fix is 110 declarations of why each read is correct BY CONSTRUCTION, and writing those for code I did
  not walk is how a justification gets laundered. **Not filed as "known" — named, with its owner.**

## WIRE 142 — THE STATUS-COUNTER CLUSTER. FIVE SYMPTOMS, THREE CAUSES, AND THE TWO LOUDEST WERE NOT DEFECTS. 2026-08-08.

Census **319 → 324 live**, `missing` **0**, `probed` 324. New instrument:
`tests/staged_status_counters.js`, **11 scenarios, 6 FIXED (red on release `6b5447db1738`, identical
on the live tree), 5 ALREADY-CORRECT**, 2 declared controls both green on the release, 1 planted
break caught and localised. `tests/staged_board.js` unchanged at **24/24 clean, 24/24 breaks caught**.
Tag coverage 182/190 → 183/191 probed.

Will, 2026-08-08: *"do you have a freeze counter? have we checked burn cuts attack in half?"*

### SAID FIRST: BURN IS CORRECT, AND SO IS THE FREEZE TIMER

**BURN WAS NEVER ONCE ON A BOARD IN THIS REPOSITORY, AND IT IS RIGHT ANYWAY.** Will-O-Wisp is
85-accurate and the primary pin makes every sub-100 move miss, so the roster filed burn as
COULD-NOT-STAGE and nothing else had ever inflicted one. Staged now on the `bottom-tie-first` arm,
where a sub-100 move hits: the halving lands, **INCINEROAR CANNOT BE BURNED AT ALL** (Fire type, same
Will-O-Wisp, no status on any board), **FACADE IS EXEMPT** and **GUTS IS EXEMPT** — a burned
Conkeldurr deals 82 twice while a burned Scizor beside it drops from 39 to 19 on the turn its burn
lands. Every field agrees with the authority on the frozen release too, so this is a confirmation and
not a fix.

**THE FREEZE TIMER IS ALSO CORRECT, AND THE FORMAT IS NOT WHAT GENERAL POKEMON KNOWLEDGE SAYS.**
`data/mods/champions/conditions.ts` overrides `frz`: a **3-turn timer with an additional 1-in-4 thaw
per attempt**, not Gen 9's flat 1-in-5. The engine's `frzTurns` gate already encodes exactly that and
has since it was written.

**WHAT WAS WRONG IS THAT NOTHING COULD HAVE SEEN IT.** `engine/board_state.js` compared the toxic
stage and the sleep counter and mentioned `frz` only in a display-name map, so `frzTurns` could drift
by any amount in silence. Demonstrated rather than argued: a plant that starts the counter at 1
instead of 0 was **NOT CAUGHT** on a board comparing 131 fields, and is now **CAUGHT AND LOCALISED to
`status_counter`**. The mapping `freeze-counter-is-turns-frozen` carries its own red proof beside the
sleep one.

### THE SLEEP COUNTER — THE CAUSE IS AN ORDERING, AND IT COSTS A WHOLE TURN

`onBeforeMovePriority` is an authority fact and this engine had four fifths of it. A HIGHER NUMBER
RUNS FIRST: `slp` 10, `frz` 10, `flinch` 8, `confusion` 3, `par` 1. The loop ran **flinch first**, so a
body that was **asleep AND flinched** consumed the flinch and never ticked its sleep counter.

Not a counter curiosity. Staged as `sleep-counter-under-a-flinch` — Fake Out and Spore into one
Snorlax on one turn — the boards part on `status`, `status_counter` **and `boosts.atk`**: Showdown's
Snorlax wakes on turn 3 and takes a Swords Dance ours does not get until turn 4. **The control with
the Fake Out removed is IDENTICAL on the same release**, which is what makes the ordering the whole
cause rather than a guess. `par` moved below `slp`/`frz` in the same pass; it changes nothing today
because a body cannot hold two major statuses, and a list that is four fifths of the authority's is
the shape that comes apart when somebody adds the fifth member.

### CONFUSION DID NOT EXIST, AND THE VOLATILE THAT WAS THERE WAS WORSE THAN NOTHING

Nine moves carry `statusInflict {volatile:'confusion'}` — Confuse Ray, Dynamic Punch, Swagger,
Flatter, Sweet Kiss, Teeter Dance, Water Pulse, **Hurricane (3,779 uses)** and Axe Kick. The generic
volatile branch wrote `_vol.confusion = 1` onto the target and **nothing ever read it or decremented
it**, so the flag sat on the body for the rest of the game and the mechanic it named never happened
once in any rollout this project has run. The secondary path did not even do that: `s.volatile ===
'confusion'` fell through `status`, `targetBoosts`, `selfBoosts` and `flinch` and out of the loop.

Wired as one function each way. `applyConfusion` refuses a body that is **already confused** (a second
Confuse Ray is not a free extension), a body with **OWN TEMPO**, and a body behind **SAFEGUARD**
through the existing `sideBuff.blocksVolatile` reader. `confusionBeforeMove` decrements at the TOP of
the attempt, removes the volatile at zero **before the self-hit roll is asked**, and otherwise costs
the action 33% of the time for a 40-BP typeless physical hit off the body's own Attack against its own
Defence. Measured exact against the authority: 23 HP off a Snorlax at the maximum roll, 21 at the
probe's, on the same board where Showdown reads the same number.

**THE DURATION IS THE MINIMUM OF THE AUTHORITY'S RANGE, AND THAT IS A DECISION, NOT A DEFAULT.**
`data/conditions.ts:174` draws `this.random(2, 6)`; the differential pins Showdown's RANGE form to the
bottom in **every** arm, and this engine's `rng` is a plain float that cannot express a range draw —
`min + floor(rng()*span)` reads 5 on the top-corner arm and 2 on the bottom one, so the two engines
would part on the arm the staged boards actually run. The flat minimum is the same choice the partial
trap already makes. **The cost is real and is counted, not hidden**: against real dice confusion lasts
3.5 attempts and this engine gives it 2, so a search will UNDER-value landing one.
`MEDSEEN.confusionMinDuration` is the receipt.

**AND IT DID NOT SURVIVE THE FIRST PROBE WRITTEN AGAINST IT.** Two lifetime bugs came out of the
census row `a confusion does NOT survive the body leaving the field`, both of which the staged boards
structurally could not see:

- **A `pass` AND A VOLUNTARY SWITCH ARE NOT MOVES**, and the tick ran for them. A body standing still
  while nobody moved lost its confusion in two turns. Every staged scenario clicks a real move, so no
  board in this repository could have caught it.
- **`switchOut` NEVER TOUCHED `_vol`.** It erases the substitute, the trap, the charge, the silence
  and the boosts by hand, so a confusion written on turn 1 was still on the body two switches later —
  the never-decays defect arriving by a second road. Red-demonstrated: with the one line removed the
  probe reads `2,2` and the census drops to 323/1 missing.

**FILED, NOT FIXED, AND THEY ARE THE SAME TWO BUGS ONE LEVEL UP:** `taunt`, `encore` and `disable`
also survive a switch here, and `slp`/`frz`/`flinch` also tick on a pass — worse, the `continue` in
the sleep gate means **a sleeping body cannot voluntarily switch at all**. There is no failing probe
on either: `board_state.js` compares volatiles only on the ACTIVE bodies, so a taunt riding the bench
is invisible to every staged board, and changing how every switch resolves is not a line to add
beside a confusion fix.

**Alluring Voice's punish arm is no longer declared-and-unmodelled**, and the `tangledfeet` row in the
damage table can now be switched on by whoever owns that table — the state it was waiting for exists.

### THE TWO BERRIES WERE ONE DERIVATION GAP, NOT TWO ENGINE GAPS

**PERSIM BERRY CARRIED NO CURE TAG OF ANY KIND.** Its `onUpdate` tests only `volatiles['confusion']`,
so `curesStatus` (which greps the status handlers) found nothing and `curesVolatile` (which matched
Mental Herb's literal `conditions` array) found nothing either. **Lum read as curing statuses only**,
which is what the artifact said and not what the item does.

`curesVolatile` now reads the SECOND shape as well — `removeVolatile('x')` inside `onEat` — and the
membership was printed before it was wired, over every non-Past item the format defines:
**exactly two matches, `lumberry` and `persimberry`, both naming `confusion`.** Mental Herb's set is
unchanged. `berryCureUpdate` gained the volatile arm first, because `curesStatus` returns early on an
unstatused body and a Persim holder never reached the rest of the function.

### A NEW ABILITY TAG, WITH ITS MEMBERSHIP PRINTED FIRST

`refusesVolatile`, derived from `onTryAddVolatile`. Own Tempo (64 sheets) could not be confused and
had nothing to refuse until this pass; wiring confusion without it would have INTRODUCED a divergence
on 64 sheets while fixing something else. The membership is clean and is the reason the tag is safe:

| ability | refuses |
|---|---|
| `owntempo` (64) | confusion |
| `innerfocus` (890) | flinch |
| `insomnia` (63), `vitalspirit` (10), `leafguard` (94), `purifyingsalt` (60) | yawn |

**One member is knowingly missed and it is a MISS rather than an over-match**: Shields Down writes its
refusal as an early-return guard (`if (status.id !== 'yawn') return;`), which the inclusion pattern
deliberately does not match — the same shape that nearly deleted Mirror Armor in ROADMAP #81 WIRE 12.
Yawn is not modelled here at all, so it costs nothing today.

### WHAT THE INSTRUMENT GOT WRONG BEFORE THE ENGINE DID — FIVE TIMES, ALL ON THE RECORD

1. **THE BEFORE ARM SILENTLY BECAME THE AFTER ARM.** `engine_release.open()` with no id takes the
   NEWEST release, and a `game_differential` run in another process cut release `138261a235c7` over
   this working tree, mid-edit, at 07:33. The next run reported IDENTICAL on both arms and every
   verdict in it was worthless. Nothing failed; the comparison simply stopped comparing, and it
   stopped on the comfortable answer. The baseline is now NAMED in the file, injected into argv before
   either module loads, and the run refuses to start if that release is absent.
2. **THE AFTER ARM READ THE FROZEN ARTIFACT.** `harness()` compiles the live simulator under the
   snapshot's filename, so `require('./tags.js')` resolves inside the release — the berry scenarios
   stayed red on correct code because the frozen `data/tags.json` had no `curesVolatile` on a Lum.
   The AFTER arm now swaps the tags loader's cache entry for the live one, and refuses to run if the
   loader FILE differs between release and tree, because swapping two things at once is not a
   measurement.
3. **THE BURN SCENARIO WAS AIMED INTO A PROTECT.** Clefable shielded on every turn, so every Body Slam
   and the Facade were blocked: the burn landed, the boards agreed, and the halving under test was
   never computed. Measured, not reasoned — Clefable sat on 170 of 170 HP at every boundary. This is
   the one fault `staged_board.js`'s fixture audit says in its own header that it cannot see.
4. **THE SWITCH THE PROBE ASKED FOR COULD NOT HAPPEN.** `board()` puts two bodies on each side and
   nothing behind them, so `{ kind: 'switch', to: <undefined> }` was a switch that never occurred —
   and turn 3 was then handed to a body that was not on the field, which chose a move for itself and
   ticked its own clock. The probe read a surviving volatile and would have been GREEN on the fix for
   the wrong reason. A fixture that cannot express the act under test fails toward whatever the reader
   already believes.
5. **THE FREEZE TARGET WAS OUTSPED, AND THEN THE TARGET FAINTED.** Aimed at Corviknight the freeze
   landed and was gone before the boundary — the pinned log shows the 1-in-4 thaw firing on turn 1,
   which can only happen if the frozen body moved after the freeze. Tinkaton at 152 fixes it. Separately
   the Guts scenario pointed two attackers at one Clefable, which fainted and turned the run into a
   THROW rather than a finding, because the replacement carries a different moveset.

### FILED, NOT MINE

- **Release `138261a235c7` was cut over a mid-edit working tree** by a `game_differential` run at
  07:33 on 2026-08-08 and is now the newest release. Anything that calls `open()` with no id gets an
  engine that is neither `6b5447db1738` nor the current tree. It loads and runs; it is simply not a
  build anybody chose. Reported rather than deleted.
- **MISTY TERRAIN also refuses confusion** to a grounded body and this engine has no per-terrain
  volatile refusal to hang it on. 9 corpus uses. `MEDFAILS.confusionMistyUnmodelled` counts every
  confusion written while it is up, so the gap is a number in the run rather than a sentence here.
- **`getConfusionDamage` picks up an `onModifyAtk` ability** and the self-hit here does not — a burned
  Guts body hits itself harder in the authority. It needs a burn, a Guts body and a confusion at once.

## WIRE 141 — FIVE FIXES IN TWO ATTRIBUTABLE BATCHES, AND THE ONE WITH THE LOUDEST SYMPTOM WAS NOT A DEFECT. 2026-08-08.

Census **313 → 319 live**, `missing` **0**, `probed` 319. `tests/staged_board.js` **24/24 clean and
board-identical, 24/24 breaks caught and localised** (18 → 24 scenarios). Tag coverage 177/185 → 182/190
probed, unprobed unchanged at 8. Aimed at the residue of the 1,530-game run at release `3dd96ca88574`.

### SAID FIRST: MAWILE'S MEGA ABILITY SWAP IS NOT A DEFECT, AND THE PROOF IS THE BREAK

`mawile-mega-swaps-the-ability` was **IDENTICAL on its first run**, before a line changed. Mawile
carries Intimidate, Mawile-Mega carries Huge Power, and the staged turn puts two Intimidates and one
ability replacement inside a single turn with a real damaging click on top. All three named
hypotheses are dead: no entry effect fires twice, the foe's Intimidate lands on the right body at the
right moment, and the mega forme's ability really does replace the base one.

**A green here would have been worthless without the red beside it**, so the scenario's declared break
removes exactly the hypothesised bug — `m.ability=ab; m.baseAbility=ab;` deleted from `megaEvolveNow`.
Under it the boards part on **`boosts.atk` AND `hp` at once**: Staraptor and Corviknight sit a stage
lower because the kept Intimidate fires a second time on the forme change, and Corviknight takes
**22 HP less on turn 1 and 44 less on turn 2** because Huge Power was never installed. Both symptoms
the brief named are real symptoms — of a bug this engine does not have.

**The `boosts.atk` family it was blamed for is a CASCADE, not an Intimidate bug.** The artifact's own
row shows the two engines already holding DIFFERENT BODIES in that slot (`medicham mawile` against
`showdown kangaskhan`, with `maxhp` and `item` parted beside it); the attack stage is downstream of a
divergence that happened earlier. **Reported, not mine:** one genuinely isolated member survives —
`omit-weather`, turn 0, `p2.active[1].boosts.atk` medi `-1` / showdown `0`, a leads-time Intimidate
Showdown refused and we applied, with no other field parted. Membership of `onSwitchInDrop` is exactly
Intimidate and Super Sweet Syrup, so it is a REFUSAL we are missing rather than a drop we invented.
A whole-format sweep of `statDropRefusal` against the authority's `TryBoost` would name it; it is one
board and it did not ride along with five fixes.

### BATCH A — TWO SPECIES FIXES THAT CANNOT BE CONFUSED WITH EACH OTHER

**IMPOSTER (`transformsOnEntry`, 80 uses).** Ditto stood there as a 61-Attack Ditto in every rollout
this project has ever run. The mechanism is NOT the `formeChange` machinery Zero to Hero and Disguise
use, and checking that first is what made this cheap: those become a KNOWN forme with a row in
`data/engine-data.js`, and Imposter becomes an ARBITRARY opposing body, so the new body is **copied
off the thing it faced** rather than looked up. `imposterCopy` carries species, types, weight, the
moveset, the boosts, the ability and **every stat except HP** — `storedStats` is typed
`StatIDExceptHP` in `sim/pokemon.ts`, so HP is outside the loop rather than skipped by a condition,
and the staged Ditto keeps its own 123 max HP while copying a Clefable's 170.

**THE DIAGONAL IS THE HALF NOBODY GUESSES.** `foe.active[foe.active.length - 1 - pokemon.position]`
— a Ditto in slot 0 becomes the foe's **slot 1**. It is derived from the handler
(`transformsOnEntry.diagonal`) rather than typed, and it is the census probe's sharpest arm: an engine
copying "the body opposite" passes every other assertion and is wrong on half of all doubles boards.
The copied ability is LIVE (`setAbility(..., isTransform)` still fires `Start`), which this engine
gets for free by transforming above the entry-effect pass the caller already runs.

**HUNGER SWITCH (`formeCycleResidual`, 32 uses, tagged `untagged` until today).** Morpeko flips to
Morpeko-Hangry at the end of **every** turn, triggered by nothing, and this was the largest single
`species` cause at turn 1. `onResidualOrder` is 29 against Speed Boost's 28, so the consumer sits one
block below the gate WIRE 138 landed. **The alternation is the assertion**: under the declared break
turns 1 and 3 part and turn 2 AGREES, which is exactly the board a one-shot transform would produce —
a fix that transformed once passes half the scenario.

**THE DERIVATION HAD TO BE NARROW AND THE WIDE ONE WAS MEASURED FIRST.** `formeChange` in any handler
matches 13 abilities; inside `onResidual` it still matches FOUR. Power Construct, Schooling and Shields
Down are HP-THRESHOLD abilities — a state machine, not a clock — and giving them an alternating flip
would put a Minior back in its shell every other turn. The shape is the ternary on the current species
name with no `maxhp` in the handler; membership is exactly Hunger Switch.

**IT IS A RENAME, AND THE RENAME IS TRIED BEFORE THE REBUILD.** Both formes are 58/95/58/70/58/97 and
Electric/Dark, so `sameStats`/`sameTypes` are true and nothing modelled changes. `formeSwap` would have
been the wrong operation even though a `morpeko` row exists: it REBUILDS from the mon table, so a body
carrying a harness's flat level-50 line would be silently re-spread on the flip back and every damage
roll after it would be wrong. **Declared and not modelled:** the handler also stops for a terastallized
body; this engine has no Terastallization to read.

### BATCH B — ONE QUESTION, TWO MOVES, AND THE REFUSAL CLASS IS SMALLER THAN IT LOOKS

**KNOCK OFF'S x1.5 IS NOT A DAMAGE RULE.** `data/moves.ts` asks `singleEvent('TakeItem', …)` and
returns WITHOUT the boost when the item refuses. This engine honoured that at the STRIP and not at the
POWER, so a Charizard holding its own Charizardite Y correctly kept the stone and still ate the x1.5 —
staged at Showdown **84/153 against our 50/153**, the exact 34 HP the brief reported. One line, through
the `itemRefusesTake` reader the strip already asks, which is what stops a second copy of "can this
item leave this body" existing at all.

**AND IT IS NOT "MEGA STONES ARE IMMUNE".** The refusal is keyed on `source.baseSpecies.baseSpecies`,
so the IDENTICAL Charizardite Y on a Snorlax is taken normally and boosts normally. That is turn 2 of
the scenario and a separate probe arm, because the wrong rule passes every other check.

**THE REFUSAL CLASS WAS MEASURED RATHER THAN GENERALISED, AND THE MEASUREMENT SHRINKS IT.** Of every
legal item in `Dex.forFormat('gen9championsvgc2026regmb')`, exactly **75 declare an `onTakeItem` and
all 75 are mega stones** — there is no Z-crystal, no plate and no Griseous Orb in this format, so the
item half of the class IS the stones. The ability half is **Sticky Hold**, and two things about it are
worth writing down: it does NOT affect Knock Off's boost (the authority uses `singleEvent`, which runs
the item's handler only, never the ability's), and it carries **no row in `data/tags.json` at all** —
0 uses, unreachable from this format's species pool — so there is no shape to match on and naming it
would be the hand-typed list this project bans. Reported, not wired.

**FLING WAS A NO-OP TURN, WHICH IS A BIGGER FAULT THAN THE ONE REPORTED.** The brief said the item was
not consumed; the item was not consumed because the click never became an attack at all. Fling ships at
**base power 0** — the power IS the held item — and `hasPower()` rejected it, so `playerAction` fell
through to `{kind:'pass'}`. Same shape as ROADMAP #84's spread moves: a dex base power of 0 read as
"this move does nothing". `flingsOwnItem` now admits it, `flingable` carries each item's own
`{basePower, status, volatileStatus}`, and the throw resolves at `onPrepareHit` — above Protect, above
type immunity, above the accuracy roll — which is where the authority puts it and why a shielded Fling
has still spent the item.

**THE POWER AND THE DISPOSITION HAD TO LAND TOGETHER.** A fix that spent the item but kept a fixed base
power is wrong in a way the board shows, so the item's number is resolved and stamped BEFORE the item
goes and `flingBasePower` is the one reader both the click-time price and the hit-time damage ask. It
also returns 0 for a body whose item refuses the take, so the damage table stops offering a searcher a
Fling that cannot happen. Staged: Light Ball 30 BP **and its own paralysis on the target**, Iron Ball
130, empty hand 0, and a Charizard throwing its own stone fails outright while the identical stone on a
Sceptile flings at 80 and is gone.

**Step 3 of the authority's gate has no member here and is written anyway:** all 148 legal items carry
a `fling` entry, so "the item cannot be thrown" never fires in this format. A branch that is absent and
a branch that has nothing to refuse look identical from outside.

### THE PHAZE BRANCH WAS THE SIXTH SITE, AND THAT IS THE FINDING RATHER THAN THE FIX

Will: *"roar has super negative priority so switch happens first"*. Roar (454 uses), Whirlwind (25),
Dragon Tail (105) and Circle Throw are all **priority -6**, which makes a phaze the move in this format
most likely to find somebody else standing in the slot it named. WIRE 139 folded five branches into
`reaimToSlot` and **missed this one**: `const _t=a.target; const _i=_foes.indexOf(_t)` is a lookup of
the original OBJECT in the CURRENT active array, so a pivoted target scored -1 and the whole move failed
silently — our Roar dragged nobody. Staged before a line changed: Corviknight pivots out, Snorlax walks
in, Showdown drags Snorlax and puts Corviknight straight back while ours left Snorlax standing.

The damaging half (Dragon Tail, Circle Throw) was ALREADY right and was checked rather than assumed —
it iterates `targets`, which the attack branch has resolved through the shared reader since WIRE 139.
**Turn 3 is the counter-intuitive negative and it is on the same board:** Corviknight clicks Protect and
is Roared anyway, because Roar carries no `protect` flag.

**THE BENCH IS ONE BODY DEEP ON PURPOSE.** The drag is a uniform die in both engines, so a two-way bench
would part for a reason that has nothing to do with this rule; Weavile is knocked out on turn 1 and
Toxapex replaces it so the choice is forced. The same care is in the probe.

### WHAT THE HARNESS ITSELF GOT WRONG

A **multi-line break anchor cannot match**, because the files on disk are CRLF and the anchor was
written with a bare `\n`. It reported `matched 0 time(s)` — which `patchedSource` correctly refuses
rather than skipping, so the guard caught its own author. Every anchor in `tests/staged_board.js` is
one line for that reason now.

### THE RED GATES, SAID PLAINLY

`node tests/run-all.js` ends with **12 failures and not one of them is ENGINE's or new**. Named so
nobody has to re-derive them: `test-forced-switch`, `test-team-preview-race` and
`test-effective-identity`/`test-stadium-roster` neighbours fail on `ABRA_STRICT_SEMANTICS` — the
**refit owed on the same eight features** as at session start, unchanged by this work and MEASURE's to
clear. `test-no-silent-failure` names five catches in `engine/diff_swarm.js`,
`engine/explain_divergence.js` and `engine/leaf_engine_contrast.js`. `test-prng` names
`tests/test-protocol-trace.js`. `test-pin-arms` wants four arms in `data/game-differential.json` and
finds two. `test-stadium-roster` names `diff_swarm`, `leaf_engine_contrast` and `mega_decision_census`
as generators in neither ledger. `test-wiring`, `test-site-data-fresh`, `test-web-status`,
`provenance` and `validate_selfplay` are the standing WEB/OPS/MEASURE set.

**One of them has an ENGINE-owned contributor and it is reported rather than patched.**
`test-effective-identity`'s raw-read ratchet lists `tests/staged_board.js: 0 -> 13`. Ten of those
thirteen predate this session and all thirteen are **string literals inside break patches** — quoted
engine source handed to `String.replace`, not reads of a live Pokemon. The declaration table that
would say so lives in `tests/test-effective-identity.js`, which this division does not own, and the
gate is red regardless on `tests/roster.js: 0 -> 69`.

## THE DELIBERATE ROSTER — `tests/roster.js`. COVERAGE STOPS BEING A USAGE PRIOR. 2026-08-08.

Will: *"lets build the deliberate roster, every move item and ability"*.

**THE GAP, MEASURED FIRST.** Over the last 1,530-game differential run: 216 of 500 legal moves
connected (43%), 179 of 316 abilities (57%), 138 of 148 items (93%), 292 of 347 species (84%). **And
nothing decided that cutoff.** The run draws real ladder teams out of the store, so its coverage is
whatever people happened to bring — a usage prior doing duty as a test plan. Worse: of the 207 census
rows the artifact calls measurable, only 114 were exercised by a CONNECTED MOVE. The other 93 are
credited `present_on_the_field_only`, which means the item or ability was on a body and nothing more.
A Sitrus Berry sitting in a slot proves nothing about whether it fires at 50%.

**THE SCENARIO IS DERIVED, BECAUSE 964 HAND-WRITTEN ONES IS THE HAND-MAINTAINED-LIST FAILURE AT THE
LARGEST SCALE ANYBODY HAS ATTEMPTED IT.** Twenty-one SHAPE RULES read the entity's own upstream
fields — an item's `isBerry`, `naturalGift`, `megaStone`, `itemUser`, its handler names and its
one-line `shortDesc`; a move's `target`, `category`, `basePower`, `status`, `boosts`, `flags` — and
stage the condition that makes that shape fire. Membership falls out. Every entry prints the rule it
was staged by and what that rule read.

**EVERY ENTRY IS PLAYED TWICE.** Subject and CONTROL, identical script, one thing removed — the item
stripped, the ability replaced, the click replaced by an inert one. Four boards come back per
boundary, which is what makes the two interesting outcomes expressible at all:

| outcome | what it means |
|---|---|
| FIRED-AND-BOARDS-MATCH | Showdown's board moved, ours moved, and they agree leaf for leaf |
| FIRED-AND-BOARDS-DIFFER | both moved and they disagree, with the field named |
| **DID-NOT-FIRE** | **Showdown's board moved and ours did not.** The staging is known-good because the authority answered it. |
| COULD-NOT-STAGE | with a written reason — including *Showdown's own board is identical with and without it*, which is the fixture's own negative catching the fixture |

`--reds` breaks the simulator per SHAPE RULE rather than per entity, and a rule with no anchor must
DECLARE that the simulator has no implementation — checked, so a member that fires makes the
declaration false.

### STAGE 2 RESULT — all 148 legal items, release `3898951e7423`

`0 FIRED-AND-BOARDS-DIFFER · 8 DID-NOT-FIRE · 132 FIRED-AND-BOARDS-MATCH · 8 COULD-NOT-STAGE`,
14 of 14 breakable rules caught and localised, 3 no-anchor declarations verified.

**ROADMAP #28 IS CLOSED AND THE ANSWER IS THAT IT WORKS.** All eighteen resist berries halve the
right type, on a body x2 weak to it, with a second body of a different species holding the same berry
beside it taking a neutral hit that must NOT be halved — and both engines agree to the HP. 6,479
holders, and this is the first time anything confirmed it.

**EIGHT ITEMS DO NOTHING IN THIS SIMULATOR** (each with a Showdown board that moved and ours that did
not): **Iron Ball** (the Speed halving — Showdown's Charizard dies to a Glimmora it outsped without
it), **Light Ball**, **Shell Bell**, **Big Root**, **Metronome**, **Oran Berry** (its
`healsAtThreshold` param carries `restores: null` where Sitrus carries `1/4` — a tag-derivation gap,
not an engine one), and ~~**Lum Berry** and **Persim Berry** (neither cures confusion)~~ — **BOTH
CLOSED BY WIRE 142**, and both were the same tag-derivation gap rather than two engine gaps:
`curesVolatile` could not read a berry's `onEat`. Six items remain.

~~**AND THREE DIVERGENCES BELONG TO NO ITEM AT ALL**~~ — **TWO OF THE THREE ARE CLOSED BY WIRE 142**,
each with a staged board and a named control: the confusion counter now decays (it never existed —
the volatile was written and never read), and the sleep counter disagreed only on a turn the body was
ALSO flinched, which was an `onBeforeMovePriority` ordering bug. **Toxic Thread's Speed drop is still
open.** They were reported apart rather than charged to the berry that tripped over them — *a fix
aimed at the wrong mechanism is still a bug* — and that is exactly why the confusion row turned out
to be the berries' cause and the sleep row turned out not to be.

### THE INSTRUMENT WAS WRONG FIVE TIMES BEFORE THE ENGINE WAS, AND EVERY ONE IS ON THE RECORD

This division is warned that its probe fails toward a comfortable answer. It happened five more
times, and each is written into `tests/roster.js` beside the code that now prevents it:

1. **The control click restored the item under test.** `Recycle` is inert on a body that never
   consumed anything — which is exactly what the first selftest played. The moment a scenario made a
   body EAT something, `|-item|p2a: Goodra|Chople Berry|[from] move: Recycle` — and **all eighteen
   resist berries reported as engine defects on the `item` field**. The engine was right.
2. **The replacement control click manufactured guaranteed critical hits.** Focus Energy adds two
   crit stages; two stages on a `critRatio: 2` move reaches the tier Showdown rolls as
   `randomChance(1, 1)`, which no pin can stop. Wide Lens and Zoom Lens reported as defects on a
   14-HP gap that was `|-crit|`.
3. **A declared divergence was written from a report instead of from the boards** — "Showdown clears
   the item on faint" — and its own staleness check retracted it on the next run. Showdown's slot did
   not hold a dead Charizard; it held a live Milotic, which was the finding.
4. **Four stagings were inert and said so**: a lethal hit that was not lethal (Focus Sash, Choice
   Scarf), a Ghost click into a Normal body (Spell Tag), an Aurora Veil with no snow (Light Clay), a
   Normal click into a Ghost (Wide Lens), a Steel Beam that killed its own user.
5. **A finding was aimed at the wrong entity.** White Herb read DID-NOT-FIRE because the stat drop
   staged against it — Toxic Thread's — never landed. The herb is wired and correct.

Nothing in that list was found by reading the code. Every one was found by the control arm, the
fixture audit, the red demonstration or the staleness check, which is the argument for having them.

### THE 4x ARM, ADDED 2026-08-08 ON WILL'S ASK

The 2x arm above proves the berry halves. It does not cover **4x, which is where the berry decides a
game instead of shaving damage** — so where the format contains a body the chart puts at 4x AND the
unhalved hit would kill it while the halved one would not, that body is now preferred. **11 of the 18
berries run on a flipped-KO arm** (Chople into an Ice/Rock Avalugg-Hisui, 308 into 170 HP; Occa into a
Bug/Steel Scizor; Rindo into a Ground/Rock Rhyperior; and eight more). All 18 still match.

**AND A RATIO TEST ON A 4x HIT READS WRONG WHEN IT IS RIGHT — DO NOT ADD ONE.** The authority clamps
recorded HP loss at the target's maximum, so a Chople Kingambit reads `114/175` against `175/175` and
the naive ratio is 0.651 when the true damage is 228 and the halving is exact. **This file never
computes a ratio.** It compares BOARDS, and the boards say `fainted` and `species` — facts the cap
cannot distort. Seven berries stay on the 2x arm with the reason printed: Normal, Dark, Dragon, Ghost
and Electric have **no legal 4x carrier in this format at all**, and Steel and Water have one that
does not flip a KO.

**PROTOCOL NOTE FOR WHOEVER READS THE STREAM:** one berry emits **two** `-enditem` lines, `[eat]` and
`[weaken]`. Anything counting berry consumption off the protocol will double-count. This instrument
reads live state and is unaffected; `data/game-differential.json`'s protocol side and ROADMAP #80's
berry-disposition work are not.

### STAGE 3 RESULT — all 316 legal abilities, release `3898951e7423`

`2 FIRED-AND-BOARDS-DIFFER · 4 DID-NOT-FIRE · 31 FIRED-AND-BOARDS-MATCH · 279 COULD-NOT-STAGE`,
3 of 3 breakable rules caught and localised.

**THE BIGGEST NUMBER IN THIS STAGE IS ABOUT THE REGULATION, NOT THE SIMULATOR. 113 of the 316 legal
abilities have NO LEGAL CARRIER** — Showdown marks the ability standard and marks every body that has
it `isNonstandard: 'Past'`. Storm Drain's carriers are Gastrodon, Cradily and Maractus and all three
are Past here. The effective ability roster of this format is ~203, not 316, and nothing can be staged
for the rest at any price.

**TWO ABILITIES FIRE WHEN THEY MUST NOT**, and they are the same defect twice — a conditional
boost-on-being-hit whose condition is never checked:

| | Showdown | ours |
|---|---|---|
| **Anger Point** (needs a CRITICAL HIT; the pin never lands one) | 0 Attack | **+6 Attack**, off an ordinary hit |
| **Justified** (needs a DARK move; the staged hit was Poison) | 0 Attack | **+1 per hit**, off any hit |

**TWO ABILITIES DO NOTHING**: **Electromorphosis** (proved by a third-ability arm — Bellibolt's Damp,
Electromorphosis and Static control each other, and re-running each against the third gave *Damp vs
Static: 0 leaves in both engines*, *Electromorphosis vs Damp: 6 in Showdown, 0 here*), and **Fluffy**
— the delta sits on the carrier's OWN HP, which is a defensive damage reduction and not Sand Rush's
signature, and no sand is present. Fluffy is stated as an inference; Electromorphosis is a measurement.

**AND THE CONTROL ITSELF WAS THE SIXTH INSTRUMENT BUG, CAUGHT BEFORE IT WAS REPORTED.** 23 abilities
have no second ability to swap in — a mega forme's ability is WRITTEN by the forme change, and
Mimikyu, Morpeko, Palafin and Aegislash have exactly one each — so their only control is Gastro Acid.
**Gastro Acid does not suppress an ability in this simulator.** Measured against a known-live fixture
(Rough Skin, which scores MATCH under an ordinary control): suppressing it moves **6 board leaves in
Showdown and 0 here**. `data/tags.json` gives `gastroacid` a `statusInflict {volatile: gastroacid}`
and nothing reads that volatile to turn an ability off. Without that check, Fur Coat, Hunger Switch,
Parental Bond, Fire Mane and Spicy Spray would all have been published as DID-NOT-FIRE **for the
control's failure rather than the ability's**. The tier is closed with that as its written reason, the
gate is a MEASUREMENT rather than a constant so it reopens by itself the day suppression is wired, and
**the failure of the control is itself a finding** — the whole suppression class does not reach
abilities here.

**ALREADY CORRECT — 31**, including Intimidate, **Speed Boost with its entry gate**, Regenerator,
Imposter, all four weather setters, Huge Power, Sheer Force, Adaptability, Multiscale, Weak Armor,
Stamina, Rough Skin, Gooey, Toxic Debris, Sand Spit, Water Absorb, Water Bubble, Sticky Hold, Moody,
Refrigerate, Corrosion, Swift Swim, Sand Force, Supersweet Syrup, Stalwart and Shell Armor.

**WHAT STAGE 3 STILL CANNOT SEE, each counted and named in the artifact:** 124 abilities whose generic
staging is INERT (Showdown's own board does not move either, so a green would be vacuous — Blaze needs
1/3 HP, Chlorophyll needs sun, Berserk needs a threshold); 23 closed by the suppression gate; 10
chance-gated by the pin; 5 entry abilities on a carrier whose only control is a click, which cannot
come before boundary 0.

**OPEN WORK, NAMED RATHER THAN IMPLIED.** The residual rule's prose used to claim it staged the
`activeTurns` entry gate — the Speed Boost and Hunger Switch defect — and it does not: `--reds` proved
it by applying a break aimed at that gate and moving no board, because a LEAD is not newly switched and
this staging has no mid-turn entrant. The break is now aimed at what the staging can express and the
entrant arm is owed.

### ARM 1 — TWO MODIFIERS AT ONE STAGE. `--stage pairs`. 2026-08-08.

Every entry above stages exactly ONE thing, which is the shape a stage-FOLDING defect survives:
Showdown collects every handler at a damage stage into a single `event.modifier` and spends it once,
and an engine applying two separately lands a HP or two away. **475 pairs derived** — every base-power
item against every base-power ability one legal body can hold, restricted to moves inside both scopes,
nothing hand-paired.

`1 DIFFER · 0 DID-NOT-FIRE · 474 MATCH · 0 COULD-NOT-STAGE`.

**And the singles arm says the one hit is NOT a folding bug.** A differing pair is re-run with each
half alone, because "both together are wrong" and "one of them is wrong" are different findings:
`Black Glasses + Hustle` parts, and `Black Glasses only -> agrees | Hustle only -> PARTS`. **HUSTLE
does not apply its 1.5x Attack here** — 89 damage against our 60, a ratio of 1.48 — and stage 3 could
not see it because its generic staging came back inert. The pair arm found a single-entity defect the
single-entity stage missed, which is the argument for keeping it.

So on this release **the folding hypothesis is NOT reproduced by any of the 474 clean pairs**. The
Gallade / Iron Fist / Muscle Band case that motivated the arm is not in this membership (Iron Fist is
`onBasePower` on a carrier the format allows, but the pair's click has to sit inside both scopes and
Muscle Band's category scope selects a different move) — extending the membership to punch-flag moves
specifically is the first thing to do here.

### ARMS 5 AND 2 LANDED. 2026-08-08, on `{ sw: ... }` (3.76.2) and release `6b5447db1738`.

**ARM 5 — ACROSS A SWITCH.** `ability/residual` now starts the carrier ON THE BENCH and walks it in
MID-TURN, so boundary 1 IS its entry turn. That staging was impossible before a scripted switch
existed, and `--reds` had already caught this rule's prose claiming a gate test it could not perform.
**The break is now aimed at the gate itself** — `!m._newlySwitched` removed, so the effect fires
unconditionally — and it goes RED on `boosts.spe` via Speed Boost, which is the proof the staging
reaches `activeTurns` at all. Speed Boost MATCHES. `ability/entry` now switches the carrier OUT and
back IN, so boundary 0 is the first entry, boundary 1 the bench, and boundary 2 a SECOND entry.

**A NEW DIVERGENCE FELL OUT OF IT IMMEDIATELY, AND IT NEEDS TRIAGE RATHER THAN A DIAGNOSIS FROM ME:**
**Imposter** under the out-and-back arm parts on `species` — Showdown's slot holds Weavile and ours
holds Charizard, i.e. **the two engines brought in DIFFERENT BODIES on the same ask**. A transformed
Ditto no longer answers to its own species inside medicham2 (`tests/staged_board.js` scenario 17
records exactly that shape for the driver's replacement mirror), so the likely cause is the switch key
missing on a renamed body — the same class 3.75.1 fixed for the chooser. Reported, not fixed.

**ARM 2 — AT THE LINE.** `item/hp-floor` now puts BOTH cases on one board: Avalugg-Hisui at FULL takes
a lethal Flash Cannon and must survive, while Salazzle beside it — holding the same Sash, chipped 15
off 143 the turn before — takes a lethal Earth Power and must NOT. A floor that reads "not dead yet"
instead of "at full" saves the chipped one, which is a kill that is not a kill. Turn 3 is the third
negative: the survivor is on 1 HP with the item spent. Focus Sash MATCHES and the break is caught.
The chip is DERIVED (`chipFor` takes the smallest delivery move that moves HP without killing), so the
line is found rather than typed.

**STILL OWED ON ARM 2:** Sitrus at exactly 50% against 51%. `chipFor` gives the machinery; what is
missing is an exact-HP landing rather than a smallest-chip one.

**THE SUPPRESSION TIER DID NOT REOPEN.** A switch-in is a second control in principle, but the 23
entities there are SUPPRESS/MEGA-tier precisely because their ability cannot be swapped — switching
them in still brings the ability with them, so there is no arm without it. Gastro Acid remains the
only control and it still does not suppress here. Re-checked, not assumed.

### THE FIVE ARMS — WHAT IS LANDED AND WHAT IS OWED

| arm | state |
|---|---|
| 1. two modifiers at one stage | **LANDED** — 475 pairs, found Hustle |
| 2. threshold boundaries, AT the line | **OWED** — Sitrus at exactly 50% vs 51%, Focus Sash from exactly full vs one HP down. `HALVER` already derives a body/move pair by fraction; it needs an EXACT-HP variant that chips to the line first |
| 3. suppression fires when it must not | **PARTLY ANSWERED, AND THE ANSWER IS THAT IT CANNOT FIRE**: Gastro Acid does not suppress at all here (6 leaves against 0), which closes 23 abilities and is itself the finding. Mold Breaker, Neutralizing Gas, Simple Beam, Magic Room, Embargo and Klutz are untested |
| 4. 4x and 0.25x | **LANDED FOR THE BERRIES** (11 of 18 on a flipped-KO arm). Not generalised to Expert Belt, Tinted Lens or the 16 type-scoped items |
| 5. across a switch and across a faint | **LANDED for the switch** — mid-turn entrant and out-and-back, both red-demonstrated; it immediately produced the Imposter divergence. Across a FAINT is still owed |

**STAGE 4 IS NOT STARTED**: all 500 moves. Of the three divergences the item stage could not attribute
to any item, **two are closed by WIRE 142** — the confusion counter and the sleep counter, both with a
staged board, a named control and a red on release `6b5447db1738`. **Toxic Thread's Speed drop is the
one that remains** and is the first thing stage 4 should confirm.

## WIRE 138–140 — THE THREE LARGEST BOARD-DIVERGENCE FAMILIES, AND WILL'S SLOT-FIRST QUESTION ANSWERED YES. 2026-08-08.

Census **311 → 313 live**, `missing` **0**, `probed` 313. `tests/staged_board.js` **18/18 clean and
board-identical, 18/18 breaks caught and localised**. Aimed at the residue of the 1,530-game run at
release `288aee2e3501`: `active[].boosts.spe` (99 games), `active[].species` + `active[].maxhp`
(101 + 66), `active[].boosts.atk` (80).

### SAID FIRST: WHAT TURNED OUT NOT TO BE A DEFECT

1. **Mega evolution is right on the board.** `mega-forme-on-the-board` was IDENTICAL on its first
   run — species on the active slot AND the party row, `maxhp`, the stone still held, the partner
   holding a Gardevoirite that never asked left alone, and no second transformation on turn 2. It
   could not have been staged before the scripted mega opt-in landed the same night, which is why a
   26%-of-usage class had never been probed on a board. **And mega cannot be the `maxhp` half:**
   measured over all 76 base→mega pairs this format defines, **none changes the HP stat.**
2. **Cosmetic formes are a CONTROL, not a divergence.** `buildPair` writes `mcKey(p.species)` and
   hands the SAME resolved key to both engines, so a Sinistcha-Masterpiece is a Sinistcha on both
   sides. The hypothesis that our board said `sinistcha` where Showdown said `sinistchamasterpiece`
   is wrong, and it was checked before anything was written.
3. **The rest of the `activeTurns` class has no exposure here.** Will asked for the gate to be
   derived rather than special-cased. Every reader in the data layer: Speed Boost (854 uses), Slow
   Start (**0**), Stakeout (**0**), Truant (**absent**), plus Taunt's duration, which this engine
   already models, and two CAP abilities. Speed Boost is the whole live class.

### WIRE 138 — SPEED BOOST FIRED A TURN EARLY, AND THE COMMENT SAYING IT COULD NOT BE FIXED WAS OUT OF DATE

`if (pokemon.activeTurns) this.boost({spe: 1})` — `activeTurns` is set to 0 by every switch-in
(`battle-actions.ts:137`, leads included) and incremented in `nextTurn` (`battle.ts:1762`), which
runs after the leads. So a lead reads 1 during turn 1 and boosts; a body that walked in during turn
T reads 0 at that turn's residual.

The block here said the gate "IS NOT EXPRESSIBLE HERE AND IS LEFT OUT". That was **correct about
`_turnsOut`** — incremented after the residual, so a lead and a mid-turn entrant both read 0 — and
**wrong about the engine**, because WIRE 135 had since added `_newlySwitched`, set in `bringIn` and
cleared at the one point that opens a turn. A reason that was true when written and false when read.

`speedboost-entry-gate` puts TWO Speed Boost bodies on one side: Espathra from the leads and a
bench pair (Sharpedo and Scolipede, both carrying the ability so the scenario does not depend on
which one the driver brings in) behind a U-turn. Before: Sharpedo +1/+2/+3 against Showdown's
0/+1/+2. After: identical on all four boards, with the lead agreeing throughout — **the lead IS the
negative**, and the over-matching gate this engine rightly refused the first time parts on it.

### WIRE 139 — A MOVE TARGETS A SLOT, AND THE ENGINE AGREED IN TWO PLACES OUT OF SEVEN

Will, 2026-08-08: *"we gotta target slots, not mons, maybe that would help with things pivoting
out"*. **Established on a board before anything was rewritten**, which is what he asked for:

```
pivot-then-the-slot-is-hit    Weavile pivots out with U-turn, Toxapex walks in, Milotic's Charm
                              resolves afterwards
    SHOWDOWN  Toxapex is at -2 Attack        OURS  Toxapex is at 0 Attack
```

`Battle#getTarget` (`sim/battle.ts:2434`) is called from `runMove` at EXECUTION time and its normal
path is `pokemon.getAtLoc(targetLoc)`. The body the chooser had in mind is never consulted. This
engine's attack branch had that rule and WIRE 137 gave it to the status branch; the **generic-effect
branch, the pivot move's own stat drop, the pivot's Protect gate and the trace announcement** each
carried their own answer or none. So Charm, Fake Tears, Growl, Leer, Tickle and **Parting Shot
(7,184 uses)** dropped stats on a body sitting on the BENCH.

One reader now answers it everywhere — the FACTS-ARE-GLOBAL rule, which three copies of "who does
this move hit" had already broken. **The negative is `tracksTarget`**: Snipe Shot and a user holding
Stalwart or Propeller Tail keep their original body while it is active, which Showdown checks BY
NAME inside `getTarget` because the abilities implement it through `onModifyMove` and `getTarget`
runs first. Wired with the rule rather than after somebody notices; 44 uses.

**FILED, NOT FIXED:** an EMPTY aimed slot. Showdown falls through to `getRandomTarget` and redirects
a single-target move to the other foe; this engine fails the move, as both existing sites already
did. It is a different rule with a different negative and it must not ride along. Counted as
`MEDSEEN.reaimSlotEmpty`.

### WIRE 140 — ALLY SWITCH DID NOT EXIST, AND IT IS THE SHARPEST TEST OF WIRE 139

202 uses, resolving to `{kind:'pass'}` — a wasted turn. It is the one move that moves a body between
positions **without either body leaving the field**, so the weaker "has my target left" question
answers no and changes nothing; a Pokemon-first engine follows the wrong body and a slot-first one
does not, and neither can pass by accident.

Before the wire, one unimplemented move parted **ten board fields at the end of a single turn** —
both slots' species, hp, maxhp and Defence stage, plus two party rows. `swapsSlots` is derived from
the handler (an `onHit` that calls `swapPosition`); **membership over the whole move table is exactly
one move and was printed before anything read it.** The consecutive-use decay is its own counter
starting at 3 and tripling, NOT Protect's — sharing one would let a Protect last turn shrink an Ally
Switch this turn — and the refusal (an empty or fainted partner) is the census probe's control arm.

### WHAT THE HARNESS ITSELF WAS DOING WRONG

`tests/staged_board.js`'s declared-divergence proof ran against `zerotohero-moment`, **which WIRE 137
had fixed the night before** — so it printed `the proof case no longer parts` and, by its own rule,
declared every verdict below it untrustworthy. A guard whose fixture is a bug dies the day the bug
does. It now runs against a deliberately PLANTED break, which nothing ENGINE lands can take away.
Four break anchors had also gone stale and matched nothing, which reads exactly like a comparator
that found nothing.

### REPORTED, NOT MINE

`engine/game_differential.js` dies at pair-build time on any pool team carrying a species with no
`MC.mons` row: `LookupMiss: MC.mons: no entry for "florgesblue"`. `buildPair` is written
`mcKey(p.species) || id(p.species)`, expecting null, and `mcKey` THROWS unless handed
`{ mayMiss }`. One team in a pool of 7,635 ends an entire run. The data half (`data/engine-data.js`)
belongs to MEASURE; the throw-versus-null half is in a file this division may not edit while a
measurement is reading it.

Five silent `catch` blocks are NEW against `tests/test-no-silent-failure.js`'s baseline and none is
in a file this division owns: `engine/diff_swarm.js` (×2), `engine/explain_divergence.js`,
`engine/leaf_engine_contrast.js` (×2).

## The working rule

**A mechanic is not open work until a probe fails on it.** Everything in the generated block above
came out of an artifact; anything in the hand list below is a claim about the engine that nothing
checks. The job of that list is to empty itself — each item becomes a probe in
`tests/test-mechanics.js`, and from then on the census carries it and the line disappears from here.

That is the whole reason the census count may never fall: it is the only number in the project that
a human cannot quietly soften.

## WIRE 133–137 — THE TWELVE, THE TWO BOARD BUGS, AND A SPEED TIE THAT HAS BEEN WRONG SINCE THE FIRST DAY. 2026-08-07.

Census **298 live / 299 probed → 311 live / 311 probed**, `missing` **1 → 0** for the first time.
`armed` 311/311, `directCall` 0, `hollow` 0, `threw` 0. `MEDFAILS.traceBodyOffField` **25 → 0** on a
120-game reproduction. New gate: **`tests/test-speed-tie.js`**.

### SAID FIRST: WHAT TURNED OUT NOT TO BE A DEFECT

1. **`terrainSetter` was already live.** Five abilities, wired in `applyEntryEffects` since WIRE 31's
   neighbourhood and never probed, so nothing had ever shown it. The probe passed on its first run.
2. **`condStatMult` (Marvel Scale) was already live.** WIRE 112 wired the consumer against a STAGED
   tag; the tag landed later and nobody went back to prove the pair. It passed on its first run too.
3. **Disguise's HP model was right, and its stated REASON was fiction.** ROADMAP #89. Both engines
   end at 114/130, and the comment justifying that said Showdown reports 0 "only because this harness
   never calls `battle.update()`" — **a method that does not exist**, verified by enumerating the
   prototype. The real reason is in the ability's own source: `onDamage` returns 0 and sets
   `effectState.busted`, and the self-inflicted eighth is dealt in `onUpdate`, on the next update
   pass, as a SEPARATE damage event. A right answer resting on a false reason is worse than a wrong
   one, because the next reader re-derives from it.
4. **`Battle#comparePriority` was never the speed-tie problem.** See below — it is the SORT.

### THE SWITCH-OUT TRIGGER IS A CLASS, AND THE VOCABULARY HAD NO WORD FOR THE MOMENT

Will, 2026-08-07: *"ALL THE SWITCH OUT ABILITIES ACTIVATE ON SWITCH OUT LIKE REGENERATOR OR NATURAL
CURE OR ZERO TO HERO."* Measured against the authority — exactly three abilities in this format
declare `onSwitchOut`, and they are those three:

| ability | uses | before | after |
|---|---|---|---|
| Regenerator | 1,149 | `healsOnSwitchOut`, correct | unchanged, and deliberately left in its own block |
| Zero to Hero | 191 | `switchInForme`, fired on the **RETURN** | fires as the body **LEAVES**, and emits both lines |
| Natural Cure | 97 | `["untagged"]` — **absent entirely** | cures the status on the way out |

`healsOnSwitchOut` had been NARROWED (3 → 1) precisely to escape this over-match, and narrowing it
was right: a heal is not a cure. What was missing is the thing it was narrowed out of — the TRIGGER.
`switchOutTrigger` is derived from `onSwitchOut` and dispatches on a `does` read out of the handler,
so a fourth member arrives with the class. **An unrecognised `does` is COUNTED**
(`MEDFAILS.switchOutTriggerUnhandled`), because this is exactly where a silent default would sit.

**Emergency Exit and Wimp Out are NOT folded in.** They are `onEmergencyExit` — a HP threshold
crossed mid-turn, a different moment — and the predicate reads the one field.

### THE TWO BOARD BUGS, BOTH PROVEN ON THE BOARD RATHER THAN ON A PROBE

Will, 2026-08-07: *"IF THE BOARDS ARE THE SAME WE KNOW THAT IT DID HAPPEN CORRECTLY THATS THE WHOLE
POINT."* Both staged through `game_differential.js` in state mode, 393 fields compared per scenario,
Showdown as the expectation and no typed answer anywhere:

- **Zero to Hero** — Showdown transforms Palafin on switch-OUT (`|detailschange|p1a: Palafin|
  Palafin-Hero, L50`) and announces `|-activate|…|ability: Zero to Hero` on the way back IN. This
  engine transformed on the RETURN, inside `bringIn()`, and emitted NEITHER line. After the pivot,
  Showdown's party held `palafinhero` and ours held `palafin`. **Now IDENTICAL.**
- **Disguise** — the HP was exact and the SPECIES was never changed: Showdown's active slot AND party
  read `mimikyubusted` on both turns and ours read `mimikyu`. **Now IDENTICAL.** Derived from a new
  `formeOnHit` tag whose membership is exactly Disguise and Ice Face; the first predicate
  (`formeChange` anywhere in any handler) matched NINE abilities including Forecast, Flower Gift and
  Hunger Switch, and the membership was printed before anything was wired.
  **`data/engine-data.js` has no `mimikyu-busted` row**, which is downstream of this division. The
  artifact states `sameStats: true` and `sameTypes: true` for the pair, so the change is a RENAME and
  nothing else; a member with `sameStats: false` (Ice Face, 0 uses) is refused and counted rather
  than renamed wrongly. **That row is the one thing this pass owes MEASURE.**

### THE SPEED TIE — THE LARGEST FINDING, AND IT IS NOT AN INSTRUMENT BUG

**The two engines have disagreed about every speed tie for the life of this project.** Measured on a
staged pure tie (Volcarona vs Charizard, both 100 base Speed, both 120 exactly) under the
differential's own primary pin:

```
Showdown    |move|p2a: Charizard …   then   |move|p1a: Volcarona
medicham2   |move|p1a: Volcarona  …   then   |move|p2a: Charizard
```

It is not a corner case (ROADMAP #86: 91.4% of legal species share a base Speed with some other
species; the published run resolved 53,242 tied groups) and it is **not confined to the instrument** —
`sortTurnOrder` IS the live engine, so every rollout MILTANK has run and every live game resolved a
tied matchup to the wrong body.

**THE CAUSE IS THE ALGORITHM, NOT THE COMPARATOR.** `Array.prototype.sort` is STABLE, so a comparator
returning 0 leaves the two in input order. `Battle#speedSort` (sim/battle.ts:429) is a SELECTION SORT
whose swaps move UNTIED elements around, so the tied group's order when the shuffle finally sees it
is not the input order. In the trace above, the swap that lifted the faster Protect to the front is
what put Volcarona behind Charizard before either was compared. **No comparator can make a stable
sort produce that permutation.**

**AND THE OBVIOUS FIX IS WRONG.** "Take the later body" is what the AUTHORITY PRODUCES UNDER THIS
HARNESS'S PIN — which replaces `PRNG.shuffle` with a no-op — and it is not the game's rule. A real
`speedSort` ends in a Fisher-Yates over the tied group: **a speed tie is a coin flip.** Hardcoding the
pinned answer would make medicham2 match the differential and be wrong in every rollout and every
live game, and the differential would go GREEN on it — the fitting-environment-versus-playing-
environment error CLAUDE.md is built around.

So: the selection sort is reproduced line for line, and the residual tied group is ordered by the
per-action uniform key the file already drew. Sorting k items by iid uniform keys IS a uniform random
permutation, so under real dice this is the coin the authority rolls; under a CONSTANT pinned die
every key is equal, the group keeps the order the selection sort handed it, and that is exactly what
the neutralised shuffle does. **Neither engine is told the answer and both land on the same body.**

`tests/test-speed-tie.js` proves it on five arrangements chosen so a comparator REVERSAL — the shape
of the bug being replaced — fails: opposite sides, **the same two bodies with the teams SWAPPED**,
both tied bodies on ONE side, a THREE-way tie, and a no-tie control. All five AGREE. It also asserts
the tie is a coin under real dice (47–52% over n=400 across runs), which every board case would pass
on a hardcoded side, and prints a SENSITIVITY check showing the shipped sort and the stable sort it
replaces produce DIFFERENT orders on the same four actions — so the cases cannot quietly stop testing.

### THE TEN THAT HAD NO PROBE

| tag | uses | verdict |
|---|---|---|
| `randomBoostEachTurn` | 605 | wired — Moody, +2 and −1, accuracy/evasion excluded (the Gen 8+ rule), both draws taken before either is applied |
| `punishesBoostedTarget` | 219 | wired — the CONDITION is the mechanic, and `statsRaisedThisTurn` is answered from a turn-opening SNAPSHOT rather than from twelve instrumented raise sites |
| `switchInForme` | 191 | see the board bugs above |
| `instructsTarget` | 178 | wired — the only mechanic here that changes the ACTION COUNT of a turn; the repeat is QUEUED at `TURN_ORDER.next`, not executed inline, so it passes every gate a first swing does |
| `dualPurpose` | 139 | wired — an ally-aimed Pollen Puff used to deal 90 BP to its own partner, which is strictly worse than clicking nothing |
| `condStatMult` | 40 | already live, now proved |
| `swapsDefences` | 11 | wired — the STORED STAT is swapped and the BOOST STAGE is not, which is `Pokemon#getStat`'s own order |
| `sideBuff` | 8 | wired — and the tag had to be split first: Safeguard refuses a STATUS, Mist refuses a STAT DROP, and treating the class as one thing would have made Mist a second Safeguard |
| `suppressesItems` | 4 | wired — implemented as a SWAP of the item slot rather than as a gate through ~40 readers, with the residue (Knock Off inside the room) stated |
| `terrainSetter` | 2 | already live, now proved |

**`needsTargetToAttack` was the last MISSING row and the fix was a TAG before it was any code.** All
nine members carried the identical `{needs: "target attacking"}` and those nine DOUBLE, REFLECT, FAIL
or GO FIRST. `effect` and `when` are now read out of each member's own callback: Avalanche/Revenge
`damagedByTargetThisTurn`, Assurance `targetHurtThisTurn`, Payback `targetHasNotMovedYet`, Sucker
Punch/Upper Hand `failsOutright`, and Counter/Mirror Coat/Metal Burst `reflectsDamage` — **declared
and NOT modelled**, because the reflected number is a fact about a hit that already landed and this
engine holds no per-source damage ledger. `_hitBy` is a SET OF BODIES rather than a flag, because
Avalanche asks whether THE TARGET hit it and a boolean would double off the partner's Earthquake.

**ROADMAP #60 landed beside it**: `failsIfTargetNotAttacking` now carries `needsPriority` and
`minPriority`, read off `move.priority <= 0.1` in Upper Hand's own onTry, so the bot can stop
believing Upper Hand beats an ordinary Earthquake.

### `traceBodyOffField` 25 → 0, AND THE CAUSE WAS A STATE BUG WEARING AN ANNOUNCEMENT'S CLOTHES

Every `??` identifier in 120 self-driven games was a Life Orb toll, a recoil or the faint that
followed one, on a body that had **pivoted out**: the `pivotDamaging` switch sat ABOVE recoil, drain
and the orb, so a U-turn user paid all three from the bench. `useMoveInner` queues `selfSwitch` AFTER
`trySpreadMoveHit` and guards it with `else if (pokemon.hp)` — so **a Life Orb holder on a sliver of
HP that clicks U-turn dies to the orb and does not pivot.** This engine let it pivot and then killed
it on the bench, which is a different board and not just a different line. The last one was a status
move still aiming at a BODY rather than at a SLOT; the attack branch has re-resolved its aim since
voluntary switching existed and the status branch never did.

### WIRE 138 — DEFIANT FIRES ONCE PER **STAT LOWERED**, AND IT FIRED ON EXACTLY ONE ROUTE

Will, 2026-08-07: *"WHEN PARTING SHOT GOES INTO A DEFIANT OR COMPETITIVE MON IT GETS DOUBLE BOOSTS,
ONE FOR EACH DROP. I DONT THINK THATS THE CASE FOR CHARM BUT IDK."* **Both halves are right.** The
mechanism is the hook name: `Battle#boost` runs `runEvent('AfterEachBoost', …, currentBoost)` INSIDE
its per-stat loop (sim/battle.ts:2073), so `defiant.onAfterEachBoost` fires per STAT. Parting Shot
lowers two stats — `-1 +2 +2 = +3 Attack`. Charm lowers ONE stat by TWO stages, fires once, and the
`-2` cancels the `+2` exactly — **0**.

**THE COUNT WAS THE SMALLER HALF. THE ROUTE WAS THE BIGGER ONE.** The retaliation lived inside
`applyStatDrop`, and `applyStatDrop` is reached by Intimidate and Sticky Web and by nothing else.
Every MOVE-driven stat drop — Charm, Parting Shot, Icy Wind, Snarl, Growl, Breaking Swipe, Crunch's
secondary — resolved in branches that write `target.boosts[…]` directly and never asked the ability
anything. Measured before a line changed: **Parting Shot into a Defiant body read `-1,-1`, identical
to a body with the ability blanked.** On 7,661 Defiant sheets and 1,916 Competitive ones, the
Intimidate punisher did not punish anything a player actually clicks. It is now one shared reader
called at every site that lowers a stat, which is the FACTS-ARE-GLOBAL rule: whether an ability
retaliates is a fact about the game, not a property of the branch that happened to apply the drop.

Staged against the authority, 262 fields per case, **all IDENTICAL**, and the emitted stream
reproduces the measured log line for line:

```
partingshot-into-defiant      |-unboost|atk|1 → |-ability|defiant|boost → |-boost|atk|2
                              |-unboost|spa|1 → |-ability|defiant|boost → |-boost|atk|2
charm-into-defiant   NEGATIVE |-unboost|atk|2 → |-ability|defiant|boost → |-boost|atk|2   (net 0)
partingshot-no-ability CONTROL |-unboost|atk|1, |-unboost|spa|1, and nothing else
```

**The ally negative cannot be staged through this driver and is said rather than dropped**:
`scripted()` maps `t` to a FOE slot for a `normal`-target move and has no notation for Showdown's
`-2`, so "an ally lowering your stats does not trigger it" is unreachable on the board. It is covered
behaviourally by the census probe's fourth arm, which aims Charm at the user's OWN Defiant partner and
reads `-2` with no retaliation. Fixing the driver belongs to `game_differential.js`.

**A GREEN PROBE WENT RED AND IT WAS RIGHT TO.** The first cut passed `null` as Sticky Web's source,
reasoning that a layer outlives whoever laid it — and `stickyWebEntry` immediately failed. Showdown's
stickyweb condition boosts with `this.effectState.source`, so its `-1` Speed HAS a source and DOES
trigger Defiant. The setter is now recorded on the layer (`sf.hzBy`) exactly as `effectState.source`
holds it.

**THE SWEEP WILL ASKED FOR, REPORTED WITH ITS CAVEAT.** `partingshot.boosts` is `undefined` — it
applies its two drops in handler code, exactly as Curse did — while `charm.boosts` is a plain
`{atk:-2}`, so two moves a player thinks of as the same kind of thing have different shapes in the
source and only one is visible to a derivation reading static fields. Scanning every `on*` handler,
every secondary callback and every condition of every legal move in this format: **16 moves apply a
stat change in CODE, all 16 are in the format's table, and 7 carry `statChangeInCode`.** The nine
without it are `electroshot` (2,684), `clangoroussoul` (384), `kingsshield` (210), `stockpile` (50),
`stickyweb` (30), `fellstinger` (23), `meteorbeam` (11), `syrupbomb` (2), `magneticflux` (1).
**That is a count and NOT a defect list**: Clangorous Soul also carries a static `boosts` field so a
data reader sees it anyway, and King's Shield's drop belongs to `punishesContact`, Sticky Web's to
`hazard`, Electro Shot's and Meteor Beam's to `chargeTurn`, Fell Stinger's to its on-KO branch and
Syrup Bomb's to a residual — each is described by a sharper tag than `statChangeInCode` would be.
Stockpile and Magnetic Flux are genuinely undescribed at 51 combined uses. Reported, not fixed.

### THE RED GATES, SAID PLAINLY

`node tests/run-all.js` — **86 passed, 10 failed.** `tests/test-mutation-coverage.js` went from red to
green in this pass and the cause is worth recording: `S.sfA._S = S` (ROADMAP #81 WIRE 9's battle-state
back-reference) made the harness's own `projVal` recurse without bound, so EVERY arm of every case
read `THREW: Maximum call stack size exceeded` and the planted-stub gate reported `shipped = MISSING`
— which looks exactly like the harness failing to find an operator. Proven to be the instrument and
not the engine: the gate passes on release `032b4a2979dd` (pre-WIRE-9) and fails identically on
`dc3c43336539`, cut before this session. `_S` is now skipped beside `team`.

The other ten are **not this division's and each is attributed rather than filed**:

- `test-forced-switch`, `test-team-preview-race`, `test-wiring` fail ONLY under
  `ABRA_STRICT_SEMANTICS` and pass without it. Root: the **REFIT OWED** — the same eight features
  (`koTarget`, `dmgFrac`, `killIsRoll`, `killsThreat`, `switchSurvives1`, `switchKOSlow`,
  `switchDiesFirst`, `screenValue`) that `engine/status.js` already printed BEFORE this session
  began. MEASURE owns the refit and this division may not run one.
- `test-effective-identity` — the growth is `tests/staged_board.js: 0 → 12`, another division's new
  file. This pass's own two contributors (`engine/tag_dex.js` 8 → 10, `tests/test-speed-tie.js`
  0 → 1) are now DECLARED with construction reasons and no longer count.
- `test-no-silent-failure` — six new silent catches in `diff_swarm.js`, `explain_divergence.js`,
  `leaf_engine_contrast.js` and `staged_board.js`. None in a file this pass touched.
- `test-prng` — `tests/test-protocol-trace.js` multiplies by 1103515245 in float arithmetic.
- `test-site-data-fresh`, `test-web-status` — site bundles 1.2 days behind the store. WEB / OPS.
- `test-stadium-roster` — three generators owe `docs/MODELS.md` an entry.
- `engine/provenance.js` — 13 unsafe, 45 possibly stale, unchanged from the session's opening print.

## ROADMAP #92 — THE DAMAGE-STAGE CLASS. FOURTEEN MULTIPLIERS WERE AT THE WRONG STAGE AND FIVE WERE ABSENT. 2026-08-07.

Census **293 live / 294 probed → 298 live / 299 probed**, `missing` unchanged at 1 (Avalanche).
`armed` 299/299, `directCall` 0, `hollow` 0, `threw` 0. New gate:
**`tests/test-damage-stages.js` — 1,728/1,728 exact against the authority**, 54 scenarios x 16 rolls
x 2 crit states, plus the exact-4096ths table re-derived from the live dex and the narrowed
`damageBoost` membership printed and stage-checked.

The audit is `docs/DAMAGE-STAGES.md` (v3.71.0). This is the pass that landed it.

### SAID FIRST: WHAT TURNED OUT NOT TO BE A DEFECT

1. **The -ate abilities' rounding.** The audit filed the x1.2 as "right stage, wrong rounding —
   `floor` where the authority rounds half up". The stage was right and the rounding was NOT the
   problem worth naming: `pixilate.onBasePower` is `chainModify([4915,4096])` and
   `trunc(1.2 * 4096) = 4915` exactly, so the value was already right. The real defect was that it
   spent its own `Math.floor` instead of folding into the relay, which shows only when a second
   `onBasePower` member co-occurs. Fixed as a CHAIN member, not as a rounding change.
2. **Analytic and Sand Force do not need a 4096ths override.** Both are `[5325,4096]` in the dex and
   both were in the first draft of `CH_EXACT`. Neither is wired — their `damageBoost` carries a
   condition the tag states as prose — so an entry for either would have covered nothing while
   passing the table check. Removed; the table now names only what the engine actually spends.
3. **Terrain is NOT "in most games", and the audit had already corrected itself on this.** All
   terrain setters combined are 161 corpus uses against Fake Out's 15,106 — about 1%. It is landed
   for the MAGNITUDE where it does appear (a Grassy-Terrain Earthquake was priced at 118 against the
   authority's 60 — exactly DOUBLE), not for the frequency, and it is last in the order for that
   reason.
4. **The crit ARITHMETIC was right all along.** A plain `Math.floor(x * 1.5)`, never `md4096`, which
   matches the authority's own "crit — not a modifier" comment. Only its POSITION in the battle loop
   was wrong. Nothing about the fixed-point helpers changed.
5. **Spread, weather, the randomizer's position, STAB, the type chart, burn, Life Orb, Expert Belt,
   the resist berries, the screens and the four Ruin abilities were already correct** — and are now
   re-checked by the new gate every run, so they cannot silently stop being.

### THE DEFECT, ONCE

Showdown applies each multiplier at a STAGE — a base power, a stat, or the final damage — folds every
handler at that stage into ONE `event.modifier`, and spends it ONCE. This engine applied a third of
them at a DIFFERENT stage, and separately.

```
SHOWDOWN:  BP 85 -> x1.2 -> BP 102 -> base 72 -> STAB -> 108     Black Glasses is onBasePower
OURS:      BP 85 ->         base 61 -> STAB 91 -> x1.2 -> 109    we multiplied the FINAL damage
```

**WHY IT SURVIVED EVERY EXISTING CHECK.** BOTH engines "apply Black Glasses", so `test-mechanics.js`
saw it LIVE, the interaction matrix compares a RATIO between arms, `test-engine-diff.js` allows a 12%
midpoint band by design, and one point of damage rarely forks a whole game. It reached the surface
only as an unexplained "off-by-one" bucket — 58 games at turn 1.

### THE RED DEMONSTRATION

The frozen release `dc3c43336539` — the real pre-fix engine, not a synthetic mutation — against the
authority on the same scenarios, at BOTH endpoints only (its `dmgRange` has no per-roll output):
**37 of 50 comparisons disagree.** Selected rows:

| row | showdown | frozen engine |
|---|---|---|
| helping hand, Alakazam Psychic -> Snorlax | 108 | 73 |
| electric terrain, Pikachu Thunderbolt -> Snorlax | 43 | 34 |
| psychic terrain, Hatterene Psychic -> Snorlax | 94 | 73 |
| **grassy terrain, Garchomp Earthquake -> Snorlax** | **60** | **118** |
| misty terrain, Garchomp Dragon Claw -> Snorlax | 49 | 96 |
| steelworker, Kingambit Iron Head -> Snorlax | 147 | 99 |
| friend guard, Alakazam Psychic -> Snorlax | 55 | 73 |
| friend guard + life orb | 71 | 95 |
| black glasses, Kowtow Cleave -> Snorlax | 124 | 126 |
| technician, Scizor Bullet Punch -> Snorlax | 72 | 73 |
| **iron fist + muscle band** (each ALONE agrees) | **228** | **227** |
| thick fat, Charizard Flamethrower -> Snorlax | 31 | 30 |
| dry skin, Houndoom Fire Blast -> Heliolisk | 105 | 106 |
| crit, Kowtow Cleave -> Snorlax (dmgRange) | 157 | 105 |
| crit + sniper, Night Slash -> Snorlax | 195 | 87 |

Tough Claws, Sharpness, Charcoal and Supreme Overlord AGREE at both endpoints in that table and are
wrong in the interior — which is the whole reason the new gate walks all sixteen rolls.

**AND THE GATE WAS SHOWN RED BEFORE IT WAS TRUSTED.** Two deliberate reversions of this pass, each
run and then restored: putting the crit back to certain-crits-only took it to **864/1728**; putting
the type items back in the ModifyDamage chain took it to **1594/1728**. A gate that has only ever
been green is a gate nobody has tested.

### WHAT MOVED

**Into the `onBasePower` relay** (`_bpChain`, one spend, `battle-actions.ts:1650`): the 18 type
items, Muscle Band and Wise Glasses (from the final chain); Technician, Tough Claws / Sharpness /
Iron Fist / Mega Launcher / Strong Jaw / Punk Rock-offensive, Sheer Force, Supreme Overlord,
Expanding Force and Rising Voltage (from the base DAMAGE); the -ate x1.2 (from its own `Math.floor`);
Helping Hand (from the hit site); Dry Skin's `onSourceBasePower` (from the final chain). **Newly
present:** the four field terrains, each with the authority's own grounded subject.

**Into the two stat relays** (`_aCh` / `_dCh`, one spend each, `:1708-1709`): Thick Fat, Heatproof,
Purifying Salt and Water Bubble both ways; the narrowed `damageBoost` family. Choice items, Huge
Power, Guts, Solar Power, Orichalcum, Hadron, Marvel Scale, the Ruin four and the weather defence
bumps were already at this stage and now share the relay instead of spending twelve times.

**Into the final `ModifyDamage` chain:** Friend Guard (right stage, previously a SECOND spend beside
it) and Sniper (previously folded into the crit's plain multiply).

**Position:** the rolled crit's x1.5 moved out of the battle loop — where it multiplied a number
already rolled, STAB'd, type-charted, burnt and chain-spent — into `dmgRange`, before the randomizer.
`dmgRange` gained a seventh argument, `hit`, carrying the two facts only the hit site knows
(`helpingHand`, `allyDamageMult`) and an optional `rolls` out-array the gate reads.

### THE THING THAT WOULD HAVE MADE A HALF-FIX PASS

A stage fix that keeps one `Math.floor` per member passes every single-modifier test anybody writes.
Gallade Drain Punch into Snorlax with **Iron Fist AND Muscle Band**: authority 228, this engine 227,
while each one ALONE agreed. The gate carries nine two-member rows — one per stage, plus a row with a
member at every stage at once — and they are the rows that fail first if a per-member floor comes back.

### `damageBoost` IS STILL NOT WIRED AS A CLASS, AND THAT IS THE FINDING

44 abilities carry it. The param has **no stage** (Analytic/Reckless/Rivalry/Sand Force are
`onBasePower`; Steelworker/Transistor/Dragon's Maw/Rocky Payload/Stakeout/Hustle/Gorilla Tactics are
`onModifyAtk`) and **no condition** — Blaze, Torrent, Overgrow and Swarm carry
`onlyWhen: "only below 1/3 HP"` as PROSE. Wiring the class hands Blaze a permanent x1.5 on 5,808
sheets and DOUBLES the nine members already live under a sharper tag. The engine reads it only where
the shape is self-describing: a multiplier, a type, no weather, no condition, **and no other tag on
the ability**. Membership is printed by the gate rather than typed here — today **firemane,
dragonsmaw, rockypayload, steelworker, transistor**, all five verified `onModifyAtk`/`onModifySpA`
against the live dex, and the gate FAILS if a future artifact admits one that is not. All five are 0
corpus uses; they are wired because they are right, not because they move a number.

### WHAT IS NOT FIXED, NAMED

- **Charge (x2 on the user's next Electric move)** — the engine has no Charge volatile at all, so
  there is no state for the multiplier to read. One corpus click on the move, and Electromorphosis
  applies it too. NOT wired, and this is the reason rather than an oversight.
- **The grounded subject on `terrainScaled`** (Expanding Force reads the USER's feet, Rising Voltage
  the TARGET's) — unchanged, and still stated at the site. That tag carries `{terrain, mult}` and no
  subject. The FIELD terrains added this pass DO have the right subject, because their handlers are
  read directly rather than through it.
- **Rivalry** — still blocked on gender, which is not in `MC.mons`. Unchanged.
- **`data/tags.json` still stores 1.3 as a float** where the authority spells it `[5325,4096]`. The
  engine carries a four-entry `CH_EXACT` override and the gate re-derives every entry from the live
  dex every run, so it cannot go stale — but the artifact is the right long-term home. Filed.

## ROADMAP #81 WIRE 12 — FIVE DEFECTS OFF THE TURN-1 BOARD, AND TWO OF THE FIVE DIAGNOSES WERE WRONG BEFORE THE ENGINE WAS. 2026-08-07.

Census **281 live / 282 probed → 293 live / 294 probed**, `missing` unchanged at 1 (Avalanche).
Twelve probes added and one REWRITTEN because it asserted the wrong rule. `armed` 294/294,
`directCall` 0, `hollow` 0, `threw` 0. `tests/probe_red_demo.js` **177 → 185 demonstrations, 0
failed** — eight new source reversals, each one the exact line the wire changed.

**SAID FIRST, BECAUSE TWO OF THE FIVE THINGS I WAS HANDED WERE NOT DEFECTS AS DESCRIBED:**

1. **"Shed Tail and Baton Pass never switch because the tagger tests `selfSwitch === true`."** The
   tagger does not. `pivotStatus`'s derivation reads `m.selfSwitch &&` — truthiness — and then
   DELIBERATELY excludes the two string-valued moves, because they belong to `passesState`, which is
   a documented three-way split. Both moves carry `passesState` in the shipped artifact and always
   have. The tagger was right; **the engine had no consumer for the tag at all**, which is a
   different bug in a different file, and patching the two move names would have been a change with
   no effect.
2. **"The substitute doll is off by one and it may be confounded."** It is not confounded and it is
   not a Shed Tail problem — **ROADMAP #81 WIRE 7 was a REGRESSION on a mechanic that had been
   right.** That wire moved the doll from `floor` to `ceil` quoting `this.effectState.hp =
   Math.ceil(target.maxhp / 4)`. `data/moves.ts:18328` says `Math.floor`. Read out of the live
   volatile in a staged authority game rather than inferred from how many hits broke it: a 137 HP
   Heliolisk's doll is **34** and a 195 HP Farigiraf's is **48**, where ceil gives 35 and 49. The
   probe WIRE 7 wrote asserted the misquote and went green on it. Both roundings are now DERIVED
   (`substitute.rounds`, `costsUserHP.rounds`) so a third reading of that line by hand cannot happen.

**AND THE PERISH KO WAS NOT MISSING, WHICH WAS THE WORST CASE ON THE TABLE.** The question asked was
whether the KO had ever fired. It had — a turn early, which is a smaller finding and still a real one.

### 1. THE AURAS — FIELD-WIDE, BOTH SIDES, AND EXACT ON ALL TWELVE ARMS

`ability|auraBoost` was derived and read `used: false, uses: 0`. ROADMAP #64 called it a
*representational* limit — `dmgRange` is handed two bodies and a field with no occupants — and
routed rather than patched. **It is the shape WIRE 78 already solved for Air Lock: the FIELD carries
the answer.** `field.aura` is recomputed at the top of every turn from whoever is standing there,
exactly beside `field.wSup`, and no signature widens. A pure `dmgRange` call outside a turn still
gets its own two-body read, and the limitation is stated rather than silently equivalent.

Against the authority, stats aligned, roll pinned at both ends, partner aimed elsewhere:

| staging | medicham | showdown |
|---|---|---|
| Moonblast → Swampert, no aura | 111-132 | 111-132 |
| …Fairy Aura on the **attacker** | 147-174 | 147-174 |
| …Fairy Aura on the **defender** | 147-174 | 147-174 |
| …attacker aura **+ Aura Break on the foe partner** | 84-99 | 84-99 |

**12 of 12 arms exact**, across Moonblast, Light of Ruin and (for Dark Aura) Crunch.

- **THE HALF THAT HELPS THE OPPONENT IS THE HALF A FLATTERING FIX DROPS**, so it has both a probe and
  a red demonstration whose reversal is *holder-only* — the shape of the wrong fix — rather than
  *aura off*.
- **THE NUMBER IS 5448/4096, NOT 1.33.** The old derivation's regex needed a digit after
  `chainModify([`, and the handler is `chainModify([move.hasAuraBreak ? 3072 : 5448, 4096])`, so it
  matched nothing on all three members and fell through to a hand-typed `1.33` on the same line — a
  silent default wearing a derivation's clothes. `md4096(v, 1.33)` truncs to 5447/4096 and would have
  been wrong by one 4096th on every Fairy move in the format. The artifact now carries the PAIR, and
  the consumer REFUSES a bare float rather than reaching for it (`MEDFAILS.auraMultUnusable`).
- **AURA BREAK INVERTS, IT DOES NOT CANCEL** — 3072/4096 = 0.75, so a Fairy move under an aura AND a
  break is WEAKER than under neither. The number comes off the AURA's handler, not the breaker's.
- **ZERO EXPOSURE FOR TWO OF THE THREE, MEASURED AND STATED:** the only legal Fairy Aura body in this
  format is **Floette-Mega**; Yveltal (Dark Aura) and Zygarde (Aura Break) are `isNonstandard: 'Past'`
  and Zygarde-Mega is `'Future'`. They are wired because the engine matches on tag SHAPE and a family
  with a member left out is a list.
- **AND `fairyaura: uses 0` IS NOT EVIDENCE OF ANYTHING** — it is a MEGA's ability and never occupies
  a sheet's ability slot, the same trap as `used` being wrong in both directions. **The exposure is
  the STONE, and it is Floettite at 3,077 sheets**, not Gardevoirite at 412: `gardevoirite` evolves
  Gardevoir into **Pixilate**, and `floettite` evolves Floette-Eternal into the format's one Fairy
  Aura body. Read off the format dex rather than from the brief, which had the figure on the wrong
  stone — in the direction that UNDERSTATES it by 7.5x.

### 2. BATON PASS AND SHED TAIL — A TAG WITH NO CONSUMER, NOT A TAG WITH NO MEMBERS

Measured before a line changed: `playerAction` classified **Baton Pass as `pass`** — a no-op turn —
and **Shed Tail as `affect`**, which paid half the user's HP, built the doll, and left the user
standing there. Strictly worse than clicking nothing.

Will's spec, verbatim: *"SHED TAIL NEEDS A SUB"* and *"AND HP LOSS"*. All three fire now, in the
authority's order, because **the order decides what a failure costs**: `canSwitch` is asked FIRST and
is NOT_FAIL, so a Shed Tail with an empty bench costs nothing — paid before the check, it would have
charged half the user's HP for a switch that could not happen.

| staging | before | after | authority |
|---|---|---|---|
| Heliolisk (137 max) clicks **Shed Tail** | slot 0 still `heliolisk`, paid 68, doll 35 | slot 0 `emolga`, paid **69**, Emolga holds a **34** doll | 137 → 68, doll 34 |
| Heliolisk at **+2 Atk** clicks **Baton Pass** | nothing at all | slot 0 `emolga` at **atk +2**, paid 0 | Emolga at atk +2 |
| the same at +2 clicks **Shed Tail** | — | Emolga at **atk 0** with the doll | boosts explicitly NOT passed |

The split is `Pokemon#copyVolatileFrom(pokemon, switchCause)` — `if (switchCause !== 'shedtail')
this.boosts = pokemon.boosts` — read off the move's own `selfSwitch` string, so neither move is named
in the engine. Which volatiles travel is written out with each one's `noCopy` verdict beside it
(`_sub`, `_seededBy`, `_perish`, `_trap`, `_healBlock`, `_noSound`, `_ptDmg` carried; `_yawn`,
Encore's `_lock` and Disable's `_sealed` are `noCopy: true` and are not). A `taunt` seal lives in a
shared `_vol` bag and is left behind whole — **one volatile short of the authority, in the direction
that under-carries**, stated rather than discovered.

The COST ROUNDINGS are three different rules and the engine had one floor: Substitute and Clangorous
Soul trunc, **Shed Tail is `Math.ceil(maxhp / 2)`**. Derived now, per member.

### 3. CURSE IS TWO MOVES AND WE HAD NEITHER

Will: *"CURSE HAS TWO USES, MOSTLY BY NON GHOST TYPES TO BOOST ATTACK AND DEFENSE AND LOWER SPEED.
GHOST TYPES USES IT TO CUT SOME OF THEIR HP AND THEN THE TARGET TAKES RESIDUAL DAMAGE EACH TURN."*

Measured before the fix: **Farigiraf clicked Curse and the move did NOTHING** — 0/0/0 stages, no HP
paid, foe untouched. It fell to the `perTurnHP` status branch, matched nothing there, and returned.

| staging | before | after | authority |
|---|---|---|---|
| **Farigiraf** (Normal/Psychic) | at0 df0 sp0, paid 0, foe 0 | **at+1 df+1 sp−1**, paid 0, foe untouched | +1/+1/−1 on ITSELF |
| **Gengar** (Ghost), 135 max | at0 df0 sp0, paid 0, foe 0 | paid **67**, foe loses **45** this turn **and 45 the next** | 135→68, Garchomp 167→122 |

- **NEITHER HALF WAS DERIVABLE BEFORE.** `statChangeInCode` reads `onHit`/`onModifyMove`; Curse's
  boosts are assigned in `onTryHit` as `move.self = { boosts: {...} }`, which is neither hook nor a
  `this.boost(...)` call. New tag **`typeSplitMove`**, keyed on the DEX FIELD `nonGhostTarget` — not
  on a name. **Membership printed before wiring: exactly ONE move in this format carries it.**
- **AN UNPRICED CHIP IS WORSE THAN NO CHIP.** The 1/4-per-turn was already tagged and nothing paid
  for it; wired alone, Curse would have been a free permanent quarter-per-turn — strictly better than
  the real move, which is what a search learns to spam. The chip and the half-HP land together.
- **THE BRANCH IS ON THE USER'S TYPE AT THE MOMENT OF USE**, read at resolution rather than at
  classification, so Soak and Trick-or-Treat are honoured. **PROTEAN IS NOT, AND IT IS FILED RATHER
  THAN CLAIMED:** this engine converts only inside the `kind==='attack'` branch, so **no status move
  triggers Protean here at all**. A Protean body clicking Curse should become Ghost and take the
  Ghost branch; it does not, and that is a pre-existing gap this wire did not create.
- **SALT CURE carries the same `perTurnHP{effect:'damage'}` and is still not set anywhere** — it is a
  DAMAGING move, so its volatile belongs on the attack path, which is a different site. Visibly
  unwired rather than half-wired.

### 4. PERISH SONG — THE COUNTER, THE KO TURN, AND THE ESCAPE

Will: *"WELL IT SETS AND THEN IT FALLS TO 3 AT THE END OF THE FIRST TURN. MAKE A NOTE TO TEST THAT
PERISH SONG ACTUALLY KOS AT THE END OF IT."*

**THE KO HAS ALWAYS FIRED. IT FIRED A FULL TURN EARLY, ON BOTH SIDES, ON 1,141 CORPUS USES.**

| end of turn | before | after | authority |
|---|---|---|---|
| 1 | 2 | **3** | 3 |
| 2 | 1 | **2** | 2 |
| 3 | **0 — all four FAINT** | 1 | 1 |
| 4 | — | **0 — all four FAINT** | 0, faint |

`perishsong.condition.duration` is **4** and `Battle#residualEvent` decrements at the end of EVERY
turn including the one the volatile was added on. Both halves had to move together: setting 4 and
skipping the first tick agrees on turn 1 and drifts after, so the tick is probed beside the constant.
The `||3` fallback is gone — it was the wrong number AND a silent default.

**THE ESCAPE DID NOT EXIST AND NOTHING COULD SEE THAT IT DID NOT.** `_perish` was never cleared on
switch-out. A benched body is not in `[...actA,...actB]`, so the clock FROZE rather than ending — it
reads as working right up until the body returns and dies to a count it had already escaped. Staged
in the authority: a Primarina that clicks Perish Song on turn 1 and switches on turn 2 finishes alive
at 105/155 while its partner, which stayed, keeps counting down. `_yawn` is cleared beside it for the
same reason (`yawn` is a volatile; the `slp` it eventually applies is not).

Three probes, and the middle one is the one an off-by-one breaks: **alive at 3 AND dead at 4**.
Either alone is satisfied by an engine that is a turn out in one direction or the other.

### 5. WIRE 10's BOARD REGRESSION — IT IS ONE LINE, AND IT IS NOT A SPREAD BUG

The state ladder scored WIRE 10 at **−47 clean turn-1 boards and −56 clean games**, essentially one
field (`active[].hp`, 427 → 473 games wrong). The brief was to stage SPREAD moves, on the grounds
that WIRE 10 only altered the spread path and validated itself on single-target clicks.

**THE SPREAD PATH IS NOT WHERE IT IS.** Staged W9 against W10 against HEAD on **1,512 spread clicks**
— 21 spread moves × 6 attackers × varied ability, item, HP fraction and Protect — with the die held
constant, which is the regime the ladder actually runs in (`game_differential.js` pins BOTH engines'
dice, so draw COUNT is irrelevant). **W9 and W10 are byte-identical on all 1,512** at rng 0.5 and
0.02, and part on **8** at the ladder's own pin of `1 − 1e-9`. Of those 8, two classes:

- **an absorbing ability heals through a MISS.** W10 does, W9 did not. **W10 IS RIGHT** — Showdown's
  `hitSteps` are `[Invulnerability, TryHit, TypeImmunity, TryImmunity, Accuracy, …]`
  (`battle-actions.ts:556-568`), so TryHit resolves the absorb BEFORE the roll. Staged: a Muddy Water
  that misses still writes `|-heal|...|[from] ability: Water Absorb` for both bodies. **WIRE 10's
  step order is the authority's; that half of the rung is a straight win.**
- **the LIFE ORB toll is paid by a move that MISSED.** This is the regression.

| how the click fails | showdown | W9 | W10 | HEAD |
|---|---:|---:|---:|---:|
| **HIT (control)** | 13 | 13 | 13 | 13 |
| **MISS (Hydro Pump, 80 acc)** | **0** | **0** | **13** | **0** |
| type immunity | 0 | 0 | 0 | 0 |
| Protect | 0 | 0 | 0 | 0 |
| absorbing ability | 0 | 0 | 0 | 0 |
| Disguise (a hit that costs the target a fixed eighth) | 13 | 13 | 13 | 13 |

WIRE 10 moved the accuracy roll into the step walk — correctly — and the `continue` the old whole-move
roll carried went with it. That `continue` had skipped everything below the loop. The drain, the self
stat drop, the recoil, the crash and the pivot all have their own `dealt`/`connected` gates and are
all still right on a miss (measured, five more rows, all agreeing); **the Life Orb line never had
one.** Gated now on `_reached > 0` — Showdown's rule is `AfterMoveSecondarySelf` running inside
`spreadMoveHit`, i.e. at least one body was hit.

**AND THIS IS WHY WIRE 10's OWN CONTROL COULD NOT SEE IT.** That rung's evidence was *"36/36 staged
single-target clicks are byte-identical."* Every one of the 36 LANDED. The branch the change deleted
only exists when a move MISSES — and it is not spread-specific at all, it is **every missed move by a
Life Orb holder**, 12,804 corpus sheets.

**WHAT THIS DOES NOT CLAIM.** It is one line with the right shape, the right exposure and a red
demonstration; whether it recovers all 47 boards is a LADDER question and the ladder is not ENGINE's
to re-run. Filed for the next rung.

### THE ARTIFACT WAS REGENERATED, AND THE REASON IT COULD BE IS A DEFECT FOUND BY DIFFING IT

`data/tags.json` had been frozen since ROADMAP #65 — a regeneration silently dropped five entities
because `tag_dex` inherited `fit_policy`'s bo3-only corpus scope. **That is fixed** (`scope: 'all'`,
stated at the call site) and a candidate regeneration was diffed rather than accepted:
**0 entities lost**, `sheet_entries` 119,616 → 125,340, **+3 entities** (`aurabreak`, and the inert
`receiver` / `persimberry`), **23 entity diffs, every one accounted for**.

**ONE OF THE 23 WOULD HAVE DELETED MIRROR ARMOR, SILENTLY.** `preventsStatDrop`'s derivation matched
a bare `effect.name === '...'`, which cannot tell an INCLUSION from an EXCLUSION. The five Intimidate
blockers open `if (effect.name === 'Intimidate' && boost.atk) { … }`; Mirror Armor opens
`if (!source || target === source || !boost || effect.name === 'Mirror Armor') return;` — the exact
opposite. The artifact would have said `onlyFrom: 'Mirror Armor'`, and `statDropRefusal` gates on that
field, so the ability would have blocked only drops named "Mirror Armor" and therefore blocked
nothing. **No probe would have caught it and no engine line would have changed.** The pattern now
requires the match to close onto a BLOCK, `onlyFrom` comes back null for Mirror Armor, and the derived
membership is **exactly** `INTIM_ONLY_BRIDGE` — so the regeneration changes no stat-drop behaviour at
all. Found by the method ROADMAP #65 itself established: diff a candidate, do not accept one.

### GREEN, RED, AND WHAT WAS NOT RE-RUN

Run and green: `tests/test-mechanics.js` (293/294, 0 hollow, 0 unarmed, 0 directCall, 0 threw),
`tests/probe_red_demo.js` (185/0), `tests/test-engine-diff.js` (**1/150 at seed 20260804, the same
single pre-existing SUSPECT row — `chesnaught woodhammer -> mimikyu`, unchanged**),
`tests/test-game-diff.js`, `test-engine-consistency`, `test-medicham`, `test-protocol-trace`,
`test-tag-wire`, `test-tag-consumed`, `test-speed-multipliers`, `test-rollout-effects`,
`test-dead-volatile`, `test-priority-block`, `test-entry-effects`, `test-charge`, `test-choice-lock`,
`test-weather-duration`, `test-mega-timing`, `test-forced-switch`, `test-future-sight`,
`test-switch-features`, `test-artifact-keys`.

**ONE GATE IS RED AND IT IS NOT THIS WIRE'S.** `tests/test-effective-identity.js` fails its raw-read
ratchet on exactly one new entry: `engine/leaf_engine_contrast.js: 0 -> 1`. That file belongs to
MEASURE and was not touched here; none of `medicham2-browser.js`, `tag_dex.js`, `test-mechanics.js`
or `probe_red_demo.js` moved its own count. **Reported, not filed, and not fixed by ENGINE** — the
routing rule says a bug in another division's file gets named, not patched.

**`tests/test-wiring.js` WAS NOT RUN AND CANNOT BE, FROM HERE.** It spawns `engine/mew.js` self-play,
which ENGINE may not do. Six counters were added for the capabilities this wire arms — `auraApplied`,
`perTurnDamageChip`, `perishTicked`, `perishKO`, `perishClearedOnSwitch`, `passesStateSwitch`,
`passesStateBoosts`, `passesStateVolatiles`, `curseGhost`, `curseNonGhost` — plus three failure
counters (`auraMultUnusable`, `perishTurnsMissing`, `passesStateNoBench`). Every one is proven
non-zero by a probe that spends a real turn; the self-play floor belongs to whoever runs `mew`.

**THE REFIT DEBT DID NOT GROW.** `engine/feature_fixture.js` reports the SAME eight features with the
SAME before/after digests as before this wire started (`koTarget b6902f89050e -> fc2501572a6e`,
`screenValue 68d992e33616 -> b34d1b81da46`, and six more). `REFIT OWED` is exactly the debt MEASURE
already had.

**NOT RE-RUN, and the reason:** the whole-game differential, the interaction matrix and the release
ladder are long runs held by other divisions this session. The state ladder is the instrument that
found defect 5 and re-running it is what would prove the recovery; that is MEASURE's.

**FILED, NOT FIXED:**
- **`data/engine-data.js` has `floette-eternal-mega` with `ab: null, mv: []`** — confirmed against the
  live table. **The brief cited a ROADMAP number for this and that number is not in the register** —
  `docs/ROADMAP.md` §5 names 56 items and it is not one of them — so the defect is DESCRIBED here and
  deliberately not cited by number: a citation of an item that does not exist turns
  `tests/test-roadmap-register.js` red, and adding an entry to a cross-division register is not
  ENGINE's call. It needs one. `buildMon('floette-eternal-mega')` returns ability `''` and NO MOVES — a body that
  threatens nothing. Its sibling `floette-mega` recovers both through WIRE 132's fallbacks, so the
  aura probes use that key. `engine-data.js` belongs to MEASURE.
- **Protean does not fire on status moves** — see defect 3.
- **Salt Cure's `perTurnHP` volatile is still unset** — see defect 3.

## THE STATE DIFFERENTIAL — TEN WIRES WERE AIMED WITH AN INSTRUMENT THAT MEASURED ANNOUNCEMENTS. 2026-08-07.

Will: *"I MEAN DO WE CARE ABOUT SEMANTICS? ALL WE CARE ABOUT IS HP/ STATUS, ITEMS, MONS ALIVE AT THE
END OF THE TURN? ANNOUNCING IT DOESNT REALLY MATTER RIGHT?"* — then *"AND STAT BOOSTS/ DROPS"*, *"AND
FIELD CONDITIONS"*, *"TRAPPED STATUS"*, *"LEFTOVERS FIRING"*. And then, after a more correct engine
failed to predict better: ***"I ONLY CARE ABOUT TURN 1 TO START."***

**He was right about the instrument.** `engine/game_differential.js` compared the PROTOCOL STREAM and
had no end-of-turn state comparison in it anywhere — no HP, no status, no item, no boost, no
alive-count, at any boundary. The tell was in its own data: ten rungs moved the median
first-divergence LINE 13 → 19 and never once moved the median TURN off 1, and the rung that was purely
about announcement ORDER (WIRE 10) measured best of the last five on lines.

### THE HEADLINE

**The board at the end of turn 1 is identical in 56.0% of games at the pre-WIRE-1 baseline and 66.9%
at the top rung** (`dc3c43336539`, WIRE 10), peaking at **69.3% at WIRE 9**. 1,998 games per arm,
fourteen frozen releases, one pinned census, one frozen team store. Denominator is every game: a game
whose board parted at the LEADS, or that never reached a turn-1 boundary, counts against.

Turn 1 is the headline because **it is the only turn that begins from a board both engines agree on**.
Every later turn starts from wherever the run had already drifted, so a pooled per-turn rate is
contaminated by earlier error. Both are published: `agreement_by_turn` states its denominator at each
entry, `turn_boundary_agreement` pools and is kept beside it so the contamination is visible.

**THE MEDIAN WAS THE WRONG STATISTIC AND IT COST TEN REPORTS.** The median first-divergence turn read
1 at every rung and was read as "nothing moved" each time. The distribution is BIMODAL — whole-game
protocol agreement went 7 → 134 of 1,997 over the same series — and a median cannot move on a bimodal
distribution until half the mass crosses. A bounded turn-1 rate has no such blind spot.

### WHAT THE WIRES ACTUALLY BOUGHT

| | pre-WIRE-1 | top rung | verdict |
|---|---|---|---|
| board identical at end of turn 1 | 1119/1998 **56.0%** | 1337/1998 **66.9%** | real, and smaller than the protocol number implied |
| board identical at end of turn 3 | 562/1998 **28.1%** | 921/1998 **46.1%** | real |
| games whose board NEVER parted | 127/1998 **6.4%** | 312/1998 **15.6%** | real |
| protocol: games that never parted | 35/1998 **1.8%** | 206/1998 **10.3%** | flatters the series |

**The answer to "was most of two days announcement polish" is NO — but the protocol number overstated
the gain.** Protocol agreement rose 5.9x; the turn-1 board rose 1.19x.

### IS IT JUST SEMANTICS

At the top rung, **422 of 1,030 games (41.0%) whose NARRATION parted inside turn 1 reached an
IDENTICAL BOARD anyway**. By protocol class at the baseline, `ordering` is **179 of 257 games**
announcement-only, while `turn order` is **2 of 73** — turn order is real and ordering mostly is not.
That distinction did not exist before this pass and it is the actionable half.

### WIRE 10 IS A REGRESSION AND THE STATE INSTRUMENT IS WHAT SAW IT

WIRE 9 → WIRE 10 loses **47 clean turn-1 boards** (1384 → 1337) and **56 clean games** (368 → 312).
Diffed per field, it is one field: **end-of-turn-1 HP wrong in 427 → 473 games, +46**. Everything else
moved by ≤7 and several fields improved (`status` −7, `status_counter` −4, `boosts.atk` −3). The
protocol instrument scored WIRE 10 as an improvement (1795 → 1792 diverged, median line 18 → 19).
**The drift check resolves to zero** — the baseline release ran first and last, fourteen arms apart,
and reproduced every measured field exactly — so 47 games is far above this instrument's resolution
and cannot be called noise.

### THE COMPARATOR PROVES ITSELF BEFORE ANY BOARD IS SCORED

`engine/board_state.js` reads the board out of **both engines' live bodies** and opens neither
engine's log — deriving a board from the protocol would reproduce the original bug one level down.
The boundary is **after the entire residual phase**, which is the only place Leftovers, chip, the
toxic stage, Leech Seed, Perish and every ticking clock touch the board.

- **7 representation mappings**, each with a red demonstration in BOTH directions (it must collapse
  the pair it claims are one fact, and must NOT collapse the pair that are two).
- **25 planted state divergences**, one per compared field family, written into the LIVE medicham
  board at a boundary the clean arm agreed at. Each must be APPLIED, CAUGHT, at EXACTLY that boundary,
  and LOCALISED to the planted field. **25/25 on all fourteen arms.**
- `reader_failures` empty on all fourteen arms; both of medicham2's side-condition shapes readable, so
  the five pre-WIRE-8 releases are not scored as having no screens (which would have MANUFACTURED the
  rising ladder this instrument exists to test for).
- The party is keyed by **species, not index** — Showdown reorders `side.pokemon` on every switch-in,
  and index matching reported 123 of 179 games diverging on `party.species`, a manufactured divergence
  larger than anything real in the run. Guarded by `tests/test-state-differential.js` PART 3, which
  first proves the hazard is still live.

### THE LIGHTNING ROD CASE, BOTH HALVES

Reported by hand as a state bug: `|-boost|p2a: Raichu|spa|1` against `|-immune|p2a: Raichu|[from]
ability: lightningrod`. Staged for real (Rotom-Wash clicks Thunderbolt at a Lightning Rod Raichu), the
two protocol lines reproduce EXACTLY — **and the board is 131 of 131 fields identical. Raichu is at +1
Special Attack in both engines.** This engine emits an extra `|-immune|` line the authority does not;
the board agrees. With the boost then suppressed in this engine's live board at the same boundary, the
comparator reports `p2a raichu boosts.spa SD 1 US 0`, localised. **An announcement difference, not a
board difference — and that conclusion rests on a comparator shown catching the exact field it was
doubted on.**

### THE NEXT WIRE QUEUE, CHOSEN FOR THE FIRST TIME BY WHAT CHANGES A BOARD

Top rung, end of turn 1, by field (games), with the magnitude buckets kept apart because an HP off by
one is WIRE 4's fixed-point residue and an HP off by forty is a missing mechanic:

| games | field | how wrong |
|---|---|---|
| 473 | `active[].hp` | mostly off-by-4-or-more |
| 109 | `active[].item` | different-value / present-in-one-engine-only |
| 104 | `active[].species` | different-value — the two engines have DIFFERENT BODIES standing |
| 89 | `active[].maxhp` | travels with `species` |
| 81 | `active[].boosts.atk` | off-by-one |
| 32 | `active[].boosts.spa` | off-by-one |
| 24 | `active[].status` | present-in-one-engine-only |
| 15 | `active[].status_counter` | off-by-one |

Named cases, each with its seed, its config, its release and the team-pool digest that makes the seed
resolvable at all (before ROADMAP #87 the pool moved under a stored seed and nothing the instrument
reported could be replayed):

- **Perish Song counts 3 in Showdown and 2 here** on the turn it is set — 39 games in one shape, and
  the whole `vol.perish` family is off-by-one.
- **Curse does nothing** — Farigiraf reads +1 Atk / +1 Def / −1 Spe in Showdown and 0/0/0 here.
- **The Substitute doll is off by one** — 37 in Showdown, 38 here.
- **Toxic does not land** — `status "tox"` against `""`, with the HP difference that follows.
- **Disable persists here and not in the authority** — 0 turns against 4.
- **A body swap**: Showdown has Malamar-Mega standing where this engine has Palafin, with the item,
  maxhp and HP that follow.

### WHAT THIS DOES NOT MEASURE, SAID RATHER THAN LEFT AS AN ABSENCE

`NOT_COMPARED` is published with every artifact: ability trapping (medicham2 stores no trapped flag —
MOVE trapping IS compared, with its counter), item DISPOSITION (eaten vs knocked vs used), PP, and the
stall counter behind consecutive Protect. Each carries its reason in `engine/board_state.js`.

**Artifact:** `data/state-ladder.json` — fourteen arms, `source_digests`, the release id per arm, the
frozen team store's digests, the planted proof and the mappings. `data/wire-ladder.json` (protocol
only) is unchanged and is not replaced: the two answer different questions.

### THREE LADDERS WERE RUN AND TWO OF THEM WERE THROWN AWAY. THE DRIFT CHECK IS RED AND HERE IS WHY

**Ladder 1 was contaminated and is retracted.** `engine/game_differential.js` and
`engine/diff_swarm.js` were edited under it between arms 11 and 14 — ROADMAP #87's pool cache landing
mid-flight. Its own `inputs_that_moved` and drift check caught it. The edit was then proven
measurement-neutral by re-running arm 1 under BOTH instrument versions (every measured field
byte-identical; only a hand-declared `expect` string in one directed scenario moved) and the ladder was
re-run anyway.

**Ladder 2 ran clean end to end: the drift check REPRODUCED EXACTLY**, every measured field of the
baseline identical fourteen arms apart, per-game divergence depth identical game for game.

**Ladder 3 added `agreement_by_turn` for turns 1-12 and its drift check reads RED.** Diffed field by
field, the two baseline arms differ in exactly one place, and it is not a measurement:

```
declared_gaps.tags_release_matches_live    a01 true  ->  a14 false
```

**`data/tags.json` was rewritten by something outside this run at 18:14:50**, 476,130 → 452,721 bytes,
mid-ladder. The flag is a receipt saying the LIVE tags file no longer equals the one frozen in the
release. **Nothing measured moved:** every arm read the release's tags for the engine, every one of the
fourteen arms reported the same team-pool digest `32b2abcbfeb7`, all thirteen arms cleared
comparability, and the per-game depth is identical.

**And it is replicated rather than argued.** Ladders 2 and 3 are two independent fourteen-arm runs;
compared arm by arm on every measured field they are IDENTICAL, and ladder 2's drift check was green.
Ladder 2's per-arm artifacts are kept as the control.

**THIS IS NOT WAIVED AND IT IS NOT "KNOWN".** The gate is right to fire — a live `tags.json` diverging
from the frozen one means the swarm (which reads live) may stop matching the engine, and next time it
might. **The fix is not ENGINE's:** something regenerated `data/tags.json` against the live tree while a
measurement was in frame, which is CLAUDE.md's photograph rule, and `data/tags.json` regeneration is
already recorded elsewhere in this file as blocked on ROADMAP #65. Routed, not held.

**Filed, not fixed, and it is not ENGINE's:** `engine/status.js` reads `data/wire-ladder.json` and
knows nothing about `data/state-ladder.json`, so the generated block still reports the protocol ladder
alone. `status.js` belongs to MEASURE.

## ROADMAP #81 WIRE 11 — FOUR DEFECTS READ OFF REAL DIVERGENCES, AND TWO OF THE FOUR WERE NOT WHAT THEY LOOKED LIKE. 2026-08-07.

Census **270 live / 271 probed → 281 live / 282 probed**, `missing` unchanged at 1 (Avalanche, which
has its own verdict at the bottom of this file). Eleven probes added: **eight were written RED and
went green when the engine changed**, three were written for claims that turned out to be ALREADY
LIVE and are probed anyway so the census carries them. `armed` 282/282, `directCall` 0, `hollow` 0,
`threw` 0. `tests/probe_red_demo.js` **168 → 177 demonstrations, 0 failed** — seven source-reverted
demos and two controls.

**Every measurement below is STATE**, in HP, an item slot, a stat stage, or the Speed that decided
who moved first. No claim here rests on a protocol string except defect 3's order, which has no state
reading and says so.

### 1. THE SPREAD MODIFIER IS DECIDED BY TARGETS ENTERED, AND HALF OF IT WAS ALREADY RIGHT

`sim/battle-actions.ts:551` sets `move.spreadHit` from the array that ENTERS `trySpreadMoveHit`,
above the whole step list — so nothing a step does to that array can take the 0.75 back off.

| staging | before | after | authority |
|---|---:|---:|---|
| Dazzling Gleam → Archaludon, partner alive | 65 | 65 | 0.75 applies |
| …partner behind a **Protect** | **87** | **65** | 0.75 still applies — it is alive and still in the array |
| …partner **already fainted** | 87 | 87 | no modifier — `Side#allies()` filtered it before the array was built |

Observed live at 130/165 against our 118/165 — 35 against 47, ratio 0.745. Ours now reads 65/87 =
0.747. **The fainted-partner half was already correct** and for exactly the right reason: `live(foes)`
filters the same bodies `Side#allies()` does. It is probed rather than asserted, because the fix is
one line away from breaking it.

`smartTarget` (Dragon Darts) has no representation in this engine, so no exclusion for it is written.

### 2. WHITE HERB WAS NOT DOING NOTHING — IT WAS A WHOLE TURN LATE

The first diagnosis was wrong and the probe is what corrected it. **WIRE 56 had already wired what the
herb DOES**; it wired it at one trigger. `data/items.ts` gives whiteherb **four** — `onAnySwitchIn`
(priority -2), `onAnyAfterMega`, `onAnyAfterMove` and `onResidual` — and three were missing.

| staging | before | after |
|---|---|---|
| Sneasler Intimidated, read at the switch-in | atk **-1**, holding `whiteherb` | atk **0**, holding `` |
| same body, negative-only rule at the residual | atk +2 / spe 0 / def 0 | unchanged — this was WIRE 56's and is LIVE either way |
| Sneasler 100 Speed vs an Intimidating Incineroar at 150 on 1 HP | Sneasler **took 155** | Sneasler **took 0** |

The third row is the one Will named and it is the dangerous half: **losing the item is a SPEED TIER
CHANGE MID-TURN**, not an announcement. `unburden.onAfterUseItem` adds the volatile the moment the
herb is spent and the volatile is `onModifySpe -> chainModify(2)`, so 100 becomes 200, Sneasler moves
first, and the Incineroar dies before it acts. At the residual the item came off *after* the order had
already been spent. White Herb is **2,380** corpus sheets and Unburden **2,509**; `buildMon`'s own
usage set for Sneasler is Unburden **holding a White Herb**, so the pair is the common case.

`restoreStatsUpdate()`/`restoreStatsAll()` is the one implementation, called from the switch-in, the
mega, the after-action pass and the residual. Membership is the artifact's and was printed before it
was wired: **`restoresStats` matches exactly one item.**

### 3. THE CONTACT PUNISH FIRED BEFORE THE DAMAGE — AND THE STATE HALF IS THE `onFaintOnly` GATE

`spreadDamage` is step 2 of `spreadMoveHit` (`battle-actions.ts:1079`); `runEvent('DamagingHit')` is
four numbered steps later (`:1117`). WIRE 10 filed this and did not fix it because it changes
single-target order, which was that rung's control. It is fixed here.

- **The order.** Tyranitar Knock Off into a Rough Skin Garchomp: the damage lines were
  `attacker,target` and are now `target,attacker`, with the target's loss and the attacker's 1/8 toll
  identical in both builds (79 and 21). Rough Skin is **6,499** sheets.
- **The state.** Aftermath's own gate is `if (!target.hp && …)` — the HP **after** the packet landed.
  Read before the damage, the gate had to compare the RAW `dmg` against `tg.curHP`, which is the
  number **before** a Focus Sash or a busted Disguise cut it down. So:

| staging | before | after |
|---|---:|---:|
| Knock Off into a 20 HP Aftermath body, **no item** — it dies | attacker pays 43 | attacker pays 43 |
| same body holding a **Focus Sash** — it survives on 1 | attacker pays **43** | attacker pays **0** |

  43 is a quarter of Tyranitar's 175. Aftermath is only **3** corpus sheets — the ORDER is the
  valuable half and the Sash gate is the correct half.
- **The third claim was real in the authority and has NO state consequence here.** A dead attacker
  takes no further toll (`Battle#spreadDamage` returns 0 and emits nothing when `!target.hp`) and this
  engine had no `!m.fainted` guard. `curHP` clamps at 0 either way, so nothing moved on state; the
  guard is added because the LINE does. **Counted as a stream fix, not as a win.**
- **What did NOT move, checked rather than assumed:** the punish is still paid when the target dies
  to the packet. `runEvent` skips a handler whose holder is `fainted` (`sim/battle.ts:512`) and
  `Pokemon#faint` explicitly does not set that flag until the queue resolves.

### 4. A CRITICAL HIT IGNORES THREE THINGS AND MODELLED NONE. IT DOES NOT IGNORE BURN.

`moveHit.crit` sets both `ignoreNegativeOffensive` and `ignorePositiveDefensive`
(`battle-actions.ts:1683-1691`), applied as `ignoreOffensive = (… && atkBoosts < 0)` and
`ignoreDefensive = (… && defBoosts > 0)`. The stated blocker was that `dmgRange` recomputes A and D
without a crit flag; **`isCrit` is now its sixth parameter**, optional, and every pre-existing caller
gets exactly what it got before.

Meowscarada into Garchomp, Flower Trick (pCrit 1) against Knock Off (the plain physical control):

| staging | plain move | crit before | crit after |
|---|---:|---:|---:|
| baseline | 70 | 113 | 113 |
| attacker **Intimidated** (a real Intimidate, from the foe slot) | 47 | **76** | **113** |
| defender at **+2 Defence** | 36 | **58** | **113** |
| **Reflect** up | 47 | **76** | **113** |
| attacker **burned** | 35 | 56 | **56 — unchanged, and it must be** |
| defender at **-2 Defence** | — | 224 | 224 — a crit still takes a MINUS |

**Will named the trap and it is now a probe.** *"i dont think it ignores burn tho"* — correct. The
three rules operate on BOOST STAGES; burn's halving is an `onModifyAtk` multiplier and survives a
crit. Gen 2 ignored it, Gen 3 onward does not. A probe and a demo both go RED on any future engine
that "completes" the list with a fourth member.

**The crit ODDS were already right and were not touched** — `CRIT_BY_STAGE=[1/24,1/8,1/2,1]` matches
`critMult = [0,24,8,2,1]` for gen 7+.

**THE ROLLED CRIT IS RE-PRICED WITHOUT SPENDING A NEW DIE.** One `rng()` is drawn where it was always
drawn and is kept as an INDEX; if the crit lands, the same index is read off the crit range. So a crit
with nothing to ignore is **byte-identical** to the old arithmetic — asserted, not claimed:
`113 vs 113` under the reverted engine.

### THE ELEVEN PROBES AND THE NINE DEMONSTRATIONS

`tests/test-mechanics.js` — 8 red-first, 3 already-live:

| tag | probe | was |
|---|---|---|
| `spreadFoes` | a PROTECTING partner still costs the survivor the spread 0.75 | RED |
| `spreadFoes` | an ALREADY-FAINTED partner removes the modifier entirely | already live |
| `restoresStats` | White Herb clears the Intimidate drop and is consumed | RED |
| `restoresStats` | White Herb restores NEGATIVE stages only and leaves a positive one | already live (WIRE 56's residual) |
| `speedOnItemLoss` | losing a White Herb to Intimidate procs Unburden in the same turn | RED |
| `punishesAttacker` | Aftermath reads the post-Sash HP, so a survivor does not detonate | RED |
| `punishesAttacker` | the contact punish is paid AFTER the damage lands, not before | RED |
| `alwaysCrit` | a crit ignores the ATTACKER's negative Attack stages | RED |
| `alwaysCrit` | a crit ignores the DEFENDER's positive Defense stages | RED |
| `alwaysCrit` | a crit ignores Reflect | RED |
| `alwaysCrit` | a crit does NOT ignore a burn | already live — a guard, not a gap |

`tests/probe_red_demo.js` — seven `demoSource` cases plus **two controls**, and the second control is
the attribution claim the wire cannot make about itself: **45/45 ordinary clicks land in an IDENTICAL
state** under all three reversals applied at once, the stream moves on every unconditional-toll row
and on no reactorless row, and a ROLLED toll reorders at the roll that fires it.

### THE CONTROL FOUND A DEFECT IN ITSELF FIRST, WHICH IS THE POINT OF WRITING IT

The first cut of that control listed Static, Stamina and Weak Armor as "must reorder" and went red on
all three. Both reasons are real and neither is a probe bug in the ordinary sense:

- **Static's toll is a 30% roll.** On the pinned median die it does not fire, so two of its three
  cells are legitimately identical. It IS a reorder at roll 0, and that is now pinned on its own.
- **Stamina and Weak Armor did not move, and in the authority they should have.** See the filed item
  below.

### FILED, NOT FIXED — one residual, staged in the authority rather than guessed

**`buffsHolderOnHit` IS THE SAME EVENT AS `punishesAttacker` AND THIS ENGINE RESOLVES THEM IN TWO
DIFFERENT STEPS.** Stamina, Weak Armor and Rough Skin are all `onDamagingHit` in Showdown, which runs
**after** `runMoveEffects`, `selfDrops` and `secondaries` (`battle-actions.ts:1117`). WIRE 11 moved
`punishesAttacker` below the damage — which is the divergence that was observed and filed — but not
below the SECONDARIES, and it left `buffsHolderOnHit` where it was, at the top of `_stepEffects`.
So two things remain out of place: the punish is one step early relative to a contact move's own
secondary, and the buff family is in a different step from the toll family it shares an event with.

Closing it properly means a NEW per-row step after `_stepEffects` carrying both families, which moves
where every secondary on every contact move lands. That is a shape change of the same size as WIRE 10
and it must be its own rung, or the next ladder run cannot say which change moved it. Measured
exposure: the control above shows the buff family holding still on all 6 of its cells under a full
WIRE 11 reversal, so nothing here has drifted — it simply has not been done.

### Green, and what was NOT re-run

Run and green: `tests/test-mechanics.js` (281/282), `tests/probe_red_demo.js` (177/0),
`tests/test-engine-consistency.js`, `tests/test-medicham.js` (5/5),
`tests/test-engine-diff.js` (**1/150 at seed 20260804, the same single SUSPECT row —
`chesnaught woodhammer -> mimikyu`, unchanged**), `tests/test-game-diff.js` (all five scripted games
agree on every turn, and the injected-divergence proof still catches its plant), plus
`test-tag-wire`, `test-tag-consumed`, `test-speed-multipliers`, `test-rollout-effects`,
`test-dead-volatile`, `test-priority-block`, `test-entry-effects`, `test-charge`, `test-choice-lock`,
`test-weather-duration`, `test-mega-timing`, `test-forced-switch`, `test-future-sight`.

**ONE GATE WENT RED BECAUSE THE ENGINE GOT BETTER, AND IT SAID SO IN ITS OWN FAILURE MESSAGE.**
`tests/test-protocol-trace.js` PART 5 is the acceptance case for defect 4 and it asserted
`meIntim !== meCtrl` — *"either the declared crit limitation is gone (good news, and this test must
then be rewritten) or the Intimidate never landed."* The limitation is gone. The assertion is
**inverted** and the escape hatch in that message is **closed by a control**: "the two arms agree" is
satisfied just as well by a scenario that never staged the drop, so the `|-unboost|` line is now
asserted present in the Intimidate arm and absent from the Blaze arm, **on each engine's own stream**.
It reads `showdown 112/170 in both arms, medicham 111/170 in both arms`. The one-HP gap is the die
multiplicity difference that test's own header documents at length and is deliberately not asserted.

**THE REFIT DEBT DID NOT GROW, AND THAT IS CHECKED RATHER THAN HOPED.** `engine/feature_fixture.js`
reports the SAME eight features with the SAME before/after digests as it did before this wire started
(`koTarget b6902f89050e -> fc2501572a6e`, `screenValue 68d992e33616 -> b34d1b81da46`, and six more).
So WIRE 11 moved no value on the fixture board and `REFIT OWED` is exactly the debt MEASURE already
had. That is a fact about the fixture, not a claim that no feature can ever move: the fixture board
carries no guaranteed-crit move, no screen under a crit and no shielded partner, which is precisely
the surface this wire touched.

**NOT RE-RUN, and the reason:** the whole-game differential and the release ladder are held by other
divisions this session and were not touched. `tests/test-interaction-matrix.js --full` WAS run and
reads **1557/1574 live pairs (98.9%)** against a published **1624/1643 (98.8%)** — **the artifact was
NOT overwritten** (the shrink guard refused a smaller live count, correctly). That comparison is **not
attributable to this wire**: the published run is dated 2026-08-06 and predates WIRE 8, 9 and 10 as
well as this one. The one parting row that looked like it might be mine — `stoneaxe -> beakblast`,
`.B.active[0].hurt` — was played directly against an engine with **all three of this wire's reversals
applied** and is **byte-identical**, so it is not.

## ROADMAP #81 WIRE 10 — THE SHAPE LANDED AND THE MEDIAN TURN IS STILL 1. THE STOP TEST RETURNED A NEGATIVE. 2026-08-07.

**SAID FIRST, BECAUSE IT IS THE ANSWER THE RUNG WAS RUN FOR: THE MEDIAN COMPLETED TURN BEFORE
DIVERGENCE IS 1, AT THE BASELINE AND AT THE TOP RUNG, FOR THE TENTH CONSECUTIVE RUNG.** The largest
structural target in the differential landed, the cause family it was aimed at fell by 125 games, and
the number the whole series exists to move did not move. What that means is at the bottom of this
section and it is not "keep grinding".

Census **267 live / 268 probed → 270 live / 271 probed** (the three probes were written RED first and
are listed below; they read 267/271 with 4 missing until the engine changed). `missing` unchanged at 1
(`needsTargetToAttack`). 0 hollow, 0 unarmed, 0 direct-call, 0 threw. `tests/probe_red_demo.js`
**164 → 168 demonstrations, 0 failed** — three source-reverted, plus a CONTROL that is not a
demonstration and says so.

### ONE PATH OR TWO — ASKED BEFORE ANYTHING WAS BUILT, BECAUSE THE ANSWER DECIDES THE FIX

Showdown has no single-target path; it has an array of length 1. **Neither did this engine, and that
was the good news** — `targets = a.move.spread ? live(foes) : [aim]` has always produced one array and
one loop. What was not unified was the STEP STRUCTURE inside that loop, and at N=1 a per-target loop
is indistinguishable from a per-step one. So the fix is not "reorder the spread branch": it is that
the single loop becomes the step list, and the single-target case follows for free because at one
target the two loop orders are **the same permutation**.

That is why the control below could be stated as an equality and then measured rather than assumed.

### THE CONTROL, RESTATED AGAINST THE AUTHORITY AND NOT AGAINST OUR YESTERDAY

The dispatch said *"single-target damage must be byte-identical before and after"*, and that assumes
our single-target behaviour is correct — the same shape as a probe that asserts what the engine
already does. Restated and measured both ways:

| | before | after |
|---|---|---|
| `tests/test-engine-diff.js` — one hit against the authority | 1/150 disagree | **1/150 disagree, the same row** (`chesnaught woodhammer -> mimikyu`) |
| 36 single-target clicks × 3 rolls, shipped driver vs reverted per-target driver | — | **36/36 byte-identical**, stream and HP |

**IT DID NOT AGREE NOW IN ONE PLACE, AND THAT WAS A FINDING RATHER THAN SOMETHING TO PRESERVE.** The
accuracy roll was this engine's step 0 and is Showdown's step **4** — after invulnerability, TryHit,
type immunity and move-specific immunity (`sim/battle-actions.ts:555-577`). A target dropped by one of
those never reaches the die, so a Normal move thrown at a Ghost on a losing roll is `|-immune|` in the
authority and was `|-miss|` here, **at one target as much as at four**. That is the whole
`|-immune| <> |-miss|` family, it is single-target behaviour, and preserving it would have been the
scope rule protecting a bug.

**AND THE CONTROL CAUGHT ITSELF FIRST.** Its first cut listed `makeitrain` and `earthquake` among the
"single-target" clicks and reported five of them moving. Both are spread moves — the control was
measuring the one thing it exists to hold constant. Single-targetness is now ASSERTED per row (the
partner slot must take nothing and no `p2b` line may appear) instead of claimed by the name of the
list.

### WHAT CHANGED: THE ORDER IS DATA NOW, AND THE BLOCKS DID NOT MOVE

`trySpreadMoveHit` holds eight steps and each walks every target before the next begins;
`spreadMoveHit` (`:1023`) numbers six more inside the last. medicham2 now holds a `_STEPS` array of
nine closures and drives it with two nested loops:

```js
for(const _step of _STEPS)for(const R of _rows){if(R.out)continue;_step(R);}
```

The mechanic blocks stayed exactly where the file already had them — only their `continue` became
`R.out=true;return`. **The step ORDER lives in one array, as it does in the authority**, which is why
the gates could be re-sequenced into Showdown's order (invulnerability, TryHit, type immunity,
move-specific immunity, accuracy) without moving a line of the mechanics they contain. Reverse the two
`for`s and you have the engine as it stood through WIRE 9; that one-line swap is the known-bad build
every demonstration below runs against.

Staged in the authority before a line moved — Gholdengo's Icy Wind into two Milotic:

```
|-resisted|p2a: Milotic|1        <- every effectiveness line
|-resisted|p2b: Milotic2|1
|-damage|p2a: Milotic|160/170    <- then every damage line
|-damage|p2b: Milotic2|161/170
|-unboost|p2a: Milotic|spe|1     <- then every secondary
|-unboost|p2b: Milotic2|spe|1
```

against this engine's `eff(a) dmg(a) sec(a) eff(b) dmg(b) sec(b)`. It now prints the left-hand column.

### IT WAS NEVER ONLY A STREAM CLAIM, AND THE FIRST PROBE READS HP

`beastboost`/`eelevate` fire from `onSourceAfterFaint`; `AfterFaint` is run by `faintMessages`
(`sim/battle.ts:2598`), which `hitStepMoveHitLoop` calls **after the whole loop**
(`battle-actions.ts:972`). So a spread move that kills its first target cannot be holding a +1 when it
prices its second. This engine fainted, boosted, and only then priced — measured, not argued:

| Make It Rain into two Milotic | second foe took |
|---|---|
| first foe survives | 33 |
| first foe DIES (Eelevate) | **50** → now 33 |
| first foe dies, no ability | 33 (the control: the faint alone is not what moves it) |

### THE THREE PROBES AND THE FOUR DEMONSTRATIONS

| probe (`move\|spreadFoes`) | asserts | the arm that stops it being vacuous |
|---|---|---|
| *a spread move prices every target before any of them faints* | the second foe's HP loss | **the arms are NOT the two damage figures** — the probe asserts those are EQUAL and the harness would rightly call that hollow. They are `[second foe's damage, KO boost that fired]`: the varied knob is shown to have MOVED something (0 → 1 boost line) while the damage it must not reach stayed put. A third arm kills with no ability at all |
| *a spread move runs each step over every target before the next step* | the step shape `eff,eff,dmg,dmg,sec,sec` | the same click on ONE foe, whose shape must stay `eff,dmg,sec`. Without it "every eff precedes every dmg" passes vacuously on an engine that stopped emitting effectiveness lines |
| *a target that faints to a spread hit does not interrupt the other target* | `dmg,dmg,faint` | the same click with the first foe healthy: the shape must lose the faint and NOTHING else, and the survivor's HP loss is asserted identical in both arms |

The KO probe's first cut read the boost off `boosts` and reported **0 on the arm where the boost
demonstrably happened** — Eelevate raises the highest raw stat, which on Gholdengo is the same Special
Attack that Make It Rain drops by two, so a stage read off the body cannot tell "+1 fired and was
cancelled" from "+1 never fired". It counts the `|-boost|` line instead.

**FOUR REVERSALS IN `probe_red_demo.js` HAD TO BE RE-ANCHORED AND EVERY ONE OF THEM THREW FIRST**
(WIRE 126, WIRE 128, WIRE 129, WIRE 130 and WIRE 9's miss line). That is the guard working exactly as
its header promises: a patch that silently stopped matching would have made a broken engine look
fixed. Each reversal is unchanged in substance and re-pointed at the same site's new form.

### THE TABLE — 14 arms × 1,997 games, one pinned census, every arm COMPARABLE

`node engine/wire_ladder.js --write`, census pinned to `data/wire-ladder-census.pin.json`, new rung
`a13-wire10` on release **`dc3c43336539`**. The baseline ran first and last with twelve arms between
and **reproduced EXACTLY**. All 13 non-baseline arms comparable; **all 11 watched inputs
byte-identical before and after, and the three game stores were re-digested by hand around the run and
did not move.** The store HAS grown since WIRE 9's published run (1,996 → 1,997 games), so every figure
here is from THIS run and none of it may be compared against the WIRE 9 table.

| arm | div/1997 | agreed whole | causes | **medTurn** | median line | mean | vs previous rung (later/earlier/**net**) |
|---|---|---|---|---|---|---|---|
| baseline (pre-WIRE-1) | 1990 | 7 | 1171 | **1** | 13 | 14.78 | — |
| WIRE 7 | 1939 | 58 | 1293 | **1** | 16 | 28.79 | 541/178/**+363** |
| WIRE 8 | 1900 | 97 | 1381 | **1** | 16 | 31.22 | 390/185/**+205** |
| WIRE 9 | 1868 | 129 | 1336 | **1** | 18 | 33.24 | 490/177/**+313** |
| **WIRE 10** | **1863** | **134** | 1421 | **1** | **19** | **33.98** | 368/**265**/**+103** |
| baseline, REPEATED | 1990 | 7 | 1171 | **1** | 13 | 14.78 | — |

- **NET, THE ONLY HONEST FORM. Against WIRE 9: 368 later, 265 EARLIER, 1,364 unchanged — net +103**,
  median delta 0 lines. That is the **smallest net of the last five rungs**, and 265 is the **largest
  parted-EARLIER count anywhere in the ladder** (the previous high was 185). Against the baseline:
  1,295 later, 116 earlier — net +1,179, up from +1,161.
- Whole-game agreement **129 → 134**. Median first-divergence line 18 → 19, p75 41 → 42, p90 flat at 95.
- **THE TARGET FAMILY DID FALL, AND BY THE PREDICTED AMOUNT: `ordering` 440 → 315 games, −125**, and
  the `|-supereffective| <> |-damage|` shape the roadmap named is gone from its top causes entirely.
  What is left in `ordering` is sandstorm residual order (11), the Rough Skin toll (16, filed below)
  and `-unboost` body order (8).
- **AND `extra event emitted by medicham2` ROSE 140 → 266, +126, which is very nearly the same count.**
  Said rather than buried: the two are close enough that the honest reading is that a large part of the
  `ordering` fall was RECLASSIFIED rather than removed. The classifier decides between "same events,
  different order" and "we emitted something they do not have here" from the surrounding window, and
  the window is exactly what this wire changed. The paired count (+103) and the whole-game agreement
  (+5) are the figures that cannot be reclassified, and they are what the rung is worth.

### THE NEW TOP OF THE FILE, READ OFF THIS RUN'S OWN TOP RUNG

Largest single named cause is unchanged from WIRE 9: **`|-end|pXX|throatchop <> |upkeep`, 36 games**
(3,167 uses) — the Throat Chop silence expires and this engine announces nothing. Then
`|-activate|pXX|feint` 27 (437 uses) and `|-enditem|pXX|whiteherb` 8 (2,380). The `ordering` class is
no longer led by the spread-move shape; it is led by an 11-use sandstorm residual.

### FILED, NOT FIXED — three residual orderings, each staged in the authority rather than guessed

Mixing these in would have made the rung unattributable, which is the misattribution the ladder exists
to prevent. All three are order WITHIN a step, not the shape of the step list.

1. **THE CONTACT PUNISH IS PAID BEFORE THE DAMAGE AND SHOWDOWN PAYS IT AFTER THE SECONDARIES.**
   **CLOSED AT ROADMAP #81 WIRE 11, 2026-08-07 — the half about the DAMAGE. The half about the
   SECONDARIES is still open and is re-filed at the top of this file, together with the discovery that
   `buffsHolderOnHit` shares the same Showdown event and is in a different step here.**
   `runEvent('DamagingHit', …)` is the last thing `spreadMoveHit` does; this engine's punish block sits
   above `tg.curHP -= dmg`. Staged, Knock Off into a Rough Skin Garchomp:
   `|-damage|p2a: Garchomp|137/183` then `|-damage|p1a: Incineroar|149/170|[from] ability: Rough Skin`.
   It is 16 games of the surviving `ordering` class (`|-damage|pXX <> |-damage|pXX|[from]roughskin`,
   6,499 uses). Not moved because it changes SINGLE-TARGET order, which is the control.
2. **A MOVE-LEVEL `self` DROP IS EMITTED AFTER THE FAINT AND SHOWDOWN EMITS IT BEFORE.** `selfDrops` is
   step 4 and `faintMessages` runs after the loop. Staged, Make It Rain killing its first target:
   `-damage, -damage, |-unboost|p1a: Gholdengo|spa|2, |faint|p2a`. This engine writes the `-unboost`
   after the faint. Order only — the state is identical.
3. **THE RESIST BERRY IS SPENT IN THE APPLY STEP AND SHOWDOWN EATS IT INSIDE `getDamage`.** So on a
   spread move its `[eat]`/`[weaken]` pair falls between the damage lines instead of beside the
   effectiveness lines. Single-target order is unaffected, which is why it was left.

### Green, and what was NOT re-run

Run and green: `tests/test-mechanics.js` (270/271), `tests/probe_red_demo.js` (168/0),
`tests/test-engine-diff.js` (1/150, unchanged row), `tests/test-game-diff.js` (all five scripted games
AGREE for every turn), `tests/test-game-differential.js` (ALL PASSED), `tests/test-protocol-trace.js`
(ALL PASSED), `tests/test-charge.js` (18/0), `tests/test-medicham.js` (5/0),
`tests/test-engine-consistency.js`, `tests/test-priority-block.js`, `tests/test-choice-lock.js`,
`tests/test-dead-volatile.js` (15/0), `tests/test-forced-switch.js`,
`tests/test-no-silent-failure.js` (0 new), `engine/conformance.js` (RATCHET 96 baselined, **0 new**).

`tests/test-interaction-matrix.js` was run at its DEFAULT depth only — 350/354 live cases agree
(98.9%), and **all four partings are already in the published deep artifact** (`upperhand->steadfast`,
`yawn->insomnia`, `fakeout->shielddust`, `throatchop->shielddust`), so there is no new disagreement at
the depth that was run. It correctly REFUSED to overwrite the 1,643-case artifact with a 354-case one;
the published matrix figure is therefore still WIRE 9's and says so in its own stamp.

**RED AND NOT MINE, NAMED RATHER THAN FILED:** `node engine/status.js`'s FEATURE SEMANTICS CHECK fails
on eight features (`koTarget`, `dmgFrac`, `killIsRoll`, `killsThreat`, `switchSurvives1`,
`switchKOSlow`, `switchDiesFirst`, `screenValue`). It was red on eight before this session and is
recorded as such in the WIRE 9 entry below. Every one of them is damage-derived through `dmgRange`,
which this wire did not touch, and both damage instruments say damage did not move. It is a REFIT, it
belongs to MEASURE, and ENGINE may not run one — so it is reported, not filed.

### THE MEDIAN TURN, SAID PLAINLY — AND THIS IS THE STOP TEST'S ANSWER

**Ten rungs. ~1,180 net games parting later. Whole-game agreement 7 → 134. The median completed turn
has never left 1, including at the rung built specifically to move it.**

WIRE 9 predicted that the remaining mass was a SHAPE and that one restructure was worth more than the
next five mechanics. **The shape was real, it was fixed, and it bought +103 net games — the smallest
rung of the last five.** The prediction was wrong, and the way it was wrong is informative: the
`ordering` class fell by exactly what was forecast, and the median turn did not care.

**So the differential should stop being ground.** The reading is that the median game parts inside turn
one on something that is NOT a mechanic and NOT the hit shape — 1,863 of 1,997 games still diverge, on
1,421 distinct causes across 25 classes, with the largest single cause worth 36 games. **That is a long
tail with no head left.** Nine mechanic wires and one structural wire have taken the head off; what
remains is 1,400 causes each worth one or two games, and the arithmetic of that is that the next
mechanic is worth ~0.1% of the corpus.

Two things follow, and neither is another wire:

- **THE MEDIAN TURN MAY BE THE WRONG INSTRUMENT, AND THAT IS TESTABLE.** A game parting at line 19 of
  turn 1 and a game parting at line 95 of turn 1 are both "turn 1", and the line moved 13 → 19 while
  the turn sat still. If turn-1 line depth is what actually predicts whether a ROLLOUT is faithful,
  then the series has been succeeding against a statistic that cannot see it. Nobody has measured
  which of the two predicts rollout fidelity, and until somebody does, "the median turn is 1" is a
  fact whose CONSEQUENCE is unknown.
- **THE DIFFERENTIAL IS NOT THE ONLY INSTRUMENT AND IS NO LONGER THE SHARPEST.** The generated
  interaction matrix reaches 1,643 pairs and disagrees on 19; the mutation harness asks whether a
  handler MATTERS rather than whether it fires. Both are cheaper per finding than a rung that moves
  the corpus by five games.

**This is a clear negative on the largest structural target and it is worth more than another +300
net.** It is not a reason to stop fixing the engine; it is a reason to stop letting the whole-game
differential choose what gets fixed.

## ROADMAP #81 WIRE 9 + ROADMAP #84 — THE LARGEST SURVIVING CAUSE WAS NOT AN ANNOUNCEMENT BUG. A FIFTH OF EVERY DAMAGING CLICK IN THE FORMAT WAS A NO-OP TURN. 2026-08-07.

Census **265 live / 266 probed → 267 live / 268 probed** (it opened at 262/263; the three WIRE 9
probes and the two ROADMAP #84 ones were written RED first and are listed below). `missing` unchanged
at 1 (`needsTargetToAttack`). 0 hollow, 0 unarmed, 0 direct-call, 0 threw. `tests/probe_red_demo.js`
**157 → 164 demonstrations, 0 failed**, seven of them new.

### THE COLUMN ORDER, STATED BACK AND THEN STAGED

`classify()` returns `cause: cls + ' :: ' + gen(sdHead) + ' <> ' + gen(meHead)`
(`engine/game_differential.js:1145`). **LEFT IS SHOWDOWN, RIGHT IS MEDICHAM2.** So
`|-miss|p2a|p1a <> |-fail|p2a` reads *Showdown wrote `-miss` with a target; we wrote a bare `-fail`*
— the roadmap's reading, not WIRE 8's. It was not believed off the source: a case was staged and
`meRaw` read back as literally `|-fail|p2a: Charizard` against Showdown's
`|-miss|p2a: Charizard|p1a: Aerodactyl`.

### CLAIM 1 WAS TRUE AND WAS THE SMALL HALF. THE FAMILY IS A STATE BUG.

`playerAction`'s damaging branch was `if (mv && hasPower(mv) && target)`, because `dmgRange(me,
target, …)` needs a defender to price the click. **A spread move has no target to name.** Showdown's
own request carries no target field for `allAdjacentFoes` or `allAdjacent`, so every driver that asks
the authority what is legal correctly hands this engine a `null` — and the click then fell through the
entire status chain and came out as `{kind:'affect'}` (Heat Wave, Rock Slide, Snarl: anything with a
secondary, emitting the bare `|-fail|` the ladder saw) or `{kind:'pass'}` (Earthquake, Dazzling Gleam,
Make It Rain: emitting nothing at all).

**33 legal moves and 56,524 corpus uses — 20% of every damaging click in this format — dealing ZERO.**
Measured against the format rather than remembered:

| Showdown `target` | moves | corpus uses | this engine |
|---|---|---|---|
| `normal` / `any` | 282 | 237,947 | fine — the target is named |
| **`allAdjacentFoes`** | 19 | **47,549** | **no-op turn** |
| **`allAdjacent`** | 14 | **8,975** | **no-op turn** |
| `randomNormal` (Outrage) | 6 | 92 | still refused, now COUNTED |
| `scripted` (Mirror Coat) | 4 | 42 | still refused, now COUNTED |

It only reached the ladder as a PROTOCOL divergence because Mode A pins every sub-100-accuracy move to
MISS on both sides — so the 90-accuracy spread moves parted on a stream line while the 100-accuracy
ones (Earthquake 7,913 uses, Dazzling Gleam, Make It Rain, Discharge, Surf) were quietly dealing
nothing.

**AND IT HAD BEEN SEEN ONCE AND FILED AS A SCENARIO PROBLEM.** The ROADMAP #68 session recorded
*"Icy Wind was clicked with no target, so `playerAction` classified it as a non-attack and `-unboost`
never fired"* — under a heading saying the fault was the SCENARIO and not the trace (this file, the
protocol-trace section). Icy Wind is `allAdjacentFoes`. The observation was right and the diagnosis
inverted it.

**THE TURN LOOP NEVER NEEDED THE TARGET:** it resolves `targets = a.move.spread ? live(foes) : [aim]`,
so the aim is discarded for exactly this family. The fix reaches the board through `liveFoesOf()` — the
battle state is now stamped on the per-side object that already carries the party and the death counter
by reference — and prices `d`/`acc` against the body the move hits hardest, which is what
`targetForMove()` already does for the Choice lock. **A single-target click with no target is still
refused**, because Showdown rejects that choice and aiming it would invent a decision nobody made; it
is counted in `MEDFAILS.damagingClickWithoutTarget` rather than swallowed.

**The announcement half is real too and is now per target.** `hitStepAccuracy` writes
`add('-miss', pokemon, target)` inside the per-target loop (`sim/battle-actions.ts:738`); this engine
wrote one line with an EMPTY target field. **The one-roll-per-move divergence is unchanged and is not
widened** — with a single roll every target missed, so the list is complete.

### CLAIM 2 — ROADMAP #84. THE ENGINE COULD NOT REPRESENT THE SPLIT, AND THE REASON IS WORSE THAN ONE BOOLEAN.

**IT STORED NOTHING.** Not one boolean, not a field. `moveResult` appears in `medicham2-browser.js`
exactly once, inside a comment. Established by reading the state, not by inferring it from output —
grep for `moveResult|_failed|Failed|_moveOK|_didMove|_acted` returns the comment and a `forbidTableFailed`
counter, and nothing else. So Stomping Tantrum was wrong in **one** direction only: it never doubled
(3,545 corpus uses), and it was wrong SILENTLY, because `variablePower` was consumed under
`if (_vp && _vp.kind)` and twelve moves carry the tag with no `kind` at all — the unknown-kind counter
beside it is gated on the same field, so the whole family was skipped without incrementing anything.

Every member was checked INDIVIDUALLY against its own handler, and the split is not "was I stopped"
versus "did I choose":

| returns | members, each with its line |
|---|---|
| **`false` — COUNTS** | flinch (`conditions.ts:205`), full paralysis (`:43`), freeze (`:104`), sleep (`:76`), Taunt / Throat Chop / Disable (`moves.ts`), no PP (`battle-actions.ts:285`), a `beforeMoveCallback` (`:274`), **a MISS**, a type immunity — anything reaching `trySpreadMoveHit` with an explicit failure |
| **`null` — DOES NOT** | recharge (`conditions.ts:372`), and **PROTECT**, which is the counter-intuitive one: protect's `onTryHit` returns `this.NOT_FAIL` — the empty string (`battle.ts:272`) — which is falsy but is not `false`, so `atLeastOneFailure` stays false and `battle-actions.ts:616` writes null |

So **a Stomping Tantrum thrown into a Protect does NOT double next turn and one that MISSED does.**
Sleep is in the `false` group but a `sleepUsable` move returns `undefined`, which leaves the event's
relayVar `true` and is a different branch entirely; that is why each was read rather than grouped.

`_mvRes` / `_mvResLast` now carry the three states, roll over at the turn boundary exactly as
`nextTurn` does (`battle.ts:1671`), and are cleared on switch-out as `clearVolatile` does
(`pokemon.ts:1551`). **The twenty-one `if(TR)TR.fail(m)` sites became `mvFail(m)`**, because a move
result is state and recording it inside the announcement would have made the mechanic depend on
whether a trace was attached — this repo's own "capability that cannot prove it ran", inverted.

**NAME-WIRED, AND THE MEMBERSHIP WAS PRINTED BEFORE THE NAMES WERE TYPED.** `moveLastTurnResult === false`
appears exactly **twice** in `data/moves.ts` — `stompingtantrum` (18048) and **`temperflare`** (19184,
48 uses), which the brief did not name and which is the same handler written twice. There is no shape
to match on: both carry `variablePower {computed:true, note:"idiom not yet derivable"}` **and so do ten
others** — ragefist, assurance, avalanche, **lastrespects (5,248 uses)**, payback, risingvoltage, round,
spitup, tripleaxel, watershuriken. Matching the shape would have doubled Last Respects after any failed
turn. Stated rather than fixed: the **Metronome item** (`items.ts:4010`, legal here) reads the same
field as a TRUTHY test for its consecutive-use counter; this engine has no Metronome item, and the
state it would need now exists.

### TWO MORE, TAKEN BECAUSE THIS WIRE OPENED THEM

Both were unreachable while the family was a no-op, and both appeared in the ladder the moment it
started resolving:

- **Wide Guard named NOBODY.** `|-activate||move: Wide Guard` — the engine emptied its target list and
  then wrote the line. Showdown's `add('-activate', target, 'move: Wide Guard')` fires inside the
  per-target TryHit event, so there is one line per shielded body. It opened a whole new divergence
  class (`-activate: a different body`, 18 games) on the first WIRE 9 rung; the class is gone.
- **A QUAKE HITS YOUR OWN PARTNER FIRST.** `getMoveTargets` (`sim/pokemon.ts:809`) builds an
  `allAdjacent` list `push(...adjacentAllies())` and only then falls through to `push(...adjacentFoes())`.
  Staged in the authority rather than read off the switch statement:
  `|move|p1a: Garchomp|Earthquake|p2b: Tyranitar|[spread] p1b,p2a,p2b`. This engine appended the ally
  LAST. `|-immune|pXX <> |-supereffective|pXX` went 0 → 20 and `|-immune|pXX <> |-damage|pXX` 4 → 21 on
  the first rung, which is what named it.

### THE FIVE PROBES AND THE SEVEN RED DEMONSTRATIONS

Every demonstration is source-reverted (`demoSource`) and every one flipped.

| probe | asserts | the arm that stops it being vacuous |
|---|---|---|
| `move\|spreadFoes` — *a targetless spread click still hits both foes* | both foes' HP | the arms are the SINGLE-target click against the spread one, both with the target withheld. The named-vs-withheld claim is an EQUALITY, so using it as the arms would be hollow; the Shadow Ball arm is the **opposite-sign guard** — an engine that started aiming every targetless click would make it non-zero |
| `move\|spreadFoes` — *a miss names every target it missed* | the `-miss` lines' SHAPE, four fields with a foe slot in the fourth | the control is the same click on a WINNING roll — no `-miss` and real damage. A count-only assertion would pass on a bare `\|-miss\|p1a: X` |
| `move\|oneTurnGuard` — *Wide Guard names each body it shielded* | one line per body, and zero damage beside it | the same click with no Wide Guard: no lines and real damage, so "no lines" cannot come to mean "no block" |
| `move\|spreadAll` — *a quake resolves ally-first* | the `-damage` order `p1b,p2a,p2b` | a `spreadFoes` move on the same board must stay `p2a,p2b` — without it this passes on an engine that reversed every target list |
| `move\|variablePower` — *a FLINCHED Tantrum doubles and a RECHARGING one does not* | the HP the turn-2 Tantrum takes: 101 / 200 / 101 | three arms, and the third is the whole of #84. Two demonstrations carry **opposite signs**: one reverts the flinch site (the flinched arm must stop doubling) and one reverts recharge from `null` to `false` (**the recharged arm must stop reading 75**) — which is the obvious wrong fix, one boolean for "my move did not happen", stated as such |

### THE CONTROLLED TABLE — 13 arms × 1,996 games, one pinned census, every arm COMPARABLE

`node engine/wire_ladder.js --write`, census pinned to `data/wire-ladder-census.pin.json`
(`f63179105d3c`), release **`86048ca3a422`**. The baseline ran first and last with eleven arms between
and **reproduced EXACTLY** — every measured field identical and the per-game divergence depth identical
game for game.

**THE WHOLE LADDER WAS RE-RUN, SO EVERY NUMBER BELOW INCLUDING WIRE 8's IS FROM THIS RUN.** Do not
compare a figure here against the one published beside WIRE 8: the game store grew (7,375 → 7,401
teams, 1,995 → 1,996 games) and every arm moved slightly. Comparing across the two runs is the
uncontrolled-pair mistake `wire_ladder.js` exists to prevent.

| arm | div/1996 | agreed whole | classes | causes | moves | **median line** | p75 | p90 | mean |
|---|---|---|---|---|---|---|---|---|---|
| baseline (pre-WIRE-1) | 1991 | 5 | 20 | 1141 | 228 | 13 | 18 | 30 | 15.11 |
| WIRE 7 | 1943 | 53 | 21 | 1284 | 267 | 16 | 29 | 85 | 28.16 |
| WIRE 8 | 1903 | 93 | 21 | 1363 | 268 | 16 | 37 | 95 | 31.62 |
| **WIRE 9** | **1859** | **137** | 22 | 1292 | **269** | **18** | **41** | 95 | **33.11** |
| baseline, REPEATED | 1991 | 5 | 20 | 1141 | 228 | 13 | 18 | 30 | 15.11 |

- **THE MEDIAN COMPLETED TURN IS STILL 1, AT EVERY RUNG INCLUDING THIS ONE. NINE WIRES HAVE NOT MOVED
  IT.** Said first, because it is the number the ladder exists to refuse to soften. What that means is
  below.
- **THE MEDIAN FIRST-DIVERGENCE LINE MOVED, 16 → 18** — it had stood at 16 through WIRE 8. p75 37 → 41,
  mean 31.62 → 33.11, p90 flat at 95.
- **NET, THE ONLY HONEST FORM.** Against the baseline: **1,275 later, 123 EARLIER, 598 unchanged — net
  +1,152**, median delta **3** lines (WIRE 8 was +1,050 at 1 line). Against WIRE 8: **506 later, 163
  earlier, 1,327 unchanged — net +343**, the largest single-rung net since WIRE 7.
- **WHOLE-GAME AGREEMENT 93 → 137 of 1,996**, the largest single-rung gain in the series.
- **`event missing from medicham2` 672 → 522.** `-damage field 3` 276 → 336 and `ordering` 243 → 451,
  both UP: games that survive further reach bugs the earlier arms never got to, and the ordering rise
  is named below rather than left as a shrug.

### WHAT ACTUALLY MOVED — counted in the arms' own cause lists, this run

| family (occurrences at the top rung) | baseline | WIRE 7 | WIRE 8 | **WIRE 9** |
|---|---|---|---|---|
| `\|-miss\|ATT\|TGT <> \|-fail\|ATT` | 42 | 69 | 96 | **5** |
| anything `<>` a `-fail` of ours | 226 | 197 | 233 | **88** |
| `wideguard` | 12 | 35 | 41 | **28** |
| `throatchop` | 14 | 46 | 51 | 52 |
| `feint` | 25 | 32 | 29 | 29 |
| `whiteherb` | 29 | 36 | 37 | 35 |

The target family is cleared. The five that survive are alignment offsets against an unrelated line,
not the shape itself.

### THE NEW TOP OF THE FILE, READ OFF THIS RUN'S OWN TOP RUNG

Largest single named cause: **`|-end|pXX|throatchop <> |upkeep`, 37 games** (3,167 uses) — the Throat
Chop silence expires and this engine announces nothing. Then `|-enditem|pXX|whiteherb` 30 (2,380 uses)
and `|-activate|pXX|feint` 25 (437).

**But the largest ROOT is bigger than any of them and this wire diagnosed it without fixing it.**
`ordering :: |-supereffective|pXX|1 <> |-damage|pXX|H/H` is **45 games**, and it is one root with three
more shapes beside it — `|-immune| <> |-miss|` 31, `|-damage| <> |-damage|…roughskin` 28,
`|-resisted| <> |-damage|` 19, `|-immune| <> |-damage|` 17. **Showdown resolves a spread move in STEPS
ACROSS ALL TARGETS; this engine resolves it TARGET AT A TIME.** Staged in the authority, an Earthquake
into three bodies:

```
|-supereffective|p1b: Incineroar|1     <- every effectiveness line first
|-supereffective|p2b: Tyranitar|1
|-damage|p1b: Incineroar|38/170        <- then every damage line
|-damage|p2a: Milotic|104/170
|-damage|p2b: Tyranitar|77/175
```

medicham2 emits `SE(a) DMG(a) SE(b) DMG(b)`. That is `spreadMoveHit`'s step list
(`sim/battle-actions.ts`) against this engine's per-target loop, and it is **a restructure of the hit
loop, not a wire** — which is exactly why it is written here with its measurement rather than started.
Combined the family is **>110 games**, larger than throatchop by a factor of three, and it is the
recommended next target.

### THE MEDIAN TURN, SAID PLAINLY

**Nine wires, ~1,150 net games parting later, whole-game agreement 5 → 137, and the median completed
turn has never left 1.** That is not a failure of the wires and it is not noise: the median game still
parts inside turn one, and every one of the nine has moved the LINE the game parts on (13 → 18) while
leaving the TURN alone. The two facts are consistent and the reading is this — **the remaining
divergences are dominated by things that happen within the first turn's own event stream**, which is
where the ordering family above lives. A per-target loop against a per-step one parts on turn 1 of
almost any doubles game with a spread move in it, however many mechanics are right.

**So the grind should continue, but the next item is not another mechanic.** Eight of the nine wires
fixed a MECHANIC; the ladder says the remaining mass is a SHAPE — how a hit is sequenced — and one
restructure of `trySpreadMoveHit`'s equivalent is worth more than the next five mechanics. If that
lands and the median turn is still 1, that is the point to stop grinding the differential and say so.

### Green, and what was NOT re-run

Run and green: `tests/test-mechanics.js` (267/268), `tests/probe_red_demo.js` (164/0),
`tests/test-charge.js` (18/0), `tests/test-medicham.js` (5/0), `tests/test-game-diff.js`,
`tests/test-game-differential.js` (ALL PASSED), `tests/test-protocol-trace.js` (ALL PASSED),
`tests/test-engine-consistency.js`, `tests/test-no-silent-failure.js` (0 new; 1 baselined block now
speaks), `tests/test-engine-diff.js` (1/150 disagree, unchanged), `engine/conformance.js`
(RATCHET 96 baselined, **0 new**).

**A LADDER RUN WAS VOIDED AND IS REPORTED RATHER THAN DROPPED.** The first attempt at the WIRE 9
table was destroyed mid-run: OPS's ingest appended to `data/games.bo3.jsonl` at 13:01:49, the team
pool digest moved `4f9002f01f7c → deb14a3d200e` between two arms, and `arms_comparable` REFUSED all
twelve. `data/wire-ladder.json` was written with `determinism.verdict: "THE TWO BASELINES DISAGREE. Do
not read the table below as a ladder."` — the instrument doing its job, and the CLAUDE.md photograph
rule arriving through the one door a frozen engine release cannot close: **the release freezes the
engine, and the game store is not in it.** The table above is the clean re-run.

**Also fixed in `engine/wire_ladder.js`:** the drift check named `'a01-baseline-run1'` and
`'a12-baseline-run2'` as literals, and inserting a rung ahead of the repeated baseline renamed the
second one. The two baseline arms are now DERIVED (the two arms on the baseline release, refusing if
there are not exactly two) — the same defect WIRE 8 found in the hard-coded `'a09-wire6'`, one
function over.

**NOT re-run, and named rather than inherited as passing:** `tests/test-prng.js`,
`tests/test-stadium-roster.js`, `engine/provenance.js --strict`, `tests/test-site-data-fresh.js`, and
`node engine/status.js`'s FEATURE SEMANTICS CHECK, which was failing on eight features before this
session and was not touched.

## ROADMAP #81 WIRE 8 — TWO FAMILIES, ONE OF THEM A REAL DAMAGE BUG, AND THE LADDER'S OWN "WHAT REMAINS" LIST WAS READING THE WRONG ARM. 2026-08-07.

Census **258 live / 259 probed → 262 live / 263 probed.** Four new probes, all LIVE; `missing` is
unchanged at 1 (`needsTargetToAttack`). 0 hollow, 0 unarmed, 0 direct-call, 0 threw — every ratchet
held. `tests/probe_red_demo.js` **151 → 157 demonstrations, 0 failed**, six of them new.

### FAMILY A WAS A STATE BUG, NOT AN ANNOUNCEMENT BUG, AND THE ARTIFACT HAD THE TWO COLUMNS THE OTHER WAY ROUND

The roadmap read the cause `|-fail|p2b <> |-sidestart|p2:|tailwind` as *"we `-fail` a side condition
Showdown sets"*. It is the opposite: `classify()` writes `SD <> ME`
(`engine/game_differential.js:1145`), so **Showdown FAILS the second Tailwind and this engine SET
it.** Established by staging it in both engines rather than by re-reading the string — the same
scenario played through `playGame` shows Showdown writing `|-fail|p1a: Whimsicott` where medicham2
writes a second `|-sidestart|p1: |move: Tailwind`.

**And a second `-sidestart` is not a spare line, it is a reset clock.** `Side.addSideCondition`
(`sim/side.ts:420`) returns `false` when the condition is already present and declares no
`onSideRestart`; **measured over the format, none of tailwind / reflect / lightscreen / auroraveil /
safeguard / stealthrock / stickyweb declares one, and exactly two do — spikes (cap 3) and toxicspikes
(cap 2).** This engine wrote `field.twA=4` and `sf.scrP=turns` unconditionally, so a side that
re-clicks Tailwind or Reflect once a turn keeps it **forever**. That is a damage and a speed bug for
the rest of the game, which is why both probes read HP and Speed and neither reads a protocol line.

### THE SCREENS BECAME THREE NAMED CONDITIONS, BECAUSE THE DUPLICATE QUESTION CANNOT BE ASKED OF A CATEGORY

`sf.scrP` / `sf.scrS` were two counters keyed by damage CATEGORY. Three defects fell out of that one
representation and only the first was on the roadmap:

| | |
|---|---|
| **it cannot answer "is Reflect already up"** | which is the duplicate check itself |
| **an expiring Aurora Veil announced a Reflect AND a Light Screen** | the companion cause the roadmap spotted (`\|-sideend\|p2: \|Aurora Veil <> \|-sideend\|p2: \|Reflect`). It was not "the state is confused" — it was that this engine had no name to announce |
| **two overlapping screens with different expiries were unrepresentable** | `tests/test-game-diff.js` had to collapse the reference side with a `Math.max` and said so. Both halves of that approximation are now gone and the comparison is exact, with `auroraveil` compared as its own third clock |

`sf.sc` is keyed by the MOVE ID, so the announcement is the move's own name and the category comes
from that move's own `halvesDamage` tag. **No screen is named anywhere in the engine.** The iteration
order is derived too: Brick Break walks `['reflect','lightscreen','auroraveil']`
(`data/moves.ts:1833`) and the residual sub-orders are 1, 2 and 10 in that same sequence — sorting on
`halvesDamage.category` (Physical, Special, both) reproduces it without writing a name down.

**WHAT WAS DELIBERATELY NOT CHANGED:** one multiplier however many screens are up. Showdown chains a
second `onAnyModifyDamage` when a Reflect and an Aurora Veil overlap; this engine has always applied
the reduction once and still does. Folding a damage change into a representation change would make
the ladder unable to say which did what.

### FAMILY B WAS BOTH, AND THE STATE HALF COSTS 49% OF A HIT

Every one of the **ten** `chargeTurn` moves in this format — solarbeam, electroshot, phantomforce,
solarblade, meteorbeam, skyattack, dig, dive, bounce, fly, all `LEGAL`, checked against
`gen9championsvgc2026regmb` rather than remembered — carries the same handler shape, and
`this.add('-prepare', ...)` is the **first** line of it, above the boost, above the weather test and
above the `ChargeMove` event (verified on all ten: the `-prepare` index precedes the `ChargeMove`
index in every one). This engine had the whole wind-up inside the "we are charging" branch:

| | defect | evidence |
|---|---|---|
| **order** | the `\|-boost\|` was written above the `\|-prepare\|` | `data/moves.ts:4644` — announce, then boost |
| **announcement** | a SKIPPED charge announced nothing at all | Solar Beam in sun: Showdown writes `\|-prepare\|` and then hits; medicham2 just hit |
| **state** | **a rain Electro Shot fired with NO +1 Special Attack** | staged against the official engine before a line changed — Archaludon into a Snorlax under Drizzle, **Showdown 97, medicham2 65**. After: 97 |

The roadmap's framing — *"two-turn moves emit no `-prepare`"* — is true only of the skipped case.
Staged clean, medicham2 emitted `|-prepare|solarbeam` correctly on a normal charge turn all along;
what it never emitted was the wind-up it did not spend a turn on.

**POWER HERB IS `isNonstandard: 'Past'` IN CHAMPIONS.** Asked of the format, not remembered. Its
branch is kept correct (the `|-enditem|` now follows the announcement and the boost, which is where
`onChargeMove` sits) and **no probe is written for it**, because a probe on an unreachable item is a
census row that cannot fail.

### THE FOUR PROBES AND THE SIX RED DEMONSTRATIONS

Every demonstration was run against a **source-reverted** engine (`demoSource`), and every one flipped.

| probe | what it asserts | the arm that stops it being vacuous |
|---|---|---|
| `move\|doublesSideSpeed` — *a second Tailwind does not extend the first* | the partner's SPEED at the start of turn 5 | the assertion is an EQUALITY, so a third arm plays **the identical turn-2 click alone** and must still be fast. Without it, "the two arms agree" is also what an engine with no Tailwind at all prints |
| `move\|halvesDamage` — *a second Reflect does not extend the first* | the DAMAGE a turn-6 Earthquake deals | the same shape: the turn-2 click alone halves turn 6, so the measurement is shown able to see the extension before it is used to claim there was none |
| `move\|halvesDamage` — *Aurora Veil still goes up on a side that already has Reflect* | the SPECIAL damage starts being halved and the physical does not move | **the over-match guard, and its claim has the opposite sign.** The obvious wrong fix is a check per damage CATEGORY; it passes the two probes above and stops an Aurora Veil ever landing beside a Reflect. Its known-bad engine is that wrong fix, stated as such rather than argued about |
| `move\|chargeTurn` — *Electro Shot keeps its +1 Special Attack when rain skips the charge* | 185 damage in rain, +1 stage, and 0 on a dry turn-1 | the control is the same click **from −1**, which nets zero and deals 123. An engine that skipped the boost prints the two arms EQUAL |

Two of the six demonstrations are STREAM claims and are labelled as such at the line, because the
state really is identical either way: an expiring Aurora Veil falls on the same turn whichever name
it announces, and Solar Beam in sun deals the same 160 with or without its `|-prepare|`.

### THE CONTROLLED TABLE — 12 arms × 1,995 games, one pinned census, every arm COMPARABLE

`node engine/wire_ladder.js --write`, census pinned to `data/wire-ladder-census.pin.json`
(`f63179105d3c`), release `dd3da7c69cb0`. **The baseline ran first and last with ten arms between and
reproduced EXACTLY** — every measured field identical AND the per-game divergence depth identical
game for game. The whole ladder was then run a **third** time end to end after the instrument edits
below, and every arm reproduced to the digit.

| arm | div/1995 | agreed whole | classes | causes | moves | **median line** | p90 | mean |
|---|---|---|---|---|---|---|---|---|
| baseline (pre-WIRE-1) | 1989 | 6 | 22 | 1129 | 224 | 13 | 30 | 14.83 |
| WIRE 6 | 1962 | 33 | 25 | 1174 | 263 | 14 | 55 | 23.36 |
| WIRE 7 | 1931 | 64 | 25 | 1261 | 267 | 16 | 89 | 27.75 |
| **WIRE 8** | **1893** | **102** | 27 | 1355 | **269** | **16** | **94** | **31.00** |
| baseline, REPEATED | 1989 | 6 | 22 | 1129 | 224 | 13 | 30 | 14.83 |

- **THE MEDIAN COMPLETED TURN IS STILL 1, AT EVERY RUNG INCLUDING THIS ONE.** Eight wires have not
  moved it. That is the headline the ladder was built to refuse to soften.
- **THE MEDIAN FIRST-DIVERGENCE LINE DID NOT MOVE EITHER — 16, the same as WIRE 7.** The mean went
  27.75 → 31.00 and p75 28 → 35, so the tail lengthened and the middle did not. Said plainly rather
  than quoting the mean on its own.
- **NET, WHICH IS THE ONLY HONEST FORM.** Against the baseline: **1,183 later, 154 EARLIER, 658
  unchanged — net +1,029** (WIRE 7 was +882). Against WIRE 7: **415 later, 182 earlier, 1,398
  unchanged — net +233**.
- **WHOLE-GAME AGREEMENT 64 → 102 of 1,995.** The largest single-rung gain in the series.
- **`-damage field 3` 257 → 290 and distinct causes 1,261 → 1,355, both UP** — games that survive
  further reach bugs the earlier arms never got to. `event missing from medicham2` fell 677 → 653,
  which is the `-prepare` family emptying.

### WHICH OF THE TWO ACTUALLY MOVED ANYTHING — counted in the arms' own cause lists

Occurrences at the top rung, WIRE 7 → WIRE 8:

| family | WIRE 7 | WIRE 8 |
|---|---|---|
| `\|-prepare\|`, any slot, any move | 141 | **0** |
| `solarbeam` | 107 | 26 |
| `electroshot` | 68 | 10 |
| `tailwind` | 94 | 27 |
| `-sidestart` | 142 | 18 |
| `lightscreen` / `reflect` / `auroraveil` | 23 / 31 / 23 | 5 / 6 / 13 |
| `-sideend` | 4 | **11 — UP, and named below** |

**`-prepare` reaches zero.** Nothing else does. What survives in the other rows is downstream: every
remaining `solarbeam` and `tailwind` row is an alignment offset against an unrelated `|-immune|` line,
and the surviving `-sidestart` rows are **hazards**, not screens.

### The boundaries — measured, declared, NOT fixed

- **THE HAZARD HALF OF FAMILY A IS NOT DONE, and the reason is not a judgement call.** Stealth Rock
  and Sticky Web declare no `onSideRestart`, so a second lay FAILS exactly like a Tailwind; Spikes and
  Toxic Spikes DO, capped at 3 and 2. **The cap is not in `data/tags.json`** — the move's `hazard`
  param carries only `{hazard:'spikes'}` — and `data/tags.json` **cannot be safely regenerated**
  (ROADMAP #65, below: five entities would silently drop out of the engine's knowledge). Refusing all
  four duplicates would break Spikes' second and third layer. It reads **6 games across 5 causes** at
  the top rung (`|-fail| <> |-sidestart|p2:|stealthrock`, `…|stickyweb`) and is left alone with the
  reason.
- **THE SIDE RESIDUAL SUB-ORDER IS NOT MODELLED.** Showdown's are reflect 1, lightscreen 2, tailwind
  5, auroraveil 10, and its per-Pokémon items sit at a different order entirely. This engine ticks
  Tailwind as a FIELD counter above the per-body loop, so a Leftovers heal and a `-sideend` on the
  same turn come out in the wrong order. That is **6 of the 11** `-sideend` occurrences — five
  distinct causes, four of the shape `|-heal|…leftovers <> |-sideend|…` and one
  `|-damage|…sandstorm <> |-sideend|…`; the other five rows are alignment offsets against an
  unrelated line. Splitting the two sides' residuals apart is a restructure, not a wire. **Declared at
  the line in the source.**
- **AURORA VEIL AND REFLECT DO NOT STACK HERE.** One multiplier however many screens cover the
  category, unchanged from before this wire — see above.

### THE LADDER'S OWN "WHAT REMAINS" BLOCK WAS TWO RUNGS STALE, AND WIRE 7 PUBLISHED FROM IT

`engine/wire_ladder.js` built `what_remains_at_the_top_rung` from a **hard-coded `'a09-wire6'`**. So
the surviving-cause list published beside WIRE 7 was WIRE 6's, and it still named **251 hospitality
rows that WIRE 7 had taken to zero**. The roadmap for this wire was written off that block, which is
why it opened with a Tailwind cause at 20 games and a claim that nothing parts more than 3.

Found by reading this wire's own output and noticing hospitality in it. The top rung is now
**derived** — the last arm that is not the repeated baseline — and the artifact carries a `top_rung`
block naming the arm, label and release it came from, so a stale read cannot happen silently again.
This is `docs/LESSONS.md`'s own lesson wearing an instrument's hat: **a name typed into a generator
goes stale the moment the thing it names moves.**

### THE TAIL IS NOT FLAT, AND THAT WAS AN ARTEFACT OF THE STALE BLOCK

The brief asked for a clear negative if the top surviving cause were still 3 games. It is not. With
the top rung read correctly, the largest single cause at WIRE 8 is:

```
32  unrelated event mismatch :: |-miss|p1b|p2a <> |-fail|p1b
26  unrelated event mismatch :: |-miss|p2a|p1a <> |-fail|p2a
24  unrelated event mismatch :: |-miss|p1a|p2a <> |-fail|p1a
23  unrelated event mismatch :: |-miss|p2b|p1a <> |-fail|p2b
```

One shape in four slot spellings, **114 games** — Showdown writes `|-miss|ATTACKER|TARGET` where
medicham2 writes a bare `|-fail|ATTACKER` (`|-miss|p2a: Charizard|p1a: Primarina` against
`|-fail|p2a: Charizard`). **It is pre-existing and it grows with trajectory depth: 41 games at the
baseline, 55 at WIRE 6, 83 at WIRE 7, 114 here.** It is the single largest thing left in the file by a
factor of two and **it is NOT diagnosed** — saying which move and which branch needs its own staging,
and this wire did not do it. Behind it: `-end|throatchop` (30 games, 3,167 uses), `-activate|feint`
(25, 437), `-enditem|whiteherb` (10 games, 2,380 uses — the roadmap's "also in range" item, which is
NOT on the same code path as either family and was not taken), and the sandstorm/Intimidate residual
orders at 10 each.

**So the recommendation is to keep going, but not by ranking causes off the artifact's top-5 lists
again.** Two of the last three wires were aimed by a block that was describing a different engine.
The next target should be picked off a freshly-read top rung, and the `-miss <> -fail` family is it.

### Instruments that moved BECAUSE the engine got better, and are fixed here

- **`tests/test-game-differential.js` — 2 FAILURES, both good news, both closed.** The Electro Shot
  DIRECTED scenario stopped diverging, so it now declares `expect: 'agree'` with a `closed_by` and
  will fail just as loudly if it re-opens. That took the `ordering` acceptance test back to one
  scenario, **and the bar was not lowered** — a replacement was staged from the ladder's own largest
  surviving `ordering` cause (`|-damage|p1b|[from]sandstorm <> |-damage|p1a|[from]sandstorm`, 10
  games): Showdown's residual is speed-sorted across every body on the field, medicham2 walks its own
  slots, and four Protects make it deterministic. It parts exactly as predicted. This is the SECOND
  time this scenario has had to be restaged for this reason, and that is the acceptance test working.
- **`tests/test-game-diff.js`** now compares three named screen clocks instead of two category
  counters, on BOTH sides. Its planted-divergence proof — which is literally an injected extra turn of
  Tailwind — still fires at the turn it was planted, and all five scripted games agree throughout.

### Green, and what was NOT re-run

Run and green: `tests/probe_red_demo.js` (157/0), `tests/test-mechanics.js` (262/263), `tests/
test-charge.js` (18/0), `tests/test-medicham.js` (5/0), `tests/test-engine-diff.js` (1/150 disagree,
unchanged), `tests/test-game-diff.js`, `tests/test-game-differential.js` (ALL PASSED),
`tests/test-protocol-trace.js` (ALL PASSED, `traceBodyOffField = 0`), `engine/conformance.js`
(RATCHET 96 baselined, **0 new**).

`tests/test-interaction-matrix.js --full`: **1,557/1,574 (98.9%) — identical to WIRE 7**, and the
SHRINK GUARD still refuses to publish against the artifact's 1,643. Unchanged and still not this
wire's: the LIVE/INERT split is decided by the REFERENCE engine's two arms.

`node engine/status.js` still opens with **FEATURE SEMANTICS CHECK FAILED on the same eight features**
— `switchSurvives1`, `switchKOSlow` and `switchDiesFirst` carry byte-identical digests to the ones
recorded for ROADMAP #31 below, and the count did not change. A refit is MEASURE's.

**NOT re-run, and named rather than inherited as passing:** `tests/test-prng.js`,
`tests/test-stadium-roster.js`, `engine/provenance.js --strict`, `tests/test-site-data-fresh.js` and
the three `run-all`-only failures WIRE 7 recorded. None of them is ENGINE's and none was touched, but
this wire did not run them and does not claim their state.

## ROADMAP #81 WIRE 7 — SIX MECHANICS IN ONE BATCH, AND THE MEDIAN FIRST-DIVERGENCE LINE MOVED FOR THE FIRST TIME. 2026-08-07.

Census **251 live / 252 probed → 258 live / 259 probed.** Seven new probes, all LIVE; the one MISSING
row (`needsTargetToAttack`) is unchanged. 0 hollow, 0 unarmed, 0 direct-call, 0 threw — every ratchet
held. `tests/probe_red_demo.js` **142 → 151 demonstrations, 0 failed**, nine of them new.

**A BATCH BECAUSE SIX SEPARATE WIRES WERE NOT PAYING.** `data/wire-ladder.json` replayed all six of
the night's wires over 1,995 games under one pinned census and the median completed turn before
divergence never moved off 1 at any rung. These seven targets are ABSENT OR MISORDERED MECHANICS
rather than roots to be found, so they went together and were measured once.

### What was measured BEFORE anything was wired, and what the measurement changed

**Two of the roadmap's seven targets did not survive contact with the authority's source, and saying
so is half the result.**

| # | roadmap's claim | what the authority actually says |
|---|---|---|
| 2 | **FOCUS SASH NEVER ENDS** — 14,668 uses, "the heaviest entity in the whole artifact" | **NO DEFECT. Not wired, and nothing was changed for it.** Staged in both engines: Showdown writes `\|-enditem\|Focus Sash` then `\|-damage\|1/103`, and so does medicham2 — same order, same 1 HP, same spent item. Ranked by ITEM USAGE, not by divergence: the ladder's own cause list carries **one** `focussash` row at the top rung and it is `ordering :: \|-damage\| <> \|-enditem\|focussash\|[from]knockoff` — the Knock Off bug wearing a Sash. It fell 7 → 3 anyway, as a consequence of the Knock Off ordering fix |
| 5 | **RAGE POWDER / FOLLOW ME BEATING A TYPE IMMUNITY** | **THE DIAGNOSIS IS WRONG.** `onFoeRedirectTarget` (data/moves.ts) is gated on `validTarget` and, for Rage Powder alone, on `runStatusImmunity('powder')` — which this engine already asks. Redirection is not gated on type immunity in either engine and both draw correctly. The defect was the ANNOUNCEMENT, and it was the opposite of what was filed: medicham2 wrote an `\|-activate\|move: followme` that Showdown never writes, and did NOT write the `\|-activate\|ability: Lightning Rod` that it does |
| 7 | **SHED TAIL** — "Showdown starts a Substitute; we take the HP loss and make none" | **STALE.** WIRE 130 landed `grantSubstitute` and the doll has been built since. What was wrong was the ORDER and the ROUNDING, and what is still wrong is the SELF-SWITCH — see the boundaries below |

### The six that landed, each with the source line it was read from

| | defect | authority |
|---|---|---|
| **1** | **Hospitality announced a heal onto a full-HP partner, and announced an `\|-ability\|` it never has.** 5,779 uses and the single largest cause at the top rung — 127 games across two divergence classes | `Battle.heal()` returns **before** it announces: `if (target.hp >= target.maxhp) return false;`. And `hospitality`'s handler is a bare `for (const ally of pokemon.adjacentAllies()) this.heal(...)` with no `this.add('-ability')` in it, unlike Intimidate |
| **2** | **Knock Off stripped the item BEFORE the damage** — ROADMAP #80's open half, whose damage claim was retracted | `onAfterHit` runs after. Staged: `\|-damage\|p2a: Gengar\|0 fnt` → `\|-enditem\|Life Orb\|[from] move: Knock Off` → `\|faint\|`. `takeItem` has **no hp test at all**, so a body reduced to 0 still loses it — the faint is announced last |
| **3** | **A mega stone could be knocked off the body it belongs to** | `onTakeItem(item, source) { return !item.megaStone?.[source.baseSpecies.baseSpecies] }`. **MEASURED over the format**: exactly **75** legal items declare an `onTakeItem` and **all 75 are mega stones** — no Z-crystal, no plate, no Griseous Orb in Champions. This is a STATE bug: the body could not mega for the rest of the battle |
| **4** | **A self-eaten resist berry was recorded as KNOCKED OFF, and wrote one line where Showdown writes two** | Colbur is `onSourceModifyDamage` — it fires INSIDE the calculation, so `onAfterHit` finds nothing. `eatItem()` writes `[eat]` and the handler then writes `[weaken]`. Harvest, Recycle, Belch, Cud Chew and Unburden all read that difference |
| **5** | **The pinch and status berries fired only at the RESIDUAL** — Sitrus is 13,079 uses | They are `onUpdate`, and `Battle.eachEvent('Update')` runs after **every action** plus once inside `spreadMoveHit` right after the damage. So the berry is eaten BETWEEN the two attackers of a double |
| **6** | **The substitute doll was a floored quarter, its `-start` came after the `-damage`, and a second `-start` was emitted** | `this.effectState.hp = Math.ceil(target.maxhp / 4)` while the cost is `directDamage(maxhp / 4)`, which truncs — **ceil for the doll, floor for the cost, one rule for both members**. `moveHit` adds `volatileStatus` and only then calls `onHit`, where the `directDamage` lives |
| **7** | **Protean converted AFTER the move resolved, so it was worth exactly zero on offence** | `onPrepareHit` fires at `battle-actions.ts:591`, **above the whole eight-step hit list** — before invulnerability, before the TryHit that Protect answers, before type immunity and before the accuracy roll |

**PROTEAN'S OFFENSIVE HALF WAS WORTH NOTHING AND THE OLD COMMENT SAID SO WITHOUT MEANING IT.** WIRE 54
placed the conversion below every branch of the resolved move and called it "the wrong order by a
hair", on the belief that moving it would mean re-pricing `d`. `d` is recomputed at the hit site per
target, so it cost nothing. Measured, Meowscarada's Earthquake into an unfaintable Ceruledge:

| | no ability | Protean |
|---|---|---|
| before | 123 | **123** |
| after | 123 | **184** |

### The one derivation that needed measuring before it was wired

`itemRefusesTake` reads the artifact's own `megaStone.into` table — **and deliberately not through
`megaKeyFor`**, whose suffix fallback would answer `garchomp-mega` for a Gengarite on a Garchomp and
refuse a knock-off that is legal. Checked against Showdown's own predicate over **47,064 (item ×
body) pairs**: **156 refusals, 5 disagreements**, and all five are the same axis — Showdown compares
against `baseSpecies.baseSpecies` (the family) and this reads the exact forme key.

| pair | Showdown | here |
|---|---|---|
| `floette-eternal @ floettite` (and its mega) | allows | refuses |
| `raichu-alola @ raichunitex` / `raichunitey` | refuses | allows |
| `slowbro-galar @ slowbronite` | refuses | allows |

All five are a regional forme holding its family's stone, which this engine cannot mega with anyway
(`megaKeyFor` finds no row). **Declared, with the number, rather than left to be discovered.**

### THE CONTROLLED TABLE — 11 arms × 1,995 games, one pinned census, every arm COMPARABLE

`node engine/wire_ladder.js --write`. Census pinned to `data/wire-ladder-census.pin.json`
(`f63179105d3c`); **the baseline ran first and last with nine arms between and reproduced EXACTLY —
every measured field identical AND the per-game divergence depth identical game for game.**

| arm | div/1995 | agreed whole | classes | causes | moves | **median line** | p90 | mean |
|---|---|---|---|---|---|---|---|---|
| baseline (pre-WIRE-1) | 1989 | 6 | 22 | 1129 | 224 | 13 | 30 | 14.83 |
| WIRE 1 | 1986 | 9 | 21 | 1069 | 228 | 13 | 31 | 15.92 |
| WIRE 2 | 1976 | 19 | 24 | 1153 | 233 | 13 | 44 | 20.94 |
| WIRE 3 | 1975 | 20 | 24 | 1187 | 237 | 14 | 44 | 21.62 |
| WIRE 4 (complete) | 1965 | 30 | 23 | 1151 | 237 | 14 | 46 | 21.93 |
| WIRE 6 | 1962 | 33 | 25 | 1174 | 263 | 14 | 55 | 23.36 |
| **WIRE 7** | **1931** | **64** | 25 | 1261 | **267** | **16** | **89** | **27.75** |
| baseline, REPEATED | 1989 | 6 | 22 | 1129 | 224 | 13 | 30 | 14.83 |

- **THE MEDIAN COMPLETED TURN IS STILL 1, AT EVERY RUNG INCLUDING THIS ONE.** Seven wires have not
  moved it. That is the headline the ladder was built to refuse to soften.
- **THE MEDIAN FIRST-DIVERGENCE LINE MOVED BY TWO, WHICH NO PREVIOUS RUNG DID.** 14 → 16, and p90
  55 → 89. Paired against the baseline, `median_delta_lines` is **1** — the first rung in the series
  where the median paired shift is not zero.
- **NET, WHICH IS THE ONLY HONEST FORM.** Against the baseline: **1,060 games part LATER, 178
  EARLIER, 757 unchanged — net +882**. Against WIRE 6: **533 later, 174 earlier, 1,288 unchanged —
  net +359**. Games parting earlier is a trajectory reaching a different pre-existing bug sooner,
  not a regression, and the count is printed rather than netted away.
- **WHOLE-GAME AGREEMENT 33 → 64**, and 6 at the baseline.
- **DISTINCT MOVES CONNECTED 263 → 267**; census rows reached by a connecting move unchanged at 113.
- **`-damage field 3` 169 → 257 and distinct causes 1174 → 1261, both UP.** That is the trajectory
  working: games that survive 16 lines instead of 14 reach bugs the earlier arms never got to.

### WHICH OF THE SEVEN ACTUALLY MOVED ANYTHING — attributed, not assumed

Both arms re-run alone at 1,995 games under the same pinned census and asserted COMPARABLE by
`engine/arms_comparable.js`. Occurrences in the artifact's cause list, by family:

| family | WIRE 6 | WIRE 7 |
|---|---|---|
| `hospitality` | 251 | **0** |
| `knockoff` | 90 | 21 |
| redirect (`followme` / `ragepowder` / `lightningrod`) | 63 | 15 |
| `protean` / `typechange` | 39 | 19 |
| `sitrusberry` | 38 | 6 |
| `substitute` | 31 | 3 |
| `[eat]` dispositions | 35 | 6 |
| `focussash` | 7 | **3 — and NOTHING WAS WIRED FOR IT** |
| `shedtail` | 6 | 2 |

**Hospitality reaches zero.** Nothing else does, and what is left is named below rather than rounded
off.

### The boundaries — measured, declared, NOT fixed

- **Hospitality carries `onSwitchInPriority: -2`** and this engine speed-sorts entrants with no
  priority term, so it resolves too early against a priority-0 entry ability. Sixteen abilities in
  this format carry a switch-in priority and **`data/tags.json` carries none of them** — wiring it
  means typing sixteen names. It can only bite when a partner is ALREADY DAMAGED as the pair enters,
  which turn-1 leads never are; the family reads **0** occurrences in 1,995 games after the full-HP
  gate. Reported, not filed.
- **Shed Tail does not switch its user out.** `selfSwitch: 'shedtail'` passes the doll to the
  incoming body; `playerAction` classifies the move as `affect` (it carries a `statusInflict`
  volatile) and no pivot happens. The `passesState` tag is read by nothing. 64 uses.
- **Shed Tail's cost is `Math.ceil(maxhp / 2)` and this engine pays `floor`** — one HP on an odd-HP
  body. `costsUserHP.costsFraction` is `0.5` with no rounding hint in the artifact, so closing it
  means keying on the move's name. The DOLL's rounding was closed because `ceil(maxhp/4)` is one rule
  for both members of the tag and needs no name.
- **Lightning Rod does not draw a move aimed by the rod's OWN ALLY.** Showdown registers
  `onAnyRedirectTarget`, which fires for a move from either side; this engine looks for the rod among
  the ATTACKER's foes. Ten occurrences remain at the top rung, all `\|-activate\|lightningrod` present
  in Showdown and absent here.
- **Protean now converts on some moves Showdown fails outright.** `singleEvent('Try', ...)` runs
  BEFORE `PrepareHit`, so a move whose own `onTry` refuses never converts. The engine's `onTry`
  equivalents that emit `-fail` sit above the new conversion site for Sucker Punch and Steel Roller
  but not for everything; about nine of the nineteen surviving `typechange` rows are this shape, and
  some of those are Reflect Type rather than Protean. Traded a larger error for a smaller one and
  said so.
- **Libero is UNREACHABLE in this format — 0 legal carriers — and was not wired.** Confirmed against
  the roadmap's own instruction.

### Three instruments went red BECAUSE the engine got better, and all three are fixed here

**`tests/test-game-differential.js` — 4 FAILURES, every one of them good news.**

1. Two of the three §5a directed scenarios (`knock-off order`, `resist berry`) stopped diverging.
   Each `DIRECTED` entry now declares `expect: 'agree' | 'diverge'` with a `closed_by`, and the test
   fails just as loudly if a closed case RE-OPENS. A prediction that came true is a claim, not a mute.
2. **A scripted game ran past the end of its script.** Every `DIRECTED` entry carries a ONE-turn
   script and the loop only ever ran one turn because every scenario diverged on turn 1. When two
   started agreeing the loop ran on, `scripted()` returned `pass` for a slot with no step, and
   Showdown rejected the choice — so a FIXED ENGINE reported as `THREW: … Can't pass`. A scripted
   game now ends when its script does.
3. The `ordering` acceptance test needs TWO scenarios and WIRE 7 closed one of them. **The bar was
   not lowered.** A replacement was staged from the ladder's own surviving causes — Electro Shot's
   `\|-prepare\|` against the `\|-boost\|spa\|1` it grants, 2,579 corpus uses, Archaludon its only
   carrier here — and it parts exactly as predicted.
4. PART 3c asserted that medicham2 records Colbur as KNOCKED OFF. It records it as EATEN now; the
   assertion is inverted and KNOCKED-OFF is the failure.

**`engine/wire_ladder.js` REFUSED TO PUBLISH THE WIRE 7 ARM, and it was right.** *"the verbose stream
carries 1994 games and the artifact says 1995"* — one game THREW. Root-caused rather than worked
around: Showdown's request for a **recharging** body carries one pseudo-move, `recharge`, which is not
a dex entry, so `chooseAction` dropped every candidate, `trapped: true` left no switch, and the driver
answered `pass` — which Showdown rejects. A pre-existing hole in the driver that WIRE 7's deeper
trajectory reached first. The fallback is `move 1`, and it is COUNTED as
`declared_gaps.forced_first_slot` (**1** in 1,995 games) because a silent one looks exactly like a
working feature.

**`engine/conformance.js` RATCHET BROKEN — 1 new finding, `engine/wire_ladder.js` names
`move:protect`.** It had typed the starved swarm configurations into a prose field
(`omit-protect: 84 teams available`). S12b matched a diff_swarm CONFIG ID rather than a move, and it
was still right for its own reason: a name typed there goes stale the moment the swarm's configuration
list changes. Read off the baseline arm's own `swarm` block now. **RATCHET — 96 baselined, 0 new.**

### Red on the runner and NOT this wire's

- `tests/test-prng.js` — `tests/test-protocol-trace.js`'s LCG. Documented as red before this wire,
  MEASURE's rule, untouched.
- `tests/test-stadium-roster.js` — the GURU hole, `docs/MODELS.md` is MEASURE's. Untouched.
- `engine/provenance.js --strict` — `exploitability.json`, DECLARED VOID by its own generator and
  ratcheted. Pre-existing.
- `tests/test-site-data-fresh.js` — every site bundle behind the game store by 0.6d, plus three stale
  fits. OPS appends continuously; untouched by this wire.
- `tests/test-wiring.js`, `tests/test-forced-switch.js`, `tests/test-team-preview-race.js` — FAIL
  under `run-all` and PASS standalone (`test-wiring` reports mega 5.33/game alone and 0.00 under the
  runner). That is filed as 18 and is a property of the runner.
- **`node engine/status.js` opens with FEATURE SEMANTICS CHECK FAILED on eight features.** Three of
  them (`switchSurvives1`, `switchKOSlow`, `switchDiesFirst`) are ROADMAP #31's, recorded below with
  the identical digests; the other five are damage-shaped and moved with WIRE 4's fixed point. **This
  wire adds to it and cannot close it: a refit is MEASURE's.** Routed, not filed.
- `tests/test-interaction-matrix.js --full` runs and the SHRINK GUARD refuses to publish — 1,574 live
  cases against the artifact's 1,643, so the generated block above still quotes 2026-08-06. The
  shrink is **structurally not this wire's**: the LIVE/INERT split is decided by the REFERENCE
  engine's two arms and the emitted count by `data/tags.json` × `MC.mons`, neither of which medicham2
  can touch. Agreement on what DID run: **1,557/1,574 (98.9%)**.

### A NOTE ON `tests/test-mechanics.js` AND THE PIN

It was run — landing seven probes requires it — and **it did not invalidate the ladder**, because
`engine/wire_ladder.js` steers from `data/wire-ladder-census.pin.json` and never from the live census.
The pinned digest is `f63179105d3c` and the live one is now `acf001302733`; the artifact records both
and says they differ. That separation is exactly what WIRE 5 built.

## ROADMAP #81 WIRE 5 — THE INSTRUMENT WAS STEERED BY A FILE NOBODY HAD LISTED, AND WIRE 4's TABLE DOES NOT REPRODUCE. 2026-08-07.

Census **249 live / 250 probed → 249 live / 250 probed** — unchanged, and deliberately: this is a
measurement-integrity wire and no mechanic moved. `tests/test-mechanics.js` was **not run**, because
running it regenerates the very file this wire pins.

**THE DEFECT.** `covWant()` in `engine/game_differential.js` scores every legal action by the
least-exercised row of `data/mechanics-census.json`, so the census decides which moves the driver
clicks and therefore **which games the run plays**. The census is regenerated by
`tests/test-mechanics.js` — which is what ENGINE runs after landing every probe. Landing a probe
changes the sample the differential measures. Four WIREs were reported as before/after pairs and all
four landed probes into the census in the same session.

**AND THERE WAS A SECOND ONE, FOUND WHILE FIXING THE FIRST.** `diff_swarm.buildSwarm` reads
`data/games.bo3.jsonl` and `data/games.ots.jsonl` **live**, dedupes to distinct teams, and picks by a
**stride** over the matching set — so one appended game shifts the stride and changes which teams get
played. OPS appends to that store continuously; it moved twice during this wire's own test runs.

### The option taken, and why the other two are wrong

| | verdict |
|---|---|
| **(1) add the census to `engine_release.js`'s SOURCES** | **REJECTED, and not on taste.** A before-arm is run as `--release <old-id>`. With the census inside the release the before-arm reads the OLD census and the after-arm the NEW one, so **the two arms would steer differently by construction** — it makes each run individually reproducible and every before/after pair non-comparable, which is the failure being fixed. It is also unworkable: the census carries a `generated` stamp, so its bytes change on **every** run of `test-mechanics.js` even when no mechanic moved (measured: content digest `28203348a7ff` stable, file digest `c6be796631be` not). Every test run would fork a release id and `drift()` would never read zero |
| **(2) a run-local snapshot taken once at start** | **REJECTED — it fixes nothing that is broken.** The differential is single-process and already reads the census exactly once at module load. There is no mid-run drift. The failure is BETWEEN arms and a run-local snapshot says nothing about the other arm |
| **(3) declare the policy, digest it, pin it, and refuse an incomparable pair** | **TAKEN** |

`engine/steering.js` resolves the selection input, refuses to run on one that is unreadable, unparsable
or empty (an empty census makes `covWant` return `Infinity` for everything and the driver falls back to
click order — a run with no steering that looks exactly like a run), and returns a block that goes
straight into the artifact:

```
"steering": { "policy": "census-coverage-seeking/v1", "input_digest": "c6be796631be",
              "input_rows": 250, "input_generated": "…", "pinned": true, "matches_live": true,
              "team_pool_digest": "19174ee16416", "team_pool_teams": 7360, "team_pool_picked": 791 }
```

`--census <file>` pins both arms to the same bytes. `--baseline <artifact>` **refuses to start**, exit
3, before a single game is played. `engine/arms_comparable.js` is the same check over two artifacts
already on disk, which is the reporting act that actually went wrong. **An artifact with no `steering`
block fails CLOSED** — every artifact written before tonight has none, and the honest verdict for those
is "nothing recorded whether they were comparable", never "they were".

### The red demonstration — `tests/test-arm-steering.js`

The control is cleared first, because identical results across a varied knob mean the knob is unwired.

| | result |
|---|---|
| **1 GREEN CONTROL** two arms, same release, byte-identical census | **identical numbers**, guard says COMPARABLE (exit 0) |
| **2 THE KNOB IS WIRED** same frozen release `45485dee6a43`, census minus 43 move rows | **the numbers move.** `unrelated event mismatch` 20 → 16, `ordering` 6 → 9, `event missing` 17 → 18, `-damage field 3` **2 → 1**, moves connected 76 → 80 — on 51 games with **the engine byte-identical** |
| **3 RED** the guard on that pair | **NOT COMPARABLE, exit 1**, naming both digests |
| **4 RED, EARLIER** `--baseline` against it | **exit 3, no artifact written, no game played**; the control (`--baseline` with the same census) runs normally |
| **5 FAILS CLOSED** an artifact declaring no steering | NOT COMPARABLE, with the reason |

`-damage field 3` — the family WIRE 4 reported on — **moved on a census change alone.**

### WIRE 4's numbers do NOT hold. The conclusion does.

Both arms re-run tonight at 395 games, `--census` pinned to one file (`c6be796631be`), same team pool
(`19174ee16416`), asserted COMPARABLE by the instrument itself. **The before-arm was then run a third
time and reproduced the first exactly**, so what follows is input, not noise.

| | WIRE 4 published | controlled re-run | |
|---|---|---|---|
| **`-damage field 3`, before-arm** | 46 games / 45 causes | **59 / 56** | |
| **`-damage field 3`, after-arm** | 31 / 31 | **38 / 35** | |
| the effect | −33% games, −31% causes | **−36% games, −37.5% causes** | direction and magnitude **hold** |
| of those, `[from]recoil` | 4 → 2 | **8 → 0** | stronger |
| diverged | 391 → 390 | **392 → 389** | |
| `-heal field 3` | 2 → 0 | **3 → 0** | |
| `-immune field 3` | 1 → 0 | **1 → 0** | holds exactly |
| classes | 12 → 12 | **10 → 10** | |
| distinct moves connected | 177 → 176 (−1) | **175 → 173 (−2)** | the coverage loss is **twice** what was reported |
| census reached by a connecting move | 107/112 → 107/112 | **107/112 → 107/112** | holds exactly |

**EVERY ABSOLUTE FIGURE IN WIRE 4's DIFFERENTIAL TABLE IS RETRACTED. The finding is not.** The
arithmetic fix still removes a third of a 56-cause family and takes `[from]recoil` to zero, which is
more than was claimed, and the two `field 3` classes it emptied are still empty. What cannot be
defended is any specific number, and the receipts for why are exact: WIRE 4's after-arm was written at
**06:51:15**, the live census was regenerated at **06:57:42 — six minutes later**, so the census those
arms ran under no longer exists; and the game store has grown since (ladder store 206,789,118 B at
WIRE 4's assertion, 207,410,186 B now), so the team pool is not the one it sampled.

`data/game-differential.json` is now the controlled after-arm and is the first differential artifact to
carry a `steering` block and a `baseline_comparability` verdict.

### Filed, not fixed

12. **THE DRIVER ITSELF IS NOT DIGESTED ANYWHERE.** `engine/game_differential.js` is the instrument,
    not the engine, so it is correctly outside the release — and no artifact records its content
    digest, so two arms taken either side of an edit to it cannot be distinguished from two arms taken
    either side of an engine change. WIRE 4 asserted it by hand. `arms_comparable.js` prints this as a
    stated limit rather than passing over it.
13. **`data/protocol-events.json` IS A THIRD UNLISTED INPUT.** It is the declared skip list: it decides
    which Showdown lines are removed before alignment, so a change to it moves every class count in
    every table above. Not stamped, not compared.
14. **THE COMMENT ABOVE `COV_TARGETS` IS STALE AND SAYS `235 rows / 192 measurable / 43`.** The run
    prints 250 / 205 / 45. Cosmetic, but it is a number in prose describing a corpus, which is the
    thing this project has already learned prose cannot do.

## ROADMAP #81 WIRE 6 — TWO ACTION KINDS OUT OF TWENTY-SEVEN NEVER SAID WHAT THEY DID, AND EVERY RULE KEYED OFF THE MOVE ID SKIPPED THEM. 2026-08-07.

Census **249 live / 250 probed → 251 live / 252 probed**, `unarmed` 0, `directCall` 0, `hollow` 0,
`threw` 0. Red demonstrations **139 → 142, 0 failed** (three new, a different broken engine each).

**THE DEFECT, AND IT IS A FAMILY RATHER THAN A MOVE.** `playerAction` resolves a click to one of
**27 action kinds**. Every rule that sits above the kind dispatch — the Taunt refusal (WIRE 119), the
Throat Chop silence (WIRE 77), the priority bracket, and the `|move|USER|MOVE|TARGET` line the
protocol trace emits — asks `actionMoveId(a)` which move was clicked. `actionMoveId` read `a.mv`, and
for the kinds that carried none it fell back to `KIND_MOVE`, **three hand-written rows**. Two kinds
were not in those three rows:

| kind | moves | corpus uses | what it announced |
|---|---|---|---|
| `trickroom` | 1 | **8,077** | nothing |
| `pass` — the engine models no effect for the click | **46** (Quick Guard 803, Ally Switch 190, Instruct 173, Heal Pulse 126…) | 2,145 | nothing |
| the other 25 kinds | 454 | — | correctly |

Trick Room's *mechanic* has been green for weeks — `reversesSpeed` has a probe, the turn really does
invert. What was missing was the **announcement**, and no probe in `tests/test-mechanics.js` could
tell those two apart because every probe in it reads state.

### The fix is at the root: an action carries the move that made it

`playerAction` now stamps `mv` on every action it builds, including `{kind:'pass',mv:id}` — an
unmodelled click is still a click — and the emit gate's `&& a.kind!=='pass'` is gone. `KIND_MOVE`
stays as the backstop for a bare action a **caller** hand-built; a bare `{kind:'pass'}` (the idle ally
in ~200 probes, `game_differential`'s empty slot) still has no `mv` and still announces nothing, so the
two meanings are distinguishable, which they were not.

**AND IT MOVED THREE OTHER RULES, WHICH IS THE POINT OF FIXING A ROOT AND ALSO THE RISK.** Measured
directly against the frozen release rather than argued:

| move | real bracket | before | after |
|---|---|---|---|
| Quick Guard | +3 | **0** | +3 |
| Ally Switch | +2 | **0** | +2 |
| Counter | −5 | **0** | −5 |
| Mirror Coat | −5 | **0** | −5 |

Taunt and Throat Chop now refuse these 46 moves as well, which is correct (45 of them are
`statusCategory`) and emits `|cant|` where the engine used to emit nothing at all. The one hazard is
named rather than assumed: the `costsUserHP` charge sits above the kind dispatch too, and **no move
that lands on `pass` carries that tag** (checked over the whole of `MC.moves` against
`data/tags.json`). If one ever does it would pay HP for an effect the engine does not grant, which is
WIRE 130's exact shape.

### How much of the family this actually explains — 27 of 133, and the honest bound

The target was the largest class in the controlled artifact, `event missing from medicham2`. In the
**before-arm taken for this wire** it is 133 games / 107 distinct causes. Sorting its causes by the
corpus usage of the entities they mention, and asking the **frozen before-engine** which of them
resolve to a silent action kind:

| | games |
|---|---|
| the family | 133 |
| first divergence is a missing `\|move\|` line | **56** |
| …of those, the move resolves to a **silent action kind** — the root above | **27** (Trick Room 20, Heal Pulse 3, Quick Guard 2, Wish 1, Role Play 1) |
| …of those, the move resolves to a LOUD kind and the line was lost for another reason | 29 |
| first divergence is some other event entirely | 77 |

**So the root explains 27 of 133 — 20% of the family — and not one game more.** The other 106 are
led by `-fail` (22), `-activate` (15), `-immune` (15), `-prepare` (15) and `-enditem` (11); the 29
loud-kind ones are a **turn-order / spread-target** shape, not this one — `|move|p1b: Garchomp|Earthquake|p2b: Venusaur|[spread] p2b`
against our `|move|p1a: Dragonite|hurricane|p2a: Charizard`, where Showdown's line never reappears in
our stream *identically* because the target field differs, so the classifier files an ordering fault
as a missing event. **That is a separate WIRE and it is filed below.**

After the wire the **whole** `|move|`-head sub-family is empty (56 → 0), which is more than the 27 the
root accounts for; the rest is the priority correction above reordering turns that were parting for
ordering reasons. Both effects are the same change and neither is separable from the other in this
instrument, so **27 is what is claimed and 56 is what is observed**.

### Before / after, and the instrument's own verdict

Both arms 346 games, mode A, `turns_cap` 12, `--census` pinned to one file (`c6be796631be`), taken
back-to-back so the live game store could not move between them. `node engine/arms_comparable.js`:

> **COMPARABLE.** Both arms selected their sample the same way, so a difference between their numbers
> is the change under test.
> before release `45485dee6a43`, steering `c6be796631be`, 346 games — after release `3fd06d865427`,
> steering `c6be796631be`, 346 games.

| class | before | after | |
|---|---|---|---|
| **event missing from medicham2** | **133 / 107** | **120 / 113** | the target |
| …of which a missing `\|move\|` line | **56** | **0** | |
| unrelated event mismatch | 84 / 57 | 91 / 60 | |
| ordering | 49 / 41 | 50 / 41 | |
| extra event emitted by medicham2 | 39 / 32 | 42 / 35 | |
| `-damage field 3` | 19 / 19 | 24 / 23 | |
| **turn order** | **9 / 9** | **0 / 0** | |
| `switch: a different body` | 4 / 4 | 4 / 4 | |
| `-start field 4` | 2 / 2 | 2 / 2 | |
| `-activate field 4` | 2 / 2 | 2 / 2 | |
| `-status field 4` | 1 / 1 | 3 / 3 | |
| `-start: a different body` | 1 / 1 | 2 / 2 | |
| `-heal field 3` | 0 | 1 / 1 | |
| diverged | 343 | **341** | of 346 |
| classes | 11 | 11 | |
| threw | 1 | 1 | |

**THE FAMILY FELL BY 13 AND ITS DISTINCT CAUSES ROSE BY 6, AND THAT IS THE WIRE WORKING RATHER THAN
HALF-WORKING.** Emitting a line the engine owed pushes the first divergence LATER into the game, so
games leave this class and games arrive in it from elsewhere. `diverged` moved 343 → 341, which is the
only number here that says two whole games now agree end to end. **A class count is a
first-divergence count and nothing else; it is not a bug count.**

`data/game-differential.json` is the after-arm above, verbatim.

### Coverage direction — the largest gain of the series

| | before | after |
|---|---|---|
| **distinct moves connected** | 177 | **197 (+20)** |
| distinct species | 258 | 260 |
| distinct abilities | 161 | 162 |
| census rows reached by a connecting move | 108 / 112 | 108 / 112 |
| `not_exercised` | 5 | 5 — **membership swapped**: `move:reversesSpeed` left, `move:inflictsToxic` arrived |
| clicked but always missed (the Mode A pin) | 47 | 46 |

WIRE 3 gained five distinct moves and WIRE 4 lost one. This gains twenty, because 46 moves the engine
had been resolving into silence now register as connected.

### The three red demonstrations, one per site

| broken engine | what it must break |
|---|---|
| `{kind:'trickroom',mv:id}` → `{kind:'trickroom'}` | Trick Room announces the move that set it |
| `{kind:'pass',mv:id}` → `{kind:'pass'}` | Quick Guard and Psych Up announce themselves |
| the emit gate `if(TR&&_mid)` → `if(TR&&_mid&&a.kind!=='pass')` | the gate is on THE MOVE, not on the kind being liked |

Each carries the same two controls, asserted on **both** engines: an ordinary Earthquake announces
itself, and a body that PASSED announces nothing. Without the second one these would be watching "the
trace emits `|move|` at all". A **fourth** reversal had to be repaired rather than added —
`ARM doublesSideSpeed` reverts `if(id==='tailwind')return {kind:'tail'};` and that line now carries an
`mv`; `revertedEngine` refused to apply the patch and threw, which is that guard doing its job.

### AND MY OWN PROBE WAS WRONG BEFORE THE ENGINE WAS. THAT MAKES FORTY.

The first `moveLines()` helper filtered the trace on `l.split('|')[3] === (mv || ' ')` — so the
no-click **control** compared the move name against nothing and could only ever return zero. A control
that cannot fail is the hollow shape this whole file exists to catch, written straight into the probe
meant to catch it. The helper now returns every `|move|` line the acting body emitted and the probe
does the naming.

**AND THE RATCHET CAUGHT BOTH NEW PROBES AS DIRECT CALLS ON THEIR FIRST RUN** — `directCall` went
0 → 2 and the file went red — because `REALTURN` matches the probe's own source and `moveLines(` was
not in it. It is declared there now, with its reason, exactly as that comment requires. That is a gate
that could have been softened by renaming a helper, and was not.

### THE SKIP LIST MOVED UNDER THE TABLE, AND THE TABLE REPRODUCED EXACTLY

`data/protocol-events.json` is derived from `medicham2-browser.js`'s `add()` claims, so changing the
engine staled it — `engine/provenance.js` read it UNSAFE, *COMPUTED FROM DIFFERENT CONTENT*. It was
regenerated (`derive_protocol_events.js --write`, both gates pass, 38 emitted / 56 declared-not-emitted
/ 10 partial, unchanged) **and both arms were then re-taken under the new file**, because it is WIRE
5's filed item 13 — the skip list decides which Showdown lines are removed before alignment, so a
change to it can move every count in the table above.

**Every figure in the table reproduced to the digit** — all twelve class counts, all twelve cause
counts, `diverged` 343 → 341, connected 177 → 197, `not_exercised` membership, `threw`. So the
regeneration was stamp-only in effect, the pair is comparable both to itself and across the change,
and the instrument has now been shown deterministic across a third input as well. `arms_comparable.js`
returns COMPARABLE on the re-taken pair, and `data/game-differential.json` is that after-arm.

### Three tests were red beside this work. One was ENGINE's and is FIXED here; two are not ENGINE's

**FIXED — `tests/test-tag-wire.js`, and it was WIRE 4's, not this one's.** `rain Solar Beam lands at
x0.545 of clear-sky` against a `< 0.03` tolerance. The probe aimed a Grass move into a Fire/Dark
Incineroar, where it is resisted twice over and the top roll is **22 points** — so a single damage
point is 4.5% and no engine could meet a 3% ratio. Showdown's base-damage formula ends `floor(…) + 2`,
so halving the BASE POWER cannot halve the DAMAGE; the flat +2 survives. Measured against the frozen
releases: `cf6a68fa412c` (pre-WIRE-4) 22 → **11**, an exact 0.500 — **the probe was passing because
the engine truncated a float**. `45485dee6a43` (post-WIRE-4) 22 → **12**. WIRE 4 corrected the
arithmetic and the probe went red on the better engine, and it stayed red through WIRE 5. The arm now
aims at a Milotic, where the +2 is 1.4% and the ratio reads 0.514. **The tolerance was not widened and
the claim was not weakened** — with `weatherScaled` stripped from the artifact the same assertion
reads x1.000 and still fails, checked.

**RED, NOT ENGINE's, NOT FIXED — reported.**
- `tests/test-prng.js` — *no file multiplies its state by 1103515245 in float arithmetic — found in:
  `tests/test-protocol-trace.js`*. That constant is inside a file this division owns but the check
  belongs to MEASURE's PRNG rule; the LCG there is a fixture generator, not a sampler feeding a
  bootstrap. Untouched by this wire and red before it.
- `tests/test-stadium-roster.js` — `engine/diff_swarm.js` and `engine/mega_decision_census.js` are in
  neither `docs/MODELS.md` nor the `NOT_A_MODEL` table. **The GURU hole**, and the file says in as
  many words that `docs/MODELS.md` is MEASURE's. Untouched by this wire.
- `engine/provenance.js --strict` — exit 1 on `exploitability.json`, **DECLARED VOID by its own
  generator**, which is a recorded decision and is ratcheted. Pre-existing.

**AND `tests/run-all.js` REPORTS FAILURES ITS OWN TESTS DO NOT REPRODUCE.** Across two full runs,
`test-forced-switch`, `test-team-preview-race`, `test-wiring` and `engine/validate_selfplay` failed
under the runner and pass standalone (exit 0, 16/16 and 58 features respectively); `test-wiring`
reported *mega 0.00 per game* under the runner and its normal rate alone. The set of failures differed
between the two runs, which is the signature. That is a property of the runner, not of the engine, and
it means **a FAIL line in run-all is not evidence on its own** — every one above was re-run alone
before it was believed or dismissed. Filed as 18.

**CAUSED BY ME AND FIXED IN THE SAME PASS.** `tests/test-web-status.js` was red at *engine.probed =
235 but the census says 252*; the census had moved and the board had not, so `node web/build-status.js`
was run — the rebuild that test itself prints. That then reddened `tests/test-site-sync.js`, because
`web/status-data.js` and `app/status-data.js` must be byte-identical and only `web/` had been written.
`cp web/status-data.js app/status-data.js`, the procedure that test's own header documents. Both green.


### Filed, not fixed

15. **`{kind:'struggle'}` IS RETURNED AND NEVER DISPATCHED.** `chooseAction` returns it in three
    places; no branch of the executor handles it and it carries no `mv`, so a struggling body does
    nothing and announces nothing. Not in this wire's sweep because `playerAction` never produces it.
    Reachable when a body has no attacking move it may click.
16. **AN ORDERING FAULT IS BEING FILED AS A MISSING EVENT — ~29 GAMES.** `classify`'s lookahead asks
    whether the other engine's line reappears *identically*. A spread move's `|move|` line carries
    `[spread] p2b` and a redirected one carries a rewritten target, so a genuine turn-order difference
    on Earthquake reports as `event missing from medicham2`. This is the largest remaining share of
    that class and it belongs to the instrument, not to the engine.
17. **`movePriority` READS 0 FOR METAL BURST AND COMEUPPANCE**, whose real bracket is −4. Found while
    verifying the four brackets above; it is an artifact gap, not a `playerAction` one.
18. **`tests/run-all.js` PRODUCES FAILURES ITS OWN TESTS DO NOT REPRODUCE**, a different set on each
    run, on tests that spend real games. Every FAIL from it now has to be re-run alone before it means
    anything, which is a tax on every division. Not diagnosed here; it is the runner, not a test.


## ROADMAP #81 WIRE 1 — A PROTECT BLOCK WAS BEING RESOLVED AS A TYPE IMMUNITY AND AS A MISS, AND THE CRASH IT OWES WAS NEVER PAID. 2026-08-07.

Census **240 live / 241 probed → 243 live / 244 probed**, `unarmed` 0, `directCall` 0, `hollow` 0.
Red demonstrations **128 → 132, 0 failed** (four new, a different broken engine each).
Whole-game differential, the same 395 games against two frozen releases that differ in exactly one
file: **394/395 diverged → 394/395. THE RATE DID NOT MOVE AND NEITHER DID THE MEDIAN.** What moved is
that the target cause is gone — **6 games' first divergence → 0** — and that 6.6% more protocol was
compared for the same games.

**ONE ROOT, THREE SITES: THE HIT STEPS WERE IN THE WRONG ORDER.** Showdown's `trySpreadMoveHit`
(`sim/battle-actions.ts:553-576`) runs 0 invulnerability, **1 TryHit — where Protect lives** — 2 type
immunity, 3 move-specific immunity, **4 accuracy**. medicham2 rolled accuracy first, then checked the
type chart, and only then the shield. So a shield lost two races it always wins in the real game:

```
supercellslam -> a Protecting Garchomp      SD |-activate|p2a|move: Protect     MC |-immune|p2a
a 90%-accuracy move -> a Protecting body     SD |-activate|p2a|move: Protect     MC |-miss|p1a|p2a
```

**THE EXPENSIVE HALF IS NOT THE PROTOCOL LINE.** `crashOnMiss` was consumed at exactly one site — the
accuracy roll — and Showdown fires the crash from `singleEvent('MoveFail', ...)`
(`battle-actions.ts:526`), which runs on ANY falsy move result. High Jump Kick's crash is an
`onMoveFail` handler, so **a shield makes the hit fail and the crash lands.** Measured in the
authority, both dice pinned, before a line of this changed:

```
High Jump Kick -> a Protecting Garchomp   |-activate|p2a|move: Protect
                                          |-damage|p1a: Hitmonlee|63/125|[from] highjumpkick
High Jump Kick -> Gengar (Ghost)          |-immune|p2a
                                          |-damage|p1a: Hitmonlee|0 fnt|[from] highjumpkick
Supercell Slam -> Ground behind a Spiky Shield
                                          |-activate|p2a|move: Protect
                                          |-damage|p1a: Bellibolt|97/184|[from] Spiky Shield|[of] p2a
                                          |-damage|p1a: Bellibolt|5/184|[from] supercellslam
```

medicham2 charged nothing in any of the three. High Jump Kick is on **146 sets**, Supercell Slam
**88**, Axe Kick carries the same tag: a 130 BP move with no downside against the most-clicked move in
the format is the "priority move with no drawback" shape that WIRE 47 was written to remove, left open
on the half nobody had measured. The `[from]` field was wrong too — `Recoil`, where the authority
prints the move's own id — and that was one game of the differential on its own.

**THE PROTECTION-COUNTER CLAIM IN THE SPEC IS WRONG, AND IT IS CORRECTED RATHER THAN WORKED AROUND.**
ROADMAP #81 asked for an assertion that *the protection counter increments on a block and not on an
immunity*. It does not: Showdown's counter is the `stall` volatile, added by Protect's own
`onHit` — i.e. by consecutive USE — and it is indifferent to whether anything was blocked. Measured in
a real battle: a Protect that blocked nothing still carries `stall {counter: 3}`. What genuinely
separates the two states is the **contact toll**, so that is what the probe asserts, on HP:

```
Body Slam (Normal, contact) -> Gengar behind a Spiky Shield   |-activate| + 1/8 of the attacker
the same click with the shield down                           |-immune|   + nothing
```

**FOUR PROBES, EACH SHOWN RED ON ITS OWN BROKEN ENGINE** (`tests/probe_red_demo.js`, `demoSource` —
there is no tag to strip, because `crashOnMiss` and `punishesContact` were both already consumed and
what changed is the ORDER):

| probe | census row | the broken engine it is red on |
|---|---|---|
| a blocked High Jump Kick still pays its crash | `move crashOnMiss` | the crash paid only off the accuracy roll |
| a High Jump Kick that hits nothing but a type immunity pays its crash | `move crashOnMiss` | the post-loop MoveFail test removed |
| a Spiky Shield answers before the type chart | `move punishesContact` | the old gate order, immunity first |
| a shield blocks a move whose accuracy die missed | `move stalling` | the roll hoisted back above the shield |

**WHAT THE DIFFERENTIAL SAYS, BEFORE AND AFTER, ON THE SAME 395 GAMES.** The two arms are the frozen
releases `0771dc47b5f6` and `41e28311e591`, whose manifests differ in `engine/medicham2-browser.js`
and in nothing else — a controlled experiment rather than two runs.

| | before | after |
|---|---|---|
| diverged | 394 / 395 | 394 / 395 — **unchanged** |
| median completed turns before divergence | 1 | 1 — **unchanged** |
| **`-activate protect <> -miss` / `<> -immune` as the FIRST divergence** | **6 games** | **0** |
| classes | 14 | 13 |
| `-miss field 3` | 1 game | **0** |
| `-damage field 4` (the crash's `[from] recoil`) | 2 games | **1** — only the unrelated Infestation cause left |
| `-start field 3` | 2 games | 1 |
| `ordering` | 43 games | 40 |
| `extra event emitted by medicham2` | 37 games | 32 |
| `unrelated event mismatch` | 116 games | **125** |
| `event missing from medicham2` | 128 games | **129** |
| normalised protocol lines compared | 19,906 | **21,214** (+6.6%) |
| distinct moves the driver got to CONNECT | 171 | 173 |
| census mechanics reached by a connecting move | 103 / 109 | 104 / 109 |

**THE RATE DID NOT MOVE, THE MEDIAN DID NOT MOVE, AND TWO CLASSES GOT BIGGER. That is the correct
shape of this result and it is not a disappointment.** A game stops at its FIRST divergence, so
removing a first-turn cause does not make the game agree — it makes the game run on and part deeper,
at whatever was behind it. That is why `unrelated event mismatch` and `event missing` grew while the
target cause emptied, and it is why the only aggregate that can show the gain is DEPTH: 6.6% more
protocol compared for the same 395 games, two more moves connected, one more census mechanic reached.
The median stays at one turn because the causes that dominate it — the Hospitality heal, the Trick
Room field line, and the consecutive-Protect failure filed as (1) below — are untouched by this wire.

**AND THE FIRST VERSION OF THIS TABLE WAS WRONG, IN THE FLATTERING DIRECTION.** It read
`395/395 → 394/395` and called that game the first this instrument had ever seen agree. It was not
the wire. **`engine/diff_swarm.js` draws its teams from the LIVE store, and the store is not in the
frozen release** — `data/games.ladder.jsonl` and `data/games.bo3.jsonl` were both appended to at
04:03, between the two arms, which changes the deterministic stride and therefore which 395 games get
played. Re-run back to back with the store's size and mtime asserted identical before, between and
after, both arms read 394/395. **This is the 2026-08-04 void arriving through a door the release rule
does not cover: 23 files are frozen and the INPUT CORPUS is not one of them.** Filed as (4) below.

**FOUR THINGS FOUND ON THE WAY, FILED AND NOT FIXED — they are WIRE 2+, not this one:**

1. ~~**The stall counter never resets…**~~ **LANDED AS WIRE 2, below.** The census carries both halves
   now, so this line is closed rather than carried.
2. **The shield's own two emits are one field off.** Showdown writes
   `|-damage|…|[from] Spiky Shield|[of] p2a: X` and `|-singleturn|X|move: Protect` for the punishing
   shields; medicham2 writes `[from] move: spikyshield` and a bare `|-singleturn|X|Protect`. The
   canoniser folds case and spaces but not the colon, so both part the streams on a line the differ
   compares. Reachable far more often now that blocks resolve properly.
3. **`data/interaction-matrix.json` is stale against `data/tags.json`** — tags.json moved at 23:33 on
   2026-08-06, after the matrix was published at 21:50, so the generator now emits 1,574 LIVE cases
   against the artifact's 1,643 and the shrink guard correctly refuses to publish. Re-run at `--full`
   on this engine reads **1,557 / 1,574 (98.9%)** and the parting list loses exactly two rows —
   `gigaimpact -> spikyshield` and `supercellslam -> kingsshield`, the pair this ledger already had as
   *"crash damage on a blocked move"* — with nothing new appearing. Whether to republish under a
   declared reason is MEASURE's call, not this dispatch's.
4. **THE DIFFERENTIAL'S INPUT CORPUS IS NOT IN THE PHOTOGRAPH.** `engine/diff_swarm.js` calls
   `loadTeams()` against the live `data/games.*.jsonl`, and the 23 frozen files do not include them.
   The store grew mid-session — an ingest appending, which is OPS working normally and not a
   violation of anything — and the two arms of a before/after therefore played different games. It
   cost nothing here only because the discrepancy was large enough to notice and the run is cheap
   enough to repeat; a slower measurement would have published the difference. The fix belongs to
   whoever owns `engine_release.js`'s `SOURCES`: either freeze a team MANIFEST (the picked team ids
   are already in `data/diff-swarm.json`) or have the swarm read the corpus through `REL`. Until then
   **any before/after on this instrument must assert the store's size and mtime unchanged across both
   arms**, which is what the numbers in the table above did.

## ROADMAP #81 WIRE 2 — THE `stall` VOLATILE HAD ONE OF ITS THREE RULES. 2026-08-07.

Census **243 live / 244 probed → 244 live / 245 probed**, `unarmed` 0, `directCall` 0, `hollow` 0.
Red demonstrations **132 → 134, 0 failed** (two new, a different broken engine each). The whole-game
differential's target family — `|-singleturn|X|protect <> |-fail|X` and its mirror — **37 games → 7**,
and the seven that remain are named below.

**WHAT WAS WRONG.** Every shield in Showdown's `data/moves.ts` — protect, detect, spikyshield,
kingsshield, banefulbunker, and both Guards — opens with the same two lines, and medicham2 implemented
the middle third of them:

```ts
onPrepareHit(pokemon) { return !!this.queue.willAct() && this.runEvent('StallMove', pokemon); }
onHit(pokemon)        { pokemon.addVolatile('stall'); }
// data/conditions.ts, stall:
onStallMove(pokemon) { const success = this.randomChance(1, counter);
                       if (!success) delete pokemon.volatiles['stall']; return success; }
```

1. **THE COUNTER IS DELETED THE INSTANT THE ROLL FAILS**, so the shield after a failed one is a
   guaranteed 100% again. medicham2 incremented `tookProtectTurns` on every attempt and never brought
   it back down: a body that lost one roll kept decaying 1/27, 1/81, 1/243 for the rest of its life on
   the field. `counterMax: 729` is 3^6, so the depth caps at six and now does here too.
2. **A SHIELD FAILS OUTRIGHT WHEN ITS USER HOLDS THE LAST ACTION OF THE TURN.**
   `BattleQueue.willAct()` (`sim/battle-queue.ts:310`) returns the first `move`/`switch`/`instaswitch`/
   `shift` still IN THE QUEUE BEHIND the current action, and the shield fails if there is none. It is
   **short-circuited before `runEvent('StallMove')`**, so a shield that moves last draws no die and does
   not touch the counter at all. medicham2 did not model it in any form. In a format where Protect is on
   99.30% of declared teams this is not an edge case: four bodies clicking a shield in the same turn
   means the slowest one fails, every time.

**THE POSITION OF THE PRE-PASS IS NOW PART OF THE MECHANIC.** WIRE 119's shield pre-pass ran ABOVE
`sortTurnOrder`, which was fine while the only question a shield asked was "how many in a row". Rule 2
can only be answered by the RESOLUTION ORDER, so the pre-pass moved below the sort. Nothing between the
two points reads `protect` or `tookProtectTurns` — Protect's +4 comes from the move table and the Quick
Claw roll is per-item — so this is a move and not a re-ordering of the mechanic. It does shift the RNG
stream for a turn carrying BOTH a Quick Claw holder or a speed tie AND a repeated shield; the census is
the guard on that and it did not move.

**TWO PROBES, EACH SHOWN RED ON ITS OWN BROKEN ENGINE** (`tests/probe_red_demo.js`, `demoSource` — the
`stalling` tag is already consumed, so there is nothing to strip and the breakage has to be the
behaviour). Both read HP, never a `-singleturn` line:

| probe | what separates the engines | the broken engine it is red on |
|---|---|---|
| `consecutive Protect decays, and a FAILED Protect resets the counter to fresh` | turn **4** of four Protects at a fixed roll of 0.2: `0, 0, 158, 0` fixed against `0, 0, 158, 158` | the counter increments on every attempt and is never deleted |
| `Protect FAILS outright when its user holds the LAST action of the turn` | turn 2 behind a shield at a losing roll: **`182` / `0`** fixed against **`182` / `182`** | the `willAct()` gate replaced by `if(false)` |

**THE FIRST PROBE REPLACED ONE THAT ENCODED THE BUG.** `repeated Protect starts failing` spent three
turns and asserted `dealt[0] === 0 && dealt[last] > 0` — the decay half, which was never wrong. It
stopped **one turn before the only turn that can tell the two engines apart**, so it scored LIVE on a
wrong engine for as long as it existed. The second probe's `182` against `182` is the other shape this
ledger keeps warning about: identical results across a varied knob mean the knob is unwired.

**WHAT THE DIFFERENTIAL SAYS, BEFORE AND AFTER, ON THE SAME 395 GAMES** (`--games 450`; the before-arm
is the frozen release `41e28311e591` and reproduces WIRE 1's after-arm figure for figure, the after-arm
is `6b6f898f136f`). `data/games.ladder.jsonl` and `data/games.bo3.jsonl` were asserted identical in size
and mtime before, between and after both arms, which is filed item (4) below still being unfixed.

| | before | after |
|---|---|---|
| **the target family, both directions** | **37 games** | **7** |
| diverged | 394 / 395 | **393 / 395** |
| whole-run control arm, every stone stripped | 395 / 395 | **394 / 395** |
| median completed turns before divergence | 1 | 1 — unchanged |
| `unrelated event mismatch` | 125 games | **100** |
| `event missing from medicham2` | 129 | 145 |
| `extra event emitted by medicham2` | 32 | 37 |
| `ordering` | 40 | 41 |
| `turn order` | 12 | 13 |
| `-damage field 3` | 43 | 44 |
| `-immune field 3` | 2 | 1 |
| `-unboost: a different body` | 1 | **0** |
| classes | 13 | 13 |
| normaliser invocations (see below) | 21,214 | 54,773 |
| distinct moves the driver got to CONNECT | 173 | **169** |
| census mechanics reached by a connecting move | 104 / 109 | 104 / 110 |

**THE RATE MOVED, AND IT IS ONE GAME.** 394 → 393 diverged, and the stripped control arm 395/395 →
394/395. This instrument is deterministic and pinned, so one game is a real game and not noise — but it
is one game, and the honest reading is the same as WIRE 1's: a game stops at its FIRST divergence, so
clearing a cause makes games run ON and part deeper at whatever was behind it. That is why
`event missing`, `extra event` and `ordering` all grew while the target family emptied.

**AND THE DEPTH HEADLINE WIRE 1 USED IS THE WRONG NUMBER — filed as (5).** `total_lines_collapsed` is
not "protocol lines compared". `alignAndCheck()` (`engine/game_differential.js:791`) re-reduces the
WHOLE stream from scratch once per turn and `bumpNorm` counts every normaliser invocation, so a game of
T turns contributes about T²/2 × lines-per-turn. The quantity is monotone in depth and the direction is
real; the NAME and the PERCENTAGE are not. 21,214 → 54,773 is roughly **1.6x the turns played**, not
2.6x the protocol, and WIRE 1's "+6.6% lines compared" was nearer +3% of turns.

**THE COST, STATED.** `distinct moves connected` fell 173 → 169 and `not_exercised` rose 6 → 7. That is
the fix working in the direction that hurts coverage: a correctly-resetting shield goes UP more often,
so fewer clicks connect. It is not a regression to chase — it is what the real game does — but a
coverage figure that fell should never be left to be rediscovered as a counter that quietly went down.

**THREE THINGS FOUND ON THE WAY, FILED AND NOT FIXED:**

5. **WIDE GUARD AND QUICK GUARD SHARE THE `stall` VOLATILE AND THIS ENGINE RESETS IT.** Showdown's
   `wideguard`/`quickguard` carry `onTry() { return !!this.queue.willAct(); }` and
   `onHitSide(side, source) { source.addVolatile('stall'); }` — they never ROLL the counter, but they
   ARM it, so a Protect after a Wide Guard is already at 1/3, and they fail when their user acts last.
   medicham2's pre-pass does the opposite: `it.mon.tookProtectTurns=0` on a Wide Guard. Two of the seven
   remaining target-family causes are `|-fail|X <> |-singleturn|X|wideguard`. Deliberately left: it is a
   third rule needing its own probe, and this dispatch was one wire.
6. **`total_lines_collapsed` IS QUADRATIC IN GAME DEPTH AND IS REPORTED AS A LINE COUNT.** Detailed
   above. Either count the reduction once per game or rename the field; every before/after in this
   ledger that quotes it is quoting a square.
7. ~~**THE OTHER FOUR-FIFTHS OF `-fail` IS NOT PROTECT.**~~ **THE STAT-DROP HALF LANDED AS WIRE 3, below**
   — and it was two bugs, not one. `|-fail|X <> |-sidestart|X|tailwind` is untouched and stays open.

## ROADMAP #81 WIRE 4 — THE HYPOTHESIS HELD: SHOWDOWN'S MULTIPLIERS ARE FIXED POINT AND THIS ENGINE'S WERE FLOATS. 2026-08-07.

Census **246 live / 247 probed → 249 live / 250 probed**, `unarmed` 0, `directCall` 0, `hollow` 0,
`threw` 0. Red demonstrations **136 → 139, 0 failed** (three new, a different broken engine each). The
target family — a first divergence of class `-damage field 3` — **46 games / 45 distinct causes →
31 / 31**, which drops it from the third-largest class in the artifact to the fifth.

**THE HYPOTHESIS WAS NOT ASSUMED, AND OUR SIDE WAS MEASURED FIRST.** The dispatch characterised
Showdown's arithmetic and explicitly did not establish that medicham2 gets it wrong. A new exact
comparison does: `dmgRange`'s two endpoints against `battle.actions.getDamage` at rolls 15 and 0,
**tolerance zero**, 300 sampled real matchups per arm with both engines given the species' slot-0
ability and the same stats. `tests/test-engine-diff.js` cannot see this — its stated bar is
"midpoints within 12%", which was chosen so that rounding would not read as a bug, and it is exactly
the bug.

| what was on the field | exact agreement, BEFORE | AFTER |
|---|---|---|
| **no modifier at all — the CONTROL** | 293 / 300 (97.7%) | 293 / 300 — **unchanged** |
| **a SPREAD move** | **226 / 300 (75.3%)** | **291 / 300 (97.0%)** |
| **a LIFE ORB holder** | **107 / 300 (35.7%)** | **293 / 300 (97.7%)** |
| an attacker at −1 / +2, a defender at +1 | 293 / 292 / 292 | unchanged |

The control's 7 residual rows are the same species and moves in every arm — Flash Fire, Gravity
Apple, Illusion, Water Bubble — i.e. **other bugs, not arithmetic**, and both fixed arms land exactly
on that floor. Two thirds of every Life Orb damage number this engine has ever produced was off by
one, in both directions.

**AND ONE LIMB OF THE HYPOTHESIS WAS FALSE, WHICH IS WHY IT WAS MEASURED.** `boostMul(-1)` returns
`2/3` where Showdown divides by 1.5, and `3 * (2/3) === 1.9999999999999998` — a genuine float defect,
and it is **NOT** part of this family: the three boosted arms read 293/292/292 against a control of
293. Real stats are large enough that the ulp almost never crosses an integer. It is left alone and
recorded rather than "fixed" on the strength of the argument.

**THE ROOT, AND IT IS ONE FUNCTION** (`sim/battle.ts:2318-2340`). `md4096` is Showdown's `modify`,
`ch4096` is its `chain`, `mdChain` spends an accumulated chain the way `runEvent` spends
`this.event.modifier`. `+2047` is a round-half-up baked into integer arithmetic; `Math.floor(v * m)`
is a truncation. **They agree exactly on ×2, ×1.5, ×0.5 and the type chart** — which is why no probe
in this file had ever caught it — and disagree on everything else: ×0.75 on ~50% of values, ×1.3 on
~64%. Thirty-odd call sites now route through the one function, and **the float argument is not an
approximation**: `tr(1.3 * 4096) = 5324` IS Life Orb's literal `[5324, 4096]`, and 1.2 → 4915,
1.1 → 4505, 4/3 → 5461, 0.75 → 3072 all land exactly. `md4096` also takes an explicit `[num, den]`
pair, which is what the two 5461/4096 ability sites now pass.

**A SECOND ROOT OF THE SAME FAMILY, FOUND BY LOOKING AT WHAT THE DIFFERENTIAL ACTUALLY NAMED.** Three
of the four largest `-damage field 3` causes in the before-arm were `[from]recoil`, and recoil does
not go through `modify` at all:

```
sim/battle-actions.ts:1384   clampIntRange(Math.round(damageDealt * move.recoil[0] / move.recoil[1]), 1)
sim/battle.ts:2168           Math.round(targetDamage * effect.drain[0] / effect.drain[1])
medicham2, before            Math.floor(dealt * (rc[0] / rc[1]))
```

Two errors on one line: a floor where the rule is `Math.round`, **and** a pre-divided float, so a 1/3
recoil arrived as `0.3333333333333333` and fell an ulp short of `dealt/3` on every multiple of three.
Measured in the authority by CALLING `applyRecoilDamage`, not by reading it:

```
dealt   1     2     3     4     5    100   101   102   103
SD      1     1     1     1     2     33    33    34    34     <- Math.round, floored at 1
naive   0     0     0     1     1     33    33    33    33
```

Drain is the same rule with the opposite sign — 8,553 corpus clicks, each half a point of health
short.

**THIS CORRECTION TURNED TWO GREEN PROBES RED, AND THAT IS THE FINDING, NOT AN INCONVENIENCE.** The
Choice Scarf and Swift Swim probes both prove "the foe never acted" by asserting the killer took
**zero** damage — and both had the killer click **Wave Crash**, whose recoil is clamped to a minimum
of 1. So killing a 1 HP foe really does cost the killer a point, and those two probes had been green
**because of** a bug that made a real cost vanish. Fixed at the probe: my click is now Liquidation
(same type, same category, 100%, no `rc`) and the foe still clicks Wave Crash, so the only thing that
can move my HP is the foe getting a turn.

**THREE PROBES, EACH SHOWN RED ON ITS OWN BROKEN ENGINE** (`tests/probe_red_demo.js`, `demoSource` —
there is no tag to strip, the artifact was innocent in all three). **Every one asserts its CONTROL arm
too, and the control is equal on both engines by construction** — an off-by-one is only legible
against an arm that does not move, and a demo watching only the second number would also flip on an
engine that had stopped applying the modifier altogether.

| probe | census row | what separates the engines |
|---|---|---|
| a spread move takes ×0.75 rounded half up, not a truncation | `move spreadFoes` | Garchomp → Kingambit: single-target Flamethrower **64 on both**, spread Heat Wave **51** against **49** |
| Life Orb is 5324/4096 rounded half up, not a float 1.3 | `item damageMultAll` | Incineroar → Garchomp: no item **80 on both**, Life Orb **104** against **103** |
| the recoil charged is Showdown's ROUND of the damage dealt | `move recoil` | Brave Bird **41** against **40**, Flare Blitz **14** against **13**, Wave Crash **27 on both** |

**THE THIRD ARM OF THE RECOIL PROBE IS A CASE WHERE THE TWO RULES AGREE**, and the expected value is
COMPUTED from an observed quantity — the probe reads what the foe lost and asserts the user paid
`round` of it — so it states the rule rather than pinning a magic constant. It also asserts
`round !== floor` on the two discriminating moves, so a staging that ever drifts onto a
non-discriminating value goes **RED rather than hollow**.

The four exact damage numbers above came out of the authority with those exact bodies at those exact
rolls: Flamethrower 58-70, Heat Wave 46-56 spread, Close Combat 73-86, Close Combat + Life Orb 95-112.

> **RETRACTED 2026-08-07 BY WIRE 5 — EVERY ABSOLUTE FIGURE IN THE TABLE BELOW.** The differential was
> steered by `data/mechanics-census.json`, which is outside the photograph, and by the live game store,
> which OPS appends to. Neither arm below recorded either. A controlled re-run — one pinned census,
> one team pool, asserted comparable by the instrument, and the before-arm reproduced a third time —
> reads **59/56 → 38/35** where this table says 46/45 → 31/31, and **175 → 173** connected moves where
> it says 177 → 176. **The finding survives and is larger than claimed** (−36% of the family, and
> `[from]recoil` to zero rather than to two). Read the numbers from WIRE 5's table, not this one.
>
> The exact-damage sweep above it (300 matchups per arm, tolerance zero) is **not** affected — it does
> not go through the differential's game selection.

**WHAT THE DIFFERENTIAL SAYS, BEFORE AND AFTER, ON THE SAME 395 GAMES.** Before-arm the frozen release
`128a1ca28d34`, after-arm the live tree. `data/games.ladder.jsonl` (206,789,118 B @ 04:03:19.248Z),
`data/games.bo3.jsonl`, `data/tags.json`, `data/diff-swarm.json` and `engine/diff_swarm.js` were
asserted identical in size and mtime **before, between and after both arms**, and the driver's own
content digest (`9438fce…`) was asserted equal across both — filed item (4) is still unfixed and this
is the workaround it demands.

| | before | after |
|---|---|---|
| **the target family, `-damage field 3`** | **46 games / 45 distinct causes** | **31 / 31** |
| of those, causes that are `[from]recoil` | 4 | **2** |
| diverged | 391 / 395 | **390 / 395** |
| whole-run control arm, every stone stripped | 391 / 395 | **389 / 395** |
| the same pairs with the stones removed | 389 / 393 | **387 / 393** |
| median completed turns before divergence | 1 | 1 — unchanged |
| classes | 12 | 12 |
| `event missing from medicham2` | 132 | **127** |
| `unrelated event mismatch` | 101 | 110 |
| `ordering` | 45 | 50 |
| `turn order` | 15 | 19 |
| `-heal field 3` | 2 | **0** |
| `-immune field 3` | 1 | **0** |
| mega evolutions issued and executed in both engines | 519 | 519 — unchanged |
| **distinct moves the driver got to CONNECT** | **177** | **176 — A LOSS OF ONE** |
| distinct abilities / items / species | 160 / 124 / 257 | **161** / 124 / 257 |
| census mechanics reached by a connecting move | 107 / 112 | 107 / 112 |

**THE COVERAGE DIRECTION IS DOWN BY ONE AND IS REPORTED AS SUCH.** 177 → 176 connected moves. WIRE 2
cost four, WIRE 3 bought five back, this one costs one; distinct abilities gained one in the same
run. `not_exercised` is 6. It is not worth chasing — a recoil that now rounds up kills its own user
slightly sooner, so a few clicks that used to happen do not — but a coverage figure that fell must
never be left to be rediscovered as a counter that quietly went down.

**THE RATE MOVED BY ONE GAME AND THAT IS NOT THE HEADLINE.** The headline is that a family of 45
distinct causes lost a third of its members to ONE arithmetic rule plus ONE rounding rule, with no
per-cause patching. Two classes grew, which is the same shape WIREs 1-3 recorded: a game stops at its
FIRST divergence, so clearing a cause makes the game run on and part deeper at whatever was behind it.
`total_lines_collapsed` is deliberately not quoted — filed item (6) — and the depth proxies here
(megas 519 → 519, median 1 → 1) did not move.

**THE INSTRUMENT'S OWN INPUT SET IS STILL WRONG, AND THIS WIRE FOUND THE SPECIFIC LEAK.** The first
before/after pair of this session read `-damage field 3` at **51 games / 50 causes**; a second run of
**the identical frozen release** over a **byte-identical store** read **46 / 45**. The run is
deterministic — a third run reproduced the second exactly — so something outside the 23-file
photograph reached the games. It is `data/mechanics-census.json`:

```js
/* How badly does the run still need this entity? Lower count = more wanted. A move is scored by the
 * least-exercised census mechanic it can reach, then by its own click count. */
const covWant = (sec, key) => { ... for (const t of COV_TARGETS) ... }   // COV_TARGETS := the census
```

**The driver STEERS its move choice by census coverage, and the census is a live file.** Landing a
probe in `tests/test-mechanics.js` therefore changes which moves the differential clicks and which
games it plays — so every before/after on this instrument is void unless both arms see the same
census. That is why both arms above were re-run after the census settled. Filed as (8) below.

**FOUR THINGS FILED AND NOT FIXED — they are WIRE 5+, not this one:**

8. ~~**`data/mechanics-census.json` STEERS THE DIFFERENTIAL AND IS NOT IN THE PHOTOGRAPH.**~~
   **CLOSED — ROADMAP #81 WIRE 5, at the top of this file.** The proposed fix in this line ("it belongs
   in `SOURCES`") is the one WIRE 5 rejected, and the reason is worth keeping: freezing the census
   inside the release would make the before-arm read the OLD census and the after-arm the NEW one, so
   the two arms would steer differently *by construction*. What landed instead is a declared, digested,
   pinnable selection policy plus a guard that refuses an incomparable pair. WIRE 5 also found a SECOND
   unlisted steering input — the live game store the swarm picks teams from — and stamps that too.
9. **RECOIL IS CHARGED ON UNCAPPED DAMAGE.** Showdown passes `move.totalDamage` — the HP actually
   removed — to `applyRecoilDamage`; medicham2 passes its raw roll. Killing a body on 1 HP with Brave
   Bird costs 1 in the real game and 21 here. **This is the whole of what remains of the recoil half
   of the family**: both surviving `[from]recoil` causes in the after-arm now have medicham *higher*
   by one, which is this and not the rounding. Not fixed because it needs the pre-hit HP threaded to
   the recoil site and this dispatch was one root.
10. **THE BASE-POWER MODIFIERS ARE APPLIED TO THE WRONG QUANTITY.** Technician, Tough Claws, the
    terrains, Muscle Band, the type-boost items and Dry Skin are all `onBasePower` in Showdown —
    they chain into ONE modifier applied to `basePower` before the damage formula. medicham2 applies
    them to the computed base damage (terrain, Technician) or folds them into the final ModifyDamage
    chain (the items). The ARITHMETIC is now right at both sites; the PLACEMENT is not, and the two
    differ by a truncation. Unmeasured — it needs its own sweep arm.
11. **`board.js` STILL DOES ITS MULTIPLIERS IN FLOAT.** `md4096`/`ch4096`/`mdChain` are exported from
    `medicham2-browser.js` precisely so there is one implementation, and board.js is not this
    division's file. It computes an EXPECTATION rather than an exact hit, so this may well be the
    legitimate exception CLAUDE.md already names — but nobody has checked, and "probably fine" is how
    the priority-blocking duplicate survived.

**ONE UNRELATED RED TEST WAS FOUND AND FIXED RATHER THAN FILED.** `tests/test-no-silent-failure.js`
was red on four NEW silent catch blocks in `engine/game_differential.js` — the format-standing
lookups added earlier the same day, none of them mine. Each hands a plausible value downstream on a
throw (an empty tag table, an empty carrier map, a null dex row) and every one of those reads exactly
like a legitimate absence, which destroys the `uses: 0` vs `uses: null` distinction the whole block
exists for. They now count and print themselves (`format-standing lookups that threw and fell back:
… (must all read 0)`), and the ratchet reads 219 against a baseline of 220 with 0 new. **It is not
re-baselined** — `--update` rewrites a shared artifact and that is not this dispatch's call to make.

## ROADMAP #81 WIRE 3 — THE REFUSED STAT DROP WAS SILENT *AND*, FOR FOUR ABILITIES, NOT ACTUALLY A REFUSAL. 2026-08-07.

Census **244 live / 245 probed → 246 live / 247 probed**, `unarmed` 0, `directCall` 0, `hollow` 0,
`threw` 0. Red demonstrations **134 → 136, 0 failed** (two new, a different broken engine each). The
target family — a first divergence of the shape `|-fail|X|unboost|…` — **16 games → 1**, and the whole
`-fail` mention count **81 → 67**.

**THE FIRST QUESTION WAS WHICH BUG IT WAS, AND THE ARTIFACT CANNOT TELL YOU.** A `-fail` divergence is
consistent with the drop being blocked-but-unannounced (a protocol bug, cosmetic to the game state)
and with the drop being applied (a -1 Attack for the rest of the game). **Measured on STATE — the
target's `boosts.at` after the switch-in — before a line of the engine changed:**

| | medicham2 | Showdown | verdict |
|---|---|---|---|
| Intimidate → Clear Body | atk stage **0** | atk stage **0** | **BLOCKED, and silent.** A protocol bug. |
| Charm (−2 atk) → Inner Focus | atk stage **0** | atk stage **−2** | **REFUSED HERE AND APPLIED THERE.** A state bug. |

So it is **both**, and the second half is the expensive one — it was invisible to the differential
because those games part earlier, and invisible to the census because the existing probe
(`Clear Body refuses Intimidate`) is green on an engine that refuses everything from everyone.

**THREE SITES DECIDED THIS QUESTION AND NONE OF THEM READ THE TAG'S OWN `blocks` PARAMETER**, which
`tag_dex` has derived from `onTryBoost` since the day Will asked *"do we need to specify that clear
body is just a better hyper cutter"*:

| site | what it did | what `data/abilities.ts` says |
|---|---|---|
| `applyStatDrop`'s `INTIM_IMMUNE` | a ten-name list | — |
| the `statChange` + `statChangeInCode` pair | `TAGS.has(…,'preventsStatDrop')` — a **boolean** | Keen Eye / Illuminate / Mind's Eye delete `boost.accuracy` only; Big Pecks `boost.def` only; Inner Focus / Oblivious / Own Tempo / Scrappy fire only on `effect.name === 'Intimidate'` |
| the secondary `targetBoosts` block | a hardcoded `clearbody‖whitesmoke‖fullmetalbody` triple | Hyper Cutter deletes Breaking Swipe's −1 Attack; Big Pecks deletes Crunch's −1 Defense |

Measured membership of the over-block, before the fix: **Charm into Keen Eye, Illuminate, Big Pecks,
Flower Veil (on a Garchomp), Inner Focus, Oblivious, Own Tempo and Scrappy all read atk stage 0** and
Showdown lands −2 on every one of them. All eight now read −2. Exposure in the store: Clear Body 1,834,
Inner Focus 863, Scrappy 543, Oblivious 514, Own Tempo 61, and Intimidate itself 31,129.

**ONE GATE, FOUR CALLERS.** `statDropRefusal()` / `refuseStatDrop()` in `engine/medicham2-browser.js`
is the single reader of `preventsStatDrop` — CLAUDE.md's *"one implementation, everyone calls it"*,
and the reason the fix could not be split: emitting a `-fail` from three sites that disagree about who
refuses would have produced the *wrong* announcement in a new place. `blocks` comes from the artifact;
`accuracy` maps to no stage this engine has, so an accuracy-only blocker refuses **nothing** here,
which is the right answer rather than a skipped one. **The INTIMIDATE-ONLY scoping did not exist in the
artifact** — `engine/tag_dex.js` now derives `preventsStatDrop.onlyFrom` from
`effect.name === '…'`, and the engine reads that first with a named five-name bridge for the
pre-regeneration artifact, the same pattern WIRE 113's Simple/Defiant numbers use.

**THE ANNOUNCEMENT IS SUPPRESSED FOR A SECONDARY AND FOR OCTOLOCK; THE BLOCK IS NOT.** Every one of
these handlers guards its `this.add` with `!(effect as ActiveMove).secondaries`. Backwards, this would
have fired a `-fail` on every Icy Wind and parted the streams in a new place instead of an old one.
Verified on a live Champions battle rather than off SIM-PROTOCOL.md — both shapes, and the `-unboost`
that must still land:

```
|-ability|p1a: Incineroar|Intimidate|boost
|-fail|p2a: Metagross|unboost|[from] ability: Clear Body|[of] p2a: Metagross     blanket: no stat named
|-fail|p2b: Gallade|unboost|Attack|[from] ability: Inner Focus|[of] p2b: Gallade  scoped: the stat named
|move|p1a: Incineroar|Charm|p2b: Gallade
|-unboost|p2b: Gallade|atk|2                                                     Inner Focus does NOT refuse this
```

**TWO PROBES, EACH SHOWN RED ON ITS OWN BROKEN ENGINE** (`tests/probe_red_demo.js`, `demoSource` —
there is no tag to strip, the artifact was innocent), because these are two independent claims and one
demonstration would let either half ride on the other:

| probe | what separates the engines | the broken engine it is red on |
|---|---|---|
| `Inner Focus refuses INTIMIDATE and nothing else — a Charm still lands` | `[Intimidate, Charm]` = **`[0, −2]`** against `[0, 0]` | the `onlyFrom` scoping deleted — the blanket boolean read |
| `a refused stat drop is ANNOUNCED, naming the ability and (when scoped) the stat` | the canonised emit list, `[-fail, -fail]` against `[]` | the one `TR.failUnboost` call silenced |

**THE SECOND DEMO ASSERTS THE STAT STAGES TOO, AND THEY HOLD ON BOTH ENGINES.** That is the point of
it: the reverted build's state is byte-identical and only the protocol parts, which is exactly why this
family survived WIRE 1 and WIRE 2 and why the state had to be measured separately from the output.

**WHAT THE DIFFERENTIAL SAYS, BEFORE AND AFTER, ON THE SAME 395 GAMES** (`--games 450`; before-arm the
frozen release `6b6f898f136f`, after-arm `128a1ca28d34`). `data/games.ladder.jsonl` (206,789,118 B @
04:03:19.248Z), `data/games.bo3.jsonl`, `data/tags.json` and `data/diff-swarm.json` were asserted
identical in size and mtime **before, between and after both arms** — filed item (4) is still unfixed
and this is the workaround it demands.

| | before | after |
|---|---|---|
| **the target family — a first divergence `\|-fail\|X\|unboost\|…`** | **16 games** | **1** |
| all first divergences mentioning `-fail` | 81 | **67** |
| diverged | 393 / 395 | 393 / 395 — **unchanged** |
| whole-run control arm, every stone stripped | 394 / 395 | **393 / 395** |
| the same pairs with the stones removed | 392 / 393 | **391 / 393** |
| median completed turns before divergence | 1 | 1 — unchanged |
| classes | 13 | 13 |
| `event missing from medicham2` | 145 | **134** |
| `unrelated event mismatch` | 100 | 106 |
| `-damage field 3` | 44 | 48 |
| `extra event emitted by medicham2` | 37 | 38 |
| `turn order` | 13 | 14 |
| `ordering` | 41 | 41 |
| `-heal field 3` | 2 | **1** |
| **distinct moves the driver got to CONNECT** | 173 → 169 (WIRE 2) | **174** |
| `not_exercised` | 7 | 7 — the identical seven |
| census mechanics reached by a connecting move | 104 | 104 |
| mega evolutions issued and executed in both engines | 504 | **518** |

**THE COVERAGE COST WENT THE OTHER WAY THIS TIME, AND IT IS STILL WORTH STATING.** WIRE 2 cost four
connected moves (173 → 169) because a correctly-resetting shield goes up more often. This wire **buys
five back, 169 → 174**, and `not_exercised` is the same list of seven — a scoped refusal means a Charm,
a Parting Shot and a Breaking Swipe now *do something* instead of being silently eaten. Distinct species
fell 257 → 256, which is the same mechanism working against it and is reported rather than omitted.

**THE DEPTH NUMBER IS `mega evolutions`, NOT `total_lines_collapsed`.** Filed item (6) stands:
`total_lines_collapsed` is quadratic in depth (54,773 → 56,906 here) and is not a line count. Mega
evolutions are individual in-game events counted once each, agreed by both engines, and 504 → 518 is a
2.8% deeper run on the same 395 games.

**THE ONE SURVIVOR OF THE FAMILY IS NOT A REFUSAL BUG.** It reads
`extra event emitted by medicham2 :: |-fail|p2a|unboost|[from]clearbody <> |-heal|p1a|H/H|[from]hospitality`
— the `-fail` is correct and is landing at the wrong point in the ENTRY-EFFECT ORDER, beside the
already-present `|turn|1 <> |-heal|p2a|H/H|[from]hospitality` (9 games → 10). Filed as (10).

**THREE THINGS FOUND ON THE WAY, FILED AND NOT FIXED:**

8. **GUARD DOG DOES NOT REFUSE INTIMIDATE — IT REVERSES IT, AND THIS ENGINE STILL BLOCKS.** Measured in
   the authority: an Okidogi met by Intimidate emits `|-ability|p2a: Okidogi|Guard Dog|boost` then
   `|-boost|p2a: Okidogi|atk|1` and ends at **atk stage +1**; medicham2 leaves it at 0. It is the same
   `onTryBoost` family and the same one gate, but it is a BOOST rather than a refusal and needs its own
   probe, so it was left at its pre-wire behaviour rather than guessed at. Exposure in the store is
   small — Guard Dog does not appear in `data/games.ladder.jsonl` at all — which is why it is filed
   rather than bundled.
9. **MIRROR ARMOR REFLECTS THE DROP BACK AT THE SOURCE AND ANNOUNCES `|-ability|X|Mirror Armor|`.**
   `data/abilities.ts` deletes the boost, adds the ability line, and applies the negative boost to the
   SOURCE. medicham2 blocks it, which is right about the holder and wrong about the attacker; the new
   gate deliberately suppresses the `-fail` for it (`REFLECTS_DROP`) rather than inventing a line
   Showdown does not write. ~390 mentions in the store, on Corviknight.
10. **THE ENTRY-EFFECT ORDER PUTS HOSPITALITY'S HEAL IN THE WRONG PLACE.** Two shapes, both present
    before this wire and both grown by one game as games run deeper: `|turn|1 <> |-heal|…hospitality`
    (9 → 10) and the surviving `-fail` above. WIRE 123 ordered the entry ABILITIES by Speed; the heal
    itself appears to resolve after the announcement block rather than inside it. Not measured further —
    it is a different wire.

## MEGA EVOLUTION IS A CHOICE NOW, MADE MID-TURN, AND THE DIFFERENTIAL HAS ITS MEGAS BACK. ROADMAP #31 + #68. 2026-08-07.

Census **234 live / 235 probed → 240 live / 241 probed**. `unarmed` 0, `directCall` 0, `hollow` 0,
red demonstrations **128 / 0 failed** (six new, one broken engine each). `data/game-differential.json`
re-run: **`mega_stones_stripped` 0**, 372 stone sets kept, **181 evolutions in each engine**.

**WHAT WAS WRONG, MEASURED BEFORE ANYTHING CHANGED.** `buildMon('gengar', {})` returned a body that
neither engine models:

```
stats  135/76/80/200/95/170   <- BASE Gengar
ability  shadowtag            <- MEGA Gengar
```

The two halves failed in opposite directions and cancelled. `megaForme()` resolves through
`window.MEGA_FORMES`, which does not exist under node, so the STATS never swapped; `megaAbility()`
reads a module-level table, which always works, so the ABILITY always did. Showdown's Gengar has
Cursed Body until it evolves **on a choice, mid-turn**, so a stone parted the two protocol streams on
line one of every game carrying one — which is why the first whole-game differential had to strip 460
sets and test **zero mega bodies** in a ~26%-mega format.

**WHAT IT IS NOW.** `buildMon` returns the BASE forme holding the stone. `megaTargetFor(mon)` DERIVES
the capability from the body's own name and item every time it is asked — never a flag stamped at
build time, because the item moves (Knock Off, Trick, `b.item = x` after the build, which is what the
harness and every probe do) and a stamp that did not happen looks exactly like a body that cannot
mega. `megaEvolveNow(S, mon)` performs the evolution inside the turn.

**THE POSITION IN THE TURN IS THE MECHANIC.** Showdown queues it at ORDER 104 —
`sim/battle-queue.ts:184` — below `switch` (103) and above every move (200). This engine orders
everything through one comparator and a bare switch sits at priority 6, above the format's ceiling of
+5, so "after the switches, before the moves" is exactly "the first action with priority below 6". A
pre-pass before the loop would be wrong and observably so: a Pelipper switching in sets rain at 103,
and a Charizard megaing into Drought at 104 must paint over it rather than the other way round.

**AND THE TAIL IS RE-SORTED, BECAUSE THE MEGA'S NEW SPEED GOVERNS THE TURN IT ARRIVES IN.** Showdown
gets that for free (gen ≥ 8 re-sorts the queue before every `move` action, which is after the megaEvo
actions have run); WIRE 118's re-sort here only fires for `actIdx > 0`, so a mega on the first action
would have left the whole turn ordered on PRE-mega Speed.

**TWO MEGAS IN ONE TURN RESOLVE IN SPEED ORDER AND ONLY SPEED ORDER.** The first cut walked the
already-sorted action list, which is (priority, speed) — and megaEvo actions carry no priority;
`comparePriority` breaks the tie at order 104 on `speed` alone. So a slow body clicking Protect (+4)
megaed before a fast body clicking an attack. **The differential caught it**, as
`|detailschange|p1b: Glimmora-Mega <> |detailschange|p2b: Drampa-Mega` — the same two bodies evolving
in opposite orders — and the ordering class fell from 26 games to 19 when it was fixed.

**THE ABILITY IS AN OVERWRITE, AND THE TEST FOR IT IS AN EQUALITY.** `setAbility(species.abilities[0],
null, null, true)` still fires the ability's `Start` handler, so an entry-style ability on the mega
forme fires ON EVOLUTION — that is `applyEntryEffects` + `applyEntryDrops`, the same two calls
`battleInit` makes for a lead, so a mechanic wired for a switch-in cannot be missing for an evolution.
**Asserting "the ability changed" would fail on a correct engine**: measured against
`Dex.forFormat('gen9championsvgc2026regmb')`, **8 of the 74 megas in this format keep their base
slot-0 ability** (Tyranitar-Mega Sand Stream, Medicham-Mega Pure Power, Abomasnow-Mega Snow Warning,
Malamar-Mega Contrary, Barbaracle-Mega Tough Claws, Drampa-Mega Berserk, Chimecho-Mega Levitate,
Audino-Mega Healer). That list is read from the dex, never maintained here.
`tests/test-mega-timing.js` drives **all 74** through a real turn and asserts the evolved `.ability`
EQUALS the dex's value for that forme; the count of ability-keepers is printed so the equality can
never become vacuous.

### The six proofs, each red on its own broken engine

| proof | where | the broken engine it was shown red on |
|---|---|---|
| the body is BASE at build and evolves on a CHOICE | census `item:megaStone` | `buildMon` runs `megaAbility()` again — the pre-change engine |
| the ability is OVERWRITTEN and the new one FIRES | census `ability:megaAbilityOverwrite` | `megaEvolveNow` returns false at entry |
| either slot | census `item:megaStone` + `test-protocol-trace` PART 2 | `if (slot !== 0) return false` — the literal historical defect |
| the new Speed governs the turn | census `item:megaStone` | the tail re-sort removed; it still evolves, correctly, too late |
| an entry ability fires on evolution | census `ability:megaEntryAbility` | the two `applyEntry*` calls removed |
| one mega per side per battle | census `item:megaStone` | the `sf.megaUsed` test removed |

**THE OVERWRITE PROOF USES SKILL SWAP, NOT WORRY SEED, AND THAT IS A FINDING RATHER THAN A
SUBSTITUTION.** Will's acceptance case is *"Worry Seed a Tyranitar to Insomnia, then mega it"*.
Measured first: **`worryseed` carries only `moveClass` and `statusCategory` in `data/tags.json` — no
ability-writing tag — so this engine does not implement it and the move is inert.** A probe built on
it would have been green while proving nothing, because both arms would have started from Sand
Stream. Skill Swap is the same mechanism and is wired. The probe swaps Sand Stream away, puts RAIN on
the field so "the sandstorm returned" cannot be satisfied by a sandstorm nobody cleared, and then
megas: ability back to `sandstream`, sky back to `sand`.

**THE RATE FLOOR IS ON THE CHOICE, NOT ON THE SIDE.** Every choice the differential's driver issues
came from Showdown's own `canMegaEvo`, so **every one must produce exactly one evolution in each
engine** — 181 / 181 / 181, a hard 100%. "Sides that brought a stone" reads 181 / 255 (71.0%) and is
deliberately **not** the floor: a game stops at its first divergence, the median game lasts one
completed turn, and a benched stone-holder is never offered the choice. Making that the floor would
be measuring the harness's early stop. `tests/test-protocol-trace.js` PART 2 carries the other floor —
every side that COULD mega DID (8/8), from both slots (4 left, 4 right) — because its games run to the
end.

### Three things the same-weather rule and the identifier fixed, each found rather than assumed

- **RE-SETTING THE WEATHER THAT IS ALREADY STANDING IS A NO-OP, AND NOT A REFRESH EITHER.**
  `sim/field.ts setWeather()` returns false when `this.weather === status.id` for an Ability source in
  gen > 5; `setTerrain()` does the same unconditionally. This engine set and announced it every time.
  It was reachable before (two weather setters, one arriving under the other's sky) and ROADMAP #31
  makes it constant — a Tyranitar sets sand on entry then megas into Sand Stream on turn one, so
  **every mega weather setter emitted a `-weather` line Showdown does not, on the line straight after
  the `-mega`.**
- **THE PROTOCOL IDENTIFIER IS THE NICKNAME AND MUST NOT FOLLOW THE FORME.** Showdown's `|switch|p1a:
  X` field is `pokemon.name`, which `formeChange` never touches: a Tyranitar that megas keeps emitting
  `p1a: Tyranitar` for the rest of the battle and the new forme appears only in `|detailschange|`.
  This engine keyed it off `m.name`, which IS the forme. Unreachable before mega existed in-battle —
  **with one exception that was already live: Zero to Hero rewrites `m.name` to `palafin-hero`, so a
  Palafin that pivoted parted the streams on every later line it appeared in.** `_ident` is stamped by
  `buildMon` and re-stamped for anything `battleInit` is handed without one.
- **SHOWDOWN DEFAULTS THE NICKNAME TO `baseSpecies`.** A set whose name equals its species is renamed
  when the battle loads it, so a Floette-Eternal is `|switch|p1a: Floette|Floette-Eternal, L50|`. That
  parted 35 games in one run — **a class that had been there all along behind a silent drop**, because
  the harness keyed species with `id()`, which strips hyphens, so `floetteeternal` missed
  `data/engine-data.js`'s `floette-eternal` and **117 sets counted as unbuildable and left the run**.
  Routing that through `mcKey` took `sets_unbuildable` **117 → 0** and `teams_unbuildable` **3 → 0**.

### What the differential says now, and what it still cannot say

`mega_stones_stripped` reads **0**. Both engines are built Serious / 0 EVs / 31 IVs from the same base
stats, so `alignStats` had to move a stat **0 times** in 139 games — the two are literally the same
Pokemon rather than one being copied onto the other, which is what makes a forme change survivable at
all (`setSpecies` RECOMPUTES `storedStats` mid-turn from the SET, and `battle.choose` runs the whole
turn, so there is no seam for a harness to re-align in). The cost is stated and is new: **the ladder's
SPREADS are no longer tested.**

**THE RATE IS SATURATED, SO IT CANNOT ANSWER "WHAT DID MEGAS COST" AND THE ARTIFACT DOES NOT PRETEND
IT CAN.** Every pair is played TWICE, same seeds, same frozen driver state, stones the only
difference:

```
with megas, on the pairs that carry a stone   139/139
the SAME pairs with the stones removed        139/139
stoneless pairs whose two arms differed          0   (the pairing is sound)
```

So the paired comparison is reported instead: of 139 stone-carrying pairs the mega arm parted EARLIER
on 15, LATER on 96 and at the same line on 28, and **0 games have a `|-mega|` line as their first
divergence** — nothing in this run is attributable to the evolution itself. `|detailschange|` is
first on exactly 1, and it is a **Palafin**, not a mega, which is why the two are counted apart.

**FILED, NOT FIXED — ZERO TO HERO IS SILENT.** Showdown transforms Palafin on **switch-OUT**
(`|detailschange|p1a: Palafin|Palafin-Hero, L50`) and announces `|-activate|…|ability: Zero to Hero`
on the way back in. medicham2 transforms on the RETURN, inside `bringIn()`, and emits neither. That is
a different moment and two missing lines, and the emitter for it now exists.

### WIRE — KNOCK OFF'S ×1.5 KEPT THE HALF, AND SHOWDOWN TRUNCATES IT. FOUND AND FIXED IN THIS PASS.

The first re-run read `showdown 87..103` against `medicham 88..105` on the knock-off scenario, while
the contact-punish scenario on the same page agreed at both ends. The only difference between them is
Knock Off's item multiplier, and the arithmetic is exact:

```
showdown  chainModify(1.5) is FIXED POINT — tr(tr(65 * 6144) / 4096) = 97
          22*97   * 135/85 /50 + 2 = 69   -> STAB x1.5 -> 103
medicham  65 * 1.5 = 97.5, and the half survived every later floor
          22*97.5 * 135/85 /50 + 2 = 70   -> STAB x1.5 -> 105
```

Two points, on **3,341 corpus uses**. `mvBP=Math.floor(mvBP*_vp.mult)` in the `targetHasItem` branch,
and ONLY that branch: the other two variable-power multipliers are ×2 on integer base powers (Hex 65,
Infernal Parade 20, Acrobatics 55) and two of the three reach it through `basePowerCallback` returning
`bp * 2`, which is a plain multiply upstream and does NOT truncate — flooring them would assert a
rounding rule Showdown does not apply. Knock Off is the only member carrying a non-integer `mult`.

**IT HAD BEEN INVISIBLE, AND THE REASON IS THE LESSON.** The staged bodies used to carry the dataset's
spread and the two engines happened to land on the same integer, so `endpoints_agree` read **true for
a reason that had nothing to do with the arithmetic being right**. Flattening the harness's stat line
for ROADMAP #31 moved it off that coincidence. `tests/test-engine-diff.js` compares exactly these two
endpoints at 149/150 and did not see it either — it stages its own pairs and never hit the pairing.
After the fix: interior endpoints AGREE on both scenarios, `test-engine-diff` unchanged at 1/150, and
`tests/test-game-differential.js` back to ALL PASSED (its ordering assertion had gone red too, because
the knock-off scenario was parting on the DAMAGE line before the ordering line could show).

### THIS INVALIDATES MAG'S WEIGHTS, AND THAT IS THE INVALIDATION GRAPH WORKING RATHER THAN A BUG

`node engine/status.js` now opens with:

```
FEATURE SEMANTICS CHECK FAILED — data/policy-weights.json
    switchSurvives1  (0e94b1687aa4 -> 54d70a9e6ad9)
    switchKOSlow     (2045dd8d8175 -> 9c9d7efd0c30)
    switchDiesFirst  (83f864ebe7e8 -> c22f00eb026f)
```

It was clean at the start of this session, so this is ROADMAP #31 and nothing else. The three
features are computed on a STATIC build of a bench body, and a stone-holder's static build changed:
it used to carry the mega's ABILITY with the base's STATS and now carries the base forme's ability
plus the capability to evolve. **That is CLAUDE.md's own case — the weights were fitted against the
old definition and no longer describe these quantities.** ENGINE cannot close it: a refit is MEASURE's
and running one from here is out of bounds. **Routed, not filed.**

### `tests/test-effective-identity.js` — GREEN, AND THE WAY IT GOT THERE IS THE RECORD

**19 passed, 0 failed.** Section 2b was rewritten to pin the new contract at BOTH moments — `.ability`
is the base forme's before the choice (62/62) and the mega forme's after a real turn (62/62), and an
evolved body agrees with the mega row (61/61). That is a STRONGER claim than the one it replaced, not
a weaker one: the old assertion was green on a chimera.

Two of the ratchet's three growers are now DECLARED with construction reasons —
`engine/game_differential.js` (the harness AUTHORS both engines' teams, so the reads are assignments
of the sheet's DECLARED ability, which is exactly what a mega must evolve *from*) and
`tests/test-mega-timing.js` (two dex reads, which are the authority, and one read of the value under
test). The third, `engine/mega_decision_census.js`, is another division's and they declared it
themselves. `tests/test-no-silent-failure.js`: **0 new**.

**THAT FILE WAS OVER THE IDENTITY RATCHET FROM THE MOMENT `engine/game_differential.js` WAS WRITTEN,
and neither ROADMAP #31 nor anybody's regression caused it.** `data/effective-identity-baseline.json`
is dated **2026-08-02**; every read in a file newer than the baseline counts as new, and the
differential harness was written on 2026-08-06. It had been red for a day waiting for someone to look.
Recorded in the DECLARED entry itself so the next reader does not spend the time working it out again.

**AND A PROCESS LESSON THAT COST REAL WORK, WRITTEN DOWN BECAUSE IT IS CHEAP TO WRITE AND EXPENSIVE TO
REPEAT.** This section's changes were destroyed once and rebuilt by hand. A second agent, clearing an
unrelated syntax error in the same file, ran `git checkout -- tests/test-effective-identity.js` while
the ROADMAP #31 edits sat UNCOMMITTED. **A working-tree overwrite has no reflog and git cannot bring
it back** — the same permanence CLAUDE.md already records for deleting an untracked file, reached
through a command that looks like a revert rather than a delete. The old contract came back and went
RED against a correct engine, asserting the chimera again, which is precisely what the rewrite exists
to stop. It is restored verbatim rather than approximately, and the block says so in its own header.
**The rule this earns: `git checkout --` on a path is a DELETE of whatever is uncommitted under it,
and belongs to whoever holds that file.**

## THE COMPARISON DRIVER RUNS. 159 OF 160 REAL GAMES DIVERGE, AFTER A NORMALISER THAT PROVES ITSELF. ROADMAP #68, STEP TWO. 2026-08-06.

Census **234 live / 235 probed → 234 live / 235 probed**, unchanged: nothing in this pass touched a
mechanic. `unarmed` 0, `directCall` 0, `hollow` 0, differential 1/150, red demonstrations 122/0
failed, coverage ratchet held, conformance ratchet 0 new, silent-failure ratchet 0 new. The one
number that moved is a new one: **`data/game-differential.json`, 160 games, 160 diverged, 0 threw,
19 classes.**

`engine/game_differential.js` plays one team pair through BOTH engines under a pinned die, aligns the
two protocol streams, and records the **first differing line**. Gated by
`tests/test-game-differential.js`, which goes red only when the INSTRUMENT is wrong — a divergence is
a finding, exactly as the census reports a missing mechanic.

**READ THAT RATE WITH THIS BESIDE IT: 460 mega-stone sets were stripped, so THIS RUN TESTED ZERO MEGA
BODIES in a format whose mega usage is ~26%.** It is stated at the top level of the artifact
(`rate_excludes`) and not only in `declared_gaps`, because a reader who takes `diverged / games` and
nothing else has taken a number about a format with the megas removed. Closing it is the next job and
it is the same change ROADMAP #31 already requires — mega must become a CHOICE, not a build-time
default, or a search can never decide whether to mega.

> **CLOSED 2026-08-07 — see the ROADMAP #31 section at the top of this file.** Everything from here to
> the end of the 2026-08-06 section is the record of the run that had no megas in it, kept as written.
> `mega_stones_stripped` reads **0** now and the stone-holding sets are on the field; the figures below
> are that run's and are not restated.

### THE FIRST RUN'S RATE WAS NOT A RATE, AND SAYING SO IS THE POINT

Run one read **160 / 160 diverging with a median of ONE completed turn**, and the largest class (44
games) was the TARGET FIELD of a spread move — Showdown names one victim plus `[spread]`, this engine
names its own user. Beside it:

```
showdown  |-ability|p1a: Sharpedo|Speed Boost|boost
medicham  |-boost|p1a: sharpedo|spe|1|[from] ability: speedboost
```

Same mechanic, same state change, two spellings. **That number measured how fast the two PROTOCOLS
look different, not how often MEDICHAM is WRONG** — §2.2 of the design, the Csmith lesson, arriving in
our own instrument: where the compared thing is not semantically meaningful the oracle collapses and
the real bugs drown. And they were in there, unranked against the noise.

So a **semantic normaliser** sits under the aligner, and it is the dangerous part of the instrument,
so it carries two rules of its own:

**1. AN EQUIVALENCE MUST NOT BE ABLE TO NORMALISE A REAL BUG AWAY.** Each rule carries a pair that
must compare EQUAL (the form it collapses) and a pair that must still compare UNEQUAL (the meaning it
must not). Both directions run before any game does, and `tests/test-game-differential.js` PART 1b
fails on either. **A rule with no red demonstration is a silencer, not a normaliser**, and does not go
in the list. The general argument that makes all seven safe is one sentence: **every rule drops an
ANNOUNCEMENT or an ATTRIBUTION and never a STATE CHANGE.**

**2. WHAT IT COLLAPSED IS COUNTED AND PUBLISHED, PER RULE.** A normaliser whose effect is invisible is
how a 100% divergence rate becomes 2% with nobody able to say whether the engine improved or the
comparator got quieter.

| rule | lines collapsed | what it drops, and why that is not a state change |
|---|---:|---|
| `move-target-field` | 2,472 | a `\|move\|` line means "this body used this move". WHO WAS HIT is in the `-damage` / `-status` / `-unboost` / `-enditem` lines that follow, which are kept and compared body by body — so a redirection bug is caught one line later, not never. Its `distinct` pair is exactly that case |
| `effect-namespace` | 784 | `move: Reflect` against a bare `Reflect`. The NAME is kept |
| `display-flags` | 492 | `[silent]`, `[still]`, `[miss]`, `[spread]`. Each decorates a state carried by a separate event (`-miss`, `-prepare`, one `-damage` per body) |
| `ability-announcement` | 480 | `\|-ability\|` is a cosmetic announcement; every consequence is a separate line, so an ability that did not fire still shows as a missing effect |
| `source-tag` | 351 | `[of] pXy`, whose effect name `[from]` already carries |
| `switch-cause` | 32 | `[from] U-turn` on a pivot switch — the pivot is the `\|move\|` line right before it |
| `stat-attribution` | 16 | `[from] ability: X` on a stat line. Body, stat, direction and amount are all kept |
| | **4,627** | **total across 7 rules, all seven proved in both directions** |

**AFTER IT: 159 of 160 games diverge, 0 threw, 14 classes** (was 160/160 and 19). The rate barely
moved and that is the honest answer — the shape noise was hiding real classes rather than inflating a
small number. What moved is that the classes now name mechanics.

**A HARNESS BUG THE NORMALISER EXPOSED, AND IT WAS MINE:** four games threw
`Can't move: You can't choose a target for Solar Beam`. Showdown OMITS the `target` field from a
request entry for a LOCKED move — the second turn of Solar Beam or Phantom Force — because the target
was chosen when the move started. Falling back to the dex row supplied one anyway. `'target' in mv` is
the authority answering; `mv.target || dm.target` was a guess.

**BOTH PREDICTED FINDINGS REPRODUCE, WHICH IS THE ACCEPTANCE TEST FOR THE ALIGNMENT ITSELF.** §5a
filed them by hand before this driver existed; a harness that cannot reproduce a finding somebody
already made without it is misaligned.

```
knock-off order        10 lines agreed, class "ordering"
  showdown  |-damage|p2a: Snorlax|135/235                        <- HP first
            |-enditem|p2a: Snorlax|Leftovers|[from] move: Knock Off
  medicham  |-enditem|p2a: snorlax|leftovers|[from] move: knockoff   <- item first
            |-damage|p2a: snorlax|135/235
contact punish         12 lines agreed, class "ordering"
  showdown  target -damage, -unboost, -unboost, THEN Rough Skin's -damage
  medicham  Rough Skin's -damage THREE LINES EARLY, before the target's HP moves
```

End-of-turn state is identical in both, which is exactly why `tests/test-game-diff.js` agrees on all
five of its scripted games and the trace does not. **That is §5's whole argument, now mechanical
rather than hand-run.**

**THE DAMAGE INTERIOR IS MEASURED RATHER THAN QUOTED.** The second filed prediction was that
`tests/test-engine-diff.js` compares `roll=0` against min and `roll=15` against max, so 149/150 is
compatible with every middle roll being wrong. Measured on a staged Knock Off:

```
showdown 84..100, 12 distinct values over its 16 rolls
medicham 84..100, 17 distinct values sampled UNIFORMLY
endpoints AGREE; medicham can roll 86, 89, 92, 95 and 98 and Showdown CANNOT
worst per-value probability gap 6.62 points (5.36 on the contact-punish case, where the spans match exactly)
```

So the two engines agree on the range and disagree on the distribution inside it. **Mode B is not
optional and it is not far away** — that is a rate error of up to 6.6 points per damage value, on
every hit, invisible to every instrument this division owns.

**THE PIN IS THE PART THAT NEEDED THINKING ABOUT, AND IT IS ASSERTED ON BEHAVIOUR.** medicham2 rolls
`min + floor(rng * span)` — eleven integers. Showdown rolls `tr(tr(base * (100 - random(16))) / 100)`
— sixteen indices, **inverted**, index 0 being maximum damage. Different sizes, opposite senses:
there is no scalar that makes them agree in the middle. So Mode A pins the damage roll to the
**maximum on both sides**, which is the endpoint `test-engine-diff` already validates, and pins
everything else on the Showdown side to the TOP of its range, which is the reading that agrees with
medicham2 at `rng = 1 - 1e-9` event for event. Nine claims are checked before a game runs, and
`PIN_CHANCE` is defined AS `pinRandom(den) < num` so CHANGELOG 3.45.0's two-different-dice failure
cannot recur by construction. **A sub-100-accuracy move therefore MISSES in both engines** — symmetric,
no false divergence, and a real coverage hole the report states in as many words (32 moves this run).

**THE PLANTED-DIVERGENCE PROOF FAILED TWICE BEFORE IT WAS HONEST, AND BOTH FAILURES ARE THE HOUSE
SHAPE.** It first reported all three plants "caught at line 0", which reads as a healthy comparator:
`battleInit` takes the team BY REFERENCE, so the second arm was playing from the wreckage of the
first and its leads announced already-damaged HP. Fixed, it reported NOT CAUGHT: the driver is
coverage-seeking and therefore **stateful**, so the clean and planted arms were not the same game.
Fixed again, one plant passed for the wrong reason — the plants ran on the pre-turn-1 alignment where
the stream is four lines long, so the swap plant wrote `undefined` into the stream and was "caught"
at the line it had corrupted by accident. The plants are now indexed off the clean run's OWN
divergence, so each lands inside the agreeing prefix, and the test asserts **caught AND earlier than
the clean divergence AND at exactly the planted line**.

### The 14 classes, after normalisation — a class is a WIRE, an instance is not

Median game still parts after **one completed turn**, so nothing below is about long sequences yet.

| games | causes | class | what it is |
|---:|---:|---|---|
| 55 | 32 | `unrelated event mismatch` | two unrelated things at the same index. Led by **`-singleturn protect` against our `-fail`** (9 games — the two engines disagree about whether a Protect SUCCEEDS) and by medicham2 emitting a Hospitality `-heal` where Showdown emits none |
| 49 | 46 | `event missing from medicham2` | Showdown emits something we do not. **`\|move\|X\|trickroom` — medicham2 emits no `\|move\|` line for Trick Room at all** (5 games); `-fail\|unboost\|[from] clearbody` and the Inner Focus / Own Tempo / Oblivious / Scrappy family refusing Intimidate; **Mirror Armor, where Showdown reflects the drop and we unboost our own side** |
| 18 | 14 | **`ordering`** | the predicted one, and more. **Which side's Intimidate resolves first (4 games)**; `-start substitute` against the `-damage` that pays for it; Protean's typechange against the effectiveness line; a drain heal against the faint it causes |
| 9 | 9 | **`turn order`** | nine distinct games where a different body moves first |
| 8 | 8 | **`-damage field 3`** | **off by one under a pinned MAXIMUM roll** — recoil (`118/160` vs `119/160`) and direct damage. One game is worse: `H/H` against `0 fnt`, i.e. one engine kills and the other does not |
| 8 | 8 | `extra event emitted by medicham2` | Mummy's `-activate` before the damage; a `-boost` at upkeep; Protect's `-activate` where Showdown says `-immune` |
| 3 | 3 | `-miss field 3` | medicham2 emits `-miss` with no target, or names the wrong one |
| 2 | 2 | `switch: a different body` | **Illusion: Showdown announces the disguise, medicham2 announces Zoroark.** Both games |
| 2 | 2 | `-start: a different body` | Perish Song counted on the wrong side, and at a different count |
| 1 each | | `-immune field 3` (Good as Gold unattributed), `-boost: a different body` (**and its identifier is `??`**), `-damage field 4` (High Jump Kick crash tagged as generic recoil), `-activate field 4` (Skill Swap does not name the two abilities), `-status field 4` (sleep unattributed to Hypnosis) |

**THE REMAINING SHAPE CLASSES ARE NOT COSMETIC AND MUST NOT BE DEPRIORITISED AS SUCH.** They are what
stops the median game reaching turn two, so every sequencing question past the first turn is still
untestable. Closing the top two is what buys the instrument its depth.

### The Knock Off ordering, asked as TWO INDEPENDENT HALVES, and the prediction was WRONG

Showdown's `data/moves.ts:9962` takes Knock Off's x1.5 in `onBasePower` BEFORE damage and calls
`takeItem()` in `onAfterHit` AFTER it. Colbur Berry (`items.ts:1133`) is `onSourceModifyDamage` and
fires INSIDE the calculation; Sitrus (`items.ts:5740`) is `onUpdate` and fires after `takeItem` has
run. Opposite answers, same move, same turn. **The two halves are asserted apart on purpose: if the
1.5x were also evaluated after removal, a lost boost and a lost halving would partially cancel and the
net would look fine — the worst outcome, because it looks like agreement.**

```
boost      x1.5 for holding an item        showdown 1.471   medicham 1.480   (expected 1.5)
reduction  x0.5 Colbur vs super-eff Dark   showdown 0.500   medicham 0.500   (expected 0.5)
net        the two multiplied              showdown 0.735   medicham 0.740   (expected 0.75)
the three arms are distinguishable: 204 / 300 / 150   (x8 HP pool, or all three clamp to 135 and
                                                       both ratios read 1.0 and both checks are vacuous)
```

**THE PREDICTED DAMAGE BUG DOES NOT REPRODUCE, and the diagnosis is the finding.** The prediction was
that stripping the item first means *"Colbur can never fire for us — we deal full super-effective
damage where Showdown deals half"*. It fires. medicham2 prices **both** halves correctly, because
`playerAction` computes the damage RANGE at CLICK time, before the item is stripped, so the ordering
costs no damage here at all.

**What DOES differ is the item's DISPOSITION:**

```
showdown  |-enditem|p2a: Gengar|Colbur Berry|[eat]        <- the berry ate ITSELF, inside the calc
          |-enditem|p2a: Gengar|Colbur Berry|[weaken]        so takeItem() then found nothing
medicham  |-enditem|p2a: gengar|colburberry|[from] move: knockoff|[of] p1a: incineroar
```

Same end state, **different FACT** — and *"was it eaten"* is exactly what Harvest, Recycle, Belch, Cud
Chew and Unburden read. The Sitrus half **agrees exactly**: both engines strip it and neither heals.

### Two corrections to `traceCanon`, both of which it already CLAIMED

Found by the driver on its first run, and the claim-before-truth is the worse half:

- **the hyphen.** This engine holds ids (`doubleedge`), Showdown writes display names
  (`Double-Edge`). Lowercasing alone leaves `double-edge`. Every hyphenated move, apostrophe species
  and `-mega-y` forme read as a divergence. Now folded, together with `.` (`Mr. Rime`, reported as
  `switch: a different body  mr.rime <> mrrime`) and combining diacritics (`Flabébé`). **Known
  residue, stated: `Type: Null` carries a COLON, which is structural, so it is not folded.**
- **the side field.** The comment claimed "`p1: A` → `p1:a`, and this engine emits `p1: ` → `p1:`, so
  the player name is dropped from both". It was dropped from NEITHER. Every `-sidestart` and
  `-sideend` in every game parted on a player name this engine does not have.

Fields 0 and 1 are structure and are left alone — folding `-` out of field 1 would rename half the
protocol.

### What the run says it did NOT test — the honest half

- **Coverage is reported at two strengths and they are deliberately not added up.** `91 / 106`
  mechanics reached by a move that CONNECTED; `78 / 86` reached only by an ability or item that was
  ON THE FIELD. The median game parts after one turn, so most of those bodies never acted. **Present
  is not exercised**, and a single union figure (170/192) would be the 12%-tolerance mistake again.
- **43 of the 235 census rows are declared UNMEASURABLE by this instrument**, each with its reason —
  they name an INTERACTION (`intimidateRetaliationNet`, `drainThenPunishOrder`) rather than a
  taggable entity. Counted as covered or as uncovered they would both be wrong.
- **33 moves were clicked and ALWAYS missed** under the pin, and are not counted as covered.
- **NO MEGA BODY WAS TESTED AT ALL.** 460 stone-holding sets were stripped, because medicham2 megas at
  BUILD time and Showdown megas on a CHOICE — a stone parts the streams on the `|switch|` line of turn
  zero in every game that carries one. `tests/test-mega-timing.js` owns that question; this instrument
  cannot answer it until they agree on WHEN. **(CLOSED 2026-08-07, ROADMAP #31: 0 stripped, 372 kept,
  181 evolutions in each engine.)**
- **Gender is `N` on both sides**, so Attract, Rivalry and Cute Charm are not exercised. Same control,
  same reason, as CONTROL FIX 6 in the damage differential.
- **`MEDFAILS.traceBodyOffField = 2`** across 160 games — a `??` identifier reached the stream (first:
  a Roar phazing a body off the field). `tests/test-protocol-trace.js` PART 6 says this must read 0;
  it does on that file's own games and does not on these.
- 3 teams and 117 individual sets could not be built in both engines and were skipped, counted.
- `omit-priority` produced **3 games** against 20 for every other configuration: only 7 of 7,256 real
  teams carry no priority move. The starvation is the swarm's, not the format's, and is printed.

### Filed by the whole-game differential, not fixed

Every item below has a reproducing class in `data/game-differential.json`. Nothing here is a probe
yet, so nothing here is in the census — that is the next pass's job, and the working rule at the top
of this file applies.

- **the two ordering findings** — knock-off / resist-berry / contact-punish resolve against the target
  before its HP is subtracted. Staged in `DIRECTED` and gated by `tests/test-game-differential.js`.
  **the Knock Off section above establishes this costs no DAMAGE**; what it costs is the item's disposition.
- **the resist berry is a THIRD shape, not the same as knock-off.** Showdown spends it with
  `-enditem ... [weaken]` BEFORE the damage line; medicham2 emits no `-enditem` in the window at all.
- **Trick Room emits no `|move|` line at all** — `playerAction` returns `kind:'trickroom'` and that
  branch never reaches `TR.mv`. Five games. Same shape for the other non-`attack` action kinds.
- **the two engines disagree about whether a Protect SUCCEEDS** — `-singleturn protect` against our
  `-fail`, nine games, under a pin where both stall checks are supposed to read the same die.
- **Mirror Armor does not reflect Intimidate.** medicham2 drops its own ally's Attack instead.
- **Colbur is recorded as KNOCKED OFF where Showdown records it as EATEN.** Harvest, Recycle, Belch,
  Cud Chew and Unburden all read "was it eaten". Same family as #28, the resist berries.
  **THE REGISTER DOES NOT CARRY THIS ITEM.** It was filed to me as ROADMAP item eighty, and
  `docs/ROADMAP.md` §5 names 48 items, none of which is that one or the related item seventy-one — so
  the reference is written out by description rather than by number. `tests/test-roadmap-register.js`
  is RIGHT to fail on a ledger scheduling an item the register has never heard of, and ROADMAP.md is
  not ENGINE's to edit; the numbers can come back the moment §5 carries them.
- **Illusion announces the wrong body** on switch-in — filed in docs/GAME-DIFFERENTIAL-DESIGN.md §3.2
  and now with a reproducing game rather than a citation. The register entry belongs to whoever owns
  that item; this ledger does not schedule it, so it does not name its number.
- ~~**damage is off by one under a pinned maximum roll**, on recoil and on direct damage, five
  games.~~ **CLOSED AS A HAND-LIST ITEM — ROADMAP #81 WIRE 4.** It was one root twice over: Showdown
  does every damage multiplier in fixed point on 4096ths with a round-half-up, and recoil/drain are
  `Math.round` of a RATIO. The census carries three probes for it now (`move spreadFoes`,
  `item damageMultAll`, `move recoil`) so this line is no longer a claim nothing checks. What is left
  of it is narrower and is filed as (9) on that wire: recoil is still charged on UNCAPPED damage.
- **the Intimidate x guaranteed-crit case is still open** (§6): `107/170` against `128/170`. It has a
  probe in `tests/test-protocol-trace.js` PART 5 and is still the declared limitation.
  **CLOSED AT ROADMAP #81 WIRE 11, 2026-08-07.** `dmgRange` takes a crit flag; PART 5's assertion was
  inverted and now reads `showdown 112/170 in both arms, medicham 111/170 in both arms`.
- **`data/diff-swarm.json`, `data/rerun-list.json` and `data/store-validation.json` trip the
  provenance ratchet and none of them is ENGINE's.** Red on arrival; filed under the DIVISIONS rule.

## MEDICHAM EMITS A SHOWDOWN-SHAPED PROTOCOL TRACE. ROADMAP #68, STEP ONE. 2026-08-06.

Census **234 live / 235 probed → 234 live / 235 probed**, unchanged and re-measured twice: once
against the `data/tags.json` that was in the tree at the start of the session, and again after another
division committed `5da0b0d` and regenerated it mid-pass. `unarmed` 0, `directCall` 0, `hollow` 0,
`threw` 0. Differential **1/150**, the same `chesnaught woodhammer -> mimikyu` row.
`tests/probe_red_demo.js` **122 demonstrations, 0 failed** (five re-anchored — see below).
`tests/test-game-diff.js --all` AGREES on every turn of all five scripted games and on 0 of 40
generated pairs parting. `tests/test-engine-consistency.js` all passed. Accuracy conformance 500/500,
accuracy-modifier 12 handlers / 13 rows / 0 disagree, substitute-bypass 51 carried / 0 missing / 0
invented.

**No mechanic changed. This pass adds an INSTRUMENT.** `docs/GAME-DIFFERENTIAL-DESIGN.md` §5 compares
two engines by diffing their EVENT STREAMS rather than their end-of-turn state, because Showdown's
protocol log is already a step-level trace *labelled with the mechanism that made each decision*.
Showdown emits one. **MEDICHAM emitted nothing, so there was nothing to diff.**

| | |
|---|---|
| `TRACE_EVENTS` in `engine/medicham2-browser.js` | the 36 event types this engine claims it can emit |
| `data/protocol-events.json` | 91 events Showdown can emit; 36 emitted, 58 declared with a reason, 10 partial shapes with a reason |
| `engine/derive_protocol_events.js` | derives that list from Showdown's own `add()` sites, and gates on INVENTED and UNDECLARED |
| `tests/test-protocol-trace.js` | 7 parts; the census-style guard that every claimed event actually FIRES |

### THE ACCEPTANCE TEST SEPARATES, AND IT SEPARATES ON ONE LINE

`docs/GAME-DIFFERENTIAL-DESIGN.md` §6's case, staged: an Intimidated Meowscarada throwing Flower
Trick (a guaranteed crit) into an Incineroar. Showdown ignores the attacker's NEGATIVE offensive
stages on a crit (`sim/battle-actions.ts:1683-1691`); MEDICHAM's declared limitation says it does not.
**HISTORICAL AS OF ROADMAP #81 WIRE 11, 2026-08-07 — the numbers below are the PRE-WIRE build's.
MEDICHAM now reads `111/170` in BOTH arms and PART 5's medicham assertion is inverted to match.**

```
showdown   Intimidate 112/170   control 112/170     <- the crit ignored the -1
medicham2  Intimidate 130/170   control 111/170     <- it did not
  the two streams agree on all 15 lines before the divergence
  the FIRST differing line is the |-damage| itself
```

**THE CONTROL IS THE ARM WITH INTIMIDATE SWAPPED FOR BLAZE, AND IT HAD TO BE, BECAUSE THE OBVIOUS
TEST IS WRONG.** Asserting "the two engines' damage numbers match" is false for a reason that has
nothing to do with crits: measured while writing this, MEDICHAM's damage RANGE for Knock Off
Incineroar → Snorlax is **57..67, eleven integers, sampled uniformly**, and Showdown rolls **sixteen**
indices onto the same span with unequal multiplicities. A "median" roll is therefore not the same die
on the two sides and every damage line differs by one or two even where the rules agree. So each
engine is compared **against itself across the control**, which is the actual rule being tested.

### WHAT THE TRACE FOUND WHILE IT WAS BEING WIRED, AND NEITHER IS A CENSUS ROW

1. **THE INTERMEDIATE DAMAGE ROLLS ARE NOT THE SAME DISTRIBUTION, AND NO INSTRUMENT WE OWN LOOKS AT
   THEM.** `tests/test-engine-diff.js` calls `showdownDamage()` at `roll=0` and `roll=15` against
   MEDICHAM's `min` and `max` — it is an **endpoint-to-endpoint** comparison, by construction. The
   fourteen rolls in between are `d.min + floor(rng * (d.max - d.min + 1))`, a **linear interpolation
   over an 11-wide integer range**, where Showdown applies its multipliers to sixteen separately
   floored base values. The endpoints can agree perfectly, 149/150, while every middle roll is off by
   one or two and every roll's PROBABILITY is wrong. That is Mode B in the design doc, and it is
   filed rather than fixed: changing how MEDICHAM draws a damage roll moves every seeded run in the
   repository and is a decision above ENGINE's pay grade tonight.
2. **THE ORDER WITHIN A HIT IS NOT SHOWDOWN'S, AND THE STATE COMPARISON CANNOT SEE IT.** MEDICHAM
   resolves the knock-off, the resist berry and the contact punish **before** subtracting the target's
   HP, so the stream reads `-enditem`, Rough Skin's `-damage`, then the target's `-damage`; Showdown
   subtracts first. End-of-turn state is identical, which is exactly why `tests/test-game-diff.js`
   agrees on all five scripted games and this trace does not. Same for the pinch berries: Sitrus fires
   in MEDICHAM's end-of-turn residual and on Showdown's `onUpdate` immediately after the hit. Both are
   recorded in `data/protocol-events.json`'s `partial[]`, with the reason.
3. **`|move|`'s TARGET NAMED A BODY THAT HAD LEFT THE FIELD.** The action is built before the turn is
   sorted, so a target that switched out mid-turn has no slot identifier at all — the first version of
   the emit produced `??` four times in sixteen games and `MEDFAILS.traceBodyOffField` caught it. It
   now resolves through `it.tgtSlot` against the live foe array, which is what the attack branch
   already does for `aim`. **A counter that could not have existed before this pass found a defect in
   this pass**, which is the whole argument for `MEDSEEN`/`MEDFAILS`.

### AND MY OWN PROBE WAS WRONG BEFORE THE ENGINE WAS. THAT MAKES THIRTY-NINE.

The Intimidate rate floor asserted "two `|-unboost|` lines against two live foes" and read **one**.
The engine was right: the second foe was a **Slowking with Oblivious**, which is Intimidate-immune in
this generation, so `applyStatDrop` correctly returned `blocked` and emitted nothing. The probe was
staged with a body that cannot take the drop it was asserting. Fixed by giving the partner
Regenerator, not by weakening the assertion.

Two more of the same shape, both in the coverage scenarios rather than the engine: Icy Wind was
clicked with **no target**, so `playerAction` classified it as a non-attack and `-unboost` never
fired; and White Herb never triggered because the body holding it was **Protecting on the turn the
drop was aimed at it**. In all three cases "the event never fired" was the SCENARIO, not the trace.

### THE COST, MEASURED, AND IT IS NOT RESOLVED BY THE BENCHMARK I HAVE

Every emit site is `if(TR)` — one module-global load and a falsy test — and `TR` is null unless a
caller passed `{trace: []}`. Against a build with all **188** guards compiled out (`if(TR)` →
`if(false)`, dead-code-eliminated), two runs of 4,000 full games disagreed **in sign**: +3.9% and
−7.0%. **The off-path cost is below the noise of this benchmark and is reported as unresolved rather
than as free.** With the trace ON the same benchmark reads ~5% slower, which is the honest price of
asking for it.

### FIVE RED DEMONSTRATIONS WERE RE-ANCHORED, AND NOT ONE REVERSAL CHANGED

`tests/probe_red_demo.js` reverts the engine by **exact source text**, so instrumenting a line breaks
its anchor — loudly, which is the guard doing its job. Five anchors moved: the Grassy Terrain heal
(WIRE 117), the type-immunity gate (WIRE 126 and WIRE 128, two demonstrations on one line), the
move-class immunity (WIRE 128) and the substitute bypass (WIRE 130, two). **In every case only the
SHIPPED half was re-anchored; the known-bad half is byte-identical to what it was**, so each
demonstration still shows exactly the defect it was written for. 122 demonstrations, 0 failed.

### FILED, NOT FIXED

- **The two damage-roll findings above (1 and 2).** Neither is a census row and neither is a WIRE
  yet — they are what the instrument exists to find, and the fix cycle is ROADMAP #68's next step.
- **A spread move's `[spread]` attribute and its per-target effectiveness ORDER are not emitted.**
  MEDICHAM resolves the target list after the move line is written and rolls accuracy once per move
  rather than per target (`MEDSEEN.accSpreadNoDefender`), so a per-target attribute would not be true.
  Declared in `data/protocol-events.json`.
- **`-terastallize`, `replace`, `swap`, `-hitcount` and 52 others are not emitted**, each with a
  written reason in `data/protocol-events.json`. **`-mega` and `detailschange` USED to be on that list**
  with the reason *"mega evolution happens in `buildMon`/`oneMegaPerSide` before `battleInit`, so there
  is no in-battle event to emit at all"*. That was an honest declaration of a real modelling limit and
  the limit is gone: both are in `TRACE_EVENTS` as of ROADMAP #31 (2026-08-07), emitted by
  `megaEvolveNow` in Showdown's own order, and `tests/test-protocol-trace.js` PART 1 holds them to it.
  The counts moved 36 → **38** emitted and 58 → **56** declared.
- **THE TREE MOVED UNDER THIS PASS, AND ONE OF THE MOVES WAS MINE.** Another division committed
  `5da0b0d` (`tags.json` unfrozen and regenerated, `engine/tag_dex.js`, `engine/fit_policy.js`) and
  `219ce3b` (`diff_swarm.js`, the swarm half of this same ROADMAP item) during the session. The census
  was therefore re-run against the new artifact and reads the same 234/235. **I also ran
  `git stash`/`git stash pop` to establish a baseline, which is a mutation of the working tree in a
  repository another agent was committing to, and it should not have happened.** Nothing was lost —
  the pop restored cleanly and `HEAD` is intact — but the window existed and is recorded here rather
  than left out.
- **`engine/status.js` throws before its ENGINE block**: `engine/mc_key.js:129 — LK.resolve is not a
  function`, from `engine/feature_fixture.js:461` through the new `engine/lookup.js` (`eb500a1`). The
  report still prints; the fixture verification does not. **Not this pass's file and not fixed here.**
- **`engine/provenance.js` still reports 3 artifacts resting on mtime alone** —
  `diff-swarm.json`, `rerun-list.json`, `store-validation.json`. `protocol-events.json` was a fourth
  when it was first written and now carries `source_digests` and the pinned Showdown commit, so it
  has left that list. The other three are not this pass's generators.

## `unarmed` REACHED ZERO, AND ARMING THE PROBES FOUND WIRE 131, WIRE 132 AND SIX TAGS NOTHING READS. 2026-08-06.

Census **231 live / 232 probed → 234 live / 235 probed**. Missing still **1** — the same
`move|needsTargetToAttack`, unchanged and for the reason recorded below. `hollow` 0, `threw` 0,
**`directCall` 0 and it did not rise**. **`unarmed` 76 → 0**: every probe in the file now returns
`{control, test}` and the harness checks the pair structurally.
`tests/probe_red_demo.js` **79 → 122 demonstrations, 0 failed**.

Every other instrument held. Differential **1/150**, the same pre-existing
`chesnaught woodhammer -> mimikyu` row and the same 11 not comparable; accuracy conformance
**500/500 · 0 disagree**; accuracy-modifier conformance **12 handlers / 13 rows / 0 disagree**,
`accModUntabled` **0**; substitute-bypass conformance **51 carried / 0 missing / 0 invented**.
`tests/test-game-diff.js` agrees on every turn of all five scripted games.
`tests/test-interaction-matrix.js --full`, re-run against the changed engine: **1,624/1,643 (98.8%)**,
the same 530 inert / 109 saturated / 16 ko-timing / 2 threw and the same 19 parting rows.
`tests/test-engine-consistency.js` all passed.

**THE COVERAGE GATE'S ARMED NUMBERS ARE WHERE THIS PASS SHOWS UP, AND THEY WERE THE WORST NUMBERS ON
THE PAGE.** Weighted by corpus usage, inside the union 99% set:

| | armed before | armed after |
|---|---|---|
| moves (289 in the set, 1,859,794 uses) | **63.4%** | **97.4%** |
| abilities (99 in the set, 186,879 uses) | **82.2%** | **93.8%** |
| items (108 in the set, 171,843 uses) | **58.9%** | **99.9%** |

Nothing else in that gate moved: (a) 14, (b) 9, (c) 1, (d) 17 of 17, and **`tags probed and live but
with no ARMED probe: 62 → 0`**. Re-stamped into `data/medicham-coverage.json` with `--stamp`.

### WIRE 131 — THE ENGINE DODGED WITH SAND VEIL AND THE BOT PRICED EVERY CLICK AS IF IT DID NOT EXIST

Found by Will, from domain knowledge, and routed in mid-pass. WIRE 129 converted the five
**RESOLUTION** sites (the to-hit rolls) to `hitChance`. It did not convert the four **VALUATION**
sites — the places that answer *what is this click worth* — and those kept calling the bodiless
`moveAccuracy(id, field)` with a hand-written `att.ability === 'noguard'` beside it.

Measured before a line of engine changed, Hydro Pump (80 printed) out of a Milotic, all seven arms:

```
plain defender            bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 80
defender has NO GUARD     bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance Infinity
ATTACKER has No Guard     bestMoveVs.acc 1     playerAction.acc 0.8   hitChance Infinity
defender Bright Powder    bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 72
defender at +6 evasion    bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 26.7
attacker at +6 accuracy   bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 240
attacker Wide Lens        bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 88
```

**Identical results across a varied knob mean the knob is unwired, six times over** — and the one arm
that did move, the attacker-only No Guard, was the **fifth copy** of a rule `ACCMOD` already owns and
was **half the ability**: No Guard's hook is `onAnyAccuracy`, so a move aimed AT a No Guard body
cannot miss either, and all four sites priced that at 80%. This format gives No Guard to Pidgeot-Mega,
Raichu-Mega-Y, Machamp, Golurk, Hawlucha-Mega and Lycanroc-Midnight.

`hitProb(att, def, id, field, ctx)` is the valuation wrapper — `hitChance` clamped into [0,1] with
Infinity reading as 1 — and **all four sites call it**: `bestMoveVs`, the KO scan's per-foe weight,
`bestKOsNow`, and the `acc` field on `playerAction`'s action object. After the fix every one of the
seven arms above moves and agrees with the resolution path.

**ZOOM LENS IS DECLARED OFF AT VALUATION TIME RATHER THAN GUESSED.** Its `when` is
`targetAlreadyMoved`, a fact about an order that does not exist when a click is priced. Passing no ctx
makes `_accWhen` return false, which is the honest answer; the resolution site still applies it.

**IT DOES NOT MOVE A `board.js`-FACING NUMBER, AND THAT IS STRUCTURAL RATHER THAN OBSERVED.**
`board.js` imports exactly two things from this file — `M.dmgRange` and `M.buildMon` (board.js:885) —
and neither changed. Its own `accuracy` feature is computed from the Showdown dex at board.js:2439 and
never from `moveAccuracy`. `engine/position_features.js:197` calls `M.moveAccuracy(id, field)`, whose
signature and every returned value are untouched. **No refit is owed by this wire.**

**AND THE `acc` FIELD ON THE ACTION OBJECT IS READ BY NOBODY.** A repo-wide search for a consumer of
`playerAction(...).move.acc` finds none — not `board.js`, not `miltank.js`, not `rollout_leaf.js`, not
the site. It is now correct rather than wrong, which costs nothing, but it is **filed** below: a field
that is written and never read is a silent default waiting for a reader.

**TWO OF THE FOUR SITES COULD NOT BE DEMONSTRATED RED AND ARE DECLARED, NOT FAKED.** The KO scan and
`bestKOsNow` live inside `_chooseAction`, which is not exported. The only external route is letting the
bot pick freely and reading which foe lost HP, and **every arm of that experiment printed the same two
numbers** because the partner, the priors sampler and the to-hit roll all move underneath it. A
demonstration that cannot isolate its knob is the hollow shape `probe_red_demo.js` exists to reject.
Both lines are still pinned: the two `demoSource` rows assert their own text applied, and two new
census probes assert the two exported numbers.

### THE TWO NEW PROBES ASK WHAT THE BOT *THINKS*, NEVER WHETHER THE MOVE LANDS

`ability|writesAccuracy` — *"the bot VALUES a click into a No Guard body as certain, not at its printed
80"* — and `ability|accuracyMod` — *"the bot PRICES an evasive body, and not only dodges around it"*.
Every accuracy probe written before this pass reads DAMAGE ON THE BOARD, which is exactly why all of
them stayed green through WIRE 131: the resolution path was already right. The new pair reads
`bestMoveVs(...).acc` and `playerAction(...).move.acc` off bodies staged through `battleInit`.

`valuedAcc(` is declared by name in `REALTURN` **with its reason**, exactly as that ratchet's comment
requires, and it is the one helper in the file that deliberately does not spend a turn: spending one
would be the wrong instrument for a valuation bug.

### WIRE 132 — MEGA FLOETTE THREATENED NOTHING, ON 10.5% OF LADDER SIDES, AND THE RIGHT KEY WAS IN THE ARTIFACT

Found from a question Will asked about Fairy Aura and routed in mid-pass. `buildMonFromSet` built the
mega forme by CONCATENATION — `key + '-mega'` — while `data/abra-tags.js` has carried the real mapping
all along in `item|megaStone.into`.

**MEMBERSHIP PRINTED BEFORE ANYTHING WAS WIRED, over all 76 into-pairs in the artifact:**

```
76 into-pairs;  the concatenated guess agrees on 74;  it DIFFERS on exactly 2:
  floettite     base floette-eternal   guess floette-eternal-mega [row exists]  artifact floette-mega
  meowsticite   base meowstic          guess meowstic-mega  [NO ROW]            artifact meowstic-m-mega
```

So reading the artifact cannot over-match: 74 of 76 are the same string either way. What the two cost:

| | before | after |
|---|---|---|
| `buildMonFromSet` Floette-Eternal @ Floettite | `floette-eternal-mega` · ability **''** · SpA 175 | `floette-mega` · **fairyaura** · SpA 192 |
| `buildMon('floette-mega')` | 4 moves? **no — `mv: []`, it threatened nothing** | 4 moves, its Dazzling Gleam dealt **160** |
| `buildMonFromSet` Meowstic @ Meowsticite | **`meowstic`** — the mega branch never fired at all | `meowstic-m-mega` · trace · SpA 163 |

`floette-eternal-mega` is the **one row in the whole 318-row table with `ab: null`**, and it also
carries `mv: []`. The artifact's own answer, `floette-mega`, carries Fairy Aura and the right base
stats and was sitting beside it. **Six of the 81 mega rows carry `mv: []`** — salamence-mega,
latios-mega, latias-mega, diancie-mega and both Floettes — and of the six, only Floette has a base row
in this dataset to recover from; the other four have **6, 0, 0 and 0** ladder sides between them.

**THE HAND-TYPED `MEGA_ABIL` KEYS FLOETTE AS `floette:'fairyaura'`, WHICH IS NEITHER KEY.** That is
`merge_mega_into_engine.js`'s failure from CLAUDE.md verbatim — *"the builder keyed `venusaurmega`
while the artifact keyed `venusaur-mega`, so zero of its 67 writes ever matched"* — the same shape on a
new pair. It is left in place as the fallback for a stone the artifact has not derived, and the
artifact is asked first.

Three functions, one owner each: **`megaKeyFor(baseKey, item)`** (the forme, from the artifact, with
the suffix guess as a COUNTED fallback), **`megaRowMoves(key, m)`** (a mega never changes its moveset,
so an empty `mv` inherits the base's — found through the INVERTED into-map, because no string surgery
gets from `floette-mega` to `floette-eternal`), and **`megaRowAbility(key, m)`** (a mega row with no
ability takes its SIBLING forme's, never its base's — a mega's whole point is that the ability
changes). Six counters, three recoveries and three failures, all named:
`megaKeyFromSuffix` **0**, `megaMovesFromBase` (floette-mega ← floette-eternal),
`megaAbilityFromSibling`, `megaRowNoMoves` (**5**, first `floette-eternal-mega`), `megaRowNoAbility`
(**1**, `floette-eternal-mega`), `megaIntoNoTable` **0**.

**THIS ONE DOES MOVE A `board.js`-FACING NUMBER, AND THE SIZE OF IT IS MEASURED RATHER THAN ASSUMED.**
`board.js` imports `M.buildMon`. Diffed over **all 318 rows**, old engine against new: **exactly ONE
row changes** — `floette-mega`, which gains its four moves. Ability, base ability and moves are
byte-identical on the other 317. `buildMonFromSet` also changes for a Floettite and a Meowsticite set,
and board.js does not import it. **So any MAG feature computed on a board containing a Mega Floette
moves, and nothing else does. MEASURE was told.**

**`floette-eternal-mega` IS LEFT BROKEN ON PURPOSE.** It is an orphan: the artifact names no stone that
produces it, and base `floette` is `isNonstandard: 'Past'` in this format, so the row is unreachable by
construction. Making it work by stripping `-mega` off its own name would legitimise a row that should
not be reached and would hand it its BASE's ability. It is counted instead, loudly, and reported.

**THE `artifact_audit.js` GAP IS REPORTED AND NOT PATCHED.** A mega row with `mv: []` is never
legitimate and the audit passes cleanly over all six, because its duplicate check normalises
`floette-mega` and `floette-eternal-mega` to genuinely different strings. Adding that assertion today
would make a registered GATE red with no way to close it from here — the fix is in
`data/engine-data.js`, which ENGINE may not edit. **Routed out.**

### ARMING 76 PROBES FOUND SIX TAGS THE ENGINE DOES NOT READ AT ALL

Declaring arms is paperwork; **the demonstration is what makes an arm worth anything**, and 41 new
rows in `tests/probe_red_demo.js` re-run each newly-armed probe's own two-arm assertion against a
known-bad artifact or a reverted source. **Ten of the first forty-one stayed GREEN on a strip of the
tag the census row is named for**, which is the file working:

| census row | what the engine actually reads |
|---|---|
| `move\|inflictsBurn` (24,070), `move\|inflictsSleep`, `move\|inflictsParalysis` | `data/move-effects.js`'s **`fx.status`** — classified at medicham2:5269, applied at 3857. Neither the per-status tag nor `statusInflict` is consulted |
| `move\|inflictsFreeze` | **`fx.secondary`** — the secondary loop walks move-effects; `statusInflict` supplies only the format's CHANCE |
| `move\|readsTargetItem` (3,405), `move\|takesTargetItem` (3,709) | **`removesItem`** (and `removesItem.steals`) — the comment at medicham2:4243 says so in as many words |
| `move\|locksTarget` (5,583) | **`statusInflict`** — Encore's volatile arrives the same way Substitute's does |
| `move\|setsWeather` (1,607) | **`fx.weather`** out of move-effects; the tag is never consulted |
| `move\|doublesSideSpeed` (11,944) | **a hard-coded id**: `if(id==='tailwind')return {kind:'tail'}` |
| `move\|thawsTarget` (13,772) | for Flare Blitz, **the Fire TYPE clause**, not the tag |

None of these is a broken mechanic — every one of them works — but **the census row names a tag the
engine does not consume**, so a future regeneration that dropped that tag would move nothing and a
future consumer would inherit a dead name. Each demonstration now targets the fact that is actually
read, and says so at the line.

**`move|thawsTarget` GOT A THIRD ARM OUT OF IT.** The engine thaws on
`effMoveType === 'Fire' || TAGS.has(...,'thawsTarget')`, so Flare Blitz satisfies the first clause and
the artifact is never asked. **Matcha Gotcha (5,352 uses) is GRASS and carries the tag**, so the probe
now runs Crunch (no thaw) / Flare Blitz (thaws by TYPE) / Matcha Gotcha (thaws by TAG) and the
demonstration strips the tag off the carrier it actually drives.

**ONE TAG CANNOT BE DEMONSTRATED THIS WAY AND IS NAMED RATHER THAN FAKED.** `move|spreadAll` is read
through `const HITS_ALLY = new Set(TAGS.withTag('move','spreadAll'))` at medicham2:230, which is
evaluated when the module is required — `__setDB` afterwards cannot reach it. The probe is armed (Rock
Slide, a `spreadFoes` move, must leave my own partner untouched); the red demonstration is absent and
that is stated here.

**THE ARMS THAT WERE ADDED ARE CONTROLS, NOT ANNOTATIONS.** The rule applied throughout: the control
spends the SAME turn on a click that must NOT do the thing, so "a turn happened" is true on both arms.
Drain Punch against **Close Combat** (same type, same contact flag, no drain); Spiky Shield against
**Protect** (blocks identically, tolls nothing); Covet against **Knock Off** (empties the hand, does
not fill mine); Earthquake against **Rock Slide** (spreads to the foes, not to my partner); Life Dew
against **Recover** (heals, but not the partner); Tailwind read on **the foe's side as well as mine**;
Will-O-Wisp against **Spore** (so "a status move stamps one status" fails). Fourteen probes gained a
third arm on top, because two could not attribute the effect.

### AND MY OWN PROBE WAS WRONG BEFORE THE ENGINE WAS. THAT MAKES THIRTY-EIGHT.

The re-armed `forbidsStatusMoves` probe read the freed foe's pick out of `S.lastActs` and got
**"nothing"** in the control arm, reporting a working Taunt as MISSING. Two separate staging errors,
both found by looking at the record rather than at the engine:

- handing side B a **`null`** action map instead of a partial one leaves no side-B row in `lastActs`
  at all — the Disable probe next door already stages it as `new Map([[f2, {kind:'pass'}]])` and that
  is where the correct form came from;
- **a status click does not always carry a move NAME.** `chooseAction` emits Tailwind as
  `{kind:'tail'}` with `move: null`, so the reading is the KIND: every non-attack kind in this engine
  is a status click, which is exactly the set Taunt forbids.

### ONE RED TEST WAS MINE AND IT IS FIXED IN THIS PASS, AND IT LEFT A RATCHET SMALLER THAN IT FOUND IT

`tests/test-mc-key.js` went **13 passed / 2 failed → 15 / 0**. WIRE 132 added four computed
`MC.mons[...]` lookups to `medicham2-browser.js` and one to `probe_red_demo.js`, and that file's
whole point is that four separate callers wrote their own doorway into the species table and two of
them were silently broken for 8.17% of the metagame. The exception medicham2 holds — it is a browser
file and cannot `require('./mc_key.js')` — is not a licence to grow.

**Fixed by routing EVERY computed index in the file through one line**, `monRow(key)`, rather than by
re-baselining upward: `engine/medicham2-browser.js` **5 → 1**, and `tests/probe_red_demo.js` drops off
the list entirely because its WIRE 132 revert now targets the single line that asks the artifact
instead of embedding the old call site. The baseline was re-stamped **downward**, 17 → 16.

### FILED, NOT FIXED

- **`playerAction(...).move.acc` is written and read by nothing** in the whole repository.
- **`move|doublesSideSpeed`, and the weather and major-status families, are routed by a hard-coded id
  or by `data/move-effects.js` rather than by the tag the census names.** Listed in full above.
- **`move|spreadAll` is consumed at module-load time**, so no artifact mutation can produce a
  known-bad engine for it.
- **`data/engine-data.js` still has five mega rows with `mv: []` and one with `ab: null`** —
  `floette-eternal-mega` (orphan, unreachable), `salamence-mega`, `latios-mega`, `latias-mega`,
  `diancie-mega`. WIRE 132 recovers the one that has a base row and COUNTS the rest; the data fix is
  not ENGINE's. **`engine/artifact_audit.js` has no assertion for it**, and adding one would open a
  gate that cannot be closed from here.
- **`ability|auraBoost` is still absent, so a correctly-built Mega Floette carries Fairy Aura and the
  ability does nothing.** ROADMAP #64, untouched by this pass as instructed.
- **`tests/test-no-silent-failure.js` reports 3 NEW silent catch blocks, all in
  `engine/rerun_list.js` (lines 60, 136, 145). This pass did not touch that file** — its mtime moved
  during the session, so a concurrent writer was active. Reported, left alone.
- Everything below this section from the previous passes is unchanged.

## ACCURACY MODIFICATION LANDS AS ONE UNIT, AND THE FIRST TAG PROBED AFTER IT HAD WIRE 130 UNDER IT. 2026-08-06.

Census **218 live / 221 probed → 231 live / 232 probed**. Missing **3 → 1** — `ability|accuracyMod`
(Sand Veil) and `ability|writesAccuracy` (No Guard) were two of the three declared-missing mechanics
and both are live; only `move|needsTargetToAttack` remains, unchanged and for the reason recorded
below. `hollow` 0, `threw` 0, **`directCall` 0 and it did not rise** — the two new staging helpers
(`hitOnRoll`, `twoTurn`) are declared in `REALTURN` by name, exactly as that ratchet's comment
requires. `unarmed` **76 and unchanged**: all eleven new probes are armed.
`tests/probe_red_demo.js` **65 → 79 demonstrations, 0 failed**.

Every other instrument held. Differential **1/150**, the same pre-existing
`chesnaught woodhammer -> mimikyu` row and the same 11 not comparable; accuracy conformance
**500/500**. `tests/test-game-diff.js` agrees on every turn of all five scripted games. The
interaction matrix re-run at `--full` against the changed engine is **byte-for-byte identical to the
pre-pass artifact** — 1,624/1,643 (98.8%), the same 530 inert / 109 saturated / 16 ko-timing / 2
threw. `engine/feature_fixture.js --check` is **CLEAN — all 58 columns hash-identical to fit time**,
so **no refit is owed**. `tests/test-engine-consistency.js` all passed.
`tests/test-no-silent-failure.js` **0 new** (one was mine and it now speaks — see below).

**The coverage ratchet moved forward and was re-stamped.** `tests/test-medicham-coverage.js`
(b) "tags with NO PROBE AT ALL" **17 → 9**; (c) "tags whose every probe reports MISSING" **3 → 1**;
(a) 14, (d) 17 of 17, `notArmed` 62 — none of them rose. New baseline in
`data/medicham-coverage.json`.

**The generated block at the top of this file is one census behind**, because this pass was dispatched
under an explicit instruction not to run `engine/status.js --write`. **THE RESTAMP IS OWED**; the
artifacts already say the right thing.

### WIRE 129 — ~5,000 CORPUS USES OF "DOES THIS MOVE HIT" AND NOT ONE AXIS OF IT WAS WIRED

The dispatch was right that the four doors are one mechanic, and right that all four were open. What
the measurement added is that they were open in three *different* ways, so a single fix would not
have closed them:

| door | what was actually wrong |
|---|---|
| `move\|accuracyMod` (Coil 2,351, Minimize 1,050) | `SD2ENG` mapped `accuracy` and `evasion` to **null**. Eleven boost appliers in this file key off that map, so `data/move-effects.js`'s own `targetBoostsAlways:{atk:1,def:1,accuracy:1}` landed two thirds of the time and the accuracy stage was dropped on the floor |
| `item\|accuracyMod` (Wide Lens 757, Bright Powder 208) | nothing read the item at all |
| `ability\|accuracyMod` (Sand Veil 307, Snow Cloak 353) | nothing read the ability at all |
| `ability\|writesAccuracy` (No Guard) | nothing read the ability at all |
| **all four** | the battle loop's to-hit roll called `moveAccuracy(id, field)`, which **is handed no bodies** — the signature gap the census had been reporting as three separate misses since WIRE 78 |

Measured before a line of engine changed, both arms on each axis, into a Garchomp on 183 HP:

```
Hydro Pump (80) at roll 0.85 after Howl 0 / after Coil 0        <- Coil's +1 accuracy did nothing
Ice Beam  (100) at roll 0.85 into Protect 258 / Minimize 258    <- +2 evasion did nothing
Hydro Pump (80) at roll 0.85 no item 0 / Wide Lens 0            <- x1.1 did nothing
Hydro Pump (80) at roll 0.75 no item 116 / Bright Powder 116    <- x0.9 did nothing
Hydro Pump (80) at roll 0.70 sand + Sand Veil 115 / clear 115   <- x0.8 did nothing
Hydro Pump (80) at roll 0.99 no ability 0 / No Guard 0          <- never-miss did nothing
```

**Identical results across a varied knob mean the knob is unwired**, six times over.

**ONE AUTHORITY, `hitChance(att, def, id, field, ctx)`, AND ALL FOUR TO-HIT SITES CALL IT.** The
`affect` branch, the Leech Seed branch, the status branch and the attack branch each had their own
`moveAccuracy(...)` line; there are now four calls to one function. `printedAccuracy` is split out
underneath it so `true` survives as `true` — Showdown skips the boost table and every ModifyAccuracy
handler when a move cannot miss, so a +6 Minimize does nothing to Swift and cuts Ice Beam to 3/9.
**`moveAccuracy` keeps its exact signature and every value it returns**, because it is on the export
list `board.js` and `engine/position_features.js` read and its meaning may not move under them.

**THE STAGE TABLE IS NOT THE STAT TABLE**, and reusing `boostMul` is the comfortable mistake: stat
stages are (2+n)/2, accuracy and evasion stages are (3+n)/3, so +1 accuracy is 1.33x and not 1.5x and
+6 is 3x and not 4x.

**THE ARTIFACT'S DIRECTION IS INVERTED ON EVERY CARRIER, AND THAT IS A REAL BUG IN AN ENGINE-OWNED
FILE.** `engine/tag_dex.js`'s `writesAccuracy` derivation puts `onModifyAccuracy` under
*"its own moves"* and `onSourceModifyAccuracy` under *"moves aimed at it"*. Showdown fires the first
on the **TARGET** and the second on the **ATTACKER**. So `data/abra-tags.js` records **Sand Veil as
sharpening its own moves and Compound Eyes as sharpening the foe's** — precisely backwards, on all
nine carriers. Nothing had ever consumed `scope`, which is why it survived.

**The derivation is corrected in `engine/tag_dex.js`. The ARTIFACT is NOT regenerated, and the reason
is measured rather than assumed** — see the separate section below. So **nothing in the engine reads
`scope`**: membership comes from the tag (`accuracyMod` / `writesAccuracy`), and the number and the
direction come from `ACCMOD`, a table **re-derived on every run** by a new
`ACCURACY-MODIFIER CONFORMANCE` block in `tests/test-engine-diff.js`. It reads the handlers straight
out of `gen9championsvgc2026regmb` and takes the direction from the **hook name**, which is the fact:

```
onModifyAccuracy        handler on the TARGET     -> side 'def'    sandveil snowcloak tangledfeet wonderskin brightpowder laxincense
onSourceModifyAccuracy  handler on the ATTACKER   -> side 'att'    compoundeyes hustle widelens zoomlens
onAnyAccuracy           neither end may miss      -> both, never   noguard
onAnyModifyAccuracy     the whole SIDE            -> not expressible in hitChance
```

**12 handlers in the format, 13 rows in the table, 0 disagreements.** The block failed on its own
first run over a key-casing bug and named every row — which is the check working before it was
trusted.

**A CARRIER WITH NO ROW IS LOUD.** `MEDFAILS.accModUntabled` counts any entity the artifact tags as
touching accuracy that `ACCMOD` has no row for, and it reads **0**. A silent default here is
indistinguishable from the bug this wire fixes.

**THREE ROWS ARE DECLARED OFF WITH THEIR REASONS, RATHER THAN HALF-WIRED**, because a tag consumed
half-right is how the 20-mechanic batch went wrong:
- `tangledfeet` — needs the confusion volatile and **this engine has no confusion at all** (4 uses);
- `victorystar` — its `onAnyModifyAccuracy` guard is `source.isAlly(...)`, so it boosts the whole
  SIDE, and `hitChance` holds one attacker and one defender and no side (0 uses in this regulation);
- `skilllink` — a **FALSE POSITIVE in `data/abra-tags.js`**: `tag_dex`'s probe matches `/accuracy/i`
  against Skill Link's `delete move.multiaccuracy`. It writes multihit, not accuracy. The row exists
  so the untabled counter does not report it forever, and it applies nothing.

**THE ATTACK-SITE ROLL MOVED BELOW TARGET RESOLUTION, AND THAT IS THE HALF THAT NEEDED A DEFENDER.**
It used to happen above `const foes=...`, where no defender exists — so the whole `def` side of
accuracy was unreachable there whatever `hitChance` did. Nothing between the old site and the new one
consumes rng, and that is **verified rather than argued**: the interaction matrix is byte-for-byte
identical.

**ONE ROLL PER MOVE, NOT PER TARGET, IS A DECLARED DIVERGENCE AND IT IS COUNTED.** Showdown rolls
accuracy separately against each target of a spread move. Rolling per target here would change how
much rng every seeded run in the repository consumes, which is a much larger change than this wire is
buying — so a spread move rolls once with the attacker's modifiers only and increments
`MEDSEEN.accSpreadNoDefender`. Single-target moves, where every evasion item and ability in this
format actually lives, get the real defender.

### WIRE 130 — SUBSTITUTE WAS PAID FOR AND NEVER BUILT. 1,976 CORPUS CLICKS OF A MOVE STRICTLY WORSE THAN PASSING.

Found by writing the probe for `move|substitute`, the second-biggest tag on the coverage gate's
"NO PROBE AT ALL" list. Measured before anything changed, a Garchomp on 183:

| the foe clicked | it paid | then took Ice Beam for | `_sub` |
|---|---|---|---|
| Howl | 0 | **183** | – |
| **Substitute** | **45** | **138** | **0** |

`playerAction` resolves Substitute to `kind:'affect'` — it carries `statusInflict` with a volatile,
and that branch is checked long before the `costsUserHP` fallback. So **the `kind==='sub'` branch
WIRE 42 wrote for it is unreachable and always was**, and what ran instead was the generic
`costsUserHP` deduction at the top of the resolution loop. The click bought a quarter of the user's
max HP worth of nothing. WIRE 42's own comment says it modelled both halves *"on purpose"* because
charging the cost without granting the doll *"would make the most-clicked defensive setup move in the
format strictly worse than doing nothing"*. That is exactly what shipped.

**MEMBERSHIP PRINTED BEFORE IT WAS WIRED.** `move|substitute` matches exactly two rows and both are
real: `substitute` (buffer 0.25) and `shedtail` (buffer 0.25, and it pays **half** for the same
quarter-size doll — so the buffer is read from the tag and never inferred from the cost).

Three fixes, one authority each:
- `grantSubstitute(m, moveId)` builds the doll from the tag's `buffer`, called from the generic cost
  block and from the `sub` branch, so the doll has one size and not two;
- a **second** Substitute now fails **before** the deduction. Showdown returns early when the volatile
  is up and never charges; paying for a doll you do not get is worse than either outcome;
- `subBlocks(att, def, moveId)` is the one answer to "does the doll eat this", asked by the damage
  path **and** by every status path.

**AND IT CLOSED THE DECLARED DIVERGENCE THAT SAT AT THE ABSORB SITE.** That line said, in a comment,
that sound moves and Infiltrator go through a real substitute and this engine did not track either.
They do now — and the fix went in the direction the measurement chose, not the comfortable one:

**THE COMFORTABLE VERSION WOULD HAVE BEEN A BIGGER BUG THAN THE ONE IT FIXED.** The obvious rule is
"a substitute blocks status moves, except sound ones", built on the `sound` tag the artifact already
has. Measured against the format first: the three most-clicked status moves that reach a substitute
in this regulation — **Encore (4,848), Taunt (1,503), Disable (730)** — all carry `bypasssub` and
**none of them is a sound move**. That rule would have walled all three.

The real fact is Showdown's `bypasssub` flag and **no artifact this engine reads carries it**:
`data/move-effects.js` has no flags block and `data/abra-tags.js` has no tag for it. So it is a
51-entry `SUBPASS` set in the engine, re-derived over all 500 moves in `MC.moves` on every run by a
new `SUBSTITUTE-BYPASS CONFORMANCE` block in `tests/test-engine-diff.js`: **51 carried, 0 missing, 0
invented.** Infiltrator comes from the artifact's own `ignoresScreensAndSubs.ignoresSubstitute`, never
from its name.

After: Ice Beam into a substituted Garchomp deals 0, Hyper Voice deals 45 with the doll still
standing, an Infiltrator's Ice Beam deals 138, Will-O-Wisp burns nothing through a doll and burns
without one, and a second Substitute costs nothing.

### THE ELEVEN NEW PROBES, AND THE FIVE THINGS THEY MEASURE THAT NOTHING DID

`move|accuracyMod`, `item|accuracyMod`, `ability|accuracyMod`, `ability|writesAccuracy`,
`move|substitute`, `ability|ignoresScreensAndSubs`, `move|swapsAbilities`, `move|readsOwnItem`,
`move|ohko`, `ability|survivesFromFull`, `ability|boostsFromFallen`. All eleven spend real turns, all
eleven are armed, and each has a demonstration in `tests/probe_red_demo.js` — **fourteen new
demonstrations, each reverting exactly one argument, one table row or one operand.** Two of them are
reverted in the direction that still "works", which is the shape a one-armed probe cannot see:
`_accWhen('sand') -> return true` leaves Sand Veil firing and only the CLEAR-SKY control catches it;
`subBlocks -> tg._sub>0` leaves the doll eating Ice Beams and only the sound arm catches it.

**`move|ohko` IS STOCHASTIC AND THE PROBE ASSERTS THE MECHANISM.** The target is given **eight times**
its max HP, so no damage formula in this engine can reach it — a faint can only be the OHKO rule. The
control is Ice Beam at the *same winning roll*, which must NOT faint it, so "Fissure kills it" cannot
be reached by a staging that kills it anyway.

**`ability|boostsFromFallen` IS SUPREME OVERLORD AND IT IS WHY THIS BATCH EXISTS.** WIRE 125 found the
death counter falling back to zero one turn after every death, and found it because Last Respects had
a probe; Supreme Overlord reads the same field and had none. It is live and correct: Iron Head 97 with
0 fallen, **126** with 3 (the tag says +10% each, capped at 5). The staging is three turns because the
snapshot is taken at **switch-in** (`countedAt: "switch-in"`), and the third arm — no ability, three
fallen, 97 — separates "the ability" from "the deaths".

### AND MY OWN PROBE WAS WRONG BEFORE THE ENGINE WAS. THAT MAKES THIRTY-SEVEN.

The first `boostsFromFallen` probe put the Kingambit on the field at `battleInit` and killed three
bench bodies, then clicked. It read **97 in every arm** and reported the mechanic missing. Supreme
Overlord snapshots at switch-in and that body never switched in, so on a perfectly correct engine the
probe was asking a question with one answer. The fix is a real switch action after a real end-of-turn
recount — and the same staging then showed the counter is right for a *faint replacement* in the same
turn as the death, which was worth knowing and is now measured rather than assumed.

### `data/tags.json` CANNOT BE SAFELY REGENERATED TODAY, AND THE REASON IS NOT ENGINE'S — ROADMAP #65

The `tag_dex` fix above only reaches the engine through a regeneration, so a regeneration was tried
and measured against the current artifact rather than trusted. **Tag membership and every param are
identical — 0 differences across 500 moves, 262 abilities and 146 items.** What moved is usage, and
it moved a long way:

```
sheet_entries  110,760 -> 78,480      (fit_policy.loadCorpus(), the corpus tag_dex counts over)
move:priority   134,174 -> 96,911     move:contact 129,222 -> 90,974     and so on, uniformly
```

**Five entities DROP OUT of the artifact entirely**, because their usage fell to zero:
`ability curiousmedicine`, `ability serenegrace`, `ability steelyspirit`, `ability tintedlens`,
`item leppaberry`. `data/abra-tags.js` is what the engine reads params from, so regenerating would
**silently delete Serene Grace and Tinted Lens from the engine's knowledge**. That is a regression and
this pass did not make it. `data/tags.json` was restored byte-identical (`git status` clean on it).

**This is not an ENGINE finding and it is not ENGINE's to fix.** The corpus `fit_policy.loadCorpus()`
returns shrank by 29% at some point since the artifact was last generated. **Routed out: MEASURE or
OPS should say whether that is a deliberate re-filter or a store problem.** Until it is answered, the
`writesAccuracy` scope correction sits in `engine/tag_dex.js` and not in the artifact — which costs
nothing, because nothing consumes `scope`.

### WHAT IS STILL UNPROBED, WITH THE REASON, RATHER THAN A PROBE THAT PASSES ON A DELETED MECHANIC

Nine tags remain on the coverage gate's (b) list. Four of them are **absent from the engine**, and a
probe for those would go red — which is the honest state and is exactly what the (c) ratchet counts.
They are reported here rather than staged, because writing a probe that passes on a deleted mechanic
is what created the 47 direct-call probes in the first place:

| tag | measured state |
|---|---|
| `ability\|auraBoost` (Fairy/Dark Aura, the biggest at 5,663) | **absent, and it needs state `dmgRange` cannot see.** Measured: Dazzling Gleam deals 79 with Fairy Aura on the attacker, on its ally, on the foe, and on nobody. The multiplier is field-wide over **every body on the field**, and `dmgRange(att, def, mv, field, spread)` is handed two bodies and a field that holds no roster. Wiring it means putting the active abilities on `field` — which changes an input `board.js`'s six exports read. **A design call, not a patch; routed for a decision — ROADMAP #64.** |
| `move\|instructsTarget` (Instruct, 2,222) | **absent by construction and declared at the line**: `playerAction` excludes `instructsTarget` from the `reorder` branch, so Instruct resolves to `pass`. Making the target take an extra action means re-entering action resolution from inside the resolution loop. |
| `move\|passesState` (Baton Pass 1,793, Shed Tail) | **absent.** Needs boosts and volatiles to survive a switch; `switchOut` clears `out.boosts` unconditionally. Shed Tail's substitute half now works, its pass half does not. |
| `move\|punishesBoostedTarget` (Alluring Voice 604, Burning Jealousy) | **absent and it needs a fact nothing tracks.** Measured: Burning Jealousy leaves a +2 target unburned. The tag is `onlyIfTargetBoostedThisTurn` and no per-turn "was boosted" flag exists. Alluring Voice's half also needs the **confusion volatile**, which this engine does not have at all — the same missing state Tangled Feet is off for. |
| `ability\|randomBoostEachTurn` (Moody, 590) | **STOCHASTIC and staged only against a seeded rng.** Not attempted this pass. The probe must assert the mechanism — a stat moved up two and another down one — and not a particular stat. |
| `ability\|terrainSetter` (2,044), `ability\|switchInForme` (511), `ability\|amplifiesBoosts` (309), `move\|dualPurpose` (363) | not measured this pass. |

**CLOSED 2026-08-07 (WIRE 133–137) — every row in the table above except `amplifiesBoosts` now has a
probe and the census carries it, so none of them is open work any more.** `auraBoost` and
`passesState` landed with ROADMAP #81 WIRE 12; `instructsTarget`, `punishesBoostedTarget`,
`randomBoostEachTurn`, `terrainSetter`, `switchInForme` and `dualPurpose` landed in this pass. Two of
the diagnoses in that table were WRONG and the corrections are worth keeping beside them:
`terrainSetter` was measured as "not measured" and was in fact **already fully live**, and Instruct's
"re-entering action resolution from inside the resolution loop" is not what the mechanic needs — the
authority QUEUES an action (`queue.prioritizeAction`) rather than executing one, and the queue is the
`acts` array this engine already re-sorts before every action. `punishesBoostedTarget`'s "no per-turn
was-boosted flag exists" was true and the answer was not to add one to twelve raise sites but to take
a SNAPSHOT of the stages as the turn opens. The `confusion` half of Alluring Voice is still absent and
is now counted rather than merely described (`MEDFAILS.punishEffectUnmodelled`).

### FILED, NOT FIXED

- **`data/tags.json` / `data/abra-tags.js` carry an INVERTED `writesAccuracy.scope` on all nine
  carriers.** The derivation is fixed in `engine/tag_dex.js`; the artifact is not, for the corpus
  reason above. Nothing reads it, so the engine is correct either way — but any *other* consumer that
  starts reading `scope` inherits the inversion.
- **`ability|skilllink` carries `writesAccuracy` in the artifact and should not.** `tag_dex`'s probe
  matches `/accuracy/i` against `delete move.multiaccuracy`. Same regeneration blocker.
- **A spread move's to-hit roll ignores the defender**, counted as `MEDSEEN.accSpreadNoDefender`.
- **`engine/medicham_coverage.js` and `data/provenance-stamp.json` were modified in the tree during
  this pass and this pass touched neither.** `medicham_coverage.js` gained a 65-line artifact-writing
  block. **Reported, left alone**, per the do-not-delete rule — but it means a concurrent writer was
  active, and a `run-all` result taken while somebody else is writing is not a photograph.
- Everything below this section from the previous passes is unchanged, including
  **`clickFragility` pricing an -ate click against the raw move type** (routed to MEASURE, #50) and
  the **`dmgRange` `damageReduce` over-match on `prismarmor` / `shadowshield` / `ripen`**.

## THE DIRECT-CALL COUNT REACHED ZERO, AND THE LAST NINE CONVERSIONS FOUND WIRE 128. 2026-08-06.

Census **218 live / 221 probed**, unchanged; missing still 3 (the same three), hollow 0, `threw` 0.
**`directCall` 37 → 0** and it is now a FIELD IN THE CENSUS, computed structurally and ratcheted.
`unarmed` **116 → 76**. `tests/probe_red_demo.js` **38 → 65 demonstrations, 0 failed**. Differential
unchanged at **1/150** (the same pre-existing `chesnaught woodhammer -> mimikyu` row, the same 11 not
comparable, accuracy conformance 500/500). `tests/test-game-diff.js` agrees on every turn of all five
scripted games. The interaction matrix re-run at `--full` against the changed engine is
**byte-for-byte unchanged**: 1,624/1,643 live pairs agree (98.8%), the same 530 inert / 109 saturated
/ 16 ko-timing / 2 threw / 53 off-gate. `engine/feature_fixture.js --check` is **CLEAN — all 58
columns hash-identical to fit time**, so no refit is owed.

**The generated block at the top of this file is one census behind**, because this pass was
dispatched under an explicit instruction not to run `engine/status.js --write`. **THE RESTAMP IS
OWED**; the artifacts already say the right thing.

### WIRE 128 — THE BATTLE LOOP AND THE DAMAGE CALC HAD TWO DIFFERENT ANSWERS TO THREE QUESTIONS

Found by converting `ignoresTypeImmunity`, `ignoresDefenderAbility` and `immuneToMoveClass`, which
are the three probes on the ranked list that ask about an ATTACKER changing a DEFENDER's refusal.
All three were green. All three were asking `dmgRange`, which was the half that was already right.

Measured before a line of engine changed, both arms printed:

| | `dmgRange` said | a real turn dealt |
|---|---|---|
| Scrappy Incineroar, Body Slam → Gengar | **88** | **0** |
| Mold Breaker Tinkaton, Earthquake → a Levitate body | **60** | **0** |
| Mold Breaker Tyranitar, Rock Blast → Bulletproof | (blocked at the calc too) | blocked |

Three separate gates in `battleTurn`, each a second implementation of a fact `dmgRange` already owned:

- the stage-5 type gate was a bare `mcEff(effMoveType(...), tg.types)`. It knew nothing about
  **Scrappy / Mind's Eye** (so every Normal and Fighting click from a Scrappy body into a Ghost dealt
  zero in every rollout and every self-play game this engine has ever run) and nothing about
  **Freeze-Dry / Thousand Arrows**' `overridesEffectiveness`, which can turn a chart zero into a hit.
- the absorb gate read `tg.ability` **raw**, so a Mold Breaker, Teravolt or Turboblaze click was
  absorbed by Levitate, Volt Absorb, Water Absorb, Flash Fire, Sap Sipper, Motor Drive, Earth Eater,
  Well-Baked Body, Lightning Rod and Storm Drain — every one of which Showdown marks `breakable`.
- `moveClassBlocked()` read `tg.ability` raw as well, while **dmgRange carried its own private copy
  of the same check** that used the suppressed ability. Two implementations of one rule, in one file,
  already disagreeing.

Three functions now, one owner each — `suppressedAbility`, `typeEffAgainst`, `absorbedBy` — and
`dmgRange`'s inline `immuneToMoveClass` block is deleted in favour of `moveClassBlocked(def, id, att)`.
Every one of the ten `moveClassBlocked` call sites in the file now passes the acting mon.

**THE SUPPRESSION SET WAS PRINTED BEFORE IT WAS TRUSTED, per docs/LESSONS.md 4.** Every ability in
`data/tags.json` carrying `typeImmunity` or `immuneToMoveClass` was checked against
`Dex.forFormat('gen9championsvgc2026regmb')` at the pinned commit `20ad99ff`: **32 of 35 relevant
abilities are `breakable`, and all of the typeImmunity and immuneToMoveClass carriers are.** So the
fix cannot over-match on the two gates it touches. **The three that are NOT breakable —
`prismarmor`, `shadowshield`, `ripen` — all carry `damageReduce`, which `dmgRange` was ALREADY
suppressing before this pass. That is a pre-existing over-match, it is FILED below, and it is latent:
Prism Armor and Shadow Shield have zero corpus usage and Ripen has 14.**

`tests/probe_red_demo.js` gained three source-reverted demonstrations, one per gate, each reverting
exactly the one argument that carries the attacker and nothing else. Each asserts its control in
BOTH engines, so "Scrappy landed" cannot be reached by an engine that stopped enforcing
Normal-into-Ghost altogether.

### `directCall` IS A CENSUS FIELD NOW, AND IT IS THE RATCHET

`unarmed` falls as paperwork and says nothing about coverage. `directCall` only falls when a probe
starts spending a real turn, which is the class of probe that can catch a wiring bug — and WIRE 123,
WIRE 126 and now WIRE 128 are all wiring bugs that sat green under a direct-call probe.

It is computed **structurally over each probe's own source** (`String(fn)` against
`/battleTurn|battleInit|\bboard\(|\bturnDamage\(|\bturnDamageBig\(/`), written to
`data/mechanics-census.json` as `directCall`, printed with the offending probes named, and
**ratcheted: it may fall and may never rise**. The helper list is explicit rather than a loose
pattern, and that cost two probes their credit the first time `turnDamageBig` was used — which is the
strictness working: a new helper has to be declared, and cannot sneak a direct-call probe past.

### THE OTHER 29 CONVERSIONS, AND WHAT CHANGED BESIDES THE ROUTE

Nine of them were made STRICTER because the conversion exposed that they had no control at all:

| probe | what it used to accept |
|---|---|
| `ignoresStatStages` Sacred Sword | `a.max === b.max` — what an engine ignoring stat stages for EVERY move prints. Close Combat is now the control and must fall |
| `alwaysCrit` / `preventsCrit` Flower Trick | a synthetic id-renamed copy, which **cannot be clicked** — Knock Off at rng 0.99 is the control now |
| `untagged` Marvel Scale | it burned BOTH bodies and varied only the ability, which cannot tell "hardens while statused" from "hardens always" |
| `halvesTypeDamage` Dry Skin | one arm. Body Slam must not move |
| `weatherSuppression` Air Lock | `control > test`. The suppressed number must EQUAL the clear-sky number, not merely be smaller |
| `setsTerrainEveryMember` | `playerAction(...).kind === 'terrain'` — a CLASSIFICATION. It now reads the terrain standing on the board |
| `privateWeather` Mega Sol | the "private" half was asserted in a COMMENT. The field is now read after the turn and an ALLY holding it must not benefit |
| `recoil` / `spreadFoes` / `secondaryStatEffect` / `statusInflict` | one arm each: "the user lost HP", "both foes took damage", "the stat dropped", "it burned" — all true of engines with much worse bugs |
| `multiAccuracy` Triple Axel | the previous pass declined this as a pricing question `dmgRange` owns, and that was right about the ratio. The turn asks something new: the discount is 1+p+p²=2.71, the CONDITIONAL expectation, and the loop then rolls to hit on top of it — measured, it misses at rng 0.99 and lands at 0.5, so the 90% is not counted twice |

**`needsTargetToAttack` STAYS MISSING AND THE REASON IS NOW RECORDED RATHER THAN GUESSED AT.** The
old probe set `curHP = half` and called that "already hit", which is a HP LEVEL and not an event; the
real rule is *damaged by the target this turn*, and Avalanche is -4 priority so a foe clicking in the
same turn always lands first. Staged that way it is still flat. The tag carries
`{needs: "target attacking"}` for **all nine** of its members, and those nine do four completely
different things with that condition — double the power, reflect the damage, fail outright, go first.
Sucker Punch's half IS wired, through the separate and much sharper `failsIfTargetNotAttacking`.
**The fix is a tag before it is any code.**

### AND MY OWN PROBES WERE WRONG BEFORE THE ENGINE WAS, THREE TIMES. THAT MAKES THIRTY-SIX.

- **34.** `untagged` Marvel Scale, first cut: arms were the STATUS at a fixed ability, and it read
  `clean 92 → burned 147` — the ability apparently making the body softer. It was the end-of-turn
  **burn chip**, which lands inside the same HP-loss reading. Both burned arms carry the identical
  chip on the identical body, so comparing them cancels it; comparing a burned arm against a clean
  one does not.
- **35.** `weatherAccuracy` Thunder fired at a **Garchomp**, which is Dragon/GROUND and takes
  literally nothing from an Electric move. Every arm read 0 including the winning-roll control, and
  on a perfectly correct engine the probe reported the mechanic MISSING. A never-miss claim means
  nothing against a target the move cannot damage.
- **36.** `privateWeather`, first cut: the "ally holds it" arm put the ability on the ally **and then
  had the ally shoot** — the same body wearing a different label. It read 179 both ways and looked
  exactly like a private sun leaking across the side.

### THE COVERAGE GATE — WILL'S 99%-OF-USAGE BAR, DERIVED AND RED-PROVEN

`tests/test-medicham-coverage.js`, auto-discovered by `tests/run-all.js`. Will approved the target on
2026-08-06: **99% of usage, plus a carve-out for anything that can turn a CERTAINTY into a FAILURE
regardless of usage.** Nothing in the file names a Pokemon, a move, an ability or an item —
`tests/regulation_usage.js` derives the set at runtime from the store (a ~8s scan, cached on the
corpus's own size and mtime so a changed store re-derives). **A threshold is a list and goes stale; a
coverage target is a mechanism and re-derives itself**, which is the whole reason Will picked a target.

**IT IS THE UNION OF THE RAW AND THE CLEAN CORPUS, AND THE FIRST VERSION WAS WRONG ABOUT WHY.** The
gate initially read the raw store only, with the comfortable story that raw is the conservative
direction because bot spam can only ADD junk entities. `engine/selftest.js`'s clean-data check caught
the new file, and measuring rather than declaring showed the story is wrong in one of the two
directions:

| | distinct with any usage | the 99%-of-usage prefix |
|---|---|---|
| raw, 46,211 games | moves 486, ab 175, items 146 | moves 277, ab 78, items 100 — **455** |
| clean, 8,193 games (`engine/quality.js`) | moves 462, ab 167, items 142 | moves 283, ab **98**, items 107 — **488** |

The raw store SEES MORE distinct things and demands a SMALLER prefix, because repeated bot clicks
concentrate the distribution. The clean corpus sees fewer and demands a LARGER one. **Neither
dominates, so picking either would have quietly relaxed the bar** — and on abilities the raw-only
version was asking for 78 where the clean corpus asks for 98. The gate takes the **union**, which is
strictly more demanding than both and cannot be moved by the mix of games in the store. `RAW-STORE-OK`
was NOT declared; the clean filter is applied, which is the honest way to satisfy that rule.

**807 things carry real usage in this regulation and 495 are in the union of the two 99% sets**
(moves 288 of 486, abilities 98 of 175, items 109 of 146). Usage for weighting is raw + clean, so an
entity only one corpus saw still carries weight.

| | count in the 99% set | | | | usage-weighted | | | |
|---|---|---|---|---|---|---|---|---|
| | tagged | probed | LIVE | armed | tagged | probed | LIVE | armed |
| moves (288) | 286 | 272 | 269 | 151 | 99.4% | 98.5% | **96.7%** | **63.1%** |
| abilities (98) | 87 | 80 | 78 | 53 | 98.7% | 93.5% | **93.3%** | **81.8%** |
| items (109) | 108 | 107 | 107 | 88 | 99.9% | 99.7% | **99.7%** | **58.8%** |

**Move-armed was 9.2% of usage when the gate was first run**, against 260 of 277 moves LIVE — the
count read respectably and the weighted figure did not, which is exactly the pair of numbers the gate
exists to put side by side. The gap was that the handful of tags the biggest moves carry
(`statusInflict` 585,893, `contact` 444,874, `priority` 359,331, `statChange`, `spreadFoes`,
`stalling`) were the ones nobody had declared arms on. **Those ten were armed, chosen by the weighted
number rather than by eye, and it moved to 63.1%.**

**"NO PROBE" IS REPORTED SEPARATELY FROM "UNARMED", because it is a worse state.** 17 tags carried by
the union set have no probe at all: `move|accuracyMod` (5,986), `ability|auraBoost` (5,620),
`move|substitute`, `move|instructsTarget`, `move|swapsAbilities`, `ability|terrainSetter`,
`move|passesState`, `move|ohko`, `move|readsOwnItem`, `move|punishesBoostedTarget`,
`ability|randomBoostEachTurn`, `ability|switchInForme`, `move|dualPurpose`, `ability|amplifiesBoosts`,
`ability|boostsFromFallen`, `item|accuracyMod`, `ability|survivesFromFull`. **That is the ranked next
job.**

**THE CARVE-OUT IS 17 TAGS AND IT IS FULLY COVERED: 17 of 17 live and armed.** It is a set of TAG
SHAPES, never of entities — naming Queenly Majesty would leave Dazzling and Armor Tail out, and
naming `blocksMove` picks up all three plus the fourth that ships next generation. Every tag is
asserted to exist in `data/tags.json`, so an upstream rename fails the file loudly instead of quietly
emptying the carve-out. Three are excluded and the two REASONS are printed apart, because they are
different: `item|blocksPowder` and `item|blocksSecondary` have **no row in the artifact at all**
(Safety Goggles and Covert Cloak are `isNonstandard` in this format), while `ability|preventsSwitch`
has **three real carriers at zero usage** and could become live tomorrow with no code change.

**IT IS A RATCHET, NOT A BAR AT 100%.** A permanently red gate is what this repository has already
learned gets called a "known failure" and ignored. The counts may fall and may never rise, the
baseline is `data/medicham-coverage.json`, and **a rise fails whether it came from a regression or
from the metagame bringing in something unprobed** — both are work owed — with the new-since-baseline
rows named so the reader can tell them apart.

**AND IT IS SHOWN RED BEFORE IT IS TRUSTED.** `--selftest` plants three faults in memory and asserts
rejection on each: a tag nothing probes bolted onto the single highest-usage move in the corpus
(derived, not named — it picked `protect`, 175,476 uses), every probe of a tag that move carries
marked MISSING, and every probe of `ability|blocksMove` killed. All three are caught, by the three
different clauses.

**(a) IS SPLIT BY KIND AND THE SPLIT IS LOAD-BEARING.** 14 entities in the union set carry only
`untagged`. Two are MOVES — Power Gem (6,371) and Hydro Pump (4,799) — and a move with no mechanic is
a **vanilla attack the generic damage path covers completely**, so counting it as a gap would be
counting the engine working. Twelve are abilities and one item, and every ability does *something*:
`pressure` (962), `telepathy` (462), `berserk` (245), `moxie` (204), `raindish` (119), `naturalcure`
(115), `trace` (100), `magician` (95), `aromaveil` (71), `frisk` (45), `magicguard` (34), and
`item ironball` (189). **That is a tag_dex job, not an engine one.**

**AND `ability|accuracyMod` JOINED THE MISSING LIST WHEN THE UNION LANDED**, which is the gate doing
exactly what it is for: Sand Veil is in the CLEAN corpus's 99% ability set and was not in the raw
one, so a mechanic the census has reported MISSING all along became visible as a coverage gap. It is
one of the three census misses and is not new work discovered by this pass — it is the same hole,
now counted.

### THREE RED TESTS WERE MINE AND ALL THREE ARE FIXED IN THIS PASS

`tests/run-all.js` went **75 passed / 8 failed → 78 / 5**. Named rather than filed, because
"KNOWN FAILURE" is a banned phrase here:

- **`engine/selftest.js` — "every raw reader of the ladder store declares why".** The new files read
  the store and neither filtered nor declared. **Fixed by MEASURING rather than by declaring**, and
  the measurement changed the gate: `RAW-STORE-OK` would have been a claim that raw is the
  conservative direction, and it is not. `tests/regulation_usage.js` now calls `engine/quality.js`'s
  own `loadGames()` and the gate reads the union. 25 passed, 0 failed.
- **`tests/test-no-silent-failure.js` — 3 NEW silent catch blocks, all mine.** An unparseable store
  line is now COUNTED and printed (`unparsed`, currently 0); a cache that will not read says so, and
  is told apart from a cache that does not exist yet; the coverage ratchet's missing baseline is told
  apart from a corrupt one. 0 new.
- **`tests/test-effective-identity.js` — `tests/regulation_usage.js: 0 -> 2` raw reads of a
  transforming field.** DECLARED with a construction reason rather than re-baselined: the file never
  builds, loads or touches a live Pokemon — it opens the store, counts strings and returns
  `id -> integer` maps — and the PRE-mega ability is the answer the question wants, because it is
  measuring how much usage each declared ability carries. 18 passed, 0 failed.

**THE FIVE THAT REMAIN ARE NOT MINE, and one of them appeared mid-session from another writer.**
`tests/test-site-data-fresh.js` (eleven site bundles ~1.1 days behind the newest game data),
`engine/conformance.js` (`build/strong_player_baseline.js` ×2, `data/dusk-size-gate.json`,
`data/json-nan-guard-baseline.json`), `engine/provenance.js` (the pre-existing declared-void
`exploitability.json`), `engine/em_validation.js` (`board.js` and `fit_policy.js` digests moved, and
this pass touched neither). **`tests/test-site-sync.js` — `web/stadium.html` vs `app/stadium.html`,
137,656 against 114,884 bytes — was PASSING at 14:00 and failing by 15:06.**

**A CONCURRENT WRITER WAS ACTIVE IN THE TREE DURING THIS PASS AND THE DISPATCH SAID THERE WAS NOT.**
`web/stadium.html` (15:06) and `docs/MODELS.md` (14:34) both moved and this pass touched neither;
`tests/test-stadium-roster.js` flipped from FAIL to PASS between two of my runs because somebody
added the three missing ledger entries. **Nothing of mine overlaps** — every file this pass wrote is
`engine/medicham2-browser.js`, `tests/*`, `docs/ENGINE.md` and three `data/` artifacts it generated —
and the engine-side instruments (census, red demos, differential, game-diff, interaction matrix,
feature fixture, coverage gate) all read files this pass owns. It is stated because a run-all result
taken while somebody else is writing is not a photograph, and this repository has already lost 7,100
games to exactly that assumption.

### FILED, NOT FIXED

- **`dmgRange` suppresses `damageReduce` for a Mold Breaker on three abilities Showdown marks NOT
  breakable** — `prismarmor`, `shadowshield`, `ripen`. Pre-existing (WIRE 37's `defAb` shadow), and
  latent: 0, 0 and 14 corpus uses. The clean fix needs the artifact to carry Showdown's `breakable`
  flag, which is `tag_dex` work.
- **`STATUS_IMMUNE_ABIL` is a hand table and the red demo proves it.** Stripping `statusImmune` off
  Insomnia does not stop it refusing Spore. That deviation is already declared — the artifact's param
  is a bare `{immune: true}` on all twelve carriers and does not say WHICH status, so consuming it by
  shape would make Leaf Guard (sun only) and Pastel Veil (poison only) refuse everything always. The
  demonstration is now a **source reversion** rather than a tag strip, so the declared thing is shown
  to be the thing running.
- Everything below this section from the previous passes is unchanged, including
  **`clickFragility` pricing an -ate click against the raw move type** (routed to MEASURE, #50) and
  **`data/move-effects.js` disagreeing with the format dex on four accuracies**.

## THE DIRECT-CALL PROBES WERE ARMED, AND THREE OF THEM WERE HIDING A BUG. WIRES 124–126. 2026-08-06.

Census **217 → 218 live / 220 → 221 probed**; missing still 3 (the same three), hollow 0, `threw` 0.
`unarmed` **145 → 116**. **28 of the 47 direct-call probes were converted to spend a real turn** —
the whole ranked top 30 bar two, each named below with its reason. Differential unchanged at **1/150**
(the same pre-existing `chesnaught woodhammer -> mimikyu` row, the same 11 not comparable).
`tests/test-game-diff.js` agrees on every turn of all five scripted games. The interaction matrix was
re-run at `--full` against the changed engine and is **byte-for-byte unchanged**: 1,624/1,643 live
pairs agree (98.8%), the same 530 inert / 109 saturated / 16 ko-timing / 2 threw, the same six named
disagreements. `tests/probe_red_demo.js` is **38 demonstrations, 0 failed** (was 35).

**Every one of the three bugs below was invisible to the probe that covered it**, and that is the
finding this pass was dispatched to test. All three sat under a probe the census graded **LIVE**.

**The generated block at the top of this file is one census behind**, because this pass was dispatched
under an explicit instruction not to run `engine/status.js --write`. **THE RESTAMP IS OWED**; the
artifacts already say the right thing.

**AND THE RED-DEMO GUARD EARNED ITS KEEP MID-PASS.** WIRE 124's reversal patch was written, then the
engine block it reverts was edited again (the `moveFx` catch was given a counter so
`tests/test-no-silent-failure.js` would stop flagging it). `revertedEngine()` threw
`reversal did not apply — the source no longer contains:` and printed the stale text. That is the
alternative to a known-bad engine quietly becoming the shipped one, which would have made every
demonstration below it meaningless while still printing OK.

### WIRE 124 — 78 MOVES COULD NOT MISS, AND THE PROBE ASSERTED THE ANSWER

`moveAccuracy` ended `return ACC[id]||100` over a **hand-typed 35-move literal**. Every move not on
that list was never-missing. Measured over all 500 moves in `MC.moves` against the format dex at the
pinned commit `20ad99ff`:

| | |
|---|---|
| moves with accuracy below 100 in `gen9championsvgc2026regmb` | **78** |
| of those, present in `ACC` | **0** |
| corpus clicks on them | **35,608** |

Led by **Heat Wave 90% (7,405 clicks)**, Matcha Gotcha 90% (5,352), Dual Wingbeat, Make It Rain,
High Horsepower, Draco Meteor, Hyper Beam, Icy Wind, Toxic, Rock Tomb, Triple Axel, Population Bomb.

**THE PROBE COULD NOT HAVE SEEN IT, AND SAID SO IN ITS OWN SHAPE.** It read
`moveAccuracy('aerialace') >= 100` — which is exactly what an engine where *everything* is 100 also
returns. A never-miss set means nothing unless the moves outside it can miss, and nothing asked.

**The source was already in the tree and two other sites in this same file were already using it.**
`data/move-effects.js` carries `accuracy` for all 954 of its moves (`true` for a never-miss), it is
already a frozen release SOURCE, and the two status branches in the battle loop already read
`(fx&&fx.accuracy===true)?100:...` for this exact purpose. So the defect was **also a
FACTS-ARE-GLOBAL violation**: two accuracy engines in one file, one derived and one typed, disagreeing
on 78 moves. All three sites now call `moveAccuracy`.

**`ACC_FIX` IS NOT THE OLD LIST SHRUNK.** It is the rows where the GENERATED artifact disagrees with
the format dex, derived over all 500 moves rather than remembered, and it is exactly four —
`crabhammer 90→95`, `makeitrain 100→95` (2,443 clicks), `syrupbomb 85→90`,
`clangoroussoul 100→never-misses`. `data/move-effects.js` is generated from CHOMP's JSON and is not
ENGINE's to correct, so the deviation is carried at the engine with the dex's number beside it.
**The 35 hand-typed entries all AGREED with the dex** and are simply redundant now — the list was not
wrong, it was absent.

**AND THE CORRECTION LIST IS CHECKED, WHICH IS THE ONLY THING THAT MAKES IT DIFFERENT IN KIND FROM
THE LITERAL IT REPLACES.** `tests/test-engine-diff.js` gained an ACCURACY CONFORMANCE block that
re-derives every move's accuracy against the live format and exits 1 on a fifth row. It reads
**500 compared, 0 disagree, 0 unknown**. That harness compares DAMAGE and calls `dmgRange`, which
never rolls to hit — so it had been structurally blind to this for its whole life, and the new block
is the cheapest place to give it eyes.

### WIRE 125 — THE DEATH COUNTER FORGOT THE DEAD, ONE TURN AFTER THEY DIED

Found by converting `powerFromFallen`, whose old body contained its own confession:

```js
S.sfA.fainted = 3;      // the input, not the effect: three of ours are down
```

It wrote the counter by hand and asked whether `dmgRange` read it. Nothing had ever asked whether
anything **increments** it. The end-of-turn recount was
`[...act,...bench].filter(x=>x.fainted).length`, and `bringIn()` — the one path a replacement arrives
through — does `bench.splice(...)` then `act[i]=nx`. **The fainted body is in neither array
afterwards.** So the count was right for exactly the turn of the death and fell back to **zero** at
the end of the next one.

Last Respects (**19,299 uses**, a move whose entire identity is that it grows as your team dies) read
50 BP forever after the turn its ally fell. Supreme Overlord's `_fallenStuck` is stamped from the same
field, so every body entering later than the turn of a death carried an undercount — and the deeper
into a game, the more of the roster is dead and the wronger it got, which is precisely the phase both
mechanics exist for.

The roster was already on the side object (`battleInit` stamps `sf.team`). Still derived from the live
`fainted` flags every turn — no tally to drift — and a missing roster is **counted**
(`MEDFAILS.fallenNoRoster`, 0 over 40 random games), because a quiet fallback to the arrays that
caused this is indistinguishable from the bug.

### WIRE 126 — A COMMENT SAID THE -ATE ABILITIES WERE HONOURED. THE FUNCTION IT NAMED TAKES NO ATTACKER.

Found by converting `convertsMoveType`. The battle loop's type-immunity gate reads:

```js
/* effMoveType, not mv.t: the -ate abilities rewrite a Normal move to Flying or Fairy, and
 * a converted move DOES hit a Ghost. */
if (mcEff(effMoveType(mv, a.move.id, field), tg.types) === 0) continue;
```

`effMoveType(mv, moveId, field)` is handed **no attacker** and knew only about Weather Ball. The -ate
rewrite lived inside `dmgRange` and nowhere else. **This is WIRE 119's Taunt failure exactly — a
capability absent while a comment reports success — and it is the second time in three days this file
has been caught by one.**

Measured, both arms, before the fix: an Aerilate Staraptor's **Body Slam into a Ghost was priced by
`dmgRange` at 136–162 and dealt 0 by the battle loop.** Four more sites read the same helper and were
wrong the same way, so a Galvanized Body Slam was **not drawn by a Lightning Rod, not absorbed by Volt
Absorb, did not thaw, and did not make a Protean body Electric**.

One implementation now: `convertsMoveTypeTo()` owns the conversion, `effMoveType` calls it, and
`dmgRange` keeps only the POWER half (`damageMult`), which is a power question and belongs where the
power is.

**ONE CALL SITE DELIBERATELY STILL PASSES NO ATTACKER, AND IT IS DECLARED AT THE LINE.**
`clickFragility` is one of the six exports `board.js` reaches this engine through, so its output is a
**MAG feature input** — passing `att` would move the fitted vector and owe a refit, which is MEASURE's
expensive edge and not ENGINE's to spend. The consequence is stated rather than discovered: an -ate
body's click is priced against its RAW type there while the battle loop resolves it as the converted
one. **FILED below.**

### WHAT WAS CONVERTED, AND THE TWO THAT WERE NOT

28 of the ranked 47, which is the top 30 minus two, each judged rather than skipped:

- **`weatherSetter` "Drizzle sets rain on entry"** — the ranked list counts it because it spends no
  `battleTurn`, but the mechanic IS an entry effect and `battleInit` with entry effects on is the real
  path. WIRE 123's bug lived in that function and was caught by the three-armed probe beside it.
  Spending a turn adds nothing. **Armed instead** — it always computed a real control.
- **`multiAccuracy` "Triple Axel is priced below three full hits"** — an EXPECTED-HITS pricing
  question that `dmgRange` owns by design (WIRE 20's declared divergence: multi-hit damage is one
  packet). A real turn re-derives the same number through one more layer and asks nothing new.

**THE RATCHET IS THE DIRECT-CALL COUNT, NOT `unarmed`**, which is what #42/#45 asked for and the
reason is in the section below: `unarmed` falls as paperwork and says nothing about coverage.
Structurally — a probe body that mentions `battleTurn`, `battleInit`, `board(` or `turnDamage(`
against one that does not — the file now reads **182 spend a real turn or a real entry, 37 call the
mechanic directly**. It may fall and it may never rise.

Everything else in the top 30 now spends a real turn: the four accuracy probes, Intimidate through
**both** entry routes, Clear Body and Defiant through a real switch-in, Choice Scarf and Chlorophyll
as **turn ORDER** rather than a speed number, the mega stone through `battleInit` to the sun on the
field, and the whole damage family.

**FOUR PROBES WERE MADE STRICTER IN THE SAME PASS, BECAUSE THE CONVERSION EXPOSED THAT THEY HAD NO
CONTROL AT ALL:**

| probe | what it used to accept |
|---|---|
| `ignoresBoosts` Darkest Lariat | `a.max === b.max` — which is what an engine that ignores stat stages for EVERY move prints. Crunch is now the control and must fall |
| `needsUntrackedState` Gyro Ball | an Archaludon against a **Weavile** — different Attack, types and everything; "the numbers differ" was guaranteed. One body now, only Speed varied, and the DIRECTION asserted |
| `weightBased` Grass Knot | a Whimsicott against an **Archaludon**. One species now with `wt` overridden |
| `damageBoost` Aerilate | `b.max !== a.max`, which passes on an engine that made the move weaker |

### AND MY OWN PROBE WAS WRONG BEFORE THE ENGINE WAS. THAT MAKES THIRTY-THREE.

The `overridesEffectiveness` control arm was written *"Freeze-Dry must equal Ice Beam against a
non-Water body"*. **Freeze-Dry is 70 BP and Ice Beam is 90**, so the correct answer off a Water target
is that Freeze-Dry is LOWER, and the probe would have failed on a perfectly correct engine. The
comfortable shape was "a control arm should be a null result"; the honest one is the direction the
base powers dictate, and it separates the two hypotheses just as well.

### MAG'S INPUTS DID NOT MOVE — MEASURED, NOT ARGUED

`engine/feature_fixture.js --check`: **CLEAN — all 58 columns hash-identical to fit time.** None of
the three wires is on `board.js`'s six-export path: `moveAccuracy` is not one of them and is not
called by `clickFragility` or `punishExposure`; `fallenCount` is inside `battleTurn`; and
`effMoveType`'s one feature-path caller was deliberately left unchanged for that reason. What changed
is ROLLOUT behaviour, which is the point of an engine fix and does not owe a refit.

**`engine/position_features.js` IS A DIFFERENT MATTER AND IT IS OWED A LOOK.** Line 197 reads
`1 - (M.moveAccuracy(id, field) / 100)` as a `risk` feature, so **that column really did move for 78
moves** — it was constant-zero for all of them and is now the true miss chance. Features are per-model
(CLAUDE.md), so this is not MAG's vector and `feature_fixture` correctly reports clean; but any model
fitted on position features predates the correct number. **Routed to MEASURE, not decided here.**

### FILED, NOT FIXED

- ~~**`clickFragility` prices an -ate click against the raw move type.**~~ **CLOSED by ROADMAP #96
  WIRE 3, 2026-08-09.** `att` is now passed. The hold's reason stands and is recorded there — it
  moves `benchRisk` and owes MEASURE a refit at the next release cut — but it was half-effective at
  best: `base` in the same function already saw the converted type, so the function disagreed with
  itself. Carried by `probe_red_demo.js` (`ROADMAP #96 clickFragility prices the click as the type
  the SKY makes it`), not by this list.
- **`data/move-effects.js` disagrees with the format dex on four accuracies** (`crabhammer`,
  `makeitrain`, `syrupbomb`, `clangoroussoul`). It is generated by `build/build_browser_data.js` from
  CHOMP's `move-effects.json` — not ENGINE's file. The engine corrects them locally in `ACC_FIX`; the
  upstream artifact is still wrong and anything else reading it inherits that.
- **Found red, NOT mine.** `tests/test-no-silent-failure.js` reports **four NEW silent catch blocks in
  `build/strong_player_baseline.js`** (:300, :323, :425, :426). Not a file this pass touched. The two
  in `engine/dusk_size_gate.js` reported on 2026-08-06 are gone. Stated for the router to place, not
  filed as a status.

## WIRE 123 — ENTRY ABILITIES RESOLVED IN ARRAY ORDER, SO SIDE B'S LEAD OWNED THE SKY. 2026-08-06.

Census **216 → 217 live / 219 → 220 probed**; missing still 3 (the same three), hollow 0, `threw` 0,
`unarmed` still 145 — the new probe is armed. Differential unchanged at **1/150**, the same
pre-existing `chesnaught woodhammer -> mimikyu` row and the same 11 not-comparable.
`tests/test-game-diff.js` agrees on every turn of all five scripted games. The interaction matrix was
re-run at `--full` against the changed engine and is **unchanged**: 1,624/1,643 live pairs agree
(98.8%), the same six named disagreements, the same two `THREW`.

**The generated block at the top of this file is one census behind, because this pass was dispatched
under an explicit instruction not to run `engine/status.js --write` while two other agents held the
docs open. THE RESTAMP IS OWED**, and the artifacts already say the right thing.

Will, 2026-08-06: *"if two incins come out, which intim goes first indicates speed."*

### The claim is true of the real game, and the mechanic under it is one speed-sorted event

Read out of Showdown at the pinned commit `20ad99ff`, not remembered:

```
sim/battle-actions.ts:175  runSwitch(pokemon)  gathers every simultaneous switch-in off the queue
                     :184  this.battle.fieldEvent('SwitchIn', switchersIn)
sim/battle.ts:794          fieldEvent -> ... else { this.speedSort(handlers); }
sim/pokemon.ts             getActionSpeed()    Trick Room inverts it (10000 - speed)
```

Faster resolves FIRST. So the **LAST** entry weather setter to run owns the field, which means the
**SLOWER** one wins it — a real competitive fact and the sharpest possible test, because getting it
backwards multiplies every damage roll for the rest of the battle by the wrong number.

### MEASURED IN THE REFERENCE ENGINE, BOTH ARMS PRINTED, BEFORE A LINE OF ENGINE CHANGED

L50, Champions SP, `gen9championsvgc2026regmb` at the pinned commit:

| leads | reference | medicham2, before |
|---|---|---|
| Pelipper 117 Drizzle **v** Tyranitar 81 Sand Stream | **sand** | sand |
| Pelipper 85 Drizzle **v** Tyranitar 113 Sand Stream | **rain** | **sand** |
| Pelipper 117 + its ALLY Torkoal 40 Drought **v** Tyranitar 113 | **sun** | **sand** |

`battleInit` walked `A[0], A[1], B[0], B[1]` and applied every entry effect in that order, so **side
B's lead always won the weather**, whatever the speeds were. Three arms, one answer — *identical
results across a varied knob mean the knob is unwired*.

**THE THIRD ROW IS NOT DECORATION AND IT NEARLY WENT MISSING.** The sort is over ONE list containing
BOTH sides, so a slow ALLY resolves after the opposing lead. A per-side implementation ("all of A,
then all of B", or "A's lead against B's lead") passes the first two rows and fails the third, and it
is exactly the comfortable shape to reach for. It was measured before it was implemented.

### THE PROBE'S FIRST STAGING WAS WRONG BEFORE THE ENGINE WAS. THAT MAKES THIRTY-TWO.

The obvious pairing is Drizzle against Drought — Pelipper and Torkoal, the two the format actually
runs. In Champions a stat is base + SP + 20, so **Torkoal caps at 72 Speed and Pelipper floors at
85**: the two arms printed *the same faster body* and the reference gave sun in both. The knob did not
move, and on a FIXED engine that probe would have read as agreement. Pelipper (base 65) against
Tyranitar (base 61) overlaps, so the speed knob genuinely flips who is faster.

### One implementation of "who is faster", which is WIRE 118's whole point

`effSpeed` for the number and `compareTurnOrder` for the rule. **No second copy of the comparison is
written**, and the Trick Room inversion comes free from the comparator — which matters, because
Showdown's `getActionSpeed` inverts under Trick Room too and a hand-rolled `>` here would not have.

### MID-BATTLE SWITCHING WAS ALREADY RIGHT, AND THAT IS MEASURED RATHER THAN ASSUMED

Showdown queues **one `runSwitch` per switch action** (`insertChoice`, order 101 against `switch`'s
103), so a mid-turn double switch resolves entry abilities in the order the SWITCH ACTIONS ran — i.e.
by the **OUTGOING** body's speed, not the incoming one's. `bringIn` is called from inside those
already-sorted actions, so it agrees by construction. Four arms, and the knob was varied on both
sides of the question:

```
vary the OUTGOING speeds:  Corviknight 119 v Milotic 101 -> sand    Corviknight 87 v Milotic 133 -> rain
vary the INCOMING speeds:  Pelipper 117 v Tyranitar 81   -> sand    Pelipper 85  v Tyranitar 113 -> sand
```

medicham2 tracked the reference on all four. The incoming speed genuinely does nothing here, in BOTH
engines — so the fix is confined to `battleInit` and touches no switch path.

### WHERE THE INTIMIDATE SIGNAL ACTUALLY LIVES, because it decides where part 2 has to read from

**The order of two Intimidates is NOT observable in the board state.** Measured, both engines, both
arms, on Incineroar 112 v Arcanine-Hisui 110 and again on 80 v 142:

```
SHOWDOWN atk boosts [A0 A1 B0 B1] : [-1,-1,-1,-1]      MEDICHAM: [-1,-1,-1,-1]      both arms
```

Both drops land, on every body, whichever went first. The order is visible **only in the PROTOCOL
STREAM**, and there it is unambiguous:

```
Incineroar faster :  |-ability|p1a: Incineroar|Intimidate|boost   then  |-ability|p2a: Arcanine|Intimidate|boost
Arcanine   faster :  |-ability|p2a: Arcanine|Intimidate|boost     then  |-ability|p1a: Incineroar|Intimidate|boost
```

So **speed inference from duelling Intimidates must hook into the replay/live protocol parser, not
into any board or engine state.** medicham2 emits no protocol stream at all and is the wrong place to
read it from; `engine/durable-ingest.js` and the live client are where those lines exist. That is an
OPS-side channel, filed here because this pass is what established it.

**The weather case is the opposite and that is why it was worth the wire:** it IS in the board state,
it persists for the whole battle, and it was wrong.

### The probe, and the red is permanent

`ability weatherSetter — "the SLOWER entry weather setter owns the field, across both sides"`, armed,
three arms, the outcome (the weather standing on the field) rather than an order list. It reads the
reference's own numbers.

```
RED    Pelipper 117 v Tyranitar 81 -> sand;  85 v 113 -> sand;  + Torkoal 40 as A's ALLY -> sand
GREEN  Pelipper 117 v Tyranitar 81 -> sand;  85 v 113 -> rain;  + Torkoal 40 as A's ALLY -> sun
```

`tests/probe_red_demo.js` gained a `demoSource` arm whose known-bad engine is **the comparator and
nothing else** — `entrants.sort(compareTurnOrder…)` becomes `entrants.sort(()=>0)`, leaving the
entrants list, the interleaving and the tie counter exactly as shipped, so the one thing that flips is
the ordering rule. **35 demonstrations, 0 failed**; `shipped-arm=true, reverted-arm=false`.

### A SPEED TIE IS AN APPROXIMATION, SO IT IS COUNTED

Showdown breaks a tie with a coin (`speedSort`'s Fisher-Yates). `battleInit` is handed no rng and
inventing one would move every seeded run in the repo for a reason that has nothing to do with entry
abilities, so it keeps declaration order — and **`MEDFAILS.entryOrderTie` counts every time it has
to**. Measured over 2,000 random battle starts: **155 ties, 0.077 per start**. That is not zero, and
for two Drizzle bodies on the same Speed it is the weather.

### MAG's inputs did not move

`engine/feature_fixture.js --check`, read through `engine/status.js`: **CLEAN — all 58 columns
hash-identical to fit time**, with `engine/medicham2-browser.js moved 2026-08-06 06:45, and no feature
the fixture exercises moved with it`. The changed site is inside `battleInit`, which `board.js`'s
feature path does not call; what changed is ROLLOUT behaviour, which is the point of an engine fix and
does not owe a refit.

### Found red, NOT mine, reported rather than filed

`tests/test-no-silent-failure.js` exits 1 on **two NEW silent catch blocks in
`engine/dusk_size_gate.js:50` and `:212`**. Not this pass's file and not this pass's doing — the three
files edited here (`medicham2-browser.js`, `tests/test-mechanics.js`, `tests/probe_red_demo.js`) added
**zero** catch blocks between them. It is stated here for the router to place, not filed as a status.
The related `provenance` ratchet trip on `dusk-size-gate.json` is the same file.

## "UNARMED" IS MEASURING A CONVENTION THAT IS TWO DAYS OLD. MEASURED 2026-08-06.

**Will set the bar (2026-08-06):** *"i still want medicham to be fully wired and tested on every move
and ability and item in the regulation (with any usage at all) before we start taking its output and
using them."* Sizing that job produced a number that looked catastrophic, and the number is measuring
the wrong thing.

### The denominator Will asked for, which nobody had computed

Derived over 53,796 games / 117,588 sheet entries, counting both DECLARED sheet entries and moves
actually CLICKED in the turn stream. **819 distinct things carry real usage in this regulation.**

| | any usage | has a tag | every tag probed | every probe ARMED |
|---|---|---|---|---|
| moves | 491 | 99.2% | 93.3% | **9 (1.8%)** |
| abilities | 185 | 100.0% | 95.1% | **61 (33.0%)** |
| items | 143 | 98.6% | 89.5% | **7 (4.9%)** |

Usage-weighted armed: moves **0.8%**, abilities **3.7%**, items **2.2%**. Tagging is done, probing is
good, and the collapse is at arming — and it is the TOP of the distribution that is missing, not the
tail: `protect` 198,900 uses, `fakeout` 43,495, `intimidate` 10,754, `armortail` 3,403 (rank **8** of
185 — Smogon's 1630-cutoff file has Farigiraf running it **99.06%** of the time), `focussash` 15,037.

**This is also why "216/219 mechanics live" is the wrong number.** It counts probes that EXECUTED.
Will's question counts things people CLICK, and there are 819 of those.

### But `armed` is a declaration, not a capability — and here is the count

`armed` is set by `tests/test-mechanics.js` when a probe **returns `arms: {control, test}`**. The arms
protocol was added **2026-08-04, two days before this measurement**, so almost every probe predates
it. `armed: false` therefore means *"written before the convention"* at least as often as it means
*"weak"*.

The Choice Scarf probe is the proof. It is counted unarmed, and it builds **two** Basculegion, gives
one the item, and asserts `sb > sa * 1.4`. Delete Choice Scarf from the engine and `sb === sa`, the
assertion is false, **the probe goes red.** It has a control. It just does not declare it in the
machine-readable shape.

Classifying all **142** unarmed-and-live probes structurally:

| | count | what it means |
|---|---|---|
| spends a REAL TURN (`battleTurn`) | **93** | tests the **wiring** |
| calls the mechanic **directly** | **47** | tests the **function** only |
| has a control variant anyway | **111** | 78% — the flag is measuring declaration |

### The better diagnostic, and tonight's bug proves it

**A probe that calls the mechanic directly cannot catch a wiring bug.** WIRE 123 above is exactly
that bug: `applyIntimidate` and every entry-drop handler were CORRECT, and the ORDER they were called
in was not — so side B's lead owned the weather and every subsequent damage roll carried the wrong
multiplier.

And the Intimidate probe is on the direct-call list:

```js
probe('ability', 'onSwitchInDrop', 'Intimidate drops Attack', () => {
  const foe = bare('garchomp');
  const before = foe.boosts.at;
  M.applyIntimidate(foe);                       // <- called DIRECTLY, never through a switch-in
  return { works: foe.boosts.at < before, detail: `atk ${before} -> ${foe.boosts.at}` };
});
```

**It would not have caught WIRE 123**, and it is `live`, and it is about the single most-used ability
in the format. That is the class worth fixing, and it is **47**, not 482.

### What this changes about the work

- The job is **not** "write hundreds of tests". For 111 of 142 it is declaring a control the probe
  already computes — mechanical.
- The real work is the **47 direct-call probes**, converted to spend a real turn. That is the class
  that catches wiring, and wiring is where this engine's expensive bugs have actually been.
- **Ratchet on the direct-call count, not on `unarmed`.** `unarmed` will fall as a paperwork exercise
  and will not tell you whether coverage improved. Filed as #42 / #45.
- The cutoff for Will's gate is a **99%-of-usage coverage target** (moves 267, abilities 117, items
  100 — 484 of 819) rather than a per-entity threshold: a threshold is a list and goes stale when the
  meta moves, a coverage target is a mechanism and re-derives itself. **Plus a carve-out** for
  anything that turns a certainty into a failure regardless of usage — Queenly Majesty is 0.361%,
  rank 50, and it blocked a Sucker Punch in a real game on 2026-08-06.

## WIRES 119–122 — TAUNT DID NOT EXIST, AND THE #1 ROW BY VOLUME WAS NOT A HARNESS FAULT. 2026-08-06.

Census **211 → 216 live / 214 → 219 probed**; missing still 3 (the same three), hollow 0, `threw` 0,
`unarmed` still 145 — all five new probes are armed. Differential unchanged at **1/150**, the same
pre-existing `chesnaught woodhammer -> mimikyu` row and the same 11 not-comparable.
`tests/test-game-diff.js` agrees on every turn of all five scripted games.

**The interaction matrix, before and after, at `--full` against the pinned commit `20ad99ff`:**

| | before | after |
|---|---|---|
| live cases | 1,634 | 1,643 — nine cases became judgeable because a fix stopped the harness reading them as inert |
| live disagreements | 20 | **19** |
| off-gate disagreements (real, but in a bucket the gate discards) | 74 | **53** |
| **TOTAL KNOWN DISAGREEMENTS** | **94** | **72** |

Every expected value below was played at the pinned commit FIRST, both arms printed, before a line of
engine changed. Every probe was shown RED on a known-bad engine — `tests/probe_red_demo.js`, now 34
demonstrations, 0 failed.

### WIRE 119 — `forbidsStatusMoves`. TAUNT, 1,503 CLICKS, AND THE ENGINE DID NOT IMPLEMENT IT.

Will: *"Start with TAUNT — it is the biggest and it is the Incineroar mirror."* He is right, and the
state of it was worse than "partial": the volatile was written onto the target by the generic
`statusInflict` applier, decremented in the chooser, and **read by nothing**. A Taunted body still
landed Hypnosis, Stun Spore, Decorate, Screech, Disable, Feather Dance, Strength Sap, Trick-or-Treat
and another Taunt — twelve separate `X -> taunt` rows on the matrix.

**AND THE FILE SAID THE OPPOSITE IN WORDS.** The comment at `chooseAction` read *"Taunt forbids status
moves, so the mon falls through to the normal chooser with its status options removed"*, sitting
directly above a line that only did `me._vol.taunt--`. That is this repository's signature failure —
a capability that is absent while everything reports success — arriving through a comment.

**Showdown answers Taunt in TWO handlers off ONE condition, and both are wired:**

| | Showdown | where it lives here |
|---|---|---|
| **SELECTION** | `onDisableMove` — every Status move on the request is `disabled: true` | `illegalMoveNow`, hoisted to module scope so the **priors sampler** asks the identical question |
| **EXECUTION** | `onBeforeMove` — a status move already chosen FAILS when it runs | one gate **above the kind dispatch**, WIRE 77's place for WIRE 77's reason |

**THE EXECUTION GATE IS WIRE 77's PLACE BECAUSE TAUNT REFUSES A STATUS MOVE OF ANY KIND.** `affect`,
`status`, `setup`, `tail`, `haze`, `hazard`, `sub` and `phaze` are all status moves and all separate
branches; a copy per branch is exactly what let Roar through the Throat Chop silence. Protect and Wide
Guard are pre-resolved above the loop and are gated there instead — correctly, because Protect is +4
and Taunt is +0, so a Taunt landing *this* turn does not stop a shield that has already gone up.

**DERIVED FROM THE TAG, NOT BY NAMING TAUNT.** The table is `volatile -> the CATEGORY that volatile
refuses`, built from `forbidsStatusMoves.forbids` plus the same move's `statusInflict` volatile.
Membership was printed before it was trusted and is exactly one entry:
`taunt -> forbids "Status" via volatile taunt, turns 3`. **And the category predicate was checked
against the format dex before being trusted**: over every move in `data/tags.json`, `statusCategory`
agrees with Showdown's own `move.category === 'Status'` on all of them — zero tagged-and-not-Status,
zero Status-and-not-tagged. A category the artifact names and this engine cannot decide is COUNTED
(`fails.forbidCategoryUnknown`), never silently allowed.

**THREE THINGS IT HAD TO NOT GET WRONG:**

- **THE TICK MOVED TO END OF TURN**, beside Disable's, for Disable's own written reason: a duration
  that only counts down on turns the engine happens to be CHOOSING lasts forever in a rollout driven
  from outside (the WIRE 24 rule).
- **TAUNT LASTS THREE OF THE TARGET'S TURNS, NOT THREE TURNS.** Showdown's condition bumps its own
  duration when the target has already moved (`target.activeTurns && !this.queue.willMove(target)`).
  Measured both ways at the pinned commit: a **faster** taunter blocks turns 1(exec), 2, 3; a
  **slower** one blocks 2, 3, 4 — three refusals either way. Without the bump the slow case gets two.
  WIRE 118's `unresolved` set answers Showdown's exact pair of clauses, including the `activeTurns`
  half: a body dragged in mid-turn is in neither set and is correctly not bumped. medicham2 now
  reproduces both rows.
- **`_lastMove` IS DELIBERATELY NOT SET**, unlike WIRE 77 one line above. `runMove` calls
  `pokemon.moveUsed()` — the only writer of `lastMove` — AFTER the BeforeMove event, so a move
  refused by Taunt cannot become what an Encore repeats.

**AND THE PROBE THAT ALREADY EXISTED WAS THE PROBLEM, NOT THE ENGINE'S ONLY ONE.** `forbidsStatusMoves`
was in the census as LIVE and **UNARMED**: it checked that a Taunted body's free pick was not a status
move, with **no control arm** showing an untaunted one would have picked one. It passed for the whole
history of the engine not implementing Taunt. Two armed probes replace what it could not ask:

```
execution  foe attacked   -> foe ends up Taunted true      (reference: true)
           foe Taunted first -> foe ends up Taunted false   (reference: false)
selection  status clicks in 40 seeded draws: untaunted 16, Taunted 0
```

**A SIDE FINDING, FILED NOT FIXED.** The selection probe's first run leaked 5 Tailwinds through the
gate, and the cause is not Taunt: the priors label is a coarse INTENT and `pick.kind==='speed'`
converts *whatever move carried it* into `{kind:'tail'}` — **Milotic's priors label ICY WIND as
`speed`**, so a sampled Icy Wind came out of the chooser as a Tailwind. The gate now asks about the
action the branch PRODUCES rather than the move that was sampled, which is correct for Taunt (Icy
Wind is Special and stays legal). That the mapping fabricates a Tailwind at all is a separate
pre-existing defect in `MC.priors` handling.

### WIRE 120 — `partingshot -> throatchop` IS THE #1 ROW BY PAIR VOLUME AND IT IS **NOT** A HARNESS FAULT

The dispatch flagged it as smelling like a staging fault, on the strength of a `species` mismatch in
slot 0, and said to check before touching the engine. **Checked, and it is the engine.**

`kind:'switch'` serves two completely different actions and both were given priority **+6**: a BARE
switch, which really is a separate phase that happens first, and a **pivot MOVE** (`a.mv` present —
Parting Shot at **7,475 clicks**, Chilly Reception at 27), which is an ordinary status move. So
Parting Shot was the fastest action in the game. It dodged every hit aimed at its user, it out-sped
the Taunt and the Throat Chop that exist to stop it, and **the replacement, not the pivot user, ate
the attack.**

```
reference, 20ad99ff:  |move|p2a: Milotic|Scald  ->  |-damage|p1a: Incineroar|54/170  ->  |move|p1a: Incineroar|Parting Shot
                      identical damage against a Knock Off control — the pivot changes nothing about when the user is hit
medicham2, before:    pivot user took 0, its replacement took 54
medicham2, after:     pivot user took 115, its replacement took 0
```

Every `partingshot -> *` row left the matrix.

### WIRE 121 — `voltswitch -> lightningrod`, THE LARGEST REMAINING ROW (1,459 x 2,108)

Showdown fires `selfSwitch` only when `moveHit` did not fail, so a Volt Switch into **Lightning Rod,
Volt Absorb or Motor Drive** leaves its user standing. medicham2 pivoted anyway, which turns the three
abilities built to punish an Electric click into a free escape.

```
reference, all three arms:  Lightning Rod -> p1 slot0 = pikachu    Volt Absorb -> pikachu
                            Marvel Scale control -> garchomp        (the arms genuinely differ)
```

The gate is `dealt > 0`, the same one WIRE 46 puts on `userFaints`, and it is an **approximation
stated rather than discovered**: it would also refuse a pivot on a hit that legitimately deals zero,
of which this format's `pivotDamaging` set has no member. It also removed the `flipturn ->
spikyshield / banefulbunker / kingsshield` rows, because a blocked Flip Turn deals nothing either.

### WIRE 122 — Good as Gold refuses Yawn, and the Yawn branch was the one route that never asked

`refusesStatusMoves` is checked in **nine** places in this file. The `yawn` branch was the tenth site
and had no check, so Gholdengo (2,461 sheets) took a drowse it is immune to. Reference, both arms on
the SAME body so the body is not the variable: Good as Gold `vol=[]`, Honey Gather control
`vol=[yawn]`.

**A TENTH HAND-WRITTEN COPY IS EXACTLY WHAT CLAUDE.md's FACTS-ARE-GLOBAL RULE FORBIDS, and it is
written anyway — with the reason.** Each of the nine sits beside a *different* set of companion gates
(`bounceOff`, `moveClassBlocked`, `powderBlocked`, `pranksterBlocked`), so collapsing them is a
consolidation this pass is not scoped to make. **FILED: `refusesStatusMoves` wants one predicate and
has ten call sites.**

### THE ROWS THAT ARE GENUINELY HARNESS, NAMED

- **`taunt -> taunt`** — the generator picks `usersOf('taunt')[0]` for BOTH the carrier user and the
  reactor holder, so it is **Alakazam against Alakazam**: a pure speed tie, and the two engines flip
  their own coins. Still off-gate; not an engine fault.
- **`yawn -> insomnia`** — already filed as harness by the dispatch and confirmed: the two engines
  have different bodies in slot 0, so the comparison means nothing.
- **`voltswitch -> lightningrod` STAGED TWICE** — the dispatch's generator fault is real and is
  **still there**: the same (key, carrier, reactor) triple appears twice under `moveType:Electric`.
  The row is now fixed so it no longer disagrees, but the duplicate staging is untouched and remains
  open in `tests/interaction_matrix.js`.

### MAG'S INPUTS DID NOT MOVE, AND THAT IS MEASURED RATHER THAN ARGUED

Every site these four wires touch is inside `battleTurn`, `chooseAction` or `actionPriority`. Counters
were wrapped around every relevant engine export and the fit's OWN decision walk was run —
`fit_policy.decisionsFor` into `board.featuresFor`, **57,275 candidate vectors over 300 clean games**:

```
battleTurn 0    actionPriority 0    playerAction 0    sortTurnOrder 0    turnOrderKey 0
compareTurnOrder 37,084   priorityRefusedAbove 5,555   dmgRange 262,737   buildMon 265,221
```

The feature path calls **none** of the changed functions. `compareTurnOrder` is the one turn-order
function it does call and it is byte-identical. `board.js` reaches this engine through exactly six
exports (`buildMon`, `dmgRange`, `clickFragility`, `punishExposure`, `priorityRefusedAbove`,
`compareTurnOrder`) and not one of them was edited.

**`engine/feature_engine_contrast.js` WAS NOT RUN, AND THAT IS A DELIBERATE CALL RATHER THAN A SKIP.**
It contrasts LIVE against a FROZEN RELEASE, and every frozen release predates WIRE 118 — so it
already reports `MOVED (deadNoLastMove, movesFirst, diesBeforeMoving)` for a documented reason that
has nothing to do with this pass. Quoting it here would be a null from an instrument that cannot
isolate the question. The counter walk above can, and does.

**WHAT DID CHANGE IS ROLLOUT BEHAVIOUR.** `rollout_leaf.js` calls `battleTurn`, so MILTANK's rollouts
now play Taunt, Parting Shot and Volt Switch correctly. That is the point of an engine fix; it is not
a feature-vector move and it does not owe a refit.

## THE 97 DEFECT CANDIDATES WERE TRIAGED. NOUGHT OF THEM IS A DEFECT. 2026-08-06.

The sweep below reported **97 DEFECT-CANDIDATE** operators and they were handed on as 97 bugs. Will
asked what the top two actually were. **Both are false positives**, and neither is a close call:

| row | what the source does |
|---|---|
| `damageMultAll / lifeorb` — 10,791 uses, the **highest row in the list** | the DAMAGE half is read straight off the tag at `medicham2:1216`. Only the **recoil** branches on `m.item==='lifeorb'`, so mutating `costsPerAttack` cannot move behaviour. A *derive, never name* violation that is **LATENT** — Life Orb is the only carrier of `costsPerAttack` today — not a live defect |
| `halvesDamage / lightscreen` — 3,404 uses | **NOT A DEFECT AT ALL, and the engine is deliberately right.** `medicham2:2924` keeps separate P/S counters and honours the category the tag declares. It ignores the tag's `mult` **on purpose**: the tag carries the SINGLES 0.5 and this is a doubles engine where the reduction is 2732/4096. Using 0.5 would overvalue every screen click by a third |

The harness's header has said since it was written that *"READ-AND-IGNORED IS NOT THE SAME THING AS A
DEFECT, AND THE RULE THAT SEPARATES THEM IS WRITTEN DOWN RATHER THAN APPLIED BY FEEL"*. The rule it
had could not see a **DELIBERATE OVERRIDE**. That was the gap.

### The classification, and it is a PARSE of the source — never a comment

A comment is prose and this repo has been burned by trusting prose, so nothing here is graded on one.
The classifier parses every `TAGS.param / has / withTag / reactorsTo` call in the frozen engine with a
balanced-paren argument scan (a loose regex over a 220-char window conflates the tag argument with its
neighbours, and the B/C split turns on which argument a literal sits in), then asks two questions:
**is this param dereferenced off the variable the lookup was bound to**, and **does the carrier's id
drive a branch by name**.

| | | of the 97 | of all 340 open |
|---|---|---|---|
| **A** | **TAG NEVER READ.** No lookup names the tag (or none for this carrier's KIND), and the id drives no branch either. **Nothing in the simulator implements this fact.** The real-defect class | **0** | **163** ops, 56 rows |
| **B** | **PARAM OVERRIDDEN.** The tag IS read; the param is dereferenced nowhere. The engine consumes membership and substitutes its own value. Not a defect — the site is printed so a human can check the substitution | 40 | 73 |
| **C** | **HARDCODED BY NAME.** As B, and the id drives a branch. **LATENT**: correct while the simulator names the only carrier, wrong the moment a second arrives — so the tag's carrier count is printed as the risk | 5 | 52 |
| **D** | **BATTERY GAP.** The param IS dereferenced in the source, so the fact is consumed and this battery could not move it (an unreached branch, or an equivalent/saturated mutant). The same kind of answer as UNREACHED-BY-THIS-BATTERY | 52 | 52 |

**Nought of the 97 is a defect.** Every class A operator came out of the NO-CONSUMER-IN-SOURCE bucket
instead — which is where Taunt has been sitting.

### The triage is a check, so it is gated like one

Three cases were decided BY HAND, by reading the engine, before the rule existed. The sweep refuses to
run and writes no artifact unless the rule reproduces all three, and `tests/test-mutation-coverage.js`
asserts the artifact on disk was produced by a rule that could:

```
MATCH   forbidsStatusMoves / taunt          expected A, got A
MATCH   halvesDamage / lightscreen          expected B, got B
MATCH   damageMultAll / lifeorb             expected C, got C
```

### THREE FALSE MATCHES WERE IN THE RULE BEFORE THE ENGINE WAS, AND ALL THREE HID A DEFECT

Every one demotes a row OUT of the defect class, which is the dangerous direction, and every one was
found by printing what the rule matched before trusting it (LESSONS §4):

- **Comments quote code.** `'encore'` appears at 2478 inside *``kept reading `vol medi=["encore"]` ``*
  and `'trickroom'` at 2296 inside a sentence about actions. Both read as the engine branching on that
  name. Comments are stripped before any name is looked for.
- **`{kind:'protect'}` writes an ACTION KIND** and decides nothing about the move. Only an equality, a
  `.has/.includes/.indexOf`, or membership of a name set counts; anything else is recorded as `other`.
- **`SPREAD_LEGACY` at line 166 is LIVE CODE** (line 169 uses it as the spread fallback) and it holds
  `'blizzard'`, `'rockslide'` and `'heatwave'`. A plain "is the name in a set" test moved
  `blizzard / inflictsFreeze`, `rockslide / flinches` and `heatwave / inflictsBurn` out of the defect
  class on the strength of a set about something else entirely. **A name-set match now requires half
  the set's members to carry the tag** — POWDER scores **0.88** against `powder` and counts,
  SPREAD_LEGACY scores **0.03** against `flinches` and does not. Derived from the artifact, not from an
  opinion about which set is which.

A fourth was the opposite error and was fixed in the same pass: requiring an ID-SHAPED left side on an
equality rejected `_e.volatile==='encore'`, which is exactly how Encore is implemented, and put a
4,695-use row in the defect class on a technicality. This engine names its actions and volatiles after
their moves, so an equality counts whatever is on the left of it.

### The ratchet is class A only

`defectCandidates + tagNotConsumed + noConsumerInSource` = 340 is retired as a ceiling. **A number
that counts false positives is a number people learn to ignore.** The ceiling is 163 and carries its
own scope, which hashes **the text of the classifier** — for exactly the reason the battery scope
hashes the script text, and it earned that: the rule was tightened three times during calibration and
each tightening moved class A (139 → 167 → 163). The per-operator ratchet keeps the BATTERY scope
alone, because its verdicts are LIVE / READ-AND-IGNORED and are untouched by how they are classified.

### CLASS A IS NOT "163 MISSING MECHANICS" AND THE ARTIFACT SAYS SO

It means the fact reaches the simulator **neither as a tag nor through the carrier's name**. A THIRD
route can still carry it — `mv.rc` for recoil, `data/move-effects.js` for every secondary, an action
`{kind:'weather'}` — and this instrument cannot see any of those. The census can, and it is the second
sort key: **49 of the 56 rows have no ARMED census probe**, and that is the number that is a defect
claim. The top of the fix order, ranked by what the census can prove and then by usage:

```
   uses   share   cum   carrier / tag                          census
  11895   2.78%   2.8%  move:rockslide / flinches              UNARMED-LIVE
   7297   1.70%   4.5%  move:partingshot / lowersTarget        UNARMED-LIVE
   7162   1.67%   6.1%  move:heatwave / inflictsBurn           UNARMED-LIVE
   7109   1.66%   7.8%  move:moonblast / secondaryStatEffect   UNARMED-LIVE
   6660   1.55%   9.4%  move:flareblitz / inflictsBurn         UNARMED-LIVE
   6660   1.55%   9.4%  move:flareblitz / recoil               UNARMED-LIVE
   6180   1.44%  10.8%  move:wavecrash / recoil                UNARMED-LIVE
   5504   1.28%  12.1%  move:shadowball / secondaryStatEffect  UNARMED-LIVE
   5491   1.28%  13.4%  move:kowtowcleave / neverMissesAttack  UNARMED-LIVE
   4774   1.11%  14.5%  move:lastrespects / needsUntrackedState UNARMED-LIVE
   6802   1.59%  24.9%  move:suckerpunch / needsTargetToAttack  NO-LIVE-PROBE
    690   0.64%   0.6%  item:widelens / accuracyMod             NO-LIVE-PROBE
```

Share is **within the carrier KIND** — a move's uses is a click count and an item's is a sheet count,
and adding them would be the Blaze error with an extra step — so the item rows carry their own
cumulative column. **Two of the three mechanics the census itself lists as MISSING land in class A** —
`needsTargetToAttack` (4 operators) and `accuracyMod` (8) — which is the closest thing this pass has to
a positive control: the classifier found them by a route that knows nothing about the census. **The
third does not, and the reason is stated rather than rounded off**: `writesAccuracy` emits **no
operators at all** — it is UNSTAGEABLE in this battery, so it is absent from the letters rather than
graded by them. A claim of "all three" was written here first and was wrong; the artifact says
otherwise and the artifact wins.

**AND THE LIST IS ALREADY ONE ROW OUT OF DATE, WHICH IS THE MECHANISM WORKING RATHER THAN FAILING.**
`move:taunt / forbidsStatusMoves` is class A against release `032b4a2979dd` and sorts **last** in the
fix order, because the census — read from the LIVE tree — now grades it **ARMED-LIVE**: a second ENGINE
agent landed the Taunt wire while this swept. Against the frozen bytes the verdict is still true, and
the census column is a POINTER for ordering work and never evidence about those bytes; the artifact
says so in `triage.census.note`. Class A will fall at the next release cut, and it will fall because a
mechanic landed rather than because a rule was loosened.

Sweep: 182 tags, 785 operators, 58s, peak RSS 413 MB, frozen release **`032b4a2979dd`**. **No engine
file was edited by this pass**, and none was read for behaviour — a second ENGINE agent held
`medicham2-browser.js` open for the Taunt work while it ran.

## COVERAGE LAYER 2 SWEPT ALL 182 TAGS, AND 52 OF THEM THE SIMULATOR NEVER LOOKS UP. 2026-08-05.

**Superseded in part, 2026-08-06** — see the section above. This pass's `open defects: 340` counted
false positives and is retired as a number; its 206 / 37 / 97 split is still what the MUTATION found
and is unchanged. What changed is what the split MEANS.


Will: *"i bet there are 100s like taunt just sitting there man"* … *"okay fix it."* He is right. The
count is **206 operators**, and the shape of them is worse than the number.

`tests/mutation_harness.js` + `data/mutation-coverage.json`, measured against frozen release
**`032b4a2979dd`** and stamped with it, because a second ENGINE agent was rewriting
`medicham2-browser.js` for dynamic speed while this ran. **No engine file was edited by this pass.**

| | before (12 tags) | now (all 182) |
|---|---|---|
| tags swept | 12 of 182 | **182 of 182** — derived from the release's own `data/tags.json`, never typed |
| operators | 93 | **785** — 322 LIVE, 463 READ-AND-IGNORED |
| open defects | `defectCandidates: 45`, which counted **no tag-level finding at all** | **340** — 206 NO-CONSUMER-IN-SOURCE + 37 TAG-NOT-CONSUMED + 97 DEFECT-CANDIDATE |
| `unstageableTags` | `[]`, for 12 tags | 25 UNSTAGEABLE + 5 NO-CARRIER + 32 UNREACHED-BY-THIS-BATTERY, each named |
| `streamShiftSuspect` | 2, unexplained | 3, **explained below** |

### THE FINDING: `data/tags.json` IS NOT THE SIMULATOR'S SOURCE OF TRUTH FOR 52 TAGS

A source grep of every `TAGS.param / has / withTag / reactorsTo` call in the frozen
`medicham2-browser.js` finds **131 distinct tag names. The artifact has 182.** The 52 that appear in
no lookup are printed on every run. Cross-referenced against `data/mechanics-census.json`'s own
`armed` field — the one thing that separates a probe which PROVES a mechanic from one that asserts it
in a prose string — they split three ways, and the split is the fix order:

| census says | tags | what it means |
|---|---|---|
| **UNARMED-LIVE** | **27** | a probe ASSERTS the mechanic, the simulator does not read the tag, **and nobody has proven anything.** `forbidsStatusMoves` — Taunt, 1,438 uses — is in this bucket, and today's interaction matrix found a Taunted body still lands Hypnosis. This bucket is where the bodies are |
| **NO-LIVE-PROBE** | 20 | no live probe AND no lookup. Nothing anywhere demonstrates the fact. Led by `needsTargetToAttack` (Sucker Punch, 6,802), `accuracyMod` and `writesAccuracy` — all three already in the census's MISSING list — then `substitute` (567), `ohko`, `setsRoom`, `passesState` |
| **ARMED-LIVE** | 5 | a probe PROVES the mechanic and the fact is carried elsewhere. `doublesSideSpeed`, `lowersUser`, `statusCategory`, `statusImmune`, `untagged`. A second, unread copy — the FACTS-ARE-GLOBAL risk — not a missing mechanic, and ranked last |

**THE INSTRUMENT DOES NOT CLAIM 206 MISSING MECHANICS AND MUST NOT BE READ AS IF IT DID.** Recoil
comes off `mv.rc` in the move table, flinch and every secondary off `data/move-effects.js`, Protect
off a `PROTECTMOVES` name set, Tailwind off `{kind:'tail'}`, powder off a hard-coded eight-name
`POWDER` set. Those work. What NO-CONSUMER-IN-SOURCE says is that the fact has a second copy the
simulator does not read — which is how `data/tags.json` and the engine drift apart without either
failing, and it is why a new powder move next regulation arrives in the artifact and not in the set.

### The top 20 by usage, and what fraction they carry

The 20 rows are 16 distinct moves carrying **180,189 clicks — 42.0% of all move clicks in the
corpus.** Every one is NO-CONSUMER-IN-SOURCE with an UNARMED census probe:

```
 uses   share  carrier / tag                              uses   share  carrier / tag
71951  16.79%  protect / neverMisses                      7109   1.66%  moonblast / secondaryStatEffect
71951  16.79%  protect / priority                         6660   1.55%  flareblitz / inflictsBurn
71951  16.79%  protect / stalling                         6660   1.55%  flareblitz / recoil
12872   3.00%  fakeout / flinches                         6192   1.44%  ragepowder / powder
12872   3.00%  fakeout / priority                         6180   1.44%  wavecrash / recoil
11895   2.78%  rockslide / flinches                       5504   1.28%  shadowball / secondaryStatEffect
11581   2.70%  tailwind / neverMisses                     5491   1.28%  kowtowcleave / neverMissesAttack
 7297   1.70%  partingshot / lowersTarget                 4774   1.11%  lastrespects / needsUntrackedState
 7195   1.68%  trickroom / reversesSpeed                  4695   1.10%  encore / locksTarget
 7162   1.67%  heatwave / inflictsBurn                    3631   0.85%  sludgebomb / inflictsPoison
```

Share is **within the carrier KIND**. A move's `uses` is a click count and an ability's is a sheet
count; adding them and calling the result a share is the Blaze error with an extra step.

### WHAT WAS TRIAGED OUT, each by a rule that is written down and prints what it matched

`readAndIgnored` is 463 and OPEN is 340. The 123 that came off did so under one of these, in order,
and the membership of every one is in the artifact:

| rule | n | decided from |
|---|---|---|
| **UNREACHED-BY-THIS-BATTERY** | 32 | the simulator DOES look the tag up and no scripted turn reached the branch. **Not a defect — this battery's own gap** |
| PRESENCE-ONLY | 61 | a boolean on a tag whose removal is LIVE; membership already carries the bit |
| RESTATES-THE-TAG | 13 | a STRING param identical on every carrier (≥2). `spreadFoes.target` is `allAdjacentFoes` on all of them: the tag IS the selector |
| NO-LEGAL-CARRIER | 11 | an ability no species with `isNonstandard: null` in the format has — derived, not remembered |
| ZERO-USE-IN-CORPUS | 6 | 0 uses across every ingested sheet |
| BANNED-BY-FORMAT | 0 | `isNonstandard != null`, asked of the format. Zero, and that is a result: `tag_dex` is not emitting banned carriers |
| null params | 41 | a null param is not a fact; writing a sentinel asks the consumer to honour something the artifact never asserted |
| nested params | 21 | objects and arrays-of-objects are not perturbed, counted rather than silent |

**The format id is read out of the release's own `data/regulations.json`.** Not typed —
`engine/conformance.js` S12 caught the literal on the first run of this file, which is the guard
working.

### FOUR THINGS WERE WRONG IN THIS FILE BEFORE THE ENGINE WAS. THAT MAKES THIRTY-ONE.

Every one produced a comfortable answer, and three of the four were found by looking at a number that
was too clean:

- **The harness did not run at all.** The half-finished pairing refactor left `TEAM_A`/`TEAM_B`
  undefined, so every staging threw, both arms read the same exception text, they compared EQUAL, and
  every tag scored UNSTAGEABLE. The planted-stub gate caught it — which is what it is for — and
  `allThrew` is now a per-case field so a staging failure can never again be read as inertness.
- **`speedMult` and `stabBoost` read READ-AND-IGNORED on an engine that reads both.** The only
  pairing had an 80-Speed body opposite a 161, so a x1.5 overtakes nothing and turn order — a speed
  multiplier's only observable — never moves. There is no name-based Choice Scarf fallback anywhere
  in the engine; grep it. Pairing 2 puts every active body inside one multiplier of the body opposite
  it, stated as a property of a battery rather than as a fix for one item.
- **The battery was too SHORT to see the tag this whole file was built around.** `extendsDuration`
  turns 5 into 8, and a five-turn trace ends with the screen still up in BOTH arms — so Light Clay
  and Damp Rock reported 7 defect candidates on an engine that reads them perfectly. At ten turns the
  screen (T1) and the weather (T2) both expire inside the trace and the tag comes back **10 LIVE**.
  The weather was also being set on T1 by the script, which overwrote every entry `weatherSetter`
  before it could be observed — that tag went from UNSTAGEABLE to **4/4 LIVE** by moving one click.
- **`asked = 0` IS NOT DECISIVE HERE, AND A CLASS CALLED `NO-CONSUMER-ANYWHERE` NEARLY SHIPPED SAYING
  IT WAS.** `engine/tags.js`'s header calls ASKED = 0 decisive, and it is — for a battery of real
  games. The receipt that it is false for a ten-turn script: **`survivesFromFull` came back asked=0**,
  and its consumer is `medicham2-browser.js:3508`, WIRE 12, **Focus Sash, 13,125 uses**, which was
  sitting fifth in the ranked defect list. It reads zero because that branch only runs when a lethal
  hit lands on a full-HP body and no scripted turn does that. The decision moved to a SOURCE GREP,
  which cannot be unreached, and the false class became `UNREACHED-BY-THIS-BATTERY`.

**AND THE RATCHET LIED ON ITS FIRST RUN.** It reported
`item:blackglasses:damageMultType.mult LIVE -> READ-AND-IGNORED` as a regression against an engine
that had not moved — same release id in both runs. The per-operator ratchet was comparing verdicts
across two different BATTERIES. Both ratchets are now scoped, and the scope hashes the script text,
because turns and arms were unchanged while the actions on each turn were rewritten. **The release id
is deliberately NOT in the scope** — a new release resetting the ceiling would switch the ratchet off
at exactly the moment it is needed.

### The three stream-shift suspects, explained rather than left as a hedge

`--explain=<operator>` replays one operator and prints the first turn at which the two traces diverge,
field by field. (It was wrong first too: it staged the reference arm AFTER installing the mutant DB,
and `TAGS` is one shared module, so both arms ran against the mutant and it printed "no difference"
for an operator scored LIVE with changed=5.)

| operator | what the replay shows |
|---|---|
| `poisontouch:poisonsOnMyContact.needsContact:=false` | **A die drawn and discarded.** The site is `(!_pt.needsContact \|\| mvMakesContact(…)) && rng()<p`, so the mutant short-circuits TRUE and rolls on the special attack too. Under k05 the roll SUCCEEDS and `applyStatus(tg,'psn')` does nothing, because Will-O-Wisp already burned the only target that attack reaches. The extra draw realigns both LCGs; every difference printed is 1-7 HP of damage roll |
| `toxicchain:poisonsOnMyContact.needsContact:=false` | identical, same site, same carrier tag |
| `prankster:priorityMod.shift:=10` | **Characterised, not fully explained.** One of twenty arms, streaming, diverging at turn 5 in which body is active. All three constant rngs are byte-identical, and +1 already outranks everything else in this script, so the shift reorders nothing — the likeliest cause is the lazily-drawn speed-tie coin being demanded on one turn and not the other. Said plainly: the LIVE verdict for this operator rests on a realignable stream |

A stream-shift-suspect keeps its LIVE verdict on purpose. LIVE is the safe direction — calling it
READ-AND-IGNORED would manufacture a defect.

### It is registered, and the ratchet is real

`tests/test-mutation-coverage.js` — auto-discovered by `tests/run-all.js`, unlike a file called
`mutation_harness.js`. It re-runs the planted-stub gate (~13s), asserts both ratchets, and asserts
the sweep still covers **every** tag in the release artifact, so a sweep quietly narrowed back to a
comfortable dozen fails instead of reading as a pass. It does **not** fail when a newer release
exists; it prints the drift and the command, and the reason that is a deliberate call rather than a
silent one is written in the file's header.

Full sweep: **171s, 182 tags, peak RSS 358 MB**, single process.

## WIRE 118 — THERE WERE TWO IMPLEMENTATIONS OF "WHO MOVES FIRST". ONE IS DELETED. 2026-08-05.

Census **210 → 211 live / 213 → 214 probed**; missing still 3 (the same three), hollow 0, `threw` 0,
`unarmed` 145 (the new probe is armed). Differential **1/150**, the same pre-existing
`chesnaught woodhammer -> mimikyu` row and the same 11 not-comparable. `tests/test-game-diff.js`
agrees on every turn of all five scripted games.

Will has raised this three times and the previous answers were the wrong shape — a consistency test, a
ratchet, a proposed shared module. **A test that checks two copies agree is a workaround for having
two copies.**

| | before | after |
|---|---|---|
| `engine/medicham2-browser.js` | sorted `acts` ONCE per turn and walked it frozen — **no dynamic speed at all** | freezes the bracket, then **re-sorts the remaining actions before each one resolves** |
| `engine/board.js:2791` | `(slowFirst ? mySpe < thSpe : mySpe > thSpe) ? 1 : 0` — the Trick Room inversion and the speed comparison, restated by hand **twelve lines below `D2.priorityRefusedAbove`**, a call into the very engine that owns the rule | `D4.compareTurnOrder({spe: mySpe}, {spe: thSpe}, {tr: slowFirst ? 1 : 0}) < 0` |

The two had **measurably diverged**, and it is not a corner case: `board.js:466` says in words that a
Tailwind on a Prankster user lets the partner's Earthquake land first THIS turn, so MAG's `speedSwing`
and `speedSetupHelpsPartner` believe in dynamic speed — while the rollout that checks MAG's opinion
said the Tailwind did nothing. MILTANK sat between them and **the search believes the simulator.**

### The rule is Showdown's own, read out of Showdown

```
sim/battle-queue.ts, file header:  "Actions are sorted based on order (lower first) followed by
                                    priority (higher first) followed by speed (higher first).
                                    Ties are broken with Fischer-Yates."
sim/battle.ts, gated on gen >= 8:  "In gen 8, speed is updated dynamically so update the queue's
                                    speed properties and sort it."
                                    this.updateSpeed(); …getActionSpeed(a)…; this.queue.sort();
```

**The re-sort re-derives the SPEED only.** `order` and `priority` are resolved once, when the action is
queued — so `_pri` is frozen at the top of the turn here rather than recomputed, and a Grassy Terrain
set halfway through a turn does not retroactively give Grassy Glide its priority.

**MEASURED FIRST, in the official engine at the pinned commit, both arms printed before a line of
engine changed** (`scratchpad/ref-dynspeed.js`, then `ref-dynspeed2.js` for the exact probe pair).
L50 / 0 EV / 31 IV / Serious — Whimsicott 136, Garchomp 122, Milotic 101, Incineroar 80 (160 under
Tailwind):

```
control : Whimsicott -> Garchomp -> Milotic -> Incineroar
tailwind: Whimsicott -> Incineroar -> Garchomp -> Milotic     Incineroar OVERTOOK, inside the turn
```

### The probe, and it was RED first

`move doublesSideSpeed — "Tailwind speeds the PARTNER up inside the same turn"`, armed. The tag already
had a probe; that one reads the partner's speed AFTER the turn and **structurally cannot see when the
boost starts counting** — the weather-rock lesson again, a mechanic with two halves needs a probe per
half. The outcome, not the order list: Milotic is left on 1 HP, so whoever moves first decides whether
Milotic ever acts.

```
RED    partner (Incineroar 80) took 115 … and 115 after the ally clicked Tailwind
GREEN  partner (Incineroar 80) took 115 … and 0   after the ally clicked Tailwind
```

**AND THE RED IS PERMANENT, NOT A TRANSCRIPT.** `tests/probe_red_demo.js` gained a `demoSource` arm
whose known-bad engine is **exactly the frozen queue and nothing else** — the three-line re-sort
deleted, with the comparator, the frozen bracket, the tie and the `order` overrides all left in place,
so the one thing that flips is the thing this wire is about. 29 demonstrations, 0 failed;
`shipped-arm=true, reverted-arm=false`. The revert asserts it applied, so a patch that silently
stopped matching cannot make a broken engine look fixed.

**THE FIRST STAGING WAS WRONG BEFORE THE ENGINE WAS, WHICH MAKES TWENTY-SEVEN.** The dispatch's pair
was Garchomp/Incineroar, correct at 0 EV. `buildMon` uses USAGE spreads and its **Garchomp is invested
at 161**, so Tailwind's 160 does not overtake it — the probe would have printed identical arms on a
FIXED engine and read as agreement. Incineroar (80) and Milotic (101) are the two bodies whose `MC`
lines are exactly the reference's own 0-EV lines, so the probe and the reference ask one question at
one set of numbers.

### The three things the re-sort had to not break, each made explicit

- **THE TIE MUST NOT RE-ROLL.** The old comparator ended `sp||(rng()<0.5?-1:1)` — a coin flipped INSIDE
  the sort. Re-sorting each iteration re-draws it, the RNG stream diverges, and every seeded run in the
  repo changes for reasons that have nothing to do with speed. The tie is now rolled **once per action,
  on first demand, and stored** (the shape `_qc` already uses). Lazily, so a turn with **no** speed tie
  draws exactly as many numbers as before this wire and the existing seeded probes are untouched rather
  than merely close.
- **AFTER YOU / QUASH NO LONGER SPLICE THE ARRAY.** A splice is undone by the next re-sort, so WIRE 109
  would have gone silently dead under dynamic speed. They write the action's `order` — Showdown's own
  `3` for next and `201` for last against `200` for a plain move — which is the FIRST key the
  comparator reads and therefore survives every later re-sort.
- **"HAS IT ALREADY ACTED" IS NOW "HAS IT RESOLVED".** The flinch bookkeeping was an INDEX into a list
  frozen at the top of the turn, which stops meaning anything once the list re-sorts. It is a set of
  the actions still outstanding, which is the same question asked directly **and keeps the half the
  index was quietly also answering**: a body with no action this turn (dragged in by Roar) is not in
  the set either, so it cannot be handed a flinch that would leak into the next turn.

### board.js was edited, which this division normally may not do, and here is the evidence it owes

The deletion IS in board.js — there is nothing to delete anywhere else — so this pass touched a file
ENGINE does not own, under an explicit dispatch, and the obligation that comes with it is discharged
by measurement rather than by argument:

| question | instrument | answer |
|---|---|---|
| did the **board.js** edit move the feature function? | a direct A/B: the WIRE 118 hunk textually reverted and compiled in memory at board.js's own path, both arms hashed column-by-column over the fit's own corpus | **IDENTICAL** — all 58 columns, **1,136,845 candidate vectors over 6,055 clean games**, same row keys |
| can that instrument SEE a difference? | positive control: the reverted arm's rule INVERTED | **MOVED — `movesFirst`, `deadNoLastMove`, `diesBeforeMoving`** |
| could the **medicham2** edit move it? | every module export wrapped with a counter over a 300-game feature walk | `battleTurn` — the only existing function this wire changed — is called **0 times** by the feature path. The only new call is `compareTurnOrder`, 37,084 times |

**`engine/feature_engine_contrast.js` CANNOT SEE A board.js CHANGE and its header says so**: it swaps
`medicham2-browser.js` and `tags.js` between bundles and holds board.js FIXED in every arm, which is
right for the question it asks and is not this question. Quoting it as if it covered the board edit
would be a null from an instrument that cannot see. It was run anyway, and it is **NOT IDENTICAL**:

```
MOVED — at least one feature column differs on identical rows. This is a REFIT, not a restamp.
  live vs 09acd3b404ef: 3 columns moved: deadNoLastMove, movesFirst, diesBeforeMoving
  live vs 032b4a2979dd: 3 columns moved: deadNoLastMove, movesFirst, diesBeforeMoving
  rows 1,136,845 over 6,055 games   (sample pinned, same_rows true)
```

**THE VERDICT IS REPORTED AS IT CAME OUT, AND IT IS ATTRIBUTED RATHER THAN EXPLAINED AWAY — measured,
in the same arrangement:**

| arm | `compareTurnOrder` on the injected engine | `dmgFailures.unavailable` over 20 games | mean `movesFirst` |
|---|---|---|---|
| live | `function` | **0** | 0.5212 |
| release `09acd3b404ef` injected under live board.js | `undefined` | **2,110** | 0.2302 |

The release arms run the **live** board.js against an engine that predates the exported rule, so
board.js's own loud unavailable branch fires and `movesFirst` keeps only its priority half.
`deadNoLastMove` and `diesBeforeMoving` are its two dependents, which is why exactly those three move —
the same three the board A/B's positive control moves. **On a like-for-like tree** (the same engine on
both sides, only the board line varied) **the feature function is IDENTICAL on all 1,136,845 rows.**

**IT IS STILL A REAL PROPERTY AND IT IS MEASURE'S CALL, NOT ENGINE'S.** From now on live board.js
requires a post-118 engine, so any arrangement that pairs it with a frozen pre-118 release degrades
`movesFirst` — loudly and counted, but it degrades. The alternative was to have board.js fall back on
the hand-rolled comparison, which is the duplicate this wire deletes, put back for the sake of a
cross-version convenience. **The dispatch's rule is followed: the verdict is not IDENTICAL, it is said
plainly, and no refit was started here.**

### What the re-sort costs

Two extra sorts per turn, measured rather than assumed: `sortTurnOrder` on a four-action list is
**1.96 µs** against the old inline comparator's **2.38 µs** — cheaper per sort, because the keys are
built once per ACTION instead of once per comparison — so the wire adds about **4 µs to a turn that
takes 800–1,100 µs**. The whole-turn benchmark cannot resolve that: five interleaved pairs against
HEAD's bytes ran 760–3,327 turns/sec inside a single arm, and the medians came out 1,141 (HEAD) vs
1,281 (WIRE 118), which is noise with a sign. Recorded that way rather than as a win.

### FILED, NOT FIXED — the fit corpus MOVED THREE TIMES IN ONE HOUR, and an artifact was written across the move

Not ENGINE's, and not caused by this wire, but it was found while measuring and a silent one is worse
than a loud one. `fit_policy.loadCorpus()` returned **9,361** clean open-sheet games at 19:48Z,
**6,055** at 19:52Z when this pass measured, and **8,957** at 20:35Z — with 3.47.0 recording 9,230
this morning. An earlier `data/feature-engine-contrast.json` was written straight across that: its
`live` and `09acd3b404ef` arms scored 9,361 games / 1,774,684 rows and its `032b4a2979dd` arm scored
**6,055 / 1,136,845**, so `same_rows` was false, all 58 columns "moved", and it published
`MOVED — this is a REFIT, not a restamp` off arms that had walked different corpora. *(The instrument
was fixed while this pass ran — it now pins the sample of game ids before any bundle starts and prints
the pin, and `provenance.js` has grown a CORPUS DRIFT check that names it. Both are somebody else's
work, landed in the same hour, and are recorded here because this pass's own numbers sit on top of
them.)* **This pass's board A/B is a photograph of the 6,055-game moment and says so: both arms walked
the same corpus and the row-key hash proves it, which is the guard doing its job rather than a claim
that the corpus held still. Why it moves at all is MEASURE's.**

## WIRE 117 — PSYCHIC TERRAIN REFUSED PRIORITY AGAINST BODIES THAT WERE NOT ON THE GROUND. 2026-08-05.

Census **208 → 210 live / 211 → 213 probed**; missing still 3, hollow still 0, `threw` 0, `unarmed`
**146 → 145**. Differential unchanged at **1/150** (the same pre-existing `chesnaught woodhammer ->
mimikyu` row). One new probe, `move setsTerrain — "Psychic Terrain refuses priority only against a
GROUNDED target"`, and it was **shown RED first** against a source-reverted engine.

**THE MATRIX FIGURE IN THE GENERATED BLOCK ABOVE PREDATES THIS WIRE and says so in its own stamp
(16:46).** `tests/test-interaction-matrix.js --full` publishes an artifact and was deliberately NOT
run: a second division was measuring against release `032b4a2979dd` while this landed, and an
instrument that publishes while the engine moves is the 7,100-game failure in a new costume. It is
owed on the next matrix pass, together with the staged `priorityMove` regeneration below.

Will: *"Psych terrain is sorta like queenly majesty"*. He is right, and being right is exactly what
hid the defect: both resolve through `priorityRefusedAbove`, and **the terrain branch sat OUTSIDE the
defender loop and never inspected a body at all.**

```js
for (const d of (defenders || [])) { …the ability bar… }
if (field && terrainId(field.terrain) === 'psychic') out = Math.min(out, 0);   // no `d` anywhere
```

So MEDICHAM refused **Fake Out (12,872 uses — one of the most-clicked moves in the format)**, Extreme
Speed, Sucker Punch, Aqua Jet, Ice Shard and Upper Hand into every Flying type, every Levitate body
and every Air Balloon on the field. The comment at the site said grounded-ness *"is not tracked in
this engine"*. **That stopped being true at WIRE 90 and the comment survived the change** — the same
shape as the partial trap's *"the switch-blocking half is NOT modelled"*, which was true when written
and is how a declared gap outlives the gap.

**AND IT IS THE CENSUS'S OWN BLIND SPOT AGAIN — a mechanic with a SCOPE.** The existing `setsTerrain`
probe stages the block against a **Garchomp**, which is Dragon/Ground, so it passes on the broken
engine and on the fixed one. Every instrument here asks whether a mechanic FIRES; this is the third
time in two days that the answer was *yes, and everywhere it should not*.

### The fact existed three times and none of them was the one that mattered

`isGrounded(mon)` is now one function and every site calls it — the hazard block (Spikes / Toxic
Spikes / Sticky Web), `preventsSwitch.onlyGrounded` in the switch branch, the Grassy Terrain heal,
and Psychic Terrain's priority bar. This is CLAUDE.md's **FACTS ARE GLOBAL** broken and repaired: the
three hand-written copies disagreed about Iron Ball and about Eelevate, and the Grassy Terrain copy
**counted its own known-wrong half in `MEDFAILS.terrainHealUngrounded`**. Somebody knew that one was
wrong. `fails.terrainHealUngrounded` is retired to zero and replaced by
`seen.terrainHealSkippedAirborne`, so the event is still countable (docs/ENGINE.md rule — a counter
does not merely vanish).

### Every clause checked against the FORMAT, not remembered

The rule is Showdown's own `Pokemon#isGrounded` (`sim/pokemon.ts:2153`), clause for clause:

| clause | asked of the format | decision |
|---|---|---|
| **Iron Ball** — grounds, and beats the Flying clause | `isNonstandard` **null** — LEGAL, 113 corpus uses | **WIRED** |
| **Flying type** | — | **WIRED** |
| **Levitate** | 2,540 uses | **WIRED** |
| **Eelevate** | Eelektross-Mega, 0 sheets (Lesson 3) | **WIRED** |
| **Air Balloon** | `isNonstandard` **'Past'** — BANNED, and absent from `data/tags.json`'s items entirely | kept as the RULE, **unreachable here**, stated rather than dropped |
| **Telekinesis** | `isNonstandard` **'Past'** — BANNED | **not wired**, and this HONOURS the declaration already at the hazard block instead of contradicting it |
| **Magnet Rise** | legal, **1** corpus use, a volatile this engine does not carry | **not wired**, declared |
| **Gravity** | legal, **79** uses, grounds EVERYTHING, and this engine has no pseudo-weather slot | **not wired**, declared — the largest live gap here |
| **Roost** | legal, **2,109** uses; grounds the user by deleting Flying for one turn | **not wired**, declared — no per-turn type override exists; the second-largest gap |
| **Smack Down** / **Ingrain** | legal, 10 uses / 0 uses, volatiles | **not wired** |

**THE ABILITY SET IS A NAME AND THAT IS THE STANDING DECLARATION HONOURED, NOT AN EXCEPTION TO IT.**
The tempting shape is `typeImmunity {type:'Ground'}` — and its membership was **printed before it was
trusted**: `eelevate`, `levitate` **and `eartheater`** (45 uses, Orthworm). Earth Eater is
Ground-immune and firmly on the floor. Consuming that tag by shape would have made Orthworm airborne,
and the over-match would have been invisible because the case looks identical to Levitate. Showdown
itself hard-names the pair inside `isGrounded`, so this mirrors the reference implementation.

### Every expected value came out of the official engine

Played at the pinned commit under `gen9championsvgc2026regmb` — Incineroar's Fake Out into a Psychic
Terrain the *opposing* Indeedee's Psychic Surge put up, both arms printed before a line of engine
changed:

```
Garchomp    Rough Skin              |-activate| move: Psychic Terrain          BLOCKED, 0 damage
Orthworm    Earth Eater             |-activate| move: Psychic Terrain          BLOCKED, 0 damage
Talonflame  Flame Body              |-hint| "doesn't affect airborne Pokémon"  LANDS  237 -> 216
Hydreigon   Levitate                |-hint| "doesn't affect airborne Pokémon"  LANDS  251 -> 233
Talonflame  Flame Body + Iron Ball  |-activate| move: Psychic Terrain          BLOCKED
Hydreigon   Levitate  + Iron Ball   |-activate| move: Psychic Terrain          BLOCKED
```

**THE REFERENCE HARNESS WAS WRONG BEFORE THE ENGINE WAS — LESSON 5, VERBATIM.** Its first version
gave both p2 bodies **Protect** as their only move, so all four arms read `damaged: false` and the
engine would have been declared correct. Its second gave Garchomp **Earthquake**, a spread move, and
`battle.choose` rejected the turn outright.

### The ally case was already handled at the boundary, and it was verified rather than assumed

Psychic Terrain does not block a priority move aimed at your own side (`target.isAlly(source)` in the
terrain's own `onTryHit`). All three medicham2 call sites pass the FOE array: `:1520` passes a single
bench foe, `:2384` is gated on `_pf.indexOf(a.target) >= 0`, and the attack branch aims at `actB`/
`actA`. Ally Switch and Follow Me are self-targeted and never reach the gate. board.js filters on
`f.side === foeSide`. **No change was needed and none was made.**

### The bar is per-SIDE for the abilities and per-TARGET for the terrain

Queenly Majesty and Armor Tail protect their partner, so folding them over every live defender is
right. Psychic Terrain asks about **the body being aimed at**, so `priorityRefusedAbove` gained an
optional third argument. Without it a grounded partner would refuse a Fake Out aimed at the
Talonflame standing next to it.

### FILED, NOT FIXED — `terrainScaled`'s grounded half, and the reason it is the TAG this time

The `terrainScaled` block in `dmgRange` carried the stale caveat *"grounded-ness, which this engine
does not track (the same caveat priorityRefusedAbove already carries)"*. That reason is dead. The
**live** blocker is real and is in the artifact: the tag's two members disagree about whose feet
matter — Expanding Force tests `source.isGrounded()`, Rising Voltage tests `target.isGrounded()` —
and `terrainScaled` carries `{terrain, mult}` with no subject. Wiring a grounded test here would be a
coin flip that is wrong for one of the two. It needs a `grounded: 'user'|'target'` enrichment,
derivable from the handler text exactly as WIRE 83 derived its conditions. 296 corpus uses between
them. **The comment is corrected in place rather than left pointing at a fixed problem.**

### FILED, NOT FIXED — board.js and position_features.js hand over PARTIAL bodies

Both map their priority defenders to `{ability, fainted}` — no `types`, no `item`. The Levitate
clause reaches them; the Flying and Iron Ball clauses cannot, so a Flying-type foe is **still
over-refused in the FEATURE vector**. That is a feature-semantics change on files ENGINE may not
touch (a `board.js` signature change is a refit, which MEASURE owns), so it is declared and **LOUD**:
`fails.groundedBodyIncomplete` counts every such call and names the first offender.

### The tag_dex half is STAGED, and it is why the matrix has never seen this

`data/tags.json`'s `priorityMove` linkage carries three reactors — armortail, queenlymajesty,
dazzling — and **`reactorMoves` is EMPTY**, so the interaction matrix has never staged a single
Psychic-Terrain-against-priority case. The derivation tested `move.priority > 0`; Showdown writes the
same predicate the other way far more often (`if (move.priority <= 0.1) return;`) and reaches it
through `effect.priority` and `baseMove.priority` too, because a terrain's condition is handed an
*effect*. Broadened in `engine/tag_dex.js`, **from the handler's shape and not by naming a terrain**,
so a terrain added next regulation arrives without an edit. Membership printed against the format dex
before staging:

```
was   ability armortail, dazzling, queenlymajesty
is    ability armortail, dazzling, queenlymajesty     (unchanged — no ability moves)
      move    psychicterrain    the terrain's onTryHit, `effect.priority <= 0.1`
      move    quickguard        blocks priority for the side, and was simply absent
      move    upperhand         fails unless the TARGET is about to use a priority move
```

The two idioms are enumerated rather than a loose `[<>]=?` because a loose one also matches
`priority < 0`, which is a NEGATIVE-priority reactor and a different key. **`data/tags.json` is
untouched:** it is a frozen-release source and an input to the feature vector, so regenerating it is
the coordinator's single-writer moment, not ENGINE's to take while a measurement is running.

### How the probe was proved RED

`tests/probe_red_demo.js` gained a **second kind of known-bad engine**. Its existing `demo()` mutates
the ARTIFACT, which is the right input for a wire whose defect was "nothing consumed this tag" — and
it cannot express a defect that lives in the CODE with no tag to strip. `demoSource()` loads the
engine source into a fresh module, textually reverts the WIRE's sites to exactly what they said
before, and **asserts every reversal applied**; a patch that silently failed to match would make a
broken engine look fixed. Both WIRE 117 rows flip (shipped `true`, reverted `false`); 28
demonstrations, 0 failed. The first attempt threw because the engine file is CRLF and the patterns
are LF — **the guard firing, which is what it is for.**

## THE FROZEN RELEASE LOST A RECORD, AND "RE-CUTTING IS A NO-OP" IS WHY. 2026-08-05.

ENGINE rewrites the simulator while SEARCH measures, and the only reason that is safe is that a
measurement reads a frozen release rather than the live tree. That mechanism had a hole in the half
nobody freezes: **the record**.

**THE RECEIPT.** `engine/engine_release.js cut` ran twice over an unchanged tree — 02:12:57Z by
SEARCH (*"h60 log leg of the R1 explore-sweep re-run — cut immediately before the run because ENGINE
lands roughly every half hour"*) and 02:26:04Z by the router (*"R10/click-censoring parallel
session"*). Both produced id `09acd3b404ef`, because the id is the digest **of the file digests** and
an identical tree must yield an identical id. Exactly **2 lines** of `release.json` changed and
**zero of the 23 digests**, so no measurement is corrupted — and the first cut's time and reason were
**destroyed**. Every artifact SEARCH had already stamped `09acd3b404ef` then pointed at a record
claiming a freeze **thirteen minutes after the run that read it**, for an unrelated purpose. That is
the *artifact newer than an input it never read* shape this repo has already lost 7,100 games to.

**The docs called a second cut "a no-op". True of the frozen BYTES, false of the RECORD** — and that
sentence is exactly what made the overwrite look intended.

**THE FIX IS A CUT LOG, NOT A GUARD.** A cut appends one line to `cuts.jsonl` beside the snapshot;
`release.json`'s `cuts[]` is a rendering of that log, and `cut`/`why` at the top now mean the **FIRST
freeze of these bytes** and are never rewritten. Under any other reading an artifact can end up older
than the release it names. An append cannot lose an earlier line, which a read-modify-write of a JSON
array can under two concurrent cuts — and two agents cutting at once is not hypothetical here, it is
what happened. A second cut still succeeds and still returns the same id, so no workflow is blocked.

| requirement | how it is met |
|---|---|
| determinism unchanged | id is still the digest of the digests; the test asserts both cuts return `09acd3b404ef` and that not one of the 23 digests moved |
| the first cut is never lost | `cut`/`why` = event 0; later cuts append |
| a re-cut is still ergonomic | it succeeds, prints `THIS TREE WAS ALREADY FROZEN — this is cut N`, and lists every event |
| `stamp()` still answers "which bytes" | `engine_release` + the full `source_digests` set, unchanged; `engine_release_cut` is now the first freeze, so it is always ≤ the artifact's own time; new `engine_release_cuts` tells a reader to go and read `cuts[]` |

**THREE MORE OVERWRITE HAZARDS WERE IN THE SAME FILE, and one of them was worse because it wrote
NOTHING.** The snapshot copy loop was wrapped in `if (!fs.existsSync(dir))`, so a release whose
snapshot was incomplete (an interrupted cut) or had rotted on disk stayed broken through every later
cut **while the cut reported success**. It is now per file against the digest the manifest will
claim, and a repair is shouted and recorded in the cut event, because a silent repair hides that a
snapshot rotted. The **pointer** `data/engine-release.json` is the one file that is *supposed* to be
overwritten — that is what a pointer does — but it was copying the latest cut's time, so it made the
same false claim; it now mirrors the first freeze and carries `latest_cut`/`latest_why` beside it.
And `release.json` and the pointer are now written **atomically** (temp + rename), so a measurement
opening a release mid-write cannot read a truncated document.

**PROVEN BY REPRODUCING THE NIGHT.** `tests/test-engine-release.js` cuts, records the metadata,
stamps an artifact, cuts again over the unchanged tree, and asserts the first record survived — and
it was **shown red first**: 8 failures on the metadata arm plus 2 on the snapshot-repair arm before
the fix, 44 passed / 0 failed after. The mutation arms are asserted to have run (`the second cut
genuinely ran`, and the rot arm asserts `verify()` FAILS before the repairing cut, so the bad input
is real). It cuts into a **throwaway store** passed as `{store}` — a test that cut into the real one
would repoint the live pointer while another division measures, which is this mechanism's own failure
mode arriving through its test.

**The lost record was restored afterwards, as a separate labelled step and through the mechanism**:
both events written into `cuts.jsonl`, each marked `reconstructed` with its provenance in the record
(the first also `restored: true`, sub-second precision unrecoverable), then re-rendered with
`engine_release.js rerender`. Digests untouched, `verify()` intact, 23 files.

**FILED, NOT FIXED — not ENGINE's file.** `engine/miltank.js:145` reads the pointer for
`rel.digests` and `rel.release`, which **`engine_release.js` has never written** (it writes
`current`/`cut`/`why`). So `resolveRelease` compares **zero** files, finds zero moved, and stamps
`release: 'UNNAMED', release_status: 'ON_RELEASE'` — a green attribution derived from an empty
comparison. Two pointer schemas exist (the other is the hand-rolled recipe in `docs/SEARCH.md:825`).
SEARCH owns both.

## THE SCOPE PASS — WIRES 114–116. **THE CENSUS NEVER ASKED WHETHER A MECHANIC FIRES ONLY WHERE IT SHOULD.** 2026-08-05.

Census **202 → 208 live / 205 → 211 probed**; missing still 3, hollow still 0, `unarmed` still 146 (all
six new probes are armed), `threw` 0. Matrix **899/899 at `--full`**, denominator unshrunk. *(3.43.0
supersedes that figure: the denominator was itself unchecked. See "THE SIZE, AND THE COVERAGE,
HONESTLY" below — 1,027/1,031 once the generator's arithmetic was closed.)*
Differential **1/150**, the same pre-existing `chesnaught woodhammer -> mimikyu` row.

Three defects, one shape, and the shape is the finding. **Every instrument this division owns asks
whether a mechanic FIRES. None of them asks whether it fires ONLY WHERE IT SHOULD** — and two of
these three would have passed a "does it fire" probe on the day they were broken:

| | the mechanic FIRED | and it was still wrong |
|---|---|---|
| Shield Dust | blocked Nuzzle's paralysis, correctly | and blocked Will-O-Wisp, Thunder Wave, Spore, Toxic and Static, none of which it touches |
| the partial trap | chipped every turn, expired on time, died with its trapper (WIRE 105) | and stopped **nothing** — the switch-blocking half is most of what those seven moves are |
| Purifying Salt | its Ghost-damage half worked all along, off `halvesTypeDamage` | and its status half did not exist, so "is Purifying Salt live" had a true answer and a false one at once |

**EVERY EXPECTED OUTCOME CAME OUT OF THE OFFICIAL ENGINE, NOT OUT OF ANYBODY'S MEMORY.** Each case
was played at the pinned commit under `gen9championsvgc2026regmb` with both arms printed before a
line of engine changed. That is what caught the fourth item below, which contradicts the dispatch.

### WIRE 114 — Purifying Salt refuses every status. `statusImmune`, `probe: 'Purifying Salt refuses every major status, and Sturdy takes them all'`

`STATUS_IMMUNE_ABIL` had six per-status lists and Purifying Salt was in **none** of them, so
**Garganacl — legal, 51 declared sheets — took Will-O-Wisp, Thunder Wave, Spore and Toxic like any
other Rock type.** Official engine, both arms: into Purifying Salt all four leave it clean, into a
Sturdy control the same four bodies burn / paralyse / sleep / badly-poison.

It is wired as **one ANY-status list**, not a seventh entry in six places, because the handler is a
single unconditional `return false` and a seventh status added tomorrow would otherwise need six
edits and get five. **It is a NAME and that is the standing declaration honoured, not an exception to
it**: the artifact's `statusImmune` is a bare `{immune:true}` on all twelve carriers, so consuming it
by shape would make Leaf Guard (sun only) and Pastel Veil (poison only) block everything always —
which is exactly what the Layer 0 triage said, and why the hand table is richer than the artifact.

**COMATOSE IS DECLARED DEAD AND KEPT.** It sat in five of the six lists with nothing saying it cannot
fire: its only carrier is **Komala**, `isNonstandard: 'Past'` in this format, verified against the
format rather than remembered. It belongs in the ANY list on the same handler shape and is labelled
unreachable in place. A table carrying an unreachable entry invites trust in the rest of it.

**AND THE DROWSE ASKED A DIFFERENT QUESTION FROM THE SLEEP.** The Yawn branch tested `!t.status`,
which is one clause of `canTakeStatus`, so an Insomnia or Purifying Salt body took the counter and
then failed to fall asleep two turns later. Showdown's yawn condition refuses on
`!target.runStatusImmunity('slp')`. One function now answers "can this body be slept" for both routes.

**THE OTHER HALF IS PINNED, NOT FIXED, AND SAYS SO.** Purifying Salt also halves Ghost damage, and
that was already LIVE off `halvesTypeDamage`. It gains a probe anyway — the weather-rock lesson: a
mechanic with two halves needs a probe per half, or the halves drift and one passing number covers
both. The red demo asserts this one stays **GREEN** on the reverted engine, declared as a PIN.

### WIRE 115 — Shield Dust, at the one scope where it is correct. `probe: 'Shield Dust blocks a move SECONDARY and does not block a status MOVE'` (+2 more)

`canTakeStatus` opened with a blanket `if(ab==='shielddust') return false`. That function is the gate
**every** status in this engine passes, and both its callers are places Shield Dust does not reach:
the direct status-move path, and the punish-ability loop (Static, Flame Body). Covert Cloak is banned
in this format, so Shield Dust is the live carrier of the whole family.

The line was **not** deleted. It moved to the secondary loop in the attack branch and grew the two
special cases the real engine has, because **deleting it would have lost a rule the blanket check was
accidentally getting right**:

| route | official engine | before | after |
|---|---|---|---|
| direct status move (Wisp / T-Wave / Spore / Toxic) | **lands** | refused | lands |
| a move's secondary status, drop or flinch | blocked | blocked | blocked, at the secondary loop, counted in `MEDSEEN.dustBlockedSecondary` |
| Static / Flame Body punishing a Shield Dust ATTACKER | **paralyses / burns** | refused | lands |
| **Poison Touch** into a Shield Dust body | **blocked** — 0/40 seeds vs 12/40 into a control | blocked (by accident) | blocked, named at the effect, with Showdown's own comment quoted |
| a secondary that boosts the **USER** (Trailblaze, Aqua Step, Flame Charge…) | **kept** — spe+1 | **zeroed** | kept |

**THE DISPATCH'S DIAGNOSIS WAS WRONG ON ONE POINT AND IT IS RECORDED RATHER THAN QUIETLY CORRECTED.**
It said Shield Dust "does NOT block an ABILITY effect". True of Static and Flame Body; **false of
Poison Touch**, which Showdown special-cases in its own source — *"Despite not being a secondary,
Shield Dust / Covert Cloak block Poison Touch's effect"* — and the 40-seed sweep confirms behaviourally.
A straight deletion of the blanket line would have introduced a new bug while fixing an old one.

**AND A FIFTH ROW NOBODY ASKED ABOUT, found by reading the handler rather than the summary.** Shield
Dust is `secondaries.filter(effect => !!effect.self)` — it **keeps** the self ones — while Sheer Force
sets `move.secondaries = null` and removes them all. This engine had merged the two into one boolean,
so a Trailblaze into a Shield Dust body left the attacker at Speed 0 where the official engine leaves
it at +1. The two suppressions are now separate; `suppressed` survives only for King's Rock and the
procedural-status set, where both abilities really do stop the same thing.

**A RED TEST THAT PINNED THE DEFECT.** `tests/test-rollout-effects.js` asserted
`canTakeStatus(shielddust,'brn') === false` and went red on the fix. The assertion was wrong, not the
engine — the same event as the Simple/Intimidate row on 2026-08-05 — so it was **re-pinned against the
official engine with the receipt in place**, and four Purifying Salt rows were added beside it.
43 passed / 0 failed.

### WIRE 116 — the partial trap holds the switch. `partialTrap`, `probe: 'a partial trap holds a voluntary switch, and Ghost / Shed Shell / a pivot get out'`

`_trap` was initialised, set, chipped, expired and taught to die with its trapper — and **appeared in
no switch decision anywhere**, so Fire Spin, Wrap, Infestation, Whirlpool, Sand Tomb, Thunder Cage and
Magma Storm dealt their chip and let the victim walk out. The comment at the site that SETS the trap
said *"the switch-blocking half is NOT modelled"*, which is how a declared gap survives: it was true,
so nobody re-read it.

The rule was taken off the official engine, four arms, all printed:

| arm | official engine |
|---|---|
| bare switch out of an Infestation | **REJECTED** — `Can't switch: The active Pokémon is trapped` |
| a **Ghost** type | leaves freely, and **keeps the volatile and the chip** (98/130 → 82/130 the following turn) — which is why the exemption is at the switch and not at the tick |
| a **Shed Shell** holder | leaves |
| a pivot **MOVE** (U-turn) | pivots — already expressed by the existing `!a.mv` gate |

Shed Shell is a **name** because `data/tags.json` has no `shedshell` entry at all — there is nothing
to read by shape. Stated where it is read, like Shield Dust.

**FILED, NOT FIXED: Shed Shell does not release a body from ABILITY trapping.** It should. The
ability branch was scoped out of this dispatch as correct-and-untouched, and the exposure is zero
today (Shadow Tag is Gengar-Mega; Magnet Pull and Arena Trap have no corpus presence). Declared at
the site.

**AND THE STALE COMMENT ON THAT SAME BLOCK IS GONE.** It claimed `onlyGrounded`/`onlyTypes` "are not
in the params yet" and that Arena Trap and Magnet Pull "over-trap". The staged tag_dex batch landed
those params, the code reads them, and the comment described a world that ended.

### How each probe was proved

`tests/test-mechanics.js` gained six probes, all **armed**. Every one was demonstrated RED against a
**known-bad engine**: the source is loaded through a require hook, the seven WIRE sites are reverted
in memory to exactly what they said before this pass, and **each reversal asserts it applied** —
a patch that silently failed to match would make a broken engine look fixed, which is this project's
signature failure arriving through the test meant to catch it. **6 of 6 behaved as declared:
5 RED, 1 GREEN because it is the declared PIN.** The reverted-engine readings are the receipts:

```
statusImmune           sturdy brn,par,slp,tox | salt brn,par,slp,tox     <- the immunity did nothing
shield dust / status   wisp/dust none  (post-fix: brn)
shield dust / ability  static plain par  dust none                       <- refused a punish ability
shield dust / self     trailblaze dust 0  plain 1                        <- deleted the attacker's own boost
partial trap           trapped:incineroar                                <- trapped, and it left anyway
```

**TWO PROBES WERE WRONG BEFORE THE ENGINE WAS, WHICH MAKES TWENTY-SIX.** The first Shield Dust
ability arm staged the attack with `tackle`, which is **not in `MC.moves`** — `playerAction` returned
`{kind:'pass'}`, so both arms read "nothing happened" and the defect looked like agreement. The second
replaced it with **Flare Blitz**, whose own 10% burn secondary fired on the forced low roll and was
read as the Poison Touch proc. The shipped probe uses **Drain Punch**: contact, and no secondary of
its own.

**AND SO WAS THE OFFICIAL-ENGINE HARNESS, THREE TIMES, IN THE SAME DIRECTION.** Every reactor was
given `['Protect']` as its only move and duly clicked it, so **every status read as blocked** and the
engine would have been declared correct. Then `pass` was rejected in a doubles slot that has a live
body. Then Fire Spin's 85% missed on the pinned seed and the trap arm read as "not trapped". Each of
those makes the reference say what the wrong answer wanted it to say.

## THE FOUR MISSING MECHANICS, EACH WITH ITS REASON. 2026-08-05, after the Layer 0 pass.

**A declared gap with a reason is a finished item; an undeclared one is not.** The census carries all
four; this is why each is still there. There were 8; Air Lock came off as WIRE 78, `conditionalPower`
and `needsUntrackedState` came off together as WIRE 83, and **`reordersTurn` came off as WIRE 109 —
its blocking claim was WRONG**: "nothing in the artifact tells Instruct apart from After You" was
false, because Instruct also carries `instructsTarget {extraAction:true}`, a declared fact the
consumer now excludes on. The previous probe was then found staged against a body that could not show
the effect (Weavile 187 outruns Whimsicott 177, so the hit always landed before After You resolved) —
Lesson 5, again. Marvel Scale stays MISSING in the shipped artifact but its "blocked on the
derivation" verdict is retired: `condStatMult` is written in `tag_dex` (membership printed: exactly
`marvelscale def 1.5`), the consumer is live in `dmgRange` (WIRE 112), and only the STAGED
regeneration separates it from LIVE.

| # | mechanic | by DECISION or by OMISSION | why |
|---|---|---|---|
| 1 | `needsTargetToAttack` — Avalanche doubles after being hit | **DECISION**, re-confirmed 2026-08-05 | The probe asks for a rule that does not exist. Avalanche doubles when the user was damaged BY THAT TARGET THIS TURN; `dmgRange` is handed no turn state and must not invent any. 13 corpus uses. The tag's other nine members include Sucker Punch (6,673), already fully modelled through `failsIfTargetNotAttacking`, so the tag is not inert — only this member is |
| 2 | `writesAccuracy` — No Guard | **OMISSION, blocked on a SIGNATURE**, costed rather than gestured at, re-confirmed current 2026-08-05 | `moveAccuracy(id, field)` takes neither body. 11 call sites across 4 files; two of them (`board.js`, `position_features.js`) are **not ENGINE's** and a signature change there is a feature-vector change, which is the refit edge MEASURE owns. The compatible shape is `moveAccuracy(id, field, att, def)` with both optional. **It is a deliberate pass, not a one-liner, and was explicitly excluded from the 2026-08-05 dispatch for running beside MEASURE's refit** |
| 3 | `accuracyMod` — Sand Veil | **OMISSION, same signature**, same pass as #2 | — |
| 4 | `untagged` — Marvel Scale raises Defense while statused | **OMISSION, regeneration STAGED** | 36 uses. The derivation (`condStatMult`, an `onModifyDef` gated on `pokemon.status`, multiplier read from the handler's own chainModify) and the consumer (WIRE 112 in `dmgRange`, Mold Breaker punches through) both exist; `tests/probe_red_demo.js` proves the pair by injecting the staged tag through `TAGS.__setDB`. Flips LIVE at the next tag_dex regeneration |

## THE GENERATED INTERACTION MATRIX — `tests/interaction_matrix.js` + `tests/test-interaction-matrix.js`

Will: *"Basically all the tags on moves and stuff should trigger all the flags on abilities and types
and etc and have it flow from there"*, *"we def need interactions thats the whole point and multi turn
things like tailwind and trick room"*, *"the interactions should be pretty formulaic now that we have
all the tags and such."* He is right that it is formulaic. The generator is the formula; the runner
plays every case in medicham2 and in the official pinned engine and **authors no expected outcome**.

**THE SIZE, AND THE COVERAGE, HONESTLY.**

| | |
|---|---|
| theoretical cross product, no filter at all | **8,795** — flag 8,159, type 480, field 156 |
| emitted at `--full` | **2,300** — flag 1,831, type 313, field 156 |
| by layer | secondary 883, legality 379, damage 323, immunity 83, targeting 7 |
| **LIVE** (the reference engine's two arms differ, so the mechanic can fire) | **1,634** |
| INERT (the reference engine behaves identically with and without the reactor) | 530 |
| SATURATED (the control arm KO'd, so a damage ratio is clamped) | 109 |
| KO-TIMING (a damage-magnitude question — `test-engine-diff.js` owns it) | 25 |
| THREW (both are the harness — Curse takes no target and `battle.choose` rejects the turn) | 2 |
| **medicham2 agrees with the official engine on** | **1,027 of 1,031 — 99.6%** (3.43.0). The four are UNWIRED knobs, not wrong arithmetic — MEDICHAM's own two arms are identical on each: `fakeout`, `throatchop`, `psychicnoise` → **Shield Dust**, and `upperhand` → **Steadfast** |

### THE 902 PAIRS THAT "HAVE A PROBABILITY" — TWO FAULTS WEARING ONE REASON STRING. 2026-08-05.

Will: *"We cant just toss inaccurate moves can we?"*, then *"Flare blitz is 100 accurate man same with
iron head."* Both right, and the second is the sharper one: **`carrier-is-a-die` was a single reason
covering two faults with nothing in common**, and reading it back out loud got Flare Blitz — a
100%-accurate move — described as inaccurate.

| | pairs dropped | what it actually was |
|---|---|---|
| **A. the move CAN MISS** | 647 over seven accuracy tiers | Play Rough, Rock Slide, Megahorn, Power Whip, Triple Axel, High Horsepower |
| **B. the move ALWAYS CONNECTS and carries a chance side effect** | 255 | Flare Blitz's 10% burn, Iron Head's 30% flinch, Ice Punch, Dire Claw — **noise**, not the subject, when the case is Rough Skin against Flare Blitz |

Between them they are the most-clicked physical moves in Reg M-B, so the contact reactors (Rough
Skin, Spiky Shield, Beak Blast, King's Shield, Weak Armor, Toxic Debris, Mummy) were being tested
only with the contact moves nobody clicks.

**THE DICE WERE COUNTED BEFORE THEY WERE FORCED**, which is why the remedy is a filter and a pin
rather than a forcing. Every draw both engines took was tallied, in both arms, for all 717 of the 902
that reach the carrier loop. The result kills the premise: **the pinned die is not a STREAM.**
`pinDice` replaces `prng.random` with a pure function of its arguments, so a differing draw COUNT
between the two arms cannot shift a later draw — position does not enter. There was no stream hazard.

**WHAT THERE WAS INSTEAD WAS A MISALIGNMENT, AND THE DROP WAS HIDING IT.** `random` was pinned to the
MIDDLE of its range and `randomChance` to `num >= den` — a different die. `PRNG.randomChance(n, d)`
*is* `this.random(d) < n` (sim/prng.ts:115), and accuracy is checked as `randomChance(accuracy, 100)`
(sim/battle-actions.ts:738), so:

```
    old pin:   90 >= 100                 -> FALSE   every sub-100 move MISSED in the reference
    medicham2: rng()=0.5, 50 > 90 false  -> HIT     every sub-100 move CONNECTED in ours
```

Two pinned functions and nothing comparing them — and the filter that dropped all 647 such pairs is
what stopped anyone noticing. `tests/test-game-diff.js` now defines both pins as named constants and
**asserts at module load that they are the same die**, against the PRNG's own definition. That check
goes red on the old value at `(90,100)` and `(95,100)`.

**MEASURED, against frozen release `032b4a2979dd`, before a line of this was written:**

| | |
|---|---|
| bucket B staged with the roll left completely alone, OLD pin | 124 live, **123 agree (99.2%)** — the drop was precautionary and wrong |
| bucket A under the OLD pin | **377 of 501 INERT** (the reference simply missed) and **24 of the 95 live ones DISAGREED** for no reason but that miss |
| bucket A under the FIXED pin | 279 live, **268 agree (96.1%)** |
| the **1,675 cases already staged**, run under both pins, case by case | **NOT ONE verdict moved** — 1,027/1,031 either way |
| `playrough -> roughskin` | old pin **INERT** → fixed pin **live/agree**, at q=.25, .50 and .75 alike |
| `powerwhip -> beakblast` | old pin **live/DISAGREE** → fixed pin INERT. The old pin was manufacturing a disagreement |
| `ironhead -> roughskin` | **live/agree under all four conventions** — the flinch roll is noise, exactly as Will said |

**TWO DROPS SURVIVE, NAMED SEPARATELY, AND BOTH ARE ABOUT THE PINNED DIE RATHER THAN ABOUT LUCK:**

- `carrier-misses-the-pinned-median-die: accuracy N <= 50` — **44 pairs** (tiers 30 and 50). At
  exactly 50 the two engines split on a strict-versus-non-strict comparison of the same median
  (medicham2 misses on `50 > acc`, so it HITS at 50; the PRNG's `random(den) < num` MISSES); below
  50 they agree and both miss. Either way the carrier never lands. Refused here, named, rather than
  staged and reported as INERT — **an inert row caused by the harness reads exactly like a mechanic
  that cannot fire.**
- `carrier-reaches-this-key-only-through-a-roll` — **108 pairs**. Derived from the KEY, never from a
  list of names: `moveSecondary` membership *is* "the move has a secondary", and `volatile:flinch` is
  reached by Iron Head *only* through its 30%. If the flag is unconditional (contact, sound, punch,
  bite, physicalMove) the secondary is noise and the pair is staged. **Membership was printed before
  it was wired**, per LESSONS §4: 34 `moveSecondary` + 12 `volatile:flinch` + 1 `volatile:confusion`
  in bucket B and 53 more in bucket A, and **all 47 measured bucket-B members came back INERT, 47 of
  47** — which is what "cannot express itself" looks like from outside. It keeps the flinch class's
  real coverage gap visible (**Inner Focus and Steadfast have no 100%-flinch carrier to test them
  with**) instead of dissolving it into the INERT count.

**Will's collision rule was asked for and the measurement says the set is EMPTY, so it is not
shipped.** The proposal was to drop a bucket-B pair when the carrier's own secondary collides with
the reactor's effect. **No staged carrier has a secondary above 50%** — the maximum across all 216 is
exactly 50 — so at the pinned median not one of them fires, and a collision cannot occur. Shipping a
guard that can never fire is a silent default with extra steps. The rule that replaced it is the one
above, which is the same question asked from the other side: not *does the secondary collide* but
*is the secondary the only reason this pair exists*.

**WHAT IT COSTS AND WHAT IT BUYS**, at `--full`, dry-run against `032b4a2979dd` (the artifact is NOT
republished here — the other ENGINE agent was editing medicham2, and a full pass against a moving
engine is void):

| | before | after |
|---|---|---|
| staged | 1,675 | **2,272** |
| LIVE | 1,031 | **1,428** |
| agree | 1,027 (99.6%) | **1,412 (98.9%)** |
| disagreements | 4 | **16** — the same 4, plus **12 newly reachable** |

**Reconciliation still balances and `--selftest-reconcile` still passes.** Every pair that stopped
being dropped became a STAGED pair; none vanished.

**THE TWELVE NEW DISAGREEMENTS, all on carriers nobody could previously test**, filed here rather
than fixed (this pass owns the matrix, not the simulator):

| carrier | reactors | what parts |
|---|---|---|
| `stoneaxe` (62 uses) | roughskin, wanderingspirit, mummy, beakblast, toxicdebris, weakarmor — 6 rows | `.B.hazards.stealthrock medi=null sd=1` — **its 100% Stealth Rock secondary is absent**; only reachable because the move is 90% accurate |
| `scaleshot` (151) | toxicdebris, weakarmor | `.boosts.def medi=0 sd=-1`, `.boosts.spe medi=0 sd=+1` — WIRE 81 wired `secondaries[].self`; Scale Shot's boosts live in the move's own `self` |
| `gigaimpact` (34), `rockwrecker` (2) | spikyshield, bulletproof | `vol medi=["mustrecharge"] sd=[]` — a move BLOCKED or made immune still charged medicham2 with the recharge |
| `supercellslam` (81) | kingsshield | `.A.active[0].hurt medi=false sd=true` — **crash damage on a blocked move** |
| `bugbuzz` (55) | throatchop | `.B.hurt medi=true sd=false` — a sound move silenced on the same turn. **The one row whose verdict was NOT stable across quantiles** (it agrees at q=.25), so it is filed as *possibly the harness* and needs its own look |

**Static and Flame Body are still out, and that is a different bucket.** They fall under
`reactor-is-a-die` (their own effect is a percentage), which this pass did not touch and did not
double-count.

**THE FIVE OUTCOME ROWS SUM TO `emitted`, AND THEY DID NOT BEFORE 3.42.0.** `saturated` did not
exclude a case that had THROWN and `ko_timing` excluded nothing at all, so four cases sat in two rows
each and the column summed to 1,679 against 1,675 run. `tests/test-interaction-matrix.js` now
classifies once, in a stated precedence, and throws if the five do not partition the run.

**THE GENERATOR ASSERTS ITS OWN ARITHMETIC.** `theoretical = staged + dropped`, checked per axis and,
on the flag axis, per `(key, reactor)` — where N is known exactly, so the throw names the reactor
instead of reporting a gap somewhere in 8,000 pairs. Three faults on its first run: the denominator
read `tags.linkage` while the generator staged against `LINKAGE` (= the artifact's keys MERGED with
this file's supplementary ones), understating it by 170; the type axis incremented its carrier index
*before* testing the depth cap, so each of 32 firings lost the very carrier it broke on; and the
outcome rows above. `node tests/interaction_matrix.js --selftest-reconcile` mis-costs one drop by one
pair and requires the identity to stop the run — because the header claimed the assertion fired while
`reconcile()` was defined and never called.

**EVERY DROP IS NAMED AND COUNTED AND PRINTED ON EVERY RUN.** A silent cap reads as "covered
everything", which is this project's signature failure. The largest buckets are `carrier-does-not-aim-
at-a-foe` (400 — self- and side-targeting moves), `no-control-carrier` (192), `no-user` (158+47),
`reactor-not-in-format` (Iron Barbs, Tangling Hair, Lingering Aroma and Perish Body have **zero**
species in Champions), `holder-immune-by-chart`, and `layer-unclassified`.

*(`carrier-is-a-die` was the second-largest at 662 and **no longer exists**. It named two unrelated
faults at once and 750 of its 902 pairs were being dropped for a hazard that was not there; what
replaced it is `carrier-misses-the-pinned-median-die` (44) and
`carrier-reaches-this-key-only-through-a-roll` (108). See the section above for the measurement.)*

**FOUR THINGS A GENERATED CASE MUST KNOW, and the previous sampled version (82 pairs) got each wrong.**

1. **WHICH SIDE THE REACTOR STANDS ON.** `linkage.contact.abilities` holds Rough Skin AND Tough Claws.
   The sampled matrix staged every reactor on the DEFENDER, so Tough Claws, Long Reach, Unseen Fist,
   Iron Fist, Sharpness, Strong Jaw, Punk Rock and Poison Touch were all cases in which the mechanic
   could not fire — **and every one of them read as agreement.** The side is derived from the reactor's
   own tags and a reactor whose tags do not decide it is dropped as `side-unknown`.
2. **WHICH RESOLUTION LAYER IT TESTS**, from docs/TAGS.md's own table. The layer decides the
   EVALUATOR, and that is not bookkeeping: the state comparator is blind to the DAMAGE layer by
   construction, so a `halvesTypeDamage` case handed to it comes back INERT forever and looks covered.
3. **WHETHER THE PAIR CAN ACTUALLY MEET**, answered by the REFERENCE engine rather than by us. Every
   case is played **four** times — with the reactor and without it, in each engine. If Showdown's two
   arms are identical the case is INERT and is never counted as agreement. *Identical results across a
   varied knob mean the knob is unwired* — applied to the HARNESS as well as to the engine.
4. **WHAT WAS DROPPED.** See above.

**THE MULTI-TURN HALF IS GENERATED TOO, and the answer to "can the matrix drive it" is YES for the
FIELD.** A pair cannot reach a sequence, but the persistent field effects cross-product **with each
other**: `setsWeather`, `setsTerrain`, `reversesSpeed` (Trick Room), `doublesSideSpeed` (Tailwind) and
`halvesDamage` (the screens) are all derived from tags that mean *"this outlives the turn it was
clicked on"*. Each of the 156 ordered pairs becomes an **eight-turn script** — A lands on turn 1, B on
turn 3, everything idles to expiry — and every counter is compared at every turn. That is literally
*"Trick Room was up and then a Tailwind landed"*, generated rather than typed. **156 of 156 now agree**;
it was 30 of 156 when it was first run.

**FOUR THINGS THE HARNESS GOT WRONG BEFORE THE ENGINE DID, and each is written into the code:**
- **Protect has EIGHT PP.** A nine-turn field script ran every idle body out and made it STRUGGLE on
  turn 9 — three bodies suddenly damaged in 126 of 156 cases, an 80% "divergence" rate that was
  entirely the harness. Eight turns still covers every expiry in the set.
- **Sturdy on the bulkiest Fighting-weak body.** `closecombat -> chopleberry` read a damage ratio of 56.7%
  against a true 50% because the control arm's overkill was stopped at 1 HP by **Bastiodon's slot-0
  ability**, so the "full damage" the ratio divided by was not the full damage. Every body that is not
  the one under test now gets an inert control ability and no item — `bare()` applied to a generator.
- **A body that faints is REPLACED at full HP**, so a lethal hit reads as a loss of ZERO. Strong Jaw's
  x1.5 came back as a ratio of 0.000, which looks exactly like a boost wired backwards.
- **`stripIdentity` deleted its own evidence.** Blanking `ability` on all four slots for the inertness
  test removed the ONLY witness Mummy and Wandering Spirit have. Only the body under test is stripped.

**WHAT IT FOUND — ten wires, and not one was reachable from a single-mechanic probe.**

| # | found as | the bug | wire |
|---|---|---|---|
| 1 | 24 of 156 field cases at once | **Grassy Terrain never set a terrain.** It carries `perTurnHP` for the terrain's own heal and that branch sits above the terrain branch in `playerAction`, so the one terrain move that also heals was the one the engine could not set — and the other three worked, which is why nothing noticed | **72** |
| 2 | the residue of #1 | **Grassy Terrain's 1/16 heal**, derived from the terrain move's own tag | **73** |
| 3 | `sandstorm + grassyterrain`, the last pair standing | **the sandstorm chipped on the turn it expired** — five ticks where the official engine deals four. Visible ONLY as a pair, because the grassy heal is exactly the 1/16 the sand takes, so the two cancel and the extra tick is the only HP left on the table. **The counter was never wrong**, which is why nothing had caught it | **74** |
| 4 | `psychicnoise -> liquidvoice`, ratio medi **1.000** vs sd 0.375 | **`convertsMoveType.converts` names either a TYPE or a FLAG** and only the type half was read, so **Liquid Voice** (346 uses) was completely inert | **75** |
| 5 | `psychicnoise -> soundproof` | **`immuneToMoveClass` had one consumer per stage-3 mechanism instead of one per STAGE.** A Soundproof body took zero damage and still got two turns of Heal Block. docs/TAGS.md already says *"an immune target takes nothing — not the damage, and not the secondary"* | **76** |
| 6 | `roar -> throatchop` | **the Throat Chop silence was checked in the ATTACK branch and in `chooseAction`** — one class of action out of a dozen. Roar is a sound move that resolves down the `phaze` branch, so a silenced body phazed anyway | **77** |
| 7 | census row, not the matrix | **Air Lock / Cloud Nine.** See below — the "no artifact to wire from" verdict was wrong | **78** |
| 8 | `strengthsap -> suckerpunch`, medi's own arms identical | **`statChangeInCode` with `on:'target'` had a READER and no CLASSIFIER.** WIRE 67 put the reader inside the pivot branch because Parting Shot was the case it was written for, so **Strength Sap (637 uses)** resolved to `kind:'pass'` — a wasted turn | **79** |
| 9 | 12 cases at once | **Mummy and Wandering Spirit.** Both grounds for filing them retired — see below | **80** |
| 10 | 23 cases at once, at `--full` | **the secondary that boosts the USER.** The block read `status`, `targetBoosts` and the flinch and never `selfBoosts`, so Trailblaze, Aqua Step, Flame Charge, Rapid Spin, Torch Song, Aura Wheel and Psyshield Bash landed their damage and left the user's stages alone. **12 moves, 1,199 corpus uses** | **81** |

**DEPTH IS A KNOB AND THE DEFAULT IS NOT THE WHOLE MATRIX.** `--depth=N` takes the N most-clicked
carriers per (key, reactor); `--full` takes all of them and the drop ledger counts what a depth cap
excluded under `depth-cap`. Every number above is `--full`. **Depth matters**: three of the ten wires
above are invisible below depth 6, and WIRE 81 needed `--full`.

## What is left, and why each one is left

*(2026-08-05: the three bullets that used to live here all landed and their census probes carry them —
the variable-power family as WIRE 83 (`variablePowerAbsolute`, `speedRatioPower`, `hpScaledPower`),
Beak Blast as WIRE 82 (`preTurnShield`), and the drain/toll order as WIRE 87 (`drainThenPunishOrder`).
What is left after the Layer 0 pass:)*

- **`skillswap -> prankster`, the one remaining matrix disagreement.** Consumer wired (WIRE 110),
  `swapsAbilities` derivation written and membership-verified (exactly one move); blocked ONLY on the
  staged tag_dex regeneration, which may not run beside MEASURE's refit.
- **The staged regeneration batch** — see THE LAYER 0 PASS below for the full list.
- **The two Curse THREW rows** are the harness (`battle.choose` rejects a targeted Curse from a
  non-Ghost); named on every run, not the engine.

## THE LAYER 0 PASS — wires 90–112, 2026-08-05

Census **181 → 201 live / 186 → 205 probed**, nothing fell. Matrix **999/1,012 → 1,011/1,012** at
`--full`, denominator unshrunk. `data/tag-consumption.json` DEAD **61 → 40** (the ratchet fell, 21
tags moved to LIVE). Every new probe was demonstrated RED on a known-bad engine by
**`tests/probe_red_demo.js`** — the mechanism is `TAGS.__setDB` (built this pass as Layer 2's
injection point, with the derived-set rebuild hook the amendment requires): each probe's core
assertion runs against the shipped artifact (must hold) and against the artifact with the consumed
tag stripped (must fail), 26 demonstrations, 26 flips. One demo was wrong before the engine was —
it staged the Intimidate entry drop with `{seeded:true}`, the flag that exists precisely to SKIP
entry effects.

### The 13 matrix disagreements, dispositions

| rows | case | disposition |
|---|---|---|
| 2 | `flipturn/uturn -> toxicdebris` | **FIXED, WIRE 90.** Toxic Spikes and Sticky Web now resolve on entry. The declared blocker ("grounded-ness is not tracked") was a claim about a field nobody had derived — Flying is on `types`, Levitate on `ability`, Air Balloon on `item`. Poison-type absorb included; Sticky Web's drop rides applyStatDrop so Defiant retaliates. Spikes gained the same grounded test (a Levitate body walks over them) |
| 3 | `decorate -> goodasgold / suckerpunch / upperhand` | **FIXED, WIRE 106.** playerAction dropped the caller's TARGET for `boostsTarget` moves, so a foe-aimed Decorate boosted the ally. The foe path passes the standard status gates; Good as Gold refuses via the already-live `refusesStatusMoves` |
| 2 | `trick/switcheroo -> quickclaw` | **FIXED, WIRE 107.** `takesTargetItem {swaps:true}` executes the swap (Corrosive Gas's `removes` too). A `megaStone`-tagged item refuses to move — the artifact's own shape. Sticky Hold remains undescribed by any tag and is stated at the site |
| 2 | `trickortreat -> suckerpunch / upperhand` | **FIXED, WIRE 108.** `changesTargetType` was fully wirable with NO tag_dex change: the written type is the MOVE'S OWN TYPE for all four members (Trick-or-Treat/Ghost, Forest's Curse/Grass, Soak/Water, Magic Powder/Psychic) |
| 2 | `whirlwind -> suckerpunch / upperhand` | **FIXED, WIRE 102, and the fix is making the engine HONESTLY RANDOM.** Showdown's dragIn is `this.sample(possibleSwitches)`; medicham2 always took bench[0], a policy difference reading as a rule divergence under pinned dice. The drag now rolls the battle rng uniformly over the live bench — probed by varying the die and demanding the arrival move with it |
| 1 | `infestation -> beakblast` | **FIXED, WIRE 105.** Reproduced first: Beak Blast KO'd the trapper in BOTH engines and only medicham2 kept the partial trap chipping. `_trap` now records its trapper and dies with it (Showdown's own onUpdate rule). The probe controls on the trapper-alive arm still chipping |
| 1 | `skillswap -> prankster` | **STAGED, WIRE 110.** No usable tag existed. `swapsAbilities` derivation written in tag_dex — exact, not heuristic: Skill Swap's handler is the same `this.skillSwap()` call WIRE 80 reads off Wandering Spirit, and Worry Seed / Entrainment / Role Play / Simple Beam / Doodle use one-directional `setAbility` and are excluded. Membership printed: exactly one move. Consumer live; flips at regeneration |

### The 26 orphan ability/item tags, triaged

19 ability + 4 item + 3 mixed, per docs/TAG-COVERAGE.md §3. **(a)** = was covered by name, consumer
now reads the artifact by shape; **(b)** = genuinely missing, wired; **(c)** = redundant, survivor
named, tag_dex change staged; **(d)** = blocked or declared, reason stated.

| tag | uses | verdict |
|---|---|---|
| `megaStone` | 29,790 | **(a) WIRE 111.** "Is this a stone" was a `/ite[xy]?$/` name-shape regex in `megaAbility` and `buildMonFromSet`; both now ask the tag first (regex kept as OR-fallback because the X/Y forme SUFFIX genuinely lives in the item name). The stone-stats artifact stays MEGA_FORMES — richer than the tag and shared with the canonical engine |
| `damageBoost` | 12,085 | **(d) DECLARED.** 44 carriers whose conditions the params do not carry (Blaze `onlyWhen:"only below 1/3 HP"` is prose; Rivalry needs gender the engine lacks; Slow Start needs a turn clock). Guts stays name-wired; wiring the family's bare `mult` would fire Blaze at full HP. Needs a derivation pass of its own — the WIRE 83 shape, not started inside this dispatch |
| `onSwitchInDrop` | 10,415 | **(a) WIRE 100a + STAGED enrichment.** Membership from the tag (`applyEntryDrops`), amounts typed for Intimidate until the enrichment lands. The enrichment also caught the derivation OVER-MATCHING (Lesson §4): **Download carried it** — its onStart boosts ITSELF off the foes' defences. The enriched derivation reads the literal drop table and Download falls out. Supersweet Syrup's evasion drop skips honestly (no evasion slot) |
| `boostsWhenLowered` | 7,965 | **(a) WIRE 100 + STAGED enrichment, and the ARITHMETIC WAS WRONG.** Verified against the official handlers: the drop LANDS, then the +2 fires. Intimidate into Defiant is net **+1** (engine said +2); into Competitive it is **Atk −1 AND SpA +2** (engine skipped the drop). Probed. Enrichment emits the boost tables read from the handlers |
| `priorityMod` | 7,958 | **(a) WIRE 93.** Prankster's literal in the priority sort now reads the tag (`movesOfClass:'status'`) — and **Gale Wings had no consumer at all**: a TYPE-valued `movesOfClass` now shifts attacks of that type, the 'only at full HP' condition string is evaluated, any OTHER condition fails closed and is counted (`fails.priorityModUnknownCond`). The Prankster/Dark immunity stays in pranksterBlocked — it is Prankster-specific in the real engine too |
| `contactPunish` | 6,829 | **(c) REDUNDANT — survivor `punishesAttacker`.** Verified: every carrier also carries punishesAttacker, whose params are a strict superset and are what the consumer reads. Both tag_dex entries (item: banned Rocky Helmet; ability) retired, STAGED |
| `speedMult` | 6,141 | **(a) WIRE 91.** `effSpeed`'s `==='choicescarf'` literal now reads `speedMult.mult` |
| `stabBoost` | 4,468 | **(a) WIRE 95.** The `==='adaptability'?2:1.5` literal now reads `stabBoost.stab`; the 1.5 base stays typed as the game's constant |
| `speedCond` | 3,564 | **(a) WIRE 91, weather members; (d) the rest.** Swift Swim / Chlorophyll / Sand Rush / Slush Rush read `{inWeather, speedMult}` through weatherId. Quick Feet, Surge Surfer and Slow Start carry `inWeather: []` — their real conditions (status / terrain / turn clock) are not in the params, so they are REFUSED and counted (`fails.speedCondUnconditional`) rather than given an unconditional multiplier; enrichment staged |
| `blocksStatusMoves` | 2,539 | **(c) REDUNDANT AND WRONG — survivor `refusesStatusMoves`.** Good as Gold's refusal is already consumed at five sites; the orphan's derivation ALSO matched Telepathy (blocks ally spread damage, not status) and Wonder Guard (allows status) — the exact over-match pair refusesStatusMoves was tightened against. Derivation retired, STAGED |
| `accuracyMod` | 2,537 | **(d) BLOCKED** on the `moveAccuracy(id, field)` signature — confirmed excluded by the dispatch, wording in the missing table above re-confirmed current |
| `writesAccuracy` | 1,073 | **(d) BLOCKED**, same signature |
| `randomBoostEachTurn` | 515 | **(c)/(d) derivation over-matched, fix STAGED.** Matched any random onResidual, catching **Healer** (cures ally status) and **Harvest** (regrows a berry). Tightened to require the boost call: membership is exactly Moody. Moody's consumer deliberately not written — the tag's own text says it belongs in forecast variance, not in a feature |
| `statusImmune` | 430 | **(d) DECLARED.** `{immune:true}` names no status — wiring by shape would make Leaf Guard block everything always. The hand table (STATUS_IMMUNE_ABIL) is currently RICHER than the artifact; enrichment (which statuses, from onSetStatus) is future tag_dex work, noted, not staged in code this pass. **2026-08-05: the declaration held and the table was still INCOMPLETE — Purifying Salt was in none of its six lists. WIRE 114. The verdict was right about the artifact and said nothing about whether the richer table was correct, which is the gap that let a legal, played ability be missing entirely** |
| `invertsBoosts` | 193 | **(a) WIRE 100b.** Seven `==='contrary'` literals replaced by one `invSign()` reading the tag |
| `removesOwnSecondaries` | 161 | **(b) WIRE 97.** The suppression half was name-wired (`mAb==='sheerforce'`, now the tag); the **x1.3 was absent entirely** — a Sheer Force body lost its secondaries and got nothing, strictly worse than no ability. Damage half wired on moves that HAVE a secondary; Life Orb recoil skipped on boosted moves (the real interaction) |
| `addsFlinch` | 83 | **(b) WIRE 103.** King's Rock: 10% flinch on damaging moves without a flinch of their own (the handler's gate, reproduced), inside the same Shield Dust / Sheer Force suppression, same actedAt / Inner Focus bookkeeping |
| `fractionalPriority` | 78 | **(b) WIRE 101.** Quick Claw: rolled once per holder per turn BEFORE the sort (a comparator roll would re-draw), rng consumed only when the item carries the tag so seeded probes keep their stream |
| `critDamageUp` | 43 | **(b) WIRE 96.** Sniper x1.5 on the crit, at both crit sites (dmgRange's certain path, the battle loop's rolled path) |
| `ignoresStatStages` | 2,445 | **(b) ability half / (c) move half.** Unaware wired in dmgRange, both directions, Mold Breaker punches through. The MOVE half (Darkest Lariat, Sacred Sword) has been live all along under `ignoresBoosts` — a redundant second spelling; move-side derivation retired, STAGED |
| `preventsSwitch` | 0* | **(b) WIRE 92 + STAGED enrichment.** *Sheet count lies by Lesson 3: Shadow Tag is Gengar-Mega. A voluntary switch is refused while a live foe carries the tag; Ghost types and same-tag holders exempt (shape reads); `onlyTypes` (Magnet Pull/Steel) and `onlyGrounded` (Arena Trap) derived from the handlers, honoured when the regeneration lands — until then those two carriers, zero corpus presence, over-trap, stated at the site. **2026-08-05: the regeneration ran, the params are read, and the comment saying otherwise survived it and was corrected. This tag is the ABILITY half only; the MOVE half was absent entirely — WIRE 116** |
| `boostsOnKO` | 0* | **(b) WIRE 104.** Eelevate (Eelektross-Mega — Lesson 3 again) and Beast Boost: +1 to the killer's highest raw stat, from the tag's own params |
| `privateWeather` | 0* | **(b) WIRE 99.** Mega Sol (Meganium's mega): the holder's own damage formula reads a sun the field never reports, through `effWeatherOf` — precisely the consumer shape the tag's own text demands ("ask what weather THIS mon sees") |
| `hitsTwice` | 0* | **(b) WIRE 98.** Parental Bond (Kangaskhanite, 217 stone uses): x1.25 on single-target damaging moves, not on spread, not on multi-hit |
| `auraBoost` | 0 | **(d) DECLARED, 0 exposure.** Dark/Fairy Aura carriers (Yveltal/Xerneas) are not in the format; Floette-Mega's fairyaura is in MEGA_ABIL but has no corpus presence. Left DEAD; the ratchet permits it |
| `untagged` | 5,172 | **not one mechanic — the explicit placeholder bucket** (61 carriers). Its named member with a census row, Marvel Scale, is STAGED (WIRE 112/`condStatMult`); Shield Dust and Magic Guard remain name-checked/counted and say so in place |

### Staged tag_dex changes — the regeneration this dispatch may NOT run

All code landed in `engine/tag_dex.js`; `data/tags.json` untouched. Every membership was printed
against the format dex BEFORE staging (the scratch replication run, LESSONS §4):

1. **`swapsAbilities` NEW** — matches exactly `skillswap`
2. **`condStatMult` NEW** — matches exactly `marvelscale {stat:'def', mult:1.5, when:'statused'}`; defensive stats only, on purpose (the offensive twin is Guts, already served)
3. **`contactPunish` retired** (both entries) — survivor `punishesAttacker`
4. **`blocksStatusMoves` retired** — survivor `refusesStatusMoves`
5. **move-side `ignoresStatStages` retired** — survivor `ignoresBoosts`
6. **`randomBoostEachTurn` tightened** — membership Moody alone (was + Healer, Harvest)
7. **`onSwitchInDrop` enriched and tightened** — `{boosts:{atk:-1}}` etc.; **Download falls out**
8. **`boostsWhenLowered` enriched** — `{boosts:{atk:2}}` / `{boosts:{spa:2}}`
9. **`preventsSwitch` enriched** — `onlyTypes:['Steel']` (Magnet Pull), `onlyGrounded` (Arena Trap)

After the regeneration runs (single-writer moment): the diff must be verified entry-by-entry
excluding `uses`, `skillswap -> prankster` should fall out of the matrix's parting list, the census's
Marvel Scale row flips LIVE, and `feature_fixture --check` decides whether a refit is owed.

**2026-08-05, later: items 1–9 RAN at the coordinator's single-writer moment and landed clean**
(census 202/205, matrix 899/899, DEAD 38, `feature_fixture --check` green on both vectors) — **and
the first consumer-day of `invertsBoosts` exposed a TENTH staged item, WIRE 113.** The derivation
`a.onChangeBoost ? {inverts:true}` had always over-tagged **Simple** (whose handler is
`boost[i] *= 2` — it DOUBLES) and **Ripen** (berry boosts only) beside Contrary; harmless while the
tag was DEAD, live the moment WIRE 100b read it by shape: Intimidate into Simple read **+1** against
the official engine's **−2** (verified by real battle at the pinned commit, all five reactor rows).
`tests/test-rollout-effects.js` caught it the same day — three of its four failures were the OLD
wrong retaliation model and were re-pinned to the official table; the Simple row was TRUE and was
not re-pinned, the engine was fixed. Staged now: `invertsBoosts` derives only from `*= -1` (membership:
exactly contrary), new **`amplifiesBoosts {mult:2}`** (exactly simple, Ripen excluded by its
`isBerry` gate). The consumer bridge (`_NOT_INVERTERS` in `invSign`, the `ab==='simple'` fallback in
`applyStatDrop`) makes the engine produce the official numbers with the artifact as shipped and goes
structurally dead when the regeneration lands.

**AN ELEVENTH STAGED ITEM, WIRE 117.** `priorityMove`'s linkage test broadened from `move.priority > 0`
to Showdown's two real idioms, adding **three reactor MOVES** (`psychicterrain`, `quickguard`,
`upperhand`) and changing the ability side not at all. Membership printed above. It is what lets the
interaction matrix stage a Psychic-Terrain-against-priority case for the first time; the engine fix
itself does not depend on it, and the census probe carries the mechanic today.

## Hand list — found by differential testing, not yet probed

**EMPTY except for Rivalry, and Rivalry has never been probeable.** Everything else that was on this
list has become a probe and the census now carries it. That is the list doing its job.

**AND A THIRD LIST EMPTIED ITSELF INTO THE CENSUS ON 2026-08-07 (ROADMAP #92).** The damage-stage
audit's open items were never on THIS list — they were on the register, because a stage error is not
something a differential can name — but they now carry the same guarantee: the four FIELD terrain
multipliers and the narrowed `damageBoost` family are census probes (`move|setsTerrain` ×4,
`ability|damageBoost`), and everything else in `docs/DAMAGE-STAGES.md` is held by
`tests/test-damage-stages.js` against the authority at exact equality. **Do not re-add any of them
here.** The four things that class left unfixed are named in the ROADMAP #92 section above with their
reasons — Charge has no volatile to read, `terrainScaled` carries no grounded subject, Rivalry has no
gender, and the artifact stores 1.3 as a float. Rivalry is the only one of the four that belongs on
this list, and it is already on it.

**AND IT HAS A SUCCESSOR THAT CANNOT GO STALE, 2026-08-06.** A hand list is prose, and prose cannot
track a corpus — the same reason `docs/HANDOFF-*.md` are history. The open-work list is now DERIVED:
`node tests/test-medicham-coverage.js` prints, every run, the tags carried by the 99%-of-usage set
that have **no probe at all** (17 today, led by `move|accuracyMod` at 5,986 uses and
`ability|auraBoost` at 5,620), the abilities and items the artifact derived **no mechanic** for (12),
and the usage-weighted coverage beside the count. Work the list below; then work that one, because it
re-derives itself when the metagame moves and this section does not.

**AND A SECOND DERIVED LIST LANDED 2026-08-06:** `data/game-differential.json`'s `classes` block. The
coverage list above says which mechanics have NO PROBE; that one says which mechanics have a probe and
still resolve differently from the authority IN A REAL GAME. **Eleven classes** over 346 games today
(2026-08-07, with the megas in and ROADMAP #81 WIREs 1-6 landed), each with its count and its distinct
causes, and each cause carrying `mentions` so a class can be sorted by the corpus usage it actually
reaches rather than by how many games happened to hit it. Regenerated by
`node engine/game_differential.js --write`. Neither list is typed and neither can go stale, which is
the whole reason the section below is nine lines long — and the count moving from nineteen to eleven
is the artifact doing exactly that, not a claim anybody typed twice.

- **Rivalry** — x1.25 into the same gender, x0.75 into the opposite, x1.0 if either is genderless.
  Wholly absent. Blocked on data, not on will: `MC.mons` carries no gender and `buildMon` returns
  none, and `data/engine-data.js` belongs to MEASURE. Its `damageBoost` tag carries a bare
  `mult:1.25` with **no condition field at all** and 43 other members, so it cannot be wired from the
  artifact as it stands. *(This sentence used to say "including Blaze 1.5" — ROADMAP #112 made Blaze's
  condition machine-readable and Blaze is now wired, so the example was retired rather than left to
  age. Rivalry's problem was never the neighbours: it is that `onlyWhen` is `null` for it, which means
  "unconditional", and gender is not in `MC.mons` to derive one from.)* The differential can no longer see it either:
  CONTROL FIX 6 sets `gender:'N'` on both sides, because `gender:''` made Showdown roll one off the
  battle seed and MEDICHAM has none — a seed-dependent x0.75 nothing could match.

## THE THIRD INSTRUMENT — `tests/test-game-diff.js`, built 2026-08-04

Will: *"yeah we def need interactions thats the whole point and multi turn things like tailwind and
trick room."* Neither existing instrument can reach that, and the reason is structural rather than an
omission:

| instrument | what it asks | what it structurally cannot see |
|---|---|---|
| `test-mechanics.js` | is ONE mechanic live | tag x tag. 176 tags individually verified says nothing about any pair |
| `test-engine-diff.js` | is this ONE HIT's damage right | every turn counter — Tailwind expiring, Trick Room toggling, a screen running out, an Encore ending |
| **`test-game-diff.js`** | **do the two engines hold the same STATE after every turn** | damage magnitude (that is the file above), and everything in its own `NOT_COMPARED` |

It plays a fixed action script in `medicham2-browser.js` and in the official pinned Showdown engine,
compares a dice-independent projection of the whole state after every turn, and reports the **first**
turn they part. Artifact: `data/game-diff.json`.

**TWO MODES, AND THE SPLIT IS THE POINT.** `--pairs` GENERATES its cases from the tag artifact — the
cross product of a linkage key's carrier moves against its reactor abilities — and never authors an
expected outcome, because the official engine supplies it. That is the half that makes it safe: every
one of the roughly twenty-three wrong probes this project has produced was a human writing down what
should happen. A cross product can never reach a SEQUENCE, though, so the scripted multi-turn games
are the other half. Neither substitutes for the other, and it is written in those words because the
next person will otherwise try to make one do both.

**IT DEPENDED ON PRIORITIES #44 AND THAT IS WHY #44 LANDED FIRST.** `reactorsTo('contact').moves`
returned 152 moves that CARRY contact — Fake Out, Close Combat, Flare Blitz. Those are attackers. The
moves that actually REACT — Spiky Shield, Baneful Bunker, King's Shield — were not in the index at
all. `tag_dex.js` now emits `carrierMoves` and `reactorMoves` separately, the reactor side derived by
the SAME handler probe the abilities and items use, and `moves` is GONE rather than aliased: an alias
keeps every existing misreading working silently.

**WHAT IT DOES NOT COMPARE is printed on every run** and is the honest half: HP amounts (the two
engines roll their own dice), accuracy misses, chance secondaries, crit, a reactor whose effect is a
roll, a KO the two engines time differently (a DAMAGE question, which belongs to `test-engine-diff`),
the `protect` volatile (both have it and clear it at different points in the turn), Showdown-only
volatiles, and PP. Stat VALUES are **aligned** rather than excluded, and that is a control that has to
hold: unaligned, the two engines disagree about SPEED ORDER and about who survives a hit, and both
read as rule divergences.

**THE INJECTED-DIVERGENCE PROOF RUNS FIRST AND THE FILE REFUSES TO REPORT WITHOUT IT.** One extra turn
of Tailwind is planted on turn 2 of a clean game; the comparator must catch it, at turn 2, on
`.field.tailwindA`. A silent zero is a broken comparator, not a clean engine.

### What it found, in order

| # | found by | divergence | verdict |
|---|---|---|---|
| 1 | scripted game 3 | `weatherTurns medi=4 sd=3` on turn 2 | **REAL.** A weather move clicked into its OWN weather REFRESHED the clock; Showdown fails it. **WIRE 64**, weather and terrain together |
| 2 | pair matrix | `closecombat -> anything`: `boosts.def medi=-1 sd=0`, six pairs at once | **REAL.** A move blocked by Protect still paid its self-drop. **WIRE 65** |
| 3 | pair matrix | `partingshot -> soundproof`: medi switched, Showdown did not | **REAL, two bugs.** A blocked Parting Shot still pivoted (WIRE 65), and `immuneToMoveClass` lived only in `dmgRange`, so a Soundproof body took a sound STATUS move (**WIRE 66**) |
| 4 | pair matrix | `partingshot -> stancechange`: `boosts.atk medi=0 sd=-1`, three pairs | **REAL.** Parting Shot's −1 Atk / −1 SpA was the documented unmodelled half, 7,184 corpus uses. **WIRE 67**, from a `statChangeInCode` derivation that now reads the literal boost object out of the handler |
| 5 | pair matrix | `fakeout -> toxicdebris`: `hazards.toxicspikes medi=null sd=1` | **REAL.** `punishesAttacker.hazard` had "nowhere to land" until WIRE 41 gave each side an `hz` bag. **WIRE 68** |
| 6 | pair matrix | `roar -> soundproof`: medi phazed a Soundproof body | **REAL.** Roar IS a sound move and WIRE 66 had not reached the phaze branch |
| 7 | pair matrix | `encore -> stancechange`: `vol medi=["encore"] sd=[]` | **REAL.** Encore against a target that has never moved has nothing to repeat. **WIRE 69** |
| 8 | pair matrix | `wavecrash -> mummy` / `-> wanderingspirit` | **REAL AND NOT FIXED.** Contact REWRITES the attacker's ability. Both carry only `contactPunish` and neither has a param for it; **0 corpus sheets between them.** Filed |

**FOUR OF THE TEN "DIVERGENCES" IT REPORTED FIRST WERE THE HARNESS**, and each was fixed rather than
excused: a bench index that meant different bodies in the two engines (trap 1 broken by the harness
itself), an ally target emitted as a positive slot so `battle.choose` silently REJECTED the turn and
froze the reference engine, a `benched` list that counted fainted bodies on one side only, and a
reactor staged with Protect as its only move so the interaction under test could not happen at all.
The last is Lesson 5 in a generator: **ask what the target would do if the mechanic did not exist.**

## WEATHER — THE WHOLE SURFACE, AUDITED AT ONCE. 2026-08-04.

Will: *"Weather is something that is the deciding factor in like every game so we need to get it
bulletproof."* It had been found broken four separate times in one day by four different routes, which
means it was being found by luck. Batch 8 of `tests/test-mechanics.js` probes every path at once, and
every probe in the batch declares its arms.

| path | probe | result |
|---|---|---|
| setting, by move | `setsWeather` | LIVE, unchanged |
| setting, by ability on entry | `weatherSetter` | LIVE, unchanged |
| setting, **by a MEGA's ability** | `megaWeatherSetter` **new** | **LIVE**: base Charizard (Blaze) sets CLEAR, Charizard-Mega-Y (Drought) sets sun |
| **duration and expiry** | `weatherDuration` **new** | **LIVE**: sun on turn 1, still sun after 3 idle turns (Flamethrower 74), CLEAR after 4 (49) |
| **the rocks** | `extendsDuration` **new arm** | **WAS MISSING — WIRE 70.** The tag has carried `toTurns: 8` all along and only the SCREEN branch read it; the weather branch wrote a literal 5, so Heat, Damp, Smooth and Icy Rock were inert on the one mechanic they exist for |
| **the rocks, on the other three routes** | `test-weather-duration.js` **new** | **WIRE 70 WAS ONE BRANCH OF FOUR — WIRE 71.** See below |
| offensive multipliers, **both directions** | `weatherDamageMult` **new** | **LIVE**: Flamethrower clear/sun/rain 56/84/27, Surf 75/37/112 |
| defensive multipliers | `weatherDefenceMult` **new** | **LIVE**: Shadow Ball into a Rock 31 to 21 in sand (into a Water 40 to 40), Earthquake into an Ice 157 to 106 in snow (into a Fire 246 to 246) |
| residual | `weatherChipImmune` | LIVE — sand 1/16, Rock/Ground/Steel and the tag's own immunities exempt, **snow chips nothing** |
| accuracy, **both directions** | `weatherAccuracy` **new** | **LIVE**: Thunder clear 70, rain 100, sun 50 |
| Weather Ball | `weatherBall` **new** | **LIVE**: into a Gengar, clear 0 (Normal is nothing to a Ghost), rain 144, sun 144, sand 96, snow 96 |
| Solar Beam | `chargeSkippedByWeather` | LIVE, unchanged |
| Aurora Veil | `failsWithoutWeather` | LIVE, unchanged |
| weather speed abilities | `speedCond` + `speedCondWrongWeather` **new** | **LIVE with the WRONG-SKY arm**: Swift Swim in rain 135 to 270, **in sun 135** |
| Solar Power | `solarPower` **new** | **LIVE**: in sun Flamethrower 84 to 126, Earthquake 37 to 37, no sun 56 to 56 |
| **Air Lock / Cloud Nine** | `weatherSuppression` | **LANDED — WIRE 78, and the "nothing to wire from" verdict was wrong.** See below |

**TWO PROBES IN THE BATCH WERE WRONG BEFORE THE ENGINE WAS, WHICH MAKES TWENTY-THREE.** The first
Weather Ball probe fired it at a **Garchomp**, which is Dragon/**Ground** — so the sand form (Rock) is
RESISTED, 100 BP at x0.5 is the same number as 50 BP at x1, and `sand 43 vs clear 44` read exactly
like a dead knob. The engine was right and the type chart was doing its job. The first
`megaWeatherSetter` control was a plain **Charizard**, and `buildMon` hands a Pokemon its USAGE item —
which is a Charizardite Y, so the "base forme" arm was already a mega and already set sun. That is the
original Choice Scarf mistake, verbatim, seven months later.

**THE VOCABULARY, GREPPED FOR SURVIVORS.** Three copies of the Showdown-name to engine-word map
remained. `engine/medicham2-browser.js:182` is the canonical one behind the exported `weatherId()`.
Two more sat inside `engine/tag_dex.js`'s `weatherScaled` and `weatherSetter` derivations, were
identical to each other and **not** to the display map twenty lines above them (`hail` was `hail` in
one and `snow` in the others). Both now read one `W2ENGINE`, and regenerating produced no change
beyond the session's intended 35 entries — which confirms the two were already agreeing and the
consolidation is a no-op today and a guarantee next month. `engine/board.js:1190` is the fourth and is
**NOT ENGINE's**: it is a refit trigger (14 of 58 feature columns move) and MEASURE has the patch
measured and deliberately reverted in `docs/MEASURE.md` section 11. Any further board.js weather
defect is filed there, not fixed here.

### WIRE 78 — AIR LOCK AND CLOUD NINE. "No artifact to wire from" was a claim about the DERIVATION.

The previous pass recorded this as MISSING-declared with *"`cloudnine` carries `untagged` and
`airlock` has no artifact entry at all, so there is nothing to wire from."* That was a true statement
about `data/tags.json` and a false one about the dex, and the difference is the whole lesson:

**Showdown does not express weather suppression through a HANDLER. It is a flat property on the
ability object — `suppressWeather: true`.** Every derivation in `tag_dex.js` probes a handler NAME
(`onStart`, `onImmunity`, `onModifySpe`, …), so a property-shaped fact was invisible to all of them,
and the gap read as *not derivable* when it was *not looked for*. `dex.abilities.all().filter(a =>
a.suppressWeather)` returns **exactly two**, `airlock` and `cloudnine`, and Delta Stream carries the
same property set to `false` and is correctly excluded by truthiness. The tags diff, excluding `uses`,
is exactly those two entries.

**IT IS NOT "CLEAR THE WEATHER".** The sky is still raining and the clock still runs; what stops is
every READ. So the suppression is a field flag recomputed at the top of every turn from whoever is
standing there, and it gates: the damage multipliers (via one shadow at the top of `dmgRange`, so
every weather read below it is covered without a gate per site), Weather Ball's type, the weather
accuracies, Solar Power and Orichalcum Pulse, the snow/sand defence bumps, the weather-speed
abilities, the sandstorm chip, the Solar Beam charge skip and Aurora Veil's legality. Clearing it
instead would let a second Drizzle re-set it and would make the Veil's failure look like the absence
of snow rather than its suppression.

**THE EXPOSURE WAS MEASURED BEFORE THE WIRE, because it decides how much machinery this deserves.**
**Air Lock is ZERO** — its only carrier is Rayquaza and Rayquaza is not in this format. Cloud Nine has
**two** carriers that are, **Altaria and Drampa**, and **18 declared sheets across 40,595 stored
games**. Small, derived anyway, because the cost was one derivation block and the alternative was a
census row asserting the engine cannot know.

**A pure `dmgRange` call still cannot see an Air Lock ALLY** — it is handed two bodies — and that is
stated in the code rather than silently equivalent. The battle loop is the only caller that can, and
it is the one that sets the flag.

### WIRE 71 — WIRE 70 FIXED ONE BRANCH OF FOUR, AND THE PROBE COULD NOT SEE THE OTHER THREE

Weather is set **four** ways in this format, and each had its own branch:

| # | route | site | read the rock? |
|---|---|---|---|
| 1 | an ability on switch-in — Drought 899 uses, Drizzle 3,075, Sand Stream 1,716, Snow Warning 1,561 | `medicham2-browser.js:1524` | **no — literal 5** |
| 2 | a MOVE — Sunny Day 588, Rain Dance 919, Sandstorm 10, Snowscape 11 | `:2149` | yes, since WIRE 70 |
| 3 | **MEGA evolution** — Charizard-Y arriving with the stone | `rollout_leaf.js:186` | **no — literal 5** |
| 4 | a punish ability — the Sand Spit class | `:2629` | **no — literal 5** |

So a Torkoal holding a Heat Rock set **five** turns of sun by switching in and **eight** by clicking
Sunny Day. Same held item, same sky, two answers, decided by how it arrived.

**The probe that found WIRE 70 was staged on route 2 and passed on route 2.** It was not a weak probe
— it was a correct probe pointed at one of four bodies that can show the effect, which is the same
shape as the mega bug that ran at 56% of sides against 85% and passed a non-zero check. A tag with
four consumers needs a probe per consumer, or an assertion over the consumers as a set.

This one is the second: `tests/test-weather-duration.js` asserts the **invariant** — for a given sky
and a given item, every route agrees — rather than four separate numbers. A fifth route added
tomorrow that hardcodes 5 fails without anyone remembering to extend a list of four. The duration rule
now lives once, in the exported `weatherTurns(weather, item)`, beside `weatherId`.

**The two vocabularies meet inside it**, and that is why it could not be a one-line read at each site:
`extendsDuration.extends` holds MOVE ids (`sunnyday`), because the rock's rulebook text names the
move, while `weatherSetter.weather` holds ENGINE words (`sun`). WIRE 70's inline version compared the
raw `extends` entry against `a.mv` — correct on the move branch by luck of spelling and silently
never matching on the other three. Both sides now go through `weatherId`, so neither spelling is
authoritative.

**It is a small mechanic that decides whole games.** 14 of 496 declared setters in the store carry the
matching rock — Damp Rock on a Drizzle body is the common one at 6.2%, Heat Rock 2.2%, and neither
Smooth nor Icy Rock appears at all. Three extra turns of rain is most of a game, and the population is
small enough that no aggregate would ever have shown it.

**A one-character bug caught in review, recorded because it is the shape that survives.** The first
cut of the punish branch read `m.item` — but `tg` is the **holder** of the punish ability and `m` is
the attacker who set it off, so Sand Spit would have run for eight turns whenever the mon that hit it
happened to carry a Smooth Rock. Right function, right tag, wrong subject.

**The probe was run against the pre-fix engine and failed 4 of 60**, then passed 60 of 60. A test
written after a fix that is never shown failing is an assertion about the code as it stands.

**And the unit half would not have caught the original bug.** `weatherTurns` returns 8 correctly
whether or not the switch-in branch calls it. `test-weather-duration.js` therefore builds a real
Torkoal, runs the real `applyEntryEffects`, and reads the real field — with a counter asserting the
probe ran 8 times, which is what caught the build failing silently: `buildMon`'s override bag is keyed
by **species** (`{torkoal: 'Heat Rock'}`), so the natural-looking `{item: 'Heat Rock'}` was ignored and
the mon kept its dataset default of Charcoal. Without the counter that is a probe measuring the wrong
item and reporting a pass.

**PRIMORDIAL SEA AND DESOLATE LAND ARE UNIMPLEMENTED BY DECISION, NOT BY OVERSIGHT.** Will,
2026-08-04: *"The primordial and desolate stuff aint in this regulation so just make a note to deal
with that if kyogre gets added."* **0 occurrences in 339,483 boards.** `tag_dex`'s `W2ENGINE` maps
both onto plain rain and sun, which is wrong for the real mechanic — they cannot be replaced and they
nullify the opposing type entirely — and correct for a format that cannot produce them. **The trigger
condition is a primal Kyogre or Groudon entering the format.** Recorded here so a regulation change
surfaces it rather than someone rediscovering it as a bug.

## THE ARMS PROTOCOL — the hollow detector, finished. 2026-08-04.

The previous pass built the structural detector (a probe that READS THE SOURCE) and **costed** the
other half rather than doing it: a probe with ONE arm, whose reading an engine with the mechanic
DELETED would also produce. That is what made the Disable probe a false LIVE for as long as it
existed, and the heuristic beneath it — count LIVE probes whose `detail` carries two equal numbers —
is a heuristic precisely because `detail` is prose and cannot tell an ARM from an annotation.

It is done. A probe may now return `arms: {control, test}`; the harness asserts `control !== test`
structurally, with no parsing and no judgement, and a probe whose arms agree is marked **HOLLOW** and
fails the file exactly as a source grep does.

**THE OPT-IN IS NOT A HOLE, BECAUSE THE OPT-OUT IS RATCHETED.** `unarmed` is written to
`data/mechanics-census.json` and **may fall and may never rise**. A new probe written without arms
fails the file. The existing ones convert at whatever rate a pass can afford — which is the cheapest
version that closes the hole rather than costing a day up front, and it is exactly what the previous
pass's costing asked the next one to decide with the number in front of it.

**Seven were converted in this pass and every one was a genuine one-armed probe**, exactly as the
heuristic said: `lowersUser` (`def -1 spd -1` is also what an engine that dropped the user on EVERY
attack prints — the control is now Brave Bird, which must leave the stages alone), `recharge`,
`statChangeInCode`, `boostsTarget`, `clearsBoosts`, `cantUseTwice`, `statusCategory`. Ten more were
written armed. **The flat-arms heuristic fell 7 to 2, and both survivors are annotations rather than
arms.**

## Filed by the game differential, not fixed

- ~~**Mummy and Wandering Spirit rewrite the ATTACKER's ability on contact.**~~ **LANDED as WIRE 80,
  and BOTH grounds for filing it were wrong.** The filing said (1) *"neither has a param for the
  rewrite, so there is nothing to wire from"* and (2) *"0 corpus sheets between them"*.
  (1) was true of the TAG and false of the DEX: both handlers state the whole rule in one call —
  `source.setAbility("mummy", target)` and `this.skillSwap(source, target)`, both gated on
  `checkMoveMakesContact` — so `tag_dex` now derives `rewritesAbilityOnContact` with a `mode` of
  `infect` or `swap`, matching **exactly three** abilities (the third is Lingering Aroma, 0 uses).
  (2) does not hold on the current store: the artifact's own counts read **mummy 41, wanderingspirit
  58**. It matters more than 99 sheets suggests, because the ability is an INPUT to every later
  number — a Blastoise that walks into a Cofagrigus keeps being priced as a Torrent body for the rest
  of the rollout. That is the Knock Off lesson in CLAUDE.md, one field over.
  **The general lesson: "the artifact cannot express it" is a claim about the DERIVATION, not about
  the dex, and it has now been wrong twice in one session — here and for Air Lock.**
- **A KO the two engines time differently is a DAMAGE question**, and `tests/test-engine-diff.js` owns
  it. One pair (`bitterblade -> sharpness`) is excluded on that basis and COUNTED, never dropped.
- ~~**The `moveAccuracy` table in `medicham2-browser.js` is a hand-typed 35-move literal**~~ **LANDED
  as WIRE 124, and the filing understated it by an order of magnitude.** It was not two missing moves;
  it was **78 of the 500** in this engine's own table, led by Heat Wave at 7,405 clicks. The census now
  carries it (`move neverMisses — "a move the artifact does NOT tag neverMisses can still miss"`) and
  `tests/test-engine-diff.js` re-derives all 500 accuracies against the live format dex on every run.
- **Strength Sap's HEAL is still absent (WIRE 79 landed only the Attack drop)**, and the receipt for it
  moved: the move used to be counted in `fails.healProcedural` because it resolved to `kind:'heal'`
  with `heal: true`, and it now resolves to `affect`, so that counter no longer sees it. The heal
  scales off the TARGET's Attack and no artifact this engine reads carries it. Recorded here because a
  counter that quietly went down is exactly the shape this file exists to stop.
- **Shed Shell does not release a body from ABILITY trapping (WIRE 116 landed it only on the MOVE
  branch).** The item lets its holder out of Shadow Tag, Magnet Pull and Arena Trap in the real game.
  The ability branch was scoped out of the 2026-08-05 dispatch as correct-and-untouched, and the
  exposure is zero today. Declared at the site, one line above the branch.
- **ENGINE's own number is restated in two documents ENGINE does not own, and the scope pass staled
  both.** `docs/ADR-002-showdown-is-the-authority.md:52` and `docs/MODELS.md:265` both read
  **"202 / 205 live"**; the artifact now reads **208 / 211**. `tests/test-docs-current.js` catches it
  (4 of the 25 new `citation_mismatches` entries) and was **already red on arrival** — the other 21
  cite `policy-weights.json` and figures quoted from ADR-001, none of which this pass touched. Two
  line edits, outside the 2026-08-05 dispatch's file scope, so filed rather than made. **This is the
  standing hazard of a census that may only rise: every document that quotes it goes stale on a good
  day.** The generated block at the top of this file is the only copy that cannot.
- **Two ratchets are RED on arrival and neither flags a file ENGINE owns**, re-confirmed 2026-08-05:
  `test-effective-identity` fails on **`engine/click_class.js: 0 -> 2`**,
  and `test-no-silent-failure` on 12 new catches across `click_census.js`, `docs_scan.js`,
  `em_validation.js`, `engine_release.js`, `job_cost.js`, `test-docs-current.js` and
  `test-engine-release.js`. medicham2's own declaration is still PINNED and still passes. Filed under
  the DIVISIONS rule "if you trip over another division's bug, you file it".
- ~~**Grounded-ness is still not tracked, and WIRE 73 inherits the gap.**~~ **CLOSED, WIRE 117.**
  `fails.terrainHealUngrounded` is gone; the heal asks the shared `isGrounded` and its receipt is
  `seen.terrainHealSkippedAirborne`. The line is kept struck through rather than deleted because it
  is the second time this exact gap was declared and left, and the declaration is the evidence.

## The three ratchets — 2026-08-04, PRIORITIES #40 / #40a

All three were red **before** this session and two of them **crashed** rather than failed unless
`SHOWDOWN_PATH` was set, which is most of why nobody ran them. Both now exit **2** with one line:
*NOT RUN — set SHOWDOWN_PATH*. A check that crashes is a check that gets skipped.

| Ratchet | Was | Now |
|---|---|---|
| `test-mc-key` | RED, `medicham2-browser.js: 5 -> 7` | **GREEN**, back to 5. The two lookups were **removed**, not baselined |
| `test-effective-identity` | RED, 234 → 302 raw reads | **GREEN**, with 7 files **declared** and medicham2's declaration **pinned by an assertion** |
| `test-no-silent-failure` | RED, 53 new silent catches | still RED at **40**, and **none of them are in a file ENGINE owns** |

**`--update` was refused on all three, and that is the point.** Raising a ratchet is the opposite of
what a ratchet is for. `test-no-silent-failure --update` would have laundered 40 catches belonging to
MEASURE, SEARCH and OPS along with the 11 that were mine.

**The two mc-key lookups both went through `pasteKey()`**, this file's own resolver — the one the
test's header already names as working. `bringIn` normalised `switchInForme.becomes` by hand and then
indexed `MC.mons`; `oneMegaPerSide` wrote out the `-mega` suffix strip that `pasteKey` already does.
Neither was a behaviour change and both are strictly more capable (pasteKey has the flat rescan).

**`test-effective-identity` needed a third option, because it had only two and both were wrong.**
Leave it red forever, or `--update` and launder `rollout_leaf.js`'s real violation with the rest. So a
file whose raw reads are correct BY CONSTRUCTION now DECLARES that, with the reason, in the shape this
project already uses for `RAW-STORE-OK`. Three rules keep it from being a mute button: the reason must
be about construction, a declaration that can be pinned is pinned, and every declared file prints its
count on every run. **The ratchet was re-verified to still bite** by dropping a throwaway file with two
raw reads into `engine/` — it failed on it.

**All 67 of medicham2's raw reads were walked, not asserted.** 66 are live battle bodies this engine
constructed; the one exception (`norm2(set.ability)` in `buildMonFromSet`) reads a parsed SHEET, which
is the case the test itself names as correct.

**What the walk found is the part that mattered.** The construction claim was FALSE — see below.

## What verifying the claim turned up: two mega-ability bugs

Both are probed in `tests/test-mechanics.js`. Census **100 → 102 live**, nothing fell.

1. **`megaRowAbilityCase`.** 85 of the 318 `MC.mons` rows key a mega and store `ab` in DISPLAY case —
   `"Technician"`, `"Huge Power"`, `"Tough Claws"`. `buildMon` copied that through, and every ability
   test in this engine is a lowercase literal (`att.ability==='technician'`). A body built from its
   MEGA ROW carried exactly the right ability and **not one line of it fired**: Mega Scizor's Bullet
   Punch read **52 where Technician makes it 78**. It hid because the OTHER door — base row + stone —
   goes through `megaAbility()`, which returns from a lowercase hand-written map, and because
   `board.js` overwrites the ability with `effAbility()` before its own damage call. Only the
   mega-keyed door was wrong: `position_features.js`, `sets.js`, `winProb2` called with a mega name.
2. **`megaSheetAbility`.** `buildMonFromSet` read `declaredAb || megaAbility(...)`, so a paste of
   *Scizor @ Scizorite / Ability: Swarm* built a `scizor-mega` body running **Swarm**. A team sheet
   lists the PRE-mega ability; this is the mega ability gap living in the engine rather than in
   `board.js`, which had already fixed its own half at `board.js:964`. **Two engines disagreeing about
   a FACT**, which CLAUDE.md names as this project's most expensive failure. Only the branch that
   swaps the key to a mega row overrides the sheet — a non-mega set still lets a declared Rough Skin
   beat the dataset's Sand Veil.

**`tests/test-paste.js` was asserting the bug and its assertion was inverted.** It read
`geng.ability === 'cursedbody'` for a Gengar holding a Gengarite. Mega Gengar has **Shadow Tag** —
the worked example in `test-effective-identity`'s own header. Confirmed three ways before the line was
touched: Showdown's dex gives Gengar-Mega exactly one ability, `board.js effAbility` returns
`shadowtag` for the same sheet, and medicham2 now agrees.

**A probe was wrong before the engine was, for the tenth time.** The structural pin first reported
three megas with the wrong ability — Garchomp, Lucario, Absol. Champions ships a **second mega per
stone**: `garchompiteZ -> garchompmegaZ`, Rough Skin instead of Sand Force. The loop kept whichever
stone it saw LAST, which was the Z one. They are now excluded **with the reason**: `MC.mons` has zero
`-mega-z` rows and the store has zero `itez` occurrences, so the engine cannot represent them at all.

## The differential harness was silently dropping 12 rows, all of them the same Pokemon

Five catch blocks in `tests/test-engine-diff.js` returned a plausible `null` and said nothing, so a row
that failed to BUILD and a row that was never sampled were the same event. That matters here more than
almost anywhere: the headline is a RESIDUAL, and a silent drop shrinks the denominator without
shrinking the claim. Now counted, named and written to `data/engine-diff.json` as
`dropped_by_exception`.

Naming them earned its keep on the first run. At seed 20260804 `--n 400` it fires **12 times and all
twelve are Bellibolt**. The throw is inside Showdown: Electromorphosis's `onDamagingHit` adds the
`charge` volatile, and Charge's `onStart` reads a `source` that only the full move pipeline sets —
`moveHit`, the entry point this harness must use, leaves it null. **Not a MEDICHAM bug**, and on the
same layer boundary as the Disguise SUSPECT row, so it is recorded rather than papered over. It was
invisible until this session.

`tests/walk_tags.js` had the same shape and worse: its three silent catches returned `null`, and a
`null` prints as **NOT COVERED**, which the report calls "honest ignorance, not a pass". It was not
honest — an engine that THREW and a tag with no handler produced the same word.

## PRIORITIES #0 — the leaf's weather string. LANDED 2026-08-04, with a before/after.

**The engine could SET weather and could not READ the weather it was handed.** `board.weather` holds
Showdown's `|-weather|` line, which is a MOVE name — and across **41,122 weather events in the whole
store there are exactly four values**: `SunnyDay` 17,375, `RainDance` 11,355, `Snowscape` 6,304,
`Sandstorm` 6,088. Every formula in `medicham2-browser.js` compares against `sun`/`rain`/`sand`/`snow`.
`rollout_leaf.applyField` assigned the string straight through, so a mid-battle board's weather was
truthy enough to suppress the mega-weather guard and meaningless to every multiplier.

**What was exported, and why there.** `SD2WEATHER` already existed in `medicham2-browser.js`, beside
`SD2ENG` and `CODE_OF_STATUS`, under a comment saying naming conventions live there. It is now wrapped
in **`weatherId()`** and exported from that file — **not moved**, and **no second map written**. The
engine owns its own vocabulary; a copy in `rollout_leaf.js` is how `choiceLock` came to have two
engines disagreeing. It is **idempotent**, so the two paths that already spoke the engine's words
(`weatherSetter` on switch-in, a weather move played inside a playout) are untouched, and an
**unrecognised value returns `''` and is counted in `MEDI.fails.weatherUnknown`** rather than passed
through as a truthy string nothing reads. That counter is **0** over 10,000 playouts.
`:1481`, `:1825` and `:2156` were routed through it too — `:1825` read `SD2WEATHER[_pun.setsWeather]`
with no normalisation and would have silently failed on any capitalised value.

**Parity, 250 corpus boards, both arms in ONE process at n=40, seeds fixed per board.**

| | before | after |
|---|---|---|
| boards walked | 250 | 250 |
| boards carrying a weather | 130 (52.0%) | 130 |
| `rolloutWinProb` different | — | **77** (30.8% of all boards, **59.2% of the weather boards**) |
| boards moved with NO weather | — | **0** ← the control |
| mean \|Δ\| on the movers | — | **9.98 pt**, max **37.5 pt** |

By weather: sun 28/41 at 12.10 pt, rain 27/42 at 9.68, snow 7/15 at 9.11, sand 15/32 at 7.00. The
snow and sand numbers are the right order for weathers whose main modelled effect is a defence
multiplier. **The 41% of weather boards that did not move are n=40 quantisation and saturation, not
inertness** — the direct counter below settles that a different question was asked of the engine.

**The direct counter, because a parity delta is indirect.** `battleTurn` wrapped, field read on turn 1
of every playout, 250 boards × 40:

```
before : 0 of 10,000 playouts began in a weather MEDICHAM can read   (0.00%)
after  : 5,760 of 10,000                                            (57.60%)   sun 2120, rain 1600, sand 1360, snow 680
```

Probed permanently by `boardWeatherLanguage` in `tests/test-mechanics.js`, which calls the real
`applyField` and demands the resulting damage EQUAL the damage under the engine's own word, having
first shown that `sun` beats clear on the same Flamethrower — `clear 56, 'sun' 84, as landed 84`.
`applyField` is exported as a named test seam for it.

## The two dead wires in `tests/test-tag-wire.js` — BOTH CLOSED, and only one was the engine

It is **GREEN**, 104 checks, 0 dead wires. Census **102 → 105 live / 144 → 147 probed**; nothing fell.

1. **`typeImmunity` was the PROBE, not the engine.** The wire staged Volt Absorb on a **Garchomp** —
   Dragon/**Ground**, which takes zero from Electric with no ability at all. So *"an Electric hit into
   Volt Absorb prices at zero"* was true of a Garchomp with `ability:'none'`, and the heal could not
   fire because nothing was ever absorbed. It also left the absorber FREE with `moves:['protect']`, so
   the engine chose Protect and blocked the hit — two independent reasons the arm could not pass
   whatever the engine did. Same shape as the redirection false alarm (a Dragon move at a Fairy type).
   Re-staged on **Milotic** with an explicit control arm, the unmodified engine reads
   `hp change: ability none -34, Volt Absorb +35 (a quarter is 35)` — **exact**. New census probe
   `typeImmunityHeals`, LIVE on the engine as it already stood.
2. **`sealsMoves` was the engine, and the consumer was unreachable.** The wire sat inside
   `playerAction`'s `kind==='status'` branch. Encore, Disable and Taunt carry a **volatile and no major
   status**, so `playerAction` classifies them as `affect` and control never arrived. Moved to where
   they actually resolve (**WIRE 26**), and **the duration now comes from the artifact** — it read
   `encore?3:taunt?3:1`, so Disable, which the tag says lasts **5**, got one turn. Encore now rides the
   **same `_lock` the Choice items use**, so a caller-SUPPLIED action is bound as well as a chosen one
   (the WIRE 24 rule, which nothing about Encore honoured); a Choice lock is never shortened by it.

**And the Disable probe in the census had been a FALSE LIVE for as long as it existed.** It ran ONE
arm: the foe committed Rock Slide, was Disabled, chose freely, picked Earthquake, and the probe called
the mechanic live. Remove the Disable click and it picks Earthquake anyway. **Identical results across
a varied knob mean the knob is unwired.** Both arms print now, and the staging was inverted so the
control REPEATS — Rock Slide is precisely the move the control does not repeat, which is why the probe
read green while dead.

**Filtering `me.moves` was not enough, and the probe caught that too.** The priors sampler
(`MC.priors[me.name]`) picks a move **by name** and never consults `me.moves`, so the seal leaked
through the single most-used exit in `chooseAction`. Both arms clicked Dragon Claw until it was
guarded. Disable also ticks at **end of turn** rather than in `chooseAction`, or a duration only counts
down on turns the engine happens to be choosing — which in a rollout driven from outside is never.

**My own Encore probe was wrong first, which makes eleven.** It handed the foe a FORCED action on the
pinned turn, and a forced action bypasses `chooseAction` — it measured the caller's obedience. Both
probes now read `S.lastActs`, the engine's own record of what was clicked, because `_lastMove` is not
written by every action kind and a pass leaves yesterday's move sitting there.

## The HEALING CLASS — validated as a class, 2026-08-04. Census 105 → 107.

Will: *"lets validate all the healing tags like drain and hospitality and life dew and recover and
regenerator."* It is a class and only one member (`drain`) had been fixed. All eight members now have
a **behavioural, two-armed** probe and all eight are LIVE.

**THE DIFFERENTIAL CANNOT SEE ANY OF THIS, and `tests/test-mechanics.js` now says so in its own
comment.** `test-engine-diff.js` compares one `moveHit` against one `dmgRange` — a single-hit DAMAGE
number. Healing is HP over turns. A residual of 1/400 says nothing whatever about this class. Same
statement `multiHit` carries, same structural reason.

### The tag over-matched, and printing the membership first is what caught it

`tag_dex.js` derived `healsOnSwitchOut` as `a.onSwitchOut ? {heal: 1/3}` — **any** ability that does
anything on the way out. Membership printed **before** wiring:

```
OLD derivation matched 3 : naturalcure, regenerator, zerotohero
NEW derivation matched 1 : regenerator {"heal":0.3333}
```

**Natural Cure cures status and heals nothing; Zero to Hero forme-changes Palafin.** Wiring the tag as
it stood would have handed two abilities a 33% heal they do not have, on **227 corpus uses**. The
derivation now READS the number out of the handler — `pokemon.heal(pokemon.baseMaxhp / 3)` — instead of
assuming it. LESSONS §4 for the fourth time.

**The regeneration was verified, not assumed**, by the procedure this file already documents: after
excluding `uses`, **exactly 2** entries in `data/tags.json` differ and both are the intended ones
(411 entries' `uses` moved because the store grew; no feature reads `.uses`).
`engine/feature_fixture.js --check` exits **0** afterwards, so **no refit is owed**.

### What was WIRED versus what was already HARDCODED

| Tag | Uses | Before | Now |
|---|---|---|---|
| `healsOnSwitchOut` | 845 | **nothing at all** — a Regenerator pivot was priced as a plain switch | WIRE 27, from the corrected tag, in `switchOut` |
| `blocksHealing` | 196 | **nothing at all** | WIRE 30, on a connecting hit, per target |
| `passiveHeal` | 6,483 | `if (m.item === 'leftovers') ... /16` — **a name check** | WIRE 29, from `passiveHeal.heal` |
| `healsSelf` / `healsAlly` | 2,592 | the dex blob's `fx.heal`, and `fx.target === 'allies'` for the spread — **a second copy of the fact** | the tag's own params; Life Dew spreads because it carries BOTH tags |
| `drain` | 8,553 | already tag-driven (WIRE 19) | + the Heal Block gate |
| `healsAtThreshold`, `healsAllyOnSwitchIn`, `perTurnHP` | — | already tag-driven | + the Heal Block gate where it applies |

**Routing `healsSelf`/`healsAlly` through the tag is a behavioural NO-OP and that was checked move by
move before the switch**: across all 14 members the tag's fraction equals the dex's exactly wherever
both exist (`lifedew [1,4]`, `roost/recover/slackoff/softboiled [1,2]`), and where the tag says
`heal: true` the dex carries nothing either. So nothing moved and **membership stopped being typed** —
docs/TAGS.md invariant 3. A move added next regulation with `healsSelf` now works without an edit.

**`heal: true` is a boolean in a fraction's clothing and is left visibly unwired**, counted in
`MEDI.fails.healProcedural`: Rest (full, plus the sleep), Synthesis / Moonlight / Morning Sun
(weather-dependent), Wish (delayed), Healing Wish (the user faints), Swallow (needs Stockpile),
Strength Sap (scales off the TARGET's Attack), Heal Pulse (91 uses, heals its target). They are
deliberately NOT classified as `kind:'heal'` — Rest's real click is the sleep and Strength Sap's is the
Attack drop, and capturing them here would turn a partly-modelled move into a fully no-op turn.

### `blocksHealing` is the counter and it landed in the SAME pass, on purpose

Wiring the healers without it makes every healer in the format strictly better than it is — a
one-directional error. It gates **healing moves, the heal half of a drain (the damage still lands), a
passive item tick, a pinch berry (which is not consumed either), and Leech Seed's return to the
seeder**. It does **not** gate `healsOnSwitchOut` — that fires as the body leaves, and leaving ends the
volatile — nor Hospitality, which heals on ENTRY. Both exclusions are stated in the code.

### THREE CENSUS ENTRIES WERE HOLLOW — LIVE by SOURCE GREP, not by behaviour

The contradiction Will's brief pointed at turned out to generalise. `healsAllyOnSwitchIn` read
`/hospitality|healsAllyOnSwitchIn/.test(src)` — it would have returned **LIVE for a mechanic that was
commented out, renamed, or wired to the wrong body.** It is now behavioural and two-armed and reads
`ability none 0, Hospitality 43 (a quarter is 43)`. **A hollow entry is worse than a missing one,
because it occupies a slot in a number that may never fall.**

**Two more of the same shape were still LIVE by grep and were named here rather than quietly left:**
`priorityMod` and `weatherChipImmune`. **Both were converted on 2026-08-04 — see "THE HOLLOW PROBES"
below. One was honest and one was hiding a dead wire.** `blocksBerries` and `disablesAttacker` were
the same shape reporting MISSING; they are behavioural now too, and still MISSING.

### The census-versus-tag-wire contradiction, and which one lied

**`tests/test-tag-wire.js` lied.** `data/mechanics-census.json` was right: Volt Absorb heals exactly a
quarter and always did. The wire staged the absorber as a **Garchomp** — Dragon/**Ground**, already
immune to Electric with no ability at all — and then left it FREE with `moves:['protect']`, so the
engine chose Protect and blocked the hit. Two independent reasons the arm could not have passed
whatever the engine did. See the dead-wires section above; the census probe `typeImmunityHeals` was
written this session, watched fail on nothing, and reads `ability none -34, Volt Absorb +35`.

**Where the fact lives, since it lives in an odd place.** `voltabsorb`, `waterabsorb`, `stormdrain`,
`poisonheal` and `healer` carry **no heal tag**; the heal is a param of `typeImmunity` and that is the
one place it lives. Volt Absorb and Water Absorb are the same shape and both work.

### Not done, and named so nobody assumes it was

- **`leechseed` and `pollenpuff`.** Leech Seed is **already tagged** — `perTurnHP {effect:'drain',
  per:8, on:'target', to:'user', immuneType:'Grass'}` — and already wired (WIRE 8), so the brief's
  "carries no heal tag at all" is not quite right; what it lacks is membership in the `drain` tag, and
  adding a second tag for the same fact is what invariant 2 forbids. **Pollen Puff (99 uses) is a real
  gap**: it heals an ally instead of damaging and carries nothing for it.
- **`naturalcure` is now `untagged`.** It genuinely cures status on switch-out and no derivation
  describes that. It lost a tag it should never have had; it still needs one it does not have.

## Found red, NOT mine, NOT fixed — reported rather than filed

- **`tests/test-web-status.js` is RED BECAUSE MY CENSUS MOVED, and I did not run the fix.** It says
  `engine.live = 105 but data/mechanics-census.json -> live = 107`. The fix is one command and the
  test names it: **`node web/build-status.js`**. It is a generator — it authors no number, it copies
  artifacts onto the board — but it writes into `web/`, which this pass was told not to touch. So it is
  reported here in full rather than left to be discovered: **WEB owes one command.**
- **`tests/test-no-silent-failure.js` is RED at 47 new silent catches (was 40), none in an ENGINE
  file.** The seven that appeared since the 40 were counted: `backtest_winrate.js`, `mag_bot.js` ×3,
  `miltank.js` ×3 and neighbours — MEASURE, SEARCH and OPS. The one match inside `rollout_leaf.js`
  (`movePriorFor`, line 216) is **pre-existing at HEAD** and was verified against
  `git show HEAD:engine/rollout_leaf.js`; it moved down seven lines because of a comment.
- **`test-site-data-fresh` and `test-stadium-roster` are RED and are MEASURE/WEB.** The first is the
  stale-fit list (`pory`, `xatu`, `nmf`, `slowking`); the second is the GURU hole, PRIORITIES #41.

## A SECOND weather boundary exists, is the same bug, and is measured at ZERO exposure — FILED

`engine/position_features.js:291` builds `field.weather = B.norm(board.weather)` — the same
untranslated move name — and hands it to `M.effSpeed`. The loss is exact and was measured, not argued:

```
swiftswim   clear 161   engine-word 'rain' 322   board-word 'raindance' 161
chlorophyll clear 161   engine-word 'sun'  322   board-word 'sunnyday'  161
sandrush / slushrush    identical
```

**It is not fixed here, and the reason is a number.** Over **400 corpus boards, 192 of which carry a
weather, ZERO** had a weather-speed ability among the actives standing in its own weather (95% upper
bound ~0.75%). The control holds: `MC.mons` carries **9** such rows — Excadrill, Swampert-Mega,
Basculegion-F, Venusaur, Vileplume, Victreebel, Overqwil, Beartic, Houndstone — so the mechanism is
real and the event is rare, rather than the probe being broken. It is a latent hazard, and fixing it
changes a **feature vector**, which is the refit edge MEASURE owns. `board.js:1190` holds a THIRD copy
of the same map (`WEATHER_KIND`, sun/rain only), and `board.js` is not ENGINE's to edit.

**Terrain was the same mismatch and it is now MEASURED AND FIXED — see the next section.**

## PRIORITIES #0's TWIN — THE TERRAIN VOCABULARY. LANDED 2026-08-04, with the exposure measured first.

**The split ran through the middle of this engine, not only at its edge.** Three writers, two
vocabularies, nobody translating — and medicham2's own readers were on *both* sides of it:

| Reader | wanted | got from the artifact | got from a Board |
|---|---|---|---|
| Hadron Engine (`:631`) | `electric` | `electric` ✓ | `electricterrain` ✗ |
| Grassy Glide (`:97`) | `grassy` | — | `grassyterrain` ✗ |
| Psychic Terrain priority block (`:144`) | `psychicterrain` | `psychic` ✗ | `psychicterrain` ✓ |

Measured on the shipped engine before anything was touched:

```
Surf under Hadron Engine   clear 99   'electric' 130   'electricterrain' 99
movePriority(grassyglide)  'grassy' 1                  'grassyterrain' 0
priorityRefusedAbove       'psychic' Infinity          'psychicterrain' 0
```

So **Psychic Surge has never blocked a priority move** (its `terrainSetter` says `psychic`), and a
board's `electricterrain` has never boosted or hastened anything. Both halves looked live and both
were dead, in opposite directions.

### Exposure, measured before the fix

- **The store holds exactly four values** over **1,845** field-start terrain events across 52,441
  games: `Electric Terrain`, `Psychic Terrain`, `Grassy Terrain`, `Misty Terrain`. The translation
  therefore covers **100%** of what exists, the same way the weather one did.
- **1.98%** of the 8,759-game fit corpus carries a terrain at all (173 games, 199 events).
- **863 of 69,623 corpus boards — 1.24%** — carry a terrain by the Board's own key, against **48.1%**
  for weather. By value: electric 597, psychic 243, grassy 18, misty 5.
- **0 of those 863** are found by the extractor that actually feeds the leaf. `miltank.js:781` and
  `rollout_r1.js:175` do `['electric','grassy','misty','psychic'].find(t => board.hasField(t))` — a
  **THIRD** vocabulary, short words against a Board that stores long ones. **Leaf-side terrain exposure
  is exactly zero today and stays zero until those files' owners change them.** Filed below.

### Parity, and the honest answer is ZERO with a reason

150 terrain boards + 150 no-terrain controls, `n=40`, seeds fixed per board, the board's own key
handed in, pre-fix and post-fix engines run over the identical sample:

| | terrain boards | control (no terrain) |
|---|---|---|
| paired | 142 | 134 |
| `rolloutWinProb` different | **0** | **0** |

**Zero everywhere, and this time it is not "the fix did not take" — it is measured inertness with
three stacked causes**, each of which is a number rather than an argument:
1. the 37 psychic boards were **already** reaching the one reader written for the board's spelling, so
   before == after there by construction;
2. the 101 electric boards can only be read by **Hadron Engine**, which has **0 corpus uses** and
   exactly one `MC.mons` row (`raichu-mega-x`);
3. grassy is **18 of 69,623** boards and its only reader is **Grassy Glide, 3 corpus uses**.

The direction that *did* change — the artifact's `psychic` now blocking priority — has **2** corpus
uses of `psychicsurge`. So the terrain **field** is a tiny lever in this format, and the vocabulary fix
is worth having because it is correct, not because it moves the number.

**The terrain MOVES are the lever, and they are where the pass paid.** `psychicterrain` is clicked
114 times, `expandingforce` 182, `risingvoltage` 114 — an order of magnitude more than the abilities.
Both were wired in the same pass (`setsTerrain`, `terrainScaled`, below) and both go through
`terrainId`, which is what makes the translation load-bearing rather than decorative.

**Whole-session parity, same 276 boards, session-start engine against now** — this arm has no control
by construction, because the sandstorm chip and Magic Bounce also landed, so it is decomposed by
weather instead:

```
sandstorm  9/22 moved (40.9%)   <- the sandstorm residual
none       9/118       (7.6%)   <- Magic Bounce, the terrain moves, Expanding Force
raindance  3/50        (6.0%)
sunnyday   0/59        (0.0%)   <- the control: nothing this pass touches sun
snowscape  0/27        (0.0%)   <- and snow is correctly NOT a chip in this generation
```

Mean |Δ| 4.20 pt on the terrain boards and 7.00 pt on the rest, max 8.8 pt.

**`terrainId()` is `weatherId()`'s sibling and no second map was written.** Same shape, same
idempotence, same loud unknown (`fails.terrainUnknown`, which names the first value it drops). It is
exported. Idempotence matters more here than it did for weather because **both** vocabularies genuinely
arrive — the artifact's on a switch-in and the Board's at the leaf boundary. Probed permanently by
`boardTerrainLanguage`, which asserts **both sites in both vocabularies**: `clear 99, 'electric' 130,
as landed 130` and `priorityRefusedAbove: clear Infinity, 'psychic' 0, 'psychicterrain' 0`.

## THE HOLLOW PROBES — one was honest, one was hiding a dead wire

### `weatherChipImmune` was LIVE by grep and THE ENGINE HAD NO WEATHER CHIP AT ALL

The probe read `/icebody|weatherChipImmune|magmaarmor/.test(src)`. It passed on the word
`magmaarmor`, which appears in this engine **once** — inside the **freeze**-immunity table at
`:1097`, with nothing whatever to do with weather. So the census carried an immunity as working while
the damage it is immune to did not exist: burn, poison, Toxic and Leech Seed all ticked at end of
turn and **sandstorm did not**. Sand Stream is 1,705 sheets and the store holds 6,167 sandstorm events.
CLAUDE.md's own advice — *"Bring Steels against Tyranitar sand — they take no sandstorm chip"* — was
describing a mechanic the simulator did not have.

**Landed as WIRE 31**, first in the residual order, which is the real one. Snow is **not** a chip in
this generation (Snowscape replaced Hail) and the probe asserts that a fourth arm reads zero, so an
engine that chipped in snow would be a new wrong number rather than a wired mechanic. Reads:
`sand, Milotic: ability none -10 (a sixteenth is 10), Sand Veil -0; sand, Archaludon (Steel) -0;
snow, Milotic -0`. **40.9% of sandstorm boards moved** in the parity above.

**The tag over-matched and printing the membership caught it, for the fourth time in this file.**
`onImmunity` is Showdown's one hook for "I ignore a named source of harm" and the derivation excluded
only the type names:

```
OLD matched 8 : icebody magmaarmor oblivious overcoat sandforce sandrush sandveil snowcloak
NEW matched 6 : icebody overcoat sandforce sandrush sandveil snowcloak
```

Magma Armor's handler is `if (type === 'frz')`; Oblivious's is `if (type === 'attract')`. Wiring it as
it stood would have handed a sandstorm immunity to bodies that take the chip. The **weathers are now
read out of the handler** — Overcoat refuses both, Sand Veil only sand, Ice Body only snow — so the
consumer names no ability. Magma Armor is left with **no tag**, which is honest: its real mechanic is
freeze immunity through `onImmunity` rather than `onSetStatus`, so the statusImmune derivation next
door does not describe it either.

**Magic Guard is deliberately NOT exempted and is COUNTED** (`fails.magicGuardChip`). It blocks
indirect damage through `onDamage`, carries `untagged` (79 uses), and exempting it by name would type a
membership list *and* leave the ability half-right, since burn and poison above still chip it.

### `priorityMod` was hollow and the mechanic underneath it is genuinely LIVE

Prankster's `+1` really is applied in `battleTurn`'s sort. Re-staged behaviourally on the case the
wire's own comment names: a **Grimmsnarl** (base 60) puts up Reflect against a **Weavile** (base 125)
that is clicking Icicle Crash, so a 0-priority screen goes up after the hit it is meant to blunt.
`ability none 118, Prankster 78` — x0.667, which is the doubles screen, so the screen landed first.

**`S.lastActs` is NOT the resolution order and the probe says so in a comment.** medicham2 writes it
from `acts` *before* the sort, so it records what was committed. The first version of this probe
printed it and got the same name in both arms, which reads exactly like a dead knob.

### A SYSTEMATIC DETECTOR — built, because it was cheap and exact

`tests/test-mechanics.js` now captures each probe's own source and flags any probe that **reads a file
instead of running the engine**. It is structural, costs nothing, is written to the census as
`hollow`, and the file **exits 1** if it is non-zero — a different exit from MISSING on purpose, because
a MISSING mechanic is honest state and a hollow probe is not evidence about the engine at all. All
five that ever existed would have been caught the day they were written. **It is 0 now.**

**The "both arms agree" version is measured rather than asserted, and the measurement is the reason.**
`detail` is free-form prose carrying arm values, thresholds (*"a quarter is 43"*), stage counts and
stat names all as bare digits, so no parser can tell an ARM from an ANNOTATION. The scan prints how
many LIVE probes have ≥2 numbers that are all equal:

```
23 over the whole census  ->  6 once restricted to LIVE  ->  3 after fixing what it found
```

The 6 were not false positives about agreeing arms — they were **one-armed probes**, and three of them
could not have failed:
- **`preventsStatDrop`** read `atk 0 -> 0`, which is also what an engine with no Intimidate prints;
- **`blocksStatusMoves`** read `target atk stage after Charm: 0 (0 = refused)`, same shape;
- **`chargeTurn`** read `foe took 0 on the charge turn`, which a move dropped to `kind: pass` also
  prints — it now also plays turn 2 and demands Fly actually **lands**.

The remaining 3 (`lowersUser -1/-1`, `boostsTarget 2/2`, `statusCategory 0 + par`) are genuine
heuristic noise: each asserts a specific non-default value a no-op engine could not produce.

**Doing it properly is a PROTOCOL change** — probes return `arms: {control, test}` and the file asserts
`control !== test` — and it has to be applied by hand to all 154 probes, because a probe that kept
returning only `detail` would opt itself out silently, which is the same hole in a new place. Costed
here so the next pass decides with the number in front of it.

## Walking the unprobed tags — 2026-08-04, in descending corpus usage

| Tag | Uses | Result |
|---|---|---|
| `moveClass` | 76,625 | **LIVE.** Four arms — Iron Fist must boost Mach Punch and must **not** move Flare Blitz, or "boosts everything" passes |
| `statChange` | 64,869 | **LIVE**, and the SIZE is asserted: Charm is exactly −2, from the param |
| `sound` | 14,797 | **LIVE.** Soundproof refuses Hyper Voice and still takes Moonblast |
| `punishesAttacker` | 8,953 | **LIVE.** Rough Skin tolls Waterfall and **not** Surf — the trigger is `contact` and a probe that only tested contact would pass on a wire that punished everything |
| `reflectsStatusMoves` | 568 | **WAS MISSING — WIRED (WIRE 33).** See below |
| `setsTerrain` | 141 | **WAS MISSING — WIRED (WIRE 32).** `playerAction` had a branch for the four weather moves and none for the four terrain moves, so Psychic Terrain (114 uses) resolved to `kind: pass`. Probed by outcome — the foe's Ice Shard is blocked — not by reading the field back, which would pass on a string nothing reads |
| `terrainScaled` | 296 | **WAS MISSING — WIRED (WIRE 34).** Expanding Force 105 → 157 |

**`reflectsStatusMoves` over-matched, and this is the fifth membership print to earn its keep.**
`onAllyTryHitSide` is the hook for "I react to something aimed at my side" and says nothing about what
the reaction is:

```
OLD matched 3 : magicbounce, sapsipper, soundproof
NEW matched 1 : magicbounce
```

Sap Sipper **boosts** off an ally's Grass move; Soundproof **refuses** an ally's sound move. Wiring the
tag as it stood would have sent every Will-O-Wisp aimed at a **Soundproof** body back at its user —
355 corpus uses — and a bounce is strictly worse than an immunity, because it is a move that lands on
you. The discriminator is the bounce itself: only Magic Bounce rebuilds the move and calls `useMove`
back at the source, gated on Showdown's `reflectable` flag.

**`reflectable` was added to the `moveClass` derivation in the same pass**, so the wire is the same
ability-names-a-flag / move-carries-it JOIN `immuneToMoveClass` already uses rather than a second
membership rule in the consumer. 60 moves carry it; the tags.json diff was verified to be **exactly**
that addition and nothing else. Probe reads `atk stages (target/user): ability none -2/0, Magic Bounce
0/-2`. What is **not** modelled is stated: the tag's `scope` covers the whole side including hazards,
and this engine keeps neither hazards nor side conditions.

**`terrainScaled` carried no number and that is why nothing read it.** `{scalesWith:'terrain'}` named
the mechanism and gave a consumer nothing, so Expanding Force (182) and Rising Voltage (114) were
priced at base power in every rollout. `tag_dex` now pulls **which terrain** out of Showdown's own
`isTerrain("psychicterrain")` and **the multiplier** out of the `chainModify` or `basePower * n` beside
it — and it probes `onBasePower` too, which was never probed and is where Expanding Force and Misty
Explosion live. Membership: `expandingforce 1.5`, `risingvoltage 2`, `mistyexplosion 1.5`, and
**`terrainpulse` keeps the bare tag with no number on purpose** — it changes TYPE as well as power and
must not be given a multiplier. ~~Grounded-ness is not tracked (the same caveat
`priorityRefusedAbove` already carries)~~ — **that reason died at WIRE 117**; the live blocker is that
`terrainScaled` names no SUBJECT while Expanding Force tests the user's feet and Rising Voltage tests
the target's, so the two cannot share one wire. Expanding Force becoming a spread move is still not
modelled; both are stated in the code.

**Every regeneration of `data/tags.json` was verified the way this file requires** — diff excluding
`uses`, count the entries, read every one. `weatherChipImmune` 8, `reflectsStatusMoves` 3,
`moveClass` 60, `terrainScaled` 3, all intended. `engine/feature_fixture.js --check` exits **0** after
each, so **no refit is owed**.

## Filed, not fixed

- **A THIRD terrain vocabulary sits between the Board and the leaf, and it finds nothing.**
  `engine/miltank.js:781` and `engine/rollout_r1.js:175` both extract with
  `['electric','grassy','misty','psychic'].find(t => board.hasField(t))`, while `board.startField`
  stores `norm(move.terrain)` — the LONG words. Measured: **0 of the 863 terrain-carrying boards** in
  a 69,623-board walk are found by that extractor, so the leaf is handed `''` on every board that has
  a terrain. `medicham2` now accepts either vocabulary, so the fix on their side is to pass the key the
  Board actually holds. `miltank.js` and `rollout_leaf.js` are **SEARCH's**; `rollout_r1.js` is a
  MEASURE gate. Exposure is small (1.24% of boards) and the fix is one array.
- **`engine/position_features.js:296` reads the LONG terrain words and `:291` the untranslated
  weather.** Both change a **feature vector**, which is the refit edge MEASURE owns. `board.js:1190`
  holds a third copy of the weather map (`WEATHER_KIND`, sun/rain only). Neither file is ENGINE's.
- **`engine/status.js` prints the differential count without its seed.** The artifact now carries
  `seed`, `requested`, `skipped_multihit` and `skipped_non_finite`; the print reads none of them, so
  "1/400 differential comparisons disagree" still looks unconditional and does not say that 15 rows
  were skipped as not-comparable. `status.js` is MEASURE's file. One line.
- **`engine/status.js` does not read `data/interaction-matrix.json` at all**, so the ENGINE block prints
  a census and a damage residual and says nothing about whether the mechanics work TOGETHER — which is
  now a bigger surface than either (1,008 live pairs against 174 probes). The artifact carries
  `live`, `agree`, `inert`, `saturated`, `ko_timing`, `threw` and the full `dropped_by_the_generator`
  ledger, ready to print. **`status.js` is MEASURE's file.** Filed, not fixed.
- **The last differential row is a LAYER MISMATCH, not an engine bug, and it is flagged in place.**
  `chesnaught woodhammer -> mimikyu` reads `showdown 0-0, medicham 120-130` and is marked SUSPECT.
  Showdown's `onDamage` returns 0 for the hit; MEDICHAM's `dmgRange` correctly reports raw damage
  because WIRE 23 substitutes one level up in the battle loop. Both engines are right and the
  comparison is asking `dmgRange` a question about `battleTurn`. It is still COUNTED in the residual —
  flagging must never move the number. Fixing it properly means teaching the harness to run the
  damage-layer abilities, which is a bigger change than the row is worth.
  **RETRACTED 2026-08-07, ROADMAP #89 — this entry, and the comment in the engine it was copied from,
  gave a REASON THAT IS FICTION.** It said the maxhp/8 "never lands, because this harness never calls
  `battle.update()`". **`battle.update()` does not exist**, verified by enumerating the prototype; the
  nearest real methods are `sendUpdates`, `faintMessages` and `commitChoices`. The eighth is dealt in
  Disguise's own `onUpdate` — `this.damage(pokemon.baseMaxhp / 8, ...)`, data/abilities.ts:996 — on the
  next update pass, as a SEPARATE damage event, which is precisely why a single `dmgRange` comparison
  cannot see it. The CONCLUSION above is unchanged; the reasoning under it was wrong, and a right
  answer resting on a false reason is worse than a wrong one because the next reader re-derives from
  it. The engine's comment is corrected at the same site.
- **`data/engine-data.js` has no `mimikyu-busted` row, and it is the one thing WIRE 136 owes MEASURE.**
  Disguise now performs its forme change as a RENAME, which is faithful ONLY because the artifact
  states `formeOnHit.sameStats: true` and `sameTypes: true` for that pair — Mimikyu and Mimikyu-Busted
  are 55/90/80/50/105/96 Ghost/Fairy either side of the change. Ice Face's pair is NOT identical
  (Eiscue 50 Def / Eiscue-Noice 70), so it is refused and counted in `MEDFAILS.formeOnHitNoRow` rather
  than renamed wrongly. `engine-data.js` is downstream of this division and may not be edited here.
  Zero uses today; it becomes real the moment an Eiscue is played.
- **`battleResult` cannot tell a finished battle from an expired clock.** `medicham2-browser.js:1802`
  scores bodies-then-HP unconditionally; `battleOver` returns true for a wipeout *and* for
  `S.turn >= maxTurns`, and the caller cannot distinguish them from the return value. Every
  cap-expired playout is therefore a material count returned as a win probability, silently.
  Filed by SEARCH 2026-08-04 while testing whether that was the cause of the flat leaf calibration.
  **It is not** — measured by wrapping `battleResult` over 1.1M playouts, 99.5–99.8% end by an actual
  wipeout at every explore setting and at horizons 20 and 60, and cap-hits run 0.2–0.5%. So this is a
  latent hazard, not a live defect, and it is filed rather than ranked. The cheap fix is for
  `battleResult` to return the reason beside the score so a caller can weight or discard those rows;
  do not change what it *scores*, which several artifacts depend on.

## The authorised list — ALL LANDED, 2026-08-04

Cleared after the SEARCH explore sweep and the leaf calibration landed. Census **42 → 100 live**,
differential **4/400 → 1/400** at seed 20260804, refit edge still CLEAN (all 58 feature columns
hash-identical, so no refit is owed).

**The item ranked first was not a bug.** `redirects` (7,240 uses) was filed as "the attack VANISHES
— the worst bug in the repo". It does not. The probe aimed **Dragon** Claw at **Whimsicott**, which
is Grass/**Fairy** and immune to Dragon: Follow Me fired correctly, pulled the attack off Incineroar,
and landed it on a body that takes exactly zero. Both arms read 0 and the conclusion was written from
that. Re-staged with Milotic the same code reads `aimed 0 / redirector 101`. Follow Me and Rage
Powder have always worked, so **no rollout, H2H, R3 or R4 result is invalidated by this** — the
blast-radius note attached to the original filing should be retracted.

Nine probes in this file have now been wrong before the engine was, and this is the first that was
believed. A red probe is a QUESTION.

| # | Item | Result |
|---|---|---|
| 1 | ~~`redirects`~~ → **`redirectsType`** (Lightning Rod, 1,901) | **LANDED** (WIRE 25). The real redirection gap: the engine only looked for the Follow Me volatile, so an Electric move aimed past a Lightning Rod hit its partner. Probe now reads `aimed 0 / rod 0 / spa +1` — the rod both draws and absorbs, and the boost is the receipt. |
| 2 | **`drain`** (8,553) | **LANDED** (WIRE 19). `dealt 51 → user 85→110`. The fraction did not exist in the artifact: the tag said `readFrom:"m.drain"`, a pointer into a dex this engine does not have. `tag_dex.js` now emits the value, so Draining Kiss gets its 3/4 instead of an assumed 1/2. |
| 3 | **`multiHit`** (4,655) | **LANDED** (WIRE 20). `expectedHitsOf()` already existed and only `punishExposure` read it. Rock Blast 17 → 52. The differential now SKIPS multi-hit moves — comparing an expectation against one sample is not a comparison — so `tests/test-mechanics.js` is the only guard and says so in its own comment. |
| 4 | **`choiceLock`** (5,886) | **LANDED** (WIRE 24), in medicham2 — **no `board.js` change was needed**. `chooseAction` had honoured the lock since WIRE 18; `_a = forced \|\| chooseAction(...)` let every caller-supplied action through. A switch is still legal, which is the half a naive fix breaks. |
| 5 | **`fixedDamage`** (1,122) | **LANDED** (WIRE 21). Super Fang, Final Gambit, Endeavor and the OHKOs had no base power, so `hasPower()` rejected them and they were worth zero. Counter/Mirror Coat/Metal Burst need turn state a pure pricing function is not given, and are left at zero **loudly** rather than approximated. |
| 6 | **Foul Play** (734) | **LANDED**. `dmgRange` read `statSwap` (Body Press, Psyshock) and nothing had ever read `swapsStat.offensiveFrom`. The target's Attack **stage** moves with it, or a Swords Dance matchup — where the move is actually played — becomes a new wrong number. Differential: both directions now rel **0.0%**. |
| 7 | **`immuneToMoveClass`** (Soundproof 349, Overcoat 240, Bulletproof 85) | **LANDED** (WIRE 22) **with** CONTROL FIX 10 in the same pass, as required. Membership printed first: five abilities, and `magicbounce`/`reflectable` is excluded deliberately — it bounces status moves and grants no damage immunity. Powder is left to `powderBlocked()`, which already owns that question. |
| 8 | **Disguise** | **LANDED** (WIRE 23). Exactly `maxhp/8`, not a flat zero. My probe's own threshold (`≤15% of the real hit`) would have **rejected** the correct fix — 16 against a 92 hit is 17% — so the assertion was corrected to the exact rule first. The busted flag is deliberately NOT cleared on switch-out. |
| 9 | **Dry Skin Fire x1.25** | **LANDED** — tag first, exactly as specified. `tag_dex.js` now probes `onSourceBasePower` beside the stat route; membership printed before wiring matched **exactly one** ability corpus-wide. The four hardcoded `thickfat/heatproof/purifyingsalt/waterbubble` lines in `dmgRange` are gone, replaced by one tag-driven read. Differential: `houndoom fireblast -> heliolisk` now rel **0.0%**. |
| — | `train_policy.js` `writeWeights` provenance | STILL NOT DONE. Carried from the previous pass. |

**Regenerating `data/tags.json` was verified, not assumed.** The generator did **not** reproduce its
own artifact on the first run — 285 entries differed. Every one of those was the `uses` count alone,
because the store grew mid-session; after excluding `uses`, exactly **9** entries changed and all 9
were the intended ones (8 drain moves + `dryskin`). No feature reads `.uses`, and
`feature_fixture --check` is clean afterwards. Anyone regenerating tags should run that same diff
rather than trusting the file.

**The mechanism in item 5 was diagnosed wrongly first and the correction matters.** A starved
`basePowerCallback` does compute NaN, but Showdown clamps before it reaches the target's HP, so the
row comes back as a clean, plausible, entirely fake **zero** — not a NaN. A `Number.isFinite` guard
therefore does *not* catch it and has never fired on this corpus; the guard is kept and says so in
its own comment, and the phantom zero is caught by the SUSPECT marker instead. A fix aimed at the
wrong mechanism is still a bug.

## Ranked engine fixes — every one has a red probe behind it

The 2026-08-04 tag walk added 88 probes and moved the census from 54 probed to 142. `live` went
42 → 100 and `missing` from 12 to 42, and not one previously-live probe fell. Nine of the entries
below have since LANDED (see the authorised list above); what remains here is the queue. Ranked by corpus uses, then by how badly wrong the
behaviour is, with Lesson 3 applied by hand.

**Nine of these were my probe being wrong, not the engine, and each was caught by its own control
before it reached this list** — a spread move aimed where a single-target one was needed, Close
Combat fired at a Ghost that is immune to it, Toxic fired at a Steel that cannot be poisoned, and a
Fly declared by a Pokemon slower than its attacker (which the real game also lets through). That is
Lesson 5 for the sixteenth-through-nineteenth time, and it is why every probe here prints BOTH arms.

1. **`redirects` — 7,240 (Rage Powder 5,874, Follow Me 1,366). Take this first, and not for the
   usage.** The failure is worse than absence: the attack *vanishes*. Probe reads
   `no Follow Me: aimed 92 / partner 0 | Follow Me: aimed 0 / partner 0` — nobody takes it. Every
   Rage Powder in every rollout ever run has been a free team-wide Protect, and the searcher
   maximises exactly the lines its model is most optimistic about (Lesson 2). `redirectsType`
   (Lightning Rod, 1,901) is the same bug through a different door and reads the same way.
2. **`drain` — 8,553 (Matcha Gotcha 4,957, Giga Drain 1,255, Drain Punch 916, Draining Kiss 814).**
   `move dealt 51 to the foe; user 85 -> 85 hp`. The damage lands and the heal is dropped, so the
   most-clicked recovery route in the format is worth nothing.
3. **`choiceLock` — 5,886.** Not unimplemented: `tests/test-choice-lock.js` asserts it four ways and
   passes, on `board.js`. MEDICHAM obeys whatever action it is handed. Two engines disagreeing about
   a FACT is the CLAUDE.md rule this project has broken most expensively.
4. **`multiHit` — 4,655 (Dual Wingbeat 2,675, Twin Beam 676, Triple Axel 522, Population Bomb 385).**
   Priced as ONE hit. Dual Wingbeat is exactly half its real damage; Population Bomb about a seventh.
   The differential cannot see this — single-call `moveHit` also hits once — so only the probe can.
5. **`blocksSoundMoves` — 2,726 (Throat Chop).** One move, all real clicks, no effect at all.
6. **`punishesContact` — 1,761 (Spiky Shield 887, Baneful Bunker 698, King's Shield 176).** The block
   works and the punish does not, so the three are currently just Protect.
7. **`swapsStat` / Foul Play — 734, and the only red item with an independent authority behind it.**
   Confirmed twice against Showdown in the same run and in BOTH directions —
   `spiritomb foulplay -> wyrdeer` 178 there against 132 here, `klefki foulplay -> pangoro` 19
   against 8. `dmgRange` reads the `statSwap` tag, which Foul Play does not carry; its `swapsStat`
   params say `offensiveFrom:"target"` and nothing reads that field.
8. **`overridesEffectiveness` / Freeze-Dry — 1,252.** `mrrime freezedry -> araquanid` reads 96-114 on
   Showdown and 24-28 here: the full 4x, the move's entire identity, and independently confirmed.
9. **`fixedDamage` — 1,122 (Super Fang 577, Final Gambit 250, Endeavor 93).** `mv.bp=0`, so
   `dmgRange` short-circuits and these moves are worth literally zero to the engine.
10. **`boostsEachTurn` — 1,137 (Speed Boost 700, Moody 434)** and **`healsOnSwitchOut` — 1,057
    (Regenerator 830).** Both sheet counts, but both fire on a schedule rather than on a condition,
    so the count is close to the real rate.
11. **`costsUserHP` — 929 (Substitute 528).** Resolves to `kind: affect` and costs nothing;
    Substitute is not modelled at all and the HP cost is only its visible half.
12. **`poisonsOnMyContact` — 947 (Poison Touch)**, **`reducesAllyDamage` — 875 (Friend Guard)**,
    **`immuneToMoveClass` — 838 (Soundproof 344, Overcoat 240, Bulletproof 84)**. Sheet counts, and
    Lesson 3 bites hardest on Poison Touch: it fires only on CONTACT moves, so a special attacker
    carrying it contributes to the 947 and never triggers.
13. **`clearsBoosts` — 542 (Haze).** `playerAction` resolves it to `kind: pass`, so Haze is a wasted
    turn in every rollout.
14. **`partialTrap` 772, `terrainScaled` 296, `cantUseTwice` 186, `untagged`/Marvel Scale.** Real
    but small. Infestation lands its 8 damage and then chips nothing at all; Spiky Shield (item 6)
    blocks correctly and then punishes nothing — both probes print which half happened, so neither
    can be confused with a move that never resolved.
15. **`formeChange` / Disguise — 111 sheet uses, and the count badly understates it.** Mimikyu
    appeared in three of the residual differential rows across four seeds, because every Mimikyu that
    appears at all uses Disguise on turn one. Note the artifact will not hand this to you:
    `disguise.tags` is `["preventsCrit","formeChange"]`, and `preventsCrit` also holds Battle Armor,
    Shell Armor and Ice Face.

**The second block, found by walking further down the same list.** Smaller individually, and three
of them are whole categories of turn the engine cannot represent at all:

16. **`forcesSwitch` — 513 (Roar 400, Dragon Tail 96).** The move deals its 69 damage and the drag
    does not happen, so a phazing turn is priced as a weak attack.
17. **`noRecoil` — 731 (Rock Head)**, **`curesVolatile` — 665 (Mental Herb)**,
    **`blocksExplosion` — 545 (Damp)**, **`ignoresTypeImmunity` — 469 (Scrappy)**,
    **`reordersTurn` — 463 (After You 148, Instruct 162, Quash 153)**. All sheet or click counts,
    all read identical across the knob.
18. **`userFaints` — 338.** Explosion leaves its user on full HP. **`crashOnMiss` — 199**: High Jump
    Kick misses correctly and costs nothing. **`hazard` — 195**: the switch happens and Stealth Rock
    chips a 4x-weak Staraptor for zero.
19. **`typeBecomesMoveType` — 248 (Protean)**, **`ignoresDefenderAbility` — 212 (Mold Breaker,
    verified against a Levitate hard zero)**, **`blocksHealing` — 196 (Psychic Noise)**,
    **`curesStatus` — 208 (Lum Berry 175)**.
20. **`multiAccuracy` — 907 (Triple Axel 522, Population Bomb 385), and it hides a second bug.**
    Three 90% rolls compound to about 73%, and `moveAccuracy('tripleaxel')` returns **100** — so the
    printed accuracy is wrong before the per-hit rule is even considered.
21. **`alwaysCrit` — 274 (Flower Trick 216).** Same design question as `critRatioUp` below, not a
    separate decision.

## THE CRIT VERDICT — it WAS a bug, it is fixed, and here is the exposure. 2026-08-04.

The previous pass wrote *"`critRatioUp` may not be a bug — `dmgRange` models no crit anywhere"*. That
was half right in a way that hid the real defect: **the BATTLE LOOP has always rolled a crit**, a flat
`rng() < 1/24` for every move and every defender. So the engine had two crit facts and both were
wrong, in opposite directions.

**Measured before anything was touched, the way the terrain vocabulary was.** Over **48,274 stored
games**, **7.53%** carry a crit-tag move on an observed set — **1.68%** an `alwaysCrit` move and
**5.98%** a `critRatioUp` one. `preventsCrit` outside Disguise (Shell Armor, Battle Armor, Ice Face)
is **41 games, 0.08%**. By clicks: `alwaysCrit` **278** (Flower Trick 219, Frost Breath 40, Storm
Throw 19), `critRatioUp` **1,162** (Psycho Cut 276, Leaf Blade 169, Stone Edge 169, …).

**The two halves are not the same size of error and do not belong in the same place.**

- `alwaysCrit` is a **certainty**: a flat x1.5 the pricer was missing on every one of 278 clicks, so
  Flower Trick was priced 33% below what it does. It belongs in `dmgRange`, and it is what Showdown's
  own `willCrit` does — so the differential AGREES with it once its control is right.
- `critRatioUp` is a **RATE**, 1/24 to 1/8, an expectation difference of about 4%. It must NOT go in
  `dmgRange`: folding an expectation into a min/max stops `max` being the maximum roll and puts every
  ratio move permanently out of step with the differential's non-crit comparison. It rides the battle
  loop's roll, which is where the 1/24 already lived.
- **Shell Armor did nothing whatever**, and now turns both off.

Landed as **WIRE 35**, with one `critChance()` that every caller reads. The two ABILITY carriers of
`critRatioUp` are **deliberately refused and counted** (`MEDFAILS.critRatioAbility`, 15 corpus uses):
the tag's only param is `critRatio: 2`, which cannot express Merciless's condition — a GUARANTEED crit
into a poisoned target, not a permanent stage bump — and Super Luck, which genuinely is a permanent
bump, is indistinguishable from it in the artifact. Wiring both would hand Merciless an unconditional
1/8 it never has. Scope Lens (an ITEM, unconditional) IS wired.

**THE PROBE HAD TO BE REWRITTEN, and that is the actual answer to "is it a bug".** It read
`dmgRange(Night Slash) > dmgRange(the same move with its id changed)` — it was asking the PRICER for
an expectation, which is the thing that must not happen. It is now behavioural and pinned at a roll
that SEPARATES the rates: **0.1 is below 1/8 (0.125) and above 1/24 (0.0417)**, so a base-rate move
cannot crit on it and a one-stage move must. Four arms, because two cannot attribute it — Shell Armor
is the discriminator on the ratio move, and **Crunch** (Dark, physical, same attacker, same target, no
crit ratio) is the control that must not move at all. An engine that simply raised the base rate for
everything passes a two-armed version and fails this one. Reads
`Night Slash plain 100 / Shell Armor 67  |  Crunch plain 77 / Shell Armor 77`.

**THE DIFFERENTIAL WENT 1/400 TO 5/400 THE MOMENT THE ENGINE LEARNED THE MECHANIC, AND THE HARNESS
WAS WRONG.** Four of the five new rows were Flower Trick and Frost Breath with MEDICHAM exactly 1.5x
above the reference, because `test-engine-diff.js` pinned `move.willCrit = false` — right for a random
crit, which is noise both engines must be held to, and wrong for the three moves whose crit is not
random at all. **CONTROL FIX 11** pins it to the move's own dex value, so it now only ever CLEARS a
crit that would otherwise be rolled. Back to **1/400** at seed 20260804, same single SUSPECT row.

**`preventsCrit` (151 uses) had never been probed at all** and now is, through the sharpest available
form: Flower Trick's max into a plain Garchomp against the same into a Shell Armor one, with a third
arm carrying no crit tag to show the plain number really is the un-crit one. `plain 123, Shell Armor
82, no crit tag 82`.

**One that is still NOT a one-line fix, called out so nobody starts it by accident:**

- **`writesAccuracy` (987) and `accuracyMod` (927) are blocked on a signature, and the cost is now
  stated rather than gestured at.** `moveAccuracy(id, field)` takes neither the attacker nor the
  defender, so No Guard, Compound Eyes, Sand Veil and Snow Cloak have nowhere to be read from. Both
  probes clear their control — the No Guard one pins the roll at 0.9 against 80% accuracy, so the
  control correctly MISSES — and both still read identical across the knob, which by Lesson 5 means
  unwired rather than unimportant.
  **What the change costs: 11 call sites across 4 files.** Inside `medicham2-browser.js`,
  `moveAccuracy` is read by `playerAction` (which has both bodies), the battle loop's to-hit roll
  (both), the `affect` branch's status roll (both), the status branch (both), `bestMoveVs` (both) and
  `expectedHitsOf` (**neither** — it is called from `dmgRange`, which is pure and is handed no field).
  `engine/exposure.js`, `engine/board.js` and `engine/position_features.js` each call it too, and the
  last two are **not ENGINE's** — a signature change there is a feature-vector change and therefore
  the refit edge MEASURE owns. The compatible shape is `moveAccuracy(id, field, att, def)` with both
  optional, which leaves every existing caller correct and lets the six that have the bodies pass
  them; `expectedHitsOf` would keep the two-argument form and the ability would simply not apply
  there, which is honest because a pure pricing function has no attacker. **It is a deliberate pass,
  not a one-liner, and it should not be started inside another division's run.**

- **`needsTargetToAttack` / Avalanche — VERDICT: the probe asks for a rule that does not exist, and it
  is left MISSING on purpose.** Avalanche doubles when the USER was damaged BY THAT TARGET THIS TURN.
  The probe compares a fresh body against one whose `curHP` was halved — i.e. it asks `dmgRange` to
  double on "the user is below full HP", which is not the mechanic and would be a new wrong number on
  every hurt Avalanche user. `dmgRange` is handed no turn state and must not invent any; the tag's
  own param is the prose string `"target attacking"`. **13 corpus uses.** The nine other members of
  the tag include Sucker Punch (6,673), which is already fully modelled through
  `failsIfTargetNotAttacking` — so the tag is not inert, only this member is.

## Ordering the queue

`tests/mechanics_rank.js` ranks unread tags by corpus usage — use it, not intuition, and read the
result against Lesson 3: **usage counts are sheet counts.** Blaze reads 4,585 uses and is worthless
because 30 of 54 entries are a Charizard that megas into Drought on turn one. Ice Scales, Filter,
Aerilate, Prism Armor, Punk Rock and Ripen read zero.

The damage disagreements in the generated block are ordered by `uses` for the same reason, and carry
the same caveat.

## Before wiring a new derived tag

Print what it matched. Every derivation over-matches on the first try — `refusesStatusMoves` caught
Telepathy and Wonder Guard, `speedOnItemLoss` caught Sticky Hold, `failsIfTargetNotAttacking` caught
Quick Guard, Wide Guard and Round. See `docs/LESSONS.md` §4.

## Done looks like

- The census `live` count is higher than it was.
- No probe that passed yesterday fails today.
- The differential test finds fewer disagreements **at the same `--seed` and `--n`**, or the same
  ones with smaller error. Quoting a residual without its seed is quoting a coin flip: the sampler
  used bare `Math.random()` until 2026-08-04, and two runs on identical source gave 6 and then 3.
- Nothing in the hand list above that has not become a probe.

**`missing` going UP is not a regression, and this is the one place the rule is easy to misread.**
It rose 12 → 42 on 2026-08-04 while `live` rose 42 → 100, because 88 probes were written for
mechanics nobody had asked about before. The number that may never fall is `live`. A rising `missing`
means the census stopped flattering the engine.

## The one thing this division owes the others

A **named engine release**. Fixes batch; the release is what triggers the refit and the restamps —
see [DIVISIONS.md](DIVISIONS.md). Landing engine changes continuously is what leaves SEARCH
measuring a build that no longer exists.
