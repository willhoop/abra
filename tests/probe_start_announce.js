#!/usr/bin/env node
/* tests/probe_start_announce.js — PRESSURE, MOLD BREAKER AND UNNERVE SAY THEIR OWN NAME AS THEY START
 *   node tests/probe_start_announce.js      node tests/probe_start_announce.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY (Champions overrides none of the three; `data/mods/champions/abilities.ts` was read):
 *
 *     pressure     data/abilities.ts:3427-3430   onStart(pokemon) { this.add('-ability', pokemon, 'Pressure'); }
 *     moldbreaker  data/abilities.ts:2679-2682   onStart(pokemon) { this.add('-ability', pokemon, 'Mold Breaker'); }
 *     unnerve      data/abilities.ts:5250-5256   the same line behind a per-state latch
 *
 * and an ability's `onStart` runs AS its `onSwitchIn` at an entry (sim/battle.ts `getCallback`), and
 * AGAIN at the end of `setAbility` (sim/pokemon.ts:1946-1948), which is how a mega evolution reaches
 * it — `runMegaEvo` -> `formeChange(..., true)` -> `setAbility(species.abilities[0], ..., true)`.
 *
 * THE ENGINE HAD EVERY EFFECT AND NONE OF THE LINES. Pressure's PP, Mold Breaker's break and Unnerve's
 * berry refusal are LIVE in the census; `engine/all_mechanics_fire.js` read all three SHOWDOWN-ONLY
 * because the announcement was the only thing that moved the authority's game in the gauntlet. The
 * whole-game differential never saw it: its `ability-announcement` equivalence drops every `-ability`
 * line on both sides. So THIS is the instrument that can see it, and it reads the raw streams.
 *
 * THE ARMS — each is one staged game, both engines, the SAME pinned dice. What is compared is the
 * sequence of `|switch|`, `|detailschange|` and `|-ability|` lines that name an `announcesOnStart`
 * member (read off data/tags.json, never named here), so an unrelated narration change cannot move it.
 *
 *   LEAD-PRESSURE   Absol with Pressure leads.                         both engines: switch ... -ability Pressure
 *   LEAD-UNNERVE    Aerodactyl with Unnerve leads.                     both engines: switch ... -ability Unnerve
 *   SWITCH-MB       Basculegion with Mold Breaker comes in on turn 1.  both engines: switch, -ability Mold Breaker
 *   MEGA-MB         Gyarados megas into Mold Breaker on turn 1.        both engines: detailschange, -ability Mold Breaker
 *   CTRL-*          the SAME bodies on a non-member ability (Super Luck, Rock Head, Swift Swim), and a
 *                   mega into Tough Claws: NO member line in EITHER engine — so the clean arms are a
 *                   statement about the ANNOUNCEMENT and not about the fixture.
 *
 * RED FIRST: `--red` arms MEDI_START_ANNOUNCE_SILENT=1, which restores the pre-fix engine. The four
 * member arms must then FAIL against the authority (the engine is silent), the controls must HOLD,
 * and the restore stamp must be set.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_START_ANNOUNCE_SILENT = '1';
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
/* THE COUNTERS MUST COME FROM THE RELEASE THE GAMES RAN ON. `game_differential.js` opens `--release <id>`;
 * a bare `ER.open()` opens whatever `data/engine-release.json` points at, so a pinned run read its
 * `startAnnounced` counter off a DIFFERENT module instance and reported the fixture vacuous while every
 * arm passed. Caught by the coordinator on `--release d8526fc9ba28` with the pointer at 4c9b0cc4a4da. */
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

/* ---- THE MEMBERSHIP, READ OFF THE ARTIFACT ------------------------------------------------------- */
const TAGS = require(D('data', 'tags.json'));
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const MEMBERS = new Set(Object.keys(TAGS.abilities)
  .filter(k => TAGS.abilities[k].params && TAGS.abilities[k].params.announcesOnStart));
