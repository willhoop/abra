# Solver research: exploiting humans safely, and running on the ladder (2026-09-23)

Research only. No script, no git, no existing file touched. Historical record under `docs/_reports/`:
never maintained, never cited as current state.

**Decided context (Will, 2026-09-23):** open team sheets, Reg M-C, every model except the simulator
rebuilt from scratch, laptop only. The goal is to climb the Showdown ladder on a new bot account.
The policy is an equilibrium base plus a capped exploit dial (HYPNO) that moves away from equilibrium
only where human data shows a real habit.

Sibling reports from today: `2026-09-23-solver-research-turn-search.md` (the RNR root solve, the clock),
`2026-09-23-solver-research-learning.md` (the BC anchor, the test ladder),
`2026-09-23-solver-research-teams-and-meta.md`. This report does not repeat them.

Labels used: **[SOURCE]** read from a cited file or page. **[DERIVED]** computed here from a cited
formula. **[ESTIMATE]** judgement, not measured.

---

## 0. Verdict

1. **Bots on the ladder: no written rule forbids them, but you can lose the account at staff discretion. Ask an admin first.** Details in §2.1.
   The existing code says the opposite, and nothing supports it: `engine/mag_bot.js:34-36` says
   *"A bot on the LADDER ... is against Showdown's rules on the main server"*. I could not find that rule anywhere.
2. **The ladder to use is `gen9championsvgc2026regmcbo3`.** Only the Bo3 format *forces* open team
   sheets. It rates **once per series**, not once per game.
3. **HYPNO = ε-safe best response to a human-habit model**, solved per turn as a small LP. The cap ε
   is a floor on worst-case win probability. It is not a mixing weight. Exploitation is switched on
   per situation-bucket, and only for buckets whose habit beats the equilibrium prediction on held-out
   games.
4. **Measure progress by the per-series residual `S − E`, with the two arms randomised per series on one account.
   Do not use the peak rating.** At K=40 the rating wanders about ±55–60 Elo around its true value
   **[DERIVED]**. So a peak is mostly noise. A 50-Elo improvement needs **~770 series per arm** to
   detect with a two-arm test, or **~380** measured against the Elo expectation **[DERIVED]**.

---

## 1. Safe exploitation

### 1.1 The literature, reduced to what HYPNO needs

