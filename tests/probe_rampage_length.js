/* probe_rampage_length.js — A RAMPAGE THE AUTHORITY PLAYS FOR THREE TURNS.
 *
 *   SHOWDOWN_PATH=... node tests/probe_rampage_length.js
 *   SHOWDOWN_PATH=... MEDI_RAMPAGE_TWO_TURNS=1 node tests/probe_rampage_length.js   (the red)
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * `docs/_reports/2026-09-11-plan-leaves-and-setfiller.md` E3, read off the code: medicham2 armed every
 * rampage with `turns` (2) and never read `turnsMax` (3), while the authority DRAWS the length. Every
 * differential arm pins the authority's two-argument `random(m, n)` to `m`, so both engines play two
 * turns under measurement and no instrument could see it. This file frees that one draw.
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * `data/conditions.ts:253-286`, lockedmove (no Champions override — `data/mods/champions/conditions.ts`
 * grepped for `lockedmove:`):
 *
 *     duration: 2,
 *     onResidual(target) { if (target.status === 'slp') delete target.volatiles['lockedmove'];
 *                          this.effectState.trueDuration--; },
 *     onStart(target, source, effect) { this.effectState.trueDuration = this.random(2, 4); ... },
 *     onRestart() { if (this.effectState.trueDuration >= 2) this.effectState.duration = 2; },
 *     onAfterMove(pokemon) { if (this.effectState.duration === 1) pokemon.removeVolatile('lockedmove'); },
 *     onEnd(target) { if (this.effectState.trueDuration > 1) return; target.addVolatile('confusion'); },
 *
 * `random(2, 4)` is 2 or 3. On a 3 the body is locked for turns 1-3 and fatigues on turn 3.
 *
 * ================= HOW THE DRAW IS FORCED, ON EACH SIDE =========================================
 *
 * The authority: `Battle#random` is wrapped for this battle only, and a TWO-argument call made while
 * `battle.effect` is the `lockedmove` condition (i.e. inside its `onStart`) returns the arm's value.
 * Every other draw — damage, crits, the random target — is the seeded PRNG, untouched. The number of
 * intercepted draws is COUNTED and asserted, so an interception that never fired cannot pass.
 * medicham2: one constant scalar per arm, which every stream (the new `range` one included) reads.
 *
 * ================= WHAT IS ASSERTED =============================================================
 *
 *   CONTROL  length 2 (authority forced to 2, medicham2 scalar 0.1): same run, same fatigue turn
 *   TEST     length 3 (authority forced to 3, medicham2 scalar 0.9): same run, same fatigue turn
 *   FIXTURE  the authority's TEST run is longer than its CONTROL run — the knob reached the game
 *   COUNTER  MEDSEEN.rampageLengthDrawn is non-zero on the clean run
 *   KNOB     MEDI_RAMPAGE_TWO_TURNS=1 must red TEST and leave CONTROL green
 *
 * NOT STAGED, DECLARED: a three-turn rampage INTERRUPTED on turn 2 (a flinch, a full paralysis). The
 * authority then ends the lock at turn 2's residual with NO fatigue (`trueDuration > 1` in `onEnd`). The
 * engine now carries both counters, so the path exists; nothing here drives it.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('RAMPAGE LENGTH');
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

const CHILD = process.env.MEDI_RAMPAGE_TWO_TURNS === '1';
let bad = 0, stage = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
const FIXTURE = (m) => { stage++; console.log('  FIXTURE  ' + m); };
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const buildable = s => legal(s) && !s.battleOnly && !s.isMega && !s.requiredItem;
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const INERT_MV = idOf(CS.INERT_MOVE);
const learns = (s, mv) => { try { return CS.canLearn(s.name, mv); } catch (e) { console.error('canLearn threw for ' + s.name + '/' + mv + ': ' + e.message); return false; } };
const mcRow = s => { try { return !!MEDI.buildMon(mcKey(s.name, { mayMiss: 'a probe body must be a real row' }), {}); }
  catch (e) { console.error('buildMon threw for ' + s.name + ' -- ' + e.message); return false; } };
/* NO ABILITY MAY TOUCH THE LOCK OR ITS FATIGUE (Own Tempo refuses the confusion), THE HIT, OR A STAT. */
const inertAb = s => { const ab = idOf(Object.values(s.abilities)[0]); const t = ((TAGS.abilities || {})[ab] || {}).tags || [];
  return !t.some(x => /Volatile|volatile|confus|immun|absorb|redirect|Boost|Stat|lock|Lock|punish|contact|Contact/.test(x)); };
