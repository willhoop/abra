#!/usr/bin/env node
/* tests/probe_screens_infiltrator.js — THE SCREENS HALF OF `ignoresScreensAndSubs`, AGAINST THE AUTHORITY.
 *   SHOWDOWN_PATH=... node tests/probe_screens_infiltrator.js
 * ==================================================================================================
 *
 * The tag is named for SCREENS and SUBS. Nine census rows stage the SUBS half; until 2026-09-09 ZERO
 * rows paired the ability with a screen, and a bypassed screen is a x4096/2732 damage roll — BOARD-
 * MATERIAL. This file is the authority half of the four census rows added that night in
 * tests/test-mechanics.js (`screenArms`), plus the Compound Eyes row: it stages the IDENTICAL fixtures
 * on the official simulator and on this engine, and compares what each did.
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 *   data/abilities.ts   infiltrator.onModifyMove(move) { move.infiltrates = true; }
 *   data/moves.ts:857   auroraveil   if (!target.getMoveHitData(move).crit && !move.infiltrates) {
 *   data/moves.ts:10338 lightscreen      if (this.activePerHalf > 1) return this.chainModify([2732, 4096]);
 *   data/moves.ts:14857 reflect          return this.chainModify(0.5); }
 *   data/moves.ts:15592 safeguard.onSetStatus
 *                       if (effect.effectType === 'Move' && effect.infiltrates && !target.isAlly(source)) return;
 *   data/abilities.ts   compoundeyes.onSourceModifyAccuracy(accuracy) -> chainModify([5325, 4096])
 *   sim/battle-actions.ts:713   accuracy = runEvent('ModifyAccuracy', ...)   (the ability lands HERE)
 *   sim/battle-actions.ts:714-727   the ONE clamped stage, then trunc — both stages are zero on this board
 *
 * Champions overrides none of the four moves, `infiltrator` or `compoundeyes` (asserted below from the
 * mod files, not stated). The doubles screen is [2732, 4096] and it is applied inside `runEvent(
 * 'ModifyDamage')`, whose last line is `modify(relayVar, modifier)` — so the authority's screened
 * number is EXACTLY `battle.modify(unscreened, [2732, 4096])`, and that is the check this file makes
 * on BOTH engines, calling the authority's own `modify` rather than typing the arithmetic.
 *
 * ================= WHAT IS DERIVED, NEVER TYPED ================================================
 *
 *   - the screens: every legal move with a `sideCondition` whose condition source reads `infiltrates`.
 *     FIVE match; `mist` is `isNonstandard: 'Past'` in the Champions mod; the regulation has FOUR.
 *   - the fixtures' legality: every body is a legal species, every click is in its Champions learnset,
 *     every ability is one the species may carry. Any miss FAILS the run.
 *
 * ================= THE DICE ARE PINNED, SO THE ARMS DIFFER IN THE SCREEN ONLY ====================
 *
 * `battle.prng.random` is replaced with a constant-fraction die (0.5 for the screen arms; 0.95 for the
 * Compound Eyes arms, which is the census row's own roll): `random(16)` -> a fixed damage roll,
 * `random(24)` -> no crit, `random(100)` -> 50 (Will-O-Wisp's 85 lands) or 95 (a 90 misses, a 117
 * lands). This engine is handed the same constant through `battleTurn`. Absolute damage is NOT
 * compared across engines — `bare()` builds a usage spread and the authority team is 84-EV Serious —
 * only each engine's own ratio, which is what the mechanic is.
 *
 * ================= ONE REASON ONLY ==============================================================
 *
 * The first Reflect fixture in the census was Dragon Claw into a Clefable and read 0 in every arm:
 * Fairy is IMMUNE to Dragon. Every attack here is checked for a type immunity into its target before
 * it is used, and the run FAILS if one is found.
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

/* ---- THE SCREENS, DERIVED --------------------------------------------------------------------- */
const movesSrc = fs.readFileSync(SD + '/data/moves.ts', 'utf8');
const block = id => { const i = movesSrc.indexOf('\n\t' + id + ': {'); if (i < 0) return '';
                      return movesSrc.slice(i, movesSrc.indexOf('\n\t},', i)); };
