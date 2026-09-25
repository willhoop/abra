/* solver/rotom/local_server_preload.js — loaded into a LOCAL pokemon-showdown-mc by solver/rotom/run_local.js
 * (NODE_OPTIONS=--require <this file>). It re-points the server's login server and replay route at the local
 * stand-in (solver/rotom/local_login.js), so /savereplay and the start-up `invalidatecss` never leave the machine.
 *
 * How: server/config-loader.ts does `{ ...defaults, ...require(CONFIG_PATH) }` with CONFIG_PATH =
 * <checkout>/config/config.js. We hook Module._load and patch that module's exports object in place the first
 * time it is loaded; the require cache then holds the patched object for every later read.
 *
 * Inert unless ROTOM_LOGIN_MOCK is set (an http://127.0.0.1:<port>/ URL). It refuses anything but a loopback URL.
 */
'use strict';
const MOCK = process.env.ROTOM_LOGIN_MOCK;
if (MOCK) {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(MOCK)) throw new Error('ROTOM_LOGIN_MOCK must be a loopback URL, got ' + MOCK);
  const Module = require('module');
  const orig = Module._load;
  const host = MOCK.replace(/^http:\/\//, '').replace(/\/$/, '');
  Module._load = function (request, parent, isMain) {
    const exp = orig.apply(this, arguments);
    if (typeof request === 'string' && /config[\\/]config(\.js)?$/.test(request) && exp && typeof exp === 'object' && !exp.__rotomLocal) {
      exp.loginserver = MOCK;
      exp.routes = Object.assign({}, exp.routes || {}, { replays: host + '/replay' });
      Object.defineProperty(exp, '__rotomLocal', { value: true });
      try { process.stderr.write('[rotom preload] pid ' + process.pid + ' loginserver -> ' + MOCK + ' ; replays -> ' + host + '/replay\n'); } catch (e) { /* ignore */ }
    }
    return exp;
  };
}
