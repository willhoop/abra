#!/usr/bin/env node
/* tests/probe_kingsrock_volley.js — IS THE KING'S ROCK DIE TAKEN PER CLICK, OR PER LANDED ARRIVAL?
 *   node tests/probe_kingsrock_volley.js          the clean arm
 *   node tests/probe_kingsrock_volley.js --red    under MEDI_KINGSROCK_ONCE_PER_MOVE=1
 * ==================================================================================================
 *
 * WILL ASKED whether King's Rock is a "super flinch machine" on a multi-hit move. The whole answer
 * is how many times the 10% die is taken, and nothing in this repository tested it: WIRE 103's own
 * comment says its carriers "measure within sampling error of pFlinch x accuracy over 2,000 staged
 * turns", and every one of those turns is an ORDINARY move. A volley was never staged.
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 * The item runs NO handler at hit time. It pushes a secondary and leaves:
 *
 *     data/items.ts:3212-3224   kingsrock
 *       onModifyMovePriority: -1,
 *       onModifyMove(move) {
 *         if (move.category !== "Status") {
 *           if (!move.secondaries) move.secondaries = [];
 *           for (const secondary of move.secondaries) {
 *             if (secondary.volatileStatus === 'flinch') return;      // <- the no-stacking clause
 *           }
 *           move.secondaries.push({ chance: 10, volatileStatus: 'flinch' });
 *         }
 *       }
 *
 * and `grep kingsrock data/mods/champions/items.ts` returns NOTHING, so Champions does not touch it.
 *
 * The die is therefore drawn wherever every other secondary is drawn:
 *
 *     sim/battle-actions.ts:1336-1351   secondaries(targets, source, move, moveData, isSelf)
 *       for (const target of targets) {
 *         if (target === false) continue;
 *         const secondaries = this.battle.runEvent('ModifySecondaries', ...);
 *         for (const secondary of secondaries) {
 *           const secondaryRoll = this.battle.random(100);            // <- ONE DIE PER SECONDARY
 *
 * and `secondaries` is step 5 of `spreadMoveHit` (the CHAMPIONS override,
 * data/mods/champions/scripts.ts:388), which `hitStepMoveHitLoop` calls once per hit (:518) under
 * the loop guard that is this probe's second question (:461-464):
 *
 *     for (hit = 1; hit <= targetHits; hit++) {
 *       if (damage.includes(false)) break;
 *       if (hit > 1 && pokemon.status === 'slp' && ...) break;
 *       if (targets.every(target => !target?.hp)) break;              // <- no arrival against a corpse
 *
 * SO THE ANSWER IS: ONE DIE PER ARRIVAL THAT LANDED. Never per arrival the volley DREW. The same
 * `hit` counter is written out as `-hitcount` (`hit - 1`, :550), which is why this file can read the
 * landed count off both protocol streams instead of typing one.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * medicham2 wraps the whole step list once per MOVE (`_STEPS` at :34049) and keeps the arrivals
 * inside `_stepApply`'s packet loop, so `_stepEffects` — and WIRE 103 with it — ran ONCE per click.
 * A Population Bomb flinched on 10% where the real game flinches on 1 - 0.9^n. That is not a rounding
 * error: it is the difference between a 10% item and a 40-65% one on the exact boards people build it
 * for. THE POPULATION IS REAL — 82 of 211 King's Rock sheet entries in the store carry a multi-hit
 * move, and Population Bomb is the single commonest of them.
 *
 * NO MULTI-HIT MOVE IN THIS FORMAT CARRIES A SECONDARY OF ITS OWN — derived on every run below, all
 * 14 of them `secondaries: null` — so King's Rock is the ONLY way the authority's per-hit secondary
 * loop is observable here at all. That is why this is its own knob and not the standing once-per-move
 * wrap (tests/test-resolution-order.js's KNOWN-OPEN arm).
 *
 * ================= HOW IT IS MEASURED, AND WHY NOT BY RATE ======================================
 *
 * A 10% outcome over a handful of arrivals is noise, so NOTHING here counts flinches. Both engines
 * are asked how many times they TOOK THE DIE:
 *
 *   - the AUTHORITY is instrumented at `BattleActions.prototype.secondaries` — the exact function
 *     above — and the King's-Rock-shaped entry is counted per living target per call. Champions does
 *     not override `secondaries`, so the prototype is the live path (asserted below: the instrument
 *     must see a non-zero count on the arms that have one, or the file refuses to report).
 *   - MEDICHAM2 counts at the draw site, `MEDSEEN.kingsRockRolls`.
 *
 * and the landed-arrival count is read off `|-hitcount|` in BOTH streams, so the premise "the two
 * engines played the same length of volley" is asserted rather than assumed.
 *
 * ================= THE CONTROLS, WHICH ARE THE POINT ============================================
 *
 *   single-hit    the same holder, a single-hit move. BOTH engines must take exactly ONE die. A fix
 *                 that multiplied the roll by anything at all fails here.
 *   no-item       the same volley with the item gone. ZERO on both — otherwise the counter is
 *                 counting something that is not King's Rock.
 *   own-flinch    a move that already flinches. The authority's no-stacking clause adds NOTHING, so
 *                 the King's Rock count is ZERO while the MOVE's own flinch secondary is still rolled
 *                 once. Asserted on both halves.
 *   aimed-status  a status move aimed at a foe. `move.category !== "Status"` refuses the push, so
 *                 zero — the over-fire control for a fix that keys on "the holder attacked".
 *
 * and the KILL arm answers the drawn-versus-landed half on the authority itself: the volley draws ten
 * and lands fewer, and the authority's die count follows the LANDED number.
 */
