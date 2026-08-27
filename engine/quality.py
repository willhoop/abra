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
import re

_HERE = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.join(_HERE, '..', 'data', 'games.ladder.jsonl')
CONFIG = os.path.join(_HERE, '..', 'data', 'quality-filter.json')
VALIDATION = os.path.join(_HERE, '..', 'data', 'store-validation.json')


_CFG = None


def config():
    """Memoised: reasons() runs once per game, and re-reading the file each time made the filter
    hundreds of times slower than the work it was doing."""
    global _CFG
    if _CFG is None:
        with open(CONFIG, encoding='utf-8') as fh:
            _CFG = json.load(fh)
    return _CFG


def _store_handle(path=None):
    """Open the store, compressed or not. Must match storePath()/readStoreText() in quality.js.

    THE STORE IS TRACKED COMPRESSED. data/games.ladder.jsonl reached 84.6 MB against GitHub's HARD
    100 MB per-file limit -- about 38 hours of collection from the point where every push fails.
    git now tracks <store>.jsonl.gz and .gitignore excludes the plain .jsonl.

    PLAIN WINS WHEN BOTH EXIST: the plain file is the live one the collector appends to, the .gz is a
    commit-time snapshot. Preferring the .gz would serve stale games on the very machine collecting
    them. On a fresh clone only the .gz is present and it is read directly."""
    want = path or STORE
    if os.path.exists(want):
        return open(want, encoding='utf-8')
    if os.path.exists(want + '.gz'):
        import gzip
        return gzip.open(want + '.gz', 'rt', encoding='utf-8')
    return open(want, encoding='utf-8')      # raise with the name the caller asked for


def read_store(path=None):
    """Every record, deduplicated by id, first occurrence wins - the same order-preserving rule as
    engine/dedupe_store.py, so an un-deduped file on disk cannot change a result."""
    seen, out = set(), []
    with _store_handle(path) as fh:
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


_LEGAL = None


