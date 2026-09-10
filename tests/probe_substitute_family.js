/* probe_substitute_family.js — A SUBSTITUTE IS ABSORBED AT STEP 0 OF `spreadMoveHit`, OVER EVERY TARGET,
 * BEFORE STEP 1 WRITES ANY OTHER TARGET'S EFFECTIVENESS LINE AND BEFORE STEP 2 MOVES ANY HP. THIS ENGINE
 * ABSORBED IT INSIDE STEP 2. 2026-09-10, narration batch Z.
 *
 *   SHOWDOWN_PATH=... node tests/probe_substitute_family.js
 *   SHOWDOWN_PATH=... node tests/probe_substitute_family.js --release 7d66b526659e      (the PRE-FIX bytes: red arms PART clean)
 *   SHOWDOWN_PATH=... node tests/probe_substitute_family.js --only spread-doll-at-index-1-body-resists-at-index-0
 *
 * ================= THE FOUR CARDS =================================================================
 *
 * `data/game-differential.json`, release `7d66b526659e`, 961 games on the pinned pool — four of the ten
 * NARRATION-ONLY causes, every one a SINGLE-ARRIVAL SPREAD MOVE with a doll on one of its rows:
 *
 *     omit-protect      …2655715488  t5   Garchomp Earthquake  [spread] p2a,p1a,p1b      |-end|p2a: Dragapult|Substitute      <> |-resisted|p1b: Sinistcha|1
 *     pair-protect-bust …2653957635  t10  Tyranitar Rock Slide [spread] p1a,p1b          |-end|p1b: Klefki|Substitute         <> |-damage|p1a: Meowstic|0 fnt
 *     pair-protect-bust …2654266369  t9   Sinistcha Matcha Gotcha [spread] p2a,p2b       |-activate|p2b: Overqwil|…|[damage]  <> |-damage|p2a: Froslass|42/145
 *     pair-speedctrl    …2654408616  t2   Tyranitar Rock Slide [spread] p1a,p1b          |-end|p1b: Sinistcha|Substitute      <> |-resisted|p1a: Orthworm|1
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED ========================================
 *
 * Champions overrides `spreadMoveHit` (data/mods/champions/scripts.ts:315-427) and does not override
 * `substitute` (`grep 'substitute:' data/mods/champions/moves.ts` -> 0). Within ONE arrival the steps are
 * walked over EVERY target before the next step begins:
 *
 *     scripts.ts:343-347   // 0. check for substitute   -> tryPrimaryHitEvent(damage, targets, ...)
 *     scripts.ts:351-354   if (damage[i] === HIT_SUBSTITUTE) { damage[i] = true; targets[i] = null; }
 *     scripts.ts:360-361   // 1. call to this.battle.getDamage  -> getSpreadDamage(...)      (`-supereffective`/`-resisted`/`-crit`, scripts.ts:271/278/285)
 *     scripts.ts:367-368   // 2. call to this.battle.spreadDamage                            (`-damage`)
 *     scripts.ts:385-388   // 4. self drops   // 5. secondaries
 *
 * and the doll's handler (data/moves.ts:18335-18365, `substitute.condition.onTryPrimaryHit`) runs ITS OWN
 * `getDamage` — so the doll row's effectiveness and crit lines are STEP 0 lines, written before any other
 * row's step 1 line — then clamps, then writes `-activate|…|[damage]` or removes the volatile (`-end`),
 * then pays that arrival's recoil and drain. A doll therefore precedes every other target's effectiveness
 * line and every other target's `-damage`, whichever row it stands on.
 *
 * ================= WHAT THIS ENGINE DID ============================================================
 *
 * `_stepDamage` (step 1: price + the single-packet row's effectiveness line) ran over every row, and the
 * doll was absorbed inside `_stepApply` (step 2). So a body row's `-resisted` and even its `-damage` were
 * written above the doll row's `-end`. Five batches diagnosed this; batch X planned a loop-nesting change
 * (make the arrival loop the outer loop over the whole segment). THAT PLAN IS NOT NEEDED, and the reason is
 * derived on every run below: NO LEGAL MOVE IN THIS FORMAT IS BOTH MULTI-HIT AND MULTI-TARGET, and Parental
 * Bond refuses `move.spreadHit` — so "arrival-major across rows" has no observable instance here. What is
 * needed is a STEP-0 step that owns EVERY doll arrival: `_stepSubAbsorb`, walked between `_stepDamage` and
 * the new `_stepPriceLines` (which now carries the step-1 lines `_stepDamage` used to write inline).
 *
 * ================= THE KNOB ========================================================================
 *
 * `MEDI_SUB_ABSORB_AT_APPLY=1` puts the absorb back at the head of `_stepApply` and the step-1 lines back
 * inline in `_stepDamage` — the pre-batch order exactly — and stamps `MEDFAILS.subAbsorbAtApplyRestored`.
 * A RED arm agrees clean and PARTS under the knob; a CONTROL agrees under both. A build that has no such
 * stamp is PRE-FIX BYTES: the red arms must PART CLEAN there, and the knob assertions are not asked.
 *
 * ================= NOTHING HERE IS TYPED ===========================================================
 *
 * No arm declares an expected order. Both engines play the same script under the differential's `middle`
 * pin and the pass is that the two protocol streams do not part. SHOWDOWN IS THE EXPECTATION. Every
 * species, move and ability is checked legal and on-learnset from `Dex.forFormat` below.
 *
 * ================= THE ARMS ========================================================================
 *
 * `spread-doll-at-index-1-body-resists-at-index-0`   cards 2/3/4: Dazzling Gleam into Toxapex (resists, row 0)
 *     and a Dragapult doll (row 1). Authority: doll's `-supereffective`, `-activate`/`-end`, THEN `-resisted|p2a`.
 * `spread-doll-at-index-0-body-resists-at-index-1`   the same pair with the rows swapped — the doll is FIRST in
 *     row order and this engine STILL parts, because the separation is step-major, not row order.
 * `spread-doll-on-the-attackers-own-ally`             card 1: Garchomp Earthquake with its own Dragapult ally behind
 *     a doll; the foe at row 0 resists. The ally's row is the LAST target, and its `-end` still comes first.
 * `spread-with-a-secondary-doll-at-index-1`           Bulldoze (100, allAdjacent, 100% Speed drop): the doll row takes
 *     no secondary, every damaged row takes one AFTER every `-damage`, and the doll still leads the stream.
 * `volley-into-a-doll-supereffective`                 THE LATENT HALF, not in the four: Twin Beam into a Sneasler doll.
 *     Each doll ARRIVAL owns a `-supereffective` line (step 0's own getDamage). This engine wrote none of them
 *     on a volley — `_stepDamage` emits only for a single-packet row and the doll loop emitted only its own line.
 * `spread-no-doll-control`                            the first arm with the Dragapult clicking Agility instead.
 * `volley-through-a-broken-doll-control`              batch V's shape, neutral type: unmoved by this batch's knob.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_substitute_family.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_SUB_ABSORB_AT_APPLY';
const STAMP = 'subAbsorbAtApplyRestored';

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));

/* ---- THE FIXTURES. Items are empty; abilities are inert for these clicks. --------------------- */
const CLEFABLE  = ['clefable',  '', 'Unaware',    ['Dazzling Gleam', 'Calm Mind', 'Protect']];
const GARCHOMP  = ['garchomp',  '', 'Rough Skin', ['Earthquake', 'Bulldoze', 'Swords Dance', 'Protect']];
const FARIGIRAF = ['farigiraf', '', null,         ['Twin Beam', 'Protect']];          /* ability derived below */
const DRAGAPULT = ['dragapult', '', 'Clear Body', ['Substitute', 'Agility', 'Protect']];
const TOXAPEX   = ['toxapex',   '', 'Limber',     ['Iron Defense', 'Protect']];
const SINISTCHA = ['sinistcha', '', 'Heatproof',  ['Calm Mind', 'Protect']];
const SNEASLER  = ['sneasler',  '', 'Pressure',   ['Substitute', 'Agility', 'Protect']];
const SNORLAX   = ['snorlax',   '', 'Thick Fat',  ['Amnesia', 'Protect']];
const CORVIKNIGHT = ['corviknight', '', 'Pressure', ['Iron Defense', 'Protect']];
const MILOTIC   = ['milotic',   '', 'Marvel Scale', ['Coil', 'Protect']];
const FROSLASS  = ['froslass',  '', 'Snow Cloak', ['Double Team', 'Protect']];

