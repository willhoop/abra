"""pory_nn.py — does a neural network actually beat counting Pokemon?

WHAT A NEURAL NETWORK IS, IN THIS PROJECT'S TERMS
=================================================
Every model here answers one question: given the board right now, what is P(I win)? PORY answers it
with LOGISTIC REGRESSION — it multiplies each feature by a weight, adds them up, and squashes the
total into 0..1:

    p = sigmoid(w0 + w1*alive_diff + w2*hp_diff + ...)

That can only ever draw a straight dividing line through feature space. It cannot express "being one
Pokemon ahead matters enormously at turn 3 and barely at turn 25", because that is an INTERACTION
between two features, and a sum of independent terms has no way to say it.

A neural network is the same idea with a middle step. The inputs are combined into H hidden units,
each of which is its own weighted sum passed through a nonlinearity (here ReLU: max(0, x)), and the
hidden units are then combined into the final probability:

    h = relu(W1 @ x + b1)          # H learned intermediate quantities
    p = sigmoid(W2 @ h + b2)

Each hidden unit is free to become a detector for a CONJUNCTION — "ahead on material AND my active
Pokemon is faster AND Trick Room is not up" — and the output layer weighs those detectors. That is
the entire difference. Universal approximation (Cybenko 1989; Hornik 1991) says a single hidden layer
of sufficient width can represent any continuous function on a bounded domain, so with enough units
and enough data the network is strictly more expressive than the linear model.

WHY THIS IS NOT AUTOMATICALLY AN IMPROVEMENT, WHICH IS THE POINT OF THIS FILE
----------------------------------------------------------------------------
"Strictly more expressive" is a statement about what the model CAN represent, not about what it will
learn from a finite sample. Extra capacity spent on a feature set that contains no interactions buys
nothing and costs variance. engine/pory_baseline.py already established the relevant fact: PORY's six
material features are beaten by TWO of them (alive_diff + hp_diff, 0.5822 vs 0.5840). If the features
carry no more signal, a network fit to them will land in the same place, and reporting otherwise
would be measuring the estimator rather than the game.

So this file runs the network on BOTH feature sets and reports both:

    material  — PORY's own six, so network-vs-linear is isolated with features held fixed
    rich      — engine/state_encoder.py: HP per slot, active vs benched, status, boosts,
                weather/terrain/Trick Room/Tailwind/screens, hazards, active types

If the network wins on `material`, the gain is nonlinearity. If it wins only on `rich`, the gain is
representation, and the honest conclusion is that PORY was feature-starved rather than model-starved.
If it wins on neither, that is the result and it gets reported as such.

THE ARMS
--------
    B0  coin                        the floor, 0.6931
    B1  alive_diff                  one feature, fitted
    B2  alive_diff + hp_diff        the baseline PORY has to beat (0.5822)
    B3  sign(alive_diff)            the strawman the old docs compared against
    L6  logistic, PORY's six        PORY itself
    LR  logistic, rich features     is it the features?
    N6  network, PORY's six         is it the model?
    NR  network, rich features      both

METHOD, held identical across every arm so only the named thing varies
----------------------------------------------------------------------
  - Split by GAME (hashed id), never by state. Turns within a game share an outcome, so splitting on
    states leaks the label across the boundary and flatters every arm. 60/20/20 train/val/test.
  - Validation set is used ONLY for early stopping and to pick the hidden width. The test set is
    touched once, at the end.
  - Features standardised on TRAIN statistics only.
  - Both perspectives of a state always land in the same fold (they carry the same game id).
  - Reported: log-loss (the training objective and the honest scoring rule), accuracy, AUC, and
    calibration error, because a win-probability model that is confidently wrong is worse than useless.

    python engine/pory_nn.py                     # ladder only
    python engine/pory_nn.py --selfplay          # ladder + self-play corpus
    python engine/pory_nn.py --selfplay-only
"""
import os, sys, json, math, argparse
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from state_encoder import encode_log, winner_side, FEATURE_NAMES, ENCODER_VERSION

LADDER_RAW = os.path.join(ROOT, "data", "games.ladder.raw-logs.jsonl")
SELFPLAY_RAW = os.path.join(ROOT, "data", "games.selfplay.raw-logs.jsonl")
OUT = os.path.join(ROOT, "data", "pory-nn.json")

