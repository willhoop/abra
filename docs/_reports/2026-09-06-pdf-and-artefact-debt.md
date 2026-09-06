# PDF build debt and project-parity audit — 2026-09-06

MEASURE. Documents and the build path only. No engine job, differential, census or roster run was
started; an ENGINE agent was editing `engine/medicham2-browser.js` and cutting releases throughout.
Every artifact figure below is read with `git show HEAD:<file>` or from a file whose mtime was
checked against the clock first.

---

## Verdict

**80 of 80 PDF targets are current. 25 were rebuilt, 0 failed, 0 remain stale, 0 remain missing.**
The four "missing outright" documents all had sources on disk; nothing was invented and nothing is
owed. The build path did not error on a single file, so no fix was needed in `build/`.

**ABRA passes the project-parity check 12 of 12 artefacts.** The check is not at the path the
umbrella rule names, and it does not check ABRA's version consistency at all.

Two figures are reported rather than restated: a quarantined leaf-calibration number standing in a
document whose PDF was rebuilt tonight, and a corpus figure in the white paper whose cited artifact
no longer contains it.

---

## 1. The true state before the rebuild

`node build/build_pdfs.js --check` at 01:58, from a clean tree:

```
DOCUMENT PDFs — 77 markdown sources
  25 to rebuild.
```

**21 stale, 4 missing, 0 erroring.** The three categories the brief asked to be separated:

| cause | outputs | which |
|---|---|---|
| source changed, PDF not rebuilt | **20** | ADR-003, ALAKAZAM-v2-spec, CLICK-CENSORING-FIX, DIVISIONS, ENGINE-COVERAGE-PLAN, FINDINGS-2026-08-01-live-play, GAME-DIFFERENTIAL-DESIGN, GLOSSARY, HANDOFF-2026-08-01, IMPLEMENTATION-PLAN-2026-08-01, LESSONS, MILTANK, ORIENTATION (two outputs), REVIEW-2026-07-25, ROADMAP-TO-ALAKAZAM, TAG-COVERAGE, TAGS-MASTER, WEB, predictability-study |
| PDF never built at all | **4** | ADR-002, CARD-REVIEW-2026-08-22, MEGA-FEATURES-SPEC, PRIOR-ART |
| build path errors on this file | **0** | none |
| source does not exist | **0** | none |
| mtime inversion, content already current | **1** | ABRA-whitepaper — see below |

Nineteen documents, twenty outputs, because `ORIENTATION.md` also carries the legacy name
`ABRA-Orientation.pdf`.

The oldest debt is real debt, not churn. `TAGS-MASTER.pdf` was last built 2026-07-29 against a
source last edited 2026-08-10; `predictability-study.pdf` and `REVIEW-2026-07-25.pdf` date from
2026-07-26. Twelve of the twenty were last built on 2026-08-04, in one pass, and nothing rebuilt
them after it.

### The 25th item is not debt — it is a reproducible mtime inversion, and it will recur

Tonight's publish pass reported "NOT rebuilt: 24" and listed `ABRA-whitepaper.pdf` among the
**eleven it did rebuild**. Both statements were true when written. The check then read 25.

The cause is a filename case, not a build failure:

- `docs/ABRA-whitepaper.md` is the source. `build_pdfs.js` derives the output name
  `docs/ABRA-whitepaper.pdf`, but the tracked and published directory entry is
  **`docs/ABRA-WhitePaper.pdf`** — capital W, capital P. On this case-insensitive filesystem they
  are one file, which the publish-pass report noted correctly.
- At 01:54:11 a `pull --rebase` rewrote the working tree — reflog:
  `600d2eb2 HEAD@{2026-09-06 01:54:11 -0400}: pull --rebase (finish)`. Commit `600d2eb2` contains
  **both** `docs/ABRA-WhitePaper.pdf` and `docs/ABRA-whitepaper.md`.
- Git writes checkout entries in byte order. `W` is `0x57` and `w` is `0x77`, so the PDF is written
  **first** and the source **second**. Measured: PDF `01:54:11.549784300`, source
  `01:54:11.569154100` — the PDF is 20 milliseconds older than the file it was built from.
- `build_pdfs.js` decides staleness on `mtimeMs`, so the pair reports `stale` after any checkout
  that touches both.

Every other pair in that same commit sorts source-first — `ENGINE.md` before `ENGINE.pdf`,
`ABRA-deck-plain-english.md` before its `.pdf` — and so lands correctly current. **Only the
odd-cased pair inverts, and it inverts every time.**

**Not fixed, deliberately; this is a report-it-leave-it call.** Two candidate repairs both cost more
than they buy tonight. Adding an `ABRA-WhitePaper.pdf` entry to the `LEGACY` map in `build_pdfs.js`
would make the tool build the same file twice on this machine. Changing staleness from mtime to a
content digest means introducing a sidecar record of what each PDF was built from, which is new
state in the one tool whose whole virtue is that it derives its list and remembers nothing. The
inversion is self-clearing on the next rebuild and costs one spurious line in a check.

