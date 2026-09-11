#!/usr/bin/env node
/* tests/probe_volley_collapse_clamp.js — ROADMAP #511, the Endure and Focus Sash roads.
 * ==================================================================================================
 * WHEN A MULTI-HIT VOLLEY'S TOTAL IS REWRITTEN BEFORE IT LANDS, IS THE HIT COUNT STILL ANNOUNCED?
 *
 * When a clamp rewrites the volley total (`dmg !== R.dmg` at the packet gate), this engine collapses the
 * volley back to one packet, announces no `|-hitcount|`, and counts `MEDFAILS.hitCountDroppedOnCollapse`
 * (release 2b5a6585d8cf). The authority lands every arrival and prints the real count. The Disguise
 * road was closed under #526; this row stays open for Endure and Focus Sash, and
 * tests/probe_volley_collapse.js carries the Endure road as a DECLARED row, so it cannot read red on it.
 * This probe declares nothing.
 *
 *   ENDURE ROUTE  Weavile's Icicle Spear (legal, 100% accurate, 2-5 hits) into a Garchomp (4x weak)
 *                 clicking Endure. Selected ON THE AUTHORITY: Endure activates and Garchomp lives.
 *   SASH ROUTE    the same volley into a full-HP Garchomp holding Focus Sash, Weavile boosted first so
 *                 arrival 1 alone is lethal. Selected on the authority: the Sash is spent mid-volley.
 *   CONTROL       the same volley into the same Garchomp clicking Swords Dance with no item: no clamp,
 *                 so no collapse; the count must agree.
 * Each is compared on the board at every boundary, on the protocol by the driver's own aligner, and
 * on the `|-hitcount|` value read off each engine's stream. Legality from the format's TeamValidator.
 * KNOB, for after the fix: `MEDI_HITCOUNT_DROP_ON_COLLAPSE=1` is the proposed name for restoring the drop.
 * EXIT: 0 green / 1 red / 2 cannot answer (a route could not be staged is reported, not failed).
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--release') < 0) process.argv.push('--release', '2b5a6585d8cf');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');
const REL_ID = process.argv[process.argv.indexOf('--release') + 1];
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
const KNOB = process.env.MEDI_HITCOUNT_DROP_ON_COLLAPSE === '1';

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const BS = require(path.join(ROOT, 'engine', 'board_state.js'));
const G = SB.harness();
const RID = (G.REL && G.REL.id) || '?';
console.log('\ntests/probe_volley_collapse_clamp.js — ROADMAP #511   release ' + RID);
if (RID !== REL_ID) cannot('the driver opened release ' + RID + ', not ' + REL_ID);
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDFAILS'] });

const { TeamValidator } = require(process.env.SHOWDOWN_PATH + '/dist/sim/team-validator');
const V = new TeamValidator(require(path.join(ROOT, 'engine', 'champions_sim.js')).FORMAT);
const DX = V.dex;
function problems(m) {
  const sp = DX.species.get(m.species), out = [];
  if (!sp.exists || sp.isNonstandard || sp.tier === 'Illegal') out.push(m.species + ' is not legal');
  if (m.ability && !Object.values(sp.abilities).map(a => DX.abilities.get(a).id).includes(DX.abilities.get(m.ability).id)) out.push(m.species + ' cannot have ' + m.ability);
  if (m.item && DX.items.get(m.item).isNonstandard) out.push(m.item + ' is not legal');
  for (const mv of m.moves) if (V.checkCanLearn(DX.moves.get(mv), sp, V.allSources(sp), { species: sp.name, moves: [mv] })) out.push(m.species + ' cannot learn ' + mv);
  return out;
}
const IS = DX.moves.get('iciclespear');
if (!Array.isArray(IS.multihit) || IS.accuracy !== 100 || IS.isNonstandard) cannot('Icicle Spear is not a legal, 100%-accurate multi-hit move here');
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const A = () => [mon('weavile', '', 'Pressure', ['Icicle Spear', 'Swords Dance', 'Protect']),
                 mon('corviknight', '', 'Pressure', ['Bulk Up', 'Protect']),
                 mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect']), mon('toxapex', '', 'Limber', ['Recover', 'Protect'])];
const B = (item) => [mon('garchomp', item, 'Sand Veil', ['Endure', 'Swords Dance', 'Protect']),
                 mon('snorlax', '', 'Thick Fat', ['Curse', 'Protect']),
                 mon('kingambit', '', 'Pressure', ['Protect']), mon('hydreigon', '', 'Levitate', ['Protect'])];
const bad0 = [].concat(...A().map(problems), ...B('Focus Sash').map(problems));
console.log('  fixture legality (TeamValidator): ' + (bad0.length ? bad0.join('; ') : 'every body, ability, item and move is legal'));
if (bad0.length) cannot('the fixture is not legal: ' + bad0.join('; '));

function play(tag, item, script) {
  const a = G.buildPair(A()), b = G.buildPair(B(item));
  if (!a || !b) return null;
  G.resetScriptCounters();
  const f0 = M.MEDFAILS.hitCountDroppedOnCollapse | 0;
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'owed511:' + tag, { script,
    onBoundary: (snap, t) => { boards.push({ turn: t, diffs: snap.diffs.map(d => BS.locate(d, snap)) }); snap.identical = true; snap.diffs = []; } });
  const sd = G.lastSdLog(), me = r.mediTrace || [];
  const last = (L) => { const n = script.length, i = L.lastIndexOf('|turn|' + n); return i >= 0 ? L.slice(i) : L; };
  /* `p2a?:` — A FAINTED BODY IS NAMED BY SIDE ONLY. The authority writes `|-hitcount|p2: Garchomp|2`
   * when the volley ended in a faint, and the first form of this regex required `p2a:`, so the control
   * and the Sash route read null on BOTH engines and "agreed" over nothing. */
  const hc = L => { const l = last(L).find(x => /^\|-hitcount\|p2a?: Garchomp\|/.test(x)); return l ? +l.split('|')[3] : null; };
  return { tag, r, boards, sd, me, sdLast: last(sd), sdHits: hc(sd), meHits: hc(me), dropped: (M.MEDFAILS.hitCountDroppedOnCollapse | 0) - f0, sc: G.scriptCounters() };
}
const T = (p1, p2) => ({ p1, p2 });
const setup = (k) => Array.from({ length: k }, () => T([{ m: 'swordsdance' }, { m: 'bulkup' }], [{ m: 'swordsdance' }, { m: 'curse' }]));
const strike = (garchompClick) => T([{ m: 'iciclespear', t: 0 }, { m: 'bulkup' }], [{ m: garchompClick }, { m: 'curse' }]);

