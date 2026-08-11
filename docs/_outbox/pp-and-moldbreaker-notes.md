# PP, MOLD BREAKER, AND A GENERATED FILE THAT IS MAINLINE GEN 9 — 2026-08-11

**Census 408 → 416 live / 416 probed / 0 missing / 0 threw / 0 hollow / 0 unarmed / 0 direct-call.**
`tests/test-engine-diff.js --n 20000` = **0 disagreements**, run three times across the batch.
All three deliberate-roster stages re-run against the new bytes: **0 FIRED-AND-BOARDS-DIFFER,
0 DID-NOT-FIRE** on items, abilities and moves.

**THE MEDICHAM GATE IS CLOSED, AND IT IS NOT MINE.** Read the section at the bottom before reacting.
The five clauses I was told to hold all still PASS. A **sixth clause was added to
`engine/quarantine.js` mid-session by another agent** (file mtime 19:55 today) and it is the one that
fails.

---

## PART 1 — PP

### It did not exist. Zero mentions, no field on a built body. It does now.

Eight probes, each watched RED against release `7bf3a1e19ce5` (the pre-session engine) before a byte
moved:

| arm | frozen `7bf3a1e19ce5` | live |
|---|---|---|
| Protect clicked 9 times | 9 `\|move\|` lines, no `_pp` field | **8 lines + `\|cant\|nopp`**, `{protect:0}` |
| Protect clicked 5 times (control) | 5 lines | 5 lines, `{protect:3}` |
| Close Combat into a **Pressure** foe | 9 lines | **4 lines** |
| Close Combat into a **Levitate** foe (control) | 9 lines | 8 lines |
| every slot empty, engine choosing | clicked Flare Blitz forever | **3 × Struggle**, paying ¼ max HP each |
| same, drained only halfway (control) | — | 0 Struggles, clicks Close Combat/Flare Blitz |

### The numbers are READ, never computed — and your table was right

Verified against a constructed battle in `gen9championsvgc2026regmb`, not against the dex's `pp`:

```
dex base 5  -> maxpp 8      dex base 15 -> maxpp 16
dex base 10 -> maxpp 12     dex base 20 -> maxpp 20
```

`floor(base * 0.8 + 4)` fits **500 of 500** rows. It is deliberately **not** the implementation:
`engine/tag_dex.js` builds real `Battle`s (24 moves per battle, throwaway Dittos) and reads
`moveSlots[].maxpp` back off them. The moment the mod changes the rule, a hardcoded formula is
silently wrong and nothing here would notice.

**The mainline `pp * 8/5` rule matches only 85 of 500 moves in this format.** Protect is `maxpp` 8
here against 16 mainline. That is the same root cause as Part 3.

### THE QUESTION YOU OWED ME — does PP have to survive a rollout? NO.

Measured, not assumed:

- `engine/rollout_leaf.js:418` builds **fresh bodies for every playout** ("MEDICHAM mutates the mons
  it is handed"), and nothing in the project clones a battle state. So PP is one field initialised per
  body and mutated in place — no copy, no carry, per-CLICK cost only.
- `tests/bench-medicham.js`: baseline recorded quiet **0.4614 ms/turn**; four runs after the wire
  **0.4035 / 0.4509 / 0.4556 / 0.4201**. The wire is **inside run-to-run spread**. I am claiming
  *no measurable cost*, not a speedup.

**The table is per-slot and LAZY, and `board.js` is the reason.** `dmgMon` builds through `buildMon`
and then **overwrites `b.moves`** with the open sheet's four. A table stamped at build time would be
keyed to the moves the body held before that overwrite, in every rollout body, silently. Deriving each
slot on first touch is correct for every builder, including `board.js`, with no `board.js` edit.

### ONE CORRECTION TO YOUR BRIEF, MEASURED IN THE OFFICIAL ENGINE

> *"with a Pressure foe on the field the same move must run out in FIVE, not nine"*

**Not for Protect.** Pressure charges once per **apparent target** (`pressureTargets`,
`sim/battle-actions.ts:476`) and Protect is self-targeting, so its `pressureTargets` is `[self]` and an
ally charges nothing. Measured in Showdown, five clicks each way:

```
Protect      v Pressure   8 -> 3      v Levitate  8 -> 3      NO DIFFERENCE
Flamethrower v Pressure  16 -> 6      v Levitate 16 -> 11     2 PP a click
Heat Wave (spread, TWO Pressure foes) 12 -> 0 in FOUR clicks  3 PP a click
```

That third row is why the extra is computed over a **target list** rather than off a boolean. The
probe carries the Protect pair as an explicit arm, because **an engine that simply doubled every
deduction under Pressure passes the Close Combat arm and fails it.**

### What is wired, and where each thing sits

- **Deduction** at the authority's position: below every BeforeMove refusal (sleep, freeze, flinch,
  confusion, paralysis, recharge, Throat Chop, Taunt all spend **no** PP) and above the `|move|`
  announcement. Emits `|cant|POKEMON|nopp|MOVE` on failure.
