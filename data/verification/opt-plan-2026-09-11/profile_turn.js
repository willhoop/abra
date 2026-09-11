/* profile_turn.js — WHERE A MEDICHAM TURN'S TIME GOES, BY SHARE OF CPU SAMPLES. ROADMAP #130 planning.
 *
 * ENGINE, 2026-09-11. Planning and profiling only: this file edits nothing and reads the engine ONLY
 * from the frozen release (default 13257c8bc397), never the live tree, because an ENGINE agent is
 * editing engine/medicham2-browser.js as this runs.
 *
 * WHAT IS PLAYED. The rollout loop itself: `RL.runPlayout(S, rng, explore=1.0, 'uniform', null, SWR)`
 * (release rollout_leaf.js:833), on `MEDI.battleInit(A, B, {rng})` from a fresh position. That is the
 * MEDICHAM arm of data/verification/speed-2026-09-08/bench_two_engines.js (the 1,482 turns/sec figure)
 * with one substitution, stated: bodies come from the release's own exported `buildMonFromSet` (the
 * engine's paste path, zero SP, the sheet's nature) instead of the live `engine/game_differential.js`
 * `buildPair/freshBodies`, because requiring that file installs wrappers on Showdown classes and it is
 * held by another agent. Consequence: a stone holder is built as its mega forme, and no mega happens
 * in play. Shares of a turn are the claim, not an absolute speed.
 *
 * THREE PHASES, INTERLEAVED BY GAME, ONE PROCESS, EACH WITH ITS OWN SAMPLING PROFILE:
 *   A1  trace OFF   — exactly what a rollout pays
 *   B   trace ON    — `battleInit(..., {trace: []})`, what the differential/narration path adds
 *   A2  trace OFF   — a second copy of A1, so |share(A1) - share(A2)| is the NOISE FLOOR on a share
 * Order within each game rotates A1,B,A2 / B,A2,A1 / A2,A1,B so contention is common-mode. The V8
 * profiler is started only around the phase's own game and stopped after, via the inspector Profiler
 * domain (equivalent to --cpu-prof; lets one process produce three separable profiles).
 *
 * EQUIVALENCE, CHECKED, NOT ASSUMED. The same seed must give the same game in all three phases: the
 * per-game digest (result, turn count, every body's name/HP/status/fainted) is compared, and any
 * Math.random call during play is counted (a nonzero count means the games are not pure functions of
 * the seed and the comparison is weaker than it looks — printed, never hidden).
 *
 * Output (all in this directory): profile-summary.json, and phase-{A1,B,A2}.cpuprofile.gz (gzip of a
 * standard .cpuprofile; gunzip and load in Chrome DevTools > Performance to browse).
 *
 *   cmd //c "tools\lownode.cmd data\verification\opt-plan-2026-09-11\profile_turn.js --pairs 100 --per-pair 3"
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const os = require('os');
const { Session } = require('node:inspector/promises');

const ROOT = 'C:/Users/willj/Projects/Pokemon/ABRA';
const D = (...p) => path.join(ROOT, ...p);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(n);
const REL_ID = arg('--release', '13257c8bc397');
const TEAM_STORE = 'data/team-pool-frozen';
const PAIRS = +arg('--pairs', 100);
const PER_PAIR = +arg('--per-pair', 3);
const CAP = +arg('--cap', 20);
const STRIDE = +arg('--stride', 97);
const WARM = +arg('--warm', 120);
const INTERVAL_US = +arg('--interval-us', 100);
const SMOKE = has('--smoke');
const OUTDIR = __dirname;
const sha12 = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

if (!process.env.SHOWDOWN_PATH) process.env.SHOWDOWN_PATH = 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';

/* ---- LOAD: the frozen release only ------------------------------------------------------------ */
const REL = require(D('engine', 'engine_release.js')).open(REL_ID);
const MEDI = REL.require('engine/medicham2-browser.js',
  { need: ['battleInit', 'battleTurn', 'battleOver', 'battleResult', 'buildMonFromSet', 'playerAction'] });
const RL = REL.require('engine/rollout_leaf.js', { need: ['runPlayout'], dataMissingOk: ['data/rollout-switch-census.json'] });
const RELDIR = path.join(D('data', 'releases', REL.id)).replace(/\\/g, '/');

