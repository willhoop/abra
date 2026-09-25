/* solver/rotom/rotom.js — ROTOM v0, the live client (SOLVER-PLAN §4). Replaces engine/mag_bot.js.
 *
 *   tools\lownode.cmd solver/rotom/rotom.js --name rotomA --policy miltank --accept --sets 20
 *   tools\lownode.cmd solver/rotom/rotom.js --name rotomB --policy prior --challenge rotomA --sets 20
 *
 * FORMAT: gen9championsvgc2026regmcbo3 only (Force Open Team Sheets, Best of 3 — pokemon-showdown-mc/config/formats.ts).
 *
 * LOCAL SERVER ONLY IN v0. The default server is ws://localhost:8765/showdown/websocket (a `--no-security` local
 * pokemon-showdown-mc started by solver/rotom/run_local.js). A non-local server is REFUSED unless `--public` is
 * passed, and v0 never searches the ladder at all (no /search is ever sent). The public login path (challstr ->
 * assertion) exists so the credential rule can be tested, and reads the password only from SHOWDOWN_PASS or
 * data/.showdown-pass (solver/rotom/lock.js) — never from argv, never printed.
 *
 * WHAT IT DOES, PER CHOICE:
 *   1. reads the |request| JSON (the legality authority), the |showteam| sheets, the public log, and the
 *      |inactive| Time-left line that follows the request;
 *   2. budgets the decision from the 420 s bank and the 55 s turn cap (solver/rotom/clock.js, the rule read from
 *      the checkout's ruleTable, E[remaining requests] from the store);
 *   3. builds the MEDICHAM position it observes (solver/rotom/world.js: engine/medicham_api.js + the arena's body
 *      builder), and XATU's back-pair posterior with this series' earlier games as memory;
 *   4. asks the policy ('prior' = DODUO greedy, 'miltank' = MILTANK lean search, 'random'); a budget under the
 *      search floor drops to 'prior'; any throw drops down the chain prior -> request heuristic -> `default`;
 *   5. checks the choice against the request (solver/rotom/request.js) and sends `/choose <choice>|<rqid>`;
 *   6. logs the decision to <out>/decisions-<name>.jsonl AND to the game's own file
 *      <out>/games/<name>/<room>.decisions.jsonl, and one artifact per series to <out>/series/.
 *
 * EVERY GAME IS SAVED AS A REPLAY AND JOINED TO OUR REASONING (solver/rotom/replay.js). At each game's |win|/|tie|
 * the client sends `/savereplay` in the battle room, retries on failure or silence, and — whatever happens —
 * appends ONE record to the games file (default solver/out/rotom/games.jsonl, `--games-file`): format, series,
 * game number, both sheets, both brings/leads, result, ratings when the server sends them, the replay URL, our
 * copy of the battle log, and the path of this game's decision log. A save in flight never holds the next game:
 * it lives in the finished room, which is left only when the save resolves. On a LOCAL server the save is sent
 * only with `--local-replays` (run_local.js passes it after pointing the server's login server at a local
 * stand-in); without it a local save would reach play.pokemonshowdown.com, so it is skipped and recorded so.
 *
 * SAFETY: a lock file (lock.js) refuses a second client; reconnect with backoff, rejoin every open game from
 * |updatesearch|, re-read the request the server re-sends and answer it (the same choice if that rqid was already
 * answered); the drill flags `--drill drop@S.G.T` / `--drill crash@S.G.T` kill the socket / the process at set S,
 * game G, turn T (the harness restarts a crashed process, as a watchdog would).
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const has = k => argv.includes('--' + k);
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const ROOT = path.join(__dirname, '..', '..');
const NAME = flag('name', 'rotom');
const SERVER = flag('server', 'ws://localhost:8765/showdown/websocket');
const POLICY = flag('policy', 'prior');
const CHALLENGE = flag('challenge', '');
const ACCEPT = has('accept') || !CHALLENGE;
const SETS = +flag('sets', 1);
const OUT = path.resolve(flag('out', path.join(ROOT, 'solver', 'out', 'rotom', 'run-' + new Date().toISOString().replace(/[:.]/g, '-'))));
const SEED = +flag('seed', 1);
const MAX_MS = +flag('max-ms', Infinity);           // an operator cap on a search (tests); the clock is the binding rule
const PREVIEW_MAX_MS = +flag('preview-max-ms', 20000);
const MARGIN_S = +flag('margin', 8);
const RESERVE_S = +flag('reserve', 30);
const MIN_SEARCH_MS = +flag('min-search-ms', 400);
const TIMER = flag('timer', 'on');
const DRILL = flag('drill', '');                     // drop@S.G.T | crash@S.G.T  (set, game, turn; 1-based)
const DUMP_REQ = +flag('dump-requests', 0);          // write the first N requests (+ the public log so far) as test fixtures
const TEAM_POOL = flag('team-pool', path.join(__dirname, 'teams', 'regmc-pool.json'));
const FORMAT_ID = 'gen9championsvgc2026regmcbo3';
const GAMES_FILE = path.resolve(flag('games-file', path.join(ROOT, 'solver', 'out', 'rotom', 'games.jsonl')));
const SAVE_REPLAYS = flag('save-replays', 'on');     // on | off
const LOCAL_REPLAYS = has('local-replays');          // the local server's login server is a local stand-in (run_local.js)
const REPLAY_TIMEOUT_MS = +flag('replay-timeout-ms', 20000);
const REPLAY_ATTEMPTS = +flag('replay-attempts', 4);

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(GAMES_FILE), { recursive: true });
const GAMEDIR = path.join(OUT, 'games', toID(NAME));
fs.mkdirSync(GAMEDIR, { recursive: true });
const relRoot = f => path.relative(ROOT, f).split(path.sep).join('/');
const gameDecF = room => path.join(GAMEDIR, room + '.decisions.jsonl');
const gameLogF = room => path.join(GAMEDIR, room + '.log');
const LOGF = path.join(OUT, 'decisions-' + toID(NAME) + '.jsonl');
const EVENTF = path.join(OUT, 'events-' + toID(NAME) + '.jsonl');
const STATEF = path.join(OUT, 'state-' + toID(NAME) + '.json');
const say = (...a) => console.log('[' + NAME + ' ' + new Date().toISOString().slice(11, 19) + ']', ...a);
const event = (type, o) => { try { fs.appendFileSync(EVENTF, JSON.stringify(Object.assign({ t: Date.now(), type }, o || {})) + '\n'); } catch (e) { /* never fatal */ } };

