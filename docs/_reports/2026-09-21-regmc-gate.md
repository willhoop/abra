# 2026-09-21 — the MEDICHAM gate answers per regulation (MEASURE, abra/regmc 0.16.0)

Historical findings record. Not maintained; `node engine/quarantine.js [--regulation <id>]` is the state.

## Verdict

- Every artifact the gate reads, and every one its instruments write, now resolves per regulation.
  Reg M-B keeps its exact paths; any other regulation reads and writes a `-<id>` sibling
  (`data/game-differential.json` → `data/game-differential-regmc.json`,
  `data/roster.items.json` → `data/roster.items-regmc.json`, pool `data/team-pool-frozen-regmc`).
- Reg M-B's gate is byte-identical apart from its new first line (§2).
- Reg M-C's lattice is **1200 / 1600 / 1900**, re-derived on its own pool (§3). Reg M-B's sizes do not
  transfer: on the Reg M-C pool 1350 and 1950 share 902 picks.
- The Reg M-C gate reads **CLOSED, 9 of 9 gating clauses fail**: eight are NO ARTIFACT / CANNOT-ANSWER,
  one (board leaves) is a measurement. No Reg M-C figure is published.

## 1. What changed

### `engine/regulation.js` — the artifact seam

- `ARTIFACT_OWNER = 'regmb'` (the literal the file already carries for its fallback). **The unsuffixed
  names belong to Reg M-B for ever, not to whichever regulation is `active`.** If ownership followed
  `active`, flipping the config to Reg M-C would make every M-C reader read M-B's evidence as its own.
- `PER_REGULATION_ARTIFACTS` — patterns over the `data/` basename, each with its writer:
  `game-differential(.g<N>)?.json`, `divergence-turns.json`, `engine-diff.json`,
  `roster(.<stage>)?(.prev)?.json`, `all-mechanics-fire(.boardstate)?.json`, `mechanics-census.json`,
  `engine-release.json`, `published-samples.json`, `whole-game-baseline.json`, `quarantine-stamp.json`,
  `decision-impact.json`, `register-reality.json`, `click-counts.json`, `sheet-usage.json`,
  `diff-team-pool.json`, `diff-swarm.json`. Plus the frozen pool directory.
- `artifactFor(rel)` — the one answer: `fileFor` (the three engine files) first, then the sibling rule.
  Identity under Reg M-B. The sibling name is `-<id>` before the final extension, which is the name
  `engine/engine_release.js` already gave its per-regulation pointer.
- **The fs seam.** Under a non-owner regulation, reads and writes of a live-tree `data/<declared>` are
  answered by the sibling (`readFileSync`, `existsSync`, `statSync`, `writeFileSync`, `appendFileSync`,
  `renameSync`, `copyFileSync`, `createRead/WriteStream`, `openSync`, `unlinkSync`, `rmSync`, the
  promise forms). Same argument as the table's `require` seam: a dozen instruments build these paths as
  `D('data', '<name>')`, one of them 19,000 lines and ENGINE's; a seam serves all of them and anything
  written tomorrow, with no reader edited. **A missing sibling is ENOENT, never a fall-through to Reg M-B's
  file**, so every clause reports NO ARTIFACT by construction.
- **Deny by default.** Under a non-owner regulation, a write / append / truncate / unlink / rename /
  copy onto ANY existing file under the live `data/` whose path does not name the regulation is REFUSED
  — so an artifact nobody declared is protected anyway. New files are allowed; `data/releases/` is exempt
  (content-addressed). The engine's three files keep ENGINE's refusal and its wording.
- Nothing is installed under Reg M-B.

### `engine/quarantine.js`

- `D` resolves through `artifactFor`, spelled `D('data', '<name>')` exactly as before so
  `gateInputArtifacts` still derives the gate's reads from the source.
- Messages and re-run commands name the regulation's files and prefix `ABRA_REGULATION=<id>`
  (identity under Reg M-B).
- `LATTICE_GAMES` per regulation; `LATTICE_SAMPLES` derived from it (first size keeps the plain name).
  A regulation with no row → both lattice clauses CANNOT-ANSWER.
- New coherence rule: a sample pinned to another regulation's pool is INCOHERENT.
- **Behaviour change, both regulations:** the open-defect clause used to PASS when
  `register-reality.json` was absent ("0 verdict(s) read"). The first Reg M-C run passed it on a register
  nobody had run. Absent verdicts now read CANNOT-ANSWER. Reg M-B has the file, so its output is unchanged.
- First stdout line: `REGULATION: <id> (<format>) — artifacts ..., pool ...` (was blank).

### `engine/lattice_walk.js` (new)

The 2026-09-12 walk, made repeatable. Calls the shipping `diff_swarm.buildSwarm(max(games*2,18))`,
keys picks `config|team.key`, prints the overlap table and a greedy proposal (`--anchor`, `--from`,
`--to`, `--greedy k`). Plays no game.

