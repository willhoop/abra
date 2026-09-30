# Human-regularised search (piKL): phase B, the screens (2026-09-30, abra/regmc 1.48.0)

**Verdict.** λ 0.03 passes both screens.
- **2 s screen:** 0.515 [0.446, 0.583], clock ratio 0.993.
- **14 s screen:** 0.525 [0.456, 0.593], clock ratio 1.000.
- **Protect:** the Protect share falls from 18.1% to 15.6% and the Protect fail rate from 16.9% to 10.1% at 14 s.

λ 0.1 fails, and its screen shows that it loses: 0.405 [0.339, 0.474].

λ 0.01 passes both bars, 0.455 [0.387, 0.524] with a clock ratio of 1.006. It is **VOID by the letter** of the capability
clause: 1 of its 1,784 decisions fell back to the uniform anchor, and the pre-registration requires `missMe` = 0.

**A pass is "not shown to lose". It is not a strength claim.** No SPRT was run. The flag stays off and on no arm until
Will decides.

## Protocol, as pre-registered

- **Source:** `solver/results/2026-09-30-human-regularised/preregistration.json`, from phase A,
  `docs/_reports/2026-09-30-human-regularised-search.md`. It was run exactly as written.
- **Release:** `eaa5becc54eb`, as pre-registered. The newer release `97451d5fbf40` passed the gate at 10/10 with no gate
  figure moved, but **the pinned release stays `eaa5becc54eb`**.
- **Other pins:** team store `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc`, TEST pairs, pair-seed 1,
  100 pairs = 200 games per screen, `--info honest`, `--workers 4 --cap 50 --rule notlose`.
- **Arms:** X = gen5 + `kl` λ, Y = plain gen5. Both use ROTOM's adaptive clock (2 s: target 2000 / credit0 667; 14 s: target
  14000 / credit0 4667).
- **Seeds:** 29501 (0.01), 29502 (0.03), 29503 (0.1), 29504 (14 s).
- **Run:** in a worktree off main at 1.47.0, one screen at a time at BELOWNORMAL. This was the only game-playing job.
- **Reading:** each result was read once at 200 games (`screen-*-read.json`). The Protect figures come from
  `solver/arena/protect_read.js`, the KL counters from the last row of each shard (`ctr.kl`).
- **Outputs:** `solver/out/pikl/`.

## Results

| screen | W–L | score [95% Wilson] | not-lose | ms X / Y | clock ratio | `kl` decisions / missMe | verdict |
|---|---|---|---|---|---|---|---|
| 2 s, λ 0.01 | 91–109 | 0.455 [0.387, 0.524] | yes | 1,766 / 1,755 | 1.006 | 1,784 / **1** | **VOID** (capability clause) |
| 2 s, λ 0.03 | 103–97 | 0.515 [0.446, 0.583] | yes | 1,737 / 1,750 | 0.993 | 1,827 / 0 | **PASS** |
| 2 s, λ 0.1 | 81–119 | 0.405 [0.339, 0.474] | **no** | 1,759 / 1,773 | 0.992 | 1,787 / 0 | **FAIL** |
| 14 s, λ 0.03 | 105–95 | 0.525 [0.456, 0.593] | yes | 8,783 / 8,786 | 1.000 | 1,853 / 0 | **PASS** |

All four screens had 0 errors, 0 fallbacks and no warnings. The 14 s screen took 8,440 s. Its decision p99 was 27.7 s in both
arms, and its maximum was 27,736 ms.

**Protect** (protect_read; X is the KL arm, Y is plain gen5). Before the run, the pre-registration stated that X would be at or
below Y. Every screen came out that way:

| screen | Protect share X / Y | fail rate X / Y | double share X / Y | consecutive share X / Y |
|---|---|---|---|---|
| 2 s, 0.01 | 16.4% / 17.0% | 12.1% / 15.4% | 4.6% / 4.7% | 14.8% / 18.1% |
| 2 s, 0.03 | 14.9% / 18.8% | 9.4% / 14.9% | 4.0% / 5.4% | 12.0% / 22.2% |
| 2 s, 0.1 | 15.4% / 17.0% | 11.7% / 12.9% | 4.2% / 5.1% | 14.0% / 19.3% |
| 14 s, 0.03 | 15.6% / 18.1% | 10.1% / 16.9% | 4.2% / 5.0% | 11.2% / 21.9% |

**What the KL solve did in play** (X's `ctr.kl`, means per searched decision):

| screen | pick changed | TV to plain mix | worst-case cost | Protect mass (KL / plain) | double mass (KL / plain) |
|---|---|---|---|---|---|
| 2 s, 0.01 | 24.0% | 0.227 | 0.0042 | 0.268 / 0.287 | 0.038 / 0.042 |
| 2 s, 0.03 | 36.4% | 0.344 | 0.0123 | 0.249 / 0.281 | 0.035 / 0.040 |
| 2 s, 0.1 | 53.0% | 0.485 | 0.0311 | 0.259 / 0.308 | 0.040 / 0.053 |
| 14 s, 0.03 | 37.0% | 0.338 | 0.0129 | 0.253 / 0.272 | 0.039 / 0.042 |

The worst-case costs in play match phase A's offline numbers: 0.004 / 0.012 / 0.035. At λ 0.1 the search changes its pick on
53% of decisions and pays for it in games.

## Reading

- **λ 0.03 is the only λ that clears every bar.** It is not worse than gen5 at either clock, and it cuts the Protect fail
  rate by about 40% at 14 s. Phase A found that it plays the human's click more often (+0.036 top-1) and has the highest
  chance that a sampled move matches the human.
- **λ 0.1 costs strength.** This is the λ with phase A's best top-1 agreement. Looking human costs games past about
  λ 0.03.
- **λ 0.01 is VOID by the clause, not by the games.** One decision out of 1,784 had no prior mass on its own candidates
  (every candidate unmatched), so the search fell back to the uniform anchor as designed. The clause was written as
  `missMe = 0`. I have not reinterpreted it. The screen would have passed on both bars, and it is dominated by 0.03
  either way.
- **Multiple looks.** Three 2 s screens and one 14 s screen were run. The pre-registration says a pass is a license for the
  next screen, not a strength claim. Nothing here shows λ 0.03 is *better* than gen5. 0.525 [0.456, 0.593] is a coin flip
  with a Protect profile closer to human play.
- **The turn-4 double Protect is not fixed at λ 0.03** (phase A §4). That is the leaf's horizon fault, not a solve fault.

## OWED, NOT RUN

- **An equal-clock strength SPRT, λ 0.03 against gen5, at the ladder budget.** It is Will's call, and nothing was
  pre-registered for it yet.
- **An arm with `"kl": 0.03`**, if Will wants the flag on the ladder. It is Will's call.
- `node engine/status.js --write` from the main checkout.
