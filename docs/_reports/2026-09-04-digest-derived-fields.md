# The damage-table digest now derives its hashed fields from the rows

2026-09-04. MEASURE. One file changed: `engine/feature_fixture.js`. Nothing committed, nothing
restamped, nothing refitted.

## What was wrong, and it was my own fix from the day before

`tableDigest()` hashed an enumerated list of row fields. Until 2026-09-03 that list contained `m.ty`,
a field **0 of 322 rows carry** (the table spells typing `t`), so the term was a constant `null` and
the digest could never see a type change; `wt` was not hashed at all. The 2026-09-03 fix edited the
list to `m.t` and `m.wt`.

That is an INSTANCE fix and it re-arms the same failure. A list of the RIGHT names goes blind exactly
the way a list of the WRONG names did: the next field somebody adds to a row is silently unhashed.
Measured, not argued — see the RED run below.

## RED FIRST — the enumerated version, against the live table

Harness mutates one row of `MC.mons` in memory (resolved through `mcKey.all()`, never by hand) and
re-asks the module's own exported `tableDigest()`. No second copy of the hash exists.

```
BASELINE                        9d289cf77e24 (322 rows)
unmoved inject NEW field  g.crit_mult=2        9d289cf77e24
unmoved inject NEW field  g.abilityShield=true 9d289cf77e24
MOVED   mutate t   Dragon->Fairy               c33e0dc99ca5
MOVED   mutate wt  95->9500                    091c372c3e30
MOVED   mutate bs.atk 130->131                 b8f40808d090
unmoved mutate EXCLUDED set_source.n           9d289cf77e24
unmoved mutate EXCLUDED nature                 9d289cf77e24
unmoved mutate EXCLUDED base (mega row)        9d289cf77e24
unmoved mutate EXCLUDED mv_provenance.source   9d289cf77e24
unmoved DELETE mv on diancie-mega              9d289cf77e24     <- absence == present-and-empty
unmoved DELETE item on aegislash-blade         9d289cf77e24     <- absence == present-and-null
```

Two blind classes, not one. The injected-field case is the one the brief names. The DELETE case is a
second: `m.mv || []` maps an absent `mv` and a present `mv: []` to the same bytes, and `m.item ||
null` does the same for `null`. Four rows carry `mv: []` and ten carry `item: null` today, so both
collisions were live.

## GREEN — the derived version, same harness, same run

```
BASELINE                        9d289cf77e24 (322 rows, fields [mv,item,ab,st,bs,t,wt])
MOVED   inject NEW field  g.crit_mult=2        d6290ffbc88c (fields [...,crit_mult])
MOVED   inject NEW field  g.abilityShield=true 1c117ecc4e20 (fields [...,abilityShield])
MOVED   mutate t   Dragon->Fairy               c33e0dc99ca5
MOVED   mutate wt  95->9500                    091c372c3e30
MOVED   mutate bs.atk 130->131                 b8f40808d090
unmoved mutate EXCLUDED set_source.n           9d289cf77e24
unmoved mutate EXCLUDED nature                 9d289cf77e24
unmoved mutate EXCLUDED base (mega row)        9d289cf77e24
unmoved mutate EXCLUDED mv_provenance.source   9d289cf77e24
MOVED   DELETE mv on diancie-mega              67ef7b4d251b
MOVED   DELETE item on aegislash-blade         efb1fca0b5db
```

The three `MOVED` values for `t`, `wt` and `bs` are **byte-identical to the enumerated version's**,
which is the encoding being unchanged rather than a coincidence.

## THE DIGEST VALUE DID NOT MOVE: still `9d289cf77e24`

The derived set is exactly the previous explicit set. **No field entered and none left.** Union of
keys across all 322 rows is 13; six are declared out; seven are hashed:

| hashed | not hashed | declared reason |
|---|---|---|
| `mv` `item` `ab` `st` `bs` `t` `wt` | `nature` | reaches the damage formula only through `st`, which IS hashed |
| | `sp` | same |
| | `base` | provenance: which species a forme derives from |
| | `mega` | provenance: a flag marking this row a mega forme |
| | `mv_provenance` | provenance: where the moveset came from; the moveset itself is `mv` |
| | `set_source` | provenance: which observations produced the set; the set itself is hashed |

