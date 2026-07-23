#!/usr/bin/env python3
"""Fix A.1 from THESIS-REVIEW-v2: JOLTEON is a decent ranker but an OVERCONFIDENT
forecaster — its held-out log-loss (0.699) is worse than a coin (0.693). Over-
confidence is a scalar defect with a scalar fix: temperature scaling (Platt).

We divide the model's logits by a temperature T>1 learned on a calibration slice
carved out of TRAIN (never the test set — that would be leakage). p_cal =
sigmoid(logit / T). Then we re-score on the untouched test split.

  run:  python engine/calibrate.py
"""
import os, sys, json
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import jolteon as J
from eval_harness import load_with_ratings, brier, logloss, acc, boot_ci

def main():
    rows = load_with_ratings(os.path.join(HERE, '../data/games.ladder.jsonl'))
    cut = int(len(rows) * 0.8); tr, te = rows[:cut], rows[cut:]
    # carve a calibration slice from the END of train (temporal, no leakage into test)
    vcut = int(len(tr) * 0.85); fit_rows, val_rows = tr[:vcut], tr[vcut:]
    core = lambda R: [(a, b, y, d) for (a, b, y, d, *_ ) in R]
    sp, idx, counts = J.build(core(fit_rows)); n = len(sp)
    Xf, Yf = J.featurize(core(fit_rows), sp, idx)
    Xv, Yv = J.featurize(core(val_rows), sp, idx)
    Xt, Yt = J.featurize(core(te), sp, idx)
    l2v = J.l2_vector(counts, n_extra=2)
    sw = J.recency_weights(core(fit_rows), float(os.environ.get('HALF_LIFE', '30')))
    w = J.fit(Xf, Yf, l2=l2v, sw=sw)

    logit_v = Xv @ w; logit_t = Xt @ w
    def ll_T(T):
        p = 1 / (1 + np.exp(-(logit_v / T))); p = np.clip(p, 1e-6, 1 - 1e-6)
        return -np.mean(Yv * np.log(p) + (1 - Yv) * np.log(1 - p))
    # 1-D search for the temperature that minimises validation log-loss
    Ts = np.linspace(0.5, 6.0, 111)
    T = float(Ts[np.argmin([ll_T(t) for t in Ts])])
    # refine
    Ts2 = np.linspace(max(0.3, T - 0.1), T + 0.1, 81)
    T = float(Ts2[np.argmin([ll_T(t) for t in Ts2])])

    y = Yt.astype(float)
    p_uncal = 1 / (1 + np.exp(-logit_t))
    p_cal = 1 / (1 + np.exp(-(logit_t / T)))
    p_coin = np.full(len(y), 0.5)
    r1 = np.array([r[4] if r[4] is not None else np.nan for r in te], float)
    r2 = np.array([r[5] if r[5] is not None else np.nan for r in te], float)
    p_elo = 1 / (1 + 10 ** ((r2 - r1) / 400.0)); p_elo = np.where(np.isnan(p_elo), 0.5, p_elo)

    print(f"fitted temperature T = {T:.2f}  (T>1 means the model was overconfident)\n")
    print(f"{'model':<28}{'acc':>7}{'Brier':>10}{'log-loss':>18}")
    for name, p in [('coin (0.5)', p_coin), ('player Elo', p_elo),
                    ('JOLTEON uncalibrated', p_uncal), ('JOLTEON + temperature', p_cal)]:
        lo, hi = boot_ci(logloss, p, y)
        print(f"{name:<28}{acc(p,y):>7.3f}{brier(p,y):>10.3f}{logloss(p,y):>10.3f} [{lo:.3f},{hi:.3f}]")

    ll_c, ll_u, ll_k, ll_e = logloss(p_coin, y), logloss(p_uncal, y), logloss(p_cal, y), logloss(p_elo, y)
    print("\nVERDICT")
    print(f"  uncalibrated {ll_u:.3f}  ->  calibrated {ll_k:.3f}   (coin {ll_c:.3f}, Elo {ll_e:.3f})")
    verdict = []
    if ll_k < ll_c: verdict.append("now beats the coin")
    if ll_k < ll_e: verdict.append("now beats player-Elo")
    print("  calibrated JOLTEON " + (", ".join(verdict) if verdict else "still does not beat baselines — needs the interaction term, not just calibration") + " in log-loss.")
    json.dump({'temperature': T, 'logloss': {'coin': ll_c, 'elo': float(ll_e),
              'uncal': float(ll_u), 'cal': float(ll_k)}},
              open(os.path.join(HERE, '../data/calibration.json'), 'w'), indent=2)
    print("\nsaved temperature -> data/calibration.json  (apply logit/T in JOLTEON's predict path)")

if __name__ == '__main__':
    main()
