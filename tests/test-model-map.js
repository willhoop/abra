/* THE MODEL MAP MUST NOT DRIFT FROM THE MODEL LEDGER.
 *
 *   node tests/test-model-map.js
 *   node tests/test-model-map.js --selftest    plant a model with no box and assert rejection
 *
 * Auto-discovered by tests/run-all.js (`readdirSync` over /^test-.*\.(js|py)$/), so it is covered
 * the moment this file lands.
 *
 * WHY THIS EXISTS (Will, 2026-08-06: "i want to make sure nothing is left out, this project is
 * massive and has so many different parts i cant keep track of all them.")
 * ------------------------------------------------------------------------------------------------
 * MEASURED, 2026-08-06: docs/MODELS.md carried 32 model headings and web/models.html — a page
 * TITLED "THE MODEL MAP" — named 14 of them. Five of the missing were not defensible omissions:
 *
 *   DODUO          the pair/coordination model
 *   MACHAMP        champion promotion; its own ledger calls it the largest untested lever here
 *   WOBBUFFET      the exploitability search — the only thing that looks for MAG's leak
 *   GURU           the archetype matchup matrix, which SLOWKING's preview solve reads
 *   CHAMPIONS_SIM  the OFFICIAL ENGINE, subject of ADR-001
 *
 * A map that omits the authoritative engine is not a map. This is the same failure shape as
 * tests/test-stadium-roster.js: a page hand-carries a list that a source file also carries, the two
 * drift, and NOTHING ON SCREEN LOOKS WRONG — a missing box leaves no gap where a model should have
 * been. CLAUDE.md: a derived artifact is not a fact until something compares it to its source.
 *
 * THE JUDGEMENT HALF, WHICH IS THE DANGEROUS HALF
 * ------------------------------------------------------------------------------------------------
 * Some ledger entries legitimately do not belong on a DECISION-FLOW map — a census over the store is
 * not a thing that decides. That is a JUDGEMENT, and this project's rule is that a judgement is
 * DECLARED WITH ITS REASON rather than left as an accident. So every omission lives in DECLARED
 * below with a reason, in the same shape as tests/test-effective-identity.js's DECLARED block, which
 * exists precisely so that a baseline bump cannot launder a real omission. Three rules keep it from
 * becoming a mute button:
 *
 *   1. a declaration needs a REASON about what the model IS — "a census the deciders read" — not
 *      "it did not fit on the page";
 *   2. a declaration is PRINTED on every run, so nothing hides in here;
 *   3. THE PAGE CARRIES THE SAME LIST. Check 7 asserts every declared name is named in the page's
 *      own "not on this map" note, so a visitor is told what the picture leaves out. A declaration
 *      only the test can see is an exemption.
 *
 * THE SHORT-NAME CASE IS HANDLED EXPLICITLY, NOT BY SUBSTRING MATCHING
 * ------------------------------------------------------------------------------------------------
 * The site's standing decision (docs/WEB.md) is NAME + a plain-English job, so the map says MAG
 * where the ledger heading says "MAGNEMITE (MAG)". A loose `HTML.includes(name)` would report false
 * gaps forever and get ignored — which is exactly how tests/test-docs-current.js became "one of the
 * two known failures" (CLAUDE.md). It would also fail the other way: `nameBounded` exists because
 * tests/test-stadium-roster.js was caught excusing engine/policy.js by the substring `fit_policy.js`.
 * So: matching is CASE-SENSITIVE (the map names models in capitals), BOUNDED on both sides, and any
 * remaining difference is an ALIAS declared by name with its reason.
 *
 * WHERE IT LOOKS. Only inside <svg>...</svg>, with HTML comments and <style> stripped — a comment is
 * not visible text (the same definition web/figure-audit.js uses), so a model cannot be "on the map"
 * by being mentioned in a source comment, and the "not on this map" note below the picture cannot
 * accidentally satisfy the check it is describing.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MD_PATH = path.join(ROOT, 'docs', 'MODELS.md');
const HTML_PATH = path.join(ROOT, 'web', 'models.html');

/* ================================================================================================
 * DECLARED — ledger entries that deliberately have no box on the decision-flow map.
 *
 * The rule that decides which side of this line an entry falls on, written down so a reader can
 * apply it to an entry this table has never heard of:
 *
 *   A ledger entry gets a BOX when something ACTS on it — when a decision, a search, a rollout or a
 *   page consumes it and would choose differently without it.
 *
 *   It is DECLARED when it is a CENSUS, a REPORT or a REPAIR — it states something true about the
 *   format or about our own data, and the thing that acts on it is already drawn.
 *
 * This is deliberately the same cut docs/WEB.md records for the Stadium roster, one level over:
 * there the question is "does it decide", here it is "does the decision flow run through it".
 * ============================================================================================== */
