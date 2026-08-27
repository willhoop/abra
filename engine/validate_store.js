/* validate_store.js — RUN EVERY STORED TEAM THROUGH SHOWDOWN'S OWN TeamValidator.
 *
 *   node engine/validate_store.js               validate ALL THREE stores, print the summary
 *   node engine/validate_store.js --limit 2000  a sample, for a quick read
 *   node engine/validate_store.js --write       also write data/store-validation.json
 *   node engine/validate_store.js --selftest    prove the classifier AND both rulers on derived input
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
/* PART ONE of the selftest runs before Showdown loads and costs nothing; PART TWO needs the dex and
 * the validator and runs after them. Neither half may exit on its own — a run that exited after part
 * one would print a green total having never touched the rulers that decide every number below. */
const SELFTEST = process.argv.includes('--selftest');
let SELFTEST_FAILS = 0, SELFTEST_TOTAL = 0;
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

if (SELFTEST) {
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

  SELFTEST_TOTAL = cases.length + classCases.length + subjCases.length;
  SELFTEST_FAILS = bad;
  /* NO EXIT HERE, DELIBERATELY. The ruler cases need the dex and the validator, which load further
   * down. Part two runs there and exits for both halves; exiting here would print a green total
   * having never exercised the code that decides every number in the artifact. */
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

/* ---- THREE STORES, TWO RULERS -------------------------------------------------------------------
 *
 * COVERAGE WAS THE FIRST NAMED LIMITATION OF THE FILTER THAT READS THIS FILE. data/quality-filter.json
 * says it in its own words: *"engine/validate_store.js judges data/games.ladder.jsonl only, so this
 * rule is a NO-OP on games.bo3.jsonl and games.ots.jsonl — those corpora are unfiltered for legality,
 * not clean."* That mattered more than the game count, because `games.bo3.jsonl` is the corpus
 * engine/fit_policy.js fits MAG on (`SCOPES.fit`). The one store nothing had ever checked was the one
 * that trains the policy.
 *
 * SO THE STORES ARE JUDGED SEPARATELY AND NEVER POOLED. engine/ingest_ots.js refuses to pool the two
 * open-sheet sources because they are different collections with different metagames; a pooled
 * contamination rate would hide whichever one is dirty behind whichever one is large.
 *
 * AND THERE ARE TWO RULERS, NOT ONE, BECAUSE THE OPEN-SHEET STORES CARRY THE DECLARED TEAM.
 *
 *   REVEALED — judge `g.sets`, what the battle exposed. This is what the ladder number has always
 *              been, and it is all a closed-sheet game can offer. A partial set is judged on the
 *              fragment the replay happened to show, so a clean verdict is weak evidence: the
 *              validator was never shown enough to object.
 *   DECLARED — judge `g.sheets`, the full six a Force-OTS room published at team preview. This is the
 *              object a TeamValidator is built to grade: four declared moves, the declared ability,
 *              the declared item, on the declared species. A rejection here is a fact about the TEAM.
 *
 * THE DIFFERENCE IS NOT ONLY WIDER COVERAGE, IT IS A LOWER FALSE-POSITIVE RATE, AND THE MOVE CLASS IS
 * WHERE THAT IS VISIBLE. On the ladder a move-level rejection is mostly Illusion: a disguised Zoroark
 * appears in the replay as another species carrying Zoroark's moves, so "X can't learn Y" is produced
 * by a perfectly legal team. `g.sheets` is the DECLARATION, and Illusion cannot forge a declaration —
 * the sheet lists Zoroark with Zoroark's moves. So the same games judged both ways are a CONTROL on
 * each other, and the size of the gap is the size of the disguise artefact. Both are run and both are
 * reported; neither replaces the other.
 *
 * A GAME WITH NO SHEET IS SKIPPED BY THE DECLARED RULER AND COUNTED, never quietly judged by the other
 * one. Falling back would mix two rulers inside one number, which is the shape of every instrument
 * failure this project has paid for. */

/* THE ITEM CLASS HAS A FALSE-POSITIVE PATH AND THE PATTERN THAT SEPARATES IT IS NOT TYPED HERE.
 * data/quality-filter.json already carries `item_reason_pattern` and its reader applies it; writing a
 * second copy of the same regex in this file is exactly the "two files that both decide Choice Scarf
 * multiplies Speed by 1.5" failure CLAUDE.md names. It is READ. If the file is absent the split is
 * reported as UNAVAILABLE rather than guessed — a fallback here would be a silently different rule. */
const ITEM_DECLARED_RX = (() => {
  try {
    const q = JSON.parse(fs.readFileSync(D('data', 'quality-filter.json'), 'utf8'));
    const p = ((q.rules || {}).exclude_illegal_teams || {}).item_reason_pattern;
    return p ? { rx: new RegExp(p, 'i'), src: p } : null;
  } catch (e) {
    /* SAY IT. A null here silently switches off the declared-item / forme-requirement split in every
     * number this file prints, and a missing split reads exactly like a split of zero. */
    console.error(`validate_store: could not read the item pattern from data/quality-filter.json `
      + `(${e.message}); the declared-item / forme-requirement split is UNAVAILABLE, not zero.`);
    return null;
  }
})();

/* A STREAM, NOT readFileSync. The three stores are 323 MB, 182 MB and 32 MB; splitting each into an
 * array of lines doubles that in memory, and this box is 13 GB with other agents resident. A decoder
 * is used rather than buf.toString() because a 4 MB read can land mid-character and a mangled nickname
 * would become a validator complaint nobody could explain. */
const { StringDecoder } = require('string_decoder');
function* readLines(p) {
  const fd = fs.openSync(p, 'r');
  const buf = Buffer.alloc(1 << 22);
  const dec = new StringDecoder('utf8');
  let tail = '';
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n <= 0) break;
      const parts = (tail + dec.write(buf.subarray(0, n))).split('\n');
      tail = parts.pop();
      for (const l of parts) yield l;
    }
    tail += dec.end();
    if (tail) yield tail;
  } finally { fs.closeSync(fd); }
}

