#!/usr/bin/env node
/* tests/probe_entrydrop_announce_shape.js — AN ENTRY DROP ANNOUNCES IN ITS OWN SHAPE, NOT INTIMIDATE'S
 *   node tests/probe_entrydrop_announce_shape.js      node tests/probe_entrydrop_announce_shape.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY, BOTH HANDLERS READ WHOLE (`/data/mods/champions/abilities.ts` overrides neither):
 *
 *   intimidate       onStart(pokemon) {
 *                      let activated = false;
 *                      for (const target of pokemon.adjacentFoes()) {
 *                        if (!activated) { this.add('-ability', pokemon, 'Intimidate', 'boost'); activated = true; }
 *                        ...
 *   supersweetsyrup  onStart(pokemon) {                                   data/abilities.ts:4705-4716
 *                      if (pokemon.syrupTriggered) return;
 *                      pokemon.syrupTriggered = true;
 *                      this.add('-ability', pokemon, 'Supersweet Syrup');       // BARE
 *                      for (const target of pokemon.adjacentFoes()) { ... }
 *
 * TWO DIFFERENCES AND BOTH ARE ON THE WIRE:
 *   the FOURTH FIELD — `boost`, the protocol's marker for "this announcement is about a stat change" —
 *   is Intimidate's and not Syrup's; and WHERE the line sits relative to the foe loop, which decides
 *   whether a carrier with no adjacent foe says anything at all.
 *
 * THIS ENGINE WROTE ONE LINE FOR BOTH — `TR.ab(m, m.ability, 'boost')`, unconditional — so every
 * Supersweet Syrup entry emitted a fourth field the authority does not write. Filed as `-ability field
 * 4`: 11 of the 89 protocol divergences across the three gate lattices on release `834713ccb303`, and
 * the whole of the `supersweetsyrup` deliberate-roster row.
 *
 * THE EXPECTED SHAPE IS READ OFF `onSwitchInDrop.announce` (data/tags.json), NEVER TYPED HERE, so a
 * third member arrives with its own shape and this probe follows it. What is compared is the
 * INTERLEAVED sequence of member `|-ability|` lines (with their fourth field) and the
 * `|-unboost|`/`|-immune|` lines that follow, so the ORDER is asserted and not just the presence.
 *
 * THE RED ARM IS ASYMMETRIC AND THE PROBE SAYS SO OUT LOUD. `MEDI_ENTRYDROP_ANNOUNCE_INTIMIDATE_SHAPE=1`
 * restores the single unconditional Intimidate line for every member, so the INTIMIDATE arms are
 * CONTROLS under the knob (their line was always right) and only the arms whose derived tail is not
 * `boost` may part. An arm asserting that Intimidate parts would be asserting a defect that never
 * existed.
 *
 * NARRATION ONLY, ASSERTED AND NOT CLAIMED: every arm asserts `stateDiv === null` and that every
 * compared board boundary agreed, on the clean arm AND under the knob.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_ENTRYDROP_ANNOUNCE_INTIMIDATE_SHAPE = '1';
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
const _ri = process.argv.indexOf('--release');
const REL = ER.open(_ri >= 0 ? process.argv[_ri + 1] : undefined);
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

/* ---- THE MEMBERSHIP AND THE SHAPE, READ OFF THE ARTIFACT, PRINTED FIRST ------------------------- */
const TAGS = require(D('data', 'tags.json'));
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const MEMBERS = Object.keys(TAGS.abilities)
  .filter(k => TAGS.abilities[k].params && TAGS.abilities[k].params.onSwitchInDrop);
console.log('onSwitchInDrop members and the announcement shape derived for each (data/tags.json):');
for (const k of MEMBERS)
  console.log('    ' + k.padEnd(18) + JSON.stringify(TAGS.abilities[k].params.onSwitchInDrop.announce));
const shapeOf = ab => ((TAGS.abilities[norm(ab)] || {}).params || {}).onSwitchInDrop
  && TAGS.abilities[norm(ab)].params.onSwitchInDrop.announce;
