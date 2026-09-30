#!/usr/bin/env node
/**
 * Ladder loss post-mortem, the measured half (abra/regmc 1.39.0).
 *
 * READ-ONLY over ROTOM's saved ladder games: solver/out/rotom/<run>/games/medicham32/*.{log,decisions.jsonl}.
 * Plays nothing, loads no engine, and needs a few MB of RAM. The mechanism labels are hand-read and live in
 * classifications.json beside this file; this script derives every number the report quotes about them:
 *
 *   - per run: games on the search arm, results, and which ended by a forfeit (the server's own |-message| line);
 *   - calibration: the search's root value (info.value) of every move decision against the game result, in
 *     tenths, all games and games that ended without a forfeit, turn 1 alone, and a game-clustered bootstrap of
 *     mean(value - result) for values in [0.5, 0.9);
 *   - coverage: did the opponent's actual move ids (target-agnostic) appear in one of the searched columns;
 *   - mechanism detectors on the logs, lost games against won games (Sucker Punch that failed, both actives
 *     protecting, a Protect that failed, Trick Room / Tailwind set by the opponent, a Perish faint of ours);
 *   - turning-point metrics per lost game: the highest value and the largest value drop between consecutive
 *     decisions (the last decision drops to the loss, 0).
 *
 *   node solver/results/2026-09-30-ladder-loss-postmortem/postmortem.js [--root <solver/out/rotom>] [--out <file>]
 *
 * --root defaults to the main checkout's solver/out/rotom resolved from this file, because solver/out is not
 * tracked and a worktree has none.
 */
'use strict';
const fs = require('fs'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = arg('--root', path.join(__dirname, '..', '..', 'out', 'rotom'));
const OUT = arg('--out', path.join(__dirname, 'measured.json'));
const RUNS = ['chomp1-2026-09-29T23-13-11-521Z', 'gen5ab-2026-09-26T04-06-53-848Z'];
const ME = 'medicham32';
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function parseLog(txt) {
  const L = txt.split('\n');
  let me = null, winner = null, forfeit = null, turn = 0, post = false;
  const turns = {};
  for (const l of L) {
    const p = l.split('|');
    if (p[1] === 'player' && p[3] === ME) me = p[2];
    if (p[1] === 'win') winner = p[2];
    if (p[1] === '-message' && /forfeited/.test(l)) forfeit = l.replace('|-message|', '');
    if (/timed out|lost due to inactivity/i.test(l)) forfeit = (forfeit || '') + ' TIMEOUT';
    if (p[1] === 'turn') { turn = +p[2]; turns[turn] = { opp: {}, mine: {} }; post = false; continue; }
    if (!turns[turn]) turns[turn] = { opp: {}, mine: {} };
    if (p[1] === 'upkeep') post = true;
    if (!post && (p[1] === 'move' || p[1] === 'switch' || p[1] === 'cant') && /^p[12][ab]/.test(p[2] || '')) {
      if (p[1] === 'move' && /\[from\]/.test(l) && !/\[from\]lockedmove/.test(l)) continue;
      const who = p[2].slice(0, 2) === me ? turns[turn].mine : turns[turn].opp;
      const slot = p[2][2];
      if (!(slot in who)) who[slot] = p[1] === 'move' ? norm(p[3]) : p[1];
    }
  }
  return { L, me, winner, forfeit, turns, endTurn: turn };
}
// a searched column covers the opponent's action if every acting slot's move id (or "switch") matches, slot by slot
function covers(col, opp) {
  const parts = col.split(',').map(s => norm(s.trim().split(' ')[0]));
  let n = 0;
  for (const [i, s] of [[0, 'a'], [1, 'b']]) {
    const a = opp[s], t = parts[i];
    if (!a || a === 'cant' || !t || t === 'pass') continue;
    n++; if (t !== a) return false;
  }
  return n > 0;
}

function load(run) {
  const dir = path.join(ROOT, run, 'games', ME);
  const games = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.decisions.jsonl'))) {
    const room = f.replace('.decisions.jsonl', '');
    if (!fs.existsSync(path.join(dir, room + '.log'))) continue;
    const lg = parseLog(fs.readFileSync(path.join(dir, room + '.log'), 'utf8'));
    const ds = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    const policy = (ds.find(d => d.kind === 'move') || {}).policy;
    const dec = ds.filter(d => d.kind === 'move').map(d => {
      const t = d.info && d.info.table, T = lg.turns[d.turn] || { opp: {} };
      return { turn: d.turn, v: d.info && typeof d.info.value === 'number' ? d.info.value : null, choice: d.choice,
        covered: t && t.cols && Object.keys(T.opp).length ? t.cols.some(c => covers(c, T.opp)) : null };
    });
    const pv = ds.find(d => d.kind === 'preview');
    games.push({ run, room, gnum: ds[0] && ds[0].gnum, policy, me: lg.me, won: lg.winner === ME, forfeit: lg.forfeit,
      endTurn: lg.endTurn, dec, L: lg.L, previewV: pv && pv.info && typeof pv.info.v === 'number' ? pv.info.v : null });
  }
  return games.filter(g => g.policy === 'miltank-gen5');
}

