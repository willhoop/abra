/* validate_store.js — RUN EVERY STORED TEAM THROUGH SHOWDOWN'S OWN TeamValidator.
 *
 *   node engine/validate_store.js               validate the whole store, print the summary
 *   node engine/validate_store.js --limit 2000  a sample, for a quick read
 *   node engine/validate_store.js --write       also write data/store-validation.json
 *   node engine/validate_store.js --selftest    prove the error classifier on known input
 *
 * IT REPORTS TWO NUMBERS, NOT ONE. The headline "games with at least one ILLEGAL set" is an UPPER
 * BOUND. Underneath it, complaints are split by class, because a filter may not key on the bound:
 * a SPECIES rejection is contamination, and a MOVE rejection is the Illusion signature that
 * engine/illusion.js exists to detect. See "THE SPLIT" below.
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
 * game from an out-of-date rulebook.
 *
 * THAT SENTENCE USED TO END "— see engine/format_drift.js, which watches that second case." IT DOES
 * NOT EXIST. Checked 2026-08-27: no such file, and the only two references to the name anywhere in
 * the repository were this comment and a report quoting this comment. The reasoning above still
 * stands on its own — marking rather than deleting is right whether or not anything watches the
 * second case — but nothing is watching it, and a citation to a file that was never written reads
 * exactly like a citation to one that was. Left as a named gap rather than quietly deleted.
 */
'use strict';
require('./showdown_path.js');
const fs = require('fs');
const path = require('path');
const RS = require('./run_stamp.js');
const VALIDATE_SOURCES = ['engine/validate_store.js', 'data/games.ladder.jsonl', 'data/games.bo3.jsonl', 'data/games.ots.jsonl'];

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

/* ---- THE SPLIT --------------------------------------------------------------------------------
 *
 * `illegal` is ONE bit and the decision it feeds is not one decision. Will, 2026-08-27: some stored
 * games are from a custom-rules room and still carry the Reg M-B tag. A filter keyed on this
 * verdict would remove them — and would also remove something the project deliberately wants.
 *
 *   SPECIFICATION-LEVEL ("Salamence does not exist in Gen 9.") is the CLEAN signal. Nothing a
 *   battle can do makes a legal team reveal an out-of-format species. A game flagged this way was
 *   played under different rules.
 *
 *   MOVE-LEVEL ("Basculegion can't learn Bitter Malice.") is MIXED, and that is not a nuance — it
 *   is the exact signature engine/illusion.js uses to PROVE a disguised Zoroark. The disguise
 *   copies the name and not the moveset, so a revealed move the apparent species cannot learn is a
 *   legality contradiction by design. Filtering on it drops real Zoroark games.
 *
 * So the classes are reported separately, and the per-class counts are the deliverable. This adds
 * a BREAKDOWN and changes no verdict: `classify` above is untouched and `flagged_games` still means
 * what it meant on 2026-08-07.
 *
 * ORDER MATTERS in this list. "Garchomp's item Choice Band does not exist in Gen 9." and
 * "Salamence does not exist in Gen 9." share a tail; the possessive forms must be tested first or
 * every banned item is counted as a banned species. */
