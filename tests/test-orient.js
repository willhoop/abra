/* test-orient.js — DOES THE ORIENTATION MAP ACTUALLY DERIVE, AND DOES IT FAIL LOUDLY?
 *
 *   node tests/test-orient.js
 *
 * `engine/orient.js` is what a new session reads to get caught up. Will, 2026-08-23: *"I WANT THIS
 * BULLETPROOF AND NOT JUST A SNAPSHOT."* Bulletproof does not mean it always prints — it means it
 * **never prints a plausible map that has quietly lost a section**. A map that silently drops ENGINE
 * reads as "there are four divisions", and DIVISIONS.md really did read "Four divisions" for a day
 * after WEB was added. That is the failure being tested for.
 *
 * THE ARMS, AND WHY EACH ONE EXISTS:
 *
 *   1. IT RUNS GREEN on the real repo, all sections derived, exit 0.
 *   2. EVERY SECTION IS PRESENT BY NAME. A section that vanished without a CANNOT DERIVE line is the
 *      exact silent drop the generator exists to prevent, and an exit code alone would not catch it.
 *   3. EVERY BREAK KNOB GOES RED. `ORIENT_BREAK=<section>` blanks one input at its read site. Each
 *      must exit NON-ZERO and NAME the section. This is the arm that proves the fail() paths are
 *      reachable rather than decorative — CLAUDE.md: a capability that cannot prove it ran is assumed
 *      broken, and this repo has shipped test arms that passed with their own guard deleted.
 *   4. THE OWED SECTION LEAKS NO FINDINGS. `docs/_reports/` is historical and must never be quoted as
 *      current state, so the IN FLIGHT block may contain COMMANDS ONLY. Every extracted line must
 *      start with a runner token. A prose sentence appearing there is a regression into a findings
 *      digest, which the generator's header bans by name.
 *   5. THE ENUMERATION SUMS. The report buckets must add to the file count. An enumeration whose
 *      parts do not add up is hiding something — the first version printed two of three buckets and
 *      30 did not equal 4 + 21.
 *
 * WHAT THIS TEST CANNOT DO, STATED SO NOBODY READS MORE INTO A GREEN RUN:
 * it checks that each section DERIVED SOMETHING, not that what it derived is true. Sections 1, 5 and
 * 7 parse prose and are keyed to a shape; a model documented some third way is missed, and this test
 * would stay green. That mitigation lives in the generator, which NAMES what it could not classify.
 * A ratchet written as a list of known-good shapes cannot catch a new shape — the species-key bug
 * cost this project three separate fixes to learn that.
 */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ORIENT = path.join(ROOT, 'engine', 'orient.js');
const FAILS = [];
const bad = m => { FAILS.push(m); console.log('  FAIL  ' + m); };
const good = m => console.log('  ok    ' + m);

