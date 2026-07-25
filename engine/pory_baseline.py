"""pory_baseline.py — is PORY a finding, or is it arithmetic?

THE EXAMINATION QUESTION (docs/REVIEW-2026-07-25.md I.1)
--------------------------------------------------------
PORY is presented as the project's central positive result: mid-game win probability at held-out
log-loss 0.567 against a coin's 0.693. Its feature vector is

    [bias, alive_diff, hp_diff, my_alive, foe_alive, turn/10]

which is the MATERIAL STATE OF THE BOARD. So the claim reduces to "how many Pokemon each side has
left predicts who wins", which is not in dispute and does not need a model.

The defence in the documents is that PORY beats "a material-sign heuristic". That baseline uses only
the SIGN of the material difference and throws away magnitude, so it cannot tell 3-vs-1 from 2-vs-1.
Beating it demonstrates that magnitude carries information, which is also not in dispute.

This script asks the question the documents never do: does PORY beat a COMPETENT material baseline?

    B0  coin                          the floor
    B1  alive_diff alone              one feature, fitted
    B2  alive_diff + hp_diff          two features, fitted
    B3  sign(alive_diff)              the strawman the docs actually used
    P   PORY's full feature set       six features

If P is close to B1, PORY is a curve-fit of the obvious and the project's headline result is a
tautology. If P clears B2 by a real margin, PORY earns its place.

Same split, same rows, same estimator for every arm, so the only thing varying is the feature set.
Split is by GAME (hashed id), never by state — turns within a game are correlated, and splitting on
states would leak the outcome across the boundary and flatter every arm equally.

    python engine/pory_baseline.py
"""
import os, sys, json, math, random, importlib.util
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
random.seed(0); np.random.seed(0)

# reuse PORY's own state reconstruction so the comparison cannot drift from the model it judges
spec = importlib.util.spec_from_file_location("pory", os.path.join(HERE, "pory.py"))
pory = importlib.util.module_from_spec(spec)
sys.modules["pory"] = pory
try:
    spec.loader.exec_module(pory)
except SystemExit:
    pass    # pory.py trains on import; we only want board_states
except Exception as e:
    print(f"could not load pory.py: {e}")
    raise

RAW = os.path.join(ROOT, "data", "games.ladder.raw-logs.jsonl")


def split(gid):
    h = 0
    for ch in str(gid):
        h = (h * 131 + ord(ch)) & 0xffffffff
    return "test" if h % 5 == 0 else "train"


