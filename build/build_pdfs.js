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
 *
 * THE RULE IS THE WORKING DOCUMENT, NOT THE LEDGER — 2026-09-06, SECOND PASS
 * -------------------------------------------------------------------------
 * A ledger is one KIND of working document and the rule above stopped at the kind it could derive.
 * Two more were left in on the day it landed, both by any reading of the rule working documents:
 *
 *   - `docs/ROADMAP.md` — the register. `engine/open_work.js`, `engine/quarantine.js`,
 *     `engine/register_reality.js` and `engine/seed_source_audit.js` all read it as GATE INPUT.
 *     MEASURED: `docs/ROADMAP.pdf` is 7,229,637 B in the tree across EIGHT tracked versions holding
 *     16.42 MB raw / 5.19 MB packed, and the version at the most recent bump `d7ed4b75` packs to
 *     4,092,583 B. That is 4.09 MB of permanent history every time the register moves, which is
 *     most sessions.
 *   - `docs/RUNNING-NOTES.md` — the notes log, which by design gains a row every change.
 *     `.githooks/pre-commit` blocks a commit that does not move it. Its PDF has never been built;
 *     built once to a scratch path to price it, it is 241,109 B TODAY at 190 lines. `docs/ENGINE.pdf`
 *     is what that number becomes: 108.4 MB across ten rebuilds.
 *
 * THE SHARED PROPERTY COULD NOT BE DERIVED, AND FIVE CANDIDATES WERE MEASURED BEFORE SAYING SO.
 * Each was run over all 78 `docs/*.md` and each over-matched or under-matched by a wide margin —
 * LESSONS §4, every derivation over-matches on the first try:
 *
 *   (a) NAMED BY A PROGRAM ..................... 56 of 78 documents matched; nearly every hit is a
 *       path inside a comment or a console message ("see docs/LESSONS.md").
 *   (b) NAMED IN CODE, COMMENTS STRIPPED ....... still 45 of 78, because a `console.log` string is
 *       code. It catches DEFENSE, METHODOLOGY and ORIENTATION, which have PUBLISHED PDF links.
 *   (c) NO VERSION HEADER (`docs_scan.livingDocs()`) ... only 24 of 78 claim currency, so this would
 *       drop 54 PDFs including the three legacy published names above. Right idea, wrong blast radius.
 *   (d) SHAPE — fraction of body lines that are table rows ... does not separate at all:
 *       ROADMAP 44.3%, but RUNNING-NOTES 0.0%, SUMMARY 22.4%, ROLE-ATLAS 98.8%.
 *   (e) GIT HISTORY — additions vs deletions ... cannot classify a document created this week, which
 *       is exactly `RUNNING-NOTES.md`, the one that most needs classifying.
 *
 * SO THE SECOND CLAUSE IS A DECLARED RESIDUAL, AND IT IS CHECKED RATHER THAN TRUSTED. `RESIDUAL`
 * below carries a reason per entry, and `workingDocs()` THROWS if an entry names a document that is
 * not there, if an entry has become a ledger (the derivation moved under it and the entry is now a
 * second opinion), or — the one that protects the saving — if ANY excluded document's PDF is still
 * TRACKED BY GIT. An exclusion whose output is tracked buys nothing, which is the whole point.
 *
 * UNTRACKING RECOVERS ZERO BYTES OF EXISTING HISTORY. The blobs stay in the pack; only a history
 * rewrite removes them and this project has ruled that out. The saving is entirely future.
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

/* CLAUSE 2 — THE DECLARED RESIDUAL. Read the header before adding a line here: four derivations
 * were measured and refused first, and a third name arriving without that work is the hand-typed
 * list this project keeps paying for. Each entry states the property that made it a working
 * document, so the entry can be argued with rather than merely obeyed. */
const RESIDUAL = {
  'ROADMAP.md':
    'the register. Read as GATE INPUT by engine/open_work.js, engine/quarantine.js, '
    + 'engine/register_reality.js and engine/seed_source_audit.js; a row is appended or closed most '
    + 'sessions. Its PDF cost 4,092,583 packed bytes at the most recent bump.',
  'RUNNING-NOTES.md':
    'the notes log. Append-only by design — .githooks/pre-commit blocks a commit that does not add a '
    + 'row — so its PDF would be rebuilt every session and grow forever, which is what docs/ENGINE.pdf '
    + 'became at 108.4 MB across ten rebuilds. It has no version header BECAUSE no single version '
    + 'describes a log (data/docs-currency-baseline.json states that), which is the same fact that '
    + 'makes it not a deliverable.',
};

/* Every PDF this build excludes must actually be OUT of git, or the exclusion buys nothing. Asked
 * once, for the whole excluded set, and it THROWS rather than warning: a silent skip here restores
 * the cost the rule exists to remove, and the run would still report success. */
function trackedPdfs(names) {
  let out;
  try {
    out = execFileSync('git', ['ls-files', '--', 'docs'], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    throw new Error(
      'cannot ask git which docs/ files are tracked (' + e.message + '). This check is what proves '
      + 'an excluded PDF is not still entering history; skipping it would leave the exclusion '
      + 'costing exactly what it did before, silently. Fix git rather than letting the check go absent.');
  }
  const tracked = new Set(out.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
  return names.filter(md => outputsFor(md).some(o => tracked.has('docs/' + path.basename(o))));
}

/* THE WORKING-DOCUMENT SET: clause 1 derived, clause 2 declared, and the residual is CHECKED. */
function workingDocs(all) {
  const ledgers = ledgerDocs();
  const why = new Map();
  for (const f of all) if (ledgers.has(f)) why.set(f, 'division ledger (.claude/agents/)');
  for (const [f, reason] of Object.entries(RESIDUAL)) {
    if (!all.includes(f)) {
      throw new Error(
        'the declared residual names docs/' + f + ', which does not exist. An entry for a document '
        + 'that is gone is a rule nobody can check — delete the entry or restore the document.');
    }
    if (why.has(f)) {
      throw new Error(
        'docs/' + f + ' is BOTH a derived division ledger and a declared residual. The derivation has '
        + 'moved underneath this list; drop the residual entry rather than carrying a second opinion '
        + 'about the same document.');
    }
    why.set(f, 'declared residual — ' + reason);
  }
  const still = trackedPdfs([...why.keys()]);
  if (still.length) {
    throw new Error(
      'these documents are excluded from the PDF build and their PDFs are STILL TRACKED: '
      + still.join(', ') + '. An exclusion whose output is in git saves nothing — every rebuild still '
      + 'enters history. Run: git rm --cached docs/<name>.pdf (the file stays on disk), and add it to '
      + 'docs/.gitignore. Untracking recovers ZERO bytes of existing history; the saving is future.');
  }
  return why;
}

const all = fs.readdirSync(DOCS).filter(f => f.endsWith('.md')).sort();
const WORKING = workingDocs(all);
const skipped = all.filter(f => WORKING.has(f));
const mds = all.filter(f => !WORKING.has(f));
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
  console.log(`  EXCLUDED — a working document gets no PDF. The clause is printed beside each one, so a`);
  console.log(`  declared entry can never be mistaken for a derived one:`);
  for (const s of skipped) console.log(`    ${s.padEnd(20)} ${WORKING.get(s).split(' — ')[0]}`);
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
