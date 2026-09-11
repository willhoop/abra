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

/* ---- ONE READ PATH, AND IT DROPS THE CARRIAGE RETURN — 2026-09-06 -----------------------------
 *
 * A LINE ENDING BLANKED THIS FILE'S BACKLOG COUNTER ON THE DAY IT WAS BUILT. `.gitattributes`
 * already carries a block headed "A LINE ENDING BLANKED THE GATE TWICE IN THREE DAYS"; this is the
 * third occurrence and the first one inside the documentation gate.
 *
 * `core.autocrlf` is `true` on this machine. The committed blob of `docs/RUNNING-NOTES.md` is LF and
 * the checked-out working copy is CRLF, so every line handed to a parser here ends in a CR. In
 * JavaScript a CR is a LINE TERMINATOR, so `.` does not match it and a `$` anchor cannot reach the
 * end of the line past it. `notesEntries()` anchors its heading pattern with `$` and therefore
 * matched NOTHING: measured 2026-09-06, `node engine/docs_scan.js --owed` reported
 * "0 of 100 ... nothing owed" against a page holding FOUR rows, and `tests/test-docs-current.js`
 * passed 30 of 30 while doing it.
 *
 * That is the whole deferral bargain reading green while blind. The backlog is what makes "we will
 * do the documents at the next major" a deferral rather than an abandonment; a counter stuck at zero
 * can never reach `OWED_CAP`, so the cap could never have fired.
 *
 * THE FIX IS AT THE READ, NOT IN THE PATTERN, and the reason is the canonical-path rule: patching
 * one regex leaves the class alive in every other one. 27 of the 107 documents this module scans are
 * CRLF in the working tree. Measured before and after over the whole surface, the only derivation
 * that moves is the one that was broken — living documents 25 -> 25, citation mismatches 78 -> 78,
 * notes entries 0 -> 4. A document's identity is its CONTENT; only the ENGINE RELEASE identifies a
 * file by its bytes, which is why `.gitattributes` pins `eol` there and nothing is pinned here.  */
function stripCR(text) { return String(text).replace(/\r\n/g, '\n'); }
function slurp(abs) { return stripCR(fs.readFileSync(abs, 'utf8')); }
function readDoc(rel) { return slurp(D(rel)); }

/* THE RED DEMONSTRATION FOR THE READ, IN BOTH DIRECTIONS AND OVER THE LIVE SURFACE.
 *
 * `cases` pins the PARSER against a CRLF page — one heading that must be read after the strip and
 * must NOT be read before it, so no one-sided edit satisfies the pair. `leaked` pins the WIRING:
 * every document whose bytes on disk contain a CR must come back from `readDoc` without one. On a
 * checkout that happens to be all-LF that second half proves nothing, so it reports the number of
 * CRLF documents it actually found rather than a bare green line. */
function crlfProof() {
  const raw = '## [9.9.9] — 2026-01-01 — a synthetic row\r\n- **Basis.** unchanged\r\n';
  const before = notesEntries({ read: () => raw }) || [];
  const after = notesEntries({ read: () => stripCR(raw) }) || [];
  const cases = [
    { id: 'crlf-page-is-invisible-without-the-strip', why: 'The defect. A CR is a JavaScript line '
      + 'terminator, so the heading pattern cannot reach its own end anchor past one.',
      expected: 0, got: before.length, holds: before.length === 0 },
    { id: 'crlf-page-is-read-after-the-strip', why: 'The fix. Without this the pair could be '
      + 'satisfied by a parser that reads nothing at all.',
      expected: 1, got: after.length, holds: after.length === 1 },
  ];
  const leaked = [];
  let crlf_docs = 0;
  for (const rel of liveDocs()) {
    let bytes;
    try { bytes = fs.readFileSync(D(rel), 'utf8'); } catch (e) { leaked.push(rel + ' (unreadable: '
      + String((e && e.message) || e).split('\n')[0] + ')'); continue; }
    if (!bytes.includes('\r')) continue;
    crlf_docs++;
    if (readDoc(rel).includes('\r')) leaked.push(rel);
  }
  return { cases, crlf_docs, leaked, holds: cases.every(c => c.holds) && leaked.length === 0 };
}

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
  const ch = slurp(D('CHANGELOG.md'));
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
    .replace(/\blines?\s*\d[\d,]*(?:\s*[-–—]\s*\d[\d,]*)?/gi, ' ')
    /* A WALL-CLOCK TIME IS A TIMESTAMP, NOT A MEASUREMENT — and it is the same class as the ISO date
     * three strips up, which was already excluded. This repository stamps times constantly ("still
     * stands from 02:49", "the weights moved at 22:15:24"), and the minute field was being read as a
     * stated figure: `docs/DAMAGE-STAGES.md`'s "from 02:49" was scored as a claim of 49 against
     * `data/engine-diff.json`, an artifact that contains no 49 at any sign. It passed for months on
     * an arithmetic collision with a digit run inside a hash, and surfaced the moment that collision
     * was closed — a false positive that had been masked by a second false positive.
     *
     * THE HOUR AND MINUTE FIELDS ARE RANGE-CHECKED so this strips a CLOCK and not a ratio. `50:50`
     * and `16:9` survive; `02:49` and `22:15:24` do not. A bare `\d{2}:\d{2}` would have eaten the
     * first, which is a real way to write a split. */
    .replace(/\b(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/g, ' ')
    /* AN arXiv ID AND A DOI ARE CITATION IDENTIFIERS, AND THIS SCAN READ THEM AS MEASUREMENTS — the
     * exact inversion the "lines N-M" strip four rules up was written about, in a second spelling.
     * A bibliography is where a document is MOST traceable, and 10 of the 33 untraceable figures this
     * census reported on 2026-09-09 were reference entries: seven in `docs/SLOWKING-whitepaper.md`
     * alone (`arXiv:2007.13544`, `DOI:10.1126/sciadv.adg3256` and five more), plus `arXiv 2304.08272`
     * cited in two other documents. Nearly a third of the count, and clearing any of them would have
     * meant deleting a citation to make a gate happy.
     *
     * ID_WORD cannot carry this and that is why it is a strip: its lookbehind is `(?<!\bID_WORD\s)`
     * and demands a SPACE, while both of these are written with a colon — the identical reason `§`
     * and `#` were given strips here after sitting in ID_WORD without ever firing. */
    .replace(/\b(?:arxiv|doi)\s*:?\s*\d[\d.]*(?:\/\S+)?/gi, ' ');
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

  { id: 'a-wall-clock-time-is-not-a-figure',
    why: 'A timestamp is the same class as the ISO date already stripped. docs/DAMAGE-STAGES.md\'s '
       + '"still stands from 02:49" was scored as a claim of 49 against data/engine-diff.json, which '
       + 'contains no 49 anywhere. It only ever passed on a collision with a hash fragment.',
    text: 'The published run still stands from 02:49.', value: 49, find: false },

  { id: 'a-ratio-is-not-a-clock',
    why: 'The control, and it is what makes the strip above safe: the hour and minute fields are '
       + 'range-checked, so a split written 50:50 or an aspect written 16:9 is still read. A bare '
       + '\\d{2}:\\d{2} would have silently eaten the first.',
    text: 'The arms split 43:21 by construction.', value: 43, find: true },

  { id: 'an-arxiv-id-is-not-a-measurement',
    why: 'A bibliography is where a document is MOST traceable, and this census counted reference '
       + 'entries as unsourced claims — 10 of the 33 untraceable figures on 2026-09-09, seven in '
       + 'docs/SLOWKING-whitepaper.md alone. Clearing one would have meant deleting a citation.',
    text: 'ReBeL (NeurIPS). arXiv:2007.13544.', value: 2007.13544, find: false },

  { id: 'a-doi-is-not-a-measurement',
    why: 'The second spelling, and it fails a strip written only for arXiv. DOI prefixes are always '
       + '10.NNNN, so a rule that reads them reports a figure of 10.1126 in every references block.',
    text: 'Science Advances 9(46). DOI:10.1126/sciadv.adg3256.', value: 10.1126, find: false },

  { id: 'a-figure-beside-a-citation-is-still-read',
    why: 'THE CONTROL, and without it the two strips above could be satisfied by discarding the whole '
       + 'line. The identifier goes; the measurement standing next to it does not.',
    text: 'That method (arXiv:2007.13544) scored 4,321 games.', value: 4321, find: true },
];

/** Runs every case through the real function. `holds` false means the lexer changed meaning.
 *  `value` defaults to 4,321 — the figure the original five cases are built around. */
function lexingProof() {
  return LEXING_CASES.map(c => {
    const want = c.value === undefined ? 4321 : c.value;
    const found = figuresInText(c.text).some(f => f.value === want);
    return { id: c.id, why: c.why, expected: c.find, found, holds: found === c.find };
  });
}

/* Numbers that appear for reasons unrelated to any artifact. A coin's log-loss and a 50% baseline
 * are properties of arithmetic, not of a measurement, and flagging them trains people to ignore
 * this check. Same reasoning as engine/provenance.js's named exceptions: few, and each with a why. */
const UNIVERSAL = new Set([0, 1, 2, 0.5, 50, 100, 0.25, 25, 0.693, 0.6931, 0.69315, 95, 1.96, 0.05]);
const isUniversal = f => UNIVERSAL.has(f.value);

/* ---- rule 3, part b: what an artifact contains ------------------------------------------------ */

/* ================================================================================================
 * A DIGIT RUN GLUED TO A LETTER IS PART OF A TOKEN, NOT A MEASUREMENT — 2026-09-06.
 * ================================================================================================
 * `data/policy-weights.json` carries a `featureHashes.features` map of 58 CONTENT DIGESTS, written
 * as hex: `"5e163257dbbf"`, `"c6f34249369e"`. The string walk below cut digit runs out of them and
 * added `163257`, `34249369` and fifty-odd more to the set of "numbers this artifact contains" — and
 * the index then rescales every entry by x100 and /100, so each hash fragment became three chances
 * to collide. Six of them, plus two fitted floats, matched a figure in a living document by pure
 * arithmetic coincidence. Every one of those document figures belonged to a DIFFERENT and entirely
 * quotable source — the damage differential, the empirical driver's reach rate, a planned game
 * budget, DODUO's win rate. `docs/MEASURE.md` calls it a coincidence engine, and it is: an artifact
 * that publishes 58 hashes publishes ~130 phantom measurements.
 *
 * THE EXCLUSION IS DERIVED FROM THE FIELD'S ROLE, NOT FROM ITS NAME. A list of field names
 * (`featureHashes`, `digest`, `release`, `id`, ...) is the hand-maintained ban list of four and it
 * would go stale the first time a fit writes its hashes under a new key. The role is legible in the
 * CHARACTERS: a digest, a release id, a version string, a filename and a format name all glue their
 * digits to letters, and a measurement does not. This is the same rule `engine/quarantine.js` states
 * about filenames — "A SUBSTRING IS NOT A FILENAME... the character before the match must not
 * continue the name" — applied to numbers, and it generalises past hashes to `turn19`, `v2`,
 * `gen9championsvgc2026regmb` and `13ba05093aa3` without naming any of them.
 *
 * WHAT IT COSTS, MEASURED RATHER THAN ASSUMED. Across all of data/ it removes 10,569 of 117,316
 * reachable numbers (9.0%). A unit-suffixed figure written inside a string — `1.5x` — is removed
 * with them, and that is the accepted cost: the citation and untraceable ratchets were re-run over
 * the whole live document set and neither gained a single offender, so no published figure in this
 * repository was tracing through a glued digit run.
 *
 * A LEADING `.` COUNTS AS GLUE for the same reason: in `v1.2.3` the regex has already taken `1.2`,
 * and the `3` left behind is the tail of an identifier rather than a third number. */
