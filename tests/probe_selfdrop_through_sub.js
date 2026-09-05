/* probe_selfdrop_through_sub.js — THE AUTHORITY'S STEP 4 (`selfDrops`) RUNS WHEN A SUBSTITUTE ATE
 * THE HIT, AND THIS ENGINE'S ONCE-PER-MOVE BACKSTOP DID NOT FLUSH IT.
 *
 *   SHOWDOWN_PATH=... node tests/probe_selfdrop_through_sub.js
 *   SHOWDOWN_PATH=... MEDI_SELFPAY_SKIPPED_ON_SUB=1 node tests/probe_selfdrop_through_sub.js   (the red)
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * One of the 41 board-material games on release `3187ea18c625`
 * (`data/verification/fix-batch-5.json`, `omit-weather  ...2659317806 vs ...2659415110`, turn 10):
 *
 *     ...  |move|p1a:blaziken|closecombat
 *          |-resisted|p2a:delphox|1
 *          |-end|p2a:delphox|substitute
 *     sd   |-unboost|p1a: Blaziken|def|1        <- and `spd|1` after it
 *     us   (nothing — the next line is p1b's Leftovers)
 *
 *     board   p1.party.blaziken.boosts.def  medi 0 / sd -1
 *             p1.party.blaziken.boosts.spd  medi 0 / sd -1
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * `data/moves.ts` closecombat carries `self: { boosts: { def: -1, spd: -1 } }` and Champions
 * overrides the move nowhere (no `closecombat` key under `data/mods/champions/moves.ts`).
 *
 * `data/moves.ts:18335-18367`, `substitute.condition.onTryPrimaryHit`, ends
 * `return this.HIT_SUBSTITUTE;` on BOTH arms — the doll that broke (`-end`) and the doll that stood
 * (`-activate ... [damage]`). It is one return, so both arms answer the same way.
 *
 * `sim/battle-actions.ts:1054-1069`, `spreadMoveHit` step 0:
 *
 *     if (damage[i] === this.battle.HIT_SUBSTITUTE) {
 *       damage[i] = true;
 *       targets[i] = null;                       // <- NULL, not false
 *     }
 *     ...
 *     if (!damage[i]) targets[i] = false;        // damage[i] is `true`, so this does not fire
 *
 * and `sim/battle-actions.ts:1096` / `:1317-1325`:
 *
 *     if (moveData.self && !move.selfDropped) this.selfDrops(targets, pokemon, move, moveData, isSecondary);
 *     selfDrops(targets, source, move, moveData, isSecondary) {
 *       for (const target of targets) {
 *         if (target === false) continue;        // <- `null` is NOT `false`; the loop body runs
 *         ...  this.moveHit(source, source, move, moveData.self, isSecondary, true);
 *
 * So a substitute-eaten hit is `null`, `null !== false`, and the user's own stat table is paid.
 * The SAME step also arms `self: { volatileStatus: 'mustrecharge' }`, which is why this probe tests
 * both halves: one step, two payments, and the missing flush ate both.
 *
 * A TOTAL MISS IS A DIFFERENT SHAPE AND IS NOT THIS DEFECT. `hitStepAccuracy` writes
 * `targets[i] = false` inside `hitStepMoveHitLoop`, above `spreadMoveHit`, so `selfDrops` is not
 * called at all. That is arm 6's control and it agreed before this fix and after it.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * `medicham2-browser.js`'s WIRE 42 substitute road ends `R.out = true; return;`. The step driver is
 * `for (const _step of _STEPS) for (const R of _rows) { if (R.out) continue; _step(R); }`, so when
 * every row is `out` no later step runs at all. The file already knew this — the backstop below the
 * driver flushes `_stepAfterHitField` and `_stepUpdate` for exactly that reason, and its own comment
 * names `out` + `_reached > 0` as the substitute case. `_stepSelfPay` was simply not in the flush.
 *
 * ================= WHAT IS ASSERTED, AND ON WHAT ================================================
 *
 * Every number below is read off each engine's OWN state — `A.boosts` / `A._recharge` / `V._sub`
 * here, `pokemon.boosts` / `volatiles.mustrecharge` / `volatiles.substitute.hp` there. Nothing is
 * recomputed alongside the engine.
 *
 *   1  FIXTURE   the move, the attacker, the target and the doll size are derived and printed
 *   2  CONTROL   with NO substitute up, the same click pays the same stat table in both engines
 *   3  CONTROL   the doll's own fate agrees across the engines, so both are testing one situation
 *   4  TEST      through the doll, the attacker's stat table matches the authority's
 *   5  CONTROL   and no OTHER stat of the attacker moved, in either engine
 *   6  CONTROL   a MISSED click of the same move pays nothing in either engine (the authority does
 *                not call `selfDrops` at all when `hitStepAccuracy` emptied the target list)
 *   7  TEST      a `mustrecharge` move through the doll arms the recharge in both engines
 *   8  COUNTER   MEDSEEN.selfPayFlushed is non-zero, so the backstop really ran
 *
 * `MEDI_SELFPAY_SKIPPED_ON_SUB=1` restores the missing flush. The parent re-runs ITSELF under it and
 * FAILS if that child passes.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('THE SELF-DROP THROUGH A SUBSTITUTE');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const { mcKey } = require(D('engine', 'mc_key.js'));
const TAGS = require(D('data', 'tags.json'));

const CHILD = process.env.MEDI_SELFPAY_SKIPPED_ON_SUB === '1';
let bad = 0, stage = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
const FIXTURE = (m) => { stage++; console.log('  FIXTURE  ' + m); };
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
/* This engine's own boost slots. Same map `medicham2-browser.js` uses (`SD2ENG`), read here so the
 * probe speaks each engine in that engine's own vocabulary rather than assuming they agree. */
