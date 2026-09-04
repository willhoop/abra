/* probe_delayed_crit.js — THE DELAYED HIT TAKES NO CRIT DRAW AT ALL (ROADMAP #419).
 *
 *   SHOWDOWN_PATH=... node tests/probe_delayed_crit.js
 *   SHOWDOWN_PATH=... MEDI_DELAYED_HIT_NO_CRIT=1 node tests/probe_delayed_crit.js    (the restore arm)
 *
 * ================= THE AUTHORITY, READ AND NOT RECALLED =========================================
 *
 * `condition:futuremove`'s payout is an ORDINARY HIT. It goes through the full step list:
 *
 *   data/conditions.ts:415        this.actions.trySpreadMoveHit([target], data.source, hitMove, true)
 *   sim/battle-actions.ts:1156      const curDamage = this.getDamage(source, target, moveData)
 *   sim/battle-actions.ts:1636-42     const moveHit = target.getMoveHitData(move)
 *                                     moveHit.crit = move.willCrit || false
 *                                     if (move.willCrit === undefined)
 *                                       if (critRatio) moveHit.crit = randomChance(1, critMult[critRatio])
 *   sim/battle-actions.ts:1633        critMult = [0, 24, 8, 2, 1]     (the gen 9 branch)
 *   sim/dex-moves.ts:486              this.critRatio = Number(data.critRatio) || 1     -> 1/24
 *   data/mods/champions/scripts.ts:220  const isCrit = target.getMoveHitData(move).crit
 *   data/mods/champions/scripts.ts:222    baseDamage = tr(baseDamage * 1.5)
 *   data/mods/champions/scripts.ts:285  if (isCrit && !suppressMessages) this.battle.add('-crit', target)
 *
 * Champions overrides neither `getDamage` nor `getSpreadDamage` (`grep getDamage
 * data/mods/champions/scripts.ts` -> the comment on :360 only), and it does not override `substitute`
 * or `futuremove` at all. So the delayed hit rolls the same 1/24 the direct click rolls, multiplies
 * by the same 1.5 in the same place, and prints `-crit` from the same line as every other hit.
 *
 * ================= THIS ENGINE ==================================================================
 *
 * `engine/medicham2-browser.js`'s residual payout draws `_R.dmg()` and NOTHING ELSE. Its own header
 * said so in plain words before this probe existed — *"NO CRIT LINE, AND THAT IS STATED RATHER THAN
 * MISSED: this payout takes no crit draw at all, so emitting `-crit` would require inventing one."*
 * A die that is never drawn cannot be pinned, so under a crit-certain die the delayed hit was
 * byte-identical to the same hit under a crit-impossible die. That is this repo's unwired-knob
 * signature (docs/LESSONS.md): identical output across a varied knob is the finding.
 *
 * ================= WHAT THIS ASKS, AND WHY IT IS SHAPED THIS WAY ================================
 *
 * The two engines are handed THE SAME CRIT DIE twice — once saying CRIT and once saying NO-CRIT —
 * and each is asked two questions about its own delayed payout:
 *
 *   (1) does a `-crit` line appear, and only on the crit arm?
 *   (2) does the damage MOVE between the two arms?
 *
 * Neither question compares a number across engines, so no cross-engine stat alignment is claimed
 * and none is needed; what is compared across engines is the ANSWER SHAPE. The engines' spreads
 * differ by construction (`buildMon` vs the format's SP spread) and the probe prints both HP bars so
 * that cannot be mistaken for agreement.
 *
 * THE CONTROL IS A DIRECT CLICK BY THE SAME ATTACKER ON THE SAME BOARD under the same two dice. It
 * must answer YES/moved on BOTH engines in both arms — that is what proves the harness can see a
 * crit at all. A probe whose control cannot see the thing it is looking for proves nothing, and a
 * fixture immune for two reasons proves less than nothing.
 *
 * THE RESTORE KNOB IS `MEDI_DELAYED_HIT_NO_CRIT=1`, per this repo's convention: it puts the missing
 * draw back to missing at run time, so the red is reachable without swapping a file, and any run
 * carrying it also carries a non-zero `MEDFAILS.delayedHitNoCritRestored`.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('DELAYED HIT / CRIT DRAW');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const MC = (typeof global !== 'undefined' && global.MEDICHAM_DATA) || require(D('data', 'engine-data.js'));
const CS = require(D('engine', 'champions_sim.js'));
const TAGS = require(D('data', 'tags.json'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const RESTORED = process.env.MEDI_DELAYED_HIT_NO_CRIT === '1';
const NEUTRAL_AB = 'Illuminate';       /* on every body on both sides, so no body's own ability is a control */
const ROLL_INDEX = 0;                  /* the damage die is pinned; only the crit die is allowed to vary */

