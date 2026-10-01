/* solver/rotom/observed_compare.js — how far the ROLE-DERIVED spreads were from the OBSERVED ones (Smogon's monthly
 * Reg M-C moveset files through solver/rotom/spreads.js's observed chain). Read-only; writes
 * solver/out/rotom/observed-compare.json. (2026-10-01, abra/regmc 1.72.0; docs/_reports/2026-10-01-smogon-sept.md.)
 *
 *   node solver/rotom/observed_compare.js [--rotations <git-rev>]
 *
 * TWO POPULATIONS OF SETS.
 *   rotations    every set of every ladder rotation (ladder-rotation*.json). The DERIVED spread is the one the file
 *                records when its source is `derived`; read from --rotations <rev> (default HEAD: the files before they
 *                were re-spread), so the comparison is against what the ladder actually played.
 *   tournament   every set in the tournament store (data/tournaments/regmc; open sheets, no Stat Points published). The
 *                DERIVED spread is the arena's role-v1 table entry (solver/arena/spreads/role-v1.json: the same rule on
 *                the same population, MEDICHAM oracles); a set the table does not hold is derived here the way the arena
 *                derives it at play time (MediDeriver, the table's population and release), and counted.
 * For each set the observed spread is spreads.observedSpread over the full chain. Per set: L1 distance in Stat Points,
 * Speed SP both ways, and the Speed STAT both ways at the battle forme and the sheet nature (solver/xatu/sd.js statValue,
 * the checkout's statModify; abilities and items not applied). Summaries: covered share, mean / median L1, the share
 * whose Speed stat differs, and the mean absolute Speed stat difference; by chain level.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
require('../arena/env.js');
const X = require('../human/dex.js');
const SD = require('../xatu/sd.js');
const SP = require('./spreads.js');
const B = require('./build_top_rotation.js');
const SS = require('../arena/spread_source.js');
const TS = require('../tournaments/store.js');
const ROOT = path.join(__dirname, '..', '..');
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const argv = process.argv.slice(2);
const REV = argv.includes('--rotations') ? argv[argv.indexOf('--rotations') + 1] : 'HEAD';

const obs = SP.loadObserved();
if (!obs) { console.log('NO OBSERVED FILES under data/smogon-stats/ for this regulation'); process.exit(2); }
const speStat = (row, v) => SD.statValue(SP.forme(row).species, row.nature, 'spe', v);
function cmp(row, derived) {
  const o = SP.observedSpread(row, obs);
  if (!o) return { covered: false };
  const l1 = STATS.reduce((a, k) => a + Math.abs((derived[k] | 0) - o.evs[k]), 0);
  const sd = speStat(row, derived.spe | 0), so = speStat(row, o.evs.spe);
  return { covered: true, level: (o.format === X.FORMAT ? 'bo3-' : 'bo1-') + o.cutoff, weight: o.weight, pct: o.pct, derived: SP.evStr(derived), observed: SP.evStr(o.evs), l1,
    spe_sp: [derived.spe | 0, o.evs.spe], spe_stat: [sd, so], spe_stat_diff: so - sd };
}
function summary(rows) {
  const c = rows.filter(r => r.covered);
  const l1 = c.map(r => r.l1).sort((a, b) => a - b);
  const byLevel = {}; for (const r of c) byLevel[r.level] = (byLevel[r.level] || 0) + 1;
  const n = c.length || 1;
  return { sets: rows.length, covered: c.length, covered_share: rows.length ? +(c.length / rows.length).toFixed(3) : null, by_level: byLevel,
    identical: c.filter(r => r.l1 === 0).length, l1_mean: +(l1.reduce((a, x) => a + x, 0) / n).toFixed(2), l1_median: l1.length ? l1[Math.floor(l1.length / 2)] : null,
    speed_stat_differs: c.filter(r => r.spe_stat_diff !== 0).length, speed_stat_abs_mean: +(c.reduce((a, r) => a + Math.abs(r.spe_stat_diff), 0) / n).toFixed(2),
    observed_faster: c.filter(r => r.spe_stat_diff > 0).length, observed_slower: c.filter(r => r.spe_stat_diff < 0).length };
}

/* ---------- rotations, as committed at REV ---------- */
const rotFiles = fs.readdirSync(path.join(ROOT, 'solver', 'rotom', 'teams')).filter(f => /^ladder-rotation.*\.json$/.test(f)).sort();
const rot = {};
for (const f of rotFiles) {
  const rel = 'solver/rotom/teams/' + f;
  const J = JSON.parse(cp.execFileSync('git', ['show', REV + ':' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }));
  const rows = [];
  for (const t of J.teams) for (const z of t.spreads) {
    const row = { species: z.species, item: z.item, ability: z.ability, nature: z.nature, moves: z.moves.slice() };
    if (z.source !== 'derived') { rows.push({ team: t.id, species: z.species, item: z.item, nature: z.nature, covered: false, skipped: 'recorded source ' + z.source }); continue; }
    rows.push(Object.assign({ team: t.id, species: z.species, item: z.item, nature: z.nature, role: z.role }, cmp(row, z.evs)));
  }
  rot[f] = { summary: summary(rows.filter(r => !r.skipped)), skipped: rows.filter(r => r.skipped).length, rows };
}

