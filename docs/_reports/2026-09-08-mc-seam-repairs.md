# M-C SEAM REPAIRS — the five things that would have failed silently on the flip

MEASURE, 2026-09-08. Diagnosis: `docs/_reports/2026-09-08-regulation-mc-readiness.md`.
Every repair below is **red first** — the silent failure staged and shown happening, then shown refused.
Nothing on disk was altered by any red arm; the fixtures are constructed in memory or in the OS temp
directory.

Constraints honoured: an ENGINE agent was live on `engine/medicham2-browser.js`, `engine/quarantine.js`
and its probes — none of those were touched, no release was cut, `status.js --write` was not run,
`data/policy-weights.json` was not touched, nothing was committed.

---

## 2. A NEW REGULATION'S MEGAS GET NO ENGINE ROW — LANDED

**The staged failure.** All 76 legal mega formes have a row today and all 76 are in
`data/mega-dex-official.json`, so the M-C state cannot be found in the tree — it is CONSTRUCTED.
`tests/probe_new_mega_row.js` removes one legal forme (derived: the lowest-usage one,
**Meowstic-F-Mega**) from the artifact table via `mcKey.rawTable` **and** from the mega source via one
`fs.readFileSync` intercept, in a child process, and runs the REAL `engine/artifact_audit.js`.
That is exactly the M-C shape: legal in the format, no source row, no artifact row.

```
RED   (before)  MISSING ROW : exit 0, 0 GAP line(s), 0 of them naming Meowstic-F-Mega
GREEN (after)   MISSING ROW : exit 1, 1 GAP line(s), 1 naming it
                GAP  1 of 76 legal mega forme(s) have NO ROW in data/engine-data.js: Meowstic-F-Mega
CONTROL         REAL ARTIFACT: exit 0 in both runs — the undoctored audit is clean
```

**The repair.** `engine/artifact_audit.js` section **H**: the format's own items are walked for
`megaStone` through `champions_sim.dexFor`, and every forme they name is looked up in
`data/engine-data.js`. It gates on `bs`, which is the field `buildMon` gates on
(`if (!m || !m.bs) return null`), so a row without base stats is reported as the same silence as no row.
A stone that ships tomorrow is in the check the day it ships; there is no list.

**Why checks A–G could not see it, restated so it is not re-fixed at the wrong door.** B restates the
builder's own guard on purpose so the builder is judged on the rows it WRITES; A, E and F only walk
rows that exist. A forme in neither file is invisible to all of them. The 2026-07-30 key mismatch is
genuinely fixed and was not touched.

**One thing found and NOT fixed — filed, not repaired (it is a play-path file).**
`engine/names.js` `megaTable()` is keyed by BASE species, so a base carrying two stones keeps only the
last one written: **74 entries against this format's 76 legal mega formes**, losing one of
`Charizard-Mega-X`/`-Y` (Charizardite X/Y) and one of `Raichu-Mega-X`/`-Y` (Raichunite X/Y). The first
draft of check H used that table and was silently blind to exactly two formes; it now walks the items.
`names.mega('charizard')` therefore answers with whichever stone the dex enumerated last. Measured, not
inferred: `formes 76 bases 74`, both collisions printed.

---

## 1. `data/meta-usage.json` POOLED TWO REGULATIONS UNDER ONE LABEL — LANDED

**The staged failure — with REAL rows of another regulation, not synthetic ones.**
`data/games.gen9championsvgc2026regmabo3.jsonl` holds **51 rows stamped `champions-regma`**, collected
by `engine/next_regulation_ingest.js` doing exactly its job. `tests/probe_usage_regulation_pool.js`
appends them to 2,000 real active-regulation rows in a temporary store under the OS temp directory and
runs the real `engine/analyze.js` with its own cwd, so `data/meta-usage.json` is never touched.

```
RED   (before)  POOLED      : label "gen9championsvgc2026regmb", 2406 teams
                ACTIVE ONLY : label "gen9championsvgc2026regmb", 2324 teams
                => 82 team-sides (41 clean M-A games) inside a model labelled regmb; the top three
                   species moved 34.2 -> 33.6, 26.6 -> 26.3, 26.6 -> 26.1
GREEN (after)   both arms 2324 teams; provenance carries formatToken="champions-regmb" and
                otherRegulations={"champions-regma":51}
ROTATED ARM     a store with NO active-regulation row: exit 1, no model written, REFUSING TO WRITE A MODEL
```

