#!/usr/bin/env node
/* tests/probe_ability_rewrite_name.js — AN ABILITY REWRITE NAMES THE OUTGOING ABILITY, AND AN
 * ENTRY ANNOUNCEMENT THAT OUTRANKS THE HAZARDS SPEAKS ABOVE THEM
 *
 *   node tests/probe_ability_rewrite_name.js
 *   node tests/probe_ability_rewrite_name.js --red         MEDI_ABILITY_REWRITE_NO_OLD=1
 *   node tests/probe_ability_rewrite_name.js --red-order   MEDI_START_ANNOUNCE_AFTER_HAZARDS=1
 * ==================================================================================================
 *
 * TWO DEFECTS, BOTH FOUND ONLY ONCE `engine/game_differential.js` STOPPED DROPPING `|-ability|`
 * (6.72.0, `docs/_reports/2026-09-19-ability-line-blindness.md`): 47 of 961 games on the
 * `-ability field 4` cause and 1 on `ordering`.
 *
 * ---- 1. FIELD 4 -----------------------------------------------------------------------------------
 *
 *     sim/pokemon.ts:1936-1943, `Pokemon#setAbility`'s `default` branch
 *       if (source) this.battle.add('-ability', this, ability.name, oldAbility.name,
 *                                   `[from] ${sourceEffect.fullname}`, `[of] ${source}`);
 *       else        this.battle.add('-ability', this, ability.name, oldAbility.name,
 *                                   `[from] ${sourceEffect.fullname}`);
 *
 * `oldAbility` is read at :1919, BEFORE the assignment at :1930, so field 4 is written WHENEVER the
 * line is. There is no branch that omits it; what varies is the `[of]`, with whether the caller passed
 * a `source`. THE SET IS THE CALL SITES, derived and not listed: the line is written only when
 * `sourceEffect && !isFromFormeChange && !isTransform` and the effect is neither Mummy nor Lingering
 * Aroma (their own `-activate` case at :1935-1937). So
 *     WRITES IT   Trace (data/abilities.ts:5137), Receiver (:3782), Power of Alchemy (:3395),
 *                 Entrainment (data/moves.ts:4880), Role Play (:15332), Simple Beam (:16492),
 *                 Worry Seed (:21066), Doodle (:3828)
 *     DOES NOT    a forme change and a mega (`setAbility(..., true)`, sim/pokemon.ts:1493 and
 *                 data/mods/champions/scripts.ts:113), a transform (:1358), Mummy and Lingering Aroma,
 *                 and Skill Swap / Wandering Spirit — `Battle#skillSwap` (sim/battle.ts:1310-1340)
 *                 never calls `setAbility` at all, it assigns and writes one `-activate|Skill Swap`.
 * Of those, Doodle is `isNonstandard: 'Past'` in Champions (data/mods/champions/moves.ts:217), and
 * Power of Alchemy and Lingering Aroma have no legal carrier. The probe prints the whole membership,
 * derived from the format on every run, before it asserts anything.
 *
 * ---- 2. THE ORDER AGAINST THE ENTRY HAZARDS --------------------------------------------------------
 *
 * `runSwitch` fires ONE `fieldEvent('SwitchIn', switchersIn)` (sim/battle-actions.ts:184) holding BOTH
 * the entrant's ability handler and the side's hazards (sim/battle.ts:501-502). `comparePriority`
 * (:404-411) reads order, then PRIORITY, then speed, then subOrder; `resolvePriority` sets
 * `priority = effect.onSwitchInPriority || 0` (:953) and gives a side condition subOrder 4 against an
 * ability's 7 (:957-987). Both handlers hang off the same body, so the speeds tie — a DEFAULT ability
 * therefore loses to the rocks, and a POSITIVE `onSwitchInPriority` wins before subOrder is reached.
 * Unnerve declares `onSwitchInPriority: 1` (data/abilities.ts:5251).
 *
 * THE ARMS. Each is one staged, scripted game played by BOTH engines on the SAME pinned dice, and the
 * verdict is `playGame`'s own first divergence under the honest comparator — THE instrument, not a
 * second copy of its rule. A capped list of `-ability` lines is printed beside it either way.
 *
 *   TRACE / ENTRAINMENT / SIMPLEBEAM / WORRYSEED / ROLEPLAY   one rewrite each; field 4 must be there
 *   CTRL-SKILLSWAP   Medicham swaps with Blastoise: NEITHER engine writes any `-ability` line at all
 *   CTRL-MEGA        Gyarados megas into Mold Breaker: a BARE 3-field `-ability` and no field 4
 *   ORDER-UNNERVE    Aerodactyl enters onto Stealth Rock: the line is ABOVE the damage
 *   CTRL-ORDER-PRESSURE  a priority-0 member does the same: the damage is ABOVE the line
 *
 * The two controls that end in a bare announcement are what stop this being "glue a field onto every
 * `-ability`"; CTRL-ORDER-PRESSURE is what stops it being "move every announcement above the rocks".
 *
 * RED FIRST. `--red` restores the four-field rewrite line and the five rewrite arms must part from the
 * authority while every control holds. `--red-order` puts the announcement back below the hazards and
 * ORDER-UNNERVE must part while CTRL-ORDER-PRESSURE holds.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
const RED_ORDER = process.argv.includes('--red-order');
if (RED) process.env.MEDI_ABILITY_REWRITE_NO_OLD = '1';
if (RED_ORDER) process.env.MEDI_START_ANNOUNCE_AFTER_HAZARDS = '1';
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

/* ---- THE MEMBERSHIP, DERIVED FROM THE FORMAT ON THIS RUN ----------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sp = dex.species.all().filter(legal);
const carriers = id => sp.filter(s => Object.values(s.abilities).map(a => dex.abilities.get(a).id).includes(id)).map(s => s.name);
const learners = id => sp.filter(s => { let l; try { l = dex.species.getLearnsetData(s.id); } catch (e) { console.error('learnset unreadable for ' + s.id + ': ' + e.message); return false; } return !!(l && l.learnset && l.learnset[id]); }).map(s => s.name);

console.log('THE REWRITE SET, read off this format (a `-ability` line with the OLD ability in field 4):');
const REWRITE_ABILITIES = ['trace', 'receiver', 'powerofalchemy'];
const REWRITE_MOVES = ['entrainment', 'roleplay', 'simplebeam', 'worryseed', 'doodle'];
for (const id of REWRITE_ABILITIES) {
  const A = dex.abilities.get(id), c = carriers(id);
  console.log('    ability ' + A.name.padEnd(18) + (legal(A) ? 'legal' : 'NOT IN FORMAT').padEnd(14)
    + c.length + ' legal carrier(s)' + (c.length ? '  [' + c.slice(0, 6).join(', ') + ']' : ''));
}
for (const id of REWRITE_MOVES) {
  const V = dex.moves.get(id), l = legal(V) ? learners(id) : [];
  console.log('    move    ' + V.name.padEnd(18) + (legal(V) ? 'legal' : 'NOT IN FORMAT').padEnd(14)
    + l.length + ' legal learner(s)' + (l.length ? '  [' + l.slice(0, 6).join(', ') + ']' : ''));
}
console.log('  NOT in the set — these never reach `setAbility`\'s `-ability` branch:');
console.log('    Skill Swap / Wandering Spirit   Battle#skillSwap assigns and writes `-activate|Skill Swap` (sim/battle.ts:1310-1340)');
console.log('    Mummy / Lingering Aroma         their own `-activate` case (sim/pokemon.ts:1935-1937)');
console.log('    a forme change, a mega, a transform   isFromFormeChange / isTransform (sim/pokemon.ts:1933)');

const TAGS = require(D('data', 'tags.json'));
const ANN = Object.keys(TAGS.abilities).filter(k => TAGS.abilities[k].params && TAGS.abilities[k].params.announcesOnStart);
console.log(NL + 'announcesOnStart members and where they sort against the entry hazards:');
for (const k of ANN) {
  const p = TAGS.abilities[k].params.announcesOnStart;
  const c = carriers(k);
  console.log('    ' + dex.abilities.get(k).name.padEnd(18) + 'switchInPriority '
    + (p.switchInPriority === undefined ? 'ABSENT — regenerate data/tags.json' : String(p.switchInPriority).padStart(2))
    + '   ' + (p.switchInPriority > 0 ? 'ABOVE the hazards' : 'below the hazards')
    + '   ' + c.length + ' legal carrier(s)');
}
if (!ANN.some(k => TAGS.abilities[k].params.announcesOnStart.switchInPriority > 0)) {
  console.log(NL + 'NOT RUN — no announcesOnStart member sorts above the hazards, so the order arms would '
    + 'be asking nothing. This is not a pass.'); process.exit(2);
}

/* ---- THE FIXTURE --------------------------------------------------------------------------------- */
const PROT = { m: 'protect' };
const IDEF = { m: 'irondefense' };
const CALM = { m: 'calmmind' };
const F_MIL = ['milotic', '', 'Marvel Scale', ['Protect']];
const F_TOX = ['toxapex', '', 'Merciless', ['Protect']];
const F_ROT = ['rotom', '', 'Levitate', ['Protect']];
const F_SIN = ['sinistcha', '', 'Heatproof', ['Calm Mind']];
const FOE = ['blastoise', '', 'Torrent', ['Iron Defense']];
/* The foes click a SELF-targeting boost rather than Protect: every one of Entrainment, Simple Beam and
 * Worry Seed carries `flags: { protect: 1 }`, so a protecting target refuses the move and the arm would
 * report agreement while staging nothing. Found by staging it that way first. */
