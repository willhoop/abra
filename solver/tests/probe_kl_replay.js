/* solver/tests/probe_kl_replay.js — ONE LIVE ROTOM DECISION, REPLAYED THROUGH gen5, AND WHAT THE HUMAN-REGULARISED SOLVE
 * PLAYS THERE AT EACH LAMBDA (2026-09-30, docs/_reports/2026-09-30-human-regularised-search.md).
 *
 *   node solver/tests/probe_kl_replay.js --log <rotom game .log> --turn 4 [--account medicham32] [--release eaa5becc54eb]
 *        [--passes 96] [--seeds 3] [--grid 0,0.001,0.003,0.01,0.03,0.1,0.3,inf] [--live 0.03] [--out <json>]
 *
 * A MEASUREMENT on a FINISHED game (read only). The position is rebuilt exactly as solver/tests/probe_dp_replay.js
 * (branch worktree-agent-a2a32a231fd34cc17, abra/regmc 1.31.0) rebuilds it: the protocol up to `|turn|N` through
 * solver/human/parse_game.js, solver/rotom/world.js with the log (the exact Protect counter), and a request synthesised
 * from the log (the account's own bodies at their exact HP; actives' sheet moves; the mega offered when the body holds its
 * stone and the side has not mega-evolved). ROTOM does not store the request, so a disabled move or a trap the log does
 * not show is not reproduced.
 *
 * The search is the ROTOM policy `miltank-gen5` (solver/rotom/policy.js) on solver/machamp/league/gen5.json, `--passes`
 * passes with no clock, on `--seeds` coins (4000, 4001, ...): the SAME table per coin at every lambda. Each coin's root is
 * recorded once (d.record) and the lambda grid is solved on it OFFLINE (solveRM for 0, the anchor for inf, solveKL else).
 * `--live L` also plays the policy with a spec carrying "kl": L on the same coins, and checks the played mix equals the
 * offline solve at L — the flag reaches the live client's search (a capability that cannot prove it ran is broken).
 */
'use strict';
require('../arena/env.js');
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const LOG = flag('--log');
const TURN = +flag('--turn', 4);
const ACCOUNT = flag('--account', 'medicham32');
const REL = flag('--release', 'eaa5becc54eb');
const PASSES = +flag('--passes', 96);
const SEEDS = +flag('--seeds', 3);
const GRID = String(flag('--grid', '0,0.001,0.003,0.01,0.03,0.1,0.3,inf')).split(',').map(s => (s === 'inf' ? Infinity : +s));
const LIVE = flag('--live', null) == null ? null : +flag('--live');
const OUT = flag('--out', null);
const ROOT = path.join(__dirname, '..', '..');
const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const { parseGame, parseShowteam } = require('../human/parse_game.js');
const X = require('../human/dex.js');
const SK = require('../slowking/matrix.js');
const SEARCH = require('../miltank/search.js');
const FAM = require('../arena/protect_stats.js').family();
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const all = fs.readFileSync(LOG, 'utf8').split('\n');
const ti = all.findIndex(l => l === '|turn|' + TURN);
if (ti < 0) throw new Error('no |turn|' + TURN + ' in the log');
const lines = all.slice(0, ti + 1);
let me = null; const sheets = {};
for (const l of all) { const p = l.split('|'); if (p[1] === 'player' && new RegExp(ACCOUNT, 'i').test(p[3] || '')) me = p[2]; if (p[1] === 'showteam') sheets[p[2]] = parseShowteam(p.slice(3).join('|')); }
if (!me || !sheets.p1 || !sheets.p2) throw new Error('no player line or no open sheets');
const id = path.basename(LOG).replace(/\.log$/, '').replace(/^battle-/, '');
const row = parseGame({ id, log: lines.join('\n') });
const st = row.turns[row.turns.length - 1].state;
const side = st.sides[me];

/* the synthesised request: probe_dp_replay.js's, unchanged */
function synthRequest() {
  const sheet = sheets[me];
  const act = side.active || [];
  const brought = side.mons.filter(m => m && m.seen).map(m => m.i);
  const order = act.filter(i => i != null).concat(brought.filter(i => !act.includes(i)));
  const megaUsed = !!side.mega_used;
  const pokemon = order.map((i, j) => {
    const r = sheet[i], pub = side.mons[i] || {};
    const b = T.buildBody(M, r);
    const max = b.st.hp;
    const cond = pub.fnt ? '0 fnt' : `${pub.seen ? Math.max(1, Math.round((pub.hp / (pub.max || 100)) * max)) : max}/${max}${pub.status ? ' ' + pub.status : ''}`;
    return { ident: me + (j < 2 ? 'ab'[j] : 'a') + ': ' + r.nick, details: (pub.seen && pub.species ? pub.species : r.species) + ', L50', condition: cond, active: j < act.length && act[j] != null,
             item: pub.seen ? (pub.item === undefined ? r.item : (pub.item || '')) : r.item, ability: pub.seen && pub.ability ? pub.ability : r.ability, moves: r.moves.map(toID) };
  });
  const active = act.map((i, j) => {
    if (i == null) return null;
    const r = sheet[i];
    const it = X.D.items.get(toID(r.item));
    const canMega = !megaUsed && !!(it && it.exists && it.megaStone) && !/-mega/i.test(String((side.mons[i] || {}).species || ''));
    return { moves: r.moves.map(m => { const mv = X.D.moves.get(toID(m)); return { move: mv.name, id: mv.id, target: mv.target, disabled: false, pp: 8, maxpp: 8 }; }), canMegaEvo: canMega };
  });
  return { active, side: { id: me, pokemon } };
}
const req = synthRequest();

