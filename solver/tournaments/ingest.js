/* solver/tournaments/ingest.js — add open-team-list tournament events to the tournament store. Idempotent, polite, loud.
 *
 *   node solver/tournaments/ingest.js --discover                 every completed event tagged with the regulation, on
 *                                                                 both sites, that the store does not hold yet
 *   node solver/tournaments/ingest.js --url <event page URL> ...  one or more named events (a Victory Road event page or a
 *                                                                 Limitless /tournaments/<id> page)
 *   flags:  --regulation regmc (default: ABRA_REGULATION, else regmc)   --dry-run (fetch and parse, write nothing)
 *           --offline (serve only the HTTP cache; the tests use it)      --limit-teams N (dry runs: read N teams an event)
 *           --divisions masters[,seniors,juniors]                        --lookback-days 60 (Limitless index window)
 *           --root <dir> (store root; tests point it at a temp dir)      --cache <dir> (HTTP cache dir)
 *           --today YYYY-MM-DD (what "completed" is measured against)
 *
 * WHERE IT LIVES AND WHY. Under solver/, not engine/: engine/ is ENGINE's simulator and OPS's replay ingest, and this
 * store feeds SOLVER's models (the ladder rotation, the spread prior, CHOMP's population). It reads no simulator and no
 * Showdown checkout, so it runs on a bare GitHub runner (.github/workflows/tournament-ingest.yml). Validation against the
 * format needs the checkout and is a separate step (validate.js).
 *
 * DISCOVERY IS BY THE REGULATION TAG, NEVER A TYPED EVENT LIST. The tag is derived from data/regulations.json (the
 * runtime label "... Reg M-C" -> "M-C"); Victory Road's calendar names it in its Format column, Limitless in each event
 * header ("Regulation Set M-C"). When the next regulation goes live, `--regulation <id>` is the whole change.
 *
 * WHICH SITE. Victory Road is the primary: its calendar tags the regulation AND the open-team-list format, gives the
 * region and the tier, its event pages carry Swiss records and handles, and every team's paste is one small JSON request.
 * Limitless is the second source: its index discovers events Victory Road has not covered, and it covers them from its
 * own team lists. An event both sites list is stored once (one key), from Victory Road, with the Limitless id recorded.
 * Neither site publishes spreads for an open-team-list event (an OTS has none), so neither is preferred for spreads.
 * The one published source of Reg M-C Stat Points found (2026-10-01) is Victory Road's Replica Teams page: rental teams
 * with full pastes. `--discover` also stores its new pastes as a collection (ingestReplica below; `--no-replica` skips).
 *
 * FAILS LOUDLY. Any HTTP error, a robots refusal, a paste that is not six sets, or a calendar that parses to nothing ends
 * the run non-zero — and an event is only written after every one of its teams was read, so a failure never leaves a
 * partial event. An event that has ended but shows no team lists yet is PENDING (printed, not written, retried next run);
 * past PENDING_FAIL_DAYS after its end it is an error, because by then the likelier cause is a parser the site broke.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./sources/common.js');
const VR = require('./sources/vr.js');
const LIM = require('./sources/limitless.js');
const S = require('./store.js');
const HTTP = require('./http.js');

const INGEST_VERSION = 1;
const PENDING_FAIL_DAYS = 10;

function regulationLabel(reg) {
  const R = JSON.parse(fs.readFileSync(path.join(S.ROOT, 'data', 'regulations.json'), 'utf8'));
  const rt = (R.runtime && R.runtime[reg]) || (R.regulations && R.regulations[reg]);
  if (!rt || !rt.label) throw new Error('ingest: no label for regulation ' + reg + ' in data/regulations.json');
  const m = /\bReg(?:ulation)?(?: Set)? ([A-Z])-?([A-Z0-9]+)\b/.exec(rt.label);
  if (!m) throw new Error('ingest: cannot read a regulation code out of "' + rt.label + '"');
  return { label: m[1] + '-' + m[2], format: rt.bo3Format || null, source: 'data/regulations.json ' + reg + '.label = "' + rt.label + '"' };
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const countryOf = loc => { const p = String(loc || '').split(',').map(s => s.trim()).filter(Boolean); return p.length ? p[p.length - 1] : null; };

/* ---------------- candidates ---------------- */
async function discover(http, o, log) {
  const cands = new Map();
  const add = (key, c) => { const e = cands.get(key) || { key }; cands.set(key, Object.assign(e, c, { sources: Object.assign({}, e.sources, c.sources) })); };
  /* Victory Road: the calendar's Format column */
  const vr = await VR.discover(http, o.label, o.today);
  if (!vr.rows.length) throw new Error('victoryroad: the calendar parsed to zero rows (' + vr.calendar + ') — the page layout moved; fix the parser');
  log('victoryroad calendar ' + vr.calendar + ': ' + vr.rows.length + ' rows, ' + vr.events.length + ' completed ' + o.label);
  for (const r of vr.events) {
    if (!r.ots) { log('  skip ' + r.name + ': not open team lists on the calendar'); continue; }
    add(C.eventKey(r.start, r.name), { name: r.name, start: r.start, end: r.end, tier: r.tier, region: r.region, section: r.section,
      sources: { victoryroad: { url: r.url, calendar: vr.calendar, winner: r.winner } } });
  }
  /* Limitless: its index, then each unclassified recent event page */
  const ix = S.readIndex(o.root);
  const rows = await LIM.index(http);
  if (!rows.length) throw new Error('limitless: the tournament index parsed to zero rows — the page layout moved; fix the parser');
  for (const r of rows) {
    if (!r.start || daysBetween(r.start, o.today) > o.lookbackDays) continue;
    const k = 'limitless:' + r.id;
    let cls = ix.pages[k];
    if (!cls) {
      const e = await LIM.event(http, r.id);
      cls = { url: r.url, name: e.name || r.name, start: e.start || r.start, players: e.players, regulation_label: e.regulation_label, classified: new Date().toISOString().slice(0, 10) };
      ix.pages[k] = cls;
      log('  limitless ' + r.id + ' ' + cls.name + ' ' + cls.start + ': ' + (cls.regulation_label || 'no regulation tag'));
    }
    if (cls.regulation_label !== o.label) continue;
    add(C.eventKey(cls.start, cls.name), { name: (cands.get(C.eventKey(cls.start, cls.name)) || {}).name || cls.name, start: cls.start,
      sources: { limitless: { id: r.id, url: r.url, players: cls.players } } });
  }
  return { cands: [...cands.values()], index: ix, vr_calendar: vr.calendar };
}

