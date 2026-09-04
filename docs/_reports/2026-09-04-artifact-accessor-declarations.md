# The 13 undeclared key-tables: 11 declared, 2 left red as dead tables

2026-09-04, MEASURE. Scope: `data/artifact-accessors.json` only. Nothing under `engine/` or `docs/`
was modified, no policy-weights file was touched, no game was played, nothing was committed.

---

## Verdict per table

| table | keys / not-flat | disposition |
|---|---|---|
| `tag-consumption.json:by_tag` | 291 / 275 | **DECLARED** — `tests/test-tag-consumed.js`, sole writer and sole reader |
| `policy-weights.json:featureHashes.features` | 58 / 50 | **DECLARED** — `engine/feature_fixture.js` `verify()` |
| `policy-weights-joint.json:featureHashes.features` | 56–58 / 48–50 | **DECLARED** — same one door |
| the other eight `policy-weights*:featureHashes.features` | 56–58 / 48–50 | **DECLARED** — same one door, reachability stated |
| `million-run.json:engine_counters` | 141 / 140 | **LEFT RED — dead table, nothing reads it** |
| `million-run-150k.json:engine_counters` | 148 / 147 | **LEFT RED — dead table, nothing reads it** |

Test after the change: **5 passed, 1 failed**. The one failure names exactly the two dead tables.
`every declared accessor file exists (none dangling)` still passes, and the test printed no
"declaration(s) no longer needed" line, so no declaration is stale.

---

## 1. None of the 13 is the `MC.mons` class, and saying otherwise would invent a defect

All three families key **camelCase identifiers**, not species formes:

- `by_tag` — our own tag vocabulary (`targetClass`, `formatSecondaryCount`, `volatileRestart`)
- `featureHashes.features` — `board.js` feature names (`effHalf`, `allyHit`, `tgtHurt`)
- `engine_counters` — simulator counter names (`flinchBlockedByInnerFocus`, `ppRefusedAtSelection`)

They trip the `FLAT` test because `norm()` would lowercase them, not because anybody normalises them.
The `MC.mons` class is a table keyed by a name a **human or a sheet writes**, where two spellings of
the same thing exist. That is `engine-data.js:MC.mons` and `porygon2-species.json:mons`, and nothing
else in the registry. This is recorded as `not_species_keys` at the top of the registry so the next
reader does not have to re-derive it.

## 2. `tag-consumption.json:by_tag` — genuine single accessor

Writer and reader are the same file. `tests/test-tag-consumed.js:349` writes `by_tag: status`;
`:277` reads it back as its own ratchet baseline (`t in prevStatus`, `prevStatus[t]`). The lookup key
`t` comes from `Object.keys(uses)`, built at `:62-70` by walking `data/tags.json`'s `rec.tags`
**verbatim** — the identical strings the write side used. No `norm()` exists in the path.

Checked for a second consumer and there is none: `app/quarantine-data.js:281`, `app/stadium.html:621`,
`web/quarantine-data.js:352` and `web/stadium.html:692` name the **filename** in a quarantine list and
read no field of it. This is the same shape as `porygon2-species.json:mons` — writer == reader, so
keys and lookups cannot diverge today, and the entry is the warning if a second consumer appears.

## 3. The ten `policy-weights*` tables are ONE answer, and it is R1 working rather than broken

Exactly one function reads the `features` sub-table: `verify()` at `engine/feature_fixture.js:900`.

```js
const a = stored[blk] || {}, b = now[blk] || {};      // blk === 'features'
for (const f of Object.keys(b)) { if (a[f] === undefined) ... else if (a[f] !== b[f]) ... }
```

`b` is `hashes(dex).features`, minted from `board.js`'s own feature list; `a` is the stamp, minted by
the same `hashes(dex)` at write time (`engine/fit_policy.js:1372`, `engine/fit_joint.js:226`, or the
`--stamp` CLI). Both sides come from one producer and are compared verbatim.

**Three callers, and every one of them hands the whole blob to the reader rather than indexing it:**

| caller | line | blocks |
|---|---|---|
| `engine/magnemite.js` `checkSemantics` | `:65` (marginal), `:450` (joint) | `['features']`, `['features','jointFeatures']` |
| `engine/feature_fixture.js` `--check FILE` CLI | `:1016` | derived from the file |
| `engine/status.js` (shells the CLI for the REFIT OWED verdict) | `:365` | `data/policy-weights.json` |

That is R2 exactly: callers differ by parameter (`opts.blocks`, the file path), not by
re-implementation. **This is not a FACTS-ARE-GLOBAL violation.**