for (const need of ['intimidate', 'supersweetsyrup']) {
  if (!MEMBERS.includes(need)) {
    console.log('NOT RUN — ' + need + ' is no longer an onSwitchInDrop member. This is not a pass.');
    process.exit(2);
  }
  if (!shapeOf(need)) {
    console.log('NOT RUN — ' + need + ' carries no derived `announce` shape, so data/tags.json predates '
      + 'the derivation this probe exists to check. Regenerate it. This is not a pass.');
    process.exit(2);
  }
}
/* THE TWO MEMBERS MUST DIFFER, or the whole probe is one claim wearing two names. */
if (shapeOf('intimidate').tail === shapeOf('supersweetsyrup').tail) {
  console.log('NOT RUN — the two members now derive the SAME fourth field, so nothing here '
    + 'distinguishes the shapes. This is not a pass.');
  process.exit(2);
}

/* ---- THE FIXTURE, CHECKED BY THE VALIDATOR'S OWN RULE -------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';

const FILL1 = ['milotic', '', 'Marvel Scale', ['Protect']];
const FILL2 = ['toxapex', '', 'Merciless', ['Protect']];
const FILL3 = ['rotom', '', 'Levitate', ['Protect']];
const FILL4 = ['sinistcha', '', 'Heatproof', ['Protect']];
const SYRUP = ['hydrapple', '', 'Supersweet Syrup', ['Protect']];
const NOSYR = ['hydrapple', '', 'Regenerator', ['Protect']];
const INTIM = ['incineroar', '', 'Intimidate', ['Protect']];
const NOINT = ['incineroar', '', 'Blaze', ['Protect']];
const PROT = { m: 'protect' };
const PASS1 = [{ p1: [PROT, PROT], p2: [PROT, PROT] }];
const OUT_BACK = who => [{ p1: [{ sw: 'toxapex' }, PROT], p2: [PROT, PROT] },
                         { p1: [{ sw: who }, PROT], p2: [PROT, PROT] },
                         { p1: [PROT, PROT], p2: [PROT, PROT] }];

const CASES = [
  { id: 'SYRUP-LEAD', ab: 'supersweetsyrup', want: 1,
    A: [SYRUP, FILL1], Abench: [FILL2, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: PASS1 },
  { id: 'CTRL-SYRUP', ab: null, want: 0,
    A: [NOSYR, FILL1], Abench: [FILL2, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: PASS1 },
  { id: 'INTIM-LEAD', ab: 'intimidate', want: 1,
    A: [INTIM, FILL1], Abench: [FILL2, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: PASS1 },
  { id: 'CTRL-INTIM', ab: null, want: 0,
    A: [NOINT, FILL1], Abench: [FILL2, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: PASS1 },
  /* THE ONCE-PER-BATTLE PAIR. Syrup's announcement sits UNDER its `syrupTriggered` guard, so a return
   * trip writes ONE line in total; Intimidate has no such guard and writes TWO. The pair is what makes
   * "one" a fact about the ability rather than about the script. */
  { id: 'SYRUP-RETURN', ab: 'supersweetsyrup', want: 1,
    A: [SYRUP, FILL1], Abench: [FILL2, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3],
    script: OUT_BACK('hydrapple') },
  { id: 'INTIM-RETURN', ab: 'intimidate', want: 2,
    A: [INTIM, FILL1], Abench: [FILL2, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3],
    script: OUT_BACK('incineroar') },
];

let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
for (const c of CASES) for (const row of [...c.A, ...c.Abench, ...c.B, ...c.Bbench]) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { bad(row[0] + ' is not in this format'); continue; }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) bad(sp.name + ' does not have ' + row[2]);
  for (const mv of row[3]) {
    if (!legal(dex.moves.get(mv))) { bad(mv + ' is not in this format'); continue; }
    if (!CS.canLearn(row[0], mv)) bad(sp.name + ' does not learn ' + mv);
  }
}
for (const ab of ['regenerator', 'blaze'])
  if (MEMBERS.includes(ab)) bad(ab + ' is now an onSwitchInDrop member; the controls would ask nothing');
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
const MEMSET = new Set(MEMBERS);
const SEQ = lines => {
  const out = [];
  for (const l of lines) {
    const f = String(l).split('|');
    const who = /^(p[12][ab])/.exec(f[2] || '');
    if (!who) continue;
    if (f[1] === '-ability' && MEMSET.has(norm(f[3])))
      out.push('ANN:' + who[1] + ':' + norm(f[3]) + ':' + (f[4] ? norm(f[4]) : 'BARE'));
    else if (f[1] === '-unboost' || f[1] === '-boost') out.push(f[1].slice(1) + ':' + who[1] + ':' + norm(f[3]) + ':' + f[4]);
    else if (f[1] === '-immune') out.push('immune:' + who[1]);
  }
  return out;
};

