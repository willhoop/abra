/* solver/tournaments/compare_spreads.js — how far the REAL published Stat Points are from the ones we DERIVE for the
 * same set. Read-only on the store; writes solver/out/tournaments/spread-compare.json.
 *
 *   node solver/tournaments/compare_spreads.js [--store <ladder games.jsonl.gz>]
 *
 * For every set in the tournament store whose paste publishes Champions Stat Points: the derived spread
 * (solver/rotom/spreads.js Deriver.derive, the role rule against the ladder's top-meta population — the hook bypassed),
 * and the per-stat difference, the Speed SP and the EFFECTIVE Speed (the sim's) both ways. Also every set of the
 * existing ladder rotations with the same species + item + nature, with its recorded spread.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
require('../arena/env.js');
const X = require('../human/dex.js');
const B = require('../rotom/build_top_rotation.js');
const SP = require('../rotom/spreads.js');
const TS = require('./store.js');
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const ROOT = path.join(__dirname, '..', '..');

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--store');
  const store = i >= 0 ? argv[i + 1] : B.STORE_DEFAULT;
  const pub = [];
  for (const t of TS.teams('regmc')) if (t.spread_kind === 'stat_points') for (const s of t.sets) if (s.evs) pub.push({ t, s });
  const games = B.readStore(store);
  const { D } = B.spreadDeriver(games, { tournament: null });
  const rots = ['ladder-rotation.json', 'ladder-rotation-top.json'].map(f => [f, JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'rotom', 'teams', f), 'utf8'))]);
  const rows = [];
  for (const { t, s } of pub) {
    const row = B.rowOf(s);
    if (!row) { rows.push({ team_id: t.team_id, species: s.species, skipped: 'does not resolve in the format' }); continue; }
    const d = D.derive(row);
    const spe = D.speeds(row);
    const diff = {}; for (const k of STATS) diff[k] = d.evs[k] - s.evs[k];
    const l1 = STATS.reduce((a, k) => a + Math.abs(diff[k]), 0);
    const inRot = [];
    for (const [f, r] of rots) for (const rt of r.teams) for (const z of rt.spreads || []) if (SP.tourKey(z.species, z.item, z.nature) === SP.tourKey(row.species, row.item, row.nature)) inRot.push({ file: f, team: rt.id, evs: z.evs, source: z.source });
    rows.push({ team_id: t.team_id, player: t.player, best_results: t.best_results || null, species: row.species, item: row.item, nature: row.nature,
                published: s.evs, derived: d.evs, diff, l1, role: d.role,
                speed: { published_sp: s.evs.spe, derived_sp: d.evs.spe, published_eff: spe[s.evs.spe], derived_eff: spe[d.evs.spe], derived_why: d.speed && d.speed.why },
                in_rotations: inRot });
  }
  const ok = rows.filter(r => !r.skipped);
  const mean = f => ok.length ? +(ok.reduce((a, r) => a + f(r), 0) / ok.length).toFixed(2) : null;
  const out = { generated: new Date().toISOString(), builder: 'solver/tournaments/compare_spreads.js', store: path.relative(ROOT, store).split(path.sep).join('/'),
                population: D.provenance().population, speed_equilibrium: { median: D.eq.median_speed, top: D.eq.top_speed },
                sets: ok.length, identical: ok.filter(r => r.l1 === 0).length, mean_l1_sp: mean(r => r.l1), mean_abs_speed_sp: mean(r => Math.abs(r.diff.spe)),
                speed_sp_equal: ok.filter(r => r.diff.spe === 0).length, effective_speed_equal: ok.filter(r => r.speed.published_eff === r.speed.derived_eff).length,
                derived_faster: ok.filter(r => r.speed.derived_eff > r.speed.published_eff).length, derived_slower: ok.filter(r => r.speed.derived_eff < r.speed.published_eff).length,
                rows };
  const f = path.join(ROOT, 'solver', 'out', 'tournaments', 'spread-compare.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(out, null, 1) + '\n');
  console.log(out.sets + ' published sets: ' + out.identical + ' identical to the derived spread; mean |diff| ' + out.mean_l1_sp + ' SP a set; Speed SP equal on ' + out.speed_sp_equal + ', effective Speed equal on ' + out.effective_speed_equal +
              ' (derived faster on ' + out.derived_faster + ', slower on ' + out.derived_slower + '); mean |Speed SP diff| ' + out.mean_abs_speed_sp);
  for (const r of ok) console.log('  ' + r.species.padEnd(15) + (r.item || '').padEnd(15) + r.nature.padEnd(8) + ' published ' + SP.evStr(r.published).padEnd(16) + ' derived ' + SP.evStr(r.derived).padEnd(16) +
                                  ' Spe ' + r.speed.published_eff + ' vs ' + r.speed.derived_eff + (r.in_rotations.length ? '  [in ' + r.in_rotations.map(x => x.file + ' ' + x.team + ' ' + SP.evStr(x.evs)).join('; ') + ']' : ''));
  for (const r of rows.filter(r => r.skipped)) console.log('  SKIP ' + r.team_id + ' ' + r.species + ': ' + r.skipped);
  console.log('-> ' + path.relative(ROOT, f));
}
if (require.main === module) main();
