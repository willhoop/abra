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

SELF_RAW = os.environ.get("LOOKAHEAD_SELF") or os.path.join(ROOT, "data", "games.selfplay.porygon2c.raw-logs.jsonl")
if not os.path.isabs(SELF_RAW):
    SELF_RAW = os.path.join(ROOT, SELF_RAW)
HUMAN_RAW = P.HUMAN_RAW
OUT = os.path.join(ROOT, "data", "lookahead-bound.json")
np.random.seed(0)


# HOW FAR AHEAD THE ORACLE IS ALLOWED TO SEE. 1 is the original question and the +4.91 on record.
# 2 asks whether a SECOND turn carries anything the first does not -- the question that decides
# whether depth-2 is worth its cost, and the cost is brutal: the matrix is a product, so depth 2
# squares the cell count. Cheap to ask, and a null kills the idea for the price of an afternoon.
HORIZON = int(os.environ.get("HORIZON", "2"))


def paired_human(clean, limit=None):
    """Per-game state SEQUENCES from the human corpus, kept as (now, t+1..t+HORIZON, label).

    P.load flattens every game into one pile, which is right for training and useless here — the
    whole question is about the relationship between consecutive turns, so the sequence has to
    survive. Same parser, same feature vector, different aggregation."""
    fh = P._open(HUMAN_RAW)
    if fh is None:
        z = np.zeros((0, len(P.FEATURES)))
        return z, [z for _ in range(HORIZON)], np.zeros(0), 0
    now, Y = [], []
    cols = {h: [] for h in range(1, HORIZON + 1)}
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
            games += 1
            # BOTH SIDES OF EVERY GAME, exactly as P.load does: a position is labelled from the point
            # of view of whoever is to move, so each turn yields two rows and the set is balanced by
            # construction rather than by luck.
            #
            # EVERY HORIZON IS SCORED ON THE SAME ROWS. A turn is kept only when t+HORIZON exists, so
            # going deeper does not quietly change the population: t+2 loses the last turn of every
            # game, and comparing a t+2 number against a t+1 number measured on a longer set would
            # attribute the difference to depth when part of it is which turns survived. This is the
            # same failure that produced the withdrawn 47.9% Sucker Punch claim from two corpora
            # differing in three ways. Same rows, same labels, one variable.
            for me in ("p1", "p2"):
                y = 1.0 if w == me else 0.0
                for i in range(len(sts) - HORIZON):
                    now.append(P.vec(sts[i], me))
                    for h in range(1, HORIZON + 1):
                        cols[h].append(P.vec(sts[i + h], me))
                    Y.append(y)
            if limit and games >= limit:
                break
    return (np.array(now, float),
            [np.array(cols[h], float) for h in range(1, HORIZON + 1)],
            np.array(Y, float), games)


def main():
    print("LOOKAHEAD BOUND — can a one-step search find anything?\n")
    Xs, Ys, gs = P.load(SELF_RAW)
    if not len(Ys):
        print("no self-play training positions at %s" % os.path.relpath(SELF_RAW, ROOT))
        sys.exit(1)
    clean = P.clean_ids()
    Xn, Xfut, Y, gh = paired_human(clean)
    if not len(Y):
        print("no paired human positions — need at least %d turns per game" % (HORIZON + 1))
        sys.exit(1)

    print("  train   %s self-play positions from %s games" % (f"{len(Ys):,}", f"{gs:,}"))
    print("  test    %s aligned (turn t .. t+%d) tuples from %s clean human games"
          % (f"{len(Y):,}", HORIZON, f"{gh:,}"))
    print("          every horizon scored on the SAME rows, so depth is the only variable\n")

    # Standardised on the TRAINING set only, and the same transform applied to both test columns --
    # scaling each column by its own statistics would make them incomparable, which is the whole point.
    mu, sd = Xs.mean(axis=0), Xs.std(axis=0)
    sd[sd == 0] = 1.0
    Zs = (Xs - mu) / sd

    rows = []
    for k in (50, 200):
        rows.append(("k=%d  score the CURRENT turn" % k,
                     P.knn_predict(Zs, Ys, (Xn - mu) / sd, k=k)))
        for h in range(1, HORIZON + 1):
            rows.append(("k=%d  score turn t+%d (oracle)" % (k, h),
                         P.knn_predict(Zs, Ys, (Xfut[h - 1] - mu) / sd, k=k)))

    print("  model                              accuracy     Brier    log-loss")
    print("  " + "-" * 64)
    res = {}
    for name, p in rows:
        a, b, l = P.acc(p, Y), P.brier(p, Y), P.logloss(p, Y)
        res[name] = {"accuracy": round(100 * a, 2), "brier": round(b, 4), "logloss": round(l, 4)}
        print("  %-34s %6.2f%%   %7.4f   %7.4f" % (name, 100 * a, b, l))

    # Mean gain of each horizon over the CURRENT turn, and — the number this run exists for — what
    # the MARGINAL turn adds over the one before it. A big t+1 and a flat t+2 says the information is
    # all in the first step and depth-2 is not worth squaring the matrix for.
    byh = {}
    for h in range(1, HORIZON + 1):
        g = []
        for k in (50, 200):
            g.append(res["k=%d  score turn t+%d (oracle)" % (k, h)]["accuracy"]
                     - res["k=%d  score the CURRENT turn" % k]["accuracy"])
        byh[h] = sum(g) / len(g)
    gain = byh[1]

    print("\n  HOW TO READ THIS")
    print("  " + "-" * 64)
    print("  The second row of each pair is CHEATING: it is handed the turn that actually happened,")
    print("  which no search can do. It is therefore an UPPER BOUND on what one step of lookahead")
    print("  could ever be worth on top of this value function.")
    print("")
    for h in range(1, HORIZON + 1):
        marginal = byh[h] - (byh[h - 1] if h > 1 else 0.0)
        print("  seeing turn t+%d:  %+.2f points over the current turn   (%+.2f from this step alone)"
              % (h, byh[h], marginal))
    if HORIZON >= 2:
        step2 = byh[2] - byh[1]
        print("")
        print("  THE DEPTH-2 QUESTION. A second turn of search does not add to the matrix, it")
        print("  MULTIPLIES it — same shortlist, squared cell count. So the second step has to earn")
        print("  roughly what the first did to be worth the same money, and it earns %+.2f." % step2)
        if step2 < 0.5 * byh[1]:
            print("  -> it does not. The information is concentrated in the FIRST step. Build depth 1")
            print("     properly before spending anything on depth 2.")
        else:
            print("  -> it holds up. Depth 2 carries real information, and the open question becomes")
            print("     whether any affordable search shape can reach it.")
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
        "test": {"source": "clean human ladder replays", "games": gh, "pairs": int(len(Y)),
                 "horizon": HORIZON,
                 "note": "every horizon scored on identical rows; a turn is kept only when "
                         "t+HORIZON exists, so depth is the only variable"},
        "gain_by_horizon": {str(h): round(byh[h], 3) for h in byh},
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
