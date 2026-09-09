# NARRATION BATCH U — three mechanisms, two causes closed, one transfer, and a census probe that was pinning the bug

ENGINE. Written as the work happened; the verdict block is the last thing added.

---

## 0. THE SAMPLE, EVERY FLAG AND EVERY PIN

Identical for all three measurements; only `--release` moves.

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  tools\lownode.cmd engine\game_differential.js --steering empirical --release <id> \
  --arm middle --end-state --games 1200 --team-store data/team-pool-frozen --turns 50 --write
```

| pin | value |
|---|---|
| census | **830 rows**, `identical to the live census` on every run |
| arm pins | `de38d17e15a2` |
| team pool | `data/team-pool-frozen`, digest `0d103fb9fa87` |
| games played | **961** offered against `--games 1200`, **958 non-void** |
| turns cap | 50 |
| `--games` | **1200** — recorded because it is part of the sample definition, not a budget |

The releases, in order: `2a90ecca8005` (baseline — the LIVE tree at the start of this batch) ->
`a0b78b1f0f62` (U1 + U2) -> `7c6716f23df6` (U3, the published run).

**THE BASELINE HAD TO BE RE-TAKEN AND THAT IS NOT BOOKKEEPING.** Batch T published on
`eb46032d332c`; `data/abra-tags.js` was rebuilt after those runs, so on this batch's first
`engine/status.js` every whole-game and roster clause read *"MEASURED AGAINST A DIFFERENT ENGINE"*.
The baseline in this report is therefore a fresh run on `2a90ecca8005`, and it reproduces batch T's
21 NARRATION-ONLY causes **string for string, in the same order** — so nothing was lost, and the
before/after here is a like-for-like comparison rather than a comparison across a tag rebuild.

**`--out` WAS NEVER USED.** Every measurement wrote `data/game-differential.json`, the slot
`engine/status.js` reads. The one card-reading run carried `--dump-games 60 --dump-out
data/_narrationU-dump.json` alongside `--write`; the dump block is post-hoc and reads the finished
result set, so it cannot change what was measured.

---

## 1. WHAT WAS FIXED

| # | what the authority does | probe | knob |
|---|---|---|---|
| **U1** | `hitStepTypeImmunity` asks `targets[i].runImmunity(move, !move.smartTarget)` (`sim/battle-actions.ts:661`) and `runImmunity` opens its announcement with `if (!message) return false` — so a Dragon Darts that meets an immune body **writes nothing at all**. This engine wrote the line every time. | `tests/probe_smart_target_immune_line.js` | `MEDI_SMART_IMMUNE_LINE=1` |
| **U2** | Quick Claw's `priority <= 0` is the **relay var**, not the move's bracket: the call site is `runEvent('FractionalPriority', action.pokemon, null, action.move, 0)` (`sim/battle-queue.ts:249`), so the claw rolls, announces and adds its 0.1 on a PRIORITY click too. This engine refused it above bracket 0 — no line, and no nudge. | `tests/probe_quick_claw_above_bracket_zero.js` | `MEDI_FRACPRI_PRIORITY_GATE=1` |
| **U3** | Entry hazards tie on speed, priority and subOrder, so `resolvePriority` stamps `effectOrder` on `SwitchIn` handlers and `comparePriority` sorts it ASCENDING (`sim/battle.ts:994-999`, `:407-412`) — **they bite in the order they were laid**. This engine ran four `if` blocks in a fixed source order. | `tests/probe_hazard_lay_order.js` | `MEDI_HAZARD_FIXED_ORDER=1` |

Every knob was demonstrated to move the arm AND to part the stream, in a child process, on the same
run that asserted the fix.

---

## 2. U1 — A SMART-TARGET MOVE REFUSES A TYPE IMMUNITY IN SILENCE

**Cause closed:** `extra event emitted by medicham2 :: |-damage|p2a|H/H <> |-immune|p2b`.

### The scoreboard, said before the run

**The pool moves by exactly one cause and the lab sits still.** It has a pool witness (Dragon Darts
into Gengar + Primarina) and it is a LINE, not a mechanic, so no census row and no roster row can see
it. Hit at the point estimate.

### The rule

```
hitStepTypeImmunity(targets, pokemon, move) {
  ...
  for (const i of targets.keys()) hitResults[i] = targets[i].runImmunity(move, !move.smartTarget);
}                                                          sim/battle-actions.ts:653-662