**The repair.** `engine/analyze.js` filters both views on the store token, and refuses rather than
writing an empty model. The token is derived through the parser that wrote it —
`durable-ingest.formatToken()`, factored out of `extract()` unchanged and exported, plus
`activeStoreFormat()`, which derives the token TWICE (from the regulation's label through the same
`formatToken`, and from the trailing reg token of its Showdown id) and **throws if the two disagree**.
A mistyped label is a throw, not an empty corpus.

**The refactor is function-preserving, measured rather than asserted:** 300 raw logs re-parsed through
the new `extract()` and compared against the stored rows — **300 agree, 0 disagree**.

**NO PUBLISHED FIGURE MOVES TODAY.** The ladder store is **76,833 of 76,833 `champions-regmb`**; the
bo3 store is 25,522 of 25,522. The filter excludes nothing on this tree.

**OWED (not done, deliberately):** `data/meta-usage.json` on disk was **not regenerated** — an ENGINE
agent was live and this artifact feeds `data/abra-meta.js`. The numbers would be identical; only the
two new provenance fields are missing. One command: `node engine/analyze.js data/games.ladder.jsonl`.

---

## 3. A ROTATED LADDER LOOKED EXACTLY LIKE A QUIET ONE — LANDED

**The staged failure.** `tests/probe_rotated_ladder.js` replaces `https.get` in a preload module
written to its own temp directory, so the real ingest runs unmodified against a fake replay API with
no network call and its own store. Three arms, because two would not have been enough:

```
                                                       BEFORE            AFTER
  ROTATED  pool full, all ids stored, newest 30 h old   exit 0, silent    exit 1, STALE-LADDER
  QUIET    pool full, all ids stored, newest 6 min old  exit 0            exit 0   (control holds)
  DEAD     endpoint offers nothing                      exit 1 ZERO-GAIN  exit 1 ZERO-GAIN (unchanged)
```

**The repair.** `engine/durable-ingest.js` captures the offered replays' upload times BEFORE the dedupe
discards them — after a rotation the deduped list is empty, so the discarded rows are the only evidence
left. A zero-gain run now says WHICH zero-gain it is.

**The bar scales itself and is measured, not assumed.** Against the live endpoint on 2026-09-08 the M-B
pool held **1,275 ids, newest 0.02 h old, spanning 22.50 h**. The bar is the pool's own span — no game
played in longer than the pool takes to turn over — with a **24 h floor** so a busy format's overnight
lull cannot fire it. The floor's basis: this store averages **40.7 games/hour over its last 14 days**,
so a 24-hour window with zero replays is about a thousand missing games. `STALE_LADDER_HOURS` overrides.

**`.github/workflows/ingest.yml` was corrected in the same pass**, because its shrink-guard step turns
a non-zero pull into an error naming a BROKEN ENDPOINT and pointing at that step's ZERO-GAIN line — a
message that would have been WRONG for a rotation, pointing at a line that does not exist. It now names
both discriminators and the checklist command.

**Noted while measuring, NOT a defect I introduced:** the local `data/games.ladder.jsonl` was last
written **2026-09-04 01:30**, four days ago, and its newest replay is 2026-09-04 05:30 — while the live
endpoint's newest M-B replay is **one minute old**. The ladder is alive; this checkout's collector has
not run locally since the 4th. That is OPS's to read, and it is exactly the state the new guard makes
visible on the day it is NOT benign.

---

## 4. FOUR HARDCODED FORMAT IDS THAT WRITE FROZEN ENGINE SOURCES — LANDED

**The staged failure and its size.** `tests/probe_format_id_derivation.js` scans for a format id typed
into the CALL that decides which game a run is about — `Dex.forFormat(...)` or the replay
`search.json?format=` endpoint. The predicate is the call, never the filename, so the ids that
legitimately pin history are untouched by construction. The red arm is the committed bytes
(`git show HEAD:<file>`).

```
  GATE (engine/, build/)   at HEAD: 5 live call sites   working tree: 0
      engine/derive_switch_carry.js:33   engine/fixture_preflight.js:37   engine/mega_harvest.js:39
      build/build_browser_data.js:67 and :164
  REPORTED, NOT FAILED     34 live call sites under tests/ across 32 files - a test pinned to the
                           regulation it was measured under is citing a run, not claiming a fact
```

The first draft of that scan reported **104** lines, most of them prose ABOUT a format id — including
this repository's own explanations of why one must not be typed. Comments are excluded now; LESSONS §4
predicted the over-match exactly.

**The consequence, measured on the two Champions VGC regulations this checkout carries:**

