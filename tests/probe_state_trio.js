#!/usr/bin/env node
/* tests/probe_state_trio.js — THREE BOARD-MATERIAL LEAVES, STAGED ONE AT A TIME
 * ==================================================================================================
 *   node tests/probe_state_trio.js
 *
 * DIAGNOSTIC ONLY. This file changes nothing and fixes nothing. It stages the three small state
 * reads that `data/game-differential.json`'s `state.first_board_divergences` reports on the pinned
 * pool and prints, per arm, what each engine holds and why.
 *
 *   A  p1.active[0].vol.confusion   medicham 2   showdown 5
 *   B  p2.party.diggersby.status    medicham par showdown ""
 *   C  p1.party.meowscarada.types   medicham ice showdown dark/grass
 *
 * THEY ARE NOT ONE DEFECT AND THIS FILE DOES NOT ASSUME THEY ARE. Each arm carries its own control,
 * and a control here means a fixture that reaches the SAME mechanic through a different door — not a
 * second copy of the arm.
 *
 * EVERY SPECIES, ABILITY AND MOVE BELOW IS CHECKED AGAINST THE FORMAT BEFORE THE RUN, and the file
 * refuses to run on an illegal one rather than reporting a green arm that never staged.
 * ================================================================================================ */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
/* `STATE = has('--state')` is read at game_differential's MODULE LOAD, and without it `boundaries`
 * comes back 0 and every arm reports "boards IDENTICAL" having compared nothing at all. That is the
 * silent default this file exists to avoid, so it is set before the require rather than asked for on
 * the command line. */
if (!process.argv.includes('--state')) process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
const M = REL.require('engine/medicham2-browser.js');
const SDP = process.env.SHOWDOWN_PATH;
const BA = require(SDP + '/dist/sim/battle-actions');
const BattleActions = BA.BattleActions || BA.default || BA;
const BM = require(SDP + '/dist/sim/battle');
const Battle = BM.Battle || BM.default || BM;
const NL = String.fromCharCode(10);

const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

/* ---- THE AUTHORITY'S DRAW LOG. Same construction as tests/probe_spread_secondary_address.js: the
 * CATEGORY comes from which BattleActions method is executing, because the arguments cannot tell an
 * accuracy roll from a secondary. `PRNG#sample` does not pass through `Battle#random`, so it needs
 * its own hook — that is the draw Dire Claw's three-way pick spends. */
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
const addr = (cat, ctx, note) => {
  const mv = ctx && ctx.activeMove, tg = ctx && ctx.activeTarget;
  const base = [ctx ? ctx.turn : 0, cat, mv ? mv.id : '-', (tg && tg.side) ? (tg.side.id + tg.position) : '-'].join('|');
  const n = NTH.get(base) || 0; NTH.set(base, n + 1);
  LOG.push(base + '|' + n + (note ? '  <' + note + '>' : ''));
};
const oR = Battle.prototype.random, oC = Battle.prototype.randomChance, oS = Battle.prototype.sample;
Battle.prototype.random = function (m, n) {
  addr((SD_CAT === 'dmg' && n !== undefined) ? 'crit' : SD_CAT, this,
       n !== undefined ? ('RANGE ' + m + '..' + (n - 1)) : null);
  return oR.call(this, m, n); };
Battle.prototype.randomChance = function (a, b) { addr((SD_CAT === 'dmg') ? 'crit' : SD_CAT, this); return oC.call(this, a, b); };
Battle.prototype.sample = function (it) { addr(SD_CAT, this, 'sample'); return oS.call(this, it); };

/* ---- THE FIXTURES -------------------------------------------------------------------------------
 * A  GOLURK carries BOTH doors onto the same mechanic — Dynamic Punch (a 100% SECONDARY) and Confuse
 *    Ray (a STATUS move) — and No Guard removes the accuracy roll so neither arm can end in a miss.
 * B  the pinned pool's own bodies: Sneasler's Dire Claw into Diggersby.
 * C  Meowscarada + Protean + an Ice move, the pool's own set minus the Choice item. */
