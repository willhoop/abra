/* build_pdfs.js — every document has a current PDF, and the list is not typed anywhere.
 *
 *   node build/build_pdfs.js          rebuild any PDF older than its source
 *   node build/build_pdfs.js --all    rebuild everything regardless
 *   node build/build_pdfs.js --check  report what is stale or missing, build nothing
 *
 * WHY THIS EXISTS
 * ---------------
 * PDFs are what actually gets read. Markdown is the source — diffable, editable, the thing git can
 * show a change in — but nobody reads a diff to find out what a model does.
 *
 * Until now the PDFs were built by naming each one on the command line, which had two failures. The
 * mapping from source to output was **typed by hand every time** (`docs/DEFENSE.md` →
 * `docs/ABRA-Defense.pdf`), which is the hand-maintained state S13 forbids, in the publishing step
 * of a project whose whole discipline is that documents track the code. And because the list was
 * typed, it only ever covered the six documents somebody remembered: **23 of 36 markdown documents
 * had no PDF at all**, including ARCHITECTURE.md, MODELS.md, BACKLOG.md and THEORY.md.
 *
 * So the list is derived: every `docs/*.md` gets `docs/<same name>.pdf`. Nothing to remember, and a
 * new document is covered by existing.
 *
 * STALENESS IS THE POINT. A PDF older than its markdown is a document that says something the
 * project no longer believes, presented in the format people actually read. `--check` reports those
 * without building, so CI can fail on a stale document the same way it fails on a stale artifact.
 *
 * A DIVISION LEDGER IS A WORKING DOCUMENT AND GETS NO PDF — WILL, 2026-09-06
 * -------------------------------------------------------------------------
 * The rule above says PDFs are what actually gets read. That is true of a DELIVERABLE — the white
 * paper, the deck, the technical docs, SUMMARY. It is false of a division ledger, which is an
 * append-only working record read in the editor by the division that writes it, restamped by
 * `node engine/status.js --write`, and never handed to anybody as a document.
 *
 * The cost of pretending otherwise was measured on 2026-09-06 (docs/_reports/2026-09-06-repo-cleanup.md):
 * the five ledger PDFs are 132.4 MB of a 524 MB pack — 25% of the repository's whole history — and
 * `docs/ENGINE.pdf` alone is 108.4 MB across ten rebuilds, the single largest object class here.
 * PDFs do not delta-compress, so every rebuild pays close to full price again: 16.6 MB of pack per
 * pass over the five, 13.9 MB of it ENGINE. That is what was buying nothing.
 *
 * WHICH DOCUMENTS ARE LEDGERS IS DERIVED, NOT TYPED. The division list IS `.claude/agents/*.md` —
 * the same source `engine/orient.js` reads, for the same reason: `docs/DIVISIONS.md` said "Four
 * divisions" for nineteen days after WEB was added. A sixth division's ledger is excluded here on
 * the day its agent file appears, with no edit to this file.
 *
 * AND IT FAILS LOUDLY IF THAT DERIVATION GOES ABSENT. An unreadable or empty `.claude/agents/`
 * would silently restore a 13.9 MB-per-bump build and report success — this project's signature
 * failure. It throws instead, and the excluded set is PRINTED on every run so the exclusion can
 * prove it ran.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const ALL = process.argv.includes('--all');
const CHECK = process.argv.includes('--check');

/* Legacy output names, kept because published links point at them. This is the ONE place the
 * exceptions live, rather than being retyped into a shell command each release. Anything not listed
 * here builds to its own name, which is what every new document should do. */
const LEGACY = {
  'DEFENSE.md': 'ABRA-Defense.pdf',
  'METHODOLOGY.md': 'ABRA-Methodology.pdf',
  'ORIENTATION.md': 'ABRA-Orientation.pdf',
};

function outputsFor(md) {
  const out = [path.join(DOCS, md.replace(/\.md$/, '.pdf'))];
  if (LEGACY[md]) out.push(path.join(DOCS, LEGACY[md]));
  return out;
}

/* THE RULE: a division ledger is a working document, so it gets no PDF.
 * Derived from the filesystem — `.claude/agents/engine.md` means `docs/ENGINE.md` is a ledger. */
function ledgerDocs() {
  const dir = path.join(ROOT, '.claude', 'agents');
  let agents;
  try {
    agents = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  } catch (e) {
    throw new Error(
      'cannot read ' + dir + ' (' + e.message + '). The division list is what excludes the ledger '
      + 'PDFs; without it this build silently costs 13.9 MB of pack per bump for ENGINE.pdf alone. '
      + 'Fix the path rather than letting the exclusion go absent.');
  }
  if (!agents.length) {
    throw new Error(
      dir + ' holds no agent definitions. Refusing to build: an empty division list would restore '
      + 'the ledger PDFs without anybody deciding to.');
  }
  return new Set(agents.map(f => f.replace(/\.md$/, '').toUpperCase() + '.md'));
}

const LEDGERS = ledgerDocs();
const all = fs.readdirSync(DOCS).filter(f => f.endsWith('.md')).sort();
const skipped = all.filter(f => LEDGERS.has(f));
const mds = all.filter(f => !LEDGERS.has(f));
const work = [];
for (const md of mds) {
  const src = path.join(DOCS, md);
  const srcMt = fs.statSync(src).mtimeMs;
  for (const out of outputsFor(md)) {
    let why = null;
    if (!fs.existsSync(out)) why = 'missing';
    else if (fs.statSync(out).mtimeMs < srcMt) why = 'stale';
    else if (ALL) why = 'forced';
    if (why) work.push({ md, src, out, why });
  }
}

console.log(`DOCUMENT PDFs — ${mds.length} markdown sources, ${skipped.length} excluded\n`);

/* PRINT THE EXCLUSION. A capability that cannot prove it ran is assumed broken, and this one is
 * worth 16.6 MB of pack per pass — it does not get to be silent. */
if (skipped.length) {
  console.log(`  EXCLUDED — a division ledger is a working document and gets no PDF (.claude/agents/):`);
  for (const s of skipped) console.log(`    ${s}`);
  console.log('');
}

if (!work.length) { console.log('  every document has a current PDF'); process.exit(0); }

if (CHECK) {
  for (const w of work) console.log(`  ${w.why.padEnd(8)} ${path.basename(w.out)}  <- ${w.md}`);
  console.log(`\n  ${work.length} to rebuild. Run without --check to build them.`);
  process.exit(1);
}

let ok = 0, failed = 0;
for (const w of work) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'build', 'md_to_pdf.js'), w.src, w.out],
      { stdio: 'ignore' });
    const kb = Math.round(fs.statSync(w.out).size / 1024);
    console.log(`  ${w.why.padEnd(8)} ${path.basename(w.out).padEnd(42)} ${String(kb).padStart(4)} KB`);
    ok++;
  } catch (e) {
    console.log(`  FAILED   ${path.basename(w.out)}  (${w.md})`);
    failed++;
  }
}
console.log(`\n  ${ok} built, ${failed} failed`);
process.exit(failed ? 1 : 0);
