# The held-out draw's `stall` and flinch partings — 2026-09-19, ENGINE (isolated worktree, LIGHT MODE)

This is a findings record, not a living document. It is not current state and is not cited as such.
`node engine/status.js` and `node engine/quarantine.js` hold current state. No lattice run, no full
battery and no `quarantine.js` was run in this pass, so **nothing here is a claim about the gate**.

Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a5226e629156de271`.
No git command that writes was run. `CHANGELOG.md`, `docs/RUNNING-NOTES.md` and `engine/quarantine.js`
were not edited and `status.js --write` was not run.

---

## 0. VERDICT

- **Two mechanisms fixed, both derived from the authority and cited to file:line, both with a restore
  knob stamped at LOAD, both with a probe that is RED under the knob.**
- **Five of the eight board partings in my share close**, each proven red-before / green-after on the
  named game at the named pins:
  - `stall` — §4 row 4 (`omit-weather` t14) and the corner game `…bo3-2662099996`, which three corner
    samples each drew. §4 row 1 is a different mechanism (a switch desync; its `stall` leaf is
    downstream) and does NOT close.
  - flinch — §4 rows 7, 18 and 31. Row 26 does NOT close; it is the SUBSTITUTE family (§5).
- **Census 970 → 972 live, 0 missing, `run_ok: true`.** It never went down. Two rows are NEW and two
  existing rows **pinned the defect** and were corrected in the same pass rather than left to fail.
- **Release: `6536e903efe2`** (27 files, `0 of 27 files have moved since` at the end of the pass).

## 1. PINS — every replay in this report shares them

| pin | value |
|---|---|
| release | `6536e903efe2`, cut in this worktree. The three intermediate cuts of the same work are `8b4bad8dd80d` (stall fix), `c5aa1f1cebdc` (self-drop address) and the BEFORE release `18773c22878f`, which this worktree's tree reproduced byte-identically before any edit |
| BEFORE release | **`18773c22878f`** — the release `docs/_reports/2026-09-19-final-remeasure.md` measured. Cutting this worktree's unedited tree produced the SAME id, so every "before" reading below is on the artifact's own bytes |
| team store | `--team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen` (the main tree's absolute path; the worktree's copy holds only `FROZEN.md`). Pool digests reproduced exactly: **`e398641bda45`** at `--games 12000` and **`0d103fb9fa87`** at `--games 1200` |
| census | `data/mechanics-census.json`. Digest **`0c1d71e2a1bb`** (970 rows) for every BEFORE reading; **972 rows** after the regeneration. Both probes were re-run on the FINAL release under the FINAL census and are green |
| `--games` | **part of the sample definition, not a budget.** 12000 for §4 rows 4/7/18/26/31 and 1200 for the corner game. Stated on every row |
| arm | `middle` except the corner game, which is `bottom-tie-first` by id |
| flags | `--steering empirical --state --end-state --turns 50` |
| concurrency | every process was mine. The one background run (a census under a knob) REFUSES to write by construction; no artifact was read while another process wrote it |

**Two files were hard-linked into the worktree so the pinned probes could resolve
`data/team-pool-frozen` repo-relatively**: `games.bo3.jsonl` and `games.ots.jsonl`, created with `ln`
(link count 2, zero bytes copied, the originals untouched). **Nothing was deleted.** They are reported,
not cleaned up.

## 2. MECHANISM A — THE `stall` SWEEP IS A WALK, AND IT STOPS

### The authority's rule, read and cited

`stall` (`data/conditions.ts:439-466`; `data/mods/champions/conditions.ts` overrides `par`, `slp` and
`frz` and carries no `stall`) has `duration: 2`, `counterMax: 729` and **no `onResidual`**.

1. It reaches the Residual handler list ONLY because it carries a duration: `fieldEvent` sets
   `getKey = 'duration'` (`sim/battle.ts:486-488`) and `findPokemonEventHandlers` pushes a volatile whose
   `volatileState[getKey]` is truthy even with `callback === undefined`, with `end: pokemon.removeVolatile`
   (`sim/battle.ts:1107-1117`).
2. `resolvePriority` reads `onResidualOrder` off the effect and `stall` has none, so `handler.order = false`
   (`:952`); `comparePriority` maps a falsy order to `4294967296` (`:405`). Every `stall` handler therefore
   sorts BELOW every numbered residual handler, and among themselves they tie on order and priority and are
   separated by the next term — **speed, high to low** (`:407`).
3. Per iteration:
   `handler.state.duration--; if (!handler.state.duration) { handler.end.call(…); if (this.ended) return; continue; }`
   (`:517-525`). **The `continue` is the mechanic**: an EXPIRY skips the `this.faintMessages(); if (this.ended) return;`
   at the foot of the loop body (`:564-566`). A counter that SURVIVES its decrement falls through to it.
4. A handler whose holder is already `fainted` is skipped whole (`:511-513`), and `fainted` is written inside
   `faintMessages` — so a body the perish expiry only ZEROED still holds its handler.

### Measured on the authority before a byte moved

`omit-weather` t14, `…bo3-2655134691 vs …bo3-2655131779`, `--games 12000`, arm `middle`, release
`18773c22878f`. `Battle#fieldEvent` wrapped observationally (delegating, changing nothing):

