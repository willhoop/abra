/* ABRA-HEAP: 2048
 * solver/miltank/eval_kl_human.js — THE HUMAN-REGULARISED SOLVE ON HELD-OUT HUMAN DECISIONS: how often, and how
 * likely, does gen5's search play what the human actually clicked, as the KL weight lambda moves?
 * (2026-09-30, docs/_reports/2026-09-30-human-regularised-search.md)
 *
 *   node solver/miltank/eval_kl_human.js --release eaa5becc54eb --n 600 --seed 1 --workers 2 --passes 16
 *        --out solver/out/pikl/human-s1                    (a worker: the same with --shard i --shards n)
 *   node solver/miltank/eval_kl_human.js --analyse solver/out/pikl/human-s1 [--grid 0,0.001,...,inf]
 *
 * THE DECISIONS. As solver/doduo/eval_gates.js: Reg M-C human games from the dataset (the MAIN checkout's
 * solver/out/human/games.jsonl, read only, STREAMED), the acting player in the TEST split of every solver net
 * (sha256("abra-prior-v0:" + player) mod 100 >= 90), both brought fours complete, no custom rules, six-row sheets, and
 * a JOINT action fully observed (every occupied slot a move with a certain target, or a switch). A decision is kept when
 * sha256(seed:id:turn:side) mod K == 0, K = ceil(eligible estimate / n) — a seeded hash sample, so the file is read
 * once, streamed, and the sample spans the corpus's dates.
 *
 * THE POSITION is eval_gates.js's: solver/rotom/world.js from the public state before the turn, the two open sheets and
 * a request synthesised from that public state; the opponent's back line from its true brought four (the search redraws
 * every UNREVEALED body per world, solver/miltank/rollout.js sampleWorld, so the hindsight never reaches a playout).
 * The consecutive-Protect counter is world.js's walk over the dataset's actions (every stalling click counted, held or
 * not: the log is not in the dataset).
 *
 * THE SEARCH is gen5's (solver/machamp/league/gen5.json): gen5 MAG + DODUO rank both sides' joints, k 4x4 with one
 * reserved switch row, depth 0, the PORYGON2 gen5 leaf, the plain uniform back-line redraw (the arena's non-honest
 * path), at a FIXED pass count (--passes; no clock, so machine load cannot change a table). Each decision's root is
 * RECORDED — the candidate rows and columns, the mean table, the prior's scores on both — once. The lambda sweep is then
 * OFFLINE (--analyse): the regularised solve depends only on the table and the anchors, so every lambda is judged on the
 * SAME tables, and lambda = 0 is exactly the plain solve the search runs (solveRM, 4,000 iterations, tol 1e-4).
 *
 * PER DECISION, beside the root: the human's joint (its index among the rows, or -1), and DODUO's own view over EVERY
 * legal joint (the human joint's probability and rank): the search can only agree with a click among its k1 rows, so the
 * coverage is reported and the no-search reference is the prior's argmax over everything.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const crypto = require('crypto');
const readline = require('readline');
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const REL_ID = flag('--release', null);
const OUT = path.resolve(ROOT, flag('--out', 'solver/out/pikl/human'));
const N = +flag('--n', 600), SEED = +flag('--seed', 1), WORKERS = Math.min(3, +flag('--workers', 2)), PASSES = +flag('--passes', 16);
const SHARD = flag('--shard', null), SHARDS = +flag('--shards', 1);
const ANALYSE = flag('--analyse', null);
const HUMAN = flag('--human', path.join('C:', 'Users', 'willj', 'Projects', 'Pokemon', 'ABRA', 'solver', 'out', 'human', 'games.jsonl'));
/* the eligible count the hash rate is set from: eval_gates.js's full TEST-split pass on the same dataset found 20,501
 * (docs/_reports/2026-09-30-double-protect-gate.md §2). A different dataset changes only the sample size, which is printed. */
