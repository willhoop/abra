# The volley collapse — ROADMAP #511, diagnosed 2026-08-28

DIAGNOSIS ONLY. No engine byte was moved. `tests/probe_volley_collapse.js` is the instrument; it
exits **1** and stages four routes plus two controls.

## Lead

**A multi-hit volley into an intact Disguise deals only the busted-forme chip. Arrivals 2..N never
happen. On the staged board Showdown leaves Mimikyu on 58/130 and this engine leaves it on 114/130 —
56 HP, 43% of max, in the defender's favour.** That is damage, not narration.

The `-supereffective` observation that opened the row is the *other* route (Endure) and is
narration-plus-side-effects: HP agrees exactly, five arrivals become one line.

`damage 0/6000 at sixteen corners` is not evidence against this. `data/engine-diff.json` at HEAD
carries `skipped_multihit: 134` across all fourteen multi-hit moves, and the harness calls
`battle.actions.moveHit` once (`tests/test-engine-diff.js:780`, `:648`) rather than
`hitStepMoveHitLoop`. **It has never compared a multi-hit move and it never applies a volley.**

## What collapses, and where

Two *different* mechanisms were found. The row treats them as one.

### Mechanism 1 — the survive-at-1 clamp discards the packet vector

`engine/medicham2-browser.js`, apply step:

    const _packets=(R.pk&&R.pk.length>1&&dmg===R.dmg)?R.pk:null;
    if(!_packets&&R.pk&&R.pk.length>1)MEDSEEN.multiHitPacketsCollapsed++;

`R.dmg` is the price step's total. `dmg` is the apply step's local, and the clamp blocks above it
rewrite `dmg` — Endure (`_sv1`, `oneTurnSurvivalVolatiles`) and the `survivesFromFull` family
(Focus Sash / Focus Band / Sturdy). One rewrite and `dmg !== R.dmg`, so the vector is thrown away and
the click is applied as ONE subtraction. The packet loop owns, and therefore loses:

| lost | site | kind |
|---|---|---|
| `TR.eff` / `TR.crit` per arrival | packet loop | narration — and see below |
| `TR.dmg` per arrival | packet loop | narration |
| `_updateEvent()` between arrivals | packet loop | **board-material** (pinch berry mid-volley) |
| `R.hitLanded` -> `-hitcount` | packet loop | narration |
| `_timesAttacked += _landed` | below the loop | **board-material** (Rage Fist, 712 sheets) |

The effectiveness line is worse than "one instead of five": the price step suppresses its own copy
under `if(TR&&!_multiPk)`, so a collapsed volley emits **zero** effectiveness lines. That is the
observed first divergence `event missing from medicham2 :: -supereffective`.

**The clamp itself is also asked the wrong question.** Endure tests the volley TOTAL against current
HP; the `survivesFromFull` family tests `_arrive`, the FIRST packet. The authority's `onDamage` runs
per hit inside `spreadDamage`. For Endure and for the two `onlyFromFullHP` members the two questions
happen to give the same answer, so HP agrees. **For Focus Band they do not** — `onlyFromFullHP:false`,
`chance:0.1`, so the authority takes a 10% roll on EVERY lethal arrival and this engine takes one roll
only when arrival 1 is lethal, which on a volley it almost never is. Derived from both sources; **not
staged** (the 10% never landed in 240 boards).

### Mechanism 2 — the absorb zeroes the whole click, and nothing re-prices the busted body

`dmgRange`:

    if(formeOnHitAbsorbs(def)){ ... return {min:0,max:0,eff}; }

That is right for arrival 1 and wrong for arrivals 2..N. The authority busts the disguise in
`disguise.onUpdate`, raised by `eachEvent('Update')` **inside** the hit loop
(`data/mods/champions/scripts.ts:538`), so hits 2..N land on Mimikyu-Busted at full damage. Here the
price is 0 for the whole click, the loop substitutes `dmg=_abs.chip` once, and the volley ends.

This one does **not** go through the `dmg===R.dmg` gate at all — `R.pk` is never built, which is why
medicham2 prints `|-hitcount|...|1` on this board rather than nothing.

## The authority, read whole this session

- `data/mods/champions/scripts.ts:428-570` — `hitStepMoveHitLoop`, the Champions override.
  `spreadMoveHit` per hit (`:517`), `eachEvent('Update')` inside the loop (`:538`), `-hitcount` as
  `hit - 1` (`:547-549`).
- `data/moves.ts` `endure.condition.onDamage` — `damage >= target.hp` -> `-activate` + `target.hp - 1`.
- `data/items.ts` `focussash.onDamage` — gated `target.hp === target.maxhp`.
- `data/items.ts` `focusband.onDamage` — `randomChance(1,10) && damage >= target.hp`, no full-HP gate.
- `data/abilities.ts` `disguise.onDamage` / `onUpdate`. Champions overrides none of these four.