| | legal moves | mega formes |
|---|---|---|
| `gen9championsvgc2026regma` | 500 | **60** |
| `gen9championsvgc2026regmb` | 500 | **76** |

A generator pinned to the older one writes **60 mega formes where the regulation has 76 — 16 missing**
— into `data/mega-formes.js`, which is frozen into every engine release, **and its `--check` compares
that answer against itself, so it passes.** That is the same shape as seam 2, one file over.

**The repair.** All four now resolve the format through `champions_sim` — `CS.FORMAT` for the id,
`CS.dexFor()` for the dex, which additionally REFUSES an id the checkout does not carry rather than
handing back mainline Gen 9. `build_browser_data.js` also stamps the derived id into the generated
header, so the file says which regulation it was built from.

**`--check` verified still green after the change** (payload comparison: 75 legal mega stones, 500
legal moves), and `fixture_preflight.js` and `derive_switch_carry.js` both re-run clean. **No generated
file was regenerated** — the bytes on disk are untouched, so no release digest moved.

---

## 5. THE FLIP HAD NO PROCEDURE — LANDED, AS PRINTED STATE

`node engine/next_regulation.js --checklist`. The blast radius is DERIVED on every run — a file counts
as a reader when the config name appears on a line with a read or a require, not when it merely
mentions it in prose — and the ORDER is prose, because it follows the invalidation graph and no scan
derives that.

Measured on this tree: **17 files read `data/regulations.json` directly, 12 of which write a `data/`
artifact; 253 more take the format from `champions_sim`, 63 of them writers.** Those 253 need no edit —
they follow the config by construction, which is precisely why one edit has this blast radius, so they
are counted and not listed.

The six steps: archive the outgoing regulation first (the one unrecoverable step); ask whether the new
format is SIMULATABLE and not merely collectable; edit the config; rebuild what the format decides, in
the same pass, checked by `artifact_audit` H; re-point the store and the model, where `analyze.js` now
refuses an empty corpus; only then cut a release and re-measure. Every command named in it was verified
to exist.

---

## WHAT STILL FAILS SILENTLY IF M-C ARRIVES TOMORROW

1. **The oracle pin becomes UNKNOWN rather than false** (readiness item 5). `actualCommit()` shells
   `git rev-parse HEAD`; under an npm install there is no `.git`, so `commit_matches` is `null` — the
   check stops asking rather than failing. `sim/package.json` reads `"^0.11.9"`, and a caret range is
   not a pin. Untouched here.
2. **The census does not move, and reads as "nothing broke"** (readiness item 6).
   `data/mechanics-census.json` is a LAB of hand-staged probes and `engine/steering.js` steers
   `game_differential.js` off it, so after M-C the differential keeps aiming at M-B mechanics.
   Untouched here.
3. **`data/meta-usage.json` on disk still lacks the new provenance fields** until it is regenerated.
4. **`engine/names.js` `megaTable()` loses one forme of each two-stone base** — 74 against 76.
   Filed, not fixed.
5. **34 format ids under `tests/`** are pins on what was measured. They become a decision on the day of
   the flip — each has to be read and either re-pinned or re-measured — and nothing schedules that.

## TESTS RUN

| | |
|---|---|
| `tests/test-parse.js` | **42 passed, 0 failed** — the extractor refactor is pinned |
| `tests/test-next-regulation.js` | **GREEN** |
| `engine/artifact_audit.js` | **no gaps found**, exit 0; section H reads 76 of 76 |
| `build/build_browser_data.js --check` | **exit 0** after the derivation change |
| `tests/test-quality.js` | **31 passed, 1 FAILED — PRE-EXISTING, NOT MINE.** `clean share is stable: 31.3% now vs 28.0% recorded (drift 3.3 pts, tolerance 3)`, because the store grew 67,384 to 76,833 since that baseline was recorded. `engine/quality.js` was not touched by this work. It is red, and it is reported rather than filed. |

**Board-material is untouched by construction:** `engine/game_differential.js` requires none of the
files changed here, and no data artifact was rewritten.

## FILES CHANGED

`engine/analyze.js`, `engine/durable-ingest.js`, `engine/artifact_audit.js`,
`engine/next_regulation.js`, `engine/derive_switch_carry.js`, `engine/fixture_preflight.js`,
`engine/mega_harvest.js`, `build/build_browser_data.js`, `.github/workflows/ingest.yml`.

New probes: `tests/probe_usage_regulation_pool.js`, `tests/probe_new_mega_row.js`,
`tests/probe_rotated_ladder.js`, `tests/probe_format_id_derivation.js`.

Nothing committed — Will publishes.
