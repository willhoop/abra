#!/usr/bin/env python3
"""ABRA evaluation harness — the thing the committee actually asked for.

Answers, on a temporal held-out split with proper scoring rules, confidence
intervals, and calibration:

  Does JOLTEON (team-sheet model) beat honest baselines at PREDICTING games?
    baselines:  coin (0.5)  |  player Elo (pre-game ladder ratings)  |  usage prior
  Is it CALIBRATED (reliability diagram), not just accurate?
  How big are the differences relative to sampling noise (bootstrap 95% CI)?

  run:  python engine/eval_harness.py            [data/games.ladder.jsonl]

This directly implements remediation item #1 of docs/THESIS-REVIEW.md. It refits
JOLTEON on the train split only (no in-sample leakage) using jolteon.py, then
scores every model on the untouched test split.
"""
import sys, os, json, math
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import jolteon as J   # reuse the deployed trainer's featurizer / fitter

STORE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '../data/games.ladder.jsonl')

def load_with_ratings(path, humans_only=True):
    rows, seen = [], set()
    for line in open(path, encoding='utf-8'):
        if not line.strip(): continue
        g = json.loads(line)
        gid = g.get('id')
        if gid in seen: continue
        seen.add(gid)
        if not g.get('winner'): continue
        if humans_only and (g['p1'].get('bot') or g['p2'].get('bot')): continue
        a = [J.idn(x) for x in g['six']['p1']]; b = [J.idn(x) for x in g['six']['p2']]
        if len(a) < 4 or len(b) < 4: continue
        y = 1 if J.idn(g['winner']) == J.idn(g['p1']['name']) else 0
        r1 = g['p1'].get('rating'); r2 = g['p2'].get('rating')
        rows.append((a, b, y, g.get('date', ''), r1, r2))
    rows.sort(key=lambda r: r[3])
    return rows

# ---- proper scoring rules ----
def brier(p, y): return np.mean((p - y) ** 2)
def logloss(p, y):
    p = np.clip(p, 1e-6, 1 - 1e-6); return -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))
def acc(p, y): return np.mean((p >= 0.5).astype(int) == y)

def min_detectable_edge(n, alpha=0.05, power=0.80):
    """The smallest edge over a coin this sample could detect, in accuracy points.

    THE POWER GATE. A null is only a finding if you say how big an effect you could have SEEN.
    "Rating does not beat a coin" and "rating does not beat a coin by more than 5.4 points, at
    n=676" are different statements: the first sounds like a discovery, the second is true and
    tells you exactly when to re-check.

    This project has published several nulls from a three-day store - JOLTEON, preview roles,
    CHOMP-EV, WAR, and the rating ceiling - without ever stating their power. On 2026-07-25 the
    rating ceiling turned out to be underpowered by a factor of about eight: detecting a 2-point
    edge needs ~4,900 games and we had 676.

    Two-sided test of p vs 0.5. Variance is taken at p=0.5, which is the conservative choice and
    also the right one when the whole question is whether p differs from 0.5 at all.
    """
    from math import sqrt
    z_a = 1.959963985 if abs(alpha - 0.05) < 1e-9 else _z(1 - alpha / 2)
    z_b = 0.841621234 if abs(power - 0.80) < 1e-9 else _z(power)
    if not n or n <= 0:
        return None
    return float((z_a + z_b) * sqrt(0.25 / n))


def _z(q):
    """Inverse normal CDF (Acklam's rational approximation). Only used for non-default alpha/power."""
    import math
    a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
         1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
         6.680131188771972e+01, -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
         -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
    pl, ph = 0.02425, 1 - 0.02425
    if q < pl:
        t = math.sqrt(-2 * math.log(q))
        return (((((c[0]*t+c[1])*t+c[2])*t+c[3])*t+c[4])*t+c[5]) / ((((d[0]*t+d[1])*t+d[2])*t+d[3])*t+1)
    if q > ph:
        t = math.sqrt(-2 * math.log(1 - q))
        return -(((((c[0]*t+c[1])*t+c[2])*t+c[3])*t+c[4])*t+c[5]) / ((((d[0]*t+d[1])*t+d[2])*t+d[3])*t+1)
    t = q - 0.5; r = t * t
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*t / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)


