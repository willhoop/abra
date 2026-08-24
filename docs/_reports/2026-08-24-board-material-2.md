# Board-material, second pass — three mechanisms, two pool games cleared, and one lab damage row closed

2026-08-24. ENGINE. A dated findings record, not a living document: it is never maintained and is
superseded by the register rows it feeds.

---

## The verdict

**Board-material went 20 games → 18 (19 causes → 17). Narration did NOT rise: 17 games / 16 causes on
both arms. Census 683 → 686 live, 0 missing, 0 threw.** Arm `middle`, **961 games** (the run is
`--games 1200`; 961 is what the coverage stop actually played), `--team-store data/team-pool-frozen`,
census pinned to `data/verification/census-pin-9446a684709d.json`, `--end-state`. Before-arm release
**`b35e96a0e7c7`** (= HEAD `df2bef5`), after-arm release **`f9ff2b031d93`**.

Three mechanisms landed. **Two pool games cleared, zero new diverging games, and no game merely
changed its label** — the game-by-game diff on `config|seed` is the attribution, not a net.

| what was wrong | what it cleared | probe |
|---|---|---|
| **A screen-breaking move broke the screen even when the target was immune to it** | 1 pool game | `move/clearsScreens` |
| **A move trap outlived its trapper** — the victim stayed held after the body that trapped it left | 1 pool game | `move/trapsTarget` |
| **Hustle never spent its 1.5x Attack** | 1 lab row (`all_mechanics_fire`), 0 pool games | `ability/damageBoost` |

**Said before the run, as the ranking rule requires:** the first two are pool defects and were expected
to move the pool. Hustle is a 29-use ability on one body and was expected to move the LAB and not the
pool. Both expectations held.

---

## 1. A screen-breaking move broke the screen through an immunity — 1 game

`psychicfangs.onTryHit(pokemon) { pokemon.side.removeSideCondition('reflect'); ... }`
(`data/moves.ts:14072`, no Champions override; `brickbreak` and `ragingbull` are the same shape).

**It is the MOVE's own `onTryHit`, and a move's own `onTryHit` is not the `TryHit` EVENT.** The event
is step 2 of `moveSteps`; the move's handler is a `singleEvent` fired from `spreadMoveHit`
(`sim/battle-actions.ts:1044`), which `hitStepMoveHitLoop` calls — and that is the LAST entry in
`moveSteps` (`:577`). So by the time the authority asks about the screens it has already had the
chance to drop this target on:

```
step 0 invulnerability   step 1 TryHit event (Protect, an absorbing ability)
step 2 TYPE IMMUNITY     step 3 TryImmunity (powder, onTryImmunity)
step 4 accuracy          step 5 breakProtect
```

This engine broke the screens on the CLICK, above all six. The block's own comment said *"it fires on
USE, before damage, which is the real rule"* — the second half is true and the first half was four
gates too early.

**The witness in the pool:** a Metagross's Psychic Fangs into a Grimmsnarl (Dark) took down a Reflect
that had gone up on the same turn. `|-immune|p2b: Grimmsnarl` on the authority against this engine's
`|-sideend|p2: |move: reflect`, and the board leaf `p2.screens.named.reflect` read **null against 7**.

**The fix is a hit STEP, not a guard.** `_stepClearScreens` sits between `_stepBreakProtect` and
`_stepDamage`, so the driver's own `R.out` does the refusing — every one of those six gates already
sets it, which means this needs no gate of its own and cannot drift from theirs. It sits ABOVE the
damage step because the authority's `onTryHit` is above `tryPrimaryHitEvent`, and `data/moves.ts:14073`
says in its own words *"will shatter screens through sub"*.

**The side is now the TARGET's own** (`pokemon.side`), not the mover's foe side. Every member is
`target: normal`, which in doubles can legally be aimed at a partner, and the old block took the far
side down whoever was aimed at.

**The probe, red first, with a cleared control.** The knob is the target's TYPE and nothing else — same
click, same screen, same physical follow-up. Grimmsnarl is Dark (Psychic-immune) and Clefable is Fairy
(not); both are legal and both learn Reflect, read off the format rather than recalled. The consequence
is measured as DAMAGE TAKEN through the screen, not as a protocol line.

