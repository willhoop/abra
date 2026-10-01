/* solver/tournaments/sources/common.js — what the two site adapters share: HTML text helpers, dates, the event key, and
 * the tier rule. Nothing about a Pokemon is here; the sets are parsed per source and checked by the format's validator. */
'use strict';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', hellip: '…' };
function decode(s) {
  return String(s || '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] != null ? ENT[n.toLowerCase()] : m);
}
const text = html => decode(String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t\r\f\v]+/g, ' ').replace(/ *\n */g, '\n').trim();
const slug = s => decode(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* '26–27 September 2026', '31 October–1 November 2026', '26th September 2026', '19–20 Sep 2026', '25–28 Sep 2026'
 * -> { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } or null */
function parseDates(s) {
  const t = decode(s).replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  const mon = w => { const i = MONTHS.findIndex(m => m.startsWith(String(w).toLowerCase().slice(0, 3))); return i < 0 ? null : i + 1; };
  const iso = (y, m, d) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  let m = /^(\d{1,2}) ?- ?(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(t);
  if (m && mon(m[3])) return { start: iso(+m[4], mon(m[3]), +m[1]), end: iso(+m[4], mon(m[3]), +m[2]) };
  m = /^(\d{1,2}) ([A-Za-z]+) ?- ?(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(t);
  if (m && mon(m[2]) && mon(m[4])) return { start: iso(+m[5], mon(m[2]), +m[1]), end: iso(+m[5], mon(m[4]), +m[3]) };
  m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(t);
  if (m && mon(m[2])) return { start: iso(+m[3], mon(m[2]), +m[1]), end: iso(+m[3], mon(m[2]), +m[1]) };
  m = /^(\d{1,2}) ([A-Za-z]+) (\d{2})$/.exec(t);                 // Limitless index: '26 Sep 26'
  if (m && mon(m[2])) return { start: iso(2000 + +m[3], mon(m[2]), +m[1]), end: iso(2000 + +m[3], mon(m[2]), +m[1]) };
  return null;
}

/* THE TIER RULE, from the event's own name (both sites name the event type in it). Order matters: the first match wins.
 * worlds > international > national (a national championship or an Asia-Pacific league, the circuits that stand in for
 * internationals there) > special (Special Championships / Special Event) > regional > online (a ladder challenge) >
 * community (anything else, e.g. a grassroots or community event). */
const TIERS = [
  ['worlds', /world championships?/i],
  ['international', /international|\b(NAIC|EUIC|LAIC|OCIC)\b/i],
  ['national', /national championships?|japan championships|\bPJCS\b|trainers cup|master ball league|premier ball league|\bPBL\b|\bMBL\b|players cup|player's cup/i],
  ['special', /special (championships?|event)|\bSC\b/i],
  ['regional', /regional/i],
  ['online', /global challenge|grand challenge|online/i],
];
function tierOf(name) { for (const [t, re] of TIERS) if (re.test(name || '')) return t; return 'community'; }

/* the event key both sites agree on: start date + the city, so a Frankfurt read from Victory Road and from Limitless are
 * one event. The city is the event name less the type words, the year and anything after a comma ('Baltimore, MD'). */
const TYPE_WORDS = /\b(\d{4}|regional|regionals|championships?|special|event|international|world|worlds|national|sc|premier|master|ball|league|the)\b/gi;
function cityOf(name) { return slug(decode(name).split(',')[0].replace(TYPE_WORDS, ' ')) || slug(name); }
function eventKey(start, name) { return start + '-' + cityOf(name); }

module.exports = { decode, text, slug, toID, parseDates, tierOf, TIERS, cityOf, eventKey };
