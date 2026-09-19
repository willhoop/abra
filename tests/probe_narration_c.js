#!/usr/bin/env node
/* tests/probe_narration_c.js — FOUR MECHANISMS, EACH STAGED AS A CLASS IN BOTH ENGINES.
 *
 *   SHOWDOWN_PATH=... node tests/probe_narration_c.js --release <id>
 *   ... MEDI_FOREWARN_SILENT=1          (red)  Forewarn announces nothing and draws no die
 *   ... MEDI_CHILLY_NOBENCH_SILENT=1    (red)  Chilly Reception into its own snow, nobody to switch to, no `-fail`
 *   ... MEDI_STATUS_HELD_AFTER_FIELD=1  (red)  a held status is asked after Misty / Electric Terrain / Safeguard
 *   ... MEDI_HARVEST_COIN_GATED=1       (red)  Harvest throws its residual coin only when a berry is waiting
 * ==================================================================================================
 *
 * 2026-09-19. The narration gate read 0 / 2 / 6 undeclared games on release 1a6550ea5ec6
 * (docs/_reports/2026-09-19-1a65-remeasure.md §4). This probe covers five of them and the die defect one
 * of them turned out to be standing on. Read off the authority, not recalled:
 *
 *   FOREWARN   data/abilities.ts:1494-1517 (no Champions override). Walks `pokemon.foes()` x `moveSlots`,
 *              scores `basePower` with four rewrites, keeps the strict maximum and APPENDS equals, then
 *              `this.sample(warnMoves)` -- a die, drawn even for a one-element list -- and writes
 *              `-activate|HOLDER|ability: Forewarn|MOVE|[of] FOE`. An empty list returns before the die.
 *   CHILLY     data/moves.ts:2396-2420 `weather: 'snowscape'`, `selfSwitch: true`; sim/battle-actions.ts
 *              :1248 (setWeather false under its own sky, sim/field.ts:45-52), :1289 (no bench -> false),
 *              :1303 (`-fail` + `[still]` when nothing was done).
 *   HELD       sim/pokemon.ts:1675 `trySetStatus` passes the HELD status; :1704-1712 answers it before
 *              `runEvent('SetStatus')` at :1729, where Misty Terrain, Electric Terrain and Safeguard live.
 *   HARVEST    data/abilities.ts:1793-1801: `isWeather(sun) || randomChance(1, 2)` is thrown BEFORE the
 *              berry is asked about, every residual.
 *
 * NOTHING HERE TYPES AN EXPECTED LINE. Both engines play the identical script under the middle arm;
 * SHOWDOWN IS THE EXPECTATION. Every game must agree on the protocol stream AND on the board at every
 * turn boundary. NON-VACUITY is asserted off the AUTHORITY's stream per class, and each knob runs in a
 * child: it must part its own class, part nothing else, and -- for the three narration knobs -- leave every
 * board identical. The Harvest knob is a DIE and may move a board; it must still part only its own class.
 *
 * Every species, move and ability used here is derived from the format and checked legal before use.
 */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const NL = String.fromCharCode(10);
if (!process.argv.includes('--release')
    && !require.cache[require.resolve(path.join(ROOT, 'tests', '_live_release.js'))]) {
  console.log('REFUSING TO RUN — pass --release <id>, or preload tests/_live_release.js with -r.');
  process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOBS = { MEDI_FOREWARN_SILENT: 'forewarn|harvest', MEDI_CHILLY_NOBENCH_SILENT: 'chilly',
                MEDI_STATUS_HELD_AFTER_FIELD: 'held', MEDI_HARVEST_COIN_GATED: 'harvest' };
const BOARD_MAY_MOVE = new Set(['MEDI_HARVEST_COIN_GATED']);
const ARMED = Object.keys(KNOBS).filter(k => process.env[k] === '1');
const CHILD = process.env.PROBE_NARC_CHILD === '1';
const K = +(process.env.PROBE_NARC_K || 4);

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what + (detail != null ? '   — ' + detail : ''));
  if (!cond) bad++;
  return cond;
};
console.log(NL + 'tests/probe_narration_c.js — Forewarn / Chilly Reception with no bench / held status before SetStatus / Harvest coin'
  + (ARMED.length ? '   [KNOB ARMED: ' + ARMED.join(',') + ']' : ''));

const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const D = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (s, mv) => {
  let cur = s;
  for (let g = 0; cur && g < 6; g++) {
    const l = D.species.getLearnsetData(cur.id);
    if (l && l.learnset && (l.learnset[mv] || []).some(src => String(src).startsWith('9'))) return true;
    cur = cur.prevo ? D.species.get(cur.prevo) : null;
  }
  return false;
};
const POOL = D.species.all().filter(s => legal(s) && !/mega/i.test(s.forme || '') && !s.battleOnly)
  .sort((a, b) => a.id.localeCompare(b.id));