const SD2ENG = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp' };
const STATS = Object.keys(SD2ENG);

console.log('\n== THE SELF-DROP THROUGH A SUBSTITUTE =='
  + (CHILD ? '   [MEDI_SELFPAY_SKIPPED_ON_SUB=1]' : '') + '\n');

/* ================================================================================================
 * 1 — THE FIXTURE, DERIVED. Never named.
 * ============================================================================================= */
const uses = id => (TAGS.moves && TAGS.moves[id] && TAGS.moves[id].uses) || 0;

/* THE FAMILY: legal damaging moves that carry their own `self` stat table and aim at one body. */
const FAMILY = dex.moves.all().filter(legal)
  .filter(m => m.category !== 'Status' && m.self && m.self.boosts && m.target === 'normal')
  .map(m => ({ id: m.id, boosts: m.self.boosts, type: m.type, uses: uses(m.id) }))
  .sort((a, b) => b.uses - a.uses);
console.log('  LEGAL damaging moves carrying their own `self` stat table, single-target:');
console.log('    ' + (FAMILY.map(m => m.id + ' ' + JSON.stringify(m.boosts) + ' uses=' + m.uses).join('\n    ') || 'NONE'));
if (!FAMILY.length) { console.log('  NOT RUN — no such move in this format. A claim about the format.'); process.exit(2); }

/* THE RECHARGE FAMILY: the other payment `selfDrops` makes. */
const RECH = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('recharge') >= 0 && legal(dex.moves.get(k)))
  .map(k => ({ id: k, type: dex.moves.get(k).type, uses: uses(k) }))
  .sort((a, b) => b.uses - a.uses);
console.log('  LEGAL `recharge` moves: ' + (RECH.map(m => m.id + ' uses=' + m.uses).join(', ') || 'NONE'));

const buildable = name => { try { return !!MEDI.buildMon(mcKey(name, { mayMiss: 'a probe body must be a real row' }), {}); }
  catch (e) { console.error('probe fixture: buildMon(' + name + ') threw -- ' + e.message + '. The candidate pool is NARROWER than the format, so a COULD-NOT-STAGE below is a statement about this search and NOT about the mechanic.'); return false; } };
const ab0 = sp => dex.abilities.get(Object.values(sp.abilities)[0]).id;

/* THE INERT CLICK. Every body that is not the attacker clicks this, on every turn, in every arm, so
 * the ONLY thing that varies between arms is where the attacker aims and whether a doll is up. It is
 * derived as the most-used legal `stallingMove` — a shield changes no HP, no stat and no doll on a
 * body nobody is attacking, and it is also the refusal arm 6 needs. Champions bans three members of
 * this family; the walk is filtered, so a banned one cannot be picked. */
const SHIELDS = dex.moves.all().filter(legal).filter(m => m.stallingMove)
  .map(m => ({ id: m.id, uses: uses(m.id) })).sort((a, b) => b.uses - a.uses);
console.log('  LEGAL stalling moves here: ' + (SHIELDS.map(m => m.id + ' uses=' + m.uses).join(', ') || 'NONE'));
if (!SHIELDS.length) { console.log('  NOT RUN — no legal shield. A claim about the format.'); process.exit(2); }

/* THE TARGET: a legal body that learns Substitute AND a shield, the BULKIEST such body — a big HP bar
 * is a big doll, and a big doll is the arm that can survive a hit as well as break under one. */
