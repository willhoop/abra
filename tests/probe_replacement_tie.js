/* probe_replacement_tie.js — TWO CORPSES ON EQUAL RAW SPEED REFILL IN THE ORDER THE AUTHORITY'S `speedSort`
 * TIE DIE DECIDES, NOT IN SIDE ORDER. THIS ENGINE SORTED THE REPLACEMENT QUEUE WITH A STABLE SORT AND NO DIE.
 * 2026-09-09, narration batch Y.
 *
 *   SHOWDOWN_PATH=... node tests/probe_replacement_tie.js
 *   SHOWDOWN_PATH=... node tests/probe_replacement_tie.js --release <id> --only two-corpses-on-equal-raw-speed
 *
 * ================= THE CARD =====================================================================
 *
 * `data/game-differential.json`, release `b0f5c159c46e`, 961 games on the pinned pool:
 *
 *     ordering :: |switch|p2a|archaludon,l50|H/H <> |switch|p1a|gholdengo,l50|H/H
 *
 * and the game itself (`pair-protect-bust`, seed …bo3-2635037737 vs …2635936827, turn 4), replayed whole
 * with `engine/replay_one.js`: a Swampert (p2a) and a Swampert-Mega (p1a) faint in the same turn, and so
 * does an Annihilape (p2b). Both engines refill the Annihilape's slot first. Then:
 *
 *     showdown   |switch|p2a: Archaludon|…     |switch|p1a: Gholdengo|…
 *     medicham2  |switch|p1a: Gholdengo|…      |switch|p2a: Archaludon|…
 *
 * The replay under the differential's own driver read `MEDFAILS.replaceOrderTie = 1`: the two corpses TIE
 * on raw Speed. That counter existed precisely because the engine could see the tie and did not resolve it.
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 * Every forced replacement is queued as `{choice: 'instaswitch', pokemon: <the FAINTED body>, target: <the
 * one coming in>}` (`Side#chooseSwitch`, sim/side.ts:1009), p1's slots then p2's. `BattleQueue#resolveAction`
 * (sim/battle-queue.ts:270) calls `Battle#getActionSpeed`, which writes `action.speed =
 * action.pokemon.getActionSpeed()` (sim/battle.ts:2657) — the CORPSE's speed. `faintMessages` has already
 * run `clearVolatile(false)` and set `isActive = false` (sim/battle.ts:2560-2562), so `getStat('spe')`
 * collects no boost, ability, item or side handler (`findEventHandlers`, sim/battle.ts:1053) and returns
 * `storedStats.spe`, inverted under Trick Room. THEN the queue is sorted ONCE by `Battle#speedSort`
 * (sim/battle.ts:429-459) — a selection sort whose tied group goes to `prng.shuffle`. Under the
 * differential's `middle` pin that shuffle is the identity and a tie resolves to the LATER body in input
 * order (game_differential.js, the pin claims), i.e. p2's action ahead of p1's.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * The KEY was already right — `_corpseSpe` reads `m.st.sp`, the raw stat, since 2026-08-27. The SORT was
 * `Array.prototype.sort` over `compareTurnOrder`, which is STABLE and draws nothing: a tie kept the build
 * order of `_refills`, side A first, every time. `entrySpeedSort` — the selection sort with the tie die
 * the entry pass has used for the SwitchIn ranking since 2026-08-24 — is the same algorithm the authority
 * runs on this queue, and the refill now goes through it.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected order. Both engines play the same script under the `middle` pin and the pass
 * is that the two protocol streams do not part. SHOWDOWN IS THE EXPECTATION. `MEDI_REPLACE_ORDER_STABLE=1`
 * is the revert knob and restores the stable sort exactly, so a RED arm agrees clean and PARTS under the
 * knob, and a CONTROL agrees under both.
 *
 * ================= THE FIXTURE, AND WHY IT NEEDS THREE CORPSES ==================================
 *
 * A TWO-corpse tie does NOT separate the two sorts, and the first draft of this file proved it by
 * agreeing on both loads: with only [p1a, p2a] in the queue the selection sort makes no swap, the
 * identity shuffle keeps the tied pair in input order, and a stable sort gives the same answer. The card
 * has a THIRD, faster corpse on p2's side (the Annihilape), and `speedSort` is a SELECTION SORT whose
 * first pass swaps that fastest action to the front — `list[0] <-> list[2]` — which moves p1a's action
 * BEHIND p2a's before the tied pair is ever resolved (WIRE 134's finding, one queue over). A stable sort
 * cannot produce that permutation from any comparator.
 *
 * So: the same species on both sides in slot a, each clicking Memento at the other (the user faints if
 * the move hits; `selfdestruct: 'ifHit'`, derived below), PLUS a faster Memento user in p2's slot b aimed
 * at p1's partner. Identical species under `buildPair` carry identical stats, so the two slot-a corpses
 * tie exactly. The CONTROL is the same shape with two DIFFERENT base Speeds in slot a, so there is no tie
 * and the two sorts must agree.
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
  REL_ID = ER.cut('tests/probe_replacement_tie.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_REPLACE_ORDER_STABLE';

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
const MEMENTO = { m: 'memento', t: 0 };
const MEMENTO_AT_B = { m: 'memento', t: 1 };

const CHANDELURE = ['chandelure', '', 'Flash Fire', ['Memento', 'Protect']];
/* p1's slot-a body carries a CHOICE SCARF so the two tied Chandelures have a DETERMINISTIC move order --
 * the Scarf moves first and Mementos a p2a that has not yet moved; p2a then Mementos p1's partner, which
 * is alive. The corpse's raw Speed ignores the Scarf (`isActive` is false by then), so the REFILL tie
 * is untouched. Without it a move-order coin decided whether the second Memento found a living target,
 * and the fixture staged the tie only half the time. */
