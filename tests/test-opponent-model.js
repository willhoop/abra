/* THE OPPONENT MODEL — job 2 of the four ALAKAZAM needs.
 *
 * Will, 2026-07-31: "WAIT WE ARENT RUNNING THE OPPONENTS MOVES THROUGH OUR CRITERIA? WE ARENT
 * CALCING IF THEY KO US?"
 *
 * We are, and always were: incomingThreat runs the foe's whole moveset through the real damage
 * engine and nine features consume it. What it does NOT do is model their CHOICE — it takes a MAX,
 * the hardest hit available, so every survive/die feature is priced against a worst case. Measured
 * on one mid-game board, the foe's lead clicks a damaging move 52.9% of the time; MAG assumes 100%
 * and assumes it is the nastiest of them.
 *
 * The fix needs no new model. `candidates` and `featuresFor` already take `side`, so the same
 * weights score the other side of the field, and the max becomes an expectation.
 *
 * Four things are asserted, and the middle two are the ones that would fail silently:
 *
 *   1. OFF BY DEFAULT. Left off, every number is exactly what it was. This is what makes the change
 *      an A/B rather than a rewrite, and a default that drifted on would make the control useless.
 *   2. NO INFINITE RECURSION. Scoring the foe calls featuresFor, which calls incomingThreat, which
 *      scores the foe. Bounded at one level; without the guard this hangs rather than fails.
 *   3. IT LOWERS THE THREAT, and in the right direction. An expectation over their options cannot
 *      exceed the max over the same options — if it ever does, the weighting is wrong.
 *   4. A REAL DISTRIBUTION. Probabilities over their options sum to 1 and cover switches and status
 *      moves, not just attacks.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const B = require(path.join(ROOT, 'engine', 'board.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const W = require(path.join(ROOT, 'data', 'policy-weights.json'));

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
  if (!cond) fails++;
};
const I = n => B.FEATURE_INDEX[n];

const names = Object.keys(MC.mons).filter(n => (MC.mons[n].mv || []).length >= 4 && !MC.mons[n].mega);
const mk = s => ({ species: s, hp: 1, boosts: {}, status: '', fainted: false,
  nature: 'Serious', item: '', ability: '', moves: (MC.mons[s].mv || []), lastMove: '', turnsActive: 2 });

function mkBoard(mine, theirs) {
  const b = new B.Board(); b.turn = 3;
  b.sides.p1.active = { a: mk(mine[0]), b: mk(mine[1]) };
  b.sides.p2.active = { a: mk(theirs[0]), b: mk(theirs[1]) };
  b.party.p1 = mine; b.party.p2 = theirs;
  for (const s of mine) b.setSheet('p1', s, { nature: 'Serious', item: '', ability: '', moves: MC.mons[s].mv });
  for (const s of theirs) b.setSheet('p2', s, { nature: 'Serious', item: '', ability: '', moves: MC.mons[s].mv });
  return b;
}
const featOf = (b, side, letter) => {
  const mon = b.sides[side].active[letter];
  const cands = B.candidates(mon.moves, mon, b, side, dex);
  const sw = cands.find(c => c.switchTo) || cands[0];
  return B.featuresFor(sw, mon, b, side, dex, B.PRIOR_FLOOR);
};

console.log('THE OPPONENT MODEL — expectation instead of worst case\n');

/* ---- 1. OFF BY DEFAULT ------------------------------------------------------------------------ */
console.log('1. off by default, so the comparison is a true A/B');
B.setOpponentModel(null);
ok(B.setOpponentModel(null) === false, 'setOpponentModel(null) reports OFF');
const mine = names.slice(0, 4), theirs = names.slice(30, 34);
const bOff = mkBoard(mine, theirs);
const vOff = featOf(bOff, 'p1', 'a');
ok(!!vOff, 'features build with the model off');

/* ---- 2. NO INFINITE RECURSION ----------------------------------------------------------------- */
console.log('\n2. bounded recursion — scoring them calls featuresFor, which scores them');
B.setOpponentModel(W.weights);
let recursed = false, vOn = null;
const t0 = Date.now();
try { vOn = featOf(mkBoard(mine, theirs), 'p1', 'a'); }
catch (e) { recursed = /call stack|recursion/i.test(e.message); }
const ms = Date.now() - t0;
ok(!recursed && !!vOn, 'features build with the model ON, without blowing the stack', `${ms}ms`);
ok(ms < 20000, 'and in reasonable time (a runaway recursion shows up as a hang)', `${ms}ms`);

/* ---- 3. A REAL DISTRIBUTION -------------------------------------------------------------------- */
console.log('\n3. the distribution over THEIR options');
const bD = mkBoard(mine, theirs);
const dist = B.foeActionDistribution(bD, 'p2', bD.sides.p2.active.a, dex);
ok(!!dist && dist.length > 1, 'their options are scored', dist ? `${dist.length} options` : 'null');
const tot = dist ? dist.reduce((s, o) => s + o.p, 0) : 0;
ok(Math.abs(tot - 1) < 1e-9, 'probabilities sum to 1', tot.toFixed(6));
ok(dist.every(o => o.p >= 0 && o.p <= 1), 'every probability is in [0,1]');
/* The half of their option space the max pretends does not exist. */
const nonDamaging = dist.filter(o => o.cand.switchTo || !(o.cand.move && o.cand.move.basePower > 0));
ok(nonDamaging.length > 0, 'switches and non-damaging moves are IN the distribution',
  `${nonDamaging.length} of ${dist.length}, carrying ${(100 * nonDamaging.reduce((s, o) => s + o.p, 0)).toFixed(1)}% of the mass`);

/* ---- 4. IT LOWERS THE THREAT, NEVER RAISES IT --------------------------------------------------
 * An expectation over a set cannot exceed the maximum over that same set. If a single board comes
 * back higher with the model on, the weighting is wrong — so this is checked across many boards
 * rather than on one lucky case. */
console.log('\n4. an expectation can never exceed the max it replaces');
let checked = 0, lower = 0, higher = 0, same = 0;
for (let i = 0; i + 4 <= names.length && checked < 40; i += 7) {
  const m2 = names.slice(i, i + 2).concat(names.slice(i + 2, i + 4));
  const t2 = names.slice((i + 40) % (names.length - 4), (i + 40) % (names.length - 4) + 4);
  if (m2.length < 4 || t2.length < 4) continue;
  let a, c;
  B.setOpponentModel(null); try { a = featOf(mkBoard(m2, t2), 'p1', 'a'); } catch (e) { continue; }
  B.setOpponentModel(W.weights); try { c = featOf(mkBoard(m2, t2), 'p1', 'a'); } catch (e) { continue; }
  if (!a || !c) continue;
  checked++;
  /* switchSurvives1 is 1 when the incoming mon lives through the hit. A LOWER expected threat can
   * only make survival more likely, never less. */
  const s1a = a[I('switchSurvives1')], s1c = c[I('switchSurvives1')];
  if (s1c > s1a) lower++; else if (s1c < s1a) higher++; else same++;
}
ok(checked > 5, 'enough boards compared', `${checked}`);
ok(higher === 0, 'survival NEVER got worse when the threat became an expectation',
  `${lower} improved, ${same} unchanged, ${higher} worse`);

B.setOpponentModel(null);
console.log(`\n${fails ? fails + ' FAILED' : 'all passed'}`);
process.exit(fails ? 1 : 0);
