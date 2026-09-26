/* solver/porygon2/v1/features.js — PORYGON2 v1's input: the FULL HONEST-INFORMATION state of one position.
 *
 *   const F = require('./solver/porygon2/v1/features.js').create(API);
 *   const H = F.fromEngine(S, sheets)                 a MEDICHAM battle (a search world, or a replayed self-play game)
 *   const H = F.fromDataset(game, turns, k)           a human game's k-th public state, history turns[0..k-1]
 *   const X = F.encode(H)                             the numbers the net reads (both producers meet here: ONE encode)
 *
 * WHAT "HONEST" MEANS. Only what both players can see on a Champions client with open team sheets: both sheets (species,
 * item, ability, four moves), which sheet mons have been revealed, every revealed mon's HP as the client's percentage,
 * status, stat stages, volatiles, the item it holds NOW (consumed / knocked off / swapped are public), its forme and
 * ability, the PP it has spent (every use is shown), how many shields in a row it has put up, how long it has been in,
 * whether it is choice-locked, and every field and side timer. NOT seen: the stat spreads (Stat Points), and which two
 * unrevealed sheet mons are the back line. So:
 *   - an unrevealed sheet mon enters with weight p = (4 − seen)/(6 − seen), exactly as v0 and as the human dataset;
 *   - every damage / speed FACT is computed on a body built from the SHEET at the table's flat spread (no nature), with
 *     the position's public state laid on (solver/arena/teams.js buildBody, as v0). Never the world's body: in a search
 *     world an opponent's spread is a belief draw and in a replayed self-play game it is the truth, and the net must
 *     see the same thing in training and in play. Spread-agnostic by construction.
 *   - HP is quantised to the client's whole percent on BOTH sides and in BOTH producers.
 *
 * TWO PRODUCERS, ONE ENCODE. fromEngine reads MEDICHAM's own fields (tookProtectTurns, ppSpentMap, _turnsOut, _lock,
 * field.weatherT/terrainT/tr/twA/twB/gravity, sf.sc); fromDataset derives the same quantities from the public history of
 * a human game (solver/human/README.md), where the log gives them: shields in a row from the protect-family moves the
 * mon executed, PP spent from its move uses, turns in from the active slots, timers from `since`. The dataset side is an
 * APPROXIMATION where the log is silent (a timer extended by an item, Pressure's extra PP) and is labelled so in the
 * report; solver/tests/test-porygon2-v1.js checks the two producers against each other on replayed self-play positions.
 *
 * SLOT ORDER DOES NOT MATTER: tokens are per SHEET mon (6 per side); every relational fact is a max / mean / share over
 * pairs; solver/tests/test-porygon2-v1.js permutes the sheet and swaps the actives.
 *
 * DELIBERATE BREAKS (env PORY2V1_BREAK): `honest` — fromEngine reveals the unrevealed back line (the world's true bodies
 * leak in); `protect` — the shield streak is dropped; `tr` — Trick Room is ignored in the speed order. The v1 test
 * must go red under each.
 */
'use strict';
const X = require('../../human/dex.js');
const toID = X.toID;

const TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
const STATUS = ['brn', 'par', 'slp', 'frz', 'psn', 'tox'];
const BOOSTS = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
const ENGINE_BOOST = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp', accuracy: 'acc', evasion: 'eva' };
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const VOLS = ['sub', 'confusion', 'taunt', 'encore', 'perish', 'yawn', 'healblock', 'trapped', 'charging', 'recharge', 'locked', 'typechange'];
const WEATHERS = ['rain', 'sun', 'sand', 'snow'];
const TERRAINS = ['electric', 'grassy', 'misty', 'psychic'];
const SCREENS = ['reflect', 'lightscreen', 'auroraveil', 'safeguard', 'mist'];
const HAZARDS = ['spikes', 'toxicspikes', 'stealthrock', 'stickyweb'];
const DS_WEATHER = { RainDance: 'rain', SunnyDay: 'sun', Sandstorm: 'sand', Snowscape: 'snow' };
const DS_TERRAIN = { 'Electric Terrain': 'electric', 'Grassy Terrain': 'grassy', 'Misty Terrain': 'misty', 'Psychic Terrain': 'psychic' };