- **Exemptions**, each because the authority exempts it: a rampage/Uproar lock (`getLockedMove` —
  a Choice lock is *not* that and pays every turn), Struggle itself, switches and passes.
- **Selection**: `illegalMoveNow` refuses an empty slot, so the chooser and the priors sampler both
  bind. Proven reachable: a 2-move body drained on one move refused it **6 times** in 3 turns and
  clicked the other.
- **Struggle**: `ppAllOut` → a real `struggle` action. Typeless via a new `setsOwnTypeAlways` tag
  (`move.type = '???'`, so `mcEff` answers ×1 rather than 0 against a Ghost); the ¼-max-HP recoil was
  already read from the existing `recoil {of:'maxhp'}` tag and now finally has something to fire on.

### Counters, read rather than assumed — 200 real self-play games

```
ppDeducted 1862   ppUnknownMove 0   struggleUnbuilt 0   categoryGatedBreakerNoCategory 0
ppPressureCharged 0, ppRefusedAtSelection 0, struggleUsed 0  <- rare events; the probes prove each fires
```

---

## PART 2 — MOLD BREAKER

### 1. Does the engine read `ignoreAbility` at all? — PARTLY, AND BOTH HALVES WERE WRONG

Answered before wiring, as asked:

- `move.ignoreAbility` (the MOVE side): **not read at all** — and it does not matter here. All 9
  moves carrying it are `isNonstandard: 'Past'` in this format.
- The ABILITY side was read via a tag `ignoresDefenderAbility` at 4 sites. Two defects:
  - **It suppressed EVERY defender ability.** Rough Skin, Static, Flame Body, Steadfast, Cursed
    Body, Weak Armor, Anger Point and the Ruin abilities were all being blanked by a Mold Breaker.
  - **The flinch and Shield Dust gates read `tg.ability` RAW.** So in the *same turn, off the same
    body*, a Mold Breaker punched through Levitate in the damage calc (WIRE 37, `defAb`) and was
    refused by Inner Focus two hundred lines later.
- The DERIVATION was a **name regex**: `a.breaksProtect || /moldbreaker|turboblaze|teravolt/`.
  `a.breaksProtect` is **undefined on all four carriers**, so the regex was doing 100% of the work —
  and it **missed Mycelium Might**.

### 2. The trap you flagged is real and is now checked rather than trusted

`ability.isBreakable` is `undefined` on **every** ability in this format. The live field is
`flags.breakable`, which is what `sim/battle.ts:837` itself reads:

```js
if (effect.effectType === 'Ability' && effect.flags['breakable'] &&
    this.suppressingAbility(effectHolder)) { ... continue; }
```

**82 breakable abilities** in `data/tags.json` (84 in the raw dex; the two extra are `mountaineer`
and `rebound`, both `isNonstandard`, which `collect()` correctly skips). Two further clauses off
`suppressingAbility` are honoured: a Mold Breaker does **not** suppress its own ability, and
**Ability Shield** refuses the whole mechanism.

### 3. Arms — five breakable KINDS plus two non-breakable controls

`plain` is a non-Mold-Breaker attacker into the **same** ability, which is the arm that says the
ability is live rather than absent.

