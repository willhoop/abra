/* solver/miltank/pool_worker.js — one worker of solver/miltank/pool.js. Its own engine, its own rollout.
 *
 * Messages: { id, type:'ping' } -> { id, ok }
 *           { id, type:'fill', job } -> { id, passes:[{p, v}], counters }
 * job = cells.js's job plus { worker, workers, budgetMs, maxPasses }. This worker plays passes
 * worker, worker+workers, … (never past maxPasses) until its clock runs out. The clock starts when the
 * message arrives: budgetMs is what the parent had LEFT when it sent the job.
 */
'use strict';
const os = require('os');
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* not fatal: lownode already set it */ }
require('../arena/env.js');
/* the parent's engine: a frozen release when the arena was given --release (SOLVER_RELEASE), else the live tree */
const API = require('../arena/engine.js').load(process.env.SOLVER_RELEASE || null).API;
const T = require('../arena/teams.js');
const R = require('./rollout.js').create(API, { buildBody: T.buildBody });
const C = require('./cells.js');
const BREAK = process.env.MILTANK_POOL_BREAK || '';
const threadCpu = () => { const u = process.threadCpuUsage ? process.threadCpuUsage() : process.cpuUsage(); return u.user + u.system; };

process.on('message', msg => {
  try {
    if (msg.type === 'ping') { API.M; process.send({ id: msg.id, ok: true }); return; }
    if (msg.type !== 'fill') throw new Error('unknown message ' + msg.type);
    const job = msg.job;
    const deadline = Date.now() + job.budgetMs;
    const before = Object.assign({}, R.COUNTERS);
    const cpu0 = threadCpu();
    const passes = [];
    const step = BREAK === 'stride' ? 1 : job.workers;
    for (let p = BREAK === 'stride' ? 0 : job.worker; !job.maxPasses || p < job.maxPasses; p += step) {
      if (passes.length && Date.now() >= deadline) break;
      const r = C.playPass(API, R, job, p, deadline);
      passes.push({ p: r.p, v: r.v });
      if (r.stopped) break;
    }
    const counters = {};
    for (const k in R.COUNTERS) counters[k] = R.COUNTERS[k] - (before[k] || 0);
    counters.cpu_ms = (threadCpu() - cpu0) / 1000;   // this worker's main-thread cpu for the job: load-independent cost
    process.send({ id: msg.id, passes, counters });
  } catch (e) {
    process.send({ id: msg.id, error: String(e && e.stack || e).slice(0, 2000) });
  }
});
