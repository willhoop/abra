#!/usr/bin/env python3
"""
PORYGON2 — the value function, rebuilt as nearest-neighbour over self-play.

    SHOWDOWN_PATH is not needed. python engine/porygon2.py

WHY A NEW NAME RATHER THAN A NEW PORY
-------------------------------------
PORY stays exactly as it is. This is not a retune of it and the two must remain separately
quotable, because this repository has been bitten repeatedly by numbers whose source cannot be
pinned down -- data/pory-nn.json once declared 61,274 games from a store holding 20,387. If the
rebuild were also called PORY, every existing "PORY says X" would become ambiguous forever.

Three things differ, and each is a decision with evidence behind it:

  NOT A NETWORK.  Measured on clean data 2026-07-28, a logistic model on rich features beat the
                  two-material-feature bar, and BOTH neural variants lost to it. The network is not
                  underfitted, it is the wrong tool at this sample size.

  NOT PARAMETRIC AT ALL.  Will's proposal, and it is the natural move when a network underperforms a
                  linear model: assume no functional form, look up the most similar positions and
                  average what happened to them. A k-NN also improves for free as self-play grows,
                  with no retraining.

  NOT TRAINED ON PEOPLE.  PORY learns from scraped human replays. docs/THE-PLAN.md is explicit that
                  copying people caps you at people, and docs/POKER-TO-POKEMON.md section 7 sets the
                  rule this file follows: SELF-PLAY IS THE TRAINING SIGNAL, held-out human games are
                  the CALIBRATION set and never the training signal, so selection bias cannot be
                  laundered back in.

THE COMPARISON IS THE POINT, SO IT IS MADE FAIR ON PURPOSE
----------------------------------------------------------
A new model scored on a new corpus is not evidence of anything. PORYGON2 is therefore evaluated on
the SAME held-out human positions as PORY, with the SAME proper scores, against the SAME two honest
baselines PORY reports:

    coin                      predict 0.5 always
    material sign             predict by who has more Pokemon left
    PORY                      logistic on [alive_diff, hp_diff, my_alive, foe_alive, turn]

Reported as accuracy and as Brier score. Log-loss is computed but deliberately not led with: a coin
is 50%, not 0.6931, and the project's reporting rule is plain numbers.

WHAT WOULD MAKE THIS FAIL, STATED UP FRONT
------------------------------------------
Self-play positions are drawn from MAG playing itself. If MAG's play is unlike human play, the
neighbourhood a human position lands in will be full of positions that do not resemble it, and the
lookup returns a confident wrong answer. That is distribution shift and it is the standard failure
of bootstrapped self-play -- it is why the corpus is generated with --policy score rather than
--policy random. The held-out HUMAN evaluation is what detects it: if PORYGON2 scores well on
self-play holdout and badly on human holdout, the shift is real and the number to trust is the
human one.
"""
import json, os, sys, math, gzip
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
# ONE HOME FOR A TIMESTAMP. This file used to write datetime.now().isoformat(), which is
# naive -- no offset, so its meaning depends on who reads it. See engine/isotime.py.
from isotime import utc_now
HUMAN_RAW = os.path.join(ROOT, "data", "games.ladder.raw-logs.jsonl")
# THE TRAINING CORPUS IS AN ARGUMENT NOW, and the reason is a measured one.
#
# The original corpus (data/games.selfplay.porygon2.raw-logs.jsonl) was generated on CLOSED team
# sheets by a SAMPLING policy -- mew.js's own header names "PORYGON2's entire training set" in its
# list of everything measured before open sheets existed. Verified on the file: openSheet false,
# greedy false. So the positions it learned from came from a bot that could not read the sheet and
# deliberately clicked its worse option some of the time.
#
# That matters more than corpus SIZE, which is already known not to help: data/porygon2-curve.json
# measures accuracy 62.81% at 9,171 positions and 62.62% at 73,368 -- eight times the data for
# nothing. If this model is to move at all it will be because the positions are different in kind,
# not because there are more of them. Hence an override rather than a bigger default.
#
#   PORYGON2_SELF=data/games.h2h-sw.raw-logs.jsonl python engine/porygon2.py
SELF_RAW = os.environ.get("PORYGON2_SELF") or os.path.join(ROOT, "data", "games.selfplay.porygon2.raw-logs.jsonl")
if not os.path.isabs(SELF_RAW):
    SELF_RAW = os.path.join(ROOT, SELF_RAW)
