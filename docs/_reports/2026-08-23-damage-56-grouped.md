# The 56 damage divergences, grouped by mechanism — 2026-08-23

Analysis only. Nothing was fixed, no game was played, no gate was run. Source artifact:
`data/engine-diff.json`, generated 2026-08-23T06:05:43Z by `tests/test-engine-diff.js`,
seed 20260804, n=6000, `disagreed: 56`.

---

## Verdict

**The 56 collapse to SEVEN mechanisms, and only ONE of them is the engine.**

| # | Mechanism | of 56 | mega-only? | engine or instrument | derived carrier usage |
|---|---|---|---|---|---|
| 1 | **A Mimikyu built as the BUSTED forme still absorbs the hit** — `formeOnHitAbsorbs` gates on a runtime flag, never on the species | **15** | general | **ENGINE** | Mimikyu 1.67% of teams (611/36,696), brought 71.7% |
| 2 | **A Castform-Snowy body is never reconciled to an empty sky** — the harness's MEDICHAM side skips the init field sync a real battle runs | **16** | general | **INSTRUMENT** | Castform **0.08%** of teams (28/36,696) |
| 3 | **Sheer Force's ×1.3 is invisible to the reference** — `onModifyMove` sets `hasSheerForce` and the harness never runs `ModifyMove` | **11** | mega-only (Camerupt-Mega) | **INSTRUMENT** | Camerupt 2.76% of teams; Cameruptite 593 sheet entries |
| 4 | **Parental Bond's second packet is invisible to the reference** — `onPrepareHit` sets `multihit: 2`, never run | **8** | mega-only (Kangaskhan-Mega) | **INSTRUMENT** | Kangaskhan 3.45% of teams; Kangaskhanite 456 |
| 5 | **Mold Breaker's ability suppression is invisible to the reference** — `onModifyMove` sets `ignoreAbility` | **3** | mega-only (Gyarados-Mega) | **INSTRUMENT** | Gyarados 1.88%; Gyaradosite 225 |
| 6 | **Mega Sol's private sun is invisible to the reference** — it rides on `battle.activePokemon`, which `moveHit` never sets | **2** | mega-only (Meganium-Mega) | **INSTRUMENT** | Meganium 1.94%; Meganiumite 333 |
| 7 | **Scrappy's immunity bypass is invisible to the reference** — `onModifyMove` sets `ignoreImmunity` | **1** | mega-only (Lopunny-Mega) | **INSTRUMENT** | Lopunny 1.37%; Lopunnite 193 |

**25 of 56 are mega-only.** All 25 are the same instrument defect wearing five ability names.
**Only 15 rows — one mechanism — are the simulator being wrong.**

### What the ranking is by

Engine-vs-instrument first, then derived carrier usage, then confidence. Only #1 changes what
MEDICHAM does in a game; everything else changes what the ruler reports. But #2–#7 are still on the
**critical path for lifting quarantine**, because `engine/quarantine.js:599` requires
`disagreed === 0` and every arm at 0 — an instrument defect keeps the gate red exactly as an engine
defect does.

### Which scoreboard should move (declared before, not after)

- **#1 Mimikyu-Busted** — Mimikyu is 1.67% of teams and Disguise breaks in essentially every game it
  is brought. **Expect the pinned pool to move.**
- **#2 Castform** — 0.08% of teams, 28 of 36,696. **Expect the pool NOT to move.** This is a lab-only
  row: 16 of 56 published divergences, 29% of the residual, for 0.08% of the metagame.
- **#3–#7** — expect neither pool nor census to move, because they are the ruler. They move
  `engine-diff.json` only.

---

## The two root causes underneath the seven

### Root cause A — the reference never runs `ModifyMove` (mechanisms 3, 4, 5, 6, 7 = 25 rows)

`tests/test-engine-diff.js:428-429` runs **only** `ModifyType`:

```js
battle.singleEvent('ModifyType', move, null, src, tgt, move, move);
move = battle.runEvent('ModifyType', src, tgt, move, move);
```

with the comment at :425 saying so explicitly — *"ONLY `ModifyType`. `useMoveInner` runs `ModifyMove`
on the next line and this does NOT … Recorded as owed rather than smuggled in here."* The authority
runs both, at `pokemon-showdown/sim/battle-actions.ts:431` (`singleEvent('ModifyMove', …)`) and
`:439` (`runEvent('ModifyMove', …)`); the harness enters 931 lines lower at `moveHit`
(`sim/battle-actions.ts:1370`). Mega Sol is the same hole through a different door:
`Pokemon#effectiveWeather` (`sim/pokemon.ts:2198`) requires `this.battle.activePokemon`, which only
`runMove` sets.

**Every one of the 25 rows is proven, not inferred.** For each, Showdown's published number equals
MEDICHAM's own number **with the attacker's ability cleared to `none`**, to the unit, at both corners:

| row | Showdown says | MEDICHAM, ability cleared | MEDICHAM as built |
|---|---|---|---|
| `cameruptmega flashcannon → gengar` | 69-82 | **69-82** | 90-106 (×1.30 = Sheer Force) |
| `kangaskhanmega fakeout → pinsir` | 37-45 | **37-45** | 44-55 (the bonded packet) |
| `gyaradosmega earthquake → rotomwash` | 0-0 | **0-0** | 136-160 (Levitate broken) |
| `gyaradosmega earthquake → furfrou` | 54-64 | **54-64** | 107-126 (Fur Coat broken) |
| `meganiummega weatherball → lycanrocmidnight` | 21-25 | **21-25** | 64-75 (Fire, 100 BP, sun) |
| `lopunnymega fakeout → gourgeistsuper` | 0-0 | **0-0** | 33-40 (Normal reaches Ghost) |

Knob-cleared both ways: with the ability ON, every one of these moves; with it OFF, every one lands
exactly on Showdown's value. That is the instrument asking at the wrong layer, not the engine.

**Fur Coat is NOT the defect, despite looking like one.** Measured directly: `gyarados earthquake →
furfrou` with Fur Coat = 51-60, with Fur Coat cleared = 101-119. The ×2 Defence is wired. The
`furfrou` row diverges only because MEDICHAM correctly lets Mold Breaker through it and the reference
cannot.

**How many more rows of this class exist in the pool, derived:** of the 76 legal megas, **11** carry a
slot-0 ability with an `onModifyMove` / `onPrepareHit` / `onModifyPriority` handler — Kangaskhan-Mega
(Parental Bond), Gyarados-Mega / Ampharos-Mega / Emboar-Mega (Mold Breaker), Heracross-Mega (Skill
Link), Skarmory-Mega (Stalwart), Camerupt-Mega (Sheer Force), Banette-Mega (Prankster), Lopunny-Mega
(Scrappy), Chandelure-Mega (Infiltrator), Greninja-Mega (Protean). Across all legal abilities there
are **22** such carriers; the damage-relevant ones by sheet count are Scrappy 906, Protean 571,
Mold Breaker 411, Stance Change 365, Sheer Force 237.

### Root cause B — a battle-only forme is drawn as a standalone species and neither engine reconciles it the same way (mechanisms 1 and 2 = 31 rows)

Today's `mc_key.js` routing admitted the whole forme table. `move-priors.json` records what a replay
observed, so the pool now contains **five battle-only formes**: `palafinhero`, `aegislashblade`,
`mimikyubusted`, `morpekohangry`, `castformsnowy`. Three of them are self-consistent in both engines
and produced zero rows (116 draws between them). The two that carry a **precondition** produced 31.

They are not the same bug, and the split is the important part:

**#1 Mimikyu-Busted is a REAL ENGINE DEFECT.**
`engine/medicham2-browser.js:8644-8649`:

```js
function formeOnHitAbsorbs(tg){
  if(!tg||tg._disguiseBusted)return null;
  const fh=TAGS.param('ability',tg&&tg.ability,'formeOnHit');
```

`_disguiseBusted` is set only at `:21660`, when the hit that breaks the Disguise actually lands. A
body **constructed** from the `mimikyu-busted` key — `buildMon` gives it `ability: 'disguise'`,
`_disguiseBusted: undefined` — reads as intact and absorbs the move entirely. Measured:
`machamp rockslide → mimikyubusted` = **0-0**, identical to an intact `mimikyu`; with the ability
cleared it is 57-68, which is Showdown's number exactly. All seven published rows behave this way,
7/7.

The authority is `pokemon-showdown/data/mods/champions/abilities.ts:14-32` — Champions overrides
Disguise's `onEffectiveness` and gates it on
`['mimikyu','mimikyutotem'].includes(target.species.id)`, so the busted forme gets nothing.
(Reading `data/abilities.ts` here would be reading a different game; the mainline handler is
overridden.)

**This reaches past the differential.** The live break path is correct — `:21679` calls
`formeSwap(tg, fh.becomes, 'formeOnHit')` **and** sets the flag — so an in-battle Mimikyu is fine.
The defect fires wherever a body is built from an OBSERVED forme name, which is exactly what the
ingest records (`mimikyubusted` is in `move-priors.json`) and what any board or rollout constructed
from observed state would use.

**The fix is tag-shaped and its match set is exactly one member, checked before proposing it:**
`formeOnHit` has one member in `data/tags.json` — `disguise`, with
`becomes: "Mimikyu-Busted"`. A built body carries `name: "mimikyu-busted"`. So
"refuse when the body already IS `fh.becomes`" matches `{mimikyu-busted}` and nothing else. No name
is hard-coded and no other mechanic is caught.

