# Scoping the shared base-power / type / weather consumer (ROADMAP #312)

2026-08-30, ENGINE. **Scoping pass only — no game, no census, no roster, no differential, no
`tag_dex` run, no commit.**

## VERDICT

**#312 is entirely stale. All four of its bullets are landed, tagged, consumed and probed.** There
is no consumer to build. The row's status column still reads `open — engine DEFECT` and is the last
thing about it that is wrong.

| #312 bullet | Row that closed it | Consumer | Census probe (HEAD, 810/810 live) |
|---|---|---|---|
| Sand Force — `onType` disjunction, `!inWeather` refusal | **#515, closed 2026-08-27** | `dmgRange` weather-gated basePower branch, `medicham2-browser.js:11583` | *"Sand Force boosts all THREE of its types, and only in sand"* — live |
| Hustle — "needs the SAME consumer" | no row of its own; landed **2026-08-24** | `dmgRange` untyped `attackStat` branch, `:11297` | *"Hustle spends its 1.5x Attack — and neither control is paid twice"* — live |
| Shell Side Arm — "no tag exists for this shape" | **#518, closed 2026-08-28** | `picksCategory` consumer at `:24371`, knob `MEDI_NO_CATEGORY_PICK` | two probes, both live |
| Metronome item — "grep finds NO CONSUMER" | WIRE 158, **2026-08-28** | `:12022`, counter `metroLadderApplied` | two probes, both live |

**#312's central premise — that Hustle and Sand Force want the same consumer — was never true.**
`hustle.onModifyAtk` is `return this.modify(atk, 1.5)` (`data/abilities.ts:1901`), unconditional, no
type and no weather; `sandforce.onBasePower` is `chainModify([5325,4096])` gated on
`this.field.isWeather('sandstorm')` and a three-way type disjunction (`data/abilities.ts:3946-3954`).
They are **different stages** (`attackStat` vs `basePower`), which the artifact's own `stage` field
records, and they were correctly landed separately three days apart. `docs/ENGINE.md:2785` already
says the grouping "is one sentence narrower than it reads" — for Metronome. The same correction
applies to Hustle and had not been written down.

**Champions does not override any of them.** `grep sandforce|hustle|shellsidearm data/mods/champions/*.ts`
returns exactly one hit, `learnsets.ts:1361` (`shellsidearm: ["9M"]`). Mainline governs all three
handlers.

## 1. WHAT THE CONSUMER HAD TO DO — AND WHAT IT DOES

Not a change to `dmgRange`'s branches: it is already there, in three separate places, because the
authority puts the multipliers in three separate relays.

- **`basePower`** — `BPCH(...)` folds into `_bpChain`, spent once at `:11635` with
  `mvBP = Math.max(1, mdChain(mvBP, _bpChain))`, clamped exactly as `battle-actions.ts:1653` clamps
  it. Sand Force, the 18 type items, Charge, the terrains, Technician, Reckless, Analytic and
  Dry Skin's `onSourceBasePower` all land here.
- **`attackStat`** — `ACH(...)`, the attacking-stat chain, which truncates *inside* the formula.
  Hustle, Blaze/Torrent/Overgrow/Swarm, Water Bubble, Fire Mane, Plus/Minus.
- **final `ModifyDamage`** — `MODMUL(...)`. The Metronome ladder.

The split is not cosmetic: `runEvent('BasePower')` folds every member into one relay and truncates
once above the formula, while a stat multiplier truncates inside it. `tag_dex` reads which handler
carried the multiplier and emits `stage`, so the engine holds no second copy of that fact.

Supporting machinery that already exists and would be reused by anything new:
`exact4096(id, m)` (the `[5325,4096]`-vs-float-1.3 table, checked against the live dex by
`tests/test-damage-stages.js`), `dbTypeHits(p, mvT)` (the one reader of `damageBoost.onType`,
which **refuses a scalar and counts it** rather than wrapping it), `condHolds` (three-way, NULL is
not FALSE), `weatherId`, and `effWeatherOf` — `field` is shadowed at the top of `dmgRange` with the
*effective* sky, so Cloud Nine, Air Lock and a private sky reach every branch without a gate of
their own.

## 2. THE FULL MEMBERSHIP, DERIVED FROM THE FORMAT

Walk: `Dex.forFormat('gen9championsvgc2026regmb')`, `exists && !isNonstandard && tier !== 'Illegal'`
(316 abilities, 148 items, 500 moves), handlers read by `Function.prototype.toString`, matching
`onBasePower|onAllyBasePower|onSourceBasePower|onFoeBasePower|onAnyBasePower|onModifyAtk|onModifySpA`
against `move.type ===` and against the weather predicates.

