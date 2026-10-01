/* solver/tests/test-porygon2-v3-evalset.js — the PORYGON2 v3 evaluation set and harness (solver/porygon2/v3/evalset.js).
 *
 *   node solver/tests/test-porygon2-v3-evalset.js [--dir solver/out/p2v3/evalset] [--v2data solver/out/p2v3/v2data] [--no-red]
 *   exit 0 GREEN, 1 RED
 *
 *   FROZEN       positions.jsonl.gz matches the sha256 its manifest recorded at build.
 *   LEAK         no game of the set is a TRAIN or VAL game of v2's tensors (v2's training data, and the student's: the student
 *                is distilled on exactly those rows), and no game of the set is in v1's human training dataset
 *                (solver/out/human/games.jsonl in the main checkout). bo1hi games are v2 TEST games; ladder games are none.
 *   ORIENT       deep.js steps a cell in ENGINE order: for a side-B position, successor(W, 'B', mine, theirs) equals stepping
 *                (theirs, mine) by hand, and differs from stepping (mine, theirs) wherever both are legal.
 *   LEAN         a deep playout's continuation under the lean binding gives the same result and length as a full one.
 *   CRN          the successor a net is scored on is a pure function of (position, cell, r): two calls give one digest.
 *   RED          unless --no-red, each of these must turn RED: P2V3_TEST_BREAK=leak (a v2 TRAIN game id joins the set's
 *                id list), P2V3_DEEP_BREAK=orient (deep.js stops swapping a side-B cell).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const cp = require('child_process');
const v8 = require('v8');
const ROOT = path.join(__dirname, '..', '..');
const MAIN = 'C:/Users/willj/Projects/Pokemon/ABRA';
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const DIR = path.resolve(ROOT, arg('--dir', 'solver/out/p2v3/evalset'));
const V2DATA = path.resolve(ROOT, arg('--v2data', 'solver/out/p2v3/v2data'));
const TB = process.env.P2V3_TEST_BREAK || '';
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; if (fails <= 30) console.log('  FAIL ' + msg); } };
const out = {};

/* ---- FROZEN ---- */
const man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
ok(sha(path.join(DIR, 'positions.jsonl.gz')) === man.output.sha256, 'FROZEN: positions.jsonl.gz does not match its manifest');
const rows = zlib.gunzipSync(fs.readFileSync(path.join(DIR, 'positions.jsonl.gz'))).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
ok(rows.length === man.positions && rows.length > 1000, 'FROZEN: ' + rows.length + ' positions vs manifest ' + man.positions);

/* ---- LEAK ---- */
const evalIds = new Set(rows.map(p => p.id));
const trainVal = new Map();
for (const fmt of ['bo1', 'bo3']) {
  const tdir = path.join(V2DATA, fmt, 'tensors');
  for (const s of fs.readdirSync(tdir).filter(s => /^s\d+$/.test(s))) {
    const meta = JSON.parse(fs.readFileSync(path.join(tdir, s, 'meta.json'), 'utf8'));
    for (const g of meta.games) if (g.split === 'train' || g.split === 'val') trainVal.set(g.id, g.split);
  }
}
ok(trainVal.size > 50000, 'LEAK: v2 train/val game list looks empty (' + trainVal.size + ')');
if (TB === 'leak') evalIds.add([...trainVal.keys()][0]);            // DELIBERATE BREAK
let leakV2 = 0; for (const id of evalIds) if (trainVal.has(id)) leakV2++;
ok(leakV2 === 0, 'LEAK: ' + leakV2 + ' evaluation games are v2 TRAIN/VAL games (v2 and the student trained on them)');
let leakV1 = 0, v1n = 0;
const human = path.join(MAIN, 'solver', 'out', 'human', 'games.jsonl');
if (fs.existsSync(human)) {
  /* ~500 MB: read in chunks (one string of it is past V8's limit); a line's game id is near its start */
  const fd = fs.openSync(human, 'r'), buf = Buffer.alloc(1 << 24);
  let carry = '', n;
  const scan = line => { const m = /"id":"([^"]+)"/.exec(line.slice(0, 400)); if (m) { v1n++; if (evalIds.has(m[1])) leakV1++; } };
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
    const parts = (carry + buf.toString('utf8', 0, n)).split('\n');
    carry = parts.pop();
    for (const l of parts) scan(l);
  }
  if (carry) scan(carry);
  fs.closeSync(fd);
}
ok(v1n > 20000, 'LEAK: v1 human dataset not read (' + v1n + ' games)');
ok(leakV1 === 0, 'LEAK: ' + leakV1 + ' evaluation games are in v1\'s human dataset');
out.leak = { eval_games: evalIds.size, v2_train_val_games: trainVal.size, v1_human_games: v1n, leak_v2: leakV2, leak_v1: leakV1 };