const EXAMPLE_CAP = 500;
function newAcc(store, ruler) {
  return {
    store, ruler,
    lines: 0, unreadable: 0, judged_games: 0, no_ruler_input: 0, sets_judged: 0,
    flagged: 0, byReason: {}, byClassGames: {}, byClassSets: {}, combos: {},
    speciesOffenders: {}, speciesFlaggedIds: [], itemFlaggedIds: [], keyedFlaggedIds: [],
    itemDeclaredComplaints: 0, itemFormeComplaints: 0, itemOtherComplaints: 0,
    moveOnlyGames: 0, moveOnlyWithIllusionOnSide: 0, moveOnlyNoIllusionAnywhere: 0,
    examples: [],
  };
}

/* ---- THE SELFTEST, PART TWO: THE RULERS ---------------------------------------------------------
 *
 * The classifier cases above run before Showdown is loaded and cost nothing. These cannot — the two
 * rulers are about the SHAPE of a stored game and the Illusion screen is derived from the format — so
 * they run here, after the dex and the validator exist and before any store is read.
 *
 * NOTHING IN THIS BLOCK IS TYPED. The species and the move come out of the format on this run
 * (S12: DERIVED beats READ beats HAND), so a regulation change cannot leave a fixture behind that
 * quietly stops testing anything. `buildMon("Scizor")` returned null because a name was typed. */
