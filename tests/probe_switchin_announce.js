#!/usr/bin/env node
/* tests/probe_switchin_announce.js — CLOUD NINE SAYS ITS OWN NAME AS THE BODY WALKS IN
 *   node tests/probe_switchin_announce.js      node tests/probe_switchin_announce.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY, READ WHOLE (`/data/mods/champions/abilities.ts` overrides neither — grepped, no
 * match for `cloudnine` or `airlock`):
 *
 *     cloudnine  data/abilities.ts:534-538      airlock  data/abilities.ts:90-94 (identical)
 *       onSwitchIn(pokemon) {
 *         // Cloud Nine does not activate when Skill Swapped or when Neutralizing Gas leaves the field
 *         this.add('-ability', pokemon, 'Cloud Nine');
 *         ((this.effect as any).onStart as (p: Pokemon) => void).call(this, pokemon);
 *       }
 *
 * THREE FACTS, AND EACH HAS AN ARM:
 *   1. the line is BARE — `|-ability|BODY|Cloud Nine`, three fields, no `boost` marker;
 *   2. it is written EVERY time the body ARRIVES, including on a return (there is no latch);
 *   3. it is NOT written when the ability is acquired by any other road. `onSwitchIn` is the
 *      ability's OWN handler at an entry, so `onStart` — which is what a mega, a Trace, a Skill Swap
 *      and a Neutralizing-Gas departure raise — writes nothing. The handler's own comment says so.
 *
 * Fact 3 is the one that decides whether the fix used the right door, and it is why this is a
 * separate tag from `announcesOnStart` rather than a wider version of it. The SKILLSWAP-DOOR arm
 * hands Cloud Nine to a second body mid-battle and claims the authority writes NO second bare line.
 *
 * WHAT IS COMPARED: the sequence of `|switch|`, `|detailschange|` and BARE `|-ability|` lines naming
 * an `announcesOnSwitchIn` member — read off data/tags.json, never named here — so an unrelated
 * narration change cannot move this probe. A rewrite line (`|-ability|X|Cloud Nine|[from] move: Skill
 * Swap`) carries a fourth field and is deliberately excluded.
 *
 * NARRATION ONLY, ASSERTED AND NOT CLAIMED: every arm asserts `stateDiv === null` and that every
 * compared board boundary agreed, on the clean arm AND under the knob.
 *
 * RED FIRST: `--red` arms MEDI_SWITCHIN_ANNOUNCE_SILENT=1, which is this engine for every game it has
 * ever played. The member arms must then FAIL against the authority, the controls must HOLD, and the
 * restore stamp must be set.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_SWITCHIN_ANNOUNCE_SILENT = '1';
/* --red-copy IS A SECOND RED ARM FOR A SECOND KNOB, AND IT IS NOT THE SAME DEFECT.
 * `--red` silences the line everywhere. `--red-copy` keeps the line and puts it back BELOW the
 * Imposter/Trace copy, which is where this engine wrote it from 2026-09-20 until the fix: a body that
 * ARRIVED with Imposter or Trace and ACQUIRED Cloud Nine inside the same switch-in pass then announced
 * an ability it did not walk in with. The authority cannot: `Battle#fieldEvent` builds its whole
 * handler list ONCE (sim/battle.ts:490-506) before `speedSort`, so the only `onSwitchIn` handler the
 * body ever has is the one it entered with, and `transformInto` -> `setAbility(..., isTransform=true)`
 * raises `Start` and never `SwitchIn` (sim/pokemon.ts:1358, :1946-1949). */
const RED_COPY = process.argv.includes('--red-copy');
if (RED_COPY) process.env.MEDI_SWITCHIN_ANNOUNCE_AFTER_COPY = '1';
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
/* THE COUNTERS MUST COME FROM THE RELEASE THE GAMES RAN ON — see probe_start_announce.js for the
 * pinned-run failure this line exists to prevent. */
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

