# ABRA — Findings for the World (running paper)

**A living dissemination doc.** Maintained in the same pass as the work. It accumulates the
publishable findings and keeps a platform-ready draft for each channel (academic, blog/Reddit,
Twitter/X thread, YouTube). Numbers here must match the model JSON reports, the white paper, and the
site. Last updated 2026-07-24.

---

## The one-line thesis
**You cannot predict who wins a Champions VGC game from the two team sheets — even a player-Elo model
ties a coin.** So we stopped predicting outcomes and built a *decision* stack; every claim ships a
proper score, a confidence interval, and an honest baseline.

## Headline findings (each measured, with a baseline)
1. **Winner-from-sheets ≈ a coin.** Player-Elo held-out log-loss 0.687 vs coin 0.693. A cloned-policy
   rollout win% is *below* a coin — systematically inverted (backs fast offensive teams that lose).
2. **The damage engine is exact.** Within 5% of the Smogon damage calculator on 100% of 31 scenarios (median 0%).
3. **The live board IS predictable (the win).** PORY mid-game win% log-loss 0.567 vs coin 0.693,
   calibrated to ECE 1.6%, clustered CI [0.548, 0.583].
4. **Picking the team doesn't beat a coin (honest null).** CHOMP-EV on 1,205 held-out games: bring
   quality ties coin/Elo/usage; robust to dropping forfeits; a belief-weighted variant also ties.
5. **The meta *looks* rock-paper-scissors, but it's a hint.** Playstyle cycle (Trick Room → Hyper
   Offense → Sand) on only 13–18 games/leg, CIs cross 50% — suggestive, not settled.
6. **Intuitions flatten under data.** After fixing a classifier bug (Charizard = Sun/Mega-Y), Sun went
   15 → 1,367 teams and Rain vs Sun is even (51/49, n=236); Tailwind vs no-Tailwind is 47% (n=756).
7. **Single-label archetypes were the bug; multi-label roles pool the data.** Tagging each team by the
   26 functional roles it reveals (not one archetype) lifts the median matchup cell from n≈15 to
   **n=7,971** — the structural fix for the untrustworthy grid. But predicting the winner from preview
   roles still **ties a coin** (0.694 vs 0.693): roles describe and attribute, they don't predict.
8. **WAR: which *species* you bring carries a small real signal.** A ridge Adjusted-Plus-Minus (RAPM)
   model on preview species **beats a coin** (0.6875 vs 0.6931) and the rating baseline (0.6905) — where
   roles and raw sheets do not. Leaders Basculegion / Kingambit / Sylveon; effect sizes small, ridge-shrunk.
9. **Roles can be discovered, not declared.** NMF of the team×role matrix recovers six interpretable
   archetypes (recon-err 0.53) — Intimidate+Fake-Out control, physical offense, special offense+sustain,
   bulky wall+screens+redirection, Tailwind+Encore, priority — with each team a *blend*, never one label.
   Move-level NMF is coarser (offensive cores dominate). Rank/weighting selection by topic coherence is next.

## Platform drafts (kept current)

### Academic abstract (~150 words)
Competitive Pokémon (VGC doubles) is a two-player, zero-sum, imperfect-information, simultaneous-move
game with a non-transitive metagame and an astronomically large team-building space. We show
empirically, on thousands of real ladder replays, that predicting a game's winner from the two team
sheets is near the coin-flip ceiling — a strong player-rating model does not beat it. We therefore
frame the problem as decision support rather than outcome prediction, and evaluate every component
with a proper score, a clustered confidence interval, and an honest baseline. Our validated damage
engine matches the community ground truth; a small mid-game value network beats a coin and is
calibrated; and we report two honest negatives — team-preview bring selection ties a coin, and the
"rock-paper-scissors" metagame is suggestive but underpowered. We outline a belief-state,
depth-limited search capstone (ReBeL/Metamon-style) as future work.

### Reddit / blog (r/VGC, r/MachineLearning) — hook
"I collected 5,000+ real Champions games and tried to build an AI that predicts who wins from team
sheets. It can't — it's a coin flip, and so is Elo. Here's what I built instead, and the two things I
was sure about that the data proved wrong."

### Twitter/X thread (numbered skeleton)
1/ You can't predict a competitive Pokémon game from the team sheets. Even a rating model ties a coin.
2/ So I stopped predicting winners and measured *decisions* — every number with error bars.
3/ Damage math: exact. Mid-game win%: beats a coin, calibrated. Team-picking: ties a coin (I report it).
4/ "Rain beats Sun"? Even (51/49). "Tailwind wins"? 47%. Intuitions flatten under data.
5/ The endgame: an in-battle coach (Stockfish-for-Pokémon). Repo + live site below.

### YouTube outline
- Cold open: "I tried to predict Pokémon games with AI. It failed — on purpose."
- The ceiling (why sheets can't call the winner) · the pivot (decisions, not outcomes)
- The town of models (MEDI, GURU, XATU, PORY, KING, CHOMP, ALAKAZAM) on the live site
- The honest nulls (why reporting them is the point) · the road to ALAKAZAM · call to action.

## Honest limits (always stated)
Permanent winner-prediction ceiling; meta-structure results are small-sample; rollout policy is the
residual GIGO; the capstone's strongest version needs cloud-GPU training.

## Related work to cite
Metamon (offline RL + transformers, UT-Austin-RPL); VGC-Bench; PokéAgent Challenge (NeurIPS 2025);
Aaron Traylor (competitive-Pokémon framing); ReBeL/CFR/DeepStack/Libratus; Nash-averaging (Balduzzi);
blade-chest (Chen & Joachims); HodgeRank (Jiang–Lim–Yao–Ye); sports xG/EPV.

## Channels checklist (to publish when ready)
- [ ] arXiv / workshop write-up · [ ] r/VGC + r/MachineLearning · [ ] X/Twitter thread
- [ ] YouTube explainer · [ ] Smogon forums / PokéAgent · [ ] portfolio + live site link
