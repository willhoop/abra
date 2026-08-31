# Regenerating `data/engine-data.js` — 2026-08-30, ENGINE

**VERDICT.** **`--check` still showed the same three changes** — the ten `wt` fields, the added
`floette-eternal-mega` row, and the key reorder from index 35 — word for word the 2026-08-29 wording,
eight engine batches later. **The reorder is provably behaviour-neutral**: it is exactly "the 15
declared rows move to the end", it moves no non-hyphenated key relative to another, and a
REORDER-ONLY control artifact (the old values, the new order, nothing else) reproduced the census
verdict for verdict. **The added row is legal at the species level and has ZERO carriers as a KEY** —
it is a SECOND ROW FOR A BODY THE ARTIFACT ALREADY HAS, `engine/artifact_audit.js` check E caught it
by name the moment it landed, and it is **not in the shipped artifact**: the generator now drops a
duplicate by the format's own species id. **The prediction held 6 of 8 at the point estimate and 8 of
8 in band**; the two that moved, moved for a reason the prediction's arithmetic had missed and the
run then named. **Board-parted 83 -> 82, protocol 173 -> 172**, one game, one boundary, one cause
removed and zero added.

| | baseline | predicted | band | **measured** |
|---|---|---|---|---|
| census | 814/814/0 | **815/815/0** | exactly | **815/815/0** |
| protocol-diverged | 173 | **173** | 171–175 | **172** |
| board-parted | 83 | **83** | 82–84 | **82** |
| distinct causes | 151 | **151** | 149–153 | **150** |
| causes added | — | 0 | exactly | **0** |
| end-state | 905/53/2/0/1 | identical | <=2 per cell | **905/53/2/0/1 — identical** |
| `ordering` class | 24 | 24 | 22–26 | **24** |
| `wt null` in the row census | 10 | **0** | exactly | **0** |
| engine release | `0e8ec5729a7b` | moves | — | **`862624c9826e`** |

The prediction was written to `data/verification/prediction-enginedata-regen.json` **before any
measurement of this batch** — before the probe was written, before the artifact was touched, before a
game was played.

---

## 1. `--check` STILL SHOWS THE SAME THREE, RE-RUN ON THIS TREE

```
mons: 11 row(s) differ — victreebel-mega, feraligatr-mega, skarmory-mega, barbaracle-mega,
  falinks-mega, aegislash-blade, gourgeist-small, gourgeist-large, gourgeist-super, palafin-hero,
  floette-eternal-mega
  victreebel-mega: wt undefined -> 125.5   ... (ten rows)
mons: KEY ORDER differs from index 35 — artifact has "castform-snowy", the sources produce "torterra".
```

Identical to the 2026-08-29 report. Nothing has changed under it in eight batches.

## 2. THE REORDER, CHARACTERISED RATHER THAN ASSUMED

**It is not a general permutation.** Derived statically before anything was written:

- the 308 champ-model rows keep their **relative order** — proven by comparing the artifact's
  non-declared subsequence against `Object.keys(M.MONS)` filtered to the artifact: **equal**;
- the 15 rows of `data/mc-declared-rows.json` move to the **end**, in the declared-file order —
  proven the same way: **equal**;
- 277 of 322 indices change; **every one of them is a shift**, not a reorder.

### The order-sensitive consumers, each answered

| consumer | order-sensitive? | reached by THIS permutation? |
|---|---|---|
| `mc_key.js` build() — "first key wins" | only on a flat collision | **NO** — 0 flat collisions in the candidate |
| `merge_mega_into_engine.js` `byNorm` | only on a collision | **NO** — same normaliser, 0 collisions |
| `replay_differential.js` `FLAT_MONS` | only on a collision | **NO** |
| `replay_differential.js` `SLOW_POOL` — stable sort then `.slice(0, 60)` | **YES**, genuinely: a three-way speed-60 tie sits on the 60-row boundary | **NO** — the pool filters out every hyphenated key and all 15 moved rows are hyphenated, so the filtered input subsequence is **IDENTICAL** under both orders |
| `million_run.js` `pickSpecies` — a weighted walk over the table | **YES** by construction | it changes anyway from the ten weights; it is an instrument, not the engine |
| `feature_fixture.js` `tableDigest()` — an order-dependent hash | **YES** | **the damage-table digest MOVES.** A stamp, not behaviour, and `status.js` already reported it moved before this batch |