/* ================= §F  THE FIXTURE, DERIVED THIS RUN ============================================
 * Nothing below is typed from memory. The move comes off the `delayedHit` tag, the attacker off the
 * learnset, the target off the type chart, and the "quiet" filler move off the format. */
console.log('DELAYED HIT / CRIT DRAW — a delayed payout is an ordinary hit and rolls the ordinary crit');
console.log('  authority  data/conditions.ts:415 -> sim/battle-actions.ts:1156 -> :1641'
          + ' -> data/mods/champions/scripts.ts:220,285');
console.log('  restore knob MEDI_DELAYED_HIT_NO_CRIT=' + (RESTORED ? '1  (THE DEFECT IS PUT BACK)' : '0'));
console.log('');
console.log('  === §F THE FIXTURE, DERIVED THIS RUN ===');

const DELAYED = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('delayedHit'))
  .map(([k, v]) => ({ id: k, p: v.params.delayedHit, uses: v.uses }));
console.log('  moves tagged delayedHit            : '
  + (DELAYED.map(d => d.id + ' (' + d.uses + ' sheets, ' + d.p.category + '/' + d.p.type + ')').join(', ') || 'NONE'));
if (!DELAYED.length) { console.log('  NO delayedHit MOVE — a claim about the artifact, not the engine.'); process.exit(2); }

/* THE MOVE MUST BE ABLE TO ROLL. A `willCrit` move takes no die (battle-actions.ts:1638) and a
 * raised `critRatio` is a different branch of `critMult`; both are read off the format. */
const MOVE = dex.moves.get(DELAYED[0].id);
let fixtureFail = 0;
const bad = (s) => { fixtureFail++; console.log('  FAIL fixture premise: ' + s); };
if (MOVE.willCrit) bad(MOVE.name + ' has willCrit — it cannot roll a crit die');
if ((Number(MOVE.critRatio) || 1) !== 1) bad(MOVE.name + ' critRatio=' + MOVE.critRatio + ', not the 1/24 branch');
if (MOVE.target !== 'normal') bad(MOVE.name + ' target=' + MOVE.target + ', not single-target');
if (MOVE.accuracy !== 100 && MOVE.accuracy !== true) bad(MOVE.name + ' accuracy=' + MOVE.accuracy);
console.log('  the delayed move                   : ' + MOVE.name + '  bp=' + MOVE.basePower
  + ' cat=' + MOVE.category + ' type=' + MOVE.type + ' critRatio=' + (Number(MOVE.critRatio) || 1)
  + ' willCrit=' + !!MOVE.willCrit + ' target=' + MOVE.target + ' acc=' + MOVE.accuracy);

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal' && !s.forme && !s.isMega && !s.battleOnly;
const LS = s => ((dex.species.getLearnsetData(s.id) || {}).learnset || {});
const POOL = dex.species.all().filter(LEGAL).sort((a, b) => a.name.localeCompare(b.name));

/* THE QUIET MOVE. Every body that is not clicking the delayed move spends its turn on a self-target
 * status move that raises an OFFENSIVE stat and nothing else — so no body's defences, HP, item,
 * status or field state moves under the measurement. Rest and Sleep Talk are excluded by the same
 * filter (`m.heal`, `m.callsMove` via `!m.status` plus the boosts requirement), which matters:
 * the first draft of this fixture picked Rest and put the target to sleep. */
