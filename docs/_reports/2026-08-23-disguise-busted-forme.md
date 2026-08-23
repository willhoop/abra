# Disguise fires on the already-busted forme — the gate was a runtime flag where the authority reads a species

ENGINE, 2026-08-23. Batch of one.

---

## THE DEFECT, AND THE COMMENT THAT SAID THE OPPOSITE

`engine/medicham2-browser.js`, `formeOnHitAbsorbs` — the ONE reader of the `formeOnHit` tag, called by
`dmgRange` (`:8324`, the hypothetical price every board feature and rollout leaf asks) and by the battle
loop's break path (`:21704`).

```js
function formeOnHitAbsorbs(tg){
  if(!tg||tg._disguiseBusted)return null;      // the RUNTIME FLAG, and nothing else
```

The header directly above it read *"an unbuilt hypothetical body has it undefined, which correctly reads
as INTACT."* That is exactly backwards for the body this engine is handed most often.

The authority gates on the SPECIES (`data/abilities.ts:962-968`; the Champions mod at
`data/mods/champions/abilities.ts:14` declares `disguise: { inherit: true, onEffectiveness(...) }` and
therefore inherits `onDamage` and `onUpdate` UNCHANGED — so mainline is the right file to read for this
handler and the mod was checked rather than assumed):

```js
onDamage(damage, target, source, effect) {
  if (effect?.effectType === 'Move' && ['mimikyu', 'mimikyutotem'].includes(target.species.id)) {
    this.add('-activate', target, 'ability: Disguise');
    this.effectState.busted = true;
    return 0;
  }
}
```

`effectState.busted` is bookkeeping for `onUpdate`. **What refuses the second hit is that the body is now
`mimikyubusted` and is not on that list.**

### AND THE BUSTED BODY IS BUILDABLE, WHICH IS WHAT MAKES THIS REACHABLE

```
$ node -e "require('./data/engine-data.js'); console.log(JSON.stringify(MC.mons['mimikyu-busted']))"
{"t":["Ghost","Fairy"],"bs":{...},"st":{...},"mv":[...],"item":null,"ab":"Disguise","wt":0.7,"base":"mimikyu"}
```

`MC.mons` CARRIES a `mimikyu-busted` row with `ab: "Disguise"`. So `buildMon('mimikyu-busted')` returns an
already-busted Mimikyu with `_disguiseBusted` undefined, the flag-only gate read that as an intact
disguise, and the body ate a hit it must not.

Reproduced before touching anything (Machamp Rock Slide, bare bodies, item and ability blanked):

| defender | ability | `dmgRange` |
|---|---|---|
| `mimikyu` | disguise | 0-0 |
| **`mimikyu-busted`** | **disguise** | **0-0**  ← the defect |
| `mimikyu-busted` | none | 18-22 |
| `mimikyu` | none | 18-22 |

---

## THE CLASS

**`formeOnHit` has exactly ONE member in this regulation.** Derived, not recalled:

```
$ node -e "const T=require('./data/tags.json'); for(const k of ['abilities','items','moves'])
    for(const [n,v] of Object.entries(T[k]||{})) if(JSON.stringify(v).includes('formeOnHit')) console.log(k,n)"
abilities disguise
```

`disguise.params.formeOnHit` = `{"from":"Mimikyu","becomes":"Mimikyu-Busted","sameStats":true,"sameTypes":true,"costsMaxHPDiv":8}`.

**Ice Face — the mechanic's other member upstream — has ZERO legal carriers here.** Checked rather than
assumed, since the brief flagged it as a note rather than a fact:

```
$ SHOWDOWN_PATH=... node -e "... D.species.get('eiscue') ..."
eiscue      exists true  nonstd Past  tier Illegal  battleOnly undefined      ab {"0":"Ice Face"}
eiscuenoice exists true  nonstd null  tier Illegal  battleOnly "Eiscue"       ab {"0":"Ice Face"}
```

Confirmed: `data/tags.json` has no `iceface` entry at all, because `tag_dex.js`'s `LEGAL_CARRIED` filter
drops it. So there is no second member to give a busted forme to, and the "does every member have a
busted forme with the same hazard" question has a one-row answer.

**The busted-forme relationship is DERIVED, not typed.** `tag_dex.js` builds `from`/`becomes` off the
dex's `battleOnly` link — a battleOnly forme names its base and the base carries the trigger ability — so
the fix reads `fh.from` and a member added upstream arrives with its own pair.

