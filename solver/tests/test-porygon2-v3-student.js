/* solver/tests/test-porygon2-v3-student.js — the PORYGON2 v3 student: Node == Python, antisymmetry, member order, and the
 * leaf wiring with its per-model counter. Plays no game: the wiring check is ONE MILTANK decision on a frozen position.
 *
 *   node solver/tests/test-porygon2-v3-student.js [--model <student json>] [--fixture <json>] [--no-red]   exit 0 GREEN, 1 RED
 *
 *   PARITY       every fixture row through solver/porygon2/v3/infer.js equals student.py's float64 logit of the EXPORTED
 *                weights (<= 1e-9), and the fixture names the sha256 of THIS model file.
 *   ANTISYMMETRY swapping p1 and p2 (tokens, ids, side, facts, ratings, base negated) negates the logit (<= 1e-9).
 *   ORDER        permuting a side's six members leaves the logit (<= 1e-9).
 *   LEAF         solver/porygon2/leaf.js hands the student file to the v3 leaf; one MILTANK decision with that file as its
 *                leafModel (the league-spec path, solver/porygon2/v3/gen5-p2v3s.json) is served by it: the rollout's
 *                leafByModel counts the student's file name, the leaf's own counter shows evaluations > 0 and errors 0
 *                (the abra/regmc 1.50.0 counter), and the leaf equals the net on the encoded world.
 *   RED          unless --no-red: PORY2V3_INFER_BREAK=pool must turn this RED.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const v8 = require('v8');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..', '..');
const MAIN = 'C:/Users/willj/Projects/Pokemon/ABRA';
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MODEL = path.resolve(ROOT, arg('--model', 'solver/porygon2/v3/model/porygon2-v3-student.json'));
const FIX = path.resolve(ROOT, arg('--fixture', 'solver/tests/fixtures/porygon2-v3-student-agreement.json'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; if (fails <= 30) console.log('  FAIL ' + msg); } };

const NET = require('../porygon2/v3/infer.js').load(MODEL);
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

/* ---- LEAF: one MILTANK decision on a frozen evaluation position, the student as the leaf ---- */
if (!process.env.SHOWDOWN_PATH) { const sib = path.join(MAIN, '..', 'pokemon-showdown-mc'); if (fs.existsSync(path.join(sib, 'dist', 'sim'))) process.env.SHOWDOWN_PATH = sib; }
require('../arena/env.js');
const E = require('../arena/engine.js').load('eaa5becc54eb');
const API = E.API;
const L = require('../porygon2/leaf.js').create(API, { model: MODEL });
ok(L.version === 'v3-student', 'solver/porygon2/leaf.js did not dispatch the student file to the v3 leaf (version ' + L.version + ')');
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/porygon2/v3/gen5-p2v3s.json'), 'utf8'));
ok(path.resolve(ROOT, spec.pory2) === MODEL, 'the league spec gen5-p2v3s.json does not name this student file');
const T = require('../arena/teams.js');
const prior = require('../mag/infer.js').load({ mag: path.join(ROOT, spec.mag), doduo: path.join(ROOT, spec.doduo) });
const PA = require('../miltank/prior_adapter.js').create(API, prior);
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const MT = require('../miltank/search.js').create(API, { prior: PA, rollout: R });
const EV = path.join(ROOT, 'solver/out/p2v3/evalset/positions.jsonl.gz');
const rows = zlib.gunzipSync(fs.readFileSync(EV)).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(p => p.n_legal > 1).slice(0, 2);
let worst = 0;
for (const p of rows) {
  const S = v8.deserialize(Buffer.from(p.S, 'base64'));
  const r = MT.decide(API.clone(S), p.side, { G: { sheets: p.sheets }, hist: p.hist }, { budgetMs: 600000, maxPasses: 2, k1: spec.k1, k2: spec.k2, reserveSwitch: spec.reserveSwitch, depth: spec.depth,
    leaf: 'pory2', leafModel: MODEL, coin: API.M.rngStreams({ seed: 11 }).any });
  ok(r.info && !r.info.fallback && r.info.playouts > 0, 'LEAF: the decision did not search (' + JSON.stringify(r.info && { fallback: r.info.fallback, playouts: r.info.playouts }) + ')');
  worst = Math.max(worst, Math.abs(L.value(S, p.sheets) - NET.value(L.encode(S, p.sheets))));
}
const key = path.basename(MODEL);
const own = R.leafOwn()[key] || {};
ok((R.COUNTERS.leafByModel[key] || 0) > 0, 'LEAF: leafByModel shows no evaluation for ' + key + ' ' + JSON.stringify(R.COUNTERS.leafByModel));
ok(own.evals > 0 && own.evals === R.COUNTERS.leafByModel[key], 'LEAF: the student leaf counted ' + own.evals + ' evaluations against ' + R.COUNTERS.leafByModel[key] + ' calls');
ok(own.errors === 0, 'LEAF: ' + own.errors + ' errors');
ok(worst <= 1e-12, 'LEAF: the leaf differs from the net on the encoded world by ' + worst);
out.leaf = { by_model: R.COUNTERS.leafByModel, own, leaf_vs_net_worst: worst };

if (!argv.includes('--no-red') && !process.env.PORY2V3_INFER_BREAK) {
  const r = cp.spawnSync(process.execPath, [__filename, ...argv, '--no-red'], { env: Object.assign({}, process.env, { PORY2V3_INFER_BREAK: 'pool' }), encoding: 'utf8', maxBuffer: 64 << 20 });
  out.red = { 'PORY2V3_INFER_BREAK=pool': r.status };
  ok(r.status === 1, 'RED: PORY2V3_INFER_BREAK=pool should turn this test RED, exited ' + r.status);
}
console.log(JSON.stringify(out, null, 1));
console.log((fails ? 'RED' : 'GREEN') + ` ${checks - fails}/${checks}`);
process.exit(fails ? 1 : 0);
