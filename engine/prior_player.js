/* prior_player.js — our behaviour-clone policy, running inside the OFFICIAL Showdown simulator.
 *
 * WHY THIS IS NECESSARY
 * ---------------------
 * Comparing our hand-written engine to the official simulator is meaningless unless both make
 * decisions the same way. Two earlier attempts failed on exactly this:
 *
 *   attempt 1  teams filled from the raw learnset   -> 32.2 point mean difference (the filler)
 *   attempt 2  identical teams, different policies  -> 23.7 point mean difference (the policy)
 *
 * Our engine samples the move a species actually clicks, at the frequency it clicks it (MC.priors,
 * built from observed usage). `RandomPlayerAI` picks uniformly. A uniform player throws away Protect
 * timing, spread-move choice and setup discipline, which moves win rates by far more than any rules
 * bug would. So the policy has to be held constant before a residual difference can be attributed to
 * the RULES, which is the only quantity ADR-001 actually cares about.
 *
 * This class ports the prior-sampling half of the policy. It deliberately does NOT port the two
 * damage-dependent heuristics ("take a guaranteed KO 85% of the time", "Protect when threatened and
 * unable to KO back") because those need a damage calculation the request object does not carry.
 * The matching comparison therefore runs OUR engine with those heuristics DISABLED, so both sides are
 * pure prior samplers. See tests/test-policy-parity.js.
 */
'use strict';
const path = require('path');

function loadBase() {
  const base = process.env.SHOWDOWN_PATH || '/tmp/ps';
  return {
    RandomPlayerAI: require(path.join(base, 'dist', 'sim', 'tools', 'random-player-ai')).RandomPlayerAI,
  };
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* Build species -> [[moveId, probability], ...] from the same priors table the hand-written engine
 * reads, so there is one behavioural definition rather than two. */
function priorTable() {
  const MC = (typeof globalThis !== 'undefined' && globalThis.MC) || null;
  if (!MC || !MC.priors) {
    throw new Error('MC.priors not loaded — require data/engine-data.js before constructing PriorPlayerAI');
  }
  const out = {};
  for (const [sp, rows] of Object.entries(MC.priors)) {
    out[sp] = (rows || []).map(r => [norm(r[0]), +r[1] || 0]);
  }
  return out;
}

function makePriorPlayer() {
  const { RandomPlayerAI } = loadBase();

  class PriorPlayerAI extends RandomPlayerAI {
    constructor(playerStream, options = {}, debug = false) {
      super(playerStream, options, debug);
      this.priors = options.priors || priorTable();
      this.stats = { sampled: 0, fellBack: 0, noPrior: 0 };
    }

    /* Capture the request so chooseMove can work out WHICH Pokemon is choosing.
     *
     * The `active` object passed to chooseMove carries only the move list - no species. A first
     * version read `active.species`, which is undefined, so every decision fell through to uniform
     * random while reporting itself as a prior sampler. The comparison it produced (32.2 points)
     * was therefore measuring random-versus-heuristic all over again. `request.active[i]` lines up
     * with `request.side.pokemon[i]`, whose `details` field carries the species. */
    receiveRequest(request) {
      this._req = request;
      return super.receiveRequest(request);
    }

    speciesFor(active) {
      const req = this._req;
      if (!req || !req.active || !req.side || !req.side.pokemon) return '';
      const i = req.active.indexOf(active);
      if (i < 0) return '';
      const mon = req.side.pokemon[i];
      if (!mon || !mon.details) return '';
      return norm(String(mon.details).split(',')[0]);
    }

    /* Sample the move this species actually clicks, at its observed frequency.
     *
     * Falls back to the parent's uniform choice when the species has no prior, or when the sampled
     * move is not currently legal (out of PP, disabled, Fake Out after turn one, Choice-locked).
     * Both cases are COUNTED rather than hidden, because a policy that silently degrades to random
     * would reintroduce the very confound this class exists to remove. */
    chooseMove(active, moves) {
      const species = this.speciesFor(active);
      const rows = this.priors[species];
      if (!rows || !rows.length) {
        this.stats.noPrior++;
        return super.chooseMove(active, moves);
      }
      const legal = new Map();
      for (const m of moves) {
        const id = norm((m.move && (m.move.id || m.move.move || m.move)) || '');
        if (id && !legal.has(id)) legal.set(id, m.choice);
      }
      // renormalise over the moves that are actually available this turn, then sample
      const avail = rows.filter(([id]) => legal.has(id));
      const mass = avail.reduce((s, [, p]) => s + p, 0);
      if (mass > 0) {
        let r = Math.random() * mass;
        for (const [id, p] of avail) {
          r -= p;
          if (r <= 0) { this.stats.sampled++; return legal.get(id); }
        }
        this.stats.sampled++;
        return legal.get(avail[avail.length - 1][0]);
      }
      this.stats.fellBack++;
      return super.chooseMove(active, moves);
    }
  }
  return PriorPlayerAI;
}

module.exports = { makePriorPlayer, priorTable, norm };
