/* probe_trap_duration.js — A PARTIAL TRAP CHIPS ONE TURN LONGER HERE THAN IN THE AUTHORITY.
 *
 *   SHOWDOWN_PATH=... node tests/probe_trap_duration.js
 *   SHOWDOWN_PATH=... MEDI_TRAP_TICK_BEFORE_CLOCK=1 node tests/probe_trap_duration.js   (the red)
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * THREE of the 46 board-material games in `data/game-differential.json` (release `0dec37ff5ad9`,
 * 961 games, arm `middle`, empirical driver) part on this and nothing else. It is the largest single
 * mechanism in that set outside the fenced damage-value family:
 *
 *   omit-weather   t10  ...2654144561   sd |-end|p1a: Incineroar|Infestation|[partiallytrapped]
 *                                       us |-damage|p1a: Incineroar|34/170 tox|[from] move: infestation
 *                                       board  p1.party.incineroar.hp  medi 34 / sd 55   (= 170/8)
 *   omit-intimidate t8  ...2634747927   same pair; OUR extra tick KILLS Kingambit
 *                                       board  p1.party.kingambit.hp   medi 0 / sd 10
 *   omit-spread     t8  ...2655115392   Fire Spin; farigiraf medi 113 / sd 137  (= 195/8)
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * `data/conditions.ts:222-252` (Champions overrides neither — `data/mods/champions/conditions.ts`
 * carries par/slp/frz only):
 *
 *     partiallytrapped: { duration: 5,
 *       durationCallback(target, source) { if (source?.hasItem('gripclaw')) return 8;
 *                                          return this.random(5, 7); },
 *       onResidualOrder: 13,
 *       onResidual(pokemon) { ... this.damage(pokemon.baseMaxhp / this.effectState.boundDivisor); },
 *       onEnd(pokemon) { this.add('-end', pokemon, this.effectState.sourceEffect, '[partiallytrapped]'); },
 *
 * and the clock that drives it, `sim/battle.ts:515-523`, inside `fieldEvent('Residual')`:
 *
 *     if (eventid === 'Residual' && handler.end && handler.state?.duration) {
 *       handler.state.duration--;
 *       if (!handler.state.duration) { handler.end.call(...); continue; }      // <- SKIPS onResidual
 *     }
 *
 * THE DECREMENT HAPPENS FIRST AND THE EXPIRING TURN DOES NOT CHIP. `duration: 5` is therefore FOUR
 * chips, not five — which is exactly what `data/tags.json` already records as this family's
 * `partialTrap.turns` ("4-5"), sitting unread beside the `duration` the engine did read.
 *
 * medicham2 chipped, THEN decremented, THEN ended (`engine/medicham2-browser.js`, the `_G.has('trap')`
 * block in the residual walk). Same starting counter, one extra chip, and the `-end` lands on the same
 * residual as the authority's — so the two engines part on a `-damage` against an `-end` and the board
 * parts by exactly `maxhp/8`.
 *
 * ================= WHAT IS ASSERTED, AND ON WHAT ================================================
 *
 * Both engines are read on the STATE THEY COMPUTED, never on a value this file recomputes: the
 * victim's hp after each turn, and the presence of the trap on the victim (`_trap` here,
 * `volatiles.partiallytrapped` there). No protocol line decides anything.
 *
 *   1  FIXTURE   the family, the move and the bodies are derived and printed before anything is asked
 *   2  CONTROL   the SAME board with the SAME attacker clicking a NON-trapping move loses ZERO hp to
 *                residual in BOTH engines — so every chip below is attributable to the trap, and the
 *                fixture is not leaking hp from some other source
 *   3  CONTROL   the chip AMOUNT agrees between the engines (the arithmetic is not what changed)
 *   4  TEST      the number of RESIDUAL chips after the landing turn agrees with the authority
 *   5  TEST      the turn the trap LEAVES the victim agrees with the authority
 *   6  CONTROL   the landing turn carried a chip on top of the hit in BOTH engines — `ticksOnLandingTurn`
 *                is true in the tag, and a fix that bought arm 4 by deleting that chip must not pass
 *   7  COUNTER   MEDSEEN.partialTrapTick and MEDSEEN.partialTrapExpired are non-zero — the mechanic
 *                actually ran, rather than the arms agreeing because nothing reached the handler
 *
 * `MEDI_TRAP_TICK_BEFORE_CLOCK=1` restores the chip-then-decrement order. The parent re-runs ITSELF
 * as a child under that knob and FAILS if the child passes.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('PARTIAL TRAP DURATION');
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

const CHILD = process.env.MEDI_TRAP_TICK_BEFORE_CLOCK === '1';
let bad = 0, stage = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
const FIXTURE = (m) => { stage++; console.log('  FIXTURE  ' + m); };

const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };

console.log('\n== A PARTIAL TRAP\'S DURATION ==' + (CHILD ? '   [MEDI_TRAP_TICK_BEFORE_CLOCK=1]' : '') + '\n');

/* ================================================================================================
 * 1 — THE FIXTURE, DERIVED. Nothing below is a typed name.
 * ============================================================================================= */
