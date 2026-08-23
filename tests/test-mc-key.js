/* test-mc-key.js — there is ONE way to turn a species name into an MC.mons key, and this bans the others.
 *
 *   node tests/test-mc-key.js            check
 *   node tests/test-mc-key.js --update        re-baseline section 2 (when you REMOVE a hand-rolled lookup)
 *   node tests/test-mc-key.js --update-door   re-baseline section 3 (when you REMOVE a doorway)
 *
 * TWO SECTIONS, TWO BASELINES. Section 2 bans KNOWN-BAD SPELLINGS. Section 3, added 2026-08-23, bans
 * every route into the mon table that is not engine/mc_key.js, because a list of wrong forms cannot
 * catch a new wrong form and on 2026-08-23 one got through for the third time. Read section 3's own
 * comment for exactly what it can and cannot see -- it is not total, and it says where.
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
 * IT IS A RATCHET. Two hand-rolled lookups are legitimate today and are baselined rather than
 * rewritten: medicham2-browser.js is a BROWSER file that cannot `require`, and
 * merge_mega_into_engine.js builds the table itself, so it cannot ask an index of a table that does
 * not exist yet. New violations fail; the baseline only shrinks.
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
const OWN = new Set(['engine/mc_key.js', 'tests/test-mc-key.js']);

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
 * THE ONE PART THAT IS STILL A SHAPE LIST, SAID PLAINLY RATHER THAN GLOSSED.
 *
 * `buildMon()` is the OTHER door into the same table — it resolves a species internally — and a
 * caller that flattens the name before handing it over is the 2026-08-23 bug. Static analysis cannot
 * see that a string is a species name, so the only thing detectable is the FLATTENING IDIOM in the
 * argument: `.toLowerCase()`, `.replace(...)`, `norm(`, `nrm(`, `flat(`, or a dex `.id` (dex ids are
 * flat; MC.mons keys formes with a hyphen). That is a list, and it is an honest one only because the
 * set of ways to lowercase-and-strip a string in JavaScript is small and closed, where the set of
 * FUNCTIONS that might consume a species key is open. It is the better axis, not a safe one.
 *
 * WHAT THIS SECTION STILL CANNOT SEE, and nothing static can:
 *   - a key BUILT by concatenation without the hyphen (`base + 'mega'` -> `venusaurmega`). That was
 *     the ORIGINAL 2026-07-30 bug, 0 of 67 writes matching. engine/artifact_audit.js covers that one
 *     by comparing a generated artifact against its source, and it is why that file exists.
 *   - a flattened species reaching any consumer other than buildMon — `bd.setParty('p1', ids)`,
 *     `bd.switchIn(...)`, a species key put in JSON and read back somewhere else.
 *   - anything in Python, or in a template string evaluated at run time.
 * The durable fix for the second bullet is NOT another regex: it is that `buildMon` and the board
 * setters should THROW `LookupMiss` on an undeclared miss, the way `mcKey` already does, so a
 * flattened forme crashes on the first one instead of silently dropping 138 of 345. That is an
 * ENGINE change to engine/medicham2-browser.js and is proposed rather than made here.
 *
 * IT IS A RATCHET WITH ITS OWN BASELINE, established 2026-08-23 at the level then measured:
 * 37 files, 96 sites. That number is PRE-EXISTING DEBT, not a licence — the clause fails on any new
 * file and on any baselined file that grows. Establishing a new ratchet at today's level is not the
 * same act as moving an old one to make a red gate pass; the section-2 baseline was NOT touched.
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
  { re: /\bbuildMon\s*\(\s*[^;]{0,80}?(?:toLowerCase\s*\(|\.replace\s*\(|\bnorm\s*\(|\bnrm\s*\(|\bflat\s*\(|\.id\b)/,
    why: 'hands buildMon a FLATTENED species name — the 2026-08-23 bug' },
];

/* THE PATTERNS ARE THEMSELVES ASSERTED, against the five real broken lines this class has produced
 * and three lines that are CORRECT. Without this a future edit could quietly narrow the regexes and
 * every clause below would still print ok, which is the failure mode the whole file is about. */
