/* build_archive_index.js — docs/archive/INDEX.md, DERIVED from the headers of what is in there.
 *
 *   node build/build_archive_index.js           rewrite docs/archive/INDEX.md
 *   node build/build_archive_index.js --check   exit 1 if it is stale (for CI / the docs test)
 *
 * WHY THIS EXISTS
 * ---------------
 * The archive is not a bin. It is the PROVENANCE RECORD for a paper this project intends to publish:
 * "we believed X, here is why, here is what broke it, here is what replaced it." That trail is the
 * part almost nobody can produce, so the index over it has to be worth as much as the documents.
 *
 * A HAND-TYPED INDEX ROTS EXACTLY LIKE THE DOCUMENTS DID. That is the whole lesson of this repo:
 * `docs/HANDOFF-*.md` were typed by hand at the end of a session and were stale within a day; the
 * 2026-08-04 one said "172 tags, 118 unprobed" against an artifact holding 176 and 123, and nobody
 * mistyped anything. Prose cannot track a corpus. So this reads the archived files themselves and
 * carries their OWN words forward. Nothing here is authored; every cell is a quotation.
 *
 * THE UNDECLARED SECTION IS THE POINT, NOT AN OVERSIGHT. Eight files were in docs/archive/ before
 * the header convention existed. They are listed with the fields MISSING rather than with fields
 * invented for them, because an index that silently fills a gap is how a check stops being a check.
 * The pressure to fix them belongs on the list, not on somebody's memory.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ARCH = path.join(ROOT, 'docs', 'archive');
const OUT = path.join(ARCH, 'INDEX.md');
const CHECK = process.argv.includes('--check');

/* The header this reads is the one written on the way in — see docs/archive/*.md. It is a blockquote
 * of labelled bullets, so a field is `> - **Label:** value` and may wrap onto continuation lines. */
const FIELDS = { 'Claimed': 'claimed', 'Written': 'written', 'Replaced by': 'replaced', 'Retracted inside': 'retracted' };

function parseHeader(text) {
  const out = { claimed: null, written: null, replaced: null, retracted: null, archived: null };
  const lines = text.split('\n');
  let cur = null;
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const L = lines[i];
    if (!/^\s*>/.test(L)) { if (cur && L.trim() === '') break; continue; }
    const body = L.replace(/^\s*>\s?/, '');
    const m = body.match(/^\s*-\s*\*\*([^:*]+):\*\*\s*(.*)$/);
    if (m && FIELDS[m[1].trim()]) { cur = FIELDS[m[1].trim()]; out[cur] = m[2].trim(); continue; }
    if (cur && body.trim()) { out[cur] += ' ' + body.trim(); continue; }
    const a = body.match(/\*\*ARCHIVED\s+(\d{4}-\d{2}-\d{2})/);
    if (a) out.archived = a[1];
  }
  return out;
}

/* The legacy declaration the docs-currency test understands: `> **SUPERSEDED** by `docs/X.md``.
 * Kept so a file carrying only that form still appears in the index with its replacement. */
