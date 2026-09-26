/* solver/mew/agent.js — a LEAGUE AGENT: one generation's models, as a bot that can sit in a MEDICHAM game.
 *
 *   const AG = require('./solver/mew/agent.js').create(API, { buildBody });
 *   const a = AG.load(spec)          spec (a JSON object, see below) -> { name, spec, digests, bot(seed), PA }
 *   const b = a.bot(seed)            -> { name, choose(S, side, ctx[, hb]) -> { joint, info } }
 *   AG.XW                            solver/xatu/worlds.js on this agent set's rollout (honest information)
 *   AG.COUNTERS                      fallbacks (the search threw and the prior's top legal joint was played), …
 *
 *   spec = { name, kind: 'miltank', mag, doduo, pory2, budgetMs, k1, k2, depth, reserveSwitch[, gates][, quiesce] }
 *   quiesce (2026-09-27): true | 'all' = every search playout plays one extension turn; 'held' = only after a protect held
 *   (solver/miltank/rollout.js QUIESCENCE); flatEps: a flat table plays the prior's top joint; reserveNoRepeat: the mega row
 *   repeats no Protect when it can (solver/miltank/search.js; docs/_reports/2026-09-27-protect-repeat-fix.md)
 *        | { name, kind: 'greedy',  mag, doduo[, gates] }   the HUMAN CLONE: DODUO's argmax legal joint, no search
 *   gates (2026-09-25, docs/_reports/2026-09-25-mag-doduo-gates.md): true or { soft, maxSteps, maxMs } — the prior is wrapped
 *   by DODUO v2 (solver/doduo/v2.js): MAG v2's per-slot dead-click gate and DODUO v2's pair gate cut, MAG's soft verdict
 *   down-weights, and DODUO's own score ranks what is left. The gate code is digested into `digests.gates`, and its
 *   counters are in COUNTERS.gates[<agent name>].
 *   Paths are relative to the repository root. Every model file is digested into `digests`, so an artifact
 *   says which weights played, not which file names.
 *
 * A MILTANK agent is MILTANK v1 (solver/miltank/search.js) with THIS generation's DODUO as the candidate prior
 * for both sides of its matrix and THIS generation's PORYGON2 as the leaf (search.js o.leafModel). With
 * `record`, choose() returns the whole root in info.rec (rows, cols, both mixes, the mean matrix), which is what
 * self-play trains on.
 *
 * HONEST INFORMATION (2026-09-26). choose(S, side, ctx, hb): with `hb` (solver/xatu/worlds.js — XATU's back-pair
 * posterior and spread belief, see solver/mew/play.js --info honest) the search's worlds are drawn from XATU instead
 * of the uniform back-line draw, and every opponent body's spread is drawn per world. S is then the caller's PUBLIC
 * view, never the true battle. Without `hb` the search is exactly what it was.
 *
 * THE FALLBACK IS COUNTED, NEVER SILENT. If the search throws, the agent plays its prior's top legal joint and
 * COUNTERS.fallbacks goes up; the run prints it. A self-play run whose fallbacks are not zero is reported so.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const abs = p => (path.isAbsolute(p) ? p : path.join(ROOT, p));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(abs(p))).digest('hex').slice(0, 16);

/* the search options a league spec may carry beyond k, depth and the leaf (solver/miltank/search.js); absent = off */
const SEARCH_EXTRAS = ['quiesce', 'flatEps', 'reserveNoRepeat'];
function searchExtras(spec) {
  const o = {};
  for (const k of SEARCH_EXTRAS) if (spec && spec[k] != null && spec[k] !== false) o[k] = spec[k];
  return o;
}

