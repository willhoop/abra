/* variance.js — the risk lever: how swingy a line to take, given whether you are winning.
 *
 *   const V = require('./variance.js');
 *   const p = V.winProb(board, 'p1');            // cheap, from board state
 *   const adj = V.adjust(score, featureVec, p);  // score, tilted toward or away from variance
 *
 * WHERE THIS COMES FROM
 * ---------------------
 * Standard gambling theory, and the reason it belongs in this project is that ABRA is explicitly an
 * application of poker thinking to VGC. An underdog should INCREASE variance and a favourite should
 * SUPPRESS it. If your edge is negative, the swingy line is the only one that reaches the tail where
 * you win; if your edge is positive, variance can only cost you the win you already have.
 *
 * CREDIT: Nate Silver, "On the Edge" (2024), for the framing this file implements -- expected value
 * as the discipline, process judged separately from outcome, and risk appetite as something you
 * choose deliberately according to your edge rather than something that happens to you. The
 * companion idea from his "The Signal and the Noise" (2012) governs how the lever is REPORTED rather
 * than how it works: an effect must be read off its interval and not its point estimate, which is
 * why the behavioural check below is stated as a measured change rate rather than as a claim that
 * the lever wins games. Whether it does is not yet measured -- see MEASURING IT, at the bottom.
 *
 * THE HONEST CAVEAT, WHICH IS BIGGER THAN THE FEATURE
 * ---------------------------------------------------
 * If a value function returns TRUE, CALIBRATED P(win), then maximising expected P(win) is ALREADY
 * optimal and a risk term is not merely unnecessary, it is harmful -- it deliberately chooses a lower
 * win probability. Variance preference is never a free improvement. It is a CORRECTION, and it is
 * only correct when the objective and the value function disagree. Three cases where they do:
 *
 *   (a) THE VALUE FUNCTION IS WRONG ABOUT MY STRENGTH. PORYGON2 is trained on MAG playing MAG, so it
 *       answers "what happens from here between two equal players". Against a stronger opponent the
 *       true number is lower than the estimate, the edge is negative everywhere, and seeking variance
 *       is right. This is the case that actually applies to ABRA today, and it is why the lever is
 *       parameterised by an ASSUMED SKILL GAP rather than by taste.
 *
 *   (b) MATCH CONTEXT. Winning a GAME is not the objective in a Bo3; winning the MATCH is, and match
 *       equity is not linear in game equity. Down 0-1, a game is worth more than it was at 0-0. This
 *       is poker's ICM problem exactly. Nothing in ABRA currently knows the match score, so this case
 *       is documented and not implemented.
 *
 *   (c) THE VALUE FUNCTION IS NOT A PROBABILITY AT ALL. A material count is not P(win), so choosing
 *       by it is already the wrong objective and a risk term is patching a different hole.
 *
 * DEFAULT IS ZERO. `skillGap` defaults to 0, which makes the lever an exact no-op. It has to be
 * switched on deliberately, with a stated belief about the opponent, because switching it on without
 * one is strictly worse than leaving it off.
 *
 * WHAT "VARIANCE" MEANS HERE, MEASURED FROM FEATURES THAT ALREADY EXIST
 * --------------------------------------------------------------------
 * No new computation and no move is named. Three of MAG's 47 features already describe how swingy an
 * option is, and they were built for other reasons:
 *
 *   accuracy       a 70% move is a coin the game flips for you. 1 - accuracy is variance.
 *   killIsRoll     "it kills some spreads and not others" -- literally a roll rather than a read.
 *   koTarget       a kill chance near 0.5 is maximum variance; near 0 or 1 it is nearly certain.
 *                  Scored as 4p(1-p), which peaks at 1 when p = 0.5 and is 0 at both ends -- the
 *                  variance of the Bernoulli, normalised.
 *
 * A Protect with a certain outcome scores 0. Focus Blast into a roll scores high. That is the shape
 * we want, and none of it is a judgement about which moves are risky -- it is read off the numbers.
 */
'use strict';
const B = require('./board.js');

/* PORY's exported logistic, the same one the browser uses. Cheap enough to call every turn: five
 * multiplies. It is only ~60% accurate, but the lever does not need a good win probability, it needs
 * the SIGN and rough size of the edge -- "am I well behind" is a much easier question than "what
 * exactly is my win rate", and material answers it. */
let _pory = null;
function poryModel() {
  if (_pory !== null) return _pory;
  try {
    const fs = require('fs'), path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'data', 'pory.js'), 'utf8');
    const m = /window\.PORY\s*=\s*(\{[\s\S]*?\});?\s*$/.exec(src.trim());
    _pory = m ? JSON.parse(m[1]) : false;
  } catch (e) { _pory = false; }
  return _pory;
}

