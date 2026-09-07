#!/usr/bin/env node
/* tests/probe_curse_pressure_pp.js — A TYPE-SPLIT MOVE'S PRESSURE PRICE. THE ACCUSATION IS REFUTED.
 *   node tests/probe_curse_pressure_pp.js
 * ==================================================================================================
 *
 * WHAT THIS FILE SETTLES. `tests/probe_pressure_terrain_target.js` carries, and PRINTS on every run,
 * a named residue: *"an OVER-charge of 1 PP on a non-Ghost Curse into a Pressure foe"*, deliberately
 * left unfixed there because that file's subject is a TERRAIN and this one is a TYPE. It was carried
 * on the hand list as owed work.
 *
 * IT IS NOT OWED. The over-charge DOES NOT HAPPEN, measured here across five staged arms before a
 * byte of the engine moved. This file is the standing proof, and it is kept rather than deleted for
 * the reason a refutation is worth more than a silence: the next reader of that comment would
 * otherwise re-derive the same wrong conclusion from the same true premise.
 *
 * THE PREMISE IS TRUE AND THE CONCLUSION DID NOT FOLLOW. The authority really does rewrite the
 * target — `sim/battle-actions.ts` `useMoveInner` runs `singleEvent('ModifyMove')` (:431) BEFORE
 * `getMoveTargets` (:467) and charges Pressure off `pressureTargets` (:475), and `curse`'s own
 * handler sends a non-Ghost user to `move.nonGhostTarget` (`self`), so the authority charges nothing.
 * The inference was that this engine, which prices Pressure off `targetClass.pressureScope` and
 * therefore off the STATIC word `normal`, would charge the named foe. It does not: this engine
 * resolves the type split when it builds the ACTION, so the action's target is already the user by
 * the time the PP road reads it, and `ppPressureExtra` skips `t === user` — the same clause that
 * models `if (target.isAlly(source)) return`. Two different roads, one correct answer.
 *
 * MEASURED, five arms, `MEDSEEN.ppPressureCharged` moved by:
 *     non-Ghost Curse, Pressure foe named                0     (the accusation: it predicted 1)
 *     non-Ghost Curse, TWO Pressure foes                 0
 *     non-Ghost Curse, Pressure standing in the OTHER slot 0
 *     non-Ghost Curse aimed at the other slot            0
 *     GHOST Curse, the SAME Pressure foe, same click     1     (correct — no rewrite happens)
 * and no board leaf parted in any of them.
 *
 * THE GHOST ARM IS THE KNOB-CLEARED CONTROL AND IT IS WHY THIS FILE IS EVIDENCE. A run in which the
 * counter reads zero everywhere is indistinguishable from a Pressure wire that is dead — that is the
 * unwired-knob signature this repository has been caught by four times. The Ghost arm is the SAME
 * move at the SAME body with the SAME ability and moves the counter 0 -> 1, so the instrument
 * demonstrably CAN see the charge it reports as absent.
 *
 * THERE IS NO RED KNOB HERE AND THAT IS DELIBERATE. A restore knob reverts a fix, and nothing was
 * fixed; inventing one would be building a defect in order to have something to revert.
 *
 * ONE ADJACENT CASE IS NAMED AND NOT CLAIMED. `curse`'s other rewrite — a GHOST user clicking it at
 * its own ALLY becomes `randomNormal`, so the authority re-rolls a foe and charges THAT body's
 * Pressure — is not staged here, because the directed script format has no ally-aim. It is a real
 * gap of at most 1 PP on a click nobody makes, and it is reported rather than assumed absent.
 * ================================================================================================ */
'use strict';
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
/* IT MUST BE THE INSTANCE THE DRIVER PLAYED — a bare require is a second module object whose
 * counters nothing writes, and a zero there reads exactly like a wire that never ran. */
