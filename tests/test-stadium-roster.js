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
/* AND TWO DIRECTIONS ARE NOT ENOUGH, WHICH IS WHAT GURU PROVED.
 *
 * The two checks above compare the page to the ledger and the ledger to the page. Between them they
 * catch a model that is in ONE of the two files. They are structurally blind to a model that is in
 * NEITHER -- and GURU was exactly that. `engine/guru.py` writes `data/guru-matchups.json`,
 * `build/build_guru_js.js` wraps it as `data/guru.js`, `web/index.html` renders it on the front
 * door, and GURU had no `## GURU` heading and no cabinet. Nothing on either side of the comparison
 * knew it existed, so both directions passed while the project's archetype matchup matrix was
 * undocumented. (PRIORITIES #41.)
 *
 * So there is a THIRD source of truth, and it is neither of the first two: the set of things that
 * actually GENERATE a `data/*` artifact. A generator is a fact about the code -- it is there whether
 * or not anybody wrote it down -- which is precisely the property the other two lack.
 *
 * IT IS READ FROM `engine/provenance.js --graph`, NOT RESCANNED HERE. That file already derives the
 * whole artifact graph from the source (84 artifacts, 57 counted off the game store, each attributed
 * to the generator that WRITES it, with three ranked write tests and named exclusions for the false
 * attributions it has already been caught making). A second scanner in this file would be a second
 * implementation of "who writes what", the two would disagree eventually, and the disagreement would
 * be invisible -- CLAUDE.md, FACTS ARE GLOBAL.
 *
 * Its report is parsed as text because that is the only interface it offers. The smallest change
 * that would remove the parsing is `--graph --json` (or exporting `deriveGraph`) in
 * engine/provenance.js; ENGINE owns that file, this division does not, and text is honest in the
 * meantime. The parse asserts a row count so it cannot silently read nothing.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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
  /* Added 2026-08-04 with the eight ledger entries the third direction demanded. Each of these is a
   * CENSUS OR A PRIOR over the store -- it states what the format does and is then consumed by
   * something that decides -- which is the same reason ROLES, WAR, NMF and COUNTERPLAY above have no
   * cabinet. A cabinet is for a thing that makes a decision. None of these makes one. */
  'META-USAGE':               'a usage census over the store; the models that read it are the ones that decide',
  'MOVE PRIORS':              'a measured frequency table, sampled FROM by the rollout rather than deciding anything',
  'PORYGON2':                 'a value LOOKUP with no measured verdict and no live caller; NOT MEASURED, so there is nothing to exhibit',
  'SPECIES SETS':             'the observed set distribution — data the builders read, not a decision-maker',
  'COUNTERS':                 'a report over the field, like COUNTERPLAY; and its headline is a null',
  'BRING PRIORS':             'a prior the opponent model draws from, consumed rather than deciding',
  'CORES':                    'a matchup matrix at a grain the corpus cannot support; do not put a cell on a page',
  'DYNAMICS':                 'observed physics — evidence the engine is checked against, not a rule it follows',
};

