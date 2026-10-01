/* solver/tests/test-gary.js — GARY v1, the population habit model (solver/gary/; docs/_reports/2026-10-01-gary-hypno.md).
 * Store-only: no simulator. Reads the tracked fixture games (solver/tests/fixtures/gary-games.jsonl), the tracked recorded
 * roots (solver/results/2026-10-01-gary-hypno/roots-human-s1) and the shipped model.
 *
 *   node solver/tests/test-gary.js [--no-red] [--model solver/gary/model/gary-v1.json]
 *        exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND (a deliberate break was not seen)
 *
 *   BAND     the rating thresholds, `unrated`, and a bo1-format game's own band.
 *   BUCKET   turn 1 is `lead`; one occupied slot is `single`; the material sign is the fainted counts read independently;
 *            `_sc` exactly when Trick Room or a Tailwind is up. Every bucket in the fixtures is one of BUCKETS.
 *   CLASS    every valid cell's class mask equals one recomputed here from the candidate KEYS and the dex alone
 *            (stalling move, switch, mega, both-on-one-foe): a second, independent reading.
 *   NEST     a model whose every parameter is 0 returns DODUO v1's distribution exactly (1e-12).
 *   TILT     the shipped model: each distribution sums to 1 and, on the fixtures, differs from DODUO v1 somewhere.
 *   FIT      Newton recovers a known tilt from 4,000 synthetic decisions to 0.15, and beats the zero model's log-loss.
 *   GATE     the shipped model carries a verdict for all 48 cells; p = 1 exactly when both clauses PASS; the gate metrics
 *            file agrees with the model.
 *   ROOTS    on the fixture games, the recorded roots' human key is rebuilt from the dataset's own action, every root row
 *            but a handful maps to a DODUO cell, and the human's row maps to the dataset's label cell.
 * RED, unless --no-red: GARY_BREAK=material (BUCKET), focus (CLASS), doduo (TILT), gradsign (FIT).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const NO_RED = argv.includes('--no-red');
const ROOT = path.join(__dirname, '..', '..');
const MODEL = path.resolve(ROOT, flag('--model', 'solver/gary/model/gary-v1.json'));
let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); if (fails <= 25) console.log('  FAIL [' + clause + '] ' + msg); } };
const cannot = why => { console.log('CANNOT ANSWER: ' + why); process.exit(2); };

if (!fs.existsSync(MODEL)) cannot('no model at ' + MODEL);
const S = require('../gary/situation.js');
const F0 = require('../prior/features.js');
const X = require('../human/dex.js');
const MAG = require('../mag/infer.js').load();
const GARY = require('../gary/infer.js');
const FIT = require('../gary/fit.js');
const R = require('../gary/roots.js');
const games = fs.readFileSync(path.join(__dirname, 'fixtures', 'gary-games.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
if (games.length < 8) cannot('fixture holds ' + games.length + ' games');

/* ---------- BAND ---------- */
ok('BAND', S.bandOfRating(1099, true) === 'lt1100' && S.bandOfRating(1100, true) === '1100' && S.bandOfRating(1299, true) === '1200' && S.bandOfRating(1300, true) === '1300plus' && S.bandOfRating(1850, true) === '1300plus', 'rating thresholds');
ok('BAND', S.bandOfRating(1200, false) === 'unrated' && S.bandOfRating(null, true) === 'unrated', 'unrated');
ok('BAND', S.band({ id: 'gen9championsvgc2026regmc-123', rated: true, players: { p1: { rating: 1500 } } }, 'p1') === 'bo1', 'a bo1-format game is its own band');
ok('BAND', S.band({ id: 'gen9championsvgc2026regmcbo3-123', rated: true, players: { p1: { rating: 1150 } } }, 'p1') === '1100', 'a bo3 game reads its rating');

