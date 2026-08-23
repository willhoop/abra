/* test-mc-key.js — there is ONE way to turn a species name into an MC.mons key, and this bans the others.
 *
 *   node tests/test-mc-key.js            check
 *   node tests/test-mc-key.js --update        re-baseline section 2 (when you REMOVE a hand-rolled lookup)
 *
 * FOUR SECTIONS. Section 1 checks the resolver behaves. Section 2 bans KNOWN-BAD SPELLINGS.
 * Section 3 bans every route into the mon table that is not engine/mc_key.js. Section 4, added
 * 2026-08-23, asserts the positive form of the same claim: every file that LOADS the table also
 * loads the door, so the runtime seal is installed in every process rather than in the ones that
 * happened to require the right file.
 *
 * THIS FILE IS NO LONGER THE LOAD-BEARING GUARANTEE, AND SAYING SO IS THE POINT.
 * Everything here is STATIC: it reads source text and bans shapes. That has now been beaten three
 * times by shapes nobody had listed -- `buildMon(s.toLowerCase())`, a bare `globalThis.` prefix, a
 * dot access `MC.mons.mudsdale`. A list cannot catch a form nobody thought of. The guarantee moved
 * on 2026-08-23 to a RUNTIME seal on the table itself (engine/mc_key.js `seal()`, asserted by
 * tests/test-mc-seal.js), which no spelling, prefix, alias, template string, concatenation,
 * destructure or Reflect.get can walk around, because it traps the property access rather than
 * matching the text. What is left here is defence in depth and a check on the one thing a Proxy
 * cannot see: whether the Proxy got installed at all. Read section 4 first.
 *
 * THE DOORWAY DEBT FILE IS GONE, 2026-08-23. `data/mc-key-door-baseline.json` recorded 96 accepted
 * doorways in 37 files. Ninety of those are now routed through engine/mc_key.js; the rest are named
 * in HOLDERS below WITH A WRITTEN REASON, in this file, where a reader of the gate can see them.
 * A numeric debt file listed how many violations were tolerated and never why -- so it could only
 * ever be re-baselined, never argued with. (Will, 2026-08-23: "i want no more problems not finding
 * certain names cause of spelling differences make a bulletproof solution and close it out.")
 *
 * WHY THIS EXISTS, AND WHY IT IS STRUCTURAL RATHER THAN BEHAVIOURAL
 * ----------------------------------------------------------------
 * `data/engine-data.js` publishes one table, `MC.mons`, and every engine in the project already read
 * that same one artifact. Single source of truth, working as designed. It broke anyway, four separate
 * times, because each caller wrote its own DOORWAY into it:
 *
 *   medicham2-browser.js        pasteKey()               works (linear rescan)
 *   merge_mega_into_engine.js   byNorm Map               works
 *   board.js                    MC.mons[norm(x)]         BROKEN -- 101 of 308 keys unreachable
 *   backtest_winrate.js         .filter(n=>MC.mons[n])   BROKEN -- silently dropped every forme team
 *   forced_switch_audit.js      MC.mons[norm(x)]         BROKEN -- null for every forme
 *
 * MC.mons keys formes WITH a hyphen (`rotom-wash`); the project's norm() strips punctuation. So the
 * obvious-looking lookup misses 8.17% of all observed metagame usage, and misses it SILENTLY -- a
 * missing key reads as "the engine has never seen this Pokemon", which is a real condition, so
 * nothing complains.
 *
 * A behavioural test would only prove today's callers work. The recurring failure is a NEW caller
 * writing the same three lines again, so the check has to be about the SHAPE of the code. Same trick
 * as tests/test-drop-guard.js, which asserts `B.featuresFor(` appears exactly once.
 *
 * SECTION 2 IS A RATCHET AND IS NOW EMPTY. Its baseline held five files on 2026-08-23 morning and
 * holds none by that evening: the legitimate ones (the browser twin, the builders, the spelling
 * auditor) moved into HOLDERS, where they carry a written reason instead of a count, and the rest
 * were routed. New violations still fail; the baseline still only shrinks.
 */
