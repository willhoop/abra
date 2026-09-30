/* ABRA-HEAP: 2048
 * solver/porygon2/v2/encode.js — PORYGON2 v2's tensors, on a FROZEN release, from the reveal dataset.
 *
 *   node solver/porygon2/v2/encode.js --release eaa5becc54eb --fmt bo1|bo3 [--shard i --shards n] [--limit N]
 *        -> solver/out/porygon2-v2/<fmt>/tensors/s<i>/
 *
 * Reads solver/out/porygon2-v2/<fmt>/games.jsonl.gz (extract.js) as a STREAM (the file is over 512 MB uncompressed), takes
 * every game whose index mod n is i, and writes ONE ROW PER POSITION through features.js (fromReveal -> encode). Every
 * position is stored; the trainer draws K of them per game per epoch (DESIGN §4).
 *
 * Files (little-endian, row-major):
 *   tok.f16 [N,2,6,TN]   ids.i16 [N,2,6,10]   side.f32 [N,2,SN]   field.f32 [N,FN]   facts.f32 [N,2,10]   base.f32 [N,2]
 *   rating.f32 [N,2] (NaN = unrated)   meta.i32 [N,META]
 *   labels: z.f32 [N] (p1 won 1 / lost 0 / tie 0.5)   surv.i8 [N,2,6] (alive at the end 1/0, -1 = never seen)
 *           hpend.f16 [N,2,6] (HP fraction at the end; NaN = never seen)   mat.i8 [N] (final alive p1 - p2 + 4, 0..8)
 *           hpd.f32 [N] (final HP-fraction p1 - p2)   nks.i8 [N] (next faint: 0 p1, 1 p2, 2 both, 3 none)
 *           nkd.i8 [N] (turns until it: 0, 1, 2, 3+; -1 if none)   tl.i8 [N] (turns left: 0, 1, 2, 3-4, 5+)
 * META = game, t, turn, split (0 train 1 val 2 test), last, end (0 normal 1 forfeit 2 inactivity 3 other), band_min,
 *        v1_unseen (1 / 0 / -1 n/a), sheets_public, unequal (|r1 - r2| >= 100, both rated)
 * meta.json: names, the id vocabularies (string -> id; the first four are SPECIAL), train counts, the game list (id, split,
 * band, ratings, v1_unseen), the release stamp, the input's sha256 and the code digests, every counter.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const readline = require('readline');
try { require('os').setPriority(0, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { console.error('could not lower priority: ' + e.message); }
require('../../arena/env.js');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..', '..');
const REL_ID = arg('release', null);
if (!REL_ID) { console.error('porygon2/v2/encode: --release is required'); process.exit(2); }
const FMT = arg('fmt', 'bo1');
const SHARD = +arg('shard', 0), SHARDS = +arg('shards', 1), LIMIT = +arg('limit', 0) || Infinity;
const DIR = path.resolve(ROOT, arg('data', 'solver/out/porygon2-v2'), FMT);
const IN = path.join(DIR, 'games.jsonl.gz');
const OUT = path.join(path.resolve(ROOT, arg('out', path.join(DIR, 'tensors'))), 's' + SHARD);
const ENGINE = require('../../arena/engine.js').load(REL_ID);
const FX = require('./features.js');
const F = FX.create(ENGINE.API);
if (F.BROKEN) throw new Error('refusing to build training data with PORY2V2_FEAT_BREAK=' + F.BROKEN);
const SPLITS = { train: 0, val: 1, test: 2 };
const ENDS = ['normal', 'forfeit', 'inactivity'];
const BANDS = ['unrated', '<1100', '1100-1199', '1200-1299', '1300-1399', '1400-1499', '1500-1599', '>=1600'];
const META_COLS = ['game', 't', 'turn', 'split', 'last', 'end', 'band_min', 'v1_unseen', 'sheets_public', 'unequal'];
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/* float32 -> float16 bits (round to nearest even); NaN kept */
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
function toHalf(v) {
  f32[0] = v; const x = u32[0];
  const sign = (x >>> 16) & 0x8000, exp = (x >>> 23) & 0xff, mant = x & 0x7fffff;
  if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0);
  let e = exp - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    const m = (mant | 0x800000) >> (1 - e);
    return sign | ((m + 0x1000 + ((m >> 13) & 1) - 1) >> 13);
  }
  const h = sign | (e << 10) | (mant >> 13);
  const rest = mant & 0x1fff;
  return (rest > 0x1000 || (rest === 0x1000 && (h & 1))) ? h + 1 : h;
}

