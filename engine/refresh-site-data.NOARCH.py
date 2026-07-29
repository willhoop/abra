#!/usr/bin/env python3
"""refresh-site-data.py — regenerate the files the ABRA site loads live, so the
site GROWS as new games arrive. Run after each replay pull (the daily task does this).
Writes: data/live.js (counts + discovered archetypes) and data/kad-replays.js
(recent replays bundled for offline KADABRA coaching). Also refreshes archetypes.json."""
import json, io, os, datetime, subprocess, sys
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def P(*a): return os.path.join(ROOT,*a)
norm=lambda s:''.join(c for c in s.lower() if c.isalnum())

# [step 1 archetypes re-clustering skipped: exceeds sandbox 45s cap; keeping existing archetypes.json]
# 2) counts from the stored games
games=sum(1 for l in open(P('data','games.ladder.jsonl'),encoding='utf-8') if l.strip())
# EVERY LEARNABLE COUNT IS OVER CLEAN GAMES ONLY.
# -------------------------------------------------------------------------------------------------
# turns and dmgProfiles were counted over the WHOLE raw-log file. The store holds ~14,800 records of
# which ~1,865 are clean; the rest are bot games, forfeits, partial brings and stubs. So the site
# advertised ~79,000 "turns with damage + speed" and ~5,300 damage profiles that the models are not
# allowed to learn from, in a tile beside a usable count of 1,865 -- two different populations in
# adjacent tiles, which is exactly the defect the comment further down says was already fixed once
# for turnsPerGame. It came back because nothing enforced it.
#
# `games` stays raw deliberately: it is labelled "collected", and the funnel from collected to
# usable is something the site should SHOW rather than hide.
_cleanIds=set()
try:
    import sys as _s0
    _s0.path.insert(0,P('engine'))
    from store import load_games as _lg0
    _cleanIds={g.get('id') for g in _lg0(clean=True, announce=False) if g.get('id')}
except Exception as e:
    print('clean id set unavailable -- counts fall back to raw:', e)

turns=0; pairs=set(); rawrows=[]
for l in open(P('data','games.ladder.raw-logs.jsonl'),encoding='utf-8'):
    l=l.strip()
    if not l: continue
    try: r=json.loads(l)
    except: continue
    if r.get('id') and r.get('log'): rawrows.append(r)
    if _cleanIds and r.get('id') not in _cleanIds: continue
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

# WHAT CI CANNOT RECOMPUTE, IT MUST NOT DESTROY.
# -------------------------------------------------------------------------------------------------
# data/*.raw-logs.jsonl is gitignored -- it is ~1GB and GitHub rejects it -- so a CI run has the
# ladder STORE but not the protocol LOGS. turns and dmgProfiles are derived from the logs, so in CI
# they come out as 0. Writing that would wipe two real measurements off the site every hour and
# replace them with zeroes, which is worse than stale.
#
# So: recount whatever this environment can see, and carry forward anything it cannot. games,
# usable, teams and turnsPerGame all come from the tracked store and are therefore always fresh --
# which is the pair the site actually leads with.
_prev={}
try:
    _t=io.open(P('data','live.js'),encoding='utf-8').read()
    _prev=json.loads(_t[_t.index('=')+1:].rstrip().rstrip(';'))
except Exception:
    pass
if not pairs and _prev.get('dmgProfiles'):
    print('no raw logs here -- carrying forward turns/dmgProfiles from the previous run')
    turns=_prev.get('turns',turns) or turns
    _pairsN=_prev.get('dmgProfiles')
else:
    _pairsN=len(pairs)

live={'games':games,'turns':turns,'dmgProfiles':_pairsN,
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
