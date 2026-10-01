/* solver/tournaments/sources/vr.js — Victory Road (victoryroad.pro) and its paste host VR Pastes (vrpastes.com).
 *
 * WHAT IT READS, and only that:
 *   the home page             once, to find the CURRENT season's "Event Calendar" link (so a new season needs no edit)
 *   the event calendar        once per run: every event row with its date, name, page link, winner and FORMAT column
 *                             ("M-C" + "OTS"); the section headings above each table give the region and the tier
 *   an event page             once per new event: the info table (name, location, dates, attendance, season/regulation,
 *                             format) and the standings tables, each row a placing, a Swiss record, a flag, a player and
 *                             a VR Pastes link
 *   a paste                   once per team, from VR Pastes' own JSON endpoint (the one its page script calls:
 *                             https://vrpaste-backend.vercel.app/api/paste/<id>), which returns the sets as data. The HTML
 *                             page carries no sets (they are rendered client-side), so the endpoint is the light path.
 * robots.txt: victoryroad.pro disallows only /wp-admin/ and a honeypot; vrpastes.com allows all with Crawl-delay 1; the
 * backend has no robots.txt (404). http.js checks every request against them.
 *
 * DIVISIONS. An event page lists Masters ("Teams and results": top cut, Swiss phase 2, sometimes phase 1) and then
 * Seniors and Juniors under their own heading. Only Masters is read by default: the ladder is not an age-division game,
 * and it halves the requests. `divisions: ['masters','seniors','juniors']` reads all three.
 *
 * SPREADS. VR Pastes' set objects carry `evs` / `ivs` only when the uploader gave them. Its own page script treats a
 * paste as Champions Stat Points when every set's `evs` sum is <= 66 (the Champions budget) and as old-style EVs
 * otherwise; parseSet keeps both the raw object and that classification. An open team sheet carries no spreads, so an
 * OTS paste has none — that is a fact about the source, recorded per team as has_spreads: false.
 */
'use strict';
const C = require('./common.js');

const HOME = 'https://victoryroad.pro/';
const PASTE_API = id => 'https://vrpaste-backend.vercel.app/api/paste/' + id + '?lang=english';
const PASTE_URL = id => 'https://www.vrpastes.com/' + id;
const REGIONS = ['North America', 'Europe', 'Latin America', 'Oceania', 'Asia-Pacific', 'Asia', 'Africa', 'Middle East'];

async function calendarUrl(http) {
  const h = (await http.get(HOME)).text;
  const m = /<a href="(https:\/\/victoryroad\.pro\/[^"]*calendar[^"]*)"[^>]*>\s*Event Calendar\s*<\/a>/i.exec(h);
  if (!m) throw new Error('victoryroad: no "Event Calendar" link on the home page');
  return m[1];
}

/* the calendar -> every event row: { url, name, start, end, region, section, tier, winner, format_label, ots, completed } */
function parseCalendar(html, today) {
  const marks = [];
  let m;
  const reH = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/g;
  while ((m = reH.exec(html))) marks.push({ i: m.index, k: 'h' + m[1], t: C.text(m[2]) });
  const reT = /<table class="infobox2">([\s\S]*?)<\/table>/g;
  while ((m = reT.exec(html))) marks.push({ i: m.index, k: 'table', html: m[1] });
  marks.sort((a, b) => a.i - b.i);
  let section = '', region = '';
  const out = [];
  for (const x of marks) {
    if (x.k === 'h2') { section = x.t; region = ''; continue; }
    if (x.k === 'h3') { if (REGIONS.includes(x.t)) region = x.t; else if (!/^©/.test(x.t)) section = x.t; continue; }
    for (const row of x.html.match(/<tr>[\s\S]*?<\/tr>/g) || []) {
      const tds = row.match(/<td[^>]*>[\s\S]*?<\/td>/g);
      if (!tds || tds.length < 4) continue;
      /* the event's own page: the first Victory Road link in the cell that is not the regulations or invites page */
      const a = /<a href="(https:\/\/victoryroad\.pro\/(?!champions-regulations|\d{4}-worlds-invites)[^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(tds[1]);
      const d = C.parseDates(C.text(tds[0]));
      const fmt = C.text(tds[3]).split('\n').map(s => s.trim()).filter(Boolean);
      const winner = C.text(tds[2]);
      const cell = C.text(tds[1]).split('\n').map(z => z.trim()).filter(Boolean);
      const name = cell[0] || '', place = cell.slice(1).join(', ') || null;
      const flag = /flags\/([A-Z]{3})-flag/.exec(tds[1]);
      out.push({ url: a ? a[1] : null, name, place, start: d && d.start, end: d && d.end, section, region: region || null,
                 tier: C.tierOf(name + ' ' + section), country_iso3: flag ? flag[1] : null,
                 winner: /sign-?ups?|TBD|all info|^$/i.test(winner) ? null : winner,
                 format_label: fmt[0] || null, ots: fmt.some(f => /^OTS$/i.test(f)),
                 completed: !!(d && d.end < today && !/sign-?ups?|TBD|all info|^$/i.test(winner)) });
    }
  }
  return out;
}