let TGT = null;
for (const s of dex.species.all().filter(legal)
  .sort((a, b) => b.baseStats.hp - a.baseStats.hp || a.name.localeCompare(b.name))) {
  if (!LS(s)['substitute']) continue;
  const sh = SHIELDS.find(x => LS(s)[x.id]); if (!sh) continue;
  if (!buildable(s.name)) continue;
  TGT = { sp: s, shield: sh.id, ab: ab0(s) }; break;
}
if (!TGT) { FIXTURE('no legal body learns Substitute and a shield'); process.exit(2); }

/* THE ATTACKER: learns one of the family and a shield, is not type-refused by the target, and is
 * STRICTLY FASTER than it — arm 2 needs the click to resolve above the target's own Substitute. */
const pick = (fam) => {
  for (const mv of fam) {
    if (!dex.getImmunity(mv.type, TGT.sp)) continue;
    for (const s of dex.species.all().filter(legal)
      .sort((a, b) => b.baseStats.spe - a.baseStats.spe || a.name.localeCompare(b.name))) {
      if (s.baseStats.spe <= TGT.sp.baseStats.spe) continue;
      if (!LS(s)[mv.id]) continue;
      const sh = SHIELDS.find(x => LS(s)[x.id]); if (!sh) continue;
      if (!buildable(s.name)) continue;
      return { sp: s, shield: sh.id, ab: ab0(s), mv };
    }
  }
  return null;
};
const ATK = pick(FAMILY);
if (!ATK) { FIXTURE('no legal attacker for a `self`-table move that outspeeds ' + TGT.sp.name); process.exit(2); }
const RATK = pick(RECH);

console.log('\n  CHOSEN   move=' + ATK.mv.id + ' ' + JSON.stringify(ATK.mv.boosts)
  + '   attacker=' + ATK.sp.name + ' (' + ATK.ab + ', spe ' + ATK.sp.baseStats.spe + ', shield ' + ATK.shield + ')'
  + '\n           target=' + TGT.sp.name + ' (' + TGT.ab + ', spe ' + TGT.sp.baseStats.spe
  + ', base hp ' + TGT.sp.baseStats.hp + ', shield ' + TGT.shield + ')'
  + '\n           recharge arm=' + (RATK ? RATK.mv.id + ' from ' + RATK.sp.name : 'NONE — not run'));

/* ================================================================================================
 * THE TWO RUNS.
 *
 *   turn 1  the attacker shields (inert); the target clicks Substitute or shields
 *   turn 2  the attacker clicks the move at the target; the target clicks `t2`
 *
 * Every other body shields on every turn, in every arm, so nothing else can move.
 * ============================================================================================= */
function runMedi(atk, mv, t1, t2) {
  const mk = (name, moves, ab) => { const b = MEDI.buildMon(mcKey(name, { mayMiss: 'a probe body must be a real row' }), {});
    if (!b) throw new Error('buildMon failed for ' + name);
    b.moves = moves.map(m => dex.moves.get(m).id); b.item = ''; b.ability = ab; return b; };
  const A = mk(atk.sp.name, [mv, atk.shield], atk.ab), A2 = mk(atk.sp.name, [atk.shield, atk.shield], atk.ab);
  const V = mk(TGT.sp.name, ['substitute', TGT.shield], TGT.ab), V2 = mk(TGT.sp.name, [TGT.shield, TGT.shield], TGT.ab);
  const trace = [];
  const S = MEDI.battleInit([A, A2], [V, V2], { seeded: true, trace });
  const rng = () => 0.5;
  const step = (aClick, aTgt, vClick) => MEDI.battleTurn(S, rng,
    new Map([[A, MEDI.playerAction(A, aClick, aTgt, S.field)], [A2, MEDI.playerAction(A2, atk.shield, null, S.field)]]),
    new Map([[V, MEDI.playerAction(V, vClick, null, S.field)], [V2, MEDI.playerAction(V2, TGT.shield, null, S.field)]]));
  step(atk.shield, null, t1);
  const sub0 = V._sub || 0;
  const n0 = trace.length;
  step(mv, V, t2);
  const boosts = {}; for (const k of STATS) boosts[k] = (A.boosts && A.boosts[SD2ENG[k]]) || 0;
  return { sub0, sub1: V._sub || 0, boosts, recharge: !!A._recharge,
           fate: dollFate(trace.slice(n0).map(String)), lines: trace.slice(n0).map(String) };
}

