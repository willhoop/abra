# The ten weightless rows of `data/engine-data.js` — 2026-08-29, ENGINE

**VERDICT.** **Ten rows really are weightless, and the key is ABSENT rather than `null`** — the
filed card's `wt: null` does not appear in the file at all (`grep -c '"wt":null'` = 0). **The
generator CAN derive the value**: the Champions dex knows the weight of all ten, so
*"uncomputable rather than wrong"* was wrong in its diagnosis as well as in its severity. **Six of
the ten cross a Low Kick / Grass Knot bracket**, exactly the six the card named, confirmed twice —
against the authority's own `basePowerCallback` and against measured damage. **`artifact_audit.js`
would NOT have caught this and would not catch a second instance**; the reason is now written into
its own header. **Fixed at the generator (`build/build_engine_data.js`); `data/engine-data.js` was
NOT regenerated** — see OWED.

**And the card understated it a second time.** The fallback is not always the base forme's weight.
A body *built* at one of these formes gets `wt: null` and the move falls through to its dex
`basePower` of **0**: a pasted `Victreebel @ Victreebelite` takes **1** from a Low Kick that should
deal **55**.

---

## 1. THE COUNT, WITH THE STRUCTURE PRINTED FIRST

`data/engine-data.js` exports `{ MC, mcEff }`; `MC` holds `{ mons, moves, C, priors }`; `MC.mons`
has **322 rows**.

```
rows where typeof wt !== 'number' : 10
victreebel-mega feraligatr-mega skarmory-mega barbaracle-mega falinks-mega
aegislash-blade gourgeist-small gourgeist-large gourgeist-super palafin-hero
```

`hasOwnProperty('wt')` is **false** on every one — the field is missing, not null. Two row shapes:
six carry `mega`/`mv_provenance` (written by `engine/merge_mega_into_engine.js`), four carry only
`base`. All ten also live in **`data/mc-declared-rows.json`**, which holds 15 rows; the other five
(`castform-sunny/rainy/snowy`, `morpeko-hangry`, `mimikyu-busted`) **do** carry `wt`.

## 2. WHERE THE WEIGHT SHOULD HAVE COME FROM — IT WAS AVAILABLE ALL ALONG

`build/build_engine_data.js` already declares `wt` in `OWNED` and already derives it from
`species.weighthg`. **The derivation sat inside the `Object.entries(M.MONS)` loop**, which only
visits the rows CHOMP's `champ-model.js` carries. `mons` is assembled from **three** sources:

| stage | rows | got `wt` |
|---|---|---|
| the champ-model walk | 308 | yes |
| `data/mc-declared-rows.json`, appended verbatim | 15 | only if the file happened to hold it |
| rows only the previous artifact holds, appended verbatim | 0 today | no |

So the builder owned `wt` for 312 rows and silently did not own it for 10. Not a build-time
availability problem — a coverage problem.

`engine/merge_mega_into_engine.js` cannot be the fix: its source, `data/mega-dex-official.json`,
carries **no weight field at all** (measured: 0 of 359 forms). It builds new mega rows without
`wt`, and updates existing ones with `Object.assign({}, MC.mons[key], entry)`, so an existing `wt`
survives it. That is why the fix belongs in stage 1 and why adding a second dex read to stage 3
would be a second implementation of one fact.

### What the pass matches — printed before it was wired

Over all 322 rows, comparing `DEX.species.get(key).weighthg/10` against the stored value:

```
would fill: 10   already agree: 312   DISAGREE: 0   dex has no weight: 0
```

Zero collateral. The ten it fills are exactly the ten above.

## 3. THE FIX

`build/build_engine_data.js`, three edits, no hand-written weights anywhere:

1. `dexWeightKg(key)` hoisted out as the **one** place a species key becomes a weight. No
   `try`/`catch` — `Dex.species.get` returns `exists:false` rather than throwing, which this file's
   own census block already argues; the old inline version had a bare catch and that is one fewer
   silent block.
