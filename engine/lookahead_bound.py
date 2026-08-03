#!/usr/bin/env python3
"""lookahead_bound.py — is there anything for a SEARCH to find? An oracle upper bound.

    python engine/lookahead_bound.py

WHY THIS EXISTS, BEFORE ANY SEARCH IS BUILT
-------------------------------------------
PORY scores the board as it stands. It is designed as the LEAF of a search — something else imagines
futures, PORY judges them — and that something else has never been built. The obvious next move is to
build it: roll each candidate turn forward, score the result, pick the best.

That is weeks of work, and two cheaper experiments already came back null tonight (a corpus from a
corrected bot moved accuracy 0.11 points; per-Pokemon HP distribution moved it 0.03). So before
building the machinery, measure whether the machinery can possibly pay.

THE BOUND, AND WHY IT IS AN UPPER ONE
-------------------------------------
A one-step search asks: "of the futures I could reach, which is best?" Its value is bounded above by
"how much better could I predict if I simply KNEW the next turn". That is not a search — it is
cheating, because it uses the turn that actually happened rather than one you chose. But that is
precisely what makes it an upper bound:

    a search picks among futures it ESTIMATES
    the oracle is handed the future that OCCURRED

No search can extract more from one step than knowing the step outright. So:

    if score(state at t+1) barely beats score(state at t)   ->  one step carries almost no
                                                                information, and NO search over one
                                                                step can pay. Do not build it.
    if it beats it substantially                            ->  the information is there, and the
                                                                only question left is whether a
                                                                search can capture it.

A null here is worth more than the search, because it is a null that saves the search.

THE THEORY THIS IS CHECKING, AND THE CAVEAT THE THEORY CARRIES
--------------------------------------------------------------
Rollout with one-step lookahead is the classical policy-improvement operator (Bertsekas' rollout
survey; Tesauro coined "rollout" for backgammon dice). The Policy Improvement Theorem guarantees the
rollout policy is at least as good as the base policy — V_rollout(s) >= V_base(s), strictly better
unless already optimal.

BUT THE GUARANTEE HAS A PRECONDITION AND WE DO NOT MEET IT. Rollout inherits monotone improvement
BECAUSE IT STARTS FROM THE TRUE VALUE OF A POLICY. Lookahead from an arbitrary approximation carries
no such monotonicity. PORY is an arbitrary approximation — a k-NN fitted to outcomes, not the value
function of any policy we run. So we get no theorem, and the question becomes empirical. Which is
exactly what this measures.

WHAT IS AND IS NOT CONTROLLED
-----------------------------
Both columns score the SAME games with the SAME model, trained on the SAME self-play positions. The
only difference is which turn's state is handed to the scorer. Pairs are aligned by construction: a
game contributes a (t, t+1) pair only when both exist, so neither column sees a position the other
does not, and the label is the same game's winner in both.
"""
import os, sys, json
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import porygon2 as P            # one reader for the protocol, the features and the k-NN

SELF_RAW = os.environ.get("LOOKAHEAD_SELF") or os.path.join(ROOT, "data", "games.selfplay.porygon3.raw-logs.jsonl")
if not os.path.isabs(SELF_RAW):
    SELF_RAW = os.path.join(ROOT, SELF_RAW)
HUMAN_RAW = P.HUMAN_RAW
OUT = os.path.join(ROOT, "data", "lookahead-bound.json")
np.random.seed(0)


def paired_human(clean, limit=None):
    """Per-game state SEQUENCES from the human corpus, kept as (now, next, label) triples.

    P.load flattens every game into one pile, which is right for training and useless here — the
    whole question is about the relationship between consecutive turns, so the sequence has to
    survive. Same parser, same feature vector, different aggregation."""
    fh = P._open(HUMAN_RAW)
    if fh is None:
        return np.zeros((0, len(P.FEATURES))), np.zeros((0, len(P.FEATURES))), np.zeros(0), 0
    now, nxt, Y = [], [], []
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
            if len(sts) < 2:
                continue
            games += 1
            # BOTH SIDES OF EVERY GAME, exactly as P.load does: a position is labelled from the point
            # of view of whoever is to move, so each turn yields two rows and the set is balanced by
            # construction rather than by luck.
            for me in ("p1", "p2"):
                y = 1.0 if w == me else 0.0
                for i in range(len(sts) - 1):
                    now.append(P.vec(sts[i], me))
                    nxt.append(P.vec(sts[i + 1], me))
                    Y.append(y)
            if limit and games >= limit:
                break
    return np.array(now, float), np.array(nxt, float), np.array(Y, float), games