'use strict';
require('../engine/showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
/* A CHECK THAT CRASHES IS A CHECK THAT GETS SKIPPED.
 *
 * Section 1b below asks the real Showdown dex, so this file needs SHOWDOWN_PATH. Without it the
 * loader threw a twenty-line stack trace out of engine/champions_sim.js -- and it threw it AFTER
 * four "ok" lines had already printed, so the output read like a pass that got interrupted. This
 * ratchet then sat red for two days with nobody running it (docs/PRIORITIES.md #40), and the
 * stack trace is a large part of why.
 *
 * Exit 2, not 1: a runner can tell NOT RUN from FAILED, and neither one can be mistaken for a pass. */
if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — set SHOWDOWN_PATH to a built pokemon-showdown checkout, then re-run:');
  console.error('  SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/test-mc-key.js');
  process.exit(2);
}
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('MC KEY — one resolver for species -> MC.mons, and no hand-rolled second one\n');

/* ---- 1. THE RESOLVER ITSELF ------------------------------------------------------------------- */
require(D('data', 'engine-data.js'));
const { mcKey } = require(D('engine', 'mc_key.js'));

/* This file SWEEPS the dex asking about names that may legitimately be absent — that is its job. Each
 * such call declares it, so the strict default stays strict everywhere else. */
const PROBE = { mayMiss: 'test sweeps the dex for names that may be absent' };

const keys = Object.keys(globalThis.MC.mons);
const hyphenated = keys.filter(k => k.includes('-'));
ok(hyphenated.length > 0, `the table really does key formes with a hyphen (${hyphenated.length} of ${keys.length})`);

/* Every key must resolve FROM ITS OWN NAME. If this fails the index is not covering the table. */
const unreachable = keys.filter(k => mcKey(k, PROBE) !== k);
ok(unreachable.length === 0,
  `every one of the ${keys.length} table keys resolves to itself (${unreachable.slice(0, 3).join(', ') || 'none unreachable'})`);

/* ...and from the punctuated form a human or a sheet would write. */
const spaced = k => k.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const viaPretty = hyphenated.filter(k => mcKey(spaced(k), PROBE) !== k);
ok(viaPretty.length === 0,
  `every forme also resolves from its spaced form, e.g. "${spaced(hyphenated[0])}" -> ${mcKey(spaced(hyphenated[0]), PROBE)}`);

/* COLLISIONS WOULD BE WORSE THAN MISSES. Two keys flattening to the same string would make the
 * resolver silently return the wrong forme -- Slowking-Galar's body with Slowking's stats. */
const flat = new Map();
const collisions = [];
for (const k of keys) {
  const f = k.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (flat.has(f)) collisions.push(`${flat.get(f)} <-> ${k}`); else flat.set(f, k);
}
ok(collisions.length === 0, `no two keys flatten to the same string (${collisions.slice(0, 3).join('; ') || 'none'})`);

/* ---- 1c. THE CONTRACT ITSELF ------------------------------------------------------------------
 *
 * Until 2026-08-02 the assertion here was `mcKey('Definitely Not A Pokemon') === null` — the OLD
 * contract, in which "not in the data" and "you asked the wrong question" are the SAME value and no
 * caller can tell them apart. That is the shape of every expensive bug this project has had, so the
 * default is now to THROW and a caller that genuinely expects a miss must declare it, with a reason.
 * See engine/lookup.js.
 *
 * Both halves are asserted, because a contract with only one half tested is one that can be half
 * removed without anything failing. */
let threw = false;
try { mcKey('Definitely Not A Pokemon'); } catch (e) { threw = (e.name === 'LookupMiss'); }
ok(threw, 'an UNDECLARED miss throws, instead of returning a null the caller cannot distinguish');
ok(mcKey('Definitely Not A Pokemon', PROBE) === null,
  'a DECLARED miss returns null — the caller has written down that it expects one');
ok(mcKey('Rotom-Wash') === 'rotom-wash', 'a real species still resolves, with no ceremony at all');

/* ---- 1b. COSMETIC FORMES ---------------------------------------------------------------------
 *
 * A forme that is not in the table may fall back to its base ONLY when base stats AND types are
 * identical -- then the damage formula computes the same number and the substitution is exact.
 * Getting this wrong in the permissive direction is worse than the original bug: it hands the engine
 * a body that is not the one on the field, and unlike a miss it does not count itself.
 *
 * Both directions are asserted, and the discriminator is checked against the DEX rather than against
 * a list of names, so a new forme is judged by the same rule with no edit here. */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

