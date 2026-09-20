#!/usr/bin/env node
/* tests/probe_priority_bar_mold_breaker.js — A MOULD-BREAKING ATTACKER GOES THROUGH THE PRIORITY BAR.
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=... node tests/probe_priority_bar_mold_breaker.js
 *   SHOWDOWN_PATH=... MEDI_PRIORITY_BAR_IGNORES_BREAKER=1 node tests/probe_priority_bar_mold_breaker.js  (exit 1)
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 *     armortail: {                                                   data/abilities.ts:215-233
 *       onFoeTryMove(target, source, move) { … this.add('cant', armorTailHolder, 'ability: Armor Tail', move, …) },
 *       flags: { breakable: 1 },
 *
 * and `Battle#runEvent` drops a BREAKABLE ability's handler whenever the move's user is suppressing:
 *
 *     if (effect.effectType === 'Ability' && effect.flags['breakable'] &&            sim/battle.ts:855-866
 *         this.suppressingAbility(effectHolder)) { … const AttackingEvents = { … TryMove: 1, … };
 *       if (eventid in AttackingEvents) { this.debug(eventid + ' handler suppressed by Mold Breaker'); continue; } }
 *
 * `TryMove` is in that list and `onFoeTryMove` is raised inside it, so a Mold Breaker attacker is
 * never refused by Armor Tail or Queenly Majesty. Neither ability is overridden in
 * `data/mods/champions/abilities.ts` — grepped on every run below.
 *
 * ================= WHAT WAS WRONG ================================================================
 *
 * `priorityRefusedAbove` in `engine/medicham2-browser.js` read `d.ability` off each defender RAW. It
 * is the one place four sources of priority refusal already meet (Armor Tail, Queenly Majesty,
 * Psychic Terrain, Quick Guard), and it was the one place that never asked `suppressedAbility`,
 * which this file has carried since WIRE 128 and which every damage-side breakable question goes
 * through.
 *
 * ================= WHAT IT COST, MEASURED ========================================================
 *
 * Row 7 of the fifteen board partings in the held-out 12,000-game draw on release `834713ccb303`
 * (`data/verification/_8347_dump_g12000.json`, seed `gen9championsvgc2026regmbbo3-2659757084`,
 * `omit-intimidate`, turn 1). Two lines earlier the dump carries
 * `|-ability|p2a: Tinkaton|moldbreaker` on the switch-in:
 *
 *     showdown   |-resisted|p1a: Aerodactyl|1      (the Fake Out lands, and flinches)
 *     medicham2  |cant|p1b: Farigiraf|ability: armortail|fakeout|[of] p2a: Tinkaton
 *
 * and the board leaves are `p1.tailwind us=3 showdown=0` with `p1.pp[0].tailwind us=1 showdown=0` —
 * the flinched body got its turn back here and spent it.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const NL = String.fromCharCode(10);
const KNOB = 'MEDI_PRIORITY_BAR_IGNORES_BREAKER';
const KNOB_SET = process.env[KNOB] === '1';
if (KNOB_SET) {
  console.log(NL + '  ' + KNOB + '=1 WAS SET FROM OUTSIDE. The BREAKER arm is expected to FAIL and');
  console.log('  this run MUST exit 1. The internal knob arm is skipped.');
}

require(D('tests', '_live_release.js'));
const ER = require(D('engine', 'engine_release.js'));
const ARGV = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
let REL_ID = ARGV('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_priority_bar_mold_breaker.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');

if (!process.argv.includes('--state')) process.argv.push('--state');
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const T = require(D('engine', 'tags.js'));

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else if (!KNOB_SET) delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

let bad = 0;
console.log(NL + '  === THE AUTHORITY, GREPPED THIS RUN ===');
{
  const fs = require('fs');
  const SP = process.env.SHOWDOWN_PATH;
  const TAB = String.fromCharCode(9);
  const abs = fs.readFileSync(path.join(SP, 'data', 'abilities.ts'), 'utf8');
  const modA = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'abilities.ts'), 'utf8');
  const bt = fs.readFileSync(path.join(SP, 'sim', 'battle.ts'), 'utf8');
  const i = abs.indexOf(NL + TAB + 'armortail: {');
  const block = i < 0 ? '' : abs.slice(i, abs.indexOf(NL + TAB + '},' + NL, i));
  const breakable = /flags: \{ breakable: 1 \}/.test(block);
  const tryMoveIsAttacking = /AttackingEvents = \{[\s\S]{0,900}?TryMove: 1/.test(bt);
  const suppressedByBreaker = /effect\.flags\['breakable'\] &&[\s\S]{0,60}suppressingAbility/.test(bt);
  console.log('    armortail is flags.breakable                    : ' + breakable);
  console.log('    runEvent drops a breakable handler for a breaker : ' + suppressedByBreaker);
  console.log('    and TryMove is in its AttackingEvents list       : ' + tryMoveIsAttacking);
  console.log('    armortail overridden by Champions               : ' + /[\n\t]armortail: \{/.test(modA));
  console.log('    moldbreaker overridden by Champions             : ' + /[\n\t]moldbreaker: \{/.test(modA));
  if (!breakable || !tryMoveIsAttacking || !suppressedByBreaker) {
    console.log('    THE AUTHORITY DOES NOT BREAK THE BAR — this probe asserts something the format');
    console.log('    does not say, and is WRONG rather than the engine.'); bad++;
  }
}

/* ---- THE POPULATIONS, PRINTED BEFORE ANYTHING IS WIRED TO THEM -------------------------------- */
console.log(NL + '  === THE FIXTURE, DERIVED THIS RUN ===');
const G0 = harness(false);
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LEGALX = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .filter(s => !G0.CLOSET_SPECIES.has(norm(s.id)))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const IDLE_OF = (s) => Object.keys(LS(s)).map(k => dex.moves.get(k))
  .filter(m => m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
    && !m.stallingMove && !m.selfSwitch && !m.flags.charge && !m.volatileStatus && !m.selfdestruct
    && !m.status && !m.forceSwitch && !m.onHit
    && m.boosts && Object.values(m.boosts).every(v => v > 0)
    && !('evasion' in m.boosts) && !('accuracy' in m.boosts))
  .sort((a, b) => a.pp - b.pp)[0] || null;

