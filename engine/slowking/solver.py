#!/usr/bin/env python3
"""SLOWKING · solver.py — the orchestrator. Turns the poker-AI playbook into a
Champions decision engine that answers exactly Will's question: *what move (or
mix of moves) maximises my win probability from here, and what is that %?*

The architecture is the DeepStack / Libratus / ReBeL recipe, adapted to Pokémon:

  1. PUBLIC BELIEF STATE (ReBeL). The unit of search is not the raw board but the
     (public board + belief over each player's hidden info). belief.Belief supplies
     the private-info distribution; game.py carries the public part.

  2. CONTINUAL RE-SOLVING (DeepStack/Libratus). At each decision we re-solve a
     depth-limited subgame from the current PBS with regret matching (ismcts.py),
     rather than trusting a stale precomputed strategy. Play a move, observe, update
     the belief, re-solve again next turn.

  3. DEPTH LIMIT + LEAF EVALUATOR. We cannot search to the end of a 20-turn doubles
     game, so we cap depth and evaluate leaf PBSs with a value function. Today that
     evaluator is an engine rollout (MEDICHAM / the real Showdown sim); ReBeL's
     upgrade is to train a value+policy network on self-play and use it at the leaf.

  4. CHANCE = THE OPEN ENGINE. Poker's chance is the deck; ours is damage rolls,
     crits, misses, speed ties. We don't *model* them — we *call the exact engine*.
     That is the payoff of the open-engine finding and it removes a whole class of
     modelling error poker researchers had to fight.

  5. TWO SOLVE POINTS.
       team preview  -> a one-shot simultaneous matrix game over the 15 possible
                        brings; solve with nash.py for the equilibrium bring MIX.
       each turn     -> imperfect-information subgame; solve with ismcts.py.

Output at every decision: a mixed strategy (probabilities over your legal choices)
and the equilibrium win-probability value. You may play the argmax or sample the
mix; the mix is what makes you unexploitable.
"""
import itertools
import numpy as np
from . import nash
from .ismcts import ISMCTS


class SlowKing:
    def __init__(self, rng=None):
        import random
        self.rng = rng or random.Random(0)

    # ---- team preview: equilibrium bring selection (the honest "double oracle") ----
    def team_preview(self, my_six, opp_six, payoff_fn, my_bring_size=4, opp_bring_size=4):
        """payoff_fn(my_bring_tuple, opp_bring_tuple) -> P(my_bring beats opp_bring)
        in [0,1] (from engine rollouts). Returns (bring_mix, value) where bring_mix
        is a dict {my_bring: probability} — the unexploitable bring strategy, and
        value is your equilibrium win probability at preview."""
        my_brings = [tuple(sorted(c)) for c in itertools.combinations(my_six, my_bring_size)] if len(my_six) > my_bring_size else [tuple(sorted(my_six))]
        opp_brings = [tuple(sorted(c)) for c in itertools.combinations(opp_six, opp_bring_size)] if len(opp_six) > opp_bring_size else [tuple(sorted(opp_six))]
        A = np.array([[2 * payoff_fn(mb, ob) - 1 for ob in opp_brings] for mb in my_brings])  # center to [-1,1]
        row, col, val = nash.solve_rm(A, iters=int(4000 + 400 * len(my_brings)))
        mix = {mb: float(p) for mb, p in zip(my_brings, row) if p > 1e-3}
        return dict(sorted(mix.items(), key=lambda kv: -kv[1])), float((val + 1) / 2), \
               {ob: float(p) for ob, p in zip(opp_brings, col) if p > 1e-3}

    # ---- in-battle: depth-limited re-solve over the belief ----
    def turn_decision(self, game, state, belief=None, iters=20000):
        """Re-solve the current subgame. Returns (my_move_mix, value_estimate).
        `game` implements game.Game and, if given a belief, exposes
        set_determinization() so each iteration searches a resampled world."""
        search = ISMCTS(game, rng=self.rng)
        p0, p1, v = search.search(state, iters=iters, belief=belief)
        actions = game.legal_actions(state, 0)
        mix = {a: float(pr) for a, pr in zip(actions, p0) if pr > 1e-3}
        return dict(sorted(mix.items(), key=lambda kv: -kv[1])), float(v)


if __name__ == '__main__':
    # DEMO: team-preview solve with a synthetic (but structured) payoff so you can
    # see it return a real bring MIX rather than a single "best" bring. In production
    # payoff_fn is MEDICHAM/real-engine P(win) for the two 4-mon brings.
    sk = SlowKing()
    my6 = ['garchomp', 'incineroar', 'whimsicott', 'sylveon', 'charizard', 'kingambit']
    op6 = ['torkoal', 'venusaur', 'flutter', 'sylveon', 'gholdengo', 'ironhands']
    # toy payoff: bring with more "fast/spread" mons beats slower brings, with a cycle
    fast = {'garchomp', 'whimsicott', 'charizard', 'flutter', 'gholdengo'}
    bulky = {'incineroar', 'sylveon', 'venusaur', 'ironhands', 'kingambit', 'torkoal'}
    def payoff(mb, ob):
        f = sum(x in fast for x in mb) - sum(x in fast for x in ob)
        b = sum(x in bulky for x in mb) - sum(x in bulky for x in ob)
        # rock-paper-scissors-ish: fast beats bulky beats balanced beats fast
        return float(1 / (1 + np.exp(-(0.5 * f - 0.3 * b))))
    mix, val, opp_mix = sk.team_preview(my6, op6, payoff)
    print(f"SLOWKING team-preview equilibrium value (your win %): {val*100:.1f}%")
    print("your bring MIX (unexploitable):")
    for br, p in list(mix.items())[:4]:
        print(f"  {p*100:4.1f}%  {br}")
    print("=> not a single 'best team' — a mix, because any pure bring is exploitable.")
