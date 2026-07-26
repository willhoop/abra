/* ladder.js — improve the policy by WINNING, against an opponent that improves with it.
 *
 *   SHOWDOWN_PATH=... node engine/ladder.js --gens 8 --games 240 --probes 6
 *
 * WHY THIS EXISTS
 * ---------------
 * Everything about MAG until now was fitted to PREDICT A HUMAN'S NEXT CLICK. engine/exploit.js then
 * showed what that costs: a challenger drawn from MAG's own seventeen features, optimised for wins
 * instead of for resemblance, beat MAG 63% and beat MAG's predecessor 68% where MAG itself managed
 * 60%. It was not a counter — it was simply a better player, found by a crude search in forty
 * minutes. Imitation is a ceiling, and the fit was leaving strength on the table.
 *
 * So this optimises the thing that is actually wanted.
 *
 * THE OPPONENT HAS TO IMPROVE TOO, AND THAT IS THE WHOLE DESIGN
 * ------------------------------------------------------------
 * Hill-climbing against a FIXED opponent produces a policy that beats that opponent, which is the
 * trap this project already fell into once: MAG's 60% over the prior bot turned out to be mostly
 * MAG punishing a flaw it had been built to punish. Beating a frozen target is a one-off, and it
 * stops teaching you anything the moment you clear it.
 *
 * Here the opponent is the CURRENT CHAMPION. Beat it and you become it. The bar rises every
 * generation on its own, and no amount of out-classing a strawman counts for anything.
 *
 * NON-TRANSITIVITY IS THE FAILURE MODE TO WATCH, NOT OVERFITTING
 * -------------------------------------------------------------
 * This metagame is genuinely cyclic — the project's own archetype work found rock-paper-scissors
 * structure — so "gen 5 beats gen 4" does NOT establish that gen 5 is better. A cycle produces
 * exactly that pattern forever while going nowhere.
 *
 * Every promoted champion is therefore played against EVERY previous generation, not merely the one
 * it displaced. Real progress shows as a new champion beating all its ancestors; a cycle shows as it
 * losing to an older one. That table is printed, and a detected cycle is reported rather than
 * quietly averaged away.
 *
 * WHAT THIS IS NOT. It searches seventeen numbers, not a policy space. It cannot learn anything MAG
 * cannot already see, and what MAG can see is the harder limit. This is the smallest honest version
 * of outcome-based learning, run to find out whether the signal is there at all.
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

const GENS = +arg('gens', 8);
const GAMES = +arg('games', 240);
const PROBES = +arg('probes', 6);         // candidates tried per generation
const SEED0 = +arg('seed', 20260726);
const OUT = D('data', 'ladder.json');

const base = JSON.parse(fs.readFileSync(D('data', 'policy-weights.json'), 'utf8'));
if ((base.features || []).join(',') !== B.FEATURES.join(',')) {
  console.error('policy-weights.json does not match engine/board.js — refit first'); process.exit(1);
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-ladder-'));

let _s = SEED0 >>> 0;
const rnd = () => { _s ^= _s << 13; _s ^= _s >>> 17; _s ^= _s << 5; _s >>>= 0; return _s / 4294967296; };
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

function wfile(w, tag) {
  const f = path.join(TMP, `w-${tag}.json`);
  fs.writeFileSync(f, JSON.stringify(Object.assign({}, base, { weights: w, shipped: 'ladder-' + tag })));
  return f;
}

/* A plays B. Returns B's win rate — B is the side carrying --weights2. */
function play(aW, bW, tag, seed, games) {
  const fa = wfile(aW, tag + '-a'), fb = wfile(bW, tag + '-b');
  const out = path.join(TMP, `g-${tag}.jsonl`);
  try {
    execFileSync(process.execPath, [D('engine', 'mew.js'),
      '--n', String(games), '--policy', 'score', '--policy2', 'score',
      '--weights', fa, '--weights2', fb, '--conc', '6', '--seed', String(seed),
      '--out', out, '--no-raw'], { stdio: 'ignore', env: process.env });
  } catch (e) { return null; }
  if (!fs.existsSync(out)) return null;
  let b = 0, a = 0;
  for (const l of fs.readFileSync(out, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    let r; try { r = JSON.parse(l); } catch (e) { continue; }
    if (!r.winner) continue;
    const p1won = r.p1 && r.winner === r.p1.name;
    const bWon = (r.selfplay || {}).swapped ? p1won : !p1won;
    if (bWon) b++; else a++;
  }
  try { fs.unlinkSync(out); } catch (e) {}
  const n = a + b;
  return n ? { rate: b / n, n } : null;
}

const wilson = (p, n) => {
  const z = 1.96, den = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / den;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  return [c - h, c + h];
};

(function main() {
  console.log('LADDER — optimise for WINNING, against an opponent that improves too\n');
  console.log(`  ${GENS} generations, ${PROBES} candidates each, ${GAMES} games per match\n`);

  const gens = [{ gen: 0, weights: base.weights.slice(), note: 'MAG, fitted to imitate humans' }];
  let champ = base.weights.slice();
  let scale = 0.7;
  const history = [];

  for (let g = 1; g <= GENS; g++) {
    let bestW = null, bestR = null;
    for (let p = 0; p < PROBES; p++) {
      const cand = champ.map(v => v + gauss() * scale * (Math.abs(v) + 0.25));
      const r = play(champ, cand, `g${g}p${p}`, SEED0 + g * 7919 + p * 104729, GAMES);
      if (!r) continue;
      if (!bestR || r.rate > bestR.rate) { bestR = r; bestW = cand; }
    }
    if (!bestR) { console.log(`  gen ${g}: every probe failed`); continue; }
    const [lo] = wilson(bestR.rate, bestR.n);
    /* PROMOTION GATE: the challenger must beat the champion with its interval clear of a coin.
     * Promoting on a nominal lead would let noise walk the champion sideways forever, which looks
     * exactly like progress on a chart. */
    const promoted = lo > 0.5;
    console.log(`  gen ${g}  best challenger ${(100 * bestR.rate).toFixed(1)}%  n=${bestR.n}  ` +
      (promoted ? '-> PROMOTED' : '(not clear of a coin, champion holds)'));
    history.push({ gen: g, rate: bestR.rate, n: bestR.n, promoted });
    if (promoted) { champ = bestW; gens.push({ gen: g, weights: champ.slice() }); scale = 0.7; }
    else scale *= 0.8;
  }

  /* ---- IS IT REALLY BETTER, OR IS IT A CYCLE? ------------------------------------------------- */
  console.log('\n  ROUND ROBIN — every champion against every ancestor');
  console.log('  (a real improvement beats ALL its ancestors; a cycle loses to an older one)\n');
  const grid = [];
  for (let i = 1; i < gens.length; i++) {
    const row = { gen: gens[i].gen, vs: [] };
    for (let j = 0; j < i; j++) {
      const r = play(gens[j].weights, gens[i].weights, `rr${i}-${j}`, SEED0 + 555 + i * 31 + j, Math.max(120, Math.floor(GAMES / 2)));
      if (!r) continue;
      const [lo, hi] = wilson(r.rate, r.n);
      row.vs.push({ ancestor: gens[j].gen, rate: r.rate, n: r.n, ci95: [lo, hi], beats: lo > 0.5, losesTo: hi < 0.5 });
    }
    grid.push(row);
    const line = row.vs.map(v => `gen${v.ancestor}: ${(100 * v.rate).toFixed(0)}%${v.losesTo ? ' LOSES' : (v.beats ? '' : ' ~')}`).join('   ');
    console.log(`    gen ${row.gen}  ${line}`);
  }
  const cycles = grid.flatMap(r => r.vs.filter(v => v.losesTo).map(v => `gen${r.gen} loses to gen${v.ancestor}`));
  console.log('');
  if (cycles.length) {
    console.log('  NON-TRANSITIVITY DETECTED: ' + cycles.join(', '));
    console.log('  A later champion losing to an earlier one means the ladder is going round, not up.');
    console.log('  Win-maximising self-play cannot fix that; it needs a regret-minimising update.');
  } else if (gens.length > 1) {
    console.log('  No cycle detected: every champion beats or ties all of its ancestors.');
  } else {
    console.log('  No champion was ever promoted — no evidence the search found anything.');
  }

  fs.writeFileSync(OUT, JSON.stringify({
    generated: new Date().toISOString(),
    method: 'champion/challenger hill-climb over the policy weights, promotion gated on a Wilson interval clear of 50%',
    limits: 'searches 17 numbers, not a policy space; cannot learn anything the feature set cannot see',
    gensRequested: GENS, gamesPerMatch: GAMES, probesPerGen: PROBES, seed: SEED0,
    features: B.FEATURES, generations: gens, history, roundRobin: grid, cycles,
  }, null, 1));
  console.log(`\n  -> ${path.relative(ROOT, OUT)}`);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
})();
