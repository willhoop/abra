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
import numpy as np
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
 # Weather is split by WHICH weather, on both sides. A generic "weather" tag cannot answer the
 # question that actually matters when building a team: does this Swift Swim mon have a RAIN setter,
 # or is its ability dead? Setter and abuser must name the same weather to pair up.
 "weather_rain": dict(label="Rain setter",
    moves={"Rain Dance"}, abilities={"Drizzle","Primordial Sea"}),
 "weather_sun": dict(label="Sun setter",
    moves={"Sunny Day"}, abilities={"Drought","Orichalcum Pulse","Desolate Land"}),
 "weather_sand": dict(label="Sand setter",
    moves={"Sandstorm"}, abilities={"Sand Stream","Sand Spit"}),
 "weather_snow": dict(label="Snow setter",
    moves={"Snowscape","Hail","Chilly Reception"}, abilities={"Snow Warning"}),
 # Terrain gets the same setter/abuser split as weather, for the same reason: Expanding Force is
 # dead without PSYCHIC terrain specifically, and Grassy Glide without GRASSY.
 # Measured in this format: there are NO terrain-setting abilities in the store at all - no Psychic
 # Surge, no Grassy Surge. Terrain is set by MOVE (Meowstic 150, Farigiraf 42), with one exception:
 # Raichu-Mega-X carries Electric Surge (confirmed in Showdown's dex and in replay logs).
 "terrain_psychic": dict(label="Psychic Terrain setter",
    moves={"Psychic Terrain"}, abilities={"Psychic Surge"}),
 "terrain_grassy": dict(label="Grassy Terrain setter",
    moves={"Grassy Terrain"}, abilities={"Grassy Surge"}),
 "terrain_electric": dict(label="Electric Terrain setter",
    moves={"Electric Terrain"}, abilities={"Electric Surge","Hadron Engine"}),
 "terrain_misty": dict(label="Misty Terrain setter",
    moves={"Misty Terrain"}, abilities={"Misty Surge"}),
 "abuser_psychic": dict(label="Psychic Terrain abuser", moves={"Expanding Force"}, abilities=set()),
 "abuser_grassy": dict(label="Grassy Terrain abuser", moves={"Grassy Glide"}, abilities={"Grass Pelt"}),
 "abuser_electric": dict(label="Electric Terrain abuser", moves={"Rising Voltage"}, abilities={"Quark Drive","Surge Surfer"}),
 "abuser_misty": dict(label="Misty Terrain abuser", moves={"Misty Explosion"}, abilities=set()),
 "fakeout": dict(label="Fake Out (tempo)",
    moves={"Fake Out"}),
 "redirection": dict(label="Redirection",
    moves={"Follow Me","Rage Powder"},
    # abilities redirect too: Lightning Rod / Storm Drain pull the whole type at the ally
    abilities={"Lightning Rod","Storm Drain"}),
 "denial": dict(label="Weather / effect denial",
    # the counter-role: these shut off what the other team built. Cloud Nine and Air Lock suspend
    # weather entirely while the mon is out; Neutralizing Gas turns abilities off; Magic Bounce and
    # Good as Gold refuse status; Mirror Armor reflects stat drops back at an Intimidate lead.
    # screen/hazard breakers sit here too — Brick Break and Psychic Fangs shatter Light Screen and
    # Reflect (and they are physical attacks, so they carry that tag as well via the override table).
    moves={"Defog","Haze","Clear Smog","Rapid Spin","Court Change","Mortal Spin","Tidy Up"},
    abilities={"Cloud Nine","Air Lock","Neutralizing Gas","Magic Bounce","Good as Gold",
               "Mirror Armor","Clear Body","White Smoke","Full Metal Body"}),
 # The mons the weather is set FOR - each keyed to the ONE weather that switches it on, so a team
 # can be checked for the dead-ability defect (abuser present, matching setter absent).
 "abuser_rain": dict(label="Rain abuser (needs rain)", moves=set(),
    abilities={"Swift Swim","Rain Dish","Dry Skin","Hydration"}),
 "abuser_sun": dict(label="Sun abuser (needs sun)", moves=set(),
    abilities={"Chlorophyll","Solar Power","Leaf Guard","Flower Gift","Harvest","Protosynthesis"}),
 "abuser_sand": dict(label="Sand abuser (needs sand)", moves=set(),
    abilities={"Sand Rush","Sand Force","Sand Veil"}),
 "abuser_snow": dict(label="Snow abuser (needs snow)", moves=set(),
    abilities={"Slush Rush","Ice Body","Snow Cloak"}),
 "taunt": dict(label="Taunt",
    moves={"Taunt"}),
 "encore": dict(label="Move-lock (Encore / Disable)",
    # same disruption family as Taunt: it takes an option away rather than dealing damage.
    moves={"Encore","Disable","Torment","Imprison"}),
 "priority": dict(label="Priority attacker",
    moves={"Aqua Jet","Sucker Punch","Quick Attack","Extreme Speed","Bullet Punch","Ice Shard",
           "Shadow Sneak","Grassy Glide","Jet Punch","Mach Punch","Vacuum Wave","Water Shuriken",
           "Accelerock","First Impression","Ice Shard","Baby-Doll Eyes"}),
 "prankster": dict(label="Prankster (priority support)",
    abilities={"Prankster","Gale Wings"}),
 # Status is split by TYPE, because the four do different jobs and each is well-sampled
 # (1,000-1,300 uses, 20-59 species carrying one). Burn and paralysis also carry their functional
 # cross-tag: a burn halves Attack (a debuff, competing with Intimidate) and paralysis halves Speed
 # (speed control, competing with Tailwind). Lumping them as one "status" role hid that.
 "status_burn": dict(label="Burn spreader",
    moves={"Will-O-Wisp","Scald","Sacred Fire","Lava Plume","Scorching Sands","Inferno","Blue Flare"}),
 "status_para": dict(label="Paralysis spreader",
    moves={"Thunder Wave","Nuzzle","Glare","Stun Spore","Zap Cannon","Thunder","Body Slam",
           "Discharge","Nuzzle","Dragon Breath"}),
 # Freeze is functionally the same job as sleep (the target cannot act), and the store shows it is
 # rare: 108 freeze events vs 817 sleep. But no move in Reg M-B *sets* freeze — it is a ~10% rider on
 # Ice attacks, so tagging every Ice move as action-denial would over-credit them. Recorded, not faked.
 "status_sleep": dict(label="Sleep spreader (action denial)",
    moves={"Sleep Powder","Spore","Hypnosis","Yawn","Sing","Lovely Kiss","Dark Void","Grass Whistle"}),
 "status_poison": dict(label="Poison spreader",
    moves={"Toxic","Poison Powder","Poison Gas","Baneful Bunker","Toxic Thread","Toxic Spikes",
           "Gunk Shot","Sludge Bomb","Poison Jab","Cross Poison","Dire Claw"}),
 "status": dict(label="Status spreader (other)",
    moves={"Confuse Ray","Swagger","Flatter","Attract","Teeter Dance"}),
 "debuff": dict(label="Debuff (Intimidate / drops)",
    moves={"Parting Shot","Charm","Snarl","Struggle Bug","Fake Tears","Screech","Tickle","Baby-Doll Eyes",
           "Feather Dance","Growl","Play Nice","Captivate","Noble Roar","Tearful Look","Spirit Break","Lunge",
           "King's Shield","Silk Trap"},
    abilities={"Intimidate"}),
 "setup": dict(label="Setup / sweeper",
    moves={"Swords Dance","Dragon Dance","Nasty Plot","Calm Mind","Bulk Up","Tail Glow","Quiver Dance",
           "Shell Smash","Growth","Coil","Clangorous Soul","Victory Dance","Iron Defense","Curse",
           "Belly Drum","Work Up","Agility","Rock Polish","Take Heart","Geomancy","No Retreat"},
    # trigger-boosters: they convert an opponent's debuff or a KO into a stat boost
    abilities={"Speed Boost","Defiant","Competitive","Moxie","Justified","Berserk","Simple","Moody",
               "Supersweet Syrup","Weak Armor","Chilling Neigh","Grim Neigh","Beast Boost"}),
 "healing": dict(label="Healing / sustain",
    moves={"Recover","Roost","Wish","Life Dew","Pollen Puff","Matcha Gotcha","Synthesis","Moonlight",
           "Morning Sun","Slack Off","Milk Drink","Jungle Healing","Lunar Blessing","Soft-Boiled","Rest",
           "Strength Sap","Giga Drain","Drain Punch","Horn Leech","Draining Kiss","Leech Life","Parabolic Charge",
           "Floral Healing","Heal Pulse","Purify","Shore Up"},
    # Hospitality heals the partner on switch-in; Regenerator heals this mon every time it pivots out.
    abilities={"Hospitality","Regenerator","Poison Heal","Water Absorb","Volt Absorb","Earth Eater",
               "Dry Skin","Rain Dish","Ice Body","Sap Sipper"}),
 "screens": dict(label="Screen setter",
    moves={"Light Screen","Reflect","Aurora Veil"}),
 "teamprotect": dict(label="Wide / Quick Guard",
    moves={"Wide Guard","Quick Guard"}),
 "helpinghand": dict(label="Helping Hand",
    # Deliberately the ACTIVE, one-turn, targeted boost only. Fairy Aura / Dark Aura are not the
    # same job: they are passive, permanent and type-wide (and Aura even boosts the opponent's moves
    # of that type). They are left untagged as passive damage modifiers, in the same class as
    # Adaptability and Mold Breaker — a stat multiplier is not a role.
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
 "spread": dict(label="Spread attacker (both foes)",
    # hits both opponents at 75% power — the defining doubles job, and the reason Wide Guard and
    # redirection exist. Kept separate from phys/spec attacker: a mon can be a strong single-target
    # attacker and never threaten the spread.
    moves={"Heat Wave","Rock Slide","Blizzard","Hyper Voice","Eruption","Dazzling Gleam","Muddy Water",
           "Make It Rain","Icy Wind","Electroweb","Snarl","Struggle Bug","Expanding Force","Water Spout",
           "Glacial Lance","Astral Barrage","Origin Pulse","Precipice Blades","Razor Leaf","Air Cutter",
           "Swift","Breaking Swipe","Diamond Storm","Overdrive","Relic Song","Sandsear Storm",
           "Wildbolt Storm","Bleakwind Storm","Springtide Storm","Burning Jealousy","Icy Wind"}),
 "spread_self": dict(label="Field-wide (hits own partner)",
    # hits EVERY adjacent Pokemon, including your own partner. That is a team-construction
    # constraint, not just a damage profile: Earthquake wants a Flying/Levitate partner, Surf wants
    # Water Absorb/Storm Drain, Discharge wants Volt Absorb/Lightning Rod. Distinct signal.
    moves={"Earthquake","Surf","Discharge","Lava Plume","Petal Blizzard","Sludge Wave","Bulldoze",
           "Boomburst","Parabolic Charge","Magnitude","Explosion","Self-Destruct","Searing Shot",
           "Synchronoise"}),
 "substitute": dict(label="Substitute user",
    # a Substitute blocks status and redirection outright and forces the opponent to break it first.
    # Shed Tail hands one to the incoming Pokemon, which is why it is also a positioning move.
    moves={"Substitute","Shed Tail"}),
 "chip": dict(label="Residual / chip damage",
    # damage that arrives every turn without attacking again — partial-trap chip, Leech Seed drain,
    # Salt Cure, Curse. Wins long games and closes the gap for a revenge KO.
    moves={"Leech Seed","Salt Cure","Curse","Infestation","Whirlpool","Fire Spin","Sand Tomb"}),
 "multihit": dict(label="Multi-hit (breaks Sash / Sturdy)",
    # strikes 2-5 times, so it goes through Focus Sash, Sturdy, Substitute, Disguise and Multiscale
    # in a single turn. A deliberate answer to those techs, not just extra damage.
    moves={"Rock Blast","Bullet Seed","Icicle Spear","Pin Missile","Tail Slap","Bone Rush",
           "Triple Axel","Population Bomb","Surging Strikes","Water Shuriken","Arm Thrust",
           "Double Hit","Dual Wingbeat","Twin Beam","Scale Shot","Fury Attack","Comet Punch",
           "Barrage","Double Iron Bash","Dragon Darts","Bonemerang","Twineedle"}),
 "fixed_damage": dict(label="Fixed / fractional damage",
    # ignores Attack, defence and the type chart: Super Fang and Ruination always take half, Seismic
    # Toss and Night Shade deal level damage, Endeavor levels the HP. A different mechanism from
    # attacking, and the reason a wall is not safe from them.
    moves={"Super Fang","Nature's Madness","Ruination","Endeavor","Seismic Toss","Night Shade",
           "Final Gambit","Dragon Rage","Sonic Boom","Guardian of Alola"}),
 "hazards": dict(label="Hazard setter",
    # rare in VGC (short games, few switches) but a real job where it appears. Toxic Debris sets
    # Toxic Spikes passively when the mon is hit by a physical move. Removal lives under "denial".
    moves={"Stealth Rock","Spikes","Toxic Spikes","Sticky Web","Ceaseless Edge","Stone Axe"},
    abilities={"Toxic Debris"}),
 "perish": dict(label="Perish Trap",
    moves={"Perish Song"}),
 "allysupport": dict(label="Positioning / ally support",
    # moving Pokemon around rather than damaging them — repositioning your own side (Ally Switch,
    # After You, Instruct, Quash) and forcing the opponent's out (Roar, Whirlwind, Dragon Tail,
    # Circle Throw), which undoes their setup and their lead.
    moves={"Instruct","Ally Switch","After You","Coaching","Decorate","Helping Hand","Quash",
           "Aromatic Mist","Gear Up","Magnetic Flux","Heal Pulse",
           "Roar","Whirlwind","Dragon Tail","Circle Throw"}),
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
    "Icicle Crash","Stone Edge","Body Slam","Waterfall","Play Rough","Fishious Rend","Bolt Strike",
    # plain physical attacks with no other job — tagged so they are not left uncategorised
    "Rock Blast","Low Kick","Rage Fist","Superpower","Last Resort","Phantom Force","Sacred Sword",
    "Poltergeist","Psycho Cut","Double-Edge","Volt Tackle","Heavy Slam","Leaf Blade","Acrobatics",
    "Flower Trick","Trop Kick","Meteor Mash","Feint","Aqua Tail","Iron Tail","Wild Charge","Bounce",
    "Aerial Ace","Night Slash","Cross Chop","Hammer Arm","Thunder Punch","Fire Punch","Bite","Slash",
    "Smart Strike","Steel Wing","Payback","Revenge","Avalanche","Head Smash","Take Down","Giga Impact",
    "Outrage","Dragon Rush","Seed Bomb","Power Whip","X-Scissor","Megahorn","Shadow Claw","Zing Zap",
    "Storm Throw","Retaliate","Triple Axel","Pin Missile","Icicle Spear","Bullet Seed","Scale Shot"}
