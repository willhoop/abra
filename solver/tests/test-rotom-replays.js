/* solver/tests/test-rotom-replays.js — ROTOM's replay saving and per-game ledger, without a Showdown server.
 *
 *   node solver/tests/test-rotom-replays.js        exit 0 GREEN, 1 RED
 *
 *   POPUP     the server's success popup (built exactly as server/rooms.ts:2128-2134 + users.ts popup() write it)
 *             yields the URL and the replay id; both failure popups are failures; anything else is not ours.
 *   ID        the replay id of a room is the room id without `battle-`, and a `…pw` room drops its password.
 *   SAVER     success on the first try; a failure popup then a retry that succeeds; silence retried and then
 *             given up after `attempts`, `done` called EXACTLY once; a down socket counts as a failed attempt;
 *             after a reconnect the room is re-joined before the next attempt; a popup for another room is not
 *             matched; a throwing `done` does not escape.
 *   RATING    the ladder's rating line parses; other raw lines do not.
 *   STAND-IN  the local login server answers a batched `addreplay` POST the way loginserver.ts parses it
 *             (`]` + JSON array, one result per request) and writes the log; the preload re-points a config's
 *             loginserver at it and refuses a non-loopback URL.
 *   HYGIENE   `medicham32` is on the own-account list of the human dataset AND the meta, and both use the list
 *             to exclude a game; the ingest's bot pattern does NOT match it, so the store keeps our public games.
 *   REPORT    the games report over synthetic records: series record, Wilson interval, local games excluded,
 *             per-team counts, losses carry their replay link.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const http = require('http');

const ROOT = path.join(__dirname, '..', '..');
const RP = require('../rotom/replay.js');
let checks = 0, fails = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL ' + m); } };

/* ---------------- POPUP ---------------- */
{
  const url = 'https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2345678901';
  const msg = `|html|<p>Your replay has been uploaded! It's available at:</p><p> ` +
    `<a class="no-panel-intercept" href="${url}" target="_blank">${url}</a> ` + `<copytext value="${url}">Copy</copytext>`;
  const payload = msg.replace(/\n/g, '||');     // users.ts popup(): `|popup|` + message
  const p = RP.parsePopup(payload);
  ok(p && p.kind === 'saved' && p.url === url && p.id === 'gen9championsvgc2026regmcbo3-2345678901', 'success popup parses to url + id: ' + JSON.stringify(p));
  ok(RP.parsePopup('Your replay could not be saved: Error: boom').kind === 'failed', 'db-path failure popup');
  ok(RP.parsePopup("This server's request IP 1.2.3.4 is not a registered server.").kind === 'failed', 'login-server-path failure popup');
  ok(RP.parsePopup('You are not accepting challenges') === null, 'an unrelated popup is not a replay answer');
}
/* ---------------- ID ---------------- */
ok(RP.replayIdOf('battle-gen9championsvgc2026regmcbo3-12') === 'gen9championsvgc2026regmcbo3-12', 'plain room id');
ok(RP.replayIdOf('battle-gen9championsvgc2026regmcbo3-12-abcdefpw') === 'gen9championsvgc2026regmcbo3-12', 'hidden room drops the password');

