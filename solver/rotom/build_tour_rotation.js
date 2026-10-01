/* solver/rotom/build_tour_rotation.js — ROTOM's TOURNAMENT rotation: 3-5 real top-cut teams from Reg M-C open-team-list
 * events, built from the tournament store (data/tournaments/<regulation>/, solver/tournaments/). Nothing here is typed.
 *
 *   tools\lownode.cmd solver/rotom/build_tour_rotation.js [--store <ladder games.jsonl.gz>] [--out <file>]
 *
 * WHY (Will, 2026-10-01). The top-meta rotation (build_top_rotation.js) needs the EXACT same six from >= 2 top ladder
 * players; that bar shut out archetypes that win events (Mega Garchomp-Z, Psyspam), and its spreads are derived. The
 * tournament store holds the teams that actually placed, with sources. This builder reads only the store for the TEAM
 * CHOICE; the ladder store is read only for the two things a tournament list does not carry (below).
 *
 * THE RULE (pre-stated; the output records it):
 *   1. pool: every MASTERS team in the tournament store whose sheet passes the format's TeamValidator (validation.json,
 *      re-run here if it is missing or does not cover the store) and whose every set resolves in the format's dex.
 *   2. weight and archetype: solver/tournaments/archetypes.js — w = tier x log-size x 1/sqrt(placing); leader clustering
 *      at >= 4 shared species, so no two picked teams share more than 3 species.
 *   3. pick: clusters in descending summed weight (how much of the published top field the archetype is), each played
 *      as its LEADER — its single heaviest team, i.e. its best placing at its biggest event, as published — skipping a
 *      cluster whose leader would put a mega forme on more than MEGA_CAP (2) picked teams, until MAX_TEAMS are picked.
 *      THE MEGA CAP WAS ADDED AFTER READING THE FIRST CLUSTER TABLE (2026-10-01), not before: without it three of the
 *      five picks carried Raichu-Mega-Y (clusters 2, 3 and 5), which is one archetype's matchup three times. It is a
 *      variety judgement, stated as one; the uncapped pick is recorded beside it (clusters_considered).
 *      3-5 teams (Will, solver/PLAN.md Q4); rotom.js refuses any other count.
 *   4. the spread: solver/rotom/spreads.js — the tournament store's published Stat Points for that species + item +
 *      nature where any exist, else the Smogon file, else DERIVED against the ladder's top-meta population (the same
 *      population as build_top_rotation.js; --store). The source of every set's spread is recorded.
 *   5. the fallback bring (only used if CHOMP throws or answers illegally): the human-modal bring and lead for this six
 *      (solver/chomp/human_prior.js over the human dataset's TRAIN sides). A tournament list records no bring.
 * Output: solver/rotom/teams/ladder-rotation-tour.json, the ladder-rotation shape, each team with `source` (event,
 * placing, player, record, paste / team-list URL, page) so every series row's team_meta carries it (ladder.js).
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
const TS = require('../tournaments/store.js');
const TA = require('../tournaments/archetypes.js');
const TV = require('../tournaments/validate.js');

const RULE = { MIN_TEAMS: 3, MAX_TEAMS: 5, MEGA_CAP: 2, SHARE: TA.SHARE, TIER_W: TA.TIER_W, size: 'log10(max(players,10))/3', place: '1/sqrt(placing)', division: 'masters' };
const ROOT = path.join(__dirname, '..', '..');
const rel = f => path.relative(ROOT, path.resolve(f)).split(path.sep).join('/');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const toID = X.toID;

function validation(reg, teams) {
  const f = TS.dirs(reg).validation;
  let V = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  if (!V || teams.some(t => !V.by_team[t.team_id])) V = { by_team: TV.validateTeams(teams, X), rerun: true };
  return V;
}

/* the fallback bring: the human-modal option for this six */
let HP = null;
function bringFor(rows) {
  if (!HP) { const D = require('../chomp/data.js'); HP = require('../chomp/human_prior.js').fit(D.headers().games); }
  const O = require('../chomp/options.js');
  const sheet = rows.map(r => ({ species: r.species, species_id: X.D.species.get(r.species).id, item: r.item }));
  return O.OPTIONS[HP.modal(sheet)].order.slice();
}

