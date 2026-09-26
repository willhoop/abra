/* solver/tests/test-miltank-quiesce.js — THE REPEAT-PROTECT FIX in MILTANK: one horizon past a held Protect, a flat table
 * played by the prior, and a mega row that does not drag a repeat Protect in. (2026-09-27,
 * docs/_reports/2026-09-27-protect-repeat-fix.md)
 *
 *   node solver/tests/test-miltank-quiesce.js [--no-red] [--release eaa5becc54eb] [--positions 5] [--passes 16]
 *        exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND
 *
 * Fixtures: positions from TEST team pairs of data/team-pool-frozen-regmc walked by the human clone (DODUO-greedy) on
 * a frozen release, where a side-A body carries the consecutive-Protect counter (`tookProtectTurns` >= 1) and gen5's
 * search (solver/machamp/league/gen5.json: k 4x4, depth 0, PORYGON2 gen5 leaf) is offered a row that repeats it —
 * the positions solver/tests/probe_protect_cells.js diagnosed. Clauses:
 *   OFF     with q absent nothing is extended and the counters do not move; in mode 'held' a playout in which no protect
 *           held returns the SAME value as with q absent (the extension touches only what it is for).
 *   EXTEND  mode 'held': every playout whose protect held and whose game went on was extended; mode 'all' (shipped):
 *           every playout whose game went on was extended. And at least one was: the capability proves it ran.
 *   JOINT   the extension joint offers every slot a move its menu offers (rollout.slotSupport), and never a
 *           protect-family move or a switch when the slot has another move.
 *   EFFECT  THE DEFECT, BEFORE AND AFTER, on the fixtures, at a fixed pass count, with the shipped options (quiesce 'all',
 *           flatEps 0.001, reserveNoRepeat): the mass PLAYED on repeat rows (the row mix, or the prior's joint when the
 *           table is flat) is >= 0.30 with the options off (the fixture shows the defect) and at most HALF of that with
 *           them on. Bars set 2026-09-27 before this clause first ran.
 *   FLAT    flatEps = 1 makes every table flat: the move is the ranking prior's top legal joint and flatPrior counts it;
 *           flatEps = -1 never fires.
 *   MEGA    rank() with reserveNoRepeat, on constructed joints: the reserved mega row is the best mega joint that the
 *           predicate does not flag; with none unflagged it falls back to the best mega joint; without the option it is the
 *           plain best mega joint.
 *   POOL    the worker pool, at a pass cap, returns the serial fill's matrix bit for bit with quiescence on, and its
 *           workers extended at least one playout (the job carries the setting across the process boundary).
 *   AGENT   a league spec with "quiesce" reaches the search (quiesceDecisions > 0); without it, 0.
 *
 * RED, unless --no-red: re-runs itself under MILTANK_BREAK=quiesce (EXTEND and EFFECT must fail), MILTANK_BREAK=flat
 * (FLAT) and MILTANK_BREAK=megabundle (MEGA).
 */
'use strict';
require('../arena/env.js');
const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const NO_RED = argv.includes('--no-red');
const REL = flag('--release', 'eaa5becc54eb');
const NPOS = +flag('--positions', 5);
const PASSES = +flag('--passes', 16);
const ROOT = path.join(__dirname, '..', '..');
const SHIPPED = { quiesce: 'all', flatEps: 0.001, reserveNoRepeat: true };

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); if (fails <= 25) console.log('  FAIL [' + clause + '] ' + msg); } };
const cannot = why => { console.log('CANNOT ANSWER: ' + why); process.exit(2); };

