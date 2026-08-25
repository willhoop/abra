# The planted-state proof — the fixture, not the comparator

MEASURE, 2026-08-25. Historical findings record. Not maintained, not current state; superseded by the
register rows it feeds.

**Verdict: the comparator is sound. The proof pair was.** All thirteen failing plants were aimed at
bodies that could not carry them. None of the thirteen is a leaf the comparator cannot see — every one
of them is caught, localised, at the planted boundary, once it is pointed at a body that is standing.
**The board-material figures already published stand.**

---

## 1. The split reproduces exactly

Pinned to the committed artifact's own run: release `c592445fe011`, census pin
`data/verification/census-pin-9446a684709d.json` (digest `9446a684709d`), team store
`data/team-pool-frozen`, `--turns 12`.

The one parameter the artifact does not record is `--games`. It is recoverable from the team-pool
digest, and it matters (§3): **`--games 1200`** reproduces `team_pool_digest 0d103fb9fa87`,
`1968 teams picked`, which is what `data/game-differential.json` carries.

Under that pin, `plantedStateProof(pairsFor('baseline')[0])` reproduces the committed artifact
plant-for-plant: 42 plants, 29 CAUGHT+LOCALISED, **7 applied-and-not-caught, 6 never applied**.

The coordinator's framing was "8 of 8 side A caught, 7 of 7 side B not". The measured shape is one
step narrower and the difference matters: **plants aimed at side B are not uniformly missed.** Four
of them are caught on this very pair — `a status that is not there`, `the TOXIC stage off by one`,
`the SLEEP counter off by one` and `a body marked fainted that is not` all read side B and all pass.
The seven that fail are exactly the seven **volatile** plants of the 2026-08-12 sweep, which write
into a fixed slot with no check that anybody is standing in it:

| plant | wrote into |
|---|---|
| a Taunt counter off by one | `S.actB[0]` |
| an Encore counter off by one | `S.actB[0]` |
| a Perish count off by one | `S.actB[1]` |
| a MAGNET RISE that is not there | `S.actB[0]` |
| a FOCUS ENERGY that is not there | `S.actB[1]` |
| a SALT CURE that is not there | `S.actB[0]` |
| a SYRUP BOMB that is not there | `S.actB[1]` |

The four side-B plants that pass all go through `living()` / `livingEither()`, which were introduced
on 2026-08-18 for this exact reason and never applied to the volatile sweep.

## 2. Applied at all, or applied and missed? — APPLIED, AND IT MOVED NOTHING

This was the question that decides everything, so it was measured rather than argued.

**The board at the plant boundary** (boundary 6 of 7; the clean arm agreed at all seven), read by a
probe row that mutates nothing:

```
 side A actives:  sneasler hp126        kingambit hp148
 side B actives:  tyranitar-mega hp0 [FNT]   milotic hp0 [FNT]
 side A bench:    primarina hp0 [FNT]   froslass-mega hp0 [FNT]
 side B bench:    excadrill hp0 [FNT]   sinistcha hp0 [FNT]
```

Side B has been swept and both benches are corpses. That is the whole cause, and it splits the
thirteen into two different sentences:

- **The six BENCH plants were NEVER APPLIED, and that is the fixture refusing correctly.**
  `benchedLivingEither` will not plant onto a corpse; there is no living benched body on either side
  at this boundary, so it returns null and the plant reports NOT APPLIED. Nothing about the
  comparator is implicated.
- **The seven VOLATILE plants were "applied" only in the sense that the callback returned truthy.**
  They wrote a volatile onto a fainted body. `engine/board_state.js:661` holds the post-faint group —
  `item, status_counter, boosts, ability, vol, stall` — on a body **both** engines call dead, because
  Showdown's `faintMessages` runs `clearVolatile(false)` on the corpse and medicham2 keeps what the
  body was holding. So the plant landed, the compared board did not move, and there was never
  anything to catch. `applied: true` was a false receipt.

**The control, and it is decisive.** The same seven mutate functions, unmodified, handed a body that
is standing: **all seven CAUGHT+LOCALISED, at boundary 6, the boundary they were planted at**,
reported as `p1.active[0].vol.taunt`, `…vol.encore`, `…vol.perish`, `…vol.magnetrise`,
`…vol.focusenergy`, `…vol.saltcure`, `…vol.syrupbomb`. The comparator sees every one of those leaves.

