# H4 SETTLED — THE FORCED-SWITCH MIRROR WAS THE HARNESS, AND IT WAS ASKING AN END-OF-TURN QUESTION ABOUT A MID-TURN REQUEST

**2026-08-29. Batch of one.** Card **A1** of `docs/_reports/2026-08-29-empirical-divergence-cards.md`,
and the open question **H4** underneath it: *"which half of the pivot stop is wrong — the harness or
our pivot timing?"*

**The answer is the harness, and it was proved by reproducing one pinned game rather than by argument.**
medicham2's pivot is correct: both protocol streams agree line for line through the Parting Shot, and
they agree on the body that comes in. What was wrong is that `mirrorForcedSwitch` read medicham2's
CURRENT occupant of the slot to answer a request Showdown raises MID-TURN.

| | before | after |
|---|---|---|
| games reaching a result (**completion**) | 459 / 961 = **47.76%** | 465 / 961 = **48.39%** |
| games whose **BOARD** diverged (board-material) | **135** | **117** |
| games truncated by the mirror | **42** (4.4%) | **27** (2.8%) |
| protocol-diverged games | 248 | 233 |
| class `showdown stopped emitting while medicham2 continued` | **18** | **3** |
| unmirrorable forced-switch EVENTS | 91 | 61 |
| turn boundaries compared | 10,445 | 10,530 |
| `mid_void: low-identity` (games voided for too few shared dice) | 13 | 8 |

Pins, identical on both runs and verified field by field: release `e129bca605e3`, census pin
`9446a684709d`, `--team-store data/team-pool-frozen`, pool `0d103fb9fa87`, `--games 1200` (yields 961),
`--turns 12`, `--arm middle`, pin digest `ccb365985023`, Showdown commit
`20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`, `source_digests` byte-identical, swarm config table
identical. **The sample did not move; the driver did not move; only the mirror did.**

Artifacts: `data/verification/game-differential.empirical-after.json` and
`data/verification/divergence-turns.empirical-after.json`. The BEFORE artifacts
(`gd-empirical-cards.json`, `divergence-turns.empirical.json`) are untouched, so the card review is
still checkable against its own source. `data/game-differential.json` was **not** written.

---

## 1. WHAT THE CARD SAID, CHECKED CLAIM BY CLAIM

| card A1 says | verdict |
|---|---|
| the mirror asks Showdown to switch in a body that is already ACTIVE | **CONFIRMED**, on 16 of the 30 dumped cases |
| …"on boards the report prints as otherwise identical" | **PARTLY REFUTED — and this is the part that mattered.** Of the 32 mirror-stop games in the dump, only 3 had matching LIVE rosters and **0** had matching full rosters. The other 14 of the 30 classifiable ones are the OPPOSITE finding: Showdown's copy of the wanted body is a **corpse** and medicham2's is not — a real parted board, correctly stopped. The card's "the boards had not parted" reads as a statement about all 11; it is true of the ACTIVE half only. |
| 11 games have this as their first divergence | not re-derived; the stop is downstream of a first divergence in most of these games, and 15 of the 42 turn out to have had no cause of their own |
| the same code truncates 42 of 961 games (4.4%) | **CONFIRMED EXACTLY.** 42, and `459/961 = 47.76%` reproduces the report's 47.8% |
| every case names `[from] partingshot` or `[from] flipturn` | **CONFIRMED in kind, understated in the mechanism.** The pivot is what puts a SECOND body into one slot in one turn; the second entry is an ordinary faint replacement carrying no `[from]` at all, and it is the one the mirror was answering with |

**The merged wording is why H4 could not be answered from the artifact.** The stop sentence read
`which showdown has but cannot switch in (fainted/active)` — one string for two answers that mean
opposite things. It now says `has FAINTED` or `already has ACTIVE on the field`, and the whole
diagnosis falls out of the end-reason table without opening a dump.

---

## 2. THE REPRODUCTION — ONE PINNED GAME, BOTH ENGINES, NOTHING TYPED

`pair-speedctrl` / `gen9championsvgc2026regmbbo3-2654713271 vs gen9championsvgc2026regmbbo3-2654811481`,
turn 7. Replayed out of `pairsFor()` on the pinned pool so it is the same game the artifact holds.

