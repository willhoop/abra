/* solver/tests/test-rotom-ladder.js — ROTOM's ladder mode (solver/rotom/ladder.js, netguard.js, login_stub.js, the
 * rotom.js start-up guards, the rotation), without a public server and without a battle.
 *
 *   node solver/tests/test-rotom-ladder.js            exit 0 GREEN, 1 RED
 *   node solver/tests/test-rotom-ladder.js --break    deliberate break: the network check runs WITHOUT the guard and
 *                                                     must go RED (it reaches play.pokemonshowdown.com's resolver)
 *
 *   PLAN      the per-series arm and team are a pure function of (seed, k); arms are near 50/50 over 4,000 series and
 *             every rotation team is drawn; the plan digest moves with the seed; a restart with another seed is refused.
 *   RATING    the server's rating line parses (an escaped name too); E is the Elo expectation.
 *   GUARD     userdetails offline -> clear; online -> blocked in `online` mode; a Reg M-C battle -> blocked in `battle`
 *             mode; no answer -> blocked (fail closed).
 *   LOOP      nextAction: STOP while searching cancels, STOP idle exits 0, STOP mid-series waits; the set count; the
 *             consecutive-error halt (exit 4 once idle); a stale guard queries; a blocked guard cancels a search.
 *   CONTROLLER a scripted session through the real controller: login -> guard query -> /utm + /search -> series k=1 with
 *             the committed arm and team -> rating lines -> one series row with S, E, S − E; matched against the
 *             guarded account -> incident, played out, then exit; three errors -> HALTED, exit 4.
 *   RELEASE   the gate release is allowed; an older release is refused as PRE-GATE; a missing one is refused.
 *   NET       with the guard installed, http, https, fetch and WebSocket to public hosts are REFUSED (ENETGUARD) and
 *             counted; loopback is allowed. Run in a child process so this test's own process is not altered.
 *   LOGIN     the local stand-in's assertion has users.ts validateToken's five fields (challenge, userid, type, date,
 *             host) and verifies RSA-SHA1 against its public key, exactly as server/verifier.ts checks it.
 *   STARTUP   rotom.js refuses (exit 2, before any socket): --ladder alone; --ladder --public as a non-ladder account;
 *             --dry-run on a non-local server; --ladder without --release; a pre-gate --release; a dry-run-only arms file
 *             on --public. No test here ever opens a public connection: every child runs with the netguard preload.
 *   ROTATION  solver/rotom/teams/ladder-rotation.json holds 3-5 teams, each passes Showdown's TeamValidator for the bo3
 *             format, distinct archetypes, a four-body bring of distinct sheet indices, leads first.
 *   SOURCE    nothing in the ladder code sends /forfeit; the password appears only in the login POST body.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

const BREAK = process.argv.includes('--break');
let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL [' + clause + '] ' + msg); } };
const ROOT = path.join(__dirname, '..', '..');
const L = require('../rotom/ladder.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rotom-ladder-test-'));

/* ---------------- PLAN ---------------- */
{
  const arms = ['A', 'B'], teams = ['L1', 'L2', 'L3', 'L4', 'L5'];
  const a1 = L.assign('s1', 7, arms, teams), a2 = L.assign('s1', 7, ['B', 'A'], teams);
  ok('PLAN', a1.arm === a2.arm && a1.team === a2.team, 'assignment depends on (seed,k) only, not on arm order: ' + JSON.stringify([a1, a2]));
  let nA = 0; const seen = new Set();
  for (let k = 1; k <= 4000; k++) { const x = L.assign('s1', k, arms, teams); if (x.arm === 'A') nA++; seen.add(x.team); }
  ok('PLAN', nA > 1880 && nA < 2120, 'arm A share over 4000 series ' + nA + ' (a fair coin: within ~4 SD of 2000)');
  ok('PLAN', seen.size === teams.length, 'every rotation team is drawn: ' + [...seen].join(','));
  ok('PLAN', L.planDigest('s1', arms, teams) === L.planDigest('s1', arms, teams) && L.planDigest('s1', arms, teams) !== L.planDigest('s2', arms, teams), 'plan digest is stable and moves with the seed');
}

/* ---------------- RATING ---------------- */
{
  const r = L.parseRatingLine("|raw|medicham32's rating: 1000 &rarr; <strong>1040</strong><br />(+40 for winning)");
  ok('RATING', r && r.id === 'medicham32' && r.before === 1000 && r.after === 1040, 'rating line: ' + JSON.stringify(r));
  const r2 = L.parseRatingLine("|raw|Ash &amp; Co's rating: 1312 &rarr; <strong>1290</strong><br />(-22 for losing)");
  ok('RATING', r2 && r2.id === 'ashco' && r2.before === 1312, 'escaped name: ' + JSON.stringify(r2));
  ok('RATING', L.parseRatingLine('|raw|<div>something else</div>') === null, 'a non-rating raw line is ignored');
  ok('RATING', Math.abs(L.expected(1500, 1500) - 0.5) < 1e-12 && Math.abs(L.expected(1600, 1500) - 1 / (1 + Math.pow(10, -0.25))) < 1e-12, 'E is the Elo expectation');
}

