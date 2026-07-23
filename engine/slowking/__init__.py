"""SLOWKING — Search over Learned Opponent-belief World, Knowledge-Intensive
Nash Game-solver. The belief-based search engine for Champions VGC, built on the
poker-AI lineage (CFR -> DeepStack -> Libratus -> ReBeL). See README.md.

Modules:
  nash    — 2p zero-sum equilibrium (regret matching + LP). Verified on RPS.
  belief  — public-belief-state model over the opponent's hidden info + Bayesian filter.
  game    — the game interface the search runs on; adapter stub for the open engine.
  ismcts  — Information-Set MCTS with regret matching (recovers stage-game Nash).
  solver  — orchestrator: team-preview Nash + in-battle continual re-solving.
"""
from . import nash, belief, game, ismcts, solver  # noqa: F401
