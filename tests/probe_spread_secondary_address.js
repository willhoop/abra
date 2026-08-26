#!/usr/bin/env node
/* tests/probe_spread_secondary_address.js — DO THE TWO ENGINES ASK THE SAME QUESTION WHEN A SPREAD
 * MOVE ROLLS ITS SECONDARY?   node tests/probe_spread_secondary_address.js
 * ==================================================================================================
 *
 * WHAT THIS IS ABOUT, AND WHY IT IS NOT A MECHANIC PROBE
 *
 * The middle arm of `engine/game_differential.js` shares its dice by ADDRESS rather than by sequence:
 *
 *     value = FNV1a(seed | turn | category | move id | target slot | nth)  ->  [0,1)
 *
 * so both engines get the same number for the same EVENT no matter what order they take their draws
 * in. That is the arm's whole premise and `tests/test-middle-identity.js` measures how much of it
 * holds. The address is instrumentation: nothing outside `midEventDice` reads `MID_TGT`, so nothing
 * here can change a self-play game, a rollout or a census probe. What it CAN do is make two correct
 * engines look like they disagree — an address mismatch hands them different numbers for the same
 * roll, one burns and the other does not, and the differential reports a divergence that is entirely
 * the ruler's.
 *
 * THE AUTHORITY'S ADDRESS FOR A SECONDARY IS NOT THE TARGET BEING HIT, and that is the defect.
 * `BattleActions#secondaries` (sim/battle-actions.ts:1336-1351) loops the targets and never writes
 * `this.battle.activeTarget`. The last thing that did is `getSpreadDamage` (:1154), whose own loop
 * leaves it on the LAST surviving target of the spread. So on a two-target spread the authority
 * addresses BOTH rolls to the second body, separated only by `nth`. Worse, a secondary that FIRES
 * re-enters `moveHit` -> `spreadMoveHit` -> `getSpreadDamage`, which sets `activeTarget` to ITS
 * target — so the next roll is addressed to whichever body last took a secondary.
 *
 * medicham2 addressed each target's secondary to its own body. Measured before anything moved, one
 * staged turn each, Aerodactyl clicking into two healthy foes:
 *
 *     Rock Slide  (30%, neither fires)   showdown  p21|0  p21|1     medicham  p20|0  p21|0
 *     Icy Wind   (100%, both fire)       showdown  p21|0  p20|0     medicham  p20|0  p21|0
 *
 * NOTE THE SECOND ROW: the same two addresses, in the opposite ORDER. A set comparison calls that a
 * match and it is not one — the value that decides target A's secondary is being spent on target B.
 * That is why every claim below is an ORDERED sequence equality.
 *
 * NO TARGET FAINTS IN EITHER ROW ABOVE. The two board-material games this defect produced
 * (`|-status|p2a: Excadrill|brn` behind a Matcha Gotcha, `|cant|p2a: Metagross|flinch` behind a Rock
 * Slide) both had the OTHER target of the spread faint on the same hit, and the obvious theory was
 * that the faint was doing it. It is not: the mismatch is present with two healthy targets, and the
 * fainting arm below is carried only to show it is the SAME mismatch and not a second one.
 *
 * THE CONTROLS ARE THE POINT OF THE FILE. A one-target move and a two-target spread that only ONE
 * body survives to the damage step must MATCH — they matched before this was fixed and they must
 * still match after, because at one surviving target "its own body" and "the last body" are the same
 * slot. An arm that made every address agree by making them all constant would fail nothing here, so
 * the controls are what stops that.
 *
 * RED FIRST: MEDI_SEC_ADDR_PER_TARGET=1 restores the per-target address, i.e. the engine exactly as
 * it stood before this file existed. Run with `--red` to play every arm under it; the three spread
 * arms must PART and the two controls must NOT.
 * ================================================================================================ */
'use strict';
/* THE KNOB IS SET BEFORE ANY REQUIRE, AND IT WAS NOT ON THE FIRST TRY. `SEC_ADDR_PER_TARGET` is read
 * ONCE, at medicham2's module load, and medicham2 is loaded by `game_differential.js` at ITS require
 * time — so setting the env below that line left the engine holding the clean value and `--red` came
 * back GREEN on all five arms. That is the signature of an unwired knob and it was this file's bug,
 * not the engine's: identical output across a varied knob IS the finding, and the finding here was
 * that the knob had never been read. */
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_SEC_ADDR_PER_TARGET = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* BEFORE THE DRIVER, NEVER AFTER — `_live_release.js` wraps `cut`/`open` on the module object and
 * `game_differential.js` calls `cut()` at ITS require time. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
