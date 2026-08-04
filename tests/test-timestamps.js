/* test-timestamps.js — no generator may write a timestamp whose meaning depends on who reads it.
 *
 * WHY THIS EXISTS
 * ---------------
 * engine/rollout_r1_join.py wrote `"generated": "2026-08-03T04:14:10"` — ISO-8601 with no offset.
 * A naive timestamp is not a fact about an instant; it is a fact about a wall clock in an unnamed
 * place. Four more generators did the same thing (lookahead_bound.py, lookahead_clock_control.py,
 * nmf_rank.py, porygon2.py), which is what makes it a convention rather than a slip. One occurrence
 * is a typo; five is the house style, and the house style was wrong.
 *
 * THE COST, stated precisely, because the obvious diagnosis is not quite right. JavaScript does not
 * misparse it — ECMA-262 reads the date-TIME form as local and the date-ONLY form as UTC, opposite
 * defaults for two forms this project uses side by side. So the value round-trips on the machine
 * that wrote it and shifts by the reader's UTC offset anywhere else, and it is wrong by that offset
 * the moment it is compared against a `Z` stamp. Every JavaScript writer here emits `Z`, because
 * Date.prototype.toISOString is UTC by construction, and engine/status.js and engine/provenance.js
 * exist to compare exactly these fields.
 *
 * WHAT IT CHECKS. Generators, not artifacts, and that scope is deliberate. An artifact carrying an
 * old naive stamp is fixed by re-running its generator, which is not something a test can do and not
 * something anybody should be pressured into at 3am to turn a suite green — that pressure is how
 * "KNOWN FAILURE" gets typed. Fixing the WRITERS is a source change, is complete the moment it is
 * made, and stops the next one. The artifacts that still carry naive stamps are listed as
 * information at the end of the run, without failing it, and the list shrinks as each is re-run.
 *
 * engine/rollout_r1_join.py's own artifact is a special case that must NOT be regenerated: it is
 * data/rollout-r1-withdrawn-join.json, a withdrawn result kept so the withdrawal can be checked.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); c ? P++ : F++; };

console.log('TIMESTAMPS — a stamp whose meaning depends on the reader is not a fact\n');

/* ---- 1. no Python generator writes a naive datetime ------------------------------------------- */
/* `datetime.now()` / `datetime.utcnow()` with no tzinfo. Both are naive: utcnow() is the worse of
 * the two, because it produces a UTC instant and then labels it as if it were local. A call that
 * passes a timezone (`datetime.now(timezone.utc)`) is what engine/isotime.py does and is fine. */
const NAIVE_PY = /datetime\s*\.\s*(now\s*\(\s*\)|utcnow\s*\(\s*\))/;
const isComment = ln => /^\s*#/.test(ln);

/* THIS CHECK COULD PASS BY SCANNING NOTHING, and both ways of getting there were silent. A
 * directory that would not list was skipped with `continue`, and a file that would not read was too,
 * so "no Python generator writes a naive datetime" was also the answer when zero generators had been
 * looked at. That is CLAUDE.md's named failure — a capability that cannot prove it ran — inside the
 * guard written to stop a different one. The scan now counts what it saw and asserts a floor.
 * Measured 2026-08-04: engine/ holds 39 .py files and build/ holds 1; `tools/` exists with none and
 * `scripts/` does not exist, so two of the four directories legitimately contribute nothing. */
const offenders = [];
const scan = { dirsRead: 0, dirsSkipped: [], filesRead: 0, filesSkipped: [] };
for (const dir of ['engine', 'build', 'tools', 'scripts']) {
  let entries = [];
  try { entries = fs.readdirSync(D(dir)); scan.dirsRead++; }
  catch (e) { if (e.code !== 'ENOENT') scan.dirsSkipped.push(`${dir}/ — ${e.message}`); continue; }
  for (const f of entries) {
    if (!f.endsWith('.py')) continue;
    const rel = dir + '/' + f;
    if (rel === 'engine/isotime.py') continue;          // the module that defines the right way
    let src = '';
    try { src = fs.readFileSync(D(dir, f), 'utf8'); scan.filesRead++; }
    catch (e) { scan.filesSkipped.push(`${rel} — ${e.message}`); continue; }
    src.split('\n').forEach((ln, i) => {
      if (isComment(ln)) return;
      if (NAIVE_PY.test(ln)) offenders.push(`${rel}:${i + 1}  ${ln.trim().slice(0, 90)}`);
    });
  }
}
ok(scan.filesRead >= 20,
  `the scan actually ran: ${scan.filesRead} Python generators read across ${scan.dirsRead} directories`
  + (scan.filesRead >= 20 ? '' : ' — a pass over nothing is not a pass'));