const isTokenFragment = (s, at, len) => {
  const before = s[at - 1] || '', after = s[at + len] || '';
  return /[A-Za-z_]/.test(before) || /[A-Za-z_]/.test(after) || before === '.';
};

/* ---- THE BROWSER BUNDLES ARE ARTIFACTS TOO, AND NINETEEN OF THEM WERE UNSCORABLE — 2026-09-09 ----
 *
 * build/ writes `data/*.js` for the buildless site as `window.X = <json>;` — sometimes behind a
 * generated-file comment, sometimes inside an IIFE (`(function(root){root.MAG=<json>;})(...)`),
 * once with an alias line after it. `JSON.parse` on the whole file fails at the first character,
 * so every one of them printed the "present but unparsable" line on every run — 19 warnings — and
 * the figures they carry were scored against nothing. Living documents cite `data/engine-data.js`
 * 101 times and `data/live.js` 15.
 *
 * THE WRAPPER IS STRIPPED BY SHAPE, NOT BY NAME. Leading comments go; the first `=` marks the
 * assignment; the value is the first balanced `{...}` or `[...]` after it, found by a string-aware
 * bracket scan so a brace inside a replay log cannot close it early. Whatever follows — an alias
 * line, a helper function, the IIFE's tail — is not data and is ignored. NOTHING IS EXECUTED: a
 * bundle whose value is not JSON (a JS object literal, a function body) still gets today's warning
 * rather than a `vm` run, because "parse the data" and "run the generated code" are different
 * promises and only the first one is made here. `bundleProof()` below pins each wrapper shape. */
function bundleJson(text) {
  const s = String(text).replace(/^﻿/, '').replace(/^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*/, '');
  const eq = s.indexOf('=');
  if (eq < 0) return null;
  let i = eq + 1;
  while (i < s.length && /\s/.test(s[i])) i++;
  if (s[i] !== '{' && s[i] !== '[') return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < s.length; j++) {
    const ch = s[j];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') { depth--; if (depth === 0) return s.slice(i, j + 1); }
  }
  return null;
}

const BUNDLE_CASES = [
  { id: 'a-commented-window-assignment', text: '/* GENERATED by build/x.js — do not edit. */ window.ABRA_META={"a":[1,2]};\n', want: { a: [1, 2] } },
  { id: 'a-bare-window-assignment-with-spaces', text: 'window.SCOREBOARD = {"generated":"2026-08-06","n":3};\n', want: { generated: '2026-08-06', n: 3 } },
  { id: 'an-iife-wrapper', text: '(function(root){root.MAG={"w":[0.5,-1.25]};})(typeof window!=="undefined"?window:this);\n', want: { w: [0.5, -1.25] } },
  { id: 'a-trailing-alias-line-is-not-data', text: 'window.ABRA_STATUS = {\n "s": "a } b"\n};\nwindow.STATUS = window.ABRA_STATUS;   /* alias */\n', want: { s: 'a } b' } },
  { id: 'a-const-inside-a-closure', text: '/* engine-data.js — data. */\n(function(root){\r\nconst MC = {"mons":{"x":{"bs":{"hp":80}}}};\r\nroot.MC=MC;})(this);\r\n', want: { mons: { x: { bs: { hp: 80 } } } } },
  { id: 'a-brace-inside-a-string-does-not-close-the-value', text: 'window.KAD={"log":"|j|x\\n{not json}","n":7};\n', want: { log: '|j|x\n{not json}', n: 7 } },
  { id: 'a-js-object-literal-is-not-parsed-and-not-executed', text: 'window.X={a:1};\n', want: null },
  { id: 'no-assignment-no-value', text: '/* just a comment */\n', want: null },
];
/** Runs every wrapper shape through the real stripper and JSON.parse. `holds` false means a bundle
 *  build/ writes would come back as the wrong data, or as data when it is code. */
function bundleProof() {
  return BUNDLE_CASES.map(c => {
    let got = null;
    try { const body = bundleJson(c.text); got = body === null ? null : JSON.parse(body); } catch (e) { got = null; }
    const holds = JSON.stringify(got) === JSON.stringify(c.want);
    return { id: c.id, expected: c.want, got, holds };
  });
}

const parsedCache = new Map();
/** The parsed artifact — a JSON file, or the JSON value inside a browser bundle. `undefined` when the
 *  file is absent, `null` when it is present and unparsable (announced once). */
function artifactObject(rel) {
  if (parsedCache.has(rel)) return parsedCache.get(rel);
  const p = D(rel);
  let j;
  if (!fs.existsSync(p)) j = undefined;
  else {
    /* AN UNPARSABLE ARTIFACT MUST NOT READ AS AN EMPTY ONE.
     * This returned null, the walk below then produced an EMPTY number set, and an empty set makes
     * every figure citing that artifact look like a mismatch — the check would report a document as
     * wrong because the FILE was unreadable, and the document would get "corrected" to match
     * nothing. That is worse than not checking: it manufactures false findings in the one instrument
     * whose whole job is to catch false claims. Announced, and the caller is told to skip rather
     * than to score against an empty set. */
    try {
      const text = fs.readFileSync(p, 'utf8');
      const body = /\.js$/i.test(rel) ? bundleJson(text) : text;
      if (body === null) throw new Error('no JSON value found after the wrapper');
      j = JSON.parse(body);
    } catch (parseErr) {
      console.error('  docs_scan: ' + rel + ' is present but unparsable (' + (parseErr.message || parseErr).split('\n')[0]
        + ') — NOT scoring any figure against it, because an empty set would make every citation look wrong');
      j = null;                          // null = "cannot judge", distinct from an empty set = "contains nothing"
    }
  }
  parsedCache.set(rel, j);               // cached so the warning is said once, not once per citation
  return j;
}

/** Every number reachable inside a node, including numbers written inside its strings. */
function walkNumbers(o, set) {
  if (o === null || o === undefined) return;
  if (typeof o === 'number') { set.add(o); return; }
  if (typeof o === 'string') {
    for (const m of o.matchAll(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/g)) {
      if (isTokenFragment(o, m.index, m[1].length)) continue;
      set.add(Number(m[1].replace(/,/g, '')));
    }
    return;
  }
  if (Array.isArray(o)) { for (const v of o) walkNumbers(v, set); return; }
  if (typeof o === 'object') { for (const k of Object.keys(o)) { walkNumbers(k, set); walkNumbers(o[k], set); } }
}

const artifactCache = new Map();
/** Every number reachable inside an artifact, including numbers written inside its strings. */
function artifactNumbers(rel) {
  if (artifactCache.has(rel)) return artifactCache.get(rel);
  const j = artifactObject(rel);
  let set = null;
  if (j !== undefined && j !== null) { set = new Set(); walkNumbers(j, set); }
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

/** The data artifacts a block names. A citation is a promise that the number came from that file.
 *  A browser bundle under data/ counts since 2026-09-09 — build/ writes it from a measurement and the
 *  documents cite it by name (`data/engine-data.js` 101 times, `data/live.js` 15); see bundleJson(). */
function citationsIn(block) {
  const s = block.join('\n');
  const out = new Set();
  for (const m of s.matchAll(/\b(data\/[A-Za-z0-9_.\-]+\.(?:json|js))\b/g)) out.add(m[1]);
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
const QUALIFIED = /retract|withdraw|superseded|void|not (?:a )?(?:true|valid|current)|no longer|stale|historic|was measured|obsolete|corrected|correction|prior|former|previously|invalid|does not hold|~~/i;

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

/* ================================================================================================
 * THE GATE COULD NOT SEE A WRONG HEADLINE, AND IT WAS PROVEN BY MUTATION — ROADMAP #552, 2026-09-09.
 * ================================================================================================
 * `27 of 961` was changed to `41 of 961` in docs/MODELS.md, on a line citing
 * data/game-differential.json, and tests/test-docs-current.js passed BYTE-IDENTICALLY
 * (docs/_reports/2026-09-09-pre-600-test-breaks.md, break h). Two mechanisms, both in this file:
 *
 *   1. `QUALIFIED` WAS TESTED AGAINST THE WHOLE BLOCK. One word anywhere — and a ledger headline
 *      naturally says "reproduced the superseded 5.264.0 publication" — exempted every figure in the
 *      paragraph, including the ones the paragraph asserts as CURRENT. The scope is now the SENTENCE:
 *      a sentence that discusses a retraction is skipped, the sentence beside it is scored. A struck
 *      span (~~…~~) is withdrawn by its author and is blanked before the split, so the figure that
 *      REPLACES it is still read and the strike itself no longer qualifies its neighbours.
 *
 *   2. `artifactHas` WAS SET MEMBERSHIP OVER EVERY NUMBER IN THE ARTIFACT. game-differential.json
 *      carries a turn index for every turn and hundreds of credit counts, so 41 was "in" it exactly
 *      as 27 was. A citation may now name a FIELD — `data/x.json:state.games` — and a figure in that
 *      sentence is judged against that subtree alone; and a backticked key path followed by a figure
 *      ("`state.games` 961") is read as a claim about THAT leaf and compared to its value. Both keep
 *      the rounding/scaling tolerance the set check has always had. Neither is weaker than it: a
 *      subtree is a subset of the file, and a leaf is a subset of the subtree.
 *
 * WHAT THIS DOES NOT DO, STATED SO IT IS NOT ASSUMED. A DERIVED headline — "27, which is 961 less
 * 934" — is not a leaf and cannot be checked without arithmetic; what is checked are its named
 * operands, which is what the sentence itself offers. A file-only citation with no field and no key
 * path is still set membership. A "numeric leaf whose key path shares a token with the sentence"
 * rule was prototyped for that case and left out, with the measurement in the 2026-09-09 report: on
 * the block above it REFUSED the correct 961 (`arms[0].games` shares no prose token once code is
 * stripped) and PASSED the mutant 41 (`state.agreement_by_turn[40].turn` shares `state`). A rule
 * that fails the true figure and clears the false one has not understood the defect. */

/** `data/x.json:a.b[0].c` — a citation that names WHERE in the artifact the figure lives. The field
 *  must start like an identifier, so `data/x.json:123` (a line number) and `data/x.json: 961` are not
 *  fields. `[]` means every element.
 *
 *  THE FIELD BINDS THE FIGURE BESIDE IT, NOT THE SENTENCE. Measured before this was narrowed: "over
 *  **5,265 clean games** (`data/guru-matchups.json:n_games`), 12 archetypes" scored the 12 against
 *  n_games and accused a correct sentence. `bound` is the nearest figure after the citation within a
 *  short connector ("reads", "is", "of", "at"), else the nearest figure before it within a parenthetical
 *  reach; every other figure in the sentence is judged against the whole artifact as before. */
const FIELD_CITE_RE = /\b(data\/[A-Za-z0-9_.\-]+\.json):([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d*\])*)/g;
const NUM = '(?:' + MINUS + '?(?:\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)\\s*%?)';
const AFTER_RE = new RegExp('^`?\\)?\\*{0,2}\\s*(?:reads?|is|was|=|:|of|at|→|->|—|-|holds|says|gives)?\\s*\\*{0,2}(' + NUM + ')');
const BEFORE_RE = new RegExp('(' + NUM + ')\\*{0,2}[^\\d\\n]{0,60}$');
function fieldCitationsIn(text) {
  const out = [];
  const s = String(text);
  for (const m of s.matchAll(FIELD_CITE_RE)) {
    let bound = null;
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 60).match(AFTER_RE);
    if (after) bound = after[1];
    else {
      const before = s.slice(Math.max(0, m.index - 80), m.index).replace(/`[^`]*$/, '').match(BEFORE_RE);
      if (before) bound = before[1];
    }
    const f = bound ? figuresIn(bound)[0] : null;
    out.push({ c: m[1], field: m[2], bound: f ? f.raw : null });
  }
  return out;
}

