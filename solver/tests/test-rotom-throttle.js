/* solver/tests/test-rotom-throttle.js — Showdown's message throttle, the lost team-preview choice, the orphaned live
 * series (aa2 k=16, 2026-09-26; docs/_reports/2026-09-26-orphaned-series-k16.md), and CHOSEN VS APPLIED for every
 * decision (the fix and the account: docs/_reports/2026-09-26-rotom-throttle-fix.md).
 *
 *   node solver/tests/test-rotom-throttle.js [--a-only]      exit 0 GREEN, 1 RED, 2 CANNOT-RUN (no gate release on disk)
 *
 * WHAT HAPPENED. The server allows one message per 600 ms per user and queues five; the next is DROPPED with a
 * `message-throttle-notice` (pokemon-showdown-mc server/users.ts:1429-1467, modelled line for line in
 * solver/tests/throttle_model.js). ROTOM sent everything at once, and the burst at the start of a series ended in
 * `/timer on` and `/choose team …`, the two messages that matter, so 14 of 17 game-1 previews in aa2 were played with the
 * server's default (slots 1-4, leads 1+2) while the decision log said `sent: true`. With no choice and no timer the room
 * went silent; the stall watch probed it, heard "alive, 2 users, we are in it" three times, orphaned it anyway, and the
 * ladder searched again while the orphaned series went on being played, untracked.
 *
 * PART A — the burst on simulated time (no server, no client):
 *   A-OLD    the k=16 message sequence (the run's events and the report's timeline) sent unpaced through the throttle
 *            model: the server drops the battle's `/timer on` and `/choose` — the run's two notices. (If this ever reads
 *            zero drops, the model is not the server and nothing below asks anything.)
 *   A-PACED  the same through solver/rotom/sendq.js: zero drops, and `/choose` jumps the queue.
 *
 * PART B — the REAL client (solver/rotom/rotom.js --ladder --dry-run) against a scripted server in this process that runs
 * every client frame through the throttle model and plays each game on the REAL simulator (the checkout's BattleStream;
 * the opponent is its RandomPlayerAI), so every request, every protocol line and every choice is the server's own:
 *   K16      matched, both rooms pushed at once, the preview, then SILENCE: the opponent sits on its preview for 14 s and
 *            nobody's timer is on, while the watch probes and roominfo answers "alive, we are in it". PASS: the server
 *            applied OUR pick, zero frames dropped, our `/timer on` arrived, the series is NOT orphaned, no `/search` while
 *            its battle is live, the preview verified, zero applied-mismatches over the whole game (every move, target,
 *            mega, switch, forced switch, the timer), one row, the next search only after the series.
 *   NOTICE   the server drops our first `/choose` with the notice. PASS: the notice is counted, the open choice RESENT,
 *            and the server applied it.
 *   CONTROL  THE DELIBERATE BREAK: the server applies a team order that is NOT ours. PASS: the verifier reports the
 *            mismatch (event, row counter, ladder error). A verifier that reads zero here is asking nothing.
 *   RATE     over the whole run, applied-mismatches == exactly the one the CONTROL planted: the floor is ZERO.
 *
 * ROTOM_TEST_CLIENT=<path> runs another client file (the pre-fix one, to show this test RED). The client is our own child
 * process and is killed by its pid only.
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
const TM = require('./throttle_model.js');
const FMT = 'gen9championsvgc2026regmcbo3';
let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' [' + clause + '] ' + msg); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ME = 'medicham32', OPP = 'weedwizardxx68';

/* ================= PART A: the k=16 burst on simulated time ================= */
const P = 'gen9championsvgc2026regmcbo3-';
const BO15 = 'game-bestof3-' + P + '2687984410', B15G2 = 'battle-' + P + '2687986999';
const BO16 = 'game-bestof3-' + P + '2687988520', B16G1 = 'battle-' + P + '2687988521';
/* ms relative to the k=16 `ladder_search` (01:53:30.196Z), from events-medicham32.jsonl and the report's timeline; the
 * guard's userdetails query precedes a search when its answer is stale (a `/crq`, which is NOT the exempt `/cmd`) */
