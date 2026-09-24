/* ABRA-HEAP: 2500  (lownode.cmd caps the heap from this line)
 * solver/xatu/eval_bring.js — fit XATU's back-two prior on the earlier games, evaluate turn by turn on the
 * later ones.
 *
 *   node solver/xatu/eval_bring.js [--human <dir>] [--test-frac 0.2] [--iters 300]
 *
 * Reads the human dataset READ ONLY (default: the main checkout's solver/out/human/games.jsonl, found from
 * this worktree's path). Writes solver/out/xatu/bring-eval.json and the fitted model to
 * solver/xatu/model/bring-v1.json.
 *
 * SPLIT: by time, whole series kept together — every game of the last `test-frac` of series (ordered by
 * the series' first upload) is held out. Features are computed ONLINE: a game's features read only games
 * uploaded strictly before it, in both periods, which is what the live bot will have.
 *
 * TARGET: the members a side revealed by the end of the game. When all four were revealed the back pair is
 * known; otherwise the likelihood is the mass on every pair consistent with what was revealed (the same
 * coarsening-at-random likelihood the fit uses). Both are reported.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { BringMemory, BringModel, condition, fit, pairsOf, key2, FEATURES } = require('./bring.js');

const ROOT = path.join(__dirname, '..', '..');
const MAIN = ROOT.includes(path.sep + '.claude' + path.sep) ? ROOT.split(path.sep + '.claude' + path.sep)[0] : ROOT;

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

async function extract(humanDir) {
  const src = path.join(humanDir, 'games.jsonl');
  const recs = [];
  const rl = readline.createInterface({ input: fs.createReadStream(src, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const { game: G, turns } = JSON.parse(line);
    const seenAt = { p1: Array(6).fill(null), p2: Array(6).fill(null) };
    for (const t of turns) for (const s of ['p1', 'p2']) for (const m of t.state.sides[s].mons) if (m.seen && seenAt[s][m.i] == null) seenAt[s][m.i] = t.n;
    const after = (turns.length ? turns[turns.length - 1].n : 0) + 1;
    for (const s of ['p1', 'p2']) for (const i of G.brought_seen[s] || []) if (seenAt[s][i] == null) seenAt[s][i] = after;
    recs.push({
      id: G.id, t: G.uploadtime, series: G.series ? G.series.id : null, gnum: G.series ? G.series.game : 1,
      players: { p1: G.players.p1.name, p2: G.players.p2.name }, winner: G.winner,
      sheets: { p1: G.sheets.p1.map(m => ({ sp: m.species_id, item: m.item })), p2: G.sheets.p2.map(m => ({ sp: m.species_id, item: m.item })) },
      leads: G.leads, final: G.brought_seen, complete: G.bring_complete, turns: turns.length, seenAt,
    });
  }
  return { recs, src };
}

/* ---- baselines ---- */
function freqPrior(mem, rec, side, cands) {
  const sp = rec.sheets[side].map(m => m.sp);
  const w = cands.map(c => { const a = mem.rate(sp[c.pair[0]]), b = mem.rate(sp[c.pair[1]]); return (a / (1 - a)) * (b / (1 - b)); });
  const z = w.reduce((x, y) => x + y, 0);
  return cands.map((c, i) => ({ pair: c.pair, p: w[i] / z }));
}
function sheetFreqPrior(mem, rec, side, cands) {
  const sh = rec.sheets[side];
  const T = mem.team.get(BringMemory.teamSig(sh));
  if (!T) return freqPrior(mem, rec, side, cands);
  const w = cands.map(c => (T.pairs.get(key2(sh[c.pair[0]].sp, sh[c.pair[1]].sp)) || 0) + 0.5);
  const z = w.reduce((x, y) => x + y, 0);
  return cands.map((c, i) => ({ pair: c.pair, p: w[i] / z }));
}
const uniformPrior = cands => cands.map(c => ({ pair: c.pair, p: 1 / cands.length }));

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

