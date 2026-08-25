/* probe_dbond_stall.js — WHAT DO THE TWO ENGINES ACTUALLY DO WITH DESTINY BOND AND THE STALL
 * COUNTER, PRINTED BEFORE EITHER LEAF IS WIRED INTO board_state.js.
 *
 *   SHOWDOWN_PATH=... node tests/probe_dbond_stall.js
 *
 * `data/game-differential.json`'s `end_state_not_compared` names both of these. Each row argues that
 * the leaf CANNOT be compared, and each argument is a claim that has to be re-checked against the
 * authority rather than inherited:
 *
 *   destiny bond   "ONE-SIDED IN THE PROBE ... wiring it now would part every board carrying a
 *                  Destiny Bond and present a possible ENGINE DEFECT as a comparison leaf."
 *   stall counter  "medicham2 holds `tookProtectTurns` (a count UP) and Showdown holds a `stall`
 *                  volatile with a `counter` that is a DENOMINATOR (3, 9, 27). They are different
 *                  quantities, not two spellings of one, and a mapping between them would be this
 *                  file inventing a rule."
 *
 * THE RULES, DERIVED AT THE LINE AND NOT REMEMBERED (both re-derived on every run below):
 *
 *   data/moves.ts:3483-3526 destinybond — NO Champions override of the move (only learnsets).
 *     onFaint(target, source, effect):
 *       `if (!source || !effect || target.isAlly(source)) return;`      an ally's KO does nothing
 *       `if (effect.effectType === 'Move' && !effect.flags['futuremove'])`  ONLY a move, never chip
 *     onBeforeMovePriority: -1, onBeforeMove: strips the volatile unless the move IS destinybond.
 *       So the window runs from the click to the user's NEXT MOVE — across the turn boundary.
 *     onPrepareHit: `return !pokemon.removeVolatile('destinybond')` — consecutive use FAILS.
 *
 *   data/conditions.ts:439-462 stall — NO Champions override.
 *     duration 2, counter starts 3, `counter *= 3` while `counter < counterMax` (729),
 *     `randomChance(1, counter)`, and `if (!success) delete pokemon.volatiles['stall']`.
 *
 * EVERY SCENARIO PRINTS THE OUTCOME OF BOTH ENGINES SIDE BY SIDE. It asserts nothing and exits 0
 * whatever it finds — it is a measurement, not a gate.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

/* ---- THE RULES, RE-DERIVED ---------------------------------------------------------------------- */
console.log('\n  === THE AUTHORITY, RE-DERIVED THIS RUN ===');
{
  const db = dex.moves.get('destinybond');
  const cond = db.condition || {};
  console.log('  destinybond: accuracy=' + db.accuracy + ' priority=' + db.priority
    + ' volatileStatus=' + db.volatileStatus + ' isNonstandard=' + db.isNonstandard
    + ' noCopy=' + !!cond.noCopy + ' onBeforeMovePriority=' + cond.onBeforeMovePriority);
  const st = dex.conditions.get('stall');
  console.log('  stall:       duration=' + st.duration + ' counterMax=' + st.counterMax
    + '  (onStart counter=3, onRestart counter*=3, randomChance(1,counter))');
  /* THE LEGAL MEMBER SET, DERIVED BY CARRIER — never by remembering which shields exist. */
  const legal = x => x.exists && !x.isNonstandard;
  const stallers = dex.moves.all().filter(m => m.stallingMove);
  const sp = dex.species.all().filter(x => x.exists && !x.isNonstandard && x.tier !== 'Illegal');
  const carriers = id => sp.filter(s => { const l = dex.species.getLearnsetData(s.id); return l && l.learnset && l.learnset[id]; }).length;
  console.log('  stallingMove in the dex: ' + stallers.map(m => m.id + (legal(m) ? '' : '[' + m.isNonstandard + ']')).join(' '));
  console.log('  LEGAL members, with a legal carrier count: '
    + stallers.filter(legal).map(m => m.id + '(' + carriers(m.id) + ')').join(' '));
}

