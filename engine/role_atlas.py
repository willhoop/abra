#!/usr/bin/env python3
"""role_atlas.py — the MASTER LIST: every move and every ability, and what role(s) it is tagged as.
Generated from engine/roles.py (single source of truth) crossed with real usage from the store, so
the atlas can never drift from the tagger. Writes docs/ROLE-ATLAS.md.
    python3 engine/role_atlas.py
"""
import json, os, importlib.util
from collections import Counter, defaultdict
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
spec = importlib.util.spec_from_file_location("roles", D("engine","roles.py"))
R = importlib.util.module_from_spec(spec); spec.loader.exec_module(R)

NEUTRAL = {"Protect","Detect","Substitute","Endure","Spiky Shield"}
mv2r, ab2r = defaultdict(set), defaultdict(set)
for r, sig in R.ROLE_SIGNALS.items():
    for m in sig.get("moves", set()): mv2r[m].add(r)
    for a in sig.get("abilities", set()): ab2r[a].add(r)
for m in R.PHYS: mv2r[m].add("phys_attacker")
for m in R.SPEC: mv2r[m].add("spec_attacker")
for m, rs in R.ROLE_OVERRIDE.items(): mv2r[m] = set(rs)      # override table is authoritative

use_mv, use_ab = Counter(), Counter()
for line in open(D("data","games.ladder.jsonl"), encoding="utf-8"):
    line = line.strip()
    if not line: continue
    try: g = json.loads(line)
    except Exception: continue
    for t in (g.get("turns") or []):
        for e in t.get("ev", []):
            if e.get("t") == "m" and e.get("mv"): use_mv[e["mv"]] += 1
    for mon, s in (g.get("sets") or {}).items():
        if s.get("ability"): use_ab[s["ability"]] += 1

lab = lambda r: R.ROLE_SIGNALS[r]["label"]
seen_moves = set(use_mv) | set(mv2r)
seen_abils = set(use_ab) | set(ab2r)
L = []
L.append("# Role Atlas — every move and ability, and what it is tagged as\n")
L.append(f"**ABRA · generated from `engine/roles.py` · {__import__('datetime').date.today().isoformat()}**\n")
L.append("Generated directly from the tagger, so it cannot drift. `uses` = real in-battle uses for "
         "moves, revealed sets for abilities. Blank role = deliberately untagged (ordinary damage, "
         "a passive modifier, or a gap worth filling).\n")
L.append(f"Roles in the taxonomy: **{len(R.ROLES)}**. "
         f"Moves listed: **{len(seen_moves)}**. Abilities listed: **{len(seen_abils)}**.\n")

L.append("\n## Roles in the taxonomy\n\n| key | label |\n|---|---|")
for r in R.ROLES: L.append(f"| `{r}` | {lab(r)} |")

L.append("\n## Multi-role moves (override table — authoritative)\n")
L.append("These do several jobs at once; the table is factual, not weighted.\n")
L.append("| move | roles |\n|---|---|")
for m, rs in sorted(R.ROLE_OVERRIDE.items()):
    L.append(f"| **{m}** | {', '.join(lab(x) for x in sorted(rs))} |")

L.append("\n## Every ability\n\n| uses | ability | tagged as |\n|---|---|---|")
for a in sorted(seen_abils, key=lambda x: (-use_ab[x], x)):
    rs = ", ".join(lab(x) for x in sorted(ab2r.get(a, [])))
    L.append(f"| {use_ab[a]} | {a} | {rs or '—'} |")

L.append("\n## Every move\n\n| uses | move | tagged as |\n|---|---|---|")
for m in sorted(seen_moves, key=lambda x: (-use_mv[x], x)):
    rs = ", ".join(lab(x) for x in sorted(mv2r.get(m, [])))
    if m in NEUTRAL: rs = "_(neutral — everyone runs it)_"
    L.append(f"| {use_mv[m]} | {m} | {rs or '—'} |")

untag = [(use_mv[m], m) for m in seen_moves if not mv2r.get(m) and m not in NEUTRAL and use_mv[m] > 0]
untag.sort(reverse=True)
L.append("\n## Untagged moves with real usage (candidates to tag)\n\n| uses | move |\n|---|---|")
for c, m in untag[:50]: L.append(f"| {c} | {m} |")

open(D("docs","ROLE-ATLAS.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
print(f"wrote docs/ROLE-ATLAS.md — {len(seen_moves)} moves, {len(seen_abils)} abilities, "
      f"{len(R.ROLES)} roles; {len(untag)} untagged-with-usage")
