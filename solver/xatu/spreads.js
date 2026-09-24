/* solver/xatu/spreads.js — the Stat Point belief.
 *
 * Spreads are not on the open sheet. The candidate set for a mon is every SP vector the format allows:
 * each stat 0..SP_CAP, total <= SP_TOTAL (both read from the format by sd.js). It is carried
 * FACTORISED: one alive-mask per stat, plus the budget as a coupling constraint. Observations prune it:
 *
 *   order  — A acted before B from the same priority bracket => actionSpeed(A) >= actionSpeed(B)
 *            at that instant (ties allowed: a tie is a coin, so either order is consistent).
 *   damage — the observed HP drop must be reachable by some roll for some alive (offence, defence, HP).
 *
 * Each constraint is enforced by ARC CONSISTENCY: a value survives iff some combination of the other
 * variables' alive values satisfies the constraint. That is SOUND — if the true spread was alive and the
 * constraint is modelled exactly, the true value always survives — but not complete (the product of
 * surviving marginals can still hold vectors no single world satisfies). The posterior over a stat is
 * uniform over its alive values; the prior is the uniform spread prior the plan names as the baseline
 * (the store holds no spreads to build anything better from: docs/_reports/2026-09-23-regmc-meta.md).
 *
 * An observation that would empty a domain is a CONTRADICTION. It is not applied (the belief must never
 * go empty) and it is recorded with everything needed to explain it.
 */
'use strict';
const SD = require('./sd.js');
const { SP_TOTAL, SP_CAP, statValue, hpBand, applySnapshot, setStats, actionPriority, actionSpeeds, damageRange, damageTable } = SD;

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const N = SP_CAP + 1;

function fullMask() { return new Uint8Array(N).fill(1); }
const minAlive = a => { for (let i = 0; i < N; i++) if (a[i]) return i; return -1; };
const maxAlive = a => { for (let i = N - 1; i >= 0; i--) if (a[i]) return i; return -1; };
const count = a => { let c = 0; for (let i = 0; i < N; i++) c += a[i]; return c; };

class MonDomain {
  constructor(known) {
    this.d = {};
    for (const s of STATS) {
      this.d[s] = fullMask();
      if (known && known[s] != null) { this.d[s].fill(0); this.d[s][known[s]] = 1; }
    }
  }
  clone() { const c = Object.create(MonDomain.prototype); c.d = {}; for (const s of STATS) c.d[s] = this.d[s].slice(); return c; }
  alive(s) { const o = []; const a = this.d[s]; for (let i = 0; i < N; i++) if (a[i]) o.push(i); return o; }
  mid() { const o = {}; for (const s of STATS) { const al = this.alive(s); o[s] = al[al.length >> 1]; } return o; }
  /* the budget: value v of stat s survives iff v + sum of the other stats' minima <= SP_TOTAL */
  budget() {
    const mins = {}; let tot = 0;
    for (const s of STATS) { mins[s] = minAlive(this.d[s]); tot += mins[s]; }
    if (tot > SP_TOTAL) return false;
    for (const s of STATS) {
      const cap = SP_TOTAL - (tot - mins[s]);
      for (let v = cap + 1; v < N; v++) this.d[s][v] = 0;
    }
    return true;
  }
  empty() { return STATS.some(s => minAlive(this.d[s]) < 0); }
  summary() { const o = {}; for (const s of STATS) { const al = this.alive(s); o[s] = [al[0], al[al.length - 1], al.length]; } return o; }
}

class SpreadBelief {
  /* sheets: {p1:[6], p2:[6]}; known: optional {p1:{idx:{hp,atk,...}}} for spreads we know (our own). */
  constructor(sheets, known) {
    this.sheets = sheets;
    this.ctx = new SD.Ctx(sheets);
    this.dom = {};
    for (const s of ['p1', 'p2']) this.dom[s] = sheets[s].map((_, i) => new MonDomain(known && known[s] && known[s][i]));
    for (const s of ['p1', 'p2']) for (const m of this.dom[s]) m.budget();
    this.contradictions = [];
    this.stats = { order_applied: 0, order_nonbinding: 0, order_anomaly: 0, damage_applied: 0, damage_null: 0, contradictions: 0 };
    this.anomalies = [];
    this.touched = new Set();      // side|idx|stat that at least one applied constraint involved
  }

