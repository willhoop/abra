/* test-board-browser.js — board.js in a BROWSER must score identically to board.js in node.
 *
 *   node tests/test-board-browser.js
 *
 * WHY THIS EXISTS, AND WHY ITS ABSENCE WAS ITS OWN BUG
 * ----------------------------------------------------
 * `build/build_board_browser.js` has said since 2026-08-01 that "tests/test-board-browser.js asserts
 * the two agree feature-for-feature, so a new read fails there rather than shipping a quieter page."
 * **That file did not exist.** The sentence was true-sounding, written down, and unfalsifiable — the
 * fifth instance in one session of the failure this project keeps paying for. Writing the guard is
 * how the sentence becomes true.
 *
 * WHAT IT GUARDS
 * --------------
 * `app/index.html` carries a SECOND feature scorer because board.js could not load in a browser: it
 * assigns 21 of 56 features and disagrees with the engine on 11 across 9 fixture cases, so a reader
 * of the site sees numbers the bot did not compute. The fix is not to hand-write the missing 36 — it
 * is to delete the second scorer and run the first one. This test is what makes that safe.
 *
 * THE ONE THING THAT MADE IT LOOK IMPOSSIBLE, AND WHY IT IS NOT
 * ------------------------------------------------------------
 * board.js does not merely READ the dex, it CALLS the dex's handlers — `onModifyType`,
 * `onModifyPriority`, `onModifySpe`, `onStart`, `onChangeBoost`, `onTryBoost`, `onAfterEachBoost`,
 * `onAnyModifyDamage`, `basePowerCallback`. Functions do not survive JSON, which is why the first
 * attempt shipped the data and stopped.
 *
 * But board.js invokes every one of them with a `this` context IT CONSTRUCTS ITSELF — a deliberate
 * design so a handler can be probed rather than reimplemented. They close over nothing from the
 * dex's module scope, so `Function.prototype.toString()` round-trips them. Measured: 225 of 225
 * rehydrate, and onModifyType agrees on all 13 moves that define it. The bundle now ships them as
 * source and rebuilds them on first use.
 *
 * HOW THE BROWSER IS SIMULATED
 * ----------------------------
 * A real `vm` context with **no `require` at all**, which is the only honest way to test the browser
 * path: board.js branches on `typeof require === 'function'` in four places, and a test that left
 * require defined would silently take the node path everywhere and prove nothing.
 *
 * The fixture BOARDS are built once in node and handed to both scorers, so the comparison isolates
 * `featuresFor` and its dex reads. If the browser had to build its own boards too, a disagreement
 * could not be attributed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('BOARD IN A BROWSER — the same scorer, or a named difference\n');

const B = require(D('engine', 'board.js'));
const FX = require(D('engine', 'feature_fixture.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

/* ---- 1. THE BUNDLE EXISTS AND IS CURRENT ------------------------------------------------------ */
const BUNDLE = D('data', 'board-data.js');
ok(fs.existsSync(BUNDLE), 'data/board-data.js exists (build/build_board_browser.js writes it)');
if (!fs.existsSync(BUNDLE)) { console.log('\nBOARD BROWSER TESTS: 0 passed, 1 failed'); process.exit(1); }

/* ---- 2. LOAD board.js WITH NO `require` IN SCOPE ---------------------------------------------- */
const sandbox = { console, Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, isFinite, isNaN, parseInt, parseFloat, Map, Set, Symbol };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);

const load = (rel) => {
  try { vm.runInContext(fs.readFileSync(D(rel), 'utf8'), sandbox, { filename: rel }); return null; }
  catch (e) { return `${rel}: ${e.message}`; }
};

/* engine-data.js publishes MC; medicham2-browser.js publishes dmgRange/buildMon; mc_key.js publishes
 * mcKey; board-data.js publishes __ABRA_BOARD_DATA and __ABRA_DEX. board.js needs all four, and in a
 * browser it finds every one of them on the global rather than through require. */
/* data/move-effects.js is loaded because medicham2-browser.js REFUSES to compute damage without it
 * ("MOVE_EFFECTS not loaded"), and a browser board with a dead damage engine would agree with node
 * on the cheap features and read zero on every expensive one. The page already ships it. */
