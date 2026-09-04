/* docs_scan.js — DERIVE the documentation surface instead of typing it.
 *
 * WHY THIS EXISTS
 * ---------------
 * `tests/test-docs-current.js` guarded a hand-typed list of five filenames. `docs/` holds 85
 * markdown files, so eighty of them were unwatched BY CONSTRUCTION — and the five that were watched
 * passed a version-header check while carrying wrong numbers underneath it. Both halves of that are
 * the same defect: the check knew the NAME of a document and nothing about its CONTENT.
 *
 * Evidence gathered 2026-08-05, all of it live at the time:
 *   - the deck stated a 63% exploitability figure the white paper retracts on the same day
 *   - "899 of 899" interaction-matrix agreement stood in four documents while
 *     data/interaction-matrix.json read live 1012 / agree 1011
 *   - the damage tolerance was "31 scenarios" in five places against an artifact of 36
 *
 * This module holds the derivations. It answers questions ABOUT documents; it never carries a list
 * of documents, and the one list it does carry (the baseline) is a RATCHET that may only shrink.
 * The test file is the policy; this file is the measurement.
 *
 *   node engine/docs_scan.js            print the census
 *   node engine/docs_scan.js --json     the same, machine-readable
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

/* ---- the document surface, enumerated ------------------------------------------------------- */

/* CHANGELOG.md is exempt from every content rule and deliberately so: it is the historical record,
 * and a retracted figure must remain in the entry that published it AND in the entry that withdrew
 * it or the retraction becomes unreadable. Everything else is fair game, INCLUDING docs/archive/ —
 * see archiveState() for why exempting the archive was a laundering route. */
const EXEMPT_FILES = new Set(['CHANGELOG.md']);

function listMd(dir) {
  const abs = D(dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(f => f.endsWith('.md'))
    .filter(f => !EXEMPT_FILES.has(f))
    .filter(f => fs.statSync(path.join(abs, f)).isFile())
    .map(f => (dir === '.' ? f : dir + '/' + f))
    .sort();
}

/** Every markdown file that asserts current fact: docs/ and the repository root. */
function liveDocs() { return [...listMd('docs'), ...listMd('.')]; }

/* THE LIVING SET IS DERIVED FROM THE DOCUMENTS, NOT TYPED INTO THE TEST. A document that carries a
 * version header in its masthead is claiming to be current as of that version; that claim is what
 * makes its figures checkable, and it is a property of the file rather than of a list somebody
 * maintained. The old test named five files. This finds eighteen, and finds the nineteenth on the
 * day it is written. */
/* THE SPRINT LOG IS A LOG, NOT A LIVING DOCUMENT — WILL, 2026-08-15, RULING QUOTED IN FULL BECAUSE
 * THE SCOPE OF AN EXEMPTION IS THE WHOLE OF ITS SAFETY:
 *
 *   "medicham sprint was just something we did so we could work faster on medicham without slowing
 *    ourselves down with the living docs every pass. the notes are so we still dont lose track of
 *    what we are doing. the docs are on pause until we finish medicham, which is all we should be
 *    doing until its done"
 *
 * `.githooks/pre-commit` ALREADY implements exactly this bargain and says so in its own refusal
 * message — a commit touching engine/ or tests/ must add a sprint row, and *"Delete
 * docs/MEDICHAM-SPRINT-NOTES.md to end the sprint and re-arm the full rule."* The figure clauses in
 * this file were the one place that had not been told, so the log was being held to the standard the
 * sprint exists to defer, and a gate went red for recording the work faithfully.
 *
 * THE EXEMPTION IS THE MARKER, WHICH IS WHY IT CANNOT ROT. It is not a name on a list somebody has to
 * remember to remove: the sprint ENDS by deleting this file, and the exemption ends with it in the
 * same keystroke. There is no state to update and nothing to go stale — the failure this repository
 * keeps paying for.
 *
 * IT IS ONE FILE AND IT BUYS NOTHING ELSE. Every other living document is scanned exactly as before,
 * no baseline is lowered, and the version-header, retraction and citation rules are untouched for
 * every file including this one's neighbours. A second entry here would be a policy; one entry tied
 * to a marker that deletes itself is a deferral. */
const SPRINT_LOG = 'docs/MEDICHAM-SPRINT-NOTES.md';
function sprintActive() { return fs.existsSync(D(SPRINT_LOG)); }
function livingDocs() {
  return liveDocs()
    .filter(d => !(sprintActive() && d.replace(/\\/g, '/') === SPRINT_LOG))
    .filter(d => versionHeader(readDoc(d)));
}
/** Everything under docs/archive/. Scanned, never exempt by location. */
function archiveDocs() { return listMd('docs/archive'); }
function readDoc(rel) { return fs.readFileSync(D(rel), 'utf8'); }

/* ---- rule 1: a version header must track the CHANGELOG --------------------------------------- */

/* A VERSION HEADER IS A POSITION, NOT A REGEX MATCH ANYWHERE IN THE FILE. The old verOf() ran
 * /(?:Version|v)\s*(\d+\.\d+\.\d+)/i over the whole document, so a document merely MENTIONING
 * "retracted in 2.7.0" would have been credited with a header. The header is a masthead: it sits in
 * the opening block, under the title, before the first section. */
const HEADER_LINES = 25;
function versionHeader(text) {
  const lines = text.split('\n').slice(0, HEADER_LINES);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\bversion\b\s*:?\s*\*{0,2}\s*(\d+\.\d+(?:\.\d+)?)/i);
    if (m) return { version: m[1], line: i + 1, text: lines[i].trim() };
  }
  return null;
}

