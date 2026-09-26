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
 *   UNKNOWN     a click that no world could test beside a partner (its shield always held) is not taken as having an
 *               effect there, so the pair gate still leaves a MAG-dead click alone
 *   STATUSED    a status move onto a foe that already has a status: SOFT with a bench, DEAD without; LIVE onto a
 *               clean foe
 *   SIDECOND    a side-condition move while that condition is already up: DEAD even though the foe can switch (the
 *               user's own side, not the target); LIVE when it is down
 *   PARTNER     a status move at my OWN statused partner is LIVE because the partner can switch (the incoming ally
 *               takes it) — the "whatever the partner does" quantifier
 *   HH          Helping Hand: the pair (HH, attacking partner) is KEPT; (HH, non-attacking partner) and (HH, switching
 *               partner) are CUT; MAG leaves Helping Hand itself LIVE (it works beside an attacker)
 *   MEGA        a MEGA Helping Hand beside a Protect is CUT: the counterfactual still mega-evolves, so the mega itself
 *               is not mistaken for Helping Hand's effect
 *   MAP         the probe's own side map (built only for that counterfactual) steps exactly as the API's joint array
 *   REDIRECT    both slots on the same redirect move: CUT; one redirect beside an attack: KEPT
 *   REFUSED     both slots switching to one bench body is not a joint at all (MEDICHAM legalActions refuses it)
 *   REACH       when every slot-k click is futile beside the partner's click, one of those pairs is kept, so the
 *               partner's click stays reachable
 *   HEAL        Helping Hand beside an attack stays KEPT under a terrain whose turn-end heal could otherwise wash the
 *               boosted hit off the board before it is read
 *   TALL        a Protect beside a partner who KOs the only attacker first is KEPT: futility that needs a KO depends on
 *               damage, and damage on spreads nobody can see
 *   DISJOINT    the pair gate never cuts a pair because of a click MAG calls dead — including (2026-09-26) a flinch move
 *               at my own immune-typed partner, dead by purpose yet landing on the ally who would switch in
 *   ALLFUTILE   a click that works (MAG live) but changes nothing beside ANY partner (a side guard with nothing to
 *               block) is not the pair gate's: every pair is kept
 *   EXEC        a body KO'd before it acts is UNINFORMATIVE (its click neither succeeded nor failed)
 *   DICE        a Protect-family click on a long streak (a 1-in-729 roll) is LIVE: the gate never cuts on a roll
 *   SEC         on the pinned worlds no chance secondary lands (a partner's lucky flinch cannot make a click futile)
 *   SHIELDFAIL  a status move at a foe whose only click is a Protect that FAILS on a streak is LIVE: a failed shield is
 *               evidence, a held one is skipped
 *   PARITY      every option of each opposing slot appears in the cover on BOTH dice regimes
 *   FROZEN      solver/doduo/board_state.frozen.js is the copy its receipt names
 *   --- the tiered gates (2026-09-26, Will): ALWAYS BANNED = no branch achieves the click's PURPOSE (removed); MOSTLY
 *   BANNED = futile against the body in now, achieved only on a switch (weighted by the human switch model) ---
 *   FAKEOUT     a guaranteed-flinch move into a body whose ability refuses the flinch is DEAD even with a flinchable bench
 *               (a switch-in is never flinched) and even though it lands damage; into a type-immune body with a bench it
 *               would hit, DEAD (the 2026-09-25 gate said soft); into a flinchable body, LIVE. My partner knows the same
 *               move, so a flinch it lands is not credited to me
 *   ENCORE      a Prankster Encore into a Dark body that has moved is DEAD with a bench (a switch-in has no last move);
 *               into a non-Dark body that has moved, LIVE. Read off the ENGINE'S MOVE RESULT: MEDICHAM ends the refused
 *               move `false` since abra/regmc 1.21.0, so the gate's board workaround is gone. Its break is the engine's
 *               own knob MEDI_PRANKSTER_RESULT_TRUE=1 (the pre-fix `true`): a gate that reads the result then calls the
 *               Dark Encore live and ENCORE goes red; the board workaround would have kept it dead and stayed green
 *   WEIGHT      a mostly-banned click's weight is the switch model's probability of a rescuing switch (two stand-in
 *               models give two different weights, each equal to the model's own mass), never the old constant
 *   SHIELDRES   a status click whose purpose is its move RESULT, at a foe whose only click is a holding Protect: UNTESTED
 *               (every world skipped), never read live off the #509 residual
 *   BENCH       in live play the alternative worlds put every unrevealed sheet member on the bench
 *
 * RED, unless --no-red: re-runs itself under each GATE_BREAK and REQUIRES the named clause to fail:
 *   anytrue -> IMMUNE, softhard -> IMMUNE, nopartner -> PARTNER, pairany -> ALLFUTILE (was DISJOINT until 2026-09-26), pairondead -> DISJOINT, norep -> REACH, exec -> EXEC,
 *   dice -> DICE, short -> TALL, shieldcounts -> SHIELDRES (was STATUSED until 2026-09-26), fullheal -> HEAL, megapass -> MEGA, secfree -> SEC,
 *   shieldskipall -> SHIELDFAIL, parity -> PARITY, twovalued -> UNKNOWN, purposeresult -> FAKEOUT,
 *   flinchany -> FAKEOUT, softconst -> WEIGHT, benchone -> BENCH,
 *   prankstertrue -> ENCORE (not a gate break: the run sets the ENGINE knob MEDI_PRANKSTER_RESULT_TRUE=1; was
 *   purposeresult -> ENCORE until the engine fix made that break blind, 2026-09-26).
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
  if (o.item) b.item = o.item;
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

/* ---------- UNKNOWN: a click never tested beside a partner is not "effective" there ---------- */
{
  /* slot 0 aims the immune-typed move at MY partner, who is immune to it and cannot switch (no bench): MAG calls it
   * dead. Beside the partner's Protect every world is uninformative (the shield always holds). That silence must not
   * count as an effect, or the pair gate cuts the dead click beside the partner's other moves. */
  const { mv, F } = immune;
  const U = quietSpecies.find(s => s !== F && D.getImmunity(mv.type, s.types));
  const N = quietSpecies.find(s => ![U, F].includes(s)), N2 = quietSpecies.find(s => ![U, F, N].includes(s));
  const S = battle([body(U, [mv, stallMove]), body(F, [weak, stallMove])], [body(N, FOE), body(N2, FOE)]);
  const p = pos(S);
  const o = mvOpt(p.la, 0, mv.id, -2);
  const v = o ? MG.verdict(p, 0, o) : { v: 'no option' };
  let cutOnDead = 0, n = 0;
  for (const j of p.la.joint) if (PR.optKey(j[0]) === PR.optKey(o)) { n++; const pv = DG.pairVerdict(p, j); if (pv.cut && pv.slot === 0) cutOnDead++; }
  ok('UNKNOWN', v.v === 'dead' && n > 1 && cutOnDead === 0, `${mv.id} at my immune partner: MAG ${v.v}; the pair gate cut ${cutOnDead} of its ${n} pairs on it (expected dead, 0)`);
  /* and asked of the three-valued logic itself (since 2026-09-26 the pair gate yields to MAG on a dead click, so the pair
   * verdict above no longer reaches it): beside the partner's attack, "does the click have an effect beside some OTHER
   * partner click?" — the only other is the Protect, beside which nothing was informative — must be NO, not "unknown,
   * so yes" */
  const jAtk = o && p.la.joint.find(j => PR.optKey(j[0]) === PR.optKey(o) && j[1].kind === 'move' && j[1].move === weak.id);
  const other = jAtk ? DG.effectBesideOther(p, 0, o, jAtk[1]) : null;
  ok('UNKNOWN', jAtk && other === false, `an untested partner click read as an effect: effectBesideOther = ${other}`);
  console.log(`  UNKNOWN: ${mv.id} at my immune partner -> MAG ${v.v}; pair cuts on it ${cutOnDead}/${n}`);
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
  const oHH = mvOpt(p.la, 0, hh.id, -2);
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
  const jg = pg.la.joint.find(j => j[0].kind === 'move' && j[0].move === hh.id && j[1].kind === 'move' && j[1].move === atk.id && j[1].target === 1);
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

/* ---------- MEGA: a mega click's counterfactual still mega-evolves ---------- */
{
  /* a species whose mega forme is in the regulation, with its stone (both read off the dex) */
  const U = quietSpecies.find(s => (s.otherFormes || []).some(f => { const m = D.species.get(f); return X.legal(m) && m.isMega && m.requiredItem && X.legal(D.items.get(m.requiredItem)); }));
  if (!U) cannot('no species with a legal mega forme');
  const megaF = D.species.get(U.otherFormes.find(f => { const m = D.species.get(f); return X.legal(m) && m.isMega && m.requiredItem; }));
  const stone = X.toID(megaF.requiredItem);
  const atk = MOVES.filter(plainDamaging).find(m => m.basePower <= 60);
  const P = quietSpecies.find(s => s !== U), N = quietSpecies.find(s => ![U, P].includes(s)), N2 = quietSpecies.find(s => ![U, P, N].includes(s));
  const S = battle([body(U, [hh, stallMove], { item: stone }), body(P, [atk, stallMove])], [body(N, FOE), body(N2, FOE)]);
  const p = pos(S);
  const jM = p.la.joint.find(j => j[0].kind === 'move' && j[0].move === hh.id && j[0].mega && j[1].kind === 'move' && j[1].move === stallMove.id);
  if (!jM) cannot('the engine offered no mega Helping Hand for ' + U.id + ' holding ' + stone);
  const v = DG.pairVerdict(p, jM);
  ok('MEGA', v.cut, `(mega Helping Hand, ${stallMove.id}): expected CUT (the mega is not Helping Hand's effect), got kept`);
  console.log(`  MEGA: ${U.id} mega-evolving into Helping Hand beside ${stallMove.id} -> ${v.cut ? 'CUT' : 'kept'}`);

  /* MAP: the probe's own side map (built only for a mega pass) plays exactly what the API's joint array plays */
  let same = 0, n = 0;
  const T0 = pos(S, { tall: false });
  for (const j of T0.la.joint.slice(0, 12)) for (const o of T0.lo.joint.slice(0, 3)) {
    n++;
    const C1 = API.clone(S), C2 = API.clone(S);
    API.stepInPlace(C1, j, o, M.midEventDice({ seed: 9, reset: false }));
    API.stepInPlace(C2, probe.sideMap(C2, 'A', j), o, M.midEventDice({ seed: 9, reset: false }));
    if (API.digest(C1) === API.digest(C2)) same++;
  }
  ok('MAP', n > 20 && same === n, `the probe's side map and the API's joint array parted on ${n - same} of ${n} steps`);
  console.log(`  MAP: ${same}/${n} steps identical through the probe's side map and the API's joint array`);
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

/* ---------- SEC: on the pinned worlds no chance secondary lands ---------- */
{
  /* the legal damaging move whose secondary status has the highest chance below 100 (read off the dex) */
  const secMove = MOVES.filter(m => (m.category === 'Physical' || m.category === 'Special') && m.target === 'normal' && m.secondary
    && m.secondary.status && m.secondary.chance > 0 && m.secondary.chance < 100 && (m.accuracy === true || m.accuracy >= 90) && !m.priority)
    .sort((a, b) => b.secondary.chance - a.secondary.chance || byId(a, b))[0];
  if (!secMove) cannot('no damaging move with a chance secondary status');
  const U = quietSpecies[20], P = quietSpecies[21];
  const N = quietSpecies.find(s => ![U, P].includes(s) && D.getImmunity(secMove.type, s.types) && !s.types.some(t => !D.getImmunity(secMove.secondary.status, [t])));
  const N2 = quietSpecies.find(s => ![U, P, N].includes(s));
  const S = battle([body(U, [secMove, stallMove]), body(P, [stallMove])], [body(N, FOE), body(N2, FOE)]);
  const p = pos(S);
  const o = mvOpt(p.la, 0, secMove.id, 1);
  const jo = p.lo.joint.find(j => j[0].kind === 'move' && j[0].move === weak.id && j[1].kind === 'move' && j[1].move === weak.id);
  let landed = 0, n = 0;
  for (let d = 0; d < 60; d += 2) {       // the pinned (even) worlds
    const r = p.run([o, mvOpt(p.la, 1, stallMove.id, null)], jo, d, { board: true });
    const b = JSON.parse(r.board);
    n++; if (b.sides.p2.active[0] && b.sides.p2.active[0].status) landed++;
  }
  ok('SEC', n === 30 && landed === 0, `${secMove.id} (${secMove.secondary.chance}% ${secMove.secondary.status}) landed its secondary on ${landed} of ${n} pinned worlds (expected 0)`);
  console.log(`  SEC: ${secMove.id}'s ${secMove.secondary.chance}% ${secMove.secondary.status} on the pinned worlds -> ${landed}/${n}`);
}

/* ---------- SHIELDFAIL: a shield that FAILS is evidence ---------- */
{
  /* a status move at a foe whose only click is a Protect on a long streak: on the pinned worlds the Protect holds (the
   * world is skipped), on the others it fails 728 times in 729 and the status lands — so the click is LIVE, not
   * untested */
  const sm = MOVES.find(m => m.category === 'Status' && m.target === 'normal' && m.status && !m.volatileStatus && !m.onTry && !m.onTryHit && !m.flags.powder && (m.accuracy === true || m.accuracy >= 90));
  const U = quietSpecies[22], P = quietSpecies[23];
  const N = quietSpecies.find(s => ![U, P].includes(s) && s.baseStats.hp >= 70 && (() => {
    const T0 = battle([body(U, [sm, stallMove]), body(P, [stallMove])], [body(s, FOE), body(quietSpecies[24], FOE)]);
    const oo = mvOpt(API.legalActions(T0, 'A'), 0, sm.id, 1);
    return oo && premise(T0, 0, oo) === true;
  })());
  if (!N) cannot('no body ' + sm.id + ' lands on');
  const S = battle([body(U, [sm, stallMove]), body(P, [stallMove])], [body(N, [stallMove]), body(quietSpecies[24], [stallMove])]);
  S.actB[0].tookProtectTurns = 6;
  const p = pos(S);
  const v = MG.verdict(p, 0, mvOpt(p.la, 0, sm.id, 1));
  ok('SHIELDFAIL', v.v === 'live', `${sm.id} at a foe whose only click is a failing Protect: expected live, got ${v.v} (${v.why || ''})`);
  console.log(`  SHIELDFAIL: ${sm.id} at a foe on a six-Protect streak -> ${v.v}`);
}

/* ---------- PARITY: every opposing option meets both dice regimes ---------- */
{
  const U = quietSpecies[25], P = quietSpecies[26], N = quietSpecies[27], N2 = quietSpecies[28], B = quietSpecies[29];
  const S = battle([body(U, [weak, stallMove]), body(P, [weak, stallMove])], [body(N, FOE), body(N2, FOE), body(B, FOE)]);
  const p = pos(S);
  const C = PR.cover(p);
  let missing = 0, opts = 0;
  for (let k = 0; k < 2; k++) for (const o of p.lo.slots[k].options) {
    opts++;
    const ds = C.filter(c => PR.optKey(c.o[k]) === PR.optKey(o)).map(c => c.di % 2);
    if (!ds.includes(0) || !ds.includes(1)) missing++;
  }
  ok('PARITY', opts > 4 && missing === 0, `${missing} of ${opts} opposing options never meet one of the two dice regimes in the cover`);
  console.log(`  PARITY: ${opts - missing}/${opts} opposing options meet both the pinned and the free dice`);
}

/* ================= THE TIERED GATES (2026-09-26, Will): always banned (removed) / mostly banned (weighted) ================= */
const BSF = require('../doduo/board_state.frozen.js');
const secsOf = m => (m.secondaries || (m.secondary ? [m.secondary] : [])).filter(Boolean);
/* one engine step from S with both joints given (side A's and side B's options), the copy returned */
function stepOnce(S, jA, jB, seed) { const T = API.clone(S); API.stepInPlace(T, jA, jB, M.midEventDice({ seed: seed || 5, reset: false })); return T; }
const resOf = m => (m ? (m._mvResLast !== undefined ? m._mvResLast : m._mvRes) : undefined);

/* ---------- FAKEOUT: a flinch move's PURPOSE is the flinch ---------- */
{
  /* the flinch moves, read off the dex independently of solver/mag/purpose.js (a damaging move whose guaranteed
   * secondary is a flinch), so a break of purpose.js cannot empty the fixture */
  const FL = MOVES.filter(m => (m.category === 'Physical' || m.category === 'Special') && m.target === 'normal' && secsOf(m).some(s => s.chance === 100 && s.volatileStatus === 'flinch'));
  /* the abilities that refuse a flinch, asked of the ability's own handler (Dex.forFormat), never named */
  const ABIL = D.abilities.all().filter(X.legal).sort(byId);
  const refusesFlinch = a => { try { return typeof a.onTryAddVolatile === 'function' && a.onTryAddVolatile.call({}, { id: 'flinch' }, {}) === null; } catch (e) { return false; } };
  const UNFL = ABIL.filter(refusesFlinch);
  if (!FL.length) cannot('no damaging move with a guaranteed flinch in this regulation');
  if (!UNFL.length) cannot('no ability that refuses a flinch in this regulation');
  let done = false;
  for (const fo of FL) for (const ua of UNFL) {
    if (done) break;
    const hits = s => D.getImmunity(fo.type, s.types) && D.getImmunity(weak.type, s.types);
    const F = SPECIES.find(s => hits(s) && Object.values(s.abilities || {}).map(X.toID).includes(ua.id));
    const U = quietSpecies.find(s => s !== F && D.getImmunity(weak.type, s.types));
    const P = quietSpecies.find(s => ![F, U].includes(s) && D.getImmunity(weak.type, s.types));
    const N2 = quietSpecies.find(s => ![F, U, P].includes(s) && hits(s) && s.baseStats.hp >= 60);
    const B3 = quietSpecies.find(s => ![F, U, P, N2].includes(s) && hits(s));
    const G = quietSpecies.find(s => ![F, U, P, N2, B3].includes(s) && !D.getImmunity(fo.type, s.types));
    if (!F || !U || !P || !N2 || !B3 || !G) continue;
    const foeF = () => { const b = body(F, FOE); b.ability = ua.id; return b; };
    /* PREMISE (the engine, one plain step): the flinch move lands on the refusing body and does NOT stop its attack; on
     * the plain body it does; into the immune-typed body it does not land at all */
    const pre = (foe) => {
      const S = battle([body(U, [fo, stallMove]), body(P, [stallMove])], [foe, body(N2, FOE)]);
      const la = API.legalActions(S, 'A'), lb = API.legalActions(S, 'B');
      const a = mvOpt(la, 0, fo.id, 1), b = mvOpt(lb, 0, weak.id, 1);
      if (!a || !b) return null;
      const T = stepOnce(S, [a, PR.PASS], [b, PR.PASS]);
      return { mine: resOf(T.actA[0]), theirs: resOf(T.actB[0]) };
    };
    const pF = pre(foeF()), pN = pre(body(N2, FOE)), pG = pre(body(G, FOE));
    if (!pF || !pN || !pG || pF.mine !== true || pF.theirs !== true || pN.mine !== true || pN.theirs === true || pG.mine === true) continue;
    /* the board: my partner ALSO knows the flinch move (so a flinch landed by the partner must not be credited to me), and
     * the foes have a bench whose body the move would hit and flinch-able — a switch-in still cannot be stopped */
    const S1 = battle([body(U, [fo, stallMove]), body(P, [fo, stallMove])], [foeF(), body(N2, FOE), body(B3, FOE)]);
    const p1 = pos(S1);
    const vF = MG.verdict(p1, 0, mvOpt(p1.la, 0, fo.id, 1)), vN = MG.verdict(p1, 0, mvOpt(p1.la, 0, fo.id, 2));
    ok('FAKEOUT', vF.v === 'dead', `${fo.id} into a ${ua.id} ${F.id} with a flinchable bench: expected dead (always banned), got ${vF.v} (${vF.why || ''})`);
    ok('FAKEOUT', vN.v === 'live', `${fo.id} into a flinchable ${N2.id}: expected live (kept), got ${vN.v} (${vN.why || ''})`);
    /* the type-immune target with a bench the move would hit: the 2026-09-25 gate said SOFT (a switch-in takes the hit);
     * the purpose says DEAD (a switch-in is never flinched) */
    const S2 = battle([body(U, [fo, stallMove]), body(P, [fo, stallMove])], [body(G, FOE), body(N2, FOE), body(B3, FOE)]);
    const p2 = pos(S2);
    const vG = MG.verdict(p2, 0, mvOpt(p2.la, 0, fo.id, 1));
    ok('FAKEOUT', vG.v === 'dead', `${fo.id} into a type-immune ${G.id} with a bench the move would hit: expected dead, got ${vG.v} (${vG.why || ''})`);
    console.log(`  FAKEOUT: ${U.id} ${fo.id} into a ${ua.id} ${F.id} -> ${vF.v}${vF.v_result ? ' (move result alone: ' + vF.v_result + ')' : ''}; into ${G.id} [${G.types}] -> ${vG.v}${vG.v_result ? ' (move result alone: ' + vG.v_result + ')' : ''}; into ${N2.id} -> ${vN.v}`);
    done = true;
  }
  if (!done) cannot('no derived (flinch move, flinch-refusing ability, species) set passed its premise');
}

/* ---------- ENCORE: Prankster Encore into a Dark type (Will's example) ---------- */
{
  const enc = D.moves.get('encore'), prank = D.abilities.get('prankster');      // Will's example; asserted legal before use
  if (!X.legal(enc) || !X.legal(prank)) cannot('Encore or Prankster is not in this regulation');
  const U = SPECIES.find(s => Object.values(s.abilities || {}).map(X.toID).includes(prank.id) && D.getImmunity(weak.type, s.types));
  const darkQ = quietSpecies.filter(s => s.types.includes('Dark') && D.getImmunity(weak.type, s.types));
  const plainQ = quietSpecies.filter(s => !s.types.includes('Dark') && D.getImmunity(weak.type, s.types) && s !== U);
  let done = false;
  for (const Dk of darkQ) {
    const P = plainQ[0], N = plainQ[1], B3 = plainQ[2];
    if (!U || !P || !N || !B3) break;
    const mk = (lastDk, lastN) => {
      const a = body(U, [enc, stallMove]); a.ability = prank.id;
      const d = body(Dk, FOE), n = body(N, FOE), b3 = body(B3, FOE);
      if (lastDk) d._lastMove = weak.id;
      if (lastN) n._lastMove = weak.id;
      return battle([a, body(P, [stallMove])], [d, n, b3]);
    };
    /* PREMISE, read on the BOARD (engine/board_state.js readMedi's encore leaf on the target), independently of the move
     * result the gate reads — so the knob that falsifies the result (MEDI_PRANKSTER_RESULT_TRUE=1) leaves the premise
     * standing and the fixture is still played: on the plain foe that has moved, the Encore lands; on the same foe with
     * no last move (a fresh switch-in) it does not; on the Dark foe that has moved it does not (the Prankster refusal) */
    const pre = (S, tgt) => { const la = API.legalActions(S, 'A'), lb = API.legalActions(S, 'B');
      const a = mvOpt(la, 0, enc.id, tgt); const b = [mvOpt(lb, 0, weak.id, 1), mvOpt(lb, 1, weak.id, 1)];
      if (!a || !b[0] || !b[1]) return undefined;
      const T = stepOnce(S, [a, PR.PASS], b);
      return !!((BSF.readMedi(T, { id: X.toID, fails: {} }).sides.p2.active[tgt - 1] || {}).vol || {}).encore; };
    if (pre(mk(true, true), 2) !== true || pre(mk(true, false), 2) !== false || pre(mk(true, true), 1) !== false) continue;
    /* what the gate reads: the engine's own move result for the refused Encore (false on the fixed engine; true under
     * the knob) — printed, not asserted, so the knob reaches the VERDICT rather than a premise */
    const resD = (() => { const S0 = mk(true, true), la = API.legalActions(S0, 'A'), lb = API.legalActions(S0, 'B');
      const T = stepOnce(S0, [mvOpt(la, 0, enc.id, 1), PR.PASS], [mvOpt(lb, 0, weak.id, 1), mvOpt(lb, 1, weak.id, 1)]);
      return resOf(T.actA[0]); })();
    const S = mk(true, true);
    const p = pos(S);
    const vD = MG.verdict(p, 0, mvOpt(p.la, 0, enc.id, 1)), vN = MG.verdict(p, 0, mvOpt(p.la, 0, enc.id, 2));
    ok('ENCORE', vD.v === 'dead', `Prankster ${enc.id} into a Dark ${Dk.id} with a bench: expected dead (always banned), got ${vD.v} (${vD.why || ''})`);
    ok('ENCORE', vN.v === 'live', `Prankster ${enc.id} into a ${N.id} that has already moved: expected live (kept), got ${vN.v} (${vN.why || ''})`);
    console.log(`  ENCORE: ${U.id} (${prank.id}) ${enc.id} into a Dark ${Dk.id} with ${B3.id} on the bench -> ${vD.v} (engine move result ${resD}, purpose ${vD.purpose}); into a ${N.id} that has moved -> ${vN.v}`);
    done = true;
    break;
  }
  if (!done) cannot('no derived Prankster / Dark / plain fixture passed its premise');
}

/* ---------- SHIELDRES: a held shield is still skipped for a click whose purpose is its move RESULT ---------- */
{
  /* A status move aimed at a foe whose purpose is its move result: at a foe whose only click is a Protect that holds,
   * every world must be skipped (UNTESTED), never read as a success or a failure — a held shield says nothing about the
   * click. (The 2026-09-26 board-read 'effect' purpose is gone; every status move is read off the result again.)
   * Derived by property. */
  const PU = require('../mag/purpose.js');
  const U = quietSpecies[30], Pn = quietSpecies[31], N = quietSpecies[32], N2 = quietSpecies[33];
  let done = false;
  for (const sm of MOVES.filter(m => m.category === 'Status' && m.target === 'normal' && m.flags.protect && !m.onTry && !m.onTryHit && (m.accuracy === true || m.accuracy >= 90)
    && PU.purposeOf(m.id) === 'result')) {
    const S0 = battle([body(U, [sm, stallMove]), body(Pn, [stallMove])], [body(N, [weak]), body(N2, [weak])]);
    const o0 = mvOpt(API.legalActions(S0, 'A'), 0, sm.id, 1);
    if (!o0 || premise(S0, 0, o0) !== true) continue;                          // it works on a foe that does not hide
    const S = battle([body(U, [sm, stallMove]), body(Pn, [stallMove])], [body(N, [stallMove]), body(N2, [weak])]);
    const p = pos(S);
    const v = MG.verdict(p, 0, mvOpt(p.la, 0, sm.id, 1));
    ok('SHIELDRES', v.v === 'untested', `${sm.id} (purpose: its move result) at a foe whose only click is a holding ${stallMove.id}: expected untested, got ${v.v} (${v.why || ''})`);
    console.log(`  SHIELDRES: ${sm.id} at a foe that can only ${stallMove.id} -> ${v.v}`);
    done = true;
    break;
  }
  if (!done) cannot('no result-purpose status move passed its premise');
}

/* ---------- DISJOINT (purpose): the pair gate does not judge a click MAG has removed ---------- */
{
  /* A flinch move at MY OWN partner whose typing is immune to it, with a flinchable body on my bench: MAG calls it dead
   * (the partner cannot be hit; the ally who switches in is hit but never flinched — a switch-in has already acted), yet
   * the hit on the switch-in moves the board, so the pair gate would see "an effect beside the partner's switch and none
   * beside its attack" and cut it there. The removal is MAG's; the pair gate must leave it alone (593 such cuts in the
   * seed-5 eval before the fix). Derived: the flinch moves and the immune typing are read off the dex. */
  const fo = MOVES.find(m => (m.category === 'Physical' || m.category === 'Special') && secsOf(m).some(s => s.chance === 100 && s.volatileStatus === 'flinch')
    && ['adjacentFoe', 'normal', 'any'].includes(m.target));
  const G = fo && quietSpecies.find(s => !D.getImmunity(fo.type, s.types));
  const U = fo && quietSpecies.find(s => s !== G && D.getImmunity(fo.type, s.types));
  const Bn = fo && quietSpecies.find(s => ![G, U].includes(s) && D.getImmunity(fo.type, s.types));
  const N = quietSpecies.find(s => ![G, U, Bn].includes(s)), N2 = quietSpecies.find(s => ![G, U, Bn, N].includes(s));
  if (!fo || !G || !U || !Bn) cannot('no derived flinch move / immune partner / bench for the purpose DISJOINT fixture');
  const S = battle([body(U, [fo, stallMove]), body(G, [weak, stallMove]), body(Bn, [weak, stallMove])], [body(N, FOE), body(N2, FOE)]);
  const p = pos(S);
  const o = mvOpt(p.la, 0, fo.id, -2);
  const v = o ? MG.verdict(p, 0, o) : { v: 'no option' };
  let n = 0, cut = 0;
  if (o) for (const j of p.la.joint) if (PR.optKey(j[0]) === PR.optKey(o)) { n++; const pv = DG.pairVerdict(p, j); if (pv.cut && pv.slot === 0) cut++; }
  ok('DISJOINT', v.v === 'dead' && n > 1 && cut === 0, `${fo.id} at my ${G.id} partner with ${Bn.id} on the bench: MAG ${v.v}; the pair gate cut ${cut} of its ${n} pairs on it (expected dead, 0)`);
  console.log(`  DISJOINT (purpose): ${fo.id} at my ${G.id} partner -> MAG ${v.v}; pair cuts on it ${cut}/${n}`);
}

/* ---------- ALLFUTILE: a click futile beside EVERY partner is not the pair gate's ---------- */
{
  /* A guard (a stalling move for the user's side: read off the dex) when no foe can use what it blocks: the move works
   * (MAG live: the guard goes up), and beside every partner click it changes nothing on the board. The pair gate cuts a
   * pair only when the futility is the PAIR's — here it is not, so every pair is KEPT. (Until 2026-09-26 this was the
   * `pairany` break's clause through DISJOINT; the pair gate now yields to MAG on a dead click, which that fixture needed.) */
  /* a side condition that lasts one turn and blocks hits (its condition has onTryHit) — the side guards */
  const guard = MOVES.filter(m => m.target === 'allySide' && m.sideCondition && m.condition && m.condition.duration === 1 && m.condition.onTryHit).sort(byId)[0];
  if (!guard) cannot('no side guard in this regulation');
  const U = quietSpecies[34], P = quietSpecies[35], N = quietSpecies[36], N2 = quietSpecies[37];
  const S = battle([body(U, [guard, weak]), body(P, [weak, stallMove])], [body(N, [weak]), body(N2, [weak])]);
  const p = pos(S);
  const o = mvOpt(p.la, 0, guard.id, null);
  const v = o ? MG.verdict(p, 0, o) : { v: 'no option' };
  let n = 0, cut = 0;
  if (o) for (const j of p.la.joint) if (PR.optKey(j[0]) === PR.optKey(o)) { n++; if (DG.pairVerdict(p, j).cut) cut++; }
  ok('ALLFUTILE', v.v === 'live' && n > 1 && cut === 0, `${guard.id} with nothing to block: MAG ${v.v}; the pair gate cut ${cut} of its ${n} pairs (expected live, 0)`);
  console.log(`  ALLFUTILE: ${guard.id} with nothing to block -> MAG ${v.v}; pair cuts ${cut}/${n}`);
}

/* ---------- WEIGHT: a mostly-banned click is weighted by the switch model, not a constant ---------- */
{
  const { mv, F, N, U, P } = immune;
  const B3 = quietSpecies.find(s => ![U, P, F, N].includes(s) && D.getImmunity(mv.type, s.types));
  const S1 = battle([body(U, [mv, stallMove]), body(P, [stallMove])], [body(F, FOE), body(N, FOE), body(B3, FOE)]);
  const p1 = pos(S1);
  const v = MG.verdict(p1, 0, mvOpt(p1.la, 0, mv.id, 1));
  /* a stand-in switch model: every opposing joint scores 1, a joint in which the immune foe's slot switches scores z */
  const stub = z => ({ scoreJoints: (ctx, W, side, viewer, lo) => Float64Array.from(lo.joint.map(j => (j[0] && j[0].kind === 'switch' ? z : 1))) });
  const V2m = require('../doduo/v2.js');
  const wOf = z => { const V = V2m.create(API, { switchPA: stub(z) }); const d = V.oppDist({}, S1, 'B'); return { w: V.softWeight(v, d, p1), d, V }; };
  const a = wOf(4), b = wOf(0.05);
  /* the expected weight, computed here from the stand-in model: its mass on joints whose slot-0 option is a rescuing switch */
  const expect = z => { let num = 0, den = 0; for (const j of p1.lo.joint) { const s = j[0] && j[0].kind === 'switch' ? z : 1; den += s; if ((v.rescue || []).some(r => r === '0:' + PR.optKey(j[0]) || r === '0:any') && j[0].kind === 'switch') num += s; } return num / den; };
  ok('WEIGHT', v.v === 'soft' && (v.rescue || []).length > 0, `the immune click with a bench: expected soft with a rescue list, got ${v.v} rescue ${JSON.stringify(v.rescue)}`);
  ok('WEIGHT', Math.abs(a.w - Math.max(a.V.FLOOR, expect(4))) < 1e-9 && Math.abs(b.w - Math.max(b.V.FLOOR, expect(0.05))) < 1e-9 && a.w > b.w && a.w < 1 && b.w > a.V.FLOOR,
    `weights ${a.w} / ${b.w}, expected ${expect(4)} / ${expect(0.05)} from the two switch models (floor ${a.V.FLOOR})`);
  console.log(`  WEIGHT: ${mv.id} into ${F.id} (soft, rescued by ${(v.rescue || []).join(' ')}) -> weight ${a.w.toFixed(4)} when switching is likely, ${b.w.toFixed(4)} when it is not`);
}

/* ---------- BENCH: the alternative worlds put every possible switch-in on the bench ---------- */
{
  const T = require('../arena/teams.js');
  const L = T.loadGames({ n: 3, seed: 11, M });
  if (L.refused || !L.games.length) cannot('no human game to stage the hidden-bench fixture: ' + (L.refused || 'none built'));
  const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
  const PA0 = require('../miltank/prior_adapter.js').create(API, null);
  const V = require('../doduo/v2.js').create(API, { rollout: R });
  const W2 = V.wrap(PA0);
  let games = 0, full = 0, cands = 0, cov = 0;
  for (const G of L.games) {
    const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
    const S = API.newBattle(a.team, b.team, { rng: API.makeRng(3) });
    const wd = W2.gateWorld(PA0.newGame(G), S, 'A', 'A');
    games++; cands += wd.cand.length; cov += wd.covered.length;
    if (wd.cand.length >= 3 && wd.covered.length === wd.cand.length) full++;
  }
  ok('BENCH', games > 0 && full === games, `every unrevealed sheet member stood on the bench in some world in ${full} of ${games} positions (${cov} of ${cands} candidates)`);
  console.log(`  BENCH: ${cov}/${cands} unrevealed sheet members covered by the alternative worlds over ${games} turn-1 positions`);
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
  const need = [['anytrue', 'IMMUNE'], ['softhard', 'IMMUNE'], ['nopartner', 'PARTNER'], ['pairany', 'ALLFUTILE'], ['pairondead', 'DISJOINT'], ['norep', 'REACH'], ['exec', 'EXEC'], ['dice', 'DICE'], ['short', 'TALL'], ['shieldcounts', 'SHIELDRES'], ['fullheal', 'HEAL'], ['megapass', 'MEGA'], ['secfree', 'SEC'], ['shieldskipall', 'SHIELDFAIL'], ['parity', 'PARITY'], ['twovalued', 'UNKNOWN'],
    ['purposeresult', 'FAKEOUT'], ['flinchany', 'FAKEOUT'], ['softconst', 'WEIGHT'], ['benchone', 'BENCH'], ['prankstertrue', 'ENCORE']];
  /* a break that lives in the ENGINE, not the gate: the knob it sets, beside GATE_BREAK (which only labels the run) */
  const ENGINE_KNOB = { prankstertrue: { MEDI_PRANKSTER_RESULT_TRUE: '1' } };
  let blind = 0;
  for (const [v, clause] of need) {
    const res = cp.spawnSync(process.execPath, [__filename, '--no-red'], { env: Object.assign({}, process.env, { GATE_BREAK: v }, ENGINE_KNOB[v] || {}), encoding: 'utf8' });
    const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-gates:') && l.includes('failed clauses')) || '';
    const seen = new RegExp('failed clauses: .*\\b' + clause + '\\b').test(line) && res.status === 1;
    console.log('  RED GATE_BREAK=' + v + ' -> ' + clause + ': ' + (seen ? 'fails as required' : 'STAYED GREEN (blind)  ' + line));
    if (!seen) blind++;
  }
  if (blind) { console.log('BLIND: ' + blind + ' clause(s) did not see their break'); process.exit(3); }
}
process.exit(fails ? 1 : 0);