/* IT MUST BE THE INSTANCE THE DRIVER PLAYED. `game_differential.js` binds its engine with
 * `REL.require(...)`; a bare `require('engine/medicham2-browser.js')` is a SECOND module object whose
 * `MID_*` module fields nothing writes, and its log comes back empty — which reads exactly like an
 * engine that takes no secondary draws at all. */
const M = REL.require('engine/medicham2-browser.js');
const SDP = process.env.SHOWDOWN_PATH;
const BA = require(SDP + '/dist/sim/battle-actions');
const BattleActions = BA.BattleActions || BA.default || BA;
const BM = require(SDP + '/dist/sim/battle');
const Battle = BM.Battle || BM.default || BM;
const SEED = M.MID_EVENT_SEED;
const NL = String.fromCharCode(10);

/* ---- THE AUTHORITY'S HALF ------------------------------------------------------------------------
 * Hooked on `Battle.prototype`, not on the arm's `random`, for the reason test-middle-identity gives
 * at length: `Battle#random` is `return this.prng.random(m, n)`, so inside the arm's override `this`
 * is the PRNG and every address it could build there reads `undefined|-|-`. The category comes from
 * WHICH METHOD IS EXECUTING because the arguments cannot tell an accuracy roll from a secondary. */
let SD_CAT = 'any';
const around = (name, cat) => {
  const fn = BattleActions.prototype[name];
  if (typeof fn !== 'function') throw new Error('BattleActions#' + name + ' has moved — this hook is guessing');
  BattleActions.prototype[name] = function (...a) {
    const prev = SD_CAT; SD_CAT = cat;
    try { return fn.apply(this, a); } finally { SD_CAT = prev; }
  };
};
around('hitStepAccuracy', 'acc'); around('secondaries', 'sec'); around('getDamage', 'dmg');

let NTH = new Map(), LOG = [];
const addr = (cat, ctx) => {
  const mv = ctx && ctx.activeMove, tg = ctx && ctx.activeTarget;
  const base = [SEED, ctx ? ctx.turn : 0, cat,
                mv ? mv.id : '-', (tg && tg.side) ? (tg.side.id + tg.position) : '-'].join('|');
  const n = NTH.get(base) || 0; NTH.set(base, n + 1);
  LOG.push(base + '|' + n);
};
const oR = Battle.prototype.random, oC = Battle.prototype.randomChance, oS = Battle.prototype.sample;
Battle.prototype.random = function (m, n) {
  addr((SD_CAT === 'dmg' && n !== undefined) ? 'crit' : SD_CAT, this); return oR.call(this, m, n); };
Battle.prototype.randomChance = function (a, b) {
  addr((SD_CAT === 'dmg') ? 'crit' : SD_CAT, this); return oC.call(this, a, b); };
/* `PRNG#sample` takes a `random()` that does NOT pass through `Battle#random`. */
Battle.prototype.sample = function (it) { addr(SD_CAT, this); return oS.call(this, it); };

const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

/* ---- THE FIXTURE ---------------------------------------------------------------------------------
 * Nothing is typed from memory; every species, ability and move is checked against the format below
 * and the file refuses to run on an illegal one. */
const AERO = ['aerodactyl', '', 'Pressure', ['Rock Slide', 'Iron Head', 'Protect']];
const WEAV = ['weavile', '', 'Pressure', ['Icy Wind', 'Protect']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
const CHOMP = ['garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']];
const CORV = ['corviknight', '', 'Pressure', ['Iron Defense', 'Protect']];
/* Volcarona is Bug/Fire: Rock Slide is 4x, so the frail arm's KO is arithmetic rather than a lucky
 * roll — and the middle arm's damage die is shared, so both engines kill it on the same hit. */
const VOLC = ['volcarona', '', 'Flame Body', ['Quiver Dance', 'Protect']];

const PROT = { m: 'protect' };
const SD = { m: 'swordsdance' }, ID = { m: 'irondefense' }, QD = { m: 'quiverdance' };

