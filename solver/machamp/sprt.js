/* solver/machamp/sprt.js — a PRE-REGISTERED sequential probability ratio test: candidate X vs champion Y, paired
 * seeds, a frozen release, stopped by the test and never by a person.
 *
 *   cmd.exe /c tools\lownode.cmd solver\machamp\sprt.js --release <id> --x <spec.json> --y <spec.json>
 *        --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed S --workers 3
 *        --team-store <dir> --out <result.json>
 *
 * THE UNIT IS A PAIR. Pair i plays test team pair (i mod the test split) twice on one battle seed with the seats
 * swapped (solver/mew/play.js --mode match --cycle), so a pair's score is 0, 1/2 or 1 and the seat/team luck of the
 * pair cancels. The statistic is the normal-approximation GSPRT on pair scores that Fishtest uses for pentanomial
 * data (trinomial here: no draws in this engine's rules):
 *     s(elo) = 1 / (1 + 10^(−elo/400))
 *     LLR(N) = N · (s1 − s0) · (2·x̄ − s0 − s1) / (2·σ²)        x̄, σ² = mean and variance of the N pair scores
 *     accept H1 (X is stronger by elo1) when LLR ≥ ln((1−β)/α); accept H0 when LLR ≤ ln(β/(1−α))
 *
 * READ ONLY AT THE BOUND. The workers play pairs i ≡ shard (mod workers) and write each finished pair to disk. This
 * coordinator walks the pairs IN INDEX ORDER (never in completion order, so the stopping point does not depend on
 * which worker is faster) and evaluates the LLR after every pair of the longest finished prefix; the first index at
 * which it crosses a bound is the stopping point, and games played past it are reported but not counted. It prints
 * NO interim LLR — only the pair count, so a person watching cannot peek. No bound by --max-games = INCONCLUSIVE.
 * A pair with an errored game is excluded and counted.
 *
 * The result JSON carries the pre-registered parameters, the stopping index, the verdict, the games used, the win
 * rate over those games with a Wilson 95% interval (caption: an interval taken at a data-dependent stopping time is
 * conditional on the stop and slightly optimistic), the release stamp, both specs and their digests, and the pool.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const { wilson } = require('./gate.js');

const sOf = elo => 1 / (1 + Math.pow(10, -elo / 400));
function llr(scores, elo0, elo1) {
  const N = scores.length;
  if (N < 2) return 0;
  const m = scores.reduce((a, b) => a + b, 0) / N;
  const v = scores.reduce((a, b) => a + (b - m) * (b - m), 0) / N;
  if (v <= 0) return 0;
  const s0 = sOf(elo0), s1 = sOf(elo1);
  return N * (s1 - s0) * (2 * m - s0 - s1) / (2 * v);
}
/* walk the pairs in index order and return the first stop, or null */
function decide(pairScores, o) {
  const A = Math.log(o.beta / (1 - o.alpha)), B = Math.log((1 - o.beta) / o.alpha);
  const used = [];
  for (let i = 0; i < pairScores.length; i++) {
    if (pairScores[i] === undefined) return { stop: null, prefix: i };          // not played yet: wait
    if (pairScores[i] === null) continue;                                      // errored pair: excluded
    used.push(pairScores[i]);
    const L = llr(used, o.elo0, o.elo1);
    if (L >= B) return { stop: i, verdict: 'H1', llr: L, pairs: used.length, A, B };
    if (L <= A) return { stop: i, verdict: 'H0', llr: L, pairs: used.length, A, B };
  }
  return { stop: null, prefix: pairScores.length, llr: llr(used, o.elo0, o.elo1), pairs: used.length, A, B };
}

