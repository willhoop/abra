/* probe_ability_flag_refusal.js — A MOVE THAT REFUSES ON AN ABILITY FLAG, PUT TO THE AUTHORITY.
 *
 *   SHOWDOWN_PATH=... node tests/probe_ability_flag_refusal.js
 *   SHOWDOWN_PATH=... MEDI_ABILITY_FLAG_REFUSAL_UNREAD=1 node tests/probe_ability_flag_refusal.js   (the red)
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * docs/_reports/2026-09-11-plan-tags.md §3b put six flag halves under `refusesCopy` and said: "I did
 * not verify which of the six flags the three readers actually consult." Reading them: Trace asks
 * `notrace`, Receiver asks `noreceiver`, Role Play asks `failroleplay` and `cantsuppress`. The other
 * copy/suppress moves ask NOTHING:
 *
 *   Simple Beam, Worry Seed, Entrainment   onTryHit: `target.getAbility().flags['cantsuppress']`
 *                                          (Entrainment also `source.getAbility().flags['noentrain']`)
 *   Gastro Acid                            onTryHit: `target.getAbility().flags['cantsuppress']`
 *   Skill Swap                             onHit -> Battle#skillSwap (sim/battle.ts):
 *                                          `sourceAbility.flags['failskillswap'] || targetAbility.flags[...]`
 *
 * medicham2's `abilitywrite` branch checked only the tag's `refusedAbilities` list, its `abilityswap`
 * branch checked neither body's flag, and Gastro Acid wrote its volatile onto anything.
 *
 * ================= WHAT IS ASSERTED =============================================================
 *
 * One turn per arm, both engines, every body legal and every move on its user's validated learnset —
 * DERIVED, with a refusal printed rather than a substitute. For each move: a TEST arm aimed at a body
 * whose ability carries the flag, and a CONTROL arm aimed at a body with Intimidate (no flag). After the
 * turn both bodies' abilities, and for Gastro Acid whether the target's ability is suppressed, are read
 * out of BOTH engines and must agree. The authority must refuse the TEST arm and allow the CONTROL, or
 * the fixture says so and the file stops — so no arm can pass by both engines doing nothing.
 *
 * NOT STAGED, DECLARED: Entrainment's `noentrain` half and Skill Swap's USER half — no legal learner of
 * either move carries an ability with that flag (derived and printed below). The engine fix reads both
 * halves anyway; nothing here can drive them.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('ABILITY FLAG REFUSAL');
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

const CHILD = process.env.MEDI_ABILITY_FLAG_REFUSAL_UNREAD === '1';
let bad = 0, stage = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
const FIXTURE = (m) => { stage++; console.log('  FIXTURE  ' + m); };
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const buildable = s => legal(s) && !s.battleOnly && !s.isMega && !s.requiredItem;
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const learns = (s, mv) => { try { return CS.canLearn(s.name, mv); } catch (e) { console.error('canLearn threw for ' + s.name + '/' + mv + ': ' + e.message); return false; } };
const mcRow = s => { try { return !!MEDI.buildMon(mcKey(s.name, { mayMiss: 'a probe body must be a real row' }), {}); }
  catch (e) { console.error('buildMon threw for ' + s.name + ' -- ' + e.message); return false; } };
const lsOf = s => Object.keys((dex.species.getLearnsetData(s.id) || {}).learnset || {});
const RC = ab => { const r = (TAGS.abilities || {})[idOf(ab)]; return (r && r.params && r.params.refusesCopy) || null; };
const slot0 = s => Object.values(s.abilities)[0];
/* A body's idle click: a pure self-boost it learns (never Protect — every body here is a TARGET). */
const idleOf = s => lsOf(s).map(id => dex.moves.get(id)).filter(m => legal(m) && m.category === 'Status'
  && m.target === 'self' && m.boosts && !m.onHit && !m.onTryHit && !m.onTry && !m.volatileStatus && !m.heal
  && learns(s, m.id)).map(m => m.id).sort()[0] || null;

console.log('\n== A MOVE THAT REFUSES ON AN ABILITY FLAG ==' + (CHILD ? '   [MEDI_ABILITY_FLAG_REFUSAL_UNREAD=1]' : '') + '\n');