const M = REL.require('engine/medicham2-browser.js');
const NL = String.fromCharCode(10);
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* ---- 1. THE TWO SOURCE FACTS, ASKED OF THE FORMAT ------------------------------------------------ */
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
{
  const cu = dex.moves.get('curse');
  const src = String(cu.onModifyMove || '');
  claim(/nonGhostTarget/.test(src) && cu.nonGhostTarget === 'self',
    'the rewrite and its destination are READ off the move, not typed',
    'onModifyMove: ' + src.replace(/\s+/g, ' ') + '   nonGhostTarget=' + cu.nonGhostTarget);
  claim(cu.target === 'normal',
    'its STATIC target is `normal`, which is what `targetClass` carries and what mispriced it',
    'target=' + cu.target);
  const pr = dex.abilities.get('pressure');
  claim(/isAlly/.test(String(pr.onDeductPP || '')),
    'Pressure refuses an ALLY, so a self-targeted move charges nothing even from its own holder',
    String(pr.onDeductPP || '').replace(/\s+/g, ' '));
  /* CHAMPIONS OVERRIDES EIGHT FILES AND READING MAINLINE IS THE STANDING FAILURE. Asked by key. */
  const fs = require('fs');
  const modMoves = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const modAb = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'abilities.ts'), 'utf8');
  claim(!/^\s*curse\s*:/m.test(modMoves), 'Champions does not override `curse`');
  claim(!/^\s*pressure\s*:/m.test(modAb), 'Champions does not override `pressure`');
}

/* ---- 2. THE FIXTURE, EVERY ROW CHECKED AGAINST THE FORMAT ---------------------------------------- */
/* Clefable is one of 133 legal non-Ghost Curse learners and Gengar one of 31 Ghost ones (both lists
 * derived below, not typed); Corviknight is one of 7 legal Pressure carriers and is the one the
 * corpus actually runs. Milotic stands in for it in the no-Pressure control — same slot, same click,
 * a body whose ability charges nothing. */
const CLEF = ['clefable', '', 'Unaware', ['Curse', 'Protect']];
const GENG = ['gengar', '', 'Cursed Body', ['Curse', 'Protect']];
const CORV = ['corviknight', '', 'Pressure', ['Protect', 'Iron Defense']];
const MILO = ['milotic', '', 'Marvel Scale', ['Protect', 'Recover']];
const AERO = ['aerodactyl', '', 'Unnerve', ['Protect']];
const PROT = { m: 'protect' };
/* THE FOE'S IDLE CLICK IS A SELF-TARGETED BOOST, NOT PROTECT: a shield would refuse the Ghost
 * control's Curse and make that arm about Protect instead. */
const ABSO = ['absol', '', 'Pressure', ['Protect', 'Swords Dance']];
const IDLE_C = { m: 'irondefense' };
const IDLE_M = { m: 'recover' };
const IDLE_A = { m: 'swordsdance' };

/* `charge` IS THE WHOLE CLAIM OF EACH ARM: how much `MEDSEEN.ppPressureCharged` may move. It is
 * asserted per arm rather than in one total, because a total of 1 can be reached four wrong ways. */
const CASES = [
  { name: 'THE ACCUSATION  a NON-GHOST Curse with the Pressure foe NAMED', charge: 0,
    what: 'The authority rewrites the target to `self` at ModifyMove, so `pressureTargets` is the '
        + 'USER and Pressure refuses an ally: 1 PP. The residue predicted this engine would charge '
        + 'the named foe. It does not — the type split is resolved when the ACTION is built, so the '
        + 'PP road already sees the user in the target field.',
    A: [CLEF, AERO], B: [CORV, MILO],
    script: [{ p1: [{ m: 'curse', t: 0 }, PROT], p2: [IDLE_C, IDLE_M] }] },

  { name: 'THE ACCUSATION, DOUBLED  TWO Pressure foes', charge: 0,
    what: 'Two apparent targets would be two extra PP under the accused reading. Carried because a '
        + 'single-foe arm cannot distinguish "charges nobody" from "charges one body once".',
    A: [CLEF, AERO], B: [CORV, ABSO],
    script: [{ p1: [{ m: 'curse', t: 0 }, PROT], p2: [IDLE_C, IDLE_A] }] },

  { name: 'THE ACCUSATION, MOVED  the Pressure body stands in the OTHER slot', charge: 0,
    what: 'The click names a body with no Pressure while a Pressure body watches from the partner '
        + 'slot. Pins that the answer is not "it charges whichever slot 0 holds".',
    A: [CLEF, AERO], B: [MILO, ABSO],
    script: [{ p1: [{ m: 'curse', t: 0 }, PROT], p2: [IDLE_M, IDLE_A] }] },

  { name: 'THE ACCUSATION, AIMED  the click names the Pressure body in slot 1', charge: 0,
    what: 'The same board with the aim moved onto the Pressure body itself.',
    A: [CLEF, AERO], B: [MILO, ABSO],
    script: [{ p1: [{ m: 'curse', t: 1 }, PROT], p2: [IDLE_M, IDLE_A] }] },

  { name: 'CONTROL  a GHOST Curse at the SAME Pressure foe — the counter MUST move', charge: 1,
    what: 'The same move at the same body against the same ability, with the ONE variable changed: '
        + 'the user has the type, so no rewrite happens, the foe IS an apparent target and 2 PP is '
        + 'correct. THIS IS THE ARM THAT MAKES THE FOUR ZEROES ABOVE EVIDENCE — without it, a dead '
        + 'Pressure wire would read exactly the same.',
    A: [GENG, AERO], B: [CORV, MILO],
    script: [{ p1: [{ m: 'curse', t: 0 }, PROT], p2: [IDLE_C, IDLE_M] }] },
];

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
/* AND THE TWO TYPE FACTS THE ARMS TURN ON, asked rather than asserted in prose. */
if (dex.species.get('clefable').types.includes('Ghost')) {
  console.log('FIXTURE WRONG — the non-Ghost user is Ghost'); illegal++; }
