/* solver/mew/agent.js — a LEAGUE AGENT: one generation's models, as a bot that can sit in a MEDICHAM game.
 *
 *   const AG = require('./solver/mew/agent.js').create(API, { buildBody });
 *   const a = AG.load(spec)          spec (a JSON object, see below) -> { name, spec, digests, bot(seed), PA }
 *   const b = a.bot(seed)            -> { name, choose(S, side, ctx[, hb]) -> { joint, info } }
 *   AG.XW                            solver/xatu/worlds.js on this agent set's rollout (honest information)
 *   AG.COUNTERS                      fallbacks (the search threw and the prior's top legal joint was played), …
 *
 *   spec = { name, kind: 'miltank', mag, doduo, pory2, budgetMs, k1, k2, depth, reserveSwitch }
 *        | { name, kind: 'greedy',  mag, doduo }            the HUMAN CLONE: DODUO's argmax legal joint, no search
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

function create(API, opts) {
  opts = opts || {};
  const R = opts.rollout || require('../miltank/rollout.js').create(API, { buildBody: opts.buildBody });
  const PAmod = require('../miltank/prior_adapter.js');
  const MAGI = require('../mag/infer.js');
  const MTmod = require('../miltank/search.js');
  const coinOf = seed => API.M.rngStreams({ seed }).any;
  const COUNTERS = { fallbacks: 0, fallback_errors: [], decisions: 0, searched: 0, forced: 0 };
  const LOADED = new Map();
  const XW = require('../xatu/worlds.js').create(API, { R });

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
    const PA = PAmod.create(API, prior);
    const digests = { mag: sha(spec.mag), doduo: sha(spec.doduo) };
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
                                leaf: 'pory2', leafModel: abs(spec.pory2), coin }, extra || {});
      return { name: spec.name, kind: 'miltank', PA, MT, choose(S, side, ctx, hb) {
        COUNTERS.decisions++;
        if (spec.view_drops_stall) dropStall(S, hb);
        try {
          const r = (hb ? MTmod.create(API, { prior: PA, rollout: XW.rollout(hb) }) : MT).decide(S, side, ctx, o);
          if (hb) COUNTERS.honest = (COUNTERS.honest || 0) + 1;
          if (r.info && r.info.forced) COUNTERS.forced++; else COUNTERS.searched++;
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

module.exports = { create, sha, abs };
