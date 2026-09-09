# The quarantine re-run, ordered and filtered — derived 2026-09-09T07:21:03.624Z

**Derived, not typed.** Commands are the ones `engine/quarantine.js` itself prints beside each
withheld artifact. The RUN/EXCLUDE split is computed from the source: a file that WRITES
`data/policy-weights*.json`, or READS it, or is MILTANK, is excluded — because Will sequenced the
MAG refit after 6.0.0 and `data/policy-weights.json` must not be touched.

Re-derive on the day: `node engine/quarantine.js` and re-run this filter. Do not paste this list.

## RUN — 25 commands

```bash
toolslownode.cmd build/build_mew_bundle.js
toolslownode.cmd engine/all_mechanics_fire.js --kind all --write
toolslownode.cmd engine/backtest_winrate.js
toolslownode.cmd engine/bench_speed.js
toolslownode.cmd engine/click_census.js
toolslownode.cmd engine/collinearity_fix.js
toolslownode.cmd engine/collinearity_joint.js
toolslownode.cmd engine/feature_audit.js
toolslownode.cmd engine/feature_engine_contrast.js
toolslownode.cmd engine/feature_shift.js
toolslownode.cmd engine/game_differential.js --steering empirical --release <id> --arm middle --end-state --census <pin> --games 1200 --team-store data/team-pool-frozen --write
toolslownode.cmd engine/immunity_sweep.js
toolslownode.cmd engine/leaf_engine_contrast.js
toolslownode.cmd engine/leaf_position_contrast.js
toolslownode.cmd engine/lookahead_cost.js
toolslownode.cmd engine/mew.js
toolslownode.cmd engine/pp_board_probe.js
toolslownode.cmd engine/redirect_audit.js
toolslownode.cmd engine/replay_differential.js
toolslownode.cmd engine/rollout_explore_sweep.js
toolslownode.cmd engine/rollout_switch_probe.js
toolslownode.cmd engine/speed_vs_pokeenv.js
toolslownode.cmd tests/roster.js --stage abilities --reds --write
toolslownode.cmd tests/roster.js --stage items --reds --write
toolslownode.cmd tests/roster.js --stage moves --reds --write
```

## EXCLUDE — 18 commands, each with the reason

| command | why it must not run |
|---|---|
| `node build/build_mag_data.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node build/build_scoreboard.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/brood.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/censoring_value.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/collinearity_audit.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/em_validation.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/exploit.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/exploit_step_probe.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/fit_joint.js` | WRITES data/policy-weights*.json — the refit is owed as a REFIT and is sequenced after 6.0.0 |
| `node engine/fit_policy.js` | WRITES data/policy-weights*.json — the refit is owed as a REFIT and is sequenced after 6.0.0 |
| `node engine/ladder.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/miltank.js` | MILTANK is paused by the owner alongside MAG |
| `node engine/opponent_calibration.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/opponent_recall.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/recall_at_k.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/seed_source_audit.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/sheet_channel_value.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |
| `node engine/weight_multiplicity.js` | reads data/policy-weights.json — its output is a MAG figure and stays withheld through the major |

**The excluded set is why 6.0.0 ships with figures still withheld.** That is correct and it is
stated in the release rather than captioned: the numbers resting on the MAG weights do not become
quotable at this major, and the document says which and why.

## THE EXCLUSION IS CONSERVATIVE ON PURPOSE, AND IT COSTS NOTHING

18 of 43 is a large fraction and it deserves the argument rather than the count.

**The predicate is "reads `data/policy-weights.json`", which is broader than "is a MAG figure".** Some of
the 18 — the opponent-model and ladder generators — may load the weights as one input among several and
might be safely runnable. That is a judgement for someone awake, and being conservative overnight is the
cheap side of the trade.

**It costs nothing because these artifacts do not change withheld state either way.** Each is quarantined
today because it is downstream of MEDICHAM. Re-running it would lift *that* reason and leave it withheld
under a second one — the weights are paused. Withheld either way, so the run buys no figure and spends
machine time producing numbers about a vector that is being replaced.

**What it does buy is honesty in the release.** 6.0.0 can say precisely which figures came back and which
did not, with a reason per artifact, instead of a re-run that half-lifts a quarantine and leaves a reader
guessing which half.

## THE TWO HARD EXCLUSIONS, NAMED SEPARATELY

`engine/fit_policy.js` writes `data/policy-weights.json` (line 1385) and `engine/fit_joint.js` writes
`data/policy-weights-joint.json` (line 279). These are not conservative choices — running either would
overwrite the vector the owner has reserved for a deliberate refit, and the refit is owed as a REFIT and
not a restamp. Everything else in the table is a judgement; these two are a rule.

## WHAT 6.0.0 CAN ACTUALLY CLAIM — 39 LIFT, 22 STAY WITHHELD

Pairing each withheld artifact with the command `engine/quarantine.js` prints beside it, and applying
the same derived filter:

| | artifacts |
|---|---|
| **lift at 6.0.0** — re-run and become quotable | **39** |
| **stay withheld** — their generator reaches the paused weights, or is MILTANK | **22** |
| total with a printed re-run command | 61 |

**This is still a MAJOR and the basis still changes.** The engine stops being known-incorrect and the
withheld set collapses by 39 artifacts at once — nothing published survives unrewritten, which is the
definition the repository already keeps.

**But it is a PARTIAL lift and the release must say so in those words.** The failure mode here is not
subtle and this project has paid for it twice: announcing "the quarantine lifted" when 22 artifacts are
still withheld is the `PRE-CHANGE` caption in a new costume — technically defensible, read as a clean
bill.

### THE ONE THAT HURTS

`data/search-decision-profile.json` stays withheld, because `engine/miltank.js` is paused. **That single
artifact carries 20 of the 72 figures resting on a withheld artifact** — the largest source by a factor
of two and a half. So the largest block of the document rewrite cannot be resolved at this major and its
figures stay absent, not restated.

Also staying: all three exploitability artifacts, both exploit-step probes, the opponent-model pair
(`opponent-calibration`, `opponent-recall`), `recall-at-k`, `ladder`, `scoreboard`, `partial-label-em`,
`brood`, `censoring-value`, `collinearity-audit`, `seed-source-audit`, `rollout-r3`, and the three
weights files themselves.

**None of this is a reason to delay the major.** It is a reason for the major to carry an explicit list
of what came back and what did not, with the reason per artifact — which is cheap to produce, because
this table is derived.
