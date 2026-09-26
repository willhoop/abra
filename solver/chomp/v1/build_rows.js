/* solver/chomp/v1/build_rows.js — the scorer's training and test rows, from three sources, on one release.
 *
 *   node solver/chomp/v1/build_rows.js --release eaa5becc54eb --team-store <dir> [--human <games.jsonl>] [--corpus <dir>]
 *   -> solver/out/chomp/v1/rows.jsonl  + rows.summary.json
 *
 * One row per game: { src: targeted|selfplay|human, split: train|val|test, pair (the cluster: the team pair / game id),
 *   y (P1's result: 1, 0, or horizonScore on a capped game), a, b (the options played), ma, mb (the human-prior MODAL
 *   option of each sheet: gate (a)'s baseline), ga = g(a|b), gb = g(b|a), gma = g(ma|mb), gmb = g(mb|ma),
 *   sp: { A, LA, B, LB, mA, mLA, mB, mLB } species ids }.
 *
 * SOURCES AND SPLITS (solver/chomp/v1/preregistration.json):
 *   targeted  solver/out/chomp/v1/gen/games-*.jsonl; the split is the job's pair split
 *   selfplay  the p2v1-c0 corpus (TRAIN pairs only), every shard checked against its manifest sha256 first; held out by
 *             sha256(game id): < 10% val, < 20% test, else train
 *   human     the human dataset; both players TRAIN -> train, both VAL -> val, both TEST -> test, mixed -> dropped;
 *             only games with both options known (bring_complete) and a winner
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
require('../../arena/env.js');
const ROOT = path.join(__dirname, '..', '..', '..');
const ENGINE = require('../../arena/engine.js').load(flag('--release'));
const O = require('../options.js');
const D = require('../data.js');
const FX = require('./features.js').create(ENGINE.API);
const PAIRS = require('../../mew/pairs.js');

const OUT = path.join(ROOT, 'solver', 'out', 'chomp', 'v1');
const corpus = flag('--corpus', 'C:/Users/willj/Projects/Pokemon/ABRA/solver/out/selfplay/eaa5becc54eb/p2v1-c0');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const u01 = s => crypto.createHash('sha256').update(String(s)).digest().readUInt32BE(0) / 4294967296;
const r4 = x => Math.round(x * 1e4) / 1e4;

const H = D.headers(flag('--human', D.DEFAULT_FILE));
const HP = require('../human_prior.js').fit(H.games);
const modalCache = new Map();
const modal = sheet => { const k = JSON.stringify(sheet.map(r => [r.species, r.item])); if (!modalCache.has(k)) modalCache.set(k, HP.modal(sheet)); return modalCache.get(k); };

const ROWS = flag('--out', path.join(OUT, 'rows.jsonl'));
const fout = fs.openSync(ROWS, 'w');
const C = { targeted: {}, selfplay: {}, human: {}, factsFailed: 0, corpus_shards_verified: 0 };
const bump = (src, k) => { C[src][k] = (C[src][k] || 0) + 1; };
const gA = new Float64Array(FX.G_DIM), gB = new Float64Array(FX.G_DIM);
const arr = g => Array.from(g, r4);
function emit(src, split, pair, sheets, y, a, b) {
  let F;
  try { F = FX.pairFacts(sheets); } catch (e) { C.factsFailed++; bump(src, 'facts_failed'); return; }
  const ma = modal(sheets.p1), mb = modal(sheets.p2);
  const sp = (s, o) => ({ four: O.OPTIONS[o].order.map(i => F.sp[s][i]), leads: O.OPTIONS[o].leads.map(i => F.sp[s][i]) });
  const row = { src, split, pair, y, a, b, ma, mb };
  row.ga = arr(FX.side(F, 'p1', a, b, gA)); row.gb = arr(FX.side(F, 'p2', b, a, gB));
  row.gma = arr(FX.side(F, 'p1', ma, mb, gA)); row.gmb = arr(FX.side(F, 'p2', mb, ma, gB));
  const A = sp('p1', a), B = sp('p2', b), mA = sp('p1', ma), mB = sp('p2', mb);
  row.sp = { A: A.four, LA: A.leads, B: B.four, LB: B.leads, mA: mA.four, mLA: mA.leads, mB: mB.four, mLB: mB.leads };
  fs.writeSync(fout, JSON.stringify(row) + '\n');
  bump(src, split);
}

/* 1. targeted */
{
  const P = PAIRS.load({ teamStore: flag('--team-store') });
  const byId = new Map(); for (const s of ['train', 'val', 'test']) for (const G of P[s]) byId.set(G.id, G);
  const dir = path.join(OUT, 'gen');
  for (const f of fs.readdirSync(dir).filter(f => /^games-\d+\.jsonl$/.test(f)).sort()) {
    for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (!l) continue;
      let g; try { g = JSON.parse(l); } catch (e) { bump('targeted', 'torn'); continue; }
      if (g.unbuildable) { bump('targeted', 'unbuildable'); continue; }
      if (g.err || g.vA == null) { bump('targeted', 'error'); continue; }
      const G = byId.get(g.id);
      emit('targeted', g.split, 't:' + g.id, G.sheets, g.vA, g.a, g.b);
    }
  }
}
/* 2. self-play corpus */
{
  const man = JSON.parse(fs.readFileSync(path.join(corpus, 'manifest.json'), 'utf8'));
  for (const sh of man.shards) {
    const file = path.join(corpus, path.basename(sh.file));
    const buf = fs.readFileSync(file);
    if (sha(buf) !== sh.sha256) throw new Error('build_rows: corpus shard ' + file + ' does not match its manifest sha256');
    C.corpus_shards_verified++;
    let txt; try { txt = zlib.gunzipSync(buf).toString(); } catch (e) { txt = zlib.gunzipSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString(); bump('selfplay', 'torn_tail'); }
    for (const l of txt.split('\n')) {
      if (!l) continue;
      let g; try { g = JSON.parse(l); } catch (e) { bump('selfplay', 'torn'); continue; }
      if (g.err || g.vA == null) { bump('selfplay', 'error'); continue; }
      const a = O.indexOf(g.brought.p1), b = O.indexOf(g.brought.p2);
      if (a < 0 || b < 0) { bump('selfplay', 'no_option'); continue; }
      const u = u01('chomp1-corpus:' + g.id);
      emit('selfplay', u < 0.1 ? 'val' : u < 0.2 ? 'test' : 'train', 's:' + g.id, g.sheets, g.vA, a, b);
    }
  }
}
/* 3. human */
{
  for (const G of H.games) {
    if (G.option.p1 < 0 || G.option.p2 < 0) { bump('human', 'option_unknown'); continue; }
    if (G.split.p1 !== G.split.p2) { bump('human', 'mixed_split'); continue; }
    if (G.winner !== 'p1' && G.winner !== 'p2') { bump('human', 'no_winner'); continue; }   // the dataset writes the side
    emit('human', G.split.p1, 'h:' + G.id, G.sheets, G.winner === 'p1' ? 1 : 0, G.option.p1, G.option.p2);
  }
}
fs.closeSync(fout);
const summary = { release: ENGINE.id, stamp: ENGINE.stamp, human: { file: H.file, sha256: H.pool_sha256 }, human_prior: HP.meta, corpus, counters: C, features: FX.COUNTERS, g_names: FX.G_NAMES };
fs.writeFileSync(ROWS.replace(/.jsonl$/, '') + '.summary.json', JSON.stringify(summary, null, 1));
console.log(JSON.stringify(C));
