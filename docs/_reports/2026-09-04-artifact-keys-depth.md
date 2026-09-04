# `tests/test-artifact-keys.js` stopped looking, in four places, and reported nothing

Date: 2026-09-04. Owner of the change: ENGINE. File touched: `tests/test-artifact-keys.js` only.
Not committed.

## Confirmed at the line

`tables()` descended into only `ks.slice(0, 8)` of any object (old line 57). The reported numbers
are confirmed independently, not relayed:

| walk | tables found | wall time |
|---|---|---|
| `slice(0,8)`, `depth<=3` — as shipped | **16** | 596 ms |
| every key, `depth<=3` | **49** | 520 ms |
| every key, `depth<=8` | **50** | 509 ms |
| every key, any depth, arrays descended | **50** | 733 ms |

**33 tables were invisible. 13 of them are NOT flat-lowercase** — precisely the risk class the guard
claims to enumerate. The file header said "of eleven real name-keyed tables in data/ with 50+ keys";
the true count is fifty.

**The slice was never a cost guard.** The full walk is the same speed to within noise, because
`JSON.parse` dominates and always did — the heaviest artifact is 1,534 object nodes (188,906 with
arrays), which is nothing. So there was no trade-off being made; the truncation bought zero.

## It was not one limit. It was four, and three were the same bug wearing different clothes

| silent stop | what it hid | now |
|---|---|---|
| `ks.slice(0, 8)` | 33 tables, 13 not-flat | walks every key |
| `depth > 3` | 1 more table; deepest real object in `data/` is 10 | budget `MAX_DEPTH 40`, **named + FAILS** when hit |
| `Array.isArray(obj) return` | 0 tables today (measured), but nothing said so | arrays descended |
| `for (const name of ['mons','moves'])` | **`MC.priors`, 230 keys, never inspected once** | walks whatever `MC` holds |
| `catch { console.error('could not load engine-data.js') }` | the whole of `MC`, on a stderr murmur, exit 0 | **named assertion, FAILS** |

The `MC` name list is worth naming separately: it is the identical failure as the slice — a
hand-typed list reports nothing about what it did not name — sitting in the very file written to
catch that failure, guarding the very table that caused it.

One limit was kept because it was **measured, not assumed**: the `return` after a table is found.
Descending into every found table's values costs 9.3 s instead of 0.7 s and turns up **zero** further
tables. That is a scope rule with a number behind it, and the comment now records the number so the
next reader can re-measure rather than re-trust.

## Red first, with a control

Sandbox at `<scratch>/ak_sandbox/` with its own `data/`; nothing in the repo was used as a fixture.
Both arms load an identical stub `engine-data.js`, so the fixture is the only variable.

| arm | fixture | OLD test | NEW test |
|---|---|---|---|
| 1 | 60-key **not-flat** table at root key **#9**, decoy flat table at #1 | **4 passed, 0 failed, exit 0** | FAIL — names `fixture.json:by_tag` |
| 2 | same table at **depth 5** | 0 failed, exit 0 | FAIL — names `fixture.json:deep.l1.l2.l3.l4.by_tag` |
| 3 | not-flat table on **`MC.priors`** | 0 failed, exit 0 | FAIL — names `engine-data.js:MC.priors` |
| 4 | `engine-data.js` throws on load | 0 failed, exit 0 | FAIL — names the load error |
| **C1** | **same shape, table is flat-lowercase** | — | **6 passed, 0 failed, exit 0** |
| **C2** | **not-flat but declared in the registry** | — | **6 passed, 0 failed, exit 0** |

C1 and C2 are the control. C2 matters most: without it the new test could be merely always-red on
anything not-flat, which would be noise rather than a check.

The budget was also shown red on purpose. Rebuilt with `NODE_BUDGET = 3` and with `MAX_DEPTH = 1`,
the test does not truncate quietly — it prints
`FAIL the walk finished every artifact ... UNFINISHED: engine-data.js:MC.moves (node budget 3 exhausted)`.
That is the invariant: **a budget may exist; a budget that is hit and says nothing may not.**

## What the test finds now — NEW, REAL, and NOT fixed here

