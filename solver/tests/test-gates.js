/* solver/tests/test-gates.js — MAG v2 (the per-slot dead-click gate) and DODUO v2 (the pair gate) on CONSTRUCTED
 * boards, one clause per case, each shown RED on a deliberate break.
 *
 *   node solver/tests/test-gates.js [--no-red]      exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND
 *
 * EVERY ENTITY IS DERIVED FROM THE REG M-C FORMAT, NONE IS TYPED. Species, moves and their properties are picked by
 * PROPERTY from Dex.forFormat (solver/human/dex.js, filtered to the regulation: exists, not isNonstandard, not
 * Illegal) — "a single-target damaging move", "a species whose typing is immune to that move's type", "a status move
 * that inflicts a status", "a side-condition move", "a redirect move" — and each case first checks its PREMISE with
 * one plain engine step, so a derived pick that the engine plays differently is caught as CANNOT ANSWER, never as a
 * pass. Helping Hand is Will's own example and is asserted legal before use.
 *
 * CLAUSES
 *   IMMUNE      a damaging move into a type-immune foe: SOFT while the foe has a bench (a switch-in takes it), DEAD
 *               with no bench; the same move into a non-immune foe is LIVE
 *   STATUSED    a status move onto a foe that already has a status: SOFT with a bench, DEAD without; LIVE onto a
 *               clean foe
 *   SIDECOND    a side-condition move while that condition is already up: DEAD even though the foe can switch (the
 *               user's own side, not the target); LIVE when it is down
 *   PARTNER     a status move at my OWN statused partner is LIVE because the partner can switch (the incoming ally
 *               takes it) — the "whatever the partner does" quantifier
 *   HH          Helping Hand: the pair (HH, attacking partner) is KEPT; (HH, non-attacking partner) and (HH, switching
 *               partner) are CUT; MAG leaves Helping Hand itself LIVE (it works beside an attacker)
 *   REDIRECT    both slots on the same redirect move: CUT; one redirect beside an attack: KEPT
 *   REFUSED     both slots switching to one bench body is not a joint at all (MEDICHAM legalActions refuses it)
 *   REACH       when every slot-k click is futile beside the partner's click, one of those pairs is kept, so the
 *               partner's click stays reachable
 *   HEAL        Helping Hand beside an attack stays KEPT under a terrain whose turn-end heal could otherwise wash the
 *               boosted hit off the board before it is read
 *   TALL        a Protect beside a partner who KOs the only attacker first is KEPT: futility that needs a KO depends on
 *               damage, and damage on spreads nobody can see
 *   DISJOINT    the pair gate never cuts a pair because of a click MAG calls dead
 *   EXEC        a body KO'd before it acts is UNINFORMATIVE (its click neither succeeded nor failed)
 *   DICE        a Protect-family click on a long streak (a 1-in-729 roll) is LIVE: the gate never cuts on a roll
 *   FROZEN      solver/doduo/board_state.frozen.js is the copy its receipt names
 *
 * RED, unless --no-red: re-runs itself under each GATE_BREAK and REQUIRES the named clause to fail:
 *   anytrue -> IMMUNE, softhard -> IMMUNE, nopartner -> PARTNER, pairany -> DISJOINT, norep -> REACH, exec -> EXEC,
 *   dice -> DICE, short -> TALL, shieldcounts -> STATUSED, fullheal -> HEAL.
 */
'use strict';
require('../arena/env.js');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red');

const API = require('../../engine/medicham_api.js');
const M = API.M;
const X = require('../human/dex.js');
const D = X.D;
const PR = require('../mag/probe.js');
const probe = PR.create(API);
const hh = D.moves.get('helpinghand');       // Will's example; asserted legal before any use
if (!X.legal(hh)) cannot('Helping Hand is not in this regulation');
const MG = require('../mag/gate.js').create(API);
const DG = require('../doduo/gate.js').create(API, { mag: MG });

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log('  FAIL [' + clause + '] ' + msg); } };
const cannot = why => { console.log('CANNOT ANSWER: ' + why); process.exit(2); };

