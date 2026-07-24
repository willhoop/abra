#!/usr/bin/env python3
"""roles.py — the ROLE model (multi-label team composition).

Why this exists
---------------
The old playstyle model gave each team ONE label (Sun *or* Tailwind *or* Trick Room).
A real Champions team is several of those at once, so the single label threw away most of
what a team is and shattered the data into archetype-by-archetype cells of n=11-18 — which is
why those matchup numbers were untrustworthy. This model instead tags every ROLE a team reveals
and pools the data at the role-vs-role level, where each cell is informed by hundreds of games.

Literature: multi-label classification (Tsoumakas & Katakis 2007); team-as-mixture-of-latent-roles
(topic models, Blei-Ng-Jordan 2003); latent roles beat raw identity for outcome prediction in team
sports (arXiv 2304.08272); role-vs-role as a bilinear/low-rank form ties to blade-chest (Chen &
Joachims) and Nash-averaging (Balduzzi) — the same non-transitivity math already in LITERATURE-v2.

What it does, in four passes over data/games.ladder.jsonl (store; raw, never re-pulled):
  1. Species capability table  — every role each species has actually been SEEN playing
     (data-driven "all the roles a Pokemon could play"). -> data/pokemon-roles.json
  2. Team role vectors         — each side's six at team preview -> its set of roles (leak-free).
  3. Role-pair matchup matrix  — P(role A side beats role B side), Wilson CIs, pooled. -> role-matchups.json
  4. Victory attribution       — (a) a held-out logistic predictor whose per-role coefficients ARE
     each role's win-credit, vs a coin AND a rating baseline; (b) KO-credit per species from the
     turn log (who actually scored the knockouts in games their side won). -> data/roles-eval.json

Pure standard library. No numpy. Deterministic (fixed split + seed). Read-only on the store.
    python3 engine/roles.py
"""
import json, os, math, random
from collections import defaultdict, Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
STORE = D("data", "games.ladder.jsonl")
LN2 = math.log(2)  # 0.693147 — a coin's log-loss, the honest floor

