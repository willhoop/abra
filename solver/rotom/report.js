/* solver/rotom/report.js — aggregate one local run directory (both clients) into the numbers the M3 exit test asks for,
 * and (the `games` mode, at the bottom) summarise the per-game ledger of every game ROTOM has played.
 *
 *   node solver/rotom/report.js <out dir> [--json <file>]
 *   node solver/rotom/report.js games [games.jsonl] [--client <name>] [--include-local] [--json <file>]
 *   node solver/rotom/report.js ladder <run dir> [--json <file>]      the ladder record: RATED series only, with and without
 *                                                                     the series the opponent handed us (forfeit/timeout/walkaway)
 *
 * EVERY RECORD AND EVERY MEAN IS OVER RATED SERIES ONLY (endings.js ladderRecord requires `{ rated: true }`): gen5ab k30 was
 * unrated (no rating lines, S 1) and was counted as a win by any figure that did not filter. An unrated series is listed,
 * never scored. How each game and series ended (end_reason) comes from solver/rotom/endings.js; a record without the
 * field is derived from its own battle log, or counted as unknown — never guessed normal.
 *
 * Reads every decisions-*.jsonl, events-*.jsonl, summary-*.json and series/*.json the clients wrote. Nothing is
 * typed here: a figure is a count over those files. The checks: 0 timeouts (a choice sent after the turn's time,
 * a request superseded before we answered, a server "too late"/"nothing to choose", an inactivity loss), 0 invalid
 * choices (any server `[Invalid choice]`), 0 crashed sets (a set a client joined that did not end in a `|win|` or
 * `|tie|` seen by that client, or a client process that exited non-zero outside a crash drill).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ENDINGS = require('./endings.js');
const ROOT = path.join(__dirname, '..', '..');

function readJsonl(f) { try { return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } }
function stats(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y), q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))];
  return { n: a.length, mean: Math.round(a.reduce((x, y) => x + y, 0) / a.length), p50: q(0.5), p95: q(0.95), p99: q(0.99), max: s[s.length - 1] };
}

function aggregate(dir) {
  const files = fs.readdirSync(dir);
  /* a client that made no decision (every game ended before a request: a preview forfeit) still has events to count */
  const names = [...new Set(files.filter(f => /^decisions-.*\.jsonl$/.test(f)).map(f => f.slice(10, -6))
    .concat(files.filter(f => /^events-.*\.jsonl$/.test(f)).map(f => f.slice(7, -6))))];
  const clients = {};
  for (const n of names) {
    const dec = readJsonl(path.join(dir, 'decisions-' + n + '.jsonl'));
    const ev = readJsonl(path.join(dir, 'events-' + n + '.jsonl'));
    const sums = files.filter(f => f.startsWith('summary-' + n)).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    let state = null; try { state = JSON.parse(fs.readFileSync(path.join(dir, 'state-' + n + '.json'), 'utf8')); } catch (e) { /* none */ }
    const joined = new Set(ev.filter(e => e.type === 'series_join').map(e => e.room));
    const ended = new Set(ev.filter(e => e.type === 'series_end').map(e => e.room));
    const errs = ev.filter(e => e.type === 'server_error');
    const invalid = errs.filter(e => /\[Invalid choice\]/.test(e.txt));
    const late = invalid.filter(e => /too late|nothing to choose/i.test(e.txt));
    const byKind = {}; const msKind = { preview: [], move: [], switch: [] }; const sinceKind = { preview: [], move: [], switch: [] };
    const used = {}; const chains = {};
    let sentLate = 0;
    for (const d of dec) {
      byKind[d.kind] = (byKind[d.kind] || 0) + 1;
      msKind[d.kind].push(d.ms); sinceKind[d.kind].push(d.sinceRequest_ms);
      used[d.used] = (used[d.used] || 0) + 1;
      for (const c of d.chain || []) { const k = c.policy + ': ' + String(c.fail).replace(/\d+/g, 'N').slice(0, 80); chains[k] = (chains[k] || 0) + 1; }
      if (d.budget && d.ms / 1000 > d.budget.turnLeft) sentLate++;   // sent after the time this request had left
    }
    const lastSum = sums.sort((a, b) => (a.restarts || 0) - (b.restarts || 0)).pop() || {};
    const superseded = sums.reduce((s, x) => s + ((x.timeouts || []).filter(t => t.kind === 'superseded').length), 0);
    const forfeits = sums.reduce((s, x) => s + ((x.timeouts || []).filter(t => t.kind === 'forfeit').length), 0);
    clients[n] = {
      policy: lastSum.policy, decisions: dec.length, by_kind: byKind, used, fallback_chain: chains,
      decision_ms: { preview: stats(msKind.preview), move: stats(msKind.move), switch: stats(msKind.switch) },
      request_to_send_ms: { preview: stats(sinceKind.preview), move: stats(sinceKind.move), switch: stats(sinceKind.switch) },
      sets_joined: joined.size, sets_ended: ended.size, sets_unfinished: [...joined].filter(r => !ended.has(r)),
      sets_won: (state && state.setsDone || []).filter(s => s.mine).length, sets_done: (state && state.setsDone || []).length,
      games: ev.filter(e => e.type === 'game_end').length, games_timer_on: ev.filter(e => e.type === 'game_end' && e.timerOn).length,
      invalid: invalid.length, invalid_samples: invalid.slice(0, 5).map(e => e.txt), late_or_nothing: late.length, sent_late: sentLate, superseded, inactivity_losses: forfeits,
      disconnects: ev.filter(e => e.type === 'disconnect').length, logins: ev.filter(e => e.type === 'login').length,
      drills: ev.filter(e => e.type === 'drill'), resends: ev.filter(e => e.type === 'resend').length,
      rejoins: ev.filter(e => e.type === 'join_from_updatesearch').length, uncaught: ev.filter(e => e.type === 'uncaught').length,
      world_errors: dec.filter(d => d.world && !d.world.ok).length, world_error_samples: dec.filter(d => d.world && !d.world.ok).slice(0, 3).map(d => d.world.err),
      restarts: state ? state.restarts : 0,
      counters: lastSum.counters ? { policy: lastSum.counters.policy, world: lastSum.counters.world } : null,
      /* chosen vs applied (solver/rotom/applied.js), the throttle and the send queue, from the client's own summary */
      applied: lastSum.applied ? (({ chosen, applied, explained_diff, mismatch, unverifiable, by_kind, why }) => ({ chosen, applied, explained_diff, mismatch, unverifiable, by_kind, why }))(lastSum.applied) : null,
      applied_mismatch_events: ev.filter(e => e.type === 'applied_mismatch').length, preview_verify: ev.filter(e => e.type === 'preview_verify').map(e => e.ok),
      throttle_notices: ev.filter(e => e.type === 'throttle_notice').length, applied_cost: lastSum.applied_cost || null, send_queue: lastSum.send_queue || null,
      /* how the games ended (game_end carries end_reason since abra/regmc 1.15.0), and OUR OWN forfeits/timeouts/walkaways (must be 0) */
      end_reasons: ev.filter(e => e.type === 'game_end').reduce((m, e) => { const k = e.end_reason || 'not_recorded'; m[k] = (m[k] || 0) + 1; return m; }, {}),
      self_quits: ev.filter(e => e.type === 'self_quit').length, self_quit_samples: ev.filter(e => e.type === 'self_quit').slice(0, 5),
    };
  }
  /* per-series clock use, from the series artifacts */
  const series = [];
  for (const n of names) {
    const sdir = path.join(dir, 'series', n);
    if (fs.existsSync(sdir)) for (const f of fs.readdirSync(sdir).filter(f => f.endsWith('.json'))) series.push(Object.assign({ client: n }, JSON.parse(fs.readFileSync(path.join(sdir, f), 'utf8'))));
  }
  const totals = {
    timeouts: Object.values(clients).reduce((s, c) => s + c.late_or_nothing + c.sent_late + c.superseded + c.inactivity_losses, 0),
    invalid: Object.values(clients).reduce((s, c) => s + c.invalid, 0),
    crashed_sets: Object.values(clients).reduce((s, c) => s + c.sets_unfinished.length, 0),
    uncaught: Object.values(clients).reduce((s, c) => s + c.uncaught, 0),
    self_quits: Object.values(clients).reduce((s, c) => s + c.self_quits, 0),
    series: new Set(series.map(s => s.id)).size, series_finished: new Set(series.filter(s => s.result).map(s => s.id)).size,
    games: Math.max(0, ...Object.values(clients).map(c => c.games)),
  };
  return { dir, totals, clients, series: series.map(s => ({ client: s.client, id: s.id, winner: s.result && s.result.winner, games: s.games.map(g => ({ gnum: g.gnum, winner: g.winner, turns: g.turns, clockUsed_s: g.clockUsed, bankLeft: g.bankLeft })), reloaded: s.reloaded || 0, end_reason: s.end ? s.end.end_reason : null })) };
}