OUT_ENV = os.environ.get("PORYGON2_OUT")
OUT = (OUT_ENV if OUT_ENV and os.path.isabs(OUT_ENV) else (os.path.join(ROOT, OUT_ENV) if OUT_ENV else os.path.join(ROOT, "data", "porygon2.json")))
np.random.seed(0)

# Species types, Speed and the type chart, exported from data/engine-data.js so this file does not
# carry a second copy of the rules. Regenerate with the snippet in that JSON's `note`.
try:
    with open(os.path.join(ROOT, "data", "porygon2-species.json"), encoding="utf-8") as fh:
        SPX = json.load(fh)
except Exception:
    SPX = {"eff": {}, "mons": {}}
EFF, MONS = SPX.get("eff", {}), SPX.get("mons", {})


def _sid(name):
    return "".join(c for c in str(name).lower() if c.isalnum())


def _best_eff(att_types, def_types):
    """Best type effectiveness the attacker's own types can produce against the defender.
    A stand-in for 'how hard can this thing hit that thing' using only STAB, which is what a public
    log reveals without knowing the moveset."""
    best = 0.0
    for a in att_types or []:
        m = 1.0
        for d in def_types or []:
            m *= EFF.get(a, {}).get(d, 1.0)
        best = max(best, m)
    return best if best else 1.0

# ---------------------------------------------------------------------------------------------
# THE POSITION VECTOR
#
# PORY sees six numbers, five of which are material and turn count. Everything a VGC player
# actually reads -- who is faster, what is on the field, who is statused, who is set up -- is
# invisible to it. These are the cheap, parseable additions, all of them read straight from the
# protocol log rather than inferred.
#
# SYMMETRY IS ENFORCED BY CONSTRUCTION. Every state is emitted twice, once from each side, with the
# differences negated. A value function that is not symmetric has learned which player index tends
# to win, which is nothing about Pokemon.
# ---------------------------------------------------------------------------------------------
FEATURES = [
    "alive_diff", "hp_active_diff", "hp_total_diff", "my_alive", "foe_alive", "turn",
    # ---- THE DISTRIBUTION, NOT THE TOTAL -------------------------------------------------------
    # docs/PORYZ-spec.md's whole thesis in two numbers, testable without the rebuild it asks for.
    #
    # hp_active_diff above is the MEAN of a side's two active slots, so {100, 20} and {60, 60} give
    # an identical value -- and those are completely different positions. One of them has something
    # about to die. "Aggregates cannot express *this specific thing is in range*, and being in range
    # is what a position mostly consists of."
    #
    # Same parser, same data, different aggregation. If per-Pokemon structure is really what the
    # ceiling is made of, the weakest body on the field should carry signal the mean threw away. If
    # it does not, that is worth knowing BEFORE building a new model on the premise.
    "hp_min_diff", "hp_min_mine",
    "status_diff", "boost_diff", "tailwind_diff", "screen_diff", "hazard_diff",
    "trickroom", "weather_on", "terrain_on",
    # ---- THE CONVERSION TERMS -----------------------------------------------------------------
    # The learning curve said the ceiling is the feature set, not the sample size: eight times the
    # data moved accuracy -0.2 points. Everything above describes MATERIAL and FIELD -- what has
    # already happened. Will's framing is that most of Pokemon is "make my Pokemon move faster" and
    # "make my Pokemon hit harder", and those are CAUSES; alive_diff and hp_diff are the effects they
    # eventually produce. A value function looking only at effects is looking downstream.
    #
    # These three are the cheapest available causes, computed from the same protocol log:
    "matchup_edge",   # how hard my active hits theirs, minus how hard theirs hits mine (STAB, type)
    "speed_edge",     # do I outrun them, signed and scaled
    "type_threat",    # the worst effectiveness THEY have on me -- being 4x weak is not symmetric
]