if (SELFTEST) {
  let bad = SELFTEST_FAILS, ran = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    ran++;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `   got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  };

  /* CONSTRUCT THE FIXTURE, DO NOT FIND IT. A pair (species, move) the validator rejects with the
   * learnset phrasing, and a pair it accepts — both searched out of the format rather than named. */
  const legalSp = DEX.species.all().filter(s => s.exists && !s.isNonstandard && s.tier !== 'Illegal');
  const legalMv = DEX.moves.all().filter(m => m.exists && !m.isNonstandard);
  let illegalCombo = null, legalCombo = null;
  const subject = legalSp[0];
  for (const mv of legalMv) {
    if (illegalCombo && legalCombo) break;
    const errs = V.validateTeam([monFrom(subject.name, { moves: [mv.name] })]) || [];
    const cantLearn = errs.some(e => /can't learn /i.test(e));
    const anyReal = classify(errs).illegal;
    if (cantLearn && !illegalCombo) illegalCombo = { species: subject.name, move: mv.name };
    if (!anyReal && !legalCombo) legalCombo = { species: subject.name, move: mv.name };
  }
  console.log('');
  console.log(`  fixture derived from ${FORMAT}: subject ${subject.name}`
    + `, rejected move ${illegalCombo ? illegalCombo.move : 'NONE FOUND'}`
    + `, accepted move ${legalCombo ? legalCombo.move : 'NONE FOUND'}`);
  check('a rejected (species, move) pair exists in this format', !!illegalCombo, true);
  check('an accepted (species, move) pair exists in this format', !!legalCombo, true);

  const sheetMon = (species, move) => ({ species, nickname: null, item: '', ability: '', moves: [move], nature: 'Serious', evs: null, gender: null, level: 50 });

  /* THE DECLARED RULER SKIPS, IT DOES NOT FALL BACK. A game with no sheet must produce no input, so
   * that scanGame counts it as unjudged instead of quietly grading it with the other ruler. Mixing
   * two rulers inside one number is how an instrument lies without failing. */
  check('DECLARED on a game with no sheets -> no input (skipped, never handed to REVEALED)',
    rulerInput({ sets: { x: {} } }, 'declared'), null);
  check('DECLARED on an empty sheets object -> no input',
    rulerInput({ sheets: { p1: [], p2: [] } }, 'declared'), null);

  const g = {
    id: 'selftest-declared',
    sheets: {
      p1: [sheetMon(subject.name, legalCombo.move)],
      p2: [sheetMon(subject.name, legalCombo.move)],
    },
    six: { p1: [subject.name], p2: [subject.name] },
    sets: { [subject.name]: { moves: [legalCombo.move] } },
  };
  const di = rulerInput(g, 'declared');
  check('DECLARED yields one entry per SHEET mon, both sides', di.entries.length, 2);
  /* The same species on both sheets is `both`, which the Illusion screen treats as present on either
   * side. That is deliberate and it is why the case is asserted rather than assumed. */
  check('DECLARED attributes a species declared by both players as `both`', di.sideOf[norm(subject.name)], 'both');

  const g2 = {
    id: 'selftest-sides',
    sheets: { p1: [sheetMon(subject.name, legalCombo.move)], p2: [] },
    six: { p1: [subject.name], p2: [] },
  };
  check('DECLARED attributes a one-sided sheet to that side', rulerInput(g2, 'declared').sideOf[norm(subject.name)], 'p1');

  const ri = rulerInput(g, 'revealed');
  check('REVEALED yields one entry per g.sets key', ri.entries.length, 1);
  check('REVEALED recovers the side from six/brought', ri.sideOf[norm(subject.name)], 'both');
  check('REVEALED on a game with no revealed sets -> no input', rulerInput({ sheets: { p1: [sheetMon(subject.name, legalCombo.move)] } }, 'revealed'), null);

  /* END TO END: ruler -> judge -> classify -> reasonClass -> the counters. A green unit test on each
   * half proves nothing about the chain, and the chain is what writes the artifact. */
  const accClean = newAcc('selftest', 'declared');
  scanGame(g, 'declared', accClean);
  check('DECLARED does not flag a sheet the validator accepts', [accClean.judged_games, accClean.flagged, accClean.sets_judged], [1, 0, 2]);

  const gBad = {
    id: 'selftest-illegal-move',
    sheets: { p1: [sheetMon(subject.name, illegalCombo.move)], p2: [] },
    six: { p1: [subject.name], p2: [] },
  };
  const accBad = newAcc('selftest', 'declared');
  scanGame(gBad, 'declared', accBad);
  check('DECLARED flags a sheet whose declared move the species cannot learn, as move-only',
    [accBad.flagged, accBad.byClassGames.move || 0, accBad.moveOnlyGames], [1, 1, 1]);
  check('and with no Illusion carrier on the sheet it is NOT excused as a disguise',
    [accBad.moveOnlyWithIllusionOnSide, accBad.moveOnlyNoIllusionAnywhere], [0, 1]);

  /* THE ILLUSION SCREEN MUST BE ABLE TO FIRE, or the previous assertion is measuring nothing. A
   * carrier is added to the same sheet and the same game must flip to `carrier on the same side`.
   * This is the knob-cleared control: an unwired screen gives identical output on a varied input. */
  const carrier = legalSp.find(s => ILLUSION.has(norm(s.name)));
  check('the format contains at least one Illusion carrier to build the control from', !!carrier, true);
  if (carrier) {
    const gDisguise = {
      id: 'selftest-illusion',
      sheets: { p1: [sheetMon(subject.name, illegalCombo.move), sheetMon(carrier.name, legalCombo.move)], p2: [] },
      six: { p1: [subject.name, carrier.name], p2: [] },
    };
    const accDis = newAcc('selftest', 'declared');
    scanGame(gDisguise, 'declared', accDis);
    check(`the SAME game with ${carrier.name} on the sheet flips to carrier-on-the-same-side`,
      [accDis.moveOnlyGames, accDis.moveOnlyWithIllusionOnSide, accDis.moveOnlyNoIllusionAnywhere], [1, 1, 0]);
  }

  /* THE READER. A store line is a game, and the two ways a hand-rolled line splitter loses one are a
   * missing trailing newline and a multi-byte character. Both are asserted because both would drop a
   * game silently, which is the failure this whole file exists to make visible. */
  const tmp = path.join(require('os').tmpdir(), `validate-store-selftest-${process.pid}.jsonl`);
  fs.writeFileSync(tmp, '{"a":1}\n{"b":"éポ"}\n{"c":3}');   /* NO trailing newline, on purpose */
  const got = [...readLines(tmp)];
  fs.unlinkSync(tmp);
  check('readLines keeps every line including the last one with no trailing newline', got.length, 3);
  check('readLines does not mangle a multi-byte character', JSON.parse(got[1]).b, 'éポ');

  /* THE ITEM PATTERN IS READ, NOT TYPED, so the selftest asserts it was actually found. A null here
   * means the declared-item / forme-requirement split in every number below is UNAVAILABLE. */
  check('the declared-item pattern was read from data/quality-filter.json', !!ITEM_DECLARED_RX, true);
  if (ITEM_DECLARED_RX) {
    check('it matches a declared banned item and not a forme requirement',
      [ITEM_DECLARED_RX.rx.test("garchomp (Garchomp)'s item Choice Band does not exist in Gen 9."),
       ITEM_DECLARED_RX.rx.test('ogerpon (Ogerpon) needs to hold Wellspring Mask to be in its Wellspring forme.')],
      [true, false]);
  }

  console.log(`\nSTORE-VALIDATION SELFTEST: ${SELFTEST_TOTAL + ran - bad} passed of ${SELFTEST_TOTAL + ran}, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}


