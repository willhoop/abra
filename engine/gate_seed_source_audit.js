/* gate_seed_source_audit.js — ROADMAP #287: `data/seed-source-audit.json` NAMES A CLASS BY
 * SUBSTRING-MATCHING A HAND-TYPED LIST OF FIFTEEN FIELD NAMES, AND ASSERTS A CLOSED REGISTER ROW IS
 * OPEN. The row's own `INSTRUMENT OWED`, built.
 *
 * ================= WHAT THE ROW ASKED FOR, IN ITS OWN WORDS ======================================
 *
 *   "INSTRUMENT OWED: a check comparing the artifact's `readUnmodelledStateList` against
 *    `board.unmodelledBasePower(dex, board)` — asking the callbacks instead of their spelling,
 *    which is self-correcting where a fifteen-string list is the ban-list-of-four shape"
 *
 * TWO ARMS, BECAUSE THE ROW MAKES TWO CLAIMS AND ONE OF THEM IS NOT ABOUT POKEMON AT ALL.
 *
 * ARM 1 — THE CLASS, ASKED RATHER THAN SPELLED. `engine/seed_source_audit.js`'s `STUB_HAS_NO` is a
 * literal array of fifteen strings tested with `src.includes(k)` against each callback's source text,
 * so `watershuriken` is in the class for the `battle` inside `hasAbility("battlebond")` — a callback
 * that answers correctly and has never fallen back — while every callback whose field name nobody
 * typed is missing from it. `board.unmodelledBasePower` asks the callback to produce a number and
 * records the ones that cannot; that is self-correcting and a list of fifteen strings is not. The two
 * ID SETS are compared BOTH WAYS and both directions are reported by name, because "it over-reports"
 * and "it under-reports" are different repairs.
 *
 * THE DERIVED SIDE IS A UNION OVER BOARDS, AND THAT IS A DECISION RATHER THAN A DETAIL.
 * `unmodelledBasePower` takes the CALLER'S board — its own header says it doubles as a live probe —
 * so a callback can answer on one position and fall through on another (`beatup` reads `allies` and
 * answers on any board with a body on it). The class the artifact is trying to name is "cannot
 * produce a number", so the honest derivation is the union over an empty board plus every one of
 * `engine/feature_fixture.js`'s staged boards. Naming one board would make this gate's verdict a
 * property of that board.
 *
 * ARM 2 — THE ARTIFACT ASSERTS A REGISTER ROW IS OPEN AND THE REGISTER SAYS IT IS CLOSED. Its
 * `openAndNotFixed` block states that #244's remainder is unfixed pending a refit; #244 has read
 * CLOSED since #283 landed. The closed-detector is IMPORTED from `engine/quarantine.js`, never
 * copied — CLAUDE.md's rule is that two files deciding one fact disagree eventually and the
 * disagreement is invisible because both keep working, and this repository has already paid for that
 * detector twice.
 *
 * WHAT IT DOES NOT DO. It does not regenerate the artifact, and the row explains why: doing so today
 * bakes ENGINE's in-flight `data/tags.json` into it, and a measurement is a photograph. It reads.
 *
 *   node engine/gate_seed_source_audit.js            the verdict, with every disagreement named
 *   node engine/gate_seed_source_audit.js --json
 *   node engine/gate_seed_source_audit.js --selftest every branch on synthetic input, red and green
 *
 * Loads the dex, the board and the fixture. Plays no games and writes no artifact. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const has = (f) => process.argv.includes(f);
const ART = path.join(ROOT, 'data', 'seed-source-audit.json');

/* THE VERDICT TABLE, EXTRACTED SO THE SELFTEST DRIVES THE SHIPPING FUNCTION. Exit 2 is RED to
 * `register_reality.js` exactly as 1 is: a gate that exits 0 because it could not look would close a
 * live defect, which is the loudest failure an audit tool has. */