def power_block(n, observed_acc=None):
    """The block every model report should carry. Turns a bare null into an honest one."""
    from math import ceil
    mde = min_detectable_edge(n)
    if mde is None:
        return {"n": n, "error": "no sample"}
    out = {
        "n": int(n),
        "min_detectable_edge_pts": round(100 * mde, 2),
        "can_detect_accuracy_at_or_above": round(50 + 100 * mde, 2),
        "games_needed_for": {f"{pts}pt": int(ceil((1.959963985 + 0.841621234) ** 2 * 0.25 / (pts / 100.0) ** 2))
                             for pts in (1, 2, 3, 5)},
        "reading": ("A null here means 'no effect larger than min_detectable_edge_pts was visible at "
                    "this sample size'. It does NOT mean the effect is zero. Quote the two together "
                    "or not at all."),
    }
    if observed_acc is not None:
        edge = abs(100 * (observed_acc - 0.5))
        out["observed_edge_pts"] = round(edge, 2)
        out["powered"] = bool(edge >= 100 * mde)
        out["verdict"] = ("real effect at this sample size" if edge >= 100 * mde
                          else "UNDERPOWERED - cannot distinguish from a coin")
    return out


def boot_ci(metric, p, y, B=2000, seed=0):
    rng = np.random.default_rng(seed); n = len(y); vals = np.empty(B)
    for i in range(B):
        idx = rng.integers(0, n, n); vals[i] = metric(p[idx], y[idx])
    return float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))

def reliability(p, y, bins=10):
    edges = np.linspace(0, 1, bins + 1); out = []
    for i in range(bins):
        m = (p >= edges[i]) & (p < edges[i + 1] if i < bins - 1 else p <= edges[i + 1])
        if m.sum() == 0: out.append((edges[i], edges[i+1], 0, None, None)); continue
        out.append((edges[i], edges[i + 1], int(m.sum()), float(p[m].mean()), float(y[m].mean())))
    return out

def ece(rel, n):
    e = 0.0
    for lo, hi, cnt, conf, obs in rel:
        if cnt and conf is not None: e += (cnt / n) * abs(conf - obs)
    return e

