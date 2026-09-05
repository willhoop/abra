/* probe_perishsong_field.js — PERISH SONG MARKS A SOUNDPROOF BODY, AND ANNOUNCES A FIELD ACTIVATION
 * ON A CLICK THAT AFFECTED NOBODY.
 *
 *   SHOWDOWN_PATH=... node tests/probe_perishsong_field.js
 *   SHOWDOWN_PATH=... MEDI_PERISH_ALWAYS_ACTIVATES=1 node tests/probe_perishsong_field.js   (the red)
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * EIGHT of the 141 protocol divergences on release `0dec37ff5ad9` are this one handler, and one of
 * them parts a BOARD:
 *
 *   pair-protect-bust t11  ...2655134691  sd |-immune|p1b: Kommo-o|[from] ability: Soundproof
 *                                         us |-start|p1b: Kommo-o|perish3
 *                                         board  p1.active[1].vol.perish   medi 3 / sd 0
 *   seven more, on five configurations:   sd |-fail|<the user>
 *                                         us |-fieldactivate|move: Perish Song
 *
 * The second shape is one click after another Perish Song, when every body on the field is already
 * counting down.
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * `data/moves.ts` perishsong.onHitField (Champions overrides the MOVE nowhere — the only
 * `perishsong` hits under `data/mods/champions/` are in `learnsets.ts`):
 *
 *     onHitField(target, source, move) {
 *       let result = false;  let message = false;
 *       for (const pokemon of this.getAllActive()) {
 *         if (this.runEvent('Invulnerability', pokemon, source, move) === false) {
 *           this.add('-miss', source, pokemon);  result = true;
 *         } else if (this.runEvent('TryHit', pokemon, source, move) === null) {
 *           result = true;
 *         } else if (!pokemon.volatiles['perishsong']) {
 *           pokemon.addVolatile('perishsong');
 *           this.add('-start', pokemon, 'perish3', '[silent]');
 *           result = true;  message = true;
 *         }
 *       }
 *       if (!result) return false;                       // <- the move FAILS: `|-fail|<source>`
 *       if (message) this.add('-fieldactivate', 'move: Perish Song');
 *     }
 *
 * Two facts this engine did not carry. **A body that already holds the clock contributes NOTHING to
 * `result`** — so a second Perish Song into a field that is already counting affects nobody and the
 * whole move fails. And the `-fieldactivate` is gated on `message`, which is raised only by a volatile
 * that actually LANDED, so a click that only met refusals says nothing at all.
 *
 * `data/abilities.ts` soundproof.onTryHit is `if (target !== source && move.flags['sound']) {
 * this.add('-immune', target, '[from] ability: Soundproof'); return null; }` — and Perish Song carries
 * `flags: { sound: 1, ... }`. That is the `TryHit === null` arm above.
 *
 * medicham2's perish branch asked `tryHitRefusal` (which covers `refusesStatusMoves`, Prankster and
 * the type absorbers) and never asked `moveClassBlocked` — the reader fifteen other branches in this
 * file already call beside it. So Soundproof, Bulletproof and Overcoat were invisible to this one
 * move, and the `-fieldactivate` was pushed unconditionally at the foot of the loop.
 *
 * ================= WHAT IS ASSERTED, AND ON WHAT ================================================
 *
 * The clock itself is read off each engine's own state — `_perish` here, `volatiles.perishsong`
 * there. The two protocol lines this file reads are the two the handler is about.
 *
 *   1  FIXTURE   the carriers, the move and the clock length are derived and printed
 *   2  CONTROL   the same body carrying its OTHER legal ability takes the clock in BOTH engines —
 *                so a refusal below is the ability and not the fixture
 *   3  TEST      a Soundproof body takes NO clock, in both engines
 *   4  TEST      and both engines announce the refusal naming the ability
 *   5  CONTROL   the FIRST Perish Song announces `-fieldactivate` and fails in neither engine
 *   6  TEST      a SECOND Perish Song into a field that is already counting FAILS in both engines,
 *                and announces no field activation
 *   7  CONTROL   and it does not reset anybody's clock — the counters are equal across the engines
 *                before and after the second click
 *   8  COUNTER   MEDSEEN.perishMarked and MEDSEEN.perishNoTarget are non-zero, so the loop really ran
 *                and really reached the no-result arm
 *
 * `MEDI_PERISH_ALWAYS_ACTIVATES=1` restores both halves. The parent re-runs ITSELF under it and
 * FAILS if that child passes.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('PERISH SONG AS A FIELD MOVE');
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

const CHILD = process.env.MEDI_PERISH_ALWAYS_ACTIVATES === '1';
let bad = 0, stage = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
const FIXTURE = (m) => { stage++; console.log('  FIXTURE  ' + m); };
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };

console.log('\n== PERISH SONG: THE REFUSAL AND THE EMPTY CLICK =='
  + (CHILD ? '   [MEDI_PERISH_ALWAYS_ACTIVATES=1]' : '') + '\n');

/* ================================================================================================
 * 1 — THE FIXTURE, DERIVED.
 * ============================================================================================= */
