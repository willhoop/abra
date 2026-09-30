# The double-Protect soft gate — phase A (2026-09-30, abra/regmc 1.32.0)

**Verdict.** The gate is built, tested and off by default. It is on no arm. The data supports Will's rule for Fake Out,
Trick Room, Tailwind and Perish. **It does not support terrain, weather or screens as stall reasons.** Humans
double-Protect at the base rate under them. The case that prompted the rule (chomp1 game 1 turn 4) **is exempt by the
rule's own terrain clause**, so as written the gate would not have changed that click. Survival of the human joint is
**99.63% [99.54, 99.71]**, at the bar. Phase B is pre-registered and not run.

## 1. What was built

- `solver/doduo/double_protect.js`. If both of my actives click a protect-type move, the joint's prior score is
  multiplied by `weight` (default 0.001, the tiered gates' floor). It is never removed. The weight does not apply when
  a stall condition holds on the board:
  | reason | read from | rule |
  |---|---|---|
  | `trickroom` | `field.tr` > 0 | Trick Room is up, and the opponent's live actives have a lower mean engine `effSpeed(m, field, side)` than mine. It then favours them. |
  | `weather` / `terrain` | `field.weather`/`weatherT`, `field.terrain`/`terrainT` > 0 | Only the opponent's revealed bodies can set it. A body can set it through its ability now, its sheet ability or a move, read from the dex (the ability's `onStart` `setWeather`/`setTerrain`, the move's `weather`/`terrain`). If both sides can set it, it is contested and exempts nothing. |
  | `tailwind` | `field.twA`/`twB` (the opponent's) > 0 | The opponent's Tailwind only. |
  | `screen` | the opponent's `sf.sc[id]` > 0 | An own-side condition with `duration` > 1 and `onAnyModifyDamage`. Derived: Reflect, Light Screen, Aurora Veil. |
  | `fakeout` | the engine's `legalActions` for the opponent | A live foe's menu offers a move whose purpose is the flinch (`purpose.js`) and that carries the engine tag `firstTurnOnly`. The engine refuses it at selection after the user's first move action (`_mvActs`). |
  | `firstturn` | the same | Any other first-turn-only move (First Impression). **This is not on Will's list.** It is reported as its own reason and can be switched off. |
  | `perish` | board `_perish`, else `ctx.pubNow` `vol.perish` | A foe has a count, and none of my actives has a count at or below the foe's lowest. |
  | `residual` | board status, `_seededBy`, `_vol.saltcure`/`curse`, else public `Leech Seed`/`Salt Cure` | A foe is poisoned, badly poisoned or burned, or carries Leech Seed, Salt Cure or Curse. |
- **Not a reason:** a foe that can set a field effect this turn. The `SETUP` test clause asserts this.
- **Protect-type** is the gates' shield predicate, `probe.js isShield`: a `stallingMove` with target `self`. It includes
  Endure. It excludes Wide Guard and Quick Guard.
- **My side only.** The opponent's MILTANK columns are not weighted. The single-slot Protect and the repeat-Protect roll
  are unchanged.
- **Wiring.** DODUO v2 applies it (`gates.doubleProtect`). `gates.tiers: false` runs it with no MAG or pair verdicts and
  no engine steps. `mew/agent.js` digests the file into `digests.gates`.
- **Counters.** offered, fired, joints weighted, exempt by reason, contested weather and terrain, public-state reads,
  top demoted. The counters appear in `COUNTERS.gates[<arm>].doubleProtect` on every arena row.
- `solver/rotom/world.js` puts the current public state on `ctx.pubNow`. The world does not lay Perish, Leech Seed or
  Salt Cure. Only this gate reads `ctx.pubNow`.
- `solver/arena/protect_stats.js` counts `pairs` and `doubles` with the same predicate. `protect_read.js` prints
  `double_share`.

### Left out, named

- Magic Guard and other residual refusals are not checked. A poisoned Magic Guard foe still exempts.
- Safeguard, Gravity, Magic Room and Wonder Room are not stall reasons. Safeguard is a timed own-side condition, but it
  is not a screen.
- The owner of a weather or terrain is a proxy: who can set it, not who did. The log's `[of]` is not carried into the
  world.
- Trick Room favour on the live root compares the opponent at zero SP, because that is how ROTOM lays the honest root.

## 2. Held-out human decisions (the `eval_gates.js --dp` harness)

Release `eaa5becc54eb`. All 20,501 eligible held-out decisions (the TEST split, stride 1); 20,482 evaluated, 19
unmatched, 0 errors. Dataset sha256 `9d07c522…`. Artifacts: `solver/results/2026-09-30-double-protect/eval-human-dp.json`
and `human-dp-rates.json` (`solver/doduo/dp_rates.js`).

- Humans double-Protect on **646 of 20,482 decisions, 3.15% [2.92, 3.40]**. When the legal set offers a double
  protect, the rate is 7.1% (646 of 9,128).
- **Exempt: 571. Not exempt: 75. Survival: 99.63% [99.54, 99.71].** The other tiers' bar is about 99.6%, and this
  meets it.
- Exempt human double Protects by reason (a decision can carry several): Fake Out 294, terrain 233, weather 107,
  Trick Room 99, Tailwind 99, residual 46, screen 20, Perish 19, first-turn 3.

**The test of the rule is the human rate by reason**, over offered decisions where that reason holds alone:

| stall condition (alone) | offered | human double | rate [95%] |
|---|---:|---:|---|
| none | 3,466 | 75 | 2.2% [1.7, 2.7] |
| Fake Out | 727 | 120 | **16.5%** [14.0, 19.4] |
| Trick Room | 237 | 35 | **14.8%** [10.8, 19.8] |
| Tailwind | 368 | 48 | **13.0%** [10.0, 16.9] |
| Perish | 28 | 14 | **50.0%** [32.6, 67.4] |
| weather | 781 | 23 | 2.9% [2.0, 4.4] |
| terrain | 1,298 | 29 | 2.2% [1.6, 3.2] |
| screen | 151 | 1 | 0.7% [0.1, 3.7] |
| residual | 126 | 5 | 4.0% [1.7, 9.0] |
| first-turn | 13 | 1 | 7.7% [1.4, 33.3] |

Fake Out, Trick Room, Tailwind and Perish raise the human rate 6 to 20 times. Terrain and screens leave it at the base
rate. Weather is at most slightly above it. Humans do not double-Protect outside the exemptions often: the rate there is
2.2%. The rule's exemptions are too broad, not too narrow.

The 75 non-exempt human double Protects: 28 were on a clear field. 20 were under their own weather and 19 under their
own terrain. 9 were under a contested field and 4 under a Trick Room that favoured them. 20 were on turn 1. Their
opponents mostly attacked (Protect 15, switch 8, then single attacks).

Variants (`human-dp-rates.json`):

| exemptions off | human doubles weighted | survival | gate fires on offered |
|---|---:|---|---:|
| none (Will's rule) | 75 of 646 | 99.63% [99.54, 99.71] | 3,466 of 9,128 |
| terrain, screen | 106 | 99.48% [99.37, 99.57] | 4,925 |
| terrain, screen, weather | 138 | 99.33% [99.20, 99.43] | 6,033 |
| + residual | 165 | 99.19% [99.06, 99.31] | 6,328 |

## 3. chomp1 game 1 turn 4, replayed

`solver/tests/probe_dp_replay.js`. The position is rebuilt the way ROTOM builds it (parse, `world.js` with the log).
The request is synthesised from the log, because ROTOM does not store it. The run uses 96 passes (the live count)
with no clock, 3 coins per arm. Artifact: `solver/results/2026-09-30-double-protect/replay-chomp1-g1-t4.json`.

- **Ungated (live gen5):** rows `move 3 mega, switch 4` / `move 3 mega, move 4` / `move 3 mega, move 3 2` /
  `move 4 mega, move 4`. Mix [0, 0.148, 0, 0.852], value 0.822. The double Protect is picked. The live run had 0.791
  at value 0.825, so the replay reproduces it.
- **Gated as written:** the same mix, 0.852 on the double Protect. The gate is **exempt by `terrain`**: the opponent's
  Grassy Terrain (set by their revealed Grassy Surge body, 1 turn left, none of our four can set it). Our Sandstorm is
  correctly ours (`weatherSetter: mine`). Counters: offered 3, fired 0, exempt 3 (terrain).
- **Gated, terrain exemption off** (diagnostic): the double Protect leaves the rows. The search plays
  **`move 3 mega, switch 4`** at 0.997 on every coin: mega Gengar clicks Substitute, and Hippowdon switches to Sneasler.
  Value 0.683–0.688. The gate fired 3 times.

So the rule as Will worded it lets this click through. The data in §2 says the terrain clause is the weak one. **Should
terrain (and screens) count? That is Will's call.** Dropping them costs about 0.15 points of human survival (99.63% to
99.48%).

## 4. Tests

- `solver/tests/test-double-protect.js`: **34/34 GREEN**, release `eaa5becc54eb`. Clauses: PROTECT, OFF, FIRES, SINGLE,
  OPPSIDE, TRICKROOM, OWNFIELD, TAILWIND, SCREEN, FAKEOUT, PERISH, RESIDUAL, SETUP, AGENT, STATS. Every entity is
  derived. The Trick Room move is found by stepping the engine.
- **RED on every deliberate break:** `dpoff` → FIRES, `dpnoexempt` → TRICKROOM, `dpanyfield` → OWNFIELD, `dpsheetfo` →
  FAKEOUT. The first version was BLIND on `dpnoexempt`, because TRICKROOM read `stall()` rather than the weights. It
  now asserts on the weights.
- Regressions: `test-gates.js --no-red` 42/42, `test-rotom.js` 105/105. `test-rotom-world-stall.js` cannot run in a
  worktree: its store path is relative (`data/team-pool-frozen-regmc`) and a worktree has no `games.bo3.jsonl`. It is
  owed a run from the main checkout. The `world.js` change only adds `ctx.pubNow`.

## 5. Pins and flags

Release `eaa5becc54eb`. Human dataset: the main checkout's `solver/out/human/games.jsonl`, sha256 `9d07c522…`.
`eval_gates.js --release eaa5becc54eb --n 30000 --seed 1 --workers 3 --dp`, which gives stride 1 and every eligible
decision. Replay: `--turn 4 --passes 96 --seeds 3`, coins 4000–4002. No arena game was played. Nothing touched the
main checkout or the live run; the live logs were read only.

## OWED, NOT RUN

Phase B, pre-registered in `solver/results/2026-09-30-double-protect/preregistration.json` before any game. The
arms are gated gen5 (the gate alone, as Will wrote it) against ungated gen5, both on the adaptive clock at target 2 s
(credit0 667 ms). The run uses the same 100 TEST pairs, pair seed 1, and 200 games.

**Bars, read ONCE at 200 games:** gate.js `notlose`, meaning the Wilson 95% upper bound of X ≥ 0.5, **and** the clock
ratio `decision_ms.x.mean / decision_ms.y.mean ≤ 1.10`. X's `doubleProtect.fired` must be > 0 in the rows; a zero is
VOID. Also read, not a bar: the double-Protect share and the Protect fail rate from `protect_read.js`, stated in
advance to go down for X.

Run from the main checkout in PowerShell, after this branch is merged and when the game slot is free:

```
$env:ABRA_REGULATION='regmc'; cmd /c tools\lownode.cmd solver/machamp/gate.js --release eaa5becc54eb --x solver/results/2026-09-30-double-protect/screen-2s-dp.json --y solver/results/2026-09-30-double-protect/screen-2s-off.json --pairs 100 --pair-seed 1 --seed 29301 --workers 4 --cap 50 --rule notlose --info honest --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/double-protect/screen-2s-dp.json
```

Read once, at the end:

```
node solver/arena/protect_read.js solver/out/double-protect/screen-2s-dp.json
node -e "const r=require('./solver/out/double-protect/screen-2s-dp.json');console.log(JSON.stringify({result:r.result,pass:r.pass,ratio:r.decision_ms.x.mean/r.decision_ms.y.mean,warnings:r.warnings}))"
```

For the gate counter, read the last row's `ctr.gates['gen5-dp-adaptive-2s'].doubleProtect` in each
`solver/out/double-protect/screen-2s-dp.shards/shard-*.jsonl`.

**Optional B2, only if Will drops terrain and screens:** the same command with
`--x solver/results/2026-09-30-double-protect/screen-2s-dpstrict.json --seed 29302 --out solver/out/double-protect/screen-2s-dpstrict.json`,
with the same bars.

Also owed: `node solver/tests/test-rotom-world-stall.js` from the main checkout, after the merge.
