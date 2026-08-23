# The damage harness asked at the wrong point, and its species pool was 40% empty. 2026-08-23.

Dated findings record. Not maintained; superseded by whatever register row it feeds.
LIGHT MODE. Nothing in `engine/medicham2-browser.js` was touched. One file changed:
`tests/test-engine-diff.js`.

## Verdict

1. **CONTROL FIX 13 landed.** `showdownDamage` now runs `ModifyType` before `moveHit`, the way
   `useMoveInner` does. **The five `aurorus hypervoice` rows cleared as FALSE REDS, not as fixes** —
   MEDICHAM's numbers did not move by one point on any of them, on either corner. `5 -> 0` on that
   family is an INSTRUMENT correction and must not be reported as an engine improvement.
2. **The pool key mismatch is fixed and the drop is now LOUD.** Drawable species **207 -> 336** of
   345. **76 megas entered the damage differential for the first time**, each compared under ITS OWN
   MEGA ABILITY. 9 species remain dropped and are now printed by name on every run.
3. **The residual grew, and that is the population growing, not a regression.** At `--n 300`
   `--seed 20260804`: before the pool fix **0/300**, after **4/300**. All four attackers or
   defenders are species the differential could not draw before today.
4. **One of the four is a real MEDICHAM defect** (Disguise fires on the already-busted forme),
   confirmed by direct probe. It is REPORTED, not fixed — see Owed.

## 1. BATCH 1 — the entry point

### Shown RED first

`--case` mode, before any edit:

```
aurorus hypervoice -> aggron    showdown  18-21   medicham  64-76   rel 259.0%  DISAGREE
aurorus hypervoice -> gallade   showdown  43-51   medicham  76-91   rel  77.7%  DISAGREE
aurorus hypervoice -> tauros    showdown  64-76   medicham 115-136  rel  79.3%  DISAGREE
aurorus hypervoice -> swampert  showdown  52-62   medicham  94-112  rel  80.7%  DISAGREE
aurorus hypervoice -> roserade  showdown  46-55   medicham 137-137  rel 171.3%  DISAGREE
CONTROL tauros bodyslam    -> gallade  94-112 vs  94-112   AGREE   (Normal move, no -ate ability)
CONTROL aurorus ancientpower -> gallade 21-26 vs  21-26    AGREE   (non-Normal, SAME body)
CONTROL garchomp earthquake -> gallade 133-143 vs 133-143  AGREE
CONTROL sylveon hypervoice -> aggron    21-25 vs  21-25    AGREE   (slot-0 pin = Cute Charm)
```

### The change

`tests/test-engine-diff.js`, `showdownDamage`, immediately after `move.hit = 1` and **before** the
`onTryHit` block:

```js
battle.singleEvent('ModifyType', move, null, src, tgt, move, move);
move = battle.runEvent('ModifyType', src, tgt, move, move);
```

Those are the two lines the authority runs at `sim/battle-actions.ts:430` and `:438`, inside
`useMoveInner`. `const move` became `let move` because `runEvent` returns the relay var.

**Placed before the `onTryHit` block on purpose.** The authority runs `ModifyType` before
`hitStepTryHitEvent`, so a Galvanize Body Slam is already Electric when Volt Absorb is asked whether
it takes it. Asking in the other order would answer about a Normal move.

**Only `ModifyType`.** `useMoveInner` runs `ModifyMove` on the very next line and this does not —
that is a separate and much wider question, and a red row has to stay attributable. Owed below.

### Blast radius, derived not assumed

```
ABILITIES with onModifyType (7): dragonize aerilate galvanize liquidvoice normalize pixilate refrigerate
ITEMS     with onModifyType (0): -
MOVES     with onModifyType (4): aurawheel ragingbull terrainpulse weatherball
```

Derived from `Dex.forFormat('gen9championsvgc2026regmb')` over `.all()` filtered to
`exists && !isNonstandard`. Nothing else in the format has a handler, so nothing else can move.

### After

```
aurorus hypervoice -> aggron    showdown  64-76   medicham  64-76   rel 0.0%  AGREE
aurorus hypervoice -> gallade   showdown  76-91   medicham  76-91   rel 0.0%  AGREE
aurorus hypervoice -> tauros    showdown 115-136  medicham 115-136  rel 0.0%  AGREE
aurorus hypervoice -> swampert  showdown  94-112  medicham  94-112  rel 0.0%  AGREE
aurorus hypervoice -> roserade  showdown 137-137  medicham 137-137  rel 0.0%  AGREE
```

