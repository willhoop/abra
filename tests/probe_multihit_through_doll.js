/* probe_multihit_through_doll.js — A VOLLEY THAT BREAKS A SUBSTITUTE STILL OWES THE BODY ITS
 * REMAINING ARRIVALS.
 *
 *   SHOWDOWN_PATH=... node tests/probe_multihit_through_doll.js
 *   SHOWDOWN_PATH=... MEDI_VOLLEY_STOPS_AT_DOLL=1 node tests/probe_multihit_through_doll.js
 *
 * ================= WHERE THIS CARD CAME FROM ===================================================
 *
 * Narration batch U read it off the pinned pool as
 * `event missing from medicham2 :: |-damage|p1a|H/H <> |move|p1a|psyshock` — a two-hit volley into a
 * body behind a Substitute, where the authority wrote `-end`, a second `-damage` and `-hitcount 2`
 * and this engine wrote `-end` and stopped. It was filed NARRATION-ONLY because the body died to a
 * later move in the same turn in BOTH engines, so no board was ever sampled between the two states.
 * It is not narration. This probe is that sentence turned into a measurement.
 *
 * ================= THE AUTHORITY, READ AND NOT RECALLED =========================================
 *
 * Champions overrides the hit loop (`hitStepMoveHitLoop`, data/mods/champions/scripts.ts:428) and
 * `spreadMoveHit` (:315) and does NOT override `substitute` (`grep substitute
 * data/mods/champions/moves.ts` -> 0). Three lines decide this:
 *
 *   scripts.ts:459-473   for (hit = 1; hit <= targetHits; hit++) { ...
 *                          } else { targetsCopy = targets.slice(0); }        <- REMADE EVERY HIT
 *                          [moveDamageThisHit, targetsCopy] = this.spreadMoveHit(targetsCopy, ...)
 *   scripts.ts:351-354   if (damage[i] === this.battle.HIT_SUBSTITUTE) { damage[i] = true;
 *                                                                       targets[i] = null; }
 *   data/moves.ts:18348-18352  substitute.condition.onTryPrimaryHit —
 *                          if (target.volatiles['substitute'].hp <= 0) target.removeVolatile(...)
 *
 * `targets[i] = null` is written into the COPY, so it drops the row for THAT ARRIVAL and nothing
 * more. None of the loop's three guards stops the volley either: `damage[i]` folds to 0 rather than
 * `false` (:532), `moveDamage` holds `true`, and `targets.every(t => !t?.hp)` reads the ORIGINAL
 * list, whose body still has HP. So the doll is asked once per arrival, and the arrival that finds
 * no doll lands on the body.
 *
 * ================= THE FOUR ARMS, AND WHY EACH ONE HAS TO EXIST ================================
 *
 * The knob under test is the attacker's offensive stat, and it moves the fixture through four
 * genuinely different resolutions of the SAME click. Identical results across it would mean the
 * fixture, not the engine, is deciding the answer.
 *
 *   DOLL-HOLDS   every arrival is under the doll's remaining HP.  The doll survives the click and
 *                the body is never touched.  The authority writes `-activate|[damage]` ONCE PER
 *                ARRIVAL; the pre-batch engine folded the whole swing into one subtraction and
 *                therefore wrote ONE line.  Narration only — the boards agree on both engines.
 *   BREAK-LAST   the doll survives arrival 1 and breaks on the last one.  `-activate` then `-end`,
 *                body untouched.  Still narration; it is the arm that stops "emit one line per
 *                arrival" being read as "emit `-end` earlier".
 *   BREAK-FIRST  arrival 1 overkills the doll, so arrivals 2..n land on the BODY.  **BOARD.**
 *   LETHAL       the same, with the surviving arrivals enough to kill.  A body that lives here and
 *                dies in the authority is the worst shape this defect takes.
 *   NO-DOLL      the CONTROL: the identical volley into a body that never put a doll up.  It must
 *                agree before and after, and it must be UNMOVED by the restore knob — that is what
 *                separates "the volley continues past a broken doll" from "the volley changed".
 *
 * EVERY ARM'S PREMISE IS TAKEN FROM THE AUTHORITY'S OWN LOG, not from arithmetic done here: the
 * multiplier ladder is walked and each arm keeps the first multiplier whose AUTHORITY log has the
 * shape the arm is named for.  An arm that cannot be staged is a FIXTURE FAILURE and nothing below
 * it is evidence.
 *
 * THE TARGET IS FASTER, deliberately, so one turn does the whole job: the doll goes up and the
 * volley lands on it in the same turn, with no residual in between.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('MULTI-HIT THROUGH A SUBSTITUTE');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const RESTORED = process.env.MEDI_VOLLEY_STOPS_AT_DOLL === '1';
const NEUTRAL_AB = 'Illuminate';
const ROLL_INDEX = 0;

console.log('MULTI-HIT THROUGH A SUBSTITUTE — the arrivals a broken doll no longer covers');
console.log('  authority  data/mods/champions/scripts.ts:459-473, :351-354; data/moves.ts:18348-18352');
console.log('  restore knob MEDI_VOLLEY_STOPS_AT_DOLL=' + (RESTORED ? '1  (THE DEFECT IS PUT BACK)' : '0'));
console.log('');
console.log('  === §F THE FIXTURE, DERIVED THIS RUN ===');

let fixtureFail = 0;
const bad = (s) => { fixtureFail++; console.log('  FAIL fixture premise: ' + s); };
const stop = () => { if (fixtureFail) { console.log(''); console.log('  ' + fixtureFail + ' FIXTURE FAILURES — nothing below is evidence.'); process.exit(1); } };

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal' && !s.forme && !s.isMega && !s.battleOnly;
const LS = s => ((dex.species.getLearnsetData(s.id) || {}).learnset || {});
const POOL = dex.species.all().filter(LEGAL).sort((a, b) => a.name.localeCompare(b.name));
const buildable = (s) => {
  try { return !!MEDI.buildMon(dex.species.get(s.name).id, {}); }
  catch (e) { console.error('probe fixture: buildMon(' + s.name + ') threw: ' + e.message); return false; }
};

/* THE MOVE FAMILY, DERIVED. A FIXED arrival count (so `-hitcount` is a constant), certain accuracy
 * (a missed arrival would make the arm a flake), single target (a spread click is a different step
 * list) and NOT smartTarget — Dragon Darts takes one target per arrival and is therefore a different
 * mechanism, which is precisely why it must not be the fixture for this one. */
