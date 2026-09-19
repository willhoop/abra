#!/usr/bin/env node
/* tests/probe_gameend_residuals.js — WHAT STILL HAPPENS ON THE TURN THE GAME IS DECIDED, ON BOTH ENGINES.
 *   SHOWDOWN_PATH=... node tests/probe_gameend_residuals.js
 *   SHOWDOWN_PATH=... MEDI_RESIDUAL_STOP_GROUP_ONLY=1 node tests/probe_gameend_residuals.js   (§A red)
 *   SHOWDOWN_PATH=... MEDI_ORB_TOLL_SKIPS_PAYOUT=1   node tests/probe_gameend_residuals.js   (§B red)
 *   SHOWDOWN_PATH=... MEDI_FATIGUE_BERRY_INLINE=1    node tests/probe_gameend_residuals.js   (§C red)
 * ==================================================================================================
 *
 * 2026-09-19. Three single-game leads off the whole-game differential on release 482e8f5ca701
 * (docs/_reports/2026-09-18-merged-remeasure.md §2): a Life Orb chip on Slowking-Galar at game end
 * (--games 1350), a Lum Berry not eaten at game end and a burn chip on Sinistcha at game end (1950). The
 * brief's hypothesis was ONE mechanism — the engines disagreeing about what still happens once the game
 * is decided. READ AGAINST THE AUTHORITY IT IS THREE, and they point in both directions:
 *
 *   §A  THE BURN. `fieldEvent` runs `this.faintMessages(); if (this.ended) return;` after EVERY handler
 *       (sim/battle.ts:565-566), so a burn that takes a side's last body cancels every burn handler
 *       still queued behind it, on EITHER side. medicham2 stopped only at the top of the next GROUP
 *       (its own comment called the difference "a second body on the LOSING side ... cannot change the
 *       outcome"); the pool card's Sinistcha is on the WINNING side and took a chip the authority never
 *       dealt. The authority stops; we went on.
 *
 *   §B  THE LIFE ORB. Not a game-end rule at all. `futuremove.onEnd` (data/conditions.ts:415-421, no
 *       Champions override) is
 *           this.actions.trySpreadMoveHit([target], data.source, hitMove, true);
 *           if (data.source.isActive && data.source.hasItem('lifeorb') && this.gen >= 5)
 *             this.singleEvent('AfterMoveSecondarySelf', data.source.getItem(), ...);
 *           this.activeMove = null;
 *           this.checkWin();
 *       so the booker pays its Orb toll on EVERY payout — and only then is the win checked. medicham2's
 *       payout never tolled at all. The pool card was the one game where the payout was also the last KO,
 *       so it read as a game-end effect. The authority goes on; we stopped short.
 *
 *   §C  THE LUM BERRY. `lockedmove.onAfterMove` ends the lock and `onEnd` confuses (data/conditions.ts,
 *       no Champions override), inside `runMove`'s `AfterMove` event (sim/battle-actions.ts:311-312). The
 *       berry is an `onUpdate`, and the next Update is `runAction`'s `eachEvent('Update')` — BELOW
 *       `this.faintMessages(); if (this.ended) return true;` (sim/battle.ts:2832-2833). A fatigue on the
 *       killing blow therefore ends the game with the berry uneaten. medicham2 ate it inside
 *       `applyConfusion`, at the moment the volatile landed. The authority stops; we went on.
 *
 * ONE PRINCIPLE, THREE SITES: the win is checked at the authority's own boundaries and nowhere else.
 *
 * ================= THE ARMS =====================================================================
 * Every section carries a CONTROL that differs in exactly one thing and would read the same on a wrong
 * engine only if the knob were unwired. Both engines build the SAME bodies (Serious, 0 SP, the same
 * abilities, items and moves) and read ONE pinned die (0.1) in the same orientation.
 *   §A  control: side A keeps a bench body, so its two burned actives dying does not end the game.
 *       test:    no bench — the second burn KO wipes side A.
 *   §B  control: the booker carries no item.   test: Life Orb, payout not decisive.
 *       decisive: Life Orb, and the payout is the last KO.   immune: Life Orb, collector is Dark.
 *   §C  control: the foe keeps a bench body.   test: the fatigue lands on the killing blow.
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
const KNOBS = ['MEDI_RESIDUAL_STOP_GROUP_ONLY', 'MEDI_ORB_TOLL_SKIPS_PAYOUT', 'MEDI_FATIGUE_BERRY_INLINE']
  .filter(k => process.env[k] === '1');
console.log('\n  GAME-END RESIDUALS — both engines, identical fixtures, one pinned die'
  + (KNOBS.length ? '   [RESTORE KNOB ARMED: ' + KNOBS.join(', ') + ']' : '') + '\n');

/* ---- 0. THE AUTHORITY AND THE FIXTURE, READ ON EVERY RUN ---------------------------------------- */
{
  const modCond = fs.readFileSync(SD + '/data/mods/champions/conditions.ts', 'utf8');
  const modItems = fs.readFileSync(SD + '/data/mods/champions/items.ts', 'utf8');
  const modScripts = fs.readFileSync(SD + '/data/mods/champions/scripts.ts', 'utf8');
  const over = ['futuremove', 'lockedmove', 'brn', 'confusion'].filter(id => modCond.includes('\n\t' + id + ':'));
  ok(over.length === 0 && !modItems.includes('\n\tlifeorb:') && !modItems.includes('\n\tlumberry:')
     && !/\bfieldEvent\s*\(/.test(modScripts),
     'Champions overrides none of futuremove, lockedmove, brn, confusion, Life Orb, Lum Berry or fieldEvent',
     over.length ? 'overridden: ' + over.join(', ') : 'mainline handlers govern');
  const cond = fs.readFileSync(SD + '/data/conditions.ts', 'utf8');
  const fm = /\n\tfuturemove:\s*\{([\s\S]*?)\n\t\},/.exec(cond);
  ok(!!fm && /trySpreadMoveHit[\s\S]*?hasItem\('lifeorb'\)[\s\S]*?AfterMoveSecondarySelf[\s\S]*?checkWin\(\)/.test(fm[1]),
     'futuremove.onEnd tolls the booker\'s Life Orb AFTER the hit and BEFORE checkWin', fm ? null : 'block did not parse');
  const bt = fs.readFileSync(SD + '/sim/battle.ts', 'utf8');
  ok(/this\.faintMessages\(\);\s*\n\s*if \(this\.ended\) return;\s*\n\s*\}\s*\n\s*\}/.test(bt),
     'fieldEvent drains faints and returns on `ended` after EVERY handler (sim/battle.ts:565-566)');
  ok(/this\.faintMessages\(\);\s*\n\s*if \(this\.ended\) return true;[\s\S]{0,4000}?this\.eachEvent\('Update'\)/.test(bt),
     'runAction returns on `ended` ABOVE its Update event, so a berry owed after the killing move is never eaten');
}
{
  const ls = sp => (dex.species.getLearnsetData(dex.species.get(sp).id) || {}).learnset || {};
  const learns = (sp, ...mv) => mv.every(m => !!ls(sp)[m]);
  const checks = [
    [['weavile', 'aerodactyl', 'snorlax', 'incineroar', 'toxapex', 'slowkinggalar', 'garchomp', 'milotic',
      'dragonite'].every(s => legal(dex.species.get(s))), 'every fixture species is legal'],
    [['lifeorb', 'lumberry'].every(i => legal(dex.items.get(i))), 'Life Orb and Lum Berry are legal'],
    [['futuresight', 'protect', 'outrage', 'swordsdance'].every(i => legal(dex.moves.get(i))), 'every click is a legal move'],
    [learns('slowkinggalar', 'futuresight', 'protect'), 'Slowking-Galar learns Future Sight and Protect'],
    [learns('dragonite', 'outrage', 'protect'), 'Dragonite learns Outrage and Protect'],
    [['weavile', 'aerodactyl', 'snorlax', 'toxapex', 'garchomp', 'milotic'].every(s => learns(s, 'protect')), 'every idle body learns Protect'],
    [learns('garchomp', 'swordsdance') && learns('incineroar', 'swordsdance') && learns('weavile', 'swordsdance'),
     'Garchomp, Incineroar and Weavile learn Swords Dance'],
    [!dex.getImmunity('Psychic', dex.species.get('incineroar').types), 'Psychic cannot touch Incineroar (the immune arm)'],
    [dex.species.get('aerodactyl').baseStats.spe > dex.species.get('weavile').baseStats.spe
     && dex.species.get('weavile').baseStats.spe > dex.species.get('incineroar').baseStats.spe
     && dex.species.get('incineroar').baseStats.spe > dex.species.get('snorlax').baseStats.spe,
     'burn order is Aerodactyl, Weavile, then Snorlax (base Speed, read from the dex)'],
  ];
  const failed = checks.filter(c => !c[0]).map(c => c[1]);
  ok(failed.length === 0, 'every fixture body, item and click is legal and ordered as staged',
     failed.length ? 'FAILED: ' + failed.join('; ') : checks.length + ' derived facts checked');
}

