/* solver/machamp/n7/build.js — the N7 learner's dataset, built from one generation's self-play chunks.
 *
 *   node solver/machamp/n7/build.js --chunks <dir1,dir2,...> --out <dir> [--val-mod 10] [--seed n7val]
 *
 * READS each chunk's manifest.json (solver/mew/run.js) and REFUSES a chunk whose shards do not hash to the manifest's sha256s
 * (a half-written or edited chunk never reaches training), or whose run did not record N7 targets (flags.n7).
 *
 * WRITES <out>.tmp/ and renames it to <out>/ only when complete (a crash leaves no half dataset under the final name):
 *   rows.jsonl.gz   one row per RECORDED FULL DECISION'S VIEW (solver/mew/play.js feats: the decider's own view at turn t):
 *     { gid, t, side, split, X,             gid = "<run_seed>:<g>", X = that view encoded (p1's frame), split train|val
 *       z,                                  the outcome for p1 (1 / 0 / 0.5; a capped game: the engine's HP rule, counted)
 *       aux: { mat, hpd, tl },              final alive p1 - p2 + 4 (0..8), final HP fraction p1 - p2, turns-left bin (0,1,2,3-4,5+):
 *                                           the v2 / student auxiliary heads' definitions (solver/porygon2/v2/encode.js)
 *       sv: [sv1, sv3],                     SHORT-HORIZON SEARCH VALUES (KataGo's auxiliary form, DESIGN §3): the lambda-return
 *                                           (1 - l) sum_k l^k V_k + l^n z over the root values V of this and every later turn
 *                                           (p1's frame; a turn both sides searched averages the two), l = h / (h + 1) for
 *                                           horizons h = 1 and 3 turns. Fast-search roots count (they are root values too).
 *       am: [4] | null,                     the answer-map summary (amSummary) when that turn was mapped
 *       dec: [{ side, K, lp, bits, t }] }   each FULL decision's policy target (solver/machamp/n7/policy.js target)
 *   manifest.json   every input (chunk manifests and shard sha256s), the counts, the split rule, the label definitions, the
 *                   output's sha256, the code digests.
 *
 * VAL is a seeded 1-in-<val-mod> share of GAMES (never of positions: a game's positions share one outcome).
 * DELIBERATE BREAK (env N7_BUILD_BREAK=split): the split is drawn per position, so one game straddles train and val —
 * test-n7-loop.js MANIFEST must go red (it checks no game id is in both).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.N7_BUILD_BREAK) || '';
const ROOT = path.join(__dirname, '..', '..', '..');
const shaBuf = b => crypto.createHash('sha256').update(b).digest('hex');
const shaFile = f => shaBuf(fs.readFileSync(f));
const h32 = s => crypto.createHash('sha256').update(String(s)).digest().readUInt32BE(0);
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

/* the answer map (answer_map.js answerMap(S, 'A')) summarised p1-first, each in [0, 1]:
 *   [ min over p2's live threats of p1's expected answers / 4,  share of p2's threats with < 0.5 answers left,
 *     min over p1's live members of p2's expected answers / 4,  share of p1's members p2 has < 0.5 answers to ]
 * answers[j] = sum_i P[i][j] (p1's answers to p2's j); threats[i] = sum_j (1 - P[i][j]) (p2's answers to p1's i). */
function amSummary(map) {
  const a = map.answers || [], th = map.threats || [];
  const min = v => (v.length ? Math.min(...v) : 0);
  return [min(a) / 4, a.length ? a.filter(x => x < 0.5).length / 4 : 0, min(th) / 4, th.length ? th.filter(x => x < 0.5).length / 4 : 0].map(v => +v.toFixed(5));
}

const tlBin = tl => (tl <= 0 ? 0 : tl === 1 ? 1 : tl === 2 ? 2 : tl <= 4 ? 3 : 4);
function lambdaReturn(vals, z, lam) {
  let g = 0, w = 1;
  for (const v of vals) { g += (1 - lam) * w * v; w *= lam; }
  return g + w * z;
}
const HORIZONS = [1, 3];