  /* how far the applied constraints narrowed the stats they touched: alive values of 33, and bits */
  narrowing() {
    const rows = [];
    for (const k of this.touched) { const [s, i, st] = k.split('|'); rows.push({ s, i: +i, st, n: this.dom[s][+i].alive(st).length }); }
    const by = {};
    for (const r of rows) { const b = (by[r.st] = by[r.st] || { n: 0, alive: 0, narrowed: 0, bits: 0 }); b.n++; b.alive += r.n; if (r.n < N) b.narrowed++; b.bits += Math.log2(N / r.n); }
    for (const b of Object.values(by)) { b.mean_alive = +(b.alive / b.n).toFixed(2); b.frac_narrowed = +(b.narrowed / b.n).toFixed(4); b.mean_bits = +(b.bits / b.n).toFixed(3); }
    return by;
  }

  mids() { const o = {}; for (const s of ['p1', 'p2']) o[s] = this.dom[s].map(m => m.mid()); return o; }

  _battle(snap) {
    const actives = {};
    for (const s of ['p1', 'p2']) actives[s] = snap.sides[s].active.map(a => (a ? a.idx : null));
    const b = this.ctx.battleFor(actives);
    applySnapshot(b, snap, this.mids());
    return b;
  }
  _poke(b, snap, side, idx) {
    const k = snap.sides[side].active.findIndex(a => a && a.idx === idx);
    return k < 0 ? null : { p: b[side].active[k], m: snap.sides[side].active[k] };
  }

  /* ---------- order ---------- */
  applyOrder(o) {
    const b = this._battle(o.snap);
    const A = this._poke(b, o.snap, o.first.side, o.first.idx);
    const B = this._poke(b, o.snap, o.second.side, o.second.idx);
    if (!A || !B) return 'missing';
    const pa = actionPriority(b, A.p, o.first.move, o.first.targetLoc, o.first.proc);
    const pb = actionPriority(b, B.p, o.second.move, o.second.targetLoc, o.second.proc);
    if (pa > pb) { this.stats.order_nonbinding++; return 'nonbinding'; }
    if (pa < pb) { this.stats.order_anomaly++; this.anomalies.push({ kind: 'priority', turn: o.turn, first: o.first, second: o.second, pa, pb }); return 'anomaly'; }
    const dA = this.dom[o.first.side][o.first.idx], dB = this.dom[o.second.side][o.second.idx];
    const vA = dA.alive('spe'), vB = dB.alive('spe');
    const sA = actionSpeeds(b, A.p, vA.map(v => statValue(A.p.species.name, A.m.nature, 'spe', v)));
    const sB = actionSpeeds(b, B.p, vB.map(v => statValue(B.p.species.name, B.m.nature, 'spe', v)));
    const minB = Math.min(...sB), maxA = Math.max(...sA);
    const keepA = vA.filter((v, i) => sA[i] >= minB);
    const keepB = vB.filter((v, i) => sB[i] <= maxA);
    if (!keepA.length || !keepB.length) {
      this._contra({ kind: 'order', obs: strip(o), pa, pb, speedsA: pairs(vA, sA), speedsB: pairs(vB, sB) });
      return 'contradiction';
    }
    const nA = dA.clone(), nB = dB.clone();
    restrict(nA.d.spe, keepA); restrict(nB.d.spe, keepB);
    if (!nA.budget() || !nB.budget() || nA.empty() || nB.empty()) {
      this._contra({ kind: 'order_budget', obs: strip(o) });
      return 'contradiction';
    }
    this.dom[o.first.side][o.first.idx] = nA; this.dom[o.second.side][o.second.idx] = nB;
    this.touched.add(o.first.side + '|' + o.first.idx + '|spe'); this.touched.add(o.second.side + '|' + o.second.idx + '|spe');
    this.stats.order_applied++;
    return 'applied';
  }

