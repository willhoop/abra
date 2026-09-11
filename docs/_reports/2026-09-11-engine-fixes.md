# ENGINE — the gaps the planning passes found (2026-09-11)

ENGINE division, one game-playing slot. Two engine batches and one design. Every cause below was a hypothesis until
its probe went red against the current engine; every fix sits behind its own `MEDI_*` knob and was shown red again
under it. Nothing was committed or pushed, per the brief.

## Verdict

| # | item | verdict | probe (red before, green after, knob red) | knob |
|---|---|---|---|---|
| 1 | Simple via Simple Beam | **FIXED** | `tests/probe_simple_beam.js` | `MEDI_SIMPLE_UNAMPLIFIED` |
| 2 | Magnet Rise never ends | **FIXED** | `tests/probe_magnetrise_clock.js` | `MEDI_MAGNETRISE_NO_CLOCK` |
| 3 | a second Psychic Noise restarts Heal Block | **FIXED** (the hypothesis held) | `tests/probe_healblock_clock.js` arm 8 | `MEDI_HEALBLOCK_REFRESH` |
| 4 | Parental Bond ordering | **FIXED**, and it was **board-material**, not only ordering | `tests/probe_bond_secondary_order.js` | `MEDI_BOND_SECONDARY_ONCE` |
| 5 | the three-turn rampage | **FIXED** | `tests/probe_rampage_length.js` | `MEDI_RAMPAGE_TWO_TURNS` |
| 6 | `tag_dex.js` consumer detector | **FIXED** — 18 tags flip to consumed, 0 tags or params move | tags diff (below) | n/a (non-behavioural) |
| 7 | the unprobed in-scope tags | **FIXED** — every in-scope tag now carries a probe; the `refusesCopy` probes found **five moves** that ask no flag, fixed | `tests/probe_ability_flag_refusal.js` + 11 census rows | `MEDI_ABILITY_FLAG_REFUSAL_UNREAD` |
| 8 | gender | **DESIGNED**, not implemented (the fix is half harness) | — | — |

Releases: **`d44869164a40`** (batch A), **`13257c8bc397`** (batch B).
Census **856 → 861 → 872 live**, 0 missing, 0 threw, 0 hollow, 0 unarmed (`data/mechanics-census.json`).
Tag coverage (`engine/coverage.js`): consumer **293 of 295** in scope (the two left are the vestigial
`needsUntrackedState` and `readsOwnItem`), probed **295 of 295** in scope (was 287 of 294).

## Batch A — five engine defects

### 1. Simple via Simple Beam — FIXED

- **Authority.** `simple.onChangeBoost` is `boost[i]! *= 2` (`data/abilities.ts:4274-4281`, no Champions override),
  inside `Battle#boost`, so a raise and a drop are both doubled.
- **Red.** Audino's Simple Beam onto a Snorlax, then Amnesia, then Baby-Doll Eyes: the authority reads SpD +4 and
  Atk −2; medicham2 read +2 and −1. The CONTROL (no beam) agreed.
- **Cause.** Only `applyStatDrop` (Intimidate) doubled; the comment above `invSign` declared the rest. No legal
  species carries Simple, so `data/tags.json` had no Simple row and the engine could not read it by shape.
- **Fix.** `engine/tag_dex.js` admits an ability that `engine/legal_scope.js` `derive().conferred` finds a legal
  MOVE writing (printed: `simple via simplebeam (2 legal learners)`); the tags diff added exactly the Simple row
  (`breakable`, `amplifiesBoosts {mult: 2}`) and moved nothing else. `invSign` now returns the multiplier (−1,
  `amplifiesBoosts.mult`, or 1); all twelve callers already multiply and clamp.
- **Declared remainder.** The boost sites that do not ask `invSign` — a move that boosts an ALLY (Coaching),
  a contact punish (Gooey), a shield punish, item boosts — and a Mold Breaker source. The same holds for
  Contrary; changing those sites changes Contrary too, so it was kept out of this batch. ROADMAP #585.

### 2. Magnet Rise never ends — FIXED