runImmunity(source, message?) { ... if (!message) return false;   <- NO LINE AT ALL
                                    ... this.battle.add('-immune', this); }
                                                           sim/pokemon.ts
```

Champions overrides neither function and does not override `dragondarts` (asserted on every probe
run). **One legal smart-target move in this format, printed by the probe: Dragon Darts.**

It is the SAME FIELD, and therefore the same one-shot, that already silences the shield line — so
`_smartShieldSpent` was **renamed `_smartSpent`** and is now read by both roads. Two flags for one
field is the private-copy shape the FACTS-ARE-GLOBAL rule forbids, and the two roads would have
drifted the first time either moved.

### The arms

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| REAL — darts into [hittable, IMMUNE], neither shielded | **0** `-immune`, both darts on the other foe | **1** `-immune`, and the board parts at that line | matches |
| PLAIN — a non-smart Dragon move straight at the immune body | 1 `-immune` | matches | matches |
| SPENT — the same darts with the OTHER foe SHIELDED | **1** `-immune` (the shield ate the one-shot at step 2), 0 Protect lines | matches | matches |

**SPENT is the control that matters.** REAL and SPENT differ in exactly one bit — whether the
hittable foe shielded — so nothing but the one-shot can explain why one announces and the other does
not. PLAIN is what stops a green REAL arm reading as "this engine stopped announcing immunities".

### THE FIXTURE WAS WRONG THREE TIMES BEFORE THE ENGINE WAS, AND EVERY ONE WAS TOWARD A COMFORTABLE ANSWER

1. **The immune body was given Protect and told to click it**, so the shield answered at step 2 and
   **no arm ever reached the type-immunity step at all.** Three assertions were red against a fixture
   that had never staged the mechanic.
2. **The board map was read from a THROWAWAY game.** `playGame` does not guarantee that the sheet's
   first body lands in slot 0 — two arms built from the same sheet put the immune body in different
   slots — so the probe now resolves the aim by re-running per index and keeping the game whose OWN
   stream shows the intended body in the slot it aimed at.
3. **The idle click was derived as "any `target: 'self'` status move" and the alphabetical winner was
   ALLY SWITCH**, which swaps the two foe slots mid-turn. Every arm's map inverted under it. The idle
   set is now a pure self-boost, which is the filter `probe_smart_target_shield_line.js` already used
   and for the same reason.

Counters: `MEDSEEN.smartTargetImmuneSilent`, `MEDSEEN.smartTargetImmuneAnnounced`,
`MEDFAILS.smartImmuneLineRestored`, `MEDFAILS.smartImmuneSecondTargetAnnounced`.

**ONE CASE IS DELIBERATELY NARROWER THAN THE AUTHORITY AND IS COUNTED RATHER THAN HIDDEN.**
`hitStepTypeImmunity` reads `move.smartTarget` for EVERY target in one step and the step loop clears
it only afterwards, so TWO immune bodies in one volley are both silent upstream and only the first is
silent here. It needs both foes immune to Dragon. `MEDFAILS.smartImmuneSecondTargetAnnounced` is the
receipt.

---

## 3. U2 — QUICK CLAW FIRES ABOVE BRACKET 0, AND A CENSUS PROBE WAS ASSERTING OTHERWISE

**Cause closed:** `event missing from medicham2 :: |-activate|p1a|quickclaw <> |move|p2b|protect`.

### The scoreboard, said before the run

**The pool moves by one cause; the lab was expected to sit still and DID NOT.** That is the finding
below.

### The rule

```
action.fractionalPriority = runEvent('FractionalPriority', action.pokemon, null, action.move, 0);
                                                              sim/battle-queue.ts:249