/* ================================================================================================
 * WHAT COUNTS AS A MODEL, AND WHAT IS ONLY A PIPELINE STEP
 * ================================================================================================
 * 57 store-derived generators against 12 cabinets is a large gap and MOST OF IT IS LEGITIMATE. A
 * build script is not a model. But the exception list is the dangerous half of this check, not the
 * scan: a filter broad enough to drop every `build/*` will drop the next real model that happens to
 * live there, and a check that excuses things by shape stops checking. So every exception is a NAME
 * and a REASON, like NOT_A_CABINET above, and the rule that decides which list a generator lands in
 * is written here so a reader can apply it to a file this table has never heard of.
 *
 *   A generator is a MODEL when its artifact states something about CHAMPIONS -- the game, its
 *   players, or the metagame -- that anything or anyone is meant to ACT on.
 *
 *   It is a PIPELINE STEP when its artifact states something about ABRA instead -- our own code's
 *   cost, coverage, calibration, conformance or corpus -- or when it only RE-ENCODES a statement
 *   that already has a home somewhere else.
 *
 * The question that settles it: IF THIS NUMBER IS WRONG, WHO IS MISLED?
 *   - a player, the bot, or a visitor reading a page   -> MODEL. It needs a docs/MODELS.md entry.
 *   - only us, while deciding what to build next      -> a measurement of our own code. Its home is
 *                                                        the division ledger, not the model ledger.
 *   - nobody, because the number came from elsewhere
 *     and this only reshaped it                       -> a re-encoding. engine/artifact_audit.js and
 *                                                        tests/test-artifact-keys.js check those
 *                                                        against their source; that is their guard.
 *
 * Three corollaries, each of which caught a wrong first answer while this table was being written:
 *
 *   READING THE GAME STORE DOES NOT MAKE YOU A MODEL. `build/build_ability_blocks.js` walks real
 *   battles to learn which ability nullifies which move. That is a CENSUS OF A RULE: run it on twice
 *   the games and coverage rises, the answer does not move. An estimate moves.
 *
 *   NOT READING THE GAME STORE DOES NOT SAVE YOU FROM BEING ONE. `engine/slowking_preview.py` opens
 *   no game file and is unambiguously a model -- it solves a matrix and publishes an equilibrium
 *   that can be wrong.
 *
 *   NOTHING CONSUMING IT DOES NOT SAVE YOU EITHER, and this one is load-bearing. It is tempting to
 *   exempt any artifact no other file reads, and it would shrink this table by a dozen entries. It
 *   is also exactly the failure CLAUDE.md records: "PORYGON2 and DODUO were fitted, saved, quoted in
 *   documents, and never once in a live decision." An unwired model is still a model. Consumption is
 *   evidence about IMPORTANCE, never about whether something needs writing down.
 * ============================================================================================== */
