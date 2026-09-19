#!/usr/bin/env node
/* tests/probe_future_sight_doll.js — A FUTURE SIGHT PAYOUT AGAINST A SUBSTITUTE, ON BOTH ENGINES.
 *   SHOWDOWN_PATH=... node tests/probe_future_sight_doll.js
 * ==================================================================================================
 *
 * 2026-09-18. Found while checking the SUBSTITUTE half of `ignoresScreensAndSubs` on the one road the
 * census had never staged it on: the delayed payout. This engine landed every payout on the BODY behind a
 * doll; the authority sends it to the doll.
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 *   data/conditions.ts:407-409   if (data.source.hasAbility('infiltrator') && this.gen >= 6)
 *                                  data.moveData.infiltrates = true;
 *   data/conditions.ts:415       this.actions.trySpreadMoveHit([target], data.source, hitMove, true);
 *   data/moves.ts:18336          substitute.onTryPrimaryHit:
 *                                  if (target === source || move.flags['bypasssub'] || move.infiltrates) return;
 *   data/moves.ts:6413           futuresight's booked moveData.flags: { allyanim, metronome, futuremove } — no bypasssub
 *   sim/pokemon.ts:865           ignoringAbility(): if (this.battle.gen >= 5 && !this.isActive) return true;
 *
 * So: a doll absorbs the payout; an ACTIVE Infiltrator booker's payout reaches the body; a BENCHED
 * Infiltrator booker's does not, because `hasAbility` is false off the field. Champions overrides none of
 * futuremove, futuresight or substitute — asserted below from the mod files.
 *
 * ================= THE ARMS =====================================================================
 *
 *   control   Meowstic-F (Keen Eye) books; the target clicks Swords Dance on turn 2 — no doll.
 *   doll      the same, the target clicks Substitute on turn 2.
 *   inf       the booker carries INFILTRATOR and stays in.
 *   benched   the booker carries INFILTRATOR and SWITCHES OUT on turn 2.
 *
 * The read is the body's HP lost on the payout turn and the doll's HP before and after it. BOTH ENGINES
 * BUILD THE SAME BODIES — Serious, 0 SP in every stat, the same abilities and moves — so the ABSOLUTE
 * numbers must agree, not only where the payout landed. (Corrected 2026-09-18 on the coordinator's
 * catch: the first draft handed the authority `evs: 84`, which the Champions `statModify` reads as 84 SP
 * per stat (data/mods/champions/scripts.ts:24-27, `hp = base + evs + 75` -> a 267-HP Garchomp, doll 66),
 * illegal against the 32 cap; and it multiplied this engine's Garchomp HP by 8 (183 -> 1464, doll 366).
 * Neither number was an engine fact.)
 */
'use strict';
const path = require('path');
const fs = require('fs');
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
const SD = process.env.SHOWDOWN_PATH;

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
console.log('\n  FUTURE SIGHT PAYOUT vs SUBSTITUTE — both engines, identical fixtures, pinned dice\n');

