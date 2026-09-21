# Reg M-C usage model — the file CHOMP reads, per regulation (MEASURE, abra/regmc 0.23.0)

Dated findings record. Not maintained, not current state. Every figure below is read from
`data/meta-usage-regmc.json` as generated at 2026-09-21T22:16:23Z, or from the command named beside it.
**No figure here goes into a living document**: Reg M-C publishes nothing until its gate opens.

## 0. Verdict

- **File:** `data/meta-usage-regmc.json`, written by `node engine/analyze.js --regulation regmc` (or
  `ABRA_REGULATION=regmc`). `analyze.js` dispatches to the new `engine/usage_regulation.js` whenever a
  non-owner regulation is selected; the path comes from `engine/regulation.js artifactFor`, which now
  declares `meta-usage.json` per regulation.
- **Live stores, not the frozen pool.** Counted over the tracked Reg M-C `.jsonl.gz` stores, with the
  pool's own predicate (now one module, `engine/regmc_pool_predicate.js`, used by the cutter too) and
  then the shared quality filter. Digests stamped as `source_digests`.
- **Reg M-B unmoved, proven twice.** The committed `data/meta-usage.json` is not modified (git blob
  `0bf8515ee1cd`). HEAD's `analyze.js` and this commit's, run on the same Reg M-B store, write
  byte-identical models (sha256 `6ab4767210af…` both) and byte-identical stdout, and that model is the
  committed file modulo the CRLF checkout.
- **Illegal entities: 0 in any published table.** 23 species in the corpus fail legality (strict filter
  and the validator, `isNonstandard: 'Past'`, "does not exist in Gen 9"), 69 team-preview slots across
  24 games, all in the bo1 ladder store and all closed-sheet. None reaches a table (each is below the
  n >= 8 floor) and none is in the competitive view. Items 161, abilities 188, moves 476: all legal.
- **CHOMP needs three things** (§5): the path, its species table re-sourced from Reg M-C's, and its
  own format constants. It must not be changed from here.

## 1. Live versus frozen — the decision and why

**Live.** The frozen pool (`data/team-pool-frozen-regmc/`, digest `792daded918f`) exists because a
MEASUREMENT of MEDICHAM must read the same games on every run; two differential runs an hour apart on
the live store ask two different questions. A usage model is not a measurement of the simulator. It
describes what people are bringing, which is what CHOMP consumes, and the pool was cut at
2026-09-21 01:24 UTC — every Reg M-C game after it would be invisible to CHOMP for as long as the pool
stays frozen, which is the whole M-C build.

What is kept from the pool is its POPULATION: the same predicate, read from the same module. What
replaces its reproducibility is the stamp: the stores read are the tracked `.jsonl.gz` blobs the
collector commits, their full sha256 is in `source_digests`, so `engine/provenance.js` reports the model
stale the moment the store moves, and the exact bytes are recoverable from git.

| store read | sha256 (12) | bytes | lines = unique games |
|---|---|---|---|
| `data/games.gen9championsvgc2026regmcbo3.jsonl.gz` | `cb8f9d640a4d` | 25,701,271 | 25,415 |
| `data/games.gen9championsvgc2026regmc.jsonl.gz` | `ca604ff5ae39` | 26,789,831 | 35,324 |

**The plain file is never read.** The main tree carries stale plain `data/games.gen9championsvgc2026regmc*.jsonl`
snapshots beside the `.gz` (docs/REGMC.md, "One thing found on the way"); `engine/quality.js` prefers
the plain file when both exist. `usage_regulation.js` names the `.gz` explicitly and records any plain
sibling as `plain_file_beside_not_read` (none in the worktree).

## 2. The filter, step by step (per store)

Step 1 is the format token (`engine/durable-ingest.js storeFormatFor`, the parser that stamped the rows;
`activeStoreFormat()` is now that function applied to `active`). Step 2 is the pool predicate. Step 3 is
`data/quality-filter.json` 1.6.0 through `engine/quality.js reasons()`, cumulative exactly as `funnel()`
counts it.

| step | bo3 | ladder (bo1) |
|---|---|---|
| collected | 25,415 | 35,324 |
| other regulation token | 0 | 0 |
| excluded: not open sheet | 0 | 33,858 |
| excluded: the Eject Button conjunction | 335 | 28 |
| **after the pool predicate** | **25,080** | **1,438** |
| after bot names | 24,919 | 1,438 |
| after behavioural bots | 24,655 | 1,408 |
| after forfeit before any action | 24,497 | 1,406 |
| after min turns | 22,940 | 1,345 |
| after full bring | 17,031 | 990 |
| legality / corrupt winner / nonstandard / custom ruleset | 17,031 | 990 |
| **competitive (clean)** | **17,031** | **990** |