const FAMILY = dex.moves.all().filter(m => m.sideCondition && /infiltrates/.test(block(m.id)));
const SCREENS = FAMILY.filter(legal).map(m => m.id).sort();
console.log('\n  THE SCREENS HALF OF ignoresScreensAndSubs — both engines, identical fixtures, pinned dice\n');
console.log('  DERIVED — side conditions whose handler reads `infiltrates` (' + FAMILY.length + '): '
  + FAMILY.map(m => m.id + (legal(m) ? '' : ' [' + m.isNonstandard + ' — NOT IN THIS FORMAT]')).join(', '));
console.log('  DERIVED — legal in ' + CS.FORMAT + ' (' + SCREENS.length + '): ' + SCREENS.join(', '));
ok(SCREENS.length === 4 && dex.moves.get('mist').isNonstandard === 'Past',
   'the regulation has FOUR screens, not five — Mist is Past', 'mist.isNonstandard = ' + dex.moves.get('mist').isNonstandard);
{
  const modMoves = fs.readFileSync(SD + '/data/mods/champions/moves.ts', 'utf8');
  const modAb = fs.readFileSync(SD + '/data/mods/champions/abilities.ts', 'utf8');
  const overridden = SCREENS.filter(id => modMoves.includes('\n\t' + id + ': {'));
  ok(overridden.length === 0 && !modAb.includes('\n\tinfiltrator:') && !modAb.includes('\n\tcompoundeyes:'),
     'Champions overrides none of the four screens, nor infiltrator, nor compoundeyes',
     overridden.length ? 'overridden: ' + overridden.join(', ') : 'mainline handlers govern');
}

/* ---- THE FIXTURES, WITH THEIR LEGALITY DERIVED ------------------------------------------------- */
/* Each row: attacker (species, control ability, move), target (species, ability, neutral click),
 * the screen, and what is read. The abilities named for the AUTHORITY are ones the species may carry
 * and none of them touches accuracy, damage taken or status; this engine's `bare()` blanks the
 * ability instead, which is the census row's own shape. Ninetales-Alola carries Snow Warning on the
 * authority so Aurora Veil can be clicked; this engine's arm sets snow on the field directly. */
const ROWS = [
  { screen: 'reflect',     att: 'dragapult',  attAb: 'Clear Body', move: 'facade',
    tgt: 'clefable', tgtAb: 'Magic Guard', neutral: 'workup', read: 'dmg' },
  { screen: 'lightscreen', att: 'chandelure', attAb: 'Flash Fire', move: 'hex',
    tgt: 'clefable', tgtAb: 'Magic Guard', neutral: 'workup', read: 'dmg' },
  { screen: 'auroraveil',  att: 'chandelure', attAb: 'Flash Fire', move: 'hex',
    tgt: 'ninetalesalola', tgtAb: 'Snow Warning', neutral: 'nastyplot', read: 'dmg', snow: true },
  { screen: 'safeguard',   att: 'chandelure', attAb: 'Flash Fire', move: 'willowisp',
    tgt: 'clefable', tgtAb: 'Magic Guard', neutral: 'workup', read: 'status' },
];
const CE = { att: 'vivillon', attAb: 'Shield Dust', liveAb: 'Compound Eyes', move: 'skittersmack',
             tgt: 'garchomp', tgtAb: 'Rough Skin', neutral: 'swordsdance' };

