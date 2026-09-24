/* solver/rotom/report.js — aggregate one local run directory (both clients) into the numbers the M3 exit test asks for.
 *
 *   node solver/rotom/report.js <out dir> [--json <file>]
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

if (require.main === module) {
  const dir = process.argv[2];
  const r = aggregate(dir);
  const i = process.argv.indexOf('--json');
  if (i >= 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(r, null, 1));
  const { series, ...head } = r;
  console.log(JSON.stringify(head, null, 1));
}
module.exports = { aggregate, stats };
