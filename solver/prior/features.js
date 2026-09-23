/* solver/prior/features.js — THE ONE feature function of the human policy prior (v0).
 *
 * One definition, two consumers: the Python trainer reads the tensors this file emits
 * (build_features.js), and the Node inference (infer.js) calls this same function live.
 * No game fact is typed here: move category / power / priority / target type, species types
 * and base stats, type effectiveness and mega stones are all read from Dex.forFormat via
 * solver/human/dex.js.
 *
 * decide(game, turnIndex, side, freq) -> a DECISION:
 *   { side, turn, slots:[SLOT|null, SLOT|null] }
 *   SLOT = { pos, mon, species, ctx:Float64Array(CTX_F), cands:[CAND], label:{status, set:[candIdx]} }
 *   CAND = { key, f:Float64Array(CAND_F), move:<vocab token>, attr:{tc, stall, sw, to, mv, spread, mega} }
 * label.status: 'exact' | 'uncertain_target' | 'hidden' | 'locked' | 'outside' | 'none'
 *   exact            the chosen slot action is one candidate                    -> scored
 *   uncertain_target the log shows the target HIT, maybe not the one CHOSEN      -> set = all targets
 *   hidden           the choice is not in the log (flinch, fainted first...)    -> set = all cands
 *   locked           not a choice (lockedmove / recharge)                        -> one forced cand
 *   outside          the logged action is not in the enumerated set (Transform, Struggle...)
 */
'use strict';
const X = require('../human/dex.js');
const D = X.D;
const toID = X.toID;

const WEATHERS = ['RainDance', 'Sandstorm', 'SunnyDay', 'Snowscape'];
const TERRAINS = ['Psychic Terrain', 'Grassy Terrain', 'Electric Terrain', 'Misty Terrain'];
const STATUSES = ['par', 'slp', 'brn', 'psn', 'tox', 'frz'];
const SCREENS = ['Reflect', 'Light Screen', 'Aurora Veil'];
const BOOSTS = ['atk', 'def', 'spa', 'spd', 'spe'];
const TC = { foeA: 0, foeB: 1, ally: 2, self: 3, none: 4 };
const TC_NAMES = ['foeA', 'foeB', 'ally', 'self', 'none'];
const CHOOSABLE = new Set(['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe']);
const SPREAD = new Set(['allAdjacentFoes', 'allAdjacent']);

/* ---------- cached dex reads ---------- */
const _mv = new Map(), _sp = new Map(), _it = new Map();
function mv(name) {
  const id = toID(name);
  if (!_mv.has(id)) {
    const m = D.moves.get(id);
    _mv.set(id, m.exists ? {
      id: m.id, name: m.name, type: m.type, cat: m.category, bp: m.basePower || 0,
      pri: m.priority || 0, acc: m.accuracy === true ? 1 : (m.accuracy || 100) / 100,
      target: m.target, stall: !!m.stallingMove, spread: SPREAD.has(m.target),
    } : null);
  }
  return _mv.get(id);
}
function sp(name) {
  const id = toID(name);
  if (!_sp.has(id)) {
    const s = D.species.get(id);
    _sp.set(id, s.exists ? { types: s.types.slice(), spe: s.baseStats.spe, base: s.baseSpecies } : { types: [], spe: 80, base: name });
  }
  return _sp.get(id);
}
function it(name) {
  const id = toID(name);
  if (!_it.has(id)) {
    const i = D.items.get(id);
    _it.set(id, i.exists ? { choice: !!i.isChoice, mega: i.megaStone ? Object.keys(i.megaStone) : null } : { choice: false, mega: null });
  }
  return _it.get(id);
}
/* log2 multiplier of attacking type into defending types; immunity -> -3 (a floor, not a value) */
function eff(atkType, defTypes) {
  if (!atkType || !defTypes || !defTypes.length) return 0;
  if (!D.getImmunity(atkType, defTypes)) return -3;
  return D.getEffectiveness(atkType, defTypes);
}
function monTypes(m) {
  if (m && m.vol && m.vol.typechange && typeof m.vol.typechange === 'string') return m.vol.typechange.split('/');
  return sp(m.species).types;
}
/* worst (highest) STAB-type effectiveness a set of attacker mons threatens into defTypes */
function threat(attackers, defTypes) {
  let w = -3, any = false;
  for (const a of attackers) { if (!a) continue; for (const t of monTypes(a)) { any = true; w = Math.max(w, eff(t, defTypes)); } }
  return any ? w : 0;
}

