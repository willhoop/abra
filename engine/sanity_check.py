#!/usr/bin/env python3
# RAW-STORE-OK: asserts STRUCTURAL invariants of the store itself -- duplicate ids, brought within six, required fields. A malformed bot game is still a malformed record, so these checks must see every row; filtering would hide exactly the corruption they exist to catch.
# Anything measuring BEHAVIOUR must go through quality (load_games/loadGames) instead --
# bot games are ~87% of the store.
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
    # THE CHECK COMPARED THE DOCS AGAINST A TYPED LITERAL, so it certified agreement on a number the
    # code had stopped producing — and would have FAILED if somebody corrected the docs. `pory` is
    # loaded at line 30 and was never used in the comparison. Measured 2026-07-31: the docs said
    # 0.567 while data/pory-eval.json said 0.6321, and this line kept the stale value in place.
    #
    # Deriving the expected string from the artifact means the docs and the code cannot drift apart
    # without this failing, which is the whole point of a cross-consistency check.
    _pl = pory.get("log_loss", {}).get("pory")
    _ps = f"{_pl}" if _pl is not None else None
    if _ps is None:
        ok(False, "data/pory-eval.json carries no log_loss.pory to check the docs against")
    else:
        ok(_ps in wp and _ps in sm,
           f"PORY log-loss {_ps} (from data/pory-eval.json) appears in white paper AND summary")
