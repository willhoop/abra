/* test-mag-page.js — the MAGNEMITE page must score a move exactly as the engine does.
 *
 * WHY THIS EXISTS
 * ---------------
 * The MAGNEMITE room in web/index.html re-implements engine/board.js `featuresFor` in browser JavaScript, because the
 * engine runs in Node and the page does not. Two implementations of one definition is precisely the
 * drift this project keeps paying for — the site's hand-maintained clean-game count, ORIENTATION's
 * typed figures, the browser engine that silently disagreed with the official one by 31 points.
 *
 * The page carries a self-check that shows a red banner if it disagrees with a fixture scored by the
 * real engine. That protects a person who opens the page. It does NOT protect a commit, because
 * nobody opens the page on the way past. This does: it lifts the page's OWN scoring functions out of
 * the HTML, runs them against the same fixture, and fails the build on any disagreement.
 *
 *   node tests/test-mag-page.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, fn) => {
  let ok = false, why = '';
  try { const r = fn(); ok = r === true || r === undefined; if (!ok) why = String(r); }
  catch (e) { ok = false; why = e.message; }
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : '   -- ' + why));
};

console.log('MAGNEMITE PAGE TESTS\n');

const PAGE = path.join(ROOT, 'web', 'index.html');
const BUNDLE = path.join(ROOT, 'data', 'mag.js');

check('the generated bundle exists', () => fs.existsSync(BUNDLE) || 'run node build/build_mag_data.js');
check('the page exists', () => fs.existsSync(PAGE) || 'web/index.html missing');
if (fail) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(1); }

const sandbox = { window: {}, console, Math, JSON, String, Number, Array, Object, isFinite };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(BUNDLE, 'utf8'), sandbox);
const MAG = sandbox.MAG;

check('the bundle carries a fitted weight vector and its feature list', () => {
  if (!MAG || !Array.isArray(MAG.weights)) return 'no weights';
  if (!Array.isArray(MAG.features) || MAG.features.length !== MAG.weights.length) return 'features/weights length mismatch';
  return true;
});

check('the bundle agrees with engine/board.js on the feature list', () => {
  const B = require(path.join(ROOT, 'engine', 'board.js'));
  return MAG.features.join(',') === B.FEATURES.join(',') ||
    `bundle [${MAG.features.join(',')}] vs engine [${B.FEATURES.join(',')}]`;
});

check('the bundle carries a fixture scored by the engine', () => {
  const fx = MAG.fixture;
  if (!fx || !Array.isArray(fx.cases) || !fx.cases.length) return 'no fixture cases';
  return true;
});

/* Lift the page's OWN scoring out of the HTML rather than reimplementing it here — a copy in this
 * file would test the copy, not the page. */
const html = fs.readFileSync(PAGE, 'utf8');
function lift(name) {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(`web/index.html no longer defines ${name}() — this test is stale`);
  let depth = 0, started = false;
  for (let j = i; j < html.length; j++) {
    if (html[j] === '{') { depth++; started = true; }
    else if (html[j] === '}') { depth--; if (started && depth === 0) return html.slice(i, j + 1); }
  }
  throw new Error(`could not find the end of ${name}()`);
}

check('the page still defines the scoring functions this test lifts', () => {
  lift('eff1'); lift('feats'); return true;
});

/* magMoveType is an arrow const, not a function declaration, so it is lifted by line rather than by
 * brace matching. It resolves Weather Ball to Water under rain; without it the page would score a
 * rain team's main attack as a neutral Normal move, which is the bug it exists to prevent. */
function liftConst(name) {
  const re = new RegExp('^const ' + name + '=.*$', 'm');
  const m = re.exec(html);
  if (!m) throw new Error(`web/index.html no longer defines ${name} — this test is stale`);
  return m[0];
}

const pageCtx = {
  MAG, Math, String, Number, Array, Object, console,
  norm: s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
};
/* The room names these MAGF / MAGIX to stay out of the way of the rest of index.html's globals. */
pageCtx.MAGF = MAG.features;
pageCtx.MAGIX = {};
MAG.features.forEach((f, i) => { pageCtx.MAGIX[f] = i; });
vm.createContext(pageCtx);
/* feats() also calls the ability-block helpers now, so they are lifted alongside it. A missing one
 * surfaces as "not defined" rather than as a quietly wrong number, which is the failure mode to
 * want — the whole point of this file is that the page and the engine cannot drift apart. */
vm.runInContext([liftConst('magMoveType'), lift('magRule'), lift('magPrankster'),
  lift('magAbilityBlock'), lift('eff1'), lift('feats')].join('\n'), pageCtx);