/* per-token relational facts (the damage race), from the one hit table */
const TFACT_NAMES = ['out_dmg_max', 'out_dmg_mean', 'out_ko_any', 'out_ko_sure', 'out_first', 'out_kill_first', 'out_prio_ko',
  'in_dmg_max', 'in_ko_any', 'in_ko_sure', 'in_ttk', 'in_threat_first'];
const TOK_NUM_NAMES = ['seen', 'weight', 'unseen_p', 'active', 'bench', 'fainted', 'alive', 'hp',
  ...STATUS.map(s => 'status_' + s), ...BOOSTS.map(b => 'boost_' + b), 'mega_now', 'mega_capable', 'item_lost', 'item_changed',
  ...VOLS.map(v => 'vol_' + v), 'protect_streak', 'protect_ok', 'turns_out_1', 'turns_out', 'pp_min', 'pp_any_empty',
  'spe_eff', 'spe_rank', ...STATS.map(s => 'base_' + s), ...TYPES.map(t => 'type_' + t), ...TFACT_NAMES];
const TOK_ID_NAMES = ['species', 'item', 'ability', 'move1', 'move2', 'move3', 'move4'];
const SIDE_NUM_NAMES = ['tailwind', 'tailwind_left', ...SCREENS.map(s => 'screen_' + s), ...SCREENS.map(s => 'left_' + s),
  ...HAZARDS.map(h => 'haz_' + h), 'mega_used', 'alive', 'hp_sum', 'fainted', 'seen', 'actives', 'unseen_brought'];
const FIELD_NUM_NAMES = [...WEATHERS.map(w => 'w_' + w), 'weather_left', ...TERRAINS.map(t => 't_' + t), 'terrain_left',
  'trick_room', 'tr_left', 'gravity', 'turn', 'turn1', 'turn2', 'turn3', 'turn4_5', 'turn6_8', 'turn9p'];
/* the v0 aggregate damage race, per direction (solver/porygon2/features.js FACT_NAMES, same definitions) */
const FACT_NAMES = ['ko_any', 'ko_sure', 'dmg_mean', 'dmg_max', 'faster', 'kill_first', 'prio_ko', 'ttc', 'ohko_left', 'has_pairs'];
const FEATURE_VERSION = 'porygon2-v1.0';
const SIDES = ['p1', 'p2'];
const BREAK = (typeof process !== 'undefined' && process.env && process.env.PORY2V1_BREAK) || '';