**This change adds no new reason to restamp.** The stamp in `data/policy-weights.json`
(`405c836793d1`, 318 species) remains stale for the two reasons already on record — the table was
regenerated 318 → 322, and the ruler changed on 2026-09-03 — and no third.

Keeping the value cost one declared construct: `TABLE_FIELD_ORDER` fixes the POSITIONS of the seven
fields hashed on 2026-09-03. It is **not** a membership list — a field absent from it is still
hashed, appended after those seven in sorted order — and the file says so in those words. Removing a
name from it reorders the digest; it does not stop the field being hashed.

## What else changed in the file

- **Absence carries a sentinel.** a NUL-prefixed sentinel for a key the row does not have, so it can no
  longer hash as `null` or `[]`. No row is missing a hashed field today, so this changes no byte of
  the current digest — it changes what happens the day one is.
- **`fields` and `notHashed` travel with the digest** into a stamp, so a stamp records WHAT was
  measured and not only its value.
- **`verify()` distinguishes a moved TABLE from a moved RULER.** When a stamp carries `fields` and
  they differ, the damage-table block gains one line naming which fields entered or left. Exercised:
  same fields → silent; `wt` entered → `AND THE RULER ITSELF CHANGED: fields hashed +wt`; a legacy
  stamp with no `fields` → silent, so nothing pre-existing cries wolf. The line is appended to the
  block's FIRST line, so the closing lines status.js renders keep their positions.
- **`deadExclusions`**, present only when non-empty: an exclusion naming a field no row carries is a
  dead line, which is how `ty` survived. Empty today.
- **The CLI prints the derived set and every exclusion with its reason.** Default output only;
  status.js invokes `--check` and never parses this.

## The output contract is intact

- `node engine/feature_fixture.js --check data/policy-weights.json` → exit 1, first line
  `FEATURE SEMANTICS CHECK FAILED — data/policy-weights.json`, same two gates
  (`fixture identity, damage table`), digest reported `405c836793d1 -> 9d289cf77e24`.
- `node engine/status.js` (read-only) → exit 0, verdict `REFIT OWED`, and its `how:` line is
  **byte-identical** to the stamped line 31 of `docs/MEASURE.md` (compared programmatically, not by
  eye). No doc restamp is owed.
- `node tests/test-feature-semantics.js` → **24 passed, 0 failed**, including the four specificity
  assertions that the table gate is not swallowed and the column gate is still withheld.

Caveat on the `status.js` run: other agents were writing artifacts in the same window, so that run is
evidence about PARSING only. No number from it is quoted here or anywhere.

## Verdict: CLASS

The acceptance test — *would this catch a second instance, spelled differently, arriving through
another door?* — is answered by the two injected fields, which have nothing to do with `ty`, `t` or
`wt` and were never named anywhere. A field added to a row tomorrow is hashed by default; excluding
one is an edit to a map with a reason in it.

Two residuals, stated rather than rounded away:

1. **Object key ORDER inside `st` and `bs` still reaches the digest**, because those are serialised
   with `JSON.stringify`. A regeneration that emits the same stats in a different key order would
   fire the gate spuriously. This is unchanged from before and errs safe (false positive, not false
   negative); canonicalising it would move the digest value, which is the one thing this change was
   asked not to do.
2. **The exclusion list is a judgement, not a derivation.** `nature` and `sp` are excluded on the
   claim that they reach damage only through `st`. Nothing MEASURES that claim; if the builder ever
   stopped folding them into `st`, the digest would go blind to them and only the reason-string would
   say otherwise.

## OWED

- **A restamp of `data/policy-weights.json` is still owed and was NOT taken** — MAG is under the
  owner's explicit pause and a restamp answers the fixture gate while silencing the table gate.
  When it is taken it will absorb all reasons inseparably: the 318 → 322 regeneration and the
  2026-09-03 ruler repair. This change adds no third reason.
- **Residual 1 above** (key-order sensitivity in `st`/`bs`) has no register row.
- **Residual 2 above** (the `nature`/`sp` exclusion is unmeasured) has no register row.
- **Nothing is committed.** `engine/feature_fixture.js` is modified on disk only, alongside other
  agents' unrelated working-tree changes.
