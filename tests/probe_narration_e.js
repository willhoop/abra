/* probe_narration_e.js — NARRATION E: TIDY UP'S ORDER, A DROP AT THE FLOOR, COACHING WITH NO ALLY. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_narration_e.js
 *   SHOWDOWN_PATH=... node tests/probe_narration_e.js --only tidyup
 *   SHOWDOWN_PATH=... node tests/probe_narration_e.js --release <id>
 *
 * Three leads carried on the notes page with no register row (docs/_reports/2026-09-19-driver-narration-e.md):
 *
 *   tidyup    Tidy Up's `onHit` (data/moves.ts, no Champions override) sweeps every doll and the hazards, then
 *             writes `-activate|<user>|move: Tidy Up` when anything went, and only then boosts. We boosted
 *             first and never wrote the `-activate`. MEDI_TIDYUP_BOOST_FIRST.
 *   floor     `Battle#boost` caps before TryBoost (sim/battle.ts:2029-2031), so a drop into a stat at -6
 *             reaches every refuser as 0: no `-fail`, and the loop writes `-unboost|<t>|<stat>|0`. We
 *             refused and announced whatever the stage. MEDI_FLOOR_DROP_REFUSED.
 *   coaching  Coaching with its partner fainted: `|move|…|Coaching|…|[notarget]` then `-fail`
 *             (sim/battle-actions.ts:461-464). ALREADY FIXED at 6.57.0 (narration A); staged here so the
 *             lead is closed on a receipt, not on a memory. MEDI_COACHING_NOALLY_SILENT.
 *
 * Each arm is staged twice: RED (the shape; with the fix the two engines agree on every protocol line and every
 * board, under the knob the protocol parts) and CONTROL (the same board with the one ingredient removed; it
 * agrees with the fix AND under the knob). No line is typed: the streams are compared whole by `playGame`, and
 * the authority is separately asked whether it staged the shape. Every species is derived from the format,
 * filtered to the regulation, and printed. Harness copied from tests/probe_narration_d.js.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_narration_e.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const ALL_KNOBS = ['MEDI_TIDYUP_BOOST_FIRST', 'MEDI_FLOOR_DROP_REFUSED', 'MEDI_COACHING_NOALLY_SILENT'];

let _cur = null, _G = null;
function harness(knob) {
  const key = knob || '(clean)';
  if (_G && _cur === key) return _G;
  for (const k of ALL_KNOBS) delete process.env[k];
  if (knob) process.env[knob] = '1';
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE FORMAT, AND THE FIXTURE DERIVED FROM IT ------------------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (s, mv) => {
  const e = LS[s.id] || (s.baseSpecies && s.baseSpecies !== s.name ? LS[dex.species.get(s.baseSpecies).id] : null);
  return !!(e && e.learnset && e.learnset[dex.moves.get(mv).id]);
};
/* An ability that cannot touch order, a TryHit, a switch-in, a boost, an item or a status: read off its handlers. */
const QUIET = ['onStart', 'onSwitchIn', 'onModifyPriority', 'onFractionalPriority', 'onUpdate', 'onTryHit',
  'onAllyTryHitSide', 'onModifySpe', 'onResidual', 'onDamagingHit', 'onSetStatus', 'onAfterSetStatus', 'onTryBoost',
  'onSwitchOut', 'onBeforeMove', 'onAnyTryPrimaryHit', 'onFoeTryMove', 'onDamage', 'onAfterMoveSecondary',
  'onAfterMoveSecondarySelf', 'onSourceModifyDamage', 'onModifyMove', 'onAnyInvulnerability', 'onFaint', 'onAnyFaint',
  'onEnd', 'onImmunity', 'onAfterBoost', 'onAllyBoost', 'onFoeAfterBoost', 'onChangeBoost', 'onTryAddVolatile',
  'onDragOut', 'onTrapPokemon', 'onFoeTrapPokemon', 'onModifyType', 'onEmergencyExit', 'onAfterUseItem',
  'onAllyAfterUseItem', 'onTakeItem', 'onAllyTryBoost'];