/* The (species, set) pairs this ruler hands to the validator, plus the side map the Illusion screen
 * needs. Under REVEALED the side has to be RECOVERED, because `g.sets` is flat across both players;
 * under DECLARED a sheet belongs to a player by construction — which is itself a reason the declared
 * ruler is the stronger one. */
function rulerInput(g, ruler) {
  if (ruler === 'declared') {
    const sh = g.sheets;
    if (!sh || !((sh.p1 || []).length || (sh.p2 || []).length)) return null;
    const entries = [], sideOf = {};
    for (const p of ['p1', 'p2']) for (const e of (sh[p] || [])) {
      if (!e || !e.species) continue;
      entries.push([e.species, e]);
      for (const k of [norm(e.species), norm((DEX.species.get(e.species) || {}).baseSpecies)]) {
        if (!k) continue;
        sideOf[k] = sideOf[k] && sideOf[k] !== p ? 'both' : p;
      }
    }
    return entries.length ? { entries, sideOf } : null;
  }
  const entries = Object.entries(g.sets || {});
  if (!entries.length) return null;
  /* UNCHANGED FROM 2026-08-07. `g.sets` says nothing about whose Pokemon it was, so the side is
   * recovered from `six`/`brought`, which are per-side. */
  const sideOf = {};
  for (const p of ['p1', 'p2']) for (const src of [g.six, g.brought]) for (const sp of ((src || {})[p] || [])) {
    const k = norm(sp);
    sideOf[k] = sideOf[k] && sideOf[k] !== p ? 'both' : p;
  }
  return { entries, sideOf };
}

