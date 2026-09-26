# Changelog — ABRA on Reg M-C

<!-- LINE: id=abra/regmc; label=ABRA on Champions Reg M-C; format=gen9championsvgc2026regmc -->

All notable changes to ABRA's **Reg M-C** line are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**This is a separate version series and it starts at 0.1.0.** A leading `0` means NOT USABLE YET
(SemVer 2.0.0 clause 4). This line reaches **1.0.0 the day the Reg M-C gate opens** — computed by
`node engine/quarantine.js`, never declared by anyone.

**Reg M-B's record is `CHANGELOG.md` and is CLOSED at 7.0.0.** Nothing here renumbers it, rewrites a
released row, or moves a published figure. A version in this file is not comparable to a version in
that one: they answer different questions about different regulations. See
[`docs/REGMC.md`](docs/REGMC.md) — *The version scheme* — for what a number means and when it resets.

**Rule.** Every change is logged here in the same pass as the code, together with the matching row in
`docs/RUNNING-NOTES.md` (tagged `## [abra/regmc <version>]`). A prior conclusion is never silently
rewritten; what changed and why is stated.

---

## [1.13.0] — 2026-09-25

### Changed
- **MACHAMP's loop gains a warm-start recipe** (`solver/machamp/loop_sprt.js --recipe warm`, pre-registered in
  `solver/machamp/preregistration-warm.json` before generation 8's first game). gen6 and gen7 failed the SPRT against
  gen5 after each restarted training from MAG v1 + DODUO v1 and PORYGON2 v0. Under `warm` both nets start from the
  CURRENT CHAMPION at a smaller learning rate (DODUO 1e-4, PORYGON2 1.5e-4); the champion's own self-play carries
  sample weight 3 (`--weights` in `build_doduo.js` / `build_pory2.js`, `w.f32` read by both trainers); DODUO's pull
  to the human clone is unchanged (β 0.7, human weight 3.0) and its selection tolerance is now measured from the
  clone (`train_doduo.py --tol-ref anchor`), so drift cannot compound; PORYGON2's target stays 0.5·z + 0.5·v_deep.
  An accepted generation is pushed only after `test-machamp` and `tests/test-docs-current.js` are GREEN.

### Added
- **The search's fallback decisions are recorded and trained on.** When the table is too empty to solve (or the
  search throws) MILTANK plays the prior's top legal joint; those decisions were never written to the self-play
  record. `solver/mew/play.js` now keeps them in each game's `fallbacks` list with the played joint's DODUO cell,
  `run.js` counts them in the manifest and warns, and `build_doduo.js` keeps them as targets.
- `test-machamp` clause **FALLBACK** (a 1 ms search): fallbacks recorded, rebuilt identically, kept, and `--weights`
  written per decision. RED under the new deliberate break `MACHAMP_BREAK=fallback`. GREEN 87/87 with all nine
  deliberate breaks RED.

### Fixed
- `test-machamp`'s search budget 150 → 300 ms: under another run's load every 150 ms decision fell back, and RECORD
  went red on 0 searched decisions — the machine, not the code.

### Notes
- **Basis.** unchanged. No figure moves; generation results land as their own rows.

## [1.12.0] — 2026-09-25

### Fixed
- **ROTOM's ladder loop hung after every PRIVATE series** (both aa1 hangs, after k=3 and k=6). When an opponent
  hides the room, the server renames it `<id>-<31 chars>pw`, and `|updatesearch|` lists both ids. The client joined
  both. The old id answered `|noinit|nonexistent|`, and `rotom.js` created a series record from that line. The
  controller counted it as series k+1, it could never end, and the loop waited "series in progress" forever with no
  error. Now a `noinit`/`deinit` line never creates a record, a rename moves it, `ladder.canonRoom()` makes the old
  id an alias of the open series, and the pre-rename id is not joined. A race that could send a second `/search`
  before a matched room spoke is closed (`MATCH_JOIN_MS`).

### Added
- **Every wait in the ladder loop is bounded, with a logged recovery.** A series silent for 150 s is probed with
  `/crq roominfo`. If it is gone, or silent through 3 probes, it is orphaned: logged, counted as a ladder error, no
  row. A search older than 20 min is re-sent. A socket not logged in after 90 s is dropped and logged in again. The
  login POST times out at 30 s.
- **A supervisor hang watchdog** (`solver/rotom/watchdog.js`, `run_ladder.js --hang-min`, default 10). A client with
  no search, decision, game message or guard answer for that long, and no game open, is killed by its pid and
  resumed through the crash path. Each restart writes an incident to `supervisor-incidents.jsonl`. It never fires
  with a game open.
- `solver/tests/test-rotom-private-series.js` replays both aa1 sequences through the real client against a
  scripted local server. It is GREEN 23/23, and RED on the old code: phantom k=2, no search. A 3-series local dry
  run (`--hide-b --drill-a hang@1`) played every series in a private room, and the watchdog restarted the hung
  client once. The run gave 6 rows and 0 orphans. `docs/_reports/2026-09-25-rotom-series-hang.md`.

## [1.11.0] — 2026-09-25

### Added
- **Mega evolution is counted as a RATE, per bot, and held to a floor taken from the human rate**
  (`solver/arena/mega_rate.js`, `solver/tests/test-mega-rate.js`). "At least one mega happened" once hid a
  56% rate against the correct 85%, so the bar is now a rate. Humans mega on 0.9488 of the sides that
  could (45,952 of 48,430, `solver/out/mega/human-rate.json`). A bot fails when the upper end of its Wilson
  95% interval is under 0.9488 − 0.15. On release `eaa5becc54eb`: DODUO-greedy 0.907 pooled (185/204),
  MILTANK 0.946 (53/56), the gen5 champion 0.948 (55/58). The test is GREEN 20/20 and RED under
  `ARENA_BREAK=nevermega`.
- The same counter in every arena artifact (`mega`), in MEW/MACHAMP shard summaries (`mega.by_agent`) and in
  ROTOM's per-game record and client summary. The arena can seat a league spec, so the self-play champion
  plays as a bot.

### Fixed
- `solver/tests/test-machamp.js --release <id>` ran no clause and printed `0/0 GREEN`: with no `--only`,
  `argv[indexOf('--only') + 1]` read `argv[0]` as the clause list.

## [1.10.0] — 2026-09-25

### Changed
- **The MILTANK reserve is now 6% of the budget, clamped to 20-300 ms** (it was 3%, clamped to 150 ms). The serial
  5 s arm of 1.9.0 passed by only 74 ms. Re-measured on 400 real Reg M-C positions under the same one-core load:
  max 5,126 ms against a 5,500 ms bound, a margin of 374 ms, with 0 over and 0 fallbacks
  (`solver/results/2026-09-25-deadline/serial-b5000-n400-reserve300.json`).

### Added
- **ROTOM runs a GC between decisions** (`collectIdle()` after a MILTANK choice is sent). A request handled right
  after a GC is charged from that GC's start. It is counted as `idle_gc` in the summary. In one local bo3 set:
  24 MILTANK decisions, 24 idle GCs (max 412 ms), no decision over its budget, and 0 timeouts.
- **`--priority normal|below` on `rotom.js`**, which `run_ladder.js` passes through. It raises the deciding client
  to NORMAL, while MILTANK's pool workers stay BELOW_NORMAL. The runbook's MILTANK ladder commands use
  `--priority normal`. Account: `docs/_reports/2026-09-25-miltank-deadline.md` §7.

## [1.9.0] — 2026-09-25