**The naive walk over-counts by six, and the filter that catches it is CARRIERS, not
`isNonstandard`.** Six abilities match the shape and have **zero legal species carrying them** in
Reg M-B — Dragon's Maw, Orichalcum Pulse, Rocky Payload, Steelworker, Steely Spirit, Transistor.
They are absent from `data/tags.json` for exactly that reason, and reading their absence as a
derivation gap would have been the whole finding of this pass, wrongly. Galvanize, Normalize, Dark
Aura and Steely Spirit are in the same position. `.all()` is the National Dex — and even after the
`isNonstandard` filter, an ability nobody can bring is not membership.

**Real membership, filtered to abilities a legal species carries:**

*Base-power stage, type- and/or weather-keyed (7 families):*

| Entity | Key | Legal carriers | Tag | Consumed at |
|---|---|---|---|---|
| Sand Force | type LIST × weather | 4 (Steelix-Mega, Garchomp-Mega, Hippowdon, Excadrill) | `damageBoost` `{onType:["Rock","Ground","Steel"], inWeather:["sand"], stage:"basePower"}` | `:11583` |
| Dry Skin | type (defender-side, `onSourceBasePower`) | Fire ×1.25 | `halvesTypeDamage.basePowerTypes` | `:11624` |
| Aerilate / Pixilate / Refrigerate / Dragonize | `typeChangerBoosted`, ×1.2 | Pinsir-Mega / Gardevoir-Mega, Altaria-Mega, Sylveon / Glalie-Mega, Aurorus / Feraligatr-Mega | `convertsMoveType` + `damageBoost` `{onType:null, stage:"basePower"}` | base-power relay |
| Fairy Aura | type, `onAnyBasePower` | 1 (Floette-Mega) | `auraBoost` | `auraApplied` counter |
| The 18 type items | type, ×`[4915,4096]` | Fairy Feather 6,244 uses … Silver Powder 7 | `damageMultType` `{onType:"<scalar>", mult}` | `:11482` |

*Attack-stat stage, type- and/or weather-keyed (7):*
Blaze (11,162 uses), Torrent (3,287), Overgrow (1,048), Swarm (87) — type + HP gate;
Water Bubble (254) — type, paid by name; Fire Mane (Pyroar-Mega) — type;
Solar Power (1,372) — weather, no type, paid by name via `STAT_MULT_BY_NAME`.

*Weather-keyed with no legal carrier:* Orichalcum Pulse. It is in `STAT_MULT_BY_NAME` anyway.

**No legal item names more than one type** in `onBasePower`, `onSourceModifyDamage` or
`onModifyDamage` — scanned over all 148, zero hits. That is what makes the item-side scalar safe
today, and it is derived rather than assumed.

**Everything in that membership is already tagged and already read.** There is no unconsumed member.

### Two latent hazards found while deriving it — NOT live defects, no probe fails today

1. **Two producers, two shapes, for one fact.** `damageBoost.onType` is a **LIST** (fixed
   2026-08-27, `matchAll` with `/g`) and is read only through `dbTypeHits`, which refuses a scalar
   loudly. `damageMultType.onType` (items, `tag_dex.js:5983`) and `resistBerry.onType`
   (`:6029`) are still **SCALARS**, read at `:11482` with `_ty.onType === mvT`. That is precisely
   the "sometimes a string, sometimes an array" shape `dbTypeHits`'s own header calls the silent
   default. It is correct today because no legal item or berry names two types — and it becomes
   wrong silently on the first one that does, in a different file from the one that was fixed.
2. **The typed `attackStat` branch (`:11257`) checks neither `stage` nor `onStat`.** Every member
   it serves today carries *both* `onModifyAtk` and `onModifySpA`, so applying to both categories is
   right; and no `basePower`-staged typed member has `tags.length === 1`, so nothing is paid at the
   wrong stage. Both are properties of today's membership, not of the branch. The sibling branch
   eight lines up (Plus/Minus) already asks `onStat` and says in its own comment why — an Ampharos
   read 18 → 27 on a physical hit before it did.

## 3. THE `onType` DISJUNCTION IN `tag_dex.js`

**Already fixed, 2026-08-27 (`engine/tag_dex.js:8309`).** It is
`[...new Set([...src.matchAll(/move\.type\s*===?\s*["'](\w+)["']/g)].map(m => m[1]))]` and emits a
list unconditionally, "even when it holds one". The shipped artifact confirms it:

```
sandforce.damageBoost = {"mult":1.3,"onType":["Rock","Ground","Steel"],"inWeather":["sand"],
                         "onlyWhen":null,"stage":"basePower","onStat":null,"costsPerTurn":null}
```

`engine/tag_dex.js` and `data/tags.json` are both **unmodified against HEAD** right now
(`git status`), so this reading is not a torn read of the other agent's work.

**Scheduling fact, stated because it would apply if a change were recommended and it is not:** a
`tag_dex` edit regenerates `data/tags.json`, which is a frozen-release SOURCE, so every release id
moves. No `tag_dex` change is recommended in this pass, so no release id moves.

