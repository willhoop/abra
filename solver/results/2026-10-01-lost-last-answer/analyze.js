#!/usr/bin/env node
/* solver/results/2026-10-01-lost-last-answer/analyze.js — read the answer maps (maps.js) against the saved games and
 * test Will's hypothesis: ROTOM loses because it gives away its LAST ANSWER to a live threat. Plays nothing; reads
 * <out>/maps-*.jsonl, the saved logs and decisions, and the post-mortem's classifications.json. Writes results.json.
 *
 *   node solver/results/2026-10-01-lost-last-answer/analyze.js [--root <main>/solver/out/rotom] [--maps solver/results/2026-10-01-lost-last-answer/maps (default; maps.js writes solver/out/lost-last-answer-v1)]
 *
 * PRE-REGISTERED (written before any map was read; the brief's own threshold):
 *   answers_j       = sum over my live i of P(i beats j), from the decision's map (before the turn resolves).
 *   LAST-ANSWER LOSS = my i faints during turn t while, at the decision for turn t, some threat j that the game
 *                     revealed and that is alive had answers_j < 1.2 and P(i beats j) >= 0.5, and j is still standing at
 *                     the end of turn t.   STRICT: additionally answers_j - P(i beats j) < 0.5 (without i, j is unanswered).
 *   UNANSWERED       = answers_j < 0.5.
 *   Alternatives at turn t: i active -> a legal switch, a legal stalling move (the menu at the rebuilt position);
 *                     i switched in that turn -> any row that does not bring i in. The table's word on each is the row
 *                     mean (and mix) of the best such row against the chosen row's.
 */
