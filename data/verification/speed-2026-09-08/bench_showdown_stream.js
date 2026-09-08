/* bench_showdown_stream.js — Showdown THE DOCUMENTED WAY: BattleStream + the official RandomPlayerAI.
 *
 * The raw-`Battle` arm in bench_two_engines.js is an UPPER BOUND on Showdown throughput: no streams,
 * no protocol strings parsed, my own chooser. This measures what the README actually tells a public
 * user to write (@pkmn/sim's usage block and smogon/pokemon-showdown's sim/README), so that "how fast
 * is the public alternative" is answered at the interface people would really use.
 *
 * Same machine, same pinned team pool, same format. Teams come from the same buildPair path so the
 * SAMPLE is the same one the other arm played.
 */
'use strict';
const path = require('path');
const ROOT = 'C:/Users/willj/Projects/Pokemon/ABRA';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const ms = (a, b) => Number(b - a) / 1e6;
const SD_PATH = arg('--sd', 'C:/Users/willj/Projects/Pokemon/pokemon-showdown/dist/sim/index.js');
const GAMES = Math.max(1, +arg('--games', 100));
const REPS = Math.max(1, +arg('--reps', 3));

/* THE SMOGON PACKAGE AND @pkmn/sim EXPORT DIFFERENT SHAPES, AND GUESSING COST A WHOLE RUN.
 * smogon/pokemon-showdown's dist/sim/index.js exports `BattleStream` and `getPlayerStreams` at the
 * top level and does NOT export RandomPlayerAI at all (it lives in dist/sim/tools/random-player-ai).
 * @pkmn/sim exports a `BattleStreams` namespace and re-exports RandomPlayerAI, which is the shape its
 * README's usage block shows. The first version of this file wrote the @pkmn shape against the smogon
 * module: 312 games threw, the counter caught it, and every timing read zero. Resolved from whichever
 * module is loaded rather than assumed. */
const SDX = require(SD_PATH);
const Teams = SDX.Teams;
const BattleStreams = SDX.BattleStreams || SDX;
const RandomPlayerAI = SDX.RandomPlayerAI
  || require(path.join(path.dirname(SD_PATH), 'tools', 'random-player-ai.js')).RandomPlayerAI;
if (!RandomPlayerAI) throw new Error('no RandomPlayerAI in ' + SD_PATH);
const REL = require(ROOT + '/engine/engine_release.js').open(arg('--release', null));
const CS = REL.require('engine/champions_sim.js');
const SWARM = require(ROOT + '/engine/diff_swarm.js');
const GD = require(ROOT + '/engine/game_differential.js');
const TEAMS = SWARM.loadTeams({ storeDir: arg('--team-store', 'data/team-pool-frozen') });

const C = { build_fail: 0, game_threw: 0 };
function packed(sheet) {
  try {
    const p = GD.buildPair(sheet, { max: 4 });
    const ok = (p || []).filter(x => x && x.medi);
    if (ok.length < 4) { C.build_fail++; return null; }
    return Teams.pack(ok.map(x => x.sd));
  } catch (e) { C.build_fail++; return null; }
}
const packs = [];
{
  const step = Math.max(1, Math.floor(TEAMS.length / 90));
  for (let i = 0; packs.length < 80 && i < TEAMS.length; i += step) {
    const t = packed(TEAMS[i].team); if (t) packs.push(t);
  }
}

async function oneGame(a, b) {
  const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());
  const spec = { formatid: CS.FORMAT };
  const p1 = new RandomPlayerAI(streams.p1);
  const p2 = new RandomPlayerAI(streams.p2);
  void p1.start(); void p2.start();
  let turns = 0, ended = false;
  const drain = (async () => {
    for await (const chunk of streams.omniscient) {
      for (const line of String(chunk).split('\n')) {
        if (line.startsWith('|turn|')) turns = +line.slice(6) || turns;
        else if (line.startsWith('|win|') || line.startsWith('|tie')) ended = true;
      }
    }
  })();
  await streams.omniscient.write('>start ' + JSON.stringify(spec) + '\n'
    + '>player p1 ' + JSON.stringify({ name: 'A', team: a }) + '\n'
    + '>player p2 ' + JSON.stringify({ name: 'B', team: b }));
  await drain;
  return { turns, ended };
}

(async () => {
  console.log('');
  console.log('SHOWDOWN, THE DOCUMENTED WAY — BattleStream + RandomPlayerAI');
  console.log('  module   ' + SD_PATH);
  console.log('  format   ' + CS.FORMAT + '   commit ' + (CS.actualCommit() || 'UNKNOWN'));
  console.log('  teams    ' + packs.length + ' packed from the pinned pool (' + C.build_fail + ' build failures)');
  console.log('');
  /* warm-up, discarded */
  for (let i = 0; i < 12; i++) { try { await oneGame(packs[i % packs.length], packs[(i + 7) % packs.length]); } catch (e) { C.game_threw++; } }
  const legs = [];
  for (let r = 0; r < REPS; r++) {
    let turns = 0, games = 0, ended = 0;
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < GAMES; i++) {
      try {
        const g = await oneGame(packs[i % packs.length], packs[(i + 13) % packs.length]);
        turns += g.turns; games++; if (g.ended) ended++;
      } catch (e) { C.game_threw++; }
    }
    const el = ms(t0, process.hrtime.bigint());
    legs.push({ rep: r, games, turns, ms: +el.toFixed(1),
      games_per_sec: +(games / (el / 1000)).toFixed(2),
      ms_per_turn: +(el / Math.max(1, turns)).toFixed(4),
      turns_per_sec: +(turns / (el / 1000)).toFixed(0),
      mean_turns: +(turns / Math.max(1, games)).toFixed(2),
      ended_pct: +(100 * ended / Math.max(1, games)).toFixed(1) });
    console.log('  rep ' + r + '  ' + JSON.stringify(legs[r]));
  }
  const best = legs.reduce((a, b) => (b.games_per_sec > a.games_per_sec ? b : a));
  console.log('');
  console.log('  FASTEST LEG: ' + best.games_per_sec + ' games/sec, ' + best.turns_per_sec
    + ' turns/sec, ' + best.ms_per_turn + ' ms/turn, mean ' + best.mean_turns + ' turns, '
    + best.ended_pct + '% reached a result');
  console.log('  counters: ' + JSON.stringify(C));
  console.log('');
})();