function build(o) {
  o = Object.assign({ regulation: 'regmc', store: B.STORE_DEFAULT }, o || {});
  const all = TS.teams(o.regulation);
  const V = validation(o.regulation, all);
  const masters = all.filter(t => t.division === RULE.division);
  const illegal = masters.filter(t => !V.by_team[t.team_id].ok);
  const pool = [], unresolved = [];
  for (const t of masters) {
    if (!V.by_team[t.team_id].ok) continue;
    const rows = t.sets.map(B.rowOf);
    if (rows.some(r => !r)) { unresolved.push(t.team_id); continue; }
    pool.push({ team: t, ev: t.ev, rows });
  }
  const clusters = TA.cluster(pool, X);
  const picked = [], megaN = {}, why = new Map();
  for (const c of clusters) {
    if (picked.length >= RULE.MAX_TEAMS) break;
    const megas = TA.megasOf(c.leader.team, X);
    const over = megas.filter(m => (megaN[m] || 0) >= RULE.MEGA_CAP);
    if (over.length) { why.set(c, 'skipped: ' + over.join(', ') + ' already on ' + RULE.MEGA_CAP + ' picked teams'); continue; }
    for (const m of megas) megaN[m] = (megaN[m] || 0) + 1;
    picked.push(c); why.set(c, 'picked');
  }
  /* the spread source: one Deriver over the ladder's top-meta population (with the tournament hook on by default) */
  const games = o.deriver ? null : B.readStore(o.store);
  const { D: SPD, T } = o.deriver ? { D: o.deriver, T: { FLOOR: null } } : B.spreadDeriver(games);
  const teams = picked.map((c, i) => {
    const L = c.leader, t = L.team, ev = L.ev;
    const rows = L.rows;
    const spreads = SP.teamSpreads(SPD, rows);
    const { sets, packed } = BA.packTeam(rows, spreads.map(z => z.evs));
    const pr = BA.validate(sets);
    if (pr) throw new Error(t.team_id + ': TeamValidator refused the packed team: ' + pr.join('; '));
    const url = t.source.paste || t.source.team;
    return {
      id: 'U' + (i + 1),
      archetype: { id: 'tour:' + c.leader.six.join(','), label: c.label, source: 'solver/tournaments/archetypes.js cluster ' + (clusters.indexOf(c) + 1) + ' of ' + clusters.length + ' by summed weight' },
      from_game: null, rating: null, player: t.player,
      source: { event: ev.key, event_name: ev.name, tier: ev.tier, region: ev.region || null, country: ev.country || null, date: ev.start, players: ev.players,
                placing: t.placing, record: t.record || null, player: t.player, handle: t.handle || null, url, page: t.source.page, site: t.source.site, team_id: t.team_id,
                spreads_published: !!t.has_spreads },
      tournament: { weight: +L.w.toFixed(4), cluster_weight: +c.weight.toFixed(4), cluster_teams: c.members.length,
                    cluster_members: c.members.slice(0, 12).map(m => ({ team_id: m.team.team_id, placing: m.team.placing, event: m.ev.key, w: +m.w.toFixed(4) })), core: c.core.slice(0, 8) },
      six_ids: rows.map(r => X.D.species.get(r.species).id), species: rows.map(r => r.species),
      bring: o.bring ? o.bring(rows) : bringFor(rows), bring_source: 'solver/chomp/human_prior.js modal option (the fallback when CHOMP throws or answers illegally; a tournament list records no bring)',
      packed, spreads };
  });
  return {
    generated: new Date().toISOString(), format: X.FORMAT, checkout: path.basename(X.SHOWDOWN_PATH), builder: 'solver/rotom/build_tour_rotation.js',
    source: { tournament_store: rel(TS.dirs(o.regulation).base), events: TS.events(o.regulation).map(e => ({ key: e.key, name: e.name, tier: e.tier, players: e.players, teams: e.teams,
                                                                                                         shard_sha256: e.shard_sha256, sources: e.sources })),
              validation: V.rerun ? 'validated in this build' : rel(TS.dirs(o.regulation).validation) },
    rule: Object.assign({}, RULE, { pool_teams: pool.length, masters_teams: masters.length, illegal_masters: illegal.map(t => t.team_id), unresolved: unresolved,
                                    clusters: clusters.length, text: 'pool = legal Masters teams of the tournament store; weight = TIER_W[tier] x log10(max(players,10))/3 x 1/sqrt(placing); leader clustering at >= ' + RULE.SHARE + ' shared species; clusters in descending weight, each played as its leader (its heaviest team) with the real published sheet, skipping a cluster that would put a mega forme on more than ' + RULE.MEGA_CAP + ' picked teams, up to ' + RULE.MAX_TEAMS + ' teams (the cap was set after reading the first cluster table; see the builder header).' }),
    clusters_considered: clusters.slice(0, 12).map((c, i) => ({ rank: i + 1, label: c.label, weight: +c.weight.toFixed(4), teams: c.members.length, leader: c.leader.team.team_id,
                                                                leader_player: c.leader.team.player, leader_url: c.leader.team.source.paste || c.leader.team.source.team, megas: TA.megasOf(c.leader.team, X), picked: picked.includes(c), uncapped_pick: i < RULE.MAX_TEAMS, why: why.get(c) || 'not reached' })),
    spread_rule: SP.RULE_TEXT,
    spread_source: Object.assign({ store: o.deriver ? null : rel(o.store), store_sha256: o.deriver ? null : sha(o.store), floor: T.FLOOR }, SPD.provenance()),
    validator: 'Showdown TeamValidator.get(' + X.FORMAT + ') on the Reg M-C checkout — every team below passed',
    teams };
}

