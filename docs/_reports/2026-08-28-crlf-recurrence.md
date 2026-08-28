# The CRLF stranding, fixed at the source — 2026-08-28

**Verdict.** The gate reads **7 of 8 clauses PASS** (1 failing), up from 3 of 8 (5 failing). The
protection is **demonstrated, not merely added**: shown RED before the `.gitattributes` entry, GREEN
after, with a same-run control on an unpinned frozen source that is still RED, and a permanent
assertion in `tests/test-engine-release.js` shown RED on removing one line. Every re-run reproduced its
previous figure exactly.

Release `5f3f7141227c`. HEAD before this pass: `7b5e6b40`.

---

## 1. What was actually wrong

`core.autocrlf = true` on this machine. Git rewrites any file it treats as text to CRLF at checkout,
so a frozen SOURCE whose generator emits LF has two byte-forms and the release id follows whichever
wrote it last.

Measured, byte-accurate. An early Git Bash `grep -c` for a carriage return gave garbage — it reported
42,614 CR in a file with zero — so every count below is from `fs.readFileSync` in node instead. The
probe was wrong before the engine was, on schedule.

| | digest | bytes | CR |
|---|---|---|---|
| `git cat-file blob HEAD:data/tags.json` | `576a4bbe91af` | 799,584 | 0 |
| `data/releases/5f3f7141227c/data/tags.json` | `576a4bbe91af` | 799,584 | 0 |
| working copy at 10:06Z | `a32ee545cf67` | 842,196 | 42,612 |

`Buffer.compare(blob, releaseSnapshot) === 0`. The committed blob **is** the release snapshot. The
working copy was that same blob after checkout translation.

Diff between the two releases involved: **one file of twenty-six**, `data/tags.json`, CRLF-normalised
equal, A_CR 0 vs B_CR 42,612. Nothing else moved.

## 2. Why restoring the file was admissible, when the ledger had refused it

`docs/ENGINE.md` refused a restoration on the grounds that it *"edits an input so a ruler prints the
wanted number, and yields a release id no checkout reproduces."* Both halves are answered by fixing the
translation rather than arguing with the objection:

- It is **not a hand edit**. The bytes came from `git checkout HEAD -- data/tags.json`, i.e. from the
  committed generator output, proven byte-identical to the release snapshot above.
- The id **is** now reproducible from a checkout, because `text eol=lf` removes the translation. That
  was the entire content of the objection.

It was deliberately *not* regenerated with `engine/tag_dex.js`: that file writes
`generated: new Date().toISOString()`, so a regeneration always yields a **new** release id even when
every tag is identical. A regeneration is not an identity check.

## 3. The protection, shown RED first

Probe (written this session): write the committed blob to disk, then `git checkout HEAD -- <file>`,
nothing edited. Exit 1 if the bytes moved.

```
BEFORE the .gitattributes entry
  data/tags.json   576a4bbe91af -> a32ee545cf67   attr: eol unspecified   exit 1   RED

AFTER
  data/tags.json   576a4bbe91af -> 576a4bbe91af   attr: eol lf            exit 0   GREEN
  ...and 16 more frozen sources, all GREEN, ANY RED: 0

CONTROL, run after the block existed, on a source deliberately left unpinned
  engine/tags.js   63effec9d5cd -> 145a3cc9ce2f   attr: eol unspecified   exit 1   RED
```

The control matters: without it, "everything is green" is also what a query returning `lf` for every
path would produce.

### Which seventeen, derived not typed

Every frozen SOURCE whose working-tree bytes contain no CR. All 26 blobs in HEAD are LF, so LF is the
canonical form repo-wide; adding the attribute therefore moved **no byte** and produced **no index
churn**.

Pinned (17): `engine/board.js`, `engine/champions_sim.js`, `engine/lookup.js`, `engine/quality.js`,
`engine/showdown_path.js`, `engine/pp.js`, `data/tags.json`, `data/abra-tags.js`,
`data/residual-order.json`, `data/switchin-order.json`, `data/move-effects.js`,
`data/ability-blocks.json`, `data/smogon-priors.json`, `data/move-priors.json`,
`data/regulations.json`, `data/policy-weights.json`, `data/policy-weights-joint.json`.

Not pinned (9), CRLF in the working tree today: `engine/medicham2-browser.js`,
`engine/rollout_leaf.js`, `engine/position_features.js`, `engine/tags.js`, `engine/mc_key.js`,
`engine/set_priors.js`, `engine/smogon_priors.js`, `data/quality-filter.json`,
`data/engine-data.js`.

Those nine are stable under checkout *today* — a checkout reproduces their CRLF idempotently. Pinning
them would rewrite them, move every release id, and break `tests/roster.js`, whose red demonstrations
match a CRLF pair against the simulator's source; that is recorded breaking exactly that way on
2026-08-25. `data/engine-data.js` is additionally a file ENGINE may not edit. **The release digest is
therefore still machine-dependent for those nine**: a clone with `core.autocrlf=false` hashes a
different tree.

### `merge=union` was not added, restored or resembled

The new block adds only `text eol=lf`. `eol` is unrelated to conflict resolution. The standing
prohibition at the top of `.gitattributes` (CHANGELOG 3.1.2) is untouched and is restated inside the
new block so a future reader cannot mistake the two.

### The permanent check

`tests/test-engine-release.js` section 10. Invariant: **a frozen source whose working-tree bytes are
LF must not be translatable.** Derived per file, not a typed exception list, so the 27th SOURCE added
LF without an attribute fails by name (SOURCES has grown four times). It also asserts that
`git check-attr` actually answered — no silent skip — and carries its own knob-cleared control.

