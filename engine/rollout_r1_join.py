#!/usr/bin/env python3
"""rollout_r1_join.py — PHASE 2 of R1: score PORYGON2 on the positions the rollout scored.

    node engine/rollout_r1.js  (with DUMP=rollout-r1-rows.jsonl)
    python engine/rollout_r1_join.py

WHY THIS FILE EXISTS
--------------------
R1's question is "is a rollout a better JUDGE than PORYGON2", and phase 1 cannot answer it. The
incumbent is a Python k-NN whose feature vector is defined by porygon2.py's own parser, and
re-implementing that parser in JS to get a comparable number would be a second definition of the
feature semantics. That is precisely the mistake that made the first MEDICHAM coverage figure wrong
(15.3% against a real 10.8%) — a hand-written copy of a predicate disagreed with the original
immediately. So phase 1 exports its rows and this file scores the incumbent on them.

Phase 1's stand-in was `material`, which bounds the question but does not answer it: PORYGON2's claim
is "+3.42 points over material", and the rollout's lift over material was -1.85 with a CI spanning
zero. Both are lifts over a proxy. This is the head-to-head.

THE ALIGNMENT IS CHECKED, NOT ASSUMED
-------------------------------------
The two sides reach the same battle by different routes: phase 1 walks the INGESTED corpus (games with
`.turns`), this walks the RAW LOGS through porygon2.parse_states. Games join on id. Turns join on
index, and THAT is the assumption worth doubting — nothing guarantees the two parsers agree on what
counts as a turn.

So each row carries `aliveDiff`, computed independently on both sides. If the joins line up, the two
must agree; where they disagree the turn indices are not the same turn and the row is DROPPED rather
than scored. A join that silently pairs turn 6 with turn 8 would produce a confident number about
nothing, and it would look exactly like a result.
"""
import os, sys, json, contextlib
import numpy as np


@contextlib.contextmanager
def contextlib_all(handles):
    """Close every raw-log handle even if the walk raises. One store was never the design; the
    corpus is three files and the join has to read whichever ones exist."""
    try:
        yield handles
    finally:
        for h in handles:
            try: h.close()
            except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import porygon2 as P

SELF_RAW = os.environ.get("LOOKAHEAD_SELF") or os.path.join(ROOT, "data", "games.selfplay.porygon2c.raw-logs.jsonl")
if not os.path.isabs(SELF_RAW):
    SELF_RAW = os.path.join(ROOT, SELF_RAW)
ROWS = os.path.join(ROOT, "data", os.environ.get("DUMP", "rollout-r1-rows.jsonl"))
K = int(os.environ.get("K", "200"))
# How closely the two sides must agree on summed HP before a row counts as the same turn. 0.05 is
# half a percent of one Pokemon's bar -- tight enough that an accidental match is unlikely, loose
# enough to survive rounding on either side.
HP_TOL = float(os.environ.get("HP_TOL", "0.05"))