'use strict';
const fs = require('fs'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const HERE = __dirname, WT = path.join(HERE, '..', '..', '..');
/* solver/out is not tracked and a worktree has none: this checkout's own, else the main checkout's */
const ROOT = arg('--root', fs.existsSync(path.join(WT, 'solver', 'out', 'rotom')) ? path.join(WT, 'solver', 'out', 'rotom') : 'C:/Users/willj/Projects/Pokemon/ABRA/solver/out/rotom');
const MAPS = arg('--maps', path.join(HERE, 'maps'));   // the tracked copy of solver/out/lost-last-answer-v1 (1.4 MB)
const OUT = arg('--out', path.join(HERE, 'results.json'));
const ME = 'medicham32';
const NEAR = 1.2, IS_ANS = 0.5, UNANS = 0.5;
const CLS = require(path.join(WT, 'solver', 'results', '2026-09-30-ladder-loss-postmortem', 'classifications.json'));
const replayOf = room => 'https://replay.pokemonshowdown.com/' + room.replace(/^battle-/, '');
const r3 = x => x == null ? null : +x.toFixed(3);

/* ---- the log: who fainted when, who switched in by choice, the result ---- */
function readLog(file, me) {
  const L = fs.readFileSync(file, 'utf8').replace(/\r/g, '').split('\n');
  const opp = me === 'p1' ? 'p2' : 'p1';
  let turn = 0, post = false, winner = null, forfeit = null;
  const faint = { [me]: {}, [opp]: {} }, switchedIn = {};   // nick -> turn
  for (const l of L) {
    const p = l.split('|');
    if (p[1] === 'turn') { turn = +p[2]; post = false; continue; }
    if (p[1] === 'upkeep') post = true;
    if (p[1] === 'win') winner = p[2];
    if (p[1] === '-message' && /forfeited/.test(l)) forfeit = l;
    const id = /^(p[12])[ab]: (.*)$/.exec(p[2] || '');
    if (!id) continue;
    if (p[1] === 'faint' && faint[id[1]][id[2]] == null) faint[id[1]][id[2]] = turn;
    if (p[1] === 'switch' && id[1] === me && !post && turn > 0) (switchedIn[turn] = switchedIn[turn] || []).push(id[2]);
  }
  return { L, faint, switchedIn, won: winner === ME, forfeit: !!forfeit, endTurn: turn };
}
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
require(path.join(WT, 'solver', 'arena', 'env.js'));
const { parseShowteam } = require(path.join(WT, 'solver', 'human', 'parse_game.js'));

function loadAll() {
  const games = new Map();
  for (const f of fs.readdirSync(MAPS).filter(f => /^maps-.*\.jsonl$/.test(f))) {
    for (const l of fs.readFileSync(path.join(MAPS, f), 'utf8').split('\n').filter(Boolean)) {
      let r; try { r = JSON.parse(l); } catch (e) { continue; }
      if (r.error) { (games.get(r.room) || games.set(r.room, { room: r.room, recs: [], errors: 0 }).get(r.room)).errors++; continue; }
      const g = games.get(r.room) || games.set(r.room, { room: r.room, recs: [], errors: 0 }).get(r.room);
      g.run = r.run; g.me = r.me; g.policy = g.policy || r.policy; g.recs.push(r);
    }
  }
  for (const g of games.values()) {
    if (!g.run) continue;
    const dir = path.join(ROOT, g.run, 'games', ME), log = path.join(dir, g.room + '.log');
    const txt = fs.readFileSync(log, 'utf8').replace(/\r/g, '');
    const lg = readLog(log, g.me);
    const sh = {}; for (const l of txt.split('\n')) { const p = l.split('|'); if (p[1] === 'showteam') sh[p[2]] = parseShowteam(p.slice(3).join('|')); }
    g.sheets = sh; g.lg = lg; g.won = lg.won; g.forfeit = lg.forfeit;
    g.recs.sort((a, b) => a.turn - b.turn);
    g.gnum = g.recs[0] && g.recs[0].gnum;
  }
  return [...games.values()].filter(g => g.run && g.recs.length);
}

/* row-level read of the search table for slot s of my side */
const parts = row => String(row).split(',').map(x => x.trim());
function preservesActive(row, s, act) {
  const p = parts(row)[s] || '';
  if (/^switch/.test(p)) return 'switch';
  const m = /^move (\d+)/.exec(p);
  if (m && act.stall.includes(act.moves[+m[1] - 1])) return 'protect';
  return null;
}

function analyse(games) {
  const events = [], faintsAll = [];
  for (const g of games) {
    const opp = g.me === 'p1' ? 'p2' : 'p1';
    const nickMe = s => g.sheets[g.me][s] && g.sheets[g.me][s].nick, nickOp = s => g.sheets[opp][s] && g.sheets[opp][s].nick;
    for (let k = 0; k < g.recs.length; k++) {
      const r = g.recs[k], t = r.turn;
      for (let i = 0; i < r.mine.length; i++) {
        const mi = r.mine[i], ft = g.lg.faint[g.me][nickMe(mi.sheet)];
        if (ft !== t) continue;
        /* the threats it answered */
        const hits = [];
        r.theirs.forEach((tj, j) => {
          if (!tj.revealedEver) return;
          const Pij = r.P[i][j], A = r.answers[j];
          const jf = g.lg.faint[opp][nickOp(tj.sheet)];
          const jAlive = jf == null || jf > t;
          if (Pij >= IS_ANS && A < NEAR && jAlive) hits.push({ threat: tj.name, threat_hp: tj.hp, P: Pij, answers: A, without: r3(A - Pij), strict: A - Pij < UNANS, threat_fainted_turn: jf == null ? null : jf });
        });
        const act = (r.actives || []).find(a => a && a.sheet === mi.sheet) || null;
        const swIn = (g.lg.switchedIn[t] || []).includes(nickMe(mi.sheet));
        const next = g.recs.find(x => x.turn > t) || null;
        const f = { run: g.run, room: g.room, replay: replayOf(g.room), gnum: g.gnum, policy: g.policy, won: g.won, forfeit: g.forfeit,
          turn: t, mon: mi.name, mon_hp: mi.hp, our_live: r.mine.length, contested: r.mine.length >= 2 && (r.value == null || r.value >= 0.15), value: r.value, value_next: next ? next.value : null, active: !!act, switched_in: swIn,
          last_answer_to: hits };
        faintsAll.push(f);
        if (!hits.length) continue;
        /* the alternatives, and what the table said */
        const tb = r.table, alt = { legal_switch: act ? act.canSwitch : null, legal_stall: act ? act.stall : null };
        if (tb && tb.rows) {
          const chosen = tb.rows.indexOf(r.choice);
          const pres = tb.rows.map((row, x) => {
            if (act) return preservesActive(row, act.slot, act);
            const pos = mi.team + 1;                       // request position at build time (mine is in request order)
            return parts(row).some(p => p === 'switch ' + pos) ? null : 'no-switch-in';
          });
          const keep = pres.map((p, x) => p ? x : -1).filter(x => x >= 0);
          const best = keep.sort((a, b) => tb.row_mean[b] - tb.row_mean[a])[0];
          Object.assign(alt, { table_rows: tb.rows.length, chosen_row: chosen >= 0 ? tb.rows[chosen] : r.choice,
            chosen_row_mean: chosen >= 0 ? tb.row_mean[chosen] : null, chosen_mix: chosen >= 0 ? tb.mix[chosen] : null,
            preserving_rows_in_table: keep.length, best_preserving_row: best != null ? tb.rows[best] : null, best_preserving_kind: best != null ? pres[best] : null,
            best_preserving_row_mean: best != null ? tb.row_mean[best] : null, best_preserving_mix: best != null ? tb.mix[best] : null,
            chosen_was_preserving: chosen >= 0 ? !!pres[chosen] : null, table_value: tb.value != null ? tb.value : r.value });
        }
        events.push(Object.assign({}, f, { alt }));
      }
    }
  }
  return { events, faintsAll };
}

/* ---- small stats ---- */
function auc(pts) {
  const pos = pts.filter(p => p[1] === 1).map(p => p[0]), neg = pts.filter(p => p[1] === 0).map(p => p[0]);
  let a = 0; for (const x of pos) for (const y of neg) a += x > y ? 1 : x === y ? 0.5 : 0;
  return pos.length && neg.length ? +(a / (pos.length * neg.length)).toFixed(3) : null;
}
function logit(X, y, lam = 1e-2, iters = 50) {             // Newton, standardised inside, intercept unpenalised
  const d = X[0].length, mu = [], sd = [];
  for (let c = 0; c < d; c++) { const v = X.map(x => x[c]); const m = v.reduce((s, z) => s + z, 0) / v.length; mu.push(m); sd.push(Math.sqrt(v.reduce((s, z) => s + (z - m) ** 2, 0) / v.length) || 1); }
  const Z = X.map(x => [1].concat(x.map((z, c) => (z - mu[c]) / sd[c])));
  let w = new Array(d + 1).fill(0);
  for (let it = 0; it < iters; it++) {
    const g = new Array(d + 1).fill(0), H = Array.from({ length: d + 1 }, () => new Array(d + 1).fill(0));
    for (let n = 0; n < Z.length; n++) {
      const z = Z[n], p = 1 / (1 + Math.exp(-z.reduce((s, v, c) => s + v * w[c], 0))), q = p * (1 - p);
      for (let a = 0; a <= d; a++) { g[a] += (p - y[n]) * z[a]; for (let b = 0; b <= d; b++) H[a][b] += q * z[a] * z[b]; }
    }
    for (let a = 1; a <= d; a++) { g[a] += lam * w[a]; H[a][a] += lam; }
    const step = solve(H, g); let mx = 0;
    for (let a = 0; a <= d; a++) { w[a] -= step[a]; mx = Math.max(mx, Math.abs(step[a])); }
    if (mx < 1e-8) break;
  }
  return x => 1 / (1 + Math.exp(-([1].concat(x.map((z, c) => (z - mu[c]) / sd[c]))).reduce((s, v, c) => s + v * w[c], 0)));
}
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const v = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / v; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-12));
}
/* leave-one-game-out predictions for feature set fs over rows {game, y, x:{...}} */
function logo(rows, fsel) {
  const gs = [...new Set(rows.map(r => r.game))], pred = new Array(rows.length);
  for (const g of gs) {
    const tr = rows.filter(r => r.game !== g); if (!tr.length || new Set(tr.map(r => r.y)).size < 2) { rows.forEach((r, k) => { if (r.game === g) pred[k] = 0.5; }); continue; }
    const f = logit(tr.map(r => fsel(r)), tr.map(r => r.y));
    rows.forEach((r, k) => { if (r.game === g) pred[k] = f(fsel(r)); });
  }
  return pred;
}
const ll = (p, y) => -(y ? Math.log(Math.max(1e-9, p)) : Math.log(Math.max(1e-9, 1 - p)));
function bootDiff(rows, pa, pb, B = 2000) {                 // game-clustered: mean log-loss(a) - log-loss(b)
  const byG = new Map(); rows.forEach((r, k) => { const v = byG.get(r.game) || []; v.push(ll(pa[k], r.y) - ll(pb[k], r.y)); byG.set(r.game, v); });
  const G = [...byG.values()]; let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const m = S => { let s = 0, n = 0; for (const x of S) for (const e of x) { s += e; n++; } return s / n; };
  const bs = []; for (let b = 0; b < B; b++) { const S = []; for (let i = 0; i < G.length; i++) S.push(G[Math.floor(rnd() * G.length)]); bs.push(m(S)); }
  bs.sort((a, b) => a - b);
  return { diff: +m(G).toFixed(4), ci95: [+bs[Math.floor(B * 0.025)].toFixed(4), +bs[Math.floor(B * 0.975) - 1].toFixed(4)], games: G.length, B, seed: 11 };
}

