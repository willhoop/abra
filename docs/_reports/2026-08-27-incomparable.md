# The Outrage re-target is NOT incomparable — the premise's accounting holds and its mechanism does not

MEASURE, 2026-08-27. Release `6272fa445b73`, artifact `data/game-differential.json` generated
2026-08-27T03:43:57Z, mode `A/middle/pins:2efbc9ed1946/credit:observed-effect/v1/nature:real`,
961 games. Read from `git show HEAD:data/game-differential.json` — the working copy was verified
byte-identical to HEAD before and after.

---

## VERDICT

**The void accounting in the brief is exactly right. The `INCOMPARABLE` claim is exactly wrong, and it
is wrong by the same mechanism that withdrew Moody two days ago.** No row was written.

- The arm **did** void that game: `mid_void.by_reason['low-identity'] = 1`,
  `by_reason_detail['low-identity'] = {games: 1, diverged: 1}`, `void_games 1`, `usable_games 960`,
  `diverged_among_usable 17`. **18 raw − 5 declared = 13 = 12 usable + 1 void.** Confirmed.
- Every unshared address in the whole run is an Outrage one — `unshared_address_field` is
  `target differs (acc|outrage)`, `(crit|outrage)`, `(dmg|outrage)` and `turn differs` on the same
  three, one each — and those counters are bumped **only** inside the low-identity branch
  (`engine/game_differential.js:945-975`), so they describe that one game and nothing else. Exactly one
  of the 18 `first_divergences` mentions Outrage. The identification is sound.
- **But the authority's target draw is on a stream this harness shares**, so the two engines do not
  disagree by construction. They disagree because our address is wrong.

**The clause reads 13 of 961 before and 13 of 961 after. Board-material is 4 of 961 before and after.
Nothing moved, and that is the result.** `git diff engine/medicham2-browser.js` is empty;
`data/game-differential.json` is unmodified against HEAD.

---

## 1. THE PREMISE, CHECKED

| claim in the brief | verdict |
|---|---|
| the arm excludes target selection from the shared die by design at `game_differential.js:919` | **TRUE of the identity CHECK.** `const OUT = new Set(['acc','crit','sec','dmg','stall'])` keeps `any` out of the overlap computation, and `midWrapShowdown` names a category only inside `hitStepAccuracy` / `secondaries` / `getDamage` (`:1023-1025`), so a target draw is `any` by construction. |
| the arm had already voided that game | **TRUE.** `low-identity: 1`, `diverged 1`, all unshared addresses `outrage`. |
| `13 = 12 usable + 1 void` | **TRUE.** `diverged 18`, `diverged_among_usable 17`, declared 5, and none of the 5 declared is the void game. |
| therefore `INCOMPARABLE` — no defect, nothing to fix | **FALSE.** See §2. |

**Excluded from the check is not the same claim as unshared.** That is the whole distinction the Moody
withdrawal turns on, and it is the one the premise slides across.

## 2. THE MECHANISM, TRACED RATHER THAN ASSUMED

The divergence is
`-damage: a different body :: |-damage|p2a|H/H <> |-damage|p2b|H/H`, seed pair
`...2635122796 vs ...2634861011`, turn 2, after `|move|p1b: Garchomp|Outrage|p2a: Staraptor`.
Showdown hit p2a Staraptor; medicham2 hit p2b Incineroar.

Outrage's target is `randomNormal` — DERIVED:
`Dex.forFormat('gen9championsvgc2026regmb').moves.get('outrage').target` → `randomNormal`.

**The authority's draw:**

- `sim/battle.ts:2461` gates the named-target branch OFF for `randomNormal`, falling to
  `:2484 return this.getRandomTarget(pokemon, move)`