```
                        idle -> after Psychic Fangs
pre-fix   Dark target    157 -> 170      <- the screen fell through an immunity
          Fairy target   105 -> 158
post-fix  Dark target    157 -> 157
          Fairy target   105 -> 158      <- unchanged: the move still breaks screens
```

---

## 2. A move trap outlived its trapper — 1 game

**This engine's own source had already written the defect down and left it open**, verbatim, beside
`out._trapHard = null`:

> *"WHAT THIS DOES NOT FIX, STATED: Showdown links the victim's `trapped` to the TRAPPER through
> `linkedStatus: 'trapper'`, so the trap also dies when the SOURCE leaves. `_trapHard.by` records the
> source and nothing reads it at the switch gate. No failing probe on it; open, not silently
> half-done."*

There is a probe now, and this is the reader. The authority's chain, read at the lines:

```
meanlook / block      target.addVolatile('trapped', source, move, 'trapper')   <- 4th arg = linkedStatus
Pokemon#addVolatile   sim/pokemon.ts:2020-2029  puts `trapper` on the SOURCE and cross-links the pair
Pokemon#clearVolatile sim/pokemon.ts:1532-1536  walks its OWN volatiles, calls removeLinkedVolatiles
removeLinkedVolatiles sim/pokemon.ts:2053       linkedPoke.removeVolatile('trapped')
```

So the release is the LEAVER's own `clearVolatile` — exactly where this engine's `out._trapHard=null`
already sat. The half that was missing was the other end of the link.

**It is SILENT, and that is why only a board could find it.** `trapped` declares no `onEnd`, so
`removeVolatile` writes nothing; both protocol streams agree line for line while one engine holds a
body the other has let go. The witness is `active[].vol.trapped` — medicham 1 against the authority's
0 on turn 9 of one pinned game, whose protocol then parts a turn later on WHICH body switched.

**The fainted trapper is served one moment late, and that is declared rather than hidden.** The
authority frees the victim inside `faintMessages()`; this engine sets `fainted` at **25 inline sites**
and has no single drain that owns the STATE, so there is no equivalent instant to hook. `bringIn` is
the next chokepoint every dead body passes through — inside the same turn, so a turn-boundary board
agrees and a mid-turn switch decision taken between the KO and the replacement does not.

