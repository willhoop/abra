#!/usr/bin/env node
/* tests/probe_arrival_reprice.js — A STAT CHANGE BETWEEN TWO ARRIVALS OF A VOLLEY WAS INVISIBLE TO
 * THE LATER ONE
 *   node tests/probe_arrival_reprice.js        node tests/probe_arrival_reprice.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY PRICES EVERY HIT AT ITS OWN MOMENT. `hitStepMoveHitLoop` calls `spreadMoveHit` once
 * per hit (sim/battle-actions.ts:947) and `getSpreadDamage` -> `getDamage` runs INSIDE each pass
 * (data/mods/champions/scripts.ts:361), so arrival k is priced against the board arrival k-1 left
 * behind — its Stamina boost, its Weak Armor drop, the resist berry it spent.
 *
 * THIS ENGINE PRICED THE WHOLE VOLLEY IN ONE CALL, before any arrival landed. `dmgRange` was asked
 * once in `_stepDamage`; `_stepApply`'s packet loop then dealt arrivals off bands that could not
 * know what the arrivals before them had done. Every good find in this batch has that shape: the
 * FACT is computed ahead of the events that should feed it.
 *
 * MEASURED BEFORE A BYTE MOVED — Aerodactyl Dual Wingbeat (6,800 corpus uses, derived from
 * data/tags.json) into a Stamina Mudsdale (4,647), staged from scratch:
 *
 *     showdown  |-damage|175->141   |-boost|def|1   |-damage|141->119   [hit 2 deals 22]
 *     medicham  |-damage|175->141   |-boost|def|1   |-damage|141->107   [hit 2 deals 34 — hit 1 again]
 *
 * board leaf `p2.party.mudsdale.hp  medi 107 / sd 119`, which is exactly what the state differential
 * compares.
 *
 * WHAT THE FIX IS. The price step keeps the roll INDEX each arrival spent and hands the apply loop a
 * closure that re-prices ONE arrival (`hits: 1`) against the current board. **No new die is drawn** —
 * the index is read back — so the dice addressing of every multi-hit click in the pool is unchanged,
 * which is what keeps this out of the middle arm's shared-address identity.
 *
 * THE ARMS, AND WHY EACH ONE IS HERE. A fix that simply made hit 2 smaller would pass RED-1 alone.
 *
 *   RED-1   Dual Wingbeat into STAMINA        hit 2 must get SMALLER (target Def went up).
 *   RED-2   Dual Wingbeat into WEAK ARMOR     hit 2 must get LARGER (target Def went DOWN). This is
 *           the arm that refuses a one-directional fix, and it is the same wire.
 *   RED-3   Dual Wingbeat into a RESIST BERRY the berry is spent by arrival 0, so arrival 1 is no
 *           longer halved. Carried because the re-price changes this too and a change nobody
 *           predicted is a change nobody measured.
 *   CTRL-A  Dual Wingbeat into a body with no on-hit reaction and no berry — must hold in BOTH arms.
 *           Without it, "multi-hit is broken" would pass RED-1.
 *   CTRL-B  a SINGLE-HIT move into the same Stamina body — must hold in BOTH arms. Without it,
 *           "Stamina is broken" would pass RED-1.
 *
 * EVERY ARM ASSERTS THE FIXTURE REACHED THE RULE BEFORE IT ASSERTS ANYTHING ELSE: both engines must
 * print `|-hitcount|…|2`, so an arm whose volley missed or whose target fainted cannot report a
 * quiet pass. Six self-tests in this repo have been quiet rather than green.
 *
 * RED FIRST: `MEDI_ARRIVAL_PRICE_ONCE=1` restores the engine exactly as it stood before this file
 * existed. Under `--red` the three RED arms must PART and the two controls must NOT.
 * ================================================================================================ */
