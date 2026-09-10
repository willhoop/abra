#!/usr/bin/env node
/* tests/probe_reaction_address.js — WHICH BODY IS A `DamagingHit` REACTION ADDRESSED TO?
 *   node tests/probe_reaction_address.js        node tests/probe_reaction_address.js --red
 * ==================================================================================================
 *
 * WHAT THIS IS ABOUT, AND WHY IT IS NOT A MECHANIC PROBE
 *
 * The middle arm of `engine/game_differential.js` shares its dice by ADDRESS rather than by sequence:
 *
 *     value = FNV1a(seed | turn | category | move id | target slot | nth)  ->  [0,1)
 *
 * `MID_TGT` is read by `midEventDraw` and by nothing else, so everything below is byte-identical to
 * every caller that is not the middle arm — no self-play game, no rollout and no seeded census probe
 * can tell the two arms apart. What an address mismatch CAN do is hand two correct engines different
 * numbers for the same roll: one reactor fires and the other does not, and the differential reports a
 * rule disagreement that is entirely the ruler's.
 *
 * THE AUTHORITY'S `activeTarget` LINGERS, AND `DamagingHit` READS THE LEFTOVER.
 * `BattleActions#spreadMoveHit` (sim/battle-actions.ts:1061-1133, and the Champions override at
 * data/mods/champions/scripts.ts:361-424, which is IDENTICAL through this whole region) writes
 * `this.battle.activeTarget` in exactly one place inside itself — `getSpreadDamage`'s own per-target
 * loop, :1154 / scripts.ts is unoverridden there. Steps 4 and 5 (`selfDrops`, `secondaries`) may move
 * it and the authority SAVES AND RESTORES it across them, with the comment saying why:
 *
 *     // steps 4 and 5 can mess with this.battle.activeTarget, which needs to be preserved for Dancer
 *     const activeTarget = this.battle.activeTarget;         battle-actions.ts:1093
 *     ...
 *     this.battle.activeTarget = activeTarget;               battle-actions.ts:1101
 *
 * and then, further down and with nothing writing `activeTarget` in between:
 *
 *     this.battle.runEvent('DamagingHit', damagedTargets, pokemon, move, damagedDamage);   :1117
 *
 * `runEvent` takes an ARRAY of targets and does not touch `activeTarget`. So EVERY die thrown by an
 * `onDamagingHit` / `onSourceDamagingHit` handler — Cursed Body's `randomChance(3, 10)`
 * (data/abilities.ts:774-786), Poison Touch's (`:3360-3369`), Static, Flame Body, Effect Spore, Cute
 * Charm — is addressed to THE LAST BODY `getSpreadDamage` REACHED, whatever body the handler is
 * actually running on. It is also category `any`: none of `hitStepAccuracy` / `secondaries` /
 * `getDamage` is on the stack at that point, so `midWrapShowdown` leaves the wrapper at its default.
 *
 * medicham2 addressed each reaction to ITS OWN body, because the `_STEPS` driver stamps
 * `MID_TGT = midEventSlot(R.tg)` once per row per step and `_stepDamagingHit` is just another row in
 * that loop. On a spread whose reactor is NOT the last damaged body, the two engines therefore spend
 * each other's numbers.
 *
 * THIS IS THE SAME DEFECT `tests/probe_spread_secondary_address.js` FIXED ONE STEP EARLIER, and the
 * engine already models the lingering value there (`_secAddrSlot`). It could not simply be reused:
 * `_secFired` MOVES `_secAddrSlot` when a secondary passes, mirroring the authority's nested
 * `moveHit` -> `spreadMoveHit` -> `getSpreadDamage` — and the authority then RESTORES it before
 * `DamagingHit`. So the reaction needs the value as it stood at the END of the damage step, which is
 * what `_dmgLastSlot` is.
 *
 * MEASURED BEFORE ANYTHING MOVED — the game this came out of is
 * `omit-weather / ...2659988022`-adjacent card #2 of `data/divergence-turns.json`'s board-material
 * set: `|-start|p2b: Gardevoir|Disable|Hyper Voice|[from] ability: Cursed Body|[of] p1a: Dragapult`
 * in the authority against `|faint|p1a: Dragapult` here, parting `p2.active[1].vol.disable  0 / 3`.
 * The two addresses were `...|any|hypervoice|p11|0` (authority) and `...|any|hypervoice|p10|0` (here)
 * — same turn, same category, same move, DIFFERENT SLOT.
 *
 * THE CONTROLS ARE THE POINT OF THE FILE, and there are three shapes of them, because a fix that made
 * every address constant would pass an equality check while being wrong:
 *   - a SINGLE-TARGET hit, where "its own body" and "the last body" are the same string;
 *   - the reactor sitting in the LAST slot of a spread, where they are also the same string — this is
 *     the one that proves the defect is POSITIONAL and not "spread moves are broken";
 *   - a spread whose other body never reaches the damage step, which collapses to one surviving body.
 * All three agreed before this fix and must still agree after it, and must NOT part under `--red`.
 *
 * RED FIRST: `MEDI_REACT_ADDR_PER_TARGET=1` restores the per-row address, i.e. the engine exactly as
 * it stood before this file existed. `--red` plays every arm under it; the RED arms must PART and the
 * three controls must NOT.
 * ================================================================================================ */