const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const WB = require('../rotom/world.js').create(API);
const PAmod = require('../miltank/prior_adapter.js');
const MAGI = require('../mag/infer.js');
const PA = PAmod.create(API, MAGI.load({ mag: path.join(ROOT, 'solver/mag/model/mag-v1.json'), doduo: path.join(ROOT, 'solver/mag/model/doduo-v1.json') }));
const tables = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/rotom/tables.json'), 'utf8'));
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/gen5.json'), 'utf8'));
const scratch = path.join(ROOT, 'solver', 'out', 'pikl', 'replay');
fs.mkdirSync(scratch, { recursive: true });
const policyFor = spec => { const f = path.join(scratch, spec.name + '.json'); fs.writeFileSync(f, JSON.stringify(spec, null, 1)); return require('../rotom/policy.js').create({ API, PA, R, tables, gen5Spec: f }); };

/* protect-family on the ENGINE joints of the record (the table's labels are request choices, which name no move) */
const nP = j => j.filter(o => o && o.kind === 'move' && FAM.has(o.move)).length;
function solveAt(A, tr, tc, lam) {
  if (lam === 0) return SK.solveRM(A, { iters: 4000, tol: 1e-4 }).x;
  if (lam === Infinity) return tr;
  return SK.solveKL(A, { tauRow: tr, tauCol: tc, lambda: lam, iters: 4000, tol: 1e-5 }).x;
}
const out = { log: path.relative(ROOT, LOG).split(path.sep).join('/'), turn: TURN, me, release: ENGINE.stamp && ENGINE.stamp.engine_release, passes: PASSES, seeds: SEEDS, grid: GRID.map(v => (v === Infinity ? 'inf' : v)), runs: [] };
const P0 = policyFor(base);
for (let s = 0; s < SEEDS; s++) {
  const w = WB.build({ row, sheets, me, req, oppGuess: null, lines });
  const d = { req, world: w, coin: M.rngStreams({ seed: 4000 + s }).any, budgetMs: 600000, xatuBack: null, onPass: vs => vs.length >= PASSES, record: true };
  const r = P0.move('miltank-gen5', d);
  const t = r.info.table || {}, rec = r.info.rec;
  if (!rec) throw new Error('no record (forced or fallback): ' + JSON.stringify(r.info).slice(0, 300));
  const tr = SEARCH.anchorOf(rec.tauRow), tc = SEARCH.anchorOf(rec.tauCol);
  const run = { coin: 4000 + s, rows: t.rows, cols: t.cols, value: t.value, played_choice: r.choice, tau_row: tr && tr.map(v => +v.toFixed(4)), tau_col: tc && tc.map(v => +v.toFixed(4)),
    A: rec.A.map(q => q.map(v => +v.toFixed(4))), byLambda: {} };
  for (const lam of GRID) {
    const x = solveAt(rec.A, tr, tc, lam);
    let am = 0; for (let k = 1; k < x.length; k++) if (x[k] > x[am]) am = k;
    run.byLambda[lam === Infinity ? 'inf' : lam] = { mix: x.map(v => +v.toFixed(3)), argmax: t.rows[am], double_protect_mass: +rec.rows.reduce((q, j, k) => q + (nP(j) >= 2 ? x[k] : 0), 0).toFixed(3), protect_mass: +rec.rows.reduce((q, j, k) => q + (nP(j) ? x[k] : 0), 0).toFixed(3) };
  }
  out.runs.push(run);
  console.log(`\n== coin ${4000 + s}   plain value ${(+t.value).toFixed(3)}   played live-path choice: ${r.choice}`);
  console.log('   rows ' + JSON.stringify(t.rows));
  console.log('   cols ' + JSON.stringify(t.cols));
  console.log('   tau  ' + JSON.stringify(run.tau_row));
  for (const [k, v] of Object.entries(run.byLambda)) console.log(`   lambda ${String(k).padEnd(6)} mix ${JSON.stringify(v.mix)}  double-Protect ${v.double_protect_mass}  argmax ${v.argmax}`);
}
if (LIVE != null) {
  const PL = policyFor(Object.assign({}, base, { name: 'gen5-kl-live', kl: LIVE }));
  out.live = { lambda: LIVE, runs: [] };
  for (let s = 0; s < SEEDS; s++) {
    const w = WB.build({ row, sheets, me, req, oppGuess: null, lines });
    const r = PL.move('miltank-gen5', { req, world: w, coin: M.rngStreams({ seed: 4000 + s }).any, budgetMs: 600000, xatuBack: null, onPass: vs => vs.length >= PASSES, record: true });
    const off = out.runs[s].byLambda[LIVE].mix, got = r.info.rec.x.map(v => +(+v).toFixed(3));   // the record, not ROTOM's table tap: the tap reports to the first policy made in a process
    const same = JSON.stringify(r.info.rec.A.map(q => q.map(v => +v.toFixed(4)))) === JSON.stringify(out.runs[s].A);
    out.live.runs.push({ coin: 4000 + s, choice: r.choice, mix: got, kl: r.info.kl, same_table: same, matches_offline: same && JSON.stringify(got) === JSON.stringify(off) });
    console.log(`\n== live path, kl ${LIVE}, coin ${4000 + s}: choice ${r.choice}  mix ${JSON.stringify(got)}  same table ${same}  matches the offline solve ${same && JSON.stringify(got) === JSON.stringify(off)}  counters ${JSON.stringify(r.info.kl)}`);
  }
}
if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log('\nwrote ' + OUT); }