```
  |move|p2a: Incineroar|partingshot|p1a: Kingambit          <- SHOWDOWN PAUSES HERE and asks p2 slot 1
  |-unboost|p1a: Kingambit|atk|1
  |-ability|p1a: Kingambit|defiant|boost                       (both streams identical to this point)
  |-boost|p1a: Kingambit|atk|2
  |-unboost|p1a: Kingambit|spa|1
  |-ability|p1a: Kingambit|defiant|boost
  |-boost|p1a: Kingambit|atk|2
  |switch|p2a: Gengar|gengar, L50|135/135|[from] partingshot   <- medicham2's ANSWER to that request
  |move|p1a: Kingambit|ironhead|p2a: Gengar
  |-damage|p2a: Gengar|0 fnt
  |faint|p2a: Gengar
  |switch|p2a: Incineroar|incineroar, L50|131/170              <- the PIVOTER returns as the corpse's
                                                                  replacement, later in the SAME turn
```

`M.battleTurn()` is atomic — it plays the whole turn and returns. The mirror then looked at
`S.actB[0]`, which by then held **Incineroar again**, and asked Showdown to switch Incineroar into a
slot Showdown had Incineroar standing in. Showdown refused; the harness stopped the game at turn 7.

With the fix the same game plays to **turn 11 and both engines end the battle**, with the live bodies
identical on both sides (`kingambit 139 / sinistcha 146 / delphox 150`; p2 wiped).

**medicham2's pivot timing was never in question once this was on screen.** The two engines agree on
the Parting Shot, on the Defiant chain it triggers, and on the body that comes in. There is no engine
change in this batch.

---

## 3. THE FIX

`engine/game_differential.js`, three parts, all in the READER — no engine byte moved, and
`game_differential.js` is not one of the frozen SOURCES, so the pinned re-run picks it up.

**a. The ordered occupancy is OBSERVED, not parsed for identity.** `trace.push` is wrapped on the
instance (it stays a real `Array`; `harvest`, `reduce`, `slice`, `filter` and the returned `mediTrace`
are all unaffected). On a `|switch|` / `|drag|` line the SLOT is read off the identifier — `p2a` →
side `p2`, slot 0, a **positional** read — and the BODY is taken out of `S.actA`/`S.actB` at that
instant, which is valid because `ident()` resolves the slot by `indexOf` and therefore runs *after* the
body is placed. Identity then goes through `rosterKey` like every other identity question in the file.

> Reading the NAME out of the trace line was considered and rejected. It would have been a **sixth**
> implementation of "which body of the roster is this" — the rosterKey header lists the five this
> project has already paid for, one of which took a pinned run from 22 parted games to 227.

**b. Two exclusions, both counted, neither silent.**
- **The driver's own voluntary switch.** It reaches Showdown in the choice string and never raises a
  `forceSwitch`; left in the queue it would answer the turn's first forced request with the body that
  walked in at the top of the turn. Dropped only when it is the first entry, carries no `[from]`, and
  its `rosterKey` equals the `switchTo` this driver issued for that slot. **4,134 excluded** against
  the driver's own independently-derived **4,141 switches chosen** — a coherence check nothing in the
  fix arranges.
- **A drag.** `forceSwitch()` (`sim/battle-actions.ts:1353`) picks the incoming body itself out of
  `possibleSwitches`, so Roar, Whirlwind, Dragon Tail and Circle Throw never raise a request. **142
  excluded.**

**c. The queue is CONSUMED across the caller's `while` loop**, because Showdown raises one request,
takes the answer, resumes the turn and may raise another — which is exactly the reproduced game. A
queued body is **not** asked whether it is alive: `mine[i]`'s liveness test answers a question about
the END of the turn, and a queued entry is a statement about a MOMENT. Testing Gengar's end-of-turn
`fainted` would have answered `pass` to a request Showdown raised while Gengar was still standing.

**d. The stop sentence was split** into `has FAINTED` / `already has ACTIVE on the field` /
`does not have under that name` / `claimed by the other slot`.

Where the answers came from over the 961 games:
`from_ordered_occupancy 6570 · from_end_of_turn_slot 221 · entry_lines_watched 10911 ·
voluntary_excluded 4134 · drags_excluded 142 · unplaced 0`. The 221 end-of-turn reads are slots where
medicham2 made no forced entry at all — 164 of them answered `pass` (its slot is empty or holds a
corpse) and 61 are the genuine parted boards.

---

## 4. THE PROBE, SHOWN RED BEFORE IT WAS TRUSTED

