/* solver/rotom/respread.js — give an EXISTING ladder rotation the spreads of solver/rotom/spreads.js, changing nothing else.
 *
 *   node solver/rotom/respread.js --store <games.jsonl.gz> <rotation.json> [<rotation.json> ...]
 *
 * The team choice is left exactly as it was built (same games, same sheets, same bring); only each set's Stat Points
 * change. Rebuilding instead would re-choose the teams on whatever the store holds today, which is a different question.
 * Every rewritten team must pass the bo3 TeamValidator and differ from the old one ONLY in `evs`, or nothing is written.
 * The population is the top-meta population of --store (build_top_rotation.topSides); one Deriver serves every file, so
 * two rotations re-spread in one run read one sample. Written into each file: teams[i].packed, teams[i].spreads,
 * spread_rule, spread_source (store + sha256 + floor + the deriver's provenance and counters).
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('../arena/env.js');
const X = require('../human/dex.js');
const B = require('./build_top_rotation.js');
const BA = require('./build_assets.js');
const SP = require('./spreads.js');
const { Teams } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));
const ROOT = path.join(__dirname, '..', '..');
const rel = f => path.relative(ROOT, path.resolve(f)).split(path.sep).join('/');

function respread(rot, D, stamp) {
  const out = JSON.parse(JSON.stringify(rot));
  for (const t of out.teams) {
    const old = Teams.unpack(t.packed);
    const rows = old.map(s => ({ species: s.species, item: s.item, ability: s.ability, nature: s.nature, moves: s.moves.slice(), gender: s.gender || '' }));
    const spreads = SP.teamSpreads(D, rows);
    const { sets, packed } = BA.packTeam(rows, spreads.map(z => z.evs));
    const pr = BA.validate(sets);
    if (pr) throw new Error(t.id + ' TeamValidator refused the re-spread team: ' + pr.join('; '));
    const now = Teams.unpack(packed);
    const strip = a => JSON.stringify(a.map(s => { const c = Object.assign({}, s); delete c.evs; return c; }));
    if (strip(now) !== strip(old)) throw new Error(t.id + ': re-spreading changed something other than the Stat Points');
    t.packed = packed; t.spreads = spreads;
  }
  out.spread_rule = SP.RULE_TEXT;
  out.spread_source = Object.assign({}, stamp, D.provenance());
  out.respread = { by: 'solver/rotom/respread.js', at: new Date().toISOString(), note: 'teams unchanged; Stat Points only' };
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--store');
  const store = i >= 0 ? argv[i + 1] : B.STORE_DEFAULT;
  const files = argv.filter((a, k) => a !== '--store' && k !== i + 1);
  if (!files.length) { console.error('usage: respread.js --store <store> <rotation.json> ...'); process.exit(2); }
  const t0 = Date.now();
  const games = B.readStore(store);
  const { D, T } = B.spreadDeriver(games);
  const stamp = { store: rel(store), store_sha256: crypto.createHash('sha256').update(fs.readFileSync(store)).digest('hex'), floor: T.FLOOR };
  console.log('population: floor ' + T.FLOOR + ', ' + JSON.stringify(D.provenance().population) + ', speed benchmark ' + D.eq.median_speed + ' (' + (Date.now() - t0) + ' ms)');
  const outs = files.map(f => [f, respread(JSON.parse(fs.readFileSync(f, 'utf8')), D, stamp)]);
  for (const [f, o] of outs) {
    fs.writeFileSync(f, JSON.stringify(o, null, 1) + '\n');
    console.log(rel(f) + ':');
    for (const t of o.teams) for (const z of t.spreads) console.log('  ' + t.id + ' ' + z.species.padEnd(16) + (z.item || '').padEnd(16) + z.nature.padEnd(9) + SP.evStr(z.evs).padEnd(16) + z.role + (z.speed ? ' spe ' + z.speed.effective : '') + (z.bulk ? ' survives ' + z.bulk.share_survived : ''));
  }
  console.log('counters ' + JSON.stringify(D.counters) + ' in ' + Math.round((Date.now() - t0) / 1000) + ' s');
}
if (require.main === module) main();
module.exports = { respread };
