# The menu halves of Gravity, Belch and Stuff Cheeks

**Date.** 2026-09-24. **Division.** ENGINE. **Line.** abra/regmc 0.100.0, 0.100.1, 0.100.2, one per source (the coordinator renumbers at merge).
**Status.** A findings record. It is historical and is never cited as current state.

**Branch.** `menu-halves-gravity-belch-cheeks`, based on `disabled-choice-struggle` (`7542e5ab`). One commit per source.
Nothing is merged or pushed.

## Verdict

- **Gravity: fixed, both regulations.** Its menu half was missing, and so was its execution half (found by the same
  probe). Both are wired through the single menu reader, `moveDisabledBy`, and the rewrite built in 0.99.0 now reaches a
  body that Gravity empties.
- **Belch and Stuff Cheeks: no menu half exists in this format, in either regulation.** The Champions mod deletes both
  handlers (`onDisableMove: undefined, // no inherit`). The move stays on the menu and fails at `onTry`, which the engine
  already did. The 0.99.0 report and the engine's own #152 comment listed them as missing. That was wrong. §3.
- **No board moved.** The pinned differential at `--games 45` is byte-identical per game, base against final, in both
  regulations. The API legality probe agrees on 5,552 of 5,552 slots.

## 1. Scope: legal and reachable

Legality was derived with `Dex.forFormat` and the format's own `TeamValidator` (`checkCanLearn`), over species filtered
by `exists && !isNonstandard && tier !== 'Illegal'`. Mega formes count separately.

| | Reg M-B learners | Reg M-C learners |
|---|---|---|
| Gravity | 31 (Clefable, Starmie, Espeon, Forretress, Gardevoir, Sableye, Medicham, Chimecho, Metagross, Glaceon, Reuniclus, Golurk, Meowstic, Malamar, Oranguru, Hatterene, Wyrdeer, Garganacl, Farigiraf, and megas) | 33 (adds Wigglytuff, Indeedee) |
| Belch | 16 | 19 (adds Swalot, Toxtricity, Toxtricity-Low-Key) |
| Stuff Cheeks | 3 (Simisage, Simisear, Simipour) | 4 (adds Swalot) |

Gravity is a field condition. Any legal user can set it, and it reaches every active body on both sides, the setter's
own included. The flagged set, read from the resolved format, is the same in both regulations: Bounce, Fly, Flying
Press, High Jump Kick and Magnet Rise.

The complete list of `onDisableMove` / `onFoeDisableMove` sources that a legal entity can reach (11 in each regulation):
Disable, Encore, Fake Out, First Impression, Gravity, Imprison, Taunt, Throat Chop, Torment, the Choice lock, and Gorilla
Tactics. Gorilla Tactics has **0 legal carriers** in either regulation. With Gravity wired, each of the other ten is in
`moveDisabledBy` or in the lock logic. Heal Block is not in this list: its move is `Past`, and the condition is reached
through Psychic Noise, which 0.98.0 wired.

Commands (all read the checkout, nothing typed):

```
node <scratch>/legal.js <checkout> <format>        # learners, via TeamValidator.checkCanLearn over legal species
node <scratch>/hooks.js <checkout> <format>        # the resolved format's handlers for belch / stuffcheeks / gravity
node <scratch>/disablers.js <checkout> <format>    # every onDisableMove / onFoeDisableMove source a legal entity reaches
```

The probe re-derives the parts that matter on every run. It prints the flagged set, whether each handler is present in
the resolved format, and (for Belch and Stuff Cheeks) whether mainline has the handler that the format deletes.

## 2. Gravity

### The authority's rule, read whole

`gravity.condition` in `data/moves.ts`. It has no Champions row, and it is identical in both checkouts:

- `onDisableMove(pokemon)`: for each move slot, if `this.dex.moves.get(moveSlot.id).flags['gravity']`,
  `pokemon.disableMove(moveSlot.id)`. This is a visible disable, so a named flagged move is refused at
  `Side#chooseMove`, and a body left with nothing reaches Struggle.
