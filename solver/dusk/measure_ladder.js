/* solver/dusk/measure_ladder.js — DUSK's direct value on OUR ladder games: how many of medicham32's games pass through an
 * endgame, how many of those we LOSE from ahead or even, and what the search did there.
 *
 *   node solver/dusk/measure_ladder.js [--root <main>/solver/out/rotom] [--out solver/out/dusk/ladder.json] [--runs a,b,...]
 *
 * READ-ONLY over ROTOM's saved games (<run>/games/medicham32/<room>.log + .decisions.jsonl). No engine is loaded, no game
 * is played. The endgame predicate, the keys and the sheet-bound action count are solver/dusk/lib.js (the same code as the
 * meta measurement); the positions are solver/porygon2/v2/reveal.js over the server's own log. A run still being written
 * is read as it stands and marked `live` (a game is only counted once its log carries a result).
 *
 * The opponent's action per turn and the "covered by a searched column" test are the post-mortem's
 * (solver/results/2026-09-30-ladder-loss-postmortem/postmortem.js): move ids slot by slot, targets ignored.
 */
'use strict';
const fs = require('fs'), path = require('path');
const MAIN = 'C:/Users/willj/Projects/Pokemon/ABRA';
if (!process.env.SHOWDOWN_PATH) { const sib = path.join(MAIN, '..', 'pokemon-showdown-mc'); if (fs.existsSync(path.join(sib, 'dist', 'sim'))) process.env.SHOWDOWN_PATH = sib; }
const R = require('../porygon2/v2/reveal.js');
const L = require('./lib.js');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = arg('--root', path.join(MAIN, 'solver', 'out', 'rotom'));
const OUT = arg('--out', path.join(__dirname, '..', 'out', 'dusk', 'ladder.json'));
const ME = 'medicham32';
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function oppActions(txt, me) {
  const turns = {}; let turn = 0, post = false;
  for (const l of txt.split('\n')) {
    const p = l.split('|');
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
  return turns;
}
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

function main() {
  const runs = (arg('--runs', null) || fs.readdirSync(ROOT).filter(d => fs.existsSync(path.join(ROOT, d, 'games', ME))).join(',')).split(',').filter(Boolean).sort();
  const games = [], skipped = {};
  for (const run of runs) {
    const dir = path.join(ROOT, run, 'games', ME);
    const runJson = fs.existsSync(path.join(ROOT, run, 'run.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, run, 'run.json'), 'utf8')) : {};
    const state = fs.existsSync(path.join(ROOT, run, 'state-' + ME + '.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, run, 'state-' + ME + '.json'), 'utf8')) : {};
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.log')).sort()) {
      const room = f.replace(/\.log$/, '');
      const txt = fs.readFileSync(path.join(dir, f), 'utf8');
      const me = ((/\n?\|player\|(p[12])\|medicham32\|/.exec(txt)) || [])[1];
      if (!me) { skipped.no_player_line = (skipped.no_player_line || 0) + 1; continue; }
      let g; try { g = R.extract(txt, { mode: 'bo3' }); } catch (e) { const k = 'parse:' + (e.code || 'exception'); skipped[k] = (skipped[k] || 0) + 1; continue; }
      const lab = R.labels(g);
      if (lab.z == null) { skipped.no_result = (skipped.no_result || 0) + 1; continue; }
      const opp = me === 'p1' ? 'p2' : 'p1';
      const won = lab.z === 0.5 ? 0.5 : ((lab.z === 1) === (me === 'p1') ? 1 : 0);
      const ffm = /\|-message\|(.*) forfeited\./.exec(txt);
      const forfeitBy = ffm ? (norm(ffm[1]) === ME ? 'us' : 'opp') : null;
      const decPath = path.join(dir, room + '.decisions.jsonl');
      const ds = fs.existsSync(decPath) ? fs.readFileSync(decPath, 'utf8').split('\n').filter(Boolean).map(s => { try { return JSON.parse(s); } catch (e) { skipped.bad_decision_line = (skipped.bad_decision_line || 0) + 1; return null; } }).filter(Boolean) : [];
      const moves = ds.filter(d => d.kind === 'move');
      const policy = moves.length ? moves[0].policy : (ds[0] && ds[0].policy) || null;
      const T = oppActions(txt, me);
      const row = L.gameRow(g, lab, { id: room, fmt: 'bo3', rating: {} });
      const persp = e => e && { n: e.n, ours: e.alive[me], theirs: e.alive[opp], hp_ours: e.hp[me], hp_theirs: e.hp[opp],
        lead: Math.sign(e.alive[me] - e.alive[opp]) || 0, lead_hp: Math.sign(e.alive[me] - e.alive[opp]) || Math.sign(e.hp[me] - e.hp[opp]),
        actions: { ours: e.actions[me], theirs: e.actions[opp] }, mons: { ours: e.mons[me], theirs: e.mons[opp] }, field: e.field, decisions_left: e.decisions_left, key: e.keys.K0 };
      const dec = n0 => moves.filter(d => d.turn >= n0).map(d => {
        const t = d.info && d.info.table, O = (T[d.turn] || {}).opp || {};
        return { turn: d.turn, value: d.info && typeof d.info.value === 'number' ? +d.info.value.toFixed(3) : null, m: d.info && d.info.m, n: d.info && d.info.n,
          playouts: d.info && d.info.playouts, unfilled: d.info && d.info.unfilled, ms: d.ms, choice: d.choice,
          opp_action: O, covered: t && t.cols && Object.keys(O).length ? t.cols.some(c => covers(c, O)) : null,
          rows: t && t.rows, cols: t && t.cols };
      });
      games.push({ run, room, replay: 'https://replay.pokemonshowdown.com/' + room.replace(/^battle-/, ''), policy, arm: moves[0] && moves[0].arm, me, won, end: lab.end, forfeit_by: forfeitBy, turns: lab.turns,
        e2: persp(row.e2), e4: persp(row.e4), e1: row.e1 ? { n: row.e1.n } : null,
        e2_decisions: row.e2 ? dec(row.e2.n) : [], e4_decisions: row.e4 ? dec(row.e4.n) : [],
        run_live: state.cleanExit === false && runJson.started && run.startsWith('chomptop') });
    }
  }
  // ---------------------------------------------------------------- summary
  const isSearch = g => /miltank/.test(g.policy || '');
  const W = L.wilson;
  const sum = {};
  for (const [label, filt] of [['all', () => true], ['search_arm', isSearch], ['prior_arm', g => !isSearch(g)]]) {
    const G = games.filter(filt);
    const o = { games: G.length, won: G.filter(g => g.won === 1).length, lost: G.filter(g => g.won === 0).length,
      lost_by_our_forfeit: G.filter(g => g.won === 0 && g.forfeit_by === 'us').length, won_by_their_forfeit: G.filter(g => g.won === 1 && g.forfeit_by === 'opp').length };
    for (const def of ['e2', 'e4']) {
      const H = G.filter(g => g[def]);
      const by = {};
      for (const [lead, nm] of [[1, 'ahead'], [0, 'even'], [-1, 'behind']]) {
        const X = H.filter(g => g[def].lead === lead);
        by[nm] = { n: X.length, won: X.filter(g => g.won === 1).length, lost: X.filter(g => g.won === 0).length, win_rate: W(X.filter(g => g.won === 1).length, X.length) };
      }
      const evenHP = H.filter(g => g[def].lead === 0);
      by.even_split_by_hp = { hp_ahead: { n: evenHP.filter(g => g[def].lead_hp > 0).length, lost: evenHP.filter(g => g[def].lead_hp > 0 && g.won === 0).length },
        hp_behind: { n: evenHP.filter(g => g[def].lead_hp < 0).length, lost: evenHP.filter(g => g[def].lead_hp < 0 && g.won === 0).length } };
      const lostFromAheadOrEven = H.filter(g => g.won === 0 && g[def].lead >= 0);
      o[def] = { reached: W(H.length, G.length), by_lead: by,
        losses_through_endgame: H.filter(g => g.won === 0).length,
        losses_from_ahead_or_even: lostFromAheadOrEven.length,
        share_of_all_losses_from_ahead_or_even: W(lostFromAheadOrEven.length, o.lost),
        share_of_non_forfeit_losses_from_ahead_or_even: W(lostFromAheadOrEven.filter(g => g.forfeit_by !== 'us').length, o.lost - o.lost_by_our_forfeit),
        entry_material: L.hist(H.map(g => g[def].ours + 'v' + g[def].theirs)),
        decisions_in_endgame: L.quant(H.map(g => g[def + '_decisions'].length), [0.5, 0.9]),
        searched_cells: L.quant(H.flatMap(g => g[def + '_decisions'].filter(d => d.m).map(d => d.m * d.n)), [0.5, 0.9]),
        playouts: L.quant(H.flatMap(g => g[def + '_decisions'].filter(d => d.playouts != null).map(d => d.playouts)), [0.1, 0.5, 0.9]),
        playouts_per_wall_second: L.quant(H.flatMap(g => g[def + '_decisions'].filter(d => d.playouts != null && d.ms > 0).map(d => Math.round(d.playouts / (d.ms / 1000)))), [0.1, 0.5, 0.9]),
        decision_ms: L.quant(H.flatMap(g => g[def + '_decisions'].filter(d => d.ms > 0).map(d => d.ms)), [0.5, 0.9]),
        sheet_bound_joint_cells_at_entry: L.quant(H.filter(g => g[def].actions.ours && g[def].actions.theirs).map(g => g[def].actions.ours * g[def].actions.theirs), [0.5, 0.9]),
        sheet_bound_actions_ours_at_entry: L.quant(H.filter(g => g[def].actions.ours).map(g => g[def].actions.ours), [0.5, 0.9]),
        opp_action_in_searched_columns: (() => { const D = H.flatMap(g => g[def + '_decisions']).filter(d => d.covered != null); return W(D.filter(d => d.covered).length, D.length); })(),
      };
      // calibration of the root value inside endgames (decisions on the search arm with a value)
      const C = H.flatMap(g => g[def + '_decisions'].filter(d => d.value != null).map(d => ({ v: d.value, z: g.won, room: g.room })));
      const bins = {};
      for (const c of C) { const b = Math.min(9, Math.floor(c.v * 10)) / 10; (bins[b] = bins[b] || { n: 0, v: 0, z: 0, games: new Set() }); bins[b].n++; bins[b].v += c.v; bins[b].z += c.z; bins[b].games.add(c.room); }
      o[def].value_calibration = Object.fromEntries(Object.entries(bins).sort().map(([b, x]) => [b, { decisions: x.n, games: x.games.size, mean_value: +(x.v / x.n).toFixed(3), win_rate: +(x.z / x.n).toFixed(3) }]));
      o[def].brier = C.length ? +(C.reduce((a, c) => a + (c.v - c.z) ** 2, 0) / C.length).toFixed(4) : null;
    }
    sum[label] = o;
  }
  const losses = games.filter(g => g.won === 0 && g.e2 && g.e2.lead >= 0).map(g => ({ run: g.run, room: g.room, replay: g.replay, policy: g.policy, forfeit_by: g.forfeit_by,
    entry: { n: g.e2.n, ours: g.e2.ours, theirs: g.e2.theirs, hp_ours: g.e2.hp_ours, hp_theirs: g.e2.hp_theirs, mons: g.e2.mons, field: g.e2.field, actions: g.e2.actions },
    end_turn: g.turns, decisions: g.e2_decisions.map(d => ({ turn: d.turn, value: d.value, mxn: d.m ? d.m + 'x' + d.n : null, playouts: d.playouts, choice: d.choice, opp: d.opp_action, covered: d.covered })) }));
  const REPO = path.join(__dirname, '..', '..');
  const code = ['solver/dusk/measure_ladder.js', 'solver/dusk/lib.js', 'solver/porygon2/v2/reveal.js'].map(p => ({ path: p, sha256: require('crypto').createHash('sha256').update(fs.readFileSync(path.join(REPO, p))).digest('hex') }));
  const out = { what: 'DUSK direct value: medicham32 ladder games through an endgame (read-only over solver/out/rotom)', generated: new Date().toISOString(), code, root: ROOT.replace(/\\/g, '/'),
    runs, skipped, definitions: L.DEFINITIONS, summary: sum, losses_from_ahead_or_even_e2: losses,
    games: games.map(g => ({ run: g.run, room: g.room, policy: g.policy, won: g.won, end: g.end, forfeit_by: g.forfeit_by, turns: g.turns, e2: g.e2 && { n: g.e2.n, ours: g.e2.ours, theirs: g.e2.theirs, hp_ours: g.e2.hp_ours, hp_theirs: g.e2.hp_theirs, lead: g.e2.lead, lead_hp: g.e2.lead_hp, entry_value: (g.e2_decisions[0] || {}).value ?? null, max_value: g.e2_decisions.reduce((a, d) => d.value != null && d.value > a ? d.value : a, -1) }, e4: g.e4 && { n: g.e4.n, ours: g.e4.ours, theirs: g.e4.theirs, lead: g.e4.lead } })) };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('wrote ' + OUT + ': ' + games.length + ' games over ' + runs.length + ' runs; skipped ' + JSON.stringify(skipped));
}
main();
