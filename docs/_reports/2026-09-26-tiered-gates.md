# The tiered gates: ALWAYS BANNED (removed) and MOSTLY BANNED (weighted), Reg M-C

2026-09-26. SOLVER. Historical findings record, not maintained. Frozen release `eaa5becc54eb` for every run that played
or stepped MEDICHAM. Measured code `e3ebe197` (the held-out runs and both SPRTs); the fixed rates match ran on
`ce98278f` (the pair gate's yield to MAG, below, which changes no click in play). Pre-registration
`solver/doduo/preregistration-tiered.json`, written before any measured run. Artifacts `solver/results/2026-09-26-tiered/`.

## Verdict

- **Built as Will designed it.** A click is ALWAYS BANNED (removed) when no branch — the target staying, or any
  switch-in the opponent has — achieves its PURPOSE; it is MOSTLY BANNED (kept, weighted by the human switch model's
  probability of a rescuing switch) when it is futile against the body in now and works only on a switch. Purpose is
  read off the move's data, not a list. MAG (per slot) and DODUO's pair gate stay distinct jobs.
- **Human survival through the always-banned tier: 99.60% on the fresh 2,000 (8 losses, all 8 real misclicks by their
  replays) and 99.69% on the whole held-out population of 20,482 decisions (63 losses: 61 real misclicks, 2 gate
  errors, both in the pre-existing pair gate).** Below the 99.9% bar as a rate, as the 2026-09-25 gate was; the bar
  "every loss a real misclick" holds on the 2,000 and fails by 2 on the census.
- **Humans almost never click a mostly-banned move: 24 of 33,784 move clicks (0.071%, [0.048, 0.106]).** When they do,
  the opponent's actual joint held a rescuing switch 14 times of 23 observed, and the click achieved its purpose 13 times
  — every one of them on a turn the opponent switched. The model's mean weight on those clicks was 0.28.
- **No strength gain, again.** DODUO-greedy tiered vs ungated: **H0** after 56 games, 27–29, 0.482 [0.357, 0.610].
  MILTANK gen5 1 s tiered vs ungated: **H0** after 364 games, 170–194, 0.467 [0.416, 0.518] (equal wall-clock held:
  mean decision 965 ms vs 960 ms). Inside 150 ms a side the gate proved little: 34 MAG cuts and 1 pair cut in 30,436
  verified joints, 28,831 verdicts stopped by the budget.
- **Protect repeats and immune hits did not measurably move**, because neither baseline makes many: MILTANK 15.9% vs
  17.0% Protect repeats, 0.30% vs 0.24% immune hits (9/2,989 vs 7/2,932); DODUO-greedy (400-game rates match) 8.4% vs
  9.1% and 0.09% vs 0.18% (3/3,310 vs 6/3,316). Every interval overlaps.
- **Engine bug filed, not fixed** (`docs/ENGINE.md`): a Prankster-boosted status move refused by a Dark target ends
  with the move result `true` in MEDICHAM and `false` in the authority. It is exactly Will's Prankster Encore example,
  and it is why the gate reads a status click's purpose off the target's board rather than off that field.

## 1. The design, and how each part was derived

| | ALWAYS BANNED | MOSTLY BANNED | fine |
|---|---|---|---|
| MAG verdict | `dead` | `soft` | `live` |
| test | no world achieves the purpose: the target staying, or any switch-in | achieved only in worlds where the opponent switched | achieved in a world where nobody switched |
| in play | removed (DODUO v2 score 0) | score × P(a rescuing switch), floored at 0.001 | DODUO's score |

**Purpose (`solver/mag/purpose.js`).** Read off the move's data in the Reg M-C dex:

- `flinch` — a damaging move whose guaranteed (chance 100) secondary is a flinch. Derived today: 2 legal moves (Fake Out
  and Upper Hand). Achieved only when THIS click sets the flinch on a body that has not yet acted: MEDICHAM sets `_flinch`
  only on a target still in `unresolved` and nothing refuses it, and `solver/mag/probe.js` attributes each flinch write
  to the body whose move is executing. A switch-in has spent its action, so a flinch move is never rescued by a switch
  (Will's "even a switch-in cannot be flinched").
- `effect` — a status move aimed at another body whose effect is a status, a stat change, or a volatile the board reads
  (the keys of `readMedi`'s volatile leaves, derived on the position). Achieved when the move result is a success AND the
  target's turn-end board differs from the same world with this slot passing.
- `result` — everything else: MEDICHAM's move result, as on 2026-09-25.

Not decided, a question for Will: 45 legal damaging moves carry a guaranteed rider that is not a flinch (a speed or stat
drop). Their purpose stays DAMAGE, so none is banned because its rider is refused. A status volatile the board does not
read (Helping Hand's, Yawn's) stays `result`.

**Every switch-in.** In the eval the opponent's true brought four are in the world (hindsight is allowed there). In play
the gate's alternative worlds are drawn until every unrevealed sheet member has stood on the bench (at most 16 draws;
none when all four brought are revealed). Coverage in the MILTANK SPRT: 11,098 of 11,124 candidates (99.8%).

**The weight (`solver/doduo/v2.js` softWeight).** The HUMAN joint model (MAG v1 + DODUO v1) scores the opponent's joints
from its own seat in the gate's world; the weight is its mass on joints holding a switch that rescued the click in the
gate's worlds; floor 0.001 (the 2026-09-25 constant). Counted: calls, fallbacks (0), weight sum/min/max.

**The two gates stay distinct.** With purpose, a click can be dead for its slot and still move the board beside some
partner (a Fake Out at my own Ghost-type partner lands on the ally who switches in), and the pair gate then cut it: 593
pair cuts on a MAG-dead click in the seed-5 eval, where the 2026-09-25 gate had 0. The removal is the same either way; the
pair gate now yields to MAG on a MAG-dead click (`solver/doduo/gate.js`, commit `ce98278f`). This changes no click in
play (DODUO v2 cuts on MAG before it asks the pair gate) and was made after the held-out runs, so the 593 stands in
their tables.

## 2. Tests (`solver/tests/test-gates.js`, 42 checks, 21 deliberate breaks, each red)

Every entity derived by property from the Reg M-C dex, every fixture's premise checked with one plain engine step.

| clause | what it asserts | break that turns it red |
|---|---|---|
| FAKEOUT | a flinch move into a body whose ability refuses the flinch is DEAD with a flinchable bench (move result alone: live); into a type-immune body with a bench it would hit, DEAD (move result alone: soft); into a flinchable body, LIVE | `purposeresult`, `flinchany` |
| ENCORE | a Prankster Encore into a Dark body that has moved is DEAD with a bench; into a non-Dark body that has moved, LIVE | `purposeresult` |
| WEIGHT | a mostly-banned click's weight equals the switch model's mass on rescuing joints (two stand-in models, 0.4444 and 0.0099) | `softconst` |
| BENCH | the alternative worlds put every unrevealed sheet member on the bench (12 of 12 over 3 positions) | `benchone` |
| DISJOINT | the pair gate cuts no pair on a MAG-dead click, including the purpose case above | `pairondead` |
| ALLFUTILE | a click that works but changes nothing beside any partner (a side guard with nothing to block) is kept | `pairany` |
| SHIELDRES | a result-purpose status click at a foe that can only hold a Protect is untested, never live | `shieldcounts` |
| HH, REDIRECT, … | Helping Hand beside a non-attacker or a switch is cut (pair level, DODUO's gate), unchanged | as on 2026-09-25 |

Two breaks were re-aimed, and it is said rather than hidden: `shieldcounts` went blind on STATUSED (a status click is now
read on the board, so the `#509` residual no longer reaches it) and now turns SHIELDRES red; `pairany` went blind on
DISJOINT (the yield) and now turns ALLFUTILE red; `twovalued` is asked of `effectBesideOther` directly in UNKNOWN.

## 3. Human survival through the always-banned tier (held-out Reg M-C, release `eaa5becc54eb`)

Dataset `solver/out/human/games.jsonl` sha256 `9d07c522…ccf2b4c8`, the same bytes as 2026-09-25; test-split players only.

| run | decisions | survived | rate, Wilson 95% | lost: MAG / pair | real misclicks by replay |
|---|---|---|---|---|---|
| fresh draw, seed 5, full gates | 2,000 | 1,992 | **99.60% [99.21, 99.80]** | 7 / 1 | **8 of 8** |
| census, every eligible decision (`--human-only`) | 20,482 (19 unmatched) | 20,419 | **99.69% [99.61, 99.76]** | 49 / 14 | **61 of 63** |

Bar (pre-registered): ≥ 99.9% AND every loss a real misclick. **Not met as a rate on either; the misclick half holds on
the 2,000 and fails by 2 on the census.** Replays read by `solver/doduo/loss_replays.js` (the protocol lines after each cut
click, printed in full in `*.loss_replays.json`).

What the humans lost, in the census: Fake Outs into Psychic Terrain (9), into Armor Tail / Queenly Majesty (4), into a
switch-in or a flinch-refusing body (2); Prankster Encores into Dark bodies or Psychic Terrain; Toxic into a Poison type;
moves into type immunities; Tailwind / Reflect / Aurora Veil already up; a second Perish Song; Helping Hand beside a
Protect; Protects and a Quick Guard with nothing to block.

**The two gate errors (both the 2026-09-25 pair gate, neither introduced here):**

| game, turn | click | why the gate cut it | replay |
|---|---|---|---|
| `…2682657318` t6 | Yawn beside the partner's Fake Out | Yawn's effect is not on the board (`board_state.js` declares the yawn leaf NOT wired), so it reads "no effect" everywhere; an effect seen beside another partner (limit 5 of 2026-09-25: a speed tie resolving differently) made it "the pair's" | `-start … move: Yawn` — it landed |
| `…2679809811` t4 | Feint beside the partner's Protect | the target sat at 1% HP; in every gate world it is off the board by the turn's end whether or not the Feint lands (traced: its slot's HP is identical with the Feint and with a pass), so the Feint reads as no effect | the Feint KO'd it |

**What the purpose changed** (seed 5, per-slot options, `purpose_by_verdict`): flinch moves 159 live→dead, 78 soft→dead,
33 live→soft; status `effect` moves 77 live→dead, 24 live→soft, 5 soft→dead. MAG dead 2.57% of judged options (1.56% on
2026-09-25), soft 1.79%. Joints removed: MAG 3.79% of legal, pair gate 4.05%, either 7.50%. Cost of the full gate: median
2.3 s a decision (mean 5.6 s, max 74 s), an offline instrument.

## 4. Mostly-banned clicks by humans

| | census (20,482) | seed 5 (2,000) |
|---|---|---|
| human move clicks mostly-banned | **24 of 33,784 = 0.071% [0.048, 0.106]** | 1 of 3,288 |
| decisions holding one | 23 | 1 |
| switch-model weight: mean (min, max) | 0.28 (0.008, 0.92) | 0.85 |
| opponent switched (any slot) | 17 of 24 | 1 |
| opponent's actual joint held a rescuing switch | **14 of 23** observed [41, 78]% | 1 of 1 |
| the click achieved its purpose vs the actual joint | **13 of 23** [37, 74]% | 1 of 1 |
| … on a turn the opponent switched | 13 of 13 | 1 |

Base rate: the opponent switched on 5,033 of 20,482 decisions (24.6%). So a human's mostly-banned click is a read that
paid off a little over half the time — the switch model's mean weight on them, 0.28, is below that realised rate, but on
23 clicks that is not a calibration statement. Moves: Close Combat 5, Toxic 4, Focus Blast 2, Aura Sphere 2, and single
clicks of eleven others.

## 5. Play (frozen release, frozen team store, test pairs, paired seats, honest information)

SPRT elo0 0, elo1 +20, α = β = 0.05, read once at the bound or at 400 games (`solver/machamp/sprt.js`).

| | stop | W–L | score, Wilson 95% | gate activity | decision ms, gated / ungated |
|---|---|---|---|---|---|
| **DODUO-greedy tiered vs ungated** (seed 61) | **H0** at 56 games | 27–29 | 0.482 [0.357, 0.610] | 7 MAG cuts, 0 pair, 6 soft weights (0.04–0.27) in 646 verified (all 74 games played, incl. past the stop) | mean 84 / 12, p99 1,492 / –, max 3,814 / 44 |
| **MILTANK gen5 1 s tiered vs ungated** (seed 62) | **H0** at 364 games | 170–194 | 0.467 [0.416, 0.518] | 34 MAG cuts, 1 pair, 3 soft weights in 30,436 verified; 28,831 budget stops (all games played, incl. past the stop) | mean 965 / 960, p99 1,167, max 2,668 / 1,816 |

Both at H0. The MILTANK arm repeats the 2026-09-25 H0 on the earlier gate code (0.466); the gate cannot prove much in
150 ms, and what it spends is taken from the playouts.

**Click rates** (`solver/arena/click_rates.js`, on the true battle at the click; Protect repeat = a Protect-family click by
a body whose streak is live; immune hit = a single-target damaging click into a body MEDICHAM's damage function prices at
0). The DODUO-greedy SPRT stopped after 56 games, too few to read a rate, so a fixed 400-game match of the same arms (seed
63) was ADDED after that stop, read for the rates only:

| | tiered arm | ungated arm |
|---|---|---|
| MILTANK (SPRT, 364 games): Protect repeats | 174 / 1,097 = 15.9% [13.8, 18.1] | 190 / 1,120 = 17.0% [14.9, 19.3] |
| MILTANK: immune hits | 9 / 2,989 = 0.30% [0.16, 0.57] | 7 / 2,932 = 0.24% [0.12, 0.49] |
| DODUO-greedy (400-game match): Protect repeats | 79 / 936 = 8.4% [6.8, 10.4] | 85 / 938 = 9.1% [7.4, 11.1] |
| DODUO-greedy: immune hits | 3 / 3,310 = 0.09% [0.03, 0.27] | 6 / 3,316 = 0.18% [0.08, 0.39] |
| DODUO-greedy SPRT (56 games): Protect repeats / immune hits | 3/110, 0/472 | 3/108, 0/481 |

Pre-registered prediction: the tiered arm's immune-hit rate is no higher than the ungated arm's. **Held for DODUO-greedy
(3 vs 6), not for MILTANK (9 vs 7); neither difference is distinguishable from zero.** A Protect repeat is not banned
(a streak Protect can still succeed on its roll, so no tier removes it); an immune hit can still be a mostly-banned read,
which the tier keeps by design, or a MILTANK pick the 150 ms gate never reached.

## 6. Limits, stated

1. The gate errors above are the pair gate's (a board-invisible effect; a 1%-HP target whose removal does not depend on
   the click). Both are 2026-09-25 behaviour; neither is fixed here.
2. The flinch attribution is by the executing body: a flinch set by a reaction inside my move would be credited to me —
   the safe direction (keep).
3. The `effect` purpose reads only the target's board; a status move whose value is elsewhere keeps `result`.
4. The weight is the human model's probability, not the searcher's: MILTANK's candidates (both sides) are weighted by the
   human's switch rate even when the opponent is a bot.
5. cmd.exe is refused in this agent's shell, so `tools\lownode.cmd` could not be called: every heavy process lowered
   itself to BELOW_NORMAL (`os.setPriority` in `eval_gates.js` and `play.js`). At most three workers at a time.

## 7. Reproduce

```
node solver/tests/test-gates.js
node solver/doduo/eval_gates.js --release eaa5becc54eb --n 2000 --seed 5 --workers 3 --out solver/out/gates/eaa5becc54eb/tiered-eval-n2000-s5-e3ebe197
node solver/doduo/eval_gates.js --release eaa5becc54eb --n 20501 --seed 6 --workers 3 --human-only --out solver/out/gates/eaa5becc54eb/tiered-census-s6-e3ebe197
node solver/doduo/loss_replays.js <out>/summary.json --out <out>/loss_replays.json
node solver/machamp/sprt.js --release eaa5becc54eb --x solver/doduo/specs/doduo-greedy-tiered.json --y solver/machamp/league/human-clone.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 400 --seed 61 --workers 3 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/gates/eaa5becc54eb/sprt-doduo-greedy-tiered-vs-clone-s61.json
node solver/machamp/sprt.js --release eaa5becc54eb --x solver/doduo/specs/gen5-tiered.json --y solver/machamp/league/gen5.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 400 --seed 62 --workers 3 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/gates/eaa5becc54eb/sprt-gen5-tiered-vs-gen5-s62.json
node solver/mew/play.js --mode match --cycle --release eaa5becc54eb --x solver/doduo/specs/doduo-greedy-tiered.json --y solver/machamp/league/human-clone.json --pairs 200 --pair-seed 1 --seed 63 --shard <i> --shards 3 --cap 50 --team-store <store> --out <dir>/shard-<i>.jsonl
node solver/arena/click_rates_read.js <sprt result .json | the match's shard dir>
```
