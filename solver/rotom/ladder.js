/* solver/rotom/ladder.js — ROTOM's LADDER MODE: search the Reg M-C bo3 ladder, play the series, repeat — safely.
 *
 * rotom.js owns the socket, the battles and the decisions; this module owns ONLY the ladder loop and its safety,
 * behind a small interface (create() below), so the replay/games-ledger code in rotom.js is never touched from here.
 *
 * THE LOOP (tick(), called every few seconds and after every event):
 *   STOP/KILL file, set count, consecutive-error halt, session time cap      -> no new search; exit when idle
 *   a series is open                                                         -> nothing (rotom.js is playing it)
 *   the two-account guard is stale or not clear                              -> /crq userdetails <guarded>, wait
 *   otherwise                                                                -> /utm <this series' team>, /search <format>
 * While searching it keeps re-checking the STOP file and the guard, and sends /cancelsearch if either trips.
 *
 * THE A/B AND THE ROTATION ARE PRE-COMMITTED (SOLVER-PLAN §5 ladder protocol; …humans-and-ladder.md §3.4 step 3).
 * Series k's arm and team are a pure function of (seed, k): sha256("<seed>|<k>|arm") and ("…|team"). The plan —
 * seed, the arm configs, the rotation's team ids and a digest of the first 5,000 assignments — is written to the
 * ladder state BEFORE the first search and never rewritten; a restart re-reads it and refuses a different seed,
 * arms file or rotation (plan mismatch). So nobody can pick the arm after seeing the opponent.
 *
 * THE TWO-ACCOUNT GUARD (Will: the account must never play while willhoop is on the ladder).
 *   1. The machine-wide lock (lock.js): two ABRA clients can never be on a public server at once.
 *   2. Before EVERY search, and every GUARD_TTL while searching: `/crq userdetails <u>` for each guarded account.
 *      The server answers `rooms: false` when the user is offline (pokemon-showdown-mc server/chat-commands/core.ts
 *      crqHandlers.userdetails), and otherwise lists their rooms — battles with the two player names, unless they set
 *      hideBattlesFromTrainerCard. A PENDING LADDER SEARCH IS NOT VISIBLE to anyone, so "is he searching?" cannot be
 *      answered. Mode `online` (the default) therefore pauses whenever a guarded account is CONNECTED at all; mode
 *      `battle` pauses only while it is a player in a Reg M-C battle (and so cannot see a search in progress). No
 *      answer within GUARD_TIMEOUT is treated as NOT CLEAR (fail closed).
 *   3. If a guarded account is ever the OPPONENT, the incident is logged, the series is played out normally (a
 *      forfeit to yourself is exactly the "gaming the system" the rule forbids), and the ladder stops after it.
 *
 * NEVER FORFEITS. Nothing here sends /forfeit. A crash is recovered by rotom.js's reconnect/rejoin and the watchdog.
 *
 * EVERY WAIT IS BOUNDED (2026-09-25, the aa1 hang: docs/_reports/2026-09-25-rotom-series-hang.md). The loop waits on four
 * things and each has a timeout with a logged recovery, so no single missing server message can stall it:
 *   an open series      silent for SERIES_IDLE_MS -> probe the room (`/crq roominfo`, which the server always answers);
 *                       an answer "alive, and we are in it" is LIFE: never orphaned (2026-09-26, aa2 k=16 — a live series
 *                       waiting on a dropped choice was orphaned and the ladder searched beside it); rotom.js repairs it
 *                       (timer on, the open choice re-sent) and the server's timer bounds the wait. Gone, or probes that
 *                       go UNANSWERED -> ORPHANED: logged, counted as a ladder error (so a run of them halts), no series
 *                       row (its result is unknown). A live battle of an orphaned series is still played, and no new
 *                       search goes out while any battle we are in is live (rotom.js openSeries)
 *   the rating lines    RATING_WAIT_MS, then the row is written without them (unchanged)
 *   the guard answer    GUARD_TIMEOUT_MS, then fail closed (unchanged)
 *   a search            SEARCH_MAX_MS in the queue -> cancel and search again; not logged in for LOGIN_WAIT_MS on an
 *                       open socket -> drop the socket (the reconnect path logs in again), counted as an error
 * A PRIVATE ROOM IS ONE SERIES UNDER TWO IDS. A player who hides the room makes the server rename it `<id>-<31>pw`
 * (pokemon-showdown-mc server/rooms.ts setPrivacy -> rename(..., noAlias)); `|updatesearch|` can list both ids. The
 * series record is keyed on the id, so canonRoom() (the id without the password suffix) is what says two ids are one
 * series: a second id for an open series is an ALIAS, never a new k.
 *
 * THE SERIES RECORD (one JSON line per series, <out>/ladder-series-<name>.jsonl): k, series id, arm and its full
 * config, team (id, archetype, source game), the engine release stamp, the plan digest, opponent, both players'
 * ratings before and after (the server's `NAME's rating: A &rarr; <strong>B</strong>` lines), S, E, S − E, games,
 * clock, and the fallback / invalid / timeout counters DURING that series (a series whose fallbacks are not counted
 * cannot prove which policy played it).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const PLAN_HORIZON = 5000;
const GUARD_TTL_MS = 60000;
const GUARD_TIMEOUT_MS = 15000;
const RATING_WAIT_MS = 20000;
const SERIES_IDLE_MS = 150000;     // no line in the series room or any of its battles for this long -> probe it
const SERIES_PROBE_MS = 20000;     // one probe's wait, and the spacing between probes
const SERIES_MAX_PROBES = 3;       // still silent after this many probes -> orphaned
const LOGIN_WAIT_MS = 90000;       // an open socket not logged in for this long -> drop it and log in again
const SEARCH_MAX_MS = 20 * 60000;  // in the queue this long -> cancel and search again
const MATCH_JOIN_MS = 20000;       // a match listed by |updatesearch| whose room has not spoken yet holds the next search this long

/* ---------------- pure helpers (unit-tested in solver/tests/test-rotom-ladder.js) ---------------- */
const h32 = s => parseInt(crypto.createHash('sha256').update(s).digest('hex').slice(0, 8), 16);
/* series k (1-based) -> { arm, team }. Arm by a fair coin over the arm ids (sorted), team uniform over the rotation. */
function assign(seed, k, armIds, teamIds) {
  const a = armIds.slice().sort(), t = teamIds.slice();
  return { k, arm: a[h32(seed + '|' + k + '|arm') % a.length], team: t[h32(seed + '|' + k + '|team') % t.length] };
}
function planDigest(seed, armIds, teamIds, n) {
  const h = crypto.createHash('sha256');
  for (let k = 1; k <= (n || PLAN_HORIZON); k++) { const x = assign(seed, k, armIds, teamIds); h.update(k + ':' + x.arm + ':' + x.team + '\n'); }
  return h.digest('hex');
}
const decodeHtml = s => String(s).replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/* `|raw|NAME's rating: 1000 &rarr; <strong>1025</strong><br />(+25 for winning)` (ladders-local.ts:262-269,
 * ladders-remote.ts:93). -> { name, id, before, after } or null */
