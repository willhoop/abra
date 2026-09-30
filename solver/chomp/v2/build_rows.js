/* solver/chomp/v2/build_rows.js — CHOMP v2's rows: v1's rows, row for row, with the v2 features added.
 *
 *   node solver/chomp/v2/build_rows.js --release eaa5becc54eb --team-store <dir> --v1-rows <v1 rows.jsonl>
 *        [--spreads solver/out/chomp/v2/spreads.json] [--human <games.jsonl>] [--corpus <dir>] [--shard K --shards N]
 *   -> solver/out/chomp/v2/rows-K.jsonl (+ rows-K.summary.json)      then  --merge N  -> rows.jsonl + rows.summary.json
 *   --plan       write the candidate list once (rows-plan.jsonl) and exit; --use-plan: a shard reads only its slice of it
 *
 * THE SAME DATA AND SPLITS AS v1 (solver/chomp/v2/preregistration.json `data.rule`). The three sources are walked in v1's
 * order with v1's skips (solver/chomp/v1/build_rows.js), and every candidate row is matched against v1's rows file at the
 * same index: src, split, pair, y, a, b and the species ids must agree, and v1's 22 features recomputed here on the flat
 * spread and the neutral field must equal v1's to its 4-decimal rounding. A mismatch THROWS.
 *
 * A row: { src, split, pair, y, a, b, sp, v1a, v1b (v1's features, copied from v1's file), fa, fb (flat+field, 40),
 *          sa, sb (set+field, 40) }.  a/b = option indices; "a" features are g(a|b) from p1's chair, "b" g(b|a) from p2's.
 * Shards are contiguous blocks of the row index (a team pair's targeted games are adjacent, so the fact memo is shared).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = k => argv.includes(k);
const ROOT = path.join(__dirname, '..', '..', '..');
const OUT = path.join(ROOT, 'solver', 'out', 'chomp', 'v2');
const r4 = x => Math.round(x * 1e4) / 1e4;

if (flag('--merge')) {
  const n = +flag('--merge');
  const fout = fs.openSync(path.join(OUT, 'rows.jsonl'), 'w');
  const sums = [];
  for (let k = 0; k < n; k++) {
    fs.writeSync(fout, fs.readFileSync(path.join(OUT, 'rows-' + k + '.jsonl')));
    sums.push(JSON.parse(fs.readFileSync(path.join(OUT, 'rows-' + k + '.summary.json'), 'utf8')));
  }
  fs.closeSync(fout);
  const total = sums.reduce((s, x) => s + x.rows, 0);
  const expect = sums[0].v1_rows_total;
  if (total !== expect) throw new Error('merge: ' + total + ' rows, v1 has ' + expect);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT, 'rows.jsonl'))).digest('hex');
  fs.writeFileSync(path.join(OUT, 'rows.summary.json'), JSON.stringify({ rows: total, sha256: sha, shards: sums }, null, 1));
  console.log('merged', total, 'rows', sha);
  process.exit(0);
}

require('../../arena/env.js');
const ENGINE = require('../../arena/engine.js').load(flag('--release'));
const O = require('../options.js');
const D = require('../data.js');
const S2 = require('./spreads.js');
const FXM = require('./features.js');
const PAIRS = require('../../mew/pairs.js');
/* --stage flat: only the table-stat-line features (fa/fb), to rows-flat-K.jsonl; --stage set: adds sa/sb to those rows
 * (rows-K.jsonl). No --stage: both in one pass. The v1 identity check runs wherever fa/fb are computed. */
const STAGE = flag('--stage', 'both');
const SPT = STAGE === 'flat' ? null : S2.table(flag('--spreads', path.join(OUT, 'spreads.json')));
const FXf = FXM.create(ENGINE.API, { mode: { spread: 'flat', field: true } });
const FXs = STAGE === 'flat' ? null : FXM.create(ENGINE.API, { mode: { spread: 'set', field: true }, spreads: SPT });
const V1 = FXM.V1_NAMES.length;
const shard = +flag('--shard', 0), shards = +flag('--shards', 1);
const corpus = flag('--corpus', 'C:/Users/willj/Projects/Pokemon/ABRA/solver/out/selfplay/eaa5becc54eb/p2v1-c0');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const u01 = s => crypto.createHash('sha256').update(String(s)).digest().readUInt32BE(0) / 4294967296;