rng = np.random.default_rng(0)


# ---------------------------------------------------------------------------------------------
def split_of(gid):
    """Deterministic 60/20/20 split by game id. Same hash family as pory_baseline.py."""
    h = 0
    for ch in str(gid):
        h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    r = h % 10
    return "train" if r < 6 else ("val" if r < 8 else "test")


def material_view(x, names):
    """PORY's own six features, pulled out of the rich vector so both arms see identical rows."""
    ix = [names.index(n) for n in ["bias", "me_alive", "foe_alive", "alive_diff", "hp_diff", "turn_norm"]]
    return x[:, ix]


def clean_ids():
    """Game ids that survive the quality filter, for --clean.

    WHY THIS IS A JOIN AND NOT A FLAG. The whole PORY family reads the RAW LOG archive, whose
    records are {id, uploadtime, log} — the schema carries no `bot` and no `forfeit` field, so the
    filter cannot be applied where the data is read. Every PORY number ever published was therefore
    computed on the unfiltered population: roughly three-quarters bot games, and every rage-quit.

    That matters more than it sounds. A forfeit records who QUIT, not who was winning — and people
    quit precisely when they are behind on material, which is exactly what this model predicts from.
    Including forfeits does not add noise, it adds a circular label. It is also the identical
    mechanism that already dissolved WAR and the 55% skill ceiling, the project's two previous
    headline retractions.

    So the ids are taken from the filtered store and used as a whitelist against the log archive.
    Returns None if the store is unavailable, and the caller then refuses to claim it ran clean.
    """
    try:
        sys.path.insert(0, HERE)
        from store import load_games
        return {g.get("id") for g in load_games(clean=True, announce=False) if g.get("id")}
    except Exception as e:
        print(f"  could not load the filtered store ({e}) — cannot run clean")
        return None


def load(paths, limit=None, keep=None):
    X, Y, G = [], [], []
    seen = 0
    dropped = 0
    for path in paths:
        if not os.path.exists(path):
            print(f"  (missing {os.path.relpath(path, ROOT)} — skipped)")
            continue
        n_games = 0
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                except json.JSONDecodeError:
                    continue
                log = r.get("log", "")
                rows = encode_log(log)
                if not rows:
                    continue
                gid = r.get("id") or f"g{seen}"
                if keep is not None and gid not in keep:
                    dropped += 1
                    continue
                for v, y in rows:
                    X.append(v); Y.append(y); G.append(gid)
                n_games += 1
                seen += 1
                if limit and n_games >= limit:
                    break
        print(f"  {os.path.basename(path)}: {n_games:,} games"
              + (f"  ({dropped:,} dropped by the quality filter)" if keep is not None else ""))
    if not X:
        return None
    return np.asarray(X, dtype=np.float32), np.asarray(Y, dtype=np.float32), np.asarray(G)


# ---------------------------------------------------------------------------------------------
def logloss(p, y, eps=1e-9):
    p = np.clip(p, eps, 1 - eps)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def auc(p, y):
    """Rank-based AUC; ties averaged."""
    order = np.argsort(p)
    ranks = np.empty(len(p), dtype=np.float64)
    ranks[order] = np.arange(1, len(p) + 1)
    # average ranks over ties
    sp = p[order]
    i = 0
    while i < len(sp):
        j = i
        while j + 1 < len(sp) and sp[j + 1] == sp[i]:
            j += 1
        if j > i:
            ranks[order[i:j + 1]] = (i + 1 + j + 1) / 2.0
        i = j + 1
    npos, nneg = float(y.sum()), float((1 - y).sum())
    if npos == 0 or nneg == 0:
        return float("nan")
    return float((ranks[y == 1].sum() - npos * (npos + 1) / 2) / (npos * nneg))


def calibration(p, y, bins=10):
    """Mean |predicted - observed| over equal-width probability bins, weighted by bin size."""
    err, tot = 0.0, 0
    for b in range(bins):
        lo, hi = b / bins, (b + 1) / bins
        m = (p >= lo) & (p < hi if b < bins - 1 else p <= hi)
        if m.sum() == 0:
            continue
        err += abs(p[m].mean() - y[m].mean()) * m.sum()
        tot += m.sum()
    return float(err / max(1, tot))