ok(scan.filesSkipped.length === 0 && scan.dirsSkipped.length === 0,
  `nothing was skipped unread${scan.filesSkipped.length || scan.dirsSkipped.length
    ? ':\n' + [...scan.dirsSkipped, ...scan.filesSkipped].map(o => '         ' + o).join('\n')
      + '\n         A file this check could not open is a file it cannot clear.' : ''}`);
ok(offenders.length === 0,
  `no Python generator writes a naive datetime${offenders.length ? ':\n' + offenders.map(o => '         ' + o).join('\n') : ''}` +
  (offenders.length ? '\n         fix: from isotime import utc_now' : ''));

/* ---- 2. engine/isotime.py is the one home, and it produces what it claims --------------------- */
const iso = fs.existsSync(D('engine', 'isotime.py'));
ok(iso, 'engine/isotime.py exists — one implementation, not five');
if (iso) {
  const src = fs.readFileSync(D('engine', 'isotime.py'), 'utf8');
  ok(/timezone\.utc/.test(src) && /replace\("\+00:00", "Z"\)/.test(src),
    'it produces a UTC instant with a Z suffix, matching what every JS writer here emits');
}

/* ---- 3. the two ISO forms really do disagree, so this is not a theory ------------------------- */
/* Asserted rather than asserted-about: if a future runtime changes the rule, this test should say
 * so rather than keep quoting a comment. */
{
  const naive = new Date('2026-08-03T04:14:10').toISOString();
  const zulu = new Date('2026-08-03T04:14:10Z').toISOString();
  const offset = new Date().getTimezoneOffset();
  ok(offset === 0 ? naive === zulu : naive !== zulu,
    `on this machine (UTC${offset ? (offset > 0 ? '-' : '+') + Math.abs(offset) / 60 : ''}) a naive ` +
    `stamp reads as ${naive} where a Z stamp reads as ${zulu}` +
    (offset === 0 ? ' — identical only because this box is on UTC' : ''));
}

/* ---- 4. INFORMATION, NOT A FAILURE: artifacts still carrying a naive stamp -------------------- */
const NAIVE_VAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const stale = [];
/* AN ARTIFACT THAT WILL NOT PARSE WAS SILENTLY EXCLUDED FROM A PUBLISHED LIST. The block below
 * prints "N artifact(s) still carry a naive stamp", and an unreadable file could never appear in it,
 * so the one class of artifact most likely to be broken was the one class this survey could not
 * see. Counted and named. Measured 2026-08-04: 0 of 107 data/*.json fail to parse, so the list is
 * complete today — which is a statement that could not previously be made at all. */
const unreadable = [];
let surveyed = 0;
for (const f of fs.readdirSync(D('data'))) {
  if (!f.endsWith('.json')) continue;
  let j;
  try { j = JSON.parse(fs.readFileSync(D('data', f), 'utf8')); surveyed++; }
  catch (e) { unreadable.push(`data/${f} — ${e.message.split('\n')[0]}`); continue; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) continue;
  for (const k of ['generated', 'measured_at', 'updated', 'created', 'timestamp']) {
    if (typeof j[k] === 'string' && NAIVE_VAL.test(j[k])) stale.push(`data/${f}  ${k}=${j[k]}`);
  }
}
console.log(`\n  ${stale.length} of ${surveyed} readable artifact(s) still carry a naive stamp; each is fixed by re-running its generator:`);
for (const s of stale) console.log('    ' + s);
if (!stale.length) console.log('    (none)');
if (unreadable.length) {
  console.log(`\n  ${unreadable.length} artifact(s) could NOT be surveyed, so the count above is a floor, not a total:`);
  for (const s of unreadable) console.log('    ' + s);
}

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
