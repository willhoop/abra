# ROADMAP #344 — a fainted body in an active slot: refuted, and the instrument that produced it is fixed

2026-08-27, ENGINE. Release `f6a3b35ed665` (re-cut over an identical tree, same id).
Probe: `tests/probe_corpse_in_slot.js`. Register: ROADMAP **#344** closed, **#495** filed.

---

## LEAD — IT DOES NOT REPRODUCE, AND IT NEVER WAS A STATE DIVERGENCE

**The authority does not clear the body from the slot. It clears a FLAG, and the dump was comparing
OUR MEMBERSHIP against THEIR FLAG.**

`faintMessages` sets `pokemon.isActive = false` (`sim/battle.ts:2563`). It does not touch
`side.active`. The only writers of that slot in the whole simulator are `switchIn`
(`sim/battle-actions.ts:136`), `swapPosition` (`sim/battle.ts:1597-8`) and the request mirror at
`:2690`. So a corpse awaiting its replacement sits in the authority's active array exactly as it sits
in ours, and the two engines agree.

`rosterSnapshot` in `engine/game_differential.js` asked two different questions:

```js
medicham   where: acts.indexOf(m) >= 0 ? 'active' : 'bench'   // MEMBERSHIP of S.actA/actB
showdown   where: p.isActive          ? 'active' : 'bench'    // a FLAG on the Pokemon
```

The row's stated reason for calling it real state — *"`rosterSnapshot` reads membership of the active
array itself, not a flag"* — is true of the left column and false of the right one.

---

## THE MEASUREMENT

`tests/probe_corpse_in_slot.js`, pinned pool (`data/team-pool-frozen`), 129 pairs, arm `middle`.

### Part 1 — the authority's own object, read the instant `faintMessages` returns

| | |
|---|---|
| `faintMessages` calls | 18,933 |
| fainted bodies STILL MEMBERS of `side.active` | **1,202** |
| of those, reading `isActive === true` | **0** |
| CONTROL — off-field bodies found in `side.active` | **0 of 69,626** |

The control is what makes the first row mean anything: membership does distinguish bodies that have
genuinely left the field, so 1,202 is not an artefact of a predicate that says yes to everybody.

### Part 1b — the dump field #344 was read out of, shown RED then green

| | before | after |
|---|---|---|
| fainted bodies matched in both halves of `final_roster` | 41 | 41 |
| halves that DISAGREED on `where` | **41** | **0** |

Witnesses before the fix, all of the same shape:
`tyranitarmega`, `milotic`, `sinistcha`, `whimsicott`, `sceptilemega`, `basculegion` —
`medicham where=active  showdown where=bench`.

### Part 2 — parity of the two active arrays, by roster key, at every turn boundary

| | |
|---|---|
| boundaries compared | 1,594 |
| boundaries holding a corpse | 59 (174 corpse-slots) |
| boundaries that MISMATCHED | **0** |
| CONTROL — planted occupancy changes reported as mismatches | **227 of 227** |
| roster-key fallbacks | 0 / 0 / 0 |

### Part 3 — the consequence, which is what the row actually asked for

`isActive` is read in exactly one place a corpse can reach that an `hp`/`fainted` gate does not
already dominate:

```js
if (target instanceof Pokemon && (target.isActive || source?.isActive)) {
    handlers = this.findPokemonEventHandlers(target, `on${eventName}`);
    ... onAlly / onAny / onFoe ...
    target = target.side;                  // and so the `instanceof Side` block never runs either
}                                                          // sim/battle.ts:1053-1067
```

For a corpse that whole block is skipped. The probe recomputes it on every call whose target is a
corpse. Thirteen event names reach a corpse; **exactly two suppress anything.**

