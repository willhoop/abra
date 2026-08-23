# The last 41 damage divergences — both mechanisms were the harness, and a third was hiding behind one of them. 2026-08-23

**Nothing in `engine/medicham2-browser.js` changed. One file did: `tests/test-engine-diff.js`.**

`data/engine-diff.json` at `--n 6000 --seed 20260804`: **41 disagreements → 7.**

| | before | after | what left |
|---|---|---|---|
| Sheer Force / Camerupt-Mega | 11 | **0** | CONTROL FIX 14 |
| Mold Breaker / Gyarados-Mega | 3 | **0** | CONTROL FIX 14 |
| Mega Sol / Meganium-Mega | 2 | **0** | CONTROL FIX 14 (`setActiveMove` half) |
| Scrappy / Lopunny-Mega | 1 | **0** | CONTROL FIX 14 |
| Parental Bond / Kangaskhan-Mega | 8 | **0** | SKIP FIX 15 — a **scope declaration**, not a fix |
| Forecast / Castform-Snowy | 16 | **0** | CONTROL FIX 16 |
| **Struggle / Ditto** | 0 | **7** | **NEW — a real MEDICHAM defect, previously a false agreement** |
| **total** | **41** | **7** | |

Both arms and all fourteen interior indices read 7. `band_missing` 0, `dropped_by_exception` 0,
`compared` 6000 in every run.

---

## Batch 1 — CONTROL FIX 14. `ModifyMove`, and `setActiveMove`.

`tests/test-engine-diff.js` entered the authority at `battle.actions.moveHit`
(`sim/battle-actions.ts:1370`), 932 lines below `useMoveInner`. Commit `eb49918` had already moved
`ModifyType` up and left `ModifyMove` explicitly owed. This is that batch: the four lines at
`sim/battle-actions.ts:426-441`, copied in the authority's own order, with `setActiveMove` in front.

**The prediction, made before the run and falsifiable:** Showdown's column rises to MEDICHAM's
as-built column, and MEDICHAM's column does not move. It held on every named row, to the unit, at
both corners.

| row | before (showdown / medicham) | after |
|---|---|---|
| `cameruptmega earthpower -> mamoswine` | 136-162 / 178-185 | **178-185 / 178-185** |
| `cameruptmega flashcannon -> gengar` | 69-82 / 90-106 | **90-106 / 90-106** |
| `cameruptmega ancientpower -> tyranitar` | 41-49 / 53-63 | **53-63 / 53-63** |
| `cameruptmega flamethrower -> meowsticf` | 109-129 / 142-149 | **142-149 / 142-149** |
| `gyaradosmega earthquake -> rotomwash` | 0-0 / 125-125 | **125-125 / 125-125** |
| `gyaradosmega earthquake -> furfrou` | 54-64 / 107-126 | **107-126 / 107-126** |
| `gyaradosmega crunch -> dragonitemega` | 38-45 / 76-91 | **76-91 / 76-91** |
| `meganiummega weatherball -> lycanrocmidnight` | 21-25 / 64-75 | **64-75 / 64-75** |
| `meganiummega weatherball -> torterra` | 39-46 / 170-170 | **170-170 / 170-170** |
| `lopunnymega fakeout -> gourgeistsuper` | 0-0 / 33-40 | **33-40 / 33-40** |

**Mega Sol is the `setActiveMove` half, not a `ModifyMove` handler**, and it is recorded separately
so a reader does not count five abilities and find four handlers. `Pokemon#effectiveWeather` returns
the private sun only when `battle.activePokemon` is set, and only `runMove` and `tryMoveHit` set it.

**Blast radius, DERIVED against the format, not recalled.** 19 legal abilities carry an
`onModifyMove` handler — `battlebond gorillatactics illuminate infiltrator keeneye longreach
mindseye moldbreaker myceliummight propellertail scrappy serenegrace sheerforce skilllink stalwart
stancechange stench teravolt turboblaze` — and 8 of the 76 legal megas carry one in slot 0
(Gyarados / Ampharos / Emboar = Mold Breaker, Heracross = Skill Link, Skarmory = Stalwart,
Camerupt = Sheer Force, Lopunny = Scrappy, Chandelure = Infiltrator).

**The controls, all unmoved to the unit across every batch below:**