const quiet = a => { const x = dex.abilities.get(a); return x.exists && QUIET.every(h => !x[h]); };
const quietAb = s => Object.values(s.abilities).find(quiet);
const ALL_LEGAL = dex.species.all().filter(s => legal(s) && !/-Mega/.test(s.name) && !s.battleOnly)
  .sort((a, b) => a.name.localeCompare(b.name));
const SPECIES = ALL_LEGAL.filter(s => quietAb(s));
const hasAb = (s, a) => Object.values(s.abilities).includes(dex.abilities.get(a).name);
const NOOPS = ['charm', 'faketears', 'babydolleyes', 'playnice', 'scaryface', 'confide', 'featherdance', 'sweetscent'];
const noop = s => NOOPS.find(m => legal(dex.moves.get(m)) && learns(s, m));
const row = (s, moves, ab, item) => ({ species: s.name, item: item || '', ability: ab || quietAb(s), moves });
const abOf = (s, prefer) => quietAb(s) || (prefer || []).map(a => dex.abilities.get(a).name).find(n => Object.values(s.abilities).includes(n));
const used = new Set();
const take = (xs, why) => {
  const s = xs.find(x => !used.has(x.id) && !used.has(x.baseSpecies));
  if (!s) throw new Error('NOT-STAGEABLE — the format supplies no ' + why);
  used.add(s.id); used.add(s.baseSpecies); return s;
};
const fresh = () => used.clear();
const say = (k, v) => console.log('    ' + String(k).padEnd(24) + ' ' + v);
const P = { m: 'protect' };
const mv = (m, t) => (t == null ? { m } : { m, t });
const nm = s => dex.moves.get(noop(s)).name;
const no = (s, t) => mv(noop(s), dex.moves.get(noop(s)).target === 'normal' ? t : null);


/* ---- § CLASS — printed on every run, derived, never typed --------------------------------------- */
function printClass() {
  console.log(NL + '  CLASS (derived from the format on this run)');
  const T = require(D('data', 'tags.json'));
  const sweepers = Object.keys(T.moves || {}).filter(k => ((T.moves[k].params || {}).removesHazards));
  for (const k of sweepers) {
    const p = T.moves[k].params.removesHazards;
    say('sweeper ' + k, 'sweepBeforeOwnBoost=' + !!p.sweepBeforeOwnBoost + '  activatesOnSweep=' + !!p.activatesOnSweep);
  }
  const refusers = Object.keys(T.abilities || {}).filter(k => ((T.abilities[k].params || {}).preventsStatDrop));
  say('stat-drop refusers', refusers.map(k => k + '(' + T.abilities[k].params.preventsStatDrop.blocks + ')').join(', '));
}

/* ---- THE ARMS ------------------------------------------------------------------------------------ */
const ARMS = [];
function arm(id, knob, build, opts) { ARMS.push(Object.assign({ id, knob, build }, opts || {})); }

/* Tidy Up with rocks on both sides and a doll up; control: Tidy Up with nothing to sweep (boosts only -- no
 * `-activate`, and nothing for the order to be wrong about). */
