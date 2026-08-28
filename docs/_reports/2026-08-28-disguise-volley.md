# The absorb answers arrival ONE — ROADMAP #526, landed 2026-08-28

Release `0415c53255a9`. Probe `tests/probe_volley_collapse.js`, census row
`ability / formeOnHit / a MULTI-HIT volley into an intact Disguise loses arrival ONE and lands the rest`.

## Lead

**On the staged board the authority leaves Mimikyu on 58/130 and this engine now leaves it on
58/130.** Before the fix we left it on 114/130 — 56 HP, 43% of its maximum, in the defender's
favour. `|-hitcount|` read 1 against the authority's 5 and the volley emitted 2 `-damage` lines
against 6; all three rows are green, line for line.

**board-material 0 of 961 — UNMOVED, as predicted.**

## The scoreboard

Pinned identically to the run it replaces — `--arm middle --turns 12 --games 1200
--team-store data/team-pool-frozen --census data/verification/census-pin-9446a684709d.json
--state --end-state --write`, release `0415c53255a9`.

| quantity | before | after | predicted |
|---|---|---|---|
| **the staged Disguise board** | showdown 58/130, we **114/130** | **58/130 both sides** | the point of the patch — **hit** |
| **board-material** (`games - games_board_never_diverged`) | 0 of 961 | **0 of 961** | unmoved — **hit** |
| whole-game clause | 1 of 961 (6 raw, less 5 declared) | **1 of 961 (6 raw, less 5 declared)** | unmoved or ±1 — **hit** |
| turn-1 boards identical | 961/961 | **961/961** | unmoved — hit |
| census | 778 / 778 / 0 | **779 / 779 / 0** | +1 — **hit** |
| roster items / abilities / moves | 139 / 129 / 475 | **identical**, 0 DIFFER, 0 DID-NOT-FIRE | unmoved — **hit** |
| roster red demonstrations | 18/18, 29/29, 35/35 | **18/18, 29/29, 35/35** | unmoved — hit |
| `test-engine-diff --n 6000` | 0 of 6000, sixteen corners | **0 of 6000, sixteen corners** | unmoved *and structurally blind* — **hit** |
| `all_mechanics_fire --kind all` | 5 diverging mechanics | **the same 5**, zero rows changed verdict | unmoved — hit |
| PIN digest | `ccb365985023`, DICE_MODEL v5 | **`ccb365985023`, v5** | unmoved — hit |
| gate clauses | 7 of 8 PASS | **7 of 8 PASS** | unmoved — hit |

**`damage 0/6000` IS NOT EVIDENCE THIS PATCH IS SAFE AND IS NOT PRESENTED AS ANY.** `data/engine-diff.json`
carries `skipped_multihit: 134` across **all fourteen** multi-hit moves in this format
(`dualwingbeat 48, rockblast 25, pinmissile 13, tripleaxel 13, bulletseed 11, populationbomb 7,
twinbeam 5, iciclespear 5, watershuriken 3, scaleshot 2, dragondarts 2`) plus
`skipped_ability_multihit: 17` for Parental Bond, and its harness calls `battle.actions.moveHit`
once rather than `hitStepMoveHitLoop`. **It has never applied a volley.** It was re-run because an
attack-price change reaches damage, and it says only that nothing else moved.

The evidence for this patch is the probe and the census row, both of which stage the volley.

## What was wrong, and where

Two edit sites in `engine/medicham2-browser.js`.

**1. `dmgRangeOneHit` answered zero for the whole click.** `if(formeOnHitAbsorbs(def)) return {min:0,max:0,eff}`
is right for arrival 1 and wrong for arrivals 2..N. The authority busts the disguise in
`disguise.onUpdate`, raised by `eachEvent('Update')` **inside** the hit loop
(`data/mods/champions/scripts.ts:538`), so hits 2..N land on Mimikyu-Busted at full damage. The
branch is now gated on a new eleventh parameter `absBypass`, which `dmgRange` sets when
`_plan.total > 1`; `dmgRange` then zeroes `hit.packets[0]` (min, max and its sixteen-entry band) and
returns `(n-1)/n` of the price.