const abIds = s => Object.values(s.abilities || {}).map(a => D.abilities.get(a).id);
const TAGS = require(path.join(ROOT, 'data', 'tags.json'));
const tagsOf = id => (((TAGS.abilities || {})[id] || {}).tags) || [];
const PASSIVE = new Set(['breakable', 'damageBoost', 'typeImmunity', 'halvesTypeDamage', 'boostsMoveClass',
  'damageReduce', 'preventsCrit', 'weatherChipImmune', 'critRatioUp', 'stabBoost', 'speedCond']);
const quietAbOf = s => Object.values(s.abilities).map(a => D.abilities.get(a))
  .find(ab => legal(ab) && tagsOf(ab.id).every(t => PASSIVE.has(t)) && !['levitate'].includes(ab.id));
const IDLE = D.moves.all().filter(m => legal(m) && m.category === 'Status' && m.target === 'self' && !m.selfSwitch
  && !m.selfdestruct && m.boosts && Object.values(m.boosts).every(v => v > 0) && !m.boosts.evasion && !m.boosts.accuracy
  && !m.heal && !m.flags.charge && !m.volatileStatus).sort((a, b) => a.id.localeCompare(b.id));
const idleOf = s => IDLE.find(m => learns(s, m.id)) || null;
const spe = s => s.baseStats.spe;
const mustLegal = (kind, id) => { const e = D[kind].get(id);
  if (!legal(e)) throw new Error('FIXTURE NAMES AN ENTITY OUTSIDE THE REGULATION: ' + kind + ' ' + id); return e.name; };
for (const m of ['protect', 'chillyreception', 'mistyterrain', 'electricterrain', 'safeguard', 'thunderwave', 'sleeppowder',
                 'toxic', 'memento', 'raindance']) mustLegal('moves', m);
for (const a of ['forewarn', 'harvest']) mustLegal('abilities', a);
const QUIET = POOL.map(s => ({ s, ab: quietAbOf(s) })).filter(x => x.ab);
const mon = (s, ab, moves) => ({ species: s.name, item: '', ability: ab ? (ab.name || ab) : '',
  moves: [...new Set(moves.filter(Boolean))].map(m => D.moves.get(m).name) });
const FILL = QUIET.filter(x => !x.s.types.includes('Flying') && learns(x.s, 'protect') && idleOf(x.s)).slice(0, 80);
const fillers = (avoid, n) => FILL.filter(f => !avoid.includes(f.s.id)).slice(0, n).map(f => mon(f.s, f.ab, ['protect']));

const G = SB.harness();
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');
console.log('  release ' + G.REL.id + '   K = ' + K);

const results = [];
function play(group, tag, A, B, script) {
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  /* A SIDE SHORTER THAN FOUR IS DELIBERATE: it is how "nobody left in the back" is staged. `buildPair`
   * refuses a sheet shorter than its cap (PAIR_BODIES), so the cap is the sheet's own length. */
  const a = G.buildPair(A, A.length < 4 ? { max: A.length } : undefined), b = G.buildPair(B, B.length < 4 ? { max: B.length } : undefined);
  const parts = [];
  const r = (!a || !b) ? { err: 'buildPair returned null' } : G.playGame(a, b, 'directed', 'narc-' + tag,
    { script, arm: ARM, onBoundary: (snap, t) => { if ((snap.diffs || []).length) parts.push({ t, d: snap.diffs.slice(0, 3) });
                                                   snap.identical = true; snap.diffs = []; } });
  const SC = G.scriptCounters ? G.scriptCounters() : {};
  const sd = r.err ? [] : G.sdStream(G.lastSdLog()).map(String);
  const x = { group, tag, err: r.err || (SC.moveNotOnRequest ? 'scripted click not on the request: ' + SC.firstMissing : null),
              div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null, parts, sd };
  results.push(x);
  return x;
}