## The four routes and the two controls

| route | staged | showdown | medicham2 | verdict |
|---|---|---|---|---|
| **CONTROL A** — same volley, zero clamp reasons | Heracross Bullet Seed -> Avalugg-Hisui | 5 dmg, 5 eff, hitcount 5, 230/340 | identical | **green** |
| **CONTROL B** — Disguise, ONE arrival | Typhlosion-Hisui Eruption -> Mimikyu | activate, 130/130, detailschange, 114/130 | identical | **green** |
| **ENDURE** | Heracross Bullet Seed -> Aurorus | 5 dmg / 5 eff / hitcount 5 / **1 HP** | 1 dmg / **0 eff** / **no hitcount** / **1 HP** | RED x3, HP agrees |
| **DISGUISE** | Heracross Bullet Seed -> Mimikyu | 6 dmg / hitcount 5 / **58 HP** | 2 dmg / hitcount 1 / **114 HP** | RED x3, **HP DIFFERS** |
| **FOCUS BAND** | 240 boards, never activated on the authority | — | — | route live by derivation, not staged |
| **FOCUS SASH** | 40 boards, never spent on a multi-arrival volley | — | — | consistent with "arrival 1 must be lethal at full HP" |

Both controls hold, so what parts is the clamp-plus-volley pair and nothing else.

Every candidate body is scored for how many clamp reasons it carries and any body with a count other
than the one the route wants is refused and named: 120 boards were refused on that rule this run.

## The survive-at-1 / absorb family, derived (not typed)

| member | tag | sheets | gate | multi-hit route |
|---|---|---|---|---|
| Endure | `survivesAnyHit` | 7 | none | live, HP-neutral |
| Focus Band | `survivesFromFull` | 18 | `chance 0.1`, no HP gate | live, **and under-fires** |
| Focus Sash | `survivesFromFull` | 27,081 | `onlyFromFullHP` | near-unreachable |
| Sturdy | `survivesFromFull` | 520 | `onlyFromFullHP` | near-unreachable |
| Disguise | `formeOnHit` | 238 | none at all | **live, and it is the expensive one** |

Ice Face is the other `formeOnHit` shape in Showdown and **has no legal body in this regulation**
(`Dex.forFormat` walk, filtered) — so Disguise/Mimikyu is the whole of that family here.

## Frequency, from the frozen pool

`data/team-pool-frozen`, 17,381 games with sheets / 34,704 team-sides. Games where one side carries a
multi-hit move and the other carries the clamp:

| pairing | games | rate |
|---|---|---|
| multi-hit vs Mimikyu | 43 | 0.25% |
| multi-hit vs Focus Sash | 6,030 | 34.69% (route unreachable) |
| multi-hit vs Sturdy | 115 | 0.66% (route unreachable) |
| multi-hit vs Focus Band | 7 | 0.04% |
| multi-hit vs Endure | 6 | 0.03% |

Deduped corpus: 11,921 teams, **120 carry Mimikyu (1.01%)**, 3,299 carry a multi-hit move (27.7%).

## Predictions, stated BEFORE any run

- **damage 0/6000 — UNMOVED, and structurally so.** All fourteen multi-hit moves are skipped.
- **board-material 0 of 961 — UNMOVED.** An 87-team stride over an 11,921-team corpus at 1.01%
  expects **0.88 Mimikyu teams**; more likely than not the pinned sample holds none.
- **whole-game 1 of 961 — UNMOVED, or +/-1 at most.**
- **roster — UNMOVED.** No roster row stages a clamp against a volley.
- **census — +1** for this probe.

This is the lab-versus-pool split Will ruled on 2026-08-23: a rare mechanic should move the lab and
leave the pool still, and that is said here rather than explained afterwards.

## Not defects

`|-activate|p2a: Aurorus|move: endure` vs `move: Endure`, and `mimikyu-busted` vs `Mimikyu-Busted`:
`M.traceCanon` is the syntactic normaliser and folds case. Do not chase these.

## Did tonight's two multi-hit fixes touch this board?

Yes, one of them, and only the narration. The single-arrival `-hitcount` fix is why the Disguise board
now prints `|-hitcount|p2a: Mimikyu|1`; before it, that line was absent. It did not move HP. The
per-arrival crit fix cannot show on either board (`-crit` reads 0 on both sides in both routes).

## THE PATCH, NOT APPLIED

Anchor on the CODE, not on a line number — `engine/medicham2-browser.js` is dirty with another
agent's work tonight.

### Patch B — Disguise. Two sites. Do this one first; it is the only one that moves damage.

