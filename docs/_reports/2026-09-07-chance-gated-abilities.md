# Chance-gated abilities — a live-die lane for the roster (2026-09-07)

**Division.** ENGINE. **Pinned engine release** `028392265ab7` (cut 2026-09-07T23:15:52Z) for every
run in this document, because two other agents were editing `engine/medicham2-browser.js` and
`engine/game_differential.js` while it was written. A release is a COPY, so their edits cannot reach
these numbers.

**Files this pass may touch.** `tests/roster.js`, new `tests/probe_*.js`,
`tests/test-roster-arm-pin.js`, `docs/ENGINE.md`, `docs/RUNNING-NOTES.md`, this report. Nothing else.

## The starting position (release `1be57a100d59`, the artifacts on disk at 22:09Z)

| stage | MATCH | DIFFER | DID-NOT-FIRE | CONTROL-NOT-QUIET | DEFERRED | COULD-NOT-STAGE |
|---|---|---|---|---|---|---|
| items | 140 | 0 | 0 | 0 | 0 | 8 |
| abilities | 129 | 0 | 0 | 45 | 1 | 141 |
| moves | 475 | 0 | 0 | 0 | 3 | 22 |

Of the 141 ability COULD-NOT-STAGE rows, **120 are `ability/no-legal-carrier`** — a denominator
artefact of the regulation, not a gap. The real untested set is **21**, split 12 chance-gated,
3 entry-on-a-suppress-tier-carrier, 4 that threw, 2 traps nothing carries.

## Log

### The lane, and why the arm is NOT swapped

`tests/roster.js` grew a **separate lane** of rules that DECLARE `arm: 'middle'` by name. Nothing
else in the file reaches it; `play()` still resolves every arm by id, so `arm: undefined` remains
unreachable and `tests/test-roster-arm-pin.js` §2's three clauses are untouched.

Three things make a row in the lane mean something:

1. **The die is computed before the game.** `value = FNV1a(seed|turn|cat|move|target|nth)` is a pure
   function, so each rule SEARCHES its legal clicks and turns for one whose die falls below the
   ability's own declared chance, and prints the address it chose. A trial that did not fire is not a
   pass, so this is not left to luck.
2. **The authority must have moved** — `runEntry`'s existing inert gate already requires Showdown's
   own board to differ with and without the ability.
3. **The dice must be shared** — new `diceGate()`. `play()` calls `G.midResetAddresses()` before the
   game and `G.midAddresses()` after, and the row carries `dice: {sd, me, shared, sd_only, me_only}`.
   Exact set equality over `{acc, crit, sec, dmg, stall, any}` — **`any` included, which is the whole
   point**: every one of these twelve rolls outside `hitStepAccuracy`/`secondaries`/`getDamage`, so
   the authority files the coin under `any`, and `midGameVoid` deliberately excludes `any`. A parted
   set can only make the lane WITHHOLD (`COULD-NOT-STAGE / DICE NOT SHARED`), never accuse. The one
   allowed asymmetry is named: `me_only` empty on a DID-NOT-FIRE row means the authority asked a
   question this engine never asked, which is the defect rather than the ruler.

### Measured — the dice ARE shared, and this was not assumed

Every staged row so far came back `sd_only: []` and `me_only: []`, i.e. **exact set equality of the
addressed dice** over the whole game:

| ability | verdict | addresses sd/me/shared | chosen coin |
|---|---|---|---|
| Static | FIRED-AND-BOARDS-MATCH | 15 / 15 / 15 | `20260813\|3\|any\|bodyslam\|p20\|0` = 0.2637 |
| Flame Body | FIRED-AND-BOARDS-MATCH | 17 / 17 / 17 | |
| Poison Point | FIRED-AND-BOARDS-MATCH | 17 / 17 / 17 | |
| Effect Spore | FIRED-AND-BOARDS-MATCH | 17 / 17 / 17 | |
| Poison Touch | FIRED-AND-BOARDS-MATCH | 10 / 10 / 10 | |
| Cursed Body | FIRED-AND-BOARDS-MATCH | 6 / 6 / 6 | `20260813\|1\|any\|thunderbolt\|p20\|0` = 0.1838 |

### RED FIRST, and it was red

`ability/contact-statuses-the-attacker-by-chance` declares a plant that forces the cumulative roll
past the top of its range and changes nothing else:

    const _r=rng();let _cum=0;   ->   const _r=1;let _cum=0;