const ELIG_EST = +flag('--eligible-estimate', 20501);
const SALT = 'abra-prior-v0';
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const splitOf = pid => { const h = crypto.createHash('sha256').update(SALT + ':' + pid).digest().readUInt32BE(0) % 100; return h < 80 ? 'train' : h < 90 ? 'val' : 'test'; };
const hashPick = (id, ti, p, K) => crypto.createHash('sha256').update(SEED + ':' + id + ':' + ti + ':' + p).digest().readUInt32BE(0) % K === 0;
const exactAction = x => !!x && (x.kind === 'switch' || (x.kind === 'move' && x.target_certain !== false));

/* ---------- selection (coordinator): one streamed pass ---------- */
async function select() {
  const K = Math.max(1, Math.ceil(ELIG_EST / N));
  const h = crypto.createHash('sha256');
  const counts = { games: 0, test_games: 0, eligible_games: 0, eligible: 0, picked: 0, K };
  const picks = [], lines = [];
  const rl = readline.createInterface({ input: fs.createReadStream(HUMAN), crlfDelay: Infinity });
  for await (const line of rl) {
    h.update(line + '\n');
    if (!line) continue;
    counts.games++;
    const g = JSON.parse(line), G = g.game;
    const sides = ['p1', 'p2'].filter(p => splitOf(toID(G.players[p].name)) === 'test');
    if (!sides.length) continue;
    counts.test_games++;
    if (G.custom_rules || !G.bring_complete || !G.bring_complete.p1 || !G.bring_complete.p2) continue;
    if ((G.sheets.p1 || []).length !== 6 || (G.sheets.p2 || []).length !== 6) continue;
    counts.eligible_games++;
    let used = false;
    g.turns.forEach((t, ti) => {
      for (const p of sides) {
        const act = t.state.sides[p].active || [];
        const A = t.actions && t.actions[p];
        if (!A) continue;
        const occ = [0, 1].filter(i => act[i] != null && !(t.state.sides[p].mons[act[i]] || {}).fnt);
        if (!occ.length || !occ.every(i => exactAction(A[i === 0 ? 'a' : 'b']))) continue;
        counts.eligible++;
        if (!hashPick(G.id, ti, p, K)) continue;
        picks.push({ id: G.id, ti, p }); used = true;
      }
    });
    if (used) lines.push(line);
  }
  counts.picked = picks.length;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'selection.jsonl'), picks.map(x => JSON.stringify(x)).join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'games.jsonl'), lines.join('\n') + '\n');
  return { sha: h.digest('hex'), counts };
}