/** The node(s) a key path names inside a parsed artifact, or null when the path does not resolve —
 *  which is distinct from resolving to a null VALUE, and the distinction is what makes a wrong field
 *  name a finding rather than a silence. */
function resolveField(obj, field) {
  let nodes = [obj];
  for (const tok of String(field).match(/\[\d*\]|[^.\[\]]+/g) || []) {
    const next = [];
    for (const n of nodes) {
      if (n === null || typeof n !== 'object') continue;
      if (tok === '[]') next.push(...(Array.isArray(n) ? n : Object.values(n)));
      else if (/^\[\d+\]$/.test(tok)) { const k = Number(tok.slice(1, -1)); if (k in n) next.push(n[k]); }
      else if (Object.prototype.hasOwnProperty.call(n, tok)) next.push(n[tok]);
    }
    if (!next.length) return null;
    nodes = next;
  }
  return nodes;
}

/* ================================================================================================
 * A DATED RECORD CANNOT BE JUDGED BY AN ARTIFACT REGENERATED AFTER IT — MEASURED 2026-09-09.
 * ================================================================================================
 * Scoping QUALIFIED to the sentence exposed 632 figures across 13 documents, and the composition
 * decides what they are: 226 in docs/MODELS.md, 130 in the white paper, 115 in docs/RUNNING-NOTES.md,
 * 71 in the technical docs — almost all of them in blocks that open `**5.244.0 -`, or sit under a
 * `## [5.267.0] — 2026-09-08` row heading, or announce themselves *"superseded by the 5.209.0 block
 * above"*. EVERY NOTES ROW CARRIES A `**Supersedes.**` BULLET, so the block-level QUALIFIED had
 * exempted the whole notes page from this rule since the day the page was created; the test's claim
 * that 3b(b) "applies to it exactly as to the white paper" described a check that never fired.
 *
 * Accusing them is the treadmill `changelogHas` already documents for the census: an artifact holds
 * only its CURRENT numbers, `data/game-differential.json` is rewritten by every ENGINE batch, and a
 * row that faithfully recorded 27 of 961 on 2026-09-06 would go red on 2026-09-07 for nothing anyone
 * did wrong. A gate that fires no matter what anyone does is the gate people learn to route around.
 * Masking them with a word is the #552 defect. So the third mechanism DATES both sides:
 *
 *   the block     a version stamp opening its first line (`**5.244.0 -`), or the nearest heading above
 *                 it carrying `[X.Y.Z]` or an ISO date — resolved to a date through CHANGELOG.md.
 *                 A block with neither is UNDATED and is a claim about the file on disk today.
 *   the artifact  its own `generated` stamp (248 of 286 artifacts under data/ carry one). An
 *                 artifact without one is undated and is judged as it always was.
 *
 * A figure a dated block states that the cited artifact does not hold is ACCUSED when the artifact
 * is not newer than the block — the document could have read this instance — and REPORTED AS
 * PREDATING when every cited artifact was regenerated after the block was written, because no
 * instrument reading the disk can say whether that record was right. The count is printed, not
 * gated; the debt it represents is already counted by the notes-page clause. This is not a word
 * anyone can add to a paragraph: to move a block into the predating set you would have to stamp it
 * with an OLD version, which is a falsified record and a different offence.
 *
 * WHAT IT COSTS, STATED. The #552 mutation itself — `27 of 961` → `41 of 961` at docs/MODELS.md:7,
 * in a block stamped 5.266.0 that names the artifact instance it read (`generated 2026-09-06T17:42`)
 * — is in a block that predates the artifact on disk (generated 2026-09-09, 0 of 958), and 41 occurs
 * in that artifact as a turn index. Nothing that reads the disk can adjudicate that sentence, right
 * or wrong; this rule now SAYS so instead of passing it silently, and catches the same mutation the
 * moment the block is current or the headline is bound to a field. */
