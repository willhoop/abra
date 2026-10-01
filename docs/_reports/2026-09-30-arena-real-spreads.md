# The offline arena fields real per-set spreads (Reg M-C, open sheets) — 2026-09-30

Will's call ("3"), 2026-09-30. SOLVER. Branch `worktree-agent-aa3e1f7d8b7668b41`. Line `abra/regmc`, **Unreleased**
(the basis changes, so the rule makes this a MAJOR. 2.0.0 is proposed and is the coordinator's to cut).

## Verdict

- **Done.** Every arena game now plays `role-v1` by default: `solver/rotom/spreads.js`'s rule per set, the spreads
  ROTOM fields on the ladder. This covers self-play (`mew/run.js`, `mew/play.js`), MACHAMP gates and SPRTs
  (`machamp/gate.js`, `machamp/sprt.js`), `arena/arena.js`, and CHOMP's targeted games (`chomp/v1/gen.js`). There is
  one source (`solver/arena/spread_source.js`), one stat path (`solver/xatu/worlds.js` `applySpread`) and one table
  (`solver/arena/spreads/role-v1.json`, 14,247 sets).
- **Parity with the ladder holds.** For every set ROTOM plays, the arena body's stat line equals what ROTOM fields:
  60 of 60 rotation rows. Choice Scarf sets are at their maximum Speed (4 of 4) and Trick Room sets at their minimum
  (2 of 2). `solver/tests/test-arena-spreads.js` GREEN 15/15, and it went RED on both deliberate breaks.
- **Versioned, not silent.** Modes: `role-v1` (default), `xatu-random` (the old honest truth, byte-identical) and
  `flat` (the old omniscient and `arena.js` body, byte-identical). Every match line, self-play record, shard summary,
  gate, SPRT and arena artifact records the mode, the table's sha256 and a digest of the spreads it fielded.
- **Cost, as Will accepted.** No arena figure measured before this change can be compared with one measured after it.
  The list is in §8, and the re-run commands are under OWED.
- **One engine finding, filed and not fixed.** The mega swap cannot recompute a spread that invests HP. 114 of 3,293
  role-v1 mega sets land one point off after mega evolution, 23 of them on Speed (`docs/ENGINE.md`, top entry).

## 1. Where an arena body gets its stats (before this change)

The stat line is laid in two places: `solver/arena/teams.js` `buildBody` and `solver/xatu/worlds.js` `applySpread`.

- **`buildBody(M, row)`** calls `M.buildMon(species, {})`. That is the engine table's line for the species
  (`data/engine-data-regmc.js` `st`), with no spread and no nature. Then it lays on the sheet's moves, item and
  ability. Every caller below starts here.
- **`applySpread(m, sp, row)`** computes `M.spreadL50(bs, sp, nature)` for the five battle stats and adds the SP to
  HP. It stamps `_nature` and not `_sp` (see §6).

Every path that builds a body for a game:

| Path | Body before this change | Now |
|---|---|---|
| `arena/arena.js` (both sides) | `buildTeam` → flat | `--spreads`, default role-v1 |
| `mew/play.js` `--info omniscient` (self-play default) | flat | `--spreads`, default role-v1 |
| `mew/play.js` `--info honest` (match default: gates, SPRTs) | flat, then `truthSpreads` (a random XATU spread) | `--spreads`, default role-v1. `xatu-random` is the old truth, unchanged |
| `mew/run.js`, `machamp/gate.js`, `machamp/sprt.js` | fork `play.js` | pass `--spreads` and record it |
| `chomp/v1/gen.js` (CHOMP's targeted games) | flat | `--spreads`, default role-v1, in its own directory |
| `machamp/deep_value.js`, `porygon2/v1/replay.js` (exact replay of self-play) | flat | the record's own mode (none recorded = flat) |
| `bench/*`, `porygon2/bench.js` | flat | the process default (role-v1, or env `ARENA_SPREADS`) |
| `miltank/rollout.js` hidden redraws (a searcher reading the true battle) | flat | same mode as the truth under omniscient and in `arena.js` (`bodyBuilder`) |
| `xatu/worlds.js` honest view and worlds | zero SP under the nature, then a spread drawn from XATU's belief | unchanged (the belief is not the truth) |
| `rotom/world.js` (live) | mine: the request's exact stats; theirs: flat, then XATU's belief under gen5 | unchanged (ladder code, out of scope) |
| `chomp/score.js`, `refine.js`, `v1/features.js`, `v2/features.js`, PORYGON2 features, `doduo/eval_gates.js`, `miltank/eval_kl_human.js` | flat or a spread table (model internals) | unchanged. These are model beliefs, not the arena's truth |

**Where the sheets enter.**
- The human dataset, `solver/out/human/games.jsonl` in the main checkout (498 MB), is read through `teams.js`
  `loadGames` by `arena.js` and `chomp/plan.js`.
- The frozen team pool, `data/team-pool-frozen-regmc/games.bo3.jsonl` (sha256 `a68263bb…`), is read through
  `mew/pairs.js` `loadStore` by self-play, gates, SPRTs and `chomp/v1/gen.js`.
- Neither carries Stat Points: the store's `evs` is null on every slot.

## 2. What changed

- **`solver/arena/spread_source.js`** (new): `open(mode, { M })` returns a source with `spreadsFor(G, seed)`,
  `dress(team, rows, evs)`, `bodyBuilder(buildBody)` and `stamp()`.
  - role-v1 reads the table and refuses to open if `solver/rotom/spreads.js`'s rule text has changed since the table
    was built. A new rule is a new version, never a silent mix.
  - A set the table lacks is derived at play time by the same rule against the same population and COUNTED
    (`derived_at_play`). A set that cannot be derived stays flat and is COUNTED (`flat_fallback`).
  - `mergeStamps()` turns shard stamps into one block and warns on a mixed run, on any derived or flat fallback, and
    on zero bodies dressed.
- **`teams.js` `buildTeam(M, G, side, { spreads, seed, spreadsFor })`**: the default is the process default
  (role-v1, or env `ARENA_SPREADS`).
  - Buildability checks (`loadGames`, `mew/pairs.js`) pass `{ spreads: 'flat' }`: whether a body builds does not
    depend on its spread, and a check must not derive one.
  - Both sides of a game share one draw, so both seatings of a pair play the same bodies.
- **Flags and records.**
  - `--spreads` on `arena.js`, `mew/play.js`, `mew/run.js`, `machamp/gate.js`, `machamp/sprt.js`, `chomp/plan.js`
    and `chomp/v1/gen.js`.
  - Recorded in `flags.spreads`, `preregistered.spreads` (SPRT), a `spreads` block (table file and sha256, rule
    sha256, population and store sha256, counters and the fielded digest), on every match line, and on every
    self-play record.
  - A CHOMP plan now records `spreads`. `arena.js --plan` plays the plan's own mode, and a plan written before this
    change re-plays `flat`.
- **`chomp/v1/gen.js`** writes each mode's games to its own directory (flat keeps `gen/`) and throws on a mixed file,
  because a restart resumes from the finished jobs on disk.
- **`chomp/v2/spreads.js` `table()`** also reads the arena table's encoding, so a CHOMP v2 spread arm can use the one
  source.

## 3. The spread table (`solver/arena/spreads/role-v1.json`)

- **Built by** `solver/arena/build_spreads.js` on release `eaa5becc54eb`: plan (108 s), three workers (idle priority,
  about 23 min each, 0 failures), then merge. Tracked: 1.47 MB, plus `population-role-v1.json` at 174 KB.
- **The rule** is `solver/rotom/spreads.js` `Deriver`, inherited unchanged. Its two table oracles are read from
  MEDICHAM through CHOMP v2's `MediDeriver` (0.25–0.4 s a set, against the Showdown oracle's ~34 s). The OBSERVED hook
  is pinned off for role-v1. Smogon's Reg M-C files (due about 2026-10-04) will be a new version.
- **The population is the ladder's**: the store the rotations were spread from, `fe78202a` (restored with
  `git show 27825c32:data/games.gen9championsvgc2026regmcbo3.jsonl.gz`). Floor 1410, 150 teams, 900 slots, speed
  median 138 and top tier 172, the same as the rotations' recorded benchmark.