const SUPERSEDED_RE = /^\s*>?\s*\*{0,2}SUPERSEDED\*{0,2}\b[^\n]*?\bby\b\s*[`\[]?([A-Za-z0-9_./\-]+\.(?:md|json|js|py))/im;

/* The date a document DESCRIBES, which is what a provenance trail is ordered by — not the mtime,
 * which records when somebody last touched the file. Filename first because these are dated
 * documents; the `Written:` field second; nothing invented if neither says. */
function docDate(rel, h) {
  const f = (rel.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
  if (f) return f;
  const w = h.written && (h.written.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
  return w || null;
}

const files = fs.readdirSync(ARCH).filter(f => f.endsWith('.md') && f !== 'INDEX.md').sort();
const rows = files.map(f => {
  const text = fs.readFileSync(path.join(ARCH, f), 'utf8');
  const h = parseHeader(text);
  const sup = (text.split('\n').slice(0, 15).join('\n').match(SUPERSEDED_RE) || [])[1] || null;
  return {
    file: f,
    declared: !!(h.claimed || sup),
    date: docDate(f, h),
    pdf: fs.existsSync(path.join(ARCH, f.replace(/\.md$/, '.pdf'))),
    lines: text.split('\n').length,
    ...h,
    replaced: h.replaced || (sup ? '`' + sup + '`' : null),
  };
});

const declared = rows.filter(r => r.declared).sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.file.localeCompare(b.file));
const undeclared = rows.filter(r => !r.declared);
/* A DOCUMENT IS ON THE RETRACTION LIST UNLESS ITS HEADER OPENS WITH "None". Deliberately that way
 * round: the first version keyed on the field STARTING with "YES" and silently dropped
 * HANDOFF-2026-08-04.md, whose header opens "Two things need saying" and then retracts two figures.
 * A list that quietly omits an entry because of how a sentence begins is the failure this whole
 * directory documents. Default to listing it; only an explicit "None" takes a file off. */
const withRetraction = declared.filter(r => r.retracted && !/^\s*none\b/i.test(r.retracted));

const P = [];
const W = s => P.push(s);
W('# The ABRA archive — index');
W('');
W('**GENERATED by `build/build_archive_index.js` from the headers of the files in `docs/archive/`.');
W('Do not hand-edit: a typed index rots exactly like the documents it points at, which is the whole');
W('reason this directory exists.** Re-run the generator instead.');
W('');
W('This is a **provenance record**, not a bin. Each file below states what it claimed, when, what');
W('replaced it, and which of its figures are retracted — so a claim can be traced from the moment it');
W('was believed to the measurement that ended it. **Nothing in here is current state.**');
W('`node engine/status.js` is the state.');
W('');
W(`${rows.length} archived documents · ${declared.length} declare their provenance · ` +
  `${undeclared.length} predate the convention · ${withRetraction.length} carry a retracted figure · ` +
  `${rows.filter(r => r.pdf).length} have the PDF beside them.`);
W('');
W('---');
W('');
W('## Documents that carry a retracted figure');
W('');
if (!withRetraction.length) { W('None.'); } else {
  W('Read the header before quoting anything out of these.');
  W('');
  for (const r of withRetraction) {
    W(`- **[${r.file}](${r.file})** — ${r.retracted}`);
  }
}
W('');
W('---');
W('');
W('## The trail, newest first');
W('');
for (const r of declared) {
  W(`### ${r.date || 'undated'} — [${r.file}](${r.file})${r.pdf ? ` · [pdf](${r.file.replace(/\.md$/, '.pdf')})` : ' · **no pdf**'}`);
  W('');
  W(`- **Claimed:** ${r.claimed || '_not declared_'}`);
  W(`- **Written:** ${r.written || '_not declared_'}`);
  W(`- **Replaced by:** ${r.replaced || '_not declared_'}`);
  W(`- **Retracted inside:** ${r.retracted || '_not declared_'}`);
  W('');
}
W('---');
W('');
W('## Predating the header convention — provenance NOT declared');
W('');
if (!undeclared.length) { W('None. Every archived document declares its provenance.'); } else {
  W('These were archived before a header was required. **The fields are missing, not empty** — nothing');
  W('below has been inferred on their behalf. Each one needs the same header the others carry:');
  W('what it claimed, when it was written, what replaced it, and any figure in it that is retracted.');
  W('');
  W('| document | lines | pdf |');
  W('|---|---:|---|');
  for (const r of undeclared) W(`| [${r.file}](${r.file}) | ${r.lines} | ${r.pdf ? 'yes' : 'no'} |`);
}
W('');

const body = P.join('\n');
const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';

if (CHECK) {
  if (before !== body) {
    console.error('docs/archive/INDEX.md is STALE — run: node build/build_archive_index.js');
    process.exit(1);
  }
  console.log(`docs/archive/INDEX.md is current (${rows.length} documents, ${undeclared.length} undeclared)`);
  process.exit(0);
}

fs.writeFileSync(OUT, body);
console.log(`docs/archive/INDEX.md — ${rows.length} documents, ${declared.length} declared, ` +
  `${undeclared.length} undeclared, ${withRetraction.length} carrying a retracted figure`);
