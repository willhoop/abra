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

if (path.resolve(OUT) === path.resolve(LADDER)) {
  console.error('REFUSING: --out is the ladder store. Self-play must never enter it.');
  process.exit(1);
}

// ---- teams: sample REAL sixes from the clean ladder store --------------------------------------
/* Uses the quality filter, not the raw store. A bot team appears hundreds of times, so sampling raw
 * would make MEW play one script's team against itself over and over - the same contamination that
 * broke meta-usage.json, reproduced at scale. */
function realTeams() {
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
  const p1 = new Player(streams.p1), p2 = new Player(streams.p2);
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

  const out = fs.createWriteStream(OUT, { flags: 'a' });
  const startedAt = Math.floor(Date.now() / 1000);
  let done = 0, written = 0, failed = 0;
  const POL = { sampled: 0, fellBack: 0, noPrior: 0 };

  const jobs = Array.from({ length: N }, (_, i) => i);
  async function worker() {
    while (jobs.length) {
      const i = jobs.shift();
      const seed = SEED0 + i;
      // independent draws; a team may face itself, which is a legitimate mirror
      const a = teams[(seed * 2654435761) % teams.length];
      const b = teams[(seed * 40503 + 17) % teams.length];
      let res = null;
      try { res = await playOne(a, b, seed); } catch (e) { failed++; }
      done++;
      if (!res) { failed++; continue; }
      const log = res.log;
      for (const s of (res.stats || [])) { POL.sampled += s.sampled; POL.fellBack += s.fellBack; POL.noPrior += s.noPrior; }
      const rec = extract(`selfplay-${SEED0}-${i}`, startedAt, log);
      if (!rec || (rec.six.p1 || []).length < 4 || (rec.six.p2 || []).length < 4) { failed++; continue; }
      /* Provenance on every record. A self-play game that ever loses its label becomes
       * indistinguishable from a real one, and that is unrecoverable. */
      rec.source = 'selfplay';
      rec.selfplay = { engine_commit: CS.PINNED_COMMIT, format: CS.FORMAT, policy: POLICY, seed };
      out.write(JSON.stringify(rec) + '\n');
      written++;
      if (done % 25 === 0) process.stderr.write(`  ${done}/${N} played, ${written} written, ${failed} discarded\n`);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONC) }, worker));
  await new Promise(r => out.end(r));
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
