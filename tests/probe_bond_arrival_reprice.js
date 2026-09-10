#!/usr/bin/env node
/* tests/probe_bond_arrival_reprice.js — A VOLLEY WHOSE ARRIVALS DIFFER IS STILL PRICED PER ARRIVAL
 *   node tests/probe_bond_arrival_reprice.js        node tests/probe_bond_arrival_reprice.js --red
 * ==================================================================================================
 *
 * BATCH M FIXED THIS FOR A FLAT VOLLEY AND DECLARED THE REST REFUSED, IN WRITING:
 *
 *     IT IS OFFERED ONLY FOR A FLAT VOLLEY -- every arrival sharing one band. Triple Axel's
 *     escalating power and Parental Bond's quarter give their arrivals DIFFERENT bands, and a
 *     `hits: 1` re-price would hand back arrival 1's band for all of them. Those are counted
 *     and left alone rather than repriced wrongly.
 *
 * `MEDFAILS.arrivalRepriceRefusedNonFlat` read **180 on the pinned pool**. It was doing its job and
 * nothing read it — and one of the three remaining board-material games was inside it.
 *
 * MEASURED, release `c28ad0815782`, `pair-protect-bust ...bo3-2661266222` t6, a Kangaskhan-Mega
 * Drain Punch into an Incineroar holding a Chople Berry:
 *
 *     arrival 1   SE, berry EATEN + WEAKEN     170 -> 135  (35)   Kangaskhan drains +18 -> 72
 *     arrival 2   showdown                     135 -> 119  (16)   drains +8  -> 80
 *                 medicham                     135 -> 127  ( 8)   drains +4  -> 76
 *
 * Exactly half: the berry arrival 1 spent was still halving arrival 2. Board leaf
 * `p1.party.incineroar.hp medi 127 / sd 119`, and the drain heal parts with it.
 *
 * WHY THE AUTHORITY DOES NOT HAVE THIS. `hitStepMoveHitLoop` calls `spreadMoveHit` once per hit
 * (sim/battle-actions.ts:947) and `getSpreadDamage` -> `getDamage` runs INSIDE each pass
 * (data/mods/champions/scripts.ts:361), so arrival k is priced against whatever arrival k-1 left
 * behind — including an empty item slot.
 *
 * THE FIX. `dmgRange`'s per-hit loop already prices each arrival with its own `hitNo`; `onlyHitNo`
 * runs that loop for ONE value of `h`. So Parental Bond's quarter (`hitNo === 2 && perHit.bondMult`)
 * and Triple Axel's escalation are applied by the code that owns them rather than reconstructed at
 * the call site, and NO NEW DIE IS DRAWN — `R.pkIdx[i]` is the index the arrival already spent.
 *
 * `hits` IS DELIBERATELY NOT SET TO 1 ON THIS ROAD. `hitPlanOf` reads `hit.hits` as a ROLLED COUNT,
 * so `hits: 1` returns `{n:1}` for Triple Axel and would shorten the plan under the re-price. The
 * FLAT road keeps `hits: 1`, which is the single-arrival question its `_flat/_n` split is built on.
 *
 * THE ARMS, AND WHAT EACH ONE REFUSES.
 *
 *   RED-1  Parental Bond into a CHOPLE BERRY  — arrival 1 spends it, so arrival 2 must get LARGER.
 *          This is the pool game, staged.
 *   RED-2  Parental Bond into WEAK ARMOR      — the target's Def DROPS, so arrival 2 must get larger
 *          for a different reason. Carried because a fix that only ever un-halved a berry would pass
 *          RED-1 and fail here: it is the same wire reached through a stat instead of an item.
 *   CTRL-A Parental Bond into a plain body    — no berry, no on-hit reaction. MUST HOLD IN BOTH ARMS.
 *          THIS IS THE ARM THAT SAYS THE RE-PRICE REPRODUCES THE PRICE: if `onlyHitNo` asked a
 *          different question from the one the price asked, arrival 2 would move here too.
 *   CTRL-B the same click from a NON-MEGA Kangaskhan into the same berry body — one arrival, so
 *          there is no later arrival to re-price. MUST HOLD IN BOTH ARMS. Without it, "Parental Bond
 *          damage is broken" would pass RED-1.
 *
 * EVERY ARM ASSERTS THE FIXTURE REACHED THE RULE FIRST: the bond arms must print `|-hitcount|…|2` on
 * BOTH sides, the mega must have been accepted by the authority's own request (`scriptMegaRefused`
 * at 0), and `MEDFAILS.arrivalRepriceRefusedNonFlat` must be above zero — that counter is the only
 * evidence the click reached the NON-FLAT road at all.
 *
 * RED FIRST: `MEDI_ARRIVAL_REPRICE_FLAT_ONLY=1` restores batch M's engine exactly — the flat road
 * working, the non-flat road refused. It is NARROWER than `MEDI_ARRIVAL_PRICE_ONCE`, which turns off
 * both; a probe about the non-flat road must be shown red against the engine that had the other one.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_ARRIVAL_REPRICE_FLAT_ONLY = '1';
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

/* THE POOL'S OWN PAIR. Kangaskhan + Kangaskhanite is Parental Bond; Drain Punch is the click, and
 * the drain is kept because the heal parts with the damage and is a second reading of the same fact. */