/* the calendar's events for one regulation label ('M-C'), completed, with a page — THE DISCOVERY, by tag not by list */
async function discover(http, label, today) {
  const cal = await calendarUrl(http);
  const rows = parseCalendar((await http.get(cal)).text, today);
  return { calendar: cal, rows, events: rows.filter(r => r.url && r.completed && r.format_label === label) };
}

/* an event page -> { info, teams: [{ division, section, placing, record, player, handle, country_iso3, paste_id }] } */
function parseEvent(html, divisions) {
  divisions = divisions || ['masters'];
  const tables = [];
  let m;
  const marks = [];
  const reH = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/g;
  while ((m = reH.exec(html))) marks.push({ i: m.index, k: 'h' + m[1], t: C.text(m[2]) });
  const reT = /<table[\s\S]*?<\/table>/g;
  while ((m = reT.exec(html))) marks.push({ i: m.index, k: 'table', html: m[0] });
  marks.sort((a, b) => a.i - b.i);
  let h2 = '', h3 = '';
  for (const x of marks) { if (x.k === 'h2') { h2 = x.t; h3 = ''; } else if (x.k === 'h3') h3 = x.t; else tables.push({ h2, h3, html: x.html }); }
  /* the info table: the first table whose first row is "Event | <name>" */
  const info = {};
  const it = tables.find(t => /^Event[^A-Za-z]/.test(C.text(t.html)));
  if (it) for (const row of it.html.match(/<tr[\s\S]*?<\/tr>/g) || []) {
    const c = (row.match(/<t[dh](?:\s[^>]*)?>[\s\S]*?<\/t[dh]>/g) || []).map(C.text);   // not <thead>/<tbody>
    if (c.length >= 2) info[c[0].toLowerCase()] = c.slice(1).join(' ').trim();
  }
  const divOf = t => /senior/i.test(t.h2 + ' ' + t.h3) ? 'seniors' : /junior/i.test(t.h2 + ' ' + t.h3) ? 'juniors' : /teams and results/i.test(t.h2) ? 'masters' : null;
  const seen = new Map();
  for (const t of tables) {
    const div = divOf(t);
    if (!div || !divisions.includes(div)) continue;
    if (!/vrpastes\.com/.test(t.html)) continue;
    for (const row of t.html.match(/<tr[\s\S]*?<\/tr>/g) || []) {
      const tds = row.match(/<td[^>]*>[\s\S]*?<\/td>/g);
      if (!tds || tds.length < 7) continue;
      const placing = parseInt(C.text(tds[0]), 10);
      if (!(placing > 0)) continue;
      const paste = /vrpastes\.com\/([A-Za-z0-9]+)/.exec(row);
      const flag = /flags\/([A-Z]{3})-flag/.exec(tds[2]);
      const pl = C.text(tds[3]).split('\n');
      const handle = /\(\s*(?:<a[^>]*>)?([\s\S]*?)(?:<\/a>)?\s*\)/.exec(tds[3]);
      const k = div + '#' + placing;
      const prev = seen.get(k);
      const rec = { division: div, section: t.h3 || t.h2, placing, record: C.text(tds[1]) || null, player: pl[0].trim(),
                    handle: handle ? C.text(handle[1]) || null : null, country_iso3: flag ? flag[1] : null, paste_id: paste ? paste[1] : null };
      /* a placing can appear in two tables (top cut and Swiss); keep the row that carries a paste, the first otherwise */
      if (!prev || (!prev.paste_id && rec.paste_id)) seen.set(k, Object.assign({}, prev || {}, rec, { section: prev && prev.paste_id ? prev.section : rec.section }));
    }
  }
  return { info, teams: [...seen.values()].sort((a, b) => a.division < b.division ? -1 : a.division > b.division ? 1 : a.placing - b.placing) };
}

/* the attendance cell '1,129 MA + 30 SR + 14 JR' -> masters count (or the only number) */
function mastersOf(att) {
  const s = String(att || '').replace(/,/g, '');
  const m = /(\d+)\s*MA\b/.exec(s) || /(\d+)/.exec(s);
  return m ? +m[1] : null;
}