'use strict';
/* THE KNOB IS SET BEFORE ANY REQUIRE. `REACT_ADDR_PER_TARGET` is read ONCE at medicham2's module
 * load, and medicham2 is loaded by `game_differential.js` at ITS require time — an env set below that
 * line leaves the engine holding the clean value and every arm comes back green, which is the
 * signature of an unwired knob rather than of a working fix. */
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_REACT_ADDR_PER_TARGET = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
/* IT MUST BE THE INSTANCE THE DRIVER PLAYED — a bare require is a second module object whose `MID_*`
 * fields nothing writes, and its log comes back empty, which reads exactly like an engine that takes
 * no draws at all. */
const M = REL.require('engine/medicham2-browser.js');
const SDP = process.env.SHOWDOWN_PATH;
const BA = require(SDP + '/dist/sim/battle-actions');
const BattleActions = BA.BattleActions || BA.default || BA;
const BM = require(SDP + '/dist/sim/battle');
const Battle = BM.Battle || BM.default || BM;
const SEED = M.MID_EVENT_SEED;
const NL = String.fromCharCode(10);

/* ---- THE AUTHORITY'S HALF — the same hook `probe_spread_secondary_address.js` uses ---------------- */
let SD_CAT = 'any';
const around = (name, cat) => {
  const fn = BattleActions.prototype[name];
  if (typeof fn !== 'function') throw new Error('BattleActions#' + name + ' has moved — this hook is guessing');
  BattleActions.prototype[name] = function (...a) {
    const prev = SD_CAT; SD_CAT = cat;
    try { return fn.apply(this, a); } finally { SD_CAT = prev; }
  };
};
around('hitStepAccuracy', 'acc'); around('secondaries', 'sec'); around('getDamage', 'dmg');

let NTH = new Map(), LOG = [];
const addr = (cat, ctx) => {
  const mv = ctx && ctx.activeMove, tg = ctx && ctx.activeTarget;
  const base = [SEED, ctx ? ctx.turn : 0, cat,
                mv ? mv.id : '-', (tg && tg.side) ? (tg.side.id + tg.position) : '-'].join('|');
  const n = NTH.get(base) || 0; NTH.set(base, n + 1);
  LOG.push(base + '|' + n);
};
const oR = Battle.prototype.random, oC = Battle.prototype.randomChance, oS = Battle.prototype.sample;
Battle.prototype.random = function (m, n) {
  addr((SD_CAT === 'dmg' && n !== undefined) ? 'crit' : SD_CAT, this); return oR.call(this, m, n); };
Battle.prototype.randomChance = function (a, b) {
  addr((SD_CAT === 'dmg') ? 'crit' : SD_CAT, this); return oC.call(this, a, b); };
Battle.prototype.sample = function (it) { addr(SD_CAT, this); return oS.call(this, it); };

const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

/* ---- THE FIXTURE ---------------------------------------------------------------------------------
 * Nothing is typed from memory. Every species, ability and move is checked against the format below
 * and the file REFUSES TO RUN on an illegal one. Gengar is one of six legal Cursed Body carriers
 * (derived: Gengar, Banette, Froslass, Polteageist, Polteageist-Antique, Dragapult) and is the one the
 * corpus actually runs. Icy Wind is `allAdjacentFoes`, 55 BP special from a base-45 SpA body, so
 * nothing in these arms is anywhere near a KO — a faint would change WHICH bodies are in
 * `damagedTargets` and make the arm about something else. */
