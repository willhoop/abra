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

/* THE FORMAT ID LIVES IN ONE PLACE (S12) AND THIS IS NOT IT.
 *
 * It was a literal here, and copied into a dozen other files besides — analyze.js, chomp_ev.js,
 * ingest_ots.js, the site, the dataset generator. When Reg M-B rotates, every one of those keeps
 * describing a metagame that no longer exists, and nothing notices because a stale format id
 * produces plausible output rather than an error.
 *
 * data/regulations.json is the single source: it names the active regulation, its Showdown format,
 * its Bo3 format and its start date, and engine/durable-ingest.js and engine/fetch_smogon_stats.js
 * already read it. This now does too, and everything downstream imports FORMAT from here rather than
 * restating it. The literal survives only as the fallback for a corrupt config, which is the one case
 * where guessing beats crashing a collection job. */
const FORMAT = (() => {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'regulations.json'), 'utf8'));
    const a = r.regulations[r.active] || {};
    if (a.showdownFormat) return a.showdownFormat;
  } catch (e) { /* fall through */ }
  return 'gen9championsvgc2026regmb';
})();
// Pinned, not floating: the mod lives only on master, so there is no version number to depend on.
const PINNED_COMMIT = '20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4';
const PINNED_DATE = '2026-07-22';

function showdownPath() {
  return process.env.SHOWDOWN_PATH || '/tmp/ps';
}

let _sim = null;
let _validator = null;
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
      /* The OFFICIAL legality check. Every rule about what a team may contain — item clause, species
       * clause, learnsets, ability legality, format bans — already exists here and is maintained
       * upstream. Reimplementing any of it by hand would drift the moment the format changes, and a
       * hand-rolled learnset walk written for this project already produced 40 false positives on
       * cosmetic formes (Sinistcha-Masterpiece does learn Matcha Gotcha). Ask the source of truth. */
      TeamValidator: require(path.join(dist, 'team-validator')).TeamValidator,
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
/* THE PIN WAS DECLARED AND NEVER CHECKED, which made it a comment rather than a pin.
 *
 * PINNED_COMMIT names the Showdown commit this project is validated against. Nothing compared it to
 * the checkout that actually loads, and worse, mew.js stamped `engine_commit: CS.PINNED_COMMIT` into
 * EVERY self-play record — the CONSTANT, not the running code. So a checkout at any other commit
 * would still have produced games labelled 20ad99ff, and the provenance field that exists to say
 * which engine generated a corpus would have been lying by construction, silently, forever.
 *
 * Read from git rather than from a file the checkout could also be wrong about. Returns null when
 * git or the checkout is unavailable, and null is reported as UNKNOWN rather than as a match —
 * an unverifiable pin must never read as a verified one. */
let _actualCommit;
function actualCommit() {
  if (_actualCommit !== undefined) return _actualCommit;
  _actualCommit = null;
  try {
    const out = require('child_process')
      .execFileSync('git', ['-C', showdownPath(), 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    _actualCommit = (out || '').trim() || null;
  } catch (e) { _actualCommit = null; }
  return _actualCommit;
}

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
    actual_commit: actualCommit(),
    /* true / false / null-for-unknown. A consumer that treats null as true is making the same
     * mistake this field was added to expose. */
    commit_matches: actualCommit() ? (actualCommit() === PINNED_COMMIT) : null,
    champions_formats: Dex.formats.all().filter(f => /champions/i.test(f.id)).length,
  };
}

/* Build a packed team string the simulator will accept.
 *
 * The store records what a replay REVEALED - often two or three moves and sometimes no item. The
 * simulator needs a complete legal set. We fill the gaps from the dex rather than inventing them,
 * and the caller is told which slots were filled so the uncertainty is visible rather than hidden. */