2. The champ-model loop calls it. Behaviour unchanged for its 308 rows.
3. A pass **after all three sources have contributed** stamps `wt` on every row the dex knows.
   It FILLS silently, **REPORTS any disagreement with both values before correcting it**, and
   **REPORTS any row the dex has no weight for**. Key position is deliberate: `wt` goes after `ab`,
   the slot the five declared rows that already have it use, because key order in this artifact is
   load-bearing and `--check` compares bytes. The correction branch copies before writing, because
   `mons[k]` may be the very object inside `SRC_DECLARED` and `--purity` builds twice.

`node build/build_engine_data.js --check` (writes nothing) now says:

```
wt FILLED from the dex on 10 row(s) the champ-model walk never visits:
  victreebel-mega 125.5, feraligatr-mega 108.8, skarmory-mega 40.4, barbaracle-mega 100,
  falinks-mega 99, aegislash-blade 53, gourgeist-small 9.5, gourgeist-large 14,
  gourgeist-super 39, palafin-hero 97.4
mons: 11 row(s) differ — <the ten>, floette-eternal-mega
```

**`floette-eternal-mega` and the `KEY ORDER differs from index 35` line are PRE-EXISTING.** The
same `--check`, run before a byte of this was edited, printed both and exited 1. They are not this
pass's and they are the reason the regeneration is a decision rather than a chore — see OWED.

## 4. THE ARITHMETIC — CONFIRMED AGAINST THE AUTHORITY AND THEN AGAINST DAMAGE

Brackets read from the format, not recalled. `data/mods/champions/moves.ts` carries **zero**
`basePowerCallback`, so all four weight moves inherit mainline verbatim.

`data/moves.ts`, `lowkick` / `grassknot` — thresholds in **hectograms**:
`>=2000 → 120, >=1000 → 100, >=500 → 80, >=250 → 60, >=100 → 40, else 20`.
`data/tags.json` carries the same table converted to kg — `[[200,120],[100,100],[50,80],[25,60],[10,40],[0,20]]` — so the artifact the engine reads and the authority agree.
`heavyslam` / `heatcrash` are the ratio family: `[[5,120],[4,100],[3,80],[2,60],[0,40]]`.
Corpus uses: Low Kick 8,484 / Grass Knot 607 / Heavy Slam 526 / Heat Crash 16.

### Base power per row, forme-change arm (the body keeps the stamp of the body that left)

| row | fallback kg | true kg | BP fallback | BP true | crosses |
|---|---|---|---|---|---|
| `victreebel-mega` | 15.5 | 125.5 | **40** | **100** | **yes** |
| `feraligatr-mega` | 88.8 | 108.8 | **80** | **100** | **yes** |
| `skarmory-mega` | 50.5 | 40.4 | **80** | **60** | **yes (down)** |
| `barbaracle-mega` | 96 | 100 | **80** | **100** | **yes** |
| `falinks-mega` | 62 | 99 | 80 | 80 | no |
| `aegislash-blade` | 53 | 53 | 80 | 80 | no |
| `gourgeist-small` | 12.5 | 9.5 | **40** | **20** | **yes** |
| `gourgeist-large` | 12.5 | 14 | 40 | 40 | no |
| `gourgeist-super` | 12.5 | 39 | **40** | **60** | **yes** |
| `palafin-hero` | 60.2 | 97.4 | 80 | 80 | no |

**Six cross. The card's six, row for row.**

### Measured damage, three arms, with a fixed-power control that must not move

`buildMon(<row>)`, then `m.wt` set by hand to each of the three candidate weights, so weight is the
only thing that moves. Low Kick from a Garchomp against a Fighting-legal target; Grass Knot from a
Venusaur where the target is Fighting-immune. The control is a fixed-base-power move of the same
type and category (Brick Break / Energy Ball).