const AERO = ['aerodactyl', '', 'Unnerve', ['Rock Slide', 'Iron Head', 'Protect']];
const WEAV = ['weavile', '', 'Pressure', ['Icy Wind', 'Protect']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
const GENG = ['gengar', '', 'Cursed Body', ['Protect', 'Nasty Plot']];
const CORV = ['corviknight', '', 'Pressure', ['Protect', 'Iron Defense']];

const PROT = { m: 'protect' };
/* THE FOES MUST NOT SHIELD, AND THE FIRST CUT OF THIS FILE HAD THEM BOTH CLICKING PROTECT — every arm
 * logged an empty address list, and an empty list compares EQUAL to an empty list, so all four came
 * back "identical". That is why the "the roll happened at all" claim is asserted per arm BEFORE the
 * equality is. The two idle clicks are SELF-TARGETED OFFENSIVE boosts, so neither changes how much the
 * incoming hit does to its holder, and both land after it. */
const IDLE_G = { m: 'nastyplot' };
const IDLE_C = { m: 'irondefense' };

/* THE TWO ADDRESSES OF THE RED ARM ARE COMPUTED, NOT HOPED AT. The address hash is a pure function of
 * the string, so the arm can be CHOSEN to make the 30% roll come out differently on the two slots:
 *     20260813|1|any|rockslide|p20|0 -> 0.8933   (medicham2's address: Cursed Body does NOT fire)
 *     20260813|1|any|rockslide|p21|0 -> 0.2640   (the authority's:      Cursed Body DOES fire)
 * so RED-1 is not an address mismatch that happens to be harmless — it parts the BOARD, on turn 1,
 * which is the whole reason this file exists. RED-2 is the same defect on a pair of addresses that
 * both land above 0.3, carried so the arm cannot be read as "Rock Slide is broken". */
const CASES = [
  { name: 'RED-1  spread Rock Slide, Cursed Body in the FIRST slot  [the OUTCOME parts]', part: true, fires: true,
    what: 'Both foes take the hit, so `getSpreadDamage` leaves `activeTarget` on p2b and the '
        + 'authority addresses the 30% roll of Cursed Body there (0.2640 -> it fires). medicham2 addressed it '
        + 'to p2a, the body the handler is actually running on (0.8933 -> it does not). This is the '
        + 'shape of the board-material game, and the Disable claim below is the board leaf.',
    A: [AERO, CLEF], B: [GENG, CORV],
    move: 'rockslide',
    script: [{ p1: [{ m: 'rockslide' }, PROT], p2: [IDLE_G, IDLE_C] }] },

  { name: 'RED-2  spread Icy Wind, Cursed Body in the FIRST slot  [address only]', part: true, fires: false,
    what: 'The identical defect on a different move, where both addresses happen to land above 0.3 so '
        + 'neither engine fires. Carried because a file whose only red arm also changes the board '
        + 'cannot distinguish "the address moved" from "Rock Slide moved".',
    A: [WEAV, CLEF], B: [GENG, CORV],
    move: 'icywind',
    script: [{ p1: [{ m: 'icywind' }, PROT], p2: [IDLE_G, IDLE_C] }] },

  { name: 'CONTROL  spread Rock Slide, Cursed Body in the LAST slot', part: false, fires: true,
    what: 'The identical click with the two foes swapped. Now the reactor IS the last body '
        + '`getSpreadDamage` reached, so "its own slot" and "the lingering slot" are the same string '
        + 'and both engines draw 0.2640 and fire. THIS IS THE ARM THAT SAYS THE DEFECT IS POSITIONAL '
        + '— a fix that simply stopped naming the target would pass RED-1 and fail here.',
    A: [AERO, CLEF], B: [CORV, GENG],
    move: 'rockslide',
    script: [{ p1: [{ m: 'rockslide' }, PROT], p2: [IDLE_C, IDLE_G] }] },

  { name: 'CONTROL  single-target Iron Head into Cursed Body', part: false,
    what: 'One body, one reaction. Carried because it is the known-good case this probe has to be '
        + 'able to see: if this parts, the change is not about the lingering target at all.',
    A: [AERO, CLEF], B: [GENG, CORV],
    move: 'ironhead',
    script: [{ p1: [{ m: 'ironhead', t: 0 }, PROT], p2: [IDLE_G, IDLE_C] }] },

  { name: 'CONTROL  spread whose OTHER body Protects', part: false,
    what: 'Rock Slide at two foes with the partner shielded. Exactly one body reaches the damage '
        + 'step, so the lingering slot is that body. Carried because it is the arm a constant address '
        + 'would also pass — it pins that the fix did not stop naming the target.',
    A: [AERO, CLEF], B: [GENG, CORV],
    move: 'rockslide',
    script: [{ p1: [{ m: 'rockslide' }, PROT], p2: [IDLE_G, PROT] }] },
];

/* ---- LEGALITY, DERIVED --------------------------------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
/* ROADMAP #565 — THE LEGALITY GATE ASKS THE VALIDATOR, NOT THE RAW ROWS. The prevo walk this line
 * replaced accepted any entry on the species or on a prevo whatever its SOURCE tag, so a move a prevo
 * learned by a gen-7 TM (`7M`, `7V`) read as legal here while `TeamValidator` refused it — which is how
 * illegal fixtures passed their own gates (tests/test-fixture-legality.js, batch 2).
 * `champions_sim.canLearn` IS `checkCanLearn`, cached per pair. */
const learns = (sp, mv) => CS.canLearn(sp, mv);
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
/* AND THE TWO FACTS THE ARMS REST ON, ASKED OF THE FORMAT RATHER THAN ASSERTED IN PROSE. */
if (dex.moves.get('icywind').target !== 'allAdjacentFoes') {
  console.log('FIXTURE WRONG — Icy Wind is ' + dex.moves.get('icywind').target + ', not a spread'); illegal++; }
if (dex.moves.get('rockslide').target !== 'allAdjacentFoes') {
  console.log('FIXTURE WRONG — Rock Slide is ' + dex.moves.get('rockslide').target + ', not a spread'); illegal++; }
if (dex.moves.get('ironhead').target !== 'normal') {
  console.log('FIXTURE WRONG — Iron Head is ' + dex.moves.get('ironhead').target + ', not single-target'); illegal++; }
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));

