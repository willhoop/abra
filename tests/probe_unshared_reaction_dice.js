#!/usr/bin/env node
/* tests/probe_unshared_reaction_dice.js — THREE DICE ONLY ONE ENGINE DREW, OR DREW AT A DIFFERENT ADDRESS.
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_unshared_reaction_dice.js
 *   ... MEDI_CURE_ROLL_UNGATED=1      (arm A red)   the residual cure die thrown with nobody to cure
 *   ... MEDI_REACTION_DIE_ALWAYS=1    (arm B red)   a 100% contact punish still throws a die
 *   ... MEDI_ALLIES_ADDR_AT_USER=1    (arm C red)   an `allies` move's BeforeMove dice addressed at the user
 * ==================================================================================================
 *
 * 2026-09-19. Three single-game leads off the whole-game differential on release 482e8f5ca701
 * (docs/_reports/2026-09-18-merged-remeasure.md §2), each filed as "dice, one engine only". Staged here,
 * each is a DIE-ADDRESS defect, not a rule defect: the middle arm shares dice by EVENT ADDRESS
 * (`<seed>|<turn>|<category>|<move>|<target slot>|<nth>`, engine/game_differential.js midCtx), so a die
 * one engine throws and the other does not shifts `nth` for every later die at that address, and a die
 * thrown at a different address is an independent coin.
 *
 *   A  Trevenant woke on one engine only (--games 1350, pair-speedctrl ...bo3-2656731493). p1 brought an
 *      Audino with HEALER and Yawn. Champions' Healer is
 *          for (const allyActive of pokemon.adjacentAllies())
 *            if (allyActive.status && this.randomChance(1, 2)) { ... }    data/mods/champions/abilities.ts:46-57
 *      -- the die is thrown ONLY for a statused ally. Shed Skin (`pokemon.hp && pokemon.status &&
 *      this.randomChance(33, 100)`, data/abilities.ts) is gated the same way. medicham2 threw it every
 *      residual, at `any|-|-`, the same address as the sleep length `slp.onStart` draws with
 *      `this.sample([2, 3, 3])` when Yawn lands -- so the sleep length read the wrong `nth`.
 *   B  Poison Touch on a flinched Scovillain (--games 1950, omit-weather ...bo3-2655370356). The target
 *      was a Scovillain-Mega with SPICY SPRAY, whose handler throws no die at all
 *          if (!source.trySetStatus('brn', target) && ...) this.add('-immune', source);   data/abilities.ts
 *      medicham2 threw one anyway (`rng()` against a cumulative chance of 1), at the same `any|fakeout`
 *      address Poison Touch's `randomChance(3, 10)` uses, so Poison Touch read `nth 1` here and `nth 0`
 *      there.
 *   C  Full paralysis on one engine only (--games 1950, omit-weather ...bo3-2657220134): a paralysed
 *      Sinistcha clicking LIFE DEW (target `allies`). `runMove` resolves `getTarget` -> `getRandomTarget`
 *      -> a RANDOM FOE and calls `setActiveMove(move, pokemon, target)` ABOVE `runEvent('BeforeMove')`
 *      (sim/battle-actions.ts:223, :244, :253); only `useMoveInner` puts an `allies` move back on the
 *      user (:418). So the full-paralysis die is addressed at the drawn foe. medicham2 named the user
 *      from the start.
 *
 * EVERY ARM HAS A CONTROL on which the same die is thrown by BOTH engines, so a green arm is not an arm
 * on which the mechanic never rolled.
 */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '12');
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
const K = { A: process.env.MEDI_CURE_ROLL_UNGATED === '1', B: process.env.MEDI_REACTION_DIE_ALWAYS === '1',
            C: process.env.MEDI_ALLIES_ADDR_AT_USER === '1' };
console.log('\ntests/probe_unshared_reaction_dice.js — three dice only one engine drew'
  + (K.A || K.B || K.C ? '   [KNOB ARMED: ' + Object.keys(K).filter(k => K[k]).join(',') + ']' : ''));

