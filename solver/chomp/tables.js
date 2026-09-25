/* solver/chomp/tables.js — solve every CHOMP job of a plan, one shard per process (process-level parallelism only).
 *
 *   cmd.exe /c tools\lownode.cmd solver\chomp\tables.js --plan solver\out\chomp\v0\plan.json --shard 0/3
 *   ... --shard 1/3, --shard 2/3 in two more processes
 *
 * Reads the plan (solver/chomp/plan.js), opens the plan's frozen release, and for every job j with j mod n == k
 * writes one line to <plan dir>/tables/shard-k-of-n.jsonl:
 *   { id, side, refine, key, result }   result = CH.solve(...) with the 90 x 90 table (float32, base64) kept
 * A job already in the shard file is skipped, so a killed shard resumes where it stopped.
 *
 *   const C = require('./solver/chomp/tables.js').load(planDir)   -> Map(key -> result), key = id + '|' + side + '|' + (refine?'r':'p')
 */
'use strict';
const fs = require('fs');
const path = require('path');

const jobKey = (id, side, refine) => id + '|' + side + '|' + (refine ? 'r' : 'p');
const packTable = A => Buffer.from(Float32Array.from(A.flat()).buffer).toString('base64');
function unpackTable(b64, n) {
  const buf = Buffer.from(b64, 'base64');
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const A = []; for (let i = 0; i < n; i++) A.push(Array.from(f.subarray(i * n, (i + 1) * n)));
  return A;
}

function load(dir) {
  const out = new Map();
  const td = path.join(dir, 'tables');
  if (!fs.existsSync(td)) return out;
  for (const f of fs.readdirSync(td).filter(f => /^shard-.*\.jsonl$/.test(f))) {
    for (const line of fs.readFileSync(path.join(td, f), 'utf8').split('\n')) {
      if (!line) continue;
      let r; try { r = JSON.parse(line); } catch (e) { continue; }   // a torn last line of a killed shard
      out.set(r.key, r);
    }
  }
  return out;
}

if (require.main === module) {
  require('../arena/env.js');
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const planFile = path.resolve(flag('--plan', path.join(__dirname, '..', 'out', 'chomp', 'v0', 'plan.json')));
  const [k, n] = String(flag('--shard', '0/1')).split('/').map(Number);
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const dir = path.dirname(planFile);
  fs.mkdirSync(path.join(dir, 'tables'), { recursive: true });
  const outFile = path.join(dir, 'tables', 'shard-' + k + '-of-' + n + '.jsonl');
  const done = new Set();
  if (fs.existsSync(outFile)) for (const line of fs.readFileSync(outFile, 'utf8').split('\n')) { try { done.add(JSON.parse(line).key); } catch (e) {} }
  const D = require('./data.js');
  const H = D.headers(plan.dataset.file);
  if (H.pool_sha256 !== plan.dataset.pool_sha256) { console.error('tables: the dataset moved since the plan was written'); process.exit(1); }
  const byId = new Map(H.games.map(G => [G.id, G]));
  const CH = require('./chomp.js').create({ release: plan.release });
  const mine = plan.jobs.filter((j, i) => i % n === k);
  let t0 = Date.now(), m = 0;
  console.log('tables shard ' + k + '/' + n + ': ' + mine.length + ' jobs, ' + done.size + ' already done, release ' + plan.release);
  for (const j of mine) {
    const key = jobKey(j.id, j.side, j.refine);
    if (done.has(key)) continue;
    const G = byId.get(j.id);
    const other = j.side === 'p1' ? 'p2' : 'p1';
    let rec;
    try {
      const r = CH.solve({ mine: G.sheets[j.side], theirs: G.sheets[other] }, { refine: j.refine ? plan.chomp.refine : false, keepTable: true, keepSamples: j.refine, seed: 1 });
      const { table, options, win, ...rest } = r;
      rec = { id: j.id, side: j.side, refine: j.refine, key, result: Object.assign(rest, {
        win_vsMix: win.map(w => +w.vsMix.toFixed(6)), win_vsUniform: win.map(w => +w.vsUniform.toFixed(6)), win_worst: win.map(w => +w.worst.toFixed(6)),
        table_f32: packTable(table), support: r.support.map(s => ({ i: s.i, p: s.p, vsMix: s.vsMix })) }) };
    } catch (e) { rec = { id: j.id, side: j.side, refine: j.refine, key, error: String(e && e.message || e).slice(0, 300) }; }
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    m++;
    console.log('  ' + key + '  ' + (rec.error ? 'ERROR ' + rec.error : rec.result.ms + ' ms, support ' + rec.result.support.length) + '  (' + m + ' this run, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  }
  console.log('shard ' + k + '/' + n + ' done: ' + m + ' solved this run; chomp counters ' + JSON.stringify(CH.COUNTERS) + '; scorer ' + JSON.stringify(CH.scorer.COUNTERS));
}

module.exports = { load, jobKey, unpackTable, packTable };
