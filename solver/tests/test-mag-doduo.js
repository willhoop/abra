/* solver/tests/test-mag-doduo.js — MAG v1 + DODUO v1: the identity extras, Node == Python, the stamps,
 * and the claim.
 *
 *   node solver/tests/test-mag-doduo.js        exit 0 = GREEN, 1 = RED
 *
 *   1. PINNED EXTRAS — the same real Reg M-C bo3 game test-prior.js pins, re-parsed from its TRACKED raw
 *      shard. Every species id the v1 featuriser adds must be the one the row itself says (the sheet
 *      species at the board's active index, the incoming mon of a switch, the target of a move). Nothing
 *      here is a typed Pokemon fact: expectations are read out of the parsed row.
 *   2. AGREEMENT — solver/tests/fixtures/mag-doduo-v1-agree.json holds, for ~80 held-out (test-split)
 *      decisions of every joint status, the tensors the trainer read and the joint logits of BOTH heads
 *      (DODUO joint, MAG factorised) that train.py computed from the EXPORTED json in float64. Node must
 *      re-featurise to the same tensors and reproduce every logit to 1e-9, with the same top-16.
 *   3. STAMPS — both model files carry the human dataset's sha256; DODUO names MAG's sha256; the
 *      fixture names both, so a retrain without a new fixture is RED.
 *   4. THE CLAIM — the metrics file, evaluated from the exported json, must show v1 beating prior v0 on
 *      held-out joint log-loss and joint recall@4/8/12/16 with the paired 95% CI clear of zero.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const X = require('../human/dex.js');
const { parseGame } = require('../human/parse_game.js');
const F = require('../mag/features.js');
const F0 = F.V0;
const { load } = require('../mag/infer.js');

const ROOT = path.join(__dirname, '..', '..');
const MODEL_DIR = path.join(ROOT, 'solver', 'mag', 'model');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; if (fails <= 40) console.log('  FAIL ' + msg); } };

/* ---------- 1. pinned extras, read against the row ---------- */
const SHARD = path.join(ROOT, 'data', 'raw', 'games.' + X.FORMAT, '20260909T1850-00.jsonl.gz');
const GID = X.FORMAT + '-2678209493';
const raw = zlib.gunzipSync(fs.readFileSync(SHARD)).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).find(r => r.id === GID);
ok(!!raw, 'fixture game present in its shard');
const row = parseGame(raw);
let nSlots = 0, nSwitch = 0, nFoe = 0;
for (let t = 0; t < row.turns.length; t++) for (const side of ['p1', 'p2']) {
  const opp = side === 'p1' ? 'p2' : 'p1';
  const st = row.turns[t].state.sides;
  const alive = (sd, k) => { const i = st[sd].active[k]; const m = i == null ? null : st[sd].mons[i]; return m && m.seen && !m.fnt ? m.i : null; };
  const mine = row.game.sheets[side], theirs = row.game.sheets[opp];
  const d = F.decide(row, t, side, null);
  const d0 = F0.decide(row, t, side, null);
  for (let k = 0; k < 2; k++) {
    const s = d.slots[k];
    ok(!!s === !!d0.slots[k], `T${t} ${side} slot ${k}: v1 occupancy == v0`);
    if (!s) continue;
    nSlots++;
    const tag = `T${t} ${side}${s.pos}`;
    ok(s.cands.length === d0.slots[k].cands.length && s.cands.every((c, i) => c.key === d0.slots[k].cands[i].key), `${tag}: v1 candidates are v0's, in v0's order`);
    ok(s.sx.length === F.SLOT_X, `${tag}: ${F.SLOT_X} identity ids`);
    ok(s.sx[0] === mine[alive(side, k)].species_id, `${tag}: me = my sheet species at my active index`);
    const al = alive(side, 1 - k);
    ok(s.sx[1] === (al == null ? '' : mine[al].species_id), `${tag}: ally = the other active mon, or none`);
    for (const [j, name] of [[0, 'foeA'], [1, 'foeB']]) {
      const f = alive(opp, j);
      ok(s.sx[2 + j] === (f == null ? '' : theirs[f].species_id), `${tag}: ${name} = their sheet species at their active index`);
    }
    ok(s.sx.slice(4, 10).join() === mine.map(m => m.species_id).join(), `${tag}: my six = my sheet, in order`);
    ok(s.sx.slice(10, 16).join() === theirs.map(m => m.species_id).join(), `${tag}: their six = their sheet, in order`);
    ok(s.sx.slice(16, 22).every((id, i) => id === '' || (id === theirs[i].species_id && st[opp].mons[i].seen && !st[opp].mons[i].fnt)), `${tag}: their revealed = seen and alive only`);
    for (const c of s.cands) {
      if (c.attr.sw) { nSwitch++; ok(c.tx === mine[c.attr.to].species_id, `${tag} ${c.key}: switch points at the incoming mon`); }
      else if (c.attr.tc === F0.TC.foeA || c.attr.tc === F0.TC.foeB) {
        nFoe++;
        const f = alive(opp, c.attr.tc === F0.TC.foeA ? 0 : 1);
        ok(c.tx === theirs[f].species_id, `${tag} ${c.key}: a foe-targeted move points at that foe`);
      } else if (c.attr.tc === F0.TC.none) ok(c.tx === '', `${tag} ${c.key}: an untargeted move points at nothing`);
    }
  }
}
ok(nSlots >= 20 && nSwitch >= 5 && nFoe >= 20, `the pinned game exercises every extra (${nSlots} slots, ${nSwitch} switch cands, ${nFoe} foe-targeted cands)`);