'use strict';

/* THE KNOB IS SET BEFORE `game_differential.js` IS REQUIRED — it loads the engine at ITS require
 * time, so a knob set after that line comes back green on every arm, which is the signature of an
 * unwired knob and has been this repository's bug at least twice. */
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_KINGSROCK_ONCE_PER_MOVE = '1';
/* ONE TURN. Everything measured happens on turn 1; a second turn would let a flinch that landed in
 * one engine and not the other decide the next turn's board. */
if (!process.argv.includes('--turns')) process.argv.splice(2, 0, '--turns', '1');

const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const M = ER.open().require('engine/medicham2-browser.js');
const CS = require(D('engine', 'champions_sim.js'));
const NL = String.fromCharCode(10);

const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

/* ---- THE AUTHORITY'S OWN DIE, INSTRUMENTED ------------------------------------------------------
 * Counting `secondaries` calls alone would be wrong: it is called once per hit for ANY move with a
 * secondary, King's Rock or not. What is counted is the King's-Rock-SHAPED entry — the exact object
 * the item pushes — per living target, which is one `battle.random(100)` each. */
const BA = require(process.env.SHOWDOWN_PATH + '/dist/sim/battle-actions').BattleActions;
const SD = { kr: 0, other: 0, calls: 0, shapes: [] };
const _origSecondaries = BA.prototype.secondaries;
BA.prototype.secondaries = function (targets, source, move, moveData, isSelf) {
  const secs = (moveData && moveData.secondaries) || [];
  let live = 0;
  for (const t of targets) if (t !== false && t !== null && t !== undefined) live++;
  let kr = 0;
  for (const s of secs) if (s && s.volatileStatus === 'flinch' && s.chance === 10) kr++;
  SD.calls++;
  SD.kr += kr * live;
  SD.other += (secs.length - kr) * live;
  SD.shapes.push((move && move.id) + '#' + (move && move.hit) + ' ' + JSON.stringify(secs) + ' x' + live);
  return _origSecondaries.call(this, targets, source, move, moveData, isSelf);
};

/* ---- DERIVED FACTS, PRINTED, NEVER TYPED -------------------------------------------------------- */
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
{
  const kr = dex.items.get('kingsrock');
  const mh = dex.moves.all().filter(m => legal(m) && m.multihit);
  const withSec = mh.filter(m => (m.secondaries && m.secondaries.length) || m.secondary);
  console.log("King's Rock isNonstandard = " + kr.isNonstandard
    + '   (null = legal here)   Champions override: '
    + (/kingsrock/.test(require('fs').readFileSync(
        process.env.SHOWDOWN_PATH + '/data/mods/champions/items.ts', 'utf8')) ? 'YES' : 'NONE'));
  console.log('legal multiHit moves in this format: ' + mh.length
    + ';  of those carrying a secondary of their own: ' + withSec.length
    + (withSec.length ? '  -> ' + withSec.map(m => m.id).join(' ') : '  (so the item is the only road)'));
  const flinchers = dex.moves.all().filter(m => legal(m)
    && [].concat(m.secondaries || m.secondary || []).some(s => s && s.volatileStatus === 'flinch'));
  console.log('legal moves carrying their OWN flinch secondary (the no-stacking population): '
    + flinchers.length);
}