const CASES = [
  { name: 'CONTROL  single-target Iron Head', spread: false,
    what: 'One body, one secondary roll. "Its own target" and "the last target" are the same slot, so '
        + 'this arm agreed before the fix and must still agree after it. It is the known-good case '
        + 'this probe has to be able to see.',
    A: [AERO, CLEF], B: [CHOMP, CORV],
    script: [{ p1: [{ m: 'ironhead', t: 0 }, PROT], p2: [SD, ID] }] },

  { name: 'CONTROL  spread whose SECOND body Protects', spread: false,
    what: 'Rock Slide at two foes with the second shielded. Protect drops it at hitStepTryHitEvent, '
        + 'four steps above the damage loop, so exactly one body reaches getSpreadDamage and the '
        + 'authority\'s activeTarget is that body. Carried because it is the arm a constant address '
        + 'would also pass — it pins that the fix did not simply stop naming the target.',
    A: [AERO, CLEF], B: [CHOMP, CORV],
    script: [{ p1: [{ m: 'rockslide' }, PROT], p2: [SD, PROT] }] },

  { name: 'SPREAD  Rock Slide, 30% secondary, NOBODY faints', spread: true,
    what: 'Two healthy bodies survive to the damage loop. The authority addresses both flinch rolls '
        + 'to the SECOND body and separates them with nth; medicham2 addressed each to its own. '
        + 'THIS ARM IS THE REFUTATION OF THE FAINTED-TARGET THEORY: no faint anywhere in it.',
    A: [AERO, CLEF], B: [CHOMP, CORV],
    script: [{ p1: [{ m: 'rockslide' }, PROT], p2: [SD, ID] }] },

  { name: 'SPREAD  Icy Wind, 100% secondary, BOTH fire', spread: true,
    what: 'The sharp one. Both rolls pass, so the authority re-enters moveHit after the first and '
        + 'getSpreadDamage moves activeTarget onto the FIRST body — the two addresses come out in the '
        + 'opposite order from medicham2\'s. Same multiset, different sequence, which is why every '
        + 'claim here is an ordered comparison.',
    A: [WEAV, CLEF], B: [CHOMP, CORV],
    script: [{ p1: [{ m: 'icywind' }, PROT], p2: [SD, ID] }] },

  { name: 'SPREAD  Rock Slide that KOs one of the two bodies', spread: true,
    what: 'The shape both board-material games actually had. A fainting target does not leave the '
        + 'authority\'s `targets` array — `secondaries` skips only `false` — so it still takes its '
        + 'roll and the addresses are the same shape as the healthy arm above. Carried to show this '
        + 'is ONE defect and not two.',
    A: [AERO, CLEF], B: [VOLC, CORV],
    script: [{ p1: [{ m: 'rockslide' }, PROT], p2: [QD, ID] }] },
];