SPEC = {"Heat Wave","Hyper Voice","Moonblast","Weather Ball","Shadow Ball","Hurricane","Electro Shot",
    "Dragon Pulse","Psychic","Matcha Gotcha","Sludge Bomb","Earth Power","Dazzling Gleam","Flash Cannon",
    "Make It Rain","Thunderbolt","Eruption","Solar Beam","Blizzard","Hyper Beam","Giga Drain","Draining Kiss",
    "Air Slash","Muddy Water","Overheat","Fiery Dance","Snarl","Scald","Aura Sphere","Water Spout","Thunder",
    "Ice Beam","Sludge Wave","Energy Ball","Dark Pulse","Bug Buzz","Leaf Storm","Frost Breath","Psyshock",
    "Volt Switch","Parabolic Charge","Pollen Puff","Moonlight","Freeze-Dry","Meteor Beam","Terrain Pulse",
    "Hydro Pump","Draco Meteor","Fire Blast","Thunderbolt","Focus Blast","Sludge Bomb","Aura Sphere",
    "Hex","Tera Blast","Boomburst","Apple Acid","Fickle Beam","Luster Purge","Mystical Fire",
    "Matcha Gotcha",
    # plain special attacks with no other job
    "Power Gem","Light of Ruin","Flamethrower","Twin Beam","Ancient Power","Rising Voltage",
    "Water Pulse","Round","Grass Knot","Clanging Scales","Stored Power","Venoshock","Psyshock",
    "Future Sight","Psychic Noise","Steel Beam","Aurora Beam","Echoed Voice","Twister","Core Enforcer",
    "Shadow Ball","Snipe Shot","Chloroblast","Blood Moon","Torch Song","Alluring Voice"}   # Matcha Gotcha: special attacker AND healing (also in the healing set) — multi-role

