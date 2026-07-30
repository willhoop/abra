/* train_policy.js — improve the behaviour-cloned policy by playing it against itself.
 *
 *   SHOWDOWN_PATH=... node engine/train_policy.js --iters 20 --games 10000 --trust 0.02
 *
 * WHY THIS EXISTS
 * ---------------
 * VGC-Bench (arXiv 2506.10326) reports two things that together describe this project exactly.
 * First, behaviour cloning BEAT pure reinforcement learning on identical team sets. Second, every
 * one of their top agents was behaviour cloning FOLLOWED BY population-based self-play improvement.
 *
 * ABRA has had both halves for weeks and has never connected them. `fit_policy.js` is the behaviour
 * clone — a conditional logit fitted on what humans clicked. `mew_farm.js` is a self-play farm at
 * ~40 games a second. The farm has only ever MEASURED policies; it has never once improved one.
 *
 * The evidence that this is the right axis is the week's own record: four separate attempts to add
 * correct knowledge to the feature vector all measured dead null, while one change to how the
 * policy is USED — taking the best-scoring option instead of sampling — was worth twelve points of
 * win rate. The constraint is not what the model knows. It is what it is aimed at. Every weight in
 * data/policy-weights.json was fitted to PREDICT A HUMAN CLICK. Not one was fitted to win a game.
 *
 * THE METHOD, AND ITS HONEST NAME
 * -------------------------------
 * REINFORCE. Each game is played by the current policy against itself with SAMPLING (an argmax has
 * no gradient and no exploration). Each player accumulates the gradient of the log-probability of
 * its own decisions; mew.js signs that by the result at game end; this file sums over games and
 * steps the weights.
 *
 * The baseline is free and exact. In symmetric self-play precisely one side wins, so the two
 * gradients enter with +1 and -1: everything common to winning and losing play cancels, and what
 * survives is the difference between them. No learned value function, no moving average, nothing to
 * tune — which matters, because PORYGON's flat learning curve says a learned value function is the
 * hard part here.
 *
 * A TRUST REGION, NOT A LEARNING RATE. The raw gradient's scale depends on how many decisions a game
 * happens to contain and on feature magnitudes nobody has normalised. A step size chosen against
 * that is a number with no meaning that has to be re-tuned whenever the feature list changes. So
 * the update is rescaled to move the weight vector a fixed FRACTION of its own length:
 *
 *     w  <-  w  +  trust * ||w|| * grad/||grad||
 *
 * `--trust 0.02` means "move the policy 2% per iteration", which is interpretable, survives a
 * feature-list change, and cannot explode.
 *
 * AN ANCHOR BACK TO THE CLONE, off by default and stated when on. `--anchor a` adds a*(w_bc - w)
 * each step, which bounds how far self-play may drag the policy from human play. It is a real
 * trade — it also bounds how much better than a human the policy may get — so it is opt-in rather
 * than a quiet safety rail.
 *
 * WHAT THIS DOES NOT DO. It does not touch the features, so the ceiling is whatever a linear score
 * over these 53 numbers can reach. It trains against ITSELF rather than a population of past
 * versions, which is self-play rather than the fictitious play VGC-Bench found most reliable; the
 * checkpoints this writes are exactly the population a later version would need.
 *
 * NOTHING HERE SHIPS ON ITS OWN. The output is a checkpoint. The gate is a paired head-to-head
 * against the clone it started from, greedy on both sides, which is what actually gets played.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

const ITERS = parseInt(arg('iters', '20'), 10);
const GAMES = parseInt(arg('games', '10000'), 10);
const PROCS = parseInt(arg('procs', '6'), 10);
const TRUST = parseFloat(arg('trust', '0.02'));
const ANCHOR = parseFloat(arg('anchor', '0'));
const SEED0 = parseInt(arg('seed', String((Math.floor(Date.now() / 60000) * 997) % (2 ** 27))), 10);
const BASE = path.resolve(arg('from', D('data', 'policy-weights.json')));
const OUTDIR = path.resolve(arg('outdir', D('data', 'train')));
const WORK = path.resolve(arg('work', D('data', '.train-games.jsonl')));

if (!process.env.SHOWDOWN_PATH) { console.error('set SHOWDOWN_PATH'); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true });

const B = require('./board.js');
const baseJson = JSON.parse(fs.readFileSync(BASE, 'utf8'));
if ((baseJson.features || []).join(',') !== B.FEATURES.join(',')) {
  console.error('REFUSING: the starting weights were fitted against a different feature list than board.js exposes.');
  process.exit(1);
}
const wBC = baseJson.weights.slice();
let w = wBC.slice();

const norm = (v) => Math.sqrt(v.reduce((a, x) => a + x * x, 0));
const writeWeights = (file, weights, meta) => {
  fs.writeFileSync(file, JSON.stringify(Object.assign({}, baseJson, {
    generated: new Date().toISOString(),
    by: 'engine/train_policy.js',
    features: B.FEATURES,
    weights,
    trainedFrom: path.relative(ROOT, BASE),
    training: meta,
    /* The fit's own uncertainty numbers describe the CLONE, not this. Dropping them rather than
     * letting a reader take a standard error from one model as if it belonged to another. */
    standardErrors: undefined, spread: undefined, heldOut: undefined,
  }), null, 1));
};