/* ---- THE FIXTURE -------------------------------------------------------------------------------- */
const KR = "King's Rock";
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const BENCH = (...n) => n.map(s => mon(s, '', '', ['Protect']));

/* every attacker is FASTER than its target, so a flinch that lands is a flinch that mattered — the
 * probe does not read outcomes, but a fixture where the die could not have mattered is not a fixture
 * for this question. Speeds are asserted below off the dex rather than stated here. */
const TALON = it => mon('talonflame', it, 'Gale Wings', ['Dual Wingbeat', 'Brave Bird', 'Air Slash', 'Taunt']);
const MAUS = it => mon('maushold', it, 'Technician', ['Population Bomb', 'Protect']);
/* Icicle Spear is 2-5 with 100% accuracy and NO multiaccuracy, so every arrival the count draws
 * lands — the second road to a volley, and the one whose LENGTH is itself a die on both engines.
 * (Population Bomb is 90/multiaccuracy: on this seed its per-hit accuracy broke the loop at hit 2,
 * which is a fine thing for the KILL arm below and useless for a survivor arm.) */
const MAMO = it => mon('mamoswine', it, 'Oblivious', ['Icicle Spear', 'Protect']);
const MILO = mon('milotic', '', 'Marvel Scale', ['Scald', 'Protect']);
const CORV = mon('corviknight', '', 'Pressure', ['Iron Head', 'Protect']);
/* THE KILL ARM'S TARGET IS SOFTENED INSIDE THE SAME TURN, by the holder's FASTER ally, so nothing
 * crosses a turn boundary and no flinch that landed in one engine can decide the next board.
 * Sharpedo was the first choice and Brave Bird KILLED IT OUTRIGHT — the volley then had no target
 * and the authority took no die at all, which read as an instrument failure and was the fixture. */
const KILLED = mon('heracross', '', 'Guts', ['Close Combat', 'Protect']);
/* Flame Body, not Gale Wings: Gale Wings would give the volley +1 priority and it would land BEFORE
 * the softener, which is the opposite of what this arm needs. */
const TALON_SLOW = it => mon('talonflame', it, 'Flame Body', ['Dual Wingbeat', 'Protect']);
const SOFTENER = mon('dragapult', '', 'Infiltrator', ['Thunderbolt', 'Protect']);
/* Maushold's partner needs a Protect of its own — Talonflame's four slots are the four moves the
 * arms above click, so pairing it here rejected the choice outright. */
const MAUS_ALLY = mon('milotic', '', 'Marvel Scale', ['Protect']);

const P = { m: 'protect' };
const foeClick = { m: 'scald', t: 0 };