let ENGINE;
try { ENGINE = require('../arena/engine.js').load(REL); } catch (e) { cannot('release ' + REL + ' does not open: ' + e.message); }
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const FAM = require('../arena/protect_stats.js').family();
const SEARCH = require('../miltank/search.js');
const AGm = require('../mew/agent.js').create(API, { buildBody: T.buildBody });
const R = AGm.R;
const G5spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/gen5.json'), 'utf8'));
const G5 = AGm.load(G5spec);
const CL = AGm.load(JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/human-clone.json'), 'utf8')));
const PA0 = require('../miltank/prior_adapter.js').create(API, null);
let P;
try { P = require('../mew/pairs.js').load({ teamStore: 'data/team-pool-frozen-regmc' }); } catch (e) { cannot('team store: ' + e.message); }
const live = m => !!(m && !m.fainted && m.curHP > 0);
const leafModel = path.join(ROOT, G5spec.pory2);
const baseOpts = (coin, extra) => Object.assign({ budgetMs: 600000, maxPasses: PASSES, k1: 4, k2: 4, depth: 0, reserveSwitch: 1, leaf: 'pory2', leafModel, coin, record: true }, extra || {});
const snap = () => Object.assign({}, R.COUNTERS);

/* ---------- MEGA: constructed joints, no engine ---------- */
{
  const MT = SEARCH.create(API, { prior: G5.PA, rollout: R });
  const mv = (id, mega) => ({ kind: 'move', move: id, target: 1, mega: !!mega });
  /* index: 0 best overall (no mega), 1 best mega (flagged), 2 second mega (clean), 3.. filler */
  const joints = [[mv('a'), mv('b')], [mv('p'), mv('c', true)], [mv('d'), mv('c', true)], [mv('e'), mv('f')], [mv('g'), mv('h')]];
  const scores = [0.5, 0.3, 0.1, 0.06, 0.04];
  const flagP = j => j[0].move === 'p';
  const pickMega = keep => keep.find(i => joints[i].some(x => x.mega));
  ok('MEGA', pickMega(MT.rank(scores, joints, 2, 0, true, flagP)) === 2, 'reserveNoRepeat did not skip the flagged mega joint');
  ok('MEGA', pickMega(MT.rank(scores, joints, 2, 0, true, null)) === 1, 'without the option the reserved mega is not the plain best');
  ok('MEGA', pickMega(MT.rank(scores, joints, 2, 0, true, () => true)) === 1, 'with every mega joint flagged it did not fall back to the best');
  ok('MEGA', MT.COUNTERS.megaUnbundled === 1, 'megaUnbundled ' + MT.COUNTERS.megaUnbundled + ', expected 1');
}

/* ---------- fixtures: the probe's positions, kept only when the repeat is offered ---------- */
const fx = [];
for (let g = 0; fx.length < NPOS && g < P.test.length * 3; g++) {
  const G = P.test[(g * 13 + 7) % P.test.length];
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  if (!a || !b) continue;
  const rng = API.makeRng(7000 + g);
  const S = API.newBattle(a.team, b.team, { rng });
  const ctx = PA0.newGame(G);
  const bA = CL.bot(1), bB = CL.bot(2);
  for (let t = 0; t < 14 && !API.isTerminal(S) && fx.length < NPOS; t++) {
    const k = S.actA.findIndex(m => live(m) && m.tookProtectTurns >= 1);
    if (k >= 0 && API.legalActions(S, 'A').slots[k].options.some(o => o.kind === 'move' && FAM.has(o.move))) {
      const MT = SEARCH.create(API, { prior: G5.PA, rollout: R });
      const r = MT.decide(S, 'A', ctx, baseOpts(M.rngStreams({ seed: 1 }).any, { maxPasses: 1 }));
      const isRep = j => j[k] && j[k].kind === 'move' && FAM.has(j[k].move);
      if (r.info && r.info.rec && r.info.rec.rows.some(isRep)) fx.push({ S: API.clone(S), ctx: { G: ctx.G, hist: ctx.hist.slice() }, k, isRep });
    }
    const jA = bA.choose(S, 'A', ctx).joint, jB = bB.choose(S, 'B', ctx).joint;
    PA0.record(ctx, S, jA, jB);
    API.stepInPlace(S, jA, jB, rng);
  }
}
if (fx.length < Math.min(3, NPOS)) cannot('only ' + fx.length + ' fixture positions offered a repeat row');
console.log('  fixtures: ' + fx.length + ' positions (a side-A body carrying the counter, a repeat row offered), ' + PASSES + ' passes');

/* ---------- OFF, EXTEND, JOINT: playouts on the fixtures' own rows and columns ---------- */
const stepOver = (W, jA, jB, seed) => { const Sx = R.copy(W); API.makeLean(Sx); return API.leanRun(() => { API.stepInPlace(Sx, jA, jB, R.dice(seed)); return API.isTerminal(Sx); }); };
let heldSeen = 0, extHeld = 0, extAll = 0, quietN = 0, jointN = 0;
for (let fi = 0; fi < fx.length; fi++) {
  const f = fx[fi];
  const MT = SEARCH.create(API, { prior: G5.PA, rollout: R });
  const r = MT.decide(f.S, 'A', f.ctx, baseOpts(M.rngStreams({ seed: 2 + fi }).any, { maxPasses: 1 }));
  const rows = r.info.rec.rows, cols = r.info.rec.cols;
  const qHeld = { fb: { A: [null, null], B: [null, null] }, mode: 'held' }, qAll = { fb: { A: [null, null], B: [null, null] }, mode: 'all' };
  const W = R.prepare(R.sampleWorld(f.S, 'B', { sheet: f.ctx.G.sheets.p2, revealed: G5.PA.revealed(f.S, 'B') }, M.rngStreams({ seed: 9 + fi }).any));
  for (let s = 0; s < 4; s++) for (const jA of rows) for (const jB of cols) {
    const seed = 424242 + fi * 1000 + s;
    const c0 = snap();
    const vOff = R.playout(W, jA, jB, seed, 0, null);
    ok('OFF', R.COUNTERS.quietHeld === c0.quietHeld && R.COUNTERS.quiesced === c0.quiesced, 'a playout without q touched the quiescence counters');
    const over = stepOver(W, jA, jB, seed);
    const c1 = snap();
    const vHeld = R.playout(W, jA, jB, seed, 0, null, undefined, qHeld);
    const held = R.COUNTERS.quietHeld - c1.quietHeld, eh = R.COUNTERS.quiesced - c1.quiesced;
    if (!held) { quietN++; ok('OFF', vHeld === vOff, "mode 'held': no protect held, yet the value moved: " + vOff + ' -> ' + vHeld); }
    else { heldSeen += held; extHeld += eh; ok('EXTEND', eh === (over ? 0 : 1), "mode 'held': a protect held (game over " + over + ') but extended ' + eh); }
    const c2 = snap();
    R.playout(W, jA, jB, seed, 0, null, undefined, qAll);
    const ea = R.COUNTERS.quiesced - c2.quiesced;
    extAll += ea;
    ok('EXTEND', ea === (over ? 0 : 1), "mode 'all': game over " + over + ' but extended ' + ea);
  }
  /* JOINT: the extension joint on positions one turn on, for both sides */
  for (let s = 0; s < 8; s++) {
    const Sx = R.copy(W); API.makeLean(Sx);
    API.leanRun(() => {
      const jA = rows[s % rows.length], jB = cols[s % cols.length];
      const preA = Sx.actA.slice(), preB = Sx.actB.slice();
      API.stepInPlace(Sx, jA, jB, R.dice(777 + s));
      if (API.isTerminal(Sx)) return;
      const coin = M.rngStreams({ seed: 55 + s }).any;
      for (const [side, jp, pre] of [['A', jA, preA], ['B', jB, preB]]) {
        const j = R.quietJoint(Sx, side, jp, pre, null, coin);
        for (let k = 0; k < j.length; k++) {
          const sup = R.slotSupport(Sx, side, k), o = j[k];
          jointN++;
          ok('JOINT', sup.some(x => JSON.stringify(x) === JSON.stringify(o)), 'slot ' + k + ' option ' + JSON.stringify(o) + ' not in its menu');
          const other = sup.some(x => x.kind === 'move' && !x.mega && !FAM.has(x.move));
          if (other) ok('JOINT', o.kind === 'move' && !FAM.has(o.move), 'slot ' + k + ' chose ' + JSON.stringify(o) + ' with a non-protect move on offer');
        }
      }
    });
  }
}
ok('EXTEND', heldSeen > 0 && extHeld > 0 && extAll > 0, 'nothing extended on the fixtures (held ' + heldSeen + ', extended held ' + extHeld + ', all ' + extAll + ')');
ok('OFF', quietN > 0, 'no quiet playout to compare');
console.log('  OFF/EXTEND/JOINT: ' + quietN + ' quiet playouts, ' + heldSeen + ' held, extended ' + extHeld + " ('held') and " + extAll + " ('all'), " + jointN + ' extension slots');

/* ---------- EFFECT: the defect before and after, at a fixed pass count; FLAT; AGENT ---------- */
let mOff = 0, mOn = 0;
for (let fi = 0; fi < fx.length; fi++) {
  const f = fx[fi];
  const played = on => {
    const MT = SEARCH.create(API, { prior: G5.PA, rollout: R });
    const r = MT.decide(f.S, 'A', f.ctx, baseOpts(M.rngStreams({ seed: 99 + fi }).any, on ? SHIPPED : {}));
    ok('AGENT', (MT.COUNTERS.quiesceDecisions > 0) === on, 'quiesceDecisions ' + MT.COUNTERS.quiesceDecisions + ' with the options ' + on);
    if (r.info.flat) return f.isRep(r.joint) ? 1 : 0;
    return r.info.rec.rows.reduce((a, j, i) => a + (f.isRep(j) ? r.info.rec.x[i] : 0), 0);
  };
  mOff += played(false); mOn += played(true);
}
mOff /= fx.length; mOn /= fx.length;
console.log('  EFFECT: mean mass played on repeat rows ' + mOff.toFixed(3) + ' off -> ' + mOn.toFixed(3) + ' on');
ok('EFFECT', mOff >= 0.30, 'the fixture does not show the defect: mass ' + mOff.toFixed(3) + ' < 0.30 with the options off');
ok('EFFECT', mOn <= 0.5 * mOff, 'the fix did not halve the repeat mass: ' + mOff.toFixed(3) + ' -> ' + mOn.toFixed(3));
{
  const f = fx[0];
  const la = API.legalActions(f.S, 'A');
  const s = G5.PA.scoreJoints(f.ctx, f.S, 'A', 'A', la);
  let top = 0; for (let i = 1; i < s.length; i++) if (s[i] > s[top]) top = i;
  const MT = SEARCH.create(API, { prior: G5.PA, rollout: R });
  const a = MT.decide(f.S, 'A', f.ctx, baseOpts(M.rngStreams({ seed: 5 }).any, { maxPasses: 2, flatEps: 1 }));
  ok('FLAT', a.info.flat === true && JSON.stringify(a.joint) === JSON.stringify(la.joint[top]) && MT.COUNTERS.flatPrior === 1, 'flatEps 1: flat ' + a.info.flat + ', counter ' + MT.COUNTERS.flatPrior + ', joint is the prior top ' + (JSON.stringify(a.joint) === JSON.stringify(la.joint[top])));
  const b = MT.decide(f.S, 'A', f.ctx, baseOpts(M.rngStreams({ seed: 5 }).any, { maxPasses: 2, flatEps: -1 }));
  ok('FLAT', !b.info.flat && MT.COUNTERS.flatPrior === 1, 'flatEps -1 fired');
}
{
  const f = fx[0];
  const on = AGm.load(Object.assign({}, G5spec, { name: 'gen5-quiesce-test' }, SHIPPED));
  const q0 = on.MT.COUNTERS.quiesceDecisions, o0 = G5.MT.COUNTERS.quiesceDecisions;
  on.bot(3, { budgetMs: 600000, maxPasses: 1 }).choose(API.clone(f.S), 'A', { G: f.ctx.G, hist: f.ctx.hist.slice() });
  G5.bot(3, { budgetMs: 600000, maxPasses: 1 }).choose(API.clone(f.S), 'A', { G: f.ctx.G, hist: f.ctx.hist.slice() });
  ok('AGENT', on.MT.COUNTERS.quiesceDecisions > q0, 'the spec options did not reach the search');
  ok('AGENT', G5.MT.COUNTERS.quiesceDecisions === o0, 'gen5 without the flag ran quiescence');
}

/* ---------- POOL: across the process boundary ---------- */
(async () => {
  const pool = await require('../miltank/pool.js').create({ workers: 2 });
  try {
    let n = 0;
    for (let fi = 0; fi < Math.min(2, fx.length); fi++) {
      const f = fx[fi];
      const MT = SEARCH.create(API, { prior: G5.PA, rollout: R });
      const a = MT.decide(f.S, 'A', f.ctx, baseOpts(M.rngStreams({ seed: 300 + fi }).any, Object.assign({}, SHIPPED, { maxPasses: 4 })));
      const b = await MT.decideAsync(f.S, 'A', f.ctx, baseOpts(M.rngStreams({ seed: 300 + fi }).any, Object.assign({}, SHIPPED, { maxPasses: 4, pool })));
      ok('POOL', JSON.stringify(a.info.rec.A) === JSON.stringify(b.info.rec.A), 'pooled matrix differs from serial with quiescence on at fixture ' + fi);
      n++;
    }
    ok('POOL', n > 0 && (pool.counters.quiesced || 0) > 0, 'the workers extended no playout (quiesced ' + pool.counters.quiesced + ')');
    console.log('  POOL: ' + n + ' decisions, worker extensions ' + (pool.counters.quiesced || 0));
  } finally { pool.close(); }

  const brk = R.BROKEN || SEARCH.create(API, { prior: G5.PA, rollout: R }).BROKEN;
  console.log('test-miltank-quiesce: ' + (checks - fails) + '/' + checks + ' checks' + (brk ? '  [BREAK ' + brk + ']' : '') + '  failed clauses: ' + ([...failed].join(',') || 'none'));
  if (!NO_RED && !brk) {
    const need = [['quiesce', ['EXTEND', 'EFFECT']], ['flat', ['FLAT']], ['megabundle', ['MEGA']]];
    let blind = 0;
    for (const [v, clauses] of need) {
      const res = cp.spawnSync(process.execPath, [__filename, '--no-red', '--release', REL, '--positions', String(NPOS), '--passes', String(PASSES)],
        { env: Object.assign({}, process.env, { MILTANK_BREAK: v }), encoding: 'utf8', maxBuffer: 1 << 26 });
      const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-miltank-quiesce:') && l.includes('failed clauses')) || '';
      for (const clause of clauses) {
        const seen = new RegExp('failed clauses: .*\\b' + clause + '\\b').test(line) && res.status === 1;
        console.log('  RED MILTANK_BREAK=' + v + ' -> ' + clause + ': ' + (seen ? 'fails as required' : 'STAYED GREEN (blind)  ' + line));
        if (!seen) blind++;
      }
    }
    if (blind) { console.log('BLIND: ' + blind + ' clause(s) did not see their break'); process.exit(3); }
  }
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('CANNOT ANSWER: ' + (e && e.stack || e)); process.exit(2); });