/* v1's rows (the reference), and the candidate list in v1's order */
const v1file = flag('--v1-rows');
const v1 = fs.readFileSync(v1file, 'utf8').split('\n').filter(Boolean);
/* --plan: the candidate list (with each row's sheets) is written once to rows-plan.jsonl, so the shard workers read only
 * their slice of it instead of the 500 MB human dataset and the 236 MB pool each (--use-plan). */
const PLAN = path.join(OUT, 'rows-plan.jsonl'), PLAN_SUM = path.join(OUT, 'rows-plan.summary.json');
let cand = [], H = null;
if (has('--use-plan')) {
  const lines = fs.readFileSync(PLAN, 'utf8').split('\n').filter(Boolean);
  cand = new Array(lines.length);
  const n = lines.length, lo0 = Math.floor(n * shard / shards), hi0 = Math.floor(n * (shard + 1) / shards);
  for (let i = lo0; i < hi0; i++) cand[i] = JSON.parse(lines[i]);
  H = JSON.parse(fs.readFileSync(PLAN_SUM, 'utf8')).human;
} else {
H = D.headers(flag('--human', D.DEFAULT_FILE));
{
  const P = PAIRS.load({ teamStore: flag('--team-store') });
  const byId = new Map(); for (const s of ['train', 'val', 'test']) for (const G of P[s]) byId.set(G.id, G);
  const dir = path.join(path.dirname(v1file), 'gen');
  for (const f of fs.readdirSync(dir).filter(f => /^games-\d+\.jsonl$/.test(f)).sort()) {
    for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (!l) continue;
      let g; try { g = JSON.parse(l); } catch (e) { continue; }
      if (g.unbuildable || g.err || g.vA == null) continue;
      cand.push({ src: 'targeted', split: g.split, pair: 't:' + g.id, sheets: byId.get(g.id).sheets, y: g.vA, a: g.a, b: g.b });
    }
  }
}
{
  const man = JSON.parse(fs.readFileSync(path.join(corpus, 'manifest.json'), 'utf8'));
  for (const sh of man.shards) {
    const file = path.join(corpus, path.basename(sh.file));
    const buf = fs.readFileSync(file);
    if (sha(buf) !== sh.sha256) throw new Error('build_rows: corpus shard ' + file + ' does not match its manifest sha256');
    let txt; try { txt = zlib.gunzipSync(buf).toString(); } catch (e) { txt = zlib.gunzipSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString(); }
    for (const l of txt.split('\n')) {
      if (!l) continue;
      let g; try { g = JSON.parse(l); } catch (e) { continue; }
      if (g.err || g.vA == null) continue;
      const a = O.indexOf(g.brought.p1), b = O.indexOf(g.brought.p2);
      if (a < 0 || b < 0) continue;
      const u = u01('chomp1-corpus:' + g.id);
      cand.push({ src: 'selfplay', split: u < 0.1 ? 'val' : u < 0.2 ? 'test' : 'train', pair: 's:' + g.id, sheets: g.sheets, y: g.vA, a, b });
    }
  }
}
for (const G of H.games) {
  if (G.option.p1 < 0 || G.option.p2 < 0) continue;
  if (G.split.p1 !== G.split.p2) continue;
  if (G.winner !== 'p1' && G.winner !== 'p2') continue;
  cand.push({ src: 'human', split: G.split.p1, pair: 'h:' + G.id, sheets: G.sheets, y: G.winner === 'p1' ? 1 : 0, a: G.option.p1, b: G.option.p2 });
}
}
if (has('--plan')) {
  fs.writeFileSync(PLAN, cand.map(c => JSON.stringify(c)).join('\n') + '\n');
  fs.writeFileSync(PLAN_SUM, JSON.stringify({ rows: cand.length, human: { file: H.file, pool_sha256: H.pool_sha256 } }, null, 1));
  console.log('plan: ' + cand.length + ' candidate rows -> ' + PLAN);
  process.exit(0);
}
if (cand.length !== v1.length) throw new Error('build_rows: ' + cand.length + ' candidate rows, v1 has ' + v1.length);
const lo = Math.floor(cand.length * shard / shards), hi = Math.floor(cand.length * (shard + 1) / shards);
console.log('rows ' + cand.length + '; shard ' + shard + '/' + shards + ' = [' + lo + ', ' + hi + ')');

