/* probe_magnetrise_clock.js — MAGNET RISE ENDS AFTER FIVE RESIDUALS IN THE AUTHORITY AND NEVER HERE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_magnetrise_clock.js
 *   SHOWDOWN_PATH=... MEDI_MAGNETRISE_NO_CLOCK=1 node tests/probe_magnetrise_clock.js   (the red)
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * `docs/_reports/2026-09-11-plan-leaves-and-setfiller.md`, item E1, read off the code: medicham2's
 * generic volatile write gives `magnetrise` a bare `1` (`applyMoveVolatile`, the `_tn` fallback), it
 * is in neither `durationVolatiles()` nor `perTurnBoostVolatiles()`, and nothing ticks it — the file's
 * own note at `RESIDUAL_CLOCK_READER` called `magnetrise@18` "a volatile that never ends ... a MISSING
 * TICK". A body that clicked Magnet Rise was immune to Ground for the rest of the game.
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * `data/moves.ts:10856-10891`, magnetrise (Champions overrides neither the move nor a condition by
 * that name — `data/mods/champions/{moves,conditions}.ts` grepped for `magnetrise:`):
 *
 *     condition: {
 *       duration: 5,
 *       onStart(target) { this.add('-start', target, 'Magnet Rise'); },
 *       onImmunity(type) { if (type === 'Ground') return false; },
 *       onResidualOrder: 18,
 *       onEnd(target) { this.add('-end', target, 'Magnet Rise'); },
 *     },
 *
 * and the clock is `sim/battle.ts`'s residual walk: `duration--`, and `end` on zero. Applied on turn 1,
 * it is spent by the residuals of turns 1..5 and ends at turn 5's. `data/residual-order.json` carries
 * the row (`expiry:magnetrise`, order 18, duration 5), which is where the engine reads it from.
 *
 * ================= WHAT IS ASSERTED, AND ON WHAT ================================================
 *
 *   1  FIXTURE   the riser, the Ground attacker and every filler are DERIVED and printed
 *   2  CONTROL   with the riser clicking a filler instead, the Ground move lands from turn 2 in BOTH
 *                engines — so a missing hit below is the volatile and nothing else about the fixture
 *   3  TEST      the first turn (>= 2) on which the Ground move lands again agrees with the authority
 *   4  TEST      the `-end … Magnet Rise` line is written once, on the authority's turn
 *   5  COUNTER   MEDSEEN.magnetRiseClockExpired is non-zero on the clean run
 *
 * Turn 1 is excluded from every comparison: whether the Ground move lands BEFORE the rise depends on
 * which body is faster, and the two engines' bodies are built by different builders. What is compared
 * is only the clock, which is the same whichever of them moved first.
 *
 * `MEDI_MAGNETRISE_NO_CLOCK=1` restores the bare `1` and the missing tick. The parent re-runs ITSELF as
 * a child under it and FAILS if the child's TEST arm passes.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('MAGNET RISE CLOCK');
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

const CHILD = process.env.MEDI_MAGNETRISE_NO_CLOCK === '1';
let bad = 0, stage = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
const FIXTURE = (m) => { stage++; console.log('  FIXTURE  ' + m); };
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const buildable = s => legal(s) && !s.battleOnly && !s.isMega && !s.requiredItem;
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };

console.log('\n== MAGNET RISE\'S CLOCK ==' + (CHILD ? '   [MEDI_MAGNETRISE_NO_CLOCK=1]' : '') + '\n');

/* ================================================================================================
 * 1 — THE FIXTURE, DERIVED.
 * ============================================================================================= */
const RISE = Object.keys(TAGS.moves || {}).filter(k => {
  const si = TAGS.moves[k].params && TAGS.moves[k].params.statusInflict;
  return si && Array.isArray(si.effects) && si.effects.some(e => e.volatile === 'magnetrise' && e.to === 'user')
    && legal(dex.moves.get(k));
});
console.log('  moves that put `magnetrise` on their user (data/tags.json statusInflict): ' + (RISE.join(', ') || '(none)'));
if (!RISE.length) { console.log('  NOT RUN — no legal move applies magnetrise. A claim about the FORMAT.'); process.exit(2); }
const RISEMV = RISE[0];
const ROW = (require(D('data', 'residual-order.json')).rows || []).find(r => r.ns === 'expiry' && r.id === 'magnetrise');
console.log('  data/residual-order.json expiry:magnetrise = ' + JSON.stringify(ROW && { order: ROW.order, duration: ROW.duration, announceLine: ROW.announceLine }));
if (!ROW || !(ROW.duration > 0)) { FIXTURE('no expiry row with a duration for magnetrise'); process.exit(2); }

/* A PURE SELF-BOOST FILLER. Every HP-costing or volatile-setting self move is refused by shape — a
 * Substitute or a Belly Drum filler would move the riser's HP for a reason that is not the attack. */
const FILLER = s => Object.keys(LS(s)).filter(id => { const m = dex.moves.get(id);
  return legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts && !m.onHit && !m.onTryHit
    && !m.onTry && !m.volatileStatus && !m.heal && !m.self && !m.selfSwitch && !m.stallingMove && id !== RISEMV; });