const GLEAM = { m: 'dazzlinggleam' }, EQ = { m: 'earthquake' }, BULLDOZE = { m: 'bulldoze' };
const TWINBEAM0 = { m: 'twinbeam', t: 0 };
const SUB = { m: 'substitute' }, AGILITY = { m: 'agility' }, IRONDEF = { m: 'irondefense' };
const CALMMIND = { m: 'calmmind' }, AMNESIA = { m: 'amnesia' }, COIL = { m: 'coil' }, SD = { m: 'swordsdance' };

const oneTurn = (p1, p2) => [{ p1, p2 }];

const CASES = [
  { id: 'spread-doll-at-index-1-body-resists-at-index-0', kind: 'red',
    a: [CLEFABLE, CORVIKNIGHT, MILOTIC, SNORLAX], b: [TOXAPEX, DRAGAPULT, FROSLASS, SNORLAX],
    script: oneTurn([GLEAM, IRONDEF], [IRONDEF, SUB]), dollClean: 1,
    what: 'THE CARDS\' SHAPE. Dazzling Gleam into a Toxapex that RESISTS at row 0 and a Dragapult doll at row 1. '
        + 'The authority writes the doll row\'s own `-supereffective` and its `-activate`/`-end` at step 0, and only '
        + 'then Toxapex\'s `-resisted` (step 1) and `-damage` (step 2). This engine wrote `-resisted|p2a` first.' },

  { id: 'spread-doll-at-index-0-body-resists-at-index-1', kind: 'red',
    a: [CLEFABLE, CORVIKNIGHT, MILOTIC, SNORLAX], b: [DRAGAPULT, TOXAPEX, FROSLASS, SNORLAX],
    script: oneTurn([GLEAM, IRONDEF], [SUB, IRONDEF]), dollClean: 1,
    what: 'THE ROWS SWAPPED. The doll is FIRST in row order and the streams still part on the pre-fix bytes, '
        + 'because the separation the authority has is between STEPS, not between rows: `-resisted|p2b` (step 1) '
        + 'may not precede `-activate|p2a` (step 0) whatever the row order.' },

  { id: 'spread-doll-on-the-attackers-own-ally', kind: 'red',
    a: [GARCHOMP, DRAGAPULT, MILOTIC, SNORLAX], b: [SINISTCHA, SNORLAX, FROSLASS, CORVIKNIGHT],
    script: oneTurn([EQ, SUB], [CALMMIND, AMNESIA]), dollClean: 1,
    what: 'CARD 1. Garchomp\'s Earthquake clips its own Dragapult, which is behind a doll; Sinistcha at foe row 0 '
        + 'resists Ground. The ally is the LAST target in the authority\'s list and its `-end` still leads the '
        + 'stream, above `-resisted|p2a`.' },

  { id: 'spread-with-a-secondary-doll-at-index-1', kind: 'red',
    a: [GARCHOMP, TOXAPEX, MILOTIC, SNORLAX], b: [SINISTCHA, DRAGAPULT, FROSLASS, CORVIKNIGHT],
    script: oneTurn([BULLDOZE, IRONDEF], [CALMMIND, SUB]), dollClean: 1,
    what: 'A 100% SECONDARY BESIDE THE DOLL. Bulldoze drops Speed on every body it damaged (step 5) and on the '
        + 'doll row nothing; the doll\'s lines lead, every `-damage` follows, every `-unboost` follows those.' },

  { id: 'volley-into-a-doll-supereffective', kind: 'red',
    a: [FARIGIRAF, CORVIKNIGHT, MILOTIC, SNORLAX], b: [SNEASLER, TOXAPEX, FROSLASS, SNORLAX],
    script: oneTurn([TWINBEAM0, IRONDEF], [SUB, IRONDEF]), dollClean: 1, volleyLines: true,
    what: 'THE LATENT HALF. Twin Beam x2 into a Fighting/Poison doll: the authority runs `getDamage` inside '
        + '`onTryPrimaryHit` for EVERY doll arrival, so each one writes `-supereffective|p2a` above its own '
        + '`-activate`/`-end`. This engine wrote no effectiveness line for any doll arrival of a volley.' },

  { id: 'spread-no-doll-control', kind: 'control',
    a: [CLEFABLE, CORVIKNIGHT, MILOTIC, SNORLAX], b: [TOXAPEX, DRAGAPULT, FROSLASS, SNORLAX],
    script: oneTurn([GLEAM, IRONDEF], [IRONDEF, AGILITY]), dollClean: 0,
    what: 'THE KNOB CLEARED EXPLICITLY. The first arm with the Dragapult clicking Agility: no doll on the field, '
        + 'so the new step has nothing to absorb and nothing may move under the knob.' },

  { id: 'volley-through-a-broken-doll-control', kind: 'control',
    a: [FARIGIRAF, CORVIKNIGHT, MILOTIC, SNORLAX], b: [DRAGAPULT, TOXAPEX, FROSLASS, SNORLAX],
    script: oneTurn([TWINBEAM0, IRONDEF], [SUB, IRONDEF]), dollClean: 1,
    what: 'BATCH V\'S SHAPE, NEUTRAL TYPE. A volley into a doll on a single row: at one row the step-major and '
        + 'the row-major walks are the same permutation, so the absorb site moving may not move the stream.' },
];