# ---------------------------------------------------------------------------
# 1. Role taxonomy. Each role is a functional job; a team can hold many at once.
#    Signals are revealed moves / abilities (closed sheets reveal on use), so a species
#    is credited with a role once it has been observed doing it (capability, earned from data).
#    label = human name; the phys/spec wall split needs base stats (a dex table) — flagged roadmap.
# ---------------------------------------------------------------------------
ROLE_SIGNALS = {
 "speed_tailwind": dict(label="Tailwind (speed up)",
    moves={"Tailwind"}),
 "speed_trickroom": dict(label="Trick Room setter",
    moves={"Trick Room"}),
 "speed_lower": dict(label="Speed control (lower foe)",
    moves={"Icy Wind","Electroweb","Bulldoze","Rock Tomb","Glaciate","Cotton Spore","String Shot","Scary Face"}),
 "weather": dict(label="Weather setter",
    moves={"Sunny Day","Rain Dance","Sandstorm","Snowscape","Hail","Chilly Reception"},
    abilities={"Drought","Drizzle","Sand Stream","Snow Warning","Orichalcum Pulse","Sand Spit","Desolate Land","Primordial Sea"}),
 "terrain": dict(label="Terrain setter",
    moves={"Psychic Terrain","Grassy Terrain","Misty Terrain","Electric Terrain"},
    abilities={"Psychic Surge","Grassy Surge","Misty Surge","Electric Surge","Hadron Engine"}),
 "fakeout": dict(label="Fake Out (tempo)",
    moves={"Fake Out"}),
 "redirection": dict(label="Redirection",
    moves={"Follow Me","Rage Powder"}),
 "taunt": dict(label="Taunt",
    moves={"Taunt"}),
 "encore": dict(label="Encore",
    moves={"Encore"}),
 "priority": dict(label="Priority attacker",
    moves={"Aqua Jet","Sucker Punch","Quick Attack","Extreme Speed","Bullet Punch","Ice Shard",
           "Shadow Sneak","Grassy Glide","Jet Punch","Mach Punch","Vacuum Wave","Water Shuriken",
           "Accelerock","First Impression","Ice Shard","Baby-Doll Eyes"}),
 "prankster": dict(label="Prankster (priority support)",
    abilities={"Prankster","Gale Wings"}),
 "status": dict(label="Status user",
    moves={"Will-O-Wisp","Thunder Wave","Nuzzle","Sleep Powder","Spore","Yawn","Hypnosis","Glare",
           "Stun Spore","Toxic","Zap Cannon","Lovely Kiss","Sing","Dark Void","Poison Powder","Nuzzle",
           "Baneful Bunker","Toxic Thread","Poison Gas","Sleep Powder"}),
 "debuff": dict(label="Debuff (Intimidate / drops)",
    moves={"Parting Shot","Charm","Snarl","Struggle Bug","Fake Tears","Screech","Tickle","Baby-Doll Eyes",
           "Feather Dance","Growl","Play Nice","Captivate","Noble Roar","Tearful Look","Spirit Break","Lunge",
           "King's Shield","Silk Trap"},
    abilities={"Intimidate"}),
 "setup": dict(label="Setup / sweeper",
    moves={"Swords Dance","Dragon Dance","Nasty Plot","Calm Mind","Bulk Up","Tail Glow","Quiver Dance",
           "Shell Smash","Growth","Coil","Clangorous Soul","Victory Dance","Iron Defense","Curse",
           "Belly Drum","Work Up","Agility","Rock Polish","Take Heart","Geomancy","No Retreat"},
    abilities={"Speed Boost"}),
 "healing": dict(label="Healing / sustain",
    moves={"Recover","Roost","Wish","Life Dew","Pollen Puff","Matcha Gotcha","Synthesis","Moonlight",
           "Morning Sun","Slack Off","Milk Drink","Jungle Healing","Lunar Blessing","Soft-Boiled","Rest",
           "Strength Sap","Giga Drain","Drain Punch","Horn Leech","Draining Kiss","Leech Life","Parabolic Charge"}),
 "screens": dict(label="Screen setter",
    moves={"Light Screen","Reflect","Aurora Veil"}),
 "teamprotect": dict(label="Wide / Quick Guard",
    moves={"Wide Guard","Quick Guard"}),
 "helpinghand": dict(label="Helping Hand",
    moves={"Helping Hand"}),
 "pivot": dict(label="Pivot",
    moves={"Parting Shot","Flip Turn","U-turn","Volt Switch","Teleport","Baton Pass","Chilly Reception"}),
 "wall": dict(label="Bulky wall / support",
    moves={"Wide Guard","Quick Guard","Light Screen","Reflect","Aurora Veil","Life Dew","Helping Hand",
           "Follow Me","Rage Powder","Pollen Puff","Wish"},
    abilities={"Stamina","Multiscale","Fur Coat","Ice Face","Fluffy","Thick Fat","Regenerator"}),
 "trapping": dict(label="Trapper",
    moves={"Fairy Lock","Spider Web","Mean Look","Block","Anchor Shot","Thousand Waves","Spirit Shackle",
           "Infestation","Whirlpool","Fire Spin","Sand Tomb","Bind","Wrap"},
    abilities={"Shadow Tag","Arena Trap","Magnet Pull"}),
 "perish": dict(label="Perish Trap",
    moves={"Perish Song"}),
 "allysupport": dict(label="Ally support / positioning",
    moves={"Instruct","Ally Switch","After You","Coaching","Decorate","Helping Hand","Quash",
           "Aromatic Mist","Gear Up","Magnetic Flux","Heal Pulse"}),
 "itemdisrupt": dict(label="Item disruption",
    moves={"Trick","Switcheroo","Thief","Covet","Corrosive Gas","Incinerate"}),  # Knock Off via override
 "phys_attacker": dict(label="Physical attacker", moves=set()),   # special-cased (>=2 phys moves)
 "spec_attacker": dict(label="Special attacker", moves=set()),    # special-cased (>=2 spec moves)
}
ROLES = list(ROLE_SIGNALS.keys())

