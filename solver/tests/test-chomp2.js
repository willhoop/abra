/* solver/tests/test-chomp2.js — CHOMP v2: the per-set spread, the field block, the scorer, the solve, the wiring, and the
 * buildBody ability rule.
 *
 *   node solver/tests/test-chomp2.js [--no-red]      exit 0 = GREEN, 1 = RED
 *   env CHOMP_TEST_RELEASE=<id>   play on a frozen release (default: the live tree — this tests code, not a figure)
 *
 * Sheets are REAL Reg M-C open sheets from ROTOM's validated team pool (solver/rotom/teams/regmc-pool.json); which team
 * holds a weather setter or a speed-inverting room is READ from the engine's tags, never typed.
 *
 *   V1SAME   v2's features on the flat spread and the neutral field equal v1's (solver/chomp/v1/features.js), cell for cell
 *   SPREAD   a set spread reaches the body: its Speed is the engine's spreadL50 at that SP and nature, and Speed SP 32
 *            versus 0 moves at least one speed-order fact
 *   FIELD    a team that can set the room reports it and its speed-order mean under the room differs from the neutral
 *            one; a team that can set weather reports it and some fact under that weather differs from neutral
 *   ANTISYM  T[a][b] + T'[b][a] = 1; a mirror matchup is 1/2 on the diagonal
 *   PARITY   the JS forward pass equals train.py's on the model's fixture rows (|logit difference| < 1e-4)
 *   SOLVE    a real matchup: 8,100 cells in (0, 1), the mix sums to 1, the equilibrium conditions hold in the table
 *   WIRING   the arena arm `chomp2` (solver/chomp/arms.js) returns an option from the mix, counts its solve and caches it
 *   ABILITY  solver/arena/teams.js buildBody: a declared legal ability is kept; a missing one is taken only when the species
 *            has exactly one; otherwise the body is refused (null), and the old first-ability fill happens only when asked
 *
 * Deliberate breaks, each must turn this RED (run unless --no-red): CHOMP2_BREAK=field (FIELD), CHOMP2_BREAK=sign (ANTISYM,
 * PARITY), SLOWKING_BREAK=lpdual (SOLVE), TEAMS_BREAK=abilityfill (ABILITY).
 */
'use strict';
require('../arena/env.js');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const NO_RED = process.argv.includes('--no-red');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log('  FAIL [' + clause + '] ' + msg); } };
const want = c => !ONLY || ONLY === c;

const ENGINE = require('../arena/engine.js').load(process.env.CHOMP_TEST_RELEASE || null);
const API = ENGINE.API, M = API.M;
const O = require('../chomp/options.js');
const T = require('../arena/teams.js');
const X = require('../human/dex.js');
const { parseShowteam } = require('../human/parse_game.js');
const POOL = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rotom', 'teams', 'regmc-pool.json'), 'utf8'));
const SHEETS = Object.keys(POOL.teams).map(k => parseShowteam(POOL.teams[k].packed)).filter(s => s.length === 6);
const S1 = SHEETS[0], S2 = SHEETS[1], S3 = SHEETS[2];
const V2F = require('../chomp/v2/features.js');
const TG = globalThis.ABRA_TAG_LOOKUP;
const toID = X.toID;
const MODEL = path.join(__dirname, '..', 'chomp', 'v2', 'model', 'chomp2.json');

/* ---------------- V1SAME ---------------- */
if (want('V1SAME')) {
  const F1 = require('../chomp/v1/features.js').create(API), F2 = V2F.create(API, { mode: { spread: 'flat', field: false } });
  let worst = 0, n = 0;
  for (const [a, b] of [[S1, S2], [S2, S3], [S3, S1]]) {
    const A = F1.pairFacts({ p1: a, p2: b }), B = F2.pairFacts({ p1: a, p2: b });
    for (let i = 0; i < O.N; i += 7) for (let j = 0; j < O.N; j += 11) for (const s of ['p1', 'p2']) {
      const g1 = F1.side(A, s, i, j), g2 = F2.side(B, s, i, j);
      for (let k = 0; k < F1.G_DIM; k++) { worst = Math.max(worst, Math.abs(g1[k] - g2[k])); n++; }
    }
  }
  ok('V1SAME', n > 1000 && worst === 0, 'v2 flat/neutral features differ from v1 by ' + worst + ' over ' + n + ' values');
}

