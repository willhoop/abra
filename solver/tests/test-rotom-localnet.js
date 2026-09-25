/* solver/tests/test-rotom-localnet.js — a LOCAL Showdown server started by ROTOM's harness makes ZERO public requests.
 *
 *   node solver/tests/test-rotom-localnet.js                 start a real local server (solver/rotom/local_server.js,
 *                                                            the path run_local.js and run_ladder.js --dry-run use), log
 *                                                            a user in, fetch the replay route, idle, and assert
 *   node solver/tests/test-rotom-localnet.js --break         the same with the local config LEFT OUT: must be RED
 *   node solver/tests/test-rotom-localnet.js --run <dir>     assert on a finished run dir (every netguard-*.jsonl in it:
 *                                                            server, clients, supervisor) — used on the ladder dry run
 *
 * HOW IT SEES. The socket guard (solver/rotom/netguard.js) is preloaded into every server process and wraps
 * net.Socket.prototype.connect, which every outbound TCP connection in Node passes through; each non-loopback attempt
 * is refused before DNS and logged. So "zero public requests" is read as: ZERO `blocked` lines across every guard log.
 *
 * A ZERO THAT CANNOT PROVE IT LOOKED IS NOT A PASS. The test also requires:
 *   - the guard installed in >= 5 server processes (the server forks ~10: sockets, battles, validator, verifier ...);
 *   - the local config applied in >= 1 process (the config switches were really set);
 *   - the one unswitchable request (the Tor exit list, server/ip-tools.ts:651) seen and refused by name at lib/net,
 *     so the code that makes it ran;
 *   - in --break, the guard catching >= 1 public host — shown RED on 2026-09-25 (docs/_reports/2026-09-25-rotom-merge.md).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const has = k => argv.includes('--' + k);
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const LS = require('../rotom/local_server.js');
const BREAK = has('break');
let checks = 0, fails = 0;
const ok = (c, m) => { checks++; if (!c) fails++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function judge(T, o) {
  console.log('net totals: ' + JSON.stringify(T));
  ok(T.public_connects_blocked === 0, 'ZERO non-loopback connection attempts in any guarded process: ' + T.public_connects_blocked + ' ' + JSON.stringify(T.blocked_hosts));
  if (o.serverFile) {
    const s = T.files[o.serverFile] || { processes: 0 };
    ok(s.processes >= 5, 'the guard ran in ' + s.processes + ' server processes (>= 5): the zero was looked for');
    ok(T.config_patched_processes >= 1, 'the local config was applied in ' + T.config_patched_processes + ' process(es)');
    ok((T.refused_hosts['check.torproject.org'] || 0) >= 1, 'the unswitchable Tor exit-list fetch ran and was refused by name at lib/net: ' + JSON.stringify(T.refused_hosts));
  }
}

async function live() {
  const out = path.resolve(flag('out', path.join(ROOT, 'solver', 'out', 'rotom', 'localnet-' + (BREAK ? 'break-' : '') + new Date().toISOString().replace(/[:.]/g, '-'))));
  const port = +flag('port', 21000 + Math.floor(Math.random() * 8000));
  console.log('test-rotom-localnet: ' + (BREAK ? 'DELIBERATE BREAK (local config left out) ' : '') + 'server on ' + port + ', out ' + out);
  let S = null;
  try {
    S = await LS.start({ port, out, localConfig: !BREAK, log: m => console.log('  [local] ' + m) });
    /* a client session: a guest login and a chat command, as a ROTOM client does */
    await new Promise(res => {
      const w = new WebSocket('ws://127.0.0.1:' + port + '/showdown/websocket');
      w.onmessage = m => { const t = String(m.data); if (/\|challstr\|/.test(t)) { w.send('|/trn localnettest,0,'); w.send('|/cmd rooms'); setTimeout(() => { try { w.close(); } catch (e) { /* closing */ } res(); }, 3000); } };
      w.onerror = () => res();
      setTimeout(res, 15000);
    });
    /* the replay route the local config points at */
    try { await fetch(S.mock.url + 'replay/none.json'); } catch (e) { /* 404 is fine: it answered locally */ }
    const idle = +flag('idle-s', 45);
    console.log('  idling ' + idle + ' s (start-up fetches are asynchronous)');
    await sleep(idle * 1000);
  } finally { if (S) S.stop(); }
  await sleep(1000);
  const T = LS.netTotals(out);
  if (BREAK) {
    ok(T.public_connects_blocked >= 1, 'BREAK: without the local config the guard catches public hosts: ' + JSON.stringify(T.blocked_hosts));
    ok(T.public_connects_blocked === 0, 'ZERO non-loopback connection attempts (expected to FAIL on the break): ' + T.public_connects_blocked);
  } else judge(T, { serverFile: 'netguard-server.jsonl' });
}

(async () => {
  if (flag('run', '')) {
    const dir = path.resolve(flag('run'));
    console.log('test-rotom-localnet: judging run ' + dir);
    judge(LS.netTotals(dir), { serverFile: fs.existsSync(path.join(dir, 'netguard-server.jsonl')) ? 'netguard-server.jsonl' : null });
  } else await live();
  console.log((fails ? 'RED' : 'GREEN') + ' ' + (checks - fails) + '/' + checks + (BREAK ? '  (deliberate break: the local config was left out)' : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); console.log('RED (threw)'); process.exit(1); });
