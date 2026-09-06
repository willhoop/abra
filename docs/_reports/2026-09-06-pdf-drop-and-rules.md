# Dropping the division-ledger PDFs, and writing tonight's rules down — 2026-09-06

MEASURE. Two jobs Will approved explicitly: take `docs/ENGINE.pdf` out of the PDF build set, and
record tonight's operating rules where the next session will read them.

Nothing here is a model figure. Every number below is derived from git or from the filesystem, and
the command that produced it is printed beside it so it can be re-run.

**Constraint honoured:** two other agents were live. Nothing under `engine/medicham2-browser.js`,
`engine/board_state.js`, the probes, `docs/ENGINE.md`, `build/compress-stores.js`, the ingest path,
`.gitignore` or the data stores was touched. No differential, census, roster or release cut was run.
`engine/status.js --write` was not run. Nothing was committed.

---

## 1. THE RULE, AND WHY IT IS A RULE RATHER THAN A FILENAME

> **A division ledger is a working document and gets no PDF.**

A deliverable is read as a PDF: the white paper, the deck, the technical docs, `SUMMARY.md`. A
division ledger is not. It is append-only, read in the editor by the division that writes it,
restamped inside a `<!-- GENERATED -->` block by `node engine/status.js --write`, and handed to
nobody. Measured confirmation that nobody reads them as PDFs: **no link anywhere in the repository
points at any of the five** (`rg '(ENGINE|MEASURE|SEARCH|OPS|WEB)\.pdf' -g '*.{html,sh,yml,json,js}'`
returns only `build/build_pdfs.js`'s own comments), and no test references a PDF at all
(`rg '\.pdf' tests/` → no matches).

**The set is derived, not typed.** `build/build_pdfs.js` reads `.claude/agents/*.md` — the same
source `engine/orient.js` uses — and maps `engine.md` to `ENGINE.md`. `docs/DIVISIONS.md` said
"Four divisions" for nineteen days after WEB was added; a typed list of five here would rot the same
way, and a sixth division's ledger would then quietly get a PDF nobody decided to build.

**And it fails loudly if the derivation goes absent.** An unreadable or empty `.claude/agents/`
would silently restore a 13.9 MB-per-bump build while reporting success — this project's signature
failure. `ledgerDocs()` throws instead, and the excluded set is PRINTED on every run so the
exclusion can prove it ran.

Shown red on a deliberate break before being trusted (`prove_loud.js`, written this session in the
scratchpad, stubs `fs.readdirSync` for the agents directory and requires the real script):

```
$ node prove_loud.js enoent
THREW as designed: cannot read C:\...\.claude\agents (ENOENT ...)
$ node prove_loud.js empty
THREW as designed: C:\...\.claude\agents holds no agent definitions ...
```

Without the throw, both cases print `NO THROW — THE EXCLUSION WENT ABSENT SILENTLY.`

## 2. THE NUMBERS THE DECISION RESTS ON

All five ledgers are the same kind of document, so they are treated the same way. The sizes say the
rule is worth having for ENGINE and MEASURE and costs nothing for the other three.

```bash
git rev-list --objects --all -- docs/ENGINE.pdf ... \
  | grep -E 'docs/(ENGINE|MEASURE|SEARCH|OPS|WEB)\.pdf$' \
  | git cat-file --batch-check='%(objectsize:disk) %(objectsize) %(rest)'
```

| ledger PDF | in the tree | versions | packed history | packed at HEAD |
|---|---|---|---|---|
| `docs/ENGINE.pdf` | 28.81 MB | 10 | **108.4 MB** | **13.86 MB** |
| `docs/MEASURE.pdf` | 4.85 MB | 11 | 19.6 MB | 2.41 MB |
| `docs/SEARCH.pdf` | 2.75 MB | 10 | 3.1 MB | 0.06 MB * |
| `docs/WEB.pdf` | 0.46 MB | 9 | 1.0 MB | 0.30 MB |
| `docs/OPS.pdf` | 0.18 MB | 8 | 0.3 MB | 0.01 MB |
| **five** | **37.04 MB** | 48 | **132.4 MB** | **16.64 MB** |

\* `objectsize:disk` for `SEARCH.pdf` at HEAD is a delta against a near-identical earlier blob and is
not representative; its historical average is 0.31 MB per version. The honest per-pass figure is
therefore **~16.6 MB and not less than ~13.9 MB**, dominated by ENGINE either way.

Context, from `git count-objects -vH`: the pack is **524.28 MiB**. The five ledger PDFs are
**25.3% of the entire history of this repository**, and `docs/ENGINE.pdf` alone is **20.7%** — the
single largest object class in the repo.

**Why one document is 28.8 MB:** `docs/ENGINE.md` is 2.97 MB of markdown. The PDF is a faithful
render of a ledger that grows every session. It was never going to stop growing.

**PDFs do not delta-compress.** The ten `ENGINE.pdf` versions pack at 11.4–13.9 MB each with no
saving from similarity, which is why the cost is per-rebuild rather than one-off.

## 3. WHAT WAS DONE

- `build/build_pdfs.js` — the ledger set is derived from `.claude/agents/*.md`, excluded from the
  work list, printed under an `EXCLUDED` heading, and the derivation throws if it goes absent. 58
  lines added, 2 changed. The legacy-name map and the staleness logic are untouched.
- `git rm --cached docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.pdf` — **staged, not committed.** The five
  files remain on disk, untouched; nothing was deleted.
- `docs/.gitignore` — **new file**, holding the five names and the reason.

**The root `.gitignore` was deliberately not touched**, because another live agent owns it tonight.
A per-directory `.gitignore` is the standard git mechanism, it takes precedence for files in that
directory, and it puts the ledger rule beside the ledgers. Verified active:

```
$ git check-ignore -v docs/ENGINE.pdf docs/WEB.pdf
docs/.gitignore:20:ENGINE.pdf   docs/ENGINE.pdf
docs/.gitignore:24:WEB.pdf      docs/WEB.pdf
```

**THE SAVING IS ENTIRELY FUTURE, AND THIS IS THE POINT MOST EASILY MISREAD.** Untracking these
recovers **zero bytes** of the 132.4 MB already in the pack. Those blobs are reachable from history
and only a rewrite removes them, which this project has ruled out. What changes is that the next
version bump, and every one after it, stops adding ~16.6 MB.

**One-command revert, if Will disagrees with any of the five:**

```bash
git restore --staged docs/MEASURE.pdf            # and delete its line from docs/.gitignore
```

## 4. RATCHETS, BEFORE AND AFTER

| gate | before | after | verdict |
|---|---|---|---|
| `node build/build_pdfs.js --check` | `4 to rebuild`, **exit 1** | `2 to rebuild`, **exit 1** | 2 fewer; **no ledger reported missing or stale** |
| `node engine/conformance.js --strict` | 89 regressions, exit 1 | 89 regressions, exit 1 | unchanged; `build_pdfs` appears in neither run |
| `node tests/test-docs-current.js` | 30 passed / 0 failed | **30 passed / 0 failed** | green |
| untraceable-figures census | 34 across 5 documents | 34 across 5 documents | unchanged |
| figures a cited artifact does not contain | 56 (baseline 56) | 56 (baseline 56) | unchanged |
| notes backlog owed to next major | 1 of 100 | 2 of 100 | my row, as intended |
| `docs_scan.js --note-check` on my file set | n/a | `3 recordable path(s), and docs/RUNNING-NOTES.md moves with them`, exit 0 | the commit will pass the hook |

**`--check` exits 1, and it did before this change too.** The baseline was measured by stashing the
edit: pre-change it listed `ENGINE.pdf` stale, `MEASURE.pdf` stale, `ROADMAP.pdf` stale,
`RUNNING-NOTES.pdf` missing. Post-change it lists `ROADMAP.pdf` stale and `RUNNING-NOTES.pdf`
missing. **Both survivors pre-date this work and neither is a ledger**; making the check exit 0 means
building a 6.9 MB `ROADMAP.pdf` and a new `RUNNING-NOTES.pdf`, which is a document bump, and the
brief forbade one. Reported, not done.

**Two things worth Will's eye, reported and NOT acted on:**

- **`docs/ROADMAP.pdf`** — 6.89 MB in the tree, **4.9 MB across 8 versions**, currently stale. It is
  arguably the same kind of document as a ledger (a register, worked in, not handed out). It is
  outside the stated rule, so it was left alone rather than swept in.
- **`docs/RUNNING-NOTES.pdf`** — does not exist yet. `RUNNING-NOTES.md` is append-only by design and
  will grow every session; giving it a PDF starts the `ENGINE.pdf` story again from zero. Worth
  deciding before the next major, not after.

## 5. THE RULES, WRITTEN DOWN

`CLAUDE.md` gained two sections and one paragraph; `.claude/skills/start/SKILL.md` gained four
bullets in §4 and one short subsection. Nothing already in either file was restated.

**In `CLAUDE.md`, before the living-docs section:**

- **`READING THE DIFFERENTIAL: THE FLAGS ARE THE SAMPLE AND THE FIELD IS NOT THE CLAUSE`** — four
  rules. `--games` is part of the sample definition (default 45, verified at
  `engine/game_differential.js` `const GAMES = +flag('--games', 45);`), and 777-versus-961 cost a
  pool-pin audit that found the pin honoured. The capped lists are not the population
  (`first_board_divergences` is `.slice(0, 40)` at line 8075, `first_divergences` is `.slice(0, 60)`
  at line 9075, both verified by reading the source), four agents mispredicted from them in two
  nights, 32 bare `-fail` rows hid behind the cap, and the by-cause list is keyed on the first
  PROTOCOL divergence while the bar reads the first BOARD one. The bar is `state.games` less
  `state.games_board_never_diverged`, and `by_cause_totals.games_board_material` is a different
  number — check both operands of every subtraction. A receipt is written from the path the run
  opened, because `engine/provenance.js` verifies each key against the file that key NAMES
  (ROADMAP #547).
- **`THE REPOSITORY HAS A HARD WALL, AND HISTORY IS PERMANENT`** — three rules. Deleting a tracked
  file recovers zero bytes (`data/verification/` is 96 MB in the tree, 4.9 MB of history); `git gc`
  is what worked, 1037 MiB → 525 MiB with nothing deleted. The 100 MB wall with its DATE:
  `data/games.ladder.jsonl.gz` is 51.81 MB today and grows 1.12 MB/day, crossing 100,000,000 bytes
  around **2026-10-17**, taking the hourly ingest with it — so state the growth budget in any change
  that touches the stores. And a history rewrite is not available: it would invalidate **271 distinct
  commit hashes that resolve today in tracked markdown**, which is the evidence chain this project
  traces figures through.

**In the living-docs section:** one paragraph stating the ledger-PDF rule with its measured reason
and the note that the saving is future only.

**In `/start` §4 (`What NOT to do`):** three new bullets — do not predict from the capped lists, do
not read the field whose name looks right, do not quote a differential figure without its `--games`
— plus a short subsection **`EVERY COMMIT RECORDS A ROW IN docs/RUNNING-NOTES.md`** stating that a
row is the whole output between majors, that the hook blocks a commit touching
`engine/ tests/ web/ build/`, a live document or the CHANGELOG without it, and that clause 5b
re-checks it against history so `--no-verify` cannot launder it.

`/start` is read every session, so the additions are 22 lines and no more. The measurement sits
beside each rule; the narrative is here.

## 6. THINGS LEFT ALONE ON PURPOSE

- **The five ledger PDFs are still on disk**, untracked and ignored. They will never be rebuilt and
  will get progressively staler as files-on-disk. They were not deleted: nothing gets deleted that
  this session did not create.
- **The working tree carries other agents' unstaged changes** (`build/compress-stores.js`,
  `docs/ENGINE.md`, a dozen `data/*.json`). Only the five PDF removals are staged. A publisher using
  `git commit -a` will sweep the rest in; a publisher naming paths will not.
- `engine/status.js --write`, differentials, censuses, rosters and release cuts: not run.
- No CHANGELOG entry and no version bump were written. Will publishes and the version is his to
  assign; the notes row is under `[Unreleased]` and the publish pass renames the heading.

---

## OWED, NOT RUN

```bash
# 1. Confirm the check from a clean tree once the other agents have landed.
node build/build_pdfs.js --check

# 2. Decide docs/ROADMAP.pdf (6.89 MB tree, 4.9 MB history, currently stale) and
#    docs/RUNNING-NOTES.pdf (does not exist; the source grows every session).
#    If they join the rule, the derivation in build/build_pdfs.js needs a second clause,
#    NOT two more filenames.

# 3. The pack is 524.28 MiB after tonight's gc. Re-measure before the next major so the
#    per-bump saving can be stated as an observed delta rather than a projection.
git count-objects -vH

# 4. The store wall. Re-derive the crossing date after sharding lands; it is 2026-10-17 today.
ls -l data/games.ladder.jsonl.gz

# 5. MEASURE's own standing item is untouched by tonight: data/winrate-backtest.json is
#    QUARANTINED, not merely stale, and does not become re-runnable until the MEDICHAM gate opens.
node engine/status.js
```
