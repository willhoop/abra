#!/usr/bin/env python3
"""
nmf_rank.py — choose the NMF rank by a criterion instead of by eye.

    python engine/nmf_rank.py            ->  data/nmf-rank-selection.json

WHY THIS EXISTS
---------------
`engine/nmf_roles.py:154` hard-codes `ARCH_RANK = 6`, and `docs/MODELS.md` concedes the point:
"Rank and the human names are the only non-data choices; rigorous rank/weighting selection by topic
coherence (Mimno 2011) is the noted next refinement."

Two successive thesis defences called that out, and the second was blunt about it: "next" is not a
justification, and a citation to the method you did not use is decorative by construction. Six
interpretable archetypes is a post-hoc aesthetic judgement, and it currently carries downstream
matchup claims.

WHY STABILITY RATHER THAN COHERENCE
-----------------------------------
Mimno's topic coherence is designed for LDA over word co-occurrence, where a topic's top words have
a document-frequency structure the metric exploits. Here the "documents" are teams and the
"vocabulary" is roles — a much smaller, denser matrix — and coherence transfers awkwardly.

Bootstrap factor stability is the standard criterion for NMF specifically (Brunet et al. 2004 use
the closely related cophenetic correlation over consensus matrices), and it asks the question that
actually matters for this project: **if I had collected a different sample of games, would I have
found the same archetypes?** A rank whose factors do not reproduce across resamples is describing
this sample, not the metagame.

Reconstruction error cannot select the rank and the project already knows why: it falls
monotonically with rank by construction, and MODELS.md notes it is not comparable across
weightings. It is reported here beside stability so the two can be read together, not instead.

HOW IT WORKS
------------
For each candidate rank: fit NMF on two independent bootstrap resamples of the rows, then match the
two factor sets greedily by cosine similarity and report the mean similarity of matched pairs.
1.0 means the same structure was recovered twice; 0.5 means the factorisation is largely reading
noise. Repeated over several bootstrap pairs and averaged, because a single pair is itself a
coin flip.

WHAT THIS DOES NOT DO. It does not name the archetypes and it does not claim the selected rank is
"true". It answers one question — at which rank does the structure stop reproducing — and that is
the question that decides whether the archetype claims survive.
"""
import json, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
OUT = os.path.join(ROOT, "data", "nmf-rank-selection.json")

RANKS = list(range(2, 13))
PAIRS = 6          # bootstrap pairs per rank
ITERS = 300
rng_global = np.random.default_rng(20260728)


def fit_nmf(X, rank, iters=ITERS, seed=7):
    """Identical multiplicative-update NMF to engine/nmf_roles.py, so the selection is made on the
    same estimator that will be used. Copying the estimator is deliberate: selecting a rank with a
    different fitter would answer a different question."""
    rng = np.random.default_rng(seed)
    W = rng.random((X.shape[0], rank)) + 1e-3
    H = rng.random((rank, X.shape[1])) + 1e-3
    for _ in range(iters):
        H *= (W.T @ X) / (W.T @ W @ H + 1e-9)
        W *= (X @ H.T) / (W @ H @ H.T + 1e-9)
    err = float(np.linalg.norm(X - W @ H) / (np.linalg.norm(X) + 1e-12))
    return W, H, err


def match_stability(H1, H2):
    """Greedy one-to-one matching of two factor sets by cosine similarity; returns the mean
    similarity of the matched pairs. Greedy rather than Hungarian because at these ranks the two
    agree in practice and greedy carries no dependency."""
    A = H1 / (np.linalg.norm(H1, axis=1, keepdims=True) + 1e-12)
    B = H2 / (np.linalg.norm(H2, axis=1, keepdims=True) + 1e-12)
    S = A @ B.T
    taken_r, taken_c, sims = set(), set(), []
    order = np.dstack(np.unravel_index(np.argsort(-S, axis=None), S.shape))[0]
    for i, j in order:
        if i in taken_r or j in taken_c:
            continue
        taken_r.add(int(i)); taken_c.add(int(j)); sims.append(float(S[i, j]))
        if len(sims) == min(S.shape):
            break
    return float(np.mean(sims)) if sims else 0.0


def build_matrix():
    """The team x ROLE matrix — the cut nmf_roles.py calls the clean one and from which the
    archetypes are taken. Rebuilt here from the same sources rather than imported, because
    nmf_roles.py performs its factorisation at import time."""
    import importlib.util as ilu
    spec = ilu.spec_from_file_location("quality", os.path.join(HERE, "quality.py"))
    quality = ilu.module_from_spec(spec); spec.loader.exec_module(quality)
    games = quality.load_games(clean=True)

    with open(os.path.join(ROOT, "data", "pokemon-roles.json"), encoding="utf-8") as fh:
        roles_raw = json.load(fh)
    dex = roles_raw.get("species", roles_raw)

    def sid(x):
        return "".join(c for c in str(x).lower() if c.isalnum())

    vocab = set()
    for v in dex.values():
        r = v.get("roles", v) if isinstance(v, dict) else {}
        if isinstance(r, dict):
            vocab.update(k for k, val in r.items() if isinstance(val, (int, float)))
    vocab = sorted(vocab)
    if not vocab:
        return None, []
    vi = {r: i for i, r in enumerate(vocab)}

    rows = []
    for g in games:
        six = (g.get("six") or {})
        for side in ("p1", "p2"):
            team = six.get(side) or []
            if len(team) < 6:
                continue
            vec = np.zeros(len(vocab))
            any_ = False
            for mon in team:
                e = dex.get(sid(mon))
                r = (e.get("roles", e) if isinstance(e, dict) else None) if e else None
                if not isinstance(r, dict):
                    continue
                for k, val in r.items():
                    if k in vi and isinstance(val, (int, float)):
                        vec[vi[k]] += float(val); any_ = True
            if any_:
                rows.append(vec)
    X = np.array(rows)
    s = X.sum(1, keepdims=True); s[s == 0] = 1
    return X / s, vocab


