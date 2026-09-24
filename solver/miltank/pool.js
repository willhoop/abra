/* solver/miltank/pool.js — MILTANK's cell fill across WORKER PROCESSES.
 *
 *   const P = await require('./solver/miltank/pool.js').create({ workers: 4 });
 *   const r = await P.fill({ S, side, opp, rows, cols, belief:{sheet, revealed:Set}, depth, baseSeed, budgetMs, maxPasses });
 *     -> { sum:[m][n], cnt:[m][n], passes, playouts, workers }
 *   P.fillRaw(job) -> [{ p, v }] every pass played, in pass order
 *   P.counters     the workers' rollout counters, summed (worlds, playouts, bodiesSwapped, …)
 *   P.close();
 * The job's shape and the pass itself are solver/miltank/cells.js — the serial loop runs the same code.
 *
 * WHY PROCESSES. engine/medicham_api.js is one-battle-steps-at-a-time PER PROCESS: the engine keeps module
 * globals (MID_*, TRACE, the counters) and re-entrancy was never audited. So parallelism is N processes,
 * each with its own engine, exactly as the API header says. Each worker is forked once and reused for every
 * decision of a run; a decision ships S (about 10 KB, V8-serialised with its cycles intact — the IPC
 * channel is opened with `serialization: 'advanced'`, the same serializer structuredClone uses).
 *
 * THE SAME CELLS AS ONE PROCESS. Pass p is a pure function of (job, p) (cells.js). Worker w plays passes
 * w, w+N, w+2N, … and returns each pass's raw cell values; the parent ADDS THEM IN PASS ORDER. Floating-point
 * addition does not associate, so summing each worker's partial sums would differ from the serial loop in
 * the last bit; pass-order accumulation is the serial loop's exact sequence of additions. With a pass cap
 * (`maxPasses`) the pooled matrix is therefore IDENTICAL, bit for bit, to the serial one —
 * solver/tests/test-playout-speed.js asserts that, it does not assume it. Under a clock the pool fills more
 * passes; a worker whose clock runs out mid-pass returns that pass part-filled (NaN = not played), exactly
 * as the serial loop leaves its last pass.
 *
 * PRIORITY. Workers set themselves BELOW_NORMAL (CLAUDE.md: every heavy run goes through lownode). A child
 * of a BELOWNORMAL process inherits that class on Windows anyway; the explicit call makes it true when the
 * parent was launched some other way.
 *
 * DELIBERATE BREAK (env MILTANK_POOL_BREAK=stride, read by the worker): every worker plays passes 0,1,2,…
 * instead of its own stride, so the pool repeats worlds instead of adding new ones. The IDENTITY clause of
 * solver/tests/test-playout-speed.js must go red under it.
 */
'use strict';
const path = require('path');
const cp = require('child_process');
const { accumulate } = require('./cells.js');

const WORKER = path.join(__dirname, 'pool_worker.js');

async function create(o) {
  o = o || {};
  const N = Math.max(1, o.workers | 0);
  const procs = [];
  for (let w = 0; w < N; w++) {
    procs.push(cp.fork(WORKER, [], { serialization: 'advanced', env: Object.assign({}, process.env, o.env || {}),
                                     stdio: ['ignore', 'ignore', 'inherit', 'ipc'] }));
  }
  let seq = 0, closing = false, dead = null;
  const pending = new Map();
  for (const c of procs) {
    c.on('message', m => { const p = pending.get(m.id); if (!p) return; pending.delete(m.id); if (m.error) p.reject(new Error('pool worker: ' + m.error)); else p.resolve(m); });
    c.on('exit', code => {
      if (closing) return;
      dead = 'a pool worker exited (code ' + code + ')';
      for (const p of pending.values()) p.reject(new Error(dead));
      pending.clear();
    });
  }
  const ask = (c, msg) => new Promise((resolve, reject) => {
    if (dead) return reject(new Error(dead));
    const id = ++seq; pending.set(id, { resolve, reject }); c.send(Object.assign({ id }, msg));
  });
  /* wait until every worker has loaded the engine, so the first decision's clock is not spent on require() */
  await Promise.all(procs.map(c => ask(c, { type: 'ping' })));

  const counters = {};
  async function fillRaw(job) {
    const t0 = Date.now();
    const rs = await Promise.all(procs.map((c, w) => ask(c, {
      type: 'fill', job: Object.assign({}, job, { worker: w, workers: N, budgetMs: job.budgetMs - (Date.now() - t0) }),
    })));
    const all = [];
    for (const r of rs) {
      for (const pv of r.passes) all.push(pv);
      for (const k in r.counters) counters[k] = (counters[k] || 0) + r.counters[k];
    }
    return all.sort((a, b) => a.p - b.p);
  }
  async function fill(job) {
    const all = await fillRaw(job);
    return Object.assign(accumulate(job.rows.length, job.cols.length, all.map(x => x.v)), { workers: N });
  }
  function close() { closing = true; for (const c of procs) { try { c.kill(); } catch (e) {} } }
  return { fill, fillRaw, close, counters, workers: N, pids: procs.map(c => c.pid) };
}

module.exports = { create, WORKER };