/* ---- LEGALITY, DERIVED. Nothing above is trusted from a list. ---------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.dexFor(CS.FORMAT);
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
FARIGIRAF[2] = Object.values(dex.species.get('farigiraf').abilities)[0];
let illegal = 0;
const seen = new Set();
for (const c of CASES) for (const row of c.a.concat(c.b)) {
  const key = row[0] + '|' + row[1] + '|' + row[3].join(',');
  if (seen.has(key)) continue; seen.add(key);
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
  if (row[1] && !legal(dex.items.get(row[1]))) { console.log('ILLEGAL FIXTURE  ' + row[1] + ' is not in this format'); illegal++; }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id).includes(dex.abilities.get(row[2]).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row[2]); illegal++;
  }
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row[0], mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE PREMISES, DERIVED ON EVERY RUN --------------------------------------------------------- */
{
  const fs = require('fs'), SP = process.env.SHOWDOWN_PATH;
  const bad = [];
  const scripts = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'scripts.ts'), 'utf8');
  const movesTs = fs.readFileSync(path.join(SP, 'data', 'moves.ts'), 'utf8');
  const modMoves = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const abilTs = fs.readFileSync(path.join(SP, 'data', 'abilities.ts'), 'utf8');
  const step0 = scripts.indexOf('// 0. check for substitute'), step1 = scripts.indexOf('// 1. call to this.battle.getDamage'),
        step2 = scripts.indexOf('// 2. call to this.battle.spreadDamage');
  const subHandler = movesTs.slice(movesTs.indexOf('onTryPrimaryHit(target, source, move) {', movesTs.indexOf('substitute: {')));
  const subGetDamage = /let damage = this\.actions\.getDamage\(source, target, move\);[\s\S]{0,900}?this\.add\('-activate', target, 'move: Substitute', '\[damage\]'\)/.test(subHandler);
  const multiSpread = dex.moves.all().filter(legal).filter(m => (m.multihit || m.multiaccuracy) && /^all/.test(m.target)).map(m => m.id);
  const bondRefusesSpread = /parentalbond:[\s\S]{0,600}?move\.spreadHit[\s\S]{0,80}?return;/.test(abilTs);
  const gleam = dex.moves.get('dazzlinggleam'), eq = dex.moves.get('earthquake'), bull = dex.moves.get('bulldoze'), tb = dex.moves.get('twinbeam');
  console.log('spreadMoveHit numbers its steps 0 < 1 < 2: ' + (step0 > 0 && step0 < step1 && step1 < step2)
    + '   substitute.onTryPrimaryHit runs its own getDamage above `-activate`: ' + subGetDamage
    + '   Champions overrides substitute: ' + /^\s*substitute:\s*\{/m.test(modMoves));
  console.log('legal moves that are multi-hit AND multi-target: ' + JSON.stringify(multiSpread)
    + '   parentalbond refuses move.spreadHit: ' + bondRefusesSpread);
  console.log('dazzlinggleam ' + gleam.accuracy + '/' + gleam.target + ' sec ' + JSON.stringify(gleam.secondary || null)
    + '   earthquake ' + eq.accuracy + '/' + eq.target + '   bulldoze ' + bull.accuracy + '/' + bull.target + ' sec ' + JSON.stringify(bull.secondary || null)
    + '   twinbeam ' + tb.accuracy + '/' + tb.target + ' x' + JSON.stringify(tb.multihit));
  console.log('type chart: Fairy->Toxapex ' + dex.getEffectiveness('Fairy', dex.species.get('toxapex')) + ', Fairy->Dragapult ' + dex.getEffectiveness('Fairy', dex.species.get('dragapult'))
    + ', Ground->Sinistcha ' + dex.getEffectiveness('Ground', dex.species.get('sinistcha')) + ', Psychic->Sneasler ' + dex.getEffectiveness('Psychic', dex.species.get('sneasler'))
    + ', Psychic->Dragapult ' + dex.getEffectiveness('Psychic', dex.species.get('dragapult')));
  const spe = s => dex.species.get(s).baseStats.spe;
  console.log('base Speed: dragapult ' + spe('dragapult') + ' sneasler ' + spe('sneasler') + ' > clefable ' + spe('clefable') + ' garchomp ' + spe('garchomp') + ' farigiraf ' + spe('farigiraf') + '  (the doll goes up before the click)');
  if (!(step0 > 0 && step0 < step1 && step1 < step2)) bad.push('spreadMoveHit no longer numbers substitute / getDamage / spreadDamage as 0 < 1 < 2');
  if (!subGetDamage) bad.push('substitute.onTryPrimaryHit no longer runs getDamage above its own line');
  if (multiSpread.length) bad.push('a legal move is now multi-hit AND multi-target (' + multiSpread.join(',') + ') — the loop-nesting question is live again');
  if (!bondRefusesSpread) bad.push('Parental Bond no longer refuses spreadHit');
  if (gleam.accuracy !== 100 || gleam.target !== 'allAdjacentFoes' || gleam.secondary) bad.push('Dazzling Gleam is no longer a 100-accuracy foes-only spread move without a secondary');
  if (eq.accuracy !== 100 || eq.target !== 'allAdjacent') bad.push('Earthquake is no longer a 100-accuracy allAdjacent move');
  if (bull.accuracy !== 100 || bull.target !== 'allAdjacent' || !(bull.secondary && bull.secondary.chance === 100)) bad.push('Bulldoze is no longer a 100-accuracy allAdjacent move with a certain secondary');
  if (tb.accuracy !== 100 || tb.multihit !== 2 || tb.target !== 'normal') bad.push('Twin Beam is no longer a certain two-hit single-target move');
  if (!(dex.getEffectiveness('Fairy', dex.species.get('toxapex')) < 0)) bad.push('Toxapex no longer resists Fairy');
  if (!(dex.getEffectiveness('Ground', dex.species.get('sinistcha')) < 0)) bad.push('Sinistcha no longer resists Ground');
  if (!(dex.getEffectiveness('Psychic', dex.species.get('sneasler')) > 0)) bad.push('Sneasler is no longer weak to Psychic');
  if (dex.getEffectiveness('Psychic', dex.species.get('dragapult')) !== 0) bad.push('Dragapult is no longer neutral to Psychic (the volley control needs no effectiveness line)');
  if (!(spe('dragapult') > spe('clefable') && spe('dragapult') > spe('garchomp') && spe('sneasler') > spe('farigiraf'))) bad.push('the doll holder is no longer faster than the attacker');
  if (bad.length) { console.log(NL + 'NOT RUN — ' + bad.join('; ') + '. This is not a pass.'); process.exit(2); }
}

