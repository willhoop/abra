/* solver/tests/test-porygon2-v1.js — PORYGON2 v1: honest inputs, Node == Python, invariance, wiring.
 *
 *   node solver/tests/test-porygon2-v1.js [--model <v1 json>] [--fixture <json>] [--metrics <json>]     exit 0 GREEN, 1 RED
 *
 * On the frozen release eaa5becc54eb (the one the model was trained on), with real Reg M-C team pairs from the frozen pool:
 *   1. PARITY — the fixture's raw rows through infer.js equal train.py's float64 logits of the EXPORTED weights (<= 1e-9),
 *      and the fixture and the metrics name the sha256 of THIS model file.
 *   2. ANTISYMMETRY + ORDER — swapping p1 and p2 negates the logit (<= 1e-12); permuting a side's six tokens leaves it (<= 1e-12).
 *   3. HONEST — on positions from played games: changing an UNREVEALED brought body (its HP, status, boosts) leaves the encoded
 *      input byte-identical; at least one such body was found. A revealed body's change must move it (the control).
 *   4. PROTECT — one more successful shield on an active changes that token's protect features to 1/stallCounter(n) (the
 *      engine's own counter), so the input sees the consecutive-protect penalty.
 *   5. TRICK ROOM — putting Trick Room up flips `out_first` for at least one active pair of different speeds.
 *   6. PRODUCERS — the human-dataset producer (fromDataset, on each game's recorded public history) agrees with the engine
 *      producer (fromEngine, on the replayed battle) exactly on seen / alive / active / HP / status / item, and on turns-in,
 *      shields-in-a-row and PP at rates >= 0.8 (the recorded self-play history carries no `executed` flag, so a flinched
 *      move's PP is the one known source of difference).
 *   7. THE LEAF IS WIRED — solver/porygon2/leaf.js hands a v1 file to the v1 leaf; a MILTANK decision with that leaf serves
 *      v1 evaluations (counter > 0) and the leaf's value equals the net on the encoded world.
 *
 * Deliberate breaks, each must turn this RED: PORY2V1_INFER_BREAK=mask, PORY2V1_BREAK=honest | protect | tr, MILTANK_BREAK=leaf.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('../arena/env.js');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MODEL = path.resolve(ROOT, arg('--model', 'solver/porygon2/model/porygon2-v1.json'));
const FIX = path.resolve(ROOT, arg('--fixture', 'solver/tests/fixtures/porygon2-v1-agreement.json'));
const MET = path.resolve(ROOT, arg('--metrics', 'solver/porygon2/model/porygon2-v1.metrics.json'));
const REL_ID = 'eaa5becc54eb';
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; if (fails <= 40) console.log('  FAIL ' + msg); } };

const ENGINE = require('../arena/engine.js').load(REL_ID);
const API = ENGINE.API, M = API.M;
const FX = require('../porygon2/v1/features.js');
const NET = require('../porygon2/v1/infer.js').load(MODEL);
const F = FX.create(API);
const TN = FX.TOK_NUM_NAMES, TI = n => TN.indexOf(n);

/* ---------- 1. parity + stamps ---------- */
const fix = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const msha = sha(MODEL);
ok(fix.model.sha256 === msha, 'fixture names this model file');
let worst = 0;
for (const r of fix.rows) worst = Math.max(worst, Math.abs(NET.logit(r.x) - r.python_logit));
ok(fix.rows.length >= 12, `>= 12 fixture rows (${fix.rows.length})`);
ok(worst <= 1e-9, `PARITY worst |Node - Python| ${worst.toExponential(2)} <= 1e-9`);
if (fs.existsSync(MET)) { const m = JSON.parse(fs.readFileSync(MET, 'utf8')); ok(m.out.sha256 === msha, 'metrics name this model file'); }
else ok(false, 'metrics file missing: ' + MET);
console.log(`  parity: ${fix.rows.length} rows, worst ${worst.toExponential(2)}`);

