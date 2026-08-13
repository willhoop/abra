/* test-hazard-side.js — ROADMAP #254. Whose side does a side condition land on?
 *
 * DERIVED, NEVER TYPED: the expected side comes from `move.target` read out of
 * Dex.forFormat('gen9championsvgc2026regmb') and filtered to legal, not from a list of hazard
 * names. Every legal side-condition move in the regulation is walked, so a hazard added by a future
 * regulation is covered without editing this file. Measured 2026-08-13: 11 moves, 7 `allySide`,
 * 4 `foeSide` (Stealth Rock, Spikes, Sticky Web, Toxic Spikes), and ZERO using `self.sideCondition`
 * — which is why `move.target === 'foeSide'` is the whole predicate.
 *
 * BOTH DIRECTIONS, because a write-only fix is worse than the bug:
 *   (A) PLACEMENT — a hazard laid by p1 must be on p2's side and NOT on p1's.
 *   (B) READBACK  — p1 clicking it again must still read deadSide=1 and setupTurns=0.
 * (B) passed at HEAD for the WRONG REASON — the write and both reads were wrong together, so the
 * error cancelled — and it is what breaks if only the write moves. Measured on a write-only variant
 * compiled in memory before the fix landed: 8 unreadable, `deadSide` 0 after the hazard was laid,
 * i.e. the model re-lays Stealth Rock every turn believing it is not up.
 *
 * `setupTurns` is asserted CONDITIONALLY below, and that is not laziness: measured 2026-08-13, none
 * of the four hazards carries a `condition.duration`, so setupTurns is 0 for them under every
 * variant. The clause fires for the seven allySide setters, which do carry one.
 *
 * CONTROLS: an `allySide` move (Reflect) must still land on the caster, or the fix has simply
 * inverted everything; and the foe must not be able to reuse the layer's rocks as "already up".
 *
 * RED PROOF: at HEAD (before engine/board.js grew `sideFor`) this reported 5 passed, 3 failed —
 * both placement arms and the Stealth Rock control. It landed in the SAME commit as the fix,
 * deliberately, because a red test nobody can close is the banned "known failure".
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'engine', 'showdown_path.js'));
const B = require(path.join(ROOT, 'engine', 'board.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

/* ---- DERIVE the population ------------------------------------------------------------------ */
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const SC = [];
for (const m of dex.moves.all()) {
  if (!legal(m) || !m.sideCondition) continue;
  SC.push({ id: m.id, name: m.name, cond: m.sideCondition, target: m.target });
}
SC.sort((a, b) => a.target.localeCompare(b.target) || a.id.localeCompare(b.id));
console.log('DERIVED from the format — every legal side-condition move and the side it lands on:');
for (const s of SC) console.log(`  ${s.target.padEnd(10)} ${s.name.padEnd(15)} cond=${s.cond}`);
console.log(`  ${SC.length} moves: ${SC.filter(s => s.target === 'allySide').length} allySide, ` +
  `${SC.filter(s => s.target === 'foeSide').length} foeSide\n`);
ok(SC.length >= 11 && SC.some(s => s.target === 'foeSide') && SC.some(s => s.target === 'allySide'),
  'the walk found both allySide and foeSide setters (nothing to compare otherwise)');

const other = s => (s === 'p1' ? 'p2' : 'p1');
const expectedSide = (mover, mv) => (mv.target === 'foeSide' ? other(mover) : mover);

function fresh() {
  const bd = new B.Board();
  bd.switchIn('p1', 'a', 'Pelipper'); bd.switchIn('p1', 'b', 'Archaludon');
  bd.switchIn('p2', 'a', 'Garchomp'); bd.switchIn('p2', 'b', 'Incineroar');
  return bd;
}

/* ---- (A) PLACEMENT, both movers, every move -------------------------------------------------- */
console.log('(A) PLACEMENT — the condition lands on the side move.target names');
for (const mover of ['p1', 'p2']) {
  const wrong = [];
  for (const s of SC) {
    const bd = fresh(), user = bd.slot(mover, 'a'), mv = dex.moves.get(s.id);
    B.noteMove(bd, mover, user, mv, true);
    const want = expectedSide(mover, mv), notWant = other(want);
    if (!(bd.hasSide(want, mv.sideCondition) && !bd.hasSide(notWant, mv.sideCondition))) {
      wrong.push(`${s.name}(${s.target}) laid by ${mover}: on ${want}=${bd.hasSide(want, mv.sideCondition)} ` +
        `on ${notWant}=${bd.hasSide(notWant, mv.sideCondition)} (wanted ${want})`);
    }
  }
  ok(wrong.length === 0, `${mover} lays all ${SC.length}: ` +
    (wrong.length ? `${wrong.length} on the WRONG SIDE\n         ` + wrong.join('\n         ') : 'every one on the right side'));
}

