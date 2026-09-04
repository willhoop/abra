# The damage-table digest was blind to typing and to weight

**2026-09-03 — MEASURE. Light mode (Will at the keyboard): no game was played, no fit was run, no
artifact was written.**

## Verdict

`tableDigest()` in `engine/feature_fixture.js` hashed a field that does not exist. Its comment said
it covered "the stats and typing the damage formula multiplies"; the code hashed `m.ty`, and **0 of
322 rows carry `ty`**. The term evaluated to a constant `null` on every row, so the digest has never
been able to see a **type** change. `m.wt` — species weight, which the simulator reads for Low Kick,
Grass Knot, Heavy Slam, Heat Crash and for Heavy Metal / Light Metal — was not hashed at all, so it
was equally invisible.

This is a **ruler** defect, not an engine one. The guard reported agreement about two fields it had
never checked.

Fixed. `m.ty` → `m.t`, and `m.wt` appended. The digest over the current table moves
**`1bda9df11d73` → `9d289cf77e24`** with **no change whatsoever to the table itself**.

## The table's real shape, derived not assumed

Field census over `mcKey.all()` (322 rows, resolved through `engine/mc_key.js`; no species key is
typed anywhere in this pass):

| field | rows carrying it | hashed after the fix? |
|---|---|---|
| `t` (typing) | 322 | **yes — new** |
| `bs` (base stats) | 322 | yes |
| `st` (computed stats) | 322 | yes |
| `mv` (moves) | 322 | yes |
| `item` | 322 | yes |
| `ab` (ability) | 322 | yes |
| `wt` (weight, kg) | 322 | **yes — new** |
| `set_source` | 229 | no — provenance |
| `nature` | 195 | no — reaches the formula through `st` |
| `sp` (SP spread) | 195 | no — reaches the formula through `st` |
| `base` | 90 | no — metadata |
| `mega` | 80 | no — metadata |
| `mv_provenance` | 80 | no — provenance |
| `ty` | **0** | n/a — the field never existed |

The `nature` / `sp` exclusion is a **judgement with a reason**, stated so it can be argued with:
`st` is computed from base stats + nature + SP by the generator, so a spread change that does not
move `st` did not move the damage calculation either. If a future generator ever writes `st`
inconsistently with `nature`/`sp`, that is a generator defect and this digest will not catch it.

## Shown RED first, then GREEN, with a control

A check that has never failed is not evidence. The demonstration mutates **one field of one row of
the real table, in memory**, re-asks the **canonical** `tableDigest()` — no second copy of the hash
was written, because a re-implementation would have agreed with the bug it was hunting (LESSONS §8,
`buildMon("Scizor")`) — restores, and confirms the baseline digest comes back.

The subject row is chosen by **index 0 of the sorted `mcKey.all()`** (it resolves to `abomasnow`),
never by a typed species name.

**BEFORE the fix — exit 1:**

```
table: 322 species, digest 1bda9df11d73
subject row (index 0 of the sorted table): abomasnow
  fields present: t,bs,st,mv,item,ab,wt,nature,sp,set_source

  t    (typing)                      1bda9df11d73  BLIND — digest unchanged
  wt   (weight)                      1bda9df11d73  BLIND — digest unchanged
  mv   (moves)  CONTROL              6fb1245a9f0d  MOVED
  st   (stats)  CONTROL              343196b97723  MOVED
  ty   (the field the code hashed)   29a68189ab3f  MOVED

restored digest 1bda9df11d73 (matches baseline — no state leaked)
VERDICT: 2 field(s) BLIND — the digest cannot see a change to them.
```

**AFTER the fix — exit 0:**

```
table: 322 species, digest 9d289cf77e24
subject row (index 0 of the sorted table): abomasnow
  fields present: t,bs,st,mv,item,ab,wt,nature,sp,set_source

  t    (typing)                      7c5f9ad8b324  MOVED
  wt   (weight)                      9fe8b62a0c23  MOVED
  mv   (moves)  CONTROL              3ecf5fcb0e19  MOVED
  st   (stats)  CONTROL              97c08edded04  MOVED
  ty   (the field the code hashed)   9d289cf77e24  BLIND — digest unchanged

restored digest 9d289cf77e24 (matches baseline — no state leaked)
VERDICT: every field the comment claims is hashed is actually hashed.
```

Three things this proves that the bare fix does not:

1. **The blindness was real and specific**, not an argument from reading the source.
2. **The controls (`mv`, `st`) moved in BOTH arms**, so the harness was capable of seeing a change
   throughout and the two BLIND rows are a fact about the digest, not about the probe.
