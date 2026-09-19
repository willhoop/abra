#!/usr/bin/env node
/* tests/probe_safeguard_volatile_infiltrator.js — SAFEGUARD'S VOLATILE HANDLER AGAINST INFILTRATOR, ON
 * BOTH ENGINES.
 *   SHOWDOWN_PATH=... node tests/probe_safeguard_volatile_infiltrator.js
 * ==================================================================================================
 *
 * 2026-09-18. The screens half of `ignoresScreensAndSubs` is proved by tests/probe_screens_infiltrator.js
 * (Reflect, Light Screen, Aurora Veil, and Safeguard's `onSetStatus`). Safeguard has a SECOND handler —
 * `onTryAddVolatile`, which refuses confusion and yawn — and it opens with the same infiltration clause.
 * The yawn road through it is staged on the authority by tests/probe_yawn_safeguard_refusal.js; the
 * CONFUSION road had no authority comparison anywhere, on either of its two ways in: a status move that
 * writes confusion (Confuse Ray) and a damaging move whose SECONDARY writes it (Hurricane).
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 *   data/abilities.ts   infiltrator.onModifyMove(move) { move.infiltrates = true; }
 *   data/moves.ts:15601 safeguard.condition.onTryAddVolatile(status, target, source, effect) {
 *   data/moves.ts:15602     if (!effect || !source) return;
 *   data/moves.ts:15603     if (effect.effectType === 'Move' && effect.infiltrates && !target.isAlly(source)) return;
 *   data/moves.ts:15604     if ((status.id === 'confusion' || status.id === 'yawn') && target !== source) {
 *
 * Champions overrides neither `safeguard`, `confuseray`, `hurricane` nor `infiltrator` — asserted below
 * from the mod files, not stated. (The mod's `confusion:` key is the MOVE Confusion, marked Past; the
 * condition lives in conditions.ts, which the mod does not override for confusion — also asserted.)
 *
 * ================= THE ARMS =====================================================================
 *
 *   CONFUSE RAY (status move)   Chandelure -> Clefable.  control: the target clicked Endure;
 *                               screened: the target clicked Safeguard; Infiltrator: the same Safeguard,
 *                               the mover carrying Infiltrator. ALLY: the mover's own partner (Clefable)
 *                               puts Safeguard up and the Infiltrator mover aims at IT — the clause's
 *                               `!target.isAlly(source)` says this is still refused, which is what
 *                               separates the real rule from "Infiltrator ignores Safeguard".
 *   HURRICANE (secondary)       Noivern -> Clefable, same three arms, die pinned LOW so the 70-accuracy
 *                               hit lands and the 30% secondary fires on every arm; only Safeguard and
 *                               the ability differ.
 *
 * The read is the TARGET'S confusion volatile immediately after the move turn. Every body, ability and
 * click is checked against the Champions learnset and the species' ability slots; any miss FAILS the run.
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

console.log('\n  SAFEGUARD onTryAddVolatile vs INFILTRATOR — both engines, identical fixtures, pinned dice\n');

/* ---- THE AUTHORITY'S TEXT, AND WHAT CHAMPIONS OVERRIDES ------------------------------------------ */
{
  const movesSrc = fs.readFileSync(SD + '/data/moves.ts', 'utf8');
  const i = movesSrc.indexOf('\n\tsafeguard: {');
  const blk = i < 0 ? '' : movesSrc.slice(i, movesSrc.indexOf('\n\t},', i));
  const j = blk.indexOf('onTryAddVolatile');
  const vol = j < 0 ? '' : blk.slice(j, blk.indexOf('\n\t\t\t},', j));
  ok(/effect\.infiltrates && !target\.isAlly\(source\)\) return;/.test(vol) && /status\.id === 'confusion'/.test(vol),
     "safeguard.onTryAddVolatile opens with the infiltration clause and names confusion",
     vol ? vol.split('\n').slice(0, 4).map(s => s.trim()).join(' ') : '(handler not found)');
  const modMoves = fs.readFileSync(SD + '/data/mods/champions/moves.ts', 'utf8');
  const modAb = fs.readFileSync(SD + '/data/mods/champions/abilities.ts', 'utf8');
  const modCond = fs.readFileSync(SD + '/data/mods/champions/conditions.ts', 'utf8');
  const over = ['safeguard', 'confuseray', 'hurricane', 'endure'].filter(id => modMoves.includes('\n\t' + id + ': {'));
  ok(over.length === 0 && !modAb.includes('\n\tinfiltrator:') && !modCond.includes('\n\tconfusion:'),
     'Champions overrides none of safeguard, confuseray, hurricane, endure, the infiltrator ability or the confusion condition',
     over.length ? 'overridden: ' + over.join(', ') : 'mainline handlers govern');
}