The unconditional ANCHOR AUDIT reports `1 of 1 apply exactly once`, and `--reds` reports

    CAUGHT   ability/contact-statuses-the-attacker-by-chance   via static -> DID-NOT-FIRE on party.status, status

so the green above it is not vacuous. Each of the other lane rules carries its own narrow anchor
aimed at its own coin.

### Cute Charm is refused, and the reason CHANGED

It is not the pin. `attract.condition.onStart` (`data/moves.ts`) returns false unless the two bodies
are opposite sexes, and **`game_differential.js#buildPair` writes `gender: 'N'` on every body on both
sides** — deliberately, because Showdown carries gender in the `|switch|` details field and medicham2
has none, so a declared gender would part every switch line. The driver says so itself:
*"gender is N on both sides, so Attract / Rivalry / Cute Charm are not exercised."*

**The coin can come up and no board will move.** That is a limit of the RIG, not of the pin and not
of the mechanic. `game_differential.js` was off-limits this pass (another agent held it), so Cute
Charm keeps a COULD-NOT-STAGE verdict with the corrected reason and is **owed a fixture that can
declare a gender**.

### The gate was wrong twice before it was right, and both times in the same direction

This is worth recording because both wrong versions *looked* careful.

1. **Whole-game set equality.** Withheld any row whose two address logs were not identical.
   Measured on the Stench and Quick Draw plants: the flinch failing to land on turn 2 changes who is
   alive on turns 3..8, so the victim that was flinched in one engine ACTS in the other and draws
   accuracy, crit and damage the authority never drew. The gate read that as "the ruler" and the two
   red demonstrations came back `COULD-NOT-STAGE / DICE NOT SHARED` — **withholding on the defect the
   lane exists to see.**
2. **Restricting to turns before the first parted board** (the driver's own rule for a whole-game
   run). That throws away the one address that matters, because the coin and its consequence are on
   the SAME turn.

**The gate now asks about the COIN BY NAME.** Every rule already knows the address — it chose the
click and the turn so the die there would come up — so the address travels with the scenario:

| | meaning | what the gate does |
|---|---|---|
| authority never threw it | the fixture failed | `COULD-NOT-STAGE`, and it says it is about this file |
| both threw it | one die, one value, by construction | any verdict stands, row stamped `coin_shared` |
| only the authority threw it | this engine never asked; addressed dice mean a skipped draw shifts nothing | the ENGINE. Accusation allowed, address printed |
| only this engine threw it | we named an event the authority never named | that IS the ruler — withheld |

The whole-set comparison is still taken and still published in `dice.sd_only` / `dice.me_only`; it
just does not decide a verdict.

**Residual risk, stated and not closed:** two engines building the SAME address for DIFFERENT events.
The strings match, the semantics do not, and no address comparison can tell.

### The eleven staged rows, with their coins

Every one: `coin_shared: true`, and `sd_only = 0, me_only = 0` over the whole game as well.

| ability | verdict | coin |
|---|---|---|
| Static | FIRED-AND-BOARDS-MATCH | `20260813\|3\|any\|bodyslam\|p20\|0` |
| Flame Body | FIRED-AND-BOARDS-MATCH | `20260813\|3\|any\|bodyslam\|p20\|0` |
| Poison Point | FIRED-AND-BOARDS-MATCH | `20260813\|3\|any\|bodyslam\|p20\|0` |
| Effect Spore | FIRED-AND-BOARDS-MATCH | `20260813\|3\|any\|bodyslam\|p20\|0` |
| Cursed Body | FIRED-AND-BOARDS-MATCH | `20260813\|1\|any\|thunderbolt\|p20\|0` |
| Poison Touch | FIRED-AND-BOARDS-MATCH | `20260813\|2\|any\|liquidation\|p10\|0` |
| Shed Skin | FIRED-AND-BOARDS-MATCH | `20260813\|5\|any\|-\|-\|0` |
| Healer | FIRED-AND-BOARDS-MATCH | `20260813\|3\|any\|-\|-\|0` |
| Harvest | FIRED-AND-BOARDS-MATCH | `20260813\|3\|any\|-\|-\|0` |
| Stench | FIRED-AND-BOARDS-MATCH | `20260813\|2\|sec\|dragonclaw\|p10\|0` |
| Quick Draw | FIRED-AND-BOARDS-MATCH | `20260813\|5\|any\|-\|-\|0` |