const GOLURK = ['golurk', '', 'No Guard', ['Dynamic Punch', 'Confuse Ray', 'Protect']];
const CORV   = ['corviknight', '', 'Pressure', ['Iron Defense', 'Protect']];
const ID = { m: 'irondefense' }, SD = { m: 'swordsdance' };
const CLEF   = ['clefable', '', 'Unaware', ['Protect']];
const CHOMP  = ['garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect', 'Earthquake']];

const SNEAS  = ['sneasler', '', 'Unburden', ['Dire Claw', 'Protect', 'Swords Dance']];
const DIGG   = ['diggersby', '', 'Huge Power', ['Protect', 'Earthquake', 'Swords Dance']];

const MEOW   = ['meowscarada', '', 'Protean', ['Triple Axel', 'Knock Off', 'Protect', 'U-turn']];
const SNOR   = ['snorlax', '', 'Thick Fat', ['Protect']];

const PROT = { m: 'protect' };
const CASES = [
  { id: 'A', name: 'A-arm      confusion from a SECONDARY (Dynamic Punch, 100%)',
    what: 'The duration lives in `confusion.onStart` as `this.random(min, 6)` (data/conditions.ts:174). '
        + 'A secondary applies it inside `BattleActions#secondaries`, so the middle arm sees category '
        + '`sec` — and its range-form pin only fires on `any`.',
    A: [GOLURK, CLEF], B: [CORV, CHOMP],
    script: [{ p1: [{ m: 'dynamicpunch', t: 0 }, PROT], p2: [ID, SD] }],
    watch: 'vol.confusion' },
  /* THE TURN SWEEP. medicham2's duration is the CONSTANT `CONFUSION_TURNS_MIN`; the authority's is a
   * live draw whose value is a hash of (turn, category, move, target). Clicking the same move on a
   * different turn is the varied knob: if medicham2 were drawing too, its value would move with the
   * authority's. Identical output across a varied knob is the finding — here in reverse, and it is
   * why one turn is not enough to see this at all (turn 1 happens to give 2 on both sides). */
  { id: 'A', name: 'A-arm t2   the same secondary, one turn later',
    what: 'Protect on turn 1, Dynamic Punch on turn 2. Only the ADDRESS moves.',
    A: [GOLURK, CLEF], B: [CORV, CHOMP],
    script: [{ p1: [PROT, PROT], p2: [ID, SD] },
             { p1: [{ m: 'dynamicpunch', t: 0 }, PROT], p2: [ID, SD] }],
    watch: 'vol.confusion' },
  { id: 'A', name: 'A-arm t3   the same secondary, two turns later',
    what: 'Protect twice, Dynamic Punch on turn 3.',
    A: [GOLURK, CLEF], B: [CORV, CHOMP],
    script: [{ p1: [PROT, PROT], p2: [ID, SD] },
             { p1: [PROT, PROT], p2: [ID, SD] },
             { p1: [{ m: 'dynamicpunch', t: 0 }, PROT], p2: [ID, SD] }],
    watch: 'vol.confusion' },
  { id: 'A', name: 'A-arm t4   the same secondary, three turns later',
    what: 'Protect three times, Dynamic Punch on turn 4.',
    A: [GOLURK, CLEF], B: [CORV, CHOMP],
    script: [{ p1: [PROT, PROT], p2: [ID, SD] },
             { p1: [PROT, PROT], p2: [ID, SD] },
             { p1: [PROT, PROT], p2: [ID, SD] },
             { p1: [{ m: 'dynamicpunch', t: 0 }, PROT], p2: [ID, SD] }],
    watch: 'vol.confusion' },
  { id: 'A', name: 'A-control  confusion from a STATUS MOVE (Confuse Ray) — same body, other door',
    what: 'Identical mechanic, identical duration draw, but applied outside all three wrapped methods '
        + 'so the category is `any` and the range form IS pinned to its bottom. If this arm parts too, '
        + 'the finding is not about the category.',
    A: [GOLURK, CLEF], B: [CORV, CHOMP],
    script: [{ p1: [{ m: 'confuseray', t: 0 }, PROT], p2: [ID, SD] }],
    watch: 'vol.confusion' },

  { id: 'B', name: 'B-arm      Dire Claw — how many `sec` draws does each engine take',
    what: 'The authority draws the 30% chance in `secondaries` and, only if it passes, the three-way '
        + 'pick inside the `onHit` that call made. medicham2 has TWO handlers for the one secondary: '
        + 'the generic `fx.secondary` loop and the `proceduralStatus` tag block.',
    A: [SNEAS, CLEF], B: [DIGG, CHOMP],
    script: [{ p1: [{ m: 'direclaw', t: 0 }, PROT], p2: [SD, SD] }],
    watch: 'status' },
  { id: 'B', name: 'B-control  Earthquake — a move with no secondary at all',
    what: 'The same two bodies, the same turn, a click that takes no `sec` draw on either side. It '
        + 'pins that the counts below are Dire Claw\'s and not a standing offset.',
    A: [SNEAS, CLEF], B: [DIGG, CHOMP],
    script: [{ p1: [SD, PROT], p2: [{ m: 'earthquake' }, SD] }],
    watch: 'status' },

  { id: 'C', name: 'C-arm      Protean, then a SWITCH OUT',
    what: 'Triple Axel makes Meowscarada pure Ice. `Pokemon#clearVolatile()` ends with '
        + '`this.setSpecies(this.baseSpecies)`, so the authority is Dark/Grass again the instant the '
        + 'body leaves. medicham2 clears `_proteanUsed` on the way out and never restores `types`.',
    A: [MEOW, CLEF], B: [CORV, CHOMP], bench: ['snorlax', 'incineroar'],
    script: [{ p1: [{ m: 'tripleaxel', t: 0 }, PROT], p2: [ID, SD] },
             { p1: [{ sw: 'snorlax' }, PROT],          p2: [ID, SD] }],
    watch: 'types' },
  { id: 'C', name: 'C-faint    Protean, then the body FAINTS',
    what: 'The authority calls `pokemon.clearVolatile(false)` in `Battle#faintMessages`, and '
        + '`clearVolatile` ends with `setSpecies(baseSpecies)` — so a fainted body reads its BASE '
        + 'types. A faint does not go through medicham2 `switchOut`, which is where its type '
        + 'restore lives. This arm asks whether the missing revert is on the FAINT path.',
    A: [MEOW, CLEF], B: [CORV, CHOMP], bench: ['snorlax', 'incineroar'],
    script: [{ p1: [{ m: 'tripleaxel', t: 0 }, PROT], p2: [ID, SD] },
             /* NOT Protect. The first version of this arm shielded Meowscarada on both later turns,
              * the Earthquake never reached it, and the arm reported IDENTICAL having staged nothing
              * — the exact green-that-proves-nothing this file warns about. Knock Off is Dark, and
              * Protean is once per switch-in, so the body stays Ice while it stands exposed. */
             { p1: [{ m: 'knockoff', t: 0 }, PROT],    p2: [ID, SD] },
             { p1: [{ m: 'knockoff', t: 0 }, PROT],    p2: [ID, { m: 'earthquake' }] },
             { p1: [PROT, PROT],                      p2: [ID, SD] }],
    watch: 'types' },
  { id: 'C', name: 'C-uturn    Protean, then a SELF-SWITCH (U-turn)',
    what: 'U-turn pivots the user out. If the pivot does not run the same `switchOut` the voluntary '
        + 'switch runs, the converted typing rides onto the bench.',
    A: [MEOW, CLEF], B: [CORV, CHOMP], bench: ['snorlax', 'incineroar'],
    script: [{ p1: [{ m: 'uturn', t: 0 }, PROT], p2: [ID, SD] },
             { p1: [PROT, PROT],                 p2: [ID, SD] }],
    watch: 'types' },
  { id: 'C', name: 'C-control  Protean and the body STAYS IN',
    what: 'Same conversion, no switch. Both engines must hold pure Ice. This is what separates "the '
        + 'revert is missing" from "the conversion is wrong".',
    A: [MEOW, CLEF], B: [CORV, CHOMP], bench: ['snorlax', 'incineroar'],
    script: [{ p1: [{ m: 'tripleaxel', t: 0 }, PROT], p2: [ID, SD] },
             { p1: [PROT, PROT],                      p2: [ID, SD] }],
    watch: 'types' },
];

