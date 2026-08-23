# WIRE 160 — a simultaneous double wipe is not a draw. And Will was right about Perish Song.

2026-08-23. ENGINE. Light mode (Will at the keyboard), so every verification here is a STAGED board;
the heavy runs are listed unrun at the bottom.

Batch 1 only. **Batch 2 (the announce-failure family, ROADMAP #241) was not started** — it needs
`engine/game_differential.js --games`, which is one of the runs banned while the machine is in use.

---

## 1. The rule, read off the authority

```
checkWin(faintData?) {                                              sim/battle.ts:2603
  if (this.sides.every(side => !side.pokemonLeft)) {
    this.win(faintData && this.gen > 4 ? faintData.target.side : null);
    return true;
  }
  for (const side of this.sides) if (!side.foePokemonLeft()) { this.win(side); return true; }
}
```

`faintData` is the LAST entry `faintMessages()` shifted off `faintQueue` (`sim/battle.ts:2546`). So
from Gen 5 on, a board where both sides empty inside one drain is **not a draw** — it is awarded to
the side owning the body that fainted last.

medicham2's `battleResult` resolved an equal live count by total HP fraction and answered 0-against-0
with **0.5**. That function is what every rollout and every H2H reads.

## 2. Will's Perish Song claim — DERIVED, and it HOLDS

> *"similar to perish song where all mons on the field faint on the same turn with nothing in the
> back, the slowest mon wins."*

Three steps, none of them taken on trust:

1. **The condition.** Off `Dex.forFormat('gen9championsvgc2026regmb')` — Champions does not override
   `perishsong`; only six learnset entries mention it:
   `duration: 4`, `onResidualOrder: 24`, `onEnd(target){ this.add('-start', target, 'perish0'); target.faint(); }`.
   No HP is read and no accuracy is rolled.
2. **The order.** `fieldEvent('Residual')` (`sim/battle.ts:~487`) collects every duration-bearing
   handler and calls `this.speedSort(handlers)` — `comparePriority` at `sim/battle.ts:404` is
   **order ASC, priority DESC, SPEED DESC**, and the sort happens *before* the loop decrements each
   duration and calls `end`. So the FASTEST body's counter expires first and the SLOWEST body's last.
3. **The consequence.** All four land in `faintQueue` in that order, `faintMessages` shifts them in
   that order, `faintData` is the slowest, `checkWin` awards its side.

Staged in the raw official simulator (two bodies a side, `team 12`, nothing in the back):

| board | speeds | faint order | `pokemonLeft` | `battle.winner` |
|---|---|---|---|---|
| Gengar+Azumarill vs Politoed+Primarina | 130 / 70 vs 90 / 80 | Gengar -> Politoed -> Primarina -> **Azumarill** | 0 / 0 | **"A"** |
| the same four, sides exchanged | 90 / 80 vs 130 / 70 | Gengar -> Politoed -> Primarina -> **Azumarill** | 0 / 0 | **"B"** |

Exact speed-descending order both times, and the answer follows the slowest body across the swap.
**The claim holds.** It is also the better fixture: nothing here depends on a damage roll deciding
which bodies die, which is the failure mode Explosion's board already records from its first draft.

## 3. What landed

`engine/medicham2-browser.js` — WIRE 160.

- `noteFaint(m)` appended at **all 26** faint sites (every `X.fainted=true` in the file; the one
  skipped receiver is `R.fainted=true`, a result struct, not a body). It stamps a monotone counter
  that is never reset, guarded by a `_fEpoch` bumped once per `battleInit`, so a re-entered dead body
  cannot move its position later than the truth and a body that died before a synthesised rollout
  position was built is excluded from that rollout's answer.
- `battleResult` gains the 0-vs-0 branch: larger last-faint sequence wins. The HP-fraction rule below
  it is untouched — that is the HORIZON rule for a truncated rollout in which both sides still have
  bodies, which is a different question.
- Two counters: `MEDSEEN.doubleWipeDecidedByLastFaint` and, loud, `MEDFAILS.doubleWipeNoFaintOrder`
  for two emptied sides with no comparable order, which still returns 0.5.

`engine/game_differential.js` — `rosterSnapshot` now carries `mediResult` (the engine's own
`battleResult`) and a per-body `faintSeq`. Two additive lines; nothing in the mirror code.

`tests/probe_selfdestruct_winner.js` — `w3-simultaneous` keeps its id and stops being KNOWN-OPEN;
`w4-perish-slowest-on-p1` and `w5-perish-slowest-on-p2` added; every board now played THREE times
(clean, self-KO revert, WIRE 160 revert).

## 4. The measurement

`SHOWDOWN_PATH=... node tests/probe_selfdestruct_winner.js` — **3 boards / 1 KNOWN-OPEN / 0 failing
-> 5 boards / 0 KNOWN-OPEN / 0 failing.**

| board | tied | showdown | medicham `battleResult` | under WIRE 160's revert |
|---|---|---|---|---|
| `w1-user-side-empties-first` | no | "B" | 0 -> p2 | unchanged at p2 — **control holds** |
| `w2-foe-side-empties-first` | no | "A" | 1 -> p1 | unchanged at p1 — **control holds** |
| `w3-simultaneous` | yes | "B" | 0 -> p2 | 0.5 -> draw — **RED PROVEN** |
| `w4-perish-slowest-on-p1` | yes | "A" | 1 -> p1 | 0.5 -> draw — **RED PROVEN** |
| `w5-perish-slowest-on-p2` | yes | "B" | 0 -> p2 | 0.5 -> draw — **RED PROVEN** |

`doubleWipeDecidedByLastFaint` reads exactly 1 on each tied board and 0 on each untied one;
`doubleWipeNoFaintOrder` reads 0 everywhere. medicham2's own stamped order on `w4` is
`p1 [gengar#5 azumarill#8] p2 [politoed#6 primarina#7]` — the authority's order, recovered.

`tied` is DECLARED per board and CHECKED against the authority's `pokemonLeft`, so a fixture that
quietly stopped emptying both sides fails loudly instead of passing while staging nothing.

Releases: **`7da11c1d4d10`** before (1 of 26 files moved since — `engine/medicham2-browser.js`),
**`c66976713feb`** after (medicham2 `c1a3ee451268`).

## 5. The 0.5 was hiding the PREVIOUS pass's result too

On 2026-08-22 `w3` reported the self-KO revert as making no difference to the winner, and that is what
routed the defect to `battleResult` rather than to resolution order. The measurement was right and it
was also blind: while the engine answered `draw` either way, no self-KO position could show up in a
winner comparison at all.

With WIRE 160 wired, `w3` now reports the winner comparison as **DIFFERENT under the self-KO revert**
(`p2` clean, `p1` broken, against the authority's "B"), and the stamped order flips from
`glalie#5 liepard#6` to `liepard#5 glalie#8`. The `always` fix landed on 2026-08-22 has a
winner-level consequence, and only a working win rule can demonstrate it.

## 6. Two probe errors, both found before the engine was

- **`mediVerdict` re-implemented the rule.** Its header said this was because `battleResult` is not
  exported. **It is** — on `module.exports` and on `root`. Left alone, the probe would have gone green
  the moment the PROBE learned about the last faint, with the ENGINE still answering 0.5 to every
  rollout and every H2H. It now asks `M.battleResult(S)` and keeps the body count beside it only so a
  disagreement between the two is visible.
- **The loud-fallback check could never be red.** `doubleWipeNoFaintOrder` lives in `MEDFAILS` and the
  probe's counter delta was built from `MEDSEEN` alone, so it compared `undefined` against 0. Both
  banks are merged now, a key collision throws, and a counter the file asserts on but cannot find
  throws by name.
- **The harness cache keyed on `src.length`.** With two surgical reverts that each delete a block down
  to `;`, two different patched engines could collide on one cache entry. Keyed on the patch's name.

## 7. The ripple, derived by asking what reads the bytes

Stamping `noteFaint` changed the exact text four other files use as a surgical-revert anchor. A miss
there is silent in three of them.

| file | anchors | after |
|---|---|---|
| `tests/test-resolution-order.js` | 2 | re-runs **26 arms, 1 KNOWN-OPEN, 0 failing** |
| `tests/probe_selfdestruct_winner.js` | 1 | 5 boards green |
| `tests/test-perish-song.js` | 1 | 2 rows pass; `--break-the-faint` still turns both RED |
| `tests/probe_red_demo.js` | 1 | FROM string resolves exactly once against the live engine |

Nothing enumerates a mon's keys (`Object.keys` on a body appears nowhere in `engine/`), so the two new
fields reach no comparison. `tests/test-battle-api.js` passes its 8 checks — its `battleResult`
assertion compares the engine against itself and is unaffected. `engine/replay_one.js` reads
`finalRoster` by named field only. **`tests/test-mechanics.js` calls neither `battleResult` nor
`battle()`**, so the census cannot move on this change.

**What DOES move, and it belongs to MEASURE:** any quantity derived from `battleResult` over games
containing a mutual wipe. `engine/rollout_leaf.js:918`, `engine/backtest_winrate.js:249` and every
H2H read it. All of those figures are already quarantined.

## 8. Observed, not fixed

- **The perish-0 death is narrated as damage.** On `w4` the first parted line is
  `sd |-start|p2a: Politoed|perish0` against `me |-damage|p1b: Gengar|0 fnt`. The authority writes
  `-start ... perish0` then calls `faint()`, which emits no damage line; this engine writes a
  `-damage`. Both engines kill the same four bodies in the same order, the boards agree and the winner
  agrees, so this is narration — and it is the announce-failure family (ROADMAP #241), not this wire.
  OBSERVED on one board, not probed.
- **`tests/test-perish-song.js` rides `SB.runOne` with no `arm`.** Its dice are whatever the runner
  defaults to. Both rows pass and the break demo still goes red, so the MECHANIC is not in doubt; the
  ARM is. It is one of the 26 callers `tests/test-roster-arm-pin.js` names as sitting where the roster
  sat. Not touched.
- **A move with no legal target writes `|-fail|`** on the authority and nothing here. Carried over
  from 2026-08-22, still OBSERVED and not probed.

## 9. OWED, NOT RUN — the heavy verification, in order

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node tests/test-mechanics.js                       # regenerate the census; must read >= 630 live
node engine/status.js                                # confirm live did not go down
SHOWDOWN_PATH=... node tests/run-all.js              # the full suite, incl. probe_red_demo.js
node engine/status.js --write                        # restamp the GENERATED blocks
```

Then, and only for batch 2 — **do not read a before/after out of these unless the pool, the census
and the release are all pinned identically**:

```
SHOWDOWN_PATH=... node engine/game_differential.js --games 777 \
  --release c66976713feb --census data/gate-census.pin.json --team-store data/team-pool-frozen
node engine/gate_fail_and_silent.js                  # CANNOT ANSWER until the line above re-runs
```

Nothing in this report rests on any of them.
