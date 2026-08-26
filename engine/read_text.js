/* read_text.js — the ONE door for reading a text file. It normalises line endings at the read.
 *
 * WHY THIS EXISTS, AND WHY IT IS A DOOR RATHER THAN A LIST OF KNOWN-BAD REGEXES.
 *
 * `core.autocrlf` is true on this machine, so a tracked file sits in the working tree as CRLF while
 * the committed blob is LF. Same content, different bytes. Three separate checks in this repository
 * have already been WRONG about the project because of it:
 *
 *   1. the registered-artifact gate reported the browser engine and the node engine reading
 *      DIFFERENT rulebooks. data/abra-tags.js carries 41,252 CR bytes on disk and 0 in the
 *      committed blob. The engines agreed the whole time.
 *   2. tests/test-workflow-paths.js matched ZERO `git add` paths for its entire life, because a
 *      capture ending `(.+)$` can never reach the end of a CRLF line.
 *   3. engine/status.js carries a comment dated 2026-08-07 describing this exact bug: a GENERATED
 *      marker followed by CRLF did not match a pattern ending in `-->` plus a newline, so a whole
 *      ledger printed "no GENERATED block" while sitting frozen at an older run's numbers.
 *
 * Item 3 is the reason this file is a module and not a fourth point fix. It was found, understood,
 * and repaired IN THAT ONE FILE — and nineteen days later a new check shipped carrying the same
 * defect. A gate built from an instance catches that instance, never the class; this project has
 * paid for that three times over with the species-key mismatch, which was found, fixed and gated
 * twice before a third instance walked past both gates.
 *
 * THE DISCRIMINATOR, MEASURED — read this before writing a line-oriented regex anywhere.
 *
 *   CR is matched by `\s`. CR is NOT matched by `.`.
 *
 * So a pattern ending `\s*$` is ACCIDENTALLY immune; a pattern ending `(.+)$` is not, and captures
 * nothing at all on a CRLF line; a pattern carrying the `m` flag is safe, because `$` then anchors
 * before the LF and the CR is ordinary content; and `===` against a whole line, or `.endsWith(...)`,
 * is silently false. THE REST OF THIS REPOSITORY IS FINE BY LUCK RATHER THAN BY DESIGN. That is the
 * whole argument for normalising once, here, instead of auditing every regex forever.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. Line endings only. A UTF-8 byte-order mark, and the two
 * paragraph/line separators in the U+2028 block that `.` also excludes, are a different hazard
 * wanting a different fix. They are reported by whoever finds one, never silently rewritten here: a
 * reader that quietly edits its input is the same silent default this file exists to remove.
 */
'use strict';
const fs = require('fs');

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

/* Normalise text that is already in hand — a subprocess's stdout, a fixture built in a test, a body
 * read by something that is not `fs`. It is the same function the reader below uses, so the two can
 * never drift apart and disagree about what a line is. */
function normalise(text) {
  return String(text).split(CR + LF).join(LF).split(CR).join(LF);
}

/* The door. An fs error is NOT swallowed here, on purpose: the callers handle an unreadable file
 * differently and both are right to — engine/conformance.js scores it as empty bytes, engine/orient.js
 * says out loud that everything derived from it will read as EMPTY rather than as absent. A shared
 * reader that returned '' for both "this file is empty" and "this file is gone" would be exactly the
 * silent default this project keeps paying for, installed in one more place. */
function readText(file) {
  return normalise(fs.readFileSync(file, 'utf8'));
}

module.exports = { readText, normalise };