const PERISH = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('perishClock') >= 0 && legal(dex.moves.get(k)))
  .map(k => ({ id: k, turns: +TAGS.moves[k].params.perishClock.turns, uses: TAGS.moves[k].uses || 0 }))
  .sort((a, b) => b.uses - a.uses);
console.log('  THE `perishClock` FAMILY legal here: '
  + (PERISH.map(p => p.id + ' turns=' + p.turns + ' uses=' + p.uses).join(', ') || 'NONE'));
if (!PERISH.length) { console.log('  NOT RUN — no legal perish move. A claim about the format.'); process.exit(2); }
const PS = PERISH[0];
const SOUND = !!(TAGS.moves[PS.id] && (TAGS.moves[PS.id].tags || []).indexOf('sound') >= 0);
console.log('  ' + PS.id + ' carries the `sound` tag: ' + SOUND);

/* THE REFUSERS: abilities whose `immuneToMoveClass.blocksFlag` matches a flag this move carries. */
const REFUSERS = Object.keys(TAGS.abilities || {})
  .map(k => ({ id: k, p: (TAGS.abilities[k].params || {}).immuneToMoveClass }))
  .filter(a => a.p && a.p.blocksFlag === 'sound');
console.log('  abilities whose `immuneToMoveClass` blocks `sound`: '
  + (REFUSERS.map(a => a.id).join(', ') || 'NONE'));
if (!SOUND || !REFUSERS.length) { console.log('  NOT RUN — nothing refuses this move by class here.'); process.exit(2); }

/* THE CARRIER: a legal body with a sound-refusing ability AND a second legal ability that is NOT a
 * refuser — the second is the CONTROL arm, so the only thing that moves between arms is the ability. */
let CAR = null;
for (const s of dex.species.all().filter(legal).sort((a, b) => a.name.localeCompare(b.name))) {
  const abs = Object.values(s.abilities).map(a => dex.abilities.get(a).id);
  const ref = abs.find(a => REFUSERS.some(r => r.id === a));
  if (!ref) continue;
  /* The control ability must not refuse this move for a SECOND reason. */
  const ctl = abs.find(a => a !== ref
    && !((TAGS.abilities[a] || {}).params || {}).immuneToMoveClass
    && !((TAGS.abilities[a] || {}).params || {}).refusesStatusMoves);
  if (!ctl) continue;
  let built = null; try { built = MEDI.buildMon(mcKey(s.name, { mayMiss: 'the refuser must be a real row' }), {}); } catch (e) { built = null; console.error('probe fixture: buildMon threw for ' + (s && s.name) + ' -- ' + e.message + '. The candidate pool is NARROWER than the format, so a COULD-NOT-STAGE below is a statement about this search and NOT about the mechanic.'); }
  if (!built) continue;
  CAR = { sp: s, ref, ctl }; break;
}
if (!CAR) { FIXTURE('no legal body carrying a sound refuser AND a non-refusing second ability'); process.exit(2); }

/* THE SINGER: a legal body that learns the perish move plus a self-status filler. */
const SELF_STATUS = s => Object.keys(LS(s)).filter(id => { const m = dex.moves.get(id);
  return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
    && !m.flags.charge && !m.selfSwitch && !m.stallingMove && !m.heal; });
let SING = null;
for (const s of dex.species.all().filter(legal).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!LS(s)[PS.id]) continue;
  const abs = Object.values(s.abilities).map(a => dex.abilities.get(a).id);
  if (abs.some(a => REFUSERS.some(r => r.id === a))) continue;   /* the singer must not refuse itself */
  const fill = SELF_STATUS(s); if (!fill.length) continue;
  let built = null; try { built = MEDI.buildMon(mcKey(s.name, { mayMiss: 'the singer must be a real row' }), {}); } catch (e) { built = null; console.error('probe fixture: buildMon threw for ' + (s && s.name) + ' -- ' + e.message + '. The candidate pool is NARROWER than the format, so a COULD-NOT-STAGE below is a statement about this search and NOT about the mechanic.'); }
  if (!built) continue;
  SING = { sp: s, fill: fill[0], ab: abs[0] }; break;
}
if (!SING) { FIXTURE('no legal singer for ' + PS.id + ' with a self-status filler'); process.exit(2); }