function runSD(atk, mv, t1, t2) {
  const set = (n, mvs, ab) => ({ name: n, species: n, item: '', ability: dex.abilities.get(ab).name,
    moves: mvs.map(m => dex.moves.get(m).name),
    nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack([set(atk.sp.name, [mv, atk.shield], atk.ab),
                                                   set(atk.sp.name, [atk.shield, atk.shield], atk.ab)]) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack([set(TGT.sp.name, ['substitute', TGT.shield], TGT.ab),
                                                   set(TGT.sp.name, [TGT.shield, TGT.shield], TGT.ab)]) });
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  b.choose('p1', 'move ' + atk.shield + ', move ' + atk.shield);
  b.choose('p2', 'move ' + t1 + ', move ' + TGT.shield);
  const A = b.sides[0].active[0], V = b.sides[1].active[0];
  const sub0 = V.volatiles['substitute'] ? V.volatiles['substitute'].hp : 0;
  const n0 = b.log.length;
  b.choose('p1', 'move ' + mv + ' 1, move ' + atk.shield);
  b.choose('p2', 'move ' + t2 + ', move ' + TGT.shield);
  const boosts = {}; for (const k of STATS) boosts[k] = A.boosts[k] || 0;
  return { sub0, sub1: V.volatiles['substitute'] ? V.volatiles['substitute'].hp : 0, boosts,
           recharge: !!A.volatiles['mustrecharge'], fate: dollFate(b.log.slice(n0)), lines: b.log.slice(n0) };
}

/* THE DOLL'S FATE, READ OFF WHAT EACH ENGINE ANNOUNCED rather than off its HP afterwards. The
 * target re-clicks Substitute on the same turn it is hit, and it is slower, so a doll that BROKE is
 * replaced before the turn ends and the HP reading cannot tell the two apart. `-end … Substitute` is
 * the break arm of `substitute.condition.onTryPrimaryHit` and `-activate … [damage]` is the survive
 * arm; both return `HIT_SUBSTITUTE`, so either one is the situation this probe is about. */
const dollFate = lines => ({
  broke: lines.filter(l => /^\|-end\|/i.test(String(l)) && /substitute/i.test(String(l))).length,
  soaked: lines.filter(l => /^\|-activate\|/i.test(String(l)) && /substitute/i.test(String(l))).length,
});
const show = r => 'boosts ' + JSON.stringify(r.boosts) + '  doll ' + r.sub0 + '->' + r.sub1
  + '  fate ' + JSON.stringify(r.fate) + '  recharge ' + r.recharge;
const eq = (a, b2) => JSON.stringify(a) === JSON.stringify(b2);

/* ================================================================================================
 * 2 — CONTROL: no doll at all. This arm agreed BEFORE the fix and must still agree.
 * The target clicks Substitute on the SECOND turn instead of the first, so the two arms differ by
 * WHEN the doll goes up and by nothing else; the attacker outspeeds it, so its click lands on a bare
 * body. `sub0 === 0` in both engines is the assertion that this really happened.
 * ============================================================================================= */
const noM = runMedi(ATK, ATK.mv.id, TGT.shield, 'substitute');
const noS = runSD(ATK, ATK.mv.id, TGT.shield, 'substitute');
console.log('\n  NO DOLL   medi ' + show(noM) + '\n            sd   ' + show(noS));
ok(noM.sub0 === 0 && noS.sub0 === 0,
  'CONTROL — no doll was standing when the click landed, in either engine',
  'medi ' + noM.sub0 + '   authority ' + noS.sub0);
ok(eq(noM.boosts, noS.boosts) && STATS.some(k => noM.boosts[k] !== 0),
  'CONTROL — with NO Substitute up, the same click pays the same stat table in both engines',
  'medi ' + JSON.stringify(noM.boosts) + '   authority ' + JSON.stringify(noS.boosts));

/* ================================================================================================
 * 3/4/5 — the doll.
 * ============================================================================================= */
const suM = runMedi(ATK, ATK.mv.id, 'substitute', 'substitute');
const suS = runSD(ATK, ATK.mv.id, 'substitute', 'substitute');
console.log('\n  DOLL UP   medi ' + show(suM) + '\n            sd   ' + show(suS));
ok(suM.sub0 > 0 && suS.sub0 > 0 && suM.sub0 === suS.sub0
   && eq(suM.fate, suS.fate) && (suM.fate.broke + suM.fate.soaked) > 0,
  'CONTROL — the doll went up in both engines and met the same announced fate, so both arms test one situation',
  'doll medi ' + suM.sub0 + ' / sd ' + suS.sub0
  + '   fate medi ' + JSON.stringify(suM.fate) + ' / authority ' + JSON.stringify(suS.fate));