- **The sets.**
  - 14,247 in total: frozen-pool pairs (all splits) 9,576, human-dataset eligible games 4,627 more, rotation sets 44.
  - Roles: other 10,620, fast 1,909, Trick Room 1,718.
- **Agreement with the Showdown oracle.**
  - Rotation sets: 56 of 60 rows identical. That is 43 of 44 distinct sets. Speed is identical on all of them.
  - The one differing set is Raichu (Lightning Rod, Timid, Raichunite Y): recorded `22/0/2/10/0/32`, MEDICHAM oracle
    `22/0/0/12/0/32`. The cause: the MEDICHAM oracle calls `dmgRange` on an Aegislash (Stance Change) attacker in its
    Shield forme, where the Showdown oracle's move preparation turns it to Blade forme first (best hit 111 against
    172). The bulk share sits at the median threshold (0.502 against 0.501), so it flips.
  - **Every set the ladder plays takes the ladder's recorded spread** (1 override, named in the provenance), or the
    parity the arena exists for would fail by construction.
  - Stride sample of 20 non-rotation sets: 19 identical and Speed 20 of 20. The differing set is Milotic (Competitive,
    Calm): `21/0/1/32/0/12` against `14/0/7/32/1/12`. It is not diagnosed and is owed.
  - Overall: 2 of 64 checked sets differ, both only in the bulk split. Speed agreed on all 64.

