/* THE SCOPE AUTHORITY SILENTLY DROPPED A LIVE ABILITY, AND EVERY COVERAGE REPORT SAID FULL.
 *
 *   SHOWDOWN_PATH=... node tests/probe_future_scope_readmission.js
 *   ABRA_SCOPE_STRICT_FUTURE=1 SHOWDOWN_PATH=... node tests/probe_future_scope_readmission.js
 *                                                                        (the red demonstration)
 *
 * ================= WHAT HAPPENED ================================================================
 *
 * `engine/legal_scope.js` is the ONE authority on what is in scope — `engine/coverage.js` (the
 * denominator), `engine/stage_planner.js` (the fixtures) and `engine/tag_dex.js` all defer to it. It
 * built its candidate list with CLAUDE.md's strict filter, `x.exists && !x.isNonstandard && x.tier
 * !== 'Illegal'`, and answered `NOT-LEGAL` for anything the filter rejected — including an entry
 * marked `isNonstandard: 'Future'`.
 *
 * Reg M-C carries exactly such an ability. `auraguard` has a real handler body,
 * `onSourceModifyDamage(damage, source, target, move) { if (move.flags["contact"]) return
 * this.chainModify(0.5); }`, it is the sole ability of `lucariomegaz`, and the M-C `TeamValidator`
 * ACCEPTS the set `Lucario @ Lucarionite Z`. It got no `data/tags.json` row, no probe and no roster
 * stage — while coverage reported FULL. A capability absent with everything reporting success, which
 * is the 2026-07-28 failure this project is organised against.
 *
 * WILL, 2026-09-20: *"lets use the showdown team validator again for reg mc"*. LEGALITY IS WHAT THE
 * `TeamValidator` ACCEPTS. `isNonstandard: 'Future'` is a release marker on an upstream row, not a
 * verdict about this regulation. So the strict filter stays — it is right, and it exists because an
 * unfiltered dex walk once invented five exceptions to a rule that has none — but its output is now a
 * CANDIDATE list, and every `Future` entry is put to the validator in the set it is actually reached
 * through.
 *
 * ================= WHAT THIS PROBE ASSERTS ======================================================
 *
 * That the authority ASKED. Not that anything was re-admitted — on the pinned Reg M-B authority
 * `20ad99f` the validator refuses all 20 candidates and the answer is correctly unchanged. The defect
 * was never a wrong verdict; it was a verdict that was never sought. So clause 2 fails the moment a
 * candidate carries anything other than a TeamValidator answer, which is exactly what
 * `ABRA_SCOPE_STRICT_FUTURE=1` restores.
 *
 * Clause 3 is the non-widening proof `engine/tag_dex.js` now leans on: its `collect()` filter and its
 * `LEGAL_CARRIED` walk both stopped deciding scope themselves and ask `isLegal` instead, so `isLegal`
 * must equal the old strict test everywhere except on a re-admitted id. */
'use strict';
const path = require('path');
const R = p => require(path.join(__dirname, '..', p));
const CS = R('engine/champions_sim.js');
const LS = R('engine/legal_scope.js');

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

const STRICT = process.env.ABRA_SCOPE_STRICT_FUTURE === '1';
const dex = CS.dexFor(CS.FORMAT);
const S = LS.derive();
console.log('\nFUTURE-FLAGGED SCOPE RE-ADMISSION — ' + CS.FORMAT + ' @ ' + CS.actualCommit()
  + (STRICT ? '\n  ABRA_SCOPE_STRICT_FUTURE=1 — RE-ADMISSION IS OFF (red demonstration)' : ''));

const isFuture = x => !!(x && x.exists && x.isNonstandard === 'Future');
const dexFuture = [
  ...dex.species.all().filter(isFuture).map(x => ({ kind: 'species', id: x.id })),
  ...dex.abilities.all().filter(isFuture).map(x => ({ kind: 'ability', id: x.id })),
  ...dex.moves.all().filter(isFuture).map(x => ({ kind: 'move', id: x.id })),
  ...dex.items.all().filter(isFuture).map(x => ({ kind: 'item', id: x.id })),
];

/* ---- 1. NOTHING IS SKIPPED --------------------------------------------------------------------- */
const rowKey = r => r.kind + ':' + r.id;
const asked = new Set((S.future || []).map(rowKey));
const missed = dexFuture.filter(x => !asked.has(rowKey(x))).map(rowKey);
ok(dexFuture.length > 0 && missed.length === 0,
  'every `Future`-flagged entry of this regulation reaches the authority and gets a row — a silently '
  + 'absent candidate is the whole defect',
  dexFuture.length + ' in the dex, ' + asked.size + ' rows'
  + (missed.length ? '  MISSING: ' + missed.join(', ') : '')
  + (dexFuture.length ? '' : '  (this regulation flags nothing `Future` — the probe can see nothing here)'));

