/* solver/rotom/report.js — aggregate one local run directory (both clients) into the numbers the M3 exit test asks for,
 * and (the `games` mode, at the bottom) summarise the per-game ledger of every game ROTOM has played.
 *
 *   node solver/rotom/report.js <out dir> [--json <file>]
 *   node solver/rotom/report.js games [games.jsonl] [--client <name>] [--include-local] [--json <file>]
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

function readJsonl(f) { try { return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } }
function stats(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y), q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))];
  return { n: a.length, mean: Math.round(a.reduce((x, y) => x + y, 0) / a.length), p50: q(0.5), p95: q(0.95), p99: q(0.99), max: s[s.length - 1] };
}

function aggregate(dir) {
  const files = fs.readdirSync(dir);
  const names = [...new Set(files.filter(f => /^decisions-.*\.jsonl$/.test(f)).map(f => f.slice(10, -6)))];
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
    series: new Set(series.map(s => s.id)).size, series_finished: new Set(series.filter(s => s.result).map(s => s.id)).size,
    games: Math.max(0, ...Object.values(clients).map(c => c.games)),
  };
  return { dir, totals, clients, series: series.map(s => ({ client: s.client, id: s.id, winner: s.result && s.result.winner, games: s.games.map(g => ({ gnum: g.gnum, winner: g.winner, turns: g.turns, clockUsed_s: g.clockUsed, bankLeft: g.bankLeft })), reloaded: s.reloaded || 0 })) };
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
  const key = r => r.client + '|' + (r.series || r.room);
  const bySeries = new Map();
  for (const r of recs) { const k = key(r); if (!bySeries.has(k)) bySeries.set(k, []); bySeries.get(k).push(r); }
  const series = [...bySeries.values()].map(G => {
    G.sort((a, b) => (a.game || 0) - (b.game || 0));
    const w = G.filter(g => g.result && g.result.mine).length, l = G.filter(g => g.result && !g.result.mine && !g.result.tie).length;
    const last = G[G.length - 1];
    return { client: last.client, series: last.series, opponent: last.opponent, our_team: last.our_team, games: G.length, won: w, lost: l,
             result: w >= 2 ? 'W' : l >= 2 ? 'L' : 'unfinished', score: w + '-' + l,
             rating: last.rating_after || null, replays: G.map(g => g.replay && g.replay.url || null) };
  });
  const decided = series.filter(s => s.result !== 'unfinished');
  const gamesDecided = recs.filter(r => r.result && !r.result.tie);
  const teams = {};
  for (const r of recs) {
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
  const losses = recs.filter(r => r.result && !r.result.mine && !r.result.tie).map(r => ({ series: r.series, game: r.game, opponent: r.opponent, our_team: r.our_team,
    turns: r.result.turns, replay: r.replay && r.replay.url || null, replay_status: r.replay && r.replay.status, battle_log: r.battle_log, decisions: r.decisions && r.decisions.log }));
  const decisionsLinked = recs.filter(r => r.decisions && r.decisions.log && fs.existsSync(path.join(__dirname, '..', '..', r.decisions.log))).length;
  return {
    file, generated: new Date().toISOString(), filter: { client: o.client || null, include_local: !!o.includeLocal },
    records: { lines: lines.length, unparseable: bad, used: recs.length, local_excluded: o.includeLocal ? 0 : all.filter(r => r.local).length },
    games: { n: recs.length, ...rate(gamesDecided.filter(r => r.result.mine).length, gamesDecided.length), ties: recs.length - gamesDecided.length },
    series: { n: series.length, decided: decided.length, ...rate(decided.filter(s => s.result === 'W').length, decided.length) },
    record_by_series: series,
    teams,
    clock: { used_s: st(used), bank_left_s: st(bank), bank_left_hist: bankHist },
    replays: Object.assign(rep, { records: recs.length, decision_logs_present: decisionsLinked }),
    losses,
  };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const fl = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
  if (argv[0] === 'games') {
    const file = argv[1] && !argv[1].startsWith('--') ? argv[1] : path.join(__dirname, '..', 'out', 'rotom', 'games.jsonl');
    const r = gamesReport(file, { client: fl('client'), includeLocal: argv.includes('--include-local') });
    if (fl('json')) fs.writeFileSync(fl('json'), JSON.stringify(r, null, 1));
    const g = r.games, s = r.series, pct = x => x == null ? '-' : (100 * x).toFixed(1) + '%';
    console.log(`${r.records.used} game records (${r.records.local_excluded} local excluded, ${r.records.unparseable} unparseable) — ${file}`);
    console.log(`games  ${g.won}/${g.n - g.ties} ${pct(g.rate)}  95% CI ${g.ci95 ? pct(g.ci95[0]) + '–' + pct(g.ci95[1]) : '-'}`);
    console.log(`series ${s.won}/${s.decided} ${pct(s.rate)}  95% CI ${s.ci95 ? pct(s.ci95[0]) + '–' + pct(s.ci95[1]) : '-'}  (${s.n - s.decided} unfinished)`);
    for (const x of r.record_by_series) console.log(`  ${x.result} ${x.score}  ${x.series}  vs ${x.opponent}  team ${x.our_team}`);
    for (const [t, v] of Object.entries(r.teams)) console.log(`  team ${t}: games ${v.won}/${v.games}, series ${v.series_won}/${v.series}`);
    console.log('clock used (s) ' + JSON.stringify(r.clock.used_s) + '\nbank left (s) ' + JSON.stringify(r.clock.bank_left_s) + ' ' + JSON.stringify(r.clock.bank_left_hist));
    console.log('replays ' + JSON.stringify(r.replays));
    for (const l of r.losses) console.log(`  LOSS ${l.series} g${l.game} vs ${l.opponent}: ${l.replay || '(no replay: ' + l.replay_status + ')'}`);
  } else {
    const dir = argv[0];
    const r = aggregate(dir);
    if (fl('json')) fs.writeFileSync(fl('json'), JSON.stringify(r, null, 1));
    const { series, ...head } = r;
    console.log(JSON.stringify(head, null, 1));
  }
}
module.exports = { aggregate, stats, gamesReport, wilson };
