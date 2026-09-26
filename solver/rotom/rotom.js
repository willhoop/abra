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
 *   4. asks the policy ('prior' = DODUO greedy, 'miltank' = MILTANK lean search, 'miltank-gen5' = the gen5 champion with
 *      the honest arena's XATU belief (solver/rotom/policy.js, solver/xatu/worlds.js), 'random'); a budget under the
 *      search floor drops to 'prior'; any throw drops down the chain prior -> request heuristic -> `default`;
 *   5. checks the choice against the request (solver/rotom/request.js) and sends `/choose <choice>|<rqid>`;
 *   6. logs the decision to <out>/decisions-<name>.jsonl AND to the game's own file
 *      <out>/games/<name>/<room>.decisions.jsonl, and one artifact per series to <out>/series/.
 *
 * EVERY GAME IS SAVED AS A REPLAY AND JOINED TO OUR REASONING (solver/rotom/replay.js). At each game's |win|/|tie|
 * the client sends `/savereplay` in the battle room, retries on failure or silence, and — whatever happens —
 * appends ONE record to the games file (default solver/out/rotom/games.jsonl, `--games-file`): format, series,
 * game number, both sheets, both brings/leads, result, the mega counter (`mega`: per side, could it mega, did it, on
 * which turn — solver/arena/mega_rate.js), ratings when the server sends them, the replay URL, our
 * copy of the battle log, and the path of this game's decision log. A save in flight never holds the next game:
 * it lives in the finished room, which is left only when the save resolves. On a LOCAL server the save is sent
 * only with `--local-replays` (run_local.js passes it after pointing the server's login server at a local
 * stand-in); without it a local save would reach play.pokemonshowdown.com, so it is skipped and recorded so.
 *
 * LADDER MODE (`--ladder`, solver/rotom/ladder.js; runbook solver/rotom/LADDER.md): search the bo3 ladder, play the series,
 * repeat until the STOP file or the set count; a pre-committed per-series A/B arm and rotation team; the two-account
 * guard; a consecutive-error halt. It needs `--release <id>` (the Reg M-C gate release or later) and either `--public`
 * (the real server, the real login server, account on LADDER_ACCOUNTS) or `--dry-run` (a LOCAL server, a local assertion
 * stand-in, and solver/rotom/netguard.js refusing every non-loopback connection in this process). A ladder launch on
 * the public server is Will's call, every time.
 *
 * HOW EVERY GAME AND SERIES ENDED (solver/rotom/endings.js): each game record, game_end event and series-book game carries
 * end_reason (normal / forfeit_opp / forfeit_me / timeout_opp / timeout_me / inactivity / tie / unknown), end_by, end_turn,
 * at_preview and end_raw, read from the game's own protocol lines; each series (book `end`, ladder row) carries the same
 * plus walkaway_opp / walkaway_me (somebody left between games). OUR OWN forfeit_me / timeout_me / inactivity /
 * walkaway_me must be ZERO: each one is an error (ST.selfQuits, event `self_quit`) and HALTS the ladder (ladder.js onSelfQuit).
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
/* --priority normal|below (default below: the lownode class this client was started in). A ladder client that SEARCHES
 * must not be starved by other normal-priority work on the machine: MILTANK bounds its own decision, it cannot bound a
 * process the OS does not run (docs/_reports/2026-09-25-miltank-deadline.md). MILTANK's pool workers set themselves
 * BELOW_NORMAL whatever the client runs at, so only the decider is raised. Recorded in the summary as `priority`. */
const PRIORITY = flag('priority', 'below');
if (!['normal', 'below'].includes(PRIORITY)) { console.error('--priority must be normal or below'); process.exit(2); }
const PRIORITY_SET = (() => { try { require('os').setPriority(0, require('os').constants.priority[PRIORITY === 'normal' ? 'PRIORITY_NORMAL' : 'PRIORITY_BELOW_NORMAL']); return require('os').getPriority(0); }
  catch (e) { console.error('--priority ' + PRIORITY + ' could not be set: ' + e.message); return null; } })();
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
/* THE ADAPTIVE CLOCK (2026-09-27, solver/rotom/adaptive.js): --adaptive-target-ms T, or an arm's `adaptive: { targetMs }`,
 * plans each searched decision around T — little when the table is clear, up to 2T when it is close — under a cap from
 * the bank the server reports. Without it the budget is the clock's fixed share, as before. */
const ADAPT_TARGET_MS = +flag('adaptive-target-ms', 0);
const ADAPT = require('./adaptive.js');
const TIMER = flag('timer', 'on');
const DRILL = flag('drill', '');                     // drop@S.G.T | crash@S.G.T  (set, game, turn; 1-based)
const DUMP_REQ = +flag('dump-requests', 0);          // write the first N requests (+ the public log so far) as test fixtures
const TEAM_POOL = has('ladder') ? flag('rotation', path.join(__dirname, 'teams', 'ladder-rotation.json')) : flag('team-pool', path.join(__dirname, 'teams', 'regmc-pool.json'));
const FORMAT_ID = 'gen9championsvgc2026regmcbo3';
const GAMES_FILE = path.resolve(flag('games-file', path.join(ROOT, 'solver', 'out', 'rotom', 'games.jsonl')));
const SAVE_REPLAYS = flag('save-replays', 'on');     // on | off
const LOCAL_REPLAYS = has('local-replays');          // the local server's login server is a local stand-in (run_local.js)
const REPLAY_TIMEOUT_MS = +flag('replay-timeout-ms', 20000);
const REPLAY_ATTEMPTS = +flag('replay-attempts', 4);
/* THE SERIES WATCH (solver/rotom/ladder.js stallAction; the aa1 hang, docs/_reports/2026-09-25-rotom-series-hang.md): an
 * open series with no line in its room or any of its battles for --series-idle-ms is probed with `/crq roominfo`; an answer
 * "alive, and we are in it" is LIFE and the series is repaired, never orphaned (aa2 k=16, 2026-09-26); gone, or probes
 * unanswered through --series-max-probes, it is ORPHANED (logged, a ladder error) so the loop cannot wait forever */
const LADDER_LIB = require('./ladder.js');
const SERIES_WATCH = { idleMs: +flag('series-idle-ms', require('./ladder.js').SERIES_IDLE_MS), probeMs: +flag('series-probe-ms', require('./ladder.js').SERIES_PROBE_MS),
                       maxProbes: +flag('series-max-probes', require('./ladder.js').SERIES_MAX_PROBES) };

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(GAMES_FILE), { recursive: true });
const GAMEDIR = path.join(OUT, 'games', toID(NAME));
fs.mkdirSync(GAMEDIR, { recursive: true });
const relRoot = f => path.relative(ROOT, f).split(path.sep).join('/');
const gameDecF = room => path.join(GAMEDIR, room + '.decisions.jsonl');
const gameLogF = room => path.join(GAMEDIR, room + '.log');
const LADDER_MODE = has('ladder');
const DRY_RUN = has('dry-run');
const RELEASE_ID = flag('release', null);
const LADDER_ACCOUNTS = ['medicham32'];              // the only account ROTOM may ladder as on the public server (Will, 2026-09-23)
const PUBLIC_LOGIN_URL = 'https://play.pokemonshowdown.com/api/login';

/* a DRY RUN never talks to anything but this machine: every non-loopback connection in this process is refused and counted */
const NETGUARD = DRY_RUN ? require('./netguard.js').install({ log: path.join(OUT, 'netguard-' + toID(NAME) + '.jsonl') }) : null;
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
const POLICIES = ['prior', 'miltank', 'miltank-gen5', 'random'];
const SEARCHES = ['miltank', 'miltank-gen5'];          // the policies that search: the clock floor, the prior fallback and the idle GC apply
if (!POLICIES.includes(POLICY)) { console.error('unknown --policy ' + POLICY); process.exit(2); }
if (DRY_RUN && !LOCK.isLocal(SERVER)) { console.error('--dry-run is LOCAL only: ' + SERVER + ' is not localhost. Refusing.'); process.exit(2); }
if (DRY_RUN && has('public')) { console.error('--dry-run and --public together make no sense. Refusing.'); process.exit(2); }
if (LADDER_MODE) {
  if (!DRY_RUN && !has('public')) { console.error('--ladder needs --public (the real ladder, Will’s OK) or --dry-run (a local server). Refusing.'); process.exit(2); }
  if (has('public') && !LADDER_ACCOUNTS.includes(toID(NAME))) { console.error('--ladder --public: ' + NAME + ' is not a ladder account (' + LADDER_ACCOUNTS.join(', ') + '). Refusing.'); process.exit(2); }
  if (!RELEASE_ID) { console.error('--ladder needs --release <id>: a series is never played on the live tree. Refusing.'); process.exit(2); }
  if (!flag('arms', '')) { console.error('--ladder needs --arms <file> (the pre-registered A/B arms). Refusing.'); process.exit(2); }
  if (has('challenge') || has('accept')) { console.error('--ladder does not take --challenge/--accept: it searches the ladder and refuses challenges.'); process.exit(2); }
  const ra = require('./ladder.js').releaseAllowed(path.join(ROOT, 'data', 'releases'), RELEASE_ID);
  if (!ra.ok) { console.error('--release refused: ' + ra.why); process.exit(2); }
}
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
/* credentials: a local challenge run needs none; a DRY RUN sends a placeholder to the local stand-in and never reads the
 * real password; the PUBLIC ladder reads data/.showdown-pass only (lock.js readPasswordFile) — never argv, never logged */
const CRED = DRY_RUN ? { pass: 'dry-run-placeholder', source: 'dry run placeholder (the real password is not read)' }
  : (LADDER_MODE ? LOCK.readPasswordFile(ROOT) : (LOCK.isLocal(SERVER) ? { pass: '', source: 'not needed (local server)' } : LOCK.readPassword(ROOT)));