arm('tidyup', 'MEDI_TIDYUP_BOOST_FIRST', () => {
  fresh();
  const tidier = take(ALL_LEGAL.filter(s => learns(s, 'tidyup') && learns(s, 'protect') && quietAb(s)), 'Tidy Up user');
  const rockA = take(SPECIES.filter(s => learns(s, 'stealthrock') && learns(s, 'substitute')), 'own-side Stealth Rock setter with Substitute');
  const rockB = take(SPECIES.filter(s => learns(s, 'stealthrock') && noop(s)), 'foe Stealth Rock setter');
  const mate = take(SPECIES.filter(s => noop(s)), 'setter partner');
  const bench = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  say('Tidy Up', tidier.name); say('Stealth Rock + Substitute', rockA.name); say('Stealth Rock (p2a)', rockB.name);
  const A = [row(tidier, ['Tidy Up', 'Protect']), row(rockA, ['Stealth Rock', 'Substitute', 'Protect']), row(bench[0], ['Protect']), row(bench[1], ['Protect'])];
  const B = [row(rockB, ['Stealth Rock', nm(rockB)]), row(mate, [nm(mate)]), row(bench[2], ['Protect']), row(bench[3], ['Protect'])];
  const t3 = { p1: [mv('tidyup'), P], p2: [no(rockB, 1), no(mate, 1)] };
  const after = sd => sd.slice(sd.findIndex(l => /^\|move\|p1a: .*\|Tidy Up/.test(l)));
  return {
    red: { A, B, script: [{ p1: [P, mv('stealthrock')], p2: [mv('stealthrock'), no(mate, 1)] },
                          { p1: [P, mv('substitute')], p2: [no(rockB, 1), no(mate, 1)] }, t3],
           shape: sd => { const s = after(sd); const e = s.findIndex(l => /^\|-sideend\|p2: /.test(l));
             const a = s.findIndex(l => /^\|-activate\|p1a: .*\|move: Tidy Up/.test(l));
             const b = s.findIndex(l => /^\|-boost\|p1a: .*\|atk\|1/.test(l));
             return s.some(l => /^\|-end\|p1b: .*\|Substitute/.test(l)) && e > 0 && a > e && b > a; },
           shapeWhy: 'doll -end, both sides\' -sideend, then -activate, then the boosts' },
    control: { A, B, script: [{ p1: [P, P], p2: [no(rockB, 1), no(mate, 1)] }, t3],
               shape: sd => { const s = after(sd); return s.some(l => /^\|-boost\|p1a: .*\|atk\|1/.test(l)) && !s.some(l => /^\|-sideend/.test(l) || /^\|-activate\|p1a: .*\|move: Tidy Up/.test(l)); },
               shapeWhy: 'Tidy Up with nothing to sweep: boosts only' },
  };
});

/* A status Speed drop into an all-stats refuser already at -6 Speed (six Curses of its own -- a self drop no
 * refuser answers); control: the same drop into the same body at 0, which the refuser refuses aloud. */
arm('floor', 'MEDI_FLOOR_DROP_REFUSED', () => {
  fresh();
  const T = require(D('data', 'tags.json'));
  const allStats = Object.keys(T.abilities).filter(k => { const p = (T.abilities[k].params || {}).preventsStatDrop;
    return p && p.blocks === 'all stats' && !p.onlyGrassTypes && !p.onlyFrom && !p.reflects; });
  const refAb = s => allStats.find(a => hasAb(s, a));
  const refuser = take(ALL_LEGAL.filter(s => refAb(s) && learns(s, 'curse') && !s.types.includes('Ghost')), 'all-stats refuser that learns Curse');
  const SPE_DROP = s => dex.moves.all().filter(m => legal(m) && m.category === 'Status' && m.target === 'normal'
    && m.boosts && m.boosts.spe < 0 && Object.keys(m.boosts).length === 1 && learns(s, m.id)).map(m => m.id).sort()[0];
  const dropper = take(SPECIES.filter(s => SPE_DROP(s) && noop(s) && noop(s) !== SPE_DROP(s)), 'status Speed dropper');
  const mate = take(SPECIES.filter(s => noop(s)), 'dropper partner');
  const p1b = take(SPECIES.filter(s => noop(s)), 'refuser partner');
  const bench = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  const sdm = SPE_DROP(dropper), ab = dex.abilities.get(refAb(refuser)).name, sdn = dex.moves.get(sdm).name;
  say('refuser', refuser.name + ' (' + ab + ', Curse)'); say('Speed dropper', dropper.name + ' (' + sdn + ')');
  /* The refuser keeps clicking Curse on the drop turn: a self drop no refuser answers (Clear Body returns on source === target). */
  const A = [row(refuser, ['Curse', 'Protect'], ab), row(p1b, [nm(p1b)]), row(bench[0], ['Protect']), row(bench[1], ['Protect'])];
  const B = [row(dropper, [sdn, nm(dropper)]), row(mate, [nm(mate)]), row(bench[2], ['Protect']), row(bench[3], ['Protect'])];
  /* Every idle click is aimed at the OTHER side's slot b, so nothing but the scripted drop ever touches p1a. */
  const curse = { p1: [mv('curse'), no(p1b, 1)], p2: [no(dropper, 1), no(mate, 1)] };
  const drop = { p1: [mv('curse'), no(p1b, 1)], p2: [mv(sdm, 0), no(mate, 1)] };
  const at = s0 => s0.slice(s0.findIndex(l => l.indexOf('|move|p2a: ') === 0 && l.indexOf('|' + sdn + '|') > 0));
  return {
    red: { A, B, script: [curse, curse, curse, curse, curse, curse, drop],
           shape: s0 => { const s = at(s0); return /^\|-unboost\|p1a: .*\|spe\|0/.test(s[1] || '') && !s.some(l => /^\|-fail\|p1a/.test(l)); },
           shapeWhy: 'at -6 the drop reaches no refuser: `-unboost|spe|0`, no `-fail`' },
    control: { A, B, script: [drop],
               shape: s0 => at(s0).some(l => l.indexOf('|-fail|p1a: ') === 0 && l.indexOf('|unboost|[from] ability: ' + ab) > 0),
               shapeWhy: 'at 0 the refuser refuses aloud' },
  };
});