- **Authority.** `magnetrise.condition`: `duration: 5`, `onResidualOrder: 18`, `onEnd` writes `-end … Magnet Rise`.
- **Red.** Steelix rises on turn 1 under an Abomasnow Mud-Slap every turn: the authority ends it at turn 5 and is
  hit on turn 6; medicham2 never ended it and was never hit again. CONTROL (no rise) hit from turn 2 in both.
- **Fix.** A new `expiryClock` reader in `RESIDUAL_CLOCK_READER`; the duration, name and announcement come off
  `data/residual-order.json`'s `expiry:magnetrise` row (5, order 18, `-end`), the tick is a step of the walk at
  order 18, and the foot-of-turn branch ticks it under `MEDI_ENDTURN_CLOCKS_AT_FOOT=1`. `board_state.js` compares
  the leaf as presence, so carrying a count does not part a board. ROADMAP #586.

### 3. A second Psychic Noise — FIXED (the hypothesis was right)

- **Authority.** `Pokemon#addVolatile` sends a volatile the body already carries to `onRestart` and never touches
  `duration` (`sim/pokemon.ts:1987-1990`); Heal Block's `onRestart` returns at once for Psychic Noise.
- **Red, after one probe bug.** The first run AGREED because the derived attacker filler was **Ally Switch**,
  which swapped p1's slots after turn 1 so the authority's turn-2 click came from the wrong body. Fixed the
  filler to a pure self-boost and the FIXTURE line to assert the second click landed. Then: authority `-end`
  turn 2, first heal turn 3; medicham2 `-end` turn 3, first heal turn 4.
- **Fix.** `applyHealBlock` keeps a running clock (`healBlockRestartKept`). ROADMAP #587.

### 4. Parental Bond — FIXED, and it was board-material

- **Authority.** The Champions hit loop (`data/mods/champions/scripts.ts`, loop at :428) runs `spreadMoveHit` once per
  hit; `selfDrops` (:385) and `secondaries` (:388) are inside it, and `selfDrops` marks a move self-dropped only
  when `!move.multihit` — a bonded move IS multi-hit.
- **Red, bottom-tie-first pin.** Body Slam: `-status par` between the hits in the authority, after both here (the
  harness row). **Crunch: `-unboost def` after EACH hit in the authority, once here. Hammer Arm: the user's Speed
  dropped twice in the authority, once here.** The single-hit control (Kangaskhan without the stone) agreed. The
  first cut of the probe counted Showdown's `|split|` owner/spectator copies as two arrivals; fixed.
- **Fix.** `_bondArrivalEffects`: for each interior landed arrival of a bond volley, the `self:` drop and the move's
  own secondaries loop (`_stepEffects(R, {secOnly: true})`) run above that arrival's DamagingHit pass; the last
  arrival keeps the ordinary `_stepSelfPay` → `_stepEffects` pair. King's Rock, the tag blocks and the procedural
  secondaries stay once per move.
- **Pool.** The bottom corner's one lost protocol game is a Kangaskhan Ice Punch whose freeze the authority lands
  between the two hits (`…2657333637`). ROADMAP #588.

### 5. The three-turn rampage — FIXED

- **Authority.** `lockedmove`: `trueDuration = this.random(2, 4)`, `duration: 2` re-armed by `onRestart` while
  `trueDuration >= 2`, `onAfterMove` ends on `duration === 1`, `onEnd` fatigues only if `trueDuration <= 1`.
- **Red, after one probe bug.** The first cut sent `move outrage` bare while locked; the authority refused it
  (`Can't move: Outrage needs a target`). With the target number: forced to 3, the authority locks three turns
  and fatigues on turn 3; medicham2 two and turn 2. The forced-2 CONTROL agreed.
- **Fix.** The length is drawn on a NEW `range` stream (`RNG_STREAMS`) between the tag's `turnsMin` and `turnsMax`,
  the lock carries both counters (`left` = trueDuration, `dur` = duration), restart, at-move and residual ends
  follow the authority. A lock whose length is not a draw (Uproar) is byte-for-byte unchanged.
