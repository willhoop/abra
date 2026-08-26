# `data/engine-data.js` can now prove itself — and it currently CANNOT

2026-08-26 · MEASURE · findings record, not a living document

---

## VERDICT

- **Builder: `build/build_engine_data.js`.** Derived, not typed — `engine/generated_audit.js --list`
  reports `UNPROVABLE  data/engine-data.js  build/build_engine_data.js  B  -  -`, door B being
  `engine/provenance.js`'s `graph_files` writer scan.
- **The artifact DOES NOT MATCH its sources.** Exactly **one** row differs:
  `floette-eternal-mega` is carried by `CHOMP/engine/champ-model.js` and is absent from the
  artifact. Everything else — 321 mon rows, 500 moves, the 18-row type chart, 230 priors, and the
  whole wrapper — agrees byte-for-byte.
- **The drift is real but not a playable hole**, and the distinction is measured below rather than
  assumed. `floette-eternal-mega` is an unreachable duplicate alias.
- **Row census of the bytes on disk: 0 UNBUILDABLE, 0 null ability, 4 empty movelists (all 4
  declared), 10 null items (7 declared), 10 null weights (0 declared).** The **13 UNEXPLAINED** rows
  are the actionable output, and **10 of them are a real builder gap**.
- **Nothing was regenerated.** `data/engine-data.js` sha256
  `c73da1d25212f447747ff645ceac613707d812060af1fe97a30b4f79b6773d3a` before and after every run on
  this pass, `git status` clean for that path throughout.

---

## 1. THE DERIVATION

`data/engine-data.js` is written by `build/build_engine_data.js`, from three sources:

| source | what it owns |
|---|---|
| `CHOMP/engine/champ-model.js` (308 rows) | `mons[k].t`, `mons[k].bs`, `MC.C` |
| the Champions dex, via `engine/champions_sim.js` | `mons[k].wt`, `moves[k].bp/.rc/.self` |
| `data/tags.json` | the backfill set — moves the compact table never had |

It is in `engine/engine_release.js`'s `SOURCES`, so it is frozen into **every** engine release, and
before this pass it had **no comparison of any kind**.

## 2. THE CHECK

`node build/build_engine_data.js --check` — writes nothing, exits non-zero on drift. It follows the
`build/build_tags_js.js --check` idiom: the comparison is against **what this builder would write**,
never against a re-implementation of the generator.

Three design points that are load-bearing:

**A dex-less `--check` is REFUSED, not passed.** Without the dex, `wt`, `bp`, `rc` and `self` all
fall back to the value already stored in the artifact, so the candidate would be compared against
itself in every field the dex owns and the run would report agreement it never tested. Exit 2 with
`NO VERDICT`. A build may degrade that way; a measurement may not.

**The header date is excluded from the verdict.** The builder rewrites `Last generated:` on every
run by design; comparing it would leave the gate permanently red for a cause that is not drift,
which is how a gate becomes "one of the known failures". The stamp step is still *exercised*, so a
stamp that cannot land is still a failure — just a different one.

**The EOL trap cannot reach this check, structurally.** `core.autocrlf=true` here, and
`data/engine-data.js` holds **13 CRLF and zero bare LF** — it is fully CRLF on disk. The candidate
bytes are built by editing the disk buffer (`src.replace(...)`), so they inherit the file's own line
endings, and the only substituted text is `JSON.stringify` output, which contains no CR. Both sides
additionally pass through `engine/read_text.js`'s `normalise`, so the immunity is stated rather than
relied on. No third answer to the EOL hazard was invented; `generated_audit.js`'s `CHECKOUT-EOL`
remains the one verdict for it.

## 3. THE RED PROOFS, ON REAL BYTES

Both breaks damaged the live file, ran the check, and restored from a `Buffer` held in the same
process with an unconditional `finally` plus an `on('exit')` net.

**Break 1 — a value the builder OWNS.** `venusaur` base HP `80 -> 81`.

```
  mons: 2 row(s) differ — venusaur, floette-eternal-mega
     venusaur: bs {"hp":81,...} -> {"hp":80,...}
EXIT=1
```

Caught, named to the row and the field. Restored: sha256 matches baseline, `RESTORED
BYTE-FOR-BYTE: true`.

**Break 2 — the blind spot, deliberately.** `venusaur` `ab`/`mv`/`item` wiped to
`null`/`[]`/`null`: the exact 2026-07-30 shape.