/* ---------- derived entities ---------- */
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const MOVES = D.moves.all().filter(X.legal).sort(byId);
const SPECIES = D.species.all().filter(s => X.legal(s) && !s.isMega && !s.battleOnly && !s.forme && (() => { try { return !!M.buildMon(s.id, {}); } catch (e) { return false; } })()).sort(byId);
if (SPECIES.length < 20 || MOVES.length < 100) cannot('the regulation dex is too thin: ' + SPECIES.length + ' species, ' + MOVES.length + ' moves');
const plainDamaging = m => (m.category === 'Physical' || m.category === 'Special') && m.target === 'normal' && m.basePower >= 50 && m.basePower <= 90
  && (m.accuracy === true || m.accuracy === 100) && !m.priority && !m.flags.charge && !m.flags.recharge && !m.selfSwitch && !m.multihit
  && !m.ohko && !m.ignoreImmunity && !m.selfdestruct && !m.onTry && !m.onTryHit && !m.onModifyType && !m.onBasePower && !m.basePowerCallback
  && !m.damageCallback && !m.self && !m.secondary && !m.drain && !m.recoil && !m.hasCrashDamage && !m.volatileStatus && !m.forceSwitch;
/* the plainest Protect-family move: a stalling self-move whose condition blocks (onTryHit) and does the fewest other things */
const stallMove = MOVES.filter(m => m.stallingMove && m.target === 'self' && m.condition && m.condition.onTryHit)
  .sort((a, b) => Object.keys(a.condition).length - Object.keys(b.condition).length || byId(a, b))[0];
if (!stallMove) cannot('no Protect-family move in this regulation');
const firstAbility = s => { const a = Object.values(s.abilities || {}).map(X.toID); return a[0]; };
/* a species whose every legal ability is, by the dex, one with no handler that could touch a move or a status —
 * so the fixtures are about typing and state, not about an ability. Read off the ability objects themselves. */
const QUIET_KEYS = /^on(TryHit|Immunity|SetStatus|FoeRedirectTarget|AnyRedirectTarget|ModifyType|Damage|TryBoost|SourceModify|ModifyMove|AllyTryHitSide|TryHitSide|DragOut|FoeTryMove|AnyTryMove|SwitchIn|Start|Update|Residual|BeforeMove|ModifyPriority)/;
const quietAbility = id => { const a = D.abilities.get(id); return !!(a && a.exists) && !Object.keys(a).some(k => QUIET_KEYS.test(k)) && !a.isBreakable; };
const quietSpecies = SPECIES.filter(s => quietAbility(firstAbility(s)));
if (quietSpecies.length < 10) cannot('too few species with a quiet ability: ' + quietSpecies.length);

let sheetIx = 0;
function body(sp, moves, o) {
  o = o || {};
  const b = M.buildMon(sp.id, {});
  b.moves = moves.map(m => (typeof m === 'string' ? m : m.id));
  b.item = '';
  b.ability = firstAbility(sp);
  b._solverSheet = (sheetIx++) % 6;
  if (o.hp != null) b.curHP = o.hp === 'max' ? b.st.hp : o.hp;
  if (o.status) b.status = o.status;
  if (o.spe != null) b.st.sp = o.spe;
  if (o.fainted) { b.curHP = 0; b.fainted = true; }
  return b;
}
function battle(A, B) { const S = API.newBattle(A, B, { seeded: true }); S.maxTurns = Infinity; return S; }
const opt = (la, k, pred) => la.slots[k].options.find(pred);
const mvOpt = (la, k, id, target) => opt(la, k, o => o.kind === 'move' && o.move === id && !o.mega && (o.target == null ? null : o.target) === (target == null ? null : target));
const pos = (S, o) => probe.position(S, 'A', Object.assign({ salt: 11 }, o || {}));
/* what a foe clicks in every fixture: a weak plain attack and a Protect, so the covering design has both an opponent
 * that acts and one that hides (a foe with only a Protect would make every click at it fail and prove nothing) */
const weak = MOVES.filter(plainDamaging).find(m => m.basePower <= 60);
const FOE = [weak, stallMove];
/* the premise: one plain step with every other body passing — did the click succeed (the engine's own result)? */
function premise(S, k, o) {
  const T = API.clone(S);
  const j = [PR.PASS, PR.PASS]; j[k] = o;
  API.stepInPlace(T, j, [PR.PASS, PR.PASS], M.midEventDice({ seed: 5, reset: false }));
  const m = T.actA[k];
  return m ? (m._mvResLast !== undefined ? m._mvResLast : m._mvRes) : undefined;
}

