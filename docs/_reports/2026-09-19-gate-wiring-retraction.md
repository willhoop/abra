# 2026-09-19 — gate wiring, the owed retraction, the cited releases, four scanner defects (6.56.0)

MEASURE, light mode: no games, no lattice, no roster stage, no `all_mechanics_fire`. Every figure here was
read from an artifact, a command's output, or git.

## 1. An in-scope COULD-NOT-STAGE row now fails its roster clause

**Done.** `engine/quarantine.js` `rosterStage`.

- The count is `scope.could_not_stage_in_scope` (tests/roster.js writes it at the refusal, over the in-scope
  set only). The rows are counted too, with the roster's own `OUT_OF_SCOPE` predicate (`scope_verdict` set, or
  `out_of_scope === 'no-legal-carrier'`). The larger of the two is used. If an artifact carries neither, the
  clause cannot answer and fails.
- It does NOT read `counts['COULD-NOT-STAGE']`. On the pre-2026-09-11 artifact `data/roster.all.json`
  (release `5a7bd8a8178a`) that bucket holds 174 and the in-scope count is 57. The gate would have failed on
  carrier-less rows.
- `DEFERRED-BY-OWNER` rows carry their own verdict, even when the underlying verdict is COULD-NOT-STAGE, so they
  never reach this term. Out-of-scope rows are never counted.
- **The gate reading did not move:** `node engine/quarantine.js` output diffed byte-identical before and after
  (325 lines, `GATE: CLOSED — 1 of 8`). The three live stages read `couldNotStageInScope` 0 / 0 / 0.
- **Red on a plant:** six new selftest arms. 285 passed, 0 failed. With `&& cnsIn === 0` deleted from the
  verdict, 281 passed and 4 failed, and the 4 were exactly the four RED arms (planted row, row-only,
  scope-only, cannot-count). The file was restored from a byte copy.
- Nothing else was loosened. The coverage clause's comment gained a dated note that COULD-NOT-STAGE is no
  longer a free pass.

## 2. The retraction owed on main

**Done.** `docs/ABRA-whitepaper.md` line 5: the 9 of 1069 and 21 of 1497 counts (release `bc8d7cf849dd`) are
deleted. The sentence now says only that `--games 1200` read zero and the other two did not, and it points at
`node engine/quarantine.js --whole-game` and the three `data/game-differential{,.g1350,.g1950}.json`
artifacts. No other living document carried them at HEAD (checked with `git show HEAD:` on the deck, technical
docs, SUMMARY and MODELS). The 6.47.0 row's error is recorded in the 6.56.0 row. That row is not edited,
because the page is append-only.

## 3. The cited releases

**Staged, not committed.** 95 releases, 2,612 files.

| set | releases | checkout added | pack added (upper bound) |
|---|---|---|---|
| provenance living arm only (`8a4140de3eaa`) | 1 | 7.0 MB | 1.3 MB |
| provenance living + ledger arms + the six the brief named | 19 | 107.4 MB | 1.7 MB |
| **+ every release id named in a living document or in RUNNING-NOTES — STAGED** (less one, below) | **95** | **570.4 MB** | **≤ 2.3 MB** |
| every untracked release any tracked file names | 414 | 2,129.1 MB | 4.6 MB |

- **Method.** Cited ids = every 12-hex token in tracked files (excluding the releases themselves, `*.jsonl`,
  `*.gz`) that names a directory under `data/releases/` which `git ls-files` does not list. Of 679 releases on
  disk, 53 are tracked and 626 are not; 414 of the untracked are cited. The pack figure is `git pack-objects`
  over only the blobs git does not already hold (checked with `git cat-file --batch-check` after
  `git hash-object --stdin-paths`). The objects were written to a scratch object directory and never to
  `.git`. Deltas were taken only among the new blobs, so this is an upper bound.
- **The 100 MB wall is not in reach.** The largest file in any cited release is 3.7 MB
  (`engine/medicham2-browser.js`).
- **The real cost is the checkout, not the pack.** Releases are near-identical copies, so they delta to almost
  nothing, but every clone and every CI checkout (the hourly next-regulation workflow, the six-hourly ingest)
  writes every file. Tracked releases today total about 68 MB, and the staged set adds 570.4 MB.
- **If that is too much, the 19-release set is the fallback.** It covers every artifact a published document
  cites, and it clears provenance's living-arm UNSAFE, which is why `status.js` withholds those figures today.
  It does not cover release ids that are named only in prose. To fall back, run `git reset -q --
  data/releases/<id>` for each id below whose only reasons are `living` and/or `notes`. That touches the
  index only; the files stay on disk.
