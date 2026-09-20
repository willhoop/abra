# The remaining held-out board partings: Heal Block, the steal-eat's step, and the breakable priority bar — 2026-09-20, ENGINE (light mode, isolated worktree)

This is a findings record, not a living document. It is not current state and is not cited as such.
`node engine/status.js` and `node engine/quarantine.js` hold current state.

**Worktree:** `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a849ec7e27b2655a5`
**Release cut and verified on:** `2716afdc804a` (final bytes; an earlier intermediate cut of this pass,
`d562bb1356bf`, carried only the first two fixes and every figure below names `2716afdc804a`).
**Engine bytes changed.** `data/engine-release.json` is restored to `834713ccb303` at the end of this
pass; `data/releases/d562bb1356bf/` and `data/releases/2716afdc804a/` stay on disk.
**Showdown:** `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`, commit `20ad99f`.

---

## 0. VERDICT

- **THREE MORE OF THE FIFTEEN CLOSE, AND ALL THREE ARE A PLACEMENT RATHER THAN A MISSING
  CAPABILITY.** Row 10 — Heal Block refuses the CLICK, not only the heal. Row 8 — Bug Bite's
  steal-eat is the move's `onHit`, step 3, and this engine ran it at `onAfterHit`, below the
  reactors. Row 7 — the priority bar is BREAKABLE and a Mold Breaker attacker walks through it.
  Each has a probe that was red on the artifact's own line pair and is green now.
- **THE PREVIOUS PASS'S SPICY SPRAY LEAD IS REFUTED FROM THE DUMP.** The Scovillain holding Spicy
  Spray did **not** faint — it is at `126/140` in the window, and the body that dies is the OTHER
  target of the same spread Matcha Gotcha. So "the holder was dead" cannot be the reason the
  authority wrote no burn. Two further candidates are refuted below; row 2 stays open with a
  narrower question.
- **ROW 13 IS A DIE VALUE AND ROW 11 IS THE SAME SHAPE.** Neither is a missing capability: row 11
  is a Rock Slide flinch that lands here and not there, row 13 a Flame Body burn that lands there
  and not here. Both need the draw address instrumented, not a handler.
- **Three engine defects fixed, three probes, three knobs, three census rows.** Census
  **988 → 991 probed, 982 live, 0 missing, `run_ok: true`**.
- **NO GAME IS CLAIMED GONE.** What is claimed is that the CAUSE of rows 7, 8 and 10 is closed. The
  lattice and the held-out re-run are owed; §7.

---

## 1. PINS

| pin | value |
|---|---|
| release (probes) | `2716afdc804a` — all three probes run green with `--release 2716afdc804a`, and the same id resolves in `tests/_live_release.js`'s scratch store because an identical tree yields an identical id |
| dump read | `data/verification/_8347_dump_g12000.json` and `game-differential.g12000.json` **as they stand in this worktree** (tracked files, checked out 2026-09-20 12:19, not read from the main tree — a 3-lattice measurement is live there) |
| census | regenerated in this worktree by `tests/test-mechanics.js`; 991 rows, `run_ok: true` |
| tags | `data/tags.json` **UNTOUCHED**. §6 of the previous pass stands: `fit_policy.loadCorpus` opens the untracked store monolith `data/games.ladder.jsonl`, which a worktree does not have, so a regeneration here would zero every `uses`. Confirmed this pass: the call THROWS by path |
| launcher | every heavy run went through `cmd.exe /c tools\lownode.cmd <argv>` from a node wrapper written in this session's scratchpad (`lowrun_hb.js`, `batch.js`, `batch2.js`; no files of those names existed) |
| concurrency | every process was mine. Nothing was killed |

---

## 2. ROW 10 — HEAL BLOCK REFUSES THE CLICK. FIXED.

### The authority, read this run

```js
healblock.condition                                              data/moves.ts:8310-8316
  onBeforeMovePriority: 6,
  onBeforeMove(pokemon, target, move) {
    if (move.flags['heal'] && !move.isZ && !move.isMax) {
      this.add('cant', pokemon, 'move: Heal Block', move);
      return false;
    }
  },
```

