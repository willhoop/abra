#!/usr/bin/env python3
"""DITTO — Double-oracle Iterative Team-Tuning Optimiser (ABRA).

Searches team space for a six that beats the LIVE metagame. The evaluator is
JOLTEON (microseconds per matchup), so DITTO can score thousands of candidate
teams against a gauntlet of REAL ladder teams pulled from the durable store —
not a hand-written gauntlet.

Double-oracle flavour:
  1. Sample the meta: real human high-ladder sixes from the store.
  2. Our-oracle: hill-climb our six (swap members from a usage pool) to maximise
     mean JOLTEON P(win) against the meta sample.
  3. Opponent-oracle: surface the meta teams that best counter our optimised six
     ("what still beats you"), fold the hardest counters back into the gauntlet,
     and re-optimise. Iterate a few rounds.

This is the self-improving team search of the flywheel's stage 3, using stage-1
data and the stage-2 evaluator.

  python engine/ditto.py                         # optimise from a strong seed
  python engine/ditto.py "pelipper,whimsicott,archaludon,basculegion,kingambit,sinistcha"
"""
import sys, os, json, random
import numpy as np
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
import jolteon as J   # reuse idn, dynamics scalars, weights space

STORE=os.path.join(HERE,'../data/games.ladder.jsonl')
WEIGHTS=os.path.join(HERE,'../data/jolteon-weights.json')
random.seed(7)

M=json.load(open(WEIGHTS)); SP=M['species']; IDX={s:i for i,s in enumerate(SP)}; W=np.array(M['w']); N=len(SP)
def vec(six):
    six=[J.idn(s) for s in six]; v=np.zeros(N+2)
    for s in six:
        if s in IDX: v[IDX[s]]+=1
    v[N]=J.team_speed(six); v[N+1]=J.team_fire(six)
    return v
def pwin(a,b):  # JOLTEON P(a beats b)
    x=vec(a)-vec(b); return float(1/(1+np.exp(-(x@W))))

# ---- vectorised fast path: precompute meta once, score any team in O(K) --------
_MW=None; _META=None
def prep(meta):
    global _MW,_META
    _META=meta; _MW=np.array([vec(m)@W for m in meta])   # meta 'strength' scalars
def fast_scores(six):
    """vector of P(six beats each meta team), using precomputed meta scalars."""
    s=vec(six)@W
    return 1/(1+np.exp(-(s-_MW)))

def load_meta(min_rating=1300, cap=400):
    seen=set(); teams=[]
    for line in open(STORE,encoding='utf-8'):
        if not line.strip():continue
        g=json.loads(line)
        for side in ('p1','p2'):
            if g[side].get('bot'):continue
            if (g[side].get('rating') or 0)<min_rating:continue
            six=tuple(sorted(J.idn(x) for x in g['six'][side]))
            if len(six)<6 or six in seen:continue
            seen.add(six); teams.append(list(six))
    random.shuffle(teams); return teams[:cap]

def score(six, meta):
    if _META is meta and _MW is not None: return float(np.mean(fast_scores(six)))
    return float(np.mean([pwin(six,m) for m in meta]))

# ---- usage-weighted threat coverage --------------------------------------------
# "I need an answer to Basculegion on every team, not Camerupt." A team that beats
# the average meta team can still fold to a specific high-usage threat. So we
# measure win rate against the teams that ACTUALLY run each top threat, weight the
# shortfall by how often that threat appears, and penalise it. Rare species
# (Camerupt) carry ~zero usage weight and are ignored automatically.
_MASKS=None; _TOPT=None
def prep_masks(meta, usage, top=10):
    global _MASKS,_TOPT
    _TOPT=sorted(usage, key=lambda s:-usage[s])[:top]
    _MASKS={t:np.array([t in m for m in meta]) for t in _TOPT}
def threat_coverage(six, meta, usage, top=10):
    if _META is not meta or _MASKS is None: prep(meta); prep_masks(meta,usage,top)
    sc=fast_scores(six); cov=[]
    for t in _TOPT:
        mk=_MASKS[t]
        if mk.sum()<4: continue
        cov.append((t, usage[t], float(sc[mk].mean()), int(mk.sum())))
    return cov
def coverage_penalty(six, meta, usage, thresh=0.5, lam=1.5):
    pen=0.0
    for t,u,wr,_ in threat_coverage(six,meta,usage):
        pen += u*max(0.0, thresh-wr)
    return lam*pen
def objective(six, meta, usage):
    return score(six,meta) - coverage_penalty(six,meta,usage)

def hardest(six, meta, k=5):
    return sorted(meta, key=lambda m: pwin(six,m))[:k]

def medicham_check(six, foes, N=150):
    """Vet a JOLTEON-optimised team with grounded MEDICHAM rollouts (Tier-2).
    Exposes evaluator overfit: if MEDICHAM disagrees with JOLTEON, JOLTEON was
    gaming its own blind spots. Runs the JS engine via subprocess."""
    import subprocess
    out=[]
    for foe in foes:
        try:
            r=subprocess.run(['node',os.path.join(HERE,'medicham.js'),
                              ','.join(six[:4]), ','.join(foe[:4]), str(N)],
                             capture_output=True,text=True,timeout=60)
            line=[l for l in r.stdout.splitlines() if 'P(A wins)' in l]
            out.append(float(line[0].split('=')[1]) if line else None)
        except Exception:
            out.append(None)
    return out

