# Study design — how much skill is there in Champions Reg M-B Bo1?

**Drafted 2026-07-25. Status: designed, not run.**

This replaces the ratings half of `docs/predictability-study.md`, whose headline — *"the higher-rated
player wins 55.0%"* — does not survive the quality filter and, separately, is not the right statistic.

---

## 1. Why the current number is wrong twice

### It was measured with bots in

`engine/predictability.py` line 37 excludes a game only if `p1.bot` or `p2.bot` — the **name** flag.
That is the rule which missed six high-volume accounts. Measured on the current store:

| Filtering | Higher-rated player wins | n |
|---|---|---|
| Name flag only — **the published method** | **54.7%**  [53.0, 56.5] | 3,031 |
| + behavioural bots removed | **52.4%**  [49.9, 54.9] | 1,501 |
| Full quality filter | **50.9%**  [47.1, 54.6] | 676 |

The middle row is the fair test: it removes only the contamination and changes nothing else. The
interval then **includes 50%**. The published claim that rating beats a coin does not survive.

Segmented by ladder tier (bots removed, n=1,501), the "low ladder is the wild west" hypothesis also
fails — there is no trend, and the 1200–1300 band is *below* even:

| Tier (lower player) | Higher-rated wins |
|---|---|
| <1100 | 51.2% |
| 1100–1200 | 57.3% |
| 1200–1300 | 46.4% |
| 1300–1400 | 53.7% |
| 1400+ | 52.3% |

On fully clean games the 1300+ slice is 49.4%.

### It is the wrong statistic even when measured correctly

"How often does the higher-rated player win" is a **base-rate statistic about the rating**, not a
measurement of skill. It confounds three things: how much true skill varies, how accurately the
rating estimates it, and how the observed pairs were selected. `docs/THESIS-REVIEW-v2.md` §F already
said this — *"matching two aggregate win rates is not validation (base-rate fallacy)… redo the study
as a proper skill/luck decomposition with intervals, à la Lopez et al."* That fix was never applied.

---

## 2. Is the chess comparison fair? No.

Five reasons, in order of severity.

**2.1 The ratings are provisional by the platform's own standard.** Showdown's Glicko-1 starts every
player at R=1500, **RD=130**, and Showdown *refuses to publish a GXE for anyone with RD ≥ 100*
because it is "too inaccurate to provide meaningful insight." This store is **three days** of a
brand-new format. Essentially every account in it is inside the window Showdown itself considers too
uncertain to report. We are not measuring whether skill predicts; we are measuring whether a
deliberately-unreliable provisional estimate predicts.

**2.2 A Showdown Elo point is not a chess Elo point.** Showdown's Elo carries a sliding K-factor and
its own decay. A "100-point gap" is not the same unit as 100 FIDE Elo, so mapping it onto chess's
expectancy curve is a category error.

**2.3 Chess has draws.** Chess expectancy is an **expected score** with draws at 0.5. Champions Bo1
has no draws, so 64% expected score and 52% win rate are different quantities.

**2.4 Bo1 versus a series.** Lopez et al. report the NBA's better team winning roughly 80% of a
**seven-game series**; single games are far lower. Real VGC is Bo3. Comparing our Bo1 number to a
series number overstates the gap.

**2.5 Selection.** Lopez et al. use complete league schedules. Public Showdown replays are
**opt-in uploads** — players save wins and flashy games. The sample is self-selected in a direction
nobody has measured.

---

## 3. What the literature actually offers

**Lopez, Matthews & Baumer (2018), *How often does the best team win? A unified approach to
understanding randomness in North American sport*, Annals of Applied Statistics 12(4).**

This paper exists for precisely our problem: making randomness comparable **across** competitions
whose scoring, schedule length and rating conventions differ. Method: Bayesian state-space models
fitted to betting-market data, yielding per-league estimates of the **dispersion of team strength**,
its between-season / within-season / game-to-game variability, and home advantage.

Reported qualitative findings: the **NBA** has the largest talent dispersion and the largest home
advantage; the **NHL and MLB** stand out for the randomness of single-game outcomes; in the NBA the
better team wins about **80% of a seven-game series**.

The transferable idea is the comparable statistic. Do not compare raw win rates. Estimate the
**standard deviation of latent competitor strength on the log-odds scale (σ)**, then derive
**P(better competitor wins a single game)** for a randomly drawn pair. That quantity is defined
identically in every sport, and it is what our study should report.

---

## 4. The study

**Question.** What fraction of a Champions Reg M-B Bo1 outcome is attributable to player skill, and
where does that sit against other rated competitions on a common scale?

### 4.1 Population
Clean games only, funnel reported. Sensitivity runs on (a) bots-removed-only and (b) full filter,
because the full filter drops forfeits and short games and therefore conditions on game length.

