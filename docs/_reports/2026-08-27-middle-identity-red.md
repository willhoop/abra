# `tests/test-middle-identity.js` was red on a file that does the thing it checked for

2026-08-27. ENGINE. Release `6a845424c450` (already cut — no SOURCES file moved, so none was cut for
this). Arm `middle`, 900 games, the file's own default. Register: ROADMAP `#262` — authority half
CLOSED. CHANGELOG 5.170.0.

## VERDICT

**GREEN. Exit 0.** The one failing claim was a regex over `engine/game_differential.js`'s source text
that pinned a variable name the file had renamed. The capability it guards has been present and
working the whole time; the check has been replaced with one that reads the addresses that file
actually builds.

No engine byte moved. Census unmoved at **754 live / 754 probed / 0 missing**. Whole-game **6 of 961**,
board-material **1 of 961**, mechanics **5 of 12** — all unmoved, and all of them read out of
`engine/status.js` after the change rather than assumed.

## THE DEFECT WAS THE CHECK

```js
claim(/MID_BATTLE\s*=\s*this\.battle/.test(GD_SRC),
  'game_differential.js CAPTURES the battle in the BattleActions wrapper', ...)
```

Commit `ae6be2aa` ("The ruler was dead from its second load, and it read as a damage bug") moved the
wrapper's state into a `globalThis`-shared holder, so a second module load could not silently write
its category into a dead copy. `MID_BATTLE` became `MIDW.battle`:

- `engine/game_differential.js:1008` — `MIDW.battle = this.battle || null;` (inside `midWrapShowdown`'s
  `around()`, the wrapper the claim names)
- `engine/game_differential.js:3036` — `MIDW.battle = MID_UNBOUND ? null : battle;` (at prng-install in
  `playGame`, ROADMAP `#220`)

The identifier `MID_BATTLE` survives in that file **only in comments**. The capture never stopped
happening. The grep stopped matching.

**It was walked past twice** and reported as *"pre-existing, not my file, not touched"* — the banned
phrase in ordinary clothes. *"The source doesn't say X"* reads exactly like a real defect, which is why
it survived; and the same run was already printing `acc 99.4% / dmg 99.3% / crit 99.1% / sec 98.1%` two
screens below, which is what a working capture looks like and cannot be produced without one.

**This is the SECOND replacement of this clause, and the first one's stated argument is what failed.**
The 2026-08-13 replacement was made because the clause measured a re-implementation of the wiring
*inside the test* rather than the file, on the reasoning that *"a source check is coarse; a source check
on the actual bytes beats a perfect measurement of a copy."* Right about the copy, wrong about the
check: **a grep is not a check on bytes, it is a check on a NAME**, and a name is the one thing in this
repository nothing keeps in step. Same shape as the fourteen stale handoffs and the ban list of four.

## THE REPLACEMENT READS THE FILE'S OWN OUTPUT

`game_differential.js` already exports it (ROADMAP `#220`): `midAddresses()` returns the strings
`midDraw` pushed on this game, `midResetAddresses()` clears the buffer and the `no_battle` counter. The
test now clears per game — so the set is comparable with `midEventLog()`, which `midEventDice` clears
per call — and asserts two things.

| claim | measured, 900 games, release `6a845424c450` |
|---|---|
| its named-category (`acc`/`sec`/`dmg`/`crit`) addresses name a turn, a move and a target | **0 of 1,922 degenerate**, and `no_battle` = **0** |
| those same addresses clear the pooled floor of 90% | **99.1% over 1,913 events**, against 99.1% from the test's independent `Battle.prototype` hook |

A degenerate address is `<seed>|0|<cat>|-|-|<nth>` (or `undefined` for the turn) — no turn, no move, no
target, only the repeat index moving. That is a global SEQUENCE wearing an address, and it is exactly
the object `#262` replaced the sequence design to be rid of. A capture that is not happening cannot
fake a turn number, so this cannot be satisfied by a copy or by a spelling.

## THE CONTROL COULD FAIL, AND ONE ARM OF IT HAD TO BE MEASURED RATHER THAN ASSUMED

Both captures replaced with `MIDW.battle = null`, run, reverted from a copy taken first:

| | shipped | broken |
|---|---|---|
| named-category addresses degenerate | 0 of 1,922 | **446 of 446** |
| identity from the differential's own log | 99.1% | **0.0%** |
| `midAddresses().no_battle` | 0 | **601** |
| claims red | 0 | **2** |

**Breaking the wrapper line alone does nothing, and establishing that is what made the control valid.**
The install-time binding at `:3036` puts the same `battle` object in the same holder, and
`BattleActions#battle` is that object, so with `:3036` live the wrapper's capture is redundant for the
four named categories. A control aimed only at the line the claim names would have stayed green and
proved nothing. `--mid-unbound` is likewise **not** a control here: it is the before-arm for the `any`
bucket and leaves the named four addressed by the wrapper.

Per-category identity is byte-identical either side of the change — `acc` 99.4 / `dmg` 99.3 / `crit`
99.1 / `sec` 98.1 over 536 / 536 / 532 / 309 events, same release, same 900-game sample — so nothing but
the clause moved.

## SECOND DEFECT, SAME FILE: CONFIRMED, AND NOT TOUCHED

Filed by MEASURE in `docs/_reports/2026-08-27-nth-mixing.md`; re-derived here independently from
`midEventValue` on the release's own engine. **Both assertions are vacuous as described.** Neither was
changed: tightening either moves the gate number, so it belongs in the same commit as the hash decision
ROADMAP `#478` is holding for Will.

**1. `a different REPEAT INDEX is a different address`** asserts `!==` where it means *independence*.

```
nth 0 = 0.3436372398864478   nth 1 = 0.3397308960556984   |delta| = 0.003906
|delta| over 400 turns: median 0.003906, max 0.996094   (uniform pairs would median ~0.333)
```

`0.003906` is exactly `1/256`. FNV-1a's last round is a single multiply with no diffusion after it, so
the trailing index TRANSLATES the value rather than mixing it. The claim passes now and passes after
any conceivable fix.

**What it should assert instead:** a *distributional* claim over many bases — the `nth` to `nth+1` gap
swept across at least 500 real addresses, with a floor on its spread (a translation gives a
near-constant gap; independence gives a mean absolute gap near 1/3). That is the statistic the current
claim is reaching for and the one it cannot see.

**2. `uniform enough to price a 90-accuracy move`** sweeps `'acc|' + i` — the failing axis — and
measures the MARGINAL, which is exactly what a translation preserves.

```
marginal P(v < 0.9) over 'acc|'+i : 0.9214          <- passes, +/- 3 points
runs = 91  against an expected ~901
lag-1 correlation along acc|i     : 0.8873
```

**What it should assert instead:** carry a *serial* statistic beside the marginal — the runs count or
the lag-1 correlation — because a marginal cannot distinguish a uniform die from a ramp. Note also that
the marginal is already 2.14 points off 0.9 against a 3-point tolerance, so it is not comfortably green
either.

Neither belongs to ENGINE tonight, and neither was edited. If tightening them now would go red, that is
precisely why they wait for the same commit as the hash fix.

## OWED, NOT RUN

**Nothing is owed.** No engine byte moved. Recorded explicitly rather than left implicit:

- The census was **not** regenerated and did not need to be — no file under `engine/` changed.
  `node tests/test-mechanics.js` would produce the same 754/754/0 it already reads.
- The three roster stages were **not** re-run, for the same reason:
  `node tests/roster.js --kind items`, `--kind abilities`, `--kind moves`.
- The whole-game differential was **not** re-run:
  `node engine/game_differential.js --games 1200 --arm middle --cap 12 --team-store data/team-pool-frozen --census data/verification/census-pin-9446a684709d.json --state --end-state`.
  The figures quoted above (6 of 961, 1 of 961, 5 of 12) are read out of `node engine/status.js`, which
  was run after the change.
- The 6,000-row damage differential (`node tests/test-engine-diff.js --n 6000`) was **not** re-run and is
  not owed: damage did not move.

The one command that WAS run, and the one that proves this report:

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown  tools\lownode.cmd tests\test-middle-identity.js
```

Exit 0. It was exit 1 at `HEAD` = `69f886bb`.