let fails = 0, ran = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

console.log((RED ? 'RED ARM — MEDI_REACT_ADDR_PER_TARGET=1 (the engine as it stood before the fix)'
                 : 'CLEAN ARM')
  + NL + 'the `any`-category addresses each engine asked for the clicked move, in order' + NL);

const disableLine = lines => lines.filter(l => /^\|-start\|.*\|Disable/i.test(String(l))).length;

for (const c of CASES) {
  NTH = new Map(); LOG = [];
  const a = G.buildPair(stage(c.A).concat(BENCH('milotic', 'incineroar')));
  const b = G.buildPair(stage(c.B).concat(BENCH('snorlax', 'toxapex')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_reaction_address :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  ran++;
  const keep = x => { const p = x.split('|'); return p[2] === 'any' && p[3] === c.move; };
  const me = M.midEventLog().filter(keep);
  const sd = LOG.filter(keep);
  const sdLines = G.lastSdLog();
  const meLines = r.mediTrace || [];
  const koLines = meLines.filter(l => /^\|faint\|/.test(String(l))).length
                + sdLines.filter(l => /^\|faint\|/.test(String(l))).length;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  ' + (sd.map(short).join('  ') || '(none)'));
  console.log('    medicham  ' + (me.map(short).join('  ') || '(none)'));
  console.log('    |-start Disable lines:  showdown ' + disableLine(sdLines) + '   medicham ' + disableLine(meLines)
            + '     faints anywhere: ' + koLines);

  /* AN ARM THAT TOOK NO DRAWS TESTED NOTHING, and an empty list compares equal to an empty list. */
  claim(sd.length === 1 && me.length === 1,
    c.name + ' — the reaction roll happened exactly once on each side',
    'showdown took ' + sd.length + ' `any|' + c.move + '` draw(s), medicham2 ' + me.length);
  /* NO BODY MAY FAINT. A faint changes which bodies are in `damagedTargets` and would make the arm
   * about a different question; it is asserted rather than hoped at. */
  claim(koLines === 0, c.name + ' — nobody fainted, so `damagedTargets` is both foes',
    koLines + ' faint line(s) across the two streams');

  const same = JSON.stringify(sd) === JSON.stringify(me);
  const want = RED ? !c.part : true;
  claim(same === want,
    c.name + ' — the two engines name the same event' + (RED ? (c.part ? '   [--red: must PART]'
                                                                      : '   [--red: control, must HOLD]') : ''),
    same ? 'identical'
         : 'showdown ' + JSON.stringify(sd.map(short)) + '  vs  medicham ' + JSON.stringify(me.map(short)));

  /* THE OUTCOME, NOT THE CLASSIFICATION. Two engines can name the same event and still disagree about
   * what it did; two that name different events usually agree by luck about a 30% roll. Both are
   * asserted, and this one is the board leaf the differential compares. */
  const wantFire = RED ? (c.part ? null : (c.fires ? 1 : 0)) : (c.fires ? 1 : 0);
  claim(disableLine(sdLines) === disableLine(meLines) || (RED && c.part),
    c.name + ' — and they agree about whether Cursed Body actually fired'
      + (RED && c.part ? '   [--red: waived, the address is parted]' : ''),
    'showdown ' + disableLine(sdLines) + ' `|-start ... Disable` line(s), medicham2 ' + disableLine(meLines));
  /* THE AUTHORITY'S OWN ANSWER, PINNED PER ARM. Two engines agreeing on zero proves nothing about a
   * 30% roll, so the arm states which way the roll must go and reads it off Showdown. */
  if (wantFire !== null && c.fires !== undefined) {
    claim(disableLine(sdLines) === wantFire,
      c.name + ' — the authority roll went the way this arm was CHOSEN to make it go',
      'expected ' + wantFire + ' `|-start ... Disable` line(s) from showdown, got ' + disableLine(sdLines));
  }
}

/* ---- THE ENGINE'S OWN RECEIPTS, AT EXACT EQUALITY -------------------------------------------------
 * The wire is invisible from outside by construction, so it is asserted from the engine's counters in
 * BOTH directions rather than as `>= 0`.
 *   reactionAddrFromLastSlot   REACTION SITES entered at the lingering address — a `_stepDamagingHit`
 *                              row, an interior arrival of a volley, or an in-`_stepEffects` chance
 *                              draw (Cursed Body, Poison Touch). It counts on the CONTROLS too,
 *                              where the lingering slot IS the row's own slot, which is why the
 *                              number below is 13 and not 2.
 *   reactAddrPerTargetRestored 1 under `--red`, 0 otherwise: the knob's own receipt. */
const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
if (RED) {
  claim((FAILS.reactAddrPerTargetRestored || 0) === 1,
    'the revert knob was actually READ by the engine',
    'MEDFAILS.reactAddrPerTargetRestored = ' + (FAILS.reactAddrPerTargetRestored || 0)
      + '  (a 0 here means the arms above agreed or parted for some other reason)');
  claim((SEEN.reactionAddrFromLastSlot || 0) === 0,
    'the lingering address is not taken at all under the revert',
    'MEDSEEN.reactionAddrFromLastSlot = ' + (SEEN.reactionAddrFromLastSlot || 0));
} else {
  claim((FAILS.reactAddrPerTargetRestored || 0) === 0,
    'no revert knob is in play on the clean arm',
    'MEDFAILS.reactAddrPerTargetRestored = ' + (FAILS.reactAddrPerTargetRestored || 0));
  claim((SEEN.reactionAddrFromLastSlot || 0) === 13,
    'the lingering address was taken exactly 13 times, and the 13 is DERIVED rather than observed',
    'MEDSEEN.reactionAddrFromLastSlot = ' + (SEEN.reactionAddrFromLastSlot || 0)
      + '  — EIGHT reaction BLOCKS (`_stepDamagingHit` runs once per DAMAGED row: 2 + 2 + 2 on the '
      + 'three spreads, 1 + 1 on the two single-body arms) plus FIVE in-`_stepEffects` DRAWS '
      + '(Cursed Body throws its 30% once per arm; Corviknight carries Pressure and reacts to '
      + 'nothing). A number below this means some arm never reached the reaction site at all.');
}

function short(a) { const p = a.split('|'); return p[4] + '|' + p[5]; }

console.log(NL + (fails ? 'RED — ' + fails + ' claim(s) failed over ' + ran + ' staged turns'
                        : 'GREEN — every claim held over ' + ran + ' staged turns'));
process.exit(fails ? 1 : 0);
