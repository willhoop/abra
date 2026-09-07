#!/usr/bin/env node
/* tests/probe_substitute_roll_address.js — WHICH BODY IS THE SUBSTITUTE'S OWN DAMAGE ROLL ADDRESSED TO?
 *   node tests/probe_substitute_roll_address.js        node tests/probe_substitute_roll_address.js --red
 * ==================================================================================================
 *
 * AN INSTRUMENT LINE, NOT A GAME LINE, AND SAYING SO FIRST MATTERS. The middle arm of
 * `engine/game_differential.js` shares its dice by ADDRESS rather than by sequence:
 *
 *     value = FNV1a(seed | turn | category | move id | target slot | nth)  ->  [0,1)
 *
 * `MID_TGT` is read by `midEventDraw` and by nothing else, so both arms below are byte-identical to
 * every caller that is not the middle arm. What an address mismatch CAN do is hand two correct
 * engines different numbers for the same roll — and then one crits and the other does not.
 *
 * THE AUTHORITY PRICES A SUBSTITUTE **BEFORE** IT RE-AIMS, AND `activeTarget` IS STILL ON THE LAST
 * BODY THE ACCURACY STEP TOUCHED. Read in order, `sim/battle-actions.ts`:
 *
 *     hitStepAccuracy   :690-693   `for (const [i, target] of targets.entries()) {
 *                                     this.battle.activeTarget = target;`     <- the last writer
 *     hitStepMoveHitLoop :602-612  the step driver FILTERS `targets` after every step, so the last
 *                                  body of that loop is the last SURVIVING target
 *     spreadMoveHit     :1053-1058 `// 0. check for substitute` ->
 *                                  `this.tryPrimaryHitEvent(damage, targets, ...)`  — ALL targets
 *     data/moves.ts     substitute.condition.onTryPrimaryHit -> `this.actions.getDamage(source, target, move)`
 *     spreadMoveHit     :1071      `// 1. call to this.battle.getDamage` -> getSpreadDamage, which
 *                                  is the FIRST thing to write `activeTarget` again (:1154)
 *
 * `runEvent` takes an ARRAY of targets and writes `activeTarget` nowhere — the only writers in the
 * whole file are :693, :1093/1101 and :1154. So the doll's damage roll AND its crit roll are
 * addressed to the last body the accuracy step reached, whichever body is actually holding the doll.
 * Champions overrides neither `substitute` (`grep substitute data/mods/champions/moves.ts` -> 0) nor
 * this region of `spreadMoveHit`.
 *
 * medicham2 addressed the doll's roll to ITS OWN body, because the `_STEPS` driver stamps
 * `MID_TGT = midEventSlot(R.tg)` once per row per step and the substituted row is just another row.
 *
 * MEASURED BEFORE ANYTHING MOVED, and this is the whole reason the file exists — the board-material
 * game `baseline / ...bo3-2635208589 vs ...bo3-2635603270`, turn 1, a Rock Slide into an Absol
 * behind a Shed Tail doll and a healthy Whimsicott:
 *
 *     showdown   crit|rockslide|p21|0   dmg|rockslide|p21|0   crit|rockslide|p21|1   dmg|rockslide|p21|1
 *     medicham   dmg|rockslide|p20|0    crit|rockslide|p20|0  dmg|rockslide|p21|0    crit|rockslide|p21|0
 *
 * — the authority spends BOTH pairs at `p21` and separates them with `nth`; this engine spends the
 * doll's pair at `p20`. So `p21|0` was the DOLL's number here and the WHIMSICOTT's there, the crit
 * landed on a different body in each engine, and the board parted at
 * `p2.party.whimsicott.hp  medicham 65 / showdown 86`.
 *
 * ORDER IS NOT AN ISSUE AND THAT IS ARITHMETIC, NOT LUCK. `nth` counts per address STRING, and the
 * authority prices every doll (step 0) before any live body (step 1) while this engine's
 * step-outside/target-inside driver prices the rows in the same target order — so the doll's pair is
 * `nth 0` on both sides whichever slot the doll stands in.
 *
 * THE CONTROLS ARE THE POINT, and there are three, because a fix that simply stopped naming the
 * target would pass the red arm:
 *   - a SINGLE-TARGET hit into a doll, where "its own body" and "the last accuracy body" are one
 *     string;
 *   - a spread whose doll is on the LAST body, likewise — this one says the defect is POSITIONAL;
 *   - a spread with NO doll anywhere, which must be untouched by a substitute wire.
 *
 * RED FIRST: `MEDI_SUB_ADDR_PER_TARGET=1` restores the per-row address, i.e. the engine exactly as it
 * stood before this file existed.
 * ================================================================================================ */