const outName = (STAGE === 'flat' ? 'rows-flat-' : 'rows-') + shard;
const fout = fs.openSync(path.join(OUT, outName + '.jsonl'), 'w');
const flatRows = STAGE === 'set' ? fs.readFileSync(path.join(OUT, 'rows-flat-' + shard + '.jsonl'), 'utf8').split('\n').filter(Boolean) : null;
if (flatRows && flatRows.length !== hi - lo) throw new Error('build_rows --stage set: rows-flat-' + shard + ' has ' + flatRows.length + ' rows, the shard has ' + (hi - lo));
const gA = new Float64Array(FXf.G_DIM), gB = new Float64Array(FXf.G_DIM);
const arr = g => Array.from(g, r4);
const C = { rows: 0, v1_checked: 0, max_abs_v1_diff: 0 };
const t0 = Date.now();
for (let i = lo; i < hi; i++) {
  const c = cand[i], R = JSON.parse(v1[i]);
  for (const k of ['src', 'split', 'pair', 'a', 'b']) if (R[k] !== c[k]) throw new Error('build_rows: row ' + i + ' ' + k + ' is ' + c[k] + ', v1 has ' + R[k]);
  if (Math.abs(R.y - c.y) > 1e-9) throw new Error('build_rows: row ' + i + ' label differs from v1');
  let row;
  if (flatRows) {
    row = JSON.parse(flatRows[i - lo]);
    for (const k of ['src', 'split', 'pair', 'a', 'b']) if (row[k] !== c[k]) throw new Error('build_rows --stage set: row ' + i + ' ' + k + ' differs from rows-flat');
  } else {
  const Ff = FXf.pairFacts(c.sheets);
  row = { src: c.src, split: c.split, pair: c.pair, y: c.y, a: c.a, b: c.b, sp: { A: R.sp.A, LA: R.sp.LA, B: R.sp.B, LB: R.sp.LB }, v1a: R.ga, v1b: R.gb };
  row.fa = arr(FXf.side(Ff, 'p1', c.a, c.b, gA)); row.fb = arr(FXf.side(Ff, 'p2', c.b, c.a, gB));
  const spA = O.OPTIONS[c.a].order.map(j => Ff.sp.p1[j]);
  if (spA.join() !== R.sp.A.join()) throw new Error('build_rows: row ' + i + ' species differ from v1');
  for (let k = 0; k < V1; k++) {
    const d1 = Math.abs(row.fa[k] - R.ga[k]), d2 = Math.abs(row.fb[k] - R.gb[k]);
    const dd = Math.max(d1, d2); if (dd > C.max_abs_v1_diff) C.max_abs_v1_diff = dd;
    if (dd > 1.01e-4) throw new Error('build_rows: row ' + i + ' feature ' + FXM.V1_NAMES[k] + ' is ' + row.fa[k] + '/' + row.fb[k] + ', v1 has ' + R.ga[k] + '/' + R.gb[k]);
  }
  C.v1_checked++;
  }
  if (FXs) { const Fs = FXs.pairFacts(c.sheets); row.sa = arr(FXs.side(Fs, 'p1', c.a, c.b, gA)); row.sb = arr(FXs.side(Fs, 'p2', c.b, c.a, gB)); }
  fs.writeSync(fout, JSON.stringify(row) + '\n');
  C.rows++;
  if (C.rows % 2000 === 0) console.log('  ' + C.rows + ' / ' + (hi - lo) + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
}
fs.closeSync(fout);
const summary = { shard, shards, lo, hi, rows: C.rows, v1_rows_total: v1.length, v1_rows_sha256: sha(fs.readFileSync(v1file)), release: ENGINE.id, stamp: ENGINE.stamp,
  human: { file: H.file, sha256: H.pool_sha256 }, used_plan: has('--use-plan'), stage: STAGE,
  spreads: SPT ? { file: SPT.file, provenance_sets: SPT.provenance.sets, counters: SPT.COUNTERS } : null,
  checks: C, features: { flat: FXf.COUNTERS, set: FXs ? FXs.COUNTERS : null }, g_names: FXf.G_NAMES, ms: Date.now() - t0 };
if (STAGE === 'set') summary.flat_stage = JSON.parse(fs.readFileSync(path.join(OUT, 'rows-flat-' + shard + '.summary.json'), 'utf8'));
fs.writeFileSync(path.join(OUT, outName + '.summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ rows: C.rows, checks: C, ms: Date.now() - t0 }));