/* ==== 1. FOREWARN. The only legal carrier is derived. Its foes carry exactly one damaging move each plus
 *      Protect, so the scored field is exactly what the arm names. LEAD arms test the SCORE (a unique
 *      winner per rewrite class, and a status-only negative that must say nothing); SWITCH-IN arms at K
 *      different turns test the LIST ORDER and the DIE, because the lead address is the same in every
 *      game and only a mid-game entry moves it. ======================================================= */
{
  const carriers = POOL.filter(s => abIds(s).includes('forewarn'));
  console.log(NL + '  === FOREWARN — carriers derived this run: ' + carriers.map(s => s.name).join(', ') + ' ===');
  ok(carriers.length > 0, 'a legal Forewarn carrier exists');
  const fw = carriers[0];
  const fwIdle = idleOf(fw);
  const pk = TAGS.abilities.forewarn.params.announcesOnEntry.picks;
  ok(!!(pk && pk.score), 'the artifact carries Forewarn\'s derived pick (tag_dex `picks`)');
  const dmg = D.moves.all().filter(m => legal(m) && m.category !== 'Status').sort((a, b) => a.id.localeCompare(b.id));
  /* A foe that learns `mv` and Protect, not a Forewarn body, not the carrier, on a quiet ability. */
  const foeFor = (mv, avoid) => QUIET.find(q => !avoid.includes(q.s.id) && learns(q.s, mv) && learns(q.s, 'protect'));
  /* The strongest legal damaging move STRICTLY below `bp` by the authority's own score, learnable by a
   * quiet foe -- the runner-up that must lose. */
  const scoreOf = m => (pk.score[m.id] != null ? pk.score[m.id] : 0);
  const runnerUp = (bp, avoid) => dmg.filter(m => scoreOf(m) < bp && scoreOf(m) > 1).sort((a, b) => scoreOf(b) - scoreOf(a))
    .map(m => ({ m, f: foeFor(m.id, avoid) })).find(x => x.f);
  const leadArms = [];
  for (const r of pk.rules) {
    const cls = dmg.filter(m => r.when === 'ohko' ? !!m.ohko : r.when === 'id' ? r.ids.includes(m.id)
      : r.when === 'eq' ? m.basePower === r.eq : (!m.basePower && !m.ohko && !(pk.rules.find(x => x.when === 'id') || { ids: [] }).ids.includes(m.id)));
    const pick = cls.map(m => ({ m, f: foeFor(m.id, [fw.id]) })).find(x => x.f);
    if (!pick) { console.log('    rule ' + r.when.padEnd(16) + ' (' + cls.length + ' moves) — no quiet legal learner; not staged'); continue; }
    const ru = runnerUp(r.bp, [fw.id, pick.f.s.id]);
    if (!ru) { console.log('    rule ' + r.when + ' — no runner-up below ' + r.bp + '; not staged'); continue; }
    leadArms.push({ why: 'rule-' + r.when, a: pick, b: ru });
    console.log('    rule ' + r.when.padEnd(16) + pick.m.id + ' (' + pick.m.basePower + ' -> ' + r.bp + ') on ' + pick.f.s.name
      + '   vs runner-up ' + ru.m.id + ' (' + scoreOf(ru.m) + ') on ' + ru.f.s.name);
  }
  /* THE NEGATIVE: two foes with only Status moves. The list is empty; nothing is said and no die drawn. */
  const statusFoes = QUIET.filter(q => q.s.id !== fw.id && learns(q.s, 'protect') && idleOf(q.s)).slice(0, 2);
  const [pA, pB] = FILL.filter(f => f.s.id !== fw.id && !statusFoes.some(x => x.s.id === f.s.id));
  const leadGame = (tag, foes) => {
    const avoid = [fw.id, pA.s.id, pB.s.id].concat(foes.map(f => f.s.id));
    const A = [mon(fw, 'Forewarn', [fwIdle && fwIdle.id, 'protect']), mon(pA.s, pA.ab, ['protect', idleOf(pA.s).id])]
      .concat(fillers(avoid, 2));
    const B = foes.map(f => mon(f.s, f.ab, [f.mv, 'protect'].filter(Boolean))).concat(fillers(avoid, 4).slice(2));
    play('forewarn', tag, A, B, [{ p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }]);
  };
  for (const arm of leadArms) {
    leadGame('fw-lead-' + arm.why, [{ s: arm.a.f.s, ab: arm.a.f.ab, mv: arm.a.m.id }, { s: arm.b.f.s, ab: arm.b.f.ab, mv: arm.b.m.id }]);
    leadGame('fw-lead-' + arm.why + '-swapped', [{ s: arm.b.f.s, ab: arm.b.f.ab, mv: arm.b.m.id }, { s: arm.a.f.s, ab: arm.a.f.ab, mv: arm.a.m.id }]);
  }
  leadGame('fw-lead-statusonly-NEG', statusFoes.map(q => ({ s: q.s, ab: q.ab, mv: null })));
  /* THE TIE: two foes whose best move scores the same; the first carries TWO such moves, so the list is
   * three long, built foe-major and slot-order. The carrier switches in at turn n (n = 1..K). */
  const byScore = {};
  for (const m of dmg) { const s = scoreOf(m); if (s > 1) (byScore[s] = byScore[s] || []).push(m); }
  let tie = null;
  for (const s of Object.keys(byScore).map(Number).sort((a, b) => b - a)) {
    const ms = byScore[s];
    for (const q of QUIET) {
      if (q.s.id === fw.id || !learns(q.s, 'protect')) continue;
      const two = ms.filter(m => learns(q.s, m.id)).slice(0, 2);
      if (two.length < 2) continue;
      const other = ms.map(m => ({ m, f: foeFor(m.id, [fw.id, q.s.id]) })).find(x => x.f && !two.includes(x.m));
      if (other) { tie = { bp: s, f1: q, m1: two, f2: other.f, m2: other.m }; break; }
    }
    if (tie) break;
  }
  ok(!!tie, 'a three-way Forewarn tie can be staged from legal learners');
  if (tie) {
    console.log('    tie at ' + tie.bp + ': ' + tie.f1.s.name + ' [' + tie.m1.map(m => m.id).join(',') + ']  ' + tie.f2.s.name + ' [' + tie.m2.id + ']');
    const avoid = [fw.id, pA.s.id, pB.s.id, tie.f1.s.id, tie.f2.s.id];
    const A = [mon(pA.s, pA.ab, ['protect', idleOf(pA.s).id]), mon(pB.s, pB.ab, ['protect', idleOf(pB.s).id]),
               mon(fw, 'Forewarn', [fwIdle && fwIdle.id, 'protect'])].concat(fillers(avoid, 1));
    const B = [mon(tie.f1.s, tie.f1.ab, [tie.m1[0].id, tie.m1[1].id, 'protect']), mon(tie.f2.s, tie.f2.ab, [tie.m2.id, 'protect'])]
      .concat(fillers(avoid, 3).slice(1));
    const idle = { p1: [{ m: idleOf(pA.s).id }, { m: idleOf(pB.s).id }], p2: [{ m: 'protect' }, { m: 'protect' }] };
    for (let n = 0; n < K; n++) {
      play('forewarn', 'fw-switchin-tie-t' + (n + 1), A, B, Array.from({ length: n }, () => idle)
        .concat([{ p1: [{ sw: fw.id }, { m: idleOf(pB.s).id }], p2: [{ m: 'protect' }, { m: 'protect' }] },
                 { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }]));
    }
  }
}

