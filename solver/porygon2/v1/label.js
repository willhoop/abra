/* ABRA-HEAP: 2048
 * solver/porygon2/v1/label.js — SEARCH-IMPROVED value labels for PORYGON2 v1, on a frozen release.
 *
 *   node solver/porygon2/v1/label.js --release <id> --selfplay <dir>[,<dir>…] --out <dir> [--workers 4] [--per-game 2]
 *        [--k 6] [--passes 12] [--seed 1] [--leaf solver/machamp/models/gen5/porygon2-gen5.json] [--limit N]
 *   (a worker: the same with --shard i --shards n; the coordinator forks them)
 *
 * For each self-play game (replayed EXACTLY, solver/porygon2/v1/replay.js), --per-game positions are drawn by a seeded
 * hash of the game key, and each gets one label:
 *   exact   a small endgame (1v1, 2v1 or 1v2 live mons; EVERY such position of every game is labelled, on top of the
 *           --per-game drawn ones): a recursive simultaneous-move solve to the end of the game on the TRUE battle,
 *           every joint of both sides (legalActions, no pruning), --chance dice per cell, SLOWKING's LP at every node,
 *           at most --exact-depth turns (2 by default; one turn when the root has more than 20 joint pairs). It is `exact` only if EVERY branch ended the game inside that depth (sampled
 *           dice: exact up to the chance sample, and said so); otherwise the same solve with gen5's leaf at the
 *           horizon is written as `deep2` (a two-ply label, still search-improved).
 *   deep    any other position: MILTANK with a WIDER and LONGER search than self-play played — k × k candidates (1
 *           reserved switch row), a fixed --passes pass cap (k² playouts per pass; replayable, no clock), depth 0, the
 *           champion's leaf — run from BOTH seats; the label is the mean of side A's root value and 1 − side B's.
 * Every label is in p1's frame. The TRUE battle is searched (the recorded game is omniscient self-play), which is the
 * standard "oracle target" for a value net that is later fed only the public view: its regression target is then the
 * expected value given what it sees.
 *
 * Output <out>/labels-<shard>.jsonl: { key, t, kind, v, vA, vB, turn, alive:[p1,p2], passes, playouts, ms } and
 * <out>/labels.summary.json (flags, the release stamp, the counters). The keys are build.js's (dir|g|run_seed, t).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const cp = require('child_process');
const os = require('os');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..', '..');
const REL_ID = flag('--release', null);
const DIRS = String(flag('--selfplay', '')).split(',').filter(Boolean).map(d => path.resolve(ROOT, d));
const OUT = path.resolve(ROOT, flag('--out', 'solver/out/p2v1/labels'));
const PER = +flag('--per-game', 2), K = +flag('--k', 6), PASSES = +flag('--passes', 12), SEED = +flag('--seed', 1);
const CHANCE = +flag('--chance', 3), EXACT_DEPTH = +flag('--exact-depth', 2), LIMIT = +flag('--limit', 0) || Infinity;
const LEAF = path.resolve(ROOT, flag('--leaf', 'solver/machamp/models/gen5/porygon2-gen5.json'));
const MAG = flag('--mag', 'solver/machamp/models/gen5/mag-gen5.json'), DODUO = flag('--doduo', 'solver/machamp/models/gen5/doduo-gen5.json');
const h32 = s => crypto.createHash('sha256').update(s).digest().readUInt32BE(0);

function* records(dir) {
  for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl\.gz$/.test(f)).sort()) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8');
    for (const line of txt.split('\n')) if (line) yield JSON.parse(line);
  }
}

function worker(shard, shards) {
  try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
  require('../../arena/env.js');
  const ENGINE = require('../../arena/engine.js').load(REL_ID);
  const API = ENGINE.API, M = API.M;
  const T = require('../../arena/teams.js');
  const prior = require('../../mag/infer.js').load({ mag: path.resolve(ROOT, MAG), doduo: path.resolve(ROOT, DODUO) });
  const PA = require('../../miltank/prior_adapter.js').create(API, prior);
  const RP = require('./replay.js').create(API, { PA });
  const R = require('../../miltank/rollout.js').create(API, { buildBody: T.buildBody });
  const MT = require('../../miltank/search.js').create(API, { prior: PA, rollout: R });
  const SK = require('../../slowking/matrix.js');
  const L = require('../leaf.js').create(API, { model: LEAF });
  const c = { games: 0, positions: 0, exact: 0, deep2: 0, deep: 0, errors: 0, search_fallbacks: 0, exact_nodes: 0, exact_steps: 0 };
  const out = path.join(OUT, `labels-${shard}.jsonl`);
  fs.writeFileSync(out, '');
  const t0 = Date.now();
  const liveCount = (S, sd) => (sd === 'A' ? S.sfA : S.sfB).team.filter(m => !m.fainted && m.curHP > 0).length;

  /* the recursive solve: value for side A of S (not mutated); `st.exact` goes false when a horizon leaf is used */
  function solve(S, depth, sheets, seed, st) {
    st.nodes++;
    if (API.isTerminal(S)) return API.winner(S);
    if (depth === 0) { st.exact = false; return L.value(S, sheets); }
    const jA = API.legalActions(S, 'A').joint, jB = API.legalActions(S, 'B').joint;
    const A = jA.map(() => new Array(jB.length).fill(0));
    for (let i = 0; i < jA.length; i++) for (let j = 0; j < jB.length; j++) {
      let s = 0;
      for (let d = 0; d < CHANCE; d++) {
        const S2 = API.clone(S);
        API.stepInPlace(S2, jA[i], jB[j], API.makeRng(seed * 7919 + d * 104729 + depth));
        st.steps++;
        s += solve(S2, depth - 1, sheets, seed + d + 1, st);
      }
      A[i][j] = s / CHANCE;
    }
    if (jA.length === 1 && jB.length === 1) return A[0][0];
    return SK.solveLP(A).value;
  }

  let gi = -1;
  for (const dir of DIRS) {
    const dkey = path.relative(ROOT, dir).split(path.sep).join('/');
    for (const rec of records(dir)) {
      gi++;
      if (gi % shards !== shard) continue;
      if (c.games >= LIMIT) break;
      const gkey = dkey + '|' + rec.g + '|' + rec.run_seed;
      const n = rec.hist.length;
      if (!n || rec.vA == null) continue;
      /* the positions to label: PER distinct turn indices by a seeded hash of the game key */
      const want = new Set();
      for (let r = 0; want.size < Math.min(PER, n) && r < 50; r++) want.add(h32(SEED + ':' + gkey + ':' + r) % n);
      c.games++;
      const lines = [];
      try {
        for (const pos of RP.positions(rec, ENGINE.id)) {
          const S = pos.S;
          const la = liveCount(S, 'A'), lb = liveCount(S, 'B');
          const endgame = la + lb <= 3 && la >= 1 && lb >= 1;
          if (!want.has(pos.t) && !endgame) continue;      // every small endgame is labelled, plus PER drawn positions
          const t1 = Date.now();
          let o;
          if (endgame) {
            const st = { exact: true, nodes: 0, steps: 0 };
            /* the width guard: a root with more than 20 joint pairs is solved one turn deep (the cost is cells^depth) */
            const cells = API.legalActions(S, 'A').joint.length * API.legalActions(S, 'B').joint.length;
            const v = solve(API.clone(S), cells <= 20 ? EXACT_DEPTH : 1, rec.sheets, h32('x' + gkey + pos.t), st);
            c.exact_nodes += st.nodes; c.exact_steps += st.steps;
            o = { kind: st.exact ? 'exact' : 'deep2', v, nodes: st.nodes, steps: st.steps };
            c[o.kind]++;
          } else {
            const ctx = { G: pos.ctx.G, hist: pos.ctx.hist.slice() };
            const opt = side => ({ budgetMs: 600000, maxPasses: PASSES, k1: K, k2: K, reserveSwitch: 1, depth: 0, leaf: 'pory2', leafModel: LEAF,
              coin: M.rngStreams({ seed: h32(side + gkey + pos.t) }).any });
            const rA = MT.decide(API.clone(S), 'A', ctx, opt('A'));
            const rB = MT.decide(API.clone(S), 'B', ctx, opt('B'));
            const ok = r => r.info && r.info.value != null && !r.info.fallback;
            if ((!ok(rA) && !(rA.info && rA.info.forced)) || (!ok(rB) && !(rB.info && rB.info.forced))) c.search_fallbacks++;
            const vs = [];
            if (ok(rA)) vs.push(rA.info.value);
            if (ok(rB)) vs.push(1 - rB.info.value);
            if (!vs.length) continue;                    // both seats forced: nothing was searched, no label
            o = { kind: 'deep', v: vs.reduce((a, b) => a + b, 0) / vs.length, vA: ok(rA) ? rA.info.value : null, vB: ok(rB) ? rB.info.value : null,
                  playouts: ((rA.info && rA.info.playouts) || 0) + ((rB.info && rB.info.playouts) || 0) };
            c.deep++;
          }
          c.positions++;
          lines.push(JSON.stringify(Object.assign({ key: gkey, t: pos.t, turn: S.turn + 1, alive: [la, lb] }, o, { v: +o.v.toFixed(6), ms: Date.now() - t1 })));
        }
      } catch (e) { c.errors++; if (c.errors < 5) console.error('label:', gkey, String(e && e.stack || e).slice(0, 300)); }
      if (lines.length) fs.appendFileSync(out, lines.join('\n') + '\n');
      if (c.games % 25 === 0) console.log(`  [label ${shard}] ${c.games} games ${c.positions} labels (exact ${c.exact}, deep2 ${c.deep2}, deep ${c.deep}) ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  fs.writeFileSync(out + '.summary.json', JSON.stringify({ shard, counts: c, replay: RP.COUNTERS, search: MT.COUNTERS, rollout: R.COUNTERS, engine_release: ENGINE.id, release_stamp: ENGINE.stamp, seconds: (Date.now() - t0) / 1000 }));
  console.log(`  [label ${shard}] done ${JSON.stringify(c)}`);
}

async function coordinator() {
  const W = +flag('--workers', 3);
  if (W > 4) throw new Error('label: at most 4 workers');
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  const rest = argv.filter((a, i) => a !== '--workers' && argv[i - 1] !== '--workers');
  const exits = await Promise.all(Array.from({ length: W }, (_, i) => new Promise(res => {
    const ch = cp.fork(__filename, [...rest, '--shard', String(i), '--shards', String(W)], { execArgv: ['--max-old-space-size=2048'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    console.log('label: shard ' + i + ' pid ' + ch.pid);
    ch.on('exit', code => res({ shard: i, code, pid: ch.pid }));
  })));
  const sums = exits.map(e => { try { return JSON.parse(fs.readFileSync(path.join(OUT, `labels-${e.shard}.jsonl.summary.json`), 'utf8')); } catch (err) { return null; } });
  const counts = {};
  for (const s of sums.filter(Boolean)) for (const k in s.counts) counts[k] = (counts[k] || 0) + s.counts[k];
  const first = sums.find(Boolean) || {};
  const summary = { what: 'PORYGON2 v1 search-improved labels (solver/porygon2/v1/label.js)', engine_release: first.engine_release, release_stamp: first.release_stamp,
    flags: { selfplay: DIRS.map(d => path.relative(ROOT, d).split(path.sep).join('/')), per_game: PER, k: K, passes: PASSES, chance: CHANCE, exact_depth: EXACT_DEPTH, seed: SEED,
      leaf: path.relative(ROOT, LEAF).split(path.sep).join('/'), mag: MAG, doduo: DODUO, workers: W, limit: LIMIT === Infinity ? null : LIMIT },
    counts, exits, wall_s: (Date.now() - t0) / 1000 };
  fs.writeFileSync(path.join(OUT, 'labels.summary.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ counts, wall_s: summary.wall_s }));
  return exits.some(e => e.code !== 0) ? 1 : 0;
}

if (require.main === module) {
  if (!REL_ID) { console.error('label: --release is required'); process.exit(2); }
  if (flag('--shard', null) != null) { worker(+flag('--shard'), +flag('--shards', 1)); process.exit(0); }
  coordinator().then(c => process.exit(c), e => { console.error(e); process.exit(1); });
}