function readChunk(dir) {
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  if (!man.flags || !man.flags.n7) throw new Error('n7/build: chunk ' + dir + ' did not record N7 targets (flags.n7 false)');
  const shards = [];
  for (const s of man.shards) {
    const f = path.resolve(ROOT, s.file);
    const got = fs.existsSync(f) ? shaFile(f) : null;
    if (!s.sha256 || got !== s.sha256) throw new Error(`n7/build: shard ${s.file} does not match its manifest (manifest ${s.sha256}, disk ${got}) — the chunk is not trusted`);
    shards.push({ file: f, sha256: got });
  }
  return { man, manifest_sha256: shaFile(path.join(dir, 'manifest.json')), shards };
}
function gamesOf(file) {
  return zlib.gunzipSync(fs.readFileSync(file)).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

function build(o) {
  const out = path.resolve(ROOT, o.out), tmp = out + '.tmp';
  if (fs.existsSync(out)) throw new Error('n7/build: ' + out + ' exists (a finished dataset is never overwritten)');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const valMod = o.valMod || 10, seed = o.seed || 'n7val';
  const chunks = o.chunks.map(d => Object.assign({ dir: rel(path.resolve(ROOT, d)) }, readChunk(path.resolve(ROOT, d))));
  const releases = [...new Set(chunks.map(c => c.man.engine_release))];
  if (releases.length !== 1) throw new Error('n7/build: chunks from more than one engine release: ' + releases.join(', '));
  const C = { games: 0, games_error: 0, games_capped: 0, games_no_feats: 0, positions: 0, positions_val: 0, decisions: 0, decisions_val: 0, am: 0,
    pt_unmapped_mass: 0, games_val: 0, games_train: 0, z_sum: 0, vt: 0 };
  const rowsFile = path.join(tmp, 'rows.jsonl.gz');
  fs.writeFileSync(rowsFile, '');
  const seenGid = new Set();
  const splitOfGame = new Map();
  for (const ch of chunks) for (const sh of ch.shards) for (const g of gamesOf(sh.file)) {
    const gid = `${g.run_seed}:${g.g}`;
    if (seenGid.has(gid)) throw new Error('n7/build: game ' + gid + ' appears twice (two chunks with one seed)');
    seenGid.add(gid);
    C.games++;
    if (g.err || g.vA == null) { C.games_error++; continue; }
    if (!g.n7 || !g.n7.feats || !g.n7.feats.length) { C.games_no_feats++; continue; }
    if (g.capped) C.games_capped++;
    const z = g.vA;
    const split = (h32(seed + ':' + gid) % valMod) === 0 ? 'val' : 'train';
    splitOfGame.set(gid, split);
    if (split === 'val') C.games_val++; else C.games_train++;
    /* the p1-frame root value per turn, from every searched decision */
    const byT = new Map();
    for (const v of g.n7.vt || []) { const a = byT.get(v.t) || []; a.push(v.side === 'A' ? v.v : 1 - v.v); byT.set(v.t, a); C.vt++; }
    const vturns = [...byT.keys()].sort((a, b) => a - b).map(t => ({ t, v: byT.get(t).reduce((p, q) => p + q, 0) / byT.get(t).length }));
    const E = g.n7.end;
    const am = new Map((g.n7.am || []).map(a => [a.t, a.y]));
    const decAt = new Map();
    /* a feats row is one decider's view (t, side) and carries that decision's target; a row written before the view
     * encoding (no side) carries every decision of its turn */
    const dk = (t, side) => t + ':' + (side || '*');
    for (const d of g.decisions || []) if (d.pt) {
      const it = { side: d.side, K: d.pt.K, lp: d.pt.lp, bits: d.pt.bits, t: d.pt.t };
      for (const k of [dk(d.t, d.side), dk(d.t)]) { const a = decAt.get(k) || []; a.push(it); decAt.set(k, a); }
      C.pt_unmapped_mass += d.pt.unmapped_mass || 0;
    }
    const lines = [];
    for (const f of g.n7.feats) {
      const later = vturns.filter(x => x.t >= f.t).map(x => x.v);
      const sv = HORIZONS.map(h => +lambdaReturn(later, z, h / (h + 1)).toFixed(5));
      const aux = E ? { mat: Math.max(0, Math.min(8, E.A.alive - E.B.alive + 4)), hpd: +(E.A.hp - E.B.hp).toFixed(4), tl: tlBin(g.turns - (f.t + 1)) } : null;
      const pSplit = BREAK === 'split' ? ((h32(seed + ':' + gid + ':' + f.t) % valMod) === 0 ? 'val' : 'train') : split;
      const dec = decAt.get(dk(f.t, f.side)) || [];
      lines.push(JSON.stringify({ gid, t: f.t, side: f.side || null, split: pSplit, X: f.X, z, aux, sv, am: am.has(f.t) ? am.get(f.t) : null, dec }));
      C.positions++; if (pSplit === 'val') C.positions_val++;
      C.decisions += dec.length; if (pSplit === 'val') C.decisions_val += dec.length;
      if (am.has(f.t)) C.am++;
      C.z_sum += z;
    }
    if (lines.length) fs.appendFileSync(rowsFile, zlib.gzipSync(Buffer.from(lines.join('\n') + '\n')));   // one gzip member per game
  }
  const body = fs.readFileSync(rowsFile);
  const CODE = ['solver/machamp/n7/build.js', 'solver/machamp/n7/policy.js', 'solver/mew/play.js', 'solver/mew/agent.js', 'solver/porygon2/v2/features.js', 'solver/gary/situation.js'];
  const manifest = {
    what: 'N7 dataset (solver/machamp/n7/build.js): one row per self-play position with a FULL search decision',
    built: new Date().toISOString(), engine_release: releases[0],
    inputs: chunks.map(c => ({ dir: c.dir, manifest_sha256: c.manifest_sha256, games: c.man.counts.games, flags: c.man.flags, shards: c.shards.map(s => ({ file: rel(s.file), sha256: s.sha256 })) })),
    split: { unit: 'game', rule: `sha256("${seed}:" + gid) mod ${valMod} == 0 -> val`, val_mod: valMod, seed, break: BREAK || null },
    labels: { z: 'p1 outcome (vA); capped games carry the engine HP rule', aux: 'mat = alive p1 - p2 + 4 (0..8); hpd = HP fraction p1 - p2; tl = turns-left bin 0,1,2,3-4,5+ (turn number t + 1)',
      sv: 'lambda-returns over later root values then z, lambda = h/(h+1), h = ' + HORIZONS.join(', '), am: 'amSummary of answer_map.js (offline target, never an input)',
      dec: 'policy target: the search row mix on DODUO valid cells (solver/machamp/n7/policy.js target)' },
    counts: Object.assign({}, C, { z_mean: C.positions ? +(C.z_sum / C.positions).toFixed(4) : null }),
    output: { file: 'rows.jsonl.gz', sha256: shaBuf(body), bytes: body.length },
    code: Object.fromEntries(CODE.map(f => [f, shaFile(path.join(ROOT, f)).slice(0, 16)])),
  };
  delete manifest.counts.z_sum;
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(manifest, null, 1));
  fs.renameSync(tmp, out);
  return manifest;
}