/* ==== 2. CHILLY RECEPTION. The learners are derived. A TWO-BODY side has no bench. Turn 1 sets the snow
 *      (the sky moved: success, no switch possible, no line); turn 2 clicks it into its own snow (both
 *      halves false: `-fail`). Controls: the same with a bench (it pivots), and into a DIFFERENT sky with
 *      no bench (the snow lands: no `-fail`). =========================================================== */
{
  const learners = POOL.filter(s => learns(s, 'chillyreception'));
  console.log(NL + '  === CHILLY RECEPTION — learners derived this run: ' + learners.map(s => s.name).join(', ') + ' ===');
  const moverOf = learners.map(s => ({ s, ab: D.abilities.get(Object.values(s.abilities)[0]) })).find(x => learns(x.s, 'protect'));
  ok(!!moverOf, 'a legal Chilly Reception learner exists');
  const rainer = QUIET.find(q => learns(q.s, 'raindance') && learns(q.s, 'protect') && spe(q.s) > spe(moverOf.s) && idleOf(q.s));
  const foes = FILL.filter(f => ![moverOf.s.id, rainer && rainer.s.id].includes(f.s.id)).slice(20, 22);
  const B = foes.map(f => mon(f.s, f.ab, ['protect', idleOf(f.s).id])).concat(fillers([moverOf.s.id].concat(foes.map(f => f.s.id)), 6).slice(4));
  const foeTurn = { m: 'protect' };
  const partner = FILL.find(f => ![moverOf.s.id, rainer && rainer.s.id].concat(foes.map(x => x.s.id)).includes(f.s.id));
  console.log('    mover ' + moverOf.s.name + ' @' + moverOf.ab.name + '   partner ' + partner.s.name + '   rain partner ' + (rainer ? rainer.s.name : 'NONE'));
  const pIdle = idleOf(partner.s).id;
  for (let n = 0; n < K; n++) {
    const idle = { p1: [{ m: 'protect' }, { m: pIdle }], p2: [foeTurn, foeTurn] };
    const pre = Array.from({ length: n }, () => idle);
    const A2 = [mon(moverOf.s, moverOf.ab, ['chillyreception', 'protect']), mon(partner.s, partner.ab, ['protect', pIdle])];
    play('chilly', 'chilly-nobench-ownsnow-' + n, A2, B, pre.concat([
      { p1: [{ m: 'chillyreception' }, { m: pIdle }], p2: [foeTurn, foeTurn] },
      { p1: [{ m: 'chillyreception' }, { m: pIdle }], p2: [foeTurn, foeTurn] }]));
  }
  const A4 = [mon(moverOf.s, moverOf.ab, ['chillyreception', 'protect']), mon(partner.s, partner.ab, ['protect', pIdle])]
    .concat(fillers([moverOf.s.id, partner.s.id].concat(foes.map(f => f.s.id)), 2));
  play('chilly', 'chilly-bench-CONTROL', A4, B, [
    { p1: [{ m: 'chillyreception' }, { m: pIdle }], p2: [foeTurn, foeTurn] },
    { p1: [{ m: 'protect' }, { m: pIdle }], p2: [foeTurn, foeTurn] }]);
  if (rainer) {
    const rIdle = idleOf(rainer.s).id;
    const AR = [mon(moverOf.s, moverOf.ab, ['chillyreception', 'protect']), mon(rainer.s, rainer.ab, ['raindance', 'protect', rIdle])];
    play('chilly', 'chilly-nobench-otherweather-CONTROL', AR, B, [
      { p1: [{ m: 'protect' }, { m: 'raindance' }], p2: [foeTurn, foeTurn] },
      { p1: [{ m: 'chillyreception' }, { m: rIdle }], p2: [foeTurn, foeTurn] }]);
  } else console.log('    no quiet Rain Dance learner faster than the mover; the other-weather control is not staged');
}