/* ---- THE FIXTURE -------------------------------------------------------------------------------- */
const FILLER = ['clefable', 'milotic', 'corviknight'];
const bench = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));
const mon = (species, moves, extra) => Object.assign({ species, item: '', ability: '', moves }, extra || {});

/* A LEGAL DESTINY BOND CARRIER THAT CAN BE POISONED, AND THAT HAS AN INERT CLICK — all derived.
 *   not Poison / not Steel   the chip arm needs the bond holder to die to TOXIC residual damage
 *   learns Protect           the stall scenarios click it
 *   learns an INERT move     THE RAMP TURNS CANNOT BE PROTECT. The first version of this file had
 *                            the bond holder click Protect on the turn Toxic was aimed at it, so the
 *                            shield blocked the poison and the ramp reported "never killed" — a
 *                            verdict about the script, dressed as a fact about the fixture. */
const INERT_CANDIDATES = ['recycle', 'nastyplot', 'swordsdance', 'calmmind', 'workup', 'howl', 'growth'];
function dbCarrier() {
  const sp = dex.species.all().filter(x => x.exists && !x.isNonstandard && x.tier !== 'Illegal')
    .filter(s => !s.forme || !/mega/i.test(s.forme));
  for (const s of sp) {
    if ((s.types || []).includes('Poison') || (s.types || []).includes('Steel')) continue;
    const l = dex.species.getLearnsetData(s.id);
    if (!(l && l.learnset && l.learnset.destinybond && l.learnset.protect)) continue;
    const inert = INERT_CANDIDATES.find(m => l.learnset[m]);
    if (!inert) continue;
    return { s, inert };
  }
  return null;
}
const DBC = dbCarrier();
if (!DBC) { console.log('\n  NO LEGAL DESTINY BOND CARRIER - a claim about the fixture, not the mechanic.'); process.exit(0); }
const DBS = DBC.s, INERT = DBC.inert;

/* A TOXIC USER WITH A LETHAL CLICK, so the same body can supply both arms of the control. */
function toxicKiller() {
  const sp = dex.species.all().filter(x => x.exists && !x.isNonstandard && x.tier !== 'Illegal')
    .filter(s => !s.forme || !/mega/i.test(s.forme));
  let best = null;
  for (const s of sp) {
    const l = dex.species.getLearnsetData(s.id);
    if (!(l && l.learnset && l.learnset.toxic && l.learnset.recycle)) continue;
    const strong = ['earthquake', 'closecombat', 'flareblitz', 'bodyslam', 'crunch', 'shadowball', 'darkpulse']
      .find(m => l.learnset[m]);
    if (!strong) continue;
    if (!best || s.baseStats.atk + s.baseStats.spa > best.s.baseStats.atk + best.s.baseStats.spa) best = { s, strong };
  }
  return best;
}
const TK = toxicKiller();
if (!TK) { console.log('\n  NO TOXIC+RECYCLE+ATTACK CARRIER — a claim about the fixture.'); process.exit(0); }
console.log('\n  fixture: bond holder ' + DBS.name + ' (' + DBS.types.join('/') + ', spe '
  + DBS.baseStats.spe + ', inert click ' + INERT + ')   killer ' + TK.s.name + ' (spe ' + TK.s.baseStats.spe + ', click ' + TK.strong + ')');

/* IN DOUBLES BOTH SLOTS MUST ACT. A script step that names only slot 0 makes the driver `pass` in
 * slot 1, and Showdown REJECTS a pass from a healthy body — the whole game dies at turn 1 with a
 * board that measured nothing. Every step below is built through this helper so the partner always
 * carries a click. (Found the hard way: the first run of this file threw
 * "Can't pass: Your Clefable must make a move" on all six scenarios and reported six empty tables.) */
const step = (p1m, p2m, p2t) => ({ p1: [{ m: p1m }, { m: 'protect' }],
                                   p2: [p2t == null ? { m: p2m } : { m: p2m, t: p2t }, { m: 'protect' }] });

