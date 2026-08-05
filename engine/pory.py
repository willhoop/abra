#!/usr/bin/env python3
"""
PORY — the learned value net (v2 input I2), CPU/real-data version.

Predicts MID-GAME win probability from board state (mons alive + active HP + turn), trained on real
replays. This is the winnable, testable counterpart to the (impossible) pre-game prediction: mid-game
material/HP advantage genuinely predicts the winner, so this is a real value function for ALAKAZAM's
search leaf and KADABRA's coaching ("you're at 72% here").

Rigor (built to survive an MIT-chair review):
  - temporal train/test split (no leakage); both player perspectives used (symmetric).
  - proper scores: log-loss + Brier, held-out, with bootstrap 95% CIs.
  - honest baselines: coin (0.693) AND a material-sign heuristic (predict by who has more mons).
  - calibration: 10-bin reliability + ECE on held-out.
  - exports compact logistic weights to data/pory.js for in-browser inference.
Feature vector: [1, alive_diff, hp_diff, my_alive, foe_alive, turn/10].
"""
import json, os, math, random
import numpy as np
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
RAW=os.path.join(ROOT,"data","games.ladder.raw-logs.jsonl")
random.seed(0); np.random.seed(0)

def board_states(log):
    """Yield per-turn (turn, p1_alive, p2_alive, p1_hp, p2_hp) using bring-4; hp = mean active HP%%."""
    slotsp={}; hp={}                 # slot -> species, slot -> hp%
    faint={"p1":0,"p2":0}; turn=0; out=[]
    def side_hp(side):
        vals=[hp[s] for s in (side+"a",side+"b") if s in hp and hp[s]>0]
        return sum(vals)/len(vals) if vals else 0.0
    def snap():
        out.append((turn, 4-faint["p1"], 4-faint["p2"], side_hp("p1"), side_hp("p2")))
    for ln in log.split("\n"):
        if ln.startswith("|turn|"):
            try: turn=int(ln.split("|")[2])
            except: pass
            if turn>=1: snap()
        elif ln.startswith("|switch|") or ln.startswith("|drag|") or ln.startswith("|replace|"):
            p=ln.split("|")
            if len(p)>=4:
                slot=p[2].split(":")[0].strip()
                m=None
                if len(p)>4:
                    import re
                    mm=re.search(r"(\d+)\/(\d+)",p[4] if len(p)>4 else "")
                    if mm: m=100*int(mm.group(1))/int(mm.group(2))
                hp[slot]=100.0 if m is None else m
        elif ln.startswith("|-damage|") or ln.startswith("|-sethp|") or ln.startswith("|-heal|"):
            p=ln.split("|")
            if len(p)>=4:
                slot=p[2].split(":")[0].strip()
                import re
                if "fnt" in p[3]: hp[slot]=0.0
                else:
                    mm=re.search(r"(\d+)\/(\d+)",p[3])
                    if mm: hp[slot]=100*int(mm.group(1))/int(mm.group(2))
        elif ln.startswith("|faint|"):
            p=ln.split("|"); slot=p[2].split(":")[0].strip() if len(p)>2 else ""
            side=slot[:2]
            if side in faint: faint[side]+=1
            if slot in hp: hp[slot]=0.0
    return out

def winner_side(log):
    p={"p1":"","p2":""}; win=None
    for ln in log.split("\n"):
        if ln.startswith("|player|"):
            q=ln.split("|")
            if len(q)>=4: p[q[2]]=q[3]
        elif ln.startswith("|win|"): win=ln.split("|")[2].strip()
    if not win: return None
    if win==p["p1"]: return "p1"
    if win==p["p2"]: return "p2"
    return None

# CLEAN GAMES ONLY. PORY learns P(win | board state) from the protocol logs, which is a claim about
# how games actually go. The store is ~15,000 records of which ~1,900 are clean; the rest are bot
# games, forfeits, partial brings and stubs. A bot that plays the same line every game supplies
# thousands of near-identical board states with a correlated outcome, which is the worst possible
# training data for a value function -- it looks like signal and is one account's habit.
def _clean_ids():
    try:
        import sys as _s
        _s.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from store import load_games as _lg
        return {g.get("id") for g in _lg(clean=True, announce=False) if g.get("id")}
    except Exception as e:
        print("PORY: quality filter unavailable (%s) — refusing to train on the raw store." % e)
        return None