function calib(games, keepD) {
  const bins = Array.from({ length: 10 }, (_, i) => ({ lo: i / 10, n: 0, games: new Set(), sv: 0, sy: 0 }));
  let n = 0, br = 0, sy = 0; const pts = [];
  for (const g of games) for (const d of g.dec) {
    if (d.v == null || !keepD(d)) continue;
    const y = g.won ? 1 : 0, b = bins[Math.min(9, Math.floor(d.v * 10))];
    b.n++; b.games.add(g.room); b.sv += d.v; b.sy += y; n++; br += (d.v - y) ** 2; sy += y; pts.push([d.v, y]);
  }
  const base = sy / n; let bc = 0; for (const [, y] of pts) bc += (base - y) ** 2;
  const pos = pts.filter(p => p[1]).map(p => p[0]), neg = pts.filter(p => !p[1]).map(p => p[0]);
  let auc = 0; for (const a of pos) for (const b of neg) auc += a > b ? 1 : a === b ? 0.5 : 0;
  return { decisions: n, games: new Set(games.filter(g => g.dec.some(d => d.v != null && keepD(d))).map(g => g.room)).size,
    mean_value: +(pts.reduce((s, p) => s + p[0], 0) / n).toFixed(3), win_rate: +base.toFixed(3),
    brier: +(br / n).toFixed(4), brier_constant: +(bc / n).toFixed(4), auc: +(auc / (pos.length * neg.length)).toFixed(3),
    bins: bins.filter(b => b.n).map(b => ({ lo: b.lo, n: b.n, games: b.games.size, mean_value: +(b.sv / b.n).toFixed(3), win: +(b.sy / b.n).toFixed(3) })) };
}
function bootGap(games, keepD, B = 2000) {
  const G = games.map(g => g.dec.filter(d => d.v != null && keepD(d)).map(d => d.v - (g.won ? 1 : 0))).filter(x => x.length);
  const m = S => { let s = 0, n = 0; for (const x of S) for (const e of x) { s += e; n++; } return s / n; };
  let seed = 7; const r = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const bs = []; for (let b = 0; b < B; b++) { const S = []; for (let i = 0; i < G.length; i++) S.push(G[Math.floor(r() * G.length)]); bs.push(m(S)); }
  bs.sort((a, b) => a - b);
  return { games: G.length, decisions: G.reduce((s, x) => s + x.length, 0), gap: +m(G).toFixed(3), ci95: [+bs[Math.floor(B * 0.025)].toFixed(3), +bs[Math.floor(B * 0.975) - 1].toFixed(3)], seed: 7, B };
}
function detect(g) {
  const me = g.me, opp = me === 'p1' ? 'p2' : 'p1', c = { sp_used: 0, sp_failed: 0, double_protect_turns: 0, protect_failed: 0, opp_trick_room: 0, opp_tailwind: 0, my_perish_faints: 0, my_flinches: 0 };
  let prot = {};
  const flush = () => { if (prot.a && prot.b) c.double_protect_turns++; prot = {}; };
  for (let i = 0; i < g.L.length; i++) {
    const l = g.L[i], p = l.split('|'), nx = g.L[i + 1] || '';
    if (p[1] === 'turn') { flush(); continue; }
    if (p[1] === 'move' && (p[2] || '').startsWith(me)) {
      if (p[3] === 'Sucker Punch') { c.sp_used++; if (/^\|-fail\|/.test(nx)) c.sp_failed++; }
      if (p[3] === 'Protect' || p[3] === 'Detect') { prot[p[2][2]] = 1; if (/^\|-fail\|/.test(nx)) c.protect_failed++; }
    }
    if (p[1] === '-fieldstart' && /Trick Room/.test(l) && l.includes('[of] ' + opp)) c.opp_trick_room++;
    if (p[1] === '-sidestart' && /Tailwind/.test(l) && (p[2] || '').startsWith(opp)) c.opp_tailwind++;
    if (p[1] === '-start' && /perish0/.test(l) && (p[2] || '').startsWith(me)) c.my_perish_faints++;
    if (p[1] === 'cant' && (p[2] || '').startsWith(me) && p[3] === 'flinch') c.my_flinches++;
  }
  flush();
  return c;
}