const OFFENSIVE = new Set(['atk', 'spa']);
const quietMoves = (s) => Object.keys(LS(s)).map(i => dex.moves.get(i)).filter(m =>
  m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self' &&
  !m.flags.charge && !m.stallingMove && !m.selfSwitch && !m.status && !m.volatileStatus &&
  !m.heal && !m.sideCondition && !m.forceSwitch && !m.secondaries &&
  m.boosts && Object.keys(m.boosts).every(k => OFFENSIVE.has(k)) &&
  Object.values(m.boosts).every(v => v > 0)).map(m => m.name);

/* Both engines have to be able to BUILD the body: `MEDI.buildMon` returns null for any species with
 * no `MC.mons` row, and a probe that does not check stages nothing and reports whatever the
 * uninitialised path produces (tests/probe_pair.js §1). */
/* NOT SILENT. `false` here means "this body cannot be built, so it cannot carry the fixture" —
 * but a THROW and a null row are two different facts, and collapsing them into one quiet `false`
 * is how a probe stages nothing and reports whatever the uninitialised path produced. The throw
 * is named on stderr so a shrinking pool shows up as a message instead of vanishing. */
const buildable = (s) => {
  try { return !!MEDI.buildMon(dex.species.get(s.name).id, {}); }
  catch (e) { console.error('probe fixture: buildMon(' + s.name + ') threw: ' + e.message); return false; }
};

const ATT = POOL.filter(s => LS(s)[MOVE.id] && quietMoves(s).length && buildable(s))
  .sort((a, b) => b.baseStats.spa - a.baseStats.spa)[0];
if (!ATT) bad('no legal, buildable ' + MOVE.name + ' user with a quiet move');

/* THE TARGET MUST SURVIVE A CRIT. It is picked for bulk and for a NON-POSITIVE type multiplier, and
 * the survival is then ASSERTED on the board rather than assumed — a target that faints turns the
 * payout into a KO and the `-damage` line this probe reads would be its last. */
const TGT = POOL.filter(s => s !== ATT && quietMoves(s).length && buildable(s) &&
    dex.getImmunity(MOVE.type, s) && dex.getEffectiveness(MOVE.type, s) <= 0)
  .sort((a, b) => (b.baseStats.hp + b.baseStats.spd) - (a.baseStats.hp + a.baseStats.spd))[0];
if (!TGT) bad('no legal, buildable, bulky, non-weak target for ' + MOVE.type);

const FILL = POOL.filter(s => s !== ATT && s !== TGT && quietMoves(s).length && buildable(s)).slice(0, 2);
if (FILL.length < 2) bad('not enough legal filler bodies');
if (fixtureFail) { console.log(''); console.log('  ' + fixtureFail + ' FIXTURE FAILURES — nothing below is evidence.'); process.exit(1); }

const QUIET = (s) => quietMoves(s)[0];
const BODIES = [
  { sp: ATT, slot: 'p1a', move: MOVE.name, role: 'attacker (clicks ' + MOVE.name + ' every turn)' },
  { sp: FILL[0], slot: 'p1b', move: QUIET(FILL[0]), role: 'ally filler' },
  { sp: TGT, slot: 'p2a', move: QUIET(TGT), role: 'THE TARGET' },
  { sp: FILL[1], slot: 'p2b', move: QUIET(FILL[1]), role: 'foe filler' },
];
for (const b of BODIES) console.log('  ' + b.slot + '  ' + b.sp.name.padEnd(12) + b.move.padEnd(14)
  + ' eff=' + (b.slot === 'p2a' ? dex.getEffectiveness(MOVE.type, b.sp) : '-') + '   ' + b.role);

/* LEGALITY, ASKED OF THE FORMAT. */
for (const b of BODIES) {
  const v = CS.checkLegal({ species: b.sp.name, moves: [b.move], item: '' });
  if (!v.legal) bad('not legal in ' + CS.FORMAT + ': ' + b.sp.name + '|' + b.move + ' — ' + (v.problems || []).join('; '));
}
if (fixtureFail) { console.log(''); console.log('  ' + fixtureFail + ' FIXTURE FAILURES — nothing below is evidence.'); process.exit(1); }
console.log('');

/* ================= §A  THE AUTHORITY ============================================================ */
const mkSet = (sp, move) => ({
  name: sp.name, species: sp.name, item: '', ability: Object.values(sp.abilities)[0], moves: [move],
  nature: 'Serious', evs: Object.assign({}, CS.LEGAL_SPREAD),
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
});