/* Coaching with its partner fainted; control: Coaching with the partner standing. Two bodies a side, so the
 * fainted partner is not replaced before Coaching is clicked. Already fixed at 6.57.0 -- this arm is the receipt. */
arm('coaching', 'MEDI_COACHING_NOALLY_SILENT', () => {
  fresh();
  const coach = take(ALL_LEGAL.filter(s => learns(s, 'coaching') && learns(s, 'protect') && quietAb(s)), 'Coaching user');
  const frail = take(SPECIES.filter(s => learns(s, 'bellydrum') && noop(s)), 'partner that can pay half its HP');
  const HITS = ['bodyslam', 'facade', 'return', 'tackle', 'quickattack'];
  const hitter = take(SPECIES.filter(s => learns(s, 'protect') && HITS.some(m => legal(dex.moves.get(m)) && learns(s, m))), 'hitter');
  const mate = take(SPECIES.filter(s => noop(s)), 'hitter partner');
  const HITMV = HITS.find(m => legal(dex.moves.get(m)) && learns(hitter, m));
  say('Coaching', coach.name); say('partner', frail.name + ' (Belly Drum to half, then hit)'); say('hitter', hitter.name + ' (' + HITMV + ')');
  const A = [row(coach, ['Coaching', 'Protect']), row(frail, ['Belly Drum', nm(frail)])];
  const B = [row(hitter, [dex.moves.get(HITMV).name, 'Protect']), row(mate, [nm(mate)])];
  const hit = { p1: [P, no(frail, 0)], p2: [mv(HITMV, 1), no(mate, 0)] };
  return {
    red: { A, B, max: 2, script: [{ p1: [P, mv('bellydrum')], p2: [P, no(mate, 1)] }, hit, hit, hit,
                          { p1: [mv('coaching'), null], p2: [P, no(mate, 0)] }],
           shape: sd => sd.some(l => /^\|faint\|p1b/.test(l)) && sd.some(l => /^\|move\|p1a: .*\|Coaching\|.*\[notarget\]/.test(l)),
           shapeWhy: 'Coaching clicked with the partner fainted: [notarget] + -fail' },
    control: { A, B, max: 2, script: [{ p1: [mv('coaching'), no(frail, 0)], p2: [P, no(mate, 0)] }],
               shape: sd => sd.some(l => /^\|-boost\|p1b: .*\|atk\|1/.test(l)),
               shapeWhy: 'Coaching with the partner standing boosts it' },
  };
});

