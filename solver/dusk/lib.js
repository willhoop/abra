/* solver/dusk/lib.js — the shared half of DUSK's measurements: the endgame predicate, the abstraction keys, the
 * sheet-bound action count, and the summary. Pure functions over solver/porygon2/v2/reveal.js positions. No simulator.
 *
 * Every Pokemon fact is read from the Reg M-C format through solver/human/dex.js (a move's target type, whether an item
 * is a mega stone, a field condition's duration). Nothing is typed.
 */
'use strict';
const X = require('../human/dex.js');
const UNK = '<UNK>';
const SIDES = ['p1', 'p2'];
/* DELIBERATE BREAKS (env DUSK_BREAK), each must turn solver/tests/test-dusk-measure.js RED:
 *   alive   a fainted member still counts alive (the endgame predicate never fires)
 *   colour  the keys keep the chairs in order (p1's side first), so one matchup gets two keys */
const BREAK = (typeof process !== 'undefined' && process.env && process.env.DUSK_BREAK) || '';

const DEFINITIONS = {
  alive: 'teamsize minus fainted members at the start of a turn (after replacements); a brought member never seen counts alive',
  E2: 'both sides have <= 2 alive: every live member is on the field, so no bench and no switch (PRIMARY)',
  E4: '<= 4 alive in total (adds 3v1 to E2)',
  E1: '1v1',
  entry: 'the FIRST start-of-turn position meeting the definition',
  ahead: 'more alive; where noted, ties broken by the summed displayed HP % of alive members',
  keys: {
    K0: 'species matchup (current forme)', K0set: 'K0 + item now, ability now, known moves per member',
    K1q: 'K0 + HP quarter per member', K1d: 'K0 + HP tenth per member',
    K2: 'K1d + status + nonzero stages + volatiles', K3: 'K2 + weather, terrain, Trick Room, each side Tailwind/screens',
    K3set: 'K0set + exact displayed HP % + status + stages + volatiles + field (no timers)',
  },
  actions: 'sheet upper bound per side: per active, sum over its known moves of the target choices (normal/any: live foes + live ally; adjacentFoe: live foes; adjacentAlly: 1; adjacentAllyOrSelf: 1 + ally; else 1), x2 where it can still mega; the joint is the product, less both-mega pairs. No switches exist in E2. Choice lock, Encore, Taunt, Disable, PP and Protect repeats are NOT applied (engine legalActions is the authority).',
};

const BANDS = [[0, '<1100'], [1100, '1100-1199'], [1200, '1200-1299'], [1300, '1300-1399'], [1400, '1400-1499'], [1500, '>=1500']];
function band(r) { if (r == null || !isFinite(r)) return 'unrated'; let b = BANDS[0][1]; for (const [lo, n] of BANDS) if (r >= lo) b = n; return b; }

const aliveOf = sd => { const ts = sd.teamsize || 4; return ts - (BREAK === 'alive' ? 0 : sd.mons.filter(m => m.fnt).length); };
const liveMons = sd => sd.mons.filter(m => m.brought === true && !m.fnt);
const hpSum = sd => { const ts = sd.teamsize || 4; const seen = sd.mons.filter(m => m.brought === true); const unseen = Math.max(0, ts - seen.length);
  return seen.reduce((a, m) => a + (m.fnt ? 0 : (typeof m.hp === 'number' ? m.hp : 100)), 0) + 100 * unseen; };

/* ---------------------------------------------------------------- keys */
const boostStr = b => Object.keys(b || {}).filter(k => b[k]).sort().map(k => k + (b[k] > 0 ? '+' : '') + b[k]).join('');
const volStr = v => Object.keys(v || {}).sort().map(k => k === 'perish' ? 'perish' + v[k] : k).join('+');
const setStr = m => [m.item && m.item.now === UNK ? '?' : (m.item && m.item.now) || '-', m.ability && m.ability.now === UNK ? '?' : (m.ability && m.ability.now) || '-',
  (m.moves || []).filter(x => x !== UNK).slice().sort().join('/')].join(';');