/* ---------- BUCKET / CLASS / NEST / TILT over every fixture decision ---------- */
const stall = id => { const m = X.D.moves.get(id); return !!(m && m.exists && m.stallingMove); };
const zeroModel = (() => {
  const M = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
  const z = v => v.map(() => 0);
  M.params = { global: z(M.params.global), bucket: Object.fromEntries(Object.entries(M.params.bucket).map(([k, v]) => [k, z(v)])), band: Object.fromEntries(Object.entries(M.params.band).map(([k, v]) => [k, z(v)])), cell: Object.fromEntries(Object.entries(M.params.cell).map(([k, v]) => [k, z(v)])) };
  const f = path.join(require('os').tmpdir(), 'gary-zero-' + process.pid + '.json');
  fs.writeFileSync(f, JSON.stringify(M));
  return f;
})();
const G0 = GARY.load({ model: zeroModel, mag: MAG }), G1 = GARY.load({ model: MODEL, mag: MAG });
fs.unlinkSync(zeroModel);
let seen = { lead: 0, single: 0, ahead: 0, behind: 0, even: 0, sc: 0 }, cellsChecked = 0, maxDiff = 0, nestWorst = 0, decisions = 0;
for (const g of games) {
  for (let t = 0; t < g.turns.length; t++) for (const side of ['p1', 'p2']) {
    const d = MAG.decide(g, t, side);
    if (!d.slots[0] && !d.slots[1]) continue;
    decisions++;
    const b = S.bucket(g, t, side, d);
    ok('BUCKET', S.BUCKETS.includes(b), 'unknown bucket ' + b);
    const st = g.turns[t].state, other = side === 'p1' ? 'p2' : 'p1';
    const fnt = s => st.sides[s].mons.filter(m => m.seen && m.fnt).length;
    const diff = fnt(other) - fnt(side);    // teamsize is 4 a side in every fixture game
    const sc = st.pseudo['Trick Room'] != null || !!st.sides.p1.conditions.Tailwind || !!st.sides.p2.conditions.Tailwind;
    const occ = d.slots.filter(Boolean).length;
    const want = t === 0 || g.turns[t].n === 1 ? 'lead' : occ < 2 ? 'single' : (diff > 0 ? 'ahead' : diff < 0 ? 'behind' : 'even') + (sc ? '_sc' : '');
    ok('BUCKET', b === want, `${g.game.id} t${t} ${side}: ${b} vs ${want}`);
    if (b === 'lead') seen.lead++; else if (b === 'single') seen.single++; else { seen[b.split('_')[0]]++; if (b.endsWith('_sc')) seen.sc++; }
    const L = MAG.logits(d).joint;
    for (let i = 0; i < L.length; i++) for (let j = 0; j < L[i].length; j++) {
      if (!(L[i][j] > -Infinity)) continue;
      const A = d.slots[0] ? d.slots[0].cands[i] : null, B = d.slots[1] ? d.slots[1].cands[j] : null;
      const parse = c => { if (!c) return null; if (c.key === 'LOCKED') return { sw: 0, mv: 'LOCKED', tc: 4, mega: 0 }; const k = c.key.split('|'); return k[0] === 'SWITCH' ? { sw: 1, mv: 'SWITCH', tc: 4, mega: 0 } : { sw: 0, mv: k[0], tc: +k[1], mega: +k[2] }; };
      const a = parse(A), bb = parse(B);
      const st2 = x => !!(x && !x.sw && x.mv !== 'LOCKED' && stall(x.mv));
      const bits = S.classBits(d, i, j);
      const has = n => !!(bits & (1 << S.CLASS_NAMES.indexOf(n)));
      ok('CLASS', has('stall_any') === (st2(a) || st2(bb)) && has('stall_double') === (st2(a) && st2(bb)), `stall bits at ${g.game.id} t${t} ${A && A.key}/${B && B.key}`);
      ok('CLASS', has('switch_any') === !!((a && a.sw) || (bb && bb.sw)) && has('switch_double') === !!(a && a.sw && bb && bb.sw), 'switch bits');
      ok('CLASS', has('mega') === !!((a && a.mega) || (bb && bb.mega)), 'mega bit');
      ok('CLASS', has('focus_same_foe') === !!(a && bb && !a.sw && !bb.sw && a.tc <= 1 && a.tc === bb.tc), `focus bit ${A && A.key}/${B && B.key}`);
      cellsChecked++;
    }
    const r0 = G0.predict(g, t, side, { band: '1100' }), r1 = G1.predict(g, t, side, { band: '1100' });
    for (const c of r0.cells) nestWorst = Math.max(nestWorst, Math.abs(c.p - c.doduo));
    const sum = r1.cells.reduce((s, c) => s + c.p, 0);
    ok('TILT', Math.abs(sum - 1) < 1e-9, 'GARY does not sum to 1: ' + sum);
    for (const c of r1.cells) maxDiff = Math.max(maxDiff, Math.abs(c.p - c.doduo));
  }
}
ok('BUCKET', seen.lead > 0 && seen.single > 0 && seen.ahead > 0 && seen.behind > 0 && seen.sc > 0, 'the fixtures do not reach every bucket kind: ' + JSON.stringify(seen));
ok('CLASS', cellsChecked > 1000, 'only ' + cellsChecked + ' cells checked');
ok('NEST', nestWorst < 1e-12, 'a zero model is not DODUO: worst |dp| ' + nestWorst);
ok('TILT', maxDiff > 1e-6, 'the shipped model equals DODUO on every fixture decision (max |dp| ' + maxDiff + ')');