`SLOW_POOL` is the one worth writing down, because the honest answer is *"the consumer is
tie-sensitive and the knob is not wired to it"* rather than *"it does not matter"* — that distinction
is docs/LESSONS.md 5.

### AND THEN IT WAS MEASURED, NOT ONLY ARGUED

A **REORDER-ONLY control artifact** was built: the BEFORE values, in the AFTER key order, 322 rows,
no added row, no weight filled. Asserted before the run that (a) every row's value is byte-identical
to BEFORE and (b) the key order differs from BEFORE — so the knob is varied and nothing else is.

```
census under the reorder-only control : 814 live / 815 probed / 1 missing   (identical to BEFORE)
verdict differences over 359 result rows : 0
detail differences                       : 1
```

The single detail difference is `move/formatSecondaryChance`, a Monte-Carlo probe reading 19.7% vs
19.8% over 6,000 turns on an unpinned die — it moves the same way between two runs of the same
artifact. **Zero verdicts moved.**

## 3. THE ADDED ROW IS A DUPLICATE, NOT A NEW ENTITY — AND THE AUDIT SAID SO

`floette-eternal-mega` is **legal at the species level**: `Dex.forFormat` resolves it to Floette-Mega,
`isNonstandard: null`, `changesFrom` Floette-Eternal, `requiredItem` Floettite (also legal, a real
mega stone with `megaStone: {Floette-Eternal: Floette-Mega}`).

**It has ZERO carriers as a KEY.** The artifact already carries `floette-mega` for that same dex
species, and `megaKeyFor` (WIRE 132) asks `megaStone.into` first — which answers `floette-mega`, a row
that exists — so the concatenated guess `baseKey + '-mega'` is never evaluated. CHOMP's model carries
**three** floette keys and the dex resolves two of them to one body.

It was added, and `engine/artifact_audit.js` went from **2 GAPs to 3**, both new ones this row:

```
E. TWO ROWS, ONE BODY
  GAP  Floette-Mega  <- floette-eternal-mega [mv=0 ab=fairyaura] || floette-mega [mv=4 ab=Fairy Aura]
       two representations of one body WILL diverge, and the emptier one wins wherever a
       consumer resolves by concatenation rather than through the artifact.
  GAP  floette-eternal-mega: mv is EMPTY while its source floette-eternal carries 4 move(s)
```

That consumer is real and named: `megaKeyFor`'s suffix fallback, and WIRE 132's own header measured
what reaching it costs — `ab: null`, `mv: []`, a mega that threatens nothing. **It is only unreachable
today because the named answer exists.** A second row for one body is exactly the hazard CLAUDE.md
tells the artifact audit to look for.

### THE RULE THAT DROPS IT IS DERIVED, AND WAS PRINTED BEFORE IT WAS WIRED

`build/build_engine_data.js` now groups every row by the species `Dex.species.get(key)` resolves it
to and, in a group of more than one, **keeps the key whose flattened form IS the dex species id**.
Nothing is dropped when no key in the group is canonical — that is reported instead, because a silent
drop is the failure this file's header spends four hundred lines on. Printed over the 323 candidate
rows before a line was wired (docs/LESSONS.md 4):

```
SPECIES floettemega -> rows ["floette-eternal-mega","floette-mega"]
  key==dex id: ["floette-mega"]   would DROP: ["floette-eternal-mega"]
duplicate species groups: 1   total rows 323   distinct dex species 322   rows the dex cannot resolve: 0
```

**One group. It cannot over-match on a forme name** — `castform-sunny`, `charizard-mega-x` and every
other hyphenated forme resolves to a species of its own.

