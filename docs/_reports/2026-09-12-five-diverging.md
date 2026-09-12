# The five diverging mechanics — 2026-09-12

Task: the mechanics clause of the MEDICHAM gate read *"5 diverge, 1 are declared, 4 are below the
reach shelf and 0 were cleared on decision impact"*. Those four below the shelf are real
disagreements with the authority that do not gate only because nobody in the sampled pool plays them
often enough. Will's standing position is that the obscure tail is deprioritised, not dropped.

Everything below is measured. Where a fact about the game is stated, the line it was read on is
cited, and where it could be staged in the official simulator it was staged before anything was
written.

---

## 0. The five, derived

Read out of `data/all-mechanics-fire.json` (release `48ac1c228e02`, generated
`2026-09-12T08:33:25Z`) by walking `rows.{moves,abilities,items}` for `diverged: true` and skipping
the rows the owner shelved — the same order `classifyMechanics` in `engine/quarantine.js` applies.

| # | row | reach | `divergence.cause` | whose? |
|---|---|---|---|---|
| 1 | `move:gastroacid` | 11 clicks / 64,846 games | `extra event emitted by medicham2 :: \|move\|p2a\|agility <> \|-start\|p2a\|gastroacid` | MEDICHAM — **open**, see §5 |
| 2 | `move:reflecttype` | 11 clicks / 64,846 | `medicham2 stopped emitting while showdown continued :: \|-start\|p1a\|typechange\|water` | MEDICHAM — **fixed**, §3 |
| 3 | `move:corrosivegas` | 1 click / 64,846 | `ordering :: \|-activate\|p2b\|protect <> \|-enditem\|p2a\|sitrusberry` | MEDICHAM — **fixed**, §2 |
| 4 | `move:healbell` | 0 clicks / 64,846 | `event missing from medicham2 :: \|-activate\|p1a\|healbell <> \|upkeep` | MEDICHAM — **fixed**, §1 |
| 5 | `ability:supremeoverlord` | — | `event missing from medicham2 :: \|-end\|p1a\|fallenundefined` | DECLARED — re-read and **still live**, §4 |

**None of the five was the instrument.** That question was asked first of each, because five
instrument defects and one engine defect were found in the last five passes. Every one of the four
reproduces as a difference in what the two engines DO or SAY on a board both agree about, and three
of them were re-staged directly in the official simulator with hand-built teams before a line of
engine code was touched.

`healbell` was the only MOVE row in the whole artifact whose board verdict is `STATE` rather than
`ANNOUNCEMENT-ONLY`.

---

## 1. Heal Bell — the one that parted a board

### What was measured

`data/all-mechanics-fire.json`, row `moves.healbell`, rung `ally-statused`:

```
showdown   |move|p1a: Chimecho|Heal Bell|p1a: Chimecho
           |-activate|p1a: Chimecho|move: Heal Bell
           |-curestatus|p1b: Venusaur|slp|[msg]
medicham   |move|p1a: Chimecho|healbell|p1a: Chimecho
           (nothing)

board      p1 venusaur  party.status           showdown ""   we "slp"
           p1 venusaur  party.status_counter   showdown 0    we 2
```

The click reached `moveAction`'s terminal `{kind:'pass'}`. `MEDFAILS.unmodelledClickBy.healbell`
read 7 on a single-row probe run. medicham2-browser.js's own comment at that terminal names Heal
Bell as declared residue, so this was a known, written-down hole with no probe on it.

### The authority

`data/moves.ts` `healbell.onHit`, lines 8252–8270 at the pinned checkout. Champions overrides
`moves.ts` and `data/mods/champions/moves.ts` was grepped for the id and holds none, so the mainline
handler IS this format's handler.

```js
onHit(target, source) {
  this.add('-activate', source, 'move: Heal Bell');
  let success = false;
  const allies = [...target.side.pokemon, ...target.side.allySide?.pokemon || []];
  for (const ally of allies) {
    if (ally !== source && !this.suppressingAbility(ally)) {
      if (ally.hasAbility('soundproof')) { this.add('-immune', ally, '[from] ability: Soundproof');   continue; }
      if (ally.hasAbility('goodasgold')) { this.add('-immune', ally, '[from] ability: Good as Gold'); continue; }
    }
    if (ally.cureStatus()) success = true;
  }
  return success;
}
```

