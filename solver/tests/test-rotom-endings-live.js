/* solver/tests/test-rotom-endings-live.js — end reasons and the self-quit HALT through the REAL client (solver/rotom/rotom.js
 * --ladder --dry-run) against a scripted websocket server in this process (127.0.0.1 only), replaying the aa1 game logs
 * in solver/tests/fixtures/rotom/aa1-private/ under fresh ids.
 *
 *   node solver/tests/test-rotom-endings-live.js                  exit 0 GREEN, 1 RED, 2 CANNOT-RUN (no gate release on disk)
 *   node solver/tests/test-rotom-endings-live.js --break selfquit a copy of rotom.js with the game-level self-quit call
 *                                                                 removed plays instead; the run must go RED
 *
 *   FORFEIT   aa1 k3 as played: g1 won normally, g2 the opponent forfeited at turn 2. The series row says forfeit_opp,
 *             end_game 2, end_turn 2; both game records carry end_reason; no halt, and the ladder searches again.
 *   WALKAWAY  aa1 k6 g1 (lost normally), then the series room says `||a8592 forfeited.` and `|win|medicham32` with no g2
 *             (gen5ab k8's shape). The row says walkaway_opp, end_game 2, at_preview, end_by a8592; no halt.
 *   SELF      the same g1 cut at turn 5 with `|-message|medicham32 forfeited.`: a self_quit event at the GAME (before the
 *             series ends), a ladder_halt, a self_quit ladder error, the row says forfeit_me, no further search, and the
 *             client exits 4 once the series is over.
 *
 * The client is our own child process; it is killed by its pid only.
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
const FIX = path.join(__dirname, 'fixtures', 'rotom', 'aa1-private');
const FMT = 'gen9championsvgc2026regmcbo3';
const BREAK = process.argv.includes('--break') ? process.argv[process.argv.indexOf('--break') + 1] : null;
let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' [' + clause + '] ' + msg); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const RD = path.join(ROOT, 'data', 'releases');
const RELEASE = (() => { try { const ids = fs.readdirSync(RD).filter(id => L.releaseAllowed(RD, id).ok); return ids.includes(L.GATE_RELEASE) ? L.GATE_RELEASE : ids[0] || null; } catch (e) { return null; } })();
if (!RELEASE) { console.log('CANNOT-RUN: no release at or after the gate ' + L.GATE_RELEASE + ' under ' + RD); process.exit(2); }

const P = 'gen9championsvgc2026regmcbo3-';
const raw = f => fs.readFileSync(path.join(FIX, f), 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
const retarget = (ls, bo) => ls.map(l => l.replace(/href="\/game-bestof3-[^"]+"/, 'href="/' + bo + '"'));
const cutAtTurn = (ls, n) => ls.slice(0, ls.findIndex(l => l === '|turn|' + n) + 1);
const S = [
  { tag: 'FORFEIT', bo: 'game-bestof3-' + P + '2799200001', b: ['battle-' + P + '2799200002', 'battle-' + P + '2799200003'], title: 'estrellitapor vs. medicham32',
    logs: bo => [retarget(raw('k3-game1.battle.txt'), bo), retarget(raw('k3-game2.battle.txt'), bo)], seriesEnd: ['|win|medicham32'],
    ratings: ["|raw|estrellitapor's rating: 1085 &rarr; <strong>1059</strong><br />(-26 for losing)", "|raw|medicham32's rating: 1040 &rarr; <strong>1078</strong><br />(+38 for winning)"] },
  { tag: 'WALKAWAY', bo: 'game-bestof3-' + P + '2799200011', b: ['battle-' + P + '2799200012'], title: 'medicham32 vs. a8592',
    logs: bo => [retarget(raw('k6-game1.battle.txt'), bo)], seriesEnd: ['||a8592 forfeited.', '|win|medicham32'],
    ratings: ["|raw|medicham32's rating: 1062 &rarr; <strong>1090</strong><br />(+28 for winning)", "|raw|a8592's rating: 1155 &rarr; <strong>1127</strong><br />(-28 for losing)"] },
  { tag: 'SELF', bo: 'game-bestof3-' + P + '2799200021', b: ['battle-' + P + '2799200022'], title: 'medicham32 vs. a8592',
    logs: bo => [cutAtTurn(retarget(raw('k6-game1.battle.txt'), bo), 5).concat(['|', '|-message|medicham32 forfeited.', '|', '|win|a8592'])], seriesEnd: ['|win|a8592'],
    ratings: ["|raw|medicham32's rating: 1090 &rarr; <strong>1070</strong><br />(-20 for losing)", "|raw|a8592's rating: 1127 &rarr; <strong>1147</strong><br />(+20 for winning)"] },
];
const TITLE = '[Gen 9 Champions] VGC 2026 Reg M-C (Bo3)*';

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
const H = { searches: [], onJoin: {}, onSearch: [] };
function onClientText(text) {
  const body = text.slice(text.indexOf('|') + 1);
  let m;
  if (/^\/trn /.test(body)) { glob('|updateuser| medicham32|1|1|{}'); updatesearch(null); return; }
  if ((m = /^\/crq userdetails (\S+)/.exec(body))) { glob('|queryresponse|userdetails|' + JSON.stringify({ id: m[1], userid: m[1], name: m[1], rooms: false })); return; }
  if ((m = /^\/crq roominfo (\S+)/.exec(body))) { glob('|queryresponse|roominfo|' + JSON.stringify({ id: m[1], roomid: m[1], title: 'x', type: 'chat', visibility: 'public', users: [' medicham32', ' Someone'] })); return; }
  if (/^\/search /.test(body)) { H.searches.push(Date.now()); updatesearch(null, [FMT]); const f = H.onSearch[H.searches.length - 1]; if (f) f(); return; }
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

/* ---------------- the scripted server: one series per search ---------------- */
const at = (ms, f) => setTimeout(f, ms);
function play(s) {
  const logs = s.logs(s.bo);
  at(300, () => updatesearch([s.bo]));
  H.onJoin[s.bo] = () => at(40, () => room(s.bo, ['|init|chat', '|title|' + s.title]));
  s.b.forEach((bid, gi) => {
    at(1000 + gi * 2500, () => updatesearch([s.bo, bid]));
    H.onJoin[bid] = () => at(60, () => {
      room(bid, ['|init|battle'].concat(logs[gi]));
      if (gi === s.b.length - 1) at(80, () => { s.winAt = Date.now(); room(s.bo, s.seriesEnd); at(300, () => room(bid, s.ratings)); updatesearch(null); });
    });
  });
}
S.forEach((s, i) => { H.onSearch[i] = () => play(s); });