/* ---------- small state helpers ---------- */
const other = s => (s === 'p1' ? 'p2' : 'p1');
function activeMon(sideState, k) {
  const idx = sideState.active[k];
  if (idx == null) return null;
  const m = sideState.mons[idx];
  return m && m.seen && !m.fnt ? m : null;
}
function megaAvailable(sideState, m) {
  if (!m || sideState.mega_used || m.mega || !m.item) return false;
  const i = it(m.item);
  if (!i.mega) return false;
  const base = sp(m.species).base;
  return i.mega.includes(m.species) || i.mega.includes(base);
}
/* turns this mon has been continuously in this slot before turn t (0 = just came in) + its last move */
function history(game, t, side, pos, monIdx) {
  let active = 0, last = null;
  for (let k = t - 1; k >= 0; k--) {
    const st = game.turns[k].state.sides[side];
    const kk = pos === 'a' ? 0 : 1;
    if (st.active[kk] !== monIdx) break;
    active++;
    const a = game.turns[k].actions[side][pos];
    if (last === null) last = a && a.kind === 'move' && a.mon === monIdx ? toID(a.move) : '';
  }
  return { active, last: last || '' };
}

/* ---------- feature layout (names are exported so the model JSON carries them) ---------- */
const CTX_NAMES = [
  'pos_b', 'turn', 'my_hp', ...STATUSES.map(s => 'my_' + s), ...BOOSTS.map(b => 'my_' + b),
  'my_active', 'my_fresh', 'my_mega_avail', 'my_is_mega', 'my_choice', 'my_taunt', 'my_encore',
  'my_sub', 'my_confused', 'my_perish', 'my_spe', 'my_threat',
  'ally_present', 'ally_hp', 'foeA_present', 'foeA_hp', 'foeB_present', 'foeB_hp', 'foe_max_spe',
  ...WEATHERS.map(w => 'w_' + w), ...TERRAINS.map(w => 't_' + w), 'trick_room', 'my_tailwind',
  'their_tailwind', 'my_screens', 'their_screens', 'my_left', 'their_left', 'bench_n',
];
const CAND_NAMES = [
  'is_move', 'is_switch', 'mega', ...TC_NAMES.map(t => 'tc_' + t), 'phys', 'spec', 'status',
  'bp', 'pri', 'acc', 'spread', 'stall', 'stab', 'eff', 'immune', 'tgt_hp', 'tgt_boost',
  'repeat', 'stall_repeat', 'freq_act', 'freq_tc', 'freq_mega',
  'sw_hp', 'sw_spe', 'sw_threat_gain', 'sw_mega',
];
const CTX_F = CTX_NAMES.length, CAND_F = CAND_NAMES.length;
const CI = Object.fromEntries(CAND_NAMES.map((n, i) => [n, i]));
const XI = Object.fromEntries(CTX_NAMES.map((n, i) => [n, i]));

/* ---------- the frequency tables (the "MOVE PRIORS" idea, fitted on TRAIN actors only) ----------
 * freq = { act: {species: {actkey: n}}, tc: {species|move: {tc: n}}, mega: {species|move: [n0,n1]} }
 * Laplace-smoothed log probabilities. A missing table gives the uniform value.            */
function logp(table, key, sub, nopts) {
  const row = table && table[key];
  let tot = 0, c = 0;
  if (row) { for (const k in row) tot += row[k]; c = row[sub] || 0; }
  return Math.log((c + 1) / (tot + Math.max(1, nopts)));
}
function freqFeatures(freq, species, key, tc, mega, nActs) {
  if (!freq) return [0, 0, 0];
  const a = logp(freq.act, species, key, nActs);
  const t = key === 'SWITCH' ? 0 : logp(freq.tc, species + '|' + key, String(tc), 5);
  let m = 0;
  if (key !== 'SWITCH') {
    const r = freq.mega[species + '|' + key];
    const n0 = r ? r[0] : 0, n1 = r ? r[1] : 0;
    m = Math.log(((mega ? n1 : n0) + 1) / (n0 + n1 + 2));
  }
  return [a, t, m];
}

