#!/usr/bin/env node
/* tests/probe_refill_update_pass.js — A FAINT REPLACEMENT WALKS IN AND NOTHING RUNS `Update`
 *   node tests/probe_refill_update_pass.js        node tests/probe_refill_update_pass.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY RAISES `Update` AT THE END OF EVERY ACTION, AND A REPLACEMENT SWITCH IS AN ACTION.
 * `Battle#runAction`, sim/battle.ts, read in order:
 *
 *     this.faintMessages();                              :2832
 *     if (this.ended) return true;                       :2833
 *     ...
 *     if (this.gen >= 5 && action.choice !== 'start') {
 *       this.eachEvent('Update');                        :2858
 *
 * `residualUpdatePass` already models that line for the RESIDUAL action — its own header says so, and
 * says it must sit ABOVE `refill()` because "the replacements are issued past this point". Both halves
 * are right. What was missing is that the replacement switch is then ITS OWN action, and `runAction`
 * closes it with the SAME `eachEvent('Update')` — so a body that walks in already at or below its
 * berry's threshold eats it BEFORE the turn boundary, not after it.
 *
 * SO THE BOARD THE DIFFERENTIAL COMPARES IS THE ONE THIS DEFECT MOVES. Both engines eat the berry;
 * this one eats it one step late, on the far side of the `|turn|` line, and the turn-boundary board is
 * exactly what `state` compares.
 *
 * MEASURED BEFORE ANYTHING MOVED — the board-material game `baseline / ...bo3-2635208589` of the
 * pinned pool, turn 3, once the substitute-address defect above it was closed:
 *
 *     showdown   |switch|p2a: Heliolisk|68/137   |-enditem|Sitrus Berry|[eat]   |-heal|102/137   |turn|4
 *     medicham   |switch|p2a: Heliolisk|68/137   |turn|4   |-enditem|sitrusberry|[eat]   |-heal|102/137
 *
 * parting `p2.party.heliolisk.hp  medi 68 / sd 102` and `p2.party.heliolisk.item  medi sitrusberry /
 * sd ""`. (That Heliolisk was held below the threshold by an Unnerve that then fainted; the fixture
 * below reaches the same state through entry damage, which needs no third body.)
 *
 * THE VOLUNTARY SWITCH-IN IS ALREADY CORRECT AND THAT IS A CONTROL, NOT AN ASSUMPTION. A mid-turn
 * switch is handled elsewhere in this engine and eats on entry in both engines; it is staged below so
 * that a fix aimed at the replacement path cannot be confused with one aimed at every switch.
 *
 * THE FIXTURE IS DERIVED. Volcarona is the ONLY legal body in this format that is 4x weak to Rock and
 * not Flying — so Stealth Rock takes it to exactly `maxhp / 2` (160 -> 80) and `pokemon.hp <=
 * pokemon.maxhp / 2` is true on the nose. Glimmora is the legal setter that carries both hazards. The
 * file asserts all of that against the format and refuses to run if any of it stops being true.
 *
 * RED FIRST: `MEDI_NO_REFILL_UPDATE=1` restores the engine as it stood before this file existed.
 * ================================================================================================ */
'use strict';
/* THE KNOB IS SET BEFORE ANY REQUIRE — it is read once at medicham2's module load, and
 * `game_differential.js` loads medicham2 at ITS require time. */
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_NO_REFILL_UPDATE = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
/* `--state` IS PUSHED BEFORE THE REQUIRE, AND WITHOUT IT EVERY BOARD CLAIM HERE IS VACUOUS —
 * `playGame` only fills `r.stateDiv` when the run asked for the state comparison, and a file that
 * reads it without asking prints "identical" for a board it never compared. */
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
/* IT MUST BE THE INSTANCE THE DRIVER PLAYED — a bare require is a second module object whose counters
 * nothing writes, and a zero there reads exactly like a wire that never ran. */
const M = REL.require('engine/medicham2-browser.js');
const NL = String.fromCharCode(10);
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