/* ---------- IMMUNE ---------- */
let immune = null;
for (const mv of MOVES.filter(plainDamaging)) {
  const F = quietSpecies.find(s => D.getImmunity(mv.type, s.types) === false);
  const N = quietSpecies.find(s => D.getImmunity(mv.type, s.types) && D.getEffectiveness(mv.type, s.types) === 0 && s.baseStats.hp >= 80);
  const U = quietSpecies.find(s => s.types.includes(mv.type)) || quietSpecies[0];
  if (!F || !N || !U) continue;
  const P = quietSpecies.find(s => s !== U && s !== F && s !== N);
  const S0 = battle([body(U, [mv, stallMove]), body(P, [stallMove])], [body(F, FOE), body(N, FOE)]);
  const la0 = API.legalActions(S0, 'A');
  const oF = mvOpt(la0, 0, mv.id, 1), oN = mvOpt(la0, 0, mv.id, 2);
  if (!oF || !oN) continue;
  if (premise(S0, 0, oF) === true || premise(S0, 0, oN) !== true) continue;   // the engine must refuse the immune target and hit the other
  immune = { mv, F, N, U, P };
  break;
}
if (!immune) cannot('no derived (move, immune species, plain species) triple passed its premise');
{
  const { mv, F, N, U, P } = immune;
  const B3 = quietSpecies.find(s => ![U, P, F, N].includes(s) && D.getImmunity(mv.type, s.types));
  /* with a bench: a switch-in takes the move -> SOFT; the plain target -> LIVE */
  const S1 = battle([body(U, [mv, stallMove]), body(P, [stallMove])], [body(F, FOE), body(N, FOE), body(B3, FOE)]);
  const p1 = pos(S1);
  const vF = MG.verdict(p1, 0, mvOpt(p1.la, 0, mv.id, 1)), vN = MG.verdict(p1, 0, mvOpt(p1.la, 0, mv.id, 2));
  ok('IMMUNE', vF.v === 'soft', `${mv.id} into ${F.id} with a bench: expected soft, got ${vF.v} (${vF.why || ''})`);
  ok('IMMUNE', vN.v === 'live', `${mv.id} into ${N.id}: expected live, got ${vN.v}`);
  /* no bench: nothing can take it -> DEAD */
  const S2 = battle([body(U, [mv, stallMove]), body(P, [stallMove])], [body(F, FOE), body(N, FOE)]);
  const p2 = pos(S2);
  const vF2 = MG.verdict(p2, 0, mvOpt(p2.la, 0, mv.id, 1));
  ok('IMMUNE', vF2.v === 'dead', `${mv.id} into ${F.id} with no bench: expected dead, got ${vF2.v} (${vF2.why || ''})`);
  console.log(`  IMMUNE: ${U.id} ${mv.id} (${mv.type}) into ${F.id} [${F.types}] -> ${vF.v} with a bench, ${vF2.v} without; into ${N.id} -> ${vN.v}`);

  /* ---------- DISJOINT: the pair gate never cuts a pair over a MAG-dead click ---------- */
  const dead = mvOpt(p2.la, 0, mv.id, 1);
  let pairsWithDead = 0, cutOnDead = 0;
  for (const j of p2.la.joint) {
    if (PR.optKey(j[0]) !== PR.optKey(dead)) continue;
    pairsWithDead++;
    const pv = DG.pairVerdict(p2, j);
    if (pv.cut && pv.slot === 0) cutOnDead++;
  }
  ok('DISJOINT', pairsWithDead > 0 && cutOnDead === 0, `the pair gate cut ${cutOnDead} of ${pairsWithDead} pairs on a MAG-dead click`);
  console.log(`  DISJOINT: ${pairsWithDead} pairs hold the MAG-dead click; the pair gate cut ${cutOnDead} of them on it`);
}

