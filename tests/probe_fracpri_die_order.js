#!/usr/bin/env node
/* tests/probe_fracpri_die_order.js — THE ITEM'S FRACTIONAL-PRIORITY DIE WAS DRAWN BEFORE THE
 * ABILITY'S, AND THE AUTHORITY DRAWS THEM THE OTHER WAY ROUND
 *   node tests/probe_fracpri_die_order.js        node tests/probe_fracpri_die_order.js --red
 * ==================================================================================================
 *
 * THIS WAS OWED IN WRITING. The fractional-priority loop in `medicham2-browser.js` said so itself:
 * *"The item's die is still taken first, so every seeded run in this repo reads the same stream (the
 * paragraph above is explicit that moving it is a separate change with its own probe)."* This is that
 * change and this is that probe.
 *
 * READ, NOT RECALLED. `runEvent` sorts handlers by `onFractionalPriorityPriority` DESCENDING, and the
 * Champions mod overrides neither file (`grep -n quickdraw data/mods/champions/abilities.ts` -> 0,
 * `grep -n quickclaw data/mods/champions/items.ts` -> 0):
 *
 *     quickdraw       onFractionalPriorityPriority: -1    data/abilities.ts:3725
 *     myceliummight   onFractionalPriorityPriority: -1    data/abilities.ts:2785
 *     quickclaw       onFractionalPriorityPriority: -2    data/items.ts:4986
 *     custapberry     onFractionalPriorityPriority: -2    data/items.ts:1243
 *
 * so -1 (the ABILITY) runs first and -2 (the ITEM) runs last. This engine drew the item first.
 *
 * IT IS OBSERVABLE IN EXACTLY ONE POPULATION: a body carrying BOTH. With one carrier there is one die
 * at one address and the order cannot be seen; with two, the addresses share the base
 * `seed|turn|any|-|-` and differ only at `nth`, so swapping the order hands each handler THE OTHER
 * ONE'S NUMBER. Quick Draw is 30% and Quick Claw is 20%, so a die in [0.2, 0.3) fires one and not the
 * other — and the two engines then reach DIFFERENT TURN ORDERS off the same coin.
 *
 * SLOWBRO-GALAR IS THE WHOLE POPULATION AND IT IS NOT HYPOTHETICAL. It is this format's only Quick
 * Draw carrier (derived below, and the file refuses to run if that stops being true) and its usage
 * item is a Quick Claw. It is one of the four board-material games of the pinned pool
 * (`pair-speedctrl ...bo3-2654408616`).
 *
 * THE TWO DICE ARE COMPUTED, NOT HOPED AT. `midEventValue` is a pure function of the address string,
 * so the arms are CHOSEN off the table this file prints:
 *
 *     turn 1   die0 0.9706  die1 0.1920   both arms nudge — only the ATTRIBUTION parts
 *     turn 5   die0 0.2615  die1 0.8813   the ORDER parts: 0.2615 fires a 30% ability and not a 20% item
 *
 * so RED-2 is not an arm that happens to be harmless; it is the arm that separates "the label moved"
 * from "the order moved", and RED-1 is the one that moves the order.
 *
 * NOBODY TAKES DAMAGE IN ANY ARM, DELIBERATELY. Shell Side Arm is Poison and Corviknight is
 * Steel/Flying, so the click is an IMMUNITY — the die is drawn at the top of the turn, long before
 * targeting — and no body can faint and end the game before turn 5. Asserted against the format.
 *
 * RED FIRST: `MEDI_FRACPRI_ITEM_DIE_FIRST=1` restores the old draw order. Under `--red` the two RED
 * arms must PART and the three controls must NOT.
 * ================================================================================================ */
'use strict';
/* THE KNOB IS SET BEFORE ANY REQUIRE — it is read once at medicham2's module load, and
 * `game_differential.js` loads medicham2 at ITS require time. */
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_FRACPRI_ITEM_DIE_FIRST = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
/* WITHOUT `--state` EVERY BOARD CLAIM HERE IS VACUOUS — `playGame` fills `r.stateDiv` only when the
 * run asked for the state comparison, and a file that reads it without asking prints "identical" for
 * a board it never compared. */
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
/* THE INSTANCE THE DRIVER PLAYED — a bare require is a second module object whose counters nothing
 * writes, and a zero there reads exactly like a wire that never ran. */
