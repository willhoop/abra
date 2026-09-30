/* solver/tests/test-porygon2-v2.js — PORYGON2 v2: Node == Python, antisymmetry, member order, and (with --leaf) the wiring.
 *
 *   node solver/tests/test-porygon2-v2.js [--model <v2 json>] [--fixture <json>] [--leaf] [--no-red]   exit 0 GREEN, 1 RED
 *
 *   PARITY       every fixture row through infer.js equals export.py's float64 logit of the EXPORTED weights (<= 1e-9), and the
 *                fixture names the sha256 of THIS model file.
 *   ANTISYMMETRY swapping p1 and p2 (tokens, ids, side, facts, ratings, base negated) negates the logit (<= 1e-9).
 *   ORDER        permuting a side's six members leaves the logit (<= 1e-9).
 *   LEAF         (--leaf) solver/porygon2/leaf.js hands a v2 file to the v2 leaf, the leaf serves evaluations on real battles
 *                (its counter > 0), and its value equals the net on the encoded world.
 *   RED          unless --no-red: PORY2V2_INFER_BREAK=rating must turn this RED.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MODEL = path.resolve(ROOT, arg('--model', 'solver/porygon2/v2/model/porygon2-v2-k1.json'));
const FIX = path.resolve(ROOT, arg('--fixture', 'solver/tests/fixtures/porygon2-v2-agreement.json'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; if (fails <= 30) console.log('  FAIL ' + msg); } };

const NET = require('../porygon2/v2/infer.js').load(MODEL);
const fix = JSON.parse(fs.readFileSync(FIX, 'utf8'));
ok(fix.model.sha256 === sha(MODEL), 'fixture names model sha256 ' + fix.model.sha256.slice(0, 12) + ', file is ' + sha(MODEL).slice(0, 12));
let wp = 0, wa = 0, wo = 0;
const swapX = X => ({ tok: { p1: X.tok.p2, p2: X.tok.p1 }, ids: { p1: X.ids.p2, p2: X.ids.p1 }, side: { p1: X.side.p2, p2: X.side.p1 }, field: X.field,
  facts: { p1: X.facts.p2, p2: X.facts.p1 }, base: X.base.map(v => -v), rating: [X.rating[1], X.rating[0]] });
const permX = (X, p) => { const pm = a => p.map(i => a[i]); return Object.assign({}, X, { tok: { p1: pm(X.tok.p1), p2: X.tok.p2 }, ids: { p1: pm(X.ids.p1), p2: X.ids.p2 } }); };
for (const r of fix.rows) {
  const l = NET.logit(r.x);
  wp = Math.max(wp, Math.abs(l - r.python_logit));
  wa = Math.max(wa, Math.abs(l + NET.logit(swapX(r.x))));
  wo = Math.max(wo, Math.abs(l - NET.logit(permX(r.x, [3, 5, 0, 2, 4, 1]))));
}
ok(fix.rows.length >= 12, 'fixture rows ' + fix.rows.length);
ok(wp <= 1e-9, `PARITY worst |node - python| ${wp.toExponential(2)}`);
ok(wa <= 1e-9, `ANTISYMMETRY worst ${wa.toExponential(2)}`);
ok(wo <= 1e-9, `ORDER worst ${wo.toExponential(2)}`);
const out = { rows: fix.rows.length, parity_worst: wp, antisymmetry_worst: wa, order_worst: wo };

if (argv.includes('--leaf')) {
  const MAIN = 'C:/Users/willj/Projects/Pokemon/ABRA';
  if (!process.env.SHOWDOWN_PATH) { const sib = path.join(MAIN, '..', 'pokemon-showdown-mc'); if (fs.existsSync(path.join(sib, 'dist', 'sim'))) process.env.SHOWDOWN_PATH = sib; }
  require('../arena/env.js');
  const E = require('../arena/engine.js').load('eaa5becc54eb');
  const API = E.API, M = API.M;
  const LEAF = require('../porygon2/leaf.js').create(API, { model: MODEL });
  ok(LEAF.version === 'v2', 'solver/porygon2/leaf.js did not dispatch a v2 file to the v2 leaf (version ' + LEAF.version + ')');
  const TEAMS = require('../arena/teams.js');
  const POOL = [path.join(ROOT, 'data', 'team-pool-frozen-regmc'), path.join(MAIN, 'data', 'team-pool-frozen-regmc')].find(d => fs.existsSync(path.join(d, 'games.bo3.jsonl')));
  const PAIRS = require('../mew/pairs.js').load({ teamStore: POOL });
  let seedv = 99; const rnd = () => { seedv = (seedv * 1103515245 + 12345) >>> 0; return seedv / 4294967296; };
  let n = 0, worst = 0;
  for (let g = 0; g < 4; g++) {
    const G = PAIRS.test[(g * 11) % PAIRS.test.length];
    const a = TEAMS.buildTeam(M, G, 'p1'), b = TEAMS.buildTeam(M, G, 'p2');
    if (!a || !b) continue;
    const rng = API.makeRng(7000 + g);
    const S = API.newBattle(a.team, b.team, { rng });
    for (let t = 0; t < 6 && !API.isTerminal(S); t++) {
      const v = LEAF.value(S, G.sheets);
      const direct = NET.value(LEAF.encode(S, G.sheets));
      worst = Math.max(worst, Math.abs(v - direct)); n++;
      ok(v > 0 && v < 1, 'leaf value out of (0,1): ' + v);
      const pick = sd => { const la = API.legalActions(S, sd); return la.joint[Math.floor(rnd() * la.joint.length)]; };
      API.stepInPlace(S, pick('A'), pick('B'), rng);
    }
  }
  ok(n > 0 && LEAF.counters.evals >= n, `the v2 leaf served ${LEAF.counters.evals} evaluations on ${n} positions`);
  /* a MILTANK decision with the v2 file as its leaf model serves v2 leaf evaluations (the arena path) */
  {
    const G = PAIRS.test[3 % PAIRS.test.length];
    const a = TEAMS.buildTeam(M, G, 'p1'), b = TEAMS.buildTeam(M, G, 'p2');
    const S = API.newBattle(a.team, b.team, { rng: API.makeRng(8123) });
    const prior = require('../mag/infer.js').load();
    const PA2 = require('../miltank/prior_adapter.js').create(API, prior);
    const RO = require('../miltank/rollout.js').create(API, { buildBody: TEAMS.buildBody });
    const MT = require('../miltank/search.js').create(API, { prior: PA2, rollout: RO });
    const ctx = PA2.newGame(G);
    const before = RO.COUNTERS.leafPory2;
    const dd = MT.decide(API.clone(S), 'A', ctx, { budgetMs: 60000, maxPasses: 2, k1: 3, k2: 3, reserveSwitch: 1, depth: 0, leaf: 'pory2', leafModel: MODEL, coin: M.rngStreams({ seed: 5 }).any });
    const served = RO.COUNTERS.leafPory2 - before;
    ok(served > 0, `MILTANK served ${served} leaf evaluations with the v2 model`);
    ok(dd.info && (dd.info.forced || dd.info.playouts > 0), 'the MILTANK decision searched');
    out.miltank = { served, playouts: dd.info && dd.info.playouts };
  }
  ok(worst <= 1e-12, 'leaf value differs from the net on the encoded world by ' + worst);
  out.leaf = { positions: n, evals: LEAF.counters.evals, fallbacks: LEAF.counters.fallbacks, worst };
}
console.log(JSON.stringify(out));
if (!argv.includes('--no-red')) {
  const r = cp.spawnSync(process.execPath, [__filename, '--no-red', '--model', MODEL, '--fixture', FIX], { env: Object.assign({}, process.env, { PORY2V2_INFER_BREAK: 'rating' }), encoding: 'utf8' });
  ok(r.status === 1, 'PORY2V2_INFER_BREAK=rating did not turn the test RED (exit ' + r.status + ')');
  console.log('  deliberate break PORY2V2_INFER_BREAK=rating: ' + (r.status === 1 ? 'RED (as it must be)' : 'NOT RED'));
}
console.log(fails ? `RED ${checks - fails}/${checks}` : `GREEN ${checks}/${checks}`);
process.exit(fails ? 1 : 0);