function scanGame(g, ruler, acc) {
  const input = rulerInput(g, ruler);
  if (!input) { acc.no_ruler_input++; return; }
  acc.judged_games++;
  const hits = [], classesHere = new Set(), moveSubjects = new Set();
  let sawDeclaredItem = false;
  for (const [species, s] of input.entries) {
    acc.sets_judged++;
    const v = judge(species, s);
    if (!v.illegal) continue;
    for (const r of v.reasons) {
      hits.push(r); acc.byReason[r] = (acc.byReason[r] || 0) + 1;
      const cls = reasonClass(r);
      classesHere.add(cls);
      acc.byClassSets[cls] = (acc.byClassSets[cls] || 0) + 1;
      if (cls === 'species') acc.speciesOffenders[species] = (acc.speciesOffenders[species] || 0) + 1;
      if (cls === 'item') {
        if (!ITEM_DECLARED_RX) acc.itemOtherComplaints++;
        else if (ITEM_DECLARED_RX.rx.test(r)) { acc.itemDeclaredComplaints++; sawDeclaredItem = true; }
        else acc.itemFormeComplaints++;
      }
      if (cls === 'move') {
        moveSubjects.add(norm(species));
        const base = DEX.species.get(species);
        if (base && base.exists && base.baseSpecies) moveSubjects.add(norm(base.baseSpecies));
        const rs = norm(reasonSubject(r));
        if (rs) moveSubjects.add(rs);
      }
    }
  }
  if (!hits.length) return;
  acc.flagged++;
  for (const cls of classesHere) acc.byClassGames[cls] = (acc.byClassGames[cls] || 0) + 1;
  const combo = [...classesHere].sort().join('+');
  acc.combos[combo] = (acc.combos[combo] || 0) + 1;

  if (classesHere.has('species')) acc.speciesFlaggedIds.push(g.id);
  if (classesHere.has('item')) acc.itemFlaggedIds.push(g.id);
  /* WHAT A SPECIES-AND-ITEM FILTER WOULD ACTUALLY REMOVE — the union engine/quality.js keys on,
   * narrowed by the declared-item pattern exactly as its reader narrows it. Published as ids so the
   * cost can be computed against a corpus without re-deriving the union from `combos`, which is where
   * the reader's shortfall arithmetic comes from. */
  if (classesHere.has('species') || sawDeclaredItem) acc.keyedFlaggedIds.push(g.id);

  if (classesHere.size === 1 && classesHere.has('move')) {
    acc.moveOnlyGames++;
    const illusionSides = new Set();
    for (const [k, side] of Object.entries(input.sideOf)) if (ILLUSION.has(k)) {
      if (side === 'both') { illusionSides.add('p1'); illusionSides.add('p2'); } else illusionSides.add(side);
    }
    let sameSide = false;
    for (const subj of moveSubjects) {
      const side = input.sideOf[subj];
      if (!side) continue;
      if (side === 'both' ? illusionSides.size > 0 : illusionSides.has(side)) sameSide = true;
    }
    if (sameSide) acc.moveOnlyWithIllusionOnSide++;
    else if (illusionSides.size === 0) acc.moveOnlyNoIllusionAnywhere++;
  }

  if (acc.examples.length < EXAMPLE_CAP) acc.examples.push({ id: g.id, date: g.date, classes: [...classesHere].sort(), reasons: [...new Set(hits)] });
}

/* ONE PASS OVER THE FILE, BOTH RULERS. Re-reading a 182 MB store to ask a second question doubles the
 * IO and, worse, reads a file OPS appends to hourly TWICE — so the two rulers could disagree because
 * the store MOVED between them rather than because the rulers differ. Same bytes, same games, both
 * verdicts. */
function scanStore(file, rulers) {
  const p = D('data', file);
  const accs = {};
  for (const r of rulers) accs[r] = newAcc(file, r);
  if (!fs.existsSync(p)) return { missing: true, accs };
  const t = Date.now();
  for (const line of readLines(p)) {
    if (!line.trim()) continue;
    if (LIMIT && accs[rulers[0]].lines >= LIMIT) break;
    let g;
    try { g = JSON.parse(line); } catch (e) { for (const r of rulers) accs[r].unreadable++; continue; }
    for (const r of rulers) { accs[r].lines++; scanGame(g, r, accs[r]); }
  }
  return { missing: false, accs, seconds: +((Date.now() - t) / 1000).toFixed(1) };
}

/* THE STORES. Every one carries `sheets` on at least some games, so both rulers run everywhere and the
 * DECLARED denominator says how many games could actually answer. Nothing here is pooled. */