/* ---- THE AUTHORITY ---------------------------------------------------------------------------- */
const FRAC = 0.1;
const body = (sp, ability, item, moves) => ({ name: '', species: dex.species.get(sp).name, item: item || '', ability, moves,
  nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: {}, level: 50 });
function newBattle(p1, p2) {
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  /* ONE DIE, IN THIS ENGINE'S ORIENTATION: `random(16)` is mirrored (this engine's `damageRollIndex`
   * is 15 - floor(16u)); every other draw is floor(u * range). Same stub as probe_future_sight_doll.js. */
  battle.prng.random = function pinned(m, n) {
    if (m === 16 && n === undefined) return 15 - Math.min(15, Math.floor(FRAC * 16));
    if (n === undefined) { if (m === undefined) return FRAC; return Math.min(m - 1, Math.floor(FRAC * m)); }
    return m + Math.min(n - m - 1, Math.floor(FRAC * (n - m)));
  };
  battle.setPlayer('p1', { name: 'a', team: Teams.pack(p1) });
  battle.setPlayer('p2', { name: 'b', team: Teams.pack(p2) });
  if (battle.requestState === 'teampreview') {
    battle.choose('p1', 'team ' + '1234'.slice(0, Math.min(4, p1.length)));
    battle.choose('p2', 'team ' + '1234'.slice(0, Math.min(4, p2.length)));
  }
  return battle;
}
const choice = (side, picks) => side.active.map((p, i) => (!p || p.fainted) ? 'pass' : picks[i]).join(', ');
const turn = (b, p1, p2) => b.makeChoices(choice(b.p1, p1), choice(b.p2, p2));