**Declared scope limit.** The authority's whitelist has TWO ids and the tag names one, because
`mimikyutotem` is `isNonstandard: 'Past'` / `tier: 'Illegal'` in Champions and has no `MC.mons` row. No
body this engine can build is ever that species. If a totem forme is legalised, the tag derivation
returns the FIRST `battleOnly` match and would name one pair of two — that is a `tag_dex.js` change, not
a change in the engine. Recorded here so the next reader does not have to re-derive it.

---

## THE FIX

`formeOnHitAbsorbs` now asks BOTH: the species must be the one the tag names as the intact forme, AND the
runtime flag must not already be set. Both sides go through `pasteKey` (the in-file doorway `formeSwap`
already uses for this exact species pair — this file is baselined as an exception to `engine/mc_key.js`
because it is a browser file and cannot `require`) and are then flattened, so a hyphenated table key and a
raw tag name cannot compare unequal for the same forme.

Two loud counters rather than a silent refusal:

- `MEDFAILS.formeOnHitNoSpecies` — a carrier reached the gate with no species on the body. A silent
  refusal there is indistinguishable from the ability being unwired, which is the state this whole block
  was filed about.
- `MEDFAILS.formeOnHitNoFromSpecies` — the tag carried no `from`. Never expected; `tag_dex.js` cannot
  emit `becomes` without `from`.

Both read **0** on every run in this pass.

The header comment is rewritten and quotes the handler it now mirrors.

---

## PROOF — RED FIRST, WITH THE CONTROL CLEARED

**`MEDI_FORMEONHIT_SPECIES_BLIND=1`** restores the flag-only gate and nothing else. Any run carrying it
also carries a non-zero `MEDFAILS.formeOnHitSpeciesBlindRestored`, so a deliberate restore arm and a
broken engine can never be read as the same thing.

New census probe: `ability / formeOnHit — "a body that is ALREADY the busted forme absorbs nothing"`.
One Corviknight Iron Head, one click, three bodies, through `battleTurn` (not `dmgRange` — the ratchet's
real-turn rule), the target made unfaintable so a KO cannot clamp two arms into agreement:

| arm | HP lost | body after |
|---|---|---|
| `mimikyu` + Disguise (control — the ability must still WORK) | **130** = maxhp/8 | `mimikyu-busted` |
| `mimikyu-busted` + Disguise (the defect) | **170** | `mimikyu-busted` |
| `mimikyu-busted` + no ability (the ruler) | **170** | `mimikyu-busted` |

`works` requires all three: the intact arm loses exactly the chip and renames itself, the busted arm loses
MORE, and the busted arm equals the blanked-ability arm.

**What would make this green while the engine stayed wrong?** Deleting the absorb entirely satisfies
"the busted body takes damage" — and fails the intact arm. "Takes some damage" passing for "takes the
move" is refused by the third arm. Under the knob:

```
intact {"lost":130,"eighth":130,"name":"mimikyu-busted"}
busted {"lost":130, ...}      <- absorbs
noAbil {"lost":170, ...}
WORKS= false     MEDFAILS.formeOnHitSpeciesBlindRestored = 6
```

---

## MEASURED

### The census — the lab, and it moved

| | probed | live | missing |
|---|---|---|---|
| HEAD (`git show HEAD:data/mechanics-census.json`) | 642 | **642** | 0 |
| after | 643 | **643** | 0 |

0 probes threw, 0 hollow, 0 unarmed, directCall unchanged at 1.

### The damage differential — 15 rows, exactly

`tests/test-engine-diff.js --n 6000 --seed 20260804`, both arms on the SAME tree, the env knob the only
variable:

| arm | compared | disagreed |
|---|---|---|
| `MEDI_FORMEONHIT_SPECIES_BLIND=1` (the pre-fix engine) | 6000 | **56** |
| clean | 6000 | **41** |

The knob arm reproduces the published baseline of 56/6000 exactly, which is what says the knob really is
the old behaviour. **Every one of the sixteen corner arms fell by exactly 15**:

```
top    55 -> 40      bottom 58 -> 43      idx01..idx09 56 -> 41      idx10..idx14 57 -> 42
```