**The latent half is worth naming even though it cannot bite here.** On a case-sensitive checkout
the two names are two files: `build_pdfs.js` would create and maintain `docs/ABRA-whitepaper.pdf`
while the tracked, linked, published `docs/ABRA-WhitePaper.pdf` was never rebuilt again — stale
forever, with the check reporting green. That is precisely the failure the `LEGACY` map exists to
prevent, for the one document it does not cover.

---

## 2. The rebuild

Run through `tools\lownode.cmd` at BELOWNORMAL, because an ENGINE agent was live:

```
25 built, 0 failed
```

`node build/build_pdfs.js --check` afterwards prints **every document has a current PDF**, exit 0.

Nothing could not be built. The build path is `build/md_to_pdf.js` — markdown to styled HTML to
headless Chrome — and it needed no change. No `.print.html` intermediates were left behind.

Rendering was verified rather than assumed on two of the four never-built documents, via
`pdf-inspector`: `ADR-002` returns its heading tree and body prose, `PRIOR-ART` returns its
prior-art table with cells intact. This matters because `md_to_pdf.js` carries a 2026-08-26 note
that CRLF sources once rendered with **every heading dropped**, and twelve CRLF documents with
stale or missing PDFs were named there as the next thing that would publish heading-less. Those
twelve are inside tonight's 25. They rendered correctly: `engine/read_text.js` normalises at the
read, and the fix holds.

Tree state left behind, uncommitted as instructed: **21 modified tracked PDFs, 4 new untracked
PDFs**, listed in `git status`. Nothing else was touched.

**One thing for whoever commits next:** ABRA has one publisher and `build/publish.sh` runs
`git add -A`. These 25 files will be swept into the next commit whoever makes it. They are correct
output built from current sources, so that is harmless — but it will not be attributable to this
pass unless the message says so.

---

## 3. The four missing documents — the sources all exist

**None of the four is a manifest entry naming a document that was never written, and there was
nothing to decline to invent.** All four sources are on disk and tracked:

| document | source | bytes | source last edited | PDF |
|---|---|---|---|---|
| ADR-002 — Showdown is the authority | `docs/ADR-002-showdown-is-the-authority.md` | 12,997 | 2026-08-11 | built, 185 KB |
| CARD-REVIEW-2026-08-22 | `docs/CARD-REVIEW-2026-08-22.md` | 25,920 | 2026-08-22 | built, 364 KB |
| MEGA-FEATURES-SPEC | `docs/MEGA-FEATURES-SPEC.md` | 8,552 | 2026-08-07 | built, 181 KB |
| PRIOR-ART | `docs/PRIOR-ART.md` | 16,163 | 2026-08-07 | built, 229 KB |

**There is no manifest, which is why the question resolves this way.** `build_pdfs.js` derives its
list from `fs.readdirSync(DOCS)` over every `docs/*.md` — the same principle as `provenance.js`
deriving the artifact graph from source. A derived list cannot name a document that does not exist;
it can only fail to have been run. That is what happened: `ADR-001` and `ADR-003` have PDFs from
2026-08-06 and 2026-08-07, `ADR-002` was written 2026-08-11, and no full pass ran after it.

So the error is neither the manifest nor a missing document. **The error is that the derived list
was never executed to completion** — the same shape as `artifact_audit.js`: a check that exists and
is correct, and is invisible for exactly as long as nobody runs it.

### The reverse direction: five PDFs have no markdown source

Not asked for; reported rather than acted on. 85 PDFs sit in `docs/`; the derived target set is 80.
The five with no source and no `LEGACY` entry:

```
ABRA-Architecture-Review.pdf   2026-07-25
ABRA-Deck.pdf                  2026-07-23
ABRA-Review-2026-07-26.pdf     2026-07-26
ABRA-SUPERCUT.pdf              2026-07-24
ALAKAZAM-one-pager.pdf         2026-07-24
```

All five predate the derived-list rewrite. They are hand-published names from the era the tool's own
header describes, when the mapping from source to output was typed by hand every time. Some
plausibly correspond to a source later renamed — `ABRA-Deck.pdf` against
`ABRA-deck-plain-english.md`, `ABRA-Architecture-Review.pdf` against
`ARCHITECTURE-REVIEW-2026-07-27.md` — but that is a guess and is not asserted here.

**Nothing was deleted and nothing was renamed.** If any of the five is still linked from a published
page, it is a document nothing can rebuild and nothing reports as stale — a PDF outside the check
entirely. That is a WEB or OPS question about what the site points at, not a MEASURE call.

---

## 4. Project parity — `check_projects.py`