/* ---------- STATUSED ---------- */
{
  let done = false;
  for (const sm of MOVES.filter(m => m.category === 'Status' && m.target === 'normal' && m.status && !m.volatileStatus && !m.onTry && !m.onTryHit
    && !m.flags.powder && (m.accuracy === true || m.accuracy >= 75))) {
    const N = quietSpecies.find(s => s.baseStats.hp >= 70 && !s.types.some(t => !D.getImmunity(sm.type, [t])));
    const U = quietSpecies.find(s => s !== N);
    const P = quietSpecies.find(s => s !== N && s !== U);
    const B3 = quietSpecies.find(s => ![N, U, P].includes(s));
    if (!N || !U || !P || !B3) continue;
    const other = ['brn', 'par', 'psn'].find(x => x !== sm.status);
    const S0 = battle([body(U, [sm, stallMove]), body(P, [stallMove])], [body(N, FOE), body(B3, FOE)]);
    const o0 = mvOpt(API.legalActions(S0, 'A'), 0, sm.id, 1);
    if (!o0 || premise(S0, 0, o0) !== true) continue;                       // clean foe: the status lands
    const Sx = battle([body(U, [sm, stallMove]), body(P, [stallMove])], [body(N, FOE, { status: other }), body(B3, FOE)]);
    if (premise(Sx, 0, mvOpt(API.legalActions(Sx, 'A'), 0, sm.id, 1)) === true) continue;   // statused foe: refused
    const B4 = quietSpecies.find(s => ![N, U, P, B3].includes(s));
    const S1 = battle([body(U, [sm, stallMove]), body(P, [stallMove])], [body(N, FOE, { status: other }), body(B3, FOE), body(B4, FOE)]);
    const p1 = pos(S1);
    const v1 = MG.verdict(p1, 0, mvOpt(p1.la, 0, sm.id, 1));
    const S1c = battle([body(U, [sm, stallMove]), body(P, [stallMove])], [body(N, FOE), body(B3, FOE), body(B4, FOE)]);
    const p1c = pos(S1c);
    const vClean = MG.verdict(p1c, 0, mvOpt(p1c.la, 0, sm.id, 1));
    const p2 = pos(Sx);
    const v2 = MG.verdict(p2, 0, mvOpt(p2.la, 0, sm.id, 1));
    ok('STATUSED', v1.v === 'soft', `${sm.id} onto a ${other} ${N.id} with a bench: expected soft, got ${v1.v} (${v1.why || ''})`);
    ok('STATUSED', v2.v === 'dead', `${sm.id} onto a ${other} ${N.id} with no bench: expected dead, got ${v2.v} (${v2.why || ''})`);
    ok('STATUSED', vClean.v === 'live', `${sm.id} onto the same ${N.id} clean: expected live, got ${vClean.v}`);
    console.log(`  STATUSED: ${U.id} ${sm.id} (${sm.status}) onto a ${other} ${N.id} -> ${v1.v} with a bench, ${v2.v} without; onto the same body clean -> ${vClean.v}`);

    /* ---------- PARTNER: the same move at my own statused partner, who can switch ---------- */
    /* the partner's bench body must be one the move lands on (checked with the engine, as every premise is) */
    const Bm = quietSpecies.find(s => ![N, U, P, B3, B4].includes(s) && (() => {
      const T0 = battle([body(U, [sm, stallMove]), body(s, [stallMove])], [body(N, FOE), body(B3, FOE)]);
      const o = mvOpt(API.legalActions(T0, 'A'), 0, sm.id, -2);
      return o && premise(T0, 0, o) === true;
    })());
    if (!Bm) continue;
    const Sp = battle([body(U, [sm, stallMove]), body(P, [stallMove], { status: other }), body(Bm, [stallMove])], [body(N, FOE), body(B3, FOE)]);
    const pp = pos(Sp);
    const oA = mvOpt(pp.la, 0, sm.id, -2);
    const vA = oA ? MG.verdict(pp, 0, oA) : { v: 'no option' };
    ok('PARTNER', vA.v === 'live', `${sm.id} at my ${other} partner, who can switch: expected live, got ${vA.v} (${vA.why || ''})`);
    console.log(`  PARTNER: ${sm.id} at my ${other} partner (bench behind it) -> ${vA.v}`);
    done = true;
    break;
  }
  if (!done) cannot('no derived status move passed its premise');
}