/* Both populations come off the artifact's own shapes: `blocksMove {what:'priority'}` is the bar and
 * `breakable` is what a breaker may ignore. A bar ability that is NOT breakable would be a different
 * claim and is excluded by name in the print below rather than silently. */
const BARS = [], UNBREAKABLE_BARS = [];
for (const ab of dex.abilities.all()) {
  if (!LEGALX(ab)) continue;
  const p = T.param('ability', ab.id, 'blocksMove');
  if (!(p && p.what === 'priority')) continue;
  (T.has('ability', ab.id, 'breakable') ? BARS : UNBREAKABLE_BARS).push(ab.id);
}
const BREAKERS = dex.abilities.all().filter(ab => {
  if (!LEGALX(ab)) return false;
  const p = T.param('ability', ab.id, 'ignoresDefenderAbility');
  return !!(p && p.ignoresDefAbility && !p.onlyCategory);
}).map(ab => ab.id);
console.log('    breakable priority bars   : ' + (BARS.join(', ') || 'NONE'));
console.log('    UNbreakable priority bars : ' + (UNBREAKABLE_BARS.join(', ') || 'none — every bar in this format is breakable'));
console.log('    category-free breakers    : ' + (BREAKERS.join(', ') || 'NONE'));
if (!BARS.length || !BREAKERS.length) { console.log('    POPULATION EMPTY — a claim about the artifact.'); process.exit(2); }

/* The CLICKER must carry the breaker AND a second legal ability, because the control arm is the SAME
 * body with the breaking half taken away — anything else varies two things at once. */