| | plain | mold breaker | frozen `7bf3a1e19ce5` |
|---|---|---|---|
| **levitate** (immunity), Earthquake | 0 | 167 | already DIFFER |
| **filter** (×0.75 on a 4× hit), Ice Beam | 191 | 254 | already DIFFER |
| **shellarmor** (Frost Breath's certain crit) | 172 | 258 | already DIFFER |
| **innerfocus** (flinch refusal), Fake Out | struck back 167 | **0** | **SAME — RED** |
| **shielddust** (100% secondary), Nuzzle | `none` | **`par`** | **SAME — RED** |
| **steadfast** — NOT breakable | +1 spe | **+1 spe** | SAME (correct) |
| **roughskin** — NOT breakable | attacker −195 | **−195** | SAME (correct) |

Each non-breakable row carries its own no-ability control (0 boost / 0 recoil) so a `SAME` cannot mean
"the ability was never firing".

### 4. Will's question, answered against the authority

```
Mold Breaker Fake Out -> Inner Focus   FLINCHED, no Speed boost
non-Mold-Breaker      -> Inner Focus   no flinch, Tinkaton eats Close Combat
Mold Breaker          -> Steadfast     FLINCHED **and** +1 Speed
```

**Yes**, Tinkaton's Mold Breaker Fake Out flinches through Inner Focus. Our engine now matches all
four rows.

### 5. Three hardcodes replaced by the tag they were standing in for

`tgAb === 'shielddust'` and **three copies** of `tgAb === 'innerfocus'` were the only readers of facts
the artifact did not state. They are now `refusesSecondaries` (derived from `onModifySecondaries`,
membership = Shield Dust) and `refusesVolatile` — the identical tag `applyConfusion` already reads, so
the two roads cannot disagree.

---

## PART 3 — YOUR THIRD AND FOURTH ITEMS

### `engine/format_audit.js` (new). RED on the current tree, with severity per row.

**7,653 constants** in `data/move-effects.js`, `data/engine-data.js` and `data/tags.json` swept
against `Dex.forFormat('gen9championsvgc2026regmb')`. **21 disagree. Every single one equals the
mainline gen-9 value — one root cause, not drift.** Root cause, one line:

```js
// CHOMP/build/build_move_effects.js:32
const dex = await (await fetch('https://play.pokemonshowdown.com/data/moves.json')).json();
```

Fields covered and **fields not covered** are printed on every run, because an audit reported as "the
generator is fixed" while it checked one field is the failure this repo exists to prevent.

**After this batch, 0 of the 21 are LIVE.** Each row is classified by whether the engine reads it:

- **LIVE** (engine reads it, nothing overrides): **0**.
- **FIXED** (engine reads it, a named format-derived correction wins): moonblast, ironhead, direclaw,
  makeitrain, clangoroussoul, crabhammer, syrupbomb.
- **LATENT** (nothing reads that field from that artifact): the 12 base powers, `growth` type,
  `snaptrap` type.

### I fixed the one that was LIVE, inside my own file

**Moonblast was firing its SpA drop at 30% where the format says 10% — 9,470 corpus clicks.**
WIRE 89 already took the CHANCE from the format-derived tag for a **status or volatile**
(`statusInflict`); a secondary that drops a **stat** lives under `statChange`, so the reader returned
null and the generic number was used unchallenged. Measured over 4,000 real seeded turns:

```
                          frozen    live      both rulebooks agree?
moonblast SpA-1            30.6%    10.4%     no  (30 generic / 10 format)
snarl     SpA-1 control    95.3%    95.3%     yes (both 100%; 95-accurate move)
icywind   Spe-1 control    95.3%    95.3%     yes
```

### FOUR RETRACTIONS OF THINGS YOU SENT ME, EACH WITH THE MEASUREMENT

1. **"Growth is GRASS in Champions and we call it Normal" — LATENT, not live.** `MC.moves.growth.t`
   is already `"Grass"`, and `effMoveType` reads `MC.moves`, not `move-effects`. Same for Snap Trap:
   `MC.moves.snaptrap` is `Steel`/35. Only the generated `move-effects.js` copy is mainline.
2. **"Triple Arrows carries TWO secondaries and we carry only one" — FALSE.**
   `data/move-effects.js` carries both (`50% def −1` and `30% flinch`) and the engine's secondary loop
   iterates the whole array. `data/tags.json` carries both too.
3. **"ROADMAP #104 — 12 moves have the wrong BASE POWER in MC.moves" — NOT REPRODUCIBLE.**
   `MC.moves` disagrees with the format on **0** rows for type, base power and category, once
   variable-power moves are excluded. Verify before closing #104; my sweep covers three fields.
4. **"`isGrounded` does not consult Levitate" — FALSE, and this is the one worth catching before it
   became a fix.** `engine/medicham2-browser.js:1714` is
   `const AIRBORNE_ABIL = new Set(['levitate','eelevate'])` and line 1725 reads it. Levitate bodies
   are already ungrounded. **Gravity, Ingrain, Smack Down, Magnet Rise and Roost genuinely are
   missing** (`removeType` and any temporary-typing concept: 0 occurrences in the file), and Roost at
   2,808 clicks is the real prize — but it needs a temporary-type LAYER, which is a mechanism and not
   a wire, and I did not attempt it in this batch.

### A FALSE POSITIVE MY OWN AUDIT PRODUCED, AND WHY IT IS IN THE FILE

The first run reported **7 LIVE category defects** in `MC.moves` — Grass Knot, Final Gambit, Electro
Ball, Spit Up, Sheer Cold, Night Shade, Mirror Coat. All seven were the CHECK being wrong: `bp: 0` is
that table's word for *variable power*, not for *zero*, and every one of those is a
`basePowerCallback`/OHKO/fixed-damage move whose power the engine reads from a tag. They are now
counted as **NOT COMPARABLE with the reason printed**, not silently skipped. A check that keeps firing
after the fix is the one people learn to ignore.

---

## THE GATE — CLOSED, AND THE CAUSE IS NOT THIS BATCH

```
PASS  game differential              0 of 20000 disagree
PASS  deliberate roster / items      0 differ, 0 did-not-fire
PASS  deliberate roster / abilities  0 differ, 0 did-not-fire
PASS  deliberate roster / moves      0 differ, 0 did-not-fire
PASS  coverage / every used mechanic is measured by something
FAIL  no open, known engine defect   7 OPEN roadmap rows describe a live engine defect
```

The five clauses I was told to hold **all still PASS**, and all three roster stages were re-run
against the new bytes rather than read from the artifact I inherited. The sixth clause is new:
`engine/quarantine.js` was modified at **19:55 today** and `docs/ROADMAP.md` at **19:57**, by the
agent that also added `engine/all_mechanics_fire.js` and `docs/_outbox/all-moves-fire-notes.md`.
The clause reads open ROADMAP rows and has nothing to do with medicham2's bytes.

**One of the seven is mine and is now done: `#119 STRUGGLE IS NOT IMPLEMENTED`.** It is implemented
and probed. I did **not** edit `docs/ROADMAP.md` — it is not in my ownership and another agent had it
open twenty minutes earlier, and a lost write there is exactly the collision CLAUDE.md warns about.
Whoever owns the register should mark #119 done. #144 (PP) likewise if it has a row.

**And a limit of the gate that belongs beside its green, because three separate defects tonight share
it:** the roster and the interaction matrix compare **our two engines**, so a *shared wrong input
produces perfect agreement* and the row passes. That covers the mainline constants in
`move-effects.js`, the mega movesets, and grounded-ness. Only the Showdown differential can see it,
and only if it samples the interaction — Growth is 8 clicks and never will be. **OPEN does not mean
"the engine is right".**

---

## THE TAG-CONSUMPTION GATE WENT RED AND I FIXED IT RATHER THAN FILING IT

`tests/test-tag-consumed.js` failed on `removesPP`, `restoresPP` **and** `piercesProtect`. Two were
mine and are now wired, with two more probes (census 414 → **416**):

- **Leppa Berry** (`restoresPP`) is a third `berry*Update` on the same clock as Sitrus and Lum, called
  from the same two sites. Protect asked 9 times: **9 clicks and 0 refusals with a Leppa**, against
  8 + `|cant|nopp` with no item **and** 8 + `|cant|nopp` holding a SITRUS — the second control is what
  says the knob is the item's tag rather than "holding a berry".
- **Eerie Spell** (`removesPP`) sits with the procedural-status block, inside `!suppressed`, because it
  IS a secondary — Shield Dust filters it and Sheer Force deletes it. The target's Earthquake
  (maxpp 12) reads **8** after Eerie Spell and **11** after a Psychic on the same turn in the same
  order: one PP the victim spends itself, three more taken off the slot it last used.
- **Ripen is DECLARED, not flattened.** The tag carries `ripenAmount: 20` and this engine has no
  `doublesBerryEffect` tag for any of Ripen's effects, so a branch reading one would be a lookup that
  can never return. `MEDFAILS.ripenBerryBoostUnmodelled` counts it. Legal carriers in Reg M-B: Flapple
  and Appletun, 0 corpus uses.

**`piercesProtect` is still RED and is NOT mine.** It was added to `engine/tag_dex.js` after that
test's baseline (`data/tag-consumption.json`: 194 tags, stamped 2026-08-10 05:49; the artifact now
holds 226). Saying so rather than filing it.

