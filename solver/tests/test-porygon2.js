/* solver/tests/test-porygon2.js — PORYGON2 v0: the features, Node == Python, the stamps, the claim, the leaf.
 *
 *   node solver/tests/test-porygon2.js        exit 0 = GREEN, 1 = RED
 *
 *   1. INVARIANCE — on the fixture's real held-out positions: permuting the sheet (and every index the
 *      state holds into it) or swapping the two active slots leaves the side, field and engine facts
 *      unchanged and the tokens the same multiset; swapping p1 and p2 swaps the facts and negates the
 *      count-HP inputs; putting Trick Room up turns `faster` into 1 − `faster`. Nothing here is a typed
 *      Pokemon fact: every expectation is the position against itself.
 *   2. AGREEMENT — solver/tests/fixtures/porygon2-agreement.json holds 24 raw held-out positions and the
 *      logits train.py computed in float64 from the EXPORTED weights. Node re-encodes each position
 *      (features.js, the engine facts included) and runs infer.js: both models to 1e-9, and the full
 *      net antisymmetric (swapping p1 and p2 negates the logit) to 1e-12.
 *   3. STAMPS — the fixture and the metrics name the sha256 of THESE model files.
 *   4. THE CLAIM — read from the metrics artifact, not recomputed: on held-out log-loss and Brier the
 *      full net beats the count-HP logistic and the embeddings-only net, paired game-clustered 95% CI
 *      clear of zero. PRE-GATE: the engine facts come from a MEDICHAM whose Reg M-C gate is not open.
 *   5. THE LEAF IS WIRED — a real Reg M-C position, MILTANK with leaf 'pory2': the PORYGON2 leaf serves
 *      evaluations (counter > 0) and the heuristic arm serves none; the leaf's value on a battle equals
 *      the net on that battle's encoded position.
 *
 * Deliberate breaks, each must turn this RED: PORY2_BREAK=slot | speed | facts, PORY2_INFER_BREAK=pool,
 * MILTANK_BREAK=leaf.
 */
'use strict';
require('../arena/env.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const API = require(path.join(ROOT, 'engine', 'medicham_api.js'));
const FX = require('../porygon2/features.js');
const { load } = require('../porygon2/infer.js');

const MODEL = path.join(ROOT, 'solver', 'porygon2', 'model', 'porygon2-v0.json');
const MODEL_EMB = path.join(ROOT, 'solver', 'porygon2', 'model', 'porygon2-v0-emb.json');
const MET = path.join(ROOT, 'solver', 'porygon2', 'model', 'porygon2-v0.metrics.json');
const FIX = path.join(__dirname, 'fixtures', 'porygon2-agreement.json');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; if (fails <= 40) console.log('  FAIL ' + msg); } };
const close = (a, b, e) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= e);

const F = FX.create(API.M);
const fix = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const P = fix.positions;
ok(P.length >= 20, `at least 20 fixture positions (${P.length})`);

/* ---------- 1. invariance ---------- */
function permute(pos, perm) {   // perm[newIndex] = oldIndex, applied to both sheets
  const inv = []; perm.forEach((o, n) => { inv[o] = n; });
  const st = JSON.parse(JSON.stringify(pos.state));
  const sheets = {};
  for (const sd of ['p1', 'p2']) {
    sheets[sd] = perm.map(o => Object.assign({}, pos.sheets[sd][o], { i: undefined }));
    const s = st.sides[sd];
    s.mons = perm.map((o, n) => Object.assign({}, pos.state.sides[sd].mons[o], { i: n }));
    s.active = s.active.map(i => (i == null ? null : inv[i]));
  }
  return { sheets, state: st, turn: pos.turn };
}
function swapActive(pos) {
  const st = JSON.parse(JSON.stringify(pos.state));
  for (const sd of ['p1', 'p2']) st.sides[sd].active = st.sides[sd].active.slice().reverse();
  return { sheets: pos.sheets, state: st, turn: pos.turn };
}
function swapSides(pos) {
  const st = JSON.parse(JSON.stringify(pos.state));
  st.sides = { p1: st.sides.p2, p2: st.sides.p1 };
  return { sheets: { p1: pos.sheets.p2, p2: pos.sheets.p1 }, state: st, turn: pos.turn };
}
const tokKey = x => sd => x.tokNum[sd].map((t, i) => JSON.stringify([t.map(v => +v.toFixed(12)), x.tokId[sd][i]])).sort().join('|');
let nTR = 0, nPairs = 0;
for (const f of P) {
  const pos = { sheets: f.sheets, state: f.state, turn: f.turn };
  const x = F.encode(pos);
  const tag = `${f.game_id} T${f.turn}`;
  for (const perm of [[5, 4, 3, 2, 1, 0], [2, 0, 1, 5, 3, 4]]) {
    const y = F.encode(permute(pos, perm));
    for (const sd of ['p1', 'p2']) {
      ok(close(x.facts[sd], y.facts[sd], 1e-12), `${tag} ${sd}: engine facts unchanged by a sheet permutation`);
      ok(close(x.side[sd], y.side[sd], 1e-12), `${tag} ${sd}: side features unchanged by a sheet permutation`);
      ok(tokKey(x)(sd) === tokKey(y)(sd), `${tag} ${sd}: tokens the same multiset under a sheet permutation`);
    }
  }
  const z = F.encode(swapActive(pos));
  for (const sd of ['p1', 'p2']) ok(close(x.facts[sd], z.facts[sd], 1e-12), `${tag} ${sd}: engine facts unchanged by swapping the active slots`);
  const w = F.encode(swapSides(pos));
  ok(close(x.facts.p1, w.facts.p2, 1e-12) && close(x.facts.p2, w.facts.p1, 1e-12), `${tag}: swapping p1/p2 swaps the facts`);
  ok(close(x.base, w.base.map(v => -v), 1e-12), `${tag}: swapping p1/p2 negates the count-HP inputs`);
  if (x.facts.p1[9] === 1 && !(f.state.pseudo && f.state.pseudo['Trick Room'] != null)) {
    const st = JSON.parse(JSON.stringify(f.state)); st.pseudo = Object.assign({}, st.pseudo, { 'Trick Room': f.turn });
    const t = F.encode({ sheets: f.sheets, state: st, turn: f.turn });
    ok(Math.abs(t.facts.p1[4] - (1 - x.facts.p1[4])) < 1e-12, `${tag}: Trick Room turns faster ${x.facts.p1[4]} into ${1 - x.facts.p1[4]} (got ${t.facts.p1[4]})`);
    nTR++;
  }
  nPairs += x.facts.p1[9];
}
ok(nTR >= 10, `the Trick Room check ran on at least 10 positions (${nTR})`);

