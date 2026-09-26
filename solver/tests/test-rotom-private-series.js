/* solver/tests/test-rotom-private-series.js — the aa1 ladder hangs (2026-09-25), replayed through the REAL client.
 *
 *   node solver/tests/test-rotom-private-series.js        exit 0 GREEN, 1 RED, 2 CANNOT-RUN (no gate release on disk)
 *
 * WHAT HAPPENED, TWICE (solver/out/rotom/aa1-2026-09-25T21-00-29-440Z/events-medicham32.jsonl; the full account is
 * docs/_reports/2026-09-25-rotom-series-hang.md). Series k=3 and k=6 were the run's two PRIVATE series: the opponent hid
 * the room, so the server renamed it `<id>-<31 chars>pw` (pokemon-showdown-mc server/rooms.ts setPrivacy ->
 * rename(..., noAlias)). `|updatesearch|` listed the OLD id and then the NEW one, and the client joined both. The old id
 * no longer existed, so the server answered `>OLD\n|noinit|...`, and rotom.js handleBestof() created a series record
 * for ANY line in a game-bestof room, that one included. The ladder controller counted it as the next series (k=4,
 * then k=7), it could never end, openSeries() stayed 1, and the loop waited "series in progress" with no SEARCH, no
 * error and no disconnect until the process was killed. Every public series was followed by a search within seconds.
 *
 * THIS TEST runs solver/rotom/rotom.js --ladder --dry-run against a scripted websocket server in this process
 * (127.0.0.1 only; the client's netguard refuses anything else) that replays BOTH sequences: the old and new series and
 * battle ids from the run, the `noinit|nonexistent` answers for the old ids (at the run's delays: 3.3 s for k=3, 0.6 s
 * for k=6), both games' recorded logs for each series (solver/tests/fixtures/rotom/aa1-private/), the series |win| and
 * rating lines, and the last game's record landing AFTER "SERIES OVER" (the record step resolves >= 3 s after the game).
 *
 *   P1, P2 PRIVATE  after each private series the client SEARCHES AGAIN (the old code never did: RED here), with one
 *                   series started per private series (the suffixed id, k = 1 then 2), no record for an old id, no
 *                   battle for an old battle id, one row each, and the post-SERIES-OVER game record reproduced.
 *   GONE            a series room that goes silent and whose roominfo says it no longer exists is ORPHANED (logged,
 *                   counted as a ladder error) and the loop searches again.
 *   SILENT          a series room that still exists, answers roominfo "alive, we are in it", and sends nothing is NOT
 *                   orphaned (2026-09-26, aa2 k=16: it was, and the ladder searched beside a live series): no search
 *                   while it lasts; when it ends, one row and the loop searches again.
 *   UNANSWERED      a series room whose probes go unanswered is orphaned (logged, a ladder error) and the loop searches.
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
let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' [' + clause + '] ' + msg); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* the release: the gate release (or a later cut) must be on disk, or the client refuses to start */
const RD = path.join(ROOT, 'data', 'releases');
const RELEASE = (() => { try { const ids = fs.readdirSync(RD).filter(id => L.releaseAllowed(RD, id).ok); return ids.includes(L.GATE_RELEASE) ? L.GATE_RELEASE : ids[0] || null; } catch (e) { return null; } })();
if (!RELEASE) { console.log('CANNOT-RUN: no release at or after the gate ' + L.GATE_RELEASE + ' under ' + RD); process.exit(2); }