async function main() {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rotom-endings-live-'));
  const OUT = path.join(TMP, 'out');
  let clientFile = path.join(ROOT, 'solver', 'rotom', 'rotom.js'), brokenCopy = null;
  if (BREAK === 'selfquit') {
    /* a copy next to the original (so its relative requires resolve), with the game-level self-quit call removed */
    const src = fs.readFileSync(clientFile, 'utf8');
    const anchor = "if (ENDINGS.SELF_QUIT.has(END.end_reason)) selfQuit(";
    if (!src.includes(anchor)) { console.log('break anchor not found'); process.exit(1); }
    brokenCopy = path.join(ROOT, 'solver', 'rotom', '.rotom-endings-break-' + process.pid + '.js');
    fs.writeFileSync(brokenCopy, src.split(anchor).join('if (false) selfQuit('));
    clientFile = brokenCopy;
  } else if (BREAK) { console.error('unknown --break ' + BREAK); process.exit(2); }
  const args = [clientFile, '--ladder', '--dry-run', '--name', 'medicham32',
    '--server', 'ws://127.0.0.1:' + port + '/showdown/websocket', '--login-url', 'http://127.0.0.1:' + port + '/api/login',
    '--release', RELEASE, '--arms', path.join(ROOT, 'solver', 'rotom', 'arms', 'dryrun-fast.json'), '--ladder-seed', 'test-endings-live',
    '--sets', '10', '--max-errors', '5', '--out', OUT, '--games-file', path.join(OUT, 'games.jsonl'),
    '--stop-file', path.join(OUT, 'STOP'), '--kill-file', path.join(OUT, 'KILL'), '--priority', 'below'];
  const stdoutF = path.join(TMP, 'stdout.log');
  const child = cp.spawn(process.execPath, args, { cwd: ROOT, env: Object.assign({}, process.env, { ROTOM_LOCK_DIR: TMP }), stdio: ['ignore', fs.openSync(stdoutF, 'w'), fs.openSync(stdoutF, 'a')] });
  let exited = null; child.on('exit', c => { exited = c; });
  console.log('rotom pid ' + child.pid + ' (release ' + RELEASE + (brokenCopy ? ', BROKEN COPY ' + path.basename(brokenCopy) : '') + ') -> ' + TMP);
  const waitFor = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; if (exited !== null) return !!f(); await sleep(200); } return !!f(); };
  const ev = () => { try { return fs.readFileSync(path.join(OUT, 'events-medicham32.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } };
  const rows = () => { try { return fs.readFileSync(path.join(OUT, 'ladder-series-medicham32.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } };
  /* self_quit / ladder_halt events that name one of this series' rooms (the next series may already be playing) */
  const mine = s => ev().filter(e => (e.type === 'self_quit' && [s.bo].concat(s.b).includes(e.room)) || (e.type === 'ladder_halt' && [s.bo].concat(s.b).some(x => String(e.why).includes(x))));
  const recs = () => { try { return fs.readFileSync(path.join(OUT, 'games.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } };
  try {
    ok('START', await waitFor(() => H.searches.length >= 1, 120000), 'the client logs in, clears the guard and searches (exit ' + exited + ')');
    /* FORFEIT */
    { const s = S[0];
      ok(s.tag, await waitFor(() => rows().some(r => r.series === s.bo) && H.searches.length >= 2, 60000), 'the series row is written and the client searches again');
      const r = rows().find(x => x.series === s.bo) || {};
      ok(s.tag, r.end_reason === 'forfeit_opp' && r.end_game === 2 && r.end_turn === 2 && r.at_preview === false && r.games_won === 2 && r.rated === true,
         'row: ' + JSON.stringify({ e: r.end_reason, g: r.end_game, t: r.end_turn, p: r.at_preview, w: r.games_won, rated: r.rated }));
      ok(s.tag, Array.isArray(r.games_end) && r.games_end.map(x => x.end_reason).join() === 'normal,forfeit_opp', 'games_end: ' + JSON.stringify(r.games_end));
      await waitFor(() => recs().filter(x => x.series === s.bo).length === 2, 20000);
      const G = recs().filter(x => x.series === s.bo).sort((a, b) => a.game - b.game);
      ok(s.tag, G.length === 2 && G[0].end_reason === 'normal' && G[1].end_reason === 'forfeit_opp' && G[1].end_by === 'estrellitapor' && G[1].end_turn === 2 && G[1].end_raw === '|-message|estrellitapor forfeited.',
         'game records: ' + JSON.stringify(G.map(x => ({ g: x.game, e: x.end_reason, by: x.end_by, t: x.end_turn }))));
      ok(s.tag, !mine(s).length, 'no self quit and no halt from this series: ' + JSON.stringify(mine(s))); }
    /* WALKAWAY */
    { const s = S[1];
      ok(s.tag, await waitFor(() => rows().some(r => r.series === s.bo) && H.searches.length >= 3, 60000), 'the series row is written and the client searches again');
      const r = rows().find(x => x.series === s.bo) || {};
      ok(s.tag, r.end_reason === 'walkaway_opp' && r.walkaway === 'opp' && r.end_game === 2 && r.end_turn === 0 && r.at_preview === true && r.games_won === 0 && r.games_lost === 1 && r.end_by === 'a8592' && r.S === 1,
         'row: ' + JSON.stringify({ e: r.end_reason, w: r.walkaway, g: r.end_game, p: r.at_preview, score: r.games_won + '-' + r.games_lost, by: r.end_by, S: r.S }));
      ok(s.tag, ev().some(e => e.type === 'series_quit_line' && e.room === s.bo && e.by === 'a8592'), 'the series-room forfeit line was logged (series_quit_line)');
      ok(s.tag, !mine(s).length, 'no self quit and no halt from this series: ' + JSON.stringify(mine(s))); }
    /* SELF */
    { const s = S[2];
      const done = await waitFor(() => exited !== null, 90000);
      const E = ev();
      const sq = E.find(e => e.type === 'self_quit'), send = E.find(e => e.type === 'series_end' && e.room === s.bo);
      ok(s.tag, sq && sq.level === 'game' && sq.end_reason === 'forfeit_me' && send && sq.t <= send.t, 'a GAME-level self_quit, before the series ended: ' + JSON.stringify(sq && { lvl: sq.level, e: sq.end_reason, room: sq.room }));
      ok(s.tag, E.some(e => e.type === 'ladder_halt' && /SELF QUIT: forfeit_me/.test(e.why)) && E.some(e => e.type === 'ladder_error' && e.kind === 'self_quit'), 'ladder_halt and a self_quit ladder error');
      const r = rows().find(x => x.series === s.bo) || {};
      ok(s.tag, r.end_reason === 'forfeit_me' && r.end_turn === 5, 'the row says forfeit_me at turn 5: ' + JSON.stringify({ e: r.end_reason, t: r.end_turn }));
      ok(s.tag, H.searches.length === 3, 'no search after the halt: ' + H.searches.length + ' searches');
      ok(s.tag, done && exited === 4, 'the client exits 4 (HALTED, final for the supervisor) once the series is over: exit ' + exited);
      const LS = JSON.parse(fs.readFileSync(path.join(OUT, 'ladder-state-medicham32.json'), 'utf8'));
      ok(s.tag, LS.self_quits === 1 && /SELF QUIT/.test(LS.halted || ''), 'ladder state: self_quits 1, halted: ' + JSON.stringify({ q: LS.self_quits, h: LS.halted }));
      const sum = fs.readdirSync(OUT).filter(f => /^summary-medicham32/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))).pop() || {};
      ok(s.tag, (sum.self_quits || []).length === 1 && sum.end_reasons && sum.end_reasons.forfeit_me === 1 && sum.end_reasons.forfeit_opp === 1, 'the summary counts it: ' + JSON.stringify({ q: (sum.self_quits || []).length, r: sum.end_reasons })); }
    /* the report over this run */
    { const R = require('../rotom/report.js').ladderReport(OUT, { dryRun: true });
      ok('REPORT', R.all.record === '2-1' && R.quit_wins === 2 && R.without_quit_wins.record === '0-1' && R.self_quits === 1, 'ladder report: ' + JSON.stringify({ all: R.all.record, wo: R.without_quit_wins.record, q: R.quit_wins, self: R.self_quits }));
      const A = require('../rotom/report.js').aggregate(OUT);
      ok('REPORT', A.totals.self_quits === 1, 'aggregate totals.self_quits = 1: ' + A.totals.self_quits); }
  } catch (e) { fails++; console.log('  FAIL [HARNESS] ' + e.stack); }
  finally {
    if (exited === null) { try { process.kill(child.pid); } catch (e) { /* gone */ } }
    srv.close();
    if (brokenCopy) { try { fs.unlinkSync(brokenCopy); } catch (e) { /* ours; best effort */ } }
    if (fails) console.log('--- client stdout (tail) ---\n' + fs.readFileSync(stdoutF, 'utf8').split('\n').slice(-25).join('\n'));
  }
  console.log((fails ? 'RED' : 'GREEN') + ' — test-rotom-endings-live' + (BREAK ? ' --break ' + BREAK : '') + ': ' + (checks - fails) + '/' + checks + ' checks');
  process.exit(fails ? 1 : 0);
}
main();