if (LADDER_MODE && !DRY_RUN && !CRED.pass) { console.error('--ladder --public: no password in data/.showdown-pass (' + CRED.source + '). Refusing.'); process.exit(2); }
const LOGIN_URL = DRY_RUN ? flag('login-url', '') : PUBLIC_LOGIN_URL;
if (DRY_RUN && LADDER_MODE && !/^http:\/\/127\.0\.0\.1:\d+\/api\/login$/.test(LOGIN_URL)) { console.error('--dry-run --ladder needs --login-url http://127.0.0.1:<port>/api/login (solver/rotom/login_stub.js). Refusing.'); process.exit(2); }
say('lock ' + LOCKH.path + (LOCKH.tookOverStale ? ' (stale lock taken over)' : '') + ' ; credentials: ' + CRED.source);

/* ---------------- run state (persisted, so a restarted process keeps counting) ---------------- */
let STATE = { name: NAME, policy: POLICY, setsDone: [], restarts: 0 };
try { const s = JSON.parse(fs.readFileSync(STATEF, 'utf8')); STATE = Object.assign(STATE, s); STATE.restarts = (STATE.restarts || 0) + 1; say('resumed run state: ' + STATE.setsDone.length + ' sets done, restart #' + STATE.restarts); } catch (e) { /* fresh */ }
const saveState = () => { try { fs.writeFileSync(STATEF, JSON.stringify(STATE, null, 1)); } catch (e) { /* never fatal */ } };
saveState();

/* ---------------- the engine and the models, warmed BEFORE connecting ---------------- */
const t0load = Date.now();
require('../arena/env.js');
/* the engine: a FROZEN release when --release is given (every engine byte from data/releases/<id>/, solver/arena/engine.js),
 * else the live tree (a local shakedown only — ladder mode refuses to start without a release) */
const ENGINE = require('../arena/engine.js').load(RELEASE_ID);
const API = ENGINE.API;
const T = require('../arena/teams.js');
const MAGD = require('../mag/infer.js').load();
const PA = require('../miltank/prior_adapter.js').create(API, MAGD);
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const SEARCH_MOD = require('../miltank/search.js');
const TABLES = JSON.parse(fs.readFileSync(path.join(__dirname, 'tables.json'), 'utf8'));
const WB = require('./world.js').create(API);
const P = require('./policy.js').create({ API, PA, R, tables: TABLES });
const RQ = require('./request.js');
const { Clock } = require('./clock.js');
const { parseGame, parseShowteam } = require('../human/parse_game.js');
const MR = require('../arena/mega_rate.js');   // the mega capability counter, same definition as the arena and the human rate
const APPLIED = require('./applied.js');       // chosen vs applied: did the server DO what we chose (every decision, every game)
APPLIED.redirectors();                          // warm the format-derived redirect sets now, never on the first turn that needs them
const XATU = require('../xatu/index.js');
const { BringMemory } = require('../xatu/bring.js');
const { SeriesBook } = require('./series.js');
const ENDINGS = require('./endings.js');   // how a game / a series ended (forfeit, timeout, walkaway), from the protocol lines
const BOOK = new SeriesBook(path.join(OUT, 'series', toID(NAME)));   // per client: two clients in one run never share a file
const POOL = JSON.parse(fs.readFileSync(TEAM_POOL, 'utf8'));
const sha = f => { try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16); } catch (e) { return null; } };
const PROV = { engine: sha(path.join(ROOT, 'engine', 'medicham2-browser.js')), api: sha(path.join(ROOT, 'engine', 'medicham_api.js')),
  engine_data: sha(path.join(ROOT, 'data', 'engine-data-regmc.js')), mag: sha(path.join(ROOT, 'solver', 'mag', 'model', 'mag-v1.json')),
  doduo: sha(path.join(ROOT, 'solver', 'mag', 'model', 'doduo-v1.json')), xatu_bring: sha(path.join(ROOT, 'solver', 'xatu', 'model', 'bring-v1.json')),
  tables: sha(path.join(__dirname, 'tables.json')), team_pool: sha(TEAM_POOL),
  release: ENGINE.id ? ENGINE.stamp : 'live tree (not a frozen release: a shakedown, not a result)' };
if (ENGINE.id) { const ed = path.join(ENGINE.REL.dir, 'data', 'engine-data-regmc.js'); PROV.engine = sha(path.join(ENGINE.REL.dir, 'engine', 'medicham2-browser.js')); PROV.api = sha(path.join(ENGINE.REL.dir, 'engine', 'medicham_api.js')); PROV.engine_data = sha(ed); }
/* warm-up: a few prior calls and one short search on a built position, so V8 tier-up is paid before the clock runs */
(function warm() {
  try {
    const G = { id: 'warm', sheets: { p1: parseShowteam(POOL.teams[0].packed), p2: parseShowteam(POOL.teams[1 % POOL.teams.length].packed) },
                brought: { p1: POOL.teams[0].bring, p2: POOL.teams[1 % POOL.teams.length].bring } };
    const a = T.buildTeam(API.M, G, 'p1'), b = T.buildTeam(API.M, G, 'p2');
    const S = API.newBattle(a.team, b.team, { rng: API.makeRng(1) });
    const MT = require('../miltank/search.js').create(API, { prior: PA, rollout: R });
    MT.decide(S, 'A', PA.newGame(G), { budgetMs: 1500, coin: API.M.rngStreams({ seed: 3 }).any });
    /* miltank-gen5: load the gen5 nets, its PORYGON2 leaf and XATU's spread belief (the checkout's sim) BEFORE a clock
     * runs, and stamp their digests; the arms file is read here only for its policy names */
    let armsPol = [];
    try { if (flag('arms', '')) armsPol = Object.values(JSON.parse(fs.readFileSync(path.resolve(flag('arms', '')), 'utf8')).arms || {}).map(a => a.policy); } catch (e) { /* validated later */ }
    if (POLICY === 'miltank-gen5' || armsPol.includes('miltank-gen5')) {
      const tw = Date.now();
      P.warmGen5(S, PA.newGame(G), API.M.rngStreams({ seed: 5 }).any);
      const g = P.gen5();
      PROV.gen5 = { spec: path.relative(ROOT, g.specFile).split(path.sep).join('/'), spec_sha256: sha(g.specFile), digests: g.digests };
      say('warm-up: miltank-gen5 loaded in ' + (Date.now() - tw) + ' ms (' + JSON.stringify(g.digests) + ')');
    }
  } catch (e) { say('warm-up failed (continuing): ' + e.message); }
})();
say('loaded engine ' + (ENGINE.id ? 'release ' + ENGINE.id : '(LIVE TREE)') + ' + MAG/DODUO + XATU in ' + (Date.now() - t0load) + ' ms; policy ' + (LADDER_MODE ? 'per series arm' : POLICY) + '; out ' + OUT);

const { ReplaySaver, parseRatingLine } = require('./replay.js');
const SAVER = new ReplaySaver({ send: (room, text) => send(text), attempts: REPLAY_ATTEMPTS, timeoutMs: REPLAY_TIMEOUT_MS,
  log: (type, o) => event(type, o) });
const coinBase = API.M.rngStreams({ seed: SEED * 7777 + parseInt(crypto.createHash('sha256').update(toID(NAME)).digest('hex').slice(0, 7), 16) }).any;
const clockOpts = { maxMs: MAX_MS, marginS: MARGIN_S, reserveS: RESERVE_S, minSearchMs: MIN_SEARCH_MS };

/* ---------------- stats ---------------- */
const ST = { decisions: 0, byKind: {}, ms: { preview: [], move: [], switch: [] }, budget: [], fallbacks: {}, invalid: [], unavailable: [],
             timeouts: [], sentLate: 0, superseded: 0, reconnects: 0, disconnects: 0, rejoins: 0, resent: 0, crashesCaught: [], drills: [],
             timerOnSeen: 0, games: 0, previewSheetWaitMs: [], worldErrors: 0, noTimerLine: 0,
             /* how our games ended, and every game or series WE lost by forfeit / timeout / walkaway (must stay empty) */
             endReasons: {}, selfQuits: [],
             /* MEGA, as a RATE on the games where OUR side could mega (solver/arena/mega_rate.js): a capability that cannot
              * prove it ran is assumed broken, and "at least one mega happened" once hid a 56%-vs-85% rate */
             mega: { games: 0, parsed: 0, capable: 0, megas: 0, turn: {}, delay: {}, opp_capable: 0, opp_megas: 0 },
             /* CHOSEN VS APPLIED, over every check of every decision (preview, move, target, mega, switch, forced, timer) */
             applied: new APPLIED.Tally(), verifyCost: { runs: 0, decisions: 0, ms: 0, max_ms: 0 } };
const fb = (k) => { ST.fallbacks[k] = (ST.fallbacks[k] || 0) + 1; };
process.on('uncaughtException', e => { ST.crashesCaught.push(String(e && e.stack || e).slice(0, 400)); event('uncaught', { err: String(e && e.message || e) }); say('UNCAUGHT ' + (e && e.stack || e)); });