- **Instrument edit (the only one).** `engine/game_differential.js` hands `range: () => 0` to the corner arms and
  the middle arm — the mirror of the authority's own `random(m, n) → m` pin. Without it the top corner would hand
  medicham2 a three-turn rampage against the authority's two. PIN_DIGEST did not move (de38d17e15a2,
  7759a509491f, 844515f6a72a). ROADMAP #589.

### Batch A measurement — release `d44869164a40`, predicted first in `data/verification/_prediction-2026-09-11-enginefix-A.json`

| instrument | before | predicted | measured |
|---|---|---|---|
| census | 856 live | 861 | **861**, 0 missing (five new rows MISSING together under the five knobs first) |
| `test-engine-diff --n 6000` | 0 | 0 | **0 of 6000** |
| roster items / abilities / moves | 0 DIFFER, 0 DNF | same | **same counts, 0 DIFFER, 0 DNF, 0 dead plants** |
| `all_mechanics_fire` | abilities diverged 2 | 1 | **1** (`parentalbond` → `diverged: false`), moves 4, items 0, 1,522 games, 0 threw, `red_ok` |
| middle arm | 0 of 961 | 0 | **0 of 961**, protocol 1, threw 1 (the same Floette game as HEAD) |
| top-tie-first | 1 of 961 | 1 | **1 of 961**, protocol 13 |
| bottom-tie-first | 2 of 961 | 2 | **2 of 961**, protocol **18 → 17** |
| `engine/quarantine.js` | — | OPEN 9/9 | **OPEN, 9 of 9** |

## Batch B — tags

### 6. The consumer detector — FIXED

`engine/tag_dex.js` `consumedBy` = the probe string (the old rule, so nothing consumed became unconsumed) OR the tag
name as a literal argument of a `TAGS.param/has/withTag/reactorsTo` call in `engine/board.js` or
`engine/medicham2-browser.js`, through MEASURE's `engine/tag_lookups.js` `sourceConsumers` (balanced parentheses).
Printed on the run: **18** tags read by name and not by probe — boostsOnKO, boostsTarget, condStatMult, critDamageUp,
damageMultOnRepeat, firstTurnOnly, formeTypedMove, hitsTwice, ignoresStatStages, lowersUser, modifiesWeight,
preventsStatDrop, preventsSwitch, punishesMinimize, resistBerry, restoresOwnLastItem, statMult, survivesFromFull.
The tags diff moved **0** entity tags or params. `data/abra-tags.js` rebuilt each time.

### 7. The unprobed in-scope tags — FIXED, and the probes found five unread flag halves

New census rows, each with a one-reason control on the same body: `isBerry` (Chople against Leftovers under Stuff
Cheeks), `escapesTrap` (Shed Shell against no item under Shadow Tag), `healFromDamageDealt` (Shell Bell at half HP),
`statMult` (Light Ball, physical and special, and a Raichu species-gate control), `scalesOwnStatusDamage` (Heatproof
against Hospitality), and `refusesCopy` — Trace facing Stance Change, Role Play into Stance Change, Receiver with a
fainted Zero to Hero partner, Skill Swap into Zero to Hero, Simple Beam into Stance Change — and a
`refusedByAbilityFlag` row for Gastro Acid into Disguise. Retagged: three live Shield Dust rows `untagged` →
`refusesSecondaries`, Marvel Scale `untagged` → `condStatMult`. Under `ABRA_TAGS_OFF=1` all 15 new or retagged rows go
MISSING.

**The finding.** The plan had not checked which flags the copy readers consult. Only Trace, Receiver and Role Play
did. Simple Beam, Worry Seed, Entrainment and Gastro Acid read `cantsuppress` in their own `onTryHit`; Skill Swap
reads `failskillswap` inside `Battle#skillSwap` (sim/battle.ts). `tests/probe_ability_flag_refusal.js` put all six
moves into a flagged Aegislash and an Intimidate Arbok: the authority refused the first and allowed the second every
time, and medicham2 disagreed on the flagged arm for **Entrainment, Gastro Acid, Simple Beam, Skill Swap and Worry
Seed** (Role Play agreed — its flags were already read).

