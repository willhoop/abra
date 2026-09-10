#!/usr/bin/env node
/* tests/probe_bond_one_arrival_hitcount.js — A PARENTAL BOND VOLLEY THAT LANDS ONE ARRIVAL IS SILENT
 *   node tests/probe_bond_one_arrival_hitcount.js      node tests/probe_bond_one_arrival_hitcount.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY'S OWN CLAUSE, data/mods/champions/scripts.ts:547-551 (and the identical line at
 * sim/battle-actions.ts:976-978):
 *
 *     if (move.multihit && typeof move.smartTarget !== 'boolean' &&
 *         !(move.hit === 1 && move.multihitType === 'parentalbond')) {
 *       this.battle.add('-hitcount', targets[0], hit - 1);
 *     }
 *
 * The third clause is the whole of this file. A Parental Bond volley whose FIRST arrival kills the
 * target never announces a count — the ability doubled the move and only one of the two doubles
 * happened, so the authority prints nothing rather than `|-hitcount|…|1`. Every OTHER multi-hit
 * family that lands one arrival DOES print `1`: `move.multihitType` is set only by Parental Bond
 * (`onPrepareHit` writes `move.multihit = 2; move.multihitType = 'parentalbond'`).
 *
 * MEASURED ON THE PINNED POOL, release `1be57a100d59`: FIVE narration-only games, every one of them
 * `extra event emitted by medicham2 :: … <> |-hitcount|p?:|1`. The largest was
 * `pair-speedctrl …bo3-2661305652` t5 — a Kangaskhan Last Resort that killed Mr. Rime with arrival 1,
 * where the authority moved straight on to the next move and this engine wrote a count of one.
 *
 * THE FOUR ARMS, AND WHAT EACH ONE REFUSES.
 *
 *   RED    Parental Bond, arrival 1 KILLS       — the authority writes NO `-hitcount`; this engine
 *          wrote `1`. The pool games, staged.
 *   CTRL-A Parental Bond, BOTH arrivals land    — both engines must still write `2`. Without this,
 *          "delete the -hitcount line" passes RED.
 *   CTRL-B THE KNOB. The SAME Kangaskhan-Mega, the SAME Parental Bond on the field, the SAME frail
 *          target — and DOUBLE HIT, a natural two-hit move. Parental Bond refuses a move that is
 *          already multi-hit, so `multihitType` is NOT `parentalbond` and the authority DOES write
 *          `|-hitcount|…|1` when arrival 1 kills. One move changed, opposite answer required. A fix
 *          that suppressed every one-arrival count would pass RED and CTRL-A and FAIL here.
 *   CTRL-C the same Double Hit into the SURVIVOR — `2` on both sides, so CTRL-B's `1` is a fact
 *          about the KO and not about Double Hit.
 *
 * RED FIRST: `MEDI_BOND_ONE_ARRIVAL_HITCOUNT=1` restores the single expression this fix turns on, so
 * the restore reproduces the SAME red rather than a third behaviour, and any run carrying it also
 * carries a non-zero `MEDFAILS.bondOneArrivalHitcountRestored`.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_BOND_ONE_ARRIVAL_HITCOUNT = '1';
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

const KANG = ['kangaskhan', 'Kangaskhanite', 'Scrappy', ['Double-Edge', 'Double Hit', 'Protect']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
/* THE BODY THAT DIES TO ONE ARRIVAL. Pikachu is the frailest legal non-mega body in this format by
 * hp+def, DERIVED rather than chosen from memory, and it is asserted below. */
const FRAIL = ['pikachu', '', 'Static', ['Protect', 'Thunderbolt']];
/* THE BODY THAT SURVIVES BOTH. Snorlax is the bulkiest thing the controls need; what matters is only
 * that it is still standing after arrival 2, which the arms assert directly. */
const TANK = ['snorlax', '', 'Thick Fat', ['Protect', 'Body Slam']];
/* THE MIDDLE BODY, and it exists because CTRL-B needs a KO ON ARRIVAL 1 of a move that is only
 * 35 BP an arrival. Incineroar takes two whole Double Hits and dies to the third volley's FIRST
 * arrival — MEASURED, not chosen: the arm asserts the authority's own `[2, 2, 1]` below, so a body
 * that stopped dying at that moment fails loudly instead of quietly testing nothing. */
const MID = ['incineroar', '', 'Blaze', ['Protect', 'Flare Blitz']];

const PROT = { m: 'protect' };
const CLICK = (m, mega) => ({ m, t: 0, mega: !!mega });
/* THE TARGET MUST NOT BRACE, or the click never lands and every arm reads two empty lists — which is
 * exactly how the first cut of this file reported four quiet failures. Its click is aimed at the
 * BRACED p1b, so it moves no number this file reads. */
const IDLE = m => ({ m, t: 1 });

