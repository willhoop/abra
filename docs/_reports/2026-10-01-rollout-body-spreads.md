# The searcher's bodies, built the way the battle's are (abra/regmc 1.69.0)

2026-10-01. SOLVER. Release `df172ccd2aaf`. Branch `worktree-agent-a946bfca89d529e63`.

## Verdict

- **`solver/tests/test-miltank.js` is GREEN, 3734/3734, and every red-on-break is still red.** The cause was two
  builders. The team body carried the sheet's nature and its role-v1 spread. The rollout's fresh body was the table's
  flat line. There is now one builder for both, and they are equal key for key.
- **`_sp` is stamped, HP included.** The 1.51.0 engine fix now reaches the arena and ROTOM. On the screen's true battles,
  367 megas and 10 forme changes recomputed from `_sp`, with 0 deltas.
- **New `solver/tests/test-body-parity.js`: GREEN 7/7, RED on both deliberate breaks.**
- **Not-lose screen at 2 s, bodies 1.69 against pre-1.69: PASS, 0.505 [0.436, 0.574].** 200 games. Every bar was met.
- **Under honest information, what the search plays barely moved.** 0 of 3,200 honest world bodies changed their stat
  line. The fix moves the omniscient searcher, self-play and ROTOM's world. In the honest search, only a mega or forme
  change inside a playout differs: 6 of 215 mega bodies land one point apart.
- **A second red on main is fixed on the way: `test-rotom-ladder` STARTUP.** ROTOM refused every public start. Its
  own-account check read a list that moved in 1.65.0.

## 1. Where bodies were built, before

| path | caller | before | after |
|---|---|---|---|
| arena team body | `solver/arena/teams.js` `buildTeam` | role-v1 spread and nature (1.49.0), no `_sp` | the same line, `_sp` stamped, spread laid before `_solverSheet` |
| omniscient fresh body | test-miltank; `solver/mew/play.js --info omniscient`; `solver/arena/arena.js` | arena.js and play.js used `SRC.bodyBuilder`; **test-miltank and arena.js's pool workers used bare `buildBody` (the flat line)** | `T.bodyBuilder(M, { view: 'truth' })`; workers get `MILTANK_BODIES=truth:<mode>` |
| honest fresh body | `solver/mew/play.js --info honest` (`XW.rollout`, `fillHidden`) | flat line, then re-laid by `publicOpp` and XATU's belief | `view: 'public'` (zero SP plus nature), then the same belief |
| ROTOM rollout | `solver/rotom/rotom.js` `R` (both policies) | flat line; `miltank-gen5` re-laid it by belief, plain `miltank` did not | `view: 'public'` |
| ROTOM world, theirs | `solver/rotom/world.js` | flat line | `view: 'public'` |
| ROTOM world, mine | `solver/rotom/world.js` | flat body plus the request's exact stats, with no nature and no `_sp` | the spread we SENT (read from our packed team) laid by `applySpread`, then the request's line; `_sp` kept only if the two lines agree |
| ROTOM preview search | `solver/rotom/policy.js` `previewSearch` | flat line on both sides | mine `truth`, theirs `public` |
| stat line | `solver/xatu/worlds.js` `applySpread` | no `_sp` | `_sp = {hp, at, df, sa, sd, sp}` |

**The SWAP clause compares battle digests, and digests read key order.** After the builder was fixed, SWAP was still red,
because the team body got `_solverSheet` before its spread and the fresh body got it after. `buildTeam` now lays the
spread first through `spread_source.layOne`, the same call `bodyBuilder` makes, so the two are one object graph.

**`spread_source` counters.** Team bodies count as before (`bodies_dressed`, `bodies_flat`). Fresh bodies count apart
(`fresh_dressed`, `fresh_flat`, `fresh_public`), so test-arena-spreads RECORD's "16 bodies dressed" still means the
team.

## 2. What each side gets

