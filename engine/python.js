/* python.js — find a REAL Python interpreter, once, for every caller that needs one.
 *
 * WHY THIS EXISTS (S12: one reader, not the same probe pasted per file)
 * --------------------------------------------------------------------
 * Half this project is Python and half is JavaScript, and the JS side shells out to the Python side
 * for parity checks. Locating the interpreter is genuinely hard on Windows and the probe had already
 * been copied into server.js and tests/test-quality.js, where it then drifted.
 *
 * The traps, all of which this project has actually hit:
 *
 *   1. `python3` is a Linux assumption. The python.org installer ships python.exe, not python3.exe.
 *   2. Windows ships ALIAS STUBS at %LOCALAPPDATA%\Microsoft\WindowsApps\python.exe and python3.exe.
 *      They are not Python. They print "Python was not found; run without arguments to install from
 *      the Microsoft Store" and exit 9009. They sit EARLY on PATH, so they shadow a perfectly good
 *      install. This is why the parity test reported "no working Python found" on a machine with
 *      Python 3.12.10 installed and working.
 *   3. `py` (the launcher) is not always installed, even when Python is.
 *
 * So a name resolving on PATH proves nothing — the probe must EXECUTE the candidate and check that it
 * actually runs Python. That is what verify() does, and it is why the stub is rejected: the stub
 * cannot print the token.
 *
 * Returns { cmd, args, version } or null. Never throws.
 *
 *   const py = require('./python.js').find();
 *   execFileSync(py.cmd, [...py.args, 'engine/foo.py']);
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOKEN = 'ABRA_PY_OK';

/* Named candidates first (fast, and correct on Linux/CI), then well-known Windows install roots.
 * The WindowsApps stubs are never listed; they are only ever reached via PATH, where verify() kills
 * them. */
function candidates() {
  const out = [
    ['python3', []],
    ['python', []],
    ['py', ['-3']],
  ];
  const roots = [process.env.LOCALAPPDATA, process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
  for (const root of roots) {
    for (const sub of ['Programs\\Python', 'Python']) {
      const dir = path.join(root, sub);
      let entries = [];
      try { entries = fs.readdirSync(dir); } catch (e) { continue; }
      /* newest first, so 3.13 beats 3.11 */
      entries.sort().reverse();
      for (const e of entries) {
        const exe = path.join(dir, e, 'python.exe');
        if (fs.existsSync(exe)) out.push([exe, []]);
      }
    }
  }
  return out;
}

function verify(cmd, args) {
  try {
    const v = execFileSync(cmd, [...args, '-c', `print("${TOKEN}")`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 });
    return v.includes(TOKEN);
  } catch (e) {
    return false;   // not installed, the Store stub, or a broken install
  }
}

let _found;
function find() {
  if (_found !== undefined) return _found;
  for (const [cmd, args] of candidates()) {
    if (!verify(cmd, args)) continue;
    let version = '';
    try {
      version = execFileSync(cmd, [...args, '-c', 'import sys;print(".".join(map(str,sys.version_info[:3])))'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch (e) { /* verified above; version is cosmetic */ }
    _found = { cmd, args, version };
    return _found;
  }
  _found = null;
  return _found;
}

module.exports = { find };

if (require.main === module) {
  const p = find();
  if (!p) { console.error('no working Python found'); process.exit(1); }
  console.log(`${p.cmd} ${p.args.join(' ')}`.trim() + `  (Python ${p.version})`);
}
