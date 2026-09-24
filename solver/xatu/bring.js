/* solver/xatu/bring.js — the belief over which two unseen sheet members an opponent brought.
 *
 * Open team sheets show all six; the bring is four; the leads show two. After the leads there are four
 * unseen members and C(4,2) = 6 possible back pairs. The PRIOR over those six is a conditional logit
 *
 *     score(P) = sum_{m in P} theta[species m]  +  w . phi(P)
 *
 * with features read from the HUMAN STORE as it stood strictly before the game (BringMemory):
 *   pop     — population lift: log rate(m brought | m on sheet) summed over the pair, shrunk
 *   pair    — co-bring lift of the two members, given both on the sheet
 *   lead    — lift of each member being brought when the observed leads were led
 *   opp     — matchup lift: each member's bring rate against the opponent's six species
 *   team    — this exact six (species+item) seen before: log share of earlier games that brought the pair
 *   teamlead— same six AND same leads seen before: log share with this exact back pair
 *   series  — bo3 carry-over: the pair equals the back pair revealed earlier in the series with the
 *             same leads / how many of the pair were brought earlier in the series, split by won/lost
 *
 * The UPDATE is exact: a member seen on the field is brought, so every pair not containing it is set to
 * zero and the rest renormalised. Nothing else rules a pair out — the prior is a softmax, so a pair
 * consistent with the reveals always keeps positive mass (the "never wrongly ruled out" property).
 *
 * Fitting uses every side, not only the ones that revealed all four: the likelihood of what was revealed
 * is the SUM over pairs consistent with it (coarsening at random). Fitting only on complete brings would
 * select long games, the bias docs/_reports/2026-09-23-regmc-meta.md warns about.
 */
'use strict';

const pairsOf = u => { const o = []; for (let a = 0; a < u.length; a++) for (let b = a + 1; b < u.length; b++) o.push([u[a], u[b]]); return o; };
const key2 = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const lg = Math.log;

const FEATURES = ['pop', 'pair', 'lead', 'opp', 'team', 'team_seen', 'teamlead', 'teamlead_seen', 'series_same', 'series_won', 'series_lost'];

/* ---------- the store as it stood before a game ---------- */
class BringMemory {
  constructor() {
    this.S = new Map();     // species -> times on a sheet (side-games with leads known)
    this.B = new Map();     // species -> times revealed brought
    this.S2 = new Map();    // pair -> both on sheet
    this.B2 = new Map();    // pair -> both revealed brought
    this.LS = new Map();    // lead|m -> m on sheet (not lead) with that lead led
    this.LB = new Map();    // lead|m -> ... and m revealed brought
    this.OS = new Map();    // m|oppSpecies -> m on sheet vs that opp species
    this.OB = new Map();    // ... and brought
    this.team = new Map();  // team signature -> {n, pairs: Map(key2 -> count both brought)}
    this.teamLead = new Map(); // team|leads -> {n, back: Map(key2 -> count)}
    this.series = new Map(); // seriesId|player -> [{leads, back, brought, won}]
  }
  static teamSig(sheet) { return sheet.map(m => m.sp + '@' + m.item).sort().join(','); }
  inc(map, k, n = 1) { map.set(k, (map.get(k) || 0) + n); }

  /* add one finished side-game: sheet [{sp,item}], leads [i,j], brought (revealed) indices, opp sheet */
  add(rec, side) {
    const sh = rec.sheets[side], opp = rec.sheets[side === 'p1' ? 'p2' : 'p1'];
    const leads = rec.leads[side];
    if (!leads || leads.length !== 2) return;
    const br = new Set(rec.final[side]);
    const sp = sh.map(m => m.sp);
    for (let i = 0; i < 6; i++) {
      this.inc(this.S, sp[i]); if (br.has(i)) this.inc(this.B, sp[i]);
      for (const z of new Set(opp.map(m => m.sp))) { this.inc(this.OS, sp[i] + '|' + z); if (br.has(i)) this.inc(this.OB, sp[i] + '|' + z); }
      for (let j = i + 1; j < 6; j++) { const k = key2(sp[i], sp[j]); this.inc(this.S2, k); if (br.has(i) && br.has(j)) this.inc(this.B2, k); }
      if (!leads.includes(i)) for (const l of leads) { const k = sp[l] + '>' + sp[i]; this.inc(this.LS, k); if (br.has(i)) this.inc(this.LB, k); }
    }
    const sig = BringMemory.teamSig(sh);
    const T = this.team.get(sig) || { n: 0, pairs: new Map() };
    T.n++;
    const brL = [...br];
    for (let a = 0; a < brL.length; a++) for (let b = a + 1; b < brL.length; b++) this.inc(T.pairs, key2(sp[brL[a]], sp[brL[b]]));
    this.team.set(sig, T);
    const back = [...br].filter(i => !leads.includes(i));
    const tl = sig + '#' + [sp[leads[0]], sp[leads[1]]].sort().join(',');
    const TL = this.teamLead.get(tl) || { n: 0, back: new Map() };
    TL.n++;
    if (back.length === 2) this.inc(TL.back, key2(sp[back[0]], sp[back[1]]));
    else if (back.length === 1) this.inc(TL.back, sp[back[0]] + '|?');
    this.teamLead.set(tl, TL);
    if (rec.series) {
      const sk = rec.series + '|' + rec.players[side];
      const arr = this.series.get(sk) || [];
      arr.push({ leads: [sp[leads[0]], sp[leads[1]]].sort().join(','), back: back.map(i => sp[i]), brought: [...br].map(i => sp[i]), won: rec.winner === side, gnum: rec.gnum });
      this.series.set(sk, arr);
    }
  }
  addGame(rec) { this.add(rec, 'p1'); this.add(rec, 'p2'); }

