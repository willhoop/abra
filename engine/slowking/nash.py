#!/usr/bin/env python3
"""SLOWKING · nash.py — 2-player zero-sum equilibrium solving.

This is the load-bearing math for the whole SLOWKING stack and it fixes two
teardown findings at once:
  - DITTO is not actually a "double oracle": it never solves a meta-game. This
    module gives it (and the meta-game builder) a real Nash solve over a payoff
    matrix of teams/policies, so "double oracle" stops being a misnomer.
  - CHOMP picks brings by greedily maximising coverage against a STATIC opponent.
    Bring/lead selection is a simultaneous-move matrix game; the right object is
    a minimax mixed strategy, which is exactly what solve() returns.

Two solvers, same interface:
  solve_rm(A, iters)  — regret matching / self-play (fast, dependency-free, the
                        default; converges to an eps-Nash of the zero-sum game).
  solve_lp(A)         — exact linear-program value + strategy when SciPy is present.

Convention: A is the ROW player's payoff matrix (row = maximiser, col = minimiser),
shape (m, n). Returns (row_strategy, col_strategy, game_value).
"""
import numpy as np


def solve_rm(A, iters=20000, seed=0):
    """Regret matching (Hart & Mas-Colell) via self-play. In a 2p zero-sum game
    the average strategies of two regret-minimising learners converge to a Nash
    equilibrium — the same principle behind CFR, minus the extensive-form tree.
    Dependency-free and good to a few 1e-3 in a few thousand iterations."""
    A = np.asarray(A, float)
    m, n = A.shape
    reg_r = np.zeros(m); reg_c = np.zeros(n)
    sum_r = np.zeros(m); sum_c = np.zeros(n)

    def strat(reg):
        pos = np.maximum(reg, 0.0); s = pos.sum()
        return pos / s if s > 0 else np.full(len(reg), 1.0 / len(reg))

    for _ in range(iters):
        r = strat(reg_r); c = strat(reg_c)
        sum_r += r; sum_c += c
        # row payoff vector against current col strat; col payoff = -A^T r
        u_r = A @ c            # value of each row action for the maximiser
        u_c = -(A.T @ r)       # value of each col action for the minimiser (zero-sum)
        reg_r += u_r - (r @ u_r)
        reg_c += u_c - (c @ u_c)
    row = sum_r / sum_r.sum(); col = sum_c / sum_c.sum()
    val = float(row @ A @ col)
    return row, col, val


def solve_lp(A):
    """Exact Nash value + strategies via linear programming (needs SciPy).
    Falls back to regret matching if SciPy isn't available."""
    try:
        from scipy.optimize import linprog
    except Exception:
        return solve_rm(A)
    A = np.asarray(A, float)
    m, n = A.shape
    shift = -A.min() + 1.0          # make payoffs positive so value>0
    B = A + shift
    # Row player LP:  max v  s.t.  B^T x >= v,  sum x = 1,  x>=0
    # standard form (minimise): vars = x (m), objective min -1*(dummy)... use the
    # classic 1/v formulation: min sum(x')  s.t. B^T x' >= 1, x'>=0 ; v = 1/sum(x')
    c = np.ones(m)
    A_ub = -B.T; b_ub = -np.ones(n)
    res = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=[(0, None)] * m, method='highs')
    if not res.success:
        return solve_rm(A)
    xp = res.x; v = 1.0 / xp.sum(); row = xp * v
    # Col player symmetric
    cc = np.ones(n)
    A_ub2 = B; b_ub2 = np.ones(m)
    res2 = linprog(-cc, A_ub=A_ub2, b_ub=b_ub2, bounds=[(0, None)] * n, method='highs')
    yp = res2.x; col = yp / yp.sum()
    return row / row.sum(), col, float(v - shift)


def exploitability(A, row, col):
    """How much either player could gain by best-responding — 0 at equilibrium.
    The honest way to report 'how close to Nash are we'."""
    A = np.asarray(A, float)
    v = row @ A @ col
    row_gain = (A @ col).max() - v      # best row response vs col
    col_gain = v - (A.T @ row).min()    # best col response vs row (col minimises)
    return float(max(row_gain, col_gain))


if __name__ == '__main__':
    # sanity: Rock-Paper-Scissors -> uniform (1/3,1/3,1/3), value 0
    RPS = np.array([[0, -1, 1], [1, 0, -1], [-1, 1, 0]], float)
    r, c, v = solve_rm(RPS, 20000)
    print("RPS regret-matching:", np.round(r, 3), np.round(c, 3), "value", round(v, 4),
          "exploitability", round(exploitability(RPS, r, c), 4))
    r2, c2, v2 = solve_lp(RPS)
    print("RPS linear-program: ", np.round(r2, 3), np.round(c2, 3), "value", round(v2, 4))
    # asymmetric game with a pure equilibrium
    G = np.array([[3, 1], [0, 2]], float)
    r3, c3, v3 = solve_rm(G, 20000)
    print("2x2 game:", np.round(r3, 3), np.round(c3, 3), "value", round(v3, 3),
          "exploitability", round(exploitability(G, r3, c3), 4))