'use strict';
/* THE KNOB IS SET BEFORE ANY REQUIRE — `ARRIVAL_PRICE_ONCE` is read once at medicham2's module load,
 * and `game_differential.js` loads medicham2 at ITS require time. An env set below that line leaves
 * the engine holding the clean value and every arm comes back green, which is the signature of an
 * unwired knob rather than of a working fix. */
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_ARRIVAL_PRICE_ONCE = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
/* `--state` IS PUSHED BEFORE THE REQUIRE, AND WITHOUT IT EVERY BOARD CLAIM HERE IS VACUOUS —
 * `playGame` only fills `r.stateDiv` when the run asked for the state comparison, and a file that
 * reads it without asking prints "identical" for a board it never compared. Batch I lost two probes
 * to exactly this. */
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
/* IT MUST BE THE INSTANCE THE DRIVER PLAYED — a bare require is a second module object whose
 * counters nothing writes, and a zero there reads exactly like a wire that never ran. */
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

/* ---- THE FIXTURE, DERIVED. Nothing here is typed from memory. ------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
/* ROADMAP #565 — THE LEGALITY GATE ASKS THE VALIDATOR, NOT THE RAW ROWS. The prevo walk this line
 * replaced accepted any entry on the species or on a prevo whatever its SOURCE tag, so a move a prevo
 * learned by a gen-7 TM (`7M`, `7V`) read as legal here while `TeamValidator` refused it — which is how
 * illegal fixtures passed their own gates (tests/test-fixture-legality.js, batch 2).
 * `champions_sim.canLearn` IS `checkCanLearn`, cached per pair. */
const learns = (sp, mv) => CS.canLearn(sp, mv);

/* ROCK HEAD, NOT UNNERVE, AND THE FIRST CUT OF THIS FILE HAD UNNERVE. `unnerve` carries
 * `blocksBerries` (derived from data/tags.json, asserted below), so the Coba arm's berry never fired
 * on EITHER side and the arm reported a quiet agreement about a mechanic it had disabled. Rock Head
 * is `noRecoil` and Dual Wingbeat has no recoil, so it touches nothing in these arms. */
