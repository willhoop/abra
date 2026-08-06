#!/usr/bin/env python3
"""lookahead_clock_control.py — is the oracle gain information, or is it just the clock?

    python engine/lookahead_clock_control.py

WHAT THIS CHALLENGES
--------------------
engine/lookahead_bound.py is the whole justification for the search in docs/LOOKAHEAD-design.md. It
reports that scoring turn t+1 instead of turn t is worth +3.84 accuracy points, and t+2 is worth
+8.97. That was read as "there is information one turn ahead that the snapshot cannot see."

Look at what the two columns actually are. For a game of L turns the comparison is:

    the "current turn" column   states at indices 0 .. L-1-H
    the "t+H oracle"  column    states at indices H .. L-1
    the label                   the same game's winner, for both

There is no counterfactual anywhere in that. Every row's successor is the one that happened, and the
two columns are not two evaluations of the same position -- they are TWO DIFFERENT TIME SLICES of the
same games. A position late in a game is easier to classify than a position early in it, because the
game is closer to being decided. That effect alone would produce a positive "oracle gain" with no
lookahead information whatsoever, and it would grow with H exactly as observed.

So the bound may be measuring the clock. This file measures how much of it is.

THE CONTROL
-----------
Accuracy is estimated as a function of ABSOLUTE turn index, from the current-turn column alone. Then
the t+H gain is PREDICTED from the distribution shift only: each row contributes the bucket accuracy
at index i for the current column and the bucket accuracy at index i+H for the oracle column. Nothing
about lookahead enters that prediction -- it is pure clock.

    predicted ~= observed   ->  the bound is the clock. It is not evidence for a search, because a
                                search's candidate successors all sit at the SAME clock position, so
                                the advantage applies to every candidate equally and cancels out of
                                the ranking. Ranking is the only thing a search does.
    observed  >  predicted  ->  there is something above the clock, and the excess is the honest
                                size of the prize.

WHY THIS MATTERS MORE THAN THE NUMBER IT CHECKS
----------------------------------------------
G1 is the gate the rest of the design stands on. If G1 is a clock artifact then the +4.91 that
motivated abandoning feature work does not exist, and the comparison against +0.03 / +0.11 was never
like-for-like: those two were measured as ranking improvements, this one was not.
"""
import os, sys, json
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
# ONE HOME FOR A TIMESTAMP. This file used to write datetime.now().isoformat(), which is
# naive -- no offset, so its meaning depends on who reads it. See engine/isotime.py.
from isotime import utc_now
import porygon2 as P

SELF_RAW = os.environ.get("LOOKAHEAD_SELF") or os.path.join(ROOT, "data", "games.selfplay.porygon2c.raw-logs.jsonl")
if not os.path.isabs(SELF_RAW):
    SELF_RAW = os.path.join(ROOT, SELF_RAW)
OUT = os.path.join(ROOT, "data", "lookahead-clock-control.json")
HORIZON = int(os.environ.get("HORIZON", "2"))
K = int(os.environ.get("K", "200"))
np.random.seed(0)


def sequences(clean, limit=None):
    """Every state of every clean game, with the turn INDEX kept alongside it.

    lookahead_bound.py throws the index away, which is why the confound is invisible there: once the
    rows are two anonymous columns there is nothing left to notice that they are different slices."""
    fh = P._open(P.HUMAN_RAW)
    if fh is None:
        return np.zeros((0, len(P.FEATURES))), np.zeros(0, int), np.zeros(0), np.zeros(0, int), 0
    X, idx, Y, gid_of = [], [], [], []
    seen, games = set(), 0
    with fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            gid = r.get("id")
            if gid in seen:
                continue
            seen.add(gid)
            if clean is not None and gid not in clean:
                continue
            log = r.get("log", "")
            w = P.winner_side(log)
            if w is None:
                continue
            sts = P.parse_states(log)
            if len(sts) < HORIZON + 1:
                continue
            g = games
            games += 1
            for me in ("p1", "p2"):
                y = 1.0 if w == me else 0.0
                for i, s in enumerate(sts):
                    X.append(P.vec(s, me))
                    idx.append(i)
                    Y.append(y)
                    gid_of.append(g * 2 + (0 if me == "p1" else 1))
            if limit and games >= limit:
                break
    return (np.array(X, float), np.array(idx, int), np.array(Y, float),
            np.array(gid_of, int), games)