# Damage category for the common attacking moves — tags physical vs special attacker.
# A mon earns the role when a single set reveals >= 2 moves of that category.
PHYS = {"Rock Slide","Wave Crash","Earthquake","Close Combat","Last Respects","Sucker Punch","Flare Blitz",
    "Iron Head","Dragon Claw","Kowtow Cleave","Knock Off","Stomping Tantrum","Aqua Jet","Brave Bird",
    "Dual Wingbeat","Flip Turn","High Horsepower","Ice Punch","Throat Chop","Dire Claw","Quick Attack",
    "Bullet Punch","Play Rough","U-turn","Glaive Rush","Headlong Rush","Population Bomb","Triple Axel",
    "Facade","Extreme Speed","Ice Shard","Shadow Sneak","Grassy Glide","Jet Punch","Mach Punch",
    "Accelerock","First Impression","Liquidation","Crunch","Gunk Shot","Zen Headbutt","Poison Jab",
    "Drain Punch","Horn Leech","Leech Life","Wood Hammer","Bitter Blade","Ivy Cudgel","Collision Course",
    "Foul Play","Darkest Lariat","Spirit Break","Gigaton Hammer","Surging Strikes","Ceaseless Edge",
    "Icicle Crash","Stone Edge","Body Slam","Waterfall","Play Rough","Fishious Rend","Bolt Strike"}
SPEC = {"Heat Wave","Hyper Voice","Moonblast","Weather Ball","Shadow Ball","Hurricane","Electro Shot",
    "Dragon Pulse","Psychic","Matcha Gotcha","Sludge Bomb","Earth Power","Dazzling Gleam","Flash Cannon",
    "Make It Rain","Thunderbolt","Eruption","Solar Beam","Blizzard","Hyper Beam","Giga Drain","Draining Kiss",
    "Air Slash","Muddy Water","Overheat","Fiery Dance","Snarl","Scald","Aura Sphere","Water Spout","Thunder",
    "Ice Beam","Sludge Wave","Energy Ball","Dark Pulse","Bug Buzz","Leaf Storm","Frost Breath","Psyshock",
    "Volt Switch","Parabolic Charge","Pollen Puff","Moonlight","Freeze-Dry","Meteor Beam","Terrain Pulse",
    "Hydro Pump","Draco Meteor","Fire Blast","Thunderbolt","Focus Blast","Sludge Bomb","Aura Sphere",
    "Hex","Tera Blast","Boomburst","Apple Acid","Fickle Beam","Luster Purge","Mystical Fire",
    "Matcha Gotcha"}   # Matcha Gotcha: special attacker AND healing (also in the healing set) — multi-role

# Multi-role membership for moves that do several jobs at once: {move: set(roles)}.
# These sets are FACTUAL (a move's actual in-game effects), not weighted — Matcha Gotcha genuinely
# attacks, heals, and can burn. The *strength* of each role (primary vs secondary) is deliberately
# NOT hand-set here: graded weights are LEARNED from co-occurrence by the NMF step (Label Distribution
# Learning / Label Enhancement — Geng 2016; Lee & Seung 1999). This table is authoritative for a
# listed move: its roles come only from here (e.g. Fake Out is tempo, NOT an attacker).
ROLE_OVERRIDE = {
 "Matcha Gotcha": {"spec_attacker", "healing", "status"},   # attack + heal + burn (3 real jobs)
 "Body Press":    {"wall", "phys_attacker"},                # a wall's attack (Iron Defense + Body Press)
 "Discharge":     {"spec_attacker", "status"},              # spread + paralysis (Lightning Rod core)
 "Knock Off":     {"phys_attacker", "itemdisrupt"},         # damage + strip item
 "Parting Shot":  {"pivot", "debuff"},                      # pivot + drop both attacks
 "Nuzzle":        {"status"},                               # the paralysis, not the chip
 "Pollen Puff":   {"healing", "spec_attacker"},             # heal ally OR damage foe
 "Flip Turn":     {"pivot", "phys_attacker"},
 "Volt Switch":   {"pivot", "spec_attacker"},
 "U-turn":        {"pivot", "phys_attacker"},
 "Draining Kiss": {"healing", "spec_attacker"},
 "Fake Out":      {"fakeout"},                              # the flinch/tempo, NOT the tiny attack
}