/* verify a finished dataset: its rows hash to its manifest, and no game straddles the split */
function verify(dir) {
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const body = fs.readFileSync(path.join(dir, man.output.file));
  const problems = [];
  if (shaBuf(body) !== man.output.sha256) problems.push('rows.jsonl.gz does not hash to its manifest');
  const split = new Map();
  for (const l of zlib.gunzipSync(body).toString('utf8').split('\n')) {
    if (!l) continue;
    const r = JSON.parse(l);
    const s = split.get(r.gid);
    if (s && s !== r.split) problems.push('game ' + r.gid + ' is in both train and val');
    split.set(r.gid, r.split);
  }
  return { ok: !problems.length, problems: problems.slice(0, 10), manifest: man };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  try {
    if (argv[0] === 'verify') { const v = verify(path.resolve(ROOT, flag('--dir'))); console.log(JSON.stringify({ ok: v.ok, problems: v.problems })); process.exit(v.ok ? 0 : 1); }
    const m = build({ chunks: String(flag('--chunks', '')).split(',').filter(Boolean), out: flag('--out'), valMod: +flag('--val-mod', 10), seed: flag('--seed', 'n7val') });
    console.log(JSON.stringify(m.counts));
    process.exit(0);
  } catch (e) { console.error(e && e.stack || e); process.exit(1); }
}

module.exports = { build, verify, amSummary, lambdaReturn, tlBin, HORIZONS };