### Every one of the seven plants goes RED

    CAUGHT   ability/contact-statuses-the-attacker-by-chance      via static      -> DID-NOT-FIRE on party.status, status
    CAUGHT   ability/seals-the-attacking-move-by-chance           via cursedbody  -> CONTROL-NOT-QUIET on vol.disable
    CAUGHT   ability/poisons-what-it-touches-by-chance            via poisontouch -> DID-NOT-FIRE on party.hp, party.status, hp, status
    CAUGHT   ability/cures-a-status-at-the-residual-by-chance     via shedskin    -> DID-NOT-FIRE on party.hp, party.status, hp, status
    CAUGHT   ability/restores-a-spent-berry-by-chance             via harvest     -> DID-NOT-FIRE on party.hp, hp
    CAUGHT   ability/adds-its-own-secondary-by-chance             via stench      -> DID-NOT-FIRE on pp.dragonclaw, party.hp, hp
    CAUGHT   ability/jumps-its-priority-bracket-by-chance         via quickdraw   -> DID-NOT-FIRE

The eighth rule (`contact-plants-a-volatile-on-the-attacker-by-chance`, Cute Charm's shape) has no
stageable member, so `--reds` has nothing to play — its anchor is checked by the unconditional
ANCHOR AUDIT, which reads **38 of 38 apply exactly once** with no dead anchors.

### Abilities stage, release `028392265ab7`

| | before | after |
|---|---|---|
| FIRED-AND-BOARDS-DIFFER | 0 | **0** |
| DID-NOT-FIRE | 0 | **0** |
| DEFERRED-BY-OWNER | 1 | 1 |
| FIRED-AND-BOARDS-MATCH | 129 | **140** |
| CONTROL-NOT-QUIET | 45 | 45 |
| COULD-NOT-STAGE | 141 | **130** |

Arms actually handed to the driver: `top-tie-first 444, middle 30, bottom-tie-first 19`, no
`DRIVER-DEFAULT:` key.

## The four THREW rows were ONE instrument defect, and it was in the stat model

`overgrow`, `sharpness` and `unburden` all read

    THREW — p2 choice rejected p2 "pass, move 1": Can't pass: Your <X> must make a move (or switch)

and nothing said why. A throw carrying only the rejected choice string names three completely
different faults with one sentence, so `play()` now appends the last eight lines of this engine's own
narration to a thrown game. That is what made the rest of this visible in one run.

### 1. The roster priced bodies the driver no longer builds

`tests/roster.js` carried its own level-50 stat line and its comment said *"flatL50 is the same line
`game_differential.js` gives both engines"*. **It stopped being true.** `buildPair` now puts a real
Champions SP spread on every body (`spreadFor(index, sp)`: the higher attacking stat takes up to the
32 cap, Speed off a ladder keyed on the slot, the rest spilling to Sp.Def then Def). The roster
assumed a blank spread, so every derived hit in the file was sized for a body that no longer exists.

**Measured.** `ability/pinch-offense` sized Dragapult's Ice Punch into Torterra at 152 of 170 HP —
"taken to 11%", comfortably above the 1/3 gate. The authority dealt **188**; Torterra fainted; Milotic
came in; the script's next click named a move Milotic does not have; the driver answered `pass`; the
game threw. Dragapult builds at **172 Attack**, not the 140 the old line computed.

`flatL50` now asks `buildPair` for the body, caches per species, and **prices from the SPEC through
`M.spreadL50`** — the engine's own exported line. Nothing re-types a formula and nothing invents a
spread. **A second trap on the way there, worth recording:** `buildPair` returns `{ medi, spec, sd }`
and `medi.st` is a stat block computed *before* the spread resolves — `playGame` throws that body away
and rebuilds through `freshBodies`, which reads `spec`. Reading `medi.st` gave Dragapult 190 Attack and
Chesnaught 183 Defence; the spec gives 172 and 142, and **142/172 reproduces the authority's 176
damage exactly**. The fallback to the old arithmetic is counted and NAMED on every run
(`THE STAT PREDICTOR — … species priced through the driver's own builder … 0 fell back`).

### 2. `hitInBand` took the LARGEST hit inside the band

Every caller wants a body brought into a band and left standing. Taking the largest in-band hit put
the body as close to death as the band allows, so any modelling error at all is fatal — and one
arrived. One comparison changed: smallest in-band, which clears the same gate with the most headroom.

### 3. `ability/base-power-scoped` selected a CHARGE move

`slicing` picked **Solar Blade**, which charges on turn 1 and is locked on turn 2, so the script's
turn-2 click resolved to `pass` and Showdown refused it. `deliveryOf` has excluded charge and recharge
everywhere else in this file since it was written; this pool selects on the SCOPE rather than on being
boring, and had no such exclusion. It picks Sacred Sword now.

### All three stages after the fix — nothing went down

| stage | MATCH before | MATCH after | COULD-NOT-STAGE before | after | DIFFER | DID-NOT-FIRE |
|---|---|---|---|---|---|---|
| items | 140 | **140** | 8 | 8 | 0 | 0 |
| abilities | 129 | **143** | 141 | **127** | 0 | 0 |
| moves | 475 | **478** | 22 | **19** | 0 | 0 |

CONTROL-NOT-QUIET is 45 on abilities before and after; DEFERRED 1 / 0 / 3 unchanged. Anchors: 18/18,
38/38, 36/36 apply exactly once, no dead anchors. Stat predictor fell back **0** times on all three
stages. The three moves that stopped being COULD-NOT-STAGE are **Bug Bite, Pluck and Recycle**; no
move became COULD-NOT-STAGE that was not before.

## Shadow Tag: the refusal detector had gone stale on a MESSAGE FORMAT

`switchVerdict`'s refusal test was

    /choice rejected "[^"]*switch/i