/* ==== 3. A STATUS INTO A BODY THAT ALREADY HOLDS ONE, UNDER A SetStatus REFUSAL. Turn 1 lands the status
 *      (no field yet); turn 2 the refusal goes up; turn 3 the status move again. Refusals: Misty Terrain,
 *      Electric Terrain (sleep), Safeguard on the target's side. Same and different status. Control: a
 *      fresh target under the same refusal, whose line must still be the refusal's own. ================= */
{
  const grounded = s => !s.types.includes('Flying') && !abIds(s).includes('levitate');
  /* A target that is grounded, quiet, idle, and can take par / slp / psn by type. */
  const target = QUIET.find(q => grounded(q.s) && idleOf(q.s) && learns(q.s, 'protect')
    && !['Electric', 'Grass', 'Poison', 'Steel', 'Ground'].some(t => q.s.types.includes(t)));
  const tIdle = idleOf(target.s).id;
  const refusals = [['mistyterrain', null], ['electricterrain', 'slp'], ['safeguard', null]];
  console.log(NL + '  === HELD STATUS BEFORE SetStatus — target ' + target.s.name + ' (' + target.s.types.join('/') + ') @' + target.ab.name + ' ===');
  const statuses = [['par', 'thunderwave'], ['slp', 'sleeppowder'], ['tox', 'toxic']];
  for (const [ref, only] of refusals) {
    const setter = QUIET.find(q => learns(q.s, ref) && learns(q.s, 'protect') && idleOf(q.s) && q.s.id !== target.s.id);
    if (!setter) { console.log('    ' + ref + ': no quiet legal learner; not staged'); continue; }
    for (const [st, mv] of statuses) {
      if (only && st !== only) continue;
      const user = QUIET.find(q => learns(q.s, mv) && learns(q.s, 'protect') && idleOf(q.s) && spe(q.s) > spe(target.s)
        && ![target.s.id, setter.s.id].includes(q.s.id) && !(st === 'slp' && abIds(q.s).includes('insomnia')));
      if (!user) { console.log('    ' + ref + ' ' + st + ': no quiet legal ' + mv + ' learner faster than the target; not staged'); continue; }
      /* the different-status arm: the second click inflicts a status OTHER than the held one */
      const other = statuses.find(x => x[0] !== st && learns(user.s, x[1]) && (!only || x[0] === only));
      const uIdle = idleOf(user.s).id, sIdle = idleOf(setter.s).id;
      const avoid = [target.s.id, setter.s.id, user.s.id];
      /* The refusal lives on the TARGET's side for Safeguard, and on the field for a terrain. */
      const sideOfSetter = ref === 'safeguard' ? 'p2' : 'p1';
      const tPartner = FILL.find(f => !avoid.includes(f.s.id));
      const A = [mon(user.s, user.ab, [mv, other && other[1], 'protect', uIdle]),
                 sideOfSetter === 'p1' ? mon(setter.s, setter.ab, [ref, 'protect', sIdle]) : mon(tPartner.s, tPartner.ab, ['protect', idleOf(tPartner.s).id])]
        .concat(fillers(avoid.concat([tPartner.s.id]), 2));
      const B = [mon(target.s, target.ab, ['protect', tIdle]),
                 sideOfSetter === 'p2' ? mon(setter.s, setter.ab, [ref, 'protect', sIdle]) : mon(tPartner.s, tPartner.ab, ['protect', idleOf(tPartner.s).id])]
        .concat(fillers(avoid.concat([tPartner.s.id]), 4).slice(2));
      const partIdle = sideOfSetter === 'p1' ? { m: idleOf(tPartner.s).id } : { m: idleOf(tPartner.s).id };
      const setterClick = { m: ref }, setterIdle = { m: sIdle };
      const turn = (userClick, setterMove) => sideOfSetter === 'p1'
        ? { p1: [userClick, setterMove], p2: [{ m: tIdle }, partIdle] }
        : { p1: [userClick, partIdle], p2: [{ m: tIdle }, setterMove] };
      const armsHere = [['same', mv], other ? ['different', other[1]] : null].filter(Boolean);
      console.log('    ' + ref.padEnd(16) + st + ' via ' + mv.padEnd(12) + ' user ' + user.s.name + '   setter ' + setter.s.name
        + (other ? '   different-status click ' + other[1] : ''));
      /* TWO TURNS, NOT THREE: the status lands and the refusal goes up in the SAME turn (the user is
       * faster than the setter, checked below), and the second click comes before the target acts
       * again. A sleeping target that got two turns to try to move could wake, and the arm would then
       * be testing a fresh body -- which is the control, not this. */
      const setterSlower = spe(setter.s) < spe(user.s);
      console.log('      setter ' + (setterSlower ? 'slower than the user: the refusal rises after the first click' : 'NOT slower: three-turn script'));
      for (const [kind, second] of armsHere) {
        play('held', 'held-' + ref + '-' + st + '-' + kind, A, B, setterSlower ? [
          turn({ m: mv, t: 0 }, setterClick),
          turn({ m: second, t: 0 }, setterIdle)] : [
          turn({ m: mv, t: 0 }, setterIdle),
          turn({ m: uIdle }, setterClick),
          turn({ m: second, t: 0 }, setterIdle)]);
      }
      play('held', 'held-' + ref + '-' + st + '-fresh-CONTROL', A, B, [
        turn({ m: uIdle }, setterClick),
        turn({ m: mv, t: 0 }, setterIdle)]);
    }
  }
}