/* 1 — WHICH MOVES, WHICH FLAG, WHICH SIDE: off data/tags.json's `refusedByAbilityFlag`. */
const FAM = Object.keys(TAGS.moves || {}).filter(k => (TAGS.moves[k].tags || []).includes('refusedByAbilityFlag')
  && legal(dex.moves.get(k))).sort();
console.log('  refusedByAbilityFlag members: ' + (FAM.map(k => k + ' ' + JSON.stringify(TAGS.moves[k].params.refusedByAbilityFlag)).join('; ') || '(none)'));
if (!FAM.length) { FIXTURE('data/tags.json carries no refusedByAbilityFlag member — regenerate it (engine/tag_dex.js)'); process.exit(2); }

/* The refusing TARGET for a flag: the first legal buildable body whose slot-0 ability carries it. */
const refuser = flag => dex.species.all().filter(buildable).sort((a, b) => a.name.localeCompare(b.name))
  .find(s => RC(slot0(s)) && RC(slot0(s))[flag] && idleOf(s) && mcRow(s)) || null;
const control = dex.species.all().filter(buildable).sort((a, b) => a.name.localeCompare(b.name))
  .find(s => idOf(slot0(s)) === 'intimidate' && idleOf(s) && mcRow(s)) || null;
const pad = dex.species.all().filter(buildable).sort((a, b) => a.name.localeCompare(b.name))
  .find(s => !RC(slot0(s)) && idOf(slot0(s)) !== 'intimidate' && idleOf(s) && mcRow(s)) || null;
if (!control || !pad) { FIXTURE('no legal Intimidate control body or pad'); process.exit(2); }

const ARMS = [];
for (const mv of FAM) {
  const p = TAGS.moves[mv].params.refusedByAbilityFlag;
  for (const flag of (p.target || [])) {
    const user = dex.species.all().filter(buildable).sort((a, b) => a.name.localeCompare(b.name))
      .find(s => learns(s, mv) && !RC(slot0(s)) && idOf(slot0(s)) !== 'intimidate' && idleOf(s) && mcRow(s));
    const tgt = refuser(flag);
    if (!user || !tgt) { console.log('  NOT STAGED  ' + mv + ' target ' + flag + ' — ' + (!user ? 'no plain legal learner' : 'no legal body carries it')); continue; }
    ARMS.push({ mv, flag, side: 'target', user, tgt });
  }
  for (const flag of (p.source || [])) {
    const carriers = dex.species.all().filter(buildable).filter(s => learns(s, mv) && RC(slot0(s)) && RC(slot0(s))[flag]);
    console.log('  DECLARED  ' + mv + ' source ' + flag + ' — legal learners carrying it: ' + (carriers.map(s => s.name).join(', ') || 'NONE, so unreachable with a legal set'));
  }
}
console.log('  control target ' + control.name + ' (' + slot0(control) + ')   pad ' + pad.name + '\n');

const readMedi = (arm, tgtSp) => {
  const mk = (sp, moves) => { const b = MEDI.buildMon(mcKey(sp.name, { mayMiss: 'a probe body must be a real row' }), {});
    b.moves = moves.slice(); b.item = ''; b.ability = idOf(slot0(sp)); return b; };
  const A = mk(arm.user, [arm.mv]), A2 = mk(pad, [idleOf(pad)]);
  const V = mk(tgtSp, [idleOf(tgtSp)]), V2 = mk(pad, [idleOf(pad)]);
  const S = MEDI.battleInit([A, A2], [V, V2], { seeded: true });
  MEDI.battleTurn(S, () => 0.5,
    new Map([[A, MEDI.playerAction(A, arm.mv, V, S.field)], [A2, MEDI.playerAction(A2, idleOf(pad), null, S.field)]]),
    new Map([[V, MEDI.playerAction(V, idleOf(tgtSp), null, S.field)], [V2, MEDI.playerAction(V2, idleOf(pad), null, S.field)]]));
  return { user: idOf(A.ability), target: idOf(V.ability), suppressed: !!(V._vol && V._vol.gastroacid) };
};
const readSD = (arm, tgtSp) => {
  const set = (sp, mv) => ({ name: sp.name, species: sp.name, item: '', ability: slot0(sp), moves: mv.map(m => dex.moves.get(m).name),
    nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack([set(arm.user, [arm.mv]), set(pad, [idleOf(pad)])]) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack([set(tgtSp, [idleOf(tgtSp)]), set(pad, [idleOf(pad)])]) });
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  const U = b.sides[0].active[0], V = b.sides[1].active[0];
  b.choose('p1', 'move ' + arm.mv + ' 1, move ' + idleOf(pad));
  b.choose('p2', 'move ' + idleOf(tgtSp) + ', move ' + idleOf(pad));
  return { user: idOf(U.ability), target: idOf(V.ability), suppressed: !!V.volatiles.gastroacid };
};
const J = x => JSON.stringify(x);

