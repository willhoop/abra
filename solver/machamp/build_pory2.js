/* ABRA-HEAP: 3072
 * solver/machamp/build_pory2.js — PORYGON2's self-play training tensors: every public position of every self-play
 * game, encoded by the SAME features.js encode() the leaf and the human tensors use, on the SAME frozen release,
 * with a BLENDED value target.
 *
 *   node solver/machamp/build_pory2.js --release <id> --selfplay <dir>[,<dir>…] --out <dir> [--lambda 0.5]
 *        [--max-unfilled 0.5] [--val-pct 10]
 *
 * One row per position (the public state before a turn, from the game's recorded history), stored ONCE with
 * both sides like the human tensors (solver/porygon2/build_dataset.js — same files, same column meaning):
 *   z   the game's result for p1 (1 win, 0 loss; a capped game's HP rule gives its fraction)
 *   v   the SEARCH's root value for p1 at that position: the mean of the two roots that turn (side A's value, and
 *       1 − side B's), over the roots whose matrix was at most --max-unfilled empty; NaN when no root qualifies
 *   target = λ·v + (1 − λ)·z   (z alone where v is NaN) — the learning report's blended target (§0, point 3)
 * Files: tok_num.f32 tok_id.i32 side.f32 field.f32 facts.f32 base.f32 meta.i32 (as the human build) plus
 *        z.f32 v.f32 target.f32; meta.json carries the id vocabulary (strings -> the ids in tok_id), the sources'
 *        digests and the release stamp. Split: --val-pct of GAMES (hash of the game) go to val (meta column 3 = 1).
 *
 * THE RELEASE IS REQUIRED: the damage-race facts are MEDICHAM's answers and must come from the release the games
 * were played on. A shard recorded on another release is refused, not mixed in.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
require('../arena/env.js');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const REL_ID = arg('--release', null);
if (!REL_ID) { console.error('build_pory2: --release is required'); process.exit(2); }
const ENGINE = require('../arena/engine.js').load(REL_ID);
const FX = require('../porygon2/features.js');
const ROOT = path.join(__dirname, '..', '..');
const DIRS = String(arg('--selfplay', '')).split(',').filter(Boolean).map(d => path.resolve(ROOT, d));
const OUT = path.resolve(ROOT, arg('--out', 'solver/out/machamp/pory2'));
const LAMBDA = +arg('--lambda', 0.5), MAXUNF = +arg('--max-unfilled', 0.5), VALPCT = +arg('--val-pct', 10);
/* --deep <dir>: solver/machamp/deep_value.js output. With it the target's value half is the DEEP rollout value (an
 * independent estimate: 3 turns of human-clone play, then frozen PORYGON2 v0), never the search's root value, which at
 * depth 0 is the trained net's own opinion one turn ahead. The search value is still written to v.f32 for reference. */
const DEEP = arg('--deep', null);
const deepMap = new Map();
/* --deep takes a comma-separated list of deep_value.js output directories (keys carry the self-play dir, so they pool) */
if (DEEP) for (const dd of DEEP.split(',').filter(Boolean)) for (const f of fs.readdirSync(path.resolve(ROOT, dd)).filter(f => /^deep-\d+\.jsonl$/.test(f)))
  for (const l of fs.readFileSync(path.join(path.resolve(ROOT, dd), f), 'utf8').split('\n')) if (l) { const o = JSON.parse(l); deepMap.set(o.dir + '|' + o.g + '|' + o.run_seed + '|' + o.t, o.v); }
/* DELIBERATE BREAK (env MACHAMP_BREAK=vside): side B's root value is used as p1's without the flip.
 * solver/tests/test-machamp.js TARGETS must go red. */
const BREAK = process.env.MACHAMP_BREAK || '';
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const isVal = id => crypto.createHash('sha256').update('machamp-val:' + id).digest().readUInt32BE(0) % 100 < VALPCT;
const META_COLS = ['game', 'turn', 'winner', 'split', 'unused', 'turns_played', 'has_v', 'last_turn'];

function* records(dir) {
  for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl\.gz$/.test(f)).sort()) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8');
    for (const line of txt.split('\n')) if (line) yield JSON.parse(line);
  }
}

