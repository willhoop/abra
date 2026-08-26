# THE MECHANICS CLAUSE — the ranked work list for driving it to zero

Read-only diagnosis, 2026-08-26 ~08:10Z. Nothing was run that plays a game; every artifact was read
with `git show HEAD:<file>` because an ENGINE agent is live in `engine/medicham2-browser.js`.

Sources read: `data/all-mechanics-fire.json` (HEAD), `data/tags.json` (HEAD),
`data/click-counts.json` + `data/sheet-usage.json` (HEAD, the reach denominators),
`data/game-differential.json` (HEAD), `engine/quarantine.js` (HEAD, the clause itself),
`pokemon-showdown/sim/battle-actions.ts`, `pokemon-showdown/data/{moves,abilities}.ts` and
`pokemon-showdown/data/mods/champions/`.

---

## 0. THE ARTIFACT IS STALE AS OF 08:05Z, AND IT WAS NOT STALE WHEN THE BRIEF WAS WRITTEN

| thing | stamp |
|---|---|
| `data/all-mechanics-fire.json` | `generated 2026-08-26T07:30:28.160Z`, `release 419e9636ec6a` |
| `data/engine-release.json` **on disk now** | `current 7fc604e5bc44`, `cut 2026-08-26T08:05:11.373Z` |
| `engine/medicham2-browser.js` mtime | 2026-08-26T08:07:03Z — **one minute before this read** |

`mechanicsClause()` short-circuits on `ranOn !== curId` before it computes anything. Run right now it
returns **"MEASURED AGAINST A DIFFERENT ENGINE"**, not "10 of 17". The rows below are true of release
`419e9636ec6a` and of nothing else.

**Two of tonight's landed roots are in the artifact and one is not.** `f0fd9f69` (Supreme Overlord,
06:17Z) and `05165d94` (the Protect counter, 06:58Z) both precede the 07:30Z run, so their effects are
already reflected. The **`HitProtect` clause in `guardRefusalOf` is UNCOMMITTED** — HEAD's
`medicham2-browser.js` mentions `HitProtect` twice, the live file mentions it twelve times. Every row
in section 2 that turns on a Protect refusal (the three-row group M1) must be re-measured before work
is planned on it.

---

## 1. VERDICT — THE 10 ARE 8 MECHANISMS, NOT 10 DEFECTS

Grouped by mechanism, the way `docs/CARD-REVIEW-2026-08-22.md` says to. Usage is `clicks / 64,846
stored games` for moves and `teams / 13,116 open-sheet games` for abilities, recomputed here from the
same two artifacts the clause reads.

| # | mechanism, in plain words | rows it closes | usage | board or narration |
|---|---|---|---|---|
| **M1** | A spread move resolves **target by target**; the authority runs each hit STEP across every target first, so a Protect refusal is announced before any target is affected | `stringshot`, `cottonspore`, `teeterdance` — **3** (+1 whole-game row) | 46 + 31 + 33 clicks | narration, measured |
| **M2** | The item-swap `-activate` prints **our move id** where both Trick and Switcheroo print the constant `move: Trick`, and drops the `[of]` field | `switcheroo` — 1 | 85 clicks | narration, measured |
| **M3** | Shell Side Arm's **category choice** (physical vs special, whichever computes larger) has no representation anywhere | `shellsidearm` — 1 | 101 clicks | **BOARD**, measured |
| **M4** | Smack Down's volatile has **no airborne gate** — we ground a body that was never in the air | `smackdown` — 1 | 59 clicks | **unknown** — the deciding leaf was not compared |
| **M5** | Sand Force's boosted-type list was derived as a **single type** — `"Rock"` where the authority boosts Rock, Ground **and** Steel | `sandforce` — 1 | 34 teams | **BOARD**, measured |
| **M6** | Berserk boosts **inside** the multi-hit loop; the authority boosts after the whole move, past `-hitcount` | `berserk` — 1 | 56 teams | narration, on a **truncated** walk |
| **M7** | Attract's gender immunity — `medicham2` has **no gender at all**, so the fixture cannot ask the question and we answer with silence | `attract` — 1 | 30 clicks | **unknown** — leaf not compared |
| **M8** | Supreme Overlord's `fallenundefined` — **the authority is wrong and this is already declared** | `supremeoverlord` — 1 | 112 teams | narration, measured |

