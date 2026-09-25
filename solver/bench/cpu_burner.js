/* solver/bench/cpu_burner.js — ARTIFICIAL CPU LOAD for solver/bench/deadline_bench.js. One spinning process.
 *
 *   node solver/bench/cpu_burner.js --seed 1 [--starve 0.35] [--idle 0] [--log <file.jsonl>] [--mode mixed|fair|starve|idle]
 *
 * It runs forever in EPISODES, drawn from its own seeded stream (mixed mode: starve with probability --starve, idle
 * with probability --idle, otherwise fair):
 *   fair    BELOW_NORMAL priority, 1.5–5 s: the same class as MILTANK's pool workers, so the core is SHARED — the
 *           arena's "100% CPU, 19 node processes" load.
 *   starve  NORMAL priority, 0.5–8 s: one class ABOVE the pool workers, so a worker on the same core runs only
 *           when Windows' starvation boost lets it. This is the load that turns a 5 s budget into a 28 s decision
 *           if the decision waits for its slowest worker.
 *   idle    asleep, 1–4 s: the machine's quiet moments, where the search has the core to itself.
 * Every episode is appended to --log as { t0, t1, mode } (epoch ms) so a slow decision can be matched to the
 * episode it fell in. It exits by itself when its parent is gone (checked every episode); it never kills anything.
 *
 * It runs only inside the processor-affinity mask its parent set (a child inherits the mask), so the load it
 * adds to the machine is at most the cores the bench was confined to.
 */
'use strict';
const os = require('os');
const fs = require('fs');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
let s = (+flag('--seed', 1) >>> 0) || 1;
const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
const P_STARVE = +flag('--starve', 0.35), P_IDLE = +flag('--idle', 0);
const MODE = flag('--mode', 'mixed');
const LOG = flag('--log', null);
const PRI = os.constants.priority;

let sink = 0;
function spin(ms) { const end = Date.now() + ms; while (Date.now() < end) for (let i = 0; i < 20000; i++) sink += Math.sqrt(i + sink % 7); }
const PARENT = process.ppid;
const parentAlive = () => { try { process.kill(PARENT, 0); return true; } catch (e) { return false; } };
for (;;) {
  if (!parentAlive()) process.exit(0);   // never outlive the bench: an orphan burner would spin forever
  const u = rnd();
  const mode = MODE !== 'mixed' ? MODE : u < P_STARVE ? 'starve' : u < P_STARVE + P_IDLE ? 'idle' : 'fair';
  const ms = mode === 'starve' ? 500 + rnd() * 7500 : mode === 'idle' ? 1000 + rnd() * 3000 : 1500 + rnd() * 3500;
  const t0 = Date.now();
  if (mode === 'idle') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  else {
    try { os.setPriority(0, mode === 'starve' ? PRI.PRIORITY_NORMAL : PRI.PRIORITY_BELOW_NORMAL); } catch (e) {}
    spin(ms);
  }
  if (LOG) fs.appendFileSync(LOG, JSON.stringify({ t0, t1: Date.now(), mode }) + '\n');
}