const PRIO = m => LEGALX(m) && m.category !== 'Status' && m.target === 'normal' && m.priority > 0.1
  && !m.multihit && !m.flags.charge && !m.selfSwitch && !m.recoil;
const PRIO_OF = (s) => Object.keys(LS(s)).map(k => dex.moves.get(k)).filter(PRIO)
  .sort((a, b) => b.priority - a.priority)[0] || null;
const CLICKERS = POOL.filter(s => {
  const abs = Object.values(s.abilities).map(norm);
  return abs.some(a => BREAKERS.includes(a)) && abs.some(a => !BREAKERS.includes(a))
      && PRIO_OF(s) && IDLE_OF(s);
});
const HOLDERS = POOL.filter(s => Object.values(s.abilities).some(a => BARS.includes(norm(a))) && IDLE_OF(s));
if (!CLICKERS.length || !HOLDERS.length) { console.log('    NO LEGAL CARRIER.'); process.exit(2); }
const CK = CLICKERS[0];
const CK_BREAK = Object.values(CK.abilities).map(norm).find(a => BREAKERS.includes(a));
const CK_PLAIN = Object.values(CK.abilities).map(norm).find(a => !BREAKERS.includes(a));
const MOVE = PRIO_OF(CK);
const HOLD = HOLDERS.find(s => s.name !== CK.name);
const HOLD_AB = Object.values(HOLD.abilities).map(norm).find(a => BARS.includes(a));
/* The TARGET is the holder's ALLY, because the handler's own test is `source.isAlly(armorTailHolder)`
 * over the move's TARGET — the bar covers the side, not the body. */
const FILL = POOL.filter(s => ![CK.name, HOLD.name].includes(s.name) && IDLE_OF(s)).slice(0, 6);
if (!HOLD || FILL.length < 6) { console.log('    NOT ENOUGH FILLER.'); process.exit(2); }

console.log('    the CLICKER : ' + CK.name + ' clicks ' + MOVE.id + ' (priority ' + MOVE.priority + ')'
  + '  breaker=' + CK_BREAK + '  control ability=' + CK_PLAIN);
console.log('    the BAR     : ' + HOLD.name + ' [' + HOLD_AB + '] standing BESIDE the target');

/* ---- THE BOARD --------------------------------------------------------------------------------- */
const mon = (species, ability, moves) => ({ species, item: '', ability: ability || '', moves });
const TEAM_P1 = [
  mon(FILL[0].name, '', [IDLE_OF(FILL[0]).name]),
  mon(HOLD.name, HOLD_AB, [IDLE_OF(HOLD).name]),
  mon(FILL[1].name, '', [IDLE_OF(FILL[1]).name]),
  mon(FILL[2].name, '', [IDLE_OF(FILL[2]).name]),
];
const teamP2 = (breaker) => [
  mon(CK.name, breaker ? CK_BREAK : CK_PLAIN, [MOVE.name, IDLE_OF(CK).name]),
  mon(FILL[3].name, '', [IDLE_OF(FILL[3]).name]),
  mon(FILL[4].name, '', [IDLE_OF(FILL[4]).name]),
  mon(FILL[5].name, '', [IDLE_OF(FILL[5]).name]),
];
const HP_BOOST = 8;
const flat = l => String(l).toLowerCase().replace(/[^a-z0-9|:-]/g, '');
const cantLines = (lines) => (lines || []).map(flat).filter(l => /^\|cant\|/.test(l) && l.includes(norm(HOLD_AB)));
const moveLines = (lines) => (lines || []).map(flat).filter(l => /^\|-damage\|/.test(l));