/* ---------- 2. antisymmetry + token order ---------- */
const swapX = X => ({ tok: { p1: X.tok.p2, p2: X.tok.p1 }, ids: { p1: X.ids.p2, p2: X.ids.p1 }, mvw: { p1: X.mvw.p2, p2: X.mvw.p1 }, side: { p1: X.side.p2, p2: X.side.p1 }, field: X.field, facts: { p1: X.facts.p2, p2: X.facts.p1 } });
const permX = (X, p) => { const pm = a => p.map(i => a[i]); return { tok: { p1: pm(X.tok.p1), p2: X.tok.p2 }, ids: { p1: pm(X.ids.p1), p2: X.ids.p2 }, mvw: { p1: pm(X.mvw.p1), p2: X.mvw.p2 }, side: X.side, field: X.field, facts: X.facts }; };
let wa = 0, wp = 0;
for (const r of fix.rows) {
  const l = NET.logit(r.x);
  wa = Math.max(wa, Math.abs(l + NET.logit(swapX(r.x))));
  wp = Math.max(wp, Math.abs(l - NET.logit(permX(r.x, [3, 5, 0, 2, 4, 1]))));
}
ok(wa <= 1e-12, `ANTISYMMETRY worst ${wa.toExponential(2)}`);
ok(wp <= 1e-9, `TOKEN ORDER worst ${wp.toExponential(2)}`);

/* ---------- positions from played games (a seeded random-legal driver on real team pairs) ---------- */
const T = require('../arena/teams.js');
const P = require('../mew/pairs.js').load({ teamStore: path.join(ROOT, 'data', 'team-pool-frozen-regmc') });
const PA = require('../miltank/prior_adapter.js').create(API, null);
let seedv = 12345;
const rnd = () => { seedv = (seedv * 1103515245 + 12345) >>> 0; return seedv / 4294967296; };
const positions = [];
for (let g = 0; g < 14 && positions.length < 120; g++) {
  const G = P.test[(g * 7) % P.test.length];
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  if (!a || !b) continue;
  const rng = API.makeRng(1000 + g);
  const S = API.newBattle(a.team, b.team, { rng });
  const ctx = PA.newGame(G);
  const hist = [];
  for (let t = 0; t < 14 && !API.isTerminal(S); t++) {
    positions.push({ S: API.clone(S), sheets: G.sheets, G, turns: ctx.hist.concat([{ n: S.turn + 1, state: PA.publicState(ctx, S), actions: { p1: {}, p2: {} } }]).map(x => JSON.parse(JSON.stringify(x))), k: ctx.hist.length });
    const pick = sd => { const la = API.legalActions(S, sd); return la.joint[Math.floor(rnd() * la.joint.length)]; };
    const jA = pick('A'), jB = pick('B');
    PA.record(ctx, S, jA, jB);
    API.stepInPlace(S, jA, jB, rng);
  }
}
ok(positions.length >= 60, `>= 60 played positions (${positions.length})`);
const enc = S => JSON.stringify(F.encode(F.fromEngine(S, S._sheets), S._sheets));
const encP = p => { p.S._sheets = p.sheets; return enc(p.S); };

/* ---------- 3. honest ---------- */
let hidden = 0, hiddenMoved = 0, shown = 0, shownMoved = 0;
for (const p of positions) {
  const base = encP(p);
  for (const [sd, act] of [['sfA', 'actA'], ['sfB', 'actB']]) {
    const team = p.S[sd].team;
    const unrevealed = team.find(m => !p.S[act].includes(m) && !m.fainted && m.curHP > 0 && !m._wasOut);
    if (unrevealed) {
      const S2 = API.clone(p.S); S2._sheets = p.sheets;
      const u = S2[sd].team.find(m => m._solverSheet === unrevealed._solverSheet);
      u.curHP = Math.max(1, Math.floor(u.curHP / 3)); u.status = 'par'; u.boosts = Object.assign({}, u.boosts, { at: 2 });
      hidden++; if (enc(S2) !== base) hiddenMoved++;
    }
    const act0 = p.S[act].find(m => m && !m.fainted && m.curHP > 0.05 * m.st.hp);
    if (act0) {
      const S3 = API.clone(p.S); S3._sheets = p.sheets;
      const u = S3[act].find(m => m && m._solverSheet === act0._solverSheet);
      u.curHP = 1;
      shown++; if (enc(S3) !== base) shownMoved++;
    }
  }
}
ok(hidden >= 20, `HONEST: >= 20 unrevealed bodies tried (${hidden})`);
ok(hiddenMoved === 0, `HONEST: an unrevealed body's hidden state moved the input in ${hiddenMoved} of ${hidden}`);
ok(shown >= 20 && shownMoved === shown, `HONEST control: a revealed active's HP moved the input in ${shownMoved} of ${shown}`);