const INERT = s => { const ab = dex.abilities.get(Object.values(s.abilities)[0]); const t = ((TAGS.abilities || {})[ab.id] || {}).tags || [];
  return !t.some(x => /immun|absorb|heal|regen|residual|redirect|boostsWhen|Boost/i.test(x)); };
const mcRow = s => { try { return !!MEDI.buildMon(mcKey(s.name, { mayMiss: 'the probe body must be a real row' }), {}); }
  catch (e) { console.error('probe fixture: buildMon threw for ' + s.name + ' -- ' + e.message + ' (the pool is narrower than the format).'); return false; } };

let RISER = null;
for (const s of dex.species.all().filter(buildable).sort((a, b) => (b.baseStats.hp * b.baseStats.def) - (a.baseStats.hp * a.baseStats.def))) {
  if (!LS(s)[RISEMV] || !FILLER(s).length || !INERT(s)) continue;
  if (!dex.getImmunity('Ground', s)) continue;            // a Flying/Ground-immune body cannot show the clock
  if (!mcRow(s)) continue;
  RISER = { sp: s, fill: FILLER(s)[0] }; break;
}
if (!RISER) { FIXTURE('no legal ' + RISEMV + ' user with a pure self-boost filler, an inert slot-0 ability and no Ground immunity'); process.exit(2); }

/* THE ATTACKER: the weakest single-target Ground attack any legal body learns, so the riser's inflated
 * HP pool outlasts every landing turn. What this probe reads is WHICH TURNS the move lands on, so a
 * varying power or a stat-drop secondary is harmless and is allowed; a miss, a status or a volatile is
 * not (the first version refused every secondary and every power callback and found nothing at all). */
const quietSecondary = m => { const s = [].concat(m.secondary || [], m.secondaries || []);
  return s.every(x => x && !x.status && !x.volatileStatus && !x.self && !x.onHit); };
let ATT = null;
for (const s of dex.species.all().filter(buildable).sort((a, b) => a.name.localeCompare(b.name))) {
  if (s.id === RISER.sp.id || !FILLER(s).length || !INERT(s) || !mcRow(s)) continue;
  for (const id of Object.keys(LS(s))) {
    const m = dex.moves.get(id);
    if (!legal(m) || m.type !== 'Ground' || m.category === 'Status' || m.target !== 'normal') continue;
    if (!(m.accuracy === true || m.accuracy === 100) || !quietSecondary(m) || m.multihit || m.recoil
        || m.drain || m.self || m.flags.charge || m.priority !== 0 || m.ohko || m.damage || m.volatileStatus) continue;
    if (!ATT || m.basePower < ATT.bp) ATT = { sp: s, mv: m.id, bp: m.basePower, fill: FILLER(s)[0] };
  }
}
if (!ATT) { FIXTURE('no legal body with a plain single-target Ground attack and a pure self-boost filler'); process.exit(2); }

console.log('\n  CHOSEN   riser=' + RISER.sp.name + ' (ability ' + Object.values(RISER.sp.abilities)[0] + ', filler ' + RISER.fill + ')'
  + '\n           attacker=' + ATT.sp.name + ' clicking ' + ATT.mv + ' (' + ATT.bp + ' BP) every turn, filler ' + ATT.fill);

const TURNS = ROW.duration + 3;
const HPX = 8;          // the riser cannot faint: the observable is WHICH turns the attack lands on

function runMedi(rise) {
  const mk = (sp, moves) => { const b = MEDI.buildMon(mcKey(sp.name, { mayMiss: 'a probe body must be a real row' }), {});
    b.moves = moves.slice(); b.item = ''; b.ability = 'none'; return b; };
  const A = mk(ATT.sp, [ATT.mv, ATT.fill]), A2 = mk(ATT.sp, [ATT.fill]);
  const V = mk(RISER.sp, [RISEMV, RISER.fill]), V2 = mk(RISER.sp, [RISER.fill]);
  V.st = Object.assign({}, V.st, { hp: V.st.hp * HPX }); V.curHP = V.st.hp;
  const trace = [];
  const S = MEDI.battleInit([A, A2], [V, V2], { seeded: true, trace });
  const hits = [], ends = [];
  for (let t = 1; t <= TURNS; t++) {
    const n0 = trace.length, hp0 = V.curHP;
    MEDI.battleTurn(S, () => 0.5,
      new Map([[A, MEDI.playerAction(A, ATT.mv, V, S.field)], [A2, MEDI.playerAction(A2, ATT.fill, null, S.field)]]),
      new Map([[V, MEDI.playerAction(V, (t === 1 && rise) ? RISEMV : RISER.fill, null, S.field)],
               [V2, MEDI.playerAction(V2, RISER.fill, null, S.field)]]));
    if (V.curHP < hp0) hits.push(t);
    if (trace.slice(n0).some(l => /^\|-end\|/.test(String(l)) && /magnet ?rise/i.test(String(l)))) ends.push(t);
    if (V.fainted) { FIXTURE('the riser fainted on turn ' + t + ' in medicham2'); break; }
  }
  return { hits, ends };
}