**TOP THREE BY WHAT CAN BE DRIVEN TO THE BOTTOM**

1. **M1, the spread hit-step pipeline.** Three of the ten rows, plus one of the 21 whole-game
   first-divergences (`ordering :: |-miss|p1b|p2b <> |-activate|p2a|protect`, Protect at 134,710
   clicks), plus it is the frame the unread `immunityGate` needs — the tag itself records
   `"step": 3` and `"blocksBefore": ["hitStepAccuracy","hitStepBreakProtect","hitStepStealBoosts",
   "hitStepMoveHitLoop"]`, which is meaningless until the steps exist. Highest yield, highest risk:
   it is a structural change to the move resolver.
2. **M8, Supreme Overlord — DELETE THE ROW, DO NOT FIX IT.** It heads the list at 112 teams and it is
   the line `quarantine.js` already declares `AUTHORITY-WRONG` at line 1283 with `match:
   /fallenundefined/`. The whole-game clause excuses it; the mechanics clause has no declaration
   mechanism and counts it. **One entity is simultaneously a declared non-defect and the worst row on
   a failing gate.**
3. **M3 and M5, the two board-material rows.** One row each, but they are the only two of the ten that
   move an HP number, and both have a confirmed mechanism (see §2) rather than a hypothesis.

**DOES ONE FIX CLOSE MULTIPLE ROWS? Yes, exactly once.** M1 closes three. Every other mechanism closes
exactly one row. There is no second multiplier hiding in this set.

**THE BRIEF'S SWITCHEROO HYPOTHESIS IS REFUTED.** `move:switcheroo` is **not** the immunity gate. The
gate is real and `medicham2-browser.js` reads `immunityGate` **zero times** at HEAD (confirmed by
count) — but Switcheroo's gate is `!target.hasAbility('stickyhold')` and the fixture's target is a
Feraligatr, so it never fires. The row's first divergence is the `-activate` **name**. The immunity
gate does own one row of the ten: **`attract`** (M7), whose gate is the gender pair.

**AND THE 67 THAT NEVER FIRED ARE WORTH MORE THAN ALL TEN ROWS COMBINED — see §3.**

---

## 2. THE TEN, ONE AT A TIME

Verbatim usage, mechanism, evidence class, and the fix. `us`/`sd` are the artifact's own leaf values.

### M1 — spread moves: `stringshot` (46), `cottonspore` (31), `teeterdance` (33)

All three carry an identical divergence: the authority emits
`|-activate|p2b: Charizard|move: Protect` where we emit the effect on the **other** target first
(`|-unboost|p2a: Feraligatr|spe|2` twice, `|-start|p2a: Feraligatr|confusion` once). The comparator
classed all three `ordering`, which is the class it assigns when both lines exist on both sides — so
this is a position difference, not a missing line.

**Mechanism, READ not guessed** (`sim/battle-actions.ts:550-577`). `trySpreadMoveHit` builds an array
of eight step functions and runs **each step across the whole target array** before the next:

```
0 hitStepInvulnerabilityEvent   1 hitStepTryHitEvent      <- Protect answers HERE
2 hitStepTypeImmunity           3 hitStepTryImmunity      <- `-immune` HERE
4 hitStepAccuracy               5 hitStepBreakProtect
6 hitStepStealBoosts            7 hitStepMoveHitLoop      <- effects applied HERE
```

There is no path in which one target's effect (step 7) precedes another target's Protect (step 1).
**The source settles this and no target-order probe is needed** — target order cannot produce the
observed stream. We interleave per target.

**Board or narration:** narration, measured. `boundaries_agreed 2/2`, `diffs: []`, 394 leaves
compared, `state_parted_on_turn: null` on all three.

**Also closes:** the whole-game row `ordering :: |-miss|p1b|p2b <> |-activate|p2a|protect` (1 of 21) —
same root, because `-miss` is step 4 and Protect is step 1.

**Warning:** the uncommitted `HitProtect` clause in `guardRefusalOf` touches Protect refusals. These
three must be re-measured on the current tree before any work is planned.

### M2 — `switcheroo` (85 clicks)

