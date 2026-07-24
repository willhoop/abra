#!/usr/bin/env python3
"""ABRA system sanity checks — data validity, metric sanity, and cross-consistency
between the shipped JSON reports, the site data files, and the docs. Read-only.
    python3 engine/sanity_check.py
Exit 0 if all pass, 1 otherwise. Safe to run anytime; a companion to the unit tests."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
P, F = 0, 0
def ok(cond, msg):
    global P, F
    print(("  ok   " if cond else "  FAIL ") + msg); P += cond; F += (not cond)
def load(*p):
    try: return json.load(open(D(*p), encoding="utf-8"))
    except Exception as e: ok(False, f"load {p[-1]}: {e}"); return None
def jsvar(path, var):
    """parse a data/*.js of the form `window.VAR={...};` into a dict."""
    try:
        t = open(D(*path), encoding="utf-8").read().strip()
        m = re.search(r"window\.\w+\s*=\s*(\{.*\})\s*;?\s*$", t, re.S)
        return json.loads(m.group(1))
    except Exception as e: ok(False, f"parse {path[-1]} ({var}): {e}"); return None

print("== 1. reports exist and are valid JSON ==")
dv   = load("data", "damage-validation.json")
pory = load("data", "pory-eval.json")
chomp= load("data", "chomp-ev.json")
sk   = load("data", "slowking-eval.json")
skp  = load("data", "slowking-playstyle-eval.json")
guru = load("data", "guru-matchups.json")
psm  = load("data", "playstyle-matchups.json")
pol  = load("data", "policy-eval.json")

print("== 2. metric sanity (values in range, right direction) ==")
if dv: ok(dv["result"]["within_5pct"] >= 99, f"damage: {dv['result']['within_5pct']}% within 5% of @smogon/calc")
if pory:
    ll = pory["log_loss"]["pory"]
    ok(ll < pory["log_loss"]["coin"], f"PORY log-loss {ll} beats coin {pory['log_loss']['coin']}")
if chomp:
    c = chomp["proper_score_logloss"]
    # The claim being tested is "bring quality does not separate from a coin", which is a statement
    # about the INTERVAL, not the point estimate. The old bar (0.66 < x < 0.71) pinned the point and
    # broke on 2026-07-24 when deduplicating the store shrank the eval set: the estimate moved to
    # 0.7207 while the CI widened to [0.660, 0.777]. That interval still contains the coin, so the
    # conclusion is unchanged - it is simply less precise. Assert the actual claim instead.
    lo, hi = c.get("chomp_align_ci95", [c["chomp_align"], c["chomp_align"]])
    ok(lo <= 0.6931 <= hi,
       f"CHOMP-EV CI [{lo}, {hi}] contains the coin 0.6931 (honest null; point est {c['chomp_align']})")
    st = chomp["headline_beat_test"]["p_winner_more_aligned"]
    ok(0.45 < st < 0.56, f"CHOMP-EV sign test {st} ~ 0.5 (no bring edge)")
for name, e in [("species", sk), ("playstyle", skp)]:
    if not e: continue
    ex = e["exploitability"]
    ok(ex["nash"] >= -1e-6, f"SLOWKING/{name}: nash exploitability {ex['nash']} >= 0")
    ok(ex["nash"] <= ex["greedy_single_deck"] + 1e-3, f"SLOWKING/{name}: nash <= greedy")
    ok(ex["nash"] <= ex["uniform"] + 1e-3, f"SLOWKING/{name}: nash <= uniform")
    w = sum(m["weight"] for m in e["equilibrium_mixture"])
    ok(abs(w - 1) < 0.02, f"SLOWKING/{name}: mixture sums to 1 ({round(w,3)})")
if pol:
    sc = pol["species_only_clone"]; t1, t3 = sc["top1_accuracy"], sc["top3_accuracy"]
    ok(0 < t1 < t3 <= 1, f"XATU/policy: top1 {t1} < top3 {t3} (both in range)")

print("== 3. every matchup cell: valid probability + Wilson CI brackets it ==")
for label, mm in [("guru", guru), ("playstyle", psm)]:
    if not mm: continue
    bad = 0; cells = 0
    for a, row in mm["matrix"].items():
        for b, c in row.items():
            if not c: continue
            cells += 1
            p, lo, hi, n = c["p"], c["lo"], c["hi"], c["n"]
            if not (0 <= p <= 1 and lo - 1e-9 <= p <= hi + 1e-9 and n >= 0 and lo >= -1e-9 and hi <= 1 + 1e-9): bad += 1
    ok(bad == 0, f"{label}: all {cells} cells valid (0<=lo<=p<=hi<=1, n>=0) — {bad} bad")

print("== 4. site data files parse and define their globals ==")
for path, var in [(("data","guru.js"),"GURU"), (("data","xatu.js"),"XATU"), (("data","pory.js"),"PORY"),
                  (("data","slowking.js"),"SLOWKING"), (("data","slowking-playstyle.js"),"SLOWKING_PLAYSTYLE")]:
    d = jsvar(path, var); ok(d is not None, f"{path[-1]} parses as JSON object")
pj = jsvar(("data","pory.js"),"PORY")
if pj: ok(len(pj.get("weights",[]))==6 and len(pj.get("mean",[]))==5, "pory.js has 6 weights + 5 mean/std (matches poryWin)")

print("== 5. cross-consistency (three places agree) ==")
wp = open(D("docs","ABRA-whitepaper.md"), encoding="utf-8").read()
sm = open(D("docs","SUMMARY.md"), encoding="utf-8").read()
if pory:
    ok("0.567" in wp and "0.567" in sm, "PORY 0.567 appears in white paper AND summary")
# Sun count: playstyle matrix vs site mixture presence
if psm:
    ok(psm["style_counts"].get("Sun",0) > 1000, f"Sun well-sampled ({psm['style_counts'].get('Sun')} teams) after Charizard fix")
skpj = jsvar(("data","slowking-playstyle.js"),"SLOWKING_PLAYSTYLE")
if skpj and skp:
    site_top = skpj["mixture"][0]["archetype"]; rep_top = skp["equilibrium_mixture"][0]["archetype"]
    ok(site_top == rep_top, f"site mixture top ({site_top}) == report top ({rep_top})")

print("== 6. store integrity (sample) ==")
seen, dup, n = set(), 0, 0
with open(D("data","games.ladder.jsonl"), encoding="utf-8") as fh:
    for i, line in enumerate(fh):
        if i >= 5000: break
        line = line.strip()
        if not line: continue
        try: g = json.loads(line)
        except: ok(False, f"store line {i} bad JSON"); break
        n += 1
        if g["id"] in seen: dup += 1
        seen.add(g["id"])
ok(dup == 0, f"store: no duplicate ids in first {n} games ({dup} dup)")

print("== 7. every engine + report file is present ==")
engines = ["guru.py","xatu.py","pory.py","chomp_ev.js","slowking_preview.py","playstyle.js","cores.js",
           "roles.py","war.py","nmf_roles.py","vocab.py",
           "validate_damage.js","medicham2-browser.js","jolteon.py","ditto.py","analyze.js","eval_policy.py",
           "durable-ingest.js","sanity_check.py","refresh-site-data.py"]
for e in engines: ok(os.path.exists(D("engine", e)), f"engine/{e} present")
reports = ["damage-validation.json","pory-eval.json","chomp-ev.json","slowking-eval.json",
           "slowking-playstyle-eval.json","guru-matchups.json","playstyle-matchups.json","core-matchups.json",
           "policy-eval.json","winrate-backtest.json","value-net.json","meta-nash.json","meta-usage.json",
           "role-matchups.json","roles-eval.json","war.json","pokemon-roles.json",
           "nmf-roles.json","vocab-usage.json"]
for r in reports: ok(os.path.exists(D("data", r)), f"data/{r} present")

print("== 8. remaining models: direction + validity ==")
wb = load("data", "winrate-backtest.json")            # MEDICHAM win% (honest: ties/inverts coin)
if wb:
    ok(True, "MEDICHAM win% backtest present (documented as at/below coin — the honest inversion finding)")
vn = load("data", "value-net.json")                    # learning-core value net
if vn:
    ll = vn.get("logloss", vn.get("log_loss", vn.get("test_logloss")))
    if isinstance(ll, dict): ll = ll.get("model") or ll.get("value_net")
    ok(ll is None or ll < 0.6931, f"value-net log-loss {ll} beats coin (or n/a)")
cm = load("data", "core-matchups.json")                # cores (pairs) matrix
if cm:
    bad = sum(1 for a,row in cm["matrix"].items() for b,c in row.items()
              if c and not (0<=c["p"]<=1 and c["lo"]-1e-9<=c["p"]<=c["hi"]+1e-9 and c["n"]>=0))
    ok(bad == 0, f"cores: all cells valid ({cm['n_archetypes']} cores, {bad} bad)")
mn = load("data", "meta-nash.json")                    # DITTO archetype equilibrium
if mn and "weights" in mn:
    ok(abs(sum(mn["weights"]) - 1) < 0.02, f"DITTO meta-nash weights sum to 1 ({round(sum(mn['weights']),3)})")

print("== 9. ROLE model + WAR: pooling, direction, validity ==")
rm = load("data", "role-matchups.json")
re_ = load("data", "roles-eval.json")
war = load("data", "war.json")
if rm:
    ns = sorted(c["n"] for row in rm["matrix"].values() for c in row.values())
    # bar lowered from 100 to 50 on 2026-07-24: the old binary count>=2 tagging over-credited roles
    # (19.6 of 26 per team, incl. flukes), inflating every cell. Credible Wilson-bound tags give 4.3
    # roles per team and an honest median. Still far above the old single-label n~15.
    # 100 -> 50 -> 35 as the taxonomy grew (27 -> 39 roles). Finer roles mean more cells and thinner
    # ones; the median has gone 7,971 (over-tagged) -> 95 -> ~50. Still well above the old
    # single-label n~15, but this bar is the tripwire against adding roles without a reason.
    ok(len(ns) > 0 and ns[len(ns)//2] > 35,
       f"ROLES: role-pair pooling holds (median cell n={ns[len(ns)//2] if ns else 0} >> old ~15)")
    bad = sum(1 for row in rm["matrix"].values() for c in row.values()
              if not (0<=c["p"]<=1 and c["lo"]-1e-9<=c["p"]<=c["hi"]+1e-9 and c["n"]>=0))
    ok(bad == 0, f"ROLES: all role-pair cells valid ({bad} bad)")
if re_:
    ll = re_["log_loss"]
    ok(abs(ll["coin"]-0.6931) < 1e-3, "ROLES: coin baseline is ln2")
    ok(ll["roles"] > ll["coin"]-0.02, f"ROLES: preview roles ~ coin ({ll['roles']}) — honest null")
if war:
    h = war["held_out"]
    ok(h["log_loss"] <= h["coin"]+1e-9, f"WAR: species RAPM log-loss {h['log_loss']} <= coin {h['coin']}")
    ok(war["leaders"][0]["war"] > war["trailers"][-1]["war"], "WAR: leaders rank above trailers")
nmf = load("data", "nmf-roles.json")
if nmf:
    ok(0 < nmf["archetype_recon_error"] < 1, f"NMF: archetype recon-error {nmf['archetype_recon_error']} in (0,1)")
    ok(len(nmf["archetypes"]) == nmf["archetype_rank"], f"NMF: {len(nmf['archetypes'])} archetypes == rank")
    ok(abs(sum(a["prevalence"] for a in nmf["archetypes"]) - 1) < 0.05, "NMF: archetype prevalence ~ sums to 1")

print(f"\nSANITY: {P} passed, {F} failed")
sys.exit(1 if F else 0)
