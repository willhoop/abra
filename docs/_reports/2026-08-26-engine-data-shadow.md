# `data/engine-data.js` — shadow build against a blindfolded builder

MEASURE, 2026-08-26. Measurement only. No repository byte was changed.

`data/engine-data.js` sha256 **before**: `c73da1d25212f447747ff645ceac613707d812060af1fe97a30b4f79b6773d3a`
`data/engine-data.js` sha256 **after** : `c73da1d25212f447747ff645ceac613707d812060af1fe97a30b4f79b6773d3a`

201,101 bytes, mtime 2026-08-22 01:46, unchanged throughout. Re-hashed three times mid-pass, not
only at the ends, because two of the generators driven below write their output unconditionally.

---

## 1. Method — DRIVEN, not reimplemented

The builder's own bytes ran. Nothing here reimplements its merge, so there is no second copy of the
rule to go stale.

A preload (`node -r blindfold.js`, session scratchpad, not in the repo) patches exactly two calls:

- **`fs.readFileSync`** on the resolved absolute path of `data/engine-data.js` returns the REAL file
  with only its payload replaced by `const MC = {};`. The wrapper, `mcEff`, the export block and the
  line endings are the artifact's own, so the only thing withheld is the self-read.
- **`fs.writeFileSync`** on that same path is redirected out of the tree, and says so with a byte
  count.

Everything else — `champ-model.js`, the Champions dex, `data/tags.json` — passes through untouched.
The preload counts its own interceptions and warns when the count is not what the builder's shape
implies, because attachment is not liveness.

### The green control came first

Driven in **pass-through** mode (content NOT blindfolded, write still redirected), the builder
reproduces the live artifact:

```
mons   differs on 1 row: floette-eternal-mega   (ONLY IN CONTROL)
moves  IDENTICAL (500)
C      IDENTICAL (18)
priors IDENTICAL (230)
wrapper / mcEff / exports  identical
```

That single row is the pre-measured drift, reproduced independently. **The harness is therefore
proven on every row not in dispute before it is trusted on any row that is.**

---

## 2. The three pre-measured facts

**Fact 1 — one row of drift. CONFIRMED.** champ-model carries 308 mon rows; exactly one,
`floette-eternal-mega`, is absent from the artifact. The control diff is that row and nothing else:
moves, type chart, priors and the wrapper all reproduce byte-for-byte.

One correction to the framing: the artifact holds **322** mon rows, not 321 — 308 champ-model keys,
minus `floette-eternal-mega`, plus 15 preserved rows.

**Fact 2 — 10 null weights, none declared. CONFIRMED, with the mechanism.** The ten are
`victreebel-mega, feraligatr-mega, skarmory-mega, barbaracle-mega, falinks-mega, aegislash-blade,
gourgeist-small, gourgeist-large, gourgeist-super, palafin-hero`. All ten are PRESERVED rows, and
the `wt` fill iterates `M.MONS`, so a preserved row is structurally unreachable by it. The dex
returns a weight for all ten on the artifact's own key spelling: 125.5, 108.8, 40.4, 100, 99, 53,
9.5, 14, 39, 97.4 kg. The builder's own census prints them as `UNEXPLAINED: 10`.

**Fact 3 — the Castform formes. NEITHER a data gap nor a mechanic gap.** See section 3.

---

## 3. Castform — the rows exist; the lookup key was the problem

```
castform          t=["Normal"]  bs=70/70/70/70/70/70  ab=forecast  wt=0.8   ROW
castform-sunny    t=["Fire"]    bs=70/70/70/70/70/70  ab=Forecast  wt=0.8   ROW
castform-rainy    t=["Water"]   ...                                         ROW
castform-snowy    t=["Ice"]     ...                                         ROW
castformsunny / castformrainy / castformsnowy                               NO ROW
```

The artifact keys them **hyphenated**. `engine/mc_key.js` resolves
`castformsunny -> castform-sunny`, and `medicham2-browser.js:6826` routes `buildMon` through
`mc_key` when it can load it. The rows are present, correctly typed Fire / Water / Ice, and
reachable.