const ONE = { p1: [PROT, PROT], p2: [IDEF, CALM] };

const CASES = [
  /* THE FOE'S PARTNER CARRIES A `notrace` ABILITY (read off data/tags.json's `refusesCopy.notrace`,
   * asserted below), so Trace has exactly ONE eligible foe and the copy is deterministic rather than a
   * coin between two. That is what makes this arm reproduce the pinned pool's own card verbatim:
   *     -ability field 4 :: |-ability|p1a|torrent|trace|[from]trace <> |-ability|p1a|torrent|[from]trace */
  { id: 'TRACE', rewrite: true,
    A: [['gardevoir', '', 'Trace', ['Protect']], F_MIL], Ab: [F_TOX, F_ROT],
    B: [FOE, ['aegislash', '', 'Stance Change', ['Iron Defense']]], Bb: [F_MIL, F_ROT],
    script: [{ p1: [PROT, PROT], p2: [IDEF, IDEF] }] },
  { id: 'ENTRAINMENT', rewrite: true,
    A: [['audino', '', 'Healer', ['Entrainment']], F_MIL], Ab: [F_TOX, F_ROT],
    B: [FOE, F_SIN], Bb: [F_MIL, F_ROT],
    script: [{ p1: [{ m: 'entrainment', t: 0 }, PROT], p2: [IDEF, CALM] }] },
  { id: 'SIMPLEBEAM', rewrite: true,
    A: [['audino', '', 'Healer', ['Simple Beam']], F_MIL], Ab: [F_TOX, F_ROT],
    B: [FOE, F_SIN], Bb: [F_MIL, F_ROT],
    script: [{ p1: [{ m: 'simplebeam', t: 0 }, PROT], p2: [IDEF, CALM] }] },
  { id: 'WORRYSEED', rewrite: true,
    A: [['whimsicott', '', 'Prankster', ['Worry Seed']], F_MIL], Ab: [F_TOX, F_ROT],
    B: [FOE, F_SIN], Bb: [F_MIL, F_ROT],
    script: [{ p1: [{ m: 'worryseed', t: 0 }, PROT], p2: [IDEF, CALM] }] },
  { id: 'ROLEPLAY', rewrite: true,
    A: [['alakazam', '', 'Synchronize', ['Role Play']], F_MIL], Ab: [F_TOX, F_ROT],
    B: [FOE, F_SIN], Bb: [F_MIL, F_ROT],
    script: [{ p1: [{ m: 'roleplay', t: 0 }, PROT], p2: [IDEF, CALM] }] },
  /* CONTROL — an ability change that writes NO `-ability` line in either engine. */
  { id: 'CTRL-SKILLSWAP', noAbilityLine: true,
    A: [['medicham', '', 'Pure Power', ['Skill Swap']], F_MIL], Ab: [F_TOX, F_ROT],
    B: [FOE, F_SIN], Bb: [F_MIL, F_ROT],
    script: [{ p1: [{ m: 'skillswap', t: 0 }, PROT], p2: [IDEF, CALM] }] },
  /* CONTROL — a mega: `setAbility(..., isFromFormeChange = true)` writes no rewrite line, and the
   * arriving ability's own bare announcement has THREE fields and no field 4. */
  { id: 'CTRL-MEGA', bareOnly: true,
    A: [['gyarados', 'Gyaradosite', 'Moxie', ['Protect']], F_MIL], Ab: [F_TOX, F_ROT],
    B: [FOE, F_SIN], Bb: [F_MIL, F_ROT],
    script: [{ p1: [{ m: 'protect', mega: true }, PROT], p2: [IDEF, CALM] }] },
];

