/* test-feature-semantics.js — the guard must catch a feature changing MEANING under a stable name.
 *
 * WHY THIS TEST EXISTS. On 2026-08-01 `board.js` changed what `allyHit` means without changing what
 * it is called: it began asking `getImmunity` before `getEffectiveness`, because getEffectiveness
 * returns 0 for immune AND for neutral, so a Flying partner standing beside Earthquake had been
 * reading as HIT. Every shipped weight had been fitted against the old definition.
 *
 * Nothing in the project failed. `magnemite.js:297` compares the joined feature NAMES and `:299`
 * compares the vector LENGTH, and both of those pass when a feature quietly starts meaning something
 * else — while 24 files read the vector it invalidates.
 *
 * `engine/feature_fixture.js` closes that gap by hashing each feature's values over a frozen set of
 * boards. The three checks below are deliberately different in kind, because a guard that is merely
 * PRESENT is what the project keeps getting bitten by:
 *
 *   1. SENSITIVITY — reproduce the exact 2026-08-01 change and assert the hashes MOVE. A guard that
 *      cannot detect the defect it was written for is decoration. This is the check that matters.
 *   2. SPECIFICITY — assert it moves ONLY the features that change, so the failure names the right
 *      thing instead of saying "something is different".
 *   3. COVERAGE — assert no feature is identically zero across the whole fixture. A zero column
 *      hashes the same as every other zero column, so those features are named in the vector and
 *      guarded by nothing. The first draft of the fixture had 32 of 74 in that state.
 *
 * Plus determinism, since a hash that changes on its own would train everyone to ignore it.
 */