**#2 Castform-Snowy is the INSTRUMENT, on the reading of the source (not executed — see the open
question below).** MEDICHAM does model this: `syncWeatherFormes`
(`engine/medicham2-browser.js:12963-12992`) reads `formeFollowsWeather`, finds no matching sky, and
falls to `revertsToTypes: ['Normal']`. It is reached through `syncFieldTypes`, which **is** called at
battle init over both sides' actives at `:14522`. The harness never calls it — it builds bodies and
calls `dmgRange` directly (`tests/test-engine-diff.js:579`, and CONTROL FIX 7 at :588-596 clears
entry effects on the MEDICHAM side by design) — while the Showdown side really switches in, so
Forecast's `onStart` (`data/abilities.ts:1460-1464`) fires and formeChanges to base Castform.

Proof by control, 16/16: rebuilding the Castform body as base `castform` reproduces Showdown's number
to the unit on every published row — 12-15 / 43-51 / 13-16 / 27-32 / 54-64 (Blizzard), 50-60 / 16-19 /
13-16 / 20-24 / 18-22 / 11-14 / 50-60 (Icy Wind), 30-36 / 15-18 (Weather Ball), 52-62 (Palafin Iron
Head into it), 0-0 (Basculegion-F Last Respects — a Ghost move into a Normal body). Base stats are
identical across all four Castform rows in `MC.mons`, so a types-only revert is numerically complete.

**Two things a fixer should know about this one:**

- `applyEntryEffects` does **not** revert it. Measured: build `castformsnowy`, call
  `MEDI.applyEntryEffects(body, {weather:'', …}, null)` — types stay `["Ice"]`. Only the init-level
  `syncFieldTypes` at `:14522` would.
- **The comment at `:12946-12948` is now STALE and it is load-bearing.** It says
  *"`data/engine-data.js` holds a row for `castform` and NONE for Castform-Sunny, Castform-Rainy or
  Castform-Snowy, so `formeSwap` would fail its `buildMon` lookup"* — and that is the whole stated
  reason Forecast is modelled as a retype with the species label deliberately left wrong
  (`formeWeatherNameUnchanged`, expected non-zero on every application). **The rows exist today:**
  `MC.mons` holds `castform`, `castform-snowy`, `castform-rainy`, `castform-sunny`. The blocker named
  in the comment is gone. This is not ENGINE's file to change, but the comment's premise should stop
  being cited.

---

## What the artifact does NOT contain, and the 16 rows it hides

`tests/test-engine-diff.js:954` writes `worst: bad.slice(0, 40)` over a list sorted by move usage
descending (`:818`). **The artifact publishes 40 of the 56.** The `arms` lists do not help — each is
also capped at 40 and sorted by uses, and the union of all sixteen arm lists is the *same 40 triples*
as the midpoint's. The 16 missing rows are simply the lowest-usage ones (all have move `uses` ≤ 1507).

**They were recovered by reconstruction, and the reconstruction is stated as reconstruction.** The
harness's sampler is a plain LCG seeded at 20260804 whose only consumer in the loop is `pick`
(`:773-782`), so the draw is reproducible without running either engine. Replaying it and re-deriving
each family with the harness's own rules (slot-0 abilities on both sides, 12% relative band on
HP-capped midpoints) gives:

| family | reconstructed total | published in the 40 | hidden in the 16 |
|---|---|---|---|
| Mimikyu-Busted | 15 | 7 | **8** |
| Castform-Snowy | 16 | 16 | 0 |
| Sheer Force / Camerupt-Mega | 11 | 5 | **6** |
| Parental Bond / Kangaskhan-Mega | 8 | 7 | **1** |
| Mold Breaker / Gyarados-Mega | 3 | 2 | **1** |
| Mega Sol / Meganium-Mega | 2 | 2 | 0 |
| Scrappy / Lopunny-Mega | 1 | 1 | 0 |
| **total** | **56** | **40** | **16** |

56 reconstructed against 56 measured, and 16 hidden against 16 hidden. **Fidelity, stated:** the
replay reproduced **39 of the 40** published rows (it misses `meganiummega weatherball → torterra`,
because it does not model the 37 rows Showdown dropped by exception, which shifts the tail slightly).
So the family counts are near-exact, not exact, and the totals matching at 56/56 is partly luck.

The eight hidden **Mimikyu-Busted** rows (all MEDICHAM `0-0`):
`medichammega bulletpunch` (Showdown 102-120), `morpekohangry aurawheel` (102-121),
`qwilfish liquidation` (79-94), `araquanid surf` (58-69), `rotomwash discharge` (64-76),
`kleavor aerialace` (51-61), `meowsticmmega expandingforce` (78-93), `volcarona fierydance` (75-88).