```
[t14] RESIDUAL open : p1 tinkaton stall=c3/d2 | p1 gengarmega stall=c3/d1 | p2 charizardmegay stall=- FAINTED | p2 sylveon stall=c3/d1   ended=false faintQueue=0
[t14] RESIDUAL close: p1 tinkaton stall=- FAINTED | p1 gengarmega stall=- FAINTED | p2 charizardmegay stall=- FAINTED | p2 sylveon stall=c3/d1   ended=true  faintQueue=0
```

Sylveon's clock is **untouched**. The walk: Gengar (spe 170, `d1`) expires and `continue`s; Tinkaton
(spe 152, `d2` — it Protected that turn) survives its decrement, falls through to `faintMessages`, both
perish-zeroed p1 bodies drain, p1 is wiped, `this.ended` → **return**. Sylveon (spe 105, `d1`) is never
reached.

### The fix

`_stallExpire` in `engine/medicham2-browser.js` was one all-or-nothing pass over `[...actA, ...actB]`
in slot order with no stop. It is now `residualOrder(actA, actB, field)` (this engine's own speed sort,
called rather than copied) with the stop, and a drained corpse is skipped for the STOP decision only
(`m.fainted && !residualZombie(m)`), because upstream it never reaches `:565`.

- Knob: **`MEDI_STALL_SWEEP_UNORDERED=1`**, stamped at LOAD (`MEDFAILS.stallSweepUnorderedRestored`),
  added to `DELIBERATE_BREAK` in `tests/test-mechanics.js`.
- Counter: `MEDSEEN.stallSweepStoppedByWipe`.

### Before / after, on the named games

| game | `--games` | arm | BEFORE `18773c22878f` | AFTER `6536e903efe2` |
|---|---|---|---|---|
| `omit-weather` t14 `…2655134691 vs …2655131779` | 12000 | middle | board parts, `p2.active[1].stall` us 0 / sd 3, **no protocol divergence anywhere**; boundaries 14/15 | **`stateDiv: null`, 15/15** |
| `omit-spread` t11 `…2662099996 vs …2662094820` | 1200 | bottom-tie-first | board parts, `p1.active[0].stall` us 0 / sd **9**; boundaries 11/12 | **`stateDiv: null`, 12/12** |

### Probe

`tests/probe_stall_sweep_order.js` — six arms: the authority's constants re-derived on the run, a
protocol CONTROL per game, the BOARD arm per game, and a per-boundary counter arm over LIVE bodies.
`ALL ARMS PASS`; under `MEDI_STALL_SWEEP_UNORDERED=1` the child exits 1 with **4 FAIL lines**, including
both board arms.

Counters across the two replays: `stallSweepStoppedByWipe +2`, `stallLapsedUnrefreshed +7` (the control:
the sweep still clears on an ordinary turn), `stallExpireAtResidualFoot +25`.

### Census row

`move / stallCounterChecks` — *"a residual that STOPS inside the stall handlers spends the fast body's
clock and not the slow one's"*. Staged single-engine: a Soundproof Kommo-o (spe 100) arms a counter on
turn 3 and clicks Swords Dance on turn 4; a Milotic (spe 200) Protects on turn 4; Primarina's turn-1
Perish Song expires on turn 4 and wipes p2. Arms `{sideWiped: 3, foesLive: 0}`; both arms assert the
counter was really armed, the stopper really shielded, the reader is really ALIVE (a corpse's counter is
a leaf no board compares — `engine/board_state.js:834`), and the wipe really moved. Under the knob the
row reads MISSING and the census **REFUSED to write**.

## 3. MECHANISM B — WHERE A SECONDARY'S DIE IS ADDRESSED