/* ---------- a slot's candidates and label ---------- */
function slotFor(game, t, side, pos, freq) {
  const turn = game.turns[t];
  const S = turn.state.sides[side], O = turn.state.sides[other(side)];
  const k = pos === 'a' ? 0 : 1;
  const me = activeMon(S, k);
  if (!me) return null;
  const sheet = game.game.sheets[side][me.i];
  const ally = activeMon(S, 1 - k);
  const foes = [activeMon(O, 0), activeMon(O, 1)];
  const h = history(game, t, side, pos, me.i);
  const megaOK = megaAvailable(S, me);
  const myTypes = monTypes(me);

  /* context */
  const c = new Float64Array(CTX_F);
  const st = turn.state;
  c[XI.pos_b] = pos === 'b' ? 1 : 0;
  c[XI.turn] = Math.min(turn.n, 20) / 10;
  c[XI.my_hp] = me.hp / (me.max || 100);
  if (me.status && STATUSES.includes(me.status)) c[XI['my_' + me.status]] = 1;
  for (const b of BOOSTS) c[XI['my_' + b]] = (me.boosts[b] || 0) / 6;
  c[XI.my_active] = Math.min(h.active, 5) / 5;
  c[XI.my_fresh] = h.active === 0 ? 1 : 0;
  c[XI.my_mega_avail] = megaOK ? 1 : 0;
  c[XI.my_is_mega] = me.mega ? 1 : 0;
  c[XI.my_choice] = me.item && it(me.item).choice ? 1 : 0;
  c[XI.my_taunt] = me.vol.Taunt != null ? 1 : 0;
  c[XI.my_encore] = me.vol.Encore != null ? 1 : 0;
  c[XI.my_sub] = me.vol.Substitute != null ? 1 : 0;
  c[XI.my_confused] = me.vol.confusion != null ? 1 : 0;
  c[XI.my_perish] = me.vol.perish != null ? 1 : 0;
  c[XI.my_spe] = sp(me.species).spe / 100;
  c[XI.my_threat] = threat(foes, myTypes) / 2;
  c[XI.ally_present] = ally ? 1 : 0;
  c[XI.ally_hp] = ally ? ally.hp / (ally.max || 100) : 0;
  c[XI.foeA_present] = foes[0] ? 1 : 0;
  c[XI.foeA_hp] = foes[0] ? foes[0].hp / (foes[0].max || 100) : 0;
  c[XI.foeB_present] = foes[1] ? 1 : 0;
  c[XI.foeB_hp] = foes[1] ? foes[1].hp / (foes[1].max || 100) : 0;
  c[XI.foe_max_spe] = Math.max(0, ...foes.filter(Boolean).map(f => sp(f.species).spe)) / 100;
  if (st.weather && WEATHERS.includes(st.weather.name)) c[XI['w_' + st.weather.name]] = 1;
  if (st.terrain && TERRAINS.includes(st.terrain.name)) c[XI['t_' + st.terrain.name]] = 1;
  c[XI.trick_room] = st.pseudo['Trick Room'] != null ? 1 : 0;
  c[XI.my_tailwind] = S.conditions.Tailwind ? 1 : 0;
  c[XI.their_tailwind] = O.conditions.Tailwind ? 1 : 0;
  c[XI.my_screens] = SCREENS.filter(x => S.conditions[x]).length / 2;
  c[XI.their_screens] = SCREENS.filter(x => O.conditions[x]).length / 2;
  const brought = game.game.brought_seen[side];
  const ts = game.game.teamsize;                     // { p1: n, p2: n } — how many each side brought
  c[XI.my_left] = (ts[side] - S.mons.filter(m => m.seen && m.fnt).length) / 4;
  c[XI.their_left] = (ts[other(side)] - O.mons.filter(m => m.seen && m.fnt).length) / 4;

  /* candidates */
  const cands = [];
  const nActs = sheet.moves.length + 1;
  const tgtOf = tc => (tc === TC.foeA ? foes[0] : tc === TC.foeB ? foes[1] : tc === TC.ally ? ally : tc === TC.self ? me : null);
  for (const name of sheet.moves) {
    const m = mv(name);
    if (!m) continue;
    let tcs;
    if (CHOOSABLE.has(m.target)) {
      tcs = [];
      if (m.target === 'normal' || m.target === 'any' || m.target === 'adjacentFoe') {
        if (foes[0]) tcs.push(TC.foeA);
        if (foes[1]) tcs.push(TC.foeB);
      }
      if ((m.target === 'normal' || m.target === 'any' || m.target === 'adjacentAlly' || m.target === 'adjacentAllyOrSelf') && ally) tcs.push(TC.ally);
      if (m.target === 'adjacentAllyOrSelf') tcs.push(TC.self);
      if (!tcs.length) tcs = [TC.none];
    } else tcs = [TC.none];
    for (const tc of tcs) for (const mega of (megaOK ? [0, 1] : [0])) {
      const f = new Float64Array(CAND_F);
      f[CI.is_move] = 1; f[CI.mega] = mega; f[CI['tc_' + TC_NAMES[tc]]] = 1;
      f[CI.phys] = m.cat === 'Physical' ? 1 : 0; f[CI.spec] = m.cat === 'Special' ? 1 : 0; f[CI.status] = m.cat === 'Status' ? 1 : 0;
      f[CI.bp] = Math.min(m.bp, 250) / 100; f[CI.pri] = m.pri / 3; f[CI.acc] = m.acc;
      f[CI.spread] = m.spread ? 1 : 0; f[CI.stall] = m.stall ? 1 : 0;
      f[CI.stab] = m.cat !== 'Status' && myTypes.includes(m.type) ? 1 : 0;
      if (m.cat !== 'Status') {
        let e = null;
        if (tc === TC.foeA || tc === TC.foeB) e = eff(m.type, monTypes(tgtOf(tc)));
        else if (m.spread) { const es = foes.filter(Boolean).map(x => eff(m.type, monTypes(x))); if (es.length) e = Math.max(...es); }
        if (e != null) { f[CI.eff] = Math.max(e, -2) / 2; f[CI.immune] = e <= -3 ? 1 : 0; }
      }
      const tg = tgtOf(tc);
      if (tg) { f[CI.tgt_hp] = tg.hp / (tg.max || 100); f[CI.tgt_boost] = BOOSTS.reduce((s, b) => s + (tg.boosts[b] || 0), 0) / 6; }
      f[CI.repeat] = h.last === m.id ? 1 : 0;
      f[CI.stall_repeat] = m.stall && h.last && mv(h.last) && mv(h.last).stall ? 1 : 0;
      const fr = freqFeatures(freq, sheet.species_id, m.id, tc, mega, nActs);
      f[CI.freq_act] = fr[0]; f[CI.freq_tc] = fr[1]; f[CI.freq_mega] = fr[2];
      cands.push({ key: m.id + '|' + tc + '|' + mega, f, move: m.id, attr: { tc, stall: m.stall ? 1 : 0, sw: 0, to: -1, mv: m.id, spread: m.spread ? 1 : 0, mega } });
    }
  }
  const bench = brought.filter(j => j !== S.active[0] && j !== S.active[1] && !(S.mons[j].seen && S.mons[j].fnt));
  c[XI.bench_n] = bench.length / 2;
  const curThreat = threat(foes, myTypes);
  for (const j of bench) {
    const bm = S.mons[j];
    const bs = game.game.sheets[side][j];
    const bspecies = bm.seen ? bm.species : bs.species;
    const btypes = bm.seen ? monTypes(bm) : sp(bs.species).types;
    const f = new Float64Array(CAND_F);
    f[CI.is_switch] = 1; f[CI.tc_none] = 1;
    f[CI.sw_hp] = bm.seen ? bm.hp / (bm.max || 100) : 1;
    f[CI.sw_spe] = sp(bspecies).spe / 100;
    f[CI.sw_threat_gain] = (curThreat - threat(foes, btypes)) / 2;
    f[CI.sw_mega] = bs.item && it(bs.item).mega && !S.mega_used ? 1 : 0;
    const fr = freqFeatures(freq, sheet.species_id, 'SWITCH', 0, 0, nActs);
    f[CI.freq_act] = fr[0];
    cands.push({ key: 'SWITCH|' + j, f, move: 'SWITCH', attr: { tc: TC.none, stall: 0, sw: 1, to: j, mv: 'SWITCH', spread: 0, mega: 0 } });
  }

  /* label */
  const a = turn.actions[side][pos];
  const label = { status: 'none', set: [] };
  const all = cands.map((_, i) => i);
  if (!a) { label.status = 'none'; }
  else if (a.kind === 'hidden') {
    label.status = 'hidden';
    label.set = megaOK && a.mega ? all.filter(i => cands[i].attr.mega === 1) : all;
    label.reason = a.reason;
  } else if (a.kind === 'locked') {
    label.status = 'locked';
    /* not a choice: the slot is collapsed to one forced candidate so the joint is the partner's */
    const id = a.move ? toID(a.move) : null;
    const f = new Float64Array(CAND_F); f[CI.is_move] = 1; f[CI.tc_none] = 1;
    cands.length = 0;
    cands.push({ key: 'LOCKED', f, move: id && mv(id) ? mv(id).id : 'LOCKED', attr: { tc: TC.none, stall: 0, sw: 0, to: -1, mv: 'LOCKED', spread: 0, mega: a.mega ? 1 : 0 } });
    label.set = [0];
  } else if (a.kind === 'switch') {
    const i = cands.findIndex(x => x.attr.sw && x.attr.to === a.to);
    if (i >= 0) { label.status = 'exact'; label.set = [i]; } else { label.status = 'outside'; label.detail = 'switch_not_enumerated'; }
  } else if (a.kind === 'move') {
    const id = toID(a.move);
    const mega = a.mega && megaOK ? 1 : 0;
    const same = all.filter(i => cands[i].attr.mv === id && cands[i].attr.mega === mega);
    if (!same.length) { label.status = 'outside'; label.detail = 'move_not_enumerated:' + id; }
    else {
      const m = mv(id);
      let tc = TC.none;
      if (m && CHOOSABLE.has(m.target) && a.target_loc != null) {
        const tl = a.target_loc;
        if (tl === 1) tc = TC.foeA; else if (tl === 2) tc = TC.foeB;
        else { const ownPos = tl === -1 ? 'a' : 'b'; tc = ownPos === pos ? TC.self : TC.ally; }
      }
      const hit = same.filter(i => cands[i].attr.tc === tc);
      const certain = a.target_certain !== false;
      if (same.length === 1 && (hit.length === 1 || !m || !CHOOSABLE.has(m.target))) { label.status = 'exact'; label.set = same; }
      else if (certain && hit.length === 1) { label.status = 'exact'; label.set = hit; }
      else { label.status = 'uncertain_target'; label.set = same; }
    }
  }
  return { pos, mon: me.i, species: sheet.species_id, ctx: c, cands, label };
}