`engine/artifact_audit.js` after: **1 GAP**, down from 2 before this batch. The remaining one is the
inherited `data/abra-tags.js` drift (the `tag_dex.js` regeneration the hand list already carries).

## 4. THE DIFF, EVERY CHANGE ACCOUNTED FOR

Against the committed copy of `data/engine-data.js`, semantic field-by-field:

```
mons count 322 -> 322      added rows: (none)      removed rows: (none)
key ORDER identical (on shared keys): false        <- change 2
field value diffs on shared rows: 10               <- change 1, and it is only `wt`
   victreebel-mega 125.5  feraligatr-mega 108.8  skarmory-mega 40.4  barbaracle-mega 100
   falinks-mega 99  aegislash-blade 53  gourgeist-small 9.5  gourgeist-large 14
   gourgeist-super 39  palafin-hero 97.4
moves count 500 -> 500  order identical: true      move diffs: 0
C identical: true       priors identical: true
```

**TWO changes, not three, and no fourth.** Every `wt` value equals the prediction file's, written
before the build ran. The in-row key position is `wt` after `ab`, the slot the five declared rows that
already carried it use.

- **Stage 1** (`build/build_engine_data.js`) is the whole value change.
- **Stage 2** (`build/rebuild_sets_from_sheets.js`) re-run afterwards in report mode:
  `materially changed 0`, `illegal abilities fixed 0`. A no-op on the shipped artifact.
- **Stage 3 (`engine/merge_mega_into_engine.js`) WAS DELIBERATELY NOT RUN, and this is the one place
  the report's recipe was not followed.** It reads `data/games.bo3.jsonl` and `games.ladder.jsonl`
  through `engine/mega_sets_from_sheets.js`, and both were appended by OPS **eighteen minutes before
  this batch started**. `build_engine_data.js`'s own header measures what a re-derivation costs today:
  *"14 mega movesets and all 76 mv_provenance blocks"* — an unpredicted, unattributable corpus change
  folded into a weight batch. Stage 1 carried every stage-3 field through untouched (the diff above
  proves it: zero field diffs outside the ten weights), so nothing was lost by skipping it.

The row census after: `wt null: 0` (was 10), `ab null: 0`, `mv empty: 4` (the pre-existing four),
UNEXPLAINED **3** — the three Gourgeist `item: null` rows, which pre-date this batch. It was 13.

## 5. THE PROBE — RED FIRST, TWO DOORS, WITH THE CONTROL THAT DID NOT MOVE

`move/variablePower`, *"the weight brackets are read on the forme STANDING THERE — downward across a
mega, and on a body BUILT at a battle-only forme"*. Every kilogram is the format's own
(`species.weighthg/10`), every bracket is the tag's own.

**Door 1, the forme change.** `weightFollowsForme` reads the row of the forme that arrived; a row with
no `wt` leaves the stamp of the body that LEFT. Each arm is a Low Kick / Brick Break ratio — same type,
same category — so stat, STAB and effectiveness cancel and only the base power is left.

**Door 2, built at the row.** `buildMon` stamps `wt: m.wt||null`, so a body built AT one of the ten
carries null and the move falls through to its dex `basePower` of 0. The three Gourgeist sizes are a
20/40/60 ladder off one species; **Gourgeist itself already had its weight and is the cleared
control** — it must sit on Gourgeist-Large's rung.

```
                                        RED (before)            GREEN (after)
Skarmory   50.5 -> 40.4 kg  BP 80->60   50.5->50.5    -0.3%     40.4    -25.8%
Victreebel 15.5 -> 125.5 kg BP 40->100  15.5->15.5    -1.5%     125.5  +142.4%
Falinks    62   -> 99   kg  BP 80->80   62  ->62      +2.8%     99      +2.8%   <- CONTROL
Gourgeist-Small  9.5 kg  BP 20          null r=0.000            9.5  r=0.222
Gourgeist-Large  14  kg  BP 40          null 0.00x small        14   2.00x small
Gourgeist-Super  39  kg  BP 60          null 0.00x small        39   3.00x small
Gourgeist        12.5 kg BP 40 CONTROL  null 0.00x              12.5 1.00x
```

