/* solver/porygon2/v1/build_all.js — run build.js over several self-play directories, ONE OUTPUT PER DIRECTORY (so the gate
 * can leave out the directories the baseline trained on), W at a time, each child at BELOW_NORMAL.
 *
 *   node solver/porygon2/v1/build_all.js --release <id> --dirs a,b,c --out solver/out/p2v1/sp [--workers 1]
 */
'use strict';
const path = require('path');
const cp = require('child_process');
const os = require('os');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..', '..');
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
const REL = flag('--release'), OUT = flag('--out', 'solver/out/p2v1/sp'), W = Math.min(4, +flag('--workers', 1));
const dirs = String(flag('--dirs', '')).split(',').filter(Boolean);
let next = 0, running = 0, failed = 0;
const t0 = Date.now();
function launch() {
  while (running < W && next < dirs.length) {
    const d = dirs[next++];
    const name = path.basename(d);
    const out = path.join(OUT, name);
    running++;
    const ch = cp.spawn(process.execPath, ['--max-old-space-size=2048', path.join(__dirname, 'build.js'), '--release', REL, '--selfplay', d, '--out', out], { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
    console.log(`build_all: ${name} pid ${ch.pid}`);
    ch.on('exit', code => { running--; if (code) failed++; console.log(`build_all: ${name} exit ${code} at ${((Date.now() - t0) / 1000).toFixed(0)}s`); if (next < dirs.length) launch(); else if (!running) process.exit(failed ? 1 : 0); });
  }
}
launch();