const PAD = (sp, move) => [mkSet(sp, move), mkSet(sp, move), mkSet(sp, move)];

function sdRun(crit, direct) {
  const teamA = [mkSet(BODIES[0].sp, direct ? DIRECT_MOVE.name : BODIES[0].move), mkSet(BODIES[1].sp, BODIES[1].move),
                 ...PAD(BODIES[1].sp, BODIES[1].move).slice(0, 2)];
  const teamB = [mkSet(BODIES[2].sp, BODIES[2].move), mkSet(BODIES[3].sp, BODIES[3].move),
                 ...PAD(BODIES[3].sp, BODIES[3].move).slice(0, 2)];
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }

  const setAb = (p) => { const ab = dex.abilities.get(NEUTRAL_AB);
    if (!ab.exists) throw new Error('no ability ' + NEUTRAL_AB);
    p.ability = ab.id; p.abilityState = { id: ab.id, target: p, effectOrder: 0 }; };
  for (const p of [...battle.p1.active, ...battle.p2.active]) if (p) { setAb(p); p.item = ''; }

  let critDraws = 0, critAnswers = 0;
  const rawRandom = battle.random.bind(battle);
  battle.random = (n) => (n === 16 ? ROLL_INDEX : rawRandom(n));
  battle.randomChance = (num, den) => {
    if (num === 1 && den === 24) { critDraws++; if (crit) critAnswers++; return crit; }
    return true;   /* every accuracy check lands; nothing else in this fixture rides on a chance */
  };

  const tgt = battle.p2.active[0];
  const maxhp = tgt.maxhp;
  const mark0 = battle.log.length;
  for (let t = 0; t < 3; t++) battle.makeChoices('move 1 1, move 1', 'move 1, move 1');
  return { log: battle.log.slice(mark0), maxhp, hp: tgt.hp, critDraws, critAnswers, fainted: tgt.fainted };
}

/* ================= §M  OURS ==================================================================== */
function mediRun(crit, direct) {
  const mk = (sp, moveName) => {
    const b = MEDI.buildMon(dex.species.get(sp.name).id, {});
    if (!b) throw new Error('buildMon failed for ' + sp.name);
    b.moves = [dex.moves.get(moveName).id];
    b.item = '';
    b.ability = dex.abilities.get(NEUTRAL_AB).id;
    b.curHP = b.st.hp;
    return b;
  };
  const me = mk(BODIES[0].sp, direct ? DIRECT_MOVE.name : BODIES[0].move);
  const ally = mk(BODIES[1].sp, BODIES[1].move);
  const f1 = mk(BODIES[2].sp, BODIES[2].move);
  const f2 = mk(BODIES[3].sp, BODIES[3].move);
  const trace = [];
  const S = MEDI.battleInit([me, ally], [f1, f2], { seeded: true, trace });
  /* The crit die answers the SAME thing the authority's `randomChance(1, 24)` was given: a value
   * below the rate is a crit, a value above it is not. 1/24 is 0.0417, so 0 and 0.999 are on the two
   * sides of every crit rate this format can produce. */
  let critDraws = 0;
  const critDie = () => { critDraws++; return crit ? 0 : 0.999; };
  const u = (2 * (16 - 1 - ROLL_INDEX) + 1) / 32;
  const streams = { any: () => 0.5, acc: () => 0, crit: critDie, sec: () => 0.999,
                    dmg: () => u, stall: () => 0.999, tie: () => 0, tgt: () => 0, split: true, seed: null };
  const clickId = dex.moves.get(direct ? DIRECT_MOVE.name : BODIES[0].move).id;
  const acts = (own, foes, want) => { const map = new Map();
    own.forEach((mon, i) => { if (!mon) return;
      const w = want[i];
      if (!w) { map.set(mon, { kind: 'pass' }); return; }
      map.set(mon, MEDI.playerAction(mon, w.m, w.t != null ? foes[w.t] : (foes[0] || null), S.field)); });
    return map; };
  const before = f1.curHP;
  for (let t = 0; t < 3; t++) {
    MEDI.battleTurn(S, streams,
      acts(S.actA, S.actB, [{ m: clickId, t: 0 }, { m: dex.moves.get(BODIES[1].move).id, t: null }]),
      acts(S.actB, S.actA, [{ m: dex.moves.get(BODIES[2].move).id, t: null },
                            { m: dex.moves.get(BODIES[3].move).id, t: null }]));
  }
  return { log: trace.map(MEDI.traceCanon), maxhp: f1.st.hp, hp: f1.curHP, before,
           critDraws, fainted: !!f1.fainted };
}