/* ---------- 2. agreement ---------- */
const full = load(MODEL), emb = load(MODEL_EMB);
let worstF = 0, worstE = 0, worstA = 0;
for (const f of P) {
  const pos = { sheets: f.sheets, state: f.state, turn: f.turn };
  const x = F.encode(pos);
  const lf = full.logit(x), le = emb.logit(x);
  worstF = Math.max(worstF, Math.abs(lf - f.python_logit_full));
  worstE = Math.max(worstE, Math.abs(le - f.python_logit_emb));
  worstA = Math.max(worstA, Math.abs(full.logit(F.encode(swapSides(pos))) + lf));
}
ok(worstF < 1e-9, `full net: Node == Python to 1e-9 (worst ${worstF.toExponential(2)})`);
ok(worstE < 1e-9, `embeddings-only net: Node == Python to 1e-9 (worst ${worstE.toExponential(2)})`);
ok(worstA < 1e-12, `antisymmetric: logit(p2 view) = −logit(p1 view) (worst ${worstA.toExponential(2)})`);
console.log(`  agreement: ${P.length} positions, worst |logit diff| full ${worstF.toExponential(2)}, emb ${worstE.toExponential(2)}, antisymmetry ${worstA.toExponential(2)}; Trick Room check on ${nTR}`);

/* ---------- 3. stamps ---------- */
const met = JSON.parse(fs.readFileSync(MET, 'utf8'));
const sF = sha(MODEL), sE = sha(MODEL_EMB);
ok(fix.model_sha256.full.sha256 === sF && fix.model_sha256.emb.sha256 === sE, 'the fixture was computed from THESE model files');
ok(met.models.full.sha256 === sF && met.models.emb.sha256 === sE, 'the metrics were computed from THESE model files');
ok(/PRE-GATE/.test(met.status) && JSON.parse(fs.readFileSync(MODEL, 'utf8')).status === 'PRE-GATE', 'the metrics and the model are labelled PRE-GATE');

/* ---------- 4. the claim ---------- */
const T = met.test.paired;
for (const [k, lbl] of [['full_minus_count_hp', 'the count-HP logistic'], ['full_minus_emb', 'the embeddings-only net']]) {
  for (const m of ['logloss', 'brier']) {
    const r = T[k][m];
    ok(r.mean < 0 && r.ci95[1] < 0, `full net beats ${lbl} on held-out ${m}, paired CI clear of zero (${r.mean} [${r.ci95.join(', ')}])`);
  }
}

/* ---------- 5. the leaf is wired ---------- */
{
  const Tm = require('../arena/teams.js');
  const PA = require('../miltank/prior_adapter.js').create(API, require('../prior/infer.js').load());
  const R = require('../miltank/rollout.js').create(API, { buildBody: Tm.buildBody });
  const MT = require('../miltank/search.js').create(API, { prior: PA, rollout: R });
  const L = Tm.loadGames({ n: 2, seed: 3, M: API.M });
  const G = L.games[0];
  const S = API.newBattle(Tm.buildTeam(API.M, G, 'p1').team, Tm.buildTeam(API.M, G, 'p2').team, { rng: API.makeRng(5) });
  const ctx = PA.newGame(G);
  const coin = API.M.rngStreams({ seed: 9 }).any;
  const before = R.COUNTERS.leafPory2;
  MT.decide(S, 'A', ctx, { budgetMs: 60000, maxPasses: 1, k1: 3, k2: 3, depth: 0, coin, leaf: 'heuristic' });
  ok(R.COUNTERS.leafPory2 === before, 'the heuristic arm serves no PORYGON2 leaf');
  const d = MT.decide(S, 'A', ctx, { budgetMs: 60000, maxPasses: 1, k1: 3, k2: 3, depth: 0, coin, leaf: 'pory2' });
  ok(R.COUNTERS.leafPory2 - before >= 9, `the pory2 arm serves a PORYGON2 leaf on every non-terminal cell (${R.COUNTERS.leafPory2 - before} for ${d.info.m * d.info.n} cells)`);
  const LF = require('../porygon2/leaf.js').create(API);
  const v = LF.value(S, G.sheets);
  ok(v > 0 && v < 1 && Math.abs(v - full.value(LF.encode(S, G.sheets))) < 1e-15, `leaf value on a battle = the net on its encoded position (${v.toFixed(4)})`);
  const pub = F.fromEngine(PA, S, G.sheets);
  ok(pub.state.sides.p1.mons.filter(m => m.seen).length === 2 && pub.state.sides.p2.mons.filter(m => m.seen).length === 2, 'at turn 1 the leaf sees exactly the four leads (the public view, not the true back line)');
}

console.log(`${fails ? 'RED' : 'GREEN'}  ${checks - fails}/${checks} checks`);
process.exit(fails ? 1 : 0);