def optimise(seed, pool, meta, usage, passes=3):
    team=seed[:]; best=objective(team,meta,usage)
    for _ in range(passes):
        improved=False
        for i in range(len(team)):
            for cand in pool:
                if cand in team: continue
                trial=team[:]; trial[i]=cand
                if len(set(trial))!=len(trial): continue
                sc=objective(trial,meta,usage)
                if sc>best+0.002:
                    team=trial; best=sc; improved=True
        if not improved: break
    return team, best

if __name__=='__main__':
    seed = sys.argv[1].split(',') if len(sys.argv)>1 else \
        ['pelipper','whimsicott','archaludon','basculegion','kingambit','sinistcha']
    seed=[J.idn(s) for s in seed]
    meta=load_meta()
    # usage pool: species that actually appear, most common first
    from collections import Counter
    cnt=Counter(s for m in meta for s in m)
    # PROVEN-META pool only: top-30 most-used species. Constraining to species the
    # ladder actually trusts blunts JOLTEON's rare-species overfit (Goodhart guard).
    pool=[s for s,_ in cnt.most_common(30)]
    usage={s:c/len(meta) for s,c in cnt.items()}
    print(f"meta gauntlet: {len(meta)} real high-ladder teams | proven-meta pool: {len(pool)} species\n")
    print(f"seed team:  {', '.join(seed)}")
    print(f"seed win rate vs meta: {score(seed,meta)*100:.1f}%\n")

    team=seed
    for rnd in range(1,4):   # double-oracle rounds
        prep(meta); prep_masks(meta,usage)
        team,best=optimise(team,pool,meta,usage)
        counters=hardest(team,meta,5)
        print(f"round {rnd}: objective {best*100:.1f}% (win rate minus usage-weighted coverage penalty)")
        print(f"  team: {', '.join(team)}")
        meta = meta + counters*3   # opponent-oracle: up-weight hardest counters, re-optimise
    meta0=load_meta(); prep(meta0); prep_masks(meta0,usage)
    print("\nFINAL TEAM (JOLTEON-optimised)")
    print(' ', ', '.join(team))
    print(f"  JOLTEON mean win rate vs live meta: {score(team,meta0)*100:.1f}%")

    # USAGE-WEIGHTED THREAT COVERAGE — answer to Basculegion, not Camerupt
    print("\nThreat coverage (win rate vs teams that actually run each top-used threat):")
    for t,u,wr,k in threat_coverage(team,meta0,usage):
        print(f"    {t:<14} on {u*100:4.1f}% of teams  ->  {wr*100:4.1f}%  {'OK' if wr>=0.5 else '<< GAP'}")
    ignored=[s for s in usage if usage[s]<0.02]
    print(f"  ({len(ignored)} rare species incl. {', '.join(ignored[:3])} carry ~0 usage weight and are ignored by design.)")

    # ACCOUNTING FOR THE MODEL'S OWN BIAS — where rarity shrinkage suppresses a pick
    counts=M.get('counts')
    if counts:
        cmap={s:counts[i] for i,s in enumerate(SP)}
        low=sorted([(s,cmap.get(s,0)) for s in set(team)|set(pool[:20]) if cmap.get(s,999)<60], key=lambda x:x[1])
        print("\nBias note — JOLTEON is deliberately skeptical of low-sample species (rarity shrinkage):")
        if low:
            for s,c in low[:8]:
                print(f"    {s:<14} {c} games -> rating pulled toward neutral{' (IN TEAM)' if s in team else ''}")
            print("  Under-rated by design, not judged bad. Believe one's the GOAT? MEDICHAM-vet it:")
            print("  JOLTEON-low + MEDICHAM-high = a real sleeper the data just hasn't confirmed yet.")
        else:
            print("    (every pick has a healthy sample — no shrinkage caveats on this team.)")

    # Tier-2 reality check: MEDICHAM rollouts vs a spread of real meta teams.
    sample=random.sample(meta0, min(4,len(meta0)))
    print("\nMEDICHAM vetting (grounded rollouts — catches JOLTEON overfit):")
    mc=medicham_check(team, sample)
    for foe,p in zip(sample,mc):
        tag='' if p is None else ('  <- JOLTEON overconfident' if score([*team],[foe])>p+0.15 else '')
        print(f"    JOLTEON {pwin(team,foe)*100:4.1f}%  |  MEDICHAM {'n/a' if p is None else f'{p*100:4.1f}%'}  vs  {', '.join(foe)}{tag}")
    vals=[p for p in mc if p is not None]
    if vals:
        print(f"\n  MEDICHAM mean: {sum(vals)/len(vals)*100:.1f}%  (vs JOLTEON's optimistic {score(team,meta0)*100:.1f}%)")
        print("  If these disagree a lot, JOLTEON gamed its blind spots — trust MEDICHAM. This gap is")
        print("  the documented reason the pipeline vets Tier-1 picks with Tier-2 before believing them.")
