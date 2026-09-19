/* probe_room_target_item.js — A MOVE THAT READS THE TARGET'S ITEM READS WHAT THE TARGET HOLDS, NOT WHAT IT
 * CAN USE. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_room_target_item.js                   live tree, scratch release
 *   SHOWDOWN_PATH=... node tests/probe_room_target_item.js --release <id>
 *
 * ================= WHY =========================================================================
 *
 * tests/probe_room_unburden.js arms A and B parted on `hp` — authority 99, ours 118 — on the old release and
 * the new, the Pressure control included (docs/_reports/2026-09-19-unburden-leaf.md §6). 56 / 37 = x1.5: the
 * Knock Off boost was missing under Magic Room.
 *
 * THE AUTHORITY (no knockoff / poltergeist key in data/mods/champions/ outside learnsets):
 *   knockoff.onBasePower   `const item = target.getItem(); ... if (item.id) return this.chainModify(1.5);`
 *                                                                                    data/moves.ts:9971-9977
 *   poltergeist.onTry      `return !!target.item;`   and its `-activate` names `target.item`
 * `getItem()` and `.item` are the IDENTITY: `ignoringItem()` (Magic Room, Klutz) does not touch them. This
 * engine implements that suppression as a PARK (`itemRoomHide` empties `m.item` into `_roomItem`), so the
 * three readers of `readsTargetItem` / `variablePower.targetHasItem` that asked `m.item` saw an empty hand.
 *
 *   knockoff-room       Magic Room up, then Knock Off into a Leftovers holder     RED before
 *   knockoff-klutz      Knock Off into a Klutz Audino holding Leftovers            RED before
 *   poltergeist-room    Magic Room up, then Poltergeist into a Leftovers holder    RED before
 *   knockoff-noroom     CONTROL — the same Knock Off with no room                  agrees before and after
 *
 * CLEAN: zero board diffs and the fixture actually staged (the authority's room/Klutz and the hit). KNOB
 * `MEDI_TARGET_ITEM_READS_SLOT=1` restores the slot reads: the three red arms must part, the control not.
 * EXIT 0 pass / 1 fail / 2 cannot answer.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);
if (!process.argv.includes('--state')) process.argv.push('--state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) { REL_ID = ER.cut('tests/probe_room_target_item.js — freeze the tree under test').id; process.argv.push('--release', REL_ID); }
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_TARGET_ITEM_READS_SLOT';

let _cur = null, _G = null;
function harness(on) {
  const key = on ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (on) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

const CS = require(D('engine', 'champions_sim.js'));
const { TeamValidator } = require(process.env.SHOWDOWN_PATH + '/dist/sim/team-validator');
const V = new TeamValidator(CS.FORMAT);
const DX = V.dex;
const src = f => String(f || '').replace(/\s+/g, ' ');
const read = {
  knockoff_boost_reads_getItem: /target\.getItem\(\)/.test(src(DX.moves.get('knockoff').onBasePower)),
  poltergeist_onTry_reads_target_item: /target\.item/.test(src(DX.moves.get('poltergeist').onTry)),
};
console.log(NL + 'tests/probe_room_target_item.js   release ' + REL_ID);
for (const [k, v] of Object.entries(read)) console.log('    ' + k.padEnd(38) + JSON.stringify(v));
if (Object.values(read).some(v => !v)) { console.log('CANNOT ANSWER — the authority changed shape.'); process.exit(2); }

const legalSp = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
function problems(m) {
  const sp = DX.species.get(m.species), out = [];
  if (!legalSp(sp)) { out.push(m.species + ' is not legal'); return out; }
  if (m.ability && !Object.values(sp.abilities).map(a => DX.abilities.get(a).id).includes(DX.abilities.get(m.ability).id)) out.push(sp.name + ' cannot have ' + m.ability);
  if (m.item && DX.items.get(m.item).isNonstandard) out.push(m.item + ' is not legal');
  for (const mv of m.moves) {
    const mm = DX.moves.get(mv);
    if (!mm.exists || mm.isNonstandard) { out.push(mv + ' is not legal'); continue; }
    if (V.checkCanLearn(mm, sp, V.allSources(sp), { species: sp.name, moves: [mv] })) out.push(sp.name + ' cannot learn ' + mm.name);
  }
  return out;
}
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability, moves });
const T = (p1, p2) => ({ p1, p2 });
const PROT = { m: 'protect' };
const ARBOK = mon('arbok', '', 'Shed Skin', ['Knock Off', 'Protect']);
const BANETTE = mon('banette', '', 'Insomnia', ['Magic Room', 'Poltergeist', 'Protect']);
const CLEF = mon('clefable', 'Leftovers', 'Magic Guard', ['Calm Mind', 'Protect']);
const SNOR = mon('snorlax', '', 'Thick Fat', ['Curse', 'Protect']);
const AUDINO = mon('audino', 'Leftovers', 'Klutz', ['Calm Mind', 'Protect']);
const FILL = [mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect']), mon('toxapex', '', 'Limber', ['Recover', 'Protect'])];
const STILL2 = [{ m: 'calmmind' }, { m: 'curse' }];
const CASES = [
  { id: 'knockoff-room', red: true, p1: [ARBOK, BANETTE, ...FILL], p2: [CLEF, SNOR, ...FILL],
    script: [T([PROT, { m: 'magicroom' }], STILL2), T([{ m: 'knockoff', t: 0 }, PROT], STILL2)] },
  { id: 'knockoff-klutz', red: true, p1: [ARBOK, BANETTE, ...FILL], p2: [AUDINO, SNOR, ...FILL],
    script: [T([{ m: 'knockoff', t: 0 }, PROT], STILL2)] },
  { id: 'poltergeist-room', red: true, p1: [ARBOK, BANETTE, ...FILL], p2: [CLEF, SNOR, ...FILL],
    script: [T([PROT, { m: 'magicroom' }], STILL2), T([PROT, { m: 'poltergeist', t: 0 }], STILL2)] },
  { id: 'knockoff-noroom', red: false, p1: [ARBOK, BANETTE, ...FILL], p2: [CLEF, SNOR, ...FILL],
    script: [T([PROT, PROT], STILL2), T([{ m: 'knockoff', t: 0 }, PROT], STILL2)] },
];
let illegal = 0;
for (const c of CASES) for (const m of c.p1.concat(c.p2)) for (const p of problems(m)) { console.log('  ILLEGAL FIXTURE [' + c.id + '] ' + p); illegal++; }
if (illegal) { console.log('CANNOT ANSWER — illegal fixture.'); process.exit(2); }
console.log('    fixture legality (TeamValidator): every entry in ' + CASES.length + ' arms is legal');

function play(G, c) {
  G.resetScriptCounters();
  const a = G.buildPair(c.p1), b = G.buildPair(c.p2);
  if (!a || !b) return { notStaged: true };
  const diffs = [];
  const r = G.playGame(a, b, 'directed', 'probe_room_target_item :: ' + c.id + ' :: ' + _cur, { script: c.script,
    onBoundary: (snap, t) => { for (const d of snap.diffs) diffs.push({ t, path: d.path, medicham: d.medicham, showdown: d.showdown });
                              snap.identical = true; snap.diffs = []; } });
  const log = G.lastSdLog() || [];
  const stamp = ((globalThis.MEDFAILS || {}).targetItemReadsSlotRestored) || 0;
  return { r, diffs, sc: G.scriptCounters(), stamp,
           staged: log.some(l => /\|-(damage|activate)\|p2a/.test(l) || /\|-enditem\|p2a/.test(l)),
           lines: log.filter(l => /Knock Off|Poltergeist|Magic Room|-enditem|-fail/.test(l)).slice(0, 6) };
}
let bad = 0, ran = 0;
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '  ---- ' + c.id + (c.red ? '   [red arm]' : '   [control]'));
  const clean = play(harness(false), c);
  if (clean.notStaged || clean.r.err) { console.log('    NOT-STAGED / THREW ' + ((clean.r && clean.r.err) || '')); bad++; continue; }
  ran++;
  console.log('    authority: ' + clean.lines.join('  ||  '));
  if (clean.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — ' + clean.sc.firstMissing); bad++; continue; }
  if ((clean.r.turns || 0) < c.script.length || !clean.staged) { console.log('    >> FIXTURE FAILED — the hit on p2a was not staged'); bad++; continue; }
  console.log('    clean  board diffs ' + clean.diffs.length + (clean.diffs.length ? '   first ' + JSON.stringify(clean.diffs[0]) : ''));
  if (clean.diffs.length) { console.log('    >> RED — the engines part with the engine as it stands'); bad++; }
  const brk = play(harness(true), c);
  harness(false);
  if (brk.notStaged || brk.r.err) { console.log('    NOT-STAGED / THREW under the knob'); bad++; continue; }
  console.log('    knob   board diffs ' + brk.diffs.length + (brk.diffs.length ? '   first ' + JSON.stringify(brk.diffs[0]) : '') + '   stamp ' + brk.stamp);
  if (!brk.stamp) { console.log('    >> THE KNOB DID NOT LOAD'); bad++; }
  else if (c.red && !brk.diffs.length) { console.log('    >> RED — the knob moved nothing'); bad++; }
  else if (!c.red && brk.diffs.length) { console.log('    >> the CONTROL parted under the knob'); bad++; }
  else console.log('    OK');
}
console.log(NL + (ran ? (bad ? 'FAIL — ' + bad + ' problem(s) over ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)') : 'NOT RUN'));
console.log('release ' + REL_ID);
process.exit(!ran ? 2 : (bad ? 1 : 0));