def main():
    X, vocab = build_matrix()
    if X is None or not len(X):
        print("nmf_rank: could not build the team x role matrix — aborting rather than guessing.")
        return
    print("NMF RANK SELECTION — at which rank does the structure stop reproducing?\n")
    print(f"  matrix {X.shape[0]:,} team-sides x {X.shape[1]} roles, {PAIRS} bootstrap pairs per rank\n")
    print("  rank   stability   recon err   ")
    print("  " + "-" * 40)
    results = []
    n = X.shape[0]
    for rank in RANKS:
        sims, errs = [], []
        for p in range(PAIRS):
            i1 = rng_global.integers(0, n, n)
            i2 = rng_global.integers(0, n, n)
            _, H1, e1 = fit_nmf(X[i1], rank, seed=1000 + p)
            _, H2, e2 = fit_nmf(X[i2], rank, seed=2000 + p)
            sims.append(match_stability(H1, H2))
            errs.append((e1 + e2) / 2)
        st, er = float(np.mean(sims)), float(np.mean(errs))
        results.append(dict(rank=rank, stability=round(st, 4), recon_err=round(er, 4)))
        bar = "#" * int(round(st * 30))
        print(f"  {rank:>4}   {st:>9.4f}   {er:>9.4f}   {bar}")

    # --- THE NOISE FLOOR, WITHOUT WHICH NONE OF THE ABOVE MEANS ANYTHING ------------------------
    # Cosine similarity between NON-NEGATIVE vectors is bounded below by 0 and is naturally high --
    # everything lives in the positive orthant. So a raw stability of 0.81 is uninterpretable on its
    # own, and the first version of this file reported exactly that. The same objection the thesis
    # defence raised against reconstruction error applies to any similarity score without a null.
    #
    # The null: shuffle each COLUMN independently. That destroys the row-wise co-occurrence structure
    # NMF is supposed to find while preserving every column marginal exactly, so any stability that
    # survives is an artefact of the geometry and the marginals rather than real archetype structure.
    print("")
    print("  computing the null floor (columns shuffled independently)...", flush=True)
    Xn = X.copy()
    for c in range(Xn.shape[1]):
        rng_global.shuffle(Xn[:, c])
    for r in results:
        sims_n = []
        for p_ in range(max(2, PAIRS // 2)):
            j1 = rng_global.integers(0, n, n)
            j2 = rng_global.integers(0, n, n)
            _, Hn1, _ = fit_nmf(Xn[j1], r["rank"], seed=3000 + p_)
            _, Hn2, _ = fit_nmf(Xn[j2], r["rank"], seed=4000 + p_)
            sims_n.append(match_stability(Hn1, Hn2))
        r["null_stability"] = round(float(np.mean(sims_n)), 4)
        r["excess_over_null"] = round(r["stability"] - r["null_stability"], 4)

    print("")
    print("  rank   stability   null floor   EXCESS")
    print("  " + "-" * 44)
    for r in results:
        bar = "#" * max(0, int(round(r["excess_over_null"] * 100)))
        print(f"  {r['rank']:>4}   {r['stability']:>9.4f}   {r['null_stability']:>10.4f}   "
              f"{r['excess_over_null']:>+7.4f}  {bar}")

    # Selection is on EXCESS over the null, not raw stability.
    best = max(results, key=lambda d: d["excess_over_null"])
    shipped = next((d for d in results if d["rank"] == 6), None)
    print("")
    print(f"  most reproducible rank ABOVE THE NULL: {best['rank']} (excess {best['excess_over_null']:+.4f})")
    if shipped:
        print(f"  the shipped rank 6:                    excess {shipped['excess_over_null']:+.4f}")
        gap = best["excess_over_null"] - shipped["excess_over_null"]
        if best["rank"] == 6 or gap < 0.02:
            print("  -> rank 6 is at or within noise of the most reproducible rank. The archetype")
            print("     claims survive this test.")
        else:
            print(f"  -> rank 6 is {gap:.4f} less reproducible than rank {best['rank']}. The archetypes")
            print("     were chosen by eye and a different rank reproduces better; the downstream")
            print("     matchup claims rest on a rank this criterion does not support.")

    json.dump(dict(
        generated=__import__("datetime").datetime.now().isoformat(timespec="seconds"),
        by="engine/nmf_rank.py",
        what=("Bootstrap factor stability for NMF rank selection. For each rank, NMF is fitted on two "
              "independent bootstrap resamples and the two factor sets are matched greedily by cosine "
              "similarity; the reported number is the mean similarity of matched pairs, averaged over "
              "several pairs. It answers: if a different sample of games had been collected, would the "
              "same archetypes have been found?"),
        criterion="bootstrap factor stability (cf. Brunet et al. 2004, consensus NMF)",
        why_not_coherence=("Mimno et al. 2011 topic coherence is built for LDA over word co-occurrence "
                           "and transfers awkwardly to a small dense team x role matrix. Stability asks "
                           "the question this project actually needs answered."),
        matrix=dict(rows=int(X.shape[0]), cols=int(X.shape[1]), roles=vocab),
        bootstrap_pairs=PAIRS, iters=ITERS,
        results=results, most_reproducible=best, shipped_rank=shipped,
        caveat=("Reconstruction error falls monotonically with rank by construction and cannot select "
                "it; it is reported beside stability, not instead of it. This selects a rank, it does "
                "not name the factors, and it makes no claim that the selected rank is 'true'."),
    ), open(OUT, "w", encoding="utf-8"), indent=1)
    print(f"\nwrote {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
