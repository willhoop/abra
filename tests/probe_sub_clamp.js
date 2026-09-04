/* probe_sub_clamp.js — AN OVERKILL INTO A SUBSTITUTE PAYS BACK THE DOLL'S LAST HP, NOT THE OVERKILL
 * (ROADMAP #416).
 *
 *   SHOWDOWN_PATH=... node tests/probe_sub_clamp.js
 *   SHOWDOWN_PATH=... MEDI_SUB_DEALT_UNCLAMPED=1 node tests/probe_sub_clamp.js    (the restore arm)
 *
 * ================= THE AUTHORITY, READ AND NOT RECALLED =========================================
 *
 * Champions does not override Substitute — `grep substitute data/mods/champions/moves.ts` returns 0 —
 * so `data/moves.ts` is the line, and the clamp sits ABOVE everything that reads the number:
 *
 *   data/moves.ts:18341-18343   if (damage > target.volatiles['substitute'].hp) {
 *                                 damage = target.volatiles['substitute'].hp;
 *                               }
 *   data/moves.ts:18344         target.volatiles['substitute'].hp -= damage;
 *   data/moves.ts:18345         source.lastDamage = damage;
 *   data/moves.ts:18352-18354   if (damage) this.actions.applyRecoilDamage(damage, move, source);
 *   data/moves.ts:18355-18357   if (move.drain)
 *                                 this.heal(Math.ceil(damage * move.drain[0] / move.drain[1]), ...)
 *   sim/battle-actions.ts:1384  recoilDamage = clampIntRange(Math.round(damageDealt * r[0] / r[1]), 1)
 *
 * And the OUTER recoil cannot double-pay it: `spreadMoveHit` turns a `HIT_SUBSTITUTE` result into
 * `damage[i] = true` (data/mods/champions/scripts.ts:351-353), which `hitStepMoveHitLoop` folds to 0
 * before `move.totalDamage += damage[i]` (sim/battle-actions.ts:961-965). The doll's payment is made
 * inside `onTryPrimaryHit` and nowhere else.
 *
 * ================= THIS ENGINE =================================================================
 *
 * `engine/medicham2-browser.js` books `dealt += Math.min(dmg, tg.curHP)` roughly sixty lines ABOVE the
 * substitute branch, so the ceiling it applies is the BODY's HP and never the DOLL's. The substitute
 * branch then returns early with that number standing, and the recoil block and `_payDrainRow` both
 * read it. The file already said so at the site — *"the authority CLAMPS `damage` to the doll's
 * remaining HP … This engine passes the unclamped `dmg` to both. That is a STATE divergence, it is
 * not narration."* This is that sentence turned into a failing measurement.
 *
 * ================= WHY THIS FIXTURE, AND WHY IT IS ROLL-INDEPENDENT ============================
 *
 * The clamp makes the answer a CONSTANT. On the overkill arm the attacker is paid on `floor(H/4)`
 * whatever the damage roll did, so the expected recoil does not depend on a die, on a stat spread or
 * on a type multiplier — which is what lets the two engines be compared on an exact integer rather
 * than on a shape. The two bodies are still built identically on both sides (the probe_pair rule:
 * one function decides what body is on the board, and a probe that does not check stages nothing),
 * because the CONTROL arm is not roll-independent and has to agree number for number.
 *
 * THE CONTROL IS THE SAME PAIR WITH THE DOLL WIDE ENOUGH TO SURVIVE — the register row's own words.
 * The target's max HP is multiplied so `floor(H/4)` is comfortably above the hit; no clamp applies,
 * the attacker is paid on the real damage, and BOTH ARMS MUST STILL AGREE ACROSS THE ENGINES. A fix
 * that clamped everything would break that arm, and a fixture immune for two reasons would pass it.
 *
 * THE TARGET IS FASTER, DELIBERATELY, so one turn does the whole job: Substitute goes up and the
 * attack lands on the doll in the same turn. A two-turn fixture would put a residual between them.
 *
 * THE ATTACKER STARTS AT HALF HP so a drain heal is visible; at full HP the clamp would hide it and
 * the drain arm would be immune for a second reason.
 *
 * THE RESTORE KNOB IS `MEDI_SUB_DEALT_UNCLAMPED=1`, per this repo's convention, and any run carrying
 * it also carries a non-zero `MEDFAILS.subDealtUnclampedRestored`.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('SUBSTITUTE / DEALT CLAMP');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const RESTORED = process.env.MEDI_SUB_DEALT_UNCLAMPED === '1';
const NEUTRAL_AB = 'Illuminate';
const ROLL_INDEX = 0;                /* the top roll, pinned; the overkill arm does not depend on it */
const WIDE = 12;                     /* the control's max-HP multiplier — see the header */

