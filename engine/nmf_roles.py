#!/usr/bin/env python3
"""nmf_roles.py — EMERGENT roles, discovered from data instead of hand-declared.

Idea (Lee & Seung 1999, Nature; topic models / LDA, Blei 2003):
Represent every team-side of every game as a distribution over the moves it actually USED in battle
(usage-weighted, so the closed-sheet censoring skew is handled — a move nobody clicks weighs ~0).
Non-negative Matrix Factorization factors that big (documents x moves) table into R latent ROLES:
    X  (docs x moves)  ~=  W (docs x roles) @ H (roles x moves)
Because nothing is negative, a team is a SUM of roles ("40% sun + 30% Trick Room + ..."), and each
role is a non-negative recipe over moves. H's rows ARE the discovered roles; a move's loading on a
role is LEARNED, not typed — this is where the primary/secondary weights legitimately come from
(Label Distribution Learning, Geng 2016: real-valued description degrees, derived not asserted).

Output: data/nmf-roles.json (+ data/nmf.js for the site). Factors are UNLABELED by design — the model
finds the clusters, a human names them. We attach a *suggested* label by overlap with the curated
roles, but it is only a hint.

    python3 engine/nmf_roles.py [rank]      # default rank 10
Read-only on the store.
"""
import json, os, sys, math
import numpy as np
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
STORE = D("data", "games.ladder.jsonl")

import importlib.util
spec = importlib.util.spec_from_file_location("roles", D("engine", "roles.py"))
roles = importlib.util.module_from_spec(spec); spec.loader.exec_module(roles)

RANK = int(sys.argv[1]) if len(sys.argv) > 1 else 10
MIN_USE = 40            # a move must be used >= this many times across all games to be a column
NEUTRAL = {"Protect","Detect","Substitute","Endure","Spiky Shield"}

def load_games():
    with open(STORE, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line: continue
            try: yield json.loads(line)
            except Exception: continue

def build():
    games = list(load_games())
    # per game-side move-usage counts (documents)
    docs = []                       # list of Counter(move -> uses by that side in that game)
    use_total = Counter()
    for g in games:
        d1, d2 = Counter(), Counter()
        for t in (g.get("turns") or []):
            for e in t.get("ev", []):
                if e.get("t") == "m" and e.get("mv"):
                    side = e.get("s","")[:2]
                    mv = e["mv"]
                    if mv in NEUTRAL: continue
                    (d1 if side == "p1" else d2)[mv] += 1
                    use_total[mv] += 1
        if d1: docs.append(d1)
        if d2: docs.append(d2)

    vocab = sorted([m for m, c in use_total.items() if c >= MIN_USE])
    vi = {m: i for i, m in enumerate(vocab)}
    M = len(vocab)

    X = np.zeros((len(docs), M), dtype=np.float64)
    for r, d in enumerate(docs):
        for m, c in d.items():
            if m in vi: X[r, vi[m]] = c
    # row-normalize -> each team is a distribution over moves (long games don't dominate)
    rs = X.sum(axis=1, keepdims=True); rs[rs == 0] = 1.0
    X = X / rs
    # NOTE: TF-IDF column weighting was tested (down-weighting ubiquitous moves); it raised
    # reconstruction error (0.88 vs 0.79) without cleaner separation, so raw usage is kept.
    # Honest read: at the team level the dominant axis of variation is offensive core + speed
    # control, not tidy support roles — the factors reflect that.

    # ---- NMF (sklearn if present, else multiplicative-update Lee & Seung) ----
    try:
        from sklearn.decomposition import NMF
        model = NMF(n_components=RANK, init="nndsvda", max_iter=500, random_state=7)
        W = model.fit_transform(X); H = model.components_
        err = model.reconstruction_err_ / np.linalg.norm(X)
    except Exception:
        rng = np.random.default_rng(7)
        W = rng.random((X.shape[0], RANK)) + 1e-3
        H = rng.random((RANK, M)) + 1e-3
        for _ in range(300):
            H *= (W.T @ X) / (W.T @ W @ H + 1e-9)
            W *= (X @ H.T) / (W @ H @ H.T + 1e-9)
        err = np.linalg.norm(X - W @ H) / np.linalg.norm(X)

    # curated-role signal sets for the suggested-label hint
    role_moves = {}
    for r, sig in roles.ROLE_SIGNALS.items():
        s = set(sig.get("moves", set()))
        if r == "phys_attacker": s = roles.PHYS
        if r == "spec_attacker": s = roles.SPEC
        role_moves[r] = s

    prevalence = W.sum(axis=0)                       # how much each role is used overall
    order = list(np.argsort(-prevalence))
    factors = []
    for rank_i, k in enumerate(order):
        h = H[k].copy()
        top_idx = list(np.argsort(-h)[:12])
        tot = float(h[top_idx].sum()) or 1.0
        top = [dict(move=vocab[i], loading=round(float(h[i])/tot, 3)) for i in top_idx if h[i] > 0]
        # suggested label: curated role whose signal set best covers the top moves
        top_set = {t["move"] for t in top[:8]}
        best, bestov = None, 0
        for r, s in role_moves.items():
            ov = len(top_set & s)
            if ov > bestov: best, bestov = r, ov
        factors.append(dict(
            id=f"R{rank_i+1}", prevalence=round(float(prevalence[k]/prevalence.sum()), 3),
            suggested_label=(roles.ROLE_SIGNALS[best]["label"] if best else "(unnamed — you label it)"),
            suggested_role=best, overlap=bestov, top_moves=top))

    out = dict(
        generated=__import__("datetime").date.today().isoformat(),
        method=("Non-negative Matrix Factorization of the usage-weighted (team-side x move) matrix. "
                "Roles are discovered, not declared; a move's loading is learned. Rank and labels are "
                "the two human choices — factors are auto-suggested a name by curated-role overlap only."),
        rank=RANK, n_documents=len(docs), n_moves=M, min_move_uses=MIN_USE,
        reconstruction_error_ratio=round(float(err), 4),
        factors=factors)
    json.dump(out, open(D("data", "nmf-roles.json"), "w"), indent=1)
    with open(D("data", "nmf.js"), "w") as f:
        f.write("window.NMF=" + json.dumps(out) + ";\n")

    print(f"nmf_roles.py — rank {RANK}, {len(docs):,} team-docs, {M} moves, recon-err {err:.3f}")
    for fac in factors:
        tops = " ".join(t["move"] for t in fac["top_moves"][:6])
        print(f"  {fac['id']} ~{int(fac['prevalence']*100):2d}%  [{fac['suggested_label']}]  {tops}")
    return out

if __name__ == "__main__":
    build()