**So no regeneration is needed on Castform's account.** This is worth stating loudly: the absence
was reported against an unhyphenated key, and an equality check run against the wrong key spelling
manufactures a missing row out of nothing.

One real observation, reported and not fixed: the three formes carry `ab: "Forecast"` **capitalised**
while base `castform` carries `ab: "forecast"`. Every other row in the artifact is normalised
lower-case. These are preserved rows that no builder has touched since, which is exactly how an
un-normalised value survives.

---

## 4. The delta — what a pure builder would destroy

### 4a. Field-by-field, if `build_engine_data.js` alone is made pure

Shadow: `data/verification/engine-data-SHADOW-pure-2026-08-26.js.txt` — **86,252 bytes against the
live 201,101. 57% of the artifact's content has no upstream inside this builder.**

```
mons: live 322 rows, shadow 308 rows
  ONLY IN LIVE  (destroyed): 15
    castform-snowy, castform-rainy, castform-sunny, morpeko-hangry, mimikyu-busted,
    victreebel-mega, feraligatr-mega, skarmory-mega, barbaracle-mega, falinks-mega,
    aegislash-blade, gourgeist-small, gourgeist-large, gourgeist-super, palafin-hero
  ONLY IN SHADOW (added)   : 1   floette-eternal-mega
  rows differing in >=1 field: 307 of 307   -- i.e. EVERY surviving row

  GROUPED BY FIELD
    st              CHANGED  307   pure derives a neutral 0-investment L50 line
    item            EMPTIED  307   -> null
    ab              EMPTIED  307   -> null
    mv              EMPTIED  303   -> []
    set_source    DESTROYED  229   field ceases to exist
    nature        DESTROYED  195
    sp            DESTROYED  195
    base          DESTROYED   75   (mega rows)
    mega          DESTROYED   75   (mega rows)
    mv_provenance DESTROYED   75   (mega rows)

moves: 500 vs 500 rows, ZERO rows differing in ANY field
C:    identical
priors: live 230 rows, shadow 0
```

**Totals: 15 mon rows (120 field values) + 2,068 field values on surviving rows + 230 priors rows
= 2,418 values with no upstream source inside this builder.**

`ab`, `mv` and `item` are emptied on **307 of 307** rows. That is the 2026-07-30 shape reproduced
across the whole artifact rather than across 67 mega rows.

The one genuinely reassuring line in that block: **the 500 move rows are fully regenerable.** The
`tags.json`-intersect-dex backfill reproduces all 500 with zero field differences, so the builder's
own header is pessimistic when it lists `moves[k].t` and `.c` as unprovable. They are provable, and
they pass.

### 4b. THE FINDING THAT REFRAMES THE QUESTION — the self-read is not preserving hand corrections

`data/engine-data.js` is written by **four generators in sequence**, not one. The self-read is how
`build_engine_data.js` avoids clobbering its three siblings' output:

| field(s) | written by | upstream |
|---|---|---|
| `t`, `bs`, `wt`, the key set, `C` | `build/build_engine_data.js` | champ-model + the dex |
| `moves` (all 500) | `build/build_engine_data.js`, tags-intersect-dex backfill | `data/tags.json` + the dex |
| `ab`,`mv`,`item`,`nature`,`sp`,`st`,`set_source` | `build/rebuild_sets_from_sheets.js --write` | `data/species-sets.json`, from open team sheets |
| `base`,`mega`,`mv_provenance`, the mega rows | `engine/merge_mega_into_engine.js` | `data/mega-dex-official.json` + the sheet store |
| **`priors` (230 rows)** | **nothing in this repository** | — |

So the correct measurement is not "what does a pure builder destroy" but **"what does the whole
pipeline fail to put back."** Both shadows were therefore chained, driven the same way:

```
B) rebuild_sets_from_sheets.js --write   on the pure shadow
   308 species, 195 rebuilt from real sheets, 113 left alone (<10 sheets), 195 materially changed
C) merge_mega_into_engine.js             on B
   added 10 rows, updated 75, mega formes now 80, 76 movesets rewritten from open team sheets
```

