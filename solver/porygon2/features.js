/* solver/porygon2/features.js — PORYGON2 v0's input: one POSITION -> the numbers the value net reads.
 *
 *   const F = require('./solver/porygon2/features.js').create(API.M);
 *   const x = F.encode(pos)          pos = { sheets:{p1:[6 rows], p2:[6 rows]}, state, turn }
 *       x.tokNum[side]  [6][TOK_NUM]     per sheet mon: public state + descriptive (stats, types) of its CURRENT forme
 *       x.tokId[side]   [6][TOK_ID]      per sheet mon: the SET's identity strings (species, item, ability, 4 moves)
 *       x.side[side]    [SIDE_NUM]       side conditions, material
 *       x.field         [FIELD_NUM]      weather, terrain, Trick Room, turn
 *       x.facts[side]   [FACT_NUM]       ENGINE-DERIVED damage race, `side` attacking the other (PRE-GATE)
 *       x.base          [alive_diff, hp_diff] from p1's view — the count-HP baseline's two inputs
 *   F.fromEngine(PA, S, sheets)       the same `pos` from a MEDICHAM battle, through the ONE engine->dataset
 *                                      translation (solver/miltank/prior_adapter.js publicState). The leaf and the
 *                                      training data therefore go through the same encode(), not two copies.
 *
 * `state` is the human dataset's PUBLIC state before a turn (solver/human/README.md). Only what BOTH players
 * can see is read: a sheet mon that has never taken the field is `unseen`, and it enters every pool with
 * weight p = (4 − seen)/(6 − seen), the chance it is one of the unrevealed brought four under a uniform
 * bring. That is the same view on both sides and in both adapters.
 *
 * SLOT ORDER DOES NOT MATTER. Tokens are pooled by the net (sum, max, actives-sum) and every engine fact
 * below is a mean, max or sum over pairs, so swapping the two actives, or permuting the sheet, gives the
 * same numbers. solver/tests/test-porygon2.js permutes and checks.
 *
 * THE ENGINE FACTS ARE MEDICHAM'S, AND THEY ARE PRE-GATE. Every damage number is `dmgRange` and
 * `hitProb`, every speed is `effSpeed` (Choice Scarf, paralysis, Tailwind, weather abilities, boosts,
 * Unburden, all in the engine's one chain), every priority is `movePriority`, and Trick Room flips the
 * order. Nothing here restates a Pokemon fact. The Reg M-C gate is NOT open, so these are an unverified
 * simulator's answers and are labelled PRE-GATE wherever they are reported.
 *
 * Bodies are built from the sheet the way the arena builds them (solver/arena/teams.js buildBody: the
 * table's flat spread, no nature — open sheets carry no spreads), in the CURRENT forme (a mega reads as
 * the mega), then given the position's HP, status, boosts, current item and ability. Each is a fresh
 * structuredClone of a cached build, so no fact computation can leak into the next position.
 *
 * Facts per direction (A attacking B), over the pairs (live A active a, live B active d):
 *   0 ko_any       share of pairs where a's best max roll >= d's current HP
 *   1 ko_sure      share where a's min roll does
 *   2 dmg_mean     mean over pairs of min(1, a's best expected hit / d's current HP)
 *   3 dmg_max      max of the same
 *   4 faster       share of pairs where a moves before d at priority 0 (Trick Room flips; a tie is 0.5)
 *   5 kill_first   share where a can KO d AND a's KO move goes before d's best move (priority, then speed)
 *   6 prio_ko      share where a can KO d with a positive-priority move
 *   7 ttc          turns-to-clear: sum over B's remaining mons (unseen weighted by p) of
 *                  min(8, ceil(hp / (both A actives' best expected hits on it))), / 32
 *   8 ohko_left    B's remaining mons (weighted) that one of A's actives KOs from where they stand, / 4
 *   9 has_pairs    1 if A has a live active and B has one
 */
'use strict';
const X = require('../human/dex.js');
const toID = X.toID;

const TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
const STATUS = ['brn', 'par', 'slp', 'frz', 'psn', 'tox'];
const BOOSTS = ['atk', 'def', 'spa', 'spd', 'spe'];
const VOLS = ['Substitute', 'perish', 'confusion', 'Taunt', 'Encore'];
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const WEATHERS = ['RainDance', 'SunnyDay', 'Sandstorm', 'Snowscape'];
const TERRAINS = ['Electric Terrain', 'Grassy Terrain', 'Misty Terrain', 'Psychic Terrain'];
const SIDE_CONDS = ['Tailwind', 'Reflect', 'Light Screen', 'Aurora Veil', 'Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web'];
/* vocabulary translations only (the dataset's names -> MEDICHAM's), the inverse of prior_adapter.js's maps */
const ENGINE_WEATHER = { RainDance: 'rain', SunnyDay: 'sun', Sandstorm: 'sand', Snowscape: 'snow' };
const ENGINE_TERRAIN = { 'Electric Terrain': 'electric', 'Grassy Terrain': 'grassy', 'Misty Terrain': 'misty', 'Psychic Terrain': 'psychic' };
const ENGINE_BOOST = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp', accuracy: 'acc', evasion: 'eva' };

const TOK_NUM_NAMES = ['seen', 'weight', 'unseen_p', 'active', 'bench', 'fainted', 'hp',
  ...STATUS.map(s => 'status_' + s), ...BOOSTS.map(b => 'boost_' + b), 'mega_now', 'item_lost', 'mega_capable',
  ...VOLS.map(v => 'vol_' + v), ...STATS.map(s => 'base_' + s), ...TYPES.map(t => 'type_' + t)];
const TOK_ID_NAMES = ['species', 'item', 'ability', 'move1', 'move2', 'move3', 'move4'];
const SIDE_NUM_NAMES = [...SIDE_CONDS.map(c => 'cond_' + c), 'mega_used', 'alive', 'hp_sum', 'fainted', 'seen', 'actives'];
const FIELD_NUM_NAMES = [...WEATHERS.map(w => 'weather_' + w), ...TERRAINS.map(t => 'terrain_' + t), 'trick_room', 'turn', 'turn1', 'turn2', 'turn3'];
const FACT_NAMES = ['ko_any', 'ko_sure', 'dmg_mean', 'dmg_max', 'faster', 'kill_first', 'prio_ko', 'ttc', 'ohko_left', 'has_pairs'];
const FEATURE_VERSION = 'porygon2-v0.1';
const SIDES = ['p1', 'p2'];

/* DELIBERATE BREAKS (env PORY2_BREAK), each one a way this file could be wrong that a test must see:
 *   slot   — the facts read only the FIRST active pair, so swapping the actives moves them
 *   speed  — Trick Room is ignored in the speed order
 *   facts  — every engine fact is zero (the "embeddings only" input, smuggled into the full model) */
const BREAK = (typeof process !== 'undefined' && process.env && process.env.PORY2_BREAK) || '';

