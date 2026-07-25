"""state_encoder.py — turn a Showdown protocol log into a RICH per-turn state vector.

WHY THIS EXISTS, AND WHY IT IS THE ACTUAL BOTTLENECK
====================================================
PORY's held-out log-loss is 0.567 against a coin's 0.693, and docs/REVIEW-2026-07-25.md showed that
number is almost entirely arithmetic: its feature vector is

    [bias, alive_diff, hp_diff, my_alive, foe_alive, turn/10]

which is the MATERIAL STATE OF THE BOARD. engine/pory_baseline.py measured the consequence — a
two-feature material baseline (alive_diff + hp_diff) scores 0.5822 and BEATS PORY's 0.5840. The model
adds nothing over counting what is left alive.

The instinctive fix is a bigger model. It does not work, and it is worth being precise about why: a
neural network is a function approximator over the features it is GIVEN. With six material features
there is no hidden structure left to find — the mapping from "3 alive vs 2 alive" to a win
probability is already close to monotone and smooth, and a multilayer perceptron can only add
interaction terms to information the linear model has already extracted. Capacity is not the binding
constraint. REPRESENTATION is.

This is the same lesson the game-playing literature learned twice:

  - Tesauro's TD-Gammon (1994) reached strong play with a small network, but only once the input
    included a hand-designed encoding of board features rather than raw checker counts.
  - AlphaGo Zero / AlphaZero (Silver et al., 2017, 2018) feed the value head a STACK OF PLANES —
    piece positions, repetition, side to move, move count — not a material count. The material
    baseline in chess (queen=9, rook=5, ...) is exactly the thing the value net has to beat, and it
    beats it by seeing WHERE the pieces are, not how many.
  - Leela Chess Zero's own ablations show that stripping the positional planes and leaving material
    collapses the value head toward the handcrafted evaluation.

So this module builds the planes. It reconstructs, per turn, what a player can actually see: which
Pokemon are alive and at what HP, which are ACTIVE versus benched, status conditions, stat boosts on
the field, weather/terrain/Trick Room/Tailwind/screens, and hazards. Those are the things that decide
VGC games and none of them are in PORY's six numbers.

WHAT IS DELIBERATELY NOT IN HERE
--------------------------------
Species identity. There are ~240 species in the format and a one-hot of that (times 8 slots) is a
1,920-dimensional input, which on 8,700 real games would be fit almost entirely to noise. Species
enters only through TYPE and through the stats that types imply. When the self-play corpus is large
enough to support it, species embeddings are the obvious next step, and the encoder is versioned so
that change is visible rather than silent.

PERSPECTIVE AND SYMMETRY. Every state is emitted TWICE, once from each side's point of view, with the
sides swapped. This is not data augmentation for its own sake: it forces the model to learn a function
that is antisymmetric in the two players, which is true of the game and which a model trained on p1's
view alone will not respect. Both copies of a state carry the same game id so the split cannot
separate them.

    from state_encoder import encode_log, FEATURE_NAMES
    rows = encode_log(protocol_log)     # [(features, label_for_p1_perspective), ...]
"""
import re

ENCODER_VERSION = 2

# ---------------------------------------------------------------------------------------------
# Champions type chart is the standard Gen 9 chart; we use type only as a coarse identity signal,
# so the 18 types are one-hot per ACTIVE slot rather than a full matchup matrix.
TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground",
         "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"]
TYPE_IX = {t.lower(): i for i, t in enumerate(TYPES)}

STATUSES = ["brn", "par", "slp", "frz", "psn", "tox"]
STATUS_IX = {s: i for i, s in enumerate(STATUSES)}

BOOSTS = ["atk", "def", "spa", "spd", "spe", "accuracy", "evasion"]
BOOST_IX = {b: i for i, b in enumerate(BOOSTS)}

WEATHERS = ["raindance", "sunnyday", "sandstorm", "snowscape", "hail"]
TERRAINS = ["electricterrain", "grassyterrain", "psychicterrain", "mistyterrain"]

