/* probe_damaginghit_walk.js — (batch Q2's `probe_damaginghit_order.js` owns the STEP the event runs at; this
 * file owns the WALK ORDER within it.) ONE `DamagingHit` EVENT ON A SPREAD HIT RUNS IN THE AUTHORITY'S SORT ORDER:
 * EVERY `onDamagingHitOrder: 1` HANDLER IN TARGET-INDEX ORDER, THEN EVERY UNDECLARED-ORDER HANDLER IN
 * TARGET-INDEX ORDER. THIS ENGINE WALKED IT STEP-MAJOR — EVERY TARGET'S PUNISH, THEN EVERY TARGET'S BUFF.
 * 2026-09-09, narration batch Y.
 *
 *   SHOWDOWN_PATH=... node tests/probe_damaginghit_walk.js
 *   SHOWDOWN_PATH=... node tests/probe_damaginghit_walk.js --release <id> --only stamina-at-index-0-spicyspray-at-index-1
 *
 * ================= THE CARD =====================================================================
 *
 * `data/game-differential.json`, release `b0f5c159c46e`, 961 games on the pinned pool:
 *
 *     ordering :: |-boost|p1a|def|1 <> |-status|p2b|brn|[from]spicyspray
 *
 * and the game itself (`baseline`, seed …bo3-2634643227 vs …2635701832, turn 2): a Milotic's Muddy Water
 * into an Archaludon (Stamina, target index 0) and a Scovillain-Mega (Spicy Spray, target index 1).
 *
 *     showdown   |-boost|p1a: Archaludon|def|1          |-status|p2b: Milotic|brn|[from] ability: Spicy Spray|[of] p1b: Scovillain
 *     medicham2  |-status|p2b: Milotic|brn|[from] …     |-boost|p1a: Archaludon|def|1|[from] ability: stamina
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 * `spreadMoveHit` raises ONE `runEvent('DamagingHit', damagedTargets, pokemon, move)`. `findEventHandlers`
 * over an ARRAY (sim/battle.ts:1035-1047) collects each target's handlers with `handler.index = i` — per
 * body: status, volatiles, ability, item (`findPokemonEventHandlers`) — and, because `DamagingHit` is in
 * the list at sim/battle.ts:788, sorts them ONCE by `Battle.compareLeftToRightOrder` (:421):
 *
 *     -((b.order || 4294967296) - (a.order || 4294967296)) || ((b.priority || 0) - (a.priority || 0)) || -((b.index || 0) - (a.index || 0))
 *
 * `onDamagingHitOrder` ASC with an undeclared order LAST, then priority DESC, then TARGET INDEX ASC.
 * Deterministic: no speed, no die. Stamina and Spicy Spray both leave `order` undeclared, so on the card
 * the index decides — Archaludon (0) before Scovillain (1). Electromorphosis declares `onDamagingHitOrder:
 * 1` (data/abilities.ts:1179), so it runs before EVERY undeclared handler regardless of index.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * The step driver is step-outer / row-inner and the event was FOUR steps — [every row's punish], [every
 * row's thaw], [every row's buff], [every row's late pair] — so a buff on row 0 landed BELOW a punish on
 * row 1. The engine's own `_stepBuffOnHit` header said the authority's list was "`speedSort`ed together"
 * and deferred the fix on a dice argument; both are false and are corrected in place. `punishesAttacker`
 * and `buffsHolderOnHit` now carry `order` (tag_dex.js, read off `onDamagingHitOrder`), and the event is
 * two steps: `_stepDamagingHitEarly` (order 1, index-major) then `_stepDamagingHitBody` (the rest,
 * index-major, status -> ability -> late pair within a body).
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected order. Both engines play the same script under the differential's `middle`
 * pin and the pass is that the two protocol streams do not part. SHOWDOWN IS THE EXPECTATION.
 * `MEDI_DH_STEPS_SPLIT=1` is the revert knob and restores the four-step layout exactly, so a RED arm
 * agrees clean and PARTS under the knob, and a CONTROL agrees under both.
 *
 * ================= THE ARMS =====================================================================
 *
 * `stamina-at-index-0-spicyspray-at-index-1`   THE CARD: two undeclared-order handlers, index decides.
 *     Scovillain must be MEGA to carry Spicy Spray (the only legal carrier is Scovillain-Mega — derived),
 *     so it asks `mega: true` on the turn and the harness's `scriptMegaRefused` is asserted at 0.
 * `stamina-at-index-0-electromorphosis-at-index-1`   THE ORDER-1 HALF: Electromorphosis at the HIGHER
 *     index runs FIRST because it declares order 1. Index-major alone gets this wrong; the tag's `order`
 *     is what gets it right.
 * `stamina-alone-beside-an-inert-reactor`   THE KNOB CLEARED EXPLICITLY: the same spread hit into a
 *     Stamina body beside a Rough Skin body that is never touched (no contact), so ONE handler fires and
 *     every walk order is the same permutation. Nothing may move.
 *
 * DICE: the attacker's spread move is a printed 100 with no secondary (Dazzling Gleam -- the card's Muddy
 * Water is 85 and its second arrival MISSED on both engines under the pin, which is why it is not used
 * here). Spicy Spray's burn has no chance (`trySetStatus` unconditionally; the Clefable is not Fire and
 * is unstatused).
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
  REL_ID = ER.cut('tests/probe_damaginghit_walk.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_DH_STEPS_SPLIT';

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
const ID = { m: 'irondefense' };
const SD = { m: 'swordsdance' };
const REFLECT = { m: 'reflect' };
const GROWTH_MEGA = { m: 'growth', mega: true };
const GLEAM = { m: 'dazzlinggleam' };

/* THE ATTACKER CLICKS A 100-ACCURACY SPREAD MOVE. The first draft used the card's own Muddy Water (85) and
 * the second arrival MISSED on both engines under the pin, so no second reactor ever fired and every arm
 * agreed on both loads for a reason that had nothing to do with the walk. Dazzling Gleam: 100, foes only,
 * no contact, no secondary -- derived below, not assumed. */