**The command in the umbrella CLAUDE.md does not run as written.** The rule says to run
`python3 portfolio/build/check_projects.py` before any publish. There is no `portfolio/` directory
under `C:\Users\willj\Projects\Pokemon`, and `find` over that tree returns nothing matching
`check_projects`. `python`, `python3` and `py -3` fail identically — it is a path problem, not an
interpreter problem.

The script exists one level up, at **`C:\Users\willj\Projects\portfolio\build\check_projects.py`**,
and audits eight projects across all seven `Projects` directories. Run from
`C:\Users\willj\Projects\portfolio` it works.

**A standard that is not checked is a preference — and this one has been unrunnable-as-documented
from the directory the rule names.** The fix is one line in the umbrella CLAUDE.md, the path or a
`cd`, but that file is outside this pass's write scope and is shared by every Pokémon project, so it
is reported rather than edited.

### ABRA's row

```
                white paper  deck  tech docs  README  CHANGELOG  CLAUDE.md  tests
ABRA            yes          yes   yes        yes     yes        yes        yes

                LICENSE  SECURITY  CONTRIBUTING  .gitignore  CI
ABRA            yes      yes       yes           yes         yes
```

**12 of 12. No gaps.** The checker audits twelve artefacts, not the seven the umbrella rule names —
it has grown LICENSE, SECURITY, CONTRIBUTING, `.gitignore` and CI since that rule was written. It
prints "All projects meet the standard": every other project is also 12 of 12, so there is nothing
to report against anyone else on the artefact table.

### The gap is in the half of the check ABRA is exempt from

```
Version consistency
CHOMP          changelog=2.5.0    file=2.9    MISMATCH
HoopaDex       changelog=5.47     file=5.47   ok
ABRA           changelog=5.258.0  (no stamped artifact to compare)
```

Exit code 1, from CHOMP. Not ABRA's, and not fixed here.

**ABRA's own line is the finding.** The umbrella rule states that the top changelog version must
equal the version stamped on the project's primary artifact, and the checker enforces that through a
hand-typed `STAMPS` dictionary holding exactly three entries — `Pokemon/CHOMP`, `Pokemon/HoopaDex`
and `jeopardy-wagering`. ABRA is not in it, so its version consistency is **unchecked, not
verified**, and prints as a pass-shaped line. A hand-typed list of three inside a script whose job
is enforcing identical treatment is the same shape as the ban list of four.

It is covered locally, which is why this is a note rather than a red flag:
`tests/test-docs-current.js` rule 1 asserts every version-headed `docs/*.md` matches the CHANGELOG
top, and it is green — "every version-headed document is at 5.258.0 or is a declared pin (25
versioned, 19 pinned)". So the claim is true; the umbrella checker is simply not the thing
establishing it. A fourth `STAMPS` entry pointing at `docs/ABRA-whitepaper.md` would close it.
`portfolio/` is a different project and outside this pass's scope.

---

## 5. Stale figures found — reported, not restated

`node tests/test-docs-current.js` is **24 passed, 0 failed**. Both items below sit inside its
ratcheted baselines, so the gate is green and neither is a new break. Rule 3 of that gate reports
and deletes nothing, which is the posture taken here.

### 5a. A quarantined figure stands in a document whose PDF was rebuilt tonight

`docs/WEB.md:117` states:

> `data/winrate-backtest.json`, measured 2026-08-04, puts the live in-game leaf at **51.0%** of
> 1,314 decisive calls, 95% CI **[48.3, 53.7]**

and `docs/WEB.md:347` defends it — "WEB still authors no number here — the 51.0% is cited to
`data/winrate-backtest.json`". **`WEB.pdf` is one of the 25 rebuilt tonight, so that figure was just
republished in the format people actually read.**

**The citation is faithful.** The artifact's own `verdict` string reads "Names the winner on 51.0%
of 1314 decisive calls, 95% CI 48.3-53.7%." WEB quoted it exactly and attributed it correctly.

**The artifact is quarantined.** `engine/status.js` prints, in the MEASURE block of `docs/MEASURE.md`:
"leaf calibration: QUARANTINED — the figure is withheld, not annotated. `data/winrate-backtest.json`
is downstream of MEDICHAM." CLAUDE.md is explicit that a caption is not a quarantine and that the
figure must be withheld rather than annotated. `docs/WEB.md` annotates it with a date and states it.

**And the annotation understates the distance.** The artifact records what it was measured against:

| | measured against, 2026-08-04 | at `HEAD` today |
|---|---|---|
| `engine/medicham2-browser.js` digest | `0710a325219e` | `6fef70d4df5e` |
| bytes | 134,648 | 2,990,704 |

The simulator is now **22 times larger** and shares no digest with the one the figure describes.
This is not a stale caption on a still-recognisable measurement; it is a claim about a build that no
longer exists.