**Second, independent confirmation, already in the repository.** `tests/test-state-differential.js`
PART 2 runs this same proof over six pairs and re-runs every unproven instance reading medicham's
board either side of the mutation. It already classified these instances as `HELD` and printed
*"THE FIXTURE, NOT THE COMPARATOR … FILED, not patched from here."* `ROADMAP #314` is the filing, and
it names both holes: the corpse-aiming and the false `applied` receipt.

**Neither half is a comparator defect. Both halves are the fixture.**

## 3. Why nobody noticed, and why it looked like a side asymmetry

`engine/diff_swarm.js buildSwarm` picks teams by a deterministic **stride**:
`step = floor(matching.length / per)`, then indices `0, step, 2*step, …`, where `per` is derived from
the requested game count. So `pool[0]` is always the same team and **`pool[1]` — the other half of
the proof pair — changes with `--games`**:

| `--games` | team pool digest | baseline picked | second team of the proof pair |
|---|---|---|---|
| 45 | `9e0af19d6449` | 10 | …2654915133 |
| 300 | `3f9ce5a4f431` | 66 | …2653790568 |
| 961 | `b2b61ec40281` | 213 | …2653867450 |
| **1200** | **`0d103fb9fa87`** | 266 | …2653880737 |
| 4000 | `888f7adf17e5` | 888 | …2653915634 |

Measured, not inferred: the identical code at `--games 45` gives a proof pair whose clean arm parts at
turn 2, plants at boundary 1 with every body alive, and **passes all 42 plants**. At `--games 1200`
the pair's game runs to a sweep and thirteen plants have nowhere to land. **The proof's pass/fail was
a function of the sample-size flag**, which is the plainest possible statement that it was measuring
the fixture.

The "side B" pattern is a coincidence of this pair: side B is the side that got swept.

## 4. What was changed — `engine/game_differential.js` only

Three changes, all in the fixture. **No plant was removed, none was made easier to catch, and the
localisation assertion got tighter rather than looser.**

1. **`livingSlot` / `volPlant`.** The seven volatile plants now find a body that is standing —
   preferring the side they always asked for, crossing over when it is all corpses, exactly as
   `livingEither` has done since 2026-08-18 — and **return the slot they actually used**, so the
   assertion is `active[<slot>].vol.<leaf>`. Four of the seven previously asserted only the bare leaf
   `vol.magnetrise`; they now assert the slot too. A plant that finds no standing body on either side
   still returns false and still fails the proof.
2. **`applied` now means the board moved where the comparator looks.** It read "the mutate callback
   returned truthy", which is not the same sentence and is the second hole in `ROADMAP #314`. The
   plant reads medicham's own board either side of the mutation and asks `BS.compare` — the same
   comparator, stamped as the other engine so the real cross-engine rule applies — whether anything
   it compares moved. `callback_returned_truthy` and `moved_a_compared_leaf` are both published per
   plant, so the no-op case is a number rather than a silence. **A plant that cannot move the board
   is a test that cannot fail.**
3. **A plant that cannot land at the last agreeing boundary walks back through the earlier ones.**
   Every boundary at or below `lastAgreeing` is a board both engines produced identically, so the
   defining property of the plant site is unchanged, and so is every assertion: caught, AT the
   boundary planted, LOCALISED to the planted leaf. **The retry is on `applied` only.** Retrying a
   plant that landed and was not caught would hide the exact failure this proof exists to expose, and
   is not done — the loop stops the moment the board moves, whatever the comparator then does. The
   boundary used and the number tried are printed per plant and published, so "boundary 6 had nobody
   standing" is a receipt rather than a silence.

## 5. After

Same pair, same pins, same 42 plants: **42 of 42 CAUGHT+LOCALISED, `all_ok: true`, 8.7 s.** The seven
volatile plants report `[the other side]`; the six bench plants report `[planted at boundary 4,
3 tried]` and localise to `party.tyranitarmega.{item,status,status_counter,types,boosts.atk,ability}`.