let fails = 0, ran = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* ---- 1. THE FIXTURE'S FACTS, ASKED OF THE FORMAT -------------------------------------------------- */
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
let bad = 0;
{
  /* THE ENTRANT IS DERIVED, NOT CHOSEN. Every legal body 4x weak to Rock and not Flying — the list is
   * printed, and if it ever holds more than the one this file stages, the file says so rather than
   * quietly standing on a coincidence. */
  const fourX = dex.species.all().filter(s => legal(s) && !s.types.includes('Flying')
    && dex.getEffectiveness('Rock', s.types) === 2).map(s => s.name);
  console.log('  every legal body 4x weak to Rock and grounded, DERIVED: ' + (fourX.join(', ') || '(none)'));
  if (!fourX.includes('Volcarona')) { console.log('FIXTURE WRONG — the staged entrant is not in that list'); bad++; }
  const sr = dex.moves.get('stealthrock');
  if (!legal(sr) || sr.sideCondition !== 'stealthrock') {
    console.log('FIXTURE WRONG — Stealth Rock is not the hazard this file thinks it is'); bad++; }
  if (!learns('glimmora', 'stealthrock')) { console.log('FIXTURE WRONG — the setter does not learn it'); bad++; }
  const si = dex.items.get('sitrusberry');
  if (!legal(si) || !/maxhp\s*\/\s*2/.test(String(si.onUpdate || ''))) {
    console.log('FIXTURE WRONG — Sitrus is not an onUpdate half-HP berry in this format: '
      + String(si.onUpdate || '').replace(/\s+/g, ' ')); bad++; }
  else console.log('  the berry\'s own trigger, READ: ' + String(si.onUpdate).replace(/\s+/g, ' '));
}
if (bad) { console.log(NL + 'NOT RUN — ' + bad + ' fixture fault(s). This is not a pass.'); process.exit(2); }

/* ---- 2. THE ARMS --------------------------------------------------------------------------------- */
const mk = (sp, it, ab, mv) => ({ species: sp, item: it, ability: ab, moves: mv });
const P = { m: 'protect' }, TW = { m: 'tailwind' }, SR = { m: 'stealthrock' };
const IRON = { m: 'ironhead', t: 0 };

/* p2's bench order matters and is not left to chance: the driver answers the switch request the same
 * way on both sides, and the arms below assert WHICH body walked in rather than assuming it. */
const P1 = [mk('glimmora', '', 'Toxic Debris', ['Stealth Rock', 'Spikes', 'Protect']),
            mk('kingambit', '', 'Defiant', ['Iron Head', 'Protect']),
            mk('incineroar', '', 'Intimidate', ['Protect']),
            mk('clefable', '', 'Unaware', ['Protect'])];
const p2team = (entrantItem) => [
  mk('whimsicott', '', 'Prankster', ['Tailwind', 'Protect']),
  mk('milotic', '', 'Marvel Scale', ['Protect']),
  mk('volcarona', entrantItem, 'Flame Body', ['Protect']),
  mk('toxapex', '', 'Regenerator', ['Protect'])];

const CASES = [
  { name: 'RED  a faint replacement lands on Stealth Rock at exactly half HP', part: true,
    what: 'Kingambit kills the Whimsicott, the only living bench body walks into the rocks at 80 of '
        + '160, and the authority eats the Sitrus at the end of that switch ACTION — before |turn|2. '
        + 'This engine ate it on the far side of the boundary, so the compared board differs.',
    p1: P1, p2: p2team('sitrusberry'),
    /* THE SECOND TURN IS LOAD-BEARING: without it the game ends before the LATE engine has eaten at
     * all, and "both engines ate" would be false for a reason that is not the defect. With it, both
     * eat and only the MOMENT differs — which is the whole claim. */
    script: [{ p1: [SR, IRON], p2: [TW, P] }, { p1: [P, P], p2: [P, P] }],
    wantEat: true },

  { name: 'CONTROL  the same entrant, the same rocks, NO berry', part: false,
    what: 'Everything identical except the item. The entrant still takes the chip, so a fix that '
        + 'moved the HAZARD rather than the berry would part here too.',
    p1: P1, p2: p2team(''),
    script: [{ p1: [SR, IRON], p2: [TW, P] }, { p1: [P, P], p2: [P, P] }],
    wantEat: false },

  { name: 'CONTROL  a VOLUNTARY switch onto the same rocks, berry and all', part: false,
    what: 'A mid-turn switch is a different road in this engine and was ALREADY correct — both '
        + 'engines eat on entry. Carried so that a fix aimed at the replacement path cannot be '
        + 'mistaken for one aimed at every switch-in.',
    p1: P1, p2: p2team('sitrusberry'),
    script: [{ p1: [SR, P], p2: [TW, P] },
             { p1: [P, P], p2: [{ sw: 'volcarona' }, P] }],
    wantEat: true },

  { name: 'CONTROL  a faint replacement with NO hazard down at all', part: false,
    what: 'The same kill with no rocks: the entrant arrives at full HP, nothing is owed to the '
        + 'Update pass, and both engines must agree. This is the silent arm — a new pass that fires '
        + 'something here is firing where the authority fires nothing.',
    p1: P1, p2: p2team('sitrusberry'),
    script: [{ p1: [P, IRON], p2: [TW, P] }, { p1: [P, P], p2: [P, P] }],
    wantEat: false },
];

/* ---- 3. THE RUN ---------------------------------------------------------------------------------- */
console.log(NL + (RED ? 'RED ARM — MEDI_NO_REFILL_UPDATE=1 (the engine as it stood before the fix)'
                      : 'CLEAN ARM') + NL);

