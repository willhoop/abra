#!/usr/bin/env python3
"""counterplay.py - does the field actually TECH for the top threats?

The question
------------
Players say things like "I run a Fighting move purely for Kingambit". That is a claim about
*deliberate counterplay*: a slot spent not on your own gameplan but on answering someone else's
Pokemon. This measures whether that behaviour is real and how large it is.

Why not the obvious design
--------------------------
The natural test is temporal: does Fighting usage rise AFTER Kingambit usage rises? Our store spans
only three days, so there is no time variation to exploit. Running that test anyway would produce a
number with no identifying variation behind it. So we use a cross-sectional design instead, and say
so plainly.

The design we can identify
--------------------------
1. THREAT PREVALENCE. p(T) = share of team-sixes containing species T. The "meta" is this vector.
2. STANDARD vs TECH. For each species S, p(m | S) = how often its revealed sets carry move m. A move
   with a high share is S's standard kit; a rare one is a *tech slot* - a deliberate deviation.
3. COVERAGE SCORE. For any move m,
       cov(m) = SUM over threats T of  p(T) * eff(type(m) -> types(T))
   using the real 18x18 chart, so a move scores highly when it hits a lot of the CURRENT meta
   super-effectively. This is meta-weighted, not a generic type rating.
4. THE TEST. Within each species, compare cov() of its TECH moves against cov() of its STANDARD
   moves. If tech slots are chosen to answer the meta, tech > standard. The null is that a rare move
   is just a random alternative and the two means match. Paired by species (so a species that simply
   has good STAB cannot create the effect), bootstrap CI over species.

It also reports, per top threat, which moves answer it and how over-represented they are on teams -
the "who is teching for Kingambit" list.

Honest by construction: every claim gets a baseline and an interval, and the identifying limitation
(3 days, cross-sectional) is written into the output file.

    python3 engine/counterplay.py
"""
import json, os, re, math, random
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)

# ---------------------------------------------------------------- dex + type chart
_t = open(D("data", "engine-data.js"), encoding="utf-8", errors="ignore").read()
MC = json.loads(re.search(r"const MC = (\{.*?\});", _t, re.S).group(1))
MONS, MOVES, CHART = MC["mons"], MC["moves"], MC["C"]

def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())

def effectiveness(move_type, defender_types):
    """product of the chart over the defender's types; 0 = immune, 4 = double super-effective"""
    e = 1.0
    row = CHART.get(move_type)
    if not row: return 1.0
    for dt in defender_types:
        e *= row.get(dt, 1.0)
    return e