- **The arena, `--info honest` (the gate and the screens).** Own side: the true battle's bodies, cloned into the view,
  carrying `_sp`. Opponent: at the root, every body is public (zero SP under the sheet's nature) and each revealed body
  is laid at its displayed HP percentage. In each world, the hidden back line is drawn from XATU's posterior and built
  public. Then every opponent body's spread is drawn from XATU's `SpreadBelief`, stamping `_sp` at the drawn points.
  **The true spread is never handed over.** If a world has no belief, its bodies are re-laid at zero SP and counted
  (`spreadsPublicZero`, 0 on every run here). That covers a role-v1 truth-builder body, which would be the arena's true
  spread under `--spreads role-v1`.
- **The arena, `--info omniscient` (self-play, the legacy arena).** It is labelled omniscient, and the truth is a
  public function of the sheet there. Both sides get the role-v1 body.
- **ROTOM on the ladder.** Own side: the request's exact line, plus `_nature` and `_sp` from the spread we sent, kept
  only when they reproduce that line (`mineSpreadMatched`, `mineSpreadMismatch`, `mineNoSpread`). Opponent: public
  bodies. `miltank-gen5` re-spreads them by XATU's belief in every world. The plain `miltank` policy, which has no
  belief, keeps the public line.

## 3. Tests (worktree, `ABRA_REGULATION=regmc`)

| test | result |
|---|---|
| `solver/tests/test-miltank.js` | GREEN 3734/3734; reds `support`, `swapstamp`, `crn`, `peek`, `teamindex` all fail as required. Was RED on SWAP (3660/3734). |
| `solver/tests/test-body-parity.js` (new) | GREEN 7/7. FRESH 90 of 90 sets (line, nature, `_sp`, key for key, through `rollout.body`); OWN 90 of 90 (88 invest HP); PUBLIC 90 of 90; MEGA 25 of 25 HP-invested mega sets recompute exactly. RED: `SPREAD_FRESH_BREAK=flat` turns FRESH red (and test-miltank SWAP red, 3660/3734); `SPREAD_SP_BREAK=1` turns MEGA red. |
| `solver/tests/test-arena-spreads.js` | GREEN 15/15 (3 NOT CHECKED, the tournament rotation the role-v1 table predates, unchanged). |
| `solver/tests/test-honest-info.js` | GREEN 1954/1954 (with the frozen store hard-linked into the worktree for the run, then the link removed). |
| `solver/tests/test-rotom.js` | GREEN 105/105. |
| `solver/tests/test-rotom-ladder.js` | GREEN 161/161. It was RED 160/161 on STARTUP before the own-account fix (see section 6). |
| `solver/tests/test-machamp.js` | GREEN 109/109, with its reds. |

**The first draft of the MEGA clause was wrong.** It compared against the rotation's RECORDED spread, but the arena
fields role-v1's spread. On two tournament sets the two differ by design (test-arena-spreads PARITY exempts them). The
clause now compares against the spread the body actually carries.

## 4. How many playout bodies changed, and by how much

`solver/results/2026-10-01-body-spreads/measure.json` covers the screen's 100 TEST pairs at pair-seed 1 (ids
`d0197de47a82c273`), every sheet row of both sides (1,200), on release `df172ccd2aaf`.

| path | bodies | line changed | Speed changed | mean \|Δ\| HP / Atk / Def / SpA / SpD / Spe | max \|Δ\| |
|---|---:|---:|---:|---|---|
| omniscient fresh body: flat against role-v1 | 1,200 | 1,200 | 1,160 | 8.6 / 13.7 / 3.6 / 13.1 / 7.4 / 11.1 | HP 32, Atk 78, SpA 80, Spe 43 |
| public body: flat against zero-SP-plus-nature | 1,200 | 1,200 | 1,047 | 0 / 28.0 / 2.9 / 27.3 / 3.9 / 21.7 | Atk 78, SpA 80, Spe 42 |
| honest world body after XATU's belief, old builder against new, same coin | 3,200 (800 worlds) | **0** | 0 | 0 | 0 |
| mega body, delta against recompute | 215 | **6** | 3 | Atk 0.014, Spe 0.014 | 1 |

- **The omniscient searcher saw a different game from the one it played on every hidden body.** Every redrawn back-line
  body differed, and Speed differed on 97%. That covers test-miltank, self-play under `--info omniscient`, the legacy
  arena's pool workers, and ROTOM's preview search for our side.
- **The public line differs from the flat line too.** The engine table's flat line is not zero SP. ROTOM's plain
  `miltank` policy played opponents at the flat line; it now plays them at zero SP under their nature, the same root
  `miltank-gen5` lays.
- **The honest arena searched the same stat lines before and after.** XATU's belief re-laid every opponent body anyway.
  So the honest screen measures one thing: the mega and forme recompute. The six mega bodies were three Golurk (Brave,
  Attack 231 by delta against 232 recomputed) and three Glimmora (Timid, Speed 139 against 138).

## 5. The screen

Pre-registered in `solver/results/2026-10-01-body-spreads/preregistration.json`, committed and pushed as `4b71937d`
before the first game. Read once by `read.js` into `screen-bodies169-2s.read.json`; the gate result is
`screen-bodies169-2s.result.json`.

