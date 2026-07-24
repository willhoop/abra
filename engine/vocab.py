#!/usr/bin/env python3
"""vocab.py — the full vocabulary census: tag EVERY move / ability / item and count how
often each is actually USED in battle (from the turn log), not just revealed on a sheet.

This answers two questions the curated ROLE taxonomy cannot:
  1. Coverage — what fraction of real in-battle move usage do the 24 curated roles actually
     capture, and which high-usage moves fall through the cracks (candidates for a NEW role)?
  2. Usage — the honest denominator. A move "revealed" once is not a move that shapes games;
     battle-usage frequency is the real weight.

It is the substrate for auto-detected roles: once every move/ability is a counted atom, roles can
emerge as clusters of co-used moves (NMF / topic model) instead of being hand-declared — and the
census re-runs on new data, so a rising move surfaces itself.

    python3 engine/vocab.py
Read-only on the store. Pure standard library.
"""
import json, os, math
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
STORE = D("data", "games.ladder.jsonl")

import importlib.util
spec = importlib.util.spec_from_file_location("roles", D("engine", "roles.py"))
roles = importlib.util.module_from_spec(spec); spec.loader.exec_module(roles)

# invert the curated taxonomy: move/ability -> set(roles) that cite it
move_to_roles = defaultdict(set); abil_to_roles = defaultdict(set)
for r, sig in roles.ROLE_SIGNALS.items():
    for m in sig.get("moves", set()): move_to_roles[m].add(r)
    for a in sig.get("abilities", set()): abil_to_roles[a].add(r)
for m in roles.PHYS: move_to_roles[m].add("phys_attacker")
for m in roles.SPEC: move_to_roles[m].add("spec_attacker")
# the override table is authoritative for the moves it lists — without this, multi-role moves
# (Psychic Fangs, Brick Break, Stockpile...) were wrongly reported as untagged.
for m, rs in roles.ROLE_OVERRIDE.items(): move_to_roles[m] = set(rs)

# role-neutral moves: everyone runs them, they carry no archetype signal — excluded from
# the "uncovered = missing role" list and reported separately so they don't fake a low coverage.
NEUTRAL = {"Protect","Detect","Substitute","Endure","Spiky Shield"}

def load_games():
    with open(STORE, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line: continue
            try: yield json.loads(line)
            except Exception: continue

def build():
    reveal_mv = Counter(); reveal_ab = Counter(); reveal_it = Counter()
    battle_mv = Counter()          # actual uses in the turn log
    battle_mv_ko = Counter()       # uses that scored a KO
    n_games = 0; total_move_events = 0
    for g in load_games():
        n_games += 1
        for mon, s in (g.get("sets") or {}).items():
            for m in (s.get("moves") or []): reveal_mv[m] += 1
            if s.get("ability"): reveal_ab[s["ability"]] += 1
            if s.get("item"): reveal_it[s["item"]] += 1
        for t in (g.get("turns") or []):
            for e in t.get("ev", []):
                if e.get("t") == "m" and e.get("mv"):
                    battle_mv[e["mv"]] += 1; total_move_events += 1
                    if e.get("ko"): battle_mv_ko[e["mv"]] += 1

    # coverage: share of NON-neutral in-battle move usage captured by at least one curated role
    denom = sum(c for m, c in battle_mv.items() if m not in NEUTRAL)
    covered = sum(c for m, c in battle_mv.items() if m in move_to_roles and m not in NEUTRAL)
    coverage = covered / denom if denom else 0.0
    neutral_share = sum(c for m, c in battle_mv.items() if m in NEUTRAL) / total_move_events if total_move_events else 0.0

    # high-usage moves NOT tied to any curated role and NOT neutral — the "missing role / ask Will" list
    uncovered = sorted(
        [dict(move=m, battle_uses=c, reveals=reveal_mv[m],
              kos=battle_mv_ko[m], ko_rate=round(battle_mv_ko[m]/c, 3) if c else 0)
         for m, c in battle_mv.items() if m not in move_to_roles and m not in NEUTRAL],
        key=lambda d: -d["battle_uses"])

    moves = sorted(
        [dict(move=m, battle_uses=c, reveals=reveal_mv[m], kos=battle_mv_ko[m],
              ko_rate=round(battle_mv_ko[m]/c, 3) if c else 0,
              roles=sorted(move_to_roles.get(m, [])))
         for m, c in battle_mv.items()],
        key=lambda d: -d["battle_uses"])

    out = dict(
        generated=__import__("datetime").date.today().isoformat(),
        n_games=n_games,
        totals=dict(distinct_moves=len(battle_mv), distinct_abilities=len(reveal_ab),
                    distinct_items=len(reveal_it), move_events=total_move_events),
        role_coverage_of_battle_usage=round(coverage, 4),
        neutral_share_of_usage=round(neutral_share, 4),
        note=("role_coverage = share of NON-neutral in-battle move uses that map to >=1 curated role. "
              "Neutral moves (Protect etc.) are excluded and reported as neutral_share. "
              "uncovered_top = high-usage moves with no role yet — candidates to tag."),
        moves_top=moves[:80],
        uncovered_top=uncovered[:40],
        abilities_top=sorted(
            [dict(ability=a, reveals=c, roles=sorted(abil_to_roles.get(a, [])))
             for a, c in reveal_ab.items()], key=lambda d: -d["reveals"])[:40],
        items_top=sorted([dict(item=i, reveals=c) for i, c in reveal_it.items()],
                         key=lambda d: -d["reveals"])[:40],
    )
    json.dump(out, open(D("data", "vocab-usage.json"), "w"), indent=1)

    print(f"vocab.py — {n_games} games, {total_move_events:,} move events")
    print(f"  distinct: {len(battle_mv)} moves, {len(reveal_ab)} abilities, {len(reveal_it)} items")
    print(f"  curated roles cover {coverage*100:.1f}% of in-battle move usage")
    print("  top uncovered moves (candidate roles):",
          ", ".join(f"{d['move']}({d['battle_uses']})" for d in uncovered[:8]))
    return out

if __name__ == "__main__":
    build()