**The question is asked at `dmgRange` and not at `dmgRangeOneHit` for a reason:** on the FLAT road the
callee is handed the whole hit count in one call and cannot see an arrival boundary at all.

**2. The apply step substituted the chip above the packet loop.** `dmg=_abs.chip` ran once, before the
arrivals, so there was nothing left for the loop to deal. The bust — the `detailschange` and the
`baseMaxhp/8` chip — is now a closure fired at the **between-arrival Update seam** that landed on
2026-08-27, which is exactly where the authority raises it. The `-activate` stays above the loop
(the authority writes it from `onDamage`, before arrival 1's `-damage`), and arrival 1's own
zero-damage `-damage` line at unchanged HP is emitted by the packet loop like every other arrival.

`sameStats` and `sameTypes` are both true on the Disguise tag, so arrivals 2..N need no
re-derivation. `MEDFAILS.formeOnHitNoRow` still counts a member for which that would not hold.

### The price and the apply now give ONE answer

`dmgRange` is what `board.js`, `winProb2` and every rollout leaf ask. A price that said 0 while the
turn dealt four fifths would be two answers to one question — the facts-are-global breach CLAUDE.md
has a rule about — so the returned range moved too, exactly and on the packet road, floored on the
price road where `_plan.total` is `expectedHitsOf`'s fraction. The `maxhp/8` chip is still excluded
from the price, unchanged and for the reason the existing header gives: it is the ABILITY's damage,
not the move's.

## Red first, then green, then red again

- **RED, unpiped:** `SHOWDOWN_PATH=... node tests/probe_volley_collapse.js` → exit 1, **6 comparisons
  parted**; DISGUISE `-damage` 6 vs 2, `-hitcount` 5 vs 1, **HP 58 vs 114**.
- **GREEN:** exit 0, DISGUISE green on all seven rows, both controls green.
- **THE RESTORE KNOB REPRODUCES THE SAME RED, NOT A THIRD BEHAVIOUR.**
  `MEDI_FORMEONHIT_CLICK_WIDE=1` → exit 1, **6 comparisons**, DISGUISE `-damage` 6 vs 2,
  `-hitcount` 5 vs 1, HP 58 vs 114 — byte-identical to the pre-fix run. Any run carrying it also
  carries `MEDFAILS.formeOnHitClickWideRestored`.
- **The census row was shown red under the knob before it was shown green:**
  `hitcount 1, 2 damage lines, lost 130` (the chip alone) against `hitcount 3, 4 damage lines,
  lost 176` clean.

**The controls held in every run.** CONTROL A is the same Bullet Seed into a body carrying **zero**
clamp reasons (Avalugg-Hisui, 5 damage lines, 5 effectiveness lines, hitcount 5, 230/340) — without
it the file only says the engines differ on a board with Disguise on it. CONTROL B is a **one-arrival**
click into the same Mimikyu (Typhlosion-Hisui's Eruption), which is what separates "Disguise is
broken" from "the volley is broken" and is what pins the road this patch must not move.

## MY PROBE WAS WRONG TWICE, AND BOTH WERE THE COMFORTABLE DIRECTION

1. **The first fix printed the zero-damage line twice.** Extracting the bust into a closure carried
   `if(TR)TR.dmg(tg)` inside it, so the single-arrival road emitted it once itself and once from the
   closure. **CONTROL B caught it** — 2 vs 3 damage lines — which is the entire reason that control
   exists. The line is arrival 1's own `-damage` and now lives on the single-arrival road only.
2. **The census probe asserted `plain.lost > dis.lost`.** Inherited from the sibling Disguise probe,
   where the absorbed arm loses only the chip. With the body made `unfaintable` (max HP ×8) the chip
   is worth more than five arrivals, so the absorbed arm correctly loses **more** — 176 against a
   control 69 — and the probe went red on a correct engine. The control now asserts that no absorb
   happened on it at all (no `-activate`, no `detailschange`, one damage line fewer); the SIZE of the
   difference is pinned by `want`, which is built out of the control and never typed.

## The remainder, counted rather than argued away

Four new `MEDFAILS` rows, apart because they are four different repairs:

| counter | what it is |
|---|---|
| `formeAbsorbArrivalsUnaddressed` | a flat volley whose band does not divide by its arrival count — the range is still `(n-1)/n` but the apply step collapses it |
| `formeAbsorbPerHitPlan` | Parental Bond / Beat Up / Triple Axel, priced one call per hit, where the absorb still zeroes every arrival. **NOT FIXED**, and the reason is that nothing in this regulation can stage it red: Triple Axel is 90% accurate and Parental Bond needs a mega stone the differential's pair builder does not hand out. A fix nothing can show red-then-green is not a fix |
| `formeAbsorbCollapsedWithClamp` | a SECOND clamp (an Endure, a Focus Sash, a Sturdy) rewrote the total below the absorb, so `_packets` is null at the gate. The bust's two lines and its chip are still paid, in the authority's order; the arrivals then land as one subtraction, which is the pre-existing collapse |
| `formeAbsorbPendingUnspent` | the deferred bust never reached a seam — not expected at all, since arrival 0 deals zero and cannot KO |

and two `MEDSEEN` rows — `formeAbsorbArrivalOnly` (price side) and `formeAbsorbBustBetweenArrivals`
(apply side) — which should move together on any volley this engine can address.

## The Endure half is DECLARED, not fixed, and the probe now says so out loud

`tests/probe_volley_collapse.js` was a diagnostic written to fail. It is now a GATE on the DISGUISE
route and both controls, with **exactly three rows** of the ENDURE route declared open by name
(`-damage` lines, effectiveness lines, `-hitcount` value). The HP row of that same route **gates**
and is green, which is what says the declaration is narration-plus-state and not a damage hole.
**A declared row that turns GREEN also fails the file**, so the declaration cannot outlive the defect.

That is ROADMAP #511 / patch A: the survive-at-1 clamp rewrites the volley TOTAL, `dmg !== R.dmg` at
the packet gate, and the vector is discarded. Different root, deliberately not bundled.

## Which scoreboard, said before the run

**Lab moves, pool sits still.** The frozen pool holds 120 Mimikyu teams of 11,921 (1.01%) — measured
by the diagnosis, `docs/_reports/2026-08-28-volley-collapse.md`, not re-derived here — and an
87-team stride expects **0.88** of them, so more likely than not the pinned sample contains none.
That is the 2026-08-23 ruling applied in advance, not explained afterwards: board-material was
predicted unmoved and measured unmoved, and that is not a disappointment. The mechanic is real —
43 games of the frozen store pair a multi-hit move against a Mimikyu — the differential's 961-pair
sample is simply not where it lives.

## OWED, NOT RUN

- **Patch A, the survive-at-1 clamp per arrival (ROADMAP #511).** Declared open in the probe with
  three named rows. HP-neutral; costs five `-damage` lines, five effectiveness lines, the hit count,
  the between-arrival Update pass and `_timesAttacked`.
- **`formeAbsorbPerHitPlan` — Parental Bond, Beat Up, Triple Axel into an intact Disguise.** Derived
  from the code, never staged. It needs a fixture that can pin a 90% accuracy roll or build a mega
  stone into the differential's pair builder.
- **Focus Band's missing chances.** Untouched by this patch and still asserted from two source reads
  rather than from a board — `onlyFromFullHP: false`, so the authority rolls its 10% on every lethal
  arrival while this engine rolls once.
- **The `_timesAttacked` / Rage Fist consequence is now CORRECT on the Disguise road** (`_arrivals`
  reads `_landed`, which is 5 on the staged board) and was **not separately staged** — no board was
  built that clicks Rage Fist on the turn after an absorbed volley.
- **A pinch berry eaten between the arrivals of an absorbed volley** was not staged either. The seam
  now runs `_updateEvent()` after the bust, so the ordering claim (ability before item in one
  `onUpdate` pass) rests on reading `findPokemonEventHandlers`, not on a measurement.
- **`data/interaction-matrix.json` and `data/wire-ladder.json`** remain WITHHELD by
  `engine/provenance.js`; neither was re-run.
- **`engine/quarantine.js --stamp-whole-game`** was not run. The whole-game clause still prints
  DIRECTION OF TRAVEL WITHHELD against a baseline stamped under pin `2efbc9ed1946`; this run is
  `ccb365985023`. That is a MEASURE decision, not an ENGINE one.
