/* solver/rotom/netguard.js — a process-wide network guard for ROTOM's DRY RUN: nothing leaves the machine.
 *
 * WHY. A dry run must send ZERO traffic to any public Showdown host, and that has to be PROVEN, not assumed: the
 * checkout's config/config.js points `loginserver` at play.pokemonshowdown.com and the server calls it at start-up
 * (`invalidatecss`), and the client's login code is the public code path with only the URL changed. A URL that is
 * wrong by one flag would reach the public login server with our name on it.
 *
 * HOW. `install()` wraps net.Socket.prototype.connect — the one call every outbound TCP connection in Node passes
 * through (http, https/tls — TLSSocket inherits it —, the built-in fetch/undici, and the built-in WebSocket). A
 * connection to anything but a loopback address (127.0.0.0/8, ::1, `localhost`) or a local pipe is REFUSED before
 * the DNS lookup, so not even a name query leaves; the socket is destroyed with an ENETGUARD error on the next tick.
 * Every attempt is counted, allowed or blocked, and (if a log file is given) appended as a JSON line, so the run can
 * print "blocked N, allowed-public 0" and a test can read it.
 *
 * AS A PRELOAD. `node --require solver/rotom/netguard.js` with ROTOM_NETGUARD=<log file> installs it at start-up
 * (this is how run_ladder.js --dry-run loads it into the LOCAL pokemon-showdown-mc server). With
 * ROTOM_DRY_PUBKEY=<pem file> it also points the server's Config.loginserverpublickey at the local assertion
 * stand-in's key (solver/rotom/login_stub.js), so the server verifies the challstr -> assertion login for real.
 * Without either variable, requiring this file does nothing.
 */
'use strict';
const net = require('net');
const fs = require('fs');

const LOOPBACK = /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|::1|\[::1\]|localhost|::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;
const isLoopbackHost = h => h == null || h === '' ? true : LOOPBACK.test(String(h));

const STATE = { installed: false, allowed: 0, blocked: 0, blockedHosts: {}, log: null };

function hostOf(args) {
  /* Socket.prototype.connect(options[, cb]) | (port[, host][, cb]) | (path[, cb]) — normalised by Node internally */
  const a0 = args[0];
  if (Array.isArray(a0)) return hostOf(a0);   // the internal normalized form [options, cb]
  if (a0 && typeof a0 === 'object') { if (a0.path) return { pipe: true }; return { host: a0.host || a0.hostname || 'localhost', port: a0.port }; }
  if (typeof a0 === 'string' && !/^\d+$/.test(a0)) return { pipe: true };
  return { host: typeof args[1] === 'string' ? args[1] : 'localhost', port: a0 };
}

function record(o) {
  if (!STATE.log) return;
  try { fs.appendFileSync(STATE.log, JSON.stringify(Object.assign({ t: new Date().toISOString(), pid: process.pid }, o)) + '\n'); } catch (e) { /* never fatal */ }
}

function install(opts) {
  opts = opts || {};
  if (opts.log) STATE.log = opts.log;
  if (STATE.installed) return STATE;
  STATE.installed = true;
  const orig = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function guardedConnect(...args) {
    const h = hostOf(args);
    if (h.pipe || isLoopbackHost(h.host)) { STATE.allowed++; return orig.apply(this, args); }
    STATE.blocked++;
    STATE.blockedHosts[h.host] = (STATE.blockedHosts[h.host] || 0) + 1;
    record({ blocked: true, host: h.host, port: h.port });
    const err = Object.assign(new Error('ROTOM netguard: outbound connection to ' + h.host + ':' + h.port + ' refused (dry run: loopback only)'), { code: 'ENETGUARD' });
    process.nextTick(() => this.destroy(err));
    return this;
  };
  record({ installed: true, argv: process.argv.slice(1, 3) });
  return STATE;
}

function stats() { return { installed: STATE.installed, allowed: STATE.allowed, blocked: STATE.blocked, blocked_hosts: Object.assign({}, STATE.blockedHosts) }; }

/* ---- preload mode ---- */
if (process.env.ROTOM_NETGUARD) install({ log: process.env.ROTOM_NETGUARD });
if (process.env.ROTOM_DRY_PUBKEY) {
  const pem = fs.readFileSync(process.env.ROTOM_DRY_PUBKEY, 'utf8');
  const Module = require('module');
  const orig = Module._load;
  Module._load = function (request, parent, isMain) {
    const exp = orig.apply(this, arguments);
    if (typeof request === 'string' && /config[\\/]config(\.js)?$/.test(request) && exp && typeof exp === 'object' && !exp.__rotomDryKey) {
      exp.loginserverpublickey = pem;
      exp.loginserverkeyalgo = 'RSA-SHA1';
      Object.defineProperty(exp, '__rotomDryKey', { value: true });
      record({ pubkey_patched: true });
    }
    return exp;
  };
}

module.exports = { install, stats, isLoopbackHost, hostOf };