/* ---- THE FIXTURES, WITH THEIR LEGALITY DERIVED ------------------------------------------------- */
const ROWS = [
  { id: 'confuseray', att: 'chandelure', attAb: 'Flash Fire', move: 'confuseray', frac: 0.5 },
  { id: 'hurricane',  att: 'noivern',    attAb: 'Frisk',      move: 'hurricane',  frac: 0.01 },
];
const TGT = 'clefable', TGTAB = 'Magic Guard', NEUTRAL = 'endure';
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
  need(legal(dex.species.get(TGT)) && carries(TGT, TGTAB), TGT + ' legal and may carry ' + TGTAB);
  need(learns(TGT, 'safeguard') && learns(TGT, NEUTRAL), TGT + ' learns safeguard and ' + NEUTRAL);
  /* A learnset entry is not a legal move: the Champions learnset still lists moves the mod marks Past
   * (Work Up was this family's neutral click for nine days). So every click is asked directly. */
  for (const id of ['safeguard', NEUTRAL, 'protect'])
    need(legal(dex.moves.get(id)), id + ' is a legal move in this format (isNonstandard ' + dex.moves.get(id).isNonstandard + ')');
  for (const r of ROWS) {
    need(legal(dex.species.get(r.att)), r.att + ' is legal');
    need(carries(r.att, 'Infiltrator') && carries(r.att, r.attAb), r.att + ' may carry Infiltrator and ' + r.attAb);
    need(learns(r.att, r.move) && learns(r.att, 'protect'), r.att + ' learns ' + r.move + ' and protect');
    const mv = dex.moves.get(r.move);
    need(legal(mv), r.move + ' is legal');
    if (mv.category !== 'Status') need(dex.getImmunity(mv.type, dex.species.get(TGT).types), mv.type + ' is not immune into ' + TGT);
  }
  const failed = checks.filter(c => !c[0]).map(c => c[1]);
  ok(failed.length === 0, 'every fixture body, ability and click is legal in this format, and no attack is type-immune into its target',
     failed.length ? 'FAILED: ' + failed.join('; ') : checks.length + ' derived facts checked');
}

/* ---- THE AUTHORITY -------------------------------------------------------------------------- */
const body = (sp, ability, moves) => ({ name: '', species: dex.species.get(sp).name, item: '', ability, moves,
  nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: {}, level: 50 });
