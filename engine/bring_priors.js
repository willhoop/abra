/* bring_priors.js — how often is a species actually BROUGHT, and how often does it LEAD?
 *
 * WHY THIS EXISTS
 * ---------------
 * MEW played every game with `chooseTeamPreview -> 'default'`, inherited from RandomPlayerAI. That
 * brings the first four of the packed team and leads the first two, every single time. So a team had
 * exactly ONE bring in the entire corpus, and the real preview space —
 *
 *     C(6,4) = 15 brings  x  C(4,2) = 6 lead pairs  =  90 decisions per side
 *
 * — was sampled at one point. Team selection is a large fraction of VGC skill and it was a constant.
 *
 * Replacing it with a uniform draw over all 90 would be worse than it sounds: most of those brings
 * are ones no player would ever make, so the corpus would fill with positions that never occur. What
 * is wanted is the common brings MOST of the time and the neighbourhood around them the rest — so
 * the value model is accurate where games actually live, and not helpless just outside it.
 *
 * This measures the two propensities that shape that draw, from real clean ladder games:
 *
 *     p_bring(s) = P(s appears in `brought` | s is on the team)
 *     p_lead(s)  = P(s appears in `lead`    | s was brought)
 *
 * HONEST LIMIT, and it is a real one. `brought` is what the replay REVEALED, not what was selected.
 * A Pokemon chosen but never sent out before the game ended is invisible, so p_bring is biased DOWN,
 * and biased down hardest for slow/situational mons in short games. The same caveat governs every
 * bring statistic in this project (see counters.py).
 *
 * p_lead is clean by comparison — leads are on the field at turn 1 and are always revealed. So the
 * lead half of the draw rests on solid ground and the bring half is a ranking, not a calibrated rate.
 *
 * Shrunk toward the pool mean by SHRINK pseudo-observations so a species seen four times cannot land
 * at 1.00 and dominate every draw.
 *
 *   node engine/bring_priors.js          -> data/bring-priors.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Q = require('./quality.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'bring-priors.json');
const SHRINK = 10;                 // pseudo-observations pulling a thin species toward the mean
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function main() {
  const games = Q.loadGames();     // clean only — bot games have their own bring habits
  const onTeam = {}, brought = {}, led = {};
  let n = 0;

  for (const g of games) {
    const six = g.six || {}, br = g.brought || {}, ld = g.lead || {};
    for (const p of ['p1', 'p2']) {
      const team = (six[p] || []).map(norm);
      if (team.length < 4) continue;
      const bset = new Set((br[p] || []).map(norm));
      const lset = new Set((ld[p] || []).map(norm));
      n++;
      for (const s of team) {
        onTeam[s] = (onTeam[s] || 0) + 1;
        if (bset.has(s)) {
          brought[s] = (brought[s] || 0) + 1;
          if (lset.has(s)) led[s] = (led[s] || 0) + 1;
        }
      }
    }
  }

  const species = Object.keys(onTeam).sort();
  /* pool means are the shrinkage target */
  const tb = species.reduce((a, s) => a + (brought[s] || 0), 0);
  const tt = species.reduce((a, s) => a + onTeam[s], 0);
  const tl = species.reduce((a, s) => a + (led[s] || 0), 0);
  const meanBring = tt ? tb / tt : 0.667;
  const meanLead = tb ? tl / tb : 0.5;

  const out = {};
  for (const s of species) {
    const nt = onTeam[s], nb = brought[s] || 0, nl = led[s] || 0;
    out[s] = {
      n_team: nt,
      p_bring: +(((nb + SHRINK * meanBring) / (nt + SHRINK))).toFixed(4),
      p_lead: +(((nl + SHRINK * meanLead) / (nb + SHRINK))).toFixed(4),
    };
  }

  fs.writeFileSync(OUT, JSON.stringify({
    generated: new Date().toISOString().slice(0, 10),
    n_sides: n,
    n_species: species.length,
    shrink: SHRINK,
    mean_bring: +meanBring.toFixed(4),
    mean_lead: +meanLead.toFixed(4),
    caveat: 'p_bring is measured from REVEALED species and is biased down; treat it as a ranking. '
          + 'p_lead is measured from turn-1 leads and is unbiased.',
    species: out,
  }, null, 1));

  const top = species.slice().sort((a, b) => out[b].p_lead - out[a].p_lead).filter(s => onTeam[s] >= 40);
  console.log(`${n} sides, ${species.length} species -> ${path.relative(ROOT, OUT)}`);
  console.log(`  pool means: bring ${(100 * meanBring).toFixed(1)}%  lead ${(100 * meanLead).toFixed(1)}%`);
  console.log('  most lead-prone (>=40 appearances):');
  for (const s of top.slice(0, 8)) {
    console.log(`    ${s.padEnd(16)} lead ${(100 * out[s].p_lead).toFixed(0)}%  bring ${(100 * out[s].p_bring).toFixed(0)}%  (n=${onTeam[s]})`);
  }
}

main();
