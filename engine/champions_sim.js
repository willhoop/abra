/* champions_sim.js — run real Champions battles through Showdown's OFFICIAL simulator.
 *
 * WHY THIS EXISTS (see docs/ADR-001-use-the-champions-mod.md)
 * ----------------------------------------------------------
 * `medicham2-browser.js` is a rules engine written by hand. In one session it was found to apply a
 * uniformly random status, to flinch only on Fake Out, to ignore every type immunity, to treat all
 * fourteen negative-priority moves as priority 0, and to apply Intimidate with the wrong SIGN against
 * Defiant. Correcting those changed P(win) by 4.35 points on average across 120 real matchups and
 * flipped the favourite in 9.2% of them.
 *
 * Showdown's `champions` mod implements this exact format - `gen9championsvgc2026regmb` is the format
 * id on every replay in our store. Running the real simulator removes an entire class of defect
 * rather than fixing them one at a time.
 *
 * SPEED, MEASURED. 29 battles/sec/core versus 3,401 for the hand-written engine: 117x slower. That is
 * fine for offline batch work (the 927-game backtest is ~7 minutes on 8 cores) and impossible for a
 * live browser click. So this module is for OFFLINE precomputation only. Nothing here should ever be
 * on a request path.
 *
 * REQUIRES a built checkout of pokemon-showdown master, because the champions mod is NOT in the
 * published npm package (0.11.10 does not contain it). Point SHOWDOWN_PATH at it.
 *
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/champions_sim.js
 */
'use strict';
const path = require('path');

const FORMAT = 'gen9championsvgc2026regmb';
// Pinned, not floating: the mod lives only on master, so there is no version number to depend on.
const PINNED_COMMIT = '20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4';
const PINNED_DATE = '2026-07-22';

function showdownPath() {
  return process.env.SHOWDOWN_PATH || '/tmp/ps';
}

let _sim = null;
function sim() {
  if (_sim) return _sim;
  const base = showdownPath();
  try {
    const dist = path.join(base, 'dist', 'sim');
    _sim = {
      Dex: require(path.join(dist, 'index')).Dex,
      Teams: require(path.join(dist, 'index')).Teams,
      BattleStream: require(path.join(dist, 'battle-stream')).BattleStream,
      getPlayerStreams: require(path.join(dist, 'battle-stream')).getPlayerStreams,
      RandomPlayerAI: require(path.join(base, 'dist', 'sim', 'tools', 'random-player-ai')).RandomPlayerAI,
    };
  } catch (e) {
    throw new Error(
      `Could not load the Showdown simulator from ${base}.\n` +
      `The champions mod is NOT in the npm package - a built master checkout is required:\n` +
      `    git clone --depth 1 https://github.com/smogon/pokemon-showdown\n` +
      `    cd pokemon-showdown && npm install && node build\n` +
      `Then set SHOWDOWN_PATH. Original error: ${e.message}`);
  }
  return _sim;
}

/* Confirm the mod is present and is the format our data actually came from. Called before any batch
 * job, because silently running a DIFFERENT format would produce numbers that look fine and are not. */
function verify() {
  const { Dex } = sim();
  const fmt = Dex.formats.get(FORMAT);
  const ok = fmt && fmt.exists;
  return {
    ok: !!ok,
    format: FORMAT,
    name: ok ? fmt.name : null,
    mod: ok ? fmt.mod : null,
    pinned_commit: PINNED_COMMIT,
    pinned_date: PINNED_DATE,
    champions_formats: Dex.formats.all().filter(f => /champions/i.test(f.id)).length,
  };
}

/* Build a packed team string the simulator will accept.
 *
 * The store records what a replay REVEALED - often two or three moves and sometimes no item. The
 * simulator needs a complete legal set. We fill the gaps from the dex rather than inventing them,
 * and the caller is told which slots were filled so the uncertainty is visible rather than hidden. */