`JSON.stringify(artifact).match(/mimikyubusted/g)` → **0**. Not one row of any arm still names the busted
forme. Cleared rows include `machamp rockslide -> mimikyubusted 57-68 vs 0-0`,
`machamp knockoff -> mimikyubusted 50-59 vs 0-0`, `gyaradosmega hurricane`, `vivillonpolar hurricane`.

### The pinned pool — MEASURED as not moving, and the mechanism says why

Called before running it: the pool should NOT move. In a played game the same loop that renames the body
sets `_disguiseBusted`, so the flag-only gate was already correct there; and `game_differential.js`'s
`freshBodies` builds from the SHEET spec once per arm, and a sheet declares `Mimikyu`, never
`Mimikyu-Busted`. The defect is only reachable through a CONSTRUCTED already-busted body.

Run anyway, because a mechanism argument is not a measurement.
`engine/game_differential.js --games 961 --team-store data/team-pool-frozen`, live tree, knob the only
variable, `--out` to the scratchpad so the published artifact was not touched:

| arm | games | diverged |
|---|---|---|
| knob ON (pre-fix) | 777 | 93 |
| clean | 777 | 93 |

**The `first_divergences` lists are byte-identical (60 entries each, same seed/index/class).** Same
sample, same 777 games, so the instrument COULD have seen a difference and did not.

**Do not read 93/777 against the published 82/961.** That artifact was cut on release `c36782953dee`;
this is the live tree and a different stopping point. The only comparison this run supports is its own
two arms.

The pool is not empty of the entity, which is what makes the null informative rather than vacuous:
205 of 34,762 frozen-pool sheet sides carry Mimikyu, and a busted forme appears in 125 of its
17,381 games.

---

## IS THE LIVE / INGEST PATH REACHABLE? YES — WITH EVIDENCE

The brief asked this to be derived, not asserted.

**1. The ingest observes the busted forme, and more often than the intact one.**
`data/move-priors.json` carries `species.mimikyubusted` with **876 acts** against `species.mimikyu`'s
**485**. Across the two stores, **1,022 of 83,892 games** contain a busted Mimikyu forme, against 1,660
containing a Mimikyu at all — so roughly 62% of the games a Mimikyu appears in, it gets busted, which is
the mechanic working.

**2. The tracker's species resolves, so `dmgMon` does NOT miss.** Run through `engine/board.js`'s own
exported entry points on an observed-shaped body:

```
Mimikyu        | mcKeyFor -> mimikyu        | dmgMon -> mimikyu ab=disguise        | knockoff 0-0
Mimikyu-Busted | mcKeyFor -> mimikyu-busted | dmgMon -> mimikyu-busted ab=disguise | knockoff 50-59
dmgFailures.unknownSpecies = 0
```

and the same script with `MEDI_FORMEONHIT_SPECIES_BLIND=1`:

```
Mimikyu-Busted | ... | knockoff 0-0        <- the pre-fix live path
```

50-59 is exactly what Showdown reports for `machamp knockoff -> mimikyubusted` in the differential.

So: **every board feature, every rollout leaf and every `punishExposure` price computed for an observed
Mimikyu-Busted read ZERO damage before this fix.** Not a modelling gap that counted itself — a plausible
number, silently wrong, on a body the ingest sees 876 times.

### A FINDING THAT IS NOT MINE TO FIX — `engine/board.js` CARRIES A STALE COMMENT

`engine/board.js:1449-1456`, inside `dmgMon`:

> *"An IN-BATTLE forme change produces one it has not: `aegislashblade`, `palafinhero`, `mimikyubusted`,
> `morpekohangry`. Their stats differ from the base forme … and there genuinely is no body to compute
> with."*

Measured above: `mcKeyFor('Mimikyu-Busted')` resolves to `mimikyu-busted`, `dmgMon` returns a real body,
and `dmgFailures.unknownSpecies` stays at 0. The row was added to `data/engine-data.js` since that
paragraph was written. The comment is now the opposite of what the code does — the same shape as the
comment this pass fixed, and this repo has now been bitten by that three times this week.