/* ---------------- SAVER (fake clock) ---------------- */
function fakeClock() {
  let now = 0, id = 0; const q = new Map();
  return {
    now: () => now,
    setTimeout: (fn, ms) => { const k = ++id; q.set(k, { at: now + ms, fn }); return k; },
    clearTimeout: k => q.delete(k),
    run(ms) { const end = now + ms; for (;;) { let best = null; for (const [k, v] of q) if (v.at <= end && (!best || v.at < best[1].at)) best = [k, v]; if (!best) break; q.delete(best[0]); now = best[1].at; best[1].fn(); } now = end; },
  };
}
const ROOM = 'battle-gen9championsvgc2026regmcbo3-77';
const POP = id => `|html|<p>Your replay has been uploaded! It's available at:</p><p> <a class="no-panel-intercept" href="https://replay.pokemonshowdown.com/${id}" target="_blank">x</a>`;
function mk(o) {
  const C = fakeClock(), sent = [];
  const S = new RP.ReplaySaver(Object.assign({ send: (room, text) => { sent.push(text); return o && o.down ? o.down() : true; }, attempts: 3, timeoutMs: 1000, backoffMs: [100, 200],
    setTimeout: C.setTimeout, clearTimeout: C.clearTimeout, now: C.now }, o || {}));
  return { C, S, sent };
}
{ // success first try
  const { C, S, sent } = mk(); const res = [];
  S.save(ROOM, r => res.push(r));
  ok(sent[0] === ROOM + '|/savereplay', 'sends /savereplay in the battle room: ' + sent[0]);
  C.run(50); S.onPopup(POP('gen9championsvgc2026regmcbo3-77'));
  C.run(5000);
  ok(res.length === 1 && res[0].status === 'saved' && res[0].attempts === 1 && /77$/.test(res[0].url), 'saved on the first try: ' + JSON.stringify(res));
  ok(sent.length === 1, 'no resend after success');
}
{ // failure popup then success
  const { C, S, sent } = mk(); const res = [];
  S.save(ROOM, r => res.push(r));
  S.onPopup('Your replay could not be saved: Error: db down');
  C.run(150);
  ok(sent.length === 2, 'retried after a failure popup (sent ' + sent.length + ')');
  S.onPopup(POP('gen9championsvgc2026regmcbo3-77'));
  ok(res.length === 1 && res[0].status === 'saved' && res[0].attempts === 2, 'saved on the retry: ' + JSON.stringify(res));
}
{ // silence -> give up, done once
  const { C, S, sent } = mk(); const res = [];
  S.save(ROOM, r => res.push(r));
  C.run(60000);
  ok(sent.length === 3 && res.length === 1 && res[0].status === 'failed' && /no answer/.test(res[0].error), 'silence: 3 attempts then failed, once: ' + JSON.stringify(res));
  S.onPopup(POP('gen9championsvgc2026regmcbo3-77'));
  ok(res.length === 1, 'a late popup after giving up does not call done again');
  ok(S.inFlight() === 0, 'nothing left in flight');
}
{ // socket down counts, reconnect re-joins
  let down = true; const { C, S, sent } = mk({ down: () => !down ? true : false }); const res = [];
  S.save(ROOM, r => res.push(r));
  down = false; S.onReconnect(); C.run(150);
  ok(sent.some(t => t === '|/join ' + ROOM) && sent[sent.length - 1] === ROOM + '|/savereplay', 'after a reconnect: /join then /savereplay: ' + JSON.stringify(sent));
  S.onPopup(POP('gen9championsvgc2026regmcbo3-77'));
  ok(res.length === 1 && res[0].status === 'saved', 'saved after the socket came back');
}
{ // another room's popup is not matched; a throwing done is contained
  const { C, S } = mk(); let n = 0;
  S.save(ROOM, () => { n++; throw new Error('caller bug'); });
  S.onPopup(POP('gen9championsvgc2026regmcbo3-99'));
  ok(S.inFlight() === 1 && S.COUNTERS.unmatchedPopups === 1, 'a popup for another game is not matched');
  let threw = false; try { S.onPopup(POP('gen9championsvgc2026regmcbo3-77')); } catch (e) { threw = true; }
  ok(!threw && n === 1, 'a throwing done() does not escape the saver');
  C.run(1);
}
{ // skip
  const { S } = mk(); const res = [];
  S.skip(ROOM, 'local server', r => res.push(r));
  ok(res.length === 1 && res[0].status === 'skipped' && res[0].error === 'local server', 'skip records the reason');
}
/* ---------------- RATING ---------------- */
{
  const r = RP.parseRatingLine("|raw|medicham32's rating: 1500 &rarr; <strong>1523</strong><br />(+23 for winning)");
  ok(r && r.name === 'medicham32' && r.before === 1500 && r.after === 1523, 'rating line parses: ' + JSON.stringify(r));
  ok(RP.parseRatingLine('|raw|<div>hello</div>') === null, 'other raw lines are not ratings');
}