**Fix.** A derived move tag, `refusedByAbilityFlag {target, source}`, read off each refusing handler and off any
`Battle` method a handler delegates to (Skill Swap's `onHit` is only `this.skillSwap(source, target)`). Membership
printed before wiring: entrainment {cantsuppress | noentrain}, gastroacid, simplebeam, worryseed {cantsuppress},
roleplay {failroleplay | cantsuppress}, skillswap {failskillswap | failskillswap}. One reader, `abilityFlagRefusal`,
at the `abilitywrite` branch, the Skill Swap branch (below the shield, where `onHit` sits) and first in the status
branch's TryHit step (a move's own `onTryHit` runs ahead of Protect). Under the knob exactly the three refusal census
rows go MISSING. Declared, unreachable with a legal set: Entrainment's `noentrain`, Skill Swap's user side and Role
Play's user `cantsuppress` — no legal learner carries one. ROADMAP #590.

**Found, not fixed.** `move:gastroacid`'s existing `all_mechanics_fire` divergence is a different thing: Gastro
Acid's `onStart` writes `-endability`, and this engine writes `-start … move: gastroacid` because the tag carries no
announce for it. Narration, below the reach shelf. ROADMAP #591.

### Batch B measurement — release `13257c8bc397`, predicted first in `data/verification/_prediction-2026-09-11-enginefix-B.json`

| instrument | before (A) | predicted | measured |
|---|---|---|---|
| census | 861 | 872 | **872**, 0 missing |
| coverage consumer / probed | 275/294, 287/294 | 293/295, 295/295 | **293 of 295, 295 of 295** |
| `test-engine-diff --n 6000` | 0 | 0 | **0 of 6000** |
| roster items / abilities / moves | 0 DIFFER, 0 DNF | same | **same counts, 0 DIFFER, 0 DNF, 0 dead plants** |
| `all_mechanics_fire` | moves 4, abilities 1 | same | **moves 4, abilities 1, items 0**, 1,522 games, 0 threw, `red_ok` |
| middle arm | 0 of 961 | 0 | **0 of 961**, protocol 1, threw 1 |
| top-tie-first | 1 of 961 | 1 | **1 of 961**, protocol 13, threw 1 |
| bottom-tie-first | 2 of 961 | 2 | **2 of 961**, protocol 17, threw 2 |
| `engine/quarantine.js` | OPEN 9/9 | OPEN 9/9 | **OPEN, 9 of 9** |

Every figure landed on the prediction. The pool sat still in both batches, as the prediction said it would before
either run: the lab moved (census, `all_mechanics_fire`, coverage) and the pinned pool did not.

## The gate and the open-defect clause, at the end

- **`engine/quarantine.js` after the register refresh:** GATE OPEN, 9 of 9. The open-defect clause PASSES: "no open
  row names an instrument that is RED", 155 verdicts read, which include the rows this pass added.
- **`engine/register_reality.js`:** #585, #586, #587, #588, #589 and #590 are all CONFIRMED, each closed with its
  probe exiting 0. #591 (narration) and #592 (gender) are open and name no instrument, by design; `engine/open_work.js`
  lists both and reports 0 measured-but-unregistered.
- **Ten rows disagree with their own instrument, and three of them are attributable to this session's tree:**
  - #258 and #409 went CONFIRMED → PREMATURE CLOSE. Their instrument, `tests/test-no-silent-failure.js`, now counts 3
    new silent catch blocks, and all three are in untracked files another agent wrote at 09:36Z today:
    `tests/probe_amf_default_populations.js`, `tests/probe_census_reproduces.js` and
    `tests/probe_divergence_rank_side.js`. None is this pass's; they are reported and not touched.
  - #577 was already PREMATURE CLOSE at HEAD. This pass adds to it: its instrument, `engine/provenance.js`, refuses a
    published figure on a release git does not hold, and both releases cut here are untracked. That is OWED item 1.
  - #370, #402, #424, #444 and #528 read the same as at HEAD, or are new and unrelated to this pass.
- `data/mechanics-census.json` was rewritten at 10:01:14Z by `register_reality.js`, which re-runs
  `node tests/test-mechanics.js` for the 32 rows that name it. It still reads 872 live / 0 missing / `run_ok`.