const DH3 = idle => [{ p1: [CLICK('doublehit', true), PROT], p2: [IDLE(idle), PROT] },
                     { p1: [CLICK('doublehit', false), PROT], p2: [IDLE(idle), PROT] },
                     { p1: [CLICK('doublehit', false), PROT], p2: [IDLE(idle), PROT] }];

const CASES = [
  { name: 'RED     Parental Bond, arrival 1 KILLS   [the authority writes NO -hitcount]',
    part: true, ko: 1, sd: [], me: [],
    A: [KANG, CLEF], B: [FRAIL, CLEF], bond: true,
    what: 'Double-Edge is a single-target move, so Parental Bond doubles it. Arrival 1 kills, so the '
        + 'loop breaks with move.hit === 1 and the authority\'s third clause suppresses the line.',
    script: [{ p1: [CLICK('doubleedge', true), PROT], p2: [IDLE('thunderbolt'), PROT] }] },

  { name: 'CTRL-A  Parental Bond, BOTH arrivals land   [both engines write 2, in BOTH arms]',
    part: false, ko: 0, sd: [2], me: [2],
    A: [KANG, CLEF], B: [TANK, CLEF], bond: true,
    what: 'The same click into a body that survives it. Without this arm, deleting the -hitcount '
        + 'line outright would pass the RED arm.',
    script: [{ p1: [CLICK('doubleedge', true), PROT], p2: [IDLE('bodyslam'), PROT] }] },

  { name: 'CTRL-B  THE KNOB — DOUBLE HIT, arrival 1 KILLS   [the authority DOES write 1]',
    part: false, ko: 1, sd: [2, 2, 1], me: [2, 2, 1],
    A: [KANG, CLEF], B: [MID, CLEF], bond: false,
    what: 'The SAME mega, the SAME Parental Bond on the field, the SAME body — one move changed. '
        + 'Parental Bond refuses an already-multi-hit move, so multihitType is NOT parentalbond and '
        + 'the suppression must NOT apply. Two full volleys, then a third whose FIRST arrival kills: '
        + 'the authority writes 2, 2 and then 1. A fix that killed every one-arrival count fails here.',
    script: DH3('flareblitz') },

  { name: 'CTRL-C  Double Hit into a body that dies to arrival 2   [both engines write 2, 2, 2]',
    part: false, ko: 1, sd: [2, 2, 2], me: [2, 2, 2],
    A: [KANG, CLEF], B: [TANK, CLEF], bond: false,
    what: 'The identical three-turn script one body over. Snorlax dies to the third volley\'s SECOND '
        + 'arrival, so the count is 2 — which is what makes CTRL-B\'s 1 a fact about WHICH arrival '
        + 'killed rather than about Double Hit or about a dying target.',
    script: DH3('bodyslam') },
];