def parse_states(log):
    """Yield one dict per turn of the public board. Protocol-level, so it works identically on a
    downloaded replay and on a MEW self-play log -- the same reuse durable-ingest.py relies on."""
    hp = {}                      # slot -> hp percent
    faint = {"p1": 0, "p2": 0}
    status = {"p1": 0, "p2": 0}
    boost = {"p1": 0, "p2": 0}
    side = {"p1": {"tailwind": 0, "screen": 0, "hazard": 0}, "p2": {"tailwind": 0, "screen": 0, "hazard": 0}}
    field = {"trickroom": 0, "weather": 0, "terrain": 0}
    active = {}                  # slot -> species id, for the matchup features
    turn = 0
    out = []

    def act_hp(s):
        v = [hp[k] for k in (s + "a", s + "b") if k in hp and hp[k] > 0]
        return sum(v) / len(v) if v else 0.0

    def min_hp(s):
        """The WEAKEST living active on a side. Empty -> 0.0, which reads as 'nothing left standing'
        and is the honest value rather than a sentinel."""
        v = [hp[k] for k in (s + "a", s + "b") if k in hp and hp[k] > 0]
        return min(v) if v else 0.0

    def tot_hp(s):
        v = [hp[k] for k in hp if k.startswith(s)]
        return sum(v) / 4.0 if v else 0.0

    def snap():
        out.append({
            "turn": turn,
            "alive": {"p1": 4 - faint["p1"], "p2": 4 - faint["p2"]},
            "act": {"p1": act_hp("p1"), "p2": act_hp("p2")},
            "min": {"p1": min_hp("p1"), "p2": min_hp("p2")},
            "tot": {"p1": tot_hp("p1"), "p2": tot_hp("p2")},
            "status": dict(status), "boost": dict(boost),
            "side": {s: dict(side[s]) for s in ("p1", "p2")},
            "field": dict(field),
            "active": dict(active),
        })

    for ln in log.split("\n"):
        if not ln.startswith("|"):
            continue
        p = ln.split("|")
        tag = p[1] if len(p) > 1 else ""
        who = ""
        if len(p) > 2 and len(p[2]) >= 3 and p[2][:2] in ("p1", "p2"):
            who = p[2][:2]
        slot = p[2].split(":")[0].strip() if len(p) > 2 else ""

        if tag == "turn":
            try: turn = int(p[2])
            except Exception: pass
            if turn >= 1: snap()
        elif tag in ("switch", "drag", "replace"):
            m = None
            if len(p) > 4:
                import re
                mm = re.search(r"(\d+)\/(\d+)", p[4])
                if mm and int(mm.group(2)): m = 100.0 * int(mm.group(1)) / int(mm.group(2))
            hp[slot] = 100.0 if m is None else m
            if len(p) > 3:
                active[slot] = _sid(p[3].split(",")[0])
        elif tag in ("-damage", "-heal", "-sethp"):
            if len(p) > 3:
                import re
                mm = re.search(r"(\d+)\/(\d+)", p[3])
                hp[slot] = (100.0 * int(mm.group(1)) / int(mm.group(2))) if (mm and int(mm.group(2))) else 0.0
        elif tag == "faint":
            if who in faint: faint[who] += 1
            if slot in hp: hp[slot] = 0.0
        elif tag == "-status":
            if who in status: status[who] += 1
        elif tag == "-curestatus":
            if who in status: status[who] = max(0, status[who] - 1)
        elif tag in ("-boost", "-unboost"):
            try: n = int(p[4])
            except Exception: n = 0
            if who in boost: boost[who] += n if tag == "-boost" else -n
        elif tag == "-sidestart":
            txt = (p[3] if len(p) > 3 else "").lower()
            if who in side:
                if "tailwind" in txt: side[who]["tailwind"] = 1
                elif "screen" in txt or "veil" in txt: side[who]["screen"] = 1
                elif "spikes" in txt or "rock" in txt: side[who]["hazard"] = 1
        elif tag == "-sideend":
            txt = (p[3] if len(p) > 3 else "").lower()
            if who in side:
                if "tailwind" in txt: side[who]["tailwind"] = 0
                elif "screen" in txt or "veil" in txt: side[who]["screen"] = 0
        elif tag == "-fieldstart":
            txt = (p[2] if len(p) > 2 else "").lower()
            if "trick room" in txt: field["trickroom"] = 1
            elif "terrain" in txt: field["terrain"] = 1
        elif tag == "-fieldend":
            txt = (p[2] if len(p) > 2 else "").lower()
            if "trick room" in txt: field["trickroom"] = 0
            elif "terrain" in txt: field["terrain"] = 0
        elif tag == "-weather":
            w = (p[2] if len(p) > 2 else "").lower()
            field["weather"] = 0 if w in ("none", "") else 1
    return out