function verdict(m) {
  if (!m || m.error) return { code: 2, tag: 'CANNOT ANSWER', why: (m && m.error) || 'no measurement' };
  const bad = m.falsePositives.length + m.misses.length + m.falseClaims.length;
  if (!bad) {
    return { code: 0, tag: 'CLEAN',
      why: 'the artifact\'s class list matches what the callbacks actually answer (' + m.derived.length
         + ' derived, ' + m.claimed.length + ' claimed), and no `openAndNotFixed` entry names a row '
         + 'the register reads as closed.' };
  }
  const parts = [];
  if (m.falsePositives.length) parts.push(m.falsePositives.length + ' claimed and NOT derived ('
    + m.falsePositives.join(', ') + ')');
  if (m.misses.length) parts.push(m.misses.length + ' derived and NOT claimed (' + m.misses.join(', ') + ')');
  if (m.falseClaims.length) parts.push(m.falseClaims.length + ' `openAndNotFixed` entr(ies) naming a '
    + 'register row that reads CLOSED (' + m.falseClaims.map((f) => '#' + f.row).join(', ') + ')');
  return { code: 1, tag: 'LIVE', why: 'THE ARTIFACT DISAGREES WITH THE CALLBACKS: ' + parts.join('; ') + '.' };
}

/* ---- the measurement ------------------------------------------------------------------------- */
function measure() {
  let j = null;
  try { j = JSON.parse(fs.readFileSync(ART, 'utf8')); }
  catch (e) { return { error: 'NO ARTIFACT — data/seed-source-audit.json could not be read ('
    + String((e && e.message) || e).split('\n')[0] + ').' }; }

  const cls = j.basePowerCallbackClass;
  if (!cls || !Array.isArray(cls.readUnmodelledStateList)) {
    return { error: 'THE ARTIFACT CARRIES NO `basePowerCallbackClass.readUnmodelledStateList`, so '
                  + 'there is no claim here to compare against. Keys found: '
                  + Object.keys(j).join(', ') + '. NO ROWS and I CANNOT SEE THE ROWS are the two '
                  + 'answers this refuses to confuse.' };
  }

  const B = require('./board.js');
  const CS = require('./champions_sim.js');
  const dex = CS.sim().Dex.forFormat(CS.FORMAT);
  if (typeof B.unmodelledBasePower !== 'function') {
    return { error: 'engine/board.js no longer exports `unmodelledBasePower`, which is the whole of '
                  + 'the repair #287 names. Re-read the row before trusting a verdict from here.' };
  }
  /* The empty board FIRST (the function's own documented default), then every canonical staged
   * board. See the header for why this is a union. */
  const derivedSet = new Map();
  const add = (rows) => { for (const r of rows) if (!derivedSet.has(r.id)) derivedSet.set(r.id, r); };
  add(B.unmodelledBasePower(dex, null));
  let boards = 0;
  try {
    const FIX = require('./feature_fixture.js');
    const seen = new Set();
    for (const s of FIX.build(dex)) {
      if (seen.has(s.board)) continue;
      seen.add(s.board); boards++;
      add(B.unmodelledBasePower(dex, s.board));
    }
  } catch (e) {
    /* A FIXTURE THAT WILL NOT BUILD IS REPORTED, NEVER SWALLOWED — the union would silently narrow
     * and the gate would go green by looking at less. */
    return { error: 'THE CANONICAL FIXTURE WOULD NOT BUILD — ' + String((e && e.message) || e).split('\n')[0]
                  + '. The derived side would be a union over one board instead of thirteen, so the '
                  + 'comparison is refused rather than narrowed.' };
  }

  const derived = Array.from(derivedSet.keys()).sort();
  const claimed = cls.readUnmodelledStateList.map((r) => String(r && r.id)).filter(Boolean).sort();
  const falsePositives = claimed.filter((id) => !derivedSet.has(id));
  const misses = derived.filter((id) => claimed.indexOf(id) < 0);

  /* ARM 2 — the register rows the artifact asserts are open. */
  const Q = require('./quarantine.js');
  const lines = fs.readFileSync(path.join(ROOT, 'docs', 'ROADMAP.md'), 'utf8').split(/\r?\n/);
  const rowLine = (n) => lines.find((l) => new RegExp('^\\|\\s*#' + n + '\\s*\\|').test(l)) || null;
  const asserts = [];
  const oanf = j.openAndNotFixed;
  for (const e of (Array.isArray(oanf) ? oanf : (oanf ? [oanf] : []))) {
    if (e && e.row != null) asserts.push({ row: +e.row, what: String(e.what || '') });
  }
  const falseClaims = [];
  for (const a of asserts) {
    const l = rowLine(a.row);
    if (!l) { falseClaims.push({ row: a.row, why: 'no such row in docs/ROADMAP.md at all' }); continue; }
    if (Q.roadmapRowIsClosed(l)) falseClaims.push({ row: a.row, why: 'the register reads this row CLOSED' });
  }

  return { generated: j.generated || null, derived, claimed, falsePositives, misses, falseClaims,
    asserts: asserts.map((a) => a.row), boards, claimedCount: cls.readUnmodelledState };
}