**THE CONTROL READS 2.8% ON BOTH RUNS.** Falinks megas, gains 37 kg and crosses no target-weight
bracket, so it must not step — and it does not, identically, before and after. That is what says the
two red arms are the weight and not "a mega hits harder". The built-at ladder lands on **2.00x** and
**3.00x**, the exact 40/20 and 60/20 ratios, and the cleared control on **1.00x**.

Census **814/814/0 -> 815/815/0**. Row-by-row against the BEFORE census: **one verdict moved** (this
probe, false -> true) and one detail moved (the Monte-Carlo `formatSecondaryChance` row, which also
moves under the reorder-only control where no value changed).

## 6. THE POOL — AND THE ARITHMETIC THAT PREDICTED THE WRONG SIX

**Said in advance:** the lab should move, the pool should sit still. Derived before the run from
`data/team-pool-frozen/games.bo3.jsonl` (13,214 games), requiring the STONE to be paired with its base
for the mega crossers:

```
victreebel+victreebelite 29 games (11 also carry a weight move)   feraligatr+feraligite 54 (20)
skarmory+skarmorite      55 (10)                                  barbaracle+barbaracite 19 (10)
gourgeist-small           7 (4)                                   gourgeist-super       13 (5)
UNION 60 of 13,214  =  4.36 expected games in a 961 sample  (opportunity only)
```

**Measured: one game.** 173 -> 172 protocol, 83 -> 82 board, 151 -> 150 causes, **zero added**, and
the one removed cause is:

```
-damage field 3 :: |-damage|p2a:falinks|37/140  vs  |-damage|p2a:falinks|24/140
  seed gen9championsvgc2026regmbbo3-2654747415 vs ...-2654649528
  |move|p1a: Rhyperior|heatcrash|p2a: Falinks
```

**THE PREDICTION'S CROSSER LIST WAS AN UNDERCOUNT AND THE RUN NAMED THE REASON.** Falinks-Mega is a
NON-crosser on the target-weight table (62 and 99 kg are both `>=50`, BP 80 either way) — which is
exactly why it is this probe's control. It is a crosser on the **RATIO** family: Rhyperior at 282.8 kg
over a stale 62 kg is 4.56 (`>=4`, BP 100), over the true 99 kg is 2.86 (`>=2`, BP 60). medicham2 was
over-pricing Heat Crash and left the Falinks on 24/140 where the authority left it on 37/140. Six
target-weight crossers plus the ratio family; the prediction counted only the six.

**Sample identity, checked and not assumed:** 961 games both runs, `turns_cap` 12, arm `middle`,
steering `empirical-click/v1`, census pin `9446a684709d`, pool digest `0d103fb9fa87` under
`data/team-pool-frozen`, `closet.teams_dropped` 43, `coverage.exercised` 556, `mid_void.void_games` 9,
Showdown commit `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`, `mode` string identical
(`A/middle/pins:ccb365985023/credit:observed-effect/v1/nature:real`), the five-entry
`state.not_compared` block byte-identical. Only the release differs, as it must. The run was executed
TWICE (once without `--write`, once with) and returned 172 / 879 both times.

Every other state figure is unmoved: `turn1_boards_identical` 956, `protocol_diverged_board_never_did`
101, `board_parted_before_the_protocol_did` 15, `protocol_diverged_board_held_longer` 10, and every
one of the fifteen class game-counts except `-damage field 3` (20 -> 19). The one game moved from
"parted, same end state" to "never parted, same end state", which is why the overall end-state cells
are **identical at 905/53/2/0/1**.

Artifacts: `data/verification/game-differential.enginedata.json` and
`data/verification/divergence-turns.enginedata.json`, release **`862624c9826e`**.
**`data/game-differential.json` was NOT touched** — its mtime is still 2026-08-28 23:14.

## 7. THE RED TESTS, ATTRIBUTED