The predicate is a **FLAG**, not a category and not "does this restore HP". Neither `healblock` nor
`psychicnoise` is overridden in `data/mods/champions/` — grepped on every probe run. The MOVE Heal
Block is `isNonstandard: "Past"` here; the volatile arrives through Psychic Noise's 100% secondary
(`data/moves.ts:14091-14094`), which is how the fixture lands it.

### What was wrong

`engine/medicham2-browser.js` modelled Heal Block as a **healing suppressor only**. `healBlocked(m)`
gates about a dozen heal sites and two branches (`allyheal`, `healdesc`) refuse their own click.
Nothing refused a DAMAGING move carrying the flag, so Drain Punch landed its damage, spent its PP and
merely healed nothing. The comment above `healBlocked` said so in words — *"the heal half of a drain
(the DAMAGE still lands)"* — which describes `onTryHeal` and only that half; it is corrected in place
with the handler quoted.

### The artifact

Seed `gen9championsvgc2026regmbbo3-2661429975`, `pair-protect-bust`, turn 3:

```
showdown   |cant|p2a: Annihilape|move: Heal Block|Drain Punch
medicham2  |move|p2a: Annihilape|drainpunch|p1a: Slowbro   |-damage|p1a: Slowbro|137/170
board      p1.party.slowbro.hp   us=137  showdown=170
           p2.pp[0].drainpunch   us=1    showdown=0
```

### The fix, and the membership question it had to answer first

The gate is one block at the shared BeforeMove choke point, immediately after Throat Chop (both are
`onBeforeMovePriority: 6`; `data/moves.ts:19404` and `:8310`) and above Taunt's 5 (`:18998`). No PP
and no `_lastMove`, for the reason Taunt and Disable already state one screen down.

**The engine has no `heal` FLAG in its artifact, and `data/tags.json` cannot be regenerated from a
worktree.** So the question is asked as four tag SHAPES it already carries — `drain`, `healsSelf`,
`healsAlly`, `healDescriptor` — and the probe **asserts the membership on every run**:

```
legal moves carrying flags.heal                                      : 22
legal moves carrying one of [drain, healsSelf, healsAlly, healDescriptor] : 22
disagreements                                                        : NONE
```

A move that ever carries the flag without one of those tags turns the probe RED by name. A derived
`heal` row in `tag_dex.js` is still the right home and is owed to a main-tree pass.

- Counter: `MEDSEEN.healBlockRefusedMove`.
- Knob: **`MEDI_HEALBLOCK_ALLOWS_HEAL_MOVES=1`**, stamped at LOAD in
  `MEDFAILS.healBlockAllowsHealMovesRestored`.
- Probe: **`tests/probe_healblock_refuses_heal_move.js`**.

### The probe, red then green

Derived fixture, printed every run: the blocker is the one move tagged `blocksHealing`
(`psychicnoise`); the clicker is the slowest legal carrier of a damaging heal-flagged move. It chose
**Noivern (base spe 123)** clicking Psychic Noise into **Aromatisse (base spe 29)** clicking Draining
Kiss. The noise user must be FASTER and the block must land in the SAME turn — the authority's
`onDisableMove` takes a heal move off the next turn's request entirely, so that is the only turn on
which the click can reach `onBeforeMove` at all.

```
BEFORE  --- BARE ---      drainingkiss resolved sd 1 / me 1, streams agree      ok
        --- BLOCKED ---   sd |cant|p1a: Aromatisse|move: Heal Block|Draining Kiss
                          me |move|p1a: Aromatisse|drainingkiss|p2a: Noivern
                          RED — 4 failing assertion(s)

AFTER   --- BARE ---      ok
        --- BLOCKED ---   sd and me both write the cant line; resolved 0 / 0; streams agree
        --- KNOB ---      the parting comes back
        GREEN — Heal Block refuses the heal-flagged click.
```

Exit **0** clean, exit **1** with the knob set from outside the process.

---

## 3. ROW 8 — THE STEAL-EAT IS STEP 3, ABOVE THE REACTORS. FIXED.

### The authority, read this run