```
SHOWDOWN  |-activate|p1a: Arbok|move: Trick|[of] p2a: Feraligatr
MEDICHAM  |-activate|p1a: Arbok|move: switcheroo
```

**Mechanism.** `data/moves.ts` switcheroo's own `onHit` ends with
`this.add('-activate', source, 'move: Trick', '[of] ' + target)` — **Switcheroo announces itself as
Trick**, byte for byte the same line Trick emits. Our WIRE 107 branch
(`medicham2-browser.js` HEAD, the `kind:'trickitem'` arm) writes `TR.act(m,'move: '+a.mv)` — the raw
move id. `move:trick` survives the comparator's lowercasing by coincidence; `move:switcheroo` does not.
That is why Trick (501 clicks) is not on this list and Switcheroo is.

**Board or narration:** narration, **measured**. `boundaries_agreed 2/2`, `diffs: []`, and
`board_not_compared` states explicitly that *"the current item IS compared"* — so the swap itself
agreed.

**Fix:** the constant `move: Trick` for both members of `takesTargetItem{swaps:true}`, plus the `[of]`
field. The `[from] move: <Name>` on the two `-item` lines is proper-cased in the authority and
lower-cased by us; check whether the reducer keeps that field before touching it.

**This is the cheapest row on the board.**

### M3 — `shellsidearm` (101 clicks) — BOARD

```
SHOWDOWN  |-damage|p2a: Feraligatr|861/960      (99 damage from full, turn 1)
MEDICHAM  |-damage|p2a: Feraligatr|872/960      (88 damage from full, turn 1)
board     p2.active[0].hp  us 752  sd 741       family active[].hp, off-by-4-or-more
```

**The die is excluded by construction.** The harness runs `game_differential`'s `bottom-tie-first`
arm, which pins `damageIndex: 15` on Showdown and `CORNER_BOTTOM` on medicham2 — both engines take the
**minimum** roll. A damage-number divergence here is a base-damage difference, not a roll index.

**Mechanism.** `data/moves.ts` shellsidearm carries an `onModifyMove` that computes the physical and
special damage by hand and flips `move.category` to Physical if physical is strictly larger (coin-flip
on a tie). **`data/tags.json` has no representation of it whatever.** The only thing it carries is
`dualPurpose: {"atFoe":"90 BP attack","atAlly":"different effect"}` — which is a *wrong* description of
this move's dual purpose, and it is prose either way. `medicham2-browser.js` mentions `shellsidearm`
**zero times**, correctly, because it matches on shape and the shape was never derived.

Same family as CARD-REVIEW §C1–C3: a fact that lives in a handler, so `tag_dex` cannot see it.

### M4 — `smackdown` (59 clicks)

```
SHOWDOWN  |move|p2a: Feraligatr|Agility|...     (nothing at all from Smack Down)
MEDICHAM  |-start|p2a: Feraligatr|move: smackdown
```

**Mechanism, confirmed by reading both sides.** The authority's `smackdown` condition `onStart` sets
`applies` only for a Flying type, Levitate/Eelevate, a cancelled Fly/Bounce, Magnet Rise or
Telekinesis, and **`if (!applies) return false;` — no volatile, no line.** Feraligatr is Water.
`data/tags.json` gives smackdown `statusInflict: [{volatile:"smackdown", chance:100}]` with **no
gate**, so we apply it unconditionally.

**Board or narration: UNKNOWN, and that is the finding.** The row reads `ANNOUNCEMENT-ONLY`, but it
also carries `core_leaf_unchecked: true` and `uncomparable_leaves: ["volatile:smackdown"]` — **the one
leaf that would settle it was not compared.** We are holding a volatile the authority does not hold;
`GROUNDING_VOL=['ingrain','smackdown']` at `medicham2-browser.js:4253` is what reads it. Calling this
narration would be a guess.

**Fix:** `tag_dex` must derive the `applies` predicate (the same shape Thick Fat already gets right,
see M5), and the engine must gate on it.

### M5 — `sandforce` (34 teams) — BOARD

```
SHOWDOWN  |-damage|p2a: Feraligatr|702/960      turn 3, sandstorm fixture, Excadrill
MEDICHAM  |-damage|p2a: Feraligatr|718/960      16 HP apart
board     p2.active[0].hp  us 658  sd 642
control   board_control_arm: NO-DIVERGENCE  (the Sand Rush arm agrees with the authority)
```