def rows():
    """(features..., label, gid) per turn, from the raw archive."""
    out = []
    if not os.path.exists(RAW):
        print(f"raw archive missing at {RAW}")
        return out
    import io
    with io.open(RAW, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            log = rec.get("log") or ""
            if "|win|" not in log:
                continue
            # winner side
            wm = None
            for ln in log.split("\n"):
                if ln.startswith("|player|"):
                    p = ln.split("|")
                    if len(p) >= 4:
                        pass
                if ln.startswith("|win|"):
                    wm = ln.split("|")[2].strip()
            names = {}
            for ln in log.split("\n"):
                if ln.startswith("|player|"):
                    p = ln.split("|")
                    if len(p) >= 4:
                        names[p[2]] = p[3]
            if wm is None:
                continue
            y = 1 if names.get("p1") == wm else (0 if names.get("p2") == wm else None)
            if y is None:
                continue
            try:
                states = pory.board_states(log)
            except Exception:
                continue
            for (turn, a1, a2, h1, h2) in states:
                out.append((turn, a1, a2, h1, h2, y, rec.get("id")))
    return out


def fit(X, y, iters=400, lr=0.5, l2=1e-4):
    w = np.zeros(X.shape[1])
    for _ in range(iters):
        p = 1 / (1 + np.exp(-X @ w))
        g = X.T @ (p - y) / len(y) + l2 * w
        w -= lr * g
    return w


def logloss(p, y):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def standardise(tr, te):
    mu, sd = tr.mean(0), tr.std(0)
    sd[sd == 0] = 1
    return (tr - mu) / sd, (te - mu) / sd


def main():
    R = rows()
    if not R:
        print("no rows — the raw archive is required (it is gitignored; run a fetch first)")
        return
    tr = [r for r in R if split(r[6]) == "train"]
    te = [r for r in R if split(r[6]) == "test"]
    print(f"states: {len(R)} total, {len(tr)} train, {len(te)} test "
          f"(split by GAME, never by state — turns within a game are correlated)")

    def build(rs, which):
        turn = np.array([r[0] for r in rs], float)
        a1 = np.array([r[1] for r in rs], float)
        a2 = np.array([r[2] for r in rs], float)
        h1 = np.array([r[3] for r in rs], float)
        h2 = np.array([r[4] for r in rs], float)
        y = np.array([r[5] for r in rs], float)
        ad, hd = a1 - a2, h1 - h2
        if which == "alive":       X = np.c_[ad]
        elif which == "alive_hp":  X = np.c_[ad, hd]
        elif which == "sign":      X = np.c_[np.sign(ad)]
        else:                      X = np.c_[ad, hd, a1, a2, turn / 10.0]
        return X, y

    ytr = np.array([r[5] for r in tr], float)
    yte = np.array([r[5] for r in te], float)
    coin = logloss(np.full(len(yte), 0.5), yte)

    print(f"\n{'arm':<34}{'features':>10}{'log-loss':>11}{'vs coin':>10}")
    print("-" * 65)
    print(f"{'B0  coin':<34}{0:>10}{coin:>11.4f}{'—':>10}")

    results = {}
    for name, which, label in [
        ("B3  sign(alive_diff) — the docs' baseline", "sign", "sign"),
        ("B1  alive_diff alone", "alive", "alive"),
        ("B2  alive_diff + hp_diff", "alive_hp", "alive_hp"),
        ("P   PORY's full feature set", "full", "full"),
    ]:
        Xtr, _ = build(tr, which)
        Xte, _ = build(te, which)
        Xtr, Xte = standardise(Xtr, Xte)
        Xtr = np.c_[np.ones(len(Xtr)), Xtr]
        Xte = np.c_[np.ones(len(Xte)), Xte]
        w = fit(Xtr, ytr)
        ll = logloss(1 / (1 + np.exp(-Xte @ w)), yte)
        results[label] = ll
        print(f"{name:<34}{Xte.shape[1]-1:>10}{ll:>11.4f}{coin-ll:>+10.4f}")

    print("-" * 65)
    gain_over_alive = results["alive"] - results["full"]
    gain_over_alive_hp = results["alive_hp"] - results["full"]
    print(f"\nPORY's gain over 'alive_diff alone'      : {gain_over_alive:+.4f} log-loss")
    print(f"PORY's gain over 'alive_diff + hp_diff'  : {gain_over_alive_hp:+.4f} log-loss")
    print(f"PORY's gain over a coin                  : {coin - results['full']:+.4f} log-loss")

    print("\nVERDICT")
    if gain_over_alive_hp < 0.005:
        print("  PORY does NOT meaningfully beat a two-feature material baseline.")
        print("  The headline result is a curve-fit of the obvious: the model's features ARE the")
        print("  material state, and material predicts winning without any model. The project should")
        print("  stop describing this as its central positive finding.")
    elif gain_over_alive_hp < 0.02:
        print("  PORY beats the material baseline only marginally. Report the gain OVER MATERIAL,")
        print("  not over a coin — 'beats a coin' is not the claim anyone should care about.")
    else:
        print("  PORY clears a competent material baseline by a real margin. The contribution stands,")
        print("  and should be stated as the gain over material rather than over a coin.")
    print("\n  In every case the number to publish is the gain over MATERIAL, because that is the")
    print("  baseline a reviewer will construct in thirty seconds.")


if __name__ == "__main__":
    main()