/* data/abra-tags.js then engine/tags.js, in that order: the data file publishes ABRA_TAGS as a raw
 * table and tags.js replaces it with the ACCESSOR over that table. board.js tests ABRA_TAGS for a
 * `.has` method, so with only the data loaded it latches "no tags" and healValue, screenValue and
 * speedSwing — three of the largest positive weights in the vector — silently read zero. */
const loadErrors = ['data/engine-data.js', 'data/move-effects.js', 'engine/medicham2-browser.js',
                    'engine/mc_key.js', 'data/abra-tags.js', 'engine/tags.js',
                    'data/board-data.js', 'engine/board.js'].map(load).filter(Boolean);
ok(loadErrors.length === 0, `board.js and its data load with no require in scope (${loadErrors[0] || 'clean'})`);
if (loadErrors.length) { console.log(`\nBOARD BROWSER TESTS: ${P} passed, ${F + 1} failed`); process.exit(1); }

ok(typeof sandbox.require === 'undefined', 'the sandbox really has no require — the browser path was the one exercised');
ok(sandbox.BOARD && typeof sandbox.BOARD.featuresFor === 'function', 'globalThis.BOARD.featuresFor is published');
ok(sandbox.__ABRA_DEX && typeof sandbox.__ABRA_DEX.moves.get === 'function', 'globalThis.__ABRA_DEX is published');

const BB = sandbox.BOARD, BDEX = sandbox.__ABRA_DEX;

/* The feature list itself must match, or a per-index comparison compares different things. */
ok(BB.FEATURES.join(',') === B.FEATURES.join(','), `both agree on the ${B.FEATURES.length}-feature list`);
ok(BB.JOINT_FEATURES.join(',') === B.JOINT_FEATURES.join(','), `both agree on the ${B.JOINT_FEATURES.length} joint features`);

/* THE DAMAGE ENGINE HAS TO BE LIVE IN THERE. Without it every damage-derived feature reads zero on
 * BOTH sides and the comparison passes while measuring nothing — the exact shape of the "wired but
 * inert" defect board.js:1505 documents. */
ok(!!BB.damageEngine(), 'the damage engine is live in the browser context (not a vacuous match)');

/* ---- 3. THE DEX ROUND-TRIPS ITS HANDLERS ------------------------------------------------------ */
let handlersSeen = 0, handlerAgree = 0;
const dis = [];
for (const m of dex.moves.all()) {
  if (typeof m.onModifyType !== 'function' || m.isNonstandard) continue;
  const bm = BDEX.moves.get(m.id);
  if (!bm || !bm.exists) continue;
  handlersSeen++;
  if (typeof bm.onModifyType !== 'function') { dis.push(`${m.id}: browser has no onModifyType`); continue; }
  const field = { isTerrain: () => false, isWeather: () => false, getPseudoWeather: () => null, effectiveWeather: () => '' };
  const user = { effectiveWeather: () => '', hasItem: () => false, getItem: () => ({}) };
  const a = { type: m.type }, b = { type: m.type };
  /* A HANDLER THAT THROWS ON ONE SIDE AND NOT THE OTHER IS A DISAGREEMENT, so the errors are
   * compared rather than swallowed. Discarding them would let "node computed a type, the browser
   * crashed and left the default" pass as agreement whenever the default happened to match. */
  let ea = null, eb = null;
  try { m.onModifyType.call({ field, dex }, a, user); } catch (e) { ea = e.message; }
  try { bm.onModifyType.call({ field, dex: BDEX }, b, user); } catch (e) { eb = e.message; }
  if (a.type === b.type && String(ea) === String(eb)) handlerAgree++;
  else dis.push(`${m.id}: node ${a.type}${ea ? ' (threw: ' + ea + ')' : ''} vs browser ${b.type}${eb ? ' (threw: ' + eb + ')' : ''}`);
}
ok(handlersSeen > 0, `the bundle carries moves with handlers to check (${handlersSeen})`);
ok(handlerAgree === handlersSeen,
  `every rebuilt onModifyType answers as node does (${handlerAgree}/${handlersSeen}${dis.length ? ' — ' + dis.slice(0, 3).join('; ') : ''})`);

