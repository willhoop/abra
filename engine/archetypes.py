#!/usr/bin/env python3
"""
archetypes.py — DISCOVER the current meta archetypes from live ladder data,
instead of hand-listing them. Answers "what if archetypes develop or fade?":
re-run this and the set (and its weights) changes with the meta. Nothing is
hard-coded — K (how many archetypes exist right now) is chosen from the data.

Method: each team's six -> binary species vector -> KMeans over K in a range,
pick K by silhouette (the data says how many distinct archetypes there are),
label each cluster by its most *over-represented* species (lift vs global usage),
weight by how much of the ladder it is. Emits data/archetypes.json.

No external ML deps required (numpy only). Deterministic (seeded).
"""
import json, os, math, random
from collections import Counter
import numpy as np

HERE = os.path.dirname(__file__)
GAMES = os.path.join(HERE, "..", "data", "games.ladder.jsonl")
OUT   = os.path.join(HERE, "..", "data", "archetypes.json")
K_RANGE = range(5, 13)      # let the data pick between 5 and 12 archetypes
MIN_SHARE = 0.03            # drop micro-clusters (<3% of ladder) as noise
RNG = 42

def load_teams():
    teams = []
    with open(GAMES, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line: continue
            g = json.loads(line)
            for p in ("p1", "p2"):
                six = (g.get("six") or {}).get(p)
                if six and len(six) >= 4:
                    teams.append([s.lower() for s in six])
    return teams

def kmeans(X, k, iters=60, seed=RNG):
    rng = np.random.default_rng(seed)
    # k-means++ init
    n = len(X)
    centers = [X[rng.integers(n)]]
    for _ in range(k - 1):
        d = np.min([np.sum((X - c) ** 2, axis=1) for c in centers], axis=0)
        probs = d / (d.sum() + 1e-12)
        centers.append(X[rng.choice(n, p=probs)])
    C = np.array(centers, dtype=float)
    labels = np.zeros(n, dtype=int)
    for _ in range(iters):
        D = np.linalg.norm(X[:, None, :] - C[None, :, :], axis=2)
        new = D.argmin(1)
        if (new == labels).all():
            labels = new; break
        labels = new
        for j in range(k):
            pts = X[labels == j]
            if len(pts): C[j] = pts.mean(0)
    return labels, C

def silhouette(X, labels, sample=600, seed=RNG):
    rng = np.random.default_rng(seed)
    n = len(X)
    idx = rng.choice(n, min(sample, n), replace=False)
    uq = np.unique(labels)
    if len(uq) < 2: return -1.0
    scores = []
    for i in idx:
        same = X[labels == labels[i]]
        a = np.mean(np.linalg.norm(same - X[i], axis=1)) if len(same) > 1 else 0.0
        b = min(np.mean(np.linalg.norm(X[labels == c] - X[i], axis=1))
                for c in uq if c != labels[i])
        scores.append((b - a) / (max(a, b) + 1e-12))
    return float(np.mean(scores))

# heuristic display names for common cores (fallback = the two signature mons)
NAME_HINTS = [
    (("pelipper","basculegion"), "Rain"),
    (("torkoal","charizard"), "Sun"),
    (("tyranitar","excadrill"), "Sand"),
    (("torkoal","farigiraf"), "Trick Room"),
    (("incineroar","meowstic"), "Fake-Out"),
    (("sylveon","whimsicott"), "Fairy"),
    (("glimmora","chandelure"), "Hyper Offense"),
]

def name_cluster(top_species):
    s = set(top_species[:5])
    for core, label in NAME_HINTS:
        if all(c in s for c in core):
            return label
    return "-".join(top_species[:2]).title()

def main():
    teams = load_teams()
    species = sorted({s for t in teams for s in t})
    sidx = {s: i for i, s in enumerate(species)}
    X = np.zeros((len(teams), len(species)), dtype=float)
    for r, t in enumerate(teams):
        for s in t: X[r, sidx[s]] = 1.0
    glob = X.mean(0)  # global usage per species

    best = None
    for k in K_RANGE:
        labels, C = kmeans(X, k)
        sil = silhouette(X, labels)
        if best is None or sil > best[0]:
            best = (sil, k, labels, C)
    sil, k, labels, C = best

    total = len(teams)
    arches = []
    for j in range(k):
        members = X[labels == j]
        share = len(members) / total
        if share < MIN_SHARE:   # faded/too-small to be a real archetype right now
            continue
        usage = members.mean(0)
        lift = usage - glob                       # over-representation vs field
        order = np.argsort(-lift)
        top = [species[i] for i in order[:8] if usage[order.tolist().index(i)] > 0.15]
        # core = 4 most *present and distinctive* mons
        pres = np.argsort(-(usage * (lift > 0)))
        core = [species[i] for i in pres[:4]]
        arches.append({
            "n": name_cluster(core),
            "share": round(share, 3),
            "core": core,
            "signature": top[:6],
        })

    # renormalise shares over kept archetypes -> these are usage weights
    ws = sum(a["share"] for a in arches) or 1.0
    for a in arches: a["w_usage"] = round(a["share"] / ws, 3)
    arches.sort(key=lambda a: -a["w_usage"])

    out = {
        "generated": "auto from data/games.ladder.jsonl",
        "n_games": total,
        "k_selected": k,
        "silhouette": round(sil, 3),
        "note": "Archetypes are DISCOVERED from live ladder teams, not hand-listed. "
                "Re-run engine/archetypes.py to refresh as the meta shifts; K (how many "
                "distinct archetypes exist) is chosen from the data, so new ones appear "
                "and faded ones drop below the "+str(int(MIN_SHARE*100))+"% floor automatically.",
        "archetypes": arches,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print(f"{total} teams | K={k} (silhouette {sil:.3f}) | {len(arches)} archetypes kept")
    for a in arches:
        print(f"  {a['w_usage']*100:4.1f}%  {a['n']:16s} {a['core']}")

if __name__ == "__main__":
    main()
