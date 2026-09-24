/* ABRA-HEAP: 600  (lownode.cmd caps the heap from this line; each worker is capped separately)
 * solver/xatu/eval_spreads.js — the spread belief on HELD-OUT human games.
 *
 * Human replays never reveal spreads, so truth cannot be checked here (selfplay.js does that). What can
 * be checked is CONSISTENCY: across a whole game, no observation may leave any stat of any mon with no
 * surviving SP value. Every observation that would have is a CONTRADICTION, recorded with its full
 * detail and not applied; the target is zero, and each one must be explained.
 *
 *   node solver/xatu/eval_spreads.js [--workers 6] [--limit N]
 *
 * Games: the held-out ids written by eval_bring.js (solver/out/xatu/split.json), read from the raw Reg
 * M-C shards under data/raw/ (tracked, read only). Writes solver/out/xatu/spread-eval.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { fork } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'solver', 'out', 'xatu');

function runGames(logs) {
  const { trackLog } = require('./track.js');
  const { SpreadBelief } = require('./spreads.js');
  const agg = { games: 0, order_obs: 0, damage_obs: 0, stats: {}, skipped: {}, contradictions: [], anomalies: [], touched: {}, errors: [] };
  for (const { id, log } of logs) {
    try {
      const T = trackLog(log);
      if (!T.sheets.p1 || !T.sheets.p2) { agg.errors.push({ id, e: 'no sheets' }); continue; }
      const B = new SpreadBelief(T.sheets);
      const ev = [...T.order.map(o => ({ t: o.turn, k: 'o', o })), ...T.damage.map(o => ({ t: o.turn, k: 'd', o }))].sort((a, c) => a.t - c.t);
      for (const e of ev) { if (e.k === 'o') B.applyOrder(e.o); else B.applyDamage(e.o); }
      agg.games++; agg.order_obs += T.order.length; agg.damage_obs += T.damage.length;
      for (const [k, v] of Object.entries(B.stats)) agg.stats[k] = (agg.stats[k] || 0) + v;
      for (const [k, v] of Object.entries(T.skipped)) agg.skipped[k] = (agg.skipped[k] || 0) + v;
      for (const c of B.contradictions) agg.contradictions.push({ id, ...c });
      for (const a of B.anomalies) agg.anomalies.push({ id, ...a });
      for (const [st, b] of Object.entries(B.narrowing())) { const a = (agg.touched[st] = agg.touched[st] || { n: 0, alive: 0, narrowed: 0, bits: 0 }); a.n += b.n; a.alive += b.alive; a.narrowed += b.narrowed; a.bits += b.bits; }
      // the invariant itself, checked directly: no domain is ever empty
      for (const s of ['p1', 'p2']) for (const m of B.dom[s]) if (m.empty()) agg.errors.push({ id, e: 'EMPTY DOMAIN' });
    } catch (e) { agg.errors.push({ id, e: String(e && e.stack || e).slice(0, 600) }); }
  }
  return agg;
}

if (process.env.XATU_WORKER) {
  process.on('message', msg => { const r = runGames(msg.logs); process.send(r, () => process.exit(0)); });
} else {
  const args = process.argv.slice(2);
  const flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const W = Math.min(6, +flag('--workers', 6));
  const limit = +flag('--limit', 0);
  const split = JSON.parse(fs.readFileSync(path.join(OUT, 'split.json'), 'utf8'));
  const want = new Set(split.test_ids);
  const dir = path.join(ROOT, 'data', 'raw', 'games.gen9championsvgc2026regmcbo3');
  const logs = [];
  const shards = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.jsonl.gz')).sort()) {
    let hit = 0;
    for (const line of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8').split('\n')) {
      if (!line) continue;
      const r = JSON.parse(line);
      if (want.has(r.id)) { logs.push({ id: r.id, log: r.log }); want.delete(r.id); hit++; }
    }
    if (hit) shards.push({ file: f, games: hit });
  }
  const games = limit ? logs.slice(0, limit) : logs;
  process.stderr.write(`held-out games found ${logs.length} of ${split.test_ids.length}; running ${games.length} on ${W} workers\n`);
  const t0 = Date.now();
  const parts = Array.from({ length: W }, () => []);
  games.forEach((g, i) => parts[i % W].push(g));
  let done = 0; const results = [];
  for (const p of parts) {
    const child = fork(__filename, [], { env: { ...process.env, XATU_WORKER: '1' }, execArgv: ['--max-old-space-size=450'] });
    child.on('message', r => { results.push(r); done++; process.stderr.write(`worker done ${done}/${W} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`); if (done === W) finish(); });
    child.send({ logs: p });
  }
  function finish() {
    const agg = { games: 0, order_obs: 0, damage_obs: 0, stats: {}, skipped: {}, contradictions: [], anomalies: [], touched: {}, errors: [] };
    for (const r of results) {
      agg.games += r.games; agg.order_obs += r.order_obs; agg.damage_obs += r.damage_obs;
      for (const k of ['stats', 'skipped']) for (const [x, v] of Object.entries(r[k])) agg[k][x] = (agg[k][x] || 0) + v;
      agg.contradictions.push(...r.contradictions); agg.anomalies.push(...r.anomalies); agg.errors.push(...r.errors);
      for (const [st, b] of Object.entries(r.touched)) { const a = (agg.touched[st] = agg.touched[st] || { n: 0, alive: 0, narrowed: 0, bits: 0 }); a.n += b.n; a.alive += b.alive; a.narrowed += b.narrowed; a.bits += b.bits; }
    }
    for (const b of Object.values(agg.touched)) { b.mean_alive = +(b.alive / b.n).toFixed(2); b.frac_narrowed = +(b.narrowed / b.n).toFixed(4); b.mean_bits = +(b.bits / b.n).toFixed(3); }
    const X = require('../human/dex.js');
    const out = { generated: new Date().toISOString(), generator: 'solver/xatu/eval_spreads.js', flags: { workers: W, limit },
      split: { file: 'solver/out/xatu/split.json', generated: split.generated, test_ids: split.test_ids.length, found_in_raw: logs.length },
      shards, showdown: { path: X.SHOWDOWN_PATH, head: X.checkoutCommit() }, seconds: (Date.now() - t0) / 1000, ...agg };
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'spread-eval.json'), JSON.stringify(out, null, 1));
    console.log(JSON.stringify({ games: out.games, order_obs: out.order_obs, damage_obs: out.damage_obs, stats: out.stats, contradictions: out.contradictions.length, anomalies: out.anomalies.length, errors: out.errors.length, touched: out.touched, seconds: out.seconds }, null, 1));
  }
}

module.exports = { runGames };