const FILL = ['Milotic', 'Snorlax'];
const nameOf = id => dex.moves.get(id).name;
function newBattle(p1, p2, frac) {
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  /* The damage roll is read in this engine's orientation: the authority takes `100 - this.random(16)`
   * (sim/battle.ts:2390), this engine turns u into roll `15 - floor(16u)` (`damageRollIndex`). Only
   * `random(16)` is mirrored. */
  battle.prng.random = function pinned(m, n) {
    if (m === 16 && n === undefined) return 15 - Math.min(15, Math.floor(frac * 16));
    if (n === undefined) { if (m === undefined) return frac; return Math.min(m - 1, Math.floor(frac * m)); }
    return m + Math.min(n - m - 1, Math.floor(frac * (n - m)));
  };
  battle.setPlayer('p1', { name: 'a', team: Teams.pack(p1) });
  battle.setPlayer('p2', { name: 'b', team: Teams.pack(p2) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  return battle;
}
const fill = () => FILL.map(s => body(s, dex.species.get(s).abilities['0'], ['Protect']));
/* FOE arms: the target clicks its setup (Endure or Safeguard) while the mover Protects; then the mover
 * aims at the target while the target clicks Endure. ALLY arm: the mover's partner is the Clefable and
 * puts Safeguard up on turn one; on turn two the mover aims at its own partner (`-2`). */
function authorityArm(r, setup, attAb, ally) {
  if (ally) {
    const p1 = [body(r.att, attAb, [nameOf(r.move), 'Protect']), body(TGT, TGTAB, [nameOf(NEUTRAL), 'Safeguard']), ...fill()];
    const p2 = [body('incineroar', 'Blaze', ['Protect']), body('incineroar', 'Blaze', ['Protect']), ...fill()];
    const b = newBattle(p1, p2, r.frac);
    b.makeChoices('move 2, move 2', 'move 1, move 1');
    b.makeChoices('move 1 -2, move 1', 'move 1, move 1');
    const t = b.p1.active[1];
    return { conf: !!t.volatiles['confusion'], up: !!b.p1.sideConditions['safeguard'], dmg: t.maxhp - t.hp };
  }
  const p1 = [body(r.att, attAb, [nameOf(r.move), 'Protect']), body('incineroar', 'Blaze', ['Protect']), ...fill()];
  const p2 = [body(TGT, TGTAB, [nameOf(NEUTRAL), 'Safeguard']), body('incineroar', 'Blaze', ['Protect']), ...fill()];
  const b = newBattle(p1, p2, r.frac);
  b.makeChoices('move 2, move 1', 'move ' + (setup === 'safeguard' ? 2 : 1) + ', move 1');
  const t = b.p2.active[0];
  const h = t.hp;
  b.makeChoices('move 1 1, move 1', 'move 1, move 1');
  return { conf: !!t.volatiles['confusion'], up: !!b.p2.sideConditions['safeguard'], dmg: h - t.hp };
}

/* ---- THIS ENGINE, THROUGH ITS OWN TURN LOOP --------------------------------------------------- */
/* 2026-09-18 -- IDENTICAL LEGAL BODIES ON BOTH ENGINES. The authority side said `evs: 84` (84 SP per stat in
 * Champions, data/mods/champions/scripts.ts:24-27, over the 32 cap) and this side built a usage spread with
 * the HP multiplied by 8. Now: `buildMonFromSet`, Serious, 0 SP, the same ability and moves on both. */
const Z = { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 };
const same = (sp, ab, moves) => {
  const x = M.buildMonFromSet({ species: dex.species.get(sp).name, item: '', ability: ab, nature: 'Serious', sp: Z, moves });
  if (!x) throw new Error('buildMonFromSet refused ' + sp);
  x.item = ''; return x;
};
const PASS2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);
const confused = x => !!(x && x._vol && x._vol.confusion > 0);
function mediArm(r, setup, ab, ally) {
  const me = same(r.att, ab || r.attAb, [nameOf(r.move), 'Protect']);
  const mate = ally ? same(TGT, TGTAB, [nameOf(NEUTRAL), 'Safeguard']) : same('incineroar', 'Blaze', ['Protect']);
  const f1 = same(TGT, TGTAB, [nameOf(NEUTRAL), 'Safeguard']), f2 = same('incineroar', 'Blaze', ['Protect']);
  const S = M.battleInit([me, mate], [f1, f2], { seeded: true });
  const rng = () => r.frac;
  if (ally) {
    M.battleTurn(S, rng, new Map([[me, { kind: 'pass' }], [mate, M.playerAction(mate, 'safeguard', null, S.field)]]), PASS2(f1, f2));
    M.battleTurn(S, rng, new Map([[me, M.playerAction(me, r.move, mate, S.field)], [mate, { kind: 'pass' }]]), PASS2(f1, f2));
    return { conf: confused(mate), up: ((S.sfA && S.sfA.sc && S.sfA.sc.safeguard) || 0) > 0, dmg: mate.st.hp - mate.curHP };
  }
  M.battleTurn(S, rng, PASS2(me, mate), new Map([[f1, M.playerAction(f1, setup, null, S.field)], [f2, { kind: 'pass' }]]));
  const h = f1.curHP;
  M.battleTurn(S, rng, new Map([[me, M.playerAction(me, r.move, f1, S.field)], [mate, { kind: 'pass' }]]), PASS2(f1, f2));
  return { conf: confused(f1), up: ((S.sfB && S.sfB.sc && S.sfB.sc.safeguard) || 0) > 0, dmg: h - f1.curHP };
}

const fmt = x => (x.conf ? 'confused' : 'clear') + (x.up ? ' [Safeguard up]' : ' [no Safeguard]') + ' -' + x.dmg;
for (const r of ROWS) {
  const A = { ctrl: authorityArm(r, NEUTRAL, r.attAb), sg: authorityArm(r, 'safeguard', r.attAb), inf: authorityArm(r, 'safeguard', 'Infiltrator') };
  const E = { ctrl: mediArm(r, NEUTRAL, null), sg: mediArm(r, 'safeguard', null), inf: mediArm(r, 'safeguard', 'Infiltrator') };
  if (r.id === 'confuseray') { A.ally = authorityArm(r, 'safeguard', 'Infiltrator', true); E.ally = mediArm(r, 'safeguard', 'Infiltrator', true); }
  console.log('  ' + r.id.toUpperCase() + ' — ' + r.att + ' ' + r.move + ' into ' + TGT + ', die pinned at ' + r.frac);
  for (const [n, X] of [['authority', A], ['medicham2', E]]) {
    console.log('    ' + n + '   control ' + fmt(X.ctrl) + '   Safeguard ' + fmt(X.sg) + '   Infiltrator ' + fmt(X.inf)
      + (X.ally ? '   Infiltrator at OWN partner ' + fmt(X.ally) : ''));
  }
  const want = X => X.ctrl.conf && !X.ctrl.up && !X.sg.conf && X.sg.up && X.inf.conf && X.inf.up && (!X.ally || (!X.ally.conf && X.ally.up));
  ok(want(A), r.id + ': AUTHORITY — Safeguard refuses the confusion, Infiltrator confuses a FOE through it'
     + (A.ally ? ', and the same Infiltrator body is still refused by its OWN side\'s Safeguard' : ''));
  const agree = ['ctrl', 'sg', 'inf', 'ally'].every(k => !A[k] || (A[k].conf === E[k].conf && A[k].up === E[k].up));
  ok(agree && want(E), r.id + ': MEDICHAM2 — identical in every arm  (BOARDS MATCH)');
  ok(['ctrl', 'sg', 'inf', 'ally'].every(k => !A[k] || A[k].dmg === E[k].dmg),
     r.id + ': IDENTICAL BODIES — the target loses the same HP on both engines in every arm',
     ['ctrl', 'sg', 'inf', 'ally'].filter(k => A[k]).map(k => k + ' ' + A[k].dmg + '/' + E[k].dmg).join(', '));
  console.log('');
}

console.log('  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