/* ---- THE MEMBERSHIP, READ OFF THE ARTIFACT, PRINTED BEFORE ANYTHING USES IT --------------------- */
const TAGS = require(D('data', 'tags.json'));
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const MEMBERS = new Set(Object.keys(TAGS.abilities)
  .filter(k => TAGS.abilities[k].params && TAGS.abilities[k].params.announcesOnSwitchIn));
console.log('announcesOnSwitchIn members with a legal carrier (data/tags.json): ' + [...MEMBERS].join(', '));
for (const k of MEMBERS) console.log('    ' + k + '  ' + JSON.stringify(TAGS.abilities[k].params.announcesOnSwitchIn));
if (!MEMBERS.has('cloudnine')) {
  console.log('NOT RUN — cloudnine is no longer an announcesOnSwitchIn member, so every arm below '
    + 'would be asking nothing. This is not a pass.');
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
/* TWO MOVES ON THE ALTARIA, AND THE SECOND ONE IS LOAD-BEARING. `skillswap` carries `protect: 1`
 * (read: `dex.moves.get('skillswap').flags`), so a target that clicks Protect BLOCKS the swap — the
 * first draft of the SKILLSWAP-DOOR arm did exactly that, the log read `|-activate|p1a|move: Protect`
 * with no rewrite at all, and the arm was green while handing Cloud Nine to nobody. Roost is the
 * self-aimed filler that lets the swap land. */
const CN_ALT = ['altaria', '', 'Cloud Nine', ['Protect', 'Roost']];
const NO_ALT = ['altaria', '', 'Natural Cure', ['Protect']];
const CN_DRA = ['drampa', '', 'Cloud Nine', ['Protect']];
const NO_DRA = ['drampa', '', 'Berserk', ['Protect']];
const ZAM = ['alakazam', '', 'Magic Guard', ['Skill Swap', 'Protect']];
/* THE TWO COPY DOORS. Ditto is the format's ONLY legal Imposter carrier and Transform is the ONLY
 * move it learns (DERIVED: `dex.species.get('ditto').abilities`, `CS.canLearn('ditto', …)`), so the
 * script clicks Protect off the COPIED moveset — which is itself evidence the transform landed, and
 * is checked directly by `copyMustLand` below. Imposter aims at the DIAGONAL
 * (`pokemon.side.foe.active[length - 1 - position]`, data/abilities.ts:2111), so the Ditto goes in
 * slot b and the Cloud Nine body in the foe's slot a. Gardevoir is a legal Trace carrier. */
const DITTO = ['ditto', '', 'Imposter', ['Transform']];
const TRACER = ['gardevoir', '', 'Trace', ['Protect']];
const NO_TRACER = ['gardevoir', '', 'Synchronize', ['Protect']];
const PROT = { m: 'protect' };
const PASS1 = [{ p1: [PROT, PROT], p2: [PROT, PROT] }];
const SW_IN = [{ p1: [{ sw: 'drampa' }, PROT], p2: [PROT, PROT] }, { p1: [PROT, PROT], p2: [PROT, PROT] }];

const CASES = [
  /* 1 + 2 — the line itself, and the same body with the ability removed. */
  { id: 'LEAD-ALTARIA', want: 1,
    A: [CN_ALT, FILL1], Abench: [FILL2, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: PASS1 },
  { id: 'CTRL-LEAD-ALTARIA', want: 0,
    A: [NO_ALT, FILL1], Abench: [FILL2, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: PASS1 },
  { id: 'LEAD-DRAMPA', want: 1,
    A: [CN_DRA, FILL1], Abench: [FILL2, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: PASS1 },
  { id: 'CTRL-LEAD-DRAMPA', want: 0,
    A: [NO_DRA, FILL1], Abench: [FILL2, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: PASS1 },
  /* 3 + 4 — a REPLACEMENT is an arrival too, and it is a different road in this engine
   * (`runEntryPass`) from the lead pass. */
  { id: 'SWITCH-DRAMPA', want: 1,
    A: [FILL1, FILL2], Abench: [CN_DRA, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: SW_IN },
  { id: 'CTRL-SWITCH-DRAMPA', want: 0,
    A: [FILL1, FILL2], Abench: [NO_DRA, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3], script: SW_IN },
  /* 5 — NO LATCH. The body leads, pivots out and comes back: TWO lines, not one. */
  { id: 'RETURN-ALTARIA', want: 2,
    A: [CN_ALT, FILL1], Abench: [FILL2, FILL3], B: [FILL4, FILL2], Bbench: [FILL1, FILL3],
    script: [{ p1: [{ sw: 'toxapex' }, PROT], p2: [PROT, PROT] },
             { p1: [{ sw: 'altaria' }, PROT], p2: [PROT, PROT] },
             { p1: [PROT, PROT], p2: [PROT, PROT] }] },
  /* 6 — THE DOOR. Alakazam Skill Swaps Cloud Nine off the Altaria. The acquiring body raises
   * `onStart`, never `onSwitchIn`, so the authority writes NO second bare line — one, from the
   * Altaria's own lead. An engine that had put this rule in `applyEntryEffects` (the mega / copy /
   * swap road) would write two. */
  { id: 'SKILLSWAP-DOOR', want: 1, swapMustLand: true,
    A: [CN_ALT, FILL1], Abench: [FILL2, FILL3], B: [ZAM, FILL2], Bbench: [FILL1, FILL3],
    script: [{ p1: [{ m: 'roost' }, PROT], p2: [{ m: 'skillswap', t: 0 }, PROT] },
             { p1: [PROT, PROT], p2: [PROT, PROT] }] },
  /* 7 + 8 — THE COPY DOORS, 2026-09-20. A body that ARRIVES with Imposter or Trace and ACQUIRES the
   * member ability inside the same switch-in pass announces NOTHING: the authority's handler list for
   * `fieldEvent('SwitchIn')` is built once, before the sort, so Cloud Nine's `onSwitchIn` is simply not
   * in it, and the copy raises `Start` only. One bare line in each arm — the FOE's own — and it must be
   * at the foe's address, which is why the whole sequence is compared rather than the count.
   * This is the class the 1,950-game gate lattice caught on release `6a0582efeda6`:
   *   showdown  |-ability|p2a: Drampa|Cloud Nine      medicham  |-ability|p1b: Ditto|cloudnine */
  { id: 'IMPOSTER-DOOR', want: 1, copyMustLand: 'imposter',
    A: [FILL1, DITTO], Abench: [FILL2, FILL3], B: [CN_DRA, FILL4], Bbench: [FILL1, FILL3],
    script: PASS1 },
  { id: 'CTRL-IMPOSTER-DOOR', want: 0, copyMustLand: 'imposter',
    A: [FILL1, DITTO], Abench: [FILL2, FILL3], B: [NO_DRA, FILL4], Bbench: [FILL1, FILL3],
    script: PASS1 },
  /* BOTH FOES CARRY THE MEMBER, AND THAT IS NOT DECORATION. Trace copies a RANDOM live foe
   * (data/abilities.ts, `trace` -> `this.sample(possibleTargets)`); the first draft of this arm put
   * Cloud Nine on ONE foe, the draw took the OTHER one's Heatproof, and the arm was green while
   * tracing nothing this probe is about — which the landing check below is what caught. */
  { id: 'TRACE-DOOR', want: 2, copyMustLand: 'trace', tracedMustBeMember: true,
    A: [TRACER, FILL1], Abench: [FILL2, FILL3], B: [CN_DRA, CN_ALT], Bbench: [FILL1, FILL3],
    script: PASS1 },
  { id: 'CTRL-TRACE-DOOR', want: 2,
    A: [NO_TRACER, FILL1], Abench: [FILL2, FILL3], B: [CN_DRA, CN_ALT], Bbench: [FILL1, FILL3],
    script: PASS1 },
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
/* THE CONTROL ARMS REST ON THE CONTROL ABILITY *NOT* BEING A MEMBER, which is read, not assumed. */
for (const ab of ['naturalcure', 'berserk', 'magicguard', 'imposter', 'trace', 'synchronize'])
  if (MEMBERS.has(ab)) bad(ab + ' is now an announcesOnSwitchIn member; the controls would ask nothing');
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
    /* BARE only — `!f[4]` drops the `[from] move: Skill Swap` rewrite line, which is a different
     * event written by a different call site and is not this probe's claim. */
    else if (f[1] === '-ability' && who && MEMBERS.has(norm(f[3])) && !f[4]) out.push('ability:' + who[1] + ':' + norm(f[3]));
  }
  return out;
};

console.log(NL + (RED ? 'RED ARM — MEDI_SWITCHIN_ANNOUNCE_SILENT=1 (the engine as it stood: the weather '
                      + 'suppression, none of the lines)'
                : RED_COPY ? 'RED ARM — MEDI_SWITCHIN_ANNOUNCE_AFTER_COPY=1 (the announcement back BELOW '
                      + 'the Imposter/Trace copy, where it was until 2026-09-20)'
                : 'CLEAN ARM') + NL);
const seen0 = SEEN.switchInAnnounced | 0;

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(stage(c.Abench)));
  const b = G.buildPair(stage(c.B).concat(stage(c.Bbench)));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.id + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_switchin_announce :: ' + c.id, { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.id + '   ' + r.err); fails++; continue; }
  const sdS = SEQ(unsplit(G.lastSdLog()));
  const meS = SEQ(r.mediTrace || []);
  const sdAnn = sdS.filter(x => /^ability:/.test(x)), meAnn = meS.filter(x => /^ability:/.test(x));
  console.log(NL + c.id);
  console.log('    showdown  ' + JSON.stringify(sdS));
  console.log('    medicham  ' + JSON.stringify(meS));
  /* THE AUTHORITY MUST SAY WHAT THE ARM CLAIMS, or the arm is asking nothing. */
  claim(sdAnn.length === c.want,
    c.id + ' — THE AUTHORITY writes exactly ' + c.want + ' bare member announcement(s)',
    'showdown ' + JSON.stringify(sdAnn));
  if (RED && c.want > 0) {
    claim(meAnn.length === 0, c.id + ' — [--red] this engine is SILENT again (the defect restored)',
      'medicham ' + JSON.stringify(meAnn));
  } else {
    /* UNDER --red-copy THIS IS THE CLAIM THAT MUST GO RED, and it is deliberately the SAME claim the
     * clean arm makes rather than an inverted one: a probe that asserts the defect is present passes
     * whether or not it can still see the defect's absence. The two door arms fail here and the run
     * exits 1; every other arm holds, which is what says the knob moved ONE thing. */
    if (RED_COPY && /^(IMPOSTER|TRACE)-DOOR$/.test(c.id)) {
      const extra = meAnn.filter(x => !sdAnn.includes(x));
      console.log('    [--red-copy] the COPYING body speaks a line the authority never writes: '
        + JSON.stringify(extra));
    }
    claim(JSON.stringify(meS) === JSON.stringify(sdS),
      c.id + ' — this engine writes the SAME switch/detailschange/announcement sequence'
        + (RED ? '   [--red: control, must HOLD]' : ''),
      'showdown ' + JSON.stringify(sdS) + NL + '          medicham ' + JSON.stringify(meS));
  }
  /* THE DOOR ARM MUST ACTUALLY OPEN THE DOOR. A Skill Swap that was refused would leave this arm
   * asserting "no second announcement" about a battle in which nobody ever acquired the ability —
   * green, and asking nothing. The claim is made against the AUTHORITY'S OWN raw log: `Battle#skillSwap`
   * announces the exchange as `|-activate|p2a: Alakazam|Skill Swap|Cloud Nine|Magic Guard|[of] p1a:
   * Altaria` — an `-activate`, not an `-ability`, which is exactly why no `-ability` line appears and
   * why the arm needs this check rather than resting on its own silence. */
  if (c.swapMustLand) {
    const landed = unsplit(G.lastSdLog()).filter(l => {
      const f = String(l).split('|');
      return f[1] === '-activate' && norm(f[3]) === 'skillswap' && MEMBERS.has(norm(f[4]));
    });
    claim(landed.length === 1, c.id + ' — THE SWAP LANDED: the authority hands the member ability to '
      + 'the other body', JSON.stringify(landed));
  }
  /* AND THE COPY DOORS MUST ACTUALLY OPEN. A `|-transform|` that was refused would leave the arm
   * asserting "no second announcement" about a battle in which nobody copied anything — green, and
   * asking nothing. Checked against the AUTHORITY'S raw log, both arms, including the control. */
  if (c.copyMustLand) {
    /* Imposter announces itself as `|-transform|…|[from] ability: Imposter`; Trace announces itself as
     * a FOUR-field `|-ability|…|[from] ability: Trace|[of] …`, which `SEQ` deliberately drops. Both are
     * read off the AUTHORITY's raw log, so neither arm can be green on a copy that never happened. */
    const landed = unsplit(G.lastSdLog()).filter(l => {
      const f = String(l).split('|');
      return (f[1] === '-transform' || f[1] === '-ability')
          && norm(String(l).split('[from] ability: ')[1] || '').startsWith(c.copyMustLand);
    });
    claim(landed.length === 1, c.id + ' — THE COPY LANDED: the authority transforms the arriving body',
      JSON.stringify(landed));
    /* AND IT COPIED THE MEMBER, not some other foe's ability. Without this the Trace arm asserts
     * "no extra announcement" about a body that never acquired an announcing ability. */
    if (c.tracedMustBeMember) {
      const got = landed.length === 1 ? norm(String(landed[0]).split('|')[3]) : '';
      claim(MEMBERS.has(got), c.id + ' — THE COPIED ABILITY IS A MEMBER', 'copied `' + got + '`');
    }
  }
  /* A LINE, NOT A LEAF — asserted on every arm, in both directions. */
  claim(r.stateDiv === null && r.boundaries === r.boundariesAgreed,
    c.id + ' — NO BOARD LEAF PARTS (' + r.boundariesAgreed + '/' + r.boundaries + ' boundaries agreed)',
    'stateDiv=' + JSON.stringify(r.stateDiv));
}

const n = (SEEN.switchInAnnounced | 0) - seen0;
console.log(NL + '  counters this run:  switchInAnnounced +' + n
  + '   startAnnouncePriorityMissing ' + (FAILS.startAnnouncePriorityMissing | 0));
if (RED) {
  claim((FAILS.switchInAnnounceSilentRestored | 0) > 0, 'the RED arm STAMPED its restore counter',
    'MEDFAILS.switchInAnnounceSilentRestored = ' + (FAILS.switchInAnnounceSilentRestored | 0));
  claim(n === 0, 'the RED arm announced NOTHING — the knob reached the rule', 'switchInAnnounced +' + n);
} else if (RED_COPY) {
  claim((FAILS.switchInAnnounceAfterCopyRestored | 0) > 0, 'the RED-COPY arm STAMPED its restore counter',
    'MEDFAILS.switchInAnnounceAfterCopyRestored = ' + (FAILS.switchInAnnounceAfterCopyRestored | 0));
} else {
  claim((FAILS.switchInAnnounceSilentRestored | 0) === 0, 'the CLEAN arm carries NO restore stamp',
    String(FAILS.switchInAnnounceSilentRestored | 0));
  claim((FAILS.switchInAnnounceAfterCopyRestored | 0) === 0, 'the CLEAN arm carries NO copy-order restore stamp',
    String(FAILS.switchInAnnounceAfterCopyRestored | 0));
  claim(n >= 5, 'the five member arms announced at least five times — the fixture is not vacuous',
    'switchInAnnounced +' + n);
}
console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