/* ==== 4. HARVEST'S COIN WITH NOTHING TO GIVE BACK. A berry-less Harvest body stands beside a partner that
 *      Mementos, so a Forewarn carrier enters at the END of that turn: the authority's residual coin is
 *      `T|any|-|-|0` and the entrant's Forewarn die is `|1`. Under a gated coin the entrant reads `|0`.
 *      The tie at the entry makes the index matter; K turns move the address. Control: the same board
 *      with no Harvest body. ============================================================================ */
{
  const harvesters = POOL.filter(s => abIds(s).includes('harvest') && learns(s, 'protect') && idleOf(s));
  const fw = POOL.find(s => abIds(s).includes('forewarn'));
  console.log(NL + '  === HARVEST — carriers derived this run: ' + harvesters.map(s => s.name).join(', ') + ' ===');
  ok(harvesters.length > 0, 'a legal Harvest carrier exists');
  const hv = harvesters[0];
  const mem = QUIET.find(q => learns(q.s, 'memento') && ![hv.id, fw.id].includes(q.s.id));
  const pk = TAGS.abilities.forewarn.params.announcesOnEntry.picks;
  const scoreOf = id => (pk.score[id] != null ? pk.score[id] : 0);
  /* two foes whose best move ties, from quiet learners */
  const dmg = D.moves.all().filter(m => legal(m) && m.category !== 'Status');
  /* A FOUR-WAY TIE -- two foes, each carrying two moves of one score -- so a die read one address early
   * lands on the same index only one time in four, and K turns make a coincidence across all of them
   * negligible. (A two-way tie was tried first and the gated coin parted NOTHING over four turns: at
   * one in two per turn that is a coincidence the knob check cannot tell from an unwired knob.) */
  let foes = null;
  const byS = {};
  for (const m of dmg) { const s = scoreOf(m.id); if (s > 1) (byS[s] = byS[s] || []).push(m.id); }
  for (const s of Object.keys(byS).map(Number).sort((a, b) => b - a)) {
    const L = QUIET.filter(q => ![hv.id, fw.id, mem && mem.s.id].includes(q.s.id) && idleOf(q.s))
      .map(q => ({ q, ms: byS[s].filter(id => learns(q.s, id)).slice(0, 2) })).filter(x => x.ms.length === 2);
    if (L.length >= 2) { foes = [{ q: L[0].q, m: L[0].ms }, { q: L[1].q, m: L[1].ms }]; break; }
  }
  ok(!!(mem && foes), 'a Memento partner and two tied foes can be staged', mem ? mem.s.name : 'no Memento learner');
  if (mem && foes) {
    console.log('    harvest ' + hv.name + '   memento ' + mem.s.name + '   entrant ' + fw.name + '   foes ' + foes.map(f => f.q.s.name + ':' + f.m.join('+')).join(' '));
    const avoid = [hv.id, fw.id, mem.s.id].concat(foes.map(f => f.q.s.id));
    const hvIdle = idleOf(hv).id;
    /* THE FOES IDLE ON A SELF-BOOST, NOT PROTECT: a Protect would block the Memento that makes the entry. */
    const B = foes.map(f => mon(f.q.s, f.q.ab, [...f.m, idleOf(f.q.s).id])).concat(fillers(avoid, 2));
    const foeIdle = foes.map(f => ({ m: idleOf(f.q.s).id }));
    for (const withHarvest of [true, false]) {
      const first = withHarvest ? mon(hv, 'Harvest', ['protect', hvIdle]) : fillers(avoid, 3).slice(2)[0];
      const firstIdle = withHarvest ? hvIdle : 'protect';
      /* THREE BODIES, so the carrier is the only body that can replace the Memento user. */
      const A = [first, mon(mem.s, mem.ab, ['memento', 'protect']), mon(fw, 'Forewarn', ['protect'])];
      for (let n = 0; n < K + 2; n++) {
        const idle = { p1: [{ m: firstIdle }, { m: 'protect' }], p2: foeIdle };
        play('harvest', 'harvest-' + (withHarvest ? 'berryless' : 'nobody-CONTROL') + '-t' + (n + 1), A, B,
          Array.from({ length: n }, () => idle).concat([
            { p1: [{ m: firstIdle }, { m: 'memento', t: 0 }], p2: foeIdle },
            { p1: [{ m: firstIdle }, { m: 'protect' }], p2: foeIdle }]));
      }
    }
  }
}

