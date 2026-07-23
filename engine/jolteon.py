#!/usr/bin/env python3
"""JOLTEON — Joint Odds, Ladder-Trained Expected-Outcome Network (ABRA Tier-1).

Win-probability model over two teams. v2 combines three signals, all learned from
the durable store (temporal split, humans only, calibrated by Brier / log-loss):

  1. SPECIES  — Bradley-Terry per-species strength (team A multihot minus team B).
  2. SPEED    — team speed edge from the dynamics model (who empirically moves
                first, scarfers included).  data/dynamics.json
  3. FIREPOWER— team observed damage output (mean % of each mon's real moves).

Antisymmetric by construction: swapping A and B negates every feature, so
P(A>B) = 1 - P(B>A) exactly.

  train:   python engine/jolteon.py train  [data/games.ladder.jsonl]
  predict: python engine/jolteon.py predict "garchomp,incineroar,..." "kingambit,..."
"""
import sys, json, math, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
STORE   = os.path.join(HERE, '../data/games.ladder.jsonl')
WEIGHTS = os.path.join(HERE, '../data/jolteon-weights.json')
DYN     = os.path.join(HERE, '../data/dynamics.json')
idn = lambda s: ''.join(c for c in (s or '').lower() if c.isalnum())

# ---- dynamics-derived per-species scalars (speed rate, firepower) -----------
def load_dynamics():
    spd, fire = {}, {}
    if os.path.exists(DYN):
        d = json.load(open(DYN))
        for s, v in d.get('speed', {}).items():
            spd[s] = v.get('firstRate', 0.5)
        best = {}
        for k, v in d.get('damage', {}).items():
            sp = k.split('|', 1)[0]
            best[sp] = max(best.get(sp, 0), v.get('mean', 0))   # best move's mean damage
        for s, m in best.items():
            fire[s] = m / 100.0
    return spd, fire
SPD, FIRE = load_dynamics()
def team_speed(team):   return sum(SPD.get(s, 0.5)  for s in team) / max(1, len(team))
def team_fire(team):    return sum(FIRE.get(s, 0.5) for s in team) / max(1, len(team))

def load(path, humans_only=True):
    rows=[]
    for line in open(path, encoding='utf-8'):
        if not line.strip(): continue
        g=json.loads(line)
        if not g.get('winner'): continue
        if humans_only and (g['p1'].get('bot') or g['p2'].get('bot')): continue
        a=[idn(x) for x in g['six']['p1']]; b=[idn(x) for x in g['six']['p2']]
        if len(a)<4 or len(b)<4: continue
        y = 1 if idn(g['winner'])==idn(g['p1']['name']) else 0
        rows.append((a,b,y,g.get('date','')))
    rows.sort(key=lambda r:r[3])          # temporal order
    return rows

def build(rows, min_count=25):
    from collections import Counter
    cnt=Counter(s for a,b,_,_ in rows for s in a+b)
    sp=sorted(s for s,c in cnt.items() if c>=min_count)   # pool rare species (anti-overfit)
    idx={s:i for i,s in enumerate(sp)}
    return sp, idx

def featurize(rows, sp, idx):
    """multihot species diff  ++  [speed edge, firepower edge]  ->  X, Y."""
    n=len(sp)
    X=np.zeros((len(rows), n+2)); Y=np.zeros(len(rows))
    for k,(a,b,y,_) in enumerate(rows):
        for s in a:
            if s in idx: X[k,idx[s]]+=1
        for s in b:
            if s in idx: X[k,idx[s]]-=1
        X[k,n]   = team_speed(a) - team_speed(b)     # speed edge
        X[k,n+1] = team_fire(a)  - team_fire(b)      # firepower edge
        Y[k]=y
    return X,Y

def fit(X,Y,l2=2.0,iters=6000,lr=0.3):
    n=X.shape[1]; w=np.zeros(n)
    for _ in range(iters):
        p=1/(1+np.exp(-(X@w)))
        grad=X.T@(p-Y)/len(Y) + l2*w/len(Y)
        w-=lr*grad
    return w

def brier(p,y): return float(np.mean((p-y)**2))
def acc(p,y):   return float(np.mean((p>=0.5).astype(int)==y))
def logloss(p,y):
    p=np.clip(p,1e-6,1-1e-6); return float(-np.mean(y*np.log(p)+(1-y)*np.log(1-p)))

if __name__=='__main__':
    cmd = sys.argv[1] if len(sys.argv)>1 else 'train'
    if cmd=='train':
        rows=load(sys.argv[2] if len(sys.argv)>2 else STORE)
        cut=int(len(rows)*0.8); tr,te=rows[:cut],rows[cut:]
        sp,idx=build(tr); n=len(sp)
        Xtr,Ytr=featurize(tr,sp,idx); Xte,Yte=featurize(te,sp,idx)
        # ablation: species-only vs species+dynamics
        w_sp=fit(Xtr[:,:n],Ytr);           p_sp=1/(1+np.exp(-(Xte[:,:n]@w_sp)))
        w=fit(Xtr,Ytr);                    pte =1/(1+np.exp(-(Xte@w)))
        p50=np.full(len(Yte),.5)
        print(f"trained on {len(tr)} games, tested on {len(te)} (humans only, temporal split)")
        print(f"features: {n} species + speed-edge + firepower-edge\n")
        print(f"{'model':<34}{'acc':>8}{'Brier':>9}{'logloss':>9}")
        print(f"{'baseline: always 0.5':<34}{acc(p50,Yte):>8.3f}{brier(p50,Yte):>9.3f}{logloss(p50,Yte):>9.3f}")
        print(f"{'JOLTEON v1 (species only)':<34}{acc(p_sp,Yte):>8.3f}{brier(p_sp,Yte):>9.3f}{logloss(p_sp,Yte):>9.3f}")
        print(f"{'JOLTEON v2 (+speed +firepower)':<34}{acc(pte,Yte):>8.3f}{brier(pte,Yte):>9.3f}{logloss(pte,Yte):>9.3f}")
        print(f"\nlearned dynamics weights:  speed-edge={w[n]:+.2f}   firepower-edge={w[n+1]:+.2f}")
        order=np.argsort(w[:n])
        print("Strongest species:", [(sp[i],round(float(w[i]),2)) for i in order[::-1][:8]])
        print("Weakest species:  ", [(sp[i],round(float(w[i]),2)) for i in order[:6]])
        json.dump({'species':sp,'w':[float(x) for x in w],'has_dynamics':bool(SPD)}, open(WEIGHTS,'w'))
        print(f"\nsaved model -> {WEIGHTS}")
    elif cmd=='predict':
        M=json.load(open(WEIGHTS)); sp=M['species']; idx={s:i for i,s in enumerate(sp)}; w=np.array(M['w']); n=len(sp)
        def feat(team):
            t=[idn(s) for s in team.split(',')]
            v=np.zeros(n+2)
            for s in t:
                if s in idx: v[idx[s]]+=1
            v[n]=team_speed(t); v[n+1]=team_fire(t)
            return v
        A,B=sys.argv[2],sys.argv[3]
        x=feat(A)-feat(B)
        p=float(1/(1+np.exp(-(x@w))))
        print(f"P({A.split(',')[0]}... beats {B.split(',')[0]}...) = {p:.3f}")