/* ---- LEGALITY AND THE FACTS EVERY ARM RESTS ON --------------------------------------------------- */
let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { bad(row[0] + ' is not in this format'); continue; }
  if (row[1] && !legal(dex.items.get(row[1]))) bad(row[1] + ' is not a legal item in this format');
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) bad(sp.name + ' does not have ' + row[2]);
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { bad(mv + ' is not in this format'); continue; }
    if (!learns(row[0], mv)) bad(sp.name + ' does not learn ' + m.name);
  }
}
{
  const km = dex.species.get('kangaskhanmega');
  if (!legal(km)) bad('Kangaskhan-Mega is not in this format');
  if (dex.abilities.get(Object.values(km.abilities)[0]).id !== 'parentalbond')
    bad('Kangaskhan-Mega\'s ability is ' + JSON.stringify(km.abilities) + ', not Parental Bond');
  const de = dex.moves.get('doubleedge'), dh = dex.moves.get('doublehit');
  if (de.multihit) bad('Double-Edge has become multi-hit; Parental Bond would refuse it');
  if (de.target !== 'normal') bad('Double-Edge now targets ' + de.target + '; a spread move refuses Parental Bond');
  if (dh.multihit !== 2) bad('Double Hit is no longer a fixed two-hit move: ' + JSON.stringify(dh.multihit));
  if (dh.target !== 'normal') bad('Double Hit now targets ' + dh.target);
  /* THE FRAIL BODY IS DERIVED, not remembered. If something frailer appears, this says so rather
   * than the arm quietly failing to KO. */
  const nonMega = dex.species.all().filter(legal).filter(s => !s.name.includes('-Mega'));
  nonMega.sort((a, b) => (a.baseStats.hp + a.baseStats.def) - (b.baseStats.hp + b.baseStats.def));
  if (nonMega[0].id !== FRAIL[0]) {
    console.log('  NOTE — the frailest legal body is now ' + nonMega[0].name + ', not '
      + dex.species.get(FRAIL[0]).name + '. The arm still stands or falls on the KO assertions below.');
  }
  if (!dex.getImmunity('Normal', dex.species.get(FRAIL[0]).types))
    bad(FRAIL[0] + ' is immune to Normal, so neither click can land');
  for (const t of [TANK[0], MID[0]])
    if (!dex.getImmunity('Normal', dex.species.get(t).types))
      bad(t + ' is immune to Normal, so the control using it can never land');
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
const hitcountsOf = lines => lines.map(l => /^\|-hitcount\|[^|]+\|(\d+)/.exec(String(l)))
  .filter(Boolean).map(m => +m[1]);
const faintsOf = lines => lines.filter(l => /^\|faint\|p2a/.test(String(l))).length;

console.log((RED ? 'RED ARM — MEDI_BOND_ONE_ARRIVAL_HITCOUNT=1 (the count restored on a one-arrival bond volley)'
                 : 'CLEAN ARM') + NL);

const bond0 = SEEN.parentalBondPlanned | 0;

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(BENCH('milotic', 'toxapex')));
  const b = G.buildPair(stage(c.B).concat(BENCH('toxapex', 'milotic')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const bp0 = SEEN.parentalBondPlanned | 0;
  const r = G.playGame(a, b, 'directed', 'probe_bond_one_arrival_hitcount :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdL = G.lastSdLog(), meL = r.mediTrace || [];
  const sdC = hitcountsOf(sdL), meC = hitcountsOf(meL);
  const sdK = faintsOf(sdL), meK = faintsOf(meL);
  const planned = (SEEN.parentalBondPlanned | 0) - bp0;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  -hitcount ' + JSON.stringify(sdC) + '   target faints ' + sdK);
  console.log('    medicham  -hitcount ' + JSON.stringify(meC) + '   target faints ' + meK);
  console.log('    parentalBondPlanned this arm: ' + planned);

  /* ---- THE FIXTURE REACHED THE RULE ------------------------------------------------------------- */
  claim(sdK === c.ko && meK === c.ko,
    c.name + ' — the target ' + (c.ko ? 'DIED' : 'SURVIVED') + ' on BOTH engines, which is what '
      + 'decides how many arrivals ran',
    'showdown ' + sdK + ' faint(s), medicham ' + meK + ', wanted ' + c.ko);
  /* THE BOND ARMS MUST HAVE REACHED PARENTAL BOND AND THE DOUBLE HIT ARMS MUST NOT. This is the one
   * counter that says which plan the click actually took; without it a Double-Edge that quietly lost
   * its second arrival would read as a pass. */
  claim((planned > 0) === !!c.bond,
    c.name + ' — the click ' + (c.bond ? 'TOOK' : 'did NOT take') + ' the Parental Bond plan',
    'parentalBondPlanned +' + planned);

  /* ---- THE OUTCOME ----------------------------------------------------------------------------- */
  /* THE WHOLE SEQUENCE, NOT THE FIRST ELEMENT. CTRL-B's finding is its THIRD count and reading
   * `[0]` would have compared two identical 2s and called it a pass — which is exactly what the
   * first cut of this file did. */
  claim(JSON.stringify(sdC) === JSON.stringify(c.sd),
    c.name + ' — THE AUTHORITY writes -hitcount ' + JSON.stringify(c.sd),
    'showdown ' + JSON.stringify(sdC));
  /* ONLY THE RED ARM MOVES. Every control asserts the same value in both arms, which is what makes
   * the restore flag a knob rather than a second engine. */
  const want = RED && c.part ? [1] : c.me;
  claim(JSON.stringify(meC) === JSON.stringify(want),
    c.name + ' — this engine writes -hitcount ' + JSON.stringify(want)
      + (RED ? (c.part ? '   [--red: the defect restored]' : '   [--red: control, must HOLD]') : ''),
    'medicham ' + JSON.stringify(meC));
}

/* ---- THE RESTORE FLAG IS LOUD -------------------------------------------------------------------- */
if (RED) {
  claim((FAILS.bondOneArrivalHitcountRestored | 0) > 0,
    'the RED arm STAMPED a failure counter — a switch that silently makes the engine wrong is the '
      + 'silent default this repository keeps paying for',
    'MEDFAILS.bondOneArrivalHitcountRestored = ' + (FAILS.bondOneArrivalHitcountRestored | 0));
} else {
  claim((FAILS.bondOneArrivalHitcountRestored | 0) === 0,
    'the CLEAN arm carries NO restore stamp', String(FAILS.bondOneArrivalHitcountRestored | 0));
}
claim((SEEN.parentalBondPlanned | 0) > bond0,
  'Parental Bond was planned at least once across the run — the fixture is not vacuous',
  'parentalBondPlanned ' + bond0 + ' -> ' + (SEEN.parentalBondPlanned | 0));

console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
