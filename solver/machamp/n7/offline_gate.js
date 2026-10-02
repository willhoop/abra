/* solver/machamp/n7/offline_gate.js — a generation's OFFLINE gate: the PORYGON2 v3 harness (ranking agreement, calibration,
 * cost; solver/porygon2/v3/evalset.js, DESIGN §1) on the candidate's value against the champion's, plus the policy head's held-
 * out test. Plays no game. The bars are the generation's pre-registration (offline_gate block), applied once.
 *
 *   node solver/machamp/n7/offline_gate.js --prereg <json> --harness-src <frozen evalset dir> --dir <gen>/offline
 *        --champ-net <file> --cand-net <file> --train-dir <gen>/train [--workers 3] [--subsample N] [--release eaa5becc54eb]
 *
 * THE SET IS COPIED, NOT WRITTEN INTO. evalset.js writes its scores beside the positions; the frozen set is another run's
 * evidence, so its positions, manifest and labels are copied into <dir>/harness/ and the copy is verified against the
 * manifest's sha256 (c2428b1dbf77… for the 2026-10-01 set). --subsample N (SMOKE ONLY) keeps a seeded ~1/N of the positions and
 * writes a manifest that says so: its verdict is recorded as a smoke reading, never as a gate.
 *
 * STEPS (each resumable: a step whose output exists and verifies is not re-run):
 *   score   evalset.js score --nets champ=<champ>,cand=<cand> (every position's root value; the labelled positions' depth-0
 *           matrices on the deep reference's worlds and dice)
 *   bench   evalset.js bench (cost per evaluation, champ first, so ratio_to_first is cand/champ)
 *   report  evalset.js report --nets champ,cand --base champ
 *   policy  <train-dir>/val_policy.jsonl: per held-out decision, the head's cross-entropy to the search's mix and its DODUO
 *           base's; the mean difference with a game-clustered bootstrap CI (2,000 resamples, seed 7)
 * VERDICT (verdict.json): value PASS iff every bar passes; the policy head ON iff its CI upper bound < 0 on at least
 * min_decisions held-out decisions (else OFF: the candidate plays the DODUO prior untilted — not a failure).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const cp = require('child_process');
try { require('os').setPriority(0, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* lownode set it */ }
const ROOT = path.join(__dirname, '..', '..', '..');
const shaFile = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const shaText = f => crypto.createHash('sha256').update(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')).digest('hex');   // line endings normalised (solver/machamp/n7/loop.js)
const h32 = s => crypto.createHash('sha256').update(String(s)).digest().readUInt32BE(0);
const EVALSET = path.join(ROOT, 'solver', 'porygon2', 'v3', 'evalset.js');

function copyHarness(src, dst, subsample) {
  const man = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
  const posSrc = path.join(src, 'positions.jsonl.gz');
  if (shaFile(posSrc) !== man.output.sha256) throw new Error('n7/offline: the frozen set at ' + src + ' does not match its manifest');
  const tmp = dst + '.tmp';
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  const labels = fs.readdirSync(src).filter(f => /^labels-\d+\.jsonl$/.test(f) || f === 'labels.summary.json');
  const copied = {};
  for (const f of labels) { fs.copyFileSync(path.join(src, f), path.join(tmp, f)); copied[f] = shaFile(path.join(tmp, f)); }
  let outMan = man;
  if (subsample > 1) {
    const rows = zlib.gunzipSync(fs.readFileSync(posSrc)).toString('utf8').split('\n').filter(Boolean);
    const keep = rows.filter(l => h32('n7smoke:' + JSON.parse(l).key) % subsample === 0);
    const body = zlib.gzipSync(Buffer.from(keep.join('\n') + '\n'));
    fs.writeFileSync(path.join(tmp, 'positions.jsonl.gz'), body);
    outMan = Object.assign({}, man, { positions: keep.length, labelled: keep.filter(l => JSON.parse(l).label).length,
      output: { path: 'positions.jsonl.gz', sha256: crypto.createHash('sha256').update(body).digest('hex'), bytes: body.length },
      n7_subsample: { SMOKE_ONLY: true, mod: subsample, parent_sha256: man.output.sha256, rule: 'sha256("n7smoke:" + key) mod N == 0' } });
  } else fs.copyFileSync(posSrc, path.join(tmp, 'positions.jsonl.gz'));
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(outMan, null, 1));
  fs.renameSync(tmp, dst);
  return { source: src, parent_sha256: man.output.sha256, positions_sha256: outMan.output.sha256, positions: outMan.positions, labelled: outMan.labelled, labels: copied, subsample: subsample > 1 ? subsample : null };
}