for (const arm of ARMS) {
  const tS = readSD(arm, arm.tgt), cS = readSD(arm, control), tM = readMedi(arm, arm.tgt), cM = readMedi(arm, control);
  const name = arm.mv + ' into ' + arm.tgt.name + ' (' + slot0(arm.tgt) + ', ' + arm.flag + ')';
  console.log('  ' + name + '\n    TEST     sd ' + J(tS) + '   medi ' + J(tM)
    + '\n    CONTROL  sd ' + J(cS) + '   medi ' + J(cM) + '  (into ' + control.name + ')');
  const changed = (r, sp) => r.target !== idOf(slot0(sp)) || r.suppressed || r.user !== idOf(slot0(arm.user));
  ok(!changed(tS, arm.tgt) && changed(cS, control),
    'FIXTURE — ' + arm.mv + ': the authority REFUSES the ' + arm.flag + ' body and ALLOWS the Intimidate body',
    'test ' + J(tS) + '   control ' + J(cS));
  ok(J(cM) === J(cS), 'CONTROL — ' + arm.mv + ' into Intimidate: the two engines agree', 'sd ' + J(cS) + '  medi ' + J(cM));
  ok(J(tM) === J(tS), 'TEST — ' + arm.mv + ' into a ' + arm.flag + ' body: the two engines agree', 'sd ' + J(tS) + '  medi ' + J(tM));
}
if (!ARMS.length) FIXTURE('no arm could be staged');
if (!CHILD) {
  const C = MEDI.MEDSEEN || {};
  ok((C.abilityFlagRefused || 0) > 0, 'COUNTER — the refusal was reached', 'abilityFlagRefused=' + (C.abilityFlagRefused === undefined ? 'ABSENT' : C.abilityFlagRefused));
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, MEDI_ABILITY_FLAG_REFUSAL_UNREAD: '1' }, encoding: 'utf8' });
  const out = String(r.stdout || '') + String(r.stderr || '');
  /* THE KNOB GOVERNS `abilityFlagRefusal` AND NOTHING ELSE. Role Play's refusal was ALREADY read before
   * this change, through its own `copiesTargetAbility.targetFlagRefuses`, and its branch deliberately does
   * not call the new reader — so its TEST arm must stay GREEN under the knob. The first cut demanded every
   * TEST arm go red and failed on exactly that arm. */
  const tests = (out.match(/^ *(PASS|FAIL) *TEST — .*$/mg) || []), ctls = (out.match(/^ *(PASS|FAIL) *CONTROL — .*$/mg) || []);
  const pre = l => /TEST — roleplay /.test(l);
  const governed = tests.filter(l => !pre(l)), kept = tests.filter(pre);
  ok(r.status !== 0 && governed.length && governed.every(l => /FAIL/.test(l)) && kept.every(l => /PASS/.test(l))
     && ctls.length && ctls.every(l => /PASS/.test(l)),
    'KNOB — taking the new reader back out REDS every TEST arm it governs, leaves Role Play\'s (read before) and every CONTROL green',
    'child exit ' + r.status + '   governed TEST ' + governed.map(l => /PASS/.test(l) ? 'pass' : 'fail').join(',')
    + '   Role Play TEST ' + kept.map(l => /PASS/.test(l) ? 'pass' : 'fail').join(',')
    + '   CONTROL ' + ctls.map(l => /PASS/.test(l) ? 'pass' : 'fail').join(','));
}
console.log('\n  ' + (stage ? stage + ' FIXTURE problem(s) — a claim about the fixture, never about the mechanic. ' : '')
  + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad || stage ? 1 : 0);