# ---------------------------------------------------------------------------------------------
def fit_logistic(Xtr, ytr, Xva, yva, l2=1e-4, iters=400, lr=0.5):
    """Plain full-batch gradient descent with L2, early-stopped on validation log-loss."""
    n, d = Xtr.shape
    w = np.zeros(d, dtype=np.float64)
    best, bestw, bad = float("inf"), w.copy(), 0
    for it in range(iters):
        z = Xtr @ w
        p = 1 / (1 + np.exp(-np.clip(z, -30, 30)))
        g = Xtr.T @ (p - ytr) / n + l2 * w
        w -= lr * g
        if it % 5 == 0:
            pv = 1 / (1 + np.exp(-np.clip(Xva @ w, -30, 30)))
            L = logloss(pv, yva)
            if L < best - 1e-6:
                best, bestw, bad = L, w.copy(), 0
            else:
                bad += 1
                if bad >= 12:
                    break
    return bestw


def predict_logistic(w, X):
    return 1 / (1 + np.exp(-np.clip(X @ w, -30, 30)))


class MLP:
    """One hidden layer, ReLU, sigmoid output, Adam, early stopping on validation log-loss.

    Deliberately small and written out rather than pulled from a framework: the project has no torch
    dependency, the model must stay inspectable, and at this data scale a wide single layer is the
    right capacity. Depth is not the missing ingredient when the input is ~130 features.
    """

    def __init__(self, d, hidden=64, seed=0, l2=1e-5):
        g = np.random.default_rng(seed)
        # He initialisation, correct for ReLU
        self.W1 = g.normal(0, math.sqrt(2.0 / d), size=(d, hidden))
        self.b1 = np.zeros(hidden)
        self.W2 = g.normal(0, math.sqrt(2.0 / hidden), size=hidden)
        self.b2 = 0.0
        self.l2 = l2

    def forward(self, X):
        h = np.maximum(0.0, X @ self.W1 + self.b1)
        z = h @ self.W2 + self.b2
        return h, 1 / (1 + np.exp(-np.clip(z, -30, 30)))

    def predict(self, X):
        return self.forward(X)[1]

    def fit(self, Xtr, ytr, Xva, yva, epochs=120, batch=512, lr=3e-3, patience=12, verbose=False):
        n = len(Xtr)
        params = ["W1", "b1", "W2", "b2"]
        m = {k: np.zeros_like(np.atleast_1d(getattr(self, k)), dtype=np.float64) for k in params}
        v = {k: np.zeros_like(np.atleast_1d(getattr(self, k)), dtype=np.float64) for k in params}
        t = 0
        best, bad = float("inf"), 0
        bestp = {k: np.copy(getattr(self, k)) for k in params}
        g = np.random.default_rng(1)
        for ep in range(epochs):
            idx = g.permutation(n)
            for s in range(0, n, batch):
                b = idx[s:s + batch]
                Xb, yb = Xtr[b], ytr[b]
                h, p = self.forward(Xb)
                nb = len(b)
                dz = (p - yb) / nb
                gW2 = h.T @ dz + self.l2 * self.W2
                gb2 = dz.sum()
                dh = np.outer(dz, self.W2) * (h > 0)
                gW1 = Xb.T @ dh + self.l2 * self.W1
                gb1 = dh.sum(axis=0)
                t += 1
                for k, gr in (("W1", gW1), ("b1", gb1), ("W2", gW2), ("b2", np.atleast_1d(gb2))):
                    cur = np.atleast_1d(getattr(self, k)).astype(np.float64)
                    m[k] = 0.9 * m[k] + 0.1 * gr
                    v[k] = 0.999 * v[k] + 0.001 * (gr ** 2)
                    mh = m[k] / (1 - 0.9 ** t)
                    vh = v[k] / (1 - 0.999 ** t)
                    upd = cur - lr * mh / (np.sqrt(vh) + 1e-8)
                    setattr(self, k, upd if k != "b2" else float(upd[0]))
            L = logloss(self.predict(Xva), yva)
            if L < best - 1e-6:
                best, bad = L, 0
                bestp = {k: np.copy(getattr(self, k)) for k in params}
            else:
                bad += 1
                if bad >= patience:
                    break
            if verbose and ep % 10 == 0:
                print(f"    epoch {ep:3d}  val logloss {L:.4f}")
        for k in params:
            setattr(self, k, bestp[k])
        return best


