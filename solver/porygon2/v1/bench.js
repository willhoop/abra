/* solver/porygon2/v1/bench.js — what one leaf evaluation costs: gen5's PORYGON2 (v0 architecture) against v1 models, on the
 * SAME replayed self-play positions, in one process, interleaved round-robin so machine load hits every arm alike.
 *
 *   node solver/porygon2/v1/bench.js --release <id> --selfplay <dir> --models a.json,b.json[,…] [--positions 400] [--reps 3] [--out f.json]
 *
 * Per model: the total leaf cost (the honest producer + encode + the forward pass: exactly MILTANK's leaf call) and the forward
 * pass alone, median / mean / p95 in µs, after a warm-up pass over every position (V8 tier-up). The leaf is the lean-copy-free
 * path the search uses after a playout (a world S). One thread, one process.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
require('../../arena/env.js');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..', '..');
const ENGINE = require('../../arena/engine.js').load(arg('--release', null));
const API = ENGINE.API;
const PA = require('../../miltank/prior_adapter.js').create(API, null);
const RP = require('./replay.js').create(API, { PA });
const MODELS = String(arg('--models', 'solver/machamp/models/gen5/porygon2-gen5.json')).split(',').filter(Boolean);
const NPOS = +arg('--positions', 400), REPS = +arg('--reps', 3);
const LEAF = require('../leaf.js');

const dir = path.resolve(ROOT, arg('--selfplay'));
const pos = [];
outer: for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl\.gz$/.test(f)).sort()) {
  for (const line of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8').split('\n')) {
    if (!line) continue;
    const rec = JSON.parse(line);
    for (const p of RP.positions(rec, ENGINE.id)) { if (p.t % 2 === 0) pos.push({ S: API.clone(p.S), sheets: rec.sheets }); if (pos.length >= NPOS) break outer; }
  }
}
const arms = MODELS.map(m => ({ model: m, L: LEAF.create(API, { model: path.resolve(ROOT, m) }), tot: [], fwd: [] }));
for (const a of arms) for (const p of pos) a.L.value(p.S, p.sheets);                 // warm-up
const now = () => Number(process.hrtime.bigint()) / 1000;
for (let r = 0; r < REPS; r++) for (const p of pos) for (const a of arms) {
  let t = now(); const X = a.L.encode(p.S, p.sheets); const tEnc = now() - t;
  t = now(); a.L.net.value(X); const tF = now() - t;
  a.tot.push(tEnc + tF); a.fwd.push(tF);
}
const q = (v, p) => { const s = v.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const res = { what: 'PORYGON2 leaf cost per evaluation, µs (solver/porygon2/v1/bench.js)', engine_release: ENGINE.id, positions: pos.length, reps: REPS, selfplay: path.relative(ROOT, dir).split(path.sep).join('/'),
  arms: arms.map(a => ({ model: a.model, version: a.L.version || 'v0',
    total_us: { median: +q(a.tot, 0.5).toFixed(1), mean: +(a.tot.reduce((s, x) => s + x, 0) / a.tot.length).toFixed(1), p95: +q(a.tot, 0.95).toFixed(1) },
    forward_us: { median: +q(a.fwd, 0.5).toFixed(1), mean: +(a.fwd.reduce((s, x) => s + x, 0) / a.fwd.length).toFixed(1), p95: +q(a.fwd, 0.95).toFixed(1) } })) };
console.log(JSON.stringify(res, null, 1));
if (arg('--out', null)) fs.writeFileSync(path.resolve(ROOT, arg('--out')), JSON.stringify(res, null, 1));