console.log('SUBSTITUTE / DEALT CLAMP — an overkill into a doll is paid on the DOLL\'S LAST HP');
console.log('  authority  data/moves.ts:18341-18357  (Champions does not override substitute)');
console.log('  restore knob MEDI_SUB_DEALT_UNCLAMPED=' + (RESTORED ? '1  (THE DEFECT IS PUT BACK)' : '0'));
console.log('');
console.log('  === §F THE FIXTURE, DERIVED THIS RUN ===');

let fixtureFail = 0;
const bad = (s) => { fixtureFail++; console.log('  FAIL fixture premise: ' + s); };

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal' && !s.forme && !s.isMega && !s.battleOnly;
const LS = s => ((dex.species.getLearnsetData(s.id) || {}).learnset || {});
const POOL = dex.species.all().filter(LEGAL).sort((a, b) => a.name.localeCompare(b.name));
/* NOT SILENT. `false` here means "this body cannot be built, so it cannot carry the fixture" —
 * but a THROW and a null row are two different facts, and collapsing them into one quiet `false`
 * is how a probe stages nothing and reports whatever the uninitialised path produced. The throw
 * is named on stderr so a shrinking pool shows up as a message instead of vanishing. */
const buildable = (s) => {
  try { return !!MEDI.buildMon(dex.species.get(s.name).id, {}); }
  catch (e) { console.error('probe fixture: buildMon(' + s.name + ') threw: ' + e.message); return false; }
};

/* THE TWO PAYBACK FAMILIES, DERIVED. Both must be certain (a miss would make the arm a flake), single
 * target (a spread hit is a different step list) and single hit (a volley pays per arrival). */
const certain = (m) => m.accuracy === true || m.accuracy === 100;
const family = (kind) => dex.moves.all().filter(m => m.exists && !m.isNonstandard && m[kind] &&
  m.basePower > 0 && certain(m) && !m.multihit && m.target === 'normal' && !m.willCrit &&
  (Number(m.critRatio) || 1) === 1)
  .sort((a, b) => (b.basePower - a.basePower) || a.name.localeCompare(b.name));
const RECOILS = family('recoil'), DRAINS = family('drain');
console.log('  recoil moves usable here           : ' + (RECOILS.map(m => m.name + ' ' + JSON.stringify(m.recoil)).join(', ') || 'NONE'));
console.log('  drain  moves usable here           : ' + (DRAINS.map(m => m.name + ' ' + JSON.stringify(m.drain)).join(', ') || 'NONE'));
if (!RECOILS.length) bad('no certain single-target recoil move in this format');
if (!DRAINS.length) bad('no certain single-target drain move in this format');

/* THE TARGET must put up a Substitute and must not be immune to either move. It is chosen for BULK
 * because the wide-doll control multiplies its max HP and the overkill arm needs `floor(H/4)` to be
 * comfortably UNDER a single hit — a doll the attack cannot break makes both arms the control. */
const SUBBERS = POOL.filter(s => LS(s).substitute && buildable(s));
console.log('  legal, buildable Substitute users  : ' + SUBBERS.length);