const STORE_LIST = [
  { file: 'games.ladder.jsonl', what: 'closed-sheet bo1 ladder; Open Team Sheets is OPTIONAL here, so only a slice declares' },
  { file: 'games.bo3.jsonl', what: 'OUR scrape of the Force-OTS bo3 ladder — the corpus fit_policy.js SCOPES.fit fits MAG on' },
  { file: 'games.ots.jsonl', what: 'the external VGC-Bench open-sheet archive; a different collection, never pooled with bo3' },
];

const t0 = Date.now();
const RESULTS = {};
for (const st of STORE_LIST) RESULTS[st.file] = scanStore(st.file, ['revealed', 'declared']);
const secs = (Date.now() - t0) / 1000;

/* THE HEADLINE IS UNCHANGED IN MEANING. `judged`, `flagged_games`, `by_reason`, `split` and `examples`
 * at the top level of the artifact are the LADDER store under the REVEALED ruler and nothing else,
 * because engine/quality.js reads exactly those keys — a filter whose denominator silently changed
 * shape would move every corpus in the repository without a line of its own changing. */
const LAD = RESULTS['games.ladder.jsonl'].accs.revealed;
/* `games` IS LINES PARSED AND NOT GAMES-WITH-A-REVEALED-SET, AND THE DIFFERENCE COST A CAUGHT
 * REGRESSION. The 2026-08-07 loop incremented one counter per parsed line and used it as the
 * denominator for every rate in this file; the refactor below counts a game only when the ruler had
 * something to hand the validator, which on the ladder is 604 games fewer — 604 replays revealed no
 * set at all. Every COUNT was identical across the change and the denominator was not, so the
 * published rate would have moved 1.858% -> 1.875% with no measurement behind it. data/quality-filter.json
 * records judged_games: 67384 as the freshness denominator its reader prints, so a silent redefinition
 * here would have made two files disagree about the size of the same store.
 *
 * The old meaning is kept EXACTLY. The new denominator is published beside it as
 * `games_with_revealed_sets`, which is strictly more information and replaces nothing. */
const games = LAD.lines, flagged = LAD.flagged, monsJudged = LAD.sets_judged;
const byReason = LAD.byReason, flaggedGames = LAD.examples;
const byClassGames = LAD.byClassGames, byClassSets = LAD.byClassSets, combos = LAD.combos;
const speciesOffenders = LAD.speciesOffenders, speciesFlaggedIds = LAD.speciesFlaggedIds;
const moveOnlyGames = LAD.moveOnlyGames, moveOnlyWithIllusionOnSide = LAD.moveOnlyWithIllusionOnSide;
const moveOnlyNoIllusionAnywhere = LAD.moveOnlyNoIllusionAnywhere;
UNREADABLE = LAD.unreadable;

console.log('');
console.log("STORE VALIDATION — every stored team through Showdown's own TeamValidator");
console.log('');
console.log(`  format         ${FORMAT}`);
console.log(`  judged         ${games.toLocaleString()} ladder lines (${LAD.judged_games.toLocaleString()} revealed a set, ${LAD.no_ruler_input.toLocaleString()} revealed none), ${monsJudged.toLocaleString()} revealed sets, ${cache.size.toLocaleString()} distinct sets across all stores`);
console.log(`  cost           ${secs.toFixed(1)}s for three stores x two rulers`);
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
console.log('  LADDER / REVEALED — the number engine/quality.js keys on. Denominator: ' + games.toLocaleString() + ' ladder LINES, unchanged in meaning since 2026-08-07.');
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