function play(G, breaker, tag) {
  const a = G.buildPair(TEAM_P1, { hpBoost: HP_BOOST }), b = G.buildPair(teamP2(breaker), { hpBoost: HP_BOOST });
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  G.resetScriptCounters();
  let fainted = false;
  const script = [{
    p1: [{ m: norm(IDLE_OF(FILL[0]).id) }, { m: norm(IDLE_OF(HOLD).id) }],
    p2: [{ m: norm(MOVE.id), t: 0 }, { m: norm(IDLE_OF(FILL[3]).id) }],
  }];
  const r = G.playGame(a, b, 'directed', 'prioritybarbreaker/' + tag, {
    arm: G.ARM_BY_ID.get('middle'),
    script,
    onBoundary: (snap, turnIdx, S, battle) => {
      for (const side of ['p1', 'p2'])
        for (const p of ((battle && battle[side] && battle[side].pokemon) || []))
          if (p.fainted) fainted = true;
    },
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  const sd = (G.lastSdLog ? G.lastSdLog() : []).map(String);
  const me = ((r && r.mediTrace) || []).map(String);
  return { staged: true, fainted,
           sdCant: cantLines(sd).length, meCant: cantLines(me).length,
           sdHit: moveLines(sd).length, meHit: moveLines(me).length,
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}
const show = (R) => {
  console.log('      ' + HOLD_AB + ' refusals   sd ' + R.sdCant + '   me ' + R.meCant);
  console.log('      -damage lines        sd ' + R.sdHit + '   me ' + R.meHit);
  if (R.div) { console.log('      STREAMS PART   sd ' + R.div.sd); console.log('                     me ' + R.div.me); }
  else console.log('      streams agree for the whole game');
};

/* ---- ARM 1: PLAIN. The bar must work at all, or nothing below means anything. ------------------ */
console.log(NL + '  --- PLAIN (' + CK.name + ' with ' + CK_PLAIN + '): the bar must REFUSE in both engines ---');
{
  const R = play(harness(false), false, 'plain');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  show(R);
  if (R.div) { console.log('      RED — the two engines part on the control board.'); bad++; }
  if (!R.sdCant) {
    console.log('      RED — the AUTHORITY did not refuse the move with no breaker on the field, so');
    console.log('      "it goes through" below would be satisfied by a bar that never bars.'); bad++;
  } else if (!R.meCant) { console.log('      RED — we do not refuse it at all; a different defect.'); bad++; }
  else console.log('      ok — both engines refuse the priority move');
}

/* ---- ARM 2: BREAKER. The claim. ---------------------------------------------------------------- */
console.log(NL + '  --- BREAKER (the same body carrying ' + CK_BREAK + ') ---');
let breakerClean = null;
{
  const R = play(harness(false), true, 'breaker');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  breakerClean = R;
  show(R);
  if (R.sdCant) {
    console.log('      RED — the AUTHORITY still refused it. This probe is wrong, not the engine.'); bad++;
  } else if (R.meCant) {
    console.log('      RED — we refuse a mould-breaking attacker at a BREAKABLE priority bar.'); bad++;
  }
  if (R.div) { console.log('      RED — the streams part on the breaker turn.'); bad++; }
  if (!R.div && !R.sdCant && !R.meCant)
    console.log('      ok — neither engine refuses it, and the streams agree');
}

/* ---- ARM 3: THE KNOB --------------------------------------------------------------------------- */
if (!KNOB_SET) {
  console.log(NL + '  --- KNOB ' + KNOB + '=1: the defect must come back ---');
  const R = play(harness(true), true, 'knob');
  harness(false);
  if (!R.staged) { console.log('      NOT STAGED under the knob — ' + R.why); bad++; }
  else {
    show(R);
    const moved = R.meCant !== breakerClean.meCant || !!R.div !== !!breakerClean.div;
    if (!moved) { console.log('      RED — THE KNOB CHANGED NOTHING, so it is unwired.'); bad++; }
    else console.log('      ok — the knob restores the refusal, so the arm above is live');
  }
}

console.log(NL + (bad ? '  RED — ' + bad + ' failing assertion(s).' : '  GREEN — a breaker goes through the priority bar.') + NL);
process.exit(bad ? 1 : 0);