**None of the three flinch games is a flinch rule.** In each, both engines drew the King's Rock 10% from
DIFFERENT address strings, so they read two independent hashed numbers and one came up under 10.

### B1 — a move with a `self:` block

`sim/battle-actions.ts:1093-1101`:

```
// steps 4 and 5 can mess with this.battle.activeTarget, which needs to be preserved for Dancer
const activeTarget = this.battle.activeTarget;
if (moveData.self && !move.selfDropped) this.selfDrops(targets, pokemon, move, moveData, isSecondary);
if (moveData.secondaries)              this.secondaries(targets, pokemon, move, moveData, isSelf);
this.battle.activeTarget = activeTarget;
```

`selfDrops` calls `this.moveHit(source, source, move, moveData.self, …)` (`:1325`/`:1329`), which re-enters
`spreadMoveHit` → `getSpreadDamage`, whose per-target loop writes `this.battle.activeTarget = target`
(`:1154`) with `targets = [source]`. **The restore is BELOW `secondaries`**, so the whole of step 5 is
addressed to the USER.

Measured, `omit-weather` t1, `…bo3-2657252654 vs …bo3-2657249003` — a King's Rock Gholdengo's Make It
Rain (`self: {boosts:{spa:-1}}`) into Lycanroc + Scovillain:

```
showdown  20260813|1|sec|makeitrain|p11|0   20260813|1|sec|makeitrain|p11|1      <- p11 IS THE USER
medicham  20260813|1|sec|makeitrain|p21|0   20260813|1|sec|makeitrain|p21|1      <- last body of the spread
```

The authority's three `random(100)` draws that turn were **95** (the self-drop's own coin, `sdrop` bucket,
still at the LAST TARGET because `moveHit` has not run yet), then **48** and **38** — both at the source.
So the ordering is read off the trace, not inferred.

Fix: `_stepSelfPay` writes `_secAddrSlot = midEventSlot(m)` when `sdrop` is truthy.
Knob **`MEDI_SEC_ADDR_IGNORES_SELFDROP=1`** (stamped at LOAD). Counter `MEDSEEN.secAddrFromSelfDrop`.

### B2 — a body the hit KILLED

`BattleActions#secondaries` (`:1337-1349`) skips exactly one thing — `if (target === false) continue`
(`:1339`) — and a body that fainted to THIS hit is not `false`: it took damage. So the authority draws for
it, and a passing draw calls `moveHit(target, …)` (`:1348`), moving `activeTarget` onto the corpse for
every LATER secondary of the same move.

This engine skipped the draw and its own header said the skip *"cannot reach a board"* because
`addVolatile` bails on a body at zero (`sim/pokemon.ts:1980`). **That is true of the FLINCH and false of
the DIE.** Retracted at the site, in `tests/test-mechanics.js` and in `tests/probe_kingsrock_volley.js`.

Measured, `omit-intimidate` t5, `…bo3-2660280251 vs …bo3-2660473779` — a King's Rock Garchomp's Earthquake
into its own Sneasler, a Raichu and a Kingambit, the first two of which it KILLS:

```
showdown  sec|earthquake|p11|0   sec|earthquake|p20|0   sec|earthquake|p20|1
medicham  sec|earthquake|p11|0                                                  <- two dice never taken
```

The authority's FIRST draw is for the dead Sneasler; it passes, and the address moves to `p20` for the
other two. This engine took the surviving Kingambit's die at `p11|0` — the dead body's address — read a
different number, and flinched a body the authority did not.

Fix: the `tg.fainted` skip is behind **`MEDI_KINGSROCK_SKIPS_DEAD=1`** (stamped at LOAD,
`MEDFAILS.kingsRockSkipsDeadRestored`, in `DELIBERATE_BREAK`). A passing draw on a corpse moves the address
and sets no flinch — counted at `MEDSEEN.kingsRockFlinchRefusedOnCorpse`, kept apart from `flinchTooLate`
(a LIVE body that had already acted, a different refusal for a different reason).

### Before / after, on the named games

| game | `--games` | BEFORE `18773c22878f` | AFTER `6536e903efe2` |
|---|---|---|---|
| `omit-weather` t1 `…2657252654` | 12000 | protocol split at 23 (`|cant|…|flinch` vs `|move|…|overheat|[miss]`), board `p2.pp[1].overheat` 0/1 | **both null**, 10/10 boundaries |
| `omit-intimidate` t5 `…2660280251` | 12000 | protocol split at 85 (`|cant|p1b|flinch` vs `|move|p1b|ironhead`), 5 board leaves part | **both null** |
| `pair-speedctrl` t10 `…2658356295` | 12000 | board parts on 5 leaves | **both null** |

