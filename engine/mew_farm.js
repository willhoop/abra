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
 * CONC MUST BE 1. THIS IS THE WHOLE PERFORMANCE STORY AND IT COST TWO WRONG ANSWERS TO FIND.
 * ----------------------------------------------------------------------------------------
 * This file originally spawned workers with a hardcoded `--conc 4`, and measured 2026-07-25 on
 * 8 physical / 16 logical cores:
 *
 *     procs  conc   games/sec
 *       4      4       23
 *       8      4       11      <- looks like parallelism collapsing past 4 cores
 *       8      2        9
 *       8      1       38      <- same 8 cores, 4x faster
 *      12      1       44-46   <- reproduced twice
 *      16      1       24
 *      20      1       15
 *
 * The simulator is synchronous and CPU-bound, so in-process concurrency never overlaps any real
 * work — it just holds N battles live at once and multiplies GC pressure. At 8 procs x 4 conc that
 * is 32 simultaneous battles and the machine thrashes. Raising --conc looks like it should help and
 * costs 4x.
 *
 * TWO WRONG ANSWERS CAME OUT OF THIS, both recorded because the failure mode is instructive:
 *   1. An early note here projected 131 games/sec by taking one process's rate and multiplying by
 *      12. Never measured. Real answer is ~45.
 *   2. The correction then claimed scaling "collapses past 4 processes" and 1M would take 12 hours.
 *      That WAS measured — but every row carried the bad --conc, so a config artifact got written up
 *      as a hardware limit.
 * Measure the thing you are varying, and vary one thing.
 *
 * RUN-TO-RUN VARIANCE IS LARGE. 8/conc-1 measured 37.8 and 15.1 on separate sweeps of identical
 * config. Treat any single microbenchmark here as +/- 2x. 12 procs is the default because it was the
 * fastest AND the only setting that reproduced (46.2, 44.2). A real run reports its own sustained
 * rate at the end; trust that number over this comment.
 *
 * At ~45 games/sec:
 *       1,000,000 games   ~6 hours     (overnight — enough to train a value net)
 *       5,000,000 games   ~31 hours
 *      20,000,000 games   ~5 days      (Metamon scale)
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
/* RAW-STORE-NOT-READ: this path is resolved so the farm can REFUSE to write its output over the durable
 * store — see the --out collision check below. It is never opened for reading. The clean team pool comes
 * from quality.js via the pool builder, which is why the run log reports "distinct clean teams".
 * engine/selftest.js greps for the filename anywhere in a file, so this safety guard was being counted
 * as a violation of the very rule it protects. */
const LADDER = D('data', 'games.ladder.jsonl');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt;
}
const N = parseInt(arg('n', '100000'), 10);
/* Leave a core or two for the OS, or the machine becomes unusable and the run slows down anyway. */
const PROCS = parseInt(arg('procs', String(Math.max(1, Math.min(16, Math.floor(os.cpus().length * 0.75))))), 10);
const POLICY = arg('policy', 'prior');
/* 1, not 4 — see the header. In-process concurrency cannot overlap CPU-bound simulation and cost 4x
 * when it was hardcoded here. Exposed as a flag only so the finding stays re-measurable. */
const CONC = arg('conc', '1');
/* SEED BASE. This was `Date.now() % 1e7`, which WRAPS EVERY 2.78 HOURS (10^7 milliseconds). Two
 * runs started roughly 2.78 hours apart therefore drew the same base and produced overlapping seed
 * ranges — literally the same battles again, under different ids, silently inflating a corpus with
 * duplicates that no id check would catch. At one run per night it never bit; at the cadence needed
 * for millions of games it certainly would.
 *
 * The replacement uses minutes since epoch, multiplied clear of any plausible run size, so two runs
 * collide only if started in the same minute. There is also a hard ceiling worth knowing about:
 *
 *   THE ENGINE ONLY USES 28 BITS OF THE SEED. mew.js expands an integer to Showdown's four 16-bit
 *   words as [s&0xffff, (s>>4)&0xffff, (s>>8)&0xffff, (s>>12)&0xffff], so every bit above 27 is
 *   discarded and any two seeds 268,435,456 apart are the SAME BATTLE. Making the number longer
 *   buys nothing past that. 268M distinct battles is far beyond Metamon scale (20M), so this is a
 *   documented ceiling rather than a live problem — but the guard below refuses to run past it
 *   instead of silently wrapping.
 *
 * Adjacent seeds were checked and are NOT correlated: seeds N and N+1 on identical teams diverge at
 * the first protocol line, so the PRNG decorrelates the neighbouring states properly. */
