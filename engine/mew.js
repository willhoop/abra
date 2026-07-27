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
/* THE HEAD-TO-HEAD GATE (backlog item 4). `--policy2` gives the SECOND player a different policy, so
 * two bots can be played against each other and the question "is the new one actually better" gets an
 * answer in WINS rather than in how well it predicts a human.
 *
 * That distinction is the whole point. A policy fitted to imitate people is graded on how often it
 * guesses their next click, and that number can improve while the bot gets no better at winning —
 * they are different objectives and only this one is the goal. Nothing in the project measured it
 * until now. */
const POLICY2 = arg('policy2', '');
/* --paired  play every matchup twice, once each way, on the same seed. The only honest way to
 *           compare two policies: team difficulty cancels within the pair instead of averaging out.
 * --format  which regulation to play. Defaults to the ladder format, but the Bo3 id carries
 *           `Force Open Team Sheets`, and several of MAG's features READ THE SHEET -- the spread
 *           distribution is narrowed by the opponent's revealed nature. Testing those in a
 *           closed-sheet game measures them switched off. */
const PAIRED = process.argv.includes('--paired');
const FORMAT_ARG = arg('format', '');
/* --thoughts   record MAG's per-decision scores onto each game, so a replay can show WHY it clicked.
 *              Off by default: a million-game training run should not pay for a viewer feature.
 * --randmove p RandomPlayerAI switches only when `prng.random() > this.move`, and `this.move`
 *              defaults to 1 -- so THE DEFAULT RANDOM PLAYER NEVER SWITCHES VOLUNTARILY. It is
 *              uniform over MOVES, not over moves and switches, and that makes it a STRONGER
 *              opponent, not a weaker one: a random switch surrenders a turn and walks into a
 *              matchup it did not pick. p = 0.8 gives a switch about a fifth of the time one is
 *              legal, roughly what genuinely uniform choice over 6-8 move-and-target options plus
 *              two bench slots produces by itself. A win rate against p = 0.8 is NOT comparable to
 *              one against the default, which is why the flag is explicit rather than a new default. */
const THOUGHTS = process.argv.includes('--thoughts');
const RANDMOVE = parseFloat(arg('randmove', '1'));
/* --switching  let MAG choose to switch. Measured as a 10-point LOSS against a random opponent, so
 *              it is off until the switch policy is worth more than not switching. */
const SWITCHING = process.argv.includes('--switching');
/* A weight file for the SECOND player only. This is what makes an exploitability search possible:
 * the challenger is MAG's own machinery with different numbers, so any win it manages is due to the
 * numbers rather than to a different kind of player. */
const WEIGHTS2 = arg('weights2', '');
/* ...and for the FIRST player, so a champion/challenger ladder can pit two learned vectors against
 * each other rather than always measuring against whatever happens to be in data/. */
const WEIGHTS1 = arg('weights', '');
/* Per-decision probability of taking an available form change. See the block at the Player
 * construction for why this is not the same thing as the mega rate. */
const MEGA_P = parseFloat(arg('mega', '0.85'));
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

  /* KEEP THE TEAMS DISTINCT, BUT REMEMBER HOW OFTEN EACH WAS PLAYED.
   *
   * This deduplicated and stopped there, with the comment "duplicates re-weight the meta" — which
   * has it exactly backwards. Deduplicating is what re-weights the meta: a team played two hundred
   * times ended up counting the same as a team played once, so the generated metagame came out far
   * FLATTER than the real one. Measured against real games:
   *
   *     Basculegion   28.4% of generated games   54.5% of real
   *     Garchomp      40.0%                      56.8%
   *     Kingambit     30.8%                      48.2%
   *     mean absolute gap over the top 12 species: 11.6 points
   *
   * Popularity is a real property of the format, not noise to be normalised away. A model trained
   * on the flattened version under-prepares against exactly the threats it will meet most.
   *
   * BUT FLAT IS PROBABLY RIGHT, AND THE REASON IS WHAT THESE GAMES ARE FOR.
   *
   * They exist so a value function has positions to learn from. For that, COVERAGE of the position
   * space beats fidelity to the current metagame: whether Basculegion appears in 28% or 54% of games
   * does not change what a position is worth, and a flatter draw visits more of the space. Metamon
   * built a deliberately DIVERSE set of teams for exactly this reason rather than reproducing the
   * live ladder, and VGC-Bench's agents degraded as team diversity rose — so neither result argues
   * for chasing the real distribution here.
   *
   * Where the real distribution IS required — "what will I actually face on ladder" — the answer
   * should come from the ladder store or from Smogon, both of which measure it directly and neither
   * of which needs self-play to estimate it.
   *
   * So: the pool stays DISTINCT and is drawn from UNIFORMLY by default, and each entry carries `n`
   * (clean games it appeared in) so popularity weighting is available when a question actually needs
   * it. Deduplication is a deliberate choice here, not an oversight — it is recorded as such because
   * the previous comment claimed the opposite. */
  const byKey = new Map();
  for (const g of games) {
    for (const side of ['p1', 'p2']) {
      const six = ((g.six || {})[side] || []).filter(Boolean);
      if (six.length !== 6) continue;
      const key = six.slice().sort().join('|');
      const prev = byKey.get(key);
      if (prev) { prev.n++; continue; }
      byKey.set(key, { six, sets: g.sets || {}, n: 1 });
    }
  }
  return [...byKey.values()];
}

