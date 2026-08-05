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
function livingDocs() { return liveDocs().filter(d => versionHeader(readDoc(d))); }
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
    .replace(/\b[Rr]\d\b/g, ' ');                   // rung names R1..R4
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
function paragraphs(text) {
  const lines = text.split('\n');
  const out = [];
  let cur = [], start = 1;
  const flush = () => { if (cur.length) out.push({ start, lines: cur.slice() }); cur = []; };
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
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
const isDistinctive = f => f.pct || f.value >= 1000;

function retractionRegistry(docs) {
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
    const lines = readDoc(rel).split('\n');
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

/** Where a retracted figure is restated as fact. */
function retractionViolations(docs, reg, { strongOnly = true } = {}) {
  const hits = [];
  for (const rel of docs) {
    const lines = readDoc(rel).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const figs = figuresIn(lines[i]);
      if (!figs.length) continue;
      for (const [, e] of reg) {
        if (strongOnly && e.strength !== 'strong') continue;
        if (e.sources.some(s => s.startsWith(rel + ':'))) continue;   // the document doing the retracting
        const match = figs.find(f => f.pct === e.pct && (f.value === e.value || Number(e.value.toFixed(f.dp)) === f.value));
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
      for (const f of figuresIn(text)) {
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

let allNumsCache = null;
function allArtifactNumbers() {
  if (allNumsCache) return allNumsCache;
  allNumsCache = new Set();
  const dir = D('data');
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
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
      for (const g of figuresIn(fs.readFileSync(D('CHANGELOG.md'), 'utf8')))
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
function untraceableCensus(docs) {
  const all = allArtifactNumbers();
  const per = {}, where = {};
  let total = 0;
  for (const rel of docs) {
    let n = 0;
    for (const b of paragraphs(readDoc(rel))) {
      const cited = citationsIn(b.lines).length > 0;
      if (cited) continue;                         // handled by citationMismatches, harder rule
      for (const f of figuresIn(b.lines.join('\n'))) {
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
  figuresIn, isUniversal, artifactNumbers, artifactHas, paragraphs, citationsIn,
  retractionRegistry, retractionViolations, citationMismatches, untraceableCensus,
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
    retraction_registry: [...reg.values()].map(e => ({ value: e.value + (e.pct ? '%' : ''), strength: e.strength, sources: e.sources })),
    retraction_violations: retractionViolations(living, reg),
    citation_mismatches: citationMismatches(living),
    untraceable: census,
  };
  if (process.argv.includes('--json')) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }
  console.log(`CHANGELOG top: ${report.changelog_top}`);
  console.log(`docs scanned: ${report.docs_scanned}  versioned: ${report.versioned.length}  unversioned: ${report.unversioned.length}`);
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
