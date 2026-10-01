/* solver/rotom/respread.js — give an EXISTING ladder rotation the spreads of solver/rotom/spreads.js, changing nothing else.
 *
 *   node solver/rotom/respread.js --store <games.jsonl.gz> <rotation.json> [<rotation.json> ...]
 *   node solver/rotom/respread.js --observed-only <rotation.json> [...]     the observed hooks only; see observedSource
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

/* --observed-only (2026-10-01, abra/regmc 1.72.0): fold the OBSERVED hooks into a rotation WITHOUT re-deriving. Each set
 * asks the tournament hook, then the Smogon chain (spreads.js observedSpread over loadObserved()); a set neither serves
 * keeps its RECORDED spread byte for byte (spreads.recorded), so the derived sets, the population and the speed tiers the
 * file records stay exactly what the ladder has been playing. Needs no store. */
function observedSource(rot) {
  const rec = SP.recorded(rot), obs = SP.loadObserved(), tour = SP.loadTournament();
  const counters = { tournament: 0, observed: 0, recorded_derived: 0 };
  return {
    spreadFor(row) {
      const tz = SP.tournamentSpread(row, tour);
      if (tz) { counters.tournament++; return { evs: tz.evs, source: 'observed:tournament:' + tour.dir + ' ' + tz.team_id + (tz.n > 1 ? ' (best-placed of ' + tz.n + ')' : ''), role: SP.role(row).role }; }
      const o = SP.observedSpread(row, obs);
      if (o) { counters.observed++; return { evs: o.evs, source: 'observed:' + o.file + ' (' + o.pct + '%' + (o.weight != null ? ', weight ' + o.weight : '') + ')', role: SP.role(row).role }; }
      const z = rec.spreadFor(row);
      if (z.source !== 'derived') throw new Error('respread --observed-only: ' + SP.setKey(row) + ' was recorded ' + z.source + ' and no observed hook serves it now');
      counters.recorded_derived++; return z;
    },
    provenance() {
      const old = rot.spread_source;
      return { rule: old.rule, observed: obs ? { file: obs.file, sha256: obs.sha256, rule: SP.OBSERVED_RULE_TEXT, min_weight: SP.OBS_MIN_WEIGHT, files: obs.files } : 'none',
        population: old.population, speed_equilibrium: old.speed_equilibrium, median_quantile: old.median_quantile, top_tier_quantile: old.top_tier_quantile,
        counters: Object.assign({}, counters), derivation_counters: old.derivation_counters || old.counters,
        tournament: tour ? { rule: SP.TOURNAMENT_RULE_TEXT, dir: tour.dir, events: tour.events, teams: tour.teams, teams_with_spreads: tour.teams_with_spreads, sets: tour.sets, sets_with_spreads: tour.sets_with_spreads, keys: tour.keys } : 'none: no tournament store read' };
    },
  };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--observed-only')) {
    const files = argv.filter(a => a !== '--observed-only');
    if (!files.length) { console.error('usage: respread.js --observed-only <rotation.json> ...'); process.exit(2); }
    for (const f of files) {
      const rot = JSON.parse(fs.readFileSync(f, 'utf8'));
      const D = observedSource(rot);
      const ss = rot.spread_source;
      const o = respread(rot, D, { store: ss.store, store_sha256: ss.store_sha256, floor: ss.floor });
      o.respread.note = 'teams unchanged; Stat Points only; --observed-only: the tournament hook and the Smogon chain where they serve a set, the recorded derived spread elsewhere';
      fs.writeFileSync(f, JSON.stringify(o, null, 1) + '\n');
      console.log(rel(f) + ': ' + JSON.stringify(o.spread_source.counters));
      for (const t of o.teams) for (const z of t.spreads) console.log('  ' + t.id + ' ' + z.species.padEnd(16) + (z.item || '').padEnd(16) + z.nature.padEnd(9) + SP.evStr(z.evs).padEnd(16) + z.role.padEnd(10) + z.source.split(' ')[0].replace(/^observed:data\/smogon-stats\//, 'smogon:'));
    }
    return;
  }
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
module.exports = { respread, observedSource };
