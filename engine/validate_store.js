/* validate_store.js — RUN EVERY STORED TEAM THROUGH SHOWDOWN'S OWN TeamValidator.
 *
 *   node engine/validate_store.js               validate the whole store, print the summary
 *   node engine/validate_store.js --limit 2000  a sample, for a quick read
 *   node engine/validate_store.js --write       also write data/store-validation.json
 *   node engine/validate_store.js --selftest    prove the error classifier on known input
 *
 * WHY THIS SHAPE
 * --------------
 * Will, 2026-08-06: *"it shouldnt be this hard, lets just filter all the games through showdowns
 * valid team check if we have to."* Right. Hand-rolled legality checks are how this repo ends up with
 * a rule in one place and a different rule in another; the validator is the authority the SERVER uses,
 * so it is the one to ask. It also covers more than a species check does — items, moves and abilities
 * all come back from the same call.
 *
 * THE ONE REAL OBSTACLE, and why this is not a two-line call. Ladder games are CLOSED SHEET, so the
 * store holds only what a replay revealed. Handing a partial team to the validator returns complaints
 * about INCOMPLETENESS, not illegality, and those must not be counted:
 *
 *   "You must bring at least 6 Pokemon (your team has 1)."   <- incomplete, ignore
 *   "X has exactly 0 Stat Points"                            <- incomplete, ignore
 *   "X needs to have an ability."                            <- unrevealed, ignore
 *   "Salamence does not exist in Gen 9."                     <- ILLEGAL
 *   "Garchomp's item Choice Band does not exist in Gen 9."   <- ILLEGAL
 *   "Incineroar can't learn Knock Off."                      <- ILLEGAL
 *
 * So the classifier is the substance of this file, and it is what the selftest pins.
 *
 * IT MARKS, IT DOES NOT DELETE. The governing rule is *store raw, analyse on top*: every filter is a
 * re-computation over the store, never a re-pull. This writes a verdict per game id; quality.js
 * decides what to do with it. Deleting here would destroy the evidence needed to tell a contaminated
 * game from an out-of-date rulebook — see engine/format_drift.js, which watches that second case.
 */
'use strict';
require('./showdown_path.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const WRITE = process.argv.includes('--write');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i > 0 ? +process.argv[i + 1] : 0; })();
/* READ, NOT TYPED. S12: the active regulation lives in data/regulations.json and every consumer asks
 * it. A literal here is a second place the format is decided, and the two go out of step in September
 * when the regulation turns over. */
const _REGS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'regulations.json'), 'utf8'));
const _ACTIVE = (_REGS.regulations || {})[_REGS.active];
const FORMAT = _ACTIVE && _ACTIVE.showdownFormat;
if (!FORMAT) { console.error('regulations.json: active regulation has no showdownFormat'); process.exit(1); }
/* A store line that will not parse is a game this validator never judged. Silently skipping it
 * would report "0 illegal" over games nobody looked at. */
let UNREADABLE = 0;

/* INCOMPLETENESS, not illegality. Matched on the validator's own phrasing. Anything that does NOT
 * match one of these and is still an error is treated as a real violation — the default is to flag,
 * so a phrasing this list has not seen shows up rather than being silently forgiven. */
const INCOMPLETE = [
  /must bring at least \d+ Pok/i,
  /has exactly 0 Stat Points/i,
  /needs to have an ability/i,
  /ability No Ability does not exist/i,
  /has no moves/i,
  /must have at least one move/i,
];

/* OBSERVED, NOT DECLARED — and this is the category the first draft did not have, which made it
 * flag 12.15% of the store as illegal when almost none of it was.
 *
 * A TeamValidator judges what a player DECLARED at team preview. `g.sets` holds what the BATTLE
 * REVEALED. Those are different objects and the difference is not a detail:
 *
 *   Palafin-Hero, Aegislash-Blade, Mimikyu-Busted, Morpeko-Hangry   a forme that only exists MID-BATTLE
 *   meowstic can't have Intimidate / gardevoir can't have Pixilate  a MEGA ability seen after evolving
 *   ditto can't learn Protect                                       a move Imposter COPIED
 *   Nickname "..." too long                                         a nickname, not a legality fact
 *
 * Every one is legal to observe and illegal to declare, so counting them as violations measures our
 * own storage convention rather than anybody's team. Prefer OBSERVED over DECLARED is the project's
 * rule for reading a battle; this is the same rule pointed at the validator, which only speaks
 * declaration. Only a game with an open team sheet can be judged in full. */
const OBSERVED = [
  /transforms in-battle with/i,
  /Nickname .* too long/i,
  /can't have [A-Z]/,            /* an ability seen post-mega, against the base species row */
  /^ditto .* can't learn/i,      /* Imposter copies the target's moves */
  /can't learn Struggle/i,       /* nobody DECLARES Struggle; it is what zero PP forces */
];

function classify(errs) {
  const rest = (errs || []).filter(e => !INCOMPLETE.some(rx => rx.test(e)));
  const observed = rest.filter(e => OBSERVED.some(rx => rx.test(e)));
  const real = rest.filter(e => !OBSERVED.some(rx => rx.test(e)));
  return { illegal: real.length > 0, reasons: real, observed };
}