/* ---------------- SPREAD ---------------- */
if (want('SPREAD')) {
  const fixed = spe => ({ spreadOf: () => ({ evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe }, source: 'test' }) });
  const Fa = V2F.create(API, { mode: { spread: 'set', field: false }, spreads: fixed(32) }), Fb = V2F.create(API, { mode: { spread: 'set', field: false }, spreads: fixed(0) });
  const row = S1.find(r => r.nature);
  const b = Fa.body(row);
  const bs = globalThis.MC.mons[b.name].bs;
  ok('SPREAD', b.st.sp === M.spreadL50(bs, { sp: 32 }, row.nature).sp && b._spread === 'test', 'the body\'s Speed is not the engine\'s stat at Speed SP 32 and its nature');
  ok('SPREAD', Fa.COUNTERS.spreadApplied > 0 && Fa.COUNTERS.spreadMissing === 0, 'spread counters ' + JSON.stringify(Fa.COUNTERS));
  /* p1 fast, p2 slow vs the reverse: the speed-order facts must move */
  const mixed = { spreadOf: r => ({ evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: S1.includes(r) ? 32 : 0 }, source: 'test' }) };
  const Fm = V2F.create(API, { mode: { spread: 'set', field: false }, spreads: mixed });
  const P = Fm.pairFacts({ p1: S1, p2: S2 }), Q = Fb.pairFacts({ p1: S1, p2: S2 });
  let moved = 0; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if (P.p1.fast[i][j] !== Q.p1.fast[i][j]) moved++;
  ok('SPREAD', moved > 0, 'Speed SP 32 against 0 moved no speed-order fact');
}

/* ---------------- FIELD ---------------- */
if (want('FIELD')) {
  const FX = V2F.create(API, { mode: { spread: 'flat', field: true } });
  const k = n => FX.G_NAMES.indexOf(n);
  const roomSheet = SHEETS.find(s => s.some(r => (r.moves || []).some(mv => TG.has('move', toID(mv), 'reversesSpeed'))));
  const wxSheet = SHEETS.find(s => s.some(r => TG.param('ability', toID(r.ability), 'weatherSetter')));
  ok('FIELD', !!roomSheet && !!wxSheet, 'the pool holds no room setter or no weather setter to test with');
  if (roomSheet) {
    const opp = SHEETS.find(s => s !== roomSheet);
    const F = FX.pairFacts({ p1: roomSheet, p2: opp });
    let can = 0, moved = 0;
    for (let a = 0; a < O.N; a++) { const g = FX.side(F, 'p1', a, 0); if (g[k('f_can_room')] === 1) { can++; if (g[k('f_fast_myroom')] !== g[k('fast_mean')]) moved++; } }
    ok('FIELD', can > 0 && moved > 0, 'the room setter: ' + can + ' options can set it, ' + moved + ' move the speed order under it');
  }
  if (wxSheet) {
    const opp = SHEETS.find(s => s !== wxSheet);
    const F = FX.pairFacts({ p1: wxSheet, p2: opp });
    let can = 0, moved = 0;
    for (let a = 0; a < O.N; a++) for (let b = 0; b < O.N; b += 9) {
      const g = FX.side(F, 'p1', a, b);
      if (g[k('f_can_weather')] === 1) { can++; if (g[k('f_cov_my')] !== g[k('cov_mean')] || g[k('f_inc_my')] !== FX.side(F, 'p2', b, a)[k('cov_mean')] || g[k('f_fast_myw')] !== g[k('fast_mean')]) moved++; }
    }
    ok('FIELD', can > 0 && moved > 0, 'the weather setter: ' + can + ' cells can set it, ' + moved + ' move a fact under it');
  }
}