const M = REL.require('engine/medicham2-browser.js');
const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
const NL = String.fromCharCode(10);
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* ---- THE FIXTURE, DERIVED ------------------------------------------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const TAGS = require(D('data', 'tags.json'));
let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };

const qdBodies = dex.species.all().filter(s => legal(s)
  && Object.values(s.abilities).map(a => dex.abilities.get(a).id).includes('quickdraw'));
console.log('Quick Draw carriers legal in this format: '
  + (qdBodies.map(s => s.name).join(', ') || '(none)'));
if (qdBodies.length !== 1 || qdBodies[0].id !== 'slowbrogalar')
  bad('the Quick Draw population is no longer exactly Slowbro-Galar — this whole file is aimed at it');
if (!legal(dex.items.get('quickclaw'))) bad('Quick Claw is not legal in this format');
{
  const ab = TAGS.abilities.quickdraw, it = TAGS.items.quickclaw;
  if (!ab || !(ab.tags || []).includes('fractionalPriority')) bad('Quick Draw lost fractionalPriority');
  if (!it || !(it.tags || []).includes('fractionalPriority')) bad('Quick Claw lost fractionalPriority');
  const ac = ab && ab.params.fractionalPriority.chance, ic = it && it.params.fractionalPriority.chance;
  if (!(ac > ic)) bad('the two chances no longer straddle a die: ability ' + ac + ', item ' + ic);
  console.log('derived chances: ability ' + ac + ', item ' + ic
    + '   — a die in [' + ic + ', ' + ac + ') fires one and not the other');
}
/* THE IMMUNITY THAT KEEPS EVERY BODY ALIVE TO TURN 5. */
if (dex.moves.get('shellsidearm').type !== 'Poison')
  bad('Shell Side Arm is ' + dex.moves.get('shellsidearm').type + ', not Poison — the arms would deal damage');
if (dex.getImmunity('Poison', dex.species.get('corviknight').types))
  bad('Corviknight is no longer immune to Poison — a body could faint before turn 5');
if (dex.moves.get('shellsidearm').category === 'Status')
  bad('Shell Side Arm has become a Status move, and Quick Draw excludes those');
if (dex.species.get('corviknight').baseStats.spe <= dex.species.get('slowbrogalar').baseStats.spe)
  bad('Corviknight is no longer faster than Slowbro-Galar, so the nudge would change no order');

/* ---- THE DICE, COMPUTED FROM THE ADDRESS ---------------------------------------------------------
 * `midEventValue` is a pure function of the address string, so which way each roll goes is DERIVED
 * here and the arms are chosen off it. An arm picked by trial and error would be a fixture nobody
 * could re-derive after a seed change. */
const SEED = M.MID_EVENT_SEED;
const AC = TAGS.abilities.quickdraw.params.fractionalPriority.chance;
const IC = TAGS.items.quickclaw.params.fractionalPriority.chance;
const diceAt = (t) => {
  const base = [SEED, t, 'any', '-', '-'].join('|');
  const d0 = M.midEventValue(base + '|0'), d1 = M.midEventValue(base + '|1');
  return { d0, d1,
    /* clean: the ABILITY reads the first die, the ITEM the second */
    cleanNudges: (d0 < AC) || (d1 < IC),
    /* red: the ITEM reads the first die, the ABILITY the second */
    redNudges: (d0 < IC) || (d1 < AC) };
};
console.log(NL + 'the two `any` dice of each turn, and what each order does with them:');
for (let t = 1; t <= 6; t++) {
  const x = diceAt(t);
  console.log('  turn ' + t + '  die0 ' + x.d0.toFixed(4) + '  die1 ' + x.d1.toFixed(4)
    + '   ability-first nudges ' + (x.cleanNudges ? 'YES' : 'no ')
    + '   item-first nudges ' + (x.redNudges ? 'YES' : 'no ')
    + (x.cleanNudges !== x.redNudges ? '   <-- THE ORDER PARTS HERE' : ''));
}
const T_ORDER = 5, T_LABEL = 1;
if (diceAt(T_ORDER).cleanNudges === diceAt(T_ORDER).redNudges)
  bad('turn ' + T_ORDER + ' no longer parts the ORDER — RED-1 would assert nothing');
