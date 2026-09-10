#!/usr/bin/env node
/* tests/probe_pivot_immune_attr.js — A PIVOT REFUSED BY AN ABILITY ANNOUNCED A BARE `|-immune|`
 *   node tests/probe_pivot_immune_attr.js      node tests/probe_pivot_immune_attr.js --red
 * ==================================================================================================
 *
 * Soundproof's handler writes the ability into the line it emits:
 *
 *     onTryHit(target, source, move) {
 *       if (target !== source && move.flags['sound']) {
 *         this.add('-immune', target, '[from] ability: Soundproof');
 *         return null;
 *       }
 *     }                                                          data/abilities.ts:4426-4432
 *
 * `moveClassImmuneAttr` already reads that attribution off the handler for every OTHER road into a
 * refusal — the damaging loop, the status branch, the phaze branch — and the PIVOT branch printed
 * `TR.imm(_pt)` with nothing after it. Parting Shot is a sound move and 13,924 corpus uses, so it is
 * the member that matters; Chilly Reception, U-turn, Volt Switch, Flip Turn, Shed Tail and Baton
 * Pass carry no `sound` flag and never reach the clause at all.
 *
 * THE COMMENT ONE LINE ABOVE THE DEFECT ALREADY DESCRIBED IT. WIRE 241 split Good as Gold out of
 * this very branch *"because this branch printed a bare `|-immune|` for Good as Gold where the
 * authority names the ability"* — and left the move-class half of the same `if` behind.
 *
 * IT WAS NOT VISIBLE UNTIL BATCH O's FIRST FIX. The pinned-pool game that carries it
 * (`pair-protect-bust`, release `f30bf025ae28`) recorded its FIRST divergence two lines earlier, on
 * the `-immune` ORDERING of the Clanging Scales that preceded it. Closing the ordering let the game
 * re-enter on this — a TRANSFER, and the reason a divergence count is a lower bound.
 *
 * THE THREE ARMS.
 *
 *   RED           Parting Shot into a Soundproof Kommo-o: the authority names the ability.
 *   CTRL-PROT     The same click into a body that SHIELDED. Protect answers first and the authority
 *                 writes `-activate move: Protect`, not an `-immune` at all — so a fix that pasted
 *                 the ability onto every refusal in this branch fails here.
 *   CTRL-LANDS    The same click into the SAME Kommo-o carrying BULLETPROOF. Parting Shot is sound
 *                 and not bullet, so nothing refuses it: two `-unboost` lines and no `-immune`.
 *                 Without it, deleting the refusal outright would pass RED.
 *
 * RED FIRST: `MEDI_PIVOT_IMMUNE_BARE=1` restores the bare line, and any run carrying it also carries
 * a non-zero `MEDFAILS.pivotImmuneBareRestored`.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_PIVOT_IMMUNE_BARE = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
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
/* ROADMAP #565 — THE LEGALITY GATE ASKS THE VALIDATOR, NOT THE RAW ROWS. The prevo walk this line
 * replaced accepted any entry on the species or on a prevo whatever its SOURCE tag, so a move a prevo
 * learned by a gen-7 TM (`7M`, `7V`) read as legal here while `TeamValidator` refused it — which is how
 * illegal fixtures passed their own gates (tests/test-fixture-legality.js, batch 2).
 * `champions_sim.canLearn` IS `checkCanLearn`, cached per pair. */
const learns = (sp, mv) => CS.canLearn(sp, mv);

const USER = ['incineroar', '', 'Blaze', ['Parting Shot', 'Protect']];
const SND = ['kommoo', '', 'Soundproof', ['Swords Dance', 'Protect']];
const BUL = ['kommoo', '', 'Bulletproof', ['Swords Dance', 'Protect']];
const ALLY = ['milotic', '', 'Marvel Scale', ['Protect']];
const BENCH = [['toxapex', '', 'Merciless', ['Protect']], ['garchomp', '', 'Rough Skin', ['Protect']]];

const PROT = { m: 'protect' };
const IDLE = { m: 'swordsdance', t: 0 };
const CASES = [
  { id: 'RED',
    name: 'RED        Parting Shot into a SOUNDPROOF body — the authority names the ability',
    what: 'A sound move refused by Soundproof\'s onTryHit. Every other road into moveClassBlocked in '
        + 'this engine asks moveClassImmuneAttr; the pivot branch printed the line bare.',
    B: [SND, ALLY], p2a: IDLE,
    want: ['immune:p2a:soundproof'], legacy: ['immune:p2a:'] },

  { id: 'CTRL-PROT',
    name: 'CTRL-PROT  the same click into a SHIELDED body — `-activate move: Protect`, not an -immune',
    what: 'Protect answers above the ability, and the authority writes a different line entirely. A '
        + 'fix that pasted the ability onto every refusal in this branch fails here, in both arms.',
    B: [SND, ALLY], p2a: PROT,
    want: ['prot:p2a'], legacy: ['prot:p2a'] },

  { id: 'CTRL-LANDS',
    name: 'CTRL-LANDS the same click into the SAME body carrying BULLETPROOF — it LANDS',
    what: 'Parting Shot is sound and not bullet, so nothing refuses it: the drop lands and there is '
        + 'no -immune line at all. Without this arm, deleting the refusal would pass RED.',
    B: [BUL, ALLY], p2a: IDLE,
    want: ['unboost:p2a:atk', 'unboost:p2a:spa'], legacy: ['unboost:p2a:atk', 'unboost:p2a:spa'] },
];