/* ---------------- guards before anything connects ---------------- */
const LOCK = require('./lock.js');
if (!LOCK.isLocal(SERVER) && !has('public')) {
  console.error('ROTOM v0 is local-only: ' + SERVER + ' is not localhost. Refusing (pass --public only once a ladder launch is approved).');
  process.exit(2);
}
if (!['prior', 'miltank', 'random'].includes(POLICY)) { console.error('unknown --policy ' + POLICY); process.exit(2); }
/* OUR GAMES STAY OUT OF THE HUMAN DATA. The hourly ingest stores every public replay of the format, ours
 * included (engine/durable-ingest.js has no name filter); the human dataset and the meta drop them by account
 * name. So on a public server the account MUST be on both own-account lists, read from the files themselves. */
if (!LOCK.isLocal(SERVER)) {
  const own = f => { const m = /const OWN = new Set\(\[([^\]]*)\]\)/.exec(fs.readFileSync(path.join(ROOT, f), 'utf8')); return m ? m[1].split(',').map(x => toID(x)) : []; };
  for (const f of ['solver/human/build_dataset.js', 'solver/meta/extract.js']) {
    if (!own(f).includes(toID(NAME))) { console.error('refusing: ' + NAME + ' is not on the own-account list in ' + f + ' — its games would enter the human data'); process.exit(2); }
  }
}
let LOCKH;
try { LOCKH = LOCK.acquire(SERVER, NAME, say); }
catch (e) { console.error(e.message); process.exit(3); }
const CRED = LOCK.isLocal(SERVER) ? { pass: '', source: 'not needed (local server)' } : LOCK.readPassword(ROOT);
say('lock ' + LOCKH.path + (LOCKH.tookOverStale ? ' (stale lock taken over)' : '') + ' ; credentials: ' + CRED.source);

/* ---------------- run state (persisted, so a restarted process keeps counting) ---------------- */
let STATE = { name: NAME, policy: POLICY, setsDone: [], restarts: 0 };
try { const s = JSON.parse(fs.readFileSync(STATEF, 'utf8')); STATE = Object.assign(STATE, s); STATE.restarts = (STATE.restarts || 0) + 1; say('resumed run state: ' + STATE.setsDone.length + ' sets done, restart #' + STATE.restarts); } catch (e) { /* fresh */ }
const saveState = () => { try { fs.writeFileSync(STATEF, JSON.stringify(STATE, null, 1)); } catch (e) { /* never fatal */ } };
saveState();

/* ---------------- the engine and the models, warmed BEFORE connecting ---------------- */
const t0load = Date.now();
require('../arena/env.js');
const API = require(path.join(ROOT, 'engine', 'medicham_api.js'));
const T = require('../arena/teams.js');
const MAGD = require('../mag/infer.js').load();
const PA = require('../miltank/prior_adapter.js').create(API, MAGD);
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const TABLES = JSON.parse(fs.readFileSync(path.join(__dirname, 'tables.json'), 'utf8'));
const WB = require('./world.js').create(API);
const P = require('./policy.js').create({ API, PA, R, tables: TABLES });
const RQ = require('./request.js');
const { Clock } = require('./clock.js');
const { parseGame, parseShowteam } = require('../human/parse_game.js');
const XATU = require('../xatu/index.js');
const { BringMemory } = require('../xatu/bring.js');
const { SeriesBook } = require('./series.js');
const BOOK = new SeriesBook(path.join(OUT, 'series', toID(NAME)));   // per client: two clients in one run never share a file
const POOL = JSON.parse(fs.readFileSync(TEAM_POOL, 'utf8'));
const sha = f => { try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16); } catch (e) { return null; } };
const PROV = { engine: sha(path.join(ROOT, 'engine', 'medicham2-browser.js')), api: sha(path.join(ROOT, 'engine', 'medicham_api.js')),
  engine_data: sha(path.join(ROOT, 'data', 'engine-data-regmc.js')), mag: sha(path.join(ROOT, 'solver', 'mag', 'model', 'mag-v1.json')),
  doduo: sha(path.join(ROOT, 'solver', 'mag', 'model', 'doduo-v1.json')), xatu_bring: sha(path.join(ROOT, 'solver', 'xatu', 'model', 'bring-v1.json')),
  tables: sha(path.join(__dirname, 'tables.json')), team_pool: sha(TEAM_POOL), release: 'live tree (PRE-GATE: the Reg M-C MEDICHAM gate is not open)' };
/* warm-up: a few prior calls and one short search on a built position, so V8 tier-up is paid before the clock runs */
(function warm() {
  try {
    const G = { id: 'warm', sheets: { p1: parseShowteam(POOL.teams[0].packed), p2: parseShowteam(POOL.teams[1 % POOL.teams.length].packed) },
                brought: { p1: POOL.teams[0].bring, p2: POOL.teams[1 % POOL.teams.length].bring } };
    const a = T.buildTeam(API.M, G, 'p1'), b = T.buildTeam(API.M, G, 'p2');
    const S = API.newBattle(a.team, b.team, { rng: API.makeRng(1) });
    const MT = require('../miltank/search.js').create(API, { prior: PA, rollout: R });
    MT.decide(S, 'A', PA.newGame(G), { budgetMs: 1500, coin: API.M.rngStreams({ seed: 3 }).any });
  } catch (e) { say('warm-up failed (continuing): ' + e.message); }
})();
say('loaded engine + MAG/DODUO + XATU in ' + (Date.now() - t0load) + ' ms; policy ' + POLICY + '; out ' + OUT);

const { ReplaySaver, parseRatingLine } = require('./replay.js');
const SAVER = new ReplaySaver({ send: (room, text) => send(text), attempts: REPLAY_ATTEMPTS, timeoutMs: REPLAY_TIMEOUT_MS,
  log: (type, o) => event(type, o) });