/* ---------- SIDECOND ---------- */
{
  let done = false;
  for (const sc of MOVES.filter(m => m.sideCondition && m.target === 'allySide' && m.sideCondition === m.id && m.id !== 'tailwind')) {
    const U = quietSpecies[0], P = quietSpecies[1], F = quietSpecies[2], N = quietSpecies[3], B3 = quietSpecies[4];
    const mk = up => { const S = battle([body(U, [sc, stallMove]), body(P, [stallMove])], [body(F, FOE), body(N, FOE), body(B3, FOE)]); if (up) S.sfA.sc[sc.id] = 3; return S; };
    const oOf = S => mvOpt(API.legalActions(S, 'A'), 0, sc.id, null);
    const S0 = mk(false), S1 = mk(true);
    if (!oOf(S0) || premise(S0, 0, oOf(S0)) !== true || premise(S1, 0, oOf(S1)) === true) continue;
    const v0 = MG.verdict(pos(S0), 0, oOf(S0)), v1 = MG.verdict(pos(S1), 0, oOf(S1));
    ok('SIDECOND', v0.v === 'live', `${sc.id} with it down: expected live, got ${v0.v}`);
    ok('SIDECOND', v1.v === 'dead', `${sc.id} with it already up (the foe CAN switch): expected dead, got ${v1.v} (${v1.why || ''})`);
    console.log(`  SIDECOND: ${sc.id} -> ${v0.v} when down, ${v1.v} when already up (foe has a bench)`);
    done = true;
    break;
  }
  if (!done) cannot('no derived side-condition move passed its premise');
}