Sanity check on the same generator against the LIVE artifact: `rebuild_sets_from_sheets` reports
**195 rebuilt, 0 materially changed, 0 illegal abilities fixed**. The live set fields are currently
in agreement with `species-sets.json`, so the recovery arm is measuring recovery and not repair.

### 4c. The residue — what the FULL pipeline still cannot put back

`data/verification/engine-data-SHADOW-plus-sets-mega-2026-08-26.js.txt` — 150,623 bytes.

```
mons: live 322, recovered 317
  DESTROYED PERMANENTLY (5 rows):
    castform-sunny, castform-rainy, castform-snowy, morpeko-hangry, mimikyu-busted
  rows differing in >=1 field: 116 of 317

  STRICTLY LOST (emptied or removed) --------------------- 185 field values
    mv              EMPTIED   40
    st              CHANGED   37   (falls back to the neutral line)
    item            EMPTIED   37
    ab              EMPTIED   37
    set_source    DESTROYED   34
  REGENERATED WITH DIFFERENT CONTENT (store drift, not loss) -- 90 field values
    mv_provenance   CHANGED   76   (mega rows)
    mv              CHANGED   14   (mega rows)

priors: 230 rows lost. No generator can put them back.
moves:  0 rows lost, 0 fields changed.
```

**Headline: 545 values have no upstream source — 5 mon rows, 185 field values on surviving rows, and
230 priors rows.**

A second reading of that table is worth having: re-running the pipeline today would **change 14 mega
movesets and all 76 `mv_provenance` blocks**, because the sheet store has grown since the artifact
was last built. The live artifact is stale against its own sources on those rows.

---

## 5. Hand correction or stale inheritance — the 37 orphan rows, with real values

The 37 rows whose `ab` survives only because it was inherited. Put to the dex:

```
  ability ILLEGAL for the species (stale inheritance)      0
  ability LEGAL for the species (plausible, unsourced)     3   tauros, forretress, glalie
  REPAIRED-TO-DEX-PRIMARY (derived, but patch-shaped)     34
```

**Zero illegal abilities.** All 34 "repaired" rows carry
`set_source.note = "under 10 sheets; ability replaced with the dex primary because the stored one was impossible"`.

That repair is DERIVED and correct, and a pure pipeline destroys it for a structural reason worth
naming. `build/rebuild_sets_from_sheets.js:129`:

```js
    const sp0 = DEX.species.get(name);
    if (sp0 && sp0.exists && mon.ab) {                 // requires the stale value to be PRESENT
      ...
      if (legal.size && !legal.has(norm(mon.ab))) {    // fires only if it is ILLEGAL
```

**The repair is conditioned on the thing it repairs.** With `ab: null` the branch never fires, so a
pure build deletes both the illegal value and its correction, leaving `ab: null` — which is worse
than either. That is a self-read dependency inside the *second* builder, one layer below the one
under investigation, and it is the reason the recovery arm does not reach zero.

The `mv` and `item` on those same 37 rows read the other way. Real values:

```
  arbok      ab=intimidate  item=lifeorb    earthquake/crunch/facade/protect
  garbodor   ab=stench      item=lifeorb    explosion/thief/facade/protect
  watchog    ab=illuminate  item=lifeorb    facade/crunch/dig/protect
  furfrou    ab=furcoat     item=leftovers  facade/crunch/dig/protect
  simisage   ab=gluttony    item=lifeorb    superpower/crunch/dig/protect
  simisear   ab=gluttony    item=lifeorb    superpower/crunch/dig/protect
  toucannon  ab=keeneye     item=lifeorb    fly/facade/thief/protect
```

Life Orb on 30 of 37, and `facade` / `dig` / `round` / `uproar` / `thief` recurring across unrelated
species. That is the marginal-frequency signature `engine/derive_sets.js` was written to condemn in
its own header — *"engine-data.js inherited one fictional set per species; Smogon-style marginals
invent sets"*. **These `mv`/`item` values are stale inheritance, not hand corrections.** Nobody
curated them; they are the residue of a foreign dataset.

