/* solver/chomp/v1/table_report.js — what CHOMP v1's tables say, IN-TABLE only (no game is played here).
 *
 *   node solver/chomp/v1/table_report.js --release eaa5becc54eb --team-store <dir> [--out <json>]
 *
 * On every TEST pair of the frozen store, both chairs:
 *   - the mix: support size, value v*, the options' spread against a uniform opponent;
 *   - agreement: how often the mix's top option is the human-prior modal option, and the human's own recorded option;
 *   - in-table regret: v* minus the guaranteed value of the modal option and of the human's own option;
 *   - THE BO3 ADJUSTMENT (pre-registered, preregistration.json `bo3`): with the opponent's previous game set to the
 *     human's recorded four and leads, and their previous result WON and then LOST, the adjusted mix's value against
 *     the opponent model q, against the equilibrium mix's value against q, and the adjusted mix's exploitability.
 * These are claims about the model's own table, not about play.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
require('../../arena/env.js');
const ENGINE = require('../../arena/engine.js').load(flag('--release'));
const O = require('../options.js');
const CH = require('./chomp1.js').create({ API: ENGINE.API });
const P = require('../../mew/pairs.js').load({ teamStore: flag('--team-store') });
const HP = require('../human_prior.js').fit(require('../data.js').headers().games);
const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const R = { sides: 0, support: [], value: [], range: [], top_is_modal: 0, top_is_human: 0, mass_on_modal: [], mass_on_human: [], regret_modal: [], regret_human: [], ms: [],
  bo3: { won: { gain: [], exploit: [], changed: 0 }, lost: { gain: [], exploit: [], changed: 0 } } };
for (const G of P.test) {
  for (const [me, op] of [['p1', 'p2'], ['p2', 'p1']]) {
    const r = CH.solve({ mine: G.sheets[me], theirs: G.sheets[op] }, { keepTable: true });
    const A = r.table;
    const guar = i => Math.min(...A[i]);
    const top = r.support[0].i, modal = HP.modal(G.sheets[me]), human = O.indexOf(G.brought[me]);
    R.sides++; R.support.push(r.support.length); R.value.push(r.value); R.range.push(r.spread.row_vsUniform_range); R.ms.push(r.ms);
    if (top === modal) R.top_is_modal++;
    if (top === human) R.top_is_human++;
    R.mass_on_modal.push(r.mix[modal]); if (human >= 0) R.mass_on_human.push(r.mix[human]);
    R.regret_modal.push(r.value - guar(modal)); if (human >= 0) R.regret_human.push(r.value - guar(human));
    for (const won of [true, false]) {
      const s = CH.solve({ mine: G.sheets[me], theirs: G.sheets[op] }, { series: { oppLast: { brought: G.brought[op], leads: G.brought[op].slice(0, 2), won } } });
      const b = R.bo3[won ? 'won' : 'lost'];
      b.gain.push(s.bo3.v_adj_vs_q - s.bo3.v_eq_vs_q); b.exploit.push(s.bo3.exploit_adj);
      if (s.bo3.br !== top) b.changed++;
    }
  }
}
const sum = a => ({ mean: +mean(a).toFixed(4), p10: +q(a, 0.1).toFixed(4), p50: +q(a, 0.5).toFixed(4), p90: +q(a, 0.9).toFixed(4) });
const out = {
  what: 'CHOMP v1 in-table report (solver/chomp/v1/table_report.js); no game played', release: ENGINE.id, model: CH.scorer.file,
  pool: { file: P.file, file_sha256: P.file_sha256, pool_digest: P.pool_digest, test_pairs: P.test.length },
  sides: R.sides, support: sum(R.support), value: sum(R.value), options_range_vs_uniform: sum(R.range), solve_ms: sum(R.ms),
  top_is_modal: R.top_is_modal / R.sides, top_is_human: R.top_is_human / R.sides, mass_on_modal: sum(R.mass_on_modal), mass_on_human: sum(R.mass_on_human),
  regret_in_table: { modal: sum(R.regret_modal), human: sum(R.regret_human) },
  bo3: Object.fromEntries(Object.entries(R.bo3).map(([k, b]) => [k, { gain_vs_q: sum(b.gain), exploit_adj: sum(b.exploit), br_differs_from_eq_top: b.changed / R.sides }])),
};
if (flag('--out')) fs.writeFileSync(flag('--out'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