3. **The `ty` row is the diagnosis, arrived at by measurement rather than by inference.** Inventing
   a `ty` field on the row moved the digest *before* the fix — so the term was live in the hash and
   the DATA never populated it. That is exactly why reading the code could not settle it: a field
   that is absent hashes as `null` identically to a field that is present and empty. Only a mutation
   test tells the two apart. After the fix, `ty` is correctly ignored.

Why this was not a typo anybody would have spotted: `ty` is the plausible spelling, it sat directly
under a comment asserting that typing was covered, and the guard's silence read as agreement. Same
shape as every other entry in this repository's ledger — an absent capability reporting success.

## Nothing downstream was written, and the gate still parses

**`data/policy-weights.json` was NOT touched. No restamp, no refit.** Will's standing decision.

`engine/status.js` shells out to `node engine/feature_fixture.js --check data/policy-weights.json`
and parses (a) the exit code, (b) the literal string `FEATURE SEMANTICS CHECK FAILED`, and (c) the
**last three non-empty lines joined by ` | `**. All three were re-verified after the change:

- exit code 1 — unchanged
- `FEATURE SEMANTICS CHECK FAILED` present — regex matches, so status.js takes the `REFIT OWED`
  branch and not the `NOT DERIVED` ("could not run") branch
- the parsed `how:` string is **byte-identical** to the one already stamped in the generated block
  of `docs/MEASURE.md`:

```
feature_fixture --check FAILED:   or restamp with: node engine/feature_fixture.js --stamp <file> |   GATES THAT FIRED: fixture identity, damage table. A RESTAMP ANSWERS THE FIXTURE GATE AND SILENCES THE TABLE GATE — |   settle the table verdict first, or the evidence for the refit is written over.
```

**The gate fires exactly as it did before.** Both the fixture-identity gate and the damage-table gate
were already firing (10 scenarios → 12, and 318 species → 322), and both still fire. The only thing
that changed in the printed body is one hex value:

```
the DAMAGE TABLE these weights were fitted against has been regenerated
(318 species -> 322, digest 405c836793d1 -> 9d289cf77e24).
```

was `405c836793d1 -> 1bda9df11d73`.

`node engine/status.js` was run once end-to-end (2m13s, no `--write`): it executed the check, printed
its verdict, and completed. Nothing went silent or garbled.

`node tests/test-feature-semantics.js` — **24 passed, 0 failed**, and its own assertion now reports
`322 species, 9d289cf77e24`. No test anywhere asserts a hard-coded digest value.

## THE STAMP IS NOW STALE FOR A SECOND, DIFFERENT REASON

Whoever performs the restamp must know that **two independent things moved**, because the printed
verdict looks like one:

| | stamped in `data/policy-weights.json` | on disk today | why it moved |
|---|---|---|---|
| table digest | `405c836793d1` (318 species) | `9d289cf77e24` (322 species) | **the TABLE was regenerated** (ENGINE), **and the RULER changed** (this pass) |

Reason 1 is the pre-existing one: the damage table was regenerated, 318 → 322 species. Reason 2 is
new today: the function that computes the digest now hashes typing and weight, so it would return a
different value **even against the old table**. A restamp done later will absorb both at once and
will not be able to distinguish them afterwards. That is recorded here so it does not have to be.

**All ten `data/policy-weights*.json` files carry `405c836793d1`, as do the copies inside
`data/releases/*/`.** None was written.

One further consequence worth naming: because the ruler was blind, **any typing or weight change to
the table between the stamp and today passed this gate in silence.** This pass does not claim such a
change happened — it claims that if one had, nothing here would have said so. Measuring whether one
did requires diffing the stamped-era table against today's, which needs the old artifact and is not
attempted under light mode.

## Files changed

- `engine/feature_fixture.js` — `m.ty` → `m.t`; `m.wt` added; a dated comment at the site explaining
  why the dead term was there and why the field order is append-only; `tableDigest` added to
  `module.exports` so the demonstration can call the canonical function rather than copy it.
- `tests/test-feature-semantics.js` — comment only. Its §6b narrative asserted "the table is now
  `1bda9df11d73`", which this pass makes false. The dated paragraph is left standing and a dated
  correction is appended beneath it, per the repo's rule against rewriting a dated claim in place.

**No new gate, no new test, no test on a gate.** The probe is not added to `tests/` deliberately:
`tests/run-all.js` carries a coverage assertion over `tests/`, so a new file there would require an
exemption entry — which is the bloat this brief forbids. Its full source is below so it is genuinely
re-runnable by anyone, from anywhere.