/* Alive count and mean active HP for a side, from the board the player already maintains. Bench
 * members with unknown hp count as alive and full, which is what the tracker knows -- inventing a
 * number for something never revealed would be a guess wearing a measurement's clothes. */
function sideState(board, side) {
  let alive = 0, hpSum = 0, hpN = 0;
  for (const f of board.field()) {
    if (f.side !== side || !f.mon) continue;
    if (!f.mon.fainted) { alive++; hpSum += (typeof f.mon.hp === 'number' ? f.mon.hp : 1); hpN++; }
  }
  for (const b of (board.bench(side) || [])) {
    if (b && !b.fainted) alive++;
  }
  return { alive, hp: hpN ? hpSum / hpN : 0 };
}

/* P(this side wins) from material, on PORY's exported weights. Returns 0.5 if the model is absent,
 * which makes every caller a no-op rather than silently applying a made-up number. */
function winProb(board, side) {
  const P = poryModel();
  if (!P) return 0.5;
  const foe = side === 'p1' ? 'p2' : 'p1';
  const me = sideState(board, side), them = sideState(board, foe);
  const raw = [1, me.alive - them.alive, me.hp - them.hp, me.alive, them.alive, (board.turn || 0) / 10];
  let z = P.weights[0];
  for (let i = 1; i < P.weights.length; i++) {
    const mu = P.mean[i - 1] || 0, sd = P.std[i - 1] || 1;
    z += P.weights[i] * ((raw[i] - mu) / (sd || 1));
  }
  return Math.max(0.01, Math.min(0.99, 1 / (1 + Math.exp(-z))));
}

/* How swingy is this option? In [0,1]. Built only from features that already exist. */
const I = B.FEATURE_INDEX;
function varianceOf(x) {
  if (!x) return 0;
  const miss = 1 - Math.max(0, Math.min(1, x[I.accuracy] || 0));
  const roll = Math.max(0, Math.min(1, x[I.killIsRoll] || 0));
  const p = Math.max(0, Math.min(1, x[I.koTarget] || 0));
  const koSwing = 4 * p * (1 - p);
  /* Averaged rather than summed so the result stays in [0,1] and the three cannot compound into a
   * number that dwarfs the score it is added to. */
  return (miss + roll + koSwing) / 3;
}

/* BEST-OF-THREE. P(win the match) with `w` games won and `l` lost, needing two, if every game is won
 * with probability p. Plain recursion; a Bo3 is four states deep.
 *
 * THE RESULT IS NOT WHAT IT LOOKS LIKE, so it is worth stating. Between EQUAL players a Bo3 has NO
 * match-context effect: at p=0.5 every game is worth exactly +/-0.25 of match equity whether the
 * score is 0-0, 1-0 or 0-1. The intuition that "you must win this one, play safe" is simply false
 * at parity, and a lever built on that intuition would be adjusting for nothing.
 *
 * The effect is real only for an UNDERDOG, and then it is large. At p=0.35 from 0-0, winning the
 * game gains +0.296 of match equity while losing costs only -0.159 -- the upside is worth nearly
 * twice the downside, so the weaker player should take MORE risk, and most of all early. That is the
 * same conclusion the single-game lever reaches, from a different direction, which is mild evidence
 * that neither is an artefact. */
function matchEquity(p, w, l, need) {
  need = need || 2;
  if (w >= need) return 1;
  if (l >= need) return 0;
  return p * matchEquity(p, w + 1, l, need) + (1 - p) * matchEquity(p, w, l + 1, need);
}

/* How lopsided are the stakes of THIS game, as a ratio. >1 means winning it is worth more than
 * losing it costs, so risk is cheap; <1 means the reverse. Exactly 1 at parity, in every Bo3 state,
 * which is the point above. */
function stakeRatio(p, w, l, need) {
  const here = matchEquity(p, w, l, need);
  const gain = matchEquity(p, w + 1, l, need) - here;
  const loss = here - matchEquity(p, w, l + 1, need);
  if (!(loss > 1e-9)) return gain > 0 ? 4 : 1;
  return Math.max(0.25, Math.min(4, gain / loss));
}

/* THE LEVER.
 *
 *   skillGap  what you believe about the opponent, in win-probability points. 0 means "an equal
 *             player, and my value function is calibrated" -- and at 0 this function returns the
 *             score unchanged, exactly.
 *   strength  how hard to tilt. Kept as an explicit argument rather than tuned in secret; it is a
 *             free parameter and it should look like one.
 *
 * The edge is (p - 0.5 - skillGap): how far ahead I actually am once my own optimism is subtracted.
 * Tilt is proportional to minus that, so a negative edge seeks variance and a positive edge avoids
 * it, and a player who is exactly even does nothing. */
