#!/usr/bin/env python3
"""SLOWKING · belief.py — the belief state over the opponent's hidden information.

Champions VGC is an imperfect-information game. Before and during a battle you do
NOT know: (a) which 4 of the opponent's 6 they will bring, (b) their exact sets
(item / ability / spread / the 4th move), (c) sometimes their 6 at all (closed
sheet). A principled agent maintains a probability distribution over these
unknowns and updates it as evidence arrives — this module is that distribution.

This is the honest core of belief-based search (the ReBeL / Player-of-Games line):
search operates over a *distribution* of possible true states, not a single guess.
Everything here is a prior + a Bayesian filter; the priors come from ABRA's real
ladder data (usage, bring rates, and the behaviour-cloned set frequencies), so the
beliefs are grounded rather than uniform.

Public API:
  Belief(six, brought_prior, set_priors)  — construct from what you can see
  .bring_distribution()                   — P over which 4 they bring (C(6,4)=15)
  .observe_switch(species)                — a mon appeared -> it's in their bring
  .observe_move(species, move)            — Bayesian update of that mon's set
  .observe_item(species, item)            — a revealed item collapses that factor
  .sample()                               — draw a concrete hidden state (for ISMCTS)
"""
import itertools, math, random
from collections import defaultdict


def _norm(d):
    s = sum(d.values())
    return {k: v / s for k, v in d.items()} if s > 0 else d


class Belief:
    def __init__(self, six, bring_rate=None, set_priors=None, rng=None):
        """six: list of up to 6 opponent species (or None entries if closed sheet).
        bring_rate: {species: P(brought | on team)} from ladder data (defaults 0.6).
        set_priors: {species: {'item':{item:p}, 'ability':{ab:p}, 'moves':[(mv,p)...]}}
                    from data/move-priors.json + set frequencies."""
        self.six = [s for s in six if s]
        self.rng = rng or random.Random(0)
        self.bring_rate = bring_rate or {}
        self.set_priors = set_priors or {}
        # per-mon posterior over item / ability / each candidate move being on the set
        self.item_post = {s: _norm(dict((self.set_priors.get(s, {}).get('item') or {'unknown': 1.0}))) for s in self.six}
        self.abil_post = {s: _norm(dict((self.set_priors.get(s, {}).get('ability') or {'unknown': 1.0}))) for s in self.six}
        # move membership: P(move in the 4-slot set). Start from usage frequency, capped.
        self.move_post = {}
        for s in self.six:
            mv = self.set_priors.get(s, {}).get('moves') or []
            self.move_post[s] = {m: min(0.98, max(0.02, p)) for m, p in mv}
        self.seen_bring = set()   # species confirmed brought (observed on field)
        self.not_bring = set()    # species confirmed NOT brought (rare; e.g. revealed benched)

    # ---- bring distribution over the 15 subsets of size 4 ----
    def bring_distribution(self):
        if len(self.six) <= 4:
            return {tuple(sorted(self.six)): 1.0}
        rate = {s: self.bring_rate.get(s, 0.6) for s in self.six}
        combos = {}
        for combo in itertools.combinations(self.six, 4):
            cs = set(combo)
            if not self.seen_bring <= cs:      # must include everything already seen
                continue
            if cs & self.not_bring:            # must exclude confirmed-benched
                continue
            # independent-bring approximation: product of in/out rates, then renormalise
            p = 1.0
            for s in self.six:
                p *= rate[s] if s in cs else (1 - rate[s])
            combos[tuple(sorted(combo))] = p
        return _norm(combos)

    # ---- observations (Bayesian filter) ----
    def observe_switch(self, species):
        if species in self.six:
            self.seen_bring.add(species)

    def observe_item(self, species, item):
        if species in self.item_post:
            self.item_post[species] = {item: 1.0}

    def observe_ability(self, species, ability):
        if species in self.abil_post:
            self.abil_post[species] = {ability: 1.0}

    def observe_move(self, species, move):
        """A revealed move is definitely on the set -> P=1, and it mildly lowers the
        odds of the remaining candidate moves (only 4 slots)."""
        if species not in self.move_post:
            self.move_post[species] = {}
        mp = self.move_post[species]
        mp[move] = 1.0
        known = sum(1 for v in mp.values() if v >= 0.999)
        if known >= 4:
            for m in list(mp):
                if mp[m] < 0.999:
                    mp[m] = 0.0
        else:
            # renormalise the uncertain mass toward the (4 - known) remaining slots
            unc = [m for m in mp if mp[m] < 0.999]
            budget = max(0, 4 - known)
            tot = sum(mp[m] for m in unc)
            if tot > budget and tot > 0:
                for m in unc:
                    mp[m] *= budget / tot

    # ---- sampling a concrete hidden state for determinized search ----
    def sample(self):
        """Draw one plausible full hidden state: which 4 brought, and each mon's
        item / ability / 4 moves. This is the determinization ISMCTS roots on."""
        bd = self.bring_distribution()
        combos, probs = zip(*bd.items()) if bd else ([tuple(self.six[:4])], [1.0])
        bring = self.rng.choices(combos, weights=probs, k=1)[0]
        state = {}
        for s in bring:
            item = self._draw(self.item_post.get(s, {'unknown': 1.0}))
            abil = self._draw(self.abil_post.get(s, {'unknown': 1.0}))
            mp = self.move_post.get(s, {})
            forced = [m for m, p in mp.items() if p >= 0.999]
            rest = [(m, p) for m, p in mp.items() if p < 0.999]
            moves = list(forced)
            self.rng.shuffle(rest)
            for m, p in sorted(rest, key=lambda x: -x[1]):
                if len(moves) >= 4: break
                if self.rng.random() < p: moves.append(m)
            state[s] = {'item': item, 'ability': abil, 'moves': moves[:4]}
        return {'bring': bring, 'sets': state}

    def _draw(self, dist):
        d = _norm(dist)
        ks, ws = list(d.keys()), list(d.values())
        return self.rng.choices(ks, weights=ws, k=1)[0] if ks else 'unknown'


if __name__ == '__main__':
    six = ['garchomp', 'incineroar', 'whimsicott', 'sylveon', 'charizard', 'kingambit']
    priors = {
        'garchomp': {'item': {'lifeorb': .5, 'choicescarf': .3, 'clearamulet': .2},
                     'ability': {'roughskin': 1.0},
                     'moves': [('earthquake', .95), ('protect', .6), ('dragonclaw', .4),
                               ('stompingtantrum', .3), ('rockslide', .3), ('swordsdance', .2)]},
    }
    b = Belief(six, bring_rate={'garchomp': .7, 'incineroar': .65, 'whimsicott': .75,
                                'sylveon': .6, 'charizard': .8, 'kingambit': .25},
               set_priors=priors, rng=__import__('random').Random(1))
    bd = b.bring_distribution()
    top = sorted(bd.items(), key=lambda kv: -kv[1])[:3]
    print("bring distribution (top 3 of 15):")
    for combo, p in top: print(f"  {round(p,3)}  {combo}")
    b.observe_switch('charizard'); b.observe_move('garchomp', 'earthquake')
    print("after seeing Charizard lead + Garchomp Earthquake, a sampled hidden state:")
    print(" ", b.sample())