```js
bugbite: {                                                       data/moves.ts:1911-1930
  onHit(target, source, move) {
    const item = target.getItem();
    if (source.hp && item.isBerry && target.takeItem(source)) {
      this.add('-enditem', target, item.name, '[from] stealeat', '[move] Bug Bite', `[of] ${source}`);
```

and the Champions `spreadMoveHit` puts that event **above** the reactors:

```
// 3. onHit event happens here                                   data/mods/champions/scripts.ts:374-375
damage = this.runMoveEffects(damage, targets, pokemon, move, moveData, isSecondary, isSelf);
…
if (this.battle.gen >= 5) this.battle.runEvent('DamagingHit', …);          :410
```

Inside `runMoveEffects` the move's own `singleEvent('Hit', …)` is raised BEFORE
`runEvent('Hit', …)` (`sim/battle-actions.ts:1278-1283`), which is why the new step sits above
`_stepHitEvent` and not below it. Neither `bugbite` nor `roughskin` is overridden in the mod.

### What was wrong

The strip lived in `_stepAfterHit`, which is the authority's `onAfterHit` — the right home for Thief,
Covet and Knock Off, and the wrong one for the two moves whose handler is `onHit`. One array position.

### The artifact

Seed `gen9championsvgc2026regmbbo3-2660750080`, `omit-intimidate`, turn 13. A Scizor on 16/145 Bug
Bites a Garchomp [Rough Skin] holding a Sitrus Berry:

```
showdown   |-enditem|p1a: Garchomp|Sitrus Berry|[from] stealeat|[move] Bug Bite|[of] p2a: Scizor
           |-heal|p2a: Scizor|52/145|[from] item: Sitrus Berry
           |-damage|p2a: Scizor|34/145|[from] ability: Rough Skin|[of] p1a: Garchomp
           |faint|p1a: Garchomp
medicham2  |-damage|p2a: Scizor|0 fnt|[from] ability: roughskin|[of] p1a: Garchomp
           |-enditem|p1a: Garchomp|sitrusberry|[from] move: bugbite|[of] p2a: Scizor
           |faint|p1a: Garchomp
           |faint|p2a: Scizor
```

The ORDER is the defect and the KO is its consequence: `p2.party.scizor.fainted us=true
showdown=false`, `ate_berry us=0 showdown=1`.

### The fix

