/* probe_release_drift_diagnosis.js — WHEN A RELEASE DIGEST MOVES, DOES ANYTHING SAY *WHY*?
 *
 * ================= WHAT THIS COST, TWICE, IN ONE NIGHT ============================================
 *
 * 2026-08-28 09:58Z->10:06Z and again 2026-09-04/05: the MEDICHAM gate fell from 2 failing clauses to
 * 7 and an agent re-ran five heavy clauses to restore it. `engine/medicham2-browser.js` had had its
 * LINE ENDINGS changed. All 26 frozen sources were content-identical — `diff --strip-trailing-cr`
 * gave zero differences. The release id moved, every pinned artifact was correctly stranded, and the
 * five re-runs discovered that nothing had changed.
 *
 * `.gitattributes:70-77` names nine sources that are CRLF in the working tree and says plainly why
 * pinning them to LF is a separate, larger job: it would rewrite them, move every release id, and
 * break `tests/roster.js`, whose red demonstrations match `\r\n` against the simulator's source. And
 * this repository's own record says: *never normalise the comparator to hide it.* Both doors are shut
 * on purpose.
 *
 * SO THE THIRD THING: the digest keeps moving, the artifact stays stranded, nothing is auto-excused —
 * and the mismatch SAYS WHY IT MOVED at the point it is discovered. A DIAGNOSIS, not an exemption.
 *
 * ================= WHAT THIS PROBE PINS ==========================================================
 *
 * Two constructed cases, both through the real `engine/engine_release.js`:
 *
 *   1. A frozen source whose live copy differs ONLY in line terminators.
 *      -> the diagnosis must fire, must name that file, must classify it `eol-only`.
 *   2. A frozen source with a real content edit — one character of code.
 *      -> it must NOT be excused. Verdict CONTENT-CHANGED, and it must say a re-measurement is owed.
 *   3. Both together. CONTENT-CHANGED must DOMINATE: a mixture is never reported as line endings.
 *
 * And the property, which is the part that matters: the classifier is handed two byte strings and no
 * filename. Case 4 asserts that a file with a name this repository has never seen is diagnosed the
 * same way — Will's standing test is *would this catch a second instance, spelled differently,
 * through another door?* and a list of the nine CRLF sources answers no.
 *
 * IT PLAYS NO GAME AND OPENS NO RELEASE. Every byte it compares is one it wrote itself, under the
 * scratchpad, through the `{store, liveRoot}` overrides that `engine_release.js` already requires a
 * caller to pass explicitly. The real release store is never read and never written.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const ER = require('../engine/engine_release.js');

let fails = 0, checks = 0;
function check(label, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + label); return; }
  fails++;
  console.log('  FAIL  ' + label + (detail ? '\n          ' + String(detail).replace(/\n/g, '\n          ') : ''));
}

/* ---- A SYNTHETIC TREE AND A SYNTHETIC RELEASE, BUILT BYTE BY BYTE ------------------------------
 * The manifest is written the same way `cut()` writes one — digest per file, bodies copied — but over
 * files this probe authored. Nothing here touches data/releases/. */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-drift-diag-'));
const STORE = path.join(TMP, 'store');
const LIVE = path.join(TMP, 'live');
const sha12 = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);

function put(root, rel, buf) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
  return p;
}

/* Freeze `files` (rel -> Buffer) as a release, then write `liveFiles` (rel -> Buffer) as the tree. */
function stage(id, files, liveFiles) {
  const dir = path.join(STORE, 'releases', id);
  const man = { id, cut: '2026-09-05T00:00:00.000Z', why: 'probe fixture', showdown_commit: null,
                cuts: [], files: {} };
  for (const [rel, buf] of Object.entries(files)) { put(dir, rel, buf); man.files[rel] = sha12(buf); }
  fs.writeFileSync(path.join(dir, 'release.json'), JSON.stringify(man, null, 2) + '\n');
  for (const [rel, buf] of Object.entries(liveFiles)) put(LIVE, rel, buf);
  return ER.driftDiagnosis(id, { store: STORE, liveRoot: LIVE });
}