### 4.2 Model
Bradley–Terry on **player identity**, not rating:

> P(i beats j) = σ(θ_i − θ_j),  θ ~ Normal(0, σ_θ²)

fitted hierarchically (partial pooling), so a player with four games is shrunk toward the mean
instead of posting a spurious extreme. **σ_θ is the estimand** — the dispersion of true skill.

Fitting the *rating* instead would re-import the RD problem from §2.1. Player identity sidesteps it:
we estimate skill from results directly, and the platform rating becomes a covariate to validate
against rather than the measurement itself.

### 4.3 The comparable statistic
From the fitted σ_θ, compute by simulation over random pairs:

- **P(better player wins a single game)** — directly comparable to Lopez et al.
- **P(better player wins a Bo3)** — the format real tournaments use.
- **The pregame ceiling:** E[max(p, 1−p)], the best accuracy *any* pregame model could achieve. If
  that lands near 52%, it explains every null in this project at once — JOLTEON, roles, CHOMP-EV and
  WAR are not weak models, they are at the ceiling.

### 4.4 Controls
- Restrict to players with ≥ N games (N = 5, 10, 20) and report σ_θ at each; if σ_θ rises with N, the
  low-N estimate was noise-dominated.
- Report by rating tier to re-test the "high ladder is more predictable" hypothesis inside the model.
- Bootstrap CIs by **resampling players**, not games — games within a player are correlated.

### 4.5 Falsification, before trusting the result
Simulate ladders at known σ_θ (0.0, 0.25, 0.5, 1.0) with this store's exact games-per-player
distribution, and confirm the estimator recovers each. **An estimator that cannot recover a known σ
on this sample size cannot be trusted to report a small one.** Run before touching real data.

### 4.6 What would falsify the headline claim
σ_θ significantly greater than zero with the interval excluding it, *and* an implied
P(better player wins) meaningfully above 0.5 — say ≥ 0.55 — on clean games. Anything less and the
honest statement is that pregame skill signal is not detectable at this sample size.

### 4.7 Honest limits, stated in advance
- Three days of data. No temporal component; σ_θ is a snapshot.
- Opt-in replay upload. Unmeasured selection.
- Small n after filtering (676 fully clean rated games) means **a null here is "not detectable at
  this sample size", never "proven absent"**.
- Bot detection is a floor. Undetected bots inflate apparent skill dispersion, as demonstrated above.

---

## 5. Other rated competitions worth citing

For the comparison table, on the σ / P(better wins) scale rather than raw win rates:

| Domain | Why it belongs | Note |
|---|---|---|
| **Chess (FIDE)** | The reference rating system | Must use expected score, draws at 0.5 |
| **NBA / NFL / MLB / NHL** | Lopez et al., already on a common scale | NBA most predictable, NHL/MLB most random |
| **Tennis (ATP)** | Individual, no draws, best-of-N — the closest structural analogue | Bo3 vs Bo5 is a built-in experiment on series length |
| **Esports with public ladders** (LoL, CS, SC2) | Same Glicko/Elo family, same opt-in-replay problem | Closest to our data-generating process |
| **Poker** | The canonical high-variance skill game | Skill is only detectable over very large samples — the direct precedent for a null here |

Tennis and poker are the two most useful. Tennis because a Bo3/Bo5 contrast quantifies exactly what
series length buys, which is the question for VGC. Poker because it is the established case where
real skill exists and is **undetectable in small samples** — which may be precisely our situation.

---

## 6. Deliverable

`engine/skill_variance.py` → `data/skill-variance.json`, carrying σ_θ with CI, the derived
single-game and Bo3 probabilities, the implied pregame ceiling, the simulation recovery check, and
the funnel of games it was computed on. Then `docs/predictability-study.md` is rewritten against it,
with the superseded 55% figure kept and marked rather than deleted.

## Sources

- Lopez, Matthews & Baumer, *How often does the best team win?* — [arXiv:1701.05976](https://arxiv.org/abs/1701.05976) · [Annals of Applied Statistics](https://projecteuclid.org/journals/annals-of-applied-statistics/volume-12/issue-4/How-often-does-the-best-team-win-A-unified-approach/10.1214/18-AOAS1165.full)
- [Pokémon Showdown ladder help](https://pokemonshowdown.com/pages/ladderhelp) — Elo with sliding K-factor and decay
- [Glicko rating system](https://en.wikipedia.org/wiki/Glicko_rating_system) — RD and its meaning
- [Everything You Ever Wanted to Know About Ratings, Smogon](https://www.smogon.com/forums/threads/everything-you-ever-wanted-to-know-about-ratings.3487422/) — GXE withheld at RD ≥ 100
