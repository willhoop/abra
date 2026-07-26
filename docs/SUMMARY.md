# ABRA — Project Summary

**Version 3.11.0 · 2026-07-26 · Will Hooper**

A one-page map of the whole project and every component. For depth: the
[white paper](ABRA-whitepaper.md) (math + sources), the [deck](ABRA-deck-plain-english.md)
(plain-English), the [technical docs](ABRA-technical-docs.md) (how to run it), and the living
[model ledger](MODELS.md).

## What ABRA is

ABRA is a decision-support model family for **Pokémon Champions VGC, Reg M-B, best-of-one
closed-sheet ladder**. It stores every public ladder replay and builds small, CPU-trainable models on
that growing store. It runs in a browser with no build step.

## The finding that shapes everything

**You cannot reliably predict who wins from the two team sheets** — even a player-rating model ties a
coin. So ABRA does not sell outcome prediction. It supports *decisions* and grades every model with a
proper score, a confidence interval, and an honest baseline. Wins are reported as wins; two honest
negatives are reported as negatives.

## The components at a glance

| Model | What it is | Status | Headline result |
|---|---|---|---|
| **MEDICHAM** | Hand-written doubles damage engine | ⚠️ **Being replaced** | Within 5% of the Smogon calculator on 31 scenarios, but disagrees with the OFFICIAL Champions engine by 31.1 points of win probability. ADR-001: becomes a lookup over precomputed tables |
| **GURU** | Meta matchup matrix from real outcomes | ⚠️ **No decisive cells** | Now quality-filtered (2026-07-25). On 1,124 clean games: 11 archetypes, **0 statistically-decisive matchups** (n≥30, CI excluding 50%), and its predictive test scores 0.735 vs a coin 0.693 — worse than a coin. Descriptive structure only |
| **XATU** | Opponent set + next-move belief | ✅ Built | Top-1 36% / top-3 72% on held-out human moves (beats its baselines) |
| **PORY** | Mid-game win-probability value net | ⚠️ **Contribution unclear** | Log-loss 0.567 vs coin 0.693 — but its features ARE the material state, and it **loses to a two-feature baseline** (alive_diff+hp_diff 0.5822 vs PORY 0.5840, same estimator). Report the gain over MATERIAL, not over a coin. See engine/pory_baseline.py |
| **CHOMP** | Bring-4 / lead-2 team-preview engine | ✅ Ships (standalone) | Exact-damage picker; **CHOMP-EV proof: brings tie a coin (honest null)** |
| **SLOWKING** | Team-preview Nash (mixed strategy) | ✅ Built | Equilibrium ≪ exploitable than uniform; playstyle cycle is **suggestive on small samples** |
| **KADABRA** | Replay coach | ✅ Works offline | Per-turn "you're at X%" from PORY |
| **DITTO** | Team optimiser | ⚠️ Pivoting | Objective de-biased to validated damage (was optimising a backwards signal) |
| **ALAKAZAM** | In-battle decision engine (capstone) | 🔜 In development | Belief + search + learned value; built last on the inputs above |
| **MEW** | Self-play data engine | ✅ **Built** | Runs the OFFICIAL Champions engine against itself on real observed teams. 1,000 games, 13/13 validation checks, mirror 51.0% CI [45.4, 56.6] |
| **MAGNEMITE** (MAG) | The in-battle policy that reads the board | ✅ **Built (3.11.0)** | Conditional logit fitted to **48,538 real human clicks** from 2,240 clean open-sheet games. Held out by game: top-1 **33.6%** against the behaviour clone's 27.1%. Out of sample it roughly halved both gaps it was built for — super-effective **9.7% → 14.9%** (real 21.4%), failed moves **9.7% → 6.3%** (real 2.5%). Does **not** decide switches; no damage calc; one ply |
| **DUSK** | Endgame exact solver | 🔜 Roadmap | Solves small boards (≤2v2, 1v1) perfectly — sharpens ALAKAZAM's endgame and gives clean training targets for PORY |
| **HYPNO** | Opponent read / exploitability dial | 🔜 Roadmap | Estimates opponent strength + predictability; tells ALAKAZAM when to play safe (vs strong) or exploit (vs weak/predictable) |
| **ROLES** | Multi-label team composition (26 roles) | ✅ Built | Role-pair matrix pools data to median cell **n=20** across 1,051 cells (vs old single-label n=11–18) — the 7,971 once published was retracted in 2.7.0; preview roles tie a coin (honest null) |
| **WAR** | Wins Above Replacement (species RAPM) | ⚠️ **Null** | **Withdrawn 2026-07-25.** Beat a coin only on the unfiltered store (0.6860). On clean games: **0.7048 vs coin 0.6931, accuracy 0.502** — the signal was four bots playing one team 1,446 times |
| **NMF** | Emergent roles / archetypes | ✅ Built | Role-level factorization → 6 clean archetypes (recon-err 0.53); a team is a *blend*, learned not hand-labelled |