/* ================= THE DIRECT CONTROL ==========================================================
 * The same attacker, the same board, one ordinary click — the move is DERIVED so it cannot quietly
 * become a second special case: single-target, damaging, 100 accuracy, no charge, no multi-hit, no
 * guaranteed crit and no raised ratio, so it takes exactly the die the delayed hit should take. */
const DIRECT_MOVE = (() => {
  const c = Object.keys(LS(ATT)).map(i => dex.moves.get(i)).filter(m =>
    m.exists && !m.isNonstandard && m.category !== 'Status' && m.target === 'normal' &&
    (m.accuracy === true || m.accuracy === 100) && !m.multihit && !m.willCrit &&
    (Number(m.critRatio) || 1) === 1 && m.basePower > 0 && !m.secondaries && !m.self &&
    !m.recoil && !m.drain && !m.flags.charge && !m.flags.recharge && !m.volatileStatus &&
    !m.status && !m.boosts && !m.sideCondition && !m.forceSwitch && !m.selfSwitch &&
    dex.getImmunity(m.type, TGT) && dex.getEffectiveness(m.type, TGT) <= 0);
  c.sort((a, b) => (a.basePower - b.basePower) || a.name.localeCompare(b.name));
  return c[0] || null;
})();
if (!DIRECT_MOVE) { console.log('  NO DERIVED DIRECT CONTROL MOVE on ' + ATT.name + ' — the harness cannot clear itself.'); process.exit(1); }
console.log('  the direct CONTROL click           : ' + DIRECT_MOVE.name + '  bp=' + DIRECT_MOVE.basePower
  + ' type=' + DIRECT_MOVE.type + ' eff=' + dex.getEffectiveness(DIRECT_MOVE.type, TGT));
{
  const v = CS.checkLegal({ species: ATT.name, moves: [DIRECT_MOVE.name], item: '' });
  if (!v.legal) { console.log('  FAIL control move not legal: ' + (v.problems || []).join('; ')); process.exit(1); }
}
console.log('');

/* ================= READING A RUN ================================================================
 * The payout block is located by the condition's OWN `-end` line, which both engines write, and the
 * `-crit`/`-damage` that follow it are the payout's. For the direct control there is no `-end`, so
 * the block is the whole log. `Object.keys` of a parsed line is printed once below, because a probe
 * that queries a field which does not exist prints a clean all-clear. */
const HITLINE = /^\|(-crit|-damage|-supereffective|-resisted|-end|move)\|/;
function readBlock(log, delayed, tgtSlotRe) {
  const lines = log.map(String).filter(l => HITLINE.test(l));
  let from = 0;
  if (delayed) {
    /* THE TWO ENGINES SPELL THE LINE DIFFERENTLY — `|-end|p2a: Slowking|move: Future Sight` there and
     * `|-end|p2a:slowking|move:futuresight` here — so the match folds case and punctuation rather
     * than comparing strings. The first draft compared the raw id and found NOTHING on the
     * authority's side, which read as "the authority never paid out" and was the reader. */
    const fold = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    const i = lines.findIndex(l => /^\|-end\|/.test(l) && fold(l).indexOf(fold(MOVE.id)) >= 0);
    if (i < 0) return { found: false, lines, crit: false, damage: null };   /* -1 is NOT "nothing here" */
    from = i;
  }
  const block = lines.slice(from);
  const crit = block.some(l => /^\|-crit\|/.test(l) && tgtSlotRe.test(l));
  const dmgLine = block.find(l => /^\|-damage\|/.test(l) && tgtSlotRe.test(l));
  return { found: true, lines, block, crit, damage: dmgLine || null };
}
const hpOf = (line, maxhp) => {
  if (!line) return null;
  const f = String(line).split('|');
  for (const part of f.slice(3)) {
    const m = /^(\d+)\/(\d+)/.exec(String(part));
    if (m && +m[2] === maxhp) return +m[1];
  }
  return null;
};