/* ---- PLAYING ONE ARM --------------------------------------------------------------------------- */
function play(G, sc, name) {
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get('middle');
  const bo = sc.max ? { max: sc.max } : undefined;
  const a = G.buildPair(sc.A, bo), b = G.buildPair(sc.B, bo);
  if (!a || !b) return { notStaged: 'buildPair refused side ' + (!a ? 'A' : 'B') };
  const r = G.playGame(a, b, 'directed', 'probe_narration_e :: ' + name, { script: sc.script, arm });
  return { r, sd: G.sdStream(G.lastSdLog()).map(String), sc: G.scriptCounters(),
           fails: Object.assign({}, globalThis.MEDFAILS || {}) };
}
const divOf = r => r.div ? (r.div.agreedLines + '  SD ' + r.div.sdRaw + '  <>  US ' + r.div.meRaw) : 'none';

printClass();
let bad = 0, ran = 0;
for (const A of ARMS) {
  if (ONLY && A.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + A.id + '    knob ' + A.knob);
  let fx;
  try { fx = A.build(); } catch (e) { console.log('  ' + String(e.message || e)); bad++; continue; }
  for (const kind of ['red', 'control']) {
    const sc = fx[kind];
    const clean = play(harness(null), sc, A.id + ' ' + kind + ' clean');
    const brk = play(harness(A.knob), sc, A.id + ' ' + kind + ' knob');
    harness(null);
    ran++;
    console.log('  [' + kind + ']  ' + sc.shapeWhy);
    if (clean.notStaged || brk.notStaged) { console.log('    NOT-STAGED — ' + (clean.notStaged || brk.notStaged)); bad++; continue; }
    if (clean.r.err || brk.r.err) { console.log('    THREW — ' + (clean.r.err || brk.r.err)); bad++; continue; }
    const leaked = Object.keys(clean.fails).filter(k => /Restored$/.test(k) && clean.fails[k]);
    console.log('    clean  first divergence ' + divOf(clean.r) + '   board ' + (clean.r.stateDiv ? 'PARTED t' + clean.r.stateDiv.turn : 'held ' + clean.r.boundariesAgreed + '/' + clean.r.boundaries));
    console.log('    knob   first divergence ' + divOf(brk.r) + '   board ' + (brk.r.stateDiv ? 'PARTED t' + brk.r.stateDiv.turn : 'held'));
    if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) {
      console.log('    >> FIXTURE FAILED — a scripted click was refused (' + JSON.stringify(clean.sc) + ')'); bad++; continue; }
    if (process.argv.includes('--show')) console.log(clean.sd.map(l => '      | ' + l).join(NL));
    if (!sc.shape(clean.sd)) { console.log('    >> FIXTURE FAILED — the authority did not stage the shape: ' + sc.shapeWhy); bad++; continue; }
    if (leaked.length) { console.log('    >> the CLEAN run carries a restore stamp (' + leaked.join(', ') + '); the harness leaked a knob.'); bad++; continue; }
    if (clean.r.div) { console.log('    >> RED — the protocol parts with the fix in.'); bad++; continue; }
    if (clean.r.stateDiv) { console.log('    >> RED — the boards part with the fix in.'); bad++; continue; }
    if (kind === 'red' && !brk.r.div) { console.log('    >> THE KNOB DOES NOT REACH THE MECHANISM — the old engine agrees too.'); bad++; continue; }
    if (kind === 'red' && brk.r.stateDiv && !A.board) { console.log('    >> THE KNOB PARTS A BOARD — this was meant to be narration only.'); bad++; continue; }
    if (kind === 'control' && brk.r.div) { console.log('    >> THE KNOB PARTS THE CONTROL — it reaches more than the mechanism.'); bad++; continue; }
    console.log('    OK');
  }
}
console.log(NL + '================================================================');
if (!ran) { console.log('NOT RUN — no arm matched --only ' + ONLY + '. This is not a pass.'); process.exit(2); }
console.log(bad ? 'FAIL — ' + bad + ' problem(s) over ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)');
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
