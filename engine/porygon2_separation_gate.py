#!/usr/bin/env python3
"""
PORYGON2 SEPARATION GATE — can a value function tell two positions two turns apart?

    python engine/porygon2_separation_gate.py --declare     # write the thresholds, run nothing
    python engine/porygon2_separation_gate.py --run         # fill them in
    P2SEP_LAG=1 python engine/porygon2_separation_gate.py --addendum   # same three
                                                           # quantities at a 1-turn gap,
                                                           # merged in, NOT gated

THE QUESTION, AND WHY IT IS A GATE RATHER THAN A MEASUREMENT
------------------------------------------------------------
MILTANK's in-game leaf is a random playout. `data/winrate-backtest.json` says it names the winner on
51.0% of 1,314 decisive calls, 95% CI [48.3, 53.7] — an interval containing 50. The proposed
replacement is PORYGON2, a nearest-neighbour value function over a position vector.

Inside a search the leaf is called on positions that differ by a turn or two. A leaf that returns
effectively the same number for every node of a subtree cannot be argmaxed over: every branch
collapses to one value and swapping it in changes nothing. So before anything is built on PORYGON2,
three things have to be true of it, and the third is the one that usually kills a value function:

  1. SEPARATION   — positions two turns apart get different scores at all.
  2. LOCALITY     — and those scores are CLOSER than scores of two positions from unrelated games.
                    Without this, the model is not separating positions, it is spreading them.
  3. DIRECTION    — and the score moves the RIGHT WAY.

THE THRESHOLDS ARE DECLARED BEFORE THE RUN, IN THIS FILE, AND COPIED VERBATIM INTO THE ARTIFACT.
A threshold chosen after seeing the number is not a gate. `--declare` writes them with the results
absent; `--run` refuses to proceed unless that declaration is already on disk and copies it through
unchanged.

THE GATE MUST BE ABLE TO FAIL, AND IT PROVES IT ON EVERY RUN
------------------------------------------------------------
Two deliberately-broken leaves are scored through the identical pipeline:

  CONSTANT 0.5      no separation at all. Must fail T1, T2 and T3.
  UNIFORM RANDOM    enormous separation, zero structure. Must PASS T1 and fail T2 and T3.

The random control is the important one. A gate built only against a constant can be passed by noise,
and "the model is just spreading positions" is precisely the failure mode T2 exists to catch. If
either control returns PASS, this run reports the gate as void and no verdict about PORYGON2.

WHAT IS FROZEN AND WHAT IS NOT — READ THIS BEFORE QUOTING THE NUMBER
--------------------------------------------------------------------
The engine release (`engine/engine_release.js`) freezes 23 files. NONE of PORYGON2's sources are
among them: not `engine/porygon2.py`, not `data/porygon2-species.json`, not either corpus. PORYGON2
is a Python model and the release mechanism is a JavaScript `require` shim, so it cannot be loaded
through `REL.require` at all. The release stamp still goes in the artifact, because it names the
engine the rest of the project was measuring against at the time, and `engine/quality.js` +
`data/quality-filter.json` — the definition of a clean game, which IS frozen — are read through it.

For the files the release cannot cover, this script makes its own photograph rather than reading the
live tree while it runs:

  engine/porygon2.py, engine/isotime.py, data/porygon2-species.json
      copied into a private tree before anything is imported, imported from the copy, and the live
      originals re-digested at the end. A move is reported, not hidden.
  data/games.selfplay.porygon2.raw-logs.jsonl
      static since 2026-07-28; digested before and after.
  data/games.ladder.jsonl / data/games.ladder.raw-logs.jsonl
      APPEND-ONLY, and the hourly collector will move both mid-run. A whole-file digest would void
      every run that took longer than an hour and is the wrong instrument. The population is pinned
      by the ID SET instead: clean ids are resolved once, up front, through the FROZEN quality
      filter, and the artifact carries the count and a sha256 of the sorted list. Games appended
      afterwards are not in that set, so the sample is deterministic over a file that only grows.
"""
import os, sys, json, math, time, shutil, hashlib, tempfile, subprocess
import importlib.util
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
# ONE HOME FOR A TIMESTAMP — engine/isotime.py. A naive isoformat() means something different to
# every reader; see docs/MEASURE.md §8, which found five generators writing one.
from isotime import utc_now
OUT = os.path.join(ROOT, "data", "porygon2-separation-gate.json")
RELEASE = os.environ.get("P2SEP_RELEASE", "4c73f9cafa4b")
MAX_GAMES = int(os.environ.get("P2SEP_GAMES") or 4000)
NBOOT = int(os.environ.get("P2SEP_BOOT") or 2000)
# THE GATE IS DECLARED AT TWO TURNS. This knob exists only for --addendum, which re-runs the same
# three quantities at ONE turn and reports them WITHOUT a pass/fail, because a threshold declared for
# a two-turn gap is not a threshold for a one-turn gap and inventing one after the fact is the exact
# thing the declaration block forbids. The reason it is worth measuring at all: a search compares
# SIBLING branches, which differ by one action, not by two whole turns of both players. A leaf that
# separates at two turns and is flat at one would pass this gate and still be useless in a search.
LAG = int(os.environ.get("P2SEP_LAG") or 2)

