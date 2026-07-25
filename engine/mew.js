/* mew.js — MEW, the self-play data engine.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every preview-level result in this project is underpowered. On 2026-07-25 the clean store held
 * 1,061 games, which can only detect an edge of ~4.3 accuracy points over a coin; detecting a
 * 2-point effect needs ~4,900 games. Human replays arrive at roughly 330 clean games/day, so the
 * answer to "do we have enough data" is "not for weeks".
 *
 * MEW removes that constraint for every question that is about the GAME rather than about PEOPLE.
 * It plays the official Champions engine against itself and writes the results in the store schema.
 * Unlimited, and free of the opt-in selection bias in public replay uploads (players save wins and
 * flashy games; nobody uploads a boring loss).
 *
 * WHAT IT CANNOT DO. Self-play says nothing about humans. It cannot tell you whether real players
 * tech for the metagame, whether ladder rating predicts anything, or what a human is likely to
 * bring. Those need real games and there is no substitute. Keep the two apart, always.
 *
 * THE HARD RULE: SELF-PLAY NEVER ENTERS THE LADDER STORE.
 * Output goes to data/games.selfplay.jsonl and every record is stamped `source: "selfplay"`. If the
 * two were ever mixed, every human statistic in the project would be quietly wrong, which is
 * exactly the failure that produced a meta-usage.json describing one bot's team.
 *
 * THREE THINGS ARE DELIBERATELY REUSED RATHER THAN REBUILT (S1):
 *   1. The official engine, pinned - engine/champions_sim.js. Verified against @smogon/calc on
 *      31 scenarios (engine/validate_damage_sim.js), so the games are correct by construction.
 *   2. The extractor - extract() from durable-ingest.js. A self-play battle log parses with the
 *      SAME function as a downloaded replay, so self-play games are identical in shape and every
 *      downstream reader works unchanged. Verified before this file was written.
 *   3. Real teams - sampled from the CLEAN ladder store. Self-play on invented teams would model a
 *      metagame that does not exist.
 *
 * TWO POLICIES, AND THE CHOICE MATTERS MORE THAN THE COUNT.
 *   --policy random  Showdown's RandomPlayerAI. Unbiased, cheap, correct for matchup structure and
 *                    for proving the plumbing. NOT valid as training data for a value net: a model
 *                    would learn "P(win) when both players move at random", which is nobody's
 *                    question.
 *   --policy prior   engine/prior_player.js — samples the move a species actually clicks at its
 *                    observed frequency, from data/move-priors.json. This is the mode that matters:
 *                    VGC-Bench's cross-evaluation found clone-then-self-play (BCSP) the strongest
 *                    configuration in this domain.
 *
 * The run reports what fraction of decisions the policy actually sampled. That line is not decoration
 * — ADR-001 attempt 3 fell through to uniform random on 100% of decisions while reporting itself as a
 * prior sampler, and produced a 32.2-point "finding" that measured nothing. When `--policy prior` was
 * first wired here it reported "no decisions at all" and wrote 0 games from 40 battles, because
 * prior_player.js read the priors from a browser global. That is the third instance of that same
 * defect this week, and the counter is what caught it.
 *
 * USAGE
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/mew.js --n 1000 --policy prior
 *   --out <file>     override the destination (still never the ladder store)
 *   --conc <n>       concurrent battles (default 4)
 *   --seed <n>       base seed, for reproducibility
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { extract } = require('./durable-ingest.js');
const CS = require('./champions_sim.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const LADDER = D('data', 'games.ladder.jsonl');
const OUT_DEFAULT = D('data', 'games.selfplay.jsonl');

// ---- args -------------------------------------------------------------------------------------
function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const N = parseInt(arg('n', '100'), 10);
const CONC = parseInt(arg('conc', '4'), 10);
const SEED0 = parseInt(arg('seed', '1'), 10);
const POLICY = arg('policy', 'random');
const OUT = path.resolve(arg('out', OUT_DEFAULT));
/* RAW LOGS ARE THE POINT, AND THIS FILE USED TO THROW THEM AWAY.
 * ------------------------------------------------------------------------------------------------
 * playOne() captures the full omniscient protocol log, hands it to extract(), and dropped it. But
 * extract() produces the GAME-LEVEL store schema — six / brought / winner — and every downstream
 * value model reconstructs per-turn board states by replaying the PROTOCOL LOG. pory.py reads
 * data/games.ladder.raw-logs.jsonl with exactly the shape {id, uploadtime, log} and parses |turn|,
 * |switch|, |-damage| out of it.
 *
 * So a self-play corpus written only as store records is unreadable by the model it exists to train.
 * A million games would have produced zero usable board states. The log is now written to a sidecar
 * in the ladder's own raw-log schema, so PORY consumes self-play through the SAME reconstruction
 * code path it uses for real games — no second parser to drift.
 *
 * Sized at ~5KB/game: 1M games is ~5GB of logs beside ~5GB of records. --no-raw skips it. */
