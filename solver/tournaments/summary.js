/* solver/tournaments/summary.js — the OPS-style summary of the tournament store, for status.js / orient.js to print.
 *
 *   node solver/tournaments/summary.js [--regulation regmc] [--root <dir>] [--print]   -> data/tournaments/<reg>/summary.json
 *
 * Every figure is counted out of the store and validation.json on this run; nothing is typed. Reads the format's dex
 * (mega formes, species names), so it runs locally beside validate.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./store.js');
const A = require('./archetypes.js');

function summarise(reg, root, X) {
  const evs = S.events(reg, root);
  const teams = S.teams(reg, root);
  const vf = S.dirs(reg, root).validation;
  const V = fs.existsSync(vf) ? JSON.parse(fs.readFileSync(vf, 'utf8')) : null;
  const legal = t => V && V.by_team[t.team_id] ? V.by_team[t.team_id].ok : null;
  const byTier = {}, bySite = {}, species = {};
  for (const e of evs) byTier[e.tier] = (byTier[e.tier] || 0) + 1;
  for (const t of teams) { bySite[t.source.site] = (bySite[t.source.site] || 0) + 1; for (const sp of A.sixOf(t, X)) species[sp] = (species[sp] || 0) + 1; }
  const masters = teams.filter(t => t.division === 'masters' && legal(t) !== false);
  const cl = A.cluster(masters.map(t => ({ team: t, ev: t.ev })), X);
  const setsTot = teams.reduce((a, t) => a + t.sets.length, 0), setsSp = teams.reduce((a, t) => a + (t.has_spreads ? t.sets.filter(s => s.evs).length : 0), 0);
  return {
    generated: new Date().toISOString(), builder: 'solver/tournaments/summary.js', regulation: reg, store: path.relative(S.ROOT, S.dirs(reg, root).base).split(path.sep).join('/'),
    events: evs.map(e => ({ key: e.key, name: e.name, tier: e.tier, region: e.region, country: e.country || null, start: e.start, players: e.players, teams: e.teams,
                            teams_with_spreads: e.teams_with_spreads, top_cut_listed: e.listed, sources: Object.keys(e.sources || {}) })),
    totals: { events: evs.length, teams: teams.length, masters_teams: teams.filter(t => t.division === 'masters').length, by_tier: byTier, by_site: bySite,
              validation: V ? { checked: V.teams, legal: V.legal, illegal: V.illegal, checkout_commit: V.checkout_commit, stale: V.teams !== teams.length } : 'not run (node solver/tournaments/validate.js)' },
    spread_coverage: { teams_with_spreads: teams.filter(t => t.has_spreads).length, teams: teams.length, sets_with_spreads: setsSp, sets: setsTot,
                       note: 'an open team sheet carries no spreads; a team has spreads only when its paste published them' },
    archetypes: { rule: 'solver/tournaments/archetypes.js: leader clustering at >= ' + A.SHARE + ' shared species, team weight = tier x log-size x 1/sqrt(placing); legal Masters teams',
                  clusters: cl.length, top: cl.slice(0, 15).map(c => ({ label: c.label, weight: +c.weight.toFixed(3), teams: c.members.length, leader: c.leader.team.team_id,
                                                                         leader_player: c.leader.team.player, core: c.core.slice(0, 8) })) },
    species_teams: Object.entries(species).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([sp, n]) => [X ? X.D.species.get(sp).name : sp, n]),
  };
}

function run(argv) {
  const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const reg = flag('regulation', process.env.ABRA_REGULATION || 'regmc');
  process.env.ABRA_REGULATION = reg;
  if (reg === 'regmc') require('../arena/env.js');
  const X = require('../human/dex.js');
  const root = flag('root', null);
  const out = summarise(reg, root, X);
  const f = S.dirs(reg, root).summary;
  fs.writeFileSync(f, JSON.stringify(out, null, 1) + '\n');
  const T = out.totals;
  console.log('tournament store ' + out.store + ': ' + T.events + ' events, ' + T.teams + ' teams (' + T.masters_teams + ' Masters); tiers ' + JSON.stringify(T.by_tier) +
              '; validation ' + (typeof T.validation === 'string' ? T.validation : T.validation.legal + ' legal / ' + T.validation.illegal + ' illegal') +
              '; spreads on ' + out.spread_coverage.teams_with_spreads + ' of ' + out.spread_coverage.teams + ' teams');
  if (argv.includes('--print')) for (const c of out.archetypes.top) console.log('  ' + c.weight.toFixed(2).padStart(6) + '  ' + String(c.teams).padStart(3) + ' teams  ' + c.label + '   (leader ' + c.leader + ')');
  return out;
}

if (require.main === module) { try { run(process.argv.slice(2)); } catch (e) { console.error(e.stack || e); process.exit(1); } }
module.exports = { summarise, run };
