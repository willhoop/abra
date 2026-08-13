/* test-fixture-legality.js — a NEW illegal fixture entity fails by name.
 *
 *   node tests/test-fixture-legality.js
 *
 * WHAT IT GUARDS. CLAUDE.md's cardinal rule: never name a Pokemon, item, ability or move that is not
 * in the regulation — "every example, every illustration and every derived result". A fixture built
 * on a set that cannot legally exist is testing a game we do not play, and every number it produces
 * inherits that. The two instances that prompted this were BOTH found in passing rather than by a
 * check: `engine/feature_fixture.js` gave Venusaur a Rocky Helmet (banned here since 2026-08-04), and
 * eight illegal learnset pairs sat in tests/staged_status_counters.js in scenarios that were green.
 *
 * THE VERDICT IS `TeamValidator#validateTeam`'s AND NOTHING HERE SECOND-GUESSES IT. The sweep in
 * engine/fixture_legality.js calls champions_sim.checkLegal, which is that validator with proved-clean
 * padding, and the ratchet keys on the validator's own sentence. That is stronger and smaller than the
 * species/ability/item/learnset check first proposed for this job — a piecemeal check only finds the
 * rules somebody thought to write, while the validator carries the 66-point budget, the 32 cap, the
 * item clause and every ban the Champions mod adds next.
 *
 * THE RATCHET, AND WHY IT IS SHAPED LIKE data/fixture-learnset-baseline.json. Turning this on
 * red-lights fixtures that have been green for weeks, and repairing them is its own batch: each repair
 * changes what its scenario measures, and folding forty of those into the pass that ADDS the check
 * makes both unattributable. So a verdict already on the baseline is REPORTED and does not fail; a
 * verdict that is not fails by name. The list may only SHRINK, and that is asserted too — a baseline
 * entry nobody produces any more is a repair, and leaving it behind lets the next illegal set hide
 * under a stale allowance.
 *
 * TWO KINDS OF BASELINE ENTRY, AND THEY ARE NOT THE SAME CLAIM:
 *   DELIBERATE   — the fixture stages an impossible pairing ON PURPOSE. An isolation probe stamps one
 *                  named quiet ability on every body precisely so the control does not vary with the
 *                  species; forcing a per-species legal control is the Fluffy/Sand Rush failure that
 *                  produced four false findings across 2,049 uses. champions_sim.classify() already
 *                  draws this line, calling "can't learn"/"can't have" PAIRING and declarable.
 *   PRE-EXISTING — a real defect, held because repairing it moves what its scenario measures.
 * Both carry a written reason. Neither is silence.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

const FL = require(D('engine', 'fixture_legality.js'));
const BASELINE_PATH = D('data', 'fixture-legality-baseline.json');

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const ok = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);

console.log('FIXTURE LEGALITY — a fixture set the game would refuse\n');

const base = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
const allowed = new Map((base.verdicts || []).map(v => [FL.keyOf(v.problem), v]));

const r = FL.sweep();
note(`${r.filesScanned} files, ${r.declarations} set declarations, ${r.distinctSets} distinct sets`);
note(`${r.notStaticallyPaired} construction sites declare no literal set and are outside this population`);

/* ---- 1. the population is not empty --------------------------------------------------------- */
/* A scanner that finds nothing passes every clause below it. That is the shape of every failure this
 * repository keeps having, so the floor is asserted rather than hoped for. */
if (r.distinctSets >= 150) ok(`the sweep found ${r.distinctSets} distinct sets to validate`);
else fail(`the sweep found only ${r.distinctSets} distinct sets — it found 227 when it was written, `
  + 'so something has stopped matching and every clause below is vacuous');

/* ---- 2. no NEW illegal verdict ---------------------------------------------------------------- */
const seen = new Set();
const fresh = [];
for (const f of r.findings) {
  seen.add(f.key);
  if (!allowed.has(f.key)) fresh.push(f);
}
if (!fresh.length) {
  ok(`no new illegal fixture set — ${r.findings.length} verdicts, all ${r.findings.length} on the baseline`);
} else {
  fail(`${fresh.length} NEW illegal fixture set(s). The game would refuse these teams:`);
  for (const f of fresh) {
    note(`  [${f.kind}] ${f.problem}`);
    for (const s of [...new Set(f.sets)]) note(`      set:   ${s}`);
    note(`      sites: ${f.sites.join(', ')}`);
  }
  note('  Fix the fixture. If the illegality is DELIBERATE — an isolation probe staging a pairing on');
  note('  purpose — add it to data/fixture-legality-baseline.json with kind "DELIBERATE" and a reason.');
}

/* ---- 3. the baseline may only shrink ---------------------------------------------------------- */
const stale = [...allowed.keys()].filter(k => !seen.has(k));
if (!stale.length) {
  ok(`every one of the ${allowed.size} baselined verdicts is still produced — no stale allowance`);
} else {
  fail(`${stale.length} baselined verdict(s) are no longer produced. They were repaired; remove them `
    + 'from the baseline so the next illegal set cannot hide under a stale allowance:');
  for (const k of stale) note('      ' + (allowed.get(k).problem));
}

/* ---- 4. every baseline entry states its kind and its reason ----------------------------------- */
const KINDS = new Set(['DELIBERATE', 'PRE-EXISTING']);
const undeclared = (base.verdicts || []).filter(v => !KINDS.has(v.kind) || !v.why || v.why.length < 20);
if (!undeclared.length) ok(`all ${allowed.size} baseline entries carry a kind and a written reason`);
else {
  fail(`${undeclared.length} baseline entr(ies) carry no kind or no reason — a baseline without a `
    + 'reason is silence with a filename:');
  for (const v of undeclared) note('      ' + v.problem);
}

/* ---- 5. a literal that names nothing in the format --------------------------------------------- */
/* Not an illegal set: a string that resolves to no entity at all, so the validator is never asked
 * about it and the fixture silently runs without whatever it thought it had. */
const knownStray = new Set((base.unknownLiterals || []).map(x => String(x.literal).toLowerCase()));
const newStray = r.unknownLiterals.filter(u => !knownStray.has(String(u.literal).toLowerCase()));
if (!newStray.length) ok(`no new stray literal (${r.unknownLiterals.length} known)`);
else {
  fail(`${newStray.length} string literal(s) inside a set declaration name nothing in this format. `
    + 'The set is built WITHOUT them and reports success:');
  for (const u of newStray) note(`      "${u.literal}"   ${u.sites.join(', ')}`);
}

/* ---- 6. the guard can go red ------------------------------------------------------------------- */
/* PROVED ON EVERY RUN, not demonstrated once and described afterwards. A ratchet whose matching has
 * quietly stopped working looks exactly like a clean tree. An invented verdict must be reported NEW
 * and a baselined one must not, through the same comparison clause 2 uses. */
{
  const planted = { key: FL.keyOf("Snorlax can't learn Made Up Move."), problem: "Snorlax can't learn Made Up Move." };
  const isNew = (k) => !allowed.has(k);
  const realOne = r.findings[0];
  if (isNew(planted.key) && realOne && !isNew(realOne.key)) {
    ok('the ratchet still discriminates: a planted verdict reads NEW, a baselined one does not');
  } else {
    fail('THE RATCHET NO LONGER DISCRIMINATES — a planted verdict was not reported new, or a '
      + 'baselined one was. Every green above is meaningless until this is fixed.');
  }
}

console.log(`\nFIXTURE LEGALITY: ${failures === 0 ? 'ALL GREEN' : failures + ' FAILED'}`);
process.exit(failures ? 1 : 0);