```
node solver/machamp/gate.js --release df172ccd2aaf --x solver/results/2026-10-01-body-spreads/screen-2s-bodies169.json --y solver/results/2026-10-01-body-spreads/screen-2s-pre169.json --pairs 100 --pair-seed 1 --seed 33001 --workers 4 --cap 50 --rule notlose --info honest --spreads role-v1 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/screens/screen-bodies169-2s.json
```

- **Deviation from the pre-registered command: it ran as plain `node`, not through `cmd.exe /c tools\lownode.cmd`.**
  This agent's sandbox refuses `cmd.exe` from a worktree. The shard processes set themselves to BelowNormal
  (`solver/mew/play.js` `os.setPriority`), so the workers ran at lownode's class. Only the light parent ran at
  normal priority.
- X `gen5-adaptive-2s-bodies169` against Y `gen5-adaptive-2s-pre169` (the same gen5 spec plus `bodies: "pre-1.69"`).
- **PASS: 0.505 [0.436, 0.574]**, 101–99, 0 errors, 0 capped. Pairs: both 17, split 67, lost both 16. 1,464 s.
- Bars: games 200 of at least 190. Fallback share X 0, Y 0.0006 (1 sparse table in 1,639). Playouts per searched
  decision X 397.8, Y 394.8, floor 161. Clock ratio 1.006 (mean decision 1,706 ms and 1,695 ms).
- Capability: Y stripped `_sp` on 1,639 views, 40,960 worlds and 176,952 bodies, so the bodies carried it. The true
  battles recomputed 367 megas and 10 forme changes from `_sp`, with 0 deltas and 0 stale.
- Reported, not bars: coverage of the opponent's joint with targets was X 1,378 of 1,636 and Y 1,374 of 1,639.
- **Reading.** The fix does not lose. The point estimate is 0.505, as pre-stated: the honest arms differ only where a
  playout megas or changes forme. It is not a strength claim, and nothing goes on a ladder arm.

## 6. Also fixed: ROTOM's own-account check

`solver/rotom/rotom.js` refused every non-local start unless the account appeared in `const OWN = new Set([...])` in
`solver/human/build_dataset.js` and `solver/meta/extract.js`. Since 1.65.0 both files read one list,
`data/quality-filter.json` `rules.exclude_own_accounts`, through `engine/quality.js`, and neither holds an `OWN` set
any more. So the check found no list, refused `medicham32`, and **a public ladder start was impossible.**
test-rotom-ladder STARTUP caught it: its dry-run-only arms refusal was pre-empted by this one. The check now asks
`isOwnAccount`. The list holds `medicham32`, `willhoop` and `mag`.

## 7. Files

- Code: `solver/xatu/worlds.js`, `solver/arena/spread_source.js`, `solver/arena/teams.js`, `solver/arena/arena.js`,
  `solver/miltank/pool_worker.js`, `solver/mew/play.js`, `solver/mew/agent.js`, `solver/rotom/world.js`,
  `solver/rotom/rotom.js`, `solver/rotom/policy.js`, `solver/tests/test-miltank.js`.
- New: `solver/tests/test-body-parity.js`, `solver/results/2026-10-01-body-spreads/`.
- Debris I created and left: `solver/out/screens/run-bodies169.cmd` (gitignored, unused) and `solver/out/bodyfix/`
  (test logs and the smoke run).

## OWED, NOT RUN

- **`node engine/status.js --write` from the main checkout after the merge.** It was not run here because this is a
  worktree.
- **Offline tools still build fresh bodies on the flat line.** Each one changes its own artifact when switched, so
  none is switched here: `solver/bench/{chance_bench,chance_fill,deadline_bench,playout_bench,adaptive_tune}.js`,
  `solver/porygon2/v1/label.js`, `solver/porygon2/v3/evalset.js`, `solver/machamp/deep_value.js`,
  `solver/miltank/eval_kl_human.js`, `solver/chomp/refine.js`. The pool worker keeps the flat line when
  `MILTANK_BODIES` is unset, for the benches. **The next PORYGON2 label or evalset built on an omniscient rollout should
  switch to `T.bodyBuilder(M, { view: 'truth' })` first** (fitting and playing environments must match).
- **ROTOM's own-spread check has not run on a live request.** It is proven offline on all 90 rotation sets (OWN
  clause). The first ladder or local series should show `mineSpreadMatched > 0` and `mineSpreadMismatch = 0` in the
  world counters.
- **No SPRT.** None was asked for, and the screen is not a strength claim.
- **The omniscient-side effect is unmeasured in games**: self-play and `--info omniscient`, the arm where 1,200 of
  1,200 bodies changed. Any MACHAMP self-play corpus generated before 1.69.0 had flat hidden bodies.
