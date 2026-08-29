# Parting Shot's pivot is conditional on the drop landing — ROADMAP #531, landed

2026-08-29, ENGINE. Batch of one. Everything below was derived from the format at run time or read
off a staged board; nothing is recalled.

---

## THE VERDICT

| | |
|---|---|
| legal moves carrying `selfSwitch` | **7** — batonpass, chillyreception, flipturn, partingshot, shedtail, uturn, voltswitch |
| of those, **conditional** | **1** — `partingshot`. `delete move.selfSwitch` occurs ONCE in the whole 954-move dex |
| legal abilities that can refuse a foe's Attack **or** Special Attack drop | **5** — Clear Body, White Smoke, Flower Veil, Mirror Armor, Hyper Cutter |
| of those, enough to CANCEL the pivot | **3** — Clear Body (Metagross, Dragapult, Garganacl), White Smoke (Torkoal), Flower Veil (Floette-Eternal, Florges — a **Grass ALLY** only) |
| the named exception | **1** — Mirror Armor (Corviknight). Refuses both and the pivot stands |
| refuses one stat only, so the pivot **survives** | **1** — Hyper Cutter (Pinsir, Mawile, Gliscor, Crabominable) |
| named by the handler, absent from the format | **Full Metal Body — ZERO legal carriers.** Not staged, not approximated |
| census | **798 → 801 live / 801 probed / 0 missing** |
| empirical board-parted | **93 → 92 of 961** (boards-never-diverged 868 → 869); protocol 208 → 207 |
| the prediction | **MISSED, by one, in the improving direction.** The prior card predicted the pinned pool UNMOVED |

Probe: `tests/probe_partingshot_conditional.js` — **19 arms, 5 red and 14 controls, shown RED first
at 5 defects on the shipping bytes** and clean after. Knob `MEDI_PIVOT_UNCONDITIONAL=1`.

---

## WHAT COUNTS AS `success`, WHICH IS THE WHOLE CRUX

The mod was read first. `data/mods/champions/moves.ts` does not mention `partingshot` (grep: 0 hits),
and the mod's `abilities.ts` and `scripts.ts` touch neither `selfSwitch` nor `onTryBoost` nor
`boost(`. So mainline applies, and `data/moves.ts:13168-13187` is the whole rule:

```js
onHit(target, source, move) {
    const success = this.boost({ atk: -1, spa: -1 }, target, source);
    if (!success && !target.hasAbility('mirrorarmor')) { delete move.selfSwitch; }
},
selfSwitch: true,
```

`Battle#boost`, `sim/battle.ts:2017-2085`, decides `success`. Read at the lines:

| case | `success` | pivot |
|---|---|---|
| a stat's APPLIED delta is non-zero | `true` on the first one | **happens** |
| **partial** — one stat refused, the other lands | `true` | **happens** |
| an ability DELETES every entry (Clear Body / White Smoke / Flower Veil) | stays `null` | cancelled |
| a **reflected** drop (Mirror Armor) — the entry is deleted, not applied | stays `null` | **happens, by the named exception** |
| both stats already at **-6** | stays `null` (the capped delta is 0) | cancelled |
| one refused by an ability AND the other at -6 | stays `null` | cancelled |
| Contrary — the drop INVERTS to +1/+1 | `true` | **happens** |

Two orderings matter and both were read rather than assumed:

- **`getCappedBoost` runs BEFORE `TryBoost`** (`battle.ts:2030-2031`). A stat already at -6 therefore
  arrives at every ability handler as `0`, so no refuser ever sees it as a drop. That is why the
  floor case and the ability case are genuinely separate doors, and why they are staged separately.
- **Mirror Armor skips a stat at the floor** — `if (target.boosts[b] === -6) continue;` — so a
  floored Mirror Armor body reflects nothing, `success` is still falsy, and the exception is what
  keeps the pivot. The engine already agreed on that half (`preventsStatDrop.reflectSkipsAtFloor`).

**And the floor arm for Mirror Armor cannot be staged from a foe's drops at all**, which is a fact
rather than a gap: every drop a foe aims at it bounces, so nothing a foe does can move it toward -6.
Said here rather than left as a missing arm.

---

## THE DERIVATION, WHICH IS WHERE THE CARD WAS NARROW

The prior card named **two** abilities (Clear Body, White Smoke) plus the floor. Enumerating the
format instead — printed on every run of the probe — is wider in one place and narrower in two:

- **Flower Veil is a third refuser** and the card did not have it. It is `onAllyTryBoost`, it covers
  **Grass types only**, and Florges is Fairy, so the holder does not cover ITSELF. It needs a Grass
  ally in the other slot, which is why that arm is `torterra` beside `florges`.
- **Full Metal Body has zero legal carriers.** It is in the handler population and not in this
  regulation. Nothing was wired for it and nothing was staged.
- **Hyper Cutter refuses Attack and the pivot survives it.** A fix keyed on "a stat was refused"
  would have broken a board that is correct today; it is an arm precisely for that.
- **The five Intimidate-gated refusers are inert here.** Inner Focus, Oblivious, Own Tempo, Scrappy
  and Guard Dog all test `effect.name === 'Intimidate'`.

---

## THE FIX — TWO FILES, NOTHING NAMED

**`engine/tag_dex.js`, `pivotStatus`.** The tag carried `{selfSwitch: true}` and nothing else, which
reads as a promise. It now also derives, off the handler text:

```json
"pivotStatus": { "selfSwitch": true, "conditional": true,
                 "cancelsWhen": "noStatChangeLanded", "exceptAbilities": ["mirrorarmor"] }
```

The deletion, the guard variable's ORIGIN (`this.boost(...)`, which is what makes the condition "did
a stage land") and the exempt ability names are all read, never typed. **Over-match measured before
wiring: exactly ONE move row in `data/tags.json` changed** — `partingshot` — and zero ability rows
and zero item rows. The five other status/string pivots keep their params byte for byte.

**The first version of the guard regex was wrong and the loud fallback caught it.** `[^)]*` cannot
cross the bracket inside `!target.hasAbility("mirrorarmor")`, so `cancelsWhen` came back `null` —
which is the derivation failing loudly rather than the engine failing silently. Fixed to
`[^{]{0,200}` with the reason written beside it.

**`engine/medicham2-browser.js`, the `a.kind === 'switch'` branch.** The stat-drop loop now records
the APPLIED delta (`_dropLanded`: `null` = the block never ran, `false` = ran and nothing moved,
`true` = a stage changed), and the pivot is gated on it:

- `_dropLanded === false` and not `!_dropLanded` — a move that never reached the drop keeps exactly
  the behaviour it had, because this gate may only speak about a drop it watched;
- the exception is `_pv.exceptAbilities`, not a name;
- `cancelsWhen !== 'noStatChangeLanded'` is a **loud fallback**: `MEDFAILS.pivotConditionUnreadable`
  and the pre-fix behaviour, because guessing decides which body holds a slot for the rest of a game.

Counters: `MEDSEEN.pivotCancelledNothingLanded`, `MEDSEEN.pivotKeptByExceptAbility`,
`MEDFAILS.pivotUnconditionalRestored`, `MEDFAILS.pivotConditionUnreadable`.

---

## THE PROBE — 19 ARMS, SHOWN RED FIRST

`tests/probe_partingshot_conditional.js`. Both engines play the identical script over a frozen
release; the observable is the BOARD (every leaf `board_state.js` reads, at every boundary) plus
which body is standing in the user's slot. Nothing types an expected outcome — Showdown is the
expectation.

**On the shipping bytes: 5 arms DEFECT, 14 clean.** After the fix: **all 19 clear.**

| arm | body / ability | pre-fix | why it is there |
|---|---|---|---|
| `clearbody` | garganacl / Clear Body | **RED** | both stats refused |
| `sturdy` | garganacl / Sturdy | clean | the SAME body, knob cleared |
| `whitesmoke` | torkoal / White Smoke | **RED** | a second refuser on a different body |
| `shellarmor` | torkoal / Shell Armor | clean | the SAME body, knob cleared |
| `mirror` | corviknight / Mirror Armor | clean | **the named exception — must keep pivoting** |
| `pressure` | corviknight / Pressure | clean | the SAME body, knob cleared |
| `hypercutter` | gliscor / Hyper Cutter | clean | **PARTIAL refusal is a success**; target reads `0/-1` |
| `sandveil` | gliscor / Sand Veil | clean | the SAME body, knob cleared |
| `contrary` | malamar / Contrary | clean | the drop INVERTS; target reads `1/1` |
| `flowerveil` | torterra beside florges / Flower Veil | **RED** | the ally door |
| `symbiosis` | torterra beside florges / Symbiosis | clean | the SAME Florges, knob cleared |
| `chilly` | Chilly Reception into Clear Body | clean | **over-fire control, MOVE axis** |
| `voluntary` | a bare switch into Clear Body | clean | **over-fire control, SWITCH axis** |
| `floorboth` | snorlax, driven to `-6/-6` | **RED** | the floor door, no ability anywhere |
| `flooratk` | snorlax, `-6/0` | clean | partial — SpA still moves |
| `floorspa` | snorlax, `0/-6` | clean | the same on the other stat |
| `floornone` | snorlax, `0/0` | clean | the 5-turn fixture with the driving OFF |
| `floormix` | gliscor / Hyper Cutter, SpA at `-6` | **RED** | **both doors, and neither alone is enough** |
| `floormixctl` | gliscor / Sand Veil, SpA at `-6` | clean | the SAME Gliscor at the SAME `-6`; the outcome flips on the ability alone |

