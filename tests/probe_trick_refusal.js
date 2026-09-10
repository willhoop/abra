/* probe_trick_refusal.js — A TRICK THE AUTHORITY'S `onHit` REFUSES IS `|-fail|MOVER` WITH THE `|move|`
 * LINE'S TARGET BLANKED, AND THE MEGA-STONE RULE IS THE BODY'S, NOT THE ITEM CLASS'S. THIS ENGINE REFUSED
 * ANY STONE ON EITHER SIDE IN SILENCE AND ANNOUNCED A SWAP OF TWO EMPTY HANDS.
 * 2026-09-09, narration batch Y.
 *
 *   SHOWDOWN_PATH=... node tests/probe_trick_refusal.js
 *   SHOWDOWN_PATH=... node tests/probe_trick_refusal.js --release <id> --only trick-into-a-body-holding-its-own-stone
 *
 * ================= THE CARD =====================================================================
 *
 * `data/game-differential.json`, release `b0f5c159c46e`, 961 games on the pinned pool:
 *
 *     event missing from medicham2 :: |-fail|p2a <> |move|p2b|rockslide
 *
 * and the game itself (`pair-protect-bust`, seed …bo3-2654619049 vs …2654751965, turn 4), replayed whole
 * with `engine/replay_one.js`: a Rotom-Heat Tricks a Metagross-Mega that holds its own Metagrossite.
 *
 *     showdown   |move|p2a: Rotom|Trick||[still]
 *                |-fail|p2a: Rotom
 *     medicham2  |move|p2a: Rotom|trick|p1a: Metagross
 *                (nothing — the next line is the partner's Rock Slide)
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 * `trick.onHit`, data/moves.ts (no Champions override — asserted below):
 *
 *     const yourItem = target.takeItem(source);
 *     const myItem = source.takeItem();
 *     if (yourItem === false || myItem === false || (!yourItem && !myItem)) { …put back…; return false; }
 *     if ((myItem && !this.singleEvent('TakeItem', myItem, source.itemState, target, source, move, myItem)) ||
 *         (yourItem && !this.singleEvent('TakeItem', yourItem, target.itemState, source, target, move, yourItem)))
 *       { …put back…; return false; }
 *
 * `Pokemon#takeItem` (sim/pokemon.ts) returns FALSE exactly when `runEvent('TakeItem')` refuses. Every
 * mega stone's handler is `onTakeItem(item, source) { if (item.megaEvolves === source.baseSpecies.baseSpecies)
 * return false; return true; }` — the stone refuses the body it BELONGS TO, and no other. The second `if`
 * asks the same handler of the RECEIVER: a Metagrossite cannot be given to a Metagross either. A handler
 * returning false out of `moveHit` writes `|-fail|SOURCE` and `attrLastMove('[still]')`, which BLANKS field
 * 4 of the `|move|` line already emitted (sim/battle.ts:3120-3134).
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * `TAGS.has('item', …, 'megaStone')` on EITHER body -> `continue`, in silence — the class of the item, not
 * the body's claim on it. Two empty hands fell through to the swap block and wrote `-activate` over a swap
 * of nothing. The fine rule already existed as `itemRefusesTake` (Knock Off, Thief and Pickpocket all ask
 * it); this batch asks it here, asks it of the receiver too (`stoneRefusesBody`), and writes the line.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line. Both engines play the same script under the differential's own
 * `middle` pin and the pass is that the two protocol streams do not part. SHOWDOWN IS THE EXPECTATION.
 * `MEDI_TRICK_REFUSAL_SILENT=1` is the revert knob and restores exactly the pre-2026-09-09 road, so a RED
 * arm is one that agrees clean and PARTS under the knob, and a CONTROL is one that agrees under BOTH.
 *
 * ================= THE ARMS, AND WHY EACH ONE EXISTS =============================================
 *
 * `trick-into-a-body-holding-its-own-stone`   THE CARD: `yourItem === false`.
 * `trick-with-both-hands-empty`               `!yourItem && !myItem` — the road that used to announce a swap.
 * `trick-of-a-foreign-stone-into-another-species`   THE FINE RULE, the arm the coarse guard breaks the
 *     other way: a Rotom-Heat holding a Metagrossite Tricks a Hydreigon holding Leftovers, and the
 *     authority SWAPS — the stone is not Rotom's and not Hydreigon's. The old guard refused it (silently).
 * `trick-of-a-foreign-stone-into-its-own-species`   THE RECEIVER'S REFUSAL: the same Rotom-Heat Tricks a
 *     Metagross holding Leftovers, and the second `if` refuses — a Metagrossite cannot be given to a
 *     Metagross. `-fail`, on a road where the coarse guard was silent.
 * `trick-scarf-for-leftovers`   THE KNOB CLEARED EXPLICITLY — the same mover, the same click, the same
 *     slot, no stone anywhere: the swap goes through on both loads, with `-activate` and both `-item` lines.
 *
 * `trick-from-a-body-holding-its-own-stone`   `myItem === false` — the MOVER holds its own stone. Metagross
 *     learns Trick (derived; the first draft of this file said no legal Trick learner had a stone, because it
 *     read a field the checkout no longer carries — the probe was wrong before the engine was).
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
  REL_ID = ER.cut('tests/probe_trick_refusal.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_TRICK_REFUSAL_SILENT';

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

/* ---- THE FIXTURE ------------------------------------------------------------------------------
 * ONE TURN PER ARM. The Trick target clicks a self-boost and NOT Protect — Trick carries `protect: 1`
 * and a shield would refuse the move above `onHit`, staging nothing. Partners click a self-boost so no
 * slot can run out of a legal choice. Nothing here attacks, so no body can faint and no slot can move. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const NP = { m: 'nastyplot' };
const ID = { m: 'irondefense' };
const SD = { m: 'swordsdance' };

const ROTOM = item => ['rotomheat', item, 'Levitate', ['Trick', 'Nasty Plot', 'Protect']];
const A_TAIL = [['corviknight', '', 'Pressure', ['Iron Defense', 'Protect']],
                ['milotic', '', 'Marvel Scale', ['Protect', 'Coil']],
                ['clefable', '', 'Unaware', ['Calm Mind', 'Protect']]];
const METAGROSS = item => ['metagross', item, 'Clear Body', ['Iron Defense', 'Protect']];
const METAGROSS_TRICKER = item => ['metagross', item, 'Clear Body', ['Trick', 'Iron Defense', 'Protect']];
const HYDREIGON = item => ['hydreigon', item, 'Levitate', ['Nasty Plot', 'Protect']];
const B_TAIL = [['garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']],
                ['toxapex', '', 'Regenerator', ['Protect']],
                ['froslass', '', 'Snow Cloak', ['Protect']]];

const oneTurn = tgtMove => [{ p1: [{ m: 'trick', t: 0 }, ID], p2: [tgtMove, SD] }];

const CASES = [
  { id: 'trick-into-a-body-holding-its-own-stone', kind: 'red',
    a: [ROTOM('Choice Scarf')].concat(A_TAIL), b: [METAGROSS('Metagrossite')].concat(B_TAIL), script: oneTurn(ID),
    refusedClean: 1, refusedKnob: 0,
    what: 'THE CARD, REBUILT. Rotom-Heat (Choice Scarf) Tricks a Metagross holding its own Metagrossite. '
        + '`target.takeItem(source)` returns false, `onHit` returns false: `|-fail|` and the `|move|` line\'s '
        + 'target is blanked. This engine `continue`d in silence.' },

  { id: 'trick-from-a-body-holding-its-own-stone', kind: 'red',
    a: [METAGROSS_TRICKER('Metagrossite')].concat(A_TAIL), b: [HYDREIGON('Leftovers')].concat(B_TAIL), script: oneTurn(NP),
    refusedClean: 1, refusedKnob: 0,
    what: '`myItem === false`. The mover holds its own Metagrossite; `source.takeItem()` refuses it and '
        + '`onHit` returns false. Same line, the other body.' },

  { id: 'trick-with-both-hands-empty', kind: 'red',
    a: [ROTOM('')].concat(A_TAIL), b: [HYDREIGON('')].concat(B_TAIL), script: oneTurn(NP),
    refusedClean: 1, refusedKnob: 0,
    what: '`!yourItem && !myItem`. The authority fails the move; this engine reached the swap block and '
        + 'wrote `-activate` over a swap of nothing.' },

  { id: 'trick-of-a-foreign-stone-into-another-species', kind: 'red',
    a: [ROTOM('Metagrossite')].concat(A_TAIL), b: [HYDREIGON('Leftovers')].concat(B_TAIL), script: oneTurn(NP),
    refusedClean: 0, refusedKnob: 0,
    what: 'THE FINE RULE. A Metagrossite on a Rotom-Heat belongs to nobody on the field, so `takeItem` '
        + 'hands it over and the Hydreigon may hold it: the authority SWAPS. The coarse any-stone guard '
        + 'refused this in silence — the same defect read the other way round.' },

  { id: 'trick-of-a-foreign-stone-into-its-own-species', kind: 'red',
    a: [ROTOM('Metagrossite')].concat(A_TAIL), b: [METAGROSS('Leftovers')].concat(B_TAIL), script: oneTurn(ID),
    refusedClean: 1, refusedKnob: 0,
    what: 'THE RECEIVER\'S REFUSAL. Both `takeItem`s succeed, and then the second `if` asks the stone whether '
        + 'the Metagross may hold it: `item.megaEvolves === target.baseSpecies.baseSpecies`, so `-fail`. '
        + 'The coarse guard was silent here too.' },

  { id: 'trick-scarf-for-leftovers', kind: 'control',
    a: [ROTOM('Choice Scarf')].concat(A_TAIL), b: [HYDREIGON('Leftovers')].concat(B_TAIL), script: oneTurn(NP),
    refusedClean: 0, refusedKnob: 0,
    what: 'THE KNOB CLEARED EXPLICITLY — no stone anywhere, both hands full. The swap goes through on both '
        + 'loads: `-activate`, then `-item` on both bodies, and nothing here may move.' },
];

/* ---- LEGALITY, DERIVED. Nothing above is typed from memory. ------------------------------------- */
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
  const champMoves = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const champItems = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'items.ts'), 'utf8');
  const mainMoves = fs.readFileSync(path.join(SP, 'data', 'moves.ts'), 'utf8');
  const bad = [];
  const trickBlock = (() => { const i = mainMoves.indexOf('\ttrick: {'); return mainMoves.slice(i, mainMoves.indexOf('\n\t},', i)); })();
  const stone = dex.items.get('metagrossite');
  /* THE STONE'S SHAPE IS `megaStone: { "Metagross": "Metagross-Mega" }` and its handler is
   *     onTakeItem(item, source) { return !item.megaStone?.[source.baseSpecies.baseSpecies]; }
   * (data/items.ts). The first draft of this file asserted `megaEvolves === 'Metagross'`, a field the
   * current checkout no longer carries, and refused to run — the probe was wrong before the engine was. */
  const mainItems = fs.readFileSync(path.join(SP, 'data', 'items.ts'), 'utf8');
  const stoneBlock = (() => { const i = mainItems.indexOf('\tmetagrossite: {'); return mainItems.slice(i, mainItems.indexOf('\n\t},', i)); })();
  const champStoneBlock = (() => { const i = champItems.indexOf('\tmetagrossite: {'); return i < 0 ? '' : champItems.slice(i, champItems.indexOf('\n\t},', i)); })();
  const namesMetagross = !!(stone.megaStone && stone.megaStone['Metagross']);
  console.log('metagrossite: megaStone ' + JSON.stringify(stone.megaStone) + ', onTakeItem present: ' + (typeof stone.onTakeItem === 'function')
    + ', handler refuses the body the stone names: ' + /return !item\.megaStone\?\.\[source\.baseSpecies\.baseSpecies\]/.test(stoneBlock));
  console.log('trick.onHit carries the three-way refusal: ' + /yourItem === false \|\| myItem === false \|\| \(!yourItem && !myItem\)/.test(trickBlock)
    + '   and the receiver\'s TakeItem check: ' + /singleEvent\('TakeItem', myItem/.test(trickBlock));
  console.log('DOES CHAMPIONS REWRITE trick? ' + (/^\ttrick: \{/m.test(champMoves) ? 'YES' : 'no')
    + '   metagrossite? ' + (champStoneBlock ? ('yes — ' + (/onTakeItem/.test(champStoneBlock) ? 'WITH ITS OWN onTakeItem' : 'inherit only (legality flag), handler inherited')) : 'no'));
  const trickLearnersWithStone = dex.species.all().filter(legal)
    .filter(s => learns(s.id, 'trick') && dex.items.all().some(i => legal(i) && i.megaStone && i.megaStone[s.name])).map(s => s.name);
  console.log('legal Trick learners that have a mega stone (the `myItem === false` arm needs one): '
    + (trickLearnersWithStone.join(', ') || '(none)'));
  if (!namesMetagross) bad.push('Metagrossite no longer names Metagross in its megaStone map');
  if (typeof stone.onTakeItem !== 'function') bad.push('Metagrossite carries no onTakeItem');
  if (!/return !item\.megaStone\?\.\[source\.baseSpecies\.baseSpecies\]/.test(stoneBlock)) bad.push('the mega-stone onTakeItem no longer reads as quoted above');
  if (!/yourItem === false \|\| myItem === false \|\| \(!yourItem && !myItem\)/.test(trickBlock)) bad.push('trick.onHit no longer carries the three-way refusal quoted above');
  if (!/singleEvent\('TakeItem', myItem/.test(trickBlock)) bad.push('trick.onHit no longer asks the receiver\'s TakeItem');
  if (/^\ttrick: \{/m.test(champMoves)) bad.push('Champions now overrides Trick');
  if (champStoneBlock && /onTakeItem/.test(champStoneBlock)) bad.push('Champions now overrides Metagrossite\'s onTakeItem');
  if (!trickLearnersWithStone.includes('Metagross')) bad.push('Metagross no longer learns Trick or no longer has a stone — the `myItem === false` arm needs a new mover');
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
  const r = G.playGame(a, b, 'directed', 'probe_trick_refusal :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).trickRefusalSilentRestored || 0 };
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
  const R = { c, clean, brk, short, refused,
    ref: clean.delta.swapRefusedAnnounced || 0, refK: brk.delta.swapRefusedAnnounced || 0 };
  results.push(R);

  if (short || refused) { bad++; R.fails = ['FIXTURE — the script did not play out on the clean load']; continue; }
  const fails = [];
  if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
  if (R.ref !== c.refusedClean) fails.push('swapRefusedAnnounced clean is ' + R.ref + ', declared ' + c.refusedClean);
  if (R.refK !== c.refusedKnob) fails.push('swapRefusedAnnounced knob is ' + R.refK + ', declared ' + c.refusedKnob);
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
  console.log('    counters       swapRefusedAnnounced ' + R.ref + '/' + c.refusedClean + ' clean, ' + R.refK + '/' + c.refusedKnob + ' knob');
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
  : 'PASS — a Trick the authority\'s onHit refuses is announced as `-fail` with its `|move|` target blanked, '
  + 'a stone refuses only the body it belongs to (holder or receiver), the knob puts every red arm apart '
  + 'again, and a plain two-item swap does not move');