/* ---------- 2 + 3. Node == Python, and the stamps ---------- */
const FIX = path.join(__dirname, 'fixtures', 'mag-doduo-v1-agree.json');
const MAG = path.join(MODEL_DIR, 'mag-v1.json'), DOD = path.join(MODEL_DIR, 'doduo-v1.json');
const MET = path.join(MODEL_DIR, 'mag-doduo-v1.metrics.json');
if (![FIX, MAG, DOD, MET].every(fs.existsSync)) ok(false, 'fixture, both model files and the metrics exist');
else {
  const fx = JSON.parse(fs.readFileSync(FIX, 'utf8'));
  const Mj = JSON.parse(fs.readFileSync(MAG, 'utf8')), Dj = JSON.parse(fs.readFileSync(DOD, 'utf8'));
  const magSha = sha(MAG), dodSha = sha(DOD);
  const hex64 = s => /^[0-9a-f]{64}$/.test(String(s));
  ok(hex64(Mj.dataset.games_sha256) && hex64(Mj.dataset.manifest_sha256), 'MAG stamps the dataset digest and its manifest digest');
  ok(Dj.dataset.games_sha256 === Mj.dataset.games_sha256 && Dj.dataset.manifest_sha256 === Mj.dataset.manifest_sha256, 'DODUO stamps the same dataset');
  ok(fx.dataset_games_sha256 === Mj.dataset.games_sha256, 'the fixture came from the same dataset');
  ok(Dj.mag.sha256 === magSha, 'DODUO names THIS MAG file');
  ok(fx.mag_sha256 === magSha && fx.doduo_sha256 === dodSha, `fixture was written by THESE models (fixture ${String(fx.mag_sha256).slice(0, 12)}/${String(fx.doduo_sha256).slice(0, 12)})`);
  ok(Mj.split && Mj.split.salt === 'abra-prior-v0', 'same player split as prior v0 (salt abra-prior-v0)');

  const P = load();
  let worstJ = 0, worstM = 0, worstFeat = 0, nDec = 0, nCells = 0;
  const statuses = new Set();
  const f32 = v => Math.fround(v);
  const vocab = fx.species_vocab;
  for (const e of fx.decisions) {
    const out = P.predict(fx.rows[String(e.game)], e.turn, e.side);
    const d = out.decision;
    const tag = `dec ${e.game}/${e.turn}/${e.side}`;
    nDec++; statuses.add(e.joint_status);
    for (let k = 0; k < 2; k++) {
      const py = e.features[k], s = d.slots[k];
      ok(!!py === !!s, `${tag} slot ${k}: same occupancy`);
      if (!py || !s) continue;
      ok(py.cand.length === s.cands.length, `${tag} slot ${k}: same candidate count`);
      for (let i = 0; i < F0.CTX_F; i++) worstFeat = Math.max(worstFeat, Math.abs(f32(s.ctx[i]) - py.ctx[i]));
      s.cands.forEach((c, ci) => { for (let i = 0; i < F0.CAND_F; i++) worstFeat = Math.max(worstFeat, Math.abs(f32(c.f[i]) - py.cand[ci][i])); });
      ok(s.sx.join() === py.sx.map(i => (i === 0 ? '' : vocab[i])).join(), `${tag} slot ${k}: same identity ids`);
      ok(s.cands.map(c => c.tx).join() === py.cx.map(i => (i === 0 ? '' : vocab[i])).join(), `${tag} slot ${k}: same candidate target ids`);
      ok(s.cands.map((_, ci) => (s.label.set.includes(ci) ? 1 : 0)).join() === py.label.join(), `${tag} slot ${k}: same label vector`);
    }
    for (const [which, L, ref] of [['joint', out.logits, e.joint], ['mag', out.magLogits, e.mag]]) {
      ok(L.length === ref.length && L[0].length === ref[0].length, `${tag} ${which}: logit shape`);
      for (let i = 0; i < ref.length; i++) for (let j = 0; j < ref[i].length; j++) {
        const a = L[i] && L[i][j], b = ref[i][j];
        if (b === null) ok(a === -Infinity, `${tag} ${which} cell ${i},${j}: invalid in both`);
        else { nCells++; const df = Math.abs(a - b); if (which === 'joint') worstJ = Math.max(worstJ, df); else worstM = Math.max(worstM, df); }
      }
      const py = [];
      ref.forEach((r, i) => r.forEach((x, j) => { if (x !== null) py.push({ a: i, b: j, x }); }));
      py.sort((u, v) => v.x - u.x);
      const top = out.top(16, which);
      for (let q = 0; q < Math.min(16, py.length); q++) {
        const tie = Math.abs(ref[top[q].a][top[q].b] - py[q].x) < 1e-9;
        ok((top[q].a === py[q].a && top[q].b === py[q].b) || tie, `${tag} ${which}: top-16 rank ${q + 1} agrees`);
      }
    }
    ok(Math.abs(out.cells.reduce((s, c) => s + c.p, 0) - 1) < 1e-9, `${tag}: probabilities sum to 1`);
  }
  ok(nDec >= 60, `at least 60 agreement decisions (${nDec})`);
  ok(['exact', 'hidden', 'uncertain_target'].every(s => statuses.has(s)), `the fixture covers exact, hidden and uncertain-target decisions (${[...statuses].join(', ')})`);
  ok(worstFeat === 0, `features identical to the trainer's float32 tensors (worst |diff| ${worstFeat})`);
  ok(worstJ < 1e-9 && worstM < 1e-9, `logits agree to 1e-9 (DODUO worst ${worstJ.toExponential(2)}, MAG worst ${worstM.toExponential(2)})`);
  console.log(`  agreement: ${nDec} decisions, ${nCells} cells, worst feature diff ${worstFeat}, worst logit diff DODUO ${worstJ.toExponential(2)} MAG ${worstM.toExponential(2)}`);

  /* ---------- 4. the claim, read from the artifact ---------- */
  const met = JSON.parse(fs.readFileSync(MET, 'utf8'));
  ok(met.models.mag_v1.sha256 === magSha && met.models.doduo_v1.sha256 === dodSha, 'the metrics were computed from THESE model files');
  ok(met.evaluated_from.startsWith('the exported json'), 'the metrics were evaluated from the exported json');
  const all = met.by_subset.all.doduo_v1;
  ok(all.joint_ll.diff < 0 && all.joint_ll.diff_hi < 0, `DODUO v1 joint log-loss below v0, paired CI clear of zero (${all.joint_ll.diff.toFixed(3)} [${all.joint_ll.diff_lo.toFixed(3)}, ${all.joint_ll.diff_hi.toFixed(3)}])`);
  for (const k of [4, 8, 12, 16]) {
    const r = all['joint_r' + k];
    ok(r.diff > 0 && r.diff_lo > 0, `DODUO v1 joint recall@${k} above v0, paired CI clear of zero (${(100 * r.diff).toFixed(1)} pp [${(100 * r.diff_lo).toFixed(1)}, ${(100 * r.diff_hi).toFixed(1)}])`);
  }
}

console.log(`${fails ? 'RED' : 'GREEN'}  ${checks - fails}/${checks} checks`);
process.exit(fails ? 1 : 0);
