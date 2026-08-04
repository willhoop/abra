/* THE STADIUM'S CABINET RACK MUST MATCH THE MODEL LEDGER.
 *
 * web/stadium.html hand-carries a model list. That is a DERIVED ARTIFACT with a SOURCE
 * (docs/MODELS.md), and CLAUDE.md's rule applies to it exactly as it applied to
 * data/engine-data.js against data/mega-dex-official.json: a generated file needs a check
 * that its source's values are actually in it, or it drifts silently and keeps working.
 *
 * The failure this prevents is specific and cheap to hit: someone adds a model to
 * docs/MODELS.md, the Stadium keeps rendering the old rack, and the page looks complete
 * while being wrong. A missing cabinet is invisible -- there is no gap on screen where a
 * model should have been.
 *
 * Per the same rule, a gap that is a JUDGEMENT is declared here with its reason rather
 * than being averaged away. Sections of MODELS.md that are not models do not get cabinets.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MD = fs.readFileSync(path.join(ROOT, 'docs', 'MODELS.md'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'web', 'stadium.html'), 'utf8');

/* NOT MODELS. Each one is a section of the ledger that describes data, a companion tool,
 * a cross-cutting practice or a status note -- none of them is a thing that makes a
 * decision, so none of them gets a cabinet. Declared, with the reason, not filtered out
 * by a pattern that would also swallow a real model added later. */
const NOT_A_CABINET = {
  'The learning core':        'a pipeline (self-play -> retrain -> re-evaluate), not a model',
  'CHOMP / ORB':              'companion tools, and they live in a separate repository',
  'Evaluation & honesty':     'a cross-cutting practice, not a component',
  'Status of the "one thing that unblocks everything"': 'a status note',
  'ROLES':                    'a labelling of teams, consumed by models rather than deciding',
  'WAR':                      'a statistic computed over the store',
  'NMF':                      'a decomposition that produces archetypes, consumed downstream',
  'COUNTERPLAY':              'a report over the field, not a decision-maker',
  'MEGA DEX':                 'a data artifact -- the formes the engine could not see',
  'ILLUSION':                 'a detection rule inside ingest',
  'CHAMPIONS_SIM':            'the official engine we play inside (ADR-001), not ours',
  'SMOGON PRIORS':            'an external population statistic we consume',
};

/* MODELS.md headings look like "## NAME — long description (added ...)". Take the part
 * before the em dash, then drop a trailing parenthetical qualifier.
 *
 * The qualifier has to go or the check compares spellings instead of identities: the
 * ledger says "MAGNEMITE (MAG)" and "XATU (belief state)", and both are the same model as
 * the cabinet named MAGNEMITE and XATU. This is CLAUDE.md's own warning about the mega
 * merge -- ask whether two keys NORMALISE alike, not whether two files spell them alike. */
const norm = s => s.replace(/\s*\([^)]*\)\s*$/, '').trim();
const headings = [...new Set((MD.match(/^## .+$/gm) || []).map(h =>
  norm(h.replace(/^##\s+/, '').split(/\s+—\s+/)[0])))];

/* The Stadium's own list, read out of the file rather than duplicated here -- duplicating
 * it would make this test agree with itself instead of with the page. */
const cabinets = [...HTML.matchAll(/\bmon:\s*"([^"]+)"/g)].map(m => m[1]);

let failures = 0;
const fail = msg => { failures++; console.log('  FAIL  ' + msg); };
const pass = msg => console.log('  ok    ' + msg);

console.log('STADIUM ROSTER — web/stadium.html against docs/MODELS.md\n');

/* 1. No phantom cabinets: everything on screen must exist in the ledger. */
const missingFromLedger = cabinets.filter(c => !headings.includes(c));
if (missingFromLedger.length) {
  fail('cabinets with no entry in docs/MODELS.md: ' + missingFromLedger.join(', '));
} else {
  pass(cabinets.length + ' cabinets, every one of them a heading in the ledger');
}

/* 2. No missing cabinets: every model in the ledger must be on screen, unless it is
 *    declared above as not being a model at all. */
const undeclared = headings.filter(h => !cabinets.includes(h) && !(h in NOT_A_CABINET));
if (undeclared.length) {
  fail('models in docs/MODELS.md with NO cabinet and NO declared reason:\n' +
       undeclared.map(u => '          - ' + u).join('\n') +
       '\n        Add a cabinet to web/stadium.html, or add the name to NOT_A_CABINET here\n' +
       '        WITH the reason it is not a model. Do not delete this test to make it pass.');
} else {
  pass('every model heading has a cabinet or a declared reason for not having one');
}

/* 3. The declared exceptions must still be real. A stale exception is how a check stops
 *    checking: if a section is renamed, its entry here silently starts excusing nothing. */
const staleExceptions = Object.keys(NOT_A_CABINET).filter(k => !headings.includes(k));
if (staleExceptions.length) {
  fail('NOT_A_CABINET names that no longer appear in docs/MODELS.md (rename or remove them): ' +
       staleExceptions.join(', '));
} else {
  pass(Object.keys(NOT_A_CABINET).length + ' declared non-models all still present in the ledger');
}

/* 4. No duplicate cabinets -- two entries for one model would render twice and each would
 *    look correct on its own. */
const dupes = cabinets.filter((c, i) => cabinets.indexOf(c) !== i);
if (dupes.length) fail('duplicate cabinets: ' + [...new Set(dupes)].join(', '));
else pass('no duplicate cabinets');

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PASS') +
            '   (' + cabinets.length + ' cabinets, ' + headings.length + ' ledger headings)');
process.exit(failures ? 1 : 0);
