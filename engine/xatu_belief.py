#!/usr/bin/env python3
"""xatu_belief.py — XATU as a belief state, not a usage table.

The distinction
---------------
The current XATU is a *population* statement: "Kingambit usually runs Sucker Punch." That is a prior
over sets, and it never changes during a game. But in a closed-sheet format nothing about the
opponent is known until it is proven, and every reveal is information. What we actually want is a
*per-slot information state*: the set of things this Pokemon could still be, narrowed by everything
it has already shown us in THIS game.

The cheapest, hardest constraint is the one a usage table cannot express:

    a Pokemon has exactly four moves.

So once three are revealed the fourth is heavily constrained, and once four are revealed the
distribution over "what comes next" collapses onto those four *entirely* — every other move in the
usage table drops to zero, no matter how popular it is in the population. That is not a smoothing
tweak; it is a logical certainty the prior gets wrong on every single turn after the fourth reveal.

What is measured here
---------------------
Walking each held-out game turn by turn, at every move event we predict the move about to be used
and score it, comparing three models on the same events:

    uniform     - every move in the format, equally likely (the floor)
    usage prior - P(move | species), learned from TRAIN games only (today's XATU)
    belief      - the same prior, restricted to what is still possible given what THIS Pokemon has
                  already revealed in THIS game, renormalised

Scored by cross-entropy (a proper score, lower is better) and top-1 accuracy. The split is by game
id hash, the prior is fitted on train only, and the belief update uses strictly earlier turns of the
same game, so nothing leaks.

Honest scope: this models the MOVE slot. Items and abilities are also unknown-until-proven and are
tracked here as possibility sets (reported, not yet scored). EVs are different in kind — they never
collapse to a value, only to an interval, and are left for a separate estimator.

    python3 engine/xatu_belief.py
Writes data/xatu-belief.json
"""
import json, os, math
from collections import defaultdict, Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
STORE = D("data", "games.ladder.jsonl")

MAX_MOVES = 4          # the constraint the usage prior cannot express
ALPHA = 0.5            # Laplace smoothing on the prior

def load_games():
    """CLEAN ONLY. XATU is a belief about what a HUMAN OPPONENT is holding — which item, which
    ability, which spread. Learned over the unfiltered store, roughly 87% of which is bots, forfeits
    and stubs (the Garbodor rule), the prior it builds is a belief about bot teams and the name on it
    is a lie. This is the one model in the project where training-set contamination is not a loss of
    accuracy but a change of subject."""
    import sys, os as _os
    sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
    import quality
    for g in quality.load_games(clean=True):
        yield g

def split(gid):
    h = 0
    for ch in gid: h = (h*131 + ord(ch)) & 0xffffffff
    return "test" if h % 5 == 0 else "train"

