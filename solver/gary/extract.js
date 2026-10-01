/* ABRA-HEAP: 2048
 * solver/gary/extract.js — GARY v1's training and evaluation rows, from the HUMAN DATASET ONLY (no simulator, no game).
 *
 *   node solver/gary/extract.js --human <games.jsonl> --doduo-train <games.jsonl DODUO v1 was trained on> \
 *        --out solver/out/gary/<tag> [--workers 3] [--limit N]
 *   (a worker: the same with --shard i --shards n)
 *
 * WHAT A ROW IS. One side's turn decision whose JOINT action is fully observed (solver/prior/features.js jointStatus
 * 'exact': every occupied choice slot a move with a certain target, or a switch; a locked slot rides along). For it:
 * DODUO v1's log-probability of EVERY valid joint cell (solver/mag/infer.js, the human-fitted DODUO, unchanged), each
 * cell's class mask (solver/gary/situation.js classBits), the human's cell, the situation bucket and the rating band.
 * Voluntary switches are inside the joint; end-of-turn faint REPLACEMENTS are a different decision and are not rows
 * (GARY v1 models the turn decision only; the search's forced-switch path does not read it).
 *
 * WHO IS HELD OUT. The split is every solver net's: sha256("abra-prior-v0:" + player) mod 100 -> train < 80 <= val < 90
 * <= test. DODUO v1 was fitted on the TRAIN players of the 2026-09-23 dataset (sha256 9d07c522...). So a row is
 *   - SKIPPED when DODUO saw it: a train player's decision in a game that dataset holds (--doduo-train lists its ids);
 *   - FIT   when DODUO did not see it and the player is not a test player (val players, and train players' games
 *           played after that dataset was cut);
 *   - EVAL  when the player is a TEST player (DODUO never saw them; GARY never fits them). The gate reads only these.
 * Our own accounts never reach here: the dataset builder excludes them (engine/quality.js isOwnAccount).
 *
 * OUTPUT, per shard s: meta-s.jsonl (one decision per line: ids, split, role, bucket, band, series keys, K cells, the
 * label's cell, offsets), lp-s.f32 (DODUO's log-probabilities, K per row) and bits-s.u16 (the class masks, K per row);
 * the coordinator writes manifest.json (inputs with sha256, every count, the flags).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const crypto = require('crypto');
const readline = require('readline');
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const HUMAN = path.resolve(flag('--human', path.join(ROOT, 'solver', 'out', 'human', 'games.jsonl')));
const DTRAIN = flag('--doduo-train', null);
const OUT = path.resolve(ROOT, flag('--out', 'solver/out/gary/x'));
const WORKERS = Math.max(1, Math.min(4, +flag('--workers', 3)));
const SHARD = flag('--shard', null), SHARDS = +flag('--shards', 1);
const LIMIT = +flag('--limit', 0) || 0;
const SALT = 'abra-prior-v0';
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const splitOf = pid => { const h = crypto.createHash('sha256').update(SALT + ':' + pid).digest().readUInt32BE(0) % 100; return h < 80 ? 'train' : h < 90 ? 'val' : 'test'; };
const shardOf = (id, n) => crypto.createHash('sha256').update('gary:' + id).digest().readUInt32BE(0) % n;
const sha256File = p => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(p).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });

async function idsOf(file) {
  const ids = new Set();
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) { const m = /"id":"([^"]+)"/.exec(line.slice(0, 400)); if (m) ids.add(m[1]); }
  return ids;
}

async function worker(shard, shards) {
  const S = require('./situation.js');
  const MAG = require('../mag/infer.js').load();
  const CELLS = require('./cells.js');
  const seenIds = new Set(JSON.parse(fs.readFileSync(path.join(OUT, 'doduo-train-ids.json'), 'utf8')));
  const metaF = fs.openSync(path.join(OUT, `meta-${shard}.jsonl`), 'w');
  const lpF = fs.openSync(path.join(OUT, `lp-${shard}.f32`), 'w');
  const bitsF = fs.openSync(path.join(OUT, `bits-${shard}.u16`), 'w');
  const C = { games: 0, decisions: 0, skipped_doduo_seen: 0, not_exact: {}, one_cell: 0, label_invalid: 0, rows: 0, fit: 0, eval: 0, cells: 0, errors: 0, error_samples: [] };
  let off = 0, gi = 0;
  const t0 = Date.now();
  const rl = readline.createInterface({ input: fs.createReadStream(HUMAN), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    gi++;
    if (LIMIT && gi > LIMIT) break;
    const idm = /"id":"([^"]+)"/.exec(line.slice(0, 400));
    if (!idm || shardOf(idm[1], shards) !== shard) continue;
    const row = JSON.parse(line), G = row.game;
    C.games++;
    for (const side of ['p1', 'p2']) {
      const pl = toID(G.players[side].name);
      const split = splitOf(pl);
      if (split === 'train' && seenIds.has(G.id)) { C.skipped_doduo_seen += row.turns.length; continue; }
      const role = split === 'test' ? 'eval' : 'fit';
      const band = S.band(G, side);
      for (let t = 0; t < row.turns.length; t++) {
        C.decisions++;
        let dc;
        try { dc = CELLS.decisionCells(MAG, row, t, side); } catch (e) { C.errors++; if (C.error_samples.length < 5) C.error_samples.push(G.id + ' t' + t + ' ' + String(e.message).slice(0, 160)); continue; }
        if (!dc) { C.not_exact.none = (C.not_exact.none || 0) + 1; continue; }
        if (dc.status === 'one_cell') { C.one_cell++; continue; }
        if (dc.status === 'label_invalid') { C.label_invalid++; continue; }
        if (dc.status !== 'exact') { C.not_exact[dc.status] = (C.not_exact[dc.status] || 0) + 1; continue; }
        const { d, lp, bits, lab, two } = dc, K = lp.length;
        fs.writeSync(lpF, Buffer.from(lp.buffer));
        fs.writeSync(bitsF, Buffer.from(bits.buffer));
        fs.writeSync(metaF, JSON.stringify({ g: G.id, pl, sp: split, role, b: S.bucket(row, t, side, d), band, t, n: row.turns[t].n, side,
          ser: G.series ? G.series.id : null, gn: G.series ? G.series.game : null, up: G.uploadtime || null, K, lab, off, two }) + '\n');
        off += K; C.rows++; C[role]++; C.cells += K;
      }
    }
    if (C.games % 2000 === 0) console.log(`  [shard ${shard}] ${C.games} games ${C.rows} rows ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  fs.closeSync(metaF); fs.closeSync(lpF); fs.closeSync(bitsF);
  C.wall_s = (Date.now() - t0) / 1000;
  fs.writeFileSync(path.join(OUT, `summary-${shard}.json`), JSON.stringify(C, null, 1));
  console.log(`  [shard ${shard}] done ${C.rows} rows (${C.fit} fit, ${C.eval} eval) in ${C.wall_s.toFixed(0)}s`);
}

async function coordinator() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!DTRAIN) throw new Error('extract: --doduo-train <the games.jsonl DODUO v1 was trained on> is required');
  const mag = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'mag', 'model', 'doduo-v1.json'), 'utf8'));
  const trainSha = await sha256File(DTRAIN);
  const want = mag.dataset && mag.dataset.games_sha256;
  if (trainSha !== want) throw new Error(`extract: --doduo-train sha256 ${trainSha} is not DODUO v1's dataset (${want})`);
  const ids = await idsOf(DTRAIN);
  fs.writeFileSync(path.join(OUT, 'doduo-train-ids.json'), JSON.stringify([...ids]));
  const humanSha = await sha256File(HUMAN);
  console.log(`extract: DODUO-train ids ${ids.size} (${trainSha.slice(0, 12)}), human ${path.relative(ROOT, HUMAN)} ${humanSha.slice(0, 12)}, ${WORKERS} workers`);
  const t0 = Date.now();
  await Promise.all([...Array(WORKERS).keys()].map(i => new Promise((res, rej) => {
    const a = [__filename, '--shard', String(i), '--shards', String(WORKERS), '--human', HUMAN, '--out', OUT].concat(LIMIT ? ['--limit', String(LIMIT)] : []);
    const ch = cp.spawn(process.execPath, ['--max-old-space-size=2048'].concat(a), { stdio: 'inherit' });
    console.log('extract: shard ' + i + ' pid ' + ch.pid);
    ch.on('exit', c => (c === 0 ? res() : rej(new Error('shard ' + i + ' exit ' + c))));
  })));
  const sums = [...Array(WORKERS).keys()].map(i => JSON.parse(fs.readFileSync(path.join(OUT, `summary-${i}.json`), 'utf8')));
  const tot = {};
  for (const s of sums) for (const [k, v] of Object.entries(s)) {
    if (typeof v === 'number') tot[k] = (tot[k] || 0) + v;
    else if (k === 'not_exact') { tot[k] = tot[k] || {}; for (const [a, b] of Object.entries(v)) tot[k][a] = (tot[k][a] || 0) + b; }
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({
    generator: 'solver/gary/extract.js', generated: new Date().toISOString(), shards: WORKERS, limit: LIMIT || null,
    human: { path: HUMAN, sha256: humanSha }, doduo_train: { path: DTRAIN, sha256: trainSha, ids: ids.size },
    doduo: { mag_sha256: mag.mag && mag.mag.sha256, file: 'solver/mag/model/doduo-v1.json' },
    split: { salt: SALT, rule: 'sha256(salt:player) mod 100: train <80, val <90, test' },
    roles: 'skipped = train player in a game DODUO v1 trained on; eval = test player; fit = every other row',
    counts: tot, wall_s: (Date.now() - t0) / 1000, argv,
  }, null, 1));
  console.log('extract: ' + JSON.stringify(tot));
}

if (SHARD != null) worker(+SHARD, SHARDS).catch(e => { console.error(e); process.exit(1); });
else coordinator().catch(e => { console.error(e); process.exit(1); });