/* ---- THIS ENGINE ------------------------------------------------------------------------------ */
const Z = { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 };
const same = (sp, ab, item, moves) => {
  const x = M.buildMonFromSet({ species: dex.species.get(sp).name, item: item || '', ability: ab, nature: 'Serious', sp: Z, moves });
  if (!x) throw new Error('buildMonFromSet refused ' + sp);
  x.item = item || ''; return x;
};
const rng = () => FRAC;
const act = (S, m, mv, t) => [m, (!m || m.fainted || m.curHP <= 0) ? { kind: 'pass' } : (mv === 'pass' ? { kind: 'pass' } : M.playerAction(m, mv, t || null, S.field))];

/* ================= §A — A BURN THAT WIPES A SIDE CANCELS THE BURNS BEHIND IT ================= */
console.log('\n  §A  the burn group stops at the handler that wipes a side');
function authA(bench) {
  const p1 = [body('aerodactyl', 'Pressure', '', ['Protect']), body('weavile', 'Pressure', '', ['Protect'])];
  if (bench) p1.push(body('toxapex', 'Limber', '', ['Protect']));
  const p2 = [body('snorlax', 'Thick Fat', '', ['Protect']), body('incineroar', 'Blaze', '', ['Protect'])];
  const b = newBattle(p1, p2);
  for (const p of b.p1.active) { p.sethp(1); p.setStatus('brn'); }
  const sn = b.p2.active[0]; sn.setStatus('brn');
  const hp0 = sn.hp;
  turn(b, ['move 1', 'move 1'], ['move 1', 'move 1']);
  return { lost: hp0 - sn.hp, ended: !!b.ended };
}
function mediA(bench) {
  const a1 = same('aerodactyl', 'Pressure', '', ['Protect']), a2 = same('weavile', 'Pressure', '', ['Protect']);
  const A = [a1, a2]; if (bench) A.push(same('toxapex', 'Limber', '', ['Protect']));
  const b1 = same('snorlax', 'Thick Fat', '', ['Protect']), b2 = same('incineroar', 'Blaze', '', ['Protect']);
  const S = M.battleInit(A, [b1, b2], { seeded: true });
  for (const m of [a1, a2]) { m.curHP = 1; m.status = 'brn'; }
  b1.status = 'brn';
  const hp0 = b1.curHP;
  M.battleTurn(S, rng, new Map([act(S, a1, 'protect'), act(S, a2, 'protect')]),
                       new Map([act(S, b1, 'protect'), act(S, b2, 'protect')]));
  return { lost: hp0 - b1.curHP, ended: !!M.battleOver(S) };
}
{
  const aC = authA(true), aT = authA(false), eC = mediA(true), eT = mediA(false);
  const f = x => 'Snorlax lost ' + x.lost + (x.ended ? ', game over' : '');
  console.log('     control (side A has a bench)  authority [' + f(aC) + ']   medicham2 [' + f(eC) + ']');
  console.log('     test    (side A is wiped)     authority [' + f(aT) + ']   medicham2 [' + f(eT) + ']');
  ok(aC.lost > 0 && !aC.ended && aT.lost === 0 && aT.ended,
     'AUTHORITY — with a bench the winner\'s burn ticks; when the burn wipes side A it does not',
     'control ' + aC.lost + ', test ' + aT.lost);
  ok(eC.lost === aC.lost && eT.lost === aT.lost && eT.ended === aT.ended,
     'MEDICHAM2 — the same chip in both arms  (BOARDS MATCH)',
     'control ' + eC.lost + ' vs ' + aC.lost + ', test ' + eT.lost + ' vs ' + aT.lost);
}