(async () => {
  /* ---------------- STAND-IN ---------------- */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rotom-replays-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const M = await require('../rotom/local_login.js').start(port, path.join(tmp, 'replays'));
  const body = new URLSearchParams({ serverid: 'showdown', servertoken: '', nocache: '1',
    json: JSON.stringify([{ act: 'invalidatecss' }, { act: 'addreplay', id: 'gen9championsvgc2026regmcbo3-5', log: '|win|x', players: 'a,b', format: 'F', hidden: '' }]) }).toString();
  const txt = await new Promise((res, rej) => {
    const rq = http.request({ host: '127.0.0.1', port, path: '/action.php', method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); });
    rq.on('error', rej); rq.end(body);
  });
  ok(txt.startsWith(']'), 'the stand-in answers with the leading `]` loginserver.ts strips');
  let arr = null; try { arr = JSON.parse(txt.slice(1)); } catch (e) { /* red below */ }
  ok(Array.isArray(arr) && arr.length === 2 && arr[1].replayid === 'gen9championsvgc2026regmcbo3-5', 'one result per request, addreplay -> replayid: ' + txt);
  ok(fs.readFileSync(path.join(tmp, 'replays', 'gen9championsvgc2026regmcbo3-5.log'), 'utf8') === '|win|x', 'the replay log is written');
  M.close();

  // the preload patches a config module in place, and refuses a non-loopback URL
  const cfgDir = path.join(tmp, 'config'); fs.mkdirSync(cfgDir);
  fs.writeFileSync(path.join(cfgDir, 'config.js'), "exports.loginserver = 'http://play.pokemonshowdown.com/'; exports.routes = { replays: 'replay.pokemonshowdown.com', root: 'pokemonshowdown.com' };");
  const pre = path.join(ROOT, 'solver', 'rotom', 'local_server_preload.js');
  const probe = `const c=require(${JSON.stringify(path.join(cfgDir, 'config.js'))});process.stdout.write(JSON.stringify({l:c.loginserver,r:c.routes}))`;
  const good = cp.spawnSync(process.execPath, ['--require', pre, '-e', probe], { env: Object.assign({}, process.env, { ROTOM_LOGIN_MOCK: 'http://127.0.0.1:' + port + '/' }), encoding: 'utf8' });
  let pj = null; try { pj = JSON.parse(good.stdout); } catch (e) { /* red below */ }
  ok(pj && pj.l === 'http://127.0.0.1:' + port + '/' && pj.r.replays === '127.0.0.1:' + port + '/replay' && pj.r.root === 'pokemonshowdown.com', 'preload re-points loginserver + replays only: ' + good.stdout + good.stderr);
  const bad = cp.spawnSync(process.execPath, ['--require', pre, '-e', probe], { env: Object.assign({}, process.env, { ROTOM_LOGIN_MOCK: 'http://play.pokemonshowdown.com/' }), encoding: 'utf8' });
  ok(bad.status !== 0, 'preload refuses a non-loopback login server');
  const inert = cp.spawnSync(process.execPath, ['--require', pre, '-e', probe], { env: Object.assign({}, process.env, { ROTOM_LOGIN_MOCK: '' }), encoding: 'utf8' });
  ok(/play\.pokemonshowdown\.com/.test(inert.stdout), 'preload is inert without ROTOM_LOGIN_MOCK');

  /* ---------------- HYGIENE ---------------- */
  for (const f of ['solver/human/build_dataset.js', 'solver/meta/extract.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = /const OWN = new Set\(\[([^\]]*)\]\)/.exec(src);
    const own = m ? m[1].split(',').map(x => x.replace(/['"\s]/g, '').toLowerCase()) : [];
    ok(own.includes('medicham32'), f + ': medicham32 is on the own-account list');
    ok(/names\.some\(n => OWN\.has\(.*\)\)\s*\{?\s*(addEx\(id, 'own_account'|hits\.push\('own_account'\))/.test(src), f + ': the list excludes a game as own_account');
  }
  {
    const src = fs.readFileSync(path.join(ROOT, 'engine', 'durable-ingest.js'), 'utf8');
    const m = /const isBot=n=>(\/.*?\/[a-z]*)\.test/.exec(src);
    ok(!!m, 'durable-ingest.js isBot pattern found');
    if (m) { const re = eval(m[1]); ok(!re.test('medicham32') && !re.test('Medicham32'), 'the ingest does not flag medicham32 as a bot: its public games are stored'); }
    ok(!/medicham32/i.test(src), 'the ingest has no own-account filter: it stores our games like any other');
  }

  /* ---------------- REPORT ---------------- */
  {
    const f = path.join(tmp, 'games.jsonl');
    const g = (series, game, mine, team, local, url) => JSON.stringify({ client: 'medicham32', local, series, game, room: 'battle-x-' + series + game, our_team: team, opponent: 'opp' + series,
      result: { mine, tie: false, turns: 9 }, clock: { used_s: 100 + game, bank_left_s: 200 - 10 * game }, replay: { status: url ? 'saved' : 'failed', url, attempts: 1 }, decisions: { log: 'nope.jsonl' } });
    fs.writeFileSync(f, [g('s1', 1, true, 'T1', false, 'u11'), g('s1', 2, true, 'T1', false, 'u12'),
      g('s2', 1, false, 'T2', false, 'u21'), g('s2', 2, true, 'T2', false, null), g('s2', 3, false, 'T2', false, 'u23'),
      g('s3', 1, true, 'T1', true, 'local'), '{not json'].join('\n') + '\n');
    const R = require('../rotom/report.js').gamesReport(f);
    ok(R.records.used === 5 && R.records.local_excluded === 1 && R.records.unparseable === 1, 'local excluded, bad line counted: ' + JSON.stringify(R.records));
    ok(R.series.decided === 2 && R.series.won === 1, 'series 1-1: ' + JSON.stringify(R.series));
    ok(R.games.won === 3 && R.games.n === 5 && R.games.ci95 && R.games.ci95[0] < 0.6 && R.games.ci95[1] > 0.6, 'games 3/5 with a Wilson interval around 0.6: ' + JSON.stringify(R.games));
    const w = require('../rotom/report.js').wilson(3, 5);
    ok(Math.abs(w[0] - 0.2307) < 1e-3 && Math.abs(w[1] - 0.8824) < 1e-3, 'Wilson(3,5) = [0.2307, 0.8824]: ' + w);
    ok(R.teams.T1.games === 2 && R.teams.T1.series_won === 1 && R.teams.T2.series === 1 && R.teams.T2.series_won === 0, 'per-team counts');
    ok(R.losses.length === 2 && R.losses.map(l => l.replay).join() === 'u21,u23', 'losses carry their replay links');
    ok(R.replays.saved === 4 && R.replays.failed === 1, 'replay coverage counted');
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log((fails ? 'RED' : 'GREEN') + ' test-rotom-replays: ' + (checks - fails) + '/' + checks);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