const learns = (spId, mv) => {
  let s = dex.species.get(spId);
  while (s && s.exists) {
    const l = dex.data.Learnsets[s.id];
    if (l && l.learnset && l.learnset[mv]) return true;
    if (s.prevo) s = dex.species.get(s.prevo);
    else if (s.baseSpecies && s.baseSpecies !== s.name) s = dex.species.get(s.baseSpecies);
    else break;
  }
  return false;
};
const carries = (spId, ab) => Object.values(dex.species.get(spId).abilities).includes(ab);
{
  const checks = [];
  const need = (c, what) => checks.push([c, what]);
  for (const r of ROWS) {
    need(legal(dex.species.get(r.att)) && legal(dex.species.get(r.tgt)), r.screen + ': both species legal');
    need(carries(r.att, 'Infiltrator') && carries(r.att, r.attAb), r.screen + ': ' + r.att + ' may carry Infiltrator and ' + r.attAb);
    need(carries(r.tgt, r.tgtAb), r.screen + ': ' + r.tgt + ' may carry ' + r.tgtAb);
    need(learns(r.att, r.move), r.screen + ': ' + r.att + ' learns ' + r.move);
    need(learns(r.tgt, r.screen) && learns(r.tgt, r.neutral), r.screen + ': ' + r.tgt + ' learns ' + r.screen + ' and ' + r.neutral);
    const mv = dex.moves.get(r.move);
    if (mv.category !== 'Status') {
      need(dex.getImmunity(mv.type, dex.species.get(r.tgt).types), r.screen + ': ' + mv.type + ' is not immune into ' + r.tgt + ' (one reason only)');
    } else {
      need(!dex.species.get(r.tgt).types.includes('Fire'), r.screen + ': the burn target is not Fire (one reason only)');
    }
  }
  need(legal(dex.species.get(CE.att)) && carries(CE.att, CE.liveAb) && carries(CE.att, CE.attAb),
       'compoundeyes: ' + CE.att + ' legal and may carry ' + CE.liveAb + ' / ' + CE.attAb);
  need(learns(CE.att, CE.move) && dex.moves.get(CE.move).accuracy === 90, 'compoundeyes: ' + CE.att + ' learns ' + CE.move + ' and it is printed 90');
  need(learns(CE.tgt, CE.neutral) && carries(CE.tgt, CE.tgtAb), 'compoundeyes: ' + CE.tgt + ' learns ' + CE.neutral + ' and may carry ' + CE.tgtAb);
  need(dex.getImmunity(dex.moves.get(CE.move).type, dex.species.get(CE.tgt).types), 'compoundeyes: Bug is not immune into ' + CE.tgt);
  const failed = checks.filter(c => !c[0]).map(c => c[1]);
  ok(failed.length === 0, 'every fixture body, ability and click is legal in this format, and no attack is type-immune into its target',
     failed.length ? 'FAILED: ' + failed.join('; ') : checks.length + ' derived facts checked');
}

/* ---- THE AUTHORITY -------------------------------------------------------------------------- */
const body = (sp, ability, moves) => ({ name: '', species: dex.species.get(sp).name, item: '', ability, moves,
  nature: 'Serious', evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 }, ivs: {}, level: 50 });