The step BODY is unchanged and is now shared by two wrappers. `_stripAtOnHit()` asks the SAME
predicate the body already used to decide the eat — the declared
`takesTargetItem.consumesAndGainsEffect`, falling back on `removesItem.requiresItemClass ===
['isBerry'] && !steals` (ROADMAP #529 records that the declared field derives false today). Both
select exactly `{bugbite, pluck}` over this format's nine `takeItem` moves, printed by the probe. It
is deliberately **not** `_stealEat`, which is also gated on `MEDI_STEALEAT_STRIP_ONLY` — that knob
turns the EAT off and leaves the STRIP on, and the strip is inside the same `onHit`.

- Counter: `MEDSEEN.stealEatAtHitEvent`.
- Knob: **`MEDI_STEALEAT_AT_AFTERHIT=1`**, stamped at LOAD in `MEDFAILS.stealEatAtAfterHitRestored`.
- Probe: **`tests/probe_stealeat_before_reactors.js`**.

### The probe, red then green

Order-only by construction: nothing may faint, because a fixture that reproduced the KO would be
testing the consequence AND would pull a replacement onto the field the script has no click for.
Derived: `bugbite, pluck` as the onHit stealers, `roughskin` as the only contact reactor paying a
flat fraction on a LIVE holder, ten quiet berries. It chose **Araquanid** Bug Biting **Garchomp
[Rough Skin]** holding an Aspear Berry.

```
BEFORE  --- QUIET ---   neither line appears, streams agree                    ok
        --- ARMED ---   STREAMS PART
                        sd |-enditem|p1a: Garchomp|Aspear Berry|[from] stealeat|[move] Bug Bite|…
                        me |-damage|p2a: Araquanid|1001/1144|[from] ability: roughskin|…
                        RED

AFTER   --- ARMED ---   showdown steal@62 reactor@64 ; medicham steal@15 reactor@16 ; streams agree
        --- KNOB ---    medicham steal@16 reactor@15, and the SAME line pair parts again
        GREEN — the steal-eat resolves at step 3, above the reactors.
```

**TWO FIXTURE FAULTS WERE FOUND BEFORE THE ARM WAS TRUSTED**, both printed rather than papered over:
the reactor was first chosen alphabetically and picked **Aftermath**, which carries the identical
`trigger: 'contact'` and flat fraction and fires only when its holder DIES, so both engines read
`reactor@-1`; and the line matcher stripped `-` out of `|-enditem|` before testing, so it found
nothing in a run where both lines were present. `onFaintOnly` is now read and excluded, and the
matcher keeps `-` and `:`.

Exit **0** clean, exit **1** with the knob set from outside.

---

## 4. ROW 7 — THE PRIORITY BAR IS BREAKABLE. FIXED.

### The authority, read this run

```js
armortail: {                                                     data/abilities.ts:215-233
  onFoeTryMove(target, source, move) { … this.add('cant', armorTailHolder, 'ability: Armor Tail', move, `[of] ${target}`) },
  flags: { breakable: 1 },
```

and `Battle#runEvent` drops a breakable ability's handler for any attacking event when the move's
user suppresses:

```js
if (effect.effectType === 'Ability' && effect.flags['breakable'] &&          sim/battle.ts:855-866
    this.suppressingAbility(effectHolder)) {
  const AttackingEvents = { … TryMove: 1, … };
  if (eventid in AttackingEvents) { this.debug(eventid + ' handler suppressed by Mold Breaker'); continue; } }
```

`onFoeTryMove` is raised inside `TryMove`, which is on that list. Neither `armortail` nor
`moldbreaker` is overridden in the mod.

### What was wrong

`priorityRefusedAbove` read `d.ability` **raw**. It is the one place four sources of priority refusal
already meet — Armor Tail, Queenly Majesty, Psychic Terrain, Quick Guard — and the one place that
never asked `suppressedAbility`, which this file has carried since WIRE 128 and which every
damage-side breakable question goes through. **Three of its four call sites** pass an attacker now;
the fourth is the terrain-only call, which deliberately passes none, because Psychic Terrain is a
field condition and carries no ability to break.

No category is passed to `suppressedAbility`, and that is derived rather than convenient: this format
has exactly ONE `ignoresDefenderAbility` carrier — **Mold Breaker, `onlyCategory: null`** — printed
over the legal ability list this pass. A category-gated breaker arriving later does not silently
break the bar; `suppressedAbility` returns the ability unchanged and counts
`MEDFAILS.categoryGatedBreakerNoCategory`.

### The artifact

Seed `gen9championsvgc2026regmbbo3-2659757084`, `omit-intimidate`, turn 1. Two lines earlier the dump
carries `|-ability|p2a: Tinkaton|moldbreaker` on the switch-in:

```
showdown   |-resisted|p1a: Aerodactyl|1        (the Fake Out lands, and flinches)
medicham2  |cant|p1b: Farigiraf|ability: armortail|fakeout|[of] p2a: Tinkaton
board      p1.tailwind      us=3  showdown=0
           p1.pp[0].tailwind us=1 showdown=0
```

— the flinched body got its turn back here and spent it on a Tailwind.

- Counter: `MEDSEEN.priorityBarBrokenByBreaker`.
- Knob: **`MEDI_PRIORITY_BAR_IGNORES_BREAKER=1`**, stamped at LOAD in
  `MEDFAILS.priorityBarIgnoresBreakerRestored`.
- Probe: **`tests/probe_priority_bar_mold_breaker.js`**.

### The probe, red then green

Derived and printed: **breakable priority bars `armortail, queenlymajesty`; UNbreakable bars: none in
this format; category-free breakers: `moldbreaker`.** The clicker must carry the breaker AND a second
legal ability, because the control is the SAME body with the breaking half taken away — anything else
varies two things at once. It chose **Basculegion** clicking **Aqua Jet (priority 1)** into an
Abomasnow standing beside a **Farigiraf [Armor Tail]**.

```
BEFORE  --- PLAIN (swiftswim) ---   armortail refusals sd 1 / me 1, streams agree     ok
        --- BREAKER (moldbreaker) --- sd 0 / me 1
                        STREAMS PART sd |-resisted|p1a: Abomasnow|1
                                     me |cant|p1b: Farigiraf|ability: armortail|aquajet|[of] p2a: Basculegion
                        RED

AFTER   --- BREAKER ---  sd 0 / me 0, streams agree
        --- KNOB ---     the same line pair parts again
        GREEN — a breaker goes through the priority bar.
```

The first attempt at this fix patched only two of the four call sites and the probe stayed red on the
same line — the ATTACK path keeps its own copy of the gate (`engine/medicham2-browser.js`, the
`_gpri` comparison at the attack branch). That is recorded because a two-site fix looked complete.

Exit **0** clean, exit **1** with the knob set from outside.

---

## 5. ROW 2 — SPICY SPRAY. THREE CANDIDATES REFUTED, STILL OPEN.

The dump window, which the previous pass did not have:

```
|move|p1b:sinistcha|matchagotcha              (a spread move: it hits p2a AND p2b)
|-resisted|p2a:scovillain|2
|-supereffective|p2b:primarina|1
|-damage|p2a:scovillain|126/140
|-heal|p1b:sinistcha|57/146|[from]drain
|-damage|p2b:primarina|0fnt
|-heal|p1b:sinistcha|75/146|[from]drain
showdown   |faint|p2b: Primarina
medicham2  |-status|p1b: Sinistcha|brn|[from] ability: spicyspray|[of] p2a: Scovillain
```

**REFUTED — "the holder fainted".** The Spicy Spray holder is `p2a: Scovillain` and it is at
**126/140**. The body that dies is `p2b: Primarina`, the OTHER target of the same spread move. So the
previous pass's lead cannot be the mechanism. (It was also checked against the source and would not
have worked anyway: `runEvent`'s `fainted` guard is in `fieldEvent`, sim/battle.ts:512, and
`DamagingHit` does not go through it.)