def main():
    if not os.path.exists(RAW):
        print("PORY: raw-logs not present — skipping."); return
    _CLEAN=_clean_ids()
    if not _CLEAN:
        print("PORY: no clean id set — aborting rather than training on bot games."); return
    X=[]; Y=[]; order=[]
    gi=0
    for line in open(RAW,encoding="utf-8"):
        line=line.strip()
        if not line: continue
        try: r=json.loads(line)
        except: continue
        if r.get("id") not in _CLEAN: continue
        log=r.get("log","");
        w=winner_side(log)
        if w is None: continue
        states=board_states(log)
        for (t,a1,a2,h1,h2) in states:
            # perspective p1
            X.append([1.0, (a1-a2), (h1-h2)/100.0, a1, a2, t/10.0]); Y.append(1 if w=="p1" else 0); order.append(gi)
            # perspective p2 (symmetric)
            X.append([1.0, (a2-a1), (h2-h1)/100.0, a2, a1, t/10.0]); Y.append(1 if w=="p2" else 0); order.append(gi)
        gi+=1
    X=np.array(X); Y=np.array(Y,dtype=float)
    # temporal split by GAME index (no leakage across the split)
    ng=gi; cut=int(ng*0.8)
    tr=np.array([o<cut for o in order]); te=~tr
    Xtr,Ytr,Xte,Yte=X[tr],Y[tr],X[te],Y[te]
    # standardize (except bias col)
    mu=Xtr[:,1:].mean(0); sd=Xtr[:,1:].std(0)+1e-9
    def stdz(M): Z=M.copy(); Z[:,1:]=(M[:,1:]-mu)/sd; return Z
    Ztr,Zte=stdz(Xtr),stdz(Xte)
    # logistic regression via gradient descent + L2
    w=np.zeros(Ztr.shape[1]); lr=0.3; lam=1e-3
    for _ in range(4000):
        p=1/(1+np.exp(-Ztr@w)); g=Ztr.T@(p-Ytr)/len(Ytr)+lam*w; w-=lr*g
    def pred(Z): return np.clip(1/(1+np.exp(-Z@w)),1e-4,1-1e-4)
    pte=pred(Zte)
    def ll(p,y): return float(np.mean(-(y*np.log(p)+(1-y)*np.log(1-p))))
    def brier(p,y): return float(np.mean((p-y)**2))
    # baselines
    coin_ll=ll(np.full_like(Yte,0.5),Yte)
    # material-sign heuristic: 0.75 if more mons, 0.25 if fewer, 0.5 tie
    diff=Xte[:,3]-Xte[:,4]; heur=np.where(diff>0,0.75,np.where(diff<0,0.25,0.5))
    heur_ll=ll(heur,Yte)
    # THE BASELINE THAT DECIDES WHETHER PORY LEARNED ANYTHING.
    #
    # `heur` above is a 0.75/0.25/0.5 SIGN rule. PORY clears it comfortably and that is arithmetic,
    # not learning: PORY's five features carry TWO degrees of freedom, because every state is emitted
    # from both perspectives with the label flipped. The gradient on any column identical across the
    # two rows cancels exactly (bias, turn/10 -> pinned to 0); the columns that SWAP come out exactly
    # antisymmetric (my_alive/foe_alive) and fold into alive_diff. So PORY IS a logistic on
    # (alive_diff, hp_diff) and the only honest question is whether it beats that.
    #
    # Fitted the same way, on the same standardisation and the same split, so the comparison is about
    # the feature set and nothing else. Verdict gates on the PAIRED difference clustered by game --
    # the point estimates tie to four decimals and an unpaired comparison of two numbers that close
    # tells you nothing about whether the gap is real.
    bcols=[0,1,2]
    wb=np.zeros(len(bcols))
    for _ in range(4000):
        pb=1/(1+np.exp(-Ztr[:,bcols]@wb)); gb=Ztr[:,bcols].T@(pb-Ytr)/len(Ytr)+lam*wb; wb-=lr*gb
    base=np.clip(1/(1+np.exp(-Zte[:,bcols]@wb)),1e-4,1-1e-4)
    base_ll=ll(base,Yte)
    # CLUSTERED bootstrap over GAMES (states within a game are correlated — resampling states
    # would give a falsely-tight CI; resample whole games to be honest).
    te_games=np.array(order)[te]
    uniq=np.unique(te_games)
    by_game={g:np.where(te_games==g)[0] for g in uniq}
    def boot_ci(p,y,B=400):
        vals=[]
        for _ in range(B):
            gs=np.random.choice(uniq,len(uniq),replace=True)
            idx=np.concatenate([by_game[g] for g in gs])
            vals.append(ll(p[idx],y[idx]))
        vals.sort(); return [round(vals[int(.025*B)],4),round(vals[int(.975*B)],4)]
    def paired_ci(pa,pb,y,B=2000):
        """PAIRED, on the same resampled games. Two independently-bootstrapped intervals that
        overlap say nothing about a paired difference; this resamples once and differences inside
        the resample, which is the comparison the verdict is allowed to make."""
        vals=[]
        for _ in range(B):
            gs=np.random.choice(uniq,len(uniq),replace=True)
            idx=np.concatenate([by_game[g] for g in gs])
            vals.append(ll(pa[idx],y[idx])-ll(pb[idx],y[idx]))
        vals.sort(); return [round(vals[int(.025*B)],6),round(vals[int(.975*B)],6)]
    # calibration (10-bin reliability + ECE)
    bins=np.linspace(0,1,11); ece=0.0; rel=[]
    for i in range(10):
        m=(pte>=bins[i])&(pte<bins[i+1])
        if m.sum()>0:
            conf=float(pte[m].mean()); acc=float(Yte[m].mean()); rel.append([round(conf,3),round(acc,3),int(m.sum())])
            ece+=m.sum()/len(pte)*abs(conf-acc)
    acc=float(((pte>0.5)==(Yte==1)).mean())
    out={
      "generated":"engine/pory.py — mid-game win-prob value net from real replays",
      "n_games":ng,"n_states":len(Y),"train_states":int(tr.sum()),"test_states":int(te.sum()),
      # docs/MEASURE.md §5f: this artifact's population is NOT "clean ladder games" — it is clean
      # ladder games whose raw log is PRESENT and NAMES A WINNER, a strict subset. Without this
      # declaration engine/provenance.js measures drift against the full clean corpus and this file
      # can never read below ~21% behind however often it is regenerated. The generator wanted every
      # game it could reach and got every game it could reach, so the ceiling IS the sample size.
      "population_ceiling": ng,
      "population_ceiling_note": "clean ladder games whose raw log is present and names a winner, "
        "at generation time. See docs/MEASURE.md §5f and engine/provenance.js.",
      "log_loss":{"pory":round(ll(pte,Yte),4),"pory_ci95":boot_ci(pte,Yte),
                  "coin":round(coin_ll,4),"material_heuristic":round(heur_ll,4),
                  "material_two_feature":round(base_ll,6),
                  "material_two_feature_note":"A logistic on [alive_diff, hp_diff] ONLY, fitted by the "
                    "same gradient descent, on the same standardisation and the same temporal split. This "
                    "is the baseline the verdict gates on. `material_heuristic` is a crude 0.75/0.25/0.5 "
                    "SIGN rule and beating it is arithmetic, not learning."},
      "paired_vs_material_two_feature":{
          "pory_log_loss":round(ll(pte,Yte),6),"baseline_log_loss":round(base_ll,6),
          "difference":round(ll(pte,Yte)-base_ll,6),
          "ci95_clustered_by_game":paired_ci(pte,base,Yte),
          "bootstrap_B":2000,"n_test_games":int(len(uniq)),
          "direction":"positive = PORY WORSE",
          "baseline_weights_standardised":[round(float(x),5) for x in wb]},
      "brier":{"pory":round(brier(pte,Yte),4),"coin":0.25},
      "accuracy":round(acc,4),"ece":round(ece,4),"reliability":rel,
      "weights":[round(float(x),5) for x in w],"feat_mean":[round(float(x),5) for x in mu],"feat_std":[round(float(x),5) for x in sd],
      "features":["bias","alive_diff","hp_diff","my_alive","foe_alive","turn/10"],
      "verdict": None,
    }
    # THE INTERVAL DECIDES, NOT THE POINT ESTIMATE.
    #
    # This compared point estimates only. PORY scored 0.6739 against a coin's 0.6931, so it printed
    # "PORY beats coin AND the material heuristic - a real, calibrated value net." But PORY's own 95%
    # interval is [0.6264, 0.7321], which CONTAINS the coin, and the material heuristic sits at 0.6793,
    # well inside it too. The file asserted a result its own uncertainty does not support.
    #
    # Same defect as engine/chomp_ev.js on 2026-07-27, where a verdict gated on a point estimate
    # announced a significant CHOMP bring effect that vanished once the interval was computed with a
    # working PRNG. Lower log-loss is better, so clearing a baseline means the interval's UPPER bound
    # is below it.
    #
    # Independent corroboration that the cautious verdict is the right one: data/pory-nn.json trains a
    # network on 1.3M states and lands at 0.6314, against 0.6375 for a two-feature baseline of
    # alive-count plus HP-difference. The whole network buys 0.006 over counting bodies and HP, and the
    # RICHER feature sets score worse than material-only (0.6419 and 0.65). PORY is a material counter.
    #
    # AND THE INTERVAL HAS TO BE AGAINST THE RIGHT BASELINE (2026-08-04).
    #
    # The gate below used to read `hi < coin and hi < material_heuristic`. On the committed 4,623-game
    # sample that is TRUE -- hi=0.6456, coin 0.6931, sign-rule 0.6550 -- so every re-run re-asserted
    # "a real, calibrated value net" TEN DAYS AFTER PORY WAS RETRACTED. Nothing was stale and nothing
    # was left over: the code was answering the wrong question, correctly, every time. Restamping the
    # artifact by hand would have been undone by the next run.
    #
    # The right question is the one docs/MODELS.md's retraction actually asks: does PORY beat the
    # two-feature material logistic it REDUCES TO. Measured, paired and clustered by game, it does not.
    lo, hi = out["log_loss"]["pory_ci95"]
    pv = out["paired_vs_material_two_feature"]
    dlo, dhi = pv["ci95_clustered_by_game"]
    # Lower log-loss is better, so PORY clears the baseline only if the whole paired interval is < 0.
    beats_material = dhi < 0
    beats_coin = hi < out["log_loss"]["coin"]
    if beats_material:
        out["verdict"] = (
            "PORY beats the two-feature material logistic it reduces to: paired difference %.6f, 95%% CI "
            "[%.6f, %.6f] clustered by game, entirely below zero. That is a learned value function and "
            "not a body count." % (pv["difference"], dlo, dhi))
    else:
        out["verdict"] = (
            "PORY IS A MATERIAL COUNTER. Its five features carry two degrees of freedom, and against a "
            "logistic on those two features alone it scores %.6f to %.6f - a paired difference of %+.6f "
            "(positive = PORY worse), 95%% CI [%.6f, %.6f] clustered by game, containing zero. It does "
            "beat a coin (%.4f) and it does beat a crude 0.75/0.25 sign rule (%.4f), and neither of those "
            "is evidence of a learned value function."
            % (pv["pory_log_loss"], pv["baseline_log_loss"], pv["difference"], dlo, dhi,
               out["log_loss"]["coin"], out["log_loss"]["material_heuristic"]))
    # A PRIOR CONCLUSION IS NEVER SILENTLY REWRITTEN. The retracted string travels with the artifact
    # so the withdrawal can be checked rather than believed -- the same shape as
    # data/rollout-r1-withdrawn-join.json.
    out["withdrawn_verdict"] = {
        "withdrawn": True,
        "text": ("PORY beats coin AND the material heuristic on held-out log-loss, interval clear of "
                 "both - a real, calibrated value net."),
        "withdrawn_on": "2026-07-25",
        "restamped_on": "2026-08-04",
        "withdrawn_reason": (
            "PORY was retracted on 2026-07-25 and docs/MODELS.md records the retraction, but this "
            "artifact carried the pre-retraction string for ten days. The string is not false about "
            "what it compared; it is false about what it implies. `material_heuristic` is a "
            "0.75/0.25/0.5 SIGN rule and PORY's interval genuinely clears it. The baseline that decides "
            "whether PORY learned anything is the two-feature logistic PORY reduces to."),
        "why_it_kept_regenerating": (
            "The verdict gate read `hi < coin and hi < material_heuristic`, which is TRUE on this "
            "sample, so the generator re-asserted the withdrawn claim on every run. The gate now reads "
            "the paired difference against the two-feature baseline."),
        "not_withdrawn": (
            "Every measured quantity in this file stands: log_loss, its CI, Brier, accuracy, ECE and "
            "the reliability curve. PORY is well calibrated. It is calibrated at counting bodies and HP."),
    }
    # DERIVED, NEVER TYPED. docs/MODELS.md quoted 1.256 / 1.544 -- correct for the 2026-07-24 run and
    # wrong for every run since the clean filter landed on 2026-07-26. Publishing the reduction from
    # the weights in the same file means a document can be checked against it instead of remembered.
    _sd = out["feat_std"]; _w = out["weights"]
    _raw = {f: _w[i] / _sd[i - 1] for i, f in enumerate(out["features"]) if i >= 1}
    out["reduced_form"] = {
        "note": "DERIVED from `weights` and `feat_std` in this file. Any document quoting PORY's "
                "coefficients must quote these.",
        "expression": "sigmoid(%.4f * alive_diff + %.4f * hp_diff)"
                      % (_raw["alive_diff"] + _raw["my_alive"], _raw["hp_diff"]),
        "alive_diff": round(_raw["alive_diff"] + _raw["my_alive"], 6),
        "hp_diff": round(_raw["hp_diff"], 6),
        "intercept": round(float(_w[0]), 6),
        "turn_over_10": round(_raw["turn/10"], 6),
        "my_alive_plus_foe_alive": round(_raw["my_alive"] + _raw["foe_alive"], 9),
        "why_it_reduces":
            "Every state is emitted from BOTH perspectives with the label flipped, so the gradient on "
            "any feature IDENTICAL across the two rows cancels exactly -- that pins the bias and "
            "turn/10 to zero structurally, not empirically. my_alive and foe_alive SWAP across the two "
            "rows, so their weights come out exactly antisymmetric and fold into alive_diff. Five "
            "features, two degrees of freedom, and no amount of extra data changes that.",
    }
    json.dump(out,open(os.path.join(ROOT,"data","pory-eval.json"),"w"),indent=2)
    with open(os.path.join(ROOT,"data","pory.js"),"w") as f:
        f.write("window.PORY="+json.dumps({"weights":out["weights"],"mean":out["feat_mean"],"std":out["feat_std"],"features":out["features"]},separators=(",",":"))+";\n")
    print(f"PORY: {ng} games -> {len(Y)} board-states (test {int(te.sum())})")
    print(f"  log-loss: PORY {out['log_loss']['pory']} (CI {out['log_loss']['pory_ci95']}) | coin {out['log_loss']['coin']} | material-heuristic {out['log_loss']['material_heuristic']}")
    print(f"  Brier {out['brier']['pory']} vs coin 0.25 | accuracy {out['accuracy']*100:.1f}% | ECE {out['ece']}")
    print(f"  {out['verdict']}")

if __name__=="__main__":
    main()