async function fromUrls(http, o, log) {
  const cands = [];
  let cal = null;
  for (const u of o.urls) {
    if (/victoryroad\.pro/.test(u)) {
      if (!cal) { const d = await VR.discover(http, o.label, o.today); cal = d; }
      const row = cal.rows.find(r => r.url && r.url.replace(/\/$/, '') === u.replace(/\/$/, ''));
      const page = VR.parseEvent((await http.get(u)).text, o.divisions);
      const dt = C.parseDates(page.info.date || '');
      const name = page.info.event || (row && row.name) || u;
      cands.push({ key: C.eventKey(dt ? dt.start : row.start, name), name: row ? row.name : name, start: dt ? dt.start : row && row.start, end: dt ? dt.end : row && row.end,
        tier: C.tierOf(name + ' ' + ((row && row.section) || '')), region: row ? row.region : null, section: row ? row.section : null,
        sources: { victoryroad: { url: u, calendar: cal.calendar, winner: row ? row.winner : null } } });
    } else if (/limitlessvgc\.com\/tournaments\/(\d+)/.test(u)) {
      const id = +/tournaments\/(\d+)/.exec(u)[1];
      const e = await LIM.event(http, id);
      cands.push({ key: C.eventKey(e.start, e.name), name: e.name, start: e.start, sources: { limitless: { id, url: e.url, players: e.players } }, _lim: e });
    } else throw new Error('ingest: not an event URL this ingest reads: ' + u);
  }
  return { cands, index: null };
}

