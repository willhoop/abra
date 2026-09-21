/* lattice_walk.js — WHICH `--games` VALUES GIVE THE GATE DIFFERENT TEAM LATTICES, FOR ONE POOL.
 *
 *   node engine/lattice_walk.js --regulation regmc                 walk that regulation's frozen pool
 *   node engine/lattice_walk.js --team-store <dir> [--from 1250 --to 3000 --step 50] [--anchor 1200,1350]
 *   node engine/lattice_walk.js ... --json                         the table as JSON
 *
 * WHY THIS EXISTS. `engine/quarantine.js` requires board-material zero on SEVERAL whole-game samples,
 * because `diff_swarm.buildSwarm(--games * 2)` strides each configuration's matching team list at a step
 * computed from `--games`: a larger run plays DIFFERENT teams, not the same teams plus more. The Reg M-B
 * sizes (1200 / 1350 / 1950) were chosen on 2026-09-12 by walking the shipping builder over Reg M-B's
 * frozen pool and counting the (config, team) picks each size shares with the others
 * (docs/_reports/2026-09-12-lattice-gate.md §1). That walk was done by hand and never saved, so the next
 * regulation would have had to re-invent it — or, worse, assume the sizes transfer. They do not: the
 * stride is a function of how many teams in THIS pool match each configuration.
 *
 * IT CALLS THE SHIPPING BUILDER. `buildSwarm` is required from engine/diff_swarm.js and called with
 * exactly the argument engine/game_differential.js passes it (`Math.max(games * 2, 18)`), so what this
 * prints is what the differential would draw, not a model of it. Picks are keyed `config|team.key` —
 * the same (config, team) unit the 2026-09-12 table counted.
 *
 * WHAT IT DOES NOT DO: it plays no game and publishes no figure about MEDICHAM. The pick overlap is a
 * property of the pool and the builder; which games then part a board is the differential's question.
 *
 * THE CHOICE IS PRINTED, NOT MADE SILENTLY. `--anchor` names the sizes already chosen (default: the
 * first two of the regulation's declared row, else 1200); every candidate is scored by how many of its
 * picks no anchor draws (`% new`), and the best candidate within `--to` is printed as the proposal.
 * Declaring it in `LATTICE_GAMES` (engine/quarantine.js) is a separate, visible act.
 */
'use strict';
const path = require('path');
const REG = require('./regulation.js');

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const num = (n, d) => { const v = flag(n, null); return v == null ? d : Number(v); };
const ROOT = path.join(__dirname, '..');

const STORE = flag('--team-store', REG.artifactFor('data/team-pool-frozen'));
const FROM = num('--from', 1200), TO = num('--to', 3000), STEP = num('--step', 50);
const ANCHORS = String(flag('--anchor', '1200,1350')).split(',').map(Number).filter(Boolean);
const JSON_OUT = argv.includes('--json');
/* --greedy k: after the anchors, add k sizes one at a time, each the candidate in [--from, --to] with the most
 * picks that NO size chosen so far draws. This is the 2026-09-12 criterion made repeatable. */
const GREEDY = num('--greedy', 1);

function picksFor(SW, games) {
  const sw = SW.buildSwarm(Math.max(games * 2, 18), { storeDir: STORE });
  const s = new Set();
  for (const r of sw.out) for (const t of r.picked_teams) s.add(r.config + '|' + t.key);
  return { set: s, pool: sw.teams.length };
}

function walk() {
  const SW = require('./diff_swarm.js');
  const sizes = new Set(ANCHORS);
  for (let g = FROM; g <= TO; g += STEP) sizes.add(g);
  const P = new Map();
  let pool = null;
  for (const g of [...sizes].sort((a, b) => a - b)) {
    const r = picksFor(SW, g);
    P.set(g, r.set);
    pool = r.pool;
  }
  const rows = [];
  for (const g of [...sizes].sort((a, b) => a - b)) {
    const s = P.get(g);
    const shared = {};
    let inNone = 0;
    for (const a of ANCHORS) shared[a] = 0;
    for (const k of s) {
      let any = false;
      for (const a of ANCHORS) if (a !== g && P.get(a).has(k)) { shared[a]++; any = true; }
      if (!any) inNone++;
    }
    rows.push({ games: g, picks: s.size, shared, in_none: inNone,
      pct_new: s.size ? +(100 * inNone / s.size).toFixed(1) : 0, anchor: ANCHORS.includes(g) });
  }
  const chosen = ANCHORS.slice();
  const steps = [];
  for (let k = 0; k < GREEDY; k++) {
    let best = null;
    for (const g of [...P.keys()].sort((a, b) => a - b)) {
      if (chosen.includes(g) || g < FROM || g > TO) continue;
      const s = P.get(g);
      let fresh = 0;
      for (const key of s) if (!chosen.some((c) => P.get(c).has(key))) fresh++;
      const pct = s.size ? +(100 * fresh / s.size).toFixed(1) : 0;
      if (!best || pct > best.pct_new) best = { games: g, picks: s.size, fresh, pct_new: pct };
    }
    if (!best) break;
    steps.push(best);
    chosen.push(best.games);
  }
  const best = steps[0] || null;
  /* the chosen sizes' pairwise overlap, which is the figure the gate's choice rests on */
  const pairs = [];
  for (let i = 0; i < chosen.length; i++) for (let j = i + 1; j < chosen.length; j++) {
    const a = P.get(chosen[i]), b = P.get(chosen[j]);
    let n = 0; for (const k of a) if (b.has(k)) n++;
    pairs.push({ a: chosen[i], b: chosen[j], shared: n, a_picks: a.size, b_picks: b.size });
  }
  return { generated: new Date().toISOString(), regulation: REG.ID, team_store: STORE,
    distinct_teams_in_pool: pool, anchors: ANCHORS, from: FROM, to: TO, step: STEP,
    rows, proposal: best ? best.games : null, greedy: steps, chosen, pairs };
}

if (require.main === module) {
  const W = walk();
  if (JSON_OUT) { console.log(JSON.stringify(W, null, 1)); process.exit(0); }
  console.log('LATTICE WALK — regulation ' + W.regulation + ', pool ' + W.team_store + ' (' + W.distinct_teams_in_pool
    + ' distinct teams), anchors ' + W.anchors.join(', '));
  console.log('');
  console.log('  games  picks  ' + W.anchors.map((a) => ('w/' + a).padStart(8)).join('') + '   in-none  %new');
  for (const r of W.rows) {
    console.log('  ' + String(r.games).padStart(5) + (r.anchor ? '*' : ' ') + String(r.picks).padStart(6) + '  '
      + W.anchors.map((a) => String(r.shared[a]).padStart(8)).join('') + String(r.in_none).padStart(10)
      + String(r.pct_new).padStart(6));
  }
  console.log('');
  for (const s of W.greedy) console.log('  PROPOSAL: --games ' + s.games + ' — ' + s.fresh + ' of its ' + s.picks
    + ' picks (' + s.pct_new + '%) drawn by no size chosen before it (range ' + W.from + '..' + W.to
    + '; ties to the smaller run). * = anchor.');
  console.log('  CHOSEN: ' + W.chosen.join(', '));
  for (const p of W.pairs) console.log('    ' + p.a + ' vs ' + p.b + ': ' + p.shared + ' (config, team) picks shared ('
    + p.a_picks + ' / ' + p.b_picks + ')');
}

module.exports = { walk };
