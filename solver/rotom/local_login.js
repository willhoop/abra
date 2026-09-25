/* solver/rotom/local_login.js — a LOCAL stand-in for Showdown's login server, so a local test server never
 * talks to play.pokemonshowdown.com.
 *
 * WHY IT IS NEEDED. pokemon-showdown-mc's config/config.js sets `loginserver = 'http://play.pokemonshowdown.com/'`
 * and no `replaysdb`. With no replays database, `/savereplay` uploads through the LOGIN SERVER
 * (server/rooms.ts:2112-2135: LoginServer.request('addreplay', {id, log, players, format, rating, hidden,
 * inputlog, password})), which POSTs to `<loginserver>action.php` (server/loginserver.ts:115-160). A local test
 * that saved replays would therefore post every test game to the PUBLIC login server. It also already does one
 * request at every start-up: `LoginServer.request('invalidatecss')` (loginserver.ts, the last lines).
 *
 * So the harness starts this server and launches Showdown with `--require solver/rotom/local_server_preload.js`
 * (via NODE_OPTIONS), which re-points Config.loginserver here and Config.routes.replays at our /replay path.
 *
 * PROTOCOL (what loginserver.ts sends and parses):
 *   POST /action.php   form body: serverid, servertoken, nocache, json=<JSON array of {act, ...}>
 *   response: `]` + JSON array, one result per request, in order (parseJSON strips the leading `]`)
 *   addreplay -> { replayid: <id>[-<password>pw] }   the log is written to <dir>/<id>.log (+ .json)
 *   anything else -> {}   (invalidatecss, ladder actions: a local unrated challenge sends none)
 *   GET /replay/<id>.log | .json  serves what was stored, so a saved replay can be opened locally.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

function start(port, dir, log) {
  log = log || (() => {});
  fs.mkdirSync(dir, { recursive: true });
  const counts = { requests: 0, byAct: {}, replays: 0 };
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && u.pathname.startsWith('/replay/')) {
      const f = path.join(dir, path.basename(u.pathname));
      if (fs.existsSync(f)) { res.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : 'text/plain' }); fs.createReadStream(f).pipe(res); }
      else { res.writeHead(404); res.end('no such replay'); }
      return;
    }
    let body = '';
    req.on('data', d => { body += d; if (body.length > 64e6) req.destroy(); });
    req.on('end', () => {
      counts.requests++;
      let list = [];
      try {
        const q = new URLSearchParams(req.method === 'POST' ? body : u.search.slice(1));
        list = q.get('json') ? JSON.parse(q.get('json')) : [Object.fromEntries(q.entries())];
      } catch (e) { log('bad request: ' + e.message); }
      const out = list.map(r => {
        const act = r.act || '?';
        counts.byAct[act] = (counts.byAct[act] || 0) + 1;
        if (act !== 'addreplay') return {};
        const id = String(r.id || '').replace(/[^a-z0-9-]/gi, '');
        const replayid = id + (r.password ? '-' + r.password + 'pw' : '');
        try {
          fs.writeFileSync(path.join(dir, replayid + '.log'), String(r.log || ''));
          fs.writeFileSync(path.join(dir, replayid + '.json'), JSON.stringify({ id: replayid, format: r.format, players: String(r.players || '').split(','),
            rating: r.rating || null, hidden: r.hidden || '', uploadtime: Math.trunc(Date.now() / 1000), log: r.log, inputlog_lines: String(r.inputlog || '').split('\n').length }));
          counts.replays++;
          log('addreplay ' + replayid);
          return { replayid };
        } catch (e) { return { error: e.message }; }
      });
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(']' + JSON.stringify(out));
    });
  });
  return new Promise((resolve, reject) => {
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve({ server: srv, counts, url: 'http://127.0.0.1:' + port + '/', close: () => srv.close() }));
  });
}

module.exports = { start };
