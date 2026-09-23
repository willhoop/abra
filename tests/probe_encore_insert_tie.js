/* probe_encore_insert_tie.js — A MID-TURN ENCORE RE-INSERTS ITS TARGET'S ACTION, AND AMONG TIED
 * ACTIONS THE INSERT DECIDES WHO MOVES FIRST. 2026-09-22 (abra/regmc 0.62.0).
 *
 *   node tests/probe_encore_insert_tie.js --regulation regmc
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_encore_insert_tie.js
 *   node tests/probe_encore_insert_tie.js --regulation regmc --release <id>   (a prior release: red)
 *
 * ================= THE MECHANISM, READ WHOLE ====================================================
 *
 * Champions' `encore.condition.onStart` (data/mods/champions/moves.ts, the `encore` entry) ends with
 * `this.queue.changeAction(target, { choice: 'move', moveid: move.id, order: action.order })` when the
 * target has not acted and chose another move. `changeAction` (sim/battle-queue.ts:301) is
 * `cancelAction` + `insertChoice`, and `insertChoice` (:372-404) lands the rebuilt action among the
 * actions it TIES with at `this.battle.random(firstIndex, lastIndex + 1)` -- a uniform position from
 * the front of the tied group to its back. Under the differential's middle arm that die is pinned to
 * `firstIndex`: the FRONT of the group. This engine re-bracketed the action and left it in its slot,
 * so with a speed tie the Encored body moved behind its twin where the authority moves it in front.
 *
 * THE CARD: the 1950 Reg M-C lattice, `pair-redirect-priority ...bo3-2678207112` turn 5 -- two
 * identical Armarouge, Whimsicott's Prankster Encore on p2b, and the two engines firing the Armarouge
 * in opposite orders. This file stages that shape alone.
 *
 * ================= THE BOARD ====================================================================
 *
 * The driver's spread is by SLOT (`spreadFor`), so the same species in slot 1 on both sides is an exact
 * tie with every Speed input equal. Sylveon in both slot 1s; Whimsicott (Prankster) Encores at +1;
 * Meowstic sits faster than both Sylveon at priority 0 so the selection sort has something to swap.
 *
 * ================= NO EXPECTATION IS TYPED ======================================================
 *
 * Each arm plays the identical script on both engines under the `middle` pin and compares the `|move|`
 * order of the diagnostic turn. The authority's order is the answer. A red arm must agree clean and
 * part under `MEDI_ENCORE_INSERT_KEEPS_PLACE=1`; a control must agree on both loads.
 *
 *   tie-front      [red]      the victim is BEHIND its twin and the insert brings it to the front
 *   tie-no-encore  [control]  the knob cleared: Charm in place of the Encore; nothing relocates. Its
 *                             authority order is asserted DIFFERENT from `tie-front`'s, so the
 *                             instrument is shown able to see the insert at all
 *   tie-same-move  [control]  the victim already chose the encored move; `changeAction` never runs
 *   tie-mirror     [control]  the victim is ALREADY in front of its twin; the insert keeps it there.
 *                             A "move it to the back of its group" fix fails here
 *
 * Every species, ability, item and move is checked against the selected regulation's format and the
 * validator's learnset before a game is played; one illegal cell refuses the whole run.
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
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_encore_insert_tie.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_ENCORE_INSERT_KEEPS_PLACE';

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
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));
const WHIM = ['whimsicott', '', 'Prankster', ['Encore', 'Charm', 'Protect']];
const MEOW = ['meowstic', '', 'Keen Eye', ['Charm', 'Protect']];
const SYLV = ['sylveon', '', 'Cute Charm', ['Charm', 'Calm Mind', 'Protect', 'Quick Attack']];

const CH0 = { m: 'charm', t: 0 };
const CM = { m: 'calmmind' };
const ENC1 = { m: 'encore', t: 1 };

const SIDE_ENC = () => stage([WHIM, SYLV]).concat(BENCH('clefable', 'snorlax'));
const SIDE_VIC = () => stage([MEOW, SYLV]).concat(BENCH('garchomp', 'toxapex'));

const CASES = [
  { id: 'tie-front', kind: 'red', reloc: 1, enc: 1,
    A: SIDE_ENC(), B: SIDE_VIC(),
    script: [{ p1: [CH0, CH0], p2: [CH0, CM] },
      { p1: [ENC1, CH0], p2: [CH0, CH0] }],
    what: 'p2b Sylveon ties p1b Sylveon and sorts behind it; Encore rewrites its Charm to Calm Mind '
        + '(same bracket), and the authority re-inserts it at the FRONT of the tied pair.' },
  { id: 'tie-no-encore', kind: 'control', reloc: 0, enc: 0, differsFrom: 'tie-front',
    A: SIDE_ENC(), B: SIDE_VIC(),
    script: [{ p1: [CH0, CH0], p2: [CH0, CM] },
      { p1: [CH0, CH0], p2: [CH0, CH0] }],
    what: 'THE KNOB CLEARED EXPLICITLY — the same board and clicks with Charm in place of the Encore.' },
  { id: 'tie-same-move', kind: 'control', reloc: 0, enc: 1,
    A: SIDE_ENC(), B: SIDE_VIC(),
    script: [{ p1: [CH0, CH0], p2: [CH0, CM] },
      { p1: [ENC1, CH0], p2: [CH0, CM] }],
    what: '`action.moveid !== move.id` is false: the victim already clicked Calm Mind, nothing is re-inserted.' },
  { id: 'tie-mirror', kind: 'control', reloc: 1, enc: 1,
    A: SIDE_VIC(), B: SIDE_ENC(),
    script: [{ p1: [CH0, CM], p2: [CH0, CH0] },
      { p1: [CH0, CH0], p2: [ENC1, CH0] }],
    what: 'The victim (p1b) already sorts IN FRONT of its twin; the insert lands it at the front again, '
        + 'so the order must not move. A move-to-the-back fix breaks here.' },
];

/* ---- LEGALITY, DERIVED AND REFUSED ------------------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
let illegal = 0;
const seenRow = new Set();
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const key = row.species + '|' + row.ability + '|' + row.moves.join(',');
  if (seenRow.has(key)) continue;
  seenRow.add(key);
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in ' + CS.FORMAT); illegal++; continue; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); illegal++;
  }
  for (const mv of row.moves) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in ' + CS.FORMAT); illegal++; continue; }
    if (!CS.canLearn(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

const ENC_SRC = String((dex.moves.get('encore').condition || {}).onStart || '');
console.log(NL + '  format ' + CS.FORMAT + '   encore.condition.onStart calls changeAction: ' + /changeAction/.test(ENC_SRC));
if (!/changeAction/.test(ENC_SRC)) { console.log('NOT RUN — the format no longer re-inserts; a finding, not a pass.'); process.exit(2); }
for (const s of ['whimsicott', 'meowstic', 'sylveon']) console.log('    ' + s.padEnd(11) + ' base spe ' + dex.species.get(s).baseStats.spe);

/* ---- THE RUN ----------------------------------------------------------------------------------- */
const ACT = /^\|(move|switch)\|/;
const orderOf = arr => {
  const out = [[]];
  for (const raw of arr.map(String)) {
    if (/^\|turn\|/.test(raw)) { out.push([]); continue; }
    if (ACT.test(raw)) out[out.length - 1].push(raw.split('|')[2].replace(/\s+/g, ' ').trim());
  }
  return out.slice(1);
};
const ENC_START = /^\|-start\|[^|]*\|(move: )?encore/i;