const CASES = [
  { id: 'volley-2', live: true, want: 2, krExpected: true,
    name: 'LIVE      King’s Rock + a FIXED two-arrival volley into a survivor',
    what: 'Dual Wingbeat is `multihit: 2` with no multiaccuracy, so the arrival count is not a die on '
        + 'either engine. The authority takes TWO dice; this engine took ONE.',
    A: [MILO, mon('clefable', '', 'Unaware', ['Protect'])], B: [TALON(KR), CORV],
    p1: [foeClick, P], p2: [{ m: 'dualwingbeat', t: 0 }, P] },

  { id: 'volley-2to5', live: true, want: null, krExpected: true, minArrivals: 2,
    name: 'LIVE      King’s Rock + a 2-5 volley whose LENGTH is a die, into a survivor',
    what: 'The second road, and a different shape from the arm above: the arrival count is drawn '
        + 'rather than declared, so the die count has to follow a number neither engine was told. '
        + 'Icicle Spear is 100% accurate with no multiaccuracy, so every arrival the count draws '
        + 'lands; Corviknight is Flying/Steel, which makes Ice neutral and lets it live through all '
        + 'of them. Nothing is typed — the expectation is whatever `-hitcount` says.',
    A: [CORV, mon('clefable', '', 'Unaware', ['Protect'])], B: [MAMO(KR), MAUS_ALLY],
    p1: [{ m: 'ironhead', t: 0 }, P], p2: [{ m: 'iciclespear', t: 0 }, P] },

  { id: 'kill', live: true, want: null, krExpected: true, kill: true,
    name: 'LIVE      the volley that KILLS before its last arrival',
    what: 'The drawn-versus-landed half. The authority breaks the hit loop above an arrival against a '
        + 'body already on zero, so it takes FEWER dice than the volley drew — and `-hitcount` is the '
        + 'same number. medicham2 takes NONE here (the row is fainted by the time its once-per-move '
        + 'effects step runs); that is the DECLARED REMAINDER, asserted by counter below, and it '
        + 'cannot reach a board because a flinch on a corpse is refused by `addVolatile`.',
    A: [KILLED, mon('clefable', '', 'Unaware', ['Protect'])],
    B: [TALON_SLOW(KR), SOFTENER],
    p1: [{ m: 'closecombat', t: 0 }, P], p2: [{ m: 'dualwingbeat', t: 0 }, { m: 'thunderbolt', t: 0 }] },

  { id: 'single-hit', live: false, want: 1, krExpected: true,
    name: 'CONTROL   King’s Rock + a SINGLE-hit move',
    what: 'ONE die on both engines, before and after. A fix that multiplied the roll by anything at '
        + 'all — the hit count, the packet vector length, a constant — fails here.',
    A: [MILO, mon('clefable', '', 'Unaware', ['Protect'])], B: [TALON(KR), CORV],
    p1: [foeClick, P], p2: [{ m: 'bravebird', t: 0 }, P] },

  { id: 'no-item', live: false, want: 0, krExpected: false,
    name: 'CONTROL   the SAME volley with the item gone',
    what: 'Zero on both engines. Without this the arms above are satisfied by a counter that is '
        + 'counting arrivals rather than King’s Rock dice.',
    A: [MILO, mon('clefable', '', 'Unaware', ['Protect'])], B: [TALON(''), CORV],
    p1: [foeClick, P], p2: [{ m: 'dualwingbeat', t: 0 }, P] },

  { id: 'own-flinch', live: false, want: 0, krExpected: false, otherSecMin: 1,
    name: 'CONTROL   a move that ALREADY flinches',
    what: 'The no-stacking clause. `onModifyMove` returns without pushing when any of the move’s '
        + 'own secondaries is a flinch, so the King’s Rock count is ZERO — while the move’s '
        + 'OWN flinch secondary is still rolled. Both halves asserted, so "zero" cannot be satisfied '
        + 'by an arm where no secondary was rolled at all.',
    A: [MILO, mon('clefable', '', 'Unaware', ['Protect'])], B: [TALON(KR), CORV],
    p1: [foeClick, P], p2: [{ m: 'airslash', t: 0 }, P] },

  { id: 'aimed-status', live: false, want: 0, krExpected: false,
    name: 'CONTROL   a STATUS move aimed at a foe',
    what: '`if (move.category !== "Status")` refuses the push outright. Zero on both engines — the '
        + 'over-fire control for anything keyed on "the holder used a move".',
    A: [MILO, mon('clefable', '', 'Unaware', ['Protect'])], B: [TALON(KR), CORV],
    p1: [foeClick, P], p2: [{ m: 'taunt', t: 0 }, P] },
];

/* ---- THE FIXTURE'S OWN LEGALITY, DERIVED -------------------------------------------------------- */
{
  let bad = 0;
  const seen = new Set();
  for (const c of CASES) for (const row of c.A.concat(c.B)) {
    const key = row.species + '|' + row.ability + '|' + row.moves.join(',');
    if (seen.has(key)) continue; seen.add(key);
    const sp = dex.species.get(row.species);
    if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); bad++; continue; }
    if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
      .includes(dex.abilities.get(row.ability).id)) {
      console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); bad++;
    }
    for (const mv of row.moves) {
      if (!legal(dex.moves.get(mv))) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); bad++; continue; }
      if (!CS.canLearn(row.species, dex.moves.get(mv).id)) {
        console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + dex.moves.get(mv).name); bad++;
      }
    }
    if (row.item && !legal(dex.items.get(row.item))) {
      console.log('ILLEGAL FIXTURE  ' + row.item + ' is not in this format'); bad++;
    }
  }
  if (bad) { console.log(NL + 'NOT RUN — ' + bad + ' illegal fixture row(s). This is not a pass.'); process.exit(2); }
  console.log('fixture: every species, ability, move and item checked against the format — ' + seen.size + ' rows LEGAL');
}