/* ---------- the tournament store, against the arena's role-v1 table ---------- */
const TABLE = JSON.parse(fs.readFileSync(SS.TABLE_FILE, 'utf8'));
const seen = new Map(); let notInTable = 0, unresolved = 0, teams = 0, derivedFailed = 0;
/* a tournament set the table does not hold: the SAME derivation the arena does at play time (spread_source derive:
 * solver/chomp/v2/spreads.js MediDeriver on the table's own population, observed pinned off, MEDICHAM on the table's
 * own release) */
let MD = null;
function deriveMissing(row) {
  if (!MD) { const E = require('../arena/engine.js').load(TABLE.provenance.release); MD = require('../chomp/v2/spreads.js').make({ M: E.API.M }, SS.population(), { observed: null }); }
  const z = MD.spreadFor(row); if (MD._hits.size > 64) MD._hits.clear();
  return SS.encode(z.evs, z.role);
}
for (const t of TS.teams('regmc')) {
  teams++;
  for (const s of t.sets || []) {
    const row = B.rowOf(s);
    if (!row) { unresolved++; continue; }
    const k = SP.setKey(row);
    if (seen.has(k)) { seen.get(k).n++; continue; }
    let v = TABLE.spreads[k], how = 'table';
    if (!v) { notInTable++; try { v = deriveMissing(row); how = 'derived here'; } catch (e) { derivedFailed++; } }
    if (!v) { seen.set(k, { n: 1, species: row.species, item: row.item, nature: row.nature, covered: false, skipped: 'not in the role-v1 table and could not be derived' }); continue; }
    seen.set(k, Object.assign({ n: 1, species: row.species, item: row.item, nature: row.nature, role: SS.decode(v).role, derived_from: how }, cmp(row, SS.decode(v).evs)));
  }
}
const tRows = [...seen.values()];
const tour = { teams, distinct_sets: tRows.length, unresolved_sets: unresolved, not_in_table: notInTable, not_in_table_derived_failed: derivedFailed, summary: summary(tRows.filter(r => !r.skipped)),
  summary_by_use: (() => { const c = tRows.filter(r => r.covered); const w = c.reduce((a, r) => a + r.n, 0) || 1; return { set_uses: tRows.reduce((a, r) => a + r.n, 0), covered_uses: c.reduce((a, r) => a + r.n, 0),
    speed_stat_differs_uses: c.filter(r => r.spe_stat_diff !== 0).reduce((a, r) => a + r.n, 0), l1_mean_by_use: +(c.reduce((a, r) => a + r.l1 * r.n, 0) / w).toFixed(2) }; })(),
  rows: tRows.sort((a, b) => b.n - a.n) };

const out = { what: 'role-derived vs observed (Smogon chain) Stat Point spreads, per set', generated: new Date().toISOString(), rotations_rev: REV,
  observed: { files: obs.files, rule: SP.OBSERVED_RULE_TEXT, min_weight: SP.OBS_MIN_WEIGHT }, role_table: { file: 'solver/arena/spreads/role-v1.json', built: TABLE.provenance.built },
  rotations: rot, tournament: tour };
const of = path.join(ROOT, 'solver', 'out', 'rotom', 'observed-compare.json');
fs.mkdirSync(path.dirname(of), { recursive: true });
fs.writeFileSync(of, JSON.stringify(out, null, 1) + '\n');
for (const [f, r] of Object.entries(rot)) console.log(f.padEnd(28) + JSON.stringify(r.summary) + (r.skipped ? ' skipped ' + r.skipped : ''));
console.log('tournament'.padEnd(28) + JSON.stringify(tour.summary) + ' ' + JSON.stringify(tour.summary_by_use) + ' not_in_table ' + notInTable + ' unresolved ' + unresolved);
console.log('wrote ' + path.relative(ROOT, of));
