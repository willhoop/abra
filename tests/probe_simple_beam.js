/* probe_simple_beam.js — SIMPLE, WRITTEN ONTO A BODY BY SIMPLE BEAM, DOUBLES EVERY STAT CHANGE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_simple_beam.js
 *   SHOWDOWN_PATH=... MEDI_SIMPLE_UNAMPLIFIED=1 node tests/probe_simple_beam.js   (the red)
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * No legal species carries Simple, and Simple Beam is legal (engine/legal_scope.js `conferred`). The
 * engine's own comment above `invSign` declared the gap: *"The DOUBLING at these move-driven sites (a
 * Simple body's Swords Dance is +4) is not modelled ... only applyStatDrop applies the x2."*
 *
 * ================= THE AUTHORITY ================================================================
 *
 *     simple: { onChangeBoost(boost, target, source, effect) {
 *       if (effect && effect.id === 'zpower') return;
 *       for (i in boost) boost[i]! *= 2;
 *     }, flags: { breakable: 1 }, ... }                    data/abilities.ts:4274-4286
 *
 * with no Champions override. `onChangeBoost` runs inside `Battle#boost`, so a raise and a drop are
 * both doubled.
 *
 * ================= WHAT IS ASSERTED =============================================================
 *
 * Three turns per arm, both engines, no typed stage anywhere: (1) the beamer clicks Simple Beam at the
 * target (TEST) or idles (CONTROL); (2) the target clicks a pure self-boost; (3) the beamer clicks a
 * single-target stat drop at it. After turns 2 and 3 the target's five stat stages are read out of BOTH
 * engines and must agree, on BOTH arms. The authority's TEST arm must differ from its CONTROL arm
 * (otherwise the fixture cannot show Simple at all), and the ability the authority's target holds after
 * turn 1 is read off the body, not assumed.
 *
 * THE FIXTURE WAS WRONG TWICE BEFORE IT RAN, BOTH LOUDLY. The ability filter's `/Stat/` matched
 * `curesStatusResidual` and refused Healer, and the only buildable Simple Beam learner cannot legally
 * learn `champions_sim.INERT_MOVE` — so a body's idle click is now derived per body (the inert move, or
 * Protect where the body never has to receive anything), and the target alone must learn the inert move.
 *
 * `MEDI_SIMPLE_UNAMPLIFIED=1` takes the multiplier back out of `invSign`. The parent re-runs itself under
 * it and FAILS unless the child's TEST arm goes red while its CONTROL stays green.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('SIMPLE BEAM');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}
require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const { mcKey } = require(D('engine', 'mc_key.js'));
const TAGS = require(D('data', 'tags.json'));

const CHILD = process.env.MEDI_SIMPLE_UNAMPLIFIED === '1';
let bad = 0, stage = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
const FIXTURE = (m) => { stage++; console.log('  FIXTURE  ' + m); };
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const buildable = s => legal(s) && !s.battleOnly && !s.isMega && !s.requiredItem;
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const INERT_MV = idOf(CS.INERT_MOVE);
const learns = (s, mv) => { try { return CS.canLearn(s.name, mv); } catch (e) { console.error('canLearn threw for ' + s.name + '/' + mv + ': ' + e.message); return false; } };
const mcRow = s => { try { return !!MEDI.buildMon(mcKey(s.name, { mayMiss: 'a probe body must be a real row' }), {}); }
  catch (e) { console.error('buildMon threw for ' + s.name + ' -- ' + e.message); return false; } };
/* AN ABILITY THAT TOUCHES A STAT CHANGE — or ignores the target's ability, which would ignore Simple —
 * WOULD BE A SECOND REASON. Refused by its TAGS, not by name. */
const inertAb = s => { const ab = idOf(Object.values(s.abilities)[0]); const t = ((TAGS.abilities || {})[ab] || {}).tags || [];
  return !t.some(x => /Boost|Stage|StatDrop|statDrop|StatChange|statChange|redirect|reflect|ignores|breaks|copies|swaps/.test(x)); };
const idleOf = s => learns(s, CS.INERT_MOVE) ? INERT_MV : (learns(s, 'protect') ? 'protect' : null);

console.log('\n== SIMPLE, WRITTEN BY SIMPLE BEAM ==' + (CHILD ? '   [MEDI_SIMPLE_UNAMPLIFIED=1]' : '') + '\n');

/* 1 — THE FIXTURE, DERIVED. */
const BEAM = Object.keys(TAGS.moves || {}).filter(k => {
  const p = TAGS.moves[k].params && TAGS.moves[k].params.rewritesTargetAbility;
  return p && p.becomes === 'simple' && legal(dex.moves.get(k));
});
const SIMPLE_ROW = (TAGS.abilities || {}).simple;
console.log('  moves that write Simple (rewritesTargetAbility.becomes): ' + (BEAM.join(', ') || '(none)'));
console.log('  data/tags.json simple.amplifiesBoosts: ' + JSON.stringify(SIMPLE_ROW && SIMPLE_ROW.params && SIMPLE_ROW.params.amplifiesBoosts));
if (!BEAM.length) { console.log('  NOT RUN — no legal move writes Simple. A claim about the FORMAT.'); process.exit(2); }
const BEAMMV = BEAM[0];