{
  const modMoves = fs.readFileSync(SD + '/data/mods/champions/moves.ts', 'utf8');
  const modCond = fs.readFileSync(SD + '/data/mods/champions/conditions.ts', 'utf8');
  const modAb = fs.readFileSync(SD + '/data/mods/champions/abilities.ts', 'utf8');
  const over = ['futuresight', 'substitute', 'swordsdance'].filter(id => modMoves.includes('\n\t' + id + ': {'));
  ok(over.length === 0 && !modCond.includes('\n\tfuturemove:') && !modAb.includes('\n\tinfiltrator:'),
     'Champions overrides none of futuresight, substitute, swordsdance (Protect is only the idle click and is not asserted), the futuremove condition or infiltrator',
     over.length ? 'overridden: ' + over.join(', ') : 'mainline handlers govern');
  const fsm = dex.moves.get('futuresight');
  ok(!fsm.flags.bypasssub, 'Future Sight carries no bypasssub flag, so only `infiltrates` can take the payout past the doll',
     JSON.stringify(fsm.flags));
}
{
  const ls = sp => (dex.species.getLearnsetData(dex.species.get(sp).id) || {}).learnset || {};
  const checks = [
    [legal(dex.species.get('meowsticf')), 'Meowstic-F is legal'],
    [Object.values(dex.species.get('meowsticf').abilities).includes('Infiltrator')
      && Object.values(dex.species.get('meowsticf').abilities).includes('Keen Eye'), 'Meowstic-F may carry Infiltrator and Keen Eye'],
    [!!ls('meowsticf').futuresight && !!ls('meowsticf').protect, 'Meowstic-F learns Future Sight and Protect'],
    [!!ls('garchomp').substitute && !!ls('garchomp').swordsdance, 'Garchomp learns Substitute and Swords Dance'],
    [['futuresight', 'substitute', 'swordsdance', 'protect'].every(id => legal(dex.moves.get(id))), 'every click is a legal move'],
    [dex.getImmunity('Psychic', dex.species.get('garchomp').types), 'Psychic is not immune into Garchomp'],
  ];
  const failed = checks.filter(c => !c[0]).map(c => c[1]);
  ok(failed.length === 0, 'every fixture body, ability and click is legal in this format', failed.length ? 'FAILED: ' + failed.join('; ') : checks.length + ' derived facts checked');
}

/* ---- THE AUTHORITY -------------------------------------------------------------------------- */
const body = (sp, ability, moves) => ({ name: '', species: dex.species.get(sp).name, item: '', ability, moves,
  nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: {}, level: 50 });