## Batch C — gender (DESIGNED, not implemented)

**What exists.** The readers: `genderOf` (defaults to `'N'`) feeds Attract's `immunityGate` pair, Rivalry's
multiplier and Cute Charm through `applyAttract`, and the census stages each with declared genders. The gated set in
the regulation, derived over handlers: Attract (move), Rivalry (ability, reads gender directly), Cute Charm (ability,
through the `attract` condition — the direct `.gender` scan could not see it). 54 legal species have a fixed gender and
22 are genderless.

**What is missing is the fact.** `MC.mons` carries no gender and `buildMon` sets none; every harness forces `'N'`.
`engine/game_differential.js` `buildPair` does so on purpose: medicham2's `|switch|` / `detailschange` lines
(`swin`, `detailschange`, `:5308`, `:5320`) write `<name>, L50` with no gender, while the authority's
`getUpdatedDetails` appends `, M` / `, F` (sim/pokemon.ts:541), so a declared gender would part every stream on
line one.

**The sheet has it.** The pinned pool's stored sheets carry `"gender":"M"/"F"` (first 3 MB of
`data/team-pool-frozen/games.bo3.jsonl`: 1,853 F, 2,167 M; `games.ots.jsonl`: 1,915 F, 2,065 M).

**A die hides here.** With no declared gender the authority assigns `this.species.gender ||
this.battle.sample(['M','F'])` at construction (sim/pokemon.ts:340) — a draw before turn 1 that the corner and
middle arms would have to pin or share.

**Landing order.** (1) ENGINE: `buildMon` honours a declared `gender`, and `swin` / `detailschange` append `, M` /
`, F` exactly as `getUpdatedDetails` does — a no-op while harnesses pass `'N'`, so not landed alone (it could not
prove it ran). (2) MEASURE: `buildPair` hands the sheet's gender — else the species' fixed gender, else `'N'` for a
genderless species — to BOTH sides, and states what it does for a sheet with none (the `sample` die). (3) Re-measure:
Attract (1 carrier team in the pool), Cute Charm and Rivalry become reachable in real games. ROADMAP #592.

## Probe bugs, each caught loudly before the engine was touched

1. Heal Block: the derived "self-status filler" was Ally Switch, which moves bodies between slots.
2. Magnet Rise: the attacker filter refused every secondary and every power callback and found nothing.
3. Simple Beam: the ability filter's `/Stat/` matched `curesStatusResidual`; the only buildable learner cannot learn
   the inert move.
4. Rampage: a locked choice in a double still needs a target number.
5. Parental Bond: `secondaries` is filled from `secondary` on every dex move; Showdown's `|split|` doubles HP lines.
6. Census: the Chople row called `berryBoard` above its declaration (temporal dead zone) and was unarmed.
7. The refusal probe's knob claim demanded Role Play go red, but Role Play's refusal was already read elsewhere.

None was quiet: each surfaced as a FIXTURE line, a THREW, or an agreement the fixture could not have produced.

## Files

- **Engine:** `engine/medicham2-browser.js` (both batches), `engine/tag_dex.js` (conferred abilities, the detector,
  `refusedByAbilityFlag`, `battleMethodSrc`), `data/tags.json` + `data/abra-tags.js` (regenerated three times).
- **Instrument, one edit:** `engine/game_differential.js` — the `range` pin in the corner and middle arms.
- **Tests:** `tests/test-mechanics.js` (16 new rows, 4 retags), `tests/probe_healblock_clock.js` (arm 8, a second
  knob, the filler), new `tests/probe_magnetrise_clock.js`, `probe_simple_beam.js`, `probe_rampage_length.js`,
  `probe_bond_secondary_order.js`, `probe_ability_flag_refusal.js`.