/* the ladder record of one run directory: its series rows (with end fields, or the backfill file next to them, or derived
 * now from the run's own logs by backfill_ends.js), RATED ONLY, with and without the opponent's quits */
function ladderReport(dir, o) {
  o = o || {};
  const rows = []; const sources = [];
  const files = fs.readdirSync(dir).filter(f => /^ladder-series-.*\.jsonl$/.test(f) && !/\.ends\.jsonl$/.test(f));
  let derived = null;
  for (const f of files) {
    const R = readJsonl(path.join(dir, f));
    const endsF = path.join(dir, f.replace(/\.jsonl$/, '.ends.jsonl'));
    if (R.every(r => 'end_reason' in r)) { rows.push(...R); sources.push({ file: f, ends: 'row' }); }
    else if (fs.existsSync(endsF)) { rows.push(...readJsonl(endsF)); sources.push({ file: path.basename(endsF), ends: 'backfill file' }); }
    else {
      derived = derived || require('./backfill_ends.js').deriveRun(dir);
      const name = f.slice('ladder-series-'.length, -'.jsonl'.length);
      rows.push(...((derived.clients[name] || {}).rows || R)); sources.push({ file: f, ends: 'derived now from the run logs' });
    }
  }
  const rec = ENDINGS.ladderRecord(rows, { rated: true, dryRun: !!o.dryRun });
  return Object.assign({ dir, sources, rows: rows.length }, rec);
}