function fieldStr(x) {
  const f = x.field, parts = [];
  if (f.weather) parts.push('W:' + f.weather.name);
  if (f.terrain) parts.push('T:' + f.terrain.name);
  for (const k of Object.keys(f.pseudo || {}).sort()) parts.push('P:' + k);
  return parts;
}
const SIDE_COND = c => Object.keys(c || {}).sort().map(k => k + (c[k].layers > 1 ? 'x' + c[k].layers : '')).join('+');
function keysOf(x) {
  const tok = (m, lvl) => {
    const sp = m.form || m.species;
    const hp = typeof m.hp === 'number' ? m.hp : 100;
    switch (lvl) {
      case 'K0': return sp;
      case 'K0set': return sp + '[' + setStr(m) + ']';
      case 'K1q': return sp + '@' + Math.min(3, Math.floor(hp / 25.0001));
      case 'K1d': return sp + '@' + Math.min(9, Math.floor(hp / 10.0001));
      case 'K2': case 'K3': return sp + '@' + Math.min(9, Math.floor(hp / 10.0001)) + ':' + (m.status || '') + ':' + boostStr(m.boosts) + ':' + volStr(m.vol);
      case 'K3set': return sp + '[' + setStr(m) + ']@' + hp + ':' + (m.status || '') + ':' + boostStr(m.boosts) + ':' + volStr(m.vol);
    }
  };
  const out = {};
  for (const lvl of ['K0', 'K0set', 'K1q', 'K1d', 'K2', 'K3', 'K3set']) {
    const sideKey = s => liveMons(x.sides[s]).map(m => tok(m, lvl)).sort().join(',') + ((lvl === 'K3' || lvl === 'K3set') ? '|' + SIDE_COND(x.sides[s].conditions) : '');
    const a = sideKey('p1'), b = sideKey('p2');
    let k = (a < b || BREAK === 'colour') ? a + ' vs ' + b : b + ' vs ' + a;
    if (lvl === 'K3' || lvl === 'K3set') k += ' || ' + fieldStr(x).join(',');
    out[lvl] = k;
  }
  return out;
}

/* ---------------------------------------------------------------- the sheet-bound action count */
const _mega = new Map();
function isMegaStone(item) { if (!item || item === UNK) return false; if (_mega.has(item)) return _mega.get(item); const it = X.item(item); const v = !!(it && it.exists && it.megaStone); _mega.set(item, v); return v; }
function slotOptions(m, ally, foes, side) {
  const mv = (m.moves || []).filter(x => x !== UNK);
  if (!mv.length) return null;
  let n = 0;
  for (const name of mv) {
    const t = X.moveTargetType(name);
    if (t === 'normal' || t === 'any') n += Math.max(1, foes + (ally ? 1 : 0));
    else if (t === 'adjacentFoe') n += Math.max(1, foes);
    else if (t === 'adjacentAllyOrSelf') n += 1 + (ally ? 1 : 0);
    else n += 1;
  }
  const canMega = !side.mega_used && !m.mega && isMegaStone(m.item && m.item.now);
  return { base: n, mega: canMega };
}
function actionCount(x, s) {
  const o = s === 'p1' ? 'p2' : 'p1';
  const me = liveMons(x.sides[s]).filter(m => m.pos), foes = liveMons(x.sides[o]).filter(m => m.pos).length;
  const opts = me.map(m => slotOptions(m, me.length > 1, foes, x.sides[s]));
  if (!opts.length || opts.some(v => v == null)) return null;
  if (opts.length === 1) return opts[0].base * (opts[0].mega ? 2 : 1);
  const [a, b] = opts;
  return a.base * (a.mega ? 2 : 1) * b.base * (b.mega ? 2 : 1) - (a.mega && b.mega ? a.base * b.base : 0);
}