/* ---------- worker ---------- */
function worker(shard, shards) {
  require('../arena/env.js');
  const ENGINE = require('../arena/engine.js').load(REL_ID);
  const API = ENGINE.API, M = API.M;
  const T = require('../arena/teams.js');
  const WB = require('../rotom/world.js').create(API);
  const SEARCH = require('./search.js');
  const AGm = require('../mew/agent.js').create(API, { buildBody: T.buildBody });
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/gen5.json'), 'utf8'));
  const G5 = AGm.load(spec);
  const leafModel = path.join(ROOT, spec.pory2);
  const key = o => (!o ? '-' : o.kind === 'switch' ? 'sw' + o.to : o.kind === 'move' ? o.move + (o.target != null ? '@' + o.target : '') + (o.mega ? '+M' : '') : o.kind);
  const jkey = j => j.map(key).join(' | ');
  const games = new Map();
  for (const l of fs.readFileSync(path.join(OUT, 'games.jsonl'), 'utf8').split('\n')) if (l) { const g = JSON.parse(l); games.set(g.game.id, g); }
  const picks = fs.readFileSync(path.join(OUT, 'selection.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const outF = path.join(OUT, `decisions-${shard}.jsonl`);
  fs.writeFileSync(outF, '');
  const t0 = Date.now();
  let done = 0;
  for (let i = shard; i < picks.length; i += shards) {
    const pk = picks[i];
    const rec = { i, id: pk.id, ti: pk.ti, p: pk.p };
    try { Object.assign(rec, decide(games.get(pk.id), pk, i)); } catch (e) { rec.error = String(e && e.stack || e).slice(0, 400); }
    fs.appendFileSync(outF, JSON.stringify(rec) + '\n');
    done++;
    if (done % 25 === 0) console.log(`  [shard ${shard}] ${done} decisions  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  fs.writeFileSync(outF.replace(/\.jsonl$/, '.summary.json'), JSON.stringify({ shard, done, wall_s: (Date.now() - t0) / 1000, world: WB.COUNTERS, prior: G5.PA.COUNTERS, rollout: AGm.R.COUNTERS, release: ENGINE.stamp, gen5: G5.digests }, null, 1));

  /* the request and the option match: solver/doduo/eval_gates.js (synthRequest, findOpt), unchanged */
  function synthRequest(G, st, me) {
    const sheet = G.sheets[me], side = st.sides[me], brought = G.brought_seen[me], act = side.active || [];
    const order = [];
    for (let k = 0; k < act.length; k++) {
      if (act[k] != null) { order.push(act[k]); continue; }
      const fnt = brought.filter(i => !act.includes(i) && !order.includes(i) && side.mons[i] && side.mons[i].fnt);
      const f = fnt.find(i => side.mons[i].pos === (k === 0 ? 'a' : 'b'));
      const h = f != null ? f : fnt[0];
      if (h == null) throw new Error('empty active slot with no fainted body to hold it');
      order.push(h);
    }
    for (const i of brought) if (!order.includes(i)) order.push(i);
    return { side: { pokemon: order.map(i => {
      const row = sheet[i], pub = side.mons[i] || {};
      const b = T.buildBody(M, row);
      if (!b) throw new Error('unbuildable ' + row.species);
      const max = b.st.hp;
      const cond = pub.seen ? (pub.fnt ? '0 fnt' : `${Math.max(1, Math.round((pub.hp / (pub.max || 100)) * max))}/${max}${pub.status ? ' ' + pub.status : ''}`) : `${max}/${max}`;
      const sp = pub.seen && pub.species ? pub.species : row.species;
      return { ident: me + 'a: ' + row.nick, details: sp + ', L50', condition: cond, item: pub.seen ? (pub.item || '') : row.item, ability: pub.seen ? pub.ability : row.ability };
    }) } };
  }
  function findOpt(la, k, x, S, side) {
    const sl = la.slots[k];
    if (!sl) return null;
    const team = (side === 'A' ? S.sfA : S.sfB).team;
    if (x.kind === 'switch') return sl.options.find(o => o.kind === 'switch' && team[o.to] && team[o.to]._solverSheet === x.to) || null;
    const id = toID(x.move), tl = x.target_loc == null ? null : x.target_loc;
    return sl.options.find(o => o.kind === 'move' && o.move === id && !!o.mega === !!x.mega && (o.target == null ? null : o.target) === tl) || null;
  }
  function decide(g, pk, i) {
    const G = g.game, t = g.turns[pk.ti], me = pk.p, opp = me === 'p1' ? 'p2' : 'p1';
    const row = { game: G, turns: g.turns.slice(0, pk.ti + 1) };
    const req = synthRequest(G, t.state, me);
    const w = WB.build({ row, sheets: G.sheets, me, req, oppGuess: G.brought_seen[opp] });
    const la = API.legalActions(w.S, w.side);
    const A = t.actions[me];
    const human = [0, 1].map(k => { const x = A[k === 0 ? 'a' : 'b']; return x ? findOpt(la, k, x, w.S, w.side) : null; });
    const occ = [0, 1].filter(k => A[k === 0 ? 'a' : 'b']);
    if (occ.some(k => !human[k])) return { unmatched: occ.filter(k => !human[k]).map(k => A[k === 0 ? 'a' : 'b']) };
    const hj = la.joint.findIndex(j => j.every((o, k) => !human[k] || key(o) === key(human[k])));
    if (hj < 0) return { unmatched: 'joint' };
    /* DODUO over every legal joint (the no-search reference) */
    const sAll = G5.PA.scoreJoints(w.ctx, w.S, w.side, w.side, la);
    let tot = 0, top = 0; for (let n = 0; n < sAll.length; n++) { tot += sAll[n]; if (sAll[n] > sAll[top]) top = n; }
    const rank = 1 + Array.from(sAll).filter(v => v > sAll[hj]).length;
    const ts = Date.now();
    const MT = SEARCH.create(API, { prior: G5.PA, rollout: AGm.R });
    const r = MT.decide(w.S, w.side, w.ctx, { budgetMs: 3600000, maxPasses: PASSES, k1: spec.k1, k2: spec.k2, depth: spec.depth, reserveSwitch: spec.reserveSwitch,
      leaf: 'pory2', leafModel, coin: M.rngStreams({ seed: 7000 + i }).any, record: true });
    const base = { side: w.side, turn: t.n, legal: la.joint.length, human: jkey(la.joint[hj]), doduo_p: tot > 0 ? sAll[hj] / tot : null, doduo_rank: rank, doduo_top1: top === hj,
      ms: Date.now() - ts };
    if (r.info.forced) return Object.assign(base, { forced: true });
    if (!r.info.rec) return Object.assign(base, { fallback: r.info.fallback || 'no record' });
    const rc = r.info.rec;
    return Object.assign(base, { rows: rc.rows.map(jkey), cols: rc.cols.map(jkey), A: rc.A.map(x => x.map(v => +v.toFixed(6))), cnt: rc.cnt, tauRow: rc.tauRow, tauCol: rc.tauCol,
      x: rc.x, hrow: rc.rows.findIndex(j => jkey(j) === jkey(la.joint[hj])), passes: r.info.passes, playouts: r.info.playouts, unfilled: r.info.unfilled });
  }
}

/* ---------- analysis: the lambda sweep on the recorded tables ---------- */
function analyse(dir, gridArg) {
  const SK = require('../slowking/matrix.js');
  const SEARCH = require('./search.js');
  const FAM = (() => { require('../arena/env.js'); return require('../arena/protect_stats.js').family(); })();
  const grid = String(gridArg || '0,0.001,0.003,0.01,0.03,0.1,0.3,inf').split(',').map(s => (s === 'inf' ? Infinity : +s));
  const recs = [];
  for (const f of fs.readdirSync(dir)) if (/^decisions-\d+\.jsonl$/.test(f)) for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) if (l) recs.push(JSON.parse(l));
  recs.sort((a, b) => a.i - b.i);
  const ok = recs.filter(r => r.rows && r.A);
  const FLOOR = 1e-4;
  const isP = s => s.split(' | ').some(c => FAM.has(c.split(/[@+]/)[0]));
  const isD = s => s.split(' | ').filter(c => FAM.has(c.split(/[@+]/)[0])).length >= 2;
  const humanP = ok.map(r => isP(r.human)), humanD = ok.map(r => isD(r.human));
  const per = {};   // lambda -> arrays per decision
  for (const lam of grid) {
    const top1 = [], ph = [], ll = [], prot = [], dbl = [], chg = [], worst = [];
    for (const r of ok) {
      const m = r.rows.length, n = r.cols.length;
      const tr = SEARCH.anchorOf(r.tauRow) || new Array(m).fill(1 / m), tc = SEARCH.anchorOf(r.tauCol) || new Array(n).fill(1 / n);
      const plain = SK.solveRM(r.A, { iters: 4000, tol: 1e-4 });
      let x;
      if (lam === 0) x = plain.x;
      else if (lam === Infinity) x = tr;
      else x = SK.solveKL(r.A, { tauRow: tr, tauCol: tc, lambda: lam, iters: 4000, tol: 1e-5 }).x;
      let am = 0; for (let k = 1; k < m; k++) if (x[k] > x[am]) am = k;
      top1.push(r.hrow >= 0 && am === r.hrow ? 1 : 0);
      const p = r.hrow >= 0 ? x[r.hrow] : 0;
      ph.push(p);
      ll.push(Math.log(Math.max(FLOOR, p)));
      prot.push(r.rows.reduce((s, j, k) => s + (isP(j) ? x[k] : 0), 0));
      dbl.push(r.rows.reduce((s, j, k) => s + (isD(j) ? x[k] : 0), 0));
      chg.push(x.reduce((s, v, k) => s + Math.abs(v - plain.x[k]), 0) / 2);
      let minCol = Infinity; for (let j = 0; j < n; j++) { let s = 0; for (let k = 0; k < m; k++) s += x[k] * r.A[k][j]; if (s < minCol) minCol = s; }
      worst.push(Math.max(0, plain.value - minCol));
    }
    per[lam] = { top1, ph, ll, prot, dbl, chg, worst };
  }
  const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  /* paired bootstrap over decisions: the difference to lambda = 0, 2,000 resamples, seeded */
  let bs = 12345; const brnd = () => { bs = (bs * 16807) % 2147483647; return bs / 2147483647; };
  const B = 2000, nn = ok.length, idx = Array.from({ length: B }, () => Array.from({ length: nn }, () => Math.floor(brnd() * nn)));
  const ciDiff = (a, b) => { const d = idx.map(ix => { let s = 0; for (const k of ix) s += a[k] - b[k]; return s / nn; }).sort((x, y) => x - y); return [d[Math.floor(0.025 * B)], d[Math.floor(0.975 * B)]]; };
  const covered = ok.filter(r => r.hrow >= 0).length;
  const table = grid.map(lam => {
    const q = per[lam], z = per[0];
    return { lambda: lam === Infinity ? 'inf (the anchor)' : lam, top1: mean(q.top1), p_human: mean(q.ph), loglik_floor1e4: mean(q.ll),
      d_top1_vs_0: lam === 0 ? null : [mean(q.top1) - mean(z.top1), ...ciDiff(q.top1, z.top1)],
      d_loglik_vs_0: lam === 0 ? null : [mean(q.ll) - mean(z.ll), ...ciDiff(q.ll, z.ll)],
      protect_mass: mean(q.prot), double_protect_mass: mean(q.dbl), tv_to_plain: mean(q.chg), worst_case_loss_mean: mean(q.worst), worst_case_loss_max: Math.max(...q.worst) };
  });
  const res = {
    what: 'gen5 search, human-regularised solve (piKL) at each lambda, on the SAME recorded tables of held-out human Reg M-C decisions (solver/miltank/eval_kl_human.js)',
    dir: path.relative(ROOT, dir).split(path.sep).join('/'), decisions: recs.length, evaluated: ok.length,
    forced: recs.filter(r => r.forced).length, fallback: recs.filter(r => r.fallback).length, unmatched: recs.filter(r => r.unmatched).length, errors: recs.filter(r => r.error).length,
    coverage: { human_joint_among_rows: covered, of: ok.length, rate: covered / ok.length },
    doduo_all_legal: { top1: mean(ok.map(r => (r.doduo_top1 ? 1 : 0))), mean_log_p: mean(ok.map(r => Math.log(Math.max(FLOOR, r.doduo_p || 0)))), mean_p: mean(ok.map(r => r.doduo_p || 0)) },
    human_protect_rate: mean(humanP.map(Number)), human_double_protect_rate: mean(humanD.map(Number)),
    offered_double: ok.filter(r => r.rows.some(isD)).length,
    human_double_when_offered_rows: ok.filter(r => r.rows.some(isD) && isD(r.human)).length,
    floor: FLOOR, grid: grid.map(v => (v === Infinity ? 'inf' : v)), table,
    playouts_mean: mean(ok.map(r => r.playouts)), unfilled: ok.reduce((s, r) => s + (r.unfilled || 0), 0),
    captions: {
      top1: 'the argmax of the played mix is the human joint (0 when the human joint is not among the rows)',
      p_human: 'the played mix\'s probability on the human joint: the chance a SAMPLED move agrees (the search samples, never argmaxes)',
      loglik_floor1e4: 'mean log of that probability, floored at 1e-4 (a pure plain solve and an uncovered human joint both give log 1e-4)',
      worst_case_loss: 'the plain table\'s value v* minus the worst column\'s payoff against the regularised mix: what the regularisation can cost against a best-responding opponent, on the search\'s own table',
    },
  };
  for (const f of fs.readdirSync(dir)) if (/^decisions-\d+\.summary\.json$/.test(f)) { const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); res.release = s.release && (s.release.engine_release || s.release); res.gen5 = s.gen5; }
  try { res.selection = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8')); } catch (e) {}
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ evaluated: res.evaluated, coverage: res.coverage, doduo: res.doduo_all_legal }, null, 0));
  for (const r of table) console.log(`  lambda ${String(r.lambda).padEnd(16)} top1 ${r.top1.toFixed(3)}  p(human) ${r.p_human.toFixed(3)}  ll ${r.loglik_floor1e4.toFixed(3)}  prot ${r.protect_mass.toFixed(3)}  dbl ${r.double_protect_mass.toFixed(3)}  tv ${r.tv_to_plain.toFixed(3)}  worst ${r.worst_case_loss_mean.toFixed(4)}` +
    (r.d_top1_vs_0 ? `  dTop1 ${r.d_top1_vs_0.map(v => v.toFixed(3)).join(' ')}  dLL ${r.d_loglik_vs_0.map(v => v.toFixed(3)).join(' ')}` : ''));
  return res;
}

/* ---------- coordinator ---------- */
async function coordinator() {
  if (!REL_ID) throw new Error('--release is required');
  const t0 = Date.now();
  /* --reuse: the selection already in OUT (selection.jsonl, games.jsonl, run.json) is played again, not re-drawn */
  let sel;
  if (argv.includes('--reuse') && fs.existsSync(path.join(OUT, 'run.json'))) { const rj = JSON.parse(fs.readFileSync(path.join(OUT, 'run.json'), 'utf8')); sel = { sha: rj.dataset_sha256, counts: rj.counts, reused: true }; }
  else sel = await select();
  console.log('selection', JSON.stringify(sel));
  fs.writeFileSync(path.join(OUT, 'run.json'), JSON.stringify({ release: REL_ID, flags: { n: N, seed: SEED, workers: WORKERS, passes: PASSES, human: HUMAN, eligible_estimate: ELIG_EST }, dataset_sha256: sel.sha, counts: sel.counts, argv }, null, 1));
  const kids = [];
  for (let i = 0; i < WORKERS; i++) {
    const ch = cp.fork(__filename, ['--release', REL_ID, '--out', OUT, '--passes', String(PASSES), '--shard', String(i), '--shards', String(WORKERS)], { execArgv: ['--max-old-space-size=2048'] });
    console.log('eval_kl_human: shard ' + i + ' pid ' + ch.pid);
    kids.push(new Promise(res => ch.on('exit', c => res(c))));
  }
  const exits = await Promise.all(kids);
  console.log('worker exits', exits, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  analyse(OUT, flag('--grid', null));
}

if (ANALYSE) analyse(path.resolve(ROOT, ANALYSE), flag('--grid', null));
else if (SHARD != null) worker(+SHARD, SHARDS);
else coordinator().catch(e => { console.error(e); process.exit(1); });