function reasonClass(r) {
  if (/'s item .* does not exist in Gen \d/i.test(r)) return 'item';
  if (/needs to hold .* to be in its .* forme/i.test(r)) return 'item';
  if (/^\(It will revert to its .* forme if you remove/i.test(r)) return 'item';
  if (/'s ability .* does not exist in Gen \d/i.test(r)) return 'ability';
  if (/can't have [A-Za-z]/.test(r)) return 'ability';
  if (/can't learn /i.test(r)) return 'move';
  if (/'s move /i.test(r)) return 'move';
  if (/has multiple copies of /i.test(r)) return 'move';
  /* Species bans reach us in two phrasings: absent from the generation, or present and excluded by
   * a ruleset clause. Both mean "this team could not have been declared in this format". */
  if (/does not exist in Gen \d/i.test(r)) return 'species';
  if (/is tagged .*, which is banned by/i.test(r)) return 'species';
  if (/ is banned\b/i.test(r)) return 'species';
  return 'other';
}

/* The species a complaint is ABOUT. The validator writes "kingambit (Kingambit) can't learn X." for
 * a stored key and "Salamence does not exist in Gen 9." for a name it does not recognise, so both
 * shapes have to be read. It also writes the POSSESSIVE — "altaria's move Return does not exist in
 * Gen 9." — where a naive leading-token match keeps the "'s" and yields `altarias`, a key that
 * matches nothing and silently fails open. Returns the raw token; the caller normalises. */
function reasonSubject(r) {
  const paren = r.match(/^(\S+?)(?:'s)? \([^)]*\)/);
  if (paren) return paren[1];
  const bare = r.match(/^([A-Za-z0-9][A-Za-z0-9.:%-]*(?: [A-Z][A-Za-z0-9.:%-]*)*)/);
  return bare ? bare[1] : '';
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

  /* THE SPLIT'S OWN CASES. Every one of these strings was taken from data/store-validation.json's
   * by_reason, not invented — the eight shapes the 2026-08-07 run actually produced, plus the two
   * possessive forms that must not be read as species bans. */
  console.log('');
  const classCases = [
    ['a species absent from the generation -> species', 'salamence (Salamence) does not exist in Gen 9.', 'species'],
    ['a species excluded by a ruleset clause -> species', 'jirachi (Jirachi) is tagged Mythical, which is banned by Flat Rules.', 'species'],
    /* THE TRAP. This ends in the same six words as the species line above and is NOT a species ban. */
    ['a banned item -> item, never species', "garchomp (Garchomp)'s item Choice Band does not exist in Gen 9.", 'item'],
    ['a banned ability -> ability, never species', "garchomp (Garchomp)'s ability Beads of Ruin does not exist in Gen 9.", 'ability'],
    ['a learnset contradiction -> move (the Illusion signature)', "basculegion (Basculegion) can't learn Bitter Malice.", 'move'],
    ['a transfer-blocked move -> move', "riolu (Riolu)'s move Follow Me can't be transferred from Gen 7 to 9.", 'move'],
    ['a duplicated revealed move -> move', 'incineroar (Incineroar) has multiple copies of Fake Out.', 'move'],
    ['a held-item forme requirement -> item', 'ogerpon (Ogerpon) needs to hold Wellspring Mask to be in its Wellspring forme.', 'item'],
    ['the forme note that follows it -> item', '(It will revert to its Teal forme if you remove Wellspring Mask.)', 'item'],
    /* THE DEFAULT MUST NOT BE A REAL CLASS. An unseen phrasing counted as `species` would inflate
     * the one number this split exists to protect. */
    ['an unrecognised complaint -> other, never a real class', 'Some future validator message nobody here has seen.', 'other'],
  ];
  for (const [label, err, want] of classCases) {
    const got = reasonClass(err);
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `   got ${got}, want ${want}`}`);
  }

  console.log('');
  const subjCases = [
    ['stored key from a parenthesised subject', "basculegion (Basculegion) can't learn Bitter Malice.", 'basculegion'],
    ['bare name when the validator does not recognise the key', 'Salamence does not exist in Gen 9.', 'Salamence'],
    /* THE FAIL-OPEN. A kept "\'s" yields a key nothing matches, and the Illusion screen would then
     * quietly report "no carrier on that side" for every possessive complaint. */
    ['possessive form drops the \'s', "altaria's move Return does not exist in Gen 9.", 'altaria'],
  ];
  for (const [label, err, want] of subjCases) {
    const got = reasonSubject(err);
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `   got "${got}", want "${want}"`}`);
  }

  const total = cases.length + classCases.length + subjCases.length;
  console.log(`\nSTORE-VALIDATION SELFTEST: ${total - bad} passed, ${bad} failed`);
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

/* WHO CAN WEAR A DISGUISE — DERIVED, NEVER TYPED. A move-level flag is the Illusion signature, so
 * the question "could this game be a Zoroark reveal rather than contamination?" needs the set of
 * species that carry Illusion. Naming them here would be a Pokemon value typed from memory (S12)
 * and would go stale the moment the regulation adds one. Ask the format. */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const DEX = Dex.forFormat(FORMAT);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ILLUSION = new Set();
for (const sp of DEX.species.all()) {
  /* FILTER EVERY DEX WALK. `.all()` is the National Dex wearing the format's name. */
  if (!sp.exists || sp.isNonstandard || sp.tier === 'Illegal') continue;
  if (Object.values(sp.abilities || {}).some(a => DEX.abilities.get(a).id === DEX.abilities.get('illusion').id)) {
    ILLUSION.add(norm(sp.name));
    if (sp.baseSpecies) ILLUSION.add(norm(sp.baseSpecies));
  }
}

const t0 = Date.now();
let games = 0, flagged = 0, monsJudged = 0;
const byReason = {}, flaggedGames = [];
/* THE SPLIT'S COUNTERS. `byClassGames` counts GAMES (a game is counted once per class it shows),
 * `byClassSets` counts individual complaints; a count is not a rate and neither is the other one. */
const byClassGames = {}, byClassSets = {};
const combos = {};                       /* the exact class-set a game showed, e.g. "move" or "move+species" */
const speciesOffenders = {};             /* which species drive the clean signal — this is the costing input */
const speciesFlaggedIds = [];            /* every game a species-keyed filter would remove */
let moveOnlyGames = 0, moveOnlyWithIllusionOnSide = 0, moveOnlyNoIllusionAnywhere = 0;
for (const line of fs.readFileSync(D('data', 'games.ladder.jsonl'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  if (LIMIT && games >= LIMIT) break;
  let g; try { g = JSON.parse(line); } catch (e) { UNREADABLE++; continue; }
  games++;
  const hits = [];
  const classesHere = new Set();
  const speciesHere = new Set();
  const moveSubjects = new Set();
  for (const [species, s] of Object.entries(g.sets || {})) {
    monsJudged++;
    const v = judge(species, s);
    if (v.illegal) for (const r of v.reasons) {
      hits.push(r); byReason[r] = (byReason[r] || 0) + 1;
      const cls = reasonClass(r);
      classesHere.add(cls);
      byClassSets[cls] = (byClassSets[cls] || 0) + 1;
      if (cls === 'species') { speciesHere.add(species); speciesOffenders[species] = (speciesOffenders[species] || 0) + 1; }
      /* THE SET KEY IS THE SUBJECT BY CONSTRUCTION — judge() validates a one-mon team — but the key
       * may be a mid-battle forme (`chandeluremega`) that `six`/`brought` never list, so the base
       * species is added too. reasonSubject is the third door, for a phrasing whose subject is not
       * the key we passed in. All three are derived; none is typed. */
      if (cls === 'move') {
        moveSubjects.add(norm(species));
        const base = DEX.species.get(species);
        if (base && base.exists && base.baseSpecies) moveSubjects.add(norm(base.baseSpecies));
        const rs = norm(reasonSubject(r));
        if (rs) moveSubjects.add(rs);
      }
    }
  }
  if (!hits.length) continue;
  flagged++;
  for (const cls of classesHere) byClassGames[cls] = (byClassGames[cls] || 0) + 1;
  const combo = [...classesHere].sort().join('+');
  combos[combo] = (combos[combo] || 0) + 1;

  if (classesHere.has('species')) speciesFlaggedIds.push(g.id);

  /* IS THIS MOVE-ONLY GAME A ZOROARK REVEAL? engine/illusion.js is CONSERVATIVE and only considers
   * a team that actually brought a Zoroark line, so the same restriction applies here: the disguise
   * has to come from the disguised player's OWN team. `g.sets` is flat across both sides, so the
   * side is recovered from `six`/`brought`, which are per-side. This is a screen, not a proof —
   * illusion.js also requires the move to be one Zoroark can learn, which is not asked here. */
  if (classesHere.size === 1 && classesHere.has('move')) {
    moveOnlyGames++;
    const sideOf = {};
    for (const p of ['p1', 'p2']) {
      for (const src of [g.six, g.brought]) {
        for (const sp of ((src || {})[p] || [])) {
          const k = norm(sp);
          sideOf[k] = sideOf[k] && sideOf[k] !== p ? 'both' : p;
        }
      }
    }
    const illusionSides = new Set();
    for (const [k, side] of Object.entries(sideOf)) if (ILLUSION.has(k)) { if (side === 'both') { illusionSides.add('p1'); illusionSides.add('p2'); } else illusionSides.add(side); }
    let sameSide = false;
    for (const subj of moveSubjects) {
      const side = sideOf[subj];
      if (!side) continue;
      if (side === 'both' ? illusionSides.size > 0 : illusionSides.has(side)) sameSide = true;
    }
    if (sameSide) moveOnlyWithIllusionOnSide++;
    else if (illusionSides.size === 0) moveOnlyNoIllusionAnywhere++;
  }

  if (flaggedGames.length < 500) flaggedGames.push({ id: g.id, date: g.date, classes: [...classesHere].sort(), reasons: [...new Set(hits)] });
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
/* A LINE THAT WILL NOT PARSE IS A GAME NOBODY JUDGED. The comment at the top of this file has said
 * so since it was written and the counter was never printed, which is the same shape as a
 * capability that cannot prove it ran. */
console.log(`  unreadable store lines (never judged): ${UNREADABLE}`);
console.log('');

/* ---- THE SPLIT ---------------------------------------------------------------------------------
 * The headline above is an UPPER BOUND on contamination and lumps two unlike things together.
 * A count is not a rate; both are printed, against the same denominator. */
const pct = n => (100 * n / Math.max(games, 1)).toFixed(3) + '%';
console.log('  by class — a game is counted once per class it shows, so these sum to MORE than the headline:');
for (const [cls, n] of Object.entries(byClassGames).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${cls.padEnd(8)} ${String(n).padStart(5)} games  ${pct(n).padStart(8)}   (${byClassSets[cls]} complaints)`);
}
console.log('');
console.log('  exact class-set per flagged game — these DO sum to the headline:');
for (const [combo, n] of Object.entries(combos).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(5)}  ${pct(n).padStart(8)}  ${combo}`);
}
console.log('');
const speciesGames = byClassGames.species || 0;
console.log(`  SPECIES-KEYED FILTER would remove ${speciesGames} games (${pct(speciesGames)} of ${games.toLocaleString()})`);
console.log(`  MOVE-ONLY games left alone by it:  ${moveOnlyGames} (${pct(moveOnlyGames)})`);
console.log(`    of those, an Illusion carrier on the same side: ${moveOnlyWithIllusionOnSide}`);
console.log(`    of those, no Illusion carrier in the game at all: ${moveOnlyNoIllusionAnywhere}`);
console.log('');
const offenders = Object.entries(speciesOffenders).sort((a, b) => b[1] - a[1]);
console.log(`  species driving the clean signal (${offenders.length} distinct):`);
for (const [sp, n] of offenders.slice(0, 20)) console.log(`    ${String(n).padStart(5)}  ${sp}`);
console.log('');
const top = Object.entries(byReason).sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [r, n] of top) console.log(`  ${String(n).padStart(6)}  ${r.slice(0, 110)}`);
console.log('');
console.log('  Marked, not deleted. quality.js decides; the store keeps everything.');
console.log('');

if (WRITE) {
  fs.writeFileSync(D('data', 'store-validation.json'), JSON.stringify({
    generated: new Date().toISOString(), by: 'engine/validate_store.js', format: FORMAT,
    /* CONTENT, NOT MTIME -- the verdict depends on the Showdown rules that graded it, and a
     * validator that cannot say which ruleset it ran under is unreadable a week later. */
    source_digests: RS.sourceDigests(VALIDATE_SOURCES),
    judged: { games, revealed_sets: monsJudged, distinct: cache.size, seconds: +secs.toFixed(1), unreadable_lines: UNREADABLE },
    flagged_games: flagged, by_reason: byReason,
    /* THE SPLIT. `flagged_games` is the upper bound and is unchanged in meaning from 2026-08-07;
     * this block is what a filter decision is actually allowed to key on. */
    split: {
      note: 'by_class_games counts a game once per class it shows, so it oversums the headline; combos partitions the flagged games exactly.',
      by_class_games: byClassGames, by_class_sets: byClassSets, combos,
      species_keyed_filter_would_remove: byClassGames.species || 0,
      move_only_games: moveOnlyGames,
      move_only_with_illusion_carrier_same_side: moveOnlyWithIllusionOnSide,
      move_only_with_no_illusion_carrier_in_game: moveOnlyNoIllusionAnywhere,
      illusion_carriers_derived: [...ILLUSION].sort(),
      species_offenders: speciesOffenders,
      species_flagged_ids: speciesFlaggedIds,
    },
    examples: flaggedGames,
  }, null, 2) + '\n');
  console.log('  -> data/store-validation.json');
}
