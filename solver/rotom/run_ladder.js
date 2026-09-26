/* solver/rotom/run_ladder.js — start, watch, stop and kill ROTOM's ladder mode. Runbook: solver/rotom/LADDER.md.
 *
 *   PUBLIC (Will's OK, every time):
 *     node solver/rotom/run_ladder.js --public --name medicham32 --release <id> --arms <file> --ladder-seed <s> --sets <N>
 *          [--out <dir>] [--max-errors 3] [--max-hours H] [--guard willhoop] [--guard-mode online|battle]
 *   DRY RUN (local server, same client code path, zero public traffic):
 *     node solver/rotom/run_ladder.js --dry-run --release <id> --arms solver/rotom/arms/dryrun-fast.json --ladder-seed <s>
 *          --sets 10 [--port 8795] [--guard-window 0:40] [--tag name]
 *   STOP (graceful: no new search, the open series is played out):   node solver/rotom/run_ladder.js --stop
 *   KILL (now, by the pids this supervisor recorded; an open game is left to the timer): node solver/rotom/run_ladder.js --kill --out <dir>
 *
 * THE SUPERVISOR IS THE WATCHDOG. It spawns the client(s) through tools\lownode.cmd (BELOWNORMAL, CLAUDE.md), records
 * every pid it started in <out>/pids.json, and restarts a client that exits with anything but a FINAL code:
 *   0 done (set count / STOP / time cap) · 2 refused at start (a guard said no) · 3 lock held · 4 HALTED (consecutive errors).
 * A restarted client re-reads its run state, ladder state and series book, logs in, rejoins the open series and plays it
 * on; it never forfeits. The supervisor also polls the KILL file (solver/out/rotom/KILL by default, or <out>/KILL in a
 * dry run) and, if it appears, kills ITS OWN children by pid (taskkill /PID <pid> /T) — never by image name.
 *
 * THE HANG WATCHDOG (solver/rotom/watchdog.js; the aa1 hangs, docs/_reports/2026-09-25-rotom-series-hang.md). No human
 * restarts this bot, so the supervisor also restarts a client that is ALIVE BUT NOT MOVING: no search, decision or
 * game message (and no guard answer) for --hang-min minutes (default 10) while no game is open. It kills that client by
 * its own pid, logs an incident to <out>/supervisor-incidents.jsonl, and relaunches it through the same resume path as
 * after a crash. It never fires while a game is open. --hang-min 0 turns it off; --max-hang-restarts (default 20) caps it.
 *
 * THE DRY RUN, in addition:
 *   - installs solver/rotom/netguard.js in THIS process, and in the local pokemon-showdown-mc server and every process
 *     it forks (NODE_OPTIONS=--require netguard.js, ROTOM_NETGUARD=<out>/netguard-server.jsonl), and the clients install
 *     it themselves (--dry-run). Every non-loopback connection anywhere in the run is refused and logged.
 *   - starts the server through solver/rotom/local_server.js (the same path as run_local.js): the local config preload
 *     re-points loginserver / routes.root / routes.replays at a local stand-in and refuses the Tor exit-list fetch by
 *     name, so the guard should find NOTHING to refuse (ladder-report.json netguard.totals.public_connects_blocked = 0;
 *     solver/tests/test-rotom-localnet.js). Replays are saved through the stand-in and every game is recorded in
 *     <out>/games.jsonl by the same hooks as every other run (--local-replays --games-file).
 *   - starts solver/rotom/login_stub.js, a local assertion server; the server is told its public key (ROTOM_DRY_PUBKEY),
 *     so the clients' challstr -> assertion login is verified by the server for real.
 *   - runs TWO ladder clients (A and B) that find each other through /search on the local ladder.
 *   - `--guard-window a:b` logs a local user named after the first guarded account in from second a to second b, so
 *     the two-account guard must pause both clients and then resume them.
 *   - writes <out>/ladder-report.json: the series rows, the arms and teams played, the guard pauses, the netguard
 *     totals (blocked, by host) for every process, the replay-free protocol counters from report.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const has = k => argv.includes('--' + k);
const ROOT = path.join(__dirname, '..', '..');
const LIVE_DIR = path.join(ROOT, 'solver', 'out', 'rotom');
const log = (...a) => console.log('[ladder-sup ' + new Date().toISOString().slice(11, 19) + ']', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FINAL = new Set([0, 2, 3, 4]);

/* ---------------- --stop / --kill ---------------- */
if (has('stop')) {
  const f = path.resolve(flag('stop-file', path.join(flag('out', '') || LIVE_DIR, 'STOP')));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, 'STOP requested ' + new Date().toISOString() + '\n');
  console.log('STOP file written: ' + f + '\nThe client finishes the open series (if any), sends no new search, and exits 0. Delete the file before the next start.');
  process.exit(0);
}
if (has('kill')) {
  const out = path.resolve(flag('out', ''));
  const pf = path.join(out, 'pids.json');
  if (!flag('out', '') || !fs.existsSync(pf)) { console.error('--kill needs --out <run dir> holding pids.json (the pids this supervisor started)'); process.exit(2); }
  const P = JSON.parse(fs.readFileSync(pf, 'utf8'));
  fs.writeFileSync(path.join(out, 'KILL'), 'KILL requested ' + new Date().toISOString() + '\n');
  const pids = [P.supervisor].concat((P.clients || []).map(c => c.pid), P.server ? [P.server] : []).filter(Boolean);
  for (const pid of pids) {
    const r = cp.spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8' });
    console.log('taskkill /PID ' + pid + ' /T /F -> ' + (r.status === 0 ? 'killed' : 'not running or refused (' + (r.stderr || r.stdout || '').trim().slice(0, 120) + ')'));
  }
  process.exit(0);
}