/* ---- PER STORE, PER RULER — NEVER POOLED ------------------------------------------------------ */
const rate = (n, d) => d ? (100 * n / d).toFixed(3) + '%' : 'n/a';
console.log('  ' + '-'.repeat(98));
console.log("  EVERY STORE, BOTH RULERS. Each rate is against that ruler's OWN denominator, which is named.");
console.log('  ' + '-'.repeat(98));
for (const st of STORE_LIST) {
  const R = RESULTS[st.file];
  console.log('');
  console.log(`  data/${st.file}   ${R.missing ? 'MISSING ON DISK' : R.seconds + 's'}`);
  console.log(`      ${st.what}`);
  if (R.missing) continue;
  for (const ruler of ['revealed', 'declared']) {
    const a = R.accs[ruler];
    const d = a.judged_games;
    console.log(`    ${ruler.toUpperCase().padEnd(9)} judged ${String(d).padStart(6)} of ${String(a.lines).padStart(6)} lines`
      + `   (${a.no_ruler_input} had no ${ruler === 'declared' ? 'sheet' : 'revealed set'}, ${a.unreadable} unreadable)`);
    console.log(`              ${String(a.sets_judged).padStart(7)} sets judged`);
    console.log(`              FLAGGED ${String(a.flagged).padStart(5)}   ${rate(a.flagged, d).padStart(8)} of the ${d.toLocaleString()} it judged`);
    const parts = Object.entries(a.byClassGames).sort((x, y) => y[1] - x[1]).map(([c, n]) => `${c} ${n} (${rate(n, d)})`);
    console.log(`              by class: ${parts.length ? parts.join(', ') : 'none'}`);
    console.log(`              move-only ${a.moveOnlyGames}  ->  Illusion carrier same side ${a.moveOnlyWithIllusionOnSide}`
      + ` (${rate(a.moveOnlyWithIllusionOnSide, a.moveOnlyGames)} of move-only), no carrier anywhere ${a.moveOnlyNoIllusionAnywhere}`);
    console.log(`              item complaints: declared-item ${a.itemDeclaredComplaints}, forme-requirement ${a.itemFormeComplaints}`
      + (ITEM_DECLARED_RX ? '' : `, SPLIT UNAVAILABLE (data/quality-filter.json unreadable; ${a.itemOtherComplaints} unsplit)`));
    console.log(`              a SPECIES+ITEM(declared) filter would remove ${a.keyedFlaggedIds.length} (${rate(a.keyedFlaggedIds.length, d)})`);
  }
}
console.log('');
console.log('  Marked, not deleted. quality.js decides; the store keeps everything.');
console.log('  THIS VERDICT IS A SNAPSHOT. OPS appends to games.ladder.jsonl and games.bo3.jsonl hourly and');
console.log('  no workflow re-runs this tool, so every hour that passes leaves more games unjudged.');
console.log('');