**REFUTED — "Champions changed the handler".** `data/mods/champions/abilities.ts:85` is
`{ inherit: true, isNonstandard: null }`; only its legality moves. The handler is
`if (!source.trySetStatus('brn', target) && !source.status && source.hasType('Fire')) this.add('-immune', source);`
— `flags: {}`, so it is not contact-gated and **there is no `randomChance`**.

**REFUTED — "the attacker's ability refused the status".** Sinistcha's two legal abilities are
**Hospitality** and **Heatproof** (derived). Heatproof carries no `onSetStatus` at all — it halves
Fire damage and HALVES BURN DAMAGE (`onDamage`, `data/abilities.ts:1838-1842`), which is a different
event. Neither refuses a burn.

**What is left, stated as the open question rather than an answer.** The authority ran the handler and
`trySetStatus` returned false **silently**, or the handler was not collected. Candidates that survive:
a side condition or terrain standing outside the 16-line dump window with a silent `onSetStatus`; or
Scovillain's ability not being Spicy Spray on the authority's side at that instant (base Scovillain's
legal abilities are `Chlorophyll / Insomnia / Moody` and only `scovillainmega` carries Spicy Spray —
both derived — so the two engines agreeing on the mega is load-bearing here and is not visible in the
window). **Next step: replay the named game** (§7), not another staged fixture — every fixture that
could be built here reproduces a rule both engines already agree on.

---

## 6. THE REMAINING SIX, READ OFF THE DUMP'S CAUSE STRINGS