/* ---------- FIT: recover a known tilt ---------- */
{
  let sd = 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const NROW = 4000, K = 12, NF = FIT.NF;
  const truth = new Float64Array(NF); truth[0] = -0.2; truth[1 + 0] = -0.8; truth[1 + 2] = 0.5; truth[1 + 7] = 0.3;
  const LP = new Float32Array(NROW * K), BI = new Uint16Array(NROW * K), rows = [];
  for (let r = 0; r < NROW; r++) {
    const lg = Array.from({ length: K }, () => 2 * rnd()); const mx = Math.max(...lg); const z = lg.reduce((s, v) => s + Math.exp(v - mx), 0);
    const p = new Float64Array(K); let zz = 0;
    for (let k = 0; k < K; k++) {
      LP[r * K + k] = lg[k] - mx - Math.log(z);
      let b = 0; for (const f of [0, 2, 7, 4]) if (rnd() < 0.3) b |= 1 << f; BI[r * K + k] = b;
      let s = (1 + truth[0]) * LP[r * K + k]; for (let f = 0; f < S.NB; f++) if (b & (1 << f)) s += truth[1 + f];
      p[k] = Math.exp(s); zz += p[k];
    }
    let u = rnd() * zz, lab = 0; while (lab < K - 1 && u > p[lab]) { u -= p[lab]; lab++; }
    rows.push({ off: r * K, K, lab, bi: 2, ni: 1, ci: 2 * S.BANDS.length + 1, pl: 'p' + r });
  }
  const D = { rows, LP, BI };
  const idx = rows.map((_, i) => i);
  const { w } = FIT.newton(D, idx, 30);
  const eff = FIT.cellParams(w, rows[0].ci);
  const err = Math.max(...Array.from(eff).map((v, f) => Math.abs(v - truth[f])));
  ok('FIT', err < 0.15, 'recovered tilt off by ' + err.toFixed(3) + ': ' + Array.from(eff).map(v => v.toFixed(2)).join(','));
  const l1 = FIT.rowsLoss(D, idx, w).reduce((s, x) => s + x.nll, 0), l0 = FIT.rowsLoss(D, idx, null).reduce((s, x) => s + x.nll, 0);
  ok('FIT', l1 < l0 - 50, 'the fit does not beat the zero model: ' + l1.toFixed(1) + ' vs ' + l0.toFixed(1));
  const ci = FIT.clusterCI([1, 1, 1, 1], ['a', 'b', 'c', 'd']);
  ok('FIT', ci.lo === 1 && ci.hi === 1, 'a constant sample has a non-degenerate CI');
}