/* switch rate: the census is not a release source; read live, passed explicitly, digest recorded. */
const CENSUS = (() => {
  const raw = fs.readFileSync(D('data', 'rollout-switch-census.json'), 'utf8');
  const j = JSON.parse(raw);
  const pc = j.pooled && j.pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch;
  return { switchRate: (typeof pc === 'number' && pc > 0) ? pc / 100 : 0, digest: sha12(raw) };
})();
const SWR = CENSUS.switchRate;

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const C = { lines_read: 0, pair_skipped_parse: 0, pair_skipped_body: 0, games_threw: 0, first_throw: null,
            math_random_calls_in_play: 0, trace_lines_total: 0 };

/* ---- the pinned pool: a deterministic stride over the frozen bo3 store ------------------------- */
function loadPairs() {
  const lines = fs.readFileSync(D(TEAM_STORE, 'games.bo3.jsonl'), 'utf8').split('\n');
  const out = [];
  for (let i = 0; i < lines.length && out.length < PAIRS; i += STRIDE) {
    C.lines_read++;
    let g; try { g = JSON.parse(lines[i]); } catch (e) { C.pair_skipped_parse++; continue; }
    const sh = g && g.sheets;
    if (!sh || !Array.isArray(sh.p1) || !Array.isArray(sh.p2)) { C.pair_skipped_parse++; continue; }
    const pick = (sheet, side) => {
      const br = g.brought && g.brought[side];
      const want = Array.isArray(br) && br.length === 4 ? br.map(s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')) : null;
      const rows = want ? want.map(w => sheet.find(p => String(p.species).toLowerCase().replace(/[^a-z0-9]/g, '') === w)).filter(Boolean) : [];
      return rows.length === 4 ? rows : sheet.slice(0, 4);
    };
    const A = pick(sh.p1, 'p1'), B = pick(sh.p2, 'p2');
    const toSet = (p) => ({ species: p.species, item: p.item || '', ability: p.ability || '', moves: p.moves || [],
                            nature: p.nature || '', sp: {} });
    const build = (rows) => rows.map(p => MEDI.buildMonFromSet(toSet(p)));
    const tA = build(A), tB = build(B);
    if (tA.some(x => !x || !x.moves.length) || tB.some(x => !x || !x.moves.length)) { C.pair_skipped_body++; continue; }
    out.push({ id: g.id, line: i, A: A.map(toSet), B: B.map(toSet) });
  }
  return out;
}

function digestGame(S, res) {
  const side = (xs) => (xs || []).filter(Boolean).map(m => [m.name, m.curHP, m.status || '', !!m.fainted].join(':')).sort().join(',');
  return sha12([res, S.turn, side([].concat(S.actA || [], S.benchA || [])), side([].concat(S.actB || [], S.benchB || []))].join('|'));
}

const _MR = Math.random;
function playOne(pair, seed, traceOn) {
  const A = pair.A.map(s => MEDI.buildMonFromSet(s)), B = pair.B.map(s => MEDI.buildMonFromSet(s));
  const opts = { rng: mulberry(seed ^ 0x9e3779b9) };
  let sink = null;
  if (traceOn) { sink = []; opts.trace = sink; }
  const S = MEDI.battleInit(A, B, opts);
  S.maxTurns = CAP; S._explore = 1.0;
  const res = RL.runPlayout(S, mulberry(seed), 1.0, 'uniform', null, SWR);
  if (sink) C.trace_lines_total += sink.length;
  return { S, res };
}

/* ---- profile analysis ------------------------------------------------------------------------- */
function shortUrl(u) {
  if (!u) return '';
  const s = u.replace(/\\/g, '/').replace(/^file:\/\/\//, '');
  const i = s.indexOf('/releases/' + REL.id + '/');
  if (i >= 0) return 'REL:' + s.slice(i + ('/releases/' + REL.id + '/').length);
  if (s.startsWith('node:')) return s;
  return s.split('/').slice(-2).join('/');
}
function analyse(profile) {
  const byId = new Map();
  for (const n of profile.nodes) byId.set(n.id, n);
  const parent = new Map();
  for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
  const key = (n) => {
    const cf = n.callFrame;
    return (cf.functionName || '(anonymous)') + ' @ ' + shortUrl(cf.url) + (cf.url ? ':' + (cf.lineNumber + 1) : '');
  };
  const fileOf = (n) => { const u = shortUrl(n.callFrame.url); return u || n.callFrame.functionName; };
  const self = new Map(), incl = new Map(), file = new Map();
  const total = profile.samples.length;
  const inclCache = new Map();
  for (const sid of profile.samples) {
    const n = byId.get(sid);
    const k = key(n);
    self.set(k, (self.get(k) || 0) + 1);
    const f = fileOf(n); file.set(f, (file.get(f) || 0) + 1);
    let ks = inclCache.get(sid);
    if (!ks) {
      const set = new Set(); let cur = sid;
      while (cur !== undefined) { const m = byId.get(cur); if (m.callFrame.functionName !== '(root)') set.add(key(m)); cur = parent.get(cur); }
      ks = [...set]; inclCache.set(sid, ks);
    }
    for (const kk of ks) incl.set(kk, (incl.get(kk) || 0) + 1);
  }
  const pct = (x) => +(100 * x / total).toFixed(2);
  const top = (m, k) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([name, v]) => ({ name, samples: v, pct: pct(v) }));
  return { samples: total, self_top: top(self, 70), inclusive_top: top(incl, 90), by_file_self: top(file, 25),
           _self: self, _incl: incl };
}

/* ================================== MAIN ======================================================== */
(async () => {
  const T0 = Date.now();
  console.log('');
  console.log('MEDICHAM TURN PROFILE — shares of CPU samples, release ' + REL.id + ', node ' + process.version + ', ' + os.cpus().length + ' cores, ' + (os.freemem() / 1e9).toFixed(1) + ' GB free');
  console.log('  switch rate ' + SWR + ' (census ' + CENSUS.digest + ')   cap ' + CAP + '   sampling ' + INTERVAL_US + ' us');
  const pairs = loadPairs();
  const np = SMOKE ? Math.min(3, pairs.length) : pairs.length;
  const PAIRSET = pairs.slice(0, np);
  const perPair = SMOKE ? 1 : PER_PAIR;
  console.log('  pool ' + TEAM_STORE + ' stride ' + STRIDE + ' -> ' + PAIRSET.length + ' pairs x ' + perPair + ' games per phase (' + JSON.stringify(C) + ')');

  /* warm-up, discarded, not profiled: V8 tier-up must not land inside one phase only. */
  { const t = Date.now(); let i = 0;
    for (; i < (SMOKE ? 6 : WARM); i++) { const p = PAIRSET[i % PAIRSET.length]; try { playOne(p, 777 + i, i % 2 === 1); } catch (e) { C.games_threw++; } }
    console.log('  warm-up (discarded): ' + i + ' games, ' + (Date.now() - t) + ' ms'); }

  const session = new Session();
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.setSamplingInterval', { interval: INTERVAL_US });

  const PH = ['A1', 'B', 'A2'];
  const acc = {}; for (const ph of PH) acc[ph] = { games: 0, turns: 0, ms: 0, digests: [], profiles: [] };
  const ORDERS = [['A1', 'B', 'A2'], ['B', 'A2', 'A1'], ['A2', 'A1', 'B']];
  /* One profile per phase. The inspector cannot hold three profiles open at once, so each phase's
   * profile is started and stopped around every game of that phase, and the per-game profiles are
   * MERGED by sample (node trees are merged by call-frame path). Cheap: a few hundred stop/starts. */
  let gi = 0;
  for (const pair of PAIRSET) {
    for (let r = 0; r < perPair; r++, gi++) {
      const seed = 1000 + gi * 7919;
      for (const ph of ORDERS[gi % 3]) {
        const traceOn = ph === 'B';
        let mr = 0; Math.random = function () { mr++; return _MR(); };
        await session.post('Profiler.start');
        const a = process.hrtime.bigint();
        let out = null;
        try { out = playOne(pair, seed, traceOn); } catch (e) { C.games_threw++; if (!C.first_throw) C.first_throw = String(e && e.stack || e).slice(0, 300); }
        const dt = Number(process.hrtime.bigint() - a) / 1e6;
        const { profile } = await session.post('Profiler.stop');
        Math.random = _MR; C.math_random_calls_in_play += mr;
        acc[ph].profiles.push(profile);
        if (out) { acc[ph].games++; acc[ph].turns += out.S.turn || 0; acc[ph].ms += dt; acc[ph].digests.push(digestGame(out.S, out.res)); }
        else acc[ph].digests.push('THREW');
      }
    }
  }
  await session.post('Profiler.disable');
  session.disconnect();

  /* merge per-game profiles into one per phase: nodes keyed by call-frame path from the root */
  function merge(profiles) {
    const nodes = [{ id: 1, callFrame: { functionName: '(root)', scriptId: '0', url: '', lineNumber: -1, columnNumber: -1 }, children: [] }];
    const idx = new Map(); idx.set('', 1);
    const samples = [], timeDeltas = [];
    for (const p of profiles) {
      const byId = new Map(); for (const n of p.nodes) byId.set(n.id, n);
      const parent = new Map(); for (const n of p.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
      const pathKey = new Map();
      const resolve = (id) => {
        if (pathKey.has(id)) return pathKey.get(id);
        const n = byId.get(id);
        if (n.callFrame.functionName === '(root)' && !parent.has(id)) { pathKey.set(id, ['', 1]); return ['', 1]; }
        const [pk, pid] = resolve(parent.get(id));
        const cf = n.callFrame;
        const k = pk + '>' + cf.functionName + '@' + cf.url + ':' + cf.lineNumber + ':' + cf.columnNumber;
        let myId = idx.get(k);
        if (!myId) {
          myId = nodes.length + 1;
          nodes.push({ id: myId, callFrame: { functionName: cf.functionName, scriptId: '0', url: cf.url, lineNumber: cf.lineNumber, columnNumber: cf.columnNumber }, children: [], positionTicks: [] });
          nodes[pid - 1].children.push(myId);
          idx.set(k, myId);
        }
        /* line ticks carried through the merge, so self time inside a giant function can be located */
        if (n.positionTicks && n.positionTicks.length) {
          const tgt = nodes[myId - 1];
          for (const pt of n.positionTicks) {
            const e = tgt.positionTicks.find(x => x.line === pt.line);
            if (e) e.ticks += pt.ticks; else tgt.positionTicks.push({ line: pt.line, ticks: pt.ticks });
          }
        }
        pathKey.set(id, [k, myId]); return [k, myId];
      };
      for (let i = 0; i < p.samples.length; i++) { samples.push(resolve(p.samples[i])[1]); timeDeltas.push(p.timeDeltas[i] || 0); }
    }
    return { nodes, startTime: 0, endTime: timeDeltas.reduce((a, b) => a + b, 0), samples, timeDeltas };
  }

  const RESULT = { generated: new Date().toISOString(), by: 'data/verification/opt-plan-2026-09-11/profile_turn.js (ENGINE, planning only)',
    what: 'Share of CPU samples per function while playing rollout games (RL.runPlayout from a fresh battleInit), trace off (A1, A2) and trace on (B).',
    contended: 'Machine busy; run under tools/lownode.cmd (BELOWNORMAL). Shares are the figures of record; absolute ms are CONTENDED.',
    ...REL.stamp(), team_store: TEAM_STORE, team_store_bo3_sha12: sha12(fs.readFileSync(D(TEAM_STORE, 'games.bo3.jsonl'))),
    census: CENSUS, cap: CAP, explore: 1.0, foe_policy: 'uniform', sampling_interval_us: INTERVAL_US,
    body_builder: 'MEDI.buildMonFromSet (release export), sp {}, sheet nature; the brought four when the store names them',
    node: process.version, cores: os.cpus().length, pairs: PAIRSET.map(p => ({ id: p.id, line: p.line })), per_pair: perPair,
    flags: process.argv.slice(2), counters: C, phases: {} };

  const A = {};
  for (const ph of PH) {
    const prof = merge(acc[ph].profiles);
    fs.writeFileSync(path.join(OUTDIR, 'phase-' + ph + '.cpuprofile.gz'), zlib.gzipSync(JSON.stringify(prof)));
    A[ph] = analyse(prof);
    RESULT.phases[ph] = { games: acc[ph].games, turns: acc[ph].turns, mean_turns: +(acc[ph].turns / Math.max(1, acc[ph].games)).toFixed(2),
      ms_contended: +acc[ph].ms.toFixed(1), ms_per_turn_contended: +(acc[ph].ms / Math.max(1, acc[ph].turns)).toFixed(4),
      samples: A[ph].samples, self_top: A[ph].self_top, inclusive_top: A[ph].inclusive_top, by_file_self: A[ph].by_file_self };
  }
  /* equivalence across phases */
  const same = (x, y) => x.every((d, i) => d === y[i]);
  RESULT.equivalence = { A1_eq_A2: same(acc.A1.digests, acc.A2.digests), A1_eq_B: same(acc.A1.digests, acc.B.digests),
    games: acc.A1.digests.length, mismatches_A1_B: acc.A1.digests.filter((d, i) => d !== acc.B.digests[i]).length,
    mismatches_A1_A2: acc.A1.digests.filter((d, i) => d !== acc.A2.digests[i]).length,
    math_random_calls_in_play: C.math_random_calls_in_play };
  /* noise floor on a share: A1 vs A2, over the union of the top self and inclusive functions */
  const nf = (m1, m2, n1, n2) => { const ks = new Set([...[...m1.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(e => e[0])]);
    let max = 0, worst = null; for (const k of ks) { const d = Math.abs(100 * (m1.get(k) || 0) / n1 - 100 * (m2.get(k) || 0) / n2); if (d > max) { max = d; worst = k; } }
    return { max_abs_pct_points: +max.toFixed(2), at: worst }; };
  RESULT.noise_floor_share = { self: nf(A.A1._self, A.A2._self, A.A1.samples, A.A2.samples),
                               inclusive: nf(A.A1._incl, A.A2._incl, A.A1.samples, A.A2.samples) };
  /* the trace's cost, as a within-run ratio (contention common-mode by interleave) */
  const mpt = (ph) => RESULT.phases[ph].ms_per_turn_contended;
  RESULT.trace_cost_ratio_B_over_A = +(mpt('B') / ((mpt('A1') + mpt('A2')) / 2)).toFixed(3);
  RESULT.samples_per_turn = { A1: +(A.A1.samples / Math.max(1, acc.A1.turns)).toFixed(2), B: +(A.B.samples / Math.max(1, acc.B.turns)).toFixed(2),
                              A2: +(A.A2.samples / Math.max(1, acc.A2.turns)).toFixed(2) };
  RESULT.elapsed_s = Math.round((Date.now() - T0) / 1000);
  RESULT.counters = C;

  for (const ph of PH) {
    const R = RESULT.phases[ph];
    console.log('');
    console.log('  PHASE ' + ph + (ph === 'B' ? ' (trace ON)' : ' (trace off)') + ': ' + R.games + ' games, ' + R.turns + ' turns (mean ' + R.mean_turns + '), ' + R.samples + ' samples, ' + R.ms_per_turn_contended + ' ms/turn CONTENDED');
    if (ph === 'B') continue;
    console.log('    SELF top 25');
    for (const x of R.self_top.slice(0, 25)) console.log('      ' + String(x.pct).padStart(6) + '%  ' + x.name);
    console.log('    INCLUSIVE top 30');
    for (const x of R.inclusive_top.slice(0, 30)) console.log('      ' + String(x.pct).padStart(6) + '%  ' + x.name);
  }
  console.log('');
  console.log('  equivalence ' + JSON.stringify(RESULT.equivalence));
  console.log('  noise floor on a share (A1 vs A2) ' + JSON.stringify(RESULT.noise_floor_share));
  console.log('  trace cost ratio B/A (ms per turn) ' + RESULT.trace_cost_ratio_B_over_A + '   samples/turn ' + JSON.stringify(RESULT.samples_per_turn));
  console.log('  counters ' + JSON.stringify(C));
  console.log('  elapsed ' + RESULT.elapsed_s + ' s');
  if (!SMOKE) { fs.writeFileSync(path.join(OUTDIR, 'profile-summary.json'), JSON.stringify(RESULT, null, 2) + '\n'); console.log('  wrote ' + path.join(OUTDIR, 'profile-summary.json')); }
  else console.log('  (smoke: summary not written)');
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