**Weighted by the pinned pool** (`data/team-pool-frozen`, 17,381 games, 191,119 species-appearances):
the 37 orphans account for **634 appearances, 0.33%**, and 6 of the 37 never appear at all.

### The 5 permanently-destroyed rows, and why the pool cannot rank them

```
  castform-sunny  differs from castform on: t, ab, item    t=["Fire"]  vs ["Normal"]
  castform-rainy  differs from castform on: t, ab, item    t=["Water"] vs ["Normal"]
  castform-snowy  differs from castform on: t, ab, item    t=["Ice"]   vs ["Normal"]
  morpeko-hangry  differs from morpeko  on: ab, item       (types identical)
  mimikyu-busted  differs from mimikyu  on: ab, item       (types identical)

  pinned-pool appearances:  all five = 0
  base forme appearances:   castform 11, morpeko 43, mimikyu 205
```

**A zero here is not evidence of irrelevance — it is the wrong instrument.** The pool records what
players BROUGHT, and none of these five can be brought; they are in-battle states. Mimikyu is
brought 205 times and busts its disguise inside the game, at which point the engine looks up
`mimikyu-busted`. Castform's Forecast retypes it every weather turn.

The three Castform rows carry a **different TYPE from their base**, which is board-material: losing
them makes a sun-Castform read Normal instead of Fire, changing STAB and every effectiveness term.
`morpeko-hangry` and `mimikyu-busted` differ only in `ab`/`item`, and their `ab`/`item` are the same
inherited junk as above — so those two are near-free to lose and the three Castform rows are not.

### `MC.priors` — 230 rows, the largest genuinely-orphan block

No generator in this repository writes `MC.priors`. The only code that computes that shape is
`build/medicham-embed.js`, which projects `data/move-priors.json` to the top-6 per species — and
writes to `/tmp/mc-embed.json`, for the web embed, never into `data/engine-data.js`.

`data/move-priors.json` exists (stamped `generated: 2026-08-22`, 345 species). Projected through
`medicham-embed`'s own rule it reproduces **0 of 230** rows:

```
  charizard
    artifact [[heatwave,0.615],[protect,0.156],[weatherball,0.116],[solarbeam,0.062],...]
    rebuilt  [[protect,0.554],[heatwave,0.215],[weatherball,0.067],[airslash,0.029],...]

  mean PROTECT-class mass  artifact 0.122   upstream 0.146     (so NOT a definition change)
  TOP-1 MOVE AGREES ON 116 OF 230 SPECIES                      (50.4%)
```

This is the opponent behaviour-clone the rollout samples from — `medicham2-browser.js:11696`,
`const pr = MC.priors[me.name]`. It covers 230 of 345 species and **disagrees with the current
corpus about the single most likely click on half of them.** Regenerating it changes what the
rollout believes the opponent does, so it is a decision with a measurement attached rather than a
chore, and it belongs to whoever owns the opponent model, not to this builder.

---

## 6. Completeness — an equality check cannot see an absence

Derived from the format, filtered by CARRIER, with every exemption itself derived.

```
SPECIES — legal in the format 347, rows in the artifact 322
   29  resolved by engine/mc_key.js to an existing row
       (vivillon* pattern formes, castform*, and other cosmetic formes)
    0  UNEXPLAINED — a legal species with no row and no derived reason

MOVES — legal moves in the format 500
  497  have >=1 LEGAL CARRIER (some legal species, or its prevo chain, learns it)
    0  legal, carried, and ABSENT from MC.moves
    3  legal with NO legal carrier, so legitimately out of scope
  500  rows in MC.moves
    3  rows in MC.moves with no legal carrier: powershift, spore, struggle
```

**Zero missing entities in either dimension.** `struggle` is correctly present despite having no
carrier — it is the no-legal-move fallback and is never learned. `spore` and `powershift` are legal
in the format with no legal carrier; harmless rows, and their presence is not a defect.