/* ---- THE READER --------------------------------------------------------------------------------
 * BODIES ARE FOUND BY SPECIES, NEVER BY SLOT. The whole point of the chip arm is that a body FAINTS,
 * and a fainted body is replaced — so an active-slot reader would report the REPLACEMENT's HP and
 * `fainted: false`, which reads exactly like "the killer survived". That is the difference between
 * measuring the mechanic and measuring who happens to be standing.
 * `id()` is the project's own normaliser; medicham2 names a body `.name` and Showdown `.species.id`. */
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const findMedi = (sf, spId) => ((sf && sf.team) || []).find(m => m && norm(m.name) === spId) || null;
const findSd = (side, spId) => (side.pokemon || []).find(p => p && norm(p.species && p.species.id) === spId) || null;

function run(tag, p1sheet, p2sheet, script, holderId, killerId) {
  const a = G.buildPair(p1sheet), b = G.buildPair(p2sheet);
  if (!a || !b) return { tag, err: 'COULD NOT BUILD THE PAIR' };
  const rows = [];
  const r = G.playGame(a, b, 'directed', 'dbstall/' + tag, {
    script,
    onBoundary: (snap, turnIdx, S, battle) => {
      const mH = findMedi(S.sfA, holderId), mK = findMedi(S.sfB, killerId);
      const sH = findSd(battle.sides[0], holderId), sK = findSd(battle.sides[1], killerId);
      const sv = (p, k) => (p && p.volatiles && p.volatiles[k]) || null;
      rows.push({
        t: turnIdx,
        mediBond: mH ? ((mH._vol && mH._vol.destinybond) ? 1 : 0) : -1,
        sdBond: sH ? (sv(sH, 'destinybond') ? 1 : 0) : -1,
        mediStall: mH ? (mH.tookProtectTurns | 0) : -1,
        sdStall: sH ? (sv(sH, 'stall') ? sv(sH, 'stall').counter : 0) : -1,
        sdStallDur: sH ? (sv(sH, 'stall') ? sv(sH, 'stall').duration : 0) : -1,
        mediHP: mH ? Math.max(0, mH.curHP) : -1, sdHP: sH ? Math.max(0, sH.hp) : -1,
        mediHolderKO: mH ? !!mH.fainted : null, sdHolderKO: sH ? !!sH.fainted : null,
        mediKillerHP: mK ? Math.max(0, mK.curHP) : -1, sdKillerHP: sK ? Math.max(0, sK.hp) : -1,
        mediKillerKO: mK ? !!mK.fainted : null, sdKillerKO: sK ? !!sK.fainted : null,
      });
    },
  });
  return { tag, rows, err: r.err, trace: r.trace || [] };
}

function show(res, cols) {
  if (res.err) { console.log('    [game ended: ' + res.err + ']'); }
  if (!res.rows || !res.rows.length) { console.log('    NO BOUNDARY TAKEN'); return; }
  console.log('    ' + cols.map(c => c[0]).join('  '));
  for (const r of res.rows) console.log('    ' + cols.map(c => String(c[1](r)).padEnd(c[0].length)).join('  '));
}
/* THE VERDICT LINE IS THE OUTCOME, NOT THE CLASSIFICATION: did the killer die, on each engine. */
function verdict(res, expectKillerDead) {
  const r = res.rows && res.rows[res.rows.length - 1];
  if (!r) return '    NO BOARD TO JUDGE';
  const w = (ko, hp) => (ko ? 'KILLER FAINTED' : 'killer alive (' + hp + ' hp)');
  const ok = e => (e === !!expectKillerDead);
  return '    medicham2: ' + w(r.mediKillerKO, r.mediKillerHP) + (ok(r.mediKillerKO) ? '   [as the authority requires]' : '   <-- WRONG')
       + '\n    showdown : ' + w(r.sdKillerKO, r.sdKillerHP) + (ok(r.sdKillerKO) ? '   [as the authority requires]' : '   <-- WRONG');
}

