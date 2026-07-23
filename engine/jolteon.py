#!/usr/bin/env python3
"""JOLTEON — Tier-1 win-probability model (ABRA).
Bradley-Terry / logistic regression over per-species strengths, learned from the
durable game store. Antisymmetric by construction: P(A>B)=1-P(B>A). Trains on a
temporal split and reports calibration (Brier) and accuracy against baselines.

  train:   python engine/jolteon.py train  [data/games.ladder.jsonl]
  predict: python engine/jolteon.py predict "garchomp,incineroar,..." "kingambit,..."
"""
import sys, json, math, os
import numpy as np

STORE = 'data/games.ladder.jsonl'
WEIGHTS = 'data/jolteon-weights.json'
idn = lambda s: ''.join(c for c in (s or '').lower() if c.isalnum())

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
    n=len(sp)
    X=np.zeros((len(rows),n)); Y=np.zeros(len(rows))
    for k,(a,b,y,_) in enumerate(rows):
        for s in a:
            if s in idx: X[k,idx[s]]+=1
        for s in b:
            if s in idx: X[k,idx[s]]-=1
        Y[k]=y
    return X,Y,sp,idx

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
        Xtr,Ytr,sp,idx=build(tr)
        w=fit(Xtr,Ytr)
        # test features in the SAME species space
        n=len(sp); Xte=np.zeros((len(te),n)); Yte=np.zeros(len(te))
        for k,(a,b,y,_) in enumerate(te):
            for s in a:
                if s in idx: Xte[k,idx[s]]+=1
            for s in b:
                if s in idx: Xte[k,idx[s]]-=1
            Yte[k]=y
        pte=1/(1+np.exp(-(Xte@w)))
        print(f"trained on {len(tr)} games, tested on {len(te)} (humans only, temporal split)\n")
        print(f"{'model':<28}{'acc':>8}{'Brier':>9}{'logloss':>9}")
        print(f"{'JOLTEON (Bradley-Terry)':<28}{acc(pte,Yte):>8.3f}{brier(pte,Yte):>9.3f}{logloss(pte,Yte):>9.3f}")
        print(f"{'baseline: always 0.5':<28}{acc(np.full(len(Yte),.5),Yte):>8.3f}{brier(np.full(len(Yte),.5),Yte):>9.3f}{logloss(np.full(len(Yte),.5),Yte):>9.3f}")
        # sanity: strongest / weakest learned species
        order=np.argsort(w)
        strong=[(sp[i],round(float(w[i]),2)) for i in order[::-1][:8]]
        weak  =[(sp[i],round(float(w[i]),2)) for i in order[:6]]
        print("\nStrongest species by learned strength:", strong)
        print("Weakest species by learned strength:   ", weak)
        json.dump({'species':sp,'w':[float(x) for x in w]}, open(WEIGHTS,'w'))
        print(f"\nsaved model -> {WEIGHTS}")
    elif cmd=='predict':
        M=json.load(open(WEIGHTS)); idx={s:i for i,s in enumerate(M['species'])}; w=np.array(M['w'])
        def vec(team):
            v=np.zeros(len(w))
            for s in team.split(','):
                s=idn(s)
                if s in idx: v[idx[s]]+=1
            return v
        A,B=sys.argv[2],sys.argv[3]
        p=float(1/(1+np.exp(-((vec(A)-vec(B))@w))))
        print(f"P({A.split(',')[0]}... beats {B.split(',')[0]}...) = {p:.3f}")