let changelogDatesCache = null;
/** version -> ISO date, from `## [X.Y.Z] — YYYY-MM-DD` in CHANGELOG.md. */
function changelogDates() {
  if (changelogDatesCache) return changelogDatesCache;
  changelogDatesCache = new Map();
  try {
    for (const m of slurp(D('CHANGELOG.md')).matchAll(/^##\s*\[(\d+\.\d+\.\d+)\][^\n]*?(\d{4}-\d{2}-\d{2})/gm))
      if (!changelogDatesCache.has(m[1])) changelogDatesCache.set(m[1], m[2]);
  } catch (e) { /* no CHANGELOG: nothing dates, everything is judged — fail-closed */ }
  return changelogDatesCache;
}
const changelogDate = (v) => changelogDates().get(v) || null;

/** The date a heading or a block's first line stamps on what follows, or null. A heading is dated by
 *  an ISO date or a `[X.Y.Z]` anywhere in it; a paragraph by a version OPENING it (`**5.244.0 -`) or
 *  by a date or version inside its opening bold span — the ledgers write their record titles as
 *  `**MECHANICS STATE, 2026-08-06 (3.56.0), read from the artifact:**`, and that span is the title. */
function stampedDate(line, versionDate) {
  const L = String(line);
  if (/^#{1,6}\s/.test(L)) {
    const iso = L.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (iso) return iso[1];
    const ver = L.match(/\[(\d+\.\d+\.\d+)\]|^#{1,6}\s*(\d+\.\d+\.\d+)\b/);
    return ver ? versionDate(ver[1] || ver[2]) : null;
  }
  const opening = L.match(/^\W{0,4}(\d+\.\d+\.\d+)\b/);
  if (opening) return versionDate(opening[1]);
  const title = L.match(/^\s*(?:>\s*)?\*\*([^*\n]+)\*\*/);
  if (title) {
    const iso = title[1].match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (iso) return iso[1];
    const ver = title[1].match(/\b(\d+\.\d+\.\d+)\b/);
    if (ver) return versionDate(ver[1]);
  }
  return null;
}

/** For every line index, the date in force there: set by the nearest heading above, or by the nearest
 *  paragraph above that OPENS with a version stamp — the ledgers write `**5.264.0 - ...**` as a
 *  paragraph and elaborate it in the paragraphs that follow, so the stamp dates them until the next
 *  stamp or heading. A stamp CHANGELOG.md cannot date resets the date to null rather than inheriting
 *  one, so an unknown version is judged, not excused. */
function headingDates(lines, versionDate) {
  const out = new Array(lines.length);
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const opensParagraph = i === 0 || lines[i - 1].trim() === '';
    if (/^#{1,6}\s/.test(L) || (opensParagraph && /^\W{0,4}\d+\.\d+\.\d+\b/.test(L))) cur = stampedDate(L, versionDate);
    /* A titled paragraph dates ITSELF (stampedDate is asked again for the block's first line) and
     * nothing after it — only a heading or a version-opened paragraph carries forward. */
    out[i] = cur;
  }
  return out;
}

/** The ISO date of an artifact's own `generated` stamp, or null. */
function artifactDate(j) {
  const g = j && typeof j === 'object' && !Array.isArray(j) ? j.generated : null;
  const m = typeof g === 'string' ? g.match(/^(\d{4}-\d{2}-\d{2})/) : null;
  return m ? m[1] : null;
}

/* ---- A SENTENCE IS THE UNIT OF A CLAIM ---------------------------------------------------------
 *
 * The split happens on a copy with inline code and struck spans blanked to SPACES, so offsets line up
 * with the original: a `~~27 of 961~~` cannot be read as a figure, and the `~~` marker itself is gone
 * before QUALIFIED sees the text. Each span comes back twice — `raw`
 * (code intact, struck spans blanked; what figuresIn and fieldClaims read) and `plain` (code blanked
 * too; what QUALIFIED reads, so a word inside an identifier cannot qualify prose).
 *
 * A boundary is end-punctuation, whitespace, then something that starts a sentence: a capital, a
 * digit, or markdown emphasis/quote/bracket. A lower-case continuation ("e.g. the", "vs. MAG") does
 * not split. A SEMICOLON is a boundary too, whatever follows it: the ledgers write one claim per
 * clause — "WAR 0.6936 — `data/war.json`; NMF 0.682 — `data/nmf-roles.json`; ..." — and each clause
 * names its own source. A false split is STRICTER, never looser — it can only narrow the reach of a
 * qualifier or of a citation. */
const SENTENCE_END = /(?<=[.!?])\s+(?=[A-Z0-9*"'(\[_`])|;\s+/g;
function sentencesOf(line) {
  const struck = String(line).replace(/~~[^~\n]+~~/g, m => ' '.repeat(m.length));
  const plain = struck.replace(/`[^`\n]*`/g, m => ' '.repeat(m.length));
  const cuts = [];
  let at = 0, m;
  /* The boundaries are found on `struck`, where code is still visible, because a sentence that OPENS
   * with a citation — "`data/x.json` reads 42" — begins with a backtick and, once the code is blanked,
   * with nothing at all. A `.json` inside code is followed by its closing backtick, not by whitespace,
   * so it cannot end a sentence either way. */
  SENTENCE_END.lastIndex = 0;
  while ((m = SENTENCE_END.exec(struck)) !== null) { cuts.push([at, m.index]); at = m.index + m[0].length; }
  cuts.push([at, plain.length]);
  return cuts.map(([a, b]) => ({ raw: struck.slice(a, b), plain: plain.slice(a, b) })).filter(s => s.plain.trim());
}

/* "`state.games` 961" — a backticked key path that RESOLVES to a numeric leaf in a cited artifact,
 * followed by a figure. The document has named the exact value it is quoting, so the figure is a
 * claim about that leaf and nothing else in the file. A path that resolves to nothing, or to an
 * object, binds nothing — it is just code — and the figure falls through to the ordinary check. */
const KEYPATH = '[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*|\\[\\d+\\])*';
const CLAIM_RE = new RegExp('`(' + KEYPATH + ')`\\*{0,2}\\s*(?:reads?|is|was|=|:|of|at|→|->|—)?\\s*\\*{0,2}('
  + MINUS + '?)(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)\\s*(%?)', 'g');
function fieldClaims(raw, cites, artifact = artifactObject) {
  const out = [];
  for (const m of String(raw).matchAll(CLAIM_RE)) {
    for (const c of cites) {
      const j = artifact(c);
      if (j === undefined || j === null) continue;
      const nodes = resolveField(j, m[1]);
      if (!nodes || nodes.length !== 1 || typeof nodes[0] !== 'number') continue;
      const f = figuresIn(m[2] + m[3] + m[4])[0];
      if (!f) continue;
      out.push({ field: m[1], cite: c, expected: nodes[0], figure: f });
      break;
    }
  }
  return out;
}

/** Blocks that name a data artifact and state a figure that artifact — or the field the citation
 *  names, or the leaf the sentence names — does not hold. `read`, `artifact` and `versionDate` are
 *  injectable so the rule can be shown red on a synthetic document without writing one into docs/.
 *  Returns the accusations; the figures in dated blocks that only a regenerated artifact could not
 *  hold are on the returned array's `.predates` (reported, not gated — see above). */
function citationMismatches(docs, { read = readDoc, artifact = artifactObject, versionDate = changelogDate } = {}) {
  const predates = [];
  const local = new Map();
  const numsOf = artifact === artifactObject ? artifactNumbers : (rel) => {
    if (local.has(rel)) return local.get(rel);
    const j = artifact(rel);
    let s = null;
    if (j !== undefined && j !== null) { s = new Set(); walkNumbers(j, s); }
    local.set(rel, s);
    return s;
  };
  /* Numbers under one field. `undefined` = the artifact cannot be judged (skip, as for the file);
   * `null` = the artifact parsed and the field is not in it, which is a broken citation. */
  const scopeOf = (rel, field) => {
    const j = artifact(rel);
    if (j === undefined || j === null) return undefined;
    const nodes = resolveField(j, field);
    if (!nodes) return null;
    const s = new Set();
    for (const n of nodes) {
      walkNumbers(n, s);
      /* "`data/pokemon-roles.json:roles`, 52 keys" — the SIZE of a container is a claim about the field. */
      if (Array.isArray(n)) s.add(n.length);
      else if (n && typeof n === 'object') s.add(Object.keys(n).length);
    }
    return s;
  };
  const hits = [];
  /* A PINNED DOCUMENT IS DATED BY ITS PIN. `data/docs-currency-baseline.json` `version_pins` is a
   * reviewed declaration that a document is deliberately frozen at a version, with a reason in the
   * diff; that is the one document-level date this rule honours. A living document's own header is
   * NOT used, because a document at 5.266.0 can carry a sentence written this morning under the
   * running-notes deferral, and that sentence is a claim about the artifact on disk. */
  const pins = versionPins();
  /* One sink for both verdicts. A figure no cited artifact holds is ACCUSED if any of them could have
   * been the instance the block read (undated block, undated artifact, or artifact not newer than the
   * block), and recorded as PREDATING when every one of them was regenerated after the block. */
  const file = (h, when, stamps) => {
    const judgeable = h.cites.some(c => !when || !stamps.get(c) || stamps.get(c) <= when);
    const r = { ...h, when, regenerated: h.cites.map(c => stamps.get(c) || null) };
    if (judgeable) hits.push(r); else predates.push(r);
  };
  for (const rel of docs) {
    const text = read(rel);
    const lines = text.split('\n');
    const above = headingDates(lines, versionDate);
    const pinned = pins[rel] && pins[rel].version ? versionDate(pins[rel].version) : null;
    for (const b of paragraphs(text)) {
      const cites = citationsIn(b.lines);
      if (!cites.length) continue;
      const sets = cites.map(c => ({ c, nums: numsOf(c) })).filter(x => x.nums);
      if (!sets.length) continue;
      const judged = sets.map(x => x.c);
      const stamps = new Map(judged.map(c => [c, artifactDate(artifact(c))]));
      /* The first three lines are joined for the title branch: the white paper hard-wraps at ~100
       * columns, so a `**...**` title that carries the record's date often closes on line two. */
      const when = stampedDate(b.lines.slice(0, 3).join(' '), versionDate) || above[Math.max(0, b.start - 1)] || pinned || null;
      const head = b.lines[0].trim().slice(0, 100);
      let fenced = false;
      for (let i = 0; i < b.lines.length; i++) {
        const L = b.lines[i];
        if (fenceOpen(L)) { fenced = !fenced; continue; }
        if (fenced) continue;
        for (const s of sentencesOf(L)) {
          /* A SENTENCE that is itself about staleness quotes the old number on purpose. The sentence
           * beside it does not, and used to inherit the exemption. */
          if (QUALIFIED.test(s.plain)) continue;
          /* AND THE CITATION IS THE SENTENCE'S, NOT THE BLOCK'S. A figure is a claim about the artifact
           * named beside it; a sentence naming none is the census's to trace (untraceableCensus reads
           * the same split). Measured before this landed: block-level binding judged every figure in a
           * `**5.244.0 -` ledger paragraph against data/policy-weights.json because the paragraph said
           * "no fitted vector was written to `data/policy-weights.json`" — 63 accusations in one
           * document, none of them a claim about that file. */
          const own = citationsIn([s.raw]).filter(c => judged.includes(c));
          if (!own.length) continue;
          const ownSets = sets.filter(x => own.includes(x.c));
          const scopes = [];
          for (const fc of fieldCitationsIn(s.raw)) {
            if (!judged.includes(fc.c)) continue;
            const sc = scopeOf(fc.c, fc.field);
            if (sc === undefined) continue;
            if (sc === null) {
              file({ doc: rel, line: b.start + i, figure: ':' + fc.field, cites: [fc.c], field: fc.field,
                     expected: 'no such field', text: head }, when, stamps);
              continue;
            }
            scopes.push({ c: fc.c, field: fc.field, nums: sc, bound: fc.bound });
          }
          const claims = fieldClaims(s.raw, own, artifact);
          for (const f of figuresIn(s.raw)) {
            if (isUniversal(f)) continue;
            if (f.value < 10 && Number.isInteger(f.value)) continue;   // counts this small are structural
            const ci = claims.findIndex(k => k.figure.raw === f.raw);
            if (ci >= 0) {
              /* Bound to a named leaf: judged against that value alone, with the usual tolerance. */
              const k = claims.splice(ci, 1)[0];
              if (artifactHas(new Set([k.expected]), f)) continue;
              file({ doc: rel, line: b.start + i, figure: f.raw, cites: [k.cite], field: k.field,
                     expected: k.expected, text: head }, when, stamps);
              continue;
            }
            const mine = scopes.filter(sc => sc.bound === f.raw);
            if (mine.length) {
              /* The figure sits beside a field citation: it must be under that field, not merely in the file. */
              if (mine.some(sc => artifactHas(sc.nums, f))) continue;
              file({ doc: rel, line: b.start + i, figure: f.raw, cites: [...new Set(mine.map(sc => sc.c))],
                     field: mine.map(sc => sc.field).join('|'), text: head }, when, stamps);
              continue;
            }
            if (ownSets.some(x => artifactHas(x.nums, f))) continue;
            file({ doc: rel, line: b.start + i, figure: f.raw, cites: own, text: head }, when, stamps);
          }
        }
      }
    }
  }
  Object.defineProperty(hits, 'predates', { value: predates, enumerable: false });
  return hits;
}

/* ---- THE RED DEMONSTRATION FOR RULE 3d, ONE PAIR PER MECHANISM --------------------------------
 *
 * Same discipline as RETRACTION_CASES and LEXING_CASES: every rule that decides a figure is or is not
 * a claim carries a case it MUST catch and a case it MUST NOT, and both run through the SHIPPING
 * `citationMismatches` on a synthetic document against a synthetic artifact, injected. Nothing is
 * written to disk. The artifact is built so that 41 IS present (as a turn index) and 42 is not, which
 * is the exact shape of the #552 mutation: a wrong headline whose digits happen to occur elsewhere. */
const PROOF_ARTIFACT = 'data/_proof-differential.json';
const PROOF_DOC = 'docs/_proof-citation.md';
const PROOF_JSON = {
  generated: '2026-09-09T11:48:00.710Z',
  state: { games: 961, games_board_never_diverged: 934, turn_boundaries_compared: 10675 },
  agreement_by_turn: [{ turn: 41, reached: 961 }, { turn: 27, reached: 940 }],
  rate: 0.12345,
};
const PROOF_VERSION_DATE = (v) => ({ '1.0.0': '2026-09-01', '9.9.9': '2026-09-20' }[v] || null);
const CITATION_CASES = [
  { id: 'a-block-stamped-before-the-artifact-was-regenerated-is-reported-not-accused',
    why: 'THE TREADMILL. A record written at 1.0.0 (2026-09-01) cites an artifact regenerated on '
       + '2026-09-09; the disk cannot say what that instance held, so the figure is filed under '
       + '`.predates` and printed, not failed.',
    text: '**1.0.0 - THE RECORD.** `data/_proof-differential.json` read 42 of 961 that night.', figure: '42', caught: false, predates: true },
  { id: 'a-block-stamped-after-the-artifact-was-regenerated-is-accused',
    why: 'The control: the same sentence stamped 9.9.9 (2026-09-20) could only have read the instance '
       + 'on disk, and the disk does not hold 42.',
    text: '**9.9.9 - THE CLAIM.** `data/_proof-differential.json` reads 42 of 961 today.', figure: '42', caught: true },
  { id: 'a-dated-heading-dates-the-blocks-under-it',
    why: 'The notes page dates its rows in the heading, not in the bullet, so the bullet inherits it.',
    text: '## [Unreleased] — 2026-09-01 — a row\n\n- **Measured.** `data/_proof-differential.json` read 42 of 961.', figure: '42', caught: false, predates: true },
  { id: 'an-undated-block-is-a-claim-about-the-file-on-disk',
    why: 'No stamp, no heading date: the sentence asserts the current artifact and is judged against it.',
    text: 'On the frozen pool `data/_proof-differential.json` reads 42 of 961.', figure: '42', caught: true },
  { id: 'a-stamp-that-changelog-does-not-know-does-not-date-anything',
    why: 'A version with no CHANGELOG entry resolves to no date, so the block is judged, not excused. '
       + 'Fail-closed: the exemption needs evidence to exist.',
    text: '**7.7.7 - UNKNOWN.** `data/_proof-differential.json` reads 42 of 961.', figure: '42', caught: true },
  { id: 'a-qualifier-in-the-next-sentence-does-not-shield-a-headline',
    why: 'THE #552 DEFECT. "superseded" in the first sentence exempted the whole block, so the wrong '
       + 'headline in the second sentence was never scored.',
    text: 'It reproduced the superseded 5.264.0 publication exactly. `data/_proof-differential.json` '
        + 'now reads **42 of 961** on a settled tree.', figure: '42', caught: true },
  { id: 'a-qualified-sentence-is-still-not-a-claim',
    why: 'THE CONTROL. A sentence REPORTING a retraction quotes the old number on purpose; punishing it '
       + 'is how the check gets switched off.',
    text: 'The prior 42 of 961 that `data/_proof-differential.json` held is superseded by the row '
        + 'below.', figure: '42', caught: false },
  { id: 'a-figure-in-a-sentence-that-cites-nothing-is-not-this-rule-s',
    why: 'THE BINDING. The citation is the sentence\'s, not the block\'s: a figure two sentences away '
       + 'from `data/x.json` is not a claim about x.json, and judging it against x.json produced 63 '
       + 'accusations in one ledger paragraph. It is traced by the census instead.',
    text: 'No fitted vector was written to `data/_proof-differential.json`. The store holds 42 games.', figure: '42', caught: false },
  { id: 'a-struck-figure-is-withdrawn-and-does-not-fire',
    why: 'An author-placed strike is the least ambiguous withdrawal in markdown; the figure inside it '
       + 'is not a claim.',
    text: '`data/_proof-differential.json`: ~~42 of 961~~ 961 games after the fix.', figure: '42', caught: false },
  { id: 'the-figure-that-replaces-a-struck-one-is-still-read',
    why: 'The other half of the strike rule. `~~` used to be in QUALIFIED, so a corrected sentence was '
       + 'exempt along with the figure it corrected — the replacement could be anything.',
    text: '`data/_proof-differential.json`: ~~961 games~~ 42 games after the fix.', figure: '42', caught: true },
  { id: 'a-field-citation-narrows-the-check-to-that-field',
    why: 'THE MUTATION SHAPE. 41 is in the artifact — as a turn index — so set membership passes it. '
       + 'The citation names state.games, and 41 is not state.games.',
    text: '`data/_proof-differential.json:state.games` reads 41 on this release.', figure: '41', caught: true },
  { id: 'a-field-citation-passes-the-value-the-field-holds',
    why: 'The control for the case above: the same citation, the right number.',
    text: '`data/_proof-differential.json:state.games` reads 961 on this release.', figure: '961', caught: false },
  { id: 'a-field-citation-keeps-the-rounding-and-scaling-tolerance',
    why: '0.12345 written as 12.3% is the same claim; the field check must accept what the set check '
       + 'always has, or it is stricter in a way no writer could satisfy.',
    text: '`data/_proof-differential.json:rate` reads 12.3% on the held-out set.', figure: '12.3%', caught: false },
  { id: 'a-field-that-does-not-exist-is-a-broken-citation',
    why: 'A citation naming a field the artifact lacks is telling the reader to check somewhere that is '
       + 'not there. It is reported as `:field`, not silently widened to the whole file.',
    text: '`data/_proof-differential.json:state.nope` reads 961 on this release.', figure: ':state.nope', caught: true },
  { id: 'a-wildcard-field-reaches-every-element',
    why: '`[]` is how the documents already write a per-element field.',
    text: '`data/_proof-differential.json:agreement_by_turn[].reached` reads 940 at turn 2.', figure: '940', caught: false },
  { id: 'a-backticked-key-path-binds-the-figure-beside-it',
    why: 'THE OPERAND FORM THE MODELS.md HEADLINE USES: "`state.games` 961 less '
       + '`state.games_board_never_diverged` 934". The path resolves to a leaf, so the figure is a '
       + 'claim about that leaf. 41 is elsewhere in the file and that no longer helps it.',
    text: '`data/_proof-differential.json` on this release: `state.games` 41 less '
        + '`state.games_board_never_diverged` 934.', figure: '41', caught: true },
  { id: 'a-backticked-key-path-passes-the-value-it-names',
    why: 'The control for the operand form.',
    text: '`data/_proof-differential.json` on this release: `state.games` 961 less '
        + '`state.games_board_never_diverged` 934.', figure: '961', caught: false },
  { id: 'a-key-path-that-resolves-to-nothing-binds-nothing',
    why: 'Backticks hold identifiers of every kind. One that is not a leaf in the cited artifact is just '
       + 'code, and the figure beside it is judged as it always was.',
    text: '`data/_proof-differential.json`: `state.nothing` 961 games.', figure: '961', caught: false },
  { id: 'a-plain-citation-is-still-set-membership-and-still-catches',
    why: 'The base case must not have been weakened while the others were added.',
    text: '`data/_proof-differential.json` reads 42 games.', figure: '42', caught: true },
  { id: 'a-plain-citation-still-passes-a-figure-the-file-holds',
    why: 'The base control.',
    text: '`data/_proof-differential.json` reads 10,675 turn boundaries.', figure: '10,675', caught: false },
];

/** Runs every case through the real rule. `holds` false means the rule changed meaning. */
function citationProof() {
  const artifact = rel => (rel === PROOF_ARTIFACT ? PROOF_JSON : undefined);
  return CITATION_CASES.map(c => {
    const hits = citationMismatches([PROOF_DOC], { read: () => '# proof\n\n' + c.text + '\n', artifact,
                                                  versionDate: PROOF_VERSION_DATE });
    const caught = hits.some(h => h.figure === c.figure);
    const predated = hits.predates.some(h => h.figure === c.figure);
    const holds = caught === c.caught && (c.predates === undefined || predated === c.predates);
    return { id: c.id, why: c.why, text: c.text, figure: c.figure, expected: c.caught, caught, predated,
             hits: hits.map(h => h.figure + (h.field ? ' (' + h.field + ')' : '')), holds };
  });
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
    if (!/\.(json|js)$/.test(f)) continue;
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
      /* THE SENTENCE IS THE UNIT HERE TOO — 2026-09-09. A block was skipped whole for one citation
       * anywhere in it, so every other figure in a `**5.244.0 -` ledger paragraph was neither this
       * clause's nor rule 3d's. A sentence that cites an artifact is judged by citationMismatches;
       * a sentence that cites none is traced here. Same split, same sentencesOf(). */
      const uncited = [];
      let fenced = false;
      for (const L of b.lines) {
        if (fenceOpen(L)) { fenced = !fenced; continue; }
        if (fenced) continue;
        for (const s of sentencesOf(L)) if (!citationsIn([s.raw]).length) uncited.push(s.raw);
      }
      for (const f of figuresInText(uncited.join('\n'))) {
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

/* ================================================================================================
 * RULE 4 — A DOCUMENT MAY NOT STATE A FIGURE SOURCED FROM A QUARANTINED ARTIFACT. 2026-09-06.
 * ================================================================================================
 * THIS FILE HAD NO QUARANTINE CLAUSE AT ALL, and that is exactly why three withheld figures were
 * republished out of `docs/WEB.md` on 2026-09-06 with every check green. The citation rule above
 * asks *"is this figure in the artifact it cites?"* — and a quarantined artifact answers YES. So
 * `engine/status.js` withheld the number on one screen while this file cleared the document
 * reprinting it on another. **The citations were FAITHFUL. That was the whole problem.**
 *
 * CLAUDE.md is explicit about the shape: *"A CAPTION IS NOT A QUARANTINE... the figure must be
 * WITHHELD, not annotated. Printing it with a caveat is the bug."*
 *
 * THERE IS ALREADY A CITATION RATCHET AND THIS IS NOT A SECOND COPY OF IT — CHECKED FIRST, BECAUSE
 * HAND-ROLLING A SECOND VERSION OF SOMETHING THAT EXISTS IS HOW `buildMon("Scizor")` RETURNED NULL.
 * `engine/quarantine.js --check` walks docs/, web/ and app/ for the first ~50 characters of a
 * quarantined artifact's OWN `verdict` / `headline` / `summary` STRING and ratchets the hits into
 * `data/quarantine-stamp.json`. It is a different granularity and it is why nothing fired on
 * 2026-09-06: it catches a document that quotes the SENTENCE ("MILTANK takes 55.5% of 535 DECISIVE
 * PAIRS") and cannot see one that quotes only the NUMBER beside a faithful citation, which is what
 * `docs/WEB.md` did. Verdict-sentence granularity there, FIGURE granularity here, and the figure
 * lexer this rule needs already lives in this file and nowhere else.
 *
 * THE QUARANTINED SET IS DERIVED FROM `engine/quarantine.js`, NEVER TYPED HERE. A list of withheld
 * artifacts in this file would be the hand-maintained ban list of four in a new costume, and it
 * would be wrong the first time the gate opens. `state().withhold(file)` is the same function
 * `status.js` asks, so the two can never disagree about what is held — including the day the gate
 * opens, when this clause correctly accuses nobody.
 *
 * THERE IS NO PROSE ESCAPE, AND THAT IS DELIBERATE. The retraction rule skips a paragraph matching
 * `QUALIFIED` ("previously", "stale", "was measured"), which is right for a figure a document is
 * DISCUSSING. It is wrong here: an escape spelled with a word is a caption, and a caption is what
 * this rule exists to refuse. A document that must not state the number does not state it.
 *
 * `isDistinctive` IS THE COINCIDENCE BAR AND IT IS THE ONE THIS FILE ALREADY USES. `policy-weights`
 * holds tens of thousands of floats, so a bare two-digit integer matches it by chance; measured
 * 2026-09-06, dropping the bar turned 132 findings into 468 — the "registry that fires on every
 * occurrence of a small integer" failure recorded above, arriving through a different door.
 *
 * `withhold` IS A PARAMETER because a flag anybody can pass on the command line eventually gets
 * passed — the same reasoning `engine/quarantine.js` gives for `withholder(gate, rows)`. It also
 * lets the gate be driven RED on a synthetic set without touching the real one. */
function quarantinedState(inject) {
  if (inject) return { withhold: inject, open: false, why: 'injected by the caller' };
  let Q; try { Q = require('./quarantine.js'); }
  catch (e) { return { withhold: null, open: null,
    why: 'engine/quarantine.js could not be loaded (' + String((e && e.message) || e).split('\n')[0]
       + '), so NOTHING is checked against the withheld set — this is not a clean bill' }; }
  try {
    const s = Q.state();
    return { withhold: s.withhold, open: s.ok,
      why: s.ok ? 'THE GATE IS OPEN — nothing is quarantined today, so this clause can accuse '
                + 'nothing. That is a fact about the gate, not about the documents.'
                : s.set.size + ' artifact(s) are withheld by engine/quarantine.js' };
  } catch (e) {
    return { withhold: null, open: null,
      why: 'engine/quarantine.js could not compute the gate (' + String((e && e.message) || e).split('\n')[0]
         + '), so NOTHING is checked against the withheld set — this is not a clean bill' };
  }
}

/** The key a ratchet holds. Line numbers move when prose moves; the CLAIM does not. */
function quarantineKey(h) { return h.doc + '|' + h.figure + '|' + h.cite; }

function quarantinedFigures(docs, { withhold, read = readDoc } = {}) {
  const st = quarantinedState(withhold);
  const hits = [];
  /* A DOCUMENT THAT COULD NOT BE READ IS NOT A DOCUMENT THAT IS CLEAN, and skipping it silently
   * would be this rule's own failure mode one layer down: an unreadable file would simply stop being
   * accused, with nothing on the screen to say the scan had a hole in it. */
  const unreadable = [];
  if (!st.withhold) return { hits, unreadable, gate_open: st.open, why: st.why, cannot_answer: true };
  const seen = new Set();
  const push = (h) => { const k = quarantineKey(h); if (!seen.has(k)) { seen.add(k); hits.push(h); } };
  /* READ EVERY DOCUMENT ONCE. The second route below needs the citations of the WHOLE set before it
   * can judge any single paragraph, so the read cannot be folded into one pass per document. */
  const texts = [];
  for (const rel of (docs || liveDocs())) {
    try { texts.push([rel, read(rel)]); }
    catch (e) { unreadable.push({ doc: rel, error: String((e && e.message) || e).split('\n')[0] }); }
  }

  /* ---- ROUTE 1: the citation is in the same paragraph as the figure ---------------------------- */
  const published = new Set();
  for (const [rel, text] of texts) {
    for (const b of paragraphs(text)) {
      const all = citationsIn(b.lines);
      for (const c of all) published.add(c);
      const cites = all.filter(c => st.withhold(c));
      if (!cites.length) continue;
      /* A FIGURE THAT A QUOTABLE ARTIFACT IN THE SAME PARAGRAPH ALSO CARRIES IS NOT A REPUBLICATION.
       * 2026-09-10: two docs/RUNNING-NOTES.md rows were charged with `6,000` out of
       * data/winrate-backtest.json and data/search-decision-profile.json. Both rows ALSO cite
       * data/engine-diff.json, whose `compared` is 6,000 and which the gate does not withhold. That's
       * where the figure came from. Route 2 below already says two owners is a coincidence with a
       * witness; this applies the same rule inside one paragraph. The figure has to be IN the
       * non-withheld artifact. Citing a quotable file that doesn't carry it clears nothing, and
       * tests/test-docs-quarantine.js shows that case red. */
      const free = all.filter(c => !st.withhold(c));
      const quotable = (f) => free.some(c => { const n = artifactNumbers(c); return !!(n && artifactHas(n, f)); });
      const body = b.lines.join('\n');
      for (const f of figuresInText(body)) {
        if (isUniversal(f)) continue;
        if (!isDistinctive(f)) continue;
        if (quotable(f)) continue;
        for (const c of cites) {
          const nums = artifactNumbers(c);
          if (!nums || !artifactHas(nums, f)) continue;
          push({ doc: rel, line: b.start, figure: f.raw, cite: c, cites, via: 'citation',
                 held: st.withhold(c), text: b.lines[0].trim().slice(0, 100) });
          break;
        }
      }
    }
  }

  /* ================================================================================================
   * ROUTE 2: NO CITATION ANYWHERE NEAR THE FIGURE — 2026-09-06.
   * ================================================================================================
   * ROUTE 1 NEEDS THE CITATION AND THE PARAGRAPH IN THE SAME BLOCK, AND THE DOCUMENT WRITTEN FOR THE
   * LEAST TECHNICAL READER IS THE ONE THAT DELIBERATELY CITES NOTHING. `docs/ABRA-deck-plain-english.md`
   * carries 753 figures across 354 paragraphs and exactly FOURTEEN of those paragraphs contain a
   * citation, so 96% of the deck was outside this rule's reach. A gate that cannot see the deck is a
   * gate with a hole in it, and scoring it zero read as a clean bill.
   *
   * DROPPING THE CITATION REQUIREMENT IS NOT THE FIX, AND THAT WAS MEASURED BEFORE IT WAS REJECTED.
   * Scoring every distinctive figure against every withheld artifact gives the deck 40 hits and
   * ABRA-technical-docs 70 — `1,500` occurs in SIXTEEN withheld artifacts and `6,000` in
   * TWENTY-THREE, because those are round run sizes that appear everywhere. That is the coincidence
   * engine `isTokenFragment` above was written to close, rebuilt one rule over.
   *
   * SO THE EVIDENCE IS UNIQUENESS OF ATTRIBUTION, WHICH IS THE SAME BAR `untraceableCensus` USES ONE
   * RULE OVER. A figure is charged only when, across EVERY artifact in data/, exactly ONE contains
   * it — so there is no other source it could have come from — and that artifact is withheld. Two
   * owners is not attribution, it is a coincidence with a witness.
   *
   * AND THE OWNER MUST BE A PUBLISHED SOURCE — an artifact some live document actually cites. Without
   * that clause, `data/_bench-normal.json` and the `_diag*` scratch runs became the unique owner of
   * ordinary four-digit figures and accused six documents of republishing a bench number they had
   * never heard of. The scratch files stay in the DENOMINATOR, where they make attribution stricter;
   * they are just not allowed to be the accuser. Measured: 75 uniquely-attributed hits before that
   * clause, 54 after, and every one of the 21 it removed was a scratch artifact.
   *
   * WHAT IT FINDS, MEASURED: 50 republications that carry no citation at all — `14.757%` out of the
   * MAG weights in four documents, `6,890` out of the leaf backtest in three, `48,274` out of the
   * censoring census, `1,136,845` out of the feature contrast, `960,000` out of the exploitability
   * step probe. THE DECK ITSELF COMES BACK CLEAN, which is a result rather than a silence: it is now
   * a document this rule can see and does not accuse. */
  const owners = uniqueOwners();
  for (const [rel, text] of texts) {
    for (const b of paragraphs(text)) {
      for (const f of figuresInText(b.lines.join('\n'))) {
        if (isUniversal(f)) continue;
        if (!isDistinctive(f)) continue;
        const src = owners(f);
        if (!src || !published.has(src) || !st.withhold(src)) continue;
        push({ doc: rel, line: b.start, figure: f.raw, cite: src, cites: [src], via: 'unique',
               held: st.withhold(src), text: b.lines[0].trim().slice(0, 100) });
      }
    }
  }
  return { hits, unreadable, gate_open: st.open, why: st.why, cannot_answer: false };
}

/** The artifact that is the ONLY one in data/ containing a figure, or null when zero or many do.
 *  Artifacts are listed once and their number sets are cached by `artifactNumbers`. */
function uniqueOwners() {
  /* NOT WRAPPED IN A TRY. An unlistable `data/` gives an EMPTY denominator, which makes every figure
   * unowned and this whole route accuse nobody — a silent default in the permissive direction, and
   * the exact shape `quarantinedState` refuses one function up by returning `cannot_answer` rather
   * than a clean bill. There is no useful recovery: if the artifact directory cannot be read, the
   * citation route above is equally meaningless. Let it throw. */
  /* JSON ONLY, AND THIS WAS MEASURED BEFORE IT WAS DECIDED. The list used to admit data/*.js as well,
   * which changed nothing while the bundles were unparsable. Once bundleJson() could read them, the
   * quarantine clause fell 79 -> 74: data/pory.js is built FROM data/pory-eval.json and became a second
   * 'owner' of PORY's held-out figures, so a withheld number acquired a witness that was a copy of
   * itself. A bundle is the measurement republished for the browser, not a second source of it. */
  const list = fs.readdirSync(D('data'))
    .filter(f => /\.json$/.test(f) && !/^games\./.test(f) && !/\.meta\.json$/.test(f))
    .map(f => 'data/' + f);
  return (f) => {
    let found = null;
    for (const a of list) {
      const nums = artifactNumbers(a);
      if (!nums || !artifactHas(nums, f)) continue;
      if (found) return null;            // two owners is a coincidence with a witness, not a source
      found = a;
    }
    return found;
  };
}

/* ---- THE RUNNING NOTES PAGE, AND WHAT IS OWED TO THE NEXT MAJOR --------------------------------
 *
 * WILL, 2026-09-06: *"we can update the documents every major release and just keep a running notes
 * page in between change the documentation rules"*.
 *
 * The full living-document set now moves on a MAJOR release. `docs/RUNNING-NOTES.md` moves on every
 * change, and it carries the debt in between. That trade is only safe if the debt is COUNTED, because
 * this repository's one recurring failure is a record that outlives what it described — fourteen
 * stale handoffs, a hand-maintained ban list of four, `DECLARED_DIVERGENCE`. *"We will update the
 * documents at the next major"* is that failure in a new costume unless something prints the size of
 * the promise.
 *
 * SO IT IS DERIVED FROM THREE FILES AND TYPED NOWHERE:
 *
 *   the notes page   every `## [X.Y.Z] — date — title` heading is one change that has been recorded
 *   the living docs  the LOWEST version header among the unpinned ones is when they were last folded
 *   CHANGELOG.md     the most recent `X.0.0` entry is the last MAJOR release
 *
 * OWED = every notes entry newer than the documents. It empties itself: the major-release pass bumps
 * the document headers, every entry falls below the new floor, and the count returns to zero with
 * nothing to remember to clear. Same property as the sprint marker that ends by being deleted.
 *
 * PINNED DOCUMENTS ARE EXCLUDED FROM THE FLOOR ON PURPOSE. A pin is a declared statement that a
 * document is deliberately frozen at an old version (`docs/ARCHITECTURE.md` at 1.2), so taking the
 * minimum over pins would peg the floor at 0.1 forever and report every entry ever written as owed —
 * a number so large it says nothing, which is the same as not printing it. */
const NOTES_LOG = 'docs/RUNNING-NOTES.md';

/* THE CAP IS A POLICY NUMBER AND IS THE ONE HAND-TYPED VALUE HERE, SO IT IS ARGUED RATHER THAN
 * ASSERTED. Measured on CHANGELOG.md, 2026-09-06: 266 releases in the 27 days since 5.0.0 (2026-08-10),
 * ~10/day median and 42 on the busiest day. CLAUDE.md records what unbounded drift already cost —
 * documents four days behind code, and the next session mischaracterised the whole model family. Four
 * days is what Will has just traded away, so the bound cannot be four days; it must still be a bound.
 * 100 entries is ~10 working days at the measured cadence.
 *
 * IT IS A GATE, NOT A HINT. `tests/test-docs-current.js` FAILS above it, which blocks the commit, and
 * the only ways out are to do the major-release pass or to raise this constant in a diff somebody can
 * see. That is the whole difference between a deferral and a silent abandonment. */
const OWED_CAP = 100;
const OWED_WARN = Math.floor(OWED_CAP / 2);

/* WHAT COUNTS AS A CHANGE THAT MUST BE RECORDED — ONE IMPLEMENTATION, TWO CALLERS.
 *
 * `.githooks/pre-commit` judges the STAGED paths and `tests/test-docs-current.js` judges the paths in
 * commits made since the notes page last moved. They must never disagree about what a recordable
 * change is, and this repository's own rule says why: two files that both decide one fact will
 * disagree eventually, and the disagreement will be invisible because both keep working. The hook is
 * sh and cannot import this, so it SHELLS OUT to `--note-check` rather than carrying a second regex —
 * the same reason `status.js` shells out to `provenance.js`.
 *
 * NOT recordable, and each exclusion has a reason:
 *   docs/_reports/   a findings record, historical by construction; writing one is not a change
 *   docs/_inbox/ _outbox/   the Cowork handoff folders; a draft is a proposal, not a landed change
 *   docs/archive/    moving a file into history changes nothing a reader takes as current
 *   the notes page itself   or the rule would be that touching it obliges you to touch it
 *   data/            a generator re-running is not a documentation event; the hook already says so */
const RECORDABLE = /^(?:engine|tests|web|build)\/|^docs\/|^(?:CHANGELOG|README|CLAUDE)\.md$/;
const NOT_RECORDABLE = /^docs\/(?:_reports|_inbox|_outbox|archive)\//;
function recordableChanges(paths) {
  return [...new Set(paths.map(p => String(p).replace(/\\/g, '/').trim()).filter(Boolean))]
    .filter(p => p !== NOTES_LOG)
    .filter(p => RECORDABLE.test(p) && !NOT_RECORDABLE.test(p))
    .sort();
}

/** Compare two dotted versions of two or three parts. `1.2` sorts below `1.2.1`. */
function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** The most recent `## [X.0.0]` entry in the CHANGELOG — the last MAJOR release, read not typed. */
function lastMajor() {
  const ch = slurp(D('CHANGELOG.md'));
  const m = ch.match(/^##\s*\[(\d+\.0\.0)\][^\n]*?(\d{4}-\d{2}-\d{2})?\s*$/m);
  return m ? { version: m[1], date: m[2] || null } : null;
}

/** Every released version in the CHANGELOG, newest first, as written. Read, never typed. */
function changelogVersions() {
  const ch = slurp(D('CHANGELOG.md'));
  return [...ch.matchAll(/^##\s*\[(\d+\.\d+\.\d+)\]/gm)].map(m => m[1]);
}

/**
 * Which part of the version moved between two releases. `null` when there is nothing to compare
 * against, which is a state to PRINT and never a state to pass silently.
 */
function bumpKind(prev, next) {
  if (!prev || !next) return null;
  const a = String(prev).split('.').map(Number), b = String(next).split('.').map(Number);
  if (b[0] !== a[0]) return 'major';
  if (b[1] !== a[1]) return 'minor';
  if (b[2] !== a[2]) return 'patch';
  return 'none';
}

/** The declared pins, read from the baseline the gate already maintains. */
function versionPins() {
  const f = D('data', 'docs-currency-baseline.json');
  if (!fs.existsSync(f)) return {};
  return JSON.parse(fs.readFileSync(f, 'utf8')).version_pins || {};
}

/** `## [5.267.0] — 2026-09-06 — title` rows in the notes page, newest first as written. */
function notesEntries({ read = readDoc } = {}) {
  if (!fs.existsSync(D(NOTES_LOG))) return null;
  const lines = read(NOTES_LOG).split('\n');
  const out = [];
  /* A FENCED BLOCK IS THE TEMPLATE, NOT A ROW. The page carries a copy-this-shape example inside
   * ```, and counting it would mean the backlog reports a release that never happened — the same
   * mistake `figuresInText` already refuses one function up, for the same reason. */
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    if (fenceOpen(lines[i])) { fenced = !fenced; continue; }
    if (fenced) continue;
    /* AN `[Unreleased]` HEADING COUNTS AS OWED, and the first draft of this said the opposite. A row
     * written before the release that carries it is still a change the next major has to fold in, and
     * if it is not counted then a heading nobody remembers to rename is a debt that never appears —
     * which is the precise failure this whole clause exists to refuse. Counting it is the
     * conservative direction: the worst case is that the backlog reads one high for a few hours. */
    const m = lines[i].match(/^##\s*\[(Unreleased|\d+\.\d+(?:\.\d+)?)\]\s*—?\s*(\d{4}-\d{2}-\d{2})?\s*—?\s*(.*)$/i);
    if (m) out.push({
      version: /^unreleased$/i.test(m[1]) ? null : m[1],
      unreleased: /^unreleased$/i.test(m[1]),
      date: m[2] || null, title: m[3].trim(), line: i + 1,
    });
  }
  /* THE BODY OF A ROW IS EVERYTHING UP TO THE NEXT ROW, so the two declared fields below are read
   * from the row that wrote them and never from the page. Attached here rather than in a second pass
   * because a second walk over the same file is a second place to get the fencing wrong. */
  for (let k = 0; k < out.length; k++) {
    const from = out[k].line, to = k + 1 < out.length ? out[k + 1].line - 1 : lines.length;
    const body = lines.slice(from, to).join('\n');
    out[k].basis = basisOf(body);
    out[k].supersedes = supersedesOf(body);
  }
  return out;
}

/* ---- THE TWO DECLARED FIELDS A ROW CARRIES, AND WHY THEY ARE DECLARED ------------------------
 *
 * `Basis.` IS A JUDGEMENT AND IS WRITTEN DOWN AS ONE. Nothing in this repository can decide whether
 * a new figure SUPERSEDES the old one or merely REFINES it — that is a claim about what the two
 * numbers mean, and the instrument that comes closest, `engine/arms_comparable.js`, answers it only
 * for one artifact. So the row declares it in one word and this function reads the word. The failure
 * this project keeps paying for is a judgement nobody wrote down, not a judgement as such.
 *
 * ABSENT READS AS UNCHANGED, AND THE ABSENCE IS PRINTED. Failing on a missing line would fail every
 * row written before this rule existed, and back-filling them would be editing the log to agree with
 * today — the one thing the page's own preamble forbids. So the soft edge is deliberate and it is
 * VISIBLE: `owedReport()` prints `basis not stated` for any owed row that does not say. The hard
 * edges are elsewhere — `OWED_CAP`, and the two clauses in `tests/test-docs-current.js` that refuse
 * a basis change released as anything but `X.0.0` and an `X.0.0` released with no basis change. */
function basisOf(body) {
  const m = body.match(/^\s*[-*]?\s*\*\*Basis\.?\*\*\s*(.*)$/mi);
  if (!m) return { stated: false, changed: false, text: null };
  const text = m[1].trim();
  return { stated: true, changed: /\bchanged\b/i.test(text) && !/\bunchanged\b/i.test(text), text };
}

/* `Supersedes.` IS ALREADY IN THE TEMPLATE and already has a canonical vocabulary: either the word
 * "Nothing", or a strikethrough plus the word "retracted", which is the form the derived retraction
 * registry reads. This reports which, so a PATCH release can be checked against it. */
function supersedesOf(body) {
  const m = body.match(/^\s*[-*]?\s*\*\*Supersedes\.?\*\*\s*([\s\S]*?)(?=\n\s*[-*]\s*\*\*|\n##|$)/mi);
  if (!m) return { stated: false, nothing: false, retracts: false, text: null };
  const text = m[1].trim();
  return {
    stated: true,
    nothing: /^nothing\b/i.test(text),
    retracts: /~~[^~]+~~/.test(text) && /\bretract/i.test(text),
    text: text.split('\n')[0].slice(0, 120),
  };
}

/** The version the living documents were last brought current at: the lowest UNPINNED header. */
function documentedAt() {
  const pins = versionPins();
  let low = null;
  for (const d of livingDocs()) {
    if (d.replace(/\\/g, '/') === NOTES_LOG) continue;    // the log tracks the top, not the pass
    if (pins[d]) continue;                                 // a pin is a declared freeze, not drift
    const v = versionHeader(readDoc(d));
    if (!v) continue;
    if (!low || cmpVersion(v.version, low.version) < 0) low = { version: v.version, doc: d };
  }
  return low;
}

/**
 * What the next major release owes. Everything here is read; nothing is remembered.
 *   missing          the notes page does not exist — the rule is not optional, so this is a failure
 *   owed             notes entries newer than the documents' floor
 *   over / warn      against OWED_CAP
 */
function owedToNextMajor() {
  const top = changelogTop();
  const maj = lastMajor();
  const entries = notesEntries();
  if (entries === null) return { missing: true, notes: NOTES_LOG, top, lastMajor: maj, cap: OWED_CAP };
  const floor = documentedAt();
  const owed = entries.filter(e => e.unreleased || !floor || cmpVersion(e.version, floor.version) > 0);
  const dates = owed.map(e => e.date).filter(Boolean).sort();
  const behind = floor && maj ? cmpVersion(floor.version, maj.version) < 0 : false;
  return {
    missing: false, notes: NOTES_LOG, top, lastMajor: maj,
    documented_at: floor, entries: entries.length, owed,
    oldest_owed: dates[0] || null,
    documents_behind_last_major: behind,
    cap: OWED_CAP, warn: OWED_WARN,
    over: owed.length > OWED_CAP, warning: owed.length > OWED_WARN && owed.length <= OWED_CAP,
  };
}

/* ---- WHAT MAKES A RELEASE MAJOR — THE POLICY, AS THREE REFUSALS ------------------------------
 *
 * WILL, 2026-09-06: *"whatever the best practices are study them and implement them and document
 * them."* The definition and its citations are in CLAUDE.md; this function is only the part a
 * machine can decide.
 *
 * THE DECLARED API IS THE PUBLISHED FIGURES. SemVer 2.0.0 clause 1 requires a public API and says it
 * "could be declared in the code itself or exist strictly in documentation". ABRA ships no library
 * and nobody pins a range against it; what a reader depends on is the numbers in the white paper,
 * the deck, `docs/SUMMARY.md` and `docs/MODELS.md`. So clauses 6, 7 and 8 are read against those:
 *   PATCH   an internal fix that moves no published figure          (clause 6)
 *   MINOR   a published figure moves, under an unchanged basis      (clause 7)
 *   MAJOR   the basis moves, so old and new cannot be linked        (clause 8)
 *
 * THE THREE REFUSALS BELOW ARE THE ONLY MECHANICAL PART, and each is asymmetric on purpose:
 *
 *   basis_change_not_major   a row declaring the basis CHANGED that did not release as `X.0.0`.
 *   major_without_basis      an `X.0.0` release with no row declaring a basis change. Without this
 *                            a major means whatever the person cutting it felt, which is the state
 *                            this whole exercise exists to end.
 *   patch_moved_a_figure     a PATCH bump whose row supersedes a figure. The reverse — a MINOR that
 *                            moved nothing — is NOT an error: SemVer clause 7 says MINOR "MAY be
 *                            incremented if substantial new functionality or improvements are
 *                            introduced within the private code". Only one direction can lie.
 *
 * A ROW THAT CANNOT BE MATCHED TO A RELEASE IS REPORTED, NEVER PASSED. `unmatched` carries the
 * versions this could not check, because a clause that quietly checks nothing is this repository's
 * signature failure and the point of `ok(!gitErr, ...)` one file over. */
function majorPolicy({ entries: injEntries, versions: injVersions } = {}) {
  const entries = injEntries || notesEntries();
  if (entries === null) {
    return { missing: true, violations: [], unmatched: [], top: null, top_bump: null, checked: 0 };
  }
  const versions = injVersions || changelogVersions();
  const released = new Set(versions);
  const top = versions[0] || null;
  const top_bump = bumpKind(versions[1], versions[0]);
  const byVersion = new Map();
  for (const e of entries) if (e.version && !byVersion.has(e.version)) byVersion.set(e.version, e);

  const violations = [], unmatched = [];
  let checked = 0;

  for (const e of entries) {
    if (!e.version) continue;                       // an `[Unreleased]` row has no bump to judge yet
    if (!released.has(e.version)) { unmatched.push(e.version); continue; }
    checked++;
    const isMajor = /^\d+\.0\.0$/.test(e.version);
    if (e.basis.changed && !isMajor) violations.push({
      kind: 'basis_change_not_major', version: e.version, line: e.line,
      why: `the row declares the basis CHANGED and released as ${e.version}. A basis change is a `
         + 'MAJOR: the old figures cannot be linked to the new ones, so the documents have to be '
         + 'rewritten rather than restamped. Release it as X.0.0 and fold the full set in.',
    });
    if (isMajor && !e.basis.changed) violations.push({
      kind: 'major_without_basis', version: e.version, line: e.line,
      why: `${e.version} is a MAJOR and its row does not declare what basis changed. State it — `
         + '`**Basis.** CHANGED — <what a reader can no longer be told>` — or release it as a MINOR.',
    });
  }

  /* THE PATCH CLAUSE IS ABOUT THE TOP RELEASE ONLY, because that is the one whose predecessor is
   * unambiguous. Walking the whole CHANGELOG would judge 267 historical bumps against a rule that
   * did not exist when they were written, which is a gate guaranteed to be red on arrival. */
  if (top_bump === 'patch') {
    const row = byVersion.get(top);
    if (!row) unmatched.push(top + ' (top, PATCH bump)');
    else if (row.supersedes.retracts || (row.supersedes.stated && !row.supersedes.nothing)) violations.push({
      kind: 'patch_moved_a_figure', version: top, line: row.line,
      why: `${top} is a PATCH bump and its row supersedes a figure: "${row.supersedes.text}". A `
         + 'PATCH here means NO published figure moved. If one did, it is a MINOR.',
    });
  }
  return { missing: false, violations, unmatched, top, top_bump, checked, entries: entries.length };
}

/* ---- THE RED DEMONSTRATION FOR THE POLICY, one case per refusal and one against each ------------
 *
 * SYNTHETIC ROWS THROUGH THE SHIPPING FUNCTION, not through a reimplementation of it beside the
 * test. `engine/quarantine.js` learned that the expensive way: its first selftest asserted the gate
 * rule against a five-line copy, and a deliberate break left the copy at 210 passed, 0 failed.
 *
 * Every refusal carries its opposite. Without the `-is-fine` half, each clause could be satisfied by
 * a function that refuses everything, which is the same nothing as a function that refuses nothing. */
const MAJOR_POLICY_CASES = [
  { id: 'basis-change-released-as-a-minor-is-refused',
    why: 'THE CENTRAL CASE. A basis change means the old figures cannot be linked to the new ones, '
       + 'so the documents must be rewritten rather than restamped. Releasing it as a MINOR defers a '
       + 'rewrite that the backlog cannot express.',
    rows: [{ version: '5.267.0', basis: { stated: true, changed: true, text: 'CHANGED — the gate opened' },
             supersedes: { stated: true, nothing: false, retracts: true, text: '~~27~~ retracted' } }],
    versions: ['5.267.0', '5.266.0'], expect: ['basis_change_not_major'] },

  { id: 'basis-change-released-as-a-major-is-fine',
    why: 'The opposite. Without it the clause above is satisfied by refusing every row.',
    rows: [{ version: '6.0.0', basis: { stated: true, changed: true, text: 'CHANGED — the gate opened' },
             supersedes: { stated: true, nothing: false, retracts: true, text: '~~27~~ retracted' } }],
    versions: ['6.0.0', '5.267.0'], expect: [] },

  { id: 'a-major-that-names-no-basis-change-is-refused',
    why: 'Without this a major means whatever the person cutting it felt that evening, which is the '
       + 'judgement-nobody-wrote-down failure this rule exists to end. It also refuses the specific '
       + 'shortcut of bumping X.0.0 to empty a backlog.',
    rows: [{ version: '6.0.0', basis: { stated: false, changed: false, text: null },
             supersedes: { stated: true, nothing: true, retracts: false, text: 'Nothing.' } }],
    versions: ['6.0.0', '5.267.0'], expect: ['major_without_basis'] },

  { id: 'a-patch-that-supersedes-a-figure-is-refused',
    why: 'SemVer 2.0.0 clause 6: a patch is an internal fix. Read against an API that IS the '
       + 'published figures, a release that moved one is not a patch.',
    rows: [{ version: '5.266.1', basis: { stated: true, changed: false, text: 'unchanged' },
             supersedes: { stated: true, nothing: false, retracts: true, text: '~~27~~ retracted' } }],
    versions: ['5.266.1', '5.266.0'], expect: ['patch_moved_a_figure'] },

  { id: 'a-patch-that-moves-no-figure-is-fine',
    why: 'The store-sharding and ledger-PDF passes of 2026-09-06 are exactly this shape: real work, '
       + 'no published figure moved. If this case failed the rule would forbid the PATCH it defines.',
    rows: [{ version: '5.266.1', basis: { stated: true, changed: false, text: 'unchanged' },
             supersedes: { stated: true, nothing: true, retracts: false, text: 'Nothing.' } }],
    versions: ['5.266.1', '5.266.0'], expect: [] },

  { id: 'a-minor-that-moves-no-figure-is-fine',
    why: 'THE ASYMMETRY, PINNED. SemVer clause 7 says MINOR "MAY be incremented if substantial new '
       + 'functionality or improvements are introduced within the private code". Only the patch '
       + 'direction can lie, so only the patch direction is refused.',
    rows: [{ version: '5.267.0', basis: { stated: true, changed: false, text: 'unchanged' },
             supersedes: { stated: true, nothing: true, retracts: false, text: 'Nothing.' } }],
    versions: ['5.267.0', '5.266.0'], expect: [] },

  { id: 'a-row-ahead-of-its-release-is-reported-not-passed',
    why: 'A row is often written before the version that carries it. That row cannot be judged, and '
       + 'a clause that silently checks nothing is what `ok(!gitErr, ...)` exists to refuse.',
    rows: [{ version: '9.9.9', basis: { stated: true, changed: true, text: 'CHANGED — anything' },
             supersedes: { stated: true, nothing: true, retracts: false, text: 'Nothing.' } }],
    versions: ['5.266.0'], expect: [], unmatched: 1 },
];

function majorPolicyProof() {
  return MAJOR_POLICY_CASES.map(c => {
    const rows = c.rows.map((r, i) => ({ unreleased: false, date: null, title: c.id, line: i + 1, ...r }));
    const got = majorPolicy({ entries: rows, versions: c.versions });
    const kinds = got.violations.map(v => v.kind).sort();
    const want = [...c.expect].sort();
    const unmatched = c.unmatched || 0;
    return { id: c.id, why: c.why, expected: want, got: kinds, unmatched_expected: unmatched,
             unmatched_got: got.unmatched.length,
             holds: JSON.stringify(kinds) === JSON.stringify(want) && got.unmatched.length === unmatched };
  });
}

/** The printable backlog. Never throws — a caller printing state must not die on a missing file. */
function owedReport() {
  const o = owedToNextMajor();
  const L = [];
  if (o.missing) {
    L.push(`  DOCUMENTATION DEBT — ${o.notes} IS ABSENT.`);
    L.push('    The full living-doc set moves on a major release and the notes page carries every');
    L.push('    change in between. Without it nothing records what the next major owes. Recreate it.');
    return L.join('\n');
  }
  const at = o.documented_at ? `${o.documented_at.version} (lowest unpinned header: ${o.documented_at.doc})` : 'NOT DERIVED';
  L.push(`  DOCUMENTATION DEBT — ${o.owed.length} of ${o.cap} notes entries owed to the next major`
    + (o.over ? '   *** OVER CAP ***' : o.warning ? '   (past half the cap)' : ''));
  L.push(`    documents last folded at ${at}`);
  L.push(`    CHANGELOG top ${o.top}; last major ${o.lastMajor ? o.lastMajor.version + (o.lastMajor.date ? ' — ' + o.lastMajor.date : '') : 'NOT DERIVED'}`);
  if (o.documents_behind_last_major) {
    L.push('    THE DOCUMENTS ARE BEHIND THE LAST MAJOR RELEASE. A major is exactly when the full set');
    L.push('    is due, so this is the pass that was skipped, not drift that is allowed to accumulate.');
  }
  if (o.oldest_owed) L.push(`    oldest unfolded note: ${o.oldest_owed}`);
  /* THE BASIS IS PRINTED PER ROW, INCLUDING WHEN IT IS NOT STATED. An unstated basis reads as
   * unchanged, which is the safe default and also the one that can hide a major — so it is shown
   * rather than assumed silently. A judgement that is cheap and visible is the whole design. */
  const basisMark = (e) => (e.basis && e.basis.changed ? '[BASIS CHANGED] '
    : e.basis && e.basis.stated ? '' : '[basis not stated] ');
  for (const e of o.owed.slice(0, 12)) L.push(`      ${String(e.version || 'Unreleased').padEnd(10)} `
    + `${(e.date || '?').padEnd(10)}  ${basisMark(e)}${e.title.slice(0, 74)}`);
  if (o.owed.length > 12) L.push(`      ... and ${o.owed.length - 12} more (node engine/docs_scan.js --owed)`);
  if (!o.owed.length) L.push('    nothing owed — the documents are level with the notes page.');
  /* WHAT THE CAP ACTUALLY FORCES, SAID WHERE IT IS COUNTED. Going over it owes a DOCUMENT PASS, not
   * a major: the backlog empties when the document headers move, at any version. A major is a
   * different obligation with a different trigger, and conflating the two invites a version bumped
   * to X.0.0 purely to clear a backlog — which would empty the word of the meaning it just gained. */
  if (o.over || o.warning) L.push('    the cap owes a DOCUMENT PASS at any version, not a major. '
    + 'A major is declared by a basis change.');
  return L.join('\n');
}

module.exports = {
  D, liveDocs, livingDocs, archiveDocs, readDoc, versionHeader, changelogTop,
  NOTES_LOG, OWED_CAP, OWED_WARN, cmpVersion, lastMajor, versionPins, recordableChanges,
  notesEntries, documentedAt, owedToNextMajor, owedReport,
  changelogVersions, bumpKind, basisOf, supersedesOf, majorPolicy,
  majorPolicyProof, MAJOR_POLICY_CASES, stripCR, crlfProof,
  quarantinedFigures, quarantineKey,
  figuresIn, figuresInText, fenceOpen, lexingProof, LEXING_CASES,
  isUniversal, artifactNumbers, artifactObject, bundleJson, bundleProof, BUNDLE_CASES,
  walkNumbers, resolveField, fieldCitationsIn, sentencesOf, fieldClaims, citationProof, CITATION_CASES,
  changelogDates, stampedDate, headingDates, artifactDate,
  artifactHas, paragraphs, citationsIn,
  retractionRegistry, retractionViolations, citationMismatches, untraceableCensus,
  isDistinctive, sigFigs, truncateTo, restatesFigure, retractionProof, RETRACTION_CASES,
  archiveState, supersededHeader, QUALIFIED,
};

/* ---- CLI -------------------------------------------------------------------------------------- */
if (require.main === module) {
  /* `--owed` FIRST AND ALONE. The full census below reads every document and every artifact under
   * data/ and takes seconds; the backlog reads three files. A reader asking "how far behind are the
   * documents" must get an answer cheap enough to ask often, or they will stop asking. */
  /* `--note-check <path>...` — the decision `.githooks/pre-commit` asks before letting a commit
   * through. Exit 1 means: this commit changes something a reader reads and records nothing. */
  if (process.argv.includes('--note-check')) {
    const paths = process.argv.slice(process.argv.indexOf('--note-check') + 1);
    const need = recordableChanges(paths);
    const recorded = paths.some(p => String(p).replace(/\\/g, '/').trim() === NOTES_LOG);
    if (!need.length) { console.log('note-check: nothing recordable in this change set'); process.exit(0); }
    if (recorded) { console.log(`note-check: ${need.length} recordable path(s), and ${NOTES_LOG} moves with them`); process.exit(0); }
    console.log(`note-check: ${need.length} recordable path(s) and NOTHING recorded in ${NOTES_LOG}`);
    for (const p of need.slice(0, 10)) console.log('    ' + p);
    if (need.length > 10) console.log(`    ... and ${need.length - 10} more`);
    process.exit(1);
  }
  if (process.argv.includes('--owed')) {
    const o = owedToNextMajor();
    if (process.argv.includes('--json')) console.log(JSON.stringify(o, null, 2));
    else console.log(owedReport());
    process.exit(o.missing || o.over ? 1 : 0);
  }
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
    /* SCANNED OVER `liveDocs()`, NOT `livingDocs()`, AND THE DIFFERENCE IS THE DEFECT ITSELF.
     * `livingDocs()` is the version-HEADERED set; `docs/WEB.md` carries no header and is precisely
     * where the withheld figures were republished. `data/docs-currency-baseline.json` already says
     * what an unversioned file is exempt from — *"EXEMPT FROM RULE 1 ONLY - they are still scanned
     * by the retracted-number rules"* — so the content rules cover every live document. */
    quarantined_figures: quarantinedFigures(liveDocs()),
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
  for (const h of report.citation_mismatches) console.log(`  ${h.doc}:${h.line}  ${h.figure}  not in ${h.cites.join(', ')}`
    + (h.field ? `  (field ${h.field}${h.expected !== undefined ? ' reads ' + h.expected : ''})` : '') + `\n      ${h.text}`);
  const predates = report.citation_mismatches.predates || [];
  const predPer = {};
  for (const h of predates) predPer[h.doc] = (predPer[h.doc] || 0) + 1;
  console.log(`\nfigures in dated blocks whose cited artifact was regenerated after the block (reported, not judged): ${predates.length}`);
  for (const [d, n] of Object.entries(predPer).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${d}`);
  const qf = report.quarantined_figures;
  console.log(`\nfigures sourced from a QUARANTINED artifact: `
    + (qf.cannot_answer ? 'CANNOT ANSWER' : qf.hits.length) + `   [${qf.why}]`);
  for (const h of qf.hits.slice(0, 40)) {
    console.log(`  ${h.doc}:${h.line}  ${h.figure}  <- ${h.cite}\n      ${h.text}`);
  }
  if (qf.hits.length > 40) console.log(`  (+${qf.hits.length - 40} more — --json for the list)`);
  console.log(`\nuntraceable figures: ${census.total} across ${Object.keys(census.per).length} documents`);
  const top = Object.entries(census.per).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [d, n] of top) console.log(`  ${String(n).padStart(4)}  ${d}`);
}
