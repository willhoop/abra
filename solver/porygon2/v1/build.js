/* ABRA-HEAP: 2048
 * solver/porygon2/v1/build.js — PORYGON2 v1's training / evaluation tensors, on a FROZEN release.
 *
 *   node solver/porygon2/v1/build.js --release <id> --selfplay <dir>[,<dir>…] --out <dir> [--shard i --shards n]
 *   node solver/porygon2/v1/build.js --release <id> --human <dir holding games.jsonl> --out <dir> [--shard i --shards n] [--limit N]
 *
 * ONE ROW PER POSITION, both sides stored once (p1 first). Self-play games are REPLAYED EXACTLY on the release
 * (solver/porygon2/v1/replay.js) and each position is encoded from the TRUE engine battle through the honest producer
 * (features.js fromEngine); human games are encoded from their public history (fromDataset). One encode() for both.
 *
 * Every row also carries the CHAMPION's opinion of the same position — gen5's PORYGON2 (the v0 architecture on the v0
 * features, solver/porygon2/features.js + infer.js) — so the gate compares v1 and gen5 on IDENTICAL positions, paired.
 *
 * Files (little-endian, row-major): tok.f32 [N,2,6,TN]  ids.i32 [N,2,6,7]  mvw.f32 [N,2,6,4]  side.f32 [N,2,SN]
 *   field.f32 [N,FN]  facts.f32 [N,2,10]  base.f32 [N,2]  meta.i32 [N,META]  and one float column per value:
 *   z.f32 (the result for p1)  vroot.f32 (the recorded search root value, p1 frame, NaN if none)  vgen5.f32 (gen5's P(p1))
 * meta.json: names, the id vocabulary (strings -> ids), the game keys (dir|g|run_seed or the human id), counts, the
 * release stamp and the sources' digests.
 * META = game (index into meta.json games), t (position index in the game), turn, winner (1 p1 / 0 p2 / -1 none),
 *        split_p1, split_p2 (human: the MAG/DODUO player split 0 train 1 val 2 test; self-play: the GAME split, both
 *        columns equal), src (0 human, 1 self-play), end (human: 0 normal 1 forfeit 2 inactivity; self-play: 1 capped),
 *        last (1 on the game's last position), alive_p1, alive_p2 (live mons, unseen brought counted)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const readline = require('readline');
require('../../arena/env.js');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..', '..');
const REL_ID = arg('--release', null);
if (!REL_ID) { console.error('porygon2/v1/build: --release is required'); process.exit(2); }
const ENGINE = require('../../arena/engine.js').load(REL_ID);
const API = ENGINE.API;
const FX = require('./features.js');
const { toID } = require('../../human/dex.js');
const OUT = path.resolve(ROOT, arg('--out', 'solver/out/porygon2/v1'));
const SHARD = +arg('--shard', 0), SHARDS = +arg('--shards', 1);
const LIMIT = +arg('--limit', 0) || Infinity;
const GEN5 = path.resolve(ROOT, arg('--champion', 'solver/machamp/models/gen5/porygon2-gen5.json'));
const SALT = 'abra-prior-v0';
const splitOf = pid => { const h = crypto.createHash('sha256').update(SALT + ':' + pid).digest().readUInt32BE(0) % 100; return h < 80 ? 0 : h < 90 ? 1 : 2; };
/* self-play GAME split: 10% val, 10% test, by a hash of the game key (a game never straddles two splits) */
const gameSplit = k => { const h = crypto.createHash('sha256').update('porygon2-v1-sp:' + k).digest().readUInt32BE(0) % 100; return h < 80 ? 0 : h < 90 ? 1 : 2; };
const META_COLS = ['game', 't', 'turn', 'winner', 'split_p1', 'split_p2', 'src', 'end', 'last', 'alive_p1', 'alive_p2'];
const ENDS = ['normal', 'forfeit', 'inactivity'];
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function* spRecords(dir) {
  for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl\.gz$/.test(f)).sort()) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8');
    for (const line of txt.split('\n')) if (line) yield JSON.parse(line);
  }
}