if (process.argv.includes('--selftest')) {
  const cases = [
    ['a complete legal mon -> clean', [], false],
    ['only incompleteness -> clean',
      ['You must bring at least 6 Pokémon (your team has 1).',
       'Incineroar has exactly 0 Stat Points - did you forget to invest it?',
       'Garchomp needs to have an ability.',
       "Garchomp's ability No Ability does not exist in Gen 9."], false],
    ['banned species -> ILLEGAL',
      ['You must bring at least 6 Pokémon (your team has 1).', 'Salamence does not exist in Gen 9.'], true],
    ['banned item -> ILLEGAL',
      ["Garchomp's item Choice Band does not exist in Gen 9."], true],
    ['illegal move -> ILLEGAL',
      ["Incineroar can't learn Knock Off."], true],
    /* THE DEFAULT MUST BE TO FLAG. A phrasing this file has never seen is not evidence of legality,
     * and forgiving the unknown is how a filter quietly stops filtering. */
    ['an unrecognised complaint -> ILLEGAL, not forgiven',
      ['Some future validator message nobody here has seen.'], true],
    /* THE CATEGORY THE FIRST DRAFT LACKED. Without it these read as violations and the store came
     * back 12.15% illegal, which was measuring our own storage convention. */
    ['a mid-battle forme -> OBSERVED, not illegal',
      ['Palafin-Hero transforms in-battle with Zero to Hero, please fix its ability.'], false],
    ['a post-mega ability on the base row -> OBSERVED',
      ["meowstic (Meowstic) can't have Intimidate."], false],
    ['a move Imposter copied -> OBSERVED',
      ["ditto (Ditto) can't learn Protect."], false],
    ['a long nickname -> OBSERVED, never a legality fact',
      ['Nickname "sinistchamasterpiece" too long (should be 18 characters or fewer)'], false],
    /* The largest remaining class once formes and megas were separated. Struggle is never on a
     * declared team — it is what the engine substitutes at zero PP — so a replay revealing it says
     * nothing about legality. It was 21 Garchomps, 16 Basculegions and 14 Sneaslers. */
    ['Struggle -> OBSERVED, it is what zero PP forces',
      ["garchomp (Garchomp) can't learn Struggle."], false],
  ];
  let bad = 0;
  for (const [label, errs, want] of cases) {
    const got = classify(errs).illegal;
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `   got illegal=${got}`}`);
  }
  console.log(`\nSTORE-VALIDATION SELFTEST: ${cases.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

/* ---- RUN --------------------------------------------------------------------------------------- */
const { TeamValidator } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const V = new TeamValidator(FORMAT);

/* One entry per REVEALED set. Anything the replay did not show is left off and the classifier
 * forgives its absence, so a closed-sheet game is judged only on what it actually exposed. */
function monFrom(species, s) {
  return {
    name: species, species,
    /* AN EMPTY MOVE LIST, NOT A PLACEHOLDER MOVE. The first draft substituted Protect when a replay
     * revealed no moves — which names a Pokemon thing in code (S12) and, worse, asks the validator a
     * question about a move nobody clicked. An empty list produces "has no moves", which INCOMPLETE
     * already forgives, so an unrevealed set is judged on the species and item alone. */
    moves: (s && s.moves && s.moves.length) ? s.moves.slice(0, 4) : [],
    ability: (s && s.ability) || '',
    item: (s && s.item) || '',
    nature: (s && s.nature) || 'Serious',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    level: 50,
  };
}

const cache = new Map();
function judge(species, s) {
  const key = species + '|' + ((s && s.moves) || []).join(',') + '|' + ((s && s.ability) || '') + '|' + ((s && s.item) || '');
  if (cache.has(key)) return cache.get(key);
  let v;
  try { v = classify(V.validateTeam([monFrom(species, s)])); }
  catch (e) { v = { illegal: true, reasons: ['validator threw: ' + (e.message || String(e))] }; }
  cache.set(key, v);
  return v;
}

const t0 = Date.now();
let games = 0, flagged = 0, monsJudged = 0;
const byReason = {}, flaggedGames = [];
for (const line of fs.readFileSync(D('data', 'games.ladder.jsonl'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  if (LIMIT && games >= LIMIT) break;
  let g; try { g = JSON.parse(line); } catch (e) { UNREADABLE++; continue; }
  games++;
  const hits = [];
  for (const [species, s] of Object.entries(g.sets || {})) {
    monsJudged++;
    const v = judge(species, s);
    if (v.illegal) for (const r of v.reasons) { hits.push(r); byReason[r] = (byReason[r] || 0) + 1; }
  }
  if (hits.length) { flagged++; if (flaggedGames.length < 500) flaggedGames.push({ id: g.id, date: g.date, reasons: [...new Set(hits)] }); }
}
const secs = (Date.now() - t0) / 1000;

console.log('');
console.log("STORE VALIDATION — every revealed set through Showdown's own TeamValidator");
console.log('');
console.log(`  format         ${FORMAT}`);
console.log(`  judged         ${games.toLocaleString()} games, ${monsJudged.toLocaleString()} revealed sets, ${cache.size.toLocaleString()} distinct`);
console.log(`  cost           ${secs.toFixed(1)}s  (${(games / Math.max(secs, .001)).toFixed(0)} games/sec)`);
console.log('');
console.log(`  games with at least one ILLEGAL set: ${flagged} (${(100 * flagged / Math.max(games, 1)).toFixed(3)}%)`);
console.log('');
const top = Object.entries(byReason).sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [r, n] of top) console.log(`  ${String(n).padStart(6)}  ${r.slice(0, 110)}`);
console.log('');
console.log('  Marked, not deleted. quality.js decides; the store keeps everything.');
console.log('');

if (WRITE) {
  fs.writeFileSync(D('data', 'store-validation.json'), JSON.stringify({
    generated: new Date().toISOString(), by: 'engine/validate_store.js', format: FORMAT,
    judged: { games, revealed_sets: monsJudged, distinct: cache.size, seconds: +secs.toFixed(1) },
    flagged_games: flagged, by_reason: byReason, examples: flaggedGames,
  }, null, 2) + '\n');
  console.log('  -> data/store-validation.json');
}