```js
/* probe_table_digest_fields.js — does tableDigest() SEE a change to each field it claims to hash?
 * Run: node <this file>            ABRA_ROOT env var points at the repo if it is not __dirname. */
'use strict';
const path = require('path');
const ROOT = process.env.ABRA_ROOT || path.resolve(__dirname);

require(path.join(ROOT, 'data', 'engine-data.js'));          // publishes globalThis.MC
const { mcKey } = require(path.join(ROOT, 'engine', 'mc_key.js'));
const FF = require(path.join(ROOT, 'engine', 'feature_fixture.js'));

const rows = mcKey.all({ mayMiss: 'a probe that cannot load the table has nothing to say' });
if (!rows) { console.error('MC.mons is not loaded — probe cannot run'); process.exit(2); }

const base = FF.tableDigest();
console.log(`table: ${base.species} species, digest ${base.digest}`);

/* Subject: the first row of the sorted table. Derived, never typed. */
const [subjectKey, subject] = rows[0];
console.log(`subject row (index 0 of the sorted table): ${subjectKey}`);
console.log(`  fields present: ${Object.keys(subject).join(',')}\n`);

const CASES = [
  ['t    (typing)', m => { const old = m.t; m.t = ['Fire']; return () => { m.t = old; }; }],
  ['wt   (weight)', m => { const old = m.wt; m.wt = (+m.wt || 0) + 1; return () => { m.wt = old; }; }],
  ['mv   (moves)  CONTROL', m => { const old = m.mv; m.mv = (m.mv || []).concat(['probe-sentinel']); return () => { m.mv = old; }; }],
  ['st   (stats)  CONTROL', m => { const old = m.st; m.st = Object.assign({}, m.st, { hp: (m.st && m.st.hp || 0) + 1 }); return () => { m.st = old; }; }],
  ['ty   (the field the code hashed)', m => { const old = m.ty; m.ty = 'MUTATED'; return () => { if (old === undefined) delete m.ty; else m.ty = old; }; }],
];

let blind = 0;
for (const [label, mutate] of CASES) {
  const restore = mutate(subject);
  const after = FF.tableDigest();
  restore();
  const moved = after.digest !== base.digest;
  if (!moved && !/^ty /.test(label)) blind++;
  console.log(`  ${label.padEnd(34)} ${after.digest}  ${moved ? 'MOVED' : 'BLIND — digest unchanged'}`);
}

const back = FF.tableDigest();
console.log(`\nrestored digest ${back.digest} ${back.digest === base.digest ? '(matches baseline — no state leaked)' : 'DOES NOT MATCH BASELINE'}`);
console.log(blind === 0
  ? '\nVERDICT: every field the comment claims is hashed is actually hashed.'
  : `\nVERDICT: ${blind} field(s) BLIND — the digest cannot see a change to them.`);
process.exit(blind === 0 && back.digest === base.digest ? 0 : 1);
```

## Debris noted, NOT touched

`data/provenance-stamp.json` was already modified in the working tree when this pass began (it is in
the session's opening `git status`). It was not written by this pass and has not been reverted,
staged or cleaned.

## OWED

Nothing in this pass was blocked by light mode except the runs listed below. Nothing here has been
run.

**Re-runnable now, cheap, and not run because they were not needed for this verdict:**

```bash
# the demonstration, both arms (≈1s each) — paste the probe above into a file first
node /path/to/probe_table_digest_fields.js

# the owning test (≈2s) — run in this pass, green, listed so it can be repeated
node tests/test-feature-semantics.js
```

**Owed because light mode forbade them.** These play games or pin cores and must not run while Will
is at the keyboard:

```bash
# re-stamp the generated blocks of the division ledgers with today's status
node engine/status.js --write

# the full batch, which this pass did not run
tools\lownode.cmd tests\run-all.js
```

**WILL'S CALL — NOT TO BE RUN.** The restamp is his decision and is deliberately left undone. It is
written out here only so the exact command is not reconstructed from memory later:

```bash
# DO NOT RUN. WILL'S CALL.
node engine/feature_fixture.js --stamp data/policy-weights.json
```

Two things whoever runs it must hold at that moment:

- **A restamp answers the fixture gate and SILENCES the table gate.** The check says so itself. Once
  `9d289cf77e24` is written into the baseline, the evidence that the table was regenerated is gone.
- **The stamp is stale for TWO reasons and the restamp absorbs both.** The table moved (318 → 322
  species) and the ruler moved (this pass). The verdict string cannot tell them apart afterwards.

The refit — `node --max-old-space-size=4096 engine/fit_policy.js` then
`node --max-old-space-size=4096 engine/fit_joint.js` — is **NOT owed by this pass** and is not
proposed here. MAG is under Will's pause until MEDICHAM is correct, and the standing verdict on the
current damage-table change is RESTAMP-not-refit.