**Not edited.** `docs/WEB.md` is another division's ledger, the number cannot be re-derived without
running the backtest — which this pass was told not to do and which is gated behind MEDICHAM anyway
— and striking a published figure without a replacement measurement is the silent restatement the
brief forbids. It goes to WEB with MEASURE's finding attached.

### 5b. A white paper corpus figure the cited artifact no longer contains

`docs/ABRA-whitepaper.md:1602`:

> measured 2026-07-31, the games it keeps are **1.71x longer** on average (7.4 vs 4.3 mean turns;
> **19,589 kept vs 8,713 dropped**) … `data/quality-filter.json` states this at the point of
> filtering

`data/quality-filter.json` — read at `HEAD`, file mtime 2026-08-27 01:37, well clear of any live
writer — is version **1.3.0**, `measured_on` **2026-08-27**, `store_size` **67,384**, and its funnel
reads:

```
after_min_turns    26142
after_full_bring   18908
after_legality     18859
```

So the current kept and dropped counts at the `require_full_bring` step are **18,908 kept and 7,234
dropped**. None of 19589, 8713, 1.71, 7.4 or 4.3 appears anywhere in the artifact the sentence
cites.

**The two are not the same quantity and the correction must not be typed as if they were.** The
white paper's pair was measured on a 2026-07-31 store; the artifact's funnel is measured on a
67,384-game store, under a filter whose `exclude_forfeits` rule changed in 1.2.0 (+35% clean games)
and which gained `exclude_illegal_teams` in 1.3.0. The honest statement is not that 19,589 should
read 18,908 — it is that **the figure was measured under a filter definition that no longer exists,
and its cited artifact cannot confirm it.**

The white paper carries the words "measured 2026-07-31" in the sentence, which is the mitigating
half. The 1.71x ratio and the 7.4-versus-4.3 turn means carry no such date and are stated in the
present tense.

**The artifact has already been bitten by this exact failure and says so**, in
`why_this_block_was_restamped`: "the block below was measured on 2026-07-28 at a store of 20,688
games and 17.3% clean, and the store has since grown to 67,384 games at 28.0% clean - a drift of
10.8 points. The filter did not change; the recorded number went stale and nothing re-derived it."
The same drift is now sitting in the white paper, one layer up, pointing at the file that was fixed.

Re-deriving it is a filter run over the store, not an engine job — but the store is appended hourly
by OPS, so it needs a pass that can pin the store. Left for that pass.

---

## 6. A correction to the standing MEASURE brief, because it names the wrong run

The brief describes `data/winrate-backtest.json` as stale, "and it scored only 350 games at 40
rollouts." **That describes a superseded run.** The artifact on disk records:

| field | value |
|---|---|
| `measured_at` | `2026-08-04T07:09:31.394Z` |
| `n_games_scored` | **1,378** |
| `rollouts_per_game` | **200** |
| corpus | 6,886 scorable, split oldest 80% / newest 20%, held-out 1,378 |
| `runtime_seconds` | 1,046 |

The 350-at-40 figure is the **2026-08-02** run, which survives inside this artifact twice over: as
`power.prior_effect_source`, reading "data/winrate-backtest.json 2026-08-02: 0.5263 on 342 decisive
calls", and as a deliberate second arm, `results.live_ingame_n40`, whose config label reads "the
same in-game leaf at 40 rollouts — is it NOISY or is it WRONG?" Somebody already asked the sample
question and answered it inside the file.

**The reliability curve the brief asks to be published already exists** — ten buckets with per-bucket
n and Wilson intervals, at `results.live_ingame.held_out_fifth.reliability_curve`, with a
`noise_floor` key beside it. **It is not reproduced here and no value from it is quoted as current**,
because the artifact is quarantined and was measured against a simulator digest that no longer
exists: withheld, not annotated.

What the standing item needs is therefore a **re-run on a frozen release once the MEDICHAM gate
opens**, not a bigger sample. The sample and the curve are already there. The staleness the brief
asserts is real and worse than it describes; the description of the sample is what is wrong.

---

## 7. What this pass did not do

- **No engine job, differential, census or roster run.** The two things executed beyond the build
  were `tests/test-docs-current.js`, which reads `docs/` and shells one docs-only generator, and
  `engine/docs_scan.js --json`. Both are read-only over documents.
- **`engine/status.js --write` was NOT run**, and no `<!-- GENERATED -->` block was touched.
- **`data/docs-currency-baseline.json` was not edited.** No written reason in it was found to be
  wrong; the gate is green and every ratchet held at its baseline.
- **Nothing was committed**, per the brief. 25 PDFs sit modified or untracked.
- **Nothing was deleted.** The five orphan PDFs in section 3 are reported and left where they are.
- **No document was hand-edited.** Both stale figures in section 5 go to their owning division.