/* ---- LEGALITY, DERIVED --------------------------------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row[2]); illegal++;
  }
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row[0], mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));

let fails = 0, ran = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

console.log((RED ? 'RED ARM — MEDI_SEC_ADDR_PER_TARGET=1 (the engine as it stood before the fix)'
                 : 'CLEAN ARM')
  + NL + 'the `sec` addresses each engine asked, in order' + NL);

for (const c of CASES) {
  NTH = new Map(); LOG = [];
  const a = G.buildPair(stage(c.A).concat(BENCH('milotic', 'incineroar')));
  const b = G.buildPair(stage(c.B).concat(BENCH('snorlax', 'toxapex')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_spread_secondary_address :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  ran++;
  const me = M.midEventLog().filter(x => x.split('|')[2] === 'sec');
  const sd = LOG.filter(x => x.split('|')[2] === 'sec');
  const koLines = r.mediTrace.filter(l => /^\|faint\|/.test(String(l))).length;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  ' + (sd.map(short).join('  ') || '(none)'));
  console.log('    medicham  ' + (me.map(short).join('  ') || '(none)'));
  console.log('    faints this turn: ' + koLines);

  /* A GREEN ARM THAT TOOK NO DRAWS TESTED NOTHING. Two of the five arms below were staged wrong on
   * the first attempt — both foes clicking Protect, so the spread never reached a body and both
   * engines logged an empty list, which compares EQUAL. Asserted before the equality, per arm. */
  claim(sd.length >= (c.spread ? 2 : 1) && me.length >= (c.spread ? 2 : 1),
    c.name + ' — the roll happened at all',
    'showdown took ' + sd.length + ' `sec` draws, medicham2 ' + me.length
      + (sd.length ? '' : '  — an empty list compares equal to an empty list and proves nothing'));
  if (c.name.indexOf('KOs one') >= 0) {
    claim(koLines >= 1, c.name + ' — a body really did faint',
      koLines + ' `|faint|` line(s); a zero here means this arm is a second copy of the healthy one');
  }
  /* UNDER `--red` THE SPREAD ARMS MUST PART AND THE CONTROLS MUST NOT — the same claim read the
   * other way round, so a knob that silently did nothing cannot pass this file. It could, once: the
   * env was set below the require that loads the engine and all five arms came back green. */
  const same = JSON.stringify(sd) === JSON.stringify(me);
  const want = RED ? !c.spread : true;
  claim(same === want,
    c.name + ' — the two engines name the same events, IN ORDER'
      + (RED ? (c.spread ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    same ? 'identical'
         : 'showdown ' + JSON.stringify(sd.map(short)) + '  vs  medicham ' + JSON.stringify(me.map(short)));
}

/* ---- THE ENGINE'S OWN RECEIPTS, AT EXACT EQUALITY -------------------------------------------------
 * A capability that cannot prove it ran is assumed broken, and this one is invisible from the outside
 * by design: `MID_TGT` changes nothing any other caller can see. So the arm is asserted from the
 * engine's own counters, both directions, never as `>= 0`.
 *   secAddrFromLastTarget   DRAWS taken at the last-target address. Three spread arms take two each
 *                           and the two controls take one each; a control's single draw is ALSO at
 *                           the last-target address, because with one surviving body that is its own
 *                           slot — 8 in total, and the number is what separates "the branch ran and
 *                           agreed" from "the branch never ran".
 *   secAddrMovedByFire      the subset where a secondary that FIRED moved the address. Only the 100%
 *                           Icy Wind arm can score and it scores TWICE, which is the count this file
 *                           got wrong before the engine did: I typed 1, meaning "the first roll moves
 *                           it off p21 onto p20", and forgot that the SECOND roll then moves it off
 *                           p20 onto p21. The other four arms score zero — the two Rock Slide spreads
 *                           because neither 30% roll passes, the two controls because a single
 *                           surviving body is already the address. THIS IS THE MEASURED VALUE, and
 *                           the ordered stream comparisons above are what says it is the right one.
 *   secAddrPerTargetRestored  1 under `--red`, 0 otherwise. This is the knob's own receipt. */
const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
if (RED) {
  claim((FAILS.secAddrPerTargetRestored || 0) === 1,
    'the revert knob was actually READ by the engine',
    'MEDFAILS.secAddrPerTargetRestored = ' + (FAILS.secAddrPerTargetRestored || 0)
      + '  (a 0 here means the arms above agreed for some other reason)');
  claim((SEEN.secAddrFromLastTarget || 0) === 0,
    'the last-target address is not taken at all under the revert',
    'MEDSEEN.secAddrFromLastTarget = ' + (SEEN.secAddrFromLastTarget || 0));
} else {
  claim((FAILS.secAddrPerTargetRestored || 0) === 0,
    'no revert knob is in play on the clean arm',
    'MEDFAILS.secAddrPerTargetRestored = ' + (FAILS.secAddrPerTargetRestored || 0));
  claim((SEEN.secAddrFromLastTarget || 0) === 8,
    'the last-target address was taken exactly 8 times — 2 per spread arm, 1 per control',
    'MEDSEEN.secAddrFromLastTarget = ' + (SEEN.secAddrFromLastTarget || 0));
  claim((SEEN.secAddrMovedByFire || 0) === 2,
    'exactly two FIRED secondaries moved the address, and both are the 100% arm',
    'MEDSEEN.secAddrMovedByFire = ' + (SEEN.secAddrMovedByFire || 0)
      + '  (0 means the nested-moveHit half is unreachable, so the Icy Wind order swap above would '
      + 'be agreeing by accident; a value the two Rock Slide arms contributed to would mean it fires '
      + 'on a roll that did not pass)');
}

function short(a) { const p = a.split('|'); return p[4] + '|' + p[5]; }

console.log(NL + (fails ? 'RED — ' + fails + ' claim(s) failed over ' + ran + ' staged turns'
                        : 'GREEN — every claim held over ' + ran + ' staged turns'));
process.exit(fails ? 1 : 0);