/* ================= §B — THE FUTURE SIGHT PAYOUT TOLLS THE BOOKER'S LIFE ORB ================= */
console.log('\n  §B  the payout tolls the booker\'s Life Orb, before the win is checked');
function authB(item, shape) {
  const collector = shape === 'immune' ? 'incineroar' : 'garchomp';
  const p1 = [body('slowkinggalar', 'Own Tempo', item, ['Future Sight', 'Protect']), body('toxapex', 'Limber', '', ['Protect'])];
  const p2 = [body(collector, collector === 'garchomp' ? 'Rough Skin' : 'Blaze', '', ['Swords Dance']),
              body('milotic', 'Marvel Scale', '', ['Protect'])];
  const b = newBattle(p1, p2);
  const sk = b.p1.active[0], t = b.p2.active[0];
  /* DECISIVE: the collector sits on 1 HP and its partner dies to poison at the end of turn 1, so the
   * payout on turn 3 is the last KO of the game. */
  if (shape === 'decisive') { t.sethp(1); b.p2.active[1].sethp(1); b.p2.active[1].setStatus('psn'); }
  turn(b, ['move 1 1', 'move 1'], ['move 1', 'move 1']);
  const hp1 = sk.hp;
  turn(b, ['move 2', 'move 1'], ['move 1', 'move 1']);
  turn(b, ['move 2', 'move 1'], ['move 1', 'move 1']);
  return { booking: sk.maxhp - hp1, payout: hp1 - sk.hp, hit: t.maxhp - t.hp, ended: !!b.ended };
}
function mediB(item, shape) {
  const collector = shape === 'immune' ? 'incineroar' : 'garchomp';
  const sk = same('slowkinggalar', 'Own Tempo', item, ['Future Sight', 'Protect']), ally = same('toxapex', 'Limber', '', ['Protect']);
  const t = same(collector, collector === 'garchomp' ? 'Rough Skin' : 'Blaze', '', ['Swords Dance']);
  const t2 = same('milotic', 'Marvel Scale', '', ['Protect']);
  const S = M.battleInit([sk, ally], [t, t2], { seeded: true });
  if (shape === 'decisive') { t.curHP = 1; t2.curHP = 1; t2.status = 'psn'; }
  const foe = () => new Map([act(S, t, 'swordsdance'), act(S, t2, 'protect')]);
  M.battleTurn(S, rng, new Map([act(S, sk, 'futuresight', t), act(S, ally, 'protect')]), foe());
  const hp1 = sk.curHP;
  M.battleTurn(S, rng, new Map([act(S, sk, 'protect'), act(S, ally, 'protect')]), foe());
  M.battleTurn(S, rng, new Map([act(S, sk, 'protect'), act(S, ally, 'protect')]), foe());
  return { booking: sk.st.hp - hp1, payout: hp1 - sk.curHP, hit: t.st.hp - t.curHP, ended: !!M.battleOver(S) };
}
{
  const arms = [['control', '', 'plain'], ['orb', 'lifeorb', 'plain'], ['decisive', 'lifeorb', 'decisive'], ['immune', 'lifeorb', 'immune']];
  const A = {}, E = {};
  for (const [k, it, sh] of arms) { A[k] = authB(it, sh); E[k] = mediB(it, sh); }
  const f = x => 'booker -' + x.booking + ' at booking, -' + x.payout + ' at payout; collector -' + x.hit + (x.ended ? '; game over' : '');
  for (const [k] of arms) console.log('     ' + k.padEnd(8) + ' authority [' + f(A[k]) + ']\n              medicham2 [' + f(E[k]) + ']');
  ok(A.control.payout === 0 && A.orb.payout > 0 && A.decisive.payout === A.orb.payout && A.decisive.ended
     && A.immune.payout === A.orb.payout && A.orb.booking === 0,
     'AUTHORITY — no toll at the booking; the Orb tolls every payout, a decisive one and an immune one included');
  ok(arms.every(([k]) => E[k].payout === A[k].payout && E[k].booking === A[k].booking && E[k].hit === A[k].hit
                         && E[k].ended === A[k].ended),
     'MEDICHAM2 — the same toll, the same hit and the same ending in every arm  (BOARDS MATCH)',
     arms.map(([k]) => k + ' ' + E[k].payout + '/' + A[k].payout).join(', '));
}