```
row                 wt=null   wt=fallback   wt=true   control (all three arms)
victreebel-mega           1            22        55   42 / 42 / 42
feraligatr-mega           3            65        81   61 / 61 / 61
skarmory-mega             3            73        55   68 / 68 / 68
barbaracle-mega           5           125       156   120 / 120 / 120
falinks-mega              3            61        61   57 / 57 / 57
palafin-hero              3            81        81   75 / 75 / 75
gourgeist-small (GK)      1            27        14   59 / 59 / 59
gourgeist-large (GK)      1            27        27   59 / 59 / 59
gourgeist-super (GK)      1            27        39   59 / 59 / 59
aegislash-blade (GK)      1            72        72   80 / 80 / 80
```

**The control does not move on any arm of any row** — the knob is cleared, so the steps are the
weight and nothing else. The five non-crossing rows step between `null` and the other two and not
between fallback and true, which is what a non-crossing row must look like.

### The `wt=null` column is the arm that is actually live for five of the ten

`buildMon` stamps `wt: m.wt||null`, so a body built **at** one of these rows carries `null`, and
`effWeight` returns null, and the move falls through to `basePower: 0`. Proven through the real
paste door:

```
Victreebel @ Victreebelite   ->  victreebel-mega   wt = null
Gourgeist-Super @ Leftovers  ->  gourgeist-super   wt = null
```

So the three Gourgeist sizes (brought, never forme-changed) and any mega arriving from a paste that
already names the stone are in the **1-damage** column, not the fallback column.
`MEDFAILS.weightRowNoValue` sees only the forme-change half; the built-at half is silent because
`weightFollowsForme` is never called for it.

## 5. WOULD `artifact_audit.js` HAVE CAUGHT IT? NO — AND IT IS NOW SAID IN ITS OWN HEADER

`wt` is in the audit's `FIELDS` list, so the field was in view and the finding still did not appear.

- **Check A (cohort completeness) missed it because it asks about a WHOLE cohort.** The rule is
  `mr > 0.9 && or < 0.5`. Five of the six crossers are megas — **5 of 76 = 6.6%**, nowhere near
  0.9. That rule is right for the 2026-07-30 bug it was built from (all 57 mega rows at once) and
  is structurally blind to a SUBSET. Lowering the threshold is not the fix: it would fire on every
  legitimately-absent team-build field.
- **Check B (source has it, artifact does not) missed it because `wt` has no entry in `SOURCES`.**
  The one registered mapping writes `{ab, mv, item}` from `mega-dex-official.json`, and that file
  has no weight column. `wt`'s real upstream is the **dex**, which is not a file under `data/` and
  was therefore never registered.
- **Check C (key convention) missed it because nothing is mis-keyed.** Every one of the ten
  resolves through `engine/mc_key.js` to itself and through `Dex.species.get` to the right forme.

**A second instance spelled differently walks past all three too**: any field absent on a MINORITY
of a cohort whose upstream is the dex rather than a `data/` file is invisible here. The instrument
that did see it is `build/build_engine_data.js`'s **ROW CENSUS**, which puts every null to the
format and prints `UNEXPLAINED: 10 -> victreebel-mega, ...`. Note that it **prints and does not
decide the exit code** — it is a diagnostic, not a gate. No fourth check was added; the census
already counts the shape and a gate on a gate is bloat. All of the above is now in
`engine/artifact_audit.js`'s header, so the blind spot is documented rather than assumed away.

## 6. WHICH SCOREBOARD — STATED BEFORE ANY RUN

**The lab should move. The pool should sit still, or move by at most one or two games.**

Scanned the frozen pool (`data/team-pool-frozen`, 17,381 games, read-only):

| forme | games it appears in | ...of which also carry a weight move anywhere |
|---|---|---|
| `victreebel-mega` | 20 | 6 |
| `feraligatr-mega` | 33 | 6 |
| `skarmory-mega` | 25 | 11 |
| `barbaracle-mega` | 25 | 7 |
| `gourgeist-small` | 9 | 6 |
| `gourgeist-super` | 15 | 6 |
| *(non-crossing)* `falinks-mega` 103 / `aegislash-blade` 176 / `palafin-hero` 220 / `gourgeist-large` 0 | | |

Weight-move presence across the pool: Low Kick 6,281 games, Grass Knot 716, Heavy Slam 502, Heat
Crash 18.

