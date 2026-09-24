/* solver/bench/arena_summary.js — one line per arena artifact: score, CI, playouts/decision, unfilled share,
 * decision time, over-budget count. Reads solver/out/arena/*.json (untracked); prints, writes nothing.
 *   node solver/bench/arena_summary.js [files...]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'out', 'arena');
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => path.join(dir, f));
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  const s = r.search && r.search.x, d = r.decision_ms[r.x + ' (x)'];
  console.log(JSON.stringify({ file: path.basename(f), status: r.status.slice(0, 8), flags: r.flags, score: r.result.score_x, ci95: r.result.ci95_x.map(x => +x.toFixed(3)),
    WDL: [r.result.W, r.result.D, r.result.L], capped: r.result.capped, errors: r.result.errors, paired: r.paired,
    playouts: s && s.playouts, passes: s && s.passes && s.passes.p50, unfilled_share: s && s.unfilled_share, gap_max: s && s.slowking_gap.max,
    decision_ms: d, over_budget: r.counters.miltank.overBudget, decisions: r.counters.miltank.decisions, warnings: r.warnings, head: r.provenance.head, wall_min: +(r.wall_s / 60).toFixed(1) }));
}