_norm = lambda s: re.sub(r"[^a-z0-9]", "", str(s).lower())


def _feature_names():
    n = ["bias", "turn_norm", "turn_log"]
    for side in ("me", "foe"):
        n += [f"{side}_alive", f"{side}_hp_mean", f"{side}_hp_active_mean",
              f"{side}_active_count", f"{side}_fainted"]
        for k in range(4):
            n += [f"{side}_slot{k}_alive", f"{side}_slot{k}_hp", f"{side}_slot{k}_active"]
        for s in STATUSES:
            n.append(f"{side}_status_{s}")
        for b in BOOSTS:
            n.append(f"{side}_boost_{b}")
        n += [f"{side}_tailwind", f"{side}_reflect", f"{side}_lightscreen", f"{side}_hazard"]
        for t in TYPES:
            n.append(f"{side}_activetype_{t.lower()}")
    n += ["alive_diff", "hp_diff", "boost_diff_atk", "boost_diff_spe"]
    for w in WEATHERS:
        n.append(f"weather_{w}")
    for t in TERRAINS:
        n.append(f"terrain_{t}")
    n += ["trickroom"]
    return n


FEATURE_NAMES = _feature_names()
N_FEATURES = len(FEATURE_NAMES)


class _Side:
    __slots__ = ("hp", "alive", "active", "status", "boosts", "tailwind", "reflect",
                 "lightscreen", "hazard", "types", "order")

    def __init__(self):
        self.hp = {}          # slotkey -> hp fraction 0..1
        self.alive = {}       # slotkey -> bool
        self.active = set()   # slot letters currently on field ('a','b')
        self.status = {}      # slotkey -> status string
        self.boosts = {}      # position ('a'/'b') -> {stat: stage}
        self.tailwind = 0
        self.reflect = 0
        self.lightscreen = 0
        self.hazard = 0
        self.types = {}       # position -> list of types
        self.order = []       # stable slot ordering for slot features


def _blank_state():
    return {"p1": _Side(), "p2": _Side(), "weather": "", "terrain": "", "trickroom": 0}


def winner_side(log):
    """'p1' / 'p2' / None. Matches engine/pory.py so the arms stay comparable."""
    m = re.search(r"\|win\|(.*)", log)
    if not m:
        return None
    who = m.group(1).strip()
    p1 = re.search(r"\|player\|p1\|([^|]*)", log)
    p2 = re.search(r"\|player\|p2\|([^|]*)", log)
    if p1 and p1.group(1).strip() == who:
        return "p1"
    if p2 and p2.group(1).strip() == who:
        return "p2"
    return None