## 4. Tests

- **`solver/tests/test-arena-spreads.js`** (new): GREEN 15/15.
  - RULE:
    - every table spread is within the validator's total (66) and the cap (32);
    - the table carries the current rule text;
    - the default is role-v1, and flat and xatu-random still exist.
  - PARITY:
    - the arena body equals ROTOM's fielded line (`xatu/sd.js` `statValue`, all six stats, HP included) on 60 of 60
      rotation rows;
    - Choice Scarf sets are at their maximum Speed, 4 of 4;
    - Trick Room sets are at their minimum Speed, 2 of 2;
    - `flat` still builds the table line with no nature, 60 of 60.
  - RECORD: a 1-pair match through `play.js` shows role-v1 with no flag, stamps the table sha256 and a fielded digest,
    and dresses all 16 bodies. `--spreads flat` dresses 0, and `--spreads xatu-random` dresses 16. Each is on every
    line.
  - RED: `SPREADS_SOURCE_BREAK=scarf` (a Scarf set's Speed moved to HP) turned PARITY red, and
    `SPREADS_SOURCE_BREAK=stamp` (the block says flat whatever was fielded) turned RECORD red.
- **Re-run, all GREEN:**
  - `test-arena` (seat break red);
  - `test-machamp` (every break red);
  - `test-honest-info` 1954/1954 (its MATCH clause now plays role-v1 truth, 16 bodies);
  - `test-arena-release` 17/17 with `ARENA_TEST_RELEASE=eaa5becc54eb` (no live engine byte opened; live break red);
  - `test-rotom-spreads` 27/27, `test-chomp2` 30/30, `test-mega-rate` (nevermega red), `test-gates` (break red).
- The frozen pool was hard-linked into the worktree (`ln`, sha256 checked against `pool-receipt.json`), as the
  rotation runbook says.

## 5. Smoke (12 games, then stopped)

- `arena.js --x miltank --y prior --games 6 --budget 300 --cap 20 --seed 1 --blind`
  → `solver/out/arena/smoke/arena-miltank-prior-g6-rolev1.json`.
  - `flags.spreads` role-v1, table sha256 `946fa9c4…`, fielded 34 sets.
  - 72 bodies dressed: 48 fielded, the rest in the searcher's redrawn worlds.
  - 0 derived at play time, 0 flat, 0 errors, 0 warnings.
- `machamp/gate.js --x gen5 --y human-clone --pairs 3 --seed 30990 --workers 1 --team-store data/team-pool-frozen-regmc`
  (honest) → `solver/out/arena/smoke/gate-gen5-vs-clone-p3-rolev1.json`.
  - `flags.spreads` role-v1, and role-v1 on every line.
  - 48 bodies dressed, 0 derived, 0 errors, 0 warnings.
- The scores are not figures. They are 6 games each and are not reported.

## 6. Filed to ENGINE (not fixed)

- `megaEvolveNow` recomputes a mega's line from `_sp` only when `l50(base, _sp, _nature)` reproduces the current
  line, HP included. `l50` has no HP term, so an HP-invested body always takes the delta path.
- That path can be one point off on a natured stat. Of the 3,293 role-v1 mega sets, 3,185 invest HP, and **114** land
  off the authority's line: Atk 70, Speed 23, SpA 14, SpD 6, Def 1 (`solver/out/arena/spreads/mega_delta.js`,
  arithmetic from the release's `spreadL50` against `statValue`).
- The honest arena's xatu-random truth and ROTOM's world already took the same path.
- Asked of ENGINE: accept an HP-invested spread in the recompute check. SOLVER then stamps `_sp` in `applySpread`.

## 7. Version

- **Is an arena figure's basis a PUBLISHED figure's basis? Not today, by the letter of the rule.** CLAUDE.md reads
  the published figures as the white paper, the deck, `docs/SUMMARY.md` and `docs/MODELS.md`. `docs/MODELS.md` says
  MILTANK strength is WITHHELD, PRE-GATE, and it carries no post-gate arena figure. None of the four documents quotes
  a gen5, CHOMP v1, PORYGON2 or piKL arena result.
- Those results live in the notes backlog owed to the next major, and in the working ledger `docs/SOLVER.md`.
- **What the change does:** it moves the basis of the series that the next major will publish. A reader of that
  pass cannot be told that a pre-change arena figure and a post-change one answer the same question.
- **As the brief asks, the row declares `**Basis.** CHANGED`.** Under clause 5d that means whatever version this row
  is cut as must be an `X.0.0`.
- **Proposed: abra/regmc 2.0.0, cut as the next document pass.** In that pass MODELS.md and the white paper first
  publish arena figures, each labelled with its spread mode.
- If the coordinator would rather cut a MINOR now, the row's `Basis.` must be reworded to "unchanged: no published
  figure moves; the arena series in the notes backlog starts over at role-v1". That is also defensible, and it is the
  coordinator's call, not this agent's.
- Nothing is bumped here. The CHANGELOG entry and the notes row are `[Unreleased]`, and clause 5d cannot judge an
  unreleased row.

## 8. Arena figures that are now NOT comparable with new ones

These were measured on the old bodies. Each stays true of that arena and is re-runnable with `--spreads flat`
(omniscient, `arena.js`) or `--spreads xatu-random` (honest). None is retracted.

- **Honest (xatu-random truth), release `eaa5becc54eb`:**
  - gen5 vs the clone at 1 s and 5 s (`solver/results/2026-09-26-gen5-honest/`, H1, 0.71 and 0.71);
  - PORYGON2 v1 vs the clone and vs gen5, and r1 vs gen5 (`2026-09-26-porygon2-v1/`, `2026-09-29-porygon2-v1-r1/`);
  - the protect-overuse gates and SPRT;
  - the tiered SPRTs;
  - the adaptive-clock SPRT and screens;
  - **CHOMP v1's SPRT** (`2026-09-27-chomp-v1/`, H1, 0.561);
  - the protect-repeat gates and SPRT;
  - the 14 s lookahead screen;
  - the double-Protect gate;
  - the piKL phase-B screens (1.48.0);
  - the two SPRTs another agent is running now on `main`'s code.
- **Omniscient (flat), release `eaa5becc54eb`:**
  - the 2026-09-25 MACHAMP gates and SPRTs;
  - **gen5's acceptance SPRT** (H1 at +20 after 1,268 games) and the gen1–gen5 gates;
  - the champion-vs-DODUO SPRTs (`2026-09-26-champ-vs-doduo/`);
  - every self-play corpus (`solver/out/selfplay/eaa5becc54eb/*`) and what was fitted on it (DODUO and PORYGON2
    self-play halves, deep-value labels);
  - CHOMP v1's targeted games (T1) and so **CHOMP v2's gate (a)**;
  - every `arena.js` figure.
- **Not affected:**
  - store-only models (the human dataset, MAG and DODUO fits on humans, XATU's bring model);
  - ladder figures (ROTOM already fields role spreads);
  - bench timing figures (their bodies change, but they measure speed, not strength). Their recorded default is now
    role-v1.

## OWED, NOT RUN

Nothing below was run. Each needs a free game slot. The SPRTs are pre-registered here with elo0 0, elo1 20,
alpha = beta = 0.05, max 2,000 games, 3 workers, the frozen pool and release `eaa5becc54eb`. They keep the old seeds,
so the team pairs and battle seeds match the old runs pair for pair.

1. **gen5 baselines, honest, role-v1** (the ladder-facing figures):
   ```
   cmd.exe /c tools\lownode.cmd solver\machamp\sprt.js --release eaa5becc54eb --x solver/machamp/league/gen5.json --y solver/machamp/league/human-clone.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 26001 --workers 3 --info honest --spreads role-v1 --team-store data/team-pool-frozen-regmc --out solver/out/spreads-v1/sprt-gen5-1s-honest-rolev1.json
   cmd.exe /c tools\lownode.cmd solver\machamp\sprt.js --release eaa5becc54eb --x solver/results/2026-09-26-champ-vs-doduo/gen5-5s.json --y solver/machamp/league/human-clone.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 26005 --workers 3 --info honest --spreads role-v1 --team-store data/team-pool-frozen-regmc --out solver/out/spreads-v1/sprt-gen5-5s-honest-rolev1.json
   ```
2. **gen5 against its predecessor under the new bodies** (a new question, not a re-read of the acceptance):
   ```
   cmd.exe /c tools\lownode.cmd solver\machamp\sprt.js --release eaa5becc54eb --x solver/machamp/league/gen5.json --y solver/machamp/league/gen0-r2.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 30001 --workers 3 --info honest --spreads role-v1 --team-store data/team-pool-frozen-regmc --out solver/out/spreads-v1/sprt-gen5-vs-gen0r2-rolev1.json
   ```
3. **CHOMP v2's gate (a) with a spread arm.** The T1 data must first be played at the spreads the arm describes:
   ```
   node solver/chomp/v1/gen.js --release eaa5becc54eb --team-store data/team-pool-frozen-regmc --shard K --shards 3 --spreads role-v1     (K = 0, 1, 2; writes solver/out/chomp/v1/gen/role-v1/)
   ```
   Then:
   - (a) `chomp/v1/build_rows.js` reads `solver/out/chomp/v1/gen/games-*.jsonl` by a fixed path. It needs a
     `--gen-dir` flag (owed code) to read `gen/role-v1/`.
   - (b) T2 wants a self-play corpus at role-v1:
     `cmd.exe /c tools\lownode.cmd solver\mew\run.js --release eaa5becc54eb --league solver/machamp/league/gen5.json --games 1600 --seed 301 --workers 3 --team-store data/team-pool-frozen-regmc --spreads role-v1 --out solver/out/selfplay/eaa5becc54eb/r5-rolev1`.
   - (c) `chomp/v2/build_rows.js ... --spreads solver/arena/spreads/role-v1.json`, then
     `python solver/chomp/v2/train.py --rows <those rows>`.
   - (d) A pre-registration addendum is due before any fit, because the data changed.
4. **Engine:** the HP-invested mega recompute (§6). After it lands, SOLVER stamps `_sp` in `applySpread` and re-checks
   `test-honest-info` STATS and `test-arena-spreads` PARITY.
5. **The two oracle disagreements.**
   - The Stance Change staging in `chomp/v2/spreads.js` `MediDeriver` is a SOLVER staging gap. The engine plays the
     forme change in battle.
   - The Milotic difference is not diagnosed.
   - A larger agreement sample (the Showdown oracle at ~34 s a set) would size the gap.
6. `node engine/status.js --write` from the main checkout after merge (not run from this worktree).
7. **The version cut:** proposed abra/regmc 2.0.0, with the document pass (MODELS, the white paper) stating the spread
   mode of every published arena figure. This is the coordinator's call.