const FAMILY = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('partialTrap') >= 0)
  .map(k => ({ id: k, p: TAGS.moves[k].params.partialTrap, uses: TAGS.moves[k].uses || 0 }))
  .sort((a, b) => b.uses - a.uses);
console.log('  THE `partialTrap` FAMILY, off data/tags.json:');
for (const f of FAMILY) {
  const mv = dex.moves.get(f.id);
  console.log('    ' + f.id.padEnd(12) + 'duration=' + f.p.duration + ' turns="' + f.p.turns
    + '" chip=' + f.p.chipPerTurn + ' ticksOnLanding=' + f.p.ticksOnLandingTurn
    + '  acc=' + mv.accuracy + '  uses=' + f.uses + (legal(mv) ? '' : '   NOT LEGAL HERE'));
}
/* ONE CONTRACT THE WHOLE FILE RESTS ON, ASSERTED RATHER THAN ASSUMED: the tag's own `turns` string is
 * the FELT chip count and its `duration` is the authority's counter, and they differ by one. If the
 * artifact ever stopped saying that, the claim in this file is about something else. */
const LOW = s => +String(s).split('-')[0];
const CONTRACT = FAMILY.filter(f => LOW(f.p.turns) === f.p.duration - 1);
console.log('  => ' + CONTRACT.length + ' of ' + FAMILY.length
  + ' carry `turns` one BELOW `duration` — the authority skips the chip on the expiring residual.');

const CAND = FAMILY.filter(f => { const m = dex.moves.get(f.id);
  return legal(m) && (m.accuracy === true || m.accuracy === 100) && m.category !== 'Status'; });
if (!CAND.length) { console.log('  NOT RUN — no legal 100-accuracy trapping move. A claim about the format.'); process.exit(2); }

/* THE ATTACKER also needs a filler it can click on every later turn WITHOUT touching the victim: a
 * self-target status move. That keeps the trap the only thing moving the victim's hp. */
const SELF_STATUS = s => Object.keys(LS(s)).filter(id => { const m = dex.moves.get(id);
  return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
    && !m.flags.charge && !m.selfSwitch && !m.stallingMove && !m.heal && !m.self?.volatileStatus; });

let PICK = null;
for (const f of CAND) {
  for (const s of dex.species.all().filter(legal).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!LS(s)[f.id]) continue;
    const fill = SELF_STATUS(s);
    /* A SECOND DAMAGING MOVE ON THE SAME BODY IS THE CONTROL ARM. Same attacker, same target, same
     * turn — only whether the click carries `partialTrap` differs. */
    const other = Object.keys(LS(s)).filter(id => { const m = dex.moves.get(id);
      return m.exists && !m.isNonstandard && m.category !== 'Status'
        && (m.accuracy === true || m.accuracy === 100)
        && !(TAGS.moves[id] && (TAGS.moves[id].tags || []).indexOf('partialTrap') >= 0)
        && !m.multihit && !m.recoil && !m.drain && !m.secondaries; });
    if (fill.length && other.length) { PICK = { mv: f, sp: s, fill: fill[0], other: other[0] }; break; }
  }
  if (PICK) break;
}
if (!PICK) { FIXTURE('no legal attacker learns a trapping move plus a self-status filler plus a plain attack'); process.exit(2); }

/* THE VICTIM: a legal body that learns a self-status filler of its own (so it never attacks back),
 * whose slot-0 ability carries no residual/heal/hp tag, and that is not immune to the trapping move's
 * type. Its max hp must be a multiple-friendly size only insofar as the chip is compared LIKE FOR
 * LIKE — both engines get the same body, so no assumption is needed there. */
const HPABLE = ab => { const t = (TAGS.abilities[ab] || {}).tags || [];
  return t.some(x => /heal|regen|residual|hp|absorb|magicguard|poisonheal/i.test(x)); };
let VIC = null;
for (const s of dex.species.all().filter(legal).sort((a, b) => b.baseStats.hp - a.baseStats.hp)) {
  if (s === PICK.sp) continue;
  const ab = s.abilities[0]; if (!ab || HPABLE(dex.abilities.get(ab).id)) continue;
  const eff = dex.getEffectiveness(dex.moves.get(PICK.mv.id).type, s);
  if (!dex.getImmunity(dex.moves.get(PICK.mv.id).type, s)) continue;
  const fill = SELF_STATUS(s); if (!fill.length) continue;
  let built = null; try { built = MEDI.buildMon(mcKey(s.name, { mayMiss: 'the victim must be a real row' }), {}); } catch (e) { built = null; console.error('probe fixture: buildMon threw for ' + (s && s.name) + ' -- ' + e.message + '. The candidate pool is NARROWER than the format, so a COULD-NOT-STAGE below is a statement about this search and NOT about the mechanic.'); }
  if (!built) continue;
  VIC = { sp: s, fill: fill[0], eff }; break;
}
if (!VIC) { FIXTURE('no legal victim with a self-status filler and an inert slot-0 ability'); process.exit(2); }