### Probe

`tests/probe_sec_addr_selfdrop.js` — the authority's King's Rock `onModifyMove` re-derived on the run, then
per game an ORDER-SENSITIVE address arm (`sec` draws of the named turn, byte-identical in order — a
set-shaped check would call two engines that spent each other's numbers a match, which is the 2026-08-26
spread-secondary lesson) and an OUTCOME arm over the whole game. `ALL ARMS PASS`; each knob turns exactly
its own half red — `MEDI_SEC_ADDR_IGNORES_SELFDROP=1` → 2 FAIL lines (game A only),
`MEDI_KINGSROCK_SKIPS_DEAD=1` → 4 FAIL lines (games B only).

Counters: `secAddrFromSelfDrop +4`, `kingsRockFlinchRefusedOnCorpse +1`, `kingsRockRolls +11` (control),
`kingsRockRollSkippedOnKO +0`.

### A THIRD DEFECT, FOUND BY THE COORDINATOR'S RE-RUN AND FIXED: A PROBE THAT READ THE WRONG MODULE

`tests/probe_kingsrock_volley.js` went RED on a re-run — `showdown 2, medicham 0 — they disagree` on
volley-2, volley-2to5, single-hit AND the `kill` arm. **It is the instrument, and my own pass exposed it.**

The file read `require('engine/engine_release.js').open().require('engine/medicham2-browser.js')`, and
`open()` with NO id opens `data/engine-release.json`'s `current`. `game_differential.js` opens the release
`--release` NAMES. While I was working, `current` was my own cut and the two coincided, so the file was
GREEN. The moment I restored `data/engine-release.json` to `18773c22878f` (as the brief asks), the two
`require`s returned **different module objects with identical code**: the file read a module that never
played, so every `medicham dice` was 0.

**It fails as an engine accusation, not as an error** — `medicham 0` on the no-item control too. Measured
both ways on the same bytes, same `--release`, same games; the only variable was the pointer. Fixed by
reading `G.REL` — the release `--release` opened — which is the door `tests/probe_stall_uncaused.js` and
both 2026-09-19 probes already use. GREEN with the pointer restored, and RED (1 assertion, the `kill` arm)
under `MEDI_KINGSROCK_SKIPS_DEAD=1`.

`tests/probe_accuracy_stage_combine.js` is the only other caller of that door and had the identical latent
read. It was GREEN either way — which is the point, nothing could have told — and is corrected to `G.REL`
too; still GREEN.

### One trap this probe fell into first, recorded because it is reusable

`G.midAddresses()` returns the authority's log from `MID_CTX_ALL.sd`, which **accumulates across the
process**, and the medicham side from `M.midEventLog()`, whose `MID_LOG` is **cleared at every game
install**. Reading both the same way made game 2 look like `sd 12 draws, me 1` — a fictitious, well-formed
accusation. The two logs have different lifetimes; the probe now slices one and takes the other whole, and
says so at the line.

### Census rows

- **NEW** `item / addsFlinch` — *"a SPREAD takes its King's Rock die on a body the hit KILLED too, not only
  on the survivors"*. One Dazzling Gleam (derived on the run to be `allAdjacentFoes` with no flinch of its
  own) at two foes, rng pinned to 0.5 so every die LOSES. Arms `{KO: 2 dice / 0 skipped, healthy: 2 / 0}`
  with `killed` and `hitBoth` asserted so a fixture that did not stage the KO cannot pass. Under the knob
  the KO arm reads `1 die / 1 skipped` and the row is MISSING.
- **CORRECTED** `item / addsFlinch` — *"King's Rock takes ONE die per LANDED ARRIVAL"*. Its fifth arm
  asserted `killed.rolled === 0 && killed.skipped >= 1`, i.e. it **pinned the defect**. Now `=== 1` and
  `=== 0`. Left unchanged it would have gone MISSING and taken the census DOWN.
- **CORRECTED** `tests/probe_kingsrock_volley.js`'s `kill` arm, same shape: it asserted
  `meRolls === 0 && meSkip >= 1` and now asserts agreement (`meRolls === SD.kr && meSkip === 0`). It was
  RED on the fixed engine before the correction and is GREEN after.

Under `MEDI_KINGSROCK_SKIPS_DEAD=1` both rows read MISSING and the census **REFUSED to write**.

