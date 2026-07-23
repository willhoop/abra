#!/usr/bin/env python3
"""
XATU — the belief model (v2 input I1). Foresees the opponent's hidden info.

From REAL replays, builds the opponent belief: per species, the distribution over its likely
item / ability / moves (what set are they on?) and its move-usage prior (what will they click?),
each with counts so confidence is honest. This is the validated backbone the capstone (ALAKAZAM)
and the coach (KADABRA) read to reason about hidden information. Exports a compact browser file.

Bar: this is the same behaviour-clone validated in eval_policy.py (top-1 ~36%, top-3 ~72% on
held-out human moves) — a modest but honestly-measured opponent prior, not an oracle.
"""
import json, os, collections
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
GAMES=os.path.join(ROOT,"data","games.ladder.jsonl")
RAW=os.path.join(ROOT,"data","games.ladder.raw-logs.jsonl")
norm=lambda s:"".join(c for c in s.lower() if c.isalnum())

item=collections.defaultdict(collections.Counter)
abil=collections.defaultdict(collections.Counter)
lead=collections.Counter(); n_teams=0
for line in open(GAMES,encoding="utf-8"):
    line=line.strip()
    if not line: continue
    g=json.loads(line)
    for sp,st in (g.get("sets") or {}).items():
        if st.get("item"): item[sp][norm(st["item"])]+=1
        if st.get("ability"): abil[sp][norm(st["ability"])]+=1
    for p in ("p1","p2"):
        n_teams+=1
        for sp in (g.get("lead") or {}).get(p,[]): lead[sp]+=1

# move-usage prior per species from actual clicks (the belief over next move)
mv=collections.defaultdict(collections.Counter); slot={}
for line in open(RAW,encoding="utf-8"):
    line=line.strip()
    if not line: continue
    try: r=json.loads(line)
    except: continue
    slot={}
    for ln in r.get("log","").split("\n"):
        if ln.startswith("|switch|") or ln.startswith("|drag|"):
            p=ln.split("|");
            if len(p)>=4: slot[p[2].split(":")[0].strip()]=norm(p[3].split(",")[0])
        elif ln.startswith("|move|"):
            p=ln.split("|")
            if len(p)>=4:
                sp=slot.get(p[2].split(":")[0].strip()); m=norm(p[3])
                if sp and m: mv[sp][m]+=1

def topk(c,k=4):
    tot=sum(c.values()) or 1
    return [[m,round(n/tot,3),n] for m,n in c.most_common(k)]
species=sorted(set(item)|set(abil)|set(mv))
belief={}
for sp in species:
    belief[sp]={
        "item": topk(item[sp],2),
        "ability": topk(abil[sp],2),
        "moves": topk(mv[sp],6),
    }
out={"generated":"engine/xatu.py — opponent belief from real replays","n_species":len(species),"n_teams":n_teams,"belief":belief}
json.dump(out,open(os.path.join(ROOT,"data","xatu.json"),"w"),separators=(",",":"))
# compact browser file
with open(os.path.join(ROOT,"data","xatu.js"),"w",encoding="utf-8") as f:
    f.write("window.XATU="+json.dumps(belief,separators=(",",":"))+";\n")
print(f"XATU: belief for {len(species)} species (item/ability/moves) from real replays -> data/xatu.js")
# show a sample
for sp in ["garchomp","incineroar","gholdengo"]:
    if sp in belief:
        b=belief[sp]; mvs=", ".join(m[0] for m in b["moves"][:4])
        print(f"  {sp}: item {b['item'][0][0] if b['item'] else '?'} | ability {b['ability'][0][0] if b['ability'] else '?'} | moves {mvs}")