/* ONE ATTACKER FOR BOTH ARMS wherever the format allows it, so the two families are compared on the
 * same body; if none exists the two arms take their own attacker and that is printed. */
function pick(moves) {
  for (const mv of moves) {
    const atts = POOL.filter(s => LS(s)[mv.id] && buildable(s));
    for (const a of atts) {
      const t = SUBBERS.find(s => s !== a && dex.getImmunity(mv.type, s) && dex.getEffectiveness(mv.type, s) >= 0);
      if (t) return { mv, att: a, tgt: t };
    }
  }
  return null;
}
const REC = pick(RECOILS), DRN = pick(DRAINS);
if (!REC) bad('no (recoil move, attacker, non-immune Substitute target) triple');
if (!DRN) bad('no (drain move, attacker, non-immune Substitute target) triple');
if (fixtureFail) { console.log(''); console.log('  ' + fixtureFail + ' FIXTURE FAILURES — nothing below is evidence.'); process.exit(1); }

for (const r of [REC, DRN]) {
  const v1 = CS.checkLegal({ species: r.att.name, moves: [r.mv.name], item: '' });
  const v2 = CS.checkLegal({ species: r.tgt.name, moves: ['Substitute'], item: '' });
  if (!v1.legal) bad(r.att.name + '|' + r.mv.name + ' — ' + (v1.problems || []).join('; '));
  if (!v2.legal) bad(r.tgt.name + '|Substitute — ' + (v2.problems || []).join('; '));
}
console.log('  RECOIL arm  : ' + REC.att.name + ' ' + REC.mv.name + ' ' + JSON.stringify(REC.mv.recoil)
  + '  ->  ' + REC.tgt.name + '   eff=' + dex.getEffectiveness(REC.mv.type, REC.tgt));
console.log('  DRAIN  arm  : ' + DRN.att.name + ' ' + DRN.mv.name + ' ' + JSON.stringify(DRN.mv.drain)
  + '  ->  ' + DRN.tgt.name + '   eff=' + dex.getEffectiveness(DRN.mv.type, DRN.tgt));
if (fixtureFail) { console.log(''); console.log('  ' + fixtureFail + ' FIXTURE FAILURES — nothing below is evidence.'); process.exit(1); }
console.log('');

/* ================= ONE SET OF BODIES, BUILT THE SAME WAY ON BOTH SIDES ==========================
 * The probe_pair rule: two places that both decide what body is on the board will disagree
 * eventually, and the disagreement is invisible. Level-50 flat stats, 31 IVs, no EVs, computed here
 * and written into BOTH engines. The wide-doll control arm needs the damage to agree number for
 * number, so this is not optional decoration. */
const flatStat = (b) => Math.floor((2 * b + 31) * 50 / 100) + 5;
const flatHP = (b) => Math.floor((2 * b + 31) * 50 / 100) + 50 + 10;
function stats(name) {
  const bs = dex.species.get(name).baseStats;
  return { hp: flatHP(bs.hp), at: flatStat(bs.atk), df: flatStat(bs.def),
           sa: flatStat(bs.spa), sd: flatStat(bs.spd), sp: flatStat(bs.spe) };
}
const SLOW = 1, FAST = 999;          /* the target moves first, so the doll is up when the hit lands */
const mkSet = (name, move) => ({
  name, species: name, item: '', ability: Object.values(dex.species.get(name).abilities)[0],
  moves: [move], nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
});
const PAL = SUBBERS[0].name;
const inert = (sp) => CS.firstLegalMove(sp) || CS.INERT_MOVE;