function create(API, opts) {
  opts = opts || {};
  const M = API.M;
  const MC = globalThis.MC;
  if (!MC || !MC.moves) throw new Error('porygon2/v1/features: the engine table (globalThis.MC) is not loaded');
  const buildBody = opts.buildBody || require('../../arena/teams.js').buildBody;
  const SPREAD = M.MEDI_SPREAD;
  const COUNTERS = { positions: 0, engine: 0, dataset: 0, bodies: 0, bodyBuildFailed: 0, dmgCalls: 0, factsZeroPairs: 0, unmapped: 0 };

  /* ---------------------------------------------------------------- dex reads (cached; never typed) */
  const descCache = new Map();
  function desc(species) {
    const id = toID(species);
    let out = descCache.get(id);
    if (out) return out;
    out = new Array(STATS.length + TYPES.length).fill(0);
    const sp = X.D.species.get(id);
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
    const it = X.D.items.get(toID(row.item)), sp = X.D.species.get(toID(row.species));
    const v = !!(it && it.exists && it.megaStone && sp && sp.exists && (it.megaStone[sp.name] || it.megaEvolves === sp.name)) ? 1 : 0;
    megaCapCache.set(k, v);
    return v;
  }
  const stallCache = new Map();
  const isStall = mv => { const id = toID(mv); if (stallCache.has(id)) return stallCache.get(id); const m = X.D.moves.get(id); const v = !!(m && m.exists && m.stallingMove); stallCache.set(id, v); return v; };
  const ppMaxCache = new Map();
  const ppMax = id => { if (ppMaxCache.has(id)) return ppMaxCache.get(id); let v = null; try { v = M.ppMax(id); } catch (e) { v = null; } ppMaxCache.set(id, v); return v; };
  /* P(the next shield holds) after n in a row: the engine's own counter (M.stallCounter), never a typed ladder */
  const protectOk = n => { const c = M.stallCounter(n | 0); return c > 0 ? 1 / c : 1; };

  /* ---------------------------------------------------------------- the honest state H
   * H = { turn, field:{weather, weatherLeft, terrain, terrainLeft, trLeft, gravity}, sides:{p1,p2} }
   * side = { conds:{tailwindLeft, screens:{id:left}, hazards:{id:layers}}, megaUsed, mons:[6] }
   * mon  = { seen, alive, active, hp(0..100), status, boosts{atk..evasion}, species, ability, item(id|''), itemLost,
   *          vol:{…}, protectN, turnsOut, pp:[4 fractions in sheet-move order], lock }                              */
  const emptyMon = () => ({ seen: false });

  function fromEngine(S, sheets) {
    COUNTERS.engine++;
    const f = S.field;
    const H = { turn: S.turn + 1, field: {
      weather: f.weather || null, weatherLeft: f.weather ? (f.weatherT | 0) : 0,
      terrain: f.terrain || null, terrainLeft: f.terrain ? (f.terrainT | 0) : 0,
      trLeft: f.tr > 0 ? f.tr : 0, gravity: f.gravity > 0 ? f.gravity : 0 }, sides: {} };
    for (const [sd, P] of [['A', 'p1'], ['B', 'p2']]) {
      const sf = sd === 'A' ? S.sfA : S.sfB, act = sd === 'A' ? S.actA : S.actB;
      const mons = sheets[P].map(emptyMon);
      const screens = {}, hazards = {};
      for (const k of Object.keys(sf.sc || {})) {
        const v = sf.sc[k];
        if (!(v > 0)) continue;
        if (SCREENS.includes(k)) screens[k] = v; else if (HAZARDS.includes(k)) hazards[k] = v; else COUNTERS.unmapped++;
      }
      const side = { conds: { tailwindLeft: (sd === 'A' ? f.twA : f.twB) > 0 ? (sd === 'A' ? f.twA : f.twB) : 0, screens, hazards }, megaUsed: !!sf.megaUsed, mons };
      sf.team.forEach(m => {
        const live = !m.fainted && m.curHP > 0;
        const isAct = act.includes(m) && live;
        const revealed = isAct || m.fainted || m.curHP <= 0 || m._wasOut || BREAK === 'honest';
        if (!revealed) return;
        const s = m._solverSheet;
        if (s == null) throw new Error('porygon2/v1: body without _solverSheet');
        const row = sheets[P][s];
        const boosts = {};
        for (const b of BOOSTS) { const v = m.boosts && m.boosts[ENGINE_BOOST[b]]; if (v) boosts[b] = v; }
        const v = m._vol || {};
        const vol = {};
        if (m._sub) vol.sub = 1;
        if (v.confusion) vol.confusion = 1;
        if (v.taunt) vol.taunt = 1;
        if (v.encore || m._encoreMove) vol.encore = 1;
        if (v.perish != null) vol.perish = Math.max(0, +v.perish || 0) / 3 || 1 / 3;
        if (m._yawn) vol.yawn = 1;
        if (m._healBlock) vol.healblock = 1;
        if (m._trap) vol.trapped = 1;
        if (m._charging) vol.charging = 1;
        if (m._recharge) vol.recharge = 1;
        if (m._lock) vol.locked = 1;
        const spec = X.D.species.get(toID(m.name));
        if (spec && spec.exists && m.types && m.types.join('/') !== spec.types.join('/')) vol.typechange = 1;
        let spent = null; try { spent = M.ppSpentMap(m); } catch (e) { spent = null; }
        const pp = (row.moves || []).slice(0, 4).map(mv => {
          const id = toID(mv), mx = ppMax(id);
          if (!mx || !spent) return 1;
          return Math.max(0, 1 - (spent[id] || 0) / mx);
        });
        mons[s] = { seen: true, alive: live, active: isAct, hp: live ? Math.max(1, Math.round(100 * m.curHP / m.st.hp)) : 0,
          status: live ? (m.status || '') : '', boosts, species: m.name, ability: m.ability || '', item: m.item ? toID(m.item) : '',
          vol, protectN: BREAK === 'protect' ? 0 : (m.tookProtectTurns | 0), turnsOut: isAct ? (m._turnsOut | 0) : 0, pp };
      });
      H.sides[P] = side;
    }
    return H;
  }

  /* the human dataset's public state + its history -> H (the same quantities, derived where the log gives them) */
  function fromDataset(game, turns, k) {
    COUNTERS.dataset++;
    const T = turns[k], st = T.state, n = T.n;
    const wName = st.weather ? DS_WEATHER[st.weather.name] || null : null;
    const tName = st.terrain ? DS_TERRAIN[st.terrain.name] || null : null;
    /* remaining turns from `since`: the base duration (weather read from the engine's own weatherTurns with no item;
     * the other clocks at the base the engine's timers were seen to start from) minus the turns elapsed. An item that
     * extends a clock is not in the log and is not modelled — an approximation, labelled. */
    const left = (base, since) => (since == null ? base : Math.max(1, base - Math.max(0, n - since)));
    const H = { turn: n, field: {
      weather: wName, weatherLeft: wName ? left(M.weatherTurns(wName, ''), st.weather.since) : 0,
      terrain: tName, terrainLeft: tName ? left(5, st.terrain.since) : 0,
      trLeft: st.pseudo && st.pseudo['Trick Room'] != null ? left(5, st.pseudo['Trick Room']) : 0,
      gravity: st.pseudo && st.pseudo.Gravity != null ? 1 : 0 }, sides: {} };
    for (const P of SIDES) {
      const ss = st.sides[P];
      const cond = ss.conditions || {};
      const screens = {}, hazards = {};
      for (const name of Object.keys(cond)) {
        const id = toID(name);
        if (id === 'tailwind') continue;
        if (SCREENS.includes(id)) screens[id] = left(5, cond[name] && cond[name].since);
        else if (HAZARDS.includes(id)) hazards[id] = (cond[name] && cond[name].layers) || 1;
      }
      const side = { conds: { tailwindLeft: cond.Tailwind ? left(4, cond.Tailwind.since) : 0, screens, hazards }, megaUsed: !!ss.mega_used, mons: game.sheets[P].map(emptyMon) };
      const actNow = new Set((ss.active || []).filter(i => i != null));
      for (let i = 0; i < 6; i++) {
        const m = ss.mons[i];
        if (!m || !m.seen) continue;
        const row = game.sheets[P][i];
        const live = !m.fnt && m.hp > 0;
        const isAct = live && actNow.has(i);
        const boosts = {};
        for (const b of BOOSTS) if (m.boosts && m.boosts[b]) boosts[b] = m.boosts[b];
        const vol = {};
        const V = m.vol || {};
        if (V.Substitute != null) vol.sub = 1;
        if (V.confusion != null) vol.confusion = 1;
        if (V.Taunt != null) vol.taunt = 1;
        if (V.Encore != null) vol.encore = 1;
        if (V.perish != null) vol.perish = Math.max(0, +(V.perish.value != null ? V.perish.value : V.perish) || 0) / 3 || 1 / 3;
        if (V.Yawn != null || V.yawn != null) vol.yawn = 1;
        if (V['Heal Block'] != null) vol.healblock = 1;
        if (V.typechange != null) vol.typechange = 1;
        /* history: shields in a row, PP spent, turns in, the choice lock (the same move every turn it has been in) */
        let protectN = 0, turnsOut = 0;
        const uses = {};
        let streakOpen = true;
        for (let j = k - 1; j >= 0; j--) {
          const a = turns[j].actions && turns[j].actions[P] ? [turns[j].actions[P].a, turns[j].actions[P].b].find(x => x && x.mon === i) : null;
          if (streakOpen) {
            if (a && a.kind === 'move' && isStall(a.move) && a.executed !== false && !a.cant) protectN++;
            else streakOpen = false;
          }
        }
        for (let j = 0; j < k; j++) {
          const A = turns[j].actions && turns[j].actions[P];
          if (!A) continue;
          for (const a of [A.a, A.b]) if (a && a.mon === i && a.kind === 'move' && a.move && a.executed !== false) { const id = toID(a.move); uses[id] = (uses[id] || 0) + 1; }
        }
        /* turns in = the turn ENDS it has been active at (the engine's _turnsOut: +1 at every end of turn). A streak of
         * states e..k gives k − e ends; the turn it came in on counts too when it arrived by a switch ACTION or a mid-turn
         * pivot (it was on the field at that turn's end), not when it was an end-of-turn replacement. */
        if (isAct) {
          let e = k;
          while (e - 1 >= 0 && (turns[e - 1].state.sides[P].active || []).includes(i)) e--;
          turnsOut = k - e;
          if (e > 0) {
            const Tp = turns[e - 1], A = Tp.actions && Tp.actions[P];
            const byAction = A && [A.a, A.b].some(a => a && a.kind === 'switch' && a.to === i);
            const byPivot = (Tp.midturn_switches || []).some(s => s.side === P && s.to === i);
            if (byAction || byPivot) turnsOut++;
          }
        }
        const pp = (row.moves || []).slice(0, 4).map(mv => { const id = toID(mv), mx = ppMax(id); return mx ? Math.max(0, 1 - (uses[id] || 0) / mx) : 1; });
        const itemNow = m.item ? toID(m.item) : '';
        let locked = 0;
        if (isAct && /choice/.test(toID(row.item)) && itemNow === toID(row.item) && turnsOut > 0) locked = 1;
        if (locked) vol.locked = 1;
        side.mons[i] = { seen: true, alive: live, active: isAct, hp: live ? Math.max(1, Math.round(m.hp)) : 0, status: live ? (m.status || '') : '', boosts,
          species: m.species || row.species, ability: m.ability || row.ability || '', item: itemNow, vol, protectN, turnsOut, pp };
      }
      H.sides[P] = side;
    }
    return H;
  }

  /* ---------------------------------------------------------------- bodies for the facts (flat sheet spread + public state) */
  const bodyCache = new Map();
  function body(row, mon) {
    const forme = mon && mon.seen && mon.species ? mon.species : row.species;
    const ability = mon && mon.seen && mon.ability ? mon.ability : row.ability;
    const key = row.species + '|' + row.item + '|' + row.ability + '|' + (row.moves || []).join(',') + '|' + forme + '|' + ability;
    let b = bodyCache.get(key);
    if (b === undefined) {
      b = buildBody(M, Object.assign({}, row, { species: forme, ability })) || (forme !== row.species ? buildBody(M, row) : null);
      if (!b) COUNTERS.bodyBuildFailed++;
      bodyCache.set(key, b);
    }
    if (!b) return null;
    const c = structuredClone(b);
    COUNTERS.bodies++;
    if (mon && mon.seen) {
      c.curHP = Math.max(1, Math.round(mon.hp / 100 * c.st.hp));
      c.status = mon.status || '';
      const bo = { at: 0, df: 0, sa: 0, sd: 0, sp: 0, acc: 0, eva: 0 };
      for (const k in mon.boosts) if (ENGINE_BOOST[k]) bo[ENGINE_BOOST[k]] = mon.boosts[k];
      c.boosts = bo;
      c.item = mon.item || '';
    }
    c.fainted = false;
    return c;
  }
  function engineField(H) {
    const f = H.field;
    return { weather: f.weather, weatherT: f.weatherLeft, terrain: f.terrain || '', terrainT: f.terrainLeft,
      twA: H.sides.p1.conds.tailwindLeft, twB: H.sides.p2.conds.tailwindLeft,
      tr: (BREAK === 'tr') ? 0 : f.trLeft, gravity: f.gravity, fairylock: 0, sgA: {}, sgB: {} };
  }

  function hits(a, d, field) {
    let maxR = 0, minR = 0, exp = 0, koPrio = -99, bestId = null;
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
      if (r.max >= d.curHP) { const pr = M.movePriority(id, field); if (pr > koPrio) koPrio = pr; }
    }
    return { maxR, minR, exp, koPrio, bestId };
  }
  function order(a, sa, pa, d, sd, pd, field) {
    if (pa !== pd) return pa > pd ? 1 : 0;
    const va = M.effSpeed(a, field, sa), vd = M.effSpeed(d, field, sd);
    if (va === vd) return 0.5;
    const faster = va > vd;
    return field.tr > 0 ? (faster ? 0 : 1) : (faster ? 1 : 0);
  }

  /* ---------------------------------------------------------------- encode */
  function encode(H, sheets) {
    COUNTERS.positions++;
    const field = engineField(H);
    const V = {};
    for (const sd of SIDES) {
      const side = H.sides[sd];
      const seen = side.mons.filter(m => m.seen).length;
      const unseenBrought = Math.max(0, 4 - seen);
      const p = seen < 6 ? unseenBrought / (6 - seen) : 0;
      V[sd] = { p, seen, unseenBrought, list: side.mons.map((m, i) => {
        const alive = m.seen ? m.alive : true;
        const weight = m.seen ? (alive ? 1 : 0) : p;
        return { i, m, row: sheets[sd][i], alive, weight, active: !!(m.seen && m.active) };
      }) };
    }
    for (const sd of SIDES) for (const t of V[sd].list) t.body = (t.alive && t.weight > 0) ? body(t.row, t.m) : null;
    const tf = { p1: V.p1.list.map(() => new Array(TFACT_NAMES.length).fill(0)), p2: V.p2.list.map(() => new Array(TFACT_NAMES.length).fill(0)) };
    const facts = {};
    const Hit = {};
    for (const [att, def, sa, sdd] of [['p1', 'p2', 'A', 'B'], ['p2', 'p1', 'B', 'A']]) {
      const actA = V[att].list.filter(t => t.active && t.body), actD = V[def].list.filter(t => t.active && t.body);
      const remaining = V[def].list.filter(t => t.alive && t.weight > 0 && t.body);
      const Hm = new Map();
      for (const a of actA) for (const d of remaining) Hm.set(a.i + ',' + d.i, hits(a.body, d.body, field));
      Hit[att] = { Hm, actA, actD, remaining, sa, sdd };
    }
    for (const [att, def] of [['p1', 'p2'], ['p2', 'p1']]) {
      const { Hm, actA, actD, remaining, sa, sdd } = Hit[att];
      const f = new Array(FACT_NAMES.length).fill(0);
      if (!actA.length || !actD.length) COUNTERS.factsZeroPairs++;
      let pairs = 0;
      for (const a of actA) {
        const ta = tf[att][a.i];
        let n = 0;
        for (const d of actD) {
          pairs++; n++;
          const h = Hm.get(a.i + ',' + d.i), back = Hit[def].Hm.get(d.i + ',' + a.i);
          const hp = d.body.curHP;
          const fr = Math.min(1, h.exp / hp);
          const ko = h.maxR >= hp, sure = h.minR >= hp;
          const first = order(a.body, sa, 0, d.body, sdd, 0, field);
          f[0] += ko ? 1 : 0; f[1] += sure ? 1 : 0; f[2] += fr; f[3] = Math.max(f[3], fr); f[4] += first;
          ta[0] = Math.max(ta[0], fr); ta[1] += fr; ta[2] = Math.max(ta[2], ko ? 1 : 0); ta[3] = Math.max(ta[3], sure ? 1 : 0); ta[4] += first;
          if (ko) {
            const pd = back && back.bestId ? M.movePriority(back.bestId, field) : 0;
            const kf = order(a.body, sa, h.koPrio, d.body, sdd, pd, field);
            f[5] += kf; ta[5] = Math.max(ta[5], kf);
            if (h.koPrio > 0) { f[6]++; ta[6] = 1; }
          }
        }
        if (n) { ta[1] /= n; ta[4] /= n; }
      }
      if (pairs) { f[0] /= pairs; f[1] /= pairs; f[2] /= pairs; f[4] /= pairs; f[5] /= pairs; f[6] /= pairs; f[9] = 1; }
      /* incoming, on EVERY remaining defender (bench and unseen included): how hard the attacking actives hit it */
      let ttc = 0, ohko = 0;
      for (const d of remaining) {
        const td = tf[def][d.i];
        let dmg = 0, ko = false, sure = false, mx = 0, threatFirst = 0, nA = 0;
        for (const a of actA) {
          const h = Hm.get(a.i + ',' + d.i);
          dmg += h.exp; mx = Math.max(mx, Math.min(1, h.exp / d.body.curHP));
          if (h.maxR >= d.body.curHP) ko = true;
          if (h.minR >= d.body.curHP) sure = true;
          if (d.active) { threatFirst += order(a.body, sa, 0, d.body, sdd, 0, field); nA++; }
        }
        const ttk = dmg > 0 ? Math.min(8, Math.ceil(d.body.curHP / dmg)) : 8;
        td[7] = mx; td[8] = ko ? 1 : 0; td[9] = sure ? 1 : 0; td[10] = ttk / 8; td[11] = nA ? threatFirst / nA : 0;
        ttc += d.weight * ttk;
        if (ko) ohko += d.weight;
      }
      f[7] = actA.length ? ttc / 32 : 1;
      f[8] = ohko / 4;
      facts[att] = f;
    }
    /* speed: every live body's effective speed on this field (the engine's one chain), and its rank among the four actives */
    const spe = { p1: [], p2: [] };
    for (const [sd, s] of [['p1', 'A'], ['p2', 'B']]) for (const t of V[sd].list) spe[sd][t.i] = t.body ? M.effSpeed(t.body, field, s) : 0;
    const actSpe = [];
    for (const sd of SIDES) for (const t of V[sd].list) if (t.active && t.body) actSpe.push(spe[sd][t.i]);
    const out = { tok: {}, ids: {}, mvw: {}, side: {}, facts, field: null, base: null };
    const agg = {};
    for (const sd of SIDES) {
      const v = V[sd], side = H.sides[sd];
      const tok = [], ids = [], mvw = [];
      let alive = 0, hpSum = 0, fainted = 0, actives = 0;
      for (const t of v.list) {
        const m = t.m, row = t.row;
        const x = new Array(TOK_NUM_NAMES.length).fill(0);
        let k = 0;
        const S = m.seen, L = S && t.alive;
        x[k++] = S ? 1 : 0; x[k++] = t.weight; x[k++] = S ? 0 : v.p;
        x[k++] = t.active ? 1 : 0; x[k++] = L && !t.active ? 1 : 0; x[k++] = S && !t.alive ? 1 : 0; x[k++] = t.alive ? 1 : 0;
        x[k++] = t.alive ? (S ? m.hp / 100 : 1) : 0;
        for (const s of STATUS) x[k++] = L && m.status === s ? 1 : 0;
        for (const b of BOOSTS) x[k++] = L ? ((m.boosts && m.boosts[b]) || 0) / 6 : 0;
        x[k++] = S && /-mega/i.test(String(m.species)) ? 1 : 0;
        x[k++] = megaCapable(row);
        x[k++] = S && row.item && !m.item ? 1 : 0;
        x[k++] = S && m.item && toID(row.item) !== m.item ? 1 : 0;
        for (const vo of VOLS) x[k++] = L && m.vol && m.vol[vo] ? +m.vol[vo] : 0;
        x[k++] = L ? Math.min(3, m.protectN || 0) / 3 : 0;
        x[k++] = L ? protectOk(m.protectN || 0) : 1;
        x[k++] = L && t.active && (m.turnsOut | 0) === 0 ? 1 : 0;
        x[k++] = L && t.active ? Math.min(5, m.turnsOut | 0) / 5 : 0;
        const pp = S && m.pp ? m.pp : [1, 1, 1, 1];
        x[k++] = Math.min(...pp.concat([1]));
        x[k++] = pp.some(q => q <= 0) ? 1 : 0;
        const sp = spe[sd][t.i] || 0;
        x[k++] = sp > 0 ? Math.log1p(sp) / 6 : 0;
        x[k++] = t.active && sp > 0 ? actSpe.filter(q => q > sp).length / 3 : 0;
        const d = desc(S && m.species ? m.species : row.species);
        for (const q of d) x[k++] = q;
        for (const q of tf[sd][t.i]) x[k++] = q;
        tok.push(x);
        ids.push([toID(row.species_id || row.species), toID(S ? (m.item || '') : row.item), toID(S && m.ability ? m.ability : row.ability), ...[0, 1, 2, 3].map(j => toID((row.moves || [])[j]))]);
        mvw.push([0, 1, 2, 3].map(j => ((row.moves || [])[j] ? (pp[j] > 0 ? 1 : 0.25) : 0)));
        if (S && !t.alive) fainted++;
        if (t.active) actives++;
        if (L) { alive++; hpSum += m.hp / 100; }
      }
      alive += v.unseenBrought; hpSum += v.unseenBrought;
      const c = side.conds;
      out.side[sd] = [c.tailwindLeft > 0 ? 1 : 0, c.tailwindLeft / 4,
        ...SCREENS.map(s => (c.screens[s] > 0 ? 1 : 0)), ...SCREENS.map(s => (c.screens[s] || 0) / 8),
        ...HAZARDS.map(h => Math.min(3, c.hazards[h] || 0) / 3), side.megaUsed ? 1 : 0, alive / 4, hpSum / 4, fainted / 4, v.seen / 6, actives / 2, v.unseenBrought / 4];
      out.tok[sd] = tok; out.ids[sd] = ids; out.mvw[sd] = mvw;
      agg[sd] = { alive, hpSum };
    }
    const f = H.field, n = H.turn || 1;
    out.field = [...WEATHERS.map(w => (f.weather === w ? 1 : 0)), (f.weatherLeft || 0) / 8, ...TERRAINS.map(t => (f.terrain === t ? 1 : 0)), (f.terrainLeft || 0) / 8,
      f.trLeft > 0 ? 1 : 0, (f.trLeft || 0) / 5, f.gravity > 0 ? 1 : 0, Math.min(2, n / 10), n === 1 ? 1 : 0, n === 2 ? 1 : 0, n === 3 ? 1 : 0,
      n >= 4 && n <= 5 ? 1 : 0, n >= 6 && n <= 8 ? 1 : 0, n >= 9 ? 1 : 0];
    out.base = [(agg.p1.alive - agg.p2.alive) / 4, (agg.p1.hpSum - agg.p2.hpSum) / 4];
    return out;
  }

  return { fromEngine, fromDataset, encode, COUNTERS, BROKEN: BREAK || null, protectOk };
}

module.exports = { create, TOK_NUM_NAMES, TOK_ID_NAMES, SIDE_NUM_NAMES, FIELD_NUM_NAMES, FACT_NAMES, TFACT_NAMES, FEATURE_VERSION, BREAK };