# =================================================================================================
# THE DECLARATION. Written by --declare, copied verbatim by --run, never edited after a number is
# seen. The reference scale in every reasoning field is the same one: 0.43 accuracy points is the
# SMALLEST split-half noise floor this division has published (docs/MEASURE.md §5f, from R1's cuts
# which run 0.43–2.01 and R4's which run 0.2/1.3/3.9). In probability units that is 0.0043. An effect
# smaller than that is not an effect, because this project has never been able to detect one.
# =================================================================================================
DECLARATION = {
    "declared_before_the_run": True,
    "reference_scale": {
        "value": 0.0043,
        "what": "0.43 accuracy points, the smallest split-half noise floor published by MEASURE "
                "(docs/MEASURE.md §5f), expressed in probability units.",
        "why": "It is this project's demonstrated detection limit. A leaf difference below it has "
               "never been distinguishable from a re-draw of the same arm, so no threshold here is "
               "set below it.",
    },
    "primary_arm": "weighted k=50, 17 features",
    "why_primary": "docs/MODELS.md headlines weighted k=50 at 63.59% as PORYGON2's best arm, and "
                   "data/porygon2.json names 17 features. The live engine/porygon2.py has since "
                   "grown to 19 (hp_min_diff, hp_min_mine); that variant is run as a secondary so "
                   "the discrepancy is measured rather than argued.",
    "T1_separation": {
        "metric": "median |score(t+2) - score(t)| over same-game pairs two turns apart",
        "pass_if": "median >= 0.02 AND fraction of pairs below the 0.0043 reference floor < 0.50",
        "why": "0.02 is ~4.6x the reference floor. A search argmaxes over branches that differ by "
               "one or two turns; if the median move across two whole turns is under two "
               "probability points, the ordering the search reads is inside the noise this project "
               "can measure. The second clause stops a fat tail carrying a median of near-zeros.",
    },
    "T2_locality": {
        "metric": "mean |dscore| for same-game 2-turn-apart pairs, against mean |dscore| for "
                  "TURN-MATCHED pairs whose second element comes from an unrelated game. "
                  "D = unrelated - same. R = same / unrelated.",
        "pass_if": "the 95% game-clustered bootstrap CI on D has lower bound > 0.0043 AND R <= 0.75",
        "why": "THIS IS THE DECIDING TEST. Separation on its own is satisfied by pure noise. If two "
               "positions from the same game two turns apart are no closer in score than two "
               "positions from different games, the feature space has no local structure and the "
               "model is spreading positions rather than separating them. The CI clause says the "
               "difference is detectable at this project's own floor; the R clause says it is big "
               "enough to matter — a leaf whose local pairs are only 10% tighter than unrelated "
               "pairs cannot rank sibling branches, because the between-branch signal is swamped. "
               "0.75 is a stated magnitude bar (local pairs at least a quarter tighter), chosen for "
               "roundness before any number was seen, not tuned to the data. "
               "TURN-MATCHED, because same-game pairs sit at adjacent turn numbers and an unmatched "
               "control would be measuring the turn feature instead of locality.",
    },
    "T3_direction": {
        "metric": "agreement of sign(score(t+2)-score(t)) with sign(material gained over those two "
                  "turns), where material = alive_diff + hp_total_diff from p1's side, on pairs "
                  "where |dmaterial| >= 0.10",
        "pass_if": "the 95% game-clustered bootstrap CI has lower bound > 0.50 AND the point "
                   "estimate >= 0.60",
        "why": "Separation that points the wrong way is worse than no separation. Clearing 50 is "
               "necessary and nowhere near sufficient: the leaf being REPLACED already names the "
               "winner on 51.0% of decisive calls, so an agreement rate of 51% would buy nothing. "
               "0.60 is set at roughly the level PORYGON2's own (un-intervalled) 63.6% accuracy "
               "claim implies, so the gate asks the model to be as directional as it is accurate. "
               "The 0.10 material cut exists because on pairs where nothing material happened the "
               "phrase 'the right way' has no referent. "
               "STATED LIMITATION: alive_diff and hp_total_diff are two of PORYGON2's own 17 "
               "features, so this asks whether the model respects its strongest inputs. A k-NN "
               "guarantees no such thing, so the test is not vacuous — but it is not independent "
               "either, and a second direction test anchored only on the eventual WINNER is "
               "reported beside it.",
    },
    "verdict_rule": "PASS only if T1 and T2 and T3 all pass on the primary arm. Otherwise FAIL. "
                    "NO RESULT if the population or the model could not be assembled.",
    "negative_controls": {
        "constant_0.5": "must fail T1, T2 and T3",
        "uniform_random": "must fail T2 and T3 (it is expected to PASS T1, which is the point: T1 "
                          "alone cannot tell a value function from noise)",
        "if_a_control_passes": "the gate is declared VOID and no verdict about PORYGON2 is reported",
    },
}


# ---- provenance helpers -------------------------------------------------------------------------
def num(x, nd=None):
    """A JSON number, or null when there isn't one.

    THIS IS NOT COSMETIC AND IT COST A RUN. Python's json.dump writes a bare `NaN`, which every
    Python reader accepts and which is NOT VALID JSON — `JSON.parse` throws on it. The first
    version of this artifact carried `"R_same_over_unrelated": NaN` from the constant-leaf control
    (its unrelated mean is 0, so the ratio is 0/0), and the effect was that `engine/provenance.js`
    could not read ONE FIELD of the file. It reported the artifact `ok` and `mtime-only` — a clean
    bill of health issued over a document it had never parsed, including the `void` flag that exists
    to let a generator condemn its own run. Same shape as `buildMon("Scizor")` returning null: the
    failure looked exactly like success.

    An undefined ratio is honestly `null`. Both dumps also pass allow_nan=False, so this can never
    again be papered over silently — it raises instead."""
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(f):
        return None
    return round(f, nd) if nd is not None else f


def nums(seq, nd=None):
    return [num(v, nd) for v in seq]


def sha256_file(path, n=12):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:n]


UNFROZEN = [
    "engine/porygon2.py",
    "engine/isotime.py",
    "data/porygon2-species.json",
    "data/games.selfplay.porygon2.raw-logs.jsonl",
]