### Fixed
- **A MILTANK decision now returns within its budget + 500 ms under load.** At a 5 s budget the arena had shown
  single decisions of 28 s and 39 s, and ROTOM's clock gives 55 s a turn from a 420 s bank. The cause was that the
  pool waited for every worker (`Promise.all`), while a worker read its clock only after a playout. One worker
  starved of CPU at BELOW_NORMAL therefore held the whole decision. Now: an absolute deadline with a reserve for
  the solve; no pass starts after it, in any process; the parent resolves on a timer with the passes that have
  arrived, which workers stream in 40 ms slices; late workers get a cancel and are counted; an in-flight playout is
  abandoned between turns; the solve is capped by the time left. When the table is too empty (a row with no
  playout, or under 25% of cells filled), the move is the ranking prior's top joint (DODUO in ROTOM), counted as
  `fallbackEmpty` or `fallbackSparse`. A pass now walks its cells diagonally, so a cut pass reaches every row. The
  serial path (ROTOM's) had a second cause: major GCs of 1.1-1.6 s inside a decision. `collectIdle()` runs a full
  GC between decisions. On 2,000 real Reg M-C positions per arm under an artificial load, confined to one core:
  pool max 1,004 ms at 1 s and 4,906 ms at 5 s; serial + collectIdle max 1,268 ms at 1 s and 5,426 ms at
  5 s; 0 over the bound in all four. The deliberate break (`MILTANK_DEADLINE_BREAK=1`) was run first: 73 of 300 over
  at 1 s (max 7,035 ms) and 31 of 100 over at 5 s (max 11,569 ms). Under this load the fallback fired on 65% of
  pool decisions and 30% of serial decisions at 1 s. Its strength is not measured. Account:
  `docs/_reports/2026-09-25-miltank-deadline.md`.
- ROTOM's forced-switch search no longer gives each candidate a 150 ms floor that could add up past its budget.

### Added
- `solver/bench/deadline_bench.js` and `solver/bench/cpu_burner.js`: MILTANK decision latency under a one-core
  artificial load, with every flag, code digest and burner episode in the artifact.
- `solver/tests/test-miltank-deadline.js`: BOUND, COUNTED and SEARCH clauses; it re-runs itself under the break and
  requires RED.
- Pool workers warm the Reg M-C dex at start-up (1.9 s of CPU that used to land in the first decision).
## [1.8.1] — 2026-09-25

### Added
- `solver/machamp/loop_sprt.js`: the unattended MACHAMP loop. Each generation runs gen5's recipe on pooled
  self-play and meets the pre-registered SPRT against the current champion, then publishes to main.
  Pre-registration: `solver/machamp/preregistration-loop.json`.
- `build_pory2.js --deep` takes a list of deep-value directories.

### Notes
- Tooling only; no figure is published.
- **Basis.** unchanged.

## [1.8.0] — 2026-09-25

### Added
- `solver/machamp/deep_value.js`: exact game replay, then human-clone rollouts, giving a value independent of the
  net being trained.
- `solver/machamp/sprt.js`: a pre-registered GSPRT on paired seeds, read only at the bound.
- `play.js --cycle`; `build_pory2.js --deep`; `prior_adapter.datasetActions`.
- `test-machamp` DEEP and SPRT clauses (108/108; RED on `MACHAMP_BREAK=replay` and `=sprtsign`).
- `solver/machamp/models/gen5/`.

### Notes
- **gen5 ACCEPTED**, the first accepted generation (pre-registration `solver/machamp/preregistration-r3.json`).
  Pooled data from every round, a strong DODUO anchor, and PORYGON2 trained on 0.5·z + 0.5·deep rollout value.
- **SPRT (elo0 0, elo1 +20, α = β = 0.05): H1 after 1,268 games**; gen5 against gen0 **0.528 [0.501, 0.556]**
  (670–598), Elo ≈ +19.7.
- PORYGON2 human Δ −0.0030 [−0.0057, −0.0004] PASS; against the human clone 0.660 [0.592, 0.722] PASS.
- Source: `solver/machamp/models/gen5/gates.json`. Account: `docs/_reports/2026-09-25-selfplay-v0.md` §12.
- **Basis.** unchanged.

## [1.7.0] — 2026-09-25

### Added
- **MACHAMP ablation of generation 4** (`solver/machamp/preregistration-ablation.json`, `league/abl-{A,B}.json`,
  `models/ablB/`). No new self-play.

### Notes
- **Candidate A** (DODUO frozen at gen0, gen4's PORYGON2): **0.465 [0.397, 0.534]** against the champion.
- **Candidate B** (DODUO refit with a strong pull to the human clone, β 0.7 and human weight 3.0; PORYGON2 v0):
  **0.500 [0.431, 0.569]**. Its drift from the human clone is +0.012 nats; gen4's was +0.051.
- Both were 200 games on release `eaa5becc54eb`, 1,000 ms per decision, depth 0, 3 workers.
- **Neither net detectably helps or hurts.** The hypothesis that DODUO lost the games is not confirmed.
- Next generation: keep the strong DODUO anchor, stop training PORYGON2 on its own depth-0 value, and gate with an
  SPRT or a larger n.
- Account: `docs/_reports/2026-09-25-selfplay-v0.md` §11.
- **Basis.** unchanged.

## [1.6.0] — 2026-09-25

### Added
- **MACHAMP round 2 (generations 3 and 4).** `solver/mew/pairs.js` reads the frozen team store
  (`data/team-pool-frozen-regmc`, bo3 file, pool digest `792daded918f`). Its sheet names are read back from the
  Reg M-C dex. On the 10,298 games it shares with the human dataset, it agrees with that dataset in every one.
  `--team-store` passes through `mew/run.js`, `machamp/gate.js` and `machamp/loop.js`.
- `loop.js` reads a later round's settings from its pre-registration: `solver/machamp/preregistration-r2.json`.
  The champion at the round-2 search settings is `league/gen0-r2.json`.

### Notes
- **Settings:** k 4×4, 1,000 ms per decision, depth 0, 3 workers.
- **Self-play:** 737.5 and 735.4 games/hour; 0.10% and 0.00% of cells empty (round 1: 30–41%).
- **Both candidates REJECTED:**
  - gen3: PORYGON2 human Δ −0.0025 [−0.0046, −0.0004] PASS; against the champion **0.430 [0.363, 0.499] FAIL**;
    against the human clone 0.675 [0.607, 0.736] PASS.
  - gen4: Δ −0.0010 [−0.0034, +0.0016] PASS; against the champion 0.475 [0.407, 0.544] FAIL; against the clone
    0.690 [0.623, 0.750] PASS.
  - The champion stays gen0 (as `gen0-r2`).
- DODUO moved +0.046 and +0.051 nats away from the human clone on held-out human data. It is the suspected cause
  of gen3's loss; the ablation is owed.
- Sources: `solver/machamp/models/gen{3,4}/gates.json`. Account: `docs/_reports/2026-09-25-selfplay-v0.md` §10.
- **Basis.** unchanged.

## [1.5.0] — 2026-09-25

### Added
- **MEW, the self-play factory, and MACHAMP, the training loop (v0).** `solver/mew/` (team pairs split by player,
  league agents, the worker and its coordinator) and `solver/machamp/` (DODUO and PORYGON2 builders and trainers,
  the arena gate, the loop, `preregistration.json`, the league specs and `models/gen{1,2}/`). Every game plays on
  a frozen release and is stamped with its id. Additive MILTANK options: `leafModel` (a PORYGON2 file per agent),
  `record` (the whole root), `jointCells` (each joint's DODUO cell). `solver/porygon2/build_dataset.js` takes
  `--release`.
- `solver/tests/test-machamp.js`: 95/95 GREEN; six deliberate breaks each turn it RED.

### Notes
- **Measured on release `eaa5becc54eb`**, 4 workers, MILTANK at 500 ms per decision, k 5×5, depth 0 with the
  PORYGON2 leaf:
  - Self-play ran at 1,721 and 1,943 games/hour (1,600 games per generation, 0 errors, 0 fallbacks).
  - Two candidates were trained and gated. **Both were REJECTED.**
    - PORYGON2 against v0 on held-out human log-loss: −0.0025 [−0.0053, +0.0005] and −0.0038 [−0.0062, −0.0014],
      both PASS.
    - Beats gen0 (200 games): 0.525 [0.456, 0.593] and 0.520 [0.451, 0.588], both FAIL.
    - Does not lose to the human clone: 0.560 [0.491, 0.627] and 0.490 [0.422, 0.559], both PASS.
  - The champion stays gen0.
  - The search was starved: 30–41% of matrix cells were unfilled at the clock.
- Sources: `solver/machamp/models/gen{1,2}/gates.json`, `solver/out/selfplay/eaa5becc54eb/gen{0,1}/manifest.json`.
  Account: `docs/_reports/2026-09-25-selfplay-v0.md`.
- **Basis.** unchanged. The new figures are first measurements. No published figure moves.

## [1.4.0] — 2026-09-25

### Added
- **The first post-gate solver measurements, and the ladder bot.** Eight 200-game paired matches on release
  `eaa5becc54eb` over the same 100 real Reg M-C team pairs (pool digest `9d07c522200de072`):
  MILTANK (heuristic, depth 2) vs DODUO-greedy 0.470 [0.402, 0.539] at 1 s and 0.510 [0.441, 0.578] at 5 s;
  depth 0 vs 2 at 1 s 0.540 [0.471, 0.608]; the PORYGON2 leaf vs the heuristic 0.560 [0.491, 0.627] at 1 s and
  0.505 [0.436, 0.574] at 5 s; greedy DODUO vs MAG 0.555 [0.486, 0.622], DODUO vs prior 0.580 [0.511, 0.646],
  MAG vs prior 0.595 [0.526, 0.661]. Nothing tested beats DODUO-greedy, so **DODUO-greedy is the ladder bot**,
  provisionally. MILTANK at 5 s also showed 28-39 s single decisions under load. Artifacts
  `solver/results/2026-09-25-first/`, choice in `solver/LOG.md`, account
  `docs/_reports/2026-09-25-first-solver-measurements.md`.

## [1.3.0] — 2026-09-25

### Changed
- **ROTOM replay saving and ladder mode merged into one client.** Ladder mode now calls the replay-save and
  `games.jsonl` hooks rather than keeping its own: every ladder game is saved as a replay and gets one record in the
  games file. That record also carries the series' arm, the release and the dry-run flag. The finished room is
  held until the save resolves and, in ladder mode, for up to 22 s so the series' rating lines arrive. Those lines
  now reach the ladder's series row even after the game has ended. There is one rating-line parser (`ladder.js`,
  which decodes HTML entities in the name); `replay.js` re-exports it. The own-account refusal now runs after the
  ladder guards, so a non-ladder account on `--public` hears the more specific refusal first.
- `solver/rotom/local_server.js` is now the one way to start a local server. `run_local.js`, `run_ladder.js --dry-run`
  and the new test all use it. It starts the login stand-in, the socket guard in every server process, and the
  local config. The ladder dry run now saves replays locally (`--local-replays`) to its own `<out>/games.jsonl`.

### Fixed
- **The local test server no longer tries to reach any public host.** It made 9 start-up attempts
  (`check.torproject.org` ×2, `play.pokemonshowdown.com` ×1, `pokemonshowdown.com` ×6), found with a
  stack-logging socket guard. `solver/rotom/local_server_preload.js` now sets `loginserver`, `routes.root` (the
  seasons plugin's ladder fetch) and `routes.replays` to the local stand-in. The Tor exit-list fetch has no
  config switch: it is hard-coded and runs when `server/ip-tools.ts:651` loads. It is therefore refused by name at
  `lib/net` before any socket opens. Any other public request still reaches the guard and turns the test red.

### Added
- `solver/tests/test-rotom-localnet.js`: a real local server, the guard in all 10 processes, **0 non-loopback
  attempts**, with proof that the check ran (guard in ≥5 processes, config applied, Tor fetch seen and refused).
  **Shown RED on a deliberate break** (`--break` leaves the local config out: 9 attempts, exit 1). `--run <dir>`
  runs the same check on a finished dry run.

### Notes
- Account: `docs/_reports/2026-09-25-rotom-merge.md`. No ladder game was played.
- **Basis.** unchanged. **Supersedes.** Nothing.

## [1.2.0] — 2026-09-25

### Added
- **ROTOM ladder mode, prepared and not launched.** `solver/rotom/ladder.js` searches the
  `gen9championsvgc2026regmcbo3` ladder, plays the series and repeats until a STOP file, a set count, a time cap
  or a consecutive-error halt. Each series draws its A/B arm and its rotation team from a seed that is committed
  to the run state before the first search. It logs one row per series with the arm config, the release stamp,
  both ratings before and after, `S`, `E` and `S − E`, and the fallback, invalid and timeout counts during that
  series. The two-account guard is the machine-wide lock plus `/crq userdetails willhoop` before every search
  (it pauses while willhoop is connected; a search in progress is invisible, and that gap is stated). The client
  never forfeits. The loop needs `--release` at or after `eaa5becc54eb`.
- `solver/rotom/run_ladder.js`: the supervisor and watchdog, `--stop` (graceful) and `--kill` (by recorded pid),
  and a local `--dry-run` that uses the same client code path. `solver/rotom/netguard.js` refuses every
  non-loopback connection in every process of a dry run. `solver/rotom/login_stub.js` is a local assertion
  server whose key the local server verifies.
- `solver/rotom/build_ladder_teams.js` → `solver/rotom/teams/ladder-rotation.json`: five real top teams, one
  per stable archetype in GURU's library, each passed through Showdown's TeamValidator. The client
  re-validates them at start-up.
- `solver/rotom/arms/`: `aa-miltank.json` (A/A placebo), `miltank-vs-prior.json` (SPRT pre-registered on the
  per-series residual), `dryrun-fast.json` (refused on the public ladder).
- Runbook `solver/rotom/LADDER.md`; test `solver/tests/test-rotom-ladder.js`.

### Changed
- `solver/rotom/rotom.js` loads the engine from a frozen release when `--release` is given
  (`solver/arena/engine.js`). The crash drill exits 70, not 3, because 3 means "lock held".
- `solver/rotom/lock.js` gains `readPasswordFile` (the file only, for ladder mode).
- `solver/rotom/build_assets.js` exports its spread rule, packer and validator.

### Notes
- Account: `docs/_reports/2026-09-25-rotom-ladder-mode.md`. No ladder game was played. No public host was
  contacted by the dry run.
- **Basis.** unchanged. **Supersedes.** Nothing.

## [1.1.0] — 2026-09-25

### Added
- **ROTOM saves a replay of every game and joins it to its reasoning.** At each game's `|win|`/`|tie|` the client
  sends `/savereplay`. It retries up to 4 times, 20 s each, and records the outcome in every case. It then appends
  one record to `solver/out/rotom/games.jsonl` (`--games-file`). The record holds both sheets, brings and leads,
  the result, the ratings when the server sends them, the replay URL, our copy of the battle log, and the path of
  that game's own decision log (`<out>/games/<client>/<room>.decisions.jsonl`). A restarted process saves any
  pending records again. `solver/rotom/replay.js` (the saver, and the popup parser), `report.js --games`.
- `solver/rotom/local_login.js` + `local_server_preload.js`: a local stand-in for the server's login server, so a
  local `/savereplay` stays local. Without `--local-replays` a local save is skipped and the skip is recorded.
- Test `solver/tests/test-rotom-replays.js`.

### Changed
- On a public server `rotom.js` refuses to run under any name that is not on both own-account lists
  (`solver/human/build_dataset.js`, `solver/meta/extract.js`), so our games stay out of the human data.

### Notes
- Local test, 3 bo3 sets: 8 of 8 games saved, 16 of 16 records. Account: `docs/_reports/2026-09-25-rotom-replays.md`.
  No ladder game was played.
- **Basis.** unchanged. **Supersedes.** Nothing.

## [1.0.0] — 2026-09-24

### Changed
- **MEDICHAM is certified on Reg M-C: the Reg M-C gate is OPEN, 10 of 10 clauses** (`engine/quarantine.js`, release
  `eaa5becc54eb`, census pin `123aa264f88d`, pool `data/team-pool-frozen-regmc`). This is the day this line was
  defined to reach 1.0.0 (`docs/REGMC.md`, *The version scheme*): computed by the gate, not declared.
  - Damage differential: 0/6000 at the midpoint, top, bottom and all 14 interior roll indices.
  - Deliberate roster: items 166/166, abilities 210/214 (3 announcement-only on receipts, Illusion deferred by owner),
    moves 510/511; every red demonstration caught.
  - Whole game, three team lattices (`--games` 1200/1600/1900): boards part in **0/955, 0/1266, 0/1497** games, and
    undeclared commentary-only differences are **0/955, 0/1266, 0/1497**. The narration bar is stamped at zero.
  - Every in-scope mechanic staged and compared: 0 diverge, 4,867 games, 0 threw. Coverage: all 269 moves above 25
    clicks measured. No open register row names a RED instrument.

### Notes
- **Published 2026-09-25** on Will's word ("publish"): `origin/draft/regmc-1.0.0` (`9193edf1`) merged into `main` over 0.126.0–0.128.0, tagged `abra-regmc-v1.0.0`. Account: `docs/_reports/2026-09-25-publish-1.0.0.md`.
- **Basis.** CHANGED — every artifact downstream of MEDICHAM on Reg M-C stops being withheld at once. 69 of 291
  artifacts are now RE-RUNNABLE, not current: no downstream figure measured before this release may be quoted until
  it is re-run on `eaa5becc54eb` or later.
- Illusion remains the one declared exclusion. Closed team sheets remain out of scope.
- Owed with this release: the living-document fold-in for the abra/regmc line (white paper, deck, technical docs,
  summary, models), and `docs/REGMC.md`'s masthead to 1.0.0.
- Account: `docs/_reports/2026-09-24-regmc-gate-final.md`.
- Documentation fold-in, part b (branch `docs-1.0.0-b`): `docs/ORIENTATION.md`, `docs/SUMMARY.md`, `docs/MODELS.md`,
  `docs/DIVISIONS.md`, `docs/GLOSSARY.md`, `docs/REGULATION-ROTATION.md`, `README.md` and `CLAUDE.md` describe the
  Reg M-C solver; the Reg M-B `docs/MODELS.md` is archived whole as `docs/archive/MODELS-regmb-7.0.0.md`. The SEARCH
  division is renamed SOLVER (`.claude/agents/solver.md`, `docs/SOLVER.md`). Account:
  `docs/_reports/2026-09-24-docs-refresh-b.md`.

## [0.128.0] — 2026-09-24

### Added
- **The solver arena plays on a frozen engine release.** `--release <id>` loads the API, the simulator, the damage
  table and every data file from `data/releases/<id>/` through `solver/arena/engine.js`, in the arena and in every
  pool worker (they inherit `SOLVER_RELEASE`), and stamps `REL.stamp()` into the artifact. Without it the artifact's
  first field reads `LIVE TREE — … a harness shakedown, not a result`. The artifact also digests the whole sheet pool
  (`sample.pool_sha256`) and records argv. Two greedy bots join `random`, `prior` and `miltank`: `doduo` (MAG v1 +
  DODUO v1 joint argmax) and `mag` (MAG v1 alone, factorised).
- `solver/tests/test-arena-release.js` traces every file the arena and a pool worker open and fails on any live
  engine or data byte under `--release`; a no-release control proves the tracer sees the live engine in both, and
  `ARENA_BREAK=live` (release stamped, live API played) turns it red. 17/17 on `eaa5becc54eb`.

## [0.127.0] — 2026-09-24

### Added
- **PORYGON2 v0, a value net over the Reg M-C human outcomes, and its MILTANK leaf.** `solver/porygon2/`: features,
  dataset builder, `train.py`, a hand-written Node forward pass, the leaf and a leaf-cost bench. MILTANK carries the leaf
  mode in the job (`o.leaf` / `MILTANK_LEAF=pory2`, counter `leafPory2`); the arena takes `--leaf-x/--leaf-y/--depth-x/
  --depth-y`. Merged from `worktree-agent-ade91fd3b83d5aa3c` (d5595948, c298ee69). On main: `test-porygon2` 423/423,
  `test-miltank` and `test-arena` 15/15 GREEN. Its arena matches were PRE-GATE on the live tree and are not quoted.
  `docs/_reports/2026-09-24-porygon2-v0.md`.

## [0.126.0] — 2026-09-24

### Added
- **ROTOM v0, the live client for Reg M-C bo3 — local server only.** `solver/rotom/`: the request JSON as the legality
  authority, the MEDICHAM position built from the observed log, `random` / `prior` / `miltank` policies, a clock that reads
  the rule (420/90/55/90) from the checkout, per-series memory, a two-account lock, socket- and process-kill drills. A
  non-local server is refused (exit 2) without `--public`; no `/search` is ever sent. Merged from
  `worktree-agent-aea75574da660f13b` (4163001a, 42ba3149). `solver/tests/test-rotom.js` 86/86 GREEN on main.
  Its runs were PRE-GATE and quote no win rate. `docs/_reports/2026-09-24-rotom-v0.md`.

## [0.125.0] — 2026-09-24

### Changed
- **The full Reg M-C gate re-read on the merged engine reads OPEN, 10 of 10 clauses.** Release `eaa5becc54eb`, census
  pin `123aa264f88d` (1024 live / 0 missing), pool `data/team-pool-frozen-regmc`, lattices `--games` 1200/1600/1900,
  serial through `toolslownode.cmd`. Damage differential 0/6000 at every index; roster 166/166, 210/214, 510/511;
  board-material and narration-only both 0/955, 0/1266, 0/1497; mechanics staged 0 diverge (4,867 games, 0 threw); no
  open row names a RED instrument. The narration baseline is stamped at ZERO (`data/whole-game-baseline-regmc.json`,
  0 of 955). The 1.0.0 this opens is drafted on `draft/regmc-1.0.0` and NOT published: Will reads majors first.
  `docs/_reports/2026-09-24-regmc-gate-final.md`.

## [0.124.0] — 2026-09-24

### Fixed
- **The White Herb red demonstration in the item roster aims at one line again.** 0.120.0 added `restoreStatsOwed`,
  which repeats `restoreStatsUpdate`'s `_rs` read, so the plant for `item/restores-lowered-stats` in `tests/roster.js`
  matched twice and refused to apply. The items stage then exited 1 with 166/166 rows green, and the gate's roster/items
  clause read FAIL. The plant now blanks `restoreStatsUpdate`'s own negative-stage scan, the door every caller spends
  the herb through. Re-run on release `eaa5becc54eb`: 28 of 28 anchors apply once, the rule is CAUGHT (DID-NOT-FIRE
  on `party.item`, `boosts.atk`), 166/166, exit 0.
- **The Reg M-C census is republished from the merged tree.** The committed `data/mechanics-census-regmc.json` still
  carried the Supreme Overlord row under its pre-0.118.1 label ("refuses the authority fallenundefined"), so the HEAD
  tree did not reproduce it and #442's instrument (`tests/probe_census_reproduces.js`) read RED under Reg M-C. The
  regenerated census is 1024 live / 0 missing / 1024 probed, pin `data/verification/census-pin-regmc-123aa264f88d.json`;
  the one difference is that row's label.

## [0.123.0] — 2026-09-24

### Changed
- **The three Reg M-C lattices re-read after the last three narration fixes: undeclared narration-only games 0/955,
  0/1266, 0/1497 (were 0, 2, 1); board-material 0 on all three.** Release `015ab5fd1cc1` (the tree at 0.122.0), census
  pin `ccd979c30997`, pool `data/team-pool-frozen-regmc`, `--steering empirical --arm middle --end-state`, `--games`
  1200/1600/1900, serial through `tools\lownode.cmd`. The samples are identical to 0.119.0's (955/1266/1497 played,
  the same one void game at 1200, 0 threw). All three causes were engine defects: White Herb holder order (0.120.0), a
  spent flinch missing from the residual handler list (0.121.0), and Emergency Exit's residual door (0.122.0). The
  census reads 1024 live / 0 missing after each fix. `docs/_reports/2026-09-24-narration-zero.md`.

## [0.122.0] — 2026-09-24

### Fixed
- **Emergency Exit answers a residual that takes its holder to half (Reg M-C).** The authority records
  `residualPokemon` at the residual's head (`sim/battle.ts` :2815) and, below the residual's `eachEvent('Update')`
  (:2860-2867), raises `EmergencyExit` for each body still standing that went from above half to at or below it; the
  Champions handler sets `switchFlag` and writes `-activate`, and the switch request (:2905-2911) is answered by an
  `instaswitch`. This engine counted that door (`MEDFAILS.emergencyExitOtherDoorUnmodelled`) and did nothing, so the
  harness could not place its body: Reg M-C lattice 1900, omit-spread `…2679451964 vs …2679546173` t2, a burn chip on
  Golisopod. **An engine defect, not an instrument limit** — the harness's forced-switch mirror expresses the switch
  unchanged once the engine makes it. `emergencyExitResidualDoor` now does it, below `residualUpdatePass` and above
  `refill`; declared: an exit and a refill in the same request go exits-first (`MEDFAILS.eeResidualBesideRefill`), and
  the hazard door stays counted. Knob `MEDI_EMERGENCY_EXIT_NO_RESIDUAL` (in the census `DELIBERATE_BREAK`). Probe
  `tests/probe_regmc_emergency_exit_residual.js`: RED before, GREEN after, RED under the knob, with a no-ability control.
  Census 1024 live.

## [0.121.0] — 2026-09-24

### Fixed
- **A spent flinch still stands in the residual handler list, so a speed tie heals in the authority's order (Reg M-C).**
  The authority's flinch is `duration: 1` and its `onBeforeMove` writes `cant` without removing it
  (`data/conditions.ts` flinch), so `fieldEvent('Residual')` collects it (`sim/battle.ts` :484-524) and the selection
  sort's swaps (:429-460) move a tied pair differently around it. This engine cleared `_flinch` at the `cant` and at the
  foot of the action loop, both above the residual list's build. Field case: Reg M-C lattice 1600, omit-weather
  `…2684772479 vs …2684878616` t1 — both Rillaboom at 137 (read off the authority's own residual list, a measured tie),
  the Grassy Terrain heals came out p2a-first here and p1a-first there. `_flinchHeld` now carries the volatile to the
  build. Knob `MEDI_FLINCH_GONE_AT_RESIDUAL` (in the census `DELIBERATE_BREAK`). Probe
  `tests/probe_regmc_flinch_residual_list.js`: RED before, GREEN after, RED under the knob, with a control that moves the
  flinch to the other body. The tie die is not involved: the differential pins the authority's shuffle to the identity,
  and the answer is the list's shape. Census 1024 live.

## [0.120.0] — 2026-09-24

### Fixed
- **Two White Herbs owed in one pass are spent fastest holder first (Reg M-C).** Every White Herb trigger
  (`onAnySwitchIn` at priority -2, `onAnyAfterMove`, `onAnyAfterMega`) is one handler per active holder in a list the
  authority speed-sorts (`fieldEvent` / `runEvent`, `sim/battle.ts` :484-507 and :794; `resolvePriority` :1001-1013
  gives each `speed = pokemon.speed`). `restoreStatsAll` walked `[...actA, ...actB]`, so a faster p2 holder was spent
  after a slower p1 holder. Field case: Reg M-C lattice 1600, baseline `…2681884715 vs …2681855448`, two Intimidate +
  White Herb Incineroar leads. Now the owed holders are found first and, when two or more are owed, ordered by
  `sdSpeedSortEntries` on the cached action speed (a tie goes to the shared tie die; the SwitchIn `speedOrder` tie
  rank is declared, not modelled). Knob `MEDI_HERB_SIDE_ORDER` (in the census `DELIBERATE_BREAK`). Probe
  `tests/probe_regmc_white_herb_speed_order.js`: RED before, GREEN after, RED under the knob, with a speed-swapped
  control. `tests/probe_red_demo.js`'s WIRE 11 herb reversal is re-aimed at the new first lines. Census 1024 live.

## [0.119.1] — 2026-09-24

### Changed
- **Solver merge pass closed.** `docs/SOLVER-PLAN.md` (plan version 0.2.0; still untracked, see Notes): MAG, DODUO, XATU, SLOWKING and
  MILTANK read "v1 built", and Will's 2026-09-24 decision is applied: CHOMP is the team-preview solver, rebuilt under
  `solver/chomp/` (both open sheets, a mixed strategy over the 90 bring/lead options, PORYGON2-scored, solved by
  SLOWKING); JOLTEON is CHOMP's optional pre-screen. `solver/LOG.md` records the landing. Ledgers restamped by
  `node engine/status.js --write`. Account: `docs/_reports/2026-09-24-solver-merge.md`.

### Notes
- PATCH: no figure moves. `data/provenance-stamp.json` `verified` reads 3 (was 11): the gate artifacts are stamped on
  releases the merged engine no longer matches. A gate re-read on a fresh release is owed.
- `docs/SOLVER-PLAN.md` stays untracked. Staged, it fails `tests/test-docs-current.js` on four clauses: its version
  header defaults it onto the closed abra/regmb line (floor 7.0.0), which also drags that line's owed backlog over the
  cap, and 44 of its figures carry no trace. Tracking it needs a decision: a declared pin or exemption in
  `data/docs-currency-baseline.json`, or an `abra/regmc` line with traced figures.

## [0.119.0] — 2026-09-24

### Changed
- **The three Reg M-C lattices re-read after the two narration fixes: undeclared narration-only games 0/955, 2/1266,
  1/1497 (were 3, 5, 6); board-material 0 on all three.** Release `aed9780fc4e3`, census pin `ccd979c30997`, pool
  `data/team-pool-frozen-regmc`, `--steering empirical --arm middle --end-state`, `--games` 1200/1600/1900, serial
  through `tools\lownode.cmd`. The samples are identical to 0.112.0's: 955/1266/1497 games, and the same one void game.
  Both named causes are gone from every lattice. The 3 games left are three other causes, all present in the 0.112.0
  artifacts, read from the full dumps (`data/verification/gd-regmc-narration-last-g{1600,1900}.json`):
  - White Herb order after two Intimidates. `restoreStatsAll` walks the holders in side order; the authority
    speed-sorts them.
  - A Grassy Terrain residual heal order on an inferred speed tie.
  - The Emergency Exit "stopped emitting" game, whose placement the harness cannot express.
  The Reg M-C census, re-run on this tree, reads 1024 live / 0 missing (parked at
  `data/verification/mechanics-census-regmc-narration-last.json`; the committed census stays the pin).
  `docs/_reports/2026-09-24-narration-last.md`.

### Notes
- **Re-proved on main at merge (engine with the memo and lean mode).** Pinned Reg M-C `--games 1200` (census pin
  `ccd979c30997`, frozen pool), release `7403f5d61204` (before) against `21d6c31b6ab1` (after): the same 955 games,
  protocol divergences 3 -> 0, board partings 0 -> 0, 952 rows byte-identical and 3 with a changed stream. Both probes
  green; `MEDI_REVIVE_HEAL_INLINE=1` exits 1. Branch `worktree-agent-aa8012f2866b8d4dc` (91230995).

## [0.118.1] — 2026-09-24

### Fixed
- **Two Supreme Overlord census rows now expect the authority's `fallenundefined` at zero.** Both rows asserted the
  refusal that 0.117.0 withdrew: "closes its fallen marker on the way OUT" and "A Supreme Overlord that DIES closes its
  marker too". So the census read 1022 live, 2 missing, on the 0.117.0 and 0.118.0 engines. The zero arms now require
  the `-end … fallenundefined|[silent]` line: above the incoming `|switch|` on the way out, and directly below the
  `|faint|` on a death. The first row's label says so. `tests/test-mechanics.js --regulation regmc` reads 1024 live,
  0 missing, 1024 probed. This belongs to cause 2 (0.117.0); it is a separate commit only because the history was not
  rewritten.

## [0.118.0] — 2026-09-24

### Fixed
- **Revival Blessing revives below the Update pass, so the reviver's Leppa Berry is eaten first (Reg M-C).** The move
  only raises a switch request: runAction's tail runs `eachEvent('Update')` and then `makeRequest('switch')`
  (`sim/battle.ts:2860-2911`, M-C checkout), and the revive is the answer's `revivalblessing` action (order 6,
  `:2781-2798`), which writes the `-heal`. The move's one PP is spent as it runs, so a held Leppa Berry is eaten between
  the move and the heal. The engine revived inside the move. Now the move checks the revive can happen (`reviveReady`)
  and queues it; `reviveApplyPending` runs it right below the next `_updateAll()`. Knob `MEDI_REVIVE_HEAL_INLINE` (in
  `DELIBERATE_BREAK`). Probe `tests/probe_regmc_revive_leppa_order.js`: RED before (release `098d7fdf95bc`, all three
  arms), GREEN after (`aed9780fc4e3`), RED under the knob. `probe_regmc_revive`, `probe_regmc_revive_residual_inactive`,
  `probe_regmc_revival_blessing`, `test-revive-mirror` and `test-precharge-order` stay green. Field case: the third Reg
  M-C narration game at `--games 1200`. Revival Blessing is `Past` in Reg M-B, so the path is not reached there.

## [0.117.0] — 2026-09-24

### Fixed
- **Supreme Overlord closes with `fallenundefined` when nothing had fallen, as the authority does (both regulations).**
  `supremeoverlord.onEnd` writes `fallen${this.effectState.fallen}` unguarded while its `onStart` assigns the count only
  when `side.totalFainted` is non-zero (`data/abilities.ts:4730-4750`, M-C checkout; the Champions mod does not override
  it). So a body that entered on nobody fallen writes `|-end|<body>|fallenundefined|[silent]` at its switch-out and
  below its `|faint|`. The engine had refused that line as the authority's typo; the bar is now to match the authority.
  One function, `fallenCloseField`, feeds both close sites; the entry line is unchanged (onStart writes nothing at zero).
  Knob `MEDI_FALLEN_UNDEFINED_SILENT` (in `DELIBERATE_BREAK`). Probe `tests/probe_fallen_undefined.js`: RED before
  (Reg M-C release `11a681c6a683`, 3 assertions), GREEN after (Reg M-C `098d7fdf95bc`, Reg M-B `4e3411cbe0b9`), RED under
  the knob in both. Field cases: 2 of the 3 Reg M-C narration games at `--games 1200`
  (`data/verification/gd-regmc-merged-dump.json`). Reg M-B's `AUTHORITY-WRONG` declaration of the same line in
  `engine/quarantine.js` now covers nothing; it is left for MEASURE to withdraw.

## [0.116.1] — 2026-09-24

### Added
- **Re-proved on main at merge.** Pinned Reg M-C differential at `--games 1200` (census pin `ccd979c30997`, frozen pool),
  release `eff9468cefc0` (main before) against `7403f5d61204` (after): 955 of 955 `MEDI_SAMPLE_DUMP` rows identical.
  `solver/tests/test-lean-mode.js --release 7403f5d61204` PASS: 22,283 lattice turns and 2,518 human-sheet turns equal,
  red on `MEDI_LEAN_BREAK=1`. Merged from `worktree-agent-a48f2802cb3153322` (9fa55fa5); its cherry-picks of the memo
  and the four playout-speed commits resolved to main's bytes (0.112.2, 0.115.0, 0.116.0).
- **Lean mode for search playouts (Reg M-C solver; the engine code serves both regulations).**
  `engine/medicham_api.js` `newBattle(a, b, {lean: true, rng})` and `makeLean(S)` build a battle whose every turn runs
  inside the engine's new `leanRun`. For that turn, tag questions are answered from a per-battle lookup table
  (`engine/tags.js` `leanView()`: the same answers, no `ASKED`/`COUNT` counting), `MEDSEEN`/`MEDFAILS` are rebound to
  a discarded sink, a trace sink is refused, the event-address log is not written, and four pieces of work whose only
  reader is a counter are skipped. An attack action's price (`d`, `acc`, a valuation no turn step reads) is `null`.
  Nothing that decides order was touched: the Update speed re-sort, every speed read that feeds a sort, `volSeqSync`
  and the residual handler sort run as in a full battle (Will's constraint, 2026-09-24).
- **MILTANK's playouts are lean.** `solver/miltank/rollout.js` makes each playout's own copy lean and runs the playout
  under `API.leanRun`; `MILTANK_LEAN=0` plays full. The solver files come from branch `playout-speed` (four commits,
  cherry-picked unchanged).
- **`solver/tests/test-lean-mode.js`** holds lean BOARD-identical to full on the Reg M-C `--games 1200` lattice (through
  `tests/medicham_api_diffhook.js` `MEDI_API_HOOK=lean`) and on human-dataset sheets, and must go red on
  `MEDI_LEAN_BREAK=1` (a lean turn skips Leftovers' heal).

### Changed
- **The turn's entry is a thin door.** `battleTurn` now only delegates (scope, then lean) to `battleTurnBody`, so a
  battle built by the solver API no longer enters the ~22,000-line body twice a turn. Same bytes.

### Notes
- **No figure moves, so this is a PATCH.** Non-lean plays the same bytes as main: the pinned `game_differential.js` (`--steering empirical --arm middle --end-state --games 1200`, one census pin and one frozen pool per regulation, `MEDI_SAMPLE_DUMP` per game) matches base per game, 955 of 955 on Reg M-C (releases `318ccd937118` base, `1886fadf0679` patch) and 961 of 961 on Reg M-B (`d9d69d58ef31`, `4f4dd1005ade`), and each artifact matches outside the two fields that name the engine. Lean against full: every game of the Reg M-C `--games 1200` lattice (955 games, the hooked run's fingerprint equal to the plain run's), 22,283 turns, every board and every per-stream draw equal to a full copy's (`solver/tests/test-lean-mode.js`); 300 human-sheet games, 2,518 turns, every board, every per-stream draw count and every winner equal. `MEDI_LEAN_BREAK=1` turns both red.
- **Speed**, lean against full in one process on the same turns, paired blocks of main-thread CPU: per turn 1.18x to 1.35x (block medians over three runs; whole-run 1.22x to 1.33x), per MILTANK playout 1.25x to 1.33x (block medians; whole-run 1.17x to 1.41x), with the cell values hashed equal.
  Full account: `docs/_reports/2026-09-24-lean-mode.md`.

## [0.116.0] — 2026-09-24

### Changed
- **MILTANK playouts: a worker-process pool and cheaper playouts.** Prepared-world copies, unwrapped dice, one shared
  pass (`solver/miltank/cells.js`), and a worker pool (`solver/miltank/pool.js`) that is bit-identical to serial at a
  pass cap. Cut-short passes start at golden-ratio offsets, so the pool no longer leaves 34.8% of cells empty at 1 s.
  Benches under `solver/bench/`. Tests on main: `test-playout-speed` 1,184/1,184, `test-miltank` 3,414/3,414,
  `test-arena` 15/15, `test-slowking` 1,559/1,559. The arena re-run is PRE-GATE, so no strength figure is published
  here; see `docs/_reports/2026-09-24-playout-speed.md`. Merged from branch `playout-speed` (eaf93368).

### Notes
- MINOR: solver-only change. No ABRA published figure moves, and MEDICHAM is untouched.

## [0.115.0] — 2026-09-24

### Added
- **Solver SLOWKING v1 (RM+ and exact LP), MILTANK v1 search skeleton and the offline arena.** Code
  `solver/slowking/`, `solver/miltank/`, `solver/arena/`. Tests on main: `test-slowking` 1,559/1,559,
  `test-miltank` 3,414/3,414, `test-arena` 15/15. The arena result is PRE-GATE (MEDICHAM's gate is not open), so no
  strength figure is published here; see `docs/_reports/2026-09-24-slowking-miltank-arena.md`. Merged from branch
  `worktree-agent-a849abbf8c6348200` (562dc055).

### Notes
- MINOR: new solver capability. No ABRA published figure moves.
- The branch carried a cherry-pick of the solver API commit (43053310), which main already held as 8ae6561a (0.87.0,
  merged at 0.95.0). Every file that commit touched was resolved to main's bytes, so the merge adds no engine,
  test or ledger change and no duplicate 0.87.0 entry.

## [0.114.0] — 2026-09-24

### Added
- **Solver XATU v1: back-two and Stat Point belief under open team sheets.** Code `solver/xatu/`; model
  `solver/xatu/model/bring-v1.json` (10 KB), tracked. On 10,942 held-out sides, turn-1 log-loss on the true back
  pair is 1.348 against 1.792 uniform, and the true bring is never ruled out (0 of 10,942), per
  `docs/_reports/2026-09-24-xatu-v1.md`. Tests on main: `test-xatu-api` 6,335, `test-xatu-bring` 33,
  `test-xatu-sd` 584, `test-xatu-selfplay` 6, all passed. Merged from branch `worktree-agent-aae6baa63246ab32f`
  (d9be8073).

### Notes
- MINOR: new solver capability. No ABRA published figure moves, and MEDICHAM is untouched.

## [0.113.0] — 2026-09-24

### Added
- **Solver MAG v1 (per-slot scorer) and DODUO v1 (joint coordinator), successors to the human policy prior v0.**
  Code `solver/mag/`; models `solver/mag/model/mag-v1.json` (1.5 MB) and `doduo-v1.json` (0.5 MB), tracked. On the
  held-out test players (25,477 exact joints), DODUO joint log-loss is 2.730 (95% CI 2.699–2.761) against v0's
  2.921, read from `solver/mag/model/mag-doduo-v1.metrics.json`. The node forward pass matches Python to 2.1e-14.
  `solver/tests/test-mag-doduo.js` GREEN 3,826/3,826 on main. Merged from branch
  `worktree-agent-ae26f145ebead8fac` (76883f3f). Report `docs/_reports/2026-09-24-mag-doduo-v1.md`.

### Notes
- MINOR: new solver capability. No ABRA published figure moves, and MEDICHAM is untouched.

## [0.112.2] — 2026-09-24

### Changed
- **A simulated turn costs less CPU, and every game plays the same bytes (both regulations).** On every
  `param`/`has`/`tagsFor` lookup, `engine/tags.js` `norm()` ran a lower-case-and-strip regex, and a turn makes
  hundreds of these lookups. `volSeqSync` calls `engine/medicham2-browser.js` `_shadowId()` up to seven times per
  body per Update pass, mostly on an empty field. Both functions are pure. Each now caches a string by value and
  answers `''` at once for a falsy input. Any other input takes the original expression. In a paired in-process
  A/B on main-thread CPU, turns per CPU-second rose 8% to 17% over five runs in both regulations. Both arms of
  each run played the same turns.

### Notes
- **No figure moves, so this is a PATCH.** The pinned differential is identical per game in both regulations
  (`MEDI_SAMPLE_DUMP` trajectories at `--games 1200`: 961 of 961 games on Reg M-B and 955 of 955 on Reg M-C; the
  `--games 300` artifacts match as well). So is a 300-playout per-game harness that
  also hashes every counter. So are 16 probes in each regulation. Full account:
  `docs/_reports/2026-09-24-engine-turn-speed.md`.
- **Re-proved on main at merge.** Pinned Reg M-C differential at `--games 1200` (census pin `ccd979c30997`,
  `data/team-pool-frozen-regmc`), release `11a681c6a683` (main before) against `eff9468cefc0` (after): 955 of 955
  `MEDI_SAMPLE_DUMP` rows identical, trajectory digests included. The artifacts differ only in release id, the two
  source digests and timestamps. Account: `docs/_reports/2026-09-24-solver-merge.md`.
- **The turn has become about 1.75x dearer in CPU since 2026-08-28, not 3x.** This is a paired bisect over 20
  releases. The playout-speed report's 3x compared an idle-machine figure against a run on a machine at 100% load.
  The steps, and the hot spots that would need a behaviour-affecting change, are listed in the report as proposals.
## [0.112.1] — 2026-09-24

### Changed
- **`data/provenance-stamp.json` committed from `node engine/status.js --write`.** The merge pass held it back because
  `verified` had fallen 7 -> 3. Run again before this pass's measurement, it still read 3, because the stamped gate
  artifacts pointed at releases the merged tree no longer matched. After the 0.112.0 re-read it reads **11**, verified
  by content digest. The only other change is the `generated` timestamp.

## [0.112.0] — 2026-09-24

### Changed
- **Both MEDICHAM gates re-read on the merged engine; both still CLOSED, each on ONE clause.** Releases
  `78fb4a85b1a0` (Reg M-C) and `fb8073869b72` (Reg M-B), pass-10 protocol, every run pinned and serial through
  `tools\lownode.cmd`. **Reg M-C: 1 of 10 fails (was 5).** Narration is CANNOT-ANSWER because no baseline exists;
  undeclared narration-only games are 3/955, 5/1266 and 6/1497 (were 6, 12 and 9). Board-material is 0 on all three
  lattices. Roster: 166/166, 210/214 and 510/511, 0 COULD-NOT-STAGE. Mechanics staged: 0 diverge; 4,867 games.
  Register clause PASS. **Reg M-B: 1 of 10 fails (was 4).** #442's instrument is RED because the committed census
  (1004) is older than the engine (1020 reproduced). Every other clause passes; board-material and narration are 0 on
  961/1069/1497. Census pins `ccd979c30997` (Reg M-C, 1024 live) and `8fe58c13659e` (Reg M-B, 1020 live). The Reg M-B
  census reading is parked at `data/verification/mechanics-census-fb8073869b72.json` and not republished; its roster
  and staged-harness readings equal the closed documents' figures and are committed. No narration baseline was
  stamped. `docs/_reports/2026-09-24-gate-reread-merged.md`.

## [0.111.4] — 2026-09-24

### Fixed
- **Three probes read the active regulation's Showdown checkout.** `tests/probe_mimicry_terrain_event_only.js`,
  `tests/probe_added_type_replaced.js` and `tests/probe_reflect_type_typeless_added.js` defaulted `SHOWDOWN_PATH`
  to the Reg M-B checkout, so under `--regulation regmc` with no `SHOWDOWN_PATH` they handed Reg M-C's format to Reg
  M-B's checkout and could only CANNOT-ANSWER (shown: exit 2, "champions_sim: REFUSING to resolve format
  gen9championsvgc2026regmc", release `318ccd937118`, 3 of 3). They now require `engine/showdown_path.js` (an
  explicit `SHOWDOWN_PATH` still wins). After: 6 of 6 exit 0 with `SHOWDOWN_PATH` unset — Reg M-C on `318ccd937118`,
  Reg M-B on `d9d69d58ef31`.

## [0.111.3] — 2026-09-24

### Fixed
- **The four Gravity knobs are in the census's deliberate-break list.** `MEDFAILS.gravityMenuOpenRestored`,
  `gravityChosenPlayedRestored`, `gravityClickedMovePlaysRestored` and `gravityCalledMovePlaysRestored` (0.100.0 /
  0.108.0) were missing from `DELIBERATE_BREAK` in `tests/test-mechanics.js`, so a census run with one armed would
  have written. Checked: each knob, loaded alone, stamps its key and the key is now in the list (all four read
  NOT-LISTED at 0.111.2).

## [0.111.2] — 2026-09-24

### Fixed
- **`node engine/tag_dex.js` exited 1 under Reg M-B on twelve tags that are empty BECAUSE the regulation lacks
  them.** The predicates are shared and the tag files are per regulation, so tags written for Reg M-C (Revival
  Blessing, Court Change, Glaive Rush, the gems, the terrain seeds, Rocky Helmet, Air Balloon, Red Card, Eject
  Button, Emergency Exit / Wimp Out, Liquid Ooze, Run Away) read "MATCHED NOTHING -- a bug" against Reg M-B's
  hand list `EXPECTED_EMPTY`. Root cause fixed by derivation, not by twelve more names: an empty tag is re-run
  over the entities of its kind that exist and are OUT of this regulation's scope (the same scope verdict
  `collect` asks), and a tag no entity here carries a handler for is checked against the sibling regulation's
  own catalogue. Either way the tag is printed with the members it would have had; a tag that matches nothing
  anywhere still fails. Reg M-B: 11 by out-of-scope members, 1 (`escapesTrap` on abilities: Run Away has
  `onTrapPokemon` only in Reg M-C's mod) by the sibling catalogue; exit 0.
- **Both tag files regenerated.** Every entity row's tags and params are identical to the hand-merged files
  (param key ORDER differs on 51 / 53 moves). What moved: Reg M-B gains the 12 zero-member tag rows it lacked;
  both files' `bypassesSubstitute` and `allyBasePowerBoost` rows now name their consumer (were `null`); Reg M-C's
  `punishesAttacker` count reads 14 and `condStatMult` 3 — the member lists already held 14 and 3 entries and
  only the counts were stale. Usage weights moved with the stores
  (`sheet_entries` 316,656 -> 309,600 Reg M-B, 215,244 -> 205,836 Reg M-C; store-side, OPS's to explain).
  Gravity's row `refusedByPseudoWeather` is identical in both files: five moves (bounce, fly, flyingpress,
  highjumpkick, magnetrise) = the legal `flags.gravity` moves of both formats, one `move: Gravity` line.

## [0.111.1] — 2026-09-24

### Changed
- **Ledgers restamped after the last merge of the pass (0.111.0).** `node engine/status.js --write`; generated blocks
  only (engine digest, timestamps). No engine byte and no figure moves. `docs/_reports/2026-09-24-merge-pass.md`.

## [0.111.0] — 2026-09-24

### Fixed
- **A type spend clears the added type (Burn Up both regulations, Double Shock Reg M-C).** Both handlers write
  `pokemon.setType(pokemon.getTypes(true).map(Fire|Electric → '???'))` (data/moves.ts `burnup` / `doubleshock`
  `self.onHit`, both checkouts; the Champions mods override neither handler). `getTypes(true)` is the BASE list and
  `setType` writes `addedType = ''`, so a Trick-or-Treated Arcanine that Burns Up is `???` there and its spend line
  reads `???`. This engine mapped the whole `types` array: the new array lost the `types._added` marker but kept
  the added element, so the Ghost (or Forest's Curse's Grass) survived as a base type — and so did its immunities.
  Both `spendsOwnType` sites now map the base list through one helper, `spentOwnTypes`. Knob
  `MEDI_SPEND_TYPE_KEEPS_ADDED` restores the whole-list map; counter `MEDSEEN.spendClearedAddedType`.
- The 0.109.0 comment claiming every `.map()` / `.filter()` write clears the added type is corrected: those two
  keep the element and promote it. The two spends were the only such writes (audited, every `types=` site).
- New probe `tests/probe_spend_type_clears_added.js` (two engines, whole board, the spend line and the broadcast):
  red on the base bytes in both regulations, green on the fix, red under the knob; a no-add control and an
  add-after-the-spend control. New census row (`spendsOwnType`, "a type spend (Burn Up / Double Shock) clears the
  added type"); the knob is a `DELIBERATE_BREAK`.

### Notes
- Filed in 0.110.0's report §6. Roost, the only other type removal, goes through the `Type` event and never touches
  `addedType`; it is already carried by hand (0.109.0). Report `docs/_reports/2026-09-24-burnup-added-type.md`.

## [0.110.1] — 2026-09-24

### Changed
- **Merge pass: fifteen branches merged into main as 0.87.1-0.110.0, and the division ledgers restamped.** Each branch's
  entries were renumbered above main's top with content unchanged; the reconciliations (the solver API's `newBattle` now
  requires a stream, one Gravity execution gate for both Gravity merges, the Gravity census row's chosen arm, the
  MEDSEEN union) are recorded as merge notes in 0.101.0 and 0.108.0. `node engine/status.js --write` restamped the
  five ledgers' generated blocks. No engine byte moves in this entry and no figure moves.
  `docs/_reports/2026-09-24-merge-pass.md`.

## [0.110.0] — 2026-09-24

### Fixed
- **Reflect Type at a typeless target that carries an added type copies Normal plus the added type (both
  regulations).** The authority copies `getTypes(true)` — the BASE list, which excludes the added type — less `???`,
  reads an empty one as `['Normal']` when an added type stands, and carries the added type across on its own
  (`source.addedType = target.addedType`; data/moves.ts `reflecttype`, no Champions override, both checkouts). A
  Burned-Up Arcanine that was then Trick-or-Treated copies as Normal/Ghost there; this engine copied Ghost alone.
  The typecopy branch now reads the base list and the added slot (0.109.0's `types._added`) separately, and the
  user's own `apparentType` is its base list, as `setType` writes it.
- **The turn-boundary type broadcast writes the base list and then a `[silent]` typeadd** (sim/battle.ts
  `nextTurn`). It wrote the whole list as one typechange, so a Reflect Type at a foe carrying an added type parted
  the protocol stream (narration only; boards agreed). Knob `MEDI_REFLECT_TYPE_FOLDS_ADDED` restores both halves.
- New probe `tests/probe_reflect_type_typeless_added.js` (two engines, whole board and the broadcast lines): red on
  the base bytes in both regulations, green on the fix, red under the knob; a no-add control (the copy fails in both)
  and a non-typeless control. New census row (`changesTargetType`, "Reflect Type at a typeless target with an added
  type copies NORMAL plus the added type"); the knob is a `DELIBERATE_BREAK`.

### Notes
- Filed in 0.105.0's report as gap 1. Reachable in both formats through Burn Up (legal in both, mono-Fire learners);
  Double Shock is `Past` in Reg M-B and its one Reg M-C learner is dual-typed, so it cannot empty a base list.
  Report `docs/_reports/2026-09-24-reflect-type-corners.md`.

## [0.109.0] — 2026-09-24

### Fixed
- **A second added type replaces the first (both regulations).** The authority keeps ONE added type:
  `Pokemon#addType` writes `this.addedType = newType` (sim/pokemon.ts, byte-identical in both checkouts, no
  Champions override). This engine's `changesTargetType.adds` branch appended, so Trick-or-Treat then Forest's
  Curse left a Snorlax Normal/Ghost/Grass (still immune to Fighting) where the authority has Normal/Grass. The added
  type now rides on the `types` array as `types._added`; a wholesale type write builds a new array and so clears it,
  exactly as `setType` clears `addedType`. Roost's type drop and Transform carry it by hand, as the authority does.
  Knob `MEDI_ADDED_TYPE_APPENDS`.
- New probe `tests/probe_added_type_replaced.js` (two engines, whole board): both orders red on the base bytes in
  both regulations, green on the fix, red under the knob; a one-add control agrees throughout. New census row
  (`changesTargetType`, "a second added type REPLACES the first"); the knob is a `DELIBERATE_BREAK`.

### Notes
- Filed in 0.105.0's report as gap 2. Both added-type moves (Trick-or-Treat, Forest's Curse) are legal in both
  formats, derived from `Dex.forFormat`. Report `docs/_reports/2026-09-24-reflect-type-corners.md`.

## [0.108.0] — 2026-09-24

### Fixed
- **Gravity refuses a gravity-flagged move, whether a caller calls it or the body chooses it (both regulations).** `gravity.condition` refuses the move in `onBeforeMove`, for the move a body chose, and in `onModifyMove`, for a move that Sleep Talk or Copycat calls through `useMoveInner`. The line is `|cant|<body>|move: Gravity|<move>`, and the Champions mod overrides neither. Neither half was wired, because no artifact carried the move flag. So a Sleep Talk under Gravity played High Jump Kick, a Copycat after it played it again, and a body that chose Bounce the turn Gravity went up started its charge. The only legal callers are Sleep Talk and Copycat: Metronome, Assist, Me First, Mirror Move and Nature Power are `Past` in both regulations. `tag_dex` derives `refusedByPseudoWeather` off every pseudo-weather's own refusal handlers. It has 5 members, spliced into `data/tags.json` and `data/tags-regmc.json`; nothing else in either file moved. `pseudoWeatherRefusal` asks it at Heal Block's site, for called and chosen actions alike. A refused called move becomes the pending last move, so Copycat copies it, as the authority does. Knobs `MEDI_GRAVITY_CALLED_MOVE_PLAYS` and `MEDI_GRAVITY_CLICKED_MOVE_PLAYS`. Probe `tests/probe_gravity_called_move.js`, both engines against the authority. Pre-fix engine: 6 RED in both regulations. Fixed: green. Each knob: red on its own arms. Census row `refusedByPseudoWeather`: Reg M-C 1011 → 1012 live. The Reg M-B census is parked at 1008. The menu half (`onDisableMove`) is still open. `docs/_reports/2026-09-24-ate-picker-gravity-called.md`.
- **Merge note (added at merge into main).** Gravity's CHOSEN half was also wired by the menu-halves merge (0.100.0), at
  the same execution site, off `gravitySealsMove` with knob `MEDI_GRAVITY_CHOSEN_PLAYED`. The two gates are now one: the
  called half as written here, and the chosen half refused unless `MEDI_GRAVITY_CHOSEN_PLAYED` or
  `MEDI_GRAVITY_CLICKED_MOVE_PLAYS` restores the defect; both counters count it. The two tag rows agree (the same five
  moves, the same `move: Gravity` line) in both regulations. `probe_gravity_called_move` and
  `probe_disabled_choice_struggle` exit 0 in both regulations and each of the three knobs turns its probe red.
  The census row's CHOSEN arm now keeps a second, unflagged slot (Sleep Talk): with the menu half, a body whose only
  move is High Jump Kick has an empty menu under Gravity and its click is Struggle (0.99.0), so that arm had been
  measuring the rewrite. Reg M-C census regenerated on the merged tree: 1021 live, 0 missing.

## [0.107.0] — 2026-09-24

### Fixed
- **The staged harness no longer triggers an -ate ability with the move its handler skips (both regulations).** `fixture_preflight` derived Pixilate's need as `type=Normal` and nothing else, and `stage_planner.triggersOf` copied only the kind and values. So Weather Ball, which is on every -ate handler's own `noModifyType` list, met it. The planner staged Pixilate and Refrigerate with Weather Ball in both regulations, and on the 0.106.0 engine Pixilate's planner arm read DID-NOT-FIRE. The row showed FIRED only through the legacy fallback. `excludedMoveIds` now reads a handler's excluded move ids off its own text, with the flags' polarity rule. It covers a bound literal list, an inline list and `move.id ===/!==`. The ids ride on the need as `except`, and `satisfiesNeed` refuses them. `stage_planner` carries them. Knob `FIXTURE_PREFLIGHT_EXCLUSION_BLIND`. Probe `tests/probe_ate_picker.js`. Fixed: 0 RED in both regulations. Blind: 2 RED (Pixilate, Refrigerate on Weather Ball). `all_mechanics_fire.js --only` on the fixed-engine releases: Pixilate now FIRES on the planner stage with Hyper Voice in both regulations. `docs/_reports/2026-09-24-ate-picker-gravity-called.md`.

## [0.106.0] — 2026-09-24

### Fixed
- **The -ate abilities no longer convert or boost Weather Ball (both regulations).** Every -ate `onModifyType` (Pixilate, Refrigerate, Aerilate, Dragonize, Galvanize; the Champions mod overrides none of them in either checkout) skips the moves on its own `noModifyType` list, and those moves never take the `[4915,4096]`. `convertsMoveType` carried the type and the multiplier but not the list, so a Pixilate or Refrigerate Weather Ball converted and took x1.2 in every sky, and hit a Ghost the authority is immune to. `tag_dex` now derives `except` off the handler; `convertsMoveTypeTo` honours it (one function, so the damage calc and the battle loop both see it); a param with no `except` field is counted (`convertsExceptMissing`). Legal Weather Ball holders: Sylveon, Aurorus, Altaria-Mega, Glalie-Mega; Galvanize and Normalize have no legal holder in either regulation. Knob `MEDI_ATE_EXCLUSION_BLIND`. Probe `tests/probe_ate_abilities.js` (all 16 rolls, quiet control): Reg M-B 16 RED → 0 of 23 rows, Reg M-C 16 RED → 0 of 24; census row `convertsMoveTypeExcept`. `tests/probe_pair.js` gains `runModifyType` and refuses an attacker ability with `onModifyType` without it. `data/tags.json` and `data/tags-regmc.json` carry only the spliced `except` fields. `docs/_reports/2026-09-24-ate-abilities.md`.

## [0.105.0] — 2026-09-24

### Fixed
- **Mimicry answers a terrain change, not every turn (both regulations) — Reflect Type's hidden board mismatch.** The
  roster's Reflect Type row (shelved on usage, underlying FIRED-AND-BOARDS-DIFFER in both regulations) was not a
  Reflect Type defect: its aggressor is Stunfisk-Galar, whose only ability is Mimicry. The authority fires Mimicry on
  its holder's Start and on `setTerrain` / `clearTerrain` only (data/abilities.ts `mimicry`, no Champions override,
  identical in both checkouts). `syncTerrainTypes` re-ran it from every call site, the head of each turn included, so
  a copied typing reverted to Ground/Steel one boundary later (or went back to Electric under a standing terrain).
  Each holder now remembers the terrain it last answered; the memory is cleared on the lead pass, on entry, on a
  mid-battle ability start and on switch-out. Knob `MEDI_MIMICRY_SYNC_EVERY_CALL`.
- New probe `tests/probe_mimicry_terrain_event_only.js` (two engines, whole board): two red arms, a live arm (a
  terrain set after the copy still retypes) and a no-Mimicry control. Red on the base bytes in both regulations, green
  on the fix, red again under the knob. New census row `typeFollowsTerrain`; the knob is a `DELIBERATE_BREAK`.

### Notes
- Reflect Type itself matches the authority for every reachable case but one, filed and not fixed: a typeless target
  carrying an added type (the authority copies Normal plus the added type). Separately filed: a second added type
  replaces the first in the authority, where this engine appends it (Trick-or-Treat then Forest's Curse).
  Terastallization is out of scope (the Champions mod's `canTerastallize` returns null).

## [0.104.0] — 2026-09-24

### Fixed
- **The roster stages Belch again, and the "berry already eaten" red demonstration bites, in both regulations.**
  Belch runs on `bottom-tie-first`, where every crit lands, and its eater is now a legal learner (Salazzle under
  Reg M-B, Toxtricity under Reg M-C) rather than the old bulky body. The chip count was priced without the crit,
  so the second Crunch KO'd the eater, its replacement was handed the eater's click, and Showdown refused `pass`.
  Belch is the only member of `move/needs-a-berry-already-eaten` that reads the eaten flag, so with it unstaged the
  rule's plant moved nothing and read NOT CAUGHT. The chip is now priced with the crit multiplier READ off the
  format's own `modifyDamage`, and a chip count that would also KO the eater is refused by name. Test code only
  (`tests/roster.js`).

## [0.103.0] — 2026-09-24

### Fixed
- **The roster stages Effect Spore again, in both regulations.** Its fixture chose the die by a running total and
  never asked which branch it fell in: Body Slam's turn-3 coin (0.2637) lands in the POISON band, and the body that
  actually threw it was not the one the rule reasoned about — Effect Spore can write sleep, so the idle click stays
  Focus Energy, Dragapult cannot learn it, and the learnset restaging pass swapped in Archaludon (Reg M-B, Steel:
  refuses poison) or Rillaboom (Reg M-C, Grass: fails the handler's powder gate). Showdown rolled the coin, the
  aggressor refused it, and the row read inert. The rule now picks an aggressor whose band it can take (typing and
  the tag's own `attackerStatusImmunity`), which learns the idle click when a band can write sleep, and reads the
  status off Showdown's board as a precondition. Static, Flame Body and Poison Point keep their fixtures. Test code
  only (`tests/roster.js`).

## [0.102.0] — 2026-09-24

### Fixed
- **The roster stages Natural Cure and Regenerator again, in both regulations.** The switch-out fixture handed side
  A slot 1 the aggressor's hit; when the Skill Swap lender stood there (Gourgeist-Super, which does not learn it)
  the click resolved to `pass` and Showdown refused it, so both rows read COULD-NOT-STAGE. Slot 1 now clicks only
  what its body carries. Natural Cure was also never exercised: its last green moved only the ability field the
  control rewrites, because nothing put a status on the carrier. The fixture now gives the carrier a DERIVED major
  status (Will-O-Wisp off the lender, pinned to `bottom-tie-first`, precondition read off Showdown's board), and
  Natural Cure has its own rule, `ability/switch-out-cures`, whose plant skips the cure. Test code only
  (`tests/roster.js`); no engine byte moved.

## [0.101.0] — 2026-09-24

### Fixed
- **ROADMAP #310 closes: every engine `battleInit` hands the lead-in a random stream (both regulations).** With no
  `opts.rng`, a Trace lead took `eligible[0]` and a tied lead pair kept array order (`traceChoiceNoDie`,
  `entryOrderTieNoDie`). The eight sites the row named now pass an explicit seeded stream, each chosen so the turn
  dice do not move: `bench_speed.js` (the playout seed), `game_differential.js` `mediSpan`/`oneHitDamage`
  (`STAGE_LEAD_SEED`), `million_run.js` (a separate stream keyed on seed and game or trial), `replay_differential.js`
  (the sweep's pin; a game-id seed for the lead weather board), `speed_vs_pokeenv.js` (the game seed). The instrument
  found two more: `medicham2-browser.js` `battle()` now passes the caller's stream, and `rollout_leaf.js` passes the
  playout stream on the `seeded:false` preview road only.
- `tests/probe_rollout_trace_stream.js` (either regulation): a static clause over every `battleInit(` in `engine/`
  (15 sites; a planted `{}` must read UNSEEDED; `--plant-caller` shows it RED) and two behavioural cells, PREVIEW and
  BATTLE. RED on the pre-fix bytes in both regulations, GREEN after. No published output moves: before/after runs on
  one release are identical apart from clocks, and the counters show the stream is reached.
- **Merge note (added at merge into main).** The solver API (`engine/medicham_api.js`, 0.95.0) landed on main after this
  branch was cut, and its `newBattle` passed `battleInit` an options object that carried a stream only when the caller
  gave one, so the static clause read two UNSEEDED sites. `newBattle` now refuses a battle with neither `rng` nor
  `seeded: true` and hands `battleInit` the stream explicitly. Every existing caller already passes `rng`.

## [0.100.3] — 2026-09-24

### Fixed
- **The register instruments for #310 and #442 answer in both regulations.** Both hardcoded Reg M-B (a forced `SHOWDOWN_PATH`; #310 also a Reg M-B release, #442 the census by its Reg M-B filename), so under Reg M-C they read CANNOT-ANSWER for reasons unrelated to the defects. `tests/probe_rollout_trace_stream.js` and `tests/probe_census_reproduces.js` now resolve the checkout through `engine/showdown_path.js`; #310 falls back, printed, to the selected regulation's current release when the named one was cut for the other regulation; #442 names the census with `artifactFor` and classes a difference OVERCLAIM or UNDERCLAIM ONLY. Readings: #310 GREEN in both (the residual unseeded callers stay open); #442 Reg M-C GREEN, Reg M-B RED as UNDERCLAIM ONLY (committed census 1004, tree 1006: two live pass-9 probes landed after the census was last committed). No engine change. `docs/_reports/2026-09-24-register-310-442.md`.

## [0.100.2] — 2026-09-24

### Added
- `tests/probe_disabled_choice_struggle.js --part berry`, Stuff Cheeks: **Stuff Cheeks has no menu half in this format.**
  The Champions mod deletes `stuffcheeks.onDisableMove` in both checkouts, as it does Belch's. The authority offers the
  click and refuses it at `onTry` (no berry held), which the engine already did (ROADMAP #308). The same arm as Belch's,
  green in both regulations.

### Changed
- `engine/medicham2-browser.js` #152 comment: with Gravity wired, every `onDisableMove` / `onFoeDisableMove` source a legal
  entity reaches in either regulation is answered; Gorilla Tactics has no legal carrier in either.

### Notes
- The whole probe on the final tree: GREEN, 89 checks, in each regulation (releases `ec9ae9436155` / `44adf7e1e687`). The
  pinned differential re-run on those releases is byte-identical per game to the base (43 and 38 games, board-material 0).

## [0.100.1] — 2026-09-24

### Added
- `tests/probe_disabled_choice_struggle.js --part berry` (also in `all`), Belch: **Belch has no menu half in this format.**
  Mainline's `belch.onDisableMove` (`if (!pokemon.ateBerry) disableMove('belch')`) is deleted by the Champions mod
  (`onDisableMove: undefined, // no inherit`) in both checkouts, so the authority offers the click and refuses it at
  `onTry`. The probe reads that off the resolved format (and fails if a checkout restores the handler), stages a body
  that has eaten no berry, and asserts that both menus keep Belch, the handed click is played, the authority fails it on
  turn 1, and the streams agree. Green in both regulations. The engine already did this (ROADMAP #514); nothing in it
  changes but comments.

### Changed
- `engine/medicham2-browser.js` comments. The #152 list and the 0.99.0 report named Belch's menu half as missing; it
  does not exist in this format. The Belch gate's comment said `gatesSelection` "re-arms the menu with no edit here"
  if a regulation restores the handler. Nothing reads `gatesSelection`, so it would not. It is `false` in both
  regulations; the probe is the guard.

## [0.100.0] — 2026-09-24

### Fixed
- **Gravity's menu half (both regulations).** `gravity.condition.onDisableMove` (no Champions row, identical in both
  checkouts) disables every slot whose move carries `flags.gravity`, on every active body, while the field stands. The
  engine offered them: a grounded body kept Magnet Rise on its menu, and a body whose only moves were flagged could not
  reach `mustStruggle`, so the 0.99.0 choice-time Struggle rewrite could not fire for it. `moveDisabledBy` now asks
  `gravitySealsMove`. Knob `MEDI_GRAVITY_MENU_OPEN`.
- **Gravity's execution half (both regulations), found by the same probe.** `onBeforeMove` (priority 6) refuses a flagged
  move that was already chosen when a faster Gravity landed: `|cant|<body>|move: Gravity|<move>`, no PP. The engine
  played it (a Magnet Rise went up under Gravity and spent its PP). The refusal sits beside Heal Block's, which has the
  same priority. Knob `MEDI_GRAVITY_CHOSEN_PLAYED`.

### Added
- Tag parameter `groundsField.menuSeals` (`engine/tag_dex.js`): the flag read out of the condition's own
  `onDisableMove`, every legal move carrying it (Bounce, Fly, Flying Press, High Jump Kick, Magnet Rise in both
  regulations), and whether `onBeforeMove` refuses a chosen one. Written into the Gravity row of `data/tags.json` and
  `data/tags-regmc.json` by that derivation run against each regulation's checkout; `data/abra-tags.js` rebuilt. A full
  `tag_dex.js` regeneration cannot run in an isolated worktree (it needs the store), so the rest of both files is
  unchanged; a regeneration in main should reproduce the row byte for byte.
- `tests/probe_disabled_choice_struggle.js`: a Gravity source (the Struggle scenario), and `--part gravity` (a two-slot
  menu arm and a same-turn arm, each with its knob). Census rows `move/groundsField` x2 (the menu, and the same-turn
  refusal with its PP).

### Notes
- Probe: red on the base engine (6 assertions in each regulation: 4 on the defect, 2 knob stamps the base cannot carry; releases `ecaa79e28f15` / `4c0296817626`), green after
  (79 checks each). Census: Reg M-B 1,012 -> 1,014 live of 1,014, Reg M-C 1,016 -> 1,018 of 1,018; both knobs set, the
  two new rows go MISSING (1,012 of 1,014).
- Pinned differential, `--games 45 --steering empirical --arm middle --state`: base and final per-game fingerprints
  byte-identical in both regulations (43 and 38 games), board-material 0 on every arm. API legality (Reg M-C): 5,552 of
  5,552 slots agree.
- `docs/_reports/2026-09-24-menu-halves-gravity-belch-cheeks.md`.

## [0.99.0] — 2026-09-24

### Fixed
- **A caller's move click on a body whose enabled menu is empty is Struggle (both regulations).** `Side#chooseMove`
  (`sim/side.ts`, identical in the Reg M-B and Reg M-C checkouts) takes a hard lock first, then pushes
  `moveid: 'struggle'` whatever was named when `getMoves()` is empty, and returns before the mega block. A visible
  source leaves only Struggle on the request, so a named real move is refused there; Imprison's hidden source on the
  last active body is rewritten there. The engine played the handed click and let each source's execution gate answer
  it: `|cant|` for Taunt, Disable, Encore + Disable, a Choice lock + Taunt, Heal Block, Imprison and 0 PP, and for
  Gigaton Hammer's repeat lock nothing at all (the move landed a second time). One site in `battleTurn`'s action
  collection now asks `mustStruggle` when the handed move is itself off the menu, and builds Struggle. Knob
  `MEDI_DISABLED_CLICK_PLAYED`.
- **Torment's menu half (both regulations).** `torment.condition.onDisableMove` disables the body's last move. Torment
  has no `onBeforeMove`, so this is its only half, and the engine had neither: a tormented body repeated its move.
  `moveDisabledBy` now refuses `_lastMove` under the volatile. Knob `MEDI_TORMENT_MENU_OPEN`.
- The menu's PP read (`moveDisabledBy`) no longer writes the lazy `_pp` table (`ppPeek`). Asking the menu wrote a
  full-PP row for every slot; `ppSpentMap` reads an absent row as unspent, so no board leaf moves.

### Added
- `tests/probe_disabled_choice_struggle.js`: Imprison at board level in both engines, and eight disable sources at
  choice level (Taunt, Disable, Torment, Encore + Disable, Choice lock + Taunt, Heal Block, Gigaton Hammer, 0 PP),
  each with a boundary-0 control and the knob arm. Red on the base engine (14 assertions in each regulation), green
  after.
- Census rows `move/locksTarget` (Torment), `move/cantUseTwice` and `move/forbidsStatusMoves` (the handed click).

### Changed
- Census rows `move/pp` (twice) and `item/restoresPP` handed a body's ONLY move at 0 PP and asserted `|cant|nopp`. The
  authority cannot produce that board: it takes the turn as Struggle. They now count the Struggle apart from the move's
  own clicks and assert it.

### Notes
- Census: Reg M-B 1,012 of 1,012 live, Reg M-C 1,016 of 1,016 (the base branch measured 1,009 and 1,013). With both knobs
  set, 6 rows go MISSING.
- Pinned differential, `--games 45`, `--steering empirical --arm middle`, state mode: base against final is byte-identical
  per game in both regulations (Reg M-B 43 games, Reg M-C 38), board-material 0 on both arms.
- `docs/_reports/2026-09-24-disabled-choice-struggle.md`.

## [0.98.0] — 2026-09-24

### Fixed
- **Heal Block's menu half (both regulations).** `healblock.condition.onDisableMove` disables every heal-flagged slot while
  the volatile stands. It is a visible disable. The engine refused the click only at execution, so the move stayed on the
  menu. `moveDisabledBy` now asks `healBlockRefusesClick`, the reader the execution refusal already uses. Knob
  `MEDI_HEALBLOCK_MENU_OPEN`.

### Added
- Census row `move/blocksHealing`: "Heal Block takes a heal-flagged move off the menu while it stands, and gives it back
  after".
- `tests/probe_move_menu_legality.js` now asserts that every slot agrees at every boundary of each staged game. Before, it
  checked only the asserted turn. That covers the end of Psychic Noise's two-turn block.

### Notes
- `legalActions` against the authority (`--games 45`, state mode): 2 disagreeing slots of 5,552 become 0. The
  probe's legal part is green for the first time. Base release `9cfd07674cc9` against `f9c11b7b9b3c`: per-game fingerprint byte-identical over 38 games.
  At `--games 1200` (same pins, `--end-state`) the base and the final release are byte-identical per game over 955 games, board-material 0 of 954 on both.
- `docs/_reports/2026-09-24-move-menu-legality.md`.

## [0.97.0] — 2026-09-24

### Fixed
- **Imprison's menu half (both regulations).** `imprison.condition.onFoeDisableMove` disables, on every living active foe,
  each move the imprisoner carries. The engine had only the execution refusal (`onFoeBeforeMove`), so a sealed move stayed
  on the foes' menus. `moveDisabledBy` now asks `imprisonSealedBy`, the reader the execution refusal already uses. It
  reaches the foes through `me._sf._S`, so no caller's signature changed. A body with every slot sealed reaches Struggle
  through `mustStruggle`. Knob `MEDI_IMPRISON_MENU_OPEN`.

### Added
- Census row `move/sealsMoves`: "Imprison takes the moves it knows off both foes' menus, down to Struggle, and not off
  its ally's".

### Notes
- **The exact rule, demonstrated rather than recalled.** The disable is HIDDEN. The request shows the move enabled to the
  last active body (`restrictData = isLastActive()`, sim/pokemon.ts:1093-1095) and disabled to a body with a live ally on
  its right. `Side#chooseMove` validates with `getMoves()` and no `restrictData` (sim/side.ts:627, 730-745), so it refuses
  the click from either slot. On a copy of the authority's own battle, the last active body's Protect was shown enabled
  and refused: "Can't move: Aegislash's Protect is disabled". Legality therefore loses the move in both slots.
- `legalActions` against the authority (`--games 45`, state mode): 6 disagreeing slots of 5,552 become 2.
  Base release `9cfd07674cc9` against `d0b771be7727`: per-game fingerprint byte-identical over 38 games.
- **Owed, not fixed here (the execution path, not the menu):** a caller-supplied click on a body whose whole menu is
  sealed. The authority's `Side#chooseMove` rewrites that click to Struggle (side.ts:699-709). MEDICHAM plays the click and
  refuses it with `|cant|…|move: Imprison|`. The probe's STRUGGLE arm prints this parting.
  `docs/_reports/2026-09-24-move-menu-legality.md` §3.

## [0.96.0] — 2026-09-24

### Fixed
- **A Parting Shot that stays in is a move action, so Fake Out leaves the menu (both regulations).** The engine counted a
  move action (`_mvActs`, the authority's `activeMoveActions`) only for an action whose `kind` was not `switch` or `pass`.
  `playerAction` builds Parting Shot, Chilly Reception and (Reg M-C) Revival Blessing as `{kind:'switch', mv}`, so a
  Parting Shot blocked by a Protect left the count at 0. The Champions `fakeout.onDisableMove` reads that count, so Fake
  Out stayed on MEDICHAM's menu. An action now counts when it carries a move (`actionMoveId`). A bare `pass` still does
  not count. Knob `MEDI_PIVOT_MOVE_NOT_COUNTED`.

### Added
- `tests/probe_move_menu_legality.js`: at every turn boundary it compares the moves the authority accepts
  (`getMoves()`, the call `Side#chooseMove` validates with) with `selectableMoves`, for each of the three menu defects the
  solver API's legality probe found. Red before this fix and green after it, in both regulations. The imprison and
  healblock parts stay red until 0.97.0 and 0.98.0.
- Census row `move/firstTurnOnly`: "a Parting Shot that stays in is a move action: Fake Out leaves the menu".

### Notes
- `legalActions` against the authority (`--games 45`, state mode): 26 disagreeing slots of 5,552 before, 6 after. The 20
  Fake Out slots are gone. At `--games 45` the differential is byte-identical per game to the base release
  (`9cfd07674cc9` against `536641af26ee`, 38 games). `docs/_reports/2026-09-24-move-menu-legality.md`.

## [0.95.0] — 2026-09-24

### Added
- **The solver-facing MEDICHAM API, `engine/medicham_api.js`.** A wrapper beside the engine: `makeRng`/`makeEventDice`,
  `newBattle`, `clone` (structuredClone without the trace sink), `legalActions` (per-slot options and the joint set as
  Showdown choice strings), `step` (a new battle; the input is never touched), `stepInPlace`, `isTerminal`/`winner` (the
  wipe only, not the 20-turn cap; `battleOver` is unchanged for its callers), `atHorizon`, `horizonScore`, `digest`.
  Brief: `docs/_reports/2026-09-23-engine-interface-brief.md` steps 2, 3, 4 and the additive half of 5. The mid-turn
  choice callback (step 6) is not done. Frozen in every release (`SOURCES`).
- **An opt-in per-battle scratch in the engine** (`battleScopeNew`/`battleScopeRun`). A battle the API builds keeps its
  own event-dice repeat map and the three trace-singleton fields, so the two cross-battle leaks the brief names are
  closed for API battles. A battle nobody gives a scope takes the old code path, so no existing caller changes.
- Exports: `selectableMoves`, `mustStruggle`, `sideWiped`, `moveTargetClass`, `moveTagParam`. No existing caller's
  `need:` list was touched.
- `tests/test-medicham-api.js` (the clone round trip, step purity, interleaving and endings; each shown red under a
  deliberate break) and `tests/probe_medicham_api_differential.js` (heavy, on demand: the API inside the differential).

### Notes
- **No published figure moves.** On release `9cfd07674cc9` at `--games 1200` (Reg M-C pinned pool, census pin
  `f3b70bc0c47c`), the differential is byte-identical per game to the base-commit release `ec377f6f8159`. It is also
  byte-identical routed through `stepInPlace` and under a clone-and-step shadow of every turn (22,283 of 22,283 turns
  equal).
- **`legalActions` agrees with the authority on 5,526 of 5,552 slots.** The 26 are the ENGINE's move menu, read
  faithfully, and are 3 engine defects left open because fixing them changes play: Fake Out stays selectable after a
  Parting Shot that did not switch out, the menu half of Imprison, and the menu half of Heal Block. `docs/ENGINE.md`.
- `engine/engine_release.js` is in the differential's `driver_code` closure, so adding a SOURCE moves that stamp
  (`64a2dc4f5568` to `dea7bd773a94`). Runs on either side of this commit read as different instruments.

## [0.94.0] — 2026-09-24

### Fixed
- **A mega stone's `onTakeItem` is asked by every item mover, and Magic Room does not silence it (both regulations).**
  `Battle#singleEvent` / `runEvent` skip item handlers under `ignoringItem()` for every event except `Start`,
  `SwitchIn` and `TakeItem` (sim/battle.ts:607, :874). `itemRefusesTake` read the item SLOT, which the Magic Room /
  Klutz park empties, so under a room or on a Klutz body Knock Off, Trick, Pickpocket, Magician and Symbiosis took a
  stone off its own species. It now reads the hold (`itemOn`). In the same pass: Corrosive Gas asks the stone (and
  writes the handler's `-fail`), and Thief, Covet and Symbiosis ask it again with the RECEIVER as holder, as their
  handlers' second `singleEvent('TakeItem', ...)` does. Found on the pinned Reg M-B pool, `--games 300`, game
  `…2659015200` (Magic Room, then Knock Off stripped a Mega Alakazam's own Alakazite). Knob
  `MEDI_STONE_TAKE_UNGUARDED`.
- New probe `tests/probe_megastone_take_guard.js`: eight red arms (Knock Off in a room, the same after mega, Knock Off
  into Klutz, Trick in a room, Corrosive Gas, Thief and Covet by the stone's own species, Symbiosis into it) and two
  controls. Red on the base bytes in both regulations, green in both after, red again under the knob; controls never
  move.

## [0.93.1] — 2026-09-24

### Changed
- `tests/test-mechanics.js` lists `chargeTurnNeverDrawsRestored` and `bouncedFailNamesClickerRestored` in
  `DELIBERATE_BREAK`, so a census run with either 0.92.0 / 0.93.0 knob armed refuses to write.
- The pass-10 "faint-line instrument question" is answered: the ENGINE, already fixed at 0.85.0. `--only-game` on
  `omit-protect …bo3-2678516446` (release `ec377f6f8159`, `--games 1200`) writes Farigiraf's `|faint|` in both engines;
  with `MEDI_REVIVE_KEEPS_FAINT_LATCH=1` the pass-9 card returns exactly (Farigiraf was revived on turn 7).
- Report: `docs/_reports/2026-09-24-narration-lightningrod-magicbounce.md` (both fixes, the control, and the pinned
  1200 lattices: Reg M-C board-material 0/954 before and after, narration 6 -> 4, the two gone being K and M).

## [0.93.0] — 2026-09-24

### Fixed
- **A bounced status move that fails writes its `-fail` on the bouncer, in both regulations.** `magicbounce.onTryHit`
  (`data/abilities.ts`, both checkouts, no Champions row) re-uses the move as the bouncer's (`useMove(newMove, target,
  { target: source })`), so when it does nothing `runMoveEffects` writes `-fail` on its `source`, the bouncer
  (`sim/battle-actions.ts:1306`). The results split the same way: `useMove` stores the bounced move's result on the
  bouncer (:371-374), and the clicker's own move ends `moveThisTurnResult = null` (:616), not false. MEDICHAM called
  `mvFail(clicker)`, naming the clicker and writing its result false. Reg M-C narration group M (`…bo3-2684711995`,
  turn 6: a Whimsicott's Encore bounced by a Hatterene). New `mvFailBounced(clicker, bouncer)` at the three sites a
  bounced status move can fail: the `affect` branch's whole-move volatile refusal and both Yawn refusals. Knob
  `MEDI_BOUNCED_FAIL_NAMES_CLICKER`. The `abilitywrite` branch's `_failAw` already named the bouncer and is unchanged.
- New `tests/probe_bounced_fail_names_bouncer.js` (both regulations; derived cast, Hawlucha's Encore into Hatterene):
  BOUNCE and a knob-cleared CONTROL (Hatterene on Healer, where the authority's `-fail` names the clicker). Green in
  both; red under the knob in both, on release `d43292131dd6` (the 0.92.0 bytes, Reg M-C) and with `--medi` on the
  0.92.0 bytes (Reg M-B). Fourteen related bounce, Yawn, Encore, Pressure and charge probes stay green in both.

### Notes
- `tests/probe_pivot_magic_bounce.js` and `tests/probe_yawn_safeguard_refusal.js` hardcode the Reg M-B checkout and
  throw under `--regulation regmc` (the pass-9 trap, not touched here); both are green with the M-C checkout named.

## [0.92.0] — 2026-09-24

### Fixed
- **Reg M-C: a charge move draws its redirect on the turn it charges (Lightning Rod, Storm Drain, Follow Me, Rage
  Powder).** The Reg M-C checkout carries upstream `efe4948` ("Remove unnecessary redirection code"), which took the
  `isCharging` guard out of `Pokemon#getMoveTargets` (`sim/pokemon.ts:829-831`; the Reg M-B checkout keeps it at
  `:829-836`, and neither Champions mod overrides the method). So under Reg M-C `RedirectTarget` runs on the charge turn:
  a Lightning Rod writes `-activate` above the `-prepare`, and Pressure is priced off the drawn body. The release still
  strikes the remembered slot (`twoturnmove.onStart`, byte-identical in both). This is Reg M-C narration group K
  (`…bo3-2679514203`, turn 8, Archaludon's Electro Shot past a Raichu). `engine/tag_dex.js` reads the method out of the
  compiled simulator and writes `chargeTurn.drawnWhileCharging` only when the guard is absent; `chargeStateOf` returns
  `drawBlocked`, which both draw sites (the attack branch and the Pressure PP site) now read. `data/tags-regmc.json`
  gains the param on its ten `chargeTurn` rows and nothing else; `data/tags.json` is byte-identical. Knob
  `MEDI_CHARGE_TURN_NEVER_DRAWS`.
- `tests/probe_redirect_above_prepare.js` reads the guard off the selected checkout (it hardcoded the Reg M-B checkout,
  the pass-9 trap), asserts the tag agrees with the source, and gains a PRESSURE-NORAIN arm (a derived Pressure body in
  the aimed slot). Reg M-C: green; red under the knob and on release `ec377f6f8159` with the 0.86.1 bytes (ROD-NORAIN
  protocol, and PRESSURE-NORAIN's board: `p1.pp[1].electroshot` 2 against 1). Reg M-B: green, green under the knob,
  red under `MEDI_REDIRECT_BELOW_CHARGE`.

### Notes
- `data/tags-regmc.json` was regenerated in a worktree with no store, so its usage counts read zero; the ten param
  additions were merged into the committed file and the tag SETS were checked identical on every row (0 differences).
- The PP half is board-material, so the pinned-lattice check is in the report:
  `docs/_reports/2026-09-24-narration-lightningrod-magicbounce.md`.

## [0.91.0] — 2026-09-24

### Fixed
- **Beak Blast burned its attacker below the attacker's own secondary (both regulations).** The burn is the volatile's
  `onHit` (`beakblast.condition.onHit` -> `source.trySetStatus('brn', target)`; data/moves.ts:1119-1146, byte-identical
  in both checkouts, the Champions mod overrides only basePower and pp). A volatile's `onHit` is raised by
  `runEvent('Hit')` inside `runMoveEffects` (sim/battle-actions.ts:1283), above `selfDrops` (:1096) and `secondaries`
  (:1099). The engine paid it in the DamagingHit pass, below the secondaries, so a Dire Claw into a charging Toucannon
  wrote the Toucannon's sleep above the attacker's burn. This is Reg M-C narration group N ("burn against sleep"; the
  triage called it unexplained because the burn's source was outside the captured window). A new step
  `_stepPreTurnHit` pays a `preTurnShield` `punishAttacker` status at step 3, above `_stepHitEvent` (a Condition's
  subOrder 2 before an Ability's 7, sim/battle.ts:957-972); the DamagingHit site skips a row already paid. Focus
  Punch's and Shell Trap's `hit` flag carries no line and did not move. Knob `MEDI_BEAK_BLAST_BURN_AT_DAMAGING_HIT`.
  Counter `MEDSEEN.beakBurnAtHitEvent`.
- New probe `tests/probe_beak_blast_burn_order.js` (either regulation): STATUS (a derived contact move whose secondary
  inflicts a non-burn status) and PLAIN (a contact move with no secondary, the control). Green in both; red on the
  0.90.0 bytes in both and under the knob in both. `probe_curse_ghost_order`, `probe_hit_event_buff_order`,
  `probe_stealeat_before_reactors` and `probe_steel_roller_onhit` stay green in both.
- Pinned differential, --games 300, same pins as 0.90.0: Reg M-C 259 games, 0 diverged, 0 board-material on 8051cc3c92a7 (0.90.0) and 9715a04eb0fe (fix); Reg M-B 260 games, 2 diverged, 1 board-material on 19c1f3a33ed3 and 8910b1cd2bbd, the same two games and first lines. Nothing moved.

## [0.90.0] — 2026-09-24

### Fixed
- **A Ghost's Curse wrote its lines in Reg M-B's order under Reg M-C, and named its user by species (both regulations
  for the name).** Reg M-B's Curse declares `volatileStatus: 'curse'`, so `runMoveEffects` adds it above the move's
  `onHit` and the `-start` precedes the user's `-damage` (pokemon-showdown data/moves.ts:3266-3310, no Champions
  override). The Reg M-C mod sets `volatileStatus: undefined` and its `onHit` pays `directDamage(source.maxhp / 2)`
  and THEN `target.addVolatile('curse')` (pokemon-showdown-mc data/mods/champions/moves.ts:165-194), so the `-damage`
  comes first. `tag_dex` derives `typeSplitMove.costBeforeVolatile` off the handler (written only when true: Reg M-C
  Curse, nothing in Reg M-B); the engine's `typesplit` branch pays the cost first when it is set, and a user the cost
  kills announces its `|faint|` after the `-start`. The `[of]` is `${source}` in `condition.onStart` in both checkouts,
  i.e. the side-and-slot identifier; the engine wrote the species name. Reg M-C narration group J. Knobs
  `MEDI_CURSE_ORDER_FIXED`, `MEDI_CURSE_OF_SPECIES`. Counter `MEDSEEN.curseCostFirst`.
- `data/tags-regmc.json`: the one param added on `moves.curse` (a leaf diff against the full regeneration found exactly
  that leaf; the regeneration itself was discarded because it also re-read the store's usage counts). `data/tags.json`
  and `data/abra-tags.js` are unchanged: the derivation writes nothing for Reg M-B.
- New probe `tests/probe_curse_ghost_order.js` (either regulation): GHOST, AGAIN (already cursed: fails, pays once)
  and PLAIN (non-Ghost self-boost) arms. Green in both; red on the 0.86.1 engine bytes in both (Reg M-C on order and
  name, Reg M-B on the name); red under each knob where it applies.
- Pinned differential, --games 300, --arm middle --steering empirical --end-state, census pins regmc-0d03e83f0e65 / 833a997d7e42, frozen team pools: Reg M-C 259 games, 0 diverged, 0 board-material on both release ec377f6f8159 (base) and 8051cc3c92a7 (fix); Reg M-B 260 games, 2 diverged, 1 board-material on both 7822a83cc49b and 19c1f3a33ed3, the same two games and the same first lines (neither is Curse). Nothing moved.

## [0.89.0] — 2026-09-24

### Fixed
- **White Herb was spent below a pivot's `|switch|` in Reg M-C, where the regulation's herb is not queued.** Reg M-B's
  checkout overrides whiteherb in the Champions mod to QUEUE the restore (data/mods/champions/items.ts:1023-1037,
  order 99), so the pivot's `|switch|` comes first; Reg M-C's mod has no whiteherb entry, so data/items.ts:7658-7705
  stands and `onAnyAfterMove` spends the herb inside `runMove`'s AfterMove, ABOVE the switch `runAction` asks for.
  MEDICHAM used the queued road in both. `pivotFrom` now takes the leaving body and first spends every herb whose tag
  says the restore is immediate (`restoresStats.afterMoveImmediate`, derived by tag_dex); Reg M-B has no such tag and
  keeps `pivotHerbSweep`. This is the pass-10 narration item "White Herb" (Reg M-C pool `…2682994376` t2, Parting
  Shot). Knob `MEDI_HERB_IMMEDIATE_AFTER_PIVOT`.
- New probe `tests/probe_herb_before_pivot_switch.js` (either regulation): Parting Shot into a White Herb holder + a
  no-herb control. Reg M-C: red on the 0.88.0 engine and under the knob, green after. Reg M-B: green before and after
  (the queued order is kept).
- `tests/probe_narration_b_line_order.js`'s `herb` arm stages the Reg M-B mod override; under a regulation whose
  White Herb tag is `afterMoveImmediate` it now prints NOT APPLICABLE instead of a fixture failure it could never pass.
  It was red under Reg M-C before this change for that reason alone.

## [0.88.0] — 2026-09-24

### Fixed
- **A recoil KO's `|faint|` came out above Berserk's boost and Emergency Exit's `-activate` (both regulations).** The
  Champions hit loop drains the faint queue (`faintMessages`, data/mods/champions/scripts.ts:547) BEFORE it pays the
  recoil (:554), so the attacker's recoil KO only queues and its line is written by `runMove`'s own drain
  (sim/battle-actions.ts:347) -- below `afterMoveSecondaryEvent` (:577, Berserk) and the Emergency Exit door (:587).
  MEDICHAM wrote the line where the HP reached zero. The recoil site now queues (`queueFaint`, state unchanged) and a new
  move-tail drain (`drainFaints('moveTail')`) sits below the AfterMove herb and above every switch the action owes.
  This is the pass-10 narration item "Emergency Exit / Berserk timing" (Reg M-C pool `omit-spread …bo3-2682655109` t5).
  Knob `MEDI_RECOIL_FAINT_INLINE`.
- New probe `tests/probe_recoil_faint_below_after_move_secondary.js` (either regulation): Berserk KO + control in both,
  Emergency Exit KO + control in Reg M-C (no Reg M-B carrier). Red on the 0.86.1 engine in both regulations and under
  the knob; green after. Board-material on a pinned Reg M-C `--games 300` differential: see `docs/RUNNING-NOTES.md`.

## [0.87.1] — 2026-09-24

### Fixed
- **probe_court_change reports NOT-IN-REGULATION under Reg M-B instead of exiting 2.** Pass 10 booked its exit 2 ("no legal Court Change learner with a quiet ability") as COULD-NOT-STAGE. It was never a fixture gap: under `gen9championsvgc2026regmb` Court Change is `isNonstandard: 'Past'`, 0 of the format's legal species learn it, and `engine/legal_scope.js` answers NOT-LEGAL. The probe now asks `legal_scope` first and, when the move is out, asserts it three ways (scope code; dex flag and zero legal learners; the TeamValidator refusing a legal body with the move as an existence problem while accepting the same body without it) and exits 0. An in-scope move with no learner is now exit 1, never exit 2. Shown RED on a deliberate break (the arm's Court Change swapped for a pairing-only refusal: exit 1). Reg M-C unchanged: exit 0, knob exit 1. No engine change; no figure moves.

## [0.87.0] — 2026-09-24

### Changed
- **Both MEDICHAM gates re-read on the pass-10 engine; both stay CLOSED.** Reg M-C (`ec377f6f8159`) fails 5 of 10 gating clauses: roster abilities (3 COULD-NOT-STAGE), roster moves (Belch COULD-NOT-STAGE, one red demonstration not caught), whole-game narration (no baseline stamped; 6/12/9 undeclared), mechanics staged (Pixilate and Refrigerate part boards), open-defect (#310, #442 cannot answer). Board-material is 0 on all three lattices and damage is 0/6000 (was 3/6000). Reg M-B (`7822a83cc49b`) fails 4 of 10: the same roster and mechanics clauses, and #442's instrument is red. No engine change. `docs/_reports/2026-09-24-gate-reread-pass10.md`.

## [0.86.1] — 2026-09-23

### Fixed
- **probe_volley_collapse_clamp reads the regulation's own checkout.** It defaulted `SHOWDOWN_PATH` to the Reg M-B checkout, so under `--regulation regmc` it resolved the wrong authority and could only CANNOT-ANSWER. It now requires `engine/showdown_path.js` like its siblings. Reg M-C: exit 0 (9 fixture sets, 0 illegal). No engine change; no figure moves.

## [0.86.0] — 2026-09-23

### Fixed
- **Two Speed-tied bodies at one residual order ran body-major (both regulations).** `fieldEvent('Residual')` sorts its
  handler list once by `comparePriority` (order, priority, speed, subOrder), so at order 5 two tied bodies run BOTH
  Grassy Terrain heals (subOrder 2) before EITHER Leftovers (subOrder 4). The group walk ran each body's whole group in
  turn. `residualGroupPairs` now reads this order's entries off the shadow handler list built at the phase open and,
  only when they interleave bodies, walks one (body, step) pair per entry; the group's steps carry their namespace
  (`stepNs`) so an entry maps to its step. Ambiguous or unmapped groups fall back to body-major, counted. This is the
  pass-9 narration group G (Grassy Terrain against Leftovers): 2 / 6 / 3 first divergences then, 2 / 7 / 5 on the
  0.82.0 lattices. Knob `MEDI_RESIDUAL_BODY_MAJOR`.
- The Rillaboom-mirror variant of group G (both heals Grassy, opposite order) is a tie-die question and is NOT claimed
  here; it is re-read on the next lattice.
- New probe `tests/probe_residual_interleave_tie.js` (either regulation): a Snorlax @ Leftovers opposite a bare Snorlax
  under Grassy Terrain. Green in both; red under the knob and with the 0.85.0 engine bytes. The residual-order probes
  (`probe_residual_shadow`, both trio probes, `probe_endturn_clock_order`) stay green in both regulations.

## [0.85.0] — 2026-09-23

### Fixed
- **A body revived by Revival Blessing that fell again wrote no `|faint|` (Reg M-C).** `TR.faint` is latched once per
  body (`_traceFainted`) and `reviveClear` never reset the latch, so the second death was silent while the authority's
  `faintMessages` writes a line per death. This is the pass-9 narration group D ("`|faint|` line never emitted", 5 / 5 / 5)
  and the recoil and Life Orb "faint order" rows on the 0.82.0 lattice: replayed with `--only-game` on
  `…bo3-2684539964`, the Incineroar knocked out on turn 5 had been revived at 85/170 on turn 4. Engine, not instrument.
  Knob `MEDI_REVIVE_KEEPS_FAINT_LATCH`.
- `tests/probe_regmc_revive.js` gains an AGAIN arm (the revived body Mementos again). Green; red under the knob and with
  the 0.84.0 engine bytes.

## [0.84.0] — 2026-09-23

### Fixed
- **Steel Roller ended the terrain at the bottom of the move (both regulations).** Its clear is its own
  `onHit() { this.field.clearTerrain(); }` (data/moves.ts, both checkouts, no Champions override), which
  `runMoveEffects` raises above `DamagingHit` and above `faintMessages`. So the authority writes `-fieldend` before a
  contact toll's `-damage` and before the target's `|faint|`; the engine wrote it after both. A new step
  `_stepMoveOnHitTerrain` sits beside the move's other `onHit` step; the old WIRE 88 site still serves the doll road
  (`onAfterSubDamage`). Reg M-C narration group F (3 / 8 / 9 first divergences on the pass-9 lattices). Knob
  `MEDI_STEEL_ROLLER_CLEAR_AT_END`.
- New probe `tests/probe_steel_roller_onhit.js` (either regulation). TOLL arm (a derived contact-toll item, Reg M-C
  only) and KO arm. Green in both; red under the knob in both.

## [0.83.0] — 2026-09-23

### Fixed
- **A move that spends its user's type, refused for lacking it, failed with a bare `-fail` (both regulations).** Double
  Shock's and Burn Up's `onTryMove` (data/moves.ts :3954 / :2102, both checkouts, no Champions override) write
  `-fail|<user>|move: <Name>` and `[still]`. The engine's `spendsOwnType` refusal wrote `-fail|<user>`. It now names
  the move (the tag row's display name) through `mvFailNamed`. Reg M-C narration group C (7 / 8 / 12 first
  divergences on the pass-9 lattices); the Reg M-B defect was real too (Burn Up) and simply not in its pool. Knob
  `MEDI_SPEND_TYPE_FAIL_BARE`.
- New probe `tests/probe_spend_type_fail_named.js` (either regulation; members from the `spendsOwnType` tag). Reg M-C:
  Burn Up and Double Shock; Reg M-B: Burn Up. Green; red under the knob in both.

## [0.82.1] — 2026-09-23

### Fixed
- **Three probe reds from pass 9 were the probes, not the engine.** Each was read against the engine first; none needed
  an engine change.
  - `tests/probe_disguise_crit.js` (red under Reg M-C, 3 assertions): it demanded that the Champions mod carry a
    `disguise` override that leaves `onCriticalHit`/`onDamage` alone. The Reg M-C mod has no `disguise` entry at all,
    which satisfies the claim outright; the two knob children re-run that assertion and inherited the red. Now "no
    override, or one touching neither". An override that touches either still fails. Green in both regulations.
  - `tests/probe_volley_collapse_clamp.js` (CANNOT ANSWER in both): it pushed a default `--release 2b5a6585d8cf`, a
    Reg M-B release that Reg M-C refuses and that Reg M-B's protocol-events digest now refuses. No default pin now.
    Green in both regulations, both clamp routes (Endure, Focus Sash) staged; red under `MEDI_HITCOUNT_DROP_ON_COLLAPSE=1`.
  - `tests/probe_ability_zero_boost_line.js` (threw under Reg M-C): it defaulted `SHOWDOWN_PATH` to the Reg M-B checkout.
    It now resolves through `engine/showdown_path.js`. Green in both regulations with SHOWDOWN_PATH unset.

## [0.82.0] — 2026-09-23

### Fixed
- **Reg M-C: Court Change did nothing.** MEDICHAM had no kind for it, so the click reached the terminal pass and a
  Reflect stayed on the side that raised it (the Reg M-C all-mechanics-fire read board STATE; it was the one
  in-scope unproven move). The authority (M-C checkout `data/moves.ts` courtchange :3032-3098; no Champions override)
  walks its own literal `sideConditions` list in `onHitField`, moves each listed condition's STATE to the other side
  (turns and layers intact), fails on `!success`, and writes `-swapsideconditions` then `-activate ... move: Court
  Change`.
- `engine/tag_dex.js` derives `swapsSideConditions` with the list read off the handler (`conditions`, `failsWhenNone`).
  Printed before wiring: Court Change alone in Reg M-C, nothing in Reg M-B (it is `Past` there). So
  `data/tags-regmc.json` gains one catalogue row and one member row, and **Reg M-B's `data/tags.json`,
  `data/abra-tags.js`, `data/protocol-events.json` and `data/move-effects.js` are byte-identical.**
- `swapSideConditions` moves all three places the engine keeps these facts: `sf.sc` (screens, side buffs), `sf.hz`
  with its lay ordinal and setter, and Tailwind (a field counter here). Both sides' lay sequences are raised to the
  larger so a later hazard still sorts last. Knob `MEDI_COURT_CHANGE_UNMODELLED`.
- **Not written: the `-swapsideconditions` line.** Both protocol-events files declare it notEmitted and the driver drops
  the authority's copy; claiming it means regenerating Reg M-B's `data/protocol-events.json`, which this pass may not
  touch. Owed.
- New probe `tests/probe_court_change.js`: SWAP (a foe's Reflect and the user's Tailwind, then Court Change; both
  clocks run out on the side they were moved to) and BARE (nothing up, the move fails). Green; red under the knob and
  with the 0.81.0 engine bytes (16 board diffs). Reg M-B: NOT RUN (exit 2), no legal learner.

## [0.81.0] — 2026-09-23

### Changed
- **Renumbered: this branch's Overdrive entry is 0.80.0** (it was committed as 0.79.0; main's 0.79.0 is the roster
  fixture fix).

### Fixed
- **A refused self-aimed volatile move wrote nothing (both regulations).** A second Focus Energy, Aqua Ring or Ingrain
  is refused by `Pokemon#addVolatile` (present, no `onRestart`), so `didAnything` is false and the authority writes
  `|move|<user>|<Move>||[still]` then `|-fail|<user>`. The engine's announcement in the `affect` branch
  (`_volFail === _landed`) excluded effects aimed at the user, so it wrote neither. This is Reg M-C narration group E
  (Focus Energy; Destiny Bond and Imprison are the same group and are re-read on the next lattice). Knob
  `MEDI_SELF_VOLATILE_FAIL_SILENT`.
- New probe `tests/probe_self_volatile_fail.js` (either regulation). Members are derived from the dex (self-aimed
  Status moves whose whole effect is one volatile with no `onRestart`): Aqua Ring, Focus Energy and Ingrain staged;
  Imprison refused by its own fixture (it seals the foes' Protect, so their scripted click is not on the request).
  Green in both regulations; red under the knob (3 arms).

## [0.80.0] — 2026-09-23

### Fixed
- **Reg M-C: every Substitute blocked Overdrive.** The substitute condition's `onTryPrimaryHit` returns early on
  `move.flags['bypasssub']` (data/conditions.ts, both checkouts; no Champions override). No artifact the engine read
  carried that flag, so `engine/medicham2-browser.js` held `SUBPASS`, a hand-typed literal of 51 ids. Overdrive is the
  one legal Reg M-C member it lacked (it is `Past` in Reg M-B), so the doll ate it: a BOARD defect, and the reason the
  Reg M-C damage differential exited 1 on its substitute-bypass conformance clause.
- `engine/tag_dex.js` derives a new move tag, `bypassesSubstitute`, off `flags.bypasssub`. Printed before wiring: 51
  moves in Reg M-B (exactly the old literal) and 52 in Reg M-C (the literal plus Overdrive). `sound` is not a proxy:
  Clangorous Soul is a sound move without the flag. `subBlocks` asks the tag; the literal is kept only as the revert,
  knob `MEDI_SUBPASS_HANDLIST`. An empty tag set counts `MEDFAILS.subpassNoTag`.
- **Reg M-B tag change, approved by the coordinator on the Ice Spinner terms.** `data/tags.json` gains one catalogue
  row and one tag + param on 51 existing move rows. A leaf-by-leaf structural diff against the committed file found
  **0 existing values moved** (215 lines added, 0 removed). `data/abra-tags.js` rebuilt (`build_tags_js.js --check`
  green). `data/protocol-events.json` and `data/move-effects.js` untouched. Reg M-B behaviour is unchanged by
  construction (the set is identical).
- New probe `tests/probe_substitute_bypass_tag.js` (either regulation). Reg M-C: Toxtricity's Overdrive into a
  Baxcalibur behind a Substitute, control Nuzzle (the doll takes it on the authority). Green; red under the knob and
  with the 0.78.0 engine bytes (the board parts). Reg M-B: green (Snarl, control Mud-Slap).
- Damage differential `--n 6000 --seed 20260804`: Reg M-C 0/6000 and **exit 0** (was exit 1 on the conformance
  clause alone); Reg M-B 0/6000, exit 0. Written to `data/verification/pass10/engine-diff{,-regmc}.json`, not
  republished.
## [0.79.0] — 2026-09-23

### Fixed
- **The last refused roster fixtures are rebuilt legal. None was kept, baselined or scoped out.** Distinct refused
  sets (items / abilities / moves, + rule-built) went from **0 / 6 / 3 (+2) to 0 / 0 / 0 (+0)** under Reg M-B and from
  **0 / 7 / 3 (+2) to 0 / 0 / 0 (+0)** under Reg M-C. Measured by `tests/probe_roster_fixture_legality.js --strict`
  (exit 0 in both). No row lost its staging in either regulation.
  - **Skill Swap lender.** The lender is now a legal Skill Swap learner holding a lendable ability. Lendable means
    quiet, or announces-only. Announces-only is `fieldFamilyBranch`'s own derived class, and under both regulations
    its only member is Frisk. The derived lender is Gourgeist-Super lending Frisk. On a board where Focus Energy stays,
    the lender idles on Sleep Talk only when the script proves that no sleep click can reach its slot. A lender that
    never attacks is exempt from the crit guard. Knob: `ROSTER_SWAPPER_UNREPAIRED=1`. With the knob on, Reg M-B
    abilities again refuse 5 sets, plus 2 rule-built.
  - **Heal Bell.** Chimecho clicks it. Chimecho is the only learner, and its one ability, Levitate, is admitted only on
    a board proven free of Ground clicks, terrain, hazards and field conditions.
  - **Roost.** Noivern clicks it, holding Frisk. Nothing on that board holds an item, so Frisk says nothing.
  - **Transform.** Ditto, holding Limber, clicks it once: at the foe in the subject arm, at its partner in the control
    arm. Ditto is the only learner and learns nothing else. Limber is admitted because nothing on the board writes
    paralysis.
- **The controls still separate.** 13 changed rows (Reg M-B) and 7 (Reg M-C) were played in both engines (named in
  the report). Each reads FIRED-AND-BOARDS-MATCH, and the engines disagree nowhere in either arm.

### Notes
- **No roster stage was run** (light mode). The six stage commands are owed:
  `docs/_reports/2026-09-23-roster-last-refusals.md`.

## [0.78.0] — 2026-09-23

### Fixed
- **`tests/roster.js`'s text view no longer throws on Reg M-B's frozen Hidden Power text (16 typings).** The view (now
  `tests/roster_text_view.js`) leaves an entity whose `desc`/`shortDesc` is a frozen own property unwrapped, and it
  counts that entity. A Proxy may not report another value for such a property. Iron Fist, Mega Launcher, Reckless,
  Sharpness, Strong Jaw, Technician and Tough Claws stage again. Guard: `tests/test-roster-text-view.js`, shown red
  with the guard removed.
- **Roster fixtures that the TeamValidator refused are repaired, and none was baselined.** The distinct refused sets
  went from 17 / 77 / 47 (+2 rule-built) to **0 / 6 / 3 (+2)** under Reg M-B, and from 17 / 80 / 47 (+2) to
  **0 / 7 / 3 (+2)** under Reg M-C. This is measured by the new `tests/probe_roster_fixture_legality.js`, which builds
  every arm `runEntry` plays and reproduced HEAD's receipts exactly. The main repairs:
  - the control click resolves per body where one holder cannot learn the scenario's click;
  - a second restaging pass demands Focus Energy where it stays;
  - move-stage clickers, ability carriers, partners, pivots and phazers now learn what they click;
  - and five one-row causes are fixed (Focus Band, Big Root, Merciless, Imposter, Limber).
  The rule-level legal picks run only in a re-match of a row that the restaging could not make legal (`LEGAL_FIRST`).
  **No row lost its staging in either regulation.** The fixtures that changed are exactly the rows that held a refused
  set.

### Notes
- **Still refused, and not carrier-less**:
  - the in-play Skill Swap lender. Asked of the format, no legal quiet-ability species learns Skill Swap in either
    regulation. It sits on the control arm of 84 / 90 rows. This is a decision, not a repair.
  - Heal Bell. Its sole learner, Chimecho, holds only Levitate.
  - Roost (a HELD row).
  - Transform. Its sole learner, Ditto, learns nothing else.
- **No roster stage was run** (light mode). The stage commands and the verdict reading are owed:
  `docs/_reports/2026-09-23-roster-fixture-legality.md`.
## [0.77.1] — 2026-09-23

### Fixed
- `tests/probe_narration_d.js` typed Reg M-B's `'Attack'` in two Hyper Cutter fixture shape checks. Under Reg M-C the
  authority writes `'atk'`, so the FIXTURE read as not staged. It now reads the label off the selected authority's
  handler, and it is green in both regulations.

### Notes
- **The pass-9 re-runs on the final engine** (Reg M-B `56fc6976821e`, Reg M-C `ca7aa5f578ed`) went to
  `data/verification/*.pass9*.json`. Nothing published was rewritten; MEASURE republishes from main.
  - Damage differential: Reg M-C 0/6000 (it still exits 1, on Overdrive's `SUBPASS` conformance alone) and Reg M-B 0/6000.
  - Census: Reg M-B 1006/1006 and Reg M-C 1010/1010.
  - `all-mechanics-fire`, Reg M-C: in-scope unproven 7 → 1 (Court Change), and diverging abilities 8 → 1 (Illusion,
    the declared exclusion). Reg M-B is unchanged.
  - Lattices, Reg M-C: board-material 0/954, 0/1266 and 0/1497; protocol-only 64 → 26, 82 → 38 and 92 → 41.
  - Lattices, Reg M-B: 0/961, 0/1069 and 0/1497.
  - Reg M-B held-out 12,000: 1 → 0 board-material games of 7,182 (the same sample, 1 void), so the Ceaseless Edge game is closed.
- **Stopped, per the brief (a Reg M-B `data/tags.json` change):** Court Change (MEDICHAM has none) and Overdrive in
  `SUBPASS`. Full account: `docs/_reports/2026-09-23-engine-gate-reds.md`.

## [0.77.0] — 2026-09-23

### Fixed
- **Reg M-C: seven in-scope mechanics were unproven in `all-mechanics-fire-regmc`. The fixtures were the gap, not the
  format.** The fixes are in `engine/stage_planner.js`, and every shape is read off a handler or a tag param:
  - **Liquid Ooze** (`onSourceTryHeal`): the planner made the holder drain. A `Source` heal handler needs the RECEIVER
    to heal off the holder, so the receiver is now chosen to carry a drain move. The heal event runs before the
    full-HP test (`sim/battle.ts` heal()).
  - **Stakeout** (`damageBoost.onlyWhen = targetFreshlyArrived`): the receiver switches on the trigger turn, and the
    holder hits the arrival.
  - **Binding Band** (no handler; read in the `partiallytrapped` condition's onStart): the holder clicks a move whose
    `volatileStatus` is that condition. A bearer that learns none is refused, and the next bearer is tried.
  - **Emergency Exit** (`switchesOutAtHalf`): a halving move (damageCallback) takes the holder from full to half. The
    control swaps that click for the receiver's Protect. Before this, the row had NO control, because Golisopod has
    one ability.
  - **Court Change** (a literal side-condition list and `if (!success) return false`): the receiver raises one of the
    listed conditions first.
  - **Revival Blessing** (`revivesFainted.failsWithoutFainted`): the partner clicks a move that faints its user
    (tag `userFaints`, self-aimed first), and the bench replaces it.
  - **Aura Guard** had NO ROW. `engine/legal_scope.js` re-admits it through the TeamValidator (Lucario @ Lucarionite
    Z), but the planner's universe and `all_mechanics_fire`'s population both kept the strict `!isNonstandard`
    filter. Both now take the scope's re-admissions, and they print them. `tests/test-stage-planner.js` counts its
    population the same way.
- `engine/stage_planner.js --tags <path>` plans off a named tag file. The CLI default reads `data/tags.json`, which
  is Reg M-B's catalogue even under `--regulation regmc`.
- Measured (`--only` the seven, release `ca7aa5f578ed`, written to
  `data/verification/all-mechanics-fire-regmc.pass9-item4.json`, not republished): Liquid Ooze, Stakeout, Emergency
  Exit, Aura Guard and Binding Band read FIRED with a control. Revival Blessing is resolved on both engines with the
  board clean. **Court Change is resolved on the authority and not on MEDICHAM, and the board reads STATE**
  (the authority moves Reflect across; ours leaves it). MEDICHAM has no Court Change at all. The fix needs a new
  derived tag, which adds a catalogue row to Reg M-B's `data/tags.json`, so it was stopped and reported rather than
  made (`docs/_reports/2026-09-23-engine-gate-reds.md` §4).
- The Reg M-B plan is unchanged: 964 mechanics and 0 changed fixtures (measured by diffing the plan before and after).
  `tests/test-stage-planner.js` is green in both regulations. No engine byte moved.

## [0.76.0] — 2026-09-23

### Fixed
- **Reg M-C: Inner Focus, Oblivious, Own Tempo and Scrappy (and Hyper Cutter and Big Pecks) wrote `-fail|…|unboost|Attack`
  where the authority writes `atk`.** The Reg M-B checkout's handlers write `this.add('-fail', target, 'unboost',
  'Attack', ...)` (`data/abilities.ts` innerfocus :2150). The Reg M-C checkout's handlers write the stat id: `'atk'`
  (:2160), and `'def'` for Big Pecks. medicham2's `STAT_LABEL` is the Reg M-B spelling. This is narration only, and
  the boards agree. It is the four "diverging" abilities of the Reg M-C `all-mechanics-fire`. `engine/tag_dex.js`
  now reads the literal into `preventsStatDrop.failLabel` where it is a stat id, and writes it only then.
  `data/tags-regmc.json` moves by those six rows, and `data/tags.json` stays byte-identical. The engine writes the
  handler's label when the tag carries one. Nothing is keyed on the regulation id. Knob `MEDI_REFUSAL_LABEL_DISPLAY`.
- **Why the roster called them clean.** The roster's `ability/stat-drop-reaction` rule grades BOARDS
  (FIRED-AND-BOARDS-MATCH), and the boards were right. `all_mechanics_fire` grades the protocol line as well. Both
  instruments were right about what each one reads.
- `tests/probe_intimidate_reactors.js` gains the four arms. They are green in both regulations. In Reg M-C they are
  red under the knob and on `485d0a6840ad` with the 0.70.0 bytes. In Reg M-B the knob moves nothing, as it should.
  There is also a new census row, registered where Inner Focus has a legal carrier (both regulations). Its expected
  label is read off the selected authority's handler.

## [0.75.0] — 2026-09-23

### Fixed
- **Reg M-C: Rattled never answered Intimidate.** The handler (`data/abilities.ts` rattled; no Champions override; no
  Reg M-B carrier) is `onAfterBoost(boost, target, source, effect) { if (effect?.name === "Intimidate" && boost.atk)
  { this.boost({ spe: 1 }); } }`. The drop lands and Speed rises, with a `-ability|<holder>|Rattled|boost` line. The
  `boostsWhenLowered` derivation needed a `< 0` in the handler, so it dropped Rattled. The Reg M-C all-mechanics-fire
  read a STATE divergence (Persian-Alola at spe +1 on the authority and 0 here). `engine/tag_dex.js` now admits the
  effect-gated shape as `onlyFrom` / `whenStat` / `quietAtCap` (`quietAtCap` because the call passes neither isSelf nor
  isSecondary, so a capped raise writes no zero line). These are written only on that shape. `data/tags-regmc.json`
  moves by the rattled row and the catalogue's `n`. `data/tags.json` stays byte-identical. The only road that passes
  the effect and the landed stat is `applyStatDrop` (Intimidate), so every other drop road keeps its meaning. Knob
  `MEDI_RATTLED_IGNORES_INTIMIDATE`.
- **Why the roster called it clean.** The roster's Rattled rule is `ability/speeds-up-when-hit-by-a-type`
  (`onDamagingHit`). It staged a Crunch and never an Intimidate.
- `tests/probe_intimidate_reactors.js` gains the RATTLED arm, with a Fur Coat Persian-Alola as the control. It is green
  in Reg M-C, and red under the knob and on `485d0a6840ad` with the 0.70.0 bytes. It also has a new census row
  (`boostsWhenLowered`), registered where a legal carrier exists.

## [0.74.0] — 2026-09-23

### Fixed
- **Reg M-C: Guard Dog refused Intimidate with a bare `-fail` and never raised its Attack.** The handler
  (`data/abilities.ts` guarddog; no Champions override; no Reg M-B carrier) deletes the drop and then calls
  `this.boost({ atk: 1 }, target, target, null, false, true)`. So the authority writes
  `-ability|<holder>|Guard Dog|boost` and `-boost|<holder>|atk|1`, and no `-fail`. The Reg M-C all-mechanics-fire read
  it as a STATE divergence (Mabosstiff at atk +1 on the authority and 0 here). `engine/tag_dex.js` now reads
  `preventsStatDrop.answersWith` off the self-boost call and writes it only when present, so `data/tags.json` stays
  byte-identical and `data/tags-regmc.json` moves by the guarddog row. `refuseStatDrop` answers through
  `abilityBoostRun`, which is the same road Defiant takes. Knob `MEDI_GUARD_DOG_REFUSES_ONLY`.
- **Why the roster called it clean.** The roster's shape rule for Guard Dog is `ability/refuses-a-forced-switch`
  (`onDragOut`). It stages a Roar and never an Intimidate, so the `onTryBoost` half was never played. Its
  FIRED-AND-BOARDS-MATCH verdict is true of the half it staged.
- New probe `tests/probe_intimidate_reactors.js` (either regulation). It has the GUARDDOG arm, with a Stakeout
  Mabosstiff as the control. It is green in Reg M-C, and red under the knob and on `485d0a6840ad` with the 0.70.0
  bytes. In Reg M-B it reads NOT RUN (exit 2), because there is no carrier. New census row (`preventsStatDrop`),
  registered only where a legal carrier exists. Reg M-C census 1007 → 1008 live (worktree, not republished).

## [0.73.0] — 2026-09-23

### Fixed
- **A multi-hit volley into an intact Mimikyu now follows each regulation's Disguise.** The Reg M-B Champions mod
  overrides Disguise (`data/mods/champions/abilities.ts:14-33`): it sets `this.effectState.neutral` on arrival 1 and
  returns 0 on the later arrivals, before its species test. So arrivals 2..N stay **neutral** after the bust. The Reg
  M-C mod has no disguise entry. Mainline (`data/abilities.ts:970-1016`) asks `target.species.id` on every arrival.
  `onUpdate` makes the body Mimikyu-Busted between arrivals, so the later arrivals take their **real** matchup.
  Three defects, one mechanic:
  - **Reg M-B battle (board).** The per-arrival re-price read the busted forme's real matchup. Pin Missile into
    Mimikyu left MEDICHAM on 110/130 against the authority's 97/130. It is now held (`_flatHeld`, set at the bust seam
    and cleared when the volley ends; `MEDSEEN.effFlattenHeldThroughVolley`). This defect predates this pass. No
    instrument had staged it.
  - **Reg M-C price.** `dmgRange` held arrival 1's neutral for the N-1 arrivals left. `forretress pinmissile ->
    mimikyu` read 96-112 against the authority's x5 24-28 in the Reg M-C damage differential. The price now prices
    those arrivals on the busted forme (`asBustedForme`, a rename that the tag's `sameStats`/`sameTypes` make complete).
  - **Reg M-C narration.** The arrivals after the bust were announced with arrival 1's effectiveness, so the
    `-resisted` line was missing. It is now re-read at the bust seam.
- `engine/tag_dex.js`: `flattensTypeMatchup.endsWithSpecies` is written when the handler gates on the species and holds
  no `effectState`. It is written only when true. `data/tags-regmc.json` moves by the disguise row, and
  `data/tags.json` stays byte-identical. Knob `MEDI_DISGUISE_VOLLEY_OLD`.
- `tests/probe_volley_first_hit_shield.js` gains the DISGUISE arm (Toxapex Pin Missile into Mimikyu). What the authority
  does after the bust is read off its own handler. It is green in both regulations. It is red under the knob and on
  `89ac57f1f81b` (board) / `485d0a6840ad` (price, narration) with the 0.70.0 bytes.

## [0.72.0] — 2026-09-23

### Fixed
- **`dmgRange` priced a multi-hit volley into a full-HP Multiscale body with the cut on every arrival.** Multiscale
  (`data/abilities.ts`, both checkouts; the Champions mod does not override it) halves the damage only while
  `target.hp >= target.maxhp`, and that is asked inside each arrival's `getDamage`. Arrival 1 leaves the body below
  full HP, so arrivals 2..N take the whole hit. The flat road priced every arrival off one band. This was the Reg M-C
  damage differential's `scizormega dualwingbeat -> dragonitemega` (authority x2 61-73, MEDICHAM 40-48) and
  `heracrossmega pinmissile -> dragonitemega` on `485d0a6840ad`. **The battle was already right**, because `_stepApply`
  re-prices each arrival against the HP the previous arrival left. The fix is therefore on the price road only
  (`!hit.wantPackets`). `_volleyFullHPSplit` asks `dmgRangeOneHit` with and without the from-full clause (new
  `noFullHP` argument), and it splits only when the two differ, so Mold Breaker and a body already below full HP keep
  their one owner. Counter `MEDSEEN.volleyFullHPSplit`. Knob `MEDI_VOLLEY_SHIELD_EVERY_ARRIVAL`.
- New probe `tests/probe_volley_first_hit_shield.js` (either regulation). Kangaskhan's Double Hit goes into a Multiscale
  Dragonite, with an Inner Focus Dragonite as the control. The authority halves arrival 1 only (19 then 39, against
  39 then 39). The battle boards agree. The price reads 58 against the authority's 58. It is red under the knob and on
  `485d0a6840ad` / `89ac57f1f81b` with the 0.70.0 bytes (price 38).

## [0.71.0] — 2026-09-23

### Fixed
- **Reg M-B: Stone Axe and Ceaseless Edge no longer lay their hazard for a user a contact toll knocked out.** The two
  authorities disagree. Reg M-B's checkout keeps `source.hp` in the move's own `onAfterHit` (`data/moves.ts` stoneaxe
  :18072-18078, ceaselessedge :2229-2235). Reg M-C's checkout dropped it (:18078-18084, :2229-2235). Both Champions
  `spreadMoveHit`s raise `AfterHit` with no HP test, so the handler decides. 0.60.0 read only the Reg M-C checkout and
  changed both regulations. The Reg M-B held-out 12,000 draw on `89ac57f1f81b` parted on it (Ceaseless Edge into Rough
  Skin: MEDICHAM 2 Spikes layers, Showdown 1). `engine/tag_dex.js` now reads `hazardOnHit.laysForFaintedUser` off the
  handler and writes it only when true. `data/tags-regmc.json` moves by the stoneaxe and ceaselessedge rows, and
  `data/tags.json` stays byte-identical. The engine lays for a fainted user only when the tag says so. Knob
  `MEDI_HAZARD_ON_HIT_FAINTED_ALWAYS`.
- `tests/probe_regmc_hazard_on_hit_fainted_user.js` plays both regulations (`anyRegulation`), stages each move on its own
  (Stone Axe was never staged before), and reads what the FAINTS arm expects off the authority's handler. Reg M-B has no
  legal contact-toll item, so finer chip steps were added. Reg M-B is green clean, and red under the knob and on
  `89ac57f1f81b` with the 0.70.0 bytes. Reg M-C is green, and red under `MEDI_HAZARD_ON_HIT_NEEDS_LIVE_USER`.
- New census row (`tests/test-mechanics.js`, `hazardOnHit`): Stone Axe from a 1 HP Kleavor into Rough Skin. Its
  expectation is read off the selected authority's handler. Census 1004 → 1005 (Reg M-B) and 1006 → 1007 (Reg M-C), all
  live. It is MISSING under the knob.

## [0.70.0] — 2026-09-23

### Changed
- **Both MEDICHAM gates were read in main on the finished engine.** One release was cut per regulation: Reg M-B
  `89ac57f1f81b` and Reg M-C `485d0a6840ad`. The pass regenerated both censuses (1004/1004 and 1006/1006 live, each
  pinned), every roster stage, every team lattice, both `all-mechanics-fire` runs and both damage differentials, and
  ran the Reg M-B 12,000-game held-out draw. No engine, test or tool byte moved.
- **Reg M-B gate: CLOSED, 3 of 10.** All three failing clauses are the roster, and all three causes are the ruler.
  (1) The re-run roster now carries `fixture_legality`, and the refused fixture sets (items 17, abilities 77,
  moves 47) count against the clause. The previous artifacts carried no such block. (2) `tests/roster.js`'s text
  proxy throws on Reg M-B's frozen `''` Hidden Power text, which leaves 7 abilities COULD-NOT-STAGE (Iron Fist, Mega
  Launcher, Reckless, Sharpness, Strong Jaw, Technician, Tough Claws). 0 DIFFER and 0 DID-NOT-FIRE in every stage.
  That abilities reading is **not republished**: it would put a ruler loss behind the published "196 of 200". It is
  kept at `data/verification/roster.abilities-89ac57f1f81b-proxy-threw.json`, and the clause reads STALE until the
  ruler is fixed.
  Board-material is 0/961, 0/1069 and 0/1497; narration is 0; the damage differential is 0/6000.
- **Reg M-C gate: CLOSED, 7 of 10.** Real reds, ENGINE-owned: multi-hit volleys into Multiscale and Disguise
  (`engine-diff-regmc` 3/6000), and the Intimidate-reaction abilities (Inner Focus, Oblivious, Scrappy, Own Tempo;
  Guard Dog and Rattled read STATE) in `all-mechanics-fire-regmc`. Also 7 unproven in-scope mechanics. CANNOT-ANSWER:
  the narration baseline is unstamped (a decision) and `register-reality-regmc` has never been run. Board-material is
  0/955, 0/1266 and 0/1497.

### Notes
- **Reg M-B held-out, `--games 12000`: 1 board-material game of 7,182.** Ceaseless Edge lays a Spikes layer after its
  user faints to Rough Skin. MEDICHAM reads 2 layers and Showdown reads 1. The previous draw, on `2e9db8bb11fd`, read 0.
  ENGINE owns it.
- Full account and the OWED list: `docs/_reports/2026-09-23-gates-on-finished-engine.md`.

## [0.69.1] — 2026-09-23

### Fixed
- **`tests/probe_protean_contrary.js --regulation regmc` was red on its `itemboost` lead ("NOT STAGED").** The
  lead derives every legal item that raises a stat. Reg M-B has none, so the lead reads FALSE there. Reg M-C makes
  the four terrain seeds legal (`boosts` def/spd +1, no Champions override), so the derivation found them and the
  lead had no arm to stage. This was red from the 0.62.0 engine on. **It was a fixture gap, not an engine defect.**
  The lead now stages Malamar (Contrary) with a seed on two roads: Electric Seed on Pincurchin's Electric Surge
  (`onTerrainChange`), and Psychic Seed on switching in to Indeedee's Psychic Surge (`onStart`). Each is a `check`
  arm against the same Malamar on Suction Cups. The authority reads -1 against +1, and both engines agree on every
  board at both pins. The arms are staged only when the seed is legal, so Reg M-B keeps its FALSE verdict.

### Notes
- Probe: Reg M-C **50 of 50 arms clear** (release `485d0a6840ad`). Reg M-B **42 of 42 clear**, itemboost FALSE
  (release `89ac57f1f81b`). No engine byte moved, so no lattice was re-run.

## [0.69.0] — 2026-09-22

### Changed
- **The lab was re-measured on the 0.68.0 engine.** Reg M-C used release `485d0a6840ad` and Reg M-B used
  `89ac57f1f81b`. Both censuses and all three Reg M-C roster stages were regenerated.
  - **Census.** Reg M-C `data/mechanics-census-regmc.json` reads **1006 / 1006 live**. Reg M-B
    `data/mechanics-census.json` reads **1004 / 1004 live**. Both have run_ok true and no row changed status.
  - **Reg M-C roster** (`--reds --write`, every stage exits 0):
    - items 166 of 166 FIRED-AND-BOARDS-MATCH;
    - abilities 210 MATCH, 3 ANNOUNCEMENT-ONLY, 1 DEFERRED-BY-OWNER (Illusion);
    - moves 510 MATCH, 1 DEFERRED-BY-OWNER (Copycat).
  - **No COULD-NOT-STAGE, BELOW-USAGE-SHELF, DIFFER or DID-NOT-FIRE row is left in any stage.** On 0.63.0 there were 22
    COULD-NOT-STAGE rows and 2 shelf rows. No rule failed its red demonstration, and no plant anchor is dead.

### Notes
- Pinned lattices, bar `games − games_board_never_diverged`: Reg M-C 1200 **0 of 954**, 1350 **0 of 1075**, 1950
  **0 of 1537**. Reg M-B 1200 **0 of 961**, 1350 **0 of 1069**, 1950 **0 of 1497**. Reg M-B data files byte-identical.
- The Reg M-B held-out draw is owed: 0.67.0 is a shared rule. Full account and the OWED block:
  `docs/_reports/2026-09-22-regmc-engine-8.md`.

## [0.68.0] — 2026-09-22

### Fixed
- **Jaw Lock traps both bodies under Reg M-C.** Its own `onHit` is `source.addVolatile('trapped', target, move,
  'trapper'); target.addVolatile('trapped', source, move, 'trapper');` (data/moves.ts jawlock; no Champions override;
  Reg M-B has no legal Jaw Lock). medicham2 had two `trapsTarget` doors, a status click (`kind:'trapmove'`) and a
  secondary (Spirit Shackle). A damaging move whose own `onHit` traps reached neither, so Jaw Lock landed its damage and
  trapped nobody.
  - `engine/tag_dex.js` writes `alsoUser: true` on that shape, and only there.
  - medicham2 traps the source and then the target on the hit, each refusing a repeat or a Ghost silently, as
    `addVolatile` does.
  - `data/tags-regmc.json` moves by the jawlock row only. `data/tags.json` is unchanged. Knob `MEDI_JAW_LOCK_INERT`.
- The Reg M-C roster found it. Its Jaw Lock row sat below the usage shelf with an underlying DIFFER: `vol.trapped` read 1
  on both bodies there and 0 here, and the authority refused the target's switch while this engine let it go. On release
  `485d0a6840ad` the row reads MATCH, and Bounce's row (0.67.0) reads MATCH too.
- `tests/probe_regmc_jaw_lock.js` has four arms: LOCK, GHOST, CONTROL and REFUSED. It exits 0 clean. It exits 1 under the
  knob and with the 0.63.0 engine bytes. A Ghost the hit knocks out traps nobody on the authority, and this engine agrees.

## [0.67.0] — 2026-09-22

### Fixed
- **Protean and Libero change their holder's type on a two-turn move's charge turn, in both regulations.** On a spent
  charge turn, `twoturnmove.onStart` ends `this.runEvent('PrepareHit', attacker, defender, effect)` under the comment
  "Run side-effects normally associated with hitting (e.g., Protean, Libero)" (data/conditions.ts :311-312). The line is
  identical in both checkouts, and neither mod overrides it. medicham2 converted only at the hit, so a Libero Cinderace
  winding up Bounce stayed Fire where the authority read Flying.
  - `engine/medicham2-browser.js` calls `proteanConvert` where the charge wrapper is added.
  - The release turn converts nothing more (once per entry), and a weather-skipped charge still converts at the hit.
  - No tag moved. Knob `MEDI_CHARGE_NO_PREPAREHIT`. Counter `MEDSEEN.proteanOnChargeTurn`.
- The Reg M-C roster found it. Its Bounce row sat below the usage shelf with an underlying DIFFER on `types`.
- `tests/probe_charge_turn_protean.js` has two arms, CHARGE and CONTROL. It is green clean in both regulations: Reg M-C
  stages Greninja and Bounce; Reg M-B stages the same pair. It is red under the knob in both, and red on the 0.63.0 bytes
  in both.
- `tests/regmc_probe_kit.js` gains `open(name, knobs, { anyRegulation: true })`, so a shared-rule probe runs under
  either regulation. Every existing caller is unchanged.

## [0.66.0] — 2026-09-22

### Fixed
- **Run Away frees its holder from a trap under Reg M-C.** The Champions mod gives Run Away `onTrapPokemonPriority: -10,
  onTrapPokemon(pokemon) { pokemon.trapped = false; }` and the same on `onMaybeTrapPokemon`
  (data/mods/champions/abilities.ts runaway :71-81). That is Shed Shell's priority and Shed Shell's line, so it clears a
  Block/Mean Look trap, a partial trap and an ability trap alike. medicham2 read `escapesTrap` off the ITEM only. The tag's
  own note said "NO ability does", which was true of Reg M-B, whose Run Away has no handler.
  - `engine/tag_dex.js` derives the ability `escapesTrap` with the item's predicate. Membership: Reg M-C Run Away alone;
    Reg M-B none.
  - `switchTrapVerdict` reads it beside the item's.
  - `data/tags-regmc.json` gains the runaway row and its catalogue entry. `data/tags.json` is unchanged. Knob
    `MEDI_RUN_AWAY_TRAPPED`.
- The Reg M-C roster (0.64.0, `ability/escapes-a-trap`) found it: DID-NOT-FIRE on release `aa7b45c6b8d2`, where the
  authority let the holder go and this engine kept it. It reads MATCH on release `23728e90d20e`, and its break is CAUGHT.
  Shed Shell still reads MATCH.
- `tests/probe_regmc_run_away.js` has three arms: HARD (Block), PARTIAL (Infestation) and CONTROL (the authority refuses
  the switch). It exits 0 clean. It exits 1 under the knob and with the 0.63.0 engine bytes.

## [0.65.0] — 2026-09-22

### Fixed
- **Stakeout doubles only a hit into a body that arrived this turn.** Its handler is `if (!defender.activeTurns) return
  this.chainModify(2)`, on `onModifyAtk` and `onModifySpA` (data/abilities.ts stakeout; no Champions override). The tag
  carried `onlyWhen: null`, so medicham2's untyped `attackStat` branch (Hustle's) paid a PERMANENT x2 on every physical
  hit and nothing on a special one. `engine/tag_dex.js` now names `onlyWhen: {cond: 'targetFreshlyArrived'}` and `onStat:
  'any'`, for this shape only; membership over both dexes is Stakeout alone. medicham2 pays the x2 when `def._newlySwitched`
  is set, which is the engine's `activeTurns === 0` and the same field Speed Boost's gate reads. `data/tags-regmc.json`
  moves by the stakeout row only. Reg M-B has no carrier, so `data/tags.json` is unchanged. Knob
  `MEDI_STAKEOUT_UNCONDITIONAL`.
- The Reg M-C roster (0.64.0, `ability/doubles-into-a-fresh-arrival`) found it: DIFFER on release `aa7b45c6b8d2`, where
  the authority read 1009 HP on the arrival and this engine read 934. It reads MATCH on release `a98c181dbe2f`, and its
  break (the knob) is CAUGHT.
- `tests/probe_regmc_stakeout.js` has three arms: FRESH (the arrival hit on turn 1, the settled body on turn 2), LEAD and
  CONTROL. It exits 0 clean. It exits 1 under the knob and with the 0.63.0 engine bytes (`--medi` release
  `aa7b45c6b8d2`).

## [0.64.0] — 2026-09-22

### Changed
- **The Reg M-C roster stages the 22 rows it could not stage.** Each of the 22 read COULD-NOT-STAGE on every Reg M-C
  roster (12 items, 9 abilities, Milk Drink). Fifteen fell to a residue rule that only holds, attacks and is attacked, so
  the handler never met the thing it waits for; two were claimed by a rule that cannot build their gate, and five were
  parsing or fixture faults. `tests/roster.js` now builds that thing, and every body in it is derived
  (`learnerBody`, `quietBody`, `hitInBand`):
  - Items, six new shape rules: `item/pops-on-a-hit` (Air Balloon), `item/tolls-a-contact-attacker` (Rocky Helmet),
    `item/partial-trap-chip` (Binding Band), `item/leaves-on-a-hit` (Eject Button, Red Card, one turn so the vacated slot
    is not handed a click), `item/spent-when-its-terrain-starts` (the four seeds) and `item/type-gem` (Normal Gem).
    Terrain Extender: the description's slash list ("Electric/Grassy/Misty/Psychic Terrain") is read as four moves, and
    the rule's break gains the terrain half. Leek: the crit-ratio handler is asked with one of its own `itemUser` bodies,
    and that body holds it.
  - Abilities, seven new shape rules: `ability/speeds-up-when-hit-by-a-type` (Rattled), `ability/reverses-a-drain`
    (Liquid Ooze), `ability/takes-the-type-of-its-own-click` (Libero; Protean moves here from the generic rule),
    `ability/escapes-a-trap` (Run Away), `ability/leaves-at-half` (Emergency Exit), `ability/doubles-into-a-fresh-arrival`
    (Stakeout) and `ability/stat-multiplier-under-a-terrain` (Grass Pelt). `ability/unconditional-stat-multiplier` no longer
    claims a handler gated on `activeTurns` or a terrain. `ability/base-power-scoped` refuses a click with its own `onTry`
    (it picked Snore for Punk Rock) and falls back to a spread click inside the scope when the carrier learns no
    single-target one. Harvest searches for an aggressor when the cast one has no hit in the band.
  - Milk Drink: `engine/game_differential.js` `scripted()` honours `{ ally: true }` for an `adjacentAllyOrSelf` click. It
    used to aim that class at the user's own slot whatever the script said.

### Fixed
- **The moves stage's plant anchor `move/needs-the-terrain-it-names` is re-aimed.** Terrain Extender (0.29.0) changed the
  literal `field.terrainT=5` to `terrainTurns(_t,m.item)`, and the anchor then matched 0 times on every release after it,
  so the stage exited 1 on its instrument. The code path is unchanged, and the anchor now names it. `--rule
  move/needs-the-terrain-it-names --reds` reads CAUGHT via Steel Roller.

### Notes
- Measured on release `aa7b45c6b8d2` (the 0.63.0 engine), subset runs with `--reds`. Items: 12 of 12 FIRED-AND-BOARDS-MATCH,
  and all 8 rules involved (6 new, `crit-ratio`, `extends-a-duration`) CAUGHT. Moves: Milk Drink MATCH. Abilities: Emergency
  Exit, Grass Pelt, Harvest, Libero, Liquid Ooze, Punk Rock and Rattled MATCH (Protean MATCH under its new rule).
  **Stakeout reads FIRED-AND-BOARDS-DIFFER and Run Away DID-NOT-FIRE.** Both are engine defects, fixed in 0.65.0 and
  0.66.0. The full stages are re-run at 0.69.0. Full account: `docs/_reports/2026-09-22-regmc-engine-8.md`.

## [0.63.0] — 2026-09-22

### Changed
- **The lab was re-measured on the 0.62.0 engine (release `aa7b45c6b8d2`).** Both censuses and all three Reg M-C roster
  stages were regenerated.
  - Census: Reg M-C `data/mechanics-census-regmc.json` reads **1006 / 1006 live**. Reg M-B `data/mechanics-census.json`
    reads **1004 / 1004 live**. Both have run_ok true, and no row changed status.
  - Reg M-C roster (`--reds --write`): 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE across items, abilities and moves.
    Seed Sower and Steely Spirit left DID-NOT-FIRE, and Mirror Coat left the usage shelf.
  - Still standing, not fixed here: 22 COULD-NOT-STAGE rows (12 items, 9 abilities, Milk Drink); Bounce and Jaw Lock
    below the usage shelf, each over an underlying DIFFER; and the moves stage exits 1 on a dead plant anchor
    (`move/needs-the-terrain-it-names`), which was already dead on `fa68d953e73f`.
  - Every row is listed by name in `docs/_reports/2026-09-22-regmc-engine-7.md` §2.

### Notes
- These are artifact regenerations. No engine byte moved. The Reg M-C and Reg M-B lattices from 0.62.0 stand.

## [0.62.0] — 2026-09-22

### Fixed
- **A mid-turn Encore re-inserts its target's action the way the authority does, so a speed tie resolves the same way in
  both regulations.** Champions' `encore.condition.onStart` calls `queue.changeAction`, which is `cancelAction` +
  `insertChoice` (`sim/battle-queue.ts` :301, :372-404); `insertChoice` lands the action among the actions it ties with at
  `battle.random(firstIndex, lastIndex + 1)` -- the FRONT of the tied group under the differential's middle-arm pin. This
  engine re-bracketed the action and left it in its slot. `encoreInsertChoice` now removes and re-inserts it, drawing the
  insert position off the shared `tie` stream only where the authority draws. No tag moved. Knob
  `MEDI_ENCORE_INSERT_KEEPS_PLACE`.
- This was the last 1950 card, `pair-redirect-priority …bo3-2678207112` turn 5: two identical Armarouge. It was not an
  unfixable speed tie. The turn's `speedSort` shuffle is pinned to identity in both engines and did not decide it. Encore
  rewrote p2b's click to Expanding Force, and `insertChoice` put p2b in front of its twin.
- `tests/probe_encore_insert_tie.js` has four arms: `tie-front` [red]; `tie-no-encore`, `tie-same-move` and `tie-mirror`
  [controls]. Exit 0 clean under both regulations. Under the knob `tie-front` parts. On release `be192e23eb5b` (the
  0.61.0 bytes) `tie-front` reads DEFECT and the exit code is 1. `tests/probe_encore_bracket.js` stays 11/11 in both
  regulations.

### Notes
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `aa7b45c6b8d2`): 1200 **0 of 954**, 1350 **0 of 1075**,
  1950 **0 of 1537** (was 1). Protocol-only games 1950 97 → 96. Shared rule. Reg M-B data files byte-identical. Reg M-B
  lattices on release `3f877319ebf0` read 0 of 961 / 0 of 1069 / 0 of 1497. Full account:
  `docs/_reports/2026-09-22-regmc-engine-7.md` §1.

## [0.61.0] — 2026-09-22

### Fixed
- **Rapid Spin and Mortal Spin clear their user's side even when a contact toll knocks the user out, in both regulations.**
  Their `onAfterHit` (`data/moves.ts` :14703-14734, :12323-12354; not in the Champions mod) clears the side through
  `pokemon.side.removeSideCondition` (no HP test) and the user's Leech Seed and partial trap through `removeVolatile`
  (which refuses a body at 0 HP); the Champions `spreadMoveHit` raises `AfterHit` with no `pokemon.hp` test. The
  `removesHazards` block now asks for a live user on the Substitute road only, and on a fainted user sweeps the hazards
  without the two volatile pieces. No tag moved. Knob `MEDI_SPIN_NEEDS_LIVE_USER`.
- `tests/probe_regmc_spin_fainted_user.js` (`--regulation regmc`): FAINTS (Garganacl lays Stealth Rock on our side while
  Garchomp, Rough Skin @ Rocky Helmet, brings Glimmora to 26/158; Glimmora's Mortal Spin; the tolls KO it and the rock
  still leaves), STANDS (the control). Exit 0 clean; exit 1 under the knob and on release `0531f23833c0` with the 0.60.0
  engine bytes.

### Notes
- A lab fix: no pinned-pool game reaches it, and the lattices did not move. The seed / trap half is read off the handler and
  not staged. Shared rule; Reg M-B data files byte-identical. Reg M-B lattices on release `8f9c8c1eb059`: 1200 / 1350 /
  1950 read 0 of 961 / 0 of 1069 / 0 of 1497.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `be192e23eb5b`): 1950 **1 of 1537** (the Armarouge
  speed-tie card, evidence only), 1350 **0 of 1075**, 1200 **0 of 954**. `docs/_reports/2026-09-22-regmc-engine-6.md` §8-§10.

## [0.60.0] — 2026-09-22

### Fixed
- **Stone Axe and Ceaseless Edge lay their hazard even when a contact toll knocks their user out, in both regulations.**
  Their `onAfterHit` (`data/moves.ts` :18078-18091, :2229-2242; not in the Champions mod) asks no HP -- only
  `onAfterSubDamage` asks `source.hp` -- and the Champions `spreadMoveHit` raises `AfterHit` with no `pokemon.hp` test
  (0.53.0 corrected Ice Spinner on the same ground and named this family). The `hazardOnHit` block now asks for a live user
  on the Substitute road only. No tag moved. Knob `MEDI_HAZARD_ON_HIT_NEEDS_LIVE_USER`.
- `tests/probe_regmc_hazard_on_hit_fainted_user.js` (`--regulation regmc`): FAINTS (Sharpedo, Rough Skin @ Rocky Helmet,
  brings Hisuian Samurott to 7/165; its Ceaseless Edge; the tolls KO it and Spikes are still laid), STANDS (the control).
  Exit 0 clean; exit 1 under the knob and on release `d05944372a1a` with the 0.59.0 engine bytes.

### Notes
- A lab fix: no pinned-pool game reaches it, and the lattices did not move (below). Shared rule; Reg M-B data files
  byte-identical. Reg M-B lattice 1200 on release `3c901edd88de`: 0 of 961.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `0531f23833c0`): 1950 **1 of 1537**, 1350 **0 of 1075**,
  1200 **0 of 954**, all unmoved. `docs/_reports/2026-09-22-regmc-engine-6.md` §7.

## [0.59.0] — 2026-09-22

### Fixed
- **A body Revival Blessing brings back into an active slot is not active while its instaswitch waits behind the residual
  (Reg M-C).** The revive (`sim/battle.ts` :2781-2798) clears `fainted` and sets HP but not `isActive`, which
  `faintMessages` cleared (:2566) and only `switchIn` restores; `fieldEvent` still finds the body in `side.active`, but
  `Battle#heal` (:2274), `spreadDamage` (:2109) and `boost` (:2030) refuse a target that is not active. This engine's
  residual walk healed it: the Reg M-C 1950 card `…bo3-2684749333` t8 (Grassy Terrain on a Rillaboom revived as the
  turn's last action; 87/175 there, 97/175 here). The cause is the engine's residual, not the driver's `mirrorRevival`:
  both engines revived the same body and the boards part at the heal. The walk now passes over a body marked
  `_revivePending` (set when its instaswitch is deferred, cleared when it walks in). No tag moved. Knob
  `MEDI_REVIVE_PENDING_TAKES_RESIDUAL`.
- `tests/probe_regmc_revive_residual_inactive.js` (`--regulation regmc`): LAST (Whimsicott Mementos, Pawmot revives it as
  the turn's last action under a foe Rillaboom's Grassy Surge; no Grassy heal), NOW (a slower foe still to move; it walks
  straight in and is healed -- the control). Exit 0 clean; exit 1 under the knob and on release `72bb36048aa0` with the
  0.58.0 engine bytes. `tests/probe_regmc_revive.js` and `tests/probe_regmc_revival_blessing.js` stay green.

### Notes
- Revival Blessing is not Reg M-B legal, so Reg M-B cannot reach the change; Reg M-B data files byte-identical. Reg M-B
  lattice 1200 on release `362ef6d4b630`: 0 of 961.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `d05944372a1a`): 1950 2 → **1 of 1537**; 1350 **0 of
  1075** and 1200 **0 of 954** unmoved. `docs/_reports/2026-09-22-regmc-engine-6.md` §6.

## [0.58.0] — 2026-09-22

### Fixed
- **A transformed body knocked out by a contact move still charges its killer the copied Rough Skin, in both regulations.**
  The authority ends a transformation in `faintMessages` (`clearVolatile(false)`, `sim/battle.ts` :2563), below the
  Champions `spreadMoveHit`'s `runEvent('DamagingHit')`; Rough Skin (`data/abilities.ts` :3938-3949) asks no HP. This engine
  reverts the transformation at the HP-zero moment (`faintHousekeeping` off `noteFaint`), so the DamagingHit reactors read
  `imposter`: the Reg M-C 1950 card `…bo3-2678161087` t4 (a Ditto transformed into Garchomp, KO'd by Stomping Tantrum;
  the authority charges Garchomp 22 HP). The reactors now read the ability the body wore at the hit (`_abAtFaint`, the
  stamp `noteFaint` already takes for Receiver) through `dhAbilityOf`. No tag moved. Knob `MEDI_DH_READS_REVERTED_ABILITY`.
- `tests/probe_regmc_transformed_toll_at_faint.js` (`--regulation regmc`): KO (Ditto copies Sharpedo, Rough Skin; Slash KOs
  it; the toll lands), STANDS (Night Slash, the Ditto survives; the control). Exit 0 clean; exit 1 under the knob and on
  release `1d5008367277` with the 0.57.0 engine bytes. `tests/probe_transform_faint_revert.js` (Reg M-B) stays green.

### Notes
- Shared rule (Ditto and Rough Skin are Reg M-B legal); Reg M-B data files byte-identical. Reg M-B lattice 1200 on release
  `b8c7b5488684`: 0 of 961.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `72bb36048aa0`): 1950 3 → **2 of 1537**; 1350 **0 of
  1075** and 1200 **0 of 954** unmoved. `docs/_reports/2026-09-22-regmc-engine-6.md` §5.

## [0.57.0] — 2026-09-22

### Fixed
- **Double Shock and Burn Up spend their user's type at `selfDrops`, above the contact tolls and the faints, in both
  regulations.** The spend is a `self: { onHit }` (`data/moves.ts` :3960-3965), run by `selfDrops` at step 4 of the
  Champions `spreadMoveHit` (`data/mods/champions/scripts.ts` :385, the same in the Reg M-B checkout) -- above
  `runEvent('DamagingHit')` (Rough Skin, Rocky Helmet) and the faints. This engine paid it at the bottom of the attack
  branch, so a Pawmot a Rocky Helmet knocked out wrote `typechange` after `|faint|` and the corpse kept `???/Fighting`:
  the Reg M-C 1950 card `…bo3-2678871998` t8. It is now paid in `_stepSelfPay`. No tag moved. Knob
  `MEDI_SPEND_TYPE_AFTER_MOVE`.
- `tests/probe_regmc_spend_type_before_toll.js` (`--regulation regmc`): FAINTS (Sharpedo, Rough Skin @ Rocky Helmet,
  brings Pawmot to 31/145 with two Night Slashes; Pawmot's Double Shock; the tolls KO it), STANDS (the control, Pawmot
  survives). Exit 0 clean; exit 1 under the knob and on release `f2e0e5560692` with the 0.56.0 engine bytes.

### Notes
- Shared rule (Double Shock and Burn Up are Reg M-B legal); Reg M-B data files byte-identical. Reg M-B lattice 1200 on
  release `1ad6fd553b23`: 0 of 961.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `1d5008367277`): 1950 4 → **3 of 1537**; 1350 **0 of
  1075** and 1200 **0 of 954** unmoved. Protocol-only games fell too (1950 113 → 99, 1350 73 → 72, 1200 67 → 64): the
  same line order on survivors. `docs/_reports/2026-09-22-regmc-engine-6.md` §4.

## [0.56.0] — 2026-09-22

### Fixed
- **Protean converts its user before Psychic Terrain refuses the priority move, in both regulations.** `trySpreadMoveHit`
  (`sim/battle-actions.ts` :590-592, no Champions override) runs `PrepareHit` -- Protean's `onPrepareHit` -- above the step
  list whose step 1 (`TryHit`) is where the terrain refuses. This engine's terrain gate sits above the attack path's
  `proteanConvert`, so a refused priority move never converted its user: the Reg M-C 1950 card `…bo3-2681855173` t1
  (Greninja's Water Shuriken into a grounded Indeedee; the authority's `typechange|Water` above the terrain's
  `-activate`, Greninja left Water/Dark here). The gate now converts the user first. No tag moved. Knob
  `MEDI_TERRAIN_BAR_BEFORE_PREPAREHIT`.
- `tests/probe_regmc_protean_before_terrain.js` (`--regulation regmc`): TERRAIN (Greninja switches in while Galarian
  Slowking raises Psychic Terrain; t2 Water Shuriken into Toxapex), OPEN (the control, no terrain). Exit 0 clean; exit 1
  under the knob and on release `b272aada45c2` with the 0.55.0 engine bytes.

### Notes
- Shared rule (Protean, Libero and Psychic Terrain are Reg M-B legal); Reg M-B data files byte-identical. Reg M-B lattice
  1200 on release `bc918a21928d`: 0 of 961.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `f2e0e5560692`): 1950 5 → **4 of 1537**; 1350 **0 of
  1075** and 1200 **0 of 954** unmoved. `docs/_reports/2026-09-22-regmc-engine-6.md` §3.

## [0.55.0] — 2026-09-22

### Fixed
- **A weather a mega evolution raises turns a standing Castform at once, in both regulations.** `Field#setWeather` ends
  `eachEvent('WeatherChange')` (`sim/field.ts` :87, both checkouts) and Forecast's `onWeatherChange`
  (`data/mods/champions/abilities.ts` :1475-1498) changes the forme on that instant; a mega's ability Start runs inside
  the evolution. `megaEvolveNow` ran the mega forme's entry effects and never the field-follower sync the switch road ends
  in, so a Castform beside a Froslass-Mega stayed Normal under its Snow Warning: the Reg M-C 1950 card `…bo3-2681789845`
  t1. `megaEvolveNow` now ends in `syncFieldTypes` over the actives, after the weather-suppression recompute. No tag
  moved. Knob `MEDI_MEGA_WEATHER_NO_FORME_SYNC`.
- `tests/probe_regmc_mega_weather_forecast.js` (`--regulation regmc`): MEGA (Charizard megas into Charizard-Mega-Y beside a
  Castform; `-formechange … Castform-Sunny` straight after the Drought line), PLAIN (no mega, the control). Exit 0 clean;
  exit 1 under the knob and on release `6397666428ff` with the 0.54.0 engine bytes.

### Notes
- Shared rule (Forecast and the weather megas are Reg M-B legal); Reg M-B data files byte-identical. Reg M-B lattice 1200 on
  release `a1fbee64c5bf`: 0 of 961.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `b272aada45c2`): 1950 6 → **5 of 1537**; 1350 **0 of
  1075** and 1200 **0 of 954** unmoved. `docs/_reports/2026-09-22-regmc-engine-6.md` §2.

## [0.54.0] — 2026-09-22

### Fixed
- **Milk Drink heals the one body it is aimed at, not the whole side (Reg M-C only).** The Champions mod retargets it
  (`data/mods/champions/moves.ts` :646-649, `target: "adjacentAllyOrSelf"`; Reg M-B's mod marks it `Past`), and the
  authority spends `moveData.heal` on each target (`sim/battle-actions.ts` :1201-1209), so the drinker heals itself OR its
  partner. `healParam` read "heal both" off the mere presence of the `healsAlly` tag, which admits every friendly class;
  only `allies` (Life Dew) resolves to both bodies. The Reg M-C 1950 card `…bo3-2684290289` t3 (Gogoat's Milk Drink at
  itself; this engine healed Toxapex too). The class is now read off `targetClass`: `allies` spreads, any other class
  heals the aimed body (the partner when the click names it, else the user). No tag moved. Knob `MEDI_AIMED_HEAL_SPREADS`.
- `tests/probe_regmc_milk_drink_target.js` (`--regulation regmc`): DRINK (Gogoat, both bodies damaged; the user alone is
  healed), DEW (Life Dew, the control; both healed). Exit 0 clean; exit 1 under the knob and on release `eec3a9b0e36a`
  with the 0.53.0 engine bytes.

### Notes
- The partner road (Milk Drink aimed at the ally) is implemented and counted (`aimedHealOnPartner`) but NOT staged: the
  scripted encoder in `engine/game_differential.js` aims every `adjacentAllyOrSelf` click at its user.
- Reg M-B untouched in behaviour (Life Dew is its only pair-sized `healsAlly` member, `allies`); Reg M-B data files
  byte-identical. Reg M-B lattice 1200 on release `bcbe61fc53b9`: 0 of 961.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `6397666428ff`): 1950 7 → **6 of 1537**; 1350 **0 of
  1075** and 1200 **0 of 954** unmoved. `docs/_reports/2026-09-22-regmc-engine-6.md` §1.

## [0.53.0] — 2026-09-22

### Fixed
- **Ice Spinner ends the terrain even when a contact toll knocks its user out, in both regulations.** The Champions mod
  carries its own `spreadMoveHit` (`data/mods/champions/scripts.ts` :315-426, identical in the Reg M-B checkout) and raises
  `AfterHit` after `DamagingHit` with no `pokemon.hp` test; Ice Spinner's `onAfterHit` asks none either. This engine
  (0.45.0) copied mainline's `if (moveData.onAfterHit && pokemon.hp)` (`sim/battle-actions.ts` :1123), so a Starmie a
  Rocky Helmet knocked out left the Psychic Terrain standing: the Reg M-C 1950 card `…bo3-2681663488`. The live-user test
  now applies only on the Substitute road the tag marks (`subNeedsUserHP`). The two other `onAfterHit` families in the
  same step (Stone Axe / Ceaseless Edge, Rapid Spin / Mortal Spin) carry the same gap and are named, not changed. No tag
  moved. Knob `MEDI_AFTERHIT_NEEDS_LIVE_USER`.
- `tests/probe_regmc_ice_spinner_fainted_user.js` (`--regulation regmc`): FAINTS (Froslass, brought low by its own Curse
  and Substitute, knocked out by Rough Skin + Rocky Helmet; the terrain still ends), STANDS (the control). Exit 0 clean;
  exit 1 under the knob and on release `4d7779ca7bad` with the 0.52.0 engine bytes.

### Notes
- Corrects `docs/_reports/2026-09-22-regmc-engine-4.md` §1, which read the mainline guard; the dated report is left as
  written and `docs/_reports/2026-09-22-regmc-engine-5.md` §5 carries the correction.
- Shared rule; Reg M-B data files byte-identical. Reg M-B lattices on release `017932cdac0b`: 1200 / 1350 / 1950 read
  0 of 961 / 0 of 1069 / 0 of 1497 board-material.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `cd3eed0c5796`): 1950 8 → **7 of 1537**; 1350 **0 of
  1075** and 1200 **0 of 954** unmoved. `docs/_reports/2026-09-22-regmc-engine-5.md` §5-§6.

## [0.52.0] — 2026-09-22

### Fixed
- **A body forced out mid-turn loses its queued action even if it is brought back the same turn, in both regulations.**
  `switchIn` splices every queued action of the unfainted body it replaces (`sim/battle-actions.ts` :104-107,
  `queue.cancelAction`; `sim/battle-queue.ts` :334-343). This engine had only `runAction`'s `isActive` refusal, which a
  body back on the field passes: in the Reg M-C 1350 lattice (`…bo3-2683867010`, turn 4) an Incineroar ejected by Eject
  Button and brought back by Golisopod's Emergency Exit ran its Parting Shot here and not on the authority. `switchOut`
  now stamps the leaving body with the turn (`TURN_EPOCH`) and the action loop drops that body's action. No tag moved.
  Knob `MEDI_RETURNED_BODY_KEEPS_ACTION`.
- `tests/probe_regmc_forced_out_action_cancelled.js` (`--regulation regmc`): BACK (ejected, walks back in behind a
  partner's U-turn, does not act), STAYS (the control). Exit 0 clean; exit 1 under the knob and on release
  `0f2b9112051e` with the 0.51.0 engine bytes.

### Notes
- Shared rule; Reg M-B data files byte-identical; the Reg M-B `--games 1200` lattice reads 0 of 961 on release
  `359ba087f8f2`.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `4d7779ca7bad`): 1350 1 → **0 of 1075**; 1950 8 of
  1537 and 1200 0 of 954 unmoved. `docs/_reports/2026-09-22-regmc-engine-5.md` §4.

## [0.51.0] — 2026-09-22

### Fixed
- **Psychic Terrain refuses a priority move by the body Follow Me drew it to, in both regulations.**
  `psychicterrain.condition.onTryHit` (`data/moves.ts` :14114-14128, not named by the Champions mod) is a `TryHit`
  handler, raised over the move's targets after `RedirectTarget` moved them. This engine's attack-path gate asked the body
  the player aimed at -- its own header named the gap -- so a priority move aimed at an airborne Talonflame and drawn onto
  a grounded Follow Me Indeedee landed here and was refused by the authority: two cards of the Reg M-C 1950 lattice
  (`…2682187499` Extreme Speed, `…2678460835` Gale Wings Dual Wingbeat). The gate now asks the one post-redirect foe
  target of a single-target move. The ally exemption is left as named. No tag moved. Knob `MEDI_TERRAIN_BAR_PRE_REDIRECT`.
- `tests/probe_regmc_terrain_bar_redirect.js` (`--regulation regmc`): DRAWN (Follow Me, refused), AIMED (the control).
  Exit 0 clean; exit 1 under the knob and on release `3ddd357ff11f` with the 0.50.0 engine bytes.

### Notes
- Shared rule: Follow Me and Psychic Terrain are Reg M-B legal with the same handler. Reg M-B data files byte-identical;
  the Reg M-B `--games 1200` lattice reads 0 of 961 on release `7a9b704e148a`.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `0f2b9112051e`): 1950 10 → **8 of 1537**; 1350 1 of
  1075 and 1200 0 of 954 unmoved; protocol-only games fell in all three (70 → 67, 77 → 74, 124 → 117).
  `docs/_reports/2026-09-22-regmc-engine-5.md` §3.

## [0.50.0] — 2026-09-22

### Fixed
- **Magician takes from the first hit target in the authority's `speedSort`, which Trick Room reverses, in both
  regulations.** `magician` (`data/abilities.ts` :2477-2500, no Champions override) runs `this.speedSort(hitTargets)`,
  which reads the cached `pokemon.speed` -- `getActionSpeed()`, `-speed` under Trick Room in Champions
  (`data/mods/champions/scripts.ts` :46-54) -- and asks every hit target in that order, a fainted one included
  (`takeItem` asks no HP). This engine sorted on live Speed, fastest first, so under Trick Room it robbed the wrong foe:
  the Delphox card of both the Reg M-C 1350 and 1950 lattices (`…bo3-2683185970`). The sort loop of `sdEachEventOrder`
  is lifted into `sdSpeedSortEntries` (one `speedSort`), and Magician sorts its whole hit list through it. No tag moved.
  Knob `MEDI_MAGICIAN_LIVE_SPEED_ORDER`.
- `tests/probe_regmc_magician_speed_order.js` (`--regulation regmc`): ROOM (Trick Room up, the slower foe robbed), OPEN
  (the control). Exit 0 clean; exit 1 under the knob and on release `fef8345b826a` with the 0.49.0 engine bytes.

### Notes
- Shared rule: Magician is Reg M-B legal and the M-B checkout carries the same handler. Reg M-B data files
  byte-identical; the Reg M-B `--games 1200` lattice reads 0 of 961 on release `97eafd8d3dc3`.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `3ddd357ff11f`): 1350 2 → **1 of 1075**; 1950 11 →
  **10 of 1537**; 1200 unmoved at 0 of 954. `docs/_reports/2026-09-22-regmc-engine-5.md` §2.

## [0.49.0] — 2026-09-22

### Fixed
- **Steel Beam into a Protect charges its user, in both regulations.** Steel Beam's own `onMoveFail` takes half the user's
  maximum HP (`data/moves.ts` steelbeam :17876-17892, not named by the Champions mod), and `useMoveInner` raises
  `MoveFail` whenever `trySpreadMoveHit` comes back falsy (`sim/battle-actions.ts` :524-527) -- a Protect that answered
  included. This engine paid the charge on a whiff and on an immunity, but its fully-shielded exit left above the max-HP
  recoil block, so a Steel Beam into a Protect was free; the block's own header had named the gap. It was the three
  `lucario.hp 145/72` cards of the Reg M-C `--games 1950` lattice (a Lucario-Mega-Z Steel Beam into a Protect on turn 1).
  `_failRecoilOnShield` pays it at that exit: the `recoil {of: 'maxhp', paidOnFail}` tag (Steel Beam alone, printed),
  `refusesIndirectDamage` honoured, `[from] steelbeam`. No tag moved. Knob `MEDI_FAIL_RECOIL_SHIELD_FREE`.
- `tests/probe_regmc_steel_beam_protect.js` (`--regulation regmc`): SHIELD, HIT, CONTROL (a plain move into the Protect).
  Exit 0 clean; exit 1 under the knob and on release `519f2a27fce0` with the 0.48.0 engine bytes (SHIELD red).

### Notes
- Shared rule: Steel Beam is Reg M-B legal and the M-B checkout carries the same handler. Reg M-B data files
  byte-identical; the Reg M-B `--games 1200` lattice reads 0 of 961 on release `c60cc1ca32b8`.
- Pinned Reg M-C differential (census pin `f3b70bc0c47c`, release `fef8345b826a`): `--games 1950` 14 of 1536 → **11 of
  1537** (the three Lucario games left, none joined; the baseline's one void game now plays clean); 1350 unmoved at 2 of
  1075; 1200 unmoved at 0 of 954. `docs/_reports/2026-09-22-regmc-engine-5.md` §1.

## [0.48.0] — 2026-09-22

### Fixed
- **A body that walks in through Emergency Exit or Eject Button draws its dice as an action of its own, in Reg M-C.**
  Both set `switchFlag` (`data/mods/champions/abilities.ts` emergencyexit :22-29, `data/mods/champions/items.ts`
  ejectbutton :266-281), and the authority answers a raised `switchFlag` with a switch request once the move's action has
  ended (`sim/battle.ts` :2877-2911), so the entrant arrives on a new `switch` action with no active move. This engine
  brought it in inside the move, still addressed to it. Under the differential's shared dice that is one die at two
  addresses, and it was the Trace card: Gardevoir walking in behind Emergency Exit drew at `1|any|-|-|0` on the
  authority (0.9706, Venusaur's Chlorophyll) and at `1|any|leafstorm|p10|0` here (0.2559, Charizard's Drought) --
  read off `--only-game`'s address capture. The pick rule itself was already the authority's (a uniform index into the
  same eligible list); only the address differed. **This is the same class, and the same fix, as the 2026-09-20 pivot
  entry (`pivotFrom`)**: the rule is lifted into `midAddrOwnAction`, the one implementation, and the eject door now
  asks it. No tag moved. Knob `MEDI_EJECT_ENTRY_MOVE_ADDR`.
- `tests/probe_regmc_eject_entry_address.js` (`--regulation regmc`, middle arm): EE, EB, and PIVOT (the U-turn road,
  the control that must stay green). It asserts every turn-1 `any` die at the same address on both engines, both ways,
  and the boards. Exit 0 clean; exit 1 under the knob and on release `d307909e1c39` with the 0.47.0 engine bytes (EE and
  EB red; PIVOT green in all three runs).

### Notes
- Neither door has a carrier in Reg M-B (Eject Button is `Past`; no legal species has Emergency Exit), and the pivot
  road's behaviour is unchanged (the helper is the old inline code). Reg M-B data files byte-identical.
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`): 1 of 954 → **0 of 954** on release
  `4868967b4a91`; the Trace game left, none joined. `docs/_reports/2026-09-22-regmc-engine-4.md` §5.

## [0.47.0] — 2026-09-22

### Fixed
- **A `???` move never takes STAB, in both regulations.** Champions' own `modifyDamage` wraps the whole STAB block in
  `if (type !== '???')` ("The '???' type never gets STAB", M-C checkout `data/mods/champions/scripts.ts` :228-233; the
  Reg M-B checkout and `sim/battle-actions.ts` :1757-1762 say the same). Struggle's `onModifyMove` makes the move `???`
  (`setsOwnTypeAlways`), and a body that spent its only type on Double Shock or Burn Up is `???` (`spendsOwnType`), as is
  a Transform of one. This engine's STAB line asked only `att.types.includes(mvT)`, so a spent body's Struggle took
  x1.5. Found with `--only-game` on the Kingambit card: a Ditto transformed into a Double Shock-spent Pawmot Struggled
  into Kingambit for 40 against the authority's 27. The fix is one guard on the one STAB line
  (`engine/medicham2-browser.js`, `dmgRangeOneHit`); no tag moved. Knob `MEDI_TYPELESS_STAB`.
- `tests/probe_regmc_typeless_stab.js` (`--regulation regmc`): SPENT (a mono-Fire user spends its type with Burn Up on
  its own partner, is Disabled, and Struggles) and CONTROL (the same user, never spent). It asserts the damage lines
  and the boards; SPENT's protocol parts earlier on a narration line (the authority's `-fail` names the move) that this
  probe prints and does not judge. Exit 0 clean; exit 1 under the knob and on release `e16663e89997` with the 0.46.0
  engine bytes.

### Notes
- **Shared-engine fix.** Burn Up and Struggle are Reg M-B legal and the rule is the same there. Reg M-B measured:
  `data/tags.json`, `data/abra-tags.js`, `data/protocol-events.json`, `data/move-effects.js` byte-identical; lattice 1200
  0 of 961 on release `440b846e2aff`.
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`): 2 of 954 → 1 of 954 on release
  `d307909e1c39`; the Kingambit game left the board-material count, none joined. Its turn-3 `-fail` narration (the
  authority's `move: Double Shock` attribute) remains, protocol-only. `docs/_reports/2026-09-22-regmc-engine-4.md` §4.

## [0.46.0] — 2026-09-22

### Fixed
- **Grass Pelt raises Defence in Grassy Terrain, in Reg M-C.** `onModifyDef(pokemon) { if
  (this.field.isTerrain('grassyterrain')) return this.chainModify(1.5); }` (M-C checkout `data/abilities.ts` grasspelt
  :1697-1706; the Champions mod does not name it). `condStatMult` in `engine/tag_dex.js` refused the handler on purpose
  ("a condition this derivation cannot name gets no tag"), so the ability carried only `breakable` and this engine paid
  no multiplier. The derivation now names the condition: `when: 'terrain'`, `terrain: 'grassyterrain'`, admitted only
  when the handler's single `if` is that test. `engine/medicham2-browser.js`'s `condStatMult` reader evaluates it off
  the field. Knob `MEDI_TERRAIN_STATMULT_INERT`. Found with `--only-game`: the pinned game's Dire Claw into a Gogoat at
  full HP under Grassy Terrain dealt 152 on the authority and knocked it out here.
- `tests/probe_regmc_grass_pelt.js` (`--regulation regmc`): PELT, BARE (no terrain), SPECIAL (a special hit) and
  CONTROL (the holder on its other ability). Exit 0 clean; exit 1 under the knob and on release `d0e34207d250` with the
  0.45.1 engine bytes.

### Notes
- `data/tags-regmc.json` moves by the Grass Pelt row only (the `condStatMult` descriptor's member count is left as
  committed, the precedent of the Leek and Steely Spirit rows). Grass Pelt has no legal carrier in Reg M-B, so the Reg
  M-B derivation writes no row: `data/tags.json`, `data/abra-tags.js`, `data/protocol-events.json` and
  `data/move-effects.js` are byte-identical.
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`): 3 of 954 → 2 of 954 on release
  `e16663e89997`; the Dire Claw game left, none joined. Reg M-B lattice 1200 on release `b6bcecf24b41`: 0 of 961.
  `docs/_reports/2026-09-22-regmc-engine-4.md` §3.

## [0.45.1] — 2026-09-22

### Added
- **`--only-game <selector>` on `engine/game_differential.js`: replay one game of the differential with a full per-turn
  dump.** The selector is a substring of `<config> <seed tag>` or `#<n>` (the game's position in the arm's play order)
  and must match exactly one game, else exit 2. The run walks the ordinary fixed-count loop, PLAYS every game before
  the chosen one, captures it (both streams per turn, both boards and their diffs at every boundary, the first
  protocol and board divergence, both engines' middle-arm dice addresses with the values drawn, and `trace_digest`),
  prints it, writes it to `--only-game-out <file>` (default: the OS temp directory) and stops before the report, the
  `--write` block and `--dump-games`. It never writes the published artifact.

### Notes
- **Why the games before it are played, measured.** The first cut skipped them, and game #293 replayed as a different
  game: its medicham2 trace parted from the full run's at line 38 (Psychic Fangs there, Fire Fang here). The empirical
  driver falls back to `coveragePick` when a species has no prior row or its draw fails, and `coveragePick` reads
  `CLICKS` and the credit maps, which carry across games. With the prior games played, all three replayed games
  (#293, #368, #630) reproduce the full run's `trace_digest` exactly (`MEDI_SAMPLE_DUMP` on release `d0e34207d250`).
- **A run without the flag is unchanged.** On release `d0e34207d250`, same pins, the post-change artifact's `state` and
  `first_divergences` blocks are identical to the pre-change run's; the only differing fields are `generated`,
  `elapsed_s`, `steering.driver_code` (the driver file's own digest) and the dump's `generated`/`by`.
  `docs/_reports/2026-09-22-regmc-engine-4.md` §2.

## [0.45.0] — 2026-09-22

### Fixed
- **Ice Spinner removes the terrain after it hits, in both regulations.** Its handler pair is
  `onAfterHit() { this.field.clearTerrain(); }` and `onAfterSubDamage() { if (source.hp) this.field.clearTerrain(); }`
  (M-C checkout `data/moves.ts` icespinner :9417-9437; the Reg M-B checkout is identical). It has no `onTry`, so the
  `failsWithoutTerrain` tag (Steel Roller) never matched it, no tag said the terrain goes, and this engine left it up.
  New move tag `clearsTerrainAfterHit` in `engine/tag_dex.js` (read off `onAfterHit` only; `throughSubstitute`,
  `subNeedsUserHP`, `onlyOnConnect`); membership printed before wiring: Ice Spinner alone, in both regulations. Read in
  `engine/medicham2-browser.js` by `_afterHitField`, the step that already holds the other two `onAfterHit` families
  (`hazardOnHit`, `removesHazards`), gated on a connected hit, a user still standing (`AfterHit` runs only
  `if (pokemon.hp)`, `sim/battle-actions.ts` :1120) and the substitute rule. Knob `MEDI_AFTERHIT_TERRAIN_INERT`.
- `tests/probe_regmc_ice_spinner.js` (`--regulation regmc`): CLEAR, SUB (behind a Substitute), NONE (no terrain) and
  CONTROL (a plain hit leaves the terrain). Exit 0 clean; exit 1 under the knob and on release `1f475312c778` with the
  0.44.0 engine bytes.

### Changed
- **`data/tags.json` (Reg M-B) moves, by Will's approval for this fix.** Exactly two rule changes, in both tag files and
  printed by a structural diff: the `icespinner` row gains `clearsTerrainAfterHit`, and the tag's descriptor is added.
  No other row moved; usage figures are the committed ones. `data/abra-tags.js` rebuilt (`build/build_tags_js.js
  --check` passes). `data/protocol-events.json` and `data/move-effects.js` byte-identical.

### Notes
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`): 4 of 954 → 3 of 954 on release
  `d0e34207d250`; the Ice Spinner game left, none joined.
- Reg M-B (release `a193df3c8301`, `SHOWDOWN_PATH` the M-B checkout): lattice 1200 **0 of 961**, 1350 **0 of 1069**,
  1950 **0 of 1497**, 0 void each. The 1 and 2 protocol-only divergences at 1350 and 1950 are all Kingambit's silent
  `-end …|fallenundefined` line, and no game in either dump contains Ice Spinner. Readings:
  `docs/_reports/2026-09-22-regmc-engine-4.md` §1.

## [0.44.0] — 2026-09-22

### Fixed
- **Berserk is not raised by a Sheer Force hit.** Berserk's boost is an `onAfterMoveSecondary` handler, and
  `afterMoveSecondaryEvent` (`sim/battle-actions.ts` :811-818, the same in both checkouts) skips that whole event when
  `move.hasSheerForce` and the attacker has Sheer Force — which Sheer Force's `onModifyMove` sets exactly when the move
  had secondaries. This engine's `boostsAtHPThreshold` step never asked. New `sheerForceSkipsAfterMove(attacker, move)`
  in `engine/medicham2-browser.js`, read off the attacker's `removesOwnSecondaries` tag and the move's rulebook row; the
  Emergency Exit door, which asked the same question inline since 0.22.0, now calls it (its probe stays green). No tag
  moved. Knob `MEDI_THRESHOLD_IGNORES_SHEER_FORCE`.
- `tests/probe_regmc_sheer_force_threshold.js` (`--regulation regmc`): SHEER (a Sheer Force attacker's move with a
  secondary takes the holder across half: no boost) and CONTROL (the same attacker on its other ability: the boost).
  Exit 0 clean; exit 1 under the knob and on release `04de2d2fc705` with the 0.43.0 engine bytes.

### Notes
- **This is a shared-engine fix and Reg M-B's rule is the same.** Berserk (Drampa, Drampa-Mega) and Sheer Force (nine
  carriers, Camerupt-Mega among them) are legal in Reg M-B, and the Reg M-B checkout's `afterMoveSecondaryEvent` carries
  the identical gate, so the closed line carried this defect latent: no Reg M-B lattice dealt the pair. Reg M-B
  measured unmoved: three files byte-identical; lattice `--games 1200` 0 of 961 with `agreement_by_turn` identical to
  this pass's first Reg M-B reading (release `0d1733910f65`). Its held-out draw was not run.
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`): 5 of 954 → 4 of 954 on release
  `1f475312c778`; the Berserk game (Camerupt-Mega's Earth Power into Drampa-Mega) left, none joined. Readings:
  `docs/_reports/2026-09-22-regmc-engine-3.md` §4.

## [0.43.0] — 2026-09-22

### Fixed
- **Seed Sower sets Grassy Terrain when its holder is hit, in Reg M-C.** The ability was `untagged`: `effectRecipients`
  in `engine/tag_dex.js` counted `setWeather` and `sideCondition` as a cost to the attacker but not `setTerrain`, so
  `punishesAttacker` never matched it. M-C checkout `data/abilities.ts` seedsower :4119-4127
  (`onDamagingHit() { this.field.setTerrain('grassyterrain'); }`). `punishesAttacker` now reads `setsTerrain`, written
  only when present, so every existing row keeps its keys; membership, printed before wiring: `seedsower` (Arboliva in
  Reg M-C; no legal carrier in Reg M-B, so no Reg M-B row). The row alone was spliced into `data/tags-regmc.json`.
  `engine/medicham2-browser.js`: beside Sand Spit's weather, the terrain is set through the same four steps the terrain
  move takes (a standing terrain refuses, the holder's Terrain Extender, `-fieldstart … [from] ability`, the seeds'
  `TerrainChange`). Knob `MEDI_PUNISH_TERRAIN_INERT`.
- `tests/probe_regmc_seed_sower.js` (`--regulation regmc`): HIT (the terrain starts and the partner's Grassy Seed is
  spent), UP (a second hit into the standing terrain starts nothing) and a CONTROL on the holder's other ability. Exit 0
  clean; exit 1 under the knob and on release `e4ec330c6314` with the 0.42.0 engine bytes.

### Notes
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`): 6 of 954 → 5 of 954 on release
  `04de2d2fc705`; the Seed Sower game left, none joined. Reg M-B unmoved: three files byte-identical, lattice
  `--games 1200` 0 of 961 (release `fb3fcbb03756`). Readings: `docs/_reports/2026-09-22-regmc-engine-3.md` §3.

## [0.42.0] — 2026-09-22

### Fixed
- **Liquid Ooze turns a drain, a Leech Seed return and a Strength Sap into damage, in Reg M-C.** The ability was
  `untagged` and nothing read it, so the healer healed. M-C checkout `data/abilities.ts` liquidooze :2402-2415
  (`onSourceTryHeal`: for `drain`, `leechseed` and `strengthsap`, `this.damage(damage); return 0`), and `Battle#heal`
  (`sim/battle.ts` :2261-2301) runs TryHeal before its full-HP refusal, so a full-HP healer is damaged too. New ability
  tag `reversesHeal {from}` in `engine/tag_dex.js`, derived off the handler (membership: `liquidooze`, whose one legal
  carrier is Swalot in Reg M-C; no legal carrier in Reg M-B, so no Reg M-B row); the row and its descriptor spliced
  into `data/tags-regmc.json`, nothing else moved. `engine/medicham2-browser.js` `oozeReverse` at the three heal sites,
  on the Big-Root-multiplied amount, honouring Magic Guard (`refusesIndirect`). Knob `MEDI_OOZE_INERT`.
- `tests/probe_regmc_liquid_ooze.js` (`--regulation regmc`): DRAIN, SAP and SEED into the holder from a full-HP healer,
  and a CONTROL on the holder's other ability. Exit 0 clean; exit 1 under the knob and on release `2d5d6ec26e28` with
  the 0.41.0 engine bytes.

### Notes
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`): 7 of 954 → 6 of 954 on release
  `e4ec330c6314`; the Liquid Ooze game left, none joined. Reg M-B unmoved: three files byte-identical, lattice
  `--games 1200` 0 of 961 (release `97d18af7a5a9`). Readings: `docs/_reports/2026-09-22-regmc-engine-3.md` §2.

## [0.41.0] — 2026-09-22

### Fixed
- **Revival Blessing revives a fainted ally, in Reg M-C.** With a fainted body in the party the move was counted
  `MEDFAILS.reviveUnmodelled` and played as a pivot that brought a LIVE bench body in; the authority revives the first
  fainted body in party order to half its max HP (`sethp` truncates), writes `-heal|pN: <name>|…|[from] move: Revival
  Blessing`, and, when the corpse still holds an active slot, instaswitches it back in: at once when any move is still
  queued that turn, after the residual otherwise (M-C checkout `sim/battle.ts` :2781-2798 and :2916-2923,
  `sim/battle-queue.ts` :307-313). `engine/medicham2-browser.js` `reviveFainted` / `reviveInstaswitch`: the pick reads
  `sf.team` (kept in the authority's party order since ROADMAP #544), the revived body goes to the bench in party order
  or back into its slot, its own queued action is cancelled by the instaswitch, and `fallenCount` keeps counting the
  death (`side.totalFainted` is never decremented). Read off the existing `revivesFainted` tag (`hpFraction`,
  `instaswitchIfActiveSlot`); no tag file moved. The revived body's own SwitchOut handlers on its instaswitch are not
  modelled and are counted (`MEDFAILS.reviveSwitchOutUnmodelled`). Knob `MEDI_REVIVE_UNMODELLED`.
- `tests/probe_regmc_revive.js` (`--regulation regmc`): BENCH (revived to the bench), NOW (revived in its slot with a
  slower foe still to move) and LAST (every foe already moved: the instaswitch lands after `|upkeep`). Exit 0 clean;
  exit 1 under the knob and on release `5c6df1a5e969` with the 0.40.0 engine bytes.

### Notes
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`, pool `team-pool-frozen-regmc`): 13 of 953
  board-material on release `5c6df1a5e969` (0.40.0) → 7 of 954 on `2d5d6ec26e28`; the six revive games left, none
  joined, and all 12 revival requests are now mirrored from a revive this engine made. Reg M-B unmoved: its three files
  byte-identical, lattice `--games 1200` 0 of 961 (release `7335f5460a29`). Readings:
  `docs/_reports/2026-09-22-regmc-engine-3.md`. Nothing here is published.

## [0.40.0] — 2026-09-22

### Fixed
- **The differential's mega-slot choice no longer crosses games under Reg M-C.** `engine/game_differential.js` chose
  which slot megas, when both could, by a parity that flipped on every mega of the whole run and sat outside
  `driverSnap`, so a game's boards depended on the games played before it. Under any regulation but the artifact owner
  the choice is now a draw at the driver's own per-game address. Reg M-B keeps the parity byte for byte: its lattices
  ask the rule, so changing it there would re-deal published games. `GD_MEGA_SLOT_CARRIES=1` restores the parity;
  `GD_MEGA_SLOT_PER_GAME=1` measures the address under Reg M-B. The rule and how often it was asked are printed and
  stamped (`mega.slot_rule`, `mega.both_slots_offered`). Guard: `tests/test-driver-per-game.js`.
- **A revival request is answered, so a revive is compared instead of thrown.** `mirrorRevival` answers the slots
  whose request entry carries Showdown's own `reviving` flag: with the body medicham2 revived when it revived one,
  otherwise with the authority's own default (the first fainted body in party order), and drops the pivot body
  medicham2 queued for that slot. Counted and stamped as `revival_requests`. `GD_REVIVE_UNANSWERED=1` restores the old
  road. Guard: `tests/test-revive-mirror.js`.
- **Seventeen Reg M-C census rows re-staged to derive from the selected regulation.** Each typed a Reg M-B stat,
  damage number, free pick, key spelling or authority line. They now read the number from the build or from the
  authority on the run (new `tests/census_authority.js`: the selected checkout, the engine body's stats copied
  across), or search for the first candidate whose control arm stages the mechanic, starting with the historical
  fixture. The Spicy Spray announcement row is registered only when the selected authority writes the line. The Taunt
  row reads a move's category from the `statusCategory` tag instead of a zero `bp`.
- **The roster stages the selected regulation.** `tests/roster.js` read Reg M-B's tag file out of every release and
  read descriptions the Reg M-C checkout does not attach (and writes "1.5×" for "1.5x"). It now reads the selected tag
  file, and a view of the dex supplies the checkout's own text table to its rules without touching the shared dex.
- **An artifact stamped with another regulation's release is not STRANDED.** `tests/test-artifact-rerunnable.js` opened
  every release under the default regulation, and `open()` refuses a release cut for another one, so the first
  committed Reg M-C roster artifacts read STRANDED and the commit hook refused them. Such a release is now VERIFIED
  (content intact) and banded ANOTHER-REGULATION with the regulation named; a modified one is still STRANDED.

### Added
- `tests/probe_regmc_changed_pp.js`: every move legal in both regulations whose PP changed, derived from both dexes,
  run out of PP in a real game against the authority.
- `fixture_legality` in every roster artifact: each built set judged by the selected format's TeamValidator.
  `engine/quarantine.js` fails a roster stage on a NOT-baselined refusal or on a block saying nothing was judged; an
  artifact without the field (every Reg M-B roster artifact) is unaffected. Three selftest arms.
- The Reg M-C roster artifacts (`data/roster.{items,abilities,moves}-regmc.json`, release `fa68d953e73f`) and the
  census pin `data/verification/census-pin-regmc-f3b70bc0c47c.json`.

### Notes
- Reg M-B unmoved: its census rows are identical apart from the sampled `formatSecondaryChance` row, which moves by
  the same amount between any two runs; its lattice at `--games 1200` reads 0 of 961 with the same state, mega and
  first-divergence blocks as the published artifact; `engine/quarantine.js` with no flag prints the same output as
  HEAD's copy on the same tree. Readings: `docs/_reports/2026-09-22-regmc-instruments.md`. Nothing here is published.

## [0.36.0] — 2026-09-22

### Fixed
- **White Herb is spent on the move that ends the battle, in Reg M-C.** The two checkouts differ here. Reg M-C's
  whiteherb restores inside `useMove` (`onAnyAfterMove() { this.effect.onStart.call(...) }`), before `runAction`'s
  `faintMessages()` ends the battle (M-C checkout `sim/battle.ts` :2832-2833); Reg M-B's QUEUES it
  (`insertChoice({ event: "WhiteHerb", order: 99 })`), which never runs after the battle has ended. This engine spent
  it in `_updateAll`, which both `sideWiped` break sites skip, so a Close Combat that knocked out the last foe left its
  user holding the herb at -1/-1 under Reg M-C. `engine/tag_dex.js` now writes `restoresStats.afterMoveImmediate` for
  the M-C shape only (Reg M-B's row derives byte-identically; the M-C row was spliced), and `herbAtWin` runs the herb's
  reader at the two breaks for a holder whose tag says so. Knob `MEDI_HERB_SKIPPED_AT_WIN`.
- `tests/probe_regmc_white_herb_at_win.js` (`--regulation regmc`): a three-turn wipe whose last knockout is the herb
  holder's self-dropping hit, and a no-item control. Exit 0 clean; exit 1 under the knob and on the 0.35.0 release and
  bytes.

### Notes
- The first cut ran the herb for every holder, and the Reg M-B lattice parted on four games the other way (the
  authority kept the herb). That is how the two checkouts' handlers were found to differ; the tag now carries it.

## [0.35.0] — 2026-09-22

### Fixed
- **Steely Spirit boosts its holder's and its partner's Steel moves.** `onAllyBasePower` (M-C checkout
  `data/abilities.ts` steelyspirit: `if (move.type === 'Steel') return this.chainModify(1.5)`) is collected over the
  attacker's `alliesAndSelf()` (`sim/battle.ts` :1056-1057). Two defects: the tag's multiplier parse stopped at the
  decimal point (`mult: 1`), and the engine had no consumer for `allyBasePowerBoost` at all. `engine/tag_dex.js` now
  reads a decimal or `[n, 4096]` multiplier, whether the holder's own move counts (`includesSelf`: Battery and Power
  Spot exclude it) and a category gate; only the Steely Spirit row was spliced into `data/tags-regmc.json` (Reg M-B has
  no carrier and its tag file does not move). `engine/medicham2-browser.js` adds the member to the base-power chain for
  the attacker's own ability and for its active partner (`hit.attPartner`, told at the hit site like Friend Guard).
  Knob `MEDI_ALLY_BP_BOOST_INERT`.
- `tests/probe_regmc_steely_spirit.js` (`--regulation regmc`): Perrserker's Iron Head with and without the ability, and
  a partner's Iron Head beside it with and without. Exit 0 clean; exit 1 under the knob and on the 0.34.0 release and
  bytes.

## [0.34.0] — 2026-09-22

### Fixed
- **The Leek is two crit stages, and only for Farfetch'd and Sirfetch'd.** M-C checkout `data/items.ts` leek:
  `if (["farfetchd", "sirfetchd"].includes(this.toID(user.baseSpecies.baseSpecies))) return critRatio + 2;`. The item
  crit tag gave every `onModifyCritRatio` item `critRatio: 2` (one stage, Scope Lens's `+ 1`), so a Sirfetch'd's Leek
  was one stage short and any other holder was one stage long. `engine/tag_dex.js` now reads the increment and the
  species lock off the handler (`critRatio` = 1 + stage, `onlySpecies` = the base-species ids; a lock it cannot read is
  marked `lockUnparsed` and refused downstream). Scope Lens derives the identical row it always had, so Reg M-B's tag
  file does not move; only the Leek row was spliced into `data/tags-regmc.json` (a structural diff of the regenerated
  file showed no other rule change). `engine/medicham2-browser.js` reads the lock against the key's base segment
  (0.33.0's fix). Knob `MEDI_CRIT_ITEM_ONE_STAGE`.
- `tests/probe_regmc_leek.js` (`--regulation regmc`, the middle arm): Farfetch'd @ Leek's Night Slash crits five of
  five; an unlocked holder and a no-item control agree with the authority roll for roll. Exit 0 clean; exit 1 under the
  knob and on the 0.33.0 release and bytes. `tests/regmc_probe_kit.js`'s `play` takes an optional arm.

## [0.33.0] — 2026-09-22

### Fixed
- **A species whose base name carries punctuation is keyed as one base, and U+2019 folds like `'`.** Two defects on one
  shape. (1) `build/build_engine_data_regmc.js` collapsed every non-alphanumeric run of the display name to a hyphen,
  and the engine reads a key's segment before its first hyphen as the base species (the `statMult.onlySpecies` lock), so
  `Sirfetch’d`, `Farfetch’d`, `Mr. Rime`, `Mr. Mime` and `Kommo-o` were keyed `sirfetch-d`, `farfetch-d`, `mr-rime`,
  `mr-mime`, `kommo-o`, as if each had a forme. The base part is now the base species' id and only the forme tail keeps
  the hyphen rule; every legal species is scanned for the shape on every build (5 found), a name that is neither
  `<base>` nor `<base>-<forme>` refuses the build, and the regenerated table differs from the old one by those five
  renames and nothing else. `ABRA_REGMC_KEY_WHOLE_NAME=1` restores the old rule. (2) The M-C checkout spells the two
  Farfetch'd names with U+2019 (`data/pokedex.ts`), and `traceCanon` folded only the ASCII apostrophe, so the first
  `|switch|` of every game that brought one parted on a spelling. Knob `MEDI_CANON_KEEPS_TYPO_APOSTROPHE`.
- `tests/probe_regmc_species_key.js` (`--regulation regmc`): every table key's base segment is its species' base id, and
  every legal punctuated species walks in with identical reduced `|switch|` lines and identical boards. Exit 0 clean;
  exit 1 under the knob and on the 0.32.0 release and engine bytes.

### Notes
- The five hidden games now show their real first causes: four are a critical hit the authority rolls and this engine
  does not (Leek), one is narration. The board-material count did not move on this commit; the report says why.

## [0.32.1] — 2026-09-22

### Added
- Step 14 of `docs/REGULATION-ROTATION.md`, *Downstream consumers*. CHOMP reads ABRA's usage model keyed
  by its own old-regulation species table, and some ABRA builders still read CHOMP files. The step gives
  the command that prints the live list. Will deferred the CHOMP update ("chomp update will come later"),
  so `data/meta-usage.json` stays Reg M-B's until he says otherwise.

### Notes
- **Supersedes.** Nothing. **Basis.** unchanged.

## [0.32.0] — 2026-09-22

### Fixed
- **White Herb is spent before an Eject Button or Red Card switch, not after it.** The herb restores from
  `onAnyAfterMove`, and `AfterMove` is raised inside `useMove`, before `runAction`'s tail does the drags and the owed
  switches (M-C checkout `sim/battle.ts` :2820-2907). This engine spent it at its post-action pass, after the
  replacement had walked in, so a switch-in Intimidate's drop was cleared together with the move's self-drop. The
  herb (`restoreStatsAll`, its one reader) now runs before those two M-C-only doors when either is owed; every other
  road keeps its post-action pass. Knob `MEDI_HERB_AFTER_OWED_SWITCH`.
- `tests/probe_regmc_white_herb_before_switch.js` (`--regulation regmc`): a self-dropping hit into an Eject Button
  holder whose replacement has Intimidate, and a control with no Eject Button. Exit 0 clean; exit 1 under the knob and
  on the 0.31.0 engine bytes.

### Notes
- Two more pinned games end with the authority spending a White Herb on the battle's last move and this engine not
  (the engine ends the battle before its post-action pass). A hypothesis, not probed: a side wiped by one move cannot
  be staged in the four-body harness in one turn. Recorded.
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.31.0] — 2026-09-22

### Added
- **Normal Gem.** Item tag `typeGem {type, mod, volatile, skipsSelfTarget, skipsStatus}` (`engine/tag_dex.js`), derived
  from the item's `onSourceTryPrimaryHit` and the `gem` condition's `onBasePower`. Membership, whole item dex, both
  checkouts: all 18 gems match; the only legal one is Normal Gem in Reg M-C; none is legal in Reg M-B. Spliced into
  `data/tags-regmc.json`: the Normal Gem row and the descriptor.
- The engine spends the gem on the first row of a damaging use of its type that reaches the damage step (the
  authority's TryPrimaryHit), writes `-enditem ... [from] gem|[move] <Move>`, records the use (Unburden, Symbiosis), and
  multiplies that use's base power by the tag's `[5325, 4096]`, last in the base-power relay (`onBasePowerPriority:
  14`). Knob `MEDI_TYPE_GEM_INERT`.
- `tests/probe_regmc_type_gem.js` (`--regulation regmc`): a Normal move spends the gem and hits harder, an off-type
  move keeps it, and a no-item control. Exit 0 clean; exit 1 under the knob and on the 0.30.0 engine bytes.

### Notes
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.30.0] — 2026-09-22

### Fixed
- **Binding Band deepens its holder's partial trap to a sixth.** `partiallytrapped.onStart` sets `boundDivisor =
  source.hasItem("bindingband") ? 6 : 8` (M-C checkout, read from the dist dex), and the `partialTrap` tag has carried
  that as `chipItem` (and Grip Claw's eight turns as `durationItem`) since the trap was derived; nothing read either, so
  a holder chipped an eighth. The trap now reads the trapper's item when it lands and keeps the divisor as a divisor, so
  the tick is `floor(maxhp / 6)`. Both items are `Past` in Reg M-B. Knob `MEDI_TRAP_CHIP_ITEM_BLIND`.
- `tests/probe_regmc_binding_band.js` (`--regulation regmc`): a holder's Infestation chips a sixth at two residuals, and
  the no-item control an eighth. Exit 0 clean; exit 1 under the knob and on the 0.29.0 engine bytes.

### Notes
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.29.0] — 2026-09-22

### Fixed
- **Terrain Extender makes its holder's terrain last eight turns.** Every terrain condition in the M-C checkout answers
  `durationCallback(source) { if (source?.hasItem('terrainextender')) return 8; return 5; }`, and both terrain
  writers in `engine/medicham2-browser.js` (the move and the Surge ability on entry) wrote a literal 5. `terrainTurns`
  reads the setter's item's `extendsDuration` tag, as `weatherTurns` does for the rocks; nothing about 8 is typed.
  Terrain Extender is `Past` in Reg M-B, so no Reg M-B item names a terrain. Knob `MEDI_TERRAIN_FIVE_ALWAYS`.
- `tests/probe_regmc_terrain_extender.js` (`--regulation regmc`): a terrain move and a Surge ability, each from a holder,
  and a control with no item; the terrain clock is a compared board leaf. Exit 0 clean; exit 1 under the knob and on
  the 0.28.0 engine bytes.

### Notes
- The move road's `-fieldstart` carries `[of] <user>` here and nothing on the authority; the differential's reducer
  folds it (narration, recorded).
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.28.0] — 2026-09-22

### Fixed
- **Revival Blessing fails when nobody has fainted.** Its `selfSwitch` only raises the switch request that names a
  fainted body (the move's own comment, M-C checkout `data/moves.ts` :15126-15129), and `onTryHit` fails the move when
  the user's party holds no fainted body. This engine read the `selfSwitch` as a status pivot and switched a live bench
  body in. New move tag `revivesFainted {slotCondition, failsWithoutFainted, hpFraction, instaswitchIfActiveSlot}`
  (`engine/tag_dex.js`), the shape read off the move and the fraction off `Battle.prototype.runAction`; `pivotStatus`
  no longer claims it. Membership, whole dex, both checkouts: Revival Blessing only; legal in Reg M-C, `Past` in Reg
  M-B. The engine fails the move (`-fail|USER`, nobody switches) when the user's roster holds no fainted body. Knob
  `MEDI_REVIVE_AS_PIVOT`.
- `tests/probe_regmc_revival_blessing.js` (`--regulation regmc`): the move with no fainted ally fails and the user
  stays. Exit 0 clean; exit 1 under the knob and on the 0.27.0 engine bytes.

### Notes
- **The revive itself is not modelled** (a fainted body exists): it is counted (`MEDFAILS.reviveUnmodelled`) and still
  pivots. The differential's forced-switch mirror answers a switch request with a LIVE bench body, so it cannot express
  a revival request, and the seven pinned choices the authority refused ("You have to pass to a fainted Pokémon") are
  that. Filed for MEASURE; the engine half waits for an instrument that can show it right.
- `data/tags-regmc.json`: the Revival Blessing row and the two descriptors (spliced). Reg M-B's tag file has no member.
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.27.0] — 2026-09-22

### Fixed
- **Octolock drops Defence and Sp. Def every turn until its source is gone.** The per-turn-boost residual read every
  member's `_vol` entry as a clock; Octolock declares no duration, so its bare 1 ran out and the lock ENDED at its first
  residual, where the authority drops two stages. `perTurnBoost` (`engine/tag_dex.js`) now also carries, read off the
  condition, `residualSourceEnd {clauses, endArgs}` (the source-gone test at the top of Octolock's own `onResidual`)
  and `trapsWhileSourceActive` (`onTrapPokemon`). A member with no duration and a residual source end is ticked
  without a clock and ended at the residual by the partial trap's three clauses (`sourceOffField`, `_newlySwitched`),
  writing `-end ... [partiallytrapped]|[silent]`; the `onUpdate` sweep leaves it alone. `switchTrapVerdict` refuses a
  switch while its source is active (counted, `MEDSEEN.volTrapBlocked`; the staged harness cannot offer a switch the
  authority refuses, so that half is not probed). Syrup Bomb's row is unchanged. Knob `MEDI_PERTURN_BOOST_CLOCK_ALWAYS`.
- `engine/board_state.js` compares `vol.octolock` (presence). `tests/probe_uncompared_leaves.js --regulation regmc`
  now lists no uncompared leaf that can stand at a turn boundary.
- `tests/probe_regmc_octolock.js` (`--regulation regmc`): three residual drops while locked; two, then a silent end,
  when the user switches out. Exit 0 clean; exit 1 under the knob and on the 0.26.0 engine bytes.

### Notes
- The authority writes `[of] <source>` on Octolock's `-start` and this engine does not; the differential's reducer
  folds that field (narration). Recorded, not fixed.
- `data/tags-regmc.json`: only the Octolock row changed (spliced). Reg M-B's `data/tags.json` has no member with
  either new field.
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.26.0] — 2026-09-22

### Added
- **Glaive Rush leaves its user exposed.** Move tag `exposesUser {volatile, damageTakenMult, alwaysHitBy,
  endsBeforeOwnMove, silentStart}` (`engine/tag_dex.js`), derived from the condition of the move's own
  `self.volatileStatus`: an `onSourceModifyDamage` that `chainModify`s the damage its holder takes, an `onAccuracy`
  that returns true, an `onBeforeMove` that removes it. Membership, whole dex, both checkouts: Glaive Rush only; legal
  in Reg M-C, `Past` in Reg M-B. `data/tags-regmc.json` carries the descriptor and the Glaive Rush row (spliced; no
  other row moved).
- The engine arms the volatile at the self-drop step when the move reached a target, doubles every damage calc into
  the holder, makes every move into it hit, and drops it at the top of the holder's own BeforeMove gate (priority 100,
  above recharge). Knob `MEDI_SELF_EXPOSED_INERT`.
- `engine/board_state.js` compares `vol.glaiverush` (presence), which stands across the turn boundary. It was listed
  by `tests/probe_uncompared_leaves.js` as written and uncompared; it no longer is. No Reg M-B move writes it.
- `tests/probe_regmc_glaive_rush.js` (`--regulation regmc`): an exposed user takes a doubled hit from a slower foe on
  the same turn and a normal one after it moves again; a control with a plain contact move. Exit 0 clean; exit 1 under
  the knob and on the 0.25.0 engine bytes.

### Notes
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.25.0] — 2026-09-22

### Fixed
- **Aura Guard halves contact damage.** The `damageReduce` reader in `engine/medicham2-browser.js` had no branch for
  `onlyWhen: 'contact'`, so the condition was refused as unknown (`MEDFAILS.damageReduceUnknown`) and the cut was never
  applied: every contact hit into Lucario-Mega-Z did double damage here. The reader now asks the per-use contact fact
  (`mvMakesContact(id, att, use)`), which is what the authority's handler reads (`move.flags['contact']` on the active
  move, after Long Reach). The ability is `breakable`, and Mold Breaker already removes it from `defAb`. Knob
  `MEDI_DAMAGE_REDUCE_CONTACT_UNKNOWN`.
- `tests/probe_regmc_aura_guard.js` (`--regulation regmc`): a contact hit, a non-contact hit and a Mold Breaker contact
  hit into the mega holder. Exit 0 clean; exit 1 under the knob and on the 0.24.0 engine bytes.

### Notes
- **The "Aura Guard card that only parts after earlier games" is not engine state.** Replayed in a fresh process with
  the driver's coverage counters restored, the Lucario game reproduces line for line. A second game that did NOT
  reproduce parts at the driver's mega choice: `MEGA_PREFER_B` in `engine/game_differential.js` alternates across
  games and is not in `driverSnap`, so whether the Lucario megas into the Aura Guard forme depends on the games before
  it. The instrument's, filed for MEASURE; see the report.
- No Reg M-B tag carries a contact-only `damageReduce`, so the new branch cannot run under Reg M-B.
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.24.0] — 2026-09-22

### Added
- **The move-effects rulebook is per-regulation.** `data/move-effects.js` (a move's secondaries, certain boosts and
  accuracy, read by `moveFxTable` in `engine/medicham2-browser.js`) joins the per-regulation map
  (`engine/regulation.js` `REG_FILE_KEYS` `moveEffects`; `runtime.regmc.moveEffects` in `data/regulations.json`). Reg
  M-C reads `data/move-effects-regmc.js`, built by `node build/build_browser_data.js --regulation regmc` from the Reg
  M-C checkout: 515 legal moves, against Reg M-B's 500. An M-C release freezes it (`engine/engine_release.js`
  `REGULATION_SOURCES`). Knob `MEDI_MOVE_EFFECTS_OWNER_TABLE` reads Reg M-B's file by its bytes, around the resolver.
- `tests/probe_regmc_move_effects.js` (`--regulation regmc`): a 100% secondary stat drop and a certain self-boost, each
  from a move Reg M-B's table has no row for, chosen from the dex; and a row for every legal move. Exit 0 clean; exit 1
  under the knob and on the 0.22.0 engine bytes.

### Changed
- `build/build_browser_data.js` writes each output where the selected regulation reads it, and SKIPS
  `data/mega-formes.js` (printed) under a regulation that has no copy of its own, so a Reg M-C run cannot overwrite
  Reg M-B's file.
- `tests/test-regulation-table.js` expects the move-effects copy in an M-C cut; `tests/test-regulation-artifacts.js`
  drops it from `NOT_YET`.
- `.gitattributes` pins `data/move-effects-regmc.js` to LF, like its Reg M-B twin: it is frozen into every M-C release,
  and an unpinned LF file is rewritten CRLF by a checkout, which moves the release id with no code change.

### Notes
- The Reg M-C table differs from Reg M-B's on the 15 new moves and on one shared row: Curse carries no `volatile` in
  the Reg M-C checkout.
- Reg M-B unmoved: `data/tags.json`, `data/protocol-events.json` and `data/move-effects.js` byte-identical; damage
  differential identical but for its output-path line (control seed differs); lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.

## [0.23.1] — 2026-09-21

### Added
- A row in `docs/REGULATION-ROTATION.md`: `engine/status.js --write` stamps the default regulation's
  live gate into every ledger, and the default is still the closed Reg M-B. A restamp after today's
  Reg M-C engine fixes would have written the Reg M-B gate as CLOSED and raised the `mtime_only`
  provenance ratchet. The restamp was reverted and not committed.

### Notes
- **Supersedes.** Nothing. **Basis.** unchanged.

## [0.23.0] — 2026-09-21

### Added
- **Reg M-C's usage model, the file CHOMP reads.** `node engine/analyze.js --regulation regmc` writes
  `data/meta-usage-regmc.json` through the new `engine/usage_regulation.js`, in the shape CHOMP already reads
  (top-level `threats`, `views.competitive`, `views.ladder`). It is counted over the LIVE Reg M-C stores (the tracked
  `.jsonl.gz`, never a plain local copy), with the frozen pool's own predicate and then the shared quality filter,
  and stamps both store digests as `source_digests`. New: per-species `sets` (the items, abilities and moves the open
  sheets declared) and a `legality` block auditing every species, item, ability and move in the corpus against the
  Reg M-C format and `TeamValidator`. An absent store refuses and writes nothing.
- `engine/regmc_pool_predicate.js` — the pool's scope and Eject Button conjunction as one module, read by
  `engine/cut_regmc_pool.js` and the usage model. `engine/usage_table.js` — the usage table itself, lifted verbatim
  out of `engine/analyze.js` so every regulation's file is counted by one function.
- `engine/durable-ingest.js storeFormatFor()` — the store token for any regulation entry; `activeStoreFormat()` is it
  applied to `active`.

### Changed
- `meta-usage.json` is declared per regulation in `engine/regulation.js`. Under Reg M-C the differential's severity
  ranking now reads Reg M-C usage; it read Reg M-B's. `tests/test-regulation-artifacts.js` drops it from NOT YET and
  probes the seam's refusal with another undeclared Reg M-B file.

### Fixed
- `engine/analyze.js` read `process.argv[2]` as its store, so an explicit `--regulation` became the store path. It now
  reads the first positional argument.

### Notes
- Reg M-B unmoved: `data/meta-usage.json` untouched, and HEAD's `analyze.js` and this one write byte-identical models
  on the same Reg M-B store. The cutter's dry run is identical with the predicate moved. Nothing is published from the
  Reg M-C model. Full account: `docs/_reports/2026-09-22-regmc-usage.md`.
## [0.22.0] — 2026-09-21

### Added
- **Emergency Exit.** Ability tag `switchesOutAtHalf` (`engine/tag_dex.js`), derived from `onEmergencyExit`; its members
  are Emergency Exit and Wimp Out, and the only legal carrier in Reg M-C is Golisopod (none in Reg M-B).
  `clearsOtherSwitches` is read off the handler the format resolves: `false` under the Champions override in the M-C
  checkout, so a pivot into the holder switches too; `true` under mainline.
- The engine asks at the two move doors: a target the move took from above half to at or below it (after the
  `AfterMoveSecondary` event, not under a Sheer Force-boosted move), and the attacker after its own recoil, punishes and
  Life Orb. The switch is one of the end-of-action switches beside an Eject Button's and a pivot's. Knobs
  `MEDI_EMERGENCY_EXIT_INERT` and `MEDI_EMERGENCY_EXIT_MAINLINE`.
- `tests/probe_regmc_emergency_exit.js` (`--regulation regmc`): a crossing hit (announce, switch), a hit that stays
  above half (nothing), a U-turn that crosses (both switch). Exit 0 clean, 1 under each knob and on the pre-fix engine.

### Changed
- `tests/regmc_probe_kit.js` pins its census stub only while the regulation has no census of its own; Reg M-C has one
  since 0.19.0.

### Fixed
- **Two pinned Reg M-C games threw** (`Cannot read properties of null (reading 'secondary')`) once the Eject Button pass
  changed what they played: the statusInflict volatile read assumed every move has a row in `data/move-effects.js`, and
  that table is not per-regulation. Guarded and counted (`MEDFAILS.moveFxMissing`). The missing rows themselves are a
  finding for the next pass: 15 legal Reg M-C moves have none, so their secondaries are not modelled.

### Notes
- Counted, not modelled: the residual and hazard doors (`MEDFAILS.emergencyExitOtherDoorUnmodelled`). An attacker's
  crossing on its recoil is announced after the target-side events rather than above them (narration).
- The Double Shock `-fail` field, the Inner Focus stat name and the fallen counter were classified, not fixed: all
  three are narration by the differential's own board comparison. See the report.
- Reg M-B unmoved: tags and protocol-events byte-identical; the damage differential identical but for its output-path
  line; the Reg M-B lattice at `--games 1200` reads 0 board-material.
- Pinned Reg M-C readings are in the report and are not published. **Supersedes.** Nothing. **Basis.** unchanged.

## [0.21.0] — 2026-09-21

### Added
- **Red Card and Eject Button.** Item tags `dragsAttackerOnHit` and `ejectsHolderOnHit` (`engine/tag_dex.js`), derived
  from each item's `onAfterMoveSecondary`; the members are Red Card and Eject Button, both legal in Reg M-C and neither in
  Reg M-B. `ejectsHolderOnHit.cancelsSourceSwitch` is read off the handler the format resolves: `false` under the Reg M-C
  checkout (Showdown `aa6d5f0856`), `true` under the mainline one.
- The engine spends Eject Button first on the event (priority 2), then Red Card; at the end of the action the Red Card
  attacker is dragged (a random bench body), then every Eject Button holder switches out, beside a pivot the button did
  not cancel, the faster leaver first. A Red Card drag cancels the attacker's own pivot. Knobs `MEDI_RED_CARD_INERT`,
  `MEDI_EJECT_BUTTON_INERT`, `MEDI_EJECT_BUTTON_MAINLINE`.
- `tests/probe_regmc_eject_items.js` (`--regulation regmc`): Red Card, Red Card into U-turn, Eject Button, Eject Button
  into U-turn (both switch), one spread hit into both items. Exit 0 clean, 1 under each knob and on the pre-fix engine.

### Notes
- Counted, not modelled: a speed tie between two owed switches (the authority breaks it with a die), and a Red Card
  drag refused by Ingrain.
- Reg M-B unmoved: tags and protocol-events byte-identical; the damage differential identical but for its output-path
  line; the Reg M-B lattice at `--games 1200` reads 0 board-material.
- The Reg M-C smoke is unpinned and is not published. Full account: `docs/_reports/2026-09-21-regmc-items.md`.
- **Supersedes.** Nothing. **Basis.** unchanged.

## [0.20.0] — 2026-09-21

### Added
- **Air Balloon.** Item tag `poppedOnHit` (`engine/tag_dex.js`), derived from the handlers: an item whose `onStart`
  announces it and whose `onDamagingHit` writes `-enditem` and empties the hand. Its one member is Air Balloon, legal in
  Reg M-C and not in Reg M-B. The engine announces it on entry (lead wave, refill, single switch) after the holder's own
  ability, silenced by Gravity, and pops it on the first damaging hit, after the holder's ability handlers and before
  the attacker's; the pop is a loss (no `lastItem`) that still wakes Unburden and Symbiosis. The ground immunity was
  already `isGrounded`'s last clause. Knobs `MEDI_AIR_BALLOON_SILENT` and `MEDI_AIR_BALLOON_UNPOPPED`.
- `tests/probe_regmc_air_balloon.js` (`--regulation regmc`): lead (announce, Ground refused, popped, Ground lands),
  no-item control, mid-game switch-in, two-arrival volley. Exit 0 clean, 1 under each knob and on the pre-fix engine.

### Notes
- The announcement is narration (under `MEDI_AIR_BALLOON_SILENT` the boards stay identical); the pop is board-material.
- Counted, not modelled: a balloon given mid-battle, a hit a doll absorbed, an announcement in the slot of an ability
  whose switch-in priority is not 0.
- Reg M-B unmoved: tags and protocol-events byte-identical; the damage differential identical but for its output-path
  line; the Reg M-B lattice at `--games 1200` reads 0 board-material.
- The Reg M-C smoke is unpinned and is not published. Full account: `docs/_reports/2026-09-21-regmc-items.md`.
- **Supersedes.** Nothing. **Basis.** unchanged.

## [0.19.0] — 2026-09-21

### Added
- **Reg M-C has its own census.** `tests/test-mechanics.js --regulation regmc` writes
  `data/mechanics-census-regmc.json` through the artifact seam, and it is pinned as
  `data/verification/census-pin-regmc-98c69a4fee7f.json`. The `regmc-` infix keeps a Reg M-C pin from being
  read as a Reg M-B one. A steered Reg M-C differential can now run pinned.
- **The seeds get census rows, for Reg M-C only.** Three rows: a terrain seed spent on entry, one spent the
  moment its terrain starts, and the Grassy heal skipping a semi-invulnerable body. Each is derived from the
  tags and the format and each goes MISSING under its knob. They register only when the selected tag file
  carries a legal seed (the seed rows) or the regulation is not Reg M-B (the Grassy row). So Reg M-B's
  census does not move.
- `engine/regulation_stores.js`: which human games a steering input is counted from. Reg M-B keeps its own
  stores. Any other regulation reads its frozen pool, checked by size and sha256 against the pool receipt,
  and REFUSES by name on an absent or altered file.
- `tests/test-regulation-steering.js` (29 checks): Reg M-B selects its literal stores; Reg M-C maps its
  behaviour table and censuses; in a sandbox the four builders count a synthetic pool and leave Reg M-B's
  files byte-identical; an absent or altered pool file refuses. Shown red on six deliberate breaks.

### Changed
- **The steering inputs follow the regulation.** `engine/click_counts.js`, `engine/sheet_usage.js`,
  `engine/policy.js` (the behaviour clone) and `engine/rollout_switch_census.js` read the selected
  regulation's pool (and its raw-log shards) under any regulation but Reg M-B. The behaviour table is a
  per-regulation engine file (`runtime.regmc.movePriors` → `data/move-priors-regmc.json`), and a Reg M-C
  release freezes it. `data/rollout-switch-census.json`, `data/joint-click-census.json` and
  `data/move-priors.observed.json` are declared per-regulation.
- `engine/game_differential.js` prints the file the seam wrote, and stamps the behaviour table and the
  switch census under the names and digests of the files it actually read.
- `engine/joint_click_census.js` refuses under a non-owner regulation. Its stores are still Reg M-B's by name.
- `tests/test-regulation-artifacts.js`: the three steering inputs leave NOT_YET. A new check fails a NOT_YET
  entry that already follows the regulation.

### Notes
- Reg M-B is unmoved. Its census rows, click counts and sheet usage are identical to what HEAD's code
  produces. No tracked Reg M-B artifact changed. `node engine/quarantine.js` differs from HEAD in one line:
  the size of its artifact inventory, which counts every file in `data/` and so counts the new Reg M-C
  files. Every clause is identical. A regulation-aware inventory is owed.
- `engine/policy.js` and `engine/rollout_switch_census.js` stamp `by` into what they write under a
  non-owner regulation. A file written through the seam has no literal writer for `engine/provenance.js`
  to find.
- The first pinned Reg M-C differential (`--games 1200`, release `2d3d1f48b940`, cut in a worktree) is a
  reading, not a published figure or a gate verdict. Full account: `docs/_reports/2026-09-21-regmc-census.md`.
- Version 0.19.0 was taken because ENGINE is working on items in parallel and may take 0.18.0.

## [0.18.0] — 2026-09-21

### Added
- **Rocky Helmet.** Item tag `punishesAttackerItem` (`engine/tag_dex.js`), derived from the handler: an item whose
  `onDamagingHit` damages the attacker by a fraction of its own max HP behind the contact check. Its one member is
  Rocky Helmet, legal in Reg M-C and not in Reg M-B. The engine pays the toll once per landed arrival, after an
  order-1 ability punisher (Rough Skin) and before an undeclared one, not behind a doll, not through Magic Guard,
  and still on the blow that knocks the holder out. Knobs `MEDI_ROCKY_HELMET_INERT` and `MEDI_ROCKY_HELMET_ONCE`.
- `tests/probe_regmc_rocky_helmet.js` (`--regulation regmc`): five staged arms (contact, non-contact control,
  Rough Skin order, a two-arrival volley, the holder knocked out). Exit 0 clean, 1 under each knob and on the
  pre-fix engine.
- `tests/regmc_probe_kit.js`, the shared scaffolding of the Reg M-C staged probes.

### Fixed
- **Every Reg M-C staged probe died at load after 0.17.0**, the 0.16.0 seeds probe included: the steering needs a census,
  and under Reg M-C it now reads `data/mechanics-census-regmc.json`, which does not exist yet. A scripted probe now pins a
  declared one-row stub outside `data/` (`scriptedCensusPin`); its games never consult the census.

### Notes
- Reg M-B unmoved: `data/tags.json` and `data/protocol-events.json` byte-identical; the damage differential
  (`--n 6000 --seed 20260804`) identical but for its own output-path line, with a control seed that differs; the
  Reg M-B lattice at `--games 1200` reads 0 board-material.
- The Reg M-C smoke is unpinned and is not published. Full account: `docs/_reports/2026-09-21-regmc-items.md`.
- **Supersedes.** Nothing. **Basis.** unchanged.

## [0.17.0] — 2026-09-21

### Added
- **The MEDICHAM gate answers per regulation.** `node engine/quarantine.js --regulation regmc` evaluates
  the same ten clauses against Reg M-C's own artifacts, pool and releases, and names the regulation on its
  first line. A missing Reg M-C artifact reads NO ARTIFACT or CANNOT-ANSWER; it never falls back to Reg M-B's.
- `engine/regulation.js` gains `artifactFor` and an fs seam: under any regulation but Reg M-B, every
  artifact the gate reads or its instruments write (`PER_REGULATION_ARTIFACTS`) is read and written as a
  `-<id>` sibling, and a write onto any other existing file under `data/` is refused. Nothing is installed
  under Reg M-B.
- `engine/lattice_walk.js` — the 2026-09-12 lattice walk made repeatable. Reg M-C's lattice is
  **1200 / 1600 / 1900**, derived on its own pool; the same rule reproduces Reg M-B's 1950.
- `tests/test-regulation-artifacts.js` — the list against the gate's derived closure, the mapping both
  ways, and the seam in a throwaway root with a Reg M-B control. Shown red on three deliberate breaks.

### Changed
- The open-defect clause reads CANNOT-ANSWER when the register verdicts are absent. It used to pass on
  "0 verdicts read", which is how the first Reg M-C run passed it. Reg M-B has the file; its output is unchanged.

### Notes
- Reg M-B unmoved: its gate output is byte-identical apart from the new first line, and so are
  `--selftest`, `--graph`, `--whole-game`, `--narration` and `--order-probe`. No tracked Reg M-B artifact moved.
- No Reg M-C figure is published. Full account: `docs/_reports/2026-09-21-regmc-gate.md`.
- **Supersedes.** Nothing. **Basis.** unchanged.

## [0.16.0] — 2026-09-21

### Added
- **The terrain seeds.** Item tag `consumedOnTerrain` (`engine/tag_dex.js`), derived from each seed's
  `onTerrainChange`; its members are the four seeds, all legal in Reg M-C and none in Reg M-B. The engine
  spends a seed the instant its terrain starts (ability or move, every active holder in speed order) and on
  entry into a standing terrain, then boosts the holder and records the spent item. Knobs
  `MEDI_SEED_UNCONSUMED` and `MEDI_SEED_NO_TERRAIN_CHANGE`.
- `tests/probe_regmc_terrain_seeds.js` (`--regulation regmc`): six staged arms against the Reg M-C authority.
  Exit 0 clean, 1 under each knob and on the pre-fix engine.

### Fixed
- **Grassy Terrain healed a semi-invulnerable body.** The smoke card read as a heal ORDER; it is the missing
  `!isSemiInvulnerable()` half of the handler. Knob `MEDI_TERRAIN_HEAL_SEMIINV`. The mechanic is reachable in
  Reg M-B too. A census row for it was written, went live, and was WITHHELD: the census is Reg M-B's, and a
  new row moves a figure the closed Reg M-B line has published. That decision is the coordinator's.

### Notes
- Reg M-B unmoved: its tag and protocol-events files are untouched, the damage differential is identical,
  and the Reg M-B lattice at `--games 1200` reads 0 board-material.
- Smoke (unpinned, not published): board-material 43 → 16 of 86 on the same sample; the next cause is
  Rocky Helmet. Full account: `docs/_reports/2026-09-21-regmc-seeds.md`.
- **Supersedes.** Nothing published. **Basis.** unchanged.

## [0.15.1] — 2026-09-21

### Added
- `docs/REGULATION-ROTATION.md` gains a running section, *Found during the rebuild*, with seven traps
  hit on Reg M-B → M-C and what to do next time. Will asked for the rotation document to be updated
  continuously; each new trap gets a row in the same commit as its fix.

### Notes
- **Supersedes.** Nothing. No figure moves. **Basis.** unchanged.

## [0.15.0] — 2026-09-21

### Added
- `data/tags-regmc.json` and `data/protocol-events-regmc.json`. Both are derived from the Reg M-C checkout
  and selected by `runtime.regmc.tags` and `runtime.regmc.protocolEvents` in `data/regulations.json`,
  using the same sibling rule as the species table. Reg M-C usage is weighted by Reg M-C's own stores:
  212,856 sheet entries.
- The six Reg M-C mega stones now carry their mega tag. The first cause "mega forme did not evolve" fell
  from 8 games to 0.
- While Reg M-C is selected, a write onto Reg M-B's tag, protocol-events or species file is refused by
  name.
- `tests/test-regulation-table.js` rises from 18 to 24 clauses. They were shown failing on a deliberate
  break first.

### Fixed
- Under Reg M-C, the differential chose its teams by Reg M-B tag membership, through `engine/names.js`.
  That file now reads the selected regulation's tag file.
- Curse had no `typeSplitMove` tag under Reg M-C, because the Reg M-C checkout has no `nonGhostTarget`
  field. The tag is now read from the handler when the field is absent. Reg M-B is unchanged.
- **The pre-commit hook's staged audit copied whole directory trees into `%TEMP%`.**
  `engine/regulation.js` spells `'..', '..', '..', '..'`, and `engine/artifact_audit.js` read that as a
  sibling checkout called `..`. So every commit copied the Projects directory (from the main tree), or
  every agent worktree (from a worktree), into `%TEMP%`, and hung silently. A name made only of dots is no
  longer treated as a sibling.

### Notes
- **Terrain set on entry is closed.** It was the first cause of 45 of the 65 dumped games; after the
  change it is the first cause of none. Of those 45 games, 19 no longer diverge. Most of the rest now part
  on the terrain seeds, which have no tag and no engine code. The seeds are the next job, and it is
  engine work. A smoke reading: board-material fell from 65 of 77 to 45 of 85 on the same sample. Not
  published.
- Reg M-B unmoved: `data/tags.json` and `data/protocol-events.json` are byte-identical, and the damage
  differential is identical apart from the launcher's pid line.

## [0.14.0] — 2026-09-21

### Added
- **Selecting Reg M-C loads the Reg M-C species table everywhere**, live and inside a frozen release.
  135 files load the table; 70 needed no edit and 61 got one line.
- `tests/test-regulation-table.js` — 18 of 18, shown failing on a deliberate break first.

### Changed
- A frozen release carries the M-C table only when Reg M-C is selected; the same tree yields two release
  ids and a release refuses to open under the other regulation.

### Fixed
- `tests/test-mc-key.js`, which the coordinator shipped red in 0.13.0 — the new table files were never
  declared to it and the pre-commit hook does not run it.

### Notes
- **The first Reg M-C games play end to end: 87 of 87, none crashed.** 65 of 77 usable games part
  boards; **53 of those are terrain set on entry**, ~9 are mega formes that cannot evolve, 11 are
  leftovers. A smoke reading, not published.
- Reg M-B unmoved: damage differential byte-identical, lattice 0 of 961 before and after. No gate
  reading is claimed for this tree.

## [0.13.0] — 2026-09-21

### Added
- `data/engine-data-regmc.js` and its builder `build/build_engine_data_regmc.js` — MEDICHAM can build
  **all 382 legal Reg M-C species, including all 35 added ones**, in a table separate from Reg M-B's.
- `tests/test-engine-data-regmc.js` — every species through `buildMon`, 15 of 15, shown red on a broken
  table first.

### Fixed
- Under the test runner, a Reg M-C run announced the M-C checkout while reading Reg M-B's. The
  announcement now names the checkout that actually runs.

### Notes
- Reg M-B unmoved: damage differential byte-for-byte identical; `data/engine-data.js` not written.
- **Still not playable**: about fifty callers load the Reg M-B table by path, and adding the new one to
  frozen releases is MEASURE's call. Six M-C stones lack a mega tag.

## [0.12.0] — 2026-09-21

### Added
- **The regulation is selectable at RUN TIME.** `engine/regulation.js` is the one resolver:
  `--regulation <id>` on any script, then `ABRA_REGULATION=<id>`, then `data/regulations.json`
  `active`. `<id>` may be a key or a full Showdown format id. `champions_sim.FORMAT` reads it, so all
  **490 readings across 357 files** follow with no edit — the differential, the roster, the census and
  the staged battery included, because each resolves through `CS.FORMAT`.
- **Selecting a regulation selects its Showdown CHECKOUT.** `data/regulations.json` gains a `runtime`
  block carrying each regulation's checkout and pinned commit; `engine/showdown_path.js` tries the
  selected regulation's checkout first. An explicit `SHOWDOWN_PATH` still wins over everything.
  `showdown_path.js` also gained the git-worktree anchor, so a worktree can now find a sibling checkout
  at all.
- **`tests/test-regulation-runtime.js`** — 35 clauses, every varying clause paired with a cleared
  control. Shown RED at 17/35 on a deliberate one-line unwiring before being trusted.

### Changed
- **`PINNED_COMMIT` / `PINNED_DATE` are per regulation**, read from `data/regulations.json` `runtime`
  rather than being literals in `engine/champions_sim.js`. One constant cannot pin two authorities.
  Absent is reported as UNKNOWN by `verify().commit_matches`, never as a mismatch.
- **`verify()` reports `regulation`, `regulation_source` and `regulation_explicit`**, so an artifact
  that stamps it can say whether a caller NAMED a regulation or the config decided.
- **`engine/engine_release.js` SOURCES gains `engine/regulation.js`** (the sixth growth, and the second
  refused at the cut rather than found by a crash). Existing releases are untouched and nothing is
  stranded; every future release id changes, which is correct.

### Fixed
- **Nine inlined reads of `data/regulations.json`, each with its own silent fallback literal, are
  gone** — `analyze.js`, `chomp_ev.js`, `durable-ingest.js`, `fetch_smogon_stats.js`, `meta-ingest.js`,
  `smogon_priors.js`, `validate_damage_sim.js`, `sim/champions-battle.js`, `champions_sim.js`.
  Hardcoded regulation sites **26 → 19** — nine deleted, two created and both declared: the resolver's
  one surviving literal, and `tests/test-regulation-runtime.js`'s independent re-reading of the
  expression it replaced, which is the control that makes clause 1 mean anything.
- **`engine/durable-ingest.js` refuses an empty format list** (exit 2) instead of running clean over
  zero formats.
- **`engine/regulation.js` was unpinned in `.gitattributes`** — caught by `tests/test-engine-release.js`
  in the same pass it was written; an LF source with no pin moves the release id on a fresh checkout
  with no code change. 79/1 → **80/0**.

### Notes
- **THIS IS A REFACTOR AND NOTHING MOVED.** Damage differential `--n 6000 --seed 20260804`:
  byte-for-byte identical. Lattice `--games 1200 --team-store data/team-pool-frozen`, no `--regulation`
  on either arm: 35,980 bytes, **two lines differ** — the release id and the wall clock. All 10
  divergences, the pool digest `0d103fb9fa87` and the census digest are identical.
  **The 10 is a fingerprint, not a gate reading**: these runs omit `--steering empirical --arm middle
  --end-state` and answer a different question from `engine/quarantine.js`.
- **`regmc` is in `runtime` and deliberately NOT in `regulations`.** `engine/next_regulation.js` walks
  `regulations` to decide what is already known, so an entry there would tell the hourly collector that
  M-C is known and stop it collecting. Being selectable is not being active; `active` is still `regmb`.
- **NO REG M-C FIGURE IS PUBLISHED and none was measured.** MEDICHAM still cannot build an M-C team —
  `data/engine-data.js` has no row for any of the 35 added species. The flag is necessary and not
  sufficient. Full account: `docs/_reports/2026-09-21-regulation-runtime.md`.

## [0.11.0] — 2026-09-21

### Added
- Nine checks wired into `tests/run-all.js` that nothing ran before: three selftests and six game-free
  probes. 9 passed, 0 failed, ~36 s added.

### Changed
- Twenty-six files named `PENDING_WIRE` with a reason. **None was named `NOT_A_CHECK`** — each asserts a
  contract, and calling one otherwise would be the failure the clause catches.

### Notes
- **The UNACCOUNTED-FOR clause is closed: 35 → 0**, from 30 before this session plus five of our own.
- No check went red once it ran — the weaker result, not the better one.
- One real defect named and not fixed: a usage probe throws `ENOENT` on an absent store instead of
  exiting 2. Twenty ledger rows are owed to ENGINE.

## [0.10.0] — 2026-09-21

### Fixed
- `tests/test-knob-control-arm.js` — three probes that gained a seal line had their recorded knob
  verdicts invalidated by the edit. Re-measured; 81 of 81 green.
- `engine/provenance.js` — the release the current artifacts were measured on (`adb08f5360f1`) was
  gitignored while the living documents cited artifacts stamped with it, so the citation chain ended at
  a string. Tracked, and **the rule written into `.gitignore`**: a release is tracked when a published
  record or the current living-document citations rest on it; a working release is not.

### Notes
- **Full 184-check suite: 172 pass, 9 waived, 4 fail** — from 17 at the start of this session.
- Remaining: `engine/conformance.js` (10 findings, 5 waiting on the model rebuild), the UNACCOUNTED-FOR
  clause (35 files nothing runs and nothing names, 30 of them pre-existing), and `test-mag-page`.

## [0.9.0] — 2026-09-21

### Fixed
- **Three classes of roster fixture never reached the legality judge.** `tests/roster.js` repairs only a
  scenario that becomes a row, so the rig's own proof fixtures, the control arm's appended click and the
  stat pricer were never judged. Illegal sets **152 → 141**; `probe_control_self_name` receipt **9 → 2**
  and GREEN. No roster count moved: items 148/148, abilities 196/200, moves 496/497 over six runs.

### Notes
- **Two illegal fixtures remain and cannot be staged legally**: no Reg M-B set both carries a quiet
  ability and clicks Skill Swap — 8 abilities, 9 carriers, 63 learners, intersection empty — and **84 of
  the 200 ability rows rest on that control**. Nothing baselined; the baseline serves a static sweep and
  this set is built at run time.
- The 9 baselined staged-board fixtures are deferred repairs, all but one repairable. Carry them, do not
  bless them.
- `tests/test-roster-arm-pin.js` builds four sets and all four are illegal — same shapes, another file.
  Reported, not repaired.

## [0.8.0] — 2026-09-21

### Changed
- **`data/meta-usage.json` regenerated on the filtered corpus** — the file CHOMP reads. `usable`
  33,539 → 28,454, with the custom-ruleset stage recorded (6,952 flagged, 5,085 removed) and the
  18.57% untestable share carried through so the count is not mistaken for a census.
- The division ledgers are restamped; `docs/ENGINE.md` records the re-measure.

### Notes
- **Whole battery on release `adb08f5360f1`: gate OPEN, board-material 0/0/0 across the lattices,
  narration zero on every lattice, held-out 7,182 games with 0 board partings**, damage 0 of 6000 at
  every corner, census 1004/1004/0.
- The engine reached those zeros while carrying a defect neither the gate nor the held-out draw could
  see. An open gate and a correct engine remain two different claims.
- Reg M-B's record is not restated: `abra/regmb` is closed at 7.0.0 and its closed-line clause refuses
  an entry above it.

## [0.7.0] — 2026-09-21

### Fixed
- **A body that dies the moment it arrives was never replaced.** The refill list was built once and
  never rebuilt, so a fainted replacement stood in its slot until the next turn; the authority loops
  until the board is settled. Found at turn 13 of a real game whose streams had been identical for 13
  turns. **This is a MEDICHAM defect the gate did not catch** — it reads zero on three lattices and on
  a 7,182-game held-out draw, and a mirror test outside the gate found it. Knob
  `MEDI_REFILL_ONE_WAVE`, probe `tests/probe_refill_second_wave.js` — 0 clean / 1 under the knob.
- **Three checks were passing vacuously**: a staged-board plant whose anchor a later wire had split in
  two, a control clause iterating an emptied array, and an end-state fixture starved to zero. Each now
  proves itself on a PLANT rather than on a defect that may cease to exist.
- A coverage driver was **stateful across games**, so one part's game count moved another part's
  verdict. Proved not-the-engine under the revert knob, then frozen and restored.
- `engine/scan_custom_rulesets.js` declared NOT_A_MODEL with its reason.

### Notes
- Census **1002 → 1004 live / 1004 probed / 0 missing**.
- **All seventeen reds a full-suite run found are closed, and thirteen of them were the instrument
  rather than the engine.**
- The engine moved, so the gate, the lattices and the held-out draw are owed a re-run, and no figure
  from the previous release is restated here.

## [0.6.0] — 2026-09-21

### Added
- **`exclude_custom_ruleset` — the ladder corpus is filtered of games played under custom rules.**
  Will: *"yes clean the store filter it all out"*. `engine/scan_custom_rulesets.js` streams
  `data/games.ladder.raw-logs.jsonl` and reads the `N custom rule(s):` infobox Showdown itself emits,
  writing the id set to `data/custom-ruleset-ids.json`; `data/quality-filter.json` 1.6.0 reads it.
  **The store is not edited** — `store raw, analyze on top`. **6,978 raw logs carry the infobox,
  6,952 distinct ids, all 6,952 present in the store = 7.37% of 94,360.** 129 alter what a team may
  legally contain or how many are picked; the other 6,823 set a different information regime, **5,210
  of them a bare `Best of = 3`** — bo3 tournament games misfiled in the bo1 ladder store. The clean
  ladder corpus moves **33,539 → 28,454 (−5,085, −15.16%)**, before and after on one store read.
  Contamination is **2.06× denser** in the clean corpus than in the store, because bots do not play
  custom-rules rooms.
- **The run prints the UNTESTABLE SHARE every time.** The infobox is in the raw log and **17,527 rows
  (18.57%)** have no local raw log, so the count is a **FLOOR, never a census**. Both readers carry
  that share out to `funnel()`.

### Fixed
- **`exclude_nonstandard_ruleset` had NO READER.** It was added and switched on at
  `data/quality-filter.json` 1.5.0 and neither `engine/quality.js` nor `engine/quality.py` looked at
  it — a rule written down, switched on, honoured by nobody, with every funnel printing a plausible
  number. Both readers honour it now, and `tests/test-quality.js` asks each enabled rule for a reason
  code a reader emits and a funnel stage that counts it, so a rule added without a reader fails by
  name rather than by a rule count.
- **`engine/sanity_check.py`'s `nobody brings more than four` honours the declaration** the way its
  winner clause already did: every over-four bring is counted, a declared one is attributed, an
  **undeclared one FAILS**, and a **declaration whose row no longer breaches FAILS** so it cannot
  outlive its defect. Shown red on both breaks before being trusted. `SANITY: 96 passed, 0 failed`.
- `engine/provenance.js` attributed `data/custom-ruleset-ids.json` to `engine/quality.py`, which only
  READS it — the reader's `open(CUSTOM_RULESET, ...)` outranked the writer's flag-bound path. The
  scanner now spells the name on its own write line and the graph says `write line`.

### Notes
- **Basis unchanged**, and **no published Reg M-B figure is affected**: `data/team-pool-frozen` holds
  `games.bo3.jsonl` and `games.ots.jsonl`, and **those two stores share zero ids with the ladder
  store** (measured 2026-09-21). This is a cleanup, not a retraction.
- **The 1,176 in `docs/_reports/2026-09-21-six-bring-game.md` §5b is superseded.** That scan's regex
  required the PLURAL `custom rules:`, so every one-rule room was invisible. Reconciled to the unit:
  its per-string joined counts (691 / 170 / 101 / 56) reproduce exactly, and the residue is 5,768
  single-rule rows plus one 8-row string.
- `data/live.js` and `data/meta-usage.json` still carry `usable 33539 / 35.5%` and are now STALE; they
  owe an OPS regeneration. `docs/SUMMARY.md` no longer cites them for that figure.
- Full account: `docs/_reports/2026-09-21-custom-ruleset-filter.md`.

## [0.5.0] — 2026-09-21

### Fixed
- **A certificate that applied and reverted nothing.** `probe_red_demo`'s mega-stone demonstration
  matched its pattern exactly once — in the arm where the stone is never taken — so it proved nothing
  while reporting fine, and its fixture had gone unreachable because the body now faints before the
  step under test runs. Four further demonstrations could not apply their patch at all after last
  night's engine work. **197 demonstrations: 0 HOLLOW, 0 COULD NOT BE APPLIED** (was 1 and 4). One
  assertion that had gone stale is now stricter, not weaker. No engine byte changed.
- **`engine/conformance.js`'s ratchet was laundering findings.** `classify()` asked *did the rule move*
  before *was this already outstanding at the seed*, and a seeded finding sits on an unchanged subject
  by definition — so editing a standard turned that standard's old findings into non-fatal DISCOVERIES,
  which **the first clean run would have adopted permanently.** Demonstrated by restoring the old order
  and reproducing it. The recorded fact now outranks the digest.
- Two further conformance checks measured the wrong thing: *"declares its generator"* read the first 400
  bytes for a word, which measures **key order** — 5 of 8 subjects were pushed past the window by a
  digest block — and the subject digest did not normalise line endings, so from a worktree every `data/`
  subject read as CHANGED and four findings carried a fictional reason.
- **`data/battle-formes.json` gets a generator, and it was derivable exactly**: `species.battleOnly`
  reproduces the hand-built map **131/131, zero missing, zero extra, zero disagreements**. The walk is
  deliberately unfiltered — filtering to the regulation drops 48 entries, which in a store spanning
  regulations are 48 silent mis-keys.
- **A withdrawn figure was still published.** `docs/ABRA-whitepaper.md` carried PORY's held-out
  log-loss with its interval and calibration error; 7.0.0 withdrew every non-MEDICHAM figure and the
  pass missed this one. Deleted, not captioned.

### Changed
- `engine/sanity_check.py`'s cross-consistency clause **REQUIRED** PORY's log-loss in the white paper
  and the summary. Will, 2026-09-21: *"dont take the previous models not named medicham as gospel i
  will likely have to change them all."* A check demanding a withdrawn figure enforces the opposite of
  the policy, so it now asserts ABSENCE, and carries the note that it flips back the day PORY is re-run.

### Notes
- `sanity_check` 94 → 95 passing. Conformance 11 → 10, all S13 artifact provenance, none exempted
  beyond a `void: true` artifact whose writer can never restamp it. **Five of the ten need a decision
  rather than a cleanup** — each requires a refit or moves a published figure — and they wait on the
  model rebuild.
- **A second tool writes absence as fact from a worktree**: `provenance.js --strict` ratcheted its stamp
  down because the worktree lacked three files main has. Reverted. Same hazard as `status.js --write`.
- **Eleven of the seventeen reds are now closed.**

## [0.4.0] — 2026-09-21

### Fixed
- **Six counters incremented a field they never declared**, so each `++` yielded NaN and the counter
  counted nothing — a capability unable to prove it ran. Declared on the objects that own them.
- **`tests/test-unmodelled-clicks.js` proved itself on a real defect, and the defect ran out.** Every
  move in this format is now modelled — the sweep is EMPTY — so the three clauses that asserted the
  counter had fired went red exactly when the hunt succeeded. The proof of life is now a PLANT (a click
  that cannot be modelled by construction); the real sweep is asserted empty separately, and a
  regression is caught by the no-growth clause where that job always belonged.
- **A record in the test runner's own notes had outlived what it described.** It said a probe had never
  been measured and carried no marker; `docs/ROADMAP.md` names it, so both halves were false. Corrected
  rather than deleted. Note left for the next editor: the matcher reads a sentence as an assertion and
  cannot tell a live claim from a quotation of a retracted one — describe old wording, do not repeat it.
- **Three probes loaded the mon table without loading the door**, leaving `MC.mons` unsealed in their
  process, where a mistyped key reads `undefined` instead of throwing — the 2026-07-30 shape. One
  require line each.
- **A probe hand-rolled a species scan.** It SEARCHES for its fixture rather than resolving a key, which
  is legitimate, so it now takes the table through `mcKey.rawTable(<why>)` — the reason is greppable and
  recorded at run time rather than resting on a name in an exemption list.
- **Three identity reads went around the door.** Declared with their reason: they match this file's own
  plants by the name it chose, on inert set objects, so routing them through the resolver would be wrong
  twice over.

### Notes
- Five gates closed: `test-counter-init`, `test-unmodelled-clicks`, `test-claim-truth`, `test-mc-key`,
  `engine/identity_audit`. With `test-knob-control-arm` and `test-workflow-paths` earlier, **8 of the
  17 reds found by the full suite are now green.**
- The finding underneath the unmodelled-clicks fix: **every move in this format resolves to something.**

## [0.3.0] — 2026-09-20

### Added
- **The frozen Reg M-C team pool** — `data/team-pool-frozen-regmc/`, 24,832 games / 49,664 sides /
  11,608 distinct teams, digest `792daded918f`. Excluded: 31,888 not-open-sheet (the scope rule) and
  **363 by Will's Eject Button conjunction** — played before the fix AND the item declared on either
  sheet. A date-only cut would have discarded 8,352 to guard against 335.
- **`docs/REGULATION-ROTATION.md`** and `engine/regulation_touchpoints.js` — what changes between
  regulations, derived rather than typed. Of 1,586 tracked files: 3 configuration, 25 hardcoded,
  110 derived, 1,364 historical (86% is write-once evidence that must NOT change).
- `engine/screen_tags.js`, and two probes: `probe_future_scope_readmission`,
  `probe_tag_derivation_without_prose`.

### Fixed
- **The scope authority silently dropped a live ability.** `engine/legal_scope.js` now puts every
  `Future`-flagged candidate to the `TeamValidator` in the set it is reached through, and prints the
  re-admitted list every run. **Reg M-B re-admits NONE — all 20 candidates refused in the validator's
  own words — so the published M-B record is provably unaffected.** M-C re-admits exactly one ability.
  Ungated re-admission would have wrongly added two mega stones; it was measured before it was wired.
- **Tags were derived from prose, and the prose moved.** `tag_dex` read `move.shortDesc`; Reg M-C ships
  without the Champions descriptions, so the screens derived the wrong halved category and the
  screen-breakers lost their tag — silently, to a default. Now derived from the condition handlers:
  **0 of 500 moves move on M-B, 0 of 515 on M-C**, with every description empty.
- **Six counters incremented a field they never declared**, so each `++` yielded NaN and the counter
  counted nothing — a capability unable to prove it ran. Declared on the objects that own them.
- `tag_dex` refuses to write under a declared restore knob; it had zeroed 316,656 usage entries and
  exited 0.
- The local parsed store was **1,766 games behind the tracked shards** (92,594 against 94,360).
  Reconciled and re-sharded; `tests/test-workflow-paths.js` green.
- `tests/test-knob-control-arm.js` understands a defect held shut by TWO guards: a knob may declare
  `PAIRED WITH <other>`, and the measurement sets both. It had read a correct probe's single-knob green
  as an unwired knob. **81 of 81 pairs green, and the declared-red list is now EMPTY.**

### Changed
- **Will's three Reg M-C decisions** (published as `7.2.0` on the Reg M-B line before this line
  existed; the content is unchanged): the Reg M-B collector's schedule is off and the format carries
  `searchShow: false` so it cannot be laddered anyway; M-C scope is the same as M-B for now — open team
  sheets only, Illusion excluded, closed sheets and bo1 out of scope; and the Eject Button exclusion is
  a CONJUNCTION rather than a date range.

### Notes
- Census 1002 → 1003 probed/live, 0 missing. The second Showdown checkout is built and Reg M-B's legal
  species set is identical in both checkouts, so nothing published at 7.0.0 moved.
- Reg M-C is **not simulated**: the engine loads it, builds a legal team and plays a game, but builds
  0 of the 35 new species because `data/engine-data.js` is an M-B artifact. No M-C figure is published.

## [0.2.0] — 2026-09-20

### Added
- **A version is per (model, regulation), and the parsers read it.** `engine/docs_scan.js` now derives
  VERSION LINES from the changelogs present: each declares itself in its own masthead, each has its own
  top, its own major floor, its own documents and its own notes rows, and a version is compared only
  inside its own line. `node engine/docs_scan.js --lines` prints them.
- `engine/model_versions.js` — the per-(model, regulation) version, DERIVED and never typed: a model
  reaches `1.0.0` only when a gate certifies it on that regulation AND no artifact it publishes is
  quarantined or stale. `node engine/model_versions.js`.
- A closed-line clause: a changelog entry or a notes row carrying a version above the `closed=` its
  line declares is refused by `tests/test-docs-current.js`. "Closed" is machine-read, not remembered.

### Changed
- The two entries published as `7.1.0` and `7.2.0` were Reg M-C setup work carrying Reg M-B numbers.
  `7.1.0`'s content is this line's `0.1.0` below, unchanged word for word.
- A `0.x` line's documents are due EVERY release rather than at its next major, because a line that has
  never shipped a major has no deferred pass to measure a backlog against (SemVer 2.0.0 clause 4). That
  is stricter than the Reg M-B rule, and it relaxes by itself the day this line reaches 1.0.0.

### Notes
- No Reg M-B figure moved, and no Reg M-B document changed its version header. This is a documentation
  versioning change; the MEDICHAM gate's clauses are untouched.
- Full account: `docs/_reports/2026-09-20-version-per-regulation.md`.

## [0.1.0] — 2026-09-20

### Added
- A second Showdown checkout for Reg M-C (`pokemon-showdown-mc`, `f10d679`, 2026-09-20), so pulling the
  M-C authority can never move the bytes Reg M-B's published figures rest on.
- `docs/REGMC.md`, the Reg M-C ledger, opening at **0.1.0** — a leading zero means not usable yet; it
  reaches 1.0.0 when the M-C gate opens.

### Notes
- Delta against the PINNED M-B authority: species +35, moves +15, items +18, abilities +0, nothing
  removed. The ruleset is identical. The real surface is 41 mechanics (15 abilities, 14 moves, 12 held
  items), not 35 species.
- Two moves legal in both regulations had PP cut 10 → 5, and Rocky Helmet is unbanned — changes no
  added/removed list reveals.
- The strict legality filter drops one live ability in M-C (1 of 317); M-C must re-admit validator-
  accepted `Future` entries and print the list every run.
- M-B's legal species set is identical in both checkouts — 347 either way — so nothing published at 7.0.0 moved.
- Published as `7.1.0` on the Reg M-B line on the day it landed, and renumbered here with its content
  unchanged. `CHANGELOG.md` now carries no entry above 7.0.0.