/* ---------------- one event ---------------- */
async function readEvent(http, c, o, log) {
  const ev = { v: INGEST_VERSION, key: c.key, regulation: o.regulation, regulation_label: o.label, name: c.name, tier: c.tier || C.tierOf(c.name),
               start: c.start, end: c.end || c.start, region: c.region || null, open_sheets: true, sources: c.sources, divisions: o.divisions,
               ingested: new Date().toISOString(), ingest: { version: INGEST_VERSION, user_agent: HTTP.UA } };
  const rows = [];
  if (c.sources.victoryroad) {
    const url = c.sources.victoryroad.url;
    const page = VR.parseEvent((await http.get(url)).text, o.divisions);
    const info = page.info;
    if (info.season && !new RegExp('Regulation Set ' + o.label.replace('-', '\\-') + '\\b').test(info.season)) throw new Error(url + ': the page says "' + info.season + '", not Regulation Set ' + o.label);
    ev.name = info.event || ev.name;
    ev.tier = C.tierOf(ev.name + ' ' + (c.section || ''));
    ev.location = info.location || null; ev.country = countryOf(info.location);
    ev.players = VR.mastersOf(info.attendance); ev.attendance_text = info.attendance || null;
    ev.format_text = info.format || null; ev.season_text = info.season || null; ev.organizer = info.organizer || null;
    ev.open_sheets = /open team (lists?|sheets?)/i.test(info.format || '') || ev.open_sheets;
    const d = C.parseDates(info.date || ''); if (d) { ev.start = d.start; ev.end = d.end; }
    let list = page.teams.filter(t => t.paste_id);
    ev.listed = page.teams.length; ev.listed_with_paste = list.length;
    if (o.limitTeams) list = list.slice(0, o.limitTeams);
    for (const t of list) {
      const p = await VR.fetchPaste(http, t.paste_id);
      if (p.sets.length !== 6 || p.sets.some(s => !s.species)) throw new Error('vrpastes ' + t.paste_id + ' (' + ev.key + ' #' + t.placing + '): ' + p.sets.length + ' sets, expected 6 named');
      rows.push({ v: INGEST_VERSION, team_id: ev.key + '/' + t.division + '/' + t.placing, event: ev.key, regulation: o.regulation, division: t.division, section: t.section,
                  placing: t.placing, record: t.record, player: t.player, handle: t.handle, country_iso3: t.country_iso3,
                  source: { site: 'victoryroad', page: url, paste: p.url, api: p.api_url, paste_id: t.paste_id }, fetched: p.fetched,
                  title: p.title, format_text: p.format, spread_kind: p.spread_kind, has_spreads: !!p.spread_kind, sets: p.sets, raw: p.raw });
      if (rows.length % 25 === 0) log('    ' + ev.key + ': ' + rows.length + ' / ' + list.length + ' teams');
    }
  } else if (c.sources.limitless) {
    const e = c._lim || await LIM.event(http, c.sources.limitless.id);
    if (e.regulation_label !== o.label) throw new Error(e.url + ': the page says regulation ' + e.regulation_label + ', not ' + o.label);
    ev.name = e.name || ev.name; ev.tier = C.tierOf(ev.name); ev.players = e.players;
    ev.format_text = 'Limitless team lists (open team sheets)';
    let list = e.rows.filter(r => r.team_id);
    ev.listed = e.rows.length; ev.listed_with_paste = list.length;
    if (o.limitTeams) list = list.slice(0, o.limitTeams);
    const cache = new Map();
    for (const r of list) {
      let tm = cache.get(r.team_id);
      if (!tm) { tm = await LIM.team(http, r.team_id); cache.set(r.team_id, tm); }
      if (tm.sets.length !== 6 || tm.sets.some(s => !s.species)) throw new Error('limitless team ' + r.team_id + ': ' + tm.sets.length + ' sets, expected 6 named');
      rows.push({ v: INGEST_VERSION, team_id: ev.key + '/masters/' + r.placing, event: ev.key, regulation: o.regulation, division: 'masters', section: 'Standings',
                  placing: r.placing, record: null, player: r.player, handle: null, country_iso2: r.country_iso2,
                  source: { site: 'limitless', page: e.url, team: tm.url, team_list_id: r.team_id }, fetched: tm.fetched,
                  title: null, format_text: null, spread_kind: null, has_spreads: false, sets: tm.sets, raw: tm.raw });
    }
  }
  ev.teams_with_spreads = rows.filter(r => r.has_spreads).length;
  return { ev, rows };
}

