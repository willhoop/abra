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
require('./showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
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
/* --joint  TRAIN THE COORDINATION LAYER FOR WINNING.
 *
 * Every weight this repository ships was fitted to PREDICT A HUMAN CLICK, including the 18 pair
 * terms in data/policy-weights-joint.json. That is a resemblance objective, and the one pattern that
 * has held across every experiment here is that changing what MAG OPTIMISES pays while changing how
 * it models the game does not. This flag points self-play at the 74-length vector so the pair terms
 * are moved by whether the game was WON rather than by whether a person would have clicked it.
 *
 * Both arms carry the layer: mew.js refuses --learn with it on one side, because the run gradient
 * sums both sides and index k would be a different feature in each. */
const JOINT = process.argv.includes('--joint');
/* --joint-only  FREEZE THE 56 SINGLES AND SPEND THE WHOLE STEP ON THE 18 PAIR TERMS.
 *
 * WHY THIS EXISTS, measured 2026-07-31. The first joint run (10 iterations, 48,691 games) moved the
 * pair block by 0.390 against its own length of 8.248 -- 4.7% -- while the singles moved 21.7%.
 * `spreadFreeBesideAlly`, the single weight ROADMAP item 1 names as the whole problem, went from
 * -4.986 to -4.687. It is still -4.7. The run did not touch the thing it existed to fix.
 *
 * The cause is the trust region, and it is structural rather than a tuning accident. The step is
 * `scale = TRUST * ||w|| / ||grad||` applied to ONE 74-length vector, so the two blocks share a
 * budget in proportion to their gradient mass. A single feature like dmgFrac is present in nearly
 * every choice set; a pair feature like spreadFreeBesideAlly needs a free spread move AND an ally
 * beside it. The singles therefore dominate ||grad|| and the pair block is starved by construction.
 * More iterations do not fix this -- they scale both blocks equally.
 *
 * Zeroing the singles' gradient makes ||grad|| the PAIR gradient alone, so the whole trust-region
 * step goes to the block being tested. It also makes the head-to-head exact: the singles are
 * bit-identical between the arms because they were never written, so the only thing that differs is
 * the 18 coordination weights. That is the experiment ROADMAP item 1 actually asks for. */
const JOINT_ONLY = process.argv.includes('--joint-only');
if (JOINT_ONLY && !JOINT) {
  console.error('REFUSING: --joint-only without --joint. There is no pair block to train on its own.');
  process.exit(1);
}
const BASE = path.resolve(arg('from', D('data', JOINT ? 'policy-weights-joint.json' : 'policy-weights.json')));
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
/* In joint mode the pair list is checked too, and the LENGTH against both. A 56-length file passed
 * to --joint would otherwise train the singles and leave the pair terms wherever fit_joint left
 * them, while every line this prints said "joint". */
const NF = B.FEATURES.length, NJ = B.JOINT_FEATURES.length;
if (JOINT) {
  if ((baseJson.jointFeatures || []).join(',') !== B.JOINT_FEATURES.join(',')) {
    console.error('REFUSING: --joint, but the starting file carries a different pair-feature list than board.js.');
    console.error('Re-run engine/fit_joint.js against the current board.');
    process.exit(1);
  }
  if (baseJson.weights.length !== NF + NJ) {
    console.error(`REFUSING: --joint needs a ${NF + NJ}-length vector; ${path.relative(ROOT, BASE)} has ${baseJson.weights.length}.`);
    process.exit(1);
  }
}
const wBC = baseJson.weights.slice();
let w = wBC.slice();

/* THE SINGLES MIRROR, DEFINED BEFORE THE GATE because the gate has to run the configuration the
 * real run will run. magnemite's `this.w` is 56 long even in joint mode -- the pair path scores with
 * wj.slice(0, 56), but forced-switch and team-preview read this.w -- so --weights must receive 56
 * entries and the 74-length vector reaches the players through --joint-weights. Handing BASE (74) to
 * --weights killed all five preflight workers on 2026-07-31. */
const singlesFile = path.join(OUTDIR, 'current-singles.json');
const writeSingles = (weights) => fs.writeFileSync(singlesFile, JSON.stringify({
  generated: new Date().toISOString(), by: 'engine/train_policy.js (--joint singles mirror)',
  note: 'first 56 entries of the joint checkpoint. Not a fit, not a measurement, do not cite.',
  features: B.FEATURES, weights: weights.slice(0, NF),
}, null, 1));
if (JOINT) writeSingles(wBC);

/* ---- PREFLIGHT: refuse to spend hours training a block that cannot move ----------------------
 *
 * Two runs of this file, 144,000 games each, finished before anyone noticed the SWITCH WEIGHTS WERE
 * BIT-IDENTICAL to the behaviour clone in both. The cause is the spawn below: it does not pass
 * `--switching`, and mew.js makes switching opt-in, so MAG could not switch in a single training
 * game. Switch candidates never entered a choice set, that block's gradient was exactly zero, and a
 * session's worth of switch work -- post-KO replacement scoring, entry effects, the mega moveset
 * repair -- was never exercised. The head-to-head queued off the back of it would have returned a
 * null and invited the conclusion that the engine fixes do not help.
 *
 * A zero gradient is not a weak signal. It is proof the feature never varied inside any choice set,
 * so more games cannot fix it and the run is waste. Twenty-four games settle it in ~15 seconds.
 *
 * This does NOT silently switch anything on. Whether switching belongs in training is an open
 * question -- mew.js records it as a measured 10-point loss, on a measurement that predates the
 * post-KO scorer, the entry effects and the mega repair. The gate forces an explicit decision
 * instead of an accident. `--skip-preflight` overrides it. */
const FARM_FLAGS = ['--switching', '--switching2', '--greedy', '--greedy2', '--forced-switch',
  '--forced-switch2', '--joint', '--joint-zero'].filter(f => process.argv.includes(f));
/* THE SECOND ARM IS ADDED FOR YOU. --joint is per-arm: alone it turns the layer on for one side,
 * which is the A/B experiment, not a training configuration. Self-play trains ONE vector played by
 * both sides, so the mirror flag is implied rather than left to be remembered. */
if (JOINT && !FARM_FLAGS.includes('--joint2')) FARM_FLAGS.push('--joint2');
if (process.argv.includes('--joint-zero') && !FARM_FLAGS.includes('--joint-zero2')) FARM_FLAGS.push('--joint-zero2');
if (!process.argv.includes('--skip-preflight')) {
  const pf = spawnSync(process.execPath, [D('engine', 'preflight.js'), '--n', '24',
    '--weights', JOINT ? singlesFile : BASE,
    /* THE GATE MUST BE CHECKED UNDER THE FILES THE RUN WILL USE, for the same reason it is checked
     * under the run's FLAGS: a gate that certifies a different configuration is theatre. */
    ...(JOINT ? ['--joint-weights', BASE, '--joint-weights2', BASE] : []),
    ...FARM_FLAGS], { env: process.env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (pf.status !== 0) {
    process.stdout.write(pf.stdout || '');
    console.error('\nREFUSING TO START: preflight found a feature block that receives no gradient.');
    console.error('Training would run for hours and leave those weights exactly where they started.');
    console.error('Fix the flag, or pass --skip-preflight if you genuinely mean to train without it.');
    process.exit(1);
  }
}

const norm = (v) => Math.sqrt(v.reduce((a, x) => a + x * x, 0));
const writeWeights = (file, weights, meta) => {
  fs.writeFileSync(file, JSON.stringify(Object.assign({}, baseJson, {
    generated: new Date().toISOString(),
    by: 'engine/train_policy.js',
    features: B.FEATURES,
    /* Carried so the next reader can check the pair block the same way magnemite does. */
    jointFeatures: JOINT ? B.JOINT_FEATURES : baseJson.jointFeatures,
    weights,
    trainedFrom: path.relative(ROOT, BASE),
    training: meta,
    /* The fit's own uncertainty numbers describe the CLONE, not this. Dropping them rather than
     * letting a reader take a standard error from one model as if it belonged to another. */
    standardErrors: undefined, spread: undefined, heldOut: undefined,
  }), null, 1));
};

console.log(`SELF-PLAY POLICY IMPROVEMENT`);
console.log(`  from            ${path.relative(ROOT, BASE)}  (${w.length} weights${JOINT ? `: ${NF} singles + ${NJ} pair terms` : ''})`);
console.log(`  iterations      ${ITERS} x ${GAMES.toLocaleString()} games  (${(ITERS * GAMES).toLocaleString()} total)`);
console.log(`  trust region    ${TRUST}  (fraction of ||w|| moved per step)`);
console.log(`  anchor to clone ${ANCHOR || 'off'}`);
if (JOINT_ONLY) {
  console.log(`  SINGLES FROZEN  only the ${NJ} pair terms move; the ${NF} singles are bit-identical throughout,`);
  console.log(`                  so the head-to-head differs in the coordination block and nothing else`);
}
console.log(`  checkpoints     ${path.relative(ROOT, OUTDIR)}\n`);

const curFile = path.join(OUTDIR, 'current.json');
/* MAGNEMITE STILL CARRIES A 56-LENGTH `this.w` IN JOINT MODE. The pair path scores with
 * wj.slice(0, 56), but the forced-switch and team-preview paths read this.w. Handing it the stale
 * SHIPPED singles while the joint vector moved would put this run's own decisions out of sync with
 * the gradient it is accumulating by iteration 2. So the first 56 entries of the checkpoint are
 * mirrored out each iteration and passed as --weights. */
writeWeights(curFile, w, { iter: 0, note: 'copy of the starting clone' });
if (JOINT) writeSingles(w);

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
    '--policy', 'score', '--weights', JOINT ? singlesFile : curFile, '--learn', '--keep-shards',
    '--seed', String(seed), '--out', WORK,
    /* BOTH ARMS READ THIS ITERATION'S CHECKPOINT. Without it magnemite re-reads its hardcoded
     * data/policy-weights-joint.json every iteration: the pair terms would never move, and the flat
     * curve that produced would read as convergence. */
    ...(JOINT ? ['--joint-weights', curFile, '--joint-weights2', curFile] : []),
    /* THE SAME FLAGS THE PREFLIGHT WAS CHECKED UNDER. Passing a different set here than the gate
     * verified would make the gate theatre — it would certify a configuration this run does not
     * use, which is a more convincing version of the bug it exists to catch. */
    ...FARM_FLAGS,
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
    if (!Array.isArray(g.grad) || g.grad.length !== w.length) {
      /* Loud. Silently skipping every shard reported "no gradient came back", which points at the
       * farm rather than at the length -- the wrong diagnosis is what costs the hours. */
      console.error(`iteration ${it}: shard ${f} carries a ${(g.grad || []).length}-length gradient, `
        + `expected ${w.length}. That is a wiring mismatch, not a data problem.`);
      process.exit(1);
    }
    for (let k = 0; k < w.length; k++) grad[k] += g.grad[k];
    games += g.games || 0; decisions += g.decisions || 0; files++;
  }
  if (!files || !decisions) {
    console.error(`iteration ${it}: no gradient came back (${files} files, ${decisions} decisions). Stopping.`);
    process.exit(1);
  }

  /* THE FREEZE, applied to the GRADIENT rather than to the update, so that ||grad|| below is the
   * pair gradient and the trust region sizes the step to the block actually being moved. Zeroing
   * after the scale was computed would have left the same starved step with a tidier printout. */
  if (JOINT_ONLY) for (let k = 0; k < NF; k++) grad[k] = 0;
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
  if (JOINT) writeSingles(w);
  writeWeights(path.join(OUTDIR, `iter-${String(it).padStart(3, '0')}.json`), w, { iter: it, games, decisions, driftFromClone: drift });
  hist.push({ iter: it, games, decisions, gradNorm: gn, step: Math.sqrt(s2), drift });

  const secs = (Date.now() - t0) / 1000;
  console.log(`  iter ${String(it).padStart(3)}  ${games.toLocaleString()} games  ${decisions.toLocaleString()} decisions  ` +
              `|grad| ${gn.toFixed(1)}  step ${Math.sqrt(s2).toFixed(3)}  drift ${(100 * drift).toFixed(1)}%  ${secs.toFixed(0)}s`);
}

fs.writeFileSync(path.join(OUTDIR, 'history.json'), JSON.stringify({ base: path.relative(ROOT, BASE), iters: ITERS, games: GAMES, trust: TRUST, anchor: ANCHOR, seed: SEED0, hist }, null, 1));

/* WHAT MOVED. The point of a linear policy is that this is readable, so print it rather than making
 * somebody diff two JSON files. */
const NAMES = JOINT ? B.FEATURES.concat(B.JOINT_FEATURES) : B.FEATURES;
const delta = w.map((x, k) => ({ f: NAMES[k] || `#${k}`, from: wBC[k], to: x, d: x - wBC[k] }))
  .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
if (JOINT_ONLY) {
  /* Print ALL 18, not a top-12 slice. The block is small enough to read whole, and a slice is how a
   * block that barely moved gets reported as "the biggest changes were..." -- which is true and
   * useless. The norms below are the number that says whether the run did anything. */
  const NFq = NF;
  const pn = (v) => Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  const from = wBC.slice(NFq), to = w.slice(NFq);
  console.log(`\n  ALL ${NJ} PAIR TERMS (fitted to resemble -> trained to win)`);
  B.JOINT_FEATURES.map((f, i) => ({ f, a: from[i], b: to[i], d: to[i] - from[i] }))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
    .forEach(r => console.log(`    ${r.d >= 0 ? '+' : ''}${r.d.toFixed(3)}   ${r.f.padEnd(26)} ${r.a.toFixed(3)} -> ${r.b.toFixed(3)}`
      + (r.a * r.b < 0 ? '   SIGN FLIP' : '')));
  console.log(`\n    pair block moved ${pn(to.map((x, i) => x - from[i])).toFixed(3)} against its own length ${pn(from).toFixed(3)}`
    + ` (${(100 * pn(to.map((x, i) => x - from[i])) / pn(from)).toFixed(1)}%)`);
  console.log(`    singles moved    ${pn(w.slice(0, NFq).map((x, i) => x - wBC[i])).toFixed(3)}  <- must be 0.000, they were frozen`);
}
console.log(`\n  BIGGEST WEIGHT CHANGES (self-play vs the human clone)`);
for (const r of delta.slice(0, 12)) {
  console.log(`    ${r.d >= 0 ? '+' : ''}${r.d.toFixed(3)}   ${r.f.padEnd(20)} ${r.from.toFixed(3)} -> ${r.to.toFixed(3)}`);
}
console.log(`\n  -> ${path.relative(ROOT, curFile)}`);
console.log(`\n  NOTHING HAS BEEN MEASURED YET. Gate it against the clone it came from:`);
if (JOINT) {
  /* THE JOINT ARM IS GATED THROUGH --joint-weights, NOT --weights. Handing a 74-length checkpoint to
   * --weights would be rejected by magnemite's length check, and -- worse -- handing the 56-length
   * MIRROR to --weights while leaving --joint-weights at the shipped default would run a head-to-head
   * whose two arms differed in their singles and shared their pair terms. That is a real experiment
   * measuring the wrong lever, and it would have looked completely normal. */
  console.log(`     node engine/mew_farm.js --n 200000 --procs 6 --paired --policy score --policy2 score \\`);
  console.log(`       --weights ${path.relative(ROOT, singlesFile)} --weights2 ${path.relative(ROOT, singlesFile)} \\`);
  console.log(`       --joint --joint2 \\`);
  console.log(`       --joint-weights ${path.relative(ROOT, curFile)} --joint-weights2 ${path.relative(ROOT, BASE)} \\`);
  console.log(`       --greedy --greedy2 --seed <fresh> --out data/games.h2h-joint-trained.jsonl`);
  console.log(`     node engine/paired_h2h.js data/games.h2h-joint-trained.jsonl`);
  console.log(`\n  BOTH ARMS RUN THE PAIR PATH; ONLY THE 18 PAIR WEIGHTS DIFFER. Same top-K cap, same`);
  console.log(`  softmax over pairs, same singles on both sides -- so what is being measured is`);
  console.log(`  "pair terms trained to WIN" against "pair terms fitted to RESEMBLE", and nothing else.`);
} else {
  console.log(`     node engine/mew_farm.js --n 120000 --procs 6 --paired --policy score --policy2 score \\`);
  console.log(`       --weights ${path.relative(ROOT, curFile)} --weights2 ${path.relative(ROOT, BASE)} \\`);
  console.log(`       --greedy --greedy2 --seed <fresh> --out data/games.h2h-trained.jsonl`);
  console.log(`     node engine/paired_h2h.js data/games.h2h-trained.jsonl`);
}
