#!/usr/bin/env node
/* tests/probe_pp_pressure_redirect.js — PRESSURE IS CHARGED OFF THE BODY THE MOVE WAS REDIRECTED TO.
 *   SHOWDOWN_PATH=... node tests/probe_pp_pressure_redirect.js
 *   SHOWDOWN_PATH=... MEDI_PP_PRESSURE_PRE_REDIRECT=1 node tests/probe_pp_pressure_redirect.js   (the red)
 * ==================================================================================================
 *
 * 2026-09-19. The one board-material game on release 482e8f5ca701 with NO protocol divergence at all:
 * `pair-protect-bust ...bo3-2663649758 vs ...bo3-2663889962` (--games 1950, t9), `p2.pp[0].thunderbolt`
 * medicham 2 / showdown 1. The field is PP SPENT (`ppSpentMap`). p2's Farigiraf carries Thunderbolt;
 * p1 brought a Pressure Weavile beside a Lightning Rod Manectric (read off the pinned pool's sheets).
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 *   sim/battle-actions.ts:466   const { targets, pressureTargets } = pokemon.getMoveTargets(move, target);
 *   sim/pokemon.ts (getMoveTargets, default:)   target = this.battle.priorityEvent('RedirectTarget', ...)
 *                               ... pressureTargets = targets   (for every target word but foeSide)
 *   sim/battle-actions.ts:474-482   for (const source of pressureTargets) runEvent('DeductPP', source, ...)
 *   data/abilities.ts pressure.onDeductPP   if (target.isAlly(source)) return; return 1;
 *
 * So Pressure is charged off the body the move ends up aimed at AFTER redirection. A Thunderbolt aimed
 * at a Pressure body and drawn into a Lightning Rod costs ONE PP. medicham2 charged it at the top of the
 * action off the SLOT (`reaimToSlot`), and the attack branch's redirect runs hundreds of lines later, so
 * the price was the aimed body's. (A non-attack click is already redirected ABOVE the PP site, by
 * rewriting its target; that road is the negative arm below.)
 *
 * ================= THE ARMS — ONE KNOB VARIED IN EACH ===========================================
 *   rod+pressure   Weavile (Pressure) aimed at, Manectric (Lightning Rod) beside it   -> authority 1
 *   static+press.  the same with Manectric on Static — no draw, Pressure charged        -> authority 2
 *   rod+pickpocket the draw with no Pressure anywhere                                  -> authority 1
 *   status-road    Farigiraf clicks a single-target STATUS move instead — already right before the fix
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
const KNOB = process.env.MEDI_PP_PRESSURE_PRE_REDIRECT === '1';
console.log('\n  PRESSURE vs A REDIRECTED CLICK — both engines' + (KNOB ? '   [RESTORE KNOB ARMED]' : '') + '\n');

/* a single-target Electric status move Farigiraf learns, derived rather than named */
const ls = sp => (dex.species.getLearnsetData(dex.species.get(sp).id) || {}).learnset || {};
const STATUS_E = Object.keys(ls('farigiraf')).map(id => dex.moves.get(id))
  .filter(m => legal(m) && m.type === 'Electric' && m.category === 'Status' && m.target === 'normal')
  .map(m => m.id).sort()[0] || null;
{
  const checks = [
    [['farigiraf', 'toxapex', 'weavile', 'manectric'].every(s => legal(dex.species.get(s))), 'every fixture species is legal'],
    [!!ls('farigiraf').thunderbolt && !!ls('farigiraf').protect, 'Farigiraf learns Thunderbolt and Protect'],
    [!!ls('weavile').swordsdance && !!ls('manectric').protect && !!ls('toxapex').protect, 'the idle clicks are learnable'],
    [Object.values(dex.species.get('weavile').abilities).includes('Pressure')
     && Object.values(dex.species.get('weavile').abilities).includes('Pickpocket'), 'Weavile may carry Pressure or Pickpocket'],
    [Object.values(dex.species.get('manectric').abilities).includes('Lightning Rod')
     && Object.values(dex.species.get('manectric').abilities).includes('Static'), 'Manectric may carry Lightning Rod or Static'],
    [!!STATUS_E, 'Farigiraf learns a single-target Electric STATUS move (' + STATUS_E + ')'],
  ];
  const failed = checks.filter(c => !c[0]).map(c => c[1]);
  ok(failed.length === 0, 'every fixture body, ability and click is legal', failed.length ? 'FAILED: ' + failed.join('; ') : checks.length + ' derived facts checked');
}