/* ---- THE AUTHORITY ---------------------------------------------------------------------------- */
function sdRun(row, wide) {
  const A = stats(row.att.name), T = stats(row.tgt.name);
  const teamA = [mkSet(row.att.name, row.mv.name), mkSet(PAL, inert(PAL)), mkSet(PAL, inert(PAL)), mkSet(PAL, inert(PAL))];
  const teamB = [mkSet(row.tgt.name, 'Substitute'), mkSet(PAL, inert(PAL)), mkSet(PAL, inert(PAL)), mkSet(PAL, inert(PAL))];
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  const src = battle.p1.active[0], tgt = battle.p2.active[0];
  const setAb = (p) => { const ab = dex.abilities.get(NEUTRAL_AB);
    p.ability = ab.id; p.abilityState = { id: ab.id, target: p, effectOrder: 0 }; };
  for (const p of [...battle.p1.active, ...battle.p2.active]) if (p) { setAb(p); p.item = ''; p.clearBoosts(); }
  battle.field.clearWeather(); battle.field.clearTerrain();

  src.storedStats.atk = A.at; src.storedStats.spa = A.sa; src.storedStats.def = A.df;
  src.storedStats.spd = A.sd; src.storedStats.spe = SLOW;
  tgt.storedStats.atk = T.at; tgt.storedStats.spa = T.sa; tgt.storedStats.def = T.df;
  tgt.storedStats.spd = T.sd; tgt.storedStats.spe = FAST;
  src.maxhp = A.hp; src.hp = Math.floor(A.hp / 2);
  tgt.maxhp = T.hp * (wide ? WIDE : 1); tgt.hp = tgt.maxhp;

  battle.random = (n) => (n === 16 ? ROLL_INDEX : 0);
  battle.randomChance = (num, den) => (num === 1 && den === 24 ? false : true);   /* never a crit; never a miss */

  const before = src.hp;
  const mark = battle.log.length;
  battle.makeChoices('move 1 1, move 1', 'move 1, move 1');
  const sub = tgt.volatiles['substitute'];
  return { before, after: src.hp, maxhp: src.maxhp, dollMax: Math.floor(tgt.maxhp / 4),
           dollLeft: sub ? sub.hp : 0, tgtMax: tgt.maxhp,
           log: battle.log.slice(mark).filter(l => /-damage|-heal|-activate|-end|-start|move/.test(l)) };
}

