/* test-mag-page.js — the MAGNEMITE page must score a move exactly as the engine does.
 *
 * WHY THIS EXISTS
 * ---------------
 * The MAGNEMITE room in web/index.html used to RE-IMPLEMENT engine/board.js `featuresFor` in browser
 * JavaScript, because board.js could not load in a browser. Two implementations of one definition is
 * precisely the drift this project keeps paying for. That copy assigned **21 of 56 features** and
 * disagreed with the engine on 11, so a reader of the site saw numbers the bot did not compute.
 *
 * WHAT CHANGED, 2026-08-02
 * ------------------------
 * There is no copy any more. The page loads engine/board.js and calls the same `featuresFor` the bot
 * calls. The previous version of this file said so itself: the fix is "deriving the browser scorer
 * from engine/board.js instead of re-implementing it, which is the S13-correct answer".
 *
 * The blocker was believed fundamental — board.js CALLS dex handlers (onModifyType,
 * onModifyPriority, basePowerCallback) and functions do not survive JSON. But board.js invokes every
 * one of them with a `this` context IT constructs, so they close over nothing and all 225 round-trip
 * through Function.prototype.toString(). tests/test-board-browser.js proves the browser build scores
 * 56 of 56 identically to node; THIS file proves the page's adapter feeds it correctly.
 *
 * SO THIS FILE'S JOB CHANGED WITH IT. It used to lift the page's scorer and re-run it. It now asserts:
 *
 *   1. STRUCTURAL — the page has no second scorer. A returning `feats()` is the bug coming back, and
 *      no behavioural check can catch that: a copy that happens to agree today still drifts tomorrow.
 *   2. STRUCTURAL — the page loads the engine in the ORDER that works. That order is load-bearing and
 *      was measured: medicham2-browser.js snapshots the RAW tag table at load while board.js wants the
 *      ACCESSOR, and getting it backwards leaves medicham2 reporting `missing: true` and silently
 *      changes every damage feature. Ten of the twelve disagreements found while building this came
 *      from exactly that.
 *   3. BEHAVIOURAL — the page's own adapter, lifted from the HTML and run against the REAL browser
 *      engine, reproduces the engine-scored fixture in data/mag.js exactly.
 *
 *   node tests/test-mag-page.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let pass = 0, fail = 0;
const check = (name, fn) => {
  let ok = false, why = '';
  try { const r = fn(); ok = r === true || r === undefined; if (!ok) why = String(r); }
  catch (e) { ok = false; why = e.message; }
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : '   -- ' + why));
};

console.log('MAGNEMITE PAGE TESTS\n');

const PAGE = D('web', 'index.html');
const BUNDLE = D('data', 'mag.js');

check('the generated bundle exists', () => fs.existsSync(BUNDLE) || 'run node build/build_mag_data.js');
check('the page exists', () => fs.existsSync(PAGE) || 'web/index.html missing');
if (fail) { console.log(`\nMAGNEMITE PAGE TESTS: ${pass} passed, ${fail} failed`); process.exit(1); }

const html = fs.readFileSync(PAGE, 'utf8');

/* ---- 1. THE SECOND SCORER MUST STAY DELETED --------------------------------------------------- */
check('the page defines NO scorer of its own', () => {
  const back = ['function feats(', 'function eff1(', 'function magAbilityBlock(', 'function magRule(']
    .filter(sig => html.includes(sig));
  return back.length === 0
    || `the second implementation is back: ${back.join(', ')} — the page must CALL board.js, not copy it`;
});

