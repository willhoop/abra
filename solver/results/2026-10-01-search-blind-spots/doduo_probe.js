#!/usr/bin/env node
/**
 * DODUO on real ladder opponents (2026-10-01, docs/_reports/2026-10-01-search-blind-spots.md).
 *
 * For every move decision of the search arm with a recorded table, ROTOM's world is REBUILT from the saved log at that
 * turn (solver/tests/ladder_replay.js: the request rebuilt from the log, so no stat line), and the gen5 ranking prior —
 * the one that chose the live columns (solver/machamp/league/gen5.json: MAG + DODUO) — scores every legal opponent joint
 * from our view, exactly as solver/miltank/search.js prepareDecision does. No game is played and no playout is run.
 *
 *   - CALIBRATION: per opponent slot whose action the log shows, the prior's mass on that slot attacking / protecting /
 *     a status move / switching, against what it did. Binned, and at the Sucker Punch decisions alone.
 *   - RECALL@k: the rank of the actual joint (moves, targets and the switch's sheet row) among all legal joints, so the
 *     coverage of k = 4 (what the ladder ran) and of a wider k is read off one pass.
 *   - FIDELITY: the rebuilt top 4 (+1 reserved switch, as search.js ranks) against the recorded columns, so the reader
 *     knows how far a rebuilt world is from the live one.
 *
 *   node solver/results/2026-10-01-search-blind-spots/doduo_probe.js [--root <solver/out/rotom>] [--release eaa5becc54eb]
 *        [--limit N] [--out <file>]
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs'), path = require('path');
require('../../arena/env.js');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = arg('--root', path.join(__dirname, '..', '..', 'out', 'rotom'));
const REL = arg('--release', 'eaa5becc54eb');
const OUT = arg('--out', path.join(__dirname, 'doduo.json'));
const LIMIT = +arg('--limit', 0);
const ME = 'medicham32';

const ENGINE = require('../../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../../arena/teams.js');
const X = require('../../human/dex.js');
const FAM = require('../../arena/protect_stats.js').family();
const W = require('../../rotom/world.js');
const LR = require('../../tests/ladder_replay.js');
const SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'machamp', 'league', 'gen5.json'), 'utf8'));
const AG = require('../../mew/agent.js').create(API, { buildBody: T.buildBody });
const A = AG.load(SPEC);
const PA = A.PA;
const WB = W.create(API);
const toID = X.toID;
const hpOf = row => { const b = T.buildBody(M, row); return b ? b.st.hp : 100; };
const SINGLE = new Set(['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf']);
const mv = id => { const m = X.D.moves.get(toID(id)); return m && m.exists ? m : null; };
const cls = o => !o ? 'none' : o.kind === 'switch' ? 'switch' : o.kind !== 'move' ? 'none' : FAM.has(o.move) ? 'protect' : (mv(o.move) && mv(o.move).category === 'Status') ? 'status' : 'attack';
const engLabel = j => (j || []).map(o => !o ? '-' : o.kind === 'switch' ? 'switch ' + o.to : o.kind === 'pass' ? 'pass'
  : String(o.move || o.kind) + (o.target != null ? ' ' + o.target : '') + (o.mega ? ' mega' : '')).join(', ');

/* the log's actual opponent action per slot, as blind_spots.js reads it */
function actions(L, turn, side, sheets) {
  const out = {}; let inT = false, post = false, sawMove = false;
  for (const l of L) {
    const p = l.split('|');
    if (p[1] === 'turn') { if (inT) break; inT = +p[2] === turn; continue; }
    if (!inT) continue;
    if (p[1] === 'upkeep') post = true;
    const id = /^(p[12])([ab]):\s?(.*)$/.exec(p[2] || '');
    if (!id || id[1] !== side || post) { if (p[1] === 'move') sawMove = true; continue; }
    if (p[1] === 'switch' && !sawMove && !(id[2] in out)) {
      const sp = String(p[3] || '').split(',')[0];
      const base = s => { const x = X.D.species.get(toID(s)); return x && x.exists ? x.baseSpecies : s; };
      const r = sheets[side].findIndex(r => r.nick === id[3]) >= 0 ? sheets[side].findIndex(r => r.nick === id[3]) : sheets[side].findIndex(r => base(r.species) === base(sp));
      out[id[2]] = { kind: 'switch', row: r };
    }
    if (p[1] === 'move') {
      sawMove = true;
      const from = p.find(x => x.startsWith('[from]'));
      if (from && !/lockedmove/.test(from)) continue;
      if (id[2] in out) continue;
      const m = mv(p[3]); const tg = /^(p[12])([ab]):/.exec(p[4] || '');
      let target = null;
      if (tg && m && SINGLE.has(m.target)) target = tg[1] === side ? -(tg[2] === 'a' ? 1 : 2) : (tg[2] === 'a' ? 1 : 2);
      out[id[2]] = { kind: 'move', move: m ? m.id : toID(p[3]), target };
    }
    if (p[1] === 'cant' && !(id[2] in out)) out[id[2]] = { kind: 'cant' };
  }
  return out;
}

