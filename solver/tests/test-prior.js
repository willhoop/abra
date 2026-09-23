/* solver/tests/test-prior.js — the human policy prior v0: labels, and Node == Python.
 *
 *   node solver/tests/test-prior.js        exit 0 = GREEN, 1 = RED
 *
 *   1. PINNED LABELS — one real Reg M-C bo3 game re-parsed from its TRACKED raw shard (dated shards are
 *      written once, so the fixture cannot move). The joint actions below were read off that log: the
 *      featuriser must turn each into the right candidate (move, target class) or the right exclusion.
 *   2. INVARIANTS — over every decision of that game: candidate keys unique per slot, an exact label is
 *      one candidate whose move/switch is the logged one, a hidden slot's label set covers the slot.
 *   3. AGREEMENT — solver/tests/fixtures/prior-v0-agree.json holds, for 60 held-out (test-split)
 *      decisions, the float32 tensors the trainer read and the joint logits train.py computed. Node must
 *      re-featurise the same decisions to the same tensors, and infer.js must reproduce every logit to
 *      1e-6 and the same top-16 joint actions. The fixture names the model's sha256; a model retrained
 *      without regenerating the fixture is RED, not silently compared against old numbers.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const X = require('../human/dex.js');
const { parseGame } = require('../human/parse_game.js');
const F = require('../prior/features.js');
const { load } = require('../prior/infer.js');

const ROOT = path.join(__dirname, '..', '..');
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; if (fails <= 40) console.log('  FAIL ' + msg); } };

/* ---------- 1. pinned labels ---------- */
const SHARD = path.join(ROOT, 'data', 'raw', 'games.' + X.FORMAT, '20260909T1850-00.jsonl.gz');
const GID = X.FORMAT + '-2678209493';
const raw = zlib.gunzipSync(fs.readFileSync(SHARD)).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).find(r => r.id === GID);
ok(!!raw, 'fixture game present in its shard');
const row = parseGame(raw);
const T = n => row.turns.findIndex(t => t.n === n);
const lab = (d, k) => d.slots[k] && d.slots[k].label;
const labCand = (d, k) => d.slots[k].cands[d.slots[k].label.set[0]];
{
  const d1 = F.decide(row, T(1), 'p1', null);
  ok(lab(d1, 0).status === 'exact' && labCand(d1, 0).attr.mv === 'tailwind' && labCand(d1, 0).attr.tc === F.TC.none, 'T1 p1a: Tailwind, no target choice');
  ok(lab(d1, 1).status === 'exact' && labCand(d1, 1).attr.mv === 'fakeout' && labCand(d1, 1).attr.tc === F.TC.foeA, 'T1 p1b: Fake Out into p2a = foeA');
  ok(F.jointStatus(d1) === 'exact', 'T1 p1 joint exact');
  const d2 = F.decide(row, T(1), 'p2', null);
  ok(lab(d2, 0).status === 'hidden' && lab(d2, 0).set.length === d2.slots[0].cands.length, 'T1 p2a: flinched -> hidden, label = every candidate');
  ok(lab(d2, 1).status === 'exact' && labCand(d2, 1).attr.mv === 'electroshot' && labCand(d2, 1).attr.tc === F.TC.foeB, 'T1 p2b: Electro Shot into p1b = foeB');
  ok(F.jointStatus(d2) === 'hidden', 'T1 p2 joint excluded as hidden');
  const d3 = F.decide(row, T(2), 'p2', null);
  ok(lab(d3, 1).status === 'hidden', 'T2 p2b: fainted before acting -> hidden');
  const d4 = F.decide(row, T(3), 'p2', null);
  ok(lab(d4, 1).status === 'exact' && labCand(d4, 1).attr.mega === 1 && labCand(d4, 1).attr.mv === 'flashcannon', 'T3 p2b: the mega turn is labelled mega');
}

/* ---------- 2. invariants over the whole game ---------- */
for (let t = 0; t < row.turns.length; t++) for (const side of ['p1', 'p2']) {
  const d = F.decide(row, t, side, null);
  for (const s of d.slots) {
    if (!s) continue;
    const keys = s.cands.map(c => c.key);
    ok(new Set(keys).size === keys.length, `T${t} ${side}${s.pos}: candidate keys unique`);
    ok(s.cands.every(c => c.f.length === F.CAND_F && c.f.every(Number.isFinite)) && s.ctx.every(Number.isFinite), `T${t} ${side}${s.pos}: features finite`);
    const a = row.turns[t].actions[side][s.pos];
    if (s.label.status === 'exact') {
      ok(s.label.set.length === 1, `T${t} ${side}${s.pos}: exact = one candidate`);
      const c = s.cands[s.label.set[0]];
      if (a.kind === 'switch') ok(c.attr.sw === 1 && c.attr.to === a.to, `T${t} ${side}${s.pos}: switch label is the logged switch`);
      else ok(c.attr.mv === X.toID(a.move), `T${t} ${side}${s.pos}: move label is the logged move`);
    }
    if (s.label.status === 'hidden') ok(s.label.set.length >= 1 && a.kind === 'hidden', `T${t} ${side}${s.pos}: hidden label only on a hidden action`);
  }
}