check('the page calls the engine featuresFor', () =>
  /\bB\.featuresFor\(|\bBOARD\.featuresFor\(/.test(html)
  || 'no call to the engine featuresFor found in the page');

/* ---- 2. THE LOAD ORDER, WHICH IS LOAD-BEARING -------------------------------------------------- */
check('the engine files are loaded in the order that works', () => {
  const m = html.match(/MAGENG_FILES\s*=\s*\[([\s\S]*?)\]/);
  if (!m) return 'no MAGENG_FILES list found — the page is not lazy-loading the engine';
  const files = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  const at = n => files.findIndex(f => f.endsWith('/' + n));
  const tags = at('abra-tags.js'), medi = at('medicham2-browser.js');
  const acc = at('tags.js'), board = at('board.js'), data = at('board-data.js');
  for (const [n, i] of [['abra-tags.js', tags], ['medicham2-browser.js', medi], ['tags.js', acc],
                        ['board.js', board], ['board-data.js', data]]) {
    if (i < 0) return `${n} is not in MAGENG_FILES: [${files.join(', ')}]`;
  }
  if (!(tags < medi)) return 'data/abra-tags.js must load BEFORE medicham2-browser.js, which snapshots the raw table at load';
  if (!(medi < acc)) return 'engine/tags.js must load AFTER medicham2-browser.js, or medicham2 captures the accessor instead of the table';
  if (!(acc < board)) return 'engine/tags.js must load BEFORE board.js, which tests ABRA_TAGS for a .has method';
  if (!(data < board)) return 'data/board-data.js must load BEFORE board.js, which needs __ABRA_DEX';
  return true;
});

/* ---- 3. THE ADAPTER, AGAINST THE REAL ENGINE --------------------------------------------------- */
function lift(name) {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(`the page no longer defines ${name}() — this test lifts it`);
  let depth = 0;
  for (let k = html.indexOf('{', i); k < html.length; k++) {
    if (html[k] === '{') depth++;
    else if (html[k] === '}') { depth--; if (!depth) return html.slice(i, k + 1); }
  }
  throw new Error(`unbalanced braces lifting ${name}()`);
}

/* A REAL BROWSER CONTEXT WITH NO `require`, for the same reason tests/test-board-browser.js uses one:
 * board.js branches on `typeof require === 'function'` in four places, so a context that left require
 * defined would take the NODE path everywhere and prove nothing about the page. */
const sandbox = { console, Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error,
  isFinite, isNaN, parseInt, parseFloat, Map, Set, Symbol, Promise };
sandbox.globalThis = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);

let loadErr = null;
try {
  /* data/engine-data.js is already a <script> on the page above the lazy set; the rest is
   * MAGENG_FILES, in its order. */
  for (const f of ['data/engine-data.js', 'data/mag.js', 'data/move-effects.js', 'data/abra-tags.js',
                   'engine/medicham2-browser.js', 'engine/mc_key.js', 'engine/tags.js',
                   'data/board-data.js', 'engine/board.js']) {
    vm.runInContext(fs.readFileSync(D(f), 'utf8'), sandbox, { filename: f });
  }
} catch (e) {
  /* Recorded, not swallowed: the very next check asserts on it by name, so a load failure fails
   * this file rather than reaching the adapter checks with a half-built engine. */
  loadErr = (e && e.message) || String(e);
  console.error(`  (engine load failed: ${loadErr})`);
}
check('the engine and the bundle load together in a browser context', () => !loadErr || loadErr);

check('the damage engine is LIVE in that context', () =>
  (sandbox.BOARD && sandbox.BOARD.damageEngine()) ? true
    : 'no damage engine — every damage feature would read zero on BOTH sides and this file would pass vacuously');

if (fail) { console.log(`\nMAGNEMITE PAGE TESTS: ${pass} passed, ${fail} failed`); process.exit(1); }

sandbox.MAGENG = { B: sandbox.BOARD, dex: sandbox.__ABRA_DEX };
vm.runInContext([lift('magBoardFrom'), lift('magScore')].join('\n'), sandbox);

const MAG = sandbox.MAG;
const fixtureState = () => {
  const fx = MAG.fixture;
  return {
    you: fx.user, a: fx.foes[0], b: fx.foes[1], allyId: null,
    hpA: 1, hpB: 1, stA: false, stB: false,
    weather: fx.weather || '', trickroom: false, tailwind: false, stalled: false,
    moves: [...new Set(fx.cases.map(c => c.mv))],
  };
};

check('the page adapter scores every fixture position exactly as the engine did', () => {
  const fx = MAG.fixture;
  if (!fx) return 'data/mag.js carries no fixture';
  const scored = sandbox.magScore(fixtureState());
  const bs = sandbox.BOARD.baseSpecies;
  let worst = 0, worstCase = '';
  const bad = new Map(), missing = [];
  for (const c of fx.cases) {
    const hit = scored.find(o => o.cand.move && o.cand.move.id === c.mv && (
      c.tgt === '*' ? (!o.cand.targetMon && !!o.cand.spread)
        : c.tgt === '' ? (!o.cand.targetMon && !o.cand.spread)
          : (o.cand.targetMon && bs(o.cand.targetMon.species) === c.tgt)));
    if (!hit) { missing.push(`${c.mv}->${c.tgt || 'self'}`); continue; }
    for (let k = 0; k < c.x.length; k++) {
      const d = Math.abs((+hit.x[k] || 0) - (+c.x[k] || 0));
      if (d > 1e-9) bad.set(MAG.features[k], (bad.get(MAG.features[k]) || 0) + 1);
      if (d > worst) { worst = d; worstCase = `${c.mv}->${c.tgt || 'self'} ${MAG.features[k]}: page ${hit.x[k]} vs engine ${c.x[k]}`; }
    }
  }
  if (missing.length) return `the adapter produced no candidate for: ${missing.join(', ')}`;
  return worst < 1e-9 ||
    `${bad.size} feature(s) disagree across ${fx.cases.length} fixture cases [${[...bad.keys()].join(', ')}]; largest ${worst} (${worstCase})`;
});

/* ---- 4. EVERY FEATURE, NOT A SUBSET -----------------------------------------------------------
 * The old page assigned 21 of 56 and the other 35 read zero, which is indistinguishable from a
 * feature that is genuinely zero — the check that used to fail here, deliberately and loudly. It is
 * structural now that the engine does the scoring, but it is still asserted: an adapter that quietly
 * dropped columns would be the same bug wearing a different hat. */
check('the adapter produces the full feature vector, not a subset', () => {
  const scored = sandbox.magScore(fixtureState());
  if (!scored.length) return 'the adapter produced no candidates at all';
  const n = scored[0].x.length;
  return n === MAG.features.length
    || `the adapter returns ${n} features against the bundle's ${MAG.features.length}`;
});

check('the bundle agrees with engine/board.js on the feature list', () =>
  MAG.features.join(',') === sandbox.BOARD.FEATURES.join(',')
  || 'data/mag.js and board.js disagree on the feature list — rebuild with node build/build_mag_data.js');

/* The two behaviours the whole model exists for, now asserted through the engine the page calls. */
check('the page aims: a 4x move scores higher at the weak target than the resistant one', () => {
  const st = Object.assign(fixtureState(), { moves: ['icebeam'] });
  const scored = sandbox.magScore(st).filter(o => o.cand.targetMon);
  if (scored.length < 2) return 'expected Ice Beam to produce one candidate per foe';
  const dot = x => x.reduce((s, v, k) => s + MAG.weights[k] * v, 0);
  const bs = sandbox.BOARD.baseSpecies;
  const chomp = scored.find(o => bs(o.cand.targetMon.species) === 'garchomp');
  const other = scored.find(o => bs(o.cand.targetMon.species) !== 'garchomp');
  if (!chomp || !other) return 'could not find both targets';
  return dot(chomp.x) > dot(other.x)
    || `Ice Beam scores ${dot(chomp.x).toFixed(3)} at Garchomp (4x) against ${dot(other.x).toFixed(3)} at the other foe`;
});

console.log(`\nMAGNEMITE PAGE TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
