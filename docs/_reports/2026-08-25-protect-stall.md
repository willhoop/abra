# Which Protect goes up — the commit-time queue — 2026-08-25 (ENGINE)

**Verdict.** The two engines disagreed about which Protect succeeded because **Showdown's turn queue
contains an entry this engine has no action for.** A mega evolution is queued as its own action at
order 104, in front of the megaing body's move, and `queue.sort()` is a **selection sort** — placing
that entry SWAPS it with whatever stood at the head of the list, throwing a MOVE to a later index. On
a board with a **speed tie at the tail**, that one displacement decides which of the tied bodies acts
last, and the last body's Protect is the one that FAILS (`!!this.queue.willAct()`).

medicham2 sorted an array with no megaEvo entry in it, so its tied pair came out the other way round.

---

## 1. THE QUESTION THE COORDINATOR ASKED FIRST — ONE QUEUE READER OR TWO?

**The `willAct` question has ONE reader, and that is correct.** `_anyActionAfter(idx)` in
`engine/medicham2-browser.js` is `BattleQueue.willAct()` (sim/battle-queue.ts:310) and it is called
from exactly one place, `_shieldGate`, which serves all three families that ask it — the six
`stallingMove` shields, the two side Guards, and Endure.

**`queueWillMove` is NOT a second copy of it.** It is a different function of the authority's —
`BattleQueue.willMove(pokemon)` (sim/battle-queue.ts:319), which Sucker Punch and Upper Hand open on
— and it reads the SAME live `acts` array through the SAME `unresolved` set and the SAME
`sdChoiceOf` mapping. Two readers of one queue, mirroring the authority's own two functions. No
breach.

**The real duplication was one level down, and it is the fourth instance of the pattern.** The
authority's **commit-time queue** was being built twice:

| built by | what it did with it |
|---|---|
| `megaQueueOrder` (added 2026-08-24) | built the queue WITH the megaEvo entries, sorted it, read the MEGA order off it, and **threw the move order away** |
| `sortTurnOrder` | sorted a second list of the same actions **with no megaEvo entry in it**, and that was the MOVE order |

Both are "what order does the authority's queue resolve in". They agreed on every board without a
speed tie and parted on every board with one. They are now **one function**, `commitQueueSort`, which
sorts one list once and returns both answers.

---

## 2. RED FIRST, WITH THE CONTROL CLEARED

`tests/probe_protect_stall.js` (new). Four bodies, all clicking Protect, one of them megaing. Exactly
one shield must be refused — the one that moves last — so `stall` reads 3 on three bodies and 0 on
one, and the whole question is WHICH one. Everything is derived: the mega carrier is the biggest
Speed jump among legal stones whose base forme learns Protect, and the flankers are picked by base
Speed so the resulting battle Speeds land where the arm wants them.

```
ARM 2A   Aerodactyl 182 | Archaludon 127 | Absol 127 | Beedrill 117 -> Beedrill-Mega 187
  SHOWDOWN    |move| Beedrill, Aerodactyl, Archaludon, Absol       -> ABSOL   refused,  stall 0
  MEDICHAM2   |move| Beedrill, Aerodactyl, Absol, Archaludon       -> ARCHALUDON refused, stall 0
  two `active[].stall` leaves part on one turn.

ARM 2B   THE CONTROL — the identical board with the mega stone removed
  SHOWDOWN    and MEDICHAM2 both refuse Beedrill.  IDENTICAL, every leaf.

ARM 1A/1B  the same pair with NO tie (Malamar 125 in place of the tied Absol)
  identical on both engines with the stone and without it.
```

The stone is the knob and the tie is the mechanism: **with the tie broken the two engines agree in
every arrangement**, so the divergence cannot be blamed on the mega, on Protect, or on the speeds.

Re-run after the fix: **all four arms identical, no `STALL DIFFERS`.** Re-run again with
`MEDI_COMMIT_QUEUE_BLIND=1`: **arm 2A red again, arms 1A / 1B / 2B still identical.**