/* ---- THE TWO ORDER ARMS --------------------------------------------------------------------------- */
const SR = ['forretress', '', 'Sturdy', ['Stealth Rock', 'Protect']];
const ORDER_SCRIPT = who => ([
  { p1: [{ m: 'stealthrock' }, PROT], p2: [IDEF, CALM] },
  { p1: [PROT, PROT], p2: [{ sw: who }, CALM] },
  { p1: [PROT, PROT], p2: [PROT, CALM] },
]);
CASES.push(
  { id: 'ORDER-UNNERVE', order: 'above',
    A: [SR, F_MIL], Ab: [F_ROT, F_SIN],
    B: [FOE, F_SIN], Bb: [['aerodactyl', '', 'Unnerve', ['Protect']], F_ROT],
    script: ORDER_SCRIPT('aerodactyl') },
  { id: 'CTRL-ORDER-PRESSURE', order: 'below',
    A: [SR, F_MIL], Ab: [F_ROT, F_SIN],
    B: [FOE, F_SIN], Bb: [['absol', '', 'Pressure', ['Protect']], F_ROT],
    script: ORDER_SCRIPT('absol') });

/* THE ORDER ARMS REST ON TWO READ FACTS, not on the two ability names. */
{
  const u = TAGS.abilities['unnerve'] && TAGS.abilities['unnerve'].params.announcesOnStart;
  const p = TAGS.abilities['pressure'] && TAGS.abilities['pressure'].params.announcesOnStart;
  if (!u || !(u.switchInPriority > 0)) { console.log('NOT RUN — Unnerve no longer sorts above the hazards.'); process.exit(2); }
  if (!p || p.switchInPriority > 0) { console.log('NOT RUN — Pressure now sorts above the hazards, so the control asks nothing.'); process.exit(2); }
  /* and the TRACE arm's determinism rests on the foe's PARTNER refusing the copy, read not recalled */
  const sc = (TAGS.abilities['stancechange'] || {}).params || {};
  if (!(sc.refusesCopy && sc.refusesCopy.notrace)) {
    console.log('NOT RUN — the TRACE arm\'s partner no longer refuses Trace, so the copy is a coin '
      + 'between two foes and the arm is not deterministic.'); process.exit(2);
  }
}