/* the pair term's inputs, computed from candidate attrs (mirrored exactly in train.py; the
 * agreement test checks both implementations on real decisions) */
const PAIR_NAMES = ['same_foe', 'both_stall', 'both_switch', 'same_move', 'ally_target', 'both_spread'];
function pairFeat(p, q) {
  const foe = t => t === TC.foeA || t === TC.foeB;
  return [
    !p.sw && !q.sw && foe(p.tc) && p.tc === q.tc ? 1 : 0,
    p.stall && q.stall ? 1 : 0,
    p.sw && q.sw ? 1 : 0,
    !p.sw && !q.sw && p.mv === q.mv && p.mv !== 'LOCKED' ? 1 : 0,
    p.tc === TC.ally || q.tc === TC.ally ? 1 : 0,
    p.spread && q.spread ? 1 : 0,
  ];
}
function pairValid(p, q) {
  if (p.sw && q.sw && p.to === q.to) return false;
  if (p.mega && q.mega) return false;
  return true;
}

function decide(game, t, side, freq) {
  return { side, turn: t, slots: [slotFor(game, t, side, 'a', freq), slotFor(game, t, side, 'b', freq)] };
}

/* joint status: 'exact' iff every occupied slot is exact or locked with at least one choice slot */
function jointStatus(d) {
  const ss = d.slots.filter(Boolean);
  if (!ss.length) return 'none';
  if (ss.some(s => s.label.status === 'none')) return 'none';
  if (ss.every(s => s.label.status === 'locked')) return 'all_locked';
  for (const k of ['outside', 'hidden', 'uncertain_target']) if (ss.some(s => s.label.status === k)) return k;
  return 'exact';
}

module.exports = {
  decide, slotFor, pairFeat, pairValid, jointStatus, CTX_NAMES, CAND_NAMES, PAIR_NAMES, CTX_F, CAND_F, TC,
  FEATURE_VERSION: 'v0.1',
};