function node(args, logf) {
  const fd = fs.openSync(logf, 'a');
  const r = cp.spawnSync(process.execPath, args, { cwd: ROOT, stdio: ['ignore', fd, fd], env: Object.assign({}, process.env, { ABRA_REGULATION: 'regmc' }) });
  fs.closeSync(fd);
  if (r.status !== 0) throw new Error('n7/offline: ' + args.slice(0, 3).join(' ') + ' exited ' + r.status + ' (see ' + logf + ')');
}

function boot(items, f, B = 2000, seed = 7) {
  const games = new Map(); for (const it of items) { if (!games.has(it.gid)) games.set(it.gid, []); games.get(it.gid).push(it); }
  const G = [...games.values()];
  let s = seed >>> 0;
  const u = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const st = [];
  for (let b = 0; b < B; b++) { const x = []; for (let k = 0; k < G.length; k++) x.push(...G[Math.floor(u() * G.length)]); st.push(f(x)); }
  st.sort((a, b) => a - b);
  return [st[Math.floor(0.025 * B)], st[Math.floor(0.975 * B)]];
}
const mean = v => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);

function policyTest(trainDir, minDecisions) {
  const f = path.join(trainDir, 'val_policy.jsonl');
  const rows = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  if (!rows.length) return { decisions: 0, games: 0, on: false, why: 'no held-out decisions' };
  const d = s => mean(s.map(r => r.ce - r.ce_base));
  const ci = rows.length > 1 ? boot(rows, d) : [NaN, NaN];
  const on = rows.length >= minDecisions && ci[1] < 0;
  return { decisions: rows.length, games: new Set(rows.map(r => r.gid)).size, ce_head: +mean(rows.map(r => r.ce)).toFixed(5), ce_base: +mean(rows.map(r => r.ce_base)).toFixed(5),
    diff: +d(rows).toFixed(5), ci95: ci.map(v => +v.toFixed(5)), on, rule: `ON iff decisions >= ${minDecisions} and the CI upper bound < 0`,
    why: on ? 'the head beats its DODUO base on held-out self-play decisions' : rows.length < minDecisions ? 'too few held-out decisions' : 'the head is not shown better than its base' };
}

