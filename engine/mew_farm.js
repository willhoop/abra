/* mew_farm.js — run MEW across every core, because the data constraint is a throughput constraint.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every "we do not have enough data" conclusion in this project applies to questions about PEOPLE:
 * does rating predict, do players tech, what will an opponent bring. Those need real replays and
 * genuinely need to wait.
 *
 * Questions about THE GAME have no data constraint at all — they only ever had a throughput
 * constraint, and nobody had measured it.
 *
 * MEASURED SCALING, 2026-07-25, on 8 physical / 16 logical cores. This is the honest curve, and it
 * is NOT linear — an earlier note in this file projected 131 games/sec from a single-process rate
 * and linear scaling. That was wrong by 5.7x, and it was wrong the same way half the results in this
 * project were wrong: extrapolated instead of measured.
 *
 *     procs   games/sec
 *       1       10.1
 *       2       17.5
 *       4       23.1     <- optimum
 *       8       10.8     <- WORSE than 4
 *
 * Past four workers the throughput collapses. The Showdown simulator is memory-heavy and the
 * processes contend for cache, so extra workers actively cost. The default is therefore 4, not
 * "most of your cores".
 *
 * At ~23 games/sec:
 *       1,000,000 games   ~12 hours    (an overnight run — enough to train a value net)
 *       5,000,000 games   ~2.5 days
 *      20,000,000 games   ~10 days     (Metamon scale; not a weekend)
 *
 * WHY SEPARATE PROCESSES rather than threads: the simulator is synchronous and CPU-bound, so a
 * single Node process pins one core no matter how high --conc goes. Concurrency inside a process
 * only overlaps await points, which is why 8-way --conc still gave ~10 games/sec.
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

/* Build the team pool ONCE and share it. Without this every worker re-reads the store and re-runs
 * behavioural bot detection before its first battle, and that startup dominates: a 2,400-game run
 * across 12 workers measured 16 games/sec against a per-process rate of 10.9, so parallelism was
 * buying essentially nothing. */
const poolFile = path.join(shardDir, 'teams.json');
{
  const t0 = Date.now();
  const teams = require('./mew.js').realTeams();
  fs.writeFileSync(poolFile, JSON.stringify(teams));
  console.error(`  team pool: ${teams.length} distinct clean teams, built once in ` +
                `${((Date.now() - t0) / 1000).toFixed(1)}s and shared with every worker`);
}
process.env.MEW_TEAMS = poolFile;

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