/* ---------------- GUARD ---------------- */
{
  const off = L.guardVerdict({ id: 'willhoop', userid: 'willhoop', rooms: false }, 'gen9championsvgc2026regmc');
  ok('GUARD', off.known && !off.online, 'rooms:false = offline');
  const on = L.guardVerdict({ userid: 'willhoop', rooms: { lobby: {} } }, 'gen9championsvgc2026regmc');
  ok('GUARD', on.online && !on.inBattle, 'online, no battle');
  const bat = L.guardVerdict({ userid: 'willhoop', rooms: { '☆battle-gen9championsvgc2026regmcbo3-123': { p1: ' willhoop', p2: ' x' } } }, 'gen9championsvgc2026regmc');
  ok('GUARD', bat.online && bat.inBattle && bat.battles[0] === 'battle-gen9championsvgc2026regmcbo3-123', 'a Reg M-C battle is seen: ' + JSON.stringify(bat));
  ok('GUARD', !L.guardVerdict(null).known, 'no answer = unknown');
}

/* ---------------- LOOP (nextAction) ---------------- */
{
  const base = { halted: null, stopFile: null, setsDone: 0, openSeries: 0, sets: 10, maxErrors: 3, consecErrors: 0, deadline: 0, now: 1e6, loggedIn: true,
                 searching: false, searchSentAt: 0, guard: { at: 1e6 - 1000, blocked: null, pendingSince: 0 } };
  const na = o => L.nextAction(Object.assign({}, base, o));
  ok('LOOP', na({}).do === 'search', 'clear guard, idle -> search');
  ok('LOOP', na({ stopFile: 'STOP', searching: true }).do === 'cancel', 'STOP while searching -> cancel');
  ok('LOOP', na({ stopFile: 'STOP' }).do === 'exit' && na({ stopFile: 'STOP' }).code === 0, 'STOP idle -> exit 0');
  ok('LOOP', na({ stopFile: 'STOP', openSeries: 1 }).do === 'wait', 'STOP mid-series -> play it out');
  ok('LOOP', na({ setsDone: 10 }).do === 'exit', 'set count reached -> exit');
  ok('LOOP', na({ consecErrors: 3 }).do === 'halt', 'three consecutive errors -> halt');
  ok('LOOP', na({ halted: 'x' }).code === 4 && na({ halted: 'x' }).do === 'exit' && na({ halted: 'x', openSeries: 1 }).do === 'wait', 'halted: exit 4 once idle, never mid-series');
  ok('LOOP', na({ guard: { at: 1e6 - L.GUARD_TTL_MS - 1, blocked: null } }).do === 'query-guard', 'stale guard -> query');
  ok('LOOP', na({ guard: { at: 0, blocked: null, pendingSince: 1e6 - 100 } }).do === 'wait', 'guard query in flight -> wait');
  ok('LOOP', na({ guard: { at: 1e6 - 10, blocked: 'willhoop is online' }, searching: true }).do === 'cancel', 'guard blocked while searching -> cancel');
  ok('LOOP', na({ guard: { at: 1e6 - 10, blocked: 'willhoop is online' } }).do === 'wait', 'guard blocked idle -> wait');
  ok('LOOP', na({ openSeries: 1 }).do === 'wait', 'a series in progress -> no search');
  ok('LOOP', na({ loggedIn: false }).do === 'wait', 'not logged in -> wait');
  ok('LOOP', na({ deadline: 1e6 - 1 }).do === 'exit', 'session time cap -> exit when idle');
}