| event | corpse-calls | SUPPRESSED | live-reads | live-handlers | what |
|---|---|---|---|---|---|
| `ModifySpe` | 211 | **39** | 925 | 58 | choicescarf 24, tailwind 8, sandrush 3, par 2, swiftswim 1, chlorophyll 1 |
| `ModifyPriority` | 4 | **2** | 39 | 2 | galewings 2 |
| `Type` | 1,023 | 0 | 1,187 | 0 | |
| `ModifyBoost` | 211 | 0 | 931 | 0 | |
| `DisableMove` | 53 | 0 | 106 | 1 | |
| `TrapPokemon` | 53 | 0 | 129 | 0 | |
| `LockMove` | 53 | 0 | 163 | 0 | |
| `SemiLockMove` | 53 | 0 | 156 | 0 | |
| `MaybeTrapPokemon` | 38 | 0 | 97 | 0 | |
| `AfterFaint` | 6 | 0 | 0 | 0 | |
| `AfterMoveSecondary` | 2 | 0 | 8 | 0 | |
| `AfterMoveSecondarySelf` | 2 | 0 | 9 | 0 | |
| `AfterMove` | 2 | 0 | 15 | 1 | |

`ModifySpe` is the channel the 2026-08-27 replacement batch already landed (commit `69f886bb`).
`ModifyPriority` is new and is filed as **#495** — an observation with a measured numerator and an
unmeasured consequence, not a defect.

**The control is the same recompute run against LIVE bodies**: 267 of 6,493 sampled reads non-zero
over 17 event names. Without it every zero in the SUPPRESSED column would be a fact about the
recompute rather than about the corpse.

**`--verify-inert`** replays all 129 games with both wrappers disarmed: every game's verdict is
identical, so the instrument did not move what it was measuring.

---

## THE FIX — TWO INSTRUMENTS, NO SIMULATOR BYTES

1. `engine/game_differential.js` — `rosterSnapshot`'s showdown half now answers `where` with
   `side.active.includes(p)`, the same predicate as the medicham half, and carries `isActive` beside
   it as its own named field. The flag is a real fact about the authority (it is what makes
   `toString()` print a bare side id and what makes `findEventHandlers` collect nothing); what it may
   not do is masquerade as the answer to the other column's question.
2. `engine/replay_one.js` — the `<<< A FAINTED BODY IN AN ACTIVE SLOT` annotation hung off the
   MEDICHAM rows only. Both halves now carry the same note, which reads
   *"corpse in the slot, awaiting its replacement (both engines do this)"*, and the showdown rows
   print `isActive` too. That one-sided alarm is what #344 was written from.

`engine/medicham2-browser.js` is byte-identical. The release re-cut to the **same id**
`f6a3b35ed665`, which is the proof rather than the claim.

---

## PREDICTED BEFORE THE RUN, AND MEASURED

| | predicted | measured |
|---|---|---|
| board-material | 9 of 961, unchanged | **9 of 961** (961 − 952) |
| whole-game | 10 of 961, unchanged | **10 of 961** (15 raw − 5 declared) |
| census | 765 live / 765 probed / 0 missing | **765 / 765 / 0** |
| pin digest | `44bd49403231` | `44bd49403231` |

Pins: `--games 1200`, arm `middle`, `--turns 12`, `--team-store data/team-pool-frozen`,
`--census data/verification/census-pin-9446a684709d.json`, `--state --end-state`,
`--release f6a3b35ed665`.

The prediction was not a hedge: nothing the differential compares was touched, and the identical
release id says so independently of the run.

---

## WHICH SCOREBOARD, SAID BEFORE THE RUN

Neither. This is an audit of a declaration, and the only thing that could move is the dump field, so
the pool and the census were both expected to sit still and did. What a positive result would have
looked like is stated explicitly: Part 2 reporting a non-zero mismatch count, or Part 3 finding a
suppressed channel other than the two above. Both were reachable — the plant control fired 227/227
and the live-body recompute returned handlers on 17 event names.

---

## OWED, NOT RUN

- **#495 — the Gale Wings fixture.** A body carrying a priority ability that dies with a flying move
  still queued, beside a live speed tie, asserting the two engines put the SURVIVING actions in the
  same order, with a knob in the direction that restores the priority. Until that runs, nobody knows
  whether medicham2 re-prices a dead body's queued action at all, and #495 must not be called a
  defect.
- **The narration gate.** Not touched here; #344 wrote no divergent line in the first place.
- **A wider corpse-channel sweep.** Part 3 covers the events that actually occurred in 129 pinned-pool
  games. A rarer event aimed at a corpse would not appear; the roster and the census are where that
  tail belongs.
- **`tests/probe_corpse_in_slot.js` is not registered as a gate.** It is a standing probe, run on
  demand; it is not in `tests/run-all.js` and no ratchet reads it.