// ---- one self-play battle ----------------------------------------------------------------------
/* One place that maps a policy NAME to a player class, so both sides of a head-to-head resolve the
 * same way and a new policy cannot be wired into one side only.
 *   random  Showdown's RandomPlayerAI — cheap and unbiased, not valid as training data.
 *   prior   engine/prior_player.js — samples the move a species actually clicks. Board-blind.
 *   score   engine/magnemite.js — MAG. Reads the board and chooses the target too. */
/* RANDOM, BUT ABLE TO SWITCH IN DOUBLES.
 *
 * Showdown's RandomPlayerAI filters its switch list on `!pokemon[j].active` and nothing else, so in
 * doubles both slots of a turn can pick the SAME benched Pokemon and the simulator refuses the
 * second: "The Pokemon in slot 3 can only switch in once". That never surfaced before because the
 * default `move: 1` means it never switches voluntarily at all -- turning switching on turned the
 * latent bug on with it. engine/magnemite.js needed the identical fix an hour earlier.
 *
 * Claims are tracked per REQUEST, which both slots of a turn share, so the set clears exactly when
 * a new turn arrives. */
function randomSwitcher() {
  const Base = simBits().RandomPlayerAI;
  return class RandomSwitcherAI extends Base {
    chooseSwitch(active, switches) {
      if (this._claimReq !== this._req) { this._claimReq = this._req; this._claimed = new Set(); }
      const free = (switches || []).filter(s => !this._claimed.has(s.slot));
      const pick = super.chooseSwitch(active, free.length ? free : switches);
      this._claimed.add(pick);
      return pick;
    }
    receiveRequest(request) { this._req = request; return super.receiveRequest(request); }
  };
}

function pickPolicy(name) {
  if (name === 'prior') return require('./prior_player.js').makePriorPlayer();
  /* Only wrapped when switching is actually enabled, so the default path stays Showdown's own class. */
  if (name === 'random' && RANDMOVE < 1) return randomSwitcher();
  if (name === 'score') return require('./magnemite.js').makeScoringPlayer();
  /* score@<path> — MAG as it exists in ANOTHER CHECKOUT of this repository.
   *
   * Comparing two versions of a model by running each against a third opponent and subtracting the
   * two win rates is a much weaker claim than it sounds: the intervals are wide, the third opponent
   * may be bad enough to compress both, and nothing is seed-matched across the two runs. The only
   * clean answer is to put the two versions on opposite sides of the SAME battle.
   *
   * That cannot be done with a weight file, because the feature LIST changes between versions and
   * magnemite.js correctly refuses a vector that does not match. So the other version is loaded from
   * its own tree, with its own board.js and its own weights, as a genuinely separate module.
   *
   *   git worktree add ../ABRA-old <commit>
   *   node engine/mew.js --policy score --policy2 score@../ABRA-old
   */
  if (name.startsWith('score@')) {
    const other = path.resolve(name.slice('score@'.length));
    const mod = path.join(other, 'engine', 'magnemite.js');
    if (!fs.existsSync(mod)) throw new Error(`no magnemite.js under ${other}`);
    const made = require(mod).makeScoringPlayer();
    process.stderr.write(`  policy score@${other}: ${require(path.join(other, 'engine', 'board.js')).FEATURES.length} features
`);
    return made;
  }
  return simBits().RandomPlayerAI;
}