/* our Sucker Punch decisions, joined from blind_spots.js's rows (run it first) */
let SPR = [];
try { SPR = JSON.parse(fs.readFileSync(path.join(__dirname, 'measured.json'), 'utf8')).sucker_punch.rows; } catch (e) { /* none */ }
const spKey = new Map(SPR.map(r => [r.room + '|' + r.turn + '|' + r.target_slot, r]));
/* THE SAMPLE IS FIXED, NOT 'whatever is on disk': the finished ladder runs as of 2026-10-01 04:39Z. A run that is still
 * being written (chomptop-2026-10-01T04-18-07-546Z was live then) is never read — a torn read is a plausible wrong answer. */
const RUNS_FIXED = ['aa1-2026-09-25T21-00-29-440Z', 'aa2-2026-09-25T23-54-09-059Z', 'chomp1-2026-09-29T23-13-11-521Z', 'gen5ab-2026-09-26T04-06-53-848Z',
  'run-2026-09-25T02-57-27-132Z', 'run-2026-09-25T03-17-19-472Z', 'run-2026-09-25T20-59-15-353Z', 'run-2026-09-25T23-20-18-156Z', 'run-2026-09-26T04-03-20-316Z'];
const runs = RUNS_FIXED.filter(r => fs.existsSync(path.join(ROOT, r, 'games', ME)));
const SL = [];            // per observed opponent slot
const DEC = [];           // per decision
let built = 0, failed = 0, fidN = 0, fidSame = 0, fidColsHit = 0, fidColsN = 0;
const errs = {};
outer: for (const run of runs) {
  const dir = path.join(ROOT, run, 'games', ME);
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.decisions.jsonl'))) {
    const room = f.replace('.decisions.jsonl', '');
    const logf = path.join(dir, room + '.log'); if (!fs.existsSync(logf)) continue;
    const ds = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    const pv = ds.find(d => d.kind === 'preview');
    const bring = pv && /^team \d{4}/.test(pv.choice) ? pv.choice.slice(5, 9).split('').map(c => +c - 1) : null;
    const txt = fs.readFileSync(logf, 'utf8').replace(/\r/g, ''), L = txt.split('\n');
    let me = null; for (const l of L) { const p = l.split('|'); if (p[1] === 'player' && p[3] === ME) me = p[2]; }
    if (!me) continue;
    const op = me === 'p1' ? 'p2' : 'p1';
    let won = L.some(l => l === '|win|' + ME);
    for (const d of ds) {
      if (d.kind !== 'move') continue;
      const t = d.info && d.info.table; if (!t || !t.cols) continue;
      if (LIMIT && DEC.length >= LIMIT) break outer;
      let w;
      try { w = LR.worldAt(WB, { log: logf, me, bring, cut: '|turn|' + d.turn, hpOf }); built++; }
      catch (e) { failed++; const k = String(e.message).slice(0, 80); errs[k] = (errs[k] || 0) + 1; continue; }
      const oppSide = w.side === 'A' ? 'B' : 'A';
      const la = API.legalActions(w.S, oppSide);
      const s = Array.from(PA.scoreJoints(w.ctx, w.S, oppSide, w.side, la));
      const Z = s.reduce((a, b) => a + b, 0) || 1;
      const p = s.map(v => v / Z);
      const team = oppSide === 'A' ? w.S.sfA.team : w.S.sfB.team;
      const sheetOf = o => o && o.kind === 'switch' && team[o.to] ? team[o.to]._solverSheet : null;
      const act = actions(L, d.turn, op, w.replay.sheets);
      /* per slot */
      for (const [k, sl] of [[0, 'a'], [1, 'b']]) {
        const spr = spKey.get(room + '|' + d.turn + '|' + sl);
        let a = act[sl], inferred = false;
        /* a Sucker Punch that LANDED on a target the log never shows acting (it fainted first) proves the target had
         * chosen a damaging move — the move's own condition — so that slot is counted as an attack, and marked */
        if ((!a || a.kind === 'cant') && spr && spr.failed === false) { a = { kind: 'move', move: '(inferred: Sucker Punch landed)' }; inferred = true; }
        if (!a || a.kind === 'cant') continue;
        const mass = { attack: 0, protect: 0, status: 0, switch: 0, none: 0 };
        la.joint.forEach((j, i) => { mass[cls(j[k])] += p[i]; });
        SL.push({ run, room, turn: d.turn, slot: sl, won, actual: inferred ? 'attack' : cls(a), move: a.move || 'switch', inferred, sp_target: !!spr, sp_failed: spr ? spr.failed : undefined, p: Object.fromEntries(Object.entries(mass).map(([c, v]) => [c, +v.toFixed(4)])) });
      }
      /* recall: the actual joint's rank */
      const eqSlot = (o, a) => !a || a.kind === 'cant' ? true : !o ? false : a.kind === 'switch' ? (o.kind === 'switch' && sheetOf(o) === a.row) : (o.kind === 'move' && o.move === a.move && (a.target == null || o.target == null || o.target === a.target));
      const order = p.map((v, i) => i).sort((x, y) => p[y] - p[x] || x - y);
      const known = (act.a && act.a.kind !== 'cant') || (act.b && act.b.kind !== 'cant');
      let rank;   // undefined = the log shows no opponent action this turn
      if (known) { const r = order.findIndex(i => eqSlot(la.joint[i][0], act.a) && eqSlot(la.joint[i][1], act.b)); rank = r < 0 ? null : r + 1; }
      /* fidelity: our rebuilt top 4 (+1 reserved switch, ranked as search.js does) against the recorded columns */
      const keep = [];
      let sw = 0; for (const i of order) { if (sw >= (SPEC.reserveSwitch || 0)) break; if (la.joint[i].some(o => o && o.kind === 'switch')) { keep.push(i); sw++; } }
      for (const i of order) { if (keep.length >= SPEC.k2) break; if (!keep.includes(i)) keep.push(i); }
      const mine = new Set(keep.map(i => engLabel(la.joint[i]).replace(/switch \d+/g, 'switch')));
      const rec = t.cols.map(c => c.replace(/switch \d+/g, 'switch'));
      fidN++; if (rec.every(c => mine.has(c))) fidSame++;
      for (const c of rec) { fidColsN++; if (mine.has(c)) fidColsHit++; }
      DEC.push({ run, room, turn: d.turn, won, legal_joints: la.joint.length, rank, choice: d.choice });
    }
  }
}

