#!/usr/bin/env python3
"""counters.py — what do the teams that BEAT a given archetype actually bring?

WHY THIS EXISTS, AND WHY IT IS A BETTER QUESTION THAN GURU'S MATRIX
------------------------------------------------------------------
GURU asks "does archetype A beat archetype B", which splits the sample into A x B cells. With 1,124
clean games and even 5 archetypes that is 25 cells, and the archetype distribution is lopsided — one
cluster is 65% of teams — so the cells stay thin however few you make. Zero matchups have ever been
statistically decisive.

This asks a different question on the same data:

    Of the games where someone BEAT a Rain team, what did the winner bring
    that the loser did not?

That pools on a FEATURE WITHIN a matchup instead of splitting into a cell per pair. Every game against
Rain contributes to every species' count, so a species with 5% usage still accrues evidence from the
whole Rain sample rather than from one cell of it. It is also the question a player actually asks:
not "who wins" but "what beats this".

METHOD
  For each opposing archetype O:
    among games against O, compare P(species s was brought | won) against P(s | lost).
    The statistic is the DIFFERENCE IN BRING RATE, with a Wilson interval on each side and a
    two-proportion z-test on the difference.

WHY BRING RATE AND NOT WIN RATE. "Teams with Basculegion beat Rain 60% of the time" conditions on the
team and inherits every selection effect in team-building. "Winners against Rain brought Basculegion
more often than losers did" conditions on the OUTCOME within a fixed opponent, which is the
comparison that isolates the counter.

HONEST LIMITS, because this design has three real ones:
  - `brought` is what the replay REVEALED. Requiring a full bring conditions on game length, so these
    rates skew toward longer games. Already true of every bring statistic in this project.
  - Correlated features. Basculegion and Pelipper travel together, so a lift on one is partly a lift
    on the other. This reports marginal lift, not a controlled effect, and must not be read causally.
  - It is a WITHIN-matchup comparison, so it says nothing about whether you should bring the counter
    against the field as a whole.

    python engine/counters.py            # all archetypes
    python engine/counters.py Rain       # one
"""
import json, os, math, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from store import load_games

ARCH = os.path.join(ROOT, "data", "archetypes.json")
OUT = os.path.join(ROOT, "data", "counters.json")
norm = lambda s: "".join(c for c in str(s).lower() if c.isalnum())

MIN_GAMES = 40      # an opposing archetype needs this many games before it is worth reporting
MIN_SEEN = 8        # a species needs this many appearances in the matchup to be judged


