# How Predictable Is Pokémon Champions? A Ratings-and-Models Study

### Measuring the irreducible variance of a competitive VGC metagame

**Version 1.0 · 2026-07-23 · Will Hooper · ABRA**

> An empirical study, run entirely over ABRA's durable store of real Champions (Reg M-B) ladder
> games. It asks a question every competitor feels but rarely measures: **when the better team or the
> better player shows up, how often do they actually win?** The answer bounds what *any* pre-game
> model — JOLTEON, a calibrated CHOMP, anything — can achieve, and it reframes the models' "only ~56%"
> not as weakness but as brushing against a hard ceiling the game itself imposes. Reproduce with
> `engine/predictability.py`.

---

## 1. Why this matters

Every model in ABRA that predicts a *winner before the game* — JOLTEON today, a calibrated CHOMP
tomorrow — lands around 55–57% accuracy, and we have reported that honestly throughout. The natural
worry is that the models are simply weak. This study tests the alternative hypothesis: that **55–57%
is close to the maximum any pre-game predictor can reach**, because Champions is a high-variance game
in which the better side wins only slightly more than half the time. If true, chasing a
team-sheet model to 70% is chasing a number the game does not contain, and the real leverage is
elsewhere (in-game decisions, team building against the meta) — exactly where ABRA's other models aim.

We attack it two ways that need no model at all, then check the model against them.

## 2. Data

All finished games in the durable store (4,998 unique replays). For the ratings analysis we keep the
**2,337 human-vs-human games where both players have a Showdown rating**. Ratings are read directly
from the replay `|player|` lines; no modelling is involved. For the JOLTEON analysis we use the same
humans-only temporal split as the model's own evaluation.

## 3. Result 1 — how often does the better *player* win?

Across 2,318 games with unequal ratings, **the higher-rated player won just 55.0% of the time.** Broken
down by the size of the rating gap, and compared to what the Elo formula
`p = 1/(1+10^(−Δ/400))` predicts:

| Rating gap (Δ) | Games | Higher-rated actually wins | Elo predicts |
|---|---:|---:|---:|
| 0–25   | 592  | 49.3% | 51.8% |
| 25–50  | 547  | 54.8% | 55.3% |
| 50–100 | 1034 | 57.9% | 60.5% |
| 100–200| 164  | 57.9% | 65.1% |

Two things stand out. First, **at small rating gaps the game is a coin flip** — a 0–25 point edge wins
49.3%, statistically indistinguishable from chance. Second, **even a large edge tops out around 58%**,
and it does so *below* the Elo prediction: a 100–200 point gap "should" win ~65% but wins only ~58%.
Champions compresses skill. The better player is favoured, but the variance — damage rolls, 50/50
protects, speed ties, team-matchup luck — repeatedly overrules them.

## 4. Result 2 — how well-calibrated is JOLTEON, and where is the ceiling?

On the held-out temporal split (513 games, humans only), JOLTEON scores **54.6% accuracy, Brier 0.252,
log-loss 0.699** — right where the ratings result says a pre-game predictor should live. Its
probabilities are reasonably calibrated: when it says 55–65%, the favoured team wins ~60%; when it
says under 35%, they win ~32%. It is honest about its own uncertainty rather than overconfident.

The telling number is the **ceiling**. JOLTEON's most extreme honest probability on this data is about
**81%**, and it reaches that only for a handful of lopsided team-sheet mismatches. For the bulk of real
games — two competent teams — it correctly declines to be confident, because the game does not permit
confidence. This is the same wall the ratings analysis hit from the other side.

## 5. Result 3 — CHOMP as a predictor (method and expectation)

CHOMP already computes an exact-damage matchup score (`teamVs` / `bring4`) for the best-4 of one six
against the other. Turning that into a win probability is a one-line calibration:
`P(win) = σ(a·(score₁ − score₂) + b)`, with `a, b` fit against the stored outcomes — a logistic on data
we hold. `engine/chomp-predict.js` emits the per-game score difference for this fit.

We report the **method** rather than a full backtest number here for an honest reason: computing
CHOMP's score requires the full damage engine, and over thousands of games its memory footprint
exceeds this analysis sandbox's ceiling (it runs in small batches; a full run needs a roomier machine).
But the *expected* result is not in doubt, and Results 1–2 tell us why: a calibrated CHOMP predictor
is another **pre-game team-sheet model**, so it is bounded by the same ~55–58% ceiling. Grounding the
prediction in exact damage instead of learned species strengths changes *how* it reaches the ceiling,
not *where* the ceiling is. The genuinely valuable use of CHOMP's score is therefore not as a rival
predictor but as a **feature inside JOLTEON** (§7).

## 6. Synthesis — the predictability ceiling of Champions

Three independent measurements agree:

- the **better player** wins ~55% (58% with a big rating edge),
- the **better team** (JOLTEON) is called correctly ~55%, calibrated, with a practical confidence
  ceiling ~81% reached only on rare mismatches,
- a damage-grounded predictor (CHOMP) is bounded by the same wall by construction.

So the answer to *"how often does the better side win?"* is: **only a little more than half — around
55%, rising to ~58–60% when the edge is large.** That is the irreducible variance of the format. It is
not a flaw in the models; it is a property of the game, and the models are already near it.

### What about the better *play* (per turn)?
This study measures the better *team* and the better *player*. Measuring how often the better *in-game
move* wins is harder: it needs a solver that can say which move was better, i.e. SLOWKING's belief
search. We cannot yet quantify it from data alone. But the team/player ceiling **bounds** it — in a
game where the better player wins 55%, individual correct plays swing games by less, which is exactly
why a coach (KADABRA/ALAKAZAM) should talk in terms of *shifting win probability at the margin*, not
guaranteeing outcomes.

## 7. Implications for ABRA

- **Stop chasing pre-game accuracy past ~58%.** It is not there. JOLTEON's rarity-aware ~56% is
  near-optimal for a team-sheet model; the honest move is calibration, not more accuracy.
- **The leverage is downstream of the sheet.** In-game decisions (MEDICHAM, SLOWKING) and team-building
  against the meta (DITTO) act on the part of the outcome the sheet cannot see — which is most of it.
- **Feed CHOMP's damage score into JOLTEON as a feature**, not as a competitor. It adds information a
  learned-identity model lacks, and it is the most principled way to squeeze the last point or two out
  of the pre-game predictor before the ceiling stops everyone.
- **Coaching should be probabilistic.** Because even large edges only win ~58%, KADABRA's advice is
  correctly framed as "this play was +X% win probability," not "this play wins."

## 8. Honest limits

The ratings are Showdown ladder Elo, which is noisy and non-stationary; the humans-only rated sample
is 2,337 games from a ~2-day window, so the rating-gap bins (especially 100–200) are small and their
confidence intervals are wide. The direction — a low, slowly-rising better-side win rate well under
Elo's prediction — is robust across bins and matches the independent JOLTEON result, but exact
percentages will move as the store grows (and the recency-weighted models will track that drift). The
CHOMP backtest number is deferred, not claimed.

## 9. References

1. Elo, A. (1978). *The Rating of Chessplayers, Past and Present.*
2. ABRA — [simulator white paper](ABRA-simulator-whitepaper.md) (the ~55–57% ceiling, derived);
   [SLOWKING white paper](SLOWKING-whitepaper.md) (why per-move "better play" needs a solver).
3. Reproduce: `engine/predictability.py`, `engine/chomp-predict.js`.

---

**Companion.** [Cheat sheet](MODELS-CHEATSHEET.md) · [Architecture notes](ARCHITECTURE-NOTES.md) ·
[Changelog](../CHANGELOG.md)
