/* solver/rotom/local_server.js — start a LOCAL pokemon-showdown-mc that makes zero public requests. ONE start-up path
 * for run_local.js (the arena harness), run_ladder.js --dry-run and solver/tests/test-rotom-localnet.js.
 *
 * What it starts, all on 127.0.0.1:
 *   1. solver/rotom/local_login.js on <port+1>: the stand-in for the server's LOGIN SERVER (invalidatecss, addreplay,
 *      ladder actions) — replays land in <out>/replays.
 *   2. (opts.assertions) solver/rotom/login_stub.js: the stand-in for the CLIENT's /api/login (ladder dry run), whose
 *      public key the server is told (ROTOM_DRY_PUBKEY, applied by netguard.js), so the login is verified for real.
 *   3. pokemon-showdown-mc `start --skip-build <port> --no-security`, through tools\lownode.cmd, with two preloads in
 *      every server process (NODE_OPTIONS reaches the forked workers):
 *        netguard.js               the socket guard: every non-loopback connect is refused and LOGGED to
 *                                  <out>/netguard-server.jsonl — the proof, and the red if the config ever misses one
 *        local_server_preload.js   the local config: loginserver / routes.root / routes.replays -> the stand-in, and the
 *                                  one unswitchable request (the Tor exit list) refused by name at lib/net
 *   opts.localConfig === false leaves out the second preload (the deliberate break test-rotom-localnet.js is shown RED on).
 *
 * Returns { srv, pid, mock, stub, checkout, netlog, stop() }. stop() kills ONLY the server tree it started, by pid.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const net = require('net');

const ROOT = path.join(__dirname, '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fwd = p => p.split(path.sep).join('/');

function checkoutPath() {
  const MAIN = ROOT.includes(path.sep + '.claude' + path.sep) ? ROOT.split(path.sep + '.claude' + path.sep)[0] : ROOT;
  return [path.join(ROOT, '..', 'pokemon-showdown-mc'), path.join(MAIN, '..', 'pokemon-showdown-mc')].find(x => fs.existsSync(x)) || null;
}
const portUp = port => new Promise(res => { const s = net.connect(port, '127.0.0.1'); s.on('connect', () => { s.destroy(); res(true); }); s.on('error', () => res(false)); });
/* up = the server ANSWERS a websocket with a challstr (the port listens long before the workers serve) */
function serverAnswers(port) {
  return new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; try { w.close(); } catch (e) { /* closing */ } res(v); } };
    let w; try { w = new WebSocket('ws://127.0.0.1:' + port + '/showdown/websocket'); } catch (e) { return res(false); }
    w.onmessage = m => { if (/\|challstr\|/.test(String(m.data))) fin(true); };
    w.onerror = () => fin(false);
    setTimeout(() => fin(false), 3000);
  });
}

/** every line of <out>/netguard-*.jsonl -> the totals a run or a test asserts on */
function netTotals(out) {
  const files = {}; let blocked = 0; const hosts = {}; let netRefused = 0; const refusedHosts = {}; let configured = 0;
  for (const f of fs.readdirSync(out).filter(f => /^netguard-.*\.jsonl$/.test(f))) {
    const L = fs.readFileSync(path.join(out, f), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return {}; } });
    const b = L.filter(x => x.blocked);
    files[f] = { processes: new Set(L.filter(x => x.installed).map(x => x.pid)).size, blocked: b.length };
    blocked += b.length;
    for (const x of b) hosts[x.host] = (hosts[x.host] || 0) + 1;
    for (const x of L.filter(x => x.net_refused)) { netRefused++; refusedHosts[x.net_refused] = (refusedHosts[x.net_refused] || 0) + 1; }
    configured += L.filter(x => x.local_config).length;
  }
  return { files, public_connects_blocked: blocked, blocked_hosts: hosts, refused_at_lib_net: netRefused, refused_hosts: refusedHosts, config_patched_processes: configured };
}

async function start(opts) {
  const { port, out } = opts;
  const log = opts.log || (() => {});
  fs.mkdirSync(out, { recursive: true });
  if (await portUp(port)) throw new Error('port ' + port + ' is already in use: a local run needs its OWN server, started with the local config and the socket guard, or it cannot prove zero public traffic');
  const SD = checkoutPath();
  if (!SD) throw new Error('no pokemon-showdown-mc checkout beside the repository');
  const mock = await require('./local_login.js').start(port + 1, path.join(out, 'replays'), m => log('[login stand-in] ' + m));
  const stub = opts.assertions ? await require('./login_stub.js').start({ pubkeyFile: path.join(out, 'login-stub.pub.pem') }) : null;
  const netlog = path.join(out, 'netguard-server.jsonl');
  const pre = [path.join(__dirname, 'netguard.js')].concat(opts.localConfig === false ? [] : [path.join(__dirname, 'local_server_preload.js')]);
  const env = Object.assign({}, process.env, {
    NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' ' + pre.map(p => '--require "' + fwd(p) + '"').join(' ')).trim(),
    ROTOM_NETGUARD: netlog, ROTOM_LOGIN_MOCK: mock.url }, stub ? { ROTOM_DRY_PUBKEY: path.join(out, 'login-stub.pub.pem') } : {});
  const logFd = fs.openSync(path.join(out, 'server.log'), 'a');
  log('starting pokemon-showdown-mc on localhost:' + port + ' (--no-security, socket guard' + (opts.localConfig === false ? ', LOCAL CONFIG OFF' : ', local config') + ', login stand-in ' + mock.url + (stub ? ', assertion stub ' + stub.url : '') + ') from ' + SD);
  const srv = cp.spawn('cmd.exe', ['/c', path.join(ROOT, 'tools', 'lownode.cmd'), 'pokemon-showdown', 'start', '--skip-build', String(port), '--no-security'],
    { cwd: SD, env, stdio: ['ignore', logFd, logFd], windowsHide: true });
  let stopped = false;
  const stop = () => {
    if (stopped) return; stopped = true;
    try { cp.spawnSync('taskkill', ['/PID', String(srv.pid), '/T', '/F']); } catch (e) { /* gone */ }   // my own server tree, by pid
    try { mock.close(); } catch (e) { /* closed */ }
    if (stub) try { stub.close(); } catch (e) { /* closed */ }
  };
  const tries = +(opts.waitTries || 100);
  for (let i = 0; i < tries; i++) {
    if (await serverAnswers(port)) return { srv, pid: srv.pid, mock, stub, checkout: SD, netlog, stop };
    if (srv.exitCode != null) break;
    await sleep(3000);
  }
  stop();
  throw new Error('server did not answer on ' + port + ' (exit code ' + srv.exitCode + '); see ' + path.join(out, 'server.log'));
}

module.exports = { start, netTotals, checkoutPath, portUp, serverAnswers };