const CHANDELURE_SCARF = ['chandelure', 'Choice Scarf', 'Flash Fire', ['Memento', 'Protect']];
const POLTEAGEIST = ['polteageist', '', 'Weak Armor', ['Memento', 'Protect']];
/* THE THIRD CORPSE: faster than either slot-a body, on p2's side, so the selection sort's first swap crosses
 * the tied pair. Prankster only moves its Memento earlier in the turn; the corpse's raw Speed is what sorts. */
const WHIMSICOTT = ['whimsicott', '', 'Prankster', ['Memento', 'Protect']];
const A_TAIL = [['corviknight', '', 'Pressure', ['Iron Defense', 'Protect']],
                ['milotic', '', 'Marvel Scale', ['Protect', 'Coil']],
                ['clefable', '', 'Unaware', ['Calm Mind', 'Protect']]];
const B_TAIL = [WHIMSICOTT,
                ['toxapex', '', 'Regenerator', ['Protect']],
                ['froslass', '', 'Snow Cloak', ['Protect']]];

/* TWO TURNS: the double Memento, then one more so the replacements' `|switch|` lines are inside the
 * compared window and the turn boundary after them is compared too. TURN 2 IS FOUR PROTECTS, because the
 * replacement that fills slot a is whichever bench body the driver picks and Protect is the one move every
 * body in the fixture carries — the first draft wrote a self-boost there, the harness sent `pass` for a
 * body that lacked it, and the authority refused the choice ("must make a move"). */
const PROTECT = { m: 'protect' };
const script = [
  { p1: [MEMENTO, ID], p2: [MEMENTO_AT_B, MEMENTO_AT_B] },
  { p1: [PROTECT, PROTECT], p2: [PROTECT, PROTECT] },
];

const CASES = [
  { id: 'two-corpses-on-equal-raw-speed', kind: 'red',
    a: [CHANDELURE_SCARF].concat(A_TAIL), b: [CHANDELURE].concat(B_TAIL),
    tieClean: 1, tieKnob: 0, stableTieKnob: 1,
    what: 'THE CARD, REBUILT. Two Chandelures Memento each other and a faster Whimsicott Mementos the p1 '
        + 'partner: three corpses, two of them tied. The authority\'s selection sort swaps the fastest action '
        + 'to the front and that swap carries p1a\'s action behind p2a\'s; this engine\'s stable sort refilled '
        + 'p1a ahead of p2a, every time.' },

  { id: 'two-corpses-on-different-raw-speed', kind: 'control',
    a: [CHANDELURE_SCARF].concat(A_TAIL), b: [POLTEAGEIST].concat(B_TAIL),
    tieClean: 0, tieKnob: 0, stableTieKnob: 0,
    what: 'THE KNOB CLEARED EXPLICITLY — the same three Mementos with two different slot-a base Speeds. No '
        + 'tie, so a stable sort and a selection sort reach the same order; nothing here may move.' },
];