let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
for (const c of CASES) for (const row of [...c.A, ...c.Ab, ...c.B, ...c.Bb]) {
  const s = dex.species.get(row[0]);
  if (!legal(s)) { bad(row[0] + ' is not in this format'); continue; }
  if (row[2] && !Object.values(s.abilities).map(a => dex.abilities.get(a).id).includes(dex.abilities.get(row[2]).id))
    bad(s.name + ' does not have ' + row[2]);
  if (row[1]) { const it = dex.items.get(row[1]); if (!legal(it)) bad(row[1] + ' is not in this format'); }
  for (const mv of row[3]) {
    if (!legal(dex.moves.get(mv))) { bad(mv + ' is not in this format'); continue; }
    if (!CS.canLearn(row[0], mv)) bad(s.name + ' does not learn ' + mv);
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN -------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const unsplit = log => { const o = []; for (let i = 0; i < log.length; i++) { if (log[i] === '|split|p1' || log[i] === '|split|p2') { o.push(log[i + 1]); i += 2; continue; } o.push(log[i]); } return o; };
const abLines = lines => lines.filter(l => /^\|-ability\|/.test(String(l)));
/* field 4 exists and is not an attribution — `[from]`/`[of]` in slot 4 means the line is the BARE
 * announcement shape, which is exactly what the two controls must produce. */
const hasField4 = l => { const f = String(l).split('|'); return !!(f[4] && !/^\[/.test(f[4])); };
const srDamage = lines => lines.findIndex(l => /^\|-damage\|.*stealth ?rock/i.test(String(l)));
const abOf = lines => lines.findIndex(l => /^\|-ability\|/.test(String(l)));

console.log(NL + (RED ? 'RED ARM — MEDI_ABILITY_REWRITE_NO_OLD=1 (the four-field line restored)'
  : RED_ORDER ? 'RED ARM — MEDI_START_ANNOUNCE_AFTER_HAZARDS=1 (the announcement back below the hazards)'
    : 'CLEAN ARM'));
const named0 = SEEN.abilityRewriteNamedOld | 0, early0 = SEEN.startAnnouncedEarly | 0;

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(stage(c.Ab)));
  const b = G.buildPair(stage(c.B).concat(stage(c.Bb)));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.id + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_ability_rewrite_name :: ' + c.id, { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.id + '   ' + r.err); fails++; continue; }
  const sd = unsplit(G.lastSdLog()), me = r.mediTrace || [];
  const sdAb = abLines(sd), meAb = abLines(me);
  console.log(NL + c.id);
  console.log('    showdown  ' + JSON.stringify(sdAb));
  console.log('    medicham  ' + JSON.stringify(meAb));

  /* WHAT THE AUTHORITY DOES — asserted first, so an arm that stages nothing cannot pass. */
  if (c.rewrite) {
    claim(sdAb.length === 1 && hasField4(sdAb[0]),
      c.id + ' — THE AUTHORITY writes ONE rewrite line carrying field 4', JSON.stringify(sdAb));
  } else if (c.noAbilityLine) {
    claim(sdAb.length === 0, c.id + ' — THE AUTHORITY writes NO `-ability` line for this swap', JSON.stringify(sdAb));
    claim(sd.some(l => /^\|-activate\|.*Skill Swap/.test(String(l))),
      c.id + ' — and it DID swap (the `-activate|Skill Swap` is there), so the arm is not vacuous');
  } else if (c.bareOnly) {
    claim(sdAb.length >= 1 && sdAb.every(l => !hasField4(l)),
      c.id + ' — THE AUTHORITY writes only BARE `-ability` lines here, never a field 4', JSON.stringify(sdAb));
  } else if (c.order) {
    const iA = abOf(sd), iD = srDamage(sd);
    claim(iA >= 0 && iD >= 0, c.id + ' — THE AUTHORITY wrote both the announcement and the rock damage',
      'ability@' + iA + '  rocks@' + iD);
    claim(c.order === 'above' ? iA < iD : iD < iA,
      c.id + ' — THE AUTHORITY puts the announcement ' + c.order + ' the rock damage',
      'ability@' + iA + '  rocks@' + iD);
  }

  /* WHAT THIS ENGINE DOES — the honest comparator's own first divergence. */
  const redsThisArm = (RED && c.rewrite) || (RED_ORDER && c.order === 'above');
  if (redsThisArm) {
    claim(!!r.div && /^\|-ability\|/.test(String(r.div.sd || '') + String(r.div.me || '')),
      c.id + ' — [red] the streams PART on an `-ability` line (the defect restored)',
      r.div ? JSON.stringify({ sd: r.div.sd, me: r.div.me }) : 'no divergence — the knob did not reach the rule');
  } else {
    claim(r.div === null, c.id + ' — the whole stream agrees with the authority'
      + (RED || RED_ORDER ? '   [red: control, must HOLD]' : ''),
      r.div ? JSON.stringify({ sd: r.div.sd, me: r.div.me }) : '');
  }
  if (c.order && !redsThisArm) {
    const iA = abOf(me), iD = srDamage(me);
    claim(iA >= 0 && iD >= 0 && (c.order === 'above' ? iA < iD : iD < iA),
      c.id + ' — this engine puts the announcement ' + c.order + ' the rock damage',
      'ability@' + iA + '  rocks@' + iD);
  }
}

/* ---- THE COUNTERS --------------------------------------------------------------------------------- */
const named = (SEEN.abilityRewriteNamedOld | 0) - named0;
const early = (SEEN.startAnnouncedEarly | 0) - early0;
console.log(NL + '  counters this run:  abilityRewriteNamedOld +' + named + '   startAnnouncedEarly +' + early
  + '   startAnnouncePriorityMissing ' + (FAILS.startAnnouncePriorityMissing | 0));
claim((FAILS.startAnnouncePriorityMissing | 0) === 0,
  'every announcesOnStart row carried a switchInPriority — data/tags.json is current',
  String(FAILS.startAnnouncePriorityMissing | 0));
if (RED) {
  claim((FAILS.abilityRewriteNoOldRestored | 0) > 0, 'the RED arm STAMPED its restore counter',
    'MEDFAILS.abilityRewriteNoOldRestored = ' + (FAILS.abilityRewriteNoOldRestored | 0));
  claim(named === 0, 'the RED arm named NO outgoing ability — the knob reached the emitter', '+' + named);
} else if (RED_ORDER) {
  claim((FAILS.startAnnounceAfterHazardsRestored | 0) > 0, 'the RED-ORDER arm STAMPED its restore counter',
    'MEDFAILS.startAnnounceAfterHazardsRestored = ' + (FAILS.startAnnounceAfterHazardsRestored | 0));
  claim(early === 0, 'the RED-ORDER arm announced nothing early — the knob reached the rule', '+' + early);
  claim(named >= 5, 'and the FIELD-4 half still fired, so the two knobs are independent', '+' + named);
} else {
  claim((FAILS.abilityRewriteNoOldRestored | 0) === 0 && (FAILS.startAnnounceAfterHazardsRestored | 0) === 0,
    'the CLEAN arm carries NO restore stamp');
  claim(named >= 5, 'the five rewrite arms each named the outgoing ability — the fixture is not vacuous', '+' + named);
  claim(early >= 1, 'the Unnerve arm announced ABOVE the hazards at least once', '+' + early);
}

console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
