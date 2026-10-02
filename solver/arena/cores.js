/* solver/arena/cores.js — how many worker processes a SOLVER run may fork on this machine (2026-10-02,
 * docs/_reports/2026-10-02-parallelism.md).
 *
 *   const CORES = require('./solver/arena/cores.js');
 *   const prof = CORES.profile(argv)            'dedicated' (default) | 'shared'   from --machine, else env ABRA_MACHINE
 *   CORES.cap(kind, prof)                       the most processes a run of this kind may keep busy
 *   CORES.defaultWorkers(kind, prof)            the --workers a run gets when it names none
 *   CORES.check(kind, workers, prof, perWorker) throws past the cap; perWorker = cores one worker keeps busy
 *                                               (a game shard whose agent fills its cells in a pool of P workers: P)
 *   kind: 'sprt' (solver/machamp/sprt.js), 'gate' (solver/machamp/gate.js), 'mew' (solver/mew/run.js self-play)
 *
 * WHY THE OLD CAPS EXISTED, AND WHY THEY ARE A PROFILE NOW. sprt.js refused more than 3 workers from 02156176
 * (2026-09-25, no reason given in the code or the commit), gate.js more than 4, and mew/run.js more than 4 with the reason
 * written beside it: "on this machine (other agents share it)". That reason is real and is kept: four division agents
 * and a live ladder client run on this 16-core, 13 GB box at once, and a TIMED game starved of CPU searches less than
 * its spec says (24% fallbacks once beside eight agents and the ladder). So the old caps are the `shared` profile,
 * selectable with --machine shared (or ABRA_MACHINE=shared), and recorded in every artifact that takes a profile.
 * `dedicated` is the machine with nothing else heavy on it: every logical core but HEADROOM, which is left for the
 * desktop and the coordinator that polls the shards.
 *
 * THE DEDICATED DEFAULTS ARE MEASURED, not chosen (docs/_reports/2026-10-02-parallelism.md, release 74972dd2db89): on
 * THIS machine they stay the shared values. Under sustained load on more than ~3 cores the laptop's CPU drops to 12.5% of
 * its clock about half the time, so the whole machine's search throughput is flat in the worker count (~3,000 playouts
 * per 2 s at 3, 6, 10 and 14 match workers): more workers divide each decision's search (1,048 -> 208 playouts) to buy
 * games per hour (353 -> 990). A timed SPRT at 14 workers would measure a much weaker searcher than the ladder plays. On
 * a host whose throughput scales, re-run solver/bench/throughput.js and set DEDICATED_DEFAULT from it.
 */
'use strict';
const os = require('os');

const HEADROOM = 2;                                  // logical cores left free for the desktop and the coordinator
const SHARED = { sprt: 3, gate: 4, mew: 4 };          // the caps as they were (other agents share the machine)
const SHARED_DEFAULT = { sprt: 3, gate: 4, mew: 4 };   // the --workers defaults as they were
/* the dedicated defaults on this machine: measured, and equal to the shared values (see the header) */
const DEDICATED_DEFAULT = { sprt: 3, gate: 4, mew: 4 };

function logical() { return os.cpus().length || 1; }

function profile(argv) {
  argv = argv || process.argv.slice(2);
  const i = argv.indexOf('--machine');
  const p = i >= 0 ? argv[i + 1] : (process.env.ABRA_MACHINE || 'dedicated');
  if (!['dedicated', 'shared'].includes(p)) throw new Error('--machine must be dedicated or shared (got ' + p + ')');
  return p;
}
function cap(kind, prof) {
  if (!(kind in SHARED)) throw new Error('cores: unknown kind ' + kind);
  return prof === 'shared' ? SHARED[kind] : Math.max(1, logical() - HEADROOM);
}
function defaultWorkers(kind, prof) {
  const d = prof === 'shared' ? SHARED_DEFAULT[kind] : DEDICATED_DEFAULT[kind];
  return Math.min(d, cap(kind, prof));
}
function check(kind, workers, prof, perWorker) {
  const per = Math.max(1, perWorker | 0), c = cap(kind, prof);
  if (!(workers >= 1)) throw new Error(kind + ': --workers must be at least 1');
  if (workers * per > c) throw new Error(kind + ': ' + workers + ' workers' + (per > 1 ? ' x ' + per + ' pool processes' : '') + ' exceed the ' + prof + ' cap of ' + c +
    ' busy processes on this machine (' + logical() + ' logical cores' + (prof === 'shared' ? ', shared profile: the old cap' : ', ' + HEADROOM + ' left for the desktop') + '); pass --machine shared|dedicated');
  return { profile: prof, cap: c, workers, per_worker: per, logical_cores: logical(), headroom: prof === 'shared' ? null : HEADROOM };
}

module.exports = { profile, cap, defaultWorkers, check, HEADROOM, SHARED, SHARED_DEFAULT, DEDICATED_DEFAULT, logical };