# Multi-role membership for moves that do several jobs at once: {move: set(roles)}.
# These sets are FACTUAL (a move's actual in-game effects), not weighted — Matcha Gotcha genuinely
# attacks, heals, and can burn. The *strength* of each role (primary vs secondary) is deliberately
# NOT hand-set here: graded weights are LEARNED from co-occurrence by the NMF step (Label Distribution
# Learning / Label Enhancement — Geng 2016; Lee & Seung 1999). This table is authoritative for a
# listed move: its roles come only from here (e.g. Fake Out is tempo, NOT an attacker).
ROLE_OVERRIDE = {
 "Matcha Gotcha": {"spec_attacker", "healing", "status_burn"},  # attack + heal + burn (3 real jobs)
 "Body Press":    {"wall", "phys_attacker"},                # a wall's attack (Iron Defense + Body Press)
 "Discharge":     {"spec_attacker", "status_para"},         # spread + paralysis (Lightning Rod core)
 "Knock Off":     {"phys_attacker", "itemdisrupt"},         # damage + strip item
 "Parting Shot":  {"pivot", "debuff"},                      # pivot + drop both attacks
 "Nuzzle":        {"status_para"},                          # the paralysis, not the chip
 "Pollen Puff":   {"healing", "spec_attacker"},             # heal ally OR damage foe
 "Flip Turn":     {"pivot", "phys_attacker"},
 "Volt Switch":   {"pivot", "spec_attacker"},
 "U-turn":        {"pivot", "phys_attacker"},
 "Draining Kiss": {"healing", "spec_attacker"},
 "Leech Seed":    {"healing", "chip"},                      # drains the foe INTO your own HP
 "Stockpile":     {"setup"},                                # raises both defences (and fuels Swallow)
 # attacks that boost the user on hit — they are setup and offense in one move, so no turn is lost
 "Torch Song":    {"spec_attacker", "setup"},
 "Shed Tail":     {"substitute", "allysupport", "pivot"},   # sub + hands it over + switches out
 "Scale Shot":    {"phys_attacker", "multihit", "setup"},
 "Meteor Mash":   {"phys_attacker", "setup"},
 "Charge Beam":   {"spec_attacker", "setup"},
 "Fiery Dance":   {"spec_attacker", "setup"},
 "Fake Out":      {"fakeout"},                              # the flinch/tempo, NOT the tiny attack
 # partial-trapping moves do two jobs: they pin the target AND chip it every turn (the Perish/stall
 # pattern), so they carry the residual-damage tag as well as trapping.
 "Psychic Fangs": {"phys_attacker", "denial"},              # physical AND it breaks both screens
 "Brick Break":   {"phys_attacker", "denial"},              # same job, Fighting side
 "Infestation":   {"trapping", "chip"},
 "Whirlpool":     {"trapping", "chip"},
 "Fire Spin":     {"trapping", "chip"},
 "Sand Tomb":     {"trapping", "chip"},
 "Bind":          {"trapping", "chip"},
 "Wrap":          {"trapping", "chip"},
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

# A species does NOT simply "have" a role. The same species is support on one set and offensive on
# another (Landorus: Choice-Scarf attacker vs Intimidate pivot), so we store a ROLE DISTRIBUTION:
# p(role | this species appears) = how often its revealed sets play that role. That distribution is
# also exactly the right object under closed sheets — before the set is revealed it is our *belief*
# about what this Pokemon might be doing (the same reasoning as XATU).
#
# A flat count threshold cannot separate a real minor set from noise: Basculegion showed "debuff" on
# 2 of 3,566 appearances (0.06%) — a count of 2, but obviously a fluke. So credibility is judged on
# the WILSON LOWER BOUND of the rate, which automatically demands more evidence from a common species
# and stays honest (wide interval -> not credible) for a rare one.
MIN_SEEN  = 2       # need at least this many observations before a rate is even computed
RATE_FLOOR = 0.05   # a role is CREDIBLE when its Wilson lower bound exceeds this (5% of sets)
PRESENT_AT = 0.50   # a TEAM counts as having a role when noisy-OR across its six reaches this

def build():
    games = list(load_games())
    n_games = len(games)

    # ---- Pass 1: species capability table (roles each species has been SEEN doing) ----
    seen = defaultdict(Counter)        # species -> role -> sets observed playing it
    species_sets = Counter()           # species -> revealed sets observed (the denominator)
    species_games = Counter()
    for g in games:
        appeared = set()
        for mon, s in (g.get("sets") or {}).items():
            species_sets[mon] += 1
            for r in signal_roles(s.get("moves"), s.get("ability"), s.get("item")):
                seen[mon][r] += 1
            appeared.add(mon)
        for mon in appeared:
            species_games[mon] += 1

    # species -> {role: p} role DISTRIBUTION, keeping only roles credible by Wilson lower bound
    dex, dexfull, dexlist = {}, {}, {}
    for mon, ctr in seen.items():
        n = species_sets[mon]
        keep, full = {}, {}
        for r, c in ctr.items():
            p, lo, hi = wilson(c, n)
            full[r] = dict(n=c, of=n, p=round(p, 4), lo=round(lo, 4), hi=round(hi, 4))
            if c >= MIN_SEEN and lo >= RATE_FLOOR:
                keep[r] = round(p, 4)          # the probability this species plays that role
        dex[mon] = keep; dexfull[mon] = full; dexlist[mon] = sorted(keep, key=lambda r: -keep[r])

    def team_roles(six):
        """Soft team role vector. For each role, the probability that AT LEAST ONE of the six plays
        it: 1 - prod(1 - p_i)  (noisy-OR). This keeps a species' set diversity intact instead of
        flattening it to yes/no — a mon that is support 30% of the time contributes 0.3, not 1."""
        rs = {}
        for mon in six:
            for r, p in dex.get(mon, {}).items():
                rs[r] = 1.0 - (1.0 - rs.get(r, 0.0)) * (1.0 - p)
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
        if w == p1n: wrp, lrp = team_roles(six.get("p1", [])), team_roles(six.get("p2", []))
        elif w == p2n: wrp, lrp = team_roles(six.get("p2", [])), team_roles(six.get("p1", []))
        else: continue
        # For the COUNTED matrix a team either has the role or not: "more likely than not that at
        # least one of the six plays it". The soft probabilities are kept for the model below.
        wr = {r for r, p in wrp.items() if p >= PRESENT_AT}
        lr = {r for r, p in lrp.items() if p >= PRESENT_AT}
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
        # soft features: difference of the two teams' role PROBABILITIES (keeps set diversity)
        x = [ r1.get(r, 0.0) - r2.get(r, 0.0) for r in ROLES ]
        dr = (g["p1"].get("rating") or 1000) - (g["p2"].get("rating") or 1000)
        rows.append((g["id"], x, dr, y))

    def split(idkey):
        h = 0
        for ch in idkey: h = (h*131 + ord(ch)) & 0xffffffff
        return "test" if h % 5 == 0 else "train"   # 80/20
    train = [r for r in rows if split(r[0]) == "train"]
    test  = [r for r in rows if split(r[0]) == "test"]

    def fit_logistic(data, dim, get_x, l2=1.0, iters=400, lr=0.1):
        """Ridge logistic by full-batch gradient descent, vectorised.

        The original was a triple Python loop (rows x features x iterations). At 28k team-sides and
        ~50 roles that is ~5x10^8 interpreted operations per fit and the script stopped finishing.
        numpy does the same arithmetic in compiled code; the update rule is unchanged, so results
        match the previous implementation."""
        X = np.asarray([get_x(r) for r in data], dtype=np.float64)
        y = np.asarray([r[3] for r in data], dtype=np.float64)
        N = len(data) or 1
        w = np.zeros(dim); b = 0.0
        for _ in range(iters):
            z = X @ w + b
            p = 1.0 / (1.0 + np.exp(-z))
            e = p - y
            w -= lr * ((X.T @ e) / N + l2 * w / N)
            b -= lr * (e.sum() / N)
        return w.tolist(), float(b)

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
        rate_floor=RATE_FLOOR, present_at=PRESENT_AT,
        note=("'roles' is a DISTRIBUTION: p(role | this species appears), because the same species "
              "is support on one set and offensive on another. A role is listed only when its Wilson "
              "lower bound clears rate_floor, so a 2-in-3566 fluke is excluded while a genuine minor "
              "set is kept. 'all_roles' keeps every observed rate with its interval, for audit."),
        species={mon: {"roles": dex[mon], "top": dexlist[mon][:6],
                       "sets_seen": species_sets[mon], "games": species_games[mon],
                       "all_roles": dexfull[mon]}
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
