# Are ABRA's null results real? A test for hidden team heterogeneity

**2026-07-30.** Prompted by VGC-Bench (arXiv 2506.10326), which measures policy performance
collapsing as the team pool grows: agents trained on 3 teams score 21% in-distribution, on 10
teams 17%, on 30 teams 8%. ABRA's pool is **4,885 teams** — more than a hundred times the point
at which the published work falls apart.

That raised a specific worry. This week produced four null results in a row. If a single fixed
policy cannot be good across thousands of teams, a change that helps on some teams and hurts on
others would read as a clean null in the aggregate — and the aggregate is the only thing this
project has ever looked at.

---

## The hypothesis, and the version of it that was wrong

The tempting framing is that the nulls are *drowned in team variance*. **That framing is wrong,
and it is worth being explicit about why**, because it nearly cost four hours of compute.

`paired_h2h.js` already removes team bias by construction. Each matchup is played twice, once
with each policy on each side. If a matchup is lopsided enough that the team decides it, the same
*team* wins both games — which means different *policies* won them — and the pair is recorded as a
SPLIT and discarded. Splits are not averaged in. Team diversity costs **sample size**, not
validity.

So the honest question is not "is the estimate biased." It is not. The question is:

> Is there one effect here, or many effects with different signs that happen to cancel?

## The test

Under the null that every team shares one true win rate, per-team decisive wins are binomial and
the spread of per-team rates is entirely predicted by the counts. Real heterogeneity shows up as
**overdispersion** — more spread than binomial allows.

Pearson's chi-square across teams measures exactly that. With many teams it is approximately
normal with mean `df` and standard deviation `sqrt(2·df)`, giving a z-score for "more spread than
chance." An overdispersion ratio of 1.00 means the spread is precisely what luck predicts.

A team is a six, keyed by sorted species. Each decisive pair is evidence about both sixes on the
table. Teams with fewer than 8 decisive pairs are excluded rather than left to add noise as
singletons. Implementation: `engine/team_heterogeneity.js`.

## Positive control

The test has to be shown to detect heterogeneity before its silence means anything. The greedy
experiment is the strongest effect this project has measured (+12 points of raw win rate), and it
should not be uniform across teams — taking your best move matters more with some teams than
others.

| run | decisive pairs | overall | overdispersion | z |
|---|---|---|---|---|
| **greedy vs sampling** | 24,153 | 79.7% | **1.169** | **7.4** |

Detected, clearly. Per-team rates run from 100% down to 20%. The instrument works.

## Result

| run | decisive pairs | overall | overdispersion | z | verdict |
|---|---|---|---|---|---|
| forced-replacement lever | 17,074 | 50.5% | **1.005** | 0.2 | one shared rate |
| switch features (switching on) | 7,097 | 50.5% | **1.011** | 0.1 | one shared rate |

**Both nulls are real nulls.** There is no subgroup of teams on which the post-KO replacement
scorer or the new switch-in features are quietly winning. They do nothing, uniformly, everywhere.

The lever result is the well-powered one — 2,098 teams and 20,227 team-observations, and an
overdispersion of 1.005 is about as flat as this measurement can come out. The switch-features run
is weaker evidence on its own: only 46 teams cleared the 8-pair threshold, for 388 observations,
so that test had little power to find heterogeneity even if it existed. Directionally it agrees,
but it should not be leaned on alone.

## What this rules out, and what it does not

**Ruled out:** that this week's nulls are a measurement artifact of team diversity. They are not.
The planned follow-up — re-running the null experiments on a narrowed team pool of 10 or 30 teams
— would have cost about four hours of compute to confirm something the existing data already
answers. It is cancelled.

**Not ruled out:** VGC-Bench's actual finding, which is about *capacity*, not measurement. They
trained separate policies per team-set and watched in-distribution performance collapse as the set
grew. ABRA has never tried that. A policy refitted on ten teams and tested on those same ten teams
might beat the general policy by a lot, which would say the linear model is capacity-limited
across the metagame and argue for conditioning the policy on team features. That is a real open
question and a different experiment.

## Where this leaves the week

Four feature-addition experiments, four nulls, and now confirmation that the nulls are genuine
rather than hidden structure. Against that, one intervention — playing the best-scoring move
instead of sampling — is worth twelve points.

The pattern is consistent and it is not about knowledge. It is about what the policy is aimed at
and how it is used. VGC-Bench's own result points the same way: behaviour cloning beat pure
reinforcement learning, and every one of their top agents was behaviour cloning **followed by
population-based self-play improvement**. ABRA has the behaviour clone (`fit_policy`) and it has
the self-play farm (MEW, 40 games/second). It has never connected them — the farm only ever
measures, it has never once trained the policy.

That loop is the recommendation, ahead of more features.
