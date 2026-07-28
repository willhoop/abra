#!/usr/bin/env python3
"""quality.py - the shared definition of a usable game (Python side).

There is ONE definition, in data/quality-filter.json. This module and engine/quality.js are thin
readers of that file; neither hard-codes a threshold. If they did, we would be back to the fault the
architecture review named: knowledge with more than one home and nothing noticing when they disagree.
tests/test-quality.js asserts both readers select the IDENTICAL set of game ids.

    from quality import load_games, funnel
    games = load_games()                 # clean games only
    games = load_games(clean=False)      # everything
    print(funnel())                      # the counts at each stage
"""
import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.join(_HERE, '..', 'data', 'games.ladder.jsonl')
CONFIG = os.path.join(_HERE, '..', 'data', 'quality-filter.json')


_CFG = None


def config():
    """Memoised: reasons() runs once per game, and re-reading the file each time made the filter
    hundreds of times slower than the work it was doing."""
    global _CFG
    if _CFG is None:
        with open(CONFIG, encoding='utf-8') as fh:
            _CFG = json.load(fh)
    return _CFG


def read_store(path=None):
    """Every record, deduplicated by id, first occurrence wins - the same order-preserving rule as
    engine/dedupe_store.py, so an un-deduped file on disk cannot change a result."""
    seen, out = set(), []
    with open(path or STORE, encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                g = json.loads(line)
            except Exception:
                continue
            gid = g.get('id')
            if gid in seen:
                continue
            seen.add(gid)
            out.append(g)
    return out


def behavioural_bots(games, cfg=None):
    """Accounts that behave like bots regardless of what they are called.

    The decisive signal is TEAM INVARIANCE. A name filter only catches accounts that announce
    themselves; these did not, and they appeared in more than half the games the name filter passed.
    An account that plays hundreds of games without ever changing a slot is running a script.
    Computed once over the whole store, because it is a property of an ACCOUNT, not of a game."""
    cfg = cfg or config()
    r = cfg['rules'].get('exclude_behavioural_bots')
    if not r or not r['on']:
        return set()
    games_by = {}
    teams_by = {}
    for g in games:
        for s_ in ('p1', 'p2'):
            n = (g.get(s_) or {}).get('name')
            if not n:
                continue
            games_by[n] = games_by.get(n, 0) + 1
            six = tuple(sorted((g.get('six') or {}).get(s_) or []))
            if six:
                teams_by.setdefault(n, set()).add(six)
    return {n for n, c in games_by.items()
            if c >= r['min_games']
            and teams_by.get(n)
            and len(teams_by[n]) <= r['max_distinct_teams']}


def had_action(g):
    """Did anything actually happen? One move or one switch is enough.

    Deliberately NOT a turn count: a game can carry turn objects with no action in them, and the
    question the forfeit rule asks is whether the players produced evidence, not how far the clock
    got. Must stay byte-for-byte equivalent to hadAction() in engine/quality.js -- tests/test-quality.js
    compares the two implementations' selections by hash, which is how the drift after the 1.2.0
    forfeit change was caught (JS 3,571 clean, Python 2,684, same store, same config)."""
    for t in (g.get('turns') or []):
        for e in (t.get('ev') or []):
            if e.get('t') in ('m', 's'):
                return True
    return False


def reasons(g, cfg=None, bots=None):
    """Every reason this game is unusable. Empty list means clean. Returning ALL reasons rather than
    the first lets the funnel be reported honestly instead of attributing each drop to one cause."""
    cfg = cfg or config()
    r = cfg['rules']
    bad = []
    if r['exclude_bot_games']['on'] and (g.get('p1', {}).get('bot') or g.get('p2', {}).get('bot')):
        bad.append('bot')
    if bots and (g.get('p1', {}).get('name') in bots or g.get('p2', {}).get('name') in bots):
        bad.append('behavioural_bot')
    if r['exclude_forfeits']['on'] and g.get('forfeit') and not had_action(g):
        bad.append('forfeit_no_action')
    if r['min_turns']['on'] and len(g.get('turns') or []) < r['min_turns']['value']:
        bad.append('short')
    if r['require_full_bring']['on']:
        br = g.get('brought') or {}
        if len(br.get('p1') or []) != 4 or len(br.get('p2') or []) != 4:
            bad.append('partial_bring')
    return bad


def is_clean(g, cfg=None, bots=None):
    return not reasons(g, cfg, bots)


def load_games(clean=True, path=None):
    games = read_store(path)
    if not clean:
        return games
    cfg = config()
    bots = behavioural_bots(games, cfg)
    return [g for g in games if is_clean(g, cfg, bots)]


FUNNEL_STEPS = [
    ('after_bot_filter', 'bot'),
    ('after_behavioural_bots', 'behavioural_bot'),
    ('after_forfeit_filter', 'forfeit_no_action'),
    ('after_min_turns', 'short'),
    ('after_full_bring', 'partial_bring'),
]


def funnel(path=None):
    """Counts at each successive stage, cumulative: 'what survives everything up to and including
    this rule'.

    DERIVED FROM reasons(), NOT RE-IMPLEMENTED BESIDE IT. This used to be a second copy of every
    rule -- a third copy overall, counting engine/quality.js -- and the copies drifted the moment one
    rule changed. Mirrors FUNNEL_STEPS in engine/quality.js exactly."""
    games = read_store(path)
    cfg = config()
    bots = behavioural_bots(games, cfg)
    all_reasons = [reasons(g, cfg, bots) for g in games]
    out = {'collected': len(games)}
    applied = []
    for label, code in FUNNEL_STEPS:
        applied.append(code)
        out[label] = sum(1 for rs in all_reasons if not any(x in applied for x in rs))
    out['clean'] = sum(1 for rs in all_reasons if not rs)
    known = {c for _, c in FUNNEL_STEPS}
    orphan = sorted({x for rs in all_reasons for x in rs} - known)
    if orphan:
        out['unaccounted_reasons'] = orphan
    return out


if __name__ == '__main__':
    f = funnel()
    total = f['collected']
    print('GAME QUALITY FUNNEL')
    labels = [('collected', 'collected from Showdown'),
              ('after_bot_filter', 'after removing NAMED bot games'),
              ('after_behavioural_bots', 'after removing accounts that behave like bots'),
              ('after_forfeit_filter', 'after removing forfeits'),
              ('after_min_turns', 'after removing games under 3 turns'),
              ('after_full_bring', 'after requiring all four brought to be revealed')]
    prev = total
    for key, label in labels:
        if key not in f:
            continue
        n = f[key]
        drop = prev - n
        print(f"  {label:<48} {n:>6}  ({100*n/total:5.1f}% of collected)"
              + (f"   -{drop}" if drop else ""))
        prev = n
    print(f"\n  USABLE: {f['clean']} of {total} ({100*f['clean']/total:.1f}%)")