**The control clears the knob.** Swap Sand Force for Sand Rush and the boards agree; leave Sand Force
in and they part. The ability is wired (`medicham_moved: true`, verdict `FIRED`) — so **ROADMAP #312's
"Sand Force has no multiplier" is NOT what this row is.**

**Mechanism, confirmed by reading, no game required.**

```
data/abilities.ts:3950   if (move.type === 'Rock' || move.type === 'Ground' || move.type === 'Steel')
data/tags.json           sandforce -> damageBoost { mult: 1.3, onType: "Rock", inWeather: ["sand"] }
```

Champions overrides nothing here. `medicham2-browser.js` compares with `===` at every site
(`_db.onType===mvT`, four of them), so **we boost Rock and refuse Ground and Steel.** The preflight
staged Bulldoze — a Ground move — as this row's trigger.

**Blast radius, measured:** Sand Force is the **only** `damageBoost` in `data/tags.json` whose
authority handler names more than one type (the full set of `damageBoost.onType` rows is firemane,
blaze, overgrow, sandforce, swarm, torrent, waterbubble). The multi-type SHAPE is already derivable —
Thick Fat carries `halvesTypeDamage {types:["Ice","Fire"]}`, a list. So this is one scalar that should
have been a list, it closes one row, and it is low risk.

**Not claimed:** which move produced the 16 HP. The divergence is on turn 3 with unknown prior HP, so
no ratio can be derived from the artifact — a missing 1.3x is a sufficient explanation but is not
proven by this row alone. §4 names the command.

### M6 — `berserk` (56 teams)

```
SHOWDOWN  |-hitcount|p1a: Drampa|2
MEDICHAM  |-boost|p1a: Drampa|spa|1
```

**Mechanism.** `-hitcount` is emitted at `battle-actions.ts:978`, at the END of
`hitStepMoveHitLoop`. Berserk hangs on `onAfterMoveSecondary`, which runs at `:814` — **after the loop
returns.** The authority also evaluates the crossing once, with `move.totalDamage` for a multi-hit,
not per hit. We boost inside the loop. Trigger staged: Scale Shot into a Drampa.

Same family as CARD-REVIEW §A1 (`onDamagingHit` wrong in ORDER and in FREQUENCY).

**Board or narration: narration on a TRUNCATED walk — weaker than the others.** The row reads
`ANNOUNCEMENT-ONLY` with `diffs: []`, but `end_reason: "THREW"` and `leaves_compared_min 361` against
a max of 394. Do not quote "no board difference" from this row without re-running it.

**Second half, unmeasured:** Berserk's `onTryEatItem`/`checkedBerserk` defers a healing berry
(`defersHealingBerry: true` is in our tag). Firing at the wrong point in the loop is exactly what that
flag guards. Nothing here staged a berry.

### M7 — `attract` (30 clicks)

```
SHOWDOWN  |-immune|p2a: Feraligatr
MEDICHAM  |upkeep                    ("the move executed and produced no consequence line at all")
```

**Mechanism — and the preflight already wrote it down**: *"every body this fixture builds is declared
genderless — `buildPair` writes gender N on both sides **because medicham2 has no gender at all**. The
authority is right to refuse it; this board cannot ask the question."* All seven rungs were attempted
and all seven came back `-immune`.

This IS the unread `immunityGate` — attract's gate is `genderPairs` and `medicham2-browser.js` reads
`immunityGate` **0 times** and `genderPairs` **0 times**.

**Board or narration: UNKNOWN.** `core_leaf_unchecked: true`, `uncomparable_leaves:
["volatile:attract"]`, and `board_not_compared` already declares attract's leaf unwired *"because
wiring a leaf whose two shapes have never been SEEN is how a comparator starts manufacturing
divergences."*

**Two separable pieces of work, and only the first is cheap.** (a) announce `-immune` when the gate
refuses — that is M1's step 3 and it is shared with Leech Seed, Trick, Endeavor and Worry Seed;
(b) give medicham2 a gender model, without which Attract can never be staged at all. Rank (a) with M1
and leave (b) alone at 30 clicks.