console.log('\n  CHOSEN   trap=' + PICK.mv.id + ' (' + PICK.mv.uses + ' uses)   attacker=' + PICK.sp.name
  + '   filler=' + PICK.fill + '   control move=' + PICK.other
  + '\n           victim=' + VIC.sp.name + ' (ability ' + VIC.sp.abilities[0] + ', filler ' + VIC.fill + ')');

const TURNS = PICK.mv.p.duration + 3;

/* ================================================================================================
 * THE TWO RUNS. Same board, same clicks, read off each engine's own state.
 * ============================================================================================= */
const bare = (name, moves) => { const b = MEDI.buildMon(mcKey(name, { mayMiss: 'a probe body must be a real row' }), {});
  if (!b) throw new Error('buildMon failed for ' + name);
  b.moves = moves.map(m => dex.moves.get(m).id); b.item = ''; b.ability = 'none'; return b; };

function runMedi(attackMove) {
  const A = bare(PICK.sp.name, [attackMove, PICK.fill]);
  const A2 = bare(PICK.sp.name, [PICK.fill]);
  const V = bare(VIC.sp.name, [VIC.fill]);
  const V2 = bare(VIC.sp.name, [VIC.fill]);
  const trace = [];
  const S = MEDI.battleInit([A, A2], [V, V2], { seeded: true, trace });
  const rng = () => 0.5;
  const hp = [V.curHP]; const trapGone = [];
  for (let t = 1; t <= TURNS; t++) {
    const mv = t === 1 ? attackMove : PICK.fill;
    const tgt = t === 1 ? V : null;
    MEDI.battleTurn(S, rng,
      new Map([[A, MEDI.playerAction(A, mv, tgt, S.field)], [A2, MEDI.playerAction(A2, PICK.fill, null, S.field)]]),
      new Map([[V, MEDI.playerAction(V, VIC.fill, null, S.field)], [V2, MEDI.playerAction(V2, VIC.fill, null, S.field)]]));
    hp.push(V.curHP); trapGone.push(!V._trap);
  }
  return { maxhp: V.st.hp, hp, trapGone, trace };
}

function runSD(attackMove) {
  const set = (n, mv) => ({ name: n, species: n, item: '', ability: dex.species.get(n).abilities[0],
    moves: mv.map(m => dex.moves.get(m).name),
    nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack([set(PICK.sp.name, [attackMove, PICK.fill]), set(PICK.sp.name, [PICK.fill, PICK.fill])]) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack([set(VIC.sp.name, [VIC.fill, VIC.fill]), set(VIC.sp.name, [VIC.fill, VIC.fill])]) });
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  const vic = b.sides[1].active[0];
  const hp = [vic.hp]; const trapGone = [];
  for (let t = 1; t <= TURNS; t++) {
    b.choose('p1', t === 1 ? ('move ' + attackMove + ' 1, move ' + PICK.fill) : ('move ' + PICK.fill + ', move ' + PICK.fill));
    b.choose('p2', 'move ' + VIC.fill + ', move ' + VIC.fill);
    hp.push(vic.hp); trapGone.push(!vic.volatiles['partiallytrapped']);
  }
  return { maxhp: vic.maxhp, hp, trapGone };
}

const losses = r => r.hp.slice(1).map((h, i) => r.hp[i] - h);
const endTurn = r => { const i = r.trapGone.indexOf(true); return i < 0 ? null : i + 1; };

/* ================================================================================================
 * 2 — CONTROL: the same attacker, a NON-trapping click. Nothing may chip.
 * ============================================================================================= */
const cM = runMedi(PICK.other), cS = runSD(PICK.other);
const cMl = losses(cM), cSl = losses(cS);
const tailM = cMl.slice(1).reduce((a, b) => a + b, 0), tailS = cSl.slice(1).reduce((a, b) => a + b, 0);
ok(tailM === 0 && tailS === 0,
  'CONTROL — with ' + PICK.other + ' (no `partialTrap`) the victim loses NOTHING after the hit, both engines',
  'medi losses ' + JSON.stringify(cMl) + '   sd losses ' + JSON.stringify(cSl)
  + '   — any non-zero tail is the FIXTURE leaking hp, not the trap');