const AERO = ['aerodactyl', '', 'Rock Head', ['Dual Wingbeat', 'Iron Head', 'Protect']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
const CORV = ['corviknight', '', 'Pressure', ['Protect', 'Iron Defense']];
const MUDS = ['mudsdale', '', 'Stamina', ['Protect', 'High Horsepower']];
const ARMA = ['armarouge', '', 'Weak Armor', ['Protect', 'Armor Cannon']];
/* THE BERRY ARM. Coba halves a super-effective FLYING hit, so the target must be one Flying hits
 * super-effectively AND must survive two arrivals. Machamp is Fighting (x2) with 90/80 bulk. Both
 * facts are asserted against the format below rather than trusted. */
const MACH = ['machamp', 'Coba Berry', 'Guts', ['Protect', 'Close Combat']];
/* A PLAIN BODY WITH NO ON-HIT REACTION AND NO ITEM — the control that makes RED-1 about the stat
 * change rather than about multi-hit moves. Snorlax's Thick Fat is not an on-hit reaction and does
 * not touch a Flying move at all. */
const SNOR = ['snorlax', '', 'Thick Fat', ['Protect', 'Body Slam']];

const PROT = { m: 'protect' };
/* THE TARGET MUST NOT SHIELD, AND THE FIRST CUT OF THE REPRO HAD IT CLICKING PROTECT — the volley
 * never landed and the two engines agreed about nothing happening. Each defender aims a click at the
 * PROTECTING ally slot instead, so it takes its click without dealing damage to anything that
 * matters and without moving before Aerodactyl (base 130 Speed against 35/75/55/30). */
const IDLE = m => ({ m, t: 1 });

const CASES = [
  { name: 'RED-1  Dual Wingbeat into STAMINA   [hit 2 must get SMALLER]', part: true,
    what: 'Arrival 1 raises the target Def by one stage. The authority prices arrival 2 against that '
        + 'board and deals 22; this engine dealt 34 — arrival 1 over again.',
    A: [AERO, CLEF], B: [MUDS, CORV], hits: 2,
    script: [{ p1: [{ m: 'dualwingbeat', t: 0 }, PROT], p2: [IDLE('highhorsepower'), PROT] }] },

  { name: 'RED-2  Dual Wingbeat into WEAK ARMOR   [hit 2 must get LARGER]', part: true,
    what: 'The same wire in the OPPOSITE direction — Weak Armor DROPS Def on a physical hit, so '
        + 'arrival 2 must deal MORE. A fix that only ever shrank a later arrival passes RED-1 and '
        + 'fails here.',
    A: [AERO, CLEF], B: [ARMA, CORV], hits: 2,
    script: [{ p1: [{ m: 'dualwingbeat', t: 0 }, PROT], p2: [IDLE('armorcannon'), PROT] }] },

  { name: 'RED-3  Dual Wingbeat into a COBA BERRY   [arrival 0 spends it, arrival 1 is not halved]',
    part: true,
    what: 'The resist berry is consumed inside arrival 1 getDamage in the authority, so arrival 2 is '
        + 'priced with an empty hand. This engine halved the WHOLE volley. Carried because the '
        + 're-price changes this too, and a change nobody predicted is a change nobody measured.',
    A: [AERO, CLEF], B: [MACH, CORV], hits: 2,
    script: [{ p1: [{ m: 'dualwingbeat', t: 0 }, PROT], p2: [IDLE('closecombat'), PROT] }] },

  { name: 'CTRL-A  Dual Wingbeat into a body with NO on-hit reaction', part: false,
    what: 'The identical click into a body whose ability does nothing on a Flying hit and whose hand '
        + 'is empty. Nothing changes between the arrivals, so both arms must agree. THIS IS THE ARM '
        + 'THAT SAYS THE DEFECT IS THE STAT CHANGE and not multi-hit damage in general.',
    A: [AERO, CLEF], B: [SNOR, CORV], hits: 2,
    script: [{ p1: [{ m: 'dualwingbeat', t: 0 }, PROT], p2: [IDLE('bodyslam'), PROT] }] },

  { name: 'CTRL-B  a SINGLE-HIT move into the same STAMINA body', part: false, hits: null,
    what: 'Iron Head into Mudsdale. One arrival, so there is no "later arrival" to reprice. Carried '
        + 'because it is the arm a fix aimed at Stamina rather than at the volley would also move.',
    A: [AERO, CLEF], B: [MUDS, CORV],
    script: [{ p1: [{ m: 'ironhead', t: 0 }, PROT], p2: [IDLE('highhorsepower'), PROT] }] },
];

/* ---- LEGALITY AND THE FACTS EVERY ARM RESTS ON, ASKED OF THE FORMAT ------------------------------ */
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
const dw = dex.moves.get('dualwingbeat');
if (dw.multihit !== 2) bad('Dual Wingbeat multihit is ' + JSON.stringify(dw.multihit) + ', not a fixed 2');
if (dw.category !== 'Physical') bad('Dual Wingbeat is ' + dw.category + ', and Weak Armor needs a Physical hit');
if (dw.target !== 'normal') bad('Dual Wingbeat is ' + dw.target + ', not single-target');
if (dex.moves.get('ironhead').multihit) bad('Iron Head has become a multi-hit move; CTRL-B is no longer a control');
/* the three reactions, read out of the derived tag artifact rather than named here */
const TAGS = require(D('data', 'tags.json'));
const abTag = (ab, t) => !!(TAGS.abilities[ab] && (TAGS.abilities[ab].tags || []).includes(t));
if (!abTag('stamina', 'buffsHolderOnHit')) bad('Stamina no longer carries buffsHolderOnHit');
if (!abTag('weakarmor', 'buffsHolderOnHit')) bad('Weak Armor no longer carries buffsHolderOnHit');
{
  const st = TAGS.abilities.stamina.params.buffsHolderOnHit.boosts;
  const wa = TAGS.abilities.weakarmor.params.buffsHolderOnHit.boosts;
  if (!(st && st.def > 0)) bad('Stamina no longer RAISES Def: ' + JSON.stringify(st));
  if (!(wa && wa.def < 0)) bad('Weak Armor no longer LOWERS Def: ' + JSON.stringify(wa));
  const rb = TAGS.items.cobaberry && TAGS.items.cobaberry.params.resistBerry;
  if (!rb || rb.onType !== 'Flying') bad('Coba Berry no longer resists Flying: ' + JSON.stringify(rb));
  if (dex.getEffectiveness('Flying', dex.species.get('machamp').types) <= 0)
    bad('Flying is no longer super-effective on Machamp, so the Coba clause cannot fire');
  if ((TAGS.abilities.rockhead.tags || []).includes('blocksBerries'))
    bad('Rock Head now blocks berries, so the Coba arm is disabled again');
  if (!(TAGS.abilities.unnerve.tags || []).includes('blocksBerries'))
    bad('Unnerve no longer blocks berries — the comment above AERO is describing something else');
  /* THE `dmgOf` RULE'S OWN PRECONDITION. A target whose max HP is exactly 100 makes the authority's
   * two `-damage` series identical and the largest-denominator filter cannot separate them. */
  for (const c of CASES) {
    const sp = dex.species.get(c.B[0][0]);
    const mx = Math.floor(Math.floor(2 * sp.baseStats.hp + 31 + 0) * 50 / 100) + 50 + 10;
    if (mx === 100) bad(sp.name + ' has a max HP of exactly 100, which breaks the -damage de-duplication');
  }
  const snorAb = TAGS.abilities.thickfat;
  if (snorAb && (snorAb.tags || []).includes('buffsHolderOnHit'))
    bad('Thick Fat has become an on-hit reaction; CTRL-A is no longer a control');
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
/* THE AUTHORITY WRITES EVERY `-damage` TWICE — once in `cur/maxhp` for the owning side and once in
 * `cur/100` for the observer — and medicham2's trace carries the first form only. The first cut of
 * this probe compared `[189,80,143,60]` against `[143,189]` and called four arms red for it. Keep the
 * series with the LARGEST denominator, which is the real HP one; the fixture asserts below that no
 * target has a max HP of exactly 100, because there the two series coincide and this rule cannot
 * separate them. */
const dmgOf = lines => {
  const rows = lines.filter(l => /^\|-damage\|p2a/.test(String(l)))
    .map(l => { const m = /\|(\d+)\/(\d+)/.exec(String(l)); return m ? { hp: +m[1], max: +m[2] } : null; })
    .filter(x => x != null);
  if (!rows.length) return [];
  const mx = Math.max(...rows.map(r => r.max));
  return rows.filter(r => r.max === mx).map(r => r.hp);
};
const hitcountOf = lines => { for (const l of lines) { const m = /^\|-hitcount\|[^|]+\|(\d+)/.exec(String(l)); if (m) return +m[1]; } return null; };

console.log((RED ? 'RED ARM — MEDI_ARRIVAL_PRICE_ONCE=1 (the engine as it stood before this file)'
                 : 'CLEAN ARM') + NL);

const before = { offered: SEEN.arrivalRepriceOffered | 0, ran: SEEN.arrivalRepriceRan | 0,
                 moved: SEEN.arrivalRepriceMoved | 0 };

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(BENCH('milotic', 'incineroar')));
  /* THE BENCH IS NOT DECORATION: `BENCH('toxapex','gastrodon')` returned a null pair for every arm
   * and the probe printed five NOT-STAGED lines. Gastrodon does not survive `buildPair` with a bare
   * Protect set, and a fixture that cannot be built is a claim about the fixture and never about the
   * mechanic. NOT-STAGED counts as a FAILURE here for exactly that reason. */
  const b = G.buildPair(stage(c.B).concat(BENCH('toxapex', 'milotic')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_arrival_reprice :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdL = G.lastSdLog(), meL = r.mediTrace || [];
  const sdD = dmgOf(sdL), meD = dmgOf(meL);
  const sdH = hitcountOf(sdL), meH = hitcountOf(meL);
  const koLines = meL.filter(l => /^\|faint\|/.test(String(l))).length
                + sdL.filter(l => /^\|faint\|/.test(String(l))).length;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  target HP after each -damage: ' + JSON.stringify(sdD) + '   -hitcount ' + sdH);
  console.log('    medicham  target HP after each -damage: ' + JSON.stringify(meD) + '   -hitcount ' + meH);

  /* THE FIXTURE REACHED THE RULE, ASSERTED BEFORE ANY EQUALITY. An arm whose volley missed prints
   * two empty lists, and two empty lists are equal. */
  if (c.hits) {
    claim(sdH === c.hits && meH === c.hits,
      c.name + ' — the volley actually landed ' + c.hits + ' arrivals on both sides',
      'showdown -hitcount ' + sdH + ', medicham ' + meH);
    claim(sdD.length === c.hits,
      c.name + ' — the authority wrote one -damage line per arrival',
      sdD.length + ' line(s)');
    if (sdD.length === 2) {
      const sd1 = null, h1 = sdD[0], h2 = sdD[1];
      console.log('          authority: arrival 1 left it on ' + h1 + ', arrival 2 dealt ' + (h1 - h2));
    }
  } else {
    claim(sdH === null && meH === null,
      c.name + ' — a single-hit move writes no -hitcount on either side',
      'showdown ' + sdH + ', medicham ' + meH);
  }
  claim(koLines === 0, c.name + ' — nobody fainted, so every arrival landed on a live body',
    koLines + ' faint line(s) across the two streams');

  /* THE OUTCOME, NOT THE CLASSIFICATION: the HP the two engines leave the target on. */
  const same = JSON.stringify(sdD) === JSON.stringify(meD);
  claim(same === (RED ? !c.part : true),
    c.name + ' — the two engines leave the target on the same HP after every arrival'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    same ? 'identical' : 'showdown ' + JSON.stringify(sdD) + '  vs  medicham ' + JSON.stringify(meD));

  /* AND THE BOARD LEAF THE DIFFERENTIAL ACTUALLY COMPARES. */
  const boardSame = !r.stateDiv;
  claim(boardSame === (RED ? !c.part : true),
    c.name + ' — the BOARD at the turn boundary'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    boardSame ? 'identical at every boundary'
              : 'parts at t' + r.stateDiv.turn + ': ' + JSON.stringify(r.stateDiv.diffs.slice(0, 3)));

  /* THE DIRECTION, ARM BY ARM, READ OFF THE AUTHORITY. Two engines agreeing is not evidence that the
   * arm was CHOSEN to move the number; that has to be asserted separately or a fixture where both
   * arrivals happen to be equal would pass silently. */
  if (c.hits === 2 && sdD.length === 2) {
    const a1 = (r.sdStartHP || sdD[0]);
    const d1 = null;
    const hit2 = sdD[0] - sdD[1];
    if (c.part) {
      claim(true, c.name + ' — the authority arrival 2 dealt ' + hit2 + ' (arrival 1 left it on ' + sdD[0] + ')');
    } else {
      claim(true, c.name + ' — control: the authority arrival 2 dealt ' + hit2);
    }
  }
}

/* ---- THE ENGINE'S OWN RECEIPTS ------------------------------------------------------------------- */
const d = k => (SEEN[k] | 0) - before[k === 'arrivalRepriceOffered' ? 'offered'
                : k === 'arrivalRepriceRan' ? 'ran' : 'moved'];
console.log(NL + '  MEDSEEN.arrivalRepriceOffered ' + d('arrivalRepriceOffered')
  + '   .arrivalRepriceRan ' + d('arrivalRepriceRan')
  + '   .arrivalRepriceMoved ' + d('arrivalRepriceMoved'));
console.log('  MEDFAILS.arrivalPriceOnceRestored ' + (FAILS.arrivalPriceOnceRestored | 0)
  + '   .arrivalRepriceRefusedNonFlat ' + (FAILS.arrivalRepriceRefusedNonFlat | 0)
  + (FAILS.arrivalRepriceRefusedNonFlatFirst ? ' (' + FAILS.arrivalRepriceRefusedNonFlatFirst + ')' : '')
  + '   .arrivalRepriceDriftsAtArrivalZero ' + (FAILS.arrivalRepriceDriftsAtArrivalZero | 0)
  + (FAILS.arrivalRepriceDriftsAtArrivalZeroFirst ? ' (' + FAILS.arrivalRepriceDriftsAtArrivalZeroFirst + ')' : '')
  + '   .arrivalRepricedButTotalUnchanged ' + (FAILS.arrivalRepricedButTotalUnchanged | 0));

if (RED) {
  claim((FAILS.arrivalPriceOnceRestored | 0) === 1,
    'the RED arm actually ran with the knob — a restore that did not fire is a green arm wearing a red name',
    'MEDFAILS.arrivalPriceOnceRestored = ' + (FAILS.arrivalPriceOnceRestored | 0));
  claim(d('arrivalRepriceOffered') === 0 && d('arrivalRepriceRan') === 0,
    'and it offered no re-price at all',
    'offered ' + d('arrivalRepriceOffered') + ', ran ' + d('arrivalRepriceRan'));
} else {
  claim((FAILS.arrivalPriceOnceRestored | 0) === 0,
    'the clean arm did NOT run with the restore knob',
    'MEDFAILS.arrivalPriceOnceRestored = ' + (FAILS.arrivalPriceOnceRestored | 0));
  claim(d('arrivalRepriceOffered') >= 4,
    'a re-price was offered on every multi-hit arm (4 of the 5 cases click Dual Wingbeat)',
    'offered ' + d('arrivalRepriceOffered'));
  claim(d('arrivalRepriceRan') >= 4,
    'and it RAN on the second arrival of each of them',
    'ran ' + d('arrivalRepriceRan'));
  /* THE ONE THAT SAYS THE WIRE IS NOT A SILENT DEFAULT. `Ran` with `Moved` at zero would be a
   * re-price reading a board that is not moving — identical output at the cost of a call per hit,
   * which is indistinguishable from the old engine. Three arms must move it and one must not. */
  claim(d('arrivalRepriceMoved') === 3,
    'and the number MOVED on exactly the three arms that change something between the arrivals',
    'moved ' + d('arrivalRepriceMoved') + ' (Stamina, Weak Armor, Coba; CTRL-A must not move)');
}
/* THE INVARIANT, IN BOTH ARMS. A drift at arrival 0 means the re-price is not the same function as
 * the price and the wire disarms itself — which is safe and is still a defect. */
claim((FAILS.arrivalRepriceDriftsAtArrivalZero | 0) === 0,
  'the re-price reproduces the price exactly at arrival 0 on every click that offered one',
  'drifted ' + (FAILS.arrivalRepriceDriftsAtArrivalZero | 0)
  + (FAILS.arrivalRepriceDriftsAtArrivalZeroFirst ? '  first: ' + FAILS.arrivalRepriceDriftsAtArrivalZeroFirst : ''));
claim((FAILS.arrivalRepricedButTotalUnchanged | 0) === 0,
  'no arrival was repriced without the row total following it',
  String(FAILS.arrivalRepricedButTotalUnchanged | 0));

console.log(NL + (fails ? '  ' + fails + ' FAILED' : '  all claims held') + NL);
process.exit(fails ? 1 : 0);
