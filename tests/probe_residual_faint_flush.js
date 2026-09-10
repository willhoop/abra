#!/usr/bin/env node
/* tests/probe_residual_faint_flush.js — `fieldEvent('Residual')` PAYS THE FAINT QUEUE AFTER EVERY
 * HANDLER, AND A SURVIVING PERISH COUNTER IS ONE OF THEM.
 *   node tests/probe_residual_faint_flush.js      node tests/probe_residual_faint_flush.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY, READ NOT RECALLED. `Battle#fieldEvent` (sim/battle.ts:484-568):
 *
 *     if (eventid === 'Residual' && handler.end && handler.state?.duration) {
 *       handler.state.duration--;
 *       if (!handler.state.duration) {
 *         handler.end.call(...endCallArgs);      // perishsong.condition.onEnd -> perish0 + faint()
 *         if (this.ended) return;
 *         continue;                              // <- SKIPS the faintMessages() below
 *       }
 *     }
 *     ...
 *     if (handler.callback) this.singleEvent(handlerEventid, ...);   // perish3/2/1 line
 *     this.faintMessages();                                          // sim/battle.ts:565
 *
 * So a body whose Perish Song counter REACHES ZERO queues a `|faint|` that nothing announces, and the
 * NEXT handler to reach the bottom of that loop pays it. A body whose counter SURVIVES takes the
 * callback branch — it prints `perishN` and then pays the queue, INSIDE the same order-24 group.
 *
 * THIS ENGINE ALREADY MODELS THE OTHER TWO HALVES OF THE RULE AND NOT THIS ONE. `RESIDUAL_AFTER_PERISH`
 * (medicham2-browser.js) derives every handler that sorts BELOW perishsong@24.2 and drains above
 * `|upkeep|` when one of them will run — its own header records the authority measurement,
 * *"bare reads `perish0 x4 | upkeep | faint x4`; the same board with a Protect, with a Tailwind, or
 * with a Pickup body on it reads `perish0 x4 | faint x4 | upkeep`"*. It excludes `r === perish`, so a
 * SURVIVING perish counter — a handler at the same order, in the same group — pays nothing. And the
 * drain it does run is at the FOOT of the walk, which cannot put a `|faint|` BETWEEN two `perishN`
 * lines.
 *
 * TWO GAMES OF THE PINNED POOL ARE EXACTLY THOSE TWO SHAPES, both `ordering`, both narration-only:
 *   `...bo3-2661861148`  |faint|p1a <> |upkeep     — two perish0 bodies then an Incineroar at perish2
 *   `...bo3-2658309440`  |faint|p2b <> |-start|p1b|perish0
 *                                                  — a Gengar expires, an Excadrill at perish1 pays
 *                                                    for it, and two more expire after
 *
 * ================= THE FIXTURE, AND WHY IT IS FOUR TURNS =========================================
 *
 * A Perish Song hits every active body at once, so a single cast expires all four together and there
 * is no surviving handler to pay anything. The counters are DESYNCHRONISED instead: one body leaves
 * on turn 2 (which clears its volatile), a REPLACEMENT walks in with none, and the same Politoed
 * casts again on turn 3 — `onHitField` skips a body that already carries the volatile
 * (data/moves.ts:13254), so only the replacement is given a fresh counter.
 *
 * Turn 4's residual therefore holds THREE expiring counters and ONE surviving one, and the whole of
 * the arm is WHERE the survivor sits in the speed order:
 *
 *   RED-LAST   the survivor is the SLOWEST body — it pays all three faints, above `|upkeep|`
 *   RED-MID    the survivor sits BETWEEN expiries — it pays the one above it, and the two BELOW it
 *              are still owed at `|upkeep|`. Nothing that drains at the foot of the walk can produce
 *              that sequence, and a fix that simply moved the whole drain above the upkeep line
 *              passes RED-LAST and fails here.
 *   CTRL-NONE  the OVER-FIRE control, and it is the authority measurement `RESIDUAL_AFTER_PERISH`'s
 *              own header already records: no switch, no second cast, so all FOUR counters expire
 *              together, NOTHING survives to pay the queue, and both engines must read
 *              `perish0 x4 | upkeep | faint x4`.
 *
 * The two RED arms are ONE script and ONE pair of teams; only the bench body that walks in on turn 2
 * changes, and its position in the speed order is ASSERTED off the authority's own log rather than
 * assumed from base stats. CTRL-NONE keeps the same bodies and drops two script cells.
 *
 * RED FIRST: `MEDI_RESIDUAL_FAINT_AT_GROUP_END=1` restores the engine that could not pay inside the
 * group, and any run carrying it also carries a non-zero
 * `MEDFAILS.residualFaintAtGroupEndRestored` — set only when a surviving perish handler actually met
 * an owed faint, because a restore nothing could observe is not a restore.
 *
 * WHAT THIS DOES NOT TOUCH, SAID PLAINLY. `drainFaints` emits lines and writes no state — every
 * `queueFaint` has already set `curHP`, `fainted` and the faint sequence — so nothing here can move a
 * board. And the rule is reproduced for the PERISH group only: an ordinary chip that kills at order 9
 * is announced by this engine at the foot of the walk rather than under its own `-damage` line, which
 * is a second gap with a second fixture and is left named rather than folded in.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_RESIDUAL_FAINT_AT_GROUP_END = '1';
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

/*  [species, item, ability, moves]  — every body carries a STAT move only, so nothing in the fixture
 *  deals damage, nothing changes Speed and no `stall` volatile is left standing to become a follower
 *  of its own. */