/* ---------------- the replica collection: the only published spreads ----------------
 * Victory Road's Replica Teams page (sources/vr.js parseReplica) grows over a regulation. It is stored as a COLLECTION
 * event, `<today>-vr-replica`, holding only the pastes no stored team already has (by paste id), so a re-run the same
 * day is a no-op by key and a later run adds only new rows — and nothing at all when there are none. Its teams are
 * division 'replica': they feed the spread hook, never the Masters rotation pool. */
async function ingestReplica(http, o, log) {
  const url = await VR.replicaUrl(http);
  const rows = VR.parseReplica((await http.get(url)).text, o.label);
  const have = new Set(S.teams(o.regulation, o.root).map(t => t.source && t.source.paste_id).filter(Boolean));
  const seen = new Set(), fresh = [];
  for (const r of rows) if (!have.has(r.paste_id) && !seen.has(r.paste_id)) { seen.add(r.paste_id); fresh.push(r); }
  log('victoryroad replica teams ' + url + ': ' + rows.length + ' Regulation Set ' + o.label + ' rows with a paste, ' + fresh.length + ' not stored yet');
  const key = o.today + '-vr-replica';
  if (!fresh.length || S.hasEvent(o.regulation, key, o.root)) return { key, written: false, rows: rows.length, fresh: fresh.length };
  const out = [];
  for (const r of fresh) {
    const p = await VR.fetchPaste(http, r.paste_id);
    if (p.sets.length !== 6 || p.sets.some(s => !s.species)) throw new Error('vrpastes ' + r.paste_id + ' (replica): ' + p.sets.length + ' sets, expected 6 named');
    out.push({ v: INGEST_VERSION, team_id: key + '/replica/' + r.paste_id, event: key, regulation: o.regulation, division: 'replica', section: r.category,
               placing: r.placing, record: null, player: r.player, handle: r.handle, country_iso3: r.country_iso3, best_results: r.best_results, rental_code: r.rental_code,
               source: { site: 'victoryroad-replica', page: url, paste: p.url, api: p.api_url, paste_id: r.paste_id }, fetched: p.fetched,
               title: p.title, format_text: p.format, spread_kind: p.spread_kind, has_spreads: !!p.spread_kind, sets: p.sets, raw: p.raw });
  }
  const ev = { v: INGEST_VERSION, key, kind: 'replica', regulation: o.regulation, regulation_label: o.label, name: 'Victory Road Replica Teams (Regulation Set ' + o.label + '), new on ' + o.today,
               tier: 'community', start: o.today, end: o.today, region: null, players: null, open_sheets: true, sources: { victoryroad_replica: { url } }, divisions: ['replica'],
               ingested: new Date().toISOString(), ingest: { version: INGEST_VERSION, user_agent: HTTP.UA }, teams_with_spreads: out.filter(t => t.has_spreads).length };
  if (o.dryRun) { log('  DRY RUN ' + key + ': ' + out.length + ' replica teams (' + ev.teams_with_spreads + ' with spreads), not written'); return { key, written: false, dry_run: true, teams: out.length }; }
  const row = S.writeEvent(o.regulation, ev, out, o.root);
  log('  WROTE ' + key + ': ' + row.teams + ' replica teams, ' + row.teams_with_spreads + ' with spreads');
  return { key, written: true, teams: row.teams };
}

