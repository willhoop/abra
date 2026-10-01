# ABRA — Technical Documentation

**Version 1.0.0 · Last updated 2026-09-24**
**Line: abra/regmc** — `CHANGELOG-REGMC.md`.

*Written in ASD-STE100 Simplified Technical English. Sentences are short. The voice is active. One
word has one meaning. The document follows the Diátaxis structure: Tutorial, How-to, Reference,
Explanation.*

**This is the document that you follow to run this system.** It tells you which command to give, which
flag to give with it, and how to read the result. It does not argue for a design. The argument is in
[the white paper](ABRA-whitepaper.md). The record of each change is in
[the Reg M-C changelog](../CHANGELOG-REGMC.md). [The running notes](RUNNING-NOTES.md) are the frozen
record of the changes up to 1.64.0.

**This document does not restate a result.** A result has one home: the white paper, or the artifact
that the white paper cites. This document links to it. *(Changed 2026-10-01. The 1.0.0 edition copied
the gate readings into §0.3; read that edition with `git show a085dd9f:docs/ABRA-technical-docs.md`.)*

**WHAT CHANGED IN 1.0.0.** This document now describes Reg M-C. Reg M-B is retired. Its 7.0.0 edition
of this document is the record for Reg M-B. Read it with `git show bfbf9cf9:docs/ABRA-technical-docs.md`.
The MEDICHAM gate for Reg M-C is OPEN. The work moves to the solver under `solver/`. This edition
removes every Reg M-B procedure and every Reg M-B figure. It does not caption them.

**Words used with one meaning in this document.**

| Word | Meaning |
|---|---|
| **authority** | the official simulator: the checkout `pokemon-showdown-mc` at commit `f10d679` |
| **engine** | MEDICHAM, our simulator: `engine/medicham2-browser.js` |
| **release** | a frozen copy of the engine sources, with an id. A measurement reads a release, not the live tree |
| **lattice** | one whole-game sample. The value of `--games` selects it |
| **gate** | `engine/quarantine.js`. It says if the engine is certified for a regulation |
| **OFFLINE** | measured on recorded human games, with no engine in the path |
| **PRE-GATE** | measured inside the engine before the gate opened. Such a figure is withheld |
| **solver** | every model under `solver/`. MEDICHAM is not part of it |

---

## 0. Status — what this release publishes (abra/regmc 1.0.0)

### 0.1 The gate

Run this command. Read the first line of the output.

```bash
tools\lownode.cmd engine\quarantine.js --regulation regmc
```

