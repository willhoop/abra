/* immunity_sweep.js — EVERY IMMUNITY IN THE FORMAT, DERIVED, PLAYED IN BOTH ENGINES, COMPARED.
 *
 *   SHOWDOWN_PATH=... node engine/immunity_sweep.js               the whole sweep
 *   SHOWDOWN_PATH=... node engine/immunity_sweep.js --derive      print the derivation and stop
 *   SHOWDOWN_PATH=... node engine/immunity_sweep.js --only A,C
 *   SHOWDOWN_PATH=... node engine/immunity_sweep.js --json        also write data/immunity-sweep.json
 *
 * ================= WHY A SWEEP AND NOT A LIST ====================================================
 *
 * Will, 2026-08-25: *"make sure all the immunities, like fire types cant be burned are in there"*,
 * *"grass types are immune to powder moves"*, *"no poison into steel"*, *"unless corrosive"*.
 *
 * A checker written as a list of pairs somebody typed cannot catch a pair nobody thought of, and
 * this repository has paid for exactly that shape three times — the ban list of four, the fourteen
 * handoffs, and the hand-maintained `STATUS_IMMUNE_TYPE` table this file is aimed at. So every axis
 * below is read out of the format on the run:
 *
 *   THE IMMUNITY CLASSES come from `TypeInfo.damageTaken`. `Dex#getImmunity(source, target)` is one
 *   line — `if (typeData.damageTaken[sourceType] === 3) return false` — so the set of things a type
 *   can be immune TO is exactly the set of keys some type scores 3 on. A nineteenth class added
 *   upstream is swept with no edit here.
 *   THE MOVES come from `move.status`, `move.flags.powder`, `move.weather`, and a scan of the raw
 *   handler SOURCE for `addVolatile('trapped')`.
 *   THE ABILITIES come from the AUTHORITY's own handler set (`onSetStatus`, `onAllySetStatus`,
 *   `onImmunity`, `onTryHit`), never from a name and never from `data/tags.json` — the artifact
 *   under-derives here and this file prints the gap rather than inheriting it.
 *   THE BODIES come from a filtered walk of `Dex.forFormat`, one per type, and the walk is PRINTED.
 *
 * ================= WHAT IT MEASURES ==============================================================
 *
 * Nothing here types an expected answer. Both engines play the SAME staged turn with the SAME
 * species and the SAME ability on both sides, and Showdown is the expectation — `staged_board.js`'s
 * discipline at sweep scale. The observable is a state digest of the target read out of each engine
 * (`status`, `types`, `boosts`, `tookDamage`, `stillActive`), not a protocol line, because a
 * protocol difference is narration and a digest difference is a board.
 *
 * HP IS COMPARED AS A BOOLEAN, NEVER AS A NUMBER. The two engines do not share a damage roll here
 * and a magnitude difference would read as an immunity defect. `tests/test-engine-diff.js` owns
 * magnitude; this file owns "did anything land at all", which is the immunity question.
 *
 * ================= THE FIXTURE HAZARD THIS FILE EXISTS BECAUSE OF ================================
 *
 * A fixture immune for the WRONG reason proves nothing. Two census probes were GREEN on the Thunder
 * Wave defect because both aimed it at a body immune for an unrelated reason. So every row carries
 * `reasons` — the list of independent authority-side refusals that apply to that cell, computed
 * from the derivation rather than guessed:
 *
 *   reasons 0   the move must land. A refusal here is a FALSE immunity.
 *   reasons 1   a SINGLE-REASON cell. The only kind a census probe may be built on.
 *   reasons 2+  over-determined. Agreement here is not evidence about either reason.
 *
 * The three counts are printed per population, so "we agree everywhere" can never be read as "every
 * reason is wired" — the exact conflation that made those two probes green.
 *
 * ================= THE ACCURACY DIE IS REMOVED FROM BOTH ENGINES, IDENTICALLY ====================
 *
 * Otherwise a missed Hypnosis reads as an immunity. Showdown's `hitStepAccuracy` is replaced by a
 * function returning true for every target — it removes ONLY the accuracy roll and leaves
 * `hitStepInvulnerability`, `hitStepTryImmunity` and the type chart exactly where they are.
 * medicham2 is driven with `rng = () => 0.5`, and its to-hit test is `acc<100 && rng()*100>acc`, so
 * 0.5 lands every printed accuracy at or above 50 — which is every status move in this format. The
 * one population that WANTS the die (Toxic from a Poison type) turns the override off and says so.
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
const { Dex, Teams } = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim'));
const { Battle } = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim', 'battle.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = Dex.forFormat(CS.FORMAT);

require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legal = x => x && x.exists && !x.isNonstandard;
const legalSpecies = s => legal(s) && s.tier !== 'Illegal';
const ARGV = process.argv.slice(2);
const has = f => ARGV.includes(f);
const val = (f, d) => { const i = ARGV.indexOf(f); return i >= 0 ? ARGV[i + 1] : d; };

/* Stringify an entire raw dex entry INCLUDING its handler bodies, so a rule that lives in code
 * rather than in a field can still be derived. Used for the trap family. */
function srcOf(o, depth) {
  depth = depth || 0;
  if (!o || depth > 2) return '';
  let s = '';
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'function') s += String(v);
    else if (v && typeof v === 'object') s += srcOf(v, depth + 1);
    else s += k + ':' + v + ';';
  }
  return s;
}

/* ================= 1. THE IMMUNITY CLASSES, DERIVED ============================================ */
const TYPES = dex.types.all().filter(t => legal(t) && t.name !== 'Stellar' && t.name !== '???')
  .map(t => t.name);
const CLASSES = (() => {
  const seen = new Set();
  for (const name of TYPES) {
    const td = dex.types.get(name);
    for (const k of Object.keys(td.damageTaken || {})) if (td.damageTaken[k] === 3) seen.add(k);
  }
  return [...seen].sort();
})();
const NON_TYPE_CLASSES = CLASSES.filter(c => !TYPES.includes(c));
const IMMUNE_TYPES = {};
for (const c of CLASSES) IMMUNE_TYPES[c] = TYPES.filter(t => !dex.getImmunity(c, t));