/* ---- selftest ---------------------------------------------------------------------------------- */
if (has('--selftest')) {
  let ran = 0, bad = 0;
  const ok = (n, c, got) => { ran++; if (!c) bad++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}${c ? '' : '   got ' + JSON.stringify(got)}`); };
  const M = (o) => Object.assign({ derived: ['a'], claimed: ['a'], falsePositives: [], misses: [],
    falseClaims: [] }, o);

  ok('GREEN only when BOTH directions agree and no closed row is asserted open',
    verdict(M({})).code === 0, verdict(M({})));
  ok('RED — a claimed id the callbacks do NOT fall through on (the watershuriken direction) is exit 1',
    verdict(M({ falsePositives: ['watershuriken'] })).code === 1);
  ok('RED — a derived id the artifact never claims (the ragefist direction) is exit 1',
    verdict(M({ misses: ['ragefist'] })).code === 1);
  ok('RED — an `openAndNotFixed` entry naming a CLOSED register row is exit 1 on its own, with no '
    + 'set disagreement at all',
    verdict(M({ falseClaims: [{ row: 244, why: 'closed' }] })).code === 1);
  ok('the LIVE verdict names BOTH directions separately, because they are different repairs',
    /claimed and NOT derived/.test(verdict(M({ falsePositives: ['x'], misses: ['y'] })).why)
    && /derived and NOT claimed/.test(verdict(M({ falsePositives: ['x'], misses: ['y'] })).why));
  ok('RED — a missing or unreadable artifact is CANNOT ANSWER (exit 2) and is never 0',
    verdict({ error: 'NO ARTIFACT' }).code === 2 && verdict(null).code === 2);

  console.log(`\nSEED-SOURCE-AUDIT GATE SELFTEST: ${ran - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

/* ---- the run ----------------------------------------------------------------------------------- */
let m = null;
try { m = measure(); }
catch (e) { m = { error: 'THE MEASUREMENT THREW — ' + String((e && e.message) || e).split('\n')[0] }; }
const v = verdict(m);
const out = {
  row: 287, gate: 'engine/gate_seed_source_audit.js', artifact: 'data/seed-source-audit.json',
  generated: m.generated || null,
  derived_from: 'engine/board.js unmodelledBasePower(dex, board), union over an empty board and '
              + (m.boards || 0) + ' canonical fixture board(s)',
  derived: m.derived || [], claimed: m.claimed || [],
  claimed_and_not_derived: m.falsePositives || [], derived_and_not_claimed: m.misses || [],
  open_rows_asserted: m.asserts || [], false_claims: m.falseClaims || [],
  verdict: v.tag, exit: v.code, why: v.why,
};

if (has('--json')) { console.log(JSON.stringify(out, null, 2)); process.exit(v.code); }

console.log('');
console.log('ROADMAP #287 — the artifact spells the class instead of asking the callbacks');
console.log('  artifact  data/seed-source-audit.json   generated ' + (out.generated || '?'));
console.log('  derived   ' + out.derived_from);
console.log('');
console.log('    claimed by the artifact   ' + (out.claimed.join(', ') || '(none)'));
console.log('    derived from the engine   ' + (out.derived.join(', ') || '(none)'));
console.log('');
console.log('  ' + v.tag + '   ' + v.why);
for (const f of out.false_claims) console.log('      #' + f.row + ' — ' + f.why);
console.log('');
console.log('  exit ' + v.code + '   [0 clean, 1 the artifact disagrees with the engine, 2 cannot answer]');
console.log('');
process.exit(v.code);