def main():
    print("LOOKAHEAD BOUND — can a one-step search find anything?\n")
    Xs, Ys, gs = P.load(SELF_RAW)
    if not len(Ys):
        print("no self-play training positions at %s" % os.path.relpath(SELF_RAW, ROOT))
        sys.exit(1)
    clean = P.clean_ids()
    Xn, Xx, Y, gh = paired_human(clean)
    if not len(Y):
        print("no paired human positions — need at least two turns per game")
        sys.exit(1)

    print("  train   %s self-play positions from %s games" % (f"{len(Ys):,}", f"{gs:,}"))
    print("  test    %s aligned (turn t, turn t+1) pairs from %s clean human games\n" % (f"{len(Y):,}", f"{gh:,}"))

    # Standardised on the TRAINING set only, and the same transform applied to both test columns --
    # scaling each column by its own statistics would make them incomparable, which is the whole point.
    mu, sd = Xs.mean(axis=0), Xs.std(axis=0)
    sd[sd == 0] = 1.0
    Zs = (Xs - mu) / sd

    rows = []
    for k in (50, 200):
        pn = P.knn_predict(Zs, Ys, (Xn - mu) / sd, k=k)
        px = P.knn_predict(Zs, Ys, (Xx - mu) / sd, k=k)
        rows.append(("k=%d  score the CURRENT turn" % k, pn))
        rows.append(("k=%d  score the NEXT turn (oracle)" % k, px))

    print("  model                              accuracy     Brier    log-loss")
    print("  " + "-" * 64)
    res = {}
    for name, p in rows:
        a, b, l = P.acc(p, Y), P.brier(p, Y), P.logloss(p, Y)
        res[name] = {"accuracy": round(100 * a, 2), "brier": round(b, 4), "logloss": round(l, 4)}
        print("  %-34s %6.2f%%   %7.4f   %7.4f" % (name, 100 * a, b, l))

    gains = []
    for k in (50, 200):
        a0 = res["k=%d  score the CURRENT turn" % k]["accuracy"]
        a1 = res["k=%d  score the NEXT turn (oracle)" % k]["accuracy"]
        gains.append(a1 - a0)
    gain = sum(gains) / len(gains)

    print("\n  HOW TO READ THIS")
    print("  " + "-" * 64)
    print("  The second row of each pair is CHEATING: it is handed the turn that actually happened,")
    print("  which no search can do. It is therefore an UPPER BOUND on what one step of lookahead")
    print("  could ever be worth on top of this value function.")
    print("")
    print("  mean oracle gain from seeing one turn further: %+.2f accuracy points" % gain)
    if gain < 1.0:
        print("  -> a one-step search CANNOT pay here. Even perfect foresight of the next turn buys")
        print("     less than a point, so no amount of estimating it will. Do not build the search")
        print("     for this value function; the limit is what the scorer can see, not how far ahead.")
    else:
        print("  -> the information IS there. A one-step search has something to capture, and the")
        print("     open question is only how much of this bound a real search recovers.")

    json.dump({
        "generated": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "by": "engine/lookahead_bound.py",
        "what": "Upper bound on one-step lookahead: score the turn that ACTUALLY happened instead of "
                "the current one. No search can beat knowing the answer, so this bounds what a "
                "search could add to this value function.",
        "train": {"source": os.path.relpath(SELF_RAW, ROOT), "games": gs, "positions": int(len(Ys))},
        "test": {"source": "clean human ladder replays", "games": gh, "pairs": int(len(Y))},
        "results": res,
        "oracle_gain_accuracy_points": round(gain, 3),
        "caveat": "An upper bound, not an estimate. It uses the realised next turn, which a search "
                  "cannot; and the classical policy-improvement guarantee for rollout does NOT apply "
                  "here, because that guarantee needs the true value of a policy and PORY is an "
                  "arbitrary approximation. A small number here is decisive against building the "
                  "search; a large one is permission to try, not a promise.",
    }, open(OUT, "w", encoding="utf-8"), indent=1)
    print("\nwrote %s" % os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