/* A FILLER for the refuser body itself, so it never attacks. */
const CARFILL = SELF_STATUS(CAR.sp)[0];
if (!CARFILL) { FIXTURE(CAR.sp.name + ' has no self-status filler'); process.exit(2); }

console.log('\n  CHOSEN   move=' + PS.id + '   singer=' + SING.sp.name + ' (' + SING.ab + ', filler ' + SING.fill + ')'
  + '\n           refuser=' + CAR.sp.name + '   refusing ability=' + CAR.ref + '   CONTROL ability='
  + CAR.ctl + '   filler=' + CARFILL);

/* ================================================================================================
 * THE TWO RUNS. `clicks` is the list of the singer's clicks, one per turn.
 * ============================================================================================= */
function runMedi(carAbility, clicks) {
  const mk = (name, moves, ab) => { const b = MEDI.buildMon(mcKey(name, { mayMiss: 'a probe body must be a real row' }), {});
    if (!b) throw new Error('buildMon failed for ' + name);
    b.moves = moves.map(m => dex.moves.get(m).id); b.item = ''; b.ability = ab; return b; };
  const A = mk(SING.sp.name, [PS.id, SING.fill], SING.ab), A2 = mk(SING.sp.name, [SING.fill], SING.ab);
  const V = mk(CAR.sp.name, [CARFILL], carAbility), V2 = mk(SING.sp.name, [SING.fill], SING.ab);
  const trace = [];
  const S = MEDI.battleInit([A, A2], [V, V2], { seeded: true, trace });
  const rng = () => 0.5;
  const turns = [];
  for (const click of clicks) {
    const n0 = trace.length;
    MEDI.battleTurn(S, rng,
      new Map([[A, MEDI.playerAction(A, click, null, S.field)], [A2, MEDI.playerAction(A2, SING.fill, null, S.field)]]),
      new Map([[V, MEDI.playerAction(V, CARFILL, null, S.field)], [V2, MEDI.playerAction(V2, SING.fill, null, S.field)]]));
    const lines = trace.slice(n0).map(String);
    turns.push({ lines,
      clocks: [A, A2, V, V2].map(x => x._perish == null ? null : x._perish),
      activate: lines.filter(l => /^\|-fieldactivate\|/i.test(l) && /perish/i.test(l)).length,
      fail: lines.filter(l => /^\|-fail\|/i.test(l)).length,
      immune: lines.filter(l => /^\|-immune\|/i.test(l)) });
  }
  return turns;
}

function runSD(carAbility, clicks) {
  const set = (n, mv, ab) => ({ name: n, species: n, item: '', ability: dex.abilities.get(ab).name,
    moves: mv.map(m => dex.moves.get(m).name),
    nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack([set(SING.sp.name, [PS.id, SING.fill], SING.ab), set(SING.sp.name, [SING.fill, SING.fill], SING.ab)]) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack([set(CAR.sp.name, [CARFILL, CARFILL], carAbility), set(SING.sp.name, [SING.fill, SING.fill], SING.ab)]) });
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  const bodies = [b.sides[0].active[0], b.sides[0].active[1], b.sides[1].active[0], b.sides[1].active[1]];
  const turns = [];
  for (const click of clicks) {
    const n0 = b.log.length;
    b.choose('p1', 'move ' + click + ', move ' + SING.fill);
    b.choose('p2', 'move ' + CARFILL + ', move ' + SING.fill);
    const lines = b.log.slice(n0);
    turns.push({ lines,
      clocks: bodies.map(x => x.volatiles['perishsong'] ? x.volatiles['perishsong'].duration : null),
      activate: lines.filter(l => /^\|-fieldactivate\|/i.test(l) && /perish/i.test(l)).length,
      fail: lines.filter(l => /^\|-fail\|/i.test(l)).length,
      immune: lines.filter(l => /^\|-immune\|/i.test(l)) });
  }
  return turns;
}

const norm = a => a.map(l => String(l).toLowerCase().replace(/[^a-z0-9|:\[\]]/g, ''));
const show = t => 'clocks ' + JSON.stringify(t.clocks) + '  activate ' + t.activate
  + '  fail ' + t.fail + '  immune ' + JSON.stringify(t.immune);

/* ================================================================================================
 * 2 — CONTROL: the SAME body, its other legal ability. The clock must land.
 * ============================================================================================= */
const ctlM = runMedi(CAR.ctl, [PS.id])[0], ctlS = runSD(CAR.ctl, [PS.id])[0];
ok(ctlM.clocks[2] != null && ctlS.clocks[2] != null,
  'CONTROL — with ' + CAR.ctl + ' instead of ' + CAR.ref + ', the same ' + CAR.sp.name + ' TAKES the clock, both engines',
  'medi ' + show(ctlM) + '\n          sd   ' + show(ctlS));

