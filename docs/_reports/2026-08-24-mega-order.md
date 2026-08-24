# The mega phase — "follow Showdown to a capital T". 2026-08-24

Will asked for one thing: **mega evolution must resolve in exactly the order the real game resolves
it in.** The reason he gave is a board — two Pokémon that both mega evolve and both gain a
weather-setting ability. Whichever finishes evolving **last** owns the sky, and the sky multiplies
every attack for the rest of the battle. Mega evolution also changes Speed, so which Speed the game
reads decides who is last.

**Short version: three of the four rules were already right, the fourth was wrong, and it was wrong
in the one place a player would notice — an exact Speed tie. It is fixed, and the two mega rows in
the pool comparison are gone.**

---

## The population, derived rather than recalled

Four Pokémon in this regulation gain a weather ability when they mega evolve. Read out of the format
by walking every mega stone and intersecting the mega forme's abilities with the abilities whose
`onStart` calls `setWeather`:

| base → mega | ability it gains | Speed |
|---|---|---|
| Abomasnow → Abomasnow-Mega | Snow Warning | 60 → **30** (loses 30) |
| Tyranitar → Tyranitar-Mega | Sand Stream | 61 → 71 |
| Froslass → Froslass-Mega | Snow Warning | 110 → 120 |
| Charizard → Charizard-Mega-Y | Drought | 100 → 100 |

Abomasnow and Tyranitar already declare their weather ability on the base forme, so both probes below
give them their **other** legal ability (Soundproof, Unnerve). Otherwise the sky would be decided when
they walk on, and the mega phase would not be asked anything.

---

## The four questions, answered from the source

### 1. Which Speed orders the phase — before or after transforming? **BEFORE.**

- The mega action is queued at **order 104** — `sim/battle-queue.ts:184`, between `switch` (103) and
  every move (200).
- The whole queue is sorted once at `commitChoices` (`sim/battle.ts:3015`), and each action's speed is
  `pokemon.getActionSpeed()` (`sim/battle.ts:2657`), read while nothing has transformed yet.
- The mid-turn re-sort only fires when the **next** queued action is a `move` (`sim/battle.ts:2917`).
  A mega action is not a move, so the mega order is never re-derived.