**No hand-maintained exempt list was needed, and one should not be introduced.** Every exemption
above is derived at run time: `mc_key` resolution, `species.battleOnly`, base-stat and type identity
against `baseSpecies` for cosmetic formes, and the learnset walk for carriers. A typed list here
would be the ban-list-of-four shape and would rot the first time a forme is added.

Caveat on the carrier walk, stated rather than hidden: it uses `getLearnsetData` over legal species
plus up to six `prevo` hops. A move reachable only through a longer or non-`prevo` path would be
misfiled as carrier-less. It fired on 3 moves out of 500 and all three are explicable, so the walk
is not doing damage — but the number to trust is "0 missing", not "exactly 3 carrier-less".

---

## 7. Seen and deliberately NOT fixed

Reported, left alone, no bytes moved:

1. `castform-sunny/rainy/snowy` carry `ab: "Forecast"` capitalised where every other row is
   lower-case normalised.
2. The 10 null `wt` rows are all preserved rows, all knowable from the dex on their own key
   spelling. Four weight-scaled moves are UNCOMPUTABLE on them, not mispriced.
3. `data/move-priors.json` has an mtime of 2026-08-26 08:48 and an internal stamp of 2026-08-22.
   Touched without being restamped, or restamped without being rewritten — either way the two do not
   agree and nothing compares them.
4. `build/rebuild_sets_from_sheets.js:129` gates its illegal-ability repair on `mon.ab` being truthy,
   so the repair cannot fire on a fresh row.
5. Three new files were written by this pass, all under `data/verification/`, all named `*.js.txt`
   rather than `*.js` **on purpose**: the artifact wrapper executes `root.MC = MC` on `globalThis`,
   so a stray shadow copy with a `.js` extension is one careless `require` away from replacing the
   live damage table in a running process. Nothing in the repo globs `data/verification/`, so this is
   belt-and-braces, but the failure it prevents is the eleven-instrument-failures shape.

Artifacts written by this pass, all new, none overwriting anything:

```
data/verification/engine-data-SHADOW-pure-2026-08-26.js.txt            86,252 bytes
data/verification/engine-data-SHADOW-plus-sets-2026-08-26.js.txt      133,487 bytes
data/verification/engine-data-SHADOW-plus-sets-mega-2026-08-26.js.txt 150,623 bytes
```

---

## OWED, NOT RUN

- **Whether `MC.priors` should be regenerated from `data/move-priors.json` at all.** Measured that
  it would change the modal click on 114 of 230 species; NOT measured what that does to any rollout,
  leaf value or win rate. That is a leaf-calibration question sitting behind the MEDICHAM quarantine
  and it was not touched.
- **Whether the 3 Castform rows are actually READ during a game.** Proved the rows exist, are typed
  correctly, and that `mc_key` resolves the unhyphenated spelling to them. Did NOT play a game and
  did not instrument the Forecast path, so "reachable" is proved and "reached" is not. MEASURE may
  not play a game; this is ENGINE's to counter.
- **Whether `engine/mega_sets_from_sheets.js` recovers anything the other two do not.** It was read
  and not driven — it takes no `--write` into `engine-data.js` and appears to be a source for
  `merge_mega_into_engine.js` rather than a writer of the artifact. Unverified.
- **`build/build_browser_data.js` and `build/build_scoreboard.js`** both reference
  `data/engine-data.js` and both call `writeFileSync`. Neither was inspected for whether it writes
  BACK into the artifact. If either does, the four-generator table above is incomplete and every
  count in section 4c is a lower bound.
- **A re-derivation of `data/species-sets.json` itself.** The recovery arm trusts it as upstream. It
  is produced by `engine/derive_sets.js` from the sheet store and was NOT re-run or stamped, so the
  claim "195 rows are recoverable" is conditional on that file being current.
- **The `bs`/`t` correctness of the 15 preserved rows.** They agree with themselves by construction
  and nothing in this pass compared them to the dex.
- **The three `.js.txt` shadows are not stamped with an engine release.** They are a diff input, not
  a published figure, and should not be cited as one or carried forward past this report.