const lsOf = s => Object.keys((dex.species.getLearnsetData(s.id) || {}).learnset || {});

console.log('\n== RAMPAGE LENGTH ==' + (CHILD ? '   [MEDI_RAMPAGE_TWO_TURNS=1]' : '') + '\n');

/* 1 — THE FIXTURE, DERIVED. */
const LOCKS = Object.keys(TAGS.moves || {}).filter(k => {
  const p = TAGS.moves[k].params && TAGS.moves[k].params.locksIntoMove;
  return p && +p.turnsMax > +p.turnsMin && legal(dex.moves.get(k));
}).sort((a, b) => (TAGS.moves[b].uses || 0) - (TAGS.moves[a].uses || 0));
console.log('  locksIntoMove members whose length is a draw (turnsMax > turnsMin): ' + (LOCKS.join(', ') || '(none)'));
if (!LOCKS.length) { console.log('  NOT RUN — no drawn-length rampage in this format. A claim about the FORMAT.'); process.exit(2); }
const LK = LOCKS[0], P = TAGS.moves[LK].params.locksIntoMove, LKT = dex.moves.get(LK).type;
console.log('  ' + LK + '.locksIntoMove = ' + JSON.stringify(P));

const freeOf = s => lsOf(s).map(id => dex.moves.get(id)).filter(m => legal(m) && m.id !== LK && m.category !== 'Status'
  && m.target === 'normal' && (m.accuracy === true || m.accuracy === 100) && !m.secondary && !m.secondaries
  && !m.multihit && !m.recoil && !m.drain && !m.self && !m.flags.charge && m.priority === 0 && !m.volatileStatus
  && !m.selfSwitch && learns(s, m.id)).sort((a, b) => a.basePower - b.basePower || a.id.localeCompare(b.id));
let RAMPER = null;
for (const s of dex.species.all().filter(buildable).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!learns(s, LK) || !inertAb(s) || !mcRow(s)) continue;
  const f = freeOf(s); if (!f.length) continue;
  RAMPER = { sp: s, free: f[0].id }; break;
}
if (!RAMPER) { FIXTURE('no legal ' + LK + ' user with an inert ability and a plain single-target free move'); process.exit(2); }
const idleOf = s => learns(s, CS.INERT_MOVE) ? INERT_MV : null;
const FOES = dex.species.all().filter(buildable)
  .filter(s => s.id !== RAMPER.sp.id && idleOf(s) && inertAb(s) && dex.getImmunity(LKT, s)
    && dex.getImmunity(dex.moves.get(RAMPER.free).type, s) && mcRow(s))
  .sort((a, b) => (b.baseStats.hp * b.baseStats.def) - (a.baseStats.hp * a.baseStats.def)).slice(0, 2);
const PAD = dex.species.all().filter(buildable).sort((a, b) => a.name.localeCompare(b.name))
  .find(s => s.id !== RAMPER.sp.id && !FOES.some(f => f.id === s.id) && idleOf(s) && inertAb(s) && mcRow(s));
if (FOES.length < 2 || !PAD) { FIXTURE('no two bulky inert foes not immune to ' + LKT + ' and one inert pad'); process.exit(2); }
console.log('\n  CHOSEN   rampager=' + RAMPER.sp.name + ' (' + Object.values(RAMPER.sp.abilities)[0] + ') ' + LK + ', free move ' + RAMPER.free
  + '\n           foes=' + FOES.map(f => f.name).join(', ') + ' (idle ' + INERT_MV + ', HP x8)   pad=' + PAD.name);