/* ---------- GATE ---------- */
{
  const M = G1.M;
  ok('GATE', M.gate && Object.keys(M.gate).length === S.BUCKETS.length * S.BANDS.length, 'the model carries ' + (M.gate ? Object.keys(M.gate).length : 0) + ' cell verdicts');
  for (const [k, v] of Object.entries(M.gate || {})) ok('GATE', v.p === ((v.doduo.pass && v.tau.pass) ? 1 : 0), 'cell ' + k + ' p ' + v.p + ' disagrees with its clauses');
  const gm = MODEL.replace(/\.json$/, '.gate-metrics.json'), fm = MODEL.replace(/\.json$/, '.fit-metrics.json');
  if (fs.existsSync(gm) && fs.existsSync(fm)) {
    const G = JSON.parse(fs.readFileSync(gm, 'utf8')), F = JSON.parse(fs.readFileSync(fm, 'utf8'));
    for (const [k, v] of Object.entries(M.gate || {})) ok('GATE', G.gate[k].p === v.p && !!F.cells[k].pass_doduo === v.doduo.pass, 'cell ' + k + ': the metrics files disagree with the model');
  } else ok('GATE', false, 'gate or fit metrics missing beside the model');
}

/* ---------- ROOTS ---------- */
{
  const recs = R.load(path.join(ROOT, 'solver', 'results', '2026-10-01-gary-hypno', 'roots-human-s1')).filter(R.usable);
  const byId = new Map(games.map(g => [g.game.id, g]));
  let n = 0, rowsAll = 0, rowsMapped = 0;
  for (const r of recs) {
    const g = byId.get(r.id); if (!g) continue;
    n++;
    ok('ROOTS', R.humanKey(r, g) === r.human, `${r.id} t${r.ti}: rebuilt ${R.humanKey(r, g)} vs ${r.human}`);
    const d = MAG.decide(g, r.ti, r.p);
    const rc = R.rowCells(r, g, d);
    rowsAll += rc.length; rowsMapped += rc.filter(Boolean).length;
    if (r.hrow >= 0) { const la = d.slots[0] ? d.slots[0].label.set[0] : 0, lb = d.slots[1] ? d.slots[1].label.set[0] : 0; ok('ROOTS', rc[r.hrow] && rc[r.hrow][0] === la && rc[r.hrow][1] === lb, `${r.id}: the human row is not the label cell`); }
  }
  ok('ROOTS', n >= 8, 'only ' + n + ' roots fall in the fixture');
  ok('ROOTS', rowsMapped >= 0.95 * rowsAll, `only ${rowsMapped}/${rowsAll} root rows map to a DODUO cell`);
}

console.log(`test-gary: ${checks - fails}/${checks} ${fails ? 'RED' : 'GREEN'}  (failed clauses: ${[...failed].join(', ') || 'none'})  decisions ${decisions}, cells ${cellsChecked}` + (process.env.GARY_BREAK ? '  [BREAK ' + process.env.GARY_BREAK + ']' : ''));
if (process.env.GARY_BREAK) process.exit(fails ? 1 : 0);
if (!NO_RED) {
  let blind = false;
  for (const [v, must] of [['material', ['BUCKET']], ['focus', ['CLASS']], ['doduo', ['TILT']], ['gradsign', ['FIT']]]) {
    const r = cp.spawnSync(process.execPath, [__filename, ...argv, '--no-red'], { env: Object.assign({}, process.env, { GARY_BREAK: v }), encoding: 'utf8', maxBuffer: 64 << 20 });
    const line = ((r.stdout || '') + (r.stderr || '')).split('\n').find(l => l.startsWith('test-gary:')) || '(no summary line)';
    const red = r.status === 1 && must.every(c => new RegExp('failed clauses: .*\\b' + c + '\\b').test(line));
    console.log('  RED GARY_BREAK=' + v + ': exit ' + r.status + ', ' + line.replace(/^test-gary: /, '') + (red ? '' : '   <-- BLIND: expected ' + must.join(', ')));
    if (!red) blind = true;
  }
  if (blind) { console.log('BLIND: a deliberate break was not seen'); process.exit(3); }
}
process.exit(fails ? 1 : 0);