**MEDICHAM's column is byte-for-byte what it was before the change.** Only the reference moved, and
it moved onto the value a REAL TURN of the authority already produced (measured in
`docs/_reports/2026-08-23-refrigerate.md`). That is what makes these false reds rather than fixes.

**The over-correction controls did not move**: `tauros bodyslam -> gallade` 94-112 before and after,
`aurorus ancientpower -> gallade` 21-26 before and after, `garchomp earthquake -> gallade` 133-143
before and after. Two immunity controls also still hold: `pelipper muddywater -> vaporeon` 0-0 both
sides, `tauros ironhead -> mimikyu` 0-0 both sides.

### Population check at n=300 (post-batch-1, pre-batch-2)

`--n 300 --seed 20260804`: **300 compared, 300 agreed, 0 disagreed**, 4 multi-hit skipped, 0 dropped
by exception. The five aurorus rows are not in a 300-row draw, so this run is a no-regression check,
not the proof — the `--case` pair above is the proof.

## 2. BATCH 2 — the pool

### The defect

`move-priors.json` keys a forme the way Showdown does (`gardevoirmega`, `rotomwash`); `MC.mons` keys
it with a hyphen (`gardevoir-mega`, `rotom-wash`). The pool filter was
`MEDI.buildMon(s.toLowerCase(), {})` — a **sixth hand-rolled doorway into `MC.mons`**, and
`buildMon` returns `null` on an unknown key rather than throwing, so `logDroppedRow` never saw it.

### The change

The one resolver, `engine/mc_key.js`, which `tests/test-mc-key.js` exists to enforce:

```js
const { mcKey } = require(D('engine', 'mc_key.js'));
const MAY_MISS = { mayMiss: 'a priors species with no MC.mons row is reportable, not a crash' };
function mediBody(id) { const k = mcKey(id, MAY_MISS); if (!k) return null; return MEDI.buildMon(k, {}); }
```

`mediBody` is used by BOTH the pool filter and `compareRow`, so the two cannot disagree about which
species exist. Without `mayMiss`, `engine/lookup.js` THROWS on a miss — that loudness is right
everywhere except here, where a species genuinely absent from the table is a reportable condition.

### The loud counter

Printed on every run, before anything is drawn, and carried into the artifact as `pool`:

```
POOL — species this differential can draw at all, counted rather than assumed:
  move-priors species 345   DRAWABLE 336   (76 of them megas)   DROPPED 9:
    florgeswhite amoonguss jirachi magnezone walrein ironvaliant torracat rillaboom revavroom
  A DROP HERE IS A SPECIES THE DAMAGE DIFFERENTIAL HAS NEVER COMPARED. It is not a pass.
```

**The counter was wrong on its first version and is recorded as such**: it matched `/-mega$/` and
read **72**, because Charizard-Mega-X/Y and Mewtwo-Mega-X/Y carry a suffix after the forme. Fixed to
`/-mega(-|$)/`, which reads 76 — the number `Dex.forFormat` gives for legal megas in this format. A
counter that is four short is the same class of error as the drop it exists to expose.

### Before / after populations

| | before | after |
|---|---|---|
| species in `move-priors.json` | 345 | 345 |
| DRAWABLE | **207** | **336** |
| dropped, silently | **138** | 0 |
| dropped, NAMED and counted | 0 | **9** |
| megas drawable | **0 of 76** | **76 of 76** |
| non-mega formes gained | — | 53 (`rotom-wash`, `slowking-galar`, `tauros-paldea-*`, the Vivillon patterns, the Alcremie creams, `mimikyu-busted`, `palafin-hero`, `aegislash-blade`, …) |

### The 9 still dropped, classified

Derived from the format, not recalled:

- **8 are ILLEGAL in Reg M-B** (`isNonstandard: 'Past'`): amoonguss, jirachi, magnezone, walrein,
  ironvaliant, torracat, rillaboom, revavroom. These are the known corpus contamination and their
  absence from `MC.mons` is correct.
- **1 is LEGAL and has no `MC.mons` row: `florgeswhite`** (`isNonstandard: null`). That is a genuine
  `data/engine-data.js` gap. **Not fixed — `engine-data.js` is out of ENGINE's hands.** Filed for
  MEASURE.