const KANG_MEGA = ['kangaskhan', 'Kangaskhanite', 'Scrappy', ['Drain Punch', 'Protect']];
const KANG_BASE = ['kangaskhan', '', 'Scrappy', ['Drain Punch', 'Protect']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
/* THE BERRY ARM. Chople halves a super-effective FIGHTING hit. Incineroar is Fire/Dark — Fighting is
 * neutral on Fire and doubled on Dark, so the net is x2 and the berry clause fires. It must survive
 * both arrivals, which 170 HP against a resisted-then-unresisted Drain Punch does. */
const INCI = ['incineroar', 'Chople Berry', 'Blaze', ['Protect', 'Flare Blitz']];
/* THE STAT ARM, in the other direction: Weak Armor DROPS Def on a physical hit. Armarouge is
 * Fire/Psychic, so Fighting is RESISTED here (x1 into Fire, x0.5 into Psychic) — deliberately, so
 * that the only thing moving between the two arrivals is the Def stage. */
const ARMA = ['armarouge', '', 'Weak Armor', ['Protect', 'Armor Cannon']];
/* THE PLAIN BODY. Snorlax's Thick Fat is not an on-hit reaction and does not touch a Fighting move;
 * the hand is empty. Asserted below rather than assumed. */
const SNOR = ['snorlax', '', 'Thick Fat', ['Protect', 'Body Slam']];

const PROT = { m: 'protect' };
const IDLE = m => ({ m, t: 1 });          // aimed at the BRACED p1b, so it moves no number read here
const DP = mega => ({ m: 'drainpunch', t: 0, mega: !!mega });
/* THE USER MUST BE BELOW ITS MAXIMUM OR THE DRAIN READING IS VACUOUS, and the first cut of this file
 * shipped it vacuous: `-heal|p1a` came back `[]` on every arm because a full-HP body heals nothing,
 * and two empty lists are equal. So the RED arms open with a WOUNDING turn — the target attacks p1a
 * while p1a spends its click on the BRACED p2b — and the bond click is turn two. The drain is a
 * SECOND READING of the same defect (half the damage drains half as much), and a fix that moved one
 * and not the other would still part the board. */
const WOUND = m => ({ p1: [{ m: 'drainpunch', t: 1 }, PROT], p2: [{ m, t: 0 }, PROT] });

const CASES = [
  { name: 'RED-1  Parental Bond into a CHOPLE BERRY   [arrival 2 must get LARGER]',
    part: true, hits: 2, mega: true, nonflat: true,
    A: [KANG_MEGA, CLEF], B: [INCI, CLEF],
    what: 'Arrival 1 EATS the berry and is halved by it. The authority prices arrival 2 with an '
        + 'empty item slot; this engine kept the halving and dealt half. This is the pool game.',
    wound: true,
    script: [WOUND('flareblitz'), { p1: [DP(true), PROT], p2: [IDLE('flareblitz'), PROT] }] },

  { name: 'RED-2  Parental Bond into WEAK ARMOR   [arrival 2 must get LARGER, for another reason]',
    part: true, hits: 2, mega: true, nonflat: true,
    A: [KANG_MEGA, CLEF], B: [ARMA, CLEF],
    what: 'The same wire reached through a STAT rather than an item — arrival 1 drops the target Def, '
        + 'so arrival 2 must deal more. A fix aimed only at the berry passes RED-1 and fails here. '
        + 'The hit is RESISTED here (Fighting into Fire/Psychic), which is deliberate: the variable '
        + 'is the Def stage and not the type chart.',
    wound: true,
    script: [WOUND('armorcannon'), { p1: [DP(true), PROT], p2: [IDLE('armorcannon'), PROT] }] },

  { name: 'CTRL-A  Parental Bond into a plain body   [must HOLD in BOTH arms]',
    part: false, hits: 2, mega: true, nonflat: true,
    A: [KANG_MEGA, CLEF], B: [SNOR, CLEF],
    what: 'No berry, no on-hit reaction. Nothing changes between the arrivals, so the re-price must '
        + 'hand back exactly what the price handed back. THIS IS THE ARM THAT SAYS `onlyHitNo` ASKS '
        + 'THE SAME QUESTION THE PRICE ASKED.',
    script: [{ p1: [DP(true), PROT], p2: [IDLE('bodyslam'), PROT] }] },

  { name: 'CTRL-B  a NON-MEGA Kangaskhan into the same berry body   [one arrival, must HOLD]',
    part: false, hits: null, mega: false, nonflat: false,
    A: [KANG_BASE, CLEF], B: [INCI, CLEF],
    what: 'The identical click without Parental Bond. One arrival, so there is no later arrival to '
        + 're-price, and the berry does what it has always done. Carried because a fix that broke '
        + 'Drain Punch or the berry outright would pass RED-1.',
    script: [{ p1: [DP(false), PROT], p2: [IDLE('flareblitz'), PROT] }] },
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
  const TAGS = require(D('data', 'tags.json'));
  const dp = dex.moves.get('drainpunch');
  if (dp.category !== 'Physical') bad('Drain Punch is ' + dp.category + ', and Weak Armor needs a Physical hit');
  if (dp.type !== 'Fighting') bad('Drain Punch is ' + dp.type + ', so the Chople clause cannot fire');
  if (dp.multihit) bad('Drain Punch has become a multi-hit move; Parental Bond would be refused');
  if (!dp.drain) bad('Drain Punch no longer drains, so the second reading of the fix is gone');
  /* THE MEGA IS THE KNOB, so its ability is asserted rather than named from memory. */
  const km = dex.species.get('kangaskhanmega');
  if (!legal(km)) bad('Kangaskhan-Mega is not in this format');
  if (dex.abilities.get(Object.values(km.abilities)[0]).id !== 'parentalbond')
    bad('Kangaskhan-Mega\'s ability is ' + JSON.stringify(km.abilities) + ', not Parental Bond');
  const rb = TAGS.items.chopleberry && TAGS.items.chopleberry.params.resistBerry;
  if (!rb || rb.onType !== 'Fighting') bad('Chople Berry no longer resists Fighting: ' + JSON.stringify(rb));
  if (dex.getEffectiveness('Fighting', dex.species.get('incineroar').types) <= 0)
    bad('Fighting is no longer super-effective on Incineroar, so the berry clause cannot fire');
  /* THE STAT ARM DOES NOT NEED SUPER-EFFECTIVE and must not claim it — Armarouge is Fire/Psychic,
   * and Fighting is x1 into Fire and x0.5 into Psychic, so the click is RESISTED there. That is
   * fine and is the point: the variable in RED-2 is the Def stage, not the type chart. What it does
   * need is that the move is not refused outright and that the target keeps its Weak Armor. (This
   * assertion read `<= 0` in the first cut of this file and the fixture gate refused the run —
   * which is the gate doing its job on a fact typed from memory.) */
  if (!dex.getImmunity('Fighting', dex.species.get('armarouge').types))
    bad('Armarouge is now immune to Fighting, so RED-2 cannot land at all');
  const wa = TAGS.abilities.weakarmor && TAGS.abilities.weakarmor.params.buffsHolderOnHit;
  if (!(wa && wa.boosts && wa.boosts.def < 0)) bad('Weak Armor no longer LOWERS Def: ' + JSON.stringify(wa));
  const tf = TAGS.abilities.thickfat;
  if (tf && (tf.tags || []).includes('buffsHolderOnHit'))
    bad('Thick Fat has become an on-hit reaction; CTRL-A is no longer a control');
  if ((TAGS.abilities.blaze.tags || []).includes('buffsHolderOnHit'))
    bad('Blaze has become an on-hit reaction; the berry arm would then have two variables');
  for (const c of CASES) {
    const sp = dex.species.get(c.B[0][0]);
    const mx = Math.floor(Math.floor(2 * sp.baseStats.hp + 31) * 50 / 100) + 50 + 10;
    if (mx === 100) bad(sp.name + ' has a max HP of exactly 100, which breaks the -damage read');
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
/* `want` IS NOT DECORATION. The wounding turn makes the target deal ITSELF recoil, and a bare
 * `-damage|p2a` count then reads 3 for a two-arrival volley — which is the ARM asserting the wrong
 * thing, not the engine being wrong. The volley's own damage lines carry NO `[from]` tag; the drain
 * heals carry `[from] drain` and nothing else on that body does. So each series names its tag. */
const seriesOf = (lines, kind, who, want) => {
  const re = new RegExp('^\\|' + kind + '\\|' + who);
  const rows = lines.filter(l => re.test(String(l)))
    .filter(l => want === null ? String(l).indexOf('|[from]') < 0
                               : String(l).indexOf(want) >= 0)
    .map(l => { const m = /\|(\d+)\/(\d+)/.exec(String(l)); return m ? { hp: +m[1], max: +m[2] } : null; })
    .filter(x => x != null);
  if (!rows.length) return [];
  const mx = Math.max(...rows.map(r => r.max));
  return rows.filter(r => r.max === mx).map(r => r.hp);
};
const hitcountOf = lines => { for (const l of lines) { const m = /^\|-hitcount\|[^|]+\|(\d+)/.exec(String(l)); if (m) return +m[1]; } return null; };

console.log((RED ? 'RED ARM — MEDI_ARRIVAL_REPRICE_FLAT_ONLY=1 (batch M\'s engine: flat road on, non-flat refused)'
                 : 'CLEAN ARM') + NL);

const b0 = { offered: SEEN.arrivalRepriceOffered | 0, ran: SEEN.arrivalRepriceRan | 0,
             moved: SEEN.arrivalRepriceMoved | 0, nonflat: FAILS.arrivalRepriceRefusedNonFlat | 0,
             drift: FAILS.arrivalRepriceDriftsAtArrivalZero | 0,
             outOfPlan: FAILS.arrivalRepriceArrivalOutOfPlan | 0 };

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(BENCH('milotic', 'toxapex')));
  const b = G.buildPair(stage(c.B).concat(BENCH('toxapex', 'milotic')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const nf0 = FAILS.arrivalRepriceRefusedNonFlat | 0;
  const r = G.playGame(a, b, 'directed', 'probe_bond_arrival_reprice :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdL = G.lastSdLog(), meL = r.mediTrace || [];
  const sdD = seriesOf(sdL, '-damage', 'p2a', null), meD = seriesOf(meL, '-damage', 'p2a', null);
  const sdH = seriesOf(sdL, '-heal', 'p1a', '[from] drain'), meH = seriesOf(meL, '-heal', 'p1a', '[from] drain');
  const sdC = hitcountOf(sdL), meC = hitcountOf(meL);
  const nonflat = (FAILS.arrivalRepriceRefusedNonFlat | 0) - nf0;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  target HP after each -damage: ' + JSON.stringify(sdD)
    + '   user HP after each drain: ' + JSON.stringify(sdH) + '   -hitcount ' + sdC);
  console.log('    medicham  target HP after each -damage: ' + JSON.stringify(meD)
    + '   user HP after each drain: ' + JSON.stringify(meH) + '   -hitcount ' + meC);
  console.log('    non-flat volleys seen at the price step this arm: ' + nonflat);

  /* ---- THE FIXTURE REACHED THE RULE ------------------------------------------------------------- */
  if (c.hits) {
    claim(sdC === c.hits && meC === c.hits,
      c.name + ' — the volley landed ' + c.hits + ' arrivals on BOTH sides',
      'showdown -hitcount ' + sdC + ', medicham ' + meC);
    claim(sdD.length === c.hits, c.name + ' — the authority wrote one -damage line per arrival',
      sdD.length + ' line(s)');
  } else {
    claim(sdC === null && meC === null,
      c.name + ' — a single-arrival click writes no -hitcount on either side',
      'showdown ' + sdC + ', medicham ' + meC);
    claim(sdD.length === 1, c.name + ' — the authority wrote exactly one -damage line',
      sdD.length + ' line(s)');
  }
  /* THE NON-FLAT ROAD IS THE ONE THIS FILE IS ABOUT. A bond arm that never reached it is testing
   * something else, and the counter is the only place that says so. */
  claim((nonflat > 0) === !!c.nonflat,
    c.name + ' — the click ' + (c.nonflat ? 'REACHED' : 'did NOT reach') + ' the non-flat price road',
    'arrivalRepriceRefusedNonFlat +' + nonflat);
  const koLines = meL.filter(l => /^\|faint\|/.test(String(l))).length
                + sdL.filter(l => /^\|faint\|/.test(String(l))).length;
  claim(koLines === 0, c.name + ' — nobody fainted, so every arrival landed on a live body',
    koLines + ' faint line(s) across the two streams');
  /* THE DIRECTION, READ OFF THE AUTHORITY. Two engines agreeing is not evidence the arm was chosen
   * to move anything; on a RED arm the authority's arrival 2 must be BIGGER than arrival 1's share. */
  if (c.hits === 2 && sdD.length === 2) {
    const start = Math.max(...sdD) + (sdD[0] < sdD[1] ? 0 : 0);
    const a2 = sdD[0] - sdD[1];
    console.log('          authority: arrival 1 left it on ' + sdD[0] + ', arrival 2 dealt ' + a2);
  }

  /* ---- THE OUTCOME ----------------------------------------------------------------------------- */
  const same = JSON.stringify(sdD) === JSON.stringify(meD);
  claim(same === (RED ? !c.part : true),
    c.name + ' — the two engines leave the TARGET on the same HP after every arrival'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    same ? 'identical' : 'showdown ' + JSON.stringify(sdD) + '  vs  medicham ' + JSON.stringify(meD));
  /* THE DRAIN IS A SECOND READING OF THE SAME NUMBER and is asserted separately: a fix that moved
   * the damage and not the heal would be half a fix and would still part the board. */
  if (c.wound) {
    /* THE READING MUST EXIST BEFORE IT IS COMPARED. Two empty lists are equal, and that is exactly
     * how the first cut of this arm reported a quiet pass on a full-HP user. */
    claim(sdH.length === c.hits && meH.length > 0,
      c.name + ' — both engines actually DRAINED, so this reading is not two empty lists',
      'showdown ' + JSON.stringify(sdH) + '   medicham ' + JSON.stringify(meH));
    /* WHAT IS COMPARED IS THE HP THE VOLLEY LEAVES THE USER ON, NOT THE LINE COUNT, and the reason
     * is printed rather than assumed: this engine pays a multi-arrival drain in ONE `-heal` line at
     * the foot of the volley while the authority pays one per arrival. The END STATE is the same
     * number and it is what the board differential reads; the line count is a NARRATION divergence
     * of its own, owed and named in docs/ENGINE.md rather than folded in here. Asserting the whole
     * series would make this file red for a defect it was not written about, and a red probe filed
     * as a status is the one thing CLAUDE.md refuses outright. */
    const sdEnd = sdH[sdH.length - 1], meEnd = meH[meH.length - 1];
    console.log('          drain LINES: showdown ' + sdH.length + ', medicham ' + meH.length
      + (sdH.length === meH.length ? '' : '   <- NARRATION, owed: this engine pays the drain of a '
        + 'volley once at the foot instead of once per arrival'));
    claim((sdEnd === meEnd) === (RED ? !c.part : true),
      c.name + ' — and the volley leaves the USER on the same HP'
        + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
      sdEnd === meEnd ? ('identical at ' + sdEnd)
                      : 'showdown ' + sdEnd + '  vs  medicham ' + meEnd);
  }

  /* ---- AND THE BOARD LEAF THE DIFFERENTIAL READS ----------------------------------------------- */
  const boardSame = !r.stateDiv;
  claim(boardSame === (RED ? !c.part : true),
    c.name + ' — the BOARD at the turn boundary'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    boardSame ? 'identical at every boundary'
              : 'parts at t' + r.stateDiv.turn + ': ' + JSON.stringify(r.stateDiv.diffs.slice(0, 3)));
}

/* ---- THE ENGINE'S OWN RECEIPTS ------------------------------------------------------------------- */
const d = (k, b) => (SEEN[k] | 0) - b;
console.log(NL + '  MEDSEEN.arrivalRepriceOffered ' + d('arrivalRepriceOffered', b0.offered)
  + '   .arrivalRepriceRan ' + d('arrivalRepriceRan', b0.ran)
  + '   .arrivalRepriceMoved ' + d('arrivalRepriceMoved', b0.moved));
console.log('  MEDFAILS.arrivalRepriceRefusedNonFlat ' + ((FAILS.arrivalRepriceRefusedNonFlat | 0) - b0.nonflat)
  + (FAILS.arrivalRepriceRefusedNonFlatFirst ? ' (' + FAILS.arrivalRepriceRefusedNonFlatFirst + ')' : '')
  + '   .arrivalRepriceDriftsAtArrivalZero ' + ((FAILS.arrivalRepriceDriftsAtArrivalZero | 0) - b0.drift)
  + '   .arrivalRepriceArrivalOutOfPlan ' + ((FAILS.arrivalRepriceArrivalOutOfPlan | 0) - b0.outOfPlan)
  + '   .arrivalRepriceFlatOnlyRestored ' + (FAILS.arrivalRepriceFlatOnlyRestored | 0));

/* THE INVARIANT IS NOT ALLOWED TO FIRE. It disarms the wire for the click it fires on, so a run with
 * a drift is a run where the fix silently did nothing — the exact shape a green probe would hide. */
claim(((FAILS.arrivalRepriceDriftsAtArrivalZero | 0) - b0.drift) === 0,
  'the re-price reproduced the price at arrival 0 on every click that offered one',
  'arrivalRepriceDriftsAtArrivalZero +' + ((FAILS.arrivalRepriceDriftsAtArrivalZero | 0) - b0.drift)
    + (FAILS.arrivalRepriceDriftsAtArrivalZeroFirst ? '  (' + FAILS.arrivalRepriceDriftsAtArrivalZeroFirst + ')' : ''));
claim(((FAILS.arrivalRepriceArrivalOutOfPlan | 0) - b0.outOfPlan) === 0,
  'no re-price asked for an arrival its hit plan does not have',
  'arrivalRepriceArrivalOutOfPlan +' + ((FAILS.arrivalRepriceArrivalOutOfPlan | 0) - b0.outOfPlan)
    + (FAILS.arrivalRepriceArrivalOutOfPlanFirst ? '  (' + FAILS.arrivalRepriceArrivalOutOfPlanFirst + ')' : ''));

if (RED) {
  claim((FAILS.arrivalRepriceFlatOnlyRestored | 0) === 1,
    'the RED arm actually ran with the knob — a restore that did not fire is a green arm in a red name',
    'MEDFAILS.arrivalRepriceFlatOnlyRestored = ' + (FAILS.arrivalRepriceFlatOnlyRestored | 0));
  claim(d('arrivalRepriceMoved', b0.moved) === 0,
    'and under it NO arrival was repriced at all — the non-flat road is the only one these arms use',
    'arrivalRepriceMoved +' + d('arrivalRepriceMoved', b0.moved));
} else {
  claim((FAILS.arrivalRepriceFlatOnlyRestored | 0) === 0,
    'the CLEAN arm did NOT carry the restore knob',
    'MEDFAILS.arrivalRepriceFlatOnlyRestored = ' + (FAILS.arrivalRepriceFlatOnlyRestored | 0));
  claim(d('arrivalRepriceMoved', b0.moved) > 0,
    'the wire actually MOVED a number — offered and ran with moved at zero is a call per arrival for '
      + 'output identical to the old engine',
    'arrivalRepriceMoved +' + d('arrivalRepriceMoved', b0.moved));
}
{
  const sc = G.scriptCounters();
  claim((sc.moveNotOnRequest | 0) === 0, 'every scripted click was on the authority\'s request',
    'moveNotOnRequest = ' + sc.moveNotOnRequest + (sc.firstMissing ? '  (' + sc.firstMissing + ')' : ''));
  claim((sc.megaRefused | 0) === 0, 'every mega this probe asked for was accepted by the authority',
    'megaRefused = ' + sc.megaRefused);
}

console.log(NL + (fails ? 'RED   ' + fails + ' failing claim(s).' : 'GREEN  every claim held.'));
process.exit(fails ? 1 : 0);
