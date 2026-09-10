#!/usr/bin/env node
/* tests/probe_entry_announce_batched.js — SUPREME OVERLORD SPOKE BETWEEN TWO `|switch|` LINES
 *   node tests/probe_entry_announce_batched.js      node tests/probe_entry_announce_batched.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY ANNOUNCES EVERY REPLACEMENT AND THEN RUNS ONE ENTRY EVENT.
 *
 *     switchIn()   writes the `|switch|` line, then merely QUEUES {choice:'runSwitch'}
 *                                                       sim/battle-actions.ts:145-158
 *     runSwitch()  DRAINS every consecutive runSwitch off the queue head into one list and fires a
 *                  SINGLE speed-sorted fieldEvent('SwitchIn', switchersIn)      :175-186
 *
 * An ability's `onStart` is run AS an `onSwitchIn` handler inside that one event —
 * `Battle#getCallback` (sim/battle.ts:1018-1031) substitutes `onStart` for a missing `onSwitchIn` on
 * any Ability or Item, with the comment *"Abilities and items Start at different times during the
 * SwitchIn event, so we run their onStart handlers during the SwitchIn event"*. **So nothing an
 * arriving ability says can appear between two `|switch|` lines.**
 *
 * `applyEntryConditions`'s own header has said so since 2026-08-27 and named the exception left
 * behind: *"the Zero to Hero `-activate`, the Supreme Overlord `-activate`/`-start` and the Magic
 * Room item park are still written at the placement, so on a double replacement they still land
 * between the two `|switch|` lines … No card in the pinned pool lands on them and no probe fails on
 * them yet."* THREE CARDS NOW DO — release `f30bf025ae28`, three narration-only games in the
 * `ordering` class, all three Supreme Overlord:
 *
 *     showdown  |switch|p2a: Mawile|…    |-activate|p1a: Kingambit|ability: Supreme Overlord
 *     medicham  |-activate|p1a: Kingambit|ability: supremeoverlord    |switch|p2a: Mawile|…
 *
 * WHY THE `-start` MOVES WITH IT AND THE MAGIC ROOM PARK DOES NOT. The two Supreme Overlord lines
 * are one announcement written by one handler, so splitting them would be a third behaviour nobody
 * has measured. `itemRoomHide` is a STATE change, not an announcement; the authority has it inside
 * the same event, but no card lands on it and moving a state write on an argument alone is how a
 * narration fix parts a board. It stays where it is and stays on the hand list.
 *
 * THE THREE ARMS.
 *
 *   RED        A DOUBLE replacement in which the Supreme Overlord body is placed FIRST. Its corpse
 *              (Gourgeist-Small, 99) is faster than the other side's (Pikachu, 90), so `_refills` places
 *              Kingambit first and the old code spoke before the second `|switch|`. Placing it LAST
 *              would have made the wrong engine look right, which is why the speeds are asserted.
 *   CTRL-ONE   The SAME click with the other side immune, so exactly ONE body is replaced. The
 *              `-activate` must still follow its own `|switch|` IMMEDIATELY, in BOTH arms — a fix
 *              that pushed the announcement to the end of the refill would pass RED and fail here.
 *   CTRL-NOSO  The SAME double replacement with the SAME Kingambit carrying DEFIANT. No `-activate`
 *              at all and the two `|switch|` lines in the same order, in BOTH arms — so RED is a
 *              statement about the ANNOUNCEMENT and not about the replacement order.
 *
 * RED FIRST: `MEDI_ENTRY_ANNOUNCE_INLINE=1` restores the announcement to the placement, so the
 * restore reproduces the same red rather than a third behaviour, and any run carrying it also
 * carries a non-zero `MEDFAILS.entryAnnounceInlineRestored`.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_ENTRY_ANNOUNCE_INLINE = '1';
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
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
/* THE VALIDATOR'S OWN VERDICT, NOT A WALK OVER THE RAW LEARNSET ROWS (2026-09-10). The walk this
 * replaced accepted any entry on the species or on a prevo whatever its SOURCE tag, so a move a prevo
 * learned by a gen-7 TM (`7M`, `7V`) read as legal here while `TeamValidator` refused it — which is how
 * this file's own legality gate passed sets tests/test-fixture-legality.js named as illegal.
 * `champions_sim.canLearn` IS `checkCanLearn`, cached per pair. */
const learns = (sp, mv) => CS.canLearn(sp, mv);

/* THE EXPLODER IS GOURGEIST-SMALL, NOT GENGAR (2026-09-10): Gengar does not learn Explosion in
 * Champions — `checkCanLearn` refuses it; the raw-learnset walk below used to accept it off Haunter's
 * gen-7 TM entry. Gourgeist-Small is the only non-mega legal Explosion carrier faster than Pikachu (99
 * against 90), which is the whole premise of the RED arm. Insomnia announces nothing here. */