`tests/probe_forced_switch_mirror.js`. Every member of the fixture is derived from the format and
printed before it is used; nothing is named.

- **the pivot** — the move tagged `pivotStatus`, on the legal learner with the highest base Speed whose
  slot-0 ability carries a status-move `priorityMod` (so the pivot resolves before the killer without
  depending on a spread). Derived this run: Parting Shot on Grimmsnarl.
- **the killer** — the move tagged BOTH `userFaints` and `fixedDamage` whose `damageCallback` reads
  `pokemon.hp`. It is the only deterministic OHKO in this format: no accuracy roll, no damage roll, and
  the pin's minimum damage index cannot save the victim. Derived: Final Gambit on Staraptor.
- **the victim** — the frailest legal body the killer's type is not immune against, placed at the front
  of the bench so the pivot brings it in. Derived: Pikachu, 110 HP against the killer's 160, checked
  through the driver's own `freshBodies` builder before the game rather than explained after it.

One turn: the pivot brings the victim in, the killer kills it, and the pivoter comes back — the
reproduced shape. **The fixture must prove it staged, and it is judged on the AUTHORITY'S log**: two
`|switch|p1a:` lines inside the `|turn|1` window (scoped, because the whole log also holds the lead's
own switch line, and counting that would make a fixture that never staged look like one that did).

Green now: `refused=0`, `unmirrorable=0`, `switched=3`, no protocol divergence, and the game is not
stopped by the mirror.

**RED under `MEDI_MIRROR_END_OF_TURN=1`**, re-run in a child, printing the defect's own sentence:

```
  child exit 1   stopped on the mirror: true   named the ACTIVE refusal: true
  unmirrorable=1  p1: slot 1 holds grimmsnarl, which showdown already has ACTIVE on the field
```

`tests/test-forced-switch-mirror.js` parts 2–6 pass three arguments and are unchanged in behaviour by
construction; its part 5 now asserts the sharper `has FAINTED` wording rather than the merged one, and
it is green (14 of 14).

---

## 5. THE 27 THAT REMAIN, AND WHY NONE OF THEM IS THIS BUG

From `divergence-turns.empirical-after.json` (22 of the 27 are in the dump):

| | n | verdict |
|---|---|---|
| `has FAINTED` | 14 in the dump (19 games in the end-reason table) | **REAL, and correctly stopped.** 14 of 14 have genuinely disagreeing LIVE roster sets — Showdown killed a body medicham2 still has standing. Each carries its own earlier divergence. |
| `"pass, pass" refused` | 2 | **REAL.** `alive showdown [maushold pelipper] vs medicham2 [pelipper]` — the two engines disagree about how many bodies are left. |
| `already has ACTIVE` | 6 | **Downstream of six OTHER carded engine defects, one each.** Not the harness. |

The six, read off the last agreed lines of each dump card:

1. **C1** — Rage Powder does not redirect Parting Shot. Showdown redirects onto the unprotected ally,
   the move connects and the pivot fires; we hit the named target, which has Protect up, so we never
   pivot and the queue is empty.
2. **A2** — Parting Shot fails (Clear Body refuses both drops) and we switch out anyway.
3. **G2** — the Bug Bite `[from] stealeat` / `[move]` field shape, upstream of a later pivot stop.
4. **C1 again** — Rage Powder vs Parting Shot, this time into a target we call `-immune`.
5. **F7 / Encore** — a missing `|-activate|…|move: Struggle`, upstream.
6. **C2** — Lightning Rod does not redirect Volt Switch. Showdown redirects onto the Lightning Rod
   ally so the move connects and the user pivots; we hit a Protect and stay.

**Every one of these is a queued batch of its own and none was touched here.** The mirror is now
reporting them rather than being them, which is the point: a stop that says `already has ACTIVE` is
now a pointer at a real engine defect instead of noise.

---

## 6. WHAT THIS DOES TO EVERY OTHER CARD

**The denominator moved and so must the reading of the whole card review.** 135 board-material games
became **117** — 18 games (13.3% of the group set) had a board that differed only because the harness
froze Showdown mid-turn and then compared boards. `showdown stopped emitting while medicham2
continued` fell 18 → 3, which is the same 18 arriving as a protocol class.

Concretely, for whoever picks up the next card:

- **Any card whose count came from a game that stopped on the mirror is an upper bound.** Six of the
  36 groups are named above as the surviving causes of a mirror stop (B-family, C1, C2, F7, G2, A2).