function run(env) {
  try {
    const out = execFileSync(process.execPath, [ORIENT], {
      cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, env || {}),
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status == null ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

console.log('test-orient.js — the orientation map derives, and fails loudly when it cannot\n');

/* ---- ARM 1 + 2: it runs, and every section is present by name ---------------------------------- */
const live = run({});
if (live.code !== 0) bad('orient.js exited ' + live.code + ' on the real repo — a section could not derive');
else good('orient.js exits 0 on the real repo');

/* The section titles are read out of the generator's own output rather than listed here — a hand-typed
 * list of sections in the test is the snapshot re-entering through the back door, and it would need
 * editing every time a section is added. What IS asserted is that the count the generator claims and
 * the count of headings it printed AGREE. Those disagreeing is a dropped section. */
const claimed = (live.out.match(/ORIENT:\s*(\d+)\/(\d+)\s+sections derived/) || [])[2];
const printed = (live.out.match(/^\d+\. [A-Z]/gm) || []).length;
if (!claimed) bad('orient.js printed no "ORIENT: n/n sections derived" verdict line');
else if (Number(claimed) !== printed) {
  bad('orient.js claims ' + claimed + ' sections but printed ' + printed + ' headings — one was DROPPED SILENTLY');
} else good(printed + ' section headings printed, and the verdict line agrees');

for (const must of ['THE DIVISIONS', 'THE INVALIDATION GRAPH', 'THE MODELS', 'IN FLIGHT']) {
  if (!live.out.includes(must)) bad('section "' + must + '" is missing from the output entirely');
}
if (!FAILS.length) good('the four load-bearing sections are present');

/* Counts must be non-zero. A section that derived NOTHING but did not fail is the quiet failure. */
const divs = Number((live.out.match(/(\d+) divisions, \d+ with a ledger/) || [])[1] || 0);
const mods = Number((live.out.match(/(\d+) of \d+ modules are downstream/) || [])[1] || 0);
const models = Number((live.out.match(/(\d+) models carry a question/) || [])[1] || 0);
if (divs < 1) bad('THE DIVISIONS derived ' + divs + ' divisions');
else if (mods < 2) bad('THE INVALIDATION GRAPH derived ' + mods + ' downstream modules');
else if (models < 1) bad('THE MODELS derived ' + models + ' models');
else good('non-zero everywhere: ' + divs + ' divisions, ' + mods + ' modules downstream, ' + models + ' models');

/* ---- ARM 3: every break knob goes red, and names its section ----------------------------------- */
console.log('\n  -- the deliberate breaks (each blanks ONE input at its read site) --');
const KNOBS = {
  abra:      'WHAT ABRA IS',
  divisions: 'THE DIVISIONS',
  graph:     'THE INVALIDATION GRAPH',
  models:    'THE MODELS',
  frozen:    'WHAT A MEASUREMENT MUST PIN',
  owed:      'IN FLIGHT',
};
for (const [knob, section] of Object.entries(KNOBS)) {
  const r = run({ ORIENT_BREAK: knob });
  if (r.code === 0) {
    bad('ORIENT_BREAK=' + knob + ' STILL EXITED 0 — a missing ' + section + ' was reported as success');
  } else if (!new RegExp('CANNOT DERIVE: ' + section).test(r.out)) {
    bad('ORIENT_BREAK=' + knob + ' exited ' + r.code + ' but never named "' + section + '"');
  } else {
    good('ORIENT_BREAK=' + knob + ' -> exit ' + r.code + ', names ' + section);
  }
}

/* ---- ARM 4: the OWED block carries commands, never findings ------------------------------------ */
console.log('\n  -- the IN FLIGHT block may contain COMMANDS ONLY --');
{
  const lines = live.out.split('\n');
  const start = lines.findIndex(l => /^\d+\. IN FLIGHT/.test(l));
  const end = lines.findIndex((l, i) => i > start && /^\d+\. [A-Z]/.test(l));
  const block = lines.slice(start + 1, end < 0 ? lines.length : end);
  const cmdLines = block.filter(l => /^ {6}\S/.test(l));
  const notCommands = cmdLines.filter(l => !/^ {6}(node|cmd|npx|git|python3?|powershell|tools[\\/]|\.\.\. \d+ more)/.test(l));
  if (notCommands.length) {
    bad(notCommands.length + ' line(s) in IN FLIGHT are not commands — findings are leaking out of ' +
        'docs/_reports/, which may never be quoted as current state. First: ' + notCommands[0].trim().slice(0, 70));
  } else good(cmdLines.length + ' extracted OWED lines, every one of them a command');
}

/* ---- ARM 5: the enumeration sums --------------------------------------------------------------- */
{
  const m = live.out.match(/(\d+) reports scanned = (\d+) with runnable OWED commands \(\d+ commands\) \+ (\d+) with an OWED heading but no command line \+ (\d+) with no OWED heading/);
  if (!m) bad('the IN FLIGHT summary line did not print in the expected three-bucket form');
  else if (Number(m[2]) + Number(m[3]) + Number(m[4]) !== Number(m[1])) {
    bad('the report buckets do not sum: ' + m[2] + ' + ' + m[3] + ' + ' + m[4] + ' != ' + m[1]);
  } else good('the three report buckets sum to ' + m[1] + ' scanned');
}

console.log('');
if (FAILS.length) {
  console.log('RED — ' + FAILS.length + ' failure(s). The orientation map is what a new session reads to');
  console.log('get caught up; a map that has lost a section is worse than no map, because it is believed.');
  process.exit(1);
}
console.log('GREEN — the map derives every section, and every section fails loudly when its input goes.');