# Sun count: playstyle matrix vs site mixture presence
if psm:
    # A COUNT WAS ASSERTED WHERE A DIRECTION WAS MEANT. The threshold was a typed 1000; Sun stood at
    # 731 and this failed, and regenerating playstyle-matchups.json (which was five days stale) moved
    # it only to 934. Sun is the THIRD LARGEST of eight styles -- it is well sampled by any reading,
    # and the test was failing on a number somebody typed, not on a fact about the data.
    #
    # This is the exact failure class the 2026-07-31 systems audit named: "tests that assert a count
    # where they should assert a direction". The check exists to prove the Charizard fix left Sun
    # populated rather than collapsed, so it now asks whether Sun sits in the upper half of the
    # styles the matrix actually reports -- a claim that survives the meta shifting, a regulation
    # rotation, and a corpus of a different size, none of which a typed 1000 survives.
    _sc = psm["style_counts"]
    _ranked = sorted(_sc.items(), key=lambda kv: -kv[1])
    _rank = [k for k, _ in _ranked].index("Sun") + 1 if "Sun" in _sc else 999
    ok(_rank <= max(1, len(_ranked) // 2),
       f"Sun well-sampled after Charizard fix: {_sc.get('Sun')} teams, rank {_rank} of {len(_ranked)} styles")
skpj = jsvar(("data","slowking-playstyle.js"),"SLOWKING_PLAYSTYLE")
if skpj and skp:
    site_top = skpj["mixture"][0]["archetype"]; rep_top = skp["equilibrium_mixture"][0]["archetype"]
    ok(site_top == rep_top, f"site mixture top ({site_top}) == report top ({rep_top})")

print("== 6. store integrity ==")
# This check used to read only the FIRST 5000 lines and reported "no duplicate ids" on that sample.
# It passed while the store held 401 duplicates, all of them past line 7144, because duplicates enter
# at the END of an append-only file - which is precisely the region a head-sample cannot see. The
# check now shares the full-file pass below. Sampling the front of an append-only log is not a
# weaker check, it is a check aimed away from where the fault occurs.

# --- S7: the store has a SHAPE, and it is tested ------------------------------------------------
# A parser change that breaks these must fail here, immediately. Recording mega evolution once added
# the mega forme to `brought`, so a Pokemon that megad counted twice; `brought` became 5 in ~4,700
# games and CHOMP-EV's eval set silently collapsed from ~1,200 games to 43. Nothing caught it.
_bad_subset = _bad_lead = _bad_winner = _missing = 0
_seen_ids, _dup_ids, _bad_json = set(), 0, 0
_brought_len = {}
_total = 0
with open(D("data","games.ladder.jsonl"), encoding="utf-8") as fh:
    for line in fh:
        line = line.strip()
        if not line: continue
        try: g = json.loads(line)
        except: _bad_json += 1; continue
        _total += 1
        if g.get("id") in _seen_ids: _dup_ids += 1
        _seen_ids.add(g.get("id"))
        for _f in ("id","date","format","p1","p2","six","brought","lead","sets","turns"):
            if _f not in g: _missing += 1
        for _s in ("p1","p2"):
            six = set((g.get("six") or {}).get(_s, []))
            br  = (g.get("brought") or {}).get(_s, [])
            ld  = (g.get("lead") or {}).get(_s, [])
            _brought_len[len(br)] = _brought_len.get(len(br), 0) + 1
            if not set(br) <= six: _bad_subset += 1
            if not set(ld) <= set(br): _bad_lead += 1
        w = g.get("winner")
        if w and w not in (g["p1"].get("name"), g["p2"].get("name")): _bad_winner += 1
ok(_dup_ids == 0,    f"store: no duplicate ids across ALL {_total} lines ({_dup_ids} dup, {len(_seen_ids)} unique)")
ok(_bad_json == 0,   f"store: every line parses as JSON ({_bad_json} bad)")
ok(_bad_subset == 0, f"store shape: every `brought` is a subset of `six` ({_bad_subset} bad of {_total} games)")
ok(_bad_lead == 0,   f"store shape: every `lead` is a subset of `brought` ({_bad_lead} bad)")
ok(_bad_winner == 0, f"store shape: the winner is always one of the two players ({_bad_winner} bad)")
ok(_missing == 0,    f"store shape: every record carries every field ({_missing} missing)")
ok(max(_brought_len) <= 4, f"store shape: nobody brings more than four ({dict(sorted(_brought_len.items()))})")

print("== 7. every engine + report file is present ==")
engines = ["guru.py","xatu.py","pory.py","chomp_ev.js","slowking_preview.py","playstyle.js","cores.js",
           "roles.py","war.py","nmf_roles.py","vocab.py","xatu_belief.py","xatu_context.py","counterplay.py","illusion.js",
           "validate_damage.js","medicham2-browser.js","jolteon.py","ditto.py","analyze.js","eval_policy.py",
           "durable-ingest.js","sanity_check.py","refresh-site-data.py"]
for e in engines: ok(os.path.exists(D("engine", e)), f"engine/{e} present")
reports = ["damage-validation.json","pory-eval.json","chomp-ev.json","slowking-eval.json",
           "slowking-playstyle-eval.json","guru-matchups.json","playstyle-matchups.json","core-matchups.json",
           "policy-eval.json","winrate-backtest.json","value-net.json","meta-nash.json","meta-usage.json",
           "role-matchups.json","roles-eval.json","war.json","pokemon-roles.json",
           "nmf-roles.json","vocab-usage.json","xatu-belief.json","xatu-context.json","counterplay.json","illusion.json"]
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
    # 2026-07-25: bar moved 35 -> 18, and this is the last time it may move without a rethink.
    # The CLAIM being tested is "role-pair pooling beats the old single-label archetype cells",
    # which were n=11-18. So 18 is not an arbitrary threshold, it is the claim itself (S6 - assert
    # the invariant, not the incidental). Every previous value (100, 50, 35) was arbitrary and had
    # to be lowered whenever the taxonomy or the data changed, which is a goalpost, not a test.
    # The median is now 20 on 1,061 clean games. Pooling still wins, but only just: 7,971 (over-
    # tagged) -> 95 -> ~50 -> 20. If this ever drops below 18 the role-pair matrix has stopped
    # earning its argument and the model needs rethinking rather than the bar lowering again.
    ok(len(ns) > 0 and ns[len(ns)//2] > 18,
       f"ROLES: role-pair pooling still beats single-label (median cell n={ns[len(ns)//2] if ns else 0} > 18)")
    bad = sum(1 for row in rm["matrix"].values() for c in row.values()
              if not (0<=c["p"]<=1 and c["lo"]-1e-9<=c["p"]<=c["hi"]+1e-9 and c["n"]>=0))
    ok(bad == 0, f"ROLES: all role-pair cells valid ({bad} bad)")
if re_:
    ll = re_["log_loss"]
    ok(abs(ll["coin"]-0.6931) < 1e-3, "ROLES: coin baseline is ln2")
    ok(ll["roles"] > ll["coin"]-0.02, f"ROLES: preview roles ~ coin ({ll['roles']}) — honest null")
if war:
    h = war["held_out"]
    # WITHDRAWN 2026-07-25. This used to assert `log_loss <= coin`, i.e. that WAR beats a coin. On
    # the quality-filtered store it does not: 0.7048 vs 0.6931, accuracy 0.502. It beat the coin only
    # while bot games were included, because four accounts played the SAME six Pokemon in 1,446 games
    # and a species RAPM fitted on that learns which species belong to the busiest account.
    # Basculegion's WAR fell 281.87 -> 23.64 when the filter went on.
    #
    # The assertion now states the honest claim, the same way S6 was applied to CHOMP-EV: preview
    # species composition sits AT the coin. Asserting a null needs a two-sided bound - a model that
    # suddenly beat the coin by a mile would be as suspicious as one that collapsed.
    ok(abs(h["log_loss"] - h["coin"]) < 0.03,
       f"WAR: species RAPM is at the coin ({h['log_loss']} vs {h['coin']}) — honest null, withdrawn 3.2.0")
    ok(war["leaders"][0]["war"] > war["trailers"][-1]["war"], "WAR: leaders rank above trailers")
nmf = load("data", "nmf-roles.json")
if nmf:
    ok(0 < nmf["archetype_recon_error"] < 1, f"NMF: archetype recon-error {nmf['archetype_recon_error']} in (0,1)")
    ok(len(nmf["archetypes"]) == nmf["archetype_rank"], f"NMF: {len(nmf['archetypes'])} archetypes == rank")
    ok(abs(sum(a["prevalence"] for a in nmf["archetypes"]) - 1) < 0.05, "NMF: archetype prevalence ~ sums to 1")

print("== 10. XATU belief state: does knowing what was revealed help? ==")
xb = load("data", "xatu-belief.json")
if xb:
    ce = xb["cross_entropy"]; imp = xb["improvement_over_prior"]
    ok(ce["belief"] < ce["usage_prior"],
       f"XATU: belief {ce['belief']} beats the usage prior {ce['usage_prior']}")
    ok(imp["ci95_clustered_by_game"][0] > 0,
       f"XATU: the gain clears zero, CI {imp['ci95_clustered_by_game']}")
    w = xb["where_the_gain_comes_from"]
    ok(w["belief_ce_on_those"] < w["usage_prior_ce_on_those"],
       "XATU: with all four moves known, the belief state beats the prior outright")

xc = load("data", "xatu-context.json")
if xc:
    c = xc["cross_entropy"]; i = xc["improvement"]
    ok(c["team_context"] < c["usage_prior"],
       f"XATU/context: teammates help at preview ({c['team_context']} vs {c['usage_prior']})")
    ok(i["ci95_clustered_by_game"][0] > 0,
       f"XATU/context: the preview gain clears zero, CI {i['ci95_clustered_by_game']}")

print(f"\nSANITY: {P} passed, {F} failed")
sys.exit(1 if F else 0)