const SONG  = ['politoed',  '', 'Damp',        ['Perish Song', 'Amnesia']];
const SLOW1 = ['primarina', '', 'Torrent',     ['Calm Mind']];
const FOE   = ['gengar',    '', 'Cursed Body', ['Nasty Plot']];
const LEAVE = ['sinistcha', '', 'Heatproof',   ['Calm Mind']];
const P1BENCH = [['clefable', '', 'Cute Charm', ['Calm Mind']],
                 ['tinkaton', '', 'Own Tempo',  ['Swords Dance']]];
const P2BENCH = [['clefable', '', 'Cute Charm', ['Calm Mind']]];

/* THE THREE REPLACEMENTS, AND THE ONLY THING THAT SEPARATES THE ARMS IS WHERE EACH LANDS IN THE
 * SPEED ORDER — which is READ OFF THE AUTHORITY'S LOG below, never inferred from a base stat. The
 * first cut of this file picked its three off base Speed and got two of them wrong: `buildMon`'s
 * spread is not neutral, so a base-120 Alakazam sorts BELOW a base-110 Gengar and a base-65 Umbreon
 * below a base-60 Primarina. The staging claim is what caught it.
 *
 * One ability each, none of them carrying a residual handler of any kind —
 * asserted below rather than assumed, because a Speed Boost or a Harvest on this body would be a
 * `RESIDUAL_AFTER_PERISH` follower and would pay the queue for a completely different reason. */
const FRESH = {
  'RED-MID':    ['alakazam', '', 'Synchronize', ['Calm Mind']],
  'RED-LAST':   ['snorlax',  '', 'Immunity',    ['Amnesia']],
  'CTRL-NONE':  ['alakazam', '', 'Synchronize', ['Calm Mind']],   /* never reached: it does not switch in */
};

const CASES = [
  { id: 'RED-LAST', wantSurvivorAt: 3, desync: true,
    name: 'RED-LAST   the surviving counter is the SLOWEST body — it pays all three faints',
    what: 'Three perish0 expiries queue a |faint| each and announce none of them; the Snorlax at '
        + 'perish2 is the next handler to reach sim/battle.ts:565 and pays all three, above |upkeep|.',
    redFaintsBelowUpkeep: true },
  { id: 'RED-MID', wantSurvivorAt: 1, desync: true,
    name: 'RED-MID    the survivor sits BETWEEN two expiries — a foot-of-walk drain cannot do this',
    what: 'ONE body expires, the Alakazam at perish2 pays for that one, and the two BELOW it expire '
        + 'afterwards and are still owed at |upkeep|. The first |faint| is INTERLEAVED with the '
        + 'perish0 lines, which no drain at the end of the walk can produce — and the other two are '
        + 'still below the upkeep line, which is what a fix that simply moved the drain would break.',
    redFaintsBelowUpkeep: true },
  { id: 'CTRL-NONE', wantSurvivorAt: -1, desync: false,
    name: 'CTRL-NONE  NOTHING survives — the over-fire control, on the authority\'s own baseline',
    what: 'The same four bodies with the turn-2 switch and the turn-3 re-cast dropped, so every '
        + 'counter expires on the same residual and no handler is left to reach '
        + 'sim/battle.ts:565. `perish0 x4 | upkeep | faint x4` on BOTH engines, before and after. '
        + 'An engine that drains unconditionally at the end of the walk passes both REDs and fails here.',
    redFaintsBelowUpkeep: false },
];

