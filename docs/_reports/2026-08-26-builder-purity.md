# `build/build_engine_data.js` — the self-read, relocated and then measured

MEASURE, 2026-08-26. Follows `docs/_reports/2026-08-26-engine-data-shadow.md`, which measured the
problem. This pass moved values; it changed none.

---

## VERDICT

**The builder is NOT pure yet, and the residue is now a measured number instead of an adjective:
2,072 field values.** They are `st, mv, item, ab, nature, sp, set_source, base, mega, mv_provenance`
on the 307 species rows champ-model carries, and every one of them belongs to a LATER generator that
edits `data/engine-data.js` in place. Nothing in this batch could have closed them without a pipeline
change that carries a measured value change of its own.

**1,350 values that had no source anywhere stopped being compared to themselves.** Three of the four
top-level sections of `MC` are now pure — `moves` (500 rows), `C` (18), `priors` (230) — and the 15
species rows champ-model does not carry survive a build with the artifact deleted. Before this pass
the self-read covered 3,422 values; it covers 2,072.

**The output is byte-identical.** The builder's candidate bytes are
`5e2a246a71aa98d615861e332492fc63c25b00b06c65906ad06d20e772df3265` before the change and
`5e2a246a71aa98d615861e332492fc63c25b00b06c65906ad06d20e772df3265` after it — same sha256, 201,305
bytes, every value, every key and every key ORDER identical.

**`data/engine-data.js` itself was not written, and is not to be.** It is unchanged at
`c73da1d25212f447747ff645ceac613707d812060af1fe97a30b4f79b6773d3a`, re-hashed after every step below.
Regenerating it today is a **value change**, not a chore — see §5.

---

## 1. What moved, and what it cost

| # | relocation | from | to | values |
|---|---|---|---|---|
| 1 | `MC.priors` — the rollout's opponent model | inside `data/engine-data.js` | `data/mc-priors.json`, declared HAND-AUTHORED | 230 |
| 2 | the illegal-ability repair's reachability | conditioned on `mon.ab` being truthy | fires on absent OR illegal | 0 today, **113 on a from-scratch build** |
| 3 | rows no generator emits | inside `data/engine-data.js` | `data/mc-declared-rows.json` | 15 rows / 120 field values |
| + | the wrapper, `mcEff`, the export block | read off the output it was overwriting | `data/engine-data.template.txt` | structural |
| + | all 500 `moves` rows' `t` and `c` | carried from the previous output | `champ-model.MOVES` | 1,000 |

The moves row is the one that was not asked for and was free. `champ-model.MOVES` holds **the same
500 keys in the same order** with `t` and `c` agreeing on all 500 (`Physical→P`, everything else
`→S`). Nothing had to be reimplemented and nothing had to be re-ordered.

**It immediately paid.** The builder used to report `base power taken from the format: 0 row(s)
CORRECTED`. It now reports **12** — `infernalparade, firstimpression, bonerush, nightdaze,
mountaingale, spiritshackle, beakblast, firelash, tropkick, gravapple, appleacid, psyshieldbash`.
Zero was never true. It was the artifact agreeing with the copy of itself it had just been handed;
the 12 are champ-model's generic gen-9 base powers against the Champions format's, the same 12 the
builder's own header has named since 2026-08-09.

---

## 2. Relocation 2 — the repair that was conditioned on the damage

`build/rebuild_sets_from_sheets.js` guarded its dex-primary ability repair on `mon.ab` being present:

```js
if (sp0 && sp0.exists && mon.ab) {          // <- requires the bad value to BE there
  ...
  if (legal.size && !legal.has(norm(mon.ab)))
```

So the correction could only ever fire on a row that already carried an ability. It now reads
`if (sp0 && sp0.exists)` with `const absent = !mon.ab;` and fires on `absent || !legal.has(...)`,
with the `set_source.note` naming which of the two cases it was rather than asserting the commoner
one.

**Measured on the live artifact: no value changes.** `node build/rebuild_sets_from_sheets.js` (report
mode) reports `illegal abilities fixed 0` before and after, and 0 rows in `data/engine-data.js` carry
a null ability, so there is nothing for the widened branch to reach.

**Measured on a from-scratch build: 113 rows.** Driving the pure build's output (132,311 bytes, 308
rows at `ab: null`) through stage 2:

```
  species in engine-data   323
  rebuilt from real sheets 195
  left alone (<10 sheets)  128
  illegal abilities fixed  113        <- the old guard could reach at most 15 of these
  after stage 2: ab null   0          <- the old guard leaves 113 rows at null
```

The 15 the old guard could reach are the declared rows, which carry an ability from
`mc-declared-rows.json`. Every other low-sheet row arrived at `ab: null` and the branch skipped it.
**A repair that only works when the damage is already present is not a repair.** `ab: null` reads
downstream as "this Pokemon has no ability", which is the 2026-07-30 shape exactly.

76 rows still differ from the live artifact after stage 2 and **74 of those are capitalisation**
(`Tough Claws` vs `toughclaws`) on mega rows that stage 3 rewrites. The two that are not are
`glalie` (live `moody`, dex primary `innerfocus`) and one sibling — the "legal but unsourced"
abilities the shadow report already named. They are NOT touched here.

---

## 3. Relocation 3 — and a correction to the count

The shadow report said three rows carry a type their base forme does not. The builder now
**re-derives** that list from the dex on every run rather than reading it out of a header, and the
answer is **five**:

```
  BOARD-MATERIAL (type differs from the base forme's): 5
    castform-snowy ["Ice"]  castform-rainy ["Water"]  castform-sunny ["Fire"]
    feraligatr-mega ["Water","Dragon"]  barbaracle-mega ["Rock","Fighting"]
```

Three is still the right number for *"has no generator at all"* — the two megas are re-added by
`engine/merge_mega_into_engine.js`. The header of `data/mc-declared-rows.json` says both things and
the derived line is what the builder prints, so the sentence cannot rot unchecked.

---

## 4. The purity instrument

`node build/build_engine_data.js --purity` builds the identical MC twice — once with the previous
artifact and once with it hidden — renders both with the same date stamp, and diffs them.

```
  with the artifact   : 201305 bytes
  with it hidden      : 132311 bytes
  IDENTICAL           : NO

  mons: 307 row(s) differ, 0 row(s) exist only with the artifact
     st 307 | item 307 | ab 307 | mv 303 | set_source 229 | nature 195 | sp 195
     base 75 | mega 75 | mv_provenance 75
  moves:  pure (500 rows)
  C:      pure (18 rows)
  priors: pure (230 rows)

  TOTAL CARRIED VALUES: 2072
```

`0 row(s) exist only with the artifact` is the line that says relocation 3 landed: hide
`data/engine-data.js` entirely and all 323 rows still come out.

**It is a RATCHET, not an assertion at zero.** `data/engine-data-purity.json` records 2,072; the
number may fall and may never rise. Zero is not reachable from inside this file, and a gate that is
permanently red becomes "one of the known failures" and then becomes wallpaper — which is the failure
this repository is named after. Shown red on a deliberate break before being trusted: with the
ratchet doctored to 2,071 the run exits 1 with `RATCHET BROKEN: 2071 -> 2072`, and exits 0 at 2,072.

### The refusals were shown red too

All four exit 2 and write nothing (artifact re-hashed after each):

```
  data/mc-priors.json hidden          -> exit 2, "Refusing to build"
  data/mc-declared-rows.json hidden   -> exit 2, "Refusing to build"
  data/engine-data.template.txt hidden-> exit 2, "Refusing to build"
  data/mc-priors.json count lies      -> exit 2, "declares count 231 and holds 230 rows"
```

A `|| {}` in any of those would delete 230 priors or 15 species rows and report success.

---

## 5. Two findings that are not mine to fix

**`--check` could not see key ORDER, and the artifact is out of order.** Every comparison in it runs
over PARSED objects, so a section whose rows are identical but re-ordered reported *"0 rows differ"*
while the byte comparison said drift — a diff that named nothing. A clause was added. It fires today:

```
  mons: KEY ORDER differs from index 35 — artifact has "castform-snowy",
        the sources produce "torterra".
```

`castform-snowy/rainy/sunny` sit at indices 35–37 in the artifact and `morpeko-hangry` at 182,
`mimikyu-busted` at 200; the builder emits them at the END, because champ-model dropped those rows
after the artifact was last built. The previous shadow report's green control compared parsed objects
and missed this, as did every `--check` run before today.

**`--check` is RED, and was red before this pass, for the same one row.**