def build():
    games = list(load_games())
    train = [g for g in games if split(g["id"]) == "train"]
    test  = [g for g in games if split(g["id"]) == "test"]

    # ---- prior from TRAIN only: P(move | species), plus the global move distribution ----
    per_species = defaultdict(Counter)
    global_moves = Counter()
    for g in train:
        for t in (g.get("turns") or []):
            for e in t.get("ev", []):
                if e.get("t") == "m" and e.get("mv") and e.get("mon"):
                    per_species[e["mon"]][e["mv"]] += 1
                    global_moves[e["mv"]] += 1
    vocab = set(global_moves)
    V = len(vocab) or 1

    # ---- LEARN the repeat factor rather than asserting one ------------------------------
    # A move already revealed is confirmed to occupy one of the four slots, so it should be more
    # likely next time than the population rate suggests. How much more is an empirical question,
    # so it is measured on TRAIN games: across all move events, how often was the move about to be
    # used one this Pokemon had already shown, versus what the prior alone would predict?
    rep_hit = rep_tot = new_hit = new_tot = 0
    for g in train:
        seen_tr = defaultdict(set)
        for t in (g.get("turns") or []):
            for e in t.get("ev", []):
                if e.get("t") != "m" or not e.get("mv") or not e.get("mon"): continue
                k = (str(e.get("s",""))[:2], e["mon"])
                s_ = seen_tr[k]
                if s_:
                    if e["mv"] in s_: rep_hit += 1
                    else: new_hit += 1
                    rep_tot += 1
                s_.add(e["mv"])
    # observed odds that the next move is a repeat, once anything has been revealed
    p_repeat = rep_hit / max(rep_tot, 1)
    # convert to a multiplicative boost on the prior mass of already-seen moves
    REPEAT_BOOST = max(1.0, (p_repeat / max(1e-9, 1 - p_repeat)))

    def prior_dist(sp):
        c = per_species.get(sp)
        if not c:
            tot = sum(global_moves.values()) or 1
            return {m: global_moves[m]/tot for m in global_moves}
        tot = sum(c.values()) + ALPHA*len(c)
        return {m: (c[m]+ALPHA)/tot for m in c}

    # ---- walk the held-out games, maintaining the information state ----
    n = 0
    ce_uniform = ce_prior = ce_belief = 0.0
    hit_prior = hit_belief = 0
    # how much of the gain comes from the hard 4-move cap vs from re-weighting
    events_at_cap = 0
    ce_prior_at_cap = ce_belief_at_cap = 0.0
    item_known = Counter(); ability_known = Counter()
    per_game_delta = {}   # game id -> per-event (prior loss - belief loss), for a clustered CI

    for g in test:
        revealed = defaultdict(set)        # (side, species) -> moves seen so far THIS game
        for t in (g.get("turns") or []):
            for e in t.get("ev", []):
                if e.get("t") != "m" or not e.get("mv") or not e.get("mon"): continue
                side = str(e.get("s", ""))[:2]
                sp, mv = e["mon"], e["mv"]
                key = (side, sp)
                seen = revealed[key]

                pri = prior_dist(sp)
                if mv not in pri: pri = dict(pri); pri[mv] = ALPHA/(sum(per_species.get(sp, {}).values()) + 1)

                # belief = prior restricted to what is still possible
                if len(seen) >= MAX_MOVES:
                    # all four slots are known: nothing outside them is possible
                    cand = {m: pri.get(m, 1e-9) for m in seen}
                    at_cap = True
                else:
                    # already-revealed moves are CONFIRMED to be in the set; unrevealed ones still
                    # compete for the remaining slots
                    cand = {}
                    for m, p in pri.items():
                        cand[m] = p * (REPEAT_BOOST if m in seen else 1.0)
                    for m in seen: cand.setdefault(m, 1e-6)
                    at_cap = False
                z = sum(cand.values()) or 1.0
                bel = {m: v/z for m, v in cand.items()}

                pu = 1.0/V
                pp = max(1e-12, pri.get(mv, 1e-12))
                pb = max(1e-12, bel.get(mv, 1e-12))
                ce_uniform += -math.log(pu)
                ce_prior   += -math.log(pp)
                ce_belief  += -math.log(pb)
                if pri and max(pri, key=pri.get) == mv: hit_prior += 1
                if bel and max(bel, key=bel.get) == mv: hit_belief += 1
                if at_cap:
                    events_at_cap += 1
                    ce_prior_at_cap  += -math.log(pp)
                    ce_belief_at_cap += -math.log(pb)
                per_game_delta.setdefault(g["id"], []).append(
                    (-math.log(pp)) - (-math.log(pb)))   # prior loss minus belief loss, per event
                n += 1
                seen.add(mv)

        for sp, s in (g.get("sets") or {}).items():
            if s.get("item"): item_known[sp] += 1
            if s.get("ability"): ability_known[sp] += 1

    # Clustered bootstrap over GAMES (events inside a game are correlated, so resampling events
    # would understate the uncertainty). Positive delta = belief is better than the prior.
    import numpy as _np
    gids = list(per_game_delta)
    game_mean = _np.array([_np.mean(per_game_delta[g]) for g in gids]) if gids else _np.array([0.0])
    rs = _np.random.default_rng(13)
    idx = rs.integers(0, len(game_mean), size=(2000, len(game_mean)))
    boot = _np.sort(game_mean[idx].mean(axis=1))
    delta_mean = float(game_mean.mean())
    delta_ci = (round(float(boot[int(.025*len(boot))]), 4), round(float(boot[int(.975*len(boot))]), 4))

    out = dict(
        generated=__import__("datetime").date.today().isoformat(),
        n_games=len(games), n_train=len(train), n_test=len(test), n_move_events=n,
        move_vocabulary=V,
        repeat_boost_learned=round(REPEAT_BOOST, 3),
        p_next_move_is_a_repeat=round(p_repeat, 4),
        cross_entropy=dict(
            uniform=round(ce_uniform/max(n,1), 4),
            usage_prior=round(ce_prior/max(n,1), 4),
            belief=round(ce_belief/max(n,1), 4),
        ),
        top1_accuracy=dict(
            usage_prior=round(hit_prior/max(n,1), 4),
            belief=round(hit_belief/max(n,1), 4),
        ),
        where_the_gain_comes_from=dict(
            events_with_all_four_moves_known=events_at_cap,
            share_of_events=round(events_at_cap/max(n,1), 4),
            usage_prior_ce_on_those=round(ce_prior_at_cap/max(events_at_cap,1), 4),
            belief_ce_on_those=round(ce_belief_at_cap/max(events_at_cap,1), 4),
            note=("Once four moves are revealed the move set is CLOSED. The usage prior keeps "
                  "assigning probability to moves that are now impossible; the belief state does not. "
                  "This is where a usage table is not merely imprecise but wrong."),
        ),
        improvement_over_prior=dict(
            mean_log_loss_reduction=round(delta_mean, 4),
            ci95_clustered_by_game=delta_ci,
            significant=bool(delta_ci[0] > 0),
            reading=("Positive means the belief state predicts the opponent's next move better than "
                     "the usage prior. Clustered by game because events within one game are not "
                     "independent. If the interval includes zero, the gain is not established."),
        ),
        method=("Prior fitted on train games only. Belief uses strictly earlier turns of the same "
                "held-out game. Cross-entropy is a proper score; lower is better."),
        scope=("Models the MOVE slot. Items and abilities are unknown-until-proven too and are "
               "tracked as possibility sets elsewhere; EVs never collapse to a value (only to an "
               "interval) and need a separate estimator."),
    )
    json.dump(out, open(D("data", "xatu-belief.json"), "w"), indent=1)

    ce = out["cross_entropy"]; acc = out["top1_accuracy"]
    print(f"xatu_belief — {len(games)} games ({len(test)} held out), {n:,} move events, vocab {V}")
    print(f"  cross-entropy   uniform {ce['uniform']}   usage prior {ce['usage_prior']}   belief {ce['belief']}")
    print(f"  top-1 accuracy  usage prior {acc['usage_prior']:.1%}   belief {acc['belief']:.1%}")
    w = out["where_the_gain_comes_from"]
    print(f"  events where all 4 moves already known: {w['events_with_all_four_moves_known']:,} "
          f"({w['share_of_events']:.1%}) — prior {w['usage_prior_ce_on_those']} vs belief {w['belief_ce_on_those']}")
    better = ce["belief"] < ce["usage_prior"]
    print(f"  VERDICT: belief {'beats' if better else 'does NOT beat'} the usage prior "
          f"({ce['belief']} vs {ce['usage_prior']})")
    return out

if __name__ == "__main__":
    build()