| Method | What it gives | Use here |
|---|---|---|
| **ε-safe strategies**. McCracken & Bowling, "Safe strategies for agent modelling in games", AAAI Fall Symposium 2004 | Best response to a model, restricted to strategies whose worst case is within ε of the game value | **The cap.** ε is stated in the game's own units (win probability). |
| **Restricted Nash Response (RNR)**. Johanson, Zinkevich & Bowling, NIPS 2007 ([pdf](https://poker.cs.ualberta.ca/publications/NIPS07-rnash.pdf)) | The opponent plays the model with probability *p* and plays adversarially otherwise. p=0 is Nash, p=1 is best response. It traces the exploit/exploitability Pareto curve. | The same dial parameterised by *p*. Adopted in the turn-search report. |
| **Data-Biased Response (DBR)**. Johanson & Bowling, AISTATS 2009 ([PMLR](https://proceedings.mlr.press/v5/johanson09a.html)) | RNR with *p* set **per information set from the amount of data**. Where data is thin the model is trusted less. It fixes RNR over-trusting a model that is sparse in places. | **This is "only where the data shows a habit".** p(bucket) = p_max · n/(n+K). |
| **Safe opponent exploitation**. Ganzfried & Sandholm, EC 2012 / ACM TEAC 3(2) 2015 ([pdf](https://www.cs.cmu.edu/~sandholm/safeExploitation.teac15.pdf)) | In a repeated zero-sum game, you may risk exactly the "gifts" the opponent has already given, and still guarantee ≥ game value in expectation | Grows the budget **within a Bo3 series**: evidence that this opponent follows the habit raises the allowance. |
| **Game-theory-based opponent modelling (DBBR)**. Ganzfried & Sandholm, AAMAS 2011 ([ACM](https://dl.acm.org/doi/10.5555/2031678.2031693)) | Model the opponent as deviations from equilibrium, learned from observed play | Parameterises the habit model as a **deviation from σ\***, so no data means "plays equilibrium". |
| **Bayesian opponent exploitation**. Ganzfried & Sun 2016 ([arXiv 1603.03491](https://arxiv.org/pdf/1603.03491)) | A posterior over opponent strategies from a prior plus observations | The in-series update (§1.4). |
| **Safe Exploitation Search (SES)**. Liu et al., NeurIPS 2022 ([paper](https://proceedings.neurips.cc/paper_files/paper/2022/hash/b12a1d1014e952e676f5d6931d03241a-Abstract-Conference.html)) | Real-time subgame refinement that interpolates safety and exploitation, with bounded exploitability, and handles a model that updates during play | The real-time analogue: re-solve per turn instead of precomputing the whole game. |
| **CDBR / CDRNR**. Milec, Kubíček & Lisý 2021 ([arXiv 2112.12594](https://arxiv.org/abs/2112.12594)); follow-up 2025 ([arXiv 2501.10464](https://arxiv.org/pdf/2501.10464)) | Depth-limited best/robust responses with a value function at the leaf. They note the leaf must assume the opponent keeps playing the model beyond the horizon. | Our search is depth-limited. **Caution from this line of work:** exploiting only at the root while the leaf assumes equilibrium underestimates the gain but stays safe, and that is the correct first build. |
| **piKL / DiL-piKL**. Jacob et al., ICML 2022 ([pdf](https://proceedings.mlr.press/v162/jacob22a/jacob22a.pdf)); Bakhtin et al. 2022, Diplomacy ([arXiv 2210.05492](https://arxiv.org/pdf/2210.05492)) | Search regularised by KL toward a human-imitation policy. It gives a strong **and** accurate model of human play in simultaneous-move games with humans. | **The habit model's opponent.** Model the human as piKL(λ) around the BC policy, not as raw BC. Raw BC is weaker than real humans, and a best response to it over-exploits. |
| **VGC-Bench**. Angliss et al. ([arXiv 2506.10326](https://arxiv.org/html/2506.10326v3)) | BC-then-self-play policies are best. *"In almost all cases, all agents are approximately 100% exploitable."* | The reason the base must be a re-solve and not a compiled policy. It is also a warning: a human-exploit layer on a compiled policy inherits that exploitability. |

### 1.2 Concrete HYPNO definition (per decision, at the root)

The turn-search layer returns a joint-action payoff matrix `A` (win probability for our joint action
*i* against their joint action *j*) and the equilibrium `(σ*, τ*)` with value `v*`.

```
HYPNO(ε, h):   maximise   xᵀ A h                       # expected win prob vs the habit model h
               subject to min_j (xᵀ A)_j ≥ v* − ε      # worst case at most ε below equilibrium
                          x ∈ simplex
```

This is **one LP of the same size as the Nash solve** **[DERIVED]**. ε=0 returns σ\* (up to
ties). A large ε returns the pure best response to *h*. The constraint is exactly the McCracken–Bowling ε-safe
condition, applied per decision.

**Why ε-safe and not RNR's p as the user-facing dial.** ε is in win-probability units per decision.
Will can read it ("never give up more than 1 point of worst-case win chance on a turn"), and it bounds the
downside directly. RNR's *p* gives the same curve, but you have to map p to exploitability to know what
it costs. **Implement both.** ε is the cap. `p(bucket)` from DBR says **how much to believe h**:

```
h_bucket = p(b) · h_BC-piKL(b) + (1 − p(b)) · τ*          # DBBR: deviation from equilibrium
p(b)     = p_max · n_b / (n_b + K)                        # DBR: shrink by evidence
```

`n_b` is the held-out-validated count for the situation bucket. The XATU context model's shrinkage
had the same form, with K=12 (`docs/MODELS.md:1888`) **[SOURCE]**. That form cleared zero there
with a game-clustered CI, so it is the precedent to copy. The value is not.

**Two gates before any bucket may deviate [ESTIMATE, the design]:**

1. **The habit is real.** On held-out games (split by *game*, clustered by game), `h` must beat `τ*`
   as a predictor of the human's joint action, measured by log-loss with a CI that clears zero. Buckets
   that fail get p=0, which means pure equilibrium.
2. **The habit pays.** The exploitation gain `xᵀAh − v*` must exceed the payoff-matrix estimation noise
   (the search's own standard error on A). Otherwise the "gain" is rollout noise, and the LP chases it.

### 1.3 Setting the cap

There is no closed form. The literature's procedure is the Pareto curve, and the knee is chosen
empirically:

1. **Offline sweep.** For ε ∈ {0, 0.25, 0.5, 1, 2, 4} win-prob points per decision **[ESTIMATE grid]**,
   play HYPNO(ε) against two held-out opponents on the local server:
   - **H**: a human clone (piKL around BC) fitted on disjoint games. This measures the *gain*.
   - **BR**: a best-responder to HYPNO(ε) (the SEARCH division's exploiter). This measures the *cost*.
2. Plot gain against cost. Pick the largest ε where the marginal gain per unit of extra exploitability
   is still ≥ 1 **[ESTIMATE rule]**. Ladder opponents are mostly human, not best-responders. So
   exploitability matters only to the extent that a human *adapts* within a Bo3 series.
3. **Hard ceiling.** Cumulative risk inside one game is bounded by ε × decisions. With ε = 1 point and
   ~10–15 decisions a game **[ESTIMATE]**, the worst case is already ~10–15 points of win probability.
   That is why the per-decision cap should start **small (0.5–1 pt)**, and why the Ganzfried–Sandholm
   rule (risk only what the opponent has already given away) is the right way to go higher.

**Expected size of the prize [ESTIMATE, flagged].** The only human-predictability figures in this repo are
from Reg M-B. The XATU belief model beat the usage prior by 0.0324 nats per move, CI [0.028, 0.0364]
(`docs/MODELS.md:1879`) **[SOURCE]**. That is a real gain, but a small one. If population-level habits are
similarly thin in M-C, HYPNO's gain comes from **a few sharp situations**, not a broad tilt. So the
per-bucket gate matters more than the global ε. Do not expect HYPNO to be the main source of rating.

### 1.4 Per-opponent adaptation vs population priors

| Level | Signal | Recommendation |
|---|---|---|
| **Population** | The M-C Bo3 store. Open sheets on both sides, so the full sets are known and the habit model can condition on real sets. | The prior `h_pop`, conditioned on **rating band**. The store keeps each player's rating: `durable-ingest.js:226`, `P[side]={name, rating, bot}` **[SOURCE]**. Habits at 1200 are not habits at 1500, and the bot will pass through both. |
| **Within a Bo3 series** | Same opponent, same team for 2–3 games. Games 2 and 3 carry this opponent's observed choices from game 1. | **The main per-opponent lever.** Bayesian update of a Dirichlet over `{follows h_pop, plays ≈ τ*}` from the likelihood of their observed actions. The Ganzfried–Sandholm gift accounting sets how far ε may grow in games 2–3. |
| **Within a game** | 5–15 observed joint actions **[ESTIMATE]** | Too few to fit a model. Use them only as evidence for the mixture weight above. |
| **Across series (same username)** | The store keys players by name | **Do not build per-user files [ESTIMATE, recommendation].** Few repeat meetings at a given rating, a privacy smell, and the population and in-series levels capture most of it. |

**Non-stationarity warning:** humans adapt *between games of a series*. The game-1 habit may be
deliberately reversed in game 2. So the in-series posterior must decay, and ε must not grow on evidence
older than the current game without a fresh confirmation **[ESTIMATE]**.

### 1.5 Modelling human habits from the store: what was learned (learn, don't reuse)

| Lesson | Source | Consequence for the rebuild |
|---|---|---|
| The old move priors are **board-blind**. P(move \| species, action), no state. | `docs/MODELS.md:2288-2314`, `engine/paired_h2h.js` quoted there | The habit model must condition on the **public state**: HP bands, field, who threatens whom, turn, remaining counts. A species-only table is the wrong object. |
| **Target and joint action were never modelled.** The opponent's target was drawn uniformly, and the two slots were independent. | `docs/MODELS.md:2198-2200` (GARY #35) | Model the **joint** action of both slots including targets. The recorded direction was that humans aim both attacks at one foe more than independent choice predicts. That rate is withdrawn, so re-measure it. |
| **One flag steered both sides** in the rollout | `docs/MODELS.md:2195-2197` | HYPNO's h applies to the opponent **only**. The self-model inside search stays σ\*. Stamp which h ran in every artifact (`MODELS.md:2205` records the missing stamp). |
| The store records **what executed**, not what was chosen. A mon that faints before acting leaves no action. | `durable-ingest.js:269` (`t:'m'` only on a move line), `:263` (`t:'s'` switch) | Choices are **censored** by speed and KOs. Fit on turns where both actives acted, or model the censoring. Otherwise fast-KO'd choices are under-represented. |
| Voluntary switches and forced replacements are both `t:'s'` | `durable-ingest.js:263` | Split them by whether a faint preceded the switch in that turn. Only a voluntary switch is a habit. |
| **Bots contaminate the human store.** The name rule is `/^pcrlbot\|bot\d\|^[a-z]+bot$/i`. The meta model's own caveat says to call the result "no bot detected", not "human". | `durable-ingest.js:84`; `docs/MODELS.md:2281-2283` | **Exclude our own ladder account by name** from every habit fit. Otherwise HYPNO learns its own behaviour as a human habit (a feedback loop). Other ladder bots are also in the data, and PokaiTrainer and a public M-B bot are known to exist (§2.4). |
| Custom-rule rooms are indexed under the base format id | `docs/REGMC.md:364-397` | The Bo3 frozen pool showed 0 custom-rule games **[SOURCE]**. Keep the scan in the pipeline anyway. It had reached only ~4% of the store. |
| Fitting and playing must be the same regime | ABRA `CLAUDE.md` ("Fitting environment and playing environment must match") | Fit h on **Bo3, open-sheet, M-C** games only. The bo1 ladder is closed-sheet in almost every game. |
| A table typed next to a name looks authoritative | ABRA `CLAUDE.md`; `docs/MODELS.md:1621-1628` (SLOWKING figures in no file) | Every HYPNO bucket carries `n`, held-out log-loss vs τ\*, and its CI in the artifact. The cap sweep's Pareto curve is an artifact, not prose. |

---

## 2. Ladder operations

### 2.1 Are bots allowed on the Showdown ladder?

**Summary: not forbidden by any written rule; tolerated at staff discretion, with a permaban risk if a
bot "negatively affects human experience"; policy is under active review; suspect-requirement botting
is cheating.** Sources, all read 2026-09-23:

| Source | What it says |
|---|---|
| [pokemonshowdown.com/rules](https://pokemonshowdown.com/rules) | No bot rule at all. The nearest is main rule 4: do not exploit bugs, and do not "game the system" (for example, intentionally losing to yourself or a friend in a ladder match). |
| [PS forum rules thread](https://www.smogon.com/forums/threads/pok%C3%A9mon-showdown-forum-rules-resources-read-here-first.3570628/) | Anyone may host a **chat** bot without registration, subject to guidelines. Nothing on battle bots. |
| [Remove Bots from Ladder during Suspect Tests](https://www.smogon.com/forums/threads/remove-bots-from-ladder-during-suspect-tests.3706925/) (Implemented; Maia, Battle Sim Admin, 2022-08-28) | Official stance: if a bot is negatively affecting the human experience, it is removed from the ladder with a permaban. Tier leaders may request removal during suspects. |
| [Ladder Bots and Usage-Based Tiering](https://www.smogon.com/forums/threads/ladder-bots-and-usage-based-tiering.3774656/) (Dec 2025 to Apr 2026) | Admins: banning bots outright is not feasible to enforce, and verifying a bot is limited to ~4 people. 2026-04-16: technical "limiters" were implemented (not described). |
| [Botting in ladder fix](https://www.smogon.com/forums/threads/botting-in-ladder-fix.3775618/) (Invalid, Dec 2025) | Redirected to a non-public Policy Review thread. Admins say "things are moving behind the scenes". |
| [Bots are now capable of suspect reqs](https://www.smogon.com/forums/threads/bots-are-now-capable-of-suspect-reqs-do-we-care.3787411/) (UT, 2026-08-25) | Using a bot to earn suspect requirements is cheating and voids them. |
| PokaiTrainer ([arXiv 2608.29197](https://arxiv.org/html/2608.29197), 2026-08-29) | Laddered `gen9championsvgc2026regmbbo3`. Says it is *coordinating the release of its code with the Showdown administrators to prevent bots from overrunning the online ladder*. |

**Recommendations [ESTIMATE]:**
- **Before the first ladder game, Will messages a PS admin** (the Policy Review route) describing the
  account, the format, the volume, and that it is research. Written permission turns a discretionary
  risk into a known one.
- **Put "bot" in the account name** and in its profile. Humans can then choose, and it looks like
  good faith if staff review it. Note that `isBot` in our own ingest would then drop its games from the
  human store, which is what we want.
- **Never ladder two of Will's accounts in the same format at once.** If they get matched, that is
  "gaming the system" under rule 4.
- **Cap the volume** (for example ≤ 1 concurrent series) and do not ladder during any VGC suspect or
  tournament qualification window.
- **Correct `engine/mag_bot.js:34-36`.** The claim that it is "against Showdown's rules" is unsourced.
  That is OPS/ENGINE's edit, not this report's.

### 2.2 Format, sheets, timer, rating: from the M-C checkout

| Fact | Value | Source |
|---|---|---|
| Open-sheet ladder | `[Gen 9 Champions] VGC 2026 Reg M-C (Bo3)` → `gen9championsvgc2026regmcbo3` | `pokemon-showdown-mc/config/formats.ts:295-299`; store file names `data/games.gen9championsvgc2026regmcbo3.*` |
| Its ruleset | `Flat Rules`, `VGC Timer`, **`Force Open Team Sheets`**, `Best of = 3` | same |
| Bo1 ladder | `gen9championsvgc2026regmc`: `Open Team Sheets` is **optional**. Sheets show only if both press Accept. | `formats.ts:288-293`; `data/rulesets.ts:1980-2001` |
| Why this matters | The M-B bo1 ladder had 1.7% open-sheet games against 99.9% in Bo3 (memory note, 2026-08-10) | `memory/the-bo3-store-is-the-open-sheet-ladder.md` |
| VGC Timer | Team preview 90 s. Bank ("Timer Starting") **420 s**. Grace 90 s. **Add per turn 0**. **Max per turn 55 s**. Max first turn 90 s. Timeout auto-choose. DC timer bank. | `pokemon-showdown-mc/data/rulesets.ts:778-785` |
| Rating unit | Each game in a series is created with `rated=0`. The **series** result updates the ladder once. | `server/room-battle-bestof.ts:232-233, 465-467` |
| Between games | If a player is absent or renamed when the next game starts, they forfeit the series | `room-battle-bestof.ts:214-219` |
| Elo | K=50 default. Below 1200: K = 10+(R−1000)·0.2 on a loss and 90−(R−1000)·0.2 on a win. 1350–1600: K=40. Otherwise K=32. Floor 1000. | `server/ladders-local.ts` (smogon master, fetched 2026-09-23). **Main-server identity assumed, not verified**, because the live ladder runs through the login server. |
| Displayed metrics | Elo, and GXE from Glicko-1 (1500±130 start, RD grows with inactivity) | [Glicko-1 proposal thread](https://www.smogon.com/forums/threads/rating-uncertainty-in-ps-ladder-matches-aka-glicko-1-against-the-smurfing-problem.3756168/) |

**Clock consequence [DERIVED].** With no increment, 420 s must cover every request in a game,
including forced replacements, and 55 s caps any single one. Over ~10–15 turns plus replacements
**[ESTIMATE]**, the sustainable average is **~20–30 s per request**. The anytime budget should be
`min(55 − margin, bank_remaining / expected_remaining_requests)`. The turn-search report's S3 gate
covers this. PokaiTrainer ran a median 23 s budget on one RTX 4090 **[SOURCE, arXiv 2608.29197]**, so
this laptop's CPU-only budget buys less search per second. Size the leaf network to the laptop.

### 2.3 How the existing bot connects (read only)

`engine/mag_bot.js`:
- Opens a WebSocket (`:481-492`). Default server is localhost. On a public server it takes `challstr`
  and POSTs name, password and challstr to `play.pokemonshowdown.com/api/login` for an assertion, then
  sends `/trn` (`:91`, `:542-564`). The password comes from a gitignored file or an env var (`:9-11`).
- **It only accepts challenges** (`:652-672`). It never sends a ladder search, and its header says
  that should stay true (`:34-36`).
- Accepts open team sheets on `|teampreview` (`:810-847`). Holds the preview answer up to 25 s waiting
  for the sheet (`:160-166`). Bounds the bring search with a 15 s deadline (`:155-159`). Saves replays
  of open-sheet games (`:833`).

**Owed for ladder play [ESTIMATE, engineering list, not built]:** a ladder-search command and team
upload for the Bo3 id; a series-aware loop that stays connected and does not rename between games (or
the series is forfeited); per-request clock accounting read from the server's timer messages;
reconnect-to-battle safety; a hard daily series cap; and an account exclusion in ingest.

### 2.4 Reference points on the same ladder family (self-reported, unverified)

| Bot | Result |
|---|---|
| PokaiTrainer (belief-state CFR re-solve, M-B **Bo3**) | 44–31 and 45–30 sets over two 75-set runs. Fresh account peaked at **1492**, then settled in a **1350–1400** band with GXE 72–74. Field average ~1320, max ~1620. Plays equilibrium (sampled at T=0.5). **No exploitation layer.** ([arXiv 2608.29197](https://arxiv.org/html/2608.29197)) |
| philmantatsky (PPO + exact search, M-B) | 55–45 over the first 100 ranked games, peak 1365 ([GitHub](https://github.com/philmantatsky/VGC-Pokemon-Showdown-AI)) |

The gap from peak to settled in the PokaiTrainer run matches the rating-noise estimate in §3.1. It is
the clearest public example of why a peak is not a result.

---

## 3. Measuring ladder progress honestly

### 3.1 Rating noise [DERIVED]

Near its true level R, an Elo rating is an AR(1) process. Expected score slope is
`dE/dR = ln10/400 · p(1−p) ≈ 0.00144` at p≈0.5, and per-series score variance is ≈0.25. With
`a = K·0.00144`, the stationary SD is `K·0.5 / √(2a − a²)`:

| K (band) | stationary SD | expected peak over ~200 series |
|---|---|---|
| 40 (1350–1600) | **≈ 60 Elo** | ≈ +2–2.5 SD ≈ **+120–150 above true** |
| 32 (>1600, 1200–1350) | **≈ 53 Elo** | ≈ +105–135 |

*(The peak row is a rough extreme-value estimate for an autocorrelated series **[ESTIMATE]**.)*
**Report the mean rating over the last N series after burn-in, with that SD. Never report the peak.**
Below 1200, K is asymmetric (large on wins, small on losses), so the rating there is not an unbiased
estimator. Treat everything below ~1300 as burn-in.

### 3.2 Win rate is the wrong metric on a matchmade ladder

Matchmaking pairs similar Elo, so any policy's win rate drifts toward 50% as its rating settles. Use
the **per-series residual** `r = S − E`, with `E = 1/(1+10^((R_opp − R_bot)/400))` taken from the
pre-series ratings. It is zero-mean for a correctly rated player. A policy change that is truly stronger
shows up as a positive mean residual until the rating catches up.

### 3.3 Series needed [DERIVED, α=0.05 two-sided, power 0.8, p≈0.5]

| True improvement | Win-prob shift vs equal opponent | One-arm (residual vs 0) | Two-arm A/B |
|---|---|---|---|
| +100 Elo | +14.0 pts | ~100 series | ~200 per arm |
| +50 Elo | +7.2 pts | ~380 series | ~770 per arm |
| +25 Elo | +3.6 pts | ~1,500 series | ~3,000 per arm |

At ~2–3 series an hour, one series at a time **[ESTIMATE: Bo3 ≈ 2.5 games × 8–12 min]**, a 50-Elo
A/B is **~2–3 weeks of continuous laddering** **[ESTIMATE]**. **The ladder can confirm large wins only.
Small ones (HYPNO's likely size, §1.3) must be settled offline first.**

### 3.4 The protocol

1. **Offline gates (no ladder games spent).** Base σ\*: approximate exploitability with a best-responder,
   and a paired SPRT against fixed baselines (turn-search and learning reports). HYPNO: per-bucket
   held-out log-loss vs τ\* with a game-clustered CI (gate 1). The ε Pareto sweep against H and BR on the
   local server (§1.3).
2. **Burn-in.** A fresh bot account with ε=0 until the rating is above ~1300 and the last 50 series'
   residual mean is within ±1 SE of 0 **[ESTIMATE rule]**.
3. **Randomised A/B on one account.** Each series draws its arm (ε=0 or ε=ε\*) by a pre-committed seeded
   coin. One account means one rating and one opponent pool. Randomisation means rating drift hits both
   arms equally. The metric is the mean residual per arm, analysed with **SPRT** (the project's existing
   instrument) and pre-registered bounds, for example H0: Δ=0 vs H1: Δ=+7 pts. Play one fixed team, or
   a fixed small rotation, across both arms: team choice is a far larger effect than HYPNO.
4. **Artifact per series:** series id, arm, ε, pre/post Elo of both players, S, E, per-decision
   deviation from σ\* (so "HYPNO fired" is counted, not assumed), clock used, and the engine release id.
   A capability that cannot prove it ran is assumed broken: if HYPNO's deviation counter is zero, the
   A/B measured nothing.
5. **Headline figure:** settled rating = mean of the last N ≥ 100 series, ± the §3.1 SD, with N, dates
   and format. Report the SPRT verdict for the HYPNO arm separately.
6. **Exclude our account from every human-data fit**, and re-derive usage without it.

---

## 4. Open questions

- Whether the main server's ladder matches `ladders-local.ts` (K bands, floor) and whether it applies
  rating decay. **Not verified.** Read the login-server source or ask the admin in the same message as §2.1.
- What the April 2026 "limiters" restrict (for example, series per day). It affects §3.3's throughput.
- M-C Bo3 volume at 1400+ Elo, which sets queue times at the top. Derive it from the collector's
  rating field. It is not quoted here.

## Sources

- Showdown: [rules](https://pokemonshowdown.com/rules) ·
  [forum rules](https://www.smogon.com/forums/threads/pok%C3%A9mon-showdown-forum-rules-resources-read-here-first.3570628/) ·
  [bots/suspects 2022](https://www.smogon.com/forums/threads/remove-bots-from-ladder-during-suspect-tests.3706925/) ·
  [ladder bots & tiering](https://www.smogon.com/forums/threads/ladder-bots-and-usage-based-tiering.3774656/) ([p2](https://www.smogon.com/forums/threads/ladder-bots-and-usage-based-tiering.3774656/page-2), [p3](https://www.smogon.com/forums/threads/ladder-bots-and-usage-based-tiering.3774656/page-3)) ·
  [botting fix](https://www.smogon.com/forums/threads/botting-in-ladder-fix.3775618/) ·
  [suspect reqs 2026](https://www.smogon.com/forums/threads/bots-are-now-capable-of-suspect-reqs-do-we-care.3787411/) ·
  [Glicko-1 thread](https://www.smogon.com/forums/threads/rating-uncertainty-in-ps-ladder-matches-aka-glicko-1-against-the-smurfing-problem.3756168/) ·
  [ladders-local.ts](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/server/ladders-local.ts)
- Exploitation: [RNR](https://poker.cs.ualberta.ca/publications/NIPS07-rnash.pdf) ·
  [DBR](https://proceedings.mlr.press/v5/johanson09a.html) ·
  [Safe exploitation](https://www.cs.cmu.edu/~sandholm/safeExploitation.teac15.pdf) ·
  [DBBR](https://dl.acm.org/doi/10.5555/2031678.2031693) ·
  [Bayesian exploitation](https://arxiv.org/pdf/1603.03491) ·
  [SES](https://proceedings.neurips.cc/paper_files/paper/2022/hash/b12a1d1014e952e676f5d6931d03241a-Abstract-Conference.html) ·
  [CDRNR](https://arxiv.org/abs/2112.12594) · [depth-limit 2025](https://arxiv.org/pdf/2501.10464) ·
  [piKL](https://proceedings.mlr.press/v162/jacob22a/jacob22a.pdf) · [DiL-piKL](https://arxiv.org/pdf/2210.05492)
- Pokémon agents: [VGC-Bench](https://arxiv.org/html/2506.10326v3) · [PokaiTrainer](https://arxiv.org/html/2608.29197) ·
  [philmantatsky bot](https://github.com/philmantatsky/VGC-Pokemon-Showdown-AI) ·
  [Metamon](https://arxiv.org/pdf/2504.04395) · [PokéChamp](https://arxiv.org/pdf/2503.04094)
- Repo (read only): `engine/mag_bot.js`, `engine/durable-ingest.js`, `docs/MODELS.md`, `docs/REGMC.md`,
  `pokemon-showdown-mc/{config/formats.ts, data/rulesets.ts, server/room-battle-bestof.ts}`
