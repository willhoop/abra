/* solver/chomp/plan.js — CHOMP v0's evaluation, PRE-REGISTERED: the samples, the arms and the test, written down
 * before any table is scored or any game is played.
 *
 *   node solver/chomp/plan.js --release eaa5becc54eb [--out solver/out/chomp/v0/plan.json] [--eval 150] [--pairs 100]
 *        [--refine-pairs 12] [--seed 1]
 *
 * WRITES plan.json:
 *   eval       held-out sides for (a): one side per game, that side's player in the TEST split (the MAG/DODUO/
 *              PORYGON2 split, solver/chomp/data.js), picked by a seeded stride over the dataset
 *   pairs      team pairs for (b): BOTH players outside TRAIN (so neither PORYGON2 nor the human prior was fitted
 *              on either side), both whole fours known (the `human` arm plays them), all eight bodies build
 *   refine     the first `--refine-pairs` pairs, both sides, also solved WITH the MILTANK refinement
 *   jobs       every (game id, my side, refine?) CHOMP must solve; solver/chomp/tables.js fills them in shards
 *   arms, sprt the head-to-heads and the test, fixed here
 * and stamps the dataset digest, the release, the PORYGON2 model digest and every flag.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('../arena/env.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const D = require('./data.js');

const RELEASE = flag('--release', null);
if (!RELEASE) { console.error('plan: --release <id> is required (a measurement reads a frozen engine)'); process.exit(2); }
const OUT = path.resolve(flag('--out', path.join(ROOT, 'solver', 'out', 'chomp', 'v0', 'plan.json')));
const NEVAL = +flag('--eval', 150), NPAIRS = +flag('--pairs', 100), NREF = +flag('--refine-pairs', 12), SEED = +flag('--seed', 1);
const REFINE = { rows: 6, cols: 6, playouts: 12, depth: 2, leaf: 'pory2', k0: 8, rounds: 3 };

const ENGINE = require('../arena/engine.js').load(RELEASE);
const M = ENGINE.API.M;
const T = require('../arena/teams.js');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);

const H = D.headers(flag('--human', undefined));
const evalPool = H.games.filter(G => G.split.p1 === 'test' || G.split.p2 === 'test');
const evalGames = D.pick(evalPool, NEVAL, SEED).map(G => ({ id: G.id, side: G.split.p1 === 'test' ? 'p1' : 'p2' }));
const builds = G => ['p1', 'p2'].every(sd => G.sheets[sd].every(r => T.buildBody(M, r)));
const pairPool = H.games.filter(G => G.split.p1 !== 'train' && G.split.p2 !== 'train' && G.option.p1 >= 0 && G.option.p2 >= 0);
const pairs = [];
for (const G of D.pick(pairPool, Math.min(pairPool.length, Math.ceil(NPAIRS * 1.3)), SEED)) { if (pairs.length >= NPAIRS) break; if (builds(G)) pairs.push(G.id); }
if (pairs.length < NPAIRS) { console.error('plan: only ' + pairs.length + ' buildable pairs'); process.exit(1); }
const jobs = [];
for (const e of evalGames) jobs.push({ id: e.id, side: e.side, refine: false });
for (const id of pairs) for (const side of ['p1', 'p2']) if (!jobs.some(j => j.id === id && j.side === side && !j.refine)) jobs.push({ id, side, refine: false });
for (const id of pairs.slice(0, NREF)) for (const side of ['p1', 'p2']) jobs.push({ id, side, refine: true });

const plan = {
  written: new Date().toISOString(),
  status: 'PRE-REGISTERED — written before any CHOMP table was scored or any arena game played',
  release: RELEASE, engine_stamp: ENGINE.stamp,
  dataset: { file: H.file, pool_sha256: H.pool_sha256, scanned: H.scanned, kept: H.games.length, skipped: H.skipped },
  split: { rule: 'sha256("' + D.SALT + ':" + toID(player)) mod 100: <80 train, <90 val, else test (the MAG/DODUO/PORYGON2 split)' },
  models: { porygon2: sha(path.join(ROOT, 'solver', 'porygon2', 'model', 'porygon2-v0.json')), mag: sha(path.join(ROOT, 'solver', 'mag', 'model', 'mag-v1.json')),
            doduo: sha(path.join(ROOT, 'solver', 'mag', 'model', 'doduo-v1.json')) },
  chomp: { scorer: 'PORYGON2 v0 on the turn-1 position after the leads, back two revealed as a point belief (score.js mode revealed)', solver: 'SLOWKING solveLP', refine: REFINE },
  eval: { n: evalGames.length, pool: evalPool.length, seed: SEED, sides: evalGames,
          metrics: ['lead-pair top-1 (CHOMP modal option vs human)', 'lead-pair mass under the mix', 'option top-1 / top-5 (bring-complete sides)',
                    'option mass under the mix', 'regret of the human option in CHOMP\'s table: v* − win(human option vs their mix)'],
          baselines: ['uniform (1/15 lead pairs, 1/90 options)', 'human prior (solver/chomp/human_prior.js, fitted on TRAIN sides)'],
          note: 'a SANITY CHECK only (the brief): agreement with humans is not the objective, and is not a promotion test' },
  pairs: { n: pairs.length, pool: pairPool.length, seed: SEED, ids: pairs, ids_sha256: crypto.createHash('sha256').update(pairs.join('\n')).digest('hex').slice(0, 16) },
  refine_pairs: pairs.slice(0, NREF),
  jobs,
  arena: {
    in_battle_bot: 'doduo (MAG v1 + DODUO v1 joint argmax, greedy) on BOTH sides, so the preview is the only difference',
    games: 2 * pairs.length, cap: 60, seed: SEED,
    seating: 'paired: each team pair twice, arms swapped between the two sheets, on the same battle seed (solver/arena/arena.js)',
    arms: [
      { x: 'chomp', y: 'human', note: 'the human\'s own recorded bring and leads for that sheet in that game' },
      { x: 'chomp', y: 'hprior', note: 'the human-modal bring from the store (human_prior.js argmax)' },
      { x: 'chomp', y: 'random', note: 'four of six uniformly, leads uniformly' },
    ],
    chomp_play: 'the option is SAMPLED from the mix with a seeded coin per game and side, never the argmax',
  },
  sprt: { test: 'Wald SPRT on decisive games (draws dropped), H0 p = 0.50, H1 p = 0.55, alpha = beta = 0.05, bounds ±ln(19) = ±2.944',
          p0: 0.5, p1: 0.55, alpha: 0.05, beta: 0.05, read: 'ONCE, at the end of the 200 games; never an interim read. No bound crossed = INCONCLUSIVE at n' },
  exploitability: 'per solved matchup: the mix in its own table (the LP residual), vs greedy, maximin and uniform; on the refine pairs, the unrefined mix inside the refined table',
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(plan, null, 1));
console.log('plan: ' + evalGames.length + ' eval sides, ' + pairs.length + ' pairs (pool ' + pairPool.length + '), ' + jobs.length + ' jobs -> ' + OUT);
