#!/usr/bin/env python3
"""refresh-site-data.py — regenerate the files the ABRA site loads live, so the
site GROWS as new games arrive. Run after each replay pull (the daily task does this).
Writes: data/live.js (counts + discovered archetypes) and data/kad-replays.js
(recent replays bundled for offline KADABRA coaching). Also refreshes archetypes.json."""
import json, os, datetime, subprocess, sys
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def P(*a): return os.path.join(ROOT,*a)
norm=lambda s:''.join(c for c in s.lower() if c.isalnum())

# 1) refresh discovered archetypes (best-effort; keep old file if it fails)
try:
    subprocess.run([sys.executable, P('engine','archetypes.py')], timeout=120, check=False)
except Exception as e:
    print('archetypes refresh skipped:', e)

# 2) counts from the stored games
games=sum(1 for l in open(P('data','games.ladder.jsonl'),encoding='utf-8') if l.strip())
turns=0; pairs=set(); rawrows=[]
for l in open(P('data','games.ladder.raw-logs.jsonl'),encoding='utf-8'):
    l=l.strip()
    if not l: continue
    try: r=json.loads(l)
    except: continue
    if r.get('id') and r.get('log'): rawrows.append(r)
    log=r.get('log','') ; turns+=log.count('\n|turn|')
    slot={}
    for ln in log.split('\n'):
        if ln.startswith('|switch|') or ln.startswith('|drag|'):
            p=ln.split('|')
            if len(p)>=4: slot[p[2].split(':')[0].strip()]=norm(p[3].split(',')[0])
        elif ln.startswith('|move|'):
            p=ln.split('|')
            if len(p)>=4:
                sp=slot.get(p[2].split(':')[0].strip()); mv=norm(p[3])
                if sp and mv: pairs.add((sp,mv))

arch=[]
try:
    d=json.load(open(P('data','archetypes.json')))
    arch=[{'n':a['n'],'w':a['w_usage'],'t':a['core']} for a in d['archetypes']]
except Exception as e:
    print('arch load err', e)

# --- THE QUALITY FUNNEL, so the site never hardcodes it again ------------------------------------
# The page carried "8,757 collected, 1,124 usable" as literal text in three places, alongside four
# other dataset sizes in four other rooms. All of them were stale, and a prior review that marked
# this FIXED had replaced one hardcoded number with a newer hardcoded number. S13: if it can be
# derived, no human types it. usable is the SAME definition every engine uses -- engine/store.py
# reading data/quality-filter.json -- so the site and the models can never disagree about it.
usable=None
try:
    import sys as _s
    _s.path.insert(0,P('engine'))
    from store import load_games as _lg
    usable=sum(1 for _ in _lg(clean=True, announce=False))
except Exception as e:
    print('usable count unavailable:', e)

# Distinct clean teams -> the matchup space MEW enumerates. Hardcoded on the site as 947,376,
# which was T=1,376; the pool has since grown and the figure went stale unnoticed. Generated now,
# with the site showing the arithmetic rather than a bare number. (S13)
teams=None
cleanTurns=None
try:
    _seen=set()
    _ct=0; _cg=0
    for _g in _lg(clean=True, announce=False):
        for _s in ('p1','p2'):
            _six=(_g.get('six') or {}).get(_s) or []
            if len(_six)>=4: _seen.add('|'.join(sorted(_six)))
        # turns per game must be measured on the SAME population as everything else beside it.
        # It was turns-over-ALL-games (12,872, three-quarters of them bot games) sitting next to a
        # team count computed on clean games only -- two different denominators in adjacent tiles.
        _t=_g.get('turns')
        if isinstance(_t,list): _ct+=len(_t); _cg+=1
    teams=len(_seen)
    cleanTurns=(round(_ct/_cg,1) if _cg else None)
except Exception as e:
    print('team/turn count unavailable:', e)

live={'games':games,'turns':turns,'dmgProfiles':len(pairs),
      'usable':usable,'teams':teams,
      'turnsPerGame':cleanTurns,
      'usablePct':(round(100.0*usable/games,1) if usable and games else None),
      'updated':datetime.date.today().isoformat(),'archetypes':arch}
open(P('data','live.js'),'w',encoding='utf-8').write('window.LIVE='+json.dumps(live,separators=(',',':'))+';\n')

# 3) bundle recent replays for offline KADABRA
recent=rawrows[-40:]
def players(log):
    p={}
    for l in log.split('\n'):
        if l.startswith('|player|'):
            q=l.split('|')
            if len(q)>=4 and q[3]: p[q[2]]=q[3]
    return p.get('p1','?')+' vs '+p.get('p2','?')
m={r['id']:r['log'] for r in recent}
idx=[{'id':r['id'],'label':players(r['log'])} for r in recent]
with open(P('data','kad-replays.js'),'w',encoding='utf-8') as f:
    f.write('window.KAD_REPLAYS='+json.dumps(m,separators=(',',':'))+';\n')
    f.write('window.KAD_INDEX='+json.dumps(idx,separators=(',',':'))+';\n')

# 4) keep app/ copy of the site in sync is handled elsewhere; copy data files next to app too
print(f'refreshed: {games} games, {turns} turns, {len(pairs)} move-dmg pairs, {len(arch)} archetypes, {len(m)} bundled replays')