function create(API, opts) {
  opts = opts || {};
  const R = opts.rollout || require('../miltank/rollout.js').create(API, { buildBody: opts.buildBody });
  const PAmod = require('../miltank/prior_adapter.js');
  const MAGI = require('../mag/infer.js');
  const MTmod = require('../miltank/search.js');
  const coinOf = seed => API.M.rngStreams({ seed }).any;
  const COUNTERS = { fallbacks: 0, fallback_errors: [], decisions: 0, searched: 0, forced: 0, gates: {} };
  const GATE_FILES = ['solver/mag/probe.js', 'solver/mag/purpose.js', 'solver/mag/gate.js', 'solver/doduo/gate.js', 'solver/doduo/v2.js', 'solver/doduo/board_state.frozen.js'];
  const LOADED = new Map();
  const XW = require('../xatu/worlds.js').create(API, { R });

  /* the arena's adaptive clock: an allocator plus a simulated bank for ONE game (see bot() below) */
  const ADAPT = require('../rotom/adaptive.js'), CLOCK = require('../rotom/clock.js');
  let RULE = null, TABLE = null;
  COUNTERS.adapt = null;
  function adaptiveFor(cfg) {
    RULE = RULE || CLOCK.readRule(); TABLE = TABLE || CLOCK.loadTable();
    COUNTERS.adapt = COUNTERS.adapt || { plans: 0, low_bank: 0, capped_by_clock: 0, capped_by_credit: 0, stops: { clear: 0, soft: 0, hard: 0, none: 0 }, decisions_searched: 0, spent_ms: 0, games: 0,
                                         rule: { starting: RULE.starting, grace: RULE.grace, maxPerTurn: RULE.maxPerTurn, source: RULE.source }, table_sha: TABLE.sha };
    const A = ADAPT.create(Object.assign({}, cfg, { counters: COUNTERS.adapt }));
    A.newGame();
    const st = { A, bank: RULE.starting + RULE.grace };
    st.plan = S => A.plan({ kind: 'move', bankS: st.bank, turnLeftS: Math.min(st.bank, RULE.maxPerTurn), eRem: TABLE.eRem(S.turn || 1), eRemHi: TABLE.eRemHi(S.turn || 1) });
    st.charge = (ms, searched, rec) => { st.bank -= ms / 1000; A.spent(ms, searched, rec); };
    return st;
  }

  /* spec.view_drops_stall (2026-09-26, docs/_reports/2026-09-26-protect-overuse.md): the agent's view carries NO
   * consecutive-Protect counter — every body's `tookProtectTurns` zeroed, as ROTOM's world.js built the live position
   * before 2026-09-26 (it laid no volatile, and the `stall` counter is one). It exists to measure the PRE-FIX live
   * agent in the arena, and it is only legal on an honest view: that view is the decider's own fresh clone
   * (solver/xatu/worlds.js arenaView), so zeroing it never touches the true battle. On anything else it throws. */
  function dropStall(S, hb) {
    if (!hb) throw new Error('mew/agent: view_drops_stall needs the honest view (--info honest); it would edit the true battle');
    for (const m of [...S.sfA.team, ...S.sfB.team]) if (m) { m.tookProtectTurns = 0; m._stallFresh = false; }
    COUNTERS.stallDropped = (COUNTERS.stallDropped || 0) + 1;
  }
  function load(spec) {
    if (!spec || !spec.name || !spec.kind) throw new Error('mew/agent: a spec needs name and kind');
    const key = JSON.stringify(spec);
    if (LOADED.has(key)) return LOADED.get(key);
    const prior = MAGI.load({ mag: abs(spec.mag), doduo: abs(spec.doduo) });
    let PA = PAmod.create(API, prior);
    const digests = { mag: sha(spec.mag), doduo: sha(spec.doduo) };
    if (spec.gates) {
      const g = spec.gates === true ? {} : spec.gates;
      const need = spec.kind === 'miltank' ? { all: Math.max(spec.k1 || 8, spec.k2 || 8), switch: spec.reserveSwitch == null ? 2 : spec.reserveSwitch, mega: 1 } : { all: 1 };
      const V2 = require('../doduo/v2.js').create(API, { rollout: R, soft: g.soft, floor: g.floor, switchModel: g.switchModel, maxSteps: g.maxSteps, maxMs: g.maxMs, need });
      PA = V2.wrap(PA);
      COUNTERS.gates[spec.name] = V2.COUNTERS;
      const h = crypto.createHash('sha256');
      for (const f of GATE_FILES) h.update(fs.readFileSync(abs(f)));
      digests.gates = h.digest('hex').slice(0, 16);
    }
    let MT = null;
    if (spec.kind === 'miltank') {
      if (!spec.pory2) throw new Error('mew/agent: a miltank agent needs a pory2 leaf model');
      digests.pory2 = sha(spec.pory2);
      MT = MTmod.create(API, { prior: PA, rollout: R });
    } else if (spec.kind !== 'greedy') throw new Error('mew/agent: unknown kind ' + spec.kind);

    function argmax(S, side, ctx) {
      const la = API.legalActions(S, side);
      if (la.joint.length === 1) return { joint: la.joint[0], info: { forced: true } };
      const s = PA.scoreJoints(ctx, S, side, side, la);
      let b = 0; for (let i = 1; i < s.length; i++) if (s[i] > s[b]) b = i;
      return { joint: la.joint[b], info: { p: s[b] } };
    }
    function bot(seed, extra) {
      const coin = coinOf(seed);
      if (spec.kind === 'greedy') return { name: spec.name, kind: 'greedy', PA, choose(S, side, ctx) { COUNTERS.decisions++; return argmax(S, side, ctx); } };
      const o = Object.assign({ budgetMs: spec.budgetMs, k1: spec.k1, k2: spec.k2, depth: spec.depth, reserveSwitch: spec.reserveSwitch,
                                leaf: 'pory2', leafModel: abs(spec.pory2), coin }, searchExtras(spec), extra || {});
      /* spec.adaptive (2026-09-27): ROTOM's adaptive clock (solver/rotom/adaptive.js) plans each decision on a simulated
       * VGC bank — the rule read from the checkout (solver/rotom/clock.js readRule), charged with this bot's own wall ms per
       * decision — instead of spec.budgetMs. One allocator per bot, and a bot plays one game. */
      const AD = spec.adaptive ? adaptiveFor(spec.adaptive) : null;
      return { name: spec.name, kind: 'miltank', PA, MT, choose(S, side, ctx, hb) {
        COUNTERS.decisions++;
        if (spec.view_drops_stall) dropStall(S, hb);
        const tIn = Date.now();
        let oo = o, rec = null;
        if (AD) {
          const pl = AD.plan(S);
          if (pl.lowBank) { COUNTERS.adapt_low_bank = (COUNTERS.adapt_low_bank || 0) + 1; const r = argmax(S, side, ctx); AD.charge(Date.now() - tIn, false, null); r.info = Object.assign({}, r.info, { adapt: pl, fallback: 'low_bank' }); return r; }
          rec = { kind: 'move' };
          oo = Object.assign({}, o, { budgetMs: pl.hardMs, onPass: AD.A.stopper(pl, rec) });
          rec.plan = pl;
        }
        try {
          const r = (hb ? MTmod.create(API, { prior: PA, rollout: XW.rollout(hb) }) : MT).decide(S, side, ctx, oo);
          if (hb) COUNTERS.honest = (COUNTERS.honest || 0) + 1;
          if (r.info && r.info.forced) COUNTERS.forced++; else COUNTERS.searched++;
          if (AD) {
            const searched = !(r.info && r.info.forced);
            if (searched && rec.stop === 'none') rec.stop = 'hard';
            AD.charge(Date.now() - tIn, searched, rec);
            r.info = Object.assign({}, r.info, { adapt: { stop: searched ? rec.stop : 'forced', hard: rec.plan.hardMs, soft: rec.plan.softMs, credit: rec.plan.creditMs, bank: +AD.bank.toFixed(1) } });
          }
          return r;
        } catch (e) {
          COUNTERS.fallbacks++;
          if (COUNTERS.fallback_errors.length < 10) COUNTERS.fallback_errors.push(String(e && e.message || e).slice(0, 200));
          const r = argmax(S, side, ctx); r.info = Object.assign({}, r.info, { fallback: true }); return r;
        }
      } };
    }
    const a = { name: spec.name, spec, digests, bot, PA, MT, prior };
    LOADED.set(key, a);
    return a;
  }
  return { load, COUNTERS, R, XW };
}

module.exports = { create, sha, abs, searchExtras, SEARCH_EXTRAS };