The first line says `GATE: OPEN` or names the clause that fails. The result for this release, and the
account of it, are in [the white paper §4](ABRA-whitepaper.md#4-the-foundation-medicham-certified-on-reg-m-c-abraregmc-100).

### 0.2 The pins of this measurement

| Pin | Value |
|---|---|
| release | `eaa5becc54eb` |
| census pin | `data/verification/census-pin-regmc-123aa264f88d.json` |
| team pool | `data/team-pool-frozen-regmc` |
| lattices | `--games 1200`, `--games 1600`, `--games 1900` |
| flags | `--steering empirical --arm middle --end-state` |
| authority | `pokemon-showdown-mc` at `f10d679` |

### 0.3 The readings

Do not copy a reading into this document. Read each one where it lives:

- The readings of the gate, clause by clause: [the white paper §4.2](ABRA-whitepaper.md#42-the-reading).
- Each clause's artifact: §3.4 of this document. The artifact is the source. A document only cites it.
- The readings now, on the tree you have: run the command in §0.1.

### 0.4 The limits of the verdict

- Illusion is the one declared exclusion. Closed team sheets are out of scope.
- No wide held-out draw has run on Reg M-C. Run it first on `eaa5becc54eb` (§2.4).
- The quarantine lists every downstream artifact as RE-RUNNABLE. It is not current. Do not quote a
  downstream figure until you run it again on `eaa5becc54eb` or later.
- The gate certifies the engine. It says nothing about the strength of the solver.

---

## 1. Tutorial — run ABRA for the first time

Do these steps in order.

1. Get the code. Clone the repository `github.com/willhoop/abra`.
2. Get the Reg M-C authority. Clone and build `pokemon-showdown` next to the repository, in a directory
   named `pokemon-showdown-mc`. Check out commit `f10d679`. Do not pull it after that.
3. Select the regulation. Give `--regulation regmc` to a script, or set `ABRA_REGULATION=regmc` for a
   script that refuses unknown flags. The resolver loads `pokemon-showdown-mc` with it.
4. Read the state. Run `node engine/status.js`. Each figure in that output comes from an artifact.
   `NOT DERIVED` means that no artifact states it.
5. Read the open work. Run `node engine/open_work.js`. **Do not type a list of what is open. Print it.**
6. Read the gate. Run `tools\lownode.cmd engine\quarantine.js --regulation regmc`.
7. Run the solver tests. Run `node solver/tests/test-slowking.js`. It must end GREEN.

You now have the state of the project, the gate, and one solver test.

**Run every heavy job through the wrapper.** The wrapper starts the job at BELOWNORMAL priority.

```
tools\lownode.cmd engine\quarantine.js --regulation regmc
```

Do not write `node engine\quarantine.js` for a heavy job. This machine runs many processes at one time.
A job at normal priority starves the window that you type into. The wrapper returns the exit code of the
script. `tests/test-lownode.js` holds that rule. From Node, call the wrapper through `cmd.exe /c`. Do
not use `shell: true`.

---

## 2. How-to — common tasks

### 2.1 Select the regulation

```bash
node <script> --regulation regmc          # this regulation, and its checkout
ABRA_REGULATION=regmc node <script>       # the same, for a script that refuses unknown flags
```

`engine/regulation.js` is the one resolver. An explicit `SHOWDOWN_PATH` wins over it. A deviation from
the default prints on stderr. A regulation that does not resolve REFUSES. It does not fall back.

**Do not use the Reg M-B checkout `pokemon-showdown`.** It is pinned for the Reg M-B record. Do not
pull it, build it or change it.

### 2.2 Cut and use a frozen release

```bash
node engine/engine_release.js cut "why this release exists"
node engine/engine_release.js list                        # each release, and how many files moved since
node engine/engine_release.js verify <id>                 # has the copy itself changed
node engine/engine_release.js compat <file> [symbol ...]  # can this release still serve this caller
```

```js
const REL  = require('./engine_release.js').open();
const MEDI = REL.require('engine/medicham2-browser.js');   // the bytes of the snapshot
artifact = { ...REL.stamp(), ...result };                  // says exactly what was measured
```

- Read the frozen set from `SOURCES` in `engine/engine_release.js`. Do not copy that list into a
  document.
- A second cut over an identical tree appends. It does not overwrite.
- A release freezes the code. It does not freeze the store, the census or the artifacts. Pin all
  three (§2.3).
- **A measurement may not run beside an agent that writes the engine, the weights or the pool,**
  unless the measurement reads a release.

### 2.3 Measure the three Reg M-C lattices

Pin the release, the census and the pool. Change only `--games` and the output path.

```bash
ABRA_REGULATION=regmc tools\lownode.cmd engine\game_differential.js --steering empirical --arm middle \
  --end-state --release <id> --census data/verification/census-pin-regmc-<digest>.json \
  --team-store data/team-pool-frozen-regmc --games 1200 --write --out data/game-differential-regmc.json
# then --games 1600 --out data/game-differential.g1600-regmc.json
# then --games 1900 --out data/game-differential.g1900-regmc.json
```

**Record the flags with the result.** `--games` selects which teams play. Two runs at different values
are two different questions.

**Prove that two samples are the same before you compare them.**

```bash
node engine/arms_comparable.js <before.json> <after.json>
```

### 2.4 Take the held-out draw

The held-out draw is wider than the gate. It uses the same pins. It is not part of the gate. It writes
under `data/verification/`, so a gate run cannot overwrite it. Pick a `--games` value that is not a
lattice value.

```bash
ABRA_REGULATION=regmc tools\lownode.cmd engine\game_differential.js --steering empirical --arm middle \
  --end-state --release <id> --census <pin file> --team-store data/team-pool-frozen-regmc \
  --games <n> --dump-games --write --out data/verification/game-differential-regmc.g<n>.json
```

### 2.5 Read the differential without the four traps

1. **Read the clause, not the field whose name looks correct.** The board-material bar is
   `state.games` less `state.games_board_never_diverged`. `by_cause_totals.games_board_material` is a
   different number.
2. **A capped list is not the population.** `state.first_board_divergences` and
   `state.first_divergences` are truncated. Bucket the `--dump-games` output to count.
3. **The by-cause list keys on the first PROTOCOL divergence.** The bar reads the first BOARD one. Do
   not aim fixes from the wrong list.
4. **Do not read an artifact while another process writes it.** A torn read gives a well-formed false
   answer. Check the modification time. Prefer `git show HEAD:<file>`.

### 2.6 Read the gate and its clauses

```bash
tools\lownode.cmd engine\quarantine.js --regulation regmc               # the gate and each clause
tools\lownode.cmd engine\quarantine.js --regulation regmc --whole-game  # board-material only
tools\lownode.cmd engine\quarantine.js --regulation regmc --narration   # narration only
node engine/quarantine.js --selftest                                    # each branch on synthetic input
```

**The two whole-game commands answer two questions.** `--whole-game` counts games whose boards part.
`--narration` counts games whose protocol parts while the board does not. Quote each with its name.

**A lattice that is missing, stale, not pinned or equal to another lattice gives CANNOT-ANSWER.** It
never gives a pass.

### 2.7 Run the solver tests

Run each test. Each ends GREEN or RED. Each was shown RED on a deliberate break before it was trusted.

```bash
node solver/tests/test-slowking.js
node solver/tests/test-miltank.js
node solver/tests/test-arena.js
node solver/tests/test-playout-speed.js
node solver/tests/test-lean-mode.js
node solver/tests/test-mag-doduo.js
node solver/tests/test-xatu-api.js
node solver/tests/test-prior.js
node solver/tests/test-human-parse.js
node solver/tests/test-meta-lib.js
```

When you run a solver test from a worktree, set `SHOWDOWN_PATH` to the `pokemon-showdown-mc` checkout.

### 2.8 Run an arena shakedown

```bash
tools\lownode.cmd solver\arena\arena.js --x miltank --y prior --games 100 --budget 1000 --workers 4
```

| flag | what it sets |
|---|---|
| `--x`, `--y` | the two bots |
| `--games <n>` | the number of games. Each team pair plays twice, with the seats swapped. It is part of the sample |
| `--budget <ms>` | the time for each decision |
| `--workers <n>` | worker processes that fill cells. `0` fills in-process. It is part of the sample |
| `--k1`, `--k2` | the size of the own and the opponent shortlists |
| `--depth`, `--cap` | the rollout depth and the turn cap |

**WARNING. The arena reads the live engine tree. It does not read a release.** Its output says
PRE-GATE in its first field. **Do not publish an arena win rate.** Before a strength figure can be
published, the arena must read a release at or after `eaa5becc54eb`, with a census pin and the frozen
pool, at equal wall-clock, and an SPRT must read the result.

### 2.9 Use the MEDICHAM API from solver code

```js
const API = require('./engine/medicham_api.js');
const rng = API.makeRng(seed);
const S   = API.newBattle(teamA, teamB, { lean: true, rng });   // lean: for playouts only
const la  = API.legalActions(S, 'A');                          // per-slot options and the joint set
const S2  = API.step(S, jointA, jointB, rng);                  // a new battle; S does not change
if (API.isTerminal(S2)) API.winner(S2);                        // a wipe, not the turn cap
```

- `step` does not change its input. `stepInPlace` changes it. Use `stepInPlace` only on a playout copy.
- `isTerminal` means that a side has nothing left. The turn cap is `atHorizon`. At a cap, read
  `horizonScore`, and count the game as capped.
- A lean battle refuses a trace sink. Use a full battle when you need the protocol.
- The mid-turn choice callback does not exist. A joint action can carry `replaceWith` or `pivotTo`.
  With neither, the engine default applies.
- A release-bound caller loads `REL.require('data/engine-data.js')` and then calls `API.bind`.

### 2.10 Commit a change

Arm the hook one time for each clone: `git config core.hooksPath .githooks`.

For each change, in the same commit:

1. Write ONE entry in `CHANGELOG-REGMC.md`. Increase the version. Give the entry a `### Record`
   section with four lines: `**Measured.**` (the figure and its artifact, or NO FIGURE), `**Basis.**`
   (`unchanged`, or `CHANGED` and what a reader can no longer be told), `**Supersedes.**` (`Nothing`, or
   the struck figure and the word retracted), and `**Owed to the next major.**`.
2. Do not write a row in `docs/RUNNING-NOTES.md`. That page is frozen. To convert a row in the old
   shape, run `node engine/notes_to_changelog.js <file>`. After you merge a branch that wrote a row
   there, run `node engine/notes_to_changelog.js --migrate`.
3. Update the ledger of your division, then run `node engine/status.js --write` from the main checkout.
   Do not run it from a worktree.

**Do not pass `--no-verify`.** If a gate is wrong, correct the gate and say so.

### 2.11 See what the next major release owes

```bash
node engine/docs_scan.js --owed
```

A major release is a change of basis. It is not a way to empty the backlog. Above the cap the build
fails. Fold the record into the documents at any version. The backlog counts the changelog entries
above the freeze and the frozen rows of `docs/RUNNING-NOTES.md` at or below it.

### 2.12 Add a figure to a living document

- Cite the artifact in the same sentence: `data/<name>-regmc.json`. The figure must be in that
  artifact.
- Or name the `CHANGELOG-REGMC.md` version in the paragraph or in a heading above it. That entry must
  carry the figure.
- Or pin a blob: `<commit>:data/<name>.json`.
- **Do not write a PRE-GATE figure.** Do not write a withheld figure with a caption. Delete it.
- Run `node tests/test-docs-current.js`. It must end with 0 failed.

---

## 3. Reference

### 3.1 The solver models

| Model | Job | Code |
|---|---|---|
| MEDICHAM | the simulator and its API | `engine/medicham2-browser.js`, `engine/medicham_api.js` |
| MAG | score each slot's options (the human prior) | `solver/mag/` |
| DODUO | score the pair as one joint action | `solver/mag/` |
| XATU | belief over the back two and the spreads | `solver/xatu/` |
| SLOWKING | solve the matrix game each turn | `solver/slowking/` |
| MILTANK | fill the matrix: candidates, shared dice, clock | `solver/miltank/` |
| GURU | descriptive meta | `solver/meta/` |
| arena | offline bot against bot | `solver/arena/` |
| PORYGON2 | value network | `solver/porygon2/` |
| MEW, MACHAMP | self-play and the training loop | `solver/mew/`, `solver/machamp/` |
| GARY, HYPNO | human habit and the capped exploit dial | `solver/PLAN.md` §2 |
| WOBBUFFET, DUSK | the exploiter and the endgame tables | `solver/PLAN.md` §2 |
| CHOMP | team-preview solver | `solver/chomp/` |
| ROTOM | the live client | `solver/rotom/` |
| ALAKAZAM | the assembled agent | `solver/PLAN.md` §2 |

**The status of a model is not in this table.** The registry in `solver/PLAN.md` §2 says what is built.
`docs/MODELS.md` and the white paper §3 say what each model measured. The plan is `solver/PLAN.md`. The
record of each change is `CHANGELOG-REGMC.md`.

### 3.2 The clock

Source: `pokemon-showdown-mc/config/formats.ts:295-299` (the Reg M-C Bo3 format uses `VGC Timer`) and
`pokemon-showdown-mc/data/rulesets.ts:778-785`:

```
'Timer Starting = 420', 'Timer Grace = 90',
'Timer Add Per Turn = 0', 'Timer Max Per Turn = 55', 'Timer Max First Turn = 90',
'Timeout Auto Choose', 'DC Timer Bank',
```

| Term | Meaning |
|---|---|
| `Timer Starting` | the bank for the game, in seconds |
| `Timer Max Per Turn` | the most time for one request, in seconds |
| `Timer Add Per Turn = 0` | no increment |
| `Timeout Auto Choose` | an expired turn plays a move that the server chooses |
| `DC Timer Bank` | a disconnect draws on the bank |

The client reads the `|inactive|` line on each request. It spends
`min(X − margin, (bank − reserve) / E[remaining requests])`. Read `E[remaining requests]` from the
store. Do not type it. An empty bank forfeits the game.

### 3.3 The format and the account

| Item | Value |
|---|---|
| format | `gen9championsvgc2026regmcbo3` — Force Open Team Sheets, Best of 3 |
| account | `medicham32`, approved by Showdown staff |
| password | `data/.showdown-pass` (ignored by git) or `SHOWDOWN_PASS`. Never on the command line. Never in a log |
| rule | one series at a time; never while one of Will's accounts can ladder the same format |

### 3.4 The Reg M-C gate artifacts

| Artifact | Clause |
|---|---|
| `data/engine-diff-regmc.json` | damage differential |
| `data/roster.items-regmc.json`, `data/roster.abilities-regmc.json`, `data/roster.moves-regmc.json` | deliberate roster |
| `data/game-differential-regmc.json`, `.g1600-regmc.json`, `.g1900-regmc.json` | whole game, three lattices |
| `data/whole-game-baseline-regmc.json` | narration baseline |
| `data/all-mechanics-fire-regmc.json` | staged mechanics |
| `data/mechanics-census-regmc.json` | census |
| `data/register-reality-regmc.json` | open defects |

### 3.5 The version lines

| Line | Changelog | State |
|---|---|---|
| `abra/regmc` | `CHANGELOG-REGMC.md` | open. This document is on it |
| `abra/regmb` | `CHANGELOG.md` | CLOSED at 7.0.0. Do not add an entry |

```bash
node engine/docs_scan.js --lines
```

---

## 4. Explanation

### 4.1 Why the solver searches at each decision

Both players choose at the same time. So the answer to a turn is a mix of actions, not one action. The
solver computes that mix at each decision, inside the engine. A policy that plays without search needs
much more data and self-play than this laptop can supply. The white paper gives the argument in §1.

### 4.2 Why a measurement pins three things

A release freezes the code. The store grows each hour. The census changes which scenarios play. The
artifacts are written again by each run. If one of the three moves, two runs answer two different
questions.

### 4.3 Why board-material is the bar, and narration is a second gate

Commentary may differ. Boards may not. The gate counts games whose boards part. Narration is a second
gate with its own count. A divergence is narration-only only when an instrument measured it as
narration-only.

### 4.4 Why a withheld figure is deleted, not captioned

A figure printed beside a warning gets quoted. This project measured that twice. So a figure from an
engine that was not certified is withheld. The gate opening makes it RE-RUNNABLE. It does not make it
true.

### 4.5 Why a capability that cannot prove it ran is assumed broken

The worst defects in this project had one shape: a capability was absent, and every check reported
success. So each capability emits a counter. A zero is called out. The solver counts its fallbacks, its
unfilled cells and its leaf evaluations for the same reason.

### 4.6 Why facts are global and features are per-model

Each model answers a different question. So each model has its own features. A fact about the game —
damage, turn order, what a sheet declared — has one implementation. XATU prices damage with the
engine's own `dmgRange`. It does not have a copy. Two copies of one fact diverge, and nobody sees it.