async function main() {
  const t0 = Date.now();
  fs.mkdirSync(OUT, { recursive: true });
  const FILES = ['tok.f16', 'ids.i16', 'side.f32', 'field.f32', 'facts.f32', 'base.f32', 'rating.f32', 'meta.i32',
    'z.f32', 'surv.i8', 'hpend.f16', 'mat.i8', 'hpd.f32', 'nks.i8', 'nkd.i8', 'tl.i8'];
  const fd = Object.fromEntries(FILES.map(f => [f, fs.openSync(path.join(OUT, f), 'w')]));
  const bufs = Object.fromEntries(FILES.map(f => [f, []]));
  const push = (f, typed) => { bufs[f].push(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)); };
  const flush = () => { for (const f of FILES) { if (bufs[f].length) fs.writeSync(fd[f], Buffer.concat(bufs[f])); bufs[f] = []; } };
  const TN = FX.TOK_NUM_NAMES.length, NID = FX.ID_NAMES.length;
  const vocab = { species: {}, item: {}, ability: {}, move: {} };
  for (const k in vocab) FX.SPECIAL.forEach((s, i) => { vocab[k][s] = i; });
  const trainCount = { species: {}, item: {}, ability: {}, move: {} };
  const idOf = (kind, s) => { const v = vocab[kind]; if (!(s in v)) v[s] = Object.keys(v).length; return v[s]; };
  const games = [];
  const c = { games_read: 0, games: 0, positions: 0, errors: 0, by_split: [0, 0, 0], unk_member_fields: 0, member_fields: 0 };
  let N = 0, gi = -1;
  const it = readline.createInterface({ input: fs.createReadStream(IN).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  for await (const line of it) {
    if (!line) continue;
    gi++;
    if (gi % SHARDS !== SHARD) continue;
    if (c.games >= LIMIT) break;
    c.games_read++;
    const g = JSON.parse(line);
    const L = g.labels;
    let rows;
    try {
      rows = g.positions.map(p => ({ p, X: F.encode(F.fromReveal(p.x), g.rating) }));
    } catch (e) { c.errors++; if (c.errors < 5) console.error('encode: game', g.id, String(e && e.stack || e).slice(0, 300)); continue; }
    if (!rows.length) continue;
    const split = SPLITS[g.split];
    const gIdx = games.length;
    const r1 = g.rating.p1, r2 = g.rating.p2;
    const unequal = r1 != null && r2 != null && Math.abs(r1 - r2) >= 100 ? 1 : 0;
    games.push({ id: g.id, split: g.split, band_min: g.band.min, rating: g.rating, v1_unseen: g.v1_unseen, end: L.end, n: rows.length, quality_reasons: g.quality_reasons || [] });
    c.games++; c.by_split[split]++;
    const end = Math.max(0, ENDS.indexOf(L.end)) + (ENDS.includes(L.end) ? 0 : 3);
    const surv = new Int8Array(12), hpend = new Uint16Array(12);
    SIDES_EACH((s, si) => L.final[s].mons.forEach((m, i) => { surv[si * 6 + i] = m ? m.alive : -1; hpend[si * 6 + i] = toHalf(m ? m.hp / 100 : NaN); }));
    const mat = Math.max(0, Math.min(8, L.final.p1.alive - L.final.p2.alive + 4));
    const hpd = L.final.p1.hp - L.final.p2.hp;
    rows.forEach(({ p, X }, t) => {
      const tok = new Uint16Array(2 * 6 * TN), ids = new Int16Array(2 * 6 * NID);
      let a = 0, b = 0;
      SIDES_EACH(s => {
        for (let i = 0; i < 6; i++) {
          for (const v of X.tok[s][i]) tok[a++] = toHalf(v);
          X.ids[s][i].forEach((str, j) => {
            const kind = FX.ID_KINDS[j];
            ids[b++] = idOf(kind, str);
            if (split === 0) trainCount[kind][str] = (trainCount[kind][str] || 0) + 1;
            c.member_fields++; if (str === '<UNK>') c.unk_member_fields++;
          });
        }
      });
      push('tok.f16', tok); push('ids.i16', ids);
      push('side.f32', Float32Array.from([...X.side.p1, ...X.side.p2]));
      push('field.f32', Float32Array.from(X.field));
      push('facts.f32', Float32Array.from([...X.facts.p1, ...X.facts.p2]));
      push('base.f32', Float32Array.from(X.base));
      push('rating.f32', Float32Array.from([r1 == null ? NaN : r1, r2 == null ? NaN : r2]));
      push('meta.i32', Int32Array.from([gIdx, t, p.n, split, t === rows.length - 1 ? 1 : 0, end, BANDS.indexOf(g.band.min),
        g.v1_unseen == null ? -1 : g.v1_unseen ? 1 : 0, g.sheets_public ? 1 : 0, unequal]));
      push('z.f32', Float32Array.from([L.z]));
      push('surv.i8', surv); push('hpend.f16', hpend);
      push('mat.i8', Int8Array.from([mat])); push('hpd.f32', Float32Array.from([hpd]));
      const nk = p.y.next_ko;
      push('nks.i8', Int8Array.from([nk ? { p1: 0, p2: 1, both: 2 }[nk.side] : 3]));
      push('nkd.i8', Int8Array.from([nk ? Math.min(3, nk.dt) : -1]));
      const tl = p.y.turns_left;
      push('tl.i8', Int8Array.from([tl <= 0 ? 0 : tl === 1 ? 1 : tl === 2 ? 2 : tl <= 4 ? 3 : 4]));
      N++;
    });
    if (bufs['z.f32'].length > 4000) flush();
    if (c.games % 1000 === 0) console.log(`  [v2 encode ${FMT} s${SHARD}] ${c.games} games ${N} positions ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  flush();
  for (const f of FILES) fs.closeSync(fd[f]);
  c.positions = N;
  const code = {};
  for (const f of ['solver/porygon2/v2/encode.js', 'solver/porygon2/v2/features.js', 'solver/porygon2/v1/features.js']) code[f] = sha(path.join(ROOT, f));
  const meta = { generated: new Date().toISOString(), generator: 'solver/porygon2/v2/encode.js', feature_version: FX.FEATURE_VERSION,
    engine_release: ENGINE.id, release_stamp: ENGINE.stamp, fmt: FMT, shard: SHARD, shards: SHARDS, argv,
    input: { path: path.relative(ROOT, IN).split(path.sep).join('/'), sha256: sha(IN) }, code, N,
    names: { tok: FX.TOK_NUM_NAMES, ids: FX.ID_NAMES, id_kinds: FX.ID_KINDS, special: FX.SPECIAL, side: FX.SIDE_NUM_NAMES,
      field: FX.FIELD_NUM_NAMES, facts: FX.FACT_NAMES, meta: META_COLS, ends: ENDS, bands: BANDS, rating_edges: FX.RATING_EDGES },
    vocab, train_count: trainCount, games, counts: c, feature_counters: F.COUNTERS, v1_counters: F.v1.COUNTERS, seconds: (Date.now() - t0) / 1000 };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta));
  console.log(JSON.stringify({ fmt: FMT, shard: SHARD, N, counts: c, feature_counters: F.COUNTERS, seconds: meta.seconds }));
}
function SIDES_EACH(fn) { fn('p1', 0); fn('p2', 1); }

main().catch(e => { console.error(e); process.exit(1); });