### Four facts, three of which reading the handler alone gets WRONG

Staged in the official simulator with hand-built legal teams before anything was edited
(scratch script, seven configurations):

1. **The announcement survives failure.** `|move|p1a: Chimecho|Heal Bell||[still]` /
   `|-activate|p1a: Chimecho|move: Heal Bell` / `|-fail|p1a: Chimecho`. The `-activate` is above
   `success` in the handler, so a Heal Bell that cures nobody still says it rang.
2. **A benched body is named `p1: Blastoise`, not `p1a:`.** `Pokemon#toString` adds the slot letter
   only for an active body. Observed: `|-curestatus|p1: Bastiodon|par|[msg]`.
3. **A BENCHED Soundproof ally IS cured.** `hasAbility` ends in `return !this.ignoringAbility()`
   (sim/pokemon.ts:1957-1963) and `ignoringAbility` opens
   `if (this.battle.gen >= 5 && !this.isActive) return true;` (sim/pokemon.ts:865) — so the ability
   gate is an ACTIVE-body gate. Staged both ways: Bastiodon-Soundproof on the bench takes
   `|-curestatus|p1: Bastiodon|par|[msg]`; the same body ACTIVE keeps its paralysis and takes
   `|-immune|p1b: Bastiodon|[from] ability: Soundproof`. **An engine that refused both would be
   running a strictly better Soundproof than the real one.**
4. **A fainted body is not cured** and does not raise `success` — `cureStatus`'s own opening
   `if (!this.hp || !this.status) return false;`.

### The tag

`curesPartyStatus`, derived in `engine/tag_dex.js` from the handler's own text: the party walk, the
`cureStatus` call, the announcement string verbatim, and the two refusing abilities with their
`-immune` lines.

**Membership printed over the whole legal move list before it was wired** — exactly ONE match:

```
healbell {"scope":"party","reachesAllySide":true,
          "announce":{"event":"-activate","on":"user","desc":"move: Heal Bell"},
          "refusedByAbility":[{"ability":"soundproof","event":"-immune","desc":"[from] ability: Soundproof"},
                              {"ability":"goodasgold","event":"-immune","desc":"[from] ability: Good as Gold"}],
          "exemptsUserFromRefusal":true,"failsIfNothingCured":true}
MEMBERS 1
--- every legal move whose onHit mentions cureStatus/clearStatus:
     healbell  allyTeam  MATCHED
     worryseed normal    not matched
```

`worryseed` is the near miss and is correctly refused: it cures one body it was handed after
rewriting an ability, and walks no party. `data/tags.json` regenerated — **exactly one tag-list
change across all moves, abilities and items**, and it is `healbell`.

### What is NOT modelled, named rather than silent

Soundproof's `onAllyTryHitSide` writes a SECOND, EARLIER `-immune` for any sound move aimed at its
own side. Staged: it fires even for the USER's own Soundproof (Kommo-o), and the move then resolves
normally anyway. That is an ability-side narration line for every sound move rather than a Heal Bell
fact; the branch says so in as many words and nothing fakes it.

### The probe

`tests/probe_heal_bell_party.js` — 16 checks, **all 16 red before the fix**, all green after,
**14 red under `MEDI_PARTY_CURE_UNMODELLED=1`** (the two that stay green under the knob are the two
arms explicitly written to tolerate it).

---

## 2. Corrosive Gas — every refusal before any effect

### What was measured

```
showdown   |move|p1a: Garbodor|Corrosive Gas|p2a: Feraligatr|[spread] p2a
           |-activate|p1b: Venusaur|move: Protect
           |-activate|p2b: Charizard|move: Protect
           |-enditem|p2a: Feraligatr|Sitrus Berry|[from] move: Corrosive Gas|[of] p1a: Garbodor
medicham   |-activate|p1b: venusaur|move: Protect
           |-enditem|p2a: feraligatr|sitrusberry|[from] move: corrosivegas|[of] p1a: garbodor
           |-activate|p2b: charizard|move: Protect
```

Same board on both engines — same berry off the same body, same two Protects holding. Only the ORDER
differs.

### The authority