const CLEFABLE = ['clefable', '', 'Unaware', ['Dazzling Gleam', 'Calm Mind', 'Protect']];
const A_TAIL = [['corviknight', '', 'Pressure', ['Iron Defense', 'Protect']],
                ['milotic', '', 'Marvel Scale', ['Protect', 'Coil']],
                ['toxapex', '', 'Regenerator', ['Protect']]];
const ARCHALUDON = ['archaludon', '', 'Stamina', ['Iron Defense', 'Protect']];
const SCOVILLAIN = ['scovillain', 'Scovillainite', 'Chlorophyll', ['Growth', 'Protect']];
const BELLIBOLT = ['bellibolt', '', 'Electromorphosis', ['Reflect', 'Protect']];
const GARCHOMP = ['garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']];
const B_TAIL = [['froslass', '', 'Snow Cloak', ['Protect']],
                ['snorlax', '', 'Thick Fat', ['Curse', 'Protect']]];

const oneTurn = (p2a, p2b) => [{ p1: [GLEAM, ID], p2: [p2a, p2b] }];

const CASES = [
  { id: 'stamina-at-index-0-spicyspray-at-index-1', kind: 'red',
    a: [CLEFABLE].concat(A_TAIL), b: [ARCHALUDON, SCOVILLAIN].concat(B_TAIL), script: oneTurn(ID, GROWTH_MEGA),
    earlyClean: 0, earlyKnob: 0, megaAsk: true,
    what: 'THE CARD, REBUILT. A spread hit into a Stamina body at index 0 and a Spicy Spray body at index 1; '
        + 'both undeclared-order, so the authority runs the index-0 boost before the index-1 burn. This '
        + 'engine paid every punish before any buff.' },

  { id: 'stamina-at-index-0-electromorphosis-at-index-1', kind: 'red',
    a: [CLEFABLE].concat(A_TAIL), b: [ARCHALUDON, BELLIBOLT].concat(B_TAIL), script: oneTurn(ID, REFLECT),
    earlyClean: 1, earlyKnob: 0, megaAsk: false,
    what: 'THE ORDER-1 HALF. Electromorphosis declares `onDamagingHitOrder: 1` and stands at the HIGHER '
        + 'index; the authority runs it FIRST. A walk that is merely index-major gets this wrong — the tag\'s '
        + '`order` is what places it.' },

  { id: 'stamina-alone-beside-an-inert-reactor', kind: 'control',
    a: [CLEFABLE].concat(A_TAIL), b: [ARCHALUDON, GARCHOMP].concat(B_TAIL), script: oneTurn(ID, SD),
    /* `earlyClean: 1`, NOT 0: Rough Skin declares order 1, so its handler IS collected and runs in the early pass
     * -- and then does nothing, because the move makes no contact. That is the authority's shape too (the handler
     * runs and its own `checkMoveMakesContact` refuses). Declared 0 in the first draft and MEASURED at 1; the
     * counter counts handlers RUN early, not tolls paid, and the probe was wrong before the engine was. */
    earlyClean: 1, earlyKnob: 0, megaAsk: false,
    what: 'THE KNOB CLEARED EXPLICITLY. The same spread hit, one live handler (Rough Skin needs contact and '
        + 'is never touched): every walk order is the same permutation and nothing may move.' },
];

