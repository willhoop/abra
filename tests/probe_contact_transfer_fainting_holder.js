#!/usr/bin/env node
/* tests/probe_contact_transfer_fainting_holder.js — ROADMAP #541, the fainting-holder half.
 * ==================================================================================================
 * WHEN A CONTACT HIT KOs A WANDERING SPIRIT HOLDER, DOES THE ACQUIRED ABILITY STILL START?
 *
 * `wanderingspirit.onDamagingHit` calls `Battle#skillSwap(source, target)`, which refuses on
 * `source.fainted || target.fainted`. `fainted` is written by `faintMessages()` AFTER the move, so a
 * holder this very hit took to 0 HP is still `fainted: false` when the swap runs: the attacker's
 * Intimidate lands on the holder and STARTS, dropping the attacker's side's Attack. The pool card:
 * Scrafty's Knock Off KOs Runerigus, the swap is announced, the authority lowers both p2 bodies'
 * Attack, and this engine (which refused on `curHP <= 0`) did nothing.
 *
 * THE RELEASE UNDER TEST ALREADY CARRIES A FIX DATED 2026-09-11 (medicham2-browser.js, `_abStart`,
 * `_faintOut === false`), and the knob `MEDI_ACQUIRED_START_NEEDS_HP=1` restores the refusal. So the
 * expectation is GREEN on the release and RED under the knob — if that holds, the row's remaining
 * half is REFUTED on this release, and this probe is its decider. tests/probe_contact_ability_transfer.js
 * covers the announcement and the live-holder swap; this file stages only the fainting holder.
 *
 * BOTH ENGINES, THE SAME TURNS, SHOWDOWN IS THE EXPECTATION. Played through tests/staged_board.js's
 * harness on the pinned release; the board is compared at every turn boundary and the protocol by the
 * driver's own aligner. Nothing here types an expected value.
 *
 *   KO ARM     Hydreigon softens Runerigus with a NON-contact special move for k turns, then Scrafty
 *              (Intimidate) Knock Offs it to 0. Selected ON THE AUTHORITY: the Skill Swap activation
 *              and Runerigus's faint must both follow the Knock Off in the same turn.
 *   CONTROL    the same softening, and the KO delivered by Hydreigon's non-contact move instead: no
 *              swap, no Intimidate, and both engines must agree on that too. One variable: who lands
 *              the last hit.
 * Fixture legality is derived from the format's TeamValidator and printed.
 * EXIT: 0 green / 1 red / 2 cannot answer (no board staged the case).
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
const KNOB = process.env.MEDI_ACQUIRED_START_NEEDS_HP === '1';

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const BS = require(path.join(ROOT, 'engine', 'board_state.js'));
const G = SB.harness();
const RID = (G.REL && G.REL.id) || '?';
console.log('\ntests/probe_contact_transfer_fainting_holder.js — ROADMAP #541 (fainting holder)   release ' + RID
  + '   MEDI_ACQUIRED_START_NEEDS_HP=' + (KNOB ? '1  (THE REFUSAL RESTORED — expected RED)' : '0'));
if (RID !== REL_ID) cannot('the driver opened release ' + RID + ', not ' + REL_ID);
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });

/* ---- LEGALITY, ASKED OF THE FORMAT --------------------------------------------------------------- */
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
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const SOFT = ['Dragon Pulse', 'Dark Pulse'].filter(mv => !problems(mon('hydreigon', '', 'Levitate', [mv])).length && !DX.moves.get(mv).flags.contact);
const A = () => [mon('runerigus', '', 'Wandering Spirit', ['Calm Mind', 'Protect', 'Shadow Claw']),
                 mon('snorlax', '', 'Thick Fat', ['Curse', 'Protect']),
                 mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect']), mon('toxapex', '', 'Limber', ['Recover', 'Protect'])];
const B = () => [mon('scrafty', '', 'Intimidate', ['Knock Off', 'Bulk Up', 'Protect']),
                 mon('hydreigon', '', 'Levitate', SOFT.concat(['Nasty Plot', 'Protect'])),
                 mon('garchomp', '', 'Sand Veil', ['Protect']), mon('corviknight', '', 'Pressure', ['Protect'])];
const bad0 = [].concat(...A().map(problems), ...B().map(problems));
console.log('  fixture legality (TeamValidator): ' + (bad0.length ? bad0.join('; ') : 'every body, ability and move is legal'));
if (bad0.length) cannot('the fixture is not legal: ' + bad0.join('; '));
if (!DX.moves.get('knockoff').flags.contact) cannot('Knock Off does not make contact in this format');
if (!SOFT.length) cannot('Hydreigon has no legal non-contact softener');

/* ---- ONE GAME, BOTH ENGINES ---------------------------------------------------------------------- */
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function play(tag, script) {
  const a = G.buildPair(A()), b = G.buildPair(B());
  if (!a || !b) return null;
  G.resetScriptCounters();
  const seen0 = M.MEDSEEN.acquiredStartAtZeroHP | 0;
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'owed541:' + tag, { script,
    onBoundary: (snap, t) => { boards.push({ turn: t, diffs: snap.diffs.map(d => BS.locate(d, snap)) }); snap.identical = true; snap.diffs = []; } });
  return { tag, r, boards, sd: G.lastSdLog(), sc: G.scriptCounters(), atZero: (M.MEDSEEN.acquiredStartAtZeroHP | 0) - seen0 };
}
/* the authority's stream for the LAST scripted turn, and whether the case was staged */
function lastTurn(sd, n) { const i = sd.lastIndexOf('|turn|' + n); return i >= 0 ? sd.slice(i) : []; }
function koByContact(g, n) {
  const t = lastTurn(g.sd, n);
  const iMove = t.findIndex(l => /^\|move\|p2a: Scrafty\|Knock Off\|p1a: Runerigus/.test(l));
  const iSwap = t.findIndex(l => /^\|-activate\|p2a: Scrafty\|Skill Swap\|/.test(l));
  const iFaint = t.findIndex(l => /^\|faint\|p1a: Runerigus/.test(l));
  return iMove >= 0 && iSwap > iMove && iFaint > iSwap
    && !g.sd.slice(0, g.sd.lastIndexOf('|turn|' + n)).some(l => /^\|faint\|p1a: Runerigus/.test(l));
}
function koByHydreigon(g, n) {
  const t = lastTurn(g.sd, n);
  return t.some(l => /^\|faint\|p1a: Runerigus/.test(l)) && !t.some(l => /Skill Swap/.test(l))
    && !g.sd.slice(0, g.sd.lastIndexOf('|turn|' + n)).some(l => /^\|faint\|p1a: Runerigus/.test(l));
}
const soften = (s) => ({ p1: [{ m: 'calmmind' }, { m: 'curse' }], p2: [{ m: 'bulkup' }, { m: id(s), t: 0 }] });
let KO = null, CTL = null;
const tried = [];
for (const s of SOFT) for (let k = 1; k <= 3 && !(KO && CTL); k++) {
  const pre = Array.from({ length: k }, () => soften(s));
  if (!KO) {
    const g = play('ko-' + id(s) + '-' + k, pre.concat([{ p1: [{ m: 'calmmind' }, { m: 'curse' }], p2: [{ m: 'knockoff', t: 0 }, { m: 'nastyplot' }] }]));
    const hit = g && !g.r.err && koByContact(g, k + 1);
    tried.push('ko   ' + s + ' x' + k + ': ' + (g ? (g.r.err ? 'threw ' + g.r.err : hit ? 'STAGED' : 'not staged') : 'buildPair null'));
    if (hit) KO = { g, s, k };
  }
  if (!CTL) {
    const g = play('ctl-' + id(s) + '-' + k, pre.concat([{ p1: [{ m: 'calmmind' }, { m: 'curse' }], p2: [{ m: 'bulkup' }, { m: id(s), t: 0 }] }]));
    const hit = g && !g.r.err && koByHydreigon(g, k + 1);
    tried.push('ctl  ' + s + ' x' + k + ': ' + (g ? (g.r.err ? 'threw ' + g.r.err : hit ? 'STAGED' : 'not staged') : 'buildPair null'));
    if (hit) CTL = { g, s, k };
  }
}
console.log('\n  CANDIDATE BOARDS (selected on the authority\'s stream):');
for (const t of tried) console.log('      ' + t);
if (!KO) cannot('no candidate board had Scrafty\'s Knock Off KO the holder with a Skill Swap first — a claim about the fixture');

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
function verdict(name, X, expectRed) {
  const g = X.g, n = X.k + 1;
  console.log('\n  ' + name + ' — softener ' + X.s + ' x' + X.k + ', KO on turn ' + n);
  for (const l of lastTurn(g.sd, n).filter(l => /Knock Off|Skill Swap|-unboost|faint\|p1a|-activate/.test(l)).slice(0, 8)) console.log('      sd  ' + l);
  const diffs = [].concat(...g.boards.map(b => b.diffs.map(d => 'turn ' + b.turn + '  ' + d.path + '   ours ' + JSON.stringify(d.us) + ' / authority ' + JSON.stringify(d.sd))));
  ok(!diffs.length, 'every board boundary agrees' + (expectRed ? '   [expected RED: the knob is armed]' : ''), diffs.slice(0, 6).join('\n') || null);
  ok(g.r.div == null, 'the protocol never parts' + (expectRed ? '   [expected RED: the knob is armed]' : ''), g.r.div ? JSON.stringify(g.r.div).slice(0, 600) : null);
  ok(g.sc && g.sc.moveNotOnRequest === 0, 'every scripted click was on the request', g.sc && g.sc.moveNotOnRequest ? 'first missing: ' + g.sc.firstMissing : null);
  return g;
}
const gk = verdict('KO ARM (the row\'s case)', KO, KNOB);
console.log('      MEDSEEN.acquiredStartAtZeroHP this game: +' + gk.atZero + (KNOB ? '' : '   (the engine\'s receipt that it started an ability on a 0-HP holder)'));
if (!KNOB) ok(gk.atZero > 0, 'the engine actually ran the acquired Start on the fainting holder');
if (CTL) verdict('CONTROL (the KO delivered without contact)', CTL, false);
else console.log('\n  CONTROL not staged: no board had Hydreigon land the KO — reported, not counted');

console.log('\n' + (bad ? 'RED — ' + bad + ' check(s)' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