const lsOf = s => Object.keys((dex.species.getLearnsetData(s.id) || {}).learnset || {});
const dropOf = s => lsOf(s).map(id => dex.moves.get(id)).filter(m =>
  legal(m) && m.category === 'Status' && m.target === 'normal' && (m.accuracy === true || m.accuracy === 100)
  && m.boosts && Object.values(m.boosts).every(v => v < 0) && !m.status && !m.volatileStatus && !m.onHit
  && !m.onTryHit && !m.secondary && learns(s, m.id)).sort((a, b) => a.id.localeCompare(b.id));
const upOf = s => lsOf(s).map(id => dex.moves.get(id)).filter(m =>
  legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts && Object.values(m.boosts).every(v => v > 0)
  && !m.onHit && !m.onTryHit && !m.onTry && !m.volatileStatus && !m.heal && learns(s, m.id)).sort((a, b) => a.id.localeCompare(b.id));

let BEAMER = null;
for (const s of dex.species.all().filter(buildable).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!learns(s, BEAMMV) || !inertAb(s) || !mcRow(s)) continue;
  const idle = idleOf(s), d = dropOf(s); if (!idle || !d.length) continue;
  BEAMER = { sp: s, drop: d[0], idle }; break;
}
if (!BEAMER) { FIXTURE('no legal ' + BEAMMV + ' learner with a stat-inert ability, an idle click and a plain single-target drop'); process.exit(2); }
let TARGET = null;
for (const s of dex.species.all().filter(buildable).sort((a, b) => (b.baseStats.hp + b.baseStats.def) - (a.baseStats.hp + a.baseStats.def))) {
  if (s.id === BEAMER.sp.id || !learns(s, CS.INERT_MOVE) || !inertAb(s) || !mcRow(s)) continue;
  if (!dex.getImmunity(BEAMER.drop.type, s)) continue;
  const u = upOf(s); if (!u.length) continue;
  TARGET = { sp: s, up: u[0] }; break;
}
if (!TARGET) { FIXTURE('no legal target with a stat-inert ability, the inert move and a pure self-boost'); process.exit(2); }
const pad = (not) => { const s = dex.species.all().filter(buildable).sort((a, b) => a.name.localeCompare(b.name))
  .find(x => !not.includes(x.id) && idleOf(x) && inertAb(x) && mcRow(x)); return s ? { sp: s, idle: idleOf(s) } : null; };
const PAD1 = pad([BEAMER.sp.id, TARGET.sp.id]), PAD2 = pad([BEAMER.sp.id, TARGET.sp.id, PAD1 && PAD1.sp.id]);
if (!PAD1 || !PAD2) { FIXTURE('no two inert pad bodies'); process.exit(2); }
console.log('\n  CHOSEN   beamer=' + BEAMER.sp.name + ' (' + Object.values(BEAMER.sp.abilities)[0] + ', idle ' + BEAMER.idle + ') drop='
  + BEAMER.drop.id + ' ' + JSON.stringify(BEAMER.drop.boosts)
  + '\n           target=' + TARGET.sp.name + ' (' + Object.values(TARGET.sp.abilities)[0] + ', idle ' + INERT_MV + ') self-boost='
  + TARGET.up.id + ' ' + JSON.stringify(TARGET.up.boosts)
  + '\n           pads=' + PAD1.sp.name + ' (' + PAD1.idle + '), ' + PAD2.sp.name + ' (' + PAD2.idle + ')');

const STATS = [['atk', 'at'], ['def', 'df'], ['spa', 'sa'], ['spd', 'sd'], ['spe', 'sp']];
const SCRIPT = beam => [
  { a: beam ? BEAMMV : BEAMER.idle, aimA: beam, v: INERT_MV },
  { a: BEAMER.idle, aimA: false, v: TARGET.up.id },
  { a: BEAMER.drop.id, aimA: true, v: INERT_MV },
];