const formes = dex.species.all().filter(s => s.exists && s.baseSpecies && s.baseSpecies !== s.name);
let sameBodyOK = 0, differentBodyLeaked = [];
for (const s of formes) {
  const b = dex.species.get(s.baseSpecies);
  if (!b || !b.exists || !mcKey(b.name, PROBE)) continue;
  const sameBody = s.types.join('|') === b.types.join('|')
    && JSON.stringify(s.baseStats) === JSON.stringify(b.baseStats);
  const resolved = mcKey(s.name, PROBE);
  const ownEntry = keys.some(k => k === flatOf(s.name));
  if (ownEntry) continue;                              // it has its own row; the fallback is not involved
  if (sameBody) { if (resolved === mcKey(b.name, PROBE)) sameBodyOK++; }
  else if (resolved && resolved === mcKey(b.name, PROBE)) differentBodyLeaked.push(s.name);
}
function flatOf(n) { return String(n).toLowerCase().replace(/[^a-z0-9]/g, ''); }

ok(sameBodyOK > 0, `formes with an identical body DO fall back to their base (${sameBodyOK} of them)`);
ok(differentBodyLeaked.length === 0,
  'no forme with different stats or types is ever substituted for its base '
  + `(leaked: ${differentBodyLeaked.slice(0, 5).join(', ') || 'none'})`);

/* The three worked examples from the day this was written, stated explicitly because they are the
 * ones that actually appeared on real sheets. */
ok(mcKey('Vivillon-Pokeball', PROBE) === mcKey('Vivillon', PROBE), 'Vivillon-Pokeball resolves to Vivillon — identical body');
/* GOURGEIST-SUPER CHANGED SIDES ON 2026-08-02, and the assertion changed with it rather than being
 * deleted. It used to assert the fallback REFUSES to substitute: same types as Gourgeist, different
 * stats, so handing the engine the base body would be worse than returning nothing. That was right,
 * and the consequence was that every damage feature read zero for it -- 25 occurrences in 60
 * self-play games, the single commonest miss.
 *
 * It now has its OWN row, so the correct answer is no longer null: it is gourgeist-super. What must
 * NOT change is the underlying rule, so that is what is asserted -- it resolves to ITSELF and never
 * to its base. */
ok(mcKey('Gourgeist-Super', PROBE) === 'gourgeist-super',
  'Gourgeist-Super resolves to its OWN row, added 2026-08-02 because its stats differ from Gourgeist');
ok(mcKey('Gourgeist-Super', PROBE) !== mcKey('Gourgeist', PROBE),
  '...and is still never substituted BY its base, which is the rule that mattered all along');
ok(mcKey('Slowking-Galar', PROBE) === 'slowking-galar', 'Slowking-Galar keeps its OWN entry, not Slowking');

/* THE HOLDERS — every file allowed to touch a mon table directly, WITH THE REASON, in the gate.
 *
 * This replaces `data/mc-key-door-baseline.json`, which held 96 anonymous counts across 37 files.
 * A count records how much was tolerated and never why, so it can only be re-baselined; a reason can
 * be argued with. Ninety of the ninety-six are now routed through engine/mc_key.js. These are what
 * is left, and each is here because routing it would be WRONG, not because it was hard:
 *
 * THE THREE-WAY SPLIT MATTERS. Only the first group touches the shared, sealed `globalThis.MC.mons`
 * at all. The second group parses `data/engine-data.js` as TEXT into a private object — there is no
 * shared table in those processes to ask, and pointing mcKey at one would read a different table
 * than the one being written. The regex cannot tell those apart because it matches on the word
 * `mons`; a reader can, which is the argument for putting the list here. */