const K16_BURST = [
  [-936, B15G2 + '|/savereplay'],
  [-5, '|/crq userdetails willhoop'],
  [0, '|/utm <team>'], [0, '|/search ' + FMT],
  [159, '|/leave ' + BO15],
  [1202, '|/join ' + BO16], [1211, BO16 + '|/timer on'],
  [1238, '|/join ' + B16G1], [1239, '|/join ' + B16G1],
  [1242, B16G1 + '|/timer on'],
  [1349, B16G1 + '|/choose team 2143|2'],
];
function partA() {
  const run = (paced) => {
    const C = TM.simClock();
    const processed = [], notices = [];
    const U = new TM.ThrottledUser({ now: C.now, setTimeout: C.setTimeout, parse: (m, r) => processed.push({ t: C.now(), r, m }), notice: r => notices.push({ t: C.now(), r }) });
    let SQ = null; const handed = {};
    if (paced) {
      const { SendQueue } = require('../rotom/sendq.js');
      SQ = new SendQueue({ gapMs: 650, write: f => U.receive(f), isOpen: () => true, now: C.now, setTimeout: C.setTimeout, clearTimeout: C.clearTimeout });
    }
    const base = 2000;   // shift so every time is positive
    for (const [t, f] of K16_BURST) C.at(base + t, () => { handed[f] = C.now(); if (SQ) SQ.send(f); else U.receive(f); });
    C.run(base + 20000);
    return { U, processed, notices, handed };
  };
  const old = run(false);
  const dr = old.U.dropped().map(d => (d.roomid ? d.roomid.slice(-10) + '|' : '|') + d.message.split(' ').slice(0, 2).join(' '));
  ok('A-OLD', old.U.dropped().length === 2 && old.U.dropped().some(d => /^\/choose /.test(d.message)) && old.U.dropped().some(d => d.roomid === B16G1 && d.message === '/timer on'),
    'the k=16 burst sent unpaced: the server drops the battle\'s `/timer on` and `/choose` (the run saw exactly two notices): ' + JSON.stringify(dr));
  let neu = null;
  try { neu = run(true); } catch (e) { ok('A-PACED', false, 'solver/rotom/sendq.js: ' + e.message); return; }
  const ch = neu.processed.find(p => /^\/choose /.test(p.m));
  const wait = ch ? ch.t - neu.handed[B16G1 + '|/choose team 2143|2'] : null;
  ok('A-PACED', neu.U.dropped().length === 0 && neu.notices.length === 0, 'paced at 650 ms: zero messages dropped (' + neu.U.dropped().length + '), zero notices');
  ok('A-PACED', neu.processed.length === K16_BURST.length, 'every message reached the server: ' + neu.processed.length + '/' + K16_BURST.length);
  ok('A-PACED', ch && wait <= 1950, '`/choose` jumps the queue: applied ' + wait + ' ms after it was handed to send() (<= 3 gaps)');
  const order = neu.processed.map(p => p.m.split(' ')[0]);
  ok('A-PACED', order.indexOf('/choose') < order.lastIndexOf('/join') && order.indexOf('/timer') < order.lastIndexOf('/join'), 'the choice and the timer go out ahead of the queued room and lobby traffic: ' + order.join(' '));
}

/* ================= PART B: the real client against a throttled server playing the real simulator ================= */
const RD = path.join(ROOT, 'data', 'releases');
const RELEASE = (() => { try { const ids = fs.readdirSync(RD).filter(id => L.releaseAllowed(RD, id).ok); return ids.includes(L.GATE_RELEASE) ? L.GATE_RELEASE : ids[0] || null; } catch (e) { return null; } })();
const TITLE = '[Gen 9 Champions] VGC 2026 Reg M-C (Bo3)*';
const NOTICE = TM.NOTICE;
const ROTATION = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'rotom', 'teams', 'ladder-rotation.json'), 'utf8')).teams;

let client = null;
const wire = [];
const T0 = Date.now();
function wsSend(text) {
  if (!client) return;
  const b = Buffer.from(text, 'utf8'); let h;
  if (b.length < 126) h = Buffer.from([0x81, b.length]);
  else if (b.length < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(b.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(b.length), 2); }
  wire.push({ t: Date.now() - T0, dir: 'S', text: text.slice(0, 200) });
  try { client.write(Buffer.concat([h, b])); } catch (e) { /* closed */ }
}
const room = (id, ls) => wsSend('>' + id + '\n' + ls.join('\n'));
const glob = line => wsSend(line);
const updatesearch = (games, searching) => glob('|updatesearch|' + JSON.stringify({ searching: searching || [], games: games && games.length ? Object.fromEntries(games.map(g => [g, TITLE])) : null }));