/* ================= §C — A FATIGUE ON THE KILLING BLOW LEAVES THE LUM BERRY UNEATEN ================= */
console.log('\n  §C  the berry owed after the killing move is never eaten if that move won the game');
function authC(bench) {
  const p1 = [body('dragonite', 'Inner Focus', 'Lum Berry', ['Outrage', 'Protect']), body('toxapex', 'Limber', '', ['Protect'])];
  const p2 = [body('weavile', 'Pressure', '', ['Swords Dance']), body('incineroar', 'Blaze', '', ['Swords Dance'])];
  if (bench) p2.push(body('snorlax', 'Thick Fat', '', ['Protect']));
  const b = newBattle(p1, p2);
  for (const p of b.p2.active) p.sethp(1);
  const dn = b.p1.active[0];
  turn(b, ['move 1', 'move 1'], ['move 1', 'move 1']);
  if (bench && b.p2.requestState === 'switch') b.choose('p2', 'switch 3');
  turn(b, ['move 1', 'move 1'], ['move 1', 'move 1']);
  return { item: dn.item || '', confused: !!dn.volatiles.confusion, ended: !!b.ended };
}
function mediC(bench) {
  const dn = same('dragonite', 'Inner Focus', 'lumberry', ['Outrage', 'Protect']), ally = same('toxapex', 'Limber', '', ['Protect']);
  const w = same('weavile', 'Pressure', '', ['Swords Dance']), i = same('incineroar', 'Blaze', '', ['Swords Dance']);
  const B = [w, i]; if (bench) B.push(same('snorlax', 'Thick Fat', '', ['Protect']));
  const S = M.battleInit([dn, ally], B, { seeded: true });
  w.curHP = 1; i.curHP = 1;
  const foes = () => { const a = S.actB || []; return new Map(a.filter(Boolean).map(m => act(S, m, m === w || m === i ? 'swordsdance' : 'protect'))); };
  M.battleTurn(S, rng, new Map([act(S, dn, 'outrage', w), act(S, ally, 'protect')]), foes());
  M.battleTurn(S, rng, new Map([act(S, dn, 'outrage', i), act(S, ally, 'protect')]), foes());
  return { item: dn.item || '', confused: !!(dn._vol && dn._vol.confusion > 0), ended: !!M.battleOver(S) };
}
{
  const aC = authC(true), aT = authC(false), eC = mediC(true), eT = mediC(false);
  const f = x => 'item "' + x.item + '", confused ' + x.confused + (x.ended ? ', game over' : '');
  console.log('     control (foe keeps a bench) authority [' + f(aC) + ']   medicham2 [' + f(eC) + ']');
  console.log('     test    (foe is wiped)      authority [' + f(aT) + ']   medicham2 [' + f(eT) + ']');
  ok(aC.item === '' && !aC.confused && !aC.ended && /lum/.test(aT.item.toLowerCase()) && aT.confused && aT.ended,
     'AUTHORITY — the fatigue is cured by the Lum when the game goes on, and left standing when the blow won it');
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  ok(norm(eC.item) === norm(aC.item) && eC.confused === aC.confused && norm(eT.item) === norm(aT.item)
     && eT.confused === aT.confused && eT.ended === aT.ended,
     'MEDICHAM2 — the berry and the volatile match in both arms  (BOARDS MATCH)',
     'control ' + JSON.stringify(eC) + ' vs ' + JSON.stringify(aC) + '; test ' + JSON.stringify(eT) + ' vs ' + JSON.stringify(aT));
}

console.log('\n  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
