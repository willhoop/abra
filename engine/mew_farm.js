/* mew_farm.js — run MEW across every core, because the data constraint is a throughput constraint.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every "we do not have enough data" conclusion in this project applies to questions about PEOPLE:
 * does rating predict, do players tech, what will an opponent bring. Those need real replays and
 * genuinely need to wait.
 *
 * Questions about THE GAME have no data constraint at all — they only ever had a throughput
 * constraint, and nobody had measured it. Benchmarked 2026-07-25 on this machine:
 *
 *     10.9 games/sec per process · 12 processes -> ~131 games/sec
 *       1,000,000 games   ~2.1 hours
 *       5,000,000 games   ~10.6 hours
 *      20,000,000 games   ~42.5 hours     (Metamon trained on 20M self-play)
 *
 * So a Metamon-scale corpus is two days of laptop time, not a grant application. MEW was already
 * built and validated; it had simply never been run at scale.
 *
 * WHY SEPARATE PROCESSES rather than threads: the Showdown simulator is synchronous and CPU-bound,
 * so a single Node process pins one core no matter how high --conc goes. Concurrency inside a
 * process only overlaps the await points, which is why 8-way --conc gave 10.9 games/sec rather than
 * 80. Cores are the unit.
 *
 * SEEDS ARE DISJOINT BY CONSTRUCTION. Each worker owns a contiguous seed block, so two workers can
 * never generate the same battle, and any single game remains reproducible from its recorded seed.
 *
 *   SHOWDOWN_PATH=... node engine/mew_farm.js --n 1000000 --procs 12 --policy prior
 *   --keep-shards   leave the per-worker files instead of merging
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const LADDER = D('data', 'games.ladder.jsonl');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt;
}
const N = parseInt(arg('n', '100000'), 10);
/* Leave a core or two for the OS, or the machine becomes unusable and the run slows down anyway. */
const PROCS = parseInt(arg('procs', String(Math.max(1, Math.min(16, Math.floor(os.cpus().length * 0.75))))), 10);
const POLICY = arg('policy', 'prior');
const SEED0 = parseInt(arg('seed', String(Date.now() % 1e7)), 10);
const OUT = path.resolve(arg('out', D('data', 'games.selfplay.jsonl')));
const KEEP = process.argv.includes('--keep-shards');

if (path.resolve(OUT) === path.resolve(LADDER)) {
  console.error('REFUSING: --out is the ladder store. Self-play must never enter it.');
  process.exit(1);
}
if (!process.env.SHOWDOWN_PATH) {
  console.error('set SHOWDOWN_PATH to a BUILT pokemon-showdown master checkout');
  process.exit(2);
}

const per = Math.ceil(N / PROCS);
const shardDir = path.join(path.dirname(OUT), '.mew-shards');
fs.mkdirSync(shardDir, { recursive: true });

console.error(`MEW FARM: ${N.toLocaleString()} games across ${PROCS} processes (${per.toLocaleString()} each)`);
console.error(`  policy=${POLICY}  seeds ${SEED0}..${SEED0 + PROCS * per}  -> ${path.relative(ROOT, OUT)}`);

const started = Date.now();
const shards = [];
let done = 0, failed = 0;

const workers = Array.from({ length: PROCS }, (_, i) => new Promise((resolve) => {
  const shard = path.join(shardDir, `shard-${i}.jsonl`);
  shards.push(shard);
  try { fs.unlinkSync(shard); } catch (e) { /* fresh */ }
  /* Each worker owns seed block [SEED0 + i*per, SEED0 + (i+1)*per), so blocks cannot overlap. */
  const child = spawn(process.execPath, [
    D('engine', 'mew.js'),
    '--n', String(per),
    '--conc', '4',
    '--policy', POLICY,
    '--seed', String(SEED0 + i * per),
    '--out', shard,
  ], { env: process.env, stdio: ['ignore', 'ignore', 'pipe'] });

  let tail = '';
  child.stderr.on('data', d => { tail = (tail + d.toString()).slice(-400); });
  child.on('close', (code) => {
    if (code === 0) done++; else { failed++; console.error(`  worker ${i} exited ${code}: ${tail.trim().split('\n').pop()}`); }
    const secs = (Date.now() - started) / 1000;
    console.error(`  [${done + failed}/${PROCS}] worker ${i} finished (${secs.toFixed(0)}s elapsed)`);
    resolve();
  });
}));

Promise.all(workers).then(() => {
  const elapsed = (Date.now() - started) / 1000;
  if (!KEEP) {
    /* Merge, deduping by id. Disjoint seeds make collisions impossible in principle; the check is
     * cheap and this project has been bitten by duplicate ids four times. */
    const seen = new Set();
    const out = fs.createWriteStream(OUT, { flags: 'w' });
    let kept = 0, dupes = 0;
    for (const s of shards) {
      if (!fs.existsSync(s)) continue;
      for (const line of fs.readFileSync(s, 'utf8').split('\n')) {
        const t = line.trim(); if (!t) continue;
        let id;
        try { id = JSON.parse(t).id; } catch { continue; }
        if (seen.has(id)) { dupes++; continue; }
        seen.add(id); out.write(t + '\n'); kept++;
      }
    }
    out.end(() => {
      for (const s of shards) { try { fs.unlinkSync(s); } catch (e) {} }
      try { fs.rmdirSync(shardDir); } catch (e) {}
      const rate = kept / Math.max(1, elapsed);
      console.error(`\nMEW FARM done: ${kept.toLocaleString()} games in ${(elapsed / 60).toFixed(1)} min ` +
                    `(${rate.toFixed(0)}/sec, ${failed} workers failed, ${dupes} duplicate ids dropped)`);
      console.error(`  -> ${path.relative(ROOT, OUT)}`);
      console.error(`  VALIDATE BEFORE USE: node engine/validate_selfplay.js`);
    });
  } else {
    console.error(`\nMEW FARM done in ${(elapsed / 60).toFixed(1)} min; shards left in ${path.relative(ROOT, shardDir)}`);
  }
});