const HISTORY = [
  ['board.js, 2026-08-01', 'const row = MC.mons[norm(x)];', true],
  ['backtest_winrate.js, 2026-08-01', 'const t = names.filter(n => MC.mons[n]);', true],
  ['forced_switch_audit.js, 2026-08-01', 'return MC.mons[norm(species)] || null;', true],
  ['test-engine-diff.js, 2026-08-23 — 138 of 345 species dropped', 'const m = MEDI.buildMon(s.toLowerCase(), {});', true],
  ['the same bug wrapped one call deeper — the line that broke the first draft of this regex',
   'const m = MEDI.buildMon(String(sp).toLowerCase(), {});', true],
  ['test-rollout-seed.js carriersOf, 2026-08-23', '.map(s => s.id).filter(id => globalThis.MC.mons[id]);', true],
  ['CORRECT: a literal index', "const r = MC.mons['rotom-wash'];", false],
  ['CORRECT: through the door', 'const r = mcKey.row(name, OPTS);', false],
  ['CORRECT: buildMon of a resolved key', 'const m = MEDI.buildMon(mcKey(name), {});', false],
];
const hits = l => DOOR.some(p => p.re.test(l));
const wrongVerdict = HISTORY.filter(([, line, want]) => hits(line) !== want).map(([n]) => n);
ok(wrongVerdict.length === 0,
  `the doorway patterns still catch every historical instance and clear every correct line (${wrongVerdict.join('; ') || `${HISTORY.length} lines, all as expected`})`);

const DOOR_BASELINE_FILE = D('data', 'mc-key-door-baseline.json');
const doorBase = fs.existsSync(DOOR_BASELINE_FILE)
  ? JSON.parse(fs.readFileSync(DOOR_BASELINE_FILE, 'utf8'))
  : { allowed: {}, note: '' };

const doors = {};
for (const dir of ['engine', 'build', 'tests']) {
  if (!fs.existsSync(D(dir))) continue;
  for (const f of fs.readdirSync(D(dir))) {
    if (!/\.js$/.test(f)) continue;
    const rel = `${dir}/${f}`;
    if (OWN.has(rel)) continue;
    let n = 0;
    fs.readFileSync(D(dir, f), 'utf8').split('\n').forEach(line => {
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;          // a comment describing the bug is not the bug
      if (hits(line)) n++;
    });
    if (n) doors[rel] = n;
  }
}

if (process.argv.includes('--update-door')) {
  fs.writeFileSync(DOOR_BASELINE_FILE, JSON.stringify({
    note: 'Files reaching the mon table by a route other than engine/mc_key.js. Established 2026-08-23 '
        + 'at the level then measured; new entries are a FAILURE and this list may only shrink. '
        + 'See section 3 of tests/test-mc-key.js for what it can and cannot see.',
    allowed: doors,
  }, null, 2) + '\n');
  console.log(`  re-baselined the DOORWAY: ${Object.keys(doors).length} file(s), `
    + `${Object.values(doors).reduce((a, b) => a + b, 0)} site(s)`);
  process.exit(0);
}

const doorNovel = Object.keys(doors).filter(f => !(f in (doorBase.allowed || {})));
const doorGrew = Object.keys(doors).filter(f => (doorBase.allowed || {})[f] !== undefined && doors[f] > doorBase.allowed[f]);

ok(doorNovel.length === 0,
  `no NEW file reaches the mon table except through mcKey (${doorNovel.join(', ') || 'none'})`);
ok(doorGrew.length === 0,
  `no baselined file grew more doorways (${doorGrew.map(f => `${f}: ${doorBase.allowed[f]} -> ${doors[f]}`).join(', ') || 'none'})`);

const doorFixed = Object.keys(doorBase.allowed || {}).filter(f => !(f in doors));
if (doorFixed.length) {
  console.log(`  (${doorFixed.length} file(s) now reach the table only through mcKey: `
    + `${doorFixed.join(', ')} — re-baseline with --update-door)`);
}
console.log(`\n  doorways outside mcKey: ${Object.values(doors).reduce((a, b) => a + b, 0)} site(s) `
  + `in ${Object.keys(doors).length} file(s) — pre-existing debt, ratcheted downward only`);

console.log(`\nMC KEY TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