`BattleActions#trySpreadMoveHit`, sim/battle-actions.ts:553-610:

```js
for (const step of moveSteps) {
  const hitResults = step.call(this, targets, pokemon, move);
  if (!hitResults) continue;
  targets = targets.filter((val, i) => hitResults[i] || hitResults[i] === 0);
  ...
}
```

**Every step takes the WHOLE target array.** Step 1 is `hitStepTryHitEvent` (Protect and the ability
refusals); step 7 is `hitStepMoveHitLoop`, where every effect happens. The authority structurally
cannot write an effect line before a refusal line on the same click. The Champions mod overrides only
`hitStepMoveHitLoop` (data/mods/champions/scripts.ts:428) — the driver above is untouched, which was
checked rather than assumed.

### The fix

The `trickitem` branch ran one pass PER TARGET. It is now a gauntlet pass over every target followed
by an effect pass over the survivors — the authority's own structure.

**A stated gap rather than a silent one:** the authority runs each gauntlet STAGE over all targets
before the next stage begins; this runs the whole gauntlet per target inside pass one. The two differ
only when two targets are refused by DIFFERENT stages on one click, which no fixture in this
repository stages. Splitting further would mean assigning each of the four readers to a step by
argument rather than by measurement.

### The probe

`tests/probe_spread_item_order.js` — 8 checks, green, **2 red under
`MEDI_SPREAD_ITEM_INTERLEAVED=1`**. It carries a regression arm (a single-target Trick still swaps
both items) and a counter arm.

**A counter that could not fire was caught here.** The first version counted "pass two reached with
more than one survivor" and read **ZERO on the very fixture the fix was written for** — the Corrosive
Gas board has two refusals and ONE survivor. Replaced by
`spreadItemGauntletRefused` / `spreadItemEffects`, which read `2 / 2`.

---

## 3. Reflect Type — the bottom-screen broadcast

### What was measured

```
showdown   |move|p1a: Gengar|Reflect Type|p2a: Feraligatr
           |-start|p1a: Gengar|typechange|[from] move: Reflect Type|[of] p2a: Feraligatr
           ... |upkeep
           |-start|p1a: Gengar|typechange|Water|[silent]     <- this line
           |turn|2
medicham   (identical through |upkeep, then nothing)
```

### The authority

`Battle#nextTurn`, sim/battle.ts:1709-1721 — after the upkeep and before `|turn|N`:

```js
if (this.gen >= 7 && !pokemon.terastallized) {
  const seenPokemon = pokemon.illusion || pokemon;
  const realTypeString = seenPokemon.getTypes(true).join('/');
  if (realTypeString !== seenPokemon.apparentType) {
    this.add('-start', pokemon, 'typechange', realTypeString, '[silent]');
    seenPokemon.apparentType = realTypeString;
    if (pokemon.addedType) this.add('-start', pokemon, 'typeadd', pokemon.addedType, '[silent]');
  }
}
```

**Why it almost never fires, and why that is the whole mechanic.** `Pokemon#setType` ends in
`this.apparentType = this.types.join('/')` (sim/pokemon.ts:2131), so an ordinary type write — Soak,
Conversion, Camouflage, Protean, a forme change — leaves the two IN STEP and this line cannot fire.
Exactly one legal handler pulls them apart on purpose:

```js
reflecttype.onHit (data/moves.ts:14887-14904):
  const oldApparentType = source.apparentType;   ...   source.setType(newBaseTypes);
  source.knownType = target.isAlly(source) && target.knownType;
  if (!source.knownType) source.apparentType = oldApparentType;
```

It is a hidden-information mechanism: Reflect Type at a FOE does not tell the room what the user
turned into, and the broadcast leaks it on the owner's own screen at the next boundary. At an ALLY,
`knownType` stays true, nothing is held back, and no line follows.

### The fix

`_apparentTypes` is null on a body whose apparent typing is in step (which is every body, almost
always) and holds a STRING only while a handler is holding one back. **Nineteen `.types=` write sites
did not have to be threaded**, because a site that holds nothing back cannot make this fire — that is
the authority's own arrangement, not a shortcut. The sweep at the foot of `battleTurn` is general.