def wilson(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0, 1.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (p, max(0.0, c - h), min(1.0, c + h))


def two_prop_z(k1, n1, k2, n2):
    """z for H0: p1 == p2. Returns (diff, z, approx two-sided p)."""
    if n1 == 0 or n2 == 0:
        return (0.0, 0.0, 1.0)
    p1, p2 = k1 / n1, k2 / n2
    p = (k1 + k2) / (n1 + n2)
    se = math.sqrt(max(1e-12, p * (1 - p) * (1 / n1 + 1 / n2)))
    z = (p1 - p2) / se if se > 0 else 0.0
    # two-sided normal tail, Abramowitz-Stegun 7.1.26
    x = abs(z) / math.sqrt(2)
    t = 1 / (1 + 0.3275911 * x)
    erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * math.exp(-x * x)
    return (p1 - p2, z, max(0.0, min(1.0, 1 - erf)))


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    arch = json.load(open(ARCH))["archetypes"]
    cores = [(a["n"], set(norm(x) for x in a["core"])) for a in arch]

    def assign(team):
        ts = set(norm(x) for x in team)
        best, bs = "Other", 0
        for name, core in cores:
            ov = len(ts & core)
            if ov > bs:
                bs, best = ov, name
        return best if bs >= 2 else "Other"

    # per opposing archetype: winner-side and loser-side bring counts
    won = defaultdict(Counter)
    lost = defaultdict(Counter)
    nwon = Counter()
    nlost = Counter()

    for g in load_games():
        six = g.get("six") or {}
        brought = g.get("brought") or {}
        w = g.get("winner")
        if not w:
            continue
        names = {"p1": (g.get("p1") or {}).get("name"), "p2": (g.get("p2") or {}).get("name")}
        if w not in names.values():
            continue
        for me, foe in (("p1", "p2"), ("p2", "p1")):
            mine = [norm(x) for x in (brought.get(me) or [])]
            theirs = six.get(foe) or []
            if not mine or not theirs:
                continue
            opp = assign(theirs)
            if names[me] == w:
                nwon[opp] += 1
                for s in set(mine):
                    won[opp][s] += 1
            else:
                nlost[opp] += 1
                for s in set(mine):
                    lost[opp][s] += 1

    report = {}
    for opp in sorted(set(list(nwon) + list(nlost)), key=lambda o: -(nwon[o] + nlost[o])):
        total = nwon[opp] + nlost[opp]
        if total < MIN_GAMES:
            continue
        if only and opp.lower() != only.lower():
            continue
        rows = []
        for s in set(list(won[opp]) + list(lost[opp])):
            kw, kl = won[opp][s], lost[opp][s]
            if kw + kl < MIN_SEEN:
                continue
            diff, z, p = two_prop_z(kw, nwon[opp], kl, nlost[opp])
            pw, wlo, whi = wilson(kw, nwon[opp])
            pl, _, _ = wilson(kl, nlost[opp])
            rows.append({"species": s, "won_rate": round(pw, 3), "lost_rate": round(pl, 3),
                         "diff": round(diff, 3), "z": round(z, 2), "p": round(p, 4),
                         "n_won": kw, "n_lost": kl,
                         "significant": bool(p < 0.05)})
        # --- MULTIPLE COMPARISONS. This is the whole ballgame and the first version ignored it. ----
        # Roughly 50 species are tested per matchup, so at p<0.05 about 2-3 "significant" results per
        # matchup are expected FROM NOISE ALONE. The first run of this file duly produced five, all
        # sitting at p ~ 0.047-0.049, and every one of them was almost certainly nothing.
        #
        # Benjamini-Hochberg controls the false discovery rate across the family of tests in this
        # matchup: sort by p, keep the largest i where p_(i) <= (i/m) * alpha. A species is only
        # called a counter if it survives that, and `significant` now means BH-survived, not raw p.
        m = len(rows)
        alpha = 0.05
        by_p = sorted(rows, key=lambda r: r["p"])
        cutoff = 0.0
        for i, r in enumerate(by_p, start=1):
            if r["p"] <= (i / m) * alpha:
                cutoff = r["p"]
        for r in rows:
            r["significant_raw"] = bool(r["p"] < alpha)
            r["significant"] = bool(m > 0 and r["p"] <= cutoff and cutoff > 0)
        rows.sort(key=lambda r: -r["diff"])
        report[opp] = {"games": total, "won": nwon[opp], "lost": nlost[opp],
                       "tests": m, "bh_alpha": alpha, "bh_cutoff": round(cutoff, 5),
                       "species": rows}

        sig = [r for r in rows if r["significant"]]
        raw = [r for r in rows if r["significant_raw"]]
        print(f"\n=== vs {opp} ===  {total} games ({nwon[opp]} won / {nlost[opp]} lost by the other side)")
        if not rows:
            print("  nothing brought often enough to judge")
            continue
        print(f"  {'species':<18}{'winners':>9}{'losers':>9}{'diff':>8}{'p':>9}")
        for r in rows[:6]:
            star = " *" if r["significant"] else ""
            print(f"  {r['species']:<18}{100*r['won_rate']:>8.0f}%{100*r['lost_rate']:>8.0f}%"
                  f"{100*r['diff']:>+7.0f}{r['p']:>9.3f}{star}")
        if sig:
            print(f"  {len(sig)} survive Benjamini-Hochberg across {m} tests: "
                  + ", ".join(r["species"] for r in sig))
        else:
            print(f"  NOTHING survives multiple-comparison correction. {len(raw)} looked significant "
                  f"at raw p<0.05, which is about what {m} tests produce by chance.")

    json.dump({"generated": __import__("datetime").date.today().isoformat(),
               "min_games": MIN_GAMES, "min_seen": MIN_SEEN,
               "method": "within-matchup bring rate among winners vs losers; two-proportion z",
               "caveat": "brought is what the replay REVEALED and conditions on game length; species "
                         "are correlated so lift is marginal, not causal",
               "by_opponent": report}, open(OUT, "w"), indent=1)
    print(f"\nwrote {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