const NOT_A_MODEL = {
  /* --- RE-ENCODINGS. The site is buildless and cannot require(), so every artifact a page reads
   *     exists twice. The second copy makes no claim of its own; the claim belongs to the file it
   *     was built from, and that file is the one that owes a ledger entry. --- */
  /* build/build_guru_js.js was here for one evening and is deliberately NOT any more: MEASURE's
   * GURU entry names it, so arm (a) accounts for it and check 7 fires on the leftover excuse.
   * Keeping it would have read as "the project decided this is not a model", beside a ledger
   * entry saying the opposite. */
  'build/build_mag_data.js':      'wraps MAGNEMITE\'s weights and priors as data/mag.js; the claim is MAG\'s',
  'build/build_meta_js.js':       'the Tower\'s threat list, ranked out of data/meta-usage.json; the claim is the usage model\'s',
  'build/build_mew_bundle.js':    'a handful of self-play games trimmed to what the MEW viewer draws',
  'build/build_scoreboard.js':    'precomputed MAG traces for web/scoreboard.html; the claim is MAG\'s',
  'build/build_tags_js.js':       'window.ABRA_TAGS, a wrapper of data/tags.json and nothing else',
  'build/build_board_browser.js': 'the data engine/board.js needs as a browser global; a repackaging of the engine\'s own tables',
  'build/build_browser_data.js':  'browser copies of CHOMP\'s canonical dex files (formes, move effects)',
  'engine/build_roles_js.py':     'a browser-weight trim of ROLES\' three artifacts; ROLES has its own ledger entry',
  'engine/build-status.js':       'reads every model\'s shipped report and emits status badges; it restates other models\' verdicts and originates none',

  /* --- FACTS AND FORMAT, not estimates. Deterministic properties of the game, the dex or the
   *     protocol. More games raise coverage; they do not move the answer. --- */
  'build/build_ability_blocks.js':      'a census of a game RULE — which ability nullifies which move — measured rather than typed',
  'engine/build_species_abilities.js':  'which ability a species CAN have; declares RAW-STORE-OK for exactly this reason — a fact about the game, not about who plays it',
  'engine/tag_dex.js':                  'tags every move/item/ability with the PARAMETERS it sets, read out of the Showdown dex; tests/test-tag-wire.js is its guard',
  'engine/game-spec.js':                'a sample of the (state, observation, action, reward) ENCODING — a property of the protocol, and declared RAW-STORE-OK as such',

  /* --- SITE AND CORPUS PLUMBING. Counts of our own store, not claims about Champions. --- */
  'engine/refresh-site-data.NOARCH.py': 'the site refresh — corpus counts and a replay bundle for the coach. If it is wrong it misreports how much data WE hold, not how Champions is played. (Sandbox variant of engine/refresh-site-data.py, which the ledger does name; the duplicate is an OPS finding, not a model.)',

  /* --- MEASUREMENTS OF OUR OWN CODE. Each publishes a verdict ABOUT a model, a feature set or an
   *     affordability question. Its home is the division ledger — docs/MEASURE.md and docs/SEARCH.md
   *     carry these — and MODELS.md already declares "Evaluation & honesty" a cross-cutting practice
   *     rather than a component. An evaluation of a model is not itself a model. --- */
  'engine/collinearity_audit.js':    'fits every MAG feature alone against its weight in the full model — a diagnosis of MAG',
  'engine/collinearity_fix.js':      'can the kill block be repaired, and does repairing it help — a diagnosis of MAG',
  'engine/feature_audit.js':         'does every feature in board.js actually do anything — a diagnosis of the feature set',
  'engine/weight_multiplicity.js':   'which fitted weights survive a multiplicity correction — a statement about MAG\'s fit, not about Champions',
  'engine/opponent_recall.js':       'can MAG narrow the OPPONENT\'s turn — MAG\'s score, reported for MAG',
  'engine/opponent_calibration.js':  'is MAG a usable SAMPLER even though it is a poor ranker — MAG\'s score',
  'engine/recall_at_k.js':           'is MAG good enough to PRUNE — the number the search layer needs about MAG',
  'engine/conformance.js':           'does every file obey the standards the project set itself — a statement about this repository',
  'engine/double_protect.js':        'how often both slots Protect, our bot against humans — a realism diagnostic of our own player',
  'engine/nmf_rank.py':              'chooses NMF\'s rank by a criterion instead of by eye; a hyper-parameter selection for NMF, which has its own ledger entry',
  'engine/pory_nn.py':               'would a neural network beat counting Pokemon — a negative-result experiment; nothing reads data/pory-nn.json but a human',
  'engine/lookahead_bound.py':       'GATE — is there anything for a search to find; an oracle upper bound on OUR search',
  'engine/lookahead_clock_control.py':'GATE — is the oracle gain information or is it just the clock; the control for the bound above',
  'engine/lookahead_cost.js':        'GATE — can we afford to look one turn ahead; a cost measurement of our own code',
  'engine/rollout_r2.js':            'GATE R2 — what a rollout LEAF costs; a cost measurement of our own search',
  'engine/rollout_r3.js':            'GATE R3 — does the search PICK A DIFFERENT MOVE; a behaviour diagnostic of our own search',
  'engine/rollout_explore_sweep.js': 'should --rollout-explore default to 1.0 — a knob sweep over our own search',
  'engine/rollout_r1_join.py':       'phase 2 of GATE R1 — scores PORYGON2 on the positions the rollout scored; an evaluation, and PORYGON2 is the model it evaluates',
  'engine/bring_bias.js':            'does require_full_bring\'s length-conditioning move any bring rate — a diagnosis of OUR OWN corpus rule, and its answer is no (84 species tested, 12 clear a raw z, 0 survive BH against 4.2 expected). Its sibling engine/bring_priors.js is the model; this measures the filter, and nothing but itself reads data/bring-bias.json',
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

/* ================================================================================================
 * 5-7. THE THIRD DIRECTION: every generator of a data/* artifact is accounted for.
 * ============================================================================================== */
let graph = '';
try {
  graph = execFileSync(process.execPath, [path.join(ROOT, 'engine', 'provenance.js'), '--graph'],
                       { encoding: 'utf8', cwd: ROOT, maxBuffer: 1 << 24 });
} catch (e) {
  fail('could not run engine/provenance.js --graph: ' + (e && e.message));
}

/* One row per artifact. The columns are space-padded rather than delimited, and a name longer than
 * its column runs straight into the next one (`refresh-site-data.NOARCH.pyladder`), so the corpus
 * word anchors the end of the path instead of whitespace doing it. */
const GRAPH_ROW = /^ {2}([a-z0-9][^\s]*\.(?:json|js))\s\s+((?:engine|build)\/\S+?\.(?:js|py))\s*(?:ladder|opensheet)\s+(yes|no)\b/;
const artifacts = [];
for (const ln of graph.split(/\r?\n/)) {
  const m = GRAPH_ROW.exec(ln);
  if (m) artifacts.push({ file: m[1], by: m[2], store: m[3] === 'yes' });
}

/* A SCANNER THAT READS NOTHING REPORTS A CLEAN SITE. CLAUDE.md's one failure mode: "a capability was
 * absent, and everything reported success." If the report format ever moves, this must go red rather
 * than quietly excusing every generator in the project. The bound is well under the 84 rows the
 * graph holds today, so ordinary growth or pruning does not trip it. */
if (artifacts.length < 50) {
  fail('parsed only ' + artifacts.length + ' rows out of engine/provenance.js --graph (expected 50+). '
     + 'The report format moved and this check is reading nothing — fix the parse, do not delete it.');
} else {
  pass(artifacts.length + ' artifacts read from engine/provenance.js --graph, '
     + artifacts.filter(a => a.store).length + ' of them counted off the game store');
}

const generators = [...new Set(artifacts.map(a => a.by))].sort();
const writes = g => artifacts.filter(a => a.by === g).map(a => a.file);

/* IS THIS GENERATOR ACCOUNTED FOR? Two derived arms, then the declared table.
 *
 * (a) THE LEDGER NAMES THE FILE, in either language. A model ported from Python to JS is the same
 *     model: engine/ditto.js is described in the ledger as "DITTO (Node port)" of engine/ditto.py,
 *     and only the .js spelling appears there. Comparing spellings instead of identities is the
 *     mistake the mega merge made and the `norm()` above already guards against.
 *
 * (b) THE GENERATOR IS PLAINLY THAT MODEL'S. `engine/xatu.py` writes the belief distribution itself
 *     and the ledger's two XATU headings name only engine/xatu_belief.py and engine/xatu_context.py,
 *     which are its EVALUATIONS. XATU is documented and has a cabinet; the ledger simply cites a
 *     sibling file. Requiring the exact path there would have produced an exception entry whose
 *     reason was "XATU is documented", which is not a reason, it is the check failing.
 *
 * Cabinets are unioned in so this arm says literally what the rule says -- the ledger OR the site.
 * Check 1 already forbids a cabinet that is not a heading, so today it adds nothing; if that ever
 * relaxes, this keeps meaning what its comment says. */
/* AND `MD.includes(base)` IS A SUBSTRING TEST, WHICH EXCUSED A REAL MODEL. Measured 2026-08-04:
 * `engine/policy.js` — the behaviour clone that writes data/move-priors.json, which nine files read —
 * was accounted for by the string `fit_policy.js` appearing in the ledger. A different file, a
 * different model, and the check said "the ledger names policy.js". It is the same fault
 * engine/provenance.js was carrying in the other direction on the same day, where `ladder.json`
 * matched inside `games.ladder.jsonl` and credited the store reader with generating MACHAMP's
 * hill-climb artifact.
 *
 * A filename must be bounded on BOTH sides here, unlike in provenance.js where a leading `data/` or
 * `games.` is a legitimate spelling of the same file. `fit_policy.js` and `policy.js` are never the
 * same file. Swept across all generators, this was the only one being excused by a substring — so it
 * is one entry's worth of drift, and it was the entry that mattered. */
const nameBounded = (hay, needle) => {
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    const before = hay[i - 1] || '', after = hay[i + needle.length] || '';
    if (!/[A-Za-z0-9_]/.test(after) && !/[A-Za-z0-9_]/.test(before)) return true;
  }
  return false;
};
const documented = new Set([...headings, ...cabinets]);
function accountedFor(g) {
  const base = g.split('/').pop();
  const alt = base.endsWith('.js') ? base.slice(0, -3) + '.py' : base.slice(0, -3) + '.js';
  if (nameBounded(MD, base) || nameBounded(MD, alt)) return 'the ledger names ' + base;
  const stem = base.replace(/\.(js|py)$/, '').toUpperCase();
  if (documented.has(stem)) return 'it is ' + stem + "'s generator";
  if (g in NOT_A_MODEL) return 'declared not a model: ' + NOT_A_MODEL[g];
  return null;
}

