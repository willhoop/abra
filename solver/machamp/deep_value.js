/* ABRA-HEAP: 2048
 * solver/machamp/deep_value.js — a DEEPER value for every recorded self-play position, independent of the net being
 * trained: replay the game exactly, then from each position play R short rollouts under the HUMAN-CLONE policy.
 *
 *   node solver/machamp/deep_value.js --release <id> --selfplay <dir>[,<dir>…] --out <dir> [--workers 3]
 *        [--rollouts 2] [--depth 3] [--seed 1] [--leaf solver/porygon2/model/porygon2-v0.json]
 *   (a worker: the same with --shard i --shards n; the coordinator forks them)
 *
 * WHY. Round 2's PORYGON2 target was 0.5·z + 0.5·v, and at MILTANK depth 0 the root value v IS PORYGON2 one turn
 * ahead — the net was being taught its own opinion. This replaces v with a value the trained net did not produce:
 *   v_deep = mean over R rollouts of: `depth` turns in which BOTH sides sample their joint from DODUO v1 (the human
 *   clone, frozen — never the candidate), then the game's own result if it ended, else PORYGON2 v0 (frozen) at the
 *   leaf. A rollout is 3 real turns of human-like play from the TRUE position (hidden information included).
 *
 * EXACT REPLAY. A game is rebuilt from its record: the same sheets and brought fours, the same battle seed, and at
 * each turn the legal joint whose dataset actions equal the recorded ones. Before every position the rebuilt public
 * state must equal the recorded one byte for byte; a game that departs is dropped from that turn on and COUNTED
 * (`replay_mismatch`). The rollout policy draws from `slotSupport` (a subset of legalActions, pinned by
 * solver/tests/test-miltank.js) scored by DODUO; the draws use their own seeded coin, never the game's dice.
 *
 * Output: <out>/deep-<shard>.jsonl — one line per position { dir, g, run_seed, t, v, n } (v for p1), plus
 * <out>/deep.summary.json with the counters and the release stamp.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const cp = require('child_process');
const os = require('os');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const REL_ID = flag('--release', null);
const DIRS = String(flag('--selfplay', '')).split(',').filter(Boolean).map(d => path.resolve(ROOT, d));
const OUT = path.resolve(ROOT, flag('--out', 'solver/out/machamp/deep'));
const RO = +flag('--rollouts', 2), DEPTH = +flag('--depth', 3), SEED = +flag('--seed', 1);
const LEAF = path.resolve(ROOT, flag('--leaf', 'solver/porygon2/model/porygon2-v0.json'));
/* DELIBERATE BREAK (env MACHAMP_BREAK=replay): the replay steps the game with a different battle seed. The replay
 * check must drop the games (replay_mismatch > 0); solver/tests/test-machamp.js DEEP must go red. */
const BREAK = process.env.MACHAMP_BREAK || '';

function* records(dir) {
  for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl\.gz$/.test(f)).sort()) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8');
    for (const line of txt.split('\n')) if (line) yield JSON.parse(line);
  }
}