console.log(`SELF-PLAY POLICY IMPROVEMENT`);
console.log(`  from            ${path.relative(ROOT, BASE)}  (${w.length} weights)`);
console.log(`  iterations      ${ITERS} x ${GAMES.toLocaleString()} games  (${(ITERS * GAMES).toLocaleString()} total)`);
console.log(`  trust region    ${TRUST}  (fraction of ||w|| moved per step)`);
console.log(`  anchor to clone ${ANCHOR || 'off'}`);
console.log(`  checkpoints     ${path.relative(ROOT, OUTDIR)}\n`);

const curFile = path.join(OUTDIR, 'current.json');
writeWeights(curFile, w, { iter: 0, note: 'copy of the starting clone' });

const hist = [];
for (let it = 1; it <= ITERS; it++) {
  const seed = SEED0 + (it - 1) * GAMES * 2;
  /* Clear stale gradient sidecars so a crashed worker's file from a previous iteration can never be
   * summed into this one's step. */
  const shardDir = path.join(path.dirname(WORK), '.mew-shards');
  if (fs.existsSync(shardDir)) {
    for (const f of fs.readdirSync(shardDir)) if (/\.grad\.json$/.test(f)) fs.unlinkSync(path.join(shardDir, f));
  }

  const t0 = Date.now();
  const r = spawnSync(process.execPath, [
    D('engine', 'mew_farm.js'), '--n', String(GAMES), '--procs', String(PROCS),
    '--policy', 'score', '--weights', curFile, '--learn', '--keep-shards',
    '--seed', String(seed), '--out', WORK,
  ], { env: process.env, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    console.error(`iteration ${it}: farm exited ${r.status}`);
    console.error(String(r.stderr || '').split('\n').slice(-12).join('\n'));
    process.exit(1);
  }

  /* Sum every worker's gradient. Divided by GAMES, not by file count: workers do not finish equal
   * amounts and a per-file mean would weight a short worker like a long one. */
  const grad = new Array(w.length).fill(0);
  let games = 0, decisions = 0, files = 0;
  for (const f of fs.readdirSync(shardDir)) {
    if (!/\.grad\.json$/.test(f)) continue;
    const g = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8'));
    if (!Array.isArray(g.grad) || g.grad.length !== w.length) continue;
    for (let k = 0; k < w.length; k++) grad[k] += g.grad[k];
    games += g.games || 0; decisions += g.decisions || 0; files++;
  }
  if (!files || !decisions) {
    console.error(`iteration ${it}: no gradient came back (${files} files, ${decisions} decisions). Stopping.`);
    process.exit(1);
  }

  const gn = norm(grad), wn = norm(w);
  if (!(gn > 0)) { console.error(`iteration ${it}: zero gradient. Stopping.`); process.exit(1); }
  const scale = (TRUST * wn) / gn;
  const before = w.slice();
  for (let k = 0; k < w.length; k++) {
    w[k] += scale * grad[k];
    if (ANCHOR) w[k] += ANCHOR * (wBC[k] - w[k]);
  }

  /* How far from the clone we have travelled, as a fraction of the clone's own size. The number to
   * watch: a policy that has moved 200% from its starting point is no longer a tuned clone. */
  let d2 = 0; for (let k = 0; k < w.length; k++) d2 += (w[k] - wBC[k]) ** 2;
  const drift = Math.sqrt(d2) / norm(wBC);
  let s2 = 0; for (let k = 0; k < w.length; k++) s2 += (w[k] - before[k]) ** 2;

  writeWeights(curFile, w, { iter: it, games, decisions, driftFromClone: drift });
  writeWeights(path.join(OUTDIR, `iter-${String(it).padStart(3, '0')}.json`), w, { iter: it, games, decisions, driftFromClone: drift });
  hist.push({ iter: it, games, decisions, gradNorm: gn, step: Math.sqrt(s2), drift });

  const secs = (Date.now() - t0) / 1000;
  console.log(`  iter ${String(it).padStart(3)}  ${games.toLocaleString()} games  ${decisions.toLocaleString()} decisions  ` +
              `|grad| ${gn.toFixed(1)}  step ${Math.sqrt(s2).toFixed(3)}  drift ${(100 * drift).toFixed(1)}%  ${secs.toFixed(0)}s`);
}

fs.writeFileSync(path.join(OUTDIR, 'history.json'), JSON.stringify({ base: path.relative(ROOT, BASE), iters: ITERS, games: GAMES, trust: TRUST, anchor: ANCHOR, seed: SEED0, hist }, null, 1));

/* WHAT MOVED. The point of a linear policy is that this is readable, so print it rather than making
 * somebody diff two JSON files. */
const delta = w.map((x, k) => ({ f: B.FEATURES[k], from: wBC[k], to: x, d: x - wBC[k] }))
  .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
console.log(`\n  BIGGEST WEIGHT CHANGES (self-play vs the human clone)`);
for (const r of delta.slice(0, 12)) {
  console.log(`    ${r.d >= 0 ? '+' : ''}${r.d.toFixed(3)}   ${r.f.padEnd(20)} ${r.from.toFixed(3)} -> ${r.to.toFixed(3)}`);
}
console.log(`\n  -> ${path.relative(ROOT, curFile)}`);
console.log(`\n  NOTHING HAS BEEN MEASURED YET. Gate it against the clone it came from:`);
console.log(`     node engine/mew_farm.js --n 120000 --procs 6 --paired --policy score --policy2 score \\`);
console.log(`       --weights ${path.relative(ROOT, curFile)} --weights2 ${path.relative(ROOT, BASE)} \\`);
console.log(`       --greedy --greedy2 --seed <fresh> --out data/games.h2h-trained.jsonl`);
console.log(`     node engine/paired_h2h.js data/games.h2h-trained.jsonl`);
