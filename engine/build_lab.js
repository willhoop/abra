/* build_lab.js — which build of a Pokemon actually wins more? A controlled self-play experiment.
 *
 * WHY THIS IS THE RIGHT USE OF A GENERATOR
 * ----------------------------------------
 * This project measured, repeatedly, that predicting a winner from team sheets is near-impossible:
 * JOLTEON ties a coin, GURU finds no decisive matchup, CHOMP's bring ranking does not beat chance.
 * All of those are OBSERVATIONAL — they take games as they come and try to explain them.
 *
 * This is an EXPERIMENT. Everything is held fixed except the one set under test, so the comparison
 * is not fighting the variance that swamped the observational work:
 *
 *   - the rest of the team is identical across arms
 *   - the opponents are the SAME sampled teams, in the same order, for every arm
 *   - the battle seed for opponent i is the same in every arm, so the dice are shared
 *
 * That is a PAIRED design. Each build meets an identical gauntlet, so the comparison is
 * within-opponent rather than between-samples, and the interval shrinks accordingly. It is the same
 * reason a crossover trial needs fewer subjects than two independent groups.
 *
 * WHAT IT CANNOT TELL YOU, and this is not a small caveat:
 *   - The pilot is a WEAK POLICY that samples moves by usage and never reads the board. A build that
 *     suits it may not suit a human. Any result here is "better in the hands of this bot", never
 *     "better".
 *   - Opponents are reconstructions of real teams, not the real sets.
 *   - It ranks builds against the CURRENT sampled meta. A build that beats the field today is not
 *     a build that beats a specific opponent tomorrow.
 *
 * MULTIPLE COMPARISONS ARE CORRECTED. Testing twenty builds and reporting the best one is how you
 * manufacture a finding from noise -- counters.py already had that exact failure, five "significant"
 * results at p~0.048 that were nothing. Every arm is compared to the field baseline with a
 * Benjamini-Hochberg correction across the family, and a build is only called better if it survives.
 *
 *   SHOWDOWN_PATH=... node engine/build_lab.js --species incineroar --builds 8 --games 400
 *   node engine/build_lab.js --species garchomp --builds 12 --games 600 --team "garchomp,incineroar,whimsicott,sinistcha,charizard,basculegion"
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const SP = require('./set_priors.js');
const { extract } = require('./durable-ingest.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt;
}
const SPECIES = norm(arg('species', 'incineroar'));
const NBUILDS = parseInt(arg('builds', '8'), 10);
const NGAMES = parseInt(arg('games', '300'), 10);
const SEED0 = parseInt(arg('seed', '4242'), 10);
const TEAM = arg('team', '');
const OUT = arg('out', '');
const OPP = arg('opponent', 'prior');   // prior | random — see makeOpponent

if (!process.env.SHOWDOWN_PATH) {
  console.error('set SHOWDOWN_PATH to a BUILT pokemon-showdown master checkout');
  process.exit(2);
}

/* ---- statistics --------------------------------------------------------------------------------
 * Wilson for a single rate, and a PAIRED test between arms. Paired matters: the same opponents and
 * the same dice are used for every build, so the right comparison is the per-opponent difference,
 * not two independent proportions. */
function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0, 1];
  const p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [p, Math.max(0, c - h), Math.min(1, c + h)];
}
/* Two-sided p from a normal z, Abramowitz-Stegun 7.1.26 (same approximation counters.py uses). */
function pFromZ(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return Math.max(0, Math.min(1, 1 - erf));
}
/* McNemar-style paired comparison on win/loss vectors against identical opponents. */
function pairedP(a, b) {
  let win = 0, lose = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i] === b[i]) continue;
    if (a[i]) win++; else lose++;
  }
  const n = win + lose;
  if (n < 2) return { diff: 0, p: 1, n };
  const z = (win - lose) / Math.sqrt(n);
  return { diff: (win - lose) / a.length, p: pFromZ(z), n };
}

/* ---- OPPONENT STRENGTH IS A KNOB, AND THE RANKING MUST SURVIVE TURNING IT --------------------
 *
 * A build tested only against one kind of bad play is optimised for that bad play. Our pilots do
 * not respect Fake Out, so a Fake Out build collects free damage every game and looks excellent —
 * and would look far worse against a human who expects it. That is overfitting to the opponent
 * distribution, the classic failure mode of self-play, and no amount of extra games fixes it
 * because more games only make the wrong number more precise.
 *
 * We cannot test against a strong opponent because none exists yet. We CAN test whether the ranking
 * is STABLE when opponent strength changes: run the same gauntlet against usage-sampling opponents
 * and against uniform-random ones. A build that wins under both is more likely to be genuinely
 * better; a ranking that flips was measuring the opponent, not the build.
 *
 * This is a necessary condition, not a sufficient one. Surviving it does not mean the build is good
 * against humans — only that it is not exploiting one particular flavour of weak play. */