const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat(require('../engine/champions_sim.js').FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const ls = s => (D.species.getLearnsetData(D.species.get(s).id) || {}).learnset || {};
{
  const need = [['audino', ['yawn', 'helpinghand', 'protect']], ['milotic', ['recover', 'protect']],
    ['snorlax', ['curse', 'protect']], ['garchomp', ['swordsdance', 'protect']], ['raichu', ['thunderwave', 'nastyplot', 'protect']],
    ['sneasler', ['fakeout', 'protect']], ['scovillain', ['growth', 'protect']], ['sinistcha', ['lifedew', 'shadowball']]];
  const bad0 = need.filter(([s, ms]) => !legal(D.species.get(s)) || ms.some(m => !ls(s)[m] || !legal(D.moves.get(m))));
  ok(!bad0.length, 'every fixture body is legal and learns its clicks',
     bad0.length ? bad0.map(x => x[0]).join(', ') : need.length + ' bodies checked');
  const abil = (s, a) => Object.values(D.species.get(s).abilities).includes(a);
  ok(abil('audino', 'Healer') && abil('audino', 'Regenerator') && abil('raichu', 'Static') && abil('sneasler', 'Poison Touch')
     && D.species.get('scovillainmega').abilities[0] === 'Spicy Spray' && legal(D.items.get('scovillainite')),
     'Audino may carry Healer or Regenerator, Raichu Static, Sneasler Poison Touch; Scovillain-Mega is Spicy Spray');
  ok(D.moves.get('lifedew').target === 'allies' && D.moves.get('shadowball').target === 'normal',
     'Life Dew targets `allies` (the arm) and Shadow Ball `normal` (its control)');
}

const G = SB.harness();
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...n) => n.map(x => mon(x, '', '', ['Protect']));
const rep = (n, step) => Array.from({ length: n }, () => step);

function play(A, B, script, tag) {
  G.midResetAddresses();
  const a = G.buildPair(A), b = G.buildPair(B);
  const parts = [];
  const r = (!a || !b) ? { err: 'buildPair returned null', turns: 0 } : G.playGame(a, b, 'directed', 'unshared-' + tag,
    { script, onBoundary: (snap, t) => { if ((snap.diffs || []).length) parts.push({ t, d: snap.diffs.slice(0, 4) });
                                        snap.identical = true; snap.diffs = []; } });
  const ad = G.midAddresses();
  return { r, parts, sd: ad.sd.slice(), me: ad.me.slice() };
}
function judge(label, res, pick, expectShared, governed) {
  const sd = res.sd.filter(pick), me = res.me.filter(pick);
  const sdS = new Set(sd), meS = new Set(me);
  const unshared = me.filter(x => !sdS.has(x)).concat(sd.filter(x => !meS.has(x)).map(x => 'sd ' + x));
  const shared = sd.filter(x => meS.has(x)).length;
  console.log('\n  [' + label + ']' + (governed ? '   [expected RED under its knob]' : ''));
  console.log('     played ' + res.r.turns + ' turns' + (res.r.err ? '  ERR ' + res.r.err : '')
    + '   in scope: authority ' + sd.length + ', medicham2 ' + me.length + ', shared ' + shared);
  for (const x of unshared) console.log('       unshared ' + x);
  for (const p of res.parts) console.log('       PART t' + p.t + ' ' + p.d.map(d => d.path + ' me ' + JSON.stringify(d.medicham) + ' sd ' + JSON.stringify(d.showdown)).join('; '));
  ok(!res.r.err, label + ': the arm played its whole script', res.r.err || null);
  if (expectShared) ok(shared > 0, label + ': the die WAS thrown on both engines — the arm is not vacuous', 'shared ' + shared);
  ok(unshared.length === 0, label + ': every die in scope was thrown by BOTH engines at the SAME address',
     unshared.length ? unshared.length + ' unshared' : null);
  ok(res.parts.length === 0, label + ': the boards agree at every turn boundary',
     res.parts.length ? 'parted at t' + res.parts[0].t : null);
}
const isCat = (cat, mv) => x => { const p = String(x).split('|'); return p[2] === cat && (mv == null || p[3] === mv); };