/* ---------- HH, REFUSED ---------- */
{
  const atk = MOVES.filter(plainDamaging).find(m => m.basePower <= 60 && quietSpecies.some(s => D.getImmunity(m.type, s.types) && D.getEffectiveness(m.type, s.types) <= 0));
  const N = quietSpecies.filter(s => D.getImmunity(atk.type, s.types) && D.getEffectiveness(atk.type, s.types) <= 0).sort((a, b) => b.baseStats.hp - a.baseStats.hp)[0];
  const U = quietSpecies.find(s => s !== N), P = quietSpecies.find(s => s !== N && s !== U);
  const N2 = quietSpecies.find(s => ![N, U, P].includes(s)), B1 = quietSpecies.find(s => ![N, U, P, N2].includes(s)), B2 = quietSpecies.find(s => ![N, U, P, N2, B1].includes(s));
  const S = battle([body(U, [hh, stallMove]), body(P, [atk, stallMove]), body(B1, [stallMove]), body(B2, [stallMove])], [body(N, FOE), body(N2, FOE)]);
  const p = pos(S);
  const oHH = mvOpt(p.la, 0, 'helpinghand', -2);
  const jAtk = p.la.joint.find(j => PR.optKey(j[0]) === PR.optKey(oHH) && j[1].kind === 'move' && j[1].move === atk.id && j[1].target === 1);
  const jStall = p.la.joint.find(j => PR.optKey(j[0]) === PR.optKey(oHH) && j[1].kind === 'move' && j[1].move === stallMove.id);
  const jSw = p.la.joint.find(j => PR.optKey(j[0]) === PR.optKey(oHH) && j[1].kind === 'switch');
  const vHH = MG.verdict(p, 0, oHH);
  const a = DG.pairVerdict(p, jAtk), b = DG.pairVerdict(p, jStall), c = DG.pairVerdict(p, jSw);
  ok('HH', vHH.v === 'live', `MAG on Helping Hand itself: expected live, got ${vHH.v}`);
  ok('HH', !a.cut, `(Helping Hand, ${atk.id} at a foe): expected KEPT, got cut`);
  ok('HH', b.cut, `(Helping Hand, ${stallMove.id}): expected CUT, got kept`);
  ok('HH', c.cut, `(Helping Hand, a switch): expected CUT, got kept`);
  console.log(`  HH: MAG ${vHH.v}; beside ${atk.id} -> ${a.cut ? 'CUT' : 'kept'}, beside ${stallMove.id} -> ${b.cut ? 'CUT' : 'kept'}, beside a switch -> ${c.cut ? 'CUT' : 'kept'}`);

  /* HEAL: the same board under the terrain a turn-end heal comes from, foes at full HP. The boosted hit must still
   * read as an effect: a heal must not wash the difference out before the board is read. The terrain is taken from
   * the dex as the one whose condition heals at the residual, and the foes must be grounded for it to reach them. */
  const healTerrain = MOVES.find(m => m.terrain && m.condition && m.condition.onResidual);
  if (!healTerrain) cannot('no terrain with a residual in this regulation');
  const grounded = s => !s.types.includes('Flying');
  const Ng = quietSpecies.filter(s => grounded(s) && D.getImmunity(atk.type, s.types) && D.getEffectiveness(atk.type, s.types) <= 0).sort((x, y) => y.baseStats.hp - x.baseStats.hp)[0];
  /* the other foe is NOT grounded, so the heal never reaches it: Helping Hand has an effect beside an attack at it
   * whatever the heal does — the pair gate's "futile only together" needs one partner click where it is not futile */
  const N2g = quietSpecies.find(s => !grounded(s) && D.getImmunity(atk.type, s.types) && ![Ng, U, P, B1, B2].includes(s));
  if (!N2g) cannot('no ungrounded species for the HEAL fixture');
  const Sg = battle([body(U, [hh, stallMove]), body(P, [atk, stallMove]), body(B1, [stallMove]), body(B2, [stallMove])], [body(Ng, FOE), body(N2g, FOE)]);
  Sg.field.terrain = healTerrain.terrain.replace(/terrain$/, ''); Sg.field.terrainT = 5;
  const pg = pos(Sg);
  const jg = pg.la.joint.find(j => j[0].kind === 'move' && j[0].move === 'helpinghand' && j[1].kind === 'move' && j[1].move === atk.id && j[1].target === 1);
  const vg = DG.pairVerdict(pg, jg);
  ok('HEAL', !vg.cut, `(Helping Hand, ${atk.id}) under ${healTerrain.id} with full-HP foes: expected KEPT, got cut`);
  console.log(`  HEAL: under ${healTerrain.id}, (Helping Hand, ${atk.id}) at a full-HP ${Ng.id} -> ${vg.cut ? "CUT" : "kept"}  [${[U, P, B1, B2, Ng, N2g].map(x => x.id).join(" ")}]`);

  const la = API.legalActions(S, 'A');
  const sw0 = la.slots[0].options.filter(o => o.kind === 'switch'), sw1 = la.slots[1].options.filter(o => o.kind === 'switch');
  const same = la.joint.filter(j => j[0].kind === 'switch' && j[1].kind === 'switch' && j[0].to === j[1].to).length;
  const diff = la.joint.filter(j => j[0].kind === 'switch' && j[1].kind === 'switch' && j[0].to !== j[1].to).length;
  ok('REFUSED', sw0.length >= 2 && sw1.length >= 2 && same === 0 && diff > 0, `double switch to one body: ${same} joints (expected 0), to two bodies: ${diff}`);
  console.log(`  REFUSED: ${sw0.length}x${sw1.length} switch pairs in the slot product, ${same} to one body in legalActions, ${diff} to two`);
}

/* ---------- REDIRECT ---------- */
{
  const rds = MOVES.filter(m => m.condition && m.condition.onFoeRedirectTarget && !m.flags.powder);
  const rd = rds[0] || MOVES.find(m => m.condition && m.condition.onFoeRedirectTarget);
  if (!rd) cannot('no redirect move in this regulation');
  const atk = MOVES.filter(plainDamaging).find(m => m.basePower <= 60);
  const U = quietSpecies[5], P = quietSpecies[6], F = quietSpecies[7], N = quietSpecies[8];
  const S = battle([body(U, [rd, atk, stallMove]), body(P, [rd, atk, stallMove])], [body(F, [atk, stallMove]), body(N, [atk, stallMove])]);
  const p = pos(S);
  const jRR = p.la.joint.find(j => j[0].move === rd.id && j[1].move === rd.id);
  const jRA = p.la.joint.find(j => j[0].move === rd.id && j[1].move === atk.id && j[1].target === 1);
  const a = DG.pairVerdict(p, jRR), b = DG.pairVerdict(p, jRA);
  ok('REDIRECT', a.cut, `(${rd.id}, ${rd.id}): expected CUT, got kept`);
  ok('REDIRECT', !b.cut, `(${rd.id}, ${atk.id}): expected KEPT, got cut`);
  console.log(`  REDIRECT: (${rd.id}, ${rd.id}) -> ${a.cut ? 'CUT' : 'kept'}; (${rd.id}, ${atk.id}) -> ${b.cut ? 'CUT' : 'kept'}`);
}