### `tests/test-regulation-artifacts.js` (new, 30 checks)

1. The per-regulation list against the gate's DERIVED closure (quarantine's `gateInputArtifacts` +
   `instrumentsOfTheGate` over provenance.js's graph). Every member is per-regulation, an engine
   per-regulation file, or declared NOT YET with owner and reason; every GATE INPUT must be per-regulation;
   stale declarations fail.
2. Mapping in both directions (M-C: all move, lattice all `-regmc`; M-B: nothing moves, lattice is
   exactly the three historic files).
3. The seam in a throwaway root (a copy of `engine/regulation.js` + `data/regulations.json`), with a
   Reg M-B control arm that must write straight through.
4. The gate's first line.

**NOT YET per-regulation (write-guarded only), 13:** `ability-blocks.json`, `abra-tags.js`,
`fixture-legality-baseline.json`, `joint-click-census.json`, `mega-dex-official.json`, `mega-dex.json`,
`meta-usage.json`, `move-effects.js`, `move-priors.json`, `regulations.json`, `residual-order.json`,
`rollout-switch-census.json`, `smogon-priors.json`. All engine/steering inputs; none is read by a clause.

## 2. Reg M-B unmoved — proof

Same worktree, before (HEAD) and after, `tools\lownode.cmd` for every run:

```
$ diff q-head.txt q-after3.txt          # node engine/quarantine.js
1c1
<
---
> REGULATION: regmb (gen9championsvgc2026regmb) — artifacts data/<name>.<ext>, pool data/team-pool-frozen
(stderr identical)
```

`--selftest` (380 passed, 0 failed), `--graph`, `--whole-game`, `--narration`, `--order-probe`: stdout and
stderr byte-identical to HEAD. `git status` shows no tracked `data/` change at any point.

**One transient that was caught and removed:** the first draft of the test spelled Reg M-B's file names
next to `writeFileSync` in its sandbox probe. `engine/provenance.js` attributes a writer by name near a
data/-rooted write verb, so the test became the recorded writer of `data/game-differential.json` and the
gate's closure moved under it. Names in the test are now assembled (`J('game-differential')`); the graph
was re-derived and credits the test with nothing. Also seen once: `--graph`'s artifact count read two
higher while my own pool caches (`data/diff-team-pool*.json`, gitignored, created by the walk) sat in the
worktree; deleted, count back to HEAD's.

**Worktree caveat.** In this worktree the Reg M-B `game differential` clause reads MEASURED AGAINST A
DIFFERENT ENGINE because release manifests are untracked and absent here. That is identical before and
after and is not a gate verdict. `engine/status.js --write` and `engine/provenance.js --strict` were not run.

Tests: `test-regulation-table` 24/0, `test-mc-key` 21/0, `test-engine-release` 80/0, `test-docs-current`
green, `test-regulation-runtime` 35/0, `test-regulation-artifacts` 30/0, `test-no-silent-failure` no new,
`test-provenance-discovery` all clear, `test-docs-quarantine` passed, `test-next-regulation` green.

### Every new guard shown RED first

| break | result |
|---|---|
| A. `installArtifactSeam()` not called | 13 FAIL — every seam probe, "byte-for-byte untouched", counters |
| B. roster pattern removed from `PER_REGULATION_ARTIFACTS` | 3 FAIL — UNDECLARED roster.*, SHARED GATE INPUTS roster.*, M-C roster names unmoved |
| C. `regmc` row removed from `LATTICE_GAMES` | FAIL — "the gate reads a declared lattice" (`[]`) |
| D. absent register verdicts | M-C gate before the fix: `PASS no open, known engine defect ... (0 verdict(s) read)`; after: CANNOT ANSWER |

All restored; the suite is 30/0.

## 3. The lattice, re-derived for Reg M-C

**Control — the tool reproduces 2026-09-12 exactly** on Reg M-B's frozen pool (8,778 distinct teams),
anchors 1200,1350: 1250 → 2045 picks / 958 / 745 / 49.5 % new; 1950 → 3069 / 669 / 713 / 72.1 %;
2400 → 3669 / 1631 shared with 1200; 3000 → 4467 / 842 / 879 / 75.4 %. Greedy within `--to 2000`
proposes **1950**, the size chosen by hand. So the rule is: base 1200, then greedy within 1250..2000.

**Reg M-C** (`data/team-pool-frozen-regmc`, pool digest in FROZEN.md `792daded918f`; the loader counts
11,608 distinct teams, matching FROZEN.md):

```
node engine/lattice_walk.js --regulation regmc --team-store <main>/data/team-pool-frozen-regmc \
     --anchor 1200 --from 1250 --to 2000 --step 50 --greedy 2
```