def _vec_for(st, me, foe, turn):
    v = [0.0] * N_FEATURES
    ix = {n: i for i, n in enumerate(FEATURE_NAMES)}
    v[ix["bias"]] = 1.0
    v[ix["turn_norm"]] = min(turn / 20.0, 2.0)
    v[ix["turn_log"]] = (turn ** 0.5) / 5.0

    tot = {}
    for tag, side in (("me", st[me]), ("foe", st[foe])):
        keys = side.order[:6]
        alive = [k for k in keys if side.alive.get(k, True)]
        hps = [side.hp.get(k, 1.0) for k in alive]
        act = [k for k in keys if k in {f"{p}" for p in side.active}]
        v[ix[f"{tag}_alive"]] = len(alive)
        v[ix[f"{tag}_hp_mean"]] = sum(hps) / len(hps) if hps else 0.0
        acthp = [side.hp.get(k, 1.0) for k in act if side.alive.get(k, True)]
        v[ix[f"{tag}_hp_active_mean"]] = sum(acthp) / len(acthp) if acthp else 0.0
        v[ix[f"{tag}_active_count"]] = len(acthp)
        v[ix[f"{tag}_fainted"]] = sum(1 for k in keys if not side.alive.get(k, True))
        for k in range(4):
            if k < len(keys):
                key = keys[k]
                v[ix[f"{tag}_slot{k}_alive"]] = 1.0 if side.alive.get(key, True) else 0.0
                v[ix[f"{tag}_slot{k}_hp"]] = side.hp.get(key, 1.0)
                v[ix[f"{tag}_slot{k}_active"]] = 1.0 if key in act else 0.0
        for key, s in side.status.items():
            if s in STATUS_IX and side.alive.get(key, True):
                v[ix[f"{tag}_status_{s}"]] += 1.0
        for pos, bl in side.boosts.items():
            for b, stage in bl.items():
                if b in BOOST_IX:
                    v[ix[f"{tag}_boost_{b}"]] += stage
        v[ix[f"{tag}_tailwind"]] = side.tailwind
        v[ix[f"{tag}_reflect"]] = side.reflect
        v[ix[f"{tag}_lightscreen"]] = side.lightscreen
        v[ix[f"{tag}_hazard"]] = side.hazard
        for pos, tl in side.types.items():
            if pos in side.active:
                for t in tl:
                    key = f"{tag}_activetype_{_norm(t)}"
                    if key in ix:
                        v[ix[key]] = 1.0
        tot[tag] = (len(alive), sum(hps) / len(hps) if hps else 0.0)

    v[ix["alive_diff"]] = tot["me"][0] - tot["foe"][0]
    v[ix["hp_diff"]] = tot["me"][1] - tot["foe"][1]
    v[ix["boost_diff_atk"]] = v[ix["me_boost_atk"]] - v[ix["foe_boost_atk"]]
    v[ix["boost_diff_spe"]] = v[ix["me_boost_spe"]] - v[ix["foe_boost_spe"]]
    for w in WEATHERS:
        v[ix[f"weather_{w}"]] = 1.0 if st["weather"] == w else 0.0
    for t in TERRAINS:
        v[ix[f"terrain_{t}"]] = 1.0 if st["terrain"] == t else 0.0
    v[ix["trickroom"]] = st["trickroom"]
    return v


_RE_SWITCH = re.compile(r"^\|(?:switch|drag|replace)\|(p[12])([ab]): ([^|]*)\|([^,|]+)[^|]*?(?:\|(\d+)\\?/(\d+))?")
_RE_DAMAGE = re.compile(r"^\|-(?:damage|heal)\|(p[12])([ab])[^|]*\|(\d+)/(\d+)")
_RE_FAINT = re.compile(r"^\|faint\|(p[12])([ab])")
_RE_STATUS = re.compile(r"^\|-status\|(p[12])([ab])[^|]*\|([a-z]+)")
_RE_CURE = re.compile(r"^\|-curestatus\|(p[12])([ab])")
_RE_BOOST = re.compile(r"^\|-(un)?boost\|(p[12])([ab])[^|]*\|([a-z]+)\|(\d+)")
_RE_WEATHER = re.compile(r"^\|-weather\|([A-Za-z]+)")
_RE_FIELD = re.compile(r"^\|-fieldstart\|move: ([A-Za-z ]+)")
_RE_FIELDEND = re.compile(r"^\|-fieldend\|move: ([A-Za-z ]+)")
_RE_SIDESTART = re.compile(r"^\|-sidestart\|(p[12])[^|]*\|(?:move: )?([A-Za-z ]+)")
_RE_SIDEEND = re.compile(r"^\|-sideend\|(p[12])[^|]*\|(?:move: )?([A-Za-z ]+)")


