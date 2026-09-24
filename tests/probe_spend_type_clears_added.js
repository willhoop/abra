#!/usr/bin/env node
/* tests/probe_spend_type_clears_added.js — A TYPE SPEND (BURN UP, DOUBLE SHOCK) CLEARS THE ADDED TYPE.
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=<Reg M-B checkout> node tests/probe_spend_type_clears_added.js --release <M-B id>
 *   SHOWDOWN_PATH=<Reg M-C checkout> ABRA_REGULATION=regmc node tests/probe_spend_type_clears_added.js --release <M-C id>
 *   MEDI_SPEND_TYPE_KEEPS_ADDED=1 ...      (the red demonstration: the whole list mapped, the added type kept)
 *
 * FILED in docs/_reports/2026-09-24-reflect-type-corners.md §6. The authority (data/moves.ts `burnup` :2108-2113
 * and `doubleshock` :3961-3966 in the Reg M-B checkout, :2108 / :3960 in Reg M-C; no Champions override of either
 * handler — the mods only set `isNonstandard` and, Reg M-C Double Shock, `flags`):
 *     self: { onHit(pokemon) {
 *         pokemon.setType(pokemon.getTypes(true).map(type => type === "Fire" ? "???" : type));
 *         this.add('-start', pokemon, 'typechange', pokemon.getTypes().join('/'), '[from] move: Burn Up'); } }
 * `getTypes(true)` is the BASE list and `setType` writes `addedType = ''`. So a Trick-or-Treated Arcanine that
 * Burns Up is ['???'] with nothing added, and its spend line says `???`. This engine mapped the whole list and
 * kept the added Ghost as if it were a base type.
 *
 * REACHABLE, derived at run time: Burn Up, Trick-or-Treat and Forest's Curse are legal in both formats. Double
 * Shock is `Past` in Reg M-B — its arm is skipped there with the reason printed, and plays in Reg M-C (Pawmot).
 *
 * THE ARMS — every one played in both engines, Showdown is the expectation, the whole board compared, and the
 * spend's own `typechange` line and the turn-boundary type broadcast for the spender compared as well:
 *   RED 1     Gourgeist Trick-or-Treats Arcanine (turn 1), Arcanine Burns Up into its own Milotic (turn 2), idle.
 *   RED 2     the same with Trevenant's Forest's Curse (an added Grass).
 *   RED 3     Reg M-C only: Gourgeist Trick-or-Treats Pawmot, Pawmot Double Shocks Gourgeist. Authority
 *             ['???','Fighting'], nothing added.
 *   CONTROL 1 Burn Up with nothing added (already agreeing): a red on RED 1 is the added type's doing.
 *   CONTROL 2 Burn Up FIRST, Trick-or-Treat after it: the add after a spend still stands (???/Ghost), so the fix
 *             clears the slot at the spend and does not disable it.
 * Legality: every body, ability and move is put to the format's TeamValidator first.
 * EXIT: 0 green / 1 red / 2 cannot answer.
 * ================================================================================================ */
'use strict';
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
if (process.argv.indexOf('--release') < 0) cannot('pass --release <id>: a probe does not pick the engine it measures');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');
const REL_ID = process.argv[process.argv.indexOf('--release') + 1];
const KNOB = process.env.MEDI_SPEND_TYPE_KEEPS_ADDED === '1';

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const BS = require(path.join(ROOT, 'engine', 'board_state.js'));
const G = SB.harness();
const RID = (G.REL && G.REL.id) || '?';
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
console.log('\ntests/probe_spend_type_clears_added.js   release ' + RID + '   format ' + CS.FORMAT
  + (KNOB ? '   [MEDI_SPEND_TYPE_KEEPS_ADDED=1 — the RED arms are expected RED]' : ''));
if (RID !== REL_ID) cannot('the driver opened release ' + RID + ', not ' + REL_ID);

