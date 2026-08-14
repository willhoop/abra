/* ram_cap.js — how many worker processes this machine can actually hold.
 *
 * ITS OWN FILE FOR ONE REASON: mew_farm.js has no `require.main === module` guard, so it starts
 * spawning workers the instant it is required. A test that imported the cap from there would launch
 * the farm as a side effect of checking its arithmetic. A pure function in a separate module can be
 * tested without starting anything.
 *
 * WHY THE CAP EXISTS. A worker is a whole Node process holding the store, the dex and the tags.
 * Measured 2026-08-14 on a 13.3 GB machine: a MILTANK worker is 663-867 MB fresh and had reached
 * 1,948 MB after an 8h28m run. mew_farm's default is core-based and picks 12 here — roughly 10 GB
 * before any growth. The machine swaps, and a swapping desktop does not look slow, it looks FROZEN,
 * which is the force-quit that got misdiagnosed twice as something outside this repo.
 */
'use strict';

/* availMB   what the OS says is available (os.freemem()).
 * reserveMB what the desktop needs and the run may not take.
 * workerMB  measured cost of one worker.
 * asked     what the caller requested.
 *
 * `fits` is reported separately from `granted` so a caller can say how far it was cut, rather than
 * only what it ended up with. A run that was quietly narrowed is not the run that was requested. */
function ramCap({ availMB, reserveMB, workerMB, asked }) {
  if (!(workerMB > 0)) throw new Error('ram_cap: workerMB must be positive');
  const budget = availMB - reserveMB;
  const fits = Math.floor(budget / workerMB);
  return { fits, granted: Math.max(0, Math.min(asked, fits)), budget };
}

module.exports = { ramCap };