/* ================================================================================================
 * 3/4 — TEST: the refuser.
 * ============================================================================================= */
const refM = runMedi(CAR.ref, [PS.id])[0], refS = runSD(CAR.ref, [PS.id])[0];
console.log('\n  medi  ' + show(refM));
console.log('  sd    ' + show(refS) + '\n');
ok(refM.clocks[2] === null && refS.clocks[2] === null,
  'TEST — a ' + CAR.ref + ' body takes NO perish clock, in both engines',
  'medi clock ' + JSON.stringify(refM.clocks[2]) + '  authority ' + JSON.stringify(refS.clocks[2]));
ok(refM.immune.length === 1 && refS.immune.length === 1
   && new RegExp(CAR.ref, 'i').test(norm(refM.immune)[0].replace(/ /g, ''))
   && new RegExp(CAR.ref, 'i').test(norm(refS.immune)[0].replace(/ /g, '')),
  'TEST — and both engines announce the refusal NAMING the ability',
  'medi ' + JSON.stringify(refM.immune) + '\n          sd   ' + JSON.stringify(refS.immune));
ok(refM.clocks[0] != null && refM.clocks[1] != null && refM.clocks[3] != null
   && refS.clocks[0] != null && refS.clocks[1] != null && refS.clocks[3] != null,
  'CONTROL — the other three bodies are still marked, so the refusal is one body and not the move',
  'medi ' + JSON.stringify(refM.clocks) + '  sd ' + JSON.stringify(refS.clocks));

/* ================================================================================================
 * 5/6/7 — the SECOND click into a field that is already counting.
 * ============================================================================================= */
const twoM = runMedi(CAR.ctl, [PS.id, PS.id]), twoS = runSD(CAR.ctl, [PS.id, PS.id]);
console.log('\n  medi  t1 ' + show(twoM[0]) + '\n        t2 ' + show(twoM[1]));
console.log('  sd    t1 ' + show(twoS[0]) + '\n        t2 ' + show(twoS[1]) + '\n');
ok(twoM[0].activate === 1 && twoS[0].activate === 1 && twoM[0].fail === 0 && twoS[0].fail === 0,
  'CONTROL — the FIRST click announces the field activation and fails in neither engine',
  'medi ' + show(twoM[0]) + '\n          sd   ' + show(twoS[0]));
ok(twoM[1].fail === twoS[1].fail && twoM[1].activate === twoS[1].activate && twoS[1].fail === 1,
  'TEST — the SECOND click FAILS and announces no field activation, in both engines',
  'medi fail ' + twoM[1].fail + ' activate ' + twoM[1].activate
  + '   authority fail ' + twoS[1].fail + ' activate ' + twoS[1].activate);
ok(JSON.stringify(twoM[1].clocks) === JSON.stringify(twoS[1].clocks),
  'CONTROL — and nobody\'s clock was reset: the two engines hold the same counters afterwards',
  'medi ' + JSON.stringify(twoM[1].clocks) + '  sd ' + JSON.stringify(twoS[1].clocks));

/* 8 — COUNTER. */
const C = MEDI.MEDSEEN || {};
ok((C.perishMarked || 0) > 0 && (C.perishNoTarget || 0) > 0,
  'COUNTER — the loop marked bodies AND reached the no-result arm during this run',
  'perishMarked=' + (C.perishMarked === undefined ? 'ABSENT' : C.perishMarked)
  + '  perishNoTarget=' + (C.perishNoTarget === undefined ? 'ABSENT' : C.perishNoTarget)
  + '  perishClassRefused=' + (C.perishClassRefused === undefined ? 'ABSENT' : C.perishClassRefused));

/* ================================================================================================
 * THE KNOB.
 * ============================================================================================= */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [__filename],
    { env: { ...process.env, MEDI_PERISH_ALWAYS_ACTIVATES: '1' }, encoding: 'utf8' });
  const out = String(r.stdout || '') + String(r.stderr || '');
  const a = (out.match(/^ *(PASS|FAIL) *TEST — a .* body takes NO perish clock.*$/m) || [''])[0].trim();
  const b2 = (out.match(/^ *(PASS|FAIL) *TEST — the SECOND click FAILS.*$/m) || [''])[0].trim();
  ok(r.status !== 0,
    'KNOB — restoring the blind refusal and the unconditional field activation REDS this probe',
    'child exit ' + r.status + '\n          ' + (a || '(no refusal arm printed — the knob is not wired)')
    + '\n          ' + (b2 || '(no second-click arm printed — the knob is not wired)'));
}

console.log('\n  ' + (stage ? stage + ' FIXTURE problem(s) — a claim about the fixture, never about the mechanic. ' : '')
  + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad || stage ? 1 : 0);