/* ---- THE RUN ------------------------------------------------------------------------------------ */
function play(G, c) {
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.a)), b = G.buildPair(stage(c.b));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_substitute_family :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  const MF = globalThis.MEDFAILS || {};
  return { r, delta, sc: G.scriptCounters(), stampPresent: Object.prototype.hasOwnProperty.call(MF, STAMP),
           restored: MF[STAMP] || 0 };
}

let bad = 0, ran = 0, prefix = false;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  if (!clean.stampPresent) prefix = true;                 /* the loaded build predates the knob: PRE-FIX BYTES */
  const brk = prefix ? null : play(harness(true), c);
  harness(false);
  ran++;

  const short = clean.r.turns < c.script.length;
  const refused = clean.sc.moveNotOnRequest;
  const R = { c, clean, brk, short, refused,
    doll: clean.delta.subAbsorbAtStepZero || 0, dollK: brk ? (brk.delta.subAbsorbAtStepZero || 0) : null,
    volley: clean.delta.subVolleyDollArrivalLines || 0 };
  results.push(R);

  if (short || refused) { bad++; R.fails = ['FIXTURE — the script did not play out on the clean load']; continue; }
  const fails = [];
  if (prefix) {
    /* THE PRE-FIX BYTES: the whole claim is that every red arm PARTS and every control AGREES. */
    if (c.kind === 'red' && !clean.r.div) fails.push('PRE-FIX bytes and the red arm did not part — the card is not staged');
    if (c.kind === 'control' && clean.r.div) fails.push('PRE-FIX bytes and a control parts');
  } else {
    if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
    if (R.doll !== c.dollClean && !(c.dollClean === 1 && R.doll >= 1)) fails.push('subAbsorbAtStepZero clean is ' + R.doll + ', declared ' + c.dollClean);
    if (R.dollK !== 0) fails.push('subAbsorbAtStepZero under the knob is ' + R.dollK + ' — the knob did not move the absorb back');
    if (c.volleyLines && !(R.volley >= 1)) fails.push('subVolleyDollArrivalLines clean is ' + R.volley + ' — no doll arrival wrote its own line');
    if (clean.r.div) fails.push('the engines part on the CLEAN load');
    if (c.kind === 'red' && !brk.r.div) fails.push('the knob did not move the outcome — this arm proves nothing');
    if (c.kind === 'control' && brk.r.div) fails.push('OVER-FIRE — a control moved under the knob');
  }
  if (fails.length) bad += 1;
  R.fails = fails;
}