const r3 = v => +v.toFixed(3);
const calib = (S, c) => {
  const bins = [0, 0.2, 0.4, 0.6, 0.8, 1.0001].slice(0, -1).map((lo, i, a) => ({ lo, hi: [0.2, 0.4, 0.6, 0.8, 1.0001][i], n: 0, sp: 0, sy: 0 }));
  let sp = 0, sy = 0;
  for (const x of S) { const v = x.p[c], y = x.actual === c ? 1 : 0; sp += v; sy += y; const b = bins.find(b => v >= b.lo && v < b.hi); b.n++; b.sp += v; b.sy += y; }
  return { n: S.length, mean_predicted: S.length ? r3(sp / S.length) : null, observed: S.length ? r3(sy / S.length) : null,
    bins: bins.filter(b => b.n).map(b => ({ lo: b.lo, n: b.n, predicted: r3(b.sp / b.n), observed: r3(b.sy / b.n) })) };
};
const R = {};
const KN = DEC.filter(d => d.rank !== undefined), nKnown = KN.length;
for (const k of [1, 2, 4, 8, 16, 32]) R["top" + k] = r3(KN.filter(d => d.rank != null && d.rank <= k).length / nKnown);
const res = {
  generated_by: 'solver/results/2026-10-01-search-blind-spots/doduo_probe.js', release: REL, spec: SPEC, digests: A.digests || null,
  worlds_built: built, worlds_failed: failed, build_errors: errs, world_counters: WB.COUNTERS,
  fidelity_rebuilt_cols_vs_recorded: { decisions: fidN, all_four_reproduced: fidSame, cols_reproduced: fidColsHit, cols: fidColsN, rate: r3(fidColsHit / Math.max(1, fidColsN)) },
  legal_opponent_joints: { mean: r3(DEC.reduce((a, d) => a + d.legal_joints, 0) / Math.max(1, DEC.length)), median: DEC.map(d => d.legal_joints).sort((a, b) => a - b)[Math.floor(DEC.length / 2)] },
  recall_actual_joint: Object.assign({ decisions: nKnown, not_in_rebuilt_legal_set: KN.filter(d => d.rank === null).length, by_turn: Object.fromEntries(["1","2","3","4","5+"].map(b => { const S = KN.filter(d => (d.turn >= 5 ? "5+" : String(d.turn)) === b); return [b, { n: S.length, top4: r3(S.filter(d => d.rank != null && d.rank <= 4).length / Math.max(1, S.length)), top8: r3(S.filter(d => d.rank != null && d.rank <= 8).length / Math.max(1, S.length)) }]; })) }, R),
  calibration_all_slots: Object.fromEntries(['attack', 'protect', 'status', 'switch'].map(c => [c, calib(SL, c)])),
  calibration_sp_targets: Object.fromEntries(['attack', 'protect', 'status', 'switch'].map(c => [c, calib(SL.filter(x => x.sp_target), c)])),
  sp_targets_attack_mass: ['failed', 'landed'].reduce((o, k) => { const S = SL.filter(x => x.sp_target && (k === 'failed') === !!x.sp_failed); o[k] = { n: S.length, mean_p_attack: r3(S.reduce((a, x) => a + x.p.attack, 0) / Math.max(1, S.length)), attacked: S.filter(x => x.actual === 'attack').length }; return o; }, {}),
  sp_targets: SL.filter(x => x.sp_target).map(x => ({ room: x.room, turn: x.turn, slot: x.slot, actual: x.actual, move: x.move, inferred: x.inferred, failed: x.sp_failed, p: x.p })),
};
fs.writeFileSync(OUT, JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify(Object.assign({}, res, { sp_targets: undefined, spec: undefined }), null, 1));
console.log('wrote', OUT);