/* ---- LEGALITY ------------------------------------------------------------------------------------ */
let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
const ROWS = [SONG, SLOW1, FOE, LEAVE].concat(P1BENCH, P2BENCH, Object.values(FRESH));
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
  const ps = dex.moves.get('perishsong');
  if (ps.target !== 'all') bad('Perish Song now targets ' + ps.target + ', so it no longer hits every active body');
  if (!ps.condition || ps.condition.duration !== 4) bad('Perish Song\'s counter is no longer 4 turns long');
  if (typeof ps.condition.onEnd !== 'function') bad('Perish Song no longer faints on its onEnd, so nothing queues');
  if (ps.condition.onResidualOrder !== 24) bad('Perish Song is no longer onResidualOrder 24');
  /* NOTHING IN THE FIXTURE MAY BE A `RESIDUAL_AFTER_PERISH` FOLLOWER, or the queue is paid for a
   * reason this probe is not about. Asked of the ABILITY of every body that is on the field at the
   * turn-4 residual, and of the ITEM slot, which is empty on all of them. */
  for (const row of [SONG, SLOW1, FOE].concat(Object.values(FRESH))) {
    const ab = dex.abilities.get(row[2]);
    if (ab.onResidual !== undefined || ab.onResidualOrder !== undefined)
      bad(ab.name + ' carries a residual handler and would pay the faint queue on its own');
    if (row[1]) bad(row[0] + ' is holding an item; Leftovers and friends are residual handlers');
  }
  /* AND NO IDLE MOVE MAY TOUCH SPEED, because the speed order IS the arm. */
  for (const row of ROWS) for (const mv of row[3]) {
    const b = dex.moves.get(mv).boosts || (dex.moves.get(mv).self && dex.moves.get(mv).self.boosts);
    if (b && b.spe) bad(mv + ' moves a Speed stage, which would re-order the residual walk');
  }
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
/* THE THREE LINE KINDS THIS FILE IS ABOUT AND NOTHING ELSE. Reading the whole log would make every
 * arm fail on an unrelated narration change; reading only the `|faint|` lines would lose the
 * ORDERING, which is the whole finding. */
const SEQ = lines => {
  const out = [];
  for (const l of lines) {
    let m = /^\|-start\|(p[12][ab])[^|]*\|perish(\d)/.exec(String(l));
    if (m) { out.push('perish:' + m[1] + ':' + m[2]); continue; }
    m = /^\|faint\|(p[12][ab])/.exec(String(l));
    if (m) { out.push('faint:' + m[1]); continue; }
    if (/^\|upkeep/.test(String(l))) { out.push('upkeep'); continue; }
  }
  return out;
};
/* TURN 4's RESIDUAL AND NOTHING BEFORE IT. Turns 1-3 each end in their own `perishN` lines and their
 * own `|upkeep|`, and none of them holds a faint. */
const turn4 = lines => {
  const k = lines.map(String).lastIndexOf('|turn|4');
  return k < 0 ? lines : lines.slice(k);
};

const SCRIPT = [
  /* T1  the song. Every active body takes a counter with duration 4. */
  { p1: [{ m: 'perishsong' }, { m: 'calmmind' }], p2: [{ m: 'nastyplot' }, { m: 'calmmind' }] },
  /* T2  p2b LEAVES, which clears its volatile, and the replacement arrives carrying none. */
  { p1: [{ m: 'amnesia' }, { m: 'calmmind' }], p2: [{ m: 'nastyplot' }, { sw: null }] },
  /* T3  the SECOND cast. onHitField skips the three bodies that already carry a counter, so only the
   *     replacement is given one — and it is given a FRESH duration 4. */
  { p1: [{ m: 'perishsong' }, { m: 'calmmind' }], p2: [{ m: 'nastyplot' }, { m: null }] },
  /* T4  everybody idles. Three counters hit zero and the replacement's does not. */
  { p1: [{ m: 'amnesia' }, { m: 'calmmind' }], p2: [{ m: 'nastyplot' }, { m: null }] },
];

console.log((RED ? 'RED ARM — MEDI_RESIDUAL_FAINT_AT_GROUP_END=1 (the in-group drain removed)'
                 : 'CLEAN ARM') + NL);