for (const R of results) {
  const { c, clean, brk } = R;
  const verdict = R.short ? 'SHORT        ' : R.refused ? 'CLICK REFUSED'
    : (R.fails && R.fails.length) ? 'FAIL         '
      : prefix ? (c.kind === 'red' ? 'RED ON PRE-FIX' : 'CONTROL HELD ')
      : c.kind === 'red' ? 'RED PROVEN   ' : 'CONTROL HELD ';
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    streams        clean ' + (clean.r.div ? 'PART at reduced line ' + clean.r.div.index : 'AGREE')
    + (brk ? '   |   knob ' + (brk.r.div ? 'PART at reduced line ' + brk.r.div.index : 'AGREE') : '   |   (pre-fix bytes: no knob)'));
  console.log('    counters       subAbsorbAtStepZero ' + R.doll + ' clean' + (brk ? ', ' + R.dollK + ' knob' : '')
    + '   subVolleyDollArrivalLines ' + R.volley + (c.volleyLines ? ' (>=1 wanted)' : ''));
  if (brk) console.log('    MEDFAILS stamp clean ' + clean.restored + '   knob ' + brk.restored);
  const d = clean.r.div || (brk && brk.r.div);
  if (d) {
    console.log('    ' + (clean.r.div ? 'CLEAN' : 'KNOB') + ' parted:');
    console.log('      showdown  ' + d.sdRaw);
    console.log('      medicham  ' + d.meRaw);
    console.log('      showdown next  ' + JSON.stringify((d.sdAfterRaw || []).slice(0, 6)));
    console.log('      medicham next  ' + JSON.stringify((d.meAfterRaw || []).slice(0, 6)));
  }
  for (const f of (R.fails || [])) console.log('    >> FAIL: ' + f);
}

console.log(NL + ran + ' arms staged, ' + bad + ' failing   [release ' + REL_ID + (prefix ? ', PRE-FIX BYTES — the knob is absent on this build' : '') + ']');
console.log(bad ? 'FAIL' : ONLY ? 'PASS for the arm(s) named by --only. THIS IS NOT THE FILE’S VERDICT.'
  : prefix ? 'RED — every red arm parts on the pre-fix bytes and every control agrees (this is the BEFORE picture, not a pass)'
  : 'PASS — a doll is absorbed at step 0 over every row before any row\'s step-1 line, every doll arrival of a volley '
  + 'writes its own effectiveness line, the knob puts every red arm apart again, and both controls hold');
process.exit(bad ? (prefix ? 1 : 1) : (prefix ? 1 : 0));
