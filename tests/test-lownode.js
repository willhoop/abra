/* test-lownode.js — proves tools/lownode.cmd is safe to route every heavy run through.
 *
 * WHY IT EXISTS. Will, 2026-08-11: "U KEEP FREEZING UP AND I HAVE TO FORCE CLOSE YOU", then
 * "NO WE CAN HAVE SEVERAL AGENTS, DO NUMBER 3" — keep the parallelism, drop the priority.
 *
 * THE DANGEROUS FAILURE IS NOT A SLOW RUN, IT IS A SWALLOWED EXIT CODE. Every gate in this repo
 * is read as `node tests/x.js && echo GREEN || echo RED`. A wrapper that returned 0 for a failing
 * script would turn every red test green everywhere at once, silently, which is strictly worse
 * than the freezing it was written to fix. `start /WAIT` propagating ERRORLEVEL is the load-bearing
 * claim in that file and it is ASSERTED here rather than assumed.
 *
 * The priority assertion is Windows-only by construction — the wrapper is a .cmd. On any other
 * platform that one check reports SKIP rather than failing, because a test that cannot run is not
 * a test that passed. */
const { execFileSync, spawn } = require('child_process');
const path = require('path');

/* Node >=20 refuses to spawn a .cmd directly (the 2024 batch-injection advisory). Going through
 * cmd.exe explicitly is the fix. Setting `shell: true` would also work and would reintroduce
 * exactly the quoting hazard that refusal exists to prevent, so it is not used here.
 *
 * SHOWN RED BEFORE BEING TRUSTED, 2026-08-11: with `exit /b %ERRORLEVEL%` deleted from the .cmd
 * this file reports 3 passed, 1 failed — "A FAILING SCRIPT WAS REPORTED AS SUCCESS" — then 4
 * passed once restored. */
const WRAP = path.join(__dirname, '..', 'tools', 'lownode.cmd');
let pass = 0, fail = 0;
const ok = (m) => { console.log('  ok    ' + m); pass++; };
const bad = (m) => { console.log('  FAIL  ' + m); fail++; };

console.log('LOWNODE WRAPPER');

/* 1. stdout reaches the caller. A wrapper that ate output would make every run unreadable. */
try {
  const out = execFileSync('cmd.exe', ['/c', WRAP, '-e', 'console.log("marker-7731")'], { encoding: 'utf8' });
  out.includes('marker-7731') ? ok('stdout reaches the caller') : bad('stdout LOST: ' + JSON.stringify(out));
} catch (e) { bad('stdout arm threw: ' + e.message); }

/* 2. SUCCESS is reported as success. */
try {
  execFileSync('cmd.exe', ['/c', WRAP, '-e', 'process.exit(0)'], { stdio: 'ignore' });
  ok('exit 0 propagates as success');
} catch (e) { bad('a PASSING script was reported as failure — every green test would read red'); }

/* 3. FAILURE is reported as failure. THIS IS THE ONE THAT MATTERS.
 * Shown red before being trusted: with `exit /b %ERRORLEVEL%` removed from the .cmd this arm
 * fails, which is the whole reason that line is there. */
let sawFailure = false, code = null;
try { execFileSync('cmd.exe', ['/c', WRAP, '-e', 'process.exit(3)'], { stdio: 'ignore' }); }
catch (e) { sawFailure = true; code = e.status; }
if (!sawFailure) bad('A FAILING SCRIPT WAS REPORTED AS SUCCESS. Every gate in this repo would read green.');
else if (code !== 3) bad('failure detected but the code was mangled: ' + code + ', expected 3');
else ok('exit 3 propagates as failure, code intact — a red test still reads red');

/* 4. the priority is actually BELOWNORMAL. The entire point; unverified it is a comment. */
if (process.platform !== 'win32') {
  console.log('  SKIP  priority arm — not win32, and the wrapper is a .cmd');
} else {
  const child = spawn('cmd.exe', ['/c', WRAP, '-e', 'const t=Date.now();while(Date.now()-t<9000){Math.sqrt(Math.random())}'],
    { stdio: 'ignore', detached: false });
  const deadline = Date.now() + 6000;
  let seen = null;
  /* `start` spawns node as a GRANDCHILD, so the pid we hold is the cmd shell. Ask Windows for the
   * node process whose command line carries this probe's own marker rather than guessing a pid. */
  while (Date.now() < deadline && !seen) {
    try {
      const q = execFileSync('powershell', ['-NoProfile', '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | " +
        "Where-Object { $_.CommandLine -like '*Math.sqrt(Math.random())*' } | " +
        "ForEach-Object { (Get-Process -Id $_.ProcessId).PriorityClass }"], { encoding: 'utf8', timeout: 15000 });
      const t = q.trim();
      if (t) seen = t.split(/\r?\n/)[0].trim();
    } catch (e) { /* the window can be missed; loop */ }
  }
  try { child.kill(); } catch (e) {}
  try {
    execFileSync('powershell', ['-NoProfile', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | " +
      "Where-Object { $_.CommandLine -like '*Math.sqrt(Math.random())*' } | " +
      "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { timeout: 15000 });
  } catch (e) {}
  if (!seen) bad('could not observe the child priority at all — the arm proves nothing, treat as red');
  else if (seen !== 'BelowNormal') bad('priority is ' + seen + ', expected BelowNormal — the wrapper is not doing its job');
  else ok('the child node runs at BelowNormal, so a foreground window can always take a core back');
}

console.log('\nLOWNODE: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