/* every tournament rotation team: 3-5 teams, validates, complete and legal, its source names an event / placing / URL that
 * the tournament store holds with the same six sets, its packed spreads equal its recorded spreads, and no two teams share
 * more than SHARE-1 species. -> problems (empty = pass). */
function checkTour(rot, opts) {
  const bad = [];
  const { Teams, TeamValidator } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));
  if (rot.format !== X.FORMAT) bad.push('format ' + rot.format);
  if (!(rot.teams.length >= RULE.MIN_TEAMS && rot.teams.length <= RULE.MAX_TEAMS)) bad.push('rotation holds ' + rot.teams.length + ' teams, not 3-5');
  const V = TeamValidator.get(X.FORMAT);
  const store = new Map(((opts && opts.teams) || TS.teams('regmc')).map(t => [t.team_id, t]));
  for (const t of rot.teams) {
    const sets = Teams.unpack(t.packed);
    const pr = V.validateTeam(sets);
    if (pr) bad.push(t.id + ' TeamValidator: ' + pr.slice(0, 2).join('; '));
    if (!sets || sets.length !== 6) { bad.push(t.id + ' does not hold six'); continue; }
    const s = t.source || {};
    if (!(s.event && s.placing > 0 && /^https:\/\//.test(s.url || '') && /^https:\/\//.test(s.page || ''))) bad.push(t.id + ' source incomplete: ' + JSON.stringify(s));
    const st = store.get(s.team_id);
    if (!st) { bad.push(t.id + ' source team ' + s.team_id + ' is not in the tournament store'); continue; }
    if (st.placing !== s.placing || st.event !== s.event || (st.source.paste || st.source.team) !== s.url) bad.push(t.id + ' source disagrees with the store row ' + s.team_id);
    /* the sheet played is the sheet published: species, item, ability, nature, moves */
    const norm = x => [X.D.species.get(x.species).id, toID(x.item), toID(x.ability), toID(x.nature), (x.moves || []).map(toID).sort().join(',')].join('|');
    const a = sets.map(norm).sort().join(' ; '), b = st.sets.map(norm).sort().join(' ; ');
    if (a !== b) bad.push(t.id + ' plays a sheet that differs from the published one');
    /* the packed Stat Points are the recorded spreads, set by set */
    for (let i = 0; i < 6; i++) {
      const z = t.spreads && t.spreads[i];
      if (!z) { bad.push(t.id + ' no recorded spread for slot ' + i); continue; }
      const evs = Object.assign({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, sets[i].evs);
      if (['hp', 'atk', 'def', 'spa', 'spd', 'spe'].some(k => evs[k] !== z.evs[k])) bad.push(t.id + ' ' + sets[i].species + ' packed Stat Points ' + SP.evStr(evs) + ' != recorded ' + SP.evStr(z.evs));
      /* a set the store published spreads for must play them */
      const pub = st.sets.find(q => X.D.species.get(q.species).id === X.D.species.get(sets[i].species).id);
      if (st.spread_kind === 'stat_points' && pub && pub.evs && ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].some(k => (pub.evs[k] || 0) !== evs[k])) bad.push(t.id + ' ' + sets[i].species + ' ignores its published Stat Points');
    }
    if (!(t.bring && t.bring.length === 4 && new Set(t.bring).size === 4 && t.bring.every(i => i >= 0 && i < 6))) bad.push(t.id + ' bring ' + JSON.stringify(t.bring));
  }
  for (let i = 0; i < rot.teams.length; i++) for (let j = i + 1; j < rot.teams.length; j++) {
    const a = new Set(rot.teams[i].six_ids), n = rot.teams[j].six_ids.filter(x => a.has(x)).length;
    if (n >= RULE.SHARE) bad.push(rot.teams[i].id + ' and ' + rot.teams[j].id + ' share ' + n + ' species');
  }
  if (new Set(rot.teams.map(t => t.archetype && t.archetype.id)).size !== rot.teams.length) bad.push('two teams share an archetype');
  return bad;
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const OUTF = flag('--out', path.join(__dirname, 'teams', 'ladder-rotation-tour.json'));
  const t0 = Date.now();
  const out = build({ store: flag('--store', B.STORE_DEFAULT) });
  console.log('pool ' + out.rule.pool_teams + ' legal Masters teams of ' + out.rule.masters_teams + ' (illegal ' + out.rule.illegal_masters.length + ', unresolved ' + out.rule.unresolved.length + '); ' + out.rule.clusters + ' clusters');
  for (const c of out.clusters_considered) console.log('  ' + (c.picked ? 'PICK ' : '     ') + String(c.rank).padStart(2) + ' w ' + c.weight.toFixed(3).padStart(7) + ' ' + String(c.teams).padStart(3) + ' teams  ' + c.label + '  <- ' + c.leader + '  ' + c.why);
  if (out.teams.length < RULE.MIN_TEAMS) { console.error('only ' + out.teams.length + ' teams; a rotation needs ' + RULE.MIN_TEAMS + '. Nothing written.'); process.exit(1); }
  const bad = checkTour(out);
  if (bad.length) { console.error('checkTour refused the build: ' + bad.join(' | ')); process.exit(1); }
  fs.writeFileSync(OUTF, JSON.stringify(out, null, 1) + '\n');
  console.log('tournament rotation: ' + out.teams.length + ' teams -> ' + rel(OUTF) + ' in ' + Math.round((Date.now() - t0) / 1000) + ' s');
  for (const t of out.teams) console.log('  ' + t.id + ' #' + t.source.placing + ' ' + t.source.event_name + ' (' + t.source.players + ') ' + t.player + '  ' + t.species.join(' / ') + '  ' + t.source.url);
  for (const t of out.teams) for (const z of t.spreads) console.log('    ' + t.id + ' ' + z.species.padEnd(16) + (z.item || '').padEnd(16) + z.nature.padEnd(9) + SP.evStr(z.evs).padEnd(16) + z.source.slice(0, 60));
}
if (require.main === module) main();
module.exports = { RULE, build, checkTour, bringFor };