/* the server's per-user throttle, on real time: every client frame goes through it */
const TU = new TM.ThrottledUser({ now: Date.now, setTimeout, parse: (m, r) => onClientText(m, r), notice: r => (r ? room(r, [NOTICE]) : glob(NOTICE)) });
const H = { searches: [], probes: [], series: [], live: new Set(), utm: null };
const PLAN = ['k16', 'notice', 'control'];

let SIM = null;
function sim() {
  if (SIM) return SIM;
  const SD = require('../human/dex.js').SHOWDOWN_PATH;
  SIM = { S: require(path.join(SD, 'dist', 'sim')), AI: require(path.join(SD, 'dist', 'sim', 'tools', 'random-player-ai.js')).RandomPlayerAI };
  return SIM;
}
/* one series = its bo3 room + game 1, played on the real simulator */
function startSeries(i, mode) {
  const n = 2799100000 + i * 10;
  const s = { i, mode, bo: 'game-bestof3-' + P + n, bat: 'battle-' + P + (n + 1), rqid: 0, req: null, ourState: 'none', oppChosen: false, chooses: [], timers: 0, teamChoices: [],
              dropFirst: mode === 'notice', searchesWhileLive: 0, matchedAt: Date.now() };
  H.series.push(s);
  H.live.add(s.bo); H.live.add(s.bat);
  const { S, AI } = sim();
  const ours = H.utm;
  const opp = ROTATION.find(t => t.packed !== ours).packed;
  const bs = new S.BattleStream();
  const ps = S.getPlayerStreams(bs);
  s.p2 = ps.p2;
  /* the opponent: the checkout's random AI; in K16 it sits on its preview for 14 s (the run: ~4.5 min, nobody's timer) */
  class SlowPreviewAI extends AI {
    receiveRequest(r) { const go = () => { s.oppChosen = true; super.receiveRequest(r); }; if (r.teamPreview && mode === 'k16') setTimeout(go, 14000); else go(); }
  }
  new SlowPreviewAI(ps.p1, { seed: [1, 2, 3, 4 + i] }).start().catch(() => {});
  /* the real server pushes both rooms to both players the moment they are matched, the battle's log and the preview
   * request with them (the run: battle_join 40 ms after the match, the preview decided 107 ms later); |updatesearch|
   * lists them too, and lists the battle twice before its room speaks (the run's two join_from_updatesearch lines). So
   * the simulator's opening is buffered and everything goes out in ONE tick, the way the burst hit the throttle. */
  const buffered = [];
  s.announced = false;
  const announce = () => {
    if (s.announced) return; s.announced = true; s.matchedAt = Date.now();
    updatesearch([s.bo]);
    room(s.bo, ['|init|chat', '|title|' + OPP + ' vs. ' + ME]);
    updatesearch([s.bo, s.bat]); updatesearch([s.bo, s.bat]);
    room(s.bat, ['|init|battle', '|title|' + OPP + ' vs. ' + ME, '|j|☆' + OPP, '|j|☆' + ME, '|uhtml|bestof|<h2><strong>Game 1</strong> of <a href="/' + s.bo + '">a best-of-3</a></h2>'].concat(buffered));
  };
  (async () => {
    for await (const chunk of ps.p2) {
      const out = [];
      for (const line of chunk.split('\n')) {
        if (line.startsWith('|request|')) {
          const r = JSON.parse(line.slice(9));
          if (r.wait) { s.ourState = 'none'; out.push(line); continue; }
          s.rqid++; r.rqid = s.rqid; s.req = r; s.ourState = false; s.oppChosen = false;
          out.push('|request|' + JSON.stringify(r));
          continue;
        }
        out.push(line);
        if (line.startsWith('|win|') || line === '|tie') setTimeout(() => endSeries(s, line.startsWith('|win|') ? line.slice(5) : null), 300);
      }
      if (s.announced) room(s.bat, out);
      else { buffered.push(...out); if (out.some(l => l.startsWith('|request|'))) setTimeout(announce, 40); }   // the |showteam| lines follow the request: take them too
    }
  })().catch(e => { s.simError = e.message; });
  bs.write('>start ' + JSON.stringify({ formatid: FMT, seed: [5, 6, 7, 8 + i] }));
  bs.write('>player p1 ' + JSON.stringify({ name: OPP, team: opp }));
  bs.write('>player p2 ' + JSON.stringify({ name: ME, team: ours }));
  return s;
}
function endSeries(s, winner) {
  if (s.endedAt) return;
  s.endedAt = Date.now(); s.winner = winner;
  H.live.delete(s.bat); H.live.delete(s.bo);
  room(s.bo, ['|win|' + (winner || OPP)]);
  const meWon = winner === ME;
  room(s.bat, ["|raw|" + OPP + "'s rating: 1000 &rarr; <strong>" + (meWon ? 985 : 1015) + "</strong><br />", "|raw|" + ME + "'s rating: 1031 &rarr; <strong>" + (meWon ? 1046 : 1016) + "</strong><br />"]);
  updatesearch(null);
}
function onClientText(msg, roomid) {
  wire.push({ t: Date.now() - T0, dir: 'C', text: (roomid ? roomid.slice(-12) + '|' : '|') + msg.slice(0, 160) });
  let m;
  if (/^\/trn /.test(msg)) { glob('|updateuser| ' + ME + '|1|1|{}'); updatesearch(null); return; }
  if ((m = /^\/(?:crq|cmd) userdetails (\S+)/.exec(msg))) { glob('|queryresponse|userdetails|' + JSON.stringify({ id: m[1], userid: m[1], name: m[1], rooms: false })); return; }
  if ((m = /^\/crq roominfo (\S+)/.exec(msg))) {
    const alive = H.live.has(m[1]);
    H.probes.push({ t: Date.now(), room: m[1], alive });
    glob('|queryresponse|roominfo|' + JSON.stringify(alive ? { id: m[1], roomid: m[1], title: 'x', type: 'battle', visibility: 'public', users: [' ' + ME, ' ' + OPP] } : { id: m[1], error: 'not found or access denied' }));
    return;
  }
  if ((m = /^\/utm (.+)$/.exec(msg))) { H.utm = m[1]; return; }
  if (/^\/search /.test(msg)) {
    H.searches.push(Date.now());
    for (const s of H.series) if (H.live.has(s.bat)) s.searchesWhileLive++;
    updatesearch(null, [FMT]);
    const i = H.searches.length - 1;
    if (i < PLAN.length && !H.series.some(s => !s.endedAt)) setTimeout(() => startSeries(i, PLAN[i]), 20);   // matched as the queued /search is processed (the run)
    return;
  }
  if (/^\/cancelsearch/.test(msg)) { updatesearch(null); return; }
  if (/^\/(join|leave) /.test(msg)) return;   // the players are already in both rooms (the server put them there)
  const s = H.series.find(x => x.bat === roomid);
  if (s && msg === '/timer on') {
    s.timers++;
    room(roomid, [s.timers === 1 ? '|inactive|Battle timer is ON: inactive players will automatically lose when time\'s up. (requested by ' + ME + ')' : '']);
    return;
  }
  if (s && (m = /^\/choose (.+)\|(\d+)$/.exec(msg))) {
    let choice = m[1]; const rq = +m[2];
    s.chooses.push({ t: Date.now(), choice, rqid: rq });
    if (s.dropFirst) { s.dropFirst = false; s.forcedDrop = Date.now(); room(roomid, [NOTICE]); return; }   // NOTICE: lost as a throttled message is
    /* server/room-battle.ts choose(): nothing to choose / too late / accept */
    if (s.ourState !== false && s.ourState !== true) { room(roomid, ['|error|[Invalid choice] There\'s nothing to choose']); return; }
    if (rq !== s.rqid || (s.ourState === true && s.oppChosen)) { room(roomid, ['|error|[Invalid choice] Sorry, too late to make a different move; the next turn has already started']); return; }
    if (/^team \d{4}$/.test(choice)) {
      s.teamChoices.push(choice.slice(5));
      if (s.mode === 'control') { const d = choice.slice(5).split(''); choice = 'team ' + [d[2], d[3], d[0], d[1]].join(''); }   // THE DELIBERATE BREAK
      s.appliedTeam = choice.slice(5);
    }
    s.ourState = true;
    void s.p2.write(choice);
    return;
  }
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
      if (op === 1) TU.receive(payload.toString('utf8'));
      else if (op === 8) { try { sock.end(); } catch (e) { /* closing */ } return; }
      else if (op === 9) { try { sock.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); } catch (e) { /* closing */ } }
    }
  });
  sock.on('error', () => {});
  sock.on('close', () => { if (client === sock) client = null; });
  setTimeout(() => glob('|challstr|4|' + crypto.randomBytes(16).toString('hex')), 50);
});