def signal_roles(moves, ability, item):
    """Roles a single revealed set demonstrates, as {role: 1.0}.
    Presence is binary and data-justified; graded primary/secondary STRENGTH is learned later
    by the NMF step, never hand-assigned here (measured, not asserted)."""
    out = {}
    mv = set(moves or [])
    for m in mv:
        if m in ROLE_OVERRIDE:
            for r in ROLE_OVERRIDE[m]: out[r] = 1.0
        else:
            for r, sig in ROLE_SIGNALS.items():
                if r in ("phys_attacker", "spec_attacker"): continue
                if m in sig.get("moves", set()): out[r] = 1.0
    if ability:
        for r, sig in ROLE_SIGNALS.items():
            if ability in sig.get("abilities", set()): out[r] = 1.0
    nover = {m for m in mv if m not in ROLE_OVERRIDE}
    if len(nover & PHYS) >= 2: out["phys_attacker"] = 1.0
    if len(nover & SPEC) >= 2: out["spec_attacker"] = 1.0
    return out

# ---------------------------------------------------------------------------
# Pass over the store
# ---------------------------------------------------------------------------
def load_games():
    with open(STORE, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line: continue
            try: yield json.loads(line)
            except Exception: continue

def wilson(k, n, z=1.96):
    if n == 0: return (0.0, 0.0, 1.0)
    p = k / n
    d = 1 + z*z/n
    c = p + z*z/(2*n)
    h = z*math.sqrt(p*(1-p)/n + z*z/(4*n*n))
    return (p, (c-h)/d, (c+h)/d)

MIN_SEEN = 2   # a species must show a role >= this many times to earn the capability (drops flukes)

def build():
    games = list(load_games())
    n_games = len(games)

    # ---- Pass 1: species capability table (roles each species has been SEEN doing) ----
    seen = defaultdict(Counter)        # species -> role -> count
    seenw = defaultdict(dict)          # species -> role -> max weight observed
    species_games = Counter()
    for g in games:
        appeared = set()
        for mon, s in (g.get("sets") or {}).items():
            for r, w in signal_roles(s.get("moves"), s.get("ability"), s.get("item")).items():
                seen[mon][r] += 1
                if w > seenw[mon].get(r, 0.0): seenw[mon][r] = w
            appeared.add(mon)
        for mon in appeared:
            species_games[mon] += 1
    dex = {}       # species -> {role: weight} earned (seen >= MIN_SEEN times)
    dexlist = {}   # species -> sorted role list (for display)
    for mon, ctr in seen.items():
        dex[mon] = {r: round(seenw[mon][r], 2) for r, c in ctr.items() if c >= MIN_SEEN}
        dexlist[mon] = sorted(dex[mon])

    def team_roles(six):
        """weighted team role vector: {role: max weight across the six}"""
        rs = {}
        for mon in six:
            for r, w in dex.get(mon, {}).items():
                if w > rs.get(r, 0.0): rs[r] = w
        return rs

    # ---- Pass 2+3: role-pair matchup matrix (pooled) ----
    # cell[a][b] = games where winner-side had a and loser-side had b, from the a-side's view.
    win = defaultdict(lambda: defaultdict(int))   # a beats b: wins
    tot = defaultdict(lambda: defaultdict(int))   # a vs b: total
    role_present = Counter()
    for g in games:
        six = g.get("six") or {}
        w = g.get("winner")
        p1n, p2n = g["p1"]["name"], g["p2"]["name"]
        if w == p1n: wr, lr = team_roles(six.get("p1", [])), team_roles(six.get("p2", []))
        elif w == p2n: wr, lr = team_roles(six.get("p2", [])), team_roles(six.get("p1", []))
        else: continue
        for r in wr | lr: role_present[r] += 1
        for a in wr:
            for b in lr:
                tot[a][b] += 1; win[a][b] += 1     # a-side won this game
        for b in lr:
            for a in wr:
                tot[b][a] += 1                      # symmetric denominator (b-side lost)
    matrix = {}
    for a in ROLES:
        row = {}
        for b in ROLES:
            n = tot[a][b]
            if n == 0: continue
            p, lo, hi = wilson(win[a][b], n)
            row[b] = dict(p=round(p,4), lo=round(lo,4), hi=round(hi,4), n=n)
        if row: matrix[a] = row

    # ---- Pass 4a: logistic predictor — per-role coefficients = win-credit ----
    # feature per game (p1 perspective): x_r = [p1 has role r] - [p2 has role r]  in {-1,0,1}
    # label y = 1 if p1 won. Held-out by game-id hash. Coin baseline = ln2. Rating baseline too.
    rows = []
    for g in games:
        six = g.get("six") or {}
        w = g.get("winner")
        p1n, p2n = g["p1"]["name"], g["p2"]["name"]
        if w == p1n: y = 1
        elif w == p2n: y = 0
        else: continue
        r1, r2 = team_roles(six.get("p1", [])), team_roles(six.get("p2", []))
        x = [ (1 if r in r1 else 0) - (1 if r in r2 else 0) for r in ROLES ]
        dr = (g["p1"].get("rating") or 1000) - (g["p2"].get("rating") or 1000)
        rows.append((g["id"], x, dr, y))

    def split(idkey):
        h = 0
        for ch in idkey: h = (h*131 + ord(ch)) & 0xffffffff
        return "test" if h % 5 == 0 else "train"   # 80/20
    train = [r for r in rows if split(r[0]) == "train"]
    test  = [r for r in rows if split(r[0]) == "test"]

    def fit_logistic(data, dim, get_x, l2=1.0, iters=400, lr=0.1):
        w = [0.0]*dim; b = 0.0
        N = len(data)
        for _ in range(iters):
            gw = [0.0]*dim; gb = 0.0
            for row in data:
                x = get_x(row); y = row[3]
                z = b + sum(w[i]*x[i] for i in range(dim))
                p = 1/(1+math.exp(-z))
                e = p - y
                for i in range(dim): gw[i] += e*x[i]
                gb += e
            for i in range(dim): w[i] = w[i] - lr*(gw[i]/N + l2*w[i]/N)
            b -= lr*gb/N
        return w, b

    def logloss(data, predict):
        s = 0.0
        for row in data:
            p = min(1-1e-12, max(1e-12, predict(row)))
            y = row[3]
            s += -(y*math.log(p) + (1-y)*math.log(1-p))
        return s/len(data)

    # role model
    wr, br = fit_logistic(train, len(ROLES), lambda r: r[1], l2=1.0)
    pred_role = lambda r: 1/(1+math.exp(-(br + sum(wr[i]*r[1][i] for i in range(len(ROLES))))))
    ll_role = logloss(test, pred_role)
    # rating-only baseline (scaled)
    scale = 400.0
    wrt, brt = fit_logistic(train, 1, lambda r: [r[2]/scale], l2=0.5)
    pred_rate = lambda r: 1/(1+math.exp(-(brt + wrt[0]*(r[2]/scale))))
    ll_rate = logloss(test, pred_rate)
    ll_coin = LN2
    acc_role = sum(1 for r in test if (pred_role(r) >= .5) == (r[3]==1))/len(test)

    # bootstrap CI on role held-out log-loss (resample test games)
    rng = random.Random(7)
    boots = []
    tl = list(test)
    for _ in range(600):
        sample = [tl[rng.randrange(len(tl))] for _ in range(len(tl))]
        boots.append(logloss(sample, pred_role))
    boots.sort()
    ci = (round(boots[int(.025*len(boots))],4), round(boots[int(.975*len(boots))],4))

    coeffs = sorted(
        [dict(role=r, label=ROLE_SIGNALS[r]["label"], coef=round(wr[i],4),
              teams_with=role_present[r]) for i, r in enumerate(ROLES)],
        key=lambda d: -d["coef"])

    # ---- Pass 4b: KO-credit per species (who scored the knockouts, in won games) ----
    ko_credit = Counter(); ko_all = Counter(); appear = Counter()
    for g in games:
        w = g.get("winner"); p1n, p2n = g["p1"]["name"], g["p2"]["name"]
        win_side = "p1" if w == p1n else ("p2" if w == p2n else None)
        for mon in (g.get("brought", {}).get("p1", []) + g.get("brought", {}).get("p2", [])):
            appear[mon] += 1
        for t in (g.get("turns") or []):
            for e in t.get("ev", []):
                if e.get("t") == "m" and e.get("ko"):
                    side = e.get("s","")[:2]   # 'p1a' -> 'p1'
                    mon = e.get("mon")
                    if not mon: continue
                    ko_all[mon] += 1
                    if win_side and side == win_side:
                        ko_credit[mon] += 1
    # KOs-per-game-brought, for species brought >= 40 times
    credit = []
    for mon, ap in appear.items():
        if ap < 40: continue
        credit.append(dict(species=mon, brought=ap, kos=ko_all[mon],
                           kos_in_wins=ko_credit[mon],
                           ko_per_game=round(ko_all[mon]/ap, 3)))
    credit.sort(key=lambda d: -d["ko_per_game"])

    # ---- validation: pooling — role-pair cells vs the old single-label cells ----
    cell_ns = sorted(c["n"] for row in matrix.values() for c in row.values())
    median_cell = cell_ns[len(cell_ns)//2] if cell_ns else 0
    pooling = dict(
        role_pair_cells=len(cell_ns),
        median_cell_n=median_cell,
        min_cell_n=min(cell_ns) if cell_ns else 0,
        max_cell_n=max(cell_ns) if cell_ns else 0,
        note=("Old single-label playstyle cells were n=11-18; role-pair cells pool every game "
              "into many cells, so the median cell here is far larger and can reach significance."))

    # ---------------------------------------------------------------- write
    dex_out = dict(
        generated=__import__("datetime").date.today().isoformat(),
        n_games=n_games, min_seen=MIN_SEEN,
        roles={r: ROLE_SIGNALS[r]["label"] for r in ROLES},
        species={mon: {"roles": dex[mon], "games": species_games[mon]}
                 for mon in sorted(dex, key=lambda m: -species_games[m]) if dex[mon]},
    )
    json.dump(dex_out, open(D("data","pokemon-roles.json"),"w"), indent=1)

    mm_out = dict(generated=dex_out["generated"], n_games=n_games,
                  roles={r: ROLE_SIGNALS[r]["label"] for r in ROLES},
                  role_present=dict(role_present), matrix=matrix)
    json.dump(mm_out, open(D("data","role-matchups.json"),"w"), indent=1)

    eval_out = dict(
        generated=dex_out["generated"], n_games=n_games,
        n_train=len(train), n_test=len(test),
        log_loss=dict(roles=round(ll_role,4), rating_baseline=round(ll_rate,4), coin=round(ll_coin,4)),
        role_logloss_ci=ci, accuracy_roles=round(acc_role,4),
        headline=("Roles predict the winner at held-out log-loss %.4f vs a coin %.4f and rating %.4f."
                  % (ll_role, ll_coin, ll_rate)),
        role_win_credit=coeffs,           # per-role coefficient = its contribution to winning
        ko_credit_top=credit[:40],        # per-species KO attribution
        pooling=pooling,
    )
    json.dump(eval_out, open(D("data","roles-eval.json"),"w"), indent=1)

    # ---------------------------------------------------------------- console
    print(f"roles.py — {n_games} games, {len(dex)} species tagged, {len(ROLES)} roles")
    print(f"  role-pair matrix: {pooling['role_pair_cells']} cells, "
          f"median n={median_cell} (min {pooling['min_cell_n']}, max {pooling['max_cell_n']})")
    print(f"  held-out log-loss  roles={ll_role:.4f}  rating={ll_rate:.4f}  coin={ll_coin:.4f}  "
          f"CI{ci}  acc={acc_role:.3f}")
    print("  top win-credit roles:", ", ".join(f"{c['role']}{c['coef']:+.2f}" for c in coeffs[:5]))
    print("  bottom win-credit roles:", ", ".join(f"{c['role']}{c['coef']:+.2f}" for c in coeffs[-5:]))
    print("  top KO species:", ", ".join(f"{c['species']} {c['ko_per_game']}" for c in credit[:6]))
    return eval_out

if __name__ == "__main__":
    build()