| row | seed | what the dump says | the reading |
|---|---|---|---|
| 4 | `…2655224585` | `\|-damage\|p1b: Garchomp\|84/183` **<>** `\|-miss\|p2b: Tinkaton\|p1b: Garchomp` | **a die value.** A Knock Off that connects there and misses here. Both engines had already agreed on a Rock Slide `-miss` eight lines earlier, so the streams were aligned; between them sits a faint and a Life Orb tick. Draw address, not a capability |
| 5 | `…2657170022` | `\|-unboost\|p1b: Archaludon\|spa\|1` **<>** `\|-boost\|p1b: Archaludon\|spa\|1` | **OPEN, and not what it looks like.** Both engines agree on the `-prepare` for Electro Shot one line up, and `electroshot.onTryMove` does `this.boost({spa: 1}, attacker, attacker, move)` (`data/moves.ts:4645`) — a raw **+1**. None of Archaludon's three legal abilities (Stamina / Sturdy / Stalwart, derived) inverts a boost, so the authority's `-unboost` is most likely a DIFFERENT event occupying that index. The next line is also far apart — `p2a: Metagross 77/155` against `1/155`. Needs the replay |
| 11 | `…2655714014` | `\|move\|p1a: Orthworm\|Shed Tail` **<>** `\|cant\|p1a: Orthworm\|flinch` | **a die value**, row 13's shape with the sign flipped: we flinch off a Rock Slide that the authority does not |
| 12 | `…2656306845` | first protocol divergence is `\|-ability\|p2a: Drampa\|Cloud Nine` **<>** `\|turn\|1` | **the first divergence is the ability-arrival class, which 6.76.0 closed.** Its BOARD parting (`p2.party.whimsicott.status us="" showdown="brn"`, turn 11) is a different event and is not decidable from the window. A game records only its FIRST divergence; this row is the standing illustration that the two are not the same question |
| 13 | `…2655141321` | `\|-status\|p1a: Toxapex\|brn\|[from] ability: Flame Body` **<>** `\|-weather\|sunnyday\|[upkeep]` | **a die value, confirmed by the previous pass with the capability staged present and correctly gated at 30%.** Re-read here: the trigger is Toxapex's Infestation making contact with a Volcarona, and the authority's very next lines are the burn chip and the partial-trap chip, so nothing structural is missing |
| 15 | `…2663796709` | `\|move\|p2a: Meowstic\|Trick Room` **<>** `\|move\|p2a: Meowstic\|psychic\|[notarget]` | **ENCORE.** `\|-start\|p2a: meowstic\|encore` is in the same window. The authority's Encore repeats **Trick Room**; ours repeats **Psychic** and then fails with `[notarget]` because both foes are already dead. So the two engines disagree about WHICH move the Encore locked, not about whether Encore rewrites the action. That is a `_lastMove` question at the moment the Encore landed |

**None of these six is a missing capability.** Three are a die value or address (4, 11, 13), one is a
`_lastMove` question (15), one is a closed narration class carrying an undiagnosed board leaf (12),
and one is open (5).

---

## 7. WHAT IS OWED, AND WHY IT COULD NOT BE DONE HERE

1. **THE HELD-OUT `--games 12000` RE-RUN.** Three more causes are closed; **no game is measured
   gone.** It must pin release, census and `--team-store data/team-pool-frozen`, and state `--games`,
   because `--games` is part of the sample definition. Expect rows 7, 8 and 10 to leave.
2. **THE THREE GATE LATTICES AND `engine/quarantine.js`.** Not run here (light mode). All three fixes
   are board-material.
3. **THE SINGLE-GAME REPLAY OF ROWS 2, 5, 12 AND 15.** `engine/replay_one.js --games 12000` needs its
   warm-up and the declared `ABRA-HEAP: 8192`; the previous pass measured ~63 minutes and an OOM kill
   on the default heap. Rows 2 and 5 cannot be closed without it — both are questions about a board
   state outside the dump's window.
4. **A DERIVED `heal` FLAG IN `engine/tag_dex.js`.** §2's four-tag union is exact today and is
   asserted on every probe run, but the FLAG is the fact and the tag set is a proxy for it. Owed to a
   main-tree pass, because `tag_dex` cannot be regenerated from a worktree (§1).
5. **`data/protocol-events.json` IS STALE AGAINST THE LIVE ENGINE.**
   `tests/probe_stealeat_derivation.js` exits **2 CANNOT-ANSWER** unpinned — *"recorded 46 emitted
   events (from …50bc0ebd5e12) and this run plays 44 (…31855b504052) … NO LONGER CLAIMED: -block,
   -endability"* — and exits **0 GREEN** pinned to `2716afdc804a`. **This is not this pass's doing:**
   the whole diff removes exactly two lines from the engine (`git diff -U0`), neither of them a `TR.`
   call. It is an instrument debt and needs `node engine/derive_protocol_events.js --write` from a
   tree somebody is willing to stamp.