1. `dmgRange`, the `if(formeOnHitAbsorbs(def))` branch. Today it returns `{min:0,max:0,eff}` for the
   whole click. It should answer for **arrival 1 only**: price the move normally, then zero
   `packets[0]` (and the whole answer when the plan has one arrival, which is today's behaviour and
   is exactly what CONTROL B proves is byte-correct).
2. The apply step's absorb block (`const _abs=formeOnHitAbsorbs(tg)`). Today it sets `dmg=_abs.chip`
   once, above the packet loop. It should fire **between arrival 0 and arrival 1** — the seam already
   exists, because the between-arrival `_updateEvent()` landed on 2026-08-27 and
   `disguise.onUpdate` is precisely what the authority raises there.

`sameStats`/`sameTypes` are both true on the Disguise tag, so arrivals 2..N need no re-derivation of
stats or types and the price is unchanged. That is what makes B cheap. It would NOT hold for a member
with `sameStats:false` — Ice Face — which has no legal body here, so the branch must stay counted
(`MEDFAILS.formeOnHitNoRow`) rather than assumed.

### Patch A — the survive-at-1 clamp, per arrival. Two shapes; pick one.

**A1, correct.** Move both clamp blocks (`_sv1` Endure, and the `_arrive`/`survivesFromFull` block)
INSIDE `for(let i=0;i<_packets.length;i++)`, testing `_packets[i]` against `tg.curHP` at that moment —
literally where `onDamage` runs in the authority. Then `dmg===R.dmg` stops being a gate and the
`_packets=null` line can go. This also repairs Focus Band's missing chances for free, because the
`rng()` draw moves inside the loop, which is the authority's `randomChance(1,10)` per damage event.

  Cost of A1 is not in the two blocks. It is in `dealt`, `_dealtEach`, `_rowDealt`, `_reDealt` and
  `_payDrainRow`: `_reDealt`'s own header says `damage[i]` is the input to the recoil and the drain,
  and under a per-arrival clamp there are N of them. And the extra `rng()` draws **will move the pin
  digest** — predict that before the run, do not discover it.

**A2, cheap.** Keep the clamps where they are, but instead of discarding the vector, remove the
deficit `R.dmg - dmg` from the TAIL of `_packets` (last arrival first). That is where the authority
removes it, because the clamp fires on the arrival that would be lethal, which is the last one that
lands. Arrivals 1..k-1 stay exact; only arrival k is rewritten. It is an approximation when two
arrivals are both clamped (an Endure body already on 1 HP), and that case must be COUNTED, not
smeared. A2 gets the narration, the `-hitcount`, the between-arrival Update pass and `_timesAttacked`
right, and leaves Focus Band's missing chances open as a named, separate row.

## COST ESTIMATE

| item | estimate | why |
|---|---|---|
| **Patch B (Disguise)** | **3-5 hours**, one session | two edit sites; the between-arrival seam already exists; CONTROL B pins the one-arrival path so a regression cannot hide; probe already written |
| **Patch A2 (tail rescale)** | **2-3 hours** | one expression plus a counter for the two-clamp case; no RNG movement, so the pin digest holds |
| **Patch A1 (per-arrival clamp)** | **1-2 sessions** | touches the recoil/drain accounting and adds RNG draws; the pin digest moves on purpose and every downstream pinned figure re-baselines |
| **Focus Band's missing chances** | folded into A1, or **1-2 hours** standalone | one `rng()` per lethal arrival; needs a pinned-chance fixture to stage at all |

**Recommended order and total: B, then A2 — one session, about half a day, for the whole of the
board-material half.** A1 only if the narration gate demands per-arrival `-activate` lines.

The reason B is small and A1 is large is worth stating plainly: B changes WHAT IS PRICED and the
application machinery already handles it; A changes WHEN THE HP MOVES and five accounting variables
are downstream of that.

## OWED, NOT RUN

Nothing was run that this brief forbade. Not run, and owed before any of this is called landed:

- `node tests/test-mechanics.js` — the census. Owed by whoever lands a patch, not by this diagnosis.
- `game_differential.js`, the three roster stages, `all_mechanics_fire.js`, `quarantine.js`,
  `status.js` — all withheld: three other agents were running and one held the game slot.
- **Focus Band was never staged.** Its route is asserted from two source reads and from the shape of
  the engine's single-draw gate. It needs a pinned-chance fixture before it is called a defect.
- **The `_timesAttacked` / Rage Fist consequence was reasoned, not measured.** A second-turn Rage Fist
  after an endured volley would show it as a damage number; that board was not staged.
- **The pinch-berry-under-Endure consequence was reasoned, not measured.** Same shape as the
  2026-08-27 Scale Shot / Sitrus finding, one rung worse because the collapse removes every
  between-arrival pass rather than moving one.