/* ---- A. THE RESIDUAL CURE DIE ------------------------------------------------------------------- */
{
  const P1 = ab => [mon('audino', '', ab, ['Yawn', 'Helping Hand', 'Protect']), mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect'])].concat(FILL('toxapex', 'corviknight'));
  const P2 = () => [mon('snorlax', '', 'Thick Fat', ['Curse', 'Protect']), mon('garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect'])].concat(FILL('incineroar', 'gholdengo'));
  const S = [{ p1: [{ m: 'yawn', t: 0 }, { m: 'recover' }], p2: [{ m: 'curse' }, { m: 'swordsdance' }] }]
    .concat(rep(4, { p1: [{ m: 'helpinghand' }, { m: 'recover' }], p2: [{ m: 'curse' }, { m: 'swordsdance' }] }));
  judge('A healer, nobody statused — Yawn lands on the foe', play(P1('Healer'), P2(), S, 'healer'), isCat('any', '-'), true, K.A);
  /* CONTROL: the ally IS statused, so both engines throw Healer's die. */
  const P2c = () => [mon('snorlax', '', 'Thick Fat', ['Curse', 'Protect']), mon('raichu', '', 'Static', ['Thunder Wave', 'Nasty Plot', 'Protect'])].concat(FILL('incineroar', 'gholdengo'));
  const Sc = [{ p1: [{ m: 'helpinghand' }, { m: 'recover' }], p2: [{ m: 'curse' }, { m: 'thunderwave', t: 1 }] }]
    .concat(rep(4, { p1: [{ m: 'helpinghand' }, { m: 'recover' }], p2: [{ m: 'curse' }, { m: 'nastyplot' }] }));
  judge('A control: healer beside a PARALYSED ally', play(P1('Healer'), P2c(), Sc, 'healer-ctl'), isCat('any', '-'), true, false);
}
/* ---- B. A 100% CONTACT PUNISH THROWS NO DIE ----------------------------------------------------- */
{
  const P1 = () => [mon('sneasler', '', 'Poison Touch', ['Fake Out', 'Protect']), mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect'])].concat(FILL('toxapex', 'corviknight'));
  const Sp = [mon('scovillain', 'Scovillainite', 'Chlorophyll', ['Growth', 'Protect']), mon('garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect'])].concat(FILL('incineroar', 'gholdengo'));
  const S = [{ p1: [{ m: 'fakeout', t: 0 }, { m: 'recover' }], p2: [{ m: 'growth', mega: true }, { m: 'swordsdance' }] },
             { p1: [{ m: 'protect' }, { m: 'recover' }], p2: [{ m: 'growth' }, { m: 'swordsdance' }] }];
  judge('B Poison Touch Fake Out into a Spicy Spray mega', play(P1(), Sp, S, 'spicy'), isCat('any', 'fakeout'), true, K.B);
  /* CONTROL: Static is a 30% punish -- a real die on both engines. */
  const St = [mon('raichu', '', 'Static', ['Nasty Plot', 'Protect']), mon('garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect'])].concat(FILL('incineroar', 'gholdengo'));
  const Sc = [{ p1: [{ m: 'fakeout', t: 0 }, { m: 'recover' }], p2: [{ m: 'nastyplot' }, { m: 'swordsdance' }] },
              { p1: [{ m: 'protect' }, { m: 'recover' }], p2: [{ m: 'nastyplot' }, { m: 'swordsdance' }] }];
  judge('B control: the same Fake Out into a Static body', play(P1(), St, Sc, 'static'), isCat('any', 'fakeout'), true, false);
}
/* ---- C. AN `allies` MOVE'S BEFOREMOVE DICE ------------------------------------------------------ */
{
  const P1 = () => [mon('raichu', '', 'Static', ['Thunder Wave', 'Nasty Plot', 'Protect']), mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect'])].concat(FILL('toxapex', 'corviknight'));
  const P2 = () => [mon('sinistcha', '', 'Heatproof', ['Life Dew', 'Shadow Ball', 'Protect']), mon('snorlax', '', 'Thick Fat', ['Curse', 'Protect'])].concat(FILL('incineroar', 'gholdengo'));
  const S = [{ p1: [{ m: 'thunderwave', t: 0 }, { m: 'protect' }], p2: [{ m: 'lifedew' }, { m: 'curse' }] }]
    .concat(rep(8, { p1: [{ m: 'nastyplot' }, { m: 'recover' }], p2: [{ m: 'lifedew' }, { m: 'curse' }] }));
  judge('C a paralysed body clicking Life Dew', play(P1(), P2(), S, 'lifedew'), isCat('any', 'lifedew'), true, K.C);
  const Sc = [{ p1: [{ m: 'thunderwave', t: 0 }, { m: 'protect' }], p2: [{ m: 'lifedew' }, { m: 'curse' }] }]
    .concat(rep(8, { p1: [{ m: 'nastyplot' }, { m: 'recover' }], p2: [{ m: 'shadowball', t: 1 }, { m: 'curse' }] }));
  judge('C control: the same body clicking single-target Shadow Ball', play(P1(), P2(), Sc, 'shadowball'), isCat('any', 'shadowball'), true, false);
}
console.log('\n  counters: cureRollSkippedNoStatus ' + M.MEDSEEN.cureRollSkippedNoStatus
  + '   reactionDieSkippedCertain ' + M.MEDSEEN.reactionDieSkippedCertain
  + '   alliesAddrAtDrawnFoe ' + M.MEDSEEN.alliesAddrAtDrawnFoe);
ok(K.A || M.MEDSEEN.cureRollSkippedNoStatus > 0, 'the residual cure gate actually skipped a die (counter moved)');
ok(K.B || M.MEDSEEN.reactionDieSkippedCertain > 0, 'the certain punish actually skipped its die (counter moved)');
ok(K.C || M.MEDSEEN.alliesAddrAtDrawnFoe > 0, 'an `allies` action was addressed at its drawn foe (counter moved)');
console.log('\n' + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