/* ---------------- a run ---------------- */
const DRY = has('dry-run');
const PUBLIC = has('public');
if (DRY === PUBLIC) { console.error('exactly one of --dry-run or --public'); process.exit(2); }
const TAG = flag('tag', DRY ? 'dry' : 'ladder');
const OUT = path.resolve(flag('out', path.join(LIVE_DIR, TAG + '-' + new Date().toISOString().replace(/[:.]/g, '-'))));
fs.mkdirSync(OUT, { recursive: true });
const NG = DRY ? require('./netguard.js').install({ log: path.join(OUT, 'netguard-supervisor.jsonl') }) : null;
for (const k of ['release', 'arms', 'ladder-seed', 'sets']) if (!flag(k, '')) { console.error('--' + k + ' is required'); process.exit(2); }
const PASS = ['release', 'arms', 'sets', 'max-errors', 'max-hours', 'guard', 'guard-mode', 'seed', 'margin', 'reserve', 'min-search-ms', 'rotation', 'priority', 'series-idle-ms', 'series-probe-ms', 'series-max-probes', 'max-mismatches', 'send-gap-ms']
  .filter(k => flag(k, null) != null).flatMap(k => ['--' + k, flag(k)]);
const KILLF = path.resolve(flag('kill-file', DRY ? path.join(OUT, 'KILL') : path.join(LIVE_DIR, 'KILL')));
const MAX_RESTARTS = +flag('max-restarts', 5);
const WD = require('./watchdog.js');
const HANG_MS = +flag('hang-min', WD.HANG_MS / 60000) * 60000;
const GAME_OPEN_MS = +flag('hang-game-open-min', WD.GAME_OPEN_MS / 60000) * 60000;
const MAX_HANG_RESTARTS = +flag('max-hang-restarts', 20);
const INCIDENTS = path.join(OUT, 'supervisor-incidents.jsonl');
const incident = (o) => { try { fs.appendFileSync(INCIDENTS, JSON.stringify(Object.assign({ at: new Date().toISOString() }, o)) + '\n'); } catch (e) { /* never fatal */ } };
const PIDS = { supervisor: process.pid, clients: [], server: null, started: new Date().toISOString() };
const savePids = () => fs.writeFileSync(path.join(OUT, 'pids.json'), JSON.stringify(PIDS, null, 1));

