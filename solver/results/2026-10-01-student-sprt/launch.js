/* solver/results/2026-10-01-student-sprt/launch.js — start the pre-registered student SPRT, guarded against the ladder.
 *
 *   node solver/results/2026-10-01-student-sprt/launch.js [--wait-free-min 30] [--now]
 *
 * THE LADDER HAS PRIORITY (Will, 2026-10-01). Before the first game this waits until no run_ladder.js, rotom.js or
 * engine/reparse_store.js process has been seen for --wait-free-min continuous minutes (sampled every 60 s), unless
 * --now (the coordinator said the machine is free). It then runs, through an ARGUMENT VECTOR to cmd.exe (never a typed
 * string), exactly the command in preregistration.json:
 *     cmd.exe /c tools\lownode.cmd solver/machamp/sprt.js <flags>
 * and samples every 60 s while it plays, appending one JSON line per sample to solver/out/student-sprt/guard.log.
 * If a ladder or re-parse process appears mid-run, it writes a `void` line and stops THIS RUN's processes BY PID: the
 * node processes whose command line names this run's unique out path (solver/out/student-sprt/), never by image name.
 * read.js then reads the run as VOID.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..', '..');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PR = JSON.parse(fs.readFileSync(path.join(__dirname, 'preregistration.json'), 'utf8'));
const OUTDIR = path.join(ROOT, 'solver', 'out', 'student-sprt');
fs.mkdirSync(OUTDIR, { recursive: true });
const GUARD = path.join(OUTDIR, 'guard.log');
/* one guard log per launch: an earlier launch's samples must never be read as this run's */
if (fs.existsSync(GUARD)) fs.renameSync(GUARD, path.join(OUTDIR, 'guard.' + new Date().toISOString().replace(/[:.]/g, '-') + '.log'));
const MARK = 'student-sprt';
const LADDER = /run_ladder\.js|rotom[\\/]rotom\.js|reparse_store\.js/i;
const log = o => fs.appendFileSync(GUARD, JSON.stringify(Object.assign({ t: new Date().toISOString() }, o)) + '\n');

function nodeProcs() {
  const ps = "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }";
  const out = cp.execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', maxBuffer: 1e8 });
  return out.split(/\r?\n/).filter(Boolean).map(l => { const i = l.indexOf('\t'); return { pid: +l.slice(0, i), cmd: l.slice(i + 1) }; });
}
const sample = () => { const P = nodeProcs().filter(p => p.pid !== process.pid);
  return { ladder: P.filter(p => LADDER.test(p.cmd)).map(p => p.pid), mine: P.filter(p => p.cmd.includes(MARK) && !/launch\.js/.test(p.cmd)).map(p => p.pid) }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const waitMin = +flag('--wait-free-min', 30);
  if (!argv.includes('--now')) {
    let freeSince = null;
    for (;;) {
      const s = sample();
      if (s.ladder.length) freeSince = null; else if (!freeSince) freeSince = Date.now();
      log({ kind: 'wait', ladder: s.ladder, free_min: freeSince ? +((Date.now() - freeSince) / 60000).toFixed(1) : 0 });
      if (freeSince && Date.now() - freeSince >= waitMin * 60000) break;
      await sleep(60000);
    }
  } else log({ kind: 'wait', now: true, ladder: sample().ladder });
  const s0 = sample();
  if (s0.ladder.length) { log({ kind: 'abort', why: 'ladder present at launch', ladder: s0.ladder }); return 2; }
  /* the LAST addendum's effective flags govern (addendum 1: --spreads observed-v1); the tree must carry the mode */
  const add = (PR.addenda || []).filter(a => a.effective_flags).pop();
  const flagStr = add ? add.effective_flags : PR.flags;
  const flags = flagStr.split(/\s+/).filter(Boolean);
  const mode = flags[flags.indexOf('--spreads') + 1];
  if (!require(path.join(ROOT, 'solver', 'arena', 'spread_source.js')).MODES.includes(mode)) { log({ kind: 'abort', why: 'this tree does not carry spread mode ' + mode + ': rebase on the main that does' }); return 3; }
  const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dirty = cp.execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT, encoding: 'utf8' }).trim();
  log({ kind: 'base', head, dirty_tracked: dirty ? dirty.split('\n').length : 0, addendum: add ? add.n : 0, spreads: mode });
  const env = Object.assign({}, process.env, { ABRA_REGULATION: 'regmc' });
  const out = fs.openSync(path.join(OUTDIR, 'sprt.stdout.log'), 'a');
  const ch = cp.spawn('cmd.exe', ['/c', 'tools\\lownode.cmd', 'solver/machamp/sprt.js', ...flags], { cwd: ROOT, env, stdio: ['ignore', out, out], windowsHide: true });
  log({ kind: 'launch', cmd_pid: ch.pid, argv: ['cmd.exe', '/c', 'tools\\lownode.cmd', 'solver/machamp/sprt.js', ...flags] });
  let done = false, code = null;
  ch.on('exit', c => { done = true; code = c; });
  while (!done) {
    await sleep(60000);
    if (done) break;
    let s; try { s = sample(); } catch (e) { log({ kind: 'sample_error', err: String(e && e.message || e) }); continue; }
    log({ kind: 'sample', ladder: s.ladder, mine: s.mine });
    if (s.ladder.length) {
      log({ kind: 'void', why: 'a ladder or re-parse process appeared mid-run; stopping this run by pid', ladder: s.ladder, killing: s.mine });
      for (const pid of s.mine) { try { cp.execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {} }
      try { cp.execFileSync('taskkill', ['/PID', String(ch.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
      break;
    }
  }
  log({ kind: 'end', exit: code });
  return 0;
}
main().then(c => process.exit(c), e => { log({ kind: 'error', err: String(e && e.stack || e) }); process.exit(1); });
