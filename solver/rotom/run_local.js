/* solver/rotom/run_local.js — the local-server harness for ROTOM (SOLVER-PLAN §3 M3, §5 "local-server arena").
 *
 *   node solver/rotom/run_local.js --sets 20 --a miltank --b prior [--a-args "..."] [--b-args "..."] [--port 8765]
 *        [--out <dir>] [--no-server] [--drill-a drop@2.1.3] [--drill-b crash@3.2.2] [--tag name]
 *
 * 1. Starts a `--no-security` pokemon-showdown-mc server on localhost:<port> (unless --no-server: one is already
 *    up), and waits for the port. NEVER a public server: ROTOM itself refuses one.
 * 2. Spawns two ROTOM clients through tools\lownode.cmd (BELOWNORMAL, CLAUDE.md), A accepting and B challenging,
 *    each for <sets> best-of-3 sets with the timer on.
 * 3. Acts as the WATCHDOG: a client that exits non-zero (a crash drill, or a real crash) is restarted with the
 *    same arguments; the restarted process re-reads its run state and series book from <out>, logs in, rejoins
 *    the open games from |updatesearch| and answers the request the server re-sends. Restarts are counted.
 * 4. Aggregates both clients' logs with solver/rotom/report.js into <out>/report.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const net = require('net');

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const has = k => argv.includes('--' + k);
const ROOT = path.join(__dirname, '..', '..');
const PORT = +flag('port', 8765);
const SETS = +flag('sets', 2);
const TAG = flag('tag', 'run');
const OUT = path.resolve(flag('out', path.join(ROOT, 'solver', 'out', 'rotom', TAG + '-' + new Date().toISOString().replace(/[:.]/g, '-'))));
const NA = flag('name-a', 'rotom' + TAG.replace(/[^a-z0-9]/gi, '') + 'a'), NB = flag('name-b', 'rotom' + TAG.replace(/[^a-z0-9]/gi, '') + 'b');
const SD = (() => { const X = path.join(ROOT, '..', 'pokemon-showdown-mc'); const MAIN = ROOT.includes(path.sep + '.claude' + path.sep) ? ROOT.split(path.sep + '.claude' + path.sep)[0] : ROOT; return fs.existsSync(X) ? X : path.join(MAIN, '..', 'pokemon-showdown-mc'); })();
const MAX_RESTARTS = +flag('max-restarts', 5);

const log = (...a) => console.log('[harness ' + new Date().toISOString().slice(11, 19) + ']', ...a);
const portUp = () => new Promise(res => { const s = net.connect(PORT, '127.0.0.1'); s.on('connect', () => { s.destroy(); res(true); }); s.on('error', () => res(false)); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startServer() {
  if (await portUp()) { log('a server is already listening on ' + PORT + ' — using it'); return null; }
  if (has('no-server')) throw new Error('--no-server and nothing on port ' + PORT);
  log('starting pokemon-showdown-mc on localhost:' + PORT + ' (--no-security) from ' + SD);
  const srv = cp.spawn(process.execPath, ['pokemon-showdown', 'start', '--skip-build', String(PORT), '--no-security'], { cwd: SD, stdio: ['ignore', fs.openSync(path.join(OUT, 'server.log'), 'a'), fs.openSync(path.join(OUT, 'server.log'), 'a')] });
  for (let i = 0; i < 120; i++) { if (await portUp()) return srv; await sleep(500); }
  throw new Error('server did not come up on ' + PORT);
}

function client(name, args) {
  const st = { name, args, restarts: 0, exits: [], done: false };
  const launch = () => {
    const full = ['/c', path.join('tools', 'lownode.cmd'), 'solver/rotom/rotom.js', '--name', name, '--server', 'ws://localhost:' + PORT + '/showdown/websocket', '--out', OUT, '--sets', String(SETS)].concat(args);
    const out = fs.openSync(path.join(OUT, 'stdout-' + name + '.log'), 'a');
    const p = cp.spawn('cmd.exe', full, { cwd: ROOT, stdio: ['ignore', out, out], windowsHide: true });
    st.proc = p;
    p.on('exit', (code) => {
      st.exits.push({ code, at: new Date().toISOString() });
      if (code === 0) { st.done = true; log(name + ' finished'); return; }
      if (st.restarts >= MAX_RESTARTS) { st.done = true; st.failed = true; log(name + ' exited ' + code + ' — restart limit reached'); return; }
      st.restarts++;
      log(name + ' exited ' + code + ' — WATCHDOG restart #' + st.restarts);
      setTimeout(launch, 1500);
    });
  };
  launch();
  return st;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await startServer();
  const aArgs = ['--policy', flag('a', 'miltank'), '--accept'].concat((flag('a-args', '') || '').split(' ').filter(Boolean)).concat(flag('drill-a', '') ? ['--drill', flag('drill-a', '')] : []);
  const bArgs = ['--policy', flag('b', 'prior'), '--challenge', NA].concat((flag('b-args', '') || '').split(' ').filter(Boolean)).concat(flag('drill-b', '') ? ['--drill', flag('drill-b', '')] : []);
  fs.writeFileSync(path.join(OUT, 'harness.json'), JSON.stringify({ started: new Date().toISOString(), port: PORT, sets: SETS, a: { name: NA, args: aArgs }, b: { name: NB, args: bArgs }, checkout: SD }, null, 1));
  const A = client(NA, aArgs);
  await sleep(3000);
  const B = client(NB, bArgs);
  const t0 = Date.now();
  while (!(A.done && B.done)) {
    await sleep(2000);
    if (Date.now() - t0 > +flag('timeout-min', 240) * 60000) { log('TIMEOUT — killing clients'); for (const c of [A, B]) try { c.proc.kill(); } catch (e) { /* gone */ } break; }
  }
  const R = require('./report.js').aggregate(OUT);
  R.harness = { wall_s: Math.round((Date.now() - t0) / 1000), watchdog: { [NA]: { restarts: A.restarts, exits: A.exits }, [NB]: { restarts: B.restarts, exits: B.exits } } };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(R, null, 1));
  log('report -> ' + path.join(OUT, 'report.json'));
  log(JSON.stringify(R.totals));
  if (srv && !has('keep-server')) srv.kill();
  process.exit(A.failed || B.failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