### The mega ability question, answered with a measurement

Will's requirement was that a mega be compared **with its mega ability, not its base form's**.

- All 76 megas in the priors have **exactly ONE ability slot**. `Object.keys(species.abilities)` is
  `['0']` for every one of them. So `abilities['0']` **IS** the mega ability, and the harness's
  slot-0 pin — which is what makes every Sylveon row run Cute Charm instead of Pixilate — is
  **correct for megas and does not need its own batch to make megas testable.**
- 59 of 76 carry an ability the base form does not have. Derived, not recalled.
- `MEDI.buildMon('gardevoir-mega')` also returns `pixilate` on its own, so both engines agree on the
  input before `compareRow` pins them equal.

**Proved by outcome, in the harness's own output** — the ability in the bracket is the mega's:

```
gardevoirmega  hypervoice  -> gallade    143-143 vs 143-143  AGREE  [pixilate vs steadfast]
altariamega    bodyslam    -> garchomp   180-183 vs 180-183  AGREE  [pixilate vs sandveil]
pinsirmega     bodyslam    -> gallade    143-143 vs 143-143  AGREE  [aerilate vs steadfast]
glaliemega     bodyslam    -> gallade    127-143 vs 127-143  AGREE  [refrigerate vs steadfast]
charizardmegay heatwave    -> gallade     93-109 vs  93-109  AGREE  [drought vs steadfast]
charizardmegax flareblitz  -> gallade    143-143 vs 143-143  AGREE  [toughclaws vs steadfast]
metagrossmega  ironhead    -> gallade    143-143 vs 143-143  AGREE  [toughclaws vs steadfast]
venusaurmega   gigadrain   -> gallade     60- 72 vs  60- 72  AGREE  [thickfat vs steadfast]
rotomwash      hydropump   -> gallade     81- 96 vs  81- 96  AGREE  [levitate vs steadfast]
slowkinggalar  sludgebomb  -> gallade     67- 81 vs  67- 81  AGREE  [curiousmedicine vs steadfast]
```

Four of those ten are `-ate` carriers and they agree **only because batch 1 landed first**. Run
against the old entry point they would have read 143 vs 143-under-a-Normal-move and been filed as
engine bugs. **That is the order the brief insisted on, and it is not hypothetical.**

Caveat stated rather than hidden: several rows read `143-143` because Gallade's HP is 143 and the
harness caps both sides at the target's HP. Those rows agree on "this is a kill", which is weaker
than a full-band agreement. Not new, and documented in the file already.

### The residual after the pool fix

`--n 300 --seed 20260804`, same seed, same n, one file different:

| | before batch 2 | after batch 2 |
|---|---|---|
| compared | 300 | 300 |
| agreed | 300 | 296 |
| disagreed | **0** | **4** |
| drawn from a pool of | 207 species | 336 species |

**A larger red count here is not a regression.** The denominator of ROWS is unchanged at 300; the
UNIVERSE those rows are drawn from grew by 62%. All four reds involve a species that could not be
drawn yesterday:

```
machamp       knockoff   -> mimikyubusted   showdown  50-59   medicham   0-0    (5269 uses)
castformsnowy blizzard   -> primarina       showdown  12-15   medicham  18-22   (4828 uses)
medichammega  bulletpunch-> mimikyubusted   showdown 102-120  medicham   0-0    (1427 uses)
kangaskhanmega doubleedge-> malamarmega     showdown 121-144  medicham 151-161  ( 607 uses)
```

**One is classified, cheaply, because it appears twice.** Direct probe on the engine, no harness:

```
mimikyu-busted, ability=disguise  ->  dmgRange 0-0
mimikyu-busted, ability=none      ->  dmgRange 50-59
mimikyu (unbusted), disguise      ->  dmgRange 0-0
```

MEDICHAM applies Disguise to the **already-broken** forme. Showdown's handler is gated on the
species id, so `Mimikyu-Busted` takes the hit. **That is a real MEDICHAM defect**, newly visible
because `mimikyu-busted` entered the pool today. NOT FIXED: `engine/medicham2-browser.js` carries
~400 uncommitted, unmeasured lines from a stopped agent and this brief forbids editing it.

