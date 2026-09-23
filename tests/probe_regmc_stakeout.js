#!/usr/bin/env node
/* tests/probe_regmc_stakeout.js — STAKEOUT DOUBLES ONLY INTO A BODY THAT ARRIVED THIS TURN, UNDER REG M-C.
 * 2026-09-22 (ENGINE pass 8, abra/regmc 0.65.0).
 *
 *   node tests/probe_regmc_stakeout.js --regulation regmc                                  # green, exit 0
 *   MEDI_STAKEOUT_UNCONDITIONAL=1 node tests/probe_regmc_stakeout.js --regulation regmc    # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/abilities.ts stakeout (the Champions mod does not name it):
 *       onModifyAtkPriority: 5, onModifyAtk(atk, attacker, defender) { if (!defender.activeTurns) return this.chainModify(2); }
 *       onModifySpAPriority: 5, onModifySpA(atk, attacker, defender) { if (!defender.activeTurns) return this.chainModify(2); }
 *   sim/battle-actions.ts switchIn: `pokemon.activeTurns = 0` on EVERY entry, leads included; sim/battle.ts nextTurn
 *   increments it for every active body before the turn's choices -- so a LEAD reads 1 on turn 1, and a body that
 *   switched in at the START of turn T (a switch action, which sorts before every move) reads 0 for the rest of turn T.
 *
 * ================= THE DEFECT ====================================================================
 *
 *   The tag carried `onlyWhen: null`, so medicham2's untyped `attackStat` branch (Hustle's) paid a PERMANENT x2 on
 *   every PHYSICAL hit and nothing on a special one. Found by the Reg M-C roster the first time it staged the ability
 *   (`ability/doubles-into-a-fresh-arrival`): the authority doubled the hit into the arrival and not the next one.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   FRESH     p1's lead switches out for the arrival on turn 1 and the carrier's physical hit lands on the arrival;
 *             turn 2 the same hit into the same, now settled, body. Doubled on turn 1 only.
 *   SPECIAL   the same with a special hit (the handler is on onModifySpA too).
 *   LEAD      the carrier's physical hit into a LEAD on turn 1: not doubled.
 *   CONTROL   the FRESH script with the carrier on another of its own abilities.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_stakeout', ['MEDI_STAKEOUT_UNCONDITIONAL']);
const { D, ok, SPEC, learns, abil, quiet, plain, sure, bulk, mon, pickDistinct, show, P } = K;

/* 1. THE CAST, DERIVED */
const CAR = SPEC.filter(s => abil(s).includes('stakeout') && learns(s, 'protect'));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
console.log('     Stakeout carriers: ' + show(CAR));
if (!CAR.length) { console.log('  NOT STAGED — no legal Stakeout carrier'); process.exit(1); }
const hitOf = (u, tgt, cat) => D.moves.all().filter(m => plain(m) && !m.multihit && sure(m) && learns(u, m.id)
  && m.category === cat && D.getImmunity(m.type, tgt) && D.getEffectiveness(m.type, tgt) === 0)
  .sort((a, b) => a.basePower - b.basePower)[0] || null;
const counters = () => ({ fresh: K.M.MEDSEEN.freshArrivalBoost || 0, refused: K.M.MEDSEEN.freshArrivalBoostRefused || 0 });
const KEEP = /^\|(-damage|switch|faint)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
const dmgs = R => R.sdK.filter(l => /^\|-damage\|p1a:/.test(l));