const certain = (m) => m.accuracy === true || m.accuracy === 100;
const VOLLEYS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.basePower > 0 &&
  typeof m.multihit === 'number' && m.multihit >= 2 && !m.multiaccuracy && !m.smartTarget &&
  certain(m) && m.target === 'normal' && !m.willCrit && (Number(m.critRatio) || 1) === 1)
  .sort((a, b) => (b.multihit - a.multihit) || a.name.localeCompare(b.name));
console.log('  fixed-count, certain, single-target volleys : ' +
  (VOLLEYS.map(m => m.name + ' x' + m.multihit + ' ' + m.type + '/' + m.category).join(', ') || 'NONE'));
if (!VOLLEYS.length) bad('no fixed-count certain single-target multi-hit move in this format');
stop();

/* THE PAIR. The target must learn Substitute, must not resist the volley into immunity, and must be
 * buildable in BOTH engines. */
function pick() {
  for (const mv of VOLLEYS) {
    const atts = POOL.filter(s => LS(s)[mv.id] && buildable(s));
    for (const a of atts) {
      const t = POOL.find(s => s !== a && LS(s).substitute && buildable(s) &&
        dex.getImmunity(mv.type, s) && dex.getEffectiveness(mv.type, s) >= 0);
      if (t) return { mv, att: a, tgt: t };
    }
  }
  return null;
}
const ROW = pick();
if (!ROW) bad('no (fixed-count volley, attacker, non-immune Substitute target) triple');
stop();