```
  mons: 1 row(s) differ — floette-eternal-mega
     floette-eternal-mega: MISSING FROM THE ARTIFACT — the source carries it
```

**So regenerating `data/engine-data.js` today would add one species row and move five others.** That
is a byte change in an artifact that is in `engine_release.js` SOURCES and is therefore frozen into
every future release. It is a decision, it is a VALUE change on the floette row, and this batch is
explicitly not allowed to make one. The artifact was left alone.

**Conformance S13 gained two findings, both true, and that is the relocation working.** `data/mc-priors.json`
and `data/mc-declared-rows.json` are flagged *"no generator writes it"*. They are exactly that — 230
hand-authored opponent-model rows and 15 hand-declared species rows. **S13 could not see them
before**, because they were hiding inside a file that HAS a generator. This is the same shape one
level up: a violation invisible for as long as it was compared to itself. The right answer is a
generator for `MC.priors` (MAG's work, and it changes what every rollout believes — 114 of 230 modal
clicks move), not an exemption list. `engine/conformance.js --strict` was already red with 51
regressions from other work; 2 of the 51 are these. Nothing was added to any baseline.

---

## 6. WHAT STILL WALKS PAST THE CHECK

Named so nobody has to rediscover them.

1. **The 2,072 carried values.** `--check` compares them to themselves and always will. The one change
   that closes them: `build/rebuild_sets_from_sheets.js` and `engine/merge_mega_into_engine.js` must
   write their own layer file under `data/` and this builder must merge the layers. It is a pipeline
   change and it is not free — re-deriving stage 3 from today's sheet store moves **14 mega movesets
   and all 76 `mv_provenance` blocks**, so it carries a value change and a re-run.
2. **A SECOND ARTIFACT written by this builder.** The check is written against `OUT`, not against a
   scan of what was written. This builder writes exactly one file today, so the hole is latent — but
   it is a property of how the check is phrased, not of what the builder happens to do.
3. **A WRONG SOURCE is invisible.** If `champ-model.js` is wrong, artifact and source agree and the
   check goes green. It proves AGREEMENT, never correctness. That now covers 500 move rows that were
   previously not proven at all — a strictly better place to stand, and still not correctness.
4. **`data/mc-priors.json` cannot be checked against anything.** The relocation converts "silently
   compared to itself" into "declared hand-authored, with no upstream and saying so". That is an
   improvement in honesty, not in truth.
5. **`engine/generated_audit.js` will not spawn `--check`.** Its play-layer walk sees the `require` of
   `engine/champions_sim.js` and refuses, by design, to run any builder that reaches the simulator. So
   this file stays UNPROVABLE in that report and `--check` must be run by hand.
6. **The `bs`/`t` of the 15 declared rows** agree with themselves by construction. Nothing in this pass
   compared them to the dex.

---

## OWED, NOT RUN

- **The layer refactor in §6.1.** Named, costed at 90 values of stage-3 store drift, and not started.
  It is the only thing that takes the ratchet to zero.
- **`node engine/status.js --write`.** Forbidden to this pass by the dispatching brief; the generated
  blocks are therefore NOT restamped for this change. Owed to whoever holds that.
- **Whether `MC.priors` should be regenerated at all.** Unchanged from the previous report: it moves
  the modal click on 114 of 230 species and NOTHING was measured about what that does to a rollout,
  a leaf value or a win rate. It sits behind the MEDICHAM quarantine.
- **The 113 low-sheet rows' `mv` and `item`.** Stage 2 leaves them empty on a from-scratch build and
  the shadow report read them as stale inheritance from a foreign dataset rather than curation. They were
  NOT given a home here, because giving them one would bless them.
- **`build/build_browser_data.js` and `build/build_scoreboard.js`.** Both reference
  `data/engine-data.js` and both call `writeFileSync`. Still not inspected for whether either writes
  BACK into the artifact. If one does, the three-generator table in the builder's header is incomplete
  and the 2,072 is a lower bound.
- **`data/mc-priors.json` and `data/mc-declared-rows.json` are not stamped with an engine release.**
  They are build inputs, not published figures.
- **A regenerated `data/engine-data.js`.** Deliberately not produced. It would add
  `floette-eternal-mega`, move five rows, and rewrite the header date — a value change in a file
  frozen into every release.