6. **`status.js --write`, `CHANGELOG.md` and `docs/RUNNING-NOTES.md`** — not run. `docs/ENGINE.md`
   gained the three probes in `Owns:` and one dated section; **no `<!-- GENERATED -->` block was
   touched.** The notes row below is proposed text, not a row.

---

## 8. THE CENSUS, AND ALL THREE KNOBS REFUSING IT

| | before (HEAD) | after |
|---|---|---|
| probed | 988 | **991** |
| live | 979 | **982** |
| missing | 0 | **0** |
| `run_ok` | true | **true** |

The three new rows, all LIVE:

- `move` / `blocksHealing` — *"a heal-FLAGGED attack is refused outright — `|cant|POKEMON|move: Heal
  Block|MOVE` — not played for no heal"*. Arms `[damage dealt, drain healed, PP bar touched]`:
  free `[1,1,1]`, after Psychic Noise `[0,0,-1]`.
- `move` / `takesTargetItem` — *"the stolen berry is eaten at step 3, ABOVE the on-damaging-hit
  reactor that would have killed the thief"*. Arms `[thief fainted, thief ate the berry]`: holding
  nothing `[1,0]` (the reactor is lethal, which is what makes the other arm mean something), holding
  a Sitrus `[0,1]`.
- `ability` / `blocksMove` — *"a MOULD-BREAKING attacker is not refused by the breakable priority
  bar"*. The same Basculegion carrying Swift Swim lands **0**; carrying Mold Breaker it lands **24**.

**THE FIRST VERSION OF THE HEAL BLOCK ROW WAS GREEN FOR THE WRONG REASON AND THE KNOB IS WHAT CAUGHT
IT.** At `maxhp/3` the arming Psychic Noise KILLED the clicker, so the test arm read its `[0,0,-1]`
off a corpse and stayed LIVE under `MEDI_HEALBLOCK_ALLOWS_HEAL_MOVES=1`. Both bodies are unfaintable
now. An earlier version put the Drain Punch on an Incineroar, which is part Dark, so the Psychic
Noise never landed at all and both arms read `[1,1,1]`. Both faults are written into the row.

Each knob was run against the whole census and each is refused by name:

```
MEDI_HEALBLOCK_ALLOWS_HEAL_MOVES=1   row MISSING ([1,0,1]) ; REFUSED to write — MEDFAILS.healBlockAllowsHealMovesRestored
MEDI_STEALEAT_AT_AFTERHIT=1          row MISSING ([1,0])   ; REFUSED to write — MEDFAILS.stealEatAtAfterHitRestored
MEDI_PRIORITY_BAR_IGNORES_BREAKER=1  row MISSING (0)       ; REFUSED to write — MEDFAILS.priorityBarIgnoresBreakerRestored
```

### Neighbouring probes re-run, pinned to `2716afdc804a`

| probe | exit |
|---|---|
| `probe_healblock_refuses_heal_move.js` | 0 GREEN |
| `probe_stealeat_before_reactors.js` | 0 GREEN |
| `probe_priority_bar_mold_breaker.js` | 0 GREEN |
| `probe_moldbreaker_refusals.js` | 0 (roster rows FIRED-AND-BOARDS-MATCH) |
| `probe_priority_bar_effective_ability.js` | 0 GREEN |
| `probe_stealeat_derivation.js` | 0 GREEN (exit 2 unpinned — §7.5) |
| `probe_healblock_clock.js`, `probe_knockoff_berry_consumers.js`, `probe_spread_item_order.js`, `probe_item_disposition.js`, `probe_moldbreaker_ally_guard.js`, `probe_sucker_try_above_terrain.js`, `probe_priority_modified.js` | 0 each |

---

## 9. FILES CHANGED

**Code**
- `engine/medicham2-browser.js` — three fixes, three knobs stamped at LOAD, three `MEDSEEN` counters.
  `priorityRefusedAbove` gains a sixth parameter; three of its four call sites pass the attacker.
  The `healBlocked` header's claim about a drain is corrected in place with the handler quoted.
- `tests/test-mechanics.js` — three census rows; three names in `DELIBERATE_BREAK`.
- `tests/probe_healblock_refuses_heal_move.js` — **new**.
- `tests/probe_stealeat_before_reactors.js` — **new**.
- `tests/probe_priority_bar_mold_breaker.js` — **new**.
- `docs/ENGINE.md` — the three probes added to `Owns:`, and one dated section. **No
  `<!-- GENERATED -->` block was touched and `status.js --write` was not run.**
- This report.

**Data**
- `data/mechanics-census.json` — regenerated by `tests/test-mechanics.js`.
- `data/verification/probe-item-disposition.json`, `data/verification/probe-knockoff-berry-consumers.json`
  — a `generated` timestamp each, rewritten by the two probes when they were re-run green.
- `data/releases/d562bb1356bf/` and `data/releases/2716afdc804a/` — new on disk.
- `data/engine-release.json` — **restored to `834713ccb303` from HEAD**, per the rule the previous
  pass earned: `game_differential.js` cuts a release into the real store at require time, so a backup
  taken by the session is already wrong. It moved twice unattended during this pass and reads
  `834713ccb303` now.
- `data/tags.json` — **untouched**, digest unchanged.

**Not touched:** `engine/board.js`, `engine/magnemite.js`, `data/engine-data.js`,
`engine/quarantine.js`, `engine/game_differential.js`, `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, and
every artifact in the main tree. **No git command that writes history was run.** Nothing was deleted.