/* ---- LEGALITY, DERIVED. ------------------------------------------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.dexFor(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
/* ROADMAP #565 — THE LEGALITY GATE ASKS THE VALIDATOR, NOT THE RAW ROWS. The prevo walk this line
 * replaced accepted any entry on the species or on a prevo whatever its SOURCE tag, so a move a prevo
 * learned by a gen-7 TM (`7M`, `7V`) read as legal here while `TeamValidator` refused it — which is how
 * illegal fixtures passed their own gates (tests/test-fixture-legality.js, batch 2).
 * `champions_sim.canLearn` IS `checkCanLearn`, cached per pair. */
const learns = (sp, mv) => CS.canLearn(sp, mv);
let illegal = 0;
const seen = new Set();
for (const c of CASES) for (const row of c.a.concat(c.b)) {
  const key = row[0] + '|' + row[1] + '|' + row[3].join(',');
  if (seen.has(key)) continue; seen.add(key);
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
  if (row[1] && !legal(dex.items.get(row[1]))) { console.log('ILLEGAL FIXTURE  ' + row[1] + ' is not in this format'); illegal++; }
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
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE PREMISES, DERIVED ON EVERY RUN -------------------------------------------------------- */
{
  const fs = require('fs'), SP = process.env.SHOWDOWN_PATH;
  const bad = [];
  const battleTs = fs.readFileSync(path.join(SP, 'sim', 'battle.ts'), 'utf8');
  const sortLine = /\['Invulnerability', 'TryHit', 'DamagingHit', 'EntryHazard'\]\.includes\(eventid\)/.test(battleTs)
    && /handlers\.sort\(Battle\.compareLeftToRightOrder\)/.test(battleTs);
  const cmp = /static compareLeftToRightOrder[\s\S]*?-\(\(b\.order \|\| 4294967296\) - \(a\.order \|\| 4294967296\)\) \|\|[\s\S]*?\(\(b\.priority \|\| 0\) - \(a\.priority \|\| 0\)\) \|\|[\s\S]*?-\(\(b\.index \|\| 0\) - \(a\.index \|\| 0\)\)/.test(battleTs);
  const ordOf = id => dex.abilities.get(id).onDamagingHitOrder;
  const smega = dex.species.get('scovillainmega');
  const stone = dex.items.get('scovillainite');
  const carriers = ab => dex.species.all().filter(legal).filter(s => Object.values(s.abilities).includes(ab)).map(s => s.name);
  console.log('DamagingHit sorts by compareLeftToRightOrder: ' + sortLine + '   comparator is (order, priority, index): ' + cmp);
  console.log('onDamagingHitOrder: stamina ' + JSON.stringify(ordOf('stamina')) + ', spicyspray ' + JSON.stringify(ordOf('spicyspray'))
    + ', electromorphosis ' + JSON.stringify(ordOf('electromorphosis')) + ', roughskin ' + JSON.stringify(ordOf('roughskin')));
  console.log('Spicy Spray carriers: ' + carriers('Spicy Spray').join(', ') + '   Electromorphosis carriers: ' + carriers('Electromorphosis').join(', '));
  console.log('scovillainite.megaStone ' + JSON.stringify(stone.megaStone) + '   Scovillain-Mega abilities ' + JSON.stringify(smega.abilities));
  const gleam = dex.moves.get('dazzlinggleam');
  console.log('dazzlinggleam: target ' + gleam.target + ', accuracy ' + gleam.accuracy + ', contact ' + !!gleam.flags.contact
    + ', secondaries ' + JSON.stringify(gleam.secondaries || gleam.secondary || null));
  if (!sortLine) bad.push('DamagingHit is no longer sorted by compareLeftToRightOrder');
  if (!cmp) bad.push('compareLeftToRightOrder no longer reads (order, priority, index)');
  if (ordOf('stamina') != null || ordOf('spicyspray') != null) bad.push('Stamina or Spicy Spray now declares an onDamagingHitOrder');
  if (ordOf('electromorphosis') !== 1) bad.push('Electromorphosis no longer declares onDamagingHitOrder 1');
  if (!(stone.megaStone && stone.megaStone['Scovillain'])) bad.push('Scovillainite no longer megas a Scovillain');
  if (!Object.values(smega.abilities).includes('Spicy Spray')) bad.push('Scovillain-Mega no longer carries Spicy Spray');
  if (gleam.flags.contact) bad.push('Dazzling Gleam makes contact now, so the control\'s Rough Skin is live');
  if (gleam.accuracy !== 100 || gleam.target !== 'allAdjacentFoes') bad.push('Dazzling Gleam is no longer a 100-accuracy foes-only spread move');
  if (bad.length) { console.log(NL + 'NOT RUN — ' + bad.join('; ') + '. This is not a pass.'); process.exit(2); }
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.a)), b = G.buildPair(stage(c.b));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_damaginghit_order :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).dhStepsSplitRestored || 0 };
}

