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
(Label Distribution Learning, Geng 2016, is the MOTIVATION for real-valued degrees derived rather than
asserted; nothing here implements LDL — the estimator is plain multiplicative-update NMF).

Output: data/nmf-roles.json (+ data/nmf.js for the site). Factors are UNLABELED by design — the model
finds the clusters, a human names them. We attach a *suggested* label by overlap with the curated
roles, but it is only a hint.

    python3 engine/nmf_roles.py [rank]      # default rank 10
Read-only on the store.
"""
import json, os, sys, math, hashlib
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

def fit_nmf(X, rank, iters=300, seed=7):
    """Non-negative matrix factorization by multiplicative updates (Lee & Seung 1999).
    Dependency-free (numpy only). Returns W (docs x rank), H (rank x features), rel. Frobenius error."""
    rng = np.random.default_rng(seed)
    W = rng.random((X.shape[0], rank)) + 1e-3
    H = rng.random((rank, X.shape[1])) + 1e-3
    for _ in range(iters):
        H *= (W.T @ X) / (W.T @ W @ H + 1e-9)
        W *= (X @ H.T) / (W @ H @ H.T + 1e-9)
    err = np.linalg.norm(X - W @ H) / (np.linalg.norm(X) + 1e-12)
    return W, H, err

# --- QUALITY FILTER (data/quality-filter.json) -------------------------------------------------
# This used to read the store RAW, so the emergent archetypes below were factorized over bot games.
# That matters more here than almost anywhere: four undetected bot accounts played the SAME six
# Pokemon in 1,446 games, and NMF finds recurring structure - a single team repeated that many
# times is exactly the kind of pattern it will happily promote to an "archetype".
# The definition is shared rather than repeated: engine/quality.py reads data/quality-filter.json.
# ABRA_UNFILTERED=1 restores the old behaviour, for showing the difference.
import sys as _sys
import importlib.util as _ilu
_qspec = _ilu.spec_from_file_location("quality", D("engine", "quality.py"))
_quality = _ilu.module_from_spec(_qspec); _qspec.loader.exec_module(_quality)
_UNFILTERED = bool(os.environ.get("ABRA_UNFILTERED"))

_COUNTS = {}   # filled by load_games(); written into the artifact so the counts are fields, not a print

def load_games():
    games = _quality.load_games(clean=not _UNFILTERED)
    collected = len(_quality.read_store())
    _COUNTS.update(n_games_usable=len(games), n_games_collected=collected, unfiltered=_UNFILTERED)
    _sys.stderr.write(
        ("WARNING: ABRA_UNFILTERED - all %d games, bots and forfeits included\n" % len(games))
        if _UNFILTERED else
        ("quality filter: %d usable of %d collected\n" % (len(games), collected)))
    return iter(games)

def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def store_receipt():
    """The store file this run actually read, resolved by the SAME rule as engine/quality.py
    (_store_handle: the plain .jsonl wins when both exist; else the .gz). A receipt written from the
    canonical path rather than the opened one is the #547 defect, so the resolution is mirrored here
    and the digest is taken over the bytes of the file that was opened."""
    plain = STORE
    path = plain if os.path.exists(plain) else (plain + ".gz" if os.path.exists(plain + ".gz") else plain)
    return dict(path=os.path.relpath(path, ROOT).replace(os.sep, "/"),
                bytes=os.path.getsize(path), sha256=_sha256(path))

def quality_inputs_receipt():
    """THE STORE DIGEST ALONE DOES NOT PIN THE SAMPLE. engine/quality.py also reads
    data/quality-filter.json (the rules) and data/store-validation.json (species_flagged_ids), and on
    2026-09-09 two runs over a byte-identical store read 32,092 and 32,040 usable games because the
    validation file had been rewritten in between. So every input the filter reads is receipted."""
    out = {}
    for name in ("quality-filter.json", "store-validation.json"):
        p = D("data", name)
        if os.path.exists(p):
            out[name.replace(".json", "").replace("-", "_")] = dict(
                path=os.path.relpath(p, ROOT).replace(os.sep, "/"), bytes=os.path.getsize(p), sha256=_sha256(p))
    return out

SELECTION = D("data", "nmf-rank-selection.json")
SELECTION_FIELD = "most_reproducible.rank"

def read_selected_rank():
    """The archetype rank comes from data/nmf-rank-selection.json:most_reproducible.rank and from
    nowhere else. FAILS LOUDLY if the artifact or the field is absent: a default here would be the
    hand-set rank returning under another name."""
    if not os.path.exists(SELECTION):
        raise SystemExit("nmf_roles.py: %s is absent. Run `python engine/nmf_rank.py` first; this "
                         "script does not carry a default rank." % os.path.relpath(SELECTION, ROOT))
    sel = json.load(open(SELECTION, encoding="utf-8"))
    mr = sel.get("most_reproducible") or {}
    rank = mr.get("rank")
    if not isinstance(rank, int) or rank < 2:
        raise SystemExit("nmf_roles.py: %s carries no integer %s; refusing to guess a rank."
                         % (os.path.relpath(SELECTION, ROOT), SELECTION_FIELD))
    src = dict(path=os.path.relpath(SELECTION, ROOT).replace(os.sep, "/"), field=SELECTION_FIELD,
               sha256=_sha256(SELECTION), generated=sel.get("generated"),
               criterion=sel.get("criterion"), bootstrap_pairs=sel.get("bootstrap_pairs"),
               stability=mr.get("stability"), null_stability=mr.get("null_stability"),
               excess_over_null=mr.get("excess_over_null"))
    return rank, src

def build():
    store = store_receipt()
    quality_inputs = quality_inputs_receipt()
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

    # ---- NMF (multiplicative-update Lee & Seung, dependency-free) ----
    W, H, err = fit_nmf(X, RANK, iters=300)

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

    # ---- role-level factorization: emergent ARCHETYPES (which curated roles bundle together) ----
    # Move-level NMF is dominated by attacking moves (offensive cores). Factoring the team x ROLE
    # matrix instead is smaller, denser, and answers the archetype question directly: which functional
    # roles co-occur. This is the clean, legible cut.
    RR = roles.ROLES; ri = {r: i for i, r in enumerate(RR)}
    Xr_rows = []; row_six = []          # row_six[i] = the species on that team-side
    for g in games:
        setsd = g.get("sets") or {}
        for side in ("p1", "p2"):
            vec = np.zeros(len(RR)); any_ = False
            six = (g.get("six") or {}).get(side, [])
            for mon in six:
                s = setsd.get(mon)
                if not s: continue
                for r in roles.signal_roles(s.get("moves"), s.get("ability"), s.get("item")):
                    vec[ri[r]] += 1; any_ = True
            if any_: Xr_rows.append(vec); row_six.append(six)
    Xr = np.array(Xr_rows)
    rr2 = Xr.sum(1, keepdims=True); rr2[rr2 == 0] = 1
    Xrn = Xr / rr2
    # THE RANK IS READ FROM THE SELECTION ARTIFACT, NEVER TYPED HERE. This line was `ARCH_RANK = 6`
    # from 2026-07-24 to 2026-09-09 while data/nmf-rank-selection.json (engine/nmf_rank.py, bootstrap
    # factor stability against a shuffled null) scored rank 6 at -0.107 excess over the null and named
    # rank 4 the most reproducible. A hand-set rank beside an artifact that selects one is the ban list
    # of four in a new costume, so the artifact is the only source and its absence is an error.
    ARCH_RANK, RANK_SOURCE = read_selected_rank()
    Wa, Ha, arch_err = fit_nmf(Xrn, ARCH_RANK, iters=400)
    aprev = Wa.sum(0)

    # --- species -> archetype affinity -------------------------------------------------
    # Wa[i] is how much team-side i belongs to each archetype. A species' affinity for an
    # archetype is its mean membership across the team-sides it appears on, normalised by the
    # species' overall usage — so a common mon is not automatically "top" of every archetype.
    Wn = Wa / (Wa.sum(1, keepdims=True) + 1e-12)          # each row sums to 1
    sp_sum = {}; sp_n = Counter()
    for i, six in enumerate(row_six):
        for mon in set(six):
            sp_sum[mon] = sp_sum.get(mon, np.zeros(ARCH_RANK)) + Wn[i]
            sp_n[mon] += 1
    base = Wn.mean(0)                                      # population average membership
    MIN_SP = 25                                            # species must appear >= 25 times
    sp_aff = {m: (sp_sum[m]/sp_n[m]) - base for m in sp_sum if sp_n[m] >= MIN_SP}  # lift over base

    archetypes = []
    for ai, k in enumerate(np.argsort(-aprev)):
        h = Ha[k]; tot = float(h.sum()) or 1.0
        top = [dict(role=RR[i], label=roles.ROLE_SIGNALS[RR[i]]["label"], weight=round(float(h[i]/tot), 3))
               for i in np.argsort(-h)[:6] if h[i] > 0]
        mons = sorted(sp_aff.items(), key=lambda kv: -kv[1][k])[:6]
        top_species = [dict(species=m, lift=round(float(v[k]), 4), games=sp_n[m]) for m, v in mons]
        archetypes.append(dict(id=f"A{ai+1}", prevalence=round(float(aprev[k]/aprev.sum()), 3),
                               top_roles=top, top_species=top_species))

    out = dict(
        generated=__import__("datetime").date.today().isoformat(),
        method=("Non-negative Matrix Factorization. Two cuts: (1) team x MOVE usage -> offensive cores; "
                "(2) team x ROLE -> emergent archetypes (the clean view). Loadings are learned, not "
                "declared (Lee & Seung 1999). Label Distribution Learning (Geng 2016) is cited as the "
                "MOTIVATION for graded loadings; nothing here implements LDL."),
        archetypes=archetypes, archetype_recon_error=round(float(arch_err), 4), archetype_rank=ARCH_RANK,
        archetype_rank_source=RANK_SOURCE, store=store, quality_inputs=quality_inputs,
        # the two counts load_games() prints, as FIELDS: a print is not something a document can cite
        n_games_usable=_COUNTS.get("n_games_usable"), n_games_collected=_COUNTS.get("n_games_collected"),
        quality_filter_version=(json.load(open(D("data", "quality-filter.json"), encoding="utf-8")).get("version")
                                if os.path.exists(D("data", "quality-filter.json")) else None),
        n_team_sides_role_matrix=int(Xr.shape[0]), n_roles_role_matrix=int(Xr.shape[1]),
        rank=RANK, n_documents=len(docs), n_moves=M, min_move_uses=MIN_USE,
        reconstruction_error_ratio=round(float(err), 4),
        factors=factors)
    json.dump(out, open(D("data", "nmf-roles.json"), "w"), indent=1, allow_nan=False)
    with open(D("data", "nmf.js"), "w") as f:
        f.write("window.NMF=" + json.dumps(out, allow_nan=False) + ";\n")

    print(f"nmf_roles.py — rank {RANK}, {len(docs):,} team-docs, {M} moves, recon-err {err:.3f}")
    print(f"  archetypes: rank {ARCH_RANK} read from {RANK_SOURCE['path']}:{RANK_SOURCE['field']} "
          f"(sha256 {RANK_SOURCE['sha256'][:12]}), recon-err {arch_err:.4f}, "
          f"{Xr.shape[0]:,} team-sides x {Xr.shape[1]} roles")
    print(f"  store: {store['path']} {store['bytes']:,} bytes sha256 {store['sha256'][:12]}")
    for a in archetypes:
        print(f"  {a['id']} ~{int(a['prevalence']*100):2d}%  " + " | ".join(f"{r['label']} {r['weight']:.2f}" for r in a['top_roles'][:4]))
    for fac in factors:
        tops = " ".join(t["move"] for t in fac["top_moves"][:6])
        print(f"  {fac['id']} ~{int(fac['prevalence']*100):2d}%  [{fac['suggested_label']}]  {tops}")
    return out

if __name__ == "__main__":
    build()