async function main() {
  const o = { release: flag('--release'), x: flag('--x'), y: flag('--y'), elo0: +flag('--elo0', 0), elo1: +flag('--elo1', 20),
    alpha: +flag('--alpha', 0.05), beta: +flag('--beta', 0.05), maxGames: +flag('--max-games', 2000), seed: +flag('--seed', 1),
    workers: +flag('--workers', 3), store: flag('--team-store', null), out: path.resolve(ROOT, flag('--out')), cap: +flag('--cap', 50) };
  if (!o.release || !o.x || !o.y || !flag('--out')) throw new Error('usage: --release --x --y --out');
  if (o.workers > 3) throw new Error('sprt: at most 3 workers');
  const NP = Math.floor(o.maxGames / 2);
  const dir = o.out.replace(/\.json$/, '') + '.shards';
  fs.mkdirSync(dir, { recursive: true });
  const t0 = Date.now(), started = new Date().toISOString();
  const kids = [];
  for (let i = 0; i < o.workers; i++) {
    const f = path.join(dir, `shard-${i}.jsonl`);
    if (fs.existsSync(f)) fs.unlinkSync(f);
    const ch = cp.fork(path.join(ROOT, 'solver', 'mew', 'play.js'), ['--mode', 'match', '--cycle', '--release', o.release, '--x', path.resolve(ROOT, o.x), '--y', path.resolve(ROOT, o.y),
      '--pairs', String(NP), '--pair-seed', '1', '--seed', String(o.seed), '--shard', String(i), '--shards', String(o.workers), '--cap', String(o.cap),
      '--out', f, ...(o.store ? ['--team-store', o.store] : [])], { execArgv: ['--max-old-space-size=1536'], stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    kids.push({ ch, f, code: null });
    ch.on('exit', code => { kids[i].code = code; });
    console.log(`sprt: shard ${i} pid ${ch.pid}`);
  }
  const read = () => {
    const per = [];
    for (const k of kids) {
      let txt = ''; try { txt = fs.readFileSync(k.f, 'utf8'); } catch (e) {}
      for (const l of txt.split('\n')) { if (!l) continue; try { per.push(JSON.parse(l)); } catch (e) { /* a line mid-write: the next poll reads it */ } }
    }
    const byPair = new Map();
    for (const p of per) { const a = byPair.get(p.pi) || []; a.push(p); byPair.set(p.pi, a); }
    const scores = new Array(NP);
    for (const [pi, a] of byPair) {
      if (a.length < 2) continue;
      scores[pi] = a.some(g => g.vX == null) ? null : (a[0].vX + a[1].vX) / 2;
    }
    return { per, byPair, scores };
  };
  let d, R;
  for (;;) {
    await new Promise(r => setTimeout(r, 20000));
    R = read();
    d = decide(R.scores, o);
    const done = R.scores.filter(v => v !== undefined).length;
    const alive = kids.filter(k => k.code === null).length;
    console.log(`sprt: ${done} of ${NP} pairs finished, ${alive} workers running, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
    if (d.stop != null || !alive) break;
  }
  for (const k of kids) if (k.code === null) { try { k.ch.kill(); } catch (e) {} }   // our own children, by handle
  const cut = d.stop != null ? d.stop : NP - 1;
  const counted = R.per.filter(p => p.pi <= cut && R.scores[p.pi] != null);
  const W = counted.filter(p => p.vX === 1).length, L = counted.filter(p => p.vX === 0).length, D = counted.filter(p => p.vX === 0.5).length;
  const n = W + L + D;
  /* the stamp and the pool are read here, from the same release and store the workers opened (killed workers write no summary) */
  require('../arena/env.js');
  const ENGINE = require('../arena/engine.js').load(o.release);
  const P = require('../mew/pairs.js').load({ teamStore: o.store || undefined });
  const base = require('../mew/pairs.js').pick(P.test, P.test.length, 1);
  const sum = { release_stamp: ENGINE.stamp, pool: { pool_source: P.kind === 'team-store' ? { kind: 'team-store', file: P.file, file_sha256: P.file_sha256, pool_digest: P.pool_digest } : { kind: 'human-dataset', file: P.file },
    test_pairs: P.test.length, cycled_ids_sha256: P.ids_sha256(base) } };
  const sha = f => require('crypto').createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, f))).digest('hex').slice(0, 16);
  const spec = f => { const s = JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8')); return { file: f, spec: s, digests: Object.fromEntries(['mag', 'doduo', 'pory2'].filter(k => s[k]).map(k => [k, sha(s[k])])) }; };
  const result = {
    what: 'MACHAMP SPRT (solver/machamp/sprt.js)', started, finished: new Date().toISOString(),
    preregistered: { elo0: o.elo0, elo1: o.elo1, alpha: o.alpha, beta: o.beta, max_games: o.maxGames, unit: 'pair of games on one battle seed, seats swapped', statistic: 'normal-approximation GSPRT on pair scores (Fishtest)' },
    engine_release: o.release, flags: o, x: spec(o.x), y: spec(o.y),
    verdict: d.stop == null ? 'INCONCLUSIVE (no bound crossed by the game budget)' : d.verdict === 'H1' ? `H1 — X is stronger (elo1 = +${o.elo1} accepted)` : `H0 — X is not stronger (elo0 = ${o.elo0} accepted)`,
    llr_at_stop: d.llr, bounds: [d.A, d.B], stop_pair_index: d.stop, pairs_used: d.pairs, games_used: n,
    excluded_errored_pairs: R.scores.slice(0, cut + 1).filter(v => v === null).length,
    games_played_total: R.per.length, games_played_after_stop_not_counted: R.per.filter(p => p.pi > cut).length,
    result: { W, D, L, score_x: n ? (W + D / 2) / n : null, ci95_x: wilson(W + D / 2, n), ci_caption: 'Wilson 95% at a data-dependent stopping time: conditional on the stop, slightly optimistic' },
    elo_estimate: n ? (() => { const sc = (W + D / 2) / n; return -400 * Math.log10(1 / Math.min(Math.max(sc, 1e-6), 1 - 1e-6) - 1); })() : null,
    pool: sum ? sum.pool : null, release_stamp: sum ? sum.release_stamp : null,
    worker_exits: kids.map(k => k.code), wall_s: (Date.now() - t0) / 1000,
  };
  fs.writeFileSync(o.out, JSON.stringify(result, null, 1));
  console.log(JSON.stringify({ verdict: result.verdict, games_used: n, pairs_used: d.pairs, result: result.result, llr: d.llr }, null, 1));
  return 0;
}

if (require.main === module) main().then(c => process.exit(c), e => { console.error(e); process.exit(1); });
module.exports = { llr, decide, sOf };