**One placement error, caught by measurement.** The sweep first sat above `TR.turn(S.turn+1)`, which
reads identically inside a long game and emits NOTHING on the last turn of a script. The roster's
Reflect Type fixture is a ONE-TURN script and Showdown still writes the line, because the authority
always advances. The row went on diverging with the fix in; moving the sweep to the foot of the turn
closed it.

### The probe

`tests/probe_apparent_type_broadcast.js` — 12 checks, green, **4 red under
`MEDI_APPARENT_TYPE_BLIND=1`**. Its negative arms are the ALLY aim (silent) and Soak at a
Dragon/Ground body (silent) — the two ways an over-firing sweep would add lines to Conversion,
Camouflage, Protean and every forme change. The Soak arm was originally aimed at Feraligatr, which is
already Water, and would have passed while measuring nothing; it is aimed at Garchomp now and says so.

---

## 4. The declared row — Supreme Overlord, re-read

The declaration in `engine/quarantine.js` reads:

> THE AUTHORITY IS WRONG AND THE LINE IS INVISIBLE. `data/abilities.ts` guards supremeoverlord's
> onStart on `pokemon.side.totalFainted` and does NOT guard its onEnd, so when nothing has fainted
> `effectState.fallen` is never set and the template emits the literal string `fallenundefined` on a
> `[silent]` line players never see.

**Re-read against the source, and it stands verbatim.** `data/abilities.ts:4722-4746`:

```js
onStart(pokemon) {
  if (pokemon.side.totalFainted) { ... this.effectState.fallen = fallen; }
},
onEnd(pokemon) {
  this.add('-end', pokemon, `fallen${this.effectState.fallen}`, '[silent]');
},
```

`data/mods/champions/abilities.ts` was grepped for `supremeoverlord` and holds no match, so mainline
IS this format. The guard asymmetry is real and `fallen${undefined}` is the literal consequence.

**It still covers a live cause.** The mechanics clause prints it as covering 1 diverged row
(`abilities:supremeoverlord`), and the whole-game clause prints it as `0 whole-game games this run,
and LOAD-BEARING IN THE MECHANICS CLAUSE`. It is NOT withdrawn.

**And medicham2 is deliberately the more correct engine here.** It emits `-end|fallenN|[silent]`
guarded on `_fn > 0` (medicham2-browser.js, `fallenClosedOnSwitchOut`), which is exactly the guard the
authority is missing. Reproducing a typo is not correctness.

---

## 5. Gastro Acid — open, with a measured reason

### What was measured

```
showdown   |move|p1a: Arbok|Gastro Acid|p2a: Feraligatr
           |-endability|p2a: Feraligatr
medicham   |move|p1a: Arbok|gastroacid|p2a: Feraligatr
           |-start|p2a: Feraligatr|move: gastroacid
```

The authority's `gastroacid.condition.onStart` (data/moves.ts:6446-6456) is a GUARDED, multi-statement
handler:

```js
onStart(pokemon) {
  if (pokemon.hasItem('Ability Shield')) return false;
  this.add('-endability', pokemon);
  this.singleEvent('End', pokemon.getAbility(), pokemon.abilityState, pokemon, pokemon, 'gastroacid');
},
```

`volatileAnnounce` in `engine/tag_dex.js` refuses guarded multi-statement handlers, so the volatile
falls to the caller's generic `'move: ' + vol` label. That gap is already named in
medicham2-browser.js's own `volAnnounce` header ("Widening `volatileAnnounce` to read guarded
handlers is the bigger job and is still owed").

### Why it was NOT fixed, and why emitting the line alone would be worse

`data/protocol-events.json` declares `-endability` not emitted, with the reason *"ability SUPPRESSION
(Gastro Acid, Neutralizing Gas) is not modelled"*. **That reason is still true**, checked rather than
assumed: nothing in medicham2-browser.js reads `_vol.gastroacid`, and the volatile is inert.

Emitting `-endability` without suppressing anything would make the narration agree while the state
does not. And the obvious shortcut — clearing `m.ability` — **would create a board-material
divergence**: `engine/board_state.js` compares `ability` on active bodies (`ability: id(m.ability ||
'')`, and `POST_FAINT` includes it), while the authority keeps `pokemon.ability` set and only makes
`ignoringAbility()` answer true. Clearing the slot would part the board against an authority that
does not.

