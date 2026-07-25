"""store.py — the one way a Python engine reads the game store.

WHY THIS EXISTS
---------------
As of 2026-07-25, 28 engines opened data/games.ladder.jsonl directly and iterated it themselves. Of
8,757 stored games only 1,124 survive the quality filter, so every number those engines published
was computed over a population that is roughly three-quarters bot games — and four undetected bot
accounts played the SAME six Pokemon in 1,446 of them. That is how meta-usage.json came to report one
script's team as the metagame, and how WAR came to "beat a coin" (0.6860) on a signal that vanished
when the bots were removed (0.7048, worse than a coin).

Wiring five engines individually meant pasting the same twenty-line block into five files, which is
S12's exact failure mode: a value with more than one home. This module is the single home.

    from store import load_games, funnel
    games = load_games()                 # quality-filtered, the default
    games = load_games(clean=False)      # everything, for demonstrating the difference

ABRA_UNFILTERED=1 flips the default globally, matching the switch analyze.js already had. It is for
showing what the filter changes, never for publishing.

WHICH POPULATION SHOULD AN ENGINE USE? It depends on the question, and the engine must say which it
asked:
  - usage, metagame, matchups        -> FILTERED. A bot's team enters the statistic directly.
  - claims about the game itself     -> FILTERED. Bots break causal claims.
  - "what will I face on ladder"     -> UNFILTERED. Three in four opponents are bots; that IS the
                                        population a laddering player meets.
  - damage, engine validation        -> irrelevant, either is fine.
"""
import os
import sys
import json
import importlib.util

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)

UNFILTERED = bool(os.environ.get("ABRA_UNFILTERED"))

_quality = None


def _q():
    """Load engine/quality.py by path so this works regardless of how the caller was invoked."""
    global _quality
    if _quality is None:
        spec = importlib.util.spec_from_file_location("quality", os.path.join(_HERE, "quality.py"))
        _quality = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_quality)
    return _quality


def load_games(clean=None, announce=True, path=None):
    """Every game the caller should see, as a list.

    `clean` defaults to True unless ABRA_UNFILTERED is set. A one-line provenance note goes to
    stderr, because a number whose population is invisible is a number nobody can check.
    """
    if clean is None:
        clean = not UNFILTERED
    games = _q().load_games(clean=clean, path=path)
    if announce:
        if clean:
            total = len(_q().read_store(path))
            sys.stderr.write("quality filter: %d usable of %d collected (%.1f%%)\n"
                             % (len(games), total, 100.0 * len(games) / max(1, total)))
        else:
            sys.stderr.write("WARNING: ABRA_UNFILTERED — all %d games, bots and forfeits included\n"
                             % len(games))
    return games


def iter_games(clean=None, announce=True, path=None):
    """Generator form, for engines written around `for g in ...`."""
    return iter(load_games(clean=clean, announce=announce, path=path))


def funnel(path=None):
    """Counts at each filter stage, for provenance blocks."""
    return _q().funnel(path)


def store_path():
    return os.path.join(_ROOT, "data", "games.ladder.jsonl")