function newBattle(p1, p2) {
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  /* THE DAMAGE ROLL IS READ IN THIS ENGINE'S ORIENTATION. The authority's randomizer takes
   * `100 - this.random(16)` (sim/battle.ts:2390); this engine turns its die u into roll
   * `15 - floor(16u)` (engine/medicham2-browser.js `damageRollIndex`). A naive `floor(16f)` stub is the
   * MIRROR of that, so at one pinned constant the two engines picked rolls 8 and 7 and the payout read
   * 72 against 73 -- and a direct Psychic off the same bodies read 54 against 55, the same offset, which
   * is what says it was the stub and not the payout. Only `random(16)` is mirrored; every other draw
   * (crit, accuracy, ties) is left as it was. */
  battle.prng.random = function pinned(m, n) {
    const frac = 0.5;
    if (m === 16 && n === undefined) return 15 - Math.min(15, Math.floor(frac * 16));
    if (n === undefined) { if (m === undefined) return frac; return Math.min(m - 1, Math.floor(frac * m)); }
    return m + Math.min(n - m - 1, Math.floor(frac * (n - m)));
  };
  battle.setPlayer('p1', { name: 'a', team: Teams.pack(p1) });
  battle.setPlayer('p2', { name: 'b', team: Teams.pack(p2) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  return battle;
}
function authorityArm(ab, doll, bench) {
  const p1 = [body('meowsticf', ab, ['Future Sight', 'Protect']), body('incineroar', 'Blaze', ['Protect']),
              body('snorlax', 'Thick Fat', ['Protect']), body('milotic', 'Competitive', ['Protect'])];
  const p2 = [body('garchomp', 'Rough Skin', ['Swords Dance', 'Substitute']), body('incineroar', 'Blaze', ['Protect']),
              body('snorlax', 'Thick Fat', ['Protect']), body('milotic', 'Competitive', ['Protect'])];
  const b = newBattle(p1, p2);
  b.makeChoices('move 1 1, move 1', 'move 1, move 1');
  b.makeChoices((bench ? 'switch 3' : 'move 2') + ', move 1', 'move ' + (doll ? 2 : 1) + ', move 1');
  const t = b.p2.active[0];
  const hp = t.hp, s0 = t.volatiles.substitute ? t.volatiles.substitute.hp : 0;
  b.makeChoices((bench ? 'move 1' : 'move 2') + ', move 1', 'move 1, move 1');
  return { body: hp - t.hp, s0, s1: t.volatiles.substitute ? t.volatiles.substitute.hp : 0 };
}

/* ---- THIS ENGINE ------------------------------------------------------------------------------ */
/* THE SAME BODY THE AUTHORITY BUILDS: `buildMonFromSet`, Serious, 0 SP, the same ability and moves. */
const Z = { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 };
const same = (sp, ab, moves) => {
  const x = M.buildMonFromSet({ species: dex.species.get(sp).name, item: '', ability: ab, nature: 'Serious', sp: Z, moves });
  if (!x) throw new Error('buildMonFromSet refused ' + sp);
  x.item = ''; return x;
};
const PASS2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);
function mediArm(ab, doll, bench) {
  const me = same('meowsticf', ab, ['Future Sight', 'Protect']), ally = same('incineroar', 'Blaze', ['Protect']),
        sub = same('snorlax', 'Thick Fat', ['Protect']);
  const f1 = same('garchomp', 'Rough Skin', ['Swords Dance', 'Substitute']), f2 = same('incineroar', 'Blaze', ['Protect']);
  const S = M.battleInit([me, ally, sub], [f1, f2], { seeded: true });
  const rng = () => 0.5;
  M.battleTurn(S, rng, new Map([[me, M.playerAction(me, 'futuresight', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  M.battleTurn(S, rng, new Map([[me, bench ? { kind: 'switch', to: sub } : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
    new Map([[f1, M.playerAction(f1, doll ? 'substitute' : 'swordsdance', null, S.field)], [f2, { kind: 'pass' }]]));
  const hp = f1.curHP, s0 = f1._sub || 0;
  const mine = bench ? sub : me;
  M.battleTurn(S, rng, PASS2(mine, ally), PASS2(f1, f2));
  return { body: hp - f1.curHP, s0, s1: f1._sub || 0 };
}

const ARMS = [
  ['control', 'Keen Eye', 'Keen Eye', false, false],
  ['doll', 'Keen Eye', 'Keen Eye', true, false],
  ['inf', 'Infiltrator', 'Infiltrator', true, false],
  ['benched', 'Infiltrator', 'Infiltrator', true, true],
];
const A = {}, E = {};
for (const [k, aAb, eAb, doll, bench] of ARMS) { A[k] = authorityArm(aAb, doll, bench); E[k] = mediArm(eAb, doll, bench); }
const fmt = x => 'body -' + x.body + ', doll ' + x.s0 + ' -> ' + x.s1;
for (const k of Object.keys(A)) console.log('  ' + k.padEnd(8) + ' authority [' + fmt(A[k]) + ']   medicham2 [' + fmt(E[k]) + ']');
console.log('');
const where = x => x.s0 === 0 ? (x.body > 0 ? 'body' : 'nowhere') : (x.body > 0 && x.s1 === x.s0 ? 'body' : (x.body === 0 && x.s1 < x.s0 ? 'doll' : 'both?'));
const want = { control: 'body', doll: 'doll', inf: 'body', benched: 'doll' };
ok(Object.keys(want).every(k => where(A[k]) === want[k]),
   'AUTHORITY — no doll: body; doll: doll; active Infiltrator booker: body; BENCHED Infiltrator booker: doll',
   Object.keys(want).map(k => k + '=' + where(A[k])).join(', '));
ok(Object.keys(want).every(k => where(E[k]) === where(A[k])),
   'MEDICHAM2 — the payout lands on the same thing in every arm  (BOARDS MATCH)',
   Object.keys(want).map(k => k + '=' + where(E[k])).join(', '));
ok(Object.keys(want).every(k => A[k].body === E[k].body && A[k].s0 === E[k].s0 && A[k].s1 === E[k].s1),
   'IDENTICAL BODIES — the payout, the doll before and the doll after are the SAME NUMBERS on both engines, arm by arm',
   Object.keys(want).map(k => k + ' ' + A[k].body + '/' + A[k].s0 + '->' + A[k].s1 + ' vs ' + E[k].body + '/' + E[k].s0 + '->' + E[k].s1).join('; '));
ok(A.inf.body === A.control.body && E.inf.body === E.control.body,
   'the Infiltrator payout through the doll is the full unscreened number on both engines',
   'authority ' + A.control.body + ' / ' + A.inf.body + ', medicham2 ' + E.control.body + ' / ' + E.inf.body);

console.log('\n  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