async function run(argv) {
  const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
  const has = k => argv.includes('--' + k);
  const urls = []; argv.forEach((a, i) => { if (a === '--url') urls.push(argv[i + 1]); });
  const regulation = flag('regulation', process.env.ABRA_REGULATION || 'regmc');
  const L = regulationLabel(regulation);
  const o = { regulation, label: L.label, urls, dryRun: has('dry-run'), offline: has('offline'), limitTeams: +flag('limit-teams', 0) || 0,
              divisions: flag('divisions', 'masters').split(','), lookbackDays: +flag('lookback-days', 60), root: flag('root', null),
              today: flag('today', new Date().toISOString().slice(0, 10)) };
  const log = m => console.log(m);
  const http = HTTP.create({ offline: o.offline, cacheDir: flag('cache', undefined), log });
  log('tournament ingest — regulation ' + regulation + ' (tag "' + L.label + '", from ' + L.source + '), today ' + o.today + (o.dryRun ? ', DRY RUN' : ''));
  if (!urls.length && !has('discover')) throw new Error('give --discover or --url <event page>');
  const D = urls.length ? await fromUrls(http, o, log) : await discover(http, o, log);
  const out = { written: [], skipped: [], pending: [], errors: [] };
  for (const c of D.cands.sort((a, b) => (a.start || '') < (b.start || '') ? -1 : 1)) {
    /* DELIBERATE BREAK (env TOURNAMENT_BREAK=idempotency): skip the "already stored" check. solver/tests/test-tournaments.js
     * IDEMPOTENT must go red — the second ingest of one event then re-reads it and the store refuses the duplicate. */
    if (S.hasEvent(regulation, c.key, o.root) && process.env.TOURNAMENT_BREAK !== 'idempotency') { out.skipped.push(c.key); log('  have ' + c.key + ' already — nothing to do'); continue; }
    const { ev, rows } = await readEvent(http, c, o, log);
    if (!rows.length) {
      const age = daysBetween(ev.end || ev.start, o.today);
      const msg = c.key + ': no team lists on the page yet (' + age + ' days after the event)';
      if (age > PENDING_FAIL_DAYS) throw new Error(msg + ' — past ' + PENDING_FAIL_DAYS + ' days this is more likely a broken parser than a late page');
      out.pending.push(c.key); log('  PENDING ' + msg); continue;
    }
    if (o.dryRun) { out.written.push({ key: ev.key, teams: rows.length, dry_run: true }); log('  DRY RUN ' + ev.key + ': ' + rows.length + ' teams parsed (' + ev.teams_with_spreads + ' with spreads), not written'); continue; }
    const row = S.writeEvent(regulation, ev, rows, o.root);
    out.written.push({ key: row.key, teams: row.teams, shard_bytes: row.shard_bytes });
    log('  WROTE ' + row.key + ': ' + row.teams + ' teams, ' + row.teams_with_spreads + ' with spreads, shard ' + row.shard + ' (' + row.shard_bytes + ' B)');
  }
  if (D.index && !o.dryRun) S.writeIndex(D.index, o.root);
  if (!urls.length && !has('no-replica')) {
    out.replica = await ingestReplica(http, o, log);
    if (out.replica.written || out.replica.dry_run) out.written.push({ key: out.replica.key, teams: out.replica.teams, replica: true, dry_run: !!out.replica.dry_run });
  }
  out.http = http.stats();
  log('done: ' + out.written.length + (o.dryRun ? ' would be written (dry run: nothing was), ' : ' written, ') + out.skipped.length + ' already stored, ' + out.pending.length + ' pending; ' + out.http.requests + ' requests, ' + out.http.cache_hits + ' cache hits');
  return out;
}

if (require.main === module) run(process.argv.slice(2)).catch(e => { console.error('TOURNAMENT INGEST FAILED: ' + (e && e.stack || e)); process.exit(1); });
module.exports = { run, regulationLabel, readEvent, discover, INGEST_VERSION, PENDING_FAIL_DAYS };