const RAW_OUT = process.argv.includes('--no-raw') ? null
  : path.resolve(arg('raw', OUT.replace(/\.jsonl$/, '') + '.raw-logs.jsonl'));

if (path.resolve(OUT) === path.resolve(LADDER)) {
  console.error('REFUSING: --out is the ladder store. Self-play must never enter it.');
  process.exit(1);
}

// ---- teams: sample REAL sixes from the clean ladder store --------------------------------------
/* Uses the quality filter, not the raw store. A bot team appears hundreds of times, so sampling raw
 * would make MEW play one script's team against itself over and over - the same contamination that
 * broke meta-usage.json, reproduced at scale. */
function realTeams() {
  /* A precomputed pool short-circuits the whole filter pass. mew_farm.js builds it ONCE and hands
   * the same file to every worker, because each worker otherwise re-reads the 8,757-game store and
   * re-runs behavioural bot detection before generating a single battle. With 12 workers that
   * startup cost dominated everything: a 2,400-game farm run measured 16 games/sec against a
   * per-process rate of 10.9, i.e. parallelism was buying almost nothing. */
  const pool = process.env.MEW_TEAMS;
  if (pool && fs.existsSync(pool)) {
    try {
      const t = JSON.parse(fs.readFileSync(pool, 'utf8'));
      if (Array.isArray(t) && t.length) return t;
    } catch (e) { /* fall through and compute it */ }
  }
  const Q = require('./quality.js');
  const games = Q.loadGames();                 // clean only
  const seen = new Set(), teams = [];
  for (const g of games) {
    for (const side of ['p1', 'p2']) {
      const six = ((g.six || {})[side] || []).filter(Boolean);
      if (six.length !== 6) continue;
      const key = six.slice().sort().join('|');
      if (seen.has(key)) continue;             // distinct teams only; duplicates re-weight the meta
      seen.add(key);
      teams.push({ six, sets: g.sets || {} });
    }
  }
  return teams;
}