'use strict';
/* THE KNOB IS SET BEFORE ANY REQUIRE. `SUB_ADDR_PER_TARGET` is read ONCE at medicham2's module load,
 * and medicham2 is loaded by `game_differential.js` at ITS require time — an env set below that line
 * leaves the engine holding the clean value and every arm comes back green, which is the signature of
 * an unwired knob rather than of a working fix. */
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_SUB_ADDR_PER_TARGET = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
/* `--state` IS PUSHED BEFORE THE REQUIRE, AND WITHOUT IT EVERY BOARD CLAIM IN THIS FILE IS VACUOUS.
 * `playGame` only builds `r.stateDiv` when the run asked for the state comparison; a file that reads
 * it without asking gets `null` on every arm and prints "identical at every boundary" for a board it
 * never compared. That is the green-test-asking-nothing shape, and this file was caught by it once
 * already — the arms below were all "identical" while the two engines were writing 136 and 137. */
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
/* IT MUST BE THE INSTANCE THE DRIVER PLAYED — a bare require is a second module object whose `MID_*`
 * fields nothing writes, and its log comes back empty, which reads exactly like an engine that takes
 * no draws at all. */
const M = REL.require('engine/medicham2-browser.js');
const SDP = process.env.SHOWDOWN_PATH;
const BA = require(SDP + '/dist/sim/battle-actions');
const BattleActions = BA.BattleActions || BA.default || BA;
const BM = require(SDP + '/dist/sim/battle');
const Battle = BM.Battle || BM.default || BM;
const SEED = M.MID_EVENT_SEED;
const NL = String.fromCharCode(10);

/* ---- THE AUTHORITY'S HALF — the same hook `probe_reaction_address.js` uses -------------------- */
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
Battle.prototype.sample = function (it) { addr(SD_CAT, this); return oS.call(this, it); };

const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

/* ---- THE FIXTURE, NOTHING TYPED FROM MEMORY -----------------------------------------------------
 * Every species, ability and move is checked against the format below and the file REFUSES to run on
 * an illegal one. The doll is put up by the body's OWN Substitute on turn 1 and the spread lands on
 * turn 2, which is the shortest staging that reaches the authority's step 0 at all. */
/* THE CLICKED MOVE MUST NOT BE ABLE TO MISS, and the first cut of this file used a 90%-accuracy
 * spread: it missed the second body on the pinned die, only ONE body was ever priced, and the arm
 * that is supposed to part a board could not reach the leaf that parts. Dazzling Gleam is 100
 * accuracy, is NOT a sound move (a sound move goes straight THROUGH a doll and prices nothing at
 * step 0), and Moonblast is its single-target counterpart on the same body. Both derived below. */
const CLEF = ['clefable', '', 'Unaware', ['Dazzling Gleam', 'Moonblast', 'Protect']];
const AERO = ['aerodactyl', '', 'Unnerve', ['Protect']];
const WHIM = ['whimsicott', '', 'Prankster', ['Substitute', 'Tailwind', 'Protect']];
const MILO = ['milotic', '', 'Marvel Scale', ['Substitute', 'Recover', 'Protect']];

const PROT = { m: 'protect' };
const SUB = { m: 'substitute' };
/* NEITHER FOE MAY SHIELD ON THE HITTING TURN — the first cut of this file had them both clicking
 * Protect and the priced-roll count came back 0 and 2 on arms that should have priced two bodies
 * each, because a shielded body is filtered out of the target list before the accuracy step ever
 * runs. Both idles are self-targeted and neither changes how much the incoming hit does. */
const IDLE_W = { m: 'tailwind' };
const IDLE_M = { m: 'recover' };