### M8 — `supremeoverlord` (112 teams) — **NO ENGINE WORK. DECLARE IT.**

```
SHOWDOWN  |-end|p1a: Kingambit|fallenundefined|[silent]
MEDICHAM  (nothing — the next line is the incoming |switch|)
```

`quarantine.js:1281-1290` already carries this, `kind: 'AUTHORITY-WRONG'`, `match:
/fallenundefined/`: *"`data/abilities.ts` guards supremeoverlord's `onStart` on
`pokemon.side.totalFainted` and does NOT guard its `onEnd`, so when nothing has fainted
`effectState.fallen` is never set and the template emits the literal string `fallenundefined` on a
`[silent]` line players never see… Reproducing a typo is not correctness."*

Commit `f0fd9f69` (06:17Z) landed all three real narration lines and says so explicitly: *"n = 0 →
nothing on entry; the authority's `fallenundefined` on exit"*, deliberately left silent. The artifact
regenerated at 07:30Z, **after** that fix, and the surviving row is the declared case — the roster's
gauntlet is *"built so nothing ever faints"* (the row's own `faced_why`), so `totalFainted` is 0 and
this is the only line that can appear.

**So the row is live in the artifact and is not a defect.** The mechanics clause reads
`classifyMechanics`, which applies reach and decision-impact and **never consults the declared list**
that the whole-game clause applies. Two clauses, one entity, opposite answers.

This is a MEASURE question, not an ENGINE one: either `classifyMechanics` shares
`wholeGameClause`'s declaration list, or `all_mechanics_fire.js` refuses to mark a row diverged when
its cause matches a declaration. **Do not spend engine time on Kingambit.**

---

## 3. THE 67 THAT NEVER FIRED CONTAIN THE NINE MOST-PLAYED MECHANICS IN THE FORMAT

The brief asks whether any of the 67 is one this format actually plays. It is not a tail — **it is the
head**, by an order of magnitude over anything on the diverging list.

| ability / item | teams / 13,116 | verdict |
|---|---|---|
| `prankster` | **9,313** | DID-NOT-FIRE (unexplained) |
| `hospitality` | **6,740** | DID-NOT-FIRE (unexplained) |
| `flowerveil` | 4,109 | cannot-fire-in-this-fixture |
| `lightningrod` | 3,326 | cannot-fire-in-this-fixture |
| `unburden` | 3,026 | cannot-fire-in-this-fixture |
| `lightclay` (item) | 2,798 | cannot-fire-in-this-fixture |
| `innerfocus` | 1,351 | DID-NOT-FIRE (unexplained) |
| `friendguard` | 1,056 | DID-NOT-FIRE (unexplained) |
| `technician` | 826 | DID-NOT-FIRE (unexplained) |
| `widelens` (item) | 1,005 | cannot-fire (the pinned arm makes accuracy unobservable — declared) |

The **worst diverging row on the failing clause is 112 teams.** Prankster is 83x that and the clause
is structurally silent about it. 20 of the 58 ability rows are `did_not_fire_unexplained`; the five
above are the top of that list.

`quarantine.js`'s split is right — a fixture that cannot stage a mechanic is a harness defect and must
not be folded into an engine count. But **"10 of 17 played and uncleared" describes a population that
excludes the nine mechanics people actually bring.** Driving the clause to zero would not change that.

`hospitality` is a second reason to care: CARD-REVIEW §A2 names it as one of five legal carriers of
`onSwitchInPriority`, and that ordering defect is unmodelled. The instrument cannot currently see it.

**Not proposed as ENGINE work here** — a harness gap belongs with whoever owns `all_mechanics_fire.js`'s
fixture builder, and five of these want a partner slot, an ally, or a status the gauntlet refuses to
create. Named so it is not invisible.

---

## 4. THE FOUR SHELVED — NO WORK PROPOSED

`bittermalice` (519 clicks) and `nightdaze` (54) are both `switch: a different body`, both carriers
Zoroark / Zoroark-Hisui — **Illusion**. `forewarn` (4 teams) and `metronome` (19 teams) are the
owner's closet (`tests/roster.js DEFERRED`: copycat, battlebond, stall, pickup, metronome,
anticipation, forewarn). All four carry `counts_against_the_gate: false`. Left alone as instructed.