const DECLARED = {
  'ROLES':
    'A LABELLING VOCABULARY, not a decider. It describes every team by the functional roles it '
    + 'reveals, and its own ledger entry reports that predicting the winner from preview roles TIES A '
    + 'COIN. The things that consume it — DITTO and XATU (team context) — are both boxes on the map, '
    + 'so the decision path it touches is drawn; the vocabulary itself is not a step in it.',
  'WAR':
    'A PER-SPECIES STATISTIC over the store, and its ledger entry WITHDREW it: measured on clean '
    + 'games it is worse than a coin, and the earlier result was learning which species belonged to '
    + 'the highest-volume bot account. Nothing reads data/war.json to decide anything, so there is no '
    + 'edge to draw and a box would imply one.',
  'NMF':
    'A DECOMPOSITION that discovers archetypes and roles from the data instead of hand-declaring '
    + 'them. Its output is a vocabulary consumed downstream, and it is already rendered on ABRA WORLD '
    + 'as the Role Foundry booth. It fits no decision and sits on no turn.',
  'COUNTERPLAY':
    'A REPORT OVER THE FIELD — does the metagame spend its spare move slots answering its top '
    + 'threats. It answers a question about PLAYERS, not a question the bot asks on a turn, and '
    + 'nothing downstream reads data/counterplay.json.',
  'COUNTERS':
    'The same class as COUNTERPLAY, and its headline is a NULL: of 1,081 tests, ZERO survive '
    + 'Benjamini-Hochberg in any of the eleven matchups. Its own ledger entry records that no engine, '
    + 'page or bot reads data/counters.json. There is nothing for the map to route through it.',
  'CORES':
    'A MATCHUP MATRIX at a grain the corpus cannot support — the median cell rests on nine games — '
    + 'and its own ledger entry says "do not quote a cell from it". Drawing it on a decision map '
    + 'would imply something acts on those cells; only engine/sanity_check.py reads the file.',
  'DYNAMICS':
    'OBSERVED PHYSICS measured off the event stream — who actually moved first, and what each move '
    + 'actually took off. Its ledger entry states that the engine\'s own facts about speed live in '
    + 'engine/board.js and engine/medicham2-browser.js and are deliberately NOT taken from this file. '
    + 'It is evidence the engine is checked against, not a rule the engine follows.',
  'MEGA DEX':
    'A DATA REPAIR rather than a model: it put real mega stats, types and abilities into the engine '
    + 'dex, which had held one mega forme while Charizard-Mega-Y alone appeared in hundreds of sets. '
    + 'The thing it repaired is MEDICHAM, and MEDICHAM is on the map.',
  'ILLUSION':
    'A LEGALITY-CONTRADICTION RULE inside ingest: if the apparent species cannot learn a move and '
    + 'Zoroark can, the disguise is proven. It is a detector in the pipeline, and the belief it '
    + 'sharpens is XATU\'s, which has a box.',
  'SMOGON PRIORS':
    'AN EXTERNAL POPULATION STATISTIC we consume — Smogon\'s published usage over the whole ladder. '
    + 'It is an input this project did not measure, and band 1 of the map is about where OUR games '
    + 'come from. It is named in the ledger as an outside source and is treated as one.',
  'SPECIES SETS':
    'THE DECLARED OPEN-SHEET SET DISTRIBUTION, read by the team builders (engine/showdown_bot.js, '
    + 'build/rebuild_sets_from_sheets.js) rather than by anything that decides a turn. Its own ledger '
    + 'entry says NOT MEASURED whether building from these sets changes any outcome — the '
    + 'distribution is a fact and the improvement is a claim nobody has tested.',
  'BRING PRIORS':
    'A PRIOR THE OPPONENT MODEL DRAWS FROM, not a decider: p_lead and p_bring per species. The thing '
    + 'that would draw from it is GARY, which HAS a box, and that box already says the draw is off. '
    + 'Its ledger entry also warns that p_bring is biased down because a Pokemon selected but never '
    + 'sent out is invisible to a replay — treat it as a ranking, not a rate. CANDIDATE FOR A BOX '
    + 'the day GARY is switched on: at that point something acts on it and the rule above flips.',
};

