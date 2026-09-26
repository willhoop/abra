/* solver/rotom/local_server_preload.js — THE LOCAL SERVER'S CONFIG. Loaded into a LOCAL pokemon-showdown-mc by
 * solver/rotom/local_server.js (NODE_OPTIONS=--require <this file>), for run_local.js and run_ladder.js --dry-run.
 * Its job: the local server makes ZERO outbound requests to any public host. solver/tests/test-rotom-localnet.js
 * proves it (a real server, the socket guard in every process, zero non-loopback attempts), and was shown RED
 * with this file left out.
 *
 * WHAT A STOCK pokemon-showdown-mc CHECKOUT REACHES FOR AT START-UP (measured 2026-09-25 with a stack-logging
 * socket guard in all 10 server processes, docs/_reports/2026-09-25-rotom-merge.md):
 *   play.pokemonshowdown.com:80   x1  server/loginserver.ts:195  LoginServer.request('invalidatecss') unless
 *                                     Config.nofswriting                         -> SWITCH: Config.loginserver
 *   pokemonshowdown.com:443       x6  server/chat-plugins/seasons.ts:147 getLadderTop(), from rollTimer() at module
 *                                     load and every hour: Net(`https://${Config.routes.root}/ladder/...`)
 *                                                                                   -> SWITCH: Config.routes.root
 *   check.torproject.org:443      x2  server/ip-tools.ts:651  `void IPTools.updateTorRanges()` at module load, a
 *                                     HARD-CODED URL (ip-tools.ts:632). NO config switch exists for it.
 *                                                                                   -> refused in lib/net (below)
 * and on demand: /savereplay uploads through the login server (rooms.ts `LoginServer.request('addreplay')`) when
 * there is no replaysdb, and the replay route builds links from Config.routes.replays -> SWITCH: both, below.
 *
 * THE SWITCHES (server/config-loader.ts does `{ ...defaults, ...require(<checkout>/config/config.js) }`; we hook
 * Module._load and patch that module's exports object in place the first time it loads, so the require cache holds
 * the patched object for every later read; the checkout's own config.js is never edited):
 *   loginserver    -> the local stand-in (solver/rotom/local_login.js): invalidatecss, addreplay, ladder actions
 *   routes.root    -> the stand-in's host:port   (seasons' ladder fetch stays on this machine and simply fails)
 *   routes.replays -> <stand-in>/replay         (the saved replay's link resolves locally)
 * THE ONE NON-SWITCH: the Tor exit-list fetch. We wrap lib/net's NetStream.prototype.makeRequest and refuse
 * exactly that URL's host before any socket is created — by NAME, so any OTHER public request still reaches the
 * socket guard and turns the test red. That is deliberate: a new unswitched request must be seen, not absorbed.
 *
 * Inert unless ROTOM_LOGIN_MOCK is set (an http://127.0.0.1:<port>/ URL). It refuses anything but a loopback URL.
 */
'use strict';
const MOCK = process.env.ROTOM_LOGIN_MOCK;
/* hosts with no config switch, refused at lib/net before a socket exists; each entry names the line that needs it */
const NO_SWITCH = { 'check.torproject.org': 'server/ip-tools.ts:651 updateTorRanges() at module load, URL hard-coded at :632' };
if (MOCK) {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(MOCK)) throw new Error('ROTOM_LOGIN_MOCK must be a loopback URL, got ' + MOCK);
  const fs = require('fs');
  const LOG = process.env.ROTOM_NETGUARD || null;
  const note = o => { if (!LOG) return; try { fs.appendFileSync(LOG, JSON.stringify(Object.assign({ t: new Date().toISOString(), pid: process.pid }, o)) + '\n'); } catch (e) { /* never fatal */ } };
  const Module = require('module');
  const orig = Module._load;
  const host = MOCK.replace(/^http:\/\//, '').replace(/\/$/, '');
  Module._load = function (request, parent, isMain) {
    const exp = orig.apply(this, arguments);
    if (typeof request === 'string' && /config[\\/]config(\.js)?$/.test(request) && exp && typeof exp === 'object' && !exp.__rotomLocal) {
      exp.loginserver = MOCK;
      exp.routes = Object.assign({}, exp.routes || {}, { root: host, replays: host + '/replay' });
      Object.defineProperty(exp, '__rotomLocal', { value: true });
      note({ local_config: true, loginserver: MOCK, routes: exp.routes });
      try { process.stderr.write('[rotom preload] pid ' + process.pid + ' loginserver -> ' + MOCK + ' ; routes.root -> ' + host + ' ; replays -> ' + host + '/replay\n'); } catch (e) { /* ignore */ }
    }
    /* THE THROTTLE, ON (ROTOM_SERVER_THROTTLE=1; run_ladder.js --throttle). `--no-security` sets Config.nothrottle
     * (server/config-loader.ts FLAG_PRESETS), which is why no local run ever saw the 600 ms / 5-queued message throttle
     * that dropped 14 of 17 game-1 previews in aa2. config-loader sets global.Config when it loads; we turn only
     * nothrottle back off (noguestsecurity and noipchecks stay on), so users.ts User#chat throttles exactly as live. */
    if (process.env.ROTOM_SERVER_THROTTLE === '1' && typeof request === 'string' && /config-loader(\.js)?$/.test(request) && global.Config && global.Config.nothrottle && !global.Config.__rotomThrottle) {
      global.Config.nothrottle = false;
      Object.defineProperty(global.Config, '__rotomThrottle', { value: true });
      note({ throttle_on: true });
      try { process.stderr.write('[rotom preload] pid ' + process.pid + ' THROTTLE ON: Config.nothrottle = false (users.ts 600 ms / 5 queued)\n'); } catch (e) { /* ignore */ }
    }
    if (typeof request === 'string' && /(^|[\\/])net(\.[jt]s)?$/.test(request) && request !== 'net' && exp && exp.NetStream && exp.NetStream.prototype && !exp.NetStream.prototype.__rotomLocal) {
      const P = exp.NetStream.prototype, make = P.makeRequest;
      P.makeRequest = function (opts) {
        let h = null; try { h = new URL(this.uri).hostname; } catch (e) { /* let the original fail */ }
        if (h && NO_SWITCH[h]) { note({ net_refused: h, why: NO_SWITCH[h] }); throw Object.assign(new Error('local server: ' + h + ' refused (no config switch; ' + NO_SWITCH[h] + ')'), { code: 'ELOCALCONFIG' }); }
        return make.call(this, opts);
      };
      Object.defineProperty(P, '__rotomLocal', { value: true });
    }
    return exp;
  };
}
module.exports = { NO_SWITCH };