  rate(sp) { const s = this.S.get(sp) || 0, b = this.B.get(sp) || 0; return (b + 2) / (s + 4); }

  /* phi for every candidate pair of one side at the moment its leads are known */
  features(rec, side, leads) {
    const sh = rec.sheets[side], opp = rec.sheets[side === 'p1' ? 'p2' : 'p1'];
    const sp = sh.map(m => m.sp);
    const U = [0, 1, 2, 3, 4, 5].filter(i => !leads.includes(i));
    const cands = pairsOf(U);
    const sig = BringMemory.teamSig(sh);
    const T = this.team.get(sig);
    const tl = sig + '#' + [sp[leads[0]], sp[leads[1]]].sort().join(',');
    const TL = this.teamLead.get(tl);
    const ser = rec.series ? (this.series.get(rec.series + '|' + rec.players[side]) || []).filter(x => x.gnum < rec.gnum) : [];
    const leadKey = [sp[leads[0]], sp[leads[1]]].sort().join(',');
    const oppSp = [...new Set(opp.map(m => m.sp))];
    const one = i => {
      const r = this.rate(sp[i]);
      const pop = lg(r / (1 - r));
      let lead = 0;
      for (const l of leads) { const k = sp[l] + '>' + sp[i]; const s = this.LS.get(k) || 0, b = this.LB.get(k) || 0; lead += lg((b + 4 * r) / (s + 4)) - lg(r); }
      let o = 0;
      for (const z of oppSp) { const k = sp[i] + '|' + z; const s = this.OS.get(k) || 0, b = this.OB.get(k) || 0; o += lg((b + 8 * r) / (s + 8)) - lg(r); }
      return { pop, lead, opp: o / oppSp.length };
    };
    const per = {}; for (const i of U) per[i] = one(i);
    return cands.map(([x, y]) => {
      const k = key2(sp[x], sp[y]);
      const rx = this.rate(sp[x]), ry = this.rate(sp[y]);
      const s2 = this.S2.get(k) || 0, b2 = this.B2.get(k) || 0;
      const pair = lg((b2 + 4 * rx * ry) / (s2 + 4)) - lg(rx * ry);
      const team = T ? lg(((T.pairs.get(k) || 0) + 0.5) / (T.n + 1)) : 0;
      let teamlead = 0;
      if (TL) {
        const full = TL.back.get(k) || 0;
        const half = (TL.back.get(sp[x] + '|?') || 0) + (TL.back.get(sp[y] + '|?') || 0);
        teamlead = lg((full + 0.5 * half / 3 + 0.25) / (TL.n + 1.5));
      }
      let same = 0, won = 0, lost = 0;
      for (const g of ser) {
        if (g.leads === leadKey && g.back.length === 2 && key2(g.back[0], g.back[1]) === k) same = 1;
        const inter = [sp[x], sp[y]].filter(s => g.brought.includes(s)).length;
        if (g.won) won += inter; else lost += inter;
      }
      return { pair: [x, y], phi: { pop: per[x].pop + per[y].pop, pair, lead: per[x].lead + per[y].lead, opp: per[x].opp + per[y].opp,
        team, team_seen: T ? 1 : 0, teamlead, teamlead_seen: TL ? 1 : 0, series_same: same, series_won: won, series_lost: lost } };
    });
  }
}