function build() {
  const t0 = Date.now();
  const F = FX.create(ENGINE.API.M);
  if (F.BROKEN) throw new Error('refusing to build training data with PORY2_BREAK=' + F.BROKEN);
  fs.mkdirSync(OUT, { recursive: true });
  const files = ['tok_num.f32', 'tok_id.i32', 'side.f32', 'field.f32', 'facts.f32', 'base.f32', 'meta.i32', 'z.f32', 'v.f32', 'target.f32', 'deep.f32'];
  const fd = Object.fromEntries(files.map(f => [f, fs.openSync(path.join(OUT, f), 'w')]));
  const w = (f, typed) => fs.writeSync(fd[f], Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength));
  const vocab = { species: { '<unk>': 0 }, item: { '<unk>': 0 }, ability: { '<unk>': 0 }, move: { '<unk>': 0 } };
  const KIND = ['species', 'item', 'ability', 'move', 'move', 'move', 'move'];
  const idOf = (kind, s) => { const v = vocab[kind]; if (!(s in v)) v[s] = Object.keys(v).length; return v[s]; };
  const c = { games: 0, games_no_result: 0, positions: 0, with_v: 0, with_deep: 0, val_positions: 0, wrong_release: 0, roots_too_unfilled: 0 };
  const sources = [];
  let N = 0, gi = 0;
  for (const dir of DIRS) {
    for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl\.gz$/.test(f)).sort()) sources.push({ file: path.relative(ROOT, path.join(dir, f)).split(path.sep).join('/'), sha256: sha(path.join(dir, f)) });
    for (const rec of records(dir)) {
      if (rec.release !== ENGINE.id) { c.wrong_release++; continue; }
      if (rec.vA == null) { c.games_no_result++; continue; }
      c.games++; gi++;
      const val = isVal(rec.id + ':' + rec.run_seed + ':' + rec.g) ? 1 : 0;
      const vs = new Map();
      for (const d of rec.decisions) {
        if (d.unfilled / (d.m * d.nc) > MAXUNF) { c.roots_too_unfilled++; continue; }
        const vp1 = d.side === 'A' || BREAK === 'vside' ? d.v : 1 - d.v;
        const a = vs.get(d.t) || []; a.push(vp1); vs.set(d.t, a);
      }
      for (let t = 0; t < rec.hist.length; t++) {
        const T = rec.hist[t];
        const x = F.encode({ sheets: rec.sheets, state: T.state, turn: T.n });
        const tn = new Float32Array(2 * 6 * FX.TOK_NUM_NAMES.length), ti = new Int32Array(2 * 6 * 7);
        let a = 0, b = 0;
        for (const sd of ['p1', 'p2']) for (let i = 0; i < 6; i++) {
          for (const q of x.tokNum[sd][i]) tn[a++] = q;
          x.tokId[sd][i].forEach((s, j) => { ti[b++] = idOf(KIND[j], s); });
        }
        w('tok_num.f32', tn); w('tok_id.i32', ti);
        w('side.f32', Float32Array.from([...x.side.p1, ...x.side.p2]));
        w('field.f32', Float32Array.from(x.field));
        w('facts.f32', Float32Array.from([...x.facts.p1, ...x.facts.p2]));
        w('base.f32', Float32Array.from(x.base));
        const vv = vs.get(t);
        const v = vv ? vv.reduce((p, q) => p + q, 0) / vv.length : NaN;
        const z = rec.vA;
        w('z.f32', Float32Array.from([z])); w('v.f32', Float32Array.from([v]));
        const dirKey = path.relative(ROOT, dir).split(path.sep).join('/');
        const dv = deepMap.has(dirKey + '|' + rec.g + '|' + rec.run_seed + '|' + t) ? deepMap.get(dirKey + '|' + rec.g + '|' + rec.run_seed + '|' + t) : NaN;
        if (!Number.isNaN(dv)) c.with_deep++;
        w('deep.f32', Float32Array.from([dv]));
        const vt = DEEP ? dv : v;
        w('target.f32', Float32Array.from([Number.isNaN(vt) ? z : LAMBDA * vt + (1 - LAMBDA) * z]));
        w('meta.i32', Int32Array.from([gi, T.n, z >= 0.5 ? 1 : 0, val, 0, rec.hist.length, Number.isNaN(DEEP ? dv : v) ? 0 : 1, t === rec.hist.length - 1 ? 1 : 0]));
        N++; if (!Number.isNaN(v)) c.with_v++; if (val) c.val_positions++;
      }
    }
  }
  for (const f of files) fs.closeSync(fd[f]);
  c.positions = N;
  const meta = { generated: new Date().toISOString(), generator: 'solver/machamp/build_pory2.js', feature_version: FX.FEATURE_VERSION,
    engine_release: ENGINE.id, release_stamp: ENGINE.stamp, sources, N, break: BREAK || null, value_source: DEEP ? 'deep rollout values from ' + DEEP : 'search root value', lambda: LAMBDA, max_unfilled: MAXUNF, val_pct: VALPCT,
    names: { tok_num: FX.TOK_NUM_NAMES, tok_id: FX.TOK_ID_NAMES, side: FX.SIDE_NUM_NAMES, field: FX.FIELD_NUM_NAMES, facts: FX.FACT_NAMES, meta: META_COLS },
    vocab, counts: c, engine_counters: F.COUNTERS, seconds: (Date.now() - t0) / 1000 };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify({ N, counts: c, seconds: meta.seconds }));
  return meta;
}

if (require.main === module) build();
