# The browser rulebook drifted from the node rulebook, and nothing compared them — 2026-08-25 (MEASURE)

## The short version

The defect was relayed to me second-hand, so the first thing I did was check whether it was still
real. **It was, and it was worse than reported: it had drifted again since the report was written.**

- `data/tags.json` is the rulebook the **node** engine reads.
- `data/abra-tags.js` is a **verbatim copy** of it that the **browser** engine reads, and it is
  frozen into every engine release.
- They were **not the same file** at HEAD, this morning, in the committed tree.

Nothing in the repository compared them. There is now a check, it is inside a gate that already
existed, and I did not build anything new to hold it.

---

## 1. Verifying the claim before acting on it

**Which file generates which.** `build/build_tags_js.js` reads `data/tags.json` and writes
`data/abra-tags.js`. The payload is the source *verbatim* — one header comment, then
`window.ABRA_TAGS=<the whole of tags.json>;`. So any difference at all is drift; there is no
transform to argue about.

**Were they in agreement?** No.

```
data/tags.json      generated 2026-08-25T03:37:49Z
data/abra-tags.js   generated 2026-08-25T02:19:31Z      (78 minutes behind)
```

Compared structurally rather than by size, four rows differed:

| row | `tags.json` says | `abra-tags.js` said |
|---|---|---|
| `moves.bugbite` | `removesItem: { steals: false, requiresItemClass: ["isBerry"] }` | `removesItem: { steals: false }` |
| `moves.pluck` | same as Bug Bite | same omission |
| `moves.thunderwave` | `statusCategory: { status: true, respectsTypeChart: true }` | `statusCategory: { status: true }` |
| `tags[…].ignoresTypeImmunity` | carries a `consumedBy` string | `consumedBy: null` |

**These are not cosmetic and both have live consumers.** `medicham2-browser.js:26385` reads
`removesItem.requiresItemClass` and `:22381` reads `statusCategory.respectsTypeChart`, both wired on
2026-08-25. Under the stale browser table, Bug Bite and Pluck steal *any* item instead of only a
berry, and Thunder Wave paralyses a Ground type. Bug Bite is 456 corpus clicks and Thunder Wave 564.

**This was in the commit, not just the working tree.** `git show HEAD:data/tags.json` against
`git show HEAD:data/abra-tags.js` gives the same mismatch, so the divergence is what a fresh clone
gets. The working tree matched HEAD exactly for both files.

**Was the reported "two days stale" a different event?** Yes. The ENGINE pass documented in
`docs/_reports/2026-08-24-mechanics-by-reach-3.md` rebuilt `abra-tags.js` at 22:59 to fix a two-day
drift; a `tag_dex` run at 23:37 then rewrote `tags.json` and the copy was left behind again. **The
drift recurred within 38 minutes of being fixed by hand.** That is the argument for a check rather
than for more care.

**What compared them today: nothing.** Grepped every reference to `abra-tags` across `tests/`,
`engine/`, `build/` and `app/`. Every hit is a *read*, a *load-order* assertion, or a comment. Two
things touch the pair and neither asks this question:

- `engine/provenance.js:691` lists `abra-tags.js` as an **engine input** for refit staleness — it
  asks whether the weights are older than it, not whether it matches `tags.json`.
- `tests/test-site-data-fresh.js` asks whether it is **newer than the corpus**. CLAUDE.md is explicit
  that newer is no evidence: `engine-data.js` was newer than the merge script and had still lost its
  output.

**And four instruments read the stale copy as though it were the rulebook**: `tests/walk_tags.js`,
`tests/mechanics_rank.js`, `tests/mechanics_surface.js` and `tests/test-engine-diff.js` all parse
`data/abra-tags.js`, not `data/tags.json`. So the drift was not only shipping to the browser, it was
steering an ENGINE gate.

---

## 2. The fix is registration, not construction

`engine/artifact_audit.js` was built on 2026-07-30 for exactly this class and is already registered
as a GATE in `tests/run-all.js:85`. Its checks A–F all interrogate one artifact, `data/engine-data.js`,
but its *stated* subject is wider: *"a DERIVED ARTIFACT is never checked against the SOURCE it was
derived from."*