if (!diceAt(T_LABEL).cleanNudges || !diceAt(T_LABEL).redNudges)
  bad('turn ' + T_LABEL + ' no longer nudges in BOTH orders — RED-2 would stop being the attribution arm');
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' broken fixture claim(s). This is not a pass.'); process.exit(2); }

/* ---- THE ARMS ------------------------------------------------------------------------------------ */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
const PROT = { m: 'protect' };
const SLOW = (item, ab) => ['slowbrogalar', item, ab, ['Shell Side Arm', 'Protect']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
const CORV = ['corviknight', '', 'Pressure', ['Iron Defense', 'Protect']];
const GARC = ['garchomp', '', 'Rough Skin', ['Protect']];
const TURNS = 6;
const SCRIPT = [];
for (let i = 0; i < TURNS; i++)
  SCRIPT.push({ p1: [{ m: 'shellsidearm', t: 0 }, PROT], p2: [{ m: 'irondefense' }, PROT] });

const CASES = [
  { name: 'RED-1  BOTH carriers, turn ' + T_ORDER + '   [the ORDER parts]',
    part: true, both: true,
    what: 'die0 is ' + diceAt(T_ORDER).d0.toFixed(4) + ' — under the 30% ability it FIRES and under the '
        + '20% item it does not, and die1 (' + diceAt(T_ORDER).d1.toFixed(4) + ') fires neither. So the '
        + 'ability-first order nudges Slowbro ahead of a faster Corviknight and the item-first order '
        + 'leaves it behind. This is the arm that says the defect moves a BOARD ORDER and not a label.',
    slow: SLOW('Quick Claw', 'Quick Draw'), turn: T_ORDER },

  { name: 'RED-2  BOTH carriers, turn ' + T_LABEL + '   [the ATTRIBUTION parts, the order does not]',
    part: true, both: true,
    what: 'both orders nudge on turn 1, so the turn ORDER coincides and the two engines still credit '
        + 'DIFFERENT handlers off the same two coins — showdown `item: Quick Claw`, the old engine '
        + '`ability: quickdraw`. Carried because a file whose only red arm changes the order cannot '
        + 'distinguish "the die order moved" from "the nudge stopped working".',
    slow: SLOW('Quick Claw', 'Quick Draw'), turn: T_LABEL },

  { name: 'CTRL-A  the ABILITY alone, no item', part: false, both: false,
    what: 'One carrier, one die, one address. There is no order to get wrong, so both arms must agree '
        + 'at every turn. Without this, "Quick Draw is broken" would pass RED-1.',
    slow: SLOW('', 'Quick Draw'), turn: null },

  { name: 'CTRL-B  the ITEM alone, Own Tempo', part: false, both: false,
    what: 'The mirror control. Without it, "Quick Claw is broken" would pass RED-1.',
    slow: SLOW('Quick Claw', 'Own Tempo'), turn: null },

  { name: 'CTRL-C  NEITHER carrier', part: false, both: false,
    what: 'The same board with no fractional-priority anything. It must agree in both arms and take '
        + 'no die at all — the arm that says the loop is not drawing for bodies that do not carry.',
    slow: SLOW('', 'Own Tempo'), turn: null },
];

for (const c of CASES) for (const mv of c.slow[3]) {
  const m = dex.moves.get(mv);
  if (!legal(m)) bad(mv + ' is not in this format');
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' broken fixture claim(s). This is not a pass.'); process.exit(2); }

console.log(NL + (RED ? 'RED ARM — MEDI_FRACPRI_ITEM_DIE_FIRST=1 (the engine as it stood before this file)'
                      : 'CLEAN ARM') + NL);

/* which body moved first inside turn `t`, read off a stream */
const orderIn = (lines, t) => {
  let inTurn = false;
  for (const l of lines) {
    const s = String(l);
    if (/^\|turn\|/.test(s)) { inTurn = (+s.split('|')[2] === t); continue; }
    if (!inTurn) continue;
    const m = /^\|move\|(p\da)/i.exec(s);
    if (m) return m[1].toLowerCase();
  }
  return null;
};
const nudgeLines = lines => lines.filter(l => /^\|-activate\|p1a[^|]*\|(item|ability)/i.test(String(l)))
  .map(l => String(l).replace(/^\|-activate\|[^|]+\|/, '').trim().toLowerCase().replace(/\s+/g, ''));

const before = { both: SEEN.fracPriBothCarriersOneBody | 0, die: SEEN.fracPriItemDie | 0 };
let dualSeen = 0;