/* 5. Nothing writes an artifact from outside both files without a declared reason. */
const undocumented = generators.filter(g => accountedFor(g) === null);
if (undocumented.length) {
  fail('generators of data/* artifacts that appear in NEITHER docs/MODELS.md NOR the Stadium,\n' +
       '        and have NO declared reason for being neither:\n' +
       undocumented.map(g => '          - ' + g.padEnd(34) + '-> data/' + writes(g).join(', data/')).join('\n') +
       '\n        This is the GURU hole. Each one is either a MODEL that owes docs/MODELS.md an entry\n' +
       '        (MEASURE owns that file), or a pipeline step that owes NOT_A_MODEL here a NAME AND A\n' +
       '        REASON. Read the rule above before choosing. Do not add a pattern, and do not delete\n' +
       '        this check to make it pass.');
} else {
  pass(generators.length + ' generators, every one of them named in the ledger or declared not a model');
}

/* 6. A stale exception is how a check stops checking -- the same failure the NOT_A_CABINET staleness
 *    test above exists for. If a script is renamed or deleted, its entry here silently excuses
 *    nothing while still looking like diligence. */
const staleNotAModel = Object.keys(NOT_A_MODEL).filter(g => !generators.includes(g));
if (staleNotAModel.length) {
  fail('NOT_A_MODEL entries that no longer generate any data/* artifact (rename or remove them): ' +
       staleNotAModel.join(', '));
} else {
  pass(Object.keys(NOT_A_MODEL).length + ' declared non-models all still generate an artifact');
}

