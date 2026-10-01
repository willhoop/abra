/* solver/results/2026-10-01-body-spreads/measure.js — how many search bodies abra/regmc 1.69.0 changed, and by how much.
 *
 *   node solver/results/2026-10-01-body-spreads/measure.js --release df172ccd2aaf --team-store <dir> [--pairs 100 --pair-seed 1] --out <json>
 *
 * The population is the not-lose screen's: the 100 TEST pairs at pair-seed 1 from the frozen team store, every sheet row of
 * both sides (the rows a world can draw a fresh body from). For each row, the body each path built BEFORE (bare
 * solver/arena/teams.js buildBody: the table's flat line, no nature, no `_sp`) and AFTER:
 *   truth    the omniscient searcher's fresh body (bodyBuilder view 'truth', role-v1) — test-miltank, self-play
 *            (--info omniscient), solver/arena/arena.js and its pool workers, ROTOM's preview search for OUR side
 *   public   the honest searcher's / ROTOM's fresh OPPONENT body before any belief (view 'public': zero SP, sheet nature)
 *   honest   the stat line a playout actually plays under honest information: the world's body after XATU's spread belief
 *            re-lays it (solver/xatu/worlds.js rollout), old builder against new under the same world coin
 *   mega     every row holding its own mega stone, at its role-v1 spread: the line after the mega with `_sp` (recompute)
 *            against without (the engine's delta)
 * Per path: rows, rows whose line changed, per-stat mean and max |delta|, Speed changes.
 */
'use strict';
const fs = require('fs');
const path = require('path');
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const ROOT = path.join(__dirname, '..', '..', '..');
require(path.join(ROOT, 'solver', 'arena', 'env.js'));
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = flag('--release', 'df172ccd2aaf');
const E = require(path.join(ROOT, 'solver', 'arena', 'engine.js')).load(REL);
const API = E.API, M = API.M;
const T = require(path.join(ROOT, 'solver', 'arena', 'teams.js'));
const X = require(path.join(ROOT, 'solver', 'human', 'dex.js'));
const PAIRS = require(path.join(ROOT, 'solver', 'mew', 'pairs.js'));
const P = PAIRS.load({ teamStore: flag('--team-store', undefined) });
const list = PAIRS.pick(P.test, +flag('--pairs', 100), +flag('--pair-seed', 1));
const STATS = ['hp', 'at', 'df', 'sa', 'sd', 'sp'];

function tally() { return { rows: 0, changed: 0, spe_changed: 0, sum: Object.fromEntries(STATS.map(s => [s, 0])), max: Object.fromEntries(STATS.map(s => [s, 0])), with_sp: 0 }; }
function add(t, a, b) {
  t.rows++;
  let ch = false;
  for (const s of STATS) { const d = Math.abs((a.st[s] | 0) - (b.st[s] | 0)); t.sum[s] += d; if (d > t.max[s]) t.max[s] = d; if (d) ch = true; }
  if (ch) t.changed++;
  if (a.st.sp !== b.st.sp) t.spe_changed++;
  if (b._sp) t.with_sp++;
}
const fin = t => Object.assign({}, t, { mean_abs: Object.fromEntries(STATS.map(s => [s, +(t.sum[s] / Math.max(1, t.rows)).toFixed(3)])), share_changed: +(t.changed / Math.max(1, t.rows)).toFixed(4), sum: undefined });

const truthB = T.bodyBuilder(M, { view: 'truth' }), pubB = T.bodyBuilder(M, { view: 'public' });
const out = { truth: tally(), public: tally(), honest: tally(), mega: tally() };
const RN = require(path.join(ROOT, 'solver', 'miltank', 'rollout.js'));
const Rold = RN.create(API, { buildBody: T.buildBody }), Rnew = RN.create(API, { buildBody: pubB });
const XWm = require(path.join(ROOT, 'solver', 'xatu', 'worlds.js'));
const XWo = XWm.create(API, { R: Rold }), XWn = XWm.create(API, { R: Rnew });
const megaRows = { delta_off: [] };
let worlds = 0;
for (const G of list) {
  for (const sd of ['p1', 'p2']) G.sheets[sd].forEach(row => {
    const f = T.buildBody(M, row); if (!f) return;
    add(out.truth, f, truthB(M, row));
    add(out.public, f, pubB(M, row));
  });
  /* honest worlds: the same true battle, the same world coin, old and new builders; every opponent body compared */
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  if (!a || !b) continue;
  const S = API.newBattle(a.team, b.team, { rng: API.makeRng(5) });
  const hb = { back: null, spreads: XWo.spreadPrior(G.sheets), oppP: 'p2' };
  const belief = { sheet: G.sheets.p2, revealed: new Set([0, 1].filter(k => S.sfB.team[k])) };
  for (let w = 0; w < 8; w++) {
    const co = M.rngStreams({ seed: 77 + w }).any, cn = M.rngStreams({ seed: 77 + w }).any;
    const Wo = XWo.rollout(hb).sampleWorld(S, 'B', belief, co), Wn = XWn.rollout(hb).sampleWorld(S, 'B', belief, cn);
    worlds++;
    Wo.sfB.team.forEach((m, k) => { const n = Wn.sfB.team[k]; if (m && n && m._solverSheet === n._solverSheet) add(out.honest, m, n); });
  }
  /* mega: each brought body holding its own stone, delta against recompute, on one battle per side */
  for (const [side, tm] of [['A', a], ['B', b]]) for (const m0 of tm.team) {
    const row = G.sheets[side === 'A' ? 'p1' : 'p2'][m0._solverSheet];
    const it = X.D.items.get(X.toID(row.item)), ms = it && it.exists && it.megaStone;
    const base = X.D.species.get(row.species);
    if (!(ms && typeof ms === 'object' && ms[base.name]) || !m0._sp) continue;
    const lines = [];
    for (const keep of [false, true]) {
      const A2 = T.buildTeam(M, G, 'p1'), B2 = T.buildTeam(M, G, 'p2');
      const S2 = API.newBattle(A2.team, B2.team, { rng: API.makeRng(9) });
      const sf = side === 'A' ? S2.sfA : S2.sfB, act = side === 'A' ? S2.actA : S2.actB;
      const m = sf.team.find(y => y._solverSheet === m0._solverSheet);
      if (!keep) delete m._sp;
      let saved = null; if (act.indexOf(m) < 0) { saved = act[0]; act[0] = m; }
      const run = () => M.megaEvolveNow(S2, m, true);
      S2._scope ? M.battleScopeRun(S2._scope, run) : run();
      if (saved) act[0] = saved;
      lines.push({ st: Object.assign({}, m.st), _sp: keep ? m._sp : null });
    }
    add(out.mega, lines[0], lines[1]);
    if (STATS.some(s => lines[0].st[s] !== lines[1].st[s]) && megaRows.delta_off.length < 12) megaRows.delta_off.push({ species: row.species, nature: row.nature, delta: lines[0].st, recompute: lines[1].st });
  }
}
const res = { at: new Date().toISOString(), release: REL, release_stamp: E.stamp, pairs: list.length, pair_seed: +flag('--pair-seed', 1), ids_sha256: P.ids_sha256(list),
  pool: { file: P.file, file_sha256: P.file_sha256, pool_digest: P.pool_digest }, honest_worlds: worlds,
  paths: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, fin(v)])), mega_examples: megaRows.delta_off,
  spreads: T.defaultSpreads(M).stamp(), xatu_new: XWn.COUNTERS };
const OUT = flag('--out', null);
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res.paths, null, 1));
