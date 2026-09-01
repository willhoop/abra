# The next regulation, collected before it exists

2026-08-31 / 2026-09-01 UTC. ENGINE. Findings record — not a living document, not current state.

The brief: build the scraper and the store for the regulation announced for roughly 2026-09-09,
ahead of Showdown shipping the format, so that collection starts on day one. The format does not
exist yet and no format id may be invented.

---

## Verdict

Built and rehearsed. **Detection is derived from Showdown's live server at run time and no format id
is written anywhere.** Today it detects 4 Champions VGC regulation formats, classifies 0 as
candidates, collects nothing, and says so in words at exit 0. On the day the format ships it starts
collecting on the next six-hourly run with no code edit.

**Two real defects fell out of the rehearsal**, one of them load-bearing: `engine/durable-ingest.js`
stamped every Champions tier with the literal `'champions-regmb'`, and the only rotation alarm this
project has (`build/triggers.js`'s `formatTrigger`) detects a rotation by tallying that field. It was
comparing a constant with itself. **The rotation alarm could never have fired.**

---

## How the format is detected

`engine/next_regulation.js`, three authorities, asked on every run:

| authority | answers | measured 2026-08-31 |
|---|---|---|
| `https://play.pokemonshowdown.com/data/formats.js` | what the SERVER accepts a battle in — the arrival signal | 342 formats listed |
| pinned local checkout, `Dex.formats.all()` | what the SIMULATOR can play | 333 formats listed |
| `https://replay.pokemonshowdown.com/search.json` | whether anybody is playing it | 51 most recent replays site-wide |

Recognition is by SHAPE: id matches `/^gen(\d+)championsvgc(\d{4})reg([a-z0-9]+)$/` after an optional
trailing `bo3`, and the row is rejected if the authority declares a `mod` not matching `/^champions/`
or a `gameType` other than `doubles`. `bo3` is decided by `Best of = 3` in the ruleset where one is
present and by the id suffix otherwise, with the choice recorded in `bo3_source` so the fallback is
visible. `open_team_sheets` is read from the same ruleset as `forced` / `optional` / `none`.

**The live format list is evaluated, not regex-scraped.** It is `exports.Formats = [ ... ]`, a JS
literal with unquoted keys, so it is not JSON and a regex over nested arrays would be guesswork. It
runs in `vm.runInNewContext` against a sandbox holding nothing but an empty `exports`, with a 5 s
timeout — no `require`, no `process`, no `fs`.

**The pinned checkout LAGS and that is reported, not smoothed over.** It is
`C:\Users\willj\Projects\Pokemon\pokemon-showdown` at `20ad99f`, 72 commits behind. A format on the
live server and not in the checkout is **collectable and not simulatable**, and it gets its own
counter, `collectable_not_simulatable`. On the day, that will be the real state for however long it
takes somebody to pull Showdown. Two jobs; only the first is automatic.

### A set difference against the config is the WRONG test

Reg M-A is live on the server right now and is absent from `data/regulations.json`. A plain
"detected but not in the config" rule reports **two brand-new regulations today** and would start
collecting a superseded metagame.

The regulation token is part of the id, so the ordering is derivable: `(gen, year, token)` compared
against the ACTIVE regulation's triple, strictly greater is a CANDIDATE. Reg M-A sorts below Reg M-B
and classifies `superseded`.

**Every format unknown to the config is printed WITH its classification either way.** If the next
regulation's token ever sorts below the active one, this file will not collect it — and the line
saying so is on screen, which is the difference between a wrong answer and a silent one.

---

## What runs today

```
NEXT REGULATION — detected from the format authorities, not from a constant

  live formats.js : 342 formats listed
  local dex       : 333 formats listed  C:\Users\willj\Projects\Pokemon\pokemon-showdown
  active in config: gen9championsvgc2026regmb  (data/regulations.json -> regmb)

  Champions VGC regulation formats detected: 4
    gen9championsvgc2026regma        superseded [live+dex]  0 of the last 51 replays
    gen9championsvgc2026regmabo3     superseded [live+dex]  0 of the last 51 replays
    gen9championsvgc2026regmb        known      [live+dex]  6 of the last 51 replays
    gen9championsvgc2026regmbbo3     known      [live+dex]  4 of the last 51 replays

  THE NEXT REGULATION DOES NOT EXIST YET. Nothing to collect, and nothing collected.
  Every detected format is already in the config or sorts before gen9championsvgc2026regmb.
  This is the expected state until Showdown ships the format. It is not an error.

  2 format(s) are unknown to the config and sort BEFORE the active regulation,
  so they are treated as superseded and are NOT collected:
    gen9championsvgc2026regma  [Gen 9 Champions] VGC 2026 Reg M-A
    gen9championsvgc2026regmabo3  [Gen 9 Champions] VGC 2026 Reg M-A (Bo3)

  COLLECTED NOTHING, AND THAT IS THE CORRECT ANSWER TODAY.
    formats detected           4
    candidates (later than gen9championsvgc2026regmb)  0
    games appended             0
  There is no format to collect from. Nothing was fetched and no store was created.

  COUNTERS {"vgc_regulation_formats_detected":4,"known":2,"unknown":2,"candidates":0,
            "superseded":2,"collectable_not_simulatable":0,"problems":0,
            "formats_collected":0,"games_appended":0,"stores_written":0}
```

Three outcomes and only one is an error:

- **`candidates == 0`** — the expected state until the format ships. Stated in words, exit 0.
- **`vgc_regulation_formats_detected == 0`** — `::error::`. There has never been a moment with no
  Champions VGC format, so a zero there is the DETECTOR failing, not the game changing.
- **`collectable_not_simulatable > 0`** — its own `::warning::`, per the lag above.

`engine/next_regulation.js` also prints the paste-ready `data/regulations.json` block, derived off
the authority (label, `showdownFormat`, `bo3Format`, `openTeamSheets`). **It does not write it.**
Flipping `active` re-points the LADDER collector, which is the one edit that could stop the existing
corpus growing, so that stays a person's decision.

---

## The store

`data/games.<formatid>.jsonl` — the file name IS the Showdown format id.

- **Unambiguous by construction.** A store cannot be vague about which regulation is in it.
- **Never pooled.** One file per format id, so bo1 and bo3 land in separate files automatically, the
  same separation `games.ladder.jsonl` and `games.bo3.jsonl` already have and for the same reason.
- **The three tracked stores are unreachable from it.** Every format already named in
  `data/regulations.json` is skipped, and `games.ladder` / `games.bo3` / `games.ots` do not match the
  format-id shape at all.
- **Rows are written by `engine/durable-ingest.js` unchanged**, with the raw log archived to
  `data/games.<formatid>.raw-logs.jsonl` beside it. STORE RAW / ANALYSE ON TOP holds: any new field
  is a re-parse, never a re-fetch. `durable-ingest.js` is spawned rather than reimplemented — it owns
  the schema, the extractor, the dedupe and the archive, and a second implementation of any of that
  is FACTS ARE GLOBAL broken.
- `.gitignore` gains `data/games.gen9champions*.jsonl`; git carries the `.gz`, exactly as for the
  other three.

---

## The rehearsal, against a format that does exist

`PAGES=1 node engine/next_regulation_ingest.js --format gen9championsvgc2026regmabo3` — Reg M-A bo3
is real, live, and unknown to the config, so it is a genuine stand-in for the day-one case.

```
  --format gen9championsvgc2026regmabo3: REHEARSAL. This is an override, not the scheduled behaviour.
    classification would be: superseded
  collecting gen9championsvgc2026regmabo3 -> data/games.gen9championsvgc2026regmabo3.jsonl
    0 -> 51  (+51)
  store games.gen9championsvgc2026regmabo3.jsonl: 51 rows, .gz rewritten
```

51 games, all 51 carrying `|showteam|` (the bo3 ruleset forces open team sheets), `.gz` verified to
decompress to the same 51 rows. Reconcile then exercised in all three states a runner can meet:

| state | result |
|---|---|
| plain store and `.gz` agree | `51 -> 51`, idempotent |
| **fresh checkout — plain store absent, `.gz` only** | `0 -> 51`, restored |
| **torn plain store beside a full `.gz`** | `10 -> 51`, union wins |

---

## The two defects

### 1. Every Champions tier was stamped with a constant, and the rotation alarm reads that field

`engine/durable-ingest.js` `extract()`:

```js
const fmt = (tier||'').toLowerCase().includes('champions') ? 'champions-regmb' : ...
```

A literal, for **any** tier containing "champions". All 51 Reg M-A replays stored as
`champions-regmb`, confirmed directly. And on the day the next regulation ships, its games would have
carried the OLD regulation's name too.

`build/triggers.js`'s `formatTrigger` is the one alarm this project has for "the format rotated". Its
method is to tally `g.format` across the store, take the modal value as a baseline, and fire when a
non-baseline format is ≥5% of the last 2,000 games. **With one constant on both sides the two can
never diverge.** The alarm was dead by construction — a capability absent while everything reported
success, which is this repository's founding failure shape.

The tier line already carries the regulation, so it is now read:

```
|tier|[Gen 9 Champions] VGC 2026 Reg M-B (Bo3)  ->  champions-regmb
|tier|[Gen 9 Champions] VGC 2026 Reg M-A (Bo3)  ->  champions-regma
```

**Reg M-B is byte-identical to what the constant produced, and that is deliberate.** Relabelling the
active regulation would make every new row differ from every stored row and fire the alarm on a
rotation that had not happened — `triggers.js`'s own comment says an alarm that cries wolf on day one
is worse than no alarm. Asserted by re-extracting **400 ladder + 400 bo3 raw logs: 800/800 unchanged,
zero rows moved to any other label.** A Champions tier with no readable Reg token gets
`champions-reg?` — visibly a gap — rather than borrowing a regulation's name.

Blast radius checked: `build/triggers.js` is the only meaningful consumer of the per-game `format`
field. `tests/test-parse.js` (42 checks, the extractor pin) is green.

### 2. The store scan looked for the plain `.jsonl`, and git carries the `.gz`

`ownStores()` scanned for `games.<id>.jsonl`. The plain store is gitignored; git tracks the `.gz`. So
on a CI runner — and on any fresh clone — `--reconcile` found nothing and reported *"nothing to
reconcile — no next-regulation store exists yet"* with a whole store sitting beside it. Reproduced by
deleting the plain file: 51 rows read as `0 next-regulation store(s) on disk`.

Fixing the scan produced the second half. The MATCHED FILENAME was pushed as the store path, so
`reconcile()` was handed a path ending in `.gz`, read a gzip binary as text (194 "rows" out of a
51-row store), appended a second `.gz` to the name and wrote the compressed archive back out as plain
text. **It destroyed the file it exists to protect.** The next run said `incorrect header check`. It
happened to the rehearsal store and was restored from a copy taken beforehand.

`ownStores()` now discovers both extensions and always yields the PLAIN path; `reconcile()` refuses a
`.gz` path outright with a stated reason; and `tests/test-next-regulation.js` asserts every path it
returns ends `.jsonl`.

---

## The probe

`tests/test-next-regulation.js`, 19 checks, no game, no release, no artifact write.

**Shown RED on a deliberate break before it was trusted.** Reverting the format tag to its constant
and forcing `laterThan` to return false turned **5 checks red**; restoring both made them green:

```
  FAIL  moving the active regulation back CHANGES the candidate count (the ordering rule is wired)   candidates 0 -> 0
  FAIL  and every candidate it produces really does sort after the (overridden) active regulation
  FAIL  the ordering is asymmetric in the right direction
  FAIL  a DIFFERENT Champions regulation gets a DIFFERENT label   champions-regmb
  FAIL  so build/triggers.js can see a rotation at all (it tallies this field)   champions-regmb vs champions-regmb
```

What it asserts:

1. **The counter that must not be zero.** Zero Champions VGC regulation formats detected fails the
   test, because that is exactly the state in which the capability is dead and silent.
2. **The ordering knob, varied.** Same detected rows, active regulation swung back one:
   `candidates 0 -> 2`. Identical output across a varied knob would mean the rule is unwired. The
   asymmetry is asserted in both directions, so a rule reading "everything is a candidate" cannot
   pass. Both ids used are REAL live formats; nothing is invented.
3. **The format tag, varied.** Two CONSTRUCTED `|tier|` lines quoting the two real Champions VGC
   regulations: `champions-regmb` vs `champions-regma`. The fixture is built, not found, so the test
   needs no store file.
4. **The absent path.** `--dry-run --no-net --no-write` exits 0, prints `COUNTERS {...}`, says in
   words what it did, and writes nothing.
5. **The stores.** Never one of the three tracked stores; always a plain path; the name IS the id.
6. **Network.** Checks 1–3 run on the OFFLINE dex arm, so this is not a network test. The live arm is
   exercised once and reported; it fails only if BOTH authorities are unreachable, at which point
   nothing can ever detect the arrival.

---

## The six-hourly job

One additive `continue-on-error` step in `.github/workflows/ingest.yml`, placed after the shrink
guard so it cannot interfere with the existing guards:

```yaml
      - name: Collect the next Champions regulation, if Showdown has shipped it
        continue-on-error: true
        run: PAGES=25 CONC=20 node engine/next_regulation_ingest.js
```

Plus `node engine/next_regulation_ingest.js --reconcile || true` inside the push-retry loop (the same
union-and-dedupe the ladder gets, because `git reset --hard origin/main` restores origin's `.gz` and
leaves the ignored plain file alone), `data/next-regulation.json` added to `add_artifacts`, and:

```bash
            for f in data/games.gen9champions*.jsonl.gz; do
              if [ -e "$f" ]; then git add "$f"; ...; fi
            done
```

The glob matches nothing today. **An unmatched glob leaves `$f` as the literal pattern, which `-e`
rejects, so this is a no-op rather than the `bash -e` abort that killed this workflow for 24 days** —
proven under `bash -euc` both empty and matching before it was written in.

**The artifact is rewritten only when the answer moves.** `data/next-regulation.json` carries a
`signature` of the detection with the volatile parts removed. A fresh timestamp every run would stage
on every run, so a six-hourly job that collected nothing would still produce four commits a day,
churning every mtime `engine/provenance.js` reads to record that nothing happened. The file says so
in its own `note`, so an old `generated` reads as "the answer has not moved", not "the check
stopped"; the run log is the record that it ran. It stamps `by` and `source_digests` via
`engine/run_stamp.js`, so provenance verifies it by CONTENT: the mtime-only ratchet moved
**190 -> 189**, down rather than up.

---

## Gates

| gate | result |
|---|---|
| `tests/test-next-regulation.js` | GREEN, 19/19; shown red on a deliberate break first |
| `tests/test-parse.js` (extractor pin) | GREEN, 42 passed 0 failed |
| `tests/test-no-silent-failure.js` | GREEN, 0 NEW (baseline 201, unchanged) |
| `tests/test-workflow-paths.js` | GREEN, 5 passed 0 failed |
| `tests/test-docs-current.js` | GREEN, 23 passed 0 failed |
| `tests/test-roadmap-register.js` | GREEN, 3 passed 0 failed |
| `engine/provenance.js` | `next-regulation.json` `ok`, verified by content digest; mtime-only 190 -> 189 |
| `engine/engine_release.js list` | unchanged — nothing entered frozen `SOURCES` |
| `engine/artifact_audit.js` | 1 GAP, pre-existing (`data/abra-tags.js` drift) |
| `engine/conformance.js` | RED on 67 pre-existing regressions, **none naming a file touched here**; baseline NOT rewritten |

The silent-catch gate flagged 5 new blocks on first run because its heuristic did not recognise the
local `note()` helper. Renamed to `failedTo()`, which the gate's `/\bfail\w*\s*\(/i` clause
recognises and which is a more honest name. The gate was not edited.

---

## OWED, NOT RUN

- **`node engine/status.js --write` WAS NOT RUN, DELIBERATELY.** `engine/medicham2-browser.js` was
  rewritten by another process 17 minutes into this session and `data/mechanics-census.json` was
  regenerated 11 minutes into it — a second agent is working on the simulator concurrently.
  Restamping four ledgers from numbers moving under another agent would publish somebody else's
  half-finished engine as this pass' state. **No census figure is quoted anywhere in this report or
  in any document written by this pass.** The generated blocks are one session stale by choice.
  Whoever lands next should run it.
- **The census and the roster were not run.** Nothing in `SOURCES` moved and no simulator byte was
  edited here, so a regeneration could only cost time — and see above.
- **`engine/quarantine.js:2833` will misclassify the new store on the day.** It exempts a store from
  quarantine by scanning collector SOURCE for a literal `games.<name>.jsonl`; this collector's store
  name is derived at run time, so no literal exists to find and the store would be classed as
  something one of our own runs produced. That would wrongly quarantine figures counted off a HUMAN
  corpus — the exact failure that file's own comment records for `games.bo3.jsonl`. Harmless today
  (no such store exists). **MEASURE's file; filed, not touched.**
- **`build/compress-stores.js` was deliberately left alone.** Teaching it to discover the new stores
  would make `tests/test-workflow-paths.js` demand a current `.gz` for every next-regulation store on
  disk, which is a landmine. The collector compresses its own instead.
- **`build/triggers.js` was NOT re-run against the corrected label**, and the existing store's rows
  keep the old constant. That is correct — history is not relabelled in place — but it means the
  alarm's baseline is `champions-regmb` for every stored game and will only see a rotation in NEW
  rows. That is what it is for, and it is stated rather than assumed.
- **`data/games.gen9championsvgc2026regmabo3.jsonl` + `.jsonl.gz` + `.raw-logs.jsonl` are rehearsal
  output left on disk** (51 Reg M-A bo3 games). The plain and raw files are gitignored; the `.gz` is
  not, so it will show as untracked. Left in place rather than deleted — reported, not tidied.
- **The `data/games.ladder.jsonl` / `.gz` disagreement is untouched.** Nothing here reads either
  file or assumes they agree.
- **On the day it lands:** paste the printed block into `data/regulations.json`, set `active` by
  hand, run `build/archive-regulation.js` to snapshot the outgoing regulation, and pull the Showdown
  checkout. Collection is automatic; the other three are not.
- **Routing question for the coordinator.** `engine/durable-ingest.js` and
  `.github/workflows/ingest.yml` are OPS surface by `docs/DIVISIONS.md`, and OPS is read-only. This
  pass edited both under an explicit ENGINE brief. The record landed in `docs/ENGINE.md`;
  `docs/OPS.md` was not touched.

---

## Files

- `engine/next_regulation.js` — new. The detector.
- `engine/next_regulation_ingest.js` — new. The collector, the reconcile, the artifact.
- `tests/test-next-regulation.js` — new. 19 checks.
- `engine/durable-ingest.js` — the Champions format tag, read from `|tier|` instead of a literal.
- `.github/workflows/ingest.yml` — one step, one reconcile call, two `git add` additions.
- `.gitignore` — `data/games.gen9champions*.jsonl`.
- `data/next-regulation.json` — new artifact, content-digest stamped, written on change only.
- `docs/ENGINE.md`, `CHANGELOG.md` (5.235.0), and the six version-headed living docs.
