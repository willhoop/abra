#!/usr/bin/env node
/**
 * notes_to_changelog.js — turn a RUNNING-NOTES-style row into the changelog's `### Record` section.
 *
 * WHY THIS EXISTS (2026-10-01). Will approved merging `docs/RUNNING-NOTES.md` into the open line's
 * changelog: one entry per version, carrying the notes row's four fields. The page is FROZEN at the
 * version declared in its masthead (`<!-- FROZEN: ... -->`). Branches cut before the freeze still
 * write rows into the page, and the coordinator merges them afterwards. This converts those rows.
 * It moves text; it never writes a figure, a basis or a supersession that the row did not state.
 *
 *   node engine/notes_to_changelog.js <file|->            print the Record section of every row in it
 *   node engine/notes_to_changelog.js <file|-> --entry    print a whole entry (### Changed + ### Record)
 *   node engine/notes_to_changelog.js --ref <git-ref>     the rows <ref> added above the freeze, printed
 *   node engine/notes_to_changelog.js --ref <ref> --apply write those into the changelog entries
 *   node engine/notes_to_changelog.js --migrate           move every row written into the frozen page
 *                                                         after its freeze into the changelog, and take
 *                                                         it out of the page (the merge-conflict case)
 *   add --dry-run to --apply or --migrate to see the plan without writing.
 *
 * A row is `## [abra/regmc 1.51.0] — 2026-10-01 — title` followed by top-level bullets
 * `- **What changed.** ...`, `- **Measured.** ...`, `- **Basis.** ...`, `- **Supersedes.** ...`,
 * `- **Owed to the next major.** ...`. Nested lines under a bullet travel with it. Any other
 * top-level bullet is kept, in the Record section, in the order written: nothing is dropped.
 *
 * MISSING FIELDS ARE REPORTED, NOT INVENTED. A row with no `Basis.` line converts to a Record section
 * with no `Basis.` line, the converter says so on stderr and exits 2, and tests/test-docs-current.js
 * clause 5e fails on the entry until a person writes the judgement. Filling it with "unchanged" here
 * would be the converter making the one call the rule says must be declared by a person.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const S = require('./docs_scan.js');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const DRY = has('--dry-run');

/** Split a row's body into its top-level bullets: [{ name, lines }]. Lines keep their indentation. */
function fieldsOf(bodyLines) {
  const out = [];
  let cur = null;
  for (const L of bodyLines) {
    const m = L.match(/^[-*]\s+\*\*([^*]+?)\.?\*\*\s?(.*)$/);
    if (m) { cur = { name: m[1].trim(), first: m[2], lines: [L] }; out.push(cur); continue; }
    if (cur) cur.lines.push(L);
    else if (L.trim()) out.push(cur = { name: null, first: L, lines: [L] });   // prose before any bullet
  }
  for (const f of out) while (f.lines.length && !f.lines[f.lines.length - 1].trim()) f.lines.pop();
  return out;
}

/** Every row in a notes-style text: [{ line_id, version, unreleased, date, title, fields }]. */
function rowsIn(text) {
  const clean = S.stripCR(text);
  const lines = clean.split('\n');
  return S.parseRows(clean).map(r => ({ ...r, fields: fieldsOf(lines.slice(r.line, r.end)) }));
}