function worker(shard, shards) {
  try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
  require('../arena/env.js');
  const ENGINE = require('../arena/engine.js').load(REL_ID);
  const API = ENGINE.API, M = API.M;
  const T = require('../arena/teams.js');
  const PA = require('../miltank/prior_adapter.js').create(API, require('../mag/infer.js').load());   // DODUO v1, frozen
  const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
  const L = require('../porygon2/leaf.js').create(API, { model: LEAF });
  const c = { games: 0, positions: 0, replay_mismatch: 0, no_joint: 0, rollouts: 0, terminal: 0, leaf: 0, errors: 0 };
  const out = path.join(OUT, `deep-${shard}.jsonl`);
  fs.writeFileSync(out, '');
  const t0 = Date.now();
  const key = o => JSON.stringify(o);

  function sampleJoint(ctx, S, side, coin) {
    const own = side === 'A' ? S.actA : S.actB;
    const sup = [0, 1].map(k => (k < own.length ? R.slotSupport(S, side, k) : [{ kind: 'pass' }]));
    const joints = [];
    for (const a of sup[0]) for (const b of sup[1]) {
      if (a.mega && b.mega) continue;
      if (a.kind === 'switch' && b.kind === 'switch' && a.to === b.to) continue;
      joints.push([a, b]);
    }
    if (!joints.length) joints.push([sup[0][0], { kind: 'pass' }]);
    const s = PA.scoreJoints(ctx, S, side, side, { slots: sup, joint: joints });
    let z = 0; for (const x of s) z += x;
    let u = coin() * z;
    for (let i = 0; i < s.length; i++) { u -= s[i]; if (u <= 0) return joints[i]; }
    return joints[joints.length - 1];
  }
  function rollout(S0, ctx0, sheets, seed) {
    const S = API.clone(S0);
    const ctx = { G: ctx0.G, hist: ctx0.hist.slice() };
    const rng = API.makeRng(seed), coin = M.rngStreams({ seed: seed + 7 }).any;
    for (let d = 0; d < DEPTH && !API.isTerminal(S); d++) {
      const jA = sampleJoint(ctx, S, 'A', coin), jB = sampleJoint(ctx, S, 'B', coin);
      PA.record(ctx, S, jA, jB);
      API.stepInPlace(S, jA, jB, rng);
    }
    c.rollouts++;
    if (API.isTerminal(S)) { c.terminal++; return API.winner(S); }
    c.leaf++; return L.value(S, sheets);
  }

  let gi = -1;
  for (const dir of DIRS) {
    for (const rec of records(dir)) {
      gi++;
      if (gi % shards !== shard) continue;
      if (rec.release !== ENGINE.id || rec.vA == null) continue;
      c.games++;
      try {
        const G = { id: rec.id, sheets: rec.sheets, brought: rec.brought };
        const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
        const rng = API.makeRng(BREAK === 'replay' ? rec.battle_seed + 1 : rec.battle_seed);
        const S = API.newBattle(a.team, b.team, { rng });
        const ctx = PA.newGame(G);
        const lines = [];
        for (let t = 0; t < rec.hist.length; t++) {
          if (key(PA.publicState(ctx, S)) !== key(rec.hist[t].state)) { c.replay_mismatch++; break; }
          let v = 0;
          for (let r = 0; r < RO; r++) v += rollout(S, ctx, rec.sheets, SEED * 1000003 + gi * 997 + t * 31 + r);
          lines.push(JSON.stringify({ dir: path.relative(ROOT, dir).split(path.sep).join('/'), g: rec.g, run_seed: rec.run_seed, t, v: v / RO, n: RO }));
          c.positions++;
          const want = rec.hist[t].actions;
          const pick = side => API.legalActions(S, side).joint.find(j => key(PA.datasetActions(ctx, S, side, j)) === key(want[side === 'A' ? 'p1' : 'p2']));
          const jA = pick('A'), jB = pick('B');
          if (!jA || !jB) { c.no_joint++; break; }
          PA.record(ctx, S, jA, jB);
          API.stepInPlace(S, jA, jB, rng);
        }
        if (lines.length) fs.appendFileSync(out, lines.join('\n') + '\n');
      } catch (e) { c.errors++; if (c.errors < 5) console.error('deep_value:', rec.id, String(e && e.stack || e).slice(0, 300)); }
      if (c.games % 50 === 0) console.log(`  [deep ${shard}] ${c.games} games ${c.positions} positions mismatch ${c.replay_mismatch} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  fs.writeFileSync(out + '.summary.json', JSON.stringify({ shard, counts: c, engine_release: ENGINE.id, release_stamp: ENGINE.stamp, seconds: (Date.now() - t0) / 1000, break: BREAK || null }));
  console.log(`  [deep ${shard}] done ${JSON.stringify(c)}`);
}

async function coordinator() {
  const W = +flag('--workers', 3);
  if (W > 4) throw new Error('deep_value: at most 4 workers');
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  const rest = argv.filter((a, i) => !['--workers'].includes(a) && argv[i - 1] !== '--workers');
  const exits = await Promise.all(Array.from({ length: W }, (_, i) => new Promise(res => {
    const ch = cp.fork(__filename, [...rest, '--shard', String(i), '--shards', String(W)], { execArgv: ['--max-old-space-size=2048'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    console.log('deep_value: shard ' + i + ' pid ' + ch.pid);
    ch.on('exit', code => res({ shard: i, code, pid: ch.pid }));
  })));
  const sums = exits.map(e => { try { return JSON.parse(fs.readFileSync(path.join(OUT, `deep-${e.shard}.jsonl.summary.json`), 'utf8')); } catch (err) { return null; } });
  const counts = {};
  for (const s of sums.filter(Boolean)) for (const k in s.counts) counts[k] = (counts[k] || 0) + s.counts[k];
  const first = sums.find(Boolean) || {};
  const summary = { what: 'deep rollout values (solver/machamp/deep_value.js)', engine_release: first.engine_release, release_stamp: first.release_stamp,
    flags: { selfplay: DIRS.map(d => path.relative(ROOT, d).split(path.sep).join('/')), rollouts: RO, depth: DEPTH, seed: SEED, leaf: path.relative(ROOT, LEAF).split(path.sep).join('/'), workers: W, policy: 'DODUO v1 sampled, both sides' },
    counts, exits, wall_s: (Date.now() - t0) / 1000 };
  fs.writeFileSync(path.join(OUT, 'deep.summary.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ counts, wall_s: summary.wall_s }));
  return exits.some(e => e.code !== 0) ? 1 : 0;
}

if (require.main === module) {
  if (!REL_ID) { console.error('deep_value: --release is required'); process.exit(2); }
  if (flag('--shard', null) != null) { worker(+flag('--shard'), +flag('--shards', 1)); process.exit(0); }
  coordinator().then(c => process.exit(c), e => { console.error(e); process.exit(1); });
}
