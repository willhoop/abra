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


def reasons(g, cfg=None):
    """Every reason this game is unusable. Empty list means clean. Returning ALL reasons rather than
    the first lets the funnel be reported honestly instead of attributing each drop to one cause."""
    cfg = cfg or config()
    r = cfg['rules']
    bad = []
    if r['exclude_bot_games']['on'] and (g.get('p1', {}).get('bot') or g.get('p2', {}).get('bot')):
        bad.append('bot')
    if r['exclude_forfeits']['on'] and g.get('forfeit'):
        bad.append('forfeit')
    if r['min_turns']['on'] and len(g.get('turns') or []) < r['min_turns']['value']:
        bad.append('short')
    if r['require_full_bring']['on']:
        br = g.get('brought') or {}
        if len(br.get('p1') or []) != 4 or len(br.get('p2') or []) != 4:
            bad.append('partial_bring')
    return bad


def is_clean(g, cfg=None):
    return not reasons(g, cfg)


def load_games(clean=True, path=None):
    games = read_store(path)
    if not clean:
        return games
    cfg = config()
    return [g for g in games if is_clean(g, cfg)]


def funnel(path=None):
    """Counts at each successive stage, in the order the rules are applied. Cumulative, so each row
    is 'what survives everything up to and including this rule'."""
    games = read_store(path)
    cfg = config()
    r = cfg['rules']
    out = {'collected': len(games)}
    cur = games
    if r['exclude_bot_games']['on']:
        cur = [g for g in cur if not (g.get('p1', {}).get('bot') or g.get('p2', {}).get('bot'))]
        out['after_bot_filter'] = len(cur)
    if r['exclude_forfeits']['on']:
        cur = [g for g in cur if not g.get('forfeit')]
        out['after_forfeit_filter'] = len(cur)
    if r['min_turns']['on']:
        cur = [g for g in cur if len(g.get('turns') or []) >= r['min_turns']['value']]
        out['after_min_turns'] = len(cur)
    if r['require_full_bring']['on']:
        cur = [g for g in cur
               if len((g.get('brought') or {}).get('p1') or []) == 4
               and len((g.get('brought') or {}).get('p2') or []) == 4]
        out['after_full_bring'] = len(cur)
    out['clean'] = len(cur)
    return out


if __name__ == '__main__':
    f = funnel()
    total = f['collected']
    print('GAME QUALITY FUNNEL')
    labels = [('collected', 'collected from Showdown'),
              ('after_bot_filter', 'after removing bot games'),
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