/* ---------------- the two private series, exactly as the aa1 run saw them ---------------- */
const P = 'gen9championsvgc2026regmcbo3-';
const lines = f => fs.readFileSync(path.join(FIX, f), 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
const PRIVATE = [
  { tag: 'P1 (aa1 k=3)', bo: 'game-bestof3-' + P + '2687880999', pw: '3u647uiao8y2l2rmu65vb7v2rhhboxgpw', oldBoDelay: 3200,
    b: [['battle-' + P + '2687881000', '4bl5339n46axp77eemy46cwqgaimvmbpw'], ['battle-' + P + '2687883027', '6moarfs0m4qeh4v47xevlbvmf64kgwbpw']],
    logs: [lines('k3-game1.battle.txt'), lines('k3-game2.battle.txt')], title: 'estrellitapor vs. medicham32', winner: 'medicham32', S: 1,
    ratings: ["|raw|estrellitapor's rating: 1085 &rarr; <strong>1059</strong><br />(-26 for losing)", "|raw|medicham32's rating: 1040 &rarr; <strong>1078</strong><br />(+38 for winning)"] },
  { tag: 'P2 (aa1 k=6)', bo: 'game-bestof3-' + P + '2687898010', pw: 'na7wktj7aue0kgvmvhpwk2x2fcv2rcmpw', oldBoDelay: 600,
    b: [['battle-' + P + '2687898011', 'pavio3hf958j8h8mhppqgivvn08j0bhpw'], ['battle-' + P + '2687900677', '38fpf6r98qwcmxh8apo8ckugfwtrcrbpw']],
    logs: [lines('k6-game1.battle.txt'), lines('k6-game2.battle.txt')], title: 'medicham32 vs. a8592', winner: 'a8592', S: 0,
    ratings: ["|raw|medicham32's rating: 1062 &rarr; <strong>1048</strong><br />(-14 for losing)", "|raw|a8592's rating: 1155 &rarr; <strong>1173</strong><br />(+18 for winning)"] },
];
for (const s of PRIVATE) { s.newBo = s.bo + '-' + s.pw; s.newB = s.b.map(([id, pw]) => id + '-' + pw); s.oldB = s.b.map(([id]) => id); }
const BO_GONE = 'game-bestof3-' + P + '2799000001';
const BO_SILENT = 'game-bestof3-' + P + '2799000003';
const BO_MUTE = 'game-bestof3-' + P + '2799000005';
const TITLE = '[Gen 9 Champions] VGC 2026 Reg M-C (Bo3)*';

/* ---------------- a minimal RFC 6455 server (text frames only) + the /api/login stand-in ---------------- */
let client = null;
const wire = [];   // { t, dir, text }
const T0 = Date.now();
function wsSend(text) {
  if (!client) return;
  const b = Buffer.from(text, 'utf8'); let h;
  if (b.length < 126) h = Buffer.from([0x81, b.length]);
  else if (b.length < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(b.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(b.length), 2); }
  wire.push({ t: Date.now() - T0, dir: 'S', text: text.slice(0, 160) });
  try { client.write(Buffer.concat([h, b])); } catch (e) { /* closed */ }
}
const room = (id, ls) => wsSend('>' + id + '\n' + ls.join('\n'));
const glob = line => wsSend(line);
const updatesearch = (games, searching) => glob('|updatesearch|' + JSON.stringify({ searching: searching || [], games: games ? Object.fromEntries(games.map(g => [g, TITLE])) : null }));
const nonexistent = id => room(id, ['|noinit|nonexistent|The room "' + id + '" does not exist.']);

const H = { searches: [], joins: [], probes: [], onJoin: {}, roominfo: {}, onSearch: [] };
function onClientText(text) {
  wire.push({ t: Date.now() - T0, dir: 'C', text: text.slice(0, 160) });
  const body = text.slice(text.indexOf('|') + 1);
  let m;
  if (/^\/trn /.test(body)) { glob('|updateuser| medicham32|1|1|{}'); updatesearch(null); return; }
  if ((m = /^\/crq userdetails (\S+)/.exec(body))) { glob('|queryresponse|userdetails|' + JSON.stringify({ id: m[1], userid: m[1], name: m[1], rooms: false })); return; }
  if ((m = /^\/crq roominfo (\S+)/.exec(body))) {
    H.probes.push({ t: Date.now(), room: m[1] });
    if (H.roominfo[m[1]] === 'mute') return;   // UNANSWERED: no answer at all
    const alive = H.roominfo[m[1]] === 'alive';
    glob('|queryresponse|roominfo|' + JSON.stringify(alive ? { id: m[1], roomid: m[1], title: 'x', type: 'chat', visibility: 'public', users: [' medicham32', ' Someone'] } : { id: m[1], error: 'not found or access denied' }));
    return;
  }
  if (/^\/search /.test(body)) { H.searches.push(Date.now()); updatesearch(null, [FMT]); const f = H.onSearch[H.searches.length - 1]; if (f) f(); return; }
  if (/^\/cancelsearch/.test(body)) { updatesearch(null); return; }
  if ((m = /^\/join (\S+)/.exec(body))) {
    H.joins.push({ t: Date.now(), room: m[1] });
    const f = H.onJoin[m[1]];
    if (f) f(); else setTimeout(() => nonexistent(m[1]), 50);
    return;
  }
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

/* ---------------- the scripted server ---------------- */
const at = (ms, f) => setTimeout(f, ms);
/* a private series, in the order the run's events show it (join_from_updatesearch OLD then NEW 1 ms apart; each game's
 * old battle id offered twice, then the new one) */
function playPrivate(s) {
  H.roominfo[s.newBo] = 'alive';   // a live private room answers roominfo for a member
  at(350, () => { updatesearch([s.bo]); updatesearch([s.newBo]); });
  H.onJoin[s.bo] = () => at(s.oldBoDelay, () => nonexistent(s.bo));
  H.onJoin[s.newBo] = () => at(40, () => room(s.newBo, ['|init|chat', '|title|' + s.title]));
  [0, 1].forEach(g => {
    at(1050 + g * 3000, () => { updatesearch([s.newBo, s.oldB[g]]); updatesearch([s.newBo, s.oldB[g]]); updatesearch([s.newBo, s.newB[g]]); });
    H.onJoin[s.oldB[g]] = () => at(g ? 1000 : 2400, () => nonexistent(s.oldB[g]));
    H.onJoin[s.newB[g]] = () => at(60, () => {
      room(s.newB[g], ['|init|battle'].concat(s.logs[g]));
      /* the series |win| in the bo3 room, then the rating lines in the deciding game's room (where the run saw them) */
      if (g === 1) at(50, () => { s.winAt = Date.now(); room(s.newBo, ['|win|' + s.winner]); room(s.newB[1], s.ratings); updatesearch(null); });
    });
  });
}
H.onSearch[0] = () => playPrivate(PRIVATE[0]);
H.onSearch[1] = () => playPrivate(PRIVATE[1]);
H.onSearch[2] = () => {   /* a series that goes silent and whose room no longer exists */
  at(300, () => updatesearch([BO_GONE]));
  H.onJoin[BO_GONE] = () => at(40, () => { room(BO_GONE, ['|init|chat', '|title|someone vs. medicham32']); updatesearch(null); });
};
H.onSearch[3] = () => {   /* a series whose room still exists, answers alive with us in it, and says nothing for 16 s */
  H.roominfo[BO_SILENT] = 'alive';
  at(300, () => updatesearch([BO_SILENT]));
  H.onJoin[BO_SILENT] = () => at(40, () => { room(BO_SILENT, ['|init|chat', '|title|someone else vs. medicham32']); updatesearch(null);
    at(16000, () => { H.silentEndAt = Date.now(); room(BO_SILENT, ['|win|medicham32']); }); });
};
H.onSearch[4] = () => {   /* a series whose probes go unanswered */
  H.roominfo[BO_MUTE] = 'mute';
  at(300, () => updatesearch([BO_MUTE]));
  H.onJoin[BO_MUTE] = () => at(40, () => { room(BO_MUTE, ['|init|chat', '|title|a third vs. medicham32']); updatesearch(null); });
};

async function main() {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rotom-private-'));
  const OUT = path.join(TMP, 'out');
  const args = [process.env.ROTOM_TEST_CLIENT ? path.resolve(process.env.ROTOM_TEST_CLIENT) : path.join(ROOT, 'solver', 'rotom', 'rotom.js'), '--ladder', '--dry-run', '--name', 'medicham32',
    '--server', 'ws://127.0.0.1:' + port + '/showdown/websocket', '--login-url', 'http://127.0.0.1:' + port + '/api/login',
    '--release', RELEASE, '--arms', path.join(ROOT, 'solver', 'rotom', 'arms', 'dryrun-fast.json'), '--ladder-seed', 'test-private-series',
    '--sets', '10', '--max-errors', '5', '--out', OUT, '--games-file', path.join(OUT, 'games.jsonl'),
    '--stop-file', path.join(OUT, 'STOP'), '--kill-file', path.join(OUT, 'KILL'), '--priority', 'below',
    '--series-idle-ms', '4000', '--series-probe-ms', '2000', '--series-max-probes', '2'];
  const stdoutF = path.join(TMP, 'stdout.log');
  const child = cp.spawn(process.execPath, args, { cwd: ROOT, env: Object.assign({}, process.env, { ROTOM_LOCK_DIR: TMP }), stdio: ['ignore', fs.openSync(stdoutF, 'w'), fs.openSync(stdoutF, 'a')] });
  let exited = null; child.on('exit', c => { exited = c; });
  console.log('rotom pid ' + child.pid + ' (release ' + RELEASE + ') -> ' + TMP);
  const waitFor = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; if (exited !== null) return false; await sleep(200); } return !!f(); };
  const ev = () => { try { return fs.readFileSync(path.join(OUT, 'events-medicham32.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } };
  const rows = () => { try { return fs.readFileSync(path.join(OUT, 'ladder-series-medicham32.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } };
  try {
    ok('START', await waitFor(() => H.searches.length >= 1, 120000), 'the client logs in, clears the guard and searches (exit ' + exited + ')');
    for (let i = 0; i < PRIVATE.length; i++) {
      const s = PRIVATE[i], k = i + 1, C = s.tag;
      const moved = await waitFor(() => s.winAt && H.searches.length >= k + 1, 60000);
      ok(C, moved, 'after the private series ends the client SEARCHES AGAIN' + (moved ? ' (' + ((H.searches[k] - s.winAt) / 1000).toFixed(1) + ' s after the series |win|)' : ' — NO: the loop is stuck (no /search within 60 s)'));
      await sleep(4500);   // let the last game's record land
      const E = ev();
      const starts = E.filter(e => e.type === 'ladder_series_start');
      ok(C, starts.some(e => e.room === s.newBo && e.k === k), 'series k=' + k + ' is the SUFFIXED id: ' + JSON.stringify(starts.map(e => [e.room.slice(-14), e.k])));
      ok(C, !E.some(e => e.room === s.bo && /series_start|series_join/.test(e.type)), 'no series record for the renamed-away id …' + s.bo.slice(-12));
      ok(C, !E.some(e => e.type === 'battle_join' && s.oldB.includes(e.room)), 'no battle record for the renamed-away battle ids');
      ok(C, H.joins.some(j => j.room === s.bo), 'the replay DID offer the old id and the client joined it, as in the run (else this asks nothing)');
      const R = rows().filter(r => r.series === s.newBo);
      ok(C, R.length === 1 && R[0].k === k && R[0].S === s.S && R[0].rated, 'one series row: ' + JSON.stringify(R.map(r => ({ k: r.k, S: r.S, E: r.E, rated: r.rated }))));
      const send = E.find(e => e.type === 'series_end' && e.room === s.newBo), rec = E.find(e => e.type === 'game_record' && e.room === s.newB[1]);
      ok(C, send && rec && rec.t > send.t, 'the last game\'s record lands AFTER "SERIES OVER", as in the run (' + (send && rec ? (rec.t - send.t) + ' ms after' : 'missing') + ')');
      const srch = E.filter(e => e.type === 'ladder_search');
      ok(C, srch.length >= k + 1 && srch[k].k === k + 1, 'the next search is k=' + (k + 1) + ' (no pre-committed index consumed by a phantom): ' + JSON.stringify(srch.map(x => x.k)));
      if (!moved) throw new Error('STUCK');
    }
    /* GONE: silent, roominfo says gone -> orphaned, search again */
    const g = await waitFor(() => H.searches.length >= 4, 45000);
    let E = ev();
    const orph = E.filter(e => e.type === 'ladder_series_orphan');
    ok('GONE', g && orph.some(o => o.room === BO_GONE && /gone/.test(o.why)), 'a silent series whose room is gone is orphaned and the loop searches again: ' + JSON.stringify(orph.map(o => [o.room.slice(-10), o.why])));
    ok('GONE', H.probes.some(p => p.room === BO_GONE), 'the client PROBED the silent room (roominfo) before orphaning it');
    ok('GONE', E.some(e => e.type === 'ladder_error' && e.kind === 'series_orphan'), 'an orphan is counted as a ladder error (a run of them halts), never silent');
    /* SILENT: alive, and we are in it -> never orphaned; no search until it ends */
    const sl = await waitFor(() => H.searches.length >= 5, 60000);
    E = ev();
    const o3 = E.filter(e => e.type === 'ladder_series_orphan' && e.room === BO_SILENT);
    ok('SILENT', sl && o3.length === 0, 'a room that answers "alive, we are in it" is NOT orphaned: ' + JSON.stringify(o3.map(o => o.why)));
    ok('SILENT', H.probes.filter(p => p.room === BO_SILENT).length >= 2, 'it was probed ' + H.probes.filter(p => p.room === BO_SILENT).length + 'x through its silence (else this asks nothing)');
    ok('SILENT', sl && H.silentEndAt && H.searches[4] > H.silentEndAt, 'no search while it was alive: the next search came ' + (H.silentEndAt ? ((H.searches[4] - H.silentEndAt) / 1000).toFixed(1) + ' s after its |win|' : '(it never ended)'));
    /* UNANSWERED: probes that get no answer -> orphaned */
    const mu = await waitFor(() => H.searches.length >= 6, 60000);
    E = ev();
    const o4 = E.filter(e => e.type === 'ladder_series_orphan' && e.room === BO_MUTE);
    ok('UNANSWERED', mu && o4.length === 1 && /unanswered/.test(o4[0].why), 'a room whose probes go unanswered is orphaned and the loop searches again: ' + JSON.stringify(o4.map(o => o.why)));
    await sleep(22000);   // the SILENT row waits RATING_WAIT_MS for rating lines that never come
    const LS = JSON.parse(fs.readFileSync(path.join(OUT, 'ladder-state-medicham32.json'), 'utf8'));
    ok('STATE', (LS.orphans || []).length === 2 && LS.k === 5 && LS.done === 3, 'ladder state: 3 series done, 2 orphaned, k=5: ' + JSON.stringify({ k: LS.k, done: LS.done, orphans: (LS.orphans || []).length }));
  } catch (e) { if (e.message !== 'STUCK') { fails++; console.log('  FAIL [HARNESS] ' + e.stack); } }
  finally {
    if (exited === null) { try { process.kill(child.pid); } catch (e) { /* gone */ } }
    srv.close();
    fs.writeFileSync(path.join(TMP, 'wire.jsonl'), wire.map(x => JSON.stringify(x)).join('\n') + '\n');
    if (fails) { console.log('--- client stdout (tail) ---\n' + fs.readFileSync(stdoutF, 'utf8').split('\n').slice(-25).join('\n')); console.log('wire log: ' + path.join(TMP, 'wire.jsonl')); }
  }
  console.log((fails ? 'RED' : 'GREEN') + ' — test-rotom-private-series: ' + (checks - fails) + '/' + checks + ' checks');
  process.exit(fails ? 1 : 0);
}
main();
