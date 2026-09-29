/* solver/chomp/v1/features.js — CHOMP v1's cell features: what one bring/lead option faces in another, read off MEDICHAM.
 *
 *   const FX = require('./solver/chomp/v1/features.js').create(API);
 *   const F  = FX.pairFacts(sheets)          sheets = { p1:[6 rows], p2:[6 rows] }; the 6 x 6 engine facts, both ways
 *   FX.side(F, 'p1', a, b, out?)             g(a|b): Float64Array(G_DIM), p1 playing option a against p2's option b
 *   FX.side(F, 'p2', b, a, out?)             g(b|a): the same from p2's chair
 *   FX.G_NAMES, FX.G_DIM, FX.COUNTERS
 *
 * THE FACTS ARE MEDICHAM'S (release-bound through the caller's API): for every ordered pair (my sheet member i, their
 * sheet member j) the best expected hit of i on j as a fraction of j's HP (`dmgRange` x `hitProb`, capped at 1), whether
 * i can KO j from full (max roll) and surely (min roll), whether i surely 2HKOs, whether i moves before j (`effSpeed`,
 * a tie is 1/2), and whether i has a priority KO. Bodies are built from the sheet at the table's flat spread
 * (solver/arena/teams.js buildBody). A member whose sheet item is its mega stone is read in its MEGA FORME (the forme
 * and its ability come from the Reg M-C dex, solver/human/dex.js), because that is the body it fights in; the "only
 * one mega" rule is carried by a count feature, not by the facts. The field is neutral: no weather, terrain, Trick
 * Room or Tailwind. A fact this file cannot compute (a body that does not build) is a THROW, never a zero.
 *
 * THE CELL FEATURES g(a|b) are aggregates of those facts over MY brought four (A) and leads (LA) against THEIR four (B)
 * and leads (LB), plus four sheet-versus-sheet aggregates over all 6 x 6 (constant inside one table: they help the
 * outcome prediction and cannot move a choice). Species identities are NOT here: the scorer adds them (bring and lead
 * values per species) from F.sp.
 *
 * DELIBERATE BREAK (env CHOMP1_BREAK=leads): the lead block reads the first two sheet members instead of the option's
 * leads, so every lead choice under one four looks the same. solver/tests/test-chomp1.js must go red.
 */
'use strict';
const O = require('../options.js');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.CHOMP1_BREAK) || '';

const G_NAMES = ['cov_mean', 'cov_min', 'ko_cov', 'fastko_cov', 'sko_cov', 'pko_cov', 'dmg_mean', 'fast_mean', 'h2_cov',
  'lead_dmg', 'lead_ko', 'lead_fastko', 'lead_fast', 'lead_best', 'lead_cov_four',
  'mega_any', 'mega_two', 'mega_lead',
  'sheet_cov_mean', 'sheet_ko_cov', 'sheet_fast_mean', 'sheet_dmg_mean'];