check('the page scores every fixture position exactly as the engine did', () => {
  const fx = MAG.fixture;
  const user = { id: fx.user };
  const foes = fx.foes.map(id => ({ id, hp: 1, status: '' }));
  /* The fixture carries the weather it was scored under — Weather Ball is a different type in rain,
   * which is the whole reason that case is in there. Ignoring it made the page look wrong when it
   * was the harness that was not reproducing the board. */
  const board = { side: {}, field: {}, weather: fx.weather || '', stalled: false };
  /* REPORT THE EXTENT, NOT ONE EXAMPLE. This tracked only the single largest disagreement and printed
   * it, so a page that disagreed on twenty features read identically to one that disagreed on one:
   * "disagrees by 1 (icebeam->garchomp feature accuracy: page 0 vs engine 1)". The number of features
   * involved is the finding — see the coverage check below, which is what this should have said. */
  let worst = 0, worstCase = '';
  const badFeatures = new Map();
  for (const c of fx.cases) {
    let tgt;
    if (c.tgt === '*') tgt = { spread: foes };
    else if (c.tgt === '') tgt = {};
    else tgt = { mon: foes.find(f => f.id === c.tgt) };
    const pri = (MAG.priors[fx.user] || {})[c.mv] || 0;
    const x = pageCtx.feats(c.mv, tgt, board, user, pri);
    for (let k = 0; k < c.x.length; k++) {
      const d = Math.abs(x[k] - c.x[k]);
      if (d > 1e-9) badFeatures.set(MAG.features[k], (badFeatures.get(MAG.features[k]) || 0) + 1);
      if (d > worst) { worst = d; worstCase = `${c.mv}->${c.tgt || 'self'} feature ${MAG.features[k]}: page ${x[k]} vs engine ${c.x[k]}`; }
    }
  }
  return worst < 1e-9 ||
    `${badFeatures.size} feature(s) disagree across ${fx.cases.length} fixture cases ` +
    `[${[...badFeatures.keys()].join(', ')}]; largest gap ${worst} (${worstCase})`;
});

/* THE FIXTURE CANNOT PROVE AGREEMENT ON A FEATURE IT NEVER EXERCISES.
 *
 * The check above compares stored engine features to page features over nine fixture positions. It
 * passed for weeks on a page that IMPLEMENTS 21 OF 47 FEATURES: the other 26 are never assigned, so
 * they sit at the zero the array was filled with, and a fixture position where the engine also scored
 * zero agrees perfectly. The site's MAGNEMITE room presents its numbers as MAG's reasoning while
 * scoring a 21-feature model.
 *
 * This is structural and does not depend on which positions somebody put in the fixture. It reads the
 * page's own source for `x[MAGIX.<name>]` assignments and requires one per feature in the bundle.
 *
 * NOTE ON THE FIX: 26 features cannot simply be written into the page, because data/mag.js does not
 * ship the fields they need — there is no accuracy field on a bundled move at all. Closing this means
 * either extending the bundle and porting the logic, or deriving the browser scorer from
 * engine/board.js instead of re-implementing it, which is the S13-correct answer. Until then this
 * check fails, deliberately and loudly, the way the ladder-store guard does. */
check('the page implements every feature in the bundle, not a subset', () => {
  const assigned = new Set();
  for (const m of html.matchAll(/x\[MAGIX\.([A-Za-z0-9_]+)\]\s*=/g)) assigned.add(m[1]);
  const never = MAG.features.filter(f => !assigned.has(f));
  return never.length === 0 ||
    `the page assigns ${assigned.size} of ${MAG.features.length} features; ${never.length} are ` +
    `never written and therefore silently 0: ${never.join(', ')}`;
});

/* The two behaviours the whole model exists for, asserted on the page's own code. */
check('the page aims: a 4x move scores higher at the weak target than the resistant one', () => {
  const user = { id: 'pelipper' };
  const chomp = { id: 'garchomp', hp: 1, status: '' };
  const incin = { id: 'incineroar', hp: 1, status: '' };
  const board = { side: {}, field: {}, weather: '', stalled: false };
  const W = MAG.weights, dot = x => x.reduce((s, v, k) => s + W[k] * v, 0);
  const a = dot(pageCtx.feats('icebeam', { mon: chomp }, board, user, 0));
  const b = dot(pageCtx.feats('icebeam', { mon: incin }, board, user, 0));
  return a > b || `Ice Beam scores ${a.toFixed(3)} at Garchomp and ${b.toFixed(3)} at Incineroar`;
});

check('the page kills a move that cannot work: Tailwind with Tailwind already up', () => {
  const user = { id: 'pelipper' };
  const board = { side: {}, field: {}, weather: '', stalled: false };
  const W = MAG.weights, dot = x => x.reduce((s, v, k) => s + W[k] * v, 0);
  const before = dot(pageCtx.feats('tailwind', {}, board, user, 0.2));
  board.side.tailwind = true;
  const after = dot(pageCtx.feats('tailwind', {}, board, user, 0.2));
  return after < before || `Tailwind scored ${after.toFixed(3)} with it already up against ${before.toFixed(3)} without`;
});

console.log(`\nMAGNEMITE PAGE TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