```
  mons: 1 row(s) differ — floette-eternal-mega      <- THE BYTE DIFF DID NOT SEE IT
    ab null: 1     [declared: none]  [UNEXPLAINED: 1 -> venusaur]
    mv empty: 5    [declared: 4 not in this format]  [UNEXPLAINED: 1 -> venusaur]
    item null: 11  [declared: 7 battle-only forme]  [UNEXPLAINED: 4 -> venusaur, ...]
    UNEXPLAINED rows in total: 16          (13 before the break)
EXIT=1
```

**This is the measurement that matters.** The byte diff is *blind* to `ab`/`mv`/`item` — the builder
copies them off the artifact, so they compare equal to themselves — and the census is what sees
them. The blind spot is real, it is documented in the check's own header, and the compensating
instrument was shown to move under it.

**Green control.** The builder's own output placed on disk for one second: `--check` **exit 0**,
`data/engine-data.js is exactly what its sources would produce today.` So the red is attributable to
exactly the one row it names, and the check is not blanket-red. Restored byte-for-byte, mtime
preserved.

**Restore fidelity.** sha256 identical after every run. mtime came back
`1787377562079.3215` against `1787377562079.322` — 488 nanoseconds *earlier*, the limit of what
`fs.utimesSync` can round-trip on an NTFS 100-ns tick. Whole-millisecond value identical, and the
drift is in the safe direction: `build/build_pdfs.js` and `engine/provenance.js` both compare
`mtimeMs` with `<`, so a fractionally *older* file can only ever look staler, never fresher.

## 4. THE BUG THE GREEN CONTROL FOUND

The stamp guard read `if (stamped === out)` — using "the string changed" as a proxy for "the pattern
matched". Those come apart in the one case that matters: **any second run of the builder on the same
calendar day**. The header is already correct, the replacement is a no-op, the strings are equal, and
the builder exits 1 announcing that the file *"does not open with a block comment"* — which is false.

Fixed to test the pattern (`if (!HEADER.test(src))`), which is the condition the message actually
describes. It changes no byte the builder writes; the green control produced identical output before
and after.

## 5. THE CENSUS — THE 2026-07-30 SHAPE, COUNTED EVERY RUN

Each flagged row is put to the format and declared with a **derived** reason, never a typed one:
`isNonstandard` or `tier: Illegal` → *not in this format*; `species.battleOnly` → *battle-only
forme*.

```
bs missing (UNBUILDABLE):  0
ab null:                   0
mv empty:                  4   [declared: 4 not in this format]   [UNEXPLAINED: 0]
item null:                10   [declared: 7 battle-only forme]    [UNEXPLAINED: 3]
wt null:                  10   [declared: none]                   [UNEXPLAINED: 10]
```

**Weight is judged on a different rule, deliberately.** `item`/`ab`/`mv` are TEAM-BUILD facts and a
forme nobody builds legitimately lacks them. `wt` is a FIELD fact — Low Kick and Grass Knot scale
with the target's weight, Heavy Slam and Heat Crash with the ratio, and their dex `basePower` is 0,
so a missing weight makes those moves **uncomputable rather than mis-priced**, which is invisible.

**The 10 null weights are a genuine builder gap, and the dex knows every one of them.** The `wt` fill
runs only over `M.MONS` keys; the 15 rows the builder *preserves* (champ-model no longer carries
them) are copied verbatim and never get a weight. All 10 are legal in this format:

| row | dex weight |
|---|---|
| `victreebel-mega` | 125.5 kg |
| `feraligatr-mega` | 108.8 |
| `skarmory-mega` | 40.4 |
| `barbaracle-mega` | 100.0 |
| `falinks-mega` | 99.0 |
| `aegislash-blade` | 53.0 |
| `gourgeist-small` | 9.5 |
| `gourgeist-large` | 14.0 |
| `gourgeist-super` | 39.0 |
| `palafin-hero` | 97.4 |

**Reported, not fixed.** Filling them requires regenerating `data/engine-data.js`, which is Will's
call (see §7).

The 3 unexplained null items are `gourgeist-small/large/super` — selectable formes, not battle-only,
with no item prior. Real, small, and not a null-write bug.

## 6. WHY THE DRIFT IS NOT A PLAYABLE HOLE — MEASURED

`champ-model.js` carries **three** floette keys; the artifact carries two.

```
champ-model:  floette-eternal,  floette-mega,  floette-eternal-mega
artifact:     floette-eternal,  floette-mega
```