async function main() {
  const humanDir = flag('--human', path.join(MAIN, 'solver', 'out', 'human'));
  const testFrac = +flag('--test-frac', 0.2);
  const iters = +flag('--iters', 300);
  const t0 = Date.now();
  const { recs, src } = await extract(humanDir);
  process.stderr.write(`extracted ${recs.length} games in ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  recs.sort((a, b) => a.t - b.t || (a.gnum - b.gnum));
  // series split
  const firstT = new Map();
  for (const r of recs) { const k = r.series || r.id; if (!firstT.has(k)) firstT.set(k, r.t); }
  const seriesOrder = [...firstT.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
  const cut = Math.floor(seriesOrder.length * (1 - testFrac));
  const testSeries = new Set(seriesOrder.slice(cut));
  const isTest = r => testSeries.has(r.series || r.id);

  // online pass: features before each game, then add it
  const mem = new BringMemory();
  const train = [], test = [];
  for (const r of recs) {
    for (const side of ['p1', 'p2']) {
      const leads = r.leads[side];
      if (!leads || leads.length !== 2) continue;
      const cands = mem.features(r, side, leads);
      const backSeen = r.final[side].filter(i => !leads.includes(i));
      const consistent = new Set(cands.map((c, i) => (backSeen.every(b => c.pair.includes(b)) ? i : -1)).filter(i => i >= 0));
      const item = { rec: r, side, leads, sh: r.sheets[side], cands, consistent, backSeen,
        freq: freqPrior(mem, r, side, cands), sheetFreq: sheetFreqPrior(mem, r, side, cands) };
      (isTest(r) ? test : train).push(item);
    }
    mem.addGame(r);
  }
  process.stderr.write(`train sides ${train.length}, test sides ${test.length}\n`);
  const { model, ll } = fit(train, { iters, log: s => process.stderr.write(s + '\n') });

  // ---- evaluation, turn by turn ----
  const ARMS = ['xatu', 'uniform', 'freq', 'sheetfreq'];
  const byTurn = {};             // k -> arm -> {n, ll_marg, n_complete, ll_true, top1}
  const ruledOut = [];
  const calib = { turn1: [], all: [] };  // [p, y] for complete sides
  const perSide = [];            // for the clustered bootstrap: {player, d: {arm: ll_marg at turn 1}}
  const maxK = 12;
  for (const it of test) {
    const r = it.rec, s = it.side;
    const priors = { xatu: model.prior(it.sh, it.cands), uniform: uniformPrior(it.cands), freq: it.freq, sheetfreq: it.sheetFreq };
    const truthIdx = r.complete[s] ? it.cands.findIndex(c => it.backSeen.length === 2 && c.pair.includes(it.backSeen[0]) && c.pair.includes(it.backSeen[1])) : -1;
    const lastK = Math.min(maxK, Math.max(1, r.turns));
    const rowSide = { player: r.players[s], ll: {} };
    for (let k = 1; k <= lastK; k++) {
      const seenBack = it.backSeen.filter(i => r.seenAt[s][i] != null && r.seenAt[s][i] <= k);
      const determined = seenBack.length === 2;
      for (const arm of ARMS) {
        const { dist, empty } = condition(priors[arm], seenBack);
        const mass = [...it.consistent].reduce((a, i) => a + dist[i].p, 0);
        if (empty || mass <= 0) ruledOut.push({ id: r.id, side: s, k, arm, seenBack, final: r.final[s], leads: it.leads });
        const B = ((byTurn[k] = byTurn[k] || {})[arm] = byTurn[k][arm] || { n: 0, ll_marg: 0, n_undet: 0, ll_marg_undet: 0, n_complete: 0, ll_true: 0, top1: 0, n_complete_undet: 0, ll_true_undet: 0 });
        const l = -Math.log(Math.max(mass, 1e-300));
        B.n++; B.ll_marg += l;
        if (!determined) { B.n_undet++; B.ll_marg_undet += l; }
        if (truthIdx >= 0) {
          const pt = dist[truthIdx].p;
          B.n_complete++; B.ll_true += -Math.log(Math.max(pt, 1e-300));
          const am = dist.reduce((bi, d, i) => (d.p > dist[bi].p ? i : bi), 0);
          if (am === truthIdx) B.top1++;
          if (!determined) { B.n_complete_undet++; B.ll_true_undet += -Math.log(Math.max(pt, 1e-300)); }
          if (arm === 'xatu' && !determined) {
            for (let i = 0; i < dist.length; i++) if (dist[i].p > 0 && dist[i].p < 1) { const y = i === truthIdx ? 1 : 0; calib.all.push([dist[i].p, y]); if (k === 1) calib.turn1.push([dist[i].p, y]); }
          }
        }
        if (k === 1) rowSide.ll[arm] = l;
      }
    }
    perSide.push(rowSide);
  }
  const fmt = B => ({ n: B.n, logloss_marg: +(B.ll_marg / B.n).toFixed(4), n_undetermined: B.n_undet, logloss_marg_undetermined: B.n_undet ? +(B.ll_marg_undet / B.n_undet).toFixed(4) : null,
    n_complete: B.n_complete, logloss_true: B.n_complete ? +(B.ll_true / B.n_complete).toFixed(4) : null, top1: B.n_complete ? +(B.top1 / B.n_complete).toFixed(4) : null,
    n_complete_undetermined: B.n_complete_undet, logloss_true_undetermined: B.n_complete_undet ? +(B.ll_true_undet / B.n_complete_undet).toFixed(4) : null });
  const turnTable = {};
  for (const k of Object.keys(byTurn)) { turnTable[k] = {}; for (const arm of ARMS) turnTable[k][arm] = fmt(byTurn[k][arm]); }

  // reliability + ECE
  const reliab = pts => {
    const bins = Array.from({ length: 10 }, () => ({ n: 0, p: 0, y: 0 }));
    for (const [p, y] of pts) { const b = bins[Math.min(9, Math.floor(p * 10))]; b.n++; b.p += p; b.y += y; }
    let ece = 0; const N = pts.length;
    const rows = bins.map((b, i) => { if (b.n) ece += (b.n / N) * Math.abs(b.p / b.n - b.y / b.n); return { bin: [i / 10, (i + 1) / 10], n: b.n, mean_p: b.n ? +(b.p / b.n).toFixed(4) : null, freq: b.n ? +(b.y / b.n).toFixed(4) : null }; });
    return { n: N, ece: +ece.toFixed(4), bins: rows };
  };

  // player-clustered bootstrap of the turn-1 marginal log-loss difference vs each baseline
  const byPlayer = new Map();
  for (const r of perSide) { const a = byPlayer.get(r.player) || []; a.push(r.ll); byPlayer.set(r.player, a); }
  const players = [...byPlayer.keys()];
  const R = rng(20260924);
  const boot = {};
  for (const base of ['uniform', 'freq', 'sheetfreq']) {
    const diffs = [];
    for (let rep = 0; rep < 1000; rep++) {
      let sum = 0, n = 0;
      for (let j = 0; j < players.length; j++) { const rows = byPlayer.get(players[Math.floor(R() * players.length)]); for (const x of rows) { sum += x.xatu - x[base]; n++; } }
      diffs.push(sum / n);
    }
    diffs.sort((a, b) => a - b);
    let pt = 0, n = 0; for (const r of perSide) { pt += r.ll.xatu - r.ll[base]; n++; }
    boot[base] = { diff: +(pt / n).toFixed(4), ci95: [+diffs[25].toFixed(4), +diffs[974].toFixed(4)], clusters: players.length };
  }

  const out = {
    generated: new Date().toISOString(), generator: 'solver/xatu/eval_bring.js',
    input: { path: src, bytes: fs.statSync(src).size, manifest: path.join(humanDir, 'manifest.json') },
    flags: { test_frac: testFrac, iters },
    split: { series_total: seriesOrder.length, series_test: testSeries.size, train_sides: train.length, test_sides: test.length,
      test_from: new Date(firstT.get(seriesOrder[cut]) * 1000).toISOString(), games: recs.length },
    fit: { mean_train_ll: +ll.toFixed(5), w: model.w, n_theta: Object.keys(model.theta).length },
    by_turn: turnTable,
    turn1_vs_baselines_clustered: boot,
    calibration: { turn1: reliab(calib.turn1), all_turns: reliab(calib.all) },
    ruled_out: { count: ruledOut.length, xatu: ruledOut.filter(x => x.arm === 'xatu').length, examples: ruledOut.slice(0, 20) },
  };
  fs.mkdirSync(path.join(ROOT, 'solver', 'out', 'xatu'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'solver', 'out', 'xatu', 'bring-eval.json'), JSON.stringify(out, null, 1));
  // the held-out game ids, so the spread evaluation reads exactly the same games
  fs.writeFileSync(path.join(ROOT, 'solver', 'out', 'xatu', 'split.json'), JSON.stringify({ generated: out.generated, test_frac: testFrac,
    test_ids: recs.filter(isTest).map(r => r.id), train_ids_n: recs.length - recs.filter(isTest).length }, null, 0));
  fs.mkdirSync(path.join(__dirname, 'model'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'model', 'bring-v1.json'), JSON.stringify({ ...model.toJSON(), fitted: out.generated, split: out.split, input: out.input }, null, 1));
  console.log(JSON.stringify({ split: out.split, w: model.w, turn1: turnTable[1], turn3: turnTable[3], boot, ece_t1: out.calibration.turn1.ece, ruled_out: out.ruled_out.count }, null, 1));
}

module.exports = { extract };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