`node tests/test-artifact-keys.js` → **5 passed, 1 failed**, 1.2 s. 53 tables, 16 riskable,
**13 undeclared**. These are new findings, they are the point of the fix, and they are left open for
routing rather than trimmed:

| table | keys | not-flat | who touches it (grep) |
|---|---|---|---|
| `tag-consumption.json:by_tag` | 291 | 275 | written+read by `tests/test-tag-consumed.js` (`prev.by_tag`) |
| `million-run.json:engine_counters` | 141 | 140 | written by `engine/million_run.js:1463`; no reader found |
| `million-run-150k.json:engine_counters` | 148 | 147 | same shape, older artifact |
| `policy-weights*.json:featureHashes.features` × 10 | 56–58 | 50 | `engine/feature_fixture.js`, `engine/fit_joint.js` |

Their keys are camelCase identifiers (`flinchBlockedByInnerFocus`, `effHalf`, `targetClass`), not
species formes — so this is not automatically an `MC.mons` repeat. It is the question the registry
exists to force someone to answer once, in writing. **`engine/feature_fixture.js` is owned by another
live agent; I did not touch it.**

Routing note: the honest resolutions are (a) declare each with its accessor, or (b) if a `by_tag` /
`engine_counters` key is only ever iterated and never looked up by a derived name, say so in the
registry the way `scoreboard.json:labels` already does. Neither is an ENGINE-can-decide-alone call.

## Will's acceptance test, answered honestly

*Would this catch a second instance, spelled differently, through another door?*

**Yes for the class of "the walk stopped early".** Breadth, depth, arrays, cycles and a hardcoded
name list are all closed, and any stop that does occur is named and fails. A new artifact with
hyphenated keys at key #200, at depth 9, inside an array, or on a new `MC.<something>` is caught with
no edit to this file.

**No — still INSTANCE-level — for three residues, stated rather than papered over:**

1. **Scope is `data/*.json` plus `data/engine-data.js`.** `5,466 .json files in 12 subdirectories`
   are not inspected. That line now *prints on every run, by name*, so it is a declared scope instead
   of a blind spot — but nothing FAILS if a new subdirectory appears with risky tables. A table in
   `web/`, `app/`, `engine/`, or any `.js` artifact other than `engine-data.js`, is outside this
   guard entirely. **This is the most likely fifth door.**
2. **`MIN_KEYS = 50` is itself a silent threshold.** A 40-key species table is invisible by
   construction and nothing says so. Measured today: exactly **one** not-flat table in the 25–49 band,
   `medicham-represented-clicks.json:by_kind`, whose only not-flat key is `PASS` — a status label. So
   the threshold costs nothing right now, which is why I added no machinery for it; it is a real
   residue, not a closed one.
3. **The stop-at-found-table rule** is measured (0 nested tables) rather than assumed, but the
   measurement will age, and nothing re-takes it automatically.

## Caveats on my own numbers

Three other agents were live and `data/` was being rewritten during this work — twelve artifacts had
mtimes inside the preceding 40 minutes. The census of 33 hidden / 13 not-flat is a **snapshot**. Every
`data/*.json` parsed cleanly on each run, so no torn read is implicated, but the exact table count can
move as artifacts are regenerated. The structural findings (four silent stops, `MC.priors`) do not
depend on the snapshot.

## OWED

- **`tests/test-artifact-keys.js` is now RED, deliberately, with 13 undeclared tables.** It was green
  only because it was not looking. Whoever is triaging `run-all` will see this — it is a real finding,
  not a regression I introduced, and it needs the routing call above, not a revert.
- **Decide the 13**: declare an accessor each, or record why iteration-only makes the question moot.
  `featureHashes.features` (10 of the 13) belongs with whoever owns `engine/feature_fixture.js`.
- **The fifth door is scope, not depth.** This guard sees `data/*.json` and one `.js`. Extending it to
  other directories, or failing on an undeclared new subdirectory, was deliberately not done here —
  it needs a seeded registry of ~12 reasons that ENGINE should not type alone.
- **Not committed.** The change is on disk only.