/* ==== VERDICT ====================================================================================== */
const GROUPS = ['forewarn', 'chilly', 'held', 'harvest'];
console.log(NL + '  === PER GAME (only games that parted are listed) ===');
for (const x of results) {
  if (!(x.err || x.div || x.parts.length)) continue;
  console.log('    PART ' + x.tag + (x.err ? '  ERR ' + x.err : '') + (x.div ? '  div sd=' + x.div.sd + ' | me=' + x.div.me : '')
    + (x.parts.length ? '  BOARD t' + x.parts[0].t + ' ' + x.parts[0].d.map(d => d.path + ' me ' + JSON.stringify(d.medicham) + ' sd ' + JSON.stringify(d.showdown)).join('; ') : ''));
}
/* PROBE_NARC_DUMP=<regex> prints the authority's stream for every game whose tag matches -- a reading aid
 * for a fixture that does not do what its tag says, never part of the verdict. */
if (process.env.PROBE_NARC_DUMP) {
  const dre = new RegExp(process.env.PROBE_NARC_DUMP);
  for (const x of results) if (dre.test(x.tag)) console.log('  DUMP ' + x.tag + NL + x.sd.map(l => '      ' + l).join(NL));
}
console.log(NL + '  === THE VERDICT ===');
for (const g of GROUPS) {
  const xs = results.filter(x => x.group === g);
  const errs = xs.filter(x => x.err), divs = xs.filter(x => !x.err && x.div), boards = xs.filter(x => !x.err && x.parts.length);
  ok(xs.length > 0 && errs.length === 0, g + ': every staged game played its whole script', errs.length ? errs[0].tag + ': ' + errs[0].err : xs.length + ' games');
  ok(divs.length === 0, g + ': every game — the two protocol streams agree', divs.length ? divs.length + ' parted, first ' + divs[0].tag : null);
  ok(boards.length === 0, g + ': every game — the boards agree at every turn boundary', boards.length ? boards.length + ' parted, first ' + boards[0].tag : null);
}
/* NON-VACUITY, off the authority's own stream. */
const has = (g, re, tagRe) => results.filter(x => x.group === g && (!tagRe || tagRe.test(x.tag)) && x.sd.some(l => re.test(l))).length;
const hasNot = (g, re, tagRe) => results.filter(x => x.group === g && (!tagRe || tagRe.test(x.tag)) && !x.sd.some(l => re.test(l))).length;
const FW = /^\|-activate\|p1[ab]: [^|]*\|ability: Forewarn\|/;
ok(has('forewarn', FW, /lead-rule/) >= 4, 'NON-VACUOUS: the authority announced Forewarn on every rewrite-class lead', has('forewarn', FW, /lead-rule/) + ' games');
ok(hasNot('forewarn', FW, /statusonly-NEG/) === 1, 'NON-VACUOUS: the authority said NOTHING against two status-only foes');
const tieNames = new Set(results.filter(x => /switchin-tie/.test(x.tag)).map(x => (x.sd.find(l => FW.test(l)) || '').split('|')[4]).filter(Boolean));
ok(tieNames.size >= 2, 'NON-VACUOUS: across the switch-in turns the authority\'s die named more than one of the tied moves', [...tieNames].join(', '));
ok(has('chilly', /^\|-fail\|p1a: [^|]*$/, /nobench-ownsnow/) >= K, 'NON-VACUOUS: Chilly Reception into its own snow with no bench wrote -fail in the authority',
   has('chilly', /^\|-fail\|p1a: [^|]*$/, /nobench-ownsnow/) + ' games');
ok(hasNot('chilly', /^\|-fail\|p1a/, /CONTROL/) === 2, 'NON-VACUOUS: neither control wrote -fail in the authority');
ok(has('chilly', /^\|switch\|p1a: /, /bench-CONTROL/) === 1 && has('chilly', /\|\[from\] Chilly Reception/, /bench-CONTROL/) === 1,
   'NON-VACUOUS: with a bench the authority pivoted');
ok(has('held', /^\|-fail\|p2a: [^|]*\|(par|slp|tox)$/, /-same$/) >= 3, 'NON-VACUOUS: a same-status click wrote -fail|TARGET|status under a refusal',
   has('held', /^\|-fail\|p2a: [^|]*\|(par|slp|tox)$/, /-same$/) + ' games');
ok(has('held', /^\|-fail\|p1a: [^|]*$/, /-different$/) >= 1, 'NON-VACUOUS: a different-status click wrote -fail|MOVER under a refusal');
ok(has('held', /^\|-activate\|p2a: [^|]*\|move: (Misty Terrain|Electric Terrain|Safeguard)$/, /fresh-CONTROL/) >= 3,
   'NON-VACUOUS: the refusal still spoke for a fresh target (control)');