/* ================================================================================================
 * ALIASES — the map's name for a model differs from the ledger heading, by decision.
 *
 * Each entry is a NAME and a REASON. This is the one mechanism by which a heading can be satisfied
 * by a different string, and it is deliberately a short explicit table rather than a fuzzy matcher:
 * a fuzzy matcher cannot be reviewed, and a reviewer is the only thing that can tell "the site calls
 * MAGNEMITE by its short name" from "somebody dropped a model".
 * ============================================================================================== */
const ALIASES = {
  'MAGNEMITE': {
    on: ['MAG'],
    why: 'docs/WEB.md standing decision — the site uses the name plus a plain-English job, and MAG is '
       + 'the name this project uses everywhere for it. The ledger heading is itself "MAGNEMITE (MAG)", '
       + 'so both spellings are the ledger\'s own.',
  },
  'META-USAGE': {
    on: ['META USAGE'],
    why: 'One artifact, two spellings of one name: the ledger hyphenates after data/meta-usage.json, '
       + 'the box title reads as two words. Nothing else in either file spells it either way.',
  },
  'MOVE PRIORS': {
    on: ['BEHAVIOUR PRIORS'],
    why: 'The ledger heading is "MOVE PRIORS — the behaviour clone", and the map titles the box with '
       + 'the second half of that same heading because it is the plain-English half. Same generator '
       + '(engine/policy.js), same artifact (data/move-priors.json).',
  },
};

/* ================================================================================================
 * NOT_A_LEDGER_MODEL — a box on the map whose title has the ledger's own "NAME — job" shape but
 * which is not a docs/MODELS.md heading. The reverse direction: two directions catch a model that is
 * in ONE of the two files (tests/test-stadium-roster.js records why that matters).
 * ============================================================================================== */
const NOT_A_LEDGER_MODEL = {
  'THE PC':
    'A SHELF, not a model. It holds three value nets that each have their own docs/MODELS.md '
    + 'presence — PORY (retracted inside the KADABRA entry), JOLTEON and PORYGON2 — and it exists as '
    + 'one box because putting three retired-or-unmeasured leaves side by side is the honest picture. '
    + 'JOLTEON and PORYGON2 are both matched by the forward check in their own right.',
  'ALAKAZAM':
    'THE CAPSTONE\'S PROJECT NAME, and it has no heading of its own in docs/MODELS.md — the ledger '
    + 'documents its PARTS (SLOWKING, MILTANK, GARY, DUSK, the value nets) instead. That is a real gap '
    + 'in the ledger and docs/MODELS.md is MEASURE\'s file, so it is REPORTED here rather than fixed '
    + 'here. The day an ALAKAZAM heading lands, check 6 goes red and this entry gets deleted.',
};

/* ---- parsing ---------------------------------------------------------------------------------- */

/* A ledger MODEL heading is `## NAME — job`, where NAME is ALL-CAPS. Both halves of that rule are
 * load-bearing:
 *   - the EM DASH excludes the prose sections, which have none. "## CHOMP / ORB (companion tools,
 *     separate repo)" is all-caps and is not a model heading; "## The learning core (the flywheel)"
 *     is neither.
 *   - ALL-CAPS excludes "## Measurement environment, 3.39.0 — read before quoting any model number",
 *     which does have an em dash.
 * The trailing parenthetical is dropped so the check compares IDENTITIES rather than spellings —
 * "XATU (belief state)" and "MAGNEMITE (MAG)" are XATU and MAGNEMITE. That is CLAUDE.md's own
 * warning about the mega merge: ask whether two keys NORMALISE alike. */