**Could check B express this pair?** Not without rewriting it. Check B is row-and-field shaped — it
walks per-species rows and asks which fields the source could have filled and did not, weighted by
usage. This pair has no rows and no fields: it is one file that must equal another byte for byte.
Forcing it through B would have meant generalising the whole `SOURCES` loop to take an artifact
parameter, which is a bigger change than the one below.

So I added **check G** to the same file, and gave the builder a `--check` mode — reusing the pattern
this repo already established for this exact class on 2026-08-04, when `data/guru.js` published
`n_decisive: 0` while `data/guru-matchups.json` said 6. `build/build_guru_js.js --check` and
`tests/test-guru-derived.js` were the answer then; check G is that answer generalised, and it picks
up guru's existing check for free.

### What check G does

```
G. THE BROWSER COPY AGAINST THE NODE ORIGINAL — generated bundles vs their sources
     10 generated bundle(s) under data/ declare a builder; 4 of those builders offer --check and are COMPARED
  ok   data/abra-tags.js is what build/build_tags_js.js would write from data/tags.json
  ok   data/guru.js is what build/build_guru_js.js would write from data/guru-matchups.json
  ok   data/mega-formes.js is what build/build_browser_data.js would write
  ok   data/move-effects.js is what build/build_browser_data.js would write

     6 bundle(s) have a builder and NO --check — reported, not failed:
       data/abra-meta.js        <- build/build_meta_js.js  from data/meta-usage.json
       data/board-data.js       <- build/build_board_browser.js  (source not declared in the header)
       data/engine-data.js      <- build/build_engine_data.js  from CHOMP/engine/champ-model.js
       data/mag.js              <- build/build_mag_data.js  (source not declared in the header)
       data/mew.js              <- build/build_mew_bundle.js  (source not declared in the header)
       data/status.js           <- build/build_status.js  (source not declared in the header)
```

Three properties, each one a lesson this file already paid for:

- **Membership is derived, never typed.** The pairs are read at run time off the
  `GENERATED by <builder> from <source>` headers the bundles carry about themselves. A typed list
  here would rot exactly like the one `engine/provenance.js` had to delete.
- **The comparison is the builder's own `--check`, never a re-implementation.** Two implementations
  of one fact is this repo's most expensive recurring failure, and a re-implementation would also go
  wrong the moment a wrapper changed shape.
- **A builder with no `--check` is printed, not failed.** Turning six rows red at once is how a gate
  becomes something people waive. The line says "NO `--check`" and not "NO comparison", because one
  of those six rows is `data/engine-data.js`, which checks A–F above *do* compare field by field. A
  gate line that overstates its own finding is how a gate stops being read.

One derivation bug found and fixed while writing it: the first header pattern could not cross a
` * ` line prefix, so it silently skipped `data/move-effects.js` and `data/mega-formes.js` — the
check covering less than it appeared to, which is the failure the whole file is about.

### Applying the three hard-won rules from the brief

- **Judge a builder only on the rows it WRITES.** Check G runs the builder itself, so the set of rows
  judged is by construction the set the builder writes. The `build_browser_data --check` compares its
  own payload against what is on disk, so a move the dex does not know is not in either side.
- **Two keys that normalise alike.** Not applicable to a verbatim wrapper — there is one key space,
  the source's. It *is* applicable to `build_browser_data`, and it is handled: the comparison is a
  union of both key sets, so a key present on one side and absent on the other is a difference rather
  than being skipped.
- **Newer is no evidence.** No part of check G looks at an mtime. That is the whole point of it: the
  only standing check on these files *was* an mtime test, and the drift walked straight past it.

---

## 3. Wiring one more, because it was trivial and it was the consequential one

`build/build_browser_data.js` writes `data/move-effects.js` and `data/mega-formes.js` **from the
Champions dex**. `move-effects.js` is frozen into every engine release (`engine/engine_release.js`
SOURCES), is lazily required by `medicham2-browser.js` for move priority, and is read by six test
instruments. Nothing compared either file to the dex.