function runMedi(beam) {
  const mk = (sp, moves) => { const b = MEDI.buildMon(mcKey(sp.name, { mayMiss: 'a probe body must be a real row' }), {});
    b.moves = moves.slice(); b.item = ''; b.ability = idOf(Object.values(sp.abilities)[0]); return b; };
  const A = mk(BEAMER.sp, [BEAMMV, BEAMER.drop.id, BEAMER.idle]), A2 = mk(PAD1.sp, [PAD1.idle]);
  const V = mk(TARGET.sp, [TARGET.up.id, INERT_MV]), V2 = mk(PAD2.sp, [PAD2.idle]);
  const S = MEDI.battleInit([A, A2], [V, V2], { seeded: true });
  const out = [];
  let ab1 = null;
  for (const [t, c] of SCRIPT(beam).entries()) {
    MEDI.battleTurn(S, () => 0.5,
      new Map([[A, MEDI.playerAction(A, c.a, c.aimA ? V : null, S.field)], [A2, MEDI.playerAction(A2, PAD1.idle, null, S.field)]]),
      new Map([[V, MEDI.playerAction(V, c.v, null, S.field)], [V2, MEDI.playerAction(V2, PAD2.idle, null, S.field)]]));
    if (t === 0) ab1 = V.ability;
    out.push(STATS.map(([, e]) => V.boosts[e] | 0));
  }
  return { ab1, stages: out };
}
function runSD(beam) {
  const set = (sp, mv) => ({ name: sp.name, species: sp.name, item: '', ability: Object.values(sp.abilities)[0],
    moves: mv.map(m => dex.moves.get(m).name), nature: 'Serious',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack([set(BEAMER.sp, [BEAMMV, BEAMER.drop.id, BEAMER.idle]), set(PAD1.sp, [PAD1.idle])]) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack([set(TARGET.sp, [TARGET.up.id, INERT_MV]), set(PAD2.sp, [PAD2.idle])]) });
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  const V = b.sides[1].active[0];
  const out = [];
  let ab1 = null;
  for (const [t, c] of SCRIPT(beam).entries()) {
    b.choose('p1', 'move ' + c.a + (c.aimA ? ' 1' : '') + ', move ' + PAD1.idle);
    b.choose('p2', 'move ' + c.v + ', move ' + PAD2.idle);
    if (t === 0) ab1 = V.ability;
    out.push(STATS.map(([s]) => V.boosts[s] | 0));
  }
  return { ab1, stages: out };
}
const J = x => JSON.stringify(x);

const cM = runMedi(false), cS = runSD(false), tM = runMedi(true), tS = runSD(true);
console.log('\n  stages [atk,def,spa,spd,spe] after turns 2 and 3');
console.log('    CONTROL  medi ' + J(cM.stages.slice(1)) + '   sd ' + J(cS.stages.slice(1)));
console.log('    TEST     medi ' + J(tM.stages.slice(1)) + '   sd ' + J(tS.stages.slice(1)) + '   (sd ability after turn 1: ' + tS.ab1 + ')\n');

ok(tS.ab1 === 'simple' && cS.ab1 !== 'simple' && J(tS.stages.slice(1)) !== J(cS.stages.slice(1)),
  'FIXTURE — in the authority the beam wrote Simple, and the TEST arm\'s stages differ from the CONTROL\'s',
  'sd ability ' + cS.ab1 + ' -> ' + tS.ab1 + '; sd control ' + J(cS.stages.slice(1)) + ' vs test ' + J(tS.stages.slice(1)));
ok(J(cM.stages.slice(1)) === J(cS.stages.slice(1)),
  'CONTROL — with no Simple Beam the two engines land the same stages',
  'medi ' + J(cM.stages.slice(1)) + '   sd ' + J(cS.stages.slice(1)));
ok(tM.ab1 === 'simple' && J(tM.stages.slice(1)) === J(tS.stages.slice(1)),
  'TEST — after Simple Beam the two engines land the same stages, the raise AND the drop',
  'medi ' + J(tM.stages.slice(1)) + ' (ability ' + tM.ab1 + ')   sd ' + J(tS.stages.slice(1)));
if (!CHILD) {
  const C = MEDI.MEDSEEN || {};
  ok((C.boostAmplified || 0) > 0, 'COUNTER — the amplifier was reached',
    'boostAmplified=' + (C.boostAmplified === undefined ? 'ABSENT' : C.boostAmplified));
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, MEDI_SIMPLE_UNAMPLIFIED: '1' }, encoding: 'utf8' });
  const out = String(r.stdout || '') + String(r.stderr || '');
  const line = (out.match(/^ *(PASS|FAIL) *TEST — after Simple Beam.*$/m) || [''])[0].trim();
  const ctl = (out.match(/^ *(PASS|FAIL) *CONTROL — with no Simple Beam.*$/m) || [''])[0].trim();
  ok(r.status !== 0 && /FAIL/.test(line) && /PASS/.test(ctl),
    'KNOB — taking the multiplier out of invSign REDS the TEST arm and leaves the CONTROL green',
    'child exit ' + r.status + '   ' + (line || '(nothing printed — the knob is not wired)') + '   control: ' + (ctl || '(nothing)'));
}
console.log('\n  ' + (stage ? stage + ' FIXTURE problem(s) — a claim about the fixture, never about the mechanic. ' : '')
  + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad || stage ? 1 : 0);