Competitive view: **18,021 games, 36,042 teams.** Ladder view (every Reg M-C row in both stores,
closed sheets included, name-flagged bot sides not counted — Reg M-B's ladder view does the same):
**60,739 games, 117,567 teams.**

Three judgements, each stated in the artifact:

- **The quality filter is applied on top of the pool predicate.** The brief named the pool's filter.
  The pool's predicate is about SCOPE (open sheets) and a MECHANIC (the Eject Button rule); it has no
  opinion about bots, forfeits or partial brings, which is what makes a bring or win rate mean
  something. Reg M-B's competitive view applies those rules, so without them the two files would carry
  the same field names over different definitions. The pool-predicate-only count is in the funnel
  (`after_pool_predicate`) for anyone who wants the literal reading.
- **The full-bring rule is the biggest cut: 7,735 bo3 games (30.8% of the post-predicate bo3 set).**
  `brought` records only what was revealed, so a game that ended before the fourth came in would
  understate bring rates. Same rule and same reason as Reg M-B.
- **Two rules are published as NOT ASKED.** `illegal_team` keys on `data/store-validation.json` and
  `custom_ruleset` on `data/custom-ruleset-ids.json`; both were computed over Reg M-B's store only and
  cannot match a Reg M-C id. They are run, remove nothing, and are listed under
  `provenance.not_asked_of_this_regulation` rather than shown as a clean zero. The legality audit (§4)
  stands in for the first; the Reg M-C custom-rule question is open and is Will's (docs/REGMC.md).
- **The behavioural-bot rule is Reg M-B's, not re-validated here.** It removed 12 accounts (294 games).
  Its evidence was measured on the bo1 ladder; on a bo3 open-sheet ladder a human playing one team for
  50+ games is more plausible. The accounts are listed in the artifact.

## 3. The top of the table (competitive view)

| # | species | team % | bring % | lead % | win % | n |
|---|---|---|---|---|---|---|
| 1 | rillaboom | 53.7 | 69.8 | 24.7 | 51.0 | 19348 |
| 2 | sneasler | 44.8 | 71.6 | 37.7 | 49.6 | 16163 |
| 3 | salamence | 35.6 | 56.2 | 33.6 | 49.8 | 12816 |
| 4 | incineroar | 32.5 | 75.6 | 39.3 | 51.3 | 11723 |
| 5 | kingambit | 26.4 | 69.3 | 31.4 | 51.7 | 9518 |
| 6 | gholdengo | 23.8 | 69.8 | 34.0 | 51.9 | 8593 |
| 7 | basculegion | 21.1 | 69.3 | 23.4 | 50.8 | 7609 |
| 8 | indeedeef | 19.5 | 82.1 | 46.6 | 49.5 | 7026 |
| 9 | arcaninehisui | 16.8 | 76.0 | 32.7 | 51.4 | 6064 |
| 10 | floetteeternal | 15.4 | 45.2 | 29.3 | 51.8 | 5551 |
| 11 | raichu | 15.1 | 63.6 | 47.3 | 51.7 | 5456 |
| 12 | farigiraf | 14.5 | 68.9 | 40.4 | 50.6 | 5212 |
| 13 | garchomp | 14.3 | 64.4 | 32.6 | 47.8 | 5169 |
| 14 | golisopod | 13.8 | 58.9 | 26.0 | 46.3 | 4984 |
| 15 | milotic | 13.4 | 59.4 | 35.6 | 50.1 | 4841 |

214 species in the competitive table, 281 in the ladder table (n >= 8, the floor Reg M-B uses). Species
ids are the store's (`indeedeef`, `arcaninehisui`), exactly as in Reg M-B's file.

**New in the file, not in Reg M-B's:** `sets` — per species in the competitive table, the items,
abilities and moves its open sheets declared, with rate = sheets carrying it / sheets of that species,
names from the format. Counted over the same sides `usage()` counts. The file is 455 KB.

## 4. Legality

Every species in any team preview of either store, and every item, ability and move on any open sheet
of either store — a superset of everything the file publishes — is checked against the Reg M-C format
on the Reg M-C checkout: the strict filter, then the TeamValidator for anything it rejects (a real sheet
where one exists, up to five tried; a constructed set where none does).

| class | distinct | strict-legal | re-admitted by the validator | illegal | in a published table |
|---|---|---|---|---|---|
| species | 325 | 302 | 0 | 23 | 0 |
| item | 161 | 161 | 0 | 0 | 0 |
| ability | 188 | 188 | 0 | 0 | 0 |
| move | 476 | 476 | 0 | 0 | 0 |

- **The 23 are contamination and are not dropped.** Every one is `isNonstandard: 'Past'`, and the
  validator rejects a constructed set with "does not exist in Gen 9". They occupy 69 team-preview slots
  across 24 distinct games, every game in the bo1 ladder store and every game closed-sheet — no real
  sheet carries any of them, which is why the fixture had to be constructed. They are custom-rule rooms
  by their shape; the raw logs that would prove it are not on disk for most of this store (docs/REGMC.md).
  The ids and the game ids are in `legality.illegal` in the artifact; they are not named here
  (CLAUDE.md: no entity outside the regulation is named).
- **Effect on the published numbers.** None on the competitive view (none of the 24 games is open-sheet).
  In the ladder view the 24 games are counted — as Reg M-B's ladder view counts everything — and their
  illegal species are below the table floor.
- **The Future-flag trap did not fire.** No entity was re-admitted by the validator: the one Reg M-C
  ability the strict filter drops (docs/REGMC.md, "the trap that will bite first") is on no stored sheet,
  or it passes the strict filter here. Printed on every run, so a later appearance is visible.

## 5. What CHOMP needs to read the Reg M-C file (read-only survey; CHOMP not changed)

CHOMP reads the usage model in exactly one place: `CHOMP/build/build_v2_userscript.py` lines 40-43,
`_metap = ../ABRA/data/meta-usage.json`, embedded as `CHOMP_META`; line 86 reads only `threats[]`
(`sp`, `bringRate`, `leadRate`, `teamRate`) into `METAB`, keyed by CHOMP's species key.

1. **The path.** Point `_metap` at `data/meta-usage-regmc.json` (or select by regulation). The shape it
   reads is identical: top-level `threats` with the same four fields. Nothing else changes for that line.
2. **The species table.** `METAB[k]` is looked up by CHOMP's own species keys, which come from
   `CHOMP/data/champ-dex.json`, vendored by `CHOMP/build/refresh_dex_from_abra.js` from ABRA's
   **`data/engine-data.js` — Reg M-B's table.** 46 of the 214 Reg M-C competitive species are absent from
   it, including ranks 1, 3, 8, 9 and 10 above. `metaBring()` returns 0 for an absent key without a
   warning, so the new file alone would leave CHOMP blind to the top of the new meta. The refresh needs to
   read `data/engine-data-regmc.js`.
3. **Its format constants.** `CHOMP/engine/champ-model.js` names Reg M-B (`FORMAT.name`,
   `pikalyticsSlug: 'battledataregmbs3'`), carries a Reg M-B item-pool rule (line 391), and the
   userscript header and `CHOMP/data/champions-legal-moves.json` are Reg M-B's. Reg M-C's item list is
   different (items came back from `Past`; docs/REGMC.md), so a Reg M-C CHOMP also needs its legality
   inputs re-derived from the M-C format.
4. `CHOMP/data/PROVENANCE.md` still describes `meta-usage.json` as built by `build/meta-ingest.js`; that is
   stale independently of this change.

## 6. Reg M-B unmoved — the evidence

- `git status`: `data/meta-usage.json` not modified; `git hash-object` = `git rev-parse HEAD:data/meta-usage.json`
  = `0bf8515ee1cd`.
- HEAD's `engine/analyze.js` (copied from `git show HEAD:`) and this commit's, each run from its own
  scratch cwd on `C:/Users/willj/Projects/Pokemon/ABRA/data/games.ladder.jsonl` (read-only): models
  sha256 `6ab4767210af2601…` and `6ab4767210af2601…`; stdout identical; the model equals the committed
  file after stripping the CRLF checkout (`diff --strip-trailing-cr`, no output). `quality filter: 28454
  usable of 94360 collected` in both.
- The refactors under it: `usage()`/`view()` moved verbatim to `engine/usage_table.js`;
  `activeStoreFormat()` is `storeFormatFor()` applied to `active` (still returns `champions-regmb`);
  `analyze.js` reads the first positional argument as the store, so `--regulation` is no longer taken as a
  store path. The cutter's dry run (`engine/cut_regmc_pool.js --no-validate`) prints identical output with
  the predicate moved into `engine/regmc_pool_predicate.js` and at HEAD, apart from its elapsed-time line.
- Refusal shown: in a scratch root holding the engine files and `data/regulations.json` but no stores,
  `node engine/analyze.js --regulation regmc` exits 1 with "data/games.gen9championsvgc2026regmcbo3.jsonl.gz
  is absent" and writes nothing.

## 7. Found on the way

- **The differential's severity ranking read Reg M-B usage under Reg M-C.** `engine/game_differential.js`
  reads `data/meta-usage.json` LIVE to rank bodies; `meta-usage.json` was declared NOT YET per-regulation
  in `tests/test-regulation-artifacts.js` with the reason "engine/analyze.js has its own regulation
  handling" — which it did not. Declaring it per-regulation fixes the reader too: under Reg M-C it now
  reads the sibling. It is reporting (the severity ladder), not a gate clause.
- **`engine/provenance.js` attributes the new file correctly** (`by` declared in the artifact) and still
  attributes `data/meta-usage.json` to `engine/analyze.js` by its write line. Adding a file under `data/`
  moves Reg M-B's gate inventory count by one (the known REGULATION-ROTATION row; not fixed here).
- **This agent's worktree guard refuses `cmd /c`**, so `tools/lownode.cmd` could not be invoked. Heavy runs
  used an in-process equivalent: `os.setPriority(PRIORITY_BELOW_NORMAL)` then `require` the script, which
  keeps the exit code.