def main():
    rows = load_with_ratings(STORE)
    cut = int(len(rows) * 0.8); tr, te = rows[:cut], rows[cut:]
    # --- refit JOLTEON on train only ---
    tr_core = [(a, b, y, d) for (a, b, y, d, _, _) in tr]
    te_core = [(a, b, y, d) for (a, b, y, d, _, _) in te]
    sp, idx, counts = J.build(tr_core); n = len(sp)
    Xtr, Ytr = J.featurize(tr_core, sp, idx); Xte, Yte = J.featurize(te_core, sp, idx)
    l2v = J.l2_vector(counts, n_extra=2)
    sw = J.recency_weights(tr_core, float(os.environ.get('HALF_LIFE', '30')))
    w = J.fit(Xtr, Ytr, l2=l2v, sw=sw)
    p_jolt = 1 / (1 + np.exp(-(Xte @ w)))
    y = Yte.astype(float)

    # --- baselines on the SAME test split ---
    p_coin = np.full(len(y), 0.5)
    # Elo: only where both pre-game ratings exist; elsewhere fall back to 0.5
    r1 = np.array([r[4] if r[4] is not None else np.nan for r in te], float)
    r2 = np.array([r[5] if r[5] is not None else np.nan for r in te], float)
    p_elo = 1 / (1 + 10 ** ((r2 - r1) / 400.0))
    have_elo = ~np.isnan(p_elo)
    p_elo = np.where(have_elo, p_elo, 0.5)
    # usage prior: team "popularity strength" = mean species usage, logistic on diff
    from collections import Counter
    cnt = Counter(s for a, b, *_ in tr_core for s in a + b); tot = sum(cnt.values())
    use = {s: cnt[s] / tot for s in cnt}
    def ustr(t): return sum(use.get(s, 0) for s in t) / max(1, len(t))
    diff = np.array([ustr(a) - ustr(b) for (a, b, *_ ) in te_core])
    p_use = 1 / (1 + np.exp(-diff / (diff.std() + 1e-9)))

    print(f"ABRA evaluation harness — temporal 80/20 split, humans only")
    print(f"train {len(tr)} games  ·  test {len(te)} games  ·  Elo available on {int(have_elo.sum())}/{len(te)} test games\n")
    print(f"{'model':<26}{'acc':>7}{'Brier':>18}{'log-loss':>20}")
    for name, p in [('coin (0.5)', p_coin), ('player Elo (pre-game)', p_elo),
                    ('usage prior', p_use), ('JOLTEON (held-out)', p_jolt)]:
        a_ = acc(p, y); b_ = brier(p, y); ll = logloss(p, y)
        bl, bh = boot_ci(brier, p, y); lgl, lgh = boot_ci(logloss, p, y)
        print(f"{name:<26}{a_:>7.3f}   {b_:.3f} [{bl:.3f},{bh:.3f}]   {ll:.3f} [{lgl:.3f},{lgh:.3f}]")

    # Elo-only subset comparison (apples to apples where a rating exists)
    if have_elo.sum() > 30:
        ys = y[have_elo]
        print(f"\n--- on the {int(have_elo.sum())} test games where both players have a rating ---")
        for name, p in [('player Elo', p_elo[have_elo]), ('JOLTEON', p_jolt[have_elo])]:
            print(f"{name:<26}{acc(p,ys):>7.3f}   Brier {brier(p,ys):.3f}   log-loss {logloss(p,ys):.3f}")

    # calibration of JOLTEON
    rel = reliability(p_jolt, y); e = ece(rel, len(y))
    print(f"\nJOLTEON calibration (reliability), ECE = {e:.3f}")
    print(f"{'pred bin':<14}{'n':>6}{'mean pred':>12}{'obs freq':>12}")
    for lo, hi, cnt_, conf, obs in rel:
        if cnt_: print(f"[{lo:.1f},{hi:.1f})".ljust(14) + f"{cnt_:>6}{conf:>12.3f}{obs:>12.3f}")

    # verdict
    ll_j = logloss(p_jolt, y); ll_e = logloss(p_elo, y); ll_c = logloss(p_coin, y)
    print("\nVERDICT")
    print(f"  JOLTEON log-loss {ll_j:.3f}  vs  coin {ll_c:.3f}  vs  Elo {ll_e:.3f}")
    if ll_j < ll_e: print("  -> JOLTEON beats the player-Elo baseline in log-loss: the team sheet adds real signal.")
    else:           print("  -> JOLTEON does NOT beat player-Elo: the team-sheet model is not earning its keep.")

    # THE POWER GATE. Print it next to the verdict, always, so a null can never be quoted without
    # the size of the effect it could actually have seen.
    pw = power_block(len(y), observed_acc=float(acc(p_jolt, y)))
    print("\nPOWER")
    print(f"  n = {pw['n']}: can only detect an edge of {pw['min_detectable_edge_pts']} points or more "
          f"(accuracy >= {pw['can_detect_accuracy_at_or_above']}%)")
    print(f"  JOLTEON's observed edge: {pw['observed_edge_pts']} points -> {pw['verdict']}")
    print("  games needed: " + ", ".join(f"{k} {v}" for k, v in pw["games_needed_for"].items()))
    if not pw["powered"]:
        print("  A null at this size is 'not visible', NOT 'not there'. Do not publish it as an effect of zero.")

    out = {'test_n': len(te), 'ece': e,
           'power': pw,
           'logloss': {'coin': ll_c, 'elo': float(ll_e), 'usage': float(logloss(p_use,y)), 'jolteon': float(ll_j)},
           'brier': {'coin': float(brier(p_coin,y)), 'elo': float(brier(p_elo,y)), 'jolteon': float(brier(p_jolt,y))}}
    json.dump(out, open(os.path.join(HERE, '../data/eval-report.json'), 'w'), indent=2)
    print("\nsaved -> data/eval-report.json")

if __name__ == '__main__':
    main()
