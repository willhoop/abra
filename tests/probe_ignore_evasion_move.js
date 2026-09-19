#!/usr/bin/env node
/* tests/probe_ignore_evasion_move.js — A MOVE THAT IGNORES EVASION, ON BOTH ENGINES.
 *   SHOWDOWN_PATH=... node tests/probe_ignore_evasion_move.js
 *   SHOWDOWN_PATH=... MEDI_MOVE_EVASION_COUNTED=1 node tests/probe_ignore_evasion_move.js   (the red)
 * ==================================================================================================
 *
 * 2026-09-19. Pinned pool, release 482e8f5ca701, `baseline ...bo3-2658892411` (--games 1950, t5): an
 * Incineroar's Darkest Lariat into a Sandaconda that had Minimized twice. The authority hit it
 * (`-damage 74/147`); this engine wrote `-miss`. Not a die: a RULE.
 *
 *   sim/battle-actions.ts hitStepAccuracy (Champions does not override it):
 *       if (!move.ignoreEvasion) { boost = clampIntRange(boost - boosts['evasion'], -6, 6); }
 *   data/moves.ts  darkestlariat / sacredsword:  ignoreEvasion: true, ignoreDefensive: true
 *
 * `hitChance` said so itself: "`ignoreEvasion` has two moves (Darkest Lariat, Sacred Sword) plus two
 * abilities ... The MOVE half is NOT modelled -- `data/tags.json` gives both moves `ignoresBoosts
 * {defensive:true}` ... That is a separate, named, unfixed defect". This is that defect. The move half
 * now rides on the same tag as a derived `evasion` field (engine/tag_dex.js `ignoresBoosts`).
 *
 * ================= THE ARMS =====================================================================
 *   lariat+4   Darkest Lariat into +4 evasion          the arm: the authority hits
 *   crunch+4   Crunch (no flag) into the same +4       control: both engines miss — the stage is real
 *   lariat0    Darkest Lariat into 0 evasion           control: both hit — the move is not broken
 * One pinned die (0.5): a 100 accuracy hits, the +4-evasion 42 misses.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — the official simulator is absent. This is not a pass.'); process.exit(2); }
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
let bad = 0;
const ok = (c, w, d) => { console.log('  ' + (c ? 'PASS' : 'FAIL') + '  ' + w + (d ? '\n          ' + d : '')); if (!c) bad++; };
console.log('\n  IGNORE-EVASION MOVES — both engines' + (process.env.MEDI_MOVE_EVASION_COUNTED === '1' ? '   [RESTORE KNOB ARMED]' : '') + '\n');

const ls = s => (dex.species.getLearnsetData(dex.species.get(s).id) || {}).learnset || {};
const IE = dex.moves.all().filter(legal).filter(m => m.ignoreEvasion).map(m => m.id).sort();
console.log('  legal moves carrying ignoreEvasion (derived): ' + IE.join(', '));
ok(IE.includes('darkestlariat') && !dex.moves.get('crunch').ignoreEvasion
   && ['incineroar', 'sandaconda', 'toxapex'].every(s => legal(dex.species.get(s)))
   && !!ls('incineroar').darkestlariat && !!ls('incineroar').crunch && !!ls('sandaconda').protect && !!ls('toxapex').protect,
   'Darkest Lariat ignores evasion and Crunch does not; every fixture body is legal and learns its click');
const T = require(D('data', 'tags.json'));
const tagged = Object.keys(T.moves).filter(id => (((T.moves[id] || {}).params || {}).ignoresBoosts || {}).evasion);
ok(JSON.stringify(tagged.sort()) === JSON.stringify(IE),
   'data/tags.json carries `ignoresBoosts.evasion` on exactly the derived set', 'tagged: ' + tagged.join(', '));

const FRAC = 0.5;
const body = (sp, ab, moves) => ({ name: '', species: dex.species.get(sp).name, item: '', ability: ab, moves,
  nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: {}, level: 50 });
function authority(move, eva) {
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.prng.random = function (m, n) {
    if (m === 16 && n === undefined) return 15 - Math.min(15, Math.floor(FRAC * 16));
    if (n === undefined) { if (m === undefined) return FRAC; return Math.min(m - 1, Math.floor(FRAC * m)); }
    return m + Math.min(n - m - 1, Math.floor(FRAC * (n - m)));
  };
  b.setPlayer('p1', { name: 'a', team: Teams.pack([body('incineroar', 'Blaze', [dex.moves.get(move).name, 'Protect']), body('toxapex', 'Limber', ['Protect'])]) });
  b.setPlayer('p2', { name: 'b', team: Teams.pack([body('sandaconda', 'Sand Spit', ['Protect', 'Coil']), body('toxapex', 'Limber', ['Protect'])]) });
  if (b.requestState === 'teampreview') { b.choose('p1', 'team 12'); b.choose('p2', 'team 12'); }
  const t = b.p2.active[0]; t.boosts.evasion = eva; const hp = t.hp;
  b.makeChoices('move 1 1, move 1', 'move 2, move 1');
  return hp - t.hp;
}
const Z = { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 };
const same = (sp, ab, moves) => { const x = M.buildMonFromSet({ species: dex.species.get(sp).name, item: '', ability: ab, nature: 'Serious', sp: Z, moves }); x.item = ''; return x; };
function medicham(move, eva) {
  const a = same('incineroar', 'Blaze', [move, 'Protect']), a2 = same('toxapex', 'Limber', ['Protect']);
  const t = same('sandaconda', 'Sand Spit', ['Protect', 'Coil']), t2 = same('toxapex', 'Limber', ['Protect']);
  const S = M.battleInit([a, a2], [t, t2], { seeded: true });
  t.boosts.eva = eva; const hp = t.curHP;
  M.battleTurn(S, () => FRAC, new Map([[a, M.playerAction(a, move, t, S.field)], [a2, M.playerAction(a2, 'protect', null, S.field)]]),
    new Map([[t, M.playerAction(t, 'coil', null, S.field)], [t2, M.playerAction(t2, 'protect', null, S.field)]]));
  return hp - t.curHP;
}
const ARMS = [['lariat+4', 'darkestlariat', 4], ['crunch+4', 'crunch', 4], ['lariat0', 'darkestlariat', 0]];
const A = {}, E = {};
for (const [k, mv, ev] of ARMS) { A[k] = authority(mv, ev); E[k] = medicham(mv, ev); }
for (const [k] of ARMS) console.log('     ' + k.padEnd(9) + ' authority dealt ' + A[k] + '   medicham2 dealt ' + E[k]);
ok(A['lariat+4'] > 0 && A['crunch+4'] === 0 && A['lariat0'] > 0, 'AUTHORITY — the Lariat ignores +4 evasion; Crunch into it misses');
ok(ARMS.every(([k]) => A[k] === E[k]), 'MEDICHAM2 — the same damage in every arm  (BOARDS MATCH)',
   ARMS.map(([k]) => k + ' ' + E[k] + '/' + A[k]).join(', '));
console.log('\n  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