/* ================= OUR GAMES: the per-game ledger rotom.js writes (default solver/out/rotom/games.jsonl) =================
 *
 *   node solver/rotom/report.js games [games.jsonl] [--client <name>] [--include-local] [--json <file>]
 *
 * Record by series, win rate with a 95% Wilson interval (games and series), per-team results, clock use and the
 * bank-left distribution, replay-save coverage, and the replay link of every loss. Every figure is a count over the
 * file. Local test games (record.local) are left out unless --include-local, so harness runs never mix with the
 * ladder; a record written by each of two local clients is kept per client (--client picks one).
 */
function wilson(k, n, z = 1.959964) {
  if (!n) return null;
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [+((c - h) / d).toFixed(4), +((c + h) / d).toFixed(4)];
}
function rate(k, n) { return { won: k, n, rate: n ? +(k / n).toFixed(4) : null, ci95: wilson(k, n) }; }
function gamesReport(file, o) {
  o = o || {};
  const lines = (() => { try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch (e) { return []; } })();
  let bad = 0; const all = [];
  for (const l of lines) { try { all.push(JSON.parse(l)); } catch (e) { bad++; } }
  const recs = all.filter(r => (o.includeLocal || !r.local) && (!o.client || String(r.client).toLowerCase() === String(o.client).toLowerCase()));
  /* how each game ended: the record's own field, or derived now from its battle log, or unknown */
  const endOf = r => {
    if (r.end_reason) return r.end_reason;
    if (r._end === undefined) {
      r._end = null;
      try { if (r.battle_log) { const f = path.isAbsolute(r.battle_log) ? r.battle_log : path.join(o.root || ROOT, r.battle_log); if (fs.existsSync(f)) r._end = ENDINGS.gameEnd(fs.readFileSync(f, 'utf8').split('\n'), r.client).end_reason; } } catch (e) { r._end = null; }
    }
    return r._end || 'unknown';
  };
  const key = r => r.client + '|' + (r.series || r.room);
  const bySeries = new Map();
  for (const r of recs) { const k = key(r); if (!bySeries.has(k)) bySeries.set(k, []); bySeries.get(k).push(r); }
  const series = [...bySeries.values()].map(G => {
    G.sort((a, b) => (a.game || 0) - (b.game || 0));
    const w = G.filter(g => g.result && g.result.mine).length, l = G.filter(g => g.result && !g.result.mine && !g.result.tie).length;
    const last = G[G.length - 1];
    const lastEnd = endOf(last);
    /* a series that ended short on a quit in its last game is decided by it; a walkaway between games cannot be seen from
     * game records alone (it has no game) and stays `unfinished` here — the ladder rows (`report.js ladder`) carry it */
    let result = w >= 2 ? 'W' : l >= 2 ? 'L' : 'unfinished';
    if (result === 'unfinished' && ENDINGS.OPP_QUIT.has(lastEnd)) result = 'W';
    if (result === 'unfinished' && ENDINGS.SELF_QUIT.has(lastEnd)) result = 'L';
    const rated = G.some(g => g.rating_after && Object.keys(g.rating_after).length >= 2);
    return { client: last.client, series: last.series, opponent: last.opponent, our_team: last.our_team, games: G.length, won: w, lost: l,
             result, score: w + '-' + l, rated, end_reason: result === 'unfinished' ? null : lastEnd, game_ends: G.map(endOf),
             rating: last.rating_after || null, replays: G.map(g => g.replay && g.replay.url || null) };
  });
  const quitWin = s => s.result === 'W' && ENDINGS.OPP_QUIT.has(s.end_reason);
  /* RATED ONLY: an unrated series is listed in series_unrated and never enters a record, a rate or a team's series count */
  const decided = series.filter(s => s.result !== 'unfinished' && s.rated);
  const ratedKeys = new Set(series.filter(s => s.rated).map(s => s.client + '|' + s.series));
  const gamesDecided = recs.filter(r => r.result && !r.result.tie && ratedKeys.has(key(r)));
  const endReasons = {}; for (const r of recs) { const k = endOf(r); endReasons[k] = (endReasons[k] || 0) + 1; }
  const selfQuits = recs.filter(r => ENDINGS.SELF_QUIT.has(endOf(r))).map(r => ({ series: r.series, game: r.game, room: r.room, end_reason: endOf(r) }));
  const teams = {};
  for (const r of recs) {
    if (!ratedKeys.has(key(r))) continue;   // rated series only
    const t = teams[r.our_team || '?'] = teams[r.our_team || '?'] || { games: 0, won: 0, series: 0, series_won: 0 };
    t.games++; if (r.result && r.result.mine) t.won++;
  }
  for (const s of decided) { const t = teams[s.our_team || '?']; if (t) { t.series++; if (s.result === 'W') t.series_won++; } }
  for (const t of Object.values(teams)) { t.game_rate = rate(t.won, t.games); t.series_rate = rate(t.series_won, t.series); }
  const used = recs.map(r => r.clock && r.clock.used_s).filter(v => v != null);
  const bank = recs.map(r => r.clock && r.clock.bank_left_s).filter(v => v != null);
  const buckets = [0, 30, 60, 120, 240, 420, Infinity];
  const bankHist = {};
  for (let i = 0; i + 1 < buckets.length; i++) bankHist[buckets[i] + '-' + (buckets[i + 1] === Infinity ? '' : buckets[i + 1]) + 's'] = bank.filter(v => v >= buckets[i] && v < buckets[i + 1]).length;
  const st = arr => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b), q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))];
    return { n: s.length, mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1), min: s[0], p10: q(0.1), p50: q(0.5), p90: q(0.9), max: s[s.length - 1] }; };
  const rep = { saved: 0, failed: 0, skipped: 0, missing: 0, retried: 0 };
  for (const r of recs) { const x = r.replay; if (!x) rep.missing++; else { rep[x.status] = (rep[x.status] || 0) + 1; if ((x.attempts || 0) > 1) rep.retried++; } }
  /* CHOSEN VS APPLIED per game and in total (rotom.js writes `applied` into every game record since abra/regmc 1.14.0; an
   * older record has none and is counted as `no_check`, never as clean) */
  const appliedTot = { games_checked: 0, no_check: 0, chosen: 0, applied: 0, explained_diff: 0, mismatch: 0, unverifiable: 0, by_kind: {}, why: {} };
  const appliedGames = [];
  for (const r of recs) {
    const a = r.applied;
    if (!a) { appliedTot.no_check++; continue; }
    appliedTot.games_checked++;
    for (const k of ['chosen', 'applied', 'explained_diff', 'mismatch', 'unverifiable']) appliedTot[k] += a[k] || 0;
    for (const [k, v] of Object.entries(a.by_kind || {})) { const m = appliedTot.by_kind[k] = appliedTot.by_kind[k] || { chosen: 0, applied: 0, explained_diff: 0, mismatch: 0, unverifiable: 0 }; for (const x of Object.keys(m)) m[x] += v[x] || 0; }
    for (const [w, n] of Object.entries(a.why || {})) appliedTot.why[w] = (appliedTot.why[w] || 0) + n;
    appliedGames.push({ series: r.series, game: r.game, room: r.room, chosen: a.chosen, applied: a.applied, explained_diff: a.explained_diff, mismatch: a.mismatch, unverifiable: a.unverifiable, mismatches: (a.mismatches || []).slice(0, 5) });
  }
  appliedTot.mismatch_rate = appliedTot.chosen ? +(appliedTot.mismatch / appliedTot.chosen).toFixed(4) : null;
  const losses = recs.filter(r => r.result && !r.result.mine && !r.result.tie).map(r => ({ series: r.series, game: r.game, opponent: r.opponent, our_team: r.our_team,
    turns: r.result.turns, replay: r.replay && r.replay.url || null, replay_status: r.replay && r.replay.status, battle_log: r.battle_log, decisions: r.decisions && r.decisions.log }));
  const decisionsLinked = recs.filter(r => r.decisions && r.decisions.log && fs.existsSync(path.join(__dirname, '..', '..', r.decisions.log))).length;
  return {
    file, generated: new Date().toISOString(), filter: { client: o.client || null, include_local: !!o.includeLocal },
    records: { lines: lines.length, unparseable: bad, used: recs.length, local_excluded: o.includeLocal ? 0 : all.filter(r => r.local).length },
    games: { n: gamesDecided.length, ...rate(gamesDecided.filter(r => r.result.mine).length, gamesDecided.length), ties: recs.filter(r => r.result && r.result.tie && ratedKeys.has(key(r))).length, in_unrated_series: recs.filter(r => !ratedKeys.has(key(r))).length, filter: 'games of rated series only' },
    series: { n: series.filter(s => s.rated).length, decided: decided.length, ...rate(decided.filter(s => s.result === 'W').length, decided.length), filter: 'rated series only',
              without_quit_wins: (d => rate(d.filter(s => s.result === 'W').length, d.length))(decided.filter(s => !quitWin(s))), quit_wins: decided.filter(quitWin).length },
    series_unrated: series.filter(s => !s.rated).map(s => ({ series: s.series, opponent: s.opponent, result: s.result, score: s.score, end_reason: s.end_reason })),
    end_reasons: endReasons, self_quits: selfQuits,
    record_by_series: series,
    teams,
    clock: { used_s: st(used), bank_left_s: st(bank), bank_left_hist: bankHist },
    replays: Object.assign(rep, { records: recs.length, decision_logs_present: decisionsLinked }),
    applied: Object.assign(appliedTot, { games: appliedGames }),
    losses,
  };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const fl = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
  if (argv[0] === 'ladder') {
    const r = ladderReport(path.resolve(argv[1]), { dryRun: argv.includes('--dry-run') });
    if (fl('json')) fs.writeFileSync(fl('json'), JSON.stringify(r, null, 1));
    const line = (lab, b) => console.log(`${lab.padEnd(12)} all ${b.all.record} (mean S ${b.all.mean_S}, S−E ${b.all.residual.mean} ± ${b.all.residual.sd} sd, n ${b.all.series})   without quit wins ${b.without_quit_wins.record} (mean S ${b.without_quit_wins.mean_S}, S−E ${b.without_quit_wins.residual.mean} ± ${b.without_quit_wins.residual.sd} sd)   quit wins ${b.quit_wins} ${JSON.stringify(b.quit_wins_by)}   SELF QUITS ${b.self_quits}${b.end_unknown ? '   end unknown ' + b.end_unknown : ''}`);
    console.log(`${r.rows} series rows — ${r.dir} (${r.sources.map(s => s.file + ': ' + s.ends).join('; ')})   RATED ONLY`);
    line('total', r);
    for (const [a, b] of Object.entries(r.by_arm)) line('arm ' + a, b);
    console.log('unrated, excluded: ' + (r.unrated_excluded.length ? JSON.stringify(r.unrated_excluded) : 'none'));
    if (r.self_quits) console.log('!!! OUR OWN FORFEIT / TIMEOUT / WALKAWAY: ' + r.self_quits + ' — must be 0');
  } else if (argv[0] === 'games') {
    const file = argv[1] && !argv[1].startsWith('--') ? argv[1] : path.join(__dirname, '..', 'out', 'rotom', 'games.jsonl');
    const r = gamesReport(file, { client: fl('client'), includeLocal: argv.includes('--include-local'), root: fl('root') || undefined });   // --root: where battle_log paths resolve (default this checkout)
    if (fl('json')) fs.writeFileSync(fl('json'), JSON.stringify(r, null, 1));
    const g = r.games, s = r.series, pct = x => x == null ? '-' : (100 * x).toFixed(1) + '%';
    console.log(`${r.records.used} game records (${r.records.local_excluded} local excluded, ${r.records.unparseable} unparseable) — ${file}`);
    console.log(`games  ${g.won}/${g.n - g.ties} ${pct(g.rate)}  95% CI ${g.ci95 ? pct(g.ci95[0]) + '–' + pct(g.ci95[1]) : '-'}`);
    console.log(`series ${s.won}/${s.decided} ${pct(s.rate)}  95% CI ${s.ci95 ? pct(s.ci95[0]) + '–' + pct(s.ci95[1]) : '-'}  (${s.n - s.decided} unfinished) RATED ONLY — without quit wins ${s.without_quit_wins.won}/${s.without_quit_wins.n} ${pct(s.without_quit_wins.rate)} (${s.quit_wins} quit wins)`);
    console.log('  (a series counts as rated here only if a game record carries both rating lines; a record written before they arrived reads unrated and is left out. The ladder figure is `report.js ladder <run dir>`, from the series rows.)');
    console.log(`unrated series (excluded): ${r.series_unrated.length}   end reasons ${JSON.stringify(r.end_reasons)}   SELF QUITS ${r.self_quits.length}${r.self_quits.length ? ' !!! must be 0 ' + JSON.stringify(r.self_quits) : ''}`);
    for (const x of r.record_by_series) console.log(`  ${x.result} ${x.score}  ${x.rated ? 'rated  ' : 'UNRATED'} ${x.end_reason || '-'}  ${x.series}  vs ${x.opponent}  team ${x.our_team}`);
    for (const [t, v] of Object.entries(r.teams)) console.log(`  team ${t}: games ${v.won}/${v.games}, series ${v.series_won}/${v.series}`);
    console.log('clock used (s) ' + JSON.stringify(r.clock.used_s) + '\nbank left (s) ' + JSON.stringify(r.clock.bank_left_s) + ' ' + JSON.stringify(r.clock.bank_left_hist));
    console.log('replays ' + JSON.stringify(r.replays));
    const A = r.applied;
    console.log(`chosen vs applied: ${A.chosen} checks in ${A.games_checked} games (${A.no_check} records predate the check) — applied ${A.applied}, explained ${A.explained_diff}, MISMATCH ${A.mismatch}${A.mismatch_rate != null ? ' (' + pct(A.mismatch_rate) + ')' : ''}, unverifiable ${A.unverifiable}`);
    console.log('  by kind ' + JSON.stringify(A.by_kind) + '\n  explained by ' + JSON.stringify(A.why));
    for (const g of A.games) console.log(`  ${g.mismatch ? 'MISMATCH' : 'ok      '} ${g.room}  chosen ${g.chosen} applied ${g.applied} explained ${g.explained_diff} mismatch ${g.mismatch}` + (g.mismatch ? '  ' + JSON.stringify(g.mismatches.map(m => m.kind + ': ' + m.chosen + ' -> ' + m.applied)) : ''));
    for (const l of r.losses) console.log(`  LOSS ${l.series} g${l.game} vs ${l.opponent}: ${l.replay || '(no replay: ' + l.replay_status + ')'}`);
  } else {
    const dir = argv[0];
    const r = aggregate(dir);
    if (fl('json')) fs.writeFileSync(fl('json'), JSON.stringify(r, null, 1));
    const { series, ...head } = r;
    console.log(JSON.stringify(head, null, 1));
  }
}
module.exports = { aggregate, stats, gamesReport, ladderReport, wilson };