## 4. THE CENSUS

| | before | after |
|---|---|---|
| `data/mechanics-census.json` | 970 live / 970 probed / 0 missing, digest `0c1d71e2a1bb` | **972 live / 972 probed / 0 missing**, `run_ok: true` |

Under each new knob the run prints the row MISSING and then
`REFUSED to write data/mechanics-census.json — the engine is running under a deliberate break`.

## 5. WHAT DID NOT CLOSE, AND WHAT IT IS INSTEAD

**§4 row 26, `pair-redirect-priority` t4, `…bo3-2655714014 vs …bo3-2655713530`, `--games 12000`** still
parts: `|cant|p1a: Orthworm|flinch` against `|move|p1a: Orthworm|Shed Tail`, board `p1.pp[0].shedtail` 1/2.

It is the **SUBSTITUTE family, not the flinch family.** Krookodile stands behind a Shed Tail doll and
Excadrill's Rock Slide hits the doll and Orthworm. Turn-4 addresses on the fixed engine:

```
showdown  crit|p11|0 dmg|p11|0  crit|p10|0 dmg|p10|0   sec|rockslide|p10|0  sec|rockslide|p10|1
medicham  dmg|p10|0  crit|p10|0 dmg|p11|0  crit|p11|0  sec|rockslide|p11|0
```

Two separate things, both of which move the `sec` address:
1. the authority prices the **doll's row first** (step 0 before step 1 — the rule `_subAddr`'s own header
   states for `acc`/`dmg`), so its last-priced body is `p10`; this engine's is `p11`;
2. the authority takes a **secondary die for the doll-absorbed row** and this engine takes none.

That is a lead, not a diagnosis — I did not instrument the authority's `secondaries` call list for this
game. **§4 row 1** (`baseline` t8) likewise does not close: its board shows a whole switch desync
(`p1.active[0].species` us `talonflame` / sd `hatterene`) and its `stall` leaf is downstream of that.

## 6. FILES CHANGED (worktree only)

- `engine/medicham2-browser.js` — `_stallExpire` (walk + stop), `_stepSelfPay` (the address write),
  the King's Rock block (the corpse's die), three knobs, four counters, and three retracted comment
  blocks rewritten in place with the measurement that retracts them.
- `tests/test-mechanics.js` — two new census rows, one corrected census row, two `DELIBERATE_BREAK` entries.
- `tests/probe_stall_sweep_order.js` — **new**.
- `tests/probe_sec_addr_selfdrop.js` — **new**.
- `tests/probe_kingsrock_volley.js` — the `kill` arm corrected, AND the module it reads counters from
  (`ER.open()` -> `G.REL`; see the block in §3).
- `tests/probe_accuracy_stage_combine.js` — the same one-line module read, corrected pre-emptively.
- `tests/roster.js` — one comment clause corrected (it named `kingsRockRollSkippedOnKO`, now a knob counter).
  No fixture changed.
- `docs/ENGINE.md` — one section and its hand list.
- `data/mechanics-census.json` — regenerated (970 → 972).
- `data/releases/{18773c22878f,8b4bad8dd80d,c5aa1f1cebdc,6536e903efe2}/` — cuts. `18773c22878f` gained one
  `cuts.jsonl` event in this worktree (the tree was byte-identical to it before any edit).
- `data/team-pool-frozen/games.{bo3,ots}.jsonl` — **hard links** to the main tree's files, created with `ln`.
  Zero bytes copied, originals untouched, nothing deleted.
- **Not touched:** `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `engine/quarantine.js`, `engine/board.js`,
  `engine/magnemite.js`, `data/engine-data.js`. `status.js --write` was not run. No git write command was run.

## PROPOSED NOTES ROW

```
### <VERSION> — 2026-09-19 — the `stall` sweep stops mid-walk, and a secondary's die is addressed where the authority leaves `activeTarget`

**What changed.** `engine/medicham2-browser.js`: `_stallExpire` walks the `stall` holders in
`residualOrder` (speed, high to low — `sim/battle.ts:405`/`:407`/`:952`) and STOPS at the first counter
that survives its decrement while a side is already wiped, because the authority's expiry branch
`continue`s past `faintMessages` and a surviving one does not (`:517-525`, `:564-566`); `_stepSelfPay`
moves the secondary address onto the USER when the move carries a `self:` block, because `selfDrops`
calls `moveHit(source, source, …)` and the `activeTarget` restore sits below `secondaries`
(`sim/battle-actions.ts:1093-1101`); and the King's Rock die is taken on a body the hit killed, because
`secondaries` skips only `target === false` (`:1339`) and a passing draw re-addresses every later
secondary of the move (`:1348`).