const TURNS = +P.turnsMax + 3, HPX = 8;
const MVNAME = idOf(dex.moves.get(LK).name);
const moveLine = (l, who) => { const f = String(l).split('|'); return f[1] === 'move' && f[2] && f[2].startsWith(who) ? idOf(f[3]) : null; };
const fatigue = (l, who) => /^\|-start\|/.test(String(l)) && String(l).split('|')[2].startsWith(who) && /confusion/i.test(String(l));

function runMedi(u) {
  const mk = (sp, moves) => { const b = MEDI.buildMon(mcKey(sp.name, { mayMiss: 'a probe body must be a real row' }), {});
    b.moves = moves.slice(); b.item = ''; b.ability = idOf(Object.values(sp.abilities)[0]); return b; };
  const A = mk(RAMPER.sp, [LK, RAMPER.free]), A2 = mk(PAD, [INERT_MV]);
  const V = mk(FOES[0], [INERT_MV]), V2 = mk(FOES[1], [INERT_MV]);
  for (const x of [V, V2]) { x.st = Object.assign({}, x.st, { hp: x.st.hp * HPX }); x.curHP = x.st.hp; }
  const trace = [];
  const S = MEDI.battleInit([A, A2], [V, V2], { seeded: true, trace });
  const used = [], fat = [];
  for (let t = 1; t <= TURNS; t++) {
    const n0 = trace.length;
    MEDI.battleTurn(S, () => u,
      new Map([[A, MEDI.playerAction(A, t === 1 ? LK : RAMPER.free, t === 1 ? null : V, S.field)],
               [A2, MEDI.playerAction(A2, INERT_MV, null, S.field)]]),
      new Map([[V, MEDI.playerAction(V, INERT_MV, null, S.field)], [V2, MEDI.playerAction(V2, INERT_MV, null, S.field)]]));
    const seg = trace.slice(n0);
    used.push(seg.map(l => moveLine(l, 'p1a')).filter(Boolean)[0] || '-');
    if (seg.some(l => fatigue(l, 'p1a'))) fat.push(t);
  }
  return { used, fat };
}
function runSD(force) {
  const set = (sp, mv) => ({ name: sp.name, species: sp.name, item: '', ability: Object.values(sp.abilities)[0],
    moves: mv.map(m => dex.moves.get(m).name), nature: 'Serious',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack([set(RAMPER.sp, [LK, RAMPER.free]), set(PAD, [INERT_MV])]) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack([set(FOES[0], [INERT_MV]), set(FOES[1], [INERT_MV])]) });
  let drawn = 0;
  const orig = b.random.bind(b);
  b.random = function (m, n) {
    if (n !== undefined && b.effect && b.effect.id === 'lockedmove') { drawn++; return force; }
    return orig(m, n);
  };
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  for (const p of b.sides[1].active) { p.maxhp *= HPX; p.hp = p.maxhp; }
  const me = b.sides[0].active[0];
  const used = [], fat = [];
  for (let t = 1; t <= TURNS; t++) {
    const n0 = b.log.length;
    /* A LOCKED CHOICE STILL NEEDS A TARGET NUMBER in a double — the first cut sent `move outrage` bare on
     * turn 2 and the authority refused it ("Can't move: Outrage needs a target"), so no turn after 1 ever
     * ran and both arms read a run of 1. The request's move list is the locked move alone; the slot given
     * is irrelevant to a `randomNormal` move, which re-rolls its target anyway. */
    const locked = !!me.volatiles.lockedmove;
    const click = t === 1 ? ('move ' + LK) : locked ? ('move ' + LK + ' 1') : ('move ' + RAMPER.free + ' 1');
    b.choose('p1', click + ', move ' + INERT_MV);
    b.choose('p2', 'move ' + INERT_MV + ', move ' + INERT_MV);
    const seg = b.log.slice(n0);
    used.push(seg.map(l => moveLine(l, 'p1a')).filter(Boolean)[0] || '-');
    if (seg.some(l => fatigue(l, 'p1a'))) fat.push(t);
  }
  return { used, fat, drawn };
}
const run = a => { let n = 0; while (n < a.used.length && a.used[n] === MVNAME) n++; return n; };
const J = x => JSON.stringify(x);