/* ---- THE RUN ------------------------------------------------------------------------------------ */
let fails = 0;
const claim = (ok, what, detail) => {
  console.log('    ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '            ' + detail : ''));
  if (!ok) fails++;
};

/* HOW MANY ARRIVALS LANDED, read off the stream rather than off either engine's internals.
 * `-hitcount` is the authority's own `hit - 1`; a move with no `multihit` writes no line at all, so a
 * connected single hit is 1 and a move that reached nobody is 0. */
function arrivals(lines, side) {
  const L = lines.map(String);
  const hc = L.filter(x => x.indexOf('|-hitcount|') === 0);
  if (hc.length) return +hc[hc.length - 1].split('|').pop();
  return L.some(x => new RegExp('^\\|-damage\\|' + side).test(x) && x.indexOf('[from]') < 0) ? 1 : 0;
}
function turn1(lines) {
  const out = []; let on = false;
  for (const raw of lines) {
    const l = String(raw);
    if (/^\|turn\|1\b/.test(l)) { on = true; continue; }
    if (/^\|turn\|2\b/.test(l)) break;
    if (on) out.push(l);
  }
  return out;
}
/* Showdown's `|split|` pairs carry the same line twice (the private view then the public one); the
 * public half is what medicham2's trace is comparable to. */
function unsplit(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const l = String(log[i]);
    if (/^\|split\|/.test(l)) { if (log[i + 1] !== undefined) out.push(String(log[i + 1])); i += 2; continue; }
    out.push(l);
  }
  return out;
}