/* 7. And an exception that has been overtaken is dead weight that reads as a judgement. If the
 *    ledger has since taken a generator on, the excuse for it not being there must go, or the next
 *    reader believes the project decided it was not a model. */
const redundant = Object.keys(NOT_A_MODEL).filter(g => {
  const base = g.split('/').pop();
  const alt = base.endsWith('.js') ? base.slice(0, -3) + '.py' : base.slice(0, -3) + '.js';
  return nameBounded(MD, base) || nameBounded(MD, alt);   // same boundary rule as check 5, one predicate
});
if (redundant.length) {
  fail('NOT_A_MODEL entries that docs/MODELS.md now documents — delete the exception, it is no longer ' +
       'a judgement, it is a contradiction: ' + redundant.join(', '));
} else {
  pass('no declared non-model is also carried by the ledger');
}

/* 8. AND THE CHECK ABOVE MUST ACTUALLY BITE.
 *
 * Check 5 can only fail on something undeclared, so the day the project is fully documented it goes
 * green and stays green -- and from then on nothing distinguishes "everything is accounted for" from
 * "the accounting broke". That is the failure shape CLAUDE.md opens with: a capability was absent and
 * everything reported success. So a synthetic generator that is in no file and no table is pushed
 * through the same accounting the real ones go through, and check 5 has to reject it.
 *
 * It covers the classification, not the scan -- the parse guard above covers the scan. Between them
 * the two halves of "would GURU be caught today" are both asserted on every run. */
const PROBE = 'engine/__roster_guard_selftest__.js';
if (accountedFor(PROBE) !== null) {
  fail('the accounting accepted ' + PROBE + ', which is in no ledger, on no cabinet and in no ' +
       'exception table. Check 5 cannot fail, so it is no longer checking anything.');
} else {
  pass('a generator in neither file and no exception table is rejected — check 5 still bites');
}

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PASS') +
            '   (' + cabinets.length + ' cabinets, ' + headings.length + ' ledger headings, ' +
            generators.length + ' artifact generators)');
process.exit(failures ? 1 : 0);