let bad = 0, ran = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;

  const short = clean.r.turns < c.script.length;
  const refused = clean.sc.moveNotOnRequest;
  const megaRefused = (clean.sc.scriptMegaRefused || 0) + (brk.sc.scriptMegaRefused || 0);
  const R = { c, clean, brk, short, refused, megaRefused,
    early: clean.delta.dhOrder1Early || 0, earlyK: brk.delta.dhOrder1Early || 0,
    buff: clean.delta.buffOnHitAfterSecondaries || 0 };
  results.push(R);

  if (short || refused) { bad++; R.fails = ['FIXTURE — the script did not play out on the clean load']; continue; }
  const fails = [];
  if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
  if (c.megaAsk && megaRefused) fails.push('the mega ask was refused ' + megaRefused + ' time(s) — Spicy Spray was never on the field');
  if (R.early !== c.earlyClean) fails.push('dhOrder1Early clean is ' + R.early + ', declared ' + c.earlyClean);
  if (R.earlyK !== c.earlyKnob) fails.push('dhOrder1Early knob is ' + R.earlyK + ', declared ' + c.earlyKnob);
  if (clean.r.div) fails.push('the engines part on the CLEAN load');
  if (c.kind === 'red' && !brk.r.div) fails.push('the knob did not move the outcome — this arm proves nothing');
  if (c.kind === 'control' && brk.r.div) fails.push('OVER-FIRE — a control moved under the knob');
  if (fails.length) bad += 1;
  R.fails = fails;
}

for (const R of results) {
  const { c, clean, brk } = R;
  const verdict = R.short ? 'SHORT        ' : R.refused ? 'CLICK REFUSED'
    : (R.fails && R.fails.length) ? 'FAIL         '
      : c.kind === 'red' ? 'RED PROVEN   ' : 'CONTROL HELD ';
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    streams        clean ' + (clean.r.div ? 'PART at reduced line ' + clean.r.div.index : 'AGREE')
    + '   |   knob ' + (brk.r.div ? 'PART at reduced line ' + brk.r.div.index : 'AGREE'));
  console.log('    counters       dhOrder1Early ' + R.early + '/' + c.earlyClean + ' clean, ' + R.earlyK + '/' + c.earlyKnob
    + ' knob   |   mega asks refused ' + R.megaRefused);
  console.log('    MEDFAILS stamp clean ' + clean.restored + '   knob ' + brk.restored);
  const d = clean.r.div || brk.r.div;
  if (d) {
    console.log('    ' + (clean.r.div ? 'CLEAN' : 'KNOB') + ' parted:');
    console.log('      showdown  ' + d.sdRaw);
    console.log('      medicham  ' + d.meRaw);
  }
  for (const f of (R.fails || [])) console.log('    >> FAIL: ' + f);
}

console.log(NL + ran + ' arms staged, ' + bad + ' failing   [release ' + REL_ID + ']');
console.log(bad ? 'FAIL' : ONLY ? 'PASS for the arm(s) named by --only. THIS IS NOT THE FILE’S VERDICT.'
  : 'PASS — a spread hit\'s DamagingHit handlers run order-1 first and then index-major, the knob puts both '
  + 'red arms apart again, and a single live reactor does not move');