**REPORTED, NOT TOUCHED.** `board.js` is downstream of ENGINE and off-limits. It is a comment, so nothing
computes wrongly from it today; what it costs is the next reader believing a declared miss that no longer
happens. Routing: MEASURE (it is a claim about an artifact's coverage), or whoever owns the `board.js`
refit.

---

## OWED, NOT RUN

- **`git add` / commit — NOT DONE, deliberately.** ANOTHER AGENT WAS WRITING TO THIS TREE THROUGHOUT THE
  PASS. At my first `git status` the tree held only the untracked `data/_pair-pilot.json`; by the end it
  held, none of it mine: `.githooks/pre-commit`, `docs/ROADMAP.md`, `tests/test-docs-current.js`,
  `tests/test-effective-identity.js`, `tests/test-unmodelled-clicks.js`, `tests/test-forme-assert.js`,
  `tests/test-game-diff.js`, `tests/test-tag-consumed.js`, plus three new `docs/_reports/2026-08-23-*.md`
  — several of them stamped inside the last minute. The brief's condition was "if the tree is otherwise
  clean"; it is not, so this stays OWED.

  **The measurements are unaffected and that was checked rather than assumed:**
  `git diff engine/medicham2-browser.js` shows exactly my three hunks (`@@1744`, `@@8666`, `@@8862`) and
  no others, at the end of the pass as at the start. The concurrent edits are all in files no run of
  mine loads.

  **The commit, when the tree settles:**

  ```
  git add engine/medicham2-browser.js tests/test-mechanics.js \
          data/mechanics-census.json data/engine-diff.json \
          docs/ENGINE.md docs/MEDICHAM-SPRINT-NOTES.md CHANGELOG.md \
          docs/_reports/2026-08-23-disguise-busted-forme.md
  ```

  Also touched by my runs, not by me, and needing a judgement from whoever commits:
  `data/engine-release.json` (both differential runs auto-cut release `3d9df7ce4996` over the fixed
  tree), `data/published-samples.json`, `data/unmodelled-clicks.json`, `data/provenance-stamp.json`, and
  the four `status.js --write` ledgers `docs/{ENGINE,MEASURE,SEARCH,OPS}.md`.
- **The version bump to 5.91.3 may collide.** If the concurrent agent also lands, one of the two entries
  needs renumbering.
- `tests/test-mc-key.js` is **RED and was RED before this pass** — proved by stashing my two files and
  re-running: identical failure, naming `engine/rollout_seed_prevalence.js`, `tests/probe_red_demo.js`,
  `tests/test-rollout-seed.js`, `tests/test-seed-clock.js`, `tests/test-seed-residue.js`. Not mine, not
  fixed here, and stated rather than filed. Its "no baselined file grew more of them" clause passed, so
  this change added no hand-rolled lookup.
- The **roster**, the **interaction matrix**, `tests/test-protocol-trace.js` and `engine/quarantine.js`
  were NOT re-run. Nothing here changes narration or a tag, but that is an argument, not a measurement.
- **`onlySpecies` was NOT added to the `formeOnHit` tag derivation.** `tag_dex.js` already has the
  `[...].includes(target.species.id)` extraction shape (it is how `flattensTypeMatchup` gets Disguise's
  two ids). Adding it would make the gate mirror the authority's whole list instead of one derived pair —
  but it means regenerating `data/tags.json` and `data/abra-tags.js`, which is a second change in a batch
  of one. Proposed as a register row below.

---

## PROPOSED REGISTER ROWS

> **`formeOnHit`'s species gate names one forme where the authority names two.** `formeOnHitAbsorbs`
> compares the body against the tag's derived `from`. The authority whitelists
> `['mimikyu','mimikyutotem']`. Today the second is `isNonstandard: 'Past'` / `tier: 'Illegal'` with no
> `MC.mons` row, so nothing can stage it and the gate is exact. Close it by teaching `tag_dex.js`'s
> `formeOnHit` derivation the `[...].includes(target.species.id)` extraction it already uses for
> `flattensTypeMatchup`, and having the engine test membership of a LIST. Blocked only by the tags
> regeneration, which is its own batch. ENGINE.

> **`engine/board.js:1449` declares a miss that no longer happens.** Its `dmgMon` header names
> `mimikyubusted` among the in-battle formes with "no body to compute with". `data/engine-data.js` has
> carried the row since ROADMAP #204 landed it on 2026-08-22 (ENGINE.md:1853-1855); measured 2026-08-23,
> `mcKeyFor` resolves it,
> `dmgMon` returns a real body and `dmgFailures.unknownSpecies` is 0. Comment only — nothing computes
> from it — but it is the third opposite-of-its-code comment this week. Not ENGINE's file. MEASURE.