// ---- one self-play battle ----------------------------------------------------------------------
async function playOne(teamA, teamB, seed) {
  const { BattleStream, getPlayerStreams, RandomPlayerAI, Teams } = simBits();
  const A = CS.packTeam(teamA.six, teamA.sets);
  const B = CS.packTeam(teamB.six, teamB.sets);
  if (!A.size || !B.size) return null;
  /* REFUSE ILLEGAL TEAMS. BattleStream does not validate what it is handed, so a team that breaks
   * Item Clause or carries an unlearnable move plays through and produces a record indistinguishable
   * from a legitimate game. Before this gate, Showdown's own validator rejected 80.5% of the pool —
   * four in five self-play games were played with teams no human could bring. packTeam repairs what
   * it can; anything still invalid is discarded rather than recorded. */
  if (A.valid === false || B.valid === false) {
    return { invalid: (A.problems || []).concat(B.problems || []) };
  }

  const stream = new BattleStream();
  const streams = getPlayerStreams(stream);

  /* The swappable part, and the ONLY thing that differs between the two modes.
   *
   *   random — Showdown's own RandomPlayerAI. Cheap and unbiased, correct for matchup structure and
   *     for proving the plumbing, but it produces games no human would ever play. Valid for a
   *     matchup table; NOT valid as training data for a value net, which would learn "P(win) when
   *     both players move at random" — a question nobody has.
   *   prior — engine/prior_player.js, which samples the move a species actually clicks at its
   *     observed frequency. VGC-Bench's cross-evaluation found clone-then-self-play (BCSP) is the
   *     strongest configuration, so this is the mode that matters.
   *
   * The previous version of this line returned RandomPlayerAI on BOTH branches — a stub that would
   * have reported `policy: "prior"` on every record while playing uniformly at random. That is
   * exactly the failure ADR-001 attempt 3 recorded, where a policy port silently fell through to
   * random on 100% of decisions while reporting itself as a prior sampler, and produced a 32.2-point
   * "finding" that measured nothing. PriorPlayerAI counts its own fallbacks for the same reason, and
   * MEW now reports the sampled rate so a broken policy is visible rather than assumed. */
  let Player = RandomPlayerAI;
  if (POLICY === 'prior') Player = require('./prior_player.js').makePriorPlayer();
  /* SEED THE PLAYERS, NOT JUST THE BATTLE.
   * ------------------------------------------------------------------------------------------
   * `>start {seed}` below seeds the BATTLE's rng — damage rolls, crits, accuracy, speed ties. It
   * does nothing for the PLAYERS, whose PRNG defaults to a fresh random seed, so re-running a
   * recorded seed reproduced the dice and not the decisions. The game diverged at the first choice.
   *
   * That matters because the whole point of the corpus is claims of the form "this switch is what
   * won the game", and such a claim is unfalsifiable if the game cannot be replayed. With both
   * halves seeded, (seed + teams + engine_commit) reproduces a battle exactly, and all three are
   * recorded on every row.
   *
   * The two players get DIFFERENT derived seeds; sharing one would have both sides making mirrored
   * draws at every decision. */
  const pseed = (off) => {
    const s = (seed + off * 0x9E3779B1) >>> 0;
    return [s & 0xffff, (s >>> 4) & 0xffff, (s >>> 8) & 0xffff, (s >>> 12) & 0xffff];
  };
  const p1 = new Player(streams.p1, { seed: pseed(1) });
  const p2 = new Player(streams.p2, { seed: pseed(2) });
  p1.start(); p2.start();

  void streams.omniscient.write(
    `>start ${JSON.stringify({ formatid: CS.FORMAT, seed: [seed & 0xffff, (seed >> 4) & 0xffff, (seed >> 8) & 0xffff, (seed >> 12) & 0xffff] })}\n` +
    `>player p1 ${JSON.stringify({ name: 'MEW-A', team: A.packed })}\n` +
    `>player p2 ${JSON.stringify({ name: 'MEW-B', team: B.packed })}`);

  let log = '';
  for await (const chunk of streams.omniscient) log += chunk + '\n';
  if (!/\|win\|/.test(log)) return null;       // never resolved; not evidence either way
  /* Return the policy's own accounting alongside the log. A prior sampler that quietly degrades to
   * uniform random is indistinguishable from a working one unless the rate is reported, and that is
   * precisely how ADR-001 attempt 3 produced a 32.2-point number that measured nothing. */
  const st = (p) => (p && p.stats) ? p.stats : null;
  return { log, stats: [st(p1), st(p2)].filter(Boolean) };
}

let _bits = null;
function simBits() {
  if (_bits) return _bits;
  const base = process.env.SHOWDOWN_PATH;
  if (!base) { console.error('set SHOWDOWN_PATH to a BUILT pokemon-showdown master checkout'); process.exit(2); }
  const dist = path.join(base, 'dist', 'sim');
  _bits = {
    Teams: require(path.join(dist, 'index')).Teams,
    BattleStream: require(path.join(dist, 'battle-stream')).BattleStream,
    getPlayerStreams: require(path.join(dist, 'battle-stream')).getPlayerStreams,
    RandomPlayerAI: require(path.join(base, 'dist', 'sim', 'tools', 'random-player-ai')).RandomPlayerAI,
  };
  return _bits;
}

