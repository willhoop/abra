/* probe_megastone_take_guard.js — A MEGA STONE'S `onTakeItem` IS ASKED BY EVERY ITEM MOVER, AND MAGIC ROOM DOES
 * NOT SILENCE IT. 2026-09-24.
 *
 *   SHOWDOWN_PATH=... node tests/probe_megastone_take_guard.js                         live tree, scratch release
 *   SHOWDOWN_PATH=... node tests/probe_megastone_take_guard.js --regulation regmc      the same, Reg M-C
 *   ... --release <id>                                                                 pin a release
 *
 * ================= WHY =========================================================================
 *
 * Pinned Reg M-B differential, --games 300, game `…2659015200`: Meowstic set Magic Room, then Ariados' Knock Off
 * hit a Mega Alakazam holding its own Alakazite. The authority kept the stone; this engine wrote `-enditem` and the
 * board parted on `p1.party.alakazam.item`.
 *
 * THE AUTHORITY, READ WHOLE (no knockoff / trick / thief / covet / corrosivegas / symbiosis key in
 * data/mods/champions/ outside learnsets; every legal stone's `onTakeItem` is inherited from data/items.ts):
 *   sim/battle.ts:607 (singleEvent) and :874 (runEvent) skip an item handler under `ignoringItem()` — Magic Room,
 *     Klutz, Embargo — for every event EXCEPT `Start`, `SwitchIn` and `TakeItem`. So the stone's refusal is asked
 *     under a room and on a Klutz body exactly as it is anywhere else.
 *   corrosivegas.onHit   `const item = target.takeItem(source); if (item) {...} else this.add('-fail', ...)`
 *   thief/covet.onAfterHit  `target.takeItem(source)`, then `singleEvent('TakeItem', yourItem, ..., source, ...)`
 *     — the stone is asked again with the THIEF as holder, so a body cannot steal its own species' stone.
 *   symbiosis.onAllyAfterUseItem  the same second ask, with the RECEIVING ally as holder.
 *
 * THIS ENGINE: `itemRefusesTake` read the SLOT (`m.item`), which the Magic Room / Klutz park empties; Corrosive
 * Gas's `removes` branch never asked the stone at all; Thief, Covet and Symbiosis never asked the receiver.
 *
 *   knockoff-room          Magic Room up, Knock Off into Alakazam @ Alakazite            RED before
 *   knockoff-room-mega     the same, Alakazam mega-evolved first (the pool's game)       RED before
 *   knockoff-klutz         Knock Off into a Klutz Audino @ Audinite                      RED before
 *   trick-room             Magic Room up, an empty-handed Trick into Alakazam @ Alakazite RED before
 *   corrosivegas           Corrosive Gas into Alakazam @ Alakazite                       RED before
 *   thief-receiver         an empty-handed Alakazam Thiefs Alakazite off a Snorlax        RED before
 *   covet-receiver         an empty-handed Meowstic Covets Meowsticite off a Snorlax      RED before
 *   symbiosis-receiver     Oranguru @ Alakazite, ally Alakazam eats a Colbur Berry        RED before
 *   knockoff-room-plain    CONTROL — Magic Room, Knock Off into Alakazam @ Leftovers      agrees before and after
 *   thief-plain            CONTROL — Arbok Thiefs Alakazite off a Snorlax                 agrees before and after
 *
 * CLEAN: zero board diffs, the hit staged, and the authority's own outcome asserted (the stone still on its holder,
 * or on the control arms, gone). KNOB `MEDI_STONE_TAKE_UNGUARDED=1` restores all four old reads: every red arm must
 * part, neither control may. EXIT 0 pass / 1 fail / 2 cannot answer.
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
if (!REL_ID) { REL_ID = ER.cut('tests/probe_megastone_take_guard.js — freeze the tree under test').id; process.argv.push('--release', REL_ID); }
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_STONE_TAKE_UNGUARDED';

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
/* THE AUTHORITY'S SHAPE, CHECKED BEFORE ANYTHING IS STAGED. A changed handler is CANNOT ANSWER, never a pass. */
const read = {
  alakazite_refuses_its_own_base: DX.items.get('alakazite').onTakeItem.call({}, DX.items.get('alakazite'),
    { baseSpecies: DX.species.get('Alakazam') }) === false,
  alakazite_allows_a_foreign_holder: DX.items.get('alakazite').onTakeItem.call({}, DX.items.get('alakazite'),
    { baseSpecies: DX.species.get('Snorlax') }) !== false,
  corrosivegas_takes_through_takeItem: /target\.takeItem\(source\)/.test(src(DX.moves.get('corrosivegas').onHit)),
  thief_asks_the_receiver: /singleEvent\("TakeItem", yourItem, target\.itemState, source/.test(src(DX.moves.get('thief').onAfterHit)),
  covet_asks_the_receiver: /singleEvent\("TakeItem", yourItem, target\.itemState, source/.test(src(DX.moves.get('covet').onAfterHit)),
  symbiosis_asks_the_receiver: /singleEvent\("TakeItem", myItem, source\.itemState, pokemon/.test(src(DX.abilities.get('symbiosis').onAllyAfterUseItem)),
};
console.log(NL + 'tests/probe_megastone_take_guard.js   format ' + CS.FORMAT + '   release ' + REL_ID);
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
const ARBOK = mon('arbok', '', 'Shed Skin', ['Knock Off', 'Thief', 'Protect']);
const BANETTE = mon('banette', '', 'Insomnia', ['Magic Room', 'Trick', 'Protect']);
const SALAZZLE = mon('salazzle', '', 'Oblivious', ['Corrosive Gas', 'Protect']);
const ZAM_STONE = mon('alakazam', 'Alakazite', 'Inner Focus', ['Calm Mind', 'Thief', 'Protect']);
const ZAM_LEFT = mon('alakazam', 'Leftovers', 'Inner Focus', ['Calm Mind', 'Protect']);
const ZAM_BARE = mon('alakazam', '', 'Inner Focus', ['Calm Mind', 'Thief', 'Protect']);
const ZAM_COLBUR = mon('alakazam', 'Colbur Berry', 'Inner Focus', ['Calm Mind', 'Protect']);
const ORANGURU = mon('oranguru', 'Alakazite', 'Symbiosis', ['Calm Mind', 'Protect']);
const AUDINO = mon('audino', 'Audinite', 'Klutz', ['Calm Mind', 'Protect']);
const MEOW = mon('meowstic', '', 'Keen Eye', ['Covet', 'Protect']);
const SNOR = mon('snorlax', '', 'Thick Fat', ['Curse', 'Protect']);
const SNOR_ZAM = mon('snorlax', 'Alakazite', 'Thick Fat', ['Curse', 'Protect']);
const SNOR_MEOW = mon('snorlax', 'Meowsticite', 'Thick Fat', ['Curse', 'Protect']);
const FILL = [mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect']), mon('toxapex', '', 'Limber', ['Recover', 'Protect'])];
const STILL2 = [{ m: 'calmmind' }, { m: 'curse' }];
const ROOM = T([PROT, { m: 'magicroom' }], STILL2);
/* `keeps` names the p2 body (by species id) whose item the AUTHORITY must still hold at the end, and the item;
 * `loses` the one it must have lost. Asserted off the authority's own stream, so a fixture that did not stage the
 * mechanic cannot pass as agreement. */
const CASES = [
  { id: 'knockoff-room', red: true, p1: [ARBOK, BANETTE, ...FILL], p2: [ZAM_STONE, SNOR, ...FILL], keeps: 'Alakazite',
    script: [ROOM, T([{ m: 'knockoff', t: 0 }, PROT], STILL2)] },
  { id: 'knockoff-room-mega', red: true, p1: [ARBOK, BANETTE, ...FILL], p2: [ZAM_STONE, SNOR, ...FILL], keeps: 'Alakazite',
    script: [T([PROT, { m: 'magicroom' }], [{ m: 'calmmind', mega: true }, { m: 'curse' }]), T([{ m: 'knockoff', t: 0 }, PROT], STILL2)] },
  { id: 'knockoff-klutz', red: true, p1: [ARBOK, BANETTE, ...FILL], p2: [AUDINO, SNOR, ...FILL], keeps: 'Audinite',
    script: [T([{ m: 'knockoff', t: 0 }, PROT], STILL2)] },
  { id: 'trick-room', red: true, p1: [ARBOK, BANETTE, ...FILL], p2: [ZAM_STONE, SNOR, ...FILL], keeps: 'Alakazite',
    script: [ROOM, T([PROT, { m: 'trick', t: 0 }], STILL2)] },
  { id: 'corrosivegas', red: true, p1: [SALAZZLE, BANETTE, ...FILL], p2: [ZAM_STONE, SNOR, ...FILL], keeps: 'Alakazite',
    script: [T([{ m: 'corrosivegas' }, PROT], STILL2)] },
  { id: 'thief-receiver', red: true, p1: [ZAM_BARE, BANETTE, ...FILL], p2: [SNOR_ZAM, SNOR, ...FILL], keeps: 'Alakazite',
    script: [T([{ m: 'thief', t: 0 }, PROT], [{ m: 'curse' }, { m: 'curse' }])] },
  { id: 'covet-receiver', red: true, p1: [MEOW, BANETTE, ...FILL], p2: [SNOR_MEOW, SNOR, ...FILL], keeps: 'Meowsticite',
    script: [T([{ m: 'covet', t: 0 }, PROT], [{ m: 'curse' }, { m: 'curse' }])] },
  { id: 'symbiosis-receiver', red: true, p1: [ARBOK, BANETTE, ...FILL], p2: [ZAM_COLBUR, ORANGURU, ...FILL], keeps: 'Alakazite',
    keeper: 'p2b', script: [T([{ m: 'knockoff', t: 0 }, PROT], [{ m: 'calmmind' }, { m: 'calmmind' }])] },
  { id: 'knockoff-room-plain', red: false, p1: [ARBOK, BANETTE, ...FILL], p2: [ZAM_LEFT, SNOR, ...FILL], loses: 'Leftovers',
    script: [ROOM, T([{ m: 'knockoff', t: 0 }, PROT], STILL2)] },
  { id: 'thief-plain', red: false, p1: [ARBOK, BANETTE, ...FILL], p2: [SNOR_ZAM, SNOR, ...FILL], loses: 'Alakazite',
    script: [T([{ m: 'thief', t: 0 }, PROT], [{ m: 'curse' }, { m: 'curse' }])] },
];
let illegal = 0;
for (const c of CASES) for (const m of c.p1.concat(c.p2)) for (const p of problems(m)) { console.log('  ILLEGAL FIXTURE [' + c.id + '] ' + p); illegal++; }
if (illegal) { console.log('CANNOT ANSWER — illegal fixture.'); process.exit(2); }
console.log('    fixture legality (TeamValidator, ' + CS.FORMAT + '): every entry in ' + CASES.length + ' arms is legal');

function play(G, c) {
  G.resetScriptCounters();
  const a = G.buildPair(c.p1), b = G.buildPair(c.p2);
  if (!a || !b) return { notStaged: true };
  const diffs = [];
  const r = G.playGame(a, b, 'directed', 'probe_megastone_take_guard :: ' + c.id + ' :: ' + _cur, { script: c.script,
    onBoundary: (snap, t) => { for (const d of snap.diffs) diffs.push({ t, path: d.path, medicham: d.medicham, showdown: d.showdown });
                              snap.identical = true; snap.diffs = []; } });
  const log = G.lastSdLog() || [];
  const stamp = ((globalThis.MEDFAILS || {}).stoneTakeUnguardedRestored) || 0;
  const who = c.keeper || 'p2a';
  const item = c.keeps || c.loses;
  const left = log.some(l => l.startsWith('|-enditem|' + who) && l.includes('|' + item) && !/\[eat\]/.test(l))
            || log.some(l => l.startsWith('|-item|p1') && l.includes('|' + item))
            || log.some(l => l.startsWith('|-activate|' + who) && l.includes('Symbiosis|' + item));
  const moved = log.some(l => /\|move\|p1a|\|move\|p1b/.test(l));
  const megaed = log.some(l => l.startsWith('|-mega|p2a'));
  return { r, diffs, sc: G.scriptCounters(), stamp, left, moved, megaed,
           lines: log.filter(l => /\|move\|p1|-enditem|-item\||-fail|Magic Room|Symbiosis/.test(l)).slice(0, 8) };
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
  if ((clean.r.turns || 0) < c.script.length || !clean.moved) { console.log('    >> FIXTURE FAILED — the script did not play'); bad++; continue; }
  const wantsMega = c.script.some(t => (t.p2 || []).some(x => x && x.mega));
  if (wantsMega && !clean.megaed) { console.log('    >> FIXTURE FAILED — the mega evolution was asked for and did not happen'); bad++; continue; }
  if (c.keeps && clean.left) { console.log('    >> FIXTURE WRONG — the authority let ' + c.keeps + ' go; this arm asks nothing'); bad++; continue; }
  if (c.loses && !clean.left) { console.log('    >> FIXTURE WRONG — the control never moved ' + c.loses); bad++; continue; }
  console.log('    authority ' + (c.keeps ? 'KEPT ' + c.keeps : 'LOST ' + c.loses) + '   (asserted off its stream)');
  console.log('    clean  board diffs ' + clean.diffs.length + (clean.diffs.length ? '   first ' + JSON.stringify(clean.diffs[0]) : ''));
  if (clean.diffs.length) { console.log('    >> RED — the engines part with the engine as it stands'); bad++; }
  const brk = play(harness(true), c);
  harness(false);
  if (brk.notStaged || brk.r.err) { console.log('    NOT-STAGED / THREW under the knob'); bad++; continue; }
  console.log('    knob   board diffs ' + brk.diffs.length + (brk.diffs.length ? '   first ' + JSON.stringify(brk.diffs[0]) : '') + '   stamp ' + brk.stamp);
  if (!brk.stamp) { console.log('    >> THE KNOB DID NOT LOAD'); bad++; }
  else if (c.red && !brk.diffs.length) { console.log('    >> RED — the knob moved nothing'); bad++; }
  else if (!c.red && brk.diffs.length) { console.log('    >> the CONTROL parted under the knob'); bad++; }
  else if (!clean.diffs.length) console.log('    OK');
}
console.log(NL + (ran ? (bad ? 'FAIL — ' + bad + ' problem(s) over ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)') : 'NOT RUN'));
console.log('format ' + CS.FORMAT + '   release ' + REL_ID);
process.exit(!ran ? 2 : (bad ? 1 : 0));