/** The top version of the CHANGELOG — the one number every living document is measured against. */
function changelogTop() {
  const ch = fs.readFileSync(D('CHANGELOG.md'), 'utf8');
  return (ch.match(/##\s*\[(\d+\.\d+\.\d+)\]/) || [])[1] || null;
}

/* ---- rule 3, part a: figures ------------------------------------------------------------------
 *
 * A FIGURE is a number a reader would take as a measurement. Version strings, years, section
 * numbers and file paths are numerals that are not figures, and including them buries the signal. */
/* THE SIGN IS PART OF THE FIGURE, and dropping it made real matches look like mismatches.
 *
 * These documents write negatives with a TYPOGRAPHIC MINUS (U+2212 '−'), not an ASCII hyphen —
 * every weight, every paired difference, every confidence interval. The pattern did not treat it as
 * a sign at all, so `−1.6281` parsed as +1.6281, while `data/policy-weights.json` holds
 * -1.6280854921610366 which rounds to "-1.6281". The document was quoting its artifact correctly to
 * four places and was reported as citing a figure the artifact does not contain.
 *
 * That is the worst failure mode available to this check: it accuses a correct document, and the
 * obvious response is to "fix" the document until it agrees with nothing. Any of −, – or - now
 * carries into the value. */
const MINUS = '[-\\u2212\\u2013\\u2010\\u2011]';
/* THE COMMA IS IN THE LOOKBEHIND, AND IT HAS TO BE. Without it, `1,436/1,453` yields `1,436` and then
 * a PHANTOM `453`: the `/` rejects the second number at its own first digit, the scan resumes one
 * character later, and `453` — preceded only by a comma — matches. The document then gets accused of
 * citing a figure it never wrote. A bare group of digits directly after a comma is always a fragment
 * of a thousands-separated number, which the first alternative already handles whole, so excluding it
 * cannot lose a real figure. Same family as the typographic-minus fix: the regex was right about what
 * a figure looks like and wrong about where one can START. */
/* AN IDENTIFIER IS NOT A MEASUREMENT. "WIRE 117", "ADR-002", "LESSON 2", "R4" and "§7" are NAMES that
 * happen to be spelled with digits, and this scan accused docs/MODELS.md of citing a mechanics-census
 * figure of 117 when the sentence said "WIRE 117's scope pass". A check that fires on a wire number is
 * a check somebody edits the prose to silence, which is worse than the drift it was guarding.
 *
 * Matched on the WORD BEFORE, so it cannot swallow a real figure: "wires 82-116 landed" is still prose
 * about identifiers, and "the fit used 117 games" still counts, because `games` is not in this list. */
const ID_WORD = '(?:wire|wires|adr|lesson|lessons|axis|layer|round|phase|step|trap|item|§|no\\.|#)';
const FIGURE_RE = new RegExp(
  `(?<![\\w./,])(?<!\\b${ID_WORD}\\s)(${MINUS}?)(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)\\s*(%?)`, 'gi');

function figuresIn(line) {
  /* Strip the things that contain digits but assert nothing: inline code, links, paths, dates. */
  const clean = line
    .replace(/`[^`]*`/g, ' ')                       // `data/x.json`, `engine/y.js:123`
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')           // markdown links
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')         // ISO dates
    .replace(/\bv?\d+\.\d+\.\d+\b/g, ' ')           // version strings
    .replace(/§\s*\d+[a-z]?/gi, ' ')                // section references
    /* A ROADMAP ROW REFERENCE IS AN IDENTIFIER, AND `#` WAS ALREADY DECLARED ONE — in ID_WORD, right
     * beside `§`. It never fired: that lookbehind is `(?<!\bID_WORD\s)` and demands a space, while
     * this repo writes `#224` with none, so the guard covered a spelling nobody uses. `§` was given a
     * strip in this chain for exactly that reason and `#` was left behind.
     *
     * It cost a real verdict: a sprint note reading "Closed #218 and #224 on measured evidence" beside
     * two named artifacts was failed for citing a figure of 224 that neither artifact contains. The
     * sentence was correct, its provenance was correct, and naming the rows it closed is what made it
     * fail — the gate charging for the citation again, one rule over from the lines fix above. */
    .replace(/(?<![\w])#\s*\d+/g, ' ')              // roadmap row references: #224
    .replace(/\b[Rr]\d\b/g, ' ')                    // rung names R1..R4
    /* A CITED SOURCE LINE IS THE OPPOSITE OF AN UNTRACEABLE FIGURE, AND THIS SCAN COUNTED IT AS ONE.
     * "the block is split across lines 10914-10915" is a citation into pokemon-showdown — the very
     * act this project calls READ:<file>:<line> and prefers over typing a number from memory. The
     * census reported both halves as unsourced measurements, so a sentence became cheaper to write
     * WITHOUT its provenance than with it. That is the gate paying for the wrong behaviour.
     *
     * ID_WORD cannot carry this: it is a lookbehind on one word, and a RANGE puts the second number
     * behind a hyphen instead. Stripping the whole "lines N-M" span is what actually covers it. */
    .replace(/\blines?\s*\d[\d,]*(?:\s*[-–—]\s*\d[\d,]*)?/gi, ' ');
  const out = [];
  let m;
  FIGURE_RE.lastIndex = 0;
  while ((m = FIGURE_RE.exec(clean)) !== null) {
    const sign = m[1] ? -1 : 1;                     // any of -, −, – captured above
    const raw = m[2];
    const v = sign * Number(raw.replace(/,/g, ''));
    if (!isFinite(v)) continue;
    /* Year test on the MAGNITUDE: "-2026" is not a year, and a negative figure never is. */
    if (sign > 0 && v >= 1900 && v <= 2100 && Number.isInteger(v) && !raw.includes(',')) continue;
    const dp = (raw.split('.')[1] || '').length;
    out.push({ raw: (m[1] || '') + raw + m[3], value: v, pct: m[3] === '%', dp });
  }
  return out;
}

/* ---- figuresIn IS A LINE SCANNER, AND THREE CALLERS WERE HANDING IT A WHOLE FILE — 2026-09-04 ----
 *
 * `figuresIn` strips inline code with /`[^`]*`/g. `[^`]*` MATCHES NEWLINES, so on multi-line input a
 * backtick span runs from one line into another and deletes every character between them. Every other
 * strip in that chain is line-local (an ISO date, a version string, a `lines N-M` citation); this one
 * silently was not.
 *
 * IT COST THE WHOLE CHANGELOG EXEMPTION. `changelogHas` scanned CHANGELOG.md as ONE STRING. Measured
 * on the tree of 2026-09-04: line-by-line the changelog yields 2,431 distinct figures; as one string
 * it yields 889. 63% of the recorded history was invisible to the exemption that exists to honour it.
 *
 * AND IT MOVED WITHOUT ANYONE TOUCHING A DOCUMENT, WHICH IS THE PART THAT MATTERS. A markdown line
 * carrying an ODD number of backticks inverts the code/prose polarity of everything after it. The
 * CHANGELOG is newest-first, so a new entry sits at the TOP: one stray backtick in tonight's entry —
 * ironically, an entry ABOUT a corrupt backtick fragment — flipped the polarity of all 27,000 lines
 * below it. The census went 35 -> 129 across 12 documents with the whitepaper at 10 -> 41, on a pass
 * that added no figure at all. A gate that goes red because of where a backtick landed is a gate that
 * gets waived, and this repository has already paid four days for one of those.
 *
 * A FENCED BLOCK IS NOT PROSE, and it was only ever excluded by ACCIDENT — ``` is three backticks, so
 * the old pairing swallowed fenced content as a side effect of the same bug. Fixing the lexing without
 * saying this out loud reintroduced a real false positive on the first run: docs/PRIOR-ART.md's
 * illustrative overlap table (`3,843 bo3`) inside a ``` block was reported as an untraceable claim.
 * Numbers in a code block are quoted output, not assertions, so the exclusion is now DELIBERATE.
 *
 * WHY THIS IS A CORRECTION AND NOT A LOOSENING. It does not add an exemption, does not widen the
 * changelog rule beyond what changelogHas() already documents, and on the doc side it is STRICTER —
 * per-line scanning reads prose the old span-eater had been deleting. Measured both ways on the same
 * tree: the census returns to exactly the baseline 35, per document, and the cited-artifact clause
 * finds the same 72 mismatches with no key added and none removed. */
function fenceOpen(line) { return /^\s*(?:```|~~~)/.test(line); }

/** Figures in a MULTI-LINE span: fenced blocks are skipped, and inline code is stripped one line at a
 *  time so a backtick can never reach across a line break. Single lines go straight to figuresIn. */
function figuresInText(text) {
  const out = [];
  let fenced = false;
  for (const L of String(text).split('\n')) {
    if (fenceOpen(L)) { fenced = !fenced; continue; }
    if (fenced) continue;
    for (const f of figuresIn(L)) out.push(f);
  }
  return out;
}

/* ---- THE RED DEMONSTRATION FOR THE LEXER, one case per thing it must and must not read ----------
 *
 * Same discipline as RETRACTION_CASES below: a rule that decides what counts as a stated figure
 * carries a case it MUST read and a case it MUST NOT, and both run before it is used on a document.
 * Cases `odd-backtick-*` and `fenced-*` are the two regressions above, pinned in both directions —
 * the first FAILS against a whole-file scan, the second FAILS against a naive per-line one, so no
 * single-sided fix can satisfy the set. */
const LEXING_CASES = [
  { id: 'a-plain-figure-is-read',
    why: 'The base case. Without it the others could be satisfied by reading nothing at all.',
    text: 'The run scored 4,321 games.', find: true },

  { id: 'inline-code-is-not-a-claim',
    why: 'A path or an identifier in backticks asserts nothing, which is why the strip exists.',
    text: 'The store is `data/games-4321.jsonl` on disk.', find: false },

  { id: 'odd-backtick-line-does-not-eat-the-next-line',
    why: 'THE REGRESSION THAT COST THE GATE. One unpaired backtick used to pair with the next '
       + 'backtick on a LATER line and delete everything between, including the figure. On a '
       + 'newest-first CHANGELOG that is 27,000 lines of recorded history, from one stray character.',
    text: 'A corrupt ` fragment was found.\nThe run scored 4,321 games beside `data/x.json`.', find: true },

  { id: 'a-fenced-block-is-quoted-output-not-a-claim',
    why: 'The other direction. ``` is three backticks, so the old span-eater excluded fenced content '
       + 'by accident; a naive per-line fix reads it as prose and accuses an illustrative table. '
       + 'Measured live on docs/PRIOR-ART.md before this case existed.',
    text: '```\ntheir store   4,321 games\n```', find: false },

  { id: 'prose-after-a-fence-is-still-read',
    why: 'A fence must close. Without this the fence rule could silence the rest of a document.',
    text: '```\nignore 9,999\n```\n\nThe run scored 4,321 games.', find: true },
];

/** Runs every case through the real function. `holds` false means the lexer changed meaning. */
function lexingProof() {
  return LEXING_CASES.map(c => {
    const found = figuresInText(c.text).some(f => f.value === 4321);
    return { id: c.id, why: c.why, expected: c.find, found, holds: found === c.find };
  });
}

/* Numbers that appear for reasons unrelated to any artifact. A coin's log-loss and a 50% baseline
 * are properties of arithmetic, not of a measurement, and flagging them trains people to ignore
 * this check. Same reasoning as engine/provenance.js's named exceptions: few, and each with a why. */
const UNIVERSAL = new Set([0, 1, 2, 0.5, 50, 100, 0.25, 25, 0.693, 0.6931, 0.69315, 95, 1.96, 0.05]);
const isUniversal = f => UNIVERSAL.has(f.value);

/* ---- rule 3, part b: what an artifact contains ------------------------------------------------ */

const artifactCache = new Map();
/** Every number reachable inside a JSON artifact, including numbers written inside its strings. */
function artifactNumbers(rel) {
  if (artifactCache.has(rel)) return artifactCache.get(rel);
  let set = null;
  const p = D(rel);
  if (fs.existsSync(p)) {
    set = new Set();
    let j;
    /* AN UNPARSABLE ARTIFACT MUST NOT READ AS AN EMPTY ONE.
     * This returned null, the walk below then produced an EMPTY number set, and an empty set makes
     * every figure citing that artifact look like a mismatch — the check would report a document as
     * wrong because the FILE was unreadable, and the document would get "corrected" to match
     * nothing. That is worse than not checking: it manufactures false findings in the one instrument
     * whose whole job is to catch false claims. Announced, and the caller is told to skip rather
     * than to score against an empty set. */
    try { j = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (parseErr) {
      console.error('  docs_scan: ' + rel + ' is present but unparsable (' + (parseErr.message || parseErr).split('\n')[0]
        + ') — NOT scoring any figure against it, because an empty set would make every citation look wrong');
      artifactCache.set(rel, null);      // cached so the warning is said once, not once per citation
      return null;                       // null = "cannot judge", distinct from an empty set = "contains nothing"
    }
    const walk = (o) => {
      if (o === null || o === undefined) return;
      if (typeof o === 'number') { set.add(o); return; }
      if (typeof o === 'string') {
        for (const m of o.matchAll(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/g)) set.add(Number(m[1].replace(/,/g, '')));
        return;
      }
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (typeof o === 'object') { for (const k of Object.keys(o)) { walk(k); walk(o[k]); } }
    };
    walk(j);
  }
  artifactCache.set(rel, set);
  return set;
}

/* A LINEAR SCAN OF THE ARTIFACT PER FIGURE DOES NOT FINISH. data/ holds ~7.6 MB of JSON and the
 * documents hold thousands of figures; the first version of this function was O(figures x numbers)
 * and ran past two minutes. The index is built once per artifact per decimal place, and a lookup is
 * three string probes. Rounding is done by toFixed on both sides so the doc's own precision decides
 * the tolerance: "97%" matches 96.97, "97.0%" does not. */
const indexCache = new WeakMap();
function indexFor(nums) {
  let byDp = indexCache.get(nums);
  if (!byDp) { byDp = new Map(); indexCache.set(nums, byDp); }
  return (dp) => {
    let s = byDp.get(dp);
    if (!s) {
      s = new Set();
      for (const a of nums) { s.add(a.toFixed(dp)); s.add((a * 100).toFixed(dp)); s.add((a / 100).toFixed(dp)); }
      byDp.set(dp, s);
    }
    return s;
  };
}

/** Does the artifact contain this figure, allowing for how a writer would round and scale it? */
function artifactHas(nums, f) {
  if (!nums || !nums.size) return false;
  return indexFor(nums)(f.dp).has(f.value.toFixed(f.dp));
}

/* ---- paragraphs and citations ---------------------------------------------------------------- */

/** Blank-line-separated blocks, with the 1-based line number each starts on. A table row is its own
 *  claim and markdown tables have no blank lines inside them, so a row is also a paragraph. */
/* A FENCED BLOCK IS ONE BLOCK, blank lines and all. Splitting inside a fence hands figuresInText a
 * fragment with no opening ``` in it, so the fragment reads as prose and the fence rule silently
 * stops applying part-way down a code sample. Only one such blank line exists in the living set
 * today and it happened to be harmless — which is exactly the kind of luck this file stops relying
 * on. Every fence in docs/, docs/archive/ and CHANGELOG.md is balanced, checked before this landed. */
function paragraphs(text) {
  const lines = text.split('\n');
  const out = [];
  let cur = [], start = 1, fenced = false;
  const flush = () => { if (cur.length) out.push({ start, lines: cur.slice() }); cur = []; };
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (fenceOpen(L)) {
      if (!fenced) { flush(); start = i + 1; }          // the fence opens its own block
      cur.push(L);
      fenced = !fenced;
      if (!fenced) { flush(); start = i + 2; }          // and closes it
      continue;
    }
    if (fenced) { if (!cur.length) start = i + 1; cur.push(L); continue; }
    if (L.trim() === '') { flush(); start = i + 2; continue; }
    if (L.trim().startsWith('#')) { flush(); start = i + 2; continue; }   // a heading ends a block
    if (L.trim().startsWith('|')) { flush(); out.push({ start: i + 1, lines: [L] }); start = i + 2; continue; }
    if (!cur.length) start = i + 1;
    cur.push(L);
  }
  flush();
  return out;
}

/** The data artifacts a block names. A citation is a promise that the number came from that file. */
function citationsIn(block) {
  const s = block.join('\n');
  const out = new Set();
  for (const m of s.matchAll(/\b(data\/[A-Za-z0-9_.\-]+\.json)\b/g)) out.add(m[1]);
  return [...out];
}

/* ---- rule 3, part c: retractions, DERIVED from the documents themselves -----------------------
 *
 * The registry in tests/test-docs-current.js is hand-typed: somebody has to notice a figure died and
 * add it. That is fine for a figure withdrawn by a DECISION and it is what failed for the deck's
 * 63%, which the white paper retracts IN WRITING on the same day. If one document says a number is
 * retracted, that IS the registry — no second list needed.
 *
 * Three extraction forms, in decreasing precision. Only the first two are trusted enough to fail a
 * build; the third is reported, because "0.6931 — a result now withdrawn" retracts the result, not
 * the coin's log-loss sitting next to it. */
/* A RETRACTED FIGURE HAS TO BE DISTINCTIVE OR THE REGISTRY POISONS EVERYTHING. The first run of this
 * derivation registered a bare `17` (from "17 features against the 58 shipped") and then flagged
 * ninety lines across the repository — "17 minutes earlier", "17 species reach weather_sun", a table
 * cell reading 17. A registry that fires on every occurrence of a small integer is worse than no
 * registry, because it is the thing people switch off. A figure qualifies only if it carries a unit
 * (a percent) or is large enough that a collision is not chance. */
/* AND A PERCENT WRITTEN TO TWO SIGNIFICANT FIGURES IS THAT SMALL INTEGER WEARING A UNIT — 2026-08-23.
 *
 * The paragraph above argued exactly this and then exempted every percent from it. `9.7%` is two
 * digits; so is `10%`, `25%`, `90%`. This repository's prose is DENSE with them — a burn chance, a
 * usage share, a bucket label — so a registry entry at that precision accuses on coincidence. Two
 * live consequences, both measured: a literal `9.7%` in the Bright Powder accuracy table at
 * docs/ENGINE.md would be read forever as a claim about a divergence rate, and one such entry
 * produced 56 violations of which 52 were a bare `10%`.
 *
 * The floor is PRECISION, not magnitude, because that is what makes a collision unlikely: at two
 * significant figures there are ~90 values a writer could reach and the round ones dominate; at
 * three there are ~900 and the collision stops being chance. It is the same floor as `value >= 1000`
 * for a bare count, stated in the only units a percent has.
 *
 * IT IS OPT-IN, WHICH IS WHY IT IS SAFE TO SET. Trailing zeros COUNT, so an author retracting a
 * two-figure percent writes `44.0%` rather than `44%` and the entry registers — the precision is
 * asserted rather than assumed. A retraction that cannot be bothered to state its own precision is
 * exactly the one that should not be able to accuse a table cell. */
const PCT_SIGFIG_FLOOR = 3;
/** Digits a reader would have to reproduce by coincidence: separators, sign and unit removed. */
function sigFigs(raw) {
  const d = String(raw).replace(/[^0-9.]/g, '').replace('.', '').replace(/^0+/, '');
  return d.length || 1;
}
const isDistinctive = f => (f.pct ? sigFigs(f.raw) >= PCT_SIGFIG_FLOOR : f.value >= 1000);

function retractionRegistry(docs, { read = readDoc } = {}) {
  const reg = new Map();   // value -> {value, pct, sources:[], strength}
  const add = (f, src, strength) => {
    if (isUniversal(f) || !isDistinctive(f)) return;
    const key = f.value + (f.pct ? '%' : '');
    if (!reg.has(key)) reg.set(key, { value: f.value, pct: f.pct, dp: f.dp, sources: [], strength });
    const e = reg.get(key);
    if (!e.sources.includes(src)) e.sources.push(src);
    if (strength === 'strong') e.strength = 'strong';
  };
  for (const rel of docs) {
    const lines = read(rel).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      /* 1. STRIKETHROUGH. ~~63.2% [56.6, 69.3], mirror 47.5%~~ — an author-placed marker, and the
       *    least ambiguous signal in markdown. Everything inside it is withdrawn. */
      if (/retract|withdraw|superseded|\bvoid\b/i.test(L)) {
        for (const m of L.matchAll(/~~([^~]+)~~/g)) for (const f of figuresIn(m[1])) add(f, `${rel}:${i + 1}`, 'strong');
      }
      /* 2. NAMED PRIOR. "The prior 63.2% ... is retracted", "The figure of 7,971 ... was retracted".
       *    The determiner is doing the work: it marks the figure as the subject of the retraction. */
      const named = /\b(?:the\s+)?(?:prior|published|old|former|previous|figure of|headline)\s+(?:~~)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(%?)/gi;
      if (/retract|withdraw|superseded|no longer (?:holds|stands|true)|\bvoid\b/i.test(L)) {
        for (const m of L.matchAll(named)) {
          const f = figuresIn(m[1] + m[2])[0];
          if (f) add(f, `${rel}:${i + 1}`, 'strong');
        }
        /* 3. ADJACENT. "63.2% retracted on its own merits" — the figure immediately before the verb. */
        for (const m of L.matchAll(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(%?)[^.\n]{0,12}?\b(?:is|was|are|were|now|remains?)?\s*(?:retracted|withdrawn|void)\b/gi)) {
          const f = figuresIn(m[1] + m[2])[0];
          if (f) add(f, `${rel}:${i + 1}`, 'weak');
        }
      }
    }
  }
  return reg;
}

/* A qualifier near a figure means the document is REPORTING the retraction, not restating the
 * figure as fact. Punishing the documents that do the right thing is how a check gets switched off
 * — the same lesson tests/test-docs-current.js records for the quoted-claim case. */
const QUALIFIED = /retract|withdraw|superseded|void|not (?:a )?(?:true|valid|current)|no longer|stale|historic|was measured|obsolete|corrected|prior|former|previously|invalid|does not hold|~~/i;

/* ---- WHICH WRITTEN FIGURE IS THE RETRACTED ONE, RESTATED ---------------------------------------
 *
 * THIS COMPARED ROUNDED VALUES AND THE ROUNDING HAD NO BOUND — ROADMAP #370, measured 2026-08-23.
 * The test was `Number(e.value.toFixed(f.dp)) === f.value`, so `(9.7).toFixed(0)` is `"10"` and a
 * retracted `9.7%` accused every bare `10%` in the repository: 56 violations from one entry, 52 of
 * them a `10%` about a burn chance, a usage share or a bucket label. At baseline, 12 of 17 surviving
 * violations were collisions of this shape rather than exact matches.
 *
 * THE THREE CASES THAT DECIDE THE RULE, and they are the whole specification:
 *   a retracted 63.2% MUST match a document writing 63%      — genuine shortening of the same claim
 *   a retracted  9.7% MUST NOT match a bare 10%
 *   a retracted 47.5% MUST NOT match a Sucker Punch 48%
 *
 * PROXIMITY CANNOT SEPARATE THEM — 9.7 and 10 are closer than 47.5 and 48 — AND NEITHER CAN
 * "CORRECT ROUNDING", WHICH IS THE WHOLE DIFFICULTY: 63.2 -> 63 and 47.5 -> 48 are BOTH correctly
 * rounded, so any rule phrased as "the document rounded it" must accept case 3 and is dead on
 * arrival.
 *
 * A DIGIT-PREFIX RULE ALONE IS ALSO WRONG, AND IT WAS TRIED FIRST — measured, on this corpus, before
 * being discarded. "The written figure is the retracted one TRUNCATED" satisfies all three spec
 * cases and then swaps one collision family for another: `trunc(47.5, 0)` is `47`, so four fresh
 * accusations appeared (`docs/ENGINE.md`'s `7 — 47%` ordering cell, `docs/PUBLICATION.md`'s
 * *"Tailwind wins"? 47%*) in place of the two `48%` ones it removed. 17 violations became 19. A rule
 * that satisfies the specification and still fires on a table cell has not understood the defect.
 *
 * THE RULE IS THAT SHORTENING MUST NOT BE A JUDGEMENT CALL. A restatement is accepted only where
 * TRUNCATING and ROUNDING give the SAME digits — where every reader shortening that figure would
 * have written what the document wrote:
 *
 *     63.2 -> 63   truncate 63, round 63   AGREE      the same claim, written shorter
 *     47.5 -> 48   truncate 47, round 48   DISAGREE   a decision was taken; refuse both 47 and 48
 *      9.7 -> 10   truncate  9, round 10   DISAGREE   refuse
 *
 * Equivalently: the retracted value must sit in the LOWER HALF of the bucket the document's digits
 * name, `w <= v < w + 0.5 * 10^-dp`. It needs no threshold and no tuning — the boundary is where the
 * two conventions part, which is a property of the decimal system rather than of this corpus.
 *
 * THE COST, STATED RATHER THAN HIDDEN. A document that shortens a retracted figure UPWARD — 63.7% as
 * `64%` — is no longer caught, and neither is a retracted 47.5% restated as `47%`. Case 3 forbids
 * catching the first; the second is indistinguishable from the ordering cell above, and an
 * accusation that cannot tell them apart is the one people learn to ignore (#148). */

/** The retracted value written to `dp` decimals by dropping digits, never by re-rounding. */
function truncateTo(value, dp) {
  const p = Math.pow(10, dp);
  /* toFixed(6) first: 4.35 * 100 is 434.99999999999994 in binary, and a bare floor would eat a digit
   * that IS present in the decimal the author wrote. */
  const scaled = Math.floor(Number((Math.abs(value) * p).toFixed(6)));
  return (value < 0 ? -1 : 1) * scaled / p;
}

/** Is the figure `f`, as written, the retracted figure `e` restated? */
function restatesFigure(e, f) {
  if (f.pct !== e.pct) return false;
  if (f.value === e.value) return true;              // written exactly as it was retracted
  if (!(f.dp < e.dp)) return false;                  // only a SHORTER form can be the same claim
  if (truncateTo(e.value, f.dp) !== f.value) return false;         // its own leading digits, and
  return Number(e.value.toFixed(f.dp)) === f.value;                // shortening was not a choice
}

/** Where a retracted figure is restated as fact. */
function retractionViolations(docs, reg, { strongOnly = true, read = readDoc } = {}) {
  const hits = [];
  for (const rel of docs) {
    const lines = read(rel).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const figs = figuresIn(lines[i]);
      if (!figs.length) continue;
      for (const [, e] of reg) {
        if (strongOnly && e.strength !== 'strong') continue;
        if (e.sources.some(s => s.startsWith(rel + ':'))) continue;   // the document doing the retracting
        const match = figs.find(f => restatesFigure(e, f));
        if (!match) continue;
        const ctx = lines.slice(Math.max(0, i - 4), i + 4).join(' ');
        if (QUALIFIED.test(ctx)) continue;
        hits.push({ doc: rel, line: i + 1, figure: match.raw, retracted: e.value + (e.pct ? '%' : ''),
                    by: e.sources.slice(0, 2), text: lines[i].trim().slice(0, 100) });
      }
    }
  }
  return hits;
}

/* ---- THE RED DEMONSTRATION, ONE PAIR PER MATCHING RULE ------------------------------------------
 *
 * Same discipline as `EQUIV_PROOF` in engine/game_differential.js: a rule that decides two things
 * are the same claim carries a case it MUST catch and a case it MUST NOT, and both run before the
 * rule is used on a real document. A matching rule with no case it refuses is a SILENCER.
 *
 * These are SYNTHETIC DOCUMENTS, not asserted values, and they go through the real registry and the
 * real violation scan — so the proof covers the extraction, the distinctiveness floor and the match
 * together. Nothing is written to disk; `read` is injected. The three cases marked SPEC are the
 * specification of ROADMAP #370 and the rule is not done if any of them moves. */
const RETRACTION_CASES = [
  { id: 'spec-1-shortened-restatement',
    why: 'SPEC. A document writing the retracted figure to fewer decimals IS restating it. This is '
       + 'the case the whole clause exists for — the deck\'s 63% against the white paper\'s 63.2%.',
    retracts: 'The prior 63.2% exploitability figure is retracted.',
    states:   'A bot built only to counter MAG beats it 63% of the time.',
    caught: true },

  { id: 'spec-2-carry-across-the-leading-digit',
    why: 'SPEC. `(9.7).toFixed(0)` is `"10"`, and that one equality produced 56 violations of which '
       + '52 were an unrelated bare 10%. Two guards refuse it: 9.7% is two significant figures and '
       + 'does not register at all, and 10 is not a digit prefix of 9.7.',
    retracts: 'The prior 9.7% divergence figure is retracted.',
    states:   'Flare Blitz carries a 10% burn chance on contact.',
    caught: false },

  { id: 'spec-3-carry-up-is-not-a-restatement',
    why: 'SPEC. 47.5% registers (three significant figures), so this isolates the MATCH rule from '
       + 'the distinctiveness floor. 48 is correctly rounded from 47.5 and is still a different '
       + 'number — which is why "the document rounded it" cannot be the rule.',
    retracts: 'The prior 47.5% mirror figure is retracted.',
    states:   'Sucker Punch fails 48% of the time against a faster board.',
    caught: false },

  { id: 'two-significant-figures-do-not-register-at-all',
    why: 'THE CASE THAT PROVES THE PRECISION FLOOR, and it is the only one that does — the match '
       + 'rule refuses 9.7 -> 10 on its own, so without this case removing the floor changes '
       + 'nothing and the floor would be a guard nobody had shown red. Here the document states the '
       + 'figure EXACTLY, in a Bright Powder accuracy cell that is live in docs/ENGINE.md and is an '
       + 'ACCURACY rather than any rate. No match rule can separate those; only refusing to register '
       + 'a two-figure percent can.',
    retracts: 'The prior 9.7% divergence figure is retracted.',
    states:   '| into a Bright Powder holder (100 x 0.9 = 90) | 10.3% | 9.7% |',
    caught: false },

  { id: 'a-tie-is-a-judgement-call-in-both-directions',
    why: 'The regression a digit-prefix rule caused, pinned so it cannot come back: truncating 47.5 '
       + 'gives 47, which accused an ORDERING table cell and a "Tailwind wins? 47%" line. Where '
       + 'truncating and rounding disagree, BOTH shortenings are refused, not just the upward one.',
    retracts: 'The prior 47.5% mirror figure is retracted.',
    states:   'Under this ordering the second column reads 47% across fifteen scenarios.',
    caught: false },

  { id: 'floor-is-opt-in-and-the-match-still-refuses',
    why: 'An author who states the precision — `9.70%` — DOES register, and the bare 10% is still '
       + 'refused. Without this case the floor could be hiding a broken match rule.',
    retracts: 'The prior 9.70% divergence figure is retracted.',
    states:   'Flare Blitz carries a 10% burn chance on contact.',
    caught: false },

  { id: 'exact-restatement-still-caught',
    why: 'The fix must not buy quiet by weakening the exact case, which is the majority of real '
       + 'hits. A document writing the retracted figure verbatim is always a violation.',
    retracts: 'The prior 63.2% exploitability figure is retracted.',
    states:   'The win-optimised vector beat MAG 63.2% of the time.',
    caught: true },
];

const PROOF_RETRACTOR = 'docs/_proof-retractor.md';
const PROOF_STATEMENT = 'docs/_proof-statement.md';

/** Runs every case through the real derivation. `holds` false means the rule changed meaning. */
function retractionProof() {
  return RETRACTION_CASES.map(c => {
    const read = rel => '# proof\n\n' + (rel === PROOF_RETRACTOR ? c.retracts : c.states) + '\n';
    const reg = retractionRegistry([PROOF_RETRACTOR, PROOF_STATEMENT], { read });
    const hits = retractionViolations([PROOF_STATEMENT], reg, { read });
    return { id: c.id, why: c.why, retracts: c.retracts, states: c.states,
             registered: [...reg.keys()], expected: c.caught,
             caught: hits.length > 0, holds: (hits.length > 0) === c.caught };
  });
}

/* ---- rule 3, part d: a cited artifact must actually contain the figure ------------------------ */

/** Blocks that name a data artifact and state a figure that artifact does not hold. */
function citationMismatches(docs) {
  const hits = [];
  for (const rel of docs) {
    for (const b of paragraphs(readDoc(rel))) {
      const cites = citationsIn(b.lines);
      if (!cites.length) continue;
      const sets = cites.map(c => ({ c, nums: artifactNumbers(c) })).filter(x => x.nums);
      if (!sets.length) continue;
      const text = b.lines.join('\n');
      /* A block that is itself ABOUT staleness quotes the old number on purpose. */
      if (QUALIFIED.test(text)) continue;
      for (const f of figuresInText(text)) {
        if (isUniversal(f)) continue;
        if (f.value < 10 && Number.isInteger(f.value)) continue;   // counts this small are structural
        if (sets.some(s => artifactHas(s.nums, f))) continue;
        hits.push({ doc: rel, line: b.start, figure: f.raw, cites: sets.map(s => s.c),
                    text: b.lines[0].trim().slice(0, 100) });
      }
    }
  }
  return hits;
}

/* ---- the census: figures with no artifact behind them anywhere -------------------------------- */

/* A GATE MAY NOT SATISFY ITSELF, AND THIS ONE COULD — 2026-08-15.
 *
 * `data/docs-currency-baseline.json` is a .json file under data/, so it was in this union like any
 * measurement. It records the census's OWN findings as strings — `"docs/ABRA-whitepaper.md|0.073|
 * data/slowking-eval.json"` — and `artifactNumbers` walks strings, so writing a figure down as an
 * OFFENDER made that figure TRACEABLE on the next run. The check was exempting numbers on the
 * strength of its own complaint about them.
 *
 * Found by building it worse: recording the untraceable figure SET into the baseline (so a future
 * regression could be named rather than re-derived) dropped the whitepaper's count from 12 to 5 in
 * one run. Seven figures became "traceable" because the file that had just called them untraceable
 * now contained them. The loop was already live before that through `citation_mismatches`, which has
 * held figure values since the day it was written.
 *
 * The rule this restores: an artifact is a MEASUREMENT of the world. This file is bookkeeping ABOUT
 * the documents, and a document cannot be its own source. */
/* AND THE SAME LOOP ARRIVES THROUGH THE REGISTER. `data/open-work.json` is `engine/open_work.js`'s
 * copy of ROADMAP.md's prose, so ANY figure quoted in a register row becomes traceable. Caught in the
 * act within the hour: a row filed about this very defect quoted the offending value while describing
 * it, `open_work.js` copied the row into the artifact, the census read the complaint as evidence for
 * the figure, and the clause went GREEN with the real regression still underneath. Writing down "this
 * number has no source" must never become that number's source.
 *
 * The rule, stated so the next file is easy to judge: an artifact is a MEASUREMENT of the world. A
 * file whose content is a copy of a DOCUMENT — the register, this gate's own findings — is not one,
 * and a document cannot be its own source. */
const NOT_AN_ARTIFACT = new Set(['docs-currency-baseline.json', 'open-work.json']);
let allNumsCache = null;
function allArtifactNumbers() {
  if (allNumsCache) return allNumsCache;
  allNumsCache = new Set();
  const dir = D('data');
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    if (NOT_AN_ARTIFACT.has(f)) continue;
    const s = artifactNumbers('data/' + f);
    if (s) for (const v of s) allNumsCache.add(v);
  }
  return allNumsCache;
}

/* THE CHANGELOG IS A TRACE, AND WITHOUT THIS THE CENSUS WAS A TREADMILL.
 *
 * A living document's CHANGE RECORD legitimately holds SUPERSEDED figures — that is what a change
 * record is, and CLAUDE.md requires it ("a prior conclusion is never silently rewritten; what changed
 * and why is stated"). But an artifact only ever holds its CURRENT numbers. So the moment an artifact
 * is republished, every figure it used to hold becomes "in no artifact" and the per-document count
 * grows — on every release, for every document that honours the rule, no matter how carefully the
 * pass was done. `docs/ABRA-technical-docs.md` gained one for the 8,676 in its own 3.43.0 record
 * three minutes after 3.45.0 republished the matrix.
 *
 * A gate that fires no matter what anyone does is a gate that gets reported as a known failure --
 * engine/provenance.js was fixed for exactly this shape earlier in the same session.
 *
 * So: a figure recorded in CHANGELOG.md is TRACEABLE. It is not a weaker trace than an artifact, it
 * is a different one -- the artifact says what is true now, the changelog says what was true and
 * when. It cannot launder an invented number either, because writing a figure into the changelog is
 * itself a recorded claim under a version and a date. */
let changelogNumsCache = null;
function changelogHas(f) {
  if (!changelogNumsCache) {
    changelogNumsCache = new Set();
    try {
      for (const g of figuresInText(fs.readFileSync(D('CHANGELOG.md'), 'utf8')))
        changelogNumsCache.add(Number(g.value).toFixed(6));
    } catch (e) {
      /* IT MUST SAY SO. Failing to read the changelog does not corrupt anything — the exemption just
       * stops applying, which is fail-closed and correct. But EVERY document's count then jumps at
       * once, and that reads as a documentation regression rather than as a missing file. The one
       * thing this must never do is look like the docs got worse. */
      console.error('  docs_scan: CANNOT READ CHANGELOG.md (' + e.message + ') — the "recorded '
        + 'history is traceable" exemption is OFF for this run, so every untraceable count below is '
        + 'inflated by its document\'s superseded figures. This is a missing file, not a regression.');
    }
  }
  return changelogNumsCache.has(Number(f.value).toFixed(6));
}

/** Figures in a document that appear in NO artifact under data/ and cite none. Report only: a
 *  figure can be legitimately derived (a ratio, a difference), so this is a pressure gauge, not a
 *  verdict. It is ratcheted so it can only fall. */
/* THE CENSUS NAMES ITS FIGURES, and it did not before. It reported "docs/X.md: 33 untraceable, was
 * 31" and stopped, so the only way to find the two was to bisect the document by hand — and a gate
 * that fires without naming its cause is a gate somebody switches off. engine/provenance.js learned
 * exactly this about its own ratchet and records it in place; this is the same lesson, second file.
 *
 * `where` carries {file, line, value, text} per offending figure. The count is unchanged. */
/* `read` IS INJECTABLE for the same reason retractionRegistry's is: a claim about what this census
 * DOES catch has to be demonstrable on a document whose content is known, without writing a file into
 * docs/ to find out. Nothing in the repository passes it; the default is readDoc. */
function untraceableCensus(docs, { read = readDoc } = {}) {
  const all = allArtifactNumbers();
  const per = {}, where = {};
  let total = 0;
  for (const rel of docs) {
    let n = 0;
    for (const b of paragraphs(read(rel))) {
      const cited = citationsIn(b.lines).length > 0;
      if (cited) continue;                         // handled by citationMismatches, harder rule
      for (const f of figuresInText(b.lines.join('\n'))) {
        if (isUniversal(f)) continue;
        if (f.value < 10 && Number.isInteger(f.value)) continue;
        if (artifactHas(all, f)) continue;
        if (changelogHas(f)) continue;             // recorded history — see changelogHas()
        n++;
        (where[rel] = where[rel] || []).push({
          line: b.start || 0, value: f.raw !== undefined ? f.raw : f.value,
          text: b.lines[0].trim().slice(0, 90),
        });
      }
    }
    if (n) { per[rel] = n; total += n; }
  }
  return { total, per, where };
}

/* ---- the archive is not a laundry -------------------------------------------------------------
 *
 * tests/test-docs-current.js:89 skipped docs/archive/ outright, so `git mv docs/X.md docs/archive/`
 * silently removed a document from every content rule. Files are being archived this week, which
 * makes that a live route rather than a theoretical one.
 *
 * The rule: an archived file is exempt from the content scans ONLY IF it declares itself superseded
 * and NAMES the file that replaced it, and that file exists. Anything else in the archive is scanned
 * exactly as if it were still live. */
const SUPERSEDED_RE = /^\s*>?\s*\*{0,2}SUPERSEDED\*{0,2}\b[^\n]*?\bby\b\s*[`\[]?([A-Za-z0-9_./\-]+\.(?:md|json|js|py))/im;

/** The header, as a pure function of text, so both branches can be proven without moving a file
 *  into docs/archive/ to see what happens. Returns the named replacement or null. */
function supersededHeader(text) {
  const m = String(text).split('\n').slice(0, 15).join('\n').match(SUPERSEDED_RE);
  return m ? m[1] : null;
}

function archiveState() {
  const out = [];
  for (const rel of archiveDocs()) {
    const replacement = supersededHeader(readDoc(rel));
    out.push({
      doc: rel,
      superseded: !!replacement,
      replacement,
      replacementExists: replacement ? fs.existsSync(D(replacement)) : false,
    });
  }
  return out;
}

module.exports = {
  D, liveDocs, livingDocs, archiveDocs, readDoc, versionHeader, changelogTop,
  figuresIn, figuresInText, fenceOpen, lexingProof, LEXING_CASES,
  isUniversal, artifactNumbers, artifactHas, paragraphs, citationsIn,
  retractionRegistry, retractionViolations, citationMismatches, untraceableCensus,
  isDistinctive, sigFigs, truncateTo, restatesFigure, retractionProof, RETRACTION_CASES,
  archiveState, supersededHeader, QUALIFIED,
};

/* ---- CLI -------------------------------------------------------------------------------------- */
if (require.main === module) {
  const docs = liveDocs();
  const living = livingDocs();
  const versioned = living.map(d => ({ doc: d, v: versionHeader(readDoc(d)) }));
  const reg = retractionRegistry([...docs, ...archiveDocs()]);
  const census = untraceableCensus(living);
  const report = {
    changelog_top: changelogTop(),
    docs_scanned: docs.length,
    versioned: versioned.map(x => ({ doc: x.doc, version: x.v.version })),
    unversioned: docs.filter(d => !versionHeader(readDoc(d))),
    archive: archiveState(),
    lexing_proof: lexingProof(),
    retraction_proof: retractionProof(),
    retraction_registry: [...reg.values()].map(e => ({ value: e.value + (e.pct ? '%' : ''), strength: e.strength, sources: e.sources })),
    retraction_violations: retractionViolations(living, reg),
    citation_mismatches: citationMismatches(living),
    untraceable: census,
  };
  if (process.argv.includes('--json')) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }
  console.log(`CHANGELOG top: ${report.changelog_top}`);
  console.log(`docs scanned: ${report.docs_scanned}  versioned: ${report.versioned.length}  unversioned: ${report.unversioned.length}`);
  const lex = report.lexing_proof.filter(p => !p.holds);
  console.log(`
figure lexer proof: ${report.lexing_proof.length - lex.length}/${report.lexing_proof.length} hold`
    + (lex.length ? '  *** ' + lex.map(p => p.id).join(', ') + ' ***' : ''));
  for (const p of report.lexing_proof) {
    console.log(`  ${p.holds ? 'ok  ' : 'FAIL'} ${p.id.padEnd(46)} ${p.expected ? 'must read' : 'must skip'}`);
  }
  const broken = report.retraction_proof.filter(p => !p.holds);
  console.log(`\nretraction match proof: ${report.retraction_proof.length - broken.length}/${report.retraction_proof.length} hold`
    + (broken.length ? '  *** ' + broken.map(p => p.id).join(', ') + ' ***' : ''));
  for (const p of report.retraction_proof) {
    console.log(`  ${p.holds ? 'ok  ' : 'FAIL'} ${p.id.padEnd(42)} ${p.expected ? 'must catch' : 'must refuse'}`
      + `  registered=[${p.registered.join(',')}]`);
  }
  console.log(`\nretraction registry (derived from the documents): ${report.retraction_registry.length}`);
  for (const e of report.retraction_registry) console.log(`  ${e.strength.padEnd(6)} ${String(e.value).padEnd(10)} ${e.sources.join(' ')}`);
  console.log(`\nretracted figures restated as fact: ${report.retraction_violations.length}`);
  for (const h of report.retraction_violations) console.log(`  ${h.doc}:${h.line}  ${h.figure}  (retracted by ${h.by.join(', ')})\n      ${h.text}`);
  console.log(`\ncited-artifact mismatches: ${report.citation_mismatches.length}`);
  for (const h of report.citation_mismatches) console.log(`  ${h.doc}:${h.line}  ${h.figure}  not in ${h.cites.join(', ')}\n      ${h.text}`);
  console.log(`\nuntraceable figures: ${census.total} across ${Object.keys(census.per).length} documents`);
  const top = Object.entries(census.per).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [d, n] of top) console.log(`  ${String(n).padStart(4)}  ${d}`);
}
