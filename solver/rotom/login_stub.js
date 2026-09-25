/* solver/rotom/login_stub.js — a LOCAL stand-in for play.pokemonshowdown.com/api/login, for ROTOM's ladder DRY RUN.
 *
 * WHY. The dry run must exercise the SAME login code as the public ladder (challstr -> POST name/pass/challstr ->
 * assertion -> `/trn name,0,assertion`), and must not send a byte to the public login server. So it POSTs here, and
 * the local pokemon-showdown-mc verifies the assertion for real: solver/rotom/netguard.js (loaded as a preload with
 * ROTOM_DRY_PUBKEY) points the server's Config.loginserverpublickey at this stub's key. users.ts validateToken then
 * checks the challenge, the userid, the date and the RSA-SHA1 signature exactly as it would on the main server
 * (pokemon-showdown-mc server/users.ts validateToken; server/verifier.ts).
 *
 * THE ASSERTION (users.ts validateToken splits it): `<challenge>,<userid>,<userType>,<unix seconds>,<host>;<sig hex>`
 * with userType '2' (registered) — the challenge is the hex after `<keyid>|` in the challstr.
 *
 * THE PASSWORD. The dry run sends a placeholder, never the real one (rotom.js does not read data/.showdown-pass in a
 * dry run). This stub records only WHETHER a password field arrived, never its value.
 */
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function start(opts) {
  opts = opts || {};
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  if (opts.pubkeyFile) fs.writeFileSync(opts.pubkeyFile, pem);
  const counts = { requests: 0, assertions: 0, refused: 0, pass_field_seen: 0 };
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      counts.requests++;
      const q = new URLSearchParams(body);
      const name = q.get('name') || '', challstr = q.get('challstr') || '';
      if (q.has('pass')) counts.pass_field_seen++;
      const challenge = challstr.includes('|') ? challstr.split('|').slice(1).join('|') : challstr;
      let out;
      if (!name || !challenge || !/\/api\/login$/.test(req.url.split('?')[0])) { counts.refused++; out = { actionsuccess: false, actionerror: 'bad request' }; }
      else {
        const data = [challenge, toID(name), '2', Math.floor(Date.now() / 1000), 'localhost'].join(',');
        const s = crypto.createSign('RSA-SHA1'); s.update(data);
        out = { actionsuccess: true, assertion: data + ';' + s.sign(privateKey, 'hex'), curuser: { loggedin: true, username: name, userid: toID(name) } };
        counts.assertions++;
      }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(']' + JSON.stringify(out));
    });
  });
  return new Promise((resolve, reject) => {
    srv.on('error', reject);
    srv.listen(opts.port || 0, '127.0.0.1', () => {
      const port = srv.address().port;
      resolve({ server: srv, counts, pem, port, url: 'http://127.0.0.1:' + port + '/api/login', close: () => srv.close() });
    });
  });
}

module.exports = { start };

/* standalone: node solver/rotom/login_stub.js <port> <pubkey file> [<counts file>] — the dry-run harness runs it this way */
if (require.main === module) {
  const [port, pub, countsFile] = process.argv.slice(2);
  start({ port: +port, pubkeyFile: pub }).then(S => {
    console.log('[login-stub] ' + S.url + ' ; public key -> ' + pub);
    if (countsFile) setInterval(() => { try { fs.writeFileSync(countsFile, JSON.stringify(S.counts)); } catch (e) { /* ignore */ } }, 2000).unref();
    process.on('SIGTERM', () => process.exit(0));
  });
}