/* ---------- REACH: every slot-k click is futile beside the partner's click ---------- */
{
  /* my slot 0 knows ONLY Helping Hand and has no bench (the shape of a body Choice-locked into it): beside the
   * partner's Protect it is futile, and it is the only thing slot 0 can do — so cutting that pair would delete the
   * partner's Protect from the menu altogether. It must be kept as the representative. */
  const U = quietSpecies[14], P = quietSpecies[15], F = quietSpecies[16], F2 = quietSpecies[17];
  const atk = MOVES.filter(plainDamaging).find(m => D.getImmunity(m.type, F.types) && D.getImmunity(m.type, F2.types));
  const S = battle([body(U, [hh]), body(P, [atk, stallMove])], [body(F, [weak]), body(F2, [weak])]);
  const p = pos(S);
  const withB = p.la.joint.filter(j => j[1].kind === 'move' && j[1].move === stallMove.id);
  const kept = withB.filter(j => !DG.pairVerdict(p, j).cut);
  const hhAtk = p.la.joint.find(j => j[1].kind === 'move' && j[1].move === atk.id && j[1].target === 1);
  ok('REACH', withB.length === 1 && kept.length === 1, `the partner's ${stallMove.id} sits in ${withB.length} joint(s); ${kept.length} kept (expected 1 of 1)`);
  ok('REACH', hhAtk && !DG.pairVerdict(p, hhAtk).cut, `(Helping Hand, ${atk.id}) must stand`);
  console.log(`  REACH: slot 0 knows only Helping Hand; the partner's ${stallMove.id} sits in ${withB.length} joint, kept ${kept.length}`);
}

/* ---------- TALL: futility that needs a KO is not structural ---------- */
{
  /* my slot 0 is fast and hits the slow foe F, which sits at 1 HP; F's only move is an attack at my slot 1. On the
   * literal board slot 0 KOs F first, F never attacks, and my partner's Protect changes nothing. The protection
   * depends on a damage number (spreads nobody can see), so the pair must NOT be cut: in the tall world F survives the
   * hit, attacks, and the Protect has its effect. */
  const U = quietSpecies[18], P = quietSpecies[19];
  const F = quietSpecies.find(s => ![U, P].includes(s) && D.getImmunity(weak.type, s.types) && D.getEffectiveness(weak.type, s.types) < 0);
  const F2 = quietSpecies.find(s => ![U, P, F].includes(s));
  if (!F) cannot('no species resists ' + weak.id);
  const S = battle([body(U, [weak], { spe: 999 }), body(P, [stallMove, weak])], [body(F, [weak], { hp: 1, spe: 1 }), body(F2, [stallMove])]);
  const p = pos(S);
  const j = p.la.joint.find(x => x[0].kind === 'move' && x[0].move === weak.id && x[0].target === 1 && x[1].kind === 'move' && x[1].move === stallMove.id);
  const v = DG.pairVerdict(p, j);
  ok('TALL', j && !v.cut, `(${weak.id} into a 1-HP ${F.id}, ${stallMove.id}): expected KEPT (the protection only looks futile because of a KO), got ${v.cut ? 'cut' : 'kept'}`);
  console.log(`  TALL: the partner's ${stallMove.id} beside a KO of the only attacker -> ${v.cut ? 'CUT' : 'kept'}`);
}

