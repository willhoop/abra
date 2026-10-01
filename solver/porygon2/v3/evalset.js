/* ABRA-HEAP: 3072
 * solver/porygon2/v3/evalset.js — PORYGON2 v3's FROZEN held-out evaluation set and the harness that scores a leaf on it
 * (solver/porygon2/v3/DESIGN.md §1, tests (a)-(c)). Plays no game: it rebuilds finished positions and steps turns.
 *
 *   node solver/porygon2/v3/evalset.js build  --release eaa5becc54eb [--dir solver/out/p2v3/evalset]
 *   node solver/porygon2/v3/evalset.js label  --release eaa5becc54eb [--workers 8] [--k 4] [--r 8] [--cap 30] [--deadline ISO]
 *   node solver/porygon2/v3/evalset.js score  --release eaa5becc54eb --nets gen5=<file>,v1=<file>,v2=<file>[,...] [--workers 8] [--rnet 4]
 *   node solver/porygon2/v3/evalset.js bench  --release eaa5becc54eb --nets ... [--positions 300] [--reps 3]
 *   node solver/porygon2/v3/evalset.js report [--nets gen5,v1,v2,...] [--base gen5]
 * (every heavy step through tools\lownode.cmd; the workers also lower their own priority)
 *
 * THE SET (build). Three sources, every one held out from every net it scores (the leakage test,
 * solver/tests/test-porygon2-v3-evalset.js, asserts it against the training manifests):
 *   ladder  medicham32's finished Reg M-C ladder games (ROTOM, the four runs named in LADDER_RUNS; a run still being
 *           written is never read). No net trained on them: every human dataset excludes the account.
 *   bo1hi   bo1 TEST-split games (v2's split; v2 trained on TRAIN and selected on VAL) with BOTH players rated >= 1500.
 *           The sets are COMPLETED from the open-sheet population (positions.js, COMPLETION): a bo1 position is a
 *           plausible world, not the true one, and the filled-field count is recorded per position.
 *   bo3hi   bo3 TEST-split games v1 never saw (v1_unseen, v2's gate (a) population) with both players rated >= 1300.
 *           Calibration only (no deep label), so the bands above 1300 hold open-sheet human games too.
 * Every turn-start position is kept for CALIBRATION (test (b)); a seeded subset with a real decision is LABELLED by the
 * deep reference (test (a), deep.js). The deciding chair (`me`) is medicham32 on the ladder and a seeded coin per game
 * for human games. positions.jsonl.gz holds the serialised world (v8) and the prior's history, so a re-run reads the
 * SAME positions; manifest.json holds every input's sha256 and the output's.
 *
 * THE LABEL (label). Per labelled position: MILTANK's root (k x k, one reserved switch row, the mega reservation) and R
 * honest worlds; each cell r = one game played to the end by gen5's prior on both sides (deep.js). Written per cell as
 * the R results, so the reference's split-half reliability is computable.
 *
 * THE SCORE (score). Per net: the value of every position (calibration), and for labelled positions the net's depth-0
 * matrix on the same worlds and dice (r < rnet). Read by `report`, which writes report-<nets>.json:
 *   ranking   per position, the rows' values against the DEEP column mix (SLOWKING's LP on the deep matrix): Kendall
 *             tau-b (net rows vs deep rows), top-1 agreement (the net's best row is the deep best row), and regret (deep
 *             value of the deep best row minus deep value of the net's LP mix, in win-probability points); cell tau-b
 *             over all k x k cells; the reference's split-half reliability (even vs odd playouts, the same tie-tolerant top-1);
 *             every figure again on the INFORMATIVE positions (the deep rows not all equal).
 *   calib     by source and by min-rating band: log-loss, Brier, ECE (10 equal-width bins), the reliability table, and
 *             the overconfidence gap on values in [0.5, 0.9) (mean value minus win rate), CI by game-clustered bootstrap.
 *   cost      bench: microseconds per leaf evaluation, every net on a fresh copy of the same boards, rotated order.
 * Paired differences against --base (gen5) carry 95% CIs, bootstrap over games (2,000 resamples, seed 7).
 *
 * DIAGNOSTIC BREAKS (env P2V3_BREAK, for a hand check, not a test): `leak` puts one TRAIN game into a build; `crn` makes the
 * net's cell r read a different world than the deep cell r. The test's own breaks are P2V3_TEST_BREAK=leak and
 * P2V3_DEEP_BREAK=orient (solver/tests/test-porygon2-v3-evalset.js).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const readline = require('readline');
const cp = require('child_process');
const os = require('os');
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { console.error('could not lower priority: ' + e.message); }
const argv = process.argv.slice(2);
const CMD = argv[0];
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..', '..');
const MAIN = 'C:/Users/willj/Projects/Pokemon/ABRA';
const DATA = path.resolve(flag('data-root', MAIN));
const DIR = path.resolve(ROOT, flag('dir', 'solver/out/p2v3/evalset'));
const REL_ID = flag('release', 'eaa5becc54eb');
const BREAK = process.env.P2V3_BREAK || '';
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const shaFile = f => sha256(fs.readFileSync(f));
const h32 = s => crypto.createHash('sha256').update(String(s)).digest().readUInt32BE(0);
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

/* the finished ladder runs read (a run still being written is never read: the live one is not in this list) */
const LADDER_RUNS = ['aa1-2026-09-25T21-00-29-440Z', 'aa2-2026-09-25T23-54-09-059Z', 'gen5ab-2026-09-26T04-06-53-848Z', 'chomp1-2026-09-29T23-13-11-521Z'];
const ACCOUNT = 'medicham32';
function band(r1, r2) {
  if (!(r1 > 0) || !(r2 > 0)) return 'unrated';
  const m = Math.min(r1, r2);
  if (m >= 1500) return '>=1500'; if (m >= 1400) return '1400-1499'; if (m >= 1300) return '1300-1399';
  if (m >= 1200) return '1200-1299'; if (m >= 1100) return '1100-1199'; return '<1100';
}
const CODE = ['solver/porygon2/v3/evalset.js', 'solver/porygon2/v3/positions.js', 'solver/porygon2/v3/deep.js', 'solver/rotom/world.js', 'solver/human/parse_game.js',
  'solver/porygon2/v2/reveal.js', 'solver/miltank/prior_adapter.js', 'solver/miltank/rollout.js', 'solver/miltank/search.js', 'solver/arena/teams.js'];