function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const a = G.buildPair(c.A), b = G.buildPair(c.B);
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_encore_insert_tie :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sd: orderOf(G.sdStream(G.lastSdLog())), me: orderOf(r.mediTrace),
    sdEnc: G.sdStream(G.lastSdLog()).filter(l => ENC_START.test(String(l))).length,
    meEnc: (r.mediTrace || []).filter(l => ENC_START.test(String(l))).length,
    sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).encoreInsertKeepsPlaceRestored || 0 };
}

const eq = (x, y) => !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
let bad = 0, ran = 0;
const seen = new Map();
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']   ' + c.what);
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;
  const T = c.script.length - 1;
  const sdT = clean.sd[T] || [], meT = clean.me[T] || [], meKT = (brk.me || [])[T] || [];
  console.log('    showdown  T' + (T + 1) + '   ' + sdT.join('  ->  '));
  console.log('    medicham  T' + (T + 1) + '   ' + meT.join('  ->  '));
  console.log('    medicham  T' + (T + 1) + '   ' + meKT.join('  ->  ') + '   [knob]');
  console.log('    encore -start   showdown ' + clean.sdEnc + '   medicham ' + clean.meEnc
    + '   |   relocations clean ' + (clean.delta.encoreRelocatedQueuedAction || 0)
    + '   tie inserts clean ' + (clean.delta.encoreInsertTieDrawn || 0)
    + '   moved clean ' + (clean.delta.encoreInsertMoved || 0)
    + '   |   stamp clean ' + clean.restored + ' knob ' + brk.restored);
  if (clean.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request (' + clean.sc.firstMissing + ').'); bad++; continue; }
  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) { console.log('    >> FIXTURE FAILED — the script did not play out.'); bad++; continue; }
  if (clean.sdEnc !== c.enc || clean.meEnc !== c.enc) { console.log('    >> FIXTURE FAILED — expected ' + c.enc + ' Encore -start on each stream.'); bad++; continue; }
  seen.set(c.id, { sd: sdT });
  /* THE VERDICT FIRST, so a prior release (no knob, no counters) still prints which way it orders. */
  if (!eq(sdT, meT)) { console.log('    >> DEFECT — the two engines order the turn differently.'); bad++; }
  else console.log('    >> the two engines order the turn identically.');
  if (!(clean.restored === 0 && brk.restored === 1)) { console.log('    >> KNOB DID NOT BIND.'); bad++; continue; }
  if ((clean.delta.encoreRelocatedQueuedAction || 0) !== c.reloc) { console.log('    >> THE RELOCATION BRANCH DID NOT RUN AS CLAIMED.'); bad++; }
  if (c.reloc && !(clean.delta.encoreInsertTieDrawn > 0)) { console.log('    >> THE INSERT NEVER LANDED IN A TIED GROUP — the arm does not stage a tie.'); bad++; }
  if (c.kind === 'red') {
    if (eq(sdT, meKT)) { console.log('    >> THE KNOB DID NOT MOVE THE ORDER — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart.');
  } else if (!eq(sdT, meKT)) { console.log('    >> OVER-FIRE — the control moved under the knob.'); bad++; }
}
for (const c of CASES) {
  if (!c.differsFrom) continue;
  const a = seen.get(c.id), b = seen.get(c.differsFrom);
  if (!a || !b) continue;
  const moved = !eq(a.sd, b.sd);
  console.log(NL + '  INSTRUMENT CONTROL — showdown orders `' + c.id + '` differently from `' + c.differsFrom + '`: ' + (moved ? 'YES' : 'NO'));
  if (!moved) { console.log('    >> the authority shows no insert effect — nothing here measures anything.'); bad++; }
}
console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
