#!/usr/bin/env python3
"""How predictable is Pokémon Champions? An empirical study over the durable store.

Three questions, all answered from stored data:
  1. RATINGS — how often does the higher-rated player actually win? Binned by
     rating gap, compared to what the Elo formula predicts.
  2. MODEL   — how well-calibrated is JOLTEON, and what is the practical ceiling
     of team-sheet prediction (how confident can any pre-game model honestly be)?
  3. CEILING — the "how often does the better side win" curve.

  python engine/predictability.py
"""
import os, json, math
import numpy as np
HERE=os.path.dirname(os.path.abspath(__file__))
STORE=os.path.join(HERE,'../data/games.ladder.jsonl')
idn=lambda s:''.join(c for c in (s or '').lower() if c.isalnum())

def load():
    seen=set(); G=[]
    for line in open(STORE,encoding='utf-8'):
        if not line.strip(): continue
        g=json.loads(line); gid=g.get('id')
        if gid in seen: continue
        seen.add(gid)
        if not g.get('winner'): continue
        G.append(g)
    return G

G=load()
print(f"games in store: {len(G)}\n")

# ---- 1. RATINGS: how often does the higher-rated player win? ----------------
rated=[]
for g in G:
    r1,r2=g['p1'].get('rating'),g['p2'].get('rating')
    if not r1 or not r2 or g['p1'].get('bot') or g['p2'].get('bot'): continue
    p1won = idn(g['winner'])==idn(g['p1']['name'])
    rated.append((r1,r2,p1won))
print(f"=== 1. RATINGS ===  ({len(rated)} human vs human games with ratings)")
# overall: higher-rated win rate
hz=[ (1 if ((r1>r2)==p1won) else 0) for r1,r2,p1won in rated if r1!=r2 ]
print(f"higher-rated player wins: {100*np.mean(hz):.1f}%  (across {len(hz)} non-tied-rating games)")
# binned by rating gap vs Elo prediction
bins=[(0,25),(25,50),(50,100),(100,200),(200,10000)]
print(f"\n{'rating gap':>12}{'games':>8}{'higher-rated wins':>20}{'Elo predicts':>14}")
for lo,hi in bins:
    sub=[(r1,r2,p1won) for r1,r2,p1won in rated if lo<=abs(r1-r2)<hi]
    if len(sub)<15: continue
    wins=np.mean([1 if ((r1>r2)==p1won) else 0 for r1,r2,p1won in sub])
    gaps=np.mean([abs(r1-r2) for r1,r2,_ in sub])
    elo=1/(1+10**(-gaps/400))
    lab=f"{lo}-{hi}" if hi<10000 else f"{lo}+"
    print(f"{lab:>12}{len(sub):>8}{100*wins:>19.1f}%{100*elo:>13.1f}%")

# ---- 2. MODEL: JOLTEON calibration + prediction ceiling ----------------------
import importlib.util
spec=importlib.util.spec_from_file_location('j',os.path.join(HERE,'jolteon.py'))
J=importlib.util.module_from_spec(spec)
import sys; sys.argv=['j']; spec.loader.exec_module(J)
rows=J.load(STORE)  # humans, temporal
cut=int(len(rows)*0.8); tr,te=rows[:cut],rows[cut:]
sp,idx,counts=J.build(tr)
Xtr,Ytr=J.featurize(tr,sp,idx); Xte,Yte=J.featurize(te,sp,idx)
w=J.fit(Xtr,Ytr,l2=J.l2_vector(counts))
pte=1/(1+np.exp(-(Xte@w)))
print(f"\n=== 2. JOLTEON on held-out ({len(te)} games) ===")
print(f"accuracy {100*J.acc(pte,Yte):.1f}%   Brier {J.brier(pte,Yte):.3f}   log-loss {J.logloss(pte,Yte):.3f}")
# calibration: bin predicted prob -> realized win rate
print(f"\n{'predicted':>12}{'games':>8}{'actually won':>14}")
edges=[0,.35,.45,.55,.65,1.01]
for a,b in zip(edges,edges[1:]):
    mask=(pte>=a)&(pte<b)
    if mask.sum()<10: continue
    print(f"{f'{int(a*100)}-{int(b*100)}%':>12}{int(mask.sum()):>8}{100*Yte[mask].mean():>13.1f}%")
# ceiling: strongest-confidence decile realized rate
order=np.argsort(np.abs(pte-0.5))[::-1]
topconf=order[:max(20,len(pte)//10)]
favored_correct=np.mean((pte[topconf]>=0.5).astype(int)==Yte[topconf])
print(f"\nCEILING: on the {len(topconf)} games JOLTEON is most confident about, the favoured team wins {100*favored_correct:.1f}%.")
print(f"Max honest confidence in this data ~ {100*max(pte.max(),1-pte.min()):.0f}%. The rest is skill + variance the sheet can't see.")