console.log('announcesOnStart members (data/tags.json): ' + [...MEMBERS].join(', '));
for (const need of ['pressure', 'moldbreaker', 'unnerve'])
  if (!MEMBERS.has(need)) { console.log('NOT RUN — ' + need + ' is no longer an announcesOnStart member, '
    + 'so this probe would be asking nothing. This is not a pass.'); process.exit(2); }

/* ---- THE FIXTURE, CHECKED BY THE VALIDATOR'S OWN RULE ---------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';

const FILL1 = ['milotic', '', 'Marvel Scale', ['Protect']];
const FILL2 = ['toxapex', '', 'Merciless', ['Protect']];
const FILL3 = ['rotom', '', 'Levitate', ['Protect']];
const FILL4 = ['sinistcha', '', 'Heatproof', ['Protect']];
const PROT = { m: 'protect' };
const PASS1 = [{ p1: [PROT, PROT], p2: [PROT, PROT] }];

const CASES = [
  { id: 'LEAD-PRESSURE', member: true,
    A: [['absol', '', 'Pressure', ['Protect']], FILL1], Abench: [FILL2, FILL3],
    B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: PASS1 },
  { id: 'CTRL-PRESSURE', member: false,
    A: [['absol', '', 'Super Luck', ['Protect']], FILL1], Abench: [FILL2, FILL3],
    B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: PASS1 },
  { id: 'LEAD-UNNERVE', member: true,
    A: [['aerodactyl', '', 'Unnerve', ['Protect']], FILL1], Abench: [FILL2, FILL3],
    B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: PASS1 },
  { id: 'CTRL-UNNERVE', member: false,
    A: [['aerodactyl', '', 'Rock Head', ['Protect']], FILL1], Abench: [FILL2, FILL3],
    B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: PASS1 },
  { id: 'SWITCH-MB', member: true,
    A: [FILL1, FILL2], Abench: [['basculegion', '', 'Mold Breaker', ['Protect']], FILL3],
    B: [FILL4, FILL2], Bbench: [FILL1, FILL3],
    script: [{ p1: [{ sw: 'basculegion' }, PROT], p2: [PROT, PROT] }, { p1: [PROT, PROT], p2: [PROT, PROT] }] },
  { id: 'CTRL-SWITCH-MB', member: false,
    A: [FILL1, FILL2], Abench: [['basculegion', '', 'Swift Swim', ['Protect']], FILL3],
    B: [FILL4, FILL2], Bbench: [FILL1, FILL3],
    script: [{ p1: [{ sw: 'basculegion' }, PROT], p2: [PROT, PROT] }, { p1: [PROT, PROT], p2: [PROT, PROT] }] },
  { id: 'MEGA-MB', member: true,
    A: [['gyarados', 'Gyaradosite', 'Moxie', ['Protect']], FILL1], Abench: [FILL2, FILL3],
    B: [FILL4, FILL2], Bbench: [FILL1, FILL3],
    script: [{ p1: [{ m: 'protect', mega: true }, PROT], p2: [PROT, PROT] }] },
  { id: 'CTRL-MEGA', member: false,
    A: [['aerodactyl', 'Aerodactylite', 'Rock Head', ['Protect']], FILL1], Abench: [FILL2, FILL3],
    B: [FILL4, FILL2], Bbench: [FILL1, FILL3],
    script: [{ p1: [{ m: 'protect', mega: true }, PROT], p2: [PROT, PROT] }] },
];

let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
for (const c of CASES) for (const row of [...c.A, ...c.Abench, ...c.B, ...c.Bbench]) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { bad(row[0] + ' is not in this format'); continue; }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) bad(sp.name + ' does not have ' + row[2]);
  if (row[1]) { const it = dex.items.get(row[1]); if (!legal(it)) bad(row[1] + ' is not in this format'); }
  for (const mv of row[3]) {
    if (!legal(dex.moves.get(mv))) { bad(mv + ' is not in this format'); continue; }
    if (!CS.canLearn(row[0], mv)) bad(sp.name + ' does not learn ' + mv);
  }
}
/* THE MEGA ARMS REST ON TWO FACTS, READ, NOT RECALLED. */
{
  const gm = dex.species.get(dex.items.get('gyaradosite').megaStone && Object.values(dex.items.get('gyaradosite').megaStone)[0]);
  if (!legal(gm) || norm(gm.abilities[0]) !== 'moldbreaker') bad('Gyaradosite no longer makes a Mold Breaker mega');
  const am = dex.species.get(dex.items.get('aerodactylite').megaStone && Object.values(dex.items.get('aerodactylite').megaStone)[0]);
  if (!legal(am) || MEMBERS.has(norm(am.abilities[0]))) bad('Aerodactylite no longer makes a NON-member mega; the control would ask nothing');
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
const SEQ = lines => {
  const out = [];
  for (const l of lines) {
    const f = String(l).split('|');
    const who = /^(p[12][ab])/.exec(f[2] || '');
    if (f[1] === 'switch' && who) out.push('switch:' + who[1] + ':' + norm(String(f[2]).slice(5)));
    else if (f[1] === 'detailschange' && who) out.push('detailschange:' + who[1]);
    else if (f[1] === '-ability' && who && MEMBERS.has(norm(f[3])) && !f[4]) out.push('ability:' + who[1] + ':' + norm(f[3]));
  }
  return out;
};

console.log((RED ? 'RED ARM — MEDI_START_ANNOUNCE_SILENT=1 (the engine as it stood: effects, no lines)'
                 : 'CLEAN ARM') + NL);
const seen0 = SEEN.startAnnounced | 0;

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(stage(c.Abench)));
  const b = G.buildPair(stage(c.B).concat(stage(c.Bbench)));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.id + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_start_announce :: ' + c.id, { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.id + '   ' + r.err); fails++; continue; }
  const sdS = SEQ(unsplit(G.lastSdLog()));
  const meS = SEQ(r.mediTrace || []);
  const sdAnn = sdS.filter(x => /^ability:/.test(x)), meAnn = meS.filter(x => /^ability:/.test(x));
  console.log(NL + c.id);
  console.log('    showdown  ' + JSON.stringify(sdS));
  console.log('    medicham  ' + JSON.stringify(meS));
  /* THE AUTHORITY MUST SAY WHAT THE ARM CLAIMS, or the arm is asking nothing. */
  claim(c.member ? sdAnn.length === 1 : sdAnn.length === 0,
    c.id + ' — THE AUTHORITY writes ' + (c.member ? 'exactly ONE' : 'NO') + ' member announcement',
    'showdown ' + JSON.stringify(sdAnn));
  if (RED && c.member) {
    claim(meAnn.length === 0, c.id + ' — [--red] this engine is SILENT again (the defect restored)',
      'medicham ' + JSON.stringify(meAnn));
  } else {
    claim(JSON.stringify(meS) === JSON.stringify(sdS),
      c.id + ' — this engine writes the SAME switch/detailschange/announcement sequence'
        + (RED ? '   [--red: control, must HOLD]' : ''),
      'showdown ' + JSON.stringify(sdS) + NL + '          medicham ' + JSON.stringify(meS));
  }
}

const n = (SEEN.startAnnounced | 0) - seen0;
console.log(NL + '  counters this run:  startAnnounced +' + n);
if (RED) {
  claim((FAILS.startAnnounceSilentRestored | 0) > 0, 'the RED arm STAMPED its restore counter',
    'MEDFAILS.startAnnounceSilentRestored = ' + (FAILS.startAnnounceSilentRestored | 0));
  claim(n === 0, 'the RED arm announced NOTHING — the knob reached the rule', 'startAnnounced +' + n);
} else {
  claim((FAILS.startAnnounceSilentRestored | 0) === 0, 'the CLEAN arm carries NO restore stamp',
    String(FAILS.startAnnounceSilentRestored | 0));
  claim(n >= 4, 'the four member arms announced at least four times — the fixture is not vacuous',
    'startAnnounced +' + n);
}
console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