/* ---------------------------------------------------------------- one game -> one row */
const DUR = (() => {
  const d = {};
  for (const [name, id] of [['Trick Room', 'trickroom'], ['Tailwind', 'tailwind'], ['Reflect', 'reflect'], ['Light Screen', 'lightscreen'], ['Aurora Veil', 'auroraveil']]) {
    const mv = X.move(id); d[name] = mv && mv.exists && mv.condition && mv.condition.duration || null;
  }
  return d;
})();
function entryFacts(x, k, lab, turns) {
  const alive = { p1: aliveOf(x.sides.p1), p2: aliveOf(x.sides.p2) }, hp = { p1: hpSum(x.sides.p1), p2: hpSum(x.sides.p2) };
  const mons = {};
  for (const s of SIDES) mons[s] = liveMons(x.sides[s]).map(m => ({ sp: m.form || m.species, hp: typeof m.hp === 'number' ? m.hp : 100, status: m.status || null,
    boosts: boostStr(m.boosts), vol: Object.keys(m.vol || {}), mega: !!m.mega, item: m.item ? m.item.now : null, ability: m.ability ? m.ability.now : null, on_field: !!m.pos }));
  const f = x.field;
  const field = {
    weather: f.weather ? f.weather.name : null, terrain: f.terrain ? f.terrain.name : null,
    trick_room: 'Trick Room' in (f.pseudo || {}) ? { age: x.n - f.pseudo['Trick Room'] } : null,
    pseudo: Object.keys(f.pseudo || {}),
    sides: { p1: Object.keys(x.sides.p1.conditions || {}), p2: Object.keys(x.sides.p2.conditions || {}) },
    tailwind: { p1: x.sides.p1.conditions && x.sides.p1.conditions.Tailwind ? { age: x.n - x.sides.p1.conditions.Tailwind.since } : null,
                p2: x.sides.p2.conditions && x.sides.p2.conditions.Tailwind ? { age: x.n - x.sides.p2.conditions.Tailwind.since } : null },
  };
  return { k, n: x.n, alive, hp, decisions_left: turns - x.n + 1, mons, field, mega_left: { p1: !x.sides.p1.mega_used, p2: !x.sides.p2.mega_used },
    keys: keysOf(x), actions: { p1: actionCount(x, 'p1'), p2: actionCount(x, 'p2') } };
}
function gameRow(g, lab, meta) {
  const P = g.positions;
  let e2 = null, e4 = null, e1 = null;
  for (let k = 0; k < P.length; k++) {
    const x = P[k].x, a = aliveOf(x.sides.p1), b = aliveOf(x.sides.p2);
    if (a <= 0 || b <= 0) continue;
    if (!e4 && a + b <= 4) e4 = entryFacts(x, k, lab, lab.turns);
    if (!e2 && a <= 2 && b <= 2) e2 = entryFacts(x, k, lab, lab.turns);
    if (!e1 && a <= 1 && b <= 1) { e1 = { k, n: x.n, decisions_left: lab.turns - x.n + 1 }; break; }
  }
  const rp = meta.rating || {};
  const lo = rp.p1 != null && rp.p2 != null ? Math.min(rp.p1, rp.p2) : null;
  const players = [g.game.players.p1 && g.game.players.p1.name, g.game.players.p2 && g.game.players.p2.name];
  return { id: meta.id, fmt: meta.fmt, uploadtime: meta.uploadtime, rating: rp, band: band(lo), players, z: lab.z, end: lab.end, turns: lab.turns, e2, e4, e1 };
}

/* ---------------------------------------------------------------- statistics */
function wilson(k, n, z = 1.96) {
  if (!n) return null;
  const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return { k, n, p: +p.toFixed(4), lo: +(c - h).toFixed(4), hi: +(c + h).toFixed(4) };
}
function quant(a, qs) { const s = a.filter(v => v != null && isFinite(v)).sort((x, y) => x - y); if (!s.length) return null; const o = { n: s.length, mean: +(s.reduce((p, v) => p + v, 0) / s.length).toFixed(3) }; for (const q of qs) o['p' + Math.round(q * 100)] = s[Math.min(s.length - 1, Math.floor(q * s.length))]; o.max = s[s.length - 1]; return o; }
const Q5 = [0.1, 0.25, 0.5, 0.75, 0.9, 0.99];
function hist(a) { const o = {}; for (const v of a) o[v] = (o[v] || 0) + 1; return o; }
function topN(counter, n) { return Object.entries(counter).sort((a, b) => b[1] - a[1]).slice(0, n); }
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

