#!/usr/bin/env python3
"""SLOWKING · value.py — the learned LEAF EVALUATOR.

Loads the value function trained by engine/train_value.py (data/value-net.json) and
exposes V(state) -> P(win from here). This is what the depth-limited search calls at
its leaves so it doesn't have to roll every line to the end of the game — the DeepStack/
ReBeL move. It is also the concrete hand-off point of the flywheel:

    train_value.py  --(learns from games)-->  data/value-net.json  --(loaded here)-->  search leaf

Retrain on self-play output and the search immediately gets stronger, with no code change.
Features must match train_value.py exactly: [aliveDiff, hpDiff, p1_alive, p2_alive, turn/10, bias].
"""
import os, json, math

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT = os.path.join(HERE, '../../data/value-net.json')


class ValueNet:
    def __init__(self, path=DEFAULT):
        self.ok = os.path.exists(path)
        if self.ok:
            d = json.load(open(path))
            self.w = d['w']; self.mu = d['mu']; self.sd = d['sd']

    def __call__(self, my_alive, opp_alive, my_hp, opp_hp, turn):
        """my_hp / opp_hp in 'mon units' (sum of HP fractions, 0..4). Returns P(win)."""
        if not self.ok:
            # graceful fallback: a sensible monotone prior if the net isn't trained yet
            return 1 / (1 + math.exp(-(0.6 * (my_alive - opp_alive) + 0.3 * (my_hp - opp_hp))))
        raw = [my_alive - opp_alive, my_hp - opp_hp, my_alive, opp_alive, turn / 10.0]
        z = self.w[-1]  # bias
        for i in range(5):
            z += self.w[i] * ((raw[i] - self.mu[i]) / self.sd[i])
        return 1 / (1 + math.exp(-z))


if __name__ == '__main__':
    v = ValueNet()
    print('value net loaded:', v.ok)
    print('even 2v2 mid-game     P(win) =', round(v(2, 2, 2.0, 2.0, 4), 3))
    print('up a mon (3v2) late   P(win) =', round(v(3, 2, 2.6, 1.4, 7), 3))
    print('down two (1v3) late   P(win) =', round(v(1, 3, 0.8, 2.6, 7), 3))
    print('crushing (4v1)        P(win) =', round(v(4, 1, 3.6, 0.6, 8), 3))