/* ---------------- CONTROLLER (a scripted session through the real controller) ---------------- */
function mkController(dir, extra) {
  const sent = [], events = [], exits = [];
  let t = 1e9, logged = false, sets = 0, open = 0;
  const rotation = { file: 'x', sha256: 'y', teams: [1, 2, 3].map(i => ({ id: 'L' + i, packed: 'PACK' + i, archetype: { label: 'arch' + i }, from_game: 'g' + i, rating: 1500 })) };
  const C = L.create(Object.assign({
    name: 'medicham32', format: 'gen9championsvgc2026regmcbo3', formatPrefix: 'gen9championsvgc2026regmc', server: 'ws://localhost:1/', outDir: dir,
    statePath: path.join(dir, 'ladder-state.json'), arms: { file: 'arms.json', sha256: 'z', arms: { A: { policy: 'miltank' }, B: { policy: 'prior' } } }, rotation,
    seed: 'test-seed', sets: 3, stopFiles: [path.join(dir, 'STOP')], maxErrors: 3, guardUsers: ['willhoop'], guardMode: 'online', release: { engine_release: 'eaa5becc54eb' },
    send: s => sent.push(s), say: () => {}, event: (ty, o) => events.push({ ty, o }), loggedIn: () => logged, setsDone: () => sets, openSeries: () => open,
    counters: () => ({ fallbacks: {}, invalid: 0, timeouts: 0, decisions: 0, crashes: 0 }), bookGet: () => null, bookSet: () => {}, exit: (code, why) => exits.push({ code, why }), now: () => t,
  }, extra || {}));
  return { C, sent, events, exits, set: (o) => { if ('logged' in o) logged = o.logged; if ('sets' in o) sets = o.sets; if ('open' in o) open = o.open; if ('t' in o) t = o.t; }, get t() { return t; } };
}
{
  const dir = fs.mkdtempSync(path.join(TMP, 'c1-'));
  const H = mkController(dir);
  H.set({ logged: true });
  H.C.tick('login');
  ok('CONTROLLER', H.sent.some(s => s === '|/crq userdetails willhoop'), 'the guard is queried before any search: ' + JSON.stringify(H.sent));
  ok('CONTROLLER', !H.sent.some(s => /\/search/.test(s)), 'no search before the guard answers');
  H.C.onQuery('userdetails', JSON.stringify({ id: 'willhoop', userid: 'willhoop', rooms: { lobby: {} } }));
  ok('CONTROLLER', !H.sent.some(s => /\/search/.test(s)) && H.C.state().guard.pauses === 1, 'willhoop ONLINE -> paused, no search');
  H.set({ t: H.t + L.GUARD_TTL_MS + 1 }); H.C.tick('retry');
  H.C.onQuery('userdetails', JSON.stringify({ id: 'willhoop', userid: 'willhoop', rooms: false }));
  const p1 = L.assign('test-seed', 1, ['A', 'B'], ['L1', 'L2', 'L3']);
  ok('CONTROLLER', H.sent.includes('|/utm PACK' + p1.team.slice(1)) && H.sent.includes('|/search gen9championsvgc2026regmcbo3'), 'guard clear -> /utm the committed team (' + p1.team + ') then /search: ' + JSON.stringify(H.sent.slice(-2)));
  H.C.onUpdateSearch({ searching: ['gen9championsvgc2026regmcbo3'], games: null });
  ok('CONTROLLER', H.C.isSearching(), 'updatesearch -> searching');
  H.set({ open: 1 });
  const rec = H.C.onSeriesStart('game-bestof3-gen9championsvgc2026regmcbo3-1');
  ok('CONTROLLER', rec.k === 1 && rec.arm === p1.arm && rec.team === p1.team && rec.arm_config.policy === (p1.arm === 'A' ? 'miltank' : 'prior'), 'series k=1 carries the committed arm and team: ' + JSON.stringify({ k: rec.k, arm: rec.arm, team: rec.team }));
  ok('CONTROLLER', H.C.armOf('game-bestof3-gen9championsvgc2026regmcbo3-1').policy === rec.arm_config.policy, 'armOf gives the policy the decisions will use');
  H.C.onPlayer('game-bestof3-gen9championsvgc2026regmcbo3-1', 'p1', 'medicham32');
  H.C.onPlayer('game-bestof3-gen9championsvgc2026regmcbo3-1', 'p2', 'Some Human');
  H.C.onRaw('game-bestof3-gen9championsvgc2026regmcbo3-1', "|raw|medicham32's rating: 1200 &rarr; <strong>1225</strong><br />(+25 for winning)");
  H.C.onRaw('game-bestof3-gen9championsvgc2026regmcbo3-1', "|raw|Some Human's rating: 1300 &rarr; <strong>1275</strong><br />(-25 for losing)");
  H.set({ open: 0, sets: 1 });
  H.C.onSeriesEnd('game-bestof3-gen9championsvgc2026regmcbo3-1', { winner: 'medicham32', mine: true });
  const rows = fs.readFileSync(H.C.seriesFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const E = 1 / (1 + Math.pow(10, 100 / 400));
  ok('CONTROLLER', rows.length === 1 && rows[0].S === 1 && Math.abs(rows[0].E - E) < 1e-4 && Math.abs(rows[0].residual - (1 - E)) < 1e-4 && rows[0].rated && rows[0].opponent === 'Some Human',
     'one series row with S, E, S − E: ' + JSON.stringify(rows[0] && { S: rows[0].S, E: rows[0].E, r: rows[0].residual, opp: rows[0].opponent }));
  ok('CONTROLLER', rows[0].plan.digest === H.C.plan().digest && rows[0].release.engine_release === 'eaa5becc54eb' && rows[0].arm_config, 'the row carries the plan digest, the release and the arm config');
  /* the next series: matched against the guarded account -> incident, played out, then exit */
  H.set({ t: H.t + L.GUARD_TTL_MS + 1 }); H.C.tick('next'); H.C.onQuery('userdetails', JSON.stringify({ userid: 'willhoop', rooms: false }));
  H.set({ open: 1 });
  H.C.onSeriesStart('game-bestof3-x-2');
  ok('CONTROLLER', H.C.state().k === 2, 'second series is k=2');
  H.C.onPlayer('game-bestof3-x-2', 'p2', 'willhoop');
  ok('CONTROLLER', H.C.state().incidents.length === 1 && H.events.some(e => e.ty === 'guard_incident'), 'matched against willhoop -> incident logged');
  ok('CONTROLLER', !H.sent.some(s => /forfeit/i.test(s)), 'no forfeit is ever sent');
  H.C.tick('mid'); ok('CONTROLLER', H.exits.length === 0, 'the incident series is played out, not abandoned');
  H.set({ open: 0, sets: 2 }); H.C.onSeriesEnd('game-bestof3-x-2', { winner: 'willhoop', mine: false });
  H.C.tick('after'); ok('CONTROLLER', H.exits.length === 1 && H.exits[0].code === 0, 'after the incident series the ladder stops: ' + JSON.stringify(H.exits));
  /* plan mismatch */
  let threw = null; try { mkController(dir, { seed: 'another-seed' }); } catch (e) { threw = e.code; }
  ok('CONTROLLER', threw === 'PLAN_MISMATCH', 'a restart with a different seed is refused: ' + threw);
}
{
  const dir = fs.mkdtempSync(path.join(TMP, 'c2-'));
  const H = mkController(dir);
  H.set({ logged: true });
  H.C.onLoginFailed('x'); H.C.onPopup('|popup|Your team was rejected for the following reasons: ...'); H.C.onLoginFailed('y');
  H.C.tick('t');
  ok('CONTROLLER', H.C.state().halted && H.exits.length === 0, 'three consecutive errors -> HALTED (no search): ' + H.C.state().halted);
  H.C.tick('t2');
  ok('CONTROLLER', H.exits.length === 1 && H.exits[0].code === 4, 'halted and idle -> exit 4: ' + JSON.stringify(H.exits));
  ok('CONTROLLER', !H.sent.some(s => /\/search/.test(s)), 'a halted ladder never searched');
}
{
  const dir = fs.mkdtempSync(path.join(TMP, 'c3-'));
  const H = mkController(dir);
  H.set({ logged: true }); H.C.tick('login');
  H.set({ t: H.t + L.GUARD_TIMEOUT_MS + 1 }); H.C.tick('late');
  ok('CONTROLLER', !H.sent.some(s => /\/search/.test(s)) && H.C.state().guard.unknown === 1, 'no userdetails answer -> fail closed, no search');
}

/* ---------------- PRIVATE + BOUNDED WAITS (the aa1 hangs, docs/_reports/2026-09-25-rotom-series-hang.md) ----------------
 * the full replay through the real client is solver/tests/test-rotom-private-series.js; these are the pure pieces */
{
  const bo = 'game-bestof3-gen9championsvgc2026regmcbo3-2687880999', pw = bo + '-3u647uiao8y2l2rmu65vb7v2rhhboxgpw';
  ok('PRIVATE', L.canonRoom(pw) === bo && L.canonRoom(bo) === bo && L.isPrivateId(pw) && !L.isPrivateId(bo), 'a hidden series id canonicalises to its public id');
  ok('PRIVATE', L.canonRoom('battle-gen9championsvgc2026regmcbo3-2687881000-4bl5339n46axp77eemy46cwqgaimvmbpw') === 'battle-gen9championsvgc2026regmcbo3-2687881000', 'a hidden battle id too');
  const cfg = { idleMs: 1000, probeMs: 100, maxProbes: 2 };
  ok('STALL', L.stallAction({ lastSeen: 1e6 }, 1e6 + 500, cfg).do === 'none', 'recent traffic -> nothing');
  ok('STALL', L.stallAction({ lastSeen: 1e6 }, 1e6 + 1000, cfg).do === 'probe', 'silent past idle -> probe');
  ok('STALL', L.stallAction({ lastSeen: 1e6, probes: 1, probeSentAt: 1e6 + 1000 }, 1e6 + 1050, cfg).do === 'none', 'probe in flight -> wait for it');
  ok('STALL', L.stallAction({ lastSeen: 1e6, probes: 1, probeSentAt: 1e6 + 1000 }, 1e6 + 1100, cfg).do === 'probe', 'unanswered -> probe again');
  ok('STALL', L.stallAction({ lastSeen: 1e6, probes: 2, probeSentAt: 1e6 + 1100 }, 1e6 + 1200, cfg).do === 'orphan', 'silent through every probe -> orphan');
  ok('STALL', L.stallAction({ lastSeen: 1e6 + 10, gone: 'nonexistent' }, 1e6 + 20, cfg).do === 'orphan', 'the room is gone -> orphan at once');
  /* aa2 k=16 (2026-09-26): three probes answered "alive, 2 users, we are in it" and the series was orphaned anyway */
  const alive = L.stallAction({ lastSeen: 1e6, probes: 2, probeSentAt: 1e6 + 1100, lastAlive: 1e6 + 1150 }, 1e6 + 1200, cfg);
  ok('STALL', alive.do !== 'orphan', 'a series whose probe answered "alive, we are in it" is NEVER orphaned: ' + JSON.stringify(alive));
  ok('STALL', L.stallAction({ lastSeen: 1e6, probes: 5, probeSentAt: 1e6 + 1100, lastAlive: 1e6 + 1150 }, 1e6 + 1300, cfg).do === 'probe', 'alive -> keep probing (and the client repairs it) for as long as it stays alive');
  ok('STALL', L.stallAction({ lastSeen: 1e6, probes: 2, probeSentAt: 1e6 + 1100, lastAlive: 1e6 - 5000 }, 1e6 + 1200, cfg).do === 'orphan', 'an alive answer long ago does not shield probes that now go unanswered');
  ok('STALL', L.stallAction({ lastSeen: 1e6, gone: 'roominfo: not found', lastAlive: 1e6 + 1150 }, 1e6 + 1200, cfg).do === 'orphan', 'a room that is GONE is orphaned whatever it said before');
  const base = { halted: null, stopFile: null, setsDone: 0, openSeries: 0, sets: 10, maxErrors: 3, consecErrors: 0, deadline: 0, now: 1e7, loggedIn: true,
                 searching: false, searchSentAt: 0, guard: { at: 1e7 - 1000, blocked: null, pendingSince: 0 } };
  const na = o => L.nextAction(Object.assign({}, base, o));
  ok('BOUNDS', na({ searching: true, searchingSince: 1e7 - L.SEARCH_MAX_MS }).do === 'cancel', 'in the queue past SEARCH_MAX_MS -> cancel (then search again)');
  ok('BOUNDS', na({ searching: true, searchingSince: 1e7 - 1000 }).do === 'wait', 'a fresh search -> wait');
  ok('BOUNDS', na({ loggedIn: false, socketOpen: true, loggedOutSince: 1e7 - L.LOGIN_WAIT_MS }).do === 'relogin', 'open socket, not logged in past LOGIN_WAIT_MS -> relogin');
  ok('BOUNDS', na({ loggedIn: false, socketOpen: false, loggedOutSince: 1e7 - L.LOGIN_WAIT_MS }).do === 'wait', 'socket closed -> the reconnect path owns it');
  ok('BOUNDS', na({ matchedAt: 1e7 - 1000 }).do === 'wait' && na({ matchedAt: 1e7 - L.MATCH_JOIN_MS }).do === 'search', 'a match listed but not yet joined holds the next search, for MATCH_JOIN_MS at most');
  /* the controller: the old id of an open series is an alias, never a new k; an orphan is an error and writes no row */
  const dir = fs.mkdtempSync(path.join(TMP, 'c4-'));
  const H = mkController(dir);
  H.set({ logged: true }); H.C.tick('login'); H.C.onQuery('userdetails', JSON.stringify({ userid: 'willhoop', rooms: false }));
  H.C.onUpdateSearch({ searching: [], games: { [bo]: 'x', [pw]: 'x' } });
  H.set({ t: H.t + 11000 }); H.C.tick('race');
  ok('CONTROLLER', H.sent.filter(s => /\/search/.test(s)).length === 1, 'a match listed by updatesearch holds the next search until its room speaks: ' + H.sent.filter(s => /\/search/.test(s)).length + ' searches');
  H.set({ open: 1 });
  const r1 = H.C.onSeriesStart(pw), r2 = H.C.onSeriesStart(bo);
  ok('CONTROLLER', r1 === r2 && r1.k === 1 && H.C.state().k === 1 && H.events.some(e => e.ty === 'ladder_series_alias'), 'the pre-rename id is an ALIAS of k=1, not series k=2: ' + JSON.stringify({ k1: r1.k, k2: r2.k, stateK: H.C.state().k }));
  const r3 = H.C.renameSeries(bo, bo + '-zzpw');
  ok('CONTROLLER', r3 === r1 && H.C.armOf(bo + '-zzpw') && H.C.armOf(bo + '-zzpw').id === r1.arm, 'a rename carries the record (arm, team) to the new id');
  H.set({ open: 0 });
  H.C.onSeriesOrphan(pw, 'room gone (test)');
  const S = H.C.state();
  ok('CONTROLLER', S.orphans.length === 1 && S.orphans[0].k === 1 && S.consecErrors === 1 && S.errors.some(e => e.kind === 'series_orphan'), 'an orphan is kept in the state and counted as an error: ' + JSON.stringify({ orphans: S.orphans.length, consec: S.consecErrors }));
  ok('CONTROLLER', !fs.existsSync(H.C.seriesFile), 'an orphan writes no series row (its result is unknown)');
  H.C.onSeriesEnd(pw, { winner: 'x', mine: false });   // a late |win| after the orphan: still no row
  ok('CONTROLLER', !fs.existsSync(H.C.seriesFile) && H.events.some(e => e.ty === 'ladder_win_after_orphan'), 'a late |win| for an orphan writes no row and is logged');
  /* an orphan that speaks again is taken back: its row is written after all */
  const bo2 = 'game-bestof3-gen9championsvgc2026regmcbo3-2687990000';
  H.set({ open: 1 }); const r4 = H.C.onSeriesStart(bo2); H.C.onSeriesOrphan(bo2, 'silent through 2 unanswered probes (test)'); H.C.onSeriesResume(bo2, 'its battle spoke (test)');
  H.C.onSeriesEnd(bo2, { winner: 'medicham32', mine: true }); H.C.onRaw(bo2, "|raw|medicham32's rating: 1000 &rarr; <strong>1020</strong>"); H.C.onPlayer(bo2, 'p2', 'opp'); H.C.onRaw(bo2, "|raw|opp's rating: 1000 &rarr; <strong>980</strong>");
  const rows4 = fs.existsSync(H.C.seriesFile) ? fs.readFileSync(H.C.seriesFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  ok('CONTROLLER', rows4.some(x => x.series === bo2 && x.k === r4.k) && H.events.some(e => e.ty === 'ladder_series_resume'), 'an orphan taken back gets its row: ' + JSON.stringify(rows4.map(x => [x.k, x.S])));
  /* CHOSEN VS APPLIED: every mismatch is a ladder error when seen; --max-mismatches of them halt the ladder */
  const H2 = mkController(fs.mkdtempSync(path.join(TMP, 'c5-')), { maxMismatches: 2 });
  H2.C.onMismatch('x', 'preview: chose a, server b');
  ok('MISMATCH', H2.C.state().errors.some(e => e.kind === 'applied_mismatch' && /preview/.test(e.detail)) && !H2.C.state().halted, 'one mismatch -> a ladder error, not yet a halt');
  H2.C.onMismatch('x', 'move: chose a, server b');
  ok('MISMATCH', /applied mismatches/.test(H2.C.state().halted || ''), 'the 2nd mismatch (--max-mismatches 2) HALTS the ladder: ' + H2.C.state().halted);
  ok('MISMATCH', L.nextAction(Object.assign({}, base, { halted: H2.C.state().halted, openSeries: 1 })).do === 'wait' && L.nextAction(Object.assign({}, base, { halted: H2.C.state().halted })).do === 'exit', 'halted: the open series is played out, then exit (never a forfeit)');
}

/* ---------------- WATCHDOG (the supervisor's hang watchdog, solver/rotom/watchdog.js) ---------------- */
{
  const W = require('../rotom/watchdog.js');
  const cfg = { hangMs: 60000 };
  ok('WATCHDOG', W.hangVerdict({ now: 1e7, since: 0, lastProgress: 1e7 - 59000, openGames: [] }, cfg).restart === false, 'progress within the window -> no restart');
  ok('WATCHDOG', W.hangVerdict({ now: 1e7, since: 0, lastProgress: 1e7 - 60000, openGames: [] }, cfg).restart === true, 'no progress for the window and no game open -> restart');
  ok('WATCHDOG', W.hangVerdict({ now: 1e7, since: 0, lastProgress: 1e7 - 600000, openGames: ['battle-x'] }, cfg).restart === false, 'a game open -> NEVER restart');
  ok('WATCHDOG', W.hangVerdict({ now: 1e7, since: 1e7 - 1000, lastProgress: 0, openGames: [] }, cfg).restart === false, 'a client just (re)started gets the full window');
  ok('WATCHDOG', W.hangVerdict({ now: 1e7, since: 0, lastProgress: 0, openGames: [] }, { hangMs: 0 }).restart === false, '--hang-min 0 turns it off');
  /* the file tail: events, decisions and the guard answer each count as progress */
  const dir = fs.mkdtempSync(path.join(TMP, 'wd-'));
  const now = Date.now(), ev = path.join(dir, 'events-rotomx.jsonl'), dec = path.join(dir, 'decisions-rotomx.jsonl'), ls = path.join(dir, 'ladder-state-rotomx.json');
  const w = W.create(dir, 'rotomx', { hangMs: 60000, gameOpenMs: 300000 }); w.restarted(now - 10 * 60000);
  fs.writeFileSync(ev, JSON.stringify({ t: now - 9 * 60000, type: 'ladder_search' }) + '\n');
  let v = w.poll(now);
  ok('WATCHDOG', v.restart && v.openGames.length === 0, 'the aa1 shape (last event 9 min ago, no game open) -> restart: ' + v.why);
  fs.appendFileSync(ev, JSON.stringify({ t: now - 2 * 60000, type: 'battle_join', room: 'battle-y' }) + '\n');
  v = w.poll(now);
  ok('WATCHDOG', !v.restart && v.openGames[0] === 'battle-y', 'a battle joined and not ended -> open -> no restart: ' + v.why);
  fs.appendFileSync(ev, JSON.stringify({ t: now - 90000, type: 'game_end', room: 'battle-y' }) + '\n');
  v = w.poll(now);
  ok('WATCHDOG', v.restart, 'the game ended 90 s ago and nothing since -> restart');
  fs.writeFileSync(dec, JSON.stringify({ t: now - 5000, room: 'battle-z' }) + '\n');
  ok('WATCHDOG', !w.poll(now).restart, 'a decision 5 s ago -> progress');
  fs.writeFileSync(ls, JSON.stringify({ guard: { last: { at: new Date(now + 70000).toISOString() } } }));
  ok('WATCHDOG', !w.poll(now + 120000).restart, 'a guard answer (a paused or searching loop re-asks every minute) -> progress');
}

/* ---------------- RELEASE ---------------- */
{
  const RD = path.join(ROOT, 'data', 'releases');
  const g = L.releaseAllowed(RD, L.GATE_RELEASE);
  ok('RELEASE', g.ok, 'the gate release ' + L.GATE_RELEASE + ' is allowed: ' + JSON.stringify(g));
  const older = fs.existsSync(RD) ? fs.readdirSync(RD).find(id => { try { return Date.parse(JSON.parse(fs.readFileSync(path.join(RD, id, 'release.json'), 'utf8')).cut) < Date.parse('2026-09-01'); } catch (e) { return false; } }) : null;
  ok('RELEASE', older && !L.releaseAllowed(RD, older).ok && /PRE-GATE/.test(L.releaseAllowed(RD, older).why), 'an older release is refused as PRE-GATE: ' + older);
  ok('RELEASE', !L.releaseAllowed(RD, 'deadbeef0000').ok, 'a missing release is refused');
}

/* ---------------- NET (child process) ---------------- */
{
  /* NO REAL TRAFFIC, EVEN ON THE BREAK: the child first replaces the socket layer's connect with a SINK that records the
   * host and fails the socket without touching the network, THEN installs the guard on top. With the guard, a public host
   * must be refused by the guard (ENETGUARD) and never reach the sink; on --break the guard is not installed, the sink
   * sees the public hosts, and this clause must go RED. */
  const probe = `
    const net = require('net');
    const SINK = [];
    net.Socket.prototype.connect = function (...a) { const o = Array.isArray(a[0]) ? a[0][0] : a[0]; SINK.push(o && typeof o === 'object' ? (o.host || 'localhost') : (typeof a[1] === 'string' ? a[1] : 'localhost')); process.nextTick(() => this.destroy(Object.assign(new Error('sink'), { code: 'SINK' }))); return this; };
    ${BREAK ? '' : "require(" + JSON.stringify(path.join(ROOT, 'solver', 'rotom', 'netguard.js')) + ").install({});"}
    const http = require('http'), https = require('https');
    const out = {};
    const t = (k, f) => new Promise(r => { let done = false; const fin = v => { if (!done) { done = true; out[k] = v; r(); } }; setTimeout(() => fin('timeout'), 8000); try { f(fin); } catch (e) { fin('threw ' + e.code); } });
    (async () => {
      await t('http', fin => { const q = http.get('http://play.pokemonshowdown.com/', () => fin('CONNECTED')); q.on('error', e => fin(e.code || e.message)); });
      await t('https', fin => { const q = https.get('https://play.pokemonshowdown.com/', () => fin('CONNECTED')); q.on('error', e => fin(e.code || e.message)); });
      await t('fetch', fin => fetch('https://play.pokemonshowdown.com/api/login', { method: 'POST' }).then(() => fin('CONNECTED'), e => fin((e.cause && e.cause.code) || e.message)));
      await t('ws', fin => { const w = new WebSocket('wss://sim3.psim.us/showdown/websocket'); w.onopen = () => { fin('CONNECTED'); w.close(); }; w.onerror = () => fin('error'); });
      await t('loopback', fin => { const s = net.connect(1, '127.0.0.1'); s.on('connect', () => fin('CONNECTED')); s.on('error', e => fin(e.code)); });
      let st = null; try { st = require(${JSON.stringify(path.join(ROOT, 'solver', 'rotom', 'netguard.js'))}).stats(); } catch (e) {}
      console.log(JSON.stringify({ out, st, sink: SINK }));
    })();`;
  const r = cp.spawnSync(process.execPath, ['-e', probe], { encoding: 'utf8', timeout: 60000 });
  let j = null; try { j = JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { j = null; }
  ok('NET', j && ['http', 'https', 'fetch'].every(k => j.out[k] === 'ENETGUARD'), 'http/https/fetch to a public host are REFUSED by the guard: ' + JSON.stringify(j && j.out));
  ok('NET', j && j.out.ws === 'error' && j.st && j.st.blocked_hosts['sim3.psim.us'] === 1, 'WebSocket to the public server is refused and counted: ' + JSON.stringify(j && j.st));
  ok('NET', j && j.out.loopback === 'SINK' && j.sink.length === 1 && j.sink[0] === '127.0.0.1', 'only the loopback attempt passed the guard to the socket layer: ' + JSON.stringify(j && j.sink));
  ok('NET', j && j.st && j.st.blocked === 4, 'exactly four public attempts, four blocked: ' + JSON.stringify(j && j.st));
}

/* ---------------- LOGIN (the local assertion stand-in) ---------------- */
(async () => {
  const pub = path.join(TMP, 'stub.pem');
  const S = await require('../rotom/login_stub.js').start({ pubkeyFile: pub });
  try {
    const res = await fetch(S.url, { method: 'POST', body: new URLSearchParams({ name: 'Rotom Dry A', pass: 'dry-run-placeholder', challstr: '4|abcdef0123' }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const j = JSON.parse((await res.text()).replace(/^\]/, ''));
    const [data, sig] = j.assertion.split(';');
    const f = data.split(',');
    ok('LOGIN', f.length === 5 && f[0] === 'abcdef0123' && f[1] === 'rotomdrya' && f[2] === '2' && Math.abs(+f[3] - Date.now() / 1000) < 60, 'assertion fields as validateToken reads them: ' + data);
    const v = crypto.createVerify('RSA-SHA1'); v.update(data);
    ok('LOGIN', v.verify(fs.readFileSync(pub, 'utf8'), sig, 'hex'), 'the signature verifies against the stub key (server/verifier.ts: RSA-SHA1, hex)');
    ok('LOGIN', S.counts.pass_field_seen === 1 && !JSON.stringify(S.counts).includes('placeholder'), 'the stub counts a password field and never stores its value');
  } finally { S.close(); }

  /* ---------------- STARTUP guards (children run with the netguard preload: nothing can leave) ---------------- */
  const guardPre = path.join(ROOT, 'solver', 'rotom', 'netguard.js').split(path.sep).join('/');
  const runRotom = (args) => cp.spawnSync(process.execPath, ['solver/rotom/rotom.js'].concat(args), { cwd: ROOT, encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { NODE_OPTIONS: '--require "' + guardPre + '"', ROTOM_NETGUARD: path.join(TMP, 'startup-netguard.jsonl'), ROTOM_LOCK_DIR: TMP }) });
  const out = path.join(TMP, 'rot');
  const common = ['--out', out, '--sets', '1'];
  let r = runRotom(['--ladder', '--name', 'medicham32'].concat(common));
  ok('STARTUP', r.status === 2 && /needs --public .* or --dry-run/.test(r.stderr), '--ladder alone refused: ' + r.status + ' ' + (r.stderr || '').slice(0, 160));
  r = runRotom(['--ladder', '--public', '--name', 'someoneelse', '--server', 'wss://sim3.psim.us/showdown/websocket', '--release', L.GATE_RELEASE, '--arms', 'solver/rotom/arms/aa-miltank.json', '--ladder-seed', 'x'].concat(common));
  ok('STARTUP', r.status === 2 && /not a ladder account/.test(r.stderr), 'a non-ladder account refused on --public: ' + (r.stderr || '').slice(0, 160));
  r = runRotom(['--ladder', '--dry-run', '--name', 'rotomx', '--server', 'wss://sim3.psim.us/showdown/websocket'].concat(common));
  ok('STARTUP', r.status === 2 && /LOCAL only|local-only/.test(r.stderr), '--dry-run on a public server refused: ' + (r.stderr || '').slice(0, 160));
  r = runRotom(['--ladder', '--dry-run', '--name', 'rotomx', '--arms', 'solver/rotom/arms/dryrun-fast.json'].concat(common));
  ok('STARTUP', r.status === 2 && /needs --release/.test(r.stderr), '--ladder without --release refused: ' + (r.stderr || '').slice(0, 160));
  const older = fs.readdirSync(path.join(ROOT, 'data', 'releases')).find(id => { try { return Date.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'releases', id, 'release.json'), 'utf8')).cut) < Date.parse('2026-09-01'); } catch (e) { return false; } });
  r = runRotom(['--ladder', '--dry-run', '--name', 'rotomx', '--release', older, '--arms', 'solver/rotom/arms/dryrun-fast.json'].concat(common));
  ok('STARTUP', r.status === 2 && /PRE-GATE/.test(r.stderr), 'a pre-gate release refused: ' + (r.stderr || '').slice(0, 200));
  r = runRotom(['--ladder', '--public', '--name', 'medicham32', '--server', 'wss://sim3.psim.us/showdown/websocket', '--release', L.GATE_RELEASE, '--arms', 'solver/rotom/arms/dryrun-fast.json', '--ladder-seed', 'x'].concat(common));
  ok('STARTUP', r.status === 2 && /(dry_run_only|no password)/.test(r.stderr), 'a dry-run-only arms file on --public refused (or no password): ' + (r.stderr || '').slice(0, 200));
  let ng = []; try { ng = fs.readFileSync(path.join(TMP, 'startup-netguard.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { /* none */ }
  ok('STARTUP', ng.filter(x => x.blocked).length === 0, 'no refused child ever TRIED a public connection: ' + JSON.stringify(ng.filter(x => x.blocked)));

  /* ---------------- ROTATION ---------------- */
  const ROT = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'rotom', 'teams', 'ladder-rotation.json'), 'utf8'));
  ok('ROTATION', ROT.teams.length >= 3 && ROT.teams.length <= 5, 'rotation size ' + ROT.teams.length);
  ok('ROTATION', ROT.format === 'gen9championsvgc2026regmcbo3', 'format ' + ROT.format);
  require('../arena/env.js');
  const X = require('../human/dex.js');
  const { Teams, TeamValidator } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));
  const V = TeamValidator.get(ROT.format);
  for (const t of ROT.teams) {
    const pr = V.validateTeam(Teams.unpack(t.packed));
    ok('ROTATION', !pr, t.id + ' passes TeamValidator: ' + JSON.stringify(pr));
    ok('ROTATION', t.bring.length === 4 && new Set(t.bring).size === 4 && t.bring.every(i => i >= 0 && i < 6), t.id + ' bring ' + JSON.stringify(t.bring));
  }
  ok('ROTATION', new Set(ROT.teams.map(t => t.archetype.id)).size === ROT.teams.length, 'one team per archetype');

  /* ---------------- SOURCE ---------------- */
  const src = ['rotom.js', 'ladder.js', 'run_ladder.js'].map(f => fs.readFileSync(path.join(ROOT, 'solver', 'rotom', f), 'utf8')).join('\n');
  ok('SOURCE', !/['"`]\|?\/forfeit/.test(src), 'nothing in the ladder code sends /forfeit');
  const passUses = (fs.readFileSync(path.join(ROOT, 'solver', 'rotom', 'rotom.js'), 'utf8').match(/CRED\.pass\b/g) || []).length;
  ok('SOURCE', passUses === 2, 'CRED.pass is used exactly twice (the empty check and the login POST body): ' + passUses);

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* temp */ }
  console.log((fails ? 'RED' : 'GREEN') + ' ' + (checks - fails) + '/' + checks + (BREAK ? '  (deliberate break: the NET clause ran WITHOUT the guard)' : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