def main():
    print("CLOCK CONTROL — how much of the lookahead bound is just being later in the game?\n")
    Xs, Ys, gs = P.load(SELF_RAW)
    if not len(Ys):
        print("no self-play training positions at %s" % os.path.relpath(SELF_RAW, ROOT))
        sys.exit(1)
    clean = P.clean_ids()
    X, idx, Y, seq, gh = sequences(clean)
    if not len(Y):
        print("no human sequences")
        sys.exit(1)

    mu, sd = Xs.mean(axis=0), Xs.std(axis=0)
    sd[sd == 0] = 1.0
    Zs = (Xs - mu) / sd
    print("  train  %s self-play positions   test  %s states from %s clean human games"
          % (f"{len(Ys):,}", f"{len(Y):,}", f"{gh:,}"))
    print("  scoring every state ONCE, k=%d — the same prediction is reused for both columns, so the\n"
          "  comparison cannot be contaminated by two different model fits\n" % K)
    p = P.knn_predict(Zs, Ys, (X - mu) / sd, k=K)
    correct = ((p >= 0.5).astype(float) == Y).astype(float)

    # ---- accuracy as a function of absolute turn index --------------------------------------------
    # This is the confound, drawn directly. Nothing about lookahead is involved.
    print("  ACCURACY BY TURN INDEX (the confound, if it is one)")
    print("  " + "-" * 58)
    buckets = {}
    for i, c in zip(idx, correct):
        buckets.setdefault(int(i), []).append(c)
    acc_at = {i: float(np.mean(v)) for i, v in buckets.items() if len(v) >= 200}
    for i in sorted(acc_at)[:16]:
        n = len(buckets[i])
        bar = "#" * int(round((acc_at[i] - 0.45) * 200))
        print("   turn %3d  %6.2f%%  (n=%6d)  %s" % (i, 100 * acc_at[i], n, bar))
    if len(acc_at) > 16:
        print("   ... %d further turn indices" % (len(acc_at) - 16))

    # ---- reproduce the bound, then predict it from the clock alone --------------------------------
    # Rows are the same ones lookahead_bound.py builds: index i is kept only when i+HORIZON exists in
    # the same sequence, so this reproduces its population exactly rather than approximating it.
    last = {}
    for s, i in zip(seq, idx):
        last[int(s)] = max(last.get(int(s), -1), int(i))
    pos = {(int(s), int(i)): j for j, (s, i) in enumerate(zip(seq, idx))}

    rows = [(j, pos[(int(s), int(i) + HORIZON)])
            for j, (s, i) in enumerate(zip(seq, idx))
            if int(i) + HORIZON <= last[int(s)]]
    a_now = float(np.mean([correct[j] for j, _ in rows]))
    a_fut = float(np.mean([correct[k] for _, k in rows]))
    observed = 100 * (a_fut - a_now)

    # The clock-only forecast: replace each row's ACTUAL outcome with the average accuracy at that
    # turn index. Any real lookahead information is destroyed by this substitution, so whatever gain
    # survives is attributable to the index shift and nothing else.
    def clock_of(j):
        return acc_at.get(int(idx[j]), a_now)
    c_now = float(np.mean([clock_of(j) for j, _ in rows]))
    c_fut = float(np.mean([clock_of(k) for _, k in rows]))
    predicted = 100 * (c_fut - c_now)

    print("\n  THE COMPARISON, on %s rows" % f"{len(rows):,}")
    print("  " + "-" * 58)
    print("   observed  gain from scoring t+%d instead of t   %+6.2f points" % (HORIZON, observed))
    print("   predicted by the TURN INDEX SHIFT alone         %+6.2f points" % predicted)
    excess = observed - predicted
    print("   excess above the clock                          %+6.2f points" % excess)

    share = (predicted / observed) if observed else float("nan")
    print("\n  VERDICT")
    print("  " + "-" * 58)
    if observed > 0 and share >= 0.8:
        print("  %.0f%% of the bound is the clock." % (100 * share))
        print("  A search does NOT get this. Every candidate successor it compares sits at the same")
        print("  turn index, so a 'later positions are easier' advantage applies to all of them")
        print("  equally and cancels out of the ranking — and ranking is the only thing a search does.")
        print("  G1 does not support the design on its own. The honest prize is the excess above.")
    elif observed > 0 and share >= 0.4:
        print("  %.0f%% of the bound is the clock, and %.2f points are not." % (100 * share, excess))
        print("  The design's prize is the excess, not the headline number.")
    else:
        print("  The clock does not explain it. The gain survives the control, and the bound stands.")

    json.dump({
        "generated": utc_now(),
        "by": "engine/lookahead_clock_control.py",
        "what": "Controls engine/lookahead_bound.py for the fact that its two columns are different "
                "time slices of the same games rather than two evaluations of one position.",
        "horizon": HORIZON, "k": K,
        "rows": len(rows), "games": gh,
        "observed_gain_points": round(observed, 3),
        "predicted_by_clock_points": round(predicted, 3),
        "excess_points": round(excess, 3),
        "clock_share": round(share, 4) if observed else None,
        "accuracy_by_turn": {str(i): round(100 * a, 3) for i, a in sorted(acc_at.items())},
        "caveat": "The clock forecast substitutes each row's outcome with the mean accuracy at its "
                  "turn index, which destroys any genuine lookahead signal by construction. So the "
                  "excess is a floor on the real information, not a point estimate of it.",
    }, open(OUT, "w", encoding="utf-8"), indent=1, allow_nan=False)
    print("\nwrote %s" % os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