const G_DIM = G_NAMES.length;
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function create(API, opts) {
  opts = opts || {};
  const M = API.M;
  const T = require('../../arena/teams.js');
  const DX = require('../../human/dex.js').D;
  const MC = globalThis.MC;
  if (!MC || !MC.moves) throw new Error('chomp/v1/features: the engine table (globalThis.MC) is not loaded');
  const SPREAD = M.MEDI_SPREAD;
  const FIELD = () => ({ weather: null, weatherT: 0, terrain: '', terrainT: 0, twA: 0, twB: 0, tr: 0, gravity: 0, fairylock: 0, sgA: {}, sgB: {} });
  const COUNTERS = { pairFacts: 0, bodies: 0, megaBodies: 0, hitCalls: 0, hitMemo: 0, cells: 0 };

  /* the mega forme a sheet row fights in, or null: read from the dex item's megaStone (a map or a name) */
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
  const bodyCache = new Map();
  function body(row) {
    const key = JSON.stringify([row.species, row.item, row.ability, row.moves]);
    if (bodyCache.has(key)) return bodyCache.get(key);
    const mf = megaForme(row);
    let b = mf ? T.buildBody(M, Object.assign({}, row, { species: mf.species, ability: mf.ability })) : null;
    if (b) COUNTERS.megaBodies++;
    if (!b) b = T.buildBody(M, row);
    if (!b) throw new Error('chomp/v1/features: ' + row.species + ' does not build');
    b.curHP = b.st.hp; b.status = ''; b.boosts = { at: 0, df: 0, sa: 0, sd: 0, sp: 0, acc: 0, eva: 0 }; b.fainted = false;
    b._key = key; b._mega = !!mf;
    COUNTERS.bodies++;
    bodyCache.set(key, b);
    return b;
  }
  /* i's best hit on j, from full HP, on the neutral field; memoised on the two sheet rows */
  const hitMemo = new Map();
  function hit(a, d, sa, sd) {
    const k = a._key + '>' + d._key;
    const m = hitMemo.get(k);
    if (m) { COUNTERS.hitMemo++; return m; }
    COUNTERS.hitCalls++;
    const field = FIELD();
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
    const va = M.effSpeed(a, field, sa), vd = M.effSpeed(d, field, sd);
    const out = { d: Math.min(1, exp / hp), ko: maxR >= hp ? 1 : 0, sko: minR >= hp ? 1 : 0, h2: 2 * minR >= hp ? 1 : 0, fast: va === vd ? 0.5 : va > vd ? 1 : 0, pko };
    hitMemo.set(k, out);
    return out;
  }

  /* the 6 x 6 facts both ways. F.x.p1[i][j] = p1's member i on p2's member j; F.x.p2[j][i] = p2's j on p1's i */
  function pairFacts(sheets) {
    if (!sheets || !sheets.p1 || !sheets.p2 || sheets.p1.length !== 6 || sheets.p2.length !== 6) throw new Error('chomp/v1/features: two six-member sheets are required');
    COUNTERS.pairFacts++;
    const bod = { p1: sheets.p1.map(body), p2: sheets.p2.map(body) };
    const F = { p1: {}, p2: {}, sp: { p1: sheets.p1.map(r => toID(r.species_id || r.species)), p2: sheets.p2.map(r => toID(r.species_id || r.species)) },
                mega: { p1: bod.p1.map(b => b._mega ? 1 : 0), p2: bod.p2.map(b => b._mega ? 1 : 0) } };
    for (const [s, o, ss, so] of [['p1', 'p2', 'A', 'B'], ['p2', 'p1', 'B', 'A']]) {
      for (const k of ['d', 'ko', 'sko', 'h2', 'fast', 'pko']) F[s][k] = [];
      for (let i = 0; i < 6; i++) {
        for (const k of ['d', 'ko', 'sko', 'h2', 'fast', 'pko']) F[s][k].push(new Float64Array(6));
        for (let j = 0; j < 6; j++) {
          const h = hit(bod[s][i], bod[o][j], ss, so);
          for (const k of ['d', 'ko', 'sko', 'h2', 'fast', 'pko']) F[s][k][i][j] = h[k];
        }
      }
    }
    /* the sheet-versus-sheet block, per side */
    F.sheet = {};
    for (const s of ['p1', 'p2']) {
      const X = F[s];
      let cov = 0, ko = 0, fast = 0, dm = 0;
      for (let j = 0; j < 6; j++) { let m = 0, k = 0; for (let i = 0; i < 6; i++) { if (X.d[i][j] > m) m = X.d[i][j]; if (X.ko[i][j]) k = 1; fast += X.fast[i][j]; dm += X.d[i][j]; } cov += m; ko += k; }
      F.sheet[s] = [cov / 6, ko / 6, fast / 36, dm / 36];
    }
    return F;
  }

  /* g(a|b) for side s playing option a against option b */
  function side(F, s, a, b, out) {
    out = out || new Float64Array(G_DIM);
    COUNTERS.cells++;
    const X = F[s];
    const oa = O.OPTIONS[a], ob = O.OPTIONS[b];
    const A = oa.order, B = ob.order;
    const LA = BREAK === 'leads' ? [0, 1] : oa.leads, LB = ob.leads;
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
    return out;
  }

  return { pairFacts, side, megaForme, G_NAMES, G_DIM, COUNTERS, BROKEN: BREAK || null };
}

module.exports = { create, G_NAMES, G_DIM };