/* ---------- 3. Node == Python ---------- */
const FIX = path.join(__dirname, 'fixtures', 'prior-v0-agree.json');
const MODEL = path.join(ROOT, 'solver', 'prior', 'model', 'prior-v0.json');
if (!fs.existsSync(FIX) || !fs.existsSync(MODEL)) ok(false, 'agreement fixture and model exist');
else {
  const fx = JSON.parse(fs.readFileSync(FIX, 'utf8'));
  const sha = crypto.createHash('sha256').update(fs.readFileSync(MODEL)).digest('hex');
  ok(fx.model_json_sha256 === sha, `fixture was written by THIS model (fixture ${String(fx.model_json_sha256).slice(0, 12)} vs model ${sha.slice(0, 12)})`);
  const P = load();
  const f32 = v => Math.fround(v);
  let worstLogit = 0, worstFeat = 0, nDec = 0;
  for (const e of fx.decisions) {
    const r = fx.rows[String(e.game)];
    const out = P.predict(r, e.turn, e.side);
    const d = out.decision;
    nDec++;
    for (let k = 0; k < 2; k++) {
      const py = e.features[k], s = d.slots[k];
      ok(!!py === !!s, `dec ${e.game}/${e.turn}/${e.side} slot ${k}: same occupancy`);
      if (!py || !s) continue;
      ok(py.cand.length === s.cands.length, `dec ${e.game}/${e.turn}/${e.side} slot ${k}: same candidate count`);
      for (let i = 0; i < F.CTX_F; i++) worstFeat = Math.max(worstFeat, Math.abs(f32(s.ctx[i]) - py.ctx[i]));
      s.cands.forEach((c, ci) => { for (let i = 0; i < F.CAND_F; i++) worstFeat = Math.max(worstFeat, Math.abs(f32(c.f[i]) - py.cand[ci][i])); });
      const nl = s.cands.map((_, ci) => (s.label.set.includes(ci) ? 1 : 0));
      ok(nl.join() === py.label.join(), `dec ${e.game}/${e.turn}/${e.side} slot ${k}: same label vector`);
    }
    const L = out.logits;
    ok(L.length === e.logits.length && L[0].length === e.logits[0].length, `dec ${e.game}/${e.turn}/${e.side}: logit shape`);
    for (let i = 0; i < L.length; i++) for (let j = 0; j < L[i].length; j++) {
      const a = L[i][j], b = e.logits[i][j];
      if (b === null) ok(a === -Infinity, `dec ${e.game}/${e.turn}/${e.side} cell ${i},${j}: invalid in both`);
      else worstLogit = Math.max(worstLogit, Math.abs(a - b));
    }
    /* the same top-16 joint actions (ties within 1e-9 may swap) */
    const pyCells = [];
    e.logits.forEach((rr, i) => rr.forEach((x, j) => { if (x !== null) pyCells.push({ a: i, b: j, x }); }));
    pyCells.sort((u, v) => v.x - u.x);
    const nodeTop = out.top(16);
    for (let q = 0; q < Math.min(16, pyCells.length); q++) {
      const same = nodeTop[q].a === pyCells[q].a && nodeTop[q].b === pyCells[q].b;
      const tie = Math.abs(e.logits[nodeTop[q].a][nodeTop[q].b] - pyCells[q].x) < 1e-9;   // equal logits may swap
      ok(same || tie, `dec ${e.game}/${e.turn}/${e.side}: top-16 rank ${q + 1} agrees`);
    }
    const tot = out.cells.reduce((s, c) => s + c.p, 0);
    ok(Math.abs(tot - 1) < 1e-9, `dec ${e.game}/${e.turn}/${e.side}: probabilities sum to 1`);
  }
  ok(nDec >= 30, `at least 30 agreement decisions (${nDec})`);
  ok(worstFeat === 0, `features identical to the trainer's float32 tensors (worst |diff| ${worstFeat})`);
  ok(worstLogit < 1e-6, `logits agree to 1e-6 (worst |diff| ${worstLogit.toExponential(2)})`);
  console.log(`  agreement: ${nDec} decisions, worst feature diff ${worstFeat}, worst logit diff ${worstLogit.toExponential(2)}`);
}

console.log(`${fails ? 'RED' : 'GREEN'}  ${checks - fails}/${checks} checks`);
process.exit(fails ? 1 : 0);