def encode_log(log, dex_types=None):
    """Yield (feature_vector, label) pairs, both perspectives, for every turn of the game.

    label is 1 if the perspective side won. Returns [] when the game has no resolvable winner,
    which is the same rule pory.py uses, so the row sets stay comparable across arms.
    """
    w = winner_side(log)
    if w is None:
        return []
    st = _blank_state()
    key_of = {}          # 'p1a' -> stable identity key (the species string)
    out = []
    turn = 0

    for ln in log.split("\n"):
        if not ln.startswith("|"):
            continue

        m = _RE_SWITCH.match(ln)
        if m:
            p, pos, _nick, species = m.group(1), m.group(2), m.group(3), m.group(4)
            side = st[p]
            k = _norm(species)
            key_of[p + pos] = k
            if k not in side.order:
                side.order.append(k)
            side.alive.setdefault(k, True)
            if m.group(5) and m.group(6):
                try:
                    side.hp[k] = max(0.0, min(1.0, int(m.group(5)) / max(1, int(m.group(6)))))
                except ValueError:
                    side.hp.setdefault(k, 1.0)
            else:
                side.hp.setdefault(k, 1.0)
            side.active.add(pos)
            side.boosts[pos] = {}
            if dex_types and k in dex_types:
                side.types[pos] = dex_types[k]
            continue

        m = _RE_DAMAGE.match(ln)
        if m:
            p, pos = m.group(1), m.group(2)
            k = key_of.get(p + pos)
            if k:
                try:
                    st[p].hp[k] = max(0.0, min(1.0, int(m.group(3)) / max(1, int(m.group(4)))))
                except ValueError:
                    pass
            continue

        m = _RE_FAINT.match(ln)
        if m:
            p, pos = m.group(1), m.group(2)
            k = key_of.get(p + pos)
            if k:
                st[p].alive[k] = False
                st[p].hp[k] = 0.0
            st[p].active.discard(pos)
            continue

        m = _RE_STATUS.match(ln)
        if m:
            k = key_of.get(m.group(1) + m.group(2))
            if k:
                st[m.group(1)].status[k] = m.group(3)
            continue

        m = _RE_CURE.match(ln)
        if m:
            k = key_of.get(m.group(1) + m.group(2))
            if k:
                st[m.group(1)].status.pop(k, None)
            continue

        m = _RE_BOOST.match(ln)
        if m:
            neg, p, pos, stat, amt = m.groups()
            try:
                amt = int(amt)
            except ValueError:
                amt = 0
            d = st[p].boosts.setdefault(pos, {})
            d[stat] = max(-6, min(6, d.get(stat, 0) + (-amt if neg else amt)))
            continue

        m = _RE_WEATHER.match(ln)
        if m:
            wname = _norm(m.group(1))
            st["weather"] = "" if wname in ("none",) else wname
            continue

        m = _RE_FIELD.match(ln)
        if m:
            f = _norm(m.group(1))
            if f == "trickroom":
                st["trickroom"] = 1
            elif f in TERRAINS:
                st["terrain"] = f
            continue

        m = _RE_FIELDEND.match(ln)
        if m:
            f = _norm(m.group(1))
            if f == "trickroom":
                st["trickroom"] = 0
            elif f == st["terrain"]:
                st["terrain"] = ""
            continue

        m = _RE_SIDESTART.match(ln)
        if m:
            p, what = m.group(1), _norm(m.group(2))
            side = st[p]
            if what == "tailwind":
                side.tailwind = 1
            elif what == "reflect":
                side.reflect = 1
            elif what == "lightscreen":
                side.lightscreen = 1
            elif what in ("stealthrock", "spikes", "toxicspikes", "stickyweb"):
                side.hazard = 1
            continue

        m = _RE_SIDEEND.match(ln)
        if m:
            p, what = m.group(1), _norm(m.group(2))
            side = st[p]
            if what == "tailwind":
                side.tailwind = 0
            elif what == "reflect":
                side.reflect = 0
            elif what == "lightscreen":
                side.lightscreen = 0
            continue

        if ln.startswith("|turn|"):
            try:
                turn = int(ln.split("|")[2])
            except (IndexError, ValueError):
                pass
            if turn >= 1:
                # BOTH perspectives, sides swapped. Antisymmetry is a property of the game.
                out.append((_vec_for(st, "p1", "p2", turn), 1 if w == "p1" else 0))
                out.append((_vec_for(st, "p2", "p1", turn), 1 if w == "p2" else 0))
    return out
