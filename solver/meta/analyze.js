/* solver/meta/analyze.js — stage 2 of the Reg M-C meta analysis. Reads ONLY solver/out/meta/
 * games.clean.jsonl.gz (written by extract.js, digest in manifest.json) and writes
 *   usage.json  sets.json  archetypes.json  bringlead.json  bo3.json
 * under solver/out/meta/. No win predictor is fitted from sheets (Will's scope).
 * ABRA-HEAP: 6144
 *
 *   cmd.exe /c tools\lownode.cmd solver/meta/analyze.js
 *
 * UNITS, stated once:
 *   side-game  one player's sheet in one game. Usage shares are "share of side-games whose sheet
 *              contains X". A bo3 series contributes one side-game per game played, so every share is
 *              also given by DISTINCT PLAYER, and every interval is cluster-robust by player.
 *   decided    winner known, some move/switch happened, >= 3 turns (data/quality-filter.json's
 *              exclude_forfeits + min_turns, restated). Only win rates use it.
 *   full bring all four brought Pokemon revealed on that side. Only bring rates use it; the
 *              revealed-only lower bound over every side is printed beside it. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const L = require('./lib.js');
const LEG = require('./legality.js');
const K = require('./kmeans.js');

const MIN_TURNS = 3;
const W = (o, f) => fs.writeFileSync(path.join(L.OUT, f), JSON.stringify(o, null, 1));
const r4 = x => (x == null ? null : Math.round(x * 1e4) / 1e4);
const wil = (k, n) => { const [lo, hi] = L.wilson(k, n); return [r4(lo), r4(hi)]; };

function load() {
  const abs = path.join(L.OUT, 'games.clean.jsonl.gz');
  const G = zlib.gunzipSync(fs.readFileSync(abs)).toString().trim().split('\n').map(JSON.parse);
  const man = JSON.parse(fs.readFileSync(path.join(L.OUT, 'manifest.json'), 'utf8'));
  const sha = L.sha256File(abs);
  if (sha !== man.output.sha256) throw new Error('games.clean.jsonl.gz does not match manifest.json — re-run extract.js');
  return { G, man, sha };
}

function main() {
  const t0 = Date.now();
  const { G, man, sha } = load();
  const leg = LEG.open();
  const nm = (kind, id) => leg.displayName(kind, id);
  const input = { path: man.output.path, sha256: sha, manifest_generated: man.generated };

  /* ---- sides, periods, bands -------------------------------------------------------------- */
  const days = [...new Set(G.map(g => g.date.slice(0, 10)))].sort();
  const dayIx = new Map(days.map((d, i) => [d, i]));
  const week = d => Math.floor(dayIx.get(d) / 7);        // week 0 = first 7 calendar days in the data
  const nWeeks = week(days[days.length - 1]) + 1;
  const A_DAYS = days.slice(0, 7), B_DAYS = days.slice(-7);
  const inA = d => A_DAYS.includes(d), inB = d => B_DAYS.includes(d);
  const rated = G.flatMap(g => g.p.map(p => p.r)).filter(r => r != null).sort((a, b) => a - b);
  const qt = f => rated[Math.floor(f * rated.length)];
  const round10 = x => Math.round(x / 10) * 10;
  const CUT = [round10(qt(1 / 3)), round10(qt(2 / 3))];
  const TOP = round10(qt(0.9));
  const band = r => (r == null ? 'unrated' : r < CUT[0] ? 'low' : r < CUT[1] ? 'mid' : 'high');
  const BANDS = ['low', 'mid', 'high', 'unrated'];

  const sides = [];
  for (const g of G) for (let s = 0; s < 2; s++) {
    const sh = g.sheets[s];
    sides.push({ g, s, pl: L.toID(g.p[s].n), r: g.p[s].r, band: band(g.p[s].r), top: g.p[s].r != null && g.p[s].r >= TOP,
      day: g.date.slice(0, 10), sh, six: sh.map(m => m.s), mega: g.mega[s], br: g.br[s], ld: g.ld[s] });
  }
  const sideOf = new Map(sides.map(sd => [sd.g.id + ':' + sd.s, sd]));
  const side = (g, s) => sideOf.get(g.id + ':' + s);

  /* ---- 1. usage over time ----------------------------------------------------------------- */
  const CATS = {
    species: sd => sd.six,
    item: sd => [...new Set(sd.sh.map(m => m.i).filter(Boolean))],
    ability: sd => [...new Set(sd.sh.map(m => m.a).filter(Boolean))],
    move: sd => [...new Set(sd.sh.flatMap(m => m.m))],
    megastone_carried: sd => [...new Set(sd.sh.filter(m => m.i && leg.megaStone(m.i)).map(m => m.i))],
    mega_used: sd => [sd.mega ? sd.mega.to : 'none'],
  };
  const KIND = { species: 'species', item: 'item', ability: 'ability', move: 'move', megastone_carried: 'item', mega_used: 'species' };
  const nSides = sides.length;
  const players = [...new Set(sides.map(s => s.pl))];
  const nDay = days.map(d => sides.filter(s => s.day === d).length);
  const nWeek = Array.from({ length: nWeeks }, (_, w) => sides.filter(s => week(s.day) === w).length);
  const nBand = Object.fromEntries(BANDS.map(b => [b, sides.filter(s => s.band === b).length]));
  const nTop = sides.filter(s => s.top).length;
  // per-player side counts in A and B, reused by every entity
  const plN = new Map();
  for (const sd of sides) {
    const e = plN.get(sd.pl) || { n: 0, nA: 0, nB: 0 };
    e.n++; if (inA(sd.day)) e.nA++; if (inB(sd.day)) e.nB++;
    plN.set(sd.pl, e);
  }
  const playersA = [...plN.values()].filter(e => e.nA).length, playersB = [...plN.values()].filter(e => e.nB).length;

  const usage = { input, generated: new Date().toISOString(), unit: 'share of side-games whose sheet contains the entity',
    days, weeks: Array.from({ length: nWeeks }, (_, w) => ({ week: w, first: days[w * 7], last: days[Math.min(days.length - 1, w * 7 + 6)], sides: nWeek[w] })),
    rating_bands: { cut_points: CUT, rule: 'tertiles of rated side-games, rounded to 10; unrated = no ladder rating in the store', top_decile_from: TOP, sides: nBand, top_decile_sides: nTop },
    trend_periods: { A: [A_DAYS[0], A_DAYS[A_DAYS.length - 1]], B: [B_DAYS[0], B_DAYS[B_DAYS.length - 1]],
      test: 'pB - pA, cluster-robust SE by player (joint linearisation, so a player in both periods is handled), two-sided z, BH-FDR over every entity of the category with >= 30 side-games in A+B; flagged when q < 0.05' },
    totals: { sides: nSides, players: players.length, games: G.length, sides_by_day: nDay }, categories: {} };

  for (const [cat, fn] of Object.entries(CATS)) {
    const E = new Map();
    for (const sd of sides) {
      const w = week(sd.day), di = dayIx.get(sd.day);
      for (const id of fn(sd)) {
        let e = E.get(id);
        if (!e) { e = { k: 0, day: new Array(days.length).fill(0), wk: new Array(nWeeks).fill(0), band: Object.fromEntries(BANDS.map(b => [b, 0])), top: 0, pl: new Map() }; E.set(id, e); }
        e.k++; e.day[di]++; e.wk[w]++; e.band[sd.band]++; if (sd.top) e.top++;
        const p = e.pl.get(sd.pl) || [0, 0, 0]; p[0]++; if (inA(sd.day)) p[1]++; if (inB(sd.day)) p[2]++; e.pl.set(sd.pl, p);
      }
    }
    const rows = [];
    for (const [id, e] of E) {
      const cl = [], diffRows = [];
      for (const [pl, pe] of plN) {
        const c = e.pl.get(pl) || [0, 0, 0];
        cl.push([c[0], pe.n]);
        if (pe.nA || pe.nB) diffRows.push([c[1], pe.nA, c[2], pe.nB]);
      }
      const cr = L.clusterRatio(cl), cd = L.clusterDiff(diffRows);
      const kA = [...e.pl.values()].reduce((a, c) => a + c[1], 0), kB = [...e.pl.values()].reduce((a, c) => a + c[2], 0);
      const plA = [...e.pl.values()].filter(c => c[1]).length, plB = [...e.pl.values()].filter(c => c[2]).length;
      rows.push({
        id, name: nm(KIND[cat], id === 'none' ? '' : id) || id, k: e.k, share: r4(e.k / nSides), wilson: wil(e.k, nSides),
        cluster_ci: cr.se == null ? null : [r4(cr.p - 1.96 * cr.se), r4(cr.p + 1.96 * cr.se)], design_effect: cr.se ? r4((cr.se * cr.se) / ((cr.p * (1 - cr.p)) / nSides)) : null,
        players: e.pl.size, player_share: r4(e.pl.size / players.length),
        by_week: e.wk.map((k, w) => ({ k, share: r4(k / nWeek[w]), wilson: wil(k, nWeek[w]) })),
        by_day: e.day.map((k, i) => ({ k, share: r4(k / nDay[i]), wilson: wil(k, nDay[i]) })),
        by_band: Object.fromEntries(BANDS.map(b => [b, { k: e.band[b], share: r4(e.band[b] / nBand[b]), wilson: wil(e.band[b], nBand[b]) }])),
        top_decile: { k: e.top, share: r4(e.top / nTop), wilson: wil(e.top, nTop) },
        trend: { kA, kB, pA: r4(cd.pA), pB: r4(cd.pB), player_share_A: r4(plA / playersA), player_share_B: r4(plB / playersB), diff: r4(cd.diff), se: r4(cd.se), z: cd.se ? r4(cd.diff / cd.se) : null, p: cd.se ? L.pTwo(cd.diff / cd.se) : null },
      });
    }
    const testable = rows.filter(r => r.trend.kA + r.trend.kB >= 30 && r.trend.p != null);
    const q = L.bh(testable.map(r => r.trend.p));
    testable.forEach((r, i) => { r.trend.q = r4(q[i]); r.trend.flag = q[i] < 0.05 ? (r.trend.diff > 0 ? 'RISER' : 'FALLER') : null; });
    rows.sort((a, b) => b.k - a.k);
    // Hill numbers (effective number of entities) per week, on the side-game share
    const hill = Array.from({ length: nWeeks }, (_, w) => {
      const tot = rows.reduce((a, r) => a + r.by_week[w].k, 0);
      let H = 0; for (const r of rows) { const p = r.by_week[w].k / tot; if (p > 0) H -= p * Math.log(p); }
      return r4(Math.exp(H));
    });
    usage.categories[cat] = { entities: rows.length, tested_for_trend: testable.length,
      risers: testable.filter(r => r.trend.flag === 'RISER').length, fallers: testable.filter(r => r.trend.flag === 'FALLER').length,
      effective_number_by_week: hill, rows };
  }
  W(usage, 'usage.json');
  console.log('usage done', ((Date.now() - t0) / 1000).toFixed(0) + 's');

  /* ---- 2. set library --------------------------------------------------------------------- */
  const SL = new Map();
  for (const sd of sides) for (const m of sd.sh) {
    let e = SL.get(m.s);
    if (!e) { e = { n: 0, pl: new Set(), item: new Map(), ability: new Map(), nature: new Map(), move: new Map(), sets: new Map(), cores: new Map() }; SL.set(m.s, e); }
    e.n++; e.pl.add(sd.pl);
    const inc = (map, k) => map.set(k, (map.get(k) || 0) + 1);
    inc(e.item, m.i || '(none)'); inc(e.ability, m.a || '(none)'); inc(e.nature, m.nt || '(none)');
    for (const mv of new Set(m.m)) inc(e.move, mv);
    const mv = [...new Set(m.m)].sort();
    const setKey = [m.i || '', m.a || '', m.nt || '', mv.join('+')].join('|');
    const coreKey = [m.i || '', m.a || '', mv.join('+')].join('|');
    const rep = { item: m.i ? nm('item', m.i) : null, ability: m.a ? nm('ability', m.a) : null, nature: m.nt ? nm('nature', m.nt) : null, moves: mv.map(x => nm('move', x)) };
    for (const [map, key, withNature] of [[e.sets, setKey, true], [e.cores, coreKey, false]]) {
      const x = map.get(key) || { k: 0, pl: new Set(), rep: withNature ? rep : { item: rep.item, ability: rep.ability, moves: rep.moves } }; x.k++; x.pl.add(sd.pl); map.set(key, x);
    }
  }
  const setsOut = { input, unit: 'one Pokemon slot on one side-game sheet; `players` = distinct players who showed that exact set',
    set_key: 'item | ability | nature | the four moves sorted', core_key: 'item | ability | moves (nature ignored)',
    spreads: 'NOT AVAILABLE — the store records no Stat Points (evs null on every slot); a set here has no spread', species: [] };
  const marg = (map, n, kind) => [...map].sort((a, b) => b[1] - a[1]).map(([id, k]) => ({ id, name: id === '(none)' ? '(none)' : nm(kind, id), k, share: r4(k / n) }));
  for (const [sp, e] of [...SL].sort((a, b) => b[1].n - a[1].n)) {
    const top = (map, lim) => [...map].sort((a, b) => b[1].k - a[1].k).slice(0, lim).map(([, x]) => ({ ...x.rep, k: x.k, share: r4(x.k / e.n), players: x.pl.size }));
    setsOut.species.push({ id: sp, name: nm('species', sp), slots: e.n, players: e.pl.size, distinct_sets: e.sets.size, distinct_cores: e.cores.size,
      item: marg(e.item, e.n, 'item'), ability: marg(e.ability, e.n, 'ability'), nature: marg(e.nature, e.n, 'nature'), move: marg(e.move, e.n, 'move'),
      top_sets: top(e.sets, 25), top_cores: top(e.cores, 15) });
  }
  W(setsOut, 'sets.json');
  console.log('sets done');

  /* ---- 3. archetypes ---------------------------------------------------------------------- */
  const vocab = [...new Set(sides.flatMap(s => s.six))].sort();
  const vIx = new Map(vocab.map((v, i) => [v, i]));
  const inst = new Map();                  // distinct (player, six) — each counted once in the fit
  for (const sd of sides) {
    const key = sd.pl + '#' + sd.six.slice().sort().join(',');
    if (!inst.has(key)) inst.set(key, { x: sd.six.map(s => vIx.get(s)).sort((a, b) => a - b), games: 0 });
    inst.get(key).games++;
    sd.inst = key;
  }
  const X = [...inst.values()].map(v => v.x);
  const KGRID = [3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24];
  const B = 20, SEED = 20260923;
  const grid = [];
  const refs = {};
  // --reuse-grid: take the stability grid from the previous archetypes.json and refit only the
  // reference at each k (same seeds, so the same labels). For re-running downstream sections cheaply.
  const REUSE = process.argv.includes('--reuse-grid') ? JSON.parse(fs.readFileSync(path.join(L.OUT, 'archetypes.json'), 'utf8')) : null;
  if (REUSE) { for (const g of REUSE.grid) { grid.push(g); refs[g.k] = K.fit(X, vocab.length, g.k, { restarts: 8, seed: SEED + g.k }); } console.log('  stability grid reused from the previous archetypes.json'); }
  for (const k of (REUSE ? [] : KGRID)) {
    const ref = K.fit(X, vocab.length, k, { restarts: 8, seed: SEED + k });
    refs[k] = ref;
    const aris = [], jac = new Array(k).fill(0);
    for (let b = 0; b < B; b++) {
      const R = L.rng(SEED * 31 + k * 1000 + b);
      const idx = Array.from({ length: X.length }, () => Math.floor(R() * X.length));
      const m = K.fit(idx.map(i => X[i]), vocab.length, k, { restarts: 2, seed: SEED + k * 97 + b });
      const lab = K.assign(X, m.C, vocab.length);
      aris.push(L.ari(ref.labels, lab));
      // Hennig cluster-wise Jaccard: best match of each reference cluster among the bootstrap clusters
      const refSets = Array.from({ length: k }, () => []), bSets = Array.from({ length: k }, () => new Set());
      ref.labels.forEach((c, i) => refSets[c].push(i)); lab.forEach((c, i) => bSets[c].add(i));
      for (let c = 0; c < k; c++) {
        let best = 0;
        for (let d = 0; d < k; d++) {
          let inter = 0; for (const i of refSets[c]) if (bSets[d].has(i)) inter++;
          const uni = refSets[c].length + bSets[d].size - inter;
          if (uni) best = Math.max(best, inter / uni);
        }
        jac[c] += best / B;
      }
    }
    aris.sort((a, b) => a - b);
    const med = aris[Math.floor(B / 2)], mean = aris.reduce((a, b) => a + b, 0) / B;
    grid.push({ k, objective: r4(ref.obj), ari_median: r4(med), ari_mean: r4(mean), ari_min: r4(aris[0]), ari_p10: r4(aris[Math.floor(B * 0.1)]),
      clusters_jaccard_ge_075: jac.filter(j => j >= 0.75).length, clusters_jaccard_lt_06: jac.filter(j => j < 0.6).length, jaccard: jac.map(r4) });
    console.log(`  k=${k} ARI median ${med.toFixed(3)} min ${aris[0].toFixed(3)}  stable clusters ${jac.filter(j => j >= 0.75).length}/${k}`);
  }
  const RULE = 'k* = the largest k in the grid whose median bootstrap ARI >= 0.80 (B=20 resamples of distinct player-teams, each refit and re-assigned to all teams, compared with the full-data fit)';
  const okK = grid.filter(r => r.ari_median >= 0.8);
  const kStar = okK.length ? okK[okK.length - 1].k : grid.slice().sort((a, b) => b.ari_median - a.ari_median)[0].k;
  const ref = refs[kStar];
  const instKeys = [...inst.keys()];
  const instLab = new Map(instKeys.map((key, i) => [key, ref.labels[i]]));
  for (const sd of sides) sd.arch = instLab.get(sd.inst);
  const decided = g => g.w != null && g.acted && g.turns >= MIN_TURNS;
  const archRows = [];
  const kJac = grid.find(r => r.k === kStar).jaccard;
  for (let c = 0; c < kStar; c++) {
    const S = sides.filter(s => s.arch === c);
    const freq = new Map();
    for (const s of S) for (const sp of s.six) freq.set(sp, (freq.get(sp) || 0) + 1);
    const core = [...freq].map(([sp, k]) => ({ id: sp, name: nm('species', sp), in_cluster: r4(k / S.length), overall: r4(usage.categories.species.rows.find(r => r.id === sp).share) }))
      .sort((a, b) => b.in_cluster - a.in_cluster).slice(0, 12);
    const megaF = new Map(); for (const s of S) { const k = s.mega ? s.mega.to : 'none'; megaF.set(k, (megaF.get(k) || 0) + 1); }
    // win rate: decided games, mirrors excluded
    const W1 = S.filter(s => decided(s.g) && side(s.g, 1 - s.s).arch !== c);
    const wins = W1.filter(s => s.g.w === s.s).length;
    const plW = new Map(); for (const s of W1) { const p = plW.get(s.pl) || [0, 0]; p[0] += s.g.w === s.s ? 1 : 0; p[1]++; plW.set(s.pl, p); }
    const cr = L.clusterRatio([...plW.values()]);
    // Elo-adjusted: observed minus expected from the two ladder ratings (rated games only)
    const RW = W1.filter(s => s.g.p[0].r != null && s.g.p[1].r != null);
    const resid = new Map();
    for (const s of RW) { const me = s.g.p[s.s].r, op = s.g.p[1 - s.s].r; const ex = 1 / (1 + Math.pow(10, (op - me) / 400)); const p = resid.get(s.pl) || [0, 0]; p[0] += (s.g.w === s.s ? 1 : 0) - ex; p[1]++; resid.set(s.pl, p); }
    const rsum = [...resid.values()].reduce((a, p) => a + p[0], 0), rn = RW.length;
    let rv = 0; const rmean = rn ? rsum / rn : 0; for (const p of resid.values()) { const z = p[0] - rmean * p[1]; rv += z * z; }
    const rse = resid.size > 1 ? Math.sqrt((resid.size / (resid.size - 1)) * rv) / rn : null;
    const ratedS = S.filter(s => s.r != null);
    archRows.push({ id: c, label: core.filter(x => x.in_cluster >= 0.5).slice(0, 3).map(x => x.name).join(' / ') || core.slice(0, 3).map(x => x.name).join(' / '),
      jaccard_stability: kJac[c], stable: kJac[c] >= 0.75 ? 'stable' : kJac[c] >= 0.6 ? 'doubtful' : 'dissolves',
      teams_distinct: ref.labels.filter(l => l === c).length, side_games: S.length, share: r4(S.length / nSides), wilson: wil(S.length, nSides),
      players: new Set(S.map(s => s.pl)).size,
      by_week: Array.from({ length: nWeeks }, (_, w) => { const k = S.filter(s => week(s.day) === w).length; return { k, share: r4(k / nWeek[w]), wilson: wil(k, nWeek[w]) }; }),
      by_band: Object.fromEntries(BANDS.map(b => { const k = S.filter(s => s.band === b).length; return [b, { k, share: r4(k / nBand[b]), wilson: wil(k, nBand[b]) }]; })),
      mean_rating: ratedS.length ? Math.round(ratedS.reduce((a, s) => a + s.r, 0) / ratedS.length) : null,
      core, mega_used: [...megaF].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, k]) => ({ id, name: id === 'none' ? 'none' : nm('species', id), share: r4(k / S.length) })),
      win: { decided_non_mirror: W1.length, wins, rate: r4(W1.length ? wins / W1.length : null), wilson: wil(wins, W1.length),
        cluster_ci: cr.se == null ? null : [r4(cr.p - 1.96 * cr.se), r4(cr.p + 1.96 * cr.se)],
        elo_residual: { games: rn, mean: r4(rmean), ci: rse == null ? null : [r4(rmean - 1.96 * rse), r4(rmean + 1.96 * rse)],
          note: 'observed win minus the Elo expectation from both ladder ratings; controls for who pilots the archetype' } } });
  }
  archRows.sort((a, b) => b.side_games - a.side_games);
  // BH across archetypes on the Elo residual
  const pz = archRows.map(a => { const e = a.win.elo_residual; if (!e.ci) return 1; const se = (e.ci[1] - e.ci[0]) / 3.92; return se ? L.pTwo(e.mean / se) : 1; });
  L.bh(pz).forEach((q, i) => { archRows[i].win.elo_residual.q = r4(q); });
  const archOut = { input, method: 'spherical k-means on the binary species-of-six vector; one point per distinct (player, six); k-means++ init; best of 8 restarts for the reference fit',
    k_rule: RULE, k_chosen: kStar, grid, stability_bands: 'Hennig 2007 cluster-wise Jaccard: >= 0.75 stable, 0.6-0.75 doubtful, < 0.6 dissolves',
    points: X.length, vocab: vocab.length, archetypes: archRows };
  W(archOut, 'archetypes.json');
  console.log('archetypes done k*=' + kStar, ((Date.now() - t0) / 1000).toFixed(0) + 's');

  /* ---- 4. bring / lead -------------------------------------------------------------------- */
  const full = sd => sd.br.length === 4;
  const hasLead = sd => sd.ld.length === 2;
  const BL = new Map();
  for (const sd of sides) for (const sp of sd.six) {
    let e = BL.get(sp); if (!e) { e = { on: 0, rev: 0, fullOn: 0, fullBr: 0, ldOn: 0, ld: 0, fullLdBr: 0, g1On: 0, g1Br: 0, g1Ld: 0, g1LdOn: 0 }; BL.set(sp, e); }
    e.on++; if (sd.br.includes(sp)) e.rev++;
    if (hasLead(sd)) { e.ldOn++; if (sd.ld.includes(sp)) e.ld++; }
    if (full(sd)) { e.fullOn++; if (sd.br.includes(sp)) { e.fullBr++; if (sd.ld.includes(sp)) e.fullLdBr++; } }
    const g1 = sd.g.fmt === 'bo1' || (sd.g.raw && sd.g.raw.gameNo === 1);
    if (g1 && full(sd)) { e.g1On++; if (sd.br.includes(sp)) e.g1Br++; }
    if (g1 && hasLead(sd)) { e.g1LdOn++; if (sd.ld.includes(sp)) e.g1Ld++; }
  }
  const blSpecies = [...BL].filter(([, e]) => e.on >= 30).sort((a, b) => b[1].on - a[1].on).map(([sp, e]) => ({
    id: sp, name: nm('species', sp), on_sheet: e.on,
    bring_full: { n: e.fullOn, rate: r4(e.fullBr / e.fullOn), wilson: wil(e.fullBr, e.fullOn) },
    bring_revealed_lower_bound: r4(e.rev / e.on),
    lead: { n: e.ldOn, rate: r4(e.ld / e.ldOn), wilson: wil(e.ld, e.ldOn) },
    lead_given_brought: { n: e.fullBr, rate: r4(e.fullLdBr / e.fullBr), wilson: wil(e.fullLdBr, e.fullBr) },
    game1_only: { bring: r4(e.g1Br / e.g1On), bring_n: e.g1On, lead: r4(e.g1Ld / e.g1LdOn), lead_n: e.g1LdOn },
  }));
  // per archetype matchup: species S on an A-sheet facing a B-sheet
  const cell = new Map();                  // key a|b|sp -> { pl: Map(player -> [b, bn, l, ln]) }
  const margA = new Map();                 // key a|sp   -> same, over every opponent archetype
  const addTo = (map, key, pl, x) => { let e = map.get(key); if (!e) { e = new Map(); map.set(key, e); } const c = e.get(pl) || [0, 0, 0, 0]; for (let i = 0; i < 4; i++) c[i] += x[i]; e.set(pl, c); };
  for (const sd of sides) {
    const op = side(sd.g, 1 - sd.s);
    for (const sp of sd.six) {
      const x = [full(sd) && sd.br.includes(sp) ? 1 : 0, full(sd) ? 1 : 0, hasLead(sd) && sd.ld.includes(sp) ? 1 : 0, hasLead(sd) ? 1 : 0];
      addTo(cell, sd.arch + '|' + op.arch + '|' + sp, sd.pl, x);
      addTo(margA, sd.arch + '|' + sp, sd.pl, x);
    }
  }
  const MIN_CELL = 40, MIN_PLAYERS = 20;   // a cell carried by a handful of players is one player's habit, and a cluster SE on few clusters is too small
  const cells = [];
  const sum = (m, i) => { let t = 0; for (const c of m.values()) t += c[i]; return t; };
  for (const [key, e] of cell) {
    const [a, b, sp] = key.split('|');
    const m = margA.get(a + '|' + sp);
    const bn = sum(e, 1), bk = sum(e, 0), ln = sum(e, 3), lk = sum(e, 2);
    if (bn < MIN_CELL && ln < MIN_CELL) continue;
    const nPl = e.size;
    // cell vs the rest of A's games, cluster-robust by player (a player can sit on both sides of the split)
    const test = (ki, ni, n) => {
      const rest = sum(m, ni) - n; if (n < MIN_CELL || rest < MIN_CELL || nPl < MIN_PLAYERS) return null;
      const rows = []; for (const [pl, c] of m) { const cc = e.get(pl) || [0, 0, 0, 0]; rows.push([c[ki] - cc[ki], c[ni] - cc[ni], cc[ki], cc[ni]]); }
      const d = L.clusterDiff(rows); return d.se ? { diff: d.diff, p: L.pTwo(d.diff / d.se) } : null;
    };
    const tb = test(0, 1, bn), tl = test(2, 3, ln);
    cells.push({ arch: +a, vs: +b, id: sp, name: nm('species', sp), players: nPl,
      bring: bn ? { n: bn, rate: r4(bk / bn), wilson: wil(bk, bn), vs_rest: tb ? r4(tb.diff) : null, p: tb ? tb.p : null } : null,
      lead: ln ? { n: ln, rate: r4(lk / ln), wilson: wil(lk, ln), vs_rest: tl ? r4(tl.diff) : null, p: tl ? tl.p : null } : null });
  }
  const testsB = cells.filter(c => c.bring && c.bring.p != null), testsL = cells.filter(c => c.lead && c.lead.p != null);
  L.bh(testsB.map(c => c.bring.p)).forEach((q, i) => { testsB[i].bring.q = r4(q); });
  L.bh(testsL.map(c => c.lead.p)).forEach((q, i) => { testsL[i].lead.q = r4(q); });
  const blOut = { input, rule: { full_bring: 'all four brought revealed on that side', min_cell: MIN_CELL, min_players_to_test: MIN_PLAYERS,
      matchup_test: 'bring (lead) rate of species S on archetype A against archetype B, versus S on A against every other archetype; difference of rates with a cluster-robust SE by player (joint linearisation), two-sided z; BH-FDR over all tested cells, separately for bring and lead' },
    censoring: { sides: nSides, full_bring_sides: sides.filter(full).length, lead_known_sides: sides.filter(hasLead).length,
      note: 'full-bring sides are games long enough to reveal four; a species kept in the back and never sent in is under-counted by the revealed lower bound, and the full-bring subset over-represents long games' },
    species: blSpecies, matchup_cells: cells.length, matchup_tests: { bring: testsB.length, lead: testsL.length,
      bring_q_lt_05: testsB.filter(c => c.bring.q < 0.05).length, lead_q_lt_05: testsL.filter(c => c.lead.q < 0.05).length },
    matchup_significant: cells.filter(c => (c.bring && c.bring.q < 0.05) || (c.lead && c.lead.q < 0.05))
      .sort((x, y) => Math.min(x.bring && x.bring.q != null ? x.bring.q : 1, x.lead && x.lead.q != null ? x.lead.q : 1) - Math.min(y.bring && y.bring.q != null ? y.bring.q : 1, y.lead && y.lead.q != null ? y.lead.q : 1)),
    matchup_all: cells };
  W(blOut, 'bringlead.json');
  console.log('bring/lead done');

  /* ---- 5. bo3 adaptation ------------------------------------------------------------------ */
  const series = new Map();
  for (const g of G) if (g.fmt === 'bo3' && g.raw && g.raw.series) { const a = series.get(g.raw.series) || []; a.push(g); series.set(g.raw.series, a); }
  const tr = [];               // one row per (player, series, transition)
  let sheetChanged = 0, seriesPlayers = 0, dupGameNo = 0;
  const seriesLen = {};
  for (const [sid, gs] of series) {
    gs.sort((a, b) => a.raw.gameNo - b.raw.gameNo);
    if (new Set(gs.map(g => g.raw.gameNo)).size !== gs.length) { dupGameNo++; continue; }
    seriesLen[gs.length] = (seriesLen[gs.length] || 0) + 1;
    const names = new Set(gs.flatMap(g => g.p.map(p => L.toID(p.n))));
    for (const pl of names) {
      const seq = gs.map(g => { const s = L.toID(g.p[0].n) === pl ? 0 : L.toID(g.p[1].n) === pl ? 1 : -1; return s < 0 ? null : { g, s, sd: side(g, s) }; }).filter(Boolean);
      if (seq.length < 2) continue;
      seriesPlayers++;
      if (new Set(seq.map(x => x.sd.six.slice().sort().join(','))).size > 1) sheetChanged++;
      for (let i = 1; i < seq.length; i++) {
        const a = seq[i - 1], b = seq[i];
        if (a.g.w == null) continue;
        const bothFull = a.sd.br.length === 4 && b.sd.br.length === 4;
        const kept = bothFull ? a.sd.br.filter(x => b.sd.br.includes(x)).length : null;
        const bothLead = a.sd.ld.length === 2 && b.sd.ld.length === 2;
        const leadKept = bothLead ? a.sd.ld.filter(x => b.sd.ld.includes(x)).length : null;
        tr.push({ pl, sid, from: a.g.raw.gameNo, to: b.g.raw.gameNo, won: a.g.w === a.s, kept, leadKept, a: a.sd, b: b.sd,
          oppA: side(a.g, 1 - a.s), oppB: side(b.g, 1 - b.s) });
      }
    }
  }
  const rate = (rows, f, cond) => { const R = rows.filter(cond); const k = R.filter(f).length; const pl = new Map(); for (const r of R) { const p = pl.get(r.pl) || [0, 0]; p[0] += f(r) ? 1 : 0; p[1]++; pl.set(r.pl, p); } const cr = L.clusterRatio([...pl.values()]); return { n: R.length, k, rate: r4(R.length ? k / R.length : null), wilson: wil(k, R.length), cluster_ci: cr.se == null ? null : [r4(cr.p - 1.96 * cr.se), r4(cr.p + 1.96 * cr.se)] }; };
  const diffWL = (rows, f, cond) => { const pl = new Map(); for (const r of rows.filter(cond)) { const p = pl.get(r.pl) || [0, 0, 0, 0]; if (r.won) { p[0] += f(r) ? 1 : 0; p[1]++; } else { p[2] += f(r) ? 1 : 0; p[3]++; } pl.set(r.pl, p); } const d = L.clusterDiff([...pl.values()]); return { won: r4(d.pA), lost: r4(d.pB), lost_minus_won: r4(d.diff), ci: d.se == null ? null : [r4(d.diff - 1.96 * d.se), r4(d.diff + 1.96 * d.se)], p: d.se ? L.pTwo(d.diff / d.se) : null }; };
  const fullTr = r => r.kept != null, leadTr = r => r.leadKept != null;
  const sameFour = r => r.kept === 4, sameLead = r => r.leadKept === 2;
  const keptDist = cond => { const R = tr.filter(r => fullTr(r) && cond(r)); const d = {}; for (const r of R) d[r.kept] = (d[r.kept] || 0) + 1; return { n: R.length, dist: d, mean_kept: r4(R.reduce((a, r) => a + r.kept, 0) / (R.length || 1)) }; };
  const T = {
    all: { same_four: rate(tr, sameFour, fullTr), same_lead_pair: rate(tr, sameLead, leadTr), kept_of_four: keptDist(() => true) },
    by_previous_result: {
      same_four: diffWL(tr, sameFour, fullTr), same_lead_pair: diffWL(tr, sameLead, leadTr),
      won: { same_four: rate(tr, sameFour, r => fullTr(r) && r.won), same_lead_pair: rate(tr, sameLead, r => leadTr(r) && r.won), kept_of_four: keptDist(r => r.won) },
      lost: { same_four: rate(tr, sameFour, r => fullTr(r) && !r.won), same_lead_pair: rate(tr, sameLead, r => leadTr(r) && !r.won), kept_of_four: keptDist(r => !r.won) },
    },
    by_transition: { g1_g2: { same_four: rate(tr, sameFour, r => fullTr(r) && r.from === 1), same_lead_pair: rate(tr, sameLead, r => leadTr(r) && r.from === 1) },
      g2_g3: { same_four: rate(tr, sameFour, r => fullTr(r) && r.from === 2), same_lead_pair: rate(tr, sameLead, r => leadTr(r) && r.from === 2) } },
  };
  // Baseline: the same player with the same six, game 1 of one series against game 1 of their next series.
  const g1ByPl = new Map();
  for (const [, gs] of series) { const g = gs.find(x => x.raw.gameNo === 1); if (!g) continue; for (let s = 0; s < 2; s++) { const sd = side(g, s); const key = sd.pl + '#' + sd.six.slice().sort().join(','); const a = g1ByPl.get(key) || []; a.push(sd); g1ByPl.set(key, a); } }
  const base = [];
  for (const [, arr] of g1ByPl) { arr.sort((a, b) => (a.g.date < b.g.date ? -1 : 1)); for (let i = 1; i < arr.length; i++) { const a = arr[i - 1], b = arr[i]; base.push({ pl: a.pl, kept: a.br.length === 4 && b.br.length === 4 ? a.br.filter(x => b.br.includes(x)).length : null, leadKept: a.ld.length === 2 && b.ld.length === 2 ? a.ld.filter(x => b.ld.includes(x)).length : null }); } }
  T.baseline_next_series_game1 = { what: 'same player, same six: game 1 of a series versus game 1 of their next series (a new opponent) — the habit rate a within-series change should be read against',
    same_four: rate(base, sameFour, fullTr), same_lead_pair: rate(base, sameLead, leadTr) };
  // per species: brought/led in the earlier game vs the later one, within the same player-series
  const spT = new Map();
  for (const r of tr) {
    for (const sp of r.a.six) {
      const e = spT.get(sp) || { bn: 0, b1: 0, b2: 0, bIn: 0, bOut: 0, ln: 0, l1: 0, l2: 0, bnL: 0, b1L: 0, b2L: 0, pl: new Map() };
      if (fullTr(r)) { const x = r.a.br.includes(sp), y = r.b.br.includes(sp); e.bn++; e.b1 += x; e.b2 += y; if (!x && y) e.bIn++; if (x && !y) e.bOut++;
        if (!r.won) { e.bnL++; e.b1L += x; e.b2L += y; }
        const p = e.pl.get(r.pl) || [0, 0, 0, 0]; p[0] += x; p[1]++; p[2] += y; p[3]++; e.pl.set(r.pl, p); }
      if (leadTr(r)) { e.ln++; e.l1 += r.a.ld.includes(sp); e.l2 += r.b.ld.includes(sp); }
      spT.set(sp, e);
    }
  }
  const spRows = [...spT].filter(([, e]) => e.bn >= 100).map(([sp, e]) => { const d = L.clusterDiff([...e.pl.values()]); return { id: sp, name: nm('species', sp), transitions: e.bn,
    bring_earlier: r4(e.b1 / e.bn), bring_later: r4(e.b2 / e.bn), change: r4(d.diff), ci: d.se == null ? null : [r4(d.diff - 1.96 * d.se), r4(d.diff + 1.96 * d.se)], p: d.se ? L.pTwo(d.diff / d.se) : null,
    swapped_in: e.bIn, swapped_out: e.bOut, after_loss: { n: e.bnL, bring_earlier: r4(e.b1L / (e.bnL || 1)), bring_later: r4(e.b2L / (e.bnL || 1)) },
    lead_earlier: r4(e.l1 / (e.ln || 1)), lead_later: r4(e.l2 / (e.ln || 1)), lead_n: e.ln }; });
  L.bh(spRows.map(r => (r.p == null ? 1 : r.p))).forEach((q, i) => { spRows[i].q = r4(q); });
  spRows.sort((a, b) => a.q - b.q || Math.abs(b.change) - Math.abs(a.change));
  // Did the change answer the opponent? Among losers who changed, how often did a Pokemon they added
  // appear more in games where the opponent had brought it... — not attempted: would need a counter model.
  const bo3Out = { input, series: { linked: series.size, by_length: seriesLen, dropped_duplicate_game_numbers: dupGameNo, player_series_with_2plus_games: seriesPlayers,
      sheet_changed_within_series: sheetChanged, series_key: 'raw log `|uhtml|bestof|` link (game-bestof3-<id>); game number from the same line' },
    transitions: tr.length, summary: T, species: spRows };
  W(bo3Out, 'bo3.json');
  console.log('bo3 done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}

main();