function runSD(rise) {
  const set = (sp, mv) => ({ name: sp.name, species: sp.name, item: '', ability: Object.values(sp.abilities)[0],
    moves: mv.map(m => dex.moves.get(m).name),
    nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack([set(ATT.sp, [ATT.mv, ATT.fill]), set(ATT.sp, [ATT.fill, ATT.fill])]) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack([set(RISER.sp, [RISEMV, RISER.fill]), set(RISER.sp, [RISER.fill, RISER.fill])]) });
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  const vic = b.sides[1].active[0];
  vic.maxhp *= HPX; vic.hp = vic.maxhp;
  const hits = [], ends = [];
  for (let t = 1; t <= TURNS; t++) {
    const n0 = b.log.length, hp0 = vic.hp;
    b.choose('p1', 'move ' + ATT.mv + ' 1, move ' + ATT.fill);
    b.choose('p2', 'move ' + ((t === 1 && rise) ? RISEMV : RISER.fill) + ', move ' + RISER.fill);
    if (vic.hp < hp0) hits.push(t);
    if (b.log.slice(n0).some(l => /^\|-end\|/.test(l) && /Magnet Rise/.test(l))) ends.push(t);
    if (vic.fainted) { FIXTURE('the riser fainted on turn ' + t + ' in the authority'); break; }
  }
  return { hits, ends };
}
const after1 = a => a.filter(t => t >= 2);

/* 2 — CONTROL. */
const cM = runMedi(false), cS = runSD(false);
ok(after1(cM.hits)[0] === 2 && after1(cS.hits)[0] === 2 && !cM.ends.length && !cS.ends.length,
  'CONTROL — with no Magnet Rise the Ground move lands from turn 2 in BOTH engines, and nothing announces an end',
  'medi hits ' + JSON.stringify(cM.hits) + '   sd hits ' + JSON.stringify(cS.hits));

/* THE RISE ARM. */
const rM = runMedi(true), rS = runSD(true);
console.log('\n  RISE  medi  hits on ' + JSON.stringify(rM.hits) + '  `-end` on ' + JSON.stringify(rM.ends)
  + '\n        sd    hits on ' + JSON.stringify(rS.hits) + '  `-end` on ' + JSON.stringify(rS.ends) + '\n');
ok(rS.ends.length === 1 && rS.ends[0] === ROW.duration && after1(rS.hits)[0] === ROW.duration + 1,
  'FIXTURE — the authority ends the rise at turn ' + ROW.duration + '\'s residual and is hit again on turn ' + (ROW.duration + 1),
  'sd `-end` ' + JSON.stringify(rS.ends) + '  first hit after turn 1: ' + after1(rS.hits)[0]);

/* 3 — TEST. */
ok(after1(rM.hits)[0] != null && after1(rM.hits)[0] === after1(rS.hits)[0],
  'TEST — the Ground move lands again on the same turn in both engines',
  'medi first hit after turn 1: ' + after1(rM.hits)[0] + '   authority: ' + after1(rS.hits)[0]
  + (after1(rM.hits)[0] == null ? '   <-- the volatile never ended' : ''));

/* 4 — TEST. */
ok(rM.ends.length === 1 && rM.ends[0] === rS.ends[0],
  'TEST — `-end … Magnet Rise` is written once, on the authority\'s turn',
  'medi ' + JSON.stringify(rM.ends) + '   authority ' + JSON.stringify(rS.ends));

/* 5 — COUNTER. */
if (!CHILD) {
  const C = MEDI.MEDSEEN || {};
  ok((C.magnetRiseClockExpired || 0) > 0,
    'COUNTER — the clock expired the volatile during this run',
    'magnetRiseClockExpired=' + (C.magnetRiseClockExpired === undefined ? 'ABSENT' : C.magnetRiseClockExpired));
}

/* THE KNOB. */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, MEDI_MAGNETRISE_NO_CLOCK: '1' }, encoding: 'utf8' });
  const out = String(r.stdout || '') + String(r.stderr || '');
  const line = (out.match(/^ *(PASS|FAIL) *TEST — the Ground move lands again.*$/m) || [''])[0].trim();
  const ctl = (out.match(/^ *(PASS|FAIL) *CONTROL — with no Magnet Rise.*$/m) || [''])[0].trim();
  ok(r.status !== 0 && /FAIL/.test(line) && /PASS/.test(ctl),
    'KNOB — restoring the bare 1 and the missing tick REDS the TEST arm and leaves the CONTROL green',
    'child exit ' + r.status + '   ' + (line || '(the arm printed nothing — the knob is not wired)') + '   control: ' + (ctl || '(nothing)'));
}

console.log('\n  ' + (stage ? stage + ' FIXTURE problem(s) — a claim about the fixture, never about the mechanic. ' : '')
  + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad || stage ? 1 : 0);