/* ---- LEGALITY ------------------------------------------------------------------------------------ */
let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
for (const row of [USER, SND, BUL, ALLY].concat(BENCH)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { bad(row[0] + ' is not in this format'); continue; }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) bad(sp.name + ' does not have ' + row[2]);
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { bad(mv + ' is not in this format'); continue; }
    if (!learns(row[0], mv)) bad(sp.name + ' does not learn ' + m.name);
  }
}
{
  const ps = dex.moves.get('partingshot');
  if (!ps.flags.sound) bad('Parting Shot is no longer a sound move, so Soundproof would not answer');
  if (!ps.selfSwitch) bad('Parting Shot no longer pivots, so this is not the pivot branch');
  if (ps.target !== 'normal') bad('Parting Shot now targets ' + ps.target);
  const sd = dex.abilities.get('soundproof');
  if (!sd.onTryHit) bad('Soundproof has lost its onTryHit handler');
  if (dex.abilities.get('bulletproof').onTryHit === undefined) bad('Bulletproof has lost its onTryHit handler');
  /* THE CONTROL BODY IS THE SAME SPECIES WITH A DIFFERENT ABILITY, which is only a control if the
   * OTHER ability does not also refuse a sound move. */
  const bp = String(dex.abilities.get('bulletproof').onTryHit || '');
  if (/sound/.test(bp)) bad('Bulletproof now refuses sound moves too, so CTRL-LANDS is not a control');
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const unsplit = log => {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    if (log[i] === '|split|p1' || log[i] === '|split|p2') { out.push(log[i + 1]); i += 2; continue; }
    out.push(log[i]);
  }
  return out;
};
const norm = s => String(s || '').toLowerCase().replace(/\[from\]\s*/, '').replace(/^ability:\s*/, '')
  .replace(/[^a-z0-9]/g, '');
const SEQ = lines => {
  const out = [];
  for (const l of lines) {
    let m = /^\|-immune\|(p[12][ab])[^|]*(?:\|(.*))?$/.exec(String(l));
    if (m) { out.push('immune:' + m[1] + ':' + norm(m[2])); continue; }
    m = /^\|-activate\|(p[12][ab])[^|]*\|(?:move: )?Protect/i.exec(String(l));
    if (m) { out.push('prot:' + m[1]); continue; }
    m = /^\|-unboost\|(p[12][ab])[^|]*\|(\w+)\|/.exec(String(l));
    if (m) { out.push('unboost:' + m[1] + ':' + m[2]); continue; }
  }
  return out;
};

console.log((RED ? 'RED ARM — MEDI_PIVOT_IMMUNE_BARE=1 (the attribution-less line restored)'
                 : 'CLEAN ARM') + NL);

const attr0 = SEEN.pivotMoveClassAttributed | 0;

for (const c of CASES) {
  const a = G.buildPair(stage([USER, ALLY]).concat(stage(BENCH)));
  const b = G.buildPair(stage(c.B).concat(stage(BENCH)));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const script = [{ p1: [{ m: 'partingshot', t: 0 }, PROT], p2: [c.p2a, PROT] }];
  const r = G.playGame(a, b, 'directed', 'probe_pivot_immune_attr :: ' + c.id, { script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdS = SEQ(unsplit(G.lastSdLog())), meS = SEQ(r.mediTrace || []);

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  ' + JSON.stringify(sdS));
  console.log('    medicham  ' + JSON.stringify(meS));

  claim(JSON.stringify(sdS) === JSON.stringify(c.want),
    c.id + ' — THE AUTHORITY writes ' + JSON.stringify(c.want), 'showdown ' + JSON.stringify(sdS));
  const want = RED ? c.legacy : c.want;
  claim(JSON.stringify(meS) === JSON.stringify(want),
    c.id + ' — this engine writes ' + JSON.stringify(want)
      + (RED ? (JSON.stringify(c.legacy) === JSON.stringify(c.want) ? '   [--red: control, must HOLD]'
                                                                    : '   [--red: the defect restored]') : ''),
    'medicham ' + JSON.stringify(meS));
}

const attrN = (SEEN.pivotMoveClassAttributed | 0) - attr0;
console.log(NL + '  counters this run:  pivotMoveClassAttributed +' + attrN);
if (RED) {
  claim((FAILS.pivotImmuneBareRestored | 0) > 0,
    'the RED arm STAMPED a failure counter — a switch that silently makes the engine wrong is the '
      + 'silent default this repository keeps paying for',
    'MEDFAILS.pivotImmuneBareRestored = ' + (FAILS.pivotImmuneBareRestored | 0));
  claim(attrN === 0, 'the RED arm attributed NOTHING — the knob reached the rule',
    'pivotMoveClassAttributed +' + attrN);
} else {
  claim((FAILS.pivotImmuneBareRestored | 0) === 0,
    'the CLEAN arm carries NO restore stamp', String(FAILS.pivotImmuneBareRestored | 0));
  claim(attrN > 0, 'the pivot branch attributed a move-class refusal at least once — the fixture is '
    + 'not vacuous', 'pivotMoveClassAttributed +' + attrN);
}

console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