/* ---- ORIENT, LEAN, CRN (on the frozen positions, release eaa5becc54eb) ---- */
if (!process.env.SHOWDOWN_PATH) { const sib = path.join(MAIN, '..', 'pokemon-showdown-mc'); if (fs.existsSync(path.join(sib, 'dist', 'sim'))) process.env.SHOWDOWN_PATH = sib; }
require('../arena/env.js');
const E = require('../arena/engine.js').load('eaa5becc54eb');
const API = E.API;
const T = require('../arena/teams.js');
const prior = require('../mag/infer.js').load({ mag: path.join(ROOT, 'solver/machamp/models/gen5/mag-gen5.json'), doduo: path.join(ROOT, 'solver/machamp/models/gen5/doduo-gen5.json') });
const PA = require('../miltank/prior_adapter.js').create(API, prior);
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const MT = require('../miltank/search.js').create(API, { prior: PA, rollout: R });
const D = require('../porygon2/v3/deep.js').create(API, { PA, R, MT });
const DF = require('../porygon2/v3/deep.js').create(API, { PA, R, MT, lean: false });
const world = p => v8.deserialize(Buffer.from(p.S, 'base64'));
const ctxOf = p => ({ G: { sheets: p.sheets }, hist: p.hist });
const pick = (side, n) => rows.filter(p => p.label && p.side === side && p.n_legal > 1).slice(0, n);
let oriented = 0, swappedDiffers = 0, leanSame = 0, leanN = 0, crnSame = 0, crnN = 0;
for (const p of pick('B', 3).concat(pick('A', 1))) {
  const S = world(p), ctx = ctxOf(p);
  const c = D.candidates(S, p.side, ctx, 4, 4, 1); if (c.forced) continue;
  const W = D.world(S, p.side, ctx, 0, p.key);
  for (let i = 0; i < 2; i++) {
    const mine = c.rows[i], theirs = c.cols[i];
    const s1 = D.successor(W, p.side, mine, theirs, 0, p.key);
    const hand = API.clone(W);
    const [a, b] = p.side === 'A' ? [mine, theirs] : [theirs, mine];
    API.stepInPlace(hand, a, b, API.M.rngStreams({ seed: D.diceSeed(p.key, 0) }));
    if (API.digest(s1) === API.digest(hand)) oriented++; else ok(false, 'ORIENT: ' + p.key + ' cell ' + i + ' is not stepped in engine order');
    if (p.side === 'B') {
      let wrong = null; try { wrong = API.clone(W); API.stepInPlace(wrong, mine, theirs, API.M.rngStreams({ seed: D.diceSeed(p.key, 0) })); } catch (e) { wrong = null; }
      if (!wrong || API.digest(wrong) !== API.digest(s1)) swappedDiffers++;
    }
    const s2 = D.successor(W, p.side, mine, theirs, 0, p.key);
    crnN++; if (API.digest(s1) === API.digest(s2)) crnSame++;
    const lv = D.deepCell(W, p.side, mine, theirs, 0, p.key, ctx, 30), fv = DF.deepCell(W, p.side, mine, theirs, 0, p.key, ctx, 30);
    leanN++; if (lv.v === fv.v && lv.turns === fv.turns) leanSame++;
  }
}
ok(oriented >= 6, 'ORIENT: only ' + oriented + ' cells checked in engine order');
ok(swappedDiffers >= 3, 'ORIENT: the unswapped side-B step is indistinguishable (' + swappedDiffers + ')');
ok(crnN > 0 && crnSame === crnN, 'CRN: ' + crnSame + ' of ' + crnN + ' successors reproduce');
ok(leanN > 0 && leanSame === leanN, 'LEAN: ' + leanSame + ' of ' + leanN + ' lean playouts equal the full ones');
out.deep = { oriented, swapped_differs: swappedDiffers, crn: crnSame + '/' + crnN, lean: leanSame + '/' + leanN };

/* ---- RED ---- */
if (!argv.includes('--no-red') && !TB && !process.env.P2V3_DEEP_BREAK) {
  out.red = {};
  for (const [k, v] of [['P2V3_TEST_BREAK', 'leak'], ['P2V3_DEEP_BREAK', 'orient']]) {
    const r = cp.spawnSync(process.execPath, ['--max-old-space-size=3072', __filename, ...argv, '--no-red'], { env: Object.assign({}, process.env, { [k]: v }), encoding: 'utf8', maxBuffer: 64 << 20 });
    out.red[k + '=' + v] = r.status;
    ok(r.status === 1, 'RED: ' + k + '=' + v + ' should turn this test RED, exited ' + r.status);
  }
}

console.log(JSON.stringify(out, null, 1));
console.log((fails ? 'RED' : 'GREEN') + ` ${checks - fails}/${checks}`);
process.exit(fails ? 1 : 0);
