# The data law: when self-play is allowed and when only human games will do

**2026-08-03.** Will asked for a rule rather than a habit. Half of it was already written —
`docs/POKER-TO-POKEMON.md` §141, quoted in `data/porygon3.json`'s own provenance:

> Held-out human games remain the *calibration* set, scored with proper scoring rules (log-loss,
> Brier, reliability) — **never the training signal**, to avoid laundering the selection bias back in.

That covers fitting. It does not cover the other half of what gets measured here, and the gaps are
where the withdrawn claims came from. This is the whole rule.

---

## The one sentence

**Self-play answers questions about the ENGINE and about RELATIVE strength. Human games answer
questions about REALITY and about ABSOLUTE accuracy. A question answered by the wrong corpus is
answered circularly, and circular answers look like findings.**

---

## The five cases

### 1. FITTING a model — self-play
Value functions, policy weights, pair vectors. Self-play is unlimited and free of the selection bias
in public replays, which are a self-selected slice: people save their wins and their flashy games.
`POKER-TO-POKEMON.md` §141 is the standing authority and nothing here changes it.

### 2. MEASURING ABSOLUTE ACCURACY — human games, held out, always
"Does this predict who wins" must be asked against outcomes we did not generate. PORYGON3's 63.70% is
a human-game number for exactly this reason, and any candidate leaf must be scored **on the same
corpus** or the comparison is between two different questions.

**The trap this closes:** a model evaluated on games produced by a bot that uses that model measures
agreement with itself. It will look excellent and mean nothing.

### 3. MEASURING WHAT PEOPLE DO — human games, by construction
Move priors, click distributions, truncation rates, bring rates. Self-play **cannot** answer these:
it contains what our bot does, which is the thing being compared against.

**The trap this closes:** `engine/truncation_curve.js` asks how often the human's pair falls outside
the top-K window. Run on self-play it would report how often MAG disagrees with MAG — a number that
would be near zero and would mean the window was fine when it is not.

### 4. RELATIVE STRENGTH, A vs B — self-play, necessarily
An H2H needs both arms to play, so it must be generated. That is fine, and the result is **strictly
relative**: "arm 1 beats arm 0 by X" is valid; "arm 1 is X% accurate" is not a thing an H2H can say.

**The trap this closes:** the withdrawn 47.9% Sucker Punch claim came from two self-play corpora that
differed in three levers at once. Same-corpus, one-lever, SPRT-gated, or it is not evidence.

### 5. ENGINE AND MECHANICS — either, because no player is involved
Fork cost, fork failure rate, `toJSON` round-tripping, move coverage, damage validation. These are
properties of the simulator, not of anybody's play. `engine/lookahead_cost.js` drives boards with
`default` and that is fine, because the question is what a fork costs and not what a good player does.

**The one caveat:** a mechanics measurement taken on a corpus is still a *sample of positions*, and
which positions were sampled can bias it. `lookahead-cost.json` records that 9 of 25 boards were
skipped for ending early, because the surviving boards are then biased toward longer games.

---

## The test to apply, in order

1. **Is the question about a PERSON?** (what they click, how often they are right, who wins.)
   → human games. Self-play cannot see people.
2. **Is the answer a number I will quote ABSOLUTELY?** ("63.7% accurate", "11.3% truncated.")
   → human games, held out, never trained on.
3. **Is it A-versus-B?** → self-play, one lever, SPRT-gated, and quote it only as a difference.
4. **Is it about the SIMULATOR?** → either, and state which positions were sampled.
5. **Am I about to evaluate a model on data its own policy generated?** → stop. That is the circle.

---

## Applied to the rollout leaf, since that is what prompted this

`docs/ROLLOUT-design.md` R1 asks: does a MEDICHAM rollout judge a position better than PORYGON3?

- Case 2 — an absolute accuracy claim compared against a published 63.70%.
- **Therefore: clean held-out HUMAN games, the same corpus PORYGON3 was scored on.** Self-play would
  be doubly circular: the outcomes come from our bot, and PORYGON3 was fitted on self-play, so a
  self-play evaluation would flatter the incumbent as well as the challenger.
- The material-sign baseline is **recomputed on the same sample** rather than quoted from
  `porygon3.json`, because a published number from a different set is a different question (case 2).

R4 — "does it win games" — is case 4, so self-play, one lever, SPRT.