ok(has('held', /^\|-activate\|.*move: Misty Terrain$/, /-same$|-different$/) === 0, 'the authority never let Misty Terrain answer for a held status');
const hvCoins = results.filter(x => x.group === 'harvest' && /berryless/.test(x.tag)).length;
ok(hvCoins === K + 2 && has('harvest', FW, /berryless/) === K + 2, 'NON-VACUOUS: every Harvest arm reached the end-of-turn Forewarn entry', has('harvest', FW, /berryless/) + ' of ' + hvCoins);
console.log('  counters: forewarnAnnounced ' + (M.MEDSEEN.forewarnAnnounced | 0) + '   forewarnDie ' + (M.MEDSEEN.forewarnDie | 0)
  + '   forewarnNoDie ' + (M.MEDSEEN.forewarnNoDie | 0) + '   forewarnNothing ' + (M.MEDSEEN.forewarnNothing | 0)
  + '   pivotNothingDoneFailed ' + (M.MEDSEEN.pivotNothingDoneFailed | 0) + '   statusHeldAnsweredFirst ' + (M.MEDSEEN.statusHeldAnsweredFirst | 0)
  + '   harvestCoinThrown ' + (M.MEDSEEN.harvestCoinThrown | 0) + '   forewarnMoveUnknown ' + (M.MEDFAILS.forewarnMoveUnknown | 0)
  + '   forewarnNoState ' + (M.MEDFAILS.forewarnNoState | 0) + '   entryAnnounceUnmodelled ' + (M.MEDFAILS.entryAnnounceUnmodelled | 0)
  + ' (' + (M.MEDFAILS.entryAnnounceUnmodelledFirst || '-') + ')');
if (!ARMED.length) {
  ok((M.MEDSEEN.forewarnAnnounced | 0) > 0 && (M.MEDSEEN.forewarnDie | 0) === (M.MEDSEEN.forewarnAnnounced | 0),
     'every Forewarn announcement came off the die (counter moved, no die-less pick)');
  ok((M.MEDSEEN.forewarnNothing | 0) > 0, 'the empty-list negative ran (counter moved)');
  ok((M.MEDSEEN.pivotNothingDoneFailed | 0) > 0, 'the Chilly Reception -fail actually ran (counter moved)');
  ok((M.MEDSEEN.statusHeldAnsweredFirst | 0) > 0, 'the held-status answer ran ahead of a field refusal (counter moved)');
  ok((M.MEDSEEN.harvestCoinThrown | 0) > 0, 'the Harvest coin was thrown (counter moved)');
  ok((M.MEDFAILS.forewarnMoveUnknown | 0) === 0 && (M.MEDFAILS.forewarnNoState | 0) === 0, 'no Forewarn move went unscored and no holder lost its state');
}

if (CHILD) {
  console.log('__CHILD__' + JSON.stringify({
    div: results.filter(x => x.err || x.div).map(x => x.group + '#' + x.tag),
    board: results.filter(x => x.parts.length).map(x => x.group + '#' + x.tag) }));
  process.exit(bad ? 1 : 0);
}
/* ---- EACH KNOB MUST PART ITS OWN CLASS, NOTHING ELSE, AND (NARRATION KNOBS) NO BOARD, IN A CHILD ---- */
if (!ARMED.length) {
  const { spawnSync } = require('child_process');
  for (const [kn, g] of Object.entries(KNOBS)) {
    console.log(NL + '  --- child under ' + kn + '=1 ---');
    const c = spawnSync(process.execPath, [...process.execArgv, __filename, ...process.argv.slice(2)],
      { env: { ...process.env, [kn]: '1', PROBE_NARC_CHILD: '1' }, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const mark = /__CHILD__(\{.*\})/.exec(String(c.stdout || ''));
    if (!mark) { ok(false, kn + ': the child printed a verdict', 'exit ' + c.status + ' ' + String(c.stderr || '').slice(-400)); continue; }
    const res = JSON.parse(mark[1]);
    const all = [...new Set(res.div.concat(res.board))];
    /* the Harvest arms WITNESS through a Forewarn line, so the Forewarn knob owns both groups */
    const mine = p => g.split('|').some(x => p.startsWith(x + '#'));
    const inScope = all.filter(mine), outScope = all.filter(p => !mine(p));
    ok(c.status !== 0 && inScope.length > 0, kn + ' makes its own class RED',
       inScope.length + ' parted' + (inScope.length ? ', first ' + inScope[0] : '   [identical output across a varied knob means the knob is UNWIRED]'));
    ok(outScope.length === 0, kn + ' parts nothing outside its own class', outScope.length ? outScope.slice(0, 4).join(', ') : null);
    if (!BOARD_MAY_MOVE.has(kn))
      ok(res.board.length === 0, kn + ' moves NO board leaf (the old emission was narration only)', res.board.length ? res.board.slice(0, 4).join(', ') : null);
    else console.log('    (' + kn + ' is a DIE, not a line: ' + res.board.length + ' of its games parted on a BOARD leaf — reported, not required to be zero)');
  }
}
console.log(NL + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