const B = s => Buffer.from(s, 'latin1');
/* THE BLANK LINE IS LOAD-BEARING — see check 1h. A fixture with no empty line cannot see the
 * under-count that made two identical files read as 39866 against 39932. */
const LF   = "'use strict';\n\nconst x = 1;\n\nmodule.exports = { x };\n";
const CRLF = LF.replace(/\n/g, '\r\n');
const EDIT = "'use strict';\n\nconst x = 2;\n\nmodule.exports = { x };\n";

console.log('\nRELEASE DRIFT DIAGNOSIS — does a moved digest say why it moved?\n');
console.log('  fixture root: ' + TMP + '\n');

/* ---- 1. LINE ENDINGS ONLY ---------------------------------------------------------------------- */
{
  const d = stage('aaaaaaaaaaaa', { 'engine/sim.js': B(LF) }, { 'engine/sim.js': B(CRLF) });
  const row = (d.files || []).find(r => r.file === 'engine/sim.js');
  check('1a  a line-ending-only change is still DRIFT — the digest moved and the file is listed',
    d.moved === 1 && !!row, JSON.stringify(d).slice(0, 400));
  check('1b  it is classified `eol-only`, by name',
    row && row.class === 'eol-only', row && row.class);
  check('1c  the verdict is EOL-ONLY, so the next caller knows in seconds',
    d.verdict === 'EOL-ONLY', d.verdict);
  check('1d  the summary NAMES the file rather than saying "some sources"',
    /engine\/sim\.js/.test(d.summary || ''), d.summary);
  check('1e  it says the direction of the change (which side is CRLF)',
    row && /CRLF/.test(String(row.why)), row && row.why);
  /* THE COUNTS MUST AGREE OR THE SENTENCE IS ITSELF A FALSE ALARM. A pure LF->CRLF flip has the same
   * number of terminators on both sides. The first counter used `[^\r]\n`, which eats the preceding
   * character and so under-counted every blank line: on the live tree it read "39866 LF" against
   * "39932 CRLF" for two content-identical files — a difference in the alarming direction, printed by
   * the line built to stop a false alarm. A blank line is in the fixture for exactly this reason. */
  check('1h  the terminator counts AGREE across a pure flip — the sentence must not itself alarm',
    row && row.frozen_eol && row.live_eol
      && row.frozen_eol.lf === row.live_eol.crlf && row.frozen_eol.lf > 0
      && row.live_eol.lf === 0 && row.frozen_eol.crlf === 0,
    JSON.stringify({ frozen: row && row.frozen_eol, live: row && row.live_eol }));
  /* The wording is load-bearing. `eol-only` means NOBODY EDITED A CHARACTER; it must not be read as
   * "the pin is fine". A line terminator inside a template literal is semantic and `tests/roster.js`
   * matches `\r\n` against the simulator source on purpose, so the summary has to say the id moved
   * and must not offer the artifact back as reusable. */
  check('1f  it still says the ID MOVED — an eol-only diagnosis is not an all-clear',
    /id moved/i.test(d.summary || ''), d.summary);
  check('1g  and it never offers the pinned artifact back as reusable or still valid',
    !/(reusable|re-?use this release|still valid|safe to (?:re-?use|quote)|no re-?measurement is owed\.)/i
      .test(d.summary || ''), d.summary);
}

/* ---- 2. A REAL CONTENT CHANGE, WHICH MUST NOT BE EXCUSED ---------------------------------------- */
{
  const d = stage('bbbbbbbbbbbb', { 'engine/sim.js': B(LF) }, { 'engine/sim.js': B(EDIT) });
  const row = (d.files || []).find(r => r.file === 'engine/sim.js');
  check('2a  a one-character code edit is classified `changed`, never `eol-only`',
    row && row.class === 'changed', row && row.class);
  check('2b  the verdict is CONTENT-CHANGED',
    d.verdict === 'CONTENT-CHANGED', d.verdict);
  check('2c  it says out loud that a re-measurement IS owed',
    /re-?measurement IS owed/i.test(d.summary || ''), d.summary);
  check('2d  eol_only is zero — nothing was excused',
    d.eol_only === 0, JSON.stringify({ eol_only: d.eol_only, changed: d.changed }));
}