/* ---------------- ANTISYM + PARITY ---------------- */
const haveModel = fs.existsSync(MODEL);
if ((want('ANTISYM') || want('PARITY') || want('SOLVE') || want('WIRING'))) ok('MODEL', haveModel, 'no trained model at ' + MODEL);
const SC = haveModel && (want('ANTISYM') || want('PARITY')) ? require('../chomp/v2/scorer.js').create(API) : null;
if (SC && want('ANTISYM')) {
  const A = SC.table({ p1: S1, p2: S2 }).A, B = SC.table({ p1: S2, p2: S1 }).A;
  let worst = 0;
  for (let a = 0; a < O.N; a++) for (let b = 0; b < O.N; b++) worst = Math.max(worst, Math.abs(A[a][b] + B[b][a] - 1));
  ok('ANTISYM', worst < 1e-9, 'T[a][b] + T\'[b][a] - 1 reaches ' + worst);
  const Tm = SC.table({ p1: S3, p2: S3 }).A;
  let dmax = 0; for (let a = 0; a < O.N; a++) dmax = Math.max(dmax, Math.abs(Tm[a][a] - 0.5));
  ok('ANTISYM', dmax < 1e-9, 'a mirror matchup is not 1/2 on the diagonal: ' + dmax);
}
if (SC && want('PARITY')) {
  const fx = SC.model.fixtures || [];
  ok('PARITY', fx.length >= 10, 'the model carries ' + fx.length + ' parity fixtures');
  let worst = 0;
  for (const f of fx) worst = Math.max(worst, Math.abs(SC.logitRow(f.ga, f.gb, f.sp) - f.logit));
  ok('PARITY', worst < 1e-4, 'JS vs Python logit differs by ' + worst);
}

/* ---------------- SOLVE ---------------- */
if (haveModel && want('SOLVE')) {
  const CH = require('../chomp/v2/chomp2.js').create({ API });
  const r = CH.solve({ mine: S1, theirs: S2 }, { keepTable: true });
  const A = r.table;
  ok('SOLVE', A.length === 90 && A.every(row => row.length === 90 && row.every(v => v > 0 && v < 1)), 'the table is not 90 x 90 in (0, 1)');
  ok('SOLVE', Math.abs(r.mix.reduce((s, p) => s + p, 0) - 1) < 1e-9 && r.mix.every(p => p >= -1e-12), 'the mix does not sum to 1');
  const vs = A.map(row => row.reduce((s, v, j) => s + v * r.oppMix[j], 0));
  const colv = A[0].map((_, j) => A.reduce((s, row, i) => s + r.mix[i] * row[j], 0));
  ok('SOLVE', Math.max(...vs) <= r.value + 1e-6, 'an option beats v* against their mix: ' + (Math.max(...vs) - r.value));
  ok('SOLVE', Math.min(...colv) >= r.value - 1e-6, 'a reply holds my mix under v*: ' + (r.value - Math.min(...colv)));
  ok('SOLVE', r.model === 'chomp2.json', 'the solve did not use the v2 model: ' + r.model);
  ok('SOLVE', r.spread.row_vsUniform_range > 0.02, 'the options barely differ against a uniform opponent: ' + r.spread.row_vsUniform_range);
}

/* ---------------- WIRING ---------------- */
if (haveModel && want('WIRING')) {
  const PV = require('../chomp/arms.js').create({ API });
  const G = { id: 'fixture', sheets: { p1: S1, p2: S2 }, brought: { p1: [0, 1, 2, 3], p2: [0, 1, 2, 3] } };
  const pick = PV.choose('chomp2', G, 'p1', 11);
  ok('WIRING', PV.COUNTERS.chomp2Solves === 1 && PV.COUNTERS.chomp2Failed === 0 && O.indexOf(pick.order) === pick.info.option && pick.info.p > 0, 'arm chomp2: ' + JSON.stringify(pick.info));
  PV.choose('chomp2', G, 'p1', 12);
  ok('WIRING', PV.COUNTERS.chomp2Cached === 1, 'arm chomp2 re-solved a cached (pair, side)');
}

/* ---------------- PIN (abra/regmc 1.73.0) ---------------- */
/* CHOMP v2's spread table is the DERIVED rule only: solver/chomp/v2/build_spreads.js passes HOOKS = { observed: null,
 * tournament: null } to every Deriver it makes, so a new Smogon month or tournament paste cannot silently move it.
 * Checked on the source; the check must refuse a copy with one call unpinned (the control below). */