---

## 5. WHERE THE INSTRUMENT WAS SUSPECTED FIRST, AND WHAT IT SAID

- **The damage rows are not the die.** The harness runs `bottom-tie-first`; Showdown gets
  `damageIndex: 15` and medicham2 `CORNER_BOTTOM`, both the minimum roll. `game_differential`'s own
  header records `-damage field 3` at **0 of 183 games** in this arm against 226 of 491 in the middle
  arm. M3 and M5 are real.
- **Two rows' verdicts rest on leaves the comparator did not read** (M4 `volatile:smackdown`, M7
  `volatile:attract`), and both are declared as such in the artifact rather than hidden.
- **One row's verdict rests on a walk that threw** (M6, 361 of 394 leaves).
- **Every ability row in this run carries `control_not_quiet`** — 108 of them, including berserk,
  sandforce and supremeoverlord: *"the CONTROL ability is itself live in this run, so the pair cannot
  say which of the two moved the game."* That weakens the FIRED/DID-NOT-FIRE verdict. It does **not**
  weaken the divergences above, which are direct authority-vs-medicham2 stream comparisons on the
  mechanic arm.
- **`rivalry` is the one `over_matched` preflight row**, on the `gender` clause — the same missing
  gender model as M7, and it is explained rather than unexplained.

---

## OWED, NOT RUN

Nothing below was executed. Every command assumes
`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` and that no other agent is writing
`engine/medicham2-browser.js`.

**1. The artifact is stale — re-run it before anybody plans against §1.**

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  tools/lownode.cmd engine/all_mechanics_fire.js --kind all --write
node engine/status.js
```

**2. Confirm the three M1 rows survive the uncommitted `HitProtect` clause** (they may already be
gone; HEAD does not contain that change):

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  tools/lownode.cmd engine/all_mechanics_fire.js --kind moves --only stringshot,cottonspore,teeterdance
```

**3. Name the move behind the 16 HP in M5** — the artifact cannot, because the divergence is on turn 3
with unknown prior HP:

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  tools/lownode.cmd engine/all_mechanics_fire.js --kind abilities --only sandforce
node engine/replay_one.js --from data/all-mechanics-fire.json --row ability:sandforce
```
Expected if the `onType` scalar is the whole story: the divergent hit is a **Ground or Steel** move and
`sd / us == 1.3` to truncation. If the hit is a **Rock** move, `onType` is not the cause and a second
factor is in play — say so rather than landing the list fix on the strength of this row.

**4. Probe-first, before any of the six fixes.** Each is a census probe that must be shown RED on the
current engine before the fix, per the working order:

| mechanism | the probe, stated as an outcome | the control that clears the knob |
|---|---|---|
| M1 | a spread status move into two foes, one behind Protect: the `-activate move: Protect` must precede every `-unboost`/`-start` | the same move with **neither** foe protected — no `-activate` at all, effects on both |
| M2 | Switcheroo's `-activate` reads `move: Trick` with `[of] <target>` | **Trick** in the same fixture must be byte-identical to it |
| M3 | Shell Side Arm into a body whose Def **exceeds** its SpD, and a second into one whose SpD exceeds its Def: the two must pick **different** categories | the same move into a body with Def == SpD |
| M4 | Smack Down into a Water type: **no** `-start`, no `smackdown` in `_vol` | Smack Down into a Flying type: `-start` present |
| M5 | Sand Force + Bulldoze (Ground) in sand: damage x1.3 | the identical turn **out of** sand — must move the number |
| M6 | Berserk under a 2-hit Scale Shot that crosses half on hit 1: exactly one `-boost`, emitted **after** `-hitcount` | the same body at Sap Sipper — no boost at all |
| M7 | Attract from a body of the opposite gender: the volatile lands. From the same gender: `-immune` | needs a gender model first; the `-immune` half rides M1's step 3 |

**5. The Supreme Overlord row is a MEASURE ticket, not an ENGINE one.** No command here — routing.

**6. Not owed, deliberately:** nothing on `bittermalice`, `nightdaze`, `forewarn` or `metronome`; no
whole-game differential run (a live agent owns it); no `--write` of any status or roster artifact.
