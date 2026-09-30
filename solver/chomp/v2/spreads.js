/* solver/chomp/v2/spreads.js — the per-set Stat Point spread CHOMP v2's facts are computed at.
 *
 *   const S = require('./solver/chomp/v2/spreads.js');
 *   const D = S.deriver(API, pop)            pop = SP.population(...) output, or a saved one (S.loadPopulation)
 *   D.spreadFor(row)                          -> { evs, source, role, ... }   (solver/rotom/spreads.js's rule)
 *   const src = S.table(file)                 a precomputed { setKey: spread } table -> { spreadOf(row), provenance }
 *   S.populationOf(storeFile)                 the top-meta population of a store (solver/rotom/build_top_rotation.js)
 *
 * THE RULE IS solver/rotom/spreads.js's AND IS NOT RE-WRITTEN HERE. The observed hook (a Reg M-C Smogon moveset file,
 * `findObserved`/`observedSpread`), the role (Choice Scarf or the side speed doubler -> Speed at the cap; the room ->
 * Speed 0), the speed benchmark, the bulk rule (least HP/Def/SpD SP that survives the weighted median top-meta
 * attacker's best hit), the attack and the remainder: every one of those is the base class's method, inherited.
 *
 * WHAT IS REPLACED IS ONLY THE TWO TABLE ORACLES, and only for cost. The base class stages a real Showdown battle per
 * (defending set, population attacker) and calls the sim's getDamage 33 x moves times in each: measured 2026-09-30 at
 * 33.7 s per set on the frozen pool's population (15 sets; 310 battles and ~23,000 damage calls each). CHOMP's rows
 * hold ~10^4 distinct sets, so that is days. Here the two tables come from MEDICHAM on the caller's release:
 *   speeds(row)  effective speed at Speed SP 0..32: `spreadL50` on the battle forme, then `effSpeed` on a neutral field
 *                (the sim's getActionSpeed in the base class: item, mega forme, ability)
 *   hits(row)    per population attacker, its max-roll damage table over the defending stat's SP 0..32 (`dmgRange`, no
 *                crit, the attacker at the cap in its attacking stat with its own nature, spread moves at the spread
 *                modifier, multi-hit as the engine plans it), and whether the defender's item or ability survives any
 *                hit from full (the `survivesFromFull` tag the engine itself reads)
 * The MEDICHAM gate is open on this release, so the two oracles answer the same questions as the sim; `agreement()`
 * below measures that on a sample instead of assuming it, and the build records the figure.
 *
 * EXACT SHORTCUT, NOT AN APPROXIMATION. A stat table is only ever compared as `damage < HP`, and damage never rises as
 * the defending stat rises. So if a table's value at SP 0 is already below the lowest HP the rule can reach, every
 * entry would be survived and the table is filled with the SP-0 value; if its value at SP 32 is at or above the highest
 * HP, no entry is survived and it is filled with the SP-32 value. Every comparison bestBulk makes comes out the same.
 * Counted (`tablesShortcut`, `tablesFull`).
 *
 * Cached per DEFENDING body (battle forme, item, ability, nature): the defender's moves change its role, never the
 * damage it takes.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SPR = require('../../rotom/spreads.js');
const T = require('../../arena/teams.js');
const X = require('../../human/dex.js');
const toID = X.toID;
const N = SPR.SP_CAP + 1;
const NEUTRAL = () => ({ weather: null, weatherT: 0, terrain: '', terrainT: 0, twA: 0, twB: 0, tr: 0, gravity: 0, fairylock: 0, sgA: {}, sgB: {} });
const STAT_KEY = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp' };

class MediDeriver extends SPR.Deriver {
  /* opts.API is read inside speeds(), which the base constructor calls (speedEquilibrium) */
  M() { return this.opts.API.M; }
  mediBody(row, sp) {
    const M = this.M(), f = SPR.forme(row);
    let b = f.mega ? T.buildBody(M, Object.assign({}, row, { species: f.species, ability: f.ability })) : null;
    if (!b) b = T.buildBody(M, row);
    if (!b) return null;
    const bs = globalThis.MC.mons[b.name] && globalThis.MC.mons[b.name].bs;
    const base = T.buildBody(M, row), bsS = base && globalThis.MC.mons[base.name] && globalThis.MC.mons[base.name].bs;
    if (!bs || !bsS) return null;
    const e = Object.assign({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, sp || {});
    b.st = M.spreadL50(bs, { at: e.atk, df: e.def, sa: e.spa, sd: e.spd, sp: e.spe }, row.nature);
    b.st.hp = M.spreadL50(bsS, null, row.nature).hp + e.hp;
    b.curHP = b.st.hp; b.status = ''; b.boosts = { at: 0, df: 0, sa: 0, sd: 0, sp: 0, acc: 0, eva: 0 }; b.fainted = false;
    b._bs = bs;
    return b;
  }
  defKey(row) { const f = SPR.forme(row); return [f.species, toID(row.item), toID(row.ability), toID(row.nature)].join('|'); }
  speeds(row) {
    const k = this.defKey(row);
    if (this._spe.has(k)) return this._spe.get(k);
    const M = this.M(), b = this.mediBody(row, null);
    this.counters.medi_bodies = (this.counters.medi_bodies || 0) + 1;
    const eff = [];
    for (let v = 0; v < N; v++) {
      if (!b) { eff.push(0); continue; }
      b.st.sp = M.spreadL50(b._bs, { sp: v }, row.nature).sp;
      eff.push(M.effSpeed(b, NEUTRAL(), 'A'));
    }
    this._spe.set(k, eff);
    return eff;
  }
  hits(row) {
    const k = this.defKey(row);
    if (this._hits.has(k)) return this._hits.get(k);
    const M = this.M(), MC = globalThis.MC, TG = globalThis.ABRA_TAG_LOOKUP;
    const field = NEUTRAL();
    const d = this.mediBody(row, null);
    const out = [];
    const f = SPR.forme(row);
    const endures = !!(d && (TG.param('item', d.item, 'survivesFromFull') || TG.param('ability', d.ability, 'survivesFromFull')));
    /* the HP range the rule can reach: SP 0 .. the cap (bestBulk compares damage < hpv[h]) */
    const hpLo = d ? d.st.hp : 0, hpHi = d ? d.st.hp + SPR.SP_CAP : 0;
    if (endures) this.counters.endures++;
    for (const a of this.uniq) {
      const as = SPR.attackStat(a.row);
      if (!as || !d) { out.push({ w: a.w, none: true }); continue; }
      const att = this._att.get(a.key) || (() => { const sp = {}; sp[as] = SPR.SP_CAP; const x = this.mediBody(a.row, sp); this._att.set(a.key, x); return x; })();
      if (!att) { out.push({ w: a.w, none: true }); continue; }
      const tables = { def: new Array(N).fill(0), spd: new Array(N).fill(0) };
      const byStat = { def: [], spd: [] };
      for (const mvName of a.row.moves) {
        const m = X.D.moves.get(mvName);
        if (!m.exists || m.category === 'Status' || m.ohko) continue;
        const mv = MC.moves[m.id]; if (!mv) continue;
        byStat[m.overrideDefensiveStat || (m.category === 'Physical' ? 'def' : 'spd')].push(m.id);
      }
      let any = false;
      const dmgAt = (which, v) => {
        d.st[STAT_KEY[which]] = M.spreadL50(d._bs, { [STAT_KEY[which]]: v }, row.nature)[STAT_KEY[which]];
        let mx = 0;
        for (const id of byStat[which]) {
          let r = null; try { r = M.dmgRange(att, d, MC.moves[id], field, M.MEDI_SPREAD.has(id)); } catch (e) { r = null; }
          this.counters.damage_calls++;
          if (r && r.max > mx) mx = r.max;
        }
        return mx;
      };
      for (const which of ['def', 'spd']) {
        if (!byStat[which].length) continue;
        const save = d.st[STAT_KEY[which]];
        const lo = dmgAt(which, 0);
        if (lo > 0) any = true;
        if (lo < hpLo) { tables[which].fill(lo); this.counters.tablesShortcut = (this.counters.tablesShortcut || 0) + 1; }
        else {
          const hi = dmgAt(which, SPR.SP_CAP);
          if (hi >= hpHi) { tables[which].fill(hi); this.counters.tablesShortcut = (this.counters.tablesShortcut || 0) + 1; }
          else { tables[which][0] = lo; tables[which][N - 1] = hi; for (let v = 1; v < N - 1; v++) tables[which][v] = dmgAt(which, v); this.counters.tablesFull = (this.counters.tablesFull || 0) + 1; }
        }
        d.st[STAT_KEY[which]] = save;
      }
      if (!any) this.counters.no_damage++;
      out.push({ w: a.w, none: !any, t: tables });
    }
    const res = { list: out, endures, totalW: out.reduce((s, x) => s + x.w, 0), forme: f.species };
    this._hits.set(k, res);
    return res;
  }
}

