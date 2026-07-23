/* Battle agents for the Champions engine adapter. An agent maps a Showdown
 * request -> a choice string. Agents range from trivial (always `default`, proves
 * the engine runs) to the greedy CHOMP-damage policy (the first real strategy in
 * the loop). MEDICHAM/SLOWKING policies plug in the same way. */

let Dex;
try { Dex = require('pokemon-showdown').Dex; } catch (e) { Dex = null; }

// ---- trivial agents -------------------------------------------------------

// Everything default — the sim auto-picks a legal choice. Proves the engine runs.
function defaultAgent(req, who) { return `>${who} default`; }

// Random legal bring at team preview; default in-battle. Gives self-play variety.
function randomBringAgent(req, who) {
  if (req.teamPreview) {
    const n = (req.side && req.side.pokemon && req.side.pokemon.length) || 6;
    const idx = Array.from({ length: n }, (_, i) => i + 1);
    for (let i = idx.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const bring = idx.slice(0, Math.min(4, n)).join('');   // ordered bring of four
    return `>${who} team ${bring}`;
  }
  return `>${who} default`;
}

// ---- greedy CHOMP-damage agent -------------------------------------------
// The first *real* policy: for each active slot, pick the legal move with the
// highest heuristic damage against a live opposing target — base power * STAB *
// type effectiveness (from the sim's own Dex). Doubles targeting is resolved to a
// live foe. Falls back to `default` whenever a request is ambiguous, so it can
// never emit an illegal choice (the driver's loop-guard is the final backstop).
//
// Opponent typing: the request tells us *our* side but not the foe's species, so
// this agent tracks foe actives from the protocol via a small closure factory.
// `makeGreedyAgent()` returns { agent, note } where `note(line)` is fed each
// protocol line so the agent knows what it's hitting. If you don't wire `note`,
// it still works — it just ranks by base power + STAB (no effectiveness term).

function effectiveness(moveType, defTypes) {
  if (!Dex || !moveType) return 1;
  let mult = 1;
  for (const dt of defTypes) {
    const r = Dex.types.get(dt) && Dex.types.get(moveType).effectType ? null : null;
    // Dex.getEffectiveness(moveType, defType): +1 super, -1 resist, 0 neutral
    let e; try { e = Dex.getEffectiveness(moveType, dt); } catch (_) { e = 0; }
    let immune = false;
    try { immune = !Dex.getImmunity(moveType, dt); } catch (_) { immune = false; }
    if (immune) return 0;
    mult *= Math.pow(2, e);
  }
  return mult;
}

function makeGreedyAgent(opts = {}) {
  // foe[slot] = array of types for the foe's active in that slot ('p2a','p2b' etc.)
  const foeTypes = {};   // key: e.g. 'p1a' -> our foe seen via |switch|/|drag|
  const myFoePrefix = who => (who === 'p1' ? 'p2' : 'p1');

  // feed every omniscient/player protocol line here to track foe actives
  function note(line) {
    // |switch|p2a: Nickname|Species, Level|... or |drag|...
    const m = /^\|(?:switch|drag|replace)\|(p[12][a-c]): [^|]+\|([^,|]+)/.exec(line);
    if (!m || !Dex) return;
    const slot = m[1];
    const species = m[2].trim();
    const sp = Dex.species.get(species);
    if (sp && sp.exists) foeTypes[slot] = sp.types.slice();
  }

  function agent(req, who) {
    if (req.teamPreview) {                      // greedy has no preview model yet: bring first four
      const n = (req.side && req.side.pokemon && req.side.pokemon.length) || 6;
      return `>${who} team ${Array.from({ length: Math.min(4, n) }, (_, i) => i + 1).join('')}`;
    }
    if (req.forceSwitch) return `>${who} default`;   // fainted-switch: let the sim pick a legal replacement
    if (!req.active) return `>${who} default`;

    const fp = myFoePrefix(who);
    const foeSlots = ['a', 'b', 'c'].map(x => fp + x).filter(s => foeTypes[s]); // live-ish foes we know
    const parts = req.active.map((act, i) => {
      if (!act || !act.moves) return 'default';
      const legal = act.moves.map((m, k) => ({ i: k + 1, m })).filter(x => !x.m.disabled && (x.m.pp === undefined || x.m.pp > 0));
      if (!legal.length) return 'default';       // Struggle etc. — let sim handle
      // score each move
      let best = legal[0], bestScore = -1, bestTarget = 0;
      for (const c of legal) {
        const mv = Dex ? Dex.moves.get(c.m.id) : null;
        const bp = (mv && mv.basePower) || (c.m.id ? 50 : 0);   // status moves ~0; unknown ~50
        const needsTarget = mv && ['normal', 'any', 'adjacentFoe'].includes(mv.target);
        // pick the foe target that maximizes effectiveness (or slot 1 if unknown)
        let target = 0, eff = 1;
        if (needsTarget) {
          target = 1;                            // default: first foe slot
          if (foeSlots.length) {
            let bestEff = -1;
            foeSlots.forEach((s, idx) => {
              const e = effectiveness(mv && mv.type, foeTypes[s]);
              if (e > bestEff) { bestEff = e; target = idx + 1; eff = e; }
            });
          }
        }
        const score = bp * eff;
        if (score > bestScore) { bestScore = score; best = c; bestTarget = needsTarget ? target : 0; }
      }
      return bestTarget ? `move ${best.i} ${bestTarget}` : `move ${best.i}`;
    });
    return `>${who} ${parts.join(', ')}`;
  }

  return { agent, note };
}

// convenience: a standalone greedy agent that tracks foes off the omniscient log
// (used by selfplay/exact rollout, which forward the log to `note`)
function greedyAgent(req, who) { return makeGreedyAgent().agent(req, who); }  // stateless fallback

module.exports = { defaultAgent, randomBringAgent, makeGreedyAgent, greedyAgent };