const IDLE = (() => {                        /* the target's NO-DOLL click — a pure self-boost */
  const c = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status' &&
    m.target === 'self' && m.boosts && !m.volatileStatus && LS(ROW.tgt)[m.id]);
  return c[0] || null;
})();
if (!IDLE) bad('the target learns no pure self-boost status move for the NO-DOLL control');
stop();

const v1 = CS.checkLegal({ species: ROW.att.name, moves: [ROW.mv.name], item: '' });
const v2 = CS.checkLegal({ species: ROW.tgt.name, moves: ['Substitute', IDLE.name], item: '' });
if (!v1.legal) bad(ROW.att.name + '|' + ROW.mv.name + ' — ' + (v1.problems || []).join('; '));
if (!v2.legal) bad(ROW.tgt.name + '|Substitute,' + IDLE.name + ' — ' + (v2.problems || []).join('; '));
console.log('  attacker / volley : ' + ROW.att.name + ' ' + ROW.mv.name + ' x' + ROW.mv.multihit +
  '   eff=' + dex.getEffectiveness(ROW.mv.type, ROW.tgt));
console.log('  target / doll     : ' + ROW.tgt.name + '   idle click ' + IDLE.name);
stop();

/* ONE SET OF BODIES, BUILT THE SAME WAY ON BOTH SIDES — the probe_pair rule. */
const flatStat = (b) => Math.floor((2 * b + 31) * 50 / 100) + 5;
const flatHP = (b) => Math.floor((2 * b + 31) * 50 / 100) + 50 + 10;
function stats(name) {
  const bs = dex.species.get(name).baseStats;
  return { hp: flatHP(bs.hp), at: flatStat(bs.atk), df: flatStat(bs.def),
           sa: flatStat(bs.spa), sd: flatStat(bs.spd), sp: flatStat(bs.spe) };
}
const SLOW = 1, FAST = 999;
const OFF = ROW.mv.category === 'Physical' ? 'at' : 'sa';
const mkSet = (name, moves) => ({
  name, species: name, item: '', ability: Object.values(dex.species.get(name).abilities)[0],
  moves, nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
});
const PAL = ROW.tgt.name;
const inert = (sp) => CS.firstLegalMove(sp) || CS.INERT_MOVE;

/* ---- THE AUTHORITY ---------------------------------------------------------------------------- */
function sdRun(off, doll) {
  const A = stats(ROW.att.name), T = stats(ROW.tgt.name);
  const teamA = [mkSet(ROW.att.name, [ROW.mv.name]), mkSet(PAL, [inert(PAL)]), mkSet(PAL, [inert(PAL)]), mkSet(PAL, [inert(PAL)])];
  const teamB = [mkSet(ROW.tgt.name, ['Substitute', IDLE.name]), mkSet(PAL, [inert(PAL)]), mkSet(PAL, [inert(PAL)]), mkSet(PAL, [inert(PAL)])];
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
  src.storedStats[OFF === 'at' ? 'atk' : 'spa'] = off;
  tgt.storedStats.atk = T.at; tgt.storedStats.spa = T.sa; tgt.storedStats.def = T.df;
  tgt.storedStats.spd = T.sd; tgt.storedStats.spe = FAST;
  src.maxhp = A.hp; src.hp = A.hp;
  tgt.maxhp = T.hp; tgt.hp = tgt.maxhp;

  battle.random = (n) => (n === 16 ? ROLL_INDEX : 0);
  battle.randomChance = (num, den) => (num === 1 && den === 24 ? false : true);   /* never a crit; never a miss */

  const mark = battle.log.length;
  battle.makeChoices('move 1 1, move 1', (doll ? 'move 1' : 'move 2') + ', move 1');
  const sub = tgt.volatiles['substitute'];
  /* THE FOE-PERSPECTIVE `-damage|…|n/100` LINES ARE DROPPED. `battle.log` carries both sides' views
   * of one HP change; keeping them would count every arrival twice on one engine and once on the
   * other, which is a difference in the READER and not in the game. */
  return { hp: tgt.hp, maxhp: tgt.maxhp, fainted: !!tgt.fainted, doll: sub ? sub.hp : 0,
           dollMax: Math.floor(tgt.maxhp / 4),
           log: battle.log.slice(mark).filter(l => /^\|(-activate|-end|-hitcount)\|/.test(l) ||
             (/^\|-damage\|/.test(l) && !/\|\d+\/100/.test(l))) };
}