/* the attacker-body cache is created lazily: the base constructor runs speeds() before a subclass field could be set */
Object.defineProperty(MediDeriver.prototype, '_att', {
  get() { if (!this.__att) this.__att = new Map(); return this.__att; },
  set(v) { this.__att = v; }, configurable: true,
});
function make(API, pop, opts) { return new MediDeriver(pop, Object.assign({}, opts || {}, { API })); }

/* the top-meta population of a store file (a plain .jsonl or a .jsonl.gz in the store's schema) */
function populationOf(storeFile) {
  const zlib = require('zlib');
  const B = require('../../rotom/build_top_rotation.js');
  const buf = fs.readFileSync(storeFile);
  const txt = /\.gz$/.test(storeFile) ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  const games = txt.split('\n').filter(Boolean).map(l => JSON.parse(l));
  const T0 = B.topSides(games);
  const pop = SPR.population(T0.top, B.rowOf);
  return { pop, floor: T0.FLOOR, store: storeFile, store_sha256: crypto.createHash('sha256').update(buf).digest('hex'), games: games.length };
}

/* a precomputed table: { provenance, spreads: { setKey: { evs, source, role } } } */
function table(file) {
  const J = JSON.parse(fs.readFileSync(file, 'utf8'));
  const C = { hits: 0, misses: 0 };
  return {
    spreadOf: row => { const z = J.spreads[SPR.setKey(row)]; if (z) C.hits++; else C.misses++; return z || null; },
    provenance: J.provenance, COUNTERS: C, size: Object.keys(J.spreads).length, file,
  };
}

/* the two oracles against the Showdown sim's, on a sample of sets: how often the derived spread is identical */
function agreement(sdDeriver, mediDeriver, rows) {
  let same = 0, speSame = 0, n = 0;
  const diffs = [];
  for (const r of rows) {
    const a = sdDeriver.spreadFor(r).evs, b = mediDeriver.spreadFor(r).evs;
    n++;
    const eq = SPR.evStr(a) === SPR.evStr(b);
    if (eq) same++; else if (diffs.length < 20) diffs.push({ set: SPR.setKey(r), showdown: SPR.evStr(a), medicham: SPR.evStr(b) });
    if (a.spe === b.spe) speSame++;
  }
  return { n, identical: same, speed_identical: speSame, diffs };
}

module.exports = { MediDeriver, make, populationOf, table, agreement, deriver: make };
