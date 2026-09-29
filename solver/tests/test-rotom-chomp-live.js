/* solver/tests/test-rotom-chomp-live.js — CHOMP at team preview through the REAL ladder client (solver/rotom/rotom.js
 * --ladder --dry-run) against a scripted websocket server in this process (127.0.0.1 only; no Showdown connection).
 *
 *   node solver/tests/test-rotom-chomp-live.js            exit 0 GREEN, 1 RED, 2 CANNOT-RUN (no gate release on disk)
 *   node solver/tests/test-rotom-chomp-live.js --no-red   skip the deliberate breaks
 *   node solver/tests/test-rotom-chomp-live.js --break arm|pv   one broken run (used by the default run; must go RED)
 *
 * The ladder run Will launches names CHOMP in its ARMS FILE (solver/rotom/arms/gen5-chomp.json, arm A `preview: "chomp"`),
 * so the preview mode is in the plan digest and in every series row. This test plays exactly that arms file:
 *
 *   PREVIEW   the scripted server sends a real Reg M-C preview (solver/tests/fixtures/rotom/preview.json, both open sheets,
 *             the `|request|`), and the client SENDS `/choose team ....|rqid` to the battle room; the choice is legal, and
 *             the decision record says CHOMP answered it (used chomp, preview_mode chomp, info.chomp, a model, no chain).
 *   ROW       the series ends; its row carries arm A with `preview: "chomp"` in arm_config.
 *   SUMMARY   preview_by.chomp = 1, and no fallback is counted for it (a CHOMP preview read `used:chomp` as a fallback
 *             until 2026-09-29), no chomp:threw / chomp:illegal.
 *   PASS      run_ladder.js forwards --preview, --preview-max-ms and --adaptive-target-ms to the client (until 2026-09-29 it
 *             dropped them, and `run_ladder.js ... --preview chomp` played the team's own bring without a word).
 *
 * Breaks (default run spawns both; each must be RED):
 *   arm   the arms file with `preview` removed: the client plays the team's own bring.
 *   pv    a copy of rotom.js that reads the --preview flag, not the arm's preview, at the decision.
 *
 * The rotation is three copies of the fixture's own team (regmc-pool T7), so the /utm team check agrees with the sheet.
 * The client is our own child process; it is stopped by its STOP file, or killed by its pid only.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const http = require('http');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const L = require('../rotom/ladder.js');
const RQ = require('../rotom/request.js');
const FMT = 'gen9championsvgc2026regmcbo3';
const argv = process.argv.slice(2);
const BREAK = argv.includes('--break') ? argv[argv.indexOf('--break') + 1] : null;
let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' [' + clause + '] ' + msg); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- the deliberate breaks, run by default after the green run ---------------- */
function runReds() {
  for (const b of ['arm', 'pv']) {
    const r = cp.spawnSync(process.execPath, [__filename, '--break', b], { cwd: ROOT, env: process.env, encoding: 'utf8', maxBuffer: 1 << 26 });
    const out = String(r.stdout || '').trim().split('\n'), red = r.status === 1;
    checks++; if (!red) fails++;
    console.log('  red check --break ' + b + ' -> ' + (red ? 'RED as required (' + out.slice(-1)[0] + '; first FAIL: ' + ((out.find(l => /FAIL/.test(l)) || '').trim().slice(0, 160)) + ')' : 'NOT RED (exit ' + r.status + '): ' + out.slice(-1)[0]));
  }
}

const RD = path.join(ROOT, 'data', 'releases');
const RELEASE = (() => { try { const ids = fs.readdirSync(RD).filter(id => L.releaseAllowed(RD, id).ok); return ids.includes(L.GATE_RELEASE) ? L.GATE_RELEASE : ids[0] || null; } catch (e) { return null; } })();
if (!RELEASE) { console.log('CANNOT-RUN: no release at or after the gate ' + L.GATE_RELEASE + ' under ' + RD); process.exit(2); }

const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'rotom', 'preview.json'), 'utf8'));
const ME_OLD = FX.names[FX.me], OPP = FX.names[FX.me === 'p1' ? 'p2' : 'p1'];
const rename = s => s.split(ME_OLD).join('medicham32');
const P = FMT + '-';
const BO = 'game-bestof3-' + P + '2799300001', BID = 'battle-' + P + '2799300002';
const TITLE = '[Gen 9 Champions] VGC 2026 Reg M-C (Bo3)*';
const REQ = JSON.parse(rename(JSON.stringify(FX.req)));
const LINES = FX.lines.map(rename);