function gate(o) {
  const PR = JSON.parse(fs.readFileSync(o.prereg, 'utf8'));
  const OG = PR.offline_gate, B = OG.bars;
  fs.mkdirSync(o.dir, { recursive: true });
  const logf = path.join(o.dir, 'offline.log');
  const H = path.join(o.dir, 'harness');
  let harness;
  const hfile = path.join(o.dir, 'harness.json');
  if (fs.existsSync(H) && fs.existsSync(hfile)) {
    harness = JSON.parse(fs.readFileSync(hfile, 'utf8'));
    if (shaFile(path.join(H, 'positions.jsonl.gz')) !== harness.positions_sha256) throw new Error('n7/offline: the harness copy in ' + H + ' changed since it was made');
  } else { harness = copyHarness(o.harnessSrc, H, o.subsample || 0); fs.writeFileSync(hfile, JSON.stringify(harness, null, 1)); }
  if (!o.subsample && OG.harness && OG.harness.positions_sha256 && harness.parent_sha256 !== OG.harness.positions_sha256) throw new Error('n7/offline: the harness is not the pre-registered frozen set');
  const nets = `champ=${o.champNet},cand=${o.candNet}`;
  const rel = o.release || OG.release;
  const W = String(o.workers || OG.workers || 3);
  const scoreDone = () => { const f = fs.readdirSync(H).filter(x => /^scores-champ\+cand-\d+\.jsonl\.summary\.json$/.test(x)); return f.length === +W; };
  if (!scoreDone()) node([EVALSET, 'score', '--release', rel, '--dir', H, '--nets', nets, '--workers', W, '--rnet', String(OG.rnet || 4), '--tag', 'champ+cand'], logf);
  const benchF = path.join(H, 'bench-champ+cand.json');
  if (!fs.existsSync(benchF)) node([EVALSET, 'bench', '--release', rel, '--dir', H, '--nets', nets, '--positions', String(o.subsample ? Math.min(60, OG.bench_positions) : OG.bench_positions), '--reps', String(OG.bench_reps)], logf);
  const repF = path.join(H, 'report-champ+cand.json');
  if (!fs.existsSync(repF)) node([EVALSET, 'report', '--dir', H, '--nets', 'champ,cand', '--base', 'champ'], logf);
  const rep = JSON.parse(fs.readFileSync(repF, 'utf8'));
  const bench = JSON.parse(fs.readFileSync(benchF, 'utf8'));
  /* capability: the candidate's leaf served every position, 0 errors (the score workers' own counters) */
  const own = { evals: 0, errors: 0 };
  for (const f of fs.readdirSync(H).filter(x => /^scores-champ\+cand-\d+\.jsonl\.summary\.json$/.test(x))) {
    const s = JSON.parse(fs.readFileSync(path.join(H, f), 'utf8'));
    const c = s.leaf_own && s.leaf_own.cand; if (c) { own.evals += c.evals || 0; own.errors += c.errors || 0; }
  }
  const bars = [];
  const bar = (name, pass, value, limit) => bars.push({ name, pass: !!pass, value, limit });
  const vb = rep.ranking.all.cand && rep.ranking.all.cand.vs_base;
  bar('ranking: tau-b vs champion, CI lower bound', vb && vb.tau.ci[0] >= B.tau_ci_lo_min, vb && vb.tau, '>= ' + B.tau_ci_lo_min);
  bar('ranking: regret vs champion, CI upper bound', vb && vb.regret.ci[1] <= B.regret_ci_hi_max, vb && vb.regret, '<= ' + B.regret_ci_hi_max);
  const ce = rep.calibration.all.cand && rep.calibration.all.cand.ece_vs_base;
  bar('calibration: ECE vs champion, CI upper bound', ce && ce.ci[1] <= B.ece_ci_hi_max, ce, '<= ' + B.ece_ci_hi_max);
  for (const [src, lim] of Object.entries(B.human_logloss_max_delta)) {
    const s = rep.calibration.by_source[src];
    const d = s && s.cand && s.champ ? +(s.cand.logloss - s.champ.logloss).toFixed(4) : null;
    bar(`human anchor: ${src} log-loss vs champion`, d != null && d <= lim, { cand: s && s.cand && s.cand.logloss, champ: s && s.champ && s.champ.logloss, diff: d, n: s && s.cand && s.cand.n }, '<= +' + lim);
  }
  const cn = bench.nets.find(n => n.name === 'cand');
  bar('cost: median us per evaluation, cand / champ', cn && cn.ratio_to_first <= B.cost_ratio_max, cn && { ratio: cn.ratio_to_first, cand_us: cn.value_us.median, champ_us: bench.nets[0].value_us.median }, '<= ' + B.cost_ratio_max);
  bar('capability: the candidate leaf served, 0 errors', own.evals > 0 && own.errors === 0, own, '> 0 evals, 0 errors');
  const pol = policyTest(o.trainDir, OG.policy_head.min_decisions);
  const pass = bars.every(b => b.pass);
  const v = { what: 'N7 offline gate (solver/machamp/n7/offline_gate.js)', at: new Date().toISOString(), smoke: !!o.subsample,
    reading: o.subsample ? 'SMOKE: a ' + (1 / o.subsample * 100).toFixed(0) + '% subsample of the frozen set; NOT a gate verdict' : 'the pre-registered offline gate',
    preregistration_sha256: shaText(o.prereg), harness, harness_release: rel,
    nets: { champ: { file: path.relative(ROOT, o.champNet).split(path.sep).join('/'), sha256: shaFile(o.champNet) }, cand: { file: path.relative(ROOT, o.candNet).split(path.sep).join('/'), sha256: shaFile(o.candNet) } },
    bars, value: pass ? 'PASS' : 'FAIL', policy_head: pol,
    report: { file: path.relative(ROOT, repF).split(path.sep).join('/'), sha256: shaFile(repF), ranking_all: rep.ranking.all, informative: rep.ranking.informative && rep.ranking.informative.nets, calibration_all: rep.calibration.all },
    bench: { file: path.relative(ROOT, benchF).split(path.sep).join('/'), nets: bench.nets.map(n => ({ name: n.name, ratio: n.ratio_to_first, value_us: n.value_us })) } };
  fs.writeFileSync(path.join(o.dir, 'verdict.json'), JSON.stringify(v, null, 1));
  return v;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const abs = p => (p ? path.resolve(ROOT, p) : p);
  try {
    const v = gate({ prereg: abs(flag('--prereg')), harnessSrc: abs(flag('--harness-src')), dir: abs(flag('--dir')), champNet: abs(flag('--champ-net')), candNet: abs(flag('--cand-net')),
      trainDir: abs(flag('--train-dir')), workers: +flag('--workers', 0) || null, subsample: +flag('--subsample', 0), release: flag('--release', null) });
    console.log(JSON.stringify({ value: v.value, policy_head: v.policy_head.on, bars: v.bars.map(b => `${b.pass ? 'ok' : 'FAIL'} ${b.name} ${JSON.stringify(b.value)} ${b.limit}`) }, null, 1));
    process.exit(0);
  } catch (e) { console.error(e && e.stack || e); process.exit(1); }
}

module.exports = { gate, policyTest, copyHarness, boot };