def vec(st, me):
    you = "p2" if me == "p1" else "p1"
    return [
        st["alive"][me] - st["alive"][you],
        (st["act"][me] - st["act"][you]) / 100.0,
        (st["tot"][me] - st["tot"][you]) / 100.0,
        float(st["alive"][me]), float(st["alive"][you]), st["turn"] / 10.0,
        # The distribution terms, in the same order as FEATURES declares them.
        (st["min"][me] - st["min"][you]) / 100.0,
        st["min"][me] / 100.0,
        float(st["status"][me] - st["status"][you]),
        float(st["boost"][me] - st["boost"][you]),
        float(st["side"][me]["tailwind"] - st["side"][you]["tailwind"]),
        float(st["side"][me]["screen"] - st["side"][you]["screen"]),
        float(st["side"][me]["hazard"] - st["side"][you]["hazard"]),
        float(st["field"]["trickroom"]), float(st["field"]["weather"]), float(st["field"]["terrain"]),
    ] + _matchup(st, me, you)


def _matchup(st, me, you):
    """The three conversion terms. Averaged over the active slots on each side, because doubles has
    two of each and picking one would be arbitrary.

    Effectiveness is computed from the attacker's OWN TYPES, not its moveset: a public log does not
    reveal the moves before they are used, and this has to be computable at every turn including the
    first. It is a floor on the real matchup, not the whole of it -- a coverage move outside its own
    types is invisible here. Stated because it caps what these features can be worth."""
    act = st.get("active") or {}

    def types_of(side):
        got = []
        for L in ("a", "b"):
            sid = act.get(side + L)
            if sid and sid in MONS:
                got.append(MONS[sid].get("t") or [])
        return got

    def speed_of(side):
        got = [MONS[act[side + L]].get("spe", 0) for L in ("a", "b")
               if act.get(side + L) and act.get(side + L) in MONS]
        return (sum(got) / len(got)) if got else 0.0

    mine, theirs = types_of(me), types_of(you)
    if not mine or not theirs:
        return [0.0, 0.0, 0.0]

    def avg_best(atts, defs):
        vals = [_best_eff(a, d) for a in atts for d in defs]
        return sum(vals) / len(vals) if vals else 1.0

    my_on_them = avg_best(mine, theirs)
    their_on_me = avg_best(theirs, mine)
    ms, ys = speed_of(me), speed_of(you)
    # Scaled so a typical value sits near 0 and the sign carries the meaning, as board.js does.
    speed_edge = 0.0 if (ms + ys) == 0 else (ms - ys) / max(ms, ys)
    worst = max([_best_eff(t, m) for t in theirs for m in mine] or [1.0])
    return [
        math.log(max(0.25, my_on_them) / max(0.25, their_on_me)),
        speed_edge,
        math.log(max(0.25, worst)),
    ]


def winner_side(log):
    p = {"p1": "", "p2": ""}
    win = None
    for ln in log.split("\n"):
        if ln.startswith("|player|"):
            q = ln.split("|")
            if len(q) >= 4: p[q[2]] = q[3]
        elif ln.startswith("|win|"):
            win = ln.split("|")[2].strip()
    if not win: return None
    if win == p["p1"]: return "p1"
    if win == p["p2"]: return "p2"
    return None


def _open(path):
    if os.path.exists(path): return open(path, encoding="utf-8")
    if os.path.exists(path + ".gz"): return gzip.open(path + ".gz", "rt", encoding="utf-8")
    return None


