# Does the damage-table regeneration reach the MAG fit? — 2026-09-03, MEASURE

`node engine/status.js` opens with a FEATURE SEMANTICS CHECK FAILURE against
`data/policy-weights.json` naming two gates: **fixture identity** (rounding 6 -> 6, scenarios
10 -> 12) and **damage table** (318 species -> 322, digest `405c836793d1` -> `1bda9df11d73`).
A restamp answers the first and silences the second, so the table verdict is settled here first.

**VERDICT: RESTAMP.** The damage-table change does not reach the fit.

Nothing was restamped, nothing was refitted, nothing was committed. The commands are in **OWED**.

---

## 1. What the two digests actually are

`engine/feature_fixture.js:717 tableDigest()` hashes `mcKey.all()` — every row of `MC.mons` in
`data/engine-data.js` — over the fields `mv, item, ab, st, bs, ty`.

The stamp inside `data/policy-weights.json` is `featureHashes.table = {species: 318, digest:
"405c836793d1"}` and `generated: 2026-08-05T04:00:43Z`. (`status.js` prints "weights fitted
2026-08-28 15:46", which is the file mtime; the fit's own stamp is 2026-08-05.)

Reproduced rather than assumed. Each historical `data/engine-data.js` was checked out to a scratch
path and run through the same `tableDigest()` code:

| commit | date | rows | digest |
|---|---|---|---|
| `7539c6da` | 2026-08-02 17:40 | 318 | `405c836793d1`  <- **the stamped baseline** |
| `6c31c94e` | 2026-08-09 18:01 | 318 | `405c836793d1` |
| `41f5f41f` | 2026-08-09 20:04 | 318 | `405c836793d1` |
| `9a060821` | 2026-08-10 19:13 | 317 | `1b66b563c229` |
| `f15bf80a` | 2026-08-22 02:27 | 322 | `1bda9df11d73` |
| `ec2e319c` | 2026-08-31 00:08 | 322 | `1bda9df11d73`  <- **HEAD** |

So the digest moved **twice**, not once, and the 2026-08-31 regeneration that `status.js` blames
in its "moved after the fit" list did not move the digest at all.

## 2. WHICH species changed — the 4 new ones were not the story

Diffed row-by-row, `7539c6da` (baseline) against `HEAD`, over every field either version carries:

- **added 5** — `castform-rainy`, `castform-snowy`, `castform-sunny`, `mimikyu-busted`,
  `morpeko-hangry`
- **removed 1** — `floette-eternal-mega`
- **changed 85** rows, by field: `mv` 76, `mv_provenance` 80, `wt` 29, `base` 2

(318 - 1 + 5 = 322. The gate's "318 -> 322" is a net of +5/-1, so "the 4 added ones" was never the
right frame.)

**`st`, `bs`, `t` and `item` and `ab` changed on ZERO rows.** Not one stat line, not one type, not
one item, not one ability.

**Every single changed or added row is a mega forme or an in-battle forme.** No base-forme species —
nothing that appears on a team sheet under its own name — moved at all:

```
changed rows that are MEGA formes:  76
changed rows that are NOT mega:     11
  aegislash-blade  gourgeist-large  gourgeist-small  gourgeist-super  palafin-hero
  castform-rainy   castform-snowy   castform-sunny   mimikyu-busted   morpeko-hangry
  floette-eternal-mega (removed)
```

Attributed to the regeneration that caused each:

| regeneration | rows | what moved |
|---|---|---|
| `9a060821` 2026-08-10 | 80 changed, 1 removed | the 76 mega moveset rewrites, 19 `wt` fills, 2 `base` relabels |
| `f15bf80a` 2026-08-22 | 5 added | the in-battle forme rows |
| `ec2e319c` 2026-08-31 | 10 changed | `wt` fills only |

The mega `mv` rewrite is the substantive one — dataset junk replaced by real sheet-derived sets:

```
charizard-mega-y   ["overheat","hurricane","round","protect"] -> ["heatwave","protect","solarbeam","weatherball"]
medicham-mega      ["facade","thief","trailblaze","protect"]  -> ["closecombat","fakeout","psychocut","rockslide"]
floette-mega       []                                          -> ["dazzlinggleam","lightofruin","moonblast","protect"]
```

76 of the 80 mega rows changed moveset; the 4 that did not are `diancie-mega`, `latias-mega`,
`latios-mega`, `salamence-mega`, which still carry `mv: []`.

## 3. How many corpus games contain a changed species

Corpus taken through the fit's own loader — `require('engine/fit_policy.js').loadCorpus()`, default
`scope: 'fit'` = `data/games.bo3.jsonl`, clean open-sheet only. **16,830 games** today (the stamp
records 8,942, so the store has nearly doubled since the fit).

Every species key resolved through `engine/mc_key.js`; mega formes resolved through
`board.megaFormeOf(species, item, dex)`; in-battle formes derived from each table row's own `base`
field. **No key was typed into a grep or an `includes()`.** 10 of 201,960 sheet entries did not
resolve (4 Baxcalibur, 2 Rillaboom, 2 Togekiss, 2 Indeedee-F — species with no table row).

```
games with any mega stone on either sheet                16,823   99.96%
games whose stone yields a CHANGED mega row              16,823   99.96%
games naming a CHANGED row directly on a sheet               19    0.11%
games reaching a wt-CHANGED row                          11,114   66.04%
  ... and also carrying a weight-dependent move           5,468   32.49%
games reaching an ADDED row                                 283    1.68%
games reaching the REMOVED row                                0    0.00%
```

**The first probe of this returned 0.0% on every line.** It had not loaded
`data/engine-data.js`, so `mcKey()` missed 201,960 times and returned null silently under
`{mayMiss}`. The unanimity was the tell; the fixed probe is above.

## 4. Why 99.96% is not the answer — the change does not reach the feature

The naive count says every game touches a changed row. It does not follow, and this is the whole
verdict. `data/engine-data.js` is read by exactly **two** call sites in `engine/board.js` — nothing
else in the fit path (`click_match.js`, `click_class.js`, `quality.js`, `sheet_channels.js`,
`fit_policy.js`) touches `MC.mons`:

**Call site 1 — `dmgMon()`, board.js:1466.** `D.buildMon(key)` and then the sheet overrides:

```js
if (Array.isArray(mon.moves) && mon.moves.length) {
  const mv = mon.moves.map(norm).filter(id => MC.moves[id]);
  if (mv.length) b.moves = mv;
}
```

`Board.switchIn` fills `moves` from the sheet (board.js:1110), and the corpus is open-sheet by
construction. Measured: **0 of 201,960 corpus sheet entries declare an empty moveset.** So the
table's `mv` is overwritten on every body in every game, on both sides. `item` and `ability` are
overridden the same way, and neither changed on any row anyway.

What survives from the table row into the damage formula is `st`, `bs`, `t` and `wt`. **`st`, `bs`
and `t` changed on zero rows.**

**Call site 2 — `benchMons`, board.js:3956** (`benchRisk` / `clickFragility`). This one does *not*
override moves, so a table `mv` would reach it. It is fed `board.bench(side)`, and `bench()` returns
`this.party[side]`, which `setParty` stores as `baseSpecies(s)` — `baseSpecies = norm(s).replace(/mega[xy]?$/,'')`.
**A bench body is always a base species, and no base species row changed.**

So the 76 mega moveset rewrites — the only change with real semantic content — reach the fit in
**0 of 16,830 games**.

### The 29 `wt` fills are numerically inert

`wt` is not overridden by the sheet, so it does survive. `medicham2-browser.js:11005` recomputes
Low Kick / Grass Knot / Heavy Slam / Heat Crash base power from `effWeight(def)` when a weight
exists, and leaves the board's value alone when it does not (`if(_w)`). But the board's value is
already `movePower()` (board.js:3179-3193), which reads **`sp.weighthg` from the Champions dex**.

Measured across all 29: **29 of 29 new table weights are bit-identical to the dex weight** the code
was already using. Zero produce a different Low Kick bracket. The 32.49% figure above is a count of
where the field is *read*, not of where the number *changes*; the number changes nowhere.

### 2 of the 5 added rows are numerically identical to what they already resolved to

`mc_key.js`'s cosmetic-forme fallback substitutes a base when base stats **and** types are identical.
Resolving each added key against the OLD table:

```
                    OLD table (318)                             NEW table (322)
Mimikyu-Busted  ->  mimikyu   t=[Ghost,Fairy] hp130 at176 wt0.7  ->  mimikyu-busted  same t, same st, same wt
Morpeko-Hangry  ->  morpeko   t=[Electric,Dark] hp133 at165 wt3  ->  morpeko-hangry  same t, same st, same wt
Castform-Sunny  ->  NULL  (dmgMon returns null, every damage feature reads 0)
Castform-Rainy  ->  NULL
Castform-Snowy  ->  NULL
```

Mimikyu and Morpeko were never blind — the fallback was already handing back a body with the same
types, stats and weight. Only **Castform's three weather formes** are new capability, and they carry
genuinely different types (Fire / Water / Ice against Normal).

`floette-eternal-mega` was removed and appears in **0** corpus games. The 2 `base` relabels
(`floette-mega` `floette` -> `floetteeternal`, `meowstic-f-mega` `meowstic` -> `meowsticf`) are read
by `mc_key.bases()` and `engine/train_value.py` only — not by `board.js` and not by
`medicham2-browser.js`. `mv_provenance` has no reader outside the builders and `artifact_audit.js`.

### The number that decides it

> **12 of 16,830 corpus games — 0.07% — contain a body the new table can build and the old one
> could not.** All twelve are Castform. Every other changed row either does not reach a feature
> (mv), or reaches it with a value the code already had (wt), or was already resolving to a
> numerically identical body (mimikyu-busted, morpeko-hangry).

And 0.07% is an **upper bound**: it counts games with a Castform on a sheet, not games in which a
Forecast forme actually appeared on the board.

## 5. The fixture, and why its silence proves nothing on its own

`status.js` warns that matching feature hashes are not reassurance. It is right, and here is the
receipt. The 12 fixture scenarios stand on **30 species**:

```
Abomasnow, Araquanid, Blaziken, Charizard, Clefable, Excadrill, Farigiraf, Froslass, Garchomp,
Glimmora, Gourgeist-Super, Grimmsnarl, Gyarados, Heliolisk, Hippowdon, Hydreigon, Incineroar,
Lycanroc, Ninetales-Alola, Pelipper, Rotom-Wash, Sceptile, Sinistcha-Masterpiece, Skarmory,
Torkoal, Tyranitar, Venusaur, Volcarona, Weavile, Whimsicott
```

**Not one board carries a mega stone** (`megaFormeOf` returns null for all 24 on-field entries), so
**zero of the 76 mega rows are exercised anywhere in the fixture.** Exactly one changed row appears
at all: `gourgeist-super`, on the p2 bench of `dead-moves-and-status`, and it changed only in `wt`.

A direct A/B was run anyway, injecting each archived table through `require.cache` so `board.js`'s
own `require` of `data/engine-data.js` becomes a no-op (no repo file was touched). Both digests
reproduced exactly — `405c836793d1` over 318 and `1bda9df11d73` over 322 — which is the instrument
control:

```
features:      58 columns, MOVED 0
jointFeatures: 18 columns, MOVED 0
bodies digest: 3b8d17864a5e -> 3b8d17864a5e   (same fixture, as it must be)
candidates 384 -> 384, pairs 1534 -> 1534
```

Report this as what it is: **the fixture cannot see this change, so its silence is not evidence.**
The evidence is section 4.

## 6. A hole in the ruler, found on the way — not fixed here

`tableDigest()` hashes `m.ty`. **No row in either table version has a field called `ty`** — the
union of field names is `ab, base, bs, item, mega, mv, mv_provenance, nature, set_source, sp, st,
t, wt`. Types live in `t`. `m.ty` is `undefined` on all 322 rows and serialises to `null` every time,
and `engine/feature_fixture.js:741` is its only reader in the repository.

Consequences, both live today:

- **A TYPE change to any species does not move the table digest.** Weather Ball, STAB, every
  effectiveness multiplier.
- **A WEIGHT change does not either** — `wt` is not in the hashed tuple at all. The 29 `wt` fills of
  2026-08-10 and 2026-08-31 were invisible to this gate, which is why `ec2e319c` moved the file and
  not the digest.

This is MEASURE's own instrument and it is a real defect. It is **not fixed in this session on
purpose**: correcting `m.ty` to `m.t` and adding `m.wt` changes the digest, so it must land in the
same pass as the restamp — never before the verdict, which is the trap `verify()` already warns
about one gate up.

## 7. What is still owed, and what this verdict does NOT say

RESTAMP settles the **damage-table** gate only. A refit is still owed for three reasons that have
nothing to do with the table, and none of them is answered here:

1. `status.js` reports engine SOURCE moved after the fit — `medicham2-browser.js` 2026-09-01,
   `data/engine-data.js` 2026-08-31, `data/abra-tags.js` 2026-08-29.
2. The corpus has grown from **8,942 to 16,830** clean open-sheet games (+88%) since the stamp.
3. `data/policy-weights.json` is **QUARANTINED** — fitted on features computed through MEDICHAM, and
   5 of 8 gate clauses fail. A refit run today produces a quarantined artifact. `status.js` already
   says the refit "is gated behind the engine, not behind compute".

So the restamp is correct and it is not a clean bill of health. It removes one false signal from a
file that is withheld for other reasons.

---

# OWED

Nothing below was run. Light mode was in force (Will at the keyboard); every command here either
pins the cores, plays games, or writes an artifact this session was told not to write.

**1. The restamp — only after Will accepts the verdict above.** This writes BOTH the new fixture
identity (12 scenarios) and the new table digest into `data/policy-weights.json`. Do not run it
before the ruler fix in step 2, or the wrong digest gets baselined:

```
node engine/feature_fixture.js --stamp data/policy-weights.json
node engine/feature_fixture.js --stamp data/joint-weights.json
node engine/feature_fixture.js --check data/policy-weights.json
```

**2. The ruler fix, in the same pass as the restamp, never before it.** In
`engine/feature_fixture.js:741`, `m.ty` names a field no row has and `m.wt` is not hashed at all:

```js
      m.mv || [], m.item || null, m.ab || null, m.st || null, m.bs || null, m.ty || null,
                                                                            ^^^^ should be m.t, and m.wt is missing
```

**3. The confirmatory measurement this session could not take.** The verdict above is a claim about
which INPUTS moved, argued from the two `buildMon` call sites and measured on the corpus. It is not
a measured refit delta. The direct check is an A/B of the fit's own feature extraction over a corpus
sample under each table — `fit_policy.js` is on the light-mode ban list:

```
node --max-old-space-size=4096 engine/fit_policy.js --dry-run --games 400
```

**4. The refit itself, if Will wants it for the reasons in section 7** (NOT for the damage table).
Ask before starting: it is expensive, it needs the heap flag, and it invalidates the seven artifacts
`engine/provenance.js` derives:

```
tools\lownode.cmd engine\fit_policy.js
tools\lownode.cmd engine\fit_joint.js
node engine/provenance.js
node engine/status.js --write
```

**5. `node engine/status.js --write` was NOT run, and that is deliberate.** At the end of this
session the working tree holds live edits from another division — `engine/medicham2-browser.js`,
`tests/test-mechanics.js`, `data/mechanics-census.json`, `data/open-work.json` all modified, plus an
untracked `tests/probe_delayed_crit.js` that is not mine and was left alone. Restamping the generated
blocks on top of a tree somebody is writing is the failure CLAUDE.md describes twice. Run it once the
ENGINE work lands:

```
node engine/status.js --write
```

Bearing on this report: the fixture A/B in section 5 loaded that modified `medicham2-browser.js`.
Both arms loaded the same bytes, so the DIFF (0 columns moved) stands; the absolute digests it
reproduced — `405c836793d1` and `1bda9df11d73` — match the gate's own, which is the control. Sections
2, 3 and 4 do not depend on it at all: they read `data/engine-data.js` (unmodified), archived git
blobs, and the store.

**6. The standing MEASURE item, unchanged and still the biggest open one.**
`data/winrate-backtest.json` is stale, was scored on 350 games at 40 rollouts, and is quarantined
behind MEDICHAM:

```
node engine/backtest_winrate.js
```