/* ---------- the model ---------- */
class BringModel {
  constructor(json) {
    this.w = { ...(json && json.w) };
    this.theta = { ...(json && json.theta) };
    for (const f of FEATURES) if (this.w[f] == null) this.w[f] = 0;
  }
  score(sh, c) {
    let s = (this.theta[sh[c.pair[0]].sp] || 0) + (this.theta[sh[c.pair[1]].sp] || 0);
    for (const f of FEATURES) s += this.w[f] * c.phi[f];
    return s;
  }
  /* prior over the six candidate pairs */
  prior(sh, cands) {
    const sc = cands.map(c => this.score(sh, c));
    const mx = Math.max(...sc);
    const e = sc.map(v => Math.exp(v - mx));
    const z = e.reduce((a, b) => a + b, 0);
    return cands.map((c, i) => ({ pair: c.pair, p: e[i] / z }));
  }
  toJSON() { return { w: this.w, theta: this.theta, features: FEATURES }; }
}

/* condition a prior on the members seen so far: pairs must contain every seen non-lead member */
function condition(dist, seenBack) {
  const need = [...seenBack];
  const out = dist.map(d => ({ pair: d.pair, p: need.every(i => d.pair.includes(i)) ? d.p : 0 }));
  const z = out.reduce((a, b) => a + b.p, 0);
  if (z <= 0) return { dist: out, empty: true };
  for (const d of out) d.p /= z;
  return { dist: out, empty: false };
}

/* fit theta + w by gradient ascent on the coarsened-at-random likelihood; items = [{sh, cands, consistent:Set(idx)}] */
function fit(items, opts = {}) {
  const lr = opts.lr || 0.05, iters = opts.iters || 300, l2 = opts.l2 == null ? 1.0 : opts.l2, l2w = opts.l2w == null ? 0.01 : opts.l2w;
  const m = new BringModel();
  const spSet = new Set(); for (const it of items) for (const c of it.cands) { spSet.add(it.sh[c.pair[0]].sp); spSet.add(it.sh[c.pair[1]].sp); }
  for (const s of spSet) m.theta[s] = 0;
  // Adam
  const mw = {}, vw = {}, mt = {}, vt = {};
  for (const f of FEATURES) { mw[f] = 0; vw[f] = 0; }
  for (const s of spSet) { mt[s] = 0; vt[s] = 0; }
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  let ll = 0;
  for (let t = 1; t <= iters; t++) {
    const gw = {}; for (const f of FEATURES) gw[f] = 0;
    const gt = {}; for (const s of spSet) gt[s] = 0;
    ll = 0;
    for (const it of items) {
      const sc = it.cands.map(c => m.score(it.sh, c));
      const mx = Math.max(...sc);
      const e = sc.map(v => Math.exp(v - mx));
      const z = e.reduce((a, b) => a + b, 0);
      let zc = 0; for (const i of it.consistent) zc += e[i];
      ll += lg(zc / z);
      // d/dscore_i of log(zc/z) = [i in C] e_i/zc - e_i/z
      for (let i = 0; i < it.cands.length; i++) {
        const g = (it.consistent.has(i) ? e[i] / zc : 0) - e[i] / z;
        if (!g) continue;
        const c = it.cands[i];
        gt[it.sh[c.pair[0]].sp] += g; gt[it.sh[c.pair[1]].sp] += g;
        for (const f of FEATURES) gw[f] += g * c.phi[f];
      }
    }
    const n = items.length;
    for (const f of FEATURES) {
      const g = gw[f] / n - l2w * m.w[f] / n;
      mw[f] = b1 * mw[f] + (1 - b1) * g; vw[f] = b2 * vw[f] + (1 - b2) * g * g;
      m.w[f] += lr * (mw[f] / (1 - b1 ** t)) / (Math.sqrt(vw[f] / (1 - b2 ** t)) + eps);
    }
    for (const s of spSet) {
      const g = gt[s] / n - l2 * m.theta[s] / n;
      mt[s] = b1 * mt[s] + (1 - b1) * g; vt[s] = b2 * vt[s] + (1 - b2) * g * g;
      m.theta[s] += lr * (mt[s] / (1 - b1 ** t)) / (Math.sqrt(vt[s] / (1 - b2 ** t)) + eps);
    }
    if (opts.log && (t % 50 === 0 || t === 1)) opts.log(`fit iter ${t} mean ll ${(ll / n).toFixed(5)}`);
  }
  return { model: m, ll: ll / items.length };
}

module.exports = { BringMemory, BringModel, condition, fit, pairsOf, key2, FEATURES };