const { TeamValidator } = require(process.env.SHOWDOWN_PATH + '/dist/sim/team-validator');
const V = new TeamValidator(CS.FORMAT);
const DX = V.dex;
function problems(m) {
  const sp = DX.species.get(m.species), out = [];
  if (!sp.exists || sp.isNonstandard || sp.tier === 'Illegal') out.push(m.species + ' is not legal');
  if (m.ability && !Object.values(sp.abilities).map(a => DX.abilities.get(a).id).includes(DX.abilities.get(m.ability).id)) out.push(m.species + ' cannot have ' + m.ability);
  if (m.item && DX.items.get(m.item).isNonstandard) out.push(m.item + ' is not legal');
  for (const mv of m.moves) {
    const mm = DX.moves.get(mv);
    if (!mm.exists || mm.isNonstandard) out.push(mv + ' is not legal');
    else if (V.checkCanLearn(mm, sp, V.allSources(sp), { species: sp.name, moves: [mv] })) out.push(m.species + ' cannot learn ' + mv);
  }
  return out;
}
/* THE AUTHORITY, READ: both spends set the BASE list, mapped. */
for (const id of ['burnup', 'doubleshock']) {
  const h = String(((DX.moves.get(id).self) || {}).onHit || '');
  const okRead = /setType\(\s*pokemon\.getTypes\(true\)\.map\(/.test(h);
  console.log('  authority, read: ' + id + '.self.onHit sets getTypes(true) mapped: ' + okRead + '   (isNonstandard ' + JSON.stringify(DX.moves.get(id).isNonstandard) + ')');
  if (!okRead) cannot('the checkout\'s ' + id + ' does not read as this probe assumes; re-derive the premise');
}
const DS_LEGAL = !DX.moves.get('doubleshock').isNonstandard;

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const A = (lead) => [lead === 'trevenant' ? mon('trevenant', 'Leftovers', 'Frisk', ['Forest\'s Curse', 'Sleep Talk', 'Protect'])
                                          : mon('gourgeist', 'Leftovers', 'Frisk', ['Trick-or-Treat', 'Sleep Talk', 'Protect']),
                     mon('stunfisk', 'Sitrus Berry', 'Static', ['Sleep Talk', 'Protect']),
                     mon('corviknight', '', 'Pressure', ['Protect']), mon('clefable', '', 'Magic Guard', ['Protect'])];
const B = (lead) => [lead === 'pawmot' ? mon('pawmot', 'Leftovers', 'Natural Cure', ['Double Shock', 'Sleep Talk', 'Protect'])
                                       : mon('arcanine', 'Leftovers', 'Flash Fire', ['Burn Up', 'Sleep Talk', 'Protect']),
                     mon('milotic', 'Sitrus Berry', 'Marvel Scale', ['Sleep Talk', 'Protect']),
                     mon('snorlax', '', 'Thick Fat', ['Protect']), mon('garchomp', '', 'Rough Skin', ['Protect'])];
const bad0 = [].concat(...A().map(problems), ...A('trevenant').map(problems), ...B().map(problems), ...(DS_LEGAL ? B('pawmot').map(problems) : []));
console.log('  fixture legality (TeamValidator): ' + (bad0.length ? bad0.join('; ') : 'every body, ability, item and move is legal'));
if (bad0.length) cannot('the fixture is not legal: ' + bad0.join('; '));

function play(tag, a0, b0, script) {
  const a = G.buildPair(a0), b = G.buildPair(b0);
  if (!a || !b) return null;
  G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'spend-added:' + tag, { script,
    onBoundary: (snap, t) => { boards.push({ turn: t, diffs: snap.diffs.map(d => BS.locate(d, snap)) }); snap.identical = true; snap.diffs = []; } });
  return { r, boards, sd: G.lastSdLog(), me: (r.mediTrace || []).map(String), turns: boards.length };
}
const T = (p1, p2) => ({ p1, p2 });
const IDLE = T([{ m: 'sleeptalk' }, { m: 'sleeptalk' }], [{ m: 'sleeptalk' }, { m: 'sleeptalk' }]);
const BURNUP = T([{ m: 'sleeptalk' }, { m: 'sleeptalk' }], [{ m: 'burnup', ally: true }, { m: 'sleeptalk' }]);
const DSHOCK = T([{ m: 'sleeptalk' }, { m: 'sleeptalk' }], [{ m: 'doubleshock', t: 0 }, { m: 'sleeptalk' }]);
const ADD = (mv) => T([{ m: mv, t: 0 }, { m: 'sleeptalk' }], [{ m: 'sleeptalk' }, { m: 'sleeptalk' }]);

const ARMS = [
  ['RED 1  Trick-or-Treat, then Burn Up', 'red', A(), B(), [ADD('trickortreat'), BURNUP, IDLE], 'Arcanine', 'Burn Up'],
  ['RED 2  Forest\'s Curse, then Burn Up', 'red', A('trevenant'), B(), [ADD('forestscurse'), BURNUP, IDLE], 'Arcanine', 'Burn Up'],
  ['RED 3  Trick-or-Treat, then Double Shock', 'red', A(), DS_LEGAL ? B('pawmot') : null, [ADD('trickortreat'), DSHOCK, IDLE], 'Pawmot', 'Double Shock'],
  ['CONTROL 1  Burn Up, nothing added', 'control', A(), B(), [IDLE, BURNUP, IDLE], 'Arcanine', 'Burn Up'],
  ['CONTROL 2  Burn Up, then Trick-or-Treat', 'control', A(), B(), [BURNUP, ADD('trickortreat'), IDLE], 'Arcanine', 'Burn Up'],
];
let bad = 0, redBad = 0, played = 0;
const ok = (cond, what, detail, isRed) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) { bad++; if (isRed) redBad++; }
};
/* the two streams spell a body differently (`p2a: Arcanine` / `p2a:arcanine`); compare on the address, the kind,
 * the type and the tag; the `[from] move:` field is compared as an id (`Trick-or-Treat` / `trickortreat`) */
