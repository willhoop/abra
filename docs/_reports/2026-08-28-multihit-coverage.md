# Which multi-hit counts are actually compared — 2026-08-28, ENGINE

Verdict: **the pinned arms compare TWO and FIVE, not two alone. THREE and FOUR are compared by
nothing.** The claim in the brief is half right and the half that is wrong is the better news: the top
corner already reaches the top of the `[2,5]` range, and both engines agree there. **Nothing is
unknown at 5. 3 and 4 are unknown.**

Measured, both engines, one staged turn per corner — `tests/probe_multihit_corners.js`:

```
Icicle Spear, a [2,5] move
  top-tie-first    (CORNER_TOP)      authority 5 hit(s)   medicham2 5 hit(s)
  bottom-tie-first (CORNER_BOTTOM)   authority 2 hit(s)   medicham2 2 hit(s)
```

---

## 1. The exact bound

**Fourteen** multi-hit moves are staged, not nine. Derived from `data/tags.json`, printed before use:

| family | members | counts compared |
|---|---|---|
| **fixed count** — fully covered, not a gap | `doublehit` 2, `dragondarts` 2, `dualwingbeat` 2, `twinbeam` 2, `tripleaxel` 3, `populationbomb` 10 | their only count |
| **`[2,5]`, staged on `top-tie-first`** | `bulletseed`, `iciclespear`, `watershuriken` | **5** |
| **`[2,5]`, staged on `bottom-tie-first`** | `bonerush`, `pinmissile`, `rockblast`, `scaleshot`, `tailslap` | **2** |

All fourteen read `FIRED-AND-BOARDS-MATCH` with empty `diffs` in `data/roster.moves.json`
(`engine_release 5f3f7141227c`, generated 2026-08-28T19:27Z).

**Which instrument.** Only the deliberate roster. The damage differential skips the whole family (§2)
and the whole-game differential draws its `[2,5]` counts through the same two corners, so it adds no
new count. The **middle** arm hashes a shared address per event and could reach 3 and 4 — but it is
opt-in (`--arm middle`), its own header says *"THE MIDDLE ARM IS OPT-IN AND IS NOT PART OF THE DEFAULT
SET"*, and no shipped artifact runs it: `data/roster.moves.json` records `arms_played
{top-tie-first: 825, bottom-tie-first: 264}` and nothing else.

**Skill Link is a second, free route to 5 and it is already wired.** `multihitAlwaysMax` pins the count
to `steps[1]` and deletes `multiaccuracy`; `engine/faces.js:140` stages it by making the subject click
Bullet Seed / Icicle Spear / Rock Blast, and `medicham2-browser.js:12554` implements both clauses off
the tag. It reaches 5 by a different mechanism from the corner, which is worth having.

## 2. Why the damage differential skips them — a declared exclusion, quoted

`tests/test-engine-diff.js:780`:

```js
if (MULTIHIT.has(mvId)) { skippedMulti.n++; skippedMulti.moves[mvId] = (skippedMulti.moves[mvId] || 0) + 1; return null; }
```

It is **not an unexamined `continue`.** The block above it (`:767-779`) states the reason:

> `moveHit` is called ONCE here, so Showdown returns exactly one hit. MEDICHAM's dmgRange returns the
> EXPECTATION over the hit distribution — 3.1 hits for Rock Blast — because it is a pure pricing
> function with no rng. Those are different quantities […] The temptation was to scale Showdown's
> single hit by MEDICHAM's own expected hit count. That is constructing the answer from the thing
> under test […] So: skipped, counted, and printed. tests/test-mechanics.js `multiHit` is the guard on
> the mechanic instead, and it is the ONLY guard.

The membership is DERIVED from the `multiHit` tag, never a name list, and the skip is counted per
move, printed, and carried into the artifact as `skipped_multihit` / `skipped_multihit_moves`.

**The brief's framing that this "sits in a field nobody reads" is REFUTED.** `engine/status.js` already
prints it inside the ENGINE headline, on the line under the 0-of-6000:

```
0/6000 differential comparisons disagree with Showdown
  seed 20260804, requested 6000, 134 not comparable (multihit 134, non-finite 0, threw 0)