/* ---- OURS ------------------------------------------------------------------------------------- */
function mediRun(row, wide) {
  const A = stats(row.att.name), T = stats(row.tgt.name);
  const mk = (name, moveName, st) => {
    const b = MEDI.buildMon(dex.species.get(name).id, {});
    if (!b) throw new Error('buildMon failed for ' + name);
    b.moves = [dex.moves.get(moveName).id];
    b.item = ''; b.ability = dex.abilities.get(NEUTRAL_AB).id;
    b.st = Object.assign({}, st);
    b.curHP = b.st.hp;
    return b;
  };
  const me = mk(row.att.name, row.mv.name, Object.assign({}, A, { sp: SLOW }));
  const ally = mk(PAL, inert(PAL), stats(PAL));
  const f1 = mk(row.tgt.name, 'Substitute', Object.assign({}, T, { sp: FAST, hp: T.hp * (wide ? WIDE : 1) }));
  const f2 = mk(PAL, inert(PAL), stats(PAL));
  me.curHP = Math.floor(A.hp / 2);
  f1.curHP = f1.st.hp;
  const trace = [];
  const S = MEDI.battleInit([me, ally], [f1, f2], { seeded: true, trace });
  const u = (2 * (16 - 1 - ROLL_INDEX) + 1) / 32;
  const rng = { any: () => 0.5, acc: () => 0, crit: () => 0.999, sec: () => 0.999,
                dmg: () => u, stall: () => 0.999, tie: () => 0, tgt: () => 0, split: true, seed: null };
  const before = me.curHP;
  MEDI.battleTurn(S, rng,
    new Map([[me, MEDI.playerAction(me, dex.moves.get(row.mv.name).id, f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, MEDI.playerAction(f1, 'substitute', f1, S.field)], [f2, { kind: 'pass' }]]));
  return { before, after: me.curHP, maxhp: me.st.hp, dollMax: Math.floor(f1.st.hp / 4),
           dollLeft: f1._sub || 0, tgtMax: f1.st.hp,
           log: trace.map(MEDI.traceCanon).filter(l => /-damage|-heal|-activate|-end|-start|move/.test(l)) };
}

/* ================= THE ARMS ==================================================================== */
let red = 0;
const ARMS = [
  { row: REC, kind: 'recoil', label: 'RECOIL  ' + REC.att.name + ' ' + REC.mv.name + ' -> ' + REC.tgt.name },
  { row: DRN, kind: 'drain', label: 'DRAIN   ' + DRN.att.name + ' ' + DRN.mv.name + ' -> ' + DRN.tgt.name },
];

console.log('  === WHAT CAME BACK ===');
const seen = [];
for (const a of ARMS) {
  for (const wide of [false, true]) {
    const sd = sdRun(a.row, wide), me = mediRun(a.row, wide);
    seen.push({ a, wide, sd, me });
    const tag = a.label + (wide ? '   [CONTROL — doll x' + WIDE + ', it survives]' : '   [THE ROW — overkill]');
    console.log('  ' + tag);
    /* PRINTED BEFORE IT IS JUDGED: a probe that queries a field which does not exist prints a clean
     * all-clear, so every field this row reads is on the screen first. */
    for (const [who, o] of [['authority', sd], ['ours     ', me]])
      console.log('      ' + who + '  attacker ' + o.before + ' -> ' + o.after + ' of ' + o.maxhp
        + '   delta ' + (o.after - o.before)
        + '   doll ' + o.dollMax + ' -> ' + o.dollLeft + '   target maxhp ' + o.tgtMax);
    console.log('        authority log ' + JSON.stringify(sd.log.slice(0, 8)));
    console.log('        ours      log ' + JSON.stringify(me.log.slice(0, 8)));
  }
}
console.log('');

console.log('  === THE ASSERTIONS ===');
for (const s of seen) {
  const tag = s.a.label + (s.wide ? '  [CONTROL]' : '  [THE ROW]');
  const fail = (t) => { red++; console.log('      FAIL ' + tag + ' — ' + t); };
  /* THE FIXTURE'S OWN PREMISE FIRST. A doll that was never built, or an overkill arm whose doll
   * SURVIVED, or a control arm whose doll BROKE, is a claim about the fixture and not the engine. */
  for (const [who, o] of [['authority', s.sd], ['ours', s.me]]) {
    if (!o.dollMax) fail(who + ': no doll was built');
    if (!s.wide && o.dollLeft > 0) fail(who + ': the overkill arm did NOT break the doll (' + o.dollLeft + ' left)');
    if (s.wide && o.dollLeft <= 0) fail(who + ': the control arm BROKE the doll — no clamp is being avoided');
    if (o.after === o.before) fail(who + ': the attacker\'s HP did not move at all');
  }
  if (s.sd.dollMax !== s.me.dollMax) fail('the two engines built DIFFERENT dolls (' + s.sd.dollMax + ' vs ' + s.me.dollMax + ')');
  const dSd = s.sd.after - s.sd.before, dMe = s.me.after - s.me.before;
  if (dSd !== dMe) fail('the attacker\'s HP change DISAGREES: authority ' + dSd + ', ours ' + dMe);
}
console.log('');

if (red) {
  console.log('  ' + red + ' FAILING CLAUSE(S)' + (RESTORED ? '  — EXPECTED: the restore knob is on.' : ''));
  process.exit(RESTORED ? 0 : 1);
}
console.log('  ALL CLAUSES PASS' + (RESTORED ? ' — BUT THE RESTORE KNOB IS ON AND SHOULD HAVE BROKEN THE OVERKILL ARM.' : ''));
process.exit(RESTORED ? 1 : 0);