const CASES = [
  { name: 'RED  spread into a doll in the FIRST slot', part: true,
    what: 'Both foes are in the target list, the FIRST holds a Substitute. The authority prices the '
        + 'doll at step 0 with `activeTarget` still on the LAST accuracy body (p2b) and then prices '
        + 'p2b itself at the same address with nth 1; this engine priced the doll at p2a. Same two '
        + 'rolls, different numbers.',
    A: [CLEF, AERO], B: [WHIM, MILO], move: 'dazzlinggleam',
    script: [{ p1: [PROT, PROT], p2: [SUB, IDLE_M] },
             { p1: [{ m: 'dazzlinggleam' }, PROT], p2: [IDLE_W, IDLE_M] }],
    subSlot: 'p2a' },

  { name: 'CONTROL  spread into a doll in the LAST slot', part: false,
    what: 'The identical click with the doll on the LAST body, so "its own slot" and "the last '
        + 'accuracy slot" are the same string. THIS IS THE ARM THAT SAYS THE DEFECT IS POSITIONAL.',
    A: [CLEF, AERO], B: [MILO, WHIM], move: 'dazzlinggleam',
    script: [{ p1: [PROT, PROT], p2: [IDLE_M, SUB] },
             { p1: [{ m: 'dazzlinggleam' }, PROT], p2: [IDLE_M, IDLE_W] }],
    subSlot: 'p2b' },

  { name: 'CONTROL  single-target into a doll', part: false,
    what: 'One body in the list, so the two strings coincide by construction. Carried because it is '
        + 'the known-good case this probe has to be able to see.',
    A: [CLEF, AERO], B: [WHIM, MILO], move: 'moonblast',
    script: [{ p1: [PROT, PROT], p2: [SUB, IDLE_M] },
             { p1: [{ m: 'moonblast', t: 0 }, PROT], p2: [IDLE_W, IDLE_M] }],
    subSlot: 'p2a' },

  { name: 'CONTROL  the same spread with NO doll anywhere', part: false,
    what: 'Nobody puts a Substitute up. A substitute wire may not touch this arm at all, in either '
        + 'engine — it is the silent control.',
    A: [CLEF, AERO], B: [WHIM, MILO], move: 'dazzlinggleam',
    script: [{ p1: [PROT, PROT], p2: [IDLE_W, IDLE_M] },
             { p1: [{ m: 'dazzlinggleam' }, PROT], p2: [IDLE_W, IDLE_M] }],
    subSlot: null },
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
/* AND THE FACTS THE ARMS REST ON, ASKED OF THE FORMAT. */
for (const [id, want] of [['dazzlinggleam', 'allAdjacentFoes'], ['moonblast', 'normal']]) {
  const mv = dex.moves.get(id);
  if (mv.target !== want) {
    console.log('FIXTURE WRONG — ' + mv.name + ' is ' + mv.target + ', not ' + want); illegal++; }
  if (mv.accuracy !== 100 && mv.accuracy !== true) {
    console.log('FIXTURE WRONG — ' + mv.name + ' can MISS (' + mv.accuracy + '), so an arm can price '
              + 'one body instead of two and measure nothing'); illegal++; }
  if (mv.flags && (mv.flags.bypasssub || mv.flags.sound)) {
    console.log('FIXTURE WRONG — ' + mv.name + ' goes through a doll, so step 0 prices nothing');
    illegal++; }
}
{
  const fs = require('fs');
  const modMoves = fs.readFileSync(path.join(SDP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  if (/^\s*substitute\s*:/m.test(modMoves)) {
    console.log('FIXTURE WRONG — Champions DOES override substitute; this file reads mainline'); illegal++; }
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

console.log((RED ? 'RED ARM — MEDI_SUB_ADDR_PER_TARGET=1 (the engine as it stood before the fix)'
                 : 'CLEAN ARM')
  + NL + 'the crit/dmg addresses each engine asked for the clicked move, in order' + NL);

const short = a => { const p = a.split('|'); return p[2] + ':' + p[4] + '|' + p[5]; };

for (const c of CASES) {
  NTH = new Map(); LOG = [];
  const a = G.buildPair(stage(c.A).concat(BENCH('snorlax', 'incineroar')));
  const b = G.buildPair(stage(c.B).concat(BENCH('toxapex', 'kingambit')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_substitute_roll_address :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  ran++;
  const keep = x => { const p = x.split('|'); return (p[2] === 'crit' || p[2] === 'dmg') && p[3] === c.move; };
  const me = M.midEventLog().filter(keep);
  const sd = LOG.filter(keep);
  const meLines = r.mediTrace || [];
  const sdLines = G.lastSdLog();
  const subUp = l => /^\|-start\|.*\|Substitute/i.test(String(l));
  const subEnd = l => /^\|-end\|.*\|Substitute/i.test(String(l));

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  ' + (sd.map(short).join('  ') || '(none)'));
  console.log('    medicham  ' + (me.map(short).join('  ') || '(none)'));
  console.log('    doll up:  showdown ' + sdLines.filter(subUp).length + ' medicham ' + meLines.filter(subUp).length
            + '     doll broken: showdown ' + sdLines.filter(subEnd).length
            + ' medicham ' + meLines.filter(subEnd).length);

  /* THE ARM MUST HAVE STAGED WHAT IT CLAIMS TO STAGE. A doll that never went up, or a click that
   * drew nothing, produces two empty lists that compare EQUAL — the shape that passes while
   * measuring nothing. Both halves are asserted before any equality is. */
  claim(sd.length === me.length && sd.length > 0,
    c.name + ' — both engines took the same NUMBER of priced rolls, and it is not zero',
    'showdown ' + sd.length + ' crit/dmg draw(s) on ' + c.move + ', medicham2 ' + me.length);
  claim(sdLines.filter(subUp).length === (c.subSlot ? 1 : 0)
     && meLines.filter(subUp).length === (c.subSlot ? 1 : 0),
    c.name + ' — the doll is ' + (c.subSlot ? 'up on ' + c.subSlot : 'ABSENT') + ' in both engines',
    'showdown ' + sdLines.filter(subUp).length + ' `|-start ... Substitute`, medicham2 '
      + meLines.filter(subUp).length);

  const same = JSON.stringify(sd.slice().sort()) === JSON.stringify(me.slice().sort());
  const want = RED ? !c.part : true;
  claim(same === want,
    c.name + ' — the two engines name the same set of events'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    same ? 'identical'
         : 'showdown ' + JSON.stringify(sd.map(short)) + '  vs  medicham ' + JSON.stringify(me.map(short)));

  /* THE OUTCOME, NOT THE CLASSIFICATION — the board leaf the differential actually compares. Two
   * engines can name different events and still agree by luck about a 1-in-24 roll. */
  claim((!r.stateDiv) === want,
    c.name + ' — and no board leaf parts'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    r.stateDiv ? 'parted at t' + r.stateDiv.turn + ': '
                 + JSON.stringify(r.stateDiv.diffs.map(d => d.path + ' medi ' + JSON.stringify(d.medicham)
                   + ' sd ' + JSON.stringify(d.showdown)))
               : 'identical at every boundary');
}

/* ---- THE ENGINE'S OWN RECEIPTS, AT EXACT EQUALITY -------------------------------------------------
 *   subRollAddrFromLastAccTarget   PRICED DOLL ROWS whose two draws were addressed to the last body
 *                                  the accuracy step reached. THREE on the clean run — one per arm
 *                                  that stages a doll, INCLUDING the two controls, where the
 *                                  lingering slot IS the row's own slot. The fourth arm stages no
 *                                  doll and must contribute nothing. */
const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
if (RED) {
  claim((FAILS.subAddrPerTargetRestored || 0) === 1,
    'the revert knob was actually READ by the engine',
    'MEDFAILS.subAddrPerTargetRestored = ' + (FAILS.subAddrPerTargetRestored || 0)
      + '  (a 0 here means the arms above moved for some other reason)');
  claim((SEEN.subRollAddrFromLastAccTarget || 0) === 0,
    'the lingering address is not taken at all under the revert',
    'MEDSEEN.subRollAddrFromLastAccTarget = ' + (SEEN.subRollAddrFromLastAccTarget || 0));
} else {
  claim((FAILS.subAddrPerTargetRestored || 0) === 0,
    'no revert knob is in play on the clean arm',
    'MEDFAILS.subAddrPerTargetRestored = ' + (FAILS.subAddrPerTargetRestored || 0));
  claim((SEEN.subRollAddrFromLastAccTarget || 0) === 3,
    'the lingering address was taken exactly three times — once per doll staged',
    'MEDSEEN.subRollAddrFromLastAccTarget = ' + (SEEN.subRollAddrFromLastAccTarget || 0)
      + '  (4 would mean the no-doll arm took it too, which is the wire firing where no doll exists)');
}

console.log(NL + (fails ? 'RED — ' + fails + ' claim(s) failed over ' + ran + ' staged turns'
                        : 'GREEN — every claim held over ' + ran + ' staged turns'));
process.exit(fails ? 1 : 0);