const res = { generated_by: 'solver/results/2026-09-30-ladder-loss-postmortem/postmortem.js', root: 'solver/out/rotom (main checkout)', runs: {} };
const all = [];
for (const run of RUNS) {
  const games = load(run); all.push(...games);
  const normal = games.filter(g => !g.forfeit);
  const R = res.runs[run] = {
    search_arm_games: games.length, won: games.filter(g => g.won).length,
    won_by_opponent_forfeit: games.filter(g => g.won && g.forfeit).length,
    lost_without_forfeit: games.filter(g => !g.won && !g.forfeit).length,
    lost_with_forfeit: games.filter(g => !g.won && g.forfeit).length,
    calibration_all: calib(games, () => true), calibration_normal_end: calib(normal, () => true),
    calibration_turn1: calib(games, d => d.turn === 1), gap_05_09_all: bootGap(games, d => d.v >= 0.5 && d.v < 0.9),
  };
  const cov = { all: [0, 0], lost: [0, 0], won: [0, 0] };
  for (const g of games) for (const d of g.dec) if (d.covered != null) { for (const k of ['all', g.won ? 'won' : 'lost']) { cov[k][1]++; if (d.covered) cov[k][0]++; } }
  R.opponent_action_in_searched_columns = Object.fromEntries(Object.entries(cov).map(([k, [a, n]]) => [k, { covered: a, n, rate: +(a / n).toFixed(3) }]));
  const det = { lost: { games: 0 }, won_without_forfeit: { games: 0 } };
  for (const g of games) {
    const k = !g.won && !g.forfeit ? 'lost' : g.won && !g.forfeit ? 'won_without_forfeit' : null; if (!k) continue;
    det[k].games++; const c = detect(g);
    for (const [x, v] of Object.entries(c)) { det[k][x] = (det[k][x] || 0) + v; if (v) det[k]['games_with_' + x] = (det[k]['games_with_' + x] || 0) + 1; }
  }
  R.detectors = det;
  R.turning_points = games.filter(g => !g.won && !g.forfeit).sort((a, b) => a.room.localeCompare(b.room)).map(g => {
    const ds = g.dec.filter(d => d.v != null);
    let mx = null, dr = null;
    ds.forEach((d, i) => {
      if (!mx || d.v > mx.v) mx = { turn: d.turn, v: +d.v.toFixed(3), choice: d.choice };
      const drop = d.v - (i + 1 < ds.length ? ds[i + 1].v : 0);
      if (!dr || drop > dr.drop) dr = { after_turn: d.turn, from: +d.v.toFixed(3), drop: +drop.toFixed(3), choice: d.choice };
    });
    return { replay: 'https://replay.pokemonshowdown.com/' + g.room.replace(/^battle-/, ''), game: g.gnum, end_turn: g.endTurn, max_value: mx, largest_drop: dr,
      values: ds.map(d => [d.turn, +d.v.toFixed(3)]) };
  });
  if (run.startsWith('chomp1')) {
    const pv = games.filter(g => g.previewV != null);
    const f = S => ({ n: S.length, mean_value: +(S.reduce((s, g) => s + g.previewV, 0) / S.length).toFixed(3), win: +(S.filter(g => g.won).length / S.length).toFixed(3) });
    R.chomp_preview_value = { all: f(pv), normal_end: f(pv.filter(g => !g.forfeit)), v_ge_055: f(pv.filter(g => g.previewV >= 0.55)), v_lt_055: f(pv.filter(g => g.previewV < 0.55)) };
  }
}
res.pooled = { calibration_all: calib(all, () => true), calibration_normal_end: calib(all.filter(g => !g.forfeit), () => true),
  gap_05_09_all: bootGap(all, d => d.v >= 0.5 && d.v < 0.9), gap_05_09_normal_end: bootGap(all.filter(g => !g.forfeit), d => d.v >= 0.5 && d.v < 0.9),
  gap_turn1_all: bootGap(all, d => d.turn === 1) };
fs.writeFileSync(OUT, JSON.stringify(res, null, 1) + '\n');
for (const [run, R] of Object.entries(res.runs))
  console.log(`${run}: ${R.search_arm_games} search-arm games, lost without forfeit ${R.lost_without_forfeit}; calibration all Brier ${R.calibration_all.brier} vs ${R.calibration_all.brier_constant}, AUC ${R.calibration_all.auc}; value 0.5-0.9 gap ${R.gap_05_09_all.gap} ${JSON.stringify(R.gap_05_09_all.ci95)}; columns cover ${R.opponent_action_in_searched_columns.all.rate}`);
console.log(`pooled 0.5-0.9 gap ${res.pooled.gap_05_09_all.gap} ${JSON.stringify(res.pooled.gap_05_09_all.ci95)}; normal-end ${res.pooled.gap_05_09_normal_end.gap} ${JSON.stringify(res.pooled.gap_05_09_normal_end.ci95)}; turn 1 ${res.pooled.gap_turn1_all.gap} ${JSON.stringify(res.pooled.gap_turn1_all.ci95)}`);
console.log('wrote', OUT);