It now has a `--check`. Two details worth recording:

- **The date stamp is excluded from the comparison.** The header carries today's date by construction,
  so a byte comparison would fail one day after every legitimate build — and a test that does that is
  one people waive. Only the payload is compared.
- **The shipped file is read back through its own wrapper**, not by re-parsing the text, so a wrapper
  that changed shape is a named failure rather than a silent mismatch.

**Shown RED on a deliberate break, in a scratch copy — the repository files were never touched.**
Copying the builder and both bundles into a scratch tree, retyping Sucker Punch to Ghost and blanking
Aggron-Mega's ability:

```
data\mega-formes.js DOES NOT MATCH the Champions dex — 1 of 75 legal mega stones differ: aggronite
data\move-effects.js DOES NOT MATCH the Champions dex — 1 of 500 legal moves differ: suckerpunch
checked 0/2 browser data files against the Champions dex          exit=1
```

Against the real files it is green and writes nothing: `git status` on both is clean after the run.

The `abra-tags` half needed no staged break — **it was red on the live drift**, named the three moves,
and went green on the regeneration.

---

## 4. The class: which generated files under `data/` have a source and no comparison

Two populations, and they are not the same question.

### 4a. The browser bundles — `data/*.js`

Nineteen files. Ten declare their builder in a header and are the population check G judges. **Nine
declare nothing at all, so no derived check can even find their builder** — including check G. Those
nine are `kad-replays.js`, `live.js`, `nmf.js`, `pory.js`, `roles.js`, `scoreboard.js`,
`slowking.js`, `slowking-playstyle.js`, `xatu.js`. `scoreboard.js` names `build/build_scoreboard.js`
*inside its JSON payload* rather than in a comment, which is why it is invisible here; the honest fix
is a one-line header on each, not a wider regex.

**Ranked by consequence. Named, not wired.**

| rank | bundle | source | what it steers | state |
|---|---|---|---|---|
| — | `data/move-effects.js` | Champions dex | move priority; **frozen in every engine release**; read by 6 instruments | **NOW COVERED** (this pass) |
| — | `data/abra-tags.js` | `data/tags.json` | the browser engine's whole rulebook; frozen in every release | **NOW COVERED** (this pass) |
| — | `data/mega-formes.js` | Champions dex | what a mega turns into; megas are ~26% of format usage | **NOW COVERED** (this pass) |
| — | `data/engine-data.js` | `mega-dex-official.json` + dex | the species table the damage engine builds from | covered by checks A–F |
| — | `data/board-data.js` | `smogon-priors.json` + others | `board.js` features in the browser | covered — `tests/test-board-browser.js` asserts browser and node agree feature for feature |
| **1** | `data/mag.js` | `build/build_mag_data.js` | the site's MAG weights. Was caught 0.8 days stale in 2026-08-01 serving pre-refit weights | uncovered. **Low priority by Will's standing call that MAG is being overhauled — do not invest** |
| **2** | `data/scoreboard.js` | `build/build_scoreboard.js` | the site's model scoreboard — the page that publishes results | uncovered, and **invisible to check G** (no header) |
| **3** | `data/abra-meta.js` | `data/meta-usage.json` | which species the Tower fields as guardians | uncovered |
| **4** | `data/mew.js` | `build/build_mew_bundle.js` | a site report bundle | uncovered |
| **5** | `data/status.js` | `build/build_status.js` | the site's status page | uncovered |
| **6** | `data/roles.js`, `data/xatu.js`, `data/nmf.js`, `data/slowking*.js`, `data/pory.js` | various, two of them Python | site report bundles; `slowking-playstyle.js` has **no generator at all** and cannot be refreshed by anybody | uncovered, and no header |

Ranks 1, 4, 5 and 6 are all downstream of the refit and are in the set it invalidates, so wiring
checks onto them before the refit would mostly assert that stale files are consistently stale. Rank 2
and rank 3 are the two worth doing next, and rank 2 needs a header before it needs a check.

### 4b. The JSON artifacts — and why I did not build a second checker for them