def release_stamp():
    """REL.stamp() through the canonical path — engine_release.js — rather than a second reader of
    release.json. status.js shells out to provenance.js for the same reason."""
    js = ("const REL=require(process.argv[1]).open(process.argv[2]);"
          "process.stdout.write(JSON.stringify(REL.stamp()));")
    out = subprocess.run(["node", "-e", js, os.path.join(HERE, "engine_release.js"), RELEASE],
                         capture_output=True, text=True, cwd=ROOT)
    if out.returncode != 0:
        raise SystemExit("cannot open engine release %s:\n%s" % (RELEASE, out.stderr))
    return json.loads(out.stdout)


def clean_ids_from_release():
    """The clean-game predicate comes from the FROZEN quality.js and the FROZEN quality-filter.json.
    The STORE does not — it is append-only and is not part of an engine. Passing its live path
    explicitly is deliberate: the release's own quality.js would otherwise resolve a store path
    inside the snapshot directory, which does not exist, and the failure would be a silent empty
    corpus rather than an error."""
    js = ("const path=require('path'),crypto=require('crypto');"
          "const REL=require(process.argv[1]).open(process.argv[2]);"
          "const Q=REL.require('engine/quality.js');"
          "const g=Q.loadGames({path:path.join(process.argv[3],'data','games.ladder.jsonl')});"
          "const ids=g.map(x=>x.id).filter(Boolean).sort();"
          "process.stdout.write(JSON.stringify({n:ids.length,"
          "sha256:crypto.createHash('sha256').update(ids.join('\\n')).digest('hex'),ids}));")
    out = subprocess.run(["node", "--max-old-space-size=4096", "-e", js,
                          os.path.join(HERE, "engine_release.js"), RELEASE, ROOT],
                         capture_output=True, text=True, cwd=ROOT)
    if out.returncode != 0:
        raise SystemExit("cannot resolve clean ids from release %s:\n%s" % (RELEASE, out.stderr[-4000:]))
    j = json.loads(out.stdout)
    return set(j["ids"]), j["n"], j["sha256"]