- **Predictions:** `data/verification/_prediction-2026-09-11-enginefix-A.json`, `-B.json`.
- **Docs:** `docs/ENGINE.md`, `docs/RUNNING-NOTES.md` (6.11.0, 6.12.0), `CHANGELOG.md` (6.11.0, 6.12.0),
  `docs/ROADMAP.md` (#585–#592).
- Not touched: `engine/all_mechanics_fire.js`, `engine/stage_planner.js`, `tests/test-stage-planner.js`,
  `docs/MODELS.md`, `engine/docs_scan.js`, `tests/test-docs-current.js`, `board.js`, `magnemite.js`,
  `engine-data.js`, and every other agent's uncommitted file. No file was deleted. Scratch work stayed in the
  session scratchpad.
- **Debris seen, not mine, left in place:** `data/verification/_diag41-sample.json`, `_diag46-cards.json`,
  `_diag46-sample.json`, `_diag46b-cards.json`, `_diag46b-sample.json`, `_diag77-cards.json` — `status.js` reports
  them as the files that tripped the provenance unstamped ratchet. Reported, not touched.

## OWED, NOT RUN

1. Track the two releases this pass cut. `data/releases/` is gitignored (`.gitignore:174`) and every tracked release
   was force-added; until these two are, `status.js` withholds the differential line with "PUBLISHED FIGURE ON AN
   UNTRACKED RELEASE" (ROADMAP #577's clause). Then restamp.

```bash
cd C:/Users/willj/Projects/Pokemon/ABRA
git add -f data/releases/d44869164a40 data/releases/13257c8bc397
node engine/status.js --write
```

2. Commit, by name — not done, per the brief. The pass touched: `engine/medicham2-browser.js`, `engine/tag_dex.js`,
   `engine/game_differential.js`, `data/tags.json`, `data/abra-tags.js`, `data/mechanics-census.json`,
   `data/engine-release.json`, `data/engine-diff.json`, `data/roster.items.json`, `data/roster.abilities.json`,
   `data/roster.moves.json` (and their `.prev.json`, `data/roster.json`), `data/all-mechanics-fire.json`,
   `data/game-differential.json`, `data/verification/game-differential-top-tie-first.json`,
   `data/verification/game-differential-bottom-tie-first.json`, the two `_prediction-2026-09-11-enginefix-*.json`,
   the test files and docs listed under Files. Other agents' uncommitted files are theirs.

3. The full mutation sweep on the new consumer detector. Heavy; `--gate-only` returns before `sourceConsumers` runs.

```bash
cmd.exe //c "tools\\lownode.cmd tests\\mutation_harness.js --no-write"
```

4. The docs gate and the owed backlog — MEASURE's files, which another agent was editing during this pass.

```bash
node tests/test-docs-current.js
node engine/docs_scan.js --owed
```

5. Gender (ROADMAP #592), in this order: ENGINE (`buildMon` honours a declared gender; `swin` and `detailschange`
   append `, M` / `, F`), then MEASURE (`buildPair` hands the sheet's gender to both sides and says what it does for a
   sheet with none), then the three arms again.

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/game_differential.js --release <new> --census data/mechanics-census.json --team-store data/team-pool-frozen --games 1200 --turns 50 --steering empirical --end-state --arm middle --write
```

6. Gastro Acid's `-endability` (ROADMAP #591): the announce derivation in `engine/tag_dex.js`, then the announcer.
7. The declared remainders, none staged: Simple and Contrary at the boost sites that do not ask `invSign` and under
   Mold Breaker; a three-turn rampage interrupted on turn 2; Parental Bond with a procedural secondary; Shed Shell's
   `maybeTrapped`.
8. Reproduce the batch B measurement (identical tree, identical release):

```bash
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
PINS="--release 13257c8bc397 --census data/mechanics-census.json --team-store data/team-pool-frozen --games 1200 --turns 50 --steering empirical --end-state"
node tests/test-engine-diff.js --n 6000 --seed 20260804 --write
for s in items abilities moves; do node tests/roster.js --stage $s --reds --write --release 13257c8bc397; done
node engine/all_mechanics_fire.js --kind all --write --release 13257c8bc397 --census data/mechanics-census.json
node engine/game_differential.js $PINS --arm middle --write
node engine/game_differential.js $PINS --arm top-tie-first --out data/verification/game-differential-top-tie-first.json --write
node engine/game_differential.js $PINS --arm bottom-tie-first --out data/verification/game-differential-bottom-tie-first.json --write
node engine/quarantine.js
node engine/register_reality.js
```