```

The 134 are **extra draws, not part of the denominator** — the sampler loops `while (compared < N)` and
a skipped row never increments `compared`, so `0 of 6000` is 6000 compared rows with 134 additional
rows refused. `skipped_ability_multihit 17` (all Parental Bond) is the same decision for the same
reason, under its own counter.

## 3. Is the volley loop reachable from the harness? No — and the reason is two LEVELS, not two lines

The harness enters at `moveHit`. The hit loop is `hitStepMoveHitLoop`, which reads `move.multihit` at
`data/mods/champions/scripts.ts:435-450` and calls `spreadMoveHit` once per hit. `moveHit` calls
`spreadMoveHit` **once** and returns.

To compare a volley the reference would have to enter at `trySpreadMoveHit` or above — and the two
levels above `moveHit` also roll **accuracy** (per-hit, for `multiaccuracy` moves), **PrepareHit**
(which is where Parental Bond sets `move.multihit = 2`), and the `|-hitcount|` emission. The file's own
SKIP FIX 15 block says exactly this:

> this cannot be repaired by moving the reference up two lines, only by moving it up two LEVELS, and
> the two levels above this one also roll accuracy.

**So it is a rewrite of the reference entry point, not a small change** — and it would drag accuracy
into a file whose header says its scope is *"damage only […] Turn order, status duration and switch
behaviour need a different harness and are not attempted here rather than attempted badly."* My
recommendation is that the damage differential keeps its declared exclusion. The gap is real and its
right home is the roster, which already plays whole turns and already reaches two of the four counts.

## 4. Does our engine get the upper counts right? — YES at 5, UNKNOWN at 3 and 4

`tests/probe_multihit_corners.js` stages one turn per corner and reads the count from **both** engines:
the authority's `|-hitcount|` protocol line, and medicham2's `MEDSEEN.multiHitPacketsDealt` (separate
arrivals actually landed, not the plan). Result at the top of this report: **5/5 and 2/2**.

The control is the corner itself: `2 -> 5` across the knob, so neither reading is a constant. That is
the check this repo's own memory insists on — identical results across a varied knob mean the knob is
unwired, and here the knob moves.

**Two fixture traps avoided, and one of them fired first.** The first version gave every foe a single
Protect and clicked it: the volley was shielded, no `|-hitcount|` was ever written, and the probe read
`null` on **both** corners — which is indistinguishable from "the corner does not move the count". The
foes now click **Iron Defence** (self-targeting, 100-accurate, cannot refuse the hit). The probe FAILS
loudly on a null rather than treating it as agreement.

### The mechanism, since it is the whole finding

A `[2,5]` move does not use the range form at all. `data/mods/champions/scripts.ts:436-444`:

```js
if (targetHits[0] === 2 && targetHits[1] === 5) {
  if (this.battle.gen >= 5) {
    targetHits = this.battle.sample([2,2,2,2,2,2,2,3,3,3,3,3,3,3,4,4,4,5,5,5]);
    ...
} else {
  targetHits = this.battle.random(targetHits[0], targetHits[1] + 1);   // <- the RANGE form
}
```

`Battle#sample` is `this.prng.sample(items)`; `PRNG#sample` is `const index = this.random(items.length)`
— the **one-argument** form. `game_differential.js:3357` installs the arm as `battle.prng.random`, so
that draw goes through it, and the arms answer a one-argument `random(m)` with `top ? m - 1 : 0`.
Index 19 of the table is **5**; index 0 is **2**. medicham2's `rollHitsOf` samples the byte-identical
twenty-element table (`MULTIHIT_2_5`, same order) with its own corner, so the two engines land
together — which is *why* the roster rows are green, and it also means the **index -> count mapping
agrees at every index**, including the ones nothing selects.

## 5. The defect this found, and it was the instrument

**`data/roster.moves.json` was publishing a false sentence on all fourteen rows.** Every one read:

> `multihit [2,5] — THE PIN LANDS ON 2 HIT(S), which is the bottom corner of the range and the only
> count either engine can be asked about here`

It was **typed**, not measured: `tests/roster.js` built it from `e.multihit[0]`, the move's declared
minimum. For `bulletseed`, `iciclespear` and `watershuriken` — the three `[2,5]` rows on the top arm —
it named 2 where the engines were really being compared at **5**. The rule's `why` prose said the same
thing, so a reader had two independent-looking statements that were one wrong assumption.

**Fixed at the source.** The note is now derived from the ARM and from which of the authority's two
draws the move takes, and it distinguishes the three cases. Re-run:

```
Icicle Spear  [move/multihit]  multihit [2,5] — THE PIN LANDS ON 5 HIT(S) ON THIS ARM (the AUTHORITY
draws this family with `battle.sample` of a twenty-entry table — a one-argument `random(20)` — which
this arm answers with index 19). The DISTRIBUTION is not under test and cannot be from a pinned die;
the two corners between them reach the two ENDS of a [2,5] range and never its interior
```

still `FIRED-AND-BOARDS-MATCH`. **No engine byte moved for this** — it is a report-string change in
`tests/roster.js` and the verdict is unchanged.

## 6. What closing the remaining gap would cost

The gap is now precisely: **hit counts 3 and 4 of the eight `[2,5]` moves, on a pinned arm.** Three
options, cheapest first:

1. **A third corner-like arm that pins the one-argument `random(m)` to an interior index** — e.g.
   `m >> 1`. It would move `PIN_DIGEST` (a new arm is a new instrument, and `arms_comparable.js` must
   refuse to table it against the corners), and it would change every other one-argument draw too, so
   it is not free.
2. **Run the `middle` arm.** It already reaches 3 and 4 through a shared hashed address and needs no
   new code — but it is a different instrument with its own void rule, and its output is not
   comparable with the corner headline.
3. **A staged roster row per interior count**, driving the count directly. Smallest blast radius and
   the least general.

**None is required for correctness today**, and the reason is worth stating: the two engines read the
SAME twenty-element table at the SAME index, so an index that is never selected cannot disagree unless
one of the two tables changes. The residual risk is a change to `MULTIHIT_2_5` or to the authority's
array; a cheap guard is to assert the two arrays are equal element-for-element rather than to stage
two more counts. That is a one-line probe and I did not write it — it is owed below.

## 7. What was NOT done

- No change to `tests/test-engine-diff.js`. Its exclusion is declared, counted, printed and already in
  the headline; making it run the volley loop is a reference-entry-point rewrite (§3).
- `data/roster.moves.json` was **not** rewritten — the one-row re-runs above were without `--write`.
- The census did not move for this work.

## OWED, NOT RUN

```bash
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown

# 1. republish the moves stage so the fourteen notes stop saying "2 HIT(S)" in the artifact
cmd /c tools\lownode.cmd tests\roster.js --stage moves --reds --write --release 4e5c7b3400de
#    EXPECTED: 475 FIRED-AND-BOARDS-MATCH, 0 DIFFER — unmoved. Only the note strings change.

# 2. the guard this report recommends INSTEAD of staging counts 3 and 4: assert medicham2's
#    MULTIHIT_2_5 is element-for-element the authority's own sample array. Not written.
#    It belongs in tests/test-engine-consistency.js, which already owns "the FACTS agree".

# 3. if the interior is ever wanted for real, the cheapest honest route is the existing middle arm:
cmd /c tools\lownode.cmd engine\game_differential.js --arm middle --release 4e5c7b3400de \
    --team-store data/team-pool-frozen --games 961
#    NOT comparable with the corner headline — a different instrument, its own void rule.
```