The eight hidden **mega-ability** rows: `cameruptmega ancientpower → tyranitar / kangaskhan /
vanilluxe`, `cameruptmega flamethrower → polteageistantique / venusaurmega / meowsticf`,
`kangaskhanmega doubleedge → malamarmega`, `gyaradosmega crunch → dragonitemega` (38-45 vs 76-91 —
Multiscale, broken by Mold Breaker on our side only).

**The command that settles it properly** (I could not run it — the differential is out of scope for
this brief): the run is deterministic, so re-running

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  tools\lownode.cmd tests\test-engine-diff.js --n 6000 --seed 20260804
```

reproduces the identical 56 — but the artifact will truncate at 40 again. Raising
`bad.slice(0, 40)` at `tests/test-engine-diff.js:954` is what makes the tail readable, and it is
worth doing before anyone else re-derives it by hand. Individual rows can be confirmed one at a time
with `--case att,move,def` (`:762`), which is the mode a fix should be checked in.

---

## Roll-index behaviour

`arms` reads top 55, bottom 58, interior 56-57 against a midpoint of 56. **No group is index-specific.**
Every mechanism here is a multiplier or an all-or-nothing zero, so it fires at all sixteen indices;
the ±1-3 wobble is band-edge rounding on rows sitting near the 12% tolerance. Supporting measurement:
the union of the sixteen arm `worst` lists is exactly the same 40 triples as the midpoint's.

---

## Things checked and cleared, so nobody re-derives them

- **Fur Coat** — wired, ×2 Defence, correctly broken by Mold Breaker. Not a defect. (This was the
  brief's worked example of a naming format and it is a decoy on this artifact.)
- **The Fire/Rock type chart** — my first pass "found" Fire vs Rock reading 1.0 instead of 0.5 on
  Lycanroc-Midnight. **The probe was wrong, not the engine**: Normal is *also* 0.5 into Rock, so the
  Fire/Normal ratio is 1.0 by construction. `MC.C.Fire.Rock === 0.5`, and `mcEff('Fire',['Rock'])`
  returns 0.5. Recorded because it is the fifteenth instance of the failure the brief warns about.
- **Protean** — `dmgRange` alone does not apply it (Greninja + Ice Beam is byte-identical with
  `protean`, `torrent` and `none`), but that is not a defect: the retype is wired in the turn loop at
  `:20357` (WIRE 126), which mutates `m.types` before the hit. What it *does* mean is that **this
  differential is structurally blind to Protean** — the harness never runs `onPrepareHit` either, so
  both sides are missing it and the rows agree for the wrong reason. A green row that asks nothing.
- **Palafin-Hero, Aegislash-Blade, Morpeko-Hangry** — 116 draws, zero divergences. They are
  battle-only formes with no switch-in precondition in either engine, which is why the forme story
  above is specifically about Forecast and Disguise rather than about formes in general.

---

## Usage: how it was derived

The `uses` field on every `engine-diff.json` row is `tags.moves[mv].uses` — a count of **sheet
entries for the MOVE** out of 198,840. It is the wrong weight for all seven mechanisms here, because
every one of them is a property of the **attacker or the defender**, not of the move. Five rows
carrying `fakeout` all read 24,726 and tell you nothing about Kangaskhan.

Carrier weight was re-derived from `data/meta-usage.json` → `views.competitive.threats`
(36,696 sampled teams, 18,348 games): `teamRate` = fraction of teams carrying the species,
`bringRate` = fraction of those games it was actually brought. For the megas, weighted additionally
by the stone's sheet count in `data/tags.json` `items`, because the ability is only real if the stone
is held **and** that mega is the one used in the battle — one per battle.

Two caveats, stated rather than buried:
- the sheet corpus (198,840 entries ≈ 33,140 teams) and the threats table (36,696 teams) are
  different samples; ratios between them are good to roughly ±10%, no better;
- **a mega's ability reads 0 uses in `tags.abilities`** — Parental Bond is literally `uses: 0` —
  because sheets list the *pre-mega* ability. Anyone ranking mega work off ability usage will rank
  every mega at zero. The stone count is the usable proxy.

---

## The one thing that is genuinely unattributable from the artifact alone

Whether mechanism #2 (Castform-Snowy) is instrument or engine rests on a **read of the source**, not
on an execution: `syncFieldTypes` is called at `engine/medicham2-browser.js:14522` during battle init,
and `syncWeatherFormes` at `:12984` would set the types to `['Normal']` given an empty sky. I did not
run a battle to confirm it, because this brief forbids playing one.

**The probe that settles it** belongs to whoever holds the engine: build a lead pair with
`castform-snowy` on one side, run one `battle()` init, and assert the body's `types` read `["Normal"]`
on turn 1 with no weather — with the control being the same body under snow reading `["Ice"]`, so the
knob is cleared explicitly. If it reads `["Ice"]`, mechanism #2 is a **second engine defect** of the
same shape as #1 and should be reranked above #3.