## 4. DOES SHELL SIDE ARM SHARE THE CONSUMER? — NO, AND IT NEVER COULD HAVE

It is not a damage-stage multiplier at all. `onModifyMove` (`data/moves.ts:16224`) runs at
`useMoveInner`'s `singleEvent('ModifyMove', ...)` — three lines after `setActiveMove` and **before
any damage stage exists**. It compares the damage each category *would* do off the TARGET's
defences with a literal base power of 90, flips `move.category`, sets `flags.contact`, and on an
exact tie **draws a coin**. Its outputs are a category, a flag and an RNG draw; the base-power
relay's output is a multiplier.

Same conclusion as the Metronome item on that row, for the same reason and by a different route:
**#312 grouped by "these all make damage wrong", which is a symptom, not a stage.** It has its own
mechanism (`picksCategory`, a per-use shallow clone hung on the action so all 21 readers of `mv.c`
move together — Reflect, Counter, Weak Armor and the contact punishes included), its own knob and
its own two census probes. Landed 2026-08-28 as #518.

## 5. RECOMMENDED ORDER, AND WHAT MOVES ON WHICH SCOREBOARD

Nothing here is a mechanic fix, so **nothing is predicted to move the census `live` count and
nothing is predicted to move the pool.** Saying that in advance is the point.

1. **Close ROADMAP #312 as SUPERSEDED, naming #515, #518 and WIRE 158, and correct its Hustle
   sentence in the same edit.** The row's diagnosis was right about four defects and wrong about the
   grouping; the correction belongs beside it, not instead of it — a dated claim is not rewritten in
   place. *Lab: no move. Pool: no move.* This is the whole recommendation.
2. *Optional, and only if someone is already in that file:* give `damageMultType` and `resistBerry`
   the same list shape as `damageBoost`, and route both through `dbTypeHits`. **This regenerates
   `data/tags.json` and moves every release id**, for a defect that cannot fire against today's
   membership. Recommendation: **not now.** File it as a hazard note under #515's family rather than
   scheduling it against anything.
3. *Optional:* add the `stage` and `onStat` guards to the typed `attackStat` branch at `:11257`.
   Same argument — inert against today's membership, one line, worth doing inside the next batch that
   touches that block rather than as its own pass. It would need its own probe with a cleared control
   before it counted as landed, and there is no failing probe for it today.

## OWED, NOT RUN

Step 1 is a documentation edit and needs no run. Recorded exactly, so nobody re-derives it:

```bash
# 1. Close #312. Edit the status column of docs/ROADMAP.md:1121 to:
#      closed 2026-08-30 — SUPERSEDED by #515 (Sand Force), #518 (Shell Side Arm)
#      and WIRE 158 (Metronome item); Hustle landed 2026-08-24. The row's
#      "Hustle and Sand Force want the same consumer" is retracted: attackStat
#      vs basePower, different stages, correctly landed apart.
node engine/status.js --write        # restamps the generated blocks; do NOT hand-edit them

# 2. Verify the close rather than assert it (cheap, single-process, no game):
node engine/open_work.js | grep -n "312"
```

If steps 2 or 3 above are ever scheduled, they are ENGINE work with a probe-first obligation and,
for step 2 only, a release-id restamp:

```bash
# ONLY IF step 2 is scheduled. Probe must be shown RED first.
node tests/probe_pair.js <the failing multi-type-item fixture>   # expected: RED, no such fixture exists today
node engine/tag_dex.js                                           # regenerates data/tags.json -> ALL RELEASE IDS MOVE
node tests/test-mechanics.js && node engine/status.js
```

## PROVENANCE OF THIS PASS

- Handlers read from `pokemon-showdown/data/abilities.ts`, `data/moves.ts` and
  `data/mods/champions/*.ts` at `SHOWDOWN_PATH`, at run time.
- Membership derived live from `Dex.forFormat('gen9championsvgc2026regmb')`, filtered
  `exists && !isNonstandard && tier !== 'Illegal'`, then filtered again by legal carrier.
- `data/tags.json` and `data/mechanics-census.json` read via `git show HEAD:` into the session
  scratchpad, because another ENGINE agent is mid-batch — its census was rewritten 9 minutes before
  this pass and its `medicham2-browser.js` 26 minutes before.
- **Caveat, stated rather than hidden:** `engine/medicham2-browser.js` is modified in the working
  tree and the consumer line numbers above are from the working copy, not from HEAD. Each consumer
  is independently corroborated by a closed ROADMAP row and by a live census probe in HEAD's
  artifact, so the conclusion does not rest on the moving file. `engine/tag_dex.js` and
  `data/tags.json` are unmodified against HEAD.
- No game, no census run, no roster, no differential, no `tag_dex` run, no commit, no push.