const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
let ateTotal = 0;
for (const c of CASES) {
  const a = G.buildPair(c.p1), b = G.buildPair(c.p2);
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const ate0 = SEEN.refillUpdateAte || 0;
  const r = G.playGame(a, b, 'directed', 'probe_refill_update_pass :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err && !/Can't pass/.test(String(r.err))) {
    console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  ran++;
  const mt = r.mediTrace || [];
  const sd = G.lastSdLog();
  /* SHOWDOWN PRINTS EVERY SWITCH TWICE — the private line and the `|split|` public copy, which
   * carries a percentage HP. Counting both reads "2" for one entry, which is a fault in the RULER and
   * would have been reported as a fault in the engine. The percentage copy is dropped. */
  const pub = l => /\|\d+\/100(\||$| )/.test(String(l));
  const entered = l => /^\|switch\|p2a: Volcarona/i.test(String(l)) && !pub(l);
  const eaten = l => /^\|-enditem\|p2a: Volcarona\|sitrusberry\|\[eat\]/i.test(String(l));
  const eatenSd = l => /^\|-enditem\|p2a: Volcarona\|Sitrus Berry\|\[eat\]/i.test(String(l)) && !pub(l);
  ateTotal += (SEEN.refillUpdateAte || 0) - ate0;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    board: ' + (r.stateDiv
    ? 'PARTED at t' + r.stateDiv.turn + '  ' + JSON.stringify(r.stateDiv.diffs.map(d =>
        d.path + ' medi ' + JSON.stringify(d.medicham) + ' sd ' + JSON.stringify(d.showdown)))
    : 'identical at every boundary'));

  /* THE ARM MUST HAVE STAGED WHAT IT CLAIMS. An entrant that never entered, or a berry that was
   * never eaten by ANYONE, leaves two engines agreeing about nothing at all. */
  claim(mt.filter(entered).length === 1 && sd.filter(entered).length === 1,
    c.name + ' — the entrant walked in exactly once on each side',
    'medicham ' + mt.filter(entered).length + ', showdown ' + sd.filter(entered).length);
  claim((mt.filter(eaten).length === (c.wantEat ? 1 : 0))
     && (sd.filter(eatenSd).length === (c.wantEat ? 1 : 0)),
    c.name + ' — the berry ' + (c.wantEat ? 'WAS' : 'was NOT') + ' eaten, in both engines',
    'medicham ' + mt.filter(eaten).length + ' `[eat]` line(s), showdown ' + sd.filter(eatenSd).length);

  const want = RED ? !c.part : true;
  claim((!r.stateDiv) === want,
    c.name + ' — the boards agree'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    r.stateDiv ? 'parted at t' + r.stateDiv.turn : 'identical at every boundary');
}

/* ---- 4. THE ENGINE'S OWN RECEIPTS ----------------------------------------------------------------
 *   refillUpdatePasses   `Update` passes run after the faint replacements walked in. One per staged
 *                        turn that actually refilled a slot.
 *   refillUpdateAte      the subset that CONSUMED an item. Exactly TWO on the clean run: the RED arm
 *                        and nothing else — the no-berry arm has nothing to eat, the no-hazard arm is
 *                        above the threshold, and the voluntary arm eats on the switch road instead.
 *                        Wait: the voluntary arm ALSO refills nothing, so it contributes 0. */
if (RED) {
  claim((FAILS.refillUpdateSkipped || 0) === 1,
    'the revert knob was actually READ by the engine',
    'MEDFAILS.refillUpdateSkipped = ' + (FAILS.refillUpdateSkipped || 0));
  claim((SEEN.refillUpdateAte || 0) === 0,
    'and no item is consumed by the new pass under the revert',
    'MEDSEEN.refillUpdateAte = ' + (SEEN.refillUpdateAte || 0));
} else {
  claim((FAILS.refillUpdateSkipped || 0) === 0,
    'no revert knob is in play on the clean arm',
    'MEDFAILS.refillUpdateSkipped = ' + (FAILS.refillUpdateSkipped || 0));
  claim(ateTotal === 1,
    'the new pass consumed exactly ONE item across the four arms, and it was the RED arm',
    'MEDSEEN.refillUpdateAte moved by ' + ateTotal
      + '  (0 means the pass is present and dead; 2 or more means it fired on an arm where the '
      + 'authority eats nothing at that moment)');
  claim((SEEN.refillUpdatePasses || 0) > 0,
    'and the pass ran at all — a zero here would make every claim above vacuous',
    'MEDSEEN.refillUpdatePasses = ' + (SEEN.refillUpdatePasses || 0));
}

console.log(NL + (fails ? 'RED — ' + fails + ' claim(s) failed over ' + ran + ' staged games'
                        : 'GREEN — every claim held over ' + ran + ' staged games'));
process.exit(fails ? 1 : 0);