if (!dex.species.get('gengar').types.includes('Ghost')) {
  console.log('FIXTURE WRONG — the Ghost user is not Ghost'); illegal++; }
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- 3. THE RUN — THE BOARD IS THE VERDICT ------------------------------------------------------- */
/* `board_state.js` compares PP AS WHAT HAS BEEN SPENT, so `r.stateDiv` carries the whole claim: no
 * protocol line anywhere says how much PP a move cost. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));

console.log(NL + 'CLEAN ARM — there is no other arm; see the header' + NL);

const SEEN = M.MEDSEEN;
let ran = 0, moved = 0;
for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(BENCH('snorlax', 'incineroar')));
  const b = G.buildPair(stage(c.B).concat(BENCH('toxapex', 'kingambit')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const c0 = SEEN.ppPressureCharged || 0, d0 = SEEN.ppDeducted || 0;
  const r = G.playGame(a, b, 'directed', 'probe_curse_pressure_pp :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  ran++;
  const charged = (SEEN.ppPressureCharged || 0) - c0, spent = (SEEN.ppDeducted || 0) - d0;
  moved += charged;
  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    ppPressureCharged +' + charged + '   ppDeducted +' + spent
    + '   board: ' + (r.stateDiv ? 'PARTED at t' + r.stateDiv.turn + '  '
        + JSON.stringify(r.stateDiv.diffs.map(d => d.path + ' medi ' + JSON.stringify(d.medicham)
          + ' sd ' + JSON.stringify(d.showdown))) : 'identical at every boundary'));

  /* THE CLICK MUST HAVE HAPPENED. A refused or mis-parsed action leaves both engines spending
   * nothing, and two zeroes compare equal — the shape that passes an arm while measuring nothing. */
  const mt = r.mediTrace || [];
  const clicked = mt.filter(l => /^\|move\|p1a[^|]*\|curse/i.test(String(l))).length;
  claim(clicked === 1, c.name + ' — the Curse was actually clicked, once',
    clicked + ' `|move|p1a|curse` line(s) in the medicham2 stream');
  /* AND PP WAS SPENT AT ALL. `ppDeducted` counts the base spend of every action in the turn; a zero
   * would mean the whole PP wire is inert, which passes a board arm on any game whose PP agrees. */
  claim(spent > 0, c.name + ' — PP is being spent at all in this turn',
    'ppDeducted moved by ' + spent);
  claim(charged === c.charge, c.name + ' — Pressure charged exactly ' + c.charge + ' extra PP here',
    'ppPressureCharged moved by ' + charged + ', this arm requires ' + c.charge);
  /* THE BOARD IS THE OUTCOME AND THE COUNTER IS THE MECHANISM. Both, because two engines can reach
   * the same PP by different roads and a counter alone cannot see the authority. */
  claim(!r.stateDiv, c.name + ' — and no board leaf parts, PP included',
    r.stateDiv ? 'parted at t' + r.stateDiv.turn : 'identical at every boundary');
}

/* ---- 4. THE INSTRUMENT ITSELF ------------------------------------------------------------------
 * The four zeroes above are only evidence if this run could have seen a one. */
claim(moved === 1,
  'across the five arms the charge fired EXACTLY ONCE, and it was the Ghost control',
  'total ppPressureCharged movement = ' + moved
    + '  (0 would mean the Pressure wire is dead and the refutation is worthless; '
    + '2 or more would mean a non-Ghost arm charged after all)');

console.log(NL + (fails ? 'RED — ' + fails + ' claim(s) failed over ' + ran + ' staged turns'
                        : 'GREEN — every claim held over ' + ran + ' staged turns'));
process.exit(fails ? 1 : 0);