const BOOM = ['gourgeistsmall', '', 'Insomnia', ['Explosion', 'Protect']];
/* THE SURVIVOR ON BOTH SIDES. It shields, so it is not a target at all and prints nothing. */
const WALL = ['rotom', '', 'Levitate', ['Protect']];
/* THE SAME BODY WITH THE SCRIPT'S CLICK ON IT. CTRL-ONE puts a Ghost in the p2a slot so that nobody
 * dies there, and the p2a slot is the one the script tells to click Thunderbolt — a body that does
 * not KNOW the move is passed by the driver and Showdown rejects the choice outright, which is how
 * the first cut of this arm THREW instead of measuring anything. */
const WALL_TB = ['rotom', '', 'Levitate', ['Thunderbolt', 'Protect']];
/* THE OTHER CORPSE. Slower than Gourgeist-Small, which is what puts the Supreme Overlord body FIRST in the
 * replacement order — the whole point of the RED arm. Its click is aimed at a shielded slot so it
 * moves nothing this file reads; it dies before it acts in any case. */
const DIES = ['pikachu', '', 'Static', ['Thunderbolt', 'Protect']];
const KING_SO = ['kingambit', '', 'Supreme Overlord', ['Protect']];
const KING_NO = ['kingambit', '', 'Defiant', ['Protect']];
const FILL1 = ['toxapex', '', 'Merciless', ['Protect']];
const FILL2 = ['milotic', '', 'Marvel Scale', ['Protect']];

const PROT = { m: 'protect' };
const SCRIPT = [{ p1: [{ m: 'explosion', t: 0 }, PROT], p2: [{ m: 'thunderbolt', t: 1 }, PROT] }];

const CASES = [
  { id: 'RED',
    name: 'RED       a DOUBLE replacement — the Supreme Overlord body is placed FIRST',
    what: 'Gourgeist-Small explodes, killing itself and the Pikachu opposite; both Rotoms are shielded and '
        + 'are not targets. Two slots refill. Gourgeist-Small (99) outruns Pikachu (90), so Kingambit is placed '
        + 'FIRST — and the authority still writes BOTH |switch| lines before it says a word.',
    A: [BOOM, WALL], Abench: [KING_SO, FILL1], B: [DIES, WALL], Bbench: [FILL2, FILL1],
    want: ['switch:p1a:kingambit', 'switch:p2a:milotic', 'so:p1a', 'fallen:p1a:1'],
    legacy: ['switch:p1a:kingambit', 'so:p1a', 'fallen:p1a:1', 'switch:p2a:milotic'] },

  { id: 'CTRL-ONE',
    name: 'CTRL-ONE  a SINGLE replacement — the announcement must still follow its own |switch|',
    what: 'The identical click with a Rotom opposite instead of a Pikachu: Normal cannot touch a '
        + 'Ghost, so only Gourgeist-Small dies and only one slot refills. A fix that deferred the '
        + 'announcement to the END of the refill instead of into the entry pass passes RED and '
        + 'fails here.',
    A: [BOOM, WALL], Abench: [KING_SO, FILL1], B: [WALL_TB, WALL2()], Bbench: [FILL2, FILL1],
    want: ['switch:p1a:kingambit', 'so:p1a', 'fallen:p1a:1'],
    legacy: ['switch:p1a:kingambit', 'so:p1a', 'fallen:p1a:1'] },

  { id: 'CTRL-NOSO',
    name: 'CTRL-NOSO the SAME double replacement, Kingambit carrying DEFIANT',
    what: 'One ability changed. There is no announcement to place, so both engines write the two '
        + '|switch| lines and nothing else — which is what makes RED a statement about the '
        + 'ANNOUNCEMENT rather than about the replacement order.',
    A: [BOOM, WALL], Abench: [KING_NO, FILL1], B: [DIES, WALL], Bbench: [FILL2, FILL1],
    want: ['switch:p1a:kingambit', 'switch:p2a:milotic'],
    legacy: ['switch:p1a:kingambit', 'switch:p2a:milotic'] },
];
/* A SECOND GHOST FOR THE p2b SLOT OF CTRL-ONE, because the same species twice on one side is not a
 * legal team. Ghost keeps it off Explosion's target list exactly as the Rotom does. */
function WALL2() { return ['sinistcha', '', 'Heatproof', ['Protect']]; }