function parseRatingLine(line) {
  const m = /^\|raw\|(.+?)'s rating: (\d+(?:\.\d+)?) &rarr; <strong>(\d+(?:\.\d+)?)<\/strong>/.exec(String(line || ''));
  if (!m) return null;
  const name = decodeHtml(m[1]);
  return { name, id: toID(name), before: +m[2], after: +m[3] };
}
/* a battle / bo3 room id without the `-<password>pw` suffix a hidden room gets (rooms.ts setPrivacy): the SAME series */
function canonRoom(id) { const m = /^((?:battle|game-bestof\d+)-[a-z0-9]+-\d+)-[a-z0-9]+pw$/.exec(String(id || '')); return m ? m[1] : String(id || ''); }
const isPrivateId = id => canonRoom(id) !== String(id || '');
/* one open series' watch -> what to do now. w = { lastSeen, probes, probeSentAt, gone, lastAlive }. Pure; unit-tested.
 * lastAlive = when a probe last answered "alive, and we are in it": a series that did so within one full probe cycle is
 * NEVER orphaned — it is probed again (and repaired by the caller) for as long as it stays alive. */
function stallAction(w, now, cfg) {
  const c = Object.assign({ idleMs: SERIES_IDLE_MS, probeMs: SERIES_PROBE_MS, maxProbes: SERIES_MAX_PROBES }, cfg || {});
  if (w.gone) return { do: 'orphan', why: 'room gone (' + w.gone + ')' };
  const idle = now - (w.lastSeen || 0);
  if (idle < c.idleMs) return { do: 'none' };
  if (w.probeSentAt && now - w.probeSentAt < c.probeMs) return { do: 'none', why: 'probe in flight' };
  const aliveRecently = w.lastAlive && now - w.lastAlive < c.idleMs + c.probeMs * (c.maxProbes + 1);
  if ((w.probes || 0) >= c.maxProbes && !aliveRecently) return { do: 'orphan', why: 'silent ' + Math.round(idle / 1000) + ' s through ' + (w.probes || 0) + ' unanswered probes' };
  if ((w.probes || 0) >= c.maxProbes) return { do: 'probe', why: 'silent ' + Math.round(idle / 1000) + ' s, but alive and we are in it: waiting' };
  return { do: 'probe', why: 'silent ' + Math.round(idle / 1000) + ' s' };
}
const expected = (rMe, rOpp) => 1 / (1 + Math.pow(10, (rOpp - rMe) / 400));
/* a userdetails answer -> what the guard needs to know */
function guardVerdict(d, formatPrefix) {
  if (!d || typeof d !== 'object') return { known: false };
  if (d.rooms === false) return { known: true, online: false, inBattle: false, battles: [] };
  const battles = Object.keys(d.rooms || {}).map(r => r.replace(/^[^a-z0-9]+/i, '')).filter(r => r.startsWith('battle-'));
  const mine = battles.filter(r => !formatPrefix || r.startsWith('battle-' + formatPrefix));
  return { known: true, online: true, inBattle: mine.length > 0, battles: mine, status: d.status || null };
}
/* the whole decision, as a pure function of a snapshot — every branch is a unit test */
function nextAction(s) {
  if (s.halted) return { do: s.openSeries ? 'wait' : 'exit', code: 4, why: 'halted: ' + s.halted };
  if (s.stopFile) return s.searching ? { do: 'cancel', why: 'STOP file' } : { do: s.openSeries ? 'wait' : 'exit', code: 0, why: 'STOP file' };
  if (s.setsDone + s.openSeries >= s.sets) return { do: s.openSeries ? 'wait' : 'exit', code: 0, why: 'set count reached (' + s.setsDone + '/' + s.sets + ')' };
  if (s.maxErrors && s.consecErrors >= s.maxErrors) return { do: 'halt', why: s.consecErrors + ' consecutive errors' };
  if (s.deadline && s.now > s.deadline) return s.searching ? { do: 'cancel', why: 'session time cap' } : { do: s.openSeries ? 'wait' : 'exit', code: 0, why: 'session time cap' };
  if (!s.loggedIn) return s.socketOpen && s.loggedOutSince && s.now - s.loggedOutSince >= (s.loginWaitMs || LOGIN_WAIT_MS)
    ? { do: 'relogin', why: 'socket open but not logged in for ' + Math.round((s.now - s.loggedOutSince) / 1000) + ' s' } : { do: 'wait', why: 'not logged in' };
  if (s.openSeries) return { do: 'wait', why: 'series in progress' };
  const g = s.guard;
  const fresh = g && g.at && s.now - g.at < GUARD_TTL_MS;
  if (g && g.blocked) return s.searching ? { do: 'cancel', why: 'guard: ' + g.blocked } : (fresh ? { do: 'wait', why: 'guard: ' + g.blocked } : { do: 'query-guard', why: 'guard re-check' });
  if (!fresh) return g && g.pendingSince && s.now - g.pendingSince < GUARD_TIMEOUT_MS ? { do: 'wait', why: 'guard query in flight' } : { do: 'query-guard', why: 'guard stale' };
  if (s.searching) return s.searchingSince && s.now - s.searchingSince >= (s.searchMaxMs || SEARCH_MAX_MS)
    ? { do: 'cancel', why: 'search timeout: in the queue ' + Math.round((s.now - s.searchingSince) / 60000) + ' min, searching again' } : { do: 'wait', why: 'searching' };
  if (s.searchSentAt && s.now - s.searchSentAt < 10000) return { do: 'wait', why: 'search sent' };
  if (s.matchedAt && s.now - s.matchedAt < MATCH_JOIN_MS) return { do: 'wait', why: 'matched, joining the series room' };
  return { do: 'search', why: 'guard clear' };
}