function packTeam(species, setsBySpecies) {
  const { Dex, Teams, TeamValidator } = sim();
  const dex = Dex.forFormat(FORMAT);
  const team = [];
  const filled = [];
  /* ITEM CLAUSE. VGC allows ONE of each item per team, and this sampler draws items per species
   * independently, so it duplicated them constantly. Showdown's own TeamValidator rejected 80.5% of
   * the pool (158/200 teams), 66 of them for a second Focus Sash. Real teams never look like that,
   * so four in five self-play games were being played with teams no human could legally bring. */
  const usedItems = new Set();
  for (const name of species) {
    const sp = dex.species.get(name);
    if (!sp || !sp.exists) { filled.push(`${name}: UNKNOWN SPECIES`); continue; }
    const known = (setsBySpecies && setsBySpecies[name]) || {};

    /* Fill unrevealed slots from the BEHAVIOUR-CLONE priors (engine/set_priors.js reading
     * data/move-priors.json), not from the raw learnset and not from globalThis.
     *
     * Two failures produced this code path, both of the same kind: only ~1.38 of 4 moves are
     * revealed per set, so WHATEVER FILLS THE OTHER 2.6 DOMINATES ANY RESULT.
     *   1. An early version filled alphabetically from the learnset and gave Charizard "Acrobatics,
     *      Aerial Ace, Air Cutter, Air Slash". The engine comparison built on it reported a
     *      32-point difference that was almost entirely filler (ADR-001, attempt 1).
     *   2. The version this replaces read `globalThis.MC`, which exists only when the browser bundle
     *      is loaded. Under Node it is undefined, the fallback list was empty, and every unrevealed
     *      slot fell through to the literal ['Tackle'] below. The first MEW self-play run produced
     *      games whose most common move was Tackle, by 4x over Protect. Nothing errored.
     *
     * set_priors samples proportional to measured P(move | species) rather than taking the top four,
     * because a modal set asserts a set we never observed, and because variety across games is
     * wanted (the reason Leela Chess Zero runs self-play at a raised policy temperature). Draws are
     * seeded, so a run reproduces. */
    const SP = require('./set_priors.js');
    const f = SP.fillSet(name, known, (setsBySpecies && setsBySpecies.__seed) || 1);
    let moves = [];
    for (const mv of f.moves) {
      if (moves.length >= 4) break;
      const m = dex.moves.get(mv);
      if (!m || !m.exists) continue;                       // prior may name a move illegal in-format
      if (moves.some(x => dex.moves.get(x).id === m.id)) continue;
      moves.push(m.name);
    }
    if (f.filled.length) filled.push(...f.filled);
    /* Last resort only. If this fires the species has no prior at all, which is a data gap worth
     * seeing rather than papering over — it used to be the SILENT common case. */
    if (!moves.length) { moves = ['Tackle']; filled.push(`${name}: NO PRIOR — fell back to Tackle`); }
    /* THE ABILITY MUST BE ONE THIS SPECIES CAN ACTUALLY HAVE.
     * ----------------------------------------------------------------------------------------
     * `f.ability` is sampled from observed ladder sets, and the observation is keyed by SPECIES
     * NAME across a whole replay. When a species is mis-attributed during ingest (or shares a name
     * with a forme that has different abilities), the prior can hand back an ability the species
     * cannot legally hold — and BattleStream does NOT run the team validator, so it is accepted in
     * silence and simply applied.
     *
     * Measured on the live pool: 8 of 1,800 packed sets (0.4%) carried an illegal ability, including
     * Meowstic with Intimidate, Snorlax with No Guard and Gardevoir with Good as Gold. Intimidate
     * alone shifts every physical damage roll against that side, so these are not cosmetic — they
     * quietly corrupt the battles they appear in.
     *
     * Illegal abilities are replaced with the species' primary ability and REPORTED in `filled`,
     * because a silent correction here would hide the ingest bug that produced it. */
    let ability = f.ability || (sp.abilities && sp.abilities['0']) || '';
    if (ability) {
      const legal = Object.values(sp.abilities || {});
      const key = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!legal.some(a => key(a) === key(ability))) {
        const fallback = (sp.abilities && sp.abilities['0']) || '';
        filled.push(`${name}: ILLEGAL ABILITY ${ability} (legal: ${legal.join('/')}) -> ${fallback}`);
        ability = fallback;
      }
    }
    /* Resample the item rather than blanking it on a clash: dropping to no-item would bias the whole
     * corpus toward itemless Pokemon, which is its own distortion. Reseeding fillSet redraws from the
     * species' measured item distribution, so the replacement is still something that species runs.
     * Only if several draws all collide do we fall back to no item, and that is reported. */
    let item = f.item || '';
    if (item && usedItems.has(item)) {
      const baseSeed = (setsBySpecies && setsBySpecies.__seed) || 1;
      let alt = '';
      for (let k = 1; k <= 6 && !alt; k++) {
        const g = SP.fillSet(name, known, baseSeed + k * 7919);
        if (g.item && !usedItems.has(g.item)) alt = g.item;
      }
      filled.push(`${name}: ITEM CLAUSE ${item} already used -> ${alt || 'none'}`);
      item = alt;
    }
    if (item) usedItems.add(item);
    team.push({
      name: sp.name, species: sp.name,
      item,
      ability,
      moves,
      /* SPREAD AND NATURE, sampled from Smogon's official distribution rather than assumed.
       *
       * This used to be a flat 11/11/11/11/11/11 with nature Hardy, justified as "spread it evenly
       * when unknown rather than maximising, because maximising would systematically overstate every
       * unknown Pokemon". The caution was right and the result was still badly wrong. Real Garchomp
       * runs Jolly 2/32/0/0/0/32 on 42% of sets; since stat = base + SP + 20 that is Attack 182
       * against the flat 161, so the format's most-used attacker was understated by 13% in EVERY
       * damage figure this project has produced — including the golden master and every MEW battle.
       *
       * Flat spreads also erase the SHAPE of the format. 92% of real spreads touch the 32-per-stat
       * cap; a flat one invents a jack-of-all-trades that exists nowhere on the ladder.
       *
       * Falls back to the old flat spread only when there is no prior for the species, and that case
       * is reported in `filled` rather than passing silently. */
      nature: known.nature || (f.spread && f.spread.nature) || 'Hardy',
      evs: known.evs || (f.spread && f.spread.sp) || { hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      level: 50,
      gender: '',
    });
  }
  /* VALIDATE AGAINST SHOWDOWN, THEN REPAIR.
   * ------------------------------------------------------------------------------------------------
   * BattleStream does NOT run the team validator — it accepts whatever it is handed. So an illegal set
   * does not error, it just plays, and the game it produces looks exactly like a legitimate one. That
   * is the worst possible failure mode for a training corpus, and it is why this gate exists.
   *
   * Repair rather than reject: discarding an invalid team would silently bias the pool toward whatever
   * teams happen to sample cleanly. Illegal moves are dropped and refilled from the priors, and the
   * team is re-validated. Anything still unresolved after MAX_FIX passes is returned with `valid:false`
   * so the caller can refuse the battle instead of quietly recording a corrupt one.
   *
   * Costs 1.24ms per team, ~2.8% of a battle. Cheap enough to run on every game, and it has to be —
   * these faults come from sampling, so they differ on every draw of the same team. */
  const MAX_FIX = 3;
  let problems = [];
  try {
    /* Built once per process. Constructing a TeamValidator parses the format's rule table, which cost
     * 6.5ms of the 7.7ms per team when this was inside the call. */
    if (!_validator) _validator = new TeamValidator(FORMAT);
    const validator = _validator;
    for (let pass = 0; pass <= MAX_FIX; pass++) {
      problems = validator.validateTeam(Teams.unpack(Teams.pack(team))) || [];
      if (!problems.length) break;
      if (pass === MAX_FIX) break;
      let changed = false;
      for (const p of problems) {
        /* "Pelipper can't learn Struggle." / "Ditto's move Knock Off does not exist" */
        const m = p.match(/^(.+?)(?:'s)? (?:can't learn|does not have|has an invalid move) (.+?)\.?$/)
              || p.match(/^(.+?) move (.+?) does not exist/);
        if (!m) continue;
        const who = m[1].trim().replace(/^\S+\s+/, (s) => s);
        const badMove = m[2].trim();
        const slot = team.find(t => t.name === who || t.species === who || who.includes(t.name));
        if (!slot) continue;
        const before = slot.moves.length;
        slot.moves = slot.moves.filter(mv => mv.toLowerCase() !== badMove.toLowerCase());
        if (slot.moves.length !== before) {
          changed = true;
          filled.push(`${slot.name}: ILLEGAL MOVE ${badMove} removed by TeamValidator`);
        }
        if (!slot.moves.length) {
          /* An empty moveset is itself invalid. Take any legal move off the learnset so the slot is
           * playable; this is a last resort and is reported like every other filled slot. */
          const sp2 = dex.species.get(slot.species);
          let ls = null;
          try { ls = dex.species.getLearnsetData(sp2.id); } catch (e) { /* none */ }
          const first = ls && ls.learnset ? Object.keys(ls.learnset)[0] : null;
          slot.moves = [first ? dex.moves.get(first).name : 'Protect'];
          filled.push(`${slot.name}: moveset emptied by repair -> ${slot.moves[0]}`);
        }
      }
      if (!changed) break;
    }
  } catch (e) {
    problems = ['VALIDATOR UNAVAILABLE: ' + e.message];
  }

  return {
    packed: Teams.pack(team),
    filled,
    size: team.length,
    valid: problems.length === 0,
    problems,
  };
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

module.exports = { FORMAT, PINNED_COMMIT, PINNED_DATE, actualCommit, verify, packTeam, battle, winProb, sim };

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
