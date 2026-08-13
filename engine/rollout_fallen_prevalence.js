/* rollout_fallen_prevalence.js — HOW OFTEN CAN ROADMAP #244 CHANGE A DECISION?
 *
 * The seed fix is correct whether or not it moves anything, but "correct and inert" and "correct and
 * load-bearing" are different claims and this project has published the first as the second before.
 * So the size is MEASURED rather than asserted.
 *
 * WHAT IT COUNTS. A DECISION POINT is one (game, turn, side): the moment MILTANK would seed a rollout
 * from that side's board. The seed defect can only change a number when BOTH hold at that moment:
 *
 *   1. that side has at least one body already dead, and
 *   2. that side BROUGHT a Pokemon that reads the fallen count.
 *
 * THE CARRIERS ARE ENUMERATED FROM data/tags.json, NEVER TYPED. `withTag('move','powerFromFallen')`
 * and `withTag('ability','boostsFromFallen')` are the two readers `medicham2-browser.js` actually has
 * (dmgRangeOneHit's `_pf` block and its `_bf` block); a third one added later is picked up here
 * without an edit, which is the tag-shape rule in CLAUDE.md.
 *
 * THIS IS NOT DOWNSTREAM OF MEDICHAM AND IS NOT QUARANTINED. It reads the STORE and the TAG ARTIFACT
 * and plays no game — no `battleInit`, no rollout, no board. So it needs no engine release, and the
 * ENGINE agent editing the simulator underneath it cannot change a single figure here. That is the
 * reason this measurement was the one taken while the tree was moving.
 *
 * WHAT IT DELIBERATELY DOES NOT CLAIM. It is a CEILING on how often the fix can matter, not a count
 * of decisions that flip. A position can satisfy both conditions and still rank its candidates in the
 * same order — Last Respects at 200 rather than 50 changes a leaf value, and whether the leaf's argmax
 * moves is a different question that needs a frozen release and a paired run.
 *
 *   node engine/rollout_fallen_prevalence.js  [--store data/games.bo3.jsonl]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const D = (...p) => path.join(__dirname, '..', ...p);
const TAGS = require('./tags.js');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* THE OPEN-SHEET STORE IS THE DEFAULT AND THAT IS THE POINT: MILTANK's whole bring/lead search exists
 * because the sheet is public, so the population its rollouts are seeded from is the bo3 ladder. The
 * closed-sheet store is readable with --store and its carrier detection is weaker (an ability is null
 * there), which is stated in the artifact rather than hidden. */
const STORE = arg('store', D('data', 'games.bo3.jsonl'));

const FALLEN_MOVES = new Set(TAGS.withTag('move', 'powerFromFallen').map(norm));
const FALLEN_ABIL = new Set(TAGS.withTag('ability', 'boostsFromFallen').map(norm));

function carrierSpecies(game, side) {
  /* WHO IS IN THE ROLLOUT: the BROUGHT four, because that is the roster `buildSide` reconstructs. A
   * carrier left in the back six never enters a mid-game seed. */
  const brought = ((game.brought && game.brought[side]) || []).map(norm);
  if (!brought.length) return null;
  const bySpecies = {};
  for (const s of (game.sheets && game.sheets[side]) || []) bySpecies[norm(s.species)] = s;
  const sets = game.sets || {};
  const hits = [];
  for (const sp of brought) {
    const sh = bySpecies[sp] || sets[sp] || null;
    if (!sh) continue;
    const mv = (sh.moves || []).map(norm);
    if (mv.some(m => FALLEN_MOVES.has(m))) hits.push(sp + ':move');
    if (FALLEN_ABIL.has(norm(sh.ability))) hits.push(sp + ':ability');
  }
  return hits;
}