'use strict';
require('../engine/showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const path = require('path');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('FEATURE SEMANTICS GUARD — a feature must not change meaning under its own name\n');

if (!process.env.SHOWDOWN_PATH) {
  console.log('  FAIL SHOWDOWN_PATH is not set, so the Champions dex cannot be loaded');
  console.log('\nFEATURE SEMANTICS TESTS: 0 passed, 1 failed');
  process.exit(1);
}

const B = require(path.join(ROOT, 'engine', 'board.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const FF = require(path.join(ROOT, 'engine', 'feature_fixture.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

/* ---- 0. the fixture builds at all ------------------------------------------------------------ */
const cols = FF.columns(dex);
ok(cols.nSlots > 0 && cols.nCands > 0 && cols.nPairs > 0,
  `the fixture builds: ${cols.nSlots} slots, ${cols.nCands} candidates, ${cols.nPairs} pairs`);

/* ---- 1. SENSITIVITY — does it catch the change it was written for? --------------------------- */

/* board.js takes `dex` as an argument, so the OLD semantics are reproduced exactly by wrapping it so
 * getImmunity always returns true — which makes the new line `if (!dex.getImmunity(...)) continue;`
 * never continue. Nothing else about the dex is touched, so any hash that moves is attributable to
 * that one call. */
const dexOld = new Proxy(dex, {
  get(t, k) {
    if (k === 'getImmunity') return () => true;
    const v = t[k];
    return typeof v === 'function' ? v.bind(t) : v;
  },
});

const now = FF.hashes(dex);
const old = FF.hashes(dexOld);

const moved = [];
for (const blk of ['features', 'jointFeatures']) {
  for (const f of Object.keys(now[blk])) if (now[blk][f] !== old[blk][f]) moved.push(f);
}
ok(moved.length > 0, `the 2026-08-01 allyHit change moves at least one hash (moved: ${moved.join(', ') || 'NONE'})`);
ok(moved.includes('allyHit'), 'allyHit itself is detected');
ok(moved.includes('spreadFreeBesideAlly'),
  'spreadFreeBesideAlly is detected — the joint feature the change actually enabled');

/* ---- 2. SPECIFICITY — it must not cry wolf --------------------------------------------------- */

/* THE RULE, not a list of whatever happened to move: only a feature computed DOWNSTREAM of a
 * `dex.getImmunity` call may change when getImmunity is stubbed. There are two such call sites.
 *
 *   board.js:2493  the effectiveness bucket. `if (!getImmunity) immuneCount++; else { ...eff4/eff2/
 *                  effHalf/effQuarter }` — so all four buckets AND `immune` are downstream of it.
 *                  Stubbing immunity away pushes an immune target into whichever bucket
 *                  getEffectiveness puts it in, which is the whole defect in miniature.
 *   board.js:2798  the ally-damage loop, feeding `allyHit` and through it `spreadFreeBesideAlly`.
 *
 * `effHalf` was missing from an earlier version of this list and the test failed when Rotom-Wash
 * joined the fixture. That was the LIST being wrong, not the code: effHalf sits in the else-branch
 * of the immunity check and always did. Checked before widening, because quietly enlarging a
 * specificity allowlist until it stops failing is how a guard becomes decoration.
 *
 * Not every one of these will move on every fixture — only the ones whose boards actually contain
 * an immunity. The assertion is that nothing OUTSIDE this set moves. */
const EXPECTED = ['eff4', 'eff2', 'effHalf', 'effQuarter', 'immune', 'allyHit', 'spreadFreeBesideAlly'];
const unexpected = moved.filter(f => !EXPECTED.includes(f));
ok(unexpected.length === 0,
  `nothing else moves (unexpected: ${unexpected.join(', ') || 'none'})`);

/* ---- 3. COVERAGE — a zero column guards nothing ---------------------------------------------- */

const dead = [];
for (const f of B.FEATURES) if (cols.marg[f].every(v => +v === 0)) dead.push(f);
for (const f of B.JOINT_FEATURES) if (cols.joint[f].every(v => +v === 0)) dead.push(f);
ok(dead.length === 0,
  `every one of the ${B.FEATURES.length + B.JOINT_FEATURES.length} features fires somewhere on the `
  + `fixture (silent: ${dead.join(', ') || 'none'})`);

/* ---- 4. DETERMINISM -------------------------------------------------------------------------- */

const again = FF.hashes(dex);
const stable = ['features', 'jointFeatures'].every(blk =>
  Object.keys(now[blk]).every(f => now[blk][f] === again[blk][f]));
ok(stable, 'hashing the same code twice gives the same answer');

/* ---- 5. THE CHECKER ITSELF ------------------------------------------------------------------- */

ok(FF.verify(now, dex, { blocks: ['features', 'jointFeatures'] }) === null,
  'verify() accepts hashes that match');
ok(typeof FF.verify(old, dex, { blocks: ['features', 'jointFeatures'] }) === 'string',
  'verify() REJECTS hashes taken under the old semantics');
ok(typeof FF.verify(null, dex, { blocks: ['features'] }) === 'string',
  'verify() rejects a weight file carrying no hashes at all, rather than passing it silently');

/* The message has to name the feature, or the failure is no more useful than the length check that
 * already existed. */
const msg = FF.verify(old, dex, { blocks: ['features', 'jointFeatures'] });
ok(/allyHit/.test(msg), 'the rejection message names the feature that moved');

/* ---- 6. THE TABLE DIGEST -- the case the fixture provably CANNOT see ---------------------------
 *
 * On 2026-08-02 build/rebuild_sets_from_sheets.js rewrote the sets of eight species and all 74
 * feature hashes stayed byte-identical, because none of the eight stand on the fixture's boards.
 * 27.57% of the fit corpus contains one of them. Feature hashes are the wrong instrument for that,
 * and adding those species to SCENARIOS does not fix it -- the next regeneration touches a
 * different eight.
 *
 * So the case is CONSTRUCTED here rather than described: identical feature hashes, a different table
 * digest. If verify() ever stops distinguishing those two, this fails. */
{
  ok(now.table && typeof now.table.digest === 'string' && now.table.digest !== 'UNAVAILABLE',
    `hashes() carries a table digest (${(now.table || {}).species} species, ${(now.table || {}).digest})`);

  const sameFeatures = JSON.parse(JSON.stringify(now));
  sameFeatures.table = { species: (now.table || {}).species, digest: 'deadbeefdead' };
  const v = FF.verify(sameFeatures, dex, { blocks: ['features', 'jointFeatures'] });
  ok(typeof v === 'string' && /DAMAGE TABLE/.test(v),
    'verify() REJECTS a regenerated damage table even when every feature hash still matches');
  ok(typeof v === 'string' && /NOT reassurance/.test(v),
    'and says so -- a matching feature hash must not be read as evidence the table is unchanged');

  /* Backward compatibility is part of the contract, not a nicety: a check that cries wolf on every
   * file stamped before it existed is a check that gets switched off within a week. */
  const older = JSON.parse(JSON.stringify(now));
  delete older.table;
  ok(FF.verify(older, dex, { blocks: ['features', 'jointFeatures'] }) === null,
    'a weight file stamped BEFORE the table block existed is not reported as stale');

  ok(FF.verify(now, dex, { blocks: ['features', 'jointFeatures'] }) === null,
    'and the digest stays quiet when the table has not moved');
}

/* ---- 7. THE HAZARD CLASS — the blind spot this guard had until 2026-08-13 ----------------------
 *
 * ROADMAP #254. `board.js` put every side condition on the MOVER's side. Seven of the eleven legal
 * side-condition moves are `allySide` and were right by accident; the four `foeSide` ones — Stealth
 * Rock, Spikes, Sticky Web, Toxic Spikes — were recorded on the side they can never be on, and both
 * readers looked for them there too, so the error cancelled.
 *
 * RUN UNDER BOTH BOARDS WITH THE OLD FIXTURE, ZERO OF THE 76 COLUMNS MOVED. Not a defect in the
 * check: there was not one hazard CLICK on any fixture board, and the only conditions any board
 * pre-set were `reflect` and `tailwind` — both `allySide`, the half the fix leaves alone. The guard
 * written to catch a feature changing meaning under its own name would have passed this in silence,
 * which is the one failure it may never have. With the `hazards-already-up` board added, `deadSide`
 * moves (b984c210828d -> d1be4f95d589) and nothing else does.
 *
 * TWO ASSERTIONS, and they are different in kind. COVERAGE: the fixture must actually contain
 * foeSide clicks, both dead and live, derived from the format so a regulation adding a hazard is
 * covered without editing this file. SENSITIVITY: `deadSide` for a foeSide setter must equal
 * whether the condition is up on the FOE's side — stated against the Board directly, never through
 * board.js's own `sideFor`, so this is an independent statement rather than the code agreeing with
 * itself. It is RED on the pre-#254 board.
 *
 * ONLY `deadSide` IS OBSERVABLE HERE, MEASURED RATHER THAN ASSUMED: none of the four hazards carries
 * a `condition.duration` (Reflect 5, Tailwind 4; the hazards none), so `setupTurns` is 0 for them
 * under every variant and the second read site is inert for this class today. */
{
  const slots = FF.build(dex);
  const iDead = B.FEATURE_INDEX.deadSide;
  const other = s => (s === 'p1' ? 'p2' : 'p1');
  let seen = 0, live = 0, deadN = 0;
  const wrong = [];
  for (const s of slots) {
    for (let i = 0; i < s.cands.length; i++) {
      const mv = s.cands[i].move;
      if (!mv || !mv.sideCondition || mv.target !== 'foeSide') continue;
      seen++;
      const upOnFoe = s.board.hasSide(other(s.side), mv.sideCondition) ? 1 : 0;
      if (upOnFoe) deadN++; else live++;
      if (s.feats[i][iDead] !== upOnFoe) {
        wrong.push(`${s.label} ${mv.name}: deadSide=${s.feats[i][iDead]}, but it is `
          + `${upOnFoe ? 'ALREADY UP' : 'NOT up'} on ${other(s.side)}`);
      }
    }
  }
  ok(seen > 0 && deadN > 0 && live > 0,
    `the fixture clicks foeSide setters in both states: ${seen} candidates, ${deadN} already up, ${live} not`);
  ok(wrong.length === 0, `deadSide for a foeSide setter reads the FOE's side: ` +
    (wrong.length ? `${wrong.length} wrong\n         ` + wrong.join('\n         ') : 'every one agrees'));
}

console.log(`\nFEATURE SEMANTICS TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