---

## PROPOSED NOTES ROW

> **2026-09-20 — ENGINE — Heal Block refuses the click, Bug Bite's steal-eat is step 3, and the
> priority bar is breakable.** All three are a PLACEMENT rather than a missing capability.
> `healblock.condition.onBeforeMove` keys on `move.flags['heal']` (`data/moves.ts:8310-8316`) and
> refuses the whole click; this engine modelled only the `onTryHeal` half, so a Drain Punch landed its
> damage and merely healed nothing. `bugbite.onHit` (`data/moves.ts:1920`) is step 3 of
> `spreadMoveHit` (`data/mods/champions/scripts.ts:375`) and the reactors are at `:410`; the strip sat
> in this engine's `onAfterHit` step beside Thief, so a thief the real game lets eat first was killed
> by Rough Skin. `armortail.flags` is `{breakable: 1}` and `runEvent` drops a breakable handler on
> `TryMove` for a mould-breaking user (`sim/battle.ts:855-866`); `priorityRefusedAbove` read the
> defender's ability raw at all of its gates. **Figures.** Census **988 → 991 probed, 982 live, 0
> missing, `run_ok: true`** (`data/mechanics-census.json`, regenerated on worktree release
> `2716afdc804a`). These close the CAUSE of **3 more of the 15 board partings** in the held-out
> `--games 12000` draw on `834713ccb303` (`data/verification/game-differential.g12000.json`, rows 7, 8
> and 10). **No game is claimed gone: the lattice re-run is owed.** The previous pass's Spicy Spray
> lead is **refuted from the dump** — the holder survived at 126/140 and the body that fainted is the
> other target of the same spread move. **Proved by.**
> `tests/probe_healblock_refuses_heal_move.js`, `tests/probe_stealeat_before_reactors.js` and
> `tests/probe_priority_bar_mold_breaker.js`, each red on the artifact's own line pair before the fix,
> green after, and red again under `MEDI_HEALBLOCK_ALLOWS_HEAL_MOVES=1` /
> `MEDI_STEALEAT_AT_AFTERHIT=1` / `MEDI_PRIORITY_BAR_IGNORES_BREAKER=1`, which also make the census
> refuse to write. **Supersedes.** Nothing — the 34 → 15 figure stands and is not re-measured here.
> **Basis.** unchanged. **Owed to.** `docs/ENGINE.md` (done in this pass); the held-out re-run and the
> gate.
> Full account: `docs/_reports/2026-09-20-heldout-remainder.md`.