if (want('PIN')) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'chomp', 'v2', 'build_spreads.js'), 'utf8');
  const pinned = s => {
    const calls = s.match(/(S2\.make\([^)]*\)|new SPR\.Deriver\([^)]*\))/g) || [];
    return { calls: calls.length, unpinned: calls.filter(c => !/,\s*HOOKS\)$/.test(c)), hooks: /const HOOKS = \{ observed: null, tournament: null \};/.test(s) };
  };
  const P = pinned(src);
  ok('PIN', P.hooks && P.calls >= 4 && P.unpinned.length === 0, 'every Deriver in chomp/v2/build_spreads.js takes HOOKS (observed and tournament off): ' + P.calls + ' calls, unpinned ' + JSON.stringify(P.unpinned));
  const C = pinned(src.replace(/S2\.make\(ENGINE\.API, pop, HOOKS\)/, 'S2.make(ENGINE.API, pop)'));
  ok('PIN', C.unpinned.length === 1, 'CONTROL: the check refuses a copy with one call unpinned');
}

/* ---------------- ABILITY ---------------- */
if (want('ABILITY')) {
  const legalOf = sp => [...new Set(Object.values(X.D.species.get(sp).abilities || {}).map(toID))];
  /* species read from the pool's own sheets: one with more than one legal ability, and (if any) one with exactly one */
  const rows = SHEETS.flat();
  const multi = rows.find(r => legalOf(r.species).length > 1), single = rows.find(r => legalOf(r.species).length === 1);
  ok('ABILITY', !!multi, 'no pool species with more than one ability to test with');
  if (multi) {
    const kept = T.buildBody(M, multi);
    ok('ABILITY', kept && kept.ability === toID(multi.ability), 'a declared legal ability was not kept');
    const bare = Object.assign({}, multi, { ability: '' });
    const c0 = T.COUNTERS.abilityUnknownRefused;
    ok('ABILITY', T.buildBody(M, bare) === null && T.COUNTERS.abilityUnknownRefused === c0 + 1, 'a missing ability on a species with several was filled, not refused');
    const f0 = T.COUNTERS.abilityFilledFirst;
    const asked = T.buildBody(M, bare, { abilityUnknown: 'first' });
    ok('ABILITY', asked && T.COUNTERS.abilityFilledFirst === f0 + 1, 'the asked-for first-ability fill did not happen or was not counted');
  }
  if (single) {
    const b = T.buildBody(M, Object.assign({}, single, { ability: '' }));
    ok('ABILITY', b && b.ability === legalOf(single.species)[0], 'a single-ability species was not given its one ability');
  }
}

/* ---------------- deliberate breaks ---------------- */
if (!NO_RED && !ONLY) {
  const breaks = [[{ CHOMP2_BREAK: 'field' }, 'FIELD'], [{ TEAMS_BREAK: 'abilityfill' }, 'ABILITY']];
  if (haveModel) breaks.push([{ CHOMP2_BREAK: 'sign' }, 'ANTISYM'], [{ CHOMP2_BREAK: 'sign' }, 'PARITY'], [{ SLOWKING_BREAK: 'lpdual' }, 'SOLVE']);
  for (const [env, clause] of breaks) {
    const r = cp.spawnSync(process.execPath, [__filename, '--no-red', '--only=' + clause], { env: Object.assign({}, process.env, env), encoding: 'utf8', timeout: 900000 });
    const red = r.status !== 0 && new RegExp('FAIL \\[' + clause + '\\]').test(r.stdout || '');
    ok('BREAKS', red, JSON.stringify(env) + ' did not turn ' + clause + ' red (exit ' + r.status + ')');
    console.log('  red check ' + JSON.stringify(env) + ' -> ' + (red ? 'RED as required' : 'NOT RED'));
  }
}
console.log((fails ? 'RED' : 'GREEN') + ' test-chomp2: ' + (checks - fails) + '/' + checks + (fails ? '  failed: ' + [...failed].join(', ') : '') + '  (' + (ENGINE.id || 'live tree') + ')');
process.exit(fails ? 1 : 0);