`tests/test-state-differential.js` — the gate MEASURE owns over `board_state.js` and
`divergence_shape.js` — **ALL PARTS PASS**, with `42/42 applied` on all six pairs across three
configurations, `bench leaves exercised: 6/6 OK` eight times over, and **no** "THE FIXTURE, NOT THE
COMPARATOR" findings left to print.

## 6. What this means for the numbers already published

**They stand.** `planted_state_proof_ok: false` never meant a leaf was uncompared; it meant thirteen
plants had nowhere to land on one arbitrarily chosen pair. Every one of the 42 compared field
families has now been demonstrated — caught, at the planted boundary, localised — and
`tests/test-state-differential.js` has been demonstrating 41 of them across pairs for days.

The board-material figures — `first_board_divergences`, `game_agreement`, the turn-boundary agreement,
DIFFERENT-END-STATE — were computed by a comparator that works. `ROADMAP #314`'s consequence line
(*"DIFFERENT-END-STATE is a LOWER BOUND wherever it is quoted, including the 83 published in CHANGELOG
5.54.0"*) rested on the thirteen being INDETERMINATE. They are no longer indeterminate: they are the
fixture. **That caveat is withdrawn, and the 83 do not need a footnote.**

**This says nothing about whether MEDICHAM is correct.** It says the ruler works. The engine is still
quarantined on its own gate clauses, and a working ruler is what makes those clauses readable rather
than a reason to stop reading them.

One limit stands and is unrelated to this pass, because it is a declared design decision rather than a
hole: **the post-faint group is not compared on a body both engines call dead.** `item`,
`status_counter`, `boosts`, `ability`, `vol` and `stall` on a corpse are held deliberately, on both
the bench and the active slot, with a counter published every run. A defect that exists only in a dead
body's volatiles is outside what any board-material number claims.

## 7. OWED, NOT RUN

- **`data/game-differential.json` still carries `planted_state_proof_ok: false`** and still exits 1 on
  it. The artifact was not regenerated — an ENGINE agent holds the differential this session and will
  re-run it. Until that run lands, the committed artifact is stale on this one flag and on nothing
  else. The flag flips on the next `--state` run with no further work.
- **`ROADMAP #314` is answered but not closed here** (row text proposed to the coordinator; MEASURE
  does not edit the register).
- **`tests/probe_bench_plants.js` still exits 0 while reporting failures.** #314's own OWED item — a
  reporter pointed at by a marker reads as a gate. Untouched this pass.
- **`docs/ENGINE.md`'s sentence "41 of 42 are caught, the one hole is the benched-HP plant"** is
  ENGINE's file and is now doubly wrong. Not edited; reported.
- **Not re-run, deliberately:** `game_differential.js` itself, `tests/roster.js`,
  `all_mechanics_fire.js`, `tests/test-engine-diff.js`, `tests/test-mechanics.js`,
  `status.js --write` — all excluded by the brief while an ENGINE agent is live.
- **`CHANGELOG.md` entry and the ledger stamp are owed to the coordinator.** Nothing was committed.

## 8. Two things that happened alongside, reported and not touched

- **Two `game_differential.js` runs were started by another process at 15:41:01 and 15:41:54 EDT**
  (`data/releases/999d51a3786c/cuts.jsonl`), while this file was being edited. Node reads a module
  once, at require time, so either of those runs may hold a half-edited driver. Neither wrote
  `data/game-differential.json` (still 04:05). **Any artifact from those two starts should be
  discarded and the run repeated** now that the file has settled.
- **`data/diff-team-pool.json` was rebuilt by these runs.** It is a cache, it is gitignored, and it
  keyed to the live store rather than the pinned one when this session started — so the next run
  against a different store pays ~41 s rebuilding it. No measurement is affected.

## Reproduction

Nothing in this report needs `game_differential.js` to be run as a program. The canonical
`plantedStateProof` and `STATE_PLANTS` are exported; the probes required the module with
`process.argv` set to the pinned flags, appended diagnostic rows to the exported table, and wrote no
artifact. Scratchpad scripts for this run: `m0825_stateproof_probe.js`, `m0825_find_n.js`,
`m0825_verify_after.js`.