function client(name, extra) {
  const st = { name, restarts: 0, hangRestarts: 0, exits: [], done: false, proc: null, watch: WD.create(OUT, name, { hangMs: HANG_MS, gameOpenMs: GAME_OPEN_MS }) };
  const launch = () => {
    st.watch.restarted(Date.now());
    const args = ['/c', path.join('tools', 'lownode.cmd'), 'solver/rotom/rotom.js', '--ladder', '--name', name, '--out', OUT].concat(PASS, extra);
    if (!extra.includes('--ladder-seed')) args.push('--ladder-seed', flag('ladder-seed'));
    const outFd = fs.openSync(path.join(OUT, 'stdout-' + name + '.log'), 'a');
    const p = cp.spawn('cmd.exe', args, { cwd: ROOT, stdio: ['ignore', outFd, outFd], windowsHide: true, env: process.env });
    st.proc = p;
    const rec = PIDS.clients.find(c => c.name === name); if (rec) rec.pid = p.pid; else PIDS.clients.push({ name, pid: p.pid }); savePids();
    p.on('exit', (code) => {
      st.exits.push({ code, at: new Date().toISOString() });
      if (FINAL.has(code)) { st.done = true; st.final = code; log(name + ' exited ' + code + ' (final)'); return; }
      if (st.killed) { st.done = true; return; }
      if (st.hangKill) {   // the watchdog stopped a client that was alive but not moving: resume it
        st.hangKill = false;
        if (st.hangRestarts > MAX_HANG_RESTARTS) { st.done = true; st.failed = true; log(name + ' hang restart limit (' + MAX_HANG_RESTARTS + ') reached, not restarting'); incident({ client: name, kind: 'hang_limit' }); return; }
        log(name + ' — WATCHDOG hang restart #' + st.hangRestarts); setTimeout(launch, 3000); return;
      }
      if (st.restarts >= MAX_RESTARTS) { st.done = true; st.failed = true; log(name + ' exited ' + code + ' — restart limit reached, not restarting'); return; }
      st.restarts++; log(name + ' exited ' + code + ' — WATCHDOG restart #' + st.restarts);
      setTimeout(launch, 3000);
    });
  };
  launch();
  return st;
}
/* the hang watchdog: one poll per client per supervisor pass */
function watchHang(st) {
  if (!HANG_MS || st.done || !st.proc || st.hangKill || st.proc.exitCode !== null) return;
  const v = st.watch.poll(Date.now());
  if (!v.restart) { if (v.openGames && v.openGames.length && v.idleMs >= HANG_MS && !st.warnedOpen) { st.warnedOpen = true; log(st.name + ' ' + v.why); } return; }
  st.warnedOpen = false; st.hangRestarts++; st.hangKill = true;
  const rec = { client: st.name, kind: 'hang', pid: st.proc.pid, idle_s: Math.round(v.idleMs / 1000), last_progress: v.lastProgress ? new Date(v.lastProgress).toISOString() : null, why: v.why, restart: st.hangRestarts };
  incident(rec);
  log('WATCHDOG: ' + st.name + ' (pid ' + st.proc.pid + ') ' + v.why + ' — killing it by pid and resuming');
  cp.spawnSync('taskkill', ['/PID', String(st.proc.pid), '/T', '/F']);
}


async function startDryServer(port) {
  /* ONE start-up path with run_local.js (solver/rotom/local_server.js): the login stand-in (the server's login server:
   * invalidatecss, addreplay), the assertion stub (the clients' /api/login), the local config preload
   * (loginserver / routes.root / routes.replays -> loopback; the Tor exit-list fetch refused by name) and the socket
   * guard in every server process. */
  const S = await require('./local_server.js').start({ port, out: OUT, assertions: true, log, throttle: has('throttle') });   // --throttle: the server's message throttle ON, as live
  return { srv: S.srv, stub: S.stub, mock: S.mock, checkout: S.checkout, stop: S.stop };
}

/* a local user named after a guarded account, online from second a to second b of the run (dry run only) */
function guardWindow(port, who, a, b) {
  const ev = [];
  setTimeout(() => {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/showdown/websocket');
    ws.onmessage = (m) => { if (/\|challstr\|/.test(String(m.data))) { ws.send('|/trn ' + who + ',0,'); ev.push({ t: new Date().toISOString(), what: 'online', who }); log('guard window: ' + who + ' is ONLINE on the local server'); } };
    setTimeout(() => { try { ws.close(); } catch (e) { /* closing */ } ev.push({ t: new Date().toISOString(), what: 'offline', who }); log('guard window: ' + who + ' went offline'); }, (b - a) * 1000);
  }, a * 1000);
  return ev;
}