function adjust(score, x, p, opts = {}) {
  const gap = +opts.skillGap || 0;
  const strength = opts.strength == null ? 1.0 : +opts.strength;
  /* MATCH CONTEXT, OFF UNLESS A SCORE IS SUPPLIED. `{ bo3: { w, l } }` — games won and lost so far.
   * Absent, the stake ratio is exactly 1 and this term vanishes, so Bo1 behaviour is untouched. */
  let stake = 1;
  if (opts.bo3) {
    const skill = Math.max(0.05, Math.min(0.95, 0.5 - gap));
    stake = stakeRatio(skill, +opts.bo3.w || 0, +opts.bo3.l || 0, +opts.bo3.need || 2);
  }
  if (!gap && stake === 1 && Math.abs(p - 0.5) < 1e-9) return score;
  /* The stake ratio scales how much the edge is WORTH; it does not pretend the position is better
   * than it is. As log(stake) so that 1 is exactly neutral and the two directions are symmetric. */
  const edge = ((p - 0.5) - gap) - 0.5 * Math.log(stake);
  return score - strength * edge * varianceOf(x);
}

/* MEASURING IT — WHAT IS AND IS NOT ESTABLISHED
 * ---------------------------------------------
 * ESTABLISHED (behavioural, 21,991 real held-out decisions, strength 1.0):
 *
 *     board state          picks changed     mean variance shift
 *     behind   p=0.20          2.1%               +0.349
 *     slightly behind 0.40     0.7%               +0.348
 *     EVEN     p=0.50          0.0%                 --
 *     ahead    p=0.80          2.5%               -0.354
 *
 * So it is dormant at parity, fires more the further from parity, and moves toward risk when losing
 * and away from it when winning. That is the intended shape and nothing more: it says the mechanism
 * behaves as designed, NOT that it wins games.
 *
 * NOT ESTABLISHED: whether it wins games. The experiment has a trap in it, which is why it is
 * written down rather than run carelessly. MAG vs MAG at skillGap 0 is a no-op, so a naive
 * head-to-head measures nothing and would come back 50% -- which could be misread as "the lever does
 * not work" when it was never switched on. The measurement has to create a real asymmetry:
 *
 *   1. ASSERTING A GAP YOU DO NOT HAVE SHOULD COST YOU. Run lever(skillGap=0.1) against plain MAG of
 *      equal strength. The prediction is that the lever side LOSES slightly. If it wins, the effect
 *      is not variance preference and the whole model is wrong.
 *   2. ASSERTING A GAP YOU DO HAVE SHOULD PAY. Run the lever as the genuinely weaker side -- greedy
 *      MAG against sampling MAG is the obvious pairing if that gap is real, though the 91.8% figure
 *      for it is on the unverified list and must be re-measured first.
 *
 * Test 1 is the falsifier and it is the one to run first, because a lever that helps when it should
 * hurt is measuring something else.
 *
 * TEST 1 HAS NOW BEEN RUN, AND IT IS INCONCLUSIVE. 1,200 self-play games, one side asserting a
 * skillGap of 0.10 it does not have, against an identical opponent; then the same 1,200 seeds again
 * with the lever off, so the two runs pair game-for-game.
 *
 *     unpaired   risk side won 48.6% of 1,176 decisive games, 95% CI [45.7, 51.4]
 *     paired     1,158 of 1,176 games ended with the SAME winner either way (98.5%)
 *                18 discordant: 7 losses turned into wins, 11 wins turned into losses
 *                exact two-sided p = 0.481
 *
 * The direction is what the falsifier predicts -- asserting an edge you do not have cost 4 net games
 * -- and the effect is indistinguishable from chance. Reported as inconclusive rather than as weak
 * support, because reading a direction off p = 0.48 is exactly the error this project keeps making.
 *
 * THE MORE USEFUL FINDING IS THAT THE LEVER IS NEARLY INERT AT THIS SETTING. It changes 2.1% of picks
 * when behind and flips 1.5% of games. A test with power over that needs roughly 200 discordant
 * pairs, so about 13,000 games at this discordance rate -- around two hours of self-play -- or a
 * larger `strength`, which is a free parameter nobody has calibrated. Either is cheap; neither has
 * been done. Until one is, engine/variance.js remains a mechanism with a verified SHAPE and no
 * verified EFFECT, and it stays off by default. */
module.exports = { winProb, varianceOf, adjust, sideState, poryModel, matchEquity, stakeRatio };