- **provenance.js already derives the core of this.** Its block "PUBLISHED FIGURES CITING A RELEASE THAT IS
  NOT IN THE REPOSITORY" was used, not re-implemented. Its living arm is 8 artifacts, all on `8a4140de3eaa`.
  Its ledger arm is 25 artifacts on 15 releases.
- The 414, split by where the id is cited (a release counts in its first tier only): named in a living
  document 40 (244.0 MB), in a tracked data artifact 130 (506.1 MB), in `data/verification/` 94 (559.8 MB),
  only in logs, ledgers or reports 150 (819.2 MB).
- **`63e0e063bfed` is NOT staged.** `tests/test-artifact-rerunnable.js --staged` (the pre-commit gate, run with the hook's 6,144 MB heap) refused it. Its disk copy of `engine/medicham2-browser.js` hashes to `0608fb84f841` against a manifest of `a13b89d2689f`, and a CRLF rewrite does not restore it. The copy on disk is not that release, so committing it would commit a release that cannot be opened. It is cited only by RUNNING-NOTES and `docs/_reports/2026-09-08-speed-regression-bisect.md`. It was left on disk and not deleted. With it out, the gate passes: git tracks 148 releases.
- `2bddcc69ca83` and `4c79682a3115` hold only `release.json` on disk. They are staged as they are, and they
  cannot be re-opened as engines.

### The 95 staged releases (MB on disk; why)

`provenance` = named by provenance.js's untracked-release check; `brief` = named in the brief; `living` = the id
is written in a living document at HEAD; `notes` = the id is written in docs/RUNNING-NOTES.md.

| release | MB | cited by |
|---|---|---|
| `014fe780a1a6` | 6.2 | living |
| `028392265ab7` | 6.4 | living+notes |
| `0362ccffd3fe` | 6.4 | notes |
| `05e03b600fc7` | 4.5 | notes |
| `070890fc77a2` | 6.0 | living |
| `09fde54aa1df` | 6.4 | notes |
| `0c5a4da9c512` | 6.6 | notes |
| `0c8b0dc63766` | 6.4 | notes |
| `0dec37ff5ad9` | 6.2 | living |
| `0e8ec5729a7b` | 6.1 | living |
| `124f5aa8c8bd` | 6.0 | living |
| `12dae69813f6` | 6.1 | living |
| `1415f271058e` | 6.6 | notes |
| `14b62cd5aeec` | 6.3 | living |
| `1a9d81ca552c` | 4.8 | provenance |
| `1be57a100d59` | 6.4 | notes |
| `1fc8ed7adfd7` | 6.4 | notes |
| `252025cfcddc` | 6.2 | living |
| `26787be1b8b4` | 6.1 | living |
| `276822231c52` | 6.4 | notes |
| `288aee2e3501` | 3.2 | living |
| `2a90ecca8005` | 6.6 | notes |
| `2bddcc69ca83` | 0.0 | notes |
| `2c4e125866cc` | 6.6 | notes |
| `316669459d67` | 6.2 | living+notes |
| `3187ea18c625` | 6.2 | living |
| `345f4193d440` | 5.9 | notes |
| `39ac0253d3ca` | 5.3 | provenance |
| `3ac8810a59af` | 6.8 | notes |
| `3b30a88ffa23` | 6.6 | notes |
| `3c5e1b1dd284` | 6.4 | notes |
| `3f9830acc467` | 6.4 | notes |
| `482e8f5ca701` | 6.9 | brief+notes |
| `4c79682a3115` | 0.0 | notes |
| `4e5c7b3400de` | 5.9 | living |
| `52e0e7effbd6` | 6.1 | living |
| `5381b07ea2fa` | 6.6 | notes |
| `53e3e90dce8d` | 6.2 | living |
| `57679ef9a4a3` | 6.4 | living+notes |
| `5a7bd8a8178a` | 6.7 | provenance+notes |
| `5e0853311131` | 5.1 | provenance |
| `5f3f7141227c` | 5.9 | provenance+living |
| `6155acc0fb26` | 4.5 | provenance |
| `6272fa445b73` | 5.7 | provenance |
| `688e696f00c8` | 6.3 | living |
| `68c90b3b9f17` | 6.1 | living |
| `705ead2014b2` | 6.0 | living |
| `72e361e1bd44` | 3.3 | provenance |
| `7489a6cc064d` | 6.7 | notes |
| `74be319d02fa` | 7.0 | brief+notes |
| `791c9fd873f3` | 6.4 | provenance+notes |
| `7c6716f23df6` | 6.6 | notes |
| `7f012a9afe01` | 6.6 | notes |
| `7fc604e5bc44` | 5.5 | notes |
| `7ffc58da8ef8` | 6.2 | living |
| `830350135192` | 6.4 | notes |
| `862624c9826e` | 6.1 | living |
| `8a4140de3eaa` | 7.0 | provenance+brief+living+notes |
| `8ac9c4d888f1` | 6.8 | notes |
| `8ad06030e129` | 6.2 | living |
| `957c638ba6e5` | 4.7 | provenance |
| `978ca8fe72c9` | 4.8 | provenance |
| `9b449a41c865` | 6.2 | living |
| `9c7e1f2710eb` | 6.8 | notes |
| `9d5f49299dd9` | 6.0 | living |
| `a18431d6dbe2` | 6.1 | living |
| `a1c7dcd5696b` | 7.0 | provenance+brief+notes |
| `a31d271995e3` | 6.4 | notes |
| `a63f0f139f37` | 4.0 | provenance |
| `a81663f17c0c` | 4.5 | provenance |
| `a985300cb8ed` | 6.3 | living |
| `aa7b80f9a038` | 6.4 | notes |
| `ab22bc503717` | 6.4 | notes |
| `ae608567e8a8` | 6.2 | living |
| `b43a2fea0cb1` | 6.1 | living |
| `b45e6b257029` | 6.1 | living |
| `bc99dcc268ce` | 6.5 | notes |
| `c28ad0815782` | 6.4 | notes |
| `cde6cb10daa7` | 6.1 | living |
| `ce34d0a89f01` | 6.9 | brief+notes |
| `d9e551ed0d5a` | 6.3 | living |
| `db248fe67a5e` | 6.3 | living |
| `e129bca605e3` | 5.9 | living |
| `e8f7c7dba595` | 6.0 | living |
| `ea3fead04c70` | 6.7 | notes |
| `eb46032d332c` | 6.6 | notes |
| `f0f10cd06861` | 6.5 | notes |
| `f30bf025ae28` | 6.9 | notes |
| `f3504e5f88d6` | 6.2 | living |
| `f6ecf4222048` | 6.7 | notes |
| `f6f44b329132` | 6.6 | notes |
| `f933a01b792a` | 6.1 | living |
| `fa835f7a4939` | 6.5 | notes |
| `fb0058fb5702` | 6.5 | living+notes |
| `ffc11ac41a26` | 6.9 | brief+notes |

## 4. The two scanner defects blocking publish

**Registry: done.** `engine/docs_scan.js` `struckClaims`: inside `~~…~~` it blanks the denominator of
`A of B` / `A out of B` and the `n` of a sample before reading the figures. A bare struck count and a struck
numerator still register. Four new `RETRACTION_CASES` were added. The two denominator/sample cases **failed
on the old code** (the registry held 1069 and 3903 and caught the statement) and **hold after**. The two
controls hold both times. The live registry drops `3903` (RUNNING-NOTES:1072, a struck `n 3,903`); the rest
is unchanged (`35.9%, 71.6%, 1205, 7971`).

**The six hits: done, in the live documents only.**

- `14.757%` (white paper, technical docs, MODELS, and the MEASURE ledger) was charged by the unique-owner
  route. No artifact held it, so MAG's `weights[55]` = 0.14757 was its only owner. The real source is the
  frozen open-sheet store. `engine/human_protect_ruler.js` now keeps it in `data/human-protect-ruler.json`:
  13,214 games in file, 8,388 kept (bots and forfeits dropped, which is the predicate the published ruler
  used), 190,954 clicks, 28,179 protect-family, 14.757%. That matches the 2026-09-05 counts to the digit, and
  the ruler refuses to write on any mismatch. The family comes from `data/tags.json` `shieldsUser`.
  provenance reads the artifact as `ok`, and quarantine does not withhold it. Each paragraph gained one
  sentence citing the ruler. The sentence holds no figure, so no existing sentence's grandfather key moved.
- **One caveat on 14.757%.** The documents write "on 185,422 scored human clicks … humans did 14.757%". The
  ruler reproduces 14.757% on all 190,954 kept clicks. The 185,422 subset could not be rebuilt here: the
  body-to-sheet match gave 190,192, which reads 14.754% if the report's filter was the same. The citation
  binds the whole-corpus rate, which is what the ruler holds.
- `49.3%` (white paper, technical docs, MODELS) was charged by the citation route: the paragraph mentions
  `data/policy-weights.json` ("was not written"), and a MAG weight reads 0.4928. The share is 474 / 961, from
  the empirical run of 5.243.0. `data/verification/game-differential.empirical.json` is the same run, but the
  scanner's citation regex does not see sub-directories, so the binding is the pinned blob CHANGELOG 5.243.0
  published, `a347d6d0:data/game-differential.json`. That blob holds 474 and 961, release `8ad06030e129`, the
  empirical driver, and 77 board-material. `quarantinedFigures` now clears a percent that equals A / B at the
  document's precision for an `A of B` in the same paragraph, when a NON-withheld source there carries both
  counts. A commit-pinned blob counts as a source; a pin into a withheld artifact's history does not. The
  proof is in `tests/test-docs-quarantine.js`: three REDs (no source; a quotable file lacking both counts; a
  pin into a withheld history) and one GREEN. The GREEN failed before the scanner extension and passes after.
- **Red then green on the real documents**, using a scratch index of HEAD versus HEAD plus these edits, with
  the scanner run in index mode. At HEAD the seven keys fire: 4 × `14.757%` including the MEASURE ledger, and
  3 × `49.3%`. After the edits none fire. The test printed exactly those 7 under "DELETE these lines", and
  they are deleted from `BASELINE` with a dated note.
- **The technical docs and MODELS are Will's held drafts in the working tree.** Their edits were made on
  HEAD's blob and put in the index with `git update-index --cacheinfo`. The working copies were not touched.

**Also found red and fixed:** `tests/test-docs-quarantine.js` failed at HEAD, in a clean worktree, on
`docs/ROADMAP.md` #129 stating the leaf-engine contrast's sample size, which is withheld. The figure is
withdrawn from the row, and the quarantined number is not written anywhere.

## 5. SUMMARY's "64 games of 1,995"

**Bound, not struck.** The source exists: `f038cdb3:data/wire-ladder.json` (commit 3.64.0, WIRE 7), 11 arms at
1,995 games each. Wire 7 has 64 of 1,995 agreeing completely and the baseline has 6. The first-divergence line
goes from mean 14.83 to 27.75, p90 from 30 to 89, and median from 13 to 16, with 1 median completed turn
throughout. Every figure in the paragraph matches. The file on disk (`46bc7943`, 14 arms at 1,997) does not.

The paragraph's citation is now the pinned blob. **A second defect was hiding the binding:** the next line
began `#81 WIRE 7`, and `paragraphs()` treats any line starting with `#` as a heading. That split the
citation away from the figures. The line was rewrapped so that `ROADMAP #81` stays together. With no
grandfather set, the figures read `unbound` before the pin and `paragraph` (bound) after.
`tests/test-docs-current.js --staged` retired 9 grandfather keys, and the test itself tightened
`data/docs-currency-baseline.json`.

**The edit is on HEAD's text only**: HEAD blob → edit → `git hash-object -w` → `git update-index --cacheinfo`.
The working-copy draft differs from HEAD and was not touched. The 7.0.0 draft needs the same pin and rewrap.

## OWED, NOT RUN

```bash
# nothing here was committed or pushed; the coordinator commits the staged set
node engine/provenance.js        # after the commit: the living-arm UNSAFE on 8a4140de3eaa should clear
node tests/run-all.js            # not run (light mode)
```

- The held 7.0.0 drafts need the same edits. That is Will's call when he publishes. SUMMARY needs the
  `f038cdb3` wire-ladder pin and the `ROADMAP #81` rewrap. The white paper, technical docs and MODELS need the
  ruler sentence beside 14.757% and the `a347d6d0` pin beside `474 of 961 (49.3%)`.
- The other 318 cited releases (the 414 minus the 96) are not staged. They are cited only by data artifacts,
  verification files, logs, ledgers or reports, and whether to track them is the coordinator's call.
- Not caused here and not fixed: `engine/provenance.js` exits 1 (230 UNSAFE, including the ratchet on the
  `_diag*` files), and `status.js` still prints REFIT OWED on the feature fixture.
- `paragraphs()` treating a line that starts with `#81` as a heading is a scanner quirk that can split any
  paragraph. It was worked around here by rewrapping one line, and it is not fixed.