- `onBeforeMovePriority: 6` and `onBeforeMove(pokemon, target, move)`: if the flag is set and the move is not a Z-move,
  `this.add('cant', pokemon, 'move: Gravity', move); return false;`. This applies to a move chosen before Gravity
  landed in the same turn. `runMove` deducts PP after BeforeMove, so the refusal spends none.
- `onModifyMove` carries the same refusal for a called move. That door is not wired and not probed (§5).

### What the engine did (base engine, releases `ecaa79e28f15` Reg M-B / `4c0296817626` Reg M-C)

The fixture is derived: the setter is the fastest legal Gravity user, and the victim is the slowest carrier of a
non-charge flagged move, a self-target preferred. In both regulations that is Starmie and Steelix, with Magnet Rise.

| arm | authority | MEDICHAM before |
|---|---|---|
| Struggle scenario: the victim carries only Magnet Rise. Turn 1: Starmie sets Gravity. At boundary 1 the victim is handed Magnet Rise | `getMoves()` empty. The request shows Struggle. The named click is refused; `move 1` is accepted as Struggle | menu `magnetrise`. The handed click was **played** |
| two slots: Dragon Dance + Magnet Rise | menu `dragondance` | menu `dragondance,magnetrise` |
| same turn: the victim clicks Magnet Rise while Gravity lands first | `|cant|p1a: Steelix|move: Gravity|Magnet Rise` | `|move|p1a: Steelix|magnetrise|...` (the volatile went up, and PP was spent) |

### The fix

- **The table.** `engine/tag_dex.js` `groundsField` adds `menuSeals: {flag, moves, refusesChosen}`. The flag is read out
  of the condition's `onDisableMove`, the set is every legal move that carries it, and `refusesChosen` records whether
  `onBeforeMove` writes a `cant`. A full regeneration cannot run in an isolated worktree: without the store, 12 tags
  match nothing and 7,042 lines move. So the one parameter was written into the Gravity row of `data/tags.json` and
  `data/tags-regmc.json` by the identical expression, run against each regulation's own checkout. The rest of both files
  is byte-identical. `data/abra-tags.js` was rebuilt with `build/build_tags_js.js`. **Owed:** a `tag_dex.js`
  regeneration in main should reproduce the row byte for byte. If it does not, the row is wrong.
- **One reader.** `gravitySealsMove(me, id)` reads the table by tag shape (the row whose `pseudoWeather` is a field key
  that is up) through `fieldOfBody`, the same back-reference `isGrounded` uses. A field that is up with no derived set is
  counted in `MEDFAILS.gravityNoSealSet`.
- **Menu half.** A clause in `moveDisabledBy` returns `'gravity'`. Counter `MEDSEEN.gravityRefusedAtSelection`, knob
  `MEDI_GRAVITY_MENU_OPEN`. Struggle then follows from `mustStruggle` and the 0.99.0 rewrite, with no new code.
- **Execution half.** Beside Heal Block's refusal in the BeforeMove block (the same priority, 6). It emits
  `cant(m, 'move: Gravity', move)`, spends no PP and does not set `_lastMove`. Counter `MEDSEEN.gravityRefusedMove`,
  knob `MEDI_GRAVITY_CHOSEN_PLAYED`. The effect string comes from the row's own `announceOnCancel.desc`, which is derived
  from the move's name.

## 3. Belch and Stuff Cheeks: no menu half in this format

### The rule, read whole

Mainline, `data/moves.ts` (present in both checkouts; the probe reads it from each):

- `belch.onDisableMove(pokemon) { if (!pokemon.ateBerry) pokemon.disableMove('belch'); }` and
  `onTry(source) { return source.ateBerry; }`.
- `stuffcheeks.onDisableMove(pokemon) { if (!pokemon.getItem().isBerry) pokemon.disableMove('stuffcheeks'); }` and
  `onTry(source) { return source.getItem().isBerry; }`.