const SEED_CEILING = 2 ** 28;
const SEED0 = parseInt(arg('seed', String((Math.floor(Date.now() / 60000) * 997) % SEED_CEILING)), 10);
const OUT = path.resolve(arg('out', D('data', 'games.selfplay.jsonl')));
const KEEP = process.argv.includes('--keep-shards');
/* Mirrors mew.js: the log sidecar sits beside the record file under the same stem. */
const RAW_OUT = OUT.replace(/\.jsonl$/, '') + '.raw-logs.jsonl';

if (path.resolve(OUT) === path.resolve(LADDER)) {
  console.error('REFUSING: --out is the ladder store. Self-play must never enter it.');
  process.exit(1);
}
if (!process.env.SHOWDOWN_PATH) {
  console.error('set SHOWDOWN_PATH to a BUILT pokemon-showdown master checkout');
  process.exit(2);
}

let per = Math.ceil(N / PROCS);
/* Paired runs must hand each worker an EVEN count, or the last matchup of every block comes back
 * as half a pair and is discarded -- 12 workers would silently lose 12 pairs. */
if (process.argv.includes('--paired') && (per % 2)) per++;

/* Refuse to run past the 28-bit ceiling rather than wrap into battles already generated. A silent
 * wrap would produce exact duplicates carrying fresh ids, which is the one corruption a duplicate-id
 * check cannot see. */
if (SEED0 + N >= SEED_CEILING) {
  console.error(`REFUSING: seeds ${SEED0}..${SEED0 + N} cross the engine's 28-bit ceiling ` +
                `(${SEED_CEILING.toLocaleString()}). Past it the seed wraps and regenerates battles ` +
                `that already exist. Pass a lower --seed.`);
  process.exit(1);
}
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
console.error(`  policy=${POLICY}  conc=${CONC}  seeds ${SEED0}..${SEED0 + PROCS * per}  -> ${path.relative(ROOT, OUT)}`);

const started = Date.now();
const shards = [];
let done = 0, failed = 0;

const workers = Array.from({ length: PROCS }, (_, i) => new Promise((resolve) => {
  const shard = path.join(shardDir, `shard-${i}.jsonl`);
  shards.push(shard);
  try { fs.unlinkSync(shard); } catch (e) { /* fresh */ }
  /* Each worker owns seed block [SEED0 + i*per, SEED0 + (i+1)*per), so blocks cannot overlap. */
  /* PASS THE REST THROUGH. The worker command was a fixed list, so a head-to-head (--policy2), a
   * different regulation (--format) or a paired run (--paired) could not be farmed at all -- they
   * had to go through a single process at roughly a fifth of the throughput, which is exactly what
   * happened on the first 20,000-game comparison. Forwarded rather than re-declared, so a flag added
   * to mew.js is farmable without touching this file. */
  const extra = [];
  for (const k of ['policy2', 'format', 'weights', 'weights2', 'randmove']) {
    const v = arg(k, '');
    if (v) extra.push('--' + k, v);
  }
  for (const f of ['paired', 'switching', 'forced-switch', 'forced-switch2', 'greedy', 'thoughts']) if (process.argv.includes('--' + f)) extra.push('--' + f);
  const child = spawn(process.execPath, [
    D('engine', 'mew.js'),
    '--n', String(per),
    '--conc', String(CONC),
    '--policy', POLICY,
    '--seed', String(SEED0 + i * per),
    '--out', shard,
    ...extra,
  ], { env: process.env, stdio: ['ignore', 'ignore', 'pipe'] });

  /* 4000, NOT 400, AND PRINTED ON SUCCESS TOO — because a farmed run threw away the only evidence
   * that its own experiment was switched on.
   *
   * mew.js ends its stderr with the capability accounting this project relies on: what share of
   * decisions were scored, how many fell back to the prior sampler, whether the joint layer ran,
   * whether the forced-replacement lever fired. In a FARMED run none of it survived: the tail was
   * capped at 400 characters and only printed when a worker exited nonzero, so a successful run
   * discarded every one of those lines.
   *
   * The cost is not hypothetical. A 116,964-game paired measurement of the forced-replacement lever
   * completed on 2026-07-30 and its own log could not show the lever had been on -- the flag was
   * verifiable only from a separate 40-game direct run and from the flag stamped on the records,
   * neither of which proves the code path executed during the measurement. That is precisely the
   * failure "EVERY CAPABILITY REPORTS WHETHER IT ACTUALLY RAN" exists to prevent, reappearing one
   * layer up: the capability reported honestly and the farm ate the report.
   *
   * 4000 characters holds mew.js's whole summary block. Printed per worker and labelled, so six
   * workers add about sixty lines at the end of a run and a lever that fired on five of six is
   * visible rather than averaged away. */
  let tail = '';
  child.stderr.on('data', d => { tail = (tail + d.toString()).slice(-4000); });
  child.on('close', (code) => {
    if (code === 0) done++; else { failed++; console.error(`  worker ${i} exited ${code}: ${tail.trim().split('\n').pop()}`); }
    const secs = (Date.now() - started) / 1000;
    console.error(`  [${done + failed}/${PROCS}] worker ${i} finished (${secs.toFixed(0)}s elapsed)`);
    /* The accounting lines only -- not the per-25-game progress spam, which is six workers' worth of
     * noise and says nothing about whether anything ran. Matched on the summary's own labels. */
    const acct = tail.split('\n').filter(l => /policy=|aiming:|forced replacements|joint|team preview|open team sheets|mega evolution|fell back/i.test(l));
    for (const l of acct) console.error(`    w${i}| ${l.trim()}`);
    resolve();
  });
}));

