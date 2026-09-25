/* solver/miltank/pool_worker.js — one worker of solver/miltank/pool.js. Its own engine, its own rollout.
 *
 * Messages in:  { id, type:'ping' }                 -> { id, ok }
 *               { id, type:'fill', job }            -> { id, type:'pass', p, v, final } per slice (v: the pass so far), then { id, type:'done', counters, stopped }
 *               { id, type:'cancel' }               -> the fill `id` starts no further pass (its 'done' still comes)
 * job = cells.js's job plus { worker, workers, deadline, maxPasses }. This worker plays passes worker, worker+workers,
 * … (never past maxPasses). THE DEADLINE IS AN ABSOLUTE Date.now() INSTANT, and no pass starts at or after it — not
 * even the first: a worker that picks the job up late (still busy, or not scheduled) plays nothing and says done.
 * Each pass is played in 40 ms SLICES and the pass so far is SENT after every slice; the loop yields between slices
 * (setImmediate) so a cancel can be read and the sends flushed; the parent resolves at its deadline with whatever has arrived (docs/_reports/2026-09-25-miltank-deadline.md).
 * MILTANK_DEADLINE_BREAK=1: the first pass always starts, as before 2026-09-25.
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

const DEADLINE_BREAK = process.env.MILTANK_DEADLINE_BREAK || '';
const cancelled = new Set();

/* WARM THE DEX AT PING, NOT IN THE FIRST DECISION. A world's first body build (teams.js buildBody) touches the Reg M-C
 * dex, and Showdown loads its data tables on first access: ~1.9 s of main-thread cpu, measured in a worker's first
 * slice (docs/_reports/2026-09-25-miltank-deadline.md). The pool awaits every ping before its first fill, so this
 * cost now lands at start-up. Every table is walked whole, so nothing here names an entity. */
let warmed = false;
function warm() {
  if (warmed) return;
  const X = require('../human/dex.js');
  for (const k of ['species', 'moves', 'items', 'abilities']) X.D[k].all();
  warmed = true;
}

process.on('message', msg => {
  try {
    if (msg.type === 'ping') { API.M; warm(); process.send({ id: msg.id, ok: true }); return; }
    if (msg.type === 'cancel') { cancelled.add(msg.id); if (cancelled.size > 64) cancelled.delete(cancelled.values().next().value); return; }
    if (msg.type !== 'fill') throw new Error('unknown message ' + msg.type);
    runFill(msg.id, msg.job);
  } catch (e) {
    process.send({ id: msg.id, error: String(e && e.stack || e).slice(0, 2000) });
  }
});

const SLICE_MS = 40;

/* one fill: passes worker, worker+workers, … each played in SLICES of SLICE_MS, yielding between slices. After every
 * slice the pass so far is SENT (a snapshot: unplayed cells are NaN), so what this worker has done reaches the parent
 * even when the parent's deadline falls mid-pass — the first streaming version sent a pass only when it ended, and a
 * pass that straddled the deadline arrived after the parent had resolved, discarding the whole pass. */
function runFill(id, job) {
  const deadline = job.deadline != null ? job.deadline : Date.now() + job.budgetMs;
  const counters = {};
  const step = BREAK === 'stride' ? 1 : job.workers;
  let p = BREAK === 'stride' ? 0 : job.worker, played = 0, stopped = false, run = null;
  const next = () => {
    try {
      if (!run) {
        const capped = job.maxPasses && p >= job.maxPasses;
        const late = Date.now() >= deadline && (played > 0 || !DEADLINE_BREAK);
        if (capped || late || stopped || cancelled.has(id)) {
          cancelled.delete(id);
          process.send({ id, type: 'done', counters, stopped: stopped || late });
          return;
        }
        run = C.passRunner(API, R, job, p);
      }
      if (cancelled.has(id)) { stopped = true; run = null; return setImmediate(next); }
      const before = Object.assign({}, R.COUNTERS), cpu0 = threadCpu();
      const why = run.step(deadline, Date.now() + SLICE_MS);
      for (const k in R.COUNTERS) counters[k] = (counters[k] || 0) + R.COUNTERS[k] - (before[k] || 0);
      counters.cpu_ms = (counters.cpu_ms || 0) + (threadCpu() - cpu0) / 1000;   // main-thread cpu: load-independent cost
      process.send({ id, type: 'pass', p: run.p, v: run.v, final: why !== 'slice' });
      if (why !== 'slice') { run = null; played++; p += step; if (why === 'deadline') stopped = true; }
      setImmediate(next);
    } catch (e) {
      process.send({ id, error: String(e && e.stack || e).slice(0, 2000) });
    }
  };
  next();
}