console.log(NL + (RED ? 'RED ARM — MEDI_KINGSROCK_ONCE_PER_MOVE=1 (the engine as it stood before the fix)'
                      : 'CLEAN ARM')
  + '   mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + NL);

let sawAuthorityDie = 0;
for (const c of CASES) {
  const a = G.buildPair(c.A.concat(BENCH('snorlax', 'toxapex')));
  const b = G.buildPair(c.B.concat(BENCH('garchomp', 'tyranitar')));
  console.log(NL + c.id + '   ' + c.name);
  console.log('    ' + c.what);
  if (!a || !b) { console.log('    NOT-STAGED  (this is not a pass)'); fails++; continue; }

  SD.kr = 0; SD.other = 0; SD.calls = 0; SD.shapes = [];
  const rolls0 = M.MEDSEEN.kingsRockRolls | 0;
  const skip0 = M.MEDSEEN.kingsRockRollSkippedOnKO | 0;
  const noCount0 = M.fails.kingsRockNoArrivalCount | 0;

  const r = G.playGame(a, b, 'directed', 'probe_kingsrock_volley :: ' + c.id,
    { script: [{ p1: c.p1, p2: c.p2 }], arm: ARM });
  if (r.err) { console.log('    THREW  ' + r.err); fails++; continue; }

  const sdL = turn1(unsplit((G.lastSdLog() || []).map(String)));
  const meL = turn1((r.mediTrace || []).map(String));
  const sdA = arrivals(sdL, 'p1a'), meA = arrivals(meL, 'p1a');
  const meRolls = (M.MEDSEEN.kingsRockRolls | 0) - rolls0;
  const meSkip = (M.MEDSEEN.kingsRockRollSkippedOnKO | 0) - skip0;
  const sdFaint = sdL.some(x => /^\|faint\|p1a/.test(x)), meFaint = meL.some(x => /^\|faint\|p1a/.test(x));

  console.log('    authority  arrivals ' + sdA + '   KING-ROCK DICE ' + SD.kr
    + '   other secondaries rolled ' + SD.other + '   faint ' + sdFaint);
  console.log('    medicham   arrivals ' + meA + '   KING-ROCK DICE ' + meRolls
    + '   skipped-on-KO ' + meSkip + '   faint ' + meFaint);
  console.log('    authority secondaries() calls: ' + SD.shapes.join('  |  '));
  sawAuthorityDie += SD.kr;

  /* THE PREMISE, ASSERTED — a fixture that did not do what the arm needs is not a result. */
  claim(sdA === meA, c.id + ' — PREMISE: both engines landed the SAME number of arrivals',
    'showdown ' + sdA + ', medicham ' + meA + (sdA === meA ? '' : '   — NOT COMPARABLE; the fixture, not the defect'));
  claim(c.krExpected ? SD.kr > 0 : SD.kr === 0,
    c.id + ' — PREMISE: the authority ' + (c.krExpected ? 'DID' : 'did NOT') + ' take a King’s Rock die',
    'instrumented count ' + SD.kr + (c.krExpected ? '   (zero would mean the instrument missed the path)' : ''));
  if (c.want !== null) {
    claim(SD.kr === c.want, c.id + ' — PREMISE: the authority took exactly ' + c.want + ' die/dice',
      'measured ' + SD.kr + '   (this arm is written for that number; a miss is the fixture)');
  }
  if (c.krExpected && !c.kill) {
    claim(SD.kr === sdA, c.id + ' — THE AUTHORITY DRAWS ONCE PER LANDED ARRIVAL',
      'dice ' + SD.kr + ' against `-hitcount` ' + sdA);
  }
  if (c.minArrivals) {
    claim(sdA >= c.minArrivals, c.id + ' — PREMISE: the volley really was a volley',
      '`-hitcount` ' + sdA + ', needed at least ' + c.minArrivals);
  }
  if (c.otherSecMin) {
    claim(SD.other >= c.otherSecMin, c.id + ' — the move’s OWN secondary was still rolled',
      'non-King’s-Rock secondary dice ' + SD.other + '   (zero here and "0 rock dice" proves nothing)');
  }

  /* THE CLAIM. */
  if (c.kill) {
    /* `multihit: 10` is DECLARED on the move, not drawn, so "landed fewer than ten AND the body
       died" is the corpse guard firing and not an accuracy break. Read off the dex, not typed. */
    const declared = +dex.moves.get(c.p2[0].m).multihit;
    claim(sdA > 0 && sdA < declared && sdFaint && meFaint,
      c.id + ' — the volley DECLARES ' + declared + ' arrivals, landed fewer, and the body died on '
      + 'both engines', 'landed ' + sdA + '/' + declared + ', showdown faint ' + sdFaint
      + ', medicham faint ' + meFaint);
    claim(SD.kr === sdA, c.id + ' — PER LANDED, NOT PER DRAWN: the authority took ' + sdA
      + ' dice for ' + sdA + ' landed arrivals of ' + declared + ' declared', 'dice ' + SD.kr
      + '   (per DRAWN would be ' + declared + ')');
    claim(meRolls === 0 && meSkip >= 1,
      c.id + ' — THE DECLARED REMAINDER, proven by counter and not by prose',
      'medicham dice ' + meRolls + ', MEDSEEN.kingsRockRollSkippedOnKO +' + meSkip
      + '   (a flinch on a corpse is refused by addVolatile, so this cannot reach a board)');
  } else {
    const agree = meRolls === SD.kr;
    const want = RED ? !c.live : true;
    claim(agree === want,
      c.id + ' — the two engines take the same number of King’s Rock dice'
        + (RED ? (c.live ? '  [--red: MUST PART]' : '  [--red: a control, MUST NOT move]') : ''),
      'showdown ' + SD.kr + ', medicham ' + meRolls
      + (agree === want ? '' : (RED && c.live ? '   — the knob did not reach the engine'
        : '   — ' + (agree ? 'unexpected agreement' : 'they disagree'))));
  }
  claim((M.fails.kingsRockNoArrivalCount | 0) === noCount0,
    c.id + ' — no silent fallback: MEDFAILS.kingsRockNoArrivalCount did not move',
    'delta ' + ((M.fails.kingsRockNoArrivalCount | 0) - noCount0));
}

/* THE KNOB ITSELF, ASSERTED ON BOTH ARMS — a knob that reached no module reads as a held control. */
claim((M.fails.kingsRockOncePerMoveRestored | 0) === (RED ? 1 : 0),
  'the knob stamp is ' + (RED ? 'PRESENT under --red' : 'ABSENT on the clean arm'),
  'MEDFAILS.kingsRockOncePerMoveRestored = ' + (M.fails.kingsRockOncePerMoveRestored | 0));
claim(sawAuthorityDie > 0, 'the authority instrument saw King’s Rock dice at all',
  'total across every arm ' + sawAuthorityDie + '   (zero means the prototype patch missed the live path)');

console.log(NL + (fails ? 'RED — ' + fails + ' assertion(s) failed' : 'GREEN — every assertion held'));
process.exit(fails ? 1 : 0);