const isWhat = (n) => /^what changed$/i.test(n || '');
/** The `### Record` section for one row. Returns { text, missing }. */
function recordSection(row) {
  const keep = row.fields.filter(f => f.name && !isWhat(f.name));
  const prose = row.fields.filter(f => !f.name);
  const named = new Set(keep.map(f => f.name.toLowerCase()));
  const missing = S.RECORD_FIELDS.filter(k => !named.has(k.toLowerCase()));
  const body = [...prose, ...keep].flatMap(f => f.lines);
  return { text: ['### Record', ...body].join('\n'), missing };
}
/** A whole changelog entry for a row, when the changelog has none for its version. */
function wholeEntry(row) {
  const what = row.fields.filter(f => isWhat(f.name));
  const head = `## [${row.unreleased ? 'Unreleased' : row.version}]${row.date ? ' — ' + row.date : ''}`;
  const changed = what.length
    ? ['### Changed', ...what.flatMap(f => (f.first.trim()
      ? [`- ${f.first}`, ...f.lines.slice(1)]
      : f.lines.slice(1).map(L => L.replace(/^ {2}/, ''))))]   // a bare heading bullet: lift its list
    : [];
  return [head, '', row.title ? row.title : '', '', ...changed, ...(changed.length ? [''] : []), recordSection(row).text]
    .join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Insert a Record section at the end of the entry for `row` in its line's changelog text. */
function insertIntoChangelog(clText, row) {
  const eol = clText.includes('\r\n') ? '\r\n' : '\n';
  const lines = S.stripCR(clText).split('\n');
  const want = row.unreleased ? 'Unreleased' : row.version;
  const re = new RegExp('^##\\s*\\[' + want.replace(/\./g, '\\.') + '\\]');
  const at = lines.findIndex(L => re.test(L));
  if (at < 0) {
    /* No entry for this version: write a whole entry above the newest one, which is where Keep a
     * Changelog puts a release — newest first. */
    const first = lines.findIndex(L => /^##\s*\[/.test(L));
    const ins = wholeEntry(row).split('\n').concat(['']);
    lines.splice(first < 0 ? lines.length : first, 0, ...ins);
    return { text: lines.join(eol), how: `new entry [${want}]` };
  }
  let end = lines.findIndex((L, i) => i > at && /^##\s*\[/.test(L));
  if (end < 0) end = lines.length;
  if (lines.slice(at, end).some(L => /^###\s+Record\b/.test(L))) {
    return { text: null, how: `[${want}] already has a ### Record section — left alone; merge by hand` };
  }
  let tail = end;
  while (tail > at + 1 && !lines[tail - 1].trim()) tail--;
  lines.splice(tail, 0, '', ...recordSection(row).text.split('\n'));
  return { text: lines.join(eol), how: `### Record appended to [${want}]` };
}

function changelogFor(row) {
  const l = S.lineOf(row.line_id);
  if (!l) throw new Error(`row [${row.line_id} ${row.version}] names no known version line`);
  if (l.closed) throw new Error(`row [${row.line_id} ${row.version}] is on ${l.id}, CLOSED at ${l.closed} — re-tag it to the open line first`);
  return l.changelog;
}

function warnMissing(rows) {
  let bad = 0;
  for (const r of rows) {
    const { missing } = recordSection(r);
    if (missing.length) {
      bad++;
      console.error(`  [${r.line_id} ${r.version || 'Unreleased'}] states no ${missing.join(', ')} — NOT invented; `
        + 'write it into the ### Record section by hand (clause 5e fails until you do).');
    }
  }
  return bad;
}

function apply(rows) {
  const byFile = new Map();
  for (const r of rows) {
    const f = changelogFor(r);
    if (!byFile.has(f)) byFile.set(f, fs.readFileSync(path.join(ROOT, f), 'utf8'));
    const res = insertIntoChangelog(byFile.get(f), r);
    console.log(`  ${f}: ${res.how}`);
    if (res.text !== null) byFile.set(f, res.text);
  }
  if (DRY) { console.log('  --dry-run: nothing written'); return; }
  for (const [f, t] of byFile) fs.writeFileSync(path.join(ROOT, f), t);
}

function main() {
  if (has('--migrate')) {
    const fr = S.notesFreeze();
    if (!fr.frozen) { console.error(`${S.NOTES_LOG} carries no FROZEN declaration — nothing to migrate.`); process.exit(1); }
    const raw = fs.readFileSync(path.join(ROOT, S.NOTES_LOG), 'utf8');
    const rows = rowsIn(raw).filter(r => S.afterFreeze(r, fr));
    if (!rows.length) { console.log('migrate: no row sits above the freeze — nothing to do'); return 0; }
    console.log(`migrate: ${rows.length} row(s) above the freeze in ${S.NOTES_LOG}`);
    const bad = warnMissing(rows);
    apply(rows);
    if (!DRY) {
      const eol = raw.includes('\r\n') ? '\r\n' : '\n';
      const lines = S.stripCR(raw).split('\n');
      const drop = new Array(lines.length).fill(false);
      for (const r of rows) {
        for (let i = r.line - 1; i < r.end; i++) drop[i] = true;
      }
      fs.writeFileSync(path.join(ROOT, S.NOTES_LOG), lines.filter((_, i) => !drop[i]).join(eol));
      console.log(`  ${S.NOTES_LOG}: ${rows.length} row(s) taken out; the frozen rows are untouched`);
    }
    return bad ? 2 : 0;
  }
  let text, rows;
  if (val('--ref')) {
    const ref = val('--ref');
    text = execFileSync('git', ['show', `${ref}:${S.NOTES_LOG}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const fr = S.notesFreeze();
    /* The branch's page was cut before the freeze, so it carries no marker: judge its rows against
     * THIS tree's freeze. A row at or below the freeze is already in the archive. */
    rows = rowsIn(text).filter(r => S.afterFreeze(r, fr.frozen ? fr : { frozen: true, at: new Map() }));
  } else {
    const src = argv.find(a => !a.startsWith('--'));
    if (!src) {
      console.error('usage: node engine/notes_to_changelog.js <file|-> [--entry] | --ref <git-ref> [--apply] [--dry-run] | --migrate [--dry-run]');
      return 1;
    }
    text = src === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(src), 'utf8');
    rows = rowsIn(text);
  }
  if (!rows.length && val('--ref')) { console.log(`no row above the freeze in ${val('--ref')}:${S.NOTES_LOG} — nothing to convert`); return 0; }
  if (!rows.length) { console.error('no `## [<line> <version>] — <date> — <title>` row found'); return 1; }
  const bad = warnMissing(rows);
  if (has('--apply')) { apply(rows); return bad ? 2 : 0; }
  for (const r of rows) {
    console.log(`<!-- ${r.line_id} ${r.version || 'Unreleased'} -> ${S.lineOf(r.line_id) ? S.lineOf(r.line_id).changelog : '?'} -->`);
    console.log(has('--entry') ? wholeEntry(r) : recordSection(r).text);
    console.log('');
  }
  return bad ? 2 : 0;
}

module.exports = { fieldsOf, rowsIn, recordSection, wholeEntry, insertIntoChangelog };
if (require.main === module) process.exit(main());