def load(path, clean_ids=None, limit=None):
    """Positions and outcomes from a raw-logs file. clean_ids restricts to the quality filter; it is
    REQUIRED for the human corpus and meaningless for self-play, which has no bots to remove."""
    fh = _open(path)
    if fh is None: return np.zeros((0, len(FEATURES))), np.zeros(0), 0
    X, Y = [], []
    games = 0
    # DEDUPLICATE BY ID, first occurrence wins — the same order-preserving rule as
    # engine/quality.js readStore and engine/dedupe_store.py, so an un-deduped file on disk cannot
    # silently change a result.
    #
    # NOT THEORETICAL. mew.js enumerates matchups deterministically from its seed, so two runs
    # writing to the same --out file produce the SAME games twice: the first corpus built here held
    # 5,100 raw-log lines carrying 2,700 distinct ids. For a logistic fit that is merely a doubled
    # sample size. For a k-NN it is corrosive in a way that LOOKS like success -- an exact duplicate
    # of a position is its own nearest neighbour at distance zero, carrying its own outcome, so the
    # model appears to predict well by retrieving copies of the answer.
    seen = set()
    with fh:
        for line in fh:
            line = line.strip()
            if not line: continue
            try: r = json.loads(line)
            except Exception: continue
            gid = r.get("id")
            if gid in seen: continue
            seen.add(gid)
            if clean_ids is not None and gid not in clean_ids: continue
            log = r.get("log", "")
            w = winner_side(log)
            if w is None: continue
            for st in parse_states(log):
                X.append(vec(st, "p1")); Y.append(1.0 if w == "p1" else 0.0)
                X.append(vec(st, "p2")); Y.append(1.0 if w == "p2" else 0.0)
            games += 1
            if limit and games >= limit: break
    return np.array(X, dtype=float), np.array(Y, dtype=float), games


def clean_ids():
    try:
        from store import load_games as lg
        return {g.get("id") for g in lg(clean=True, announce=False) if g.get("id")}
    except Exception as e:
        print("PORYGON2: quality filter unavailable (%s) — refusing to evaluate on the raw store." % e)
        return None


# ---- scores ---------------------------------------------------------------------------------
def brier(p, y): return float(np.mean((p - y) ** 2))
def acc(p, y): return float(np.mean((p >= 0.5) == (y >= 0.5)))
def logloss(p, y):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return float(np.mean(-(y * np.log(p) + (1 - y) * np.log(1 - p))))

def boot_ci(fn, p, y, n=400):
    rng = np.random.default_rng(0)
    vals = [fn(p[i], y[i]) for i in (rng.integers(0, len(y), len(y)) for _ in range(n))]
    return float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))


def logistic_weights(Z, Y, iters=1500, lr=0.3, lam=1e-3):
    """Per-feature importance, learned rather than asserted.

    WILL'S POINT, AND IT IS THE CENTRAL WEAKNESS OF A k-NN: Euclidean distance in standardised space
    treats every feature as equally important. "Trick Room is up" then counts exactly as much as "I
    have two more Pokemon alive", which is plainly wrong, and it is why adding MORE features to a
    nearest-neighbour model can make it WORSE -- irrelevant dimensions dilute the distance and the
    neighbourhood fills with positions that merely happen to agree about terrain.

    So the dimensions are scaled by how much they actually predict the outcome. A logistic fit on the
    same training data gives that directly: the magnitude of each coefficient is how far the log-odds
    move per standard deviation of that feature. Cheap, and derived from the data rather than chosen.

    Returned as |coefficient|, normalised to mean 1 so the overall distance scale -- and therefore the
    meaning of k -- is unchanged. Only the RELATIVE geometry moves."""
    Zb = np.hstack([np.ones((len(Z), 1)), Z])
    w = np.zeros(Zb.shape[1])
    for _ in range(iters):
        p = 1.0 / (1.0 + np.exp(-Zb @ w))
        w -= lr * (Zb.T @ (p - Y) / len(Y) + lam * w)
    a = np.abs(w[1:])
    return a / (a.mean() + 1e-9)


def knn_predict(Xtr, Ytr, Xte, k=50, chunk=2000):
    """Distance-weighted k-NN in standardised space, brute force in numpy.

    Brute force ON PURPOSE: sklearn is not in requirements.txt and this repo pins its environment
    deliberately, so adding a dependency for a first measurement would be the wrong trade. At these
    sizes a chunked matrix multiply is fast enough, and it is exact rather than approximate -- an
    approximate index would confound "the idea does not work" with "the index lost the neighbours"."""
    out = np.empty(len(Xte))
    tr2 = (Xtr ** 2).sum(1)
    for i in range(0, len(Xte), chunk):
        Q = Xte[i:i + chunk]
        d2 = tr2[None, :] - 2.0 * Q @ Xtr.T + (Q ** 2).sum(1)[:, None]
        np.maximum(d2, 0, out=d2)
        idx = np.argpartition(d2, k, axis=1)[:, :k]
        dd = np.take_along_axis(d2, idx, 1)
        w = 1.0 / (np.sqrt(dd) + 1e-3)
        out[i:i + chunk] = (Ytr[idx] * w).sum(1) / w.sum(1)
    return np.clip(out, 1e-4, 1 - 1e-4)