def load_games():
    with open(D("data", "games.ladder.jsonl"), encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line: continue
            try: yield json.loads(line)
            except Exception: continue

MIN_SETS   = 25     # a species needs this many revealed sets before we judge its kit
STD_SHARE  = 0.30   # move on >= 30% of that species' sets = standard kit
TECH_SHARE = 0.12   # move on <= 12% of that species' sets = a tech slot
MIN_MOVE_N = 3      # and it must be seen at least this many times (not a one-off)
TOP_THREATS = 25

def build():
    games = list(load_games())

    # 1. threat prevalence over team-sixes
    six_count = Counter(); n_sides = 0
    for g in games:
        for side in ("p1", "p2"):
            six = (g.get("six") or {}).get(side, [])
            if not six: continue
            n_sides += 1
            for mon in set(six): six_count[mon] += 1
    prevalence = {m: c / n_sides for m, c in six_count.items()}
    threats = [m for m, _ in six_count.most_common(TOP_THREATS) if norm(m) in MONS]

    # 2. per-species move shares from revealed sets
    sets_seen = Counter(); move_seen = defaultdict(Counter)
    for g in games:
        for mon, s in (g.get("sets") or {}).items():
            sets_seen[mon] += 1
            for mv in (s.get("moves") or []):
                move_seen[mon][norm(mv)] += 1

    # 3. coverage score of a move type against the weighted meta
    threat_types = {t: MONS[norm(t)]["t"] for t in threats}
    threat_w = {t: prevalence[t] for t in threats}
    wsum = sum(threat_w.values()) or 1.0

    def cov_for_type(mt):
        if not mt: return None
        s = 0.0
        for t in threats:
            s += (threat_w[t] / wsum) * effectiveness(mt, threat_types[t])
        return s

    covcache = {}
    def cov_move(mkey):
        if mkey in covcache: return covcache[mkey]
        md = MOVES.get(mkey)
        v = None
        if md and md.get("bp", 0) > 0:      # only damaging moves can "cover" anything
            v = cov_for_type(md.get("t"))
        covcache[mkey] = v
        return v

    # 4. paired test: within species, tech-slot coverage vs standard-kit coverage
    pairs = []       # (species, mean_cov_tech, mean_cov_std, n_tech, n_std)
    tech_rows = []
    for mon, ctr in move_seen.items():
        n = sets_seen[mon]
        if n < MIN_SETS: continue
        std, tech = [], []
        for mv, c in ctr.items():
            share = c / n
            cv = cov_move(mv)
            if cv is None: continue                    # status move: no coverage role
            if share >= STD_SHARE: std.append(cv)
            elif share <= TECH_SHARE and c >= MIN_MOVE_N:
                tech.append(cv)
                tech_rows.append(dict(species=mon, move=mv, share=round(share, 4), n=c,
                                      coverage=round(cv, 4), type=MOVES[mv]["t"]))
        if std and tech:
            pairs.append((mon, sum(tech)/len(tech), sum(std)/len(std), len(tech), len(std)))

    diffs = [t - s for _, t, s, _, _ in pairs]
    mean_diff = sum(diffs)/len(diffs) if diffs else 0.0
    rng = random.Random(11); boots = []
    for _ in range(2000):
        smp = [diffs[rng.randrange(len(diffs))] for _ in range(len(diffs))] if diffs else [0]
        boots.append(sum(smp)/len(smp))
    boots.sort()
    ci = (round(boots[int(.025*len(boots))], 4), round(boots[int(.975*len(boots))], 4)) if diffs else (0,0)
    n_pos = sum(1 for d in diffs if d > 0)

    # 5. per-threat answers: which tech moves hit this threat hardest, and how common are they
    per_threat = []
    for t in threats[:12]:
        tt = threat_types[t]
        answers = Counter(); answer_type = {}
        for mon, ctr in move_seen.items():
            n = sets_seen[mon]
            if n < MIN_SETS: continue
            for mv, c in ctr.items():
                md = MOVES.get(mv)
                if not md or md.get("bp", 0) <= 0: continue
                if effectiveness(md["t"], tt) >= 2.0 and (c / n) <= TECH_SHARE and c >= MIN_MOVE_N:
                    answers[(mon, mv)] += c
                    answer_type[(mon, mv)] = (md["t"], effectiveness(md["t"], tt))
        top = [dict(species=k[0], move=k[1], uses=v, move_type=answer_type[k][0],
                    multiplier=answer_type[k][1]) for k, v in answers.most_common(8)]
        per_threat.append(dict(threat=t, types=tt, prevalence=round(prevalence[t], 4),
                               tech_answers=top))

    tech_rows.sort(key=lambda d: -d["coverage"])
    out = dict(
        generated=__import__("datetime").date.today().isoformat(),
        n_games=len(games), n_team_sides=n_sides,
        design=("Cross-sectional. The store spans only 3 days, so the natural temporal test (does "
                "counter-usage RISE AFTER a threat rises?) has no identifying variation and was NOT "
                "run. Instead: within each species, is the coverage value of its RARE moves higher "
                "than its STANDARD moves, where coverage is weighted by current threat prevalence?"),
        thresholds=dict(min_sets=MIN_SETS, standard_share=STD_SHARE, tech_share=TECH_SHARE,
                        min_move_uses=MIN_MOVE_N, top_threats=TOP_THREATS),
        top_threats=[dict(species=t, types=threat_types[t], prevalence=round(prevalence[t], 4))
                     for t in threats[:12]],
        result=dict(
            n_species_paired=len(pairs),
            mean_coverage_gap=round(mean_diff, 4),
            bootstrap_ci_95=ci,
            species_with_positive_gap=n_pos,
            share_positive=round(n_pos/len(pairs), 4) if pairs else None,
            reading=("A positive gap means rare 'tech' slots carry more meta-weighted coverage than "
                     "the species' standard kit - evidence that spare slots are spent answering the "
                     "field. A CI spanning 0 means we cannot distinguish it from slot noise."),
        ),
        per_threat=per_threat,
        highest_coverage_tech_slots=tech_rows[:30],
    )
    json.dump(out, open(D("data", "counterplay.json"), "w"), indent=1)

    print(f"counterplay.py - {len(games)} games, {n_sides} team-sides, {len(threats)} threats")
    print(f"  paired species: {len(pairs)}")
    print(f"  mean coverage gap (tech - standard): {mean_diff:+.4f}  95% CI {ci}")
    print(f"  species where tech > standard: {n_pos}/{len(pairs)}"
          f" ({(n_pos/len(pairs)*100 if pairs else 0):.0f}%)")
    print("  top threats:", ", ".join(f"{t}({prevalence[t]*100:.0f}%)" for t in threats[:6]))
    for pt in per_threat[:3]:
        ans = ", ".join(f"{a['species']}:{a['move']}({a['multiplier']:g}x)" for a in pt["tech_answers"][:4])
        print(f"    vs {pt['threat']} {pt['types']}: {ans or '(none)'}")
    return out

if __name__ == "__main__":
    build()