  /* ---------- damage ---------- */
  applyDamage(o) {
    const b = this._battle(o.snap);
    const A = this._poke(b, o.snap, o.atk.side, o.atk.idx);
    const T = this._poke(b, o.snap, o.def.side, o.def.idx);
    if (!A || !T) return 'missing';
    // the move as the hit steps see it (after ModifyType / ModifyMove), so its category is the sim's
    const move = SD.prepareMove(b, A.p, T.p, o.move, o);
    const isPhys = b.getCategory(move) === 'Physical';
    b.clearActiveMove && b.clearActiveMove();
    // which mon's which stat is the offence, which is the defence (read from the move, never typed)
    const offMon = move.overrideOffensivePokemon === 'target' ? T : A;
    const offSide = offMon === T ? o.def : o.atk;
    const offStat = move.overrideOffensiveStat || (isPhys ? 'atk' : 'spa');
    const defStat = move.overrideDefensiveStat || (isPhys ? 'def' : 'spd');
    const dOff = this.dom[offSide.side][offSide.idx];
    const dDef = this.dom[o.def.side][o.def.idx];
    const vO = dOff.alive(offStat), vD = dDef.alive(defStat), vH = dDef.alive('hp');
    // attacker HP settings: exact at a full display, else the band ends at the HP-domain extremes
    const dAtk = this.dom[o.atk.side][o.atk.idx];
    const aHp = dAtk.alive('hp');
    const hpSettings = [];
    if (A.m.hp.pct >= 100) hpSettings.push([aHp[0], 'hi']);
    else for (const h of [aHp[0], aHp[aHp.length - 1]]) for (const mode of ['lo', 'hi']) hpSettings.push([h, mode]);
    const mid = this.mids();
    const setAll = (hpSP, mode) => {
      setStats(b, A.p, A.m, { ...mid[o.atk.side][o.atk.idx], hp: hpSP }, mode);
      setStats(b, T.p, T.m, { ...mid[o.def.side][o.def.idx], hp: vH[vH.length >> 1] }, 'lo');
    };
    // table[i][j] = [min,max] over the attacker-HP settings
    const table = [];
    let sensitive = hpSettings.length > 1;
    if (sensitive) {  // probe once: does attacker HP move this hit at all?
      const io = vO[vO.length >> 1], jd = vD[vD.length >> 1];
      const seen = new Set();
      for (const [h, mode] of hpSettings) {
        setAll(h, mode);
        offMon.p.storedStats[offStat] = statValue(offMon.p.species.name, offMon.m.nature, offStat, io);
        T.p.storedStats[defStat] = statValue(T.p.species.name, T.m.nature, defStat, jd);
        seen.add(JSON.stringify(damageRange(b, A.p, T.p, o.move, o)));
      }
      sensitive = seen.size > 1;
    }
    const settings = sensitive ? hpSettings : [hpSettings[0]];
    for (let i = 0; i < vO.length; i++) {
      table.push([]);
      for (let j = 0; j < vD.length; j++) table[i].push([Infinity, -Infinity]);
    }
    let nullSeen = false;
    const setOff = i => { offMon.p.storedStats[offStat] = statValue(offMon.p.species.name, offMon.m.nature, offStat, vO[i]); };
    const setDef = j => { T.p.storedStats[defStat] = statValue(T.p.species.name, T.m.nature, defStat, vD[j]); };
    for (const [h, mode] of settings) {
      setAll(h, mode);
      const dt = damageTable(b, A.p, T.p, o.move, o, setOff, setDef, vO.length, vD.length);
      if (dt && dt.table) {
        this.stats.table_decomposed = (this.stats.table_decomposed || 0) + 1;
        for (let i = 0; i < vO.length; i++) for (let j = 0; j < vD.length; j++) {
          const c = table[i][j], r = dt.table[i][j];
          c[0] = Math.min(c[0], r[0]); c[1] = Math.max(c[1], r[1]);
        }
        continue;
      }
      if (!dt) { nullSeen = true; continue; }
      this.stats['table_fallback:' + dt.fallback] = (this.stats['table_fallback:' + dt.fallback] || 0) + 1;
      for (let i = 0; i < vO.length; i++) {
        setOff(i);
        for (let j = 0; j < vD.length; j++) {
          setDef(j);
          const r = damageRange(b, A.p, T.p, o.move, o);
          if (!r) { nullSeen = true; continue; }
          const c = table[i][j];
          c[0] = Math.min(c[0], r[0]); c[1] = Math.max(c[1], r[1]);
        }
      }
    }
    if (nullSeen) {
      // the sim says this hit does no damage (immunity) but the log shows damage — a model gap
      this.stats.damage_null++;
      this._contra({ kind: 'damage_null', obs: strip(o) });
      return 'contradiction';
    }
    // HP-band feasibility for each defender HP value
    const okO = new Array(vO.length).fill(false), okD = new Array(vD.length).fill(false), okH = new Array(vH.length).fill(false);
    for (let k = 0; k < vH.length; k++) {
      const M = statValue(T.m.sheetSpecies || T.p.species.name, T.m.nature, 'hp', vH[k]);
      const bb = hpBand(o.before, M);
      const ba = o.after.fnt ? [0, 0] : hpBand(o.after, M);
      if (!bb || !ba) continue;
      let lo, hi;
      if (o.lowerOnly) { lo = bb[0]; hi = Infinity; }         // the roll reached the whole remaining HP
      else { lo = bb[0] - ba[1]; hi = bb[1] - ba[0]; if (hi < 1) continue; }
      for (let i = 0; i < vO.length; i++) for (let j = 0; j < vD.length; j++) {
        const c = table[i][j];
        if (o.lowerOnly ? c[1] >= lo : (c[0] <= hi && c[1] >= lo)) { okO[i] = okD[j] = okH[k] = true; }
      }
    }
    const keepO = vO.filter((_, i) => okO[i]), keepD = vD.filter((_, j) => okD[j]), keepH = vH.filter((_, k) => okH[k]);
    if (!keepO.length || !keepD.length || !keepH.length) {
      const flat = []; for (let i = 0; i < vO.length; i += Math.max(1, vO.length >> 2)) for (let j = 0; j < vD.length; j += Math.max(1, vD.length >> 2)) flat.push([vO[i], vD[j], table[i][j]]);
      const bands = [vH[0], vH[vH.length - 1]].map(h => { const M = statValue(T.m.sheetSpecies || T.p.species.name, T.m.nature, 'hp', h); return { hpSP: h, maxhp: M, before: hpBand(o.before, M), after: o.after.fnt ? [0, 0] : hpBand(o.after, M) }; });
      this._contra({ kind: 'damage', obs: strip(o), offStat, defStat, sample: flat, bands, sensitive });
      return 'contradiction';
    }
    const nOff = dOff.clone();
    const nDef = dOff === dDef ? nOff : dDef.clone();
    restrict(nOff.d[offStat], keepO);
    restrict(nDef.d[defStat], keepD);
    restrict(nDef.d.hp, keepH);
    if (!nOff.budget() || !nDef.budget() || nOff.empty() || nDef.empty()) { this._contra({ kind: 'damage_budget', obs: strip(o) }); return 'contradiction'; }
    this.dom[offSide.side][offSide.idx] = nOff;
    this.dom[o.def.side][o.def.idx] = nDef;
    this.touched.add(offSide.side + '|' + offSide.idx + '|' + offStat);
    this.touched.add(o.def.side + '|' + o.def.idx + '|' + defStat);
    this.touched.add(o.def.side + '|' + o.def.idx + '|hp');
    this.stats.damage_applied++;
    return 'applied';
  }