const coinBase = API.M.rngStreams({ seed: SEED * 7777 + parseInt(crypto.createHash('sha256').update(toID(NAME)).digest('hex').slice(0, 7), 16) }).any;
const clockOpts = { maxMs: MAX_MS, marginS: MARGIN_S, reserveS: RESERVE_S, minSearchMs: MIN_SEARCH_MS };

/* ---------------- stats ---------------- */
const ST = { decisions: 0, byKind: {}, ms: { preview: [], move: [], switch: [] }, budget: [], fallbacks: {}, invalid: [], unavailable: [],
             timeouts: [], sentLate: 0, superseded: 0, reconnects: 0, disconnects: 0, rejoins: 0, resent: 0, crashesCaught: [], drills: [],
             timerOnSeen: 0, games: 0, previewSheetWaitMs: [], worldErrors: 0, noTimerLine: 0 };
const fb = (k) => { ST.fallbacks[k] = (ST.fallbacks[k] || 0) + 1; };
process.on('uncaughtException', e => { ST.crashesCaught.push(String(e && e.stack || e).slice(0, 400)); event('uncaught', { err: String(e && e.message || e) }); say('UNCAUGHT ' + (e && e.stack || e)); });

/* ---------------- socket ---------------- */
let ws = null, backoff = 1000, loggedIn = false, stopping = false, HOLD_UNTIL = 0;
const send = (s) => { if (ws && ws.readyState === 1) { ws.send(s); return true; } return false; };
const battles = new Map();   // battle room id -> B
const CLOSED = new Set();    // battle rooms finished and left: later lines for them (deinit) are ignored
const bestofs = new Map();   // bestof room id -> { id, done, gnums:Set }
let activeSeries = null;     // bestof id currently being played (one series at a time)
let lastChallenge = 0;
let seriesTeam = new Map();  // bestof id -> pool team (or the pending one)
let pendingTeam = null;

function pickTeam() {
  const i = Math.floor(coinBase() * POOL.teams.length);
  return POOL.teams[i];
}
function connect() {
  ws = new WebSocket(SERVER);
  ws.onopen = () => { say('connected ' + SERVER); };
  ws.onerror = (e) => { event('socket_error', { msg: String(e && e.message || e) }); };
  ws.onmessage = (ev) => {
    const raw = String(ev.data || '');
    let room = '', body = raw;
    if (raw.startsWith('>')) { const nl = raw.indexOf('\n'); room = raw.slice(1, nl < 0 ? undefined : nl); body = nl < 0 ? '' : raw.slice(nl + 1); }
    const lines = body.split('\n');
    for (const line of lines) { try { handle(room, line); } catch (e) { ST.crashesCaught.push(String(e && e.stack || e).slice(0, 400)); say('handler error: ' + (e && e.stack || e)); } }
    if (room && battles.has(room)) scheduleDecide(battles.get(room));
  };
  ws.onclose = () => {
    loggedIn = false;
    for (const B of battles.values()) if (!B.ended) B.stale = true;
    ST.disconnects++;
    event('disconnect', {});
    if (stopping) return;
    let wait = backoff; backoff = Math.min(backoff * 2, 60000);
    if (HOLD_UNTIL > Date.now()) wait = Math.max(wait, HOLD_UNTIL - Date.now());   // a drill outage
    say('disconnected — reconnecting in ' + wait + ' ms');
    setTimeout(() => { ST.reconnects++; connect(); }, wait);
  };
}