The correct shape is `ignoringAbility()` — a gate on every ability read. **Measured: 164 sites in
medicham2-browser.js call `TAGS.param('ability', ...)` / `TAGS.has('ability', ...)`, plus 14 direct
`.ability ===` comparisons.** That is its own batch and it is registered rather than attempted here.

Reach: **11 clicks in 64,846 stored games**, below the moves shelf of 25.

---

## 6. What landed, and what is owed

### Landed

| file | what |
|---|---|
| `engine/tag_dex.js` | new derived tag `curesPartyStatus` (1 member, membership printed) |
| `data/tags.json` | regenerated — one tag-list change, `healbell` |
| `engine/medicham2-browser.js` | the `partycure` action kind and branch; the item branch's gauntlet/effect split; the turn-boundary apparent-type broadcast and its hold-back; a bench arm on `ident()` |
| `tests/probe_heal_bell_party.js` | new, 16 arms |
| `tests/probe_spread_item_order.js` | new, 8 arms |
| `tests/probe_apparent_type_broadcast.js` | new, 12 arms |
| `tests/test-mechanics.js` | three new census rows, each red under its own knob |

Three knobs, each stamping a `MEDFAILS.*Restored`: `MEDI_PARTY_CURE_UNMODELLED`,
`MEDI_SPREAD_ITEM_INTERLEAVED`, `MEDI_APPARENT_TYPE_BLIND`.

`ident()` gained a bench arm in the same pass, because Heal Bell is the first line this engine has
ever emitted naming a body off the field. `MEDFAILS.traceBodyOffField` is unchanged in meaning and
keeps counting the case the party lookup cannot resolve; `MEDSEEN.traceBodyOnBench` is the new
companion.

### Measured after

- `all_mechanics_fire.js --kind all --release 8ad1ab5e1f86 --write`: **moves diverged 1, abilities 1,
  items 0** (from 4 / 1 / 0). The three fixed rows read `NO-DIVERGENCE`. `moves STATE` is **3 → 2**
  (`axekick`, `clearsmog` — both pre-existing silent-state rows). 4,702 games played, 0 threw.
- Whole-game differential re-run on the new release, `--steering empirical --arm middle --end-state
  --games 1200 --turns 50 --team-store data/team-pool-frozen`: **board-material 0 of 961**,
  `games_board_never_diverged` 961, not void, driver code unchanged across the run —
  `data/game-differential.json`. Narration: **zero undeclared across 961**.
  **The census regeneration below does NOT make this incomparable with the previous run**: this arm's
  steering is `empirical-click/v1` and the artifact's own `steering.census_role` reads
  *"CREDITED ONLY — it measures coverage and does not select"*, so the census does not choose which
  games are played.
- Roster, re-run on the new release with `--reds --write`: items **148 / 0 differ / 0 did-not-fire**,
  abilities **190 / 0 / 0** (5 deferred, 5 could-not-stage), moves **492 / 0 / 0** (3 deferred,
  2 could-not-stage). Unmoved, as controls.
- `tests/test-engine-diff.js --n 6000 --seed 20260804`: **0 of 6000 at the midpoint, at both corners
  and at all fourteen interior indices**.
- `tests/test-protocol-trace.js`: ALL PASSED (both derivation gates).
- `tests/test-engine-consistency.js`: all checks passed.
- Census: **886 probed / 886 live / 0 missing**, up from 883 — `data/mechanics-census.json`,
  regenerated. While the other run was live it was measured under a deliberate break so the artifact
  could not be written, and read `885 live / 1 missing / 886 probed` with only the covet knob's own
  row missing. Each of the three new rows goes MISSING under its own knob and only its own.

### Release

**`8ad1ab5e1f86`** — cut with reason *"Heal Bell cures the party, a spread item click says its
refusals first, and the turn-boundary real-type broadcast exists"*. 27 files frozen. It is
`data/releases/8ad1ab5e1f86/` and `data/releases/` is gitignored, so it needs a force-add.

### The order of the runs, and the one instruction that shaped it