const BONDCOLS = [
  ['turn ', r => 'b' + r.t + '   '],
  ['medi_bond', r => r.mediBond],
  ['sd_bond  ', r => r.sdBond],
  ['holder_hp_me', r => r.mediHP],
  ['holder_hp_sd', r => r.sdHP],
  ['killer_hp_me', r => r.mediKillerHP],
  ['killer_hp_sd', r => r.sdKillerHP],
  ['killer_ko_me', r => r.mediKillerKO],
  ['killer_ko_sd', r => r.sdKillerKO],
];
const STALLCOLS = [
  ['turn ', r => 'b' + r.t + '   '],
  ['medi_n', r => r.mediStall],
  ['3^n  ', r => (r.mediStall > 0 ? Math.pow(3, r.mediStall) : 0)],
  ['sd_counter', r => r.sdStall],
  ['sd_dur', r => r.sdStallDur],
];
const HOLDER = norm(DBS.id), KILLER = norm(TK.s.id);

/* ================= DESTINY BOND ================================================================= */
console.log('\n  === DESTINY BOND ===');

const P1 = [mon(DBS.name, ['Destiny Bond', 'Protect', dex.moves.get(INERT).name])].concat(bench(...FILLER));
const P2 = [mon(TK.s.name, [dex.moves.get(TK.strong).name, 'Toxic', 'Recycle', 'Protect'])].concat(bench(...FILLER));

/* A0 - THE RAMP, MEASURED RATHER THAN COMPUTED. The chip arm needs the turn on which the badly-
 * poisoned residual is LETHAL, and that turn is a function of this body's HP, the toxic stage and
 * the pinned dice. It is found by playing the ramp with no Destiny Bond in it and reading the first
 * boundary where the bond holder is dead. A number typed here would be a guess about a fixture. */
let TDEATH = 0;
{
  const script = [step(INERT, 'toxic', 0)];
  for (let i = 0; i < 10; i++) script.push(step(INERT, 'recycle'));
  const res = run('a0-ramp', P1, P2, script, HOLDER, KILLER);
  console.log('\n  A0  the toxic ramp, no bond - finding the turn the residual is lethal');
  show(res, [['turn ', r => 'b' + r.t + '   '], ['holder_hp_me', r => r.mediHP],
             ['holder_hp_sd', r => r.sdHP], ['holder_ko_me', r => r.mediHolderKO],
             ['holder_ko_sd', r => r.sdHolderKO]]);
  const d = (res.rows || []).find(r => r.mediHolderKO || r.sdHolderKO);
  /* `b0` IS THE LEAD-IN BOARD, NOT THE END OF TURN 1, so the row index IS the turn number. This was
   * off by one in the first version and it cost three scenarios: TDEATH came out one turn LATE, the
   * varied step landed on a turn the game never reached, and A1/A2/A3 printed BYTE-IDENTICAL tables.
   * Identical results across a varied knob mean the knob is unwired -- and here the unwired knob was
   * the PROBE'S, which is the failure ENGINE's brief names first. Proved rather than assumed: a
   * three-turn script above yields FOUR rows, and A4's bond appears at b1 for a turn-1 click. */
  TDEATH = d ? d.t : -1;
  console.log('    lethal residual on TURN ' + TDEATH + ' (boundary b' + TDEATH + '; b0 is the lead-in board)');
}
if (TDEATH < 1) { console.log('\n  THE RAMP NEVER KILLED - a claim about the fixture, not the mechanic.'); process.exit(0); }

/* THE SCRIPT STOPS ON THE DEATH TURN. A step past it needs a replacement choice this driver does not
 * script, and the run then reports THREW - which reads as a broken engine and is a finished game. */
function chipScript(lastStep) {
  const sc = [step(INERT, 'toxic', 0)];
  while (sc.length < TDEATH) sc.push(step(INERT, 'recycle'));
  sc[TDEATH - 1] = lastStep;
  return sc;
}

/* A1 - WILL'S FIXTURE. Bond up, and the holder dies to BADLY-POISONED RESIDUAL DAMAGE.
 * `effect.effectType === 'Move'` is the whole condition, so the killer MUST SURVIVE. */
{
  console.log('\n  A1  bond up, killed by TOXIC RESIDUAL -> the killer MUST SURVIVE (Will\'s fixture)');
  const res = run('a1-chip-ko', P1, P2, chipScript(step('destinybond', 'recycle')), HOLDER, KILLER);
  show(res, BONDCOLS);
  console.log(verdict(res, false));
}