`data/mods/champions/moves.ts`, in both checkouts: `belch: { inherit: true, onDisableMove: undefined, // no inherit }`
and the same for `stuffcheeks`. In the resolved format (`Dex.forFormat(...).moves.get(id)`), `onDisableMove` is
`undefined` and `onTry` is a function, in both regulations. So the format **offers** the click and refuses it at use:
`|move|<body>|<Move>||[still]` then `|-fail|<body>`. Neither move is a menu source, so neither can empty a menu, and the
Struggle rewrite has nothing to do for either.

### What the engine does

It already does this. It keeps both moves on the menu (`moveDisabledBy` has no clause for either). The Belch gate
(ROADMAP #514, `failsWithoutUserLatch`) and the Stuff Cheeks gate (ROADMAP #308, `berryRequiredAbsent`) refuse at use
with the authority's lines. Census rows cover both refusals with controls: `move/failsWithoutUserLatch` "Belch is
refused until its user has actually eaten a berry" and `move/forcesBerryEat` "Stuff Cheeks eats the user's berry, and
FAILS with no berry to eat".

The 0.99.0 report and the engine's #152 comment listed both menu halves as missing. That was wrong. The engine comments
are corrected. The Belch gate's comment also claimed that `gatesSelection` would "re-arm the menu with no edit here" if a
regulation restored the handler. Nothing reads `gatesSelection`, so it would not. It is `false` in both regulations
today, so nothing is wrong now. A regulation that restores either handler owes a `moveDisabledBy` clause.

### The guard

`tests/probe_disabled_choice_struggle.js --part berry`. For each move it prints whether mainline has the handler and
whether the resolved format has it, and it **fails** if the format has it, because that would be open work and not a
guard. It then stages a legal carrier holding no item (Belch: Garbodor into Alakazam; Stuff Cheeks: Simipour into
Aegislash, the same fixture in both regulations). At boundary 0 it asserts:

- the authority's `getMoves()` keeps the move, and a named click is accepted as itself;
- MEDICHAM's menu agrees;
- MEDICHAM plays the handed move with no `cant`;
- the authority **failed** the click on turn 1 (a `|-fail|` line), so the fixture reaches `onTry`;
- the two streams agree for the whole staged game.

It is green in both regulations, before and after, because there is nothing to fix. **There is no red arm, and none is
claimed.** The instrument's ability to see a menu difference is shown by the Gravity arms in the same file: the same
`menuAgree` comparison goes red under `MEDI_GRAVITY_MENU_OPEN`.

## 4. Measurements

**Probe** `tests/probe_disabled_choice_struggle.js`. It cuts its own release into the throwaway store.

| | Reg M-B | Reg M-C |
|---|---|---|
| base engine | RED, 6 assertions (release `ecaa79e28f15`) | RED, 6 (release `4c0296817626`) |
| Gravity commit | GREEN, 79 checks (release `4b492bbea02f`) | GREEN, 79 checks (release `bf89d956f5b6`) |
| final tree (+ the berry arms, + comments) | GREEN, 89 checks (release `ec9ae9436155`) | GREEN, 89 checks (release `44adf7e1e687`) |

Of the six base reds, four are about the defect: the Struggle scenario's menu, its executed move, the two-slot menu, and
the same-turn stream. The other two are knob stamps, which the base engine cannot carry. Controls: every source's
boundary-0 control plays the handed move as itself in both engines. The same-turn arm is stream-level, so it can see a
difference: its knob parts the streams on exactly the refused line. The shared `MEDI_DISABLED_CLICK_PLAYED` arm brings
the defect back on 9 of 9 sources, Gravity included (`cant move: Gravity magnetrise`).

**Census** (`tests/test-mechanics.js`, verification only; the census files are not committed, as in 0.99.0):

| | base (0.99.0 report) | final | both Gravity knobs set |
|---|---|---|---|
| Reg M-B | 1,012 / 1,012 | **1,014 / 1,014** | 1,012 / 1,014 (the two new rows MISSING) |
| Reg M-C | 1,016 / 1,016 | **1,018 / 1,018** | — |

Threw 0, hollow 0, direct-call 1 (unchanged). Measured on the Gravity engine before the commit gate made the seal-table counters declared `MEDFAILS`
keys (`x++` on a declared 0 instead of `(x|0)+1`); nothing else in the engine moved after it except comments.

**Pinned differential** (`--games 45 --steering empirical --arm middle --state`, `MEDI_SAMPLE_DUMP` fingerprints,
`--live` throwaway releases):

| | pins | games | per-game rows differing, base vs final | board-material, base / final |
|---|---|---|---|---|
| Reg M-B | census `data/verification/census-pin-c3affea174af.json`, pool main's `data/team-pool-frozen` | 43 | **0** | 0 / 0 |
| Reg M-C | census `data/verification/census-pin-regmc-f3b70bc0c47c.json`, pool main's `data/team-pool-frozen-regmc` | 38 | **0** | 0 / 0 |

The dumps differ only in `generated` and `engine_release`. Measured first on the Gravity commit's releases
(`4b492bbea02f` / `bf89d956f5b6`), then re-run on the final tree (`ec9ae9436155` / `44adf7e1e687`), whose engine
differs only in comments and the declared `MEDFAILS` keys: again 0 rows differing, board-material 0.

**API legality probe** (`tests/probe_medicham_api_differential.js --part all`, Reg M-C, the same pins, `--games 45`,
final `bf89d956f5b6` against base `4c0296817626`): `legalActions` agrees on **5,552 of 5,552** slots (1,388 turns). The
per-game fingerprint is byte-identical base against final, and through `stepInPlace` and the clone shadow (1,442 of
1,442 shadow turns agree). The red arms are still red: clone-drop 31 of 1,336, mega-always 4,888. **The probe exits 1 on
one line**: `artifact identical outside the run stamps -- DIFFERS at declared_gaps.tags_release_matches_live`. That field
compares the release's tag file to the live one. The base release carries the pre-change `data/tags-regmc.json`, so it
reads false there and true on the final release. It is a provenance stamp and not a game outcome, and the per-game
fingerprints above are identical.

**Also green on the final tree:** `probe_move_menu_legality` (both regulations), `probe_imprison_seal` (Reg M-B; the
probe pins the Reg M-B checkout), `test-tag-wire` (104 checks), `test-board-browser` (58 of 58 features).

**Red, and not this change:** `tests/test-engine-release.js` cannot open `data/releases/89ac57f1f81b` in this worktree:
the pointer names a release the worktree's store does not hold.

## 5. Open, and handed on

- **Gravity's `onModifyMove` door.** A called move that carries the flag is refused by the authority through
  `onModifyMove`. It is not wired and not probed here.
- **`status.js --write`** was not run: from a worktree it writes missing untracked files as fact. It is owed to the
  coordinator, in main, after merge.
- **The `tag_dex.js` regeneration in main** (§2), both regulations: it should reproduce the Gravity row byte for byte.

## 6. Commands

```
node tests/probe_disabled_choice_struggle.js --regulation regmb   [--part imprison|sources|gravity]
node tests/probe_disabled_choice_struggle.js --regulation regmc
node -r ./tests/_live_release.js engine/game_differential.js --regulation <reg> --release <id> --games 45 \
  --steering empirical --arm middle --state --census data/verification/census-pin-<pin>.json \
  --team-store <main>/data/team-pool-frozen[-regmc]
tests/probe_medicham_api_differential.js --regulation regmc --release <final> --baseline-release <base> --part all \
  --games 45 --team-store <main>/data/team-pool-frozen-regmc --census data/verification/census-pin-regmc-f3b70bc0c47c.json
  (with tests/_live_release.js preloaded in every child through NODE_OPTIONS)
```

Heavy runs could not use `tools\lownode.cmd`, because the isolated worktree refuses `cmd.exe`. They were spawned from a
node wrapper that set BELOW_NORMAL on the child by its pid, which is the same policy.
