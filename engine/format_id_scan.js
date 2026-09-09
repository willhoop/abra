#!/usr/bin/env node
/* format_id_scan.js — WHERE IS A FORMAT ID TYPED INTO THE CALL THAT DECIDES WHICH GAME A RUN IS ABOUT?
 *
 * THIS FILE OWNS THE PREDICATE AND NOTHING ELSE OWNS IT. Two callers ask the same question for two
 * reasons and they must never each own the answer — the FACTS ARE GLOBAL rule in CLAUDE.md, and the
 * two-files-both-decide-Choice-Scarf-is-1.5x failure it was written about:
 *
 *   tests/probe_format_id_derivation.js   is it RED — does engine/ or build/ still type one?
 *   engine/next_regulation.js --checklist  what does the FLIP have to decide about the ones under tests/?
 *
 * WHY THE CHECKLIST CANNOT DERIVE THIS ITSELF, WHICH IS THE WHOLE REASON THIS EXISTS. That command
 * derives the blast radius of a rotation from files that READ data/regulations.json or take the format
 * from champions_sim. A file with the id TYPED INTO IT does neither, so it is invisible to that radius
 * BY CONSTRUCTION — it keeps working after the flip, about the previous regulation, and reports
 * success. The radius was complete against its own definition and blind to the one class of file that
 * cannot follow the config.
 *
 * A COMMENT IS NOT A CALL SITE. The first draft of the probe reported 104 lines, most of them prose
 * ABOUT a format id — including this repository's own explanation of why one must not be typed. A
 * checker that counts its own documentation as the defect is the over-match LESSONS §4 names.
 *
 * A TYPED ID IS NOT ALWAYS A DEFECT, AND THE CALLER DECIDES, NOT THIS FILE. Under `tests/` an id is
 * usually a PIN ON WHAT WAS MEASURED, and rewriting those would be editing the record. So this
 * reports call sites; it takes no position on which of them are wrong.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* THE CALL, not the filename. A name list here would be the hand-maintained ban list of four in a
 * new costume — it went stale without anybody noticing, and one command cannot. */
const CALL = /(?:forFormat\s*\(|search\.json\?format=)\s*['"`]?(gen\d[a-z0-9]+)/i;
const COMMENT = /^\s*(?:\*|\/\/|\/\*)/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'data', 'docs', 'web', 'app']);

/* THE SCANNERS' OWN SOURCES ARE NOT CALL SITES. Both carry the pattern and the prose about it. */
const SELF = [/^engine\/format_id_scan\.js$/, /^tests\/probe_format_id_derivation/];

function walk(dir, out = []) {
  let ents = [];
  /* NOT SILENT. A directory this cannot read is a BLIND SPOT, and a scan whose whole value is
   * completeness must say when it is incomplete rather than return a smaller number. */
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { walk.unreadable.push(dir + ': ' + e.message); return out; }
  for (const e of ents) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (e.name.endsWith('.js')) out.push(path.join(dir, e.name));
  }
  return out;
}
walk.unreadable = [];

/** Live (non-comment) call sites in `text`, as `rel:line  formatid` strings. */
function offenders(text, rel) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    if (COMMENT.test(line)) return;
    const m = CALL.exec(line);
    if (m) hits.push(`${rel}:${i + 1}  ${m[1]}`);
  });
  return hits;
}

/** Repo-relative .js paths under `dirs`, minus the scanners themselves. */
function filesUnder(dirs) {
  return dirs.flatMap(d => walk(path.join(ROOT, d)))
    .map(f => path.relative(ROOT, f).replace(/\\/g, '/'))
    .filter(f => !SELF.some(re => re.test(f)));
}

/** `{ files, hits, unreadable }` for the working tree under `dirs`. */
function liveCallSites(dirs) {
  walk.unreadable = [];
  const files = filesUnder(dirs);
  const hits = [];
  for (const rel of files) hits.push(...offenders(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel));
  return { files, hits, unreadable: walk.unreadable.slice() };
}

/** The distinct format ids named, newest-sorting last — what a rotation has to decide about. */
function idsNamed(hits) {
  return [...new Set(hits.map(h => h.split(/\s+/).pop()))].sort();
}

module.exports = { CALL, COMMENT, SKIP_DIRS, ROOT, walk, offenders, filesUnder, liveCallSites, idsNamed };

if (require.main === module) {
  const r = liveCallSites(['engine', 'build', 'tests']);
  for (const h of r.hits) console.log('  ' + h);
  console.log(`\n  ${r.hits.length} live call site(s) across ${r.files.length} file(s); ` +
    `ids named: ${idsNamed(r.hits).join(', ') || '(none)'}`);
  if (r.unreadable.length) console.log(`  ${r.unreadable.length} unreadable: ${r.unreadable.join('; ')}`);
}