function packTeam(species, setsBySpecies) {
  const { Dex, Teams } = sim();
  const dex = Dex.forFormat(FORMAT);
  const team = [];
  const filled = [];
  for (const name of species) {
    const sp = dex.species.get(name);
    if (!sp || !sp.exists) { filled.push(`${name}: UNKNOWN SPECIES`); continue; }
    const known = (setsBySpecies && setsBySpecies[name]) || {};
    let moves = (known.moves || []).slice(0, 4);
    if (moves.length < 4) {
      // fill from the species' own learnset, deterministically, so runs are reproducible
      const learn = dex.species.getLearnsetData(sp.id);
      const pool = learn && learn.learnset ? Object.keys(learn.learnset) : [];
      for (const mv of pool) {
        if (moves.length >= 4) break;
        const m = dex.moves.get(mv);
        if (!m || !m.exists || m.category === 'Status') continue;
        if (moves.some(x => dex.moves.get(x).id === m.id)) continue;
        moves.push(m.name);
      }
      filled.push(`${name}: moves`);
    }
    if (!moves.length) moves = ['Tackle'];
    const ability = known.ability || (sp.abilities && sp.abilities['0']) || '';
    if (!known.ability) filled.push(`${name}: ability`);
    team.push({
      name: sp.name, species: sp.name,
      item: known.item || '',
      ability,
      moves,
      nature: known.nature || 'Hardy',
      // Champions uses SP, not EVs, and the budget is 66. Spread it evenly when unknown rather than
      // maximising, because maximising would systematically overstate every unknown Pokemon.
      evs: known.evs || { hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      level: 50,
      gender: '',
    });
  }
  return { packed: Teams.pack(team), filled, size: team.length };
}

/* One battle to a winner. Both sides play randomly - this measures the MATCHUP, not the players.
 * That is the same assumption the hand-written engine makes, so the two are comparable. */
async function battle(packedA, packedB, seed) {
  const { BattleStream, getPlayerStreams, RandomPlayerAI } = sim();
  const stream = new BattleStream();
  const streams = getPlayerStreams(stream);
  const spec = { formatid: FORMAT };
  if (seed) spec.seed = seed;
  const p1 = new RandomPlayerAI(streams.p1);
  const p2 = new RandomPlayerAI(streams.p2);
  p1.start(); p2.start();
  void streams.omniscient.write(
    `>start ${JSON.stringify(spec)}\n` +
    `>player p1 ${JSON.stringify({ name: 'A', team: packedA })}\n` +
    `>player p2 ${JSON.stringify({ name: 'B', team: packedB })}`);
  let winner = null;
  for await (const chunk of streams.omniscient) {
    const m = /\|win\|(.*)/.exec(chunk);
    if (m) winner = m[1].trim();
  }
  return winner;
}

/* P(A wins) over N battles, with a Wilson interval - because a rollout estimate without an interval
 * invites reading noise as signal. At N=100 the interval is roughly +/- 10 points, which is worth
 * knowing before anyone quotes a number to one decimal place. */
async function winProb(speciesA, speciesB, N, setsBySpecies) {
  const A = packTeam(speciesA, setsBySpecies);
  const B = packTeam(speciesB, setsBySpecies);
  if (!A.size || !B.size) return null;
  let wins = 0, played = 0;
  for (let i = 0; i < N; i++) {
    const w = await battle(A.packed, B.packed);
    if (w === null) continue;      // a battle that never resolved is not evidence either way
    played++;
    if (w === 'A') wins++;
  }
  if (!played) return null;
  const p = wins / played, z = 1.96, d = 1 + z * z / played;
  const c = (p + z * z / (2 * played)) / d;
  const h = z * Math.sqrt(p * (1 - p) / played + z * z / (4 * played * played)) / d;
  return { p, wins, played, lo: Math.max(0, c - h), hi: Math.min(1, c + h),
           filled: A.filled.concat(B.filled) };
}

module.exports = { FORMAT, PINNED_COMMIT, PINNED_DATE, verify, packTeam, battle, winProb, sim };

if (require.main === module) {
  const v = verify();
  console.log('CHAMPIONS SIMULATOR');
  console.log(`  format        ${v.format}  ${v.ok ? 'FOUND' : 'NOT FOUND'}`);
  console.log(`  name          ${v.name}`);
  console.log(`  mod           ${v.mod}`);
  console.log(`  champions fmts ${v.champions_formats}`);
  console.log(`  pinned        ${v.pinned_commit.slice(0, 12)} (${v.pinned_date})`);
  if (!v.ok) process.exit(1);
}