for (const c of CASES) {
  const b0 = SEEN.fracPriBothCarriersOneBody | 0;
  const a = G.buildPair(stage([c.slow, CLEF]).concat(BENCH('milotic', 'incineroar')));
  const b = G.buildPair(stage([CORV, GARC]).concat(BENCH('toxapex', 'milotic')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_fracpri_die_order :: ' + c.name,
                       { script: SCRIPT, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdL = G.lastSdLog(), meL = r.mediTrace || [];
  const dual = (SEEN.fracPriBothCarriersOneBody | 0) - b0;
  if (c.both) dualSeen += dual;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown nudges: ' + JSON.stringify(nudgeLines(sdL)));
  console.log('    medicham nudges: ' + JSON.stringify(nudgeLines(meL)));
  const ko = meL.filter(l => /^\|faint\|/.test(String(l))).length
           + sdL.filter(l => /^\|faint\|/.test(String(l))).length;

  /* THE FIXTURE REACHED THE RULE. A dual-carrier arm that never met a dual carrier tested nothing,
   * and an arm that ended before its turn compares two nulls, which are equal. */
  claim(dual > 0 === !!c.both,
    c.name + ' — the loop saw ' + (c.both ? 'a body carrying BOTH' : 'no dual carrier'),
    'MEDSEEN.fracPriBothCarriersOneBody moved by ' + dual);
  claim(ko === 0, c.name + ' — nobody fainted, so the game reached every scripted turn',
    ko + ' faint line(s) across the two streams');

  if (c.turn) {
    const sdO = orderIn(sdL, c.turn), meO = orderIn(meL, c.turn);
    console.log('    turn ' + c.turn + ' first mover:  showdown ' + sdO + '   medicham ' + meO);
    claim(sdO != null && meO != null,
      c.name + ' — both streams reached turn ' + c.turn,
      'showdown ' + sdO + ', medicham ' + meO);
    const orderSame = sdO === meO;
    const wantOrderSame = !(RED && c.name.startsWith('RED-1'));
    claim(orderSame === wantOrderSame,
      c.name + ' — the two engines agree about WHO MOVED FIRST on turn ' + c.turn
        + (RED ? (c.name.startsWith('RED-1') ? '   [--red: must PART]' : '   [--red: the order must still coincide]') : ''),
      'showdown ' + sdO + ', medicham ' + meO);
  }

  /* THE PROTOCOL, WHICH IS WHERE THE ATTRIBUTION LIVES. */
  const same = JSON.stringify(nudgeLines(sdL)) === JSON.stringify(nudgeLines(meL));
  claim(same === (RED ? !c.part : true),
    c.name + ' — the two engines credit the same handler every time it fires'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    same ? 'identical' : 'showdown ' + JSON.stringify(nudgeLines(sdL))
                       + '  vs  medicham ' + JSON.stringify(nudgeLines(meL)));

  claim(!r.div === (RED ? !c.part : true),
    c.name + ' — the whole protocol stream'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    r.div ? 'parts: ' + r.div.sd + '  |  ' + r.div.me : 'identical');
}

/* ---- THE ENGINE'S OWN RECEIPTS -------------------------------------------------------------------- */
console.log(NL + '  MEDSEEN.fracPriBothCarriersOneBody +' + ((SEEN.fracPriBothCarriersOneBody | 0) - before.both)
  + '   MEDSEEN.fracPriItemDie +' + ((SEEN.fracPriItemDie | 0) - before.die)
  + '   MEDFAILS.fracPriItemDieFirstRestored ' + (FAILS.fracPriItemDieFirstRestored | 0));
claim(dualSeen > 0,
  'the dual-carrier population was actually reached — without it the draw ORDER is unobservable and every arm above is vacuous',
  dualSeen + ' dual-carrier action(s)');
claim((FAILS.fracPriItemDieFirstRestored | 0) === (RED ? 1 : 0),
  RED ? 'the RED arm ran with the knob — a restore that did not fire is a green arm wearing a red name'
      : 'the clean arm did NOT run with the restore knob',
  'MEDFAILS.fracPriItemDieFirstRestored = ' + (FAILS.fracPriItemDieFirstRestored | 0));

console.log(NL + (fails ? '  ' + fails + ' FAILED' : '  all claims held') + NL);
process.exit(fails ? 1 : 0);