*(Both of these were re-run on the SETTLED `engine/game_differential.js`. My first two probe runs
started at 15:41 fell inside a MEASURE edit window on that file and are discarded.)*

---

## 3. THE MECHANISM, WORKED THROUGH

Showdown's queue after `Side#commitChoices` pushes p1 slot 0, p1 slot 1, p2 slot 0, p2 slot 1, and
`resolveAction` unshifts a body's extra actions in front of its move:

```
[ priorityChargeMove(107),  megaEvo(104),  beforeTurnMove(5),  move(200) ]
```

So the list handed to `queue.sort()` on arm 2A is

```
A=Aerodactyl(182)  B=Archaludon(127)  C=Absol(127)  D=megaEvo(order 104)  E=Beedrill(117)
```

The selection sort places `D` first, which swaps `L[0]` with `L[3]` — **Aerodactyl is thrown to index
3, past the tied pair.** Two further placements leave the tied pair as `[C, B]`. medicham2's list has
no `D`, so no such swap happens and its tied pair stays `[B, C]`. The post-mega re-sort preserves
whatever order it was handed, so the difference survives to the tail and decides who is last.

Three facts that make this narrow rather than general, all read at the line:

- **`beforeTurn`(4) and `residual`(300) are not in the commit-time list at all** — `turnLoop` adds
  them AFTER `commitChoices` — and the residual, when it arrives, is order 300 and therefore placed
  last, so it can never displace a move.
- **The authority never re-sorts while a megaEvo or a priorityChargeMove is at the head** (the gen-8
  re-sort guard passes only when `peek()` is a `move`), so the phantom entries matter at the
  top-of-turn sort and nowhere else. `_resortTail` is left reading pure actions and is unchanged.
- **`beforeTurnMove` has no legal carrier in this regulation.** Its only source is a
  `beforeTurnCallback`, which is Pursuit's, and Pursuit is `isNonstandard: 'Past'` here. Named in the
  code rather than modelled.

---

## 4. WHAT CHANGED IN `engine/medicham2-browser.js`

- **`commitQueueSort(queued, megaCands, chargeCands, field, rng)`** — what `megaQueueOrder` was,
  widened to return `{acts, megas}` off ONE sort. The tie rule is the union of the two rules it
  replaces and consumes **the same dice**: a tied group holds one KIND of entry only (the kinds carry
  different `order` values), so an act group draws act keys exactly as `sortTurnOrder` did and a mega
  group draws record keys exactly as `megaQueueOrder` did. A group of only charge entries draws
  nothing — it is ballast, and drawing for it would spend the tie stream where the authority does not.
- **`sortTurnOrder` now delegates to it** with an empty entry set, so the selection sort exists once.
  Its in-place contract is unchanged and `_resortTail` is untouched.
- **The mega and charge candidate sets are hoisted to the top of the turn**, because the authority
  decides both at `commitChoices` — before any action runs. The mega phase used to re-derive them off
  an `acts` array that had ALREADY been sorted for the moves.
- **`canMegaNow(S, m)`** — `megaEvolveNow`'s own four refusals, lifted so the queue can ask "will this
  body produce a megaEvo action" without doing it. `megaEvolveNow` calls it; there is one rule.
- **`TURN_ORDER.charge = 107`**, and order-107 entries for Focus Punch / Beak Blast. Same entry class,
  same one-line membership off the `preTurnShield` tag.
- **A bare switch is keyed at order 103** inside the queue list rather than move-order-with-priority-6.
  The two spellings answer switch-versus-move identically and differ only against a megaEvo at 104,
  which is an entry that did not exist in this list until today.

### The knob and the counters

`MEDI_COMMIT_QUEUE_BLIND=1` restores the pre-fix shape exactly — the move order sorted over a list
with no megaEvo entry, and the mega order re-derived at the mega phase off its own copy.

New counters, all loud rather than silent:

| counter | says |
|---|---|
| `MEDSEEN.commitQueuePhantomEntries` | how many entries this engine has no action for were placed |
| `MEDSEEN.commitQueuePhantomDisplacedAct` | **the mechanism** — swaps that placed one of those entries by throwing a MOVE later |
| `MEDFAILS.megaPhantomDidNotEvolve` | an entry queued for a body that then did not evolve. Must read 0 |
| `MEDFAILS.queueTieMixedKinds` | a tied group holding two kinds. Must read 0 *by construction* — asked because the tie rule is written on it |
| `MEDFAILS.chargeQueueUnlisted` | `megaQueueUnlisted`'s twin for order 107. Must read 0 |
| `MEDSEEN.megaAskRefused` | a caller asked for a mega Showdown's own request would not have offered |
| `MEDSEEN.megaCandSameSideDropped` | the AUTO policy finding two stone-holders on one side, where the authority offers one |

The last two close a hole the fix opened and then had to close: the authority's queue never holds two
megaEvo entries on one side (Showdown refuses the second choice outright), so a second entry here
would be a phantom that moved the sort for nothing. Under the differential this cannot fire at all —
`autoMega: false`, one explicit ask per side from Showdown's own `canMegaEvo`.

---

## 5. THE CENSUS PROBE — AND IT ASSERTS ON HP, NOT ON THE COUNTER

`tests/test-mechanics.js`, `move / failsIfMovesLast`:
*"a mega's QUEUE ENTRY displaces a tied body, and that decides which Protect holds"*.

That file's own standing rule is that these probes assert on damage and never on
`tookProtectTurns` — *"a probe that reads the counter field proves the bookkeeping, and the
bookkeeping is not what a game plays."* So **the consequence is staged on turn two**: a refused shield
leaves the stall counter unarmed, so the NEXT Protect is a free 100%; a shield that went up leaves it
at 3 and the next one loses the 1/3 roll. The body the mega entry displaces is therefore the body that
**eats the attack**.

```
[mega forme, damage Absol takes on turn 2]
  EXACT TIE at 127/127          beedrill-mega, 0     <- fixed. Absol's turn-1 shield was refused,
                                                        so its turn-2 shield is free and holds.
  tie broken, Absol at 152      beedrill-mega, 81    <- Archaludon is last instead; Absol shielded on
                                                        turn 1 and loses the 1/3 roll on turn 2.
  tie broken, Absol at 100      beedrill-mega, 0
```

**The two controls answer opposite outcomes**, so the board is sensitive. Under
`MEDI_COMMIT_QUEUE_BLIND=1` the tied arm reads **81** and the probe goes MISSING; **both controls are
unchanged by the knob**, so the knob moves the tied arm and nothing else.

---

## 6. THE NUMBERS

**Census.** 704 probed / 704 live / 0 missing → **705 / 705 / 0**. Under the knob: 704 live, **1
missing**, 705 probed.

**Damage differential.** `--n 6000 --seed 20260804`: **0 of 6000, all 16 corners.** Unmoved.
(`data/engine-diff.json`, generated 2026-08-25T20:04:27Z.)

**Whole game.** Arm **`middle`**, `--games 1200` (a PAIR budget) → **961 games**, turn cap 12, release
**`9cfe6b3b97a8`**, `--team-store data/team-pool-frozen`,
`--census data/verification/census-pin-9446a684709d.json`, `--end-state`.

**THIS IS AN ATTRIBUTION, NOT A DELTA AGAINST THE STANDING FIGURE.** `engine/game_differential.js`
changed underneath this pass — a MEASURE agent landed the planted-state fixture fix — so the standing
`28 parted / 27 causes` baseline was taken on a different driver and is not comparable. Both columns
below were produced by the SAME driver (`274b2f327989`), the SAME release, the SAME pins and the SAME
pool, **with only `MEDI_COMMIT_QUEUE_BLIND` varied.**