async function partB() {
  if (!RELEASE) { console.log('CANNOT-RUN: no release at or after the gate ' + L.GATE_RELEASE + ' under ' + RD); process.exit(2); }
  /* warm the simulator (dex, format, validator) so a match costs milliseconds: in the run the match came the moment the
   * server processed /search (01:53:31.398, the queued /search's turn), and the burst landed on a still-busy queue */
  await (async () => { const { S } = sim(); const bs = new S.BattleStream(); const ps = S.getPlayerStreams(bs);
    bs.write('>start ' + JSON.stringify({ formatid: FMT })); bs.write('>player p1 ' + JSON.stringify({ name: 'a', team: ROTATION[0].packed })); bs.write('>player p2 ' + JSON.stringify({ name: 'b', team: ROTATION[1].packed }));
    for await (const c of ps.p2) if (/\|request\|/.test(c)) break; })();
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rotom-throttle-'));
  const OUT = path.join(TMP, 'out');
  const args = [process.env.ROTOM_TEST_CLIENT ? path.resolve(process.env.ROTOM_TEST_CLIENT) : path.join(ROOT, 'solver', 'rotom', 'rotom.js'), '--ladder', '--dry-run', '--name', ME,
    '--server', 'ws://127.0.0.1:' + port + '/showdown/websocket', '--login-url', 'http://127.0.0.1:' + port + '/api/login',
    '--release', RELEASE, '--arms', path.join(ROOT, 'solver', 'rotom', 'arms', 'aa-prior.json'), '--ladder-seed', 'test-throttle',
    '--sets', '10', '--max-errors', '5', '--max-mismatches', '5', '--out', OUT, '--games-file', path.join(OUT, 'games.jsonl'),
    '--stop-file', path.join(OUT, 'STOP'), '--kill-file', path.join(OUT, 'KILL'), '--priority', 'below',
    '--series-idle-ms', '4000', '--series-probe-ms', '2000', '--series-max-probes', '2'];
  const stdoutF = path.join(TMP, 'stdout.log');
  const child = cp.spawn(process.execPath, args, { cwd: ROOT, env: Object.assign({}, process.env, { ROTOM_LOCK_DIR: TMP }), stdio: ['ignore', fs.openSync(stdoutF, 'w'), fs.openSync(stdoutF, 'a')] });
  let exited = null; child.on('exit', c => { exited = c; });
  console.log('rotom pid ' + child.pid + ' (release ' + RELEASE + ') -> ' + TMP);
  const waitFor = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; if (exited !== null) return false; await sleep(200); } return !!f(); };
  const rd = f => { try { return fs.readFileSync(path.join(OUT, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } };
  const ev = () => rd('events-' + ME + '.jsonl'), rows = () => rd('ladder-series-' + ME + '.jsonl'), decs = () => rd('decisions-' + ME + '.jsonl'), games = () => rd('games.jsonl');
  try {
    ok('START', await waitFor(() => H.searches.length >= 1, 120000), 'the client logs in, clears the guard and searches (exit ' + exited + ')');
    for (let i = 0; i < PLAN.length; i++) {
      const moved = await waitFor(() => H.series[i] && H.series[i].endedAt && H.searches.length >= i + 2, 240000);
      await sleep(i === PLAN.length - 1 ? 26000 : 2000);   // the rating wait and the record step
      const s = H.series[i], C = s ? s.mode.toUpperCase() : 'SERIES ' + i;
      if (!s) { ok(C, false, 'series ' + i + ' never started'); break; }
      if (s.simError) ok(C, false, 'the simulator stream failed: ' + s.simError);
      const E = ev();
      const pd = decs().find(d => d.room === s.bat && d.kind === 'preview');
      const chosen = pd && /^team (\d{4})$/.test(pd.choice) ? pd.choice.slice(5) : null;
      const drops = TU.log.filter(x => x.fate === 'dropped' && x.t >= s.matchedAt - 2000 && x.t <= (s.endedAt || Infinity));
      const vr = E.filter(e => e.type === 'preview_verify' && e.room === s.bat);
      const R = rows().filter(r => r.series === s.bo);
      const G = games().find(g => g.room === s.bat);
      const A = G && G.applied;
      const aTxt = A ? JSON.stringify({ chosen: A.chosen, applied: A.applied, explained: A.explained_diff, mismatch: A.mismatch, kinds: Object.keys(A.by_kind || {}).join(',') }) : 'no record';
      if (s.mode === 'k16') {
        ok(C, chosen && chosen !== '1234', 'the policy\'s pick differs from the server default, so a lost choice is visible: team ' + chosen);
        ok(C, s.appliedTeam === chosen, 'the server applied OUR pick: applied ' + (s.appliedTeam || 'nothing — the server default') + ', chosen ' + chosen + (drops.length ? '; dropped: ' + JSON.stringify(drops.map(d => d.message.slice(0, 24))) : ''));
        ok(C, drops.length === 0, 'the throttle dropped nothing around this series (' + drops.length + ' dropped)');
        ok(C, s.timers >= 1, 'our `/timer on` reached the battle (' + s.timers + ')');
        ok(C, H.probes.some(p => p.room === s.bo && p.alive), 'the silent series WAS probed and roominfo answered "alive, we are in it" (' + H.probes.filter(p => p.room === s.bo).length + ' probes) — else this asks nothing');
        ok(C, !E.some(e => /series_orphan/.test(e.type) && e.room === s.bo), 'an alive series we are in is NOT orphaned: ' + JSON.stringify(E.filter(e => /series_orphan/.test(e.type)).map(e => e.why)));
        ok(C, s.searchesWhileLive === 0, 'no `/search` while its battle was live (' + s.searchesWhileLive + ')');
        ok(C, vr.length === 1 && vr[0].ok === true, 'the preview verified against the server\'s post-preview request: ' + JSON.stringify(vr.map(v => ({ ok: v.ok, expected: v.expected, actual: v.actual }))));
        ok(C, A && A.mismatch === 0 && A.chosen >= 10 && A.by_kind.move && A.by_kind.move.chosen > 0 && A.by_kind.timer && A.by_kind.timer.applied === 1, 'every decision of the game checked, zero mismatches: ' + aTxt);
      } else if (s.mode === 'notice') {
        ok(C, !!s.forcedDrop, 'the server dropped the first `/choose` with the throttle notice (else this asks nothing)');
        ok(C, E.some(e => e.type === 'throttle_notice' && e.room === s.bat), 'the client counted the notice in the battle room');
        ok(C, s.chooses.length >= 2 && s.appliedTeam === chosen, 'the client RESENT the open choice and the server applied it: applied ' + s.appliedTeam + ', chosen ' + chosen + ' (' + s.chooses.filter(c => /^team/.test(c.choice)).length + ' preview `/choose` received)');
        ok(C, vr.length === 1 && vr[0].ok === true, 'preview verified after the resend: ' + JSON.stringify(vr.map(v => v.ok)));
        ok(C, A && A.mismatch === 0, 'zero applied-mismatches over the game: ' + aTxt);
        ok(C, s.searchesWhileLive === 0, 'no `/search` while its battle was live (' + s.searchesWhileLive + ')');
      } else {
        ok(C, s.appliedTeam && s.appliedTeam !== chosen, 'the deliberate break: the server applied ' + s.appliedTeam + ', not our ' + chosen);
        ok(C, vr.length === 1 && vr[0].ok === false, 'the verifier reports the MISMATCH (a verifier that reads zero here is asking nothing): ' + JSON.stringify(vr.map(v => ({ ok: v.ok, expected: v.expected, actual: v.actual }))));
        ok(C, A && A.by_kind.preview && A.by_kind.preview.mismatch === 1, 'the game record carries it: ' + aTxt);
        ok(C, R.length === 1 && R[0].during_series && R[0].during_series.preview_mismatch === 1 && R[0].during_series.applied_mismatch >= 1, 'the series row carries it: ' + JSON.stringify(R[0] && R[0].during_series && { applied_mismatch: R[0].during_series.applied_mismatch, preview_mismatch: R[0].during_series.preview_mismatch }));
        ok(C, E.some(e => e.type === 'ladder_error' && e.kind === 'applied_mismatch' && /preview/.test(e.detail || '')), 'and the ladder logs it as an error the moment it is seen');
      }
      if (s.mode !== 'control') ok(C, R.length === 1 && R[0].during_series && R[0].during_series.applied_mismatch === 0 && R[0].during_series.preview_mismatch === 0 && R[0].rated, 'one series row, 0 mismatches: ' + JSON.stringify(R.map(r => ({ k: r.k, S: r.S, am: r.during_series && r.during_series.applied_mismatch, pm: r.during_series && r.during_series.preview_mismatch, checks: r.during_series && r.during_series.applied_checks }))));
      ok(C, moved && H.searches[i + 1] > s.endedAt, 'the next search comes only AFTER the series ended' + (moved ? ' (' + ((H.searches[i + 1] - s.endedAt) / 1000).toFixed(1) + ' s after)' : ' — none within 240 s'));
      if (!moved) break;
    }
    /* RATE: over the whole run, the only mismatch is the planted one */
    const all = games(), tot = all.reduce((a, g) => { const x = g.applied || {}; a.c += x.chosen || 0; a.m += x.mismatch || 0; a.e += x.explained_diff || 0; return a; }, { c: 0, m: 0, e: 0 });
    const plantedOnly = all.filter(g => g.applied && g.applied.mismatch).every(g => H.series.find(s => s.bat === g.room && s.mode === 'control') && g.applied.mismatch === 1);
    ok('RATE', all.length === PLAN.length && tot.c > 30 && tot.m === 1 && plantedOnly, 'applied-mismatch floor ZERO outside the planted break: ' + tot.m + ' mismatches in ' + tot.c + ' checks over ' + all.length + ' games (' + tot.e + ' explained differences)');
    const f = fs.readdirSync(OUT).filter(x => /^summary-/.test(x)).sort().pop();
    const SUM = f ? JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')) : null;
    ok('COUNTERS', SUM && SUM.applied && SUM.send_queue && SUM.throttle && SUM.throttle.notices >= 1, 'the summary carries chosen-vs-applied, the send queue and the throttle: ' + JSON.stringify(SUM && { applied: SUM.applied && { chosen: SUM.applied.chosen, mismatch: SUM.applied.mismatch }, notices: SUM.throttle && SUM.throttle.notices, resent: SUM.throttle && SUM.throttle.resent_choices, queue: SUM.send_queue && { written: SUM.send_queue.written, max_depth: SUM.send_queue.max_depth } }));
  } catch (e) { fails++; console.log('  FAIL [HARNESS] ' + e.stack); }
  finally {
    if (exited === null) { try { process.kill(child.pid); } catch (e) { /* gone */ } }
    srv.close();
    fs.writeFileSync(path.join(TMP, 'wire.jsonl'), wire.map(x => JSON.stringify(x)).join('\n') + '\n');
    fs.writeFileSync(path.join(TMP, 'throttle.jsonl'), TU.log.map(x => JSON.stringify(x)).join('\n') + '\n');
    if (fails) { console.log('--- client stdout (tail) ---\n' + fs.readFileSync(stdoutF, 'utf8').split('\n').slice(-30).join('\n')); console.log('wire log: ' + path.join(TMP, 'wire.jsonl')); }
  }
}

(async () => {
  console.log('PART A — the k=16 burst through the throttle model');
  try { partA(); } catch (e) { fails++; console.log('  FAIL [A] ' + e.stack); }
  if (!process.argv.includes('--a-only')) { console.log('PART B — the real client against a throttled server on the real simulator'); await partB(); }
  console.log((fails ? 'RED' : 'GREEN') + ' — test-rotom-throttle: ' + (checks - fails) + '/' + checks + ' checks');
  process.exit(fails ? 1 : 0);
})();