/* A2 - THE CONTROL, IMMUNE FOR EXACTLY ONE REASON. Byte-identical to A1 except that on the lethal
 * turn the killer CLICKS instead of using its inert move, so the KO arrives from a MOVE and beats
 * the residual to it. The killer MUST faint. Identical results across these two arms would mean the
 * knob is unwired, not that the distinction does not matter. */
{
  console.log('\n  A2  the same board, killed BY A MOVE -> the killer MUST faint');
  const res = run('a2-move-ko', P1, P2, chipScript(step('destinybond', TK.strong, 0)), HOLDER, KILLER);
  show(res, BONDCOLS);
  console.log(verdict(res, true));
}

/* A3 - THE THIRD ARM OF THE SAME CONTROL: killed by a MOVE with NO BOND UP. If A2's killer dies here
 * too, A2 proves nothing about Destiny Bond. */
{
  console.log('\n  A3  killed by a MOVE with NO bond -> the killer MUST SURVIVE');
  const res = run('a3-move-no-bond', P1, P2, chipScript(step(INERT, TK.strong, 0)), HOLDER, KILLER);
  show(res, BONDCOLS);
  console.log(verdict(res, false));
}

/* A4 - THE WINDOW CROSSES THE TURN BOUNDARY. Click Destiny Bond on turn 1, then MOVE on turn 2:
 * `onBeforeMove` at priority -1 strips it BEFORE the attack. Read at the boundary of turn 2. */
{
  const script = [step('destinybond', 'recycle'), step(INERT, 'recycle'), step(INERT, 'recycle')];
  console.log('\n  A4  bond on turn 1, the user MOVES on turn 2 -> the bond must be GONE at b1');
  show(run('a4-stripped', P1, P2, script, HOLDER, KILLER), BONDCOLS);
}

/* A5 - CONSECUTIVE USE FAILS. `onPrepareHit` returns `!pokemon.removeVolatile('destinybond')`, so a
 * second Destiny Bond in a row refuses AND removes the first one: NO bond on either engine at b1. */
{
  const script = [step('destinybond', 'recycle'), step('destinybond', 'recycle'), step(INERT, 'recycle')];
  console.log('\n  A5  Destiny Bond twice in a row -> the SECOND fails and leaves no bond at b1');
  show(run('a5-consecutive', P1, P2, script, HOLDER, KILLER), BONDCOLS);
}

/* ================= THE STALL COUNTER ============================================================ */
console.log('\n  === THE STALL COUNTER ===');
console.log('  medicham2 holds tookProtectTurns (a count UP). Showdown holds stall.counter (a');
console.log('  DENOMINATOR) and a DURATION. The claim under test is whether 3^n predicts the counter.');

/* B1 - FIVE CONSECUTIVE PROTECTS. Every roll must be won for the counter to climb, so this prints
 * whatever the pinned dice give rather than asserting a climb. */
{
  const script = [];
  for (let i = 0; i < 5; i++) script.push(step('protect', 'recycle'));
  console.log('\n  B1  five consecutive Protects');
  show(run('b1-consecutive', P1, P2, script, HOLDER, KILLER), STALLCOLS);
}

/* B2 - THE SKIPPED TURN. This is where the two representations can genuinely part: Showdown's
 * volatile carries `duration: 2` and expires at a RESIDUAL, medicham2 zeroes `tookProtectTurns` in
 * the top-of-turn pre-pass. Same outcome next turn, possibly a different board AT THE BOUNDARY. */
{
  const script = [step('protect', 'recycle'), step(INERT, 'recycle'),
                  step('protect', 'recycle'), step(INERT, 'recycle'), step(INERT, 'recycle')];
  console.log('\n  B2  Protect, then a non-shield turn, then Protect again, then two idle turns');
  show(run('b2-skip', P1, P2, script, HOLDER, KILLER), STALLCOLS);
}

console.log('\n  Nothing above is asserted. This prints what both engines hold so a leaf is wired');
console.log('  against a measured shape rather than an assumed one.\n');