const HOLDERS = {
  'engine/mc_key.js':      'IS the door.',
  'tests/test-mc-key.js':  'IS this gate.',
  'tests/test-mc-seal.js': 'ASSERTS the seal, by executing the raw accesses this file only reads as text.',

  'engine/medicham2-browser.js':
    'the BROWSER twin of the resolver. It cannot `require` on the live site, so it carries its own '
    + 'flattened index (monKey/monRow) built by the same rule; both of its raw indexes use a key that '
    + 'index has already resolved. tests/test-engine-consistency.js holds the two implementations together.',
  'engine/artifact_audit.js':
    'AUDITS key spelling. It asks on purpose whether a normalised key resolves and whether two keys '
    + 'normalise alike — the 2026-07-30 bug — and an auditor that cannot ask about a miss cannot audit '
    + 'one. It takes the table through mcKey.rawTable(<why>), so the exemption is recorded at run time too.',

  'engine/merge_mega_into_engine.js':
    'BUILDS the table. It JSON.parses data/engine-data.js as TEXT into a private object and adds, '
    + 'merges and DELETES rows in it. There is no shared table in that process, and it must be able to '
    + 'ask "is this key absent" before writing it — absent is the answer it wants, not a crash.',
  'build/build_engine_data.js':      'WRITES data/engine-data.js from the dex. Its `mons` is the output being constructed.',
  'build/build_mag_data.js':         'WRITES data/mag.js. Its `mons` is MAG\'s own table, not MC.mons.',
  'build/medicham-embed.js':         'BUILDS the browser embed. Its `out.mons` is the output being constructed.',
  'build/rebuild_sets_from_sheets.js':
    'BUILDS data/engine-data.js from open team sheets, parsing it as TEXT into a private object like '
    + 'merge_mega_into_engine.js. Routing it through mcKey would read the loaded table instead of the '
    + 'one being rewritten — a different object, silently.',
};
/* A HOLDER MUST STILL EXIST. A stale entry would silently widen the exemption to a file somebody
 * later creates with that name, which is exactly the shape of hazard this whole file is about. */
const ghosts = Object.keys(HOLDERS).filter(f => !fs.existsSync(D(f)));
ok(ghosts.length === 0, `every named holder is a real file (${ghosts.join(', ') || `${Object.keys(HOLDERS).length} of them`})`);
ok(Object.keys(HOLDERS).length <= 10,
  `the holder list is short and may only get shorter (${Object.keys(HOLDERS).length} of a ceiling of 10)`);

/* ---- 2. THE BAN ------------------------------------------------------------------------------- */

/* A hand-rolled lookup is: indexing MC.mons (or a `mons` alias) with anything other than a literal,
 * or building a private index over its keys. Deliberately over-broad and then baselined, because a
 * regex that tries to be clever about which ones are "fine" is how the next one gets through. */