**Staged in the official simulator, one knob (the Abomasnow's nature), the sky as the answer:**

| Abomasnow | Tyranitar | Showdown | us |
|---|---|---|---|
| 123 before → 90 after (the orders cross) | 103 → 113 | **SAND** | SAND |
| 100 before → 73 after (no crossing) | 103 → 113 | **SNOW** | SNOW |

An engine reading the *after* Speed answers SNOW on both rows, because Abomasnow-Mega is slower than
Tyranitar-Mega either way. The control moving is what says the board is really testing this.
**We were already right.** Census probe: `item/megaStone — the mega PHASE resolves on PRE-mega Speed,
and the last weather setter owns the sky`.

### 2. When does the new ability fire? **Inside the evolution itself.**

`runMegaEvo` (`sim/battle-actions.ts:1898`) → `formeChange` (Champions' own override,
`data/mods/champions/scripts.ts:57`) → `setAbility(ability, null, null, true)` (`:1493`), whose last
act is `singleEvent('Start', ability, …)` (`sim/pokemon.ts:1946`). In the log it comes out as three
consecutive lines, and both engines print them in that order:

```
|detailschange|p2b: Tyranitar|Tyranitar-Mega, L50
|-mega|p2b: Tyranitar|Tyranitar|Tyranitarite
|-weather|Sandstorm|[from] ability: Sand Stream|[of] p2b: Tyranitar
```

### 3. Does the last setter win? **Yes.**

`Field#setWeather` (`sim/field.ts`) refuses only when the weather already standing has the **same
id** and the source is an ability. A different weather always overwrites. So the second mega to
resolve keeps the sky, which is exactly Will's point.

### 4. Does our sort match the authority's? **It did not. It does now.**

Showdown sorts with `speedSort` (`sim/battle.ts:429-459`) — a selection sort whose swaps drag
*untied* entries past each other, ending in a coin flip over any tied group. We used a plain
`Array.prototype.sort`, and worse, we ran it over the **wrong list**.

**The real defect, which is not the algorithm alone.** Showdown's two mega actions sit at order 104,
so they are the very first thing its sort places and no swap made for a faster *move* can reach them.
They keep the order they were handed to the queue in — p1 slot 0, p1 slot 1, p2 slot 0, p2 slot 1,
because `addChoice` **pushes** (`sim/battle-queue.ts:306`) rather than inserting.

Our engine has no mega action. It read the mega order off the turn's action list **after** that list
had already been sorted for the moves — and on a tie, that sort's swaps had already reversed the two
mega bodies.

---

## The board that proves it — the weather war on an exact tie

Four Pokémon. Two flankers at 202 and 194 Speed. The two megas both at **167** — a dead tie.

- **p1 slot 1: Froslass @ Froslassite** — becomes Snow Warning, sets snow.
- **p2 slot 0: Charizard @ Charizardite Y** — becomes Drought, sets sun.

| | Showdown | us, before | us, after |
|---|---|---|---|
| **exact tie, 167 v 167** | **SUN** | SNOW ← wrong | **SUN** |
| control: Charizard slowed to 152 | SUN | SUN | SUN |
| control: Froslass slowed to 152 | SNOW | SNOW | SNOW |

The two controls answer **opposite** skies, which is what says the board is sensitive to the thing
being tested rather than answering the same way regardless. Only the exact tie parted.

Census probe: `item/megaStone — a mega-phase SPEED TIE keeps the QUEUE order, not the move order`.
Knob: `MEDI_MEGA_STABLE_SORT=1` puts the old sort back and the probe goes red again.

### A wider sweep, because one board is one board

648 constructed boards: the same four bodies, every combination of slot placement and nature for all
four, played twice — once plainly, once with a Pokémon switching out on the same turn so the
authority's `switch` order (103) is exercised alongside the mega order.

- current engine: **0 of 648** disagree with Showdown
- old sort restored: **36 of 648** disagree, and every one of them is an exact tie

Counters off the engine that played them: `megaTieResolved = 54` (the tie path really ran),
`megaOrderTieNoDie = 0` (the shared coin was in scope every time), `megaQueueUnlisted = 0` (no mega
candidate escaped the queue), `megaEvolved = 1296` (= 648 × 2, so every board really evolved both).

### The coin is the shared one

There is one place in this project that decides who goes first when two Pokémon are exactly as fast,
and both simulators are wired to it so a comparison between them stays honest. The mega phase now
asks that same coin (`_tieRng`, the `tie` stream `sortTurnOrder` already uses) and nowhere else. It
did not invent a second source — that was the specific hazard flagged in the brief, and it is the one
the entry-order pass nearly landed. When no coin is in scope (every rollout, every census probe) the
group keeps the order the selection sort gave it and `megaOrderTieNoDie` counts it, loudly.

---

## The numbers

All re-measured on this tree. Nothing carried over.

### Must not move — did not

```
damage differential      0 of 6000 disagreements, seed 20260804
                         and 0 of 6000 at each of the 16 corners of the damage roll
census                   681 -> 683 probed, 683 live, 0 missing, 0 threw, run_ok true
                         the two added probes are the two above
```

### Whole game — a RE-BASELINE, not a delta

Arm **`middle`**. Release **`b35e96a0e7c7`** (fresh, cut on this tree). Team pool
`data/team-pool-frozen`. Census pinned to `data/verification/census-pin-9446a684709d.json`. The pool
holds **961** game pairs, so `--games 1200` played 961 — the same way the standing figures were taken.

| | standing (`fbf74de3fbd6`) | now (`b35e96a0e7c7`) |
|---|---|---|
| raw parted | 39 | **37** |
| **board-material** | **20 games / 19 causes** | **20 games / 19 causes — UNMOVED** |
| narration-only | 19 games / 18 causes | **17 games / 16 causes** |
| undeclared (the published headline) | 26 of 961 = 2.7% | **24 of 961 = 2.5%** |
| `ordering` class | 12 games | **10 games** |

**Board-material did not rise. Narration did not rise.** Both stop conditions held.

**The two games that cleared are exactly the two mega rows**, and they are gone from the artifact:

```
ordering :: |detailschange|p1a|starmiemega,l50   <> |detailschange|p2a|charizardmegay,l50
ordering :: |detailschange|p1a|mawilemega,l50    <> |detailschange|p2a|mawilemega,l50
```

Both were exact ties. Both were classed **narration-only** in the pool — the mega order swapped, but
in those two particular games no compared board leaf moved as a result. Said plainly rather than
dressed up: **in the pool this fix bought two narration games, not two board-material ones.** The
board consequence is real and it is proved on the staged weather war, where the sky itself changes;
the pool simply does not happen to contain a game where two weather megas tie.

### Which scoreboard, said before the run

Two megas tying on Speed is **rare** — so the lab (the census probes and the staged boards) was
expected to move and the pool was expected to move by a little or not at all. It moved by two, which
is the size of the mega population in it.

### The deliberate roster — re-run, all three stages

Moving the engine withholds these three artifacts, so all three were re-run at release
`b35e96a0e7c7`:

| stage | FIRED-AND-BOARDS-DIFFER | DID-NOT-FIRE | tested |
|---|---|---|---|
| items | **0** | **0** | 139 of 148 |
| abilities | **0** | **0** | 130 of 202 |
| moves | **0** | **0** | 475 of 500 |

**`all_mechanics_fire --kind all` was re-run too**, at the same release — moving the engine withheld a
fourth artifact that the brief did not name. It reads **moves 18 / abilities 4 / items 1**, the SET
identical to the standing one: zero cleared, zero newly diverging.

Gate back to **5 of 8 clauses passing**, the same three failing as before.

### Every ENGINE instrument, re-run green

`test-mechanics` · `test-engine-diff` · `test-resolution-order` · `test-speed-tie` ·
`test-volatile-duration` · `test-bracket-regain` · `test-encore-fail-silent` ·
`test-engine-consistency` · `test-end-state` · `test-middle-identity` · `test-immunity-gate` ·
`test-tag-params-derived` · `test-mc-seal` · `test-roster-arm-pin` · `test-damage-roll-support` ·
`test-entry-effects` · `test-protocol-trace` · `test-wiring` · `test-mega-timing` ·
`test-forme-assert` · `test-nature-differential`.

---

## What changed in the code

`engine/medicham2-browser.js`, three places:

- `TURN_ORDER` gains `switch: 103` and `megaEvo: 104` — Showdown's own numbers.
- a new `megaQueueOrder()` beside the entry sort. It rebuilds Showdown's queue list in push order,
  runs the same selection sort over it, and reads the mega entries back out.
- the turn loop captures `_actsQueued` (the action list before it is sorted for the moves), and the
  mega phase calls `megaQueueOrder` instead of sorting its own candidate list.

Four new counters: `MEDSEEN.megaTieResolved`, `MEDFAILS.megaOrderTieNoDie`,
`MEDFAILS.megaQueueUnlisted`, `MEDFAILS.megaStableSortRestored`.

---

## Observed, not caused, not fixed

- **`planted_state_proof_ok` reads `false`.** Two plants (`vol.saltcure`, `vol.syrupbomb`) are NOT
  CAUGHT and six BENCHED-body plants read NOT APPLIED, so the artifact prints *"every state number
  below is worthless"*. **Identical in the standing artifact at HEAD** — pre-existing, already on the
  ENGINE hand list, and named again because every board-material figure this sprint has published sits
  beside it.
- **`megaQueueOrder` costs about four extra Speed lookups per turn** on a turn where nothing megas,
  because the phase builds the queue list before discovering there is nothing in it. Deliberately
  **not** short-circuited: the guard would have been code the whole-game run never played, and the
  measurement is worth more than the microsecond. Named here so the next pass can take it with its own
  before-and-after.

---

## OWED, NOT RUN

- **`tests/run-all.js` in full.** The ENGINE instruments were run individually and are listed above.
- **The residual sort** — the other half of judgement card 3 in
  `docs/_reports/2026-08-24-ordering-cards.md`. Still `Array.prototype.sort`
  (`engine/medicham2-browser.js`, `residualOrder`). Untouched, per the brief's scope line: the mega
  phase only. It is narration (two Tailwind rows of 961) and Will has not ruled on batching.
- **The other three judgement cards** in that file are Will's and are not answered here.
- `tests/interaction_matrix.js` — last run 2026-08-11.
- `tests/mutation_harness.js` — still needs `--gate-only --no-write` wiring.
- `engine/selftest.js`, `engine/conformance.js`, `engine/feature_fixture.js --check` — all three were
  RED at HEAD before this batch and are not this batch's.
- **One thing this pass did not check and should be said out loud:** the authority freezes the mega
  action's Speed at `commitChoices`, and this engine reads it at the moment the mega phase runs.
  Between those two points only switches resolve, so it can only differ if a body's Speed moves during
  a switch-in. No probe fails on it and none was written. Named, not claimed fixed.

---

## What I did NOT claim

No strength gain. ENGINE cannot measure one. Landing the mechanic is the result.
