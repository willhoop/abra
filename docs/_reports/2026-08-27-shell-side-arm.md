# Shell Side Arm — diagnosis, not applied

Dated findings record. Not a living document; not current state. Superseded by the register row and
the census it feeds.

Read at HEAD `0e4f0a80`. **`engine/medicham2-browser.js` is being edited by another agent while this
was written** — the file moved by +48/+94 lines mid-session — so every line number below is followed
by a TEXT ANCHOR, and the text anchor is what to grep for.

---

## 1. THE TIE RULE, AND YES IT DRAWS

`data/mods/champions/moves.ts` has **no `shellsidearm` key**. The only hit anywhere in
`data/mods/champions/` is `learnsets.ts:1361` (`shellsidearm: ["9M"]`, inside the `slowbrogalar:`
block that opens at `learnsets.ts:1294`). **Champions does not override the move**, so the authority
is mainline `data/moves.ts:16209-16247`:

```js
onModifyMove(move, pokemon, target) {                              // data/moves.ts:16224
  if (!target) return;
  const atk = pokemon.getStat('atk', false, true);
  const spa = pokemon.getStat('spa', false, true);
  const def = target.getStat('def', false, true);
  const spd = target.getStat('spd', false, true);
  const physical = Math.floor(Math.floor(Math.floor(Math.floor(2 * pokemon.level / 5 + 2) * 90 * atk) / def) / 50);
  const special  = Math.floor(Math.floor(Math.floor(Math.floor(2 * pokemon.level / 5 + 2) * 90 * spa) / spd) / 50);
  if (physical > special || (physical === special && this.randomChance(1, 2))) {
    move.category = 'Physical';
    move.flags.contact = 1;
  }
}
```

At level 50 that is `physical = floor(floor(1980*atk/def)/50)` and `special = floor(floor(1980*spa/spd)/50)`.

**It is not a stat comparison. It is a DAMAGE comparison** — the target's defences are half the rule,
and the base power used is the literal `90` in the handler, not `move.basePower`.

`getStat(stat, unboosted, unmodified)` is `sim/pokemon.ts:596`. Called `(…, false, true)`:

| | included in the choice? |
|---|---|
| stat STAGES (Swords Dance, Nasty Plot, Intimidate, Icy Wind) | **YES** — `unboosted` is false |
| Modify events (burn's Atk halving, Life Orb, Huge Power, Hustle, the Ruin abilities, Tablets/Vessel) | **NO** — `unmodified` is true |
| Wonder Room | **a quirk**: `unmodified` swaps the STORED def/spd at the top of `getStat` but keeps the ORIGINAL stat's BOOST stage (`sim/pokemon.ts:604-612`) |

### The tie

`physical === special` → **`this.randomChance(1, 2)`. It draws.** The `||` short-circuits, so
**`physical > special` takes NO draw at all.** Measured, not assumed — the probe prints every
`randomChance` call of the use:

| arm | authority's randomChance sequence for the whole move use |
|---|---|
| `physical-by-defence` | `100/100 1/24` — **no tie coin** |
| `special-by-defence` | `100/100 1/24` — **no tie coin** |
| `tie-by-floor` | `1/2 100/100 1/24` — **one tie coin, drawn FIRST, before accuracy** |

### The address, and the pin covers it

`useMoveInner` calls `this.battle.setActiveMove(move, pokemon, target)` at
`sim/battle-actions.ts:428` and `this.battle.singleEvent('ModifyMove', …)` at **`:431`** — three
lines later. So at the instant of the draw, `battle.activeMove` and `battle.activeTarget` are both
populated. (This is *not* the `getRandomTarget` situation of ROADMAP #478, where neither was.)

`battle.prng.randomChance = ARM.chance` (`game_differential.js:3358`) and
`MIDW.battle = battle` at install (`:3384`), so `midDraw` resolves the battle even though `this` is
the PRNG. The tie coin's address is therefore

```
20260813 | <battle.turn> | any | shellsidearm | <side.id + position of the target> | <nth>
```

**medicham2 can name the same address today, with no new plumbing.** `MID_MOVE` and `MID_TGT` are
already written at the top of every action (`MID_MOVE=actionMoveId(it.a)||'-'` … , currently
`medicham2-browser.js:21398-21400`) and rewritten at the commit site
(`MID_MOVE=_mid; MID_TGT=_mt; }`, currently `:22422`), and `midEventSlot` spells a slot `p1`+index /
`p2`+index — byte-identical to the authority's `side.id + position`.

**And the corner arms already agree, in both directions:**

| arm | authority `ARM.chance(1,2)` | medicham2 `rng() < 0.5` | category |
|---|---|---|---|
| `top-tie-first` | `random(2)` → `m-1` = 1; `1 < 1` = **false** | `rng()` ≈ 1−1e−9; `< 0.5` = **false** | Special, both |
| `bottom-tie-first` | `random(2)` → 0; `0 < 1` = **true** | `rng()` = 0; `< 0.5` = **true** | Physical, both |
| `middle` | `midDraw('any', b) < 1/2` | `midEventDraw('any') < 0.5` | same address, same threshold |

So the correct spelling is a bare **`rng() < num/den`** off the generic `any` stream
(`const _R=rngStreams(rng); rng=_R.any;`, currently `:19929`). **No new stream, no change to
`DICE_MODEL`, and by the header's own rule — *"an engine-only change does not move the digest"* —
`PIN_DIGEST ccb365985023` should stand.** The one thing that shifts is medicham2's `nth` for later
`any` draws at that address in the same turn, and it shifts *toward* the authority, which already
takes this draw. **Flagging it for the coordinator rather than asserting it**: it is a judgement about
the digest, and the digest is MEASURE's.

---

## 2. THE PROBE, AND IT IS RED

`tests/probe_shell_side_arm.js` — `SHOWDOWN_PATH=… node tests/probe_shell_side_arm.js`, exit **1**,
~30 s, single scenarios only. Species DERIVED, stat cells SEARCHED at run time, nothing typed.

```
  legal learners (derived, filtered): 1 — Slowbro-Galar
  printed category: Special   printed flags: {"protect":1,"mirror":1,"metronome":1}
  engine-data mv.c: S

  RULE SEPARATION — does the arm set distinguish the authority from each wrong rule?
    R2 differs from R1 on 4 arm(s)      R3 on 3      R4 on 2

  ARM                        atk  spa  def  spd |  phys spec | R1  R2  R3  R4 | reasons
  physical-by-defence        100  101  100  143 |    39   27 | P   S   P   P  | 3  <- proves nothing alone
  special-by-defence         101  100  143  100 |    27   39 | S   P   S   S  | 3  <- proves nothing alone
  against-the-defence-alone  100  131  100  101 |    39   51 | S   S   P   S  | 3  <- proves nothing alone
  tie-by-floor               100  101  100  102 |    39   39 | TIE S   P   P  | 1
  tie-by-floor+burn          100  101  100  102 |    39   39 | TIE S   P   P  | 1
  tie-trivial-CONTROL        100  100  100  100 |    39   39 | TIE TIE TIE TIE| 4  <- proves nothing alone

  ARM                        | authority                 | medicham2      | verdict
  physical-by-defence        | cat P/P dmg  61/61 coins 0 | cat S dmg 43   | DIVERGES
  special-by-defence         | cat S/S dmg  61/61 coins 0 | cat S dmg 61   | agree
  against-the-defence-alone  | cat S/S dmg  79/79 coins 0 | cat S dmg 79   | agree
  tie-by-floor               | cat P/S dmg  61/61 coins 1 | cat S dmg 61   | DIVERGES
  tie-by-floor+burn          | cat P/S dmg  30/61 coins 1 | cat S dmg 61   | DIVERGES
  tie-trivial-CONTROL        | cat P/S dmg  61/61 coins 1 | cat S dmg 61   | DIVERGES
  RED — 4 failure(s). medicham2 does not choose the category.
```

**Four candidate rules, because one arm cannot separate them:** R1 the authority; R2 `atk` vs `spa`
alone; R3 `def` vs `spd` alone; R4 the exact ratio with no floors. The probe **asserts** that every
wrong rule differs from R1 on at least one arm before it reports anything, and prints each arm's
REASON COUNT — how many of the four rules produce that arm's verdict.

- **`tie-by-floor` has exactly ONE reason.** `atk≠spa`, `def≠spd`, and the two floor chains land on
  39 anyway. R2, R3 and R4 all say *not a tie*. This is the only arm in the set that can tell the
  authority's arithmetic from a plausible imitation of it.
- **`tie-trivial-CONTROL` has FOUR reasons and is staged deliberately** so its uselessness is printed
  beside the others. Equal stats all round is a tie for every rule, and it is exactly the fixture a
  hurried version of this probe would have used — Slowbro-Galar's base Atk and base SpA are **both
  100**, so the trivial tie is what the natural fixture hands you.
- **`special-by-defence` and `against-the-defence-alone` AGREE.** They are the controls: the engine is
  accidentally right whenever the answer is Special, and an instrument that reported DIVERGES on
  every arm would be measuring itself.

Two instrument corrections made during the run, both toward a comfortable answer and both caught by
printing rather than filtering: (i) an unpinned crit multiplied every authority arm by 1.5 and made
the two engines incomparable for a reason unrelated to this mechanic — `den === 24` now returns
false; (ii) the first learnset walk used `D.learnsets.getByID`, which is **undefined** on a
`forFormat` dex, inside a `try/catch(continue)` — it reported **0 legal learners** and looked like a
clean answer. The working accessor is `dex.species.getLearnsetData(id)` walked up
`battleOnly → changesFrom → prevo`.

---

## 3. WHAT THE FLIP CHANGES — a damage-only fix would be a NEW defect

The category flip moves five things, not one. **All four lists below are derived over the format with
the `x.exists && !x.isNonstandard && x.tier !== 'Illegal'` filter, and the derivation was WRONG on its
first run** — the compiled dist spells handlers with DOUBLE quotes (`move.flags["contact"]`,
`move.category === "Physical"`), so a single-quote regex silently returned 0 abilities. Printed, then
fixed, then printed again.

1. **The attacking stat** — Atk instead of SpA.
2. **The defending stat** — Def instead of SpD. (`dmgRange`'s `_aKey`/`_dKey`, currently `:10189`.)
3. **`move.flags.contact = 1`**, which turns on **17 legal contact-keyed abilities**:
   Aftermath, Cute Charm, Effect Spore, Flame Body, Fluffy, Gooey, Long Reach, Mummy, Pickpocket,
   Piercing Drill, Poison Point, Poison Touch, Rough Skin, Static, Tough Claws, Unseen Fist,
   Wandering Spirit — and **4 legal shields**: Baneful Bunker, Beak Blast, King's Shield, Spiky Shield.
   (Iron Barbs has **0 legal carriers**; Protective Pads and Punching Glove are `isNonstandard: 'Past'`.)
4. **Category-keyed effects**: 3 legal abilities (**Hustle, Toxic Debris, Weak Armor**), 1 legal item
   (**Muscle Band**), and 5 legal moves (**Aurora Veil, Counter, Light Screen, Mirror Coat, Reflect**).
5. **Narration** — but see below.

**On an exact tie the DAMAGE IS IDENTICAL** (`61/61` in the probe), because the choice quantity and
the base damage use the same numbers. The tie only becomes board-material through a *modifier* the
choice deliberately ignores. `tie-by-floor+burn` is that case measured: the burn is invisible to
`getStat(…, unmodified=true)` and halves the Physical branch only — **30 against 61, a 2× swing
decided by a coin.** The same is true of Reflect/Light Screen, Fluffy, Tough Claws and Counter/Mirror
Coat.

### The narration is already declared cosmetic on both instruments

The authority emits
```
|move|p1a: Slowbro|Shell Side Arm|p2a: Ditto|[anim] Shell Side Arm Physical
|-hint|Physical Shell Side Arm
```
`[anim]` is stripped by `game_differential.js:2023-2026` as a rendering hint, and `-hint` is
"client hint text; carries no rule" (`derive_protocol_events.js:269`) and sits in
`all_mechanics_fire.js:492`'s ignore list. **So this mechanic cannot move the narration gate. It is
board-only.** Emitting the two lines would be tidy and would change no measured number.

---

## 4. THE TAG SHAPE — and it is a population of ONE, by the regulation

**Derived, not assumed.** Legal moves whose `onModifyMove` assigns `move.category`:

| move | isNonstandard | draws a die? |
|---|---|---|
| Photon Geyser | `Past` | no |
| Tera Blast | `Past` | no |
| Tera Starstorm | `Past` | no |
| Light That Burns the Sky | `Past` | no |
| **Shell Side Arm** | **null — LEGAL** | **yes** |

**One legal member; five unfiltered.** Two consequences:

- `engine/board.js:3819-3831` says *"Four moves switch category inside that handler — Shell Side Arm
  and Photon Geyser … Tera Starstorm and Light That Burns the Sky"*. Three of those four are
  `isNonstandard: 'Past'`. The comment is an unfiltered dex walk. **board.js is not ENGINE's to
  edit — reported, not touched.** Its sizing (*"11 of 7,799 corpus games … 0.14%"*) is still right.
- **The tag must still be a SHAPE, not a name.** A hardcoded `if (id === 'shellsidearm')` would
  produce the right number and would be the wrong fix. The five members differ only in legality, and
  the shape is readable from the handler.

### `picksCategory` — every param READ from the handler source

```js
{ tag: 'picksCategory',
  param: 'the move decides physical or special from the damage each would do, and how a tie breaks',
  probe: 'picksCategory',
  why: 'Shell Side Arm is the only legal move that reassigns its own category. It moves the '
     + 'attacking stat, the defending stat, the contact flag and every category-keyed effect, and '
     + 'on a tie it draws a die the authority spends and this engine does not.',
  of: m => {
    const src = String(m.onModifyMove || '');
    const becomes = (src.match(/move\.category\s*=\s*["'](\w+)["']/) || [])[1];
    if (!becomes) return null;
    const stats = [...src.matchAll(/getStat\(\s*["'](\w+)["']\s*,\s*(\w+)\s*,\s*(\w+)\s*\)/g)];
    if (stats.length !== 4) return null;                  // not this shape; refuse, do not guess
    const bp   = +(src.match(/\*\s*(\d+)\s*\*\s*\w+\)/) || [])[1] || 0;
    const coin = src.match(/randomChance\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
    const flag = (src.match(/move\.flags\[["'](\w+)["']\]\s*=\s*1/) || [])[1] || null;
    return { becomes,                                     // 'Physical'
             comparesBy: 'damage',
             basePowerUsed: bp,                           // 90 — the HANDLER's literal, not m.basePower
             offensive: [stats[0][1], stats[1][1]],       // atk, spa
             defensive: [stats[2][1], stats[3][1]],       // def, spd
             usesBoosts: stats[0][2] === 'false',         // true
             usesModifiers: stats[0][3] === 'false',      // false
             tieDraw: coin ? { num: +coin[1], den: +coin[2] } : null,   // 1/2
             alsoSetsFlag: flag };                        // 'contact'
  } }
```

**Over-match check, run before proposing it:** the predicate matches **exactly 1** legal move
(Shell Side Arm) and 5 unfiltered. `stats.length !== 4` returns null rather than guessing, so Tera
Blast — which reassigns category from a completely different rule — is refused by shape and shows up
as unwired rather than silently given Shell Side Arm's arithmetic.

---

## 5. USAGE — derived, and it confirms the brief

`data/team-pool-frozen`: **13,214 bo3 + 4,167 ots = 17,381 games**, 17,133 distinct sheet-team
signatures. Shell Side Arm appears on **24 games / 24 distinct signatures = 0.138%**, carried by
`slowbrogalar` and nothing else — which is the learnset derivation arriving from the other end.

A naive `grep -c shellsidearm` over the same files returns **0** and `grep -ci "shell side arm"`
returns 11. Both are wrong: the store holds both spacings and both sides' sets in one flat `sets`
object. **Parse it; do not grep it.**

Expected appearances in a 961-game pinned differential ≈ 961 × 2 × 24/17,133 ≈ **2.7 team draws**,
of which the move must then be clicked *and* the category must actually differ. **Predict the pool
does not move.**

---

## THE PATCH, NOT APPLIED

Text anchors are authoritative; line numbers are from HEAD `0e4f0a80`, working tree 21:57:09, and the
file is moving under another agent.

**(a) `engine/tag_dex.js`** — add `picksCategory` (§4 above) beside the other move-shape tags; the
nearest relative is `statSwap` / `swapsStat`, whose consumer is `dmgRange`'s `_aKey`/`_dKey`.
Regenerates `data/tags.json`.

**(b) `engine/medicham2-browser.js` — the DECISION**, immediately after the commit site
`MID_MOVE=_mid; MID_TGT=_mt; }` (currently `:22422`). That is this engine's `setActiveMove`, and the
authority's `singleEvent('ModifyMove')` is three lines below its own. Shape:

```js
/* The authority's data/moves.ts:16224, mirrored. Level, base power, the two stat pairs, the tie
 * numerator and denominator and the flag all come from the tag — nothing here is typed. */
{ const _pc = _mid && TAGS.param('move', _mid, 'picksCategory');
  if (_pc && _pc.tieDraw) {
    const K = Math.floor(2 * (m.level || 50) / 5 + 2) * _pc.basePowerUsed;
    const ch = (a, d) => Math.floor(Math.floor(K * a / d) / 50);
    /* boosts APPLY, modifiers do NOT — usesBoosts true / usesModifiers false */
    const P = ch(statWithStages(m, _pc.offensive[0]), statWithStages(_tt, _pc.defensive[0]));
    const S2 = ch(statWithStages(m, _pc.offensive[1]), statWithStages(_tt, _pc.defensive[1]));
    if (P > S2 || (P === S2 && rng() < _pc.tieDraw.num / _pc.tieDraw.den)) {
      a.move.catUse = _pc.becomes === 'Physical' ? 'P' : 'S';
      if (_pc.alsoSetsFlag) a.move.flagUse = _pc.alsoSetsFlag;
      MEDSEEN.categoryPicked++;
    } else MEDSEEN.categoryPickedSpecial++;
  } }
```

`rng()` is `_R.any` (`const _R=rngStreams(rng); rng=_R.any;`, currently `:19929`) — the address, the
threshold and both pinned corners are proved in §1. **`_tt` must be the resolved target; if it is
null the authority returns early (`if (!target) return;`) and so must this.**

**(c) The PROPAGATION, which is the expensive half and the reason this is its own batch.**
`mv.c` is read at **21 live sites** and `mv` is the shared `MC.moves[id]` object — **it must not be
mutated.** The sites, currently:

```
10189 dmgRange `const phys=mv.c==='P';`      10266 suppressedAbility category
10919 absorbedBy                             11039/11040 damageByMoveTrait
11105/11106 Reflect vs Light Screen          12310/12311 punishesCategory trigger
13975, 14038 _cat                            27658 absorbedBy (loop)
28964 Counter vs Mirror Coat (`_cat=…'phys':'spec'`)
29127/29128, 29138/29139 punish triggers     29526 suppressedAbility (loop)
30610 emitted category                       31428 excludesStatus
```

Recommended shape: build ONE per-use view at the commit site — `a.move.mvUse = {...mv, c: catUse}` —
and redirect the 21 sites to `(a.move.mvUse || a.move.mv)`. One shallow clone per use, no shared
mutation, one place to be right. **A fix that touches only `:10189` changes the damage number and
leaves Reflect, Counter, Weak Armor and all 17 contact punishes reading Special — a new defect
wearing a green probe.**

Plus `mvMakesContact(id, att)` (currently `:8130`) needs a third input for the per-use flag: its
`_contactCache` is keyed on the move id alone, so a per-use `contact` cannot be expressed today.

**(d) `tests/test-mechanics.js`** — a `probe('move','picksCategory', …)` row; the nearest idiom is the
`statSwap` probe at `:10068`, which already varies a defender's Def and asserts the *other* stat does
not move. Use the `physical-by-defence` cell (defender Def down, damage must RISE) with the
`special-by-defence` cell as the knob-cleared control. **Census 765 → 766.**

---

## OWED, NOT RUN

- **Nothing under `engine/` was edited.** One new file: `tests/probe_shell_side_arm.js`. No release
  was cut; `game_differential.js` was never required.
- **`node tests/test-mechanics.js`** to regenerate the census, and **`node engine/status.js`** — both
  forbidden to me this session and both owed after the fix.
- **The `PIN_DIGEST` judgement is MEASURE's, not mine.** My reading of the `DICE_MODEL` header is that
  an engine-only draw at an existing address category does not move `ccb365985023`; it should be
  confirmed by whoever owns the pin before a run is tabled across it.
- **`engine/board.js:3819-3831` names four category-switching moves; three are `isNonstandard: 'Past'`.**
  Not mine to edit. Reported.
- **The 21 `mv.c` sites were enumerated, not audited.** I did not check each one for whether a per-use
  view is safe there.
- The `-hint` / `[anim]` lines are declared cosmetic by both instruments, so nothing here can move the
  narration gate.

## PREDICTED MOVEMENT

| scoreboard | before | after this mechanic |
|---|---|---|
| census | 765 | **766** |
| mechanics clause | 5 of 12 | **6 of 12** |
| whole-game (961) | 1 | **1 — no change expected** |
| board-material (961) | 0 | **0 — no change expected** |

**Say it before the run, not after:** at 0.138% of the frozen pool and one legal carrier, this is a
LAB mechanic under Will's 2026-08-23 ranking. **The census and the roster should move; the pinned pool
should sit still.** A flat pool is the expected result here, not a disappointment — and it is not zero
information, because the lab is the only instrument that stages the mechanic at all.
