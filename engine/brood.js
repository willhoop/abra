/* brood.js — how many candidates should a generation actually have?
 *
 *   SHOWDOWN_PATH=... node engine/brood.js --sons 8 --games 200
 *
 * THE QUESTION, AND WHY THE OBVIOUS ANSWER IS WRONG
 * ------------------------------------------------
 * "More candidates per generation is better" is only true if you can TELL THEM APART. Each match is
 * a few hundred coin flips, so a win rate carries an error bar of roughly three points. Two
 * candidates that genuinely differ by two points are indistinguishable — and picking the best of
 * eight such candidates does not find the best one, it finds the LUCKIEST one. That is not a
 * hypothetical: the ladder's first run promoted a champion on 56.1% that scored 49% on a rematch.
 *
 * So the real trade is how to split a fixed budget of games: more candidates, or a better look at
 * each candidate. And which side to favour depends on a fact that can be measured rather than
 * argued — how much of the spread between candidates is REAL and how much is noise.
 *
 * HOW THIS MEASURES IT
 * --------------------
 * Every candidate is evaluated TWICE against the same champion, on independent seeds. Then:
 *
 *   - if the two evaluations agree, the spread between candidates is real signal, and making more
 *     of them pays;
 *   - if they do not, the spread is noise, more candidates only buys more lottery tickets, and the
 *     games are better spent judging fewer of them properly.
 *
 * The split is the standard one from measurement theory: total variance = true variance + noise
 * variance. Noise variance is estimated directly from the disagreement between a candidate's two
 * evaluations, so the true spread is what is left. Nothing here is assumed about the size of either.
 *
 * The output is a recommended number of candidates, derived from those two numbers rather than
 * chosen — and it says plainly when the answer is "the differences are all noise, stop making more".
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./board.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };

const SONS = +arg('sons', 8);
const GAMES = +arg('games', 200);
const SEED0 = +arg('seed', 611953);
const SCALE = +arg('scale', 0.7);
const OUT = D('data', 'brood.json');

const base = JSON.parse(fs.readFileSync(D('data', 'policy-weights.json'), 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-brood-'));
let _s = SEED0 >>> 0;
const rnd = () => { _s ^= _s << 13; _s ^= _s >>> 17; _s ^= _s << 5; _s >>>= 0; return _s / 4294967296; };
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

function wfile(w, tag) {
  const f = path.join(TMP, `w-${tag}.json`);
  fs.writeFileSync(f, JSON.stringify(Object.assign({}, base, { weights: w })));
  return f;
}
function play(aW, bW, tag, seed) {
  const fa = wfile(aW, tag + 'a'), fb = wfile(bW, tag + 'b');
  const out = path.join(TMP, `g-${tag}.jsonl`);
  try {
    execFileSync(process.execPath, [D('engine', 'mew.js'), '--n', String(GAMES),
      '--policy', 'score', '--policy2', 'score', '--weights', fa, '--weights2', fb,
      '--conc', '6', '--seed', String(seed), '--out', out, '--no-raw'], { stdio: 'ignore', env: process.env });
  } catch (e) { return null; }
  if (!fs.existsSync(out)) return null;
  let b = 0, a = 0;
  for (const l of fs.readFileSync(out, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    let r; try { r = JSON.parse(l); } catch (e) { continue; }
    if (!r.winner) continue;
    const p1won = r.p1 && r.winner === r.p1.name;
    ((r.selfplay || {}).swapped ? p1won : !p1won) ? b++ : a++;
  }
  try { fs.unlinkSync(out); } catch (e) {}
  return (a + b) ? { rate: b / (a + b), n: a + b } : null;
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const varr = a => { const m = mean(a); return a.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, a.length - 1); };

(function main() {
  console.log('BROOD SIZE — are the sons actually different, or just lucky?\n');
  console.log(`  ${SONS} candidates, each judged TWICE on independent seeds, ${GAMES} games per look\n`);

  const champ = base.weights.slice();
  const rows = [];
  for (let i = 0; i < SONS; i++) {
    const cand = champ.map(v => v + gauss() * SCALE * (Math.abs(v) + 0.25));
    const r1 = play(champ, cand, `s${i}x`, SEED0 + i * 7919);
    const r2 = play(champ, cand, `s${i}y`, SEED0 + 500000 + i * 104729);
    if (!r1 || !r2) { console.log(`  son ${i}: evaluation failed`); continue; }
    rows.push({ son: i, a: r1.rate, b: r2.rate, n: r1.n });
    console.log(`  son ${i}   first look ${(100 * r1.rate).toFixed(1)}%   second look ${(100 * r2.rate).toFixed(1)}%   ` +
      `gap ${(100 * Math.abs(r1.rate - r2.rate)).toFixed(1)} points`);
  }
  if (rows.length < 3) { console.error('not enough usable candidates'); process.exit(1); }

  const A = rows.map(r => r.a), Bv = rows.map(r => r.b);
  /* Noise variance from the disagreement between two looks at the SAME candidate: for paired
   * measurements, var(difference) = 2 x noise variance. */
  const diffs = rows.map(r => r.a - r.b);
  const noiseVar = varr(diffs) / 2;
  const observedVar = (varr(A) + varr(Bv)) / 2;
  const trueVar = Math.max(0, observedVar - noiseVar);
  const noiseSD = Math.sqrt(noiseVar), trueSD = Math.sqrt(trueVar);
  /* Reliability: the share of the observed spread that is real. This is the same quantity as a
   * test-retest reliability coefficient. */
  const reliability = observedVar > 0 ? trueVar / observedVar : 0;

  console.log('\n  HOW MUCH OF THE SPREAD IS REAL?');
  console.log(`    spread between candidates (observed)  ${(100 * Math.sqrt(observedVar)).toFixed(1)} points`);
  console.log(`    of which noise                        ${(100 * noiseSD).toFixed(1)} points`);
  console.log(`    of which real difference              ${(100 * trueSD).toFixed(1)} points`);
  console.log(`    reliability                           ${(100 * reliability).toFixed(0)}%  (share of the spread that is real)`);

  console.log('\n  WHAT THAT MEANS FOR BROOD SIZE');
  let rec, why;
  if (reliability < 0.15) {
    rec = 2;
    why = 'The candidates are barely distinguishable at this many games. Making more of them just\n' +
          '    buys more lottery tickets — the winner is whoever got the friendliest seeds. Spend the\n' +
          '    budget on judging FEWER candidates properly instead, and keep the confirmation match.';
  } else if (reliability < 0.5) {
    rec = 4;
    why = 'Real differences exist but noise is comparable, so the best-of-N is still substantially a\n' +
          '    lottery. A handful of candidates is worth having; a large brood is not, and the\n' +
          '    confirmation match is doing most of the work.';
  } else {
    rec = 10;
    why = 'The candidates genuinely differ by more than the measurement error, so searching wider\n' +
          '    pays. More candidates per generation is a good use of games here.';
  }
  console.log(`    recommended candidates per generation: ${rec}`);
  console.log('    ' + why);
  console.log(`\n    Games needed to resolve the real spread (${(100 * trueSD).toFixed(1)} points) at 95%:`);
  const need = trueSD > 0 ? Math.ceil(2 * Math.pow(1.96 * 0.5 / trueSD, 2)) : Infinity;
  console.log(`      about ${isFinite(need) ? need.toLocaleString() : 'unbounded'} games per match ` +
              `(currently ${GAMES})`);

  fs.writeFileSync(OUT, JSON.stringify({
    generated: new Date().toISOString(), sons: SONS, gamesPerLook: GAMES, seed: SEED0, mutationScale: SCALE,
    rows, observedSD: Math.sqrt(observedVar), noiseSD, trueSD, reliability,
    recommendedBrood: rec, gamesToResolve: isFinite(need) ? need : null,
    note: 'Each candidate judged twice on independent seeds; noise estimated from the disagreement, ' +
          'true spread from what is left. Recommendation is derived from those two numbers.',
  }, null, 1));
  console.log(`\n  -> ${path.relative(ROOT, OUT)}`);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
})();