| control | why it is the control | reads |
|---|---|---|
| `tauros bodyslam -> gallade` | no handler on either side | 94-112 |
| `aurorus ancientpower -> gallade` | `eb49918`'s own control, kept | 21-26 |
| `aurorus hypervoice -> aggron` | the `ModifyType` row CONTROL FIX 13 fixed | 64-76 |
| `camerupt flashcannon -> gengar` | the BASE forme of a row that DOES move — the knob is the ability, not the body | 62-73 |
| `kangaskhan fakeout -> pinsir` | ditto, for Parental Bond | 34-42 |
| `gyarados earthquake -> rotomwash` | base forme, whose Levitate must still hold | 0-0 |

### Batch 1 also produced NINE new rows, and they were the fix breaking an older control

`aegislash darkpulse` x5 and `aegislash nightdaze` x4 arrived reading ~2.5x. **Measured, not
inferred:** marking the reference Aegislash's stats with 999/111 and running the four new lines
returns species `Aegislash-Blade` with stats **160/160** — Stance Change's `onModifyMove` calls
`formeChange`, which calls `setSpecies`, which recomputes `storedStats` and throws CONTROL FIX 8's
stat alignment away. Knob cleared: the same body clicking **King's Shield** stays `Aegislash` with
999/111 intact; Camerupt-Mega, Ditto and Tauros are untouched on the same probe.

**CONTROL FIX 8b** re-applies the alignment after the events. 144 reference bodies changed forme on
the 6,000-row run (9 distinct matchups x 16 reference calls each), all Aegislash → Aegislash-Blade,
counted and named in the artifact.

**The over-correction control that matters:** `aegislashblade darkpulse -> aurorus` still reads
**44-52 on both sides** — 8b did not flatten Blade into Shield, it only stopped a Shield body being
silently re-statted. `aegislash darkpulse -> aurorus` reads 17-21 on both sides.

---

## Batch 2 — SKIP FIX 15. Parental Bond. **This is a scope declaration, not a fix.**

The brief grouped Parental Bond with the `ModifyMove` family. **It is a third omission and running
`ModifyMove` does not touch it.** Parental Bond hangs off `onPrepareHit`
(`sim/battle-actions.ts:591-592`, inside `trySpreadMoveHit`, above the harness's entry point), and
all it does is set `move.multihit = 2` — a field read by `hitStepMoveHitLoop`
(`sim/battle-actions.ts:857`), one level higher again. `moveHit` calls `spreadMoveHit` once and
returns. Running PrepareHit here would set the field and change no number.

MEDICHAM prices the whole click: `mediHitPlan` returns `{n:2, bondPlan:true, perHit:{bondMult}}` and
`dmgRange` sums both packets. That is **the same quantity it returns for Rock Blast**, and this file
already skips Rock Blast for this identical reason, with the reason written out at `MULTIHIT`.

So the 8 rows are skipped, on the file's own existing policy. **17 rows on the 6,000-row run**
(`doubleedge x4 fakeout x4 drainpunch x4 suckerpunch x3 icepunch x1 lastresort x1`) — 8 that were
disagreeing and 9 that were agreeing. Membership is derived from the `hitsTwice` tag (**one member,
`parentalbond`, printed before use**) and the **authority's own `onPrepareHit` handler, run on a
throwaway `getActiveMove` copy**, decides per move — so the per-move exceptions (charge moves,
`noparentalbond`, spread hits, an already-multi-hit move) are never restated in the harness.

**What it costs, stated rather than buried:** Parental Bond leaves this file's surface entirely, and
`tests/test-mechanics.js` is now the **only** guard on the mechanic.

---

## Batch 3 — CONTROL FIX 16. Castform, and the open question is now closed by execution.

The prior report could not say whether Castform was instrument or engine: it rested on a read of
`syncFieldTypes` at `engine/medicham2-browser.js:14650` and nobody had run a battle. **Run now, with
the knob cleared explicitly:**

```
MEDICHAM battleInit — does the sky decide the Castform body's type?
  EMPTY SKY (gallade lead)     weather=null   castform types=["Normal"]
  SNOW (Snow Warning lead)     weather=snow   castform types=["Ice"]
  SUN  (Drought lead)          weather=sun    castform types=["Fire"]
```

Varied output across a varied sky. **The engine's knob is wired and Castform is NOT a second engine
defect.** Showdown's half was measured the same way: sending in `Castform-Snowy`, `-Sunny` or
`-Rainy` with no weather returns species `Castform`, types `["Normal"]`; `Aegislash` on the same
probe is untouched.

**The harness alone skipped it** — it calls `buildMon` and then `dmgRange` directly, with no field
anywhere between them, and `MEDI.buildMon('castform-snowy')` hands back `["Ice"]`.

The resolution is in `mediBody`, the file's ONE doorway (putting it in `compareRow` would let the
pool filter and the comparison disagree about which species exist — the exact defect the `POOL`
block was written to close). `syncFieldTypes` is not exported and ENGINE may not add an export to
satisfy an instrument, so the resolution is done on the **species key**, via the ability's own
`revertsTo` — one field out of the artifact, never a re-implementation of the type map. `sameStats`
is `true` and MC.mons agrees (147 hp / 81 spa on all four Castform rows), so a key swap is
numerically complete.