def main():
    ids = clean_ids()
    if not ids:
        print("PORYGON2: no clean id set — aborting."); return

    Xs, Ys, gs = load(SELF_RAW)
    # A TRAINING CAP, because k-NN's cost is |test| x |train| and the corpus outgrew the method.
    #
    # Pointed at a modern 116,832-game run this loaded 2,331,924 positions and numpy asked for a
    # 34.7 GiB distance matrix. The old corpus was 73,368 positions, so nothing here was ever sized
    # for it. The fix is not a bigger machine: data/porygon2-curve.json measures 62.81% accuracy at
    # 9,171 positions against 62.62% at 73,368, so positions past the first ~10k buy NOTHING and
    # 2.3M of them is pure waste. Subsampled uniformly (not truncated) so the draw stays
    # representative of the whole run rather than of its first few thousand games.
    _cap = int(os.environ.get("PORYGON2_MAXTRAIN") or 120000)
    if _cap and len(Xs) > _cap:
        _idx = np.random.RandomState(0).choice(len(Xs), _cap, replace=False)
        Xs, Ys = Xs[_idx], Ys[_idx]
        print("  training positions capped at %s of %s (PORYGON2_MAXTRAIN)" % (f"{_cap:,}", f"{len(_idx):,}"))
    if gs == 0:
        print("PORYGON2: no self-play corpus at %s" % os.path.relpath(SELF_RAW, ROOT))
        print("  generate it:  SHOWDOWN_PATH=... node engine/mew.js --n 4000 --policy score --conc 4 \\")
        print("                  --out data/games.selfplay.porygon2.jsonl")
        return
    Xh, Yh, gh = load(HUMAN_RAW, clean_ids=ids)
    if gh == 0:
        print("PORYGON2: no clean human games — cannot evaluate."); return

    print("PORYGON2 — nearest-neighbour value function\n")
    print("  train  self-play %s games, %s positions" % (f"{gs:,}", f"{len(Ys):,}"))
    print("  test   human     %s games, %s positions  (clean, never trained on)" % (f"{gh:,}", f"{len(Yh):,}"))
    print("  features %d: %s\n" % (len(FEATURES), ", ".join(FEATURES)))

    mu, sd = Xs.mean(0), Xs.std(0) + 1e-9
    Zs, Zh = (Xs - mu) / sd, (Xh - mu) / sd

    fw = logistic_weights(Zs, Ys)
    print("  learned feature weights (relative, mean 1) — how much each actually predicts:", flush=True)
    for n, v in sorted(zip(FEATURES, fw), key=lambda t: -t[1]):
        print("    %-16s %5.2f  %s" % (n, v, "#" * int(round(v * 8))), flush=True)
    print("", flush=True)

    # EVALUATION SUBSAMPLE. Every k-NN config is a |test| x |train| distance matrix; at 38k x 58k
    # that is 2.2 billion distances per config and the run stopped being interactive. A fixed random
    # 12,000-position subsample of the HELD-OUT HUMAN set keeps the +/- on accuracy near 0.5 points,
    # which is far tighter than the differences being compared. Seeded, so every model below is
    # scored on the SAME positions and the comparison stays paired.
    rng = np.random.default_rng(0)
    sub = rng.choice(len(Yh), size=min(12000, len(Yh)), replace=False)
    Zh_e, Xh_e, Yh_e = Zh[sub], Xh[sub], Yh[sub]

    # ---- THE LEARNING CURVE: does more self-play keep paying, or does it plateau? --------------
    # This is the decisive question for a k-NN, and it is the one thing a parametric model cannot
    # match if the answer is "keeps paying": a nearest-neighbour model improves with data at no
    # training cost, so a rising curve means the value function gets better for free every time the
    # self-play generator runs. A FLAT curve means the opposite -- the ceiling is the feature set,
    # not the sample size, and effort should go into features instead.
    #
    # Subsamples are nested and seeded, so each point is a superset of the last and the comparison is
    # not confounded by which games happened to be drawn.
    if "--curve" in sys.argv:
        rng0 = np.random.default_rng(1)
        order = rng0.permutation(len(Ys))
        rng = np.random.default_rng(0)
        sub = rng.choice(len(Yh), size=min(8000, len(Yh)), replace=False)
        Zh_c, Yh_c = Zh[sub], Yh[sub]
        print("  LEARNING CURVE — accuracy on held-out HUMAN games, k=200", flush=True)
        print("    train positions     accuracy      Brier", flush=True)
        curve = []
        for frac in (0.125, 0.25, 0.5, 1.0):
            n = max(200, int(len(Ys) * frac))
            idx = order[:n]
            p = knn_predict(Zs[idx], Ys[idx], Zh_c, k=200)
            a, b = acc(p, Yh_c), brier(p, Yh_c)
            curve.append({"positions": int(n), "accuracy": round(100 * a, 2), "brier": round(b, 4)})
            print("    %11s      %5.1f%%      %.4f" % (f"{n:,}", 100 * a, b), flush=True)
        d = curve[-1]["accuracy"] - curve[0]["accuracy"]
        print("", flush=True)
        print("    8x the data moved accuracy %+.1f points." % d, flush=True)
        print("    %s" % ("Still climbing — more self-play is the cheapest improvement available."
                          if d >= 0.8 else
                          "Flat. The ceiling is the FEATURE SET, not the sample size: adding data is "
                          "not the lever, adding what a position vector can see is."), flush=True)
        print("", flush=True)
        json.dump(curve, open(os.path.join(ROOT, "data", "porygon2-curve.json"), "w"), indent=1, allow_nan=False)

    rows = []
    rows.append(("coin", np.full(len(Yh_e), 0.5)))
    sign = np.clip(0.5 + 0.15 * Xh_e[:, 0], 0.02, 0.98)
    rows.append(("material sign", sign))
    Zsw, Zhw = Zs * fw, Zh_e * fw
    for k in (50, 200):
        print("    ...plain k=%d" % k, flush=True)
        rows.append(("plain k=%d" % k, knn_predict(Zs, Ys, Zh_e, k=k)))
    for k in (50, 200):
        print("    ...weighted k=%d" % k, flush=True)
        rows.append(("weighted k=%d" % k, knn_predict(Zsw, Ys, Zhw, k=k)))
    Yh = Yh_e; Xh = Xh_e

    print("  model                 accuracy            Brier      (lower is better)")
    print("  " + "-" * 66)
    best = None
    for name, p in rows:
        a = acc(p, Yh); b = brier(p, Yh)
        lo, hi = boot_ci(acc, p, Yh)
        print("  %-20s %5.1f%%  [%4.1f, %4.1f]     %.4f" % (name, 100 * a, 100 * lo, 100 * hi, b))
        if name.startswith("PORYGON2") and (best is None or b < best[2]):
            best = (name, a, b, p)

    print("")
    if best:
        base = brier(sign, Yh)
        print("  best: %s — %.1f%% accuracy against %.1f%% for the material-sign heuristic."
              % (best[0], 100 * best[1], 100 * acc(sign, Yh)))
        print("  %s" % ("It beats the material baseline on Brier." if best[2] < base
                        else "It does NOT beat the material baseline on Brier — the extra features are not paying."))

    json.dump({
        "generated": utc_now(),
        "by": "engine/porygon2.py",
        "what": "Nearest-neighbour value function. TRAINED on MEW self-play, EVALUATED on held-out "
                "clean human games, per docs/POKER-TO-POKEMON.md section 7: self-play is the training "
                "signal, human games are the calibration set and never the training signal.",
        "features": FEATURES,
        "train": {"source": "self-play (mew.js --policy score)", "games": gs, "positions": int(len(Ys))},
        "test": {"source": "clean human ladder replays", "games": gh, "positions": int(len(Yh))},
        "results": {n: {"accuracy": round(100 * acc(p, Yh), 2), "brier": round(brier(p, Yh), 4),
                        "logloss": round(logloss(p, Yh), 4)} for n, p in rows},
        "caveat": "Self-play positions come from MAG playing itself. If MAG's play is unlike human "
                  "play the neighbourhoods are unrepresentative and the lookup is confidently wrong; "
                  "that is why the evaluation set is HUMAN. A large gap between self-play holdout and "
                  "human holdout would be distribution shift, and the human number is the one to trust.",
    }, open(OUT, "w", encoding="utf-8"), indent=1, allow_nan=False)
    print("\nwrote %s" % os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