/* ---- 3. A MIXTURE. CONTENT MUST DOMINATE -------------------------------------------------------- */
{
  const d = stage('cccccccccccc',
    { 'engine/sim.js': B(LF), 'engine/other.js': B(LF) },
    { 'engine/sim.js': B(CRLF), 'engine/other.js': B(EDIT) });
  check('3a  one eol-only file plus one real edit reports CONTENT-CHANGED, not EOL-ONLY',
    d.verdict === 'CONTENT-CHANGED', d.verdict);
  check('3b  both counts are reported — the eol file is diagnosed, not swallowed',
    d.eol_only === 1 && d.changed === 1, JSON.stringify({ eol_only: d.eol_only, changed: d.changed }));
}

/* ---- 4. THE PROPERTY. A NAME THIS REPOSITORY HAS NEVER SEEN, DIAGNOSED IDENTICALLY --------------
 * If the diagnosis were the nine names out of .gitattributes, this case would come back `changed` or
 * come back nothing. It is a comparison of two byte strings and knows no filenames at all. */
{
  const d = stage('dddddddddddd',
    { 'data/a-file-nobody-has-added-yet.json': B('{\n  "k": 1\n}\n') },
    { 'data/a-file-nobody-has-added-yet.json': B('{\r\n  "k": 1\r\n}\r\n') });
  const row = (d.files || []).find(r => r.file === 'data/a-file-nobody-has-added-yet.json');
  check('4a  a source name that does not exist in SOURCES or .gitattributes is diagnosed the same way',
    row && row.class === 'eol-only' && d.verdict === 'EOL-ONLY',
    JSON.stringify({ cls: row && row.class, verdict: d.verdict }));
  check('4b  the classifier itself takes bytes and no filename',
    ER.classifyChange(B(LF), B(CRLF)).class === 'eol-only'
    && ER.classifyChange(B(LF), B(EDIT)).class === 'changed'
    && ER.classifyChange(B(LF), B(LF)).class === 'same',
    'classifyChange(frozen, live) must be a pure two-buffer comparison');
}

/* ---- 5. WHAT IT REFUSES TO GUESS ---------------------------------------------------------------
 * A pruned release has no bodies, so "did the content change" is UNANSWERABLE — and answering
 * EOL-ONLY there would be the reassuring direction, which is the dangerous one. */
{
  const dir = path.join(STORE, 'releases', 'eeeeeeeeeeee');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'release.json'), JSON.stringify({
    id: 'eeeeeeeeeeee', cut: '2026-09-05T00:00:00.000Z', why: 'probe fixture — pruned',
    files: { 'engine/sim.js': 'ffffffffffff' }, bodies_pruned: { at: '2026-09-05T00:00:00.000Z' },
  }, null, 2) + '\n');
  put(LIVE, 'engine/sim.js', B(CRLF));
  const d = ER.driftDiagnosis('eeeeeeeeeeee', { store: STORE, liveRoot: LIVE });
  check('5a  a pruned release cannot be diagnosed and says so, rather than guessing EOL-ONLY',
    d.verdict === 'UNDIAGNOSABLE', d.verdict + ' — ' + d.summary);
}

console.log('\n  ' + (checks - fails) + ' of ' + checks + ' checks passed.');
if (fails) {
  console.log('\n  RED. A release digest can move for a reason nobody is told, which is what five heavy');
  console.log('  re-runs bought on 2026-09-04 and again on 2026-08-28.\n');
  process.exit(1);
}
console.log('\n  GREEN. A moved digest names its cause; a real content change is still not excused.\n');