const dropQualifier = s => s.replace(/\s*\([^)]*\)\s*$/, '').trim();
const isAllCaps = s => /[A-Z]/.test(s) && !/[a-z]/.test(s) && /^[A-Z0-9][A-Z0-9 _\-/]*$/.test(s);

function ledgerHeadings(md) {
  const out = [];
  for (const raw of md.match(/^## .+$/gm) || []) {
    const body = raw.replace(/^##\s+/, '');
    if (!/\s—\s/.test(body)) continue;                 /* prose section: no em dash */
    const name = dropQualifier(body.split(/\s—\s/)[0]);
    if (!isAllCaps(name)) continue;                    /* prose section: not a model name */
    out.push({ name, raw });
  }
  return out;
}

/* THE MAP IS THE <svg>, AND ONLY THE <svg>. Comments and <style> are stripped because they are not
 * visible text — the same definition web/figure-audit.js uses — so a model cannot be "on the map"
 * because a source comment names it, and the page's own "not on this map" note (which sits OUTSIDE
 * the svg and names every declared omission) cannot satisfy the check it describes. */
function mapText(html) {
  const m = html.match(/<svg[\s\S]*?<\/svg>/i);
  if (!m) return '';
  return m[0]
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

/* The box titles, in the ledger's own "NAME — job" shape. Used for the reverse direction only. */
function mapTitles(html) {
  const svg = (html.match(/<svg[\s\S]*?<\/svg>/i) || [''])[0].replace(/<!--[\s\S]*?-->/g, ' ');
  const out = [];
  for (const t of svg.matchAll(/<text\b[^>]*class="t"[^>]*>([\s\S]*?)<\/text>/g)) {
    const txt = t[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!/\s—\s/.test(txt)) continue;
    const name = dropQualifier(txt.split(/\s—\s/)[0]);
    if (isAllCaps(name)) out.push(name);
  }
  return [...new Set(out)];
}

/* BOUNDED ON BOTH SIDES, AND CASE-SENSITIVE. Bounded because tests/test-stadium-roster.js records a
 * real model being excused by an unbounded substring. Case-sensitive because the map names models in
 * capitals, and a case-insensitive match would let the ordinary English words "counters", "cores",
 * "roles" and "war" in body prose stand in for four models that are not there. */
function nameBounded(hay, needle) {
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    const before = hay[i - 1] || ' ', after = hay[i + needle.length] || ' ';
    if (!/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after)) return true;
  }
  return false;
}
function namedOnMap(text, name) {
  if (nameBounded(text, name)) return name;
  const a = ALIASES[name];
  if (a) for (const alt of a.on) if (nameBounded(text, alt)) return alt;
  return null;
}

/* ---- the comparison, as a pure function so --selftest can drive it with planted input ---------- */
function evaluate(md, html) {
  const headings = ledgerHeadings(md);
  const names = [...new Set(headings.map(h => h.name))];
  const text = mapText(html);
  const titles = mapTitles(html);

  const present = [], missing = [];
  for (const n of names) {
    const hit = namedOnMap(text, n);
    if (hit) present.push({ name: n, as: hit });
    else if (!(n in DECLARED)) missing.push(n);
  }
  return {
    headings, names, text, titles, present, missing,
    declaredPresent: Object.keys(DECLARED).filter(n => namedOnMap(text, n)),
    declaredStale: Object.keys(DECLARED).filter(n => !names.includes(n)),
    titlesUnknown: titles.filter(t => !names.includes(t) && !Object.values(ALIASES).some(a => a.on.includes(t))
                                      && !(t in NOT_A_LEDGER_MODEL)),
    notLedgerStale: Object.keys(NOT_A_LEDGER_MODEL).filter(t => !titles.includes(t)),
    aliasBad: Object.keys(ALIASES).filter(n => !names.includes(n)),
    aliasRedundant: Object.keys(ALIASES).filter(n => nameBounded(text, n)),
  };
}

/* ================================================================================================
 * --selftest — PLANT A MODEL WITH NO BOX AND ASSERT REJECTION.
 *
 * A gate that has never failed has never been tested. Checks 2 and 6 can only fail on something
 * undeclared, so the day the map is complete they go green and stay green — and from then on nothing
 * distinguishes "everything is on the map" from "the comparison broke". That is the failure shape
 * CLAUDE.md opens with: a capability was absent and everything reported success.
 * ============================================================================================== */
function selftest() {
  const md = fs.readFileSync(MD_PATH, 'utf8');
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  let p = 0, f = 0;
  const claim = (c, m) => { if (c) { p++; console.log('  ok   ' + m); } else { f++; console.log('  FAIL ' + m); } };

  console.log('MODEL MAP — SELFTEST (planting faults and asserting they are caught)\n');

  /* 1. A model heading with no box anywhere must be REPORTED MISSING. */
  const planted = md + '\n## ZUBAT — a planted model that is on no map (selftest)\n**Job:** be absent.\n';
  const r1 = evaluate(planted, html);
  claim(r1.names.includes('ZUBAT'), 'the planted heading parses as a MODEL heading');
  claim(r1.missing.includes('ZUBAT'),
    'check 2 REJECTS a model heading with no box and no declaration' +
    (r1.missing.includes('ZUBAT') ? '' : ' — it did not, so check 2 is no longer checking anything'));

  /* 2. And the same heading must NOT be rejected once a box carries it — otherwise check 2 is a
   *    constant failure rather than a comparison, which is just as useless. */
  const boxed = html.replace(/<\/svg>/i, '<text x="0" y="0" class="t">ZUBAT — planted</text></svg>');
  const r2 = evaluate(planted, boxed);
  claim(!r2.missing.includes('ZUBAT'), 'and ACCEPTS it once a box on the map names it');

  /* 3. A box whose title has the ledger's shape but no ledger heading must be reported (reverse). */
  const ghost = html.replace(/<\/svg>/i, '<text x="0" y="0" class="t">MEOWTH — a planted box</text></svg>');
  const r3 = evaluate(md, ghost);
  claim(r3.titlesUnknown.includes('MEOWTH'),
    'check 6 REJECTS a box whose title names a model the ledger has never heard of');

  /* 4. The short-name handling must be EXPLICIT, not loose. A model whose name merely occurs inside
   *    a longer word is NOT on the map. This is the substring fault test-stadium-roster.js was
   *    caught by, planted here before it can happen. */
  const gluedMd = md + '\n## DUGTRIO — a planted model (selftest)\n';
  const glued = html.replace(/<\/svg>/i, '<text x="0" y="0" class="io">DUGTRIONITE</text></svg>');
  claim(evaluate(gluedMd, glued).missing.includes('DUGTRIO'),
    'a name that only occurs INSIDE a longer word does not count as named on the map');

  /* 5. Case-sensitivity: the lowercase English word must not stand in for the model. */
  const caseMd = md + '\n## SNORLAX — a planted model (selftest)\n';
  const lower = html.replace(/<\/svg>/i, '<text x="0" y="0" class="io">snorlax</text></svg>');
  claim(evaluate(caseMd, lower).missing.includes('SNORLAX'),
    'a lowercase occurrence does not count — the map names models in capitals');

  /* 6. The real page, unplanted, must be CLEAN. A selftest that only proves the check can fail has
   *    not shown it can pass. */
  const r6 = evaluate(md, html);
  claim(r6.missing.length === 0,
    `the real page has no undeclared gap (${r6.present.length} of ${r6.names.length} named, ` +
    `${Object.keys(DECLARED).length} declared)` +
    (r6.missing.length ? ' — MISSING: ' + r6.missing.join(', ') : ''));

  console.log(`\nSELFTEST: ${p} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
}

if (process.argv.includes('--selftest')) selftest();

/* ---- the run ----------------------------------------------------------------------------------- */
const MD = fs.readFileSync(MD_PATH, 'utf8');
const HTML = fs.readFileSync(HTML_PATH, 'utf8');
const R = evaluate(MD, HTML);

let failures = 0;
const fail = m => { failures++; console.log('  FAIL  ' + m); };
const pass = m => console.log('  ok    ' + m);

console.log('MODEL MAP — web/models.html against docs/MODELS.md\n');

/* 1. A SCANNER THAT READS NOTHING REPORTS A CLEAN MAP. CLAUDE.md's one failure mode. Both parses are
 *    bounded well under today's values so ordinary growth does not trip them. */
if (R.names.length < 25 || R.text.length < 500 || R.titles.length < 8) {
  fail(`the parse read ${R.names.length} ledger model headings, ${R.text.length} characters of map ` +
       `text and ${R.titles.length} box titles. One of the two file formats moved and this check is ` +
       `reading nothing — fix the parse, do not delete it.`);
} else {
  pass(`${R.names.length} model headings in docs/MODELS.md, ${R.titles.length} named boxes on the map`);
}

/* 2. EVERY MODEL IN THE LEDGER IS ON THE MAP, OR IS DECLARED WITH A REASON. */
if (R.missing.length) {
  fail('models in docs/MODELS.md with NO box on the map and NO declared reason:\n' +
       R.missing.map(u => '          - ' + u).join('\n') +
       '\n        Add a box to web/models.html, or add the name to DECLARED here WITH the reason it\n' +
       '        does not belong on a decision-flow map. Do not add a pattern, and do not delete this\n' +
       '        check to make it pass.');
} else {
  pass(`${R.present.length} of ${R.names.length} model headings are named on the map` +
       ` (${Object.keys(DECLARED).length} declared out)`);
}

/* 3. A DECLARATION THAT HAS BEEN OVERTAKEN IS A CONTRADICTION, not a judgement. If the map has since
 *    grown a box for something declared absent, the excuse must go or the next reader believes the
 *    project decided it did not belong. */
if (R.declaredPresent.length) {
  fail('DECLARED names that the map now carries anyway — delete the declaration, it is no longer a ' +
       'judgement: ' + R.declaredPresent.join(', '));
} else {
  pass('no declared omission is also drawn on the map');
}

/* 4. A STALE DECLARATION IS HOW A CHECK STOPS CHECKING. If a heading is renamed, its entry here
 *    silently excuses nothing while still looking like diligence. */
if (R.declaredStale.length) {
  fail('DECLARED names that are no longer headings in docs/MODELS.md (rename or remove them): ' +
       R.declaredStale.join(', '));
} else {
  pass(`${Object.keys(DECLARED).length} declared omissions all still exist as ledger headings`);
}

/* 5. EVERY ALIAS RESOLVES A REAL HEADING, and an alias that is no longer needed is reported. */
if (R.aliasBad.length) {
  fail('ALIASES keyed on something that is not a ledger heading: ' + R.aliasBad.join(', '));
} else {
  pass(`${Object.keys(ALIASES).length} declared short names all key a real ledger heading`);
}
if (R.aliasRedundant.length) {
  console.log('  note  the map now spells these in full, so their ALIASES entry is no longer load-' +
              'bearing: ' + R.aliasRedundant.join(', '));
}

/* 6. THE REVERSE DIRECTION: no box claims a model the ledger has never heard of. */
if (R.titlesUnknown.length) {
  fail('boxes on the map whose title has the ledger\'s "NAME — job" shape but which docs/MODELS.md\n' +
       '        does not carry:\n' + R.titlesUnknown.map(t => '          - ' + t).join('\n') +
       '\n        Either the ledger owes it an entry (docs/MODELS.md is MEASURE\'s file — REPORT it,\n' +
       '        do not edit it from here), or it is not a model and owes NOT_A_LEDGER_MODEL a reason.');
} else {
  pass('every named box on the map has a ledger heading or a declared reason for not having one');
}
if (R.notLedgerStale.length) {
  fail('NOT_A_LEDGER_MODEL entries for boxes that are no longer on the map: ' + R.notLedgerStale.join(', '));
} else {
  pass(`${Object.keys(NOT_A_LEDGER_MODEL).length} declared non-model boxes all still on the map`);
}

/* 7. THE PAGE SAYS WHAT IT LEAVES OUT. A declaration only this file can see is an exemption; the
 *    visitor is entitled to the same list. The note lives OUTSIDE the <svg> so it cannot satisfy
 *    check 2 for the very models it is excluding. */
const noteM = HTML.match(/<div[^>]*id="notonmap"[^>]*>([\s\S]*?)<\/div>/i);
if (!noteM) {
  fail('web/models.html has no <div id="notonmap"> — the page must name what the map leaves out, ' +
       'not just this test. Add it BELOW the svg.');
} else {
  const note = noteM[1].replace(/<[^>]*>/g, ' ');
  const unnamed = Object.keys(DECLARED).filter(n => !nameBounded(note, n));
  if (unnamed.length) {
    fail('declared omissions that the page does not admit to in its "not on this map" note: ' +
         unnamed.join(', '));
  } else {
    pass(`the page's own note names all ${Object.keys(DECLARED).length} declared omissions`);
  }
  if (mapText(HTML).length && noteM.index < HTML.search(/<\/svg>/i)) {
    fail('the "not on this map" note is INSIDE the svg, where it would satisfy check 2 for every ' +
         'model it excludes. Move it below </svg>.');
  }
}

/* 8. AND THE CHECKS ABOVE MUST ACTUALLY BITE — the same guard tests/test-stadium-roster.js check 8
 *    carries, run on every ordinary run rather than only under --selftest. */
{
  /* The probe names are shaped like real model names — ALL-CAPS, leading letter — deliberately, so
   * they travel the SAME path a real model does. A probe the parser rejects for its spelling would
   * prove nothing about the comparison. */
  const probe = evaluate(MD + '\n## ZZGUARDPROBE_LEDGER — a name in no file (probe)\n', HTML);
  const ghost = evaluate(MD, HTML.replace(/<\/svg>/i,
    '<text x="0" y="0" class="t">ZZGUARDPROBE_BOX — a box in no ledger</text></svg>'));
  const caught2 = probe.missing.includes('ZZGUARDPROBE_LEDGER');
  const caught6 = ghost.titlesUnknown.includes('ZZGUARDPROBE_BOX');
  if (!caught2 || !caught6) {
    fail(`the comparison accepted a planted ${!caught2 ? 'model heading with no box' : ''}` +
         `${!caught2 && !caught6 ? ' and a ' : ''}${!caught6 ? 'box with no ledger heading' : ''}. ` +
         'Checks 2 and 6 cannot fail, so they are no longer checking anything.');
  } else {
    pass('a planted model with no box, and a planted box with no model, are both rejected — the ' +
         'checks still bite');
  }
}

/* PRINTED EVERY RUN. A declaration nobody sees is an exemption, and this file exists because an
 * omission nobody saw put five real models off the project's own map. */
console.log(`\n  ON THE MAP — ${R.present.length}:`);
for (const p of R.present) console.log(`    ${p.name}${p.as === p.name ? '' : '  (as "' + p.as + '")'}`);
console.log(`\n  DECLARED NOT ON THE MAP — ${Object.keys(DECLARED).length}, each with its reason:`);
for (const [n, why] of Object.entries(DECLARED)) console.log(`    ${n}\n        ${why}`);
console.log(`\n  DECLARED SHORT NAMES — ${Object.keys(ALIASES).length}:`);
for (const [n, a] of Object.entries(ALIASES)) console.log(`    ${n} -> ${a.on.join(', ')}\n        ${a.why}`);
console.log(`\n  BOXES THAT ARE NOT LEDGER MODELS — ${Object.keys(NOT_A_LEDGER_MODEL).length}:`);
for (const [n, why] of Object.entries(NOT_A_LEDGER_MODEL)) console.log(`    ${n}\n        ${why}`);

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PASS') +
            `   (${R.names.length} ledger models, ${R.present.length} on the map, ` +
            `${Object.keys(DECLARED).length} declared out)`);
process.exit(failures ? 1 : 0);
