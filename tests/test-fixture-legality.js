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
 *
 * WHAT WAS WRONG WITH THAT RATCHET, FOUND AND FIXED 2026-08-14 (ROADMAP #266)
 * ---------------------------------------------------------------------------
 * (1) IT COULD BE LAUNDERED, and by exactly the edit that also fixes things. "Repair a verdict" and
 *     "excuse a new one" were the same action: delete a line here, or add one. Clause 3 forced the
 *     list to SHRINK but nothing stopped it being refilled with fresh offenders under the label
 *     PRE-EXISTING — a label that is a CLAIM ABOUT TIME. So the closed historical set is now written
 *     down (`origin`, the 41 sentences that existed when the check was added) and clause 7 refuses any
 *     PRE-EXISTING entry that is not in it. A genuinely new illegal set can still be declared, but
 *     only as DELIBERATE and only with a reason — which is a different, visible, arguable act.
 * (2) IT COUNTED THE WRONG THING. `validateTeam` returns ONE complaint per Pokemon, so a set with
 *     four unlearnable moves produced one sentence, and repairing the first made the second appear as
 *     a NEW verdict — a repair reading as a regression. The sweep now also asks checkCanLearn per
 *     declared move and this file ratchets those PAIRS beside the sentences (clause 5).
 * (3) IT DID NOT SEPARATE THE ONE CLASS THAT COSTS THE MOST. An entity with NO LEGAL CARRIER anywhere
 *     in the regulation is not "a body chosen badly"; it is a mechanic this format cannot produce, and
 *     a probe that fails on it reads as an ENGINE DEFECT when the engine is correct not to model it.
 *     Four phantom defects were filed from that shape in one session on 2026-08-14, one of them ranked
 *     first of fourteen and put in front of Will as the place to start. Clause 6 makes UNREACHABLE its
 *     own declared class and refuses to let it be called DELIBERATE.
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

/* ---- 5. the PAIR ratchet — nothing hides behind the validator's first-failure ------------------ */
/* The verdict list is keyed on the authority's sentence and that stays the ratchet. But one sentence
 * can stand in front of several illegal declarations, because validateTeam stops at the first problem
 * per Pokemon: on the day this clause was added the sweep reported 32 verdicts and 34 pairs, the two
 * extras being Swords Dance on a Toxapex and on a Clefable that were each masked by a different move
 * in the same set. A ratchet that cannot see them lets a repair look like a regression, and lets a
 * second illegal move ride into the tree behind a first that is already excused. */
{
  const knownPairs = new Map((base.pairs || []).map(p => [FL.keyOf(p.problem), p]));
  const freshPairs = r.pairs.filter(p => !knownPairs.has(p.key));
  const gonePairs = [...knownPairs.keys()].filter(k => !r.pairs.some(p => p.key === k));
  if (!freshPairs.length) ok(`no new illegal declaration — ${r.pairs.length} pairs, all on the baseline`);
  else {
    fail(`${freshPairs.length} NEW illegal DECLARATION(S) that no verdict sentence names:`);
    for (const p of freshPairs) note(`  [${p.cls}] ${p.problem}   carriers: ${p.carriers}   ${p.sites.join(', ')}`);
  }
  if (!gonePairs.length) ok(`every one of the ${knownPairs.size} baselined declarations is still produced`);
  else {
    fail(`${gonePairs.length} baselined declaration(s) are no longer produced — remove them from the `
      + 'baseline\'s `pairs` so the next one cannot hide under a stale allowance:');
    for (const k of gonePairs) note('      ' + knownPairs.get(k).problem);
  }
}

/* ---- 6. UNREACHABLE is its own class, and it can never be DELIBERATE --------------------------- */
/* An entity NOTHING in this regulation can carry is not a pairing an isolation probe stages on
 * purpose — there is no body to stage it on. It is the shape that manufactures phantom engine
 * defects, so it is named in the report every run rather than sitting inside a count. */
{
  const un = r.unreachable || [];
  const declared = new Set((base.verdicts || []).filter(v => v.unreachable).map(v => FL.keyOf(v.problem)));
  const undeclaredUn = un.filter(p => !declared.has(p.key));
  if (!un.length) ok('no fixture declares an entity with zero legal carriers');
  else {
    note(`${un.length} UNREACHABLE declaration(s) — nothing in this regulation can carry these, so a `
      + 'probe that fails on one is NOT evidence of an engine defect:');
    for (const p of un) note(`      ${p.problem}   ${p.sites.join(', ')}`);
    if (undeclaredUn.length) {
      fail(`${undeclaredUn.length} of them are on the baseline WITHOUT \`unreachable: true\` and a `
        + 'reason that says so. A caption inside a count is how these get quoted as defects:');
      for (const p of undeclaredUn) note('      ' + p.problem);
    } else ok(`all ${un.length} are declared \`unreachable\` on the baseline, with a written reason`);
  }
  const badKind = (base.verdicts || []).filter(v => v.unreachable && v.kind === 'DELIBERATE');
  if (badKind.length) fail(`${badKind.length} baseline entr(ies) call an UNREACHABLE entity DELIBERATE. `
    + 'There is no body in this format to stage it on, so it cannot have been staged on purpose.');
  else ok('no UNREACHABLE entry is excused as DELIBERATE');
}

/* ---- 7. the closed origin set — PRE-EXISTING is a claim about TIME, and it is checked ---------- */
{
  const origin = base.origin || {};
  const keys = new Set(origin.keys || []);
  /* 41 is the count the roadmap row was opened with on 2026-08-13 and is history: it is anchored here
   * as well as in the artifact so that moving it takes two deliberate edits and a false statement. */
  if (origin.count !== 41 || keys.size !== 41) {
    fail(`the origin set holds ${keys.size} keys and declares ${origin.count} — it must be the 41 `
      + 'verdicts that existed when this check was added on 2026-08-13. It is HISTORY and cannot change.');
  } else ok('the closed origin set is intact at 41 historical verdicts');
  const smuggled = (base.verdicts || []).filter(v => v.kind === 'PRE-EXISTING' && !keys.has(FL.keyOf(v.problem)));
  if (!smuggled.length) ok('every PRE-EXISTING entry is one of the 41 — none was added after the freeze');
  else {
    fail(`${smuggled.length} entr(ies) claim to be PRE-EXISTING but are not in the closed origin set. `
      + 'PRE-EXISTING means "it predates the check"; a new offender must be repaired, or declared '
      + 'DELIBERATE with a reason, which is a visible act rather than a quiet one:');
    for (const v of smuggled) note('      ' + v.problem);
  }
}

/* ---- 8. a literal that names nothing in the format --------------------------------------------- */
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

/* ---- 9. the guard can go red ------------------------------------------------------------------- */
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