/* ---- LEGALITY AND THE FACTS EVERY ARM RESTS ON --------------------------------------------------- */
let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
const ROWS = [];
for (const c of CASES) ROWS.push(...c.A, ...c.Abench, ...c.B, ...c.Bbench);
for (const row of ROWS) {
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
  const ex = dex.moves.get('explosion');
  if (ex.target !== 'allAdjacent') bad('Explosion now targets ' + ex.target);
  if (ex.selfdestruct !== 'always') bad('Explosion no longer self-destructs unconditionally: ' + ex.selfdestruct);
  if (ex.type !== 'Normal') bad('Explosion is no longer Normal, so the Ghost bodies would be hit');
  /*  RETURNS TRUE WHEN THE BODY IS **NOT** IMMUNE. Both clauses below read the wrong
   * way round in the first cut and the whole fixture refused to stage, which is the harmless half of
   * that mistake; the dangerous half would have been asserting an immunity that is not there. */
  for (const s of ['rotom', 'sinistcha'])
    if (dex.getImmunity('Normal', dex.species.get(s).types))
      bad(dex.species.get(s).name + ' is no longer immune to Normal and would be a target');
  if (!dex.getImmunity('Normal', dex.species.get('pikachu').types))
    bad('Pikachu has become Normal-immune and would not die');
  /* THE SPEED ORDER IS THE WHOLE OF THE RED ARM. Placing the Supreme Overlord body LAST would make
   * the OLD engine look right, so this is asserted rather than assumed. */
  const gs = dex.species.get(BOOM[0]).baseStats.spe, ps = dex.species.get('pikachu').baseStats.spe;
  if (!(gs > ps)) bad(dex.species.get(BOOM[0]).name + ' base Speed ' + gs + ' no longer outruns Pikachu ' + ps
    + ', so the Supreme Overlord body would not be placed first and RED would be vacuous');
  const so = dex.abilities.get('supremeoverlord');
  if (!so.onStart) bad('Supreme Overlord no longer has an onStart handler');
  if (so.onSwitchIn) bad('Supreme Overlord has grown its own onSwitchIn; the onStart substitution no longer applies');
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
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/* THE THREE LINES THIS FILE IS ABOUT, IN THE ORDER THEY WERE WRITTEN, AND NOTHING ELSE. Reading the
 * whole log would make the arms fail on every unrelated narration change; reading only the
 * `-activate` would lose the ordering, which IS the finding. */
const SEQ = lines => {
  const out = [];
  for (const l of lines) {
    let m = /^\|switch\|(p[12][ab]): ([^|]+)\|/.exec(String(l));
    if (m) { out.push('switch:' + m[1] + ':' + norm(m[2])); continue; }
    m = /^\|-activate\|(p[12][ab]): [^|]*\|ability: (.+)$/.exec(String(l));
    if (m && norm(m[2]) === 'supremeoverlord') { out.push('so:' + m[1]); continue; }
    m = /^\|-start\|(p[12][ab]): [^|]*\|fallen(\d+)/.exec(String(l));
    if (m) { out.push('fallen:' + m[1] + ':' + m[2]); continue; }
  }
  return out;
};
/* THE LEAD SWITCHES ARE NOT WHAT THIS MEASURES. Everything before the first `|turn|1` is the two
 * teams arriving, and it is identical in every arm; dropping it keeps the assertion on the
 * REPLACEMENT that follows the explosion. */
const afterLead = lines => {
  const k = lines.findIndex(l => /^\|turn\|1\b/.test(String(l)));
  return k < 0 ? lines : lines.slice(k);
};

console.log((RED ? 'RED ARM — MEDI_ENTRY_ANNOUNCE_INLINE=1 (the announcement back at the placement)'
                 : 'CLEAN ARM') + NL);

const batched0 = SEEN.entryAnnounceBatched | 0;

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(stage(c.Abench)));
  const b = G.buildPair(stage(c.B).concat(stage(c.Bbench)));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_entry_announce_batched :: ' + c.id,
                       { script: SCRIPT, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdS = SEQ(afterLead(unsplit(G.lastSdLog())));
  const meS = SEQ(afterLead(r.mediTrace || []));

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

/* ---- THE COUNTER SAYS THE KNOB REACHED THE RULE --------------------------------------------------- */
const batchedN = (SEEN.entryAnnounceBatched | 0) - batched0;
console.log(NL + '  counters this run:  entryAnnounceBatched +' + batchedN);
if (RED) {
  claim((FAILS.entryAnnounceInlineRestored | 0) > 0,
    'the RED arm STAMPED a failure counter — a switch that silently makes the engine wrong is the '
      + 'silent default this repository keeps paying for',
    'MEDFAILS.entryAnnounceInlineRestored = ' + (FAILS.entryAnnounceInlineRestored | 0));
  claim(batchedN === 0, 'the RED arm deferred NOTHING — the knob reached the rule',
    'entryAnnounceBatched +' + batchedN);
} else {
  claim((FAILS.entryAnnounceInlineRestored | 0) === 0,
    'the CLEAN arm carries NO restore stamp', String(FAILS.entryAnnounceInlineRestored | 0));
  claim(batchedN > 0, 'an announcement was deferred into the entry pass at least once — the fixture '
    + 'is not vacuous', 'entryAnnounceBatched +' + batchedN);
}

console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