// ---- main ---------------------------------------------------------------------------------------
async function main() {
  const v = CS.verify();
  if (!v.ok) { console.error(`format ${CS.FORMAT} not found — is SHOWDOWN_PATH a built master checkout?`); process.exit(1); }

  const teams = realTeams();
  if (teams.length < 2) { console.error(`need at least 2 distinct clean teams, found ${teams.length}`); process.exit(1); }
  process.stderr.write(`MEW: ${teams.length} distinct clean teams | engine ${v.pinned_commit.slice(0, 12)} | policy ${POLICY}\n`);

  /* BATCHED SYNCHRONOUS APPENDS, NOT A WRITE STREAM. THIS WAS MEASURED, NOT ASSUMED.
   * ------------------------------------------------------------------------------------------
   * These were fs.createWriteStream(..., {flags:'a'}), and the comment above them claimed a run
   * killed part-way "keeps everything already flushed". That claim was FALSE and the failure was
   * observed directly: during a 12-worker run, every shard file sat at exactly 0 bytes for fifteen
   * minutes while the workers each held ~500MB resident. Records are ~5KB, the workers out-produce
   * the disk, and Node answers backpressure by queueing in memory — so nothing reached disk until
   * the stream was closed at process exit.
   *
   * Two consequences, both bad for a multi-hour run:
   *   1. A worker killed before it finishes loses ALL of its games, not the last few.
   *   2. Memory grows without bound in proportion to games generated — 16,667 games per worker is
   *      ~170MB of queued records per worker before the process ever writes anything.
   * It also makes progress unobservable, which is how a healthy run got mistaken for a hung one and
   * killed at 15 minutes.
   *
   * appendFileSync on a batch bounds both: memory is capped at BATCH records, and everything older
   * than the last BATCH is durably on disk. The syscall cost is amortised over the batch, and it is
   * negligible next to a ~90ms battle. */
  const BATCH = 50;
  const bufRec = [], bufRaw = [];
  const flush = (force) => {
    if (bufRec.length && (force || bufRec.length >= BATCH)) {
      fs.appendFileSync(OUT, bufRec.join(''));
      bufRec.length = 0;
    }
    if (RAW_OUT && bufRaw.length && (force || bufRaw.length >= BATCH)) {
      fs.appendFileSync(RAW_OUT, bufRaw.join(''));
      bufRaw.length = 0;
    }
  };
  const out = { write: (s) => { bufRec.push(s); flush(false); } };
  const rawOut = RAW_OUT ? { write: (s) => { bufRaw.push(s); flush(false); } } : null;
  if (rawOut) process.stderr.write(`  raw logs -> ${path.relative(ROOT, RAW_OUT)} (PORY reads this, not the records)\n`);
  const startedAt = Math.floor(Date.now() / 1000);
  let done = 0, written = 0, failed = 0;
  const POL = { sampled: 0, fellBack: 0, noPrior: 0, invalidTeam: 0, previewSampled: 0, previewDefault: 0 };

  /* MATCHUP COVERAGE IS ENUMERATED, NOT SAMPLED.
   * ------------------------------------------------------------------------------------------
   * This used to draw both teams as independent hashes of the seed:
   *
   *     const a = teams[(seed * 2654435761) % teams.length];
   *     const b = teams[(seed * 40503 + 17) % teams.length];
   *
   * Both are LINEAR in the same counter, so the pair (a,b) does not explore a 2-D space — it walks
   * a 1-D lattice through it. Measured over 1,000,000 sequential seeds with a 1,326-team pool:
   *
   *     distinct matchups reached   1,325  of  879,801        (0.15%)
   *     average repeats per matchup   755x
   *     mirror matches                  0   (the old comment claimed these happened; they cannot)
   *
   * A million games would have been 1,325 matchups replayed 755 times each. Independent random
   * draws would have reached 68%; enumeration reaches 100% in FEWER games than the 1M it replaces.
   *
   * So games are indexed against the triangular enumeration of unordered pairs (a <= b, mirrors
   * included) and every matchup is played exactly once per pass.
   *
   * THE ORDER IS SCRAMBLED ON PURPOSE. Walking the triangle in order would spend the first thousand
   * games on team 0 against everything, so any interrupted or partial run would be a biased sample
   * of one team's matchups. Multiplying the index by a stride coprime to the total is a bijection on
   * [0,total), so coverage stays exactly-once while ANY PREFIX is spread across the whole pool.
   * A run killed at 40% is still a usable 40% sample. */
  const T = teams.length;
  const TOTAL = T * (T + 1) / 2;              // unordered pairs including mirrors
  /* coprime to TOTAL, so k -> (k*STRIDE+OFF) mod TOTAL is a full-cycle permutation */
  const gcd = (x, y) => y ? gcd(y, x % y) : x;
  let STRIDE = Math.floor(TOTAL * 0.6180339887) | 0;   // golden-ratio stride spreads best
  if (STRIDE < 2) STRIDE = 1;
  while (gcd(STRIDE, TOTAL) !== 1) STRIDE++;
  const OFF = SEED0 % TOTAL;

  /* unrank k in [0,TOTAL) to (a,b), a<=b. Row a holds (T-a) entries, so the row start is
   * a*(2T-a+1)/2 and inverting that triangular number gives the row. */
  function pairForIndex(k) {
    const a = Math.floor((2 * T + 1 - Math.sqrt((2 * T + 1) * (2 * T + 1) - 8 * k)) / 2);
    const start = a * (2 * T - a + 1) / 2;
    let b = a + (k - start);
    if (b >= T) b = T - 1;                    // guard float error at row edges
    return [a, b];
  }

  if (N > TOTAL) {
    process.stderr.write(`  NOTE: N=${N.toLocaleString()} exceeds the ${TOTAL.toLocaleString()} ` +
      `distinct matchups available from ${T} teams; passes after the first replay them with fresh seeds\n`);
  } else {
    process.stderr.write(`  enumerating ${N.toLocaleString()} of ${TOTAL.toLocaleString()} distinct ` +
      `matchups (${(100 * N / TOTAL).toFixed(1)}% coverage, each exactly once)\n`);
  }

  const jobs = Array.from({ length: N }, (_, i) => i);
  async function worker() {
    while (jobs.length) {
      const i = jobs.shift();
      const seed = SEED0 + i;
      const k = ((i % TOTAL) * STRIDE + OFF) % TOTAL;
      const [ai, bi] = pairForIndex(k);
      const a = teams[ai], b = teams[bi];
      let res = null;
      try { res = await playOne(a, b, seed); } catch (e) { failed++; }
      if (res && res.invalid) { POL.invalidTeam++; res = null; }
      done++;
      if (!res) { failed++; continue; }
      const log = res.log;
      for (const s of (res.stats || [])) {
        POL.sampled += s.sampled; POL.fellBack += s.fellBack; POL.noPrior += s.noPrior;
        POL.previewSampled += s.previewSampled || 0; POL.previewDefault += s.previewDefault || 0;
      }
      const rec = extract(`selfplay-${SEED0}-${i}`, startedAt, log);
      if (!rec || (rec.six.p1 || []).length < 4 || (rec.six.p2 || []).length < 4) { failed++; continue; }
      /* Provenance on every record. A self-play game that ever loses its label becomes
       * indistinguishable from a real one, and that is unrecoverable. */
      rec.source = 'selfplay';
      rec.selfplay = { engine_commit: CS.PINNED_COMMIT, format: CS.FORMAT, policy: POLICY, seed };
      out.write(JSON.stringify(rec) + '\n');
      /* Written under the SAME id as the record, so a board state can always be traced back to the
       * game, the teams, the policy and the seed that produced it. */
      if (rawOut) rawOut.write(JSON.stringify({ id: rec.id, uploadtime: startedAt, log }) + '\n');
      written++;
      if (done % 25 === 0) process.stderr.write(`  ${done}/${N} played, ${written} written, ${failed} discarded\n`);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONC) }, worker));
  flush(true);      // durable before the summary claims a count
  process.stderr.write(`MEW done: ${written} games -> ${path.relative(ROOT, OUT)} (${failed} discarded)\n`);
  /* REPORT THE POLICY'S OWN ACCOUNTING. A prior sampler that degrades to uniform random produces
   * games that look fine and measure nothing — ADR-001 attempt 3 reported itself as a prior sampler
   * while falling through to random on 100% of decisions, and the 32.2-point "finding" it produced
   * was an artifact. attempt 4, wired correctly, sampled 81.4%. If this line ever reads 0%, the
   * policy is not running and no result from the batch means anything. */
  const tot = POL.sampled + POL.fellBack + POL.noPrior;
  if (tot) {
    const pct = (100 * POL.sampled / tot).toFixed(1);
    process.stderr.write(`  policy=${POLICY}: ${pct}% of decisions sampled from priors ` +
      `(${POL.fellBack} fell back — move illegal this turn, ${POL.noPrior} had no prior for the species)\n`);
    /* TEAM PREVIEW ACCOUNTING. The preview sampler degrades to the constant 'default' bring when
     * data/bring-priors.json is missing, and that degradation is invisible in the games themselves —
     * they look completely normal, every team just always brings the same four. Report it. */
    const pv = POL.previewSampled + POL.previewDefault;
    if (pv) {
      process.stderr.write(`  team preview: ${POL.previewSampled.toLocaleString()} sampled from bring/lead priors, ` +
        `${POL.previewDefault.toLocaleString()} fell back to the constant 'default'\n`);
      if (POL.previewSampled === 0) {
        process.stderr.write('  WARNING: every preview used the CONSTANT default bring — run node engine/bring_priors.js\n');
      }
    }
    if (POL.invalidTeam) {
      process.stderr.write(`  ${POL.invalidTeam.toLocaleString()} games discarded: team failed Showdown's TeamValidator after repair\n`);
    }
    if (POL.sampled === 0) {
      process.stderr.write('  WARNING: the policy sampled NOTHING. It is running as uniform random.\n');
      process.stderr.write('  This is ADR-001 attempt 3 recurring. Do not use this batch.\n');
    }
  } else if (POLICY !== 'random') {
    process.stderr.write(`  WARNING: policy=${POLICY} reported no decisions at all — it is not wired.\n`);
  }
}

module.exports = { realTeams, playOne };
if (require.main === module) main();