Shown RED on removing the single `data/tags.json` line:

```
FAIL every frozen source whose working-tree bytes are LF is pinned to LF by .gitattributes:
     UNPINNED data/tags.json — a checkout will rewrite these and move the release id with no code change
ENGINE RELEASE TESTS: 70 passed, 1 failed        exit 1
```

Restored: **71 passed, 0 failed**, exit 0.

## 4. The re-run — an identity result

Release `5f3f7141227c`, arm `middle`, cap 12, `--games 1200` (yields 961),
`--team-store data/team-pool-frozen`, census pin `9446a684709d` (file digest verified as
`9446a684709d`), `--state --end-state`; all three roster stages `--reds --write`;
`all_mechanics_fire.js --kind all --write`.

| instrument | before | after |
|---|---|---|
| roster / items | 139 match, 0 differ, 0 did-not-fire, reds 18 | **identical** |
| roster / abilities | 129 match, 0 differ, 0 did-not-fire, reds 29 | **identical** |
| roster / moves | 475 match, 0 differ, 0 did-not-fire, reds 35 | **identical** |
| whole-game differential | 961 games, 6 raw / 1 net, board-material 0 | **identical** |
| staged mechanics | 5 diverge, 1 declared, 4 below reach, 0 counted | **identical** |
| damage (not re-run; unaffected) | 0/6000 at all sixteen band indices | — |
| census (not re-run; unaffected) | 780 probed / 780 live / 0 missing | — |

Structural diffs, whole artifact, every key:

- `data/game-differential.json`: **one** field — `engine_release_cuts` 5 to 6 (this pass's appended cut
  event over the same bytes).
- `data/all-mechanics-fire.json`: three wall-clock `seconds` fields and one embedded
  `roster_generated` timestamp.

Nothing else in either file. **No published figure moved**, so the 5.205.0 documents needed no figure
correction — only the supersession of their *"five clauses are withheld"* claim, which is done in the
same pass at 5.206.0.

### Which scoreboard, said before the run

Neither. No game rule changed, so both the pinned pool and the lab were predicted to sit exactly
still, and that prediction *is* the test — a moved figure would have meant the restoration was not a
restoration. Pool unmoved at 0 of 961 board-material and 6 raw. Lab unmoved at 780/780/0 and
139/129/475.

## 5. The two adjacent stamps

- **`data/provenance-stamp.json`, 3 verified to 1 with `mtime_only` unchanged at 175: SAME EVENT.**
  `verified` counts artifacts whose stamped `source_digests` match the **live** tree; two of them
  stamped the LF digest of `data/tags.json`. Recovered to **3** after the re-cut, `mtime_only` still
  175.
- **`data/quarantine-stamp.json` losing `no open, known engine defect`: NOT this event, and not a
  loss.** The clause left the **failing** list between 2026-08-27T14:14Z and 2026-08-28T03:01Z — a
  clause that started passing. Separately, that stamp is written only under `--check`, which is why it
  read five failing clauses while the gate itself read one. `node engine/quarantine.js --check` now
  records `failing_clauses: ["whole-game differential / the same game on both engines"]`.

## 6. Should the release comparator normalise newlines?

**No, and there is evidence rather than a preference.** `tests/roster.js` matches a CRLF pair against
`engine/medicham2-browser.js`; a line-ending flatten on 2026-08-25 took its red demonstrations from
35/35 to a failure. So a newline difference in a frozen source is **already observable to an
instrument in this repository**. A normalising comparator would declare two trees equal while one of
them fails a gate the other passes, and `REL.require` would serve bytes the digest no longer
describes — the digest becomes a claim it cannot back. Normalising is a way of not noticing. The fix
belongs where the bytes move, which is what was done.

## OWED, NOT RUN

- **The nine unpinned frozen sources.** Pinning them is a byte-moving refit: it invalidates every
  release id and requires `tests/roster.js` to stop hard-coding a CRLF pair against the simulator's
  source first. `data/engine-data.js` is among them and is not ENGINE's file — that half is a refit
  and belongs to MEASURE. Until then the release digest is machine-dependent for those nine.
- **`tests/test-engine-release.js` OOMs at the default heap** — pre-existing, confirmed at HEAD before
  this pass touched the file. `REL.compat()` in section 8 walks all **486** releases. It is registered
  in neither `tests/run-all.js` nor the pre-commit hook, so nothing was silently red. Run here with
  `--max-old-space-size=5120`. `tests/roster.js --stage moves --reds` OOMed the same way and needed
  6 GB. Neither was investigated further.
- **`data/tags.json` embeds a generation timestamp**, so it can never be regenerated without moving
  the release id. Worth removing if release ids are ever to be reproducible from the generators rather
  than from the committed blobs. Not touched here.
- **The damage differential was not re-run.** It was never stranded — its clause passed throughout —
  and its scope is unchanged: damage only, `skipped_multihit` 134 plus `skipped_ability_multihit` 17,
  and it has never applied a multi-hit move.
- **No mechanic was opened.** Development is paused by the owner. Heal Bell, Reflect Type, Forewarn's
  die, Gastro Acid, Instruct, the 5324/4096 multiplier, Healer / Shed Skin, Corrosive Gas, the
  single-quote tag derivation, the 43 uncompared leaves and the unreproducible faint row all stay
  filed.
- **The PDFs were not rebuilt.** The five living documents moved at 5.206.0; their `.pdf` siblings are
  older by that pass.
