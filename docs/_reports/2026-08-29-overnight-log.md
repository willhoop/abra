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

## TWO FINDINGS THAT CHANGE WHAT A NUMBER MEANS

**A COVERAGE LINE THAT CAN NEVER MOVE.** `coverage.js` prints `ranged mechanics fully staged 0 of 8`.
That figure is `hi - lo - 1` read off `tags.json` — **a restatement of the declared range, not a
measurement of anything staged.** It will read 0 of 8 forever, whatever any arm does, until something
writes REACHED counts and `coverage.js` reads those instead. A finish-line row that cannot move is
worse than no row: it looks like work outstanding and no work will ever close it. Route A of
`docs/_reports/2026-08-29-multihit-interior-scope.md` fixes exactly this.

**AN UNDECLARED FILTER IN THE MOVE PRIORS, AND IT REACHES THE EMPIRICAL DRIVER.** Of the three
multi-hit moves that appear in no field anywhere, only ONE is a metagame fact: `tailslap` has 0 human
clicks. `bonerush` (13 clicks) and `doublehit` (8) ARE clicked and are cut by an undeclared
`.slice(0, 8)` at `engine/policy.js:349`. That is a filter, not an absence.

It matters beyond multi-hit: `data/move-priors.json` is what `engine/empirical_driver.js` samples, so
**the empirical arm can never click a move outside each species' top eight.** Every board-material
figure this session rests on a driver with that tail cut off. Not a defect in the fixes; a bound on
what the instrument can reach, and it belongs in the coverage reporting.

**NOT WIDENED, DELIBERATELY.** `move-priors.json` is an `engine_release.js` SOURCE, so regenerating it
moves every release id and is a refit trigger. That is MEASURE's call, not something to slip into an
engine batch overnight.

**AND A CORRECTION TO THE 2026-08-28 MULTI-HIT REPORT.** It said the volley loop sits two levels above
`moveHit`. It does not — `hitStepMoveHitLoop` is a SIBLING of `moveHit`, both below `useMoveInner`, so
running it brings no `-ate` and no accuracy step with it. `dmgRange`'s 7th argument already prices a
rolled count. The volley loop is therefore cheaper than filed: it moves `skipped_multihit` 134 -> 0,
and does NOT move `skipped_ability_multihit` 17.

---

## SEVENTEEN BATCHES — THE FULL LEDGER

Board-parted **135 -> 90** of 961. Census **780 -> 803** live / probed / 0 missing. Every figure below
verified by the coordinator against the named artifact before it was committed.

| batch | what was actually wrong | board-parted |
|---|---|---|
| forced-switch mirror | THE HARNESS. `battleTurn()` is atomic while Showdown stops inside a turn, so the mirror read the END-OF-TURN occupant | 135 -> 117 |
| weight base power | the brackets were right; the weight never followed a forme change | 117 -> 114 |
| pivot redirection | the draw site excluded `kind === "switch"` BY NAME | 114 -> 106 |
| Innards Out | a regex stopped at the INNER bracket, filing the ability under the tag for its own opposite | 106 -> 100 |
| ally Lightning Rod + Wide Guard | two causes, not one -- what they shared was a SENTENCE | 100 -> 97 |
| Safeguard source side | the authority ends on `target !== source` -- identity, not side | 97 (lab only, predicted) |
| Encore bracket | Champions REPLACES the handler mainline leaves alone | 97 (`order_probe` 11 -> 2) |
| shield re-arm | the counter was right; the GATE was armed off a move since replaced | 97 -> 94 |
| default target side | 91 of 500 moves drawn wrong; the ability was innocent | 94 (narration-only) |
| priority modified | a priority-granting ability was absent from all five gates | 94 -> 93 |
| Parting Shot conditional | a third cancelling ability the card did not have | 93 -> 92 |
| the five reds | 3 INSTRUMENT, 1 FIXED, 1 FILED -- one could never have gone green | -- |
| Instruct shield | never asked whether a shield was up | 92 -> 91 |
| Instruct target | 73 of 355 status repeats pinned to foe slot 0 | 91 -> 90 |
| side-vs-target census | all 5 remaining instances are ONE cause; symptom is always SILENCE | 90 (pool cannot see it) |

## WHAT THE NIGHT ACTUALLY TAUGHT

**THE CARDS ARE RELIABLE ABOUT WHERE AND UNRELIABLE ABOUT WHY.** Every single stated cause was wrong;
every symptom was real. Two counts were overstated, two understated, one clause recorded backwards,
and one card (Armor Tail) blamed an ability that was innocent.

**FIVE DEFECTS WERE ONE WRONG BELIEF TYPED IN FIVE PLACES**, in code sharing no function, array or
predicate. Each was found by fixing the previous one, never by a gate — because a bad SELECTOR hands
a CORRECT predicate the wrong body and arrives wearing the predicate's name. An authority-side
enumeration structurally cannot see that; `engine/side_selection_census.js` is engine-side for that
reason, and it catches four spellings the original regex missed.

**THE INSTRUMENT WAS WRONG BEFORE THE ENGINE AT LEAST SIX TIMES**: three roster reds that were the
ruler, a probe reading a field this engine does not have, a control demanding zero announcements from
a shield that genuinely refuses, and a test whose rc 3 was `publish_guard` correctly refusing a shrink
— no engine state could ever have made it green.

**A GENERATOR THAT DIES LOOKS EXACTLY LIKE ONE THAT RAN.** `tag_dex.js` writes at line 9833 of 9854,
so an OOM leaves `data/tags.json` with its old content AND its old mtime. Nothing on disk records the
death. `test-resolution-order` had been rc 134 for days because the wrapper ignored the
`ABRA-HEAP: 6144` the check itself declares; it now reads 26 arms, 0 failing, and was doing more work
than most tests that ran.

**AND ONE COVERAGE FACT THAT BOUNDS EVERYTHING**: both action pickers write targets over the FOES, so
no pooled game has ever aimed a single-target move at a partner — 31,216 aims at a foe, 467 at an ally.
The entire ally-side class is invisible to the pinned pool by construction. Only the lab can see it.
