/* solver/tournaments/sources/limitless.js — Limitless VGC (limitlessvgc.com).
 *
 * WHAT IT READS, and only that:
 *   /tournaments              once per run: the completed-event index (date, country, name, players, winner, id)
 *   /tournaments/<id>         once per CANDIDATE event: the header names the regulation ("Regulation Set M-C") and the
 *                             player count; the standings table gives placing, player, country and a /teams/<id> link.
 *                             Every event page read is remembered in data/tournaments/index.json, so a later run never
 *                             re-reads an event it has already classified (a past event's regulation does not change).
 *   /teams/<id>               once per team, ONLY for an event no other source has stored: item, ability, nature and four
 *                             moves per Pokemon. Limitless deduplicates identical sheets — one /teams/<id> can be "used by"
 *                             several players at several events — so the store records the id and each use separately.
 * robots.txt: `User-agent: * / Disallow:` (empty) — everything allowed. No public JSON API for limitlessvgc.com was found
 * (the documented Limitless API is for play.limitlesstcg.com and needs a key), so the pages are read as HTML.
 *
 * SPREADS. A Limitless team list is the open team sheet: no EVs / Stat Points at all. Every set is has_spreads: false.
 * Limitless is Masters only.
 */
'use strict';
const C = require('./common.js');

const BASE = 'https://limitlessvgc.com';

/* the index -> [{ id, url, name, start, country, players, winner }] */
function parseIndex(html) {
  const out = [];
  for (const row of html.match(/<tr[\s\S]*?<\/tr>/g) || []) {
    const a = /<a href="\/tournaments\/(\d+)">([\s\S]*?)<\/a>/.exec(row);
    if (!a) continue;
    const tds = (row.match(/<td(?:\s[^>]*)?>[\s\S]*?<\/td>/g) || []).map(C.text);
    const d = C.parseDates(tds[0] || '');
    const flag = /flags\/([A-Z]{2})\.png/.exec(row);
    const players = tds.map(t => /^\d+$/.test(t) ? +t : null).find(x => x != null);
    out.push({ id: +a[1], url: BASE + '/tournaments/' + a[1], name: C.text(a[2]), start: d && d.start, country_iso2: flag ? flag[1] : null,
               players: players == null ? null : players });
  }
  return out;
}

/* an event page -> { name, start, players, regulation_label, rows: [{ placing, player, country_iso2, team_id, species }] } */
function parseEvent(html) {
  const head = C.text((/<div class="infobox[\s\S]*?<\/div>\s*<\/div>/.exec(html) || [''])[0]) || '';
  const title = (/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1];
  const name = title ? C.text(title).replace(/\s*[–-]\s*Limitless VGC.*$/, '').trim() : null;
  const all = C.text(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, ''));
  const date = /(\d{1,2}(?:st|nd|rd|th) [A-Z][a-z]+ \d{4})/.exec(all);
  const players = /(\d[\d,]*)\s*Players/.exec(all);
  const reg = /Regulation Set ([A-Z]-[A-Z0-9]+)/.exec(all);
  const rows = [];
  for (const row of html.replace(/<svg[\s\S]*?<\/svg>/g, '').match(/<tr data-rank[\s\S]*?<\/tr>/g) || []) {
    const rank = /data-rank="(\d+)"/.exec(row), nm = /data-name="([^"]*)"/.exec(row), co = /data-country="([^"]*)"/.exec(row);
    const team = /href="\/teams\/(\d+)"/.exec(row);
    const species = [...row.matchAll(/<a href="\/pokemon\/([a-z0-9-]+)"/g)].map(m => m[1]);
    rows.push({ placing: rank ? +rank[1] : null, player: nm ? C.decode(nm[1]) : null, country_iso2: co ? co[1] || null : null,
                team_id: team ? +team[1] : null, species });
  }
  void head;
  return { name, start: date ? C.parseDates(date[1]).start : null, players: players ? +players[1].replace(/,/g, '') : null,
           regulation_label: reg ? reg[1] : null, rows };
}

/* a /teams/<id> page -> sets [{ species, item, ability, nature, moves }] (species from the page's own data-id slug) */
function parseTeam(html) {
  const sets = [];
  for (const blk of html.split('<div class="pkmn"').slice(1)) {
    const id = /^\s*data-id="([a-z0-9-]+)"/.exec(blk);
    const nm = /<div class="name">\s*<a[^>]*>([\s\S]*?)<\/a>/.exec(blk);
    const item = /<div class="item">([\s\S]*?)<\/div>/.exec(blk);
    const ab = /<div class="ability">\s*Ability:\s*([\s\S]*?)<\/div>/.exec(blk);
    const nat = /<div class="nature">\s*([\s\S]*?)\s*Nature\s*<\/div>/.exec(blk);
    const mv = /<ul class="moves">([\s\S]*?)<\/ul>/.exec(blk);
    sets.push({ species: nm ? C.text(nm[1]) : null, species_slug: id ? id[1] : null, item: item ? C.text(item[1]) : '', ability: ab ? C.text(ab[1]) : '',
                nature: nat ? C.text(nat[1]) : '', moves: mv ? [...mv[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => C.text(m[1])) : [],
                gender: '', level: null, evs: null, ivs: null, mega: null });
  }
  return sets;
}

async function index(http) { return parseIndex((await http.get(BASE + '/tournaments')).text); }
async function event(http, id) { const r = await http.get(BASE + '/tournaments/' + id); return Object.assign(parseEvent(r.text), { id: +id, url: BASE + '/tournaments/' + id, fetched: r.fetched }); }
async function team(http, id) {
  const url = BASE + '/teams/' + id;
  const r = await http.get(url);
  const frag = (/<div class="teamlist">[\s\S]*?<div class="teamlist-results">/.exec(r.text) || [r.text])[0];
  return { url, fetched: r.fetched, raw: frag, sets: parseTeam(r.text), spread_kind: null };
}

module.exports = { BASE, parseIndex, parseEvent, parseTeam, index, event, team };