- → `sim/side.ts:367 randomFoe()` → `this.battle.sample(actives)`
- → `sim/prng.ts:136 const index = this.random(items.length)`
- `this` there is the **PRNG**, and `battle.prng.random` **is replaced** at
  `engine/game_differential.js:3009` → `pinRandom` → `midDraw('any')` →
  `midCtx([MID_SEED, turn, cat, move, target])` at `:1072`, hashed by `midValue` at `:791`,
  `MID_SEED = 20260813` at `:783`.

**medicham2's draw:**

- WIRE 144, `engine/medicham2-browser.js:20043`, fires on any move tagged `randomTarget`
- `:20046 const _rt = _rlive[Math.floor(rng()*_rlive.length)%_rlive.length]`, where `rng` is the
  **generic `any` stream** (`rngStreams` passes a `midEventDice` struct straight through, `:18277-18282`)
- addressed by `midEventBase` at `:18411`, `MID_EVENT_SEED = 20260813` at `:18333`, the same FNV-1a.

**One stream, one seed constant, one hash — and the index mapping matches too.** `pinRandom(2)` returns
`Math.floor(u*2)`; medicham2 computes `Math.floor(u*2)`; `side.foes()` is `foe.allies()` in position
order, alive-filtered, and `live(actB)` is the same order. **If the addresses matched, the two engines
would pick the same body deterministically.**

### What actually differs is the address, and it is ours

Showdown resolves the target on the first working line of `runMove` —
`sim/battle-actions.ts:223 getTarget(...)` — which is **above** `setActiveMove` at `:245`, with
`battle.activeMove` and `battle.activeTarget` still nulled by the previous action's
`clearActiveMove()` at `sim/battle.ts:2828`. medicham2 writes `MID_MOVE`/`MID_TGT` at `:19878-19880`,
**above** the WIRE 144 draw at `:20043`.

```
  authority     20260813|2|any|-|-|0
  this engine   20260813|2|any|outrage|p20|0
```

That is byte for byte the diagram in the Moody withdrawal note in `quarantine.js` and in
`medicham2-browser.js:18349`. `midClearActiveMove()` exists at `:19800` and fixes exactly this class —
it just runs **before** the write at `:19878`, so it cannot reach a draw taken after it.

### Why the consequence is what surfaced

The target draw itself is `any` and is never compared. What voided the game is the **downstream**
`acc`/`crit`/`dmg` addresses — which ARE in `OUT` — carrying different `target` fields once the two
engines were hitting different bodies. Overlap fell under `MID_OVERLAP_FLOOR = 0.90` and the arm
voided. The instrument saw the symptom because the check declines to look at the cause.

## 3. WHAT THE REFUSAL COSTS, PRICED

A matcher anchored to the exact cause takes **exactly one game** — the brief's stop-condition is met
and the rule is not wider than the evidence:

```
MATCHER TAKES  1 game(s):
   1  -damage: a different body :: |-damage|p2a|H/H <> |-damage|p2b|H/H

raw diverged      18 of 961
declared today    5 (Supreme Overlord)  -> clause prints 13
if declared       6                     -> clause would print 12

board-material today       4 of 961
board-material if declared 3 of 961
```

**Re-derived under the corrected comparator.** The read-only pass said "2 → 1"; that was the
pre-re-baseline scale. The correct counterfactual is **4 → 3**. Do not carry the older pair.

The game is `DIFFERENT-END-STATE`, board parts at turn 2, and is one of only four board-material games
in the run — so this declaration would have been the single most expensive one available.

**A loose matcher would also have crossed clauses.** `data/all-mechanics-fire.json` (same release) holds
two `switch: a different body` causes — `bittermalice`/Zoroark-Hisui and `nightdaze`/Zoroark, both
Illusion. A matcher written as "a different body" instead of the anchored form would have subtracted
those from the mechanics clause as well, on a declaration about Outrage.

## 4. WHY A VOIDED GAME REACHES THE CLAUSE — STRUCTURAL, NOT ONE LINE

`wholeGameClause` reads `j.diverged` (18) over `j.games` (961). The arm's own comment
(`game_differential.js:858-861`) says a voided game's divergence "is the instrument's, not the
engine's". So the clause publishes 13 where the arm's own accounting supports 12.