## DECLARED, NOT DONE

- **SPITE carries `removesPP` and cannot reach the reader.** `playerAction` resolves it to
  `{kind:'pass'}` — it is one of the 32 moves ROADMAP #125 counts as a whole no-op turn. The reader is
  live for it; the ROAD is not, and probing it would mean asserting a result the engine reaches by
  accident. 10 corpus clicks.
- **Last Resort** is still unimplemented; PP was the blocker and is no longer.
- **Roost / Smack Down / Gravity / Magnet Rise / Ingrain** — sized above, not attempted. Roost needs a
  temporary-type layer; half-wiring it would be worse than leaving it.
- **A rollout starts at FULL PP**, because `board.js` tracks none and is not ENGINE's. A stall priced
  8 turns deep inside a rollout is 8 turns from *now*, not from the start of the game.
- **The engine's priors sampler clicks moves the body does not have** (`MC.priors`, by name, a
  deliberate behaviour clone). It now binds to PP through `illegalMoveNow`, but it means the PP
  resource in self-play is spread over a set wider than the body's four. Pre-existing; named because
  PP makes it observable for the first time.

## A RELEASE WAS CUT THAT I DID NOT INTEND — reported, not hidden

`tests/test-game-diff.js` cut release **`9779c50340fb`** at 23:50 over my mid-batch tree, with the
reason string *"game differential mode A"*. The pointer in `data/engine-release.json` moved off
`7bf3a1e19ce5`. Same thing WIRE 151 recorded. Nothing measured against it.