/* ---- LEGALITY, DERIVED. ------------------------------------------------------------------------ */
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
  const memento = dex.moves.get('memento');
  const battleTs = fs.readFileSync(path.join(SP, 'sim', 'battle.ts'), 'utf8');
  const sideTs = fs.readFileSync(path.join(SP, 'sim', 'side.ts'), 'utf8');
  console.log('memento: selfdestruct ' + JSON.stringify(memento.selfdestruct) + ', category ' + memento.category
    + ', Champions override: ' + (/^\tmemento: \{/m.test(fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8')) ? 'YES' : 'no'));
  console.log('base Speed: chandelure ' + dex.species.get('chandelure').baseStats.spe + ', polteageist ' + dex.species.get('polteageist').baseStats.spe
    + ', whimsicott ' + dex.species.get('whimsicott').baseStats.spe + ' (must be the fastest of the three)');
  if (!(dex.species.get('whimsicott').baseStats.spe > dex.species.get('chandelure').baseStats.spe
        && dex.species.get('whimsicott').baseStats.spe > dex.species.get('polteageist').baseStats.spe))
    bad.push('the third corpse is no longer the fastest, so the selection sort swap does not cross the tied pair');
  const speedLine = /action\.speed = action\.pokemon\.getActionSpeed\(\)/.test(battleTs);
  const chooseSwitchPushesCorpse = /choice: \(this\.requestState === 'switch' \? 'instaswitch' : 'switch'\),\s*pokemon,\s*target: targetPokemon/.test(sideTs);
  console.log('getActionSpeed reads action.pokemon: ' + speedLine + '   chooseSwitch queues {pokemon: the corpse, target: the entrant}: ' + chooseSwitchPushesCorpse);
  if (memento.selfdestruct !== 'ifHit') bad.push('Memento no longer faints its user on a hit');
  if (dex.species.get('chandelure').baseStats.spe === dex.species.get('polteageist').baseStats.spe) bad.push('the control\'s two species now share a base Speed');
  if (!speedLine) bad.push('Battle#getActionSpeed no longer reads action.pokemon.getActionSpeed()');
  if (!chooseSwitchPushesCorpse) bad.push('Side#chooseSwitch no longer queues the corpse as `pokemon`');
  if (bad.length) { console.log(NL + 'NOT RUN — ' + bad.join('; ') + '. This is not a pass.'); process.exit(2); }
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  const beforeF = Object.assign({}, globalThis.MEDFAILS || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.a)), b = G.buildPair(stage(c.b));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_replacement_tie :: ' + c.id, { script, arm });
  const after = globalThis.MEDSEEN || {}, afterF = globalThis.MEDFAILS || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(),
    stableTie: (afterF.replaceOrderTie || 0) - (beforeF.replaceOrderTie || 0),
    restored: afterF.replaceOrderStableRestored || 0 };
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

  const short = clean.r.turns < script.length;
  const refused = clean.sc.moveNotOnRequest;
  const R = { c, clean, brk, short, refused,
    tie: clean.delta.replaceTieResolved || 0, tieK: brk.delta.replaceTieResolved || 0 };
  results.push(R);

  if (short || refused) { bad++; R.fails = ['FIXTURE — the script did not play out on the clean load']; continue; }
  const fails = [];
  if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
  if (R.tie !== c.tieClean) fails.push('replaceTieResolved clean is ' + R.tie + ', declared ' + c.tieClean);
  if (R.tieK !== c.tieKnob) fails.push('replaceTieResolved knob is ' + R.tieK + ', declared ' + c.tieKnob);
  if (brk.stableTie !== c.stableTieKnob) fails.push('MEDFAILS.replaceOrderTie under the knob is ' + brk.stableTie + ', declared ' + c.stableTieKnob + ' — the fixture did not stage the tie it claims');
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
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    streams        clean ' + (clean.r.div ? 'PART at reduced line ' + clean.r.div.index : 'AGREE')
    + '   |   knob ' + (brk.r.div ? 'PART at reduced line ' + brk.r.div.index : 'AGREE'));
  console.log('    counters       replaceTieResolved ' + R.tie + '/' + c.tieClean + ' clean, ' + R.tieK + '/' + c.tieKnob
    + ' knob   |   MEDFAILS.replaceOrderTie under the knob ' + brk.stableTie + '/' + c.stableTieKnob);
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
  : 'PASS — two corpses on equal raw Speed refill in the order the authority\'s tie die decides, the knob '
  + 'puts the red arm apart again, and an untied double faint does not move');