## How it fits together

The **store** (every real game) feeds **GURU** (meta), **XATU** (belief), **PORY** (value), and
**MEDICHAM** (damage). **SLOWKING** solves the preview; **CHOMP** picks the bring; **KADABRA** coaches
a replay with PORY. **ALAKAZAM** is the capstone that assembles belief + search + value into the
win-%-optimal move, built last. Every change updates the code, this summary, the white paper, the
deck, the technical docs, and the CHANGELOG in the same pass.

## Repositories and site

| Piece | Repo | Live |
|---|---|---|
| ABRA (models + site) | `github.com/willhoop/abra` | `willhoop.github.io/abra/app/` |
| CHOMP (bring engine) | `github.com/willhoop/chomp` | Showdown userscript |
| Portfolio | `github.com/willhoop/willhoop.github.io` | `willhoop.github.io` |

## The data, as of 2026-07-25

| | |
|---|---|
| Collected (closed-sheet Bo1 ladder) | see `data/live.js` — generated on every refresh, growing hourly (hardcoded sizes retracted, S13) |
| Usable after the quality filter | **1,124** (12.8%) |
| Self-play (MEW, official engine) | 1,000 — separate file, never pooled |
| Open-team-sheet archive | 4,167 (MIT, 2026-06-17..20) — separate file, different information regime |
| Smogon official priors | 283 species, whole-ladder aggregate |

## Two metagames, not one

`meta-usage.json` publishes both, because they answer different questions:

```
competitive  garchomp, incineroar, kingambit, sinistcha, whimsicott, basculegion
ladder       garchomp, whimsicott, kingambit, basculegion, charizard, incineroar
```

**Competitive** is what humans choose when trying — right for tournament prep and for any claim about
the game. **Ladder** is what you actually face: three in four STORED games involve a bot. That is a property of what gets
uploaded rather than of the ladder: bot-team species are over-represented in the scrape by a mean of
+8.3 points against Smogon whole-ladder statistics, while other top species run -2.9. The true share
of bot opponents is lower than the store implies, but it is not small. Charizard sits at 25.7% on the ladder
view and outside the competitive top six because it is on the bot team. Consumers must say which they
used.

## Honest ceilings

Predicting the match winner from sheets is a coin flip in this format — and the previously published
55.0% skill ceiling was itself measured with bots included. Removing them gives 52.4%, an interval
that contains a coin flip. Every preview-level model now sits at that ceiling: JOLTEON, roles,
CHOMP-EV, and as of 3.2.0 **WAR, whose result is withdrawn**.

Most results here are also **underpowered**: 1,124 clean games can only detect an edge of ~4.2
accuracy points, and a 2-point effect needs ~4,900. `engine/eval_harness.py` now refuses to report a
null without stating what it could have seen.

The one load-bearing win is the **validated damage engine** — 31/31 within 2% against two independent
oracles. PORY was the other, until 2026-07-25 showed it loses to a two-feature material baseline.
The project's two genuine contributions are the ones it treats as plumbing: **behavioural bot
detection**, and the **measurement discipline** that dissolved WAR, the 55% ceiling and GURU's matchup
matrix in a single day.

## Correction — the scrape over-samples bots

Measured 2026-07-25 against Smogon's whole-ladder statistics for the same format and month
(1,163,315 battles vs the count generated into `data/live.js`):

| | mean difference, uploaded vs whole ladder |
|---|---|
| The five bot-team species | **+8.3 points** |
| Every other top species | **−2.9 points** |

75% of *stored* games involve a detected bot. That is a fact about **what gets uploaded**, not about
the ladder — bots save replays far more readily than humans do. Any statement of the form "three in
four of your opponents are bots" is therefore an overestimate and should not be made from this store.

This also bounds the earlier upload-bias result. Comparing our open-team-sheet Bo3 games against the
whole Bo3 ladder gave a mean absolute difference of only 1.84 points — but that corpus contains
almost no bots (29 named-bot sides in 4,167 games). So **human** upload bias is small; **bot** upload
bias is large, and the closed-sheet Bo1 store carries the latter.