/* ---------------- ladder mode (solver/rotom/ladder.js) ---------------- */
let LADDER = null;
let exitWaitStart = 0;
function exitClean(code, why) {
  /* never exit with a game whose record is unwritten while its replay save is still in flight (bounded, as checkDone):
   * the 2026-09-26 throttle dry run left its last game's record pending at the ladder's exit */
  const pending = Object.keys(STATE.pendingGames || {}).length;
  if (pending) {
    exitWaitStart = exitWaitStart || Date.now();
    if (Date.now() - exitWaitStart < (REPLAY_ATTEMPTS + 1) * REPLAY_TIMEOUT_MS + 30000) { setTimeout(() => exitClean(code, why), 500); return; }
    event('exit_with_pending_games', { rooms: Object.keys(STATE.pendingGames) });
  }
  stopping = true;
  STATE.cleanExit = true; saveState();
  writeSummary();
  say('exit ' + code + ' — ' + why);
  setTimeout(() => { try { ws.close(); } catch (e) { /* closing */ } LOCKH.release(); process.exit(code); }, 1500);
}
if (LADDER_MODE) {
  /* every rotation team passes Showdown's own validator for the format BEFORE the first search, or nothing starts */
  const X = require('../human/dex.js');
  const { Teams, TeamValidator } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));
  const V = TeamValidator.get(FORMAT_ID);
  const bad = POOL.teams.map(t => ({ id: t.id, problems: V.validateTeam(Teams.unpack(t.packed)) })).filter(x => x.problems);
  if (bad.length) { console.error('ROTATION REFUSED by TeamValidator(' + FORMAT_ID + '): ' + JSON.stringify(bad).slice(0, 600)); process.exit(2); }
  if (POOL.teams.length < 3 || POOL.teams.length > 5) { console.error('the rotation must hold 3-5 teams; ' + TEAM_POOL + ' has ' + POOL.teams.length); process.exit(2); }
  if (!flag('ladder-seed', '')) { console.error('--ladder needs --ladder-seed <string>: the per-series A/B and rotation are drawn from it, committed before the first game.'); process.exit(2); }
  const armsFile = path.resolve(flag('arms', ''));
  const arms = JSON.parse(fs.readFileSync(armsFile, 'utf8'));
  if (arms.dry_run_only && !DRY_RUN) { console.error('--arms ' + armsFile + ' is marked dry_run_only (search caps for a harness test). Refusing it on the public ladder.'); process.exit(2); }
  for (const [id, a] of Object.entries(arms.arms || {})) if (!POLICIES.includes(a.policy)) { console.error('arm ' + id + ': unknown policy ' + a.policy); process.exit(2); }
  if (Object.keys(arms.arms || {}).length < 1) { console.error('--arms ' + armsFile + ' defines no arms'); process.exit(2); }
  const shaFull = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const defStop = DRY_RUN ? path.join(OUT, 'STOP') : path.join(ROOT, 'solver', 'out', 'rotom', 'STOP');
  const stopFiles = [path.resolve(flag('stop-file', defStop)), path.resolve(flag('kill-file', path.join(path.dirname(defStop), 'KILL')))];
  const LSTATE = path.join(OUT, 'ladder-state-' + toID(NAME) + '.json');
  for (const f of stopFiles) if (fs.existsSync(f) && !fs.existsSync(LSTATE)) { console.error('a STOP/KILL file is present at start (' + f + '): remove it to start a ladder run. Refusing.'); process.exit(2); }
  try {
    LADDER = require('./ladder.js').create({
      name: NAME, format: FORMAT_ID, formatPrefix: 'gen9championsvgc2026regmc', server: SERVER, dryRun: DRY_RUN, outDir: OUT, statePath: LSTATE,
      arms: Object.assign({ file: path.relative(ROOT, armsFile).split(path.sep).join('/'), sha256: shaFull(armsFile) }, arms),
      rotation: { file: path.relative(ROOT, path.resolve(TEAM_POOL)).split(path.sep).join('/'), sha256: shaFull(TEAM_POOL), teams: POOL.teams },
      seed: flag('ladder-seed', ''), sets: SETS, stopFiles, maxErrors: +flag('max-errors', 3), maxHours: +flag('max-hours', 0),
      guardUsers: flag('guard', 'willhoop').split(',').filter(Boolean), guardMode: flag('guard-mode', 'online'),
      release: ENGINE.stamp, restartedAfterCrash: STATE.restarts > 0 && !STATE.cleanExit,
      send: (x) => send(x), say, event, loggedIn: () => loggedIn, setsDone: () => STATE.setsDone.length, openSeries: () => openSeries(),
      counters: () => ({ fallbacks: Object.assign({}, ST.fallbacks), invalid: ST.invalid.length, timeouts: ST.timeouts.length, decisions: ST.decisions, crashes: ST.crashesCaught.length,
                         applied_checks: ST.applied.chosen, applied_mismatch: ST.applied.mismatch, preview_mismatch: (ST.applied.by_kind.preview || {}).mismatch || 0, throttle_notices: THR.notices }),
      maxMismatches: +flag('max-mismatches', 3),
      bookGet: (room) => { const b = BOOK.get(room); return b && b.ladder ? b : null; },
      bookSet: (room, o) => { const b = BOOK.get(room); Object.assign(b, o); BOOK.save(b); },
      exit: (code, why) => exitClean(code, why),
      seriesEnd: (room) => settleSeriesEnd(room),   // endings.js seriesEnd over the series book: the row's end_reason and games_end
      socketOpen: () => !!(ws && ws.readyState === 1), loggedOutSince: () => loggedOutSince,
      preSearch: DRY_RUN && has('hide-next') ? () => send('|/hidenext') : null,   // dry run: this side hides its series (a PRIVATE room)
      reconnect: (why) => { event('relogin', { why }); try { if (ws && ws.readyState === 1) ws.close(); } catch (e) { /* the onclose path reconnects */ } },
    });
  } catch (e) { console.error(e.message); process.exit(e.code === 'PLAN_MISMATCH' ? 2 : 1); }
  STATE.cleanExit = false; saveState();
  say('LADDER ' + (DRY_RUN ? 'DRY RUN (local, netguard on)' : 'PUBLIC') + ' — release ' + ENGINE.id + ', arms ' + Object.keys(arms.arms).join('/') + ', rotation ' + POOL.teams.map(t => t.id).join(',')
      + ', plan ' + LADDER.plan().digest.slice(0, 12) + ', stop file ' + stopFiles[0] + ', guard ' + flag('guard', 'willhoop') + ' (' + flag('guard-mode', 'online') + ')');
}

/* ---------------- socket ---------------- */
let ws = null, backoff = 1000, loggedIn = false, stopping = false, HOLD_UNTIL = 0, loggedOutSince = Date.now();
/* EVERY OUTGOING MESSAGE IS PACED (solver/rotom/sendq.js; the aa2 throttle, docs/_reports/2026-09-26-rotom-throttle-fix.md).
 * The server drops a user's 7th message inside its 600 ms-per-message queue, with a notice and nothing else; ROTOM's burst
 * at the start of a series lost the preview `/choose` and the battle `/timer on` in 14 of 17 game 1s. One frame per
 * --send-gap-ms (650), battle choices first. send() = QUEUED on an open socket; whether the server APPLIED a choice is
 * read back from the server's own lines (solver/rotom/applied.js), never from this return value. */
