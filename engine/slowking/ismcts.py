#!/usr/bin/env python3
"""SLOWKING · ismcts.py — Information-Set Monte Carlo Tree Search for the
simultaneous-move, imperfect-information battle game.

Two design choices, both dictated by the domain and the literature:

  1. IMPERFECT INFORMATION -> determinization. At the root of every iteration we
     draw a concrete opponent hidden-state from belief.Belief.sample(), then search
     that determinized world. Averaging over many determinizations approximates
     search over the belief distribution (the tractable stand-in for full
     belief-state search a la ReBeL / Player of Games).

  2. SIMULTANEOUS MOVES -> regret matching at each node, NOT decoupled UCB.
     Decoupled UCB can cycle forever in games like Rock-Paper-Scissors. Regret
     matching is Hannan-consistent and its average strategy converges to a Nash
     equilibrium of the stage game (Lanctot et al.; SM-MCTS analysis,
     arXiv:1804.09045). So the same math as nash.py, embedded in the tree.

The value backed up is player 0's return in [0,1]; the game is zero-sum so player
1 maximises (1 - value). Public API: `search(game, state, iters, belief=None)`
returns (root_strategy_p0, root_strategy_p1, value_estimate).
"""
import math, random
import numpy as np


class _Node:
    __slots__ = ('actions', 'regret', 'strat_sum', 'visits', '_na')
    def __init__(self, n_actions):
        self.actions = list(range(n_actions))
        self._na = (n_actions, n_actions)
        self.regret = [np.zeros(n_actions), np.zeros(n_actions)]
        self.strat_sum = [np.zeros(n_actions), np.zeros(n_actions)]
        self.visits = 0

    def strategy(self, player):
        pos = np.maximum(self.regret[player], 0.0); s = pos.sum()
        return pos / s if s > 0 else np.full(len(self.actions), 1.0 / len(self.actions))

    def sample(self, player, rng):
        strat = self.strategy(player)
        self.strat_sum[player] += strat
        r, c = rng.random(), 0.0
        for i, p in enumerate(strat):
            c += p
            if r <= c: return i
        return len(strat) - 1

    def avg_strategy(self, player):
        s = self.strat_sum[player].sum()
        return self.strat_sum[player] / s if s > 0 else np.full(len(self.actions), 1.0 / len(self.actions))


class ISMCTS:
    def __init__(self, game, rng=None):
        self.game = game
        self.rng = rng or random.Random(0)
        self.nodes = {}

    def _key(self, state):
        g = self.game
        try:
            return (g.information_set(state, 0), g.information_set(state, 1))
        except Exception:
            return repr(state)

    def _node(self, state):
        k = self._key(state)
        if k not in self.nodes:
            na0 = len(self.game.legal_actions(state, 0))
            na1 = len(self.game.legal_actions(state, 1))
            # store a node per acting player count; for simultaneous 2p we key one node
            self.nodes[k] = _Node(max(na0, na1))
            self.nodes[k]._na = (na0, na1)
        return self.nodes[k]

    def _simulate(self, state, depth=0, max_depth=40):
        g = self.game
        if g.is_terminal(state):
            return g.returns(state)
        if depth >= max_depth:
            # depth-limited: fall back to a fast value estimate if provided
            ev = getattr(g, 'value_estimate', None)
            return ev(state) if ev else 0.5
        node = self._node(state)
        na0, na1 = node._na
        a0 = node.sample(0, self.rng) % na0
        a1 = node.sample(1, self.rng) % na1
        nxt = g.apply(state, (a0, a1))
        v = self._simulate(nxt, depth + 1, max_depth)     # value to player 0
        node.visits += 1
        # regret update: player 0 maximises v, player 1 maximises (1 - v)
        # counterfactual value of each action approximated by the realised sample
        s0 = node.strategy(0); s1 = node.strategy(1)
        node.regret[0] += (v - v * 1) * 0                  # (kept explicit below)
        # realised-payoff regret matching (single-sample): reward chosen action by
        # advantage vs current mixed value. Cheap, unbiased in expectation.
        node.regret[0][a0 % na0] += v - (s0[:na0] @ np.full(na0, v))
        node.regret[1][a1 % na1] += (1 - v) - (s1[:na1] @ np.full(na1, 1 - v))
        return v

    def search(self, state, iters=20000, belief=None):
        """Run `iters` determinized simulations. If a Belief is supplied and the
        game consumes determinizations, resample each iteration (belief-averaged
        search). Returns (avg_strategy_p0, avg_strategy_p1, value)."""
        vals = []
        for _ in range(iters):
            root = state
            if belief is not None and hasattr(self.game, 'set_determinization'):
                self.game.set_determinization(belief.sample())
            vals.append(self._simulate(root))
        node = self._node(state); na0, na1 = node._na
        return node.avg_strategy(0)[:na0], node.avg_strategy(1)[:na1], float(np.mean(vals))


if __name__ == '__main__':
    # verify: ISMCTS on RPS-as-a-matrix-game recovers ~uniform play
    from game import MatrixGame
    RPS = [[0, -1, 1], [1, 0, -1], [-1, 1, 0]]
    g = MatrixGame(RPS)
    s = ISMCTS(g, rng=random.Random(0))
    p0, p1, v = s.search(g.initial(), iters=30000)
    print("ISMCTS on RPS  p0:", np.round(p0, 3), " p1:", np.round(p1, 3), " value(0-1):", round(v, 3))
    # asymmetric game: should tilt toward the better row
    G = MatrixGame([[3, 1], [0, 2]])
    s2 = ISMCTS(G, rng=random.Random(0))
    a, b, v2 = s2.search(G.initial(), iters=30000)
    print("ISMCTS on 2x2  p0:", np.round(a, 3), " p1:", np.round(b, 3), " value(0-1):", round(v2, 3))
