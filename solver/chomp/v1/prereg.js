/* solver/chomp/v1/prereg.js — CHOMP v1's PRE-REGISTRATION and the targeted-sample job list, written BEFORE any
 * targeted game is played, any scorer is fitted or any arena game is played.
 *
 *   node solver/chomp/v1/prereg.js --release eaa5becc54eb --team-store <main>/data/team-pool-frozen-regmc
 *        [--human <main>/solver/out/human/games.jsonl] [--train-pairs 2500]
 *   -> solver/chomp/v1/preregistration.json   (tracked: the gates, their parameters and every input's digest)
 *   -> solver/out/chomp/v1/gen/jobs.jsonl      (untracked: one line per targeted game)
 *
 * THE TARGETED SAMPLES (the counterfactual the self-play corpus lacks: its brings are the humans' own). A job is one
 * team pair of the frozen store with a bring/lead option drawn for EACH side, played to the end by DODUO greedy on both
 * sides (solver/chomp/v1/gen.js). Half the draws are uniform over the 90 options (every cell of the table is in the
 * data), half are drawn from the human prior (solver/chomp/human_prior.js, TRAIN sides) so the options a sensible
 * player considers are dense. TRAIN pairs train the scorer, VAL pairs select the arm and the epoch, TEST pairs are the
 * held-out set of gate (a) and are never fitted on. The split is the MAG/DODUO/PORYGON2 player split (solver/mew/pairs.js).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
require('../../arena/env.js');
const ROOT = path.join(__dirname, '..', '..', '..');
const O = require('../options.js');
const D = require('../data.js');
const PAIRS = require('../../mew/pairs.js');

const hash32 = s => crypto.createHash('sha256').update(String(s)).digest().readUInt32BE(0);
const u01 = s => hash32(s) / 4294967296;
const shaFile = f => { const h = crypto.createHash('sha256'); const fd = fs.openSync(f, 'r'), b = Buffer.alloc(1 << 22); let n; while ((n = fs.readSync(fd, b, 0, b.length, null)) > 0) h.update(b.subarray(0, n)); fs.closeSync(fd); return h.digest('hex'); };

function main() {
  const release = flag('--release', 'eaa5becc54eb');
  const store = flag('--team-store');
  const human = flag('--human', D.DEFAULT_FILE);
  const nTrain = +flag('--train-pairs', 2500);
  if (!store) throw new Error('prereg: --team-store is required');
  const P = PAIRS.load({ teamStore: store });
  const H = D.headers(human);
  const HP = require('../human_prior.js').fit(H.games);
  const draw = (sheet, key) => {
    if (u01(key + ':mix') < 0.5) return Math.floor(u01(key + ':u') * O.N);
    const p = HP.probs(sheet); let u = u01(key + ':p'), i = 0;
    for (; i < O.N - 1; i++) { u -= p[i]; if (u <= 0) break; }
    return i;
  };
  const jobs = [];
  const add = (split, list, per) => {
    for (const G of list) for (let k = 0; k < per; k++) {
      const key = split + ':' + G.id + ':' + k;
      jobs.push({ split, id: G.id, k, a: draw(G.sheets.p1, key + ':p1'), b: draw(G.sheets.p2, key + ':p2'), seed: hash32(key + ':seed') % 1000000007 });
    }
  };
  const trainPairs = PAIRS.pick(P.train, nTrain, 7);
  add('test', P.test, 16); add('val', P.val, 16); add('train', trainPairs, 8);
  /* interleave: test and val first, then train, so a run stopped early still holds every held-out game */
  const out = path.join(ROOT, 'solver', 'out', 'chomp', 'v1', 'gen');
  fs.mkdirSync(out, { recursive: true });
  const jf = path.join(out, 'jobs.jsonl');
  fs.writeFileSync(jf, jobs.map((j, i) => JSON.stringify(Object.assign({ job: i }, j))).join('\n') + '\n');
  const bo3 = JSON.parse(fs.readFileSync(path.join('C:', 'Users', 'willj', 'Projects', 'Pokemon', 'ABRA', 'solver', 'out', 'meta', 'bo3.json'), 'utf8'));

  const PR = {
    what: 'CHOMP v1 pre-registration (solver/chomp/v1/prereg.js). Written before any targeted game, any fit and any arena game.',
    written: new Date().toISOString(),
    engine_release: release,
    inputs: {
      team_store: { dir: store, file_sha256: P.file_sha256, pool_digest: P.pool_digest, split_counts: P.counts },
      human_dataset: { file: human, sha256: H.pool_sha256, games_kept: H.games.length },
      selfplay_corpus: { dir: 'C:/Users/willj/Projects/Pokemon/ABRA/solver/out/selfplay/eaa5becc54eb/p2v1-c0', rule: 'every shard is verified against manifest.json sha256 before it is read' },
      human_prior: HP.meta,
      bo3_rates: { file: 'solver/out/meta/bo3.json (main checkout)', input_sha256: bo3.input && bo3.input.sha256, same_four: { won: bo3.summary.by_previous_result.same_four.won, lost: bo3.summary.by_previous_result.same_four.lost }, same_lead_pair: { won: bo3.summary.by_previous_result.same_lead_pair.won, lost: bo3.summary.by_previous_result.same_lead_pair.lost } },
    },
    targeted_samples: {
      bot: 'DODUO greedy on both sides (solver/arena/bots.js greedy over MAG v1 + DODUO v1), omniscient, cap 40 turns (horizonScore decides a capped game, counted)',
      options: 'per side: with prob 1/2 uniform over the 90 options, else drawn from the human prior of that sheet',
      pairs: { test: P.test.length + ' x 16', val: P.val.length + ' x 16', train: trainPairs.length + ' x 8 (a seeded stride over the TRAIN pairs)' },
      jobs: jobs.length, jobs_file: 'solver/out/chomp/v1/gen/jobs.jsonl', jobs_sha256: shaFile(jf),
    },
    scorer: {
      question: 'P(side p1 wins | both open sheets, p1 option a, p2 option b)',
      family: 'antisymmetric: logit = tau_source * (h(g(a|b), g(b|a)) - h(g(b|a), g(a|b))); g = engine matchup aggregates of the brought four and the leads (MEDICHAM dmgRange/hitProb/effSpeed on the sheet bodies at the flat spread, mega forme where the sheet can mega) plus per-species bring and lead values',
      arms: { lin: 'h linear', mlp: 'h = one hidden layer of 32 (tanh)' },
      selection: 'the arm and the epoch with the lower VAL log-loss (targeted VAL games + corpus VAL fold + human VAL games), read once',
      sources: { targeted: 'tau fixed at 1', selfplay: 'tau learned', human: 'tau learned' },
      table_source: 'selfplay (the arena bot is gen5 MILTANK): each cell = sigmoid(tau_selfplay * logit)',
      splits: 'targeted: by pair split; corpus: 20% of TRAIN-pair games held out by sha256(pair id) (10% val, 10% test); human: both players TRAIN -> train, both VAL -> val, both TEST -> test',
    },
    gate_a: {
      question: 'does the scorer predict held-out outcomes better than the same family that sees only the human-modal bring',
      baseline: 'the same family (same arm selection rule), fitted with every side\'s option replaced by the human-prior MODAL option of its sheet, and evaluated at the modal options',
      metric: 'log-loss per game (label = the win, or horizonScore on a capped game); delta = LL(scorer) - LL(baseline); 95% CI by a bootstrap over TEAM PAIRS (2,000 resamples, seed 1)',
      sets: { T1: 'targeted games on TEST pairs', T2: 'corpus test fold', T3: 'human games, both players TEST, both options known (reported, not gated)' },
      pass: 'the CI upper bound of delta on T1 and T2 POOLED (clustered by pair) is below 0',
    },
    gate_b: {
      harness: 'solver/machamp/sprt.js --info honest, release ' + release + ', --team-store the frozen pool, --workers 3, --cap 50; X and Y are gen5 (solver/machamp/league/gen5.json, 1,000 ms) with a preview field',
      x: 'gen5 + preview chomp1 (CHOMP v1 mix, SAMPLED with a coin seeded per game and side)',
      y: 'gen5 + preview hprior (the human-modal option of its own sheet: the current opponent-blind preview)',
      screen: 'first a fixed 200-game match (100 pairs, seed 61) at 1 s through solver/mew/play.js --mode match --cycle; proceed to the SPRT iff the screen score is >= 0.500',
      sprt: { elo0: 0, elo1: 20, alpha: 0.05, beta: 0.05, max_games: 2000, seed: 67, read: 'once, at the bound or at the budget' },
      pass: 'SPRT accepts H1',
    },
    gate_c: { what: 'X = gen5 + chomp1 vs Y = gen5 + the humans\' own recorded bring of the pair (as v0), honest, 1 s, fixed 400 games (200 pairs, seed 71). Reported with a Wilson 95% interval; not a promotion test.' },
    bo3: {
      rule: 'games 2 and 3: their observed previous four F and leads L and their previous result r. Opponent model q = s4[r] * (sl[r] * delta(F,L) + (1 - sl[r]) * uniform over the other 5 lead pairs of F) + (1 - s4[r]) * (their equilibrium mix restricted to fours other than F, renormalised). s4 = same_four rate by previous result, sl = min(1, same_lead_pair / same_four), read from bo3.json at run time. Our mix = (1 - lambda) * our equilibrium mix + lambda * the best response to q, lambda = 0.5.',
      measured: 'in-table only: V(mix, q) against V(equilibrium, q) and the exploitability of the adjusted mix, on the gate (b) screen pairs. No bo3 arena exists; not a play-strength claim.',
    },
  };
  const pf = path.join(__dirname, 'preregistration.json');
  if (fs.existsSync(pf) && !argv.includes('--force')) throw new Error('prereg: ' + pf + ' exists; a pre-registration is written once');
  fs.writeFileSync(pf, JSON.stringify(PR, null, 1) + '\n');
  console.log('wrote', pf, 'jobs', jobs.length, 'test', P.test.length, 'val', P.val.length, 'train', trainPairs.length);
}
main();