const codeDigests = () => Object.fromEntries(CODE.map(f => [f, shaFile(path.join(ROOT, f))]));

async function* lines(file) {
  const s = fs.createReadStream(file).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: s, crlfDelay: Infinity });
  for await (const l of rl) if (l) yield l;
}
function readJsonlGz(file) { return zlib.gunzipSync(fs.readFileSync(file)).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); }

function engine() {
  require('../../arena/env.js');
  const E = require('../../arena/engine.js').load(REL_ID);
  if (!E.id) throw new Error('evalset: a frozen release is required');
  return E;
}

/* ================================================================ build */
async function build() {
  const t0 = Date.now();
  const E = engine(), API = E.API;
  const POS = require('./positions.js');
  const P = POS.create(API);
  const Rv = require('../v2/reveal.js');
  fs.mkdirSync(DIR, { recursive: true });
  const inputs = [];
  const counts = { ladder: { games: 0, positions: 0, skipped: {} }, bo1hi: { games: 0, positions: 0, skipped: {} }, bo3hi: { games: 0, positions: 0, skipped: {} } };
  const skip = (src, why) => { counts[src].skipped[why] = (counts[src].skipped[why] || 0) + 1; };
  const out = [];
  const add = (src, G, pos, me, extra) => {
    const w = pos.w;
    const opp = me === 'p1' ? 'p2' : 'p1';
    const r = { p1: G.players.p1 && G.players.p1.rating, p2: G.players.p2 && G.players.p2.rating };
    const z = G.tie ? 0.5 : G.winner === me ? 1 : 0;
    const la = API.legalActions(w.S, w.side);
    out.push(Object.assign({ key: src + '|' + G.id + '|' + pos.turn, source: src, id: G.id, turn: pos.turn, me, side: w.side, z, end: G.end,
      r_me: r[me] || null, r_opp: r[opp] || null, band: band(r.p1, r.p2), n_legal: la.joint.length,
      sheets: pos.sheets, hist: w.ctx.hist, S: require('v8').serialize(w.S).toString('base64') }, extra || {}));
    counts[src].positions++;
  };

  /* ---- ladder ---- */
  for (const run of LADDER_RUNS) {
    const gdir = path.join(DATA, 'solver', 'out', 'rotom', run, 'games', ACCOUNT);
    for (const f of fs.readdirSync(gdir).filter(x => x.endsWith('.log')).sort()) {
      const file = path.join(gdir, f);
      const log = fs.readFileSync(file, 'utf8');
      inputs.push({ role: 'ladder_log', path: file.replace(/\\/g, '/'), sha256: sha256(log) });
      let me = null; for (const l of log.split('\n')) { const p = l.split('|'); if (p[1] === 'player' && toIDs(p[3]) === ACCOUNT) me = p[2]; }
      if (!me) { skip('ladder', 'no_account'); continue; }
      const id = f.replace(/\.log$/, '').replace(/^battle-/, '');
      const r = P.fromLog({ id, log, me });
      if (r.error) { skip('ladder', r.error); continue; }
      if (!r.game.winner && !r.game.tie) { skip('ladder', 'no_result'); continue; }
      counts.ladder.games++;
      for (const pos of r.positions) add('ladder', r.game, pos, me, { run });
    }
  }

  /* ---- human games from v2's datasets: the split and the reveal state are v2's own ---- */
  const v2dir = path.join(DATA, 'solver', 'out', 'porygon2-v2');
  const rawCache = new Map();
  const rawLog = (fmtDir, shard, id) => {
    const k = fmtDir + '/' + shard;
    if (!rawCache.has(k)) {
      const file = path.join(DATA, 'data', 'raw', fmtDir, shard);
      const rows = readJsonlGz(file);
      inputs.push({ role: 'raw_log', path: file.replace(/\\/g, '/'), sha256: shaFile(file) });
      rawCache.set(k, new Map(rows.map(x => [x.id, x.log])));
      if (rawCache.size > 64) rawCache.delete(rawCache.keys().next().value);
    }
    return rawCache.get(k).get(id);
  };
  /* the open-sheet set library: bo3 TRAIN and VAL games' turn-0 sheets (no test game, so no eval game feeds a completion) */
  const LIB0 = {};
  const bo3f = path.join(v2dir, 'bo3', 'games.jsonl.gz');
  const bo1f = path.join(v2dir, 'bo1', 'games.jsonl.gz');
  inputs.push({ role: 'v2_dataset_bo3', path: bo3f.replace(/\\/g, '/'), sha256: shaFile(bo3f) });
  inputs.push({ role: 'v2_dataset_bo1', path: bo1f.replace(/\\/g, '/'), sha256: shaFile(bo1f) });
  const bo3hi = [];
  for await (const l of lines(bo3f)) {
    const g = JSON.parse(l);
    if (g.split === 'test') { if ((g.v1_unseen === true || g.v1_unseen === 1) && g.rating.p1 >= 1300 && g.rating.p2 >= 1300) bo3hi.push({ id: g.id, shard: g.shard }); continue; }
    const x = g.positions[0] && g.positions[0].x; if (!x) continue;
    for (const s of ['p1', 'p2']) for (const m of x.sides[s].mons) {
      if (!m.moves || m.moves.includes('<UNK>')) continue;
      POS.addToLibrary(LIB0, { species: m.species, item: m.item && m.item.orig, ability: m.ability && m.ability.base, moves: m.moves, nature: m.nature !== '<UNK>' ? m.nature : null });
    }
  }
  const LIB = POS.finishLibrary(LIB0);
  fs.writeFileSync(path.join(DIR, 'setlib.json'), JSON.stringify(LIB));
  const bo1hi = [];
  for await (const l of lines(bo1f)) {
    const g = JSON.parse(l);
    if (g.split === 'test' && g.rating.p1 >= 1500 && g.rating.p2 >= 1500) bo1hi.push({ id: g.id, shard: g.shard });
  }
  /* DELIBERATE BREAK leak: one TRAIN game joins the set */
  if (BREAK === 'leak') {
    for await (const l of lines(bo1f)) { const g = JSON.parse(l); if (g.split === 'train' && g.rating.p1 >= 1500 && g.rating.p2 >= 1500) { bo1hi.push({ id: g.id, shard: g.shard }); break; } }
  }
  const filledTot = { moves: 0, item: 0, ability: 0, nature: 0, library_miss: 0, consistent: 0, members: 0 };
  for (const g of bo1hi) {
    const log = rawLog('games.gen9championsvgc2026regmc', g.shard, g.id);
    if (!log) { skip('bo1hi', 'no_raw_log'); continue; }
    let ex; try { ex = Rv.extract(log, { mode: 'bo1' }); } catch (e) { skip('bo1hi', 'reveal_' + (e.code || 'error')); continue; }
    const c = POS.complete(ex.final_state, LIB);
    for (const k in c.filled) filledTot[k] += c.filled[k];
    const me = h32('me:' + g.id) % 2 ? 'p2' : 'p1';
    const r = P.fromLog({ id: g.id, log: POS.injectSheets(log, c.sheets), me });
    if (r.error) { skip('bo1hi', r.error); continue; }
    if (!r.game.winner && !r.game.tie) { skip('bo1hi', 'no_result'); continue; }
    counts.bo1hi.games++;
    for (const pos of r.positions) add('bo1hi', r.game, pos, me, { filled: c.filled });
  }
  for (const g of bo3hi) {
    const log = rawLog('games.gen9championsvgc2026regmcbo3', g.shard, g.id);
    if (!log) { skip('bo3hi', 'no_raw_log'); continue; }
    const me = h32('me:' + g.id) % 2 ? 'p2' : 'p1';
    const r = P.fromLog({ id: g.id, log, me });
    if (r.error) { skip('bo3hi', r.error); continue; }
    if (!r.game.winner && !r.game.tie) { skip('bo3hi', 'no_result'); continue; }
    counts.bo3hi.games++;
    for (const pos of r.positions) add('bo3hi', r.game, pos, me);
  }
  /* ---- the labelled subset: a real decision (more than one legal joint), ladder and bo1hi, a seeded stride ---- */
  const LABEL_N = { ladder: +flag('label-ladder', 600), bo1hi: +flag('label-bo1', 700) };
  for (const src of Object.keys(LABEL_N)) {
    const el = out.filter(p => p.source === src && p.n_legal > 1).sort((a, b) => h32('lab:' + a.key) - h32('lab:' + b.key));
    for (const p of el.slice(0, LABEL_N[src])) p.label = true;
  }
  const file = path.join(DIR, 'positions.jsonl.gz');
  fs.writeFileSync(file, zlib.gzipSync(out.map(p => JSON.stringify(p)).join('\n') + '\n'));
  const games = {}; for (const p of out) (games[p.source] = games[p.source] || new Set()).add(p.id);
  const manifest = {
    what: 'PORYGON2 v3 frozen evaluation set (solver/porygon2/v3/evalset.js build). NEVER TRAIN ON IT.',
    built: new Date().toISOString(), seconds: (Date.now() - t0) / 1000, node: process.version, argv,
    engine_release: E.id, release_stamp: E.stamp, data_root: DATA.replace(/\\/g, '/'), ladder_runs: LADDER_RUNS,
    selection: { ladder: 'every finished game of the four runs, chair = ' + ACCOUNT, bo1hi: 'v2 bo1 split=test, both ratings >= 1500, sets completed (positions.js)', bo3hi: 'v2 bo3 split=test, v1_unseen, both ratings >= 1300', chair: 'human games: sha256("me:"+id) mod 2', label: LABEL_N },
    counts, completion_filled: filledTot, positions: out.length, labelled: out.filter(p => p.label).length,
    labelled_by_source: Object.fromEntries(Object.keys(counts).map(s => [s, out.filter(p => p.label && p.source === s).length])),
    by_band: out.reduce((a, p) => { a[p.band] = (a[p.band] || 0) + 1; return a; }, {}),
    game_ids: Object.fromEntries(Object.entries(games).map(([s, v]) => [s, [...v].sort()])),
    world_counters: P.worldCounters, position_counters: P.COUNTERS, code: codeDigests(),
    inputs: inputs.sort((a, b) => (a.path < b.path ? -1 : 1)),
    output: { path: rel(file), sha256: shaFile(file), bytes: fs.statSync(file).size }, break: BREAK || null,
  };
  fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(JSON.stringify({ positions: out.length, labelled: manifest.labelled, labelled_by_source: manifest.labelled_by_source, counts, completion_filled: filledTot, by_band: manifest.by_band, seconds: manifest.seconds }, null, 1));
}
function toIDs(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

/* ================================================================ shared: positions back from disk */
function loadPositions(filter) {
  const man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  const file = path.join(DIR, 'positions.jsonl.gz');
  if (shaFile(file) !== man.output.sha256) throw new Error('evalset: positions.jsonl.gz does not match its manifest (the set is FROZEN; rebuild it on purpose or not at all)');
  const v8 = require('v8');
  return { man, rows: readJsonlGz(file).filter(filter || (() => true)), world: p => v8.deserialize(Buffer.from(p.S, 'base64')) };
}
function deps(API) {
  const T = require('../../arena/teams.js');
  const prior = require('../../mag/infer.js').load({ mag: path.join(ROOT, 'solver/machamp/models/gen5/mag-gen5.json'), doduo: path.join(ROOT, 'solver/machamp/models/gen5/doduo-gen5.json') });
  const PA = require('../../miltank/prior_adapter.js').create(API, prior);
  const R = require('../../miltank/rollout.js').create(API, { buildBody: T.buildBody });
  const MT = require('../../miltank/search.js').create(API, { prior: PA, rollout: R });
  const D = require('./deep.js').create(API, { PA, R, MT });
  return { PA, R, MT, D };
}
const ctxOf = p => ({ G: { sheets: p.sheets }, hist: p.hist });
function forkAll(sub, W, extra) {
  return Promise.all(Array.from({ length: W }, (_, i) => new Promise(res => {
    const ch = cp.fork(__filename, [sub, ...argv.slice(1), '--shard', String(i), '--shards', String(W)].concat(extra || []), { execArgv: ['--max-old-space-size=3072'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    console.log(sub + ': shard ' + i + ' pid ' + ch.pid);
    ch.on('exit', code => res({ shard: i, code, pid: ch.pid }));
  })));
}

/* ================================================================ label */
const K = +flag('k', 4), RD = +flag('r', 8), CAP = +flag('cap', 30);
function labelWorker(shard, shards) {
  const E = engine(), API = E.API;
  const { D } = deps(API);
  const { rows: rows0, world } = loadPositions(p => p.label);
  /* a seeded interleave over the sources, so a run stopped at its --deadline holds a balanced subset */
  const rows = rows0.sort((a, b) => h32('ord:' + a.key) - h32('ord:' + b.key));
  const DEADLINE = flag('deadline', null) ? Date.parse(flag('deadline')) : Infinity;
  const out = path.join(DIR, `labels-${shard}.jsonl`);
  const done = new Set(fs.existsSync(out) ? fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).key) : []);
  const t0 = Date.now(); let n = 0;
  for (let i = shard; i < rows.length; i += shards) {
    const p = rows[i];
    if (done.has(p.key)) continue;
    if (Date.now() > DEADLINE) { console.log(`  [label ${shard}] deadline: stopped after ${n}`); break; }
    const S = world(p), ctx = ctxOf(p);
    const t1 = Date.now();
    let rec;
    try {
      const c = D.candidates(S, p.side, ctx, K, K, 1);
      if (c.forced) rec = { key: p.key, forced: true };
      else {
        const W = []; for (let r = 0; r < RD; r++) W.push(D.world(S, p.side, ctx, r, p.key));
        const cells = c.rows.map(a => c.cols.map(b => W.map((w, r) => { const o = D.deepCell(w, p.side, a, b, r, p.key, ctx, CAP); return o.capped ? -1 - o.v : o.v; })));
        rec = { key: p.key, rows: c.rows, cols: c.cols, prior_row: c.priorRow, n_legal: c.nLegal, cells, ms: Date.now() - t1 };
      }
    } catch (e) { rec = { key: p.key, error: String(e && e.message || e).slice(0, 300) }; }
    fs.appendFileSync(out, JSON.stringify(rec) + '\n');
    n++;
    if (n % 10 === 0) console.log(`  [label ${shard}] ${n} positions ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  fs.writeFileSync(out + '.summary.json', JSON.stringify({ shard, n, seconds: (Date.now() - t0) / 1000, deep: D.COUNTERS, engine_release: E.id, flags: { k: K, r: RD, cap: CAP } }, null, 1));
}
async function label() {
  const W = +flag('workers', 6);
  const exits = await forkAll('label-worker', W);
  const sums = exits.map(e => { try { return JSON.parse(fs.readFileSync(path.join(DIR, `labels-${e.shard}.jsonl.summary.json`), 'utf8')); } catch (err) { return null; } });
  const deep = {}; for (const s of sums.filter(Boolean)) for (const k in s.deep) deep[k] = (deep[k] || 0) + s.deep[k];
  const recs = []; for (let i = 0; i < W; i++) { const f = path.join(DIR, `labels-${i}.jsonl`); if (fs.existsSync(f)) recs.push(...fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))); }
  const summary = { what: 'PORYGON2 v3 deep labels (solver/porygon2/v3/evalset.js label)', engine_release: REL_ID, flags: { k: K, r: RD, cap: CAP, workers: W, deadline: flag('deadline', null), policy: 'gen5 MAG+DODUO prior argmax, both sides, to the end' },
    labelled: recs.filter(r => r.cells).length, forced: recs.filter(r => r.forced).length, errors: recs.filter(r => r.error).length, deep, exits,
    files: Array.from({ length: W }, (_, i) => { const f = path.join(DIR, `labels-${i}.jsonl`); return fs.existsSync(f) ? { path: rel(f), sha256: shaFile(f) } : null; }).filter(Boolean) };
  fs.writeFileSync(path.join(DIR, 'labels.summary.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  if (deep.deepPlayouts === 0 || !summary.labelled) { console.error('label: ZERO deep playouts'); process.exit(1); }
}
function loadLabels() {
  const m = new Map();
  for (const f of fs.readdirSync(DIR).filter(f => /^labels-\d+\.jsonl$/.test(f))) for (const l of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n')) if (l) { const r = JSON.parse(l); if (r.cells) m.set(r.key, r); }
  return m;
}

/* ================================================================ score */
function netsArg() {
  return String(flag('nets', '')).split(',').filter(Boolean).map(x => { const [name, file] = x.split('='); return { name, file: file ? path.resolve(ROOT, file) : null }; });
}
function scoreWorker(shard, shards) {
  const E = engine(), API = E.API;
  const { D } = deps(API);
  const LEAF = require('../leaf.js');
  const NETS = netsArg().map(n => Object.assign(n, { L: LEAF.create(API, { model: n.file }) }));
  const RN = +flag('rnet', 4);
  const { rows, world } = loadPositions();
  const labels = loadLabels();
  const tag = flag('tag', NETS.map(n => n.name).join('+'));
  const out = path.join(DIR, `scores-${tag}-${shard}.jsonl`);
  fs.writeFileSync(out, '');
  const t0 = Date.now(); let n = 0;
  for (let i = shard; i < rows.length; i += shards) {
    const p = rows[i];
    const S = world(p), ctx = ctxOf(p);
    /* EVERY value is in the DECIDING CHAIR's frame (p.side): root values and cell values */
    const me = v => (p.side === 'A' ? v : 1 - v);
    const rec = { key: p.key, side: p.side, root: {}, cellsR: {} };
    for (const N of NETS) rec.root[N.name] = me(N.L.value(API.clone(S), p.sheets));
    const lab = labels.get(p.key);
    if (lab) {
      const W = []; for (let r = 0; r < RN; r++) W.push(D.world(S, p.side, ctx, BREAK === 'crn' ? r + 1000 : r, p.key));
      for (const N of NETS) rec.cellsR[N.name] = lab.rows.map(() => lab.cols.map(() => []));
      lab.rows.forEach((a, ii) => lab.cols.forEach((b, jj) => {
        for (let r = 0; r < RN; r++) {
          const S2 = D.successor(W[r], p.side, a, b, r, p.key);           // ONE successor per (cell, r); each net reads its own copy of it
          const term = API.isTerminal(S2), wv = term ? me(API.winner(S2)) : null;
          for (const N of NETS) rec.cellsR[N.name][ii][jj].push(term ? wv : me(N.L.value(API.clone(S2), p.sheets)));
        }
      }));
    }
    fs.appendFileSync(out, JSON.stringify(rec) + '\n');
    if (++n % 50 === 0) console.log(`  [score ${shard}] ${n} positions ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  const own = {}; for (const N of NETS) own[N.name] = N.L.counters || (N.L.net && N.L.net.COUNTERS) || null;
  fs.writeFileSync(out + '.summary.json', JSON.stringify({ shard, n, seconds: (Date.now() - t0) / 1000, nets: NETS.map(N => ({ name: N.name, file: rel(N.file), sha256: shaFile(N.file) })), leaf_own: own, rnet: RN,
    engine_release: E.id }, null, 1));
}
async function score() {
  const W = +flag('workers', 6);
  const exits = await forkAll('score-worker', W);
  console.log(JSON.stringify(exits));
  if (exits.some(e => e.code !== 0)) process.exit(1);
}

/* ================================================================ bench (cost per evaluation) */
function bench() {
  const E = engine(), API = E.API;
  const { D } = deps(API);
  const LEAF = require('../leaf.js');
  const NETS = netsArg().map(n => Object.assign(n, { L: LEAF.create(API, { model: n.file }) }));
  const NP = +flag('positions', 300), REPS = +flag('reps', 3);
  const labels = loadLabels();
  const { rows, world } = loadPositions(p => p.n_legal > 1);
  /* the boards a leaf is asked about in the search: the successor of one stepped cell (r = 0); the cell is MILTANK's own
   * (the label's root when the position is labelled, else the same candidate ranking computed here) */
  const cand = p => labels.get(p.key) || (() => { const c = D.candidates(world(p), p.side, ctxOf(p), K, K, 1); return c.forced ? null : c; })();
  const boards = [];
  for (const p of rows.sort((a, b) => h32('bench:' + a.key) - h32('bench:' + b.key))) {
    if (boards.length >= NP) break;
    const lab = cand(p), S = world(p);
    if (!lab) continue;
    const Wd = D.world(S, p.side, ctxOf(p), 0, p.key);
    const B = D.successor(Wd, p.side, lab.rows[0], lab.cols[0], 0, p.key);
    if (!API.isTerminal(B)) boards.push({ S: B, sheets: p.sheets });
  }
  for (const N of NETS) for (const b of boards) N.L.value(API.clone(b.S), b.sheets);         // V8 tier-up
  const now = () => Number(process.hrtime.bigint()) / 1000;
  for (const N of NETS) { N.tot = []; N.enc = []; N.fwd = []; }
  /* EVERY TIMING IS ON A FRESH COPY OF THE BOARD, in a ROTATED net order. In the search each successor board is evaluated
   * once, by one net, so a board-side cache warmed by an earlier call would flatter whoever is timed second. Measured on
   * the first version of this bench (2026-10-01): the first net's encode read ~3x its own encode-plus-forward on the same
   * board, because the separate value() call came after its encode had warmed the board. */
  const arms = NETS.map(N => ({ run: (S, sh) => {
    let t = now(); const X = N.L.encode(S, sh); const te = now() - t;
    t = now(); N.L.net.value(X); const tf = now() - t;
    N.tot.push(te + tf); N.enc.push(te); N.fwd.push(tf);
  } }));
  let k = 0;
  for (let r = 0; r < REPS; r++) for (const b of boards) {
    k++;
    for (let q = 0; q < arms.length; q++) { const a = arms[(q + k) % arms.length]; const S1 = API.clone(b.S); a.run(S1, b.sheets); }
  }
  const q = (v, p) => { const s = v.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const st = v => ({ median: +q(v, 0.5).toFixed(1), mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), p95: +q(v, 0.95).toFixed(1) });
  const base = NETS[0];
  const res = { what: 'leaf cost per evaluation, microseconds (solver/porygon2/v3/evalset.js bench): every net on a fresh copy of the same boards, rotated order, one process, one thread; the ratio to the first net is the figure',
    engine_release: E.id, boards: boards.length, reps: REPS, measured: new Date().toISOString(),
    nets: NETS.map(N => ({ name: N.name, file: rel(N.file), sha256: shaFile(N.file), value_us: st(N.tot), encode_us: st(N.enc), forward_us: st(N.fwd),
      ratio_to_first: +(q(N.tot, 0.5) / q(base.tot, 0.5)).toFixed(3) })) };
  const f = path.join(DIR, 'bench-' + NETS.map(n => n.name).join('+') + '.json');
  fs.writeFileSync(f, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
}

/* ================================================================ report */
function kendallTauB(x, y) {
  let c = 0, d = 0, tx = 0, ty = 0;
  for (let i = 0; i < x.length; i++) for (let j = i + 1; j < x.length; j++) {
    const a = Math.sign(x[i] - x[j]), b = Math.sign(y[i] - y[j]);
    if (a === 0 && b === 0) continue;
    if (a === 0) { tx++; continue; }
    if (b === 0) { ty++; continue; }
    if (a === b) c++; else d++;
  }
  const den = Math.sqrt((c + d + tx) * (c + d + ty));
  return den > 0 ? (c - d) / den : null;
}
const argmax = v => { let b = 0; for (let i = 1; i < v.length; i++) if (v[i] > v[b]) b = i; return b; };
const mean = v => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* game-clustered bootstrap of a per-position statistic's mean (or of a paired difference) */
function boot(items, f, B = 2000, seed = 7) {
  const games = new Map(); for (const it of items) { if (!games.has(it.id)) games.set(it.id, []); games.get(it.id).push(it); }
  const G = [...games.values()], u = rng(seed), stats = [];
  for (let b = 0; b < B; b++) { const s = []; for (let k = 0; k < G.length; k++) s.push(...G[Math.floor(u() * G.length)]); const v = f(s); if (v != null && Number.isFinite(v)) stats.push(v); }
  stats.sort((a, b) => a - b);
  return [+stats[Math.floor(0.025 * stats.length)].toFixed(4), +stats[Math.floor(0.975 * stats.length)].toFixed(4)];
}
function calib(items, net, noCI) {
  const v = items.map(x => Math.min(1 - 1e-6, Math.max(1e-6, x.root[net]))), z = items.map(x => x.z);
  const ll = mean(v.map((p, i) => -(z[i] * Math.log(p) + (1 - z[i]) * Math.log(1 - p))));
  const brier = mean(v.map((p, i) => (p - z[i]) ** 2));
  const bins = Array.from({ length: 10 }, () => ({ n: 0, v: 0, z: 0 }));
  v.forEach((p, i) => { const b = bins[Math.min(9, Math.floor(p * 10))]; b.n++; b.v += p; b.z += z[i]; });
  const ece = bins.reduce((a, b) => a + (b.n ? b.n * Math.abs(b.v / b.n - b.z / b.n) : 0), 0) / v.length;
  const mid = items.filter(x => x.root[net] >= 0.5 && x.root[net] < 0.9);
  const gapOf = s => { const m = s.filter(x => x.root[net] >= 0.5 && x.root[net] < 0.9); return m.length ? mean(m.map(x => x.root[net])) - mean(m.map(x => x.z)) : null; };
  return { n: items.length, games: new Set(items.map(x => x.id)).size, logloss: +ll.toFixed(4), brier: +brier.toFixed(4), ece: +ece.toFixed(4),
    gap_05_09: mid.length ? +gapOf(items).toFixed(4) : null, gap_05_09_n: mid.length, gap_05_09_ci: !noCI && mid.length > 20 ? boot(items, gapOf) : null,
    reliability: bins.map((b, i) => ({ bin: (i / 10).toFixed(1) + '-' + ((i + 1) / 10).toFixed(1), n: b.n, mean_value: b.n ? +(b.v / b.n).toFixed(3) : null, win_rate: b.n ? +(b.z / b.n).toFixed(3) : null })) };
}
/* every position of a set with every score written for it: the newest record per (key, net) wins */
function loadScored(dir) {
  const pos = new Map(readJsonlGz(path.join(dir, 'positions.jsonl.gz')).map(p => [p.key, { key: p.key, id: p.id, source: p.source, band: p.band, z: p.z, side: p.side, label: !!p.label, root: {}, cells: {}, cellsR: {} }]));
  for (const f of fs.readdirSync(dir).filter(f => /^scores-.*-\d+\.jsonl$/.test(f)).sort((a, b) => fs.statSync(path.join(dir, a)).mtimeMs - fs.statSync(path.join(dir, b)).mtimeMs)) {
    for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (!l) continue; const r = JSON.parse(l); const p = pos.get(r.key); if (!p) continue;
      Object.assign(p.root, r.root);
      for (const [n, M] of Object.entries(r.cellsR || {})) { p.cellsR[n] = M; p.cells[n] = M.map(row => row.map(vs => mean(vs))); }
    }
  }
  return pos;
}
function report() {
  const SK = require('../../slowking/matrix.js');
  const man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  const pos = loadScored(DIR);
  const labels = loadLabels();
  const want = String(flag('nets', 'gen5,v1,v2')).split(',').map(x => x.split('=')[0]);
  const BASE = flag('base', want[0]);
  const all = [...pos.values()].filter(p => p.root && want.every(n => p.root[n] != null));
  /* ---- ranking ---- */
  const rank = [];
  for (const p of all) {
    const lab = labels.get(p.key); if (!lab || !p.cells || !want.every(n => p.cells[n])) continue;
    /* the deep results are side A's (API.winner); the matrix game is solved in the DECIDING chair's frame */
    const val = x => { const v = x < 0 ? -1 - x : x; return p.side === 'A' ? v : 1 - v; };
    const deepM = sel => lab.cells.map(row => row.map(c => { const s = c.map(val).filter((_, r) => sel(r)); return mean(s); }));
    const Ad = deepM(() => true), Ae = deepM(r => r % 2 === 0), Ao = deepM(r => r % 2 === 1);
    const solD = SK.solveLP(Ad); const y = solD.y;
    const rows = A => A.map(row => row.reduce((a, v, j) => a + v * y[j], 0));
    const rd = rows(Ad), best = Math.max(...rd);
    /* FLAT: every row has the same deep value (a game already decided under every row, or tied rows); it carries no ranking
     * and makes top-1 trivially 1, so the report also gives every figure on the informative (non-flat) positions */
    const re = rows(Ae), ro = rows(Ao);
    const it = { key: p.key, id: p.id, source: p.source, band: p.band, m: Ad.length, n: Ad[0].length, deep_value: solD.value, flat: best - Math.min(...rd) < 1e-9,
      /* the noise ceiling: the reference against itself, even playouts vs odd, top-1 on the SAME tie-tolerant rule as the nets */
      ceiling: { tau: kendallTauB(re, ro), top1: ro[argmax(re)] >= Math.max(...ro) - 1e-12 ? 1 : 0 } };
    for (const n of want) {
      const An = p.cells[n], rn = rows(An);
      const xs = SK.solveLP(An).x;
      it[n] = { tau: kendallTauB(rn, rd), top1: rd[argmax(rn)] >= best - 1e-12 ? 1 : 0, regret: best - xs.reduce((a, w, i) => a + w * rd[i], 0),
        cell_tau: kendallTauB(An.flat(), Ad.flat()) };
    }
    rank.push(it);
  }
  const rsum = (items, n) => {
    const t = items.map(x => x[n].tau).filter(v => v != null);
    return { positions: items.length, games: new Set(items.map(x => x.id)).size, tau: +mean(t).toFixed(4), top1: +mean(items.map(x => x[n].top1)).toFixed(4),
      regret: +mean(items.map(x => x[n].regret)).toFixed(4), cell_tau: +mean(items.map(x => x[n].cell_tau).filter(v => v != null)).toFixed(4) };
  };
  const ceil = items => ({ tau: +mean(items.map(x => x.ceiling.tau).filter(v => v != null)).toFixed(4), top1: +mean(items.map(x => x.ceiling.top1)).toFixed(4) });
  const paired = (items, n, field) => {
    const f = s => mean(s.map(x => x[n][field] == null || x[BASE][field] == null ? 0 : x[n][field] - x[BASE][field]));
    return { diff: +f(items).toFixed(4), ci: boot(items, f) };
  };
  const ranking = { all: {}, by_source: {}, ceiling: ceil(rank), ceiling_by_source: {} };
  const sources = [...new Set(rank.map(x => x.source))].sort();
  for (const n of want) {
    ranking.all[n] = rsum(rank, n);
    if (n !== BASE) ranking.all[n].vs_base = { base: BASE, tau: paired(rank, n, 'tau'), top1: paired(rank, n, 'top1'), regret: paired(rank, n, 'regret') };
    for (const s of sources) { (ranking.by_source[s] = ranking.by_source[s] || {})[n] = rsum(rank.filter(x => x.source === s), n); }
  }
  for (const s of sources) ranking.ceiling_by_source[s] = ceil(rank.filter(x => x.source === s));
  const inf = rank.filter(x => !x.flat);
  ranking.informative = { positions: inf.length, flat: rank.length - inf.length, ceiling: ceil(inf), nets: {} };
  for (const n of want) {
    ranking.informative.nets[n] = rsum(inf, n);
    if (n !== BASE) ranking.informative.nets[n].vs_base = { base: BASE, tau: paired(inf, n, 'tau'), top1: paired(inf, n, 'top1'), regret: paired(inf, n, 'regret') };
  }
  /* ---- calibration ---- */
  const calibration = { all: {}, by_source: {}, by_band: {} };
  const bands = [...new Set(all.map(x => x.band))].sort();
  const srcs = [...new Set(all.map(x => x.source))].sort();
  for (const n of want) {
    calibration.all[n] = calib(all, n);
    for (const s of srcs) (calibration.by_source[s] = calibration.by_source[s] || {})[n] = calib(all.filter(x => x.source === s), n);
    for (const b of bands) { const it = all.filter(x => x.band === b); if (it.length >= 50) (calibration.by_band[b] = calibration.by_band[b] || {})[n] = calib(it, n); }
    if (n !== BASE) {
      const f = net => s => calib(s, net, true).ece;          // no inner bootstrap inside the outer one
      calibration.all[n].ece_vs_base = { diff: +(calibration.all[n].ece - calibration.all[BASE].ece).toFixed(4), ci: boot(all, s => f(n)(s) - f(BASE)(s), 400) };
      const g = net => s => { const m = s.filter(x => x.root[net] >= 0.5 && x.root[net] < 0.9); return m.length ? Math.abs(mean(m.map(x => x.root[net])) - mean(m.map(x => x.z))) : null; };
      calibration.all[n].absgap_vs_base = { diff: +((Math.abs(calibration.all[n].gap_05_09) - Math.abs(calibration.all[BASE].gap_05_09))).toFixed(4), ci: boot(all, s => g(n)(s) - g(BASE)(s), 400) };
    }
  }
  /* ---- cost ---- */
  const benches = fs.readdirSync(DIR).filter(f => /^bench-.*\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
  const rep = { what: 'PORYGON2 v3 harness report (solver/porygon2/v3/evalset.js report)', made: new Date().toISOString(), engine_release: man.engine_release,
    evalset: { sha256: man.output.sha256, positions: man.positions, labelled: man.labelled }, base: BASE, nets: want,
    ranking, calibration, cost: benches, deep_flags: (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'labels.summary.json'), 'utf8')).flags; } catch (e) { return null; } })() };
  const f = path.join(DIR, 'report-' + want.join('+') + '.json');
  fs.writeFileSync(f, JSON.stringify(rep, null, 1));
  /* the table */
  console.log('ranking (' + rank.length + ' labelled positions; ceiling tau ' + ranking.ceiling.tau + ', top-1 ' + ranking.ceiling.top1 + ')');
  for (const n of want) { const a = ranking.all[n]; console.log(`  ${n.padEnd(8)} tau ${a.tau}  top1 ${a.top1}  regret ${a.regret}  cell_tau ${a.cell_tau}` + (a.vs_base ? `   vs ${BASE}: tau ${a.vs_base.tau.diff} ${JSON.stringify(a.vs_base.tau.ci)} top1 ${a.vs_base.top1.diff} ${JSON.stringify(a.vs_base.top1.ci)} regret ${a.vs_base.regret.diff} ${JSON.stringify(a.vs_base.regret.ci)}` : '')); }
  const I = ranking.informative;
  console.log('ranking, informative positions only (' + I.positions + '; ' + I.flat + ' flat; ceiling tau ' + I.ceiling.tau + ', top-1 ' + I.ceiling.top1 + ')');
  for (const n of want) { const a = I.nets[n]; console.log(`  ${n.padEnd(8)} tau ${a.tau}  top1 ${a.top1}  regret ${a.regret}  cell_tau ${a.cell_tau}` + (a.vs_base ? `   vs ${BASE}: tau ${a.vs_base.tau.diff} ${JSON.stringify(a.vs_base.tau.ci)} top1 ${a.vs_base.top1.diff} ${JSON.stringify(a.vs_base.top1.ci)} regret ${a.vs_base.regret.diff} ${JSON.stringify(a.vs_base.regret.ci)}` : '')); }
  console.log('calibration (' + all.length + ' positions)');
  for (const n of want) { const c = calibration.all[n]; console.log(`  ${n.padEnd(8)} ll ${c.logloss} brier ${c.brier} ece ${c.ece} gap[0.5,0.9) ${c.gap_05_09} ${JSON.stringify(c.gap_05_09_ci)} (n ${c.gap_05_09_n})` + (c.ece_vs_base ? `  ece-vs-${BASE} ${c.ece_vs_base.diff} ${JSON.stringify(c.ece_vs_base.ci)}` : '')); }
  for (const s of srcs) for (const n of want) { const c = calibration.by_source[s][n]; console.log(`    ${s} ${n.padEnd(8)} ll ${c.logloss} ece ${c.ece} gap ${c.gap_05_09} ${JSON.stringify(c.gap_05_09_ci)} n ${c.n}`); }
  for (const b of Object.keys(calibration.by_band)) for (const n of want) { const c = calibration.by_band[b][n]; console.log(`    band ${b} ${n.padEnd(8)} ll ${c.logloss} ece ${c.ece} gap ${c.gap_05_09} n ${c.n}`); }
  for (const B of benches) for (const N of B.nets) console.log(`  cost ${N.name.padEnd(8)} ${N.value_us.median} us median (encode ${N.encode_us.median}, forward ${N.forward_us.median}), x${N.ratio_to_first} of ${B.nets[0].name}`);
  console.log('wrote ' + rel(f));
}

if (require.main === module) {
  const sh = flag('shard', null);
  const run = { build, label, score, bench, report, 'label-worker': () => labelWorker(+sh, +flag('shards', 1)), 'score-worker': () => scoreWorker(+sh, +flag('shards', 1)) }[CMD];
  if (!run) { console.error('usage: evalset.js build|label|score|bench|report [flags]'); process.exit(2); }
  Promise.resolve(run()).then(() => process.exit(0), e => { console.error(e && e.stack || e); process.exit(1); });
}

module.exports = { kendallTauB, calib, band, LADDER_RUNS };