  _contra(c) { this.stats.contradictions++; this.contradictions.push(c); }

  /* posterior summary per mon: per-stat [min,max,count] of alive SP values and the stat range they give */
  summary(side) {
    return this.dom[side].map((m, i) => {
      const sh = this.sheets[side][i];
      const o = {};
      for (const s of STATS) {
        const al = m.alive(s);
        o[s] = { sp: [al[0], al[al.length - 1]], n: al.length, stat: [statValue(sh.species, sh.nature, s, al[0]), statValue(sh.species, sh.nature, s, al[al.length - 1])] };
      }
      return o;
    });
  }

  /* draw one SP vector for a mon, uniform per stat over alive values, rejecting budget violations */
  sample(side, idx, rng) {
    const m = this.dom[side][idx];
    for (let t = 0; t < 200; t++) {
      const v = {}; let tot = 0;
      for (const s of STATS) { const al = m.alive(s); v[s] = al[Math.floor(rng() * al.length)]; tot += v[s]; }
      if (tot <= SP_TOTAL) return v;
    }
    const v = {}; for (const s of STATS) v[s] = minAlive(m.d[s]); return v;
  }
}

function restrict(mask, keep) { const k = new Set(keep); for (let i = 0; i < mask.length; i++) if (mask[i] && !k.has(i)) mask[i] = 0; }
function pairs(a, b) { return a.map((x, i) => [x, b[i]]); }
function strip(o) { const { snap, ...rest } = o; return { ...rest, field: snap.field }; }

module.exports = { SpreadBelief, MonDomain, STATS, N, count };