**What each arm asserts, so a pass cannot be a classification:** the script actually ran
(`moveNotOnRequest === 0`, turns played, boundaries taken, non-zero leaves compared); the AUTHORITY
staged the mechanic (a red arm requires the authority to have kept the shooter standing, a control
requires it to have pivoted); the boards agree leaf for leaf; **the knob parts every red and moves no
control**; the cancel counter is EXACTLY 1 on a red and EXACTLY 0 on a control; the exception counter
is EXACTLY 1 on `mirror` and 0 everywhere else; and `pivotConditionUnreadable` is 0 throughout.

`mirror` is the arm that matters most and it agreed BEFORE the fix as well — an engine that pivots
unconditionally agrees with an exception because it agrees with everything. "The boards match" is
therefore not evidence there, which is why it is asserted on the exception BRANCH COUNT instead.

### Two fixture faults, both mine, both found by reading the output

- **The boost reader searched the party by species** and reported `0/0` for a Snorlax the same run
  had just driven to `-6/-6`, because the default partner was also a Snorlax. It reads the standing
  slot now, and the default partner is a Milotic — a duplicate species in a fixture also collides on
  `_switchKey`.
- **No two consecutive Protects anywhere.** The stall counter is a DIE, and a die in a fixture is a
  coin toss dressed as a result. Every filler is a self-boost that cannot fail across the script's
  length (Iron Defense and Amnesia alternated to their caps and no further).

---

## THE CENSUS — 798 → 801, THREE ROWS

All three read the OUTCOME (which body is standing in slot 0 after the turn, plus the target's
atk/spa) and each carries a control that must give the opposite answer:

1. *"Parting Shot does NOT switch the user out when its drop landed on nobody"* — Garganacl with the
   ability blanked (`milotic,corviknight target -1/-1`) against the SAME Garganacl with Clear Body
   (`incineroar,corviknight target 0/0`).
2. *"a target already at the stat floor cancels the pivot too — no ability involved"* — `-6/0`
   (partial, the user leaves) against `-6/-6` (nothing can move, the user stays).
3. *"and it still pivots against the one ability the handler exempts"* — one Corviknight, two
   abilities, opposite answers, **with the target's boosts identical (`0/0`) in both arms**. That is
   the point: the board cannot tell those two apart and the pivot can.

`0 threw`, `0 hollow`, `0 missing`. The census heuristic "detail carries ≥2 numbers and they are all
equal" lists row 3, correctly and unavoidably — the two arms differ in the STANDING BODY and the only
numbers in the detail are the identical `0/0`. Adding a number to satisfy the heuristic would make the
row worse.

---

## THE PINNED POOL — 93 → 92 OF 961, AND THE PREDICTION MISSED

Pins: release **`124f5aa8c8bd`**, pool `0d103fb9fa87`, census `9446a684709d`, `--games 1200` (yields
961), `--turns 12`, `--arm middle`, `--steering empirical`, `--end-state`.

| | before (`eb6a797411cd`) | after (`124f5aa8c8bd`) |
|---|---|---|
| games whose board NEVER diverged | 868 / 961 | **869 / 961** |
| board-parted | **93** | **92** |
| protocol diverged | 208 | 207 |
| turn boundaries identical | 10244 / 10559 | 10251 / 10565 |

**THE PREDICTION WAS "UNMOVED" AND IT MISSED BY ONE.** The prior card said the pinned pool would sit
still because Parting Shot into a boost-refusing ability or a doubly-floored target is rare; the
census/lab was the scoreboard to watch. The lab moved as predicted (798 → 801, five red arms → clean).
The pool moved as well, by one game.

**The one game is attributable by its leaf signature, and the signature names the move.** Every leaf
family that moved fell by exactly one game, and the set of them is the shape of ONE board holding the
wrong body in a slot:

```
active[].species  9g -> 8g     active[].types    8g -> 7g     active[].ability  7g -> 6g
active[].maxhp    8g -> 7g     active[].item    11g -> 10g    active[].hp      53g -> 52g
pp[].partingshot  3g -> 2g     pp[].protect      9g -> 8g     pp[].closecombat  3g -> 2g
pp[].lightscreen  2g -> 1g     pp[].bravebird / roost / fakeout / spiritbreak  1g -> 0g each
```

**`pp[].partingshot` 3 games → 2** is the one that names it: the PP map read the replacement's in a
game where the authority never let the user leave. Nothing rose. `party.hp` (57/51) and
`party.fainted` (10/10) did not move, which is what says this is a slot occupancy change and not a
damage change.

---

## WHAT ELSE CHANGED, AND WHAT DID NOT

- `tests/probe_partingshot_mirrorarmor.js` — its `clearbody` arm's DECLARED divergence is **deleted**,
  in the same pass as the fix. That is the mechanism working: a declared divergence that stops
  happening fails as STALE-ALLOW, so the fix could not land without dealing with the declaration.
- `data/tags.json` regenerated (one move row changed). `data/mechanics-census.json` regenerated.
- **Not touched:** `engine/board.js`, `engine/magnemite.js`, `data/engine-data.js`.
  No fit, no self-play. `data/game-differential.json` untouched (Aug 28 23:14) — the comparison run
  used `--out data/verification/...`.

### Pre-existing reds, inherited and named rather than absorbed

| probe | re-run here | reading |
|---|---|---|
| `probe_shield_refusal_line` | **yes** | 13 arms staged, 1 failing — unchanged |
| `probe_instruct_shield` | **yes** (`--release 124f5aa8c8bd`) | 5 arms staged, 3 failing — unchanged |
| `probe_forced_switch_mirror` | **yes** (nearest family to this change) | ALL CHECKS PASS |
| `probe_random_target_address` | no | not claimed fixed, not claimed unchanged |
| `test-resolution-order` | no | V8 heap exhaustion in the harness, not an engine question |
| `test-engine-diff` | no | not claimed fixed, not claimed unchanged |

None was touched and none is claimed fixed.

**One thing worth naming about the environment:** `engine/tag_dex.js` exhausts the default V8 heap
under `tools/lownode.cmd` (`FATAL ERROR: Reached heap limit`, ~2 GB) and needed
`NODE_OPTIONS=--max-old-space-size=3072`. That is not caused by this change — the added clause runs
on one move — but it is the same class as `test-resolution-order`'s inherited rc 134, and a
generator that dies on a default heap looks exactly like a generator that ran.

---

## OWED, NOT RUN

Stated with the expected value FIRST so a later run can be checked rather than believed.

1. **The roster, moves stage.** Every roster artifact is currently WITHHELD on a release mismatch
   (`e129bca605e3` against the tree), which predates this batch. The `partingshot` row should read
   `FIRED-AND-BOARDS-MATCH`.
   `SHOWDOWN_PATH=... node tests/roster.js --stage moves --write`
2. **The floor + Mirror Armor arm is UNREACHABLE from a foe's drops** and is therefore not owed as
   staged. It is reachable only through a self-lowering damaging move (Overheat / Superpower), which
   is a different fixture carrying damage rolls. Named, not silently missing.
3. **A NARRATION divergence this batch did NOT close, found while reading the handlers.** At the
   floor the authority's `getCappedBoost` zeroes the entry BEFORE `TryBoost`, so Clear Body never
   fires and the authority writes `|-unboost|TARGET|atk|0`; this engine asks `statDropRefusal` before
   the clamp and writes `|-fail|…|[from] ability: Clear Body`. Board-identical either way (both give
   a falsy `success`), so the quarantine bar is unaffected. Not fixed here — one landing.
4. **The `hypercutter` ORDERING cause in the pool is still open and is not this defect.** One game,
   `|-fail|p2a|unboost|attack|[from]hypercutter <> |-unboost|p2a|spa|1` — the refusal line and the
   landing line are emitted in opposite orders. Board-material, one game, and it survives this fix
   (the arm `hypercutter` is board-clean on the staged board, so the pool game is an ordering
   question the staged fixture does not reach).
5. **`node engine/status.js --write`** and the CHANGELOG / living-docs pass belong with this batch and
   are done in it; the five WITHHELD gate clauses are a re-run owed to whoever cuts the next release,
   not to this card.
