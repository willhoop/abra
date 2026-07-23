#!/usr/bin/env python3
"""
GURU — the meta/matchup model (v2 input I5). The sage that has watched every battle.

Builds the archetype-vs-archetype matchup matrix from REAL game outcomes (not the biased simulator),
with Wilson confidence intervals. This is the structural fix for the bias that inverted MEDICHAM: we
rate matchups by what *actually happened*, not by what a greedy rollout imagines.

Outputs data/guru-matchups.json (matrix + which matchups are statistically decisive) and a held-out
honest test: can the real-outcome matchup prior predict game winners better than a coin / usage baseline?
(We expect per-game prediction to stay near the format ceiling — the VALUE is the validated structure,
i.e. which archetypes reliably beat which, with CIs — used by SLOWKING/DITTO instead of the sim.)
"""
import json, os, math, collections
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
GAMES=os.path.join(ROOT,"data","games.ladder.jsonl")
ARCH=os.path.join(ROOT,"data","archetypes.json")
OUT=os.path.join(ROOT,"data","guru-matchups.json")
norm=lambda s:"".join(c for c in s.lower() if c.isalnum())

def wilson(k,n,z=1.96):
    if n==0: return (0.5,0.0,1.0)
    p=k/n; d=1+z*z/n
    c=(p+z*z/(2*n))/d; h=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
    return (p, max(0.0,c-h), min(1.0,c+h))

# archetype cores (discovered from data by archetypes.py); assign each team to best-overlap archetype
arch=json.load(open(ARCH))["archetypes"]
cores=[(a["n"], set(norm(x) for x in a["core"])) for a in arch]
def assign(team):
    tset=set(norm(x) for x in team)
    best,bs=None,-1
    for name,core in cores:
        ov=len(tset & core)
        if ov>bs: bs=ov; best=name
    return best if bs>0 else "Other"

rows=[]
for line in open(GAMES,encoding="utf-8"):
    line=line.strip()
    if not line: continue
    g=json.loads(line)
    six=g.get("six") or {}; p1=six.get("p1"); p2=six.get("p2"); w=g.get("winner")
    if not (p1 and p2 and w): continue
    y = 1 if w==g.get("p1",{}).get("name") else (0 if w==g.get("p2",{}).get("name") else None)
    if y is None: continue
    a1,a2=assign(p1),assign(p2)
    rows.append((a1,a2,y))

# temporal split for the honest predictive test
split=int(len(rows)*0.8); train,test=rows[:split],rows[split:]

# build the matchup matrix from ALL games (symmetric accumulation): wins of A over B
names=sorted({a for a,_,_ in rows}|{b for _,b,_ in rows})
win=collections.defaultdict(lambda:[0,0])  # (A,B) -> [A_wins, total]
for a,b,y in rows:
    win[(a,b)][0]+=y; win[(a,b)][1]+=1
    win[(b,a)][0]+=(1-y); win[(b,a)][1]+=1
matrix={}; decisive=[]
for a in names:
    matrix[a]={}
    for b in names:
        if a==b: matrix[a][b]=None; continue
        k,n=win[(a,b)]
        p,lo,hi=wilson(k,n)
        matrix[a][b]={"p":round(p,3),"lo":round(lo,3),"hi":round(hi,3),"n":n}
        if n>=30 and (lo>0.5 or hi<0.5):
            decisive.append({"a":a,"b":b,"p":round(p,3),"ci":[round(lo,3),round(hi,3)],"n":n})
decisive.sort(key=lambda d:-abs(d["p"]-0.5))

# honest predictive test: predict game winner from the TRAIN matchup prior; log-loss vs coin & usage
pr=collections.defaultdict(lambda:[0,0])
base=[0,0]
for a,b,y in train:
    pr[(a,b)][0]+=y; pr[(a,b)][1]+=1; base[0]+=y; base[1]+=1
def clamp(p): return max(0.03,min(0.97,p))
ll_g=ll_c=ll_u=0.0; nt=0; correct=0; dec=0
p_usage=clamp(base[0]/base[1]) if base[1] else 0.5
for a,b,y in test:
    k,n=pr[(a,b)]
    p = clamp((k+1)/(n+2)) if n>=5 else p_usage
    ll_g+=-(y*math.log(p)+(1-y)*math.log(1-p))
    ll_c+=-(y*math.log(0.5)+(1-y)*math.log(0.5))
    ll_u+=-(y*math.log(p_usage)+(1-y)*math.log(1-p_usage))
    if abs(p-0.5)>0.02: dec+=1; correct+= 1 if (p>0.5)==(y==1) else 0
    nt+=1
res={
  "generated":"engine/guru.py — archetype matchup matrix from REAL outcomes (Wilson CIs)",
  "n_games":len(rows),"n_archetypes":len(names),"archetypes":names,
  "decisive_matchups":decisive[:20],
  "n_decisive":len(decisive),
  "predictive_test":{"test_games":nt,
     "log_loss_matchup_prior":round(ll_g/nt,4) if nt else None,
     "log_loss_coin":round(ll_c/nt,4) if nt else None,
     "log_loss_usage":round(ll_u/nt,4) if nt else None,
     "winner_pick_accuracy":round(correct/dec,4) if dec else None,
     "note":"per-game prediction is expected near the coin (format ceiling); GURU's VALUE is the validated matchup STRUCTURE below."},
  "matrix":matrix,
}
json.dump(res,open(OUT,"w"),indent=2)
print(f"GURU: {len(rows)} games, {len(names)} archetypes, {len(decisive)} statistically-decisive matchups (n>=30, CI excludes 50%)")
for d in decisive[:8]:
    print(f"  {d['a']:22s} beats {d['b']:22s} {d['p']*100:4.0f}%  CI[{d['ci'][0]*100:.0f}-{d['ci'][1]*100:.0f}]  n={d['n']}")
pt=res["predictive_test"]
print(f"  predictive test: matchup-prior log-loss {pt['log_loss_matchup_prior']} vs coin {pt['log_loss_coin']} vs usage {pt['log_loss_usage']}  (winner-pick {pt['winner_pick_accuracy']})")