ok(eq(suM.boosts, suS.boosts),
  'TEST — through the doll, the attacker\'s own stat table matches the authority',
  'medi ' + JSON.stringify(suM.boosts) + '   authority ' + JSON.stringify(suS.boosts));
const declared = Object.keys(ATK.mv.boosts);
ok(STATS.filter(k => declared.indexOf(k) < 0).every(k => suM.boosts[k] === 0 && suS.boosts[k] === 0),
  'CONTROL — and no stat OUTSIDE the move\'s declared table moved, in either engine',
  'declared ' + JSON.stringify(declared) + '   medi ' + JSON.stringify(suM.boosts)
  + '   authority ' + JSON.stringify(suS.boosts));

/* ================================================================================================
 * 6 — CONTROL: the click is REFUSED. The authority empties the target list above `spreadMoveHit`,
 * so `selfDrops` is never called; the flush's `_reached > 0` gate must hold the same line, or a fix
 * for the doll would start paying for every shielded click.
 * ============================================================================================= */
const shM = runMedi(ATK, ATK.mv.id, 'substitute', TGT.shield);
const shS = runSD(ATK, ATK.mv.id, 'substitute', TGT.shield);
console.log('\n  SHIELDED  medi ' + show(shM) + '\n            sd   ' + show(shS));
ok(eq(shM.boosts, shS.boosts) && STATS.every(k => shS.boosts[k] === 0),
  'CONTROL — a click REFUSED by ' + TGT.shield + ' pays NOTHING in either engine',
  'medi ' + JSON.stringify(shM.boosts) + '   authority ' + JSON.stringify(shS.boosts));
ok(shM.fate.broke + shM.fate.soaked === 0 && shS.fate.broke + shS.fate.soaked === 0,
  'CONTROL — and the doll behind the shield was never reached, in either engine',
  'fate medi ' + JSON.stringify(shM.fate) + '   authority ' + JSON.stringify(shS.fate));

/* ================================================================================================
 * 7 — the OTHER payment the same step makes.
 * ============================================================================================= */
if (RATK) {
  const rM = runMedi(RATK, RATK.mv.id, 'substitute', 'substitute');
  const rS = runSD(RATK, RATK.mv.id, 'substitute', 'substitute');
  console.log('\n  RECHARGE  medi ' + show(rM) + '\n            sd   ' + show(rS));
  ok(rM.sub0 > 0 && rS.sub0 > 0
     && (rM.fate.broke + rM.fate.soaked) > 0 && (rS.fate.broke + rS.fate.soaked) > 0
     && rM.recharge === rS.recharge && rS.recharge === true,
    'TEST — a `mustrecharge` move through the doll arms the recharge in both engines',
    'fate medi ' + JSON.stringify(rM.fate) + ' / authority ' + JSON.stringify(rS.fate)
    + '   recharge medi ' + rM.recharge + ' / authority ' + rS.recharge);
} else {
  FIXTURE('no legal recharge attacker outspeeding ' + TGT.sp.name + ' — the second payment is untested');
}

/* ================================================================================================
 * 8 — COUNTER. The backstop must have RUN, not merely existed.
 * ============================================================================================= */
const C = MEDI.MEDSEEN || {};
ok((C.selfPayFlushed || 0) > 0,
  'COUNTER — the once-per-move backstop flushed `_stepSelfPay` during this run',
  'selfPayFlushed=' + (C.selfPayFlushed === undefined ? 'ABSENT' : C.selfPayFlushed)
  + '  afterHitFieldFlushed=' + (C.afterHitFieldFlushed === undefined ? 'ABSENT' : C.afterHitFieldFlushed));

/* ================================================================================================
 * THE KNOB.
 * ============================================================================================= */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [__filename],
    { env: { ...process.env, MEDI_SELFPAY_SKIPPED_ON_SUB: '1' }, encoding: 'utf8' });
  const out = String(r.stdout || '') + String(r.stderr || '');
  const a = (out.match(/^ *(PASS|FAIL) *TEST — through the doll.*$/m) || [''])[0].trim();
  const b2 = (out.match(/^ *(PASS|FAIL) *CONTROL — with NO Substitute up.*$/m) || [''])[0].trim();
  ok(r.status !== 0,
    'KNOB — removing `_stepSelfPay` from the once-per-move backstop REDS this probe',
    'child exit ' + r.status + '\n          ' + (a || '(no doll arm printed — the knob is not wired)')
    + '\n          ' + (b2 || '(no no-doll control printed)'));
}

console.log('\n  ' + (stage ? stage + ' FIXTURE problem(s) — a claim about the fixture, never about the mechanic. ' : '')
  + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad || stage ? 1 : 0);