/* did the side ahead (more alive; on a tie, more HP if `hpTie`) win? z is p1's result. Returns 1/0, or null on an exact tie. */
function aheadWon(e, z, hpTie) {
  let lead = Math.sign(e.alive.p1 - e.alive.p2);
  if (!lead && hpTie) lead = Math.sign(e.hp.p1 - e.hp.p2);
  if (!lead || z === 0.5) return null;
  return (lead > 0) === (z === 1) ? 1 : 0;
}
const material = e => { const a = Math.max(e.alive.p1, e.alive.p2), b = Math.min(e.alive.p1, e.alive.p2); return a + 'v' + b; };

function keyStats(list, key) {
  const c = {}; for (const e of list) inc(c, e.keys[key]);
  const counts = Object.values(c).sort((a, b) => b - a), N = list.length;
  let acc = 0, k50 = null, k80 = null;
  for (let i = 0; i < counts.length; i++) { acc += counts[i]; if (k50 == null && acc >= 0.5 * N) k50 = i + 1; if (k80 == null && acc >= 0.8 * N) k80 = i + 1; }
  const share = n => +(counts.slice(0, n).reduce((a, v) => a + v, 0) / (N || 1)).toFixed(4);
  return { endgames: N, distinct: counts.length, singletons: counts.filter(v => v === 1).length, singleton_share_of_endgames: +(counts.filter(v => v === 1).length / (N || 1)).toFixed(4),
    top10_share: share(10), top100_share: share(100), top1000_share: share(1000), keys_for_50pct: k50, keys_for_80pct: k80 };
}
/* the honest table question: of the endgames AFTER the cut, how many have a key already seen BEFORE it? */
function hitRate(list, key, frac = 0.8) {
  const s = list.filter(e => e._t != null).slice().sort((a, b) => a._t - b._t);
  const cut = Math.floor(s.length * frac), seen = new Set(s.slice(0, cut).map(e => e.keys[key]));
  const test = s.slice(cut); const hit = test.filter(e => seen.has(e.keys[key])).length;
  return { train: cut, test: test.length, hit, rate: +(hit / (test.length || 1)).toFixed(4) };
}