function create(M, opts) {
  opts = opts || {};
  const MC = globalThis.MC;
  if (!MC || !MC.moves) throw new Error('porygon2/features: the engine table (globalThis.MC) is not loaded');
  const buildBody = opts.buildBody || require('../arena/teams.js').buildBody;
  const COUNTERS = { positions: 0, bodies: 0, bodyBuildFailed: 0, dmgCalls: 0, factsZeroPairs: 0 };
  const SPREAD = M.MEDI_SPREAD;

  /* descriptive rows of a forme, from the Reg M-C dex (cached) */
  const descCache = new Map();
  function desc(species) {
    const id = toID(species);
    if (descCache.has(id)) return descCache.get(id);
    const sp = X.D.species.get(id);
    const out = new Array(STATS.length + TYPES.length).fill(0);
    if (sp && sp.exists) {
      STATS.forEach((s, i) => { out[i] = (sp.baseStats[s] || 0) / 200; });
      for (const t of sp.types) { const k = TYPES.indexOf(t); if (k >= 0) out[STATS.length + k] = 1; }
    }
    descCache.set(id, out);
    return out;
  }
  const megaCapCache = new Map();
  function megaCapable(row) {
    const k = toID(row.item) + '|' + toID(row.species);
    if (megaCapCache.has(k)) return megaCapCache.get(k);
    const it = X.D.items.get(toID(row.item));
    const sp = X.D.species.get(toID(row.species));
    const v = !!(it && it.exists && it.megaStone && sp && sp.exists && (it.megaStone[sp.name] || it.megaEvolves === sp.name)) ? 1 : 0;
    megaCapCache.set(k, v);
    return v;
  }

  /* who is on the board, as the public state says, with the unseen weight */
  function view(pos, sd) {
    const st = pos.state.sides[sd];
    const mons = st.mons;
    const seen = mons.filter(m => m && m.seen).length;
    const unseenBrought = Math.max(0, 4 - seen);
    const p = seen < 6 ? unseenBrought / (6 - seen) : 0;
    const active = new Set((st.active || []).filter(i => i != null));
    const out = [];
    for (let i = 0; i < 6; i++) {
      const m = mons[i] || { i, seen: false };
      const row = pos.sheets[sd][i];
      if (!m.seen) { out.push({ i, row, seen: false, alive: true, weight: p, hp: 100, active: false, m }); continue; }
      const alive = !m.fnt && m.hp > 0;
      out.push({ i, row, seen: true, alive, weight: alive ? 1 : 0, hp: alive ? m.hp : 0, active: alive && active.has(i), m });
    }
    return { mons: out, seen, unseenBrought, p, st };
  }

  function engineField(pos) {
    const s = pos.state;
    return {
      weather: s.weather ? (ENGINE_WEATHER[s.weather.name] || null) : null, weatherT: 0,
      terrain: s.terrain ? (ENGINE_TERRAIN[s.terrain.name] || '') : '', terrainT: 0,
      twA: s.sides.p1.conditions && s.sides.p1.conditions.Tailwind ? 4 : 0,
      twB: s.sides.p2.conditions && s.sides.p2.conditions.Tailwind ? 4 : 0,
      tr: s.pseudo && s.pseudo['Trick Room'] != null ? 5 : 0, gravity: 0, fairylock: 0, sgA: {}, sgB: {},
    };
  }

  const bodyCache = new Map();
  function body(row, v) {
    const forme = v.seen && v.m.species ? v.m.species : row.species;
    const ability = v.seen && v.m.ability ? v.m.ability : row.ability;
    const key = JSON.stringify([row.species, row.item, row.ability, row.moves, forme, ability]);
    let b = bodyCache.get(key);
    if (b === undefined) {
      b = buildBody(M, Object.assign({}, row, { species: forme, ability })) || (forme !== row.species ? buildBody(M, row) : null);
      if (!b) COUNTERS.bodyBuildFailed++;
      bodyCache.set(key, b);
    }
    if (!b) return null;
    const c = structuredClone(b);
    COUNTERS.bodies++;
    if (v.seen) {
      c.curHP = Math.max(1, Math.round(v.hp / 100 * c.st.hp));
      c.status = v.m.status || '';
      const bo = { at: 0, df: 0, sa: 0, sd: 0, sp: 0, acc: 0, eva: 0 };
      for (const k in (v.m.boosts || {})) if (ENGINE_BOOST[k]) bo[ENGINE_BOOST[k]] = v.m.boosts[k];
      c.boosts = bo;
      c.item = v.m.item ? toID(v.m.item) : '';
    }
    c.fainted = false;
    return c;
  }

  /* a's best hit on d: max roll, min roll, best expected hit, the KO move's priority */
  function hits(a, d, field) {
    let maxR = 0, minR = 0, exp = 0, koPrio = -99, koId = null, bestId = null;
    for (const id of a.moves || []) {
      const mv = MC.moves[id];
      if (!mv) continue;
      let r;
      try { r = M.dmgRange(a, d, mv, field, SPREAD.has(id)); } catch (e) { r = null; }
      COUNTERS.dmgCalls++;
      if (!r || !(r.max > 0)) continue;
      let acc = 1; try { acc = M.hitProb(a, d, id, field); } catch (e) { acc = 1; }
      const e = (r.min + r.max) / 2 * acc;
      if (r.max > maxR) maxR = r.max;
      if (r.min > minR) minR = r.min;
      if (e > exp) { exp = e; bestId = id; }
      if (r.max >= d.curHP) { const pr = M.movePriority(id, field); if (pr > koPrio) { koPrio = pr; koId = id; } }
    }
    return { maxR, minR, exp, koPrio, koId, bestId };
  }
  /* 1 if a acts before d, 0 after, 0.5 on a speed tie — priority first, then effSpeed, Trick Room flips */
  function order(a, sa, pa, d, sd, pd, field) {
    if (pa !== pd) return pa > pd ? 1 : 0;
    const va = M.effSpeed(a, field, sa), vd = M.effSpeed(d, field, sd);
    if (va === vd) return 0.5;
    const faster = va > vd;
    return (field.tr > 0 && BREAK !== 'speed') ? (faster ? 0 : 1) : (faster ? 1 : 0);
  }

  function factsFor(att, def, attSide, defSide, field) {
    const f = new Array(FACT_NAMES.length).fill(0);
    let actA = att.mons.filter(v => v.active && v.body);
    let actD = def.mons.filter(v => v.active && v.body);
    if (BREAK === 'slot') { actA = actA.slice(0, 1); actD = actD.slice(0, 1); }
    const remaining = def.mons.filter(v => v.alive && v.weight > 0 && v.body);
    if (!actA.length || !actD.length) { COUNTERS.factsZeroPairs++; }
    /* hit table: every live A active on every remaining B mon */
    const H = new Map();
    for (const a of actA) for (const d of remaining) H.set(a.i + ',' + d.i, hits(a.body, d.body, field));
    let pairs = 0;
    for (const a of actA) for (const d of actD) {
      pairs++;
      const h = H.get(a.i + ',' + d.i);
      const hp = d.body.curHP;
      const back = hits(d.body, a.body, field);
      if (h.maxR >= hp) f[0]++;
      if (h.minR >= hp) f[1]++;
      const fr = Math.min(1, h.exp / hp);
      f[2] += fr; f[3] = Math.max(f[3], fr);
      f[4] += order(a.body, attSide, 0, d.body, defSide, 0, field);
      if (h.maxR >= hp) {
        const pd = back.bestId ? M.movePriority(back.bestId, field) : 0;
        f[5] += order(a.body, attSide, h.koPrio, d.body, defSide, pd, field);
        if (h.koPrio > 0) f[6]++;
      }
    }
    if (pairs) { f[0] /= pairs; f[1] /= pairs; f[2] /= pairs; f[4] /= pairs; f[5] /= pairs; f[6] /= pairs; f[9] = 1; }
    let ttc = 0, ohko = 0;
    for (const d of remaining) {
      let dmg = 0, ko = false;
      for (const a of actA) { const h = H.get(a.i + ',' + d.i); dmg += h.exp; if (h.maxR >= d.body.curHP) ko = true; }
      ttc += d.weight * (dmg > 0 ? Math.min(8, Math.ceil(d.body.curHP / dmg)) : 8);
      if (ko) ohko += d.weight;
    }
    f[7] = actA.length ? ttc / 32 : 1;
    f[8] = ohko / 4;
    if (BREAK === 'facts') f.fill(0);
    return f;
  }

  function encode(pos) {
    COUNTERS.positions++;
    const V = { p1: view(pos, 'p1'), p2: view(pos, 'p2') };
    const field = engineField(pos);
    const out = { tokNum: {}, tokId: {}, side: {}, facts: {}, field: null, base: null };
    for (const sd of SIDES) {
      const v = V[sd];
      const tn = [], ti = [];
      let alive = 0, hpSum = 0, fainted = 0, actives = 0;
      for (const t of v.mons) {
        const row = t.row, m = t.m;
        const x = new Array(TOK_NUM_NAMES.length).fill(0);
        let k = 0;
        x[k++] = t.seen ? 1 : 0; x[k++] = t.weight; x[k++] = t.seen ? 0 : v.p;
        x[k++] = t.active ? 1 : 0; x[k++] = t.seen && t.alive && !t.active ? 1 : 0; x[k++] = t.seen && !t.alive ? 1 : 0;
        x[k++] = t.alive ? t.hp / 100 : 0;
        for (const s of STATUS) x[k++] = t.seen && t.alive && m.status === s ? 1 : 0;
        for (const b of BOOSTS) x[k++] = t.seen && t.alive ? ((m.boosts && m.boosts[b]) || 0) / 6 : 0;
        x[k++] = t.seen && m.mega ? 1 : 0;
        x[k++] = t.seen && row.item && !m.item ? 1 : 0;
        x[k++] = megaCapable(row);
        for (const vo of VOLS) x[k++] = t.seen && t.alive && m.vol && m.vol[vo] != null ? 1 : 0;
        const d = desc(t.seen && m.species ? m.species : row.species);
        for (const q of d) x[k++] = q;
        tn.push(x);
        ti.push([toID(row.species_id || row.species), toID(row.item), toID(row.ability), ...[0, 1, 2, 3].map(j => toID((row.moves || [])[j]))]);
        if (t.seen && !t.alive) fainted++;
        if (t.active) actives++;
        if (t.seen && t.alive) { alive++; hpSum += t.hp / 100; }
      }
      alive += v.unseenBrought; hpSum += v.unseenBrought;
      const cond = v.st.conditions || {};
      out.side[sd] = [...SIDE_CONDS.map(c => (cond[c] ? 1 : 0)), v.st.mega_used ? 1 : 0, alive / 4, hpSum / 4, fainted / 4, v.seen / 6, actives / 2];
      out.tokNum[sd] = tn; out.tokId[sd] = ti;
      out.alive = out.alive || {}; out.hpSum = out.hpSum || {};
      out.alive[sd] = alive; out.hpSum[sd] = hpSum;
    }
    const s = pos.state, turn = pos.turn || 1;
    out.field = [...WEATHERS.map(w => (s.weather && s.weather.name === w ? 1 : 0)), ...TERRAINS.map(t => (s.terrain && s.terrain.name === t ? 1 : 0)),
      s.pseudo && s.pseudo['Trick Room'] != null ? 1 : 0, Math.min(2, turn / 10), turn === 1 ? 1 : 0, turn === 2 ? 1 : 0, turn === 3 ? 1 : 0];
    out.base = [(out.alive.p1 - out.alive.p2) / 4, (out.hpSum.p1 - out.hpSum.p2) / 4];
    /* engine facts: bodies for everybody the facts can touch */
    for (const sd of SIDES) for (const t of V[sd].mons) t.body = (t.alive && t.weight > 0) ? body(t.row, t) : null;
    out.facts.p1 = factsFor(V.p1, V.p2, 'A', 'B', field);
    out.facts.p2 = factsFor(V.p2, V.p1, 'B', 'A', field);
    return out;
  }

  /* a MEDICHAM battle -> pos, through the prior adapter's publicState (the one engine->dataset translation) */
  function fromEngine(PA, S, sheets) {
    return { sheets, state: PA.publicState({ G: { sheets } }, S), turn: S.turn + 1 };
  }

  return { encode, fromEngine, COUNTERS, BROKEN: BREAK || null };
}

module.exports = { create, TOK_NUM_NAMES, TOK_ID_NAMES, SIDE_NUM_NAMES, FIELD_NUM_NAMES, FACT_NAMES, FEATURE_VERSION, BREAK };