# ---------------------------------------------------------------------------------------------
def standardise(Xtr, *others):
    """Standardise on TRAIN statistics, in float32, in place.

    MEMORY MATTERS HERE AND IT KILLED A RUN. numpy's mean/std return float64, so the natural
    expression `(X - mu) / sd` silently PROMOTES a float32 matrix to float64 and allocates a fresh
    copy. At 1.4M states x 121 features that is 680MB -> 1.36GB per array, three arrays, on top of the
    original — roughly 5GB for what should be 2, and the process was killed with no traceback and no
    output. Casting the statistics to float32 and dividing in place keeps it flat.
    """
    mu = Xtr.mean(axis=0, dtype=np.float64).astype(np.float32)
    sd = Xtr.std(axis=0, dtype=np.float64).astype(np.float32)
    sd[sd < 1e-8] = 1.0
    # keep the bias column a constant 1
    if FEATURE_NAMES and FEATURE_NAMES[0] == "bias":
        mu[0], sd[0] = np.float32(0.0), np.float32(1.0)
    out = []
    for O in (Xtr,) + others:
        O -= mu          # in place, stays float32
        O /= sd
        out.append(O)
    return out


def evaluate(name, p, y, rows):
    rows.append({
        "arm": name,
        "logloss": round(logloss(p, y), 4),
        "acc": round(float(((p >= 0.5) == (y == 1)).mean()), 4),
        "auc": round(auc(p, y), 4),
        "calib": round(calibration(p, y), 4),
    })
    return rows[-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selfplay", action="store_true", help="include the self-play corpus")
    ap.add_argument("--selfplay-only", action="store_true")
    ap.add_argument("--limit", type=int, default=None, help="cap games per source")
    ap.add_argument("--hidden", type=int, default=0, help="0 = pick by validation")
    # CLEAN IS THE DEFAULT. It used to be opt-in via --clean, which made the LAZY path the WRONG
    # path: a plain run trained on the raw archive, and data/pory-nn.json ended up declaring 61,274
    # games against a clean store of ~2,000. Its numbers were then quoted as PORY's honest standing.
    #
    # Every other model here already does it the right way round -- guru.py, archetypes.py,
    # counterplay.py and nmf_roles.py all filter by default and take ABRA_UNFILTERED=1 to opt out.
    # This is now the same, and the artifact records which way it ran so nobody has to guess again.
    ap.add_argument("--unfiltered", action="store_true",
                    help="train on the RAW archive including bots and forfeits (for comparison only)")
    ap.add_argument("--transfer", action="store_true",
                    help="train on self-play ONLY, evaluate on ladder ONLY (the transfer test)")
    args = ap.parse_args()

    paths = []
    if args.selfplay_only:
        paths = [SELFPLAY_RAW]
    elif args.selfplay:
        paths = [LADDER_RAW, SELFPLAY_RAW]
    else:
        paths = [LADDER_RAW]

    print(f"PORY-NN  (state encoder v{ENCODER_VERSION}, {len(FEATURE_NAMES)} features)")
    print("loading:")
    keep = None
    if (not args.unfiltered):
        keep = clean_ids()
        if keep is None:
            print("REFUSING to run: --clean was requested and the filter could not be applied.")
            return
        print(f"  quality filter: {len(keep):,} games pass (no bot detected, no forfeit)")
    if args.transfer:
        # ---- THE TRANSFER TEST -------------------------------------------------------------
        # Train ONLY on self-play, evaluate ONLY on real human games. This is the experiment that
        # decides whether generating self-play at scale is worth doing at all.
        #
        # Every previous run mixed the two, which cannot answer the question: with ~86% of the rows
        # coming from self-play, the model was largely being graded on the same fixed prior policy
        # it was fitted to. A corpus that predicts itself proves nothing about human play.
        #
        # The self-play policy never looks at the board — it samples moves by how often they get
        # used — so the honest prior is that it learns the FORMAT'S PHYSICS (what a position turns
        # into) rather than the pressure of a real game. Written down before the run:
        #   docs/THEORY.md prediction 1 — "a value net trained only on self-play will transfer
        #   poorly to human games, beating B2 by less on ladder than it does on self-play."
        # If it transfers well, the 1M-game run is justified immediately.
        #
        # The ladder side is filtered (no bots, no forfeits) whenever --clean is given, because a
        # test set full of rage-quits would flatter any material model. Held-out is the WHOLE
        # ladder set: none of it was seen in training, so no split is needed on that side.
        sp_got = load([SELFPLAY_RAW], args.limit)
        if sp_got is None:
            print("no self-play corpus — run engine/mew_farm.js first"); return
        Xs, Ys, Gs = sp_got
        la_got = load([LADDER_RAW], args.limit, keep=keep)
        if la_got is None:
            print("no ladder corpus"); return
        Xl, Yl, Gl = la_got

        # a validation slice out of SELF-PLAY only — the ladder set must stay untouched
        s_sp = np.array([split_of(g) for g in Gs])
        s_tr, s_va = s_sp != "test", s_sp == "test"
        X = np.concatenate([Xs, Xl]); Y = np.concatenate([Ys, Yl])
        G = np.concatenate([Gs, Gl])
        n_sp = len(Xs)
        tr = np.zeros(len(X), bool); va = np.zeros(len(X), bool); te = np.zeros(len(X), bool)
        tr[:n_sp] = s_tr; va[:n_sp] = s_va; te[n_sp:] = True
        n_games = len(set(G.tolist()))
        print(f"  TRANSFER: train on SELF-PLAY ({s_tr.sum():,} states, {len(set(Gs.tolist())):,} games)")
        print(f"            test  on LADDER    ({te.sum():,} states, {len(set(Gl.tolist())):,} games"
              + (", quality-filtered" if keep else ", UNFILTERED") + ")")
        del Xs, Xl, sp_got, la_got
    else:
        got = load(paths, args.limit, keep=keep)
        if got is None:
            print("no data — nothing to do"); return
        X, Y, G = got

        sp = np.array([split_of(g) for g in G])
        tr, va, te = sp == "train", sp == "val", sp == "test"
        n_games = len(set(G.tolist()))
    print(f"  {len(X):,} board states from {n_games:,} games "
          f"({tr.sum():,} train / {va.sum():,} val / {te.sum():,} test)")
    print(f"  base rate: {Y.mean():.4f} (0.5 expected — both perspectives are emitted)")

    Xtr_r, Xva_r, Xte_r = standardise(X[tr], X[va], X[te])
    ytr, yva, yte = Y[tr], Y[va], Y[te]
    # X is no longer needed and is the largest single allocation; drop it before training.
    # Capture what the report needs FIRST — deleting X and then reading len(X) in the JSON dump
    # threw UnboundLocalError after a 50-minute run had already produced every number.
    n_states = int(len(X))
    del X
    import gc; gc.collect()
    print(f"  feature matrices: {Xtr_r.nbytes/2**20:.0f} + {Xva_r.nbytes/2**20:.0f} + "
          f"{Xte_r.nbytes/2**20:.0f} MB ({Xtr_r.dtype})")

    Xtr_m = material_view(Xtr_r, FEATURE_NAMES)
    Xva_m = material_view(Xva_r, FEATURE_NAMES)
    Xte_m = material_view(Xte_r, FEATURE_NAMES)

    names = FEATURE_NAMES
    col = lambda M, n: M[:, [names.index(n)]]
    rows = []

    # --- B0 coin -------------------------------------------------------------------------------
    evaluate("B0  coin", np.full(te.sum(), 0.5), yte, rows)

    # --- B1 alive_diff only --------------------------------------------------------------------
    A_tr = np.hstack([np.ones((tr.sum(), 1)), col(Xtr_r, "alive_diff")])
    A_va = np.hstack([np.ones((va.sum(), 1)), col(Xva_r, "alive_diff")])
    A_te = np.hstack([np.ones((te.sum(), 1)), col(Xte_r, "alive_diff")])
    w = fit_logistic(A_tr, ytr, A_va, yva)
    evaluate("B1  alive_diff", predict_logistic(w, A_te), yte, rows)

    # --- B2 alive_diff + hp_diff — THE BASELINE TO BEAT -----------------------------------------
    B_tr = np.hstack([np.ones((tr.sum(), 1)), col(Xtr_r, "alive_diff"), col(Xtr_r, "hp_diff")])
    B_va = np.hstack([np.ones((va.sum(), 1)), col(Xva_r, "alive_diff"), col(Xva_r, "hp_diff")])
    B_te = np.hstack([np.ones((te.sum(), 1)), col(Xte_r, "alive_diff"), col(Xte_r, "hp_diff")])
    w = fit_logistic(B_tr, ytr, B_va, yva)
    evaluate("B2  alive_diff+hp_diff", predict_logistic(w, B_te), yte, rows)

    # --- B3 sign(alive_diff) -------------------------------------------------------------------
    S_tr = np.hstack([np.ones((tr.sum(), 1)), np.sign(col(Xtr_r, "alive_diff"))])
    S_va = np.hstack([np.ones((va.sum(), 1)), np.sign(col(Xva_r, "alive_diff"))])
    S_te = np.hstack([np.ones((te.sum(), 1)), np.sign(col(Xte_r, "alive_diff"))])
    w = fit_logistic(S_tr, ytr, S_va, yva)
    evaluate("B3  sign(alive_diff)", predict_logistic(w, S_te), yte, rows)

    # --- L6 logistic on PORY's six --------------------------------------------------------------
    w = fit_logistic(Xtr_m, ytr, Xva_m, yva)
    evaluate("L6  logistic, material", predict_logistic(w, Xte_m), yte, rows)

    # --- LR logistic on rich features ------------------------------------------------------------
    w = fit_logistic(Xtr_r, ytr, Xva_r, yva, iters=800)
    evaluate("LR  logistic, rich", predict_logistic(w, Xte_r), yte, rows)

    # --- N6 / NR networks -------------------------------------------------------------------------
    widths = [args.hidden] if args.hidden else [16, 32, 64, 128]
    for tag, Xa, Xb, Xc in (("N6  network, material", Xtr_m, Xva_m, Xte_m),
                            ("NR  network, rich", Xtr_r, Xva_r, Xte_r)):
        best = (float("inf"), None, None)
        for h in widths:
            net = MLP(Xa.shape[1], hidden=h, seed=7)
            vL = net.fit(Xa, ytr, Xb, yva)
            if vL < best[0]:
                best = (vL, net, h)
        vL, net, h = best
        r = evaluate(tag, net.predict(Xc), yte, rows)
        r["hidden"] = h
        r["val_logloss"] = round(vL, 4)

    # --- report ------------------------------------------------------------------------------------
    print()
    print(f"{'arm':<26}{'logloss':>9}{'acc':>8}{'auc':>8}{'calib':>8}")
    b2 = next(r for r in rows if r["arm"].startswith("B2"))
    for r in rows:
        flag = ""
        if r["arm"][0] in "LN":
            flag = "  BEATS B2" if r["logloss"] < b2["logloss"] else "  loses to B2"
        print(f"{r['arm']:<26}{r['logloss']:>9.4f}{r['acc']:>8.4f}{r['auc']:>8.4f}{r['calib']:>8.4f}{flag}")

    nr = next(r for r in rows if r["arm"].startswith("NR"))
    n6 = next(r for r in rows if r["arm"].startswith("N6"))
    lr = next(r for r in rows if r["arm"].startswith("LR"))
    print()
    print("INTERPRETATION")
    print(f"  nonlinearity alone (N6 vs L6, material only) : {n6['logloss']:.4f} vs "
          f"{next(r for r in rows if r['arm'].startswith('L6'))['logloss']:.4f}")
    print(f"  representation alone (LR vs L6, linear only) : {lr['logloss']:.4f} vs "
          f"{next(r for r in rows if r['arm'].startswith('L6'))['logloss']:.4f}")
    print(f"  both (NR)                                    : {nr['logloss']:.4f}")
    print(f"  the bar (B2, two material features)          : {b2['logloss']:.4f}")

    json.dump({
        "encoder_version": ENCODER_VERSION,
        "n_features": len(FEATURE_NAMES),
        "sources": [os.path.relpath(p, ROOT) for p in paths if os.path.exists(p)],
        "n_states": n_states, "n_games": int(n_games),
        "split": {"train": int(tr.sum()), "val": int(va.sum()), "test": int(te.sum())},
        "arms": rows,
    }, open(OUT, "w"), indent=1)   # data/pory-nn.json
    print(f"\nwrote {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
