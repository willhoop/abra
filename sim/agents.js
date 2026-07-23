/* Battle agents for the Champions engine adapter. An agent maps a Showdown
 * request -> a choice string. v1 agents keep move choices valid via the sim's
 * `default` resolver and only vary the strategic team-preview bring; smarter
 * agents (real move+target selection, then MEDICHAM/SLOWKING policies) are next. */

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

module.exports = { defaultAgent, randomBringAgent };