quickclaw.onFractionalPriority(priority, pokemon, target, move) {
  if (move.category === 'Status' && pokemon.hasAbility('myceliummight')) return;
  if (priority <= 0 && this.randomChance(1, 5)) { this.add('-activate', pokemon, 'item: Quick Claw');
                                                  return 0.1; } }        data/items.ts:4985-4993
action.priority = priority + action.fractionalPriority;                  sim/battle.ts:2644
```

The trailing `0` IS the `priority` the handler receives. So the claw rolls on a Protect and on a Quick
Attack exactly as on a Body Press, and the 0.1 is added to whatever bracket the move already had.
Champions overrides neither the item nor the queue.

**THE DIE DOES NOT MOVE.** This engine's `_fpDraws` never contained the gate — 2026-08-27 un-gated the
DRAW and left the EFFECT gated, saying so in its own header (*"the DIE now agrees; the EFFECT does
not, and that is a separate defect on a separate line"*) and counting the gap as
`MEDFAILS.fracPriPriorityGateUnmodelled`. This batch is that line. The roll was already being taken at
the authority's address and thrown away, so **nothing about the RNG stream changes**.

### The arms

The board is built so that nothing can happen on it: all four active bodies are GHOST-typed and every
attack clicked is NORMAL-typed, so every click is an immunity. Turn count is derived from the PP of
every click on the board (the first draft asked for 24 and died at *"Facade is disabled"*).

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| PRIORITY — claw holder clicks a +1 attack, faster foe clicks the same | claw on turn index 5 of 19, and the **SLOWER body moves first on exactly that turn** | **no claw at all**, fast body first on every turn, and the stream parts | matches, turn for turn |
| BRACKET 0 — the same body clicks a +0 attack | claw on turn index 5 of 19 | matches | matches |

The ORDER is asserted and not just the line: an engine that announced the claw and then sorted the old
way passes an `-activate` count and fails this.

**THE FIXTURE WAS WRONG TWICE FIRST.** The per-turn order was read by matching the nickname in field 2
against the species name, and showdown writes the BASE name there for a regional forme
(`|switch|p1a: Typhlosion|Typhlosion-Hisui, L50|…`) — so every turn read as "the fast body went first"
and the order assertion was measuring nothing. It reads by SLOT now, off the `|switch|` details field.

### THE CENSUS PROBE WAS GREEN BECAUSE IT SHARED THE ENGINE'S MISREADING

`tests/test-mechanics.js`'s `item/fractionalPriorityAnnounce` row asserted, in as many words:

> *"`sim/battle-queue.ts:249` runs the whole event for `choice === 'move'` only, and Quick Claw's own
> handler adds `priority <= 0` — so a SWITCH and a PRIORITY CLICK must both stay silent on a winning
> roll."*

**The switch half is right. The priority half was false**, and the row was green for as long as the
engine shared the misreading — a test pinning the bug. The census went **830 live / 1 missing** the
moment the engine was fixed, and the row named itself.

**IT WAS SETTLED BY MEASUREMENT, NOT BY RE-READING.** The probe plays the authority and watches it
write `|-activate|p1a: Typhlosion|item: Quick Claw` on a +1 click, and the pinned pool's own card is
the same thing at +4 (a Rotom holding a claw clicking Protect). The census row's priority clause was
corrected to `one(clawPrio, …)`, the struck sentence left in place with the correction beside it, and
the census is back to **830 live / 0 missing**.

`MEDFAILS.fracPriPriorityGateUnmodelled` is **deleted** rather than left at a permanent zero — a
MEDFAILS row that can never move reads as "no board reached it", which is the silent-default shape.
The population it described is now `MEDSEEN.fracPriAboveBracketZero`.

---

## 4. U3 — ENTRY HAZARDS BITE IN THE ORDER THEY WERE LAID

**Cause closed:** `extra event emitted by medicham2 :: |-status|p1a|tox <> |-damage|p1a|H/H|[from]stealthrock`.
**One cause transferred in its place — see §5.**

### The scoreboard, said before the run

**The pool moves by one cause and the lab sits still** — no census row and no roster row stages two
hazards on one side in a chosen order. That is what happened; the census and all four roster stages
are unchanged in scope and verdict.

### The rule

```
if (callbackName.endsWith('SwitchIn') || callbackName.endsWith('RedirectTarget')) {
  // If multiple hazards are present on one side, their event handlers all perfectly tie in speed,
  // priority, and subOrder. They should activate in the order they were created, which is where
  // effectOrder comes in.
  handler.effectOrder = handler.state?.effectOrder;
}                                                              sim/battle.ts:994-999