/* one VR Pastes set object -> the store's set shape. Keeps every field the source gave (raw is stored beside it). */
function parseSet(p) {
  const evs = p.evs && Object.keys(p.evs).length ? p.evs : null;
  return { species: p.species || p.name, item: p.item || '', ability: p.ability || '', nature: p.nature || '',
           moves: (p.moves || []).slice(), gender: p.gender || '', level: p.level || null,
           evs: evs ? { hp: evs.hp || 0, atk: evs.atk || 0, def: evs.def || 0, spa: evs.spa || 0, spd: evs.spd || 0, spe: evs.spe || 0 } : null,
           ivs: p.ivs && Object.keys(p.ivs).length ? p.ivs : null,
           mega: p.megaEvolution ? p.megaEvolution.megaSpecies || null : null };
}
/* a paste's spreads, classified the way VR Pastes' own page does it: 'stat_points' when every set has evs summing to
 * <= 66, 'evs' when any is larger, null when none has evs */
function spreadKind(sets) {
  const tot = sets.map(s => s.evs ? Object.values(s.evs).reduce((a, b) => a + b, 0) : 0);
  if (!tot.some(t => t > 0)) return null;
  return sets.every(s => s.evs) && tot.every(t => t <= 66) ? 'stat_points' : 'evs';
}
async function fetchPaste(http, id) {
  const url = PASTE_API(id);
  const r = await http.get(url);
  const j = JSON.parse(r.text);
  if (!j || !Array.isArray(j.teams)) throw new Error('vrpastes: no teams in ' + url);
  const sets = j.teams.map(parseSet);
  return { url: PASTE_URL(id), api_url: url, fetched: r.fetched, raw: r.text, title: j.title || null, format: j.format || null, sets, spread_kind: spreadKind(sets) };
}

/* ---------------- the REPLICA TEAMS page: the one Victory Road source WITH spreads ----------------
 * Victory Road's "Replica Teams" page lists, per regulation (an h2 "Regulation Set M-C"), teams that won or reached the
 * finals of events and strong ranked teams, each with its in-game rental code and, for some, a VR Pastes link. A rental
 * team is a whole built team, so its paste carries the Stat Points (checked: both Reg M-C pastes on 2026-10-01 sum to 66
 * on every set). These are the only published Reg M-C spreads either site carries. Rows without a paste are skipped. */
async function replicaUrl(http) {
  const h = (await http.get(HOME)).text;
  const m = /<a href="(https:\/\/victoryroad\.pro\/[^"]*replica[^"]*)"[^>]*>\s*Replica Teams\s*<\/a>/i.exec(h);
  if (!m) throw new Error('victoryroad: no "Replica Teams" link on the home page');
  return m[1];
}
function parseReplica(html, label) {
  const marks = [];
  let m;
  const reH = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/g;
  while ((m = reH.exec(html))) marks.push({ i: m.index, k: 'h' + m[1], t: C.text(m[2]) });
  const reT = /<table[\s\S]*?<\/table>/g;
  while ((m = reT.exec(html))) marks.push({ i: m.index, k: 'table', html: m[0] });
  marks.sort((a, b) => a.i - b.i);
  const want = new RegExp('^Regulation Set ' + label.replace(/[-]/g, '\\-') + '$');
  let inReg = false, h3 = '';
  const out = [];
  for (const x of marks) {
    if (x.k === 'h2') { inReg = want.test(x.t); h3 = ''; continue; }
    if (x.k === 'h3') { h3 = x.t; continue; }
    if (!inReg) continue;
    for (const row of x.html.match(/<tr[\s\S]*?<\/tr>/g) || []) {
      const paste = /vrpastes\.com\/([A-Za-z0-9]+)/.exec(row);
      const tds = row.match(/<td[^>]*>[\s\S]*?<\/td>/g);
      if (!paste || !tds || tds.length < 6) continue;
      const flag = /flags\/([A-Z]{3})-flag/.exec(tds[0]);
      const pl = C.text(tds[1]).split('\n');
      const handle = /\(\s*(?:<a[^>]*>)?([\s\S]*?)(?:<\/a>)?\s*\)/.exec(tds[1]);
      const best = C.text(tds[2]).replace(/\n/g, ' ');
      const placeWord = /\bChampion\b|\b1st\b|\bwinner\b/i.test(best) ? 1 : (/\b(\d+)(?:st|nd|rd|th)\b/.exec(best) || [])[1];
      out.push({ category: h3, player: pl[0].trim(), handle: handle ? C.text(handle[1]) || null : null, country_iso3: flag ? flag[1] : null,
                 best_results: best, placing: placeWord ? +placeWord : null, rental_code: C.text(tds[4]).replace(/\n/g, ' ') || null, paste_id: paste[1] });
    }
  }
  return out;
}

module.exports = { HOME, PASTE_API, PASTE_URL, calendarUrl, parseCalendar, discover, parseEvent, mastersOf, parseSet, spreadKind, fetchPaste, replicaUrl, parseReplica };