| `--games` | picks | shared w/1200 | % new vs 1200 |
|---|---|---|---|
| 1200 | 1940 | — | — |
| 1250 | 2017 | 928 | 54.0 |
| 1350 | 2178 | 708 | 67.5 |
| 1600 | 2563 | 690 | 73.1 |
| 1700 | 2717 | 579 | 78.7 |
| 1900 | 3032 | 594 | 80.4 |
| 1950 | 3109 | 609 | 80.4 |
| 2000 | 3186 | 668 | 79.0 |

Greedy step 1: **1900** (80.4 %, tie with 1950 → smaller run). Step 2: **1600** (1757 of 2563 = 68.6 %
drawn by neither 1200 nor 1900).

**Chosen: 1200 / 1600 / 1900.** Pairwise (config, team) picks shared:

| pair | shared | picks |
|---|---|---|
| 1200 vs 1600 | 690 | 1940 / 2563 |
| 1200 vs 1900 | 594 | 1940 / 3032 |
| 1600 vs 1900 | 624 | 2563 / 3032 |

**Reg M-B's sizes on the Reg M-C pool, for comparison:** 1200 vs 1350: 708; 1200 vs 1950: 609;
**1350 vs 1950: 902** — worse than any pair above, which is why they were not carried over.

These are pick overlaps, a property of pool + builder. Played-game overlap is only measurable after the
three runs exist.

## 4. What the Reg M-C gate reads today

`node engine/quarantine.js --regulation regmc` (worktree): `GATE: CLOSED — 9 of 9 GATING clauses fail`.

| clause | reading |
|---|---|
| game differential | NO ARTIFACT — `data/engine-diff-regmc.json` |
| roster items / abilities / moves | NO ARTIFACT — none of `data/roster.<stage>-regmc.json`, `roster.all-regmc.json`, `roster-regmc.json` |
| coverage | CANNOT ANSWER — `click-counts-regmc.json`, `mechanics-census-regmc.json` absent |
| board leaves | **measured:** 2 leaves legal under Reg M-C can stand at a turn boundary uncompared — `volatile:glaiverush`, `volatile:octolock`. Code fact, not a published figure. Route: ENGINE. |
| whole-game BOARD (lattice) | CANNOT ANSWER — all three `-regmc` samples missing |
| whole-game NARRATION (lattice, reporting) | CANNOT ANSWER |
| mechanics | NO ARTIFACT — `all-mechanics-fire-regmc.json` |
| open defect | CANNOT ANSWER — no `register-reality-regmc.json` (was PASS before this change) |

### End-to-end, on a real instrument (not a figure)

1. `game_differential.js --regulation regmc --steering empirical --games 6 --team-store <M-C pool> --write`
   **refused to run**: `steering: cannot read the selection input ... data/mechanics-census-regmc.json`.
   Before this change it would have steered Reg M-C off Reg M-B's census. It also auto-cut a release and
   wrote the pointer to `data/engine-release-regmc.json` (engine_release's own naming).
2. The same with `--census <scratch copy of the M-B census>` played 6 games and wrote
   **`data/game-differential-regmc.json`**; `data/game-differential.json` untouched (git status clean).
   `quarantine.js --regulation regmc --whole-game` then read that file and refused it: *WRONG SAMPLE IN THIS
   SLOT — records `games_requested` 6 and this slot is `--games 1200`*.
3. All four things I created (`data/game-differential-regmc.json`, `data/engine-release-regmc.json`,
   `data/diff-team-pool-regmc.json`, `data/releases/d0fed33067fd/`) were deleted afterwards.

## 5. Owed / hazards

- **`engine/game_differential.js` prints `-> data/game-differential.json` under Reg M-C** while writing
  the sibling (line ~10266 prints the literal). Not edited: it is in the driver-code digest, and a
  cosmetic edit would make the next Reg M-B regression lattice INCOMPARABLE to the published one. The
  stderr banner names the sibling. Fix at the next deliberate driver change.
- **`engine/click_counts.js` and `engine/sheet_usage.js` read Reg M-B's store names regardless of
  regulation.** Run under Reg M-C they would write Reg M-B-derived counts into the `-regmc` files. Do not
  run them for Reg M-C until they select the store by regulation.
- **Steering inputs are still Reg M-B's**: `joint-click-census.json`, `rollout-switch-census.json`
  (NOT YET list). A Reg M-C empirical run steers off Reg M-B human click behaviour until they are derived
  from the Reg M-C store.
- **No Reg M-C census exists**, so no steered Reg M-C differential can run until `tests/test-mechanics.js`
  is run under Reg M-C (ENGINE; its writer now lands on `mechanics-census-regmc.json`).
- The deny-by-default guard may refuse a legitimate Reg M-C write to an existing shared file. The error
  names the fix (declare it, and it goes to its sibling).
- `engine/regulation.js` is a release SOURCE, so this change moves the engine tree digest for the next
  cut in both regulations, as any edit to that file does. Gate output reads the pointer, not the tree, so
  nothing published moves.
- CHANGELOG-REGMC version 0.16.0 was taken while ENGINE works in another worktree; if ENGINE also took
  0.16.0 the later merge renumbers.