(async () => {
  const t0 = Date.now();
  const out = {
    generated: new Date().toISOString(),
    store: path.relative(D(), STORE).replace(/\\/g, '/'),
    carriers: { moves: [...FALLEN_MOVES], abilities: [...FALLEN_ABIL] },
    games: 0, gamesSkipped: 0,
    decisionPoints: 0,
    dpWithADeath: 0,
    dpWithCarrier: 0,
    dpWithADeathAndCarrier: 0,
    deathsHistogram: {},          // deaths on the acting side at the decision point
    deathsHistogramCarrier: {},
    gamesWithCarrier: 0, sidesWithCarrier: 0, sides: 0,
    node: process.version,
  };
  const rl = readline.createInterface({ input: fs.createReadStream(STORE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let g = null;
    try { g = JSON.parse(line); } catch (e) { out.gamesSkipped++; continue; }
    if (!g || !Array.isArray(g.turns)) { out.gamesSkipped++; continue; }
    out.games++;
    const carrier = { p1: carrierSpecies(g, 'p1'), p2: carrierSpecies(g, 'p2') };
    let anyCarrier = false;
    for (const s of ['p1', 'p2']) {
      out.sides++;
      if (carrier[s] && carrier[s].length) { out.sidesWithCarrier++; anyCarrier = true; }
    }
    if (anyCarrier) out.gamesWithCarrier++;
    const dead = { p1: 0, p2: 0 };
    for (const t of g.turns) {
      /* THE COUNT IS READ AT THE START OF THE TURN, which is when the choice is made and when the
       * rollout would be seeded. A body that dies during this turn is not yet in it. */
      for (const s of ['p1', 'p2']) {
        out.decisionPoints++;
        const n = dead[s];
        const hasC = !!(carrier[s] && carrier[s].length);
        out.deathsHistogram[n] = (out.deathsHistogram[n] || 0) + 1;
        if (n > 0) out.dpWithADeath++;
        if (hasC) {
          out.dpWithCarrier++;
          out.deathsHistogramCarrier[n] = (out.deathsHistogramCarrier[n] || 0) + 1;
          if (n > 0) out.dpWithADeathAndCarrier++;
        }
      }
      for (const e of (t.ev || [])) {
        if (e && e.t === 'f' && typeof e.s === 'string') {
          const s = e.s.slice(0, 2);
          if (s === 'p1' || s === 'p2') dead[s]++;
        }
      }
    }
  }
  const pct = (a, b) => b ? +(100 * a / b).toFixed(3) : null;
  out.rates = {
    pctDecisionPointsWithADeath: pct(out.dpWithADeath, out.decisionPoints),
    pctDecisionPointsWithCarrier: pct(out.dpWithCarrier, out.decisionPoints),
    /* THE HEADLINE, and it is a CEILING on the fix's reach rather than a count of flipped decisions. */
    pctDecisionPointsAffected: pct(out.dpWithADeathAndCarrier, out.decisionPoints),
    pctAffectedAmongCarrierPoints: pct(out.dpWithADeathAndCarrier, out.dpWithCarrier),
    pctSidesWithCarrier: pct(out.sidesWithCarrier, out.sides),
    pctGamesWithCarrier: pct(out.gamesWithCarrier, out.games),
  };
  out.elapsedMs = Date.now() - t0;
  const dst = D('data', 'rollout-fallen-prevalence.json');
  fs.writeFileSync(dst, JSON.stringify(out, null, 2));
  console.log(`\nROADMAP #244 prevalence — ${out.store}`);
  console.log(`  carriers: ${[...FALLEN_MOVES].join(',') || '(none)'} / ${[...FALLEN_ABIL].join(',') || '(none)'}`);
  console.log(`  ${out.games} games, ${out.decisionPoints} decision points, ${out.gamesSkipped} skipped`);
  console.log(`  a death has already happened on the acting side : ${out.rates.pctDecisionPointsWithADeath}%`);
  console.log(`  the acting side brought a fallen-count carrier   : ${out.rates.pctDecisionPointsWithCarrier}%`);
  console.log(`  BOTH — the ceiling on what this fix can move     : ${out.rates.pctDecisionPointsAffected}%`
    + `  (${out.dpWithADeathAndCarrier} of ${out.decisionPoints})`);
  console.log(`  among carrier decision points                    : ${out.rates.pctAffectedAmongCarrierPoints}%`);
  console.log(`  wrote ${path.relative(D(), dst).replace(/\\/g, '/')}  (${out.elapsedMs} ms)\n`);
})();