`floette-mega` and `floette-eternal-mega` have **identical base stats**. The artifact's
`floette-mega` row is fully populated — `bs`, four moves, `item: "Floettite"`, `ab: "Fairy Aura"`,
`wt: 100.8`, `mv_provenance` over 4,077 observations.

The decisive test is reachability. Across all 308 champ-model rows, exactly **one** fails to
round-trip through the engine's own key function:

```
Floette-Eternal-Mega  key=floette-eternal-mega  mcKey-> MISS
```

`mcKey('Floette-Mega')` and `mcKey('floettemega')` both resolve to `floette-mega`, which exists. So
`floette-eternal-mega` is a duplicate alias **no lookup can ask for**. This matters because the store
holds **103,098** `floettemega` occurrences — had the reachable key been the missing one, this would
have been the 2026-07-30 bug again at scale. It is not.

## 7. WHAT THIS MEANS — AND WHY IT IS NOT BEING FIXED HERE

Regenerating would add a 323rd row (`floette-eternal-mega`, declared benign as a battle-only forme)
and update the header date. **It would also change the bytes that every future engine release
freezes**, and `data/engine-data.js` is in `SOURCES`. That is a decision, not a chore, and it belongs
to Will. The check now states this in its own failure message.

## 8. WHAT WALKS PAST THE CHECK

Stated in the check's own header, so it travels with the code:

1. **The fields the builder COPIES OFF THE ARTIFACT** — `st`, `mv`, `item`, `ab`, `nature`, `sp`,
   `set_source`, `mv_provenance`, `moves[k].t/.c` on existing rows, `MC.priors`, and every
   `preserved` row in full. They compare equal to themselves by construction. **This is where the
   2026-07-30 bug lived**, and it is why the census exists and is printed every run. Demonstrated
   red in Break 2.
2. **A wrong source.** If `champ-model.js` is itself wrong, artifact and source agree and the check
   is green. It proves AGREEMENT, never correctness.
3. **`engine/generated_audit.js` will not spawn this check.** Its play-layer walk sees the require of
   `engine/champions_sim.js`, which is in `engine_release.js`'s `SOURCES`, and it refuses by design
   to run any builder reaching the simulator. So this file stays `UNPROVABLE` in that report and must
   be run by hand. That refusal is the safe direction and was not worked around.

**The two questions asked explicitly:**

- **Would a second artifact written by the same builder be caught?** **No.** The check is written
  against `OUT`, not against a scan of everything the builder writes. This builder writes exactly one
  file today, so the question is currently moot — but a second output would need its own clause, and
  that is the instance-not-class hazard `engine/read_text.js` spends its header on. Named, not
  papered over.
- **Would the same artifact written by a different path be caught?** **Yes — and this is the useful
  half.** The check asks whether the bytes on disk equal what the builder would produce. A hand-edit,
  a merge, a later script, a bad restore or a stale checkout all read as drift regardless of author.
  That is how the missing row was found.

## 9. NOT MINE, LEFT ALONE

`.scratch_eng/` is untracked in the working tree and is not mine. Reported, not touched. Several
files were being modified by other agents throughout this pass (`engine/medicham2-browser.js`,
`tests/test-mechanics.js`, ~12 files under `data/`); none is `data/engine-data.js`, which was
verified untouched by sha256 at the end.

---

## OWED, NOT RUN

- **A full `node engine/generated_audit.js` run to confirm the `UNPROVABLE` reason string.** The
  play-layer refusal above is derived by reading — `engine/champions_sim.js` is in
  `engine_release.js`'s `SOURCES`, and `generated_audit.js` refuses any builder whose require graph
  reaches it. It was **not** confirmed by running the full audit, because a full run spawns other
  builders' `--check` modes and several agents were writing to the tree. Confirm when it is quiet.
- **The decision on regenerating `data/engine-data.js`.** Will's, not MEASURE's. It closes the
  `floette-eternal-mega` drift and would fill the 10 null weights only if the `wt` gap in §5 is
  fixed first.
- **The `wt` gap for the 15 preserved rows.** The fix is a one-line extension of the weight lookup to
  the preserve loop. Deliberately NOT made in this pass: it would change what `--check` compares and
  turn today's verdict into a drift I introduced, destroying the attribution of the finding above.
- **`node engine/status.js --write`** to restamp the ledgers — forbidden to this agent by the brief.
- **A `docs/MEASURE.md` ledger section.** Outside this brief's ownership list.
- **Whether the other 12 shortlisted generated files have the same self-referential shape.** This
  builder reads its own output as a source; that pattern would silently hollow out any `--check`
  written for such a file, and nothing currently detects it.