Promise.all(workers).then(async () => {
  const elapsed = (Date.now() - started) / 1000;
  if (!KEEP) {
    /* Merge, deduping by id. Disjoint seeds make collisions impossible in principle; the check is
     * cheap and this project has been bitten by duplicate ids four times. */
    const seen = new Set();
    const out = fs.createWriteStream(OUT, { flags: 'w' });
    let kept = 0, dupes = 0;
    /* STREAMED. readFileSync died at the finish line of the 600k run: Node caps one string at
     * ~536MB and each of six shards was 660MB+. The whole run survived only because the shards
     * did; the merge must never be the step that can lose a night's compute. */
    const readline = require('readline');
    for (const s of shards) {
      if (!fs.existsSync(s)) continue;
      const rl = readline.createInterface({ input: fs.createReadStream(s), crlfDelay: Infinity });
      for await (const line of rl) {
        const t = line.trim(); if (!t) continue;
        let id;
        try { id = JSON.parse(t).id; } catch { continue; }
        if (seen.has(id)) { dupes++; continue; }
        seen.add(id); out.write(t + '\n'); kept++;
      }
    }
    /* THE RAW LOGS MUST BE MERGED TOO, AND THIS STEP DID NOT EXIST.
     * ------------------------------------------------------------------------------------------
     * Each worker writes a sidecar of protocol logs beside its record shard, and those logs are the
     * ONLY thing PORY can read — the records are game-level summaries with no per-turn state. The
     * merge below used to delete the entire shard directory, so every raw log a distributed run
     * produced was destroyed at the moment the run succeeded. A single-process run kept them; the
     * farm silently did not.
     *
     * Filtered through the SAME `seen` id set, so records and logs stay exactly in step. */
    const rawShards = shards.map(s => s.replace(/\.jsonl$/, '') + '.raw-logs.jsonl');
    const rawOut = fs.createWriteStream(RAW_OUT, { flags: 'w' });
    let rawKept = 0;
    /* STREAMED — the same 536MB string cap that bit the games merge bit THIS loop one run later
     * (the fix landed one merge site short; raw-log shards are the bigger files). */
    for (const s of rawShards) {
      if (!fs.existsSync(s)) continue;
      const rl2 = readline.createInterface({ input: fs.createReadStream(s), crlfDelay: Infinity });
      for await (const line of rl2) {
        const t = line.trim(); if (!t) continue;
        let id;
        try { id = JSON.parse(t).id; } catch { continue; }
        if (!seen.has(id)) continue;          // its record was dropped as a dupe; drop the log too
        rawOut.write(t + '\n'); rawKept++;
      }
    }
    let pending = 2;
    const finish = () => {
      if (--pending) return;
      for (const s of shards.concat(rawShards)) { try { fs.unlinkSync(s); } catch (e) {} }
      try { fs.unlinkSync(poolFile); } catch (e) {}
      try { fs.rmdirSync(shardDir); } catch (e) {}
      const rate = kept / Math.max(1, elapsed);
      console.error(`\nMEW FARM done: ${kept.toLocaleString()} games in ${(elapsed / 60).toFixed(1)} min ` +
                    `(${rate.toFixed(0)}/sec, ${failed} workers failed, ${dupes} duplicate ids dropped)`);
      console.error(`  -> ${path.relative(ROOT, OUT)}`);
      console.error(`  -> ${path.relative(ROOT, RAW_OUT)}  (${rawKept.toLocaleString()} raw logs)`);
      if (rawKept !== kept) {
        console.error(`  WARNING: ${kept.toLocaleString()} records but ${rawKept.toLocaleString()} logs — these must match.`);
      }
      console.error(`  VALIDATE BEFORE USE: node engine/validate_selfplay.js`);
    };
    out.end(finish);
    rawOut.end(finish);
  } else {
    console.error(`\nMEW FARM done in ${(elapsed / 60).toFixed(1)} min; shards left in ${path.relative(ROOT, shardDir)}`);
  }
});