/* ---- 4. THE WHOLE VECTOR, ON THE PINNED FIXTURE BOARDS ---------------------------------------- */
const ROUND = FX.ROUND;
const slots = FX.build(dex);
const gap = {};                       // feature -> worst absolute disagreement
let compared = 0;
for (const s of slots) {
  const user = s.board.slot(s.side, s.letter);
  for (let i = 0; i < s.cands.length; i++) {
    const prior = (i + 1) / (s.cands.length + 1);       // the fixture's synthetic prior, reproduced
    let bx;
    try { bx = BB.featuresFor(s.cands[i], user, s.board, s.side, BDEX, prior); }
    catch (e) { gap['<threw>'] = e.message; continue; }
    const nx = s.feats[i];
    compared++;
    for (let k = 0; k < B.FEATURES.length; k++) {
      const d = Math.abs((+nx[k] || 0) - (+bx[k] || 0));
      if (d > gap[B.FEATURES[k]] || gap[B.FEATURES[k]] === undefined) gap[B.FEATURES[k]] = d;
    }
  }
}
ok(compared > 0, `scored ${compared} candidates across ${slots.length} fixture slots in both runtimes`);

const TOL = Math.pow(10, -ROUND) / 2;
const off = Object.entries(gap).filter(([, d]) => typeof d === 'number' && d > TOL).sort((a, b) => b[1] - a[1]);
ok(!gap['<threw>'], `featuresFor did not throw in the browser (${gap['<threw>'] || 'clean'})`);

/* A RATCHET, NOT A BIG BANG — docs/ARTIFACT-ACCESS-RULES.md R5, and the same adoption this repo
 * used for tests/test-no-silent-failure.js (233 pre-existing cases) and the degradation budgets.
 *
 * board.js has only just become loadable in a browser at all. 44 of 56 features already agree to
 * the fixture's own precision; the rest are one unfinished piece of work in the damage path, and a
 * test that demands all 56 before it can be switched on is a test that gets switched off. So the
 * DISAGREEING SET is baselined and may only SHRINK: a new divergence fails, and a fixed one is
 * reported so the baseline can be tightened.
 *
 * The list is not a licence. Every feature on it is a number the page would show wrongly, which is
 * why the page has NOT been switched over to the browser scorer yet. */
const BASELINE = D('data', 'board-browser-baseline.json');
/* A MISSING baseline is the first run and is fine. A CORRUPT one is not: it would silently reset the
 * ratchet to "nothing known", and since every current disagreement would then read as NEW the test
 * fails loudly anyway — but it would fail with the wrong reason, which costs whoever reads it. */
let base = { known: {} };
if (fs.existsSync(BASELINE)) {
  try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
  catch (e) { console.error(`  cannot parse ${path.relative(ROOT, BASELINE)} — ${e.message}`); F++; }
}

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    generated: new Date().toISOString().slice(0, 10),
    by: 'tests/test-board-browser.js --update',
    note: 'Features where board.js in a browser does not yet match board.js in node. Each is a number '
        + 'app/index.html would display wrongly, which is why the page still carries its own scorer. '
        + 'This list may only SHRINK. Re-baseline only after fixing one.',
    known: Object.fromEntries(off.map(([f, d]) => [f, +d.toFixed(6)])),
  }, null, 2) + '\n');
  console.log(`\n  re-baselined: ${off.length} feature(s) still disagree`);
  process.exit(0);
}

const known = base.known || {};
const novel = off.filter(([f]) => !(f in known));
const worse = off.filter(([f, d]) => f in known && d > known[f] + TOL);
const fixed = Object.keys(known).filter(f => !off.some(([g]) => g === f));

ok(novel.length === 0,
  `no NEW feature disagrees between node and browser (${novel.map(([f]) => f).join(', ') || 'none'})`);
ok(worse.length === 0,
  `no known disagreement got worse (${worse.map(([f, d]) => `${f} ${known[f].toFixed(4)}->${d.toFixed(4)}`).join(', ') || 'none'})`);

console.log(`\n  ${B.FEATURES.length - off.length} of ${B.FEATURES.length} features agree to ${ROUND} dp; ${off.length} known to differ:`);
for (const [f, d] of off.slice(0, 20)) console.log(`    ${f.padEnd(24)} worst gap ${d.toFixed(6)}`);
if (fixed.length) console.log(`\n  ${fixed.length} baselined disagreement(s) now AGREE: ${fixed.join(', ')} — re-baseline with --update`);

console.log(`\nBOARD BROWSER TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