The other three are UNCLASSIFIED and must not be called engine bugs yet. The two obvious hypotheses,
written down so the next pass does not re-derive them: `castform-snowy` carries **Forecast**, which
reverts the forme when the harness clears the weather on the Showdown side but not on MEDICHAM's —
that would be a HARNESS defect of exactly the CONTROL FIX 7 shape. `kangaskhan-mega` carries
**Parental Bond**, and this harness calls `moveHit` once by construction.

## 3. What was NOT changed

- `engine/medicham2-browser.js` — untouched. Its uncommitted lines are exactly as found.
- `engine/game_differential.js` — untouched. Different instrument; the brief says so and the prior
  report says so.
- `data/engine-diff.json` — **not republished.** `engine/publish_guard.js` refused both n=300 runs
  (300 < 6000) and wrote them to `data/verification/engine-diff.n300.json` instead. The published
  6,000-comparison artifact still says `5 disagreed` and still names the five aurorus rows. **It is
  stale by design until the full run is re-done**, and `engine/status.js`'s GENERATED block in
  `docs/ENGINE.md` still prints those five. Neither may be hand-edited.
- `docs/ROADMAP.md` — untouched. Nothing committed, nothing pushed.

## 4. Two ratchets are RED, on files I did not touch — reported, not filed

Both were red before this pass and neither names `tests/test-engine-diff.js`:

- `tests/test-mc-key.js` exit 1 — *"no NEW file hand-rolls the species lookup"*, naming
  `engine/rollout_seed_prevalence.js`, `tests/probe_red_demo.js`, `tests/test-rollout-seed.js`,
  `tests/test-seed-clock.js`, `tests/test-seed-residue.js`. None is in `git status`; none is mine.
  **This pass REMOVED a doorway rather than adding one.**
- `tests/test-no-silent-failure.js` exit 1 — 84 NEW since baseline, `tests/test-engine-diff.js`
  appears **0 times**.

Worth recording for the ratchet's owner: `test-mc-key.js` **did not catch the doorway fixed today**.
`MEDI.buildMon(s.toLowerCase())` is not the `MC.mons[norm(x)]` shape its scanner looks for, so the
largest single instance of the bug that check exists to prevent — 138 species, 76 of them megas —
sat inside a file the check reported clean.

## 5. Census

`data/mechanics-census.json` reads **live 634** in the working tree (630 at HEAD; the difference is
the stopped agent's uncommitted simulator work, not mine). **This pass did not touch the simulator,
so the census cannot have moved and was deliberately NOT regenerated** — re-running it would rewrite
that artifact under someone else's unmeasured changes.

## OWED, NOT RUN

Every one is heavy and Will is at the keyboard. Run from PowerShell through the wrapper.

```
REM 1. THE FULL DIFFERENTIAL. Republishes data/engine-diff.json; the five aurorus rows should
REM    vanish from it and the pool block should read 336. Expect the residual to RISE from 5,
REM    because the population grew from 207 species to 336 -- give both numbers, never the rate alone.
tools\lownode.cmd tests\test-engine-diff.js --n 6000 --seed 20260804

REM 2. RESTAMP. Only after 1, or the GENERATED block in docs/ENGINE.md keeps printing the five.
node engine\status.js --write

REM 3. THE GATE, since the quarantine clause reads the differential.
tools\lownode.cmd engine\quarantine.js

REM 4. The census, ONLY once the simulator's uncommitted lines are measured and settled.
node tests\test-mechanics.js
```

Also owed, and deliberately not attempted here:

- **`ModifyMove` at the same entry point.** `useMoveInner` runs it one line after `ModifyType`; this
  harness still does not. Its blast radius is far wider than 7 abilities and it needs its own batch
  with its own red demonstration.
- **The slot-0 pin for NON-mega carriers.** Sylveon's Pixilate (`hypervoice` p=0.509) and
  Primarina's Liquid Voice (`hypervoice` p=0.359) sit on slot H and are still compared under Cute
  Charm and Torrent. **Not a mega problem** — megas have one slot — but it means the instrument's
  coverage claim is "slot-0 abilities only" and should say so out loud.
- **`florgeswhite` has no `MC.mons` row and is legal.** `data/engine-data.js`, so MEASURE.
- **Three unclassified reds**: `castformsnowy blizzard -> primarina`,
  `kangaskhanmega doubleedge -> malamarmega`, and the confirmed Disguise-on-busted defect.