A 12,000-game whole-game differential was running in another process when this session started
(pid 24620, `--release 48ac1c228e02 --census data/mechanics-census.json --team-store
data/team-pool-frozen --games 12000 --turns 50`). The brief forbade rewriting
`data/game-differential.json`, `data/mechanics-census.json`, `data/all-mechanics-fire.json` and the
team pool **while it runs**. **None of the four was written while it was live**, and for a while two
gate clauses were WITHHELD rather than captioned as a result.

It finished at 08:36 local — `data/verification/game-differential-10k-middle.json`, 1.6 MB, **7,178
games, not void, release `48ac1c228e02`**. That artifact was not touched, and nothing in it is
interpreted here; it is the other run's to read. Once the process was gone, the three artifacts were
regenerated in order and the gate re-opened.

Verified along the way and worth recording: `engine/all_mechanics_fire.js --kind all --write` does
NOT touch `data/game-differential.json` — `game_differential.js`'s publish guard sits behind
`require.main === module` and its own comment names this exact caller. It was still left alone until
the other process was gone, because the instruction named the file rather than the hazard.

**The census regeneration does not break comparability on the whole-game arm.** That arm's steering
is `empirical-click/v1` and the artifact's own `steering.census_role` says *"CREDITED ONLY — it
measures coverage and does not select"*, so the 883 → 886 move cannot change which games play.

### Gate, run at the end of the session

```
  GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld
    PASS  game differential              clean at BOTH corners of the damage roll: midpoint 0 of 6000, top 0/6000, bottom 0/6000, ...
    PASS  deliberate roster / items      clean: 148 of 148 tested
    PASS  deliberate roster / abilities  clean: 190 of 200 tested
    PASS  deliberate roster / moves      clean: 492 of 497 tested
    PASS  coverage / every used mechanic is measured by something clean: all 412 moves above 25 clicks are measured by the roster or the census
    PASS  whole-game differential / BOARD-MATERIAL — games whose boards part BOARD-MATERIAL: 0 of 961 games.
    PASS  whole-game differential / NARRATION — protocol divergence with no board effect NARRATION-ONLY: ZERO undeclared across 961 games
    PASS  mechanics / each one staged and compared against showdown every mechanic anybody plays agrees with the authority: 2 diverge, 1 are declared, 1 are below the reach shelf and 0 were cleared on decision impact, leaving 0. [moves 1, abilities 1, items 0; 21 never fired — a harness gap, not counted here; 5 shelved by the owner — still staged and played, not counted]
    PASS  no open, known engine defect   clean: no open row names an instrument that is RED
```

**The mechanics clause moved 5 diverge / 1 declared / 4 below the shelf → 2 diverge / 1 declared /
1 below the shelf.** The one left below the shelf is Gastro Acid.

**The pin guard compares each artifact against the LIVE TREE's digest, not against
`data/engine-release.json`.** So the gate closed the instant the first engine byte moved and would
have done so whether or not a release was cut. Cutting is what let the re-runs be named.

### One red test that is not mine, and I could not fix it

`tests/test-docs-current.js` exits 1 on two ratchet clauses, and **both were already red when this
session started.** The four new entries are the figure `487` in `docs/ABRA-deck-plain-english.md`,
`docs/ABRA-technical-docs.md`, `docs/MODELS.md` and `docs/SUMMARY.md` — the roster's move stage, which
moved 487 → 492 in the PREVIOUS pass (CHANGELOG 6.43.0). Receipts: the baseline
(`data/docs-currency-baseline.json`) is stamped `2026-09-12T10:25:28Z` with
`changelog_top_at_baseline: 6.42.0`, and `data/roster.moves.prev.json` — the artifact as it stood
BEFORE this session's re-run — already read 492. Those four documents are **HELD by an unreleased
7.0.0** and this session was instructed not to touch them or their PDFs, so it is reported rather
than filed: it is red, it is named, and the fix is a document pass somebody else owns.

### Two loose files

- `C:\Users\willj\AppData\Local\Temp\claude\C--Users-willj-Projects-Pokemon-ABRA\4af1c0ef-5c10-47e8-8fca-e2cf974fece1_stage.js`
  — a one-line placeholder written to a mistyped path by this session, outside the repo. Reported,
  not deleted.
- The scratchpad staging scripts (`stage_healbell.js`, `stage_reflecttype.js`,
  `derive_partycure.js`) are in this session's scratchpad and are the receipts for §1 and §3.