The obvious one-line fix — read `mid_void.diverged_among_usable` (17) and `usable_games` (960) — **is
wrong, and this batch is the proof.** `declaredGames` and `impactGames` are accumulated by **cause
attribution** over `j.classes[].causes[].n`, which still counts the void game. Mixing a count-based
numerator with an attribution-based subtraction double-subtracts whenever the void game's cause is
itself declared:

| scenario | clause with the one-line fix | truth |
|---|---|---|
| today (void game undeclared) | 17 − 5 = **12** | 12 ✓ |
| had the Outrage row been written | 17 − 6 = **11** | 12 ✗ |

Off by one, **in the direction that makes the gate look greener** — which is the merged-number failure
this file has already paid for twice.

**The repair belongs in the writer, not the clause.** `data/game-differential.json` records a *count* of
void games and never records *which cause* the void game diverged on. One extra field on
`classes[].causes[]` (a `void_n` beside `n`) makes the exclusion attributable and the clause's split
internally consistent. That is `engine/game_differential.js`, which MEASURE does not own in this batch.
**Filed as ROADMAP #467, not patched.**

## 5. WHAT WAS LANDED

- `engine/quarantine.js` — a **refusal comment** at the head of `DECLARED_DIVERGENCE`, in the same shape
  as the withdrawn Moody, speed-tie and drag rows. No row, no subtraction. It cites the seven lines that
  make the draw shared and states what would falsify the refusal: print both engines' `any` address logs
  for this seed pair at turn 2; if the authority carries a move/target field medicham2 cannot construct,
  or the foe lists are ordered differently, the row may be written.
- Clause verified byte-identical before and after (1,810 bytes of `--whole-game` output both times,
  exit 1 both times). `--selftest`: **109 passed, 0 failed**.
- ROADMAP #467, CHANGELOG 5.154.0, `docs/MEDICHAM-SPRINT-NOTES.md`.

## 6. A CORRECTION TO A LIVE DOCUMENT

`docs/MEDICHAM-SPRINT-NOTES.md` (2026-08-26, #465) calls this game "a genuine spread-target
divergence". It is not a spread move. Outrage is `randomNormal` and the divergence is its **execution-time
re-target**, drawn once. The corrected sentence is in the new row.

---

## OWED, NOT RUN

- **The engine repair itself.** Addressing the WIRE 144 `randomTarget` re-roll where the authority takes
  it — with `MID_MOVE`/`MID_TGT` cleared, matching `clearActiveMove()` — is ENGINE's, in
  `engine/medicham2-browser.js`, which this batch may not touch. Predicted effect: whole-game 13 → 12,
  board-material 4 → 3, **by a fix rather than by an exemption**. Not measured.
- **The `MEDI_*` positive control for it.** Every fix of this class in this engine ships a knob that
  restores the leak (`MEDI_ACTIVE_MOVE_STICKY`, `MEDI_RESIDUAL_COLLAPSE`). None exists for the
  `randomTarget` address. Owed with the fix, not before it.
- **The void-attribution field** (`classes[].causes[].void_n`) in `engine/game_differential.js`, and the
  clause change that consumes it. ROADMAP #467. Neither written nor measured.
- **A direct read of the two `any` address logs for `...2635122796 vs ...2634861011` at turn 2.** The
  mechanism above is traced from source on both sides and from the artifact's own void counters; it is
  **not** confirmed by printing the two strings. `midAddresses()` and `midEventLog()` both exist and
  would settle it in one run. Not run — this agent may not play a game.
- **No re-run of the differential, the roster, the census or `all_mechanics_fire.js`.** Nothing this
  batch touched can change any of them: the only code change is a comment.
- **No re-baseline.** `data/whole-game-baseline.json` is untouched and still reads 18 of 961 = 1.9% under
  this pin.