async function playOne(teamA, teamB, seed, forceSwap) {
  const { BattleStream, getPlayerStreams, RandomPlayerAI, Teams } = simBits();
  /* THE SETS MUST VARY BETWEEN GAMES, AND FOR 199,524 GAMES THEY DID NOT.
   *
   * packTeam passes `setsBySpecies.__seed` down to fillSet, defaulting to 1 when absent — and this
   * call never supplied one. So every draw used seed 1 and every Incineroar in the entire run was
   * byte-identical: Sitrus Berry, Darkest Lariat / Throat Chop / Parting Shot / Fake Out, Careful,
   * 32/-/14/-/20/-. Twenty-five packTeam calls on the same six produced ONE distinct team.
   *
   * set_priors.js opens by defending sampled-over-modal sets precisely because "a generator that
   * always plays the same line explores a narrow band of states". That intent was defeated by a
   * default argument, silently, for the whole run — the games explored exactly one build per
   * species, which is a far narrower world than the format.
   *
   * The battle seed is per game and already disjoint across workers, so deriving from it gives
   * variety across games while keeping a run exactly reproducible. The two sides are offset so a
   * mirror match does not hand both players the identical build. */
  const A = CS.packTeam(teamA.six, Object.assign({}, teamA.sets, { __seed: seed * 2 + 1 }));
  const B = CS.packTeam(teamB.six, Object.assign({}, teamB.sets, { __seed: seed * 2 + 2 }));
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
  const Player = pickPolicy(POLICY);

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
  /* MEGA EVOLUTION MUST BE TURNED ON EXPLICITLY.
   *
   * RandomPlayerAI does `this.mega = options.mega || 0`, so the default is NEVER. We never passed
   * the option, so across 199,524 self-play games the bots mega-evolved essentially zero times —
   * while 93% of real ladder games contain one, in a format built around megas. The corpus was
   * missing the defining mechanic of the game.
   *
   * The option is a per-decision probability, which happens to model the real behaviour well: a
   * high value means the mega usually happens the first turn the Pokemon is on the field, and
   * occasionally a turn or two later. That matches how it actually goes — most players mega turn 1,
   * some wait. It is deliberately NOT 1.0, because megaing immediately every single time is its own
   * kind of wrong.
   *
   * The engine enforces the rest: one mega per side per battle. So a team carrying two stones
   * behaves correctly on its own — whichever eligible Pokemon is out first takes it, and the other
   * plays on unevolved, which is exactly the Tyranitar-holding-a-stone-while-Steelix-megas case.
   *
   * IT IS A FLAG BECAUSE IT IS A TUNING KNOB, AND KNOBS GET SWEPT. Fixed at 0.85 it could only be
   * argued about; exposed, its effect on the mega rate can be measured. Note also that this
   * probability is NOT the mega rate: RandomPlayerAI spends the roll on the first available form
   * change in the order terastallize -> dynamax -> mega, so in Gen 9 a Tera consumes it and the mega
   * waits for another turn. Raising this number has less effect than it looks like it should. */
  /* SIDES ALTERNATE — AND THE FIRST VERSION OF THIS COMMENT GAVE THE WRONG REASON.
   *
   * It said p1 might enjoy a move-order advantage. It does not. Pokemon is SIMULTANEOUS: both sides
   * lock in without seeing the other, and execution order is priority, then Speed, then a random
   * tie-break (Battle.speedSort collects equal-speed actors and shuffles them). There is no seat
   * that moves first, so there is nothing there to cancel.
   *
   * The swap is kept because a DIFFERENT asymmetry is real: games are indexed against a triangular
   * enumeration of unordered team pairs (a <= b), so team A is always the lower-indexed team and
   * team B the higher. The team list is not in arbitrary order, so the seat correlates with which
   * team you are handed. Alternating cancels that, which is what the p1/p2 split in the head-to-head
   * output is there to verify — measured at 61.4% and 59.0%, a gap well inside noise. */
  /* WHICH POLICY SITS ON WHICH SIDE. Normally seed parity, which is fine when every game has its own
   * seed. In --paired mode both halves of a pair share a seed on purpose, so parity would hand them
   * the SAME assignment and the pair would prove nothing -- caught by a two-game run reporting
   * "swapped" on both halves. The caller states it explicitly there. */
  const swapped = forceSwap == null ? !!(POLICY2 && (seed % 2 === 1)) : !!(POLICY2 && forceSwap);
  const PlayerB = POLICY2 ? pickPolicy(POLICY2) : Player;
  const optA = { seed: pseed(1), mega: MEGA_P, keepThoughts: THOUGHTS, move: RANDMOVE, switching: SWITCHING };
  const optB = { seed: pseed(2), mega: MEGA_P, keepThoughts: THOUGHTS, move: RANDMOVE, switching: SWITCHING };
  if (WEIGHTS1) { (swapped ? optB : optA).weightsFile = WEIGHTS1; }
  if (WEIGHTS2) { (swapped ? optA : optB).weightsFile = WEIGHTS2; }
  const [PA, PB] = swapped ? [PlayerB, Player] : [Player, PlayerB];
  const p1 = new PA(streams.p1, optA);
  const p2 = new PB(streams.p2, optB);
  p1.start(); p2.start();

  void streams.omniscient.write(
    `>start ${JSON.stringify({ formatid: FORMAT_ARG || CS.FORMAT, seed: [seed & 0xffff, (seed >> 4) & 0xffff, (seed >> 8) & 0xffff, (seed >> 12) & 0xffff] })}\n` +
    `>player p1 ${JSON.stringify({ name: 'MEW-A', team: A.packed })}\n` +
    `>player p2 ${JSON.stringify({ name: 'MEW-B', team: B.packed })}`);

  let log = '';
  for await (const chunk of streams.omniscient) log += chunk + '\n';
  if (!/\|win\|/.test(log)) return null;       // never resolved; not evidence either way
  /* Return the policy's own accounting alongside the log. A prior sampler that quietly degrades to
   * uniform random is indistinguishable from a working one unless the rate is reported, and that is
   * precisely how ADR-001 attempt 3 produced a 32.2-point number that measured nothing. */
  const st = (p) => (p && p.stats) ? p.stats : null;
  return { log, swapped, stats: [st(p1), st(p2)].filter(Boolean) };
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
  const POL = { sampled: 0, fellBack: 0, noPrior: 0, invalidTeam: 0, previewSampled: 0, previewDefault: 0,
                scored: 0, scoreFellBack: 0, aimed: 0 };

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
      /* In paired mode consecutive indices are the SAME matchup on the same seed, played both ways. */
      const gi = PAIRED ? (i >> 1) : i;
      const seed = SEED0 + gi;
      const k = ((gi % TOTAL) * STRIDE + OFF) % TOTAL;
      const [ai, bi] = pairForIndex(k);
      /* SIDES MUST BE SHUFFLED, OR THE ENUMERATION ITSELF CREATES A SIDE BIAS.
       *
       * pairForIndex returns the pair with ai <= bi, so sending ai to p1 unconditionally puts every
       * low-index team permanently on p1 and every high-index team permanently on p2. The pool is
       * ordered by first appearance in the store, which tracks usage, so that is not a neutral
       * ordering — it systematically sorts teams by side.
       *
       * MEASURED on the first 200,004-game corpus: p1 won 50.86% of 119,826 non-mirror games, 95% CI
       * [50.58, 51.15] — excluding 50. The 174 mirror games showed nothing (CI [45.5, 60.2]),
       * confirming the harness is fair and the ordering was the culprit.
       *
       * This slipped through because validate_selfplay's mirror check runs 300 battles, which can
       * only resolve a bias of about +/-5.6 points. An 0.9-point bias is invisible to it by
       * construction — the same underpowered-null trap that has caught this project before. The
       * validator now also checks side balance across the WHOLE corpus, where n is large enough to
       * see it.
       *
       * The swap is keyed to the seed, so it stays deterministic and reproducible. */
      /* PAIRED SIDES. Without this, side assignment is a hash and roughly half the games are
       * swapped -- but every game has DIFFERENT teams, so a team-difficulty advantage does not
       * cancel, it merely averages out with a great deal of noise. In `--paired` mode the same
       * matchup and the same seed are played twice, once each way, so whatever edge the teams carry
       * appears identically on both sides of the comparison and cancels exactly. It is the
       * difference between an unpaired and a paired test, and it costs nothing but a second battle. */
      /* In paired mode the TEAMS stay put and the POLICIES change sides -- that is the whole point.
       * Swapping the teams instead would leave each bot facing a different opponent and cancel
       * nothing, which is exactly what the first version of this did. */
      const swap = PAIRED ? 0 : (((k * 2654435761) >>> 0) & 1);
      const a = teams[swap ? bi : ai], b = teams[swap ? ai : bi];
      let res = null;
      try { res = await playOne(a, b, seed, PAIRED ? (i & 1) : null); } catch (e) { failed++; }
      if (res && res.invalid) { POL.invalidTeam++; res = null; }
      done++;
      if (!res) { failed++; continue; }
      const log = res.log;
      for (const s of (res.stats || [])) {
        POL.sampled += s.sampled; POL.fellBack += s.fellBack; POL.noPrior += s.noPrior;
        POL.previewSampled += s.previewSampled || 0; POL.previewDefault += s.previewDefault || 0;
        POL.scored += s.scored || 0; POL.scoreFellBack += s.scoreFellBack || 0; POL.aimed += s.aimed || 0;
      }
      const rec = extract(`selfplay-${SEED0}-${i}`, startedAt, log);
      if (!rec || (rec.six.p1 || []).length < 4 || (rec.six.p2 || []).length < 4) { failed++; continue; }
      /* Provenance on every record. A self-play game that ever loses its label becomes
       * indistinguishable from a real one, and that is unrecoverable. */
      rec.source = 'selfplay';
      rec.selfplay = { engine_commit: CS.PINNED_COMMIT, format: FORMAT_ARG || CS.FORMAT, policy: POLICY, seed };
      /* Recorded so a run can describe ITSELF later. Two runs tonight differed only in whether the
       * random opponent could switch, and nothing in the file said so. */
      if (RANDMOVE !== 1) rec.selfplay.randmove = RANDMOVE;
      if (POLICY2) {
        /* Which POLICY won, not which side. `swapped` says where the challenger sat this battle. */
        const sw = res && res.swapped;
        rec.selfplay.policy2 = POLICY2;
        rec.selfplay.swapped = !!sw;
        const p1won = rec.winner && rec.p1 && rec.winner === rec.p1.name;
        rec.selfplay.winnerPolicy = p1won ? (sw ? POLICY2 : POLICY) : (sw ? POLICY : POLICY2);
      }
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
  /* THE SCORING POLICY HAS ITS OWN COUNTER AND MUST BE CHECKED ON ITS OWN TERMS. It does not
   * "sample from priors" at all -- it scores -- so the prior-sampling line below would read 0% for a
   * perfectly healthy run and 0% is the exact signature of the ADR-001 attempt 3 failure. Reporting
   * the wrong counter for a mode is how a broken run gets waved through. */
  if (POLICY === 'score') {
    const st = POL.scored + POL.scoreFellBack;
    if (st) {
      process.stderr.write(`  policy=score: ${(100 * POL.scored / st).toFixed(1)}% of decisions scored against the board ` +
        `(${POL.scoreFellBack.toLocaleString()} fell back to the prior sampler)\n`);
      process.stderr.write(`  aiming: ${POL.aimed.toLocaleString()} decisions chose WHICH foe to hit ` +
        `(the prior policy leaves that to a coin flip)\n`);
      if (POL.scored === 0) {
        process.stderr.write('  WARNING: the scoring policy scored NOTHING. It is running as the prior sampler.\n');
      }
    } else {
      process.stderr.write('  WARNING: policy=score reported no decisions at all -- it is not wired.\n');
    }
  }
  /* Gated on the mode, not on whether the counter happens to be non-zero. The scoring policy still
   * falls back to the prior sampler a few dozen times a batch (no active user, no scorable
   * candidate), which was enough to make `tot` truthy and print "0.0% sampled from priors" followed
   * by "the policy sampled NOTHING — do not use this batch" over a run in which every single
   * decision was scored correctly. */
  const tot = POLICY === 'score' ? 0 : POL.sampled + POL.fellBack + POL.noPrior;
  if (tot) {
    const pct = (100 * POL.sampled / tot).toFixed(1);
    process.stderr.write(`  policy=${POLICY}: ${pct}% of decisions sampled from priors ` +
      `(${POL.fellBack} fell back — move illegal this turn, ${POL.noPrior} had no prior for the species)\n`);
    if (POL.sampled === 0) {
      process.stderr.write('  WARNING: the policy sampled NOTHING. It is running as uniform random.\n');
      process.stderr.write('  This is ADR-001 attempt 3 recurring. Do not use this batch.\n');
    }
  } else if (POLICY !== 'random' && POLICY !== 'score') {
    /* `score` is excluded because it does not sample priors and reports through its own counter
     * above. Leaving it here fired a "not wired" warning on a run in which 100% of decisions were
     * scored — a false alarm on this line is worse than none, because this is the line that is
     * supposed to catch a genuinely dead policy. */
    process.stderr.write(`  WARNING: policy=${POLICY} reported no decisions at all — it is not wired.\n`);
  }

  /* TEAM PREVIEW ACCOUNTING, reported for EVERY policy that has a preview sampler.
   *
   * This used to sit inside the prior-sampling branch, so it vanished the moment a policy stopped
   * reporting prior samples — the scoring policy inherits the same preview sampler and its
   * degradation would have gone unreported. The failure it exists to catch is invisible in the games
   * themselves: without data/bring-priors.json every team simply brings the same four, forever. */
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
}

module.exports = { realTeams, playOne };
if (require.main === module) main();