function handle(room, line) {
  if (!line) return;
  const p = line.split('|');
  const cmd = p[1];
  if (!room || room === 'lobby') {
    if (cmd === 'challstr') return login(p.slice(2).join('|'));
    if (cmd === 'updateuser') {
      if (toID(p[2]) === toID(NAME) && p[3] === '1' || toID(p[2]) === toID(NAME)) {
        if (!loggedIn) {
          loggedIn = true; backoff = 1000; say('logged in as ' + NAME); event('login', {});
          if (ST.disconnects > 0) SAVER.onReconnect();
          resumePendingGames();
          /* REJOIN every game we were in: the server re-sends the room (|init| + the log) and the open request */
          for (const B of battles.values()) if (!B.ended && B.stale) { send('|/join ' + B.id); ST.rejoins++; event('rejoin', { room: B.id }); }
          for (const bo of bestofs.values()) if (!bo.done) send('|/join ' + bo.id);
          setTimeout(() => { maybeChallenge('login'); }, 800);
        }
      }
      return;
    }
    if (cmd === 'updatesearch') {
      let d = null; try { d = JSON.parse(p[2]); } catch (e) { return; }
      for (const rid of Object.keys((d && d.games) || {})) {
        if (!battles.has(rid) && !bestofs.has(rid)) { send('|/join ' + rid); ST.rejoins++; event('join_from_updatesearch', { room: rid }); }
        else if (battles.has(rid) && battles.get(rid).stale) { send('|/join ' + rid); ST.rejoins++; }
      }
      return;
    }
    if (cmd === 'pm') {
      const from = String(p[2] || '').replace(/^[ !@#$%^&*+~-]/, '').trim();
      const payload = p.slice(4).join('|');
      const m = /^\/challenge\s+([^|\s]+)/.exec(payload);
      if (m && toID(from) !== toID(NAME) && ACCEPT) onChallenge(from, m[1]);
      return;
    }
    if (cmd === 'updatechallenges') {
      let d = null; try { d = JSON.parse(p[2]); } catch (e) { return; }
      for (const [who, fmt] of Object.entries((d && d.challengesFrom) || {})) if (ACCEPT) onChallenge(who, fmt);
      return;
    }
    if (cmd === 'popup' && SAVER.onPopup(p.slice(2).join('|'))) return;
    if (cmd === 'popup') { event('popup', { text: line.slice(0, 300) }); if (/not online|is not accepting|already/i.test(line)) lastChallenge = 0; say('POPUP ' + line.slice(0, 200)); return; }
    return;
  }
  if (room.startsWith('game-bestof')) return handleBestof(room, line, p, cmd);
  if (room.startsWith('battle-')) return handleBattle(room, line, p, cmd);
}

function login(challstr) {
  if (LOCK.isLocal(SERVER)) { send('|/trn ' + NAME + ',0,'); return; }
  (async () => {
    try {
      const res = await fetch('https://play.pokemonshowdown.com/api/login', { method: 'POST',
        body: new URLSearchParams({ name: NAME, pass: CRED.pass, challstr }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const json = JSON.parse((await res.text()).replace(/^\]/, ''));
      if (!json.assertion) throw new Error(json.actionerror || 'no assertion');
      send('|/trn ' + NAME + ',0,' + json.assertion);
    } catch (e) { say('LOGIN FAILED: ' + e.message); }   // the password is never in this message
  })();
}

/* ---------------- series control ---------------- */
function openSeries() { return [...bestofs.values()].filter(b => !b.done).length; }
function maybeChallenge(why) {
  if (!CHALLENGE || !loggedIn) return;
  if (STATE.setsDone.length + openSeries() >= SETS) return;
  if (openSeries() > 0) return;
  const now = Date.now();
  if (now - lastChallenge < 4000) return;
  lastChallenge = now;
  pendingTeam = pickTeam();
  send('|/utm ' + pendingTeam.packed);
  send('|/challenge ' + CHALLENGE + ', ' + FORMAT_ID);
  say('challenged ' + CHALLENGE + ' (' + why + ') with team ' + pendingTeam.id);
  event('challenge', { to: CHALLENGE, team: pendingTeam.id });
}
function onChallenge(from, fmt) {
  if (fmt !== FORMAT_ID) { send('|/reject ' + from); return; }
  if (STATE.setsDone.length + openSeries() >= SETS) { send('|/reject ' + from); return; }
  pendingTeam = pickTeam();
  send('|/utm ' + pendingTeam.packed);
  send('|/accept ' + from);
  say('accepted ' + from + ' with team ' + pendingTeam.id);
  event('accept', { from, team: pendingTeam.id });
}
setInterval(() => { if (loggedIn) maybeChallenge('retry'); }, 5000).unref();

function handleBestof(room, line, p, cmd) {
  let bo = bestofs.get(room);
  if (!bo) {
    const known = BOOK.get(room);   // a restarted process: the series book says which pool team this set is using
    const team = (known && known.team && POOL.teams.find(t => t.id === known.team)) || pendingTeam;
    bo = { id: room, done: false, gnums: new Set(), confirmed: new Set(), started: Date.now(), team: team ? team.id : null, reloaded: !!(known && known.reloaded) };
    bestofs.set(room, bo);
    if (team) seriesTeam.set(room, team);
    if (TIMER === 'on') send(room + '|/timer on');
    event('series_join', { room, team: bo.team });
    const S0 = BOOK.get(room); if (!S0.team && bo.team) { S0.team = bo.team; S0.policy = POLICY; BOOK.save(S0); }
  }
  if (/\/confirmready/.test(line)) confirmReady(room, line);
  if (cmd === 'win' || cmd === 'tie') {
    if (bo.done) return;
    bo.done = true;
    const winner = cmd === 'win' ? p[2] : null;
    const S = BOOK.get(room);
    S.result = { winner, mine: winner != null && toID(winner) === toID(NAME), ended: new Date().toISOString() };
    S.provenance = PROV;
    S.clock = S.games.map(g => ({ gnum: g.gnum, used_s: g.clockUsed, bankLeft: g.bankLeft }));
    BOOK.save(S);
    STATE.setsDone.push({ id: room, winner, mine: S.result.mine, games: S.games.length, team: bo.team });
    saveState();
    say('SERIES OVER ' + room + ' — winner ' + winner + ' (' + STATE.setsDone.length + '/' + SETS + ')');
    event('series_end', { room, winner });
    setTimeout(() => { send('|/leave ' + room); maybeChallenge('next set'); checkDone(); }, 1500);
  }
}
function confirmReady(bo, line) {
  const m = /\/msgroom (game-bestof[^,]+),\/confirmready/.exec(line);
  const id = m ? m[1] : bo;
  const B = bestofs.get(id);
  const key = (B ? B.gnums.size : 0);
  if (B && B.confirmed.has(key)) return;
  if (B) B.confirmed.add(key);
  setTimeout(() => { send(id + '|/confirmready'); event('confirmready', { room: id }); }, 300);
}

let doneWaitStart = 0;
function checkDone() {
  if (STATE.setsDone.length >= SETS && openSeries() === 0) {
    /* never exit with a game whose record is unwritten: its replay save is still in flight (bounded) */
    const pending = Object.keys(STATE.pendingGames || {}).length;
    if (pending) {
      doneWaitStart = doneWaitStart || Date.now();
      if (Date.now() - doneWaitStart < (REPLAY_ATTEMPTS + 1) * REPLAY_TIMEOUT_MS + 30000) { setTimeout(checkDone, 500); return; }
      event('exit_with_pending_games', { rooms: Object.keys(STATE.pendingGames) });
    }
    writeSummary();
    say('done: ' + STATE.setsDone.length + ' sets');
    stopping = true;
    setTimeout(() => { try { ws.close(); } catch (e) { /* closing */ } LOCKH.release(); process.exit(0); }, 1500);
  }
}

/* ---------------- a battle ---------------- */
const NOT_PUBLIC = new Set(['request', 'inactive', 'inactiveoff', 'error', 'c', 'c:', 'chat', 'j', 'J', 'l', 'L', 'n', 'N', 'raw', 'html', 'uhtml', 'uhtmlchange', 'title', 'init', 'users', ':', 'badge', 'bigerror', 'notify', 'hidelines', 'controlshtml', 'fieldhtml', 'debug']);
function newBattle(room) {
  return { id: room, lines: [], me: null, sheets: { p1: null, p2: null }, names: {}, req: null, reqAt: 0, sent: new Map(), turn: 0,
           clock: new Clock(Object.assign({ format: FORMAT_ID }, clockOpts)), bestof: null, gnum: null, ended: false, timerOn: false,
           deciding: false, timer: null, xatu: null, xatuFed: 0, stale: false, previewWaitStart: 0, clockUsed: 0, lastTimeLeft: null,
           raw: [], ratingsBefore: {}, ratings: [], rated: false, decisions: 0, preview: null, packed: {} };
}
function handleBattle(room, line, p, cmd) {
  let B = battles.get(room);
  if (CLOSED.has(room)) return;
  if (B && B.ended) {   // a finished room we stay in while its replay saves: only the rating line and errors matter
    const r = parseRatingLine(line); if (r) B.ratings.push(r);
    if (cmd === 'error') SAVER.onRoomError(room, p.slice(2).join('|'));
    return;
  }
  if (!B) { B = newBattle(room); B.rejoined = STATE.restarts > 0; battles.set(room, B); event('battle_join', { room }); if (TIMER === 'on') send(room + '|/timer on'); }
  if (cmd === 'init') {   // a (re)join replays the whole log: start the room's public record over, keep what we sent
    const keep = B; B = newBattle(room); B.sent = keep.sent; B.clockUsed = keep.clockUsed; B.bestof = keep.bestof; B.gnum = keep.gnum; B.timerOn = keep.timerOn; B.preview = keep.preview;
    B.rejoined = keep.rejoined || keep.stale || keep.lines.length > 0;
    if (keep.lines.length) { ST.reinit = (ST.reinit || 0) + 1; event('reinit', { room, had: keep.lines.length }); }
    battles.set(room, B); return;
  }   // a (re)join replays the whole log
  if (cmd === 'deinit' || cmd === 'noinit') { B.stale = true; return; }
  if (cmd === 'uhtml' && p[2] === 'bestof') {
    const m = /href="\/(game-bestof[^"]+)"/.exec(line), g = /Game (\d+)/.exec(line);
    if (m) { B.bestof = m[1]; if (!bestofs.has(m[1])) handleBestof(m[1], '', [], ''); }
    if (g) { B.gnum = +g[1]; if (B.bestof && bestofs.get(B.bestof)) bestofs.get(B.bestof).gnums.add(B.gnum); }
  }
  if (/\/confirmready/.test(line)) { const m = /\/msgroom (game-bestof[^,]+),/.exec(line); if (m) confirmReady(m[1], line); }
  if (cmd === 'inactive') {
    if (/Battle timer is ON/.test(line)) { if (!B.timerOn) ST.timerOnSeen++; B.timerOn = true; }
    if (B.clock.onInactive(line, Date.now(), NAME)) B.lastTimeLeft = { at: Date.now(), line };
    if (/lost due to inactivity|lost the series due to inactivity/.test(line) && new RegExp(NAME, 'i').test(line)) { ST.timeouts.push({ room, kind: 'forfeit', line }); }
    return;
  }
  if (/lost due to inactivity/.test(line) && toID(line).includes(toID(NAME))) ST.timeouts.push({ room, kind: 'forfeit', line: line.slice(0, 200) });
  if (cmd === 'error') {
    const txt = p.slice(2).join('|');
    if (/\[Invalid choice\]/.test(txt)) {
      ST.invalid.push({ room, rqid: B.req && B.req.rqid, txt: txt.slice(0, 200), sent: B.req && B.sent.get(B.req.rqid) });
      if (/nothing to choose|already/i.test(txt)) ST.timeouts.push({ room, kind: 'late-choice', txt: txt.slice(0, 160) });
      else if (B.req) send(room + '|/choose default|' + B.req.rqid);
    } else if (/\[Unavailable choice\]/.test(txt)) ST.unavailable.push({ room, txt: txt.slice(0, 200) });
    event('server_error', { room, txt: txt.slice(0, 300) });
    return;
  }
  if (cmd !== 'request') B.raw.push(line);   // our own copy of the room log (requests live in the decision log)
  if (cmd === 'rated') B.rated = true;
  { const r = parseRatingLine(line); if (r) B.ratings.push(r); }
  if (cmd === 'request') {
    const js = p.slice(2).join('|');
    if (!js) return;
    let req; try { req = JSON.parse(js); } catch (e) { return; }
    if (req.wait) { B.req = null; return; }
    if (B.req && B.req.rqid !== req.rqid && !B.sent.has(B.req.rqid)) { ST.superseded++; ST.timeouts.push({ room, kind: 'superseded', rqid: B.req.rqid }); }
    const again = B.req && B.req.rqid === req.rqid;
    B.req = req; if (!again) B.reqAt = Date.now();
    /* the SAME request again = the server re-sent it on a (re)join: if it was already answered, answer it again */
    if (B.sent.has(req.rqid)) B.req._needResend = true;
    if (req.side && req.side.id) B.me = req.side.id;
    if (DUMP_REQ && !again && (ST.dumped = (ST.dumped || 0)) < DUMP_REQ) {
      ST.dumped++;
      try { fs.writeFileSync(path.join(OUT, 'fixture-' + toID(NAME) + '-' + ST.dumped + '.json'), JSON.stringify({ room, me: B.me, names: B.names, turn: B.turn, sheets: B.sheets, lines: B.lines, req })); } catch (e) { /* never fatal */ }
    }
    return;
  }
  if (cmd === 'player' && p[2] && p[3]) { B.names[p[2]] = p[3]; if (toID(p[3]) === toID(NAME)) B.me = p[2]; if (p[5] && /^\d+$/.test(p[5])) B.ratingsBefore[p[2]] = +p[5]; }
  if (cmd === 'showteam' && p[2]) { B.packed[p[2]] = p.slice(3).join('|'); try { B.sheets[p[2]] = parseShowteam(p.slice(3).join('|')); } catch (e) { event('showteam_parse_error', { room, err: e.message }); } }
  if (cmd === 'turn') { B.turn = +p[2]; maybeDrill(B); }
  if (NOT_PUBLIC.has(cmd)) { if (cmd === 'win' || cmd === 'tie') { /* never here: win/tie are public */ } return; }
  B.lines.push(line);
  if (cmd === 'win' || cmd === 'tie') endBattle(B, cmd === 'win' ? p[2] : null);
}

function maybeDrill(B) {
  if (!DRILL) return;
  const m = /^(drop|crash)@(\d+)\.(\d+)\.(\d+)(?::(\d+))?$/.exec(DRILL);   // drop@S.G.T[:outage seconds]
  if (!m) return;
  const [, kind, s, g, t, hold] = m;
  const setNo = STATE.setsDone.length + 1;
  const key = DRILL;
  if ((STATE.drillsFired || []).includes(key)) return;
  if (setNo === +s && B.gnum === +g && B.turn === +t) {
    STATE.drillsFired = (STATE.drillsFired || []).concat([key]); saveState();
    ST.drills.push({ kind, room: B.id, set: setNo, game: +g, turn: +t, outage_s: +hold || 0, at: Date.now() });
    event('drill', { kind, room: B.id, set: setNo, game: +g, turn: +t, outage_s: +hold || 0 });
    say('DRILL ' + kind + ' at set ' + s + ' game ' + g + ' turn ' + t);
    if (kind === 'drop') { HOLD_UNTIL = Date.now() + 1000 * (+hold || 0); try { ws.close(); } catch (e) { /* the point */ } }
    else { writeSummary(); process.exit(3); }
  }
}

function endBattle(B, winnerName) {
  if (B.ended) return;
  B.ended = true;
  B.endedAt = Date.now();
  ST.games++;
  clearTimeout(B.timer);
  let parsed = null; try { parsed = parseGame({ id: B.id, log: B.lines.join('\n') }).game; } catch (e) { event('parse_end_error', { room: B.id, err: e.message }); }
  const winner = winnerName == null ? null : (toID(B.names.p1) === toID(winnerName) ? 'p1' : 'p2');
  const brought = {};
  if (parsed) for (const s of ['p1', 'p2']) { const L = parsed.leads[s] || []; brought[s] = L.concat((parsed.brought_seen[s] || []).filter(i => !L.includes(i))); }
  if (B.bestof && parsed) {
    BOOK.recordGame(B.bestof, { room: B.id, gnum: B.gnum, me: B.me, leads: parsed.leads, brought, winner, players: B.names,
                                turns: parsed.turns_played, clockUsed: +(B.clockUsed / 1000).toFixed(1), bankLeft: B.clock.last ? B.clock.last.bank : null });
  }
  event('game_end', { room: B.id, bestof: B.bestof, gnum: B.gnum, winner, me: B.me, timerOn: B.timerOn, clockUsed_s: +(B.clockUsed / 1000).toFixed(1) });
  if (!B.timerOn) ST.noTimerLine++;
  /* our own copy of the room log: the game survives even if the public replay never does (a hidden room, a failed save) */
  try { fs.writeFileSync(gameLogF(B.id), B.raw.join('\n') + '\n'); } catch (e) { event('game_log_write_error', { room: B.id, err: e.message }); }
  const opp = B.me === 'p1' ? 'p2' : 'p1';
  const team = B.bestof && seriesTeam.get(B.bestof);
  const draft = {
    v: 1, client: NAME, policy: POLICY, server: SERVER, local: LOCK.isLocal(SERVER), format: FORMAT_ID,
    series: B.bestof, game: B.gnum, room: B.id, ended: new Date(B.endedAt).toISOString(),
    me: B.me, players: B.names, opponent: B.names[opp] || null, our_team: team ? team.id : null,
    sheets: { p1: B.packed.p1 || null, p2: B.packed.p2 || null },
    preview_choice: B.preview, leads: parsed ? parsed.leads : null, brought: parsed ? brought : null,
    result: { winner, winner_name: winnerName, mine: winner != null && winner === B.me, tie: winnerName == null, turns: parsed ? parsed.turns_played : B.turn },
    rated: B.rated, rating_before: Object.keys(B.ratingsBefore).length ? B.ratingsBefore : null, rating_after: null,
    clock: { used_s: +(B.clockUsed / 1000).toFixed(1), bank_left_s: B.clock.last ? +(+B.clock.last.bank).toFixed(1) : null },
    decisions: { n: B.decisions, log: relRoot(gameDecF(B.id)), run_log: relRoot(LOGF) },
    battle_log: relRoot(gameLogF(B.id)),
    replay: null, provenance: PROV,
  };
  STATE.pendingGames = STATE.pendingGames || {}; STATE.pendingGames[B.id] = draft; saveState();
  const onSaved = r => { B.replay = r; finalizeWhenReady(B, draft); };
  if (SAVE_REPLAYS === 'off') SAVER.skip(B.id, 'save-replays off', onSaved);
  else if (LOCK.isLocal(SERVER) && !LOCAL_REPLAYS) SAVER.skip(B.id, 'local server without --local-replays: its login server is play.pokemonshowdown.com, so a save would leave the machine', onSaved);
  else setTimeout(() => SAVER.save(B.id, onSaved), 400);   // let the server finish closing the battle first
}
/* A game's record is written once its replay save has resolved AND the rating line had its chance: the ladder
 * posts it once per SERIES, into the deciding game's room, after the series ends. */
function seriesDecided(bestof) { try { const S = BOOK.get(bestof); const w = {}; for (const g of S.games || []) if (g.winner) w[g.winner] = (w[g.winner] || 0) + 1; return Object.values(w).some(n => n >= 2); } catch (e) { return true; } }
function finalizeWhenReady(B, draft) {
  const waited = Date.now() - B.endedAt;
  const wantRating = B.rated && !B.ratings.length && B.bestof && seriesDecided(B.bestof) && waited < 15000;
  if (waited < 3000 || wantRating) { setTimeout(() => finalizeWhenReady(B, draft), 500); return; }
  finalizeGame(draft, B.replay, B.ratings);
  setTimeout(() => { CLOSED.add(B.id); send('|/leave ' + B.id); battles.delete(B.id); }, 200);
}
function finalizeGame(draft, replay, ratings) {
  if (!STATE.pendingGames || !STATE.pendingGames[draft.room]) return;   // already written
  const rec = Object.assign({}, draft, { t: Date.now(), replay });
  if (ratings && ratings.length) {
    rec.rating_after = {};
    for (const r of ratings) { const side = toID(r.name) === toID(draft.players.p1) ? 'p1' : toID(r.name) === toID(draft.players.p2) ? 'p2' : r.name; rec.rating_after[side] = { before: r.before, after: r.after }; }
  }
  try { fs.appendFileSync(GAMES_FILE, JSON.stringify(rec) + '\n'); ST.gameRecords = (ST.gameRecords || 0) + 1; }
  catch (e) { event('games_file_write_error', { room: draft.room, err: e.message }); return; }
  delete STATE.pendingGames[draft.room]; saveState();
  event('game_record', { room: draft.room, replay: replay && replay.status, url: replay && replay.url });
  say('game record ' + draft.room + ' — replay ' + (replay ? replay.status + (replay.url ? ' ' + replay.url : '') : 'none'));
}
/* a restarted process: games that ended before the crash but whose record was not written are saved again now */
let resumed = false;
function resumePendingGames() {
  if (resumed) return; resumed = true;
  for (const draft of Object.values(STATE.pendingGames || {})) {
    if (battles.has(draft.room)) continue;
    event('resume_pending_game', { room: draft.room });
    const done = r => finalizeGame(draft, Object.assign({ resumed: true }, r), null);
    if (SAVE_REPLAYS === 'off' || (LOCK.isLocal(SERVER) && !LOCAL_REPLAYS)) SAVER.skip(draft.room, 'resumed after a restart; saving off here', done);
    else SAVER.save(draft.room, done, { needJoin: true });
  }
}

/* ---------------- deciding ---------------- */
function scheduleDecide(B) {
  if (!B.req || B.ended || B.deciding) return;
  if (B.sent.has(B.req.rqid)) {
    /* the server re-sent a request we already answered (a rejoin): answer it again, identically, if it is still open */
    if (B.req._needResend && !B.req._resent) { B.req._resent = true; ST.resent++; send(B.id + '|/choose ' + B.sent.get(B.req.rqid) + '|' + B.req.rqid); event('resend', { room: B.id, rqid: B.req.rqid }); }
    return;
  }
  clearTimeout(B.timer);
  B.timer = setTimeout(() => decide(B), 60);   // let the |inactive| Time-left line that follows the request arrive
}

function xatuBack(B, opp) {
  try {
    if (!B.xatu) {
      const sheetKeys = { p1: B.sheets.p1.map(m => ({ sp: toID(m.species), item: m.item })), p2: B.sheets.p2.map(m => ({ sp: toID(m.species), item: m.item })) };
      const mem = new BringMemory();
      if (B.bestof) for (const rec of BOOK.memoryRecords(B.bestof, B.gnum || 1, sheetKeys, B.names)) mem.addGame(rec);
      B.xatu = XATU.createBelief({ me: B.me, memory: mem, context: { series: B.bestof, gnum: B.gnum || 1, players: B.names } });
      B.xatu._initSpread = () => {};    // ROTOM needs the back-pair belief only; the spread belief is not used here
      B.xatuFed = 0;
    }
    for (; B.xatuFed < B.lines.length; B.xatuFed++) B.xatu.feed(B.lines[B.xatuFed]);
    return B.xatu.backTwo(opp);
  } catch (e) { event('xatu_error', { room: B.id, err: String(e.message).slice(0, 200) }); B.xatu = null; return null; }
}

function parseRow(B, kind) {
  /* a forced switch arrives mid-turn: close the turn with a synthetic |turn| line so the parser gives the state NOW */
  const lines = kind === 'switch' ? B.lines.concat(['|turn|' + (B.turn + 1)]) : B.lines;
  try { return parseGame({ id: B.id, log: lines.join('\n') }); }
  catch (e) { if (kind === 'switch') { try { return parseGame({ id: B.id, log: B.lines.join('\n') }); } catch (e2) { /* fall through */ } } throw e; }
}

function decide(B) {
  const req = B.req;
  if (!req || B.sent.has(req.rqid) || B.ended) return;
  if (!B.me) B.me = req.side && req.side.id;
  const kind = req.teamPreview ? 'preview' : req.forceSwitch ? 'switch' : 'move';
  /* preview waits (bounded) for both open sheets: the request arrives two lines before |showteam| (mag_bot.js) */
  if (kind === 'preview' && !(B.sheets.p1 && B.sheets.p2)) {
    if (!B.previewWaitStart) B.previewWaitStart = Date.now();
    if (Date.now() - B.previewWaitStart < 10000) { B.timer = setTimeout(() => decide(B), 150); return; }
  }
  if (kind === 'preview' && B.previewWaitStart) ST.previewSheetWaitMs.push(Date.now() - B.previewWaitStart);
  B.deciding = true;
  const t0 = Date.now();
  const bud = B.clock.budget({ kind, turn: B.turn || 1, receivedAt: B.reqAt, now: t0 });
  if (bud.from === 'rule') ST.noTimerLine++;
  const rec = { t: t0, room: B.id, bestof: B.bestof, gnum: B.gnum, turn: B.turn, kind, rqid: req.rqid, policy: POLICY, budget: bud, chain: [] };
  let choice = null, used = null, info = null;
  const opp = B.me === 'p1' ? 'p2' : 'p1';
  const coin = () => coinBase();
  const tryPolicy = (name, fn) => {
    if (choice) return;
    try {
      const r = fn();
      if (r && r.choice && RQ.isLegal(req, r.choice)) { choice = r.choice; used = name; info = r.info; }
      else { rec.chain.push({ policy: name, fail: r && r.choice ? 'not legal: ' + r.choice : 'no choice' }); fb(name + ':illegal'); }
    } catch (e) { rec.chain.push({ policy: name, fail: String(e && e.message || e).slice(0, 200) }); fb(name + ':threw'); }
  };
  let first = POLICY;
  if (POLICY === 'miltank' && bud.lowBank) { first = 'prior'; fb('clock:miltank->prior'); rec.chain.push({ policy: 'miltank', fail: 'budget ' + bud.ms + ' ms under the search floor' }); }
  /* a rejoined room with no server clock line yet: the bank is UNKNOWN (a restart lost it), so do not search on a guess */
  else if (POLICY === 'miltank' && bud.from === 'rule' && B.rejoined) { first = 'prior'; fb('clock:unknown-bank->prior'); rec.chain.push({ policy: 'miltank', fail: 'rejoined with no server clock line yet' }); }

  if (kind === 'preview') {
    const S = B.bestof ? BOOK.get(B.bestof) : null;
    const team = (B.bestof && seriesTeam.get(B.bestof)) || null;
    const mySheet = B.sheets[B.me] || [];
    const posOfSheet = s => { const r = mySheet[s]; if (!r) return s + 1; const j = req.side.pokemon.findIndex(pk => String(pk.ident).replace(/^p[12]:\s*/, '') === r.nick); return j >= 0 ? j + 1 : s + 1; };
    const d = { req, coin, sheets: B.sheets, me: B.me, budgetMs: Math.min(bud.ms, PREVIEW_MAX_MS), teamBring: team ? team.bring : null,
                series: { oppLast: B.bestof ? BOOK.oppLast(B.bestof, B.gnum || 1, B.me) : null } };
    tryPolicy(first, () => {
      let r = P.preview(first, d);
      if (r.search) { if (!(B.sheets.p1 && B.sheets.p2)) throw new Error('no sheets for the preview search'); r = P.previewSearch(d, r.human); r.order = r.order.map(x => posOfSheet(x - 1)); }
      else if (first !== 'random') r.order = r.order.map(x => posOfSheet(x - 1));
      return { choice: RQ.previewChoice(r.order), info: r.info };
    });
    if (first !== 'prior') tryPolicy('prior', () => { const r = P.preview('prior', d); return { choice: RQ.previewChoice(r.order.map(x => posOfSheet(x - 1))), info: r.info }; });
    tryPolicy('heuristic', () => ({ choice: RQ.previewChoice([1, 2, 3, 4]) }));
  } else {
    let world = null;
    const needWorld = first !== 'random';
    if (needWorld) {
      try {
        const row = parseRow(B, kind);
        const bt = xatuBack(B, opp);
        const guess = bt && bt.length ? bt.reduce((a, b) => (b.p > a.p ? b : a)).pair : null;
        world = WB.build({ row, sheets: B.sheets, me: B.me, req, oppGuess: guess });
        world.xatuBack = bt;
        rec.world = { ok: true, turn: row.turns.length, notes: world.notes, xatu: bt ? bt.map(x => [x.pair.join('+'), +x.p.toFixed(3)]) : null };
      } catch (e) { ST.worldErrors++; rec.world = { ok: false, err: String(e && e.message || e).slice(0, 200) }; }
    }
    const d = () => ({ req, world, coin, budgetMs: Math.max(0, bud.ms - (Date.now() - t0)), xatuBack: world && world.xatuBack });
    const run = (name) => () => (kind === 'switch' ? P.forceSwitch(name, d()) : P.move(name, d()));
    tryPolicy(first, run(first));
    if (first === 'miltank') tryPolicy('prior', run('prior'));
    tryPolicy('heuristic', () => ({ choice: RQ.heuristic(req) }));
  }
  if (!choice) { choice = 'default'; used = 'default'; fb('default'); }
  if (used !== POLICY) fb('used:' + used);
  const ms = Date.now() - t0;
  const ok = send(B.id + '|/choose ' + choice + '|' + req.rqid);
  B.sent.set(req.rqid, choice);
  if (kind === 'preview') B.preview = choice;
  B.deciding = false;
  const since = Date.now() - B.reqAt;
  B.clockUsed += since; B.clock.spent(since);
  if (B.clock.last && since / 1000 > B.clock.last.turnLeft && B.clock.last.at >= B.reqAt - 2000) { ST.sentLate++; ST.timeouts.push({ room: B.id, kind: 'sent-late', rqid: req.rqid, ms: since }); }
  ST.decisions++; ST.byKind[kind + ':' + used] = (ST.byKind[kind + ':' + used] || 0) + 1;
  ST.ms[kind].push(ms); ST.budget.push(bud.ms);
  rec.used = used; rec.choice = choice; rec.ms = ms; rec.sinceRequest_ms = since; rec.sent = ok;
  rec.bank_before_s = bud.bank; rec.bank_after_s = +(bud.bank - since / 1000).toFixed(1);
  if (info) rec.info = compact(info);
  B.decisions++;
  const line = JSON.stringify(rec) + '\n';
  try { fs.appendFileSync(LOGF, line); } catch (e) { /* never fatal */ }
  try { fs.appendFileSync(gameDecF(B.id), line); } catch (e) { /* never fatal */ }
  if (!ok) event('send_failed', { room: B.id, rqid: req.rqid });
}
function compact(info) {
  const o = {};
  for (const [k, v] of Object.entries(info)) { if (k === 'counters') continue; o[k] = v; }
  return o;
}

/* ---------------- summary ---------------- */
function stats(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y), q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))];
  return { n: a.length, mean: Math.round(a.reduce((x, y) => x + y, 0) / a.length), p50: q(0.5), p95: q(0.95), p99: q(0.99), max: s[s.length - 1] };
}
function writeSummary() {
  const out = { name: NAME, policy: POLICY, server: SERVER, pid: process.pid, restarts: STATE.restarts, flags: { max_ms: MAX_MS, preview_max_ms: PREVIEW_MAX_MS, margin_s: MARGIN_S, reserve_s: RESERVE_S, min_search_ms: MIN_SEARCH_MS, timer: TIMER, seed: SEED, drill: DRILL || null },
    clock_rule: new Clock(Object.assign({ format: FORMAT_ID }, clockOpts)).rule,
    sets: STATE.setsDone, decisions: ST.decisions, by_kind: ST.byKind,
    decision_ms: { preview: stats(ST.ms.preview), move: stats(ST.ms.move), switch: stats(ST.ms.switch) }, budget_ms: stats(ST.budget),
    timeouts: ST.timeouts, invalid: ST.invalid, unavailable: ST.unavailable, fallbacks: ST.fallbacks, crashes_caught: ST.crashesCaught,
    disconnects: ST.disconnects, reconnects: ST.reconnects, rejoins: ST.rejoins, resent: ST.resent, drills: ST.drills,
    timer_on_seen: ST.timerOnSeen, games: ST.games, game_records: ST.gameRecords || 0, games_file: GAMES_FILE, replays: SAVER.COUNTERS, world_errors: ST.worldErrors, decisions_without_time_line: ST.noTimerLine,
    preview_sheet_wait_ms: stats(ST.previewSheetWaitMs),
    counters: { policy: P.COUNTERS, world: WB.COUNTERS, prior: PA.COUNTERS, rollout: R.COUNTERS, api: API.COUNTERS },
    provenance: PROV };
  try { fs.writeFileSync(path.join(OUT, 'summary-' + toID(NAME) + (STATE.restarts ? '-r' + STATE.restarts : '') + '.json'), JSON.stringify(out, null, 1)); } catch (e) { /* never fatal */ }
  return out;
}
process.on('SIGINT', () => { stopping = true; writeSummary(); LOCKH.release(); process.exit(0); });
setInterval(writeSummary, 30000).unref();

connect();