/* ---- (B) READBACK — the reader must find what the writer wrote -------------------------------- */
console.log('\n(B) READBACK — after laying it, the same click reads deadSide=1 and setupTurns=0');
const iDead = B.FEATURE_INDEX.deadSide, iSetup = B.FEATURE_INDEX.setupTurns;
for (const mover of ['p1', 'p2']) {
  const blind = [];
  for (const s of SC) {
    const bd = fresh(), user = bd.slot(mover, 'a'), mv = dex.moves.get(s.id);
    const cand = B.candidates([s.id], user, bd, mover, dex)[0];
    if (!cand) { blind.push(`${s.name}: no candidate built`); continue; }
    const before = B.featuresFor(cand, user, bd, mover, dex, 0);
    B.noteMove(bd, mover, user, mv, true);
    const after = B.featuresFor(cand, user, bd, mover, dex, 0);
    const msgs = [];
    if (before[iDead] !== 0) msgs.push('deadSide was 1 BEFORE it was laid');
    if (after[iDead] !== 1) msgs.push('deadSide is 0 AFTER it was laid — the model will re-lay it');
    if (before[iSetup] > 0 && after[iSetup] !== 0) msgs.push(`setupTurns still ${after[iSetup]} after it was laid — re-credited`);
    if (msgs.length) blind.push(`${s.name}(${s.target}) by ${mover}: ` + msgs.join('; '));
  }
  ok(blind.length === 0, `${mover} re-clicks all ${SC.length}: ` +
    (blind.length ? `${blind.length} UNREADABLE\n         ` + blind.join('\n         ') : 'every one reads as already up'));
}

/* ---- CONTROL — allySide must NOT have been inverted ------------------------------------------- */
console.log('\nCONTROL — an allySide move still lands on the caster');
{
  const bd = fresh(), mv = dex.moves.get('reflect');
  B.noteMove(bd, 'p1', bd.slot('p1', 'a'), mv, true);
  ok(bd.hasSide('p1', 'reflect') && !bd.hasSide('p2', 'reflect'),
    `Reflect by p1 -> p1=${bd.hasSide('p1', 'reflect')} p2=${bd.hasSide('p2', 'reflect')}`);
}
{
  const bd = fresh(), mv = dex.moves.get('stealthrock');
  B.noteMove(bd, 'p1', bd.slot('p1', 'a'), mv, true);
  ok(!bd.hasSide('p1', 'stealthrock') && bd.hasSide('p2', 'stealthrock'),
    `Stealth Rock by p1 -> p1=${bd.hasSide('p1', 'stealthrock')} p2=${bd.hasSide('p2', 'stealthrock')}`);
}
/* the foe's own reader must see it too — a hazard is THEIR problem */
{
  const bd = fresh(), mv = dex.moves.get('stealthrock');
  B.noteMove(bd, 'p1', bd.slot('p1', 'a'), mv, true);
  const user2 = bd.slot('p2', 'a');
  const c2 = B.candidates(['stealthrock'], user2, bd, 'p2', dex)[0];
  const x2 = c2 ? B.featuresFor(c2, user2, bd, 'p2', dex, 0) : null;
  ok(x2 && x2[iDead] === 0, 'p2 laying Stealth Rock back is NOT dead — the rocks on p2 are not p2\'s to reuse');
}

/* ---- THE HELPER IS THE ONE ANSWER, AND THE CALLERS MUST USE IT -------------------------------- */
/* A second implementation of "whose side" is how the three call sites came to disagree by accident
 * in the first place, so the export is asserted rather than assumed, and the sweep's six external
 * callers are held to reading it off board.js instead of re-deciding it. */
console.log('\nONE ANSWER — sideFor is exported and every derivation site calls it');
ok(typeof B.sideFor === 'function', 'board.js exports sideFor');
if (typeof B.sideFor === 'function') {
  ok(B.sideFor('p1', dex.moves.get('stealthrock')) === 'p2' &&
     B.sideFor('p2', dex.moves.get('stealthrock')) === 'p1' &&
     B.sideFor('p1', dex.moves.get('reflect')) === 'p1' &&
     B.sideFor('p1', null) === 'p1',
    'sideFor flips only on foeSide, and tolerates a null move');
}
{
  const fs = require('fs');
  /* The offline derivation of `already` is copied verbatim into six other files (fit_policy.js is
   * the FIT ITSELF). Any of them still passing the bare mover's side would put the fit back on a
   * board where a hazard hurts the team that laid it. */
  const SITES = ['engine/fit_policy.js', 'engine/joint_rows.js', 'engine/branch_recall.js',
    'engine/corpus_shift.js', 'engine/feature_coverage.js', 'engine/redirect_audit.js'];
  const bad = [];
  for (const rel of SITES) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    /* non-greedy and length-capped, because the correct form `hasSide(B.sideFor(side, mv), ...)`
     * contains its own comma and paren — a `[^,)]+` argument matcher finds NOTHING once the site is
     * fixed, which reads as "the site is gone" rather than "the site is right". */
    const hits = src.match(/\.hasSide\([^;\n]{0,60}?mv\.sideCondition\s*\)/g) || [];
    if (!hits.length) { bad.push(`${rel}: no sideCondition read found — has this moved?`); continue; }
    for (const h of hits) if (!/sideFor/.test(h)) bad.push(`${rel}: ${h.trim()}`);
  }
  ok(bad.length === 0, `all ${SITES.length} sweep sites read sideFor: ` +
    (bad.length ? `${bad.length} still take the mover's side\n         ` + bad.join('\n         ') : 'none re-decides it'));
}

console.log(`\nHAZARD SIDE: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