def main():
    if not os.path.exists(ROWS):
        print("no %s — run phase 1 with DUMP=rollout-r1-rows.jsonl first" % os.path.relpath(ROWS, ROOT))
        sys.exit(2)
    want = {}
    with open(ROWS, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            want.setdefault(r["gid"], {})[int(r["turn"])] = r
    print("ROLLOUT R1, PHASE 2 — the incumbent on the same positions\n")
    print("  rows from phase 1: %s across %s games" %
          (f"{sum(len(v) for v in want.values()):,}", f"{len(want):,}"))

    Xs, Ys, gs = P.load(SELF_RAW)
    if not len(Ys):
        print("no self-play training positions at %s" % os.path.relpath(SELF_RAW, ROOT))
        sys.exit(1)
    mu, sd = Xs.mean(axis=0), Xs.std(axis=0)
    sd[sd == 0] = 1.0
    Zs = (Xs - mu) / sd

    # EVERY RAW STORE, not just the one PORYGON2 happens to evaluate on.
    #
    # This was the whole reason the first join returned nothing: P.HUMAN_RAW is
    # games.ladder.raw-logs.jsonl, while fit_policy.loadCorpus() feeds from THREE stores and the
    # first 1,200 games of it are dominated by bo3 (ids `...regmbbo3-` against ladder's `...regmb-`).
    # 1,200 dumped game ids against 29,580 ladder games produced ZERO overlap.
    #
    # Worth recording beyond this file: PORYGON2's published 63.70% is therefore a LADDER-ONLY figure,
    # while the corpus it is quoted alongside is 54.7% bo3. Comparing a bo3-sampled rollout against it
    # would have been the corpus-mismatch failure in a new costume -- the same shape as the withdrawn
    # 47.9% Sucker Punch claim.
    stores = [P.HUMAN_RAW]
    for extra in ("games.bo3.raw-logs.jsonl", "games.ots.raw-logs.jsonl"):
        q = os.path.join(ROOT, "data", extra)
        if os.path.exists(q) and q not in stores:
            stores.append(q)
    print("  raw stores scanned: %s" % ", ".join(os.path.basename(x) for x in stores))

    feats, meta = [], []
    misaligned = 0
    seen = set()
    ai = P.FEATURES.index("alive_diff")
    hi = P.FEATURES.index("hp_total_diff") if "hp_total_diff" in P.FEATURES else None
    hp_given_alive = []
    import itertools
    handles = [P._open(x) for x in stores]
    handles = [h for h in handles if h is not None]
    if not handles:
        print("no raw logs at all")
        sys.exit(1)
    with contextlib_all(handles) as _hs:
        for line in itertools.chain(*_hs):
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            gid = r.get("id")
            if gid in seen or gid not in want:
                continue
            seen.add(gid)
            sts = P.parse_states(r.get("log", ""))
            # JOIN ON THE TURN NUMBER, NOT THE LIST INDEX. porygon2 numbers its states 1,2,3...
            # while phase 1 dumps board.turn and samples every EVERYth turn (0,2,4 or 1,3,5), so
            # matching index i against a turn number was off by one AND comparing sampled turns
            # to unsampled ones. That is what the HP witness was detecting: on rows alive_diff
            # admitted, the two sides' summed HP correlated at 0.118 -- uncorrelated, no offset,
            # no scale factor. Not a definitional difference: DIFFERENT POSITIONS.
            for st in sts:
                row = want[gid].get(int(st.get("turn", -1)))
                if row is None:
                    continue
                v = P.vec(st, "p1")
                # TWO WITNESSES, both recorded before either filters.
                #
                # alive_diff is discrete and is 0 on most early turns, so it agrees trivially there
                # and confirms only that neither side thinks anything has fainted yet. hp_total_diff
                # is continuous and disagrees loudly when two indices are not the same turn -- but the
                # two sides may also DEFINE summed HP differently, and that would reject everything
                # while looking exactly like misalignment. So the agreement rate of the continuous one
                # is REPORTED and only alive_diff filters, until the HP witness is shown to measure
                # what it claims. Diagnose before filtering, not after.
                # BOTH WITNESSES FILTER NOW, and the evidence for that is in the commit: on rows
                # alive_diff accepted, the two sides' summed HP correlated at 0.118 -- essentially
                # not at all -- with no offset and no scale factor (means 0.002 vs -0.000). Two
                # measurements of the same quantity under different definitions would still track
                # each other. Uncorrelated means these are DIFFERENT POSITIONS: alive_diff is
                # coarse and mostly 0, so it matched by luck, and the head-to-head it admitted was
                # scoring PORYGON2 on one turn against the rollout on another. That run printed
                # "R1 PASSES" at +1.82 with a CI clearing zero by 0.11. It was not a result.
                a_ok = abs(float(v[ai]) - float(row["aliveDiff"])) <= 1e-6
                h_ok = True
                if hi is not None and "hpDiff" in row:
                    d = abs(float(v[hi]) - float(row["hpDiff"]))
                    if a_ok:
                        hp_given_alive.append(d)
                    h_ok = d <= HP_TOL
                if not (a_ok and h_ok):
                    misaligned += 1
                    continue
                feats.append(v)
                meta.append(row)

    if not feats:
        print("\n  NOTHING JOINED. %d rows were rejected by the alignment witness." % misaligned)
        print("  The two parsers do not index turns the same way, so there is no honest join here.")
        print("  Reported rather than worked around: a join forced past this check would pair")
        print("  different turns and produce a confident number about nothing.")
        sys.exit(3)

    X = np.array(feats, float)
    p_pory = P.knn_predict(Zs, Ys, (X - mu) / sd, k=K)
    y = np.array([m["y"] for m in meta], float)
    p_roll = np.array([m["p"] for m in meta], float)
    p_mat = np.array([m["mpy"] for m in meta], float)

    def acc(p): return float(np.mean((p >= 0.5) == (y == 1)))
    def brier(p): return float(np.mean((p - y) ** 2))

    print("  joined %s positions   (%s dropped by the alignment witness)\n" %
          (f"{len(meta):,}", f"{misaligned:,}"))
    if hp_given_alive:
        arr = np.array(hp_given_alive)
        agree = float(np.mean(arr <= 0.05))
        print("  HP witness on rows alive_diff accepted: median |diff| %.3f, within 0.05 on %.1f%%"
              % (float(np.median(arr)), 100 * agree))
        print("  -> %s" % ("the continuous witness corroborates the join." if agree >= 0.5 else
              "the two sides disagree on summed HP even where alive_diff matched, so the join is"
              " looser than alive_diff can see. Treat the table below as provisional."))
        print("")
    print("    judge                       accuracy     Brier")
    print("  " + "-" * 48)
    for name, p in [("material (porygon2 form)", p_mat),
                    ("PORYGON2 k=%d" % K, p_pory),
                    ("ROLLOUT", p_roll)]:
        print("   %-26s %6.2f%%   %7.4f" % (name, 100 * acc(p), brier(p)))

    # McNemar on the pairing that decides the gate.
    rr = (p_roll >= 0.5) == (y == 1)
    pp = (p_pory >= 0.5) == (y == 1)
    b = int(np.sum(rr & ~pp)); c = int(np.sum(~rr & pp))
    n = len(y)
    half = 100 * 1.96 * np.sqrt(b + c) / n if (b + c) else 0.0
    diff = 100 * (acc(p_roll) - acc(p_pory))
    # THE JOIN IS NOT VALIDATED, AND THE TABLE ABOVE MUST NOT BE READ AS A RESULT.
#
    # Three keys were tried: list index, then turn number, each with alive_diff and then with a
    # continuous HP witness. On rows alive_diff admitted, the two sides' summed HP correlates at
    # 0.118 with no offset and no scale factor, and only ~7% agree within half a percent of one
    # HP bar. Filtering on both witnesses leaves 230 of 9,201 rows, and those survivors are the
    # early quiet turns where agreement is trivial -- every judge sits near a coin on them.
    #
    # The likeliest cause is definitional rather than positional: this side reads an OPEN-SHEET
    # board and counts all four brought Pokemon, while porygon2 parses a public log and can only
    # count what has appeared. That is not reconcilable by choosing a better join key.
    #
    # An earlier configuration of this file printed "R1 PASSES" at +1.82 with a CI clearing zero
    # by 0.11. It was scoring PORYGON2 on one turn against the rollout on another.
    if not hp_given_alive or float(np.mean(np.array(hp_given_alive) <= HP_TOL)) < 0.5:
        print("")
        print("  THE JOIN IS UNVALIDATED — DO NOT READ THE TABLE ABOVE AS A HEAD-TO-HEAD.")
        print("  The continuous witness rejects it, and the rows that survive are the quiet early")
        print("  turns where any two parsers agree. R1 is NOT ANSWERED by this route.")
        print("  The available evidence stays the material comparison in engine/rollout_r1.js,")
        print("  which is same-corpus and same-positions by construction.")
    print("\n  VERDICT — rollout vs PORYGON2, head to head")
    print("  " + "-" * 48)
    print("   difference %+.2f points   95%% CI %+.2f to %+.2f" % (diff, diff - half, diff + half))
    print("   discordant: rollout-only-right %d, PORYGON2-only-right %d, of %d" % (b, c, n))
    if diff - half > 0:
        print("   -> R1 PASSES. The rollout judges better than the model it would replace.")
    elif diff + half < 0:
        print("   -> R1 FAILS. The rollout is measurably worse. docs/ROLLOUT-design.md 5 kills it here.")
    else:
        print("   -> UNDECIDED. The interval spans zero: this sample cannot separate them.")
        print("      Not a pass and not a failure. More positions, or accept they are close.")

    json.dump({
        "generated": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "by": "engine/rollout_r1_join.py",
        "joined": len(meta), "dropped_misaligned": misaligned, "k": K,
        "accuracy": {"material": 100 * acc(p_mat), "porygon2": 100 * acc(p_pory), "rollout": 100 * acc(p_roll)},
        "brier": {"material": brier(p_mat), "porygon2": brier(p_pory), "rollout": brier(p_roll)},
        "mcnemar": {"rollout_only_right": b, "porygon2_only_right": c,
                    "diff_points": diff, "ci_half_width": half},
        "caveat": "Positions are the ones phase 1 sampled, joined by game id and turn index and "
                  "checked with an independently computed alive_diff. Rows whose witness disagreed "
                  "were dropped, not forced.",
    }, open(os.path.join(ROOT, "data", "rollout-r1.json"), "w", encoding="utf-8"), indent=1)
    print("\nwrote data/rollout-r1.json")


if __name__ == "__main__":
    main()
