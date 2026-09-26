/* solver/chomp/v1/gen.js — play the targeted preview samples: one team pair, one option per side, DODUO greedy on both
 * sides, to the end (or the cap). The jobs are solver/chomp/v1/prereg.js's; this file decides nothing about them.
 *
 *   node solver/chomp/v1/gen.js --release eaa5becc54eb --team-store <dir> --shard K --shards N [--cap 40]
 *   -> solver/out/chomp/v1/gen/games-K.jsonl   one line per finished job (appended; a restart skips finished jobs)
 *
 * Omniscient (the arena's DODUO bot reads the true battle), which is what "short playouts" asks for: the point is
 * the bring's value under a fixed, fast, reasonable policy, not the belief machinery. Every game is counted
 * (errors, capped, unbuildable) and the DODUO adapter's counters are written on every line, so a run whose adapter
 * matched nothing cannot pass for a run that played.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
require('../../arena/env.js');
const ROOT = path.join(__dirname, '..', '..', '..');
const REL = flag('--release');
if (!REL) { console.error('gen: --release is required'); process.exit(2); }
const ENGINE = require('../../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../../arena/teams.js');
const O = require('../options.js');
const PAIRS = require('../../mew/pairs.js');
const { makeBots } = require('../../arena/bots.js');
const PA = require('../../miltank/prior_adapter.js').create(API, require('../../mag/infer.js').load());
const B = makeBots(API, {});
const bot = B.greedy('doduo', PA);

const SHARD = +flag('--shard', 0), SHARDS = +flag('--shards', 1), CAP = +flag('--cap', 40);
const dir = path.join(ROOT, 'solver', 'out', 'chomp', 'v1', 'gen');
const jobs = fs.readFileSync(path.join(dir, 'jobs.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const out = path.join(dir, 'games-' + SHARD + '.jsonl');
const done = new Set();
if (fs.existsSync(out)) for (const l of fs.readFileSync(out, 'utf8').split('\n')) { if (!l) continue; try { done.add(JSON.parse(l).job); } catch (e) { /* a torn last line: replayed */ } }
const P = PAIRS.load({ teamStore: flag('--team-store') });
const byId = new Map();
for (const s of ['train', 'val', 'test']) for (const G of P[s]) byId.set(G.id, G);
const C = { games: 0, errors: 0, capped: 0, unbuildable: 0, missing: 0, skipped_done: done.size };
const t0 = Date.now();
for (const j of jobs) {
  if (j.job % SHARDS !== SHARD || done.has(j.job)) continue;
  const G0 = byId.get(j.id);
  if (!G0) { C.missing++; continue; }
  const G = Object.assign({}, G0, { brought: { p1: O.OPTIONS[j.a].order.slice(), p2: O.OPTIONS[j.b].order.slice() } });
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  if (!a || !b) { C.unbuildable++; fs.appendFileSync(out, JSON.stringify({ job: j.job, unbuildable: true }) + '\n'); continue; }
  const rng = API.makeRng(j.seed);
  const S = API.newBattle(a.team, b.team, { rng });
  const ctx = PA.newGame(G);
  let err = null;
  try {
    while (!API.isTerminal(S) && S.turn < CAP) {
      const cA = bot.choose(S, 'A', ctx), cB = bot.choose(S, 'B', ctx);
      PA.record(ctx, S, cA.joint, cB.joint);
      API.stepInPlace(S, cA.joint, cB.joint, rng);
    }
  } catch (e) { err = String(e && e.message || e).slice(0, 200); }
  let vA = null, capped = false;
  if (!err) { if (API.isTerminal(S)) vA = API.winner(S); else { vA = API.horizonScore(S); capped = true; C.capped++; } } else C.errors++;
  C.games++;
  fs.appendFileSync(out, JSON.stringify({ job: j.job, split: j.split, id: j.id, a: j.a, b: j.b, seed: j.seed, vA, capped, turns: S.turn, err,
    ctr: C.games % 50 === 0 ? { pa: { calls: PA.COUNTERS.calls, nullDecision: PA.COUNTERS.nullDecision, optionsMatched: PA.COUNTERS.optionsMatched, optionsUnmatched: PA.COUNTERS.optionsUnmatched } } : undefined }) + '\n');
  if (C.games % 200 === 0) console.log(`[gen ${SHARD}] ${C.games} games  errors ${C.errors}  capped ${C.capped}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
fs.writeFileSync(out.replace(/\.jsonl$/, '.summary.json'), JSON.stringify({ release: ENGINE.id, stamp: ENGINE.stamp, shard: SHARD, shards: SHARDS, cap: CAP, counters: C,
  pa: { calls: PA.COUNTERS.calls, nullDecision: PA.COUNTERS.nullDecision, optionsMatched: PA.COUNTERS.optionsMatched, optionsUnmatched: PA.COUNTERS.optionsUnmatched },
  pool: { file: P.file, file_sha256: P.file_sha256, pool_digest: P.pool_digest }, wall_s: (Date.now() - t0) / 1000 }, null, 1));
console.log(`[gen ${SHARD}] done ${JSON.stringify(C)}`);