function summarise(rows) {
  const N = rows.length;
  const byBand = {}; for (const r of rows) inc(byBand, r.band);
  const out = { games: N, games_by_band: byBand, reach: {}, entry: {}, outcome: {}, state: {}, distinct: {}, table_hit_rate: {}, actions: {} };
  for (const def of ['E2', 'E4', 'E1']) {
    const key = def.toLowerCase();
    const hit = rows.filter(r => r[key]);
    const bb = {}; for (const b of Object.keys(byBand)) bb[b] = wilson(hit.filter(r => r.band === b).length, byBand[b]);
    const normal = rows.filter(r => r.end === 'normal');
    out.reach[def] = { ...wilson(hit.length, N), among_normal_ends: wilson(normal.filter(r => r[key]).length, normal.length), by_band: bb,
      entry_turn: quant(hit.map(r => r[key].n), Q5), entry_turn_hist: hist(hit.map(r => r[key].n)),
      decisions_left_normal_end: quant(hit.filter(r => r.end === 'normal').map(r => r[key].decisions_left), Q5),
      decisions_left_hist_normal_end: hist(hit.filter(r => r.end === 'normal').map(r => r[key].decisions_left)),
      game_turns: quant(rows.map(r => r.turns), Q5),
      end_after_entry: hist(hit.map(r => r.end)) };
  }
  for (const def of ['E2', 'E4']) {
    const key = def.toLowerCase();
    const list = rows.filter(r => r[key]).map(r => Object.assign({}, r[key], { _z: r.z, _end: r.end, _band: r.band, _t: r.uploadtime }));
    const mat = {}; for (const e of list) inc(mat, material(e));
    const byMat = {};
    for (const m of Object.keys(mat)) {
      const L = list.filter(e => material(e) === m);
      const aw = L.map(e => aheadWon(e, e._z, false)).filter(v => v != null);
      const awh = L.map(e => aheadWon(e, e._z, true)).filter(v => v != null);
      const ff = L.filter(e => e._end === 'forfeit').length;
      const byB = {}; for (const b of Object.keys(byBand)) { const LB = L.filter(e => e._band === b).map(e => aheadWon(e, e._z, true)).filter(v => v != null); if (LB.length) byB[b] = wilson(LB.reduce((a, v) => a + v, 0), LB.length); }
      /* the HP leader's win rate by the size of the lead (summed displayed HP %), for the even-material ladder comparison */
      const hpLead = {};
      for (const e of L) {
        if (e.alive.p1 !== e.alive.p2 || e._z === 0.5) continue;
        const d = e.hp.p1 - e.hp.p2, ad = Math.abs(d);
        const b = ad === 0 ? '0' : ad <= 25 ? '1-25' : ad <= 50 ? '26-50' : ad <= 100 ? '51-100' : '>100';
        (hpLead[b] = hpLead[b] || { k: 0, n: 0 }); if (ad) { hpLead[b].n++; if ((d > 0) === (e._z === 1)) hpLead[b].k++; } else hpLead[b].n++;
      }
      for (const b of Object.keys(hpLead)) if (b !== '0') hpLead[b] = wilson(hpLead[b].k, hpLead[b].n);
      byMat[m] = { n: L.length, hp_leader_wins_by_lead: Object.keys(hpLead).length ? hpLead : undefined, share: +(L.length / (list.length || 1)).toFixed(4), ahead_on_mons_wins: aw.length ? wilson(aw.reduce((a, v) => a + v, 0), aw.length) : null,
        ahead_on_mons_then_hp_wins: awh.length ? wilson(awh.reduce((a, v) => a + v, 0), awh.length) : null, by_band_mons_then_hp: byB,
        ended_by_forfeit: wilson(ff, L.length), decisions_left_normal_end: quant(L.filter(e => e._end === 'normal').map(e => e.decisions_left), Q5) };
    }
    out.outcome[def] = { material: byMat };
    // the state at entry
    const monsAll = list.flatMap(e => [...e.mons.p1, ...e.mons.p2]);
    const hpH = {}; for (const m of monsAll) inc(hpH, Math.min(9, Math.floor(m.hp / 10.0001)) * 10 + '-' + (Math.min(9, Math.floor(m.hp / 10.0001)) * 10 + 10));
    const st = {}; for (const m of monsAll) inc(st, m.status || 'none');
    const bo = {}; let anyBoost = 0; for (const m of monsAll) { if (m.boosts) { anyBoost++; for (const t of m.boosts.match(/[a-z]+[+-]\d/g) || []) inc(bo, t.replace(/\d$/, '').replace(/[+-]$/, s => s === '+' ? ' up' : ' down')); } }
    const vo = {}; for (const m of monsAll) for (const v of m.vol) inc(vo, v);
    const sp = {}; const spGames = {}; for (const e of list) { const seenSp = new Set(); for (const m of [...e.mons.p1, ...e.mons.p2]) { inc(sp, m.sp); seenSp.add(m.sp); } for (const s of seenSp) inc(spGames, s); }
    const k0 = {}; for (const e of list) inc(k0, e.keys.K0);
    const f = { weather: {}, terrain: {}, trick_room: 0, trick_room_age: [], tailwind_any: 0, tailwind_both: 0, tailwind_age: [], screens_any: 0, side_conditions: {}, pseudo: {} };
    for (const e of list) {
      inc(f.weather, e.field.weather || 'none'); inc(f.terrain, e.field.terrain || 'none');
      if (e.field.trick_room) { f.trick_room++; f.trick_room_age.push(e.field.trick_room.age); }
      const tw = ['p1', 'p2'].filter(s => e.field.tailwind[s]); if (tw.length) f.tailwind_any++; if (tw.length === 2) f.tailwind_both++;
      for (const s of tw) f.tailwind_age.push(e.field.tailwind[s].age);
      if ([...e.field.sides.p1, ...e.field.sides.p2].some(c => /Reflect|Light Screen|Aurora Veil/.test(c))) f.screens_any++;
      for (const s of ['p1', 'p2']) for (const c of e.field.sides[s]) inc(f.side_conditions, c);
      for (const p of e.field.pseudo) inc(f.pseudo, p);
    }
    const anyField = list.filter(e => e.field.weather || e.field.terrain || e.field.trick_room || e.field.tailwind.p1 || e.field.tailwind.p2 || e.field.sides.p1.length || e.field.sides.p2.length).length;
    out.state[def] = {
      endgames: list.length, members: monsAll.length,
      hp_tenths: hpH, hp_mean: +(monsAll.reduce((a, m) => a + m.hp, 0) / (monsAll.length || 1)).toFixed(2), hp_full_share: +(monsAll.filter(m => m.hp >= 100).length / (monsAll.length || 1)).toFixed(4),
      status: st, members_with_any_stage: wilson(anyBoost, monsAll.length), stages: bo, volatiles: topN(vo, 25),
      mega_still_available: { p1_or_p2: wilson(list.filter(e => e.mega_left.p1 || e.mega_left.p2).length, list.length) },
      field: { any_field_or_side_condition: wilson(anyField, list.length), weather: f.weather, terrain: f.terrain,
        trick_room: wilson(f.trick_room, list.length), trick_room_age: hist(f.trick_room_age), trick_room_duration_from_dex: DUR['Trick Room'],
        tailwind_either: wilson(f.tailwind_any, list.length), tailwind_both: f.tailwind_both, tailwind_age: hist(f.tailwind_age), tailwind_duration_from_dex: DUR.Tailwind,
        screens_either: wilson(f.screens_any, list.length), screen_durations_from_dex: { Reflect: DUR.Reflect, 'Light Screen': DUR['Light Screen'], 'Aurora Veil': DUR['Aurora Veil'] },
        side_conditions: f.side_conditions, pseudo: f.pseudo },
      species_top30_members: topN(sp, 30), species_top30_endgames_containing: topN(spGames, 30).map(([s, n]) => [s, n, +(n / (list.length || 1)).toFixed(4)]),
      matchups_top25: topN(k0, 25),
    };
    out.distinct[def] = {}; out.table_hit_rate[def] = {};
    for (const key of ['K0', 'K0set', 'K1q', 'K1d', 'K2', 'K3', 'K3set']) { out.distinct[def][key] = keyStats(list, key); out.table_hit_rate[def][key] = hitRate(list, key); }
    const ac = list.filter(e => e.actions.p1 != null && e.actions.p2 != null);
    const bymat = {}; for (const m of Object.keys(mat)) { const L = ac.filter(e => material(e) === m); if (L.length) bymat[m] = { per_side: quant(L.flatMap(e => [e.actions.p1, e.actions.p2]), Q5), joint_matrix_cells: quant(L.map(e => e.actions.p1 * e.actions.p2), Q5) }; }
    out.actions[def] = { measured_on: ac.length, of: list.length, per_side: quant(ac.flatMap(e => [e.actions.p1, e.actions.p2]), Q5), joint_matrix_cells: quant(ac.map(e => e.actions.p1 * e.actions.p2), Q5), by_material: bymat, rule: DEFINITIONS.actions };
  }
  return out;
}

module.exports = { DEFINITIONS, band, aliveOf, liveMons, hpSum, keysOf, actionCount, entryFacts, gameRow, summarise, wilson, quant, hist, topN, aheadWon, material, UNK };