which requires the quoted choice to follow `rejected ` immediately. `game_differential.js`'s
`refusedChoice(sd, input, err)` prepends the SIDE ID, so what the driver throws is

    p1 choice rejected p1 "switch 3, move 1": Can't switch: The active Pokemon is trapped

and the pattern could not reach the quote. **The one thing Shadow Tag exists to prove — that the
authority refuses the switch — was being read as "the subject arm did not run for a reason that is
NOT a refused switch", i.e. the trap WORKING was filed as a broken fixture.** Same class as a dead
plant anchor: a string pattern outliving the string it names, failing silent. Both halves of the
refusal are matched now (the choice naming a switch, and the authority's own reason), so a further
format change degrades to one clause rather than to none.

Shadow Tag reads FIRED-AND-BOARDS-MATCH with its pre-mega in-game control landing in both engines and
all six exception arms BOTH-ALLOWED. **Nine trapping MOVES came back with it** — Block, Mean Look,
Bind, Fire Spin, Infestation, Sand Tomb, Snap Trap, Whirlpool, Wrap — which is most of the move
stage's gain.

## Forecast and Mimicry: not entry effects at all

`ability/entry` refused them with a reason that is true of an entry effect and not of these two:
*"an entry effect has already fired by the time any click resolves"*. Castform's forme follows the SKY
and Stunfisk-Galar's type follows the TERRAIN, **continuously** — so the field can be raised by a MOVE
on a turn after the in-play Skill Swap control has landed. Two new rules
(`ability/forme-follows-the-sky`, `ability/type-follows-the-terrain`) sit above the entry rule and both
stage FIRED-AND-BOARDS-MATCH. The field is raised by a move and not by `WEATHER_SETTER`, which is an
ENTRY ability and would have put the sky up at boundary 0 — before the control — recreating the exact
problem.

## Zero to Hero: a HARDER refusal, and the distinction is the point

Its trigger is a switch OUT, turns after any control could land, so timing is not what stops it. The
format shuts all three control shapes at once, both halves read off the source rather than remembered:

    Battle#skillSwap      sim/battle.ts:1316   targetAbility.flags['failskillswap'] -> false
    Gastro Acid onTryHit  data/moves.ts:6437   target.getAbility().flags['cantsuppress'] -> false

plus a carrier (Palafin / Palafin-Hero) whose only ability slot holds it. The refusal text now says so.
**One refusal is a standing invitation to build a better fixture and the other is a fact about the
regulation** — Forecast and Mimicry were the first kind and both stage now; this is the second.

**A NEAR MISS WORTH RECORDING.** The first version of this was a new RULE matching `failskillswap +
cantsuppress` on a non-ALTERNATE carrier. It over-matched: **Disguise and Stance Change carry both
flags too**, and both were already FIRED-AND-BOARDS-MATCH under `ability/generic`. The rule stole two
green rows — abilities read 144 instead of 146 — and it was caught by comparing the total against the
count of newly-staged entities rather than by anything the run said. The rule was deleted and the
derived reason put inside the refusal that already owned Zero to Hero, which reaches nothing else.

## Arena Trap and Magnet Pull: confirmed unreachable, by derivation

    D.species.all().filter(x => x.exists && !x.isNonstandard && x.tier !== 'Illegal')
                   .filter(s => Object.values(s.abilities).some(a => id(a) === 'arenatrap'))   ->  0
                                                                                'magnetpull'   ->  0

Zero legal carriers in this format. Both rows already carry `out_of_scope: 'no-legal-carrier'`, which
is the correct classification: a property of the REGULATION, not a gap in the instrument.

## Final counts — release `028392265ab7`, all three stages, artifacts written

| stage | DIFFER | DID-NOT-FIRE | DEFERRED | MATCH | CONTROL-NOT-QUIET | COULD-NOT-STAGE |
|---|---|---|---|---|---|---|
| items | 0 | 0 | 0 | **140** | 0 | 8 |
| abilities | 0 | 0 | 1 | **146** (was 129) | 45 | **124** (was 141) |
| moves | 0 | 0 | 3 | **487** (was 475) | 0 | **10** (was 22) |

Anchors 18/18, 40/40, 36/36 apply exactly once, **no dead anchors**. Stat predictor **0 fallbacks** on
all three. `tests/test-roster-arm-pin.js` all clauses pass, including the new §4, which was shown RED
on a deliberate break (`sc.coin = null` → both coin clauses fail).
`tests/test-docs-current.js` 33 passed, 0 failed.

`data/roster.{items,abilities,moves}.json` written with `--keep-shared`, so `data/roster.json` was
left alone — two other agents were live.

## Of the 21 rows the brief named

| | outcome |
|---|---|
| Static, Flame Body, Poison Point, Effect Spore, Cursed Body, Poison Touch, Shed Skin, Healer, Harvest, Stench, Quick Draw | **staged, FIRED-AND-BOARDS-MATCH, coin_shared** |
| Overgrow, Sharpness, Unburden, Shadow Tag | **staged, FIRED-AND-BOARDS-MATCH** |
| Forecast, Mimicry | **staged, FIRED-AND-BOARDS-MATCH** |
| Cute Charm | refused — the DRIVER builds every body genderless; owed a fixture that can declare one |
| Zero to Hero | refused — the format shuts all three control shapes; derived, cited |
| Arena Trap, Magnet Pull | confirmed unreachable by derivation — zero legal carriers |

**17 staged. 4 declared with derived reasons. NOT ONE revealed an engine defect** — every staged row
is FIRED-AND-BOARDS-MATCH, and for the eleven live-die rows the two engines are proven to have thrown
the identical die at the identical address.

## Owed elsewhere, reported and not touched

- **`engine/game_differential.js#buildPair` writes `gender: 'N'` on every body**, so Attract, Rivalry
  and Cute Charm cannot be exercised at all. The driver says this itself. Cute Charm is the one row
  this pass could not stage for that reason. Another agent held the file.
- **`tests/probe_reds_plant_reaches.js` dies at the default heap** — `FATAL ERROR: Reached heap limit`
  — and declares no `ABRA-HEAP:` header, which is the exact case `tools/lownode.cmd` documents as "a
  memory ceiling read as a verdict". At `--max-old-space-size=6144` it runs and exits 1 on
  pre-existing NO-REACH rules (`move/pseudo-weather`, `move/traps-and-somebody-tries-to-leave`,
  `move/volatile`; on the abilities stage `ability/entry`, `ability/refuses-a-forced-switch`,
  `ability/residual`, `ability/trap-arrives-with-a-mega`). **All nine new lane/field rules REACH**,
  so the plants are semantically live and not merely anchored. Not edited — not my file this pass.
- **`tests/probe_reds_plant_reaches.js` reads a THROWN clean fixture as "cannot answer"** for
  `ability/trap-arrives-with-a-mega`. That is the same conflation the roster had until this pass: for
  a `switchProbe` scenario a THROW IS the refusal.