const FRAC = 0.1;
const body = (sp, ability, moves) => ({ name: '', species: dex.species.get(sp).name, item: '', ability, moves,
  nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: {}, level: 50 });
function authority(move, weav, mane) {
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.prng.random = function pinned(m, n) {
    if (m === 16 && n === undefined) return 15 - Math.min(15, Math.floor(FRAC * 16));
    if (n === undefined) { if (m === undefined) return FRAC; return Math.min(m - 1, Math.floor(FRAC * m)); }
    return m + Math.min(n - m - 1, Math.floor(FRAC * (n - m)));
  };
  const mvName = dex.moves.get(move).name;
  b.setPlayer('p1', { name: 'a', team: Teams.pack([body('farigiraf', 'Cud Chew', [mvName, 'Protect']), body('toxapex', 'Limber', ['Protect'])]) });
  b.setPlayer('p2', { name: 'b', team: Teams.pack([body('weavile', weav, ['Swords Dance']), body('manectric', mane, ['Protect'])]) });
  if (b.requestState === 'teampreview') { b.choose('p1', 'team 12'); b.choose('p2', 'team 12'); }
  const w = b.p2.active[0], hp0 = w.hp;
  b.makeChoices('move 1 1, move 1', 'move 1, move 1');
  const slot = b.p1.active[0].moveSlots.find(s => s.id === move);
  return { spent: slot.maxpp - slot.pp, weavileHit: hp0 - w.hp };
}
const Z = { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 };
const same = (sp, ab, moves) => {
  const x = M.buildMonFromSet({ species: dex.species.get(sp).name, item: '', ability: ab, nature: 'Serious', sp: Z, moves });
  if (!x) throw new Error('buildMonFromSet refused ' + sp);
  x.item = ''; return x;
};
function medicham(move, weav, mane) {
  const f = same('farigiraf', 'Cud Chew', [move, 'Protect']), t = same('toxapex', 'Limber', ['Protect']);
  const w = same('weavile', weav, ['Swords Dance']), mn = same('manectric', mane, ['Protect']);
  const S = M.battleInit([f, t], [w, mn], { seeded: true });
  const hp0 = w.curHP;
  M.battleTurn(S, () => FRAC,
    new Map([[f, M.playerAction(f, move, w, S.field)], [t, M.playerAction(t, 'protect', null, S.field)]]),
    new Map([[w, M.playerAction(w, 'swordsdance', null, S.field)], [mn, M.playerAction(mn, 'protect', null, S.field)]]));
  const sp = M.ppSpentMap(f) || {};
  return { spent: sp[move] || 0, weavileHit: hp0 - w.curHP };
}

const ARMS = [
  ['rod+pressure', 'thunderbolt', 'Pressure', 'Lightning Rod'],
  ['static+pressure', 'thunderbolt', 'Pressure', 'Static'],
  ['rod+pickpocket', 'thunderbolt', 'Pickpocket', 'Lightning Rod'],
  ['status-road', STATUS_E, 'Pressure', 'Lightning Rod'],
];
const A = {}, E = {};
for (const [k, mv, wv, mn] of ARMS) { A[k] = authority(mv, wv, mn); E[k] = medicham(mv, wv, mn); }
const f = x => 'PP spent ' + x.spent + ', Weavile took ' + x.weavileHit;
for (const [k] of ARMS) console.log('     ' + k.padEnd(16) + ' authority [' + f(A[k]) + ']   medicham2 [' + f(E[k]) + ']');
console.log('');
ok(A['rod+pressure'].spent === 1 && A['rod+pressure'].weavileHit === 0 && A['static+pressure'].spent === 2
   && A['static+pressure'].weavileHit > 0 && A['rod+pickpocket'].spent === 1 && A['status-road'].spent === 1,
   'AUTHORITY — the rod draws the click and Pressure is NOT charged; without the draw it is');
ok(ARMS.every(([k]) => E[k].spent === A[k].spent && E[k].weavileHit === A[k].weavileHit),
   'MEDICHAM2 — the same PP and the same body hit in every arm  (BOARDS MATCH)',
   ARMS.map(([k]) => k + ' ' + E[k].spent + '/' + A[k].spent).join(', '));

console.log('\n  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