**`partiallytrapped` (Infestation, this engine's `_trap`) is deliberately NOT touched.** It is a
different condition with a different rule — `onResidual` drops it when the source is gone and writes a
`-end … [silent]` — and folding the two would make one of them wrong.

**The probe, red first, and the red is the unwired-knob signature.** Same trap, same victim, same turn
count; the only knob is whether the trapper walks off on turn 2.

```
pre-fix    trapper stays "milotic"     trapper leaves "milotic"      <- identical across the knob
post-fix   trapper stays "milotic"     trapper leaves "kangaskhan"
```

The trap was laid in both arms (`true/true`), so the fixture is not inert. All four sibling
`trapsTarget` probes stayed green.

---

## 3. Hustle never spent its 1.5x Attack — a lab row, not a pool one

`hustle.onModifyAtk(atk) { return this.modify(atk, 1.5); }` (`data/abilities.ts:1901`, no Champions
override). `data/all-mechanics-fire.json` reported Hustle as `FIRED` **and** `diverged`, board verdict
**STATE**, with its control arm at NO-DIVERGENCE: a Flapple's hit read `906/960` here against the
authority's `879/960`. **54 against 81 is exactly 1.5** — the whole of the ability.

**Why it was unwired, and it was a guard doing its job.** The `damageBoost` stat-stage consumer in
`dmgRange` requires `tags.length === 1` — the ability must carry NOTHING but `damageBoost` — because on
nine abilities the tag duplicates a sharper one the engine already spends. Hustle carries
`writesAccuracy` and `accuracyMod` beside it, both ACCURACY, both spent in `hitChance`, neither able to
reach a damage stage. **The guard asks "does it carry anything else" where the real question is "does
anything else this FUNCTION spends already pay it".**

**Membership printed over the format before a line was wired.** 29 legal abilities carry `damageBoost`;
the new branch's shape — `attackStat`, a named stat, no type, no weather, no condition — selects
exactly four, and three of them are already spent by name four lines above:

```
hugepower  purepower  guts   <- spent by NAME in dmgRange
hustle                       <- the only member this branch adds today
```

**So the collision is not with a tag, it is with four hard-coded lines**, and `STAT_MULT_BY_NAME` is
that list rather than a proxy for it. It is a statement about THIS FILE — read off the lines between
`hugepower` and `waterbubble` — and not a list of Pokémon facts, which is why it is allowed to be
written down. A name missing from it double-pays, which the probe's Huge Power arm catches.

**The two controls are the two ways to fix this wrong, and both are in the same probe:**

```
Grav Apple off one Flapple, only the ability varies
  no ability   87
  HUSTLE      130      (must be ~1.5x = 131)
  GUTS         87      CONTROL — a healthy body. `guts.damageBoost` carries `onlyWhen: null` in the
                       artifact where the handler is `if (pokemon.status)`, so a widening that merely
                       dropped the guard would hand every healthy Guts body a permanent 1.5x.
  HUGE POWER  174      CONTROL — must be ~2x = 174 and NOT 4x = 348, which is what a widening that
                       double-pays the named line reads.
```

Pre-fix the Hustle arm read **87**, identical to the no-ability arm.

**A derivation gap is reported rather than papered over:** `guts.damageBoost.onlyWhen` is `null` where
the handler needs a status. Until `tag_dex.js` derives a `hasStatus` condition, Guts may not be served
from its tag and stays on the named list.

---

## The numbers — a re-baseline, said first

Arm **`middle`**, **961 games played** at `--games 1200`, turn cap 12,
`--team-store data/team-pool-frozen`, census pinned to `census-pin-9446a684709d.json` (digest
`9446a684709d`, 643 rows), `--end-state`. Before-arm release **`b35e96a0e7c7`** (HEAD `df2bef5`),
after-arm release **`f9ff2b031d93`**.

| | before | after |
|---|---|---|
| raw protocol divergences | 37 | **35** |
| undeclared (the published headline) | 24 of 961 = 2.5% | **22 of 961 = 2.3%** |
| **BOARD-MATERIAL** | 19 causes / **20 games** | 17 causes / **18 games** |
| NARRATION-ONLY | 16 causes / 17 games | 16 causes / **17 games** (unmoved) |
| DIFFERENT-END-STATE | 14 | **12** |
| census live / probed / missing | 683 / 683 / 0 | **686 / 686 / 0** |
| `all_mechanics_fire` diverging abilities | 4 (berserk, forewarn, **hustle**, sandforce, supremeoverlord) | **3** (hustle gone) |

The two cleared, by `config|seed`:

```
baseline           …2635913168   extra event :: |-immune|p2b <> |-sideend|p2:|reflect        screen break
pair-protect-bust  …2659813310   event missing :: |switch|p2a|talonflame <> |switch|p1a|…    the move trap
```

**Of the 18 board-material games that remain, 8 are Moody** — the declared non-defect. So **10 are
ENGINE board-material**, down from 12.

### THE TRAP THAT ALMOST COST THE MEASUREMENT: `--games` IS NOT THE NUMBER OF GAMES

The standing baseline says **961 games**, and the run that produced it was **`--games 1200`**. `--games`
sets the per-config PAIR BUDGET (`per = floor(2 * n / 9)`); the coverage stop then decides how many are
actually played. Run at `--games 961` the pool yields **777** pairs — a different, smaller sample — and
the first after-arm run did exactly that and reported **38 board-material of 777**, which looks like a
catastrophic regression and is simply a different question. **It was caught by comparing the swarm's
`available`/`picked` columns against the HEAD artifact**, which were identical in `available` (8778,
99, 7, 4798, 4357, 365, 945, 3448, 7079) and differed in `picked` (266 against 213). The run was
re-done at `--games 1200` and the numbers above are that run.

**And running `engine/replay_one.js` REBUILT THE POOL CACHE.** It printed *"pool cache MISS —
rebuilding from the store (~41 s). The store moved, or no cache exists"* and wrote a new one. The
corpus came back identical (8778 teams both sides) so nothing was lost, but a debugging tool that
silently rewrites the sample's cache is worth knowing about before a measurement.

### The must-not-move list, checked

- **damage differential 0 of 6000** at `--n 6000 --seed 20260804`, and 0 at **all 16 corners**
  (`top`, `bottom`, `idx01`–`idx14`). Re-run AFTER the Hustle change, which is the one that touches the
  damage chain.
- **census 686 probed / 686 live / 0 missing**, 0 probes threw, 0 hollow, `unarmed` 0 and `directCall`
  1 — the ratchet held with no `--accept`.
- **narration did not rise** — 17 games / 16 causes on both arms.
- **all four withheld artifacts were restored** at release `f9ff2b031d93`: roster items **0
  FIRED-AND-BOARDS-DIFFER / 0 DID-NOT-FIRE** (139 of 148 tested), abilities **0 / 0** (130 of 202),
  moves **0 / 0** (475 of 500), and `all_mechanics_fire --kind all` re-run and re-written.
- **the gate holds at 5 of 8 PASS**, the same three failing.

### Everything else that was run green

`test-engine-consistency`, `test-resolution-order` (26 arms, 1 declared KNOWN-OPEN, 0 failing),
`test-end-state`, `test-volatile-duration`, `test-bracket-regain`, `test-encore-fail-silent`,
`test-protocol-trace`, `test-immunity-gate`, `test-tag-params-derived`, `test-mc-seal` (33/0),
`test-medicham-coverage` (ratchet held), `test-nature-differential`, `test-middle-identity`,
`test-coverage-stop`, `test-roster-arm-pin`, `walk_tags`, `artifact_audit` (no gaps),
`engine/move_result_state.js --selftest` (18/0), and `test-no-silent-failure --only` over the two files
this batch touches.

---

## What was NOT claimed

- **The instrument cannot vouch for a persisting Substitute.** Nothing here touches Substitute HP,
  which is named in `end_state_not_compared`.
- **`data/game-differential.json`'s own planted-state proof is not asserted here.** It was `false` on
  both arms of the previous batch and the artifact prints *"every state number below is worthless"*
  beside it. Pre-existing, unchanged, and repeated because every board-material figure this sprint has
  published — including 20 and now 18 — was measured under it.
- **The screen fix is not claimed to change any BASE POWER or any damage number.** It changes WHEN the
  screens come down and nothing else; the 0/6000 differential is the receipt.
- **No `MEDI_*` knob was added.** Each of the three probes was watched RED on the live tree with its
  controls already correct, and the pre-fix output is quoted above. There is no environment-variable
  revert to re-demonstrate it later, and this says so rather than implying one exists.

---

## A STANDING HAND-LIST ENTRY IS WRONG AND IS CORRECTED HERE

The hand list says *"a Sitrus Berry is eaten and then not gone"*. **It is HARVEST giving the berry
back**, and the diagnosis matters because it changes who owns the row.

Trevenant's abilities are Natural Cure / Frisk / **Harvest** (derived from the format). `harvest`
(`data/abilities.ts:1790`) is `onResidualOrder: 28`, `onResidualSubOrder: 2`, and fires on
`this.field.isWeather(['sunnyday','desolateland']) || this.randomChance(1, 2)`. In the diverging game
there is no sun, so it is **a coin**, and the authority's coin came up the other way. Two things follow:

1. **the board difference is a DIE, not a rule.** Our engine implements Harvest and drew `rng()` off
   the shared `any` address at residual time; the authority's `randomChance(1,2)` at that moment is
   addressed from `battle.activeMove`/`activeTarget`, which are not the same question. This is the same
   shape as Moody and is NOT claimed to be alignable without work on the address;
2. **and the LINE is separately wrong.** The authority writes
   `|-item|POKEMON|Sitrus Berry|[from] ability: Harvest`; this engine writes
   `|-activate|POKEMON|item: sitrusberry`. That is a real narration defect, it is one line, and it was
   NOT fixed tonight because fixing it would move a board-material game onto the narration gate rather
   than closing it, which the brief calls out as not-progress.

---

## SCOPED AND STOPPED — the two remaining named damage rows, with their shape

Both are genuine and both need work outside this batch's blast radius. **Named, not half-landed.**

- **`sandforce` — two gaps, one of them upstream in the artifact.**
  (a) `data/tags.json` carries `damageBoost.onType: "Rock"` where the handler is
  `move.type === 'Rock' || move.type === 'Ground' || move.type === 'Steel'`
  (`data/abilities.ts:3950`). `tag_dex.js:7567` reads the type with a single-match regex
  (`(src.match(/move\.type\s*===?\s*"(\w+)"/) || [])[1]`), so it keeps the FIRST of three.
  (b) Even with the list right, **no consumer serves the shape**: Sand Force is
  `stage:'basePower'` WITH a type AND a weather, and both base-power branches in `dmgRange` require
  `!onType && !inWeather`. Fixing it means changing `onType` to a LIST in the derivation, regenerating
  `data/tags.json` and `data/abra-tags.js`, and adding a branch — a tag-artifact regeneration, which is
  a bigger blast radius than a three-fix night should carry. The lab witness is a Bulldoze (Ground) into
  a Feraligatr: `702/960` on the authority against `718/960` here, a 1.30 ratio on one hit.
- **`shellsidearm`** — not examined tonight. Still on the list.

## The remaining board-material set, after Moody comes out

17 causes / 18 games, of which 8 games are Moody. The remaining **ten**, verbatim from the artifact:

```
1  unrelated event mismatch :: |move|p2a|psychicfangs <> |cant|p2a|flinch      (a `sec` draw)
1  unrelated event mismatch :: |-activate|p2a|telepathy <> |-immune|p2a|[from]telepathy
1  -damage: a different body :: |-damage|p2a|H/H <> |-damage|p2b|H/H           (an Outrage random-target draw)
1  extra event emitted by medicham2 :: |faint|p2b <> |-status|p2a|brn          (the KO'd spread target's faint)
1  event missing from medicham2 :: |switch|p2a|crabominable,l50|H/H <> |cant|p1b|recharge
1  ordering :: |switch|p1b|whimsicott,l50|H/H <> |switch|p1a|alakazam,l50|H/H  (turn-2 switch order, in a Magic Room)
1  unrelated event mismatch :: |cant|p2a|slp <> |-curestatus|p2a|slp|[msg]     (a sleep-duration draw)
1  unrelated event mismatch :: |-supereffective|p1a|1 <> |move|p1a|gravity     (board: vol.charging 0 vs 1)
1  extra event emitted by medicham2 :: |upkeep <> |-activate|p1b|sitrusberry   (the HARVEST coin — see above)
1  unrelated event mismatch :: |-fail|p2b <> |-start|p1a|disable|protect       (we start a Disable the authority fails)
```

**Read this list with the die caveat.** At least four of the ten are a random draw at an address the two
engines do not share (the Rock Slide flinch secondary, the Outrage random target, the sleep counter, the
Harvest coin) and belong with Moody rather than with the eight rules that have been fixed this sprint.
**That is a hypothesis from the shape of each row, not a measurement**, and nothing here declares any of
them — declaring subtracts from the gate and an agent may not do that.

### TWO BOARD DIVERGENCES THAT NEVER PART THE PROTOCOL, AND SO ARE NOT IN THE 18

`state.first_board_divergences` holds 24 games where a board parted; two of them never parted a
protocol line and therefore appear in no cause row:

- **Castform, 2 games.** `p2.active[0].species` reads `castform` here against the authority's
  `castformrainy`. **It is DECLARED in the engine already** and the declaration is correct:
  `data/engine-data.js` has no row for Castform-Sunny / -Rainy / -Snowy, so `formeSwap` would fail its
  `buildMon` lookup and change nothing, and Forecast is modelled as a RETYPE with
  `MEDFAILS.formeWeatherNameUnchanged` counting every application. The types are right; the label is
  not. **ENGINE may not edit `data/engine-data.js`** — this belongs to a refit, and the measured cost
  (2 games of board divergence, 0 of protocol) is recorded here because it had never been quantified.

---

## Proposed register rows — `docs/ROADMAP.md` was NOT edited, per the brief

- *A screen-breaking move broke the screen through a type immunity, a miss and a Protect.* ENGINE.
  **CLOSED** 2026-08-24. The move's own `onTryHit` is a `singleEvent` inside `hitStepMoveHitLoop`, the
  last of the eight `moveSteps`; this engine ran it on the click. Instrument:
  `engine/game_differential.js`, arm `middle`, cause
  `extra event emitted by medicham2 :: |-immune|p2b <> |-sideend|p2:|reflect`; board leaf
  `p2.screens.named.reflect` null against 7. 1 game of 961, BOARD-MATERIAL. Probe:
  `move/clearsScreens` — *"Psychic Fangs leaves the screen up when the target is immune to it"*.
- *A move trap outlived its trapper.* ENGINE. **CLOSED** 2026-08-24. `trapped` carries
  `linkedStatus: 'trapper'`; `clearVolatile` removes the victim's half when the source leaves. The
  defect was already written into this engine's own source as an open gap. Instrument: the same, cause
  `event missing from medicham2 :: |switch|p2a|talonflame,l50|H/H <> |switch|p1a|falinksmega,l50|H/H`;
  board leaf `active[].vol.trapped` 1 against 0. 1 game of 961, BOARD-MATERIAL. Probe:
  `move/trapsTarget` — *"the trap dies with its TRAPPER"*. **The FAINTED trapper is served from
  `bringIn`, one moment later than the authority's `faintMessages()`** — same turn, so a turn-boundary
  board agrees; named, not hidden.
- *Hustle never spent its 1.5x Attack.* ENGINE. **CLOSED** 2026-08-24. The `damageBoost` stat-stage
  consumer's `tags.length === 1` guard refused it for carrying two ACCURACY tags. Instrument:
  `engine/all_mechanics_fire.js`, ability row `hustle`, board verdict STATE (`906/960` against
  `879/960`), control arm NO-DIVERGENCE — and the row is gone from the artifact at release
  `f9ff2b031d93`. **0 pool games**, which was said before the run. Probe: `ability/damageBoost` —
  *"Hustle spends its 1.5x Attack — and neither control is paid twice"*.
- *`guts.damageBoost.onlyWhen` is `null` where the handler is `if (pokemon.status)`.* ENGINE, **OPEN**,
  derivation gap in `tag_dex.js`. Guts is served by a named line and is therefore correct today; the
  tag is not, and a future consumer reading it would apply 1.5x to a healthy body.
- *Sand Force's `onType` keeps the first of three types, and no consumer serves its shape anyway.*
  ENGINE, **OPEN**. `tag_dex.js:7567` single-match regex; `dmgRange`'s two base-power branches both
  require `!onType && !inWeather`. Instrument: `engine/all_mechanics_fire.js`, ability row `sandforce`,
  board verdict STATE, Bulldoze `702/960` against `718/960`.
- *The hand-list entry "a Sitrus Berry is eaten and then not gone" is a misdiagnosis.* ENGINE, **OPEN**,
  re-scoped. It is Harvest's coin (`randomChance(1,2)`), plus a wrong line shape — the authority writes
  `|-item|…|[from] ability: Harvest` and this engine writes `|-activate|…|item: sitrusberry`.
- *`--games` is a pair budget, not a game count, and the standing 961-game baseline was run at
  `--games 1200`.* ENGINE, **OPEN**, instrument ergonomics. Running the after-arm at `--games 961`
  produces a 777-game sample and a board-material figure that is not comparable to anything. Nothing is
  wrong with the instrument; the artifact's own `games` field is what invites the mistake.

---

## OWED, NOT RUN

- **`tests/run-all.js`** in full — not run. The ENGINE instruments were run individually and are listed
  above.
- **`engine/selftest.js`** — RED at HEAD and RED now, same clause (*"every raw reader of the ladder
  store declares why"*, 10 files including `medicham2-browser.js`). Not this batch's, and not filed as
  a "known failure": it belongs to whoever owns the ladder-store declarations and is named here out
  loud.
- **`engine/conformance.js`** — RED at HEAD, almost all MEASURE/SEARCH artifacts. Not touched.
- **`engine/feature_fixture.js --check`** — FAILS before and after: the fixture itself changed
  (scenarios 10 → 12) and the damage table was regenerated (318 → 322 species). **That is the REFIT
  question and belongs to MEASURE. Its verdict must be settled before anybody restamps** — a restamp
  silences the table gate and writes over the evidence.
- **`tests/interaction_matrix.js`** — last run 2026-08-11.
- **`tests/mutation_harness.js`** — still needs `--gate-only --no-write` wiring.
- **the RESIDUAL sort** — still `Array.prototype.sort` in `residualOrder`. Untouched per the brief.
- **the four judgement cards** in `docs/_reports/2026-08-24-ordering-cards.md`, which are Will's, and
  the **Tailwind pair** they cover.
- **`shellsidearm`**, the third named in-game damage row — not examined.
- **`engine/replay_one.js` could not resolve the pinned seeds** at `--games 961` and was not re-tried at
  `--games 1200`. Three of the ten remaining rows (Disable, the switch order in a Magic Room, the
  `vol.charging` game) were reasoned about from the artifact rather than from a replayed game, and none
  of them was fixed on that reasoning.
