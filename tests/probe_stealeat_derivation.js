#!/usr/bin/env node
/* tests/probe_stealeat_derivation.js — ROADMAP #529.
 * ==================================================================================================
 * DOES data/tags.json SAY THAT BUG BITE AND PLUCK EAT THE BERRY THEY TAKE — AND DOES THE ENGINE EAT IT?
 *
 * THE DERIVATION HALF (the row's open claim). `engine/tag_dex.js` decides `takesTargetItem.
 * consumesAndGainsEffect` with `/eatItem|singleEvent\('Eat'/` — single quotes only — against the
 * COMPILED handler, which uses double quotes, so Bug Bite and Pluck read false. This probe asks the
 * FORMAT, quote-agnostically, whether each `takesTargetItem` move's own handler eats, and compares the
 * answer with the tag the pinned release shipped. The membership is printed before it is judged.
 *
 * THE ENGINE HALF (fixed in code, never asserted). The engine eats anyway through a class-guard
 * fallback and counts it in `MEDFAILS.stealEatViaClassGuard`. Staged here on both engines:
 *   EAT ARM   Garchomp chips Scizor, then Scizor Bug Bites a Corviknight holding Sitrus Berry: the
 *             authority strips the berry `[from] stealeat` and Scizor eats it. Boards and protocol must
 *             agree, and the fallback counter reads how often the engine leaned on the guard.
 *   CONTROL   the same turn into a Corviknight holding Leftovers: nothing is eaten, on either engine.
 * KNOBS: `MEDI_STEALEAT_STRIP_ONLY=1` (exists) restores strip-without-eat — the eat arm must go RED
 * under it. Once #529's regeneration lands, `stealEatViaClassGuard` reads 0 on the eat arm.
 * Legality from the format's TeamValidator. EXIT: 0 green / 1 red / 2 cannot answer.
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
const KNOB = process.env.MEDI_STEALEAT_STRIP_ONLY === '1';

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const BS = require(path.join(ROOT, 'engine', 'board_state.js'));
const G = SB.harness();
const RID = (G.REL && G.REL.id) || '?';
console.log('\ntests/probe_stealeat_derivation.js — ROADMAP #529   release ' + RID + '   MEDI_STEALEAT_STRIP_ONLY=' + (KNOB ? '1 (expected RED on the eat arm)' : '0'));
if (RID !== REL_ID) cannot('the driver opened release ' + RID + ', not ' + REL_ID);
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDFAILS'] });
const TAGS = JSON.parse(G.REL.read('data/tags.json'));

const { TeamValidator } = require(process.env.SHOWDOWN_PATH + '/dist/sim/team-validator');
const V = new TeamValidator(require(path.join(ROOT, 'engine', 'champions_sim.js')).FORMAT);
const DX = V.dex;

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

/* ================= 1. THE DERIVATION, ASKED OF THE FORMAT ======================================= */
const EATS = /eatItem|singleEvent\(\s*["'`]Eat["'`]/;
const mem = Object.entries(TAGS.moves || {}).filter(([, e]) => (e.params || {}).takesTargetItem);
console.log('\n  1. EVERY takesTargetItem MOVE IN THE RELEASE\'S TAGS, AGAINST ITS OWN HANDLER IN THE FORMAT:');
const cells = [];
for (const [id, e] of mem) {
  const mv = DX.moves.get(id);
  const legal = mv.exists && !mv.isNonstandard;
  const src = ['onHit', 'onAfterHit', 'onAfterMoveSecondarySelf'].map(k => String(mv[k] || '')).join('\n');
  const eats = EATS.test(src);
  const tag = !!e.params.takesTargetItem.consumesAndGainsEffect;
  console.log('      ' + id.padEnd(14) + (legal ? 'legal  ' : 'ILLEGAL') + '  handler eats ' + String(eats).padEnd(5)
    + '  tag consumesAndGainsEffect ' + String(tag).padEnd(5) + '  removes ' + e.params.takesTargetItem.removes + (eats !== tag ? '   <- DISAGREE' : ''));
  if (legal && eats !== tag) cells.push(id + ': handler eats=' + eats + ', tag consumesAndGainsEffect=' + tag);
}
if (!mem.some(([id]) => id === 'knockoff')) cannot('knockoff carries no takesTargetItem tag — the control population is missing');
ok(!cells.length, 'every legal takesTargetItem move\'s tag agrees with whether its handler eats',
   cells.length ? 'cells (release ' + RID + ' data/tags.json): ' + cells.join('; ') + '. engine/tag_dex.js\'s eats regex is single-quote only.' : null);

/* ================= 2. THE ENGINE HALF, STAGED ================================================== */
function problems(m) {
  const sp = DX.species.get(m.species), out = [];
  if (!sp.exists || sp.isNonstandard || sp.tier === 'Illegal') out.push(m.species + ' is not legal');
  if (m.ability && !Object.values(sp.abilities).map(a => DX.abilities.get(a).id).includes(DX.abilities.get(m.ability).id)) out.push(m.species + ' cannot have ' + m.ability);
  if (m.item && DX.items.get(m.item).isNonstandard) out.push(m.item + ' is not legal');
  for (const mv of m.moves) if (V.checkCanLearn(DX.moves.get(mv), sp, V.allSources(sp), { species: sp.name, moves: [mv] })) out.push(m.species + ' cannot learn ' + mv);
  return out;
}
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const A = () => [mon('scizor', '', 'Light Metal', ['Bug Bite', 'Swords Dance', 'Protect']),
                 mon('kingambit', '', 'Pressure', ['Swords Dance', 'Protect']),
                 mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect']), mon('toxapex', '', 'Limber', ['Recover', 'Protect'])];
const B = (item) => [mon('corviknight', item, 'Pressure', ['Bulk Up', 'Protect']),
                 mon('garchomp', '', 'Sand Veil', ['Dragon Claw', 'Swords Dance', 'Protect']),
                 mon('snorlax', '', 'Thick Fat', ['Protect']), mon('hydreigon', '', 'Levitate', ['Protect'])];
const bad0 = [].concat(...A().map(problems), ...B('Sitrus Berry').map(problems), ...B('Leftovers').map(problems));
console.log('\n  2. THE EAT, STAGED — fixture legality (TeamValidator): ' + (bad0.length ? bad0.join('; ') : 'legal'));
if (bad0.length) cannot('the fixture is not legal: ' + bad0.join('; '));
function play(tag, item) {
  const a = G.buildPair(A()), b = G.buildPair(B(item));
  if (!a || !b) return null;
  G.resetScriptCounters();
  const f0 = M.MEDFAILS.stealEatViaClassGuard | 0;
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'owed529:' + tag, {
    script: [{ p1: [{ m: 'bugbite', t: 0 }, { m: 'swordsdance' }], p2: [{ m: 'bulkup' }, { m: 'dragonclaw', t: 0 }] }],
    onBoundary: (snap, t) => { boards.push({ turn: t, diffs: snap.diffs.map(d => BS.locate(d, snap)) }); snap.identical = true; snap.diffs = []; } });
  return { r, boards, sd: G.lastSdLog(), guard: (M.MEDFAILS.stealEatViaClassGuard | 0) - f0, sc: G.scriptCounters() };
}
const EAT = play('eat', 'Sitrus Berry'), CTL = play('ctl', 'Leftovers');
for (const [n, g] of [['eat', EAT], ['control', CTL]]) { if (!g) cannot('buildPair null on the ' + n + ' arm'); if (g.r.err) cannot('the ' + n + ' arm threw: ' + g.r.err); }
const stealeat = g => g.sd.some(l => /^\|-enditem\|p2a: Corviknight\|Sitrus Berry\|\[from\] stealeat/.test(l));
const healed = g => g.sd.some(l => /^\|-heal\|p1a: Scizor\|/.test(l));
if (!stealeat(EAT) || !healed(EAT)) cannot('the authority did not stage the eat (stealeat ' + stealeat(EAT) + ', Scizor healed ' + healed(EAT) + ') — a claim about the fixture');
function judge(name, g, expectRed) {
  const diffs = [].concat(...g.boards.map(b => b.diffs.map(d => 'turn ' + b.turn + '  ' + d.path + '   ours ' + JSON.stringify(d.us) + ' / authority ' + JSON.stringify(d.sd))));
  const tagR = expectRed ? '   [expected RED: the knob is armed]' : '';
  console.log('    ' + name + ':  stealeat on the authority ' + stealeat(g) + ', Scizor healed ' + healed(g) + ', MEDFAILS.stealEatViaClassGuard +' + g.guard);
  ok(!diffs.length, '  every board boundary agrees' + tagR, diffs.slice(0, 5).join('\n') || null);
  ok(g.r.div == null, '  the protocol never parts' + tagR, g.r.div ? JSON.stringify(g.r.div).slice(0, 500) : null);
}
judge('CONTROL (Leftovers, nothing to eat)', CTL, false);
judge('EAT ARM (Sitrus Berry)', EAT, KNOB);
console.log('    the fallback fired ' + EAT.guard + ' time(s) on the eat arm — non-zero is the engine leaning on the class guard because the tag is wrong; it reads 0 once #529 regenerates the tag.');

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