for (const c of CASES) {
  const fresh = FRESH[c.id];
  const a = G.buildPair(stage([SONG, SLOW1]).concat(stage(P1BENCH)));
  const b = G.buildPair(stage([FOE, LEAVE]).concat(stage([fresh]), stage(P2BENCH)));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  /* THE ONLY CELLS THAT DIFFER BETWEEN THE ARMS: the turn-2 switch that desynchronises the counters,
   * the turn-3 re-cast that gives the replacement a fresh one, and the replacement's own idle click.
   * CTRL-NONE drops the first two, so the p2b body never leaves and every counter expires together. */
  const script = SCRIPT.map((t, ti) => ({
    p1: c.desync ? t.p1 : t.p1.map(x => (x && x.m === 'perishsong' && ti > 0) ? { m: SONG[3][1] } : x),
    p2: t.p2.map(x => !x ? x
      : x.sw === null ? (c.desync ? { sw: fresh[0] } : { m: LEAVE[3][0] })
      : x.m === null ? { m: c.desync ? fresh[3][0] : LEAVE[3][0] } : x) }));
  const step0 = SEEN.faintDrainResidualBodyStep | 0;
  const r = G.playGame(a, b, 'directed', 'probe_residual_faint_flush :: ' + c.id, { script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdS = SEQ(turn4(unsplit(G.lastSdLog()))), meS = SEQ(turn4(r.mediTrace || []));
  const stepN = (SEEN.faintDrainResidualBodyStep | 0) - step0;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  ' + JSON.stringify(sdS));
  console.log('    medicham  ' + JSON.stringify(meS));

  /* ---- STAGING. A fixture that did not produce three expiries and one survivor, with the survivor
   *      at the intended place in the SPEED order, is not this arm and its result means nothing. */
  const perish = sdS.filter(x => x.startsWith('perish:'));
  const zeros = perish.filter(x => x.endsWith(':0'));
  const survivors = perish.filter(x => !x.endsWith(':0'));
  const upkeepAt = sdS.indexOf('upkeep');
  const wantZeros = c.desync ? 3 : 4, wantSurv = c.desync ? 1 : 0;
  claim(zeros.length === wantZeros && survivors.length === wantSurv,
    c.id + ' STAGED — ' + wantZeros + ' counters expired and ' + wantSurv + ' survived',
    'perish lines ' + JSON.stringify(perish));
  claim(!c.desync || (survivors.length === 1 && perish.indexOf(survivors[0]) === c.wantSurvivorAt),
    c.id + ' STAGED — the survivor is at index ' + c.wantSurvivorAt + ' of the speed order',
    'perish lines ' + JSON.stringify(perish));
  claim(sdS.filter(x => x.startsWith('faint:')).length === wantZeros && upkeepAt >= 0,
    c.id + ' STAGED — ' + wantZeros + ' faints and an |upkeep| in the authority\'s turn-4 residual',
    JSON.stringify(sdS));

  /* ---- THE AUTHORITY'S ANSWER, read rather than typed: are the faints above or below |upkeep|? */
  const below = seq => {
    const u = seq.indexOf('upkeep');
    const f = seq.map((x, i) => x.startsWith('faint:') ? i : -1).filter(i => i >= 0);
    return u < 0 || !f.length ? null : f.every(i => i > u);
  };
  const sdBelow = below(sdS), meBelow = below(meS);
  console.log('    faints below |upkeep|?   showdown ' + sdBelow + '   medicham ' + meBelow);
  claim(sdBelow === !c.desync,
    c.id + ' — THE AUTHORITY puts ' + (c.desync ? 'at least one faint ABOVE' : 'EVERY faint BELOW') + ' |upkeep|',
    'showdown ' + JSON.stringify(sdS));

  /* ---- THE OUTCOME. The whole turn-4 sequence, not a classification of it. */
  if (!RED) {
    claim(JSON.stringify(meS) === JSON.stringify(sdS),
      c.id + ' — this engine writes the authority\'s sequence line for line',
      'medicham ' + JSON.stringify(meS));
    claim(c.desync ? stepN > 0 : stepN === 0,
      c.id + ' — the in-group drain ' + (c.desync ? 'FIRED, so the fixture is not vacuous'
                                                  : 'did NOT fire — nothing survived to pay the queue'),
      'faintDrainResidualBodyStep +' + stepN);
  } else if (c.redFaintsBelowUpkeep) {
    claim(meBelow === true,
      c.id + ' — [--red: the defect restored] EVERY |faint| is pushed BELOW |upkeep|',
      'medicham ' + JSON.stringify(meS));
    claim(JSON.stringify(meS) !== JSON.stringify(sdS),
      c.id + ' — [--red] the two streams part, so the knob reached the rule',
      'medicham ' + JSON.stringify(meS));
  } else {
    claim(JSON.stringify(meS) === JSON.stringify(sdS),
      c.id + ' — [--red: control, must HOLD] the knob moves nothing here',
      'medicham ' + JSON.stringify(meS));
  }
}

if (RED) {
  claim((FAILS.residualFaintAtGroupEndRestored | 0) > 0,
    'the RED arm STAMPED a failure counter — a switch that silently makes the engine wrong is the '
      + 'silent default this repository keeps paying for',
    'MEDFAILS.residualFaintAtGroupEndRestored = ' + (FAILS.residualFaintAtGroupEndRestored | 0));
} else {
  claim((FAILS.residualFaintAtGroupEndRestored | 0) === 0,
    'the CLEAN arm carries NO restore stamp', String(FAILS.residualFaintAtGroupEndRestored | 0));
}

console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