**All six crossers do occur** — this is not a mechanic the pool has never seen. But the empirical
driver samples ~961 games, and the six co-occur with a weight move in **42 of 17,381** games
combined, i.e. **~2.3 expected games in a 961 sample** before asking whether the move was actually
aimed at that body on a turn it was on the field. So the honest prediction is **no board-material
movement, and that is the expected result rather than a failed fix.** The lab is the instrument
that should see this.

**Nothing about the census can move from this pass anyway**: `engine/medicham2-browser.js` was not
touched, and `data/engine-data.js` was not regenerated.

## 7. A NOTE ON THE TREE, NOT ON THIS WORK

`git status` during this pass showed `engine/all_mechanics_fire.js` and `engine/faces.js` modified
and `docs/_reports/2026-08-29-overnight-log.md` untracked — **none of them mine**, and three files
that were untracked at the start of this session are now gone from the list. Another agent is
writing. Nothing was committed, nothing was pushed, and nothing was deleted.

---

## OWED, NOT RUN

**Nothing below was run. This pass played no game, regenerated no artifact and wrote no data file.**

1. **REGENERATE THE ARTIFACT. This is the value change and it has not happened.** The generator is
   fixed; `data/engine-data.js` still holds ten weightless rows.

   ```bash
   SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
     node build/build_engine_data.js            # stage 1 — writes data/engine-data.js
   node build/rebuild_sets_from_sheets.js       # stage 2
   node engine/merge_mega_into_engine.js        # stage 3
   ```

   **READ THIS BEFORE RUNNING IT.** `data/engine-data.js` is in `engine_release.js` `SOURCES`, so
   it is frozen into every release, and a regeneration today does **more than the ten weights**:
   `--check` says it also **adds `floette-eternal-mega`** (a row the sources carry and the artifact
   does not) and **reorders the keys from index 35**. Both pre-date this pass. That is a
   three-part value change and belongs to whoever owns the pipeline, not to a data fix.

2. **THE CENSUS, after the regeneration.** The mechanics count cannot move from this pass alone; it
   can move once the weights are real, because a probe becomes stageable that is not today.

   ```bash
   node tests/test-mechanics.js
   node engine/status.js
   ```

3. **THE PROBE I DID NOT WRITE, AND WHY.** With the weights filled, the mega-weight probe gains the
   one arm it has never had: **`skarmory-mega` is the only mega in this format whose weight goes
   DOWN across a bracket** (50.5 → 40.4 kg, BP 80 → 60), so it is the only available assertion that
   the engine follows the forme DOWNWARD and is not merely "a mega hits harder". Today that arm
   would assert the data hole rather than the mechanic. Add it as a `move:variablePower` row in
   `tests/test-mechanics.js` using the same ratio-against-a-fixed-power-control observable, **after**
   step 1 lands, and show it red first with `MEDI_WEIGHT_STATIC=1`.

   A second arm becomes available at the same time: **a body BUILT at one of these rows**, which is
   the `wt=null` column above and is a different door from the forme change. Suggested threshold,
   set in open ground: the crossing arm must move the Low Kick/Brick Break ratio by >20%, the
   non-crossing control by <8%.

4. **`MEDFAILS.weightRowNoValue` must fall to zero** once the artifact is regenerated, and
   `weightNoRow` must stay where it is. Read them off the next census run rather than assuming.

5. **`node build/build_engine_data.js --purity` was NOT run**, deliberately: it **writes**
   `data/engine-data-purity.json`, and a MEASURE agent is running roster stages. Run it when the
   machine is quiet; the ratchet may fall and may never rise.

6. **The roster stages.** Not re-run, not needed for this pass, and unchanged by it.

7. **Living docs and CHANGELOG.** No published figure moved, so no version was bumped. The
   CHANGELOG entry belongs with the regeneration in step 1, where the artifact's values actually
   change. `node engine/status.js --write` was **not** run: two files belonging to another agent are
   modified in the tree right now, and stamping the generated blocks would record a half-modified
   tree as state.