/* ---------- 4. protect ---------- */
let prot = 0, protOk = 0;
for (const p of positions.slice(0, 40)) {
  const m0 = p.S.actA.find(m => m && !m.fainted && m.curHP > 0);
  if (!m0 || (m0.tookProtectTurns | 0) !== 0) continue;
  const S2 = API.clone(p.S); S2._sheets = p.sheets;
  const u = S2.actA.find(m => m && m._solverSheet === m0._solverSheet); u.tookProtectTurns = 1;
  const X = F.encode(F.fromEngine(S2, p.sheets), p.sheets);
  const row = X.tok.p1[m0._solverSheet];
  prot++;
  if (Math.abs(row[TI('protect_ok')] - 1 / M.stallCounter(1)) < 1e-12 && row[TI('protect_streak')] > 0) protOk++;
}
ok(prot >= 10 && protOk === prot, `PROTECT: the shield streak reached the input in ${protOk} of ${prot}`);

/* ---------- 5. trick room ---------- */
let trPairs = 0, trFlips = 0;
for (const p of positions.slice(0, 40)) {
  if (p.S.field.tr > 0) continue;
  const X0 = F.encode(F.fromEngine(p.S, p.sheets), p.sheets);
  const S2 = API.clone(p.S); S2.field.tr = 3;
  const X1 = F.encode(F.fromEngine(S2, p.sheets), p.sheets);
  for (const sd of ['p1', 'p2']) for (let i = 0; i < 6; i++) {
    if (!X0.tok[sd][i][TI('active')]) continue;
    const a = X0.tok[sd][i][TI('out_first')], b = X1.tok[sd][i][TI('out_first')];
    if (a === 0 || a === 1) { trPairs++; if (Math.abs(a + b - 1) < 1e-12) trFlips++; }
  }
}
ok(trPairs >= 10 && trFlips >= 1, `TRICK ROOM: out_first flipped for ${trFlips} of ${trPairs} strict active orders`);

/* ---------- 6. producers ---------- */
const agree = {}, EXACT = ['seen', 'alive', 'active', 'hp', 'status', 'item'], RATE = ['turnsOut', 'protectN', 'pp'];
for (const p of positions) {
  const H1 = F.fromEngine(p.S, p.sheets);
  const H2 = F.fromDataset({ sheets: p.sheets }, p.turns, p.k);
  for (const sd of ['p1', 'p2']) for (let i = 0; i < 6; i++) {
    const a = H1.sides[sd].mons[i], b = H2.sides[sd].mons[i];
    for (const k of EXACT.concat(RATE)) {
      const x = agree[k] || (agree[k] = [0, 0]);
      if (!a.seen && !b.seen && k !== 'seen') continue;
      x[1]++; if (JSON.stringify(a[k]) === JSON.stringify(b[k])) x[0]++;
    }
  }
}
for (const k of EXACT) ok(agree[k][0] === agree[k][1], `PRODUCERS: ${k} agrees ${agree[k][0]}/${agree[k][1]}`);
for (const k of RATE) ok(agree[k][0] / agree[k][1] >= 0.8, `PRODUCERS: ${k} agrees ${agree[k][0]}/${agree[k][1]} (floor 0.8)`);
console.log('  producers: ' + Object.entries(agree).map(([k, v]) => `${k} ${v[0]}/${v[1]}`).join(', '));

/* ---------- 7. the leaf is wired ---------- */
const LEAF = require('../porygon2/leaf.js').create(API, { model: MODEL });
ok(LEAF.version === 'v1', 'solver/porygon2/leaf.js hands a v1 file to the v1 leaf');
const p0 = positions[5];
ok(Math.abs(LEAF.value(p0.S, p0.sheets) - NET.value(F.encode(F.fromEngine(p0.S, p0.sheets), p0.sheets))) < 1e-12, 'LEAF value == net(encode(world))');
const prior = require('../mag/infer.js').load();
const PA2 = require('../miltank/prior_adapter.js').create(API, prior);
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const MT = require('../miltank/search.js').create(API, { prior: PA2, rollout: R });
const ctx = PA2.newGame(p0.G);
const before = R.COUNTERS.leafPory2;
const d = MT.decide(API.clone(p0.S), 'A', ctx, { budgetMs: 60000, maxPasses: 2, k1: 3, k2: 3, reserveSwitch: 1, depth: 0, leaf: 'pory2', leafModel: MODEL, coin: M.rngStreams({ seed: 5 }).any });
const served = R.COUNTERS.leafPory2 - before;
ok(served > 0, `LEAF: MILTANK served ${served} PORYGON2 v1 leaf evaluations`);
ok(d.info && (d.info.forced || d.info.playouts > 0), 'LEAF: the decision searched');

console.log(`${fails ? 'RED' : 'GREEN'} ${checks - fails}/${checks}` + (NET.BROKEN || F.BROKEN ? `  (break armed: ${NET.BROKEN || F.BROKEN})` : ''));
process.exit(fails ? 1 : 0);
