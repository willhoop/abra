/* solver/meta/smogon_month.js — read one archived Smogon month for Reg M-C: the bo3 (open sheet) ladder against the bo1
 * (closed sheet) one. Read-only; writes solver/out/meta/smogon-<month>.json. (2026-10-01, abra/regmc 1.72.0.)
 *
 *   node solver/meta/smogon_month.js [--month 2026-09] [--cutoff 1500] [--top-cutoff 1630]
 *
 * WHAT IT READS: data/smogon-stats/<month>/usage/<format>-<cutoff>.txt (Usage % = the weighted share of teams carrying the
 * species) and .../moveset/<format>-<cutoff>.txt (each species' item shares, over its own weighted appearances), parsed by
 * solver/rotom/spreads.js parseMovesetFull. Both formats come from engine/regulation.js through solver/human/dex.js.
 *
 * ITEM RATE PER TEAM = sum over species of Usage % x the species' item share: the expected number of team slots holding the
 * item. Where the format has Item Clause (read from the validator's rule table, never assumed) no team holds an item twice,
 * so the rate IS the share of teams holding it. LIMIT, STATED: a moveset block lists a species' top items only and puts the
 * rest under "Other", so every rate is a LOWER bound; the unlisted mass is reported.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
require('../arena/env.js');
const X = require('../human/dex.js');
const SP = require('../rotom/spreads.js');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MONTH = flag('--month', '2026-09'), CUT = +flag('--cutoff', 1500), TOPCUT = +flag('--top-cutoff', 1630);
const DIR = path.join(ROOT, 'data', 'smogon-stats', MONTH);
const FMT = { bo3: X.FORMAT, bo1: X.SINGLES_FORMAT };

function usage(fmt, cut) {
  const f = path.join(DIR, 'usage', fmt + '-' + cut + '.txt');
  const txt = fs.readFileSync(f, 'utf8');
  const battles = +(/Total battles:\s*(\d+)/.exec(txt) || [])[1];
  const rows = [];
  for (const l of txt.split(/\r?\n/)) {
    const m = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*([\d.]+)%\s*\|\s*(\d+)\s*\|/.exec(l);
    if (m) rows.push({ rank: +m[1], species: m[2], usage: +m[3], raw: +m[4] });
  }
  return { file: path.relative(ROOT, f).split(path.sep).join('/'), battles, rows };
}
function moveset(fmt, cut) { return SP.parseMovesetFull(fs.readFileSync(path.join(DIR, 'moveset', fmt + '-' + cut + '.txt'), 'utf8')); }
function itemRates(fmt, cut) {
  const U = usage(fmt, cut), M = moveset(fmt, cut);
  const rate = {}; let unlisted = 0, missing = 0;
  for (const r of U.rows) {
    const id = X.D.species.get(r.species).exists ? X.D.species.get(r.species).id : X.toID(r.species);
    const e = M[id]; if (!e) { missing += r.usage / 100; continue; }
    const listed = e.items.reduce((a, x) => a + x.pct, 0);
    unlisted += r.usage / 100 * Math.max(0, 100 - listed) / 100;
    for (const it of e.items) rate[it.name] = (rate[it.name] || 0) + r.usage / 100 * it.pct / 100;
  }
  return { usage: U, rate, unlisted_slots_per_team: +unlisted.toFixed(4), species_without_block_slots_per_team: +missing.toFixed(4), slots_per_team: +(U.rows.reduce((a, r) => a + r.usage, 0) / 100).toFixed(3) };
}

const { TeamValidator } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));
const itemClause = {}; for (const [k, f] of Object.entries(FMT)) itemClause[k] = [...TeamValidator.get(f).ruleTable.keys()].filter(r => /itemclause/i.test(r));

const B3 = itemRates(FMT.bo3, CUT), B1 = itemRates(FMT.bo1, CUT);
const scarf = { bo3: +(B3.rate['Choice Scarf'] || 0).toFixed(4), bo1: +(B1.rate['Choice Scarf'] || 0).toFixed(4) };
const items = [...new Set([...Object.keys(B3.rate), ...Object.keys(B1.rate)])].map(n => ({ item: n, bo3: +(B3.rate[n] || 0).toFixed(4), bo1: +(B1.rate[n] || 0).toFixed(4), diff: +((B3.rate[n] || 0) - (B1.rate[n] || 0)).toFixed(4) }))
  .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
const top = usage(FMT.bo3, TOPCUT);
const out = { what: 'Smogon ' + MONTH + ' Reg M-C: bo3 (open sheet) vs bo1 (closed sheet)', generated: new Date().toISOString(), month: MONTH, cutoff: CUT, top_cutoff: TOPCUT,
  formats: FMT, item_clause: itemClause, battles: { bo3: B3.usage.battles, bo1: B1.usage.battles }, files: { bo3: B3.usage.file, bo1: B1.usage.file, top: top.file },
  choice_scarf_per_team: scarf, lower_bound_note: { bo3_unlisted_item_slots_per_team: B3.unlisted_slots_per_team, bo1_unlisted_item_slots_per_team: B1.unlisted_slots_per_team, bo3_slots_per_team: B3.slots_per_team, bo1_slots_per_team: B1.slots_per_team },
  items_by_abs_diff: items, top20_bo3: top.rows.slice(0, 20) };
const of = path.join(ROOT, 'solver', 'out', 'meta', 'smogon-' + MONTH + '.json');
fs.mkdirSync(path.dirname(of), { recursive: true });
fs.writeFileSync(of, JSON.stringify(out, null, 1) + '\n');
console.log('battles bo3 ' + B3.usage.battles + ', bo1 ' + B1.usage.battles + ' (' + CUT + '+); item clause bo3 ' + JSON.stringify(itemClause.bo3) + ', bo1 ' + JSON.stringify(itemClause.bo1));
console.log('Choice Scarf per team (' + CUT + '+): bo3 ' + (100 * scarf.bo3).toFixed(1) + '%, bo1 ' + (100 * scarf.bo1).toFixed(1) + '%  (unlisted item slots/team: bo3 ' + B3.unlisted_slots_per_team + ', bo1 ' + B1.unlisted_slots_per_team + ')');
console.log('items, bo3 - bo1 per team, largest first:'); for (const x of items.slice(0, 8)) console.log('  ' + x.item.padEnd(18) + ' bo3 ' + (100 * x.bo3).toFixed(1).padStart(5) + '%  bo1 ' + (100 * x.bo1).toFixed(1).padStart(5) + '%  ' + (x.diff >= 0 ? '+' : '') + (100 * x.diff).toFixed(1));
console.log('top 20 bo3 ' + TOPCUT + '+ (' + top.battles + ' battles):'); for (const r of top.rows.slice(0, 20)) console.log('  ' + String(r.rank).padStart(2) + ' ' + r.species.padEnd(18) + r.usage.toFixed(2) + '%');
console.log('wrote ' + path.relative(ROOT, of));