/* ---- 2. THE ASSERTION: EVERY ROW CARRIES A TeamValidator ANSWER -------------------------------- */
const unasked = (S.future || []).filter(r => !r.accepted && /ABRA_SCOPE_STRICT_FUTURE/.test(String(r.problem)));
ok(unasked.length === 0,
  'every candidate was PUT TO THE TeamValidator and the row records its answer — never refused on the '
  + '`isNonstandard` marker alone',
  unasked.length ? unasked.length + ' of ' + (S.future || []).length + ' were refused without being asked:\n          '
    + unasked.map(r => rowKey(r) + '  ' + r.problem).join('\n          ')
    : (S.future || []).length + ' row(s), each carrying the validator\'s own words, e.g. '
      + ((S.future || []).map(r => rowKey(r) + ' -> ' + (r.accepted ? 'ACCEPTED ' + r.asked : '"' + r.problem + '"'))[0] || '(none)'));

/* ---- 3. RE-PUT THE IDENTICAL SET TO THE VALIDATOR, INDEPENDENTLY ------------------------------- */
const disagree = [];
for (const r of (S.future || [])) {
  if (!r.ask) continue;
  const v = CS.checkLegal(r.ask);
  const mine = !!(v && v.legal);
  if (mine !== !!r.accepted) disagree.push(rowKey(r) + ': the authority says ' + r.accepted
    + ', an independent ask says ' + mine + ' (' + (((v && v.problems) || [])[0] || 'no problem') + ')');
}
ok(disagree.length === 0 || STRICT,
  'an INDEPENDENT ask of the same set agrees with every row — the admission rule is the validator, '
  + 'not a second predicate' + (STRICT ? '  [waived under the knob: it did not ask]' : ''),
  disagree.length ? disagree.join('\n          ') : (S.future || []).filter(r => r.ask).length + ' set(s) re-asked, all agreed');

/* ---- 4. NON-WIDENING: the candidate set is the strict filter PLUS the re-admitted, and nothing else */
const readmitted = new Set(S.futureReadmitted || []);
const widened = [];
for (const [kind, list] of [['move', dex.moves.all()], ['ability', dex.abilities.all()], ['item', dex.items.all()]]) {
  for (const x of list) {
    if (!x.exists) continue;
    const strict = !x.isNonstandard;
    const now = S.isLegal(kind, x.id);
    const want = strict || readmitted.has(kind + ':' + x.id);
    if (now !== want) widened.push(kind + ':' + x.id + ' strict=' + strict + ' readmitted='
      + readmitted.has(kind + ':' + x.id) + ' isLegal=' + now);
  }
}
ok(widened.length === 0,
  'the candidate set is EXACTLY the strict filter plus the re-admitted — this is what tag_dex\'s '
  + '`collect()` and `LEGAL_CARRIED` now rely on instead of deciding scope themselves',
  widened.length ? widened.join('\n          ')
    : 'checked ' + dex.moves.all().length + ' moves, ' + dex.abilities.all().length + ' abilities, '
      + dex.items.all().length + ' items — 0 disagreements');

/* ---- 5. A RE-ADMITTED ENTITY IS ACTUALLY REACHABLE --------------------------------------------- */
const unreachable = [];
for (const k of readmitted) {
  const [kind, id] = k.split(':');
  if (kind === 'species') continue;
  const v = S.verdict(kind, id);
  if (v.code === 'NOT-LEGAL') unreachable.push(k + ' -> ' + JSON.stringify(v));
}
ok(unreachable.length === 0,
  'every re-admitted mechanic now has a real verdict instead of NOT-LEGAL, so it can carry a tag, a '
  + 'probe and a roster stage',
  readmitted.size
    ? [...readmitted].map(k => { const [kd, id] = k.split(':'); return k + ' -> ' + (kd === 'species' ? 'species' : S.verdict(kd, id).code); }).join(', ')
    : 'NONE re-admitted in this regulation — that is a fact about this checkout, not a pass by default');

console.log('\n  RE-ADMITTED: ' + ((S.futureReadmitted || []).join(', ') || 'none'));
console.log('  REFUSED:     ' + ((S.future || []).filter(r => !r.accepted)
  .map(r => rowKey(r) + ' "' + String(r.problem).slice(0, 70) + '"').join('\n               ') || 'none'));

console.log('\n  ' + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