`engine/provenance.js` already derives the writer→artifact graph from source for **234 artifacts**,
and it is the canonical path. Its own stamp (`data/provenance-stamp.json`, written 2026-08-25T07:43Z
by another process during this pass, so read as a reading and not as my measurement) says:

```
verified by CONTENT digest   2
by mtime alone             172
no writer found             38
```

That is the honest state of the JSON class and it is already printed on every run. **The gap there is
not "no comparison exists", it is "the comparison rests on mtime for 172 of them"** — a different
defect with a ratchet already pointed at it, and duplicating it here would be the second
implementation this whole report argues against.

---

## 5. What was regenerated, and what changed

**One file: `data/abra-tags.js`.** Rebuilt with `node build/build_tags_js.js` so check G is green.

Say plainly what that hides and what it does not: it hides nothing that was not already established
above — the four differing rows are listed in §1, they were read off the committed files *before* the
rebuild, and the direction is unambiguous (the browser copy was **behind**, and the rebuild moved it
forward to a `tags.json` it should always have equalled). The file shrank 809,036 → 767,938 bytes,
which is whitespace: the previous copy had been wrapped around a pretty-printed `tags.json` and the
current one is compact.

Nothing else on disk changed. `data/move-effects.js` and `data/mega-formes.js` were checked and are
already correct; `git status` on both is clean.

## 6. Files touched

- `build/build_tags_js.js` — added `--check`.
- `build/build_browser_data.js` — added `--check`.
- `engine/artifact_audit.js` — added check G.
- `docs/MEASURE.md` — a dated entry outside the `<!-- GENERATED -->` block.
- `data/abra-tags.js` — regenerated.

No new file, no new gate, no test edited, nothing committed.

## 7. Proposed register row

**CLOSE.** *`data/abra-tags.js` can go stale against `data/tags.json` and no gate says so.* — CLOSED.
It was two days stale on 2026-08-24, was rebuilt by hand, and had drifted again 38 minutes later; the
mismatch reached HEAD, where the node and browser engines disagreed about Bug Bite, Pluck and Thunder
Wave, both params having live consumers. `build/build_tags_js.js` gained a `--check` and
`engine/artifact_audit.js` gained **check G**, which derives the pairs from the bundles' own
`GENERATED by … from …` headers and runs each builder's own check — no new gate, no
re-implementation, no typed list. VERIFIED BY `engine/artifact_audit.js` (registered in
`tests/run-all.js`); it was RED on the live drift and is green after the regeneration.

**OPEN (new, small).** *Nine `data/*.js` bundles carry no `GENERATED by …` header, so no derived
check can find their builder — `data/scoreboard.js` is the one that matters, because it is the page
that publishes model results.* The fix is a one-line header per file; check G then covers them with
no edit to it.

## 8. OWED, NOT RUN

- **`tests/run-all.js` in full.** Not run. I ran `engine/artifact_audit.js` (exit 0),
  `tests/test-guru-derived.js` (0) and `tests/test-mag-page.js` (0).
- **`tests/test-site-data-fresh.js` is RED and it was red before this pass** — 9 site bundles are
  15.3 days older than the newest game data (`abra-meta`, `guru`, `mag`, `mew`, `move-effects`,
  `roles`, `scoreboard`, `slowking-playstyle`, `status`). `data/abra-tags.js` is **not** in that list
  and is now the freshest file in it. I did not fix it: every remaining name is either a quarantined
  artifact or downstream of the refit, and regenerating them is a decision, not a tidy-up. **Reported,
  not filed.**
- **`engine/status.js --write`** — forbidden by the brief; the generated blocks are unstamped.
- **CHANGELOG entry and version bump** — reserved by the coordinator.
- **`docs/ROADMAP.md`** — not edited; the two rows are proposed in §7.
- **The six uncovered bundles in §4a** were named and deliberately not wired.
- **`engine/provenance.js`** was not run by me. Its stamp moved at 07:43Z under another process; I
  read it and did not write it.
- **A pool-scale or game-level measurement** — none. This pass played no game, by the brief.