ok(cMl[0] > 0 && cSl[0] > 0, 'CONTROL — and the control move did connect on both sides',
  'medi turn-1 loss ' + cMl[0] + ', sd turn-1 loss ' + cSl[0]);

/* ================================================================================================
 * THE TRAP ARM
 * ============================================================================================= */
const tM = runMedi(PICK.mv.id), tS = runSD(PICK.mv.id);
const tMl = losses(tM), tSl = losses(tS);
console.log('\n  medi  maxhp ' + tM.maxhp + '  per-turn loss ' + JSON.stringify(tMl)
  + '  trap gone after turn ' + endTurn(tM));
console.log('  sd    maxhp ' + tS.maxhp + '  per-turn loss ' + JSON.stringify(tSl)
  + '  trap gone after turn ' + endTurn(tS) + '\n');

/* 3 — CONTROL: the chip AMOUNT. The residual chips are every loss on turns 2+ that is non-zero. */
const chipsM = tMl.slice(1).filter(x => x > 0), chipsS = tSl.slice(1).filter(x => x > 0);
const uniq = a => Array.from(new Set(a));
ok(chipsM.length > 0 && chipsS.length > 0 && uniq(chipsM).length === 1 && uniq(chipsS).length === 1
   && uniq(chipsM)[0] === uniq(chipsS)[0],
  'CONTROL — the chip AMOUNT is one value and the two engines agree on it',
  'medi ' + JSON.stringify(uniq(chipsM)) + '  sd ' + JSON.stringify(uniq(chipsS))
  + '  — this must hold on BOTH arms of the knob; the fix is a clock, not arithmetic');

/* 4 — TEST: how many residual chips land after the landing turn. */
ok(chipsM.length === chipsS.length,
  'TEST — the residual chips after the landing turn agree with the authority',
  'medi ' + chipsM.length + ' chip(s), authority ' + chipsS.length + ' chip(s)'
  + (chipsM.length === chipsS.length ? '' : '   <-- medicham2 chips ' + (chipsM.length - chipsS.length)
     + ' turn(s) too many; the counter is decremented AFTER the chip instead of before'));

/* 5 — TEST: and the trap leaves on the same turn. */
ok(endTurn(tM) !== null && endTurn(tM) === endTurn(tS),
  'TEST — the trap leaves the victim on the same turn in both engines',
  'medi ' + endTurn(tM) + '  authority ' + endTurn(tS));

/* 6 — CONTROL: the landing turn still carries a chip on top of the hit, both engines. `partialTrap`
 * declares `ticksOnLandingTurn: true`, and a fix that bought arm 4 by deleting the landing chip would
 * pass 4 and 5 and be wrong by a whole turn in the other direction. */
const chip = uniq(chipsS)[0] || 0;
ok(tMl[0] > chip && tSl[0] > chip && tMl[0] - chip > 0 && tSl[0] - chip > 0,
  'CONTROL — the LANDING turn carries the hit AND a chip in both engines (`ticksOnLandingTurn`)',
  'medi turn-1 loss ' + tMl[0] + ' vs control-move hit ' + cMl[0] + ' (chip ' + chip + ')'
  + '   sd turn-1 loss ' + tSl[0] + ' vs control-move hit ' + cSl[0]);

/* 7 — COUNTER: the mechanic actually ran here. Two arms agreeing because nothing reached the handler
 * is the failure this line exists to refuse. */
const S1 = MEDI.MEDSEEN || {};
ok((S1.partialTrapTick || 0) > 0 && (S1.partialTrapExpired || 0) > 0,
  'COUNTER — the trap handler ran and a trap EXPIRED on the clock during this run',
  'partialTrapTick=' + (S1.partialTrapTick === undefined ? 'ABSENT' : S1.partialTrapTick)
  + '  partialTrapExpired=' + (S1.partialTrapExpired === undefined ? 'ABSENT' : S1.partialTrapExpired)
  + '  trapEndedSourceGone=' + (S1.trapEndedSourceGone || 0));

/* ================================================================================================
 * THE KNOB. The parent re-runs itself with the old order restored and FAILS if that child passes.
 * ============================================================================================= */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [__filename],
    { env: { ...process.env, MEDI_TRAP_TICK_BEFORE_CLOCK: '1' }, encoding: 'utf8' });
  const out = String(r.stdout || '') + String(r.stderr || '');
  const line = (out.match(/^ *(PASS|FAIL) *TEST — the residual chips.*$/m) || [''])[0].trim();
  ok(r.status !== 0,
    'KNOB — restoring the chip-then-decrement order REDS this probe',
    'child exit ' + r.status + '   ' + (line || '(the arm printed nothing — the knob is not wired)'));
}

console.log('\n  ' + (stage ? stage + ' FIXTURE problem(s) — a claim about the fixture, never about the mechanic. ' : '')
  + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad || stage ? 1 : 0);