const SEND_GAP_MS = +flag('send-gap-ms', 650);
const SENDQ = new (require('./sendq.js').SendQueue)({ gapMs: SEND_GAP_MS, write: f => ws.send(f), isOpen: () => !!(ws && ws.readyState === 1) });
const send = (s) => SENDQ.send(s);
/* the throttle, counted: every notice, what it followed, what was resent, and resends the server found redundant */
const THR = { notices: 0, by_room: {}, resent_choices: 0, resent_other: 0, redundant_resends: 0, cleared_on_close: 0, last: [] };
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
    loggedIn = false; loggedOutSince = Date.now();
    { const n = SENDQ.clear(); if (n) { THR.cleared_on_close += n; event('sendq_cleared', { frames: n, why: 'socket closed' }); } }   // the rejoin path re-answers the open request
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
  if (cmd === 'raw' && /message-throttle-notice/.test(line)) return onThrottle(room, line);
  if (!room || room === 'lobby') {
    if (cmd === 'challstr') return login(p.slice(2).join('|'));
    if (cmd === 'updateuser') {
      if (toID(p[2]) === toID(NAME) && p[3] === '1' || toID(p[2]) === toID(NAME)) {
        if (!loggedIn) {
          loggedIn = true; loggedOutSince = 0; backoff = 1000; say('logged in as ' + NAME); event('login', {});
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
      if (LADDER) LADDER.onUpdateSearch(d);
      const listed = Object.keys((d && d.games) || {});
      for (const rid of listed) {
        const twin = renamedTwin(rid);   // the pre-rename id of a room we already hold under its private id: never join it
        if (twin) { ROOMS.skippedOldIds++; event('skip_renamed_id', { room: rid, held_as: twin }); continue; }
        /* one /join per room in flight: |updatesearch| lists a new battle twice before its room speaks (aa2 k=16), and
         * every extra frame is one more in the burst the throttle drops */
        if (JOINING.has(rid) && Date.now() - JOINING.get(rid) < 15000 && !(battles.has(rid) && battles.get(rid).stale)) { ROOMS.dupJoins++; continue; }
        if (!battles.has(rid) && !bestofs.has(rid)) { JOINING.set(rid, Date.now()); send('|/join ' + rid); ST.rejoins++; event('join_from_updatesearch', { room: rid }); }
        else if (battles.has(rid) && battles.get(rid).stale) { JOINING.set(rid, Date.now()); send('|/join ' + rid); ST.rejoins++; }
      }
      /* a battle we hold as STALE (the socket dropped) that the server no longer lists is over for us: it no longer
       * blocks the next search (liveBattles) — logged, never silent */
      if (d && 'games' in d && loggedIn) {
        const L = new Set(listed.map(r => LADDER_LIB.canonRoom(r)));
        for (const B of [...battles.values()]) if (B.stale && !B.ended && !L.has(LADDER_LIB.canonRoom(B.id))) {
          battles.delete(B.id); CLOSED.add(B.id); ROOMS.unlisted++; event('battle_unlisted', { room: B.id, turn: B.turn });
        }
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
    if (cmd === 'popup' && SAVER.onPopup(p.slice(2).join('|'))) return;   // a /savereplay answer is the saver's, not the ladder's
    if (cmd === 'queryresponse') { if (p[2] === 'roominfo') return onRoomInfo(p.slice(3).join('|')); if (LADDER) LADDER.onQuery(p[2], p.slice(3).join('|')); return; }
    if (cmd === 'nametaken') { say('LOGIN REFUSED: ' + p.slice(2).join('|').slice(0, 200)); event('login_refused', { txt: p.slice(2).join('|').slice(0, 200) }); if (LADDER) LADDER.onLoginFailed(p.slice(3).join('|')); return; }
    if (cmd === 'popup' && LADDER) LADDER.onPopup(line);
    if (cmd === 'popup') { event('popup', { text: line.slice(0, 300) }); if (/not online|is not accepting|already/i.test(line)) lastChallenge = 0; say('POPUP ' + line.slice(0, 200)); return; }
    return;
  }
  if ((room.startsWith('game-bestof') || room.startsWith('battle-')) && (cmd === 'noinit' || cmd === 'deinit')) return onRoomNoinit(room, p, cmd);
  if (room.startsWith('game-bestof')) return handleBestof(room, line, p, cmd);
  if (room.startsWith('battle-')) return handleBattle(room, line, p, cmd);
}

/* ---------------- rooms that are renamed, vanish, or go silent (the aa1 hang, 2026-09-25) ----------------
 * A hidden bo3 is RENAMED by the server to `<id>-<31 chars>pw` (pokemon-showdown-mc server/rooms.ts setPrivacy ->
 * rename(..., noAlias)): anyone in the room gets `>OLD\n|noinit|rename|NEW|title`, and a later /join of OLD gets
 * `|noinit|nonexistent|`. Before this, ANY line in a game-bestof room created a series — so that noinit made a phantom
 * series k+1 that could never end, and the ladder waited "series in progress" for 20 minutes. Now a noinit/deinit line
 * never creates anything; a rename moves the record; a room that is gone orphans an open series; and an open series
 * that goes silent is probed and, failing that, orphaned (watchSeries). */
const ROOMS = { renames: 0, ignoredNoinit: 0, skippedOldIds: 0, probes: 0, orphans: [], dupJoins: 0, unlisted: 0, aliveAnswers: 0, repairs: 0, unorphaned: 0 };
const JOINING = new Map();   // room -> when we sent /join (one in flight per room)
function renamedTwin(rid) {
  if (LADDER_LIB.isPrivateId(rid)) return null;
  for (const k of bestofs.keys()) if (k !== rid && LADDER_LIB.canonRoom(k) === rid) return k;
  for (const k of battles.keys()) if (k !== rid && LADDER_LIB.canonRoom(k) === rid) return k;
  return null;
}
function rekeyBestof(from, to) {
  const bo = bestofs.get(from); if (!bo) return;
  bestofs.delete(from);
  if (bestofs.has(to)) { event('series_rename_dup', { from, to }); return; }
  bo.id = to; bo.lastSeen = Date.now(); bestofs.set(to, bo);
  if (seriesTeam.has(from)) { seriesTeam.set(to, seriesTeam.get(from)); seriesTeam.delete(from); }
  if (activeSeries === from) activeSeries = to;
  const S0 = BOOK.get(from), S1 = BOOK.get(to);
  for (const k of Object.keys(S0)) if (k !== 'id' && (S1[k] == null || (Array.isArray(S1[k]) && !S1[k].length))) S1[k] = S0[k];
  S1.renamed_from = from; BOOK.save(S1);
  if (LADDER) LADDER.renameSeries(from, to);
  for (const B of battles.values()) if (B.bestof === from) B.bestof = to;
  ROOMS.renames++; event('series_rename', { from, to });
  say('series room renamed (a hidden series) ' + from + ' -> ' + to);
}
function rekeyBattle(from, to) {
  const B = battles.get(from); if (!B) return;
  battles.delete(from);
  if (battles.has(to)) { event('battle_rename_dup', { from, to }); return; }
  B.id = to; battles.set(to, B);
  if (STATE.pendingGames && STATE.pendingGames[from]) { STATE.pendingGames[to] = Object.assign(STATE.pendingGames[from], { room: to }); delete STATE.pendingGames[from]; saveState(); }
  ROOMS.renames++; event('battle_rename', { from, to });
}
function onRoomNoinit(room, p, cmd) {
  const kind = cmd === 'deinit' ? 'deinit' : (p[2] || 'noinit');
  const isBo = room.startsWith('game-bestof');
  if (kind === 'rename' && p[3]) return isBo ? rekeyBestof(room, p[3]) : rekeyBattle(room, p[3]);
  if (isBo) {
    const bo = bestofs.get(room);
    if (!bo) { ROOMS.ignoredNoinit++; event('noinit_ignored', { room, kind, txt: p.slice(3).join('|').slice(0, 160) }); return; }   // never a new series
    if (kind === 'deinit' || bo.done) return;
    bo.gone = kind;   // nonexistent / joinfailed for a series we hold: the watch orphans it now
    event('series_room_gone', { room, kind });
    return watchSeries();
  }
  if (CLOSED.has(room)) return;
  const B = battles.get(room);
  if (!B) { ROOMS.ignoredNoinit++; event('noinit_ignored', { room, kind, txt: p.slice(3).join('|').slice(0, 160) }); return; }   // never a new battle
  if (kind !== 'deinit' && !B.lines.length && !B.ended) { battles.delete(room); CLOSED.add(room); ROOMS.ignoredNoinit++; event('battle_room_gone', { room, kind }); return; }
  B.stale = true;
}
function seriesOfBattle(B) { return B && B.bestof ? bestofs.get(B.bestof) : null; }
function onRoomInfo(json) {
  let d = null; try { d = JSON.parse(json); } catch (e) { return; }
  if (!d || !d.id) return;
  const bo = bestofs.get(d.id); if (!bo || bo.done) return;
  bo.probeAnswers = (bo.probeAnswers || 0) + 1;
  if (d.error) { bo.gone = 'roominfo: ' + d.error; event('series_probe', { room: d.id, answer: 'gone' }); return watchSeries(); }
  const inIt = (d.users || []).some(u => toID(u) === toID(NAME));
  event('series_probe', { room: d.id, answer: 'alive', users: (d.users || []).length, in_it: inIt });
  if (!inIt) { send('|/join ' + d.id); return; }   // alive and we are not in it: rejoin, the log replays
  /* ALIVE AND WE ARE IN IT (aa2 k=16: three such answers, and the watch orphaned it anyway, and the ladder searched while
   * the series went on). A live room we are in is never orphaned: it is waiting — usually on us, or on a timer nobody
   * turned on. So it counts as life, and the watch REPAIRS it: the timer on again, the open request answered again. The
   * server's timer then bounds the wait; the ladder does not search while it lasts (openSeries). */
  bo.lastAlive = Date.now(); bo.probes = 0; bo.probeSentAt = 0; ROOMS.aliveAnswers++;
  repairSeries(bo, 'probe: alive, we are in it');
}
/* the battles of an open series that are still live: re-send the timer and the open choice (or decide it now) */
function repairSeries(bo, why) {
  const acts = [];
  for (const B of battles.values()) {
    if (B.ended || B.bestof !== bo.id) continue;
    if (TIMER === 'on' && !B.timerAck) { send(B.id + '|/timer on'); B.timerSent = true; acts.push('timer ' + B.id.slice(-6)); }
    if (B.req && B.sent.has(B.req.rqid)) {
      const k = B.req.rqid; B.repairResends = B.repairResends || {};
      if ((B.repairResends[k] = (B.repairResends[k] || 0) + 1) <= 3) { B.resendAt = Date.now(); send(B.id + '|/choose ' + B.sent.get(k) + '|' + k); ST.resent++; acts.push('choose rqid ' + k); }
    }
    else if (B.req && !B.deciding) { scheduleDecide(B); acts.push('decide rqid ' + B.req.rqid); }
  }
  ROOMS.repairs++;
  event('series_repair', { room: bo.id, why, acts });
  if (acts.length) say('series ' + bo.id + ' ' + why + ' — repaired: ' + acts.join(', '));
}
/* THE THROTTLE NOTICE. The server names only the ROOM of the message it dropped (users.ts:1446-1452), so: the open
 * choice in that battle is re-sent (a redundant resend is harmless — the server takes the same choice again, or says
 * "too late", which is then not counted as an invalid choice), and the other idempotent frames written to that room in
 * the last 6 s are re-sent. A dropped /utm or /search re-runs the search step (cancel, team, search). Counted. */
function onThrottle(room, line) {
  THR.notices++; THR.by_room[room || 'lobby'] = (THR.by_room[room || 'lobby'] || 0) + 1;
  const B = room ? battles.get(room) : null;
  if (B) B.raw.push(line);
  const recent = SENDQ.recentTo(room || '', 6000).filter(r => !r.throttleHandled);
  const resent = [];
  if (B && !B.ended && B.req && B.sent.has(B.req.rqid)) {
    const k = B.req.rqid; B.throttleResends = B.throttleResends || {};
    if ((B.throttleResends[k] = (B.throttleResends[k] || 0) + 1) <= 3) {
      B.resendAt = Date.now(); SENDQ.sendFirst(room + '|/choose ' + B.sent.get(k) + '|' + k); THR.resent_choices++; ST.resent++; resent.push('/choose rqid ' + k);
    }
  }
  let research = false;
  for (const r of recent) {
    r.throttleHandled = true;
    if (/^\/(timer on|join |leave |confirmready)/.test(r.msg) && !r.resend) { SENDQ.sendFirst(r.frame); THR.resent_other++; resent.push(r.msg.slice(0, 40)); }
    if (/^\/(utm|search) /.test(r.msg)) research = true;
  }
  if (research && LADDER) { THR.resent_other++; resent.push('search step'); LADDER.redoSearch('throttle notice after /utm or /search'); }
  const rec = { room: room || 'lobby', recent: recent.map(r => r.msg.slice(0, 40)), resent };
  THR.last.push(Object.assign({ at: new Date().toISOString() }, rec)); if (THR.last.length > 20) THR.last.shift();
  event('throttle_notice', rec);
  say('THROTTLE NOTICE in ' + (room || 'lobby') + ' — resent ' + (resent.join(', ') || 'nothing'));
}
/* a battle we are in that has not ended — it blocks the next search whatever its series record says */
function liveBattles() { return [...battles.values()].filter(B => !B.ended && !CLOSED.has(B.id) && (B.lines.length > 0 || B.req)); }
function watchSeries() {
  if (!loggedIn || HUNG) return;
  const now = Date.now();
  for (const bo of [...bestofs.values()]) {
    if (bo.done) continue;
    const a = LADDER_LIB.stallAction({ lastSeen: bo.lastSeen || bo.started, probes: bo.probes || 0, probeSentAt: bo.probeSentAt || 0, gone: bo.gone, lastAlive: bo.lastAlive || 0 }, now, SERIES_WATCH);
    if (a.do === 'probe') {
      bo.probes = (bo.probes || 0) + 1; bo.probeSentAt = now; ROOMS.probes++;
      send('|/crq roominfo ' + bo.id);
      event('series_probe_sent', { room: bo.id, n: bo.probes, why: a.why });
      say('series ' + bo.id + ' ' + a.why + ' — probing the room (' + bo.probes + '/' + SERIES_WATCH.maxProbes + ')');
    } else if (a.do === 'orphan') orphanSeries(bo, a.why);
  }
}
/* ORPHANING (only a series whose room is GONE, or whose probes go unanswered — never one that answers alive). It never
 * lets a second series run beside it: the bestof room and every FINISHED battle of it are left; a battle of it that is
 * still LIVE stays tracked and played, and blocks the next search (openSeries counts it) until it ends. Nothing is ever
 * forfeited. If the orphaned series speaks again, it is taken back (unorphanSeries) and gets its row. */
function orphanSeries(bo, why) {
  if (bo.done) return;
  bo.done = true; bo.orphaned = why;
  const live = liveBattles().filter(B => B.bestof === bo.id).map(B => B.id);
  const rec = { id: bo.id, why, at: new Date().toISOString(), team: bo.team, arm: bo.arm, games_seen: bo.gnums.size, live_battles_kept: live, forfeited: 0 };
  ROOMS.orphans.push(rec); STATE.orphans = (STATE.orphans || []).concat([rec]); saveState();
  try { const S = BOOK.get(bo.id); S.orphaned = rec; BOOK.save(S); } catch (e) { /* never fatal */ }
  event('series_orphan', rec);
  say('SERIES ORPHANED ' + bo.id + ' — ' + why + (live.length ? ' (its live battle ' + live.join(', ') + ' is kept and played; no search until it ends)' : ''));
  if (LADDER) LADDER.onSeriesOrphan(bo.id, why);
  send('|/leave ' + bo.id);
  for (const B of [...battles.values()]) if (B.bestof === bo.id && B.ended && !CLOSED.has(B.id) && !STATE.pendingGames?.[B.id]) { CLOSED.add(B.id); send('|/leave ' + B.id); battles.delete(B.id); }
  setTimeout(() => { maybeChallenge('series orphaned'); checkDone(); }, 500);
}
function unorphanSeries(bo, why) {
  if (!bo || !bo.orphaned) return;
  const was = bo.orphaned;
  bo.done = false; bo.orphaned = null; bo.gone = null; bo.lastSeen = Date.now(); bo.probes = 0; bo.probeSentAt = 0; ROOMS.unorphaned++;
  event('series_unorphan', { room: bo.id, why, was });
  say('SERIES TAKEN BACK ' + bo.id + ' — ' + why + ' (orphaned for: ' + was + ')');
  send('|/join ' + bo.id);
  if (LADDER) LADDER.onSeriesResume(bo.id, why);
}

function login(challstr) {
  /* the ladder (public AND dry run) always takes the challstr -> assertion path; a dry run posts to the local stand-in */
  if (LOCK.isLocal(SERVER) && !LADDER) { send('|/trn ' + NAME + ',0,'); return; }
  (async () => {
    try {
      const res = await fetch(LADDER ? LOGIN_URL : PUBLIC_LOGIN_URL, { method: 'POST', signal: AbortSignal.timeout(30000),   // a hung login is bounded too
        body: new URLSearchParams({ name: NAME, pass: CRED.pass, challstr }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const json = JSON.parse((await res.text()).replace(/^\]/, ''));
      if (!json.assertion) throw new Error(json.actionerror || 'no assertion');
      send('|/trn ' + NAME + ',0,' + json.assertion);
    } catch (e) { say('LOGIN FAILED: ' + e.message); if (LADDER) LADDER.onLoginFailed(e.message); }   // the password is never in this message
  })();
}

/* ---------------- series control ---------------- */
/* open series + live battles that belong to no open series (an orphaned series' game still being played, a battle whose
 * series room we never saw): the ladder never searches while ANY battle we are in is live */
function openSeries() {
  const open = [...bestofs.values()].filter(b => !b.done);
  const loose = liveBattles().filter(B => !open.some(b => b.id === B.bestof));
  return open.length + loose.length;
}
/* DRILL hang@S (local/dry run only): once S sets are done, this process stops moving — no tick, no series watch — the
 * shape of the aa1 hang, for the SUPERVISOR's watchdog to find (run_ladder.js). Fires once per run: a restarted process
 * reads drillsFired and plays on. */
let HUNG = false;
function hangDrill() {
  if (HUNG) return true;
  const m = /^hang@(\d+)$/.exec(DRILL); if (!m || !LOCK.isLocal(SERVER)) return false;
  if (STATE.setsDone.length < +m[1] || (STATE.drillsFired || []).includes(DRILL)) return false;
  STATE.drillsFired = (STATE.drillsFired || []).concat([DRILL]); saveState();
  HUNG = true; ST.drills.push({ kind: 'hang', set: +m[1], at: Date.now() }); event('drill', { kind: 'hang', set: +m[1] });
  say('DRILL hang after set ' + m[1] + ' — this process stops moving; the supervisor watchdog must restart it');
  return true;
}
function maybeChallenge(why) {
  if (hangDrill()) return;
  if (LADDER) return LADDER.tick(why);
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
  if (LADDER) { send('|/reject ' + from); event('reject_in_ladder_mode', { from }); return; }   // the ladder account plays the ladder only
  if (fmt !== FORMAT_ID) { send('|/reject ' + from); return; }
  if (STATE.setsDone.length + openSeries() >= SETS) { send('|/reject ' + from); return; }
  pendingTeam = pickTeam();
  send('|/utm ' + pendingTeam.packed);
  send('|/accept ' + from);
  say('accepted ' + from + ' with team ' + pendingTeam.id);
  event('accept', { from, team: pendingTeam.id });
}
/* the ladder ticks even when logged out (its relogin bound needs the clock), and the series watch runs on every pass */
setInterval(() => { if (loggedIn || LADDER) maybeChallenge('retry'); watchSeries(); }, Math.min(5000, Math.max(500, Math.floor(SERIES_WATCH.probeMs / 2)))).unref();

function handleBestof(room, line, p, cmd) {
  let bo = bestofs.get(room);
  if (!bo) {
    /* the same series under its other id (content reached us under the old id before the rename): move it, never a new k */
    const twin = [...bestofs.keys()].find(k => k !== room && !bestofs.get(k).done && LADDER_LIB.canonRoom(k) === LADDER_LIB.canonRoom(room));
    if (twin) { rekeyBestof(twin, room); bo = bestofs.get(room); }
  }
  if (!bo) {
    const LR = LADDER ? LADDER.onSeriesStart(room) : null;   // ladder: this series' pre-committed arm and rotation team
    const known = BOOK.get(room);   // a restarted process: the series book says which pool team this set is using
    const team = (known && known.team && POOL.teams.find(t => t.id === known.team)) || (LADDER ? LADDER.teamOf(room) : pendingTeam);
    bo = { id: room, done: false, gnums: new Set(), confirmed: new Set(), started: Date.now(), team: team ? team.id : null, reloaded: !!(known && known.reloaded),
           arm: LR ? LR.arm : null };
    bestofs.set(room, bo);
    if (team) seriesTeam.set(room, team);
    if (TIMER === 'on') send(room + '|/timer on');
    event('series_join', { room, team: bo.team });
    const S0 = BOOK.get(room); if (!S0.team && bo.team) { S0.team = bo.team; S0.policy = POLICY; BOOK.save(S0); }
    if (LR) say('LADDER series ' + room + ' k=' + LR.k + ' arm ' + LR.arm + ' (' + JSON.stringify(LR.arm_config) + ') team ' + bo.team + (LR.resumed ? ' [resumed]' : ''));
  }
  bo.lastSeen = Date.now(); bo.probes = 0; bo.probeSentAt = 0;
  if (/\/confirmready/.test(line)) confirmReady(room, line);
  if (LADDER && cmd === 'raw') LADDER.onRaw(room, line);
  { const q = ENDINGS.quitLine(line); if (q) { bo.quitLines = (bo.quitLines || []).concat([line]); event('series_quit_line', { room, kind: q.kind, by: q.by, line: line.slice(0, 200) }); } }
  if (cmd === 'win' || cmd === 'tie') {
    if (bo.done) return;
    bo.done = true;
    const winner = cmd === 'win' ? p[2] : null;
    const S = BOOK.get(room);
    S.result = { winner, mine: winner != null && toID(winner) === toID(NAME), ended: new Date().toISOString() };
    S.provenance = PROV;
    S.clock = S.games.map(g => ({ gnum: g.gnum, used_s: g.clockUsed, bankLeft: g.bankLeft }));
    BOOK.save(S);
    STATE.setsDone.push({ id: room, winner, mine: S.result.mine, games: S.games.length, team: bo.team, arm: bo.arm });
    saveState();
    if (LADDER) LADDER.onSeriesEnd(room, S.result);
    say('SERIES OVER ' + room + ' — winner ' + winner + ' (' + STATE.setsDone.length + '/' + SETS + ')');
    event('series_end', { room, winner });
    /* the end_reason waits for the last game's own |win| (another room, another update): settled 3 s on, and again by the
     * ladder when it writes the row */
    setTimeout(() => settleSeriesEnd(room), 3000);
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

/* HOW THE SERIES ENDED (endings.js seriesEnd) over the series book's games; saved as the book's `end` and returned to the
 * ladder for its row. A walkaway_me (we left between games) is a self quit: counted and, on the ladder, a HALT. */
function settleSeriesEnd(room) {
  const S = BOOK.get(room); if (!S || !S.result) return null;
  const bo = bestofs.get(room);
  const live = [...battles.values()].filter(B => B.bestof === room && !B.ended && B.gnum != null).sort((a, b) => b.gnum - a.gnum)[0] || null;
  const end = ENDINGS.seriesEnd(S.games, S.result, NAME, { quitLines: bo && bo.quitLines, liveGnum: live ? live.gnum : null, liveTurn: live ? live.turn : 0 });
  end.games_end = S.games.map(g => ({ gnum: g.gnum, room: g.room, mine: g.mine != null ? g.mine : (g.winner == null ? null : g.winner === g.me), end_reason: g.end_reason || null, end_turn: g.end_turn != null ? g.end_turn : null, at_preview: g.at_preview != null ? g.at_preview : null }));
  S.end = end; BOOK.save(S);
  if (end.end_reason === 'walkaway_me' && !S.selfQuitCounted) {
    S.selfQuitCounted = true; BOOK.save(S);
    selfQuit({ level: 'series', room, bestof: room, end_reason: end.end_reason, end_game: end.end_game, end_raw: end.end_raw });
  }
  return end;
}
/* ONE of OUR games or series ended by our own forfeit, timeout or walkaway: never allowed. Counted, logged, and the ladder halts. */
function selfQuit(x) {
  ST.selfQuits.push(Object.assign({ at: new Date().toISOString() }, x));
  event('self_quit', x);
  say('SELF QUIT (' + x.end_reason + ') in ' + x.room + ' — this must never happen' + (LADDER ? '; the ladder HALTS' : ''));
  if (LADDER && LADDER.onSelfQuit) LADDER.onSelfQuit(x.bestof || x.room, x);
}

let doneWaitStart = 0;
function checkDone() {
  if (LADDER) return;   // the ladder loop decides when to exit (ladder.js nextAction)
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
           raw: [], ratingsBefore: {}, ratings: [], rated: false, decisions: 0, preview: null, packed: {},
           /* chosen vs applied (solver/rotom/applied.js): decisions waiting for their turn to resolve, and the game's tally */
           pending: [], toVerify: [], tally: new APPLIED.Tally(), latestReq: null, turnLineIdx: -1, timerSent: false, timerAck: false, timerLines: [], resendAt: 0 };
}
function handleBattle(room, line, p, cmd) {
  let B = battles.get(room);
  if (CLOSED.has(room)) return;
  if (B && B.ended) {   // a finished room we stay in while its replay saves: only the rating line and errors matter
    const r = parseRatingLine(line); if (r) B.ratings.push(r);
    if (LADDER && cmd === 'raw') LADDER.onRaw(B.bestof, line);   // the series' rating lines land after the last game ends
    if (cmd === 'error') SAVER.onRoomError(room, p.slice(2).join('|'));
    return;
  }
  if (!B) { B = newBattle(room); B.rejoined = STATE.restarts > 0; battles.set(room, B); JOINING.delete(room); event('battle_join', { room }); if (TIMER === 'on') { send(room + '|/timer on'); B.timerSent = true; B.timerSentAt = Date.now(); } }
  { const bo = seriesOfBattle(B); if (bo) { bo.lastSeen = Date.now(); bo.probes = 0; bo.probeSentAt = 0;   // battle traffic keeps its series alive
      if (bo.orphaned && !/room gone/.test(bo.orphaned) && cmd !== 'deinit' && cmd !== 'noinit') unorphanSeries(bo, 'its battle ' + room + ' spoke'); } }
  if (cmd === 'init') {   // a (re)join replays the whole log: start the room's public record over, keep what we sent
    runVerify(B, true);   // turns already closed are checked against the log they closed on, before it is replaced
    const keep = B; B = newBattle(room); B.sent = keep.sent; B.clockUsed = keep.clockUsed; B.bestof = keep.bestof; B.gnum = keep.gnum; B.timerOn = keep.timerOn; B.preview = keep.preview; B.adapt = keep.adapt;
    B.tally = keep.tally; B.timerSent = keep.timerSent; B.timerSentAt = keep.timerSentAt; B.timerAck = keep.timerAck; B.timerLines = keep.timerLines; B.latestReq = keep.latestReq;
    /* the replayed log re-indexes every line: a decision still waiting for its turn cannot be checked against it */
    for (const pd of keep.pending) recordVerdict(B, { kind: pd.kind, slot: null, status: 'unverifiable', chosen: pd.choice, applied: null, why: 'the room was re-joined before its turn resolved' }, pd);
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
    if (/Battle timer is ON|also wants the timer to be on/.test(line)) { B.timerLines.push(line); if (APPLIED.verifyTimer({ sent: true, name: NAME, lines: [line] }).status === 'applied') B.timerAck = true; }
    if (B.clock.onInactive(line, Date.now(), NAME)) B.lastTimeLeft = { at: Date.now(), line };
    if (/lost due to inactivity|lost the series due to inactivity/.test(line) && new RegExp(NAME, 'i').test(line)) { ST.timeouts.push({ room, kind: 'forfeit', line }); }
    return;
  }
  if (/lost due to inactivity/.test(line) && toID(line).includes(toID(NAME))) ST.timeouts.push({ room, kind: 'forfeit', line: line.slice(0, 200) });
  if (LADDER && cmd === 'raw') LADDER.onRaw(B.bestof, line);   // `NAME's rating: A &rarr; B` after a rated series
  if (cmd === 'error') {
    const txt = p.slice(2).join('|');
    /* a resend we made (a throttle notice, a repair) that the server already had: "too late" / "nothing to choose" is the
     * server confirming the FIRST copy arrived — counted, never an invalid choice or a timeout */
    if (/\[Invalid choice\]/.test(txt) && /too late|nothing to choose|Can't undo/i.test(txt) && B.resendAt && Date.now() - B.resendAt < 15000) {
      THR.redundant_resends++; event('resend_redundant', { room, txt: txt.slice(0, 160) }); return;
    }
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
    if (req.wait) { B.req = null; setImmediate(() => runVerify(B)); return; }   // nothing to decide: check the closed turns now
    if (B.req && B.req.rqid !== req.rqid && !B.sent.has(B.req.rqid)) { ST.superseded++; ST.timeouts.push({ room, kind: 'superseded', rqid: B.req.rqid }); }
    const again = B.req && B.req.rqid === req.rqid;
    /* a request handled right after an idle GC may have ARRIVED during it (the GC blocks the event loop): charge the
     * clock from the GC's start, so the budget never counts time the server already spent */
    if (!again) { const now = Date.now(); B.reqAt = IDLE_GC.t1 && now - IDLE_GC.t1 < 100 ? Math.min(now, IDLE_GC.t0) : now; }
    B.req = req; B.latestReq = req;
    for (const pd of B.toVerify) if (!pd.nextReq && req.rqid > pd.rqid) pd.nextReq = req;   // the second witness (O(1) per closed decision)
    /* the SAME request again = the server re-sent it on a (re)join: if it was already answered, answer it again */
    if (B.sent.has(req.rqid)) B.req._needResend = true;
    if (req.side && req.side.id) B.me = req.side.id;
    if (DUMP_REQ && !again && (ST.dumped = (ST.dumped || 0)) < DUMP_REQ) {
      ST.dumped++;
      try { fs.writeFileSync(path.join(OUT, 'fixture-' + toID(NAME) + '-' + ST.dumped + '.json'), JSON.stringify({ room, me: B.me, names: B.names, turn: B.turn, sheets: B.sheets, lines: B.lines, req })); } catch (e) { /* never fatal */ }
    }
    return;
  }
  if (cmd === 'player' && p[2] && p[3]) { B.names[p[2]] = p[3]; if (toID(p[3]) === toID(NAME)) B.me = p[2]; if (p[5] && /^\d+$/.test(p[5])) B.ratingsBefore[p[2]] = +p[5]; if (LADDER && B.bestof) LADDER.onPlayer(B.bestof, p[2], p[3]); }
  if (cmd === 'showteam' && p[2]) { B.packed[p[2]] = p.slice(3).join('|'); try { B.sheets[p[2]] = parseShowteam(p.slice(3).join('|')); } catch (e) { event('showteam_parse_error', { room, err: e.message }); } }
  if (cmd === 'turn') { B.turn = +p[2]; maybeDrill(B); }
  if (NOT_PUBLIC.has(cmd)) { if (cmd === 'win' || cmd === 'tie') { /* never here: win/tie are public */ } return; }
  B.lines.push(line);
  if (cmd === 'turn' || cmd === 'win' || cmd === 'tie') closePending(B);
  if (cmd === 'turn') B.turnLineIdx = B.lines.length - 1;
  if (cmd === 'win' || cmd === 'tie') endBattle(B, cmd === 'win' ? p[2] : null);
}
/* ---------------- chosen vs applied (solver/rotom/applied.js) ----------------
 * A decision's turn CLOSES at the next |turn| (or the game's end): closePending only records where its lines start and end
 * (O(1)). The server's next request — the second witness — arrives after those lines and is attached when it does. The
 * CHECK itself (runVerify) never runs on the decision path: it runs right after our next choice is on the wire
 * (setImmediate after decide's send), on a wait request (nothing to decide), or at the end of the game. Its cost is
 * measured (ST.verifyCost) and reported, and the decision budget never pays it.
 * A move decision made before the previous turn's lines had all arrived is re-anchored after that turn's |turn| line, so
 * an earlier turn's |move| is never read as this one's. */
function closePending(B) {
  const end = B.lines.length;
  for (const pd of B.pending.splice(0)) {
    pd.start = pd.kind === 'move' ? Math.max(pd.idx, B.turnLineIdx + 1) : pd.idx;
    pd.end = end; pd.closedAt = Date.now();
    B.toVerify.push(pd);
  }
}
function runVerify(B, force) {
  if (!B.toVerify.length) return;
  const t0 = process.hrtime.bigint();
  const keep = [];
  let n = 0;
  for (const pd of B.toVerify) {
    if (!force && !pd.nextReq && Date.now() - pd.closedAt < 5000) { keep.push(pd); continue; }   // wait for the second witness
    n++;
    let vs;
    try { vs = APPLIED.verifyDecision({ me: B.me, req: pd.req, choice: pd.choice, lines: B.lines.slice(pd.start, pd.end), nextReq: pd.nextReq || null, before: B.lines, beforeEnd: pd.start }); }
    catch (e) { vs = [{ kind: pd.kind, slot: null, status: 'mismatch', chosen: pd.choice, applied: null, why: 'the verifier threw: ' + String(e.message).slice(0, 120) }]; }
    for (const v of vs) recordVerdict(B, v, pd);
  }
  B.toVerify = keep;
  if (n) { const ms = Number(process.hrtime.bigint() - t0) / 1e6, c = ST.verifyCost; c.runs++; c.decisions += n; c.ms += ms; if (ms > c.max_ms) c.max_ms = +ms.toFixed(3); }
}
function recordVerdict(B, v, pd) {
  const ctx = { room: B.id, bestof: B.bestof, gnum: B.gnum, rqid: pd ? pd.rqid : null, turn: pd ? pd.turn : B.turn, choice: pd ? pd.choice : null };
  B.tally.add(v, ctx); ST.applied.add(v, ctx);
  if (v.kind === 'preview') event('preview_verify', { room: B.id, ok: v.status === 'applied', status: v.status, expected: v.expected, actual: v.actual, why: v.why });
  if (v.status === 'mismatch') {
    event('applied_mismatch', Object.assign({}, ctx, v));
    say('APPLIED MISMATCH ' + B.id.slice(-12) + ' ' + v.kind + (v.slot != null ? ' slot ' + v.slot : '') + ': chose ' + v.chosen + ', server did ' + v.applied + ' — ' + v.why);
    if (LADDER && B.bestof) LADDER.onMismatch(B.bestof, v.kind + ': chose ' + v.chosen + ', server ' + v.applied + ' (' + v.why + ')');
  }
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
    else { writeSummary(); process.exit(70); }   // 70, not 3: 3 is "lock held", which a ladder supervisor must not restart
  }
}

function endBattle(B, winnerName) {
  if (B.ended) return;
  B.ended = true;
  B.endedAt = Date.now();
  ST.games++;
  closePending(B); runVerify(B, true);   // anything still waiting is judged against the log as it ended
  { let tv = APPLIED.verifyTimer({ sent: B.timerSent, name: NAME, lines: B.timerLines });
    /* a game that ended within 10 s of our /timer on (a replayed log, a forfeit at preview) gave the server no turn to answer: unverifiable, never applied */
    if (tv && tv.status === 'mismatch' && B.timerSentAt && B.endedAt - B.timerSentAt < 10000) tv = Object.assign(tv, { status: 'unverifiable', why: 'the game ended ' + (B.endedAt - B.timerSentAt) + ' ms after /timer on was queued' });
    if (tv) recordVerdict(B, tv, null); }
  clearTimeout(B.timer);
  let parsed = null, parsedAll = null; try { parsedAll = parseGame({ id: B.id, log: B.lines.join('\n') }); parsed = parsedAll.game; } catch (e) { event('parse_end_error', { room: B.id, err: e.message }); }
  let mega = null; try { mega = MR.parsedGame(parsedAll, B.me); } catch (e) { event('mega_count_error', { room: B.id, err: e.message }); }
  ST.mega.games++;
  if (mega && mega.mine) {
    const opp = mega[B.me === 'p1' ? 'p2' : 'p1'];
    ST.mega.parsed++;
    if (mega.mine.capable) { ST.mega.capable++; if (mega.mine.mega) { ST.mega.megas++; ST.mega.turn[mega.mine.mega_turn] = (ST.mega.turn[mega.mine.mega_turn] || 0) + 1; ST.mega.delay[mega.mine.delay] = (ST.mega.delay[mega.mine.delay] || 0) + 1; } }
    if (opp && opp.capable) { ST.mega.opp_capable++; if (opp.mega) ST.mega.opp_megas++; }
  }
  const winner = winnerName == null ? null : (toID(B.names.p1) === toID(winnerName) ? 'p1' : 'p2');
  /* HOW this game ended, from its own lines (endings.js): a forfeit, the battle timer, or normal */
  const END = ENDINGS.gameEnd(B.lines, NAME);
  const endF = { end_reason: END.end_reason, end_by: END.end_by, end_turn: END.end_turn, at_preview: END.at_preview, end_raw: END.end_raw };
  ST.endReasons[END.end_reason] = (ST.endReasons[END.end_reason] || 0) + 1;
  if (ENDINGS.SELF_QUIT.has(END.end_reason)) selfQuit({ level: 'game', room: B.id, bestof: B.bestof, gnum: B.gnum, end_reason: END.end_reason, end_turn: END.end_turn, end_raw: END.end_raw });
  const brought = {};
  if (parsed) for (const s of ['p1', 'p2']) { const L = parsed.leads[s] || []; brought[s] = L.concat((parsed.brought_seen[s] || []).filter(i => !L.includes(i))); }
  if (B.bestof && parsed) {
    BOOK.recordGame(B.bestof, { room: B.id, gnum: B.gnum, me: B.me, leads: parsed.leads, brought, winner, players: B.names,
                                turns: parsed.turns_played, clockUsed: +(B.clockUsed / 1000).toFixed(1), bankLeft: B.clock.last ? B.clock.last.bank : null,
                                mine: winner == null ? null : winner === B.me, ...endF });
    if (bestofs.get(B.bestof) && bestofs.get(B.bestof).done) settleSeriesEnd(B.bestof);   // the series ended before this game's |win| arrived
  }
  event('game_end', { room: B.id, bestof: B.bestof, gnum: B.gnum, winner, me: B.me, timerOn: B.timerOn, clockUsed_s: +(B.clockUsed / 1000).toFixed(1), ...endF });
  if (LADDER && B.bestof) for (const sd of ['p1', 'p2']) LADDER.onPlayer(B.bestof, sd, B.names[sd]);
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
    ...endF,
    mega,
    /* chosen vs applied for this game: every check of every decision, and each mismatch (solver/rotom/applied.js) */
    applied: B.tally.toJSON(),
    rated: B.rated, rating_before: Object.keys(B.ratingsBefore).length ? B.ratingsBefore : null, rating_after: null,
    clock: { used_s: +(B.clockUsed / 1000).toFixed(1), bank_left_s: B.clock.last ? +(+B.clock.last.bank).toFixed(1) : null },
    decisions: { n: B.decisions, log: relRoot(gameDecF(B.id)), run_log: relRoot(LOGF) },
    battle_log: relRoot(gameLogF(B.id)),
    replay: null, provenance: PROV,
    ladder: LADDER && B.bestof ? { arm: LADDER.armOf(B.bestof), dry_run: DRY_RUN, release: RELEASE_ID } : null,
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
  /* ladder: stay in the finished room long enough for the series' rating lines (posted in the deciding game's room) */
  const stay = LADDER ? Math.max(200, 22000 - waited) : 200;
  setTimeout(() => { CLOSED.add(B.id); send('|/leave ' + B.id); battles.delete(B.id); }, stay);
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
  /* ladder: this series' pre-committed arm decides the policy and may cap the search; the clock still binds below it */
  const ARM = LADDER && B.bestof ? LADDER.armOf(B.bestof) : null;
  const POL = ARM ? ARM.policy : POLICY;
  if (ARM && ARM.max_ms > 0 && kind !== 'preview' && bud.ms > ARM.max_ms) { bud.ms = ARM.max_ms; bud.cappedBy = 'arm'; }
  if (bud.from === 'rule') ST.noTimerLine++;
  /* the adaptive clock replaces the fixed share for a searching move or forced switch; the turn cap and the bank still bind */
  const ADC = kind !== 'preview' && SEARCHES.includes(POL) ? (ARM && ARM.adaptive ? ARM.adaptive : (ADAPT_TARGET_MS > 0 ? { targetMs: ADAPT_TARGET_MS } : null)) : null;
  let adRec = null;
  if (ADC) {
    if (!B.adapt) { B.adapt = ADAPT.create(Object.assign({ minSearchMs: MIN_SEARCH_MS, marginS: MARGIN_S, reserveS: RESERVE_S }, ADC, { counters: ST.adapt || undefined })); B.adapt.newGame(); ST.adapt = B.adapt.COUNTERS; }
    const pl = B.adapt.plan({ kind, bankS: bud.bank, turnLeftS: bud.turnLeft, eRem: bud.eRem, eRemHi: B.clock.table.eRemHi ? B.clock.table.eRemHi(B.turn || 1) : bud.eRem });
    bud.fixedMs = bud.ms; bud.ms = pl.hardMs; bud.lowBank = pl.lowBank; bud.adaptive = pl;
    adRec = { kind, plan: pl };
  }
  const rec = { t: t0, room: B.id, bestof: B.bestof, gnum: B.gnum, turn: B.turn, kind, rqid: req.rqid, policy: POL, arm: ARM ? ARM.id : null, budget: bud, chain: [] };
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
  let first = POL;
  if (SEARCHES.includes(POL) && bud.lowBank) { first = 'prior'; fb('clock:' + POL + '->prior'); rec.chain.push({ policy: POL, fail: 'budget ' + bud.ms + ' ms under the search floor' }); }
  /* a rejoined room with no server clock line yet: the bank is UNKNOWN (a restart lost it), so do not search on a guess */
  else if (SEARCHES.includes(POL) && bud.from === 'rule' && B.rejoined) { first = 'prior'; fb('clock:unknown-bank->prior'); rec.chain.push({ policy: POL, fail: 'rejoined with no server clock line yet' }); }

  if (kind === 'preview') {
    const S = B.bestof ? BOOK.get(B.bestof) : null;
    const team = (B.bestof && seriesTeam.get(B.bestof)) || null;
    const mySheet = B.sheets[B.me] || [];
    /* the TEAM is a choice too (the /utm before /search): the sheet the server shows for us must be the series' team */
    if (team && B.packed[B.me] && !B.teamChecked) {
      B.teamChecked = true;
      const sp = packed => String(packed || '').split(']').map(m => { const x = m.split('|'); return toID(x[1] || x[0]); }).filter(Boolean).sort().join(',');
      const want = sp(team.packed), got = sp(B.packed[B.me]);
      recordVerdict(B, { kind: 'team', slot: null, status: want === got ? 'applied' : 'mismatch', chosen: team.id + ' ' + want, applied: got, why: want === got ? null : 'the server shows a different team than the series\' /utm' }, { rqid: req.rqid, turn: 0, choice: 'team ' + team.id });
    }
    const posOfSheet = s => { const r = mySheet[s]; if (!r) return s + 1; const j = req.side.pokemon.findIndex(pk => String(pk.ident).replace(/^p[12]:\s*/, '') === r.nick); return j >= 0 ? j + 1 : s + 1; };
    const d = { req, coin, sheets: B.sheets, me: B.me, budgetMs: Math.min(bud.ms, ARM && ARM.preview_max_ms > 0 ? ARM.preview_max_ms : PREVIEW_MAX_MS), teamBring: team ? team.bring : null,
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
        world = WB.build({ row, sheets: B.sheets, me: B.me, req, oppGuess: guess, lines: B.lines });
        world.xatuBack = bt;
        rec.world = { ok: true, turn: row.turns.length, notes: world.notes, xatu: bt ? bt.map(x => [x.pair.join('+'), +x.p.toFixed(3)]) : null };
      } catch (e) { ST.worldErrors++; rec.world = { ok: false, err: String(e && e.message || e).slice(0, 200) }; }
    }
    const d = () => ({ req, world, coin, budgetMs: Math.max(0, bud.ms - (Date.now() - t0)), xatuBack: world && world.xatuBack,
                       onPass: adRec && kind === 'move' ? B.adapt.stopper(adRec.plan, adRec) : undefined });
    const run = (name) => () => (kind === 'switch' ? P.forceSwitch(name, d()) : P.move(name, d()));
    tryPolicy(first, run(first));
    if (SEARCHES.includes(first)) tryPolicy('prior', run('prior'));
    tryPolicy('heuristic', () => ({ choice: RQ.heuristic(req) }));
  }
  if (!choice) { choice = 'default'; used = 'default'; fb('default'); }
  if (used !== POL) fb('used:' + used);
  const ms = Date.now() - t0;
  const ok = send(B.id + '|/choose ' + choice + '|' + req.rqid);
  /* checked after its turn closes (closePending / runVerify, off the decision path): what the server did, against this choice */
  if (choice === 'default') recordVerdict(B, { kind: kind === 'preview' ? 'preview' : 'default', slot: null, status: 'unverifiable', chosen: 'default', applied: null, why: 'the last-resort default: the server picks' }, { rqid: req.rqid, turn: B.turn, choice });
  else B.pending.push({ rqid: req.rqid, req, choice, kind, turn: B.turn, idx: B.lines.length, t: Date.now() });
  B.sent.set(req.rqid, choice);
  if (kind === 'preview') B.preview = choice;
  B.deciding = false;
  const since = Date.now() - B.reqAt;
  B.clockUsed += since; B.clock.spent(since);
  if (adRec) {
    const searched = used === POL && !(info && info.forced);
    if (searched && adRec.stop === 'none') adRec.stop = 'hard';
    if (searched && !adRec.stop) adRec.stop = kind === 'switch' ? 'switch' : 'hard';
    B.adapt.spent(since, searched, adRec);
    rec.adapt = { stop: searched ? adRec.stop : 'not-searched', checks: adRec.checks || 0, state: adRec.state || null, credit_after_ms: Math.round(B.adapt.credit) };
  }
  if (B.clock.last && since / 1000 > B.clock.last.turnLeft && B.clock.last.at >= B.reqAt - 2000) { ST.sentLate++; ST.timeouts.push({ room: B.id, kind: 'sent-late', rqid: req.rqid, ms: since }); }
  ST.decisions++; ST.byKind[kind + ':' + used] = (ST.byKind[kind + ':' + used] || 0) + 1;
  ST.ms[kind].push(ms); ST.budget.push(bud.ms);
  rec.used = used; rec.choice = choice; rec.ms = ms; rec.sinceRequest_ms = since; rec.queued = ok;   // QUEUED on an open socket; applied is checked from the server's lines
  rec.bank_before_s = bud.bank; rec.bank_after_s = +(bud.bank - since / 1000).toFixed(1);
  if (info) rec.info = compact(info);
  B.decisions++;
  const line = JSON.stringify(rec) + '\n';
  try { fs.appendFileSync(LOGF, line); } catch (e) { /* never fatal */ }
  try { fs.appendFileSync(gameDecF(B.id), line); } catch (e) { /* never fatal */ }
  if (!ok) event('send_failed', { room: B.id, rqid: req.rqid });
  /* THE BETWEEN-DECISION GC. A MILTANK decision allocates a world copy per playout; a major GC landing inside the NEXT
   * decision stopped it for 1.1-1.6 s on a loaded core. So after a searched choice is SENT, collect off the clock, on the
   * next event-loop turn (the choice is already on the wire). Counted: ST.idleGc { n, ms, max }. */
  if (SEARCHES.includes(first) && ok) setImmediate(idleGc);
  setImmediate(() => runVerify(B));   // the choice is on its way: check the turns that closed, off the clock
}
const IDLE_GC = { t0: 0, t1: 0 };
function idleGc() {
  IDLE_GC.t0 = Date.now();
  const ms = SEARCH_MOD.collectIdle();
  IDLE_GC.t1 = Date.now();
  const g = ST.idleGc || (ST.idleGc = { n: 0, ms: 0, max: 0, refused: 0 });
  if (ms == null) { g.refused++; return; }
  g.n++; g.ms += ms; if (ms > g.max) g.max = ms;
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
  const out = { name: NAME, policy: POLICY, server: SERVER, pid: process.pid, restarts: STATE.restarts, flags: { send_gap_ms: SEND_GAP_MS, max_mismatches: +flag('max-mismatches', 3), max_ms: MAX_MS, preview_max_ms: PREVIEW_MAX_MS, margin_s: MARGIN_S, reserve_s: RESERVE_S, min_search_ms: MIN_SEARCH_MS, timer: TIMER, seed: SEED, drill: DRILL || null, priority: PRIORITY, priority_set: PRIORITY_SET }, idle_gc: ST.idleGc || { n: 0, ms: 0, max: 0, refused: 0 }, adaptive: ST.adapt || null, adaptive_target_ms: ADAPT_TARGET_MS || null,
    clock_rule: new Clock(Object.assign({ format: FORMAT_ID }, clockOpts)).rule,
    sets: STATE.setsDone, decisions: ST.decisions, by_kind: ST.byKind,
    decision_ms: { preview: stats(ST.ms.preview), move: stats(ST.ms.move), switch: stats(ST.ms.switch) }, budget_ms: stats(ST.budget),
    timeouts: ST.timeouts, invalid: ST.invalid, unavailable: ST.unavailable, fallbacks: ST.fallbacks, crashes_caught: ST.crashesCaught,
    disconnects: ST.disconnects, reconnects: ST.reconnects, rejoins: ST.rejoins, resent: ST.resent, drills: ST.drills,
    mega: Object.assign({}, ST.mega, { rate: ST.mega.capable ? +(ST.mega.megas / ST.mega.capable).toFixed(4) : null, ci95: MR.wilson(ST.mega.megas, ST.mega.capable),
      human_rate: MR.HUMAN_RATE, floor: MR.floor(), below_floor: ST.mega.capable >= MR.MIN_CAPABLE && MR.wilson(ST.mega.megas, ST.mega.capable)[1] < MR.floor() }),
    rooms: { renames: ROOMS.renames, ignored_noinit: ROOMS.ignoredNoinit, skipped_old_ids: ROOMS.skippedOldIds, probes: ROOMS.probes, orphans: ROOMS.orphans, watch: SERIES_WATCH,
             dup_joins_skipped: ROOMS.dupJoins, unlisted_battles: ROOMS.unlisted, alive_answers: ROOMS.aliveAnswers, repairs: ROOMS.repairs, unorphaned: ROOMS.unorphaned },
    /* chosen vs applied, the throttle and the send queue: a capability that cannot prove it ran is assumed broken */
    applied: ST.applied.toJSON(), preview: ST.applied.by_kind.preview || { chosen: 0, applied: 0, explained_diff: 0, mismatch: 0, unverifiable: 0 },
    throttle: THR, send_queue: SENDQ.summary(),
    applied_cost: Object.assign({}, ST.verifyCost, { ms: +ST.verifyCost.ms.toFixed(2), mean_ms_per_run: ST.verifyCost.runs ? +(ST.verifyCost.ms / ST.verifyCost.runs).toFixed(3) : null,
      where: 'after the choice is sent (setImmediate), on a wait request, or at game end — never inside a decision budget' }),
    end_reasons: ST.endReasons, self_quits: ST.selfQuits,
    timer_on_seen: ST.timerOnSeen, games: ST.games, game_records: ST.gameRecords || 0, games_file: GAMES_FILE, replays: SAVER.COUNTERS, world_errors: ST.worldErrors, decisions_without_time_line: ST.noTimerLine,
    preview_sheet_wait_ms: stats(ST.previewSheetWaitMs),
    counters: { policy: P.COUNTERS, world: WB.COUNTERS, prior: PA.COUNTERS, rollout: R.COUNTERS, api: API.COUNTERS },
    provenance: PROV,
    ladder: LADDER ? { plan: LADDER.plan(), state: (({ k, consecErrors, errors, guard, incidents, halted, searches, done, starts, orphans }) => ({ k, consecErrors, errors: errors.slice(-10), guard, incidents, halted, searches, done, starts, orphans }))(LADDER.state()), series_file: LADDER.seriesFile } : null,
    netguard: NETGUARD ? require('./netguard.js').stats() : null };
  try { fs.writeFileSync(path.join(OUT, 'summary-' + toID(NAME) + (STATE.restarts ? '-r' + STATE.restarts : '') + '.json'), JSON.stringify(out, null, 1)); } catch (e) { /* never fatal */ }
  return out;
}
let sigints = 0;
process.on('SIGINT', () => {
  /* ladder: the FIRST Ctrl+C is a graceful stop (no new search; the open series is played out); a second one exits now,
   * and an open game is then left to the server's DC timer — the only way ROTOM ever loses a game it did not play */
  if (LADDER && ++sigints === 1 && openSeries() > 0) { say('SIGINT — stopping after this series (Ctrl+C again to exit NOW and leave the game to the timer)'); LADDER.requestStop('SIGINT'); return; }
  stopping = true; STATE.cleanExit = !openSeries(); saveState(); writeSummary(); LOCKH.release(); process.exit(0);
});
setInterval(writeSummary, 30000).unref();

connect();