if (WRITE) {
  const storeBlock = {};
  for (const st of STORE_LIST) {
    const R = RESULTS[st.file];
    if (R.missing) { storeBlock[st.file] = { missing: true, what: st.what }; continue; }
    const b = { what: st.what, seconds: R.seconds };
    for (const ruler of ['revealed', 'declared']) {
      const a = R.accs[ruler];
      b[ruler] = {
        lines: a.lines, judged_games: a.judged_games, no_ruler_input: a.no_ruler_input,
        unreadable_lines: a.unreadable, sets_judged: a.sets_judged,
        flagged_games: a.flagged,
        flagged_rate_pct: a.judged_games ? +(100 * a.flagged / a.judged_games).toFixed(4) : null,
        by_class_games: a.byClassGames, by_class_sets: a.byClassSets, combos: a.combos,
        move_only_games: a.moveOnlyGames,
        move_only_with_illusion_carrier_same_side: a.moveOnlyWithIllusionOnSide,
        move_only_with_no_illusion_carrier_in_game: a.moveOnlyNoIllusionAnywhere,
        item_complaints_declared: a.itemDeclaredComplaints,
        item_complaints_forme_requirement: a.itemFormeComplaints,
        species_offenders: a.speciesOffenders,
        species_flagged_ids: a.speciesFlaggedIds,
        item_flagged_ids: a.itemFlaggedIds,
        species_or_declared_item_flagged_ids: a.keyedFlaggedIds,
        by_reason: a.byReason,
        examples: a.examples,
      };
    }
    storeBlock[st.file] = b;
  }
  fs.writeFileSync(D('data', 'store-validation.json'), JSON.stringify({
    generated: new Date().toISOString(), by: 'engine/validate_store.js', format: FORMAT,
    /* CONTENT, NOT MTIME -- the verdict depends on the Showdown rules that graded it, and a
     * validator that cannot say which ruleset it ran under is unreadable a week later. */
    source_digests: RS.sourceDigests(VALIDATE_SOURCES),
    judged: { games, revealed_sets: monsJudged, distinct: cache.size, seconds: +secs.toFixed(1), unreadable_lines: UNREADABLE,
      /* NEW, AND IT DOES NOT REPLACE `games`. `games` is lines parsed, which is what it has meant
       * since 2026-08-07 and what data/quality-filter.json records. This is the subset the REVEALED
       * ruler could actually judge; the rest revealed no set at all and were graded on nothing. */
      games_with_revealed_sets: LAD.judged_games, games_with_no_revealed_set: LAD.no_ruler_input,
      distinct_note: "distinct is the set-level cache across ALL stores and both rulers, so it is larger than a ladder-only run would report." },
    flagged_games: flagged, by_reason: byReason,
    /* THE SPLIT. `flagged_games` is the upper bound and is unchanged in meaning from 2026-08-07;
     * this block is what a filter decision is actually allowed to key on. IT IS THE LADDER STORE UNDER
     * THE REVEALED RULER — engine/quality.js reads it and nothing about its denominator has moved. */
    split: {
      note: 'by_class_games counts a game once per class it shows, so it oversums the headline; combos partitions the flagged games exactly. SCOPE: data/games.ladder.jsonl under the REVEALED ruler. The other two stores and the DECLARED ruler are under `stores`.',
      by_class_games: byClassGames, by_class_sets: byClassSets, combos,
      species_keyed_filter_would_remove: byClassGames.species || 0,
      move_only_games: moveOnlyGames,
      move_only_with_illusion_carrier_same_side: moveOnlyWithIllusionOnSide,
      move_only_with_no_illusion_carrier_in_game: moveOnlyNoIllusionAnywhere,
      illusion_carriers_derived: [...ILLUSION].sort(),
      species_offenders: speciesOffenders,
      species_flagged_ids: speciesFlaggedIds,
      /* PUBLISHED BECAUSE THE READER ASKED FOR IT BY NAME. engine/quality.js prints "publishes
       * species_flagged_ids but not item_flagged_ids, and its examples list is capped at 500 ... the
       * filter is UNDER-removing" whenever its arithmetic comes up short. It does not read these keys
       * today, so adding them changes no corpus; it removes the reason the shortfall could ever exist. */
      item_flagged_ids: LAD.itemFlaggedIds,
      species_or_declared_item_flagged_ids: LAD.keyedFlaggedIds,
      item_declared_pattern: ITEM_DECLARED_RX ? ITEM_DECLARED_RX.src : null,
    },
    examples: flaggedGames,
    /* ---- ADDED 2026-08-27: the other two stores, and the declared ruler ------------------------ */
    rulers: {
      revealed: 'judged g.sets — what the battle exposed. All a closed-sheet game can offer; a partial set means the validator was never shown enough to object, so a clean verdict is weak evidence.',
      declared: 'judged g.sheets — the full six a Force-OTS room published at team preview. Four moves, ability and item on the declared species. A rejection is a fact about the TEAM, not about what got revealed.',
      why_both: 'The same open-sheet games judged both ways are a control on each other. Illusion can forge a REVEAL and cannot forge a DECLARATION, so the gap in the move class measures the size of the disguise artefact.',
      never_pooled: 'engine/ingest_ots.js refuses to pool games.bo3.jsonl and games.ots.jsonl; a pooled rate would hide a dirty collection behind a large one. Every rate is against its own named denominator.',
    },
    stores: storeBlock,
    known_limitations: {
      no_drift_detector: "engine/validate_store.js's header cites engine/format_drift.js as the thing that separates a contaminated game from a stale rulebook. THAT FILE HAS NEVER EXISTED (checked 2026-08-27). Nothing here distinguishes 'played under custom rules' from 'our Showdown checkout is behind the regulation'; every verdict in this file is the union of the two, on every store.",
      snapshot: 'OPS appends to games.ladder.jsonl and games.bo3.jsonl hourly and no workflow re-runs this tool, so this verdict decays from the moment it is written. judged_games is the denominator actually examined; anything appended since has not been judged at all.',
      per_mon_not_per_team: 'Sets are validated ONE AT A TIME so the classifier means the same thing under both rulers. Team-level clauses (Species Clause, Item Clause, and any team-size rule) are therefore NOT checked even where a full declared six is available.',
      declared_ruler_coverage: 'The DECLARED ruler can only judge a game that published sheets. Its no_ruler_input count is the number it skipped, and it is skipped rather than silently handed to the other ruler.',
    },
  }, null, 2) + '\n');
  console.log('  -> data/store-validation.json');
}