const PATTERNS = [
  { re: /\bMC\.mons\s*\[\s*(?!['"`])/, why: 'indexes MC.mons with a computed key' },
  { re: /\bmons\s*\[\s*norm\s*\(/, why: 'indexes a mons table with norm()' },
  { re: /Object\.keys\s*\(\s*MC\.mons\s*\)/, why: 'builds its own index over MC.mons keys' },
];

/* The resolver and its own test are allowed to touch the table directly — that is their job. */
/* ONE EXEMPTION LIST FOR BOTH SECTIONS. It used to be two -- section 2 named mc_key.js and this
 * file, section 3 kept a JSON baseline -- and they disagreed the moment a third resolver-adjacent
 * file appeared: tests/test-mc-seal.js executes the raw accesses on purpose and section 2 called
 * it a NEW violation while section 3 called it a holder. Two lists of who is allowed is the same
 * defect as two implementations of the lookup. */
const OWN = new Set(Object.keys(HOLDERS));

const BASELINE_FILE = D('data', 'mc-key-baseline.json');
const baseline = fs.existsSync(BASELINE_FILE)
  ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
  : { allowed: {}, note: '' };

const found = {};
for (const dir of ['engine', 'build', 'tests']) {
  if (!fs.existsSync(D(dir))) continue;
  for (const f of fs.readdirSync(D(dir))) {
    if (!/\.js$/.test(f)) continue;
    const rel = `${dir}/${f}`;
    if (OWN.has(rel)) continue;
    const src = fs.readFileSync(D(dir, f), 'utf8');
    const hits = [];
    src.split('\n').forEach((line, i) => {
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;              // a comment describing the bug is not the bug
      for (const p of PATTERNS) if (p.re.test(line)) hits.push({ line: i + 1, why: p.why });
    });
    if (hits.length) found[rel] = hits.length;
  }
}

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({
    note: 'Files still doing their own species -> MC.mons lookup. New entries are a FAILURE; this list may only shrink. See engine/mc_key.js.',
    allowed: found,
  }, null, 2) + '\n');
  console.log(`  re-baselined: ${Object.keys(found).length} file(s) still hand-rolling the lookup`);
  process.exit(0);
}

const novel = Object.keys(found).filter(f => !(f in (baseline.allowed || {})));
const grew = Object.keys(found).filter(f => (baseline.allowed || {})[f] !== undefined && found[f] > baseline.allowed[f]);

ok(novel.length === 0,
  `no NEW file hand-rolls the species lookup (${novel.join(', ') || 'none'})`);
ok(grew.length === 0,
  `no baselined file grew more of them (${grew.map(f => `${f}: ${baseline.allowed[f]} -> ${found[f]}`).join(', ') || 'none'})`);

const fixed = Object.keys(baseline.allowed || {}).filter(f => !(f in found));
if (fixed.length) console.log(`  (${fixed.length} baselined file(s) now clean: ${fixed.join(', ')} — re-baseline with --update)`);

console.log(`\n  hand-rolled lookups remaining: ${Object.keys(found).length} `
  + `(${Object.entries(found).map(([f, n]) => `${f}:${n}`).join(', ') || 'none'})`);

/* ---- 3. THE DOORWAY (added 2026-08-23) --------------------------------------------------------
 *
 * WHY A SECOND SECTION RATHER THAN THREE MORE ENTRIES IN `PATTERNS` ABOVE.
 *
 * Section 2 is a list of WRONG SPELLINGS, and on 2026-08-23 the class escaped it for the third time:
 * `tests/test-engine-diff.js` wrote `MEDI.buildMon(s.toLowerCase(), {})`, which never mentions
 * MC.mons at all, and DROPPED 138 OF 345 SPECIES — the damage differential had never once compared
 * any of the 76 megas. Section 2 was green throughout. A list of wrong forms cannot catch a new
 * wrong form; that is not a bug in the regexes, it is the shape of the check.
 *
 * So this section inverts the question. It does not ask "does this line look like one of the known
 * mistakes". It asks "does this line TOUCH the mon table by any route other than mcKey" — the
 * doorway, stated positively, as engine/mc_key.js's header always claimed it was. Every touch is a
 * violation: an index with any key that is not a string literal, ANY enumeration, a for..in walk, an
 * alias of the table into a local, under ANY identifier (`MC.mons`, `globalThis.MC.mons`, `out.mons`,
 * `prior.mons`). Section 2's `Object.keys(MC.mons)` pattern did not survive a `globalThis.` prefix;
 * this one does.
 *
 * WHAT CHANGED ON 2026-08-23, AND WHY THE `.id` ALTERNATIVE LEFT THE buildMon PATTERN.
 *
 * `buildMon()` is the OTHER door into the same table. Until 2026-08-23 it matched an EXACT key, so a
 * caller that flattened the name first dropped every hyphenated forme, and the only thing static
 * analysis could see was the FLATTENING IDIOM in the argument: `.toLowerCase()`, `.replace(...)`,
 * `norm(`, `nrm(`, `flat(` — or a dex `.id`, because dex ids are flat and the table hyphenates.
 *
 * buildMon is now TOTAL: it resolves through the table's own flattened index, so 'Rotom-Wash',
 * 'rotom-wash', 'Rotom Wash' and 'rotomwash' all build the same body. `.id` is therefore no longer
 * evidence of anything — `M.buildMon(sp.id, {})` is CORRECT and was being reported as a violation in
 * four files. It is removed from the pattern and replaced by something strictly stronger: section 4
 * of tests/test-mc-seal.js pushes EVERY legal species through buildMon under a flattened name and
 * asserts none is dropped. That is the outcome the regex was proxying for, measured instead of
 * guessed. The hand-normalising alternatives STAY, because `norm(x)` before a lookup still says the
 * author believes spelling decides the answer, and other consumers are not total.
 *
 * WHAT THIS SECTION STILL CANNOT SEE, and nothing static can:
 *   - a key BUILT by concatenation without the hyphen (`base + 'mega'` -> `venusaurmega`). That was
 *     the ORIGINAL 2026-07-30 bug, 0 of 67 writes matching. THE SEAL NOW CATCHES THIS AT RUN TIME
 *     and tests/test-mc-seal.js executes exactly that line; engine/artifact_audit.js still covers
 *     the artifact-against-source half.
 *   - a dot access, `MC.mons.mudsdale`, which reads exactly like a field. One was live in
 *     tests/test-tag-wire.js and no pattern here has ever matched one. The seal catches it.
 *   - a flattened species reaching any consumer other than buildMon — `bd.setParty('p1', ids)`, a
 *     species key put in JSON and read back somewhere else.
 *   - anything in Python, or in a template string evaluated at run time.
 * The first two are now covered by the RUNTIME seal, which is the answer to all of them: a Proxy
 * cannot be walked around by a spelling nobody anticipated; a regex always can.
 *
 * IT IS NO LONGER A NUMERIC RATCHET. It is ZERO, plus a named list of HOLDERS with written reasons.
 * ------------------------------------------------------------------------------------------ */

const DOOR = [
  { re: /\bObject\.(keys|values|entries)\s*\(\s*[\w$.]*\bmons\s*\)/, why: 'enumerates a mons table outside mcKey.all' },
  { re: /\b[\w$]+\.mons\s*\[\s*(?!['"`])/, why: 'indexes a mons table with a computed key' },
  { re: /\bfor\s*\([^)]*\bin\s+[\w$.]*\bmons\b/, why: 'walks a mons table with for..in' },
  { re: /=\s*(?:globalThis\.)?[\w$]+\.mons\s*;/, why: 'aliases the mons table into a local' },
  /* `[^;]{0,80}?` rather than "up to the first comma": the first draft used `[^),]*`, which cannot
   * cross a nested call, and a DELIBERATE BREAK of the form `buildMon(String(sp).toLowerCase(), {})`
   * walked straight past it and the gate stayed green. Bounded and non-greedy so it stays inside one
   * statement; over-broad in exchange, which is the trade this whole file makes on purpose. */
  { re: /\bbuildMon\s*\(\s*[^;]{0,80}?(?:toLowerCase\s*\(|\.replace\s*\(|\bnorm\s*\(|\bnrm\s*\(|\bflat\s*\()/,
    why: 'hand-normalises a species name before handing it to buildMon' },
];

/* THE PATTERNS ARE THEMSELVES ASSERTED, against every real broken line this class has produced and
 * four lines that are CORRECT. Without this a future edit could quietly narrow the regexes and every
 * clause below would still print ok, which is the failure mode the whole file is about.
 *
 * ALL FIVE HISTORICAL INSTANCES ARE HERE AND MUST STAY. Two of them — the concatenated key and the
 * dot access — are NOT caught by any pattern in this file and never were; they are listed with
 * `false` and a note naming the RUNTIME check that does catch them, so that "the gate is green" can
 * never be read as "the gate saw it". */
const HISTORY = [
  ['1. board.js, 2026-08-01 — 101 of 308 keys unreachable', 'const row = MC.mons[norm(x)];', true],
  ['2. backtest_winrate.js, 2026-08-01 — dropped every forme team', 'const t = names.filter(n => MC.mons[n]);', true],
  ['3. forced_switch_audit.js, 2026-08-01 — null for every forme', 'return MC.mons[norm(species)] || null;', true],
  ['4. test-engine-diff.js, 2026-08-23 — 138 of 345 species dropped', 'const m = MEDI.buildMon(s.toLowerCase(), {});', true],
  ['4b. the same bug wrapped one call deeper — the line that broke the first draft of this regex',
   'const m = MEDI.buildMon(String(sp).toLowerCase(), {});', true],
  ['5. test-rollout-seed.js carriersOf, 2026-08-23 — the bare globalThis. prefix',
   '.map(s => s.id).filter(id => globalThis.MC.mons[id]);', true],
  /* NOT CAUGHT HERE, ON PURPOSE, AND NAMED SO NOBODY MISTAKES SILENCE FOR COVERAGE. */
  /* CAUGHT AS AN ACCESS, AND THAT IS NOT THE SAME AS CAUGHT. No static check can see that `k` holds
   * 'venusaurmega' where the table says 'venusaur-mega' -- it is a run-time value. The pattern below
   * would have flagged this LINE, and the 2026-07-30 bug was in a builder whose own output object it
   * never looked at, so nothing flagged anything for weeks. The SEAL is what makes the wrongness
   * itself visible, and tests/test-mc-seal.js executes this exact concatenation. */
  ['0. the 2026-07-30 concatenation, 0 of 67 writes — the ACCESS is caught here, the WRONG SPELLING only by the SEAL',
   "const k = base + 'mega'; return MC.mons[k];", true],
  ['0b. the dot access live in test-tag-wire.js — caught by the SEAL, not by this file',
   'if (MC.mons.mudsdale) run();', false],
  ['CORRECT: a literal index', "const r = MC.mons['rotom-wash'];", false],
  ['CORRECT: through the door', 'const r = mcKey.row(name, OPTS);', false],
  ['CORRECT: buildMon of a resolved key', 'const m = MEDI.buildMon(mcKey(name), {});', false],
  ['CORRECT since buildMon became total: a dex id needs no normalising', 'const m = M.buildMon(sp.id, {});', false],
];
const hits = l => DOOR.some(p => p.re.test(l));
const wrongVerdict = HISTORY.filter(([, line, want]) => hits(line) !== want).map(([n]) => n);
ok(wrongVerdict.length === 0,
  `the doorway patterns still catch every instance this file claims to catch, and clear every correct line (${wrongVerdict.join('; ') || `${HISTORY.length} lines, all as expected`})`);

const doors = {};
for (const dir of ['engine', 'build', 'tests']) {
  if (!fs.existsSync(D(dir))) continue;
  for (const f of fs.readdirSync(D(dir))) {
    if (!/\.js$/.test(f)) continue;
    const rel = `${dir}/${f}`;
    if (rel in HOLDERS) continue;
    const lines = [];
    fs.readFileSync(D(dir, f), 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;          // a comment describing the bug is not the bug
      if (hits(line)) lines.push(i + 1);
    });
    if (lines.length) doors[rel] = lines;
  }
}
const doorList = Object.entries(doors).map(([f, l]) => `${f}:${l.join(',')}`);
ok(doorList.length === 0,
  `NO file outside the named holders reaches a mon table except through mcKey (${doorList.join('  ') || 'zero, in engine/ build/ tests/'})`);

console.log(`\n  holders, each with a written reason above — the whole of the exemption:`);
for (const [f, why] of Object.entries(HOLDERS)) console.log(`    ${f}\n        ${why}`);

/* ---- 4. THE SEAL IS INSTALLED WHEREVER THE TABLE IS (added 2026-08-23) -------------------------
 *
 * THIS IS THE ONLY CLAUSE HERE THAT GUARDS THE RUNTIME GUARANTEE, so read it before the rest.
 *
 * engine/mc_key.js seals `MC.mons` behind a Proxy that THROWS on a key the table does not have. That
 * is what makes a new wrong spelling impossible rather than merely detected — but only in a process
 * where mc_key.js was loaded. A guarantee that depends on load order is a guarantee that is sometimes
 * absent, and "sometimes absent" is indistinguishable from "working" for exactly as long as it takes
 * to matter. A Proxy cannot check whether it was installed; only a static clause can.
 *
 * So: every file that requires `data/engine-data.js` must also require `engine/mc_key.js` in the SAME
 * file, or `engine/medicham2-browser.js`, which requires it. Direct, not transitive, deliberately —
 * a transitive rule needs a module graph, the graph needs to guess at `D(...)` and `REL.require(...)`
 * call shapes, and a rule that can be wrong about its own scope is worse than a blunt one that cannot.
 * The cost is one require line per file, which is nothing.
 *
 * Zero from the day it was written: eight files were fixed in the same pass. */
const LOADS_TABLE = /require\s*\(\s*[^)]*engine-data\.js/;
const LOADS_TABLE_REL = /REL\.require\(\s*['"]data\/engine-data/;
const LOADS_DOOR = [/require\s*\(\s*[^)]*mc_key\.js/, /REL\.require\(\s*['"]engine\/mc_key/,
                    /require\s*\(\s*[^)]*medicham2-browser\.js/, /REL\.require\(\s*['"]engine\/medicham2/];
const unsealed = [];
for (const dir of ['engine', 'build', 'tests']) {
  if (!fs.existsSync(D(dir))) continue;
  for (const f of fs.readdirSync(D(dir))) {
    if (!/\.js$/.test(f)) continue;
    const src = fs.readFileSync(D(dir, f), 'utf8');
    if (!LOADS_TABLE.test(src) && !LOADS_TABLE_REL.test(src)) continue;
    if (LOADS_DOOR.some(re => re.test(src))) continue;
    unsealed.push(`${dir}/${f}`);
  }
}
ok(unsealed.length === 0,
  `every file that LOADS the mon table also loads the door, so the seal is installed (${unsealed.join(', ') || 'no file loads it unsealed'})`);

/* AND THE SEAL REALLY IS ON, IN THIS PROCESS, RIGHT NOW. The clause above is about source text; this
 * one is about the object. Both are needed: the first cannot see whether seal() actually ran, and the
 * second cannot see the other 60 files. */
ok(typeof mcKey.sealed === 'function' && mcKey.sealed(),
  'and MC.mons in THIS process is actually sealed — see tests/test-mc-seal.js for what that buys');

console.log(`\nMC KEY TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