const routes = [], tried = [];
for (let k = 0; k <= 1; k++) {
  const g = play('endure-' + k, '', setup(k).concat([strike('endure')]));
  const hit = g && !g.r.err && g.sdLast.some(l => /^\|-activate\|p2a: Garchomp\|move: Endure/.test(l))
    && !g.sdLast.some(l => /^\|faint\|p2a: Garchomp/.test(l)) && (g.sdHits || 0) >= 2;
  tried.push('ENDURE setup x' + k + ': ' + (g ? (g.r.err ? 'threw ' + g.r.err : hit ? 'STAGED' : 'not staged (sd hitcount ' + g.sdHits + ')') : 'buildPair null'));
  if (hit) { routes.push({ name: 'ENDURE', g }); break; }
}
for (let k = 0; k <= 2; k++) {
  const g = play('sash-' + k, 'Focus Sash', setup(k).concat([strike('swordsdance')]));
  const dmg = g ? g.sdLast.filter(l => /^\|-damage\|p2a: Garchomp\|/.test(l)).length : 0;
  const hit = g && !g.r.err && g.sdLast.some(l => /^\|-enditem\|p2a: Garchomp\|Focus Sash/.test(l)) && dmg >= 2;
  tried.push('SASH   setup x' + k + ': ' + (g ? (g.r.err ? 'threw ' + g.r.err : hit ? 'STAGED' : 'not staged (damage lines ' + dmg + ')') : 'buildPair null'));
  if (hit) { routes.push({ name: 'FOCUS SASH', g }); break; }
}
const ctl = play('control', '', [strike('swordsdance')]);
console.log('\n  CANDIDATE BOARDS (selected on the authority\'s stream):');
for (const t of tried) console.log('      ' + t);
if (!ctl || ctl.r.err) cannot('the control arm did not play: ' + (ctl ? ctl.r.err : 'buildPair null'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
function judge(name, g, expectRed) {
  const tagR = expectRed ? '   [expected RED: the knob is armed]' : '';
  console.log('\n  ' + name + ' — authority hitcount ' + g.sdHits + ', medicham hitcount ' + g.meHits
    + ', MEDFAILS.hitCountDroppedOnCollapse +' + g.dropped);
  for (const l of g.sdLast.filter(l => /Garchomp/.test(l)).slice(0, 9)) console.log('      sd  ' + l);
  const diffs = [].concat(...g.boards.map(b => b.diffs.map(d => 'turn ' + b.turn + '  ' + d.path + '   ours ' + JSON.stringify(d.us) + ' / authority ' + JSON.stringify(d.sd))));
  ok(!diffs.length, 'every board boundary agrees', diffs.slice(0, 5).join('\n') || null);
  ok(g.sdHits === g.meHits, 'the |-hitcount| value agrees' + tagR,
     g.sdHits === g.meHits ? null : 'cell: ' + name + ' — authority `|-hitcount|...Garchomp|' + g.sdHits + '`, medicham '
       + (g.meHits == null ? 'announced NO count' : 'announced ' + g.meHits) + '; the engine counted the drop ' + g.dropped + ' time(s)');
  ok(g.r.div == null, 'the protocol never parts' + tagR, g.r.div ? JSON.stringify(g.r.div).slice(0, 500) : null);
}
judge('CONTROL (no clamp)', ctl, false);
if (ctl.sdHits == null) cannot('the authority announced no hit count on the control, so a count comparison on any route would compare nothing');
if (bad) cannot('the control arm parted, so a red on a clamp route could not be attributed to the collapse');
for (const r of routes) judge(r.name + ' ROUTE', r.g, KNOB);
if (!routes.length) cannot('neither the Endure nor the Sash route could be staged — a claim about the fixture');
for (const n of ['ENDURE', 'FOCUS SASH']) if (!routes.some(r => r.name === n)) console.log('\n  ' + n + ' ROUTE not staged — reported, not counted');

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