/* ---------- EXEC: a body KO'd before it acts is uninformative (the literal board, not the tall one) ---------- */
{
  const atk = MOVES.filter(plainDamaging).find(m => m.basePower >= 80);
  const U = quietSpecies.find(s => D.getImmunity(atk.type, s.types) && D.getEffectiveness(atk.type, s.types) >= 0);
  const P = quietSpecies.find(s => s !== U), F = quietSpecies.find(s => ![U, P].includes(s)), N = quietSpecies.find(s => ![U, P, F].includes(s));
  const S = battle([body(U, [atk, stallMove], { hp: 1, spe: 1 }), body(P, [stallMove])], [body(F, [atk, stallMove], { spe: 999 }), body(N, FOE)]);
  const p = pos(S, { tall: false });
  const mine = mvOpt(p.la, 0, atk.id, 2);
  const theirs = p.lo.joint.find(j => j[0].kind === 'move' && j[0].move === atk.id && j[0].target === 1 && j[1].kind === 'move' && j[1].move === stallMove.id);
  const r = p.run([mine, mvOpt(p.la, 1, stallMove.id, null)], theirs, 1);
  ok('EXEC', r.exec[0] === false, `a 1-HP slower body struck first: expected uninformative (exec false), got exec ${r.exec[0]} ok ${r.ok[0]}`);
  console.log(`  EXEC: a 1-HP body struck before it moves -> exec ${r.exec[0]}`);
}

/* ---------- DICE: a Protect-family click on a long streak ---------- */
{
  const U = quietSpecies[9], P = quietSpecies[10], F = quietSpecies[11], N = quietSpecies[12], B = quietSpecies[13];
  const atk = MOVES.filter(plainDamaging)[0];
  const S = battle([body(U, [stallMove, atk]), body(P, [stallMove])], [body(F, [atk, stallMove]), body(N, [atk, stallMove]), body(B, [stallMove])]);
  S.actA[0].tookProtectTurns = 6;
  const p = pos(S);
  const v = MG.verdict(p, 0, mvOpt(p.la, 0, stallMove.id, null));
  ok('DICE', v.v === 'live', `${stallMove.id} on a 6-use streak: expected live (a roll can succeed), got ${v.v}`);
  console.log(`  DICE: ${stallMove.id} after six in a row -> ${v.v}`);
}

/* ---------- FROZEN ---------- */
{
  const rc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'doduo', 'board_state.frozen.json'), 'utf8'));
  const txt = fs.readFileSync(path.join(__dirname, '..', 'doduo', 'board_state.frozen.js'), 'utf8').replace(/\r\n/g, '\n');
  const blob = crypto.createHash('sha1').update('blob ' + Buffer.byteLength(txt) + '\0').update(txt).digest('hex');
  ok('FROZEN', blob === rc.source_git_blob, `board_state.frozen.js is git blob ${blob}, the receipt names ${rc.source_git_blob}`);
}

const brk = probe.BROKEN || MG.BROKEN || DG.BROKEN;
console.log('test-gates: ' + (checks - fails) + '/' + checks + ' checks' + (brk ? '  [BREAK ' + brk + ']' : '') + '  failed clauses: ' + ([...failed].join(',') || 'none'));

if (!NO_RED && !brk) {
  const need = [['anytrue', 'IMMUNE'], ['softhard', 'IMMUNE'], ['nopartner', 'PARTNER'], ['pairany', 'DISJOINT'], ['norep', 'REACH'], ['exec', 'EXEC'], ['dice', 'DICE'], ['short', 'TALL'], ['shieldcounts', 'STATUSED'], ['fullheal', 'HEAL']];
  let blind = 0;
  for (const [v, clause] of need) {
    const res = cp.spawnSync(process.execPath, [__filename, '--no-red'], { env: Object.assign({}, process.env, { GATE_BREAK: v }), encoding: 'utf8' });
    const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-gates:') && l.includes('failed clauses')) || '';
    const seen = new RegExp('failed clauses: .*\\b' + clause + '\\b').test(line) && res.status === 1;
    console.log('  RED GATE_BREAK=' + v + ' -> ' + clause + ': ' + (seen ? 'fails as required' : 'STAYED GREEN (blind)  ' + line));
    if (!seen) blind++;
  }
  if (blind) { console.log('BLIND: ' + blind + ' clause(s) did not see their break'); process.exit(3); }
}
process.exit(fails ? 1 : 0);