/* ---- LEGALITY, DERIVED FROM THE FORMAT ----------------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0]); illegal++; continue; }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' has no ' + row[2]); illegal++; }
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' not in this format'); illegal++; continue; }
    if (!learns(row[0], mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- HOW MANY REASONS DOES THE B CELL QUALIFY FOR? -----------------------------------------------
 * A body may refuse a status by ability, by type, by an already-held status or by a field condition.
 * A fixture that qualifies for two reasons proves nothing, so the count is DERIVED and printed. */
{
  const dg = dex.species.get('diggersby');
  const reasons = [];
  const par = dex.conditions.get('par');
  for (const a of Object.values(dg.abilities)) {
    const ab = dex.abilities.get(a);
    if (ab.onSetStatus || ab.onTryAddVolatile || ab.onImmunity) reasons.push('ability ' + ab.name);
  }
  if (dg.types.includes('Electric')) reasons.push('type Electric');
  console.log('B fixture — how many things could refuse `par` on ' + dg.name + ' ('
    + dg.types.join('/') + ', ability ' + DIGG[2] + '): '
    + (reasons.length ? reasons.join(' + ') : 'NONE')
    + '   [no Safeguard, no Misty Terrain, no prior status in the script]'
    + (par.exists ? '' : '   (par condition missing?!)'));
}

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
const short = s => String(s).split('|').slice(1).join('|');