/* ================= 2. THE MOVES, DERIVED ====================================================== */
const MOVES = dex.moves.all().filter(legal);
const targetable = m => m.target !== 'self' && m.target !== 'allySide' && m.target !== 'all' &&
  m.target !== 'allyTeam' && m.target !== 'foeSide';
const STATUS_MOVES = MOVES.filter(m => m.status && targetable(m)).map(m => m.id).sort();
const POWDER_MOVES = MOVES.filter(m => m.flags && m.flags.powder).map(m => m.id).sort();
const POWDER_TARGETED = POWDER_MOVES.filter(id => targetable(dex.moves.get(id)));
const POWDER_SELF = POWDER_MOVES.filter(id => !targetable(dex.moves.get(id)));
const TRAP_MOVES = MOVES.filter(m => targetable(m) &&
  /addVolatile\(.trapped.|volatileStatus:trapped;/.test(srcOf(dex.data.Moves[m.id]))).map(m => m.id).sort();
const WEATHER_MOVES = MOVES.filter(m => m.weather).map(m => m.id).sort();
/* `move.ignoreImmunity` is a GETTER that defaults to `category === 'Status'`, so asking the Move
 * object answers `true` for every status move that never declared anything. The raw data is the only
 * place a DECLARATION is visible, and Thunder Wave's `false` is the whole of the defect this sweep
 * was commissioned after. */
const RAW_IGNORE = {};
for (const m of MOVES) {
  const j = dex.data.Moves[m.id];
  if (j && Object.prototype.hasOwnProperty.call(j, 'ignoreImmunity')) RAW_IGNORE[m.id] = j.ignoreImmunity;
}
const TYPECHART_STATUS_MOVES = MOVES.filter(m => m.category === 'Status' && RAW_IGNORE[m.id] === false).map(m => m.id);
/* ================= 3. THE ABILITIES, DERIVED FROM THE AUTHORITY ================================ */
/* NOT from `data/tags.json`. The artifact's `statusImmune` set holds SEVEN abilities; the format has
 * fourteen legal abilities carrying an `onSetStatus`-family handler. Both lists are printed and the
 * gap is a finding, not a fixture choice. */
const STATUS_HANDLERS = ['onSetStatus', 'onAllySetStatus', 'onAnySetStatus', 'onImmunity',
  'onUpdate', 'onTryHit', 'onAllyTryHitSide'];
const ABIL_CANDIDATES = dex.abilities.all().filter(a => legal(a) && STATUS_HANDLERS.some(h => a[h]));
const CARRIERS = {};
for (const a of ABIL_CANDIDATES) {
  CARRIERS[a.id] = dex.species.all()
    .filter(s => legalSpecies(s) && Object.values(s.abilities || {}).some(x => norm(x) === a.id))
    .map(s => s.name);
}
const ABIL_REACHABLE = ABIL_CANDIDATES.filter(a => CARRIERS[a.id].length).map(a => a.id);
const ABIL_UNREACHABLE = ABIL_CANDIDATES.filter(a => !CARRIERS[a.id].length).map(a => a.id);
/* The tag view, for the gap report only. */
const ABIL_TAGS = TAGS.abilities || {};
const tagParam = (id, tag) => {
  const a = ABIL_TAGS[id];
  return a && a.params && a.params[tag] ? a.params[tag] : ((a && (a.tags || []).includes(tag)) ? {} : null);
};
const carriersOfTag = tag => Object.keys(ABIL_TAGS)
  .filter(id => (ABIL_TAGS[id].tags || []).includes(tag) && legal(dex.abilities.get(id)));
const TAG_STATUS_IMMUNE = carriersOfTag('statusImmune');
const TAG_ALLY_STATUS = carriersOfTag('protectsAllyFromStatus');
const TAG_MOVECLASS = carriersOfTag('immuneToMoveClass');
const BYPASS_ABIL = Object.keys(ABIL_TAGS).filter(id => {
  const p = tagParam(id, 'nameImplementedBySim');
  return p && Array.isArray(p.ignoresStatusImmunityFor) && p.ignoresStatusImmunityFor.length;
}).filter(id => legal(dex.abilities.get(id)) && (CARRIERS[id] || []).length === undefined ? true : true)
  .filter(id => legal(dex.abilities.get(id)));
/* Which of the derived abilities does the ARTIFACT not know is a status refuser. Printed, never
 * silently patched — the engine may still be right by another road, and the sweep says which. */
const SETSTATUS_ABIL = ABIL_CANDIDATES.filter(a => a.onSetStatus || a.onAllySetStatus).map(a => a.id);
const TAG_GAP = SETSTATUS_ABIL.filter(id => !TAG_STATUS_IMMUNE.includes(id) && !TAG_ALLY_STATUS.includes(id));

/* ================= 4. THE BODIES, DERIVED AND PRINTED ========================================= */
const SPECIES = dex.species.all().filter(legalSpecies);
/* A SPECIES medicham2 CAN BUILD. The `catch` is LOUD: `buildMon` throwing is a real fact about the
 * engine's table, and swallowing it silently would let this sweep quietly pick a different body and
 * report a clean run over a fixture nobody chose. Counted and printed with the derivation. */
const buildFailures = { n: 0, first: '' };
const hasRow = name => {
  try { return !!M.buildMon(norm(name), {}); }
  catch (e) {
    buildFailures.n++;
    if (!buildFailures.first) buildFailures.first = name + ': ' + e.message;
    return false;
  }
};
const stageable = s => !s.battleOnly && !s.requiredItem && !String(s.forme || '').includes('Mega');
const BODY = {}, BODY_WHY = {};
for (const t of TYPES) {
  const mono = SPECIES.find(s => stageable(s) && s.types.length === 1 && s.types[0] === t && hasRow(s.name));
  const dual = SPECIES.find(s => stageable(s) && s.types.includes(t) && hasRow(s.name));
  const pick = mono || dual;
  if (!pick) continue;
  BODY[t] = pick.name;
  BODY_WHY[t] = mono ? 'mono' : 'dual:' + pick.types.join('/');
}
/* The neutral body: a type that is immune to NOTHING in the non-type classes and to no attacking
 * type either, so that when the ability is the knob it is the ONLY reason in the cell. */
const NEUTRAL_TYPE = TYPES.find(t => CLASSES.every(c => dex.getImmunity(c, t))) || 'Normal';
const NEUTRAL = BODY[NEUTRAL_TYPE];
/* An attacker whose own type cannot change the answer: not Poison (Toxic's never-miss), not Dark
 * (Prankster), and a body medicham2 has a row for. */
const ATT_TYPE = TYPES.find(t => t !== 'Poison' && t !== 'Dark' && BODY[t]) || NEUTRAL_TYPE;
const ATTACKER = BODY[ATT_TYPE];
const POISON_ATTACKER = BODY['Poison'];

/* EVERY MOVE THAT DELIVERS A GIVEN STATUS, GROUPED BY WHETHER THE TYPE CHART JUDGES IT.
 *
 * Will, 2026-08-25, asked whether Stun Spore works on a Ground type. It does, and Thunder Wave does
 * not, and they inflict the SAME status — the difference is `ignoreImmunity`, which is declared on
 * Thunder Wave and defaulted on everything else. That is the shape the two broken census probes could
 * not see: they could not tell "refused by TYPE" from "refused by STATUS", so they were green either
 * way.
 *
 * SO THE TRIPLE IS DERIVED, NOT TYPED. For each status this collects every legal targeted move that
 * inflicts it — as a primary OR as a 100% secondary, which is how Nuzzle and Zap Cannon get in — and
 * splits them on whether the chart applies. A body that refuses one group and not the other is an
 * anchor board that CANNOT be green by accident: an engine that ignores type immunity everywhere and
 * an engine that honours it everywhere both fail it, in opposite and named directions.
 *
 * A 100% SECONDARY IS IN AND A CHANCE ONE IS OUT, because this sweep removes the accuracy die and not
 * the secondary die; a 30% burn would need a roll that both engines drew the same way, which is a
 * different instrument's problem. */
const DELIVERERS = (() => {
  const out = {};
  for (const m of MOVES) {
    if (!['normal', 'any', 'adjacentFoe'].includes(m.target)) continue;
    const sts = new Set();
    if (m.status) sts.add(m.status);
    for (const sec of (m.secondaries || [])) if (sec && sec.status && sec.chance === 100) sts.add(sec.status);
    if (m.secondary && m.secondary.status && m.secondary.chance === 100) sts.add(m.secondary.status);
    for (const st of sts) (out[st] = out[st] || []).push(m.id);
  }
  return out;
})();
const chartJudges = id => {
  const m = dex.moves.get(id);
  return m.category !== 'Status' || RAW_IGNORE[id] === false;
};
/* The anchor boards, derived: a (status, type) at which the two groups CANNOT both be right. */
const ANCHORS = [];
for (const st of Object.keys(DELIVERERS)) {
  const judged = DELIVERERS[st].filter(chartJudges);
  const free = DELIVERERS[st].filter(id => !chartJudges(id));
  if (!judged.length || !free.length) continue;
  for (const t of TYPES) {
    if (!BODY[t]) continue;
    const key = st === 'tox' ? 'psn' : st;
    if (!dex.getImmunity(key, t)) continue;                    // the STATUS is refused: no separation
    const jRefused = judged.filter(id => !dex.getImmunity(dex.moves.get(id).type, t));
    const fRefused = free.filter(id => !dex.getImmunity(dex.moves.get(id).type, t) && chartJudges(id));
    if (jRefused.length && jRefused.length < judged.length + free.length && !fRefused.length)
      ANCHORS.push({ status: st, type: t, mustFail: jRefused, mustLand: free.concat(judged.filter(id => !jRefused.includes(id))) });
  }
}
const SECONDARY_STATUS = MOVES.filter(m => !m.status &&
  ((m.secondaries || []).some(s => s && s.status) || (m.secondary && m.secondary.status))).map(m => m.id);
/* One damaging move per type, for the type-chart population. Picked for staging, not for realism:
 * single-hit, no charge, no recharge, ordinary target, and the highest printed accuracy available so
 * the accuracy override has the least work to do. */
const ATTACK_OF_TYPE = {};
/* A move that lands or does not land purely on the type chart. Secondaries are ALLOWED — the only
 * leaf population J compares is `tookDamage`, which a secondary cannot move — but anything that can
 * refuse or redirect the hit for its own reasons is excluded, or the cell would carry a second
 * reason nobody counted. */
const BAD_HANDLER = ['onTry', 'onTryMove', 'onTryHit', 'onModifyType', 'onEffectiveness', 'onHit',
  'onAfterHit', 'onPrepareHit', 'onModifyMove', 'onBasePower', 'onDisableMove', 'onMoveFail'];
const plainAttack = m => {
  const j = dex.data.Moves[m.id] || {};
  if (BAD_HANDLER.some(k => j[k])) return false;
  if (j.damageCallback || j.basePowerCallback || j.willCrit || j.ohko || j.selfdestruct) return false;
  if (j.forceSwitch || j.selfSwitch || j.recoil || j.hasCrashDamage) return false;
  if ((m.flags || {}).charge || (m.flags || {}).recharge) return false;
  if (m.priority !== 0) return false;
  if (m.accuracy !== true && m.accuracy < 85) return false;
  return m.category !== 'Status' && m.basePower > 0 && m.target === 'normal';
};
for (const t of TYPES) {
  const cand = MOVES.filter(m => m.type === t && plainAttack(m));
  cand.sort((a, b) => ((b.accuracy === true ? 101 : b.accuracy) - (a.accuracy === true ? 101 : a.accuracy))
    || (b.basePower - a.basePower));
  if (cand[0]) ATTACK_OF_TYPE[t] = cand[0].id;
}


/* An ability that does nothing at all, so no fixture carries a silent extra reason. Derived: legal,
 * no `on*` handler, and not one of the abilities the simulator implements BY NAME elsewhere. */
const SIM_BY_NAME = new Set(['levitate', 'corrosion', 'runaway', 'terashell', 'multitype',
  'rkssystem', 'dancer', 'earlybird']);
const INERT_ABILITY = (() => {
  const a = dex.abilities.all().find(x => legal(x) &&
    !Object.keys(x).some(k => /^on[A-Z]/.test(k)) && !SIM_BY_NAME.has(x.id));
  if (!a) throw new Error('no handler-free legal ability — the fixture cannot be built');
  return a.name;
})();
const INERT_ABILITY_ID = norm(INERT_ABILITY);
const INERT_MOVE = CS.INERT_MOVE;
/* Prankster needs a carrier only for its ABILITY string; the body is the ordinary attacker so the
 * user's own type cannot be the reason. */
const PRANKSTER = dex.abilities.get('prankster');

/* ================= 5. THE TWO HARNESSES ======================================================= */
function mkSet(species, moves, o) {
  o = o || {};
  return {
    name: species, species, item: o.item || '', ability: o.ability || INERT_ABILITY,
    moves: [].concat(moves), nature: 'Serious',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
  };
}
const FILLER_SP = 'Ditto';

/* A CHOICE STRING IS DERIVED FROM THE MOVE'S OWN `target`, NEVER TYPED. Showdown REJECTS `move 1 1`
 * for a spread move (`allAdjacentFoes`, `all`) and REJECTS a bare `move 1` for a `any`-target move in
 * doubles. Both mistakes were made here first, and both read as an engine finding: 52 cells came back
 * `THREW-AUTHORITY` and one of them was Cotton Spore, an immunity the sweep exists to check. */
const NEEDS_TARGET = new Set(['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf']);
function p1Choice(moveId, aimSlot) {
  const m = dex.moves.get(moveId);
  return 'move 1' + (NEEDS_TARGET.has(m.target) ? ' ' + (aimSlot || 1) : '') + ', move 1';
}
function p2Choice(moveId) {
  const m = dex.moves.get(moveId || INERT_MOVE);
  return 'move 1' + (NEEDS_TARGET.has(m.target) ? ' 1' : '') + ', move 1';
}
function showdown(o) {
  const attMoves = [o.move].concat(o.attExtra || []);
  const defMoves = [o.defMove || INERT_MOVE];
  const teamA = [mkSet(o.att, attMoves, o.attOpts), mkSet(FILLER_SP, [INERT_MOVE]),
                 mkSet(FILLER_SP, [INERT_MOVE]), mkSet(FILLER_SP, [INERT_MOVE])];
  const teamB = [mkSet(o.def, defMoves, o.defOpts), mkSet(FILLER_SP, [INERT_MOVE]),
                 mkSet(FILLER_SP, [INERT_MOVE]), mkSet(FILLER_SP, [INERT_MOVE])];
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (b.requestState === 'teampreview') { b.choose('p1', 'team 1234'); b.choose('p2', 'team 1234'); }
  if (!o.keepAccuracy) b.actions.hitStepAccuracy = targets => targets.map(() => true);
  const tracked = b.p2.active[0];
  const partner = b.p2.active[1];
  const maxhp = tracked.maxhp, pmax = partner ? partner.maxhp : 0;
  if (o.prepSD) o.prepSD(b.p1.active[0], tracked, b);
  const turns = o.turns || 1;
  let switchRefused = null;
  for (let i = 0; i < turns; i++) {
    const p1c = (o.p1script && o.p1script[i]) || p1Choice(o.move, o.aimSlot);
    const p2c = (o.p2script && o.p2script[i]) || p2Choice(o.defMove && norm(o.defMove));
    if (!b.choose('p1', p1c)) throw new Error('p1 choice rejected: ' + p1c);
    const ok = b.choose('p2', p2c);
    if (!ok) {
      if (o.p2script && /switch/.test(p2c)) { switchRefused = true; b.choose('p2', 'move 1, move 1'); }
      else throw new Error('p2 choice rejected: ' + p2c);
    } else if (o.p2script && /switch/.test(p2c)) switchRefused = false;
    /* A KO OPENS A FORCED-SWITCH REQUEST AND THE TURN DOES NOT ADVANCE UNTIL IT IS ANSWERED. Left
     * unhandled this threw on exactly the cells where the attack WORKED — a false immunity report
     * shaped like a harness error. `default` is the authority's own auto-choice. */
    let guard = 0;
    while (b.requestState === 'switch' && guard++ < 8) {
      for (const sd of ['p1', 'p2']) if (b[sd].activeRequest && !b[sd].activeRequest.wait) b.choose(sd, 'default');
    }
    if (b.turn < i + 2) throw new Error('turn ' + (i + 1) + ' never resolved (turn=' + b.turn + ')');
  }
  return {
    status: tracked.status || '', types: tracked.getTypes().join('/'),
    boosts: pickBoosts(tracked.boosts), tookDamage: tracked.hp < maxhp,
    partnerTookDamage: partner ? partner.hp < pmax : false, fainted: tracked.hp <= 0,
    stillActive: b.p2.active[0] === tracked, switchRefused,
    active0: norm(b.p2.active[0].species.name), log: b.log,
  };
}

const bare = (sp, o) => {
  const b = M.buildMon(norm(sp), {});
  if (!b) throw new Error('no MC row for ' + sp);
  b.item = (o && o.item) || '';
  b.ability = norm((o && o.ability) || INERT_ABILITY);
  return b;
};
function medi(o) {
  const me = bare(o.att, o.attOpts), a2 = bare(FILLER_SP), a3 = bare(FILLER_SP), a4 = bare(FILLER_SP);
  const f1 = bare(o.def, o.defOpts), b2 = bare(FILLER_SP), b3 = bare(FILLER_SP), b4 = bare(FILLER_SP);
  const S = M.battleInit([me, a2, a3, a4], [f1, b2, b3, b4], { seeded: true });
  const maxhp = f1.st.hp, pmax = b2.st.hp;
  const rng = o.rng || (() => 0.5);
  if (o.prepM) o.prepM(me, f1, S);
  const turns = o.turns || 1;
  const aim = (o.aimSlot === 2) ? b2 : f1;
  for (let i = 0; i < turns; i++) {
    const bAct = (o.mScript && o.mScript[i] === 'switch')
      ? { kind: 'switch', to: b3 }
      : (o.defMoveM ? M.playerAction(f1, norm(o.defMoveM), me, S.field) : { kind: 'pass' });
    const aAct = (o.m2Pass && i > 0) ? { kind: 'pass' } : M.playerAction(me, norm(o.move), aim, S.field);
    M.battleTurn(S, rng,
      new Map([[me, aAct], [a2, { kind: 'pass' }]]),
      new Map([[f1, bAct], [b2, { kind: 'pass' }]]));
  }
  return {
    status: f1.status || '', types: (f1.types || []).join('/'),
    boosts: pickBoosts(mapBoosts(f1.boosts)), tookDamage: f1.curHP < maxhp,
    partnerTookDamage: b2.curHP < pmax, fainted: !!f1.fainted || f1.curHP <= 0,
    stillActive: S.actB.indexOf(f1) === 0, switchRefused: null,
    active0: norm(S.actB[0] && (S.actB[0].species || S.actB[0].name)), mon: f1, user: me, S,
  };
}
const BOOST_MAP = { at: 'atk', df: 'def', sa: 'spa', sd: 'spd', sp: 'spe', acc: 'accuracy', eva: 'evasion' };
function mapBoosts(b) {
  const out = {};
  for (const k of Object.keys(b || {})) out[BOOST_MAP[k] || k] = b[k];
  return out;
}
function pickBoosts(b) {
  const keys = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
  return keys.map(k => k + (((b || {})[k]) | 0)).join(',');
}

/* ================= 6. HOW MANY REASONS DOES THIS CELL HAVE ==================================== */
/* Computed from the derivation, never guessed. Two reasons cannot be separated, so a two-reason
 * agreement is evidence about neither. */
function reasonsFor(o) {
  const mv = dex.moves.get(o.move);
  const types = dex.species.get(o.def).types;
  const attAb = norm((o.attOpts && o.attOpts.ability) || '');
  const defAb = norm((o.defOpts && o.defOpts.ability) || '');
  const why = [];
  const bypass = attAb && BYPASS_ABIL.includes(attAb)
    ? (tagParam(attAb, 'nameImplementedBySim').ignoresStatusImmunityFor || []) : [];
  if (mv.status) {
    const key = mv.status === 'tox' ? 'psn' : mv.status;
    if (!bypass.includes(mv.status) && types.some(t => !dex.getImmunity(key, t))) why.push('status-type:' + key);
  }
  if (mv.flags && mv.flags.powder && types.some(t => !dex.getImmunity('powder', t))) why.push('powder-type');
  const chartApplies = mv.category !== 'Status' || RAW_IGNORE[mv.id] === false;
  if (chartApplies && types.some(t => !dex.getImmunity(mv.type, t))) why.push('type-chart:' + mv.type);
  if (o.weatherClass && types.some(t => !dex.getImmunity(o.weatherClass, t))) why.push('weather:' + o.weatherClass);
  if (o.trapClass && types.some(t => !dex.getImmunity('trapped', t))) why.push('trapped-type');
  if (attAb === 'prankster' && mv.category === 'Status' && types.some(t => !dex.getImmunity('prankster', t)))
    why.push('prankster-type');
  if (defAb && defAb !== INERT_ABILITY_ID) why.push('ability:' + defAb);
  return why;
}

/* ================= 7. THE CELL ================================================================ */
const rows = [];
const counters = { staged: 0, threwSD: 0, threwMEDI: 0, differ: 0 };
const COMPARE = ['status', 'types', 'boosts', 'tookDamage', 'stillActive'];
function cell(o) {
  counters.staged++;
  let a, b;
  try { a = showdown(o); } catch (e) { counters.threwSD++; rows.push({ pop: o.pop, move: o.move, def: o.def, verdict: 'THREW-AUTHORITY', err: e.message }); return; }
  try { b = medi(o); } catch (e) { counters.threwMEDI++; rows.push({ pop: o.pop, move: o.move, def: o.def, verdict: 'THREW-MEDICHAM', err: e.message }); return; }
  /* A CELL WHOSE TARGET DIED CANNOT ANSWER A QUESTION ABOUT LEAVING THE FIELD, and reading it
   * anyway is how population G first reported three engine defects that were a KO. Declared and
   * counted, never silently passed. */
  if (o.needsAlive && (a.fainted || b.fainted)) {
    rows.push({ pop: o.pop, why: o.why || '', move: o.move, def: o.def, att: o.att,
                defAb: INERT_ABILITY_ID, attAb: INERT_ABILITY_ID, reasons: reasonsFor(o),
                verdict: 'NOT-STAGED-TARGET-FAINTED', leaves: [] });
    return;
  }
  const leaves = [];
  for (const k of (o.compare || COMPARE)) {
    if (String(a[k]) !== String(b[k])) leaves.push(`${k}: authority ${a[k]} / medicham ${b[k]}`);
  }
  const digest = x => (o.compare || COMPARE).map(k => k + '=' + x[k]).join(' ');
  const r = {
    pop: o.pop, why: o.why || '', move: o.move, att: o.att, def: o.def,
    sep: o.sep || null, authority: digest(a), medicham: digest(b),
    defAb: norm((o.defOpts && o.defOpts.ability) || INERT_ABILITY),
    attAb: norm((o.attOpts && o.attOpts.ability) || INERT_ABILITY),
    reasons: reasonsFor(o),
    verdict: leaves.length ? 'DIFFER' : 'AGREE', leaves,
  };
  if (leaves.length) counters.differ++;
  rows.push(r);
}

/* ================= 8. THE POPULATIONS ========================================================= */
const ONLY = val('--only', '');
const wants = p => !ONLY || ONLY.split(',').includes(p);

/* A — every primary-status move into every type. The `brn`/`par`/`psn`/`frz`/`slp` classes and, for
 * the one move that declares it, the TYPE CHART on a Status move. */
function popA() {
  for (const mv of STATUS_MOVES) for (const t of TYPES) if (BODY[t])
    cell({ pop: 'A', why: 'status move into a type', att: ATTACKER, move: mv, def: BODY[t] });
}
/* B — every targeted powder move into every type. Grass is the refuser. */
function popB() {
  for (const mv of POWDER_TARGETED) for (const t of TYPES) if (BODY[t])
    cell({ pop: 'B', why: 'powder move into a type', att: ATTACKER, move: mv, def: BODY[t] });
}
/* C — every ability the AUTHORITY gives a status-family handler, against every status and powder
 * move, on the neutral body so the ability is the only reason. */
function popC() {
  const moves = STATUS_MOVES.concat(POWDER_TARGETED.filter(x => !STATUS_MOVES.includes(x)));
  for (const ab of ABIL_REACHABLE) for (const mv of moves)
    cell({ pop: 'C', why: 'ability against a status/powder move', att: ATTACKER, move: mv,
           def: NEUTRAL, defOpts: { ability: dex.abilities.get(ab).name } });
}
/* D — the OVERRIDE. A bypass ability on the ATTACKER against every type. Corrosion's own param says
 * which statuses walk through, and the arms it must NOT move (a burn, a sleep) are in the same sweep
 * rather than in a separate assertion. */
function popD() {
  for (const ab of BYPASS_ABIL) {
    const name = dex.abilities.get(ab).name;
    for (const mv of STATUS_MOVES) for (const t of TYPES) if (BODY[t])
      cell({ pop: 'D', why: 'status-immunity bypass ability on the attacker', att: ATTACKER,
             move: mv, def: BODY[t], attOpts: { ability: name } });
  }
}
/* E — TOXIC FROM A POISON TYPE. Two independent branches at two different source lines, so two arms
 * each with its own control:
 *   accuracy   the die is LEFT IN and the target is at +6 evasion. `accuracy = true` (the Aerial Ace
 *              mechanism) means evasion does nothing; a non-Poison user is the control.
 *   invuln     the target is semi-invulnerable (Fly). The Poison user hits through it; the
 *              non-Poison user must not.
 * Both are read as `status`, which is the outcome, not as a protocol line. */
function popE() {
  if (!POISON_ATTACKER) return;
  const rngMiss = () => 0.99;      // loses every printed accuracy in this format
  for (const att of [POISON_ATTACKER, ATTACKER]) {
    cell({ pop: 'E', sep: 'toxic-accuracy',
           why: `toxic accuracy, user ${att} (+6 evasion target, die LEFT IN)`,
           att, move: 'toxic', def: NEUTRAL, keepAccuracy: true, rng: rngMiss,
           prepSD: (u, t) => { t.boosts.evasion = 6; },
           prepM: (u, f) => { f.boosts.eva = 6; },
           compare: ['status'] });
  }
  const flier = SPECIES.find(s => stageable(s) && hasRow(s.name) && dex.learnsets &&
    s.types.includes('Flying')) || dex.species.get(BODY['Flying']);
  for (const att of [POISON_ATTACKER, ATTACKER]) {
    cell({ pop: 'E', sep: 'toxic-invulnerable',
           why: `toxic through a semi-invulnerable target, user ${att}`,
           att, move: 'toxic', def: flier.name, defMove: 'Fly', defMoveM: 'fly',
           compare: ['status'] });
  }
}
/* F — RAGE POWDER, whose observable is the REDIRECT and not a status.
 *
 * THE FIRST VERSION OF THIS POPULATION WAS WRONG IN EXACTLY THE WAY THIS FILE WARNS ABOUT, and the
 * separation check is what said so — four arms, one authority answer, so the knob was unwired. The
 * powder immunity that matters here belongs to the ATTACKER, not to the drawer:
 *     onFoeRedirectTarget(target, source, source2, move) { ... if (source.runStatusImmunity('powder')
 * `source` is the body being pulled. A Grass ATTACKER ignores Rage Powder; a Grass DRAWER draws
 * exactly like anything else. medicham2 reads it off the user too (`powderBlocked(user, ...)`), so
 * the original arms agreed for the right reason and proved nothing. */
function popF() {
  if (!POWDER_SELF.length) return;
  const drawMv = POWDER_SELF[0];
  const atk = ATTACK_OF_TYPE[NEUTRAL_TYPE];
  for (const attType of ['Grass', ATT_TYPE]) {
    const att = BODY[attType];
    if (!att) continue;
    cell({ pop: 'F', sep: 'ragepowder-attacker-type',
           why: `${drawMv} against a ${attType} ATTACKER — a Grass attacker ignores the draw`,
           att, move: atk, def: NEUTRAL, aimSlot: 2,
           defMove: dex.moves.get(drawMv).name, defMoveM: drawMv,
           compare: ['tookDamage', 'partnerTookDamage'] });
  }
  const powderAb = TAG_MOVECLASS.filter(id =>
    /powder/.test(JSON.stringify(tagParam(id, 'immuneToMoveClass') || {})) && (CARRIERS[id] || []).length);
  for (const ab of powderAb.concat([null])) {
    cell({ pop: 'F', sep: 'ragepowder-attacker-ability',
           why: `${drawMv} against an attacker carrying ${ab || 'nothing'} — the ability refuses the draw`,
           att: ATTACKER, move: atk, def: NEUTRAL, aimSlot: 2,
           attOpts: ab ? { ability: dex.abilities.get(ab).name } : undefined,
           defMove: dex.moves.get(drawMv).name, defMoveM: drawMv,
           compare: ['tookDamage', 'partnerTookDamage'] });
  }
}
/* G — THE TRAP FAMILY. The observable is whether the victim gets off the field, which is the whole
 * of the mechanic; a `trapped` volatile written and then ignored is not a trap. Turn 1 lays it,
 * turn 2 the victim asks to leave. */
function popG() {
  for (const mv of TRAP_MOVES) for (const t of TYPES) if (BODY[t])
    cell({ pop: 'G', why: 'a trap laid, then the victim asks to leave', att: ATTACKER, move: mv,
           def: BODY[t], trapClass: true, turns: 2, needsAlive: true,
           attExtra: [INERT_MOVE],
           /* TURN 2 THE TRAPPER DOES NOTHING. Re-clicking a DAMAGING trap move (Spirit Shackle) kills
            * the victim on turn 2, and a body that died did not "fail to leave" — three cells read as
            * engine defects on exactly that. */
           p1script: [p1Choice(mv), 'move 2, move 1'],
           p2script: ['move 1, move 1', 'switch 3, move 1'], mScript: [null, 'switch'],
           m2Pass: true,
           compare: ['stillActive', 'active0'] });
}
/* H — SANDSTORM CHIP. Ground, Rock and Steel take none. The attacker sets the weather with the
 * format's own weather move; nothing is prepped by hand. */
function popH() {
  const sand = WEATHER_MOVES.find(id => norm(dex.moves.get(id).weather) === 'sandstorm');
  if (!sand) return;
  for (const t of TYPES) if (BODY[t])
    cell({ pop: 'H', why: 'sandstorm chip', att: ATTACKER, move: sand, def: BODY[t],
           weatherClass: 'sandstorm', turns: 2, compare: ['tookDamage'] });
}
/* I — PRANKSTER INTO A DARK TYPE. The +1 does not apply and the move FAILS OUTRIGHT (gen 7+). */
function popI() {
  if (!legal(PRANKSTER)) return;
  for (const mv of STATUS_MOVES) for (const t of TYPES) if (BODY[t])
    cell({ pop: 'I', why: 'a Prankster status move into a type', att: ATTACKER, move: mv,
           def: BODY[t], attOpts: { ability: PRANKSTER.name } });
}
/* K — WILL'S BOARD, DERIVED. One body takes every move that delivers one status, and the anchors
 * above say which of them the authority MUST refuse and which it MUST land. The `sep` group is the
 * (status, body) pair, so the separation check enforces the thing that makes the board worth having:
 * the authority's answers across the arms must NOT all be the same. */
function popK() {
  for (const st of Object.keys(DELIVERERS)) {
    for (const t of TYPES) {
      if (!BODY[t]) continue;
      const anchor = ANCHORS.find(a => a.status === st && a.type === t);
      for (const mv of DELIVERERS[st]) {
        cell({ pop: 'K', sep: anchor ? ('anchor:' + st + '/' + t) : null,
               why: `${mv} delivering ${st} into a ${t} body`
                    + (anchor ? '  [ANCHOR: ' + (anchor.mustFail.includes(mv) ? 'must FAIL' : 'must LAND') + ']' : ''),
               att: ATTACKER, move: mv, def: BODY[t], compare: ['status'] });
      }
    }
  }
}
/* J — THE TYPE CHART ITSELF, one attacking move of each type into every type body. `tookDamage` is
 * the only leaf compared, because the two engines do not share a damage roll here and a magnitude
 * difference is a different instrument's question. */
function popJ() {
  for (const t of TYPES) {
    const mv = ATTACK_OF_TYPE[t];
    if (!mv) continue;
    for (const d of TYPES) if (BODY[d])
      cell({ pop: 'J', why: 'the attacking type chart', att: ATTACKER, move: mv, def: BODY[d],
             compare: ['tookDamage'] });
  }
}

/* ================= 9. RUN AND REPORT ========================================================== */
printDerivation();
if (has('--derive')) process.exit(0);

if (wants('A')) popA();
if (wants('B')) popB();
if (wants('C')) popC();
if (wants('D')) popD();
if (wants('E')) popE();
if (wants('F')) popF();
if (wants('G')) popG();
if (wants('H')) popH();
if (wants('I')) popI();
if (wants('J')) popJ();
if (wants('K')) popK();

function printDerivation() {
  console.log('DERIVED FROM THE FORMAT ON THIS RUN — nothing below is typed');
  console.log(`  format ${CS.FORMAT}`);
  console.log(`  ${TYPES.length} types; ${CLASSES.length} immunity classes off TypeInfo.damageTaken===3`);
  console.log(`    non-type classes (${NON_TYPE_CLASSES.length}): ${NON_TYPE_CLASSES.join(', ')}`);
  for (const c of NON_TYPE_CLASSES) console.log(`      ${c.padEnd(10)} ${IMMUNE_TYPES[c].join(', ') || '(nothing)'}`);
  console.log(`  ${STATUS_MOVES.length} targeted primary-status moves: ${STATUS_MOVES.join(', ')}`);
  console.log(`  ${POWDER_MOVES.length} powder moves (${POWDER_TARGETED.length} targeted, ${POWDER_SELF.length} self): ${POWDER_MOVES.join(', ')}`);
  console.log(`  ${TRAP_MOVES.length} trap moves, derived from the handler SOURCE: ${TRAP_MOVES.join(', ') || '(none)'}`);
  console.log(`  ${WEATHER_MOVES.length} weather moves: ${WEATHER_MOVES.join(', ')}`);
  console.log(`  ${TYPECHART_STATUS_MOVES.length} Status move(s) DECLARING ignoreImmunity:false — the type chart applies: ${TYPECHART_STATUS_MOVES.join(', ') || '(none)'}`);
  console.log(`  ${SECONDARY_STATUS.length} moves inflict a status as a SECONDARY — OUT OF SCOPE (they need the die this sweep removes)`);
  console.log('  STATUS DELIVERERS, split on whether the TYPE CHART judges the move:');
  for (const st of Object.keys(DELIVERERS)) {
    const judged = DELIVERERS[st].filter(chartJudges), free = DELIVERERS[st].filter(id => !chartJudges(id));
    console.log(`      ${st.padEnd(4)} chart-judged: ${judged.map(id => id + '(' + dex.moves.get(id).type + ')').join(', ') || '(none)'}`);
    console.log(`           chart-free  : ${free.map(id => id + '(' + dex.moves.get(id).type + ')').join(', ') || '(none)'}`);
  }
  console.log(`  ANCHOR BOARDS (a body where the two groups must answer differently): ${ANCHORS.length}`);
  for (const a of ANCHORS)
    console.log(`      ${a.status} into ${a.type} (${BODY[a.type]}) — must FAIL: ${a.mustFail.join(', ')}   must LAND: ${a.mustLand.join(', ')}`);
  console.log('');
  console.log(`  ${ABIL_CANDIDATES.length} legal abilities carry a status-family handler; ${ABIL_REACHABLE.length} have a legal carrier species`);
  console.log(`    UNREACHABLE in this regulation (no legal carrier): ${ABIL_UNREACHABLE.join(', ') || '(none)'}`);
  console.log(`    with an onSetStatus/onAllySetStatus (${SETSTATUS_ABIL.length}): ${SETSTATUS_ABIL.join(', ')}`);
  console.log(`    data/tags.json statusImmune (${TAG_STATUS_IMMUNE.length}): ${TAG_STATUS_IMMUNE.join(', ')}`);
  console.log(`    data/tags.json protectsAllyFromStatus (${TAG_ALLY_STATUS.length}): ${TAG_ALLY_STATUS.join(', ')}`);
  console.log(`    ARTIFACT GAP — onSetStatus with no statusImmune/protectsAllyFromStatus tag (${TAG_GAP.length}): ${TAG_GAP.map(id => id + (CARRIERS[id].length ? '' : ' [UNREACHABLE]')).join(', ') || '(none)'}`);
  console.log(`    bypass abilities (${BYPASS_ABIL.length}): ${BYPASS_ABIL.map(a => a + '->' + (tagParam(a, 'nameImplementedBySim').ignoresStatusImmunityFor || []).join('/')).join(', ')}`);
  console.log('');
  console.log(`  inert ability on every fixture: ${INERT_ABILITY}   neutral defender: ${NEUTRAL} (${NEUTRAL_TYPE})`);
  console.log(`  attacker: ${ATTACKER} (${ATT_TYPE})   poison-type attacker: ${POISON_ATTACKER}`);
  if (buildFailures.n)
    console.log(`  buildMon THREW on ${buildFailures.n} legal species while choosing bodies — first: ${buildFailures.first}`);
  console.log('  BODIES, one per type:');
  for (const t of TYPES) console.log(`      ${t.padEnd(9)} ${(BODY[t] || 'NONE').padEnd(16)} ${(BODY_WHY[t] || '').padEnd(22)} attack ${ATTACK_OF_TYPE[t] || '-'}`);
  console.log('');
}

const byPop = {};
for (const r of rows) {
  const p = r.pop || '?';
  byPop[p] = byPop[p] || { n: 0, differ: 0, threw: 0, r0: 0, r1: 0, r2: 0, differR: {} };
  const b = byPop[p];
  b.n++;
  if (String(r.verdict).startsWith('THREW')) { b.threw++; continue; }
  if (String(r.verdict).startsWith('NOT-STAGED')) { b.notStaged = (b.notStaged || 0) + 1; continue; }
  const k = (r.reasons || []).length;
  if (k === 0) b.r0++; else if (k === 1) b.r1++; else b.r2++;
  if (r.verdict === 'DIFFER') { b.differ++; b.differR[k] = (b.differR[k] || 0) + 1; }
}
console.log('SWEEP RESULT — Showdown is the expectation; nothing here is typed');
for (const p of Object.keys(byPop).sort()) {
  const b = byPop[p];
  console.log(`  population ${p}: ${b.n} cells, ${b.differ} DIFFER, ${b.threw} THREW, ${b.notStaged || 0} NOT-STAGED`);
  console.log(`      reasons 0 / 1 / 2+ : ${b.r0} / ${b.r1} / ${b.r2}   (only a reasons-1 cell may carry a census probe)`);
  if (b.differ) console.log(`      diverging cells by reason count: ${JSON.stringify(b.differR)}`);
}
/* THE SEPARATION CHECK. Lesson 5: identical results across a varied knob mean the knob is unwired.
 * Every arm that declares a `sep` group is staged AGAINST a control that differs in exactly one
 * thing, and the AUTHORITY must answer them differently. If it does not, the fixture is broken and
 * an AGREE in that group is worth nothing — so it is printed as a failure of this file, never as a
 * clean engine. */
const sepGroups = {};
for (const r of rows) if (r.sep) (sepGroups[r.sep] = sepGroups[r.sep] || []).push(r);
const sepBroken = [];
if (Object.keys(sepGroups).length) {
  console.log('');
  console.log('SEPARATION — the authority must answer each control group differently');
  for (const g of Object.keys(sepGroups).sort()) {
    const arms = sepGroups[g];
    const distinct = new Set(arms.map(r => r.authority));
    const ok = distinct.size > 1;
    if (!ok) sepBroken.push(g);
    console.log(`  ${ok ? 'SEPARATED' : 'NOT SEPARATED — THE FIXTURE IS BROKEN'}  ${g}`);
    for (const r of arms) console.log(`      ${r.why}
          authority ${r.authority}
          medicham  ${r.medicham}`);
  }
}
const bad = rows.filter(r => r.verdict !== 'AGREE');
console.log('');
console.log(`TOTAL ${counters.staged} cells staged in both engines — ${bad.length} not AGREE`);
if (bad.length) {
  console.log('');
  const groups = {};
  for (const r of bad) {
    const key = r.verdict === 'DIFFER'
      ? `${r.pop} ${r.move} :: ${r.leaves.join(' | ')} :: reasons[${(r.reasons || []).join(',')}]`
      : `${r.pop} ${r.move} :: ${r.verdict} :: ${r.err}`;
    (groups[key] = groups[key] || []).push(r.def + (r.defAb && r.defAb !== INERT_ABILITY_ID ? '/' + r.defAb : '')
      + (r.attAb && r.attAb !== INERT_ABILITY_ID ? ' (att ' + r.attAb + ')' : ''));
  }
  for (const k of Object.keys(groups).sort()) {
    console.log(`  ${k}`);
    console.log(`      ${groups[k].length}x  ${groups[k].slice(0, 14).join(', ')}${groups[k].length > 14 ? ' …' : ''}`);
  }
}
if (has('--json')) {
  const out = D('data', 'immunity-sweep.json');
  fs.writeFileSync(out, JSON.stringify({
    generated: new Date().toISOString(), format: CS.FORMAT, classes: CLASSES, immuneTypes: IMMUNE_TYPES,
    statusMoves: STATUS_MOVES, powderMoves: POWDER_MOVES, trapMoves: TRAP_MOVES,
    typechartStatusMoves: TYPECHART_STATUS_MOVES, abilCandidates: ABIL_CANDIDATES.map(a => a.id),
    abilReachable: ABIL_REACHABLE, abilUnreachable: ABIL_UNREACHABLE, tagGap: TAG_GAP,
    bypassAbilities: BYPASS_ABIL, bodies: BODY, bodyWhy: BODY_WHY, counters, byPop, rows,
  }, null, 1));
  console.log('wrote ' + out);
}
if (sepBroken.length) console.log(`
INSTRUMENT WARNING — ${sepBroken.length} control group(s) did not separate: ${sepBroken.join(', ')}`);
process.exitCode = 0;
