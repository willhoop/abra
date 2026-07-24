#!/usr/bin/env python3
"""build_roles_js.py — emit data/roles.js (window.ROLES) for the site: the role taxonomy, each
species' role DISTRIBUTION, and the role-pair matrix summary. Trimmed for browser weight.
    python3 engine/build_roles_js.py
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
pr = json.load(open(D("data","pokemon-roles.json"), encoding="utf-8"))
ev = json.load(open(D("data","roles-eval.json"), encoding="utf-8"))
mm = json.load(open(D("data","role-matchups.json"), encoding="utf-8"))

species = {}
for mon, d in pr["species"].items():
    if not d["roles"]: continue
    species[mon] = {
        "n": d["sets_seen"],
        # role -> [p, lo, hi] only for credible roles, sorted desc by p
        "r": {r: [d["all_roles"][r]["p"], d["all_roles"][r]["lo"], d["all_roles"][r]["hi"]]
              for r in sorted(d["roles"], key=lambda x: -d["roles"][x])},
    }
out = dict(
    generated=pr["generated"], n_games=pr["n_games"],
    rate_floor=pr["rate_floor"], present_at=pr["present_at"],
    labels=pr["roles"],
    log_loss=ev["log_loss"], accuracy=ev.get("accuracy_roles"),
    win_credit=ev["role_win_credit"],
    ko_credit=ev["ko_credit_top"][:20],
    pooling=ev["pooling"],
    role_present=mm.get("role_present", {}),
    species=species,
)
with open(D("data","roles.js"), "w", encoding="utf-8") as f:
    f.write("window.ROLES=" + json.dumps(out, separators=(",",":")) + ";\n")
print(f"wrote data/roles.js — {len(species)} species, {len(out['labels'])} roles, "
      f"{os.path.getsize(D('data','roles.js')):,} bytes")