/* game-clustered bootstrap of mean(x | group a) - mean(x | group b); items { game, a: bool, x } */
function bootGroups(items, B = 2000) {
  const byG = new Map(); for (const it of items) { const v = byG.get(it.game) || []; v.push(it); byG.set(it.game, v); }
  const G = [...byG.values()]; let seed = 23; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const d = S => { let sa = 0, na = 0, sb = 0, nb = 0; for (const g of S) for (const it of g) { if (it.a) { sa += it.x; na++; } else { sb += it.x; nb++; } } return na && nb ? sa / na - sb / nb : NaN; };
  const bs = []; for (let b = 0; b < B; b++) { const S = []; for (let i = 0; i < G.length; i++) S.push(G[Math.floor(rnd() * G.length)]); const v = d(S); if (!Number.isNaN(v)) bs.push(v); }
  bs.sort((a, b) => a - b);
  return { diff: r3(d(G)), ci95: [r3(bs[Math.floor(bs.length * 0.025)]), r3(bs[Math.floor(bs.length * 0.975) - 1])], n_a: items.filter(i => i.a).length, n_b: items.filter(i => !i.a).length, games: G.length, B, seed: 23 };
}

function main() {
  const games = loadAll();
  const { events, faintsAll } = analyse(games);
  const res = { generated_by: 'solver/results/2026-10-01-lost-last-answer/analyze.js', maps: MAPS, root: ROOT, release: 'eaa5becc54eb',
    thresholds: { near_last: NEAR, is_answer: IS_ANS, unanswered: UNANS }, meta: fs.readdirSync(MAPS).filter(f => /^maps-meta.*.json$/.test(f)).sort().map(f => Object.assign({ file: f }, JSON.parse(fs.readFileSync(path.join(MAPS, f), 'utf8')))) };
  /* coverage */
  const byRun = {};
  for (const g of games) { const k = g.run.split('-')[0] + ':' + g.policy; const b = byRun[k] = byRun[k] || { games: 0, decisions: 0, won: 0, lost_no_ff: 0, won_no_ff: 0, build_errors: 0 };
    b.games++; b.decisions += g.recs.length; b.won += g.won ? 1 : 0; b.lost_no_ff += !g.won && !g.forfeit ? 1 : 0; b.won_no_ff += g.won && !g.forfeit ? 1 : 0; b.build_errors += g.errors; }
  res.coverage = byRun;
  /* counters from the workers */
  const cnt = {}; for (const f of fs.readdirSync(MAPS).filter(f => /^counters-.*-w\d+\.json$/.test(f))) { const c = JSON.parse(fs.readFileSync(path.join(MAPS, f), 'utf8')); for (const blk of ['C', 'AM', 'world']) for (const [k, v] of Object.entries(c[blk] || {})) if (typeof v === 'number') cnt[blk + '.' + k] = (cnt[blk + '.' + k] || 0) + v; }
  res.counters = cnt;

  /* ---- step 3: frequency, losses vs wins, win rate after, the alternatives, the 26 losses: run on ALL events and on
   * CONTESTED ones (my side had 2+ live bodies and the search value was >= 0.15: the last body of a lost endgame is
   * trivially the last answer, and this exclusion was added after the first 18 games showed it, so both are reported) */
  function step3(events, faintsAll) {
    const R = {};
    const evGames = new Set(events.map(e => e.room)), strictGames = new Set(events.filter(e => e.last_answer_to.some(h => h.strict)).map(e => e.room));
    const grp = (pred) => { const G = games.filter(pred); return { games: G.length, with_event: G.filter(g => evGames.has(g.room)).length, with_strict: G.filter(g => strictGames.has(g.room)).length }; };
    const gpol = (g) => g.policy === 'miltank-gen5';
    R.frequency = {
      all_lost_no_forfeit: grp(g => !g.won && !g.forfeit), all_won_no_forfeit: grp(g => g.won && !g.forfeit), all_won_by_forfeit: grp(g => g.won && g.forfeit), all_lost_by_forfeit: grp(g => !g.won && g.forfeit),
      search_lost_no_forfeit: grp(g => gpol(g) && !g.won && !g.forfeit), search_won_no_forfeit: grp(g => gpol(g) && g.won && !g.forfeit),
    };
    const wr = (G) => ({ n: G.length, won: G.filter(g => g.won).length, rate: G.length ? r3(G.filter(g => g.won).length / G.length) : null });
    R.win_rate_after = {
      games_with_event: wr(games.filter(g => evGames.has(g.room))), games_without_event: wr(games.filter(g => !evGames.has(g.room))),
      games_with_strict: wr(games.filter(g => strictGames.has(g.room))),
    };
    /* the honest control: every faint of ours, last-answer or not, with the search value before it (search arm) */
    const ctl = (F) => { const v = F.filter(f => f.value != null); return { faints: F.length, games: new Set(F.map(f => f.room)).size,
      win_rate: r3(F.filter(f => f.won).length / (F.length || 1)), mean_value_before: v.length ? r3(v.reduce((s, f) => s + f.value, 0) / v.length) : null,
      mean_value_next: (() => { const w = F.filter(f => f.value_next != null); return w.length ? r3(w.reduce((s, f) => s + f.value_next, 0) / w.length) : null; })(),
      residual_won_minus_value: v.length ? r3(v.reduce((s, f) => s + ((f.won ? 1 : 0) - f.value), 0) / v.length) : null };
    };
    R.faint_control = {
      last_answer_faints: ctl(faintsAll.filter(f => f.last_answer_to.length)),
      strict_last_answer_faints: ctl(faintsAll.filter(f => f.last_answer_to.some(h => h.strict))),
      other_faints: ctl(faintsAll.filter(f => !f.last_answer_to.length)),
      all_faints: ctl(faintsAll),
    };
    /* alternatives */
    const S = events.filter(e => e.alt && e.alt.table_rows);
    R.alternatives = {
      events: events.length, with_table: S.length,
      active_at_decision: events.filter(e => e.active).length, switched_in_that_turn: events.filter(e => e.switched_in).length,
      legal_switch: events.filter(e => e.alt.legal_switch).length, legal_stall: events.filter(e => e.alt.legal_stall && e.alt.legal_stall.length).length,
      neither_legal: events.filter(e => e.active && !e.alt.legal_switch && !(e.alt.legal_stall || []).length).length,
      chosen_was_preserving: S.filter(e => e.alt.chosen_was_preserving).length,
      preserving_row_in_table: S.filter(e => e.alt.preserving_rows_in_table > 0 && !e.alt.chosen_was_preserving).length,
      preserving_row_rated_higher: S.filter(e => !e.alt.chosen_was_preserving && e.alt.best_preserving_row_mean != null && e.alt.best_preserving_row_mean > e.alt.chosen_row_mean).length,
      no_preserving_row_in_table: S.filter(e => !e.alt.preserving_rows_in_table).length,
      mean_gap_chosen_minus_best_preserving: (() => { const z = S.filter(e => !e.alt.chosen_was_preserving && e.alt.best_preserving_row_mean != null); return z.length ? r3(z.reduce((s, e) => s + (e.alt.chosen_row_mean - e.alt.best_preserving_row_mean), 0) / z.length) : null; })(),
    };
  
    /* ---- the post-mortem's 26 chomp1 losses ---- */
    const byReplay = new Map(games.map(g => [replayOf(g.room), g]));
    R.postmortem_losses = CLS.losses.map(c => {
      const g = [...byReplay.entries()].find(([u]) => u === c.replay || u.startsWith(c.replay + '-') || c.replay.startsWith(u))?.[1];
      if (!g) return { n: c.n, replay: c.replay, class: c.class, mapped: false };
      const ev = events.filter(e => e.room === g.room);
      const at = ev.filter(e => Math.abs(e.turn - c.tp_turn) <= 1), before = ev.filter(e => e.turn < c.tp_turn - 1), after = ev.filter(e => e.turn > c.tp_turn + 1);
      return { n: c.n, replay: c.replay, class: c.class, also: c.also, tp_turn: c.tp_turn, mapped: true, events: ev.map(e => ({ turn: e.turn, mon: e.mon, to: e.last_answer_to.map(h => h.threat + ' (A ' + h.answers + ', P ' + h.P + ')').join('; '), strict: e.last_answer_to.some(h => h.strict) })),
        at_turning_point: at.length > 0, strict_at_turning_point: at.some(e => e.last_answer_to.some(h => h.strict)), before_tp: before.length > 0, after_tp: after.length > 0 };
    });
    const pm = R.postmortem_losses.filter(x => x.mapped);
    const byClass = {}; for (const x of pm) { const b = byClass[x.class] = byClass[x.class] || { n: 0, at_tp: 0, strict_at_tp: 0, any: 0 }; b.n++; b.at_tp += x.at_turning_point ? 1 : 0; b.strict_at_tp += x.strict_at_turning_point ? 1 : 0; b.any += x.events.length ? 1 : 0; }
    R.postmortem_summary = { mapped: pm.length, any_event: pm.filter(x => x.events.length).length, at_turning_point: pm.filter(x => x.at_turning_point).length,
      strict_at_turning_point: pm.filter(x => x.strict_at_turning_point).length, only_after_tp: pm.filter(x => x.events.length && !x.at_turning_point && !x.before_tp).length, by_class: byClass };
    R.per_faint = { lost: rate(faintsAll.filter(f => !f.won && !f.forfeit)), won: rate(faintsAll.filter(f => f.won && !f.forfeit)) };
    return R;
  }
  const rate = F => ({ faints: F.length, last_answer: F.filter(f => f.last_answer_to.length).length, share: r3(F.filter(f => f.last_answer_to.length).length / (F.length || 1)) });
  res.all = step3(events, faintsAll);
  /* is a last-answer faint WORSE than any other faint of ours, at the same search value? residual = won - value before */
  const resid = F => F.filter(f => f.value != null).map(f => ({ game: f.room, a: f.last_answer_to.length > 0, x: (f.won ? 1 : 0) - f.value }));
  const drop = F => F.filter(f => f.value != null && f.value_next != null).map(f => ({ game: f.room, a: f.last_answer_to.length > 0, x: f.value_next - f.value }));
  res.faint_contrast = { all: { residual: bootGroups(resid(faintsAll)), value_change: bootGroups(drop(faintsAll)) },
    contested: { residual: bootGroups(resid(faintsAll.filter(f => f.contested))), value_change: bootGroups(drop(faintsAll.filter(f => f.contested))) } };
  res.contested = step3(events.filter(e => e.contested), faintsAll.filter(f => f.contested));


  /* ---- step 4: does the map predict? ---- */
  const rows = [];
  for (const g of games) for (const r of g.recs) {
    const th = r.theirs.map((t, j) => ({ t, A: r.answers[j] })).filter(x => x.t.revealedEver);
    if (!th.length || !r.mine.length) continue;
    const ours = r.threats;                                   // their expected answers to each of mine
    rows.push({ game: g.room, run: g.run, policy: g.policy, won: g.won, forfeit: g.forfeit, y: g.won ? 1 : 0, turn: r.turn, value: r.value,
      minA: Math.min(...th.map(x => x.A)), nUnans: th.filter(x => x.A < UNANS).length, nUnansOurs: ours.filter(a => a < UNANS).length,
      sumA: th.reduce((s, x) => s + Math.min(x.A, 2), 0), material: r.mine.length - r.theirs.length,
      threatsSurvive: th.filter(x => x.A < UNANS).map(x => { const opp = g.me === 'p1' ? 'p2' : 'p1'; const nk = g.sheets[opp][x.t.sheet] && g.sheets[opp][x.t.sheet].nick; return g.lg.faint[opp][nk] == null; }) });
  }
  const bucket = (lo, hi) => {
    const R = []; for (const g of games) for (const r of g.recs) r.theirs.forEach((t, j) => { if (t.revealedEver && r.answers[j] >= lo && r.answers[j] < hi) {
      const opp = g.me === 'p1' ? 'p2' : 'p1'; const nk = g.sheets[opp][t.sheet] && g.sheets[opp][t.sheet].nick;
      R.push({ won: g.won, forfeit: g.forfeit, survived: g.lg.faint[opp][nk] == null, room: g.room }); } });
    const nf = R.filter(x => !x.forfeit);
    return { lo, hi, threat_decisions: R.length, games: new Set(R.map(x => x.room)).size, we_lost: r3(R.filter(x => !x.won).length / (R.length || 1)),
      threat_survived_game: r3(R.filter(x => x.survived).length / (R.length || 1)), no_forfeit: { n: nf.length, we_lost: r3(nf.filter(x => !x.won).length / (nf.length || 1)), threat_survived_game: r3(nf.filter(x => x.survived).length / (nf.length || 1)) } };
  };
  res.threat_buckets = [[0, 0.5], [0.5, 1.2], [1.2, 2], [2, 99]].map(([a, b]) => bucket(a, b));
  const posBuckets = (pred) => { const R = rows.filter(pred); return { decisions: R.length, games: new Set(R.map(r => r.game)).size, win: r3(R.filter(r => r.y).length / (R.length || 1)) }; };
  res.position = { any_unanswered_threat: posBuckets(r => r.nUnans > 0), no_unanswered_threat: posBuckets(r => r.nUnans === 0),
    any_unanswered_threat_no_ff: posBuckets(r => r.nUnans > 0 && !r.forfeit), no_unanswered_threat_no_ff: posBuckets(r => r.nUnans === 0 && !r.forfeit) };
  /* within value bins (search arm): does an unanswered threat move the win rate at the same value? */
  const sv = rows.filter(r => r.value != null);
  res.within_value_bins = [[0, 0.3], [0.3, 0.5], [0.5, 0.7], [0.7, 0.9], [0.9, 1.01]].map(([a, b]) => {
    const B = sv.filter(r => r.value >= a && r.value < b); const w = B.filter(r => r.nUnans > 0), o = B.filter(r => r.nUnans === 0);
    const f = X => ({ n: X.length, mean_value: X.length ? r3(X.reduce((s, r) => s + r.value, 0) / X.length) : null, win: X.length ? r3(X.filter(r => r.y).length / X.length) : null });
    return { lo: a, hi: b, with_unanswered: f(w), without: f(o) };
  });
  /* the overconfident band: at search values in [0.5, 0.9), does an unanswered threat mark the games that are lost? */
  const mid = sv.filter(r => r.value >= 0.5 && r.value < 0.9);
  res.mid_band = { win_with_minus_without: bootGroups(mid.map(r => ({ game: r.game, a: r.nUnans > 0, x: r.y }))),
    overconfidence_with_minus_without: bootGroups(mid.map(r => ({ game: r.game, a: r.nUnans > 0, x: r.value - r.y }))),
    overconfidence_with: r3(mid.filter(r => r.nUnans > 0).reduce((s, r) => s + r.value - r.y, 0) / (mid.filter(r => r.nUnans > 0).length || 1)),
    overconfidence_without: r3(mid.filter(r => r.nUnans === 0).reduce((s, r) => s + r.value - r.y, 0) / (mid.filter(r => r.nUnans === 0).length || 1)) };
  /* leave-one-game-out logistic: does the map add to the search's value? (search-arm decisions with a value) */
  const FS = { value: r => [r.value], value_plus_map: r => [r.value, r.minA, r.nUnans, r.nUnansOurs, r.sumA], material: r => [r.material], map_only: r => [r.minA, r.nUnans, r.nUnansOurs, r.sumA], material_plus_map: r => [r.material, r.minA, r.nUnans, r.nUnansOurs, r.sumA] };
  const evalSet = (R, keys) => { const P = {}; for (const k of keys) P[k] = logo(R, FS[k]); const out = { decisions: R.length, games: new Set(R.map(r => r.game)).size, models: {} };
    for (const k of keys) out.models[k] = { logloss: r3(R.reduce((s, r, i) => s + ll(P[k][i], r.y), 0) / R.length), auc: auc(R.map((r, i) => [P[k][i], r.y])) };
    return { out, P }; };
  const E1 = evalSet(sv, ['value', 'value_plus_map', 'material', 'map_only', 'material_plus_map']);
  E1.out.value_minus_value_plus_map = bootDiff(sv, E1.P.value, E1.P.value_plus_map);
  E1.out.material_minus_material_plus_map = bootDiff(sv, E1.P.material, E1.P.material_plus_map);
  E1.out.raw_auc = { value: auc(sv.map(r => [r.value, r.y])), minA: auc(sv.map(r => [r.minA, r.y])), neg_nUnans: auc(sv.map(r => [-r.nUnans, r.y])) };
  res.predictive_search_arm = E1.out;
  const svn = sv.filter(r => !r.forfeit);
  const E2 = evalSet(svn, ['value', 'value_plus_map']); E2.out.value_minus_value_plus_map = bootDiff(svn, E2.P.value, E2.P.value_plus_map);
  res.predictive_search_arm_no_forfeit = E2.out;
  const E3 = evalSet(rows, ['material', 'material_plus_map']); E3.out.material_minus_material_plus_map = bootDiff(rows, E3.P.material, E3.P.material_plus_map);
  res.predictive_all_decisions = E3.out;

  res.events = events;
  res.faints = faintsAll.length;
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ coverage: res.coverage, counters: res.counters, all: Object.assign({}, res.all, { postmortem_losses: undefined }), contested: Object.assign({}, res.contested, { postmortem_losses: undefined }),
    threat_buckets: res.threat_buckets, position: res.position, within_value_bins: res.within_value_bins, faint_contrast: res.faint_contrast, mid_band: res.mid_band, predictive_search_arm: res.predictive_search_arm, predictive_no_ff: res.predictive_search_arm_no_forfeit, predictive_all: res.predictive_all_decisions }, null, 1));
  console.log('wrote', OUT, events.length, 'events');
}
main();