const norm = (l) => String(l).toLowerCase().replace(/\s+/g, '').replace(/^(\|-start\|p\d[ab]):[^|]*/, '$1')
  .replace(/(\[from\]move:)([^|]*)/, (_, a, b) => a + b.replace(/[^a-z0-9]/g, ''));
const typeLines = (lines) => lines.filter(l => /^\|-start\|p2a/.test(l) && /\|type(change|add)\|/.test(l)).map(norm);
for (const [name, kind, a0, b0, script, who, mvName] of ARMS) {
  console.log('\n  ' + name);
  if (!b0) { console.log('  skip  Double Shock is ' + JSON.stringify(DX.moves.get('doubleshock').isNonstandard) + ' in ' + CS.FORMAT + ' — not in this regulation (derived)'); continue; }
  const g = play(name.split(/\s+/).slice(0, 2).join('').toLowerCase(), a0, b0, script);
  if (!g) cannot('buildPair returned null on ' + name);
  if (g.r.err) cannot(name + ' threw: ' + g.r.err);
  if (g.turns < script.length + 1) cannot(name + ' played ' + g.turns + ' boundaries of ' + (script.length + 1) + ' — a short game tests nothing');
  played++;
  const spent = g.sd.some(l => new RegExp('^\\|-start\\|p2a: ' + who + '\\|typechange\\|[^|]*\\?\\?\\?[^|]*\\|\\[from\\] move: ' + mvName).test(l));
  ok(spent, 'the authority spent ' + who + '\'s type with ' + mvName + ' (the fixture is staged)');
  const diffs = [].concat(...g.boards.map(b => b.diffs.map(d => 'boundary ' + b.turn + '  ' + d.path + '  sd ' + JSON.stringify(d.sd) + ' / me ' + JSON.stringify(d.us))));
  ok(!diffs.length, 'the two boards agree at every boundary' + (kind === 'red' && KNOB ? '   [expected RED: the knob is armed]' : ''),
     diffs.length ? diffs.slice(0, 6).join('\n') : null, kind === 'red');
  const ls = typeLines(g.sd), lm = typeLines(g.me);
  ok(JSON.stringify(ls) === JSON.stringify(lm), 'the spender\'s typechange / typeadd lines agree (the spend line and the broadcast)',
     'showdown ' + JSON.stringify(ls) + '\n' + 'medicham ' + JSON.stringify(lm), kind === 'red');
}
if (played < 4) cannot('only ' + played + ' arms played');

console.log('\n' + (bad ? 'RED' : 'GREEN') + (KNOB ? '   (knob armed: ' + redBad + ' red-arm failure(s) — must be > 0 for the knob to be live)' : ''));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