const FILL = ['Milotic', 'Snorlax'];
function newBattle(p1, p2, frac) {
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.prng.random = function pinned(m, n) {
    if (n === undefined) { if (m === undefined) return frac; return Math.min(m - 1, Math.floor(frac * m)); }
    return m + Math.min(n - m - 1, Math.floor(frac * (n - m)));
  };
  battle.setPlayer('p1', { name: 'a', team: Teams.pack(p1) });
  battle.setPlayer('p2', { name: 'b', team: Teams.pack(p2) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  return battle;
}
const nameOf = id => dex.moves.get(id).name;
/* Two turns: the target clicks its setup (neutral or the screen) while the attacker Protects; then the
 * attacker aims at the target while the target clicks the neutral move again. Partners Protect. */
function authorityArm(r, setup, attAb) {
  const p1 = [body(r.att, attAb, [nameOf(r.move), 'Protect']), body('incineroar', 'Blaze', ['Protect']),
              ...FILL.map(s => body(s, dex.species.get(s).abilities['0'], ['Protect']))];
  const p2 = [body(r.tgt, r.tgtAb, [nameOf(r.neutral), nameOf(r.screen)]), body('incineroar', 'Blaze', ['Protect']),
              ...FILL.map(s => body(s, dex.species.get(s).abilities['0'], ['Protect']))];
  const b = newBattle(p1, p2, 0.5);
  b.makeChoices('move 2, move 1', 'move ' + (setup === 'screen' ? 2 : 1) + ', move 1');
  const tgt = b.p2.active[0];
  const before = tgt.hp;
  b.makeChoices('move 1 1, move 1', 'move 1, move 1');
  return { dmg: before - tgt.hp, status: tgt.status || '-', up: !!b.p2.sideConditions[r.screen],
           snow: b.field.weather, modify: (x) => b.modify(x, [2732, 4096]) };
}

/* ---- THIS ENGINE, THROUGH ITS OWN TURN LOOP, THE CENSUS ROW'S OWN SHAPE ------------------------ */
const bare = sp => { const b = M.buildMon(sp, {}); if (!b) throw new Error('no MC row for ' + sp); b.item = ''; b.ability = 'none'; return b; };
const PASS2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);
function mediArm(r, setup, ab, frac) {
  const me = bare(r.att), ally = bare('incineroar'), f1 = bare(r.tgt), f2 = bare('incineroar');
  if (r.read !== 'status') { f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp; }
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  if (r.snow) { S.field.weather = M.weatherId('snow'); S.field.weatherT = 5; }
  if (ab) me.ability = ab;
  const rng = () => frac;
  const click = setup === 'screen' ? r.screen : r.neutral;
  M.battleTurn(S, rng, PASS2(me, ally), new Map([[f1, M.playerAction(f1, click, null, S.field)], [f2, { kind: 'pass' }]]));
  const before = f1.curHP;
  M.battleTurn(S, rng, new Map([[me, M.playerAction(me, r.move, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { dmg: before - f1.curHP, status: f1.status || '-', up: ((S.sfB && S.sfB.sc && S.sfB.sc[r.screen]) || 0) > 0 };
}

/* ---- THE FOUR ROWS -------------------------------------------------------------------------- */
console.log('');
for (const r of ROWS) {
  const A = { ctrl: authorityArm(r, 'neutral', r.attAb), scr: authorityArm(r, 'screen', r.attAb), inf: authorityArm(r, 'screen', 'Infiltrator') };
  const E = { ctrl: mediArm(r, 'neutral', null, 0.5), scr: mediArm(r, 'screen', null, 0.5), inf: mediArm(r, 'screen', 'infiltrator', 0.5) };
  const fmt = (x) => r.read === 'dmg' ? x.dmg + (x.up ? ' [screen up]' : ' [no screen]') : x.status + (x.up ? ' [Safeguard up]' : ' [no Safeguard]');
  console.log('  ' + r.screen.toUpperCase() + ' — ' + r.att + ' ' + r.move + ' into ' + r.tgt + (r.snow ? ' under snow' : ''));
  console.log('    authority   control ' + fmt(A.ctrl) + '   screened ' + fmt(A.scr) + '   Infiltrator ' + fmt(A.inf)
    + (r.read === 'dmg' ? '   modify(control,[2732,4096]) = ' + A.ctrl.modify(A.ctrl.dmg) : ''));
  console.log('    medicham2   control ' + fmt(E.ctrl) + '   screened ' + fmt(E.scr) + '   Infiltrator ' + fmt(E.inf)
    + (r.read === 'dmg' ? '   modify(control,[2732,4096]) = ' + A.ctrl.modify(E.ctrl.dmg) : ''));
  /* THE WEATHER ID IS DERIVED FROM THE MOVE THAT SETS IT, NOT TYPED: the first draft asserted 'snow' —
   * this engine's internal id — and the authority's is whatever `snowscape.weather` says. */
  if (r.snow) ok(A.ctrl.snow === dex.moves.get('snowscape').weather && A.scr.up,
                 r.screen + ': the authority had snow up (`' + dex.moves.get('snowscape').weather + '`) and the veil went up under it',
                 'weather ' + A.ctrl.snow);
  if (r.read === 'dmg') {
    ok(A.ctrl.dmg > 0 && A.scr.up && A.scr.dmg === A.ctrl.modify(A.ctrl.dmg) && A.inf.up && A.inf.dmg === A.ctrl.dmg,
       r.screen + ': AUTHORITY — the screen is exactly modify(x,[2732,4096]) and Infiltrator is exactly the unscreened number',
       A.ctrl.dmg + ' -> ' + A.scr.dmg + ' (expect ' + A.ctrl.modify(A.ctrl.dmg) + ') -> ' + A.inf.dmg);
    ok(E.ctrl.dmg > 0 && E.scr.up && E.scr.dmg === A.ctrl.modify(E.ctrl.dmg) && E.inf.up && E.inf.dmg === E.ctrl.dmg,
       r.screen + ': MEDICHAM2 — the same two sentences hold on its own numbers  (BOARDS MATCH)',
       E.ctrl.dmg + ' -> ' + E.scr.dmg + ' (expect ' + A.ctrl.modify(E.ctrl.dmg) + ') -> ' + E.inf.dmg);
  } else {
    ok(A.ctrl.status === 'brn' && A.scr.up && A.scr.status === '-' && A.inf.up && A.inf.status === 'brn',
       r.screen + ': AUTHORITY — Safeguard refuses the burn and Infiltrator burns through the standing Safeguard',
       [A.ctrl.status, A.scr.status, A.inf.status].join(' / '));
    ok(E.ctrl.status === A.ctrl.status && E.scr.status === A.scr.status && E.inf.status === A.inf.status && E.scr.up && E.inf.up,
       r.screen + ': MEDICHAM2 — identical status in all three arms  (BOARDS MATCH)',
       [E.ctrl.status, E.scr.status, E.inf.status].join(' / '));
  }
  console.log('');
}

/* ---- COMPOUND EYES -------------------------------------------------------------------------- */
{
  const seen = { n: null };
  function ceAuthority(attAb) {
    const p1 = [body(CE.att, attAb, [nameOf(CE.move), 'Protect']), body('incineroar', 'Blaze', ['Protect']),
                ...FILL.map(s => body(s, dex.species.get(s).abilities['0'], ['Protect']))];
    const p2 = [body(CE.tgt, CE.tgtAb, [nameOf(CE.neutral)]), body('incineroar', 'Blaze', ['Protect']),
                ...FILL.map(s => body(s, dex.species.get(s).abilities['0'], ['Protect']))];
    const b = newBattle(p1, p2, 0.95);
    const rc = b.randomChance; seen.n = null;
    b.randomChance = function (n, d) { if (d === 100 && seen.n === null) seen.n = n; return rc.call(this, n, d); };
    const tgt = b.p2.active[0]; const before = tgt.hp;
    b.makeChoices('move 1 1, move 1', 'move 1, move 1');
    return { dmg: before - tgt.hp, acc: seen.n, printed: dex.moves.get(CE.move).accuracy };
  }
  function ceMedi(ab, frac) {
    const r = { att: CE.att, tgt: CE.tgt, move: CE.move, neutral: CE.neutral, screen: 'reflect', read: 'dmg' };
    return mediArm(r, 'neutral', ab, frac);
  }
  const A0 = ceAuthority(CE.attAb), A1 = ceAuthority(CE.liveAb);
  const E0 = ceMedi(null, 0.95), E1 = ceMedi('compoundeyes', 0.95), E2 = ceMedi(null, 0.85);
  console.log('  COMPOUND EYES — ' + CE.att + ' ' + CE.move + ' (printed ' + A0.printed + ') into ' + CE.tgt + ', die pinned at 0.95');
  console.log('    authority   ' + CE.attAb + ': rolled accuracy ' + A0.acc + ', damage ' + A0.dmg + '   |   ' + CE.liveAb + ': rolled accuracy ' + A1.acc + ', damage ' + A1.dmg
    + '   |   modify(90,[5325,4096]) = ' + new Battle({ formatid: CS.FORMAT }).modify(90, [5325, 4096]));
  console.log('    medicham2   no ability: damage ' + E0.dmg + '   |   compoundeyes: damage ' + E1.dmg + '   |   no ability at 0.85: damage ' + E2.dmg);
  ok(A0.acc === 90 && A1.acc === 117 && A0.dmg === 0 && A1.dmg > 0,
     'compoundeyes: AUTHORITY — hands randomChance 90 bare and 117 with the ability; the 0.95 die misses one and lands the other',
     A0.acc + ' / ' + A1.acc + ', damage ' + A0.dmg + ' / ' + A1.dmg);
  ok(E0.dmg === 0 && E1.dmg > 0 && E2.dmg > 0,
     'compoundeyes: MEDICHAM2 — misses bare, lands with the ability, and lands bare at 0.85  (BOARDS MATCH)',
     E0.dmg + ' / ' + E1.dmg + ' / ' + E2.dmg);
}

console.log('\n  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