- **The completion rate 47.8% is superseded by 48.4%**, and it is still a LOWER BOUND — 27 games are
  still truncated, now for reasons that are the engine's.
- `engine/coverage.js` picks both arms up with no edit and prints them side by side on one set of
  pins, so the pair can be read without either being quoted alone.

**Card A1 should be marked SETTLED-AS-HARNESS and card H4 answered.** Card A2 stands unchanged and is
now one of the six things holding the last of the truncations open.

---

## 7. WHICH SCOREBOARD, SAID BEFORE THE RUNS

Predicted: **the POOL moves and the LAB does not.** Both held.

- **The pool moved**, because this is an instrument stop and the instrument only exists in the pool:
  board-material 135 → 117, completion 47.76% → 48.39%, truncations 42 → 27.
- **The census did not move** — 784 live / 784 probed / 0 missing, before and after,
  `tests/test-mechanics.js` re-run. It is not supposed to: this batch fixed the harness, not a
  mechanic, and no census row covers `game_differential.js`. **The one number did not go down.**
- The staged probe is the lab half and it is new, not a census row.

**Nothing else was allowed to move, and it did not**: `planted_divergence_proof_ok` true,
`planted_state_proof_ok` true, `mappings_all_proved` true, `reader_failures {}`,
`MEDFAILS.traceBodyOffField 0`, `ROSTER_KEY_FALLBACK 0/0/0`, `unplaced 0`, and `choices_refused` is
**3 before and 3 after with the same two error strings on the same two seeds** — pre-existing, not
introduced here (see OWED).

Gates re-run green: `test-forced-switch-mirror.js`, `test-game-diff.js`, `test-end-state.js`,
`test-roster-identity.js`, `test-coverage-stop.js`, `probe_corpse_in_slot.js`, `probe_drag_body.js`
(pinned), `probe_forced_switch_mirror.js`.

---

## OWED, NOT RUN

1. **`choices_refused` reads 3 and must read 0 — PRE-EXISTING, NOT THIS BATCH.** Identical before and
   after, same seeds, same strings: `p1 "move 4, move 1": Can't move: Floette's Protect is disabled`
   (2 of the 3, both THREW their game) and `forced-switch choice rejected p1 "pass, pass": Can't pass:
   You need to switch in a Pokémon to replace Ninetales`. The second is the mirror answering `pass` for
   a slot Showdown insists needs filling; it is a different question from A1 and deserves its own
   batch. Command: the same pinned re-run, then read `declared_gaps.choices_refused_first`.

2. **The `drag` exclusion has no staged probe.** It is derived from `sim/battle-actions.ts:1353` and
   measured at 142 exclusions on the pool, and `tests/probe_drag_body.js` is green on the pinned
   release — but nothing stages a drag and a forced switch into the SAME slot on the SAME turn, which
   is the only shape where getting it wrong changes an answer. Owed:
   `SHOWDOWN_PATH=… node tests/probe_drag_body.js --release <id>` extended with a pivot+phaze arm.
   Expected: unchanged, 0 unmirrorable.

3. **The voluntary-switch exclusion is proved by a coincidence, not by a control.** 4,134 excluded
   against 4,141 switches the driver chose is strong and it is not an assertion. Owed: a staged turn
   where one slot takes a VOLUNTARY switch and then a forced replacement, asserting the forced request
   is answered with the second body. Expected: 1 voluntary excluded, 1 forced answered, 0 unmirrorable.

4. **`data/game-differential.json` — the published headline — is still the coverage arm and was not
   re-run.** The mirror fix cannot move it (that arm reports 0 truncations), so re-running it would
   cost four minutes to confirm a zero. Command if wanted:
   `tools\lownode.cmd engine\game_differential.js --end-state --arm middle --games 1200 --turns 12 --release e129bca605e3 --team-store data/team-pool-frozen --census data/verification/census-pin-9446a684709d.json --write --out data/verification/game-differential.coverage-after.json`.
   Expected: identical to `game-differential.coverage-control.json` — 17 results, 944 cap, 0 truncated,
   0 board-diverged.

5. **The six remaining `already has ACTIVE` games are the fastest way to check the next six fixes.**
   Each one is a single named defect whose repair should convert exactly one truncation into a played
   game. Expected after C1 (Parting Shot redirection) alone: truncations 27 → 25, board-material
   117 → 115 or better.