async function main() {
  const t0 = Date.now();
  const run = { started: new Date().toISOString(), mode: DRY ? 'dry-run (local server)' : 'PUBLIC ladder', argv: process.argv.slice(2), out: OUT, kill_file: KILLF, supervisor_pid: process.pid };
  fs.writeFileSync(path.join(OUT, 'run.json'), JSON.stringify(run, null, 1));
  savePids();
  let S = null, guardEv = [];
  const clients = [];
  if (DRY) {
    const port = +flag('port', 8795);
    S = await startDryServer(port);
    PIDS.server = S.srv && S.srv.pid; savePids();   // recorded so --kill can stop the server tree by its pid too
    const server = 'ws://localhost:' + port + '/showdown/websocket';
    const t = TAG.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8);
    /* replays and per-game records: the SAME hooks as every other run (rotom.js endBattle -> replay.js -> games.jsonl),
     * saved through the local stand-in and written to this run's own games file, never the live ledger */
    const common = ['--dry-run', '--server', server, '--login-url', S.stub.url, '--local-replays', '--games-file', path.join(OUT, 'games.jsonl')];
    const gw = flag('guard-window', '');
    if (gw) { const [a, b] = gw.split(':').map(Number); guardEv = guardWindow(port, (flag('guard', 'willhoop').split(',')[0]), a, b); }
    /* B draws its own arm/team sequence from <seed>-b, so the two sides of a dry-run series differ */
    const drill = k => (flag('drill-' + k, '') ? ['--drill', flag('drill-' + k)] : []).concat(has('hide-' + k) ? ['--hide-next'] : []);   // --hide-a/--hide-b: that side hides its series
    clients.push(client('rotom' + t + 'a', common.concat(drill('a'))));
    await sleep(2000);
    clients.push(client('rotom' + t + 'b', common.concat(['--seed', '2', '--ladder-seed', flag('ladder-seed') + '-b'], drill('b'))));
  } else {
    const name = flag('name', '');
    if (!name) { console.error('--public needs --name <ladder account>'); process.exit(2); }
    clients.push(client(name, ['--public', '--server', flag('server', 'wss://sim3.psim.us/showdown/websocket')]));
  }
  const cap = +flag('timeout-min', DRY ? 180 : 0) * 60000;
  while (!clients.every(c => c.done)) {
    await sleep(2000);
    for (const c of clients) watchHang(c);
    if (fs.existsSync(KILLF)) {
      log('KILL file ' + KILLF + ' — killing my clients by pid');
      for (const c of clients) if (!c.done && c.proc) { c.killed = true; cp.spawnSync('taskkill', ['/PID', String(c.proc.pid), '/T', '/F']); }
      break;
    }
    if (cap && Date.now() - t0 > cap) { log('dry-run time cap — killing my clients by pid'); for (const c of clients) if (!c.done && c.proc) { c.killed = true; cp.spawnSync('taskkill', ['/PID', String(c.proc.pid), '/T', '/F']); } break; }
  }
  await sleep(1500);
  /* the report */
  const R = { run, wall_s: Math.round((Date.now() - t0) / 1000), clients: clients.map(c => ({ name: c.name, restarts: c.restarts, hang_restarts: c.hangRestarts, exits: c.exits, final: c.final, failed: !!c.failed, killed: !!c.killed })),
    watchdog: { hang_min: HANG_MS / 60000, game_open_min: GAME_OPEN_MS / 60000, max_hang_restarts: MAX_HANG_RESTARTS,
                incidents: (() => { try { return fs.readFileSync(INCIDENTS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } })() } };
  try { R.protocol = require('./report.js').aggregate(OUT); } catch (e) { R.protocol = { error: e.message }; }
  const rows = [];
  for (const f of fs.readdirSync(OUT).filter(f => /^ladder-series-.*\.jsonl$/.test(f) && !/\.ends\.jsonl$/.test(f))) for (const l of fs.readFileSync(path.join(OUT, f), 'utf8').split('\n').filter(Boolean)) rows.push(JSON.parse(l));
  R.series_rows = rows.length;
  R.by_arm = {}; R.by_team = {};
  for (const r of rows) { R.by_arm[r.arm] = (R.by_arm[r.arm] || 0) + 1; R.by_team[r.team] = (R.by_team[r.team] || 0) + 1; }
  R.rated_rows = rows.filter(r => r.rated).length;
  /* THE RECORD, per client: RATED series only (endings.js ladderRecord refuses anything else), with and without the series the
   * opponent handed us (forfeit / timeout / walkaway), and our own quits, which must be 0 */
  R.record = {};
  for (const c of [...new Set(rows.map(r => r.client))]) { try { R.record[c] = require('./endings.js').ladderRecord(rows.filter(r => r.client === c), { rated: true, dryRun: DRY }); } catch (e) { R.record[c] = { error: e.message }; } }
  R.residuals = rows.map(r => ({ client: r.client, k: r.k, arm: r.arm, team: r.team, rated: r.rated, end_reason: r.end_reason || null, S: r.S, E: r.E, residual: r.residual, opp: r.opponent, fallbacks: r.during_series.fallbacks, invalid: r.during_series.invalid, timeouts: r.during_series.timeouts }));
  const states = fs.readdirSync(OUT).filter(f => /^ladder-state-.*\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')));
  R.guard = states.map(s => ({ checks: s.guard.checks, pauses: s.guard.pauses, unknown: s.guard.unknown, incidents: s.incidents, halted: s.halted, consec_errors: s.consecErrors, searches: s.searches, orphans: (s.orphans || []).length, errors: (s.errors || []).map(e => e.kind), plan: s.plan.digest.slice(0, 16) }));
  R.guard_window = guardEv;
  if (DRY) {
    const ng = {};
    for (const f of fs.readdirSync(OUT).filter(f => /^netguard-.*\.jsonl$/.test(f))) {
      const L = fs.readFileSync(path.join(OUT, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
      ng[f] = { processes: new Set(L.filter(x => x.installed).map(x => x.pid)).size, blocked: L.filter(x => x.blocked).length,
                blocked_hosts: L.filter(x => x.blocked).reduce((m, x) => (m[x.host] = (m[x.host] || 0) + 1, m), {}) };
    }
    R.netguard = { files: ng, supervisor_live: require('./netguard.js').stats(), login_stub: S.stub.counts, login_stand_in: S.mock.counts,
                   totals: require('./local_server.js').netTotals(OUT),
                   rule: 'every non-loopback connection in every process of the run was REFUSED before DNS; a blocked attempt sends no packet. The local config should leave NOTHING for the guard to refuse: totals.public_connects_blocked must be 0' };
    try { R.games = require('./report.js').gamesReport(path.join(OUT, 'games.jsonl'), { includeLocal: true }); } catch (e) { R.games = { error: e.message }; }
    /* --throttle: the proof the server really throttled (the preload logs every process that turned Config.nothrottle off) */
    { let on = 0; try { on = fs.readFileSync(path.join(OUT, 'netguard-server.jsonl'), 'utf8').split('\n').filter(l => /"throttle_on":true/.test(l)).length; } catch (e) { /* none */ }
      R.server_throttle = { requested: has('throttle'), processes_throttle_on: on, rule: 'pokemon-showdown-mc server/users.ts User#chat: 600 ms per message, 5 queued, the next DROPPED with a notice' }; }
    S.stop();   // my own server tree, by pid, and both stand-ins
  }
  fs.writeFileSync(path.join(OUT, 'ladder-report.json'), JSON.stringify(R, null, 1));
  log('report -> ' + path.join(OUT, 'ladder-report.json'));
  log(JSON.stringify({ series_rows: R.series_rows, by_arm: R.by_arm, by_team: R.by_team, rated: R.rated_rows,
    record: Object.fromEntries(Object.entries(R.record).map(([c, x]) => [c, x.error ? x : { rated_all: x.all.record, without_quit_wins: x.without_quit_wins.record, quit_wins: x.quit_wins, self_quits: x.self_quits, unrated_excluded: x.unrated_excluded.length }])), guard: R.guard, applied: R.games && R.games.applied && { games: R.games.applied.games_checked, checks: R.games.applied.chosen, mismatch: R.games.applied.mismatch, preview: R.games.applied.by_kind.preview }, netguard: R.netguard && Object.fromEntries(Object.entries(R.netguard.files).map(([k, v]) => [k, v.blocked])) }));
  process.exit(clients.some(c => c.failed) ? 1 : 0);
}
main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
