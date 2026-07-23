#!/usr/bin/env python3
"""SLOWKING · game.py — the game interface the search operates over.

SLOWKING is deliberately engine-agnostic: the search (ISMCTS / subgame solve)
talks only to this interface, and the *real* Champions dynamics are supplied by
an adapter that wraps the open-source Showdown engine (sim/champions-battle.js)
via a determinized rollout. Keeping the search decoupled from the simulator is
what lets us (a) unit-test the search on a toy game with a known equilibrium and
(b) swap in the ground-truth engine without touching the search.

An implementation must provide:
  legal_actions(state, player)      -> list of actions for that player
  apply(state, joint_action)        -> next state         (simultaneous moves)
  is_terminal(state)                -> bool
  returns(state)                    -> payoff to player 0 in [0,1] (zero-sum: p1 = 1-p0)
  current_players(state)            -> which players act now (both, in doubles)
  information_set(state, player)    -> hashable key of what `player` can observe

`ChampionsGame` is the adapter stub that will call the Node engine; `MatrixGame`
is a one-shot simultaneous-move game used to test the solver end to end.
"""
from abc import ABC, abstractmethod
import numpy as np


class Game(ABC):
    @abstractmethod
    def legal_actions(self, state, player): ...
    @abstractmethod
    def apply(self, state, joint_action): ...
    @abstractmethod
    def is_terminal(self, state): ...
    @abstractmethod
    def returns(self, state): ...
    def current_players(self, state): return [0, 1]
    def information_set(self, state, player): return repr(state)


class MatrixGame(Game):
    """One-shot 2-player zero-sum simultaneous game from a payoff matrix A
    (row player = player 0, maximiser). Terminal after one joint action. Used to
    verify that the search + solver recover the matrix's Nash value."""
    def __init__(self, A):
        self.A = np.asarray(A, float)
    def legal_actions(self, state, player):
        return list(range(self.A.shape[0] if player == 0 else self.A.shape[1]))
    def apply(self, state, joint):
        return ('done', joint[0], joint[1])
    def is_terminal(self, state):
        return isinstance(state, tuple) and state[0] == 'done'
    def returns(self, state):
        _, i, j = state
        # squash payoff into [0,1] for MCTS value bookkeeping
        v = self.A[i, j]
        lo, hi = self.A.min(), self.A.max()
        return 0.5 if hi == lo else float((v - lo) / (hi - lo))
    def initial(self):
        return 'start'


class ChampionsGame(Game):
    """Adapter to the OPEN Showdown Champions engine (sim/champions-battle.js).

    A SLOWKING search node is a battle position + a sampled determinization of the
    opponent's hidden info (from belief.Belief.sample()). `apply` advances the real
    engine one turn; `returns` runs it to the end under a rollout policy. Because
    the engine is Node, the concrete adapter shells out to `sim/` (or uses a Python
    port). This class documents the contract; wiring is task #31 (sim/).

    Design notes for the implementer:
      - state = {battle_handle, belief_sample, to_move}
      - simultaneous moves: current_players -> [0,1]; apply takes a joint choice
        and writes `>p1 ...`/`>p2 ...` to the BattleStream, reads the next request.
      - information_set(state, 0) hides p2's private info (belief-summarised), so
        ISMCTS determinizes by resampling belief at the root of each iteration.
    """
    def __init__(self, engine_adapter=None, belief=None):
        self.engine = engine_adapter     # callable(team1, team2, choices)-> next / result
        self.belief = belief
    def legal_actions(self, state, player):
        raise NotImplementedError("wire to sim/champions-battle.js (task #31)")
    def apply(self, state, joint):
        raise NotImplementedError("wire to sim/champions-battle.js (task #31)")
    def is_terminal(self, state):
        raise NotImplementedError
    def returns(self, state):
        raise NotImplementedError
