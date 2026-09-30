/* solver/chomp/v2/features.js — CHOMP v2's cell features: v1's engine facts at a PER-SET SPREAD, plus a FIELD block.
 *
 *   const FX = require('./solver/chomp/v2/features.js').create(API, { spreads, mode });
 *     spreads  { spreadOf(row) -> { evs:{hp,atk,def,spa,spd,spe}, source } | null }   (solver/chomp/v2/spreads.js);
 *              ignored when mode.spread === 'flat'
 *     mode     { spread: 'flat' | 'set', field: true | false }
 *   const F = FX.pairFacts(sheets)          sheets = { p1:[6 rows], p2:[6 rows] }
 *   FX.side(F, 'p1', a, b, out?)            Float64Array(G_DIM): v1's 22 (same names, same order) then the FIELD block
 *   FX.G_NAMES, FX.G_DIM, FX.V1_DIM, FX.COUNTERS
 *
 * WHAT IS THE SAME AS v1 (solver/chomp/v1/features.js). The 22 cell aggregates, their order and their arithmetic, the
 * mega forme read from the dex item, the move loop (`dmgRange` x `hitProb`, capped at 1), KO max/min roll, sure 2HKO,
 * priority KO. With mode { spread: 'flat', field: false } the first 22 entries are v1's features BIT FOR BIT; the row
 * builder (build_rows.js) asserts that on every row against v1's own rows file.
 *
 * SPREAD ('set'). v1 fights every body at the engine table's own stat line for its species (buildMon's `st`; the arena
 * does the same, solver/arena/teams.js). Here each body's stats are REPLACED by its set's spread under the sheet's own
 * nature: the engine's stat formula `spreadL50(bs, sp, nature)` (engine/medicham2-browser.js, exported) on the body's
 * battle forme, and HP = the base line (no nature) + the HP Stat Points, because Champions' statModify adds SP to HP and
 * spreadL50 has no HP term by design (its header says the caller adds it). A mega's HP is its sheet species' (the sim
 * fixes max HP at build). A set with no spread (spreadOf returns null, or no nature) keeps the table line and is
 * COUNTED (`spreadMissing`) — never silently.
 *
 * FIELD (mode.field). What each sheet member can set is READ FROM THE TAGS the release's engine reads
 * (globalThis.ABRA_TAG_LOOKUP): an ability's `weatherSetter` / `terrainSetter` (the sheet ability, and the mega forme's
 * ability when the member holds its stone), a move's `setsWeather` / `setsTerrain` (normalised by the engine's own
 * `weatherId` / `terrainId`), `reversesSpeed` (a room that inverts the speed key) and `doublesSideSpeed` (a side speed
 * doubler). No move, ability or weather is named in this file. WHO BENEFITS is not a list either: every fact is
 * RECOMPUTED by MEDICHAM under that field — damage by `dmgRange` with the field's weather and terrain, speed by
 * `effSpeed` (the side's doubler, weather-speed abilities) ordered by `compareTurnOrder` (which inverts under the room).
 *
 * An option's field: the weather its brought four can set (if two kinds: the one a LEAD's ability sets; else the kind
 * with more setters in the four; else the lower sheet index), the same for terrain, whether it can set the room, and
 * whether it can set the doubler. Field features (per side, option a against b):
 *   f_can_weather f_can_terrain f_can_room f_can_tw   my four can set it (0/1)
 *   f_lead_auto        a lead's ability sets weather or terrain on entry (0/1)
 *   f_cov_my  f_ko_my  f_inc_my        my coverage, my KO coverage, THEIR coverage of my four — under MY weather+terrain
 *   f_cov_th  f_ko_th  f_inc_th        the same under THEIR weather+terrain
 *   f_fast_myw f_fast_thw              my speed-order mean under my / their weather+terrain (weather-speed abilities)
 *   f_fast_myroom f_fast_throom        my speed-order mean under the room if I / they can set it
 *   f_fast_mytw f_fast_thtw            my speed-order mean under my / their doubler if I / they can set it
 *   f_fastko_myctl                     my fast-KO coverage under my speed control (doubler if I have one, else the room
 *                                      if I have it) and my weather+terrain
 * Where a side cannot set a thing, the feature takes its NEUTRAL value (the same fact on the neutral field), so a
 * feature is "the fact under the field that could be up", never a code.
 *
 * DELIBERATE BREAK (env CHOMP2_BREAK=field): the field is built but never applied (every field fact is the neutral
 * fact). The FIELD clause of solver/tests/test-chomp2.js must go red.
 */