/* ---------------- a minimal RFC 6455 server (text frames only) + the /api/login stand-in ---------------- */
let client = null;
function wsSend(text) {
  if (!client) return;
  const b = Buffer.from(text, 'utf8'); let h;
  if (b.length < 126) h = Buffer.from([0x81, b.length]);
  else if (b.length < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(b.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(b.length), 2); }
  try { client.write(Buffer.concat([h, b])); } catch (e) { /* closed */ }
}
const room = (id, ls) => wsSend('>' + id + '\n' + ls.join('\n'));
const glob = line => wsSend(line);
const updatesearch = (games, searching) => glob('|updatesearch|' + JSON.stringify({ searching: searching || [], games: games ? Object.fromEntries(games.map(g => [g, TITLE])) : null }));
const H = { searches: [], onJoin: {}, chooses: [] };
function onClientText(text) {
  const bar = text.indexOf('|'), rm = text.slice(0, bar), body = text.slice(bar + 1);
  let m;
  if ((m = /^\/choose (team \d+)\|(\d+)/.exec(body))) { H.chooses.push({ room: rm, choice: m[1], rqid: +m[2], t: Date.now() }); return; }
  if (/^\/trn /.test(body)) { glob('|updateuser| medicham32|1|1|{}'); updatesearch(null); return; }
  if ((m = /^\/crq userdetails (\S+)/.exec(body))) { glob('|queryresponse|userdetails|' + JSON.stringify({ id: m[1], userid: m[1], name: m[1], rooms: false })); return; }
  if ((m = /^\/crq roominfo (\S+)/.exec(body))) { glob('|queryresponse|roominfo|' + JSON.stringify({ id: m[1], roomid: m[1], title: 'x', type: 'chat', visibility: 'public', users: [' medicham32', ' ' + OPP] })); return; }
  if (/^\/search /.test(body)) { H.searches.push(Date.now()); updatesearch(null, [FMT]); if (H.searches.length === 1) play(); return; }
  if (/^\/cancelsearch/.test(body)) { updatesearch(null); return; }
  if ((m = /^\/join (\S+)/.exec(body))) { const f = H.onJoin[m[1]]; if (f) { delete H.onJoin[m[1]]; f(); } return; }
  if ((m = /^\/leave (\S+)/.exec(body))) { room(m[1], ['|deinit']); return; }
}
const srv = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/api/login')) { req.on('data', () => {}); req.on('end', () => res.end(']' + JSON.stringify({ assertion: 'dry-run-assertion' }))); return; }
  res.statusCode = 404; res.end();
});
srv.on('upgrade', (req, sock) => {
  const acc = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  client = sock;
  let buf = Buffer.alloc(0);
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 2) return;
      const op = buf[0] & 0x0f, masked = buf[1] & 0x80; let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const need = off + (masked ? 4 : 0) + len; if (buf.length < need) return;
      let payload = buf.slice(off + (masked ? 4 : 0), need);
      if (masked) { const k = buf.slice(off, off + 4); payload = Buffer.from(payload.map((x, j) => x ^ k[j % 4])); }
      buf = buf.slice(need);
      if (op === 1) onClientText(payload.toString('utf8'));
      else if (op === 8) { try { sock.end(); } catch (e) { /* closing */ } return; }
      else if (op === 9) { try { sock.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); } catch (e) { /* closing */ } }
    }
  });
  sock.on('error', () => {});
  sock.on('close', () => { if (client === sock) client = null; });
  setTimeout(() => glob('|challstr|4|' + crypto.randomBytes(16).toString('hex')), 50);
});

/* ---------------- the scripted series: one preview, then the opponent forfeits ---------------- */
const at = (ms, f) => setTimeout(f, ms);
function play() {
  at(300, () => updatesearch([BO]));
  H.onJoin[BO] = () => at(40, () => room(BO, ['|init|chat', '|title|' + OPP + ' vs. medicham32']));
  at(1000, () => updatesearch([BO, BID]));
  H.onJoin[BID] = () => at(60, () => {
    room(BID, ['|init|battle', '|title|' + OPP + ' vs. medicham32',
      '|uhtml|bestof|<h2><strong>Game 1</strong> of <a href="/' + BO + '">a best-of-3</a></h2>'].concat(LINES));
    at(50, () => room(BID, ['|request|' + JSON.stringify(REQ)]));
  });
}
function endSeries() {
  room(BID, ['|', '|-message|' + OPP + ' forfeited.', '|', '|win|medicham32']);
  at(80, () => { room(BO, ['|win|medicham32']); at(300, () => room(BID, ["|raw|medicham32's rating: 1040 &rarr; <strong>1070</strong><br />(+30 for winning)",
    "|raw|" + OPP + "'s rating: 1085 &rarr; <strong>1055</strong><br />(-30 for losing)"])); updatesearch(null); });
}