/* ---- OURS ------------------------------------------------------------------------------------- */
function mediRun(off, doll) {
  const A = stats(ROW.att.name), T = stats(ROW.tgt.name);
  const mk = (name, moveName, st) => {
    const b = MEDI.buildMon(dex.species.get(name).id, {});
    if (!b) throw new Error('buildMon failed for ' + name);
    b.moves = [dex.moves.get(moveName).id];
    b.item = ''; b.ability = dex.abilities.get(NEUTRAL_AB).id;
    b.st = Object.assign({}, st);
    b.curHP = b.st.hp;
    return b;
  };
  const aSt = Object.assign({}, A, { sp: SLOW }); aSt[OFF] = off;
  const me = mk(ROW.att.name, ROW.mv.name, aSt);
  const ally = mk(PAL, inert(PAL), stats(PAL));
  const f1 = mk(ROW.tgt.name, doll ? 'Substitute' : IDLE.name, Object.assign({}, T, { sp: FAST }));
  const f2 = mk(PAL, inert(PAL), stats(PAL));
  const trace = [];
  const S = MEDI.battleInit([me, ally], [f1, f2], { seeded: true, trace });
  const u = (2 * (16 - 1 - ROLL_INDEX) + 1) / 32;
  const rng = { any: () => 0.5, acc: () => 0, crit: () => 0.999, sec: () => 0.999,
                dmg: () => u, stall: () => 0.999, tie: () => 0, tgt: () => 0, split: true, seed: null };
  MEDI.battleTurn(S, rng,
    new Map([[me, MEDI.playerAction(me, dex.moves.get(ROW.mv.name).id, f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, MEDI.playerAction(f1, doll ? 'substitute' : IDLE.id, f1, S.field)], [f2, { kind: 'pass' }]]));
  return { hp: Math.max(0, f1.curHP), maxhp: f1.st.hp, fainted: !!f1.fainted || f1.curHP <= 0,
           doll: f1._sub || 0, dollMax: Math.floor(f1.st.hp / 4),
           log: trace.map(MEDI.traceCanon).filter(l => /^\|(-activate|-end|-hitcount|-damage)\|/.test(l)) };
}

/* ================= THE MULTIPLIER LADDER, JUDGED BY THE AUTHORITY ============================== */
const BASE = stats(ROW.att.name)[OFF];
const LADDER = [];
for (let n = 1; n <= 40; n++) LADDER.push(Math.max(1, Math.round(BASE * n / 4)));

const shapeOf = (o) => {
  const acts = o.log.filter(l => /-activate\|.*[Ss]ubstitute/.test(l)).length;
  const ends = o.log.filter(l => /-end\|.*[Ss]ubstitute/.test(l)).length;
  return { acts, ends, broke: ends > 0, bodyHit: o.hp < o.maxhp - o.dollMax || o.fainted };
};
const ARMSPEC = [
  { key: 'DOLL-HOLDS', want: (s, o) => !s.broke && s.acts === ROW.mv.multihit && !s.bodyHit },
  { key: 'BREAK-LAST', want: (s, o) => s.broke && s.acts === ROW.mv.multihit - 1 && !s.bodyHit },
  { key: 'BREAK-FIRST', want: (s, o) => s.broke && s.acts === 0 && s.bodyHit && !o.fainted },
  { key: 'LETHAL', want: (s, o) => s.broke && s.acts === 0 && o.fainted },
];
const ARMS = [];
for (const spec of ARMSPEC) {
  let hit = null;
  for (const off of LADDER) {
    const sd = sdRun(off, true);
    if (spec.want(shapeOf(sd), sd)) { hit = { off, sd }; break; }
  }
  if (!hit) bad('the ' + spec.key + ' arm could not be staged on the authority anywhere on the ladder');
  else ARMS.push({ key: spec.key, off: hit.off, doll: true });
}
stop();
/* THE CONTROL RIDES THE SAME OFFENCE AS THE BOARD ARM, so that "the volley continues" and "the
 * volley changed" cannot be confused: one number, two boards, differing in the doll alone. */
ARMS.push({ key: 'NO-DOLL', off: ARMS.find(a => a.key === 'BREAK-FIRST').off, doll: false });
console.log('  base ' + OFF + ' ' + BASE + ';  arms staged at ' +
  ARMS.map(a => a.key + '=' + a.off + (a.doll ? '' : ' (no doll)')).join(', '));
console.log('');

/* ================= WHAT CAME BACK ============================================================== */
console.log('  === WHAT CAME BACK ===');
const seen = [];
for (const a of ARMS) {
  const sd = sdRun(a.off, a.doll), me = mediRun(a.off, a.doll);
  seen.push({ a, sd, me });
  console.log('  ' + a.key);
  for (const [who, o] of [['authority', sd], ['ours     ', me]])
    console.log('      ' + who + '  body ' + o.hp + '/' + o.maxhp + (o.fainted ? ' FNT' : '') +
      '   doll ' + o.dollMax + ' -> ' + o.doll);
  console.log('        authority log ' + JSON.stringify(sd.log));
  console.log('        ours      log ' + JSON.stringify(me.log));
}
console.log('');

/* ================= THE ASSERTIONS ============================================================== */
console.log('  === THE ASSERTIONS ===');
let red = 0;
for (const s of seen) {
  const fail = (t) => { red++; console.log('      FAIL ' + s.a.key + ' — ' + t); };
  const sdS = shapeOf(s.sd), meS = shapeOf(s.me);
  /* THE FIXTURE'S OWN PREMISE FIRST, RE-ASSERTED ON THE RUN THAT IS JUDGED. */
  if (s.a.doll && !s.sd.dollMax) fail('authority: no doll was built');
  if (s.a.doll && s.sd.dollMax !== s.me.dollMax) fail('the two engines built DIFFERENT dolls (' +
    s.sd.dollMax + ' vs ' + s.me.dollMax + ')');
  if (!s.a.doll && (sdS.acts || sdS.ends)) fail('authority: the NO-DOLL control had a doll in it');

  /* THE BOARD. This is the clause the batch exists for. */
  if (s.sd.hp !== s.me.hp) fail('BODY HP DISAGREES: authority ' + s.sd.hp + ', ours ' + s.me.hp);
  if (s.sd.fainted !== s.me.fainted) fail('the body FAINTED on one engine only: authority ' +
    s.sd.fainted + ', ours ' + s.me.fainted);

  /* THE ARRIVAL COUNT, which is `-hitcount` and therefore `move.hit - 1`. */
  const cnt = (o) => { const l = o.log.find(x => /-hitcount/.test(x)); return l ? Number(l.split('|').pop()) : null; };
  if (cnt(s.sd) !== cnt(s.me)) fail('-hitcount DISAGREES: authority ' + cnt(s.sd) + ', ours ' + cnt(s.me));

  /* THE DOLL'S OWN LINES, one per arrival it ate. */
  if (sdS.acts !== meS.acts) fail('`-activate|move: Substitute|[damage]` count DISAGREES: authority ' +
    sdS.acts + ', ours ' + meS.acts);
  if (sdS.ends !== meS.ends) fail('`-end|Substitute` count DISAGREES: authority ' + sdS.ends + ', ours ' + meS.ends);
}
console.log('');

if (red) {
  console.log('  ' + red + ' FAILING CLAUSE(S)' + (RESTORED ? '  — EXPECTED: the restore knob is on.' : ''));
  process.exit(RESTORED ? 0 : 1);
}
console.log('  ALL CLAUSES PASS' + (RESTORED ? ' — BUT THE RESTORE KNOB IS ON AND SHOULD HAVE BROKEN THE BOARD ARMS.' : ''));
process.exit(RESTORED ? 1 : 0);
