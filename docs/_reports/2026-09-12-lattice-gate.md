# THE WHOLE-GAME GATE NOW READS THREE TEAM LATTICES, AND IT CLOSES

2026-09-12, MEASURE. A findings record, not a living document; it is superseded by the register rows
it feeds (ROADMAP #619) and is never quoted as current state.

Decision delegated by Will ("u tell me") on the finding in `docs/_reports/2026-09-12-wide-sample.md`:
the whole-game clauses must stop certifying one team lattice. Implemented here.

---

## 0. VERDICT

`node engine/quarantine.js`, release `bc8d7cf849dd`, after this change:

```
  GATE: CLOSED — 1 of 8 GATING clauses fail
    FAIL  whole-game differential / BOARD-MATERIAL — games whose boards part, on EVERY team lattice BOARD-MATERIAL: NON-ZERO ON 2 OF 3 LATTICES — --games 1200: 0 of 961 [pool 0d103fb9fa87]; --games 1350: 9 of 1069 [pool 7e7a37ded7fc]; --games 1950: 21 of 1497 [pool a5ce76242f8d]. A single sample reading zero does not open this clause; every lattice must.
    RPRT  whole-game differential / NARRATION — protocol divergence with no board effect, on EVERY team lattice NARRATION-ONLY: NON-ZERO ON 2 OF 3 LATTICES — --games 1200: 0 of 961 [pool 0d103fb9fa87]; --games 1350: 12 of 1069 [pool 7e7a37ded7fc]; --games 1950: 25 of 1497 [pool a5ce76242f8d]. A single sample reading zero does not open this clause; every lattice must.
```

(Copied from the printed report, cut at the end of each clause's first sentence group; the report
collapses the clause's newlines to spaces.)

**THE CONTROL.** `wholeGameClause()` — the single-sample clause the gate called until this change —
still reads `ok: true`, `0 of 961`, on the identical `data/game-differential.json`. Same release, same
artifact, same function underneath; the only thing that moved the verdict is that the gate now also
reads `--games 1350` and `--games 1950`.

Before this change, on the same release, the gate read `GATE: OPEN — MEDICHAM passes both conditions`
(`docs/_reports/2026-09-12-wide-sample.md` §5).

---

## 1. THE SAMPLE SET, AND WHY — FIXED BEFORE ANY OF THE THREE WAS RUN

`diff_swarm.buildSwarm(--games * 2)` strides each configuration's matching team list at
`step = floor(matching / floor(2·games / 9))`, and `pairsFor` pairs adjacent picks. The set was chosen
by walking the SHIPPING `buildSwarm` on `data/team-pool-frozen` for every `--games` from 1250 to 3000
in steps of 50, counting (config, team) picks shared with the 1200 and 1350 lattices. Excerpt:

| `--games` | picks | shared with 1200 | shared with 1350 | in neither | % new |
|---|---|---|---|---|---|
| 1250 | 2045 | 958 | 745 | 1013 | 49.5 |
| 1400 | 2283 | 787 | 1631 | 619 | 27.1 |
| 1650 | 2667 | 653 | 642 | 1885 | 70.7 |
| **1950** | **3069** | **669** | **713** | **2212** | **72.1** |
| 2200 | 3399 | 1114 | 819 | 2092 | 61.5 |
| **2400** | 3669 | **1631** | 851 | 1863 | 50.8 |
| 3000 | 4467 | 842 | 879 | 3369 | 75.4 |

- **1200** stays: it is the published sample and the control.
- **1350** is the value that exposed the defect; 773 of its 2,206 picks are shared with 1200.
- **2400, the obvious "larger draw", is a bad one**: exactly 2x the stride size re-picks 1,631 of
  1200's 1,968 teams (83%).
- **1950** is new on 72.1% of its picks for ~1.6x the games of 1200. 3000 buys 75.4% for ~2.3x;
  the extra 3 points are not worth the minutes.

**Played-game overlap, measured afterwards off `MEDI_SAMPLE_DUMP` (observational), not predicted:**

| pair | matchups shared | (config, team) shared |
|---|---|---|
| 1200 vs 1350 | 309 of 961 / 1069 | 751 |
| 1200 vs 1950 | 181 of 961 / 1497 | 670 |
| 1350 vs 1950 | 199 of 1069 / 1497 | 726 |

3,019 distinct matchups across the three (3,527 games played). **Every one of the 30 board-material
games is in a matchup only its own lattice plays** — none is in a shared matchup, which is what
determinism predicts (a shared matchup replays the same game) and is the direct evidence that the
lattice, not noise, decides what the gate sees.

---

## 2. THE SAMPLES — RELEASE `bc8d7cf849dd`, EVERY PIN IDENTICAL EXCEPT `--games`

Command for each, via `tools\lownode.cmd`:
`engine/game_differential.js --steering empirical --release bc8d7cf849dd --arm middle --end-state --census data/mechanics-census.json --team-store data/team-pool-frozen --games <N> --write --out <path>`
(turn cap 50, the default).

| `--games` | artifact | played | board-material | protocol | narration-only raw | boundaries identical | pool | wall min |
|---|---|---|---|---|---|---|---|---|
| 1200 | `data/game-differential.json` | 961 | **0** | 0 | 0 | 10705 / 10705 | `0d103fb9fa87` | 3.54 |
| 1350 | `data/game-differential.g1350.json` | 1069 | **9** | 22 | 13 | 11819 / 11842 | `7e7a37ded7fc` | 2.98 |
| 1950 | `data/game-differential.g1950.json` | 1497 | **21** | 45 | 27 | 16614 / 16702 | `a5ce76242f8d` | 5.34 |

Common to all three: census digest `632a699468ca` (pinned, matches live), mode
`A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real`, driver code `3c9cef36c7c5`,
`driver_code_stable: true`, `tags_release_matches_live: true`, planted state proof and mappings both
true, void 0. `threw` 1 / 1 / 2 (harness choice rejections, recorded in `errors`).

**The 1200 re-run reproduces the artifact it replaced** (HEAD `data/game-differential.json`, generated
14:09Z on the same release): 961 / 961, pool `0d103fb9fa87`, 10,705 of 10,705. The one instrument edit
in this pass (below) did not move the sample.

**COST.** 1350 and 1950 ran concurrently, 1200 after 1350 finished, so the wall figures overlap and are
an upper bound on serial cost: **~12 minutes for the three** against 4.4 for the old single sample.
Reading the gate is unchanged (`engine/quarantine.js` 0.26 min).

**The 1350 lattice read 10 on release `8ad1ab5e1f86` and reads 9 here** — consistent with the two
fixes cut into `bc8d7cf849dd`, not attributed game by game.

### What the 30 look like (`state.first_board_divergences`, which is capped at 40, so here it is all 30)

- HP only: 1350 ×6, 1950 ×7 — Torkoal `39|16` again (the Grav Apple lead from the wide-sample report).
- Kingambit `boosts.atk 0|2` (Defiant lead) on 1350; Kangaskhan faints here and not on the authority.
- Sleep/status: 1350 Trevenant `slp|""`; 1950 Umbreon/Hatterene sleep on opposite bodies; Scovillain psn.
- Ability identity on 1950: Palafin `mummy|zerotohero`, Alakazam `toughclaws|competitive`.
- `vol.allyswitch 1|0` ×2 (1950, both uncaused by protocol), `vol.confusion`, `vol.disable 0|3`, a PP.
- **`vol.charge 1|0` on 1950, `pair-redirect-priority` turn 6** — the Electric bank the 6.45.0 fix
  addressed is not fully closed. A lead for ENGINE, not a diagnosis.

---

## 3. THE CHANGE

### `engine/quarantine.js`

- `LATTICE_SAMPLES` = 1200 → `data/game-differential.json`, 1350 → `data/game-differential.g1350.json`,
  1950 → `data/game-differential.g1950.json`.
- `wholeGameLatticeClause()` / `narrationLatticeClause()` call the unchanged per-sample
  `wholeGameClause` / `narrationClause` on each and aggregate. `medichamIsCorrect`, `--whole-game` and
  `--narration` now call the lattice versions. The per-sample functions stay exported (tests use them).
- A sample is **CANNOT-ANSWER** when: missing; `games_requested` absent or not its slot; withheld by
  the existing door (stale release, digests, population, planted proofs); or when the answering samples
  disagree on release, policy, census digest, pinned pool, mode, cap, end-state mode or stop rule; or
  the pool is unpinned; or two slots share a `team_pool_digest`.
- **Exit 1 if ANY sample is non-zero** — even beside a missing one; exit 2 only when nothing non-zero
  was read; exit 0 only on zero on all three, coherent.
- Narration `gates` is the BOARD LATTICE verdict; each per-sample narration verdict is handed the lattice
  board clause so no sample's sentence claims to hold the gate on its own zero.

### `engine/game_differential.js` (instrument, not in `engine_release.SOURCES`)

Stamps `games_requested`, `swarm_size_requested` and `until_covered` at the top of the artifact. It
changes no die, click or pick; driver code digest moved to `3c9cef36c7c5` and all three samples share it.

### Selftest — `node engine/quarantine.js --selftest`: 279 passed, 0 failed

Twelve new `LATTICE` arms driving the shipping functions on injected samples: all zero → OPEN (exit 0);
one non-zero → CLOSED (exit 1) **with the single-sample control reading zero on the same set**;
gateVerdict shuts; missing → CANNOT-ANSWER (exit 2); wrong `games_requested`; unstamped; stale release;
same lattice twice; census split; unpinned pool; non-zero beside missing → exit 1; narration gates only
on the board lattice.

**Red before trusted:** with `wholeGameLatticeClause` reduced to
`wholeGameClause(inject['1200'])` — the old reading — the selftest read **267 passed, 12 failed**, every
`LATTICE` arm red. Restored and re-run green.

### Other checks run

`tests/test-divergence-composition.js` exit 0; `tests/test-provenance-discovery.js` exit 0;
`tests/test-register-cell-parse.js` exit 0; `engine/quarantine.js --check` clean;
`engine/provenance.js` (via lownode) exit 0 with all three samples `ok`.
`tests/test-web-quarantine-loaders.js` and `tests/test-web-status.js` exit 1 — both on Will's
2026-09-09 waiver list, and the loaders one fails because the committed web bundle predates the gate
closing, which is the expected consequence, not a new defect.

---

## 4. WHAT THIS DOES TO THE REGISTER — OWED, NOT DONE

Six CLOSED rows name `node engine/quarantine.js --whole-game` as their VERIFIED BY: **#218, #301, #314,
#315, #439, #542.** That command now exits 1, so the next full `node engine/register_reality.js`
sweep will read them **PREMATURE CLOSE** (confirmed on #439 with `--only 439`, which writes nothing).
`data/register-reality.json` was NOT regenerated in this pass. Not every one of those closures is
wrong — #218 ("gates nothing") is a row the red exit confirms rather than contradicts — but none of
them can rest on `0 of 961` any more, and #439's cell cites exactly that figure. Each needs its own
instrument or a re-read against the lattice; that is register work for whoever owns each row.

---

## 5. WHAT THIS PASS LEFT IN THE TREE

- `engine/quarantine.js`, `engine/game_differential.js` — edited as above.
- `data/game-differential.json` — rewritten, `--games 1200`, same figures as before plus the stamp.
- `data/game-differential.g1350.json`, `data/game-differential.g1950.json` — new.
- `engine/tag_dex.js` / `data/tags.json` uncommitted changes of unknown origin: not touched;
  every sample records `tags_release_matches_live: true`, so the runs were not affected by them.
- Scratch (outside the tree): launchers, logs, sample dumps.
