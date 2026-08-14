/* test-farm-ram-guard.js — the farm may not start more workers than the machine can hold.
 *
 * THE REGRESSION THIS PINS. 2026-08-14: mew_farm's default is core-based (0.75 * cpus, capped 16) and
 * picked 12 on a 13.3 GB box. A MILTANK worker measured 663-867 MB fresh and 1,948 MB after an 8h28m
 * run, so 12 workers is ~10 GB before growth. The machine swaps; a swapping desktop reads as FROZEN,
 * not as slow, which is why the failure was reported twice as a force-quit and misdiagnosed twice as
 * something outside this repo.
 *
 * The fix is a computed cap rather than a remembered `--procs 3`, for the same reason mew_farm already
 * refuses unknown flags instead of trusting the caller's list.
 */
'use strict';
const { ramCap } = require('../engine/ram_cap.js');

let fail = 0;
function ok(name, cond, detail) {
  if (cond) { console.log(`  ok   ${name}`); return; }
  console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
  fail++;
}

console.log('FARM RAM GUARD');

/* 1. THE ACTUAL REGRESSION. 13.3 GB box with ~9.5 GB available, MILTANK workers, core default of 12.
 *    Anything that still grants double digits here has not fixed the bug. */
{
  const r = ramCap({ availMB: 9500, reserveMB: 3000, workerMB: 1200, asked: 12 });
  ok('13.3GB box does not grant 12 MILTANK workers', r.granted < 12, `granted ${r.granted}`);
  ok('and grants at least one', r.granted >= 1, `granted ${r.granted}`);
  ok('grants exactly what the budget affords', r.granted === Math.floor((9500 - 3000) / 1200),
    `granted ${r.granted}, expected ${Math.floor((9500 - 3000) / 1200)}`);
}

/* 2. A machine with room is NOT capped — a guard that always narrows would be quietly throwing away
 *    the parallelism the farm exists for, which is the same mistake as serialising the divisions. */
{
  const r = ramCap({ availMB: 64000, reserveMB: 3000, workerMB: 1200, asked: 12 });
  ok('a big machine gets everything it asked for', r.granted === 12, `granted ${r.granted}`);
}

/* 3. REFUSAL, not a silent 1. When the budget cannot hold a single worker the caller must be able to
 *    tell "none fit" from "one fits", because those need different responses. */
{
  const r = ramCap({ availMB: 3200, reserveMB: 3000, workerMB: 1200, asked: 8 });
  ok('no room -> granted 0 so the caller can refuse', r.granted === 0, `granted ${r.granted}`);
}

/* 4. Reserve is genuinely subtracted. Without it the cap would hand out every byte and leave the
 *    desktop with nothing, which protects nobody. */
{
  const withR = ramCap({ availMB: 9500, reserveMB: 3000, workerMB: 1200, asked: 99 });
  const noR = ramCap({ availMB: 9500, reserveMB: 0, workerMB: 1200, asked: 99 });
  ok('reserve reduces the grant', withR.granted < noR.granted, `${withR.granted} vs ${noR.granted}`);
}

/* 5. `fits` is reported independently of `granted`, so a run can say HOW FAR it was cut rather than
 *    only what it settled on. */
{
  const r = ramCap({ availMB: 64000, reserveMB: 3000, workerMB: 1200, asked: 2 });
  ok('fits reports capacity, not the request', r.fits > r.granted, `fits ${r.fits}, granted ${r.granted}`);
}

/* 6. A zero or negative worker cost is a caller bug and must throw rather than divide by zero and
 *    grant Infinity workers — which would be the original freeze with a guard in front of it. */
{
  let threw = false;
  try { ramCap({ availMB: 9500, reserveMB: 3000, workerMB: 0, asked: 8 }); } catch (e) { threw = true; }
  ok('workerMB of 0 throws instead of granting Infinity', threw);
}

console.log(fail ? `\nFARM RAM GUARD: ${fail} FAILED` : '\nFARM RAM GUARD: all passed');
process.exit(fail ? 1 : 0);