'use strict';
const O = require('../options.js');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.CHOMP2_BREAK) || '';

const V1_NAMES = ['cov_mean', 'cov_min', 'ko_cov', 'fastko_cov', 'sko_cov', 'pko_cov', 'dmg_mean', 'fast_mean', 'h2_cov',
  'lead_dmg', 'lead_ko', 'lead_fastko', 'lead_fast', 'lead_best', 'lead_cov_four',
  'mega_any', 'mega_two', 'mega_lead',
  'sheet_cov_mean', 'sheet_ko_cov', 'sheet_fast_mean', 'sheet_dmg_mean'];
const FIELD_NAMES = ['f_can_weather', 'f_can_terrain', 'f_can_room', 'f_can_tw', 'f_lead_auto',
  'f_cov_my', 'f_ko_my', 'f_inc_my', 'f_cov_th', 'f_ko_th', 'f_inc_th',
  'f_fast_myw', 'f_fast_thw', 'f_fast_myroom', 'f_fast_throom', 'f_fast_mytw', 'f_fast_thtw', 'f_fastko_myctl'];
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const KEYS = ['d', 'ko', 'sko', 'h2', 'fast', 'pko'];

function create(API, opts) {
  opts = opts || {};
  const mode = Object.assign({ spread: 'flat', field: false }, opts.mode || {});
  const G_NAMES = mode.field ? V1_NAMES.concat(FIELD_NAMES) : V1_NAMES.slice();
  const G_DIM = G_NAMES.length;
  const M = API.M;
  const T = require('../../arena/teams.js');
  const DX = require('../../human/dex.js').D;
  const MC = globalThis.MC;
  const TG = globalThis.ABRA_TAG_LOOKUP;
  if (!MC || !MC.moves) throw new Error('chomp/v2/features: the engine table (globalThis.MC) is not loaded');
  if (mode.field && (!TG || typeof TG.param !== 'function')) throw new Error('chomp/v2/features: the engine tag lookup (globalThis.ABRA_TAG_LOOKUP) is not loaded');
  if (mode.spread === 'set' && (!opts.spreads || typeof opts.spreads.spreadOf !== 'function')) throw new Error('chomp/v2/features: mode.spread "set" needs a spreads source');
  const SPREAD = M.MEDI_SPREAD;
  const COUNTERS = { pairFacts: 0, bodies: 0, megaBodies: 0, spreadApplied: 0, spreadMissing: 0, hitCalls: 0, hitMemo: 0, cells: 0,
    fieldSpecs: 0, setters: { weather: 0, terrain: 0, room: 0, tw: 0 } };
  const NEUTRAL = { w: '', t: '', room: 0, twA: 0, twB: 0 };
  const fieldOf = spec => ({ weather: spec.w || null, weatherT: spec.w ? 5 : 0, terrain: spec.t || '', terrainT: spec.t ? 5 : 0,
    twA: spec.twA ? 4 : 0, twB: spec.twB ? 4 : 0, tr: spec.room ? 5 : 0, gravity: 0, fairylock: 0, sgA: {}, sgB: {} });
  const specKey = s => [s.w || '-', s.t || '-', s.room ? 1 : 0, s.twA ? 1 : 0, s.twB ? 1 : 0].join('/');

  const megaCache = new Map();
  function megaForme(row) {
    const k = toID(row.item) + '|' + toID(row.species);
    if (megaCache.has(k)) return megaCache.get(k);
    const it = row.item ? DX.items.get(toID(row.item)) : null, sp = DX.species.get(toID(row.species));
    let f = null;
    if (it && it.exists && it.megaStone && sp && sp.exists) {
      if (typeof it.megaStone === 'string') { if (it.megaEvolves === sp.name || it.megaEvolves === sp.baseSpecies) f = it.megaStone; }
      else f = it.megaStone[sp.name] || it.megaStone[sp.baseSpecies] || null;
    }
    const fs = f ? DX.species.get(toID(f)) : null;
    const r = fs && fs.exists ? { species: fs.name, ability: Object.values(fs.abilities || {})[0] || null } : null;
    megaCache.set(k, r);
    return r;
  }
  /* the body's stats at the set's spread: the engine's formula on the battle forme; HP from the sheet species */
  function applySpread(b, row) {
    const z = opts.spreads.spreadOf(row);
    if (!z || !z.evs || !row.nature) { COUNTERS.spreadMissing++; b._spread = 'table'; return; }
    const bsB = MC.mons[b.name] && MC.mons[b.name].bs;
    const sheetBody = T.buildBody(M, row);
    const bsS = sheetBody && MC.mons[sheetBody.name] && MC.mons[sheetBody.name].bs;
    if (!bsB || !bsS) { COUNTERS.spreadMissing++; b._spread = 'table'; return; }
    const e = z.evs;
    const st = M.spreadL50(bsB, { at: e.atk, df: e.def, sa: e.spa, sd: e.spd, sp: e.spe }, row.nature);
    st.hp = M.spreadL50(bsS, null, row.nature).hp + (+e.hp || 0);
    b.st = st; b._spread = z.source || 'set';
    COUNTERS.spreadApplied++;
  }
  const bodyCache = new Map();
  function body(row) {
    const key = JSON.stringify([row.species, row.item, row.ability, row.moves, mode.spread === 'set' ? row.nature : null]);
    if (bodyCache.has(key)) return bodyCache.get(key);
    const mf = megaForme(row);
    let b = mf ? T.buildBody(M, Object.assign({}, row, { species: mf.species, ability: mf.ability })) : null;
    if (b) COUNTERS.megaBodies++;
    if (!b) b = T.buildBody(M, row);
    if (!b) throw new Error('chomp/v2/features: ' + row.species + ' does not build');
    if (mode.spread === 'set') applySpread(b, row);
    b.curHP = b.st.hp; b.status = ''; b.boosts = { at: 0, df: 0, sa: 0, sd: 0, sp: 0, acc: 0, eva: 0 }; b.fainted = false;
    b._key = key; b._mega = !!mf;
    b._sets = mode.field ? setterOf(row, b, mf) : null;
    COUNTERS.bodies++;
    bodyCache.set(key, b);
    return b;
  }
  /* what one member can put up, from the tags; `auto` = its ability does it on entry */
  function setterOf(row, b, mf) {
    const s = { weather: [], terrain: [], autoW: '', autoT: '', room: 0, tw: 0 };
    const abs = [toID(row.ability)]; if (mf && mf.ability) abs.push(toID(mf.ability));
    for (const ab of abs) {
      const w = TG.param('ability', ab, 'weatherSetter'); if (w && w.weather) { const id = M.weatherId(w.weather); if (id) { s.weather.push(id); if (!s.autoW) s.autoW = id; } }
      const t = TG.param('ability', ab, 'terrainSetter'); if (t && t.terrain) { const id = M.terrainId(t.terrain); if (id) { s.terrain.push(id); if (!s.autoT) s.autoT = id; } }
    }
    for (const mv of b.moves || []) {
      const w = TG.param('move', mv, 'setsWeather'); if (w && w.weather) { const id = M.weatherId(w.weather); if (id) s.weather.push(id); }
      const t = TG.param('move', mv, 'setsTerrain'); if (t && t.terrain) { const id = M.terrainId(t.terrain); if (id) s.terrain.push(id); }
      if (TG.has('move', mv, 'reversesSpeed')) s.room = 1;
      if (TG.has('move', mv, 'doublesSideSpeed')) s.tw = 1;
    }
    s.weather = [...new Set(s.weather)]; s.terrain = [...new Set(s.terrain)];
    if (s.weather.length) COUNTERS.setters.weather++; if (s.terrain.length) COUNTERS.setters.terrain++;
    if (s.room) COUNTERS.setters.room++; if (s.tw) COUNTERS.setters.tw++;
    return s;
  }
  /* i's best hit on j and the speed order, from full HP, under one field spec; memoised on the two bodies and the spec */
  /* the damage half depends only on the weather and the terrain; the speed half on the whole spec and the sides */
  const hitMemo = new Map(), dmgMemo = new Map();
  function hit(a, d, sa, sd, spec) {
    const sk = specKey(spec);
    const k = a._key + '>' + d._key + '@' + sk + (sa === 'A' ? '' : '#B');
    const m = hitMemo.get(k);
    if (m) { COUNTERS.hitMemo++; return m; }
    const field = fieldOf(spec);
    const dk = a._key + '>' + d._key + '@' + (spec.w || '-') + '/' + (spec.t || '-');
    let D = dmgMemo.get(dk);
    if (!D) { COUNTERS.hitCalls++; D = damage(a, d, fieldOf({ w: spec.w, t: spec.t })); dmgMemo.set(dk, D); }
    const va = M.effSpeed(a, field, sa), vd = M.effSpeed(d, field, sd);
    let fast;
    if (sk === specKey(NEUTRAL)) fast = va === vd ? 0.5 : va > vd ? 1 : 0;       // v1's exact expression
    else { const c = M.compareTurnOrder({ spe: va }, { spe: vd }, field); fast = c < 0 ? 1 : c > 0 ? 0 : 0.5; }
    const out = Object.assign({ fast }, D);
    hitMemo.set(k, out);
    return out;
  }
  function damage(a, d, field) {
    let exp = 0, maxR = 0, minR = 0, pko = 0;
    for (const id of a.moves || []) {
      const mv = MC.moves[id];
      if (!mv) continue;
      let r; try { r = M.dmgRange(a, d, mv, field, SPREAD.has(id)); } catch (e) { r = null; }
      if (!r || !(r.max > 0)) continue;
      let acc = 1; try { acc = M.hitProb(a, d, id, field); } catch (e) { acc = 1; }
      const e = (r.min + r.max) / 2 * acc;
      if (e > exp) exp = e;
      if (r.max > maxR) maxR = r.max;
      if (r.min > minR) minR = r.min;
      if (r.max >= d.curHP && M.movePriority(id, field) > 0) pko = 1;
    }
    const hp = d.curHP;
    return { d: Math.min(1, exp / hp), ko: maxR >= hp ? 1 : 0, sko: minR >= hp ? 1 : 0, h2: 2 * minR >= hp ? 1 : 0, pko };
  }
  /* the 6 x 6 facts of side s on side o under a spec, memoised per pair of sheets */
  function facts(F, s, spec) {
    const sk = s + '@' + specKey(BREAK === 'field' ? NEUTRAL : spec);
    if (F.cache.has(sk)) return F.cache.get(sk);
    COUNTERS.fieldSpecs++;
    const o = s === 'p1' ? 'p2' : 'p1', ss = s === 'p1' ? 'A' : 'B', so = s === 'p1' ? 'B' : 'A';
    const sp = BREAK === 'field' ? NEUTRAL : spec;
    const X = {}; for (const k of KEYS) X[k] = [];
    const fill = () => {
      for (let i = 0; i < 6; i++) {
        for (const k of KEYS) X[k].push(new Float64Array(6));
        for (let j = 0; j < 6; j++) { const h = hit(F.bod[s][i], F.bod[o][j], ss, so, sp); for (const k of KEYS) X[k][i][j] = h[k]; }
      }
    };
    /* the engine's lean binding (the same tag answers from a lookup table, no instrument; engine/medicham_api.js
     * leanRun) roughly halves a dmgRange call. build_rows.js holds the neutral half equal to v1's rows either way. */
    if (opts.lean !== false && typeof M.leanRun === 'function') M.leanRun(fill); else fill();
    F.cache.set(sk, X);
    return X;
  }

  function pairFacts(sheets) {
    if (!sheets || !sheets.p1 || !sheets.p2 || sheets.p1.length !== 6 || sheets.p2.length !== 6) throw new Error('chomp/v2/features: two six-member sheets are required');
    COUNTERS.pairFacts++;
    const bod = { p1: sheets.p1.map(body), p2: sheets.p2.map(body) };
    const F = { bod, cache: new Map(), sp: { p1: sheets.p1.map(r => toID(r.species_id || r.species)), p2: sheets.p2.map(r => toID(r.species_id || r.species)) },
                mega: { p1: bod.p1.map(b => b._mega ? 1 : 0), p2: bod.p2.map(b => b._mega ? 1 : 0) } };
    F.p1 = facts(F, 'p1', NEUTRAL); F.p2 = facts(F, 'p2', NEUTRAL);
    F.sheet = {};
    for (const s of ['p1', 'p2']) {
      const X = F[s];
      let cov = 0, ko = 0, fast = 0, dm = 0;
      for (let j = 0; j < 6; j++) { let m = 0, k = 0; for (let i = 0; i < 6; i++) { if (X.d[i][j] > m) m = X.d[i][j]; if (X.ko[i][j]) k = 1; fast += X.fast[i][j]; dm += X.d[i][j]; } cov += m; ko += k; }
      F.sheet[s] = [cov / 6, ko / 6, fast / 36, dm / 36];
    }
    return F;
  }

  /* an option's field: { w, t, room, tw, auto } from its brought four A and leads LA */
  function optionField(F, s, A, LA) {
    const B = F.bod[s];
    const pick = (kind, auto) => {
      const cnt = new Map(), first = new Map();
      for (const i of A) for (const x of B[i]._sets[kind]) { cnt.set(x, (cnt.get(x) || 0) + 1); if (!first.has(x)) first.set(x, i); }
      if (!cnt.size) return '';
      for (const i of LA) if (B[i]._sets[auto]) return B[i]._sets[auto];
      return [...cnt.keys()].sort((x, y) => cnt.get(y) - cnt.get(x) || first.get(x) - first.get(y))[0];
    };
    let room = 0, tw = 0, auto = 0;
    for (const i of A) { if (B[i]._sets.room) room = 1; if (B[i]._sets.tw) tw = 1; }
    for (const i of LA) if (B[i]._sets.autoW || B[i]._sets.autoT) auto = 1;
    return { w: pick('weather', 'autoW'), t: pick('terrain', 'autoT'), room, tw, auto };
  }
  const covOf = (X, A, B) => { let cov = 0, ko = 0; for (const j of B) { let m = 0, k = 0; for (const i of A) { if (X.d[i][j] > m) m = X.d[i][j]; if (X.ko[i][j]) k = 1; } cov += m; ko += k; } return [cov / 4, ko / 4]; };
  const fastOf = (X, A, B) => { let f = 0; for (const i of A) for (const j of B) f += X.fast[i][j]; return f / 16; };
  const fastKoOf = (X, A, B) => { let c = 0; for (const j of B) { let k = 0; for (const i of A) if (X.ko[i][j] && X.fast[i][j] === 1) k = 1; c += k; } return c / 4; };

  function side(F, s, a, b, out) {
    out = out || new Float64Array(G_DIM);
    COUNTERS.cells++;
    const X = F[s];
    const oa = O.OPTIONS[a], ob = O.OPTIONS[b];
    const A = oa.order, B = ob.order;
    const LA = oa.leads, LB = ob.leads;
    let covSum = 0, covMin = 1, koC = 0, fkC = 0, skC = 0, pkC = 0, h2C = 0, dm = 0, fs = 0;
    for (const j of B) {
      let m = 0, k = 0, fk = 0, sk = 0, pk = 0, h2 = 0;
      for (const i of A) {
        const d = X.d[i][j];
        if (d > m) m = d;
        if (X.ko[i][j]) { k = 1; if (X.fast[i][j] === 1) fk = 1; }
        if (X.sko[i][j]) sk = 1;
        if (X.pko[i][j]) pk = 1;
        if (X.h2[i][j]) h2 = 1;
        dm += d; fs += X.fast[i][j];
      }
      covSum += m; if (m < covMin) covMin = m; koC += k; fkC += fk; skC += sk; pkC += pk; h2C += h2;
    }
    let ld = 0, lk = 0, lfk = 0, lf = 0, lb = 0;
    for (const i of LA) for (const j of LB) {
      const d = X.d[i][j]; ld += d; if (d > lb) lb = d;
      if (X.ko[i][j]) { lk++; if (X.fast[i][j] === 1) lfk++; }
      lf += X.fast[i][j];
    }
    let lc = 0;
    for (const j of B) { let m = 0; for (const i of LA) if (X.d[i][j] > m) m = X.d[i][j]; lc += m; }
    const mg = F.mega[s];
    let megaN = 0; for (const i of A) megaN += mg[i];
    const megaLead = mg[LA[0]] || mg[LA[1]] ? 1 : 0;
    const sh = F.sheet[s];
    out[0] = covSum / 4; out[1] = covMin; out[2] = koC / 4; out[3] = fkC / 4; out[4] = skC / 4; out[5] = pkC / 4; out[6] = dm / 16; out[7] = fs / 16; out[8] = h2C / 4;
    out[9] = ld / 4; out[10] = lk / 4; out[11] = lfk / 4; out[12] = lf / 4; out[13] = lb; out[14] = lc / 4;
    out[15] = megaN >= 1 ? 1 : 0; out[16] = megaN >= 2 ? 1 : 0; out[17] = megaLead;
    out[18] = sh[0]; out[19] = sh[1]; out[20] = sh[2]; out[21] = sh[3];
    if (!mode.field) return out;

    /* ---- the FIELD block ---- */
    const o = s === 'p1' ? 'p2' : 'p1';
    const mine = optionField(F, s, A, LA), theirs = optionField(F, o, B, LB);
    const mySide = s === 'p1' ? 'twA' : 'twB', thSide = s === 'p1' ? 'twB' : 'twA';
    const wtMy = { w: mine.w, t: mine.t }, wtTh = { w: theirs.w, t: theirs.t };
    const Xmy = facts(F, s, wtMy), Omy = facts(F, o, wtMy);          // me on them, them on me, under MY weather+terrain
    const Xth = facts(F, s, wtTh), Oth = facts(F, o, wtTh);
    const [cMy, kMy] = covOf(Xmy, A, B), [iMy] = covOf(Omy, B, A);
    const [cTh, kTh] = covOf(Xth, A, B), [iTh] = covOf(Oth, B, A);
    const Xroom = spec => facts(F, s, spec);
    const fRoomMy = mine.room ? fastOf(Xroom({ room: 1 }), A, B) : out[7];
    const fRoomTh = theirs.room ? fastOf(Xroom({ room: 1 }), A, B) : out[7];
    const fTwMy = mine.tw ? fastOf(Xroom({ [mySide]: 1 }), A, B) : out[7];
    const fTwTh = theirs.tw ? fastOf(Xroom({ [thSide]: 1 }), A, B) : out[7];
    const ctl = Object.assign({}, wtMy, mine.tw ? { [mySide]: 1 } : mine.room ? { room: 1 } : {});
    const k = G_NAMES.indexOf('f_can_weather');
    out[k] = mine.w ? 1 : 0; out[k + 1] = mine.t ? 1 : 0; out[k + 2] = mine.room; out[k + 3] = mine.tw; out[k + 4] = mine.auto;
    out[k + 5] = cMy; out[k + 6] = kMy; out[k + 7] = iMy; out[k + 8] = cTh; out[k + 9] = kTh; out[k + 10] = iTh;
    out[k + 11] = fastOf(Xmy, A, B); out[k + 12] = fastOf(Xth, A, B);
    out[k + 13] = fRoomMy; out[k + 14] = fRoomTh; out[k + 15] = fTwMy; out[k + 16] = fTwTh;
    out[k + 17] = fastKoOf(facts(F, s, ctl), A, B);
    return out;
  }

  return { pairFacts, side, facts, optionField, megaForme, body, G_NAMES, G_DIM, V1_DIM: V1_NAMES.length, COUNTERS, mode, BROKEN: BREAK || null };
}

module.exports = { create, V1_NAMES, FIELD_NAMES };