| arm `middle`, 961 games | knob ON (the defect restored) | knob OFF (fixed) |
|---|---|---|
| protocol PARTED | 27 | **24** |
| board-material | 12 causes / 12 games | **11 causes / 11 games** |
| narration-only | 14 causes / 15 games | **12 causes / 13 games** |
| DIFFERENT-END-STATE | 7 | **7** |
| `active[].stall` family at any boundary | 6 games / 7 leaves | **5 games / 5 leaves** |
| `active[].stall` at the LAST board | 4 | **4** |
| turn-1 causes | species x2, item x1, **`active[].stall` off-by-2-or-3 x2** | species x2, item x1 |
| `ordering` class reaching an identical turn-1 board | 9 games, 7 same | **6 games, 5 same** |

**Narration did not rise.** **The turn-1 stall witness is gone entirely** — the exact board the
2026-08-25 destiny-bond report ranked #1 (a mega mid-turn, a tie, and two `stall` leaves parting) no
longer appears in the turn-1 table at all.

**`planted_state_proof_ok` is TRUE**, on `data/game-differential.json` generated
2026-08-25T20:08:48Z. That is the first true reading since 24 August, the run exited **0**, and
`planted_divergence_proof_ok` is also true. The MEASURE fixture fix took.

**Driver revision** for every whole-game number above: `engine/game_differential.js` sha256
`274b2f327989`, `engine/board_state.js` `324caee90f8f`, `engine/medicham2-browser.js` `c1b24faa9dea`.

---

## 7. WHAT THIS DID *NOT* CLOSE

**`active[].stall` is not eliminated.** 5 games / 5 leaves survive at some boundary and 4 at the last
board, and one board-material cause is still
`unrelated event mismatch :: |-singleturn|p2a|protect <> |-fail|p2a`, parting at **turn 5** with the
board parting EARLIER than the narration. That is a second instance of the family and it is **named
and not diagnosed** — it is not a turn-1 mega board, so it is a different mechanism wearing the same
leaf. It stays on the hand list.

---

## 8. OWED, NOT RUN

- **`tests/run-all.js` in full — NOT RUN.** Run individually and green: `tests/test-mechanics.js`
  (705/705, 0 missing), `tests/test-engine-diff.js` (`--n 6000 --seed 20260804`, 0 of 6000 at all 16
  corners), `tests/roster.js` x3 and `engine/all_mechanics_fire.js --kind all` (see the ledger for
  their readings).
- **`tests/test-resolution-order.js`, `tests/test-volatile-duration.js`, `tests/test-game-diff.js`,
  `tests/test-end-state.js`, `tests/test-encore-fail-silent.js`, `tests/test-engine-consistency.js`,
  `tests/test-bracket-regain.js`, `tests/test-roster-arm-pin.js` — NOT RUN.** All of them touch turn
  order or the queue and all of them should be run before this is trusted further. This is the largest
  gap in the pass and it is a consequence of wrapping up at a boundary rather than of a judgement that
  they do not matter.
- `tests/interaction_matrix.js`, `tests/mutation_harness.js`, `engine/selftest.js`,
  `engine/conformance.js`, `engine/feature_fixture.js --check`, `engine/quarantine.js` — **NOT RUN.**
- **A POOL-SCALE reading of `MEDSEEN.commitQueuePhantomDisplacedAct`.** `game_differential.js`
  surfaces no `MEDSEEN`, so the mechanism counter has been read only on the staged boards.
- **The remaining `active[].stall` family (§7)** — named and ranked, not diagnosed.
- **The charge (order 107) entries have not been shown to fire.** They are the same entry class and
  the same one-line membership, but no board in this pass staged a Focus Punch or a Beak Blast beside
  a speed tie, so that half of the fix is CORRECT-BY-CONSTRUCTION and NOT MEASURED. Said plainly
  rather than counted as landed.
- **A latent ordering issue noticed and not touched:** `_megaPhase` is entered at the first action
  with `_pri < 6`, and a Prankster Helping Hand resolves to priority 6, so on a board carrying one the
  mega would fire after that move where the authority fires it before. Pre-existing, out of scope,
  filed here.