**Reachability, stated rather than implied.** Only two of the ten are on a routine path:
`policy-weights.json` (`status.js:365`, `magnemite.js` `WEIGHTS_FILE` default) and
`policy-weights-joint.json` (`magnemite.js` `jointWeightsFile` default). The other eight —
`-all`, `-joint-presheet`, `-julyonly`, `-multiturn`, `-nomt`, `-nopop`, `-pre-censoring`,
`-presheet` — are ablation and archive fits, reached only by an explicit `--check <file>` or
`options.jointWeightsFile`. The registry says so in `families[]`: the declaration is a claim about
**who is allowed to read the table**, which is true of all ten, and is **not** a claim that all ten
are read today. Without that sentence the entry could be quoted as evidence that an ablation stamp is
live, which it is not.

**One near-miss worth naming.** `build/build_mag_variables.js:45` does read
`data/policy-weights-nopop.json` — but it reads the **top-level `features` ARRAY** and `weights`, not
`featureHashes.features`. Two different fields sharing a last name. The shape was printed before the
claim was made.

No policy-weights file was modified. They are under the owner's pause and quarantined; a restamp is a
REFIT question, not a key-convention question.

## 4. The two `engine_counters` tables are dead, and a declaration would be a false receipt

`engine/million_run.js:1463` writes `engine_counters: seenDelta`. `seenDelta` is built at `:1241-1242`:

```js
const seenDelta = {};
for (const k of Object.keys(M.MEDSEEN)) if (M.MEDSEEN[k] !== (seen0[k] || 0)) seenDelta[k] = M.MEDSEEN[k] - (seen0[k] || 0);
```

It is a per-run delta of `M.MEDSEEN`, the simulator's bulk counter object. **Nothing reads
`data/million-run.json` or `data/million-run-150k.json` back.** Derived, not guessed:

- `engine/million_run.js` never reads its own `OUT` — no `readFileSync(OUT)`, no `existsSync(OUT)`,
  no `prev` baseline, unlike `tests/test-tag-consumed.js` which does exactly that.
- Every other mention in the tree is quarantine **metadata listing the filename**
  (`web/quarantine-data.js:540,554`, `web/stadium.html:880,894`, `app/*`).
- `tests/test-docs-current.js`'s figure census scans numeric **values** across every `data/*.json`
  and never indexes a key.
- In-process, `instrumentChecks()` at `:1269` reads exactly **two** names by hard-coded literal —
  `counters.flinch` and `counters.secondaryVolatileApplied` — from the **live** object before the
  artifact is written. That is 2 of 141, and it is not a read of the artifact.

This is the same class as `docs/_reports/2026-09-04-sweep-instrument.md` §4 — 783 of 1048 counter
fields that nothing reads, of which `MEDSEEN` itself is **544 of 644**. This is that same object
published one layer down into an artifact, where bulk exposure makes it read as instrumented.

Declaring an accessor here would name a reader that does not exist. Both are recorded in the registry
under `deliberately_undeclared`, which `tests/test-artifact-keys.js` does not read, so the gate stays
red on purpose.

**The honest remedies are ENGINE's, not MEASURE's:** either give `engine_counters` a named reader, or
stop publishing the whole `MEDSEEN` delta and publish only the counters something checks. Neither is
a key-convention decision, so neither was taken here.

## 5. Method notes

- Shapes were printed before any field was queried — `Object.keys()` on each artifact root and on
  each flagged sub-table, and the value type of the first entry (`by_tag` → `"LIVE"`,
  `engine_counters` → `number`, `featureHashes.features` → a 12-hex digest string).
- No species key was typed into a grep. No grep result was treated as a disposition on its own; every
  reader claim above is a read of the call site.
- `node engine/where.js --artifacts` derives its map from **literal** `writeFileSync` targets, so it
  lists neither `million-run.json` (written through `argOf('--out', …)`) nor `tag-consumption.json`
  (written by a test). That is a limit of the index, not evidence of no writer, and the writers were
  located by reading the write sites.

---

# OWED

- **`million-run.json:engine_counters` and `million-run-150k.json:engine_counters` stay RED.**
  ENGINE (owner of `engine/million_run.js`) decides: give the counters a named reader, or publish
  only the ones `instrumentChecks()` actually checks. `tests/test-artifact-keys.js` will report
  `5 passed, 1 failed` until then, and that failure is correct.
- **The eight ablation `policy-weights*` stamps are declared but unread.** If they are genuinely
  dead artifacts they should be said to be dead in the same place the dead counters are — that is a
  REFIT-adjacent call for the weights owner, and the pause is in force.
- **Nothing here was committed.** `data/artifact-accessors.json` is modified on disk only.
