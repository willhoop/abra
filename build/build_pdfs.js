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

const mds = fs.readdirSync(DOCS).filter(f => f.endsWith('.md')).sort();
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

console.log(`DOCUMENT PDFs — ${mds.length} markdown sources\n`);
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
