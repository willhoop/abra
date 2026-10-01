/* solver/tests/test-tournaments.js — the tournament store, its ingest, the spread hook, and the tournament rotation.
 *
 *   node solver/tests/test-tournaments.js                      GREEN n/n
 *   TOURNAMENT_BREAK=idempotency node solver/tests/...         must go RED (IDEMPOTENT): the ingest skips its
 *                                                              "already stored" check
 * Offline: every page comes from solver/tests/fixtures/tournaments/ (real markup cut from the live pages on 2026-10-01)
 * through http.js's cache, which is served with `--offline` so a test can never touch the network.
 *
 *   PARSE       the calendar finds Frankfurt as a completed, open-team-list, Reg M-C regional in Europe; the Global
 *               Challenge (no OTS) is seen and is not open-sheet; the event page gives 1,129 Masters, the regulation,
 *               4 top-cut teams with pastes, and the Seniors table is not read by default; Limitless gives 1,081 players,
 *               M-C and the /teams/ id; a team list parses to six full sets
 *   ROBOTS      robots.txt rules: Victory Road's /wp-admin/ is refused, its admin-ajax allowed, every other page allowed
 *   KEY / TIER  one event read from both sites gets one key; tiers from event names
 *   SPREADKIND  an OTS paste has no spreads; <= 66 per set is Champions Stat Points; 252s are old EVs
 *   INGEST      an offline --discover into a temp store writes Frankfurt (Victory Road, 4 teams), Baltimore (Limitless
 *               only, its one listed team) and the Replica Teams collection (2 Reg M-C pastes WITH Stat Points; the Reg
 *               M-B row ignored), skips the Reg M-B event, records every team's source URL and raw bytes
 *   IDEMPOTENT  a second identical ingest writes nothing, nor does one a week later with no new pastes: events.jsonl
 *               and every shard byte-identical
 *   DRYRUN      --dry-run writes nothing at all
 *   HOOK        every published replica set is served by spreads.js exactly its paste's Stat Points (read against the
 *               RAW paste JSON), keyed by species + item + nature; another nature or item falls through (null); an
 *               open-team-list set nobody published is never served one
 *   ROTATION    solver/rotom/teams/ladder-rotation-tour.json passes checkTour (3-5 teams, validates, plays the published
 *               sheet, its source is in the store, packed Stat Points == recorded spreads, no two teams share >= 4 species),
 *               every team carries the team_meta source; and checkTour is RED on three planted breaks of a copy
 *               (a source URL removed, a packed Stat Point changed, a move changed)
 *   ARMS        solver/rotom/arms/gen5-chomp-tour.json names the tournament rotation and is gen5-chomp-top's arm A
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const FX = path.join(__dirname, 'fixtures', 'tournaments');
const HTTP = require('../tournaments/http.js');
const VR = require('../tournaments/sources/vr.js');
const LIM = require('../tournaments/sources/limitless.js');
const C = require('../tournaments/sources/common.js');
const S = require('../tournaments/store.js');
const ING = require('../tournaments/ingest.js');

let checks = 0, fails = 0;
const ok = (tag, cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL [' + tag + '] ' + msg); } };
const rd = f => fs.readFileSync(path.join(FX, f), 'utf8');

(async () => {
  /* ---------------- PARSE ---------------- */
  const cal = VR.parseCalendar(rd('vr-calendar.html'), '2026-10-01');
  const fra = cal.find(r => /Frankfurt/.test(r.name));
  ok('PARSE', fra && fra.completed && fra.format_label === 'M-C' && fra.ots && fra.region === 'Europe' && fra.tier === 'regional' && fra.url === 'https://victoryroad.pro/2027-frankfurt/', 'calendar Frankfurt row: ' + JSON.stringify(fra));
  const nice = cal.find(r => /Nice/.test(r.name));
  ok('PARSE', nice && !nice.completed, 'a future event is not completed: ' + JSON.stringify(nice));
  const gc = cal.find(r => /Global Challenge I$/.test(r.name));
  ok('PARSE', gc && gc.format_label === 'M-C' && !gc.ots && gc.tier === 'online', 'the Global Challenge is M-C but not open-sheet: ' + JSON.stringify(gc));
  const ev = VR.parseEvent(rd('vr-frankfurt.html'));
  ok('PARSE', VR.mastersOf(ev.info.attendance) === 1129 && /Regulation Set M-C/.test(ev.info.season) && /Open team lists/.test(ev.info.format), 'event info: ' + JSON.stringify(ev.info));
  ok('PARSE', ev.teams.length === 4 && ev.teams.every(t => t.division === 'masters' && t.paste_id && t.placing > 0 && t.country_iso3), 'four Masters top-cut rows with pastes: ' + JSON.stringify(ev.teams));
  ok('PARSE', ev.teams[0].placing === 1 && ev.teams[0].record === '13-0' && ev.teams[0].player === 'Eric Rios', 'the winner row: ' + JSON.stringify(ev.teams[0]));
  ok('PARSE', VR.parseEvent(rd('vr-frankfurt.html'), ['masters', 'seniors']).teams.some(t => t.division === 'seniors'), 'the Seniors table is read only when asked for');
  const le = LIM.parseEvent(rd('lim-441.html'));
  ok('PARSE', le.players === 1081 && le.regulation_label === 'M-C' && le.start === '2026-09-19' && le.rows.length === 1 && le.rows[0].team_id === 6859, 'Limitless event: ' + JSON.stringify(le));
  const lt = LIM.parseTeam(rd('lim-team-6859.html'));
  ok('PARSE', lt.length === 6 && lt.every(s => s.species && s.item && s.ability && s.nature && s.moves.length === 4 && s.evs === null), 'Limitless team list: six full sets, no spreads');

  /* ---------------- ROBOTS ---------------- */
  const vrRules = HTTP.parseRobots('User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nUser-agent: *\nDisallow: /*blackhole\n');
  ok('ROBOTS', !HTTP.robotsAllows(vrRules, '/wp-admin/x').ok && HTTP.robotsAllows(vrRules, '/wp-admin/admin-ajax.php').ok && HTTP.robotsAllows(vrRules, '/2027-frankfurt/').ok && !HTTP.robotsAllows(vrRules, '/a-blackhole').ok, 'robots rules applied');
  ok('ROBOTS', HTTP.parseRobots('User-agent: *\nAllow: /\nCrawl-delay: 1').delay === 1000, 'Crawl-delay read');

  /* ---------------- KEY / TIER ---------------- */
  ok('KEY', C.eventKey('2026-09-26', 'Frankfurt Regional') === C.eventKey('2026-09-26', 'Regional Frankfurt') && C.eventKey('2026-09-19', 'Regional Baltimore, MD') === '2026-09-19-baltimore', 'one event, one key across sites');
  ok('TIER', C.tierOf('World Championships 2026') === 'worlds' && C.tierOf('Europe International (EUIC)') === 'international' && C.tierOf('Japan Championships (PJCS)') === 'national' &&
     C.tierOf('Thailand Premier Ball League') === 'national' && C.tierOf('Buenos Aires SC') === 'special' && C.tierOf('Regional Frankfurt') === 'regional' && C.tierOf('VR September Challenge #1') === 'community', 'tiers from names');

  /* ---------------- SPREADKIND ---------------- */
  const paste = JSON.parse(rd('vrpaste-' + ev.teams[0].paste_id + '.json'));
  const sets = paste.teams.map(VR.parseSet);
  ok('SPREADKIND', VR.spreadKind(sets) === null && sets.every(s => s.evs === null), 'an open-team-list paste carries no spreads');
  const sp = sets.map(s => Object.assign({}, s, { evs: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } }));
  ok('SPREADKIND', VR.spreadKind(sp) === 'stat_points', '<= 66 per set reads as Champions Stat Points');
  ok('SPREADKIND', VR.spreadKind(sets.map(s => Object.assign({}, s, { evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 } }))) === 'evs', '252s read as old EVs');

  /* ---------------- INGEST + IDEMPOTENT + DRYRUN ---------------- */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-tour-'));
  const cache = path.join(TMP, 'cache'), root = path.join(TMP, 'store');
  HTTP.cacheWrite(cache, VR.HOME, rd('vr-home.html'));
  HTTP.cacheWrite(cache, 'https://victoryroad.pro/2027-season-calendar/', rd('vr-calendar.html'));
  HTTP.cacheWrite(cache, 'https://victoryroad.pro/2027-frankfurt/', rd('vr-frankfurt.html'));
  for (const t of ev.teams) HTTP.cacheWrite(cache, VR.PASTE_API(t.paste_id), rd('vrpaste-' + t.paste_id + '.json'));
  HTTP.cacheWrite(cache, 'https://victoryroad.pro/champions-replica/', rd('vr-replica.html'));
  const REPLICA = ['qZK7HCqj', 'cpTuCZeC'];
  for (const id of REPLICA) HTTP.cacheWrite(cache, VR.PASTE_API(id), rd('vrpaste-' + id + '.json'));
  HTTP.cacheWrite(cache, LIM.BASE + '/tournaments', rd('lim-index.html'));
  for (const id of [441, 443, 437]) HTTP.cacheWrite(cache, LIM.BASE + '/tournaments/' + id, rd('lim-' + id + '.html'));
  HTTP.cacheWrite(cache, LIM.BASE + '/teams/6859', rd('lim-team-6859.html'));
  const args = ['--discover', '--offline', '--cache', cache, '--root', root, '--today', '2026-10-01', '--lookback-days', '60'];
  const quiet = async a => { const log = console.log; console.log = () => {}; try { return await ING.run(a); } finally { console.log = log; } };
  const dry = await quiet(args.concat(['--dry-run']));
  ok('DRYRUN', dry.written.length === 3 && !fs.existsSync(root), 'a dry run parses two events and the replica collection and writes nothing: ' + JSON.stringify(dry.written));
  const r1 = await quiet(args);
  const evs = S.events('regmc', root);
  ok('INGEST', r1.written.length === 3 && evs.length === 3, 'first ingest writes two events and the replica collection: ' + JSON.stringify(r1.written));
  const efra = evs.find(e => e.key === '2026-09-26-frankfurt'), ebal = evs.find(e => e.key === '2026-09-19-baltimore'), erep = evs.find(e => e.key === '2026-10-01-vr-replica');
  ok('INGEST', efra && efra.teams === 4 && efra.players === 1129 && efra.tier === 'regional' && efra.region === 'Europe' && efra.country === 'Germany' && efra.open_sheets && efra.sources.victoryroad && efra.sources.limitless && efra.sources.limitless.id === 443,
     'Frankfurt from Victory Road with the Limitless id recorded: ' + JSON.stringify(efra && Object.assign({}, efra, { sources: Object.keys(efra.sources) })));
  ok('INGEST', ebal && ebal.teams === 1 && ebal.players === 1081 && ebal.sources.limitless && !ebal.sources.victoryroad, 'Baltimore from Limitless alone: ' + JSON.stringify(ebal && { teams: ebal.teams, players: ebal.players }));
  ok('INGEST', erep && erep.kind === 'replica' && erep.teams === 2 && erep.teams_with_spreads === 2, 'the replica collection: two Reg M-C pastes, both with spreads, the Reg M-B row ignored: ' + JSON.stringify(erep && { teams: erep.teams, sp: erep.teams_with_spreads }));
  ok('INGEST', !evs.some(e => /world/.test(e.key)), 'the Reg M-B Worlds is classified and skipped');
  const tms = S.teams('regmc', root);
  ok('INGEST', tms.length === 7 && tms.every(t => t.raw && t.sets.length === 6 && t.source && /^https:\/\//.test(t.source.page) && /^https:\/\//.test(t.source.paste || t.source.team) && t.placing > 0 && t.player), 'every team row carries raw bytes, six sets, a placing, a player and source URLs');
  ok('INGEST', tms.filter(t => t.division === 'masters').every(t => t.has_spreads === false && t.spread_kind === null), 'no open-team-list team claims spreads it does not have');
  ok('INGEST', tms.filter(t => t.division === 'replica').every(t => t.has_spreads === true && t.spread_kind === 'stat_points'), 'the replica teams carry Champions Stat Points');
  const ix = S.readIndex(root);
  ok('INGEST', ix.pages['limitless:437'] && ix.pages['limitless:437'].regulation_label !== 'M-C' && ix.pages['limitless:441'].regulation_label === 'M-C', 'the classification index remembers every page it read');
  const snap = () => { const D = S.dirs('regmc', root); return [fs.readFileSync(D.events, 'utf8')].concat(fs.readdirSync(D.teams).sort().map(f => fs.readFileSync(path.join(D.teams, f)).toString('base64'))).join('|'); };
  const before = snap();
  let r2 = null, err = null;
  try { r2 = await quiet(args); } catch (e) { err = e; }
  ok('IDEMPOTENT', !err && r2 && r2.written.length === 0 && r2.skipped.length === 2 && r2.replica && !r2.replica.written, 'a second ingest of the same events writes nothing: ' + (err ? err.message : JSON.stringify({ written: r2.written, skipped: r2.skipped, replica: r2.replica })));
  let r3 = null; err = null;
  try { r3 = await quiet(args.map(a => a === '2026-10-01' ? '2026-10-08' : a)); } catch (e) { err = e; }
  ok('IDEMPOTENT', !err && r3 && r3.written.length === 0 && r3.replica && r3.replica.fresh === 0, 'a week later, with no new pastes, the replica collection adds nothing: ' + (err ? err.message : JSON.stringify(r3.replica)));
  ok('IDEMPOTENT', snap() === before, 'events.jsonl and every shard are byte-identical after the second and third ingest');

  /* ---------------- HOOK ---------------- */
  process.env.ABRA_REGULATION = 'regmc';
  require('../arena/env.js');
  const SP = require('../rotom/spreads.js');
  const tour = SP.loadTournament('regmc', root);
  ok('HOOK', tour.teams_with_spreads === 2 && tour.sets_with_spreads === 12, 'the hook reads the twelve published replica sets: ' + JSON.stringify({ t: tour.teams_with_spreads, s: tour.sets_with_spreads, k: tour.keys }));
  /* the spreads served are the pastes' own numbers: compare against the RAW paste JSON, not the parsed store row */
  let exact = 0, total = 0;
  for (const id of REPLICA) for (const p of JSON.parse(rd('vrpaste-' + id + '.json')).teams) {
    total++;
    const got = SP.tournamentSpread({ species: p.species, item: p.item, nature: p.nature }, tour);
    const want = Object.assign({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, p.evs);
    if (got && got.n === 1 && ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].every(k => got.evs[k] === want[k])) exact++;
  }
  ok('HOOK', tour.keys === 12 && total === 12 && exact === 12, 'every published replica set is served exactly its paste\'s Stat Points (' + exact + '/' + total + ')');
  const p0 = JSON.parse(rd('vrpaste-' + REPLICA[0] + '.json')).teams[0];
  const otherNature = ['Adamant', 'Modest'].find(n => n !== p0.nature);
  ok('HOOK', SP.tournamentSpread({ species: p0.species, item: p0.item, nature: otherNature }, tour) === null && SP.tournamentSpread({ species: p0.species, item: '', nature: p0.nature }, tour) === null, 'another nature or item falls through to the next source');
  const masterKeys = tms.filter(t => t.division === 'masters').flatMap(t => t.sets).filter(s => !tour.bySet.has(SP.tourKey(s.species, s.item, s.nature)));
  ok('HOOK', masterKeys.every(s => SP.tournamentSpread(s, tour) === null), 'an open-team-list set no paste published is not served a spread');

  /* ---------------- ROTATION ---------------- */
  const RF = path.join(ROOT, 'solver', 'rotom', 'teams', 'ladder-rotation-tour.json');
  ok('ROTATION', fs.existsSync(RF), 'the tournament rotation exists: ' + RF);
  if (fs.existsSync(RF)) {
    const BT = require('../rotom/build_tour_rotation.js');
    const rot = JSON.parse(fs.readFileSync(RF, 'utf8'));
    const bad = BT.checkTour(rot);
    ok('ROTATION', bad.length === 0, 'checkTour on the committed rotation: ' + bad.join(' | '));
    for (const t of rot.teams) ok('ROTATION', t.source && t.source.event_name && t.source.placing > 0 && t.source.url && t.source.date && t.spreads.every(z => z.source), t.id + ' carries its source and every spread\'s source for team_meta');
    const breaks = [
      ['a source URL removed', r => { delete r.teams[0].source.url; }],
      ['a packed Stat Point changed', r => { const { Teams } = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim')); const s = Teams.unpack(r.teams[0].packed); s[0].evs.hp = (s[0].evs.hp + 1) % 33; r.teams[0].packed = Teams.pack(s); }],
      ['a move changed', r => { const { Teams } = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim')); const s = Teams.unpack(r.teams[0].packed); s[0].moves[0] = s[1].moves.find(m => !s[0].moves.includes(m)) || s[0].moves[0]; r.teams[0].packed = Teams.pack(s); }],
    ];
    for (const [name, f] of breaks) { const c = JSON.parse(JSON.stringify(rot)); f(c); ok('ROTATION', BT.checkTour(c).length > 0, 'checkTour is RED on a planted break: ' + name); }
  }

  /* ---------------- ARMS ---------------- */
  const AF = path.join(ROOT, 'solver', 'rotom', 'arms', 'gen5-chomp-tour.json');
  if (fs.existsSync(AF)) {
    const a = JSON.parse(fs.readFileSync(AF, 'utf8')), top = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'rotom', 'arms', 'gen5-chomp-top.json'), 'utf8'));
    ok('ARMS', a.rotation === 'solver/rotom/teams/ladder-rotation-tour.json' && JSON.stringify(a.arms) === JSON.stringify(top.arms), 'gen5-chomp-tour names the tournament rotation and is gen5-chomp-top\'s arm A byte for byte');
  } else ok('ARMS', false, 'no ' + AF);

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* temp */ }
  console.log((fails ? 'RED' : 'GREEN') + ' ' + (checks - fails) + '/' + checks + (process.env.TOURNAMENT_BREAK ? '  (deliberate break: ' + process.env.TOURNAMENT_BREAK + ')' : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