**Figure.** `data/mechanics-census.json` **970 → 972 live / 972 probed / 0 missing**, `run_ok: true`.
Five board partings of the held-out 12,000-game draw close on their named games, each measured
red-before on release `18773c22878f` and green-after on `6536e903efe2`, at `--team-store
data/team-pool-frozen`, `--games` 12000 (pool `e398641bda45`) and 1200 (pool `0d103fb9fa87`), arms
`middle` and `bottom-tie-first`: `omit-weather` t14, `omit-spread` t11, `omit-weather` t1,
`omit-intimidate` t5, `pair-speedctrl` t10. Artifact: `docs/_reports/2026-09-19-heldout-stall-flinch.md`.

**Supersedes.** Two assertions that PINNED the defect, corrected in the same pass: the census row
"King's Rock takes ONE die per LANDED ARRIVAL" asserted `killed.rolled === 0 && killed.skipped >= 1`, and
`tests/probe_kingsrock_volley.js`'s `kill` arm asserted `meRolls === 0 && meSkip >= 1`. Both rested on the
claim that skipping a die on a corpse "cannot reach a board"; that claim is **retracted** — the flinch
cannot, the die can, because it moves the address. No published figure is superseded: no lattice was run
in this pass and no gate number is claimed.

**Basis.** unchanged.

**Owes.** `docs/ENGINE.md` (folded in this pass). The white paper and the technical docs owe nothing
until a lattice is re-run.
```

## OWED, NOT RUN

1. **NO LATTICE, NO BATTERY, NO ROSTER, NO `quarantine.js`.** LIGHT MODE by the brief. The gate's three
   lattices and the held-out 12,000-game draw MUST be re-run on `6536e903efe2` before any board-material
   figure is quoted. **Five games moving is not a rate**, and both fixes change a shared die's address —
   which can move games neither of them was aimed at, in either direction.
2. **THE CENSUS PIN MOVED UNDER THE PROBES.** Both probes were run before the regeneration (970 rows,
   digest `0c1d71e2a1bb`) and again after it (972 rows) and were green both times; that is stated rather
   than assumed. Any re-measurement must pin the census it reads.
3. **§4 row 26 is OPEN and is the SUBSTITUTE family** (§5): the doll's row is priced first upstream and
   takes a secondary die, and this engine does neither. Addresses are in §5; the authority's
   `secondaries` call list for that game was NOT instrumented.
4. **§4 row 1 is OPEN** and is a switch desync, not a `stall` defect.
5. **A CORPSE'S `stall` COUNTER STILL STANDS IN THIS ENGINE.** The authority's `faintMessages` runs
   `clearVolatile(false)`, which takes the volatile with it; medicham2 keeps `tookProtectTurns`. Nothing
   compares that leaf (`engine/board_state.js:834` projects a standing body's counter as `null`, and
   `stall` is in its `POST_FAINT` group), so the probe EXCLUDES corpse readings and COUNTS the exclusion.
   It is declared, not fixed, and not fitted away.
6. **`MEDI_SEC_ADDR_IGNORES_SELFDROP` IS IN `DELIBERATE_BREAK` AND ARGUABLY SHOULD NOT BE.** It is an
   INSTRUMENT knob — `MID_TGT` is read by `midEventDraw` alone — so no census row can observe it, and the
   two older address knobs (`secAddrPerTargetRestored`, `reactAddrPerTargetRestored`) are deliberately
   NOT listed. I listed it anyway, conservatively, and the inconsistency is stated at the line rather than
   quietly resolved. MEASURE's call if it wants one rule.
7. **`kingsRockRolls` IS NOW A DIFFERENT POPULATION.** It counts the corpse's die too. Any figure quoted
   from it before 2026-09-19 is not comparable with one after.
8. **THE HARD LINKS.** `data/team-pool-frozen/games.{bo3,ots}.jsonl` in this worktree share inodes with the
   main tree's files. Nothing in this pass writes to them, but a process that DID would write to both.
   Reported, left in place.
9. **`18773c22878f` GAINED A `cuts.jsonl` EVENT IN THIS WORKTREE** (the unedited tree hashed to the same id).
   The top-level `cut`/`why` are unchanged, which is the design; it is reported because a reader comparing
   `cuts.jsonl` between trees will see it.