async function main() {
  const t0 = Date.now();
  const F = FX.create(API);
  if (F.BROKEN) throw new Error('refusing to build training data with PORY2V1_BREAK=' + F.BROKEN);
  const F0 = require('../features.js').create(API.M);
  if (F0.BROKEN) throw new Error('refusing to build with PORY2_BREAK=' + F0.BROKEN);
  const G5 = require('../infer.js').load(GEN5);
  const PA = require('../../miltank/prior_adapter.js').create(API, null);
  const RP = require('./replay.js').create(API, { PA });
  fs.mkdirSync(OUT, { recursive: true });
  const FILES = ['tok.f32', 'ids.i32', 'mvw.f32', 'side.f32', 'field.f32', 'facts.f32', 'base.f32', 'meta.i32', 'z.f32', 'vroot.f32', 'vgen5.f32'];
  const fd = Object.fromEntries(FILES.map(f => [f, fs.openSync(path.join(OUT, f), 'w')]));
  const w = (f, typed) => fs.writeSync(fd[f], Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength));
  const vocab = { species: { '<unk>': 0 }, item: { '<unk>': 0 }, ability: { '<unk>': 0 }, move: { '<unk>': 0 } };
  const trainCount = { species: {}, item: {}, ability: {}, move: {} };
  const KIND = ['species', 'item', 'ability', 'move', 'move', 'move', 'move'];
  const idOf = (kind, s) => { const v = vocab[kind]; if (!(s in v)) v[s] = Object.keys(v).length; return v[s]; };
  const TN = FX.TOK_NUM_NAMES.length;
  const games = [];
  const c = { games: 0, positions: 0, skipped_no_winner: 0, with_root: 0, errors: 0, by_split: [0, 0, 0] };
  let N = 0;

  function writeRow(sheets, H, X, meta, z, vroot, trainRow) {
    const tok = new Float32Array(2 * 6 * TN), ids = new Int32Array(2 * 6 * 7), mvw = new Float32Array(2 * 6 * 4);
    let a = 0, b = 0, q = 0;
    for (const sd of ['p1', 'p2']) for (let i = 0; i < 6; i++) {
      for (const v of X.tok[sd][i]) tok[a++] = v;
      X.ids[sd][i].forEach((s, j) => { ids[b++] = idOf(KIND[j], s); if (trainRow) trainCount[KIND[j]][s] = (trainCount[KIND[j]][s] || 0) + 1; });
      for (const v of X.mvw[sd][i]) mvw[q++] = v;
    }
    w('tok.f32', tok); w('ids.i32', ids); w('mvw.f32', mvw);
    w('side.f32', Float32Array.from([...X.side.p1, ...X.side.p2]));
    w('field.f32', Float32Array.from(X.field));
    w('facts.f32', Float32Array.from([...X.facts.p1, ...X.facts.p2]));
    w('base.f32', Float32Array.from(X.base));
    w('meta.i32', Int32Array.from(meta));
    w('z.f32', Float32Array.from([z])); w('vroot.f32', Float32Array.from([vroot]));
    N++;
  }
  const aliveOf = (H, sd) => { const ms = H.sides[sd].mons; const seen = ms.filter(m => m.seen).length; return ms.filter(m => m.seen && m.alive).length + Math.max(0, 4 - seen); };

  const sources = [];
  const DIRS = String(arg('--selfplay', '')).split(',').filter(Boolean).map(d => path.resolve(ROOT, d));
  const HUMAN = arg('--human', null);
  let gi = -1;
  if (DIRS.length) {
    for (const dir of DIRS) {
      const dkey = path.relative(ROOT, dir).split(path.sep).join('/');
      for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl\.gz$/.test(f)).sort()) sources.push({ file: dkey + '/' + f, sha256: sha(path.join(dir, f)) });
      for (const rec of spRecords(dir)) {
        gi++;
        if (gi % SHARDS !== SHARD) continue;
        if (c.games >= LIMIT) break;
        const gkey = dkey + '|' + rec.g + '|' + rec.run_seed;
        const split = gameSplit(gkey);
        /* the recorded root values, per turn, p1 frame (side A's value, and 1 − side B's), over roots at most half empty */
        const vs = new Map();
        for (const d of rec.decisions || []) {
          if (d.v == null || (d.unfilled || 0) / (d.m * d.nc) > 0.5) continue;
          const vp1 = d.side === 'A' ? d.v : 1 - d.v;
          const a = vs.get(d.t) || []; a.push(vp1); vs.set(d.t, a);
        }
        const rows = [];
        try {
          for (const pos of RP.positions(rec, ENGINE.id)) {
            const H = F.fromEngine(pos.S, rec.sheets);
            const X = F.encode(H, rec.sheets);
            const x0 = F0.encode(F0.fromEngine(PA, pos.S, rec.sheets));
            const vv = vs.get(pos.t);
            rows.push({ H, X, t: pos.t, turn: pos.S.turn + 1, vroot: vv ? vv.reduce((p, q) => p + q, 0) / vv.length : NaN, g5: G5.value(x0) });
          }
        } catch (e) { c.errors++; if (c.errors < 5) console.error('build: game', gkey, String(e && e.stack || e).slice(0, 300)); continue; }
        if (!rows.length) continue;
        const gIdx = games.length; games.push(gkey);
        c.games++; c.by_split[split]++;
        const z = rec.vA;
        rows.forEach((r, j) => {
          writeRow(rec.sheets, r.H, r.X, [gIdx, r.t, r.turn, z >= 0.5 ? 1 : 0, split, split, 1, rec.capped ? 1 : 0, j === rows.length - 1 ? 1 : 0, aliveOf(r.H, 'p1'), aliveOf(r.H, 'p2')],
            z, r.vroot, split === 0);
          w('vgen5.f32', Float32Array.from([r.g5]));
          if (!Number.isNaN(r.vroot)) c.with_root++;
        });
        if (c.games % 200 === 0) console.log(`  [v1 build ${SHARD}] ${c.games} games ${N} positions ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
    }
  } else if (HUMAN) {
    const hdir = path.resolve(ROOT, HUMAN);
    const GAMES = path.join(hdir, 'games.jsonl');
    const manifest = JSON.parse(fs.readFileSync(path.join(hdir, 'manifest.json'), 'utf8'));
    const declared = (manifest.outputs || []).find(o => o.path.endsWith('games.jsonl'));
    sources.push({ file: GAMES, sha256_declared: declared ? declared.sha256 : null, manifest_generated: manifest.generated });
    const rl = readline.createInterface({ input: fs.createReadStream(GAMES), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      gi++;
      if (gi % SHARDS !== SHARD) continue;
      if (c.games >= LIMIT) break;
      const row = JSON.parse(line); const G = row.game;
      if (G.tie || (G.winner !== 'p1' && G.winner !== 'p2')) { c.skipped_no_winner++; continue; }
      const sp = ['p1', 'p2'].map(sd => splitOf(toID(G.players[sd].name)));
      const rows = [];
      try {
        for (let k = 0; k < row.turns.length; k++) {
          const T = row.turns[k];
          const H = F.fromDataset(G, row.turns, k);
          const X = F.encode(H, G.sheets);
          const x0 = F0.encode({ sheets: G.sheets, state: T.state, turn: T.n });
          rows.push({ H, X, t: k, turn: T.n, g5: G5.value(x0) });
        }
      } catch (e) { c.errors++; if (c.errors < 5) console.error('build: human game', G.id, String(e && e.stack || e).slice(0, 300)); continue; }
      const gIdx = games.length; games.push(String(G.id) + '|' + gi);
      c.games++;
      const z = G.winner === 'p1' ? 1 : 0;
      rows.forEach((r, j) => {
        writeRow(G.sheets, r.H, r.X, [gIdx, r.t, r.turn, z, sp[0], sp[1], 0, Math.max(0, ENDS.indexOf(G.end)), j === rows.length - 1 ? 1 : 0, aliveOf(r.H, 'p1'), aliveOf(r.H, 'p2')],
          z, NaN, sp[0] === 0 && sp[1] === 0);
        w('vgen5.f32', Float32Array.from([r.g5]));
      });
      if (c.games % 1000 === 0) console.log(`  [v1 build ${SHARD}] ${c.games} human games ${N} positions ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  } else throw new Error('porygon2/v1/build: --selfplay or --human');
  for (const f of FILES) fs.closeSync(fd[f]);
  c.positions = N;
  const meta = { generated: new Date().toISOString(), generator: 'solver/porygon2/v1/build.js', feature_version: FX.FEATURE_VERSION,
    engine_release: ENGINE.id, release_stamp: ENGINE.stamp, kind: DIRS.length ? 'selfplay' : 'human', shard: SHARD, shards: SHARDS, argv,
    champion: { path: path.relative(ROOT, GEN5).split(path.sep).join('/'), sha256: sha(GEN5) },
    N, names: { tok: FX.TOK_NUM_NAMES, ids: FX.TOK_ID_NAMES, side: FX.SIDE_NUM_NAMES, field: FX.FIELD_NUM_NAMES, facts: FX.FACT_NAMES, meta: META_COLS, ends: ENDS },
    vocab, train_count: trainCount, games, sources, counts: c, replay: RP.COUNTERS, engine_counters: F.COUNTERS, gen5_counters: G5.COUNTERS, seconds: (Date.now() - t0) / 1000 };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta));
  console.log(JSON.stringify({ N, counts: c, replay: RP.COUNTERS, seconds: meta.seconds }));
}

main().catch(e => { console.error(e); process.exit(1); });