function makeOpponent(kind) {
  if (kind === 'random') return CS.sim().RandomPlayerAI;
  return require('./prior_player.js').makePriorPlayer();
}

async function playOne(packA, packB, seed, oppKind) {
  const { BattleStream, getPlayerStreams } = CS.sim();
  const Player = require('./prior_player.js').makePriorPlayer();
  const Opp = makeOpponent(oppKind);
  const stream = new BattleStream();
  const streams = getPlayerStreams(stream);
  /* The player seed is Showdown's four-word PRNG format, not a bare integer — passing a number
   * leaves this.prng without a .random(). Same derivation mew.js uses. */
  const pseed = (off) => {
    const s = (seed + off * 0x9E3779B1) >>> 0;
    return [s & 0xffff, (s >>> 4) & 0xffff, (s >>> 8) & 0xffff, (s >>> 12) & 0xffff];
  };
  const p1 = new Player(streams.p1, { seed: pseed(1), mega: 0.85 });
  const p2 = new Opp(streams.p2, { seed: pseed(2), mega: 0.85 });
  p1.start(); p2.start();
  void streams.omniscient.write(
    `>start ${JSON.stringify({ formatid: CS.FORMAT, seed: [seed & 0xffff, (seed >> 4) & 0xffff, (seed >> 8) & 0xffff, (seed >> 12) & 0xffff] })}\n` +
    `>player p1 ${JSON.stringify({ name: 'LAB', team: packA })}\n` +
    `>player p2 ${JSON.stringify({ name: 'FIELD', team: packB })}`);
  let log = '';
  for await (const c of streams.omniscient) log += c + '\n';
  const w = (log.match(/\|win\|(.*)/) || [])[1];
  return w ? w.trim() === 'LAB' : null;
}