def snapshot_porygon2():
    """Copy PORYGON2's sources into a private tree and import from THERE.

    The directory layout is reproduced (tmp/engine/, tmp/data/) rather than flattened, because
    porygon2.py resolves data/porygon2-species.json relative to its own __file__ and silently
    degrades to SPX = {"eff": {}, "mons": {}} when it is missing — which would zero the three
    matchup features and still return a working-looking model. The import is asserted non-empty
    below for exactly that reason."""
    tmp = tempfile.mkdtemp(prefix="p2sep_")
    os.makedirs(os.path.join(tmp, "engine"))
    os.makedirs(os.path.join(tmp, "data"))
    shutil.copyfile(os.path.join(ROOT, "engine", "porygon2.py"), os.path.join(tmp, "engine", "porygon2.py"))
    shutil.copyfile(os.path.join(ROOT, "engine", "isotime.py"), os.path.join(tmp, "engine", "isotime.py"))
    shutil.copyfile(os.path.join(ROOT, "data", "porygon2-species.json"), os.path.join(tmp, "data", "porygon2-species.json"))
    spec = importlib.util.spec_from_file_location("porygon2_frozen", os.path.join(tmp, "engine", "porygon2.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not mod.MONS or not mod.EFF:
        raise SystemExit("PORYGON2 snapshot loaded with an EMPTY species table — the three matchup "
                         "features would be constant and the model would look fine. Refusing to run.")
    return tmp, mod


# ---- the sample ---------------------------------------------------------------------------------
def load_human_positions(P2, ids, cap):
    """One row per (game, turn) from p1's perspective, plus the turn index, the game and the label.

    p1's perspective ONLY, and that is not a symmetry violation — PORYGON2 emits both sides during
    TRAINING so the model is symmetric, but a SCORE has to be read from one fixed side or a
    difference between two positions is not a difference at all."""
    path = os.path.join(ROOT, "data", "games.ladder.raw-logs.jsonl")
    games = []
    seen = set()
    t0 = time.time()
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            gid = r.get("id")
            if not gid or gid in seen:
                continue
            seen.add(gid)
            if gid not in ids:
                continue
            log = r.get("log", "")
            w = P2.winner_side(log)
            if w is None:
                continue
            sts = P2.parse_states(log)
            if len(sts) < 3:
                continue
            games.append({
                "id": gid,
                "turns": [s["turn"] for s in sts],
                "X": [P2.vec(s, "p1") for s in sts],
                "y": 1.0 if w == "p1" else 0.0,
            })
            if len(games) % 1000 == 0:
                print("    ...%d eligible games (%.0fs)" % (len(games), time.time() - t0), flush=True)
    eligible = len(games)
    if cap and eligible > cap:
        idx = np.random.RandomState(0).choice(eligible, cap, replace=False)
        idx.sort()
        games = [games[i] for i in idx]
    return games, eligible


# ---- scoring ------------------------------------------------------------------------------------
def knn_scores(Xtr, Ytr, Xte, ks, chunk=400):
    """Distance-weighted k-NN, returning several k from ONE partition.

    Partitioning at max(ks) and taking the smallest k of those neighbours is exact and saves a full
    pass per k. Same arithmetic as engine/porygon2.py's knn_predict; kept here rather than imported
    because that function returns a single k and the multi-k form must not silently become a second
    definition of the distance."""
    kmax = max(ks)
    out = {k: np.empty(len(Xte)) for k in ks}
    tr2 = (Xtr ** 2).sum(1)
    n = len(Xte)
    for i in range(0, n, chunk):
        Q = Xte[i:i + chunk]
        d2 = tr2[None, :] - 2.0 * Q @ Xtr.T + (Q ** 2).sum(1)[:, None]
        np.maximum(d2, 0, out=d2)
        idx = np.argpartition(d2, kmax, axis=1)[:, :kmax]
        dd = np.take_along_axis(d2, idx, 1)
        order = np.argsort(dd, axis=1)
        idx = np.take_along_axis(idx, order, 1)
        dd = np.take_along_axis(dd, order, 1)
        for k in ks:
            w = 1.0 / (np.sqrt(dd[:, :k]) + 1e-3)
            out[k][i:i + chunk] = (Ytr[idx[:, :k]] * w).sum(1) / w.sum(1)
        if (i // chunk) % 10 == 0:
            print("      scored %d / %d" % (i, n), flush=True)
    return {k: np.clip(v, 1e-4, 1 - 1e-4) for k, v in out.items()}


# ---- the three quantities -----------------------------------------------------------------------
def boot_ci_ratio(num, den, g, nboot, rng):
    """Game-clustered bootstrap on a ratio of per-game sums. The unit is the GAME, not the pair:
    pairs inside one game share a board and are not independent draws."""
    ng = len(num)
    vals = np.empty(nboot)
    for b in range(nboot):
        s = rng.integers(0, ng, ng)
        d = den[s].sum()
        vals[b] = num[s].sum() / d if d else np.nan
    vals = vals[~np.isnan(vals)]
    return float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))


def evaluate(scores, pairs, ngames, nboot, rng_seed=7):
    """pairs: arrays i, j (row indices into scores), un (turn-matched unrelated partner for j),
    un_naive (any-turn unrelated partner), gi (game index), dmat (material change t -> t+2),
    ywin (1 if p1 won)."""
    i, j, un, unn, gi, dmat, ywin = pairs
    rng = np.random.default_rng(rng_seed)

    d_same = np.abs(scores[j] - scores[i])
    d_unrel = np.abs(scores[un] - scores[i])
    d_unrel_naive = np.abs(scores[unn] - scores[i])

    # ---- T1 -------------------------------------------------------------------------------------
    med = float(np.median(d_same))
    frac_below = float(np.mean(d_same < DECLARATION["reference_scale"]["value"]))
    med_lo, med_hi = _boot_percentile_stat(np.median, d_same, gi, ngames, nboot, rng)

    # ---- T2 -------------------------------------------------------------------------------------
    ssum = np.bincount(gi, weights=d_same, minlength=ngames)
    scnt = np.bincount(gi, minlength=ngames).astype(float)
    usum = np.bincount(gi, weights=d_unrel, minlength=ngames)
    nsum = np.bincount(gi, weights=d_unrel_naive, minlength=ngames)
    keep = scnt > 0
    ssum, usum, nsum, scnt = ssum[keep], usum[keep], nsum[keep], scnt[keep]
    mean_same = float(ssum.sum() / scnt.sum())
    mean_unrel = float(usum.sum() / scnt.sum())
    mean_unrel_naive = float(nsum.sum() / scnt.sum())

    ng = len(scnt)
    dvals = np.empty(nboot)
    rvals = np.empty(nboot)
    for b in range(nboot):
        s = rng.integers(0, ng, ng)
        c = scnt[s].sum()
        a, u = ssum[s].sum() / c, usum[s].sum() / c
        dvals[b] = u - a
        rvals[b] = a / u if u else np.nan
    D = mean_unrel - mean_same
    R = mean_same / mean_unrel if mean_unrel else float("nan")
    rv = rvals[~np.isnan(rvals)]

    # ---- T3 -------------------------------------------------------------------------------------
    sel = np.abs(dmat) >= 0.10
    ds = np.sign(scores[j] - scores[i])
    agree = ((ds != 0) & (np.sign(dmat) == ds))[sel]
    gsel = gi[sel]
    asum = np.bincount(gsel, weights=agree.astype(float), minlength=ngames)
    acnt = np.bincount(gsel, minlength=ngames).astype(float)
    k2 = acnt > 0
    asum, acnt = asum[k2], acnt[k2]
    rate = float(asum.sum() / acnt.sum()) if acnt.sum() else float("nan")
    a_lo, a_hi = boot_ci_ratio(asum, acnt, None, nboot, rng) if len(acnt) else (float("nan"), float("nan"))

    # secondary: does the score move toward the eventual WINNER? Outcome-anchored, so it shares no
    # input with the model's own features.
    moved = ds != 0
    toward = (ds == np.sign(ywin - 0.5))[moved]
    gm = gi[moved]
    tsum = np.bincount(gm, weights=toward.astype(float), minlength=ngames)
    tcnt = np.bincount(gm, minlength=ngames).astype(float)
    k3 = tcnt > 0
    tsum, tcnt = tsum[k3], tcnt[k3]
    trate = float(tsum.sum() / tcnt.sum()) if tcnt.sum() else float("nan")
    t_lo, t_hi = boot_ci_ratio(tsum, tcnt, None, nboot, rng) if len(tcnt) else (float("nan"), float("nan"))

    D_lo = float(np.percentile(dvals, 2.5))
    T1 = med >= 0.02 and frac_below < 0.50
    # math.isfinite is stated rather than relied on. `nan <= 0.75` is already False in Python, so the
    # constant leaf failed T2 for the right reason by accident. A gate whose negative control passes
    # on IEEE comparison semantics is a gate one refactor away from not working.
    T2 = D_lo > DECLARATION["reference_scale"]["value"] and math.isfinite(R) and R <= 0.75
    T3 = math.isfinite(a_lo) and a_lo > 0.50 and math.isfinite(rate) and rate >= 0.60

    return {
        "n_pairs": int(len(i)),
        "n_games": int(ng),
        "T1_separation": {
            "median_abs_dscore": num(med, 6),
            "ci95": nums([med_lo, med_hi], 6),
            "mean_abs_dscore": num(mean_same, 6),
            "p10_p25_p75_p90": nums([np.percentile(d_same, q) for q in (10, 25, 75, 90)], 6),
            "frac_below_reference_floor": num(frac_below, 4),
            "pass": bool(T1),
        },
        "T2_locality": {
            # Key names the LAG so a one-turn addendum cannot be read as a two-turn gate result.
            # At the gated lag of 2 this is byte-identical to what it has always been.
            "mean_abs_dscore_same_game_%d_turns" % LAG: num(mean_same, 6),
            "mean_abs_dscore_unrelated_turn_matched": num(mean_unrel, 6),
            "mean_abs_dscore_unrelated_any_turn": num(mean_unrel_naive, 6),
            "D_unrelated_minus_same": num(D, 6),
            "D_ci95_game_clustered": nums([D_lo, np.percentile(dvals, 97.5)], 6),
            "R_same_over_unrelated": num(R, 4),
            "R_undefined_because": None if math.isfinite(R) else
                "the unrelated-pair mean is 0, so the ratio is 0/0 — a leaf with no spread at all",
            "R_ci95_game_clustered": nums([np.percentile(rv, 2.5), np.percentile(rv, 97.5)], 4)
                                     if len(rv) else None,
            "pass": bool(T2),
        },
        "T3_direction": {
            "n_pairs_with_material_change": int(sel.sum()),
            "agreement_with_material_sign": num(rate, 4),
            "ci95_game_clustered": nums([a_lo, a_hi], 4),
            "secondary_moves_toward_eventual_winner": num(trate, 4),
            "secondary_ci95": nums([t_lo, t_hi], 4),
            "n_pairs_score_moved": int(moved.sum()),
            "pass": bool(T3),
        },
        "verdict": "PASS" if (T1 and T2 and T3) else "FAIL",
        "failed": [n for n, ok in (("T1_separation", T1), ("T2_locality", T2), ("T3_direction", T3)) if not ok],
    }


def _boot_percentile_stat(fn, v, gi, ngames, nboot, rng):
    """Game-clustered bootstrap for a statistic that is not a ratio of sums (the median). Slower, so
    it runs at a tenth of the resamples — it decorates T1's point estimate and decides nothing."""
    order = np.argsort(gi, kind="stable")
    gs = gi[order]
    vs = v[order]
    starts = np.searchsorted(gs, np.arange(ngames), "left")
    ends = np.searchsorted(gs, np.arange(ngames), "right")
    live = np.where(ends > starts)[0]
    nb = max(200, nboot // 10)
    out = np.empty(nb)
    for b in range(nb):
        s = live[rng.integers(0, len(live), len(live))]
        out[b] = fn(np.concatenate([vs[starts[g]:ends[g]] for g in s]))
    return float(np.percentile(out, 2.5)), float(np.percentile(out, 97.5))


# ---- main ---------------------------------------------------------------------------------------
def declare():
    doc = {
        "generated": None,
        "by": "engine/porygon2_separation_gate.py",
        "status": "DECLARED — THRESHOLDS ONLY, NOT YET RUN",
        "what": "Gate for docs/PRIORITIES #23: can PORYGON2's position vector tell apart two "
                "positions two turns apart, more than it tells apart two unrelated positions, and "
                "in the right direction. Decides whether the MILTANK leaf redesign (#24) is "
                "buildable at all.",
        "declaration": DECLARATION,
    }
    doc["generated"] = utc_now()
    json.dump(doc, open(OUT, "w", encoding="utf-8"), indent=1, allow_nan=False)
    print("wrote thresholds only to %s — nothing has been run." % os.path.relpath(OUT, ROOT))


def run(addendum=False):
    if not os.path.exists(OUT):
        raise SystemExit("no declaration on disk. Run --declare first; a threshold chosen after the "
                         "number is not a gate.")
    prior = json.load(open(OUT, encoding="utf-8"))
    if "declaration" not in prior:
        raise SystemExit("%s carries no declaration block. Refusing to run." % OUT)
    if prior["declaration"] != DECLARATION:
        raise SystemExit("the declaration on disk DIFFERS from the one in this file. That is either "
                         "a threshold edited after a look at the data, or a stale file. Either way "
                         "this refuses to run. Diff them by hand.")
    # THE DECLARATION TIME SURVIVES EVERY RE-RUN. A --run overwrites this file with results, so
    # reading `generated` would report the LAST run as the moment the thresholds were fixed — which
    # is the one fact this whole block exists to establish, and it would silently drift later than
    # the numbers every time. Carried forward instead.
    declared_at = prior.get("declaration_written") or prior.get("generated")

    started = utc_now()
    before = {p: sha256_file(os.path.join(ROOT, p)) for p in UNFROZEN}
    stamp = release_stamp()

    print("PORYGON2 SEPARATION GATE")
    print("  engine release %s (cut %s) — carries the clean-game predicate, NOT PORYGON2's sources"
          % (stamp["engine_release"], stamp["engine_release_cut"]))
    ids, n_clean, ids_sha = clean_ids_from_release()
    print("  clean ladder games from the frozen filter: %s" % f"{n_clean:,}")

    tmp, P2 = snapshot_porygon2()
    print("  PORYGON2 imported from a private snapshot at %s (%d species, %d type rows)"
          % (tmp, len(P2.MONS), len(P2.EFF)))

    self_raw = os.path.join(ROOT, "data", "games.selfplay.porygon2.raw-logs.jsonl")
    print("  loading the self-play training corpus ...", flush=True)
    Xs, Ys, gs = P2.load(self_raw)
    print("    %s games, %s positions" % (f"{gs:,}", f"{len(Ys):,}"), flush=True)
    if gs == 0:
        raise SystemExit("no self-play training corpus — NO RESULT.")

    print("  loading held-out clean HUMAN positions ...", flush=True)
    games, eligible = load_human_positions(P2, ids, MAX_GAMES)
    print("    %s eligible games with a raw log and a winner; %s sampled"
          % (f"{eligible:,}", f"{len(games):,}"), flush=True)
    if not games:
        raise SystemExit("no human positions — NO RESULT (see the caveat: a self-play-only "
                         "evaluation is not a pass).")

    # flatten
    X, turns, gi_pos, ylab = [], [], [], []
    for k, g in enumerate(games):
        for t, x in zip(g["turns"], g["X"]):
            X.append(x); turns.append(t); gi_pos.append(k); ylab.append(g["y"])
    X = np.asarray(X, float); turns = np.asarray(turns); gi_pos = np.asarray(gi_pos)
    ylab = np.asarray(ylab, float)
    print("    %s human positions (p1 perspective)" % f"{len(X):,}", flush=True)

    # pair construction ---------------------------------------------------------------------------
    rng = np.random.default_rng(11)
    by_turn = {}
    for r, t in enumerate(turns):
        by_turn.setdefault(int(t), []).append(r)
    by_turn = {t: np.asarray(v) for t, v in by_turn.items()}
    allrows = np.arange(len(X))

    pi, pj, pun, punn, pg, pdm = [], [], [], [], [], []
    for k, g in enumerate(games):
        base = int(np.searchsorted(gi_pos, k, "left"))
        T = {int(t): base + n for n, t in enumerate(g["turns"])}
        for t, r in T.items():
            r2 = T.get(t + LAG)
            if r2 is None:
                continue
            pool = by_turn.get(t + LAG)
            if pool is None or len(pool) < 2:
                continue
            # turn-matched partner from a DIFFERENT game
            for _ in range(8):
                c = int(pool[rng.integers(0, len(pool))])
                if gi_pos[c] != k:
                    break
            else:
                continue
            for _ in range(8):
                cn = int(allrows[rng.integers(0, len(allrows))])
                if gi_pos[cn] != k:
                    break
            else:
                continue
            pi.append(r); pj.append(r2); pun.append(c); punn.append(cn); pg.append(k)
            pdm.append((X[r2][0] + X[r2][2]) - (X[r][0] + X[r][2]))
    pi = np.asarray(pi); pj = np.asarray(pj); pun = np.asarray(pun)
    punn = np.asarray(punn); pg = np.asarray(pg); pdm = np.asarray(pdm, float)
    pairs = (pi, pj, pun, punn, pg, pdm, ylab[pi])
    print("    %s same-game pairs at a %d-turn gap across %s games"
          % (f"{len(pi):,}", LAG, f"{len(set(pg.tolist())):,}"), flush=True)

    # feature spaces ------------------------------------------------------------------------------
    FEAT19 = list(P2.FEATURES)
    DROP = ["hp_min_diff", "hp_min_mine"]
    keep17 = [n for n, f in enumerate(FEAT19) if f not in DROP]
    doc_feats = json.load(open(os.path.join(ROOT, "data", "porygon2.json"), encoding="utf-8"))["features"]
    if [FEAT19[n] for n in keep17] != doc_feats:
        raise SystemExit("the 17-feature subset does not reproduce data/porygon2.json's feature "
                         "list. Refusing to call it PORYGON2.")

    arms = {}
    fw_report = {}
    # The addendum answers one question about ONE arm, so it scores one geometry rather than four.
    spaces = (("17f", keep17),) if addendum else (("17f", keep17), ("19f", list(range(len(FEAT19)))))
    for tag, cols in spaces:
        Xtr = Xs[:, cols]; Xte = X[:, cols]
        mu, sd = Xtr.mean(0), Xtr.std(0) + 1e-9
        Ztr, Zte = (Xtr - mu) / sd, (Xte - mu) / sd
        fw = P2.logistic_weights(Ztr, Ys)
        print("  scoring %s plain ..." % tag, flush=True)
        p_plain = knn_scores(Ztr, Ys, Zte, [50, 200])
        print("  scoring %s weighted ..." % tag, flush=True)
        p_wt = knn_scores(Ztr * fw, Ys, Zte * fw, [50, 200])
        for k in (50, 200):
            arms["%s plain k=%d" % (tag, k)] = p_plain[k]
            arms["%s weighted k=%d" % (tag, k)] = p_wt[k]
        fw_report[tag] = {n: round(float(v), 3) for n, v in zip([FEAT19[c] for c in cols], fw)}

    # controls ------------------------------------------------------------------------------------
    arms["CONTROL constant 0.5"] = np.full(len(X), 0.5)
    arms["CONTROL uniform random"] = np.random.default_rng(1234).random(len(X))
    # A BASELINE, NOT A CONTROL, AND THE DIFFERENCE MATTERS. The two above are broken on purpose and
    # must fail. This one is not broken at all: it is `0.5 + 0.15*alive_diff`, clipped — the same
    # material-sign rule engine/porygon2.py scores itself against, which reaches 60.2% accuracy
    # beside PORYGON2's 63.6%.
    #
    # It is here because T3 asks whether the score moves with MATERIAL, and alive_diff carries a
    # learned weight of 5.12 against a mean of 1.0 — it dominates the vector. A gate that PORYGON2
    # passes and a bare material count also passes has established that the leaf is buildable and
    # NOT that the 17 features are worth their cost. Those are different claims and #24 needs both.
    # The verdict is unaffected: it is read off the primary arm and the thresholds are unchanged.
    arms["BASELINE material sign"] = np.clip(0.5 + 0.15 * X[:, 0], 0.02, 0.98)

    results = {}
    for name, p in arms.items():
        print("  evaluating %s ..." % name, flush=True)
        results[name] = evaluate(p, pairs, len(games), NBOOT)

    # an accuracy number falls out of this for free. It is NOT the headline and it supersedes
    # nothing until docs/MODELS.md is updated.
    incidental = {}
    for name, p in arms.items():
        a = float(np.mean((p >= 0.5) == (ylab >= 0.5)))
        gsum = np.bincount(gi_pos, weights=((p >= 0.5) == (ylab >= 0.5)).astype(float), minlength=len(games))
        gcnt = np.bincount(gi_pos, minlength=len(games)).astype(float)
        kk = gcnt > 0
        lo, hi = boot_ci_ratio(gsum[kk], gcnt[kk], None, 2000, np.random.default_rng(3))
        incidental[name] = {"accuracy_pct": num(100 * a, 2), "ci95_pct": nums([100 * lo, 100 * hi], 2),
                            "brier": num(float(np.mean((p - ylab) ** 2)), 4)}

    primary = "17f weighted k=50"
    if addendum:
        after = {p: sha256_file(os.path.join(ROOT, p)) for p in UNFROZEN}
        prior["robustness_lag%d_NOT_GATED" % LAG] = {
            "generated": utc_now(),
            "lag_turns": LAG,
            "why": "The gate above is declared at a two-turn gap, which is what #23 asked for. A "
                   "search does not compare positions two turns apart — it compares SIBLING "
                   "branches one action apart, where the boards are far more alike. A leaf can pass "
                   "at two turns and be flat at one, and that leaf is useless in a search. This is "
                   "the finer-granularity check.",
            "NOT_GATED": "No threshold was declared for this lag, so none is applied. These are "
                         "descriptive numbers with intervals. Reading a pass/fail into them after "
                         "the fact is the thing the declaration block exists to forbid.",
            "n_pairs": int(len(pi)),
            "games": len(games),
            "positions_scored": int(len(X)),
            # THE pass/verdict/failed FIELDS ARE STRIPPED, and this is not tidiness. evaluate() is
            # shared with the gate, so it stamps every arm with the two-turn thresholds applied to a
            # one-turn number. Leaving them here would put a quotable "pass": true inside a block
            # whose own header says no threshold was declared for it, which is exactly how a
            # descriptive figure gets promoted to a result by a reader in a hurry.
            "arms": {k: {kk: vv for kk, vv in v.items() if kk not in ("verdict", "failed")}
                     for k, v in ((k2, {k3: ({k4: v4 for k4, v4 in v3.items() if k4 != "pass"}
                                             if isinstance(v3, dict) else v3)
                                        for k3, v3 in v2.items()})
                                  for k2, v2 in results.items())},
            "incidental_accuracy": incidental,
            "unfrozen_sources": {"digest_before": before, "digest_after": after,
                                 "moved_during_run": [p for p in UNFROZEN if before[p] != after[p]]},
        }
        json.dump(prior, open(OUT, "w", encoding="utf-8"), indent=1, allow_nan=False)
        shutil.rmtree(tmp, ignore_errors=True)
        r = results[primary]
        print("\n  ADDENDUM at lag=%d — DESCRIPTIVE, NOT GATED" % LAG)
        print("  separation  median |dscore| %.4f  ci %s" % (r["T1_separation"]["median_abs_dscore"],
                                                             r["T1_separation"]["ci95"]))
        t2 = r["T2_locality"]
        print("  locality    same %.4f vs unrelated %.4f  D=%.4f %s  R=%.3f %s"
              % (t2["mean_abs_dscore_same_game_%d_turns" % LAG], t2["mean_abs_dscore_unrelated_turn_matched"],
                 t2["D_unrelated_minus_same"], t2["D_ci95_game_clustered"], t2["R_same_over_unrelated"],
                 t2["R_ci95_game_clustered"]))
        t3 = r["T3_direction"]
        print("  direction   material %.4f %s   toward-winner %.4f %s"
              % (t3["agreement_with_material_sign"] or 0, t3["ci95_game_clustered"],
                 t3["secondary_moves_toward_eventual_winner"] or 0, t3["secondary_ci95"]))
        print("\nmerged into %s (the gated block is untouched)" % os.path.relpath(OUT, ROOT))
        return
    base_key = "BASELINE material sign"
    ctrl_const = results["CONTROL constant 0.5"]["verdict"]
    ctrl_rand = results["CONTROL uniform random"]["verdict"]
    gate_ok = (ctrl_const == "FAIL" and ctrl_rand == "FAIL"
               and not results["CONTROL uniform random"]["T2_locality"]["pass"]
               and not results["CONTROL uniform random"]["T3_direction"]["pass"])

    after = {p: sha256_file(os.path.join(ROOT, p)) for p in UNFROZEN}
    moved = [p for p in UNFROZEN if before[p] != after[p]]

    verdict = results[primary]["verdict"] if gate_ok else "NO RESULT"
    doc = {
        "generated": utc_now(),
        "run_started": started,
        "by": "engine/porygon2_separation_gate.py",
        "status": "RUN",
        "what": prior.get("what"),
        "verdict": verdict,
        "verdict_of": primary,
        "gate_can_fail": gate_ok,
        "what_this_gate_does_not_say":
            "It says the leaf is BUILDABLE — the score separates, it separates locally, and it "
            "points the right way. It does NOT say the 17 features earn their keep. Compare the "
            "primary arm against `%s` in results: a bare material count is not a broken leaf, and "
            "if it separates about as well then #24 gains a value function that is mostly "
            "alive_diff wearing a k-NN. That comparison is reported and is not part of the "
            "verdict, because no threshold was declared for it before the run." % base_key,
        "gate_can_fail_note":
            "The two deliberately-broken leaves were scored through the identical pipeline. "
            "constant-0.5 -> %s, uniform-random -> %s. A gate that passes a constant is measuring "
            "nothing; a gate that passes noise is measuring spread rather than structure."
            % (ctrl_const, ctrl_rand),
        "declaration_written": declared_at,
        "declaration": DECLARATION,
        "disclosure_smoke_run":
            "A 150-game smoke run of this exact pipeline was executed at 2026-08-06T06:02Z, after "
            "the declaration was written and before the full run, to find bugs. Its numbers were "
            "therefore seen before the headline sample was scored. NO THRESHOLD WAS CHANGED — the "
            "--run guard refuses to proceed if the declaration on disk differs by one character "
            "from the block in the generator, and that check passed. Disclosed rather than omitted "
            "because the smoke run's T2 ratio landed at 0.735 against a 0.75 bar, close enough that "
            "silence about it would be the kind of omission this division exists to prevent.",
        "n_measured": int(len(pi)),
        "n_unit": "same-game position pairs two turns apart, clustered by game for every interval",
        # THE KEYS provenance.js ACTUALLY READS, spelled the way it reads them. The population block
        # below says the same things in prose and the checker cannot see any of it: declaredGamesFrom()
        # looks at `corpus.clean_games` / `n_games` / `provenance.funnel.clean` and nothing else, and
        # `population_ceiling` at top level or under `corpus`. Without these the artifact prints
        # "records no game count — nobody can check what it was built from", which is the state
        # docs/MEASURE.md §5e names as the reason five artifacts sit un-checkable.
        "corpus": {
            "clean_games": eligible,
            "population_ceiling": eligible,
            "population_ceiling_note":
                "NOT the clean corpus (7,992 at read time). This gate's population is the strict "
                "subset of clean ladder games whose RAW LOG is present, names a winner and runs at "
                "least 3 turns. Declared per docs/MEASURE.md §5f so the drift check measures this "
                "against the denominator it can actually reach — the same false positive that made "
                "pory-eval.json permanently 21% behind.",
            "clean_games_in_store": n_clean,
        },
        "population": {
            "source": "clean HUMAN ladder replays — data/games.ladder.raw-logs.jsonl",
            "clean_ids_from": "the FROZEN quality.js + quality-filter.json in release " + RELEASE,
            "clean_games_in_store": n_clean,
            "clean_ids_sha256": ids_sha,
            "population_ceiling": eligible,
            "population_ceiling_note":
                "clean ladder games whose raw log is present AND names a winner AND has at least 3 "
                "turns — a strict subset of the clean corpus, declared per docs/MEASURE.md §5f so "
                "the drift check does not measure this artifact against the wrong denominator.",
            "games_sampled": len(games),
            "games_requested": MAX_GAMES,
            "positions_scored": int(len(X)),
            "held_out": "PORYGON2 trains on self-play only, so every human game here is held out by "
                        "construction. This is the human evaluation its own caveat demands; a "
                        "self-play-only evaluation would have been NO RESULT.",
        },
        "train": {"source": os.path.relpath(self_raw, ROOT), "games": gs, "positions": int(len(Ys))},
        "results": results,
        "incidental_accuracy": incidental,
        "incidental_accuracy_note":
            "These are properly-intervalled, game-clustered accuracies that fell out of the gate. "
            "docs/MODELS.md's 63.59% carries no interval and is marked NOT MEASURED; these numbers "
            "SUPERSEDE NOTHING until that ledger is updated deliberately. They are on a different "
            "sample (this gate's games) from data/porygon2.json's 2,274.",
        "feature_weights": fw_report,
        "engine_release_note":
            "NONE of PORYGON2's own sources are in the engine release's frozen set: not "
            "engine/porygon2.py, not data/porygon2-species.json, not either corpus. PORYGON2 is a "
            "Python model and REL.require is a JavaScript shim, so it cannot be loaded through the "
            "release at all. What the release DID supply is the clean-game predicate "
            "(engine/quality.js + data/quality-filter.json), read through REL.require. The files "
            "the release cannot cover were photographed by this script instead — see "
            "unfrozen_sources.",
        "unfrozen_sources": {
            "digest_before": before,
            "digest_after": after,
            "moved_during_run": moved,
            "method": "copied into a private tree and imported from the copy, then the live "
                      "originals re-digested. The two append-only stores are pinned by the clean id "
                      "set instead, because a whole-file digest of a file the hourly collector "
                      "appends to would void every run longer than an hour.",
        },
    }
    doc.update(stamp)
    # A GATE RE-RUN MUST NOT SILENTLY DELETE THE ADDENDUM. `doc` is built fresh, so without this a
    # re-run of --run drops every robustness_* block written by --addendum and nothing says a word —
    # the exact shape of loss this repo keeps paying for. Each block carries its own timestamp and
    # its own digest set, so carrying it forward cannot launder a stale number: it still says when it
    # was computed and against what.
    for k, v in prior.items():
        if k.startswith("robustness_") and k not in doc:
            doc[k] = v
    if moved:
        doc["void"] = False
        doc["void_note"] = ("These unfrozen sources moved while the run was in flight: %s. The run "
                            "read the SNAPSHOT, so the numbers are valid for the digest_before "
                            "bytes — they simply no longer describe HEAD." % ", ".join(moved))
    json.dump(doc, open(OUT, "w", encoding="utf-8"), indent=1, allow_nan=False)

    shutil.rmtree(tmp, ignore_errors=True)

    print("\n  === %s ===" % verdict)
    r = results[primary]
    print("  T1 separation  median |dscore| %.4f  %s" % (r["T1_separation"]["median_abs_dscore"],
                                                          "PASS" if r["T1_separation"]["pass"] else "FAIL"))
    t2 = r["T2_locality"]
    print("  T2 locality    same %.4f vs unrelated %.4f   D=%.4f %s  R=%.3f   %s"
          % (t2["mean_abs_dscore_same_game_%d_turns" % LAG], t2["mean_abs_dscore_unrelated_turn_matched"],
             t2["D_unrelated_minus_same"], t2["D_ci95_game_clustered"], t2["R_same_over_unrelated"],
             "PASS" if t2["pass"] else "FAIL"))
    t3 = r["T3_direction"]
    print("  T3 direction   %.4f %s   %s" % (t3["agreement_with_material_sign"] or 0,
                                             t3["ci95_game_clustered"], "PASS" if t3["pass"] else "FAIL"))
    print("  negative controls: constant -> %s, random -> %s  (gate_can_fail=%s)"
          % (ctrl_const, ctrl_rand, gate_ok))
    print("\nwrote %s" % os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    if "--declare" in sys.argv:
        declare()
    elif "--addendum" in sys.argv:
        run(addendum=True)
    elif "--run" in sys.argv:
        run()
    else:
        print(__doc__)
        print("usage: porygon2_separation_gate.py --declare | --run | --addendum")