for (const c of CASES) {
  NTH = new Map(); LOG = [];
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A).concat(BENCH(...(c.bench || ['milotic', 'incineroar']))));
  const b = G.buildPair(stage(c.B).concat(BENCH('snorlax', 'toxapex')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name); continue; }
  const r = G.playGame(a, b, 'directed', 'probe_state_trio :: ' + c.name, { script: c.script, arm: ARM });
  console.log(NL + '=================================================================');
  console.log(c.name);
  console.log('    ' + c.what);
  if (r.err) { console.log('    THREW  ' + r.err); continue; }
  const sc = G.scriptCounters();
  /* A SCRIPTED CLICK THAT IS NOT ON THE REQUEST FALLS THROUGH TO `pass` ON BOTH SIDES, and both
   * engines then agree about a turn in which nothing happened. That is a green arm proving nothing,
   * so it is printed first and loudly. */
  if (sc.moveNotOnRequest) console.log('    *** ' + sc.moveNotOnRequest + ' scripted click(s) NOT ON THE REQUEST — first: ' + sc.firstMissing);
  console.log('    end reason: ' + r.endReason);
  const me = M.midEventLog();
  console.log('    turns played: ' + r.turns + '   boundaries: ' + r.boundaries
              + '   agreed: ' + r.boundariesAgreed);
  console.log('    showdown draws  ' + (LOG.join('   ') || '(none)'));
  console.log('    medicham draws  ' + (me.map(short).join('   ') || '(none)'));
  console.log('    sec draws:  showdown ' + LOG.filter(x => x.split('|')[1] === 'sec').length
              + '   medicham ' + me.filter(x => x.split('|')[2] === 'sec').length);
  if (r.stateDiv) {
    console.log('    BOARD PARTED at turn ' + r.stateDiv.turn);
    for (const d of (r.stateDiv.diffs || [])) console.log('        ' + d.path + '   medicham ' + JSON.stringify(d.medicham) + '   showdown ' + JSON.stringify(d.showdown));
  } else {
    console.log('    boards IDENTICAL at every boundary');
  }
  if (r.div) console.log('    protocol parted: ' + r.div.cause);
  if (process.argv.includes('--trace')) {
    console.log('    --- medicham trace ---');
    for (const l of r.mediTrace) console.log('      ' + l);
  }
}

/* ---- THE ENGINE'S OWN RECEIPTS ------------------------------------------------------------------- */
const S = M.MEDSEEN, F = M.MEDFAILS;
console.log(NL + '=================================================================');
console.log('medicham2 counters over the whole file');
for (const k of ['confusionSet', 'confusionMinDuration', 'confusionExpired', 'confusionSelfHit',
                 'proceduralStatusApplied', 'proteanConverted', 'roostTypeRestored'])
  if (S[k] !== undefined) console.log('   MEDSEEN.' + k + ' = ' + S[k]);