(async () => {
  const teams = require('./mew.js').realTeams();
  if (teams.length < 2) { console.error('no team pool'); process.exit(1); }

  /* The team carrying the species under test. Either given, or the most common real team that
   * actually contains it — using a real team keeps the rest of the build plausible. */
  let base = TEAM ? TEAM.split(',').map(s => s.trim()).filter(Boolean) : null;
  if (!base) {
    const withIt = teams.filter(t => t.six.some(x => norm(x) === SPECIES));
    if (!withIt.length) { console.error(`no team in the pool contains ${SPECIES}`); process.exit(1); }
    withIt.sort((a, b) => (b.n || 1) - (a.n || 1));
    base = withIt[0].six;
  }
  if (!base.some(x => norm(x) === SPECIES)) { console.error(`--team does not contain ${SPECIES}`); process.exit(1); }

  /* THE SAME GAUNTLET FOR EVERY ARM. Opponents and their seeds are fixed up front. */
  const field = [];
  for (let i = 0; i < NGAMES; i++) {
    const t = teams[(Math.imul(SEED0 + i, 2654435761) >>> 0) % teams.length];
    field.push({ six: t.six, sets: t.sets, seed: SEED0 + i * 7919 });
  }

  /* Candidate builds: draw distinct sets for the species from the measured priors. */
  const builds = [];
  const seenKey = new Set();
  for (let s = 1; builds.length < NBUILDS && s < NBUILDS * 60; s++) {
    const f = SP.fillSet(base.find(x => norm(x) === SPECIES), {}, s * 104729);
    const key = (f.moves || []).map(norm).sort().join(',') + '|' + norm(f.item) + '|' + norm(f.ability);
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    builds.push({ id: builds.length + 1, set: f, key });
  }
  if (builds.length < 2) { console.error('could not draw enough distinct builds'); process.exit(1); }

  console.log(`BUILD LAB — ${SPECIES}`);
  console.log(`  team    : ${base.join(', ')}`);
  console.log(`  builds  : ${builds.length}`);
  console.log(`  gauntlet: ${NGAMES} opponents, identical and seed-matched for every build`);
  console.log(`  total   : ${(builds.length * NGAMES).toLocaleString()} battles\n`);

  const results = [];
  for (const b of builds) {
    /* Force this exact set for the species; everything else on the team fills as usual. */
    const forced = {};
    forced[base.find(x => norm(x) === SPECIES)] = { moves: b.set.moves, item: b.set.item, ability: b.set.ability };
    const wins = [];
    let w = 0, played = 0;
    for (const opp of field) {
      const A = CS.packTeam(base, Object.assign({}, forced, { __seed: opp.seed * 2 + 1 }));
      const B = CS.packTeam(opp.six, Object.assign({}, opp.sets, { __seed: opp.seed * 2 + 2 }));
      let r = null;
      try { r = await playOne(A.packed, B.packed, opp.seed, OPP); } catch (e) { r = null; }
      if (r === null) { wins.push(0); continue; }
      wins.push(r ? 1 : 0);
      if (r) w++;
      played++;
    }
    const [p, lo, hi] = wilson(w, Math.max(1, played));
    results.push({ ...b, w, played, p, lo, hi, wins });
    process.stderr.write(`  build ${b.id}/${builds.length} done: ${(100 * p).toFixed(1)}%\n`);
  }

  /* Compare every arm to the FIELD MEAN, paired, then correct across the family. */
  const meanWins = results[0].wins.map((_, i) => {
    let s = 0; for (const r of results) s += r.wins[i]; return s / results.length;
  });
  for (const r of results) {
    /* paired against the average arm on the same opponent */
    let d = 0; for (let i = 0; i < r.wins.length; i++) d += r.wins[i] - meanWins[i];
    const diff = d / r.wins.length;
    /* variance of the paired difference */
    let v = 0;
    for (let i = 0; i < r.wins.length; i++) { const x = (r.wins[i] - meanWins[i]) - diff; v += x * x; }
    v /= Math.max(1, r.wins.length - 1);
    const se = Math.sqrt(v / Math.max(1, r.wins.length));
    r.diff = diff;
    r.p2 = se > 0 ? pFromZ(diff / se) : 1;
  }
  const m = results.length, alpha = 0.05;
  const byP = results.slice().sort((a, b) => a.p2 - b.p2);
  let cutoff = 0;
  byP.forEach((r, i) => { if (r.p2 <= ((i + 1) / m) * alpha) cutoff = r.p2; });

  results.sort((a, b) => b.p - a.p);
  console.log('\n  rank  win%   95% CI          vs field   p      build');
  console.log('  ' + '-'.repeat(94));
  results.forEach((r, i) => {
    const sig = cutoff > 0 && r.p2 <= cutoff ? ' *' : '';
    console.log('  ' + String(i + 1).padStart(4) +
      (100 * r.p).toFixed(1).padStart(7) + '%' +
      `  [${(100 * r.lo).toFixed(1)}, ${(100 * r.hi).toFixed(1)}]`.padEnd(16) +
      ((r.diff >= 0 ? '+' : '') + (100 * r.diff).toFixed(1)).padStart(8) +
      r.p2.toFixed(3).padStart(8) + sig + '  ' +
      r.set.item + ' | ' + (r.set.moves || []).join('/'));
  });
  console.log('  ' + '-'.repeat(94));
  const survivors = results.filter(r => cutoff > 0 && r.p2 <= cutoff);
  if (survivors.length) {
    console.log(`  ${survivors.length} build(s) differ from the field after Benjamini-Hochberg across ${m} tests.`);
  } else {
    console.log(`  NOTHING survives multiple-comparison correction across ${m} builds.`);
    console.log('  With ' + NGAMES + ' games per arm the smallest detectable paired difference is roughly ' +
      (100 * 1.96 * Math.sqrt(0.25 / NGAMES) * 1.4).toFixed(1) + ' points; run more games to resolve less.');
  }
  console.log('\n  These are win rates IN THE HANDS OF A WEAK PILOT that samples moves by usage and');
  console.log('  never reads the board. A build that suits it need not suit a human.');

  if (OUT) {
    fs.writeFileSync(path.isAbsolute(OUT) ? OUT : D(OUT), JSON.stringify({
      species: SPECIES, team: base, games_per_build: NGAMES, seed: SEED0,
      bh_cutoff: cutoff,
      builds: results.map(r => ({ item: r.set.item, ability: r.set.ability, moves: r.set.moves,
        win: r.p, ci: [r.lo, r.hi], vs_field: r.diff, p: r.p2, significant: cutoff > 0 && r.p2 <= cutoff })),
      caveat: 'win rates under a usage-sampling pilot that does not read the board; not human play',
    }, null, 1));
    console.log(`\n  wrote ${OUT}`);
  }
})();
