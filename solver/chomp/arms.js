/* solver/chomp/arms.js — the team-preview ARMS the arena can seat: who picks the four and the two leads.
 *
 *   const PV = require('./solver/chomp/arms.js').create({ API, cacheDir, human });
 *   PV.choose(arm, G, side, seed) -> { order: [4 sheet idx, leads first], info }
 *   PV.COUNTERS
 *
 *   human    the human's own recorded bring and leads for that sheet in that game (G.brought, solver/arena/teams.js)
 *   hprior   the human-modal option from the store (solver/chomp/human_prior.js, fitted on TRAIN sides only)
 *   random   four of six uniformly, then two of the four to lead uniformly (every one of the 90 options equally likely)
 *   chomp    CHOMP v0's mix for this sheet against that sheet, SAMPLED with a coin seeded per game and side — never
 *            the argmax. Read from the plan's solved tables (solver/chomp/tables.js) when present; otherwise solved
 *            here on the caller's engine, and COUNTED (`chompInline`), so a run can say which it did.
 *
 * Every arm's pick is counted, and so is every fallback: a CHOMP solve that throws falls back to the human bring and
 * bumps `chompFailed` — never silently.
 */
'use strict';
const O = require('./options.js');

function create(deps) {
  const API = deps.API, M = API.M;
  const COUNTERS = { picks: {}, chompCached: 0, chompInline: 0, chompFailed: 0 };
  let CACHE = null, CH = null, HP = null;
  const cache = () => (CACHE || (CACHE = deps.cacheDir ? require('./tables.js').load(deps.cacheDir) : new Map()));
  const chomp = () => (CH || (CH = require('./chomp.js').create({ API })));
  const hprior = () => {
    if (!HP) { const D = require('./data.js'); HP = require('./human_prior.js').fit(D.headers(deps.human).games); }
    return HP;
  };
  const bump = a => { COUNTERS.picks[a] = (COUNTERS.picks[a] || 0) + 1; };

  function choose(arm, G, side, seed) {
    bump(arm);
    const other = side === 'p1' ? 'p2' : 'p1';
    const coin = M.rngStreams({ seed }).any;
    if (arm === 'human') return { order: G.brought[side].slice(), info: { option: O.indexOf(G.brought[side]) } };
    if (arm === 'random') {
      const a = [0, 1, 2, 3, 4, 5];
      for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(coin() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; }
      const order = a.slice(0, 4);
      return { order, info: { option: O.indexOf(order) } };
    }
    if (arm === 'hprior') {
      const i = hprior().modal(G.sheets[side]);
      return { order: O.OPTIONS[i].order.slice(), info: { option: i } };
    }
    if (arm === 'chomp') {
      const key = require('./tables.js').jobKey(G.id, side, false);
      let r = cache().get(key);
      let mix, src;
      if (r && r.result) { mix = r.result.mix; src = 'cache'; COUNTERS.chompCached++; }
      else {
        try { const s = chomp().solve({ mine: G.sheets[side], theirs: G.sheets[other] }); mix = s.mix; r = { result: s }; src = 'inline'; COUNTERS.chompInline++; }
        catch (e) { COUNTERS.chompFailed++; return { order: G.brought[side].slice(), info: { fallback: 'human', err: String(e.message).slice(0, 200) } }; }
      }
      const u = coin();
      const i = require('../slowking/matrix.js').sample(mix, u);
      const res = r.result;
      const vs = res.win_vsMix ? res.win_vsMix[i] : res.win ? res.win[i].vsMix : null;
      return { order: O.OPTIONS[i].order.slice(), info: { option: i, p: mix[i], v: res.value, vsMix: vs, support: mix.filter(p => p > 1e-9).length, src } };
    }
    throw new Error('chomp/arms: unknown preview arm ' + arm);
  }
  return { choose, COUNTERS, ARMS: ['human', 'hprior', 'random', 'chomp'] };
}

module.exports = { create };