## FILES

Mine: `engine/medicham2-browser.js`, `engine/tag_dex.js`, `data/tags.json` (+ the generated
`data/abra-tags.js`), `tests/test-mechanics.js`, `docs/ENGINE.md`, and NEW: `engine/format_audit.js`,
`data/format-audit.json`, `data/medicham-bench.json`.
Not touched: `board.js`, `magnemite.js`, `engine-data.js`, `engine/game_differential.js`,
`docs/ROADMAP.md`, `engine/quarantine.js`. No git.

## TAG DIFF — `data/tags.json` regenerated, by name

```
moves      500 -> 500   +0 entries
  +pp                 all 500
  +removesPP          eeriespell spite
  +setsOwnTypeAlways  struggle
  -untagged           belch spiritshackle hydropump powergem   (they carry pp now)
items      148 -> 148   +0 entries
  +restoresPP         leppaberry
abilities  267 -> 272   +5 entries: flowergift grasspelt myceliummight stickyhold terashell
  +breakable          82 abilities
  +refusesSecondaries shielddust
  +deductsExtraPP     pressure
  ignoresDefenderAbility  3 -> 4 (gains myceliummight, with onlyCategory:"Status")
  -untagged           aromaveil fluffy furcoat heavymetal lightmetal magmaarmor pressure shielddust telepathy
```

Nothing was removed.
