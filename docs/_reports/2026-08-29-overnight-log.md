# Overnight run — 2026-08-29

Will, 2026-08-29: *"Go for it work all night without stopping for my input. Just make a note and move on."*

**This is the running record of what landed, what was routed around, and what is owed.** One file so the
morning is a read rather than a reconstruction. Every figure here was verified by the coordinator
against the artifact named, not relayed from an agent's summary.

## THE SCOREBOARD

The bar is `node engine/coverage.js` complete AND the empirical arm's board-material at zero.

| | start of night | now |
|---|---|---|
| empirical arm, board-material games of 961 | **135** | **106** |
| census live / probed / missing | 780 / 780 / 0 | **788 / 788 / 0** |
| board leaves compared | 33 of 56 | **34 of 56** |
| gate | 8 of 8 on the coverage-seeker | unchanged; re-runs batched |

## LANDED AND PUSHED

| batch | cause | board-material |
|---|---|---|
| **A1/A2** forced-switch mirror | **the harness.** `battleTurn()` is atomic while Showdown stops inside a turn to ask who comes in, so the mirror read MEDICHAM's END-OF-TURN occupant | 135 -> 117 |
| **B1** weight-based base power | the brackets were right; **the weight never followed a forme change**, so a mega was priced off the body that had left the field | 117 -> 114 |
| **C1** pivot redirection | `redirectDrawnTo` was correct; the draw site excluded `kind === 'switch'` **by name**, and a pivot move arrives wearing that kind | 114 -> 106 |
| Metronome item (WIRE 158), Flash Fire (`absorbGift`) | tags derived and correct, nothing read them | census 780 -> 784 |

**THE PATTERN WORTH CARRYING INTO THE CARD REVIEW: the cards have been right about WHERE and wrong
about WHY, three times out of three.** Every stated hypothesis was refuted and every symptom was real.
Read them as locations, not diagnoses.

## FILED, REPRODUCED RED, NOT FIXED

- **#531** — Parting Shot's pivot is unconditional; `data/moves.ts:13179` gates it on the drop landing
  with Mirror Armor as the one named exception. Wrong wherever a drop is refused (Clear Body, White
  Smoke, a target at -6). Board-material: the wrong body holds the slot.
- **C2** — Lightning Rod does not redirect an **ally-side** draw. Foe-side is fine.
- **C3** — Wide Guard does nothing against the user's **own ally's** spread move (identical arms).
- **C6 is a false attribution** — Armor Tail is LIVE (35 -> 0 on the knob), so that card's game has
  another cause. Do not inherit it.
- **H3 narrowed, not closed** — the five Moonblast cards carry no weight shape and their ratios point
  in BOTH directions, so a stale stat stage rather than base power.
- **Ten `wt: null` rows** in `data/engine-data.js`; six land in a different Low Kick bracket from the
  truth. ENGINE does not own that file.

## ROUTED AROUND, NOT SOLVED

- **Every engine fix moves the release, so the gate's clauses go stale after each batch.** Re-running
  the whole gate per fix would cost more than the fixes. **Batched deliberately: one consolidated
  re-run at the end.** The 5-of-8 readings seen between batches are release staleness, not divergence.
- **The differential cannot be re-baselined while an engine fix is in flight**, so batches serialise
  rather than stack. One game-playing agent at a time; derivation jobs run alongside.
- **`data/games.ladder.jsonl` disagrees with its tracked `.gz`** — 5,075 ids in the snapshot only,
  1,264 in the plaintext only, neither a superset. **OPS's, left alone**, recorded here so it is not
  rediscovered.
- **The ingest pushes during the night** and rejected one push. Resolved by rebasing and taking the
  ingest's `data/live.js`; it regenerates that from a newer store.
- **`tests/test-engine-diff.js` has no `--out` flag**, so running it republishes
  `data/engine-diff.json`. Happened once; only `generated` moved, content byte-identical.

## COORDINATOR ERRORS, RECORDED BECAUSE THEY WERE BELIEVED

- Named two Pokemon from memory in an illustration — the exact case CLAUDE.md calls out. Caught by Will.
- Quoted protocol-cause counts of 34 / 4 / 2; the truth is **17 / 2 / 1**. Summed two artifacts without
  noticing.
- Told an agent `publish_guard.js` protects `data/game-differential.json`. **It does not.**
- Said the widening target was 80, then 58. It is **56**.
- Proposed replaying real games; `engine/replay_differential.js` already existed and Will had already
  declined it on 2026-08-13 (ROADMAP #263).

## OWED, NOT RUN

```
node engine/quarantine.js
node engine/status.js --write
node engine/coverage.js
```

Consolidated gate re-run after the last batch, pinned to whatever release is current then:

```
cmd /c tools\lownode.cmd engine\game_differential.js --games 1200 --team-store data/team-pool-frozen --write --out data/verification/game-differential.empirical.json
cmd /c tools\lownode.cmd tests\roster.js --items --abilities --moves --write
cmd /c tools\lownode.cmd engine\all_mechanics_fire.js --write
```

Needs Will, deliberately not attempted: pointing the gate at the empirical arm (a scoreboard change
that will go red), cards H1 and H2, and the search bar (delta / PCS / K).
