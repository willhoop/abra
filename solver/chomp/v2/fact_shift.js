/* solver/chomp/v2/fact_shift.js — how much the per-set spread and the field move CHOMP's member facts. Reads no outcome.
 *
 *   node solver/chomp/v2/fact_shift.js --release eaa5becc54eb --team-store <dir> [--spreads <spreads json>] [--split test]
 *   -> solver/out/chomp/v2/fact_shift.json
 *
 * Over the frozen pool's team pairs of one split (default TEST, the gate's pairs), every ordered member pair (i of one
 * sheet on j of the other, both directions; 72 per pair of sheets):
 *   SPREAD   set spread against the table stat line, on the neutral field: the share of speed-order facts that change
 *            (and of those, the share that FLIP outright: 1 <-> 0), KO-from-full / sure-KO / sure-2HKO changes, and the mean
 *            |change| in the expected-hit fraction
 *   FIELD    at the table stat line, each field a sheet can set against the neutral field: for the room and the side speed
 *            doubler, the share of speed-order facts that change; for each weather and terrain, the share of damage
 *            facts (expected hit) that change, KO flips, and the speed-order changes (weather-speed abilities)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
require('../../arena/env.js');
const ROOT = path.join(__dirname, '..', '..', '..');
const ENGINE = require('../../arena/engine.js').load(flag('--release'));
const S2 = require('./spreads.js');
const V2F = require('./features.js');
const PAIRS = require('../../mew/pairs.js');
const OUT = path.join(ROOT, 'solver', 'out', 'chomp', 'v2');
const SPT = S2.table(flag('--spreads', path.join(OUT, 'spreads-sharded.json')));
const FXf = V2F.create(ENGINE.API, { mode: { spread: 'flat', field: true } });
const FXs = V2F.create(ENGINE.API, { mode: { spread: 'set', field: true }, spreads: SPT });
const P = PAIRS.load({ teamStore: flag('--team-store') });
const pairs = P[flag('--split', 'test')];

const Z = () => ({ n: 0, fastChanged: 0, fastFlipped: 0, ko: 0, sko: 0, h2: 0, dAbs: 0, dChanged: 0 });
const cmp = (acc, X, Y) => {
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    acc.n++;
    if (X.fast[i][j] !== Y.fast[i][j]) { acc.fastChanged++; if (Math.abs(X.fast[i][j] - Y.fast[i][j]) === 1) acc.fastFlipped++; }
    if (X.ko[i][j] !== Y.ko[i][j]) acc.ko++;
    if (X.sko[i][j] !== Y.sko[i][j]) acc.sko++;
    if (X.h2[i][j] !== Y.h2[i][j]) acc.h2++;
    const dd = Math.abs(X.d[i][j] - Y.d[i][j]); acc.dAbs += dd; if (dd > 1e-12) acc.dChanged++;
  }
};
const spread = Z(), field = {}, setters = { room: 0, tw: 0, weather: {}, terrain: {} };
const fz = k => (field[k] = field[k] || Object.assign(Z(), { sheets: 0 }));
let speedSP = { n: 0, cap: 0, zero: 0, mid: 0 };
for (const G of pairs) {
  const sheets = G.sheets;
  const Ff = FXf.pairFacts(sheets), Fs = FXs.pairFacts(sheets);
  for (const s of ['p1', 'p2']) cmp(spread, Fs[s], Ff[s]);
  for (const [s, o] of [['p1', 'p2'], ['p2', 'p1']]) {
    const B = Ff.bod[s];
    const W = new Set(), Tn = new Set(); let room = 0, tw = 0;
    for (const b of B) { for (const w of b._sets.weather) W.add(w); for (const t of b._sets.terrain) Tn.add(t); if (b._sets.room) room = 1; if (b._sets.tw) tw = 1; }
    const specs = [];
    if (room) { specs.push(['room', { room: 1 }]); setters.room++; }
    if (tw) { specs.push(['tailwind (own side)', { [s === 'p1' ? 'twA' : 'twB']: 1 }]); setters.tw++; }
    for (const w of W) { specs.push(['weather ' + w, { w }]); setters.weather[w] = (setters.weather[w] || 0) + 1; }
    for (const t of Tn) { specs.push(['terrain ' + t, { t }]); setters.terrain[t] = (setters.terrain[t] || 0) + 1; }
    for (const [name, spec] of specs) {
      const acc = fz(name); acc.sheets++;
      /* both directions: the setter's side on the other, and the other on the setter's side */
      cmp(acc, FXf.facts(Ff, s, spec), Ff[s]); cmp(acc, FXf.facts(Ff, o, spec), Ff[o]);
    }
  }
  for (const r of sheets.p1.concat(sheets.p2)) { const z = SPT.spreadOf(r); if (!z) continue; speedSP.n++; if (z.evs.spe === 32) speedSP.cap++; else if (z.evs.spe === 0) speedSP.zero++; else speedSP.mid++; }
}
const rate = a => ({ member_pairs: a.n, sheets: a.sheets, speed_order_changed: +(a.fastChanged / a.n).toFixed(4), speed_order_flipped: +(a.fastFlipped / a.n).toFixed(4),
  ko_from_full_changed: +(a.ko / a.n).toFixed(4), sure_ko_changed: +(a.sko / a.n).toFixed(4), sure_2hko_changed: +(a.h2 / a.n).toFixed(4),
  expected_hit_changed: +(a.dChanged / a.n).toFixed(4), expected_hit_mean_abs_change: +(a.dAbs / a.n).toFixed(4) });
const out = { what: 'solver/chomp/v2/fact_shift.js: member facts at the set spread vs the table stat line, and under each settable field vs the neutral field', release: ENGINE.id,
  split: flag('--split', 'test'), sheet_pairs: pairs.length, spreads: { file: SPT.file, lookups: SPT.COUNTERS, speed_sp_of_sheet_rows: speedSP },
  spread: rate(spread), field: Object.fromEntries(Object.entries(field).map(([k, a]) => [k, rate(a)])), setter_sheets: setters,
  counters: { flat: FXf.COUNTERS, set: FXs.COUNTERS } };
fs.writeFileSync(path.join(OUT, 'fact_shift.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ spread: out.spread, field: out.field }, null, 1));