let red = 0;
const rows = [];
for (const direct of [true, false]) {
  const label = direct ? 'CONTROL  direct ' + DIRECT_MOVE.name : 'THE ROW  delayed ' + MOVE.name;
  const sdC = sdRun(true, direct), sdN = sdRun(false, direct);
  const meC = mediRun(true, direct), meN = mediRun(false, direct);
  const sdRe = /p2a/, meRe = /p2a/;

  const A = {
    crit: readBlock(sdC.log, !direct, sdRe), plain: readBlock(sdN.log, !direct, sdRe),
    maxhp: sdC.maxhp, hpCrit: sdC.hp, hpPlain: sdN.hp, draws: [sdC.critDraws, sdN.critDraws],
    fainted: sdC.fainted || sdN.fainted,
  };
  const B = {
    crit: readBlock(meC.log, !direct, meRe), plain: readBlock(meN.log, !direct, meRe),
    maxhp: meC.maxhp, hpCrit: meC.hp, hpPlain: meN.hp, draws: [meC.critDraws, meN.critDraws],
    fainted: meC.fainted || meN.fainted,
  };
  rows.push({ label, direct, A, B });
}

/* THE FIELDS ARE PRINTED BEFORE THEY ARE JUDGED. */
console.log('  === WHAT CAME BACK ===');
for (const r of rows) {
  console.log('  ' + r.label);
  for (const [who, o] of [['authority', r.A], ['ours     ', r.B]]) {
    console.log('      ' + who + '  block found=' + o.crit.found
      + '  |-crit| crit-arm=' + o.crit.crit + ' plain-arm=' + o.plain.crit
      + '  hp ' + o.hpCrit + ' vs ' + o.hpPlain + ' of ' + o.maxhp
      + '  dealt ' + (o.maxhp - o.hpCrit) + ' vs ' + (o.maxhp - o.hpPlain)
      + '  crit-die draws ' + JSON.stringify(o.draws) + (o.fainted ? '  TARGET FAINTED' : ''));
    console.log('        crit-arm block : ' + JSON.stringify((o.crit.block || o.crit.lines || []).slice(0, 6)));
  }
}
console.log('');

console.log('  === THE ASSERTIONS ===');
for (const r of rows) {
  const fail = (who, s) => { red++; console.log('      FAIL ' + who + ' — ' + s); };
  console.log('  ' + r.label);
  for (const [who, o] of [['authority', r.A], ['ours     ', r.B]]) {
    if (o.fainted) fail(who, 'the target FAINTED — the fixture, not the engine');
    if (!o.crit.found || !o.plain.found) { fail(who, 'the payout block was never written'); continue; }
    if (!o.crit.crit) fail(who, 'no |-crit| under a crit-CERTAIN die');
    if (o.plain.crit) fail(who, 'a |-crit| under a crit-IMPOSSIBLE die');
    if (o.hpCrit === o.hpPlain) fail(who, 'the damage did NOT move across the crit die — the knob is unwired');
    else if (o.hpCrit > o.hpPlain) fail(who, 'the crit arm dealt LESS than the plain arm');
    if (!o.draws[0]) fail(who, 'the crit die was never drawn at all');
  }
  if (r.A.crit.crit !== r.B.crit.crit)
    { red++; console.log('      FAIL the two engines DISAGREE about |-crit| on the crit arm'); }
}
console.log('');

if (red) {
  console.log('  ' + red + ' FAILING CLAUSE(S)' + (RESTORED ? '  — EXPECTED: the restore knob is on.' : ''));
  process.exit(RESTORED ? 0 : 1);
}
console.log('  ALL CLAUSES PASS' + (RESTORED ? ' — BUT THE RESTORE KNOB IS ON AND SHOULD HAVE BROKEN THE DELAYED ROW.' : ''));
process.exit(RESTORED ? 1 : 0);