comparePriority(a, b) { … || -((b.effectOrder || 0) - (a.effectOrder || 0)) || 0; }
                                                               sim/battle.ts:407-412
```

`-((b.effectOrder) - (a.effectOrder))` is ASCENDING: the condition created FIRST fires first. The
probe asserts on every run that neither `stealthrock` nor `toxicspikes` declares an
`onSwitchInPriority`, because a declared priority would decide the order before `effectOrder` was ever
reached.

`effectOrder` is stamped once, in `initEffectState`, when the condition is CREATED — `addSideCondition`
on an existing condition calls `onSideRestart` and does not re-stamp — so `layHazard` records the
ordinal only when `before === 0`. It is cleared when the layer is swept (Defog / Rapid Spin / Tidy Up)
and when a grounded Poison type ABSORBS the Toxic Spikes, because both of those REMOVE the side
condition upstream.

**THE SEQUENCE IS PER SIDE AND THE AUTHORITY'S IS PER BATTLE.** The only comparison anything makes is
between two conditions on the SAME side, so a per-side counter gives the identical order and cannot
leak between games. Stated rather than assumed.

### The arms — two boards differing in one bit

| arm | showdown | medicham2 pre-fix | post-fix |
|---|---|---|---|
| TSPIKES-FIRST | `POISON` then `ROCKS` | **`ROCKS` then `POISON`**, and the stream parts | matches |
| ROCKS-FIRST | `ROCKS` then `POISON` | matches | matches |

ROCKS-FIRST is the control that stops the fix being read as "swap the two". The knob restores the
source order, changes TSPIKES-FIRST and leaves ROCKS-FIRST alone.

**A LAYER WITH NO RECORDED ORDINAL KEEPS ITS OLD PLACE AND IS COUNTED.** A board seeded straight into
`sf.hz` never goes through `layHazard`; those sort LAST among themselves in the source order, which is
exactly the pre-batch behaviour, and `MEDFAILS.hazardLayOrderUnknown` is the receipt. A guessed ordinal
would be a silent default.

Counters: `MEDSEEN.hazardsBitInLayOrder`, `MEDFAILS.hazardFixedOrderRestored`,
`MEDFAILS.hazardLayOrderUnknown`.

---

## 5. THE MEASUREMENTS

Every row is the six-flag sample of §0 at the stated release.

| | baseline `2a90ecca8005` | U1+U2 `a0b78b1f0f62` | U3 `7c6716f23df6` |
|---|---|---|---|
| **BOARD-MATERIAL** (`state.games` less `state.games_board_never_diverged`) | **0 / 958** | **0 / 958** | **0 / 958** |
| NARRATION-ONLY causes | 21 | **19** | **19** |
| NARRATION-ONLY games | 21 | **19** | **19** |
| causes closed | — | 2 | 1 |
| transfers (new causes) | — | **0** | **1** |

**U1 AND U2 CLOSED TWO CAUSES WITH ZERO TRANSFERS.** The 19 causes on `a0b78b1f0f62` are the same 19
strings, in the same order, as the baseline's 21 minus the two named.

**U3 CLOSED ITS CAUSE AND ONE TRANSFERRED, SO THE HEADLINE DID NOT MOVE.** The hazard cause is gone and
a FOURTH member of the substitute family took its place:

```
- extra event emitted by medicham2 :: |-status|p1a|tox <> |-damage|p1a|H/H|[from]stealthrock
+ ordering                          :: |-end|p2a|substitute <> |-resisted|p1b|1
```

**THE TRANSFER WAS SETTLED BY MEASUREMENT AND NOT BY INFERENCE.** A `--dump-games 60` pass on
`7c6716f23df6` (no `--write`, so the gate slot was untouched) was diffed game by game against the
baseline dump, keyed on `config + seed`:

| | |
|---|---|
| games that STOPPED diverging | **2** — `omit-weather ...bo3-2656255792` (the Dragon Darts immunity) and `omit-intimidate ...2634721681` (the Quick Claw) |
| games that STARTED diverging | **0** |
| games whose CAUSE changed | **1** — `omit-protect ...bo3-2655715488`, the hazard game, `|-status\|p1a\|tox …` -> `|-end\|p2a\|substitute …` |

So it is a genuine within-game transfer: the game was stopped at its hazard line and now runs on to
its next parted line. **No game began diverging that was not diverging before.**

The new cause is the same mechanism batch T diagnosed and deliberately left, in the same shape:

```
turn 5, agreed:   |move|p2b: Garchomp|earthquake|p1a: Farigiraf     (a spread move at two targets)
showdown    |-end|p2a: Dragapult|Substitute   |-resisted|p1b: Sinistcha|1   |-damage|p1a …
medicham2   |-resisted|p1b: Sinistcha|1       |-end|p2a: Dragapult|Substitute   |-damage|p1a …
```

**This engine defers a substitute's `-activate|[damage]` / `-end` line until after the OTHER target's
damage; the authority finishes each target in turn order.** It is now FOUR cards, not three.

### The instruments, re-run on the final bytes

| instrument | result |
|---|---|
| `tests/test-mechanics.js` (regenerates the census) | **830 live, 0 missing, 830 probed, 0 threw, 0 hollow** |
| `tests/roster.js --stage items --reds --write --release 7c6716f23df6` | **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE, 18 of 18 anchors live** |
| `--stage abilities` | **0 DIFFER, 0 DID-NOT-FIRE, 44 of 44 anchors live** |
| `--stage moves` | **0 DIFFER, 0 DID-NOT-FIRE, 36 of 36 anchors live** |
| `--stage spine` | **0 DIFFER, 0 DID-NOT-FIRE, 17 of 17 anchors live** |
| `tests/test-engine-diff.js --n 6000 --seed 20260804` | **6000 agreed, 0 disagreed** |
| `engine/all_mechanics_fire.js --kind all --write` | **0 threw, 0 sheets unassembled** |

The same four roster stages were run on `a0b78b1f0f62` after U1+U2 and were clean on all four with
`dead: []` — **the anchors were checked after each of the two engine edits, not only at the end.**

The probe set was re-run on the final bytes: `probe_smart_target_immune_line`,
`probe_smart_target_shield_line` (the flag rename), `probe_quick_claw_above_bracket_zero`,
`probe_hazard_lay_order`, `probe_fractional_priority_draw`, `probe_fracpri_die_order` — all green.

---

## 6. WHAT WAS DELIBERATELY NOT ATTEMPTED, AND WHY

The brief asked for this explicitly.

- **THE RESIDUAL TRIO (`brn <> brn`, `psn <> psn`, `leftovers <> leftovers`) WAS SKIPPED ENTIRELY.**
  No new idea, and the brief said to say so rather than spend the batch there. Fourth batch running
  with no clean bill.
- **THE SUBSTITUTE FAMILY (now FOUR cards) WAS NOT ATTEMPTED.** Diagnosed by batch T as one mechanism
  and board-risky: the absorption is `onTryPrimaryHit` at spreadMoveHit's step 0, above the damage
  step, so moving where it RESOLVES rather than only where it ANNOUNCES can part a board. Third batch
  to say so.
- **THE STAMINA vs SPICY SPRAY CARD** is the residual-trio family (the order of `DamagingHit` handlers
  across two targets). Not attempted while that class is unexplained.
- **THE REDIRECT vs `-prepare` ORDER** and **THE POST-KO SWITCH-IN ORDER** are carried from batch T's
  diagnoses unchanged. One reading was added to the second: the authority DOES speed-sort replacement
  switches — `resolveAction` calls `getActionSpeed` and `BattleQueue` sorts through `speedSort` — so a
  side-order model is wrong in principle. **The actual Speeds of the two bodies were NOT read**, so
  this stays a hypothesis exactly as batch T left it.
- **TRICK'S MISSING `-fail`** (`|-fail|p2a <> |move|p2b|rockslide`, a Rotom clicking Trick at a
  Metagross) was diagnosed and NOT attempted. The authority's `trick.onHit` restores both items and
  `return false`s — reaching `runMoveEffects`'s generic `-fail` on the MOVER — whenever
  `target.item || source.item || (!yourItem && !myItem)`, and `takeItem` refuses a mega stone whose
  `megaEvolves` matches its OWN holder. **This engine's guard is `TAGS.has('item', …, 'megaStone')` on
  either side, which is coarser than the authority's rule**, and its own header says so. Emitting the
  `-fail` on the coarse road would write a line where the authority swaps, so the fix needs the guard
  tightened first — and tightening it moves a BOARD. Filed, not folded in.
- **`|upkeep <> |faint|p1a`** was investigated and left. The mechanism is ALREADY modelled: a duration
  expiry `continue`s past `fieldEvent`'s `faintMessages()` (`sim/battle.ts:565`), so a perish death is
  paid by the next handler that does not itself expire, or else below `|upkeep|` — and this engine has
  a derived follower table (`RESIDUAL_AFTER_PERISH`) and a `residualFollowerRuns()` presence test for
  exactly that. The card is a miss INSIDE that model, not an absence of one. **The next step is
  named:** replay this card's seed with `residualFollowerRuns` instrumented and print WHICH follower it
  found on a board whose only remaining handlers were three perishing bodies.
- **`|-immune|p2a|[ohko] <> |-miss|p1b|p2a` IS UNDIAGNOSED AND IS SAID SO.** The authority's only
  `-immune … [ohko]` site is `hitStepAccuracy`, whose else-branch needs
  `target.volatiles['dynamax'] || pokemon.level < target.level || target.hasType(move.ohko)` — and the
  card is a L50 Mr. Rime's Sheer Cold into a L50 Grass/Dark Meowscarada, which satisfies none of them.
  Either something changed the target's types or levels earlier in that game, or the reading is wrong.
  **It was not staged, so no claim is made.**
- **`|-miss|p1a|p2a <> |-status|p2a|slp|[from]sleeppowder` — A NEW OBSERVATION, NOT A FINDING.** The
  card is a Sleep Powder BOUNCED by Magic Bounce: the authority's bounced copy MISSES (Sleep Powder is
  75%) and this engine's lands. That points at the bounce road either not rolling accuracy at all or
  rolling it at a different address. Adding a draw moves the stream, which is the care batch S's Leech
  Seed road needed, so it is not a one-line change. Named for batch V.

### AND ONE CARD IS WORTH MORE THAN ITS CLASSIFICATION

`event missing from medicham2 :: |-damage|p1a|H/H <> |move|p1a|psyshock` is **a board defect wearing a
NARRATION-ONLY label.** The card is a two-hit Dual Wingbeat into a Delphox behind a Substitute:

```
showdown    |-end|p1a: Delphox|Substitute   |-damage|p1a: Delphox|71/150   |-hitcount|p1a: Delphox|2
medicham2   |-end|p1a: Delphox|Substitute   (nothing — the volley stops)
```

**79 HP and a whole second hit.** It is classified NARRATION-ONLY only because Delphox died to a Kowtow
Cleave later in the same turn in BOTH engines, so no board was ever sampled between the two states.
The candidate site is the substitute road in the hit loop, which ends with `R.out = true; return;` —
the authority's `onTryPrimaryHit` returns a NUMBER, and `hitResults[i] || hitResults[i] === 0` keeps
the target in the volley, so the next hit lands on the body once the doll is gone. **Stated as a
candidate site and not as a fix**, because whether `R.out` drops the row for the whole volley or only
for that hit was read from the card and not from the loop.

---

## 7. WHAT IS STILL OPEN

- **THE SUBSTITUTE FAMILY, NOW FOUR CARDS** (§6), plus the multi-hit card above, which may be the same
  road seen from the resolution side.
- **THE RESIDUAL TRIO** (§6), untouched for the fourth batch.
- **THE STAMINA / SPICY SPRAY CARD**, the same family.
- **THE REDIRECT vs `-prepare` ORDER** and **THE POST-KO SWITCH-IN ORDER**, both carried.
- **TRICK'S `-fail`**, newly diagnosed, blocked on the coarse mega-stone guard.
- **THE PERISH `|upkeep|` DRAIN**, a miss inside an existing model, with a named next step.
- **THE OHKO CARD**, undiagnosed.
- **THE BOUNCED-MOVE ACCURACY ROLL**, a new observation.
- **`kind === 'boostally'`'s SILENT SHIELD**, carried from batch T unchanged.
- **REFLECT TYPE'S EFFECT**, still unmodelled.
- Everything else on the hand lists in `docs/ENGINE.md`.

---

## 8. THE SEAM THE BRIEF ASKED ABOUT, AND IT IS ALREADY FIXED

*"A PROBE THAT LOADS `engine/game_differential.js` WITHOUT `--release` CUTS A RELEASE AS A SIDE
EFFECT."* `tests/_live_release.js` already solves it: required BEFORE `game_differential.js`, it
redirects `cut` and `open` to a throwaway store under the OS temp directory and prints the override on
stderr, so `data/releases/` and `data/engine-release.json` are never touched. **All three of this
batch's probes require it on their first line**, and the batch created **no stray release
directories** — the only two cuts in `data/releases/` are the two named in §0.

---

## 9. DEBRIS LEFT IN THE WORKING TREE

Named rather than removed:

- `data/_narrationU-dump.json` — the 21-card BASELINE dump this batch was read from. Untracked.
- `data/_narrationU-after-dump.json` — the 19-card dump on the final release, taken WITHOUT
  `--write` so the gate slot was untouched. It is what settled the transfer in §5. Untracked.
- Three new probes, all intended: `tests/probe_smart_target_immune_line.js`,
  `tests/probe_quick_claw_above_bracket_zero.js`, `tests/probe_hazard_lay_order.js`.
- `data/roster.{items,abilities,moves,spine}.json` and their `.prev.json`, `data/roster.json` —
  written by the roster runs themselves.
- `data/mechanics-census.json`, `data/game-differential.json`, `data/all-mechanics-fire.json`,
  `data/engine-diff.json`, `data/engine-release.json`, `data/provenance-stamp.json` — rewritten by the
  runs above.
- `data/tags.json` is **unchanged**, so `data/abra-tags.js` needed no rebuild.
- Three scratch derivation scripts under the session scratchpad, never in the repo.
- **The tree was CLEAN at `731ecad7` when this batch started.** The two untracked files named in batch
  T's debris list (`data/verification/_prediction-2026-09-08-gap-286-ordering.json` and
  `tests/probe_midturn_herb_resort.js`) were **not present**; something between the two batches took
  them. Reported, not investigated.
- **`data/releases/` went 629 -> 631 directories, which is exactly the two releases named in §0.**
  No probe cut a stray one.
- **Nothing was committed.**

---

## 10. VERDICT

- **Three mechanisms fixed, each derived from a cited authority line, each with a probe shown to move
  under a knob that restores the old behaviour.**
- **NARRATION-ONLY 21 → 19 causes / 21 → 19 games. BOARD-MATERIAL 0 of 958 after every measurement and
  after every edit.**
- **U1 and U2 closed two causes with zero transfers. U3 closed one and one transferred**, so the
  headline did not move on that step — a fourth substitute card, the family two batches have
  deliberately left alone.
- **A CENSUS PROBE WAS PINNING ONE OF THE BUGS.** `item/fractionalPriorityAnnounce` asserted that a
  Quick Claw stays silent on a priority click; the authority announces. It was green for as long as the
  engine agreed with it, and it went MISSING the moment the engine was corrected.
- **Three fixture errors were caught by the probes' own assertions before any measurement ran**, all
  three toward the comfortable answer: an arm that never reached the mechanic, a slot map read from the
  wrong game, and an idle click that turned out to be Ally Switch.
- **One card is a board defect wearing a narration label** — a multi-hit volley that stops when it
  breaks a substitute, worth 79 HP, invisible because the body died anyway.