**DERIVED set, printed before use — three members, exactly the Castform weather formes:**
`castformsunny -> castform`, `castformrainy -> castform`, `castformsnowy -> castform` (forecast).

All 16 rows cleared, both directions:

| row | before | after |
|---|---|---|
| `castformsnowy blizzard -> primarina` (STAB it does not have) | 12-15 / 18-22 | **12-15 / 12-15** |
| `castformsnowy weatherball -> espathra` (STAB it DOES have) | 30-36 / 20-24 | **30-36 / 30-36** |
| `palafin ironhead -> castformsnowy` (2x into an Ice type that is really Normal) | 52-62 / 104-124 | **52-62 / 52-62** |
| `basculegionf lastrespects -> castformsnowy` (a Ghost immunity that is really a neutral hit) | 0-0 / 33-39 | **0-0 / 0-0** |

**Over-correction control:** `castform blizzard -> primarina` — the base forme, which must be
unaffected — reads **12-15 on both sides**, identical to the resolved Snowy row. `castformsunny
flamethrower -> gallade` reads 21-25 on both sides.

---

## THE ONE THING THAT GOT WORSE, AND IT IS A REAL ENGINE DEFECT

**`ditto struggle` x7 — MEDICHAM types Struggle as Normal. The authority makes it typeless.**

`data/moves.ts` `struggle.onModifyMove` sets `move.type = "???"`. Running `ModifyMove` in the
reference made this visible; before batch 1 **both engines were wrong the same way and the rows
scored AGREE**, which is the false agreement this file's CONTROL FIX 10 note calls the expensive
kind.

`MC.moves.struggle = {"t":"Normal","c":"P","bp":50}`.

It is **two** defects, not one, and the second is much larger. Separated with a control:

| probe | showdown | medicham | what it isolates |
|---|---|---|---|
| `ditto struggle -> glaceon` | 10-12 | 15-18 | **STAB** — Ditto is Normal, ratio exactly 1.5 |
| `gallade struggle -> gengar` | 51-60 | **0-0** | **the type chart** — a non-Normal attacker, so no STAB to confound it. We apply the Normal→Ghost **immunity**; the authority does not, because the move is typeless |
| `ditto struggle -> aggron` | 5-7 | 1-2 | both at once (Steel/Rock resists Normal 0.25x) |

**NOT FIXED — the brief forbids touching `engine/medicham2-browser.js` this pass, and the type lives
in `data/engine-data.js`, which belongs to MEASURE.** Filed as its own batch.

Weight, stated honestly: `tags.moves.struggle.uses` is **0**. Struggle is what happens when a mon has
no PP. It is 7 of 6,000 sampled rows only because `move-priors.json` gives Ditto essentially nothing
else. It is real and it is worth almost nothing competitively — but the gate is `disagreed === 0`.

---

## WHICH SCOREBOARD, DECLARED BEFORE THE RUN

**The lab moves; the pinned pool must not.** It did not, and the proof is structural rather than a
re-run: **no engine byte changed** (`git diff --name-only` = `tests/test-engine-diff.js`,
`data/engine-diff.json`, `data/published-samples.json`), and `engine/game_differential.js` mentions
`engine-diff` only in two comments — it has no code dependency on this artifact. A whole-game
re-run was deliberately NOT launched: two MEASURE agents were live and writing
`data/mechanics-census.json`, and CLAUDE.md's rule about reading an artifact another process is
writing applies to producing one beside them too.

**The census could not move either** and was NOT regenerated, for the same reason: zero engine bytes
changed, and `tests/test-mechanics.js` and `data/mechanics-census.json` were being written by
another agent at the time.

---

## CLASS, NOT INSTANCE — what this harness STILL skips, enumerated

The harness replays selected lines of `useMoveInner` and then enters at `moveHit`. After this pass
it runs `setActiveMove`, `ModifyType` and `ModifyMove`. It still does not run:

| skipped | where the authority runs it | consequence today |
|---|---|---|
| `runEvent('ModifyTarget')` | `battle-actions.ts:415` | redirection (Lightning Rod, Storm Drain, Follow Me) is invisible. Out of scope by construction — this harness names one target |
| `getMoveTargets` / `move.spreadHit = true` | `:465`, `:551` | **a spread move is priced single-target on BOTH sides**, so the 0.75 spread reduction is never applied by either engine and the rows agree for the wrong reason. Silent |
| `singleEvent('Try')` + `runEvent('PrepareHit')` | `:590-592` | Parental Bond (now SKIPPED), and **Protean / Libero**, which retype the attacker. MEDICHAM applies Protean in the turn loop, not in `dmgRange`, so both sides miss it and those rows are green while asking nothing |
| `hitStepInvulnerabilityEvent`, `hitStepTypeImmunity`, `hitStepTryHitEvent` | `:556-565` | the defender's `onTryHit` is *emulated* by CONTROL FIX 5 and 10 for the abilities the artifact names. Everything else on those steps is unrun |
| `hitStepAccuracy` | `:568` | deliberate — WIRE 124's accuracy conformance block is the separate guard |
| `hitStepBreakProtect`, `hitStepStealBoosts` | `:571-574` | Feint / Spectral Thief unmodelled here |
| `hitStepMoveHitLoop` | `:577` | multi-hit. 134 move rows and 17 ability rows are skipped on this |
| everything after the hit | `:312` `AfterMove`, recoil, drain, secondaries, `onUpdate` | Disguise's second packet, the `SUSPECT` marker's whole reason |

**Is the right long-term shape to call the authority's own path?** The candidate is
`hitStepMoveHitLoop` — one level up, below the accuracy step, and it would fix the multi-hit family
(both the move and the ability halves) in one move rather than by three separate skips. **It is a
much larger change than it looks**: it sums damage over hits, breaks on faint, runs `PrepareHit`
(so Protean lands and Protean rows would go red against an engine that applies it a level up), and
would make the existing `MULTIHIT` skip policy incoherent. It is a real proposal and it is not this
pass's; it needs its own batch and its own before/after row set.

---

## OWED, NOT RUN

Nothing below was run.

```
node tests/test-mechanics.js              # NOT run — another agent held the census this session
node tests/run-all.js
tools\lownode.cmd engine\quarantine.js
SHOWDOWN_PATH=... node engine/game_differential.js --release <fresh id> --team-store data/team-pool-frozen --state
node engine/status.js --write
```

- **`engine/quarantine.js` was not run.** Its differential clause requires `disagreed === 0` and the
  artifact now reads 7, so the gate stays RED — for one named engine defect instead of six harness
  ones.
- **`tests/test-no-silent-failure.js` is RED and was red before this pass** — 95 NEW since the
  baseline, none of them in `tests/test-engine-diff.js` (verified by stashing this pass's change and
  re-running: 877 catch blocks before, 878 after, the file appears nowhere in the report). Not filed,
  not mine, stated.
- `shiftgear` and `spinout` are the only two `move-priors.json` moves with no `MC.moves` row. Both
  belong to Revavroom, which is **not drawable at all** (`NOT COMPARABLE` on every move), so neither
  can reach a comparison. Checked and cleared so nobody re-derives it.

## PROPOSED REGISTER ROW (not written — `docs/ROADMAP.md` is not this division's to edit)

> *"Struggle is typeless and this engine types it Normal. `data/moves.ts` `struggle.onModifyMove`
> sets `move.type = '???'`; `MC.moves.struggle` carries `t: 'Normal'`. Two consequences, separated
> with a control: a Normal attacker gets a 1.5x STAB it should not have (`ditto struggle -> glaceon`
> 15-18 against the authority's 10-12), and — the larger half — the Normal→Ghost immunity is applied
> where the authority has none (`gallade struggle -> gengar`, MEDICHAM 0-0 against 51-60, a
> non-Normal attacker so STAB cannot confound it). Surfaced by CONTROL FIX 14 in
> `tests/test-engine-diff.js`; before it, both engines were wrong the same way and the rows scored
> AGREE. 7 of 6,000 rows at seed 20260804. `tags.moves.struggle.uses` is 0 — expect the lab to move
> and the pinned pool to sit still. The type lives in `data/engine-data.js`, which is MEASURE's."*