/* the release gate: a ladder series is only played on release eaa5becc54eb (the Reg M-C gate release) or a later cut */
const GATE_RELEASE = 'eaa5becc54eb';
function releaseAllowed(releasesDir, id) {
  const read = x => { try { return JSON.parse(fs.readFileSync(path.join(releasesDir, x, 'release.json'), 'utf8')); } catch (e) { return null; } };
  const r = read(id), g = read(GATE_RELEASE);
  if (!r) return { ok: false, why: 'release ' + id + ' not found under ' + releasesDir };
  if (!g) return { ok: false, why: 'the gate release ' + GATE_RELEASE + ' is not on disk to compare with' };
  if (id !== GATE_RELEASE && !(Date.parse(r.cut) >= Date.parse(g.cut))) return { ok: false, why: 'release ' + id + ' (first cut ' + r.cut + ') predates the Reg M-C gate release ' + GATE_RELEASE + ' (' + g.cut + ') — PRE-GATE' };
  return { ok: true, cut: r.cut, regulation: r.regulation || null };
}

/* ---------------- the controller ---------------- */
function create(o) {
  const now = o.now || Date.now;
  const armIds = Object.keys(o.arms.arms);
  const teamIds = o.rotation.teams.map(t => t.id);
  const SF = o.statePath;
  const SERIESF = path.join(o.outDir, 'ladder-series-' + toID(o.name) + '.jsonl');
  const plan = { seed: String(o.seed), arms_file: o.arms.file, arms_sha256: o.arms.sha256, arm_ids: armIds.slice().sort(), rotation_file: o.rotation.file,
                 rotation_sha256: o.rotation.sha256, team_ids: teamIds, horizon: PLAN_HORIZON, digest: planDigest(String(o.seed), armIds, teamIds) };
  let S = null;
  try { S = JSON.parse(fs.readFileSync(SF, 'utf8')); } catch (e) { S = null; }
  if (S && S.plan && S.plan.digest !== plan.digest) {
    const err = new Error('LADDER PLAN MISMATCH: ' + SF + ' was committed with digest ' + S.plan.digest + ' (seed ' + S.plan.seed + '); this start computes ' + plan.digest + '. Use the same --seed/--arms/--rotation, or a new --out.');
    err.code = 'PLAN_MISMATCH'; throw err;
  }
  if (!S) S = { plan: Object.assign({ committed_at: new Date(now()).toISOString() }, plan), started: new Date(now()).toISOString(), k: 0, pending: null,
                consecErrors: 0, errors: [], guard: { checks: 0, pauses: 0, unknown: 0, last: null }, incidents: [], halted: null, starts: 0 };
  S.starts = (S.starts || 0) + 1;
  const save = () => { try { fs.writeFileSync(SF + '.tmp', JSON.stringify(S, null, 1)); fs.renameSync(SF + '.tmp', SF); } catch (e) { /* never fatal */ } };
  save();

  const guardUsers = (o.guardUsers || []).map(toID).filter(Boolean);
  if (guardUsers.includes(toID(o.name))) throw new Error('the ladder account ' + o.name + ' is on its own guard list');
  const G = { at: 0, blocked: null, pendingSince: 0, answers: {} };
  let searching = false, searchSentAt = 0, searchingSince = 0, matchedAt = 0, stopRequested = null, exiting = false, lastRelogin = 0;
  S.orphans = S.orphans || [];
  const series = new Map();   // bestof id -> live record
  const deadline = o.maxHours ? now() + o.maxHours * 3600e3 : 0;

  function error(kind, detail) {
    S.consecErrors++; S.errors.push({ at: new Date(now()).toISOString(), kind, detail: String(detail || '').slice(0, 300) }); if (S.errors.length > 200) S.errors.shift();
    o.event('ladder_error', { kind, detail: String(detail || '').slice(0, 300), consecutive: S.consecErrors });
    o.say('LADDER ERROR (' + S.consecErrors + ' in a row): ' + kind + ' ' + String(detail || '').slice(0, 160));
    save();
  }
  function stopFile() { return (o.stopFiles || []).find(f => { try { return fs.existsSync(f); } catch (e) { return false; } }) || null; }
  function pending() {
    if (!S.pending || S.pending.k !== S.k + 1) { S.pending = assign(S.plan.seed, S.k + 1, armIds, teamIds); save(); }
    return S.pending;
  }
  function queryGuard() {
    if (!guardUsers.length) { G.at = now(); G.blocked = null; return; }
    G.pendingSince = now(); G.answers = {};
    for (const u of guardUsers) o.send('|/crq userdetails ' + u);
    S.guard.checks++;
  }
  function onQuery(type, json) {
    if (type !== 'userdetails') return;
    let d = null; try { d = JSON.parse(json); } catch (e) { return; }
    const id = toID(d && (d.userid || d.id));
    if (!guardUsers.includes(id)) return;
    G.answers[id] = guardVerdict(d, o.formatPrefix);
    if (guardUsers.every(u => G.answers[u])) {
      const block = guardUsers.map(u => { const v = G.answers[u]; if (!v.known) return u + ' unknown'; if (o.guardMode === 'battle') return v.inBattle ? u + ' is in ' + v.battles[0] : null; return v.online ? u + ' is online' + (v.inBattle ? ' (in ' + v.battles[0] + ')' : '') : null; }).filter(Boolean);
      const was = G.blocked;
      G.blocked = block.length ? block.join('; ') : null; G.at = now(); G.pendingSince = 0;
      S.guard.last = { at: new Date(now()).toISOString(), clear: !G.blocked, why: G.blocked, answers: G.answers };
      if (G.blocked && !was) { S.guard.pauses++; o.say('GUARD: pausing — ' + G.blocked); o.event('guard_pause', { why: G.blocked }); }
      if (!G.blocked && was) { o.say('GUARD: clear — resuming'); o.event('guard_clear', {}); }
      save();
      tick('guard answer');
    }
  }
  function guardTimeout() {
    if (G.pendingSince && now() - G.pendingSince >= GUARD_TIMEOUT_MS) {
      G.pendingSince = 0; G.at = now(); G.blocked = 'no userdetails answer in ' + GUARD_TIMEOUT_MS / 1000 + ' s (fail closed)';
      S.guard.unknown++; save(); o.event('guard_unknown', {});
      if (S.guard.unknown % 3 === 0) error('guard', 'three guard queries unanswered');
    }
  }
  function snapshotState() {
    return { halted: S.halted, stopFile: stopRequested || stopFile(), setsDone: o.setsDone(), openSeries: o.openSeries(), sets: o.sets, maxErrors: o.maxErrors,
             consecErrors: S.consecErrors, deadline, now: now(), loggedIn: o.loggedIn(), searching, searchSentAt, searchingSince, matchedAt, searchMaxMs: o.searchMaxMs,
             socketOpen: o.socketOpen ? o.socketOpen() : false, loggedOutSince: o.loggedOutSince ? o.loggedOutSince() : 0, loginWaitMs: o.loginWaitMs,
             guard: { at: G.at, blocked: G.blocked, pendingSince: G.pendingSince } };
  }
  function tick(why) {
    if (exiting) return null;
    guardTimeout();
    const s = snapshotState();
    const a = nextAction(s);
    if (a.do === 'search') {
      const p = pending();
      const team = o.rotation.teams.find(t => t.id === p.team);
      if (o.preSearch) o.preSearch();   // dry run only: `/hidenext`, so the series is PRIVATE (renamed `<id>-<pw>pw`)
      o.send('|/utm ' + team.packed);
      o.send('|/search ' + o.format);
      searchSentAt = now(); S.searches = (S.searches || 0) + 1; save();
      o.say('SEARCH ' + o.format + ' — series k=' + p.k + ' arm ' + p.arm + ' team ' + p.team);
      o.event('ladder_search', { k: p.k, arm: p.arm, team: p.team });
    } else if (a.do === 'cancel') {
      o.send('|/cancelsearch'); searching = false; searchSentAt = 0; searchingSince = 0;
      o.say('CANCEL SEARCH — ' + a.why); o.event('ladder_cancel', { why: a.why });
    } else if (a.do === 'relogin') {
      if (now() - lastRelogin >= (o.loginWaitMs || LOGIN_WAIT_MS)) { lastRelogin = now(); error('login', a.why + ' — dropping the socket to log in again'); if (o.reconnect) o.reconnect(a.why); }
    } else if (a.do === 'query-guard') queryGuard();
    else if (a.do === 'halt') {
      S.halted = a.why; save(); o.say('HALTED: ' + a.why + ' — no new searches'); o.event('ladder_halt', { why: a.why });
      if (searching) { o.send('|/cancelsearch'); searching = false; }
    } else if (a.do === 'exit') { exiting = true; o.say('LADDER DONE: ' + a.why); o.event('ladder_exit', { why: a.why, code: a.code }); o.exit(a.code, a.why); }
    return a;
  }
  function onUpdateSearch(d) {
    const was = searching;
    searching = !!(d && Array.isArray(d.searching) && d.searching.map(toID).includes(toID(o.format)));
    if (searching) { searchSentAt = 0; if (!was) searchingSince = now(); } else searchingSince = 0;
    if (was !== searching) o.event('ladder_searching', { searching });
    /* a match: the server lists the new series room a moment before the room itself speaks. Until it does (bounded by
     * MATCH_JOIN_MS) no new search may go out — else a second search races the series it just found */
    const fresh = Object.keys((d && d.games) || {}).filter(r => /^game-bestof/.test(r) && ![...series.keys()].some(id => canonRoom(id) === canonRoom(r)));
    if (fresh.length) { if (!matchedAt) o.event('ladder_matched', { rooms: fresh }); matchedAt = now(); }
  }
  function onPopup(text) {
    if (/team was rejected|Couldn't search|can't search|cannot search|are already searching|must choose a team|not.*allowed|banned|locked/i.test(text) && !/already searching/i.test(text)) {
      searchSentAt = 0; error('search_refused', text);
    }
  }
  function onLoginFailed(detail) { error('login', detail); }
  function onSeriesStart(room) {
    if (series.has(room)) return series.get(room);
    /* the same series under its other id (a hidden room is renamed `<id>-<pw>pw`): an ALIAS, never a new k */
    for (const [id, r] of series) if (!r.finalized && !r.orphaned && canonRoom(id) === canonRoom(room)) {
      series.set(room, r); o.event('ladder_series_alias', { room, of: id, k: r.k });
      return r;
    }
    const known = o.bookGet(room);
    let rec;
    /* a restarted process: the arm and team come from the series book; the counters restart with the process, so the
     * row's during-series counts cover only the part this process played (flagged `counters_partial`) */
    if (known && known.ladder) rec = Object.assign({}, known.ladder, { resumed: true, counters_before: o.counters(), counters_partial: true });
    else {
      const p = pending();
      S.k = p.k; S.pending = null; searching = false; searchSentAt = 0; matchedAt = 0; save();
      const team = o.rotation.teams.find(t => t.id === p.team);
      rec = { k: p.k, arm: p.arm, arm_config: o.arms.arms[p.arm], team: p.team, team_meta: { archetype: team.archetype && team.archetype.label, from_game: team.from_game, rating: team.rating },
              started: new Date(now()).toISOString(), counters_before: o.counters() };
      o.bookSet(room, { ladder: rec, team: p.team, policy: rec.arm_config.policy, arm: p.arm });
    }
    rec.ratings = rec.ratings || {}; rec.players = rec.players || {};
    series.set(room, rec);
    o.event('ladder_series_start', { room, k: rec.k, arm: rec.arm, team: rec.team, resumed: !!rec.resumed });
    return rec;
  }
  function armOf(room) { const r = series.get(room); return r ? Object.assign({ id: r.arm }, r.arm_config) : null; }
  function teamOf(room) { const r = series.get(room) || (S.pending && { team: S.pending.team }); return r ? o.rotation.teams.find(t => t.id === r.team) : null; }
  function onPlayer(bestof, side, name) {
    const r = bestof && series.get(bestof); if (!r || !name) return;
    r.players[side] = name;
    if (guardUsers.includes(toID(name))) {
      const inc = { at: new Date(now()).toISOString(), series: bestof, opponent: name, k: r.k };
      if (!S.incidents.some(x => x.series === bestof)) { S.incidents.push(inc); stopRequested = 'matched against guarded account ' + name; save(); }
      o.say('GUARD INCIDENT: matched against ' + name + ' — playing the series out (no forfeit), then stopping'); o.event('guard_incident', inc);
    }
  }
  function onRaw(bestof, line) {
    const x = parseRatingLine(line); if (!x) return;
    const r = bestof && series.get(bestof); if (!r) return;
    r.ratings[x.id] = { before: x.before, after: x.after };
    o.event('rating_line', { room: bestof, who: x.id, before: x.before, after: x.after });
    if (r.ended && Object.keys(r.ratings).length >= 2) finalize(bestof);
  }
  /* CHOSEN VS APPLIED (rotom.js recordVerdict -> solver/rotom/applied.js): every mismatch is a ladder error the moment it is
   * seen, and --max-mismatches of them in a run HALT the ladder (no new search; the open series is played out) */
  function onMismatch(bestof, detail) {
    S.mismatches = (S.mismatches || 0) + 1;
    error('applied_mismatch', detail);
    const cap = o.maxMismatches == null ? 3 : o.maxMismatches;
    if (cap > 0 && S.mismatches >= cap && !S.halted) {
      S.halted = S.mismatches + ' applied mismatches (a choice the server did not apply): --max-mismatches ' + cap; save();
      o.say('HALTED: ' + S.halted + ' — no new searches'); o.event('ladder_halt', { why: S.halted });
      if (searching) { o.send('|/cancelsearch'); searching = false; }
    }
  }
  /* an orphaned series spoke again: take it back, so its result gets a row after all */
  function onSeriesResume(room, why) {
    const r = series.get(room); if (!r || !r.orphaned) return;
    const was = r.orphaned; r.orphaned = null;
    const rec = S.orphans.find(x => x.room === room && !x.resumed); if (rec) rec.resumed = new Date(now()).toISOString();
    o.event('ladder_series_resume', { room, k: r.k, was, why }); save();
  }
  /* a throttle notice after /utm or /search: the search may be running with the wrong team, or not at all — cancel it and
   * let the next tick send /utm + /search again */
  function redoSearch(why) {
    o.send('|/cancelsearch'); searching = false; searchSentAt = 0; searchingSince = 0;
    o.event('ladder_redo_search', { why }); setTimeout(() => tick('redo search'), 1500);
  }
  function onSeriesEnd(bestof, res) {
    const r = series.get(bestof) || onSeriesStart(bestof);
    if (r.orphaned) { o.event('ladder_win_after_orphan', { room: bestof, k: r.k, result: res }); return; }   // already counted; never a second verdict
    r.ended = new Date(now()).toISOString(); r.result = res;
    r.counters_after = o.counters();
    o.say('LADDER series k=' + r.k + ' over — waiting up to ' + RATING_WAIT_MS / 1000 + ' s for the rating lines');
    if (Object.keys(r.ratings).length >= 2) finalize(bestof); else setTimeout(() => finalize(bestof), RATING_WAIT_MS).unref();
  }
  function finalize(bestof) {
    const r = series.get(bestof); if (!r || r.finalized) return;
    r.finalized = true;
    const me = toID(o.name);
    const oppName = Object.values(r.players).find(n => toID(n) !== me) || null;
    const rm = r.ratings[me], ro = oppName ? r.ratings[toID(oppName)] : null;
    const res = r.result || {};
    const Sc = res.winner == null ? 0.5 : (res.mine ? 1 : 0);
    const E = rm && ro ? expected(rm.before, ro.before) : null;
    const delta = (a, b) => { const out = {}; for (const k of Object.keys(b || {})) { const v = (b[k] || 0) - ((a || {})[k] || 0); if (v) out[k] = v; } return out; };
    const cb = r.counters_before || {}, ca = r.counters_after || {};
    const row = { client: o.name, k: r.k, series: bestof, arm: r.arm, arm_config: r.arm_config, team: r.team, team_meta: r.team_meta, opponent: oppName,
      rated: !!(rm && ro), rating_me: rm || null, rating_opp: ro || null, S: Sc, E: E == null ? null : +E.toFixed(4), residual: E == null ? null : +(Sc - E).toFixed(4),
      result: res, started: r.started, ended: r.ended, resumed: !!r.resumed, counters_partial: !!r.counters_partial,
      during_series: { fallbacks: delta(cb.fallbacks, ca.fallbacks), invalid: (ca.invalid || 0) - (cb.invalid || 0), timeouts: (ca.timeouts || 0) - (cb.timeouts || 0),
                       decisions: (ca.decisions || 0) - (cb.decisions || 0), crashes_caught: (ca.crashes || 0) - (cb.crashes || 0),
                       /* chosen vs applied: checks made, mismatches (preview among them), throttle notices */
                       applied_checks: (ca.applied_checks || 0) - (cb.applied_checks || 0), applied_mismatch: (ca.applied_mismatch || 0) - (cb.applied_mismatch || 0),
                       preview_mismatch: (ca.preview_mismatch || 0) - (cb.preview_mismatch || 0), throttle_notices: (ca.throttle_notices || 0) - (cb.throttle_notices || 0) },
      plan: { seed: S.plan.seed, digest: S.plan.digest }, release: o.release, dry_run: !!o.dryRun, server: o.server };
    try { fs.appendFileSync(SERIESF, JSON.stringify(row) + '\n'); } catch (e) { /* never fatal */ }
    const ds = row.during_series;
    const other = ds.invalid !== 0 || ds.timeouts !== 0 || ds.crashes_caught !== 0;
    /* a mismatch was already counted as an error when it was seen (onMismatch): a series with one is never "clean" */
    if (other) error('series', 'invalid ' + ds.invalid + ', timeouts ' + ds.timeouts + ', crashes ' + ds.crashes_caught);
    else if (!ds.applied_mismatch) S.consecErrors = 0;
    S.done = (S.done || 0) + 1; save();
    o.event('ladder_series_row', { k: r.k, arm: r.arm, S: Sc, E: row.E, residual: row.residual, rated: row.rated });
    o.say('LADDER ROW k=' + r.k + ' arm ' + r.arm + ' S=' + Sc + (E == null ? ' (no rating lines)' : ' E=' + E.toFixed(3)));
  }
  /* the room was renamed (a hidden series): the record follows it */
  function renameSeries(from, to) {
    const r = series.get(from); if (!r) return null;
    series.delete(from); if (!series.has(to)) series.set(to, r);
    o.event('ladder_series_rename', { from, to, k: r.k });
    return r;
  }
  /* a series the client can no longer see (room gone, or silent through every probe): no row — its result is unknown —
   * but it is logged, kept in the state, and counted as an error, so a run of them halts the ladder rather than hiding */
  function onSeriesOrphan(room, why) {
    const r = series.get(room);
    if (r && (r.finalized || r.orphaned)) return;
    if (r) r.orphaned = why;
    const rec = { at: new Date(now()).toISOString(), room, k: r ? r.k : null, arm: r ? r.arm : null, team: r ? r.team : null, why: String(why || '').slice(0, 200) };
    S.orphans.push(rec); if (S.orphans.length > 200) S.orphans.shift();
    o.event('ladder_series_orphan', rec);
    o.say('SERIES ORPHANED k=' + rec.k + ' ' + room + ' — ' + rec.why + ' (no row; counted as an error; searching on)');
    error('series_orphan', 'k=' + rec.k + ' ' + rec.why);
    tick('series orphaned');
  }
  function requestStop(why) { stopRequested = why; o.event('ladder_stop_requested', { why }); tick('stop requested'); }
  /* a process that restarts after a crash counts one error (the watchdog restarted it) */
  if (o.restartedAfterCrash) error('restart', 'process restarted by the watchdog');
  return { tick, onQuery, onUpdateSearch, onPopup, onLoginFailed, onSeriesStart, onSeriesEnd, onPlayer, onRaw, armOf, teamOf, requestStop, renameSeries, onSeriesOrphan,
           onMismatch, onSeriesResume, redoSearch,
           state: () => S, plan: () => S.plan, pendingAssignment: pending, isSearching: () => searching, seriesFile: SERIESF };
}

module.exports = { create, assign, planDigest, parseRatingLine, expected, guardVerdict, nextAction, releaseAllowed, canonRoom, isPrivateId, stallAction,
                   GATE_RELEASE, GUARD_TTL_MS, GUARD_TIMEOUT_MS, SERIES_IDLE_MS, SERIES_PROBE_MS, SERIES_MAX_PROBES, LOGIN_WAIT_MS, SEARCH_MAX_MS, MATCH_JOIN_MS };
