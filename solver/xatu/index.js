/* solver/xatu/index.js — XATU v1, the belief over the opponent's hidden information under open team
 * sheets. The module the Node search calls.
 *
 *   const XATU = require('./solver/xatu');
 *   const mem  = await XATU.loadMemory();                 // the human store, for the bring prior's features
 *   const bel  = XATU.createBelief({ me: 'p1', known: { p1: { 0: {hp:..,atk:..}, ... } }, memory: mem,
 *                                    context: { series, gnum, players: { p1, p2 } } });
 *   for (const line of protocolLines) bel.feed(line);     // the battle protocol, as a spectator sees it
 *   bel.backTwo('p2')        // [{ pair:[i,j], p }] over the six possible back pairs, after the leads
 *   bel.spreads('p2')        // per mon, per stat: surviving SP range, count, and the stat range it gives
 *   bel.sampleWorld(rng)     // one world: a back pair per side + an SP vector per mon
 *   bel.worlds(W, rng)       // W worlds, the MAP back pair always included
 *   bel.counters()           // capability counters: reveals, order/damage applied, contradictions
 *
 * Sheets come from the |showteam| lines, or pass `sheets` directly. `known` pins spreads we know (our
 * own), so constraints between our mons and theirs narrow theirs only.
 *
 * Two independent parts: bring.js (which two are in the back) and spreads.js (Stat Points). They are
 * independent in v1 — a spread observation cannot involve an unrevealed mon, and a reveal carries no
 * spread information — so the joint posterior is their product.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { Tracker } = require('./track.js');
const { SpreadBelief } = require('./spreads.js');
const { BringMemory, BringModel, condition } = require('./bring.js');

const MODEL_PATH = path.join(__dirname, 'model', 'bring-v1.json');
const ROOT = path.join(__dirname, '..', '..');
const MAIN = ROOT.includes(path.sep + '.claude' + path.sep) ? ROOT.split(path.sep + '.claude' + path.sep)[0] : ROOT;

function loadModel(p = MODEL_PATH) { return new BringModel(JSON.parse(fs.readFileSync(p, 'utf8'))); }

/* the store as BringMemory, from the human dataset (every game, in upload order) */
async function loadMemory(humanDir = path.join(MAIN, 'solver', 'out', 'human')) {
  const { extract } = require('./eval_bring.js');
  const { recs } = await extract(humanDir);
  recs.sort((a, b) => a.t - b.t || a.gnum - b.gnum);
  const mem = new BringMemory();
  for (const r of recs) mem.addGame(r);
  return mem;
}

class Belief {
  constructor(opts = {}) {
    this.opts = opts;
    this.model = opts.model || loadModel();
    this.memory = opts.memory || new BringMemory();
    this.context = opts.context || {};
    this.tracker = new Tracker({ sheets: opts.sheets ? { ...opts.sheets } : undefined });
    this.spread = null;
    this.used = { order: 0, damage: 0 };
    this.leads = { p1: null, p2: null };
    this.seen = { p1: new Set(), p2: new Set() };
    this.priors = { p1: null, p2: null };
    this.nReveals = 0;
    if (opts.sheets) this._initSpread();
  }

  _initSpread() {
    if (this.spread || !this.tracker.sheets.p1 || !this.tracker.sheets.p2) return;
    this.spread = new SpreadBelief(this.tracker.sheets, this.opts.known);
  }

  feed(line) {
    this.tracker.feed(line);
    this._initSpread();
    this._drain();
  }
  feedAll(lines) { for (const l of (Array.isArray(lines) ? lines : String(lines).split('\n'))) this.feed(l); this.tracker.finish(); this._drain(); }

  _drain() {
    const out = this.tracker.out;
    for (; this.nReveals < out.reveals.length; this.nReveals++) {
      const r = out.reveals[this.nReveals];
      this.seen[r.side].add(r.idx);
      if (r.how === 'lead') { (this.leads[r.side] = this.leads[r.side] || []).push(r.idx); }
    }
    if (!this.spread) return;
    // order observations close at a turn's end, damage at a hit block's end; apply in arrival order
    for (; this.used.damage < out.damage.length; this.used.damage++) this.spread.applyDamage(out.damage[this.used.damage]);
    for (; this.used.order < out.order.length; this.used.order++) this.spread.applyOrder(out.order[this.used.order]);
  }

  _prior(side) {
    if (this.priors[side]) return this.priors[side];
    const leads = this.leads[side];
    if (!leads || leads.length !== 2 || !this.tracker.sheets[side]) return null;
    const rec = {
      sheets: { p1: this.tracker.sheets.p1.map(sheetKey), p2: this.tracker.sheets.p2.map(sheetKey) },
      series: this.context.series || null, gnum: this.context.gnum || 1, players: this.context.players || { p1: 'p1', p2: 'p2' },
    };
    const cands = this.memory.features(rec, side, leads);
    this.priors[side] = { leads: leads.slice(), dist: this.model.prior(rec.sheets[side], cands) };
    return this.priors[side];
  }

  /* posterior over the six back pairs of `side`, or null before its leads are on the field */
  backTwo(side) {
    const pr = this._prior(side);
    if (!pr) return null;
    const seenBack = [...this.seen[side]].filter(i => !pr.leads.includes(i));
    const { dist, empty } = condition(pr.dist, seenBack);
    if (empty) throw new Error('XATU: every back pair ruled out for ' + side + ' — reveals ' + JSON.stringify(seenBack));
    return dist;
  }
  /* P(member i is in the back) for each sheet index */
  backMarginals(side) {
    const d = this.backTwo(side);
    if (!d) return null;
    const m = Array(6).fill(0);
    for (const x of d) { m[x.pair[0]] += x.p; m[x.pair[1]] += x.p; }
    for (const i of this.leads[side]) m[i] = 1;
    return m;
  }

  spreads(side) { return this.spread ? this.spread.summary(side) : null; }

  sampleWorld(rng = Math.random) {
    const w = { back: {}, spreads: { p1: {}, p2: {} } };
    for (const s of ['p1', 'p2']) {
      const d = this.backTwo(s);
      if (d) { let u = rng(), acc = 0; w.back[s] = d[d.length - 1].pair; for (const x of d) { acc += x.p; if (u <= acc) { w.back[s] = x.pair; break; } } }
      if (this.spread) for (let i = 0; i < 6; i++) w.spreads[s][i] = this.spread.sample(s, i, rng);
    }
    return w;
  }
  /* W worlds; the first carries each side's MAP back pair (the plan's "always keep the MAP world") */
  worlds(W, rng = Math.random) {
    const out = [];
    const first = this.sampleWorld(rng);
    for (const s of ['p1', 'p2']) { const d = this.backTwo(s); if (d) first.back[s] = d.reduce((a, b) => (b.p > a.p ? b : a)).pair; }
    out.push(first);
    while (out.length < W) out.push(this.sampleWorld(rng));
    return out;
  }

  counters() {
    const s = this.spread ? this.spread.stats : {};
    return { reveals: this.nReveals, order_obs: this.tracker.out.order.length, damage_obs: this.tracker.out.damage.length,
      ...s, skipped: { ...this.tracker.out.skipped }, memory_games_species: this.memory.S.size };
  }
}

const sheetKey = m => ({ sp: require('../human/dex.js').toID(m.species), item: m.item });

function createBelief(opts) { return new Belief(opts); }

module.exports = { createBelief, loadMemory, loadModel, Belief, MODEL_PATH };