async function main() {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rotom-chomp-live-'));
  const OUT = path.join(TMP, 'out');
  /* the rotation: the fixture's own team (regmc-pool T7), three times */
  const POOL = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'rotom', 'teams', 'regmc-pool.json'), 'utf8'));
  const want = FX.sheets[FX.me].map(x => x.species).sort().join();
  const T = POOL.teams.find(t => t.species.slice().sort().join() === want);
  if (!T) { console.log('CANNOT-RUN: the preview fixture\'s team is not in regmc-pool.json'); process.exit(2); }
  const rotation = { generated: 'test-rotom-chomp-live', format: FMT, teams: ['a', 'b', 'c'].map(s => Object.assign({}, T, { id: T.id + s, archetype: { label: 'fixture' } })) };
  const rotF = path.join(TMP, 'rotation.json'); fs.writeFileSync(rotF, JSON.stringify(rotation));
  /* the arms: the launch file itself, or (break arm) a copy without the preview */
  let armsF = path.join(ROOT, 'solver', 'rotom', 'arms', 'gen5-chomp.json');
  if (BREAK === 'arm') { const a = JSON.parse(fs.readFileSync(armsF, 'utf8')); for (const x of Object.values(a.arms)) delete x.preview; armsF = path.join(TMP, 'arms-nopreview.json'); fs.writeFileSync(armsF, JSON.stringify(a)); }
  let clientFile = path.join(ROOT, 'solver', 'rotom', 'rotom.js'), brokenCopy = null;
  if (BREAK === 'pv') {
    const src = fs.readFileSync(clientFile, 'utf8'), anchor = "if (PV === 'chomp') tryPolicy('chomp'";
    if (!src.includes(anchor)) { console.log('break anchor not found'); process.exit(1); }
    brokenCopy = path.join(ROOT, 'solver', 'rotom', '.rotom-chomp-break-' + process.pid + '.js');
    fs.writeFileSync(brokenCopy, src.split(anchor).join("if (PREVIEW === 'chomp') tryPolicy('chomp'"));
    clientFile = brokenCopy;
  } else if (BREAK && BREAK !== 'arm') { console.error('unknown --break ' + BREAK); process.exit(2); }
  const stopF = path.join(OUT, 'STOP');
  const args = [clientFile, '--ladder', '--dry-run', '--name', 'medicham32',
    '--server', 'ws://127.0.0.1:' + port + '/showdown/websocket', '--login-url', 'http://127.0.0.1:' + port + '/api/login',
    '--release', RELEASE, '--arms', armsF, '--rotation', rotF, '--ladder-seed', 'test-chomp-live',
    '--sets', '5', '--max-errors', '5', '--out', OUT, '--games-file', path.join(OUT, 'games.jsonl'),
    '--stop-file', stopF, '--kill-file', path.join(OUT, 'KILL'), '--priority', 'below'];
  const stdoutF = path.join(TMP, 'stdout.log');
  const child = cp.spawn(process.execPath, args, { cwd: ROOT, env: Object.assign({}, process.env, { ROTOM_LOCK_DIR: TMP }), stdio: ['ignore', fs.openSync(stdoutF, 'w'), fs.openSync(stdoutF, 'a')] });
  let exited = null; child.on('exit', c => { exited = c; });
  console.log('rotom pid ' + child.pid + ' (release ' + RELEASE + (BREAK ? ', BREAK ' + BREAK : '') + ') -> ' + TMP);
  const waitFor = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; if (exited !== null) return !!f(); await sleep(200); } return !!f(); };
  const jl = f => { try { return fs.readFileSync(path.join(OUT, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } };
  try {
    ok('START', await waitFor(() => H.searches.length >= 1, 180000), 'the client warms up, logs in, clears the guard and searches (exit ' + exited + ')');
    ok('PREVIEW', await waitFor(() => H.chooses.length >= 1, 90000), 'the client SENT a preview /choose to the battle room: ' + JSON.stringify(H.chooses[0] || null));
    const c = H.chooses[0] || {};
    ok('PREVIEW', c.room === BID && c.rqid === REQ.rqid && RQ.isLegal(REQ, c.choice), 'sent to ' + c.room + ' for rqid ' + c.rqid + ', legal for the request: ' + c.choice);
    await waitFor(() => jl('decisions-medicham32.jsonl').some(d => d.kind === 'preview'), 10000);
    const d = jl('decisions-medicham32.jsonl').find(x => x.kind === 'preview') || {};
    ok('PREVIEW', d.used === 'chomp' && d.preview_mode === 'chomp' && d.arm === 'A' && d.policy === 'miltank-gen5',
       'the decision: ' + JSON.stringify({ used: d.used, mode: d.preview_mode, arm: d.arm, policy: d.policy }));
    ok('PREVIEW', d.info && d.info.chomp === true && !!d.info.model && d.choice === c.choice && Array.isArray(d.chain) && d.chain.length === 0,
       'CHOMP answered it, first time, and that is what was sent: ' + JSON.stringify({ info: d.info && { model: d.info.model, label: d.info.label, p: d.info.p, ms: d.info.ms }, chain: d.chain, choice: d.choice }));
    /* end the series; STOP first, so the client exits after the row instead of searching again */
    fs.writeFileSync(stopF, 'test');
    endSeries();
    ok('ROW', await waitFor(() => jl('ladder-series-medicham32.jsonl').some(r => r.series === BO), 60000), 'the series row is written');
    const r = jl('ladder-series-medicham32.jsonl').find(x => x.series === BO) || {};
    ok('ROW', r.arm === 'A' && r.arm_config && r.arm_config.preview === 'chomp' && r.arm_config.policy === 'miltank-gen5', 'row arm ' + r.arm + ' arm_config ' + JSON.stringify(r.arm_config && { policy: r.arm_config.policy, preview: r.arm_config.preview, max_ms: r.arm_config.max_ms }));
    ok('SUMMARY', await waitFor(() => exited !== null, 90000) && exited === 0, 'the client stops on STOP after the row (exit ' + exited + ')');
    const sum = fs.readdirSync(OUT).filter(f => /^summary-medicham32/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))).pop() || {};
    const fbk = Object.keys(sum.fallbacks || {});
    ok('SUMMARY', sum.preview_by && sum.preview_by.chomp === 1 && Object.keys(sum.preview_by).length === 1, 'preview_by ' + JSON.stringify(sum.preview_by));
    ok('SUMMARY', !fbk.some(k => /chomp|^used:/.test(k)), 'no fallback counted for the preview: ' + JSON.stringify(sum.fallbacks));
  } catch (e) { fails++; console.log('  FAIL [HARNESS] ' + e.stack); }
  finally {
    if (exited === null) { try { process.kill(child.pid); } catch (e) { /* gone */ } }
    srv.close();
    if (brokenCopy) { try { fs.unlinkSync(brokenCopy); } catch (e) { /* ours; best effort */ } }
    if (fails && !BREAK) console.log('--- client stdout (tail) ---\n' + fs.readFileSync(stdoutF, 'utf8').split('\n').slice(-25).join('\n'));
  }
  /* PASS: the supervisor forwards the flags that change what is clicked */
  { const src = fs.readFileSync(path.join(ROOT, 'solver', 'rotom', 'run_ladder.js'), 'utf8');
    const m = /const PASS = \[([\s\S]*?)\]\s*\n\s*\.filter/.exec(src);
    const keys = m ? (m[1].match(/'([a-z-]+)'/g) || []).map(s => s.slice(1, -1)) : [];
    ok('PASS', ['preview', 'preview-max-ms', 'adaptive-target-ms', 'arms', 'release'].every(k => keys.includes(k)), 'run_ladder.js forwards ' + JSON.stringify(keys)); }
  if (!BREAK && !argv.includes('--no-red')) runReds();
  console.log((fails ? 'RED' : 'GREEN') + ' — test-rotom-chomp-live' + (BREAK ? ' --break ' + BREAK : '') + ': ' + (checks - fails) + '/' + checks + ' checks');
  setTimeout(() => process.exit(fails ? 1 : 0), 50);
}
main();