def illegal_teams():
    """Game ids whose revealed team Showdown's TeamValidator rejects on a SPECIES or ITEM reason.

    ONE TEST DECIDES WHETHER A CLASS MAY BE KEYED: can a LEGAL team produce it? A species rejection
    cannot be faked - Illusion changes what a body appears to be, not what body is in the replay. A
    declared-item rejection cannot be faked either. A MOVE rejection is faked constantly: a disguised
    Zoroark appears as another species carrying Zoroark's moves, so the validator writes "X can't
    learn Y" - the same sentence a custom-rules game produces. 1,175 games are move-only rejections
    and 1,020 have an Illusion carrier on the same side.

    DO NOT 'COMPLETE' THIS BY ADDING move. It would delete the corpus engine/illusion.js studies, and
    it would do it silently, because a smaller corpus looks exactly like a cleaner one.

    Must stay selection-identical to illegalTeams() in engine/quality.js - tests/test-quality.js
    compares the two implementations' chosen ids by hash."""
    global _LEGAL
    if _LEGAL is not None:
        return _LEGAL
    r = config()['rules'].get('exclude_illegal_teams')
    out = {'on': bool(r and r.get('on')), 'ids': set(), 'source': 'data/store-validation.json',
           'generated': None, 'judged_games': 0, 'classes': (r or {}).get('classes') or [],
           'expected': 0, 'resolved': 0, 'unresolved': 0, 'forme_only_skipped': 0, 'missing': False}
    if not out['on']:
        _LEGAL = out
        return out
    try:
        with open(VALIDATION, encoding='utf-8') as fh:
            v = json.load(fh)
    except Exception as e:                                   # noqa: BLE001 - reported, not swallowed
        # A MISSING VERDICT IS A RULE THAT DID NOT RUN, and it must not look like a clean store.
        import sys
        out['missing'] = True
        print("quality: exclude_illegal_teams is ON but %s would not read (%s); NO game is excluded "
              "for legality. Run: node engine/validate_store.js --write" % (out['source'], e),
              file=sys.stderr)
        _LEGAL = out
        return out
    split = v.get('split') or {}
    out['generated'] = v.get('generated')
    out['judged_games'] = (v.get('judged') or {}).get('games') or 0
    keyed = set(out['classes'])
    pat = (r or {}).get('item_reason_pattern')
    item_rx = re.compile(pat, re.I) if pat else None
    if 'species' in keyed:
        out['ids'].update(split.get('species_flagged_ids') or [])
    for e in (v.get('examples') or []):
        cls = e.get('classes') or []
        if not any(c in keyed for c in cls):
            continue
        # Item-ONLY rows must clear the declared-item pattern; a pure forme-requirement row is our
        # closed-sheet storage convention, not contamination.
        if 'species' not in cls and 'item' in cls and item_rx \
                and not any(item_rx.search(x) for x in (e.get('reasons') or [])):
            out['forme_only_skipped'] += 1
            continue
        out['ids'].add(e.get('id'))
    for combo, n in (split.get('combos') or {}).items():
        if any(c in keyed for c in combo.split('+')):
            out['expected'] += n
    out['resolved'] = len(out['ids'])
    out['unresolved'] = max(0, out['expected'] - out['resolved'] - out['forme_only_skipped'])
    if out['unresolved']:
        import sys
        print("quality: exclude_illegal_teams resolved %d of %d flagged game ids (%d unresolved - "
              "data/store-validation.json publishes species_flagged_ids but not item_flagged_ids, "
              "and its examples list is capped at 500). The filter is UNDER-removing."
              % (out['resolved'], out['expected'], out['unresolved']), file=sys.stderr)
    _LEGAL = out
    return out


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
    ill = r.get('exclude_illegal_teams')
    if ill and ill.get('on') and g.get('id') in illegal_teams()['ids']:
        bad.append('illegal_team')
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
    # LAST, ON PURPOSE - the steps are cumulative, so inserting a rule earlier would move the number
    # printed against every step below it and break comparison with every funnel recorded before
    # 2026-08-27. Mirrors FUNNEL_STEPS in engine/quality.js exactly.
    ('after_legality', 'illegal_team'),
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
    # A filter that makes a number smaller has to say what it removed - count, rate and reason.
    lg = illegal_teams()
    out['legality'] = {
        'on': lg['on'], 'source': lg['source'], 'verdict_generated': lg['generated'],
        'verdict_judged_games': lg['judged_games'], 'classes': lg['classes'],
        'ids_expected': lg['expected'], 'ids_resolved': lg['resolved'],
        'ids_unresolved': lg['unresolved'], 'forme_only_skipped': lg['forme_only_skipped'],
        'verdict_missing': lg['missing'],
        'removed_from_clean': sum(1 for rs in all_reasons if rs == ['illegal_team']),
        'flagged_anywhere': sum(1 for rs in all_reasons if 'illegal_team' in rs),
    }
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
              ('after_full_bring', 'after requiring all four brought to be revealed'),
              ('after_legality', 'after removing teams Showdown rejects (species/item)')]
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
    lg = f.get('legality') or {}
    print('\nLEGALITY EXCLUSION')
    if not lg.get('on'):
        print('  OFF - no game is excluded for legality.')
    elif lg.get('verdict_missing'):
        print(f"  NOT APPLIED - {lg['source']} would not read. "
              f"Run: node engine/validate_store.js --write")
    else:
        print(f"  verdict      {lg['source']}  generated {lg['verdict_generated']}  "
              f"({lg['verdict_judged_games']:,} games judged)")
        print(f"  keyed on     {' | '.join(lg['classes'])}   - move-level rejections are NOT keyed "
              f"(Illusion; see illegal_teams())")
        extra = (f", {lg['forme_only_skipped']} skipped as forme-requirement only"
                 if lg['forme_only_skipped'] else '')
        extra += (f", {lg['ids_unresolved']} UNRESOLVED (under-removing)"
                  if lg['ids_unresolved'] else '')
        print(f"  ids          {lg['ids_resolved']} resolved of {lg['ids_expected']} flagged{extra}")
        base = max(1, f.get('after_full_bring', 1))
        print(f"  removed      {lg['removed_from_clean']} games that passed every other rule "
              f"({100*lg['removed_from_clean']/base:.3f}% of the previously-clean corpus)")
        print(f"  flagged      {lg['flagged_anywhere']} of {total:,} collected "
              f"({100*lg['flagged_anywhere']/total:.3f}%) - the rest were already excluded by another rule")
        if lg['verdict_judged_games'] and lg['verdict_judged_games'] < total:
            print(f"  UNJUDGED     {total - lg['verdict_judged_games']:,} games arrived after the "
                  f"verdict was generated and have not been checked at all.")