console.log('   MEDFAILS.confusionMistyUnmodelled = ' + (F.confusionMistyUnmodelled || 0));
const RC = G.midRangeCounters ? G.midRangeCounters() : null;
if (RC) console.log('   range form: pinned ' + RC.pinned + '   live ' + RC.live + '   knob ' + RC.knob);
console.log(NL + 'DIAGNOSTIC — no pass/fail verdict is asserted here.');

/* ==================================================================================================
 * --replay — THE THREE ACTUAL POOL GAMES, ONE AT A TIME
 * ==================================================================================================
 * The staged arms above isolate a MECHANISM. This replays the three games the artifact names, from
 * the FROZEN pool (`data/team-pool-frozen`), so the mechanism can be checked against the leaf the
 * differential actually reported. The middle arm's addresses are a pure function of
 * (MID_SEED, turn, category, move, target slot) and MID_SEED is a module constant, so one pair
 * replayed alone reproduces the same game the driver played — PROVIDED the engine bytes have not
 * moved since. They may have; a replay that does not reproduce is reported as such and is not a
 * refutation of anything.
 *
 * The store records which SIDE of each battle a team came from and the artifact's `seed` tag does
 * not, so all four side combinations are played and the one that reproduces is named.
 * ================================================================================================ */
if (process.argv.includes('--replay')) {
  const fs = require('fs');
  const POOL = D('data', 'team-pool-frozen', 'games.bo3.jsonl');
  const WANT = [
    { id: 'A', tag: 'confusion', a: '2654113586', b: '2654066472', leaf: /vol\.confusion/ },
    { id: 'B', tag: 'diggersby status', a: '2662482898', b: '2662443716', leaf: /status/ },
    { id: 'C', tag: 'meowscarada types', a: '2657831051', b: '2657785829', leaf: /types/ },
  ];
  const sheets = new Map();
  for (const line of fs.readFileSync(POOL, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const hit = WANT.find(w => line.indexOf(w.a) >= 0 || line.indexOf(w.b) >= 0);
    if (!hit) continue;
    const g = JSON.parse(line);
    if (g.sheets) sheets.set(String(g.id).split('-').pop(), g.sheets);
  }
  console.log(NL + '=================================================================');
  console.log('--replay — the three pool games, all four side combinations each');
  for (const w of WANT) {
    const SA = sheets.get(w.a), SB = sheets.get(w.b);
    if (!SA || !SB) { console.log(NL + w.id + '  ' + w.tag + '   SHEETS NOT IN THE FROZEN POOL — not run'); continue; }
    console.log(NL + w.id + '  ' + w.tag + '   ' + w.a + ' vs ' + w.b);
    for (const sa of ['p1', 'p2']) for (const sb of ['p1', 'p2']) for (const strip of [false, true]) {
      const a = G.buildPair(SA[sa], strip ? { stripStones: true } : undefined);
      const b = G.buildPair(SB[sb], strip ? { stripStones: true } : undefined);
      if (!a || !b) { console.log('    ' + sa + ' vs ' + sb + '   PAIR WOULD NOT BUILD'); continue; }
      const r = G.playGame(a, b, 'baseline', w.a + '/' + sa + ' vs ' + w.b + '/' + sb + (strip ? ' [stones removed]' : ''), { arm: ARM });
      if (r.err) { console.log('    ' + sa + ' vs ' + sb + '   THREW ' + r.err); continue; }
      const d = r.stateDiv;
      console.log('    ' + sa + ' vs ' + sb + (strip ? ' [nostones]' : ' [stones]  ') + '   turns ' + r.turns + '   boundaries ' + r.boundaries
        + '   first board part: ' + (d ? ('turn ' + d.turn) : 'never')
        + (d ? '   ' + d.diffs.map(x => x.path + ' [' + JSON.stringify(x.medicham) + ' vs ' + JSON.stringify(x.showdown) + ']').join('  ') : ''));
      if (d && d.diffs.some(x => w.leaf.test(x.path))) {
        console.log('        *** REPRODUCED the artifact leaf. medicham trace around the part:');
        const marks = r.mediTrace.map((l, i) => [l, i]).filter(([l]) => /^\|turn\|/.test(String(l)));
        const from = (marks.find(([l]) => l === '|turn|' + Math.max(1, d.turn - 1)) || [null, 0])[1];
        for (const l of r.mediTrace.slice(from, from + 60)) console.log('          ' + l);
      }
    }
  }
}