console.log(NL + (RED ? 'RED ARM — MEDI_ENTRYDROP_ANNOUNCE_INTIMIDATE_SHAPE=1 (every member announces in '
                      + 'Intimidate\'s shape, which is the engine as it stood)' : 'CLEAN ARM') + NL);
const seen0 = SEEN.entryDropAnnounced | 0;

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(stage(c.Abench)));
  const b = G.buildPair(stage(c.B).concat(stage(c.Bbench)));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.id + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_entrydrop_announce_shape :: ' + c.id, { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.id + '   ' + r.err); fails++; continue; }
  const sdS = SEQ(unsplit(G.lastSdLog()));
  const meS = SEQ(r.mediTrace || []);
  const sdAnn = sdS.filter(x => /^ANN:/.test(x)), meAnn = meS.filter(x => /^ANN:/.test(x));
  const shape = c.ab ? shapeOf(c.ab) : null;
  console.log(NL + c.id + (shape ? '   [derived shape ' + JSON.stringify(shape) + ']' : ''));
  console.log('    showdown  ' + JSON.stringify(sdS));
  console.log('    medicham  ' + JSON.stringify(meS));
  /* 1. THE AUTHORITY MUST SAY WHAT THE ARM CLAIMS — how many, and in which shape. */
  claim(sdAnn.length === c.want,
    c.id + ' — THE AUTHORITY writes exactly ' + c.want + ' member announcement(s)', JSON.stringify(sdAnn));
  if (shape) {
    const wantTail = shape.tail ? norm(shape.tail) : 'BARE';
    claim(sdAnn.every(x => x.endsWith(':' + wantTail)),
      c.id + ' — THE AUTHORITY\'s fourth field is exactly what the tag derived (' + wantTail + ')',
      JSON.stringify(sdAnn));
  }
  /* 2. THE ENGINE. Under the knob only a member whose derived tail is NOT `boost` may part; a member
   *    whose tail IS `boost` is a control, because the knob restores precisely its line. */
  const mustPart = RED && shape && shape.tail !== 'boost';
  if (mustPart) {
    claim(JSON.stringify(meS) !== JSON.stringify(sdS),
      c.id + ' — [--red] this engine writes Intimidate\'s shape again and PARTS from the authority',
      'medicham ' + JSON.stringify(meAnn));
  } else {
    claim(JSON.stringify(meS) === JSON.stringify(sdS),
      c.id + ' — this engine writes the SAME announcement/stat sequence'
        + (RED ? '   [--red: control — the knob restores THIS member\'s own line, so it must HOLD]' : ''),
      'showdown ' + JSON.stringify(sdS) + NL + '          medicham ' + JSON.stringify(meS));
  }
  claim(r.stateDiv === null && r.boundaries === r.boundariesAgreed,
    c.id + ' — NO BOARD LEAF PARTS (' + r.boundariesAgreed + '/' + r.boundaries + ' boundaries agreed)',
    'stateDiv=' + JSON.stringify(r.stateDiv));
}

const n = (SEEN.entryDropAnnounced | 0) - seen0;
console.log(NL + '  counters this run:  entryDropAnnounced +' + n
  + '   entryDropAnnounceSkippedNoFoe ' + (SEEN.entryDropAnnounceSkippedNoFoe | 0)
  + '   entryDropAnnounceShapeMissing ' + (FAILS.entryDropAnnounceShapeMissing | 0));
claim((FAILS.entryDropAnnounceShapeMissing | 0) === 0,
  'no entry-drop member reached the site without a derived `announce` shape',
  'first: ' + (FAILS.entryDropAnnounceShapeMissingFirst || '(none)'));
if (RED) {
  claim((FAILS.entryDropAnnounceIntimidateShapeRestored | 0) > 0, 'the RED arm STAMPED its restore counter',
    'MEDFAILS.entryDropAnnounceIntimidateShapeRestored = ' + (FAILS.entryDropAnnounceIntimidateShapeRestored | 0));
} else {
  claim((FAILS.entryDropAnnounceIntimidateShapeRestored | 0) === 0, 'the CLEAN arm carries NO restore stamp',
    String(FAILS.entryDropAnnounceIntimidateShapeRestored | 0));
}
claim(n >= 5, 'the member arms announced at least five times — the fixture is not vacuous',
  'entryDropAnnounced +' + n);
console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