| test | before this batch | after |
|---|---|---|
| `engine/artifact_audit.js` | 2 GAPs (abra-tags drift, engine-data-does-not-match) | **1 GAP** — abra-tags only |
| `engine/generated_audit.js` | DRIFTED 2 | **DRIFTED 1** — abra-tags only |
| `tests/probe_red_demo.js` | 200 demos, 1 HOLLOW, 5 COULD-NOT-APPLY | **identical** |
| `tests/probe_upkeep_lines.js` | 49 arms, 4 not as expected | **49 arms, 4 — the same four by name** |
| `tests/test-pinch-family.js` | 1 of 61 FAILED | **1 of 61 — verified red on the BEFORE artifact too** |
| `engine/selftest.js` | 1 of 25 — 12 raw ladder-store readers | unchanged, names no file this batch touched |
| `engine/conformance.js` | S13 rows on JSON files with no generator | unchanged, names no file this batch touched |

Green throughout: `test-mc-key`, `test-mc-seal`, `test-engine-consistency`, `test-effective-identity`,
`identity_audit`, `test-oracle-differential`, `test-tag-consumed`, `test-side-guard-chooser`.

## 8. A NOTE ON THE TREE, NOT ON THIS WORK

At the start of this batch `git status` was clean apart from three untracked files. During it,
`data/kad-replays.js`, `data/live.js` and `data/provenance-stamp.json` became modified and the three
untracked files disappeared from the list. **None of them are mine.** Another agent is writing.
Nothing was committed, nothing was pushed and nothing was deleted.

---

## OWED, NOT RUN

1. **STAGE 3 OF THE PIPELINE.** `engine/merge_mega_into_engine.js` was deliberately not run (§4). It
   is owed on a **pinned store**, and it carries its own measured value change — 14 mega movesets and
   76 `mv_provenance` blocks. That is a corpus decision and belongs with whoever pins the store, not
   inside a weight batch.
2. **`node build/build_engine_data.js --purity` WAS NOT RUN**, for the same reason the previous pass
   gave: it **writes** `data/engine-data-purity.json`, and the tree has another agent in it. The
   carried-field count came back to 2072 after the dedupe, so the ratchet should not have risen — read
   it off a run rather than off this sentence.
3. **THE THREE `item: null` GOURGEIST ROWS** are the only UNEXPLAINED rows the generator's census
   still names. Not touched here; they are an item question, not a weight one.
4. **`data/abra-tags.js` IS STILL DRIFTED FROM `data/tags.json`** and is now the ONLY gap
   `artifact_audit.js` reports. It is the same `tag_dex.js`-with-a-pinned-store pass that already gates
   Ripen's second halve and ROADMAP #529 — **three mechanics now wait on one MEASURE-shaped decision.**
5. **THE ROSTER, ALL THREE STAGES, AND `data/all-mechanics-fire.json`.** Still on `e129bca605e3` and
   WITHHELD by the release-mismatch clause, which this batch pushes one release further out of date.
6. **THE COVERAGE ARM of the whole-game differential** (`data/game-differential.json`), unchanged and
   still stale on `e129bca605e3`.
7. **`tests/test-engine-diff.js`** — not run: it has no `--out` and would republish
   `data/engine-diff.json`. It calls `moveHit` once with a hand-built pair and does not read a forme
   change, so the argument that it is unaffected is an ARGUMENT and is recorded as one, not as a
   measurement.
8. **THE DAMAGE-TABLE DIGEST HAS MOVED AGAIN** (`engine/feature_fixture.js`), from both the ten values
   and the key order. `status.js` already printed the fixture and table gates as failing before this
   batch for an earlier reason. **The verdict is MEASURE's**, and this batch adds a second reason for
   the same gate rather than clearing the first.
9. **A RATIO-FAMILY ARM FOR THE PROBE.** The pool's one removed cause was a Heat Crash, and the new
   probe's arms are all the TARGET-weight family plus its control. An arm that megas the USER across a
   RATIO bracket would assert the half the pool actually exercised; the existing Heavy Slam probe megas
   a user that already sits in the top bracket, so it cannot.