const arms = [
  { name: 'CONTROL', force: +P.turnsMin, u: 0.1 },
  { name: 'TEST',    force: +P.turnsMax, u: 0.9 },
];
const res = {};
for (const a of arms) {
  const m = runMedi(a.u), s = runSD(a.force);
  res[a.name] = { m, s };
  console.log('\n  ' + a.name + '  (authority forced to ' + a.force + ', medicham2 scalar ' + a.u + ')'
    + '\n    medi  used ' + J(m.used) + '   fatigue on ' + J(m.fat)
    + '\n    sd    used ' + J(s.used) + '   fatigue on ' + J(s.fat) + '   lockedmove draws intercepted ' + s.drawn);
}
console.log('');
ok(res.TEST.s.drawn >= 1 && res.CONTROL.s.drawn >= 1 && run(res.TEST.s) > run(res.CONTROL.s),
  'FIXTURE — the authority\'s length draw was intercepted and the forced value reached the game',
  'sd run CONTROL ' + run(res.CONTROL.s) + ', TEST ' + run(res.TEST.s) + '; draws ' + res.CONTROL.s.drawn + '/' + res.TEST.s.drawn);
ok(run(res.CONTROL.m) === run(res.CONTROL.s) && J(res.CONTROL.m.fat) === J(res.CONTROL.s.fat),
  'CONTROL — a ' + P.turnsMin + '-turn rampage: same run and same fatigue turn in both engines',
  'medi run ' + run(res.CONTROL.m) + ' fatigue ' + J(res.CONTROL.m.fat) + '   sd run ' + run(res.CONTROL.s) + ' fatigue ' + J(res.CONTROL.s.fat));
ok(run(res.TEST.m) === run(res.TEST.s) && J(res.TEST.m.fat) === J(res.TEST.s.fat),
  'TEST — a ' + P.turnsMax + '-turn rampage: same run and same fatigue turn in both engines',
  'medi run ' + run(res.TEST.m) + ' fatigue ' + J(res.TEST.m.fat) + '   sd run ' + run(res.TEST.s) + ' fatigue ' + J(res.TEST.s.fat)
  + (run(res.TEST.m) < run(res.TEST.s) ? '   <-- medicham2 never plays the long rampage' : ''));
if (!CHILD) {
  const C = MEDI.MEDSEEN || {};
  ok((C.rampageLengthDrawn || 0) > 0, 'COUNTER — the length draw was taken',
    'rampageLengthDrawn=' + (C.rampageLengthDrawn === undefined ? 'ABSENT' : C.rampageLengthDrawn));
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, MEDI_RAMPAGE_TWO_TURNS: '1' }, encoding: 'utf8' });
  const out = String(r.stdout || '') + String(r.stderr || '');
  const line = (out.match(/^ *(PASS|FAIL) *TEST — a .*$/m) || [''])[0].trim();
  const ctl = (out.match(/^ *(PASS|FAIL) *CONTROL — a .*$/m) || [''])[0].trim();
  ok(r.status !== 0 && /FAIL/.test(line) && /PASS/.test(ctl),
    'KNOB — restoring the fixed two-turn lock REDS the TEST arm and leaves the CONTROL green',
    'child exit ' + r.status + '   ' + (line || '(nothing printed — the knob is not wired)') + '   control: ' + (ctl || '(nothing)'));
}
console.log('\n  ' + (stage ? stage + ' FIXTURE problem(s) — a claim about the fixture, never about the mechanic. ' : '')
  + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad || stage ? 1 : 0);