let cast = null;
outer: for (const c of CAR) {
  const other = abil(c).find(a => a !== 'stakeout' && !['intimidate'].includes(a)) || abil(c).find(a => a !== 'stakeout');
  const used = new Set([c.baseSpecies, c.id]);
  for (const arr of FILL.filter(s => !used.has(s.baseSpecies)).slice(0, 12)) {
    const ph = hitOf(c, arr, 'Physical'), sp = hitOf(c, arr, 'Special');
    if (!ph || !K.idle(arr)) continue;
    const u2 = new Set(used); u2.add(arr.baseSpecies); u2.add(arr.id);
    const fills = pickDistinct(FILL.filter(s => !u2.has(s.baseSpecies)), u2, 5);
    if (fills.length < 5) continue;
    cast = { c, other, arr, ph, sp, fills };
    break outer;
  }
}
if (!cast) { console.log('  NOT STAGED — no carrier learns a plain physical hit neutral into a quiet body'); process.exit(1); }
const { c, other, arr, ph, sp, fills } = cast;
console.log('     carrier ' + c.id + ' (control ability ' + other + ')   arrival ' + arr.id + '   physical ' + ph.id
  + '   special ' + (sp ? sp.id : 'NONE'));

/* the settled turn: p1 slot 0 must be HIT, so the arrival clicks something that is not Protect */
function freshArm2(tag, ab, mv) {
  const idle = K.idle(arr);
  const A = [mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(arr, '', idle ? [idle.name, 'Protect'] : ['Protect']), mon(fills[2], '', ['Protect'])];
  const B = [mon(c, '', [mv.name, 'Protect'], ab), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const t2p1 = idle ? [{ m: idle.id }, P.protect] : null;
  if (!t2p1) return { staged: false, why: arr.id + ' has no idle click' };
  return play(tag, A, B, [{ p1: [{ sw: arr.id }, P.protect], p2: [{ m: mv.id, t: 0 }, P.protect] },
                          { p1: t2p1, p2: [{ m: mv.id, t: 0 }, P.protect] }]);
}
function leadArm(tag, ab, mv) {
  const idle = K.idle(arr);
  if (!idle) return { staged: false, why: arr.id + ' has no idle click' };
  const A = [mon(arr, '', [idle.name, 'Protect']), mon(fills[1], '', ['Protect']), mon(fills[0], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const B = [mon(c, '', [mv.name, 'Protect'], ab), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  return play(tag, A, B, [{ p1: [{ m: idle.id }, P.protect], p2: [{ m: mv.id, t: 0 }, P.protect] }]);
}
const FR = freshArm2('fresh', 'stakeout', ph), CT = freshArm2('control', other, ph), LD = leadArm('lead', 'stakeout', ph);
const SP = sp ? freshArm2('special', 'stakeout', sp) : null;
const RUNS = [['FRESH', FR], ['CONTROL', CT], ['LEAD', LD]].concat(SP ? [['SPECIAL', SP]] : []);
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const hp = l => +/\|(\d+)\//.exec(l.replace(/^\|-damage\|p1a:[^|]*/, ''))[1];
{
  const f = dmgs(FR).map(hp), k = dmgs(CT).map(hp);
  ok(f.length === 2 && k.length === 2, 'FRESH and CONTROL: the arrival is hit on both turns', JSON.stringify({ f, k }));
  /* turn 2's hit is the same size in both arms (no boost into a settled body), turn 1's is larger WITH the ability */
  const t2F = (f.length === 2) ? (f[0] - f[1]) : null, t2K = (k.length === 2) ? (k[0] - k[1]) : null;
  ok(f.length === 2 && k.length === 2 && f[0] < k[0], 'FRESH turn 1 hits harder than CONTROL turn 1 (the arrival has less HP left)', f[0] + ' vs ' + k[0]);
  ok(t2F != null && t2F === t2K, 'turn 2 (settled) is the same hit in both arms', t2F + ' vs ' + t2K);
}
if (SP) { const s = dmgs(SP).map(hp); ok(s.length === 2, 'SPECIAL: the arrival is hit on both turns', JSON.stringify(s)); }

K.compareArms(RUNS, KEEP, '-damage / switch / faint');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(FR.counters.fresh >= 1 && FR.counters.refused >= 1, 'FRESH: the doubled hit (turn 1) was paid and the settled one (turn 2) refused', JSON.stringify(FR.counters));
  ok(LD.counters.fresh === 0, 'LEAD: nothing doubled', JSON.stringify(LD.counters));
  ok(CT.counters.fresh === 0, 'CONTROL: nothing doubled', JSON.stringify(CT.counters));
}
K.finish();
