/* solver/miltank/pool.js — MILTANK's cell fill across WORKER PROCESSES.
 *
 *   const P = await require('./solver/miltank/pool.js').create({ workers: 4 });
 *   const r = await P.fill({ S, side, opp, rows, cols, belief:{sheet, revealed:Set}, depth, baseSeed, deadline | budgetMs, maxPasses });
 *     -> { sum:[m][n], cnt:[m][n], passes, playouts, workers, cut, late }
 *     deadline = an absolute Date.now() instant (search.js passes one); budgetMs = ms from now (older callers)
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
 * THE PARENT DOES NOT WAIT FOR ITS WORKERS (2026-09-25, docs/_reports/2026-09-25-miltank-deadline.md). Each
 * worker plays a pass in 40 ms slices and SENDS THE PASS SO FAR after every slice, and a timer resolves the fill at the deadline (+ GRACE_MS for a pass
 * already on the wire) with every pass that has arrived — in pass order, so the identity above still holds for
 * the passes that are in. Workers still out are sent a cancel and counted (`late`, `counters.lateWorkers`); a
 * message that arrives for a fill already resolved is dropped and counted (`counters.lateMessages`). The first
 * version awaited Promise.all over the workers, so a worker the OS starved of CPU (the pool runs BELOW_NORMAL)
 * held the whole decision: 28 s and 39 s at a 5 s budget in the arena. The deadline is ABSOLUTE, so a worker that
 * picks a job up late (it was still finishing the last one, or it was not scheduled) starts no pass past it.
 * MILTANK_DEADLINE_BREAK=1 removes the timer: the fill waits for every worker again.
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

const GRACE_MS = 10;
const DEADLINE_BREAK = process.env.MILTANK_DEADLINE_BREAK || '';

async function create(o) {
  o = o || {};
  const N = Math.max(1, o.workers | 0);
  const procs = [];
  for (let w = 0; w < N; w++) {
    procs.push(cp.fork(WORKER, [], { serialization: 'advanced', env: Object.assign({}, process.env, o.env || {}),
                                     stdio: ['ignore', 'ignore', 'inherit', 'ipc'] }));
  }
  let seq = 0, closing = false, dead = null;
  const pending = new Map();   // id -> { onMsg(m, w), fail(err) }
  const counters = {};
  const bump = (k, v) => { counters[k] = (counters[k] || 0) + (v == null ? 1 : v); };
  procs.forEach((c, w) => {
    c.on('message', m => { const p = pending.get(m.id); if (!p) { if (m.type === 'pass' || m.type === 'done') bump('lateMessages'); return; } p.onMsg(m, w); });
    c.on('exit', code => {
      if (closing) return;
      dead = 'a pool worker exited (code ' + code + ')';
      for (const p of [...pending.values()]) p.fail(new Error(dead));
      pending.clear();
    });
  });
  const ping = c => new Promise((resolve, reject) => {
    if (dead) return reject(new Error(dead));
    const id = ++seq;
    pending.set(id, { onMsg: m => { pending.delete(id); if (m.error) reject(new Error('pool worker: ' + m.error)); else resolve(m); }, fail: reject });
    c.send({ id, type: 'ping' });
  });
  /* wait until every worker has loaded the engine, so the first decision's clock is not spent on require() */
  await Promise.all(procs.map(c => ping(c)));

  /* one fill: every worker gets the job; passes stream back; resolve when all are done OR at the deadline */
  function fillRaw(job) {
    const deadline = job.deadline != null ? job.deadline : Date.now() + job.budgetMs;
    return new Promise((resolve, reject) => {
      if (dead) return reject(new Error(dead));
      const id = ++seq;
      /* the LATEST snapshot of each (worker, pass): a worker sends a pass after every slice, NaN in the cells not yet
       * played, and the last one it sent is what it had. Keyed by worker AND pass, not by pass: two workers sending
       * the same pass is a striding bug, and a key on p alone would hide it (the POOL clause's stride break). */
      const got = new Map();
      const done = new Array(N).fill(false);
      let nDone = 0, timer = null, over = false, stoppedAny = false;
      const finish = (why, err) => {
        if (over) return;
        over = true;
        if (timer) clearTimeout(timer);
        pending.delete(id);
        if (err) return reject(err);
        let late = 0;
        procs.forEach((c, w) => { if (!done[w]) { late++; try { c.send({ id, type: 'cancel' }); } catch (e) {} } });
        if (late) { bump('lateWorkers', late); bump('deadlineResolves'); }
        const all = [...got.values()].sort((a, b) => a.p - b.p);
        resolve(Object.assign(all, { late, why, stopped: stoppedAny || why === 'deadline' }));
      };
      pending.set(id, {
        onMsg(m, w) {
          if (m.error) return finish('error', new Error('pool worker: ' + m.error));
          if (m.type === 'pass') { got.set(w + ':' + m.p, { p: m.p, v: m.v }); return; }
          if (m.type === 'done') {
            for (const k in m.counters) bump(k, m.counters[k]);
            if (m.stopped) stoppedAny = true;
            if (!done[w]) { done[w] = true; if (++nDone === N) finish('all'); }
          }
        },
        fail: err => finish('error', err),
      });
      procs.forEach((c, w) => c.send({ id, type: 'fill', job: Object.assign({}, job, { deadline, budgetMs: undefined, worker: w, workers: N }) }));
      const wait = deadline + GRACE_MS - Date.now();
      /* no timer for an unbounded fill (a pass cap with a huge budget): setTimeout past 2^31 ms would fire at once */
      if (!DEADLINE_BREAK && Number.isFinite(wait) && wait < 2 ** 31 - 1) timer = setTimeout(() => finish('deadline'), Math.max(0, wait));
    });
  }
  async function fill(job) {
    const all = await fillRaw(job);
    return Object.assign(accumulate(job.rows.length, job.cols.length, all.map(x => x.v)), { workers: N, cut: !!all.stopped, late: all.late });
  }
  function close() { closing = true; for (const c of procs) { try { c.kill(); } catch (e) {} } }
  return { fill, fillRaw, close, counters, workers: N, pids: procs.map(c => c.pid) };
}

module.exports = { create, WORKER };
