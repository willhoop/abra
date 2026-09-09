/* next_regulation.js — WHICH CHAMPIONS VGC REGULATIONS EXIST, ASKED AT RUN TIME.
 *
 * WHY THIS EXISTS
 * ---------------
 * A new regulation is announced for roughly 2026-09-09 and Showdown usually ships the format a day
 * or two later. Every prior, team pool and usage table in this repository describes the regulation
 * named in data/regulations.json. On the day the next one appears, the collector would keep pulling
 * the OLD format id — because that id is a constant in a config file — and nothing anywhere would
 * say that the game had moved. The store would simply stop growing in a metagame that still exists
 * and never start growing in the one that replaced it.
 *
 * build/triggers.js already has a rotation alarm, and it CANNOT fire on this. It compares the
 * modal format in the store against the recent window, so it needs new-format games to already be
 * IN the store. Nothing puts them there. The alarm is downstream of the hole.
 *
 * So the format is DERIVED, never typed:
 *
 *   LIVE  https://play.pokemonshowdown.com/data/formats.js — the server's own format list. This is
 *         the authority that matters for COLLECTING, because a replay exists the moment the server
 *         accepts a battle.
 *   DEX   the local pokemon-showdown checkout. This is the authority that matters for SIMULATING.
 *         It is pinned and it LAGS — measured 2026-08-31 the checkout is 72 commits behind — so a
 *         format can be collectable for days before it is simulatable. That gap is REPORTED rather
 *         than smoothed over: they answer two different questions.
 *   PLAY  replay.pokemonshowdown.com/search.json — evidence anybody is actually playing it. Since
 *         2026-09-09 this is an ARRIVAL authority in its own right: `?format=<id>` is probed for the
 *         ids derived by advancing the active regulation's letter (see REPLAY_SEARCH_URL), because
 *         formats.js is the client bundle and lagged the server by more than a day on the day.
 *
 * NOTHING HERE NAMES A FORMAT ID. A Champions VGC regulation is recognised by SHAPE:
 *
 *     gen<N>championsvgc<YYYY>reg<token>[bo3]
 *
 * and, where the authority carries it, mod === 'champions*' and gameType === 'doubles'. A format
 * Showdown ships next week matches that shape without an edit here, which is the whole point of
 * writing this before the format exists.
 *
 * WHAT "NEW" MEANS, AND WHY IT IS NOT JUST "NOT IN THE CONFIG"
 * -----------------------------------------------------------
 * Reg M-A is live on the server RIGHT NOW and is absent from data/regulations.json, so a plain
 * set-difference reports two brand-new regulations on the day this was written and would start
 * collecting a SUPERSEDED metagame. The regulation token is part of the id, so the ordering is
 * derivable: (gen, year, token) compared against the ACTIVE regulation's triple. Strictly greater
 * is a CANDIDATE; anything else is SUPERSEDED.
 *
 * Every format that is unknown to the config is printed WITH its classification, whichever way it
 * lands. If the next regulation somehow sorts below the active one, this file will not collect it —
 * and the line that says so is on screen, which is the difference between a wrong answer and a
 * silent one.
 *
 *   node engine/next_regulation.js            report only — this script writes nothing
 *   node engine/next_regulation.js --no-net   the local dex only (offline, deterministic)
 *   node engine/next_regulation.js --json     the detection on stdout
 *
 * The ARTIFACT is data/next-regulation.json and engine/next_regulation_ingest.js is what writes it,
 * because the artifact records what was COLLECTED as well as what was detected. One file, one
 * `generated` stamp; a reporter that overwrote it would leave a stamp with no collection behind it.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const REGS = path.join(ROOT, 'data', 'regulations.json');

const LIVE_FORMATS_URL = 'https://play.pokemonshowdown.com/data/formats.js';
const REPLAY_RECENT_URL = 'https://replay.pokemonshowdown.com/search.json?page=1';
/* THE THIRD AUTHORITY, ADDED 2026-09-09 BECAUSE THE FIRST ONE LAGGED ON THE DAY.
 * Reg M-C went live on the replay server on 2026-09-09 — `search.json?format=<id>` answered 51
 * games for both the bo1 and bo3 ids — while play.pokemonshowdown.com/data/formats.js still carried
 * a Last-Modified of 2026-09-08 02:10 GMT and no such format. formats.js is the CLIENT's bundle and
 * is rebuilt on the client's deploy cadence, not the server's; a replay exists the moment the server
 * accepts a battle. So this detector printed "THE NEXT REGULATION DOES NOT EXIST YET" for a format
 * with a thousand public games in its pool, and the scheduled collector obeyed it.
 *
 * The id is appended at the call, never written here: engine/format_id_scan.js treats a literal
 * format id after `search.json?format=` as a typed call site, and this file must derive its ids. */
const REPLAY_SEARCH_URL = 'https://replay.pokemonshowdown.com/search.json?format=';
/* How many regulation letters past the active one to probe. M-B -> M-C, M-D, M-E. A regulation is
 * one letter later than its predecessor; three covers a skipped letter and a missed month without
 * turning every scheduled run into a walk of the alphabet. */
const PROBE_LETTERS = 3;

/* Every failure this file survives is COUNTED and printed. A detector that cannot reach its
 * authority and says nothing is the exact shape of the bug it was written to prevent. */
const PROBLEMS = [];
const failedTo = (what, e) => PROBLEMS.push(what + ': ' + ((e && e.message) || String(e)));

/* ---- the shape, in one place ------------------------------------------------------------------
 * `toID` is Showdown's own normalisation, reimplemented rather than imported so this file works
 * with no checkout at all. */
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const VGC_REG = /^gen(\d+)championsvgc(\d{4})reg([a-z0-9]+)$/;

/* Parse a format id into its regulation triple, or null if it is not a Champions VGC regulation.
 * The bo3 sibling is the same regulation in a different information regime, so it parses to the
 * same triple and carries bo3:true. */
function parseFormatId(id) {
  const s = toID(id);
  let body = s, bo3 = false, bo3From = null;
  if (/bo3$/.test(s)) { body = s.slice(0, -3); bo3 = true; bo3From = 'idsuffix'; }
  const m = VGC_REG.exec(body);
  if (!m) return null;
  return { id: s, gen: +m[1], year: +m[2], token: m[3], bo3, bo3_source: bo3From };
}

/* Strictly-later comparison on (gen, year, token). Nothing is typed: the token comes out of the id
 * the authority published. */
function laterThan(a, b) {
  if (!a || !b) return false;
  if (a.gen !== b.gen) return a.gen > b.gen;
  if (a.year !== b.year) return a.year > b.year;
  return a.token.localeCompare(b.token) > 0;
}

/* ---- authorities ------------------------------------------------------------------------------ */

function httpGet(url, ms) {
  return new Promise(resolve => {
    const q = https.get(url, { headers: { 'user-agent': 'ABRA next_regulation.js' } }, res => {
      let d = '';
      res.setEncoding('utf8');            // load-bearing; see durable-ingest.js
      res.on('data', c => { d += c; });
      res.on('end', () => resolve({ code: res.statusCode, body: d }));
    });
    q.on('error', e => resolve({ code: 0, body: '', error: e.message }));
    q.setTimeout(ms || 20000, () => { q.destroy(); resolve({ code: 0, body: '', error: 'timeout' }); });
  });
}

/* The live client's format table. It is `exports.Formats = [ ... ]` — a JS literal with unquoted
 * keys, so it is not JSON and a regex over nested arrays would be guesswork. It is evaluated in a
 * vm context holding nothing but an empty `exports`: no require, no process, no fs. */
async function liveFormats() {
  const r = await httpGet(LIVE_FORMATS_URL);
  if (r.code !== 200 || !r.body) {
    failedTo('read the live format list ' + LIVE_FORMATS_URL, r.error || ('HTTP ' + r.code));
    return null;
  }
  let list = null;
  try {
    const sandbox = { exports: {} };
    vm.runInNewContext(r.body, sandbox, { timeout: 5000 });
    list = sandbox.exports.Formats;
  } catch (e) { failedTo('evaluate the live format list', e); return null; }
  if (!Array.isArray(list)) {
    failedTo('evaluate the live format list', 'exports.Formats was ' + typeof list + ', not an array');
    return null;
  }
  const out = [];
  for (const f of list) {
    if (!f || !f.name) continue;              // section headers carry only {section:"..."}
    out.push({ id: toID(f.name), name: f.name, mod: f.mod || null,
               gameType: f.gameType || null, ruleset: Array.isArray(f.ruleset) ? f.ruleset : [] });
  }
  return out;
}

/* The local checkout. Offline and deterministic, and PINNED — this is the arm that tells us
 * whether the format can be simulated, which is a different question from whether it can be
 * collected. */
function dexFormats() {
  let Dex;
  try {
    require('./showdown_path.js');            // sets SHOWDOWN_PATH if a checkout is findable
    if (!process.env.SHOWDOWN_PATH) { failedTo('locate a pokemon-showdown checkout', 'SHOWDOWN_PATH unset and no sibling checkout'); return null; }
    ({ Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim'));
  } catch (e) { failedTo('load the local pokemon-showdown dex', e); return null; }
  let all;
  try { all = Dex.formats.all(); }
  catch (e) { failedTo('walk Dex.formats.all()', e); return null; }
  return all.map(f => ({ id: toID(f.id || f.name), name: f.name, mod: f.mod || null,
                         gameType: f.gameType || null,
                         ruleset: Array.isArray(f.ruleset) ? f.ruleset : [] }));
}

/* Who is actually playing. The all-formats endpoint IGNORES `page` — measured 2026-08-31, pages 1
 * and 2 came back byte-identical — so this is the 51 most recent replays on the whole site and
 * nothing more. It is corroboration, never the detector: a format ships before it has traffic. */
async function recentTraffic() {
  const r = await httpGet(REPLAY_RECENT_URL);
  if (r.code !== 200 || !r.body) { failedTo('read recent replays ' + REPLAY_RECENT_URL, r.error || ('HTTP ' + r.code)); return null; }
  let arr;
  try { arr = JSON.parse(r.body); } catch (e) { failedTo('parse recent replays', e); return null; }
  if (!Array.isArray(arr)) { failedTo('parse recent replays', 'not an array'); return null; }
  const tally = {}, names = {};
  for (const x of arr) {
    const fid = String(x && x.id || '').replace(/-\d+$/, '');
    if (fid) tally[fid] = (tally[fid] || 0) + 1;
    /* search.json rows carry the display name ("[Gen 9 Champions] VGC 2026 Reg M-C"), which is the
     * label the config block needs and formats.js would otherwise have supplied. */
    if (fid && x.format && !names[fid]) names[fid] = String(x.format);
  }
  return { sample: arr.length, tally, names };
}

/* ---- the replay-search arm ---------------------------------------------------------------------
 * The candidate ids are DERIVED from the active regulation's triple by advancing the regulation
 * letter — the last character of the token — and asking the replay server whether anybody has
 * uploaded a game under that id. A hit is a format the server accepts battles in, whatever the
 * client bundle says. It is capped at PROBE_LETTERS and stops at 'z'; nothing here spells an id.
 *
 * The bo3 sibling is probed alongside, because the two ids ship together and the bo3 pool is the
 * open-sheet corpus this project actually studies. */
function probeIds(activeTriple, letters) {
  if (!activeTriple || !activeTriple.token) return [];
  const t = activeTriple.token;
  const last = t.charCodeAt(t.length - 1);
  if (last < 97 || last > 122) return [];       // the token does not end in a letter; nothing to advance
  const out = [];
  for (let i = 1; i <= (letters || PROBE_LETTERS); i++) {
    const code = last + i;
    if (code > 122) break;
    const tok = t.slice(0, -1) + String.fromCharCode(code);
    const base = 'gen' + activeTriple.gen + 'championsvgc' + activeTriple.year + 'reg' + tok;
    out.push(base, base + 'bo3');
  }
  return out;
}

/* `search` is injectable so the arm can be proved WIRED offline: a fake that answers games for the
 * advanced id must produce a candidate, and a fake that answers nothing must not. */
async function replaySearch(id) {
  const r = await httpGet(REPLAY_SEARCH_URL + encodeURIComponent(id));
  if (r.code !== 200 || !r.body) { failedTo('search replays for ' + id, r.error || ('HTTP ' + r.code)); return null; }
  let arr;
  try { arr = JSON.parse(r.body); } catch (e) { failedTo('parse the replay search for ' + id, e); return null; }
  return Array.isArray(arr) ? arr : null;
}

async function replayFormats(activeTriple, search, recent) {
  const ids = probeIds(activeTriple);
  const out = [];
  const seen = new Set();
  const add = (id, name, games, newest, via) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, name: name || null, mod: null, gameType: null, ruleset: [], replay_games: games, replay_newest: newest || null, via });
  };
  for (const id of ids) {
    const arr = await search(id);
    if (!arr || !arr.length) continue;
    const newest = arr.reduce((m, x) => Math.max(m, +(x && x.uploadtime) || 0), 0);
    add(id, arr[0] && arr[0].format, arr.length, newest ? new Date(newest * 1000).toISOString() : null, 'probe');
  }
  /* And whatever the global recent sample happened to carry. It is 51 replays across every format on
   * the site, so it is corroboration on a busy day and silence on a quiet one — but a format whose
   * token is NOT a one-letter advance (a new year, a skipped letter past the cap) can only arrive
   * through here, so it is folded in rather than merely tallied. */
  if (recent) {
    for (const [fid, n] of Object.entries(recent.tally)) {
      if (parseFormatId(fid)) add(fid, recent.names[fid], n, null, 'recent');
    }
  }
  return { probed: ids, hits: out.filter(r => r.via === 'probe').map(r => r.id), rows: out };
}

/* ---- the config side -------------------------------------------------------------------------- */

function knownFormats() {
  let r;
  try { r = JSON.parse(fs.readFileSync(REGS, 'utf8')); }
  catch (e) { failedTo('read data/regulations.json', e); return { active: null, ids: new Set(), activeTriple: null }; }
  const ids = new Set();
  for (const reg of Object.values(r.regulations || {})) {
    if (reg.showdownFormat) ids.add(toID(reg.showdownFormat));
    if (reg.bo3Format) ids.add(toID(reg.bo3Format));
  }
  const act = (r.regulations || {})[r.active] || null;
  const activeTriple = act && act.showdownFormat ? parseFormatId(act.showdownFormat) : null;
  if (!activeTriple) failedTo('parse the active regulation out of data/regulations.json',
    'active=' + JSON.stringify(r.active) + ' showdownFormat=' + JSON.stringify(act && act.showdownFormat));
  return { active: r.active || null, ids, activeTriple };
}

/* ---- the detection ----------------------------------------------------------------------------- */

async function detect(opts) {
  const o = opts || {};
  const known = knownFormats();
  /* THE CONFIG SIDE IS OVERRIDABLE, and that is a test seam rather than a convenience.
   * "Is the ordering rule actually wired?" cannot be answered from today's config, because today's
   * config produces zero candidates — and zero is exactly what an unwired rule produces too. With
   * the active regulation moved back one, the SAME detected rows must reclassify. An identical
   * result across a varied knob means the knob is unwired (docs/LESSONS.md), so the knob has to
   * exist to be varied. It also answers "what would this collect if I had not added X yet". */
  if (o.knownIds) { known.ids = new Set(o.knownIds.map(toID)); }
  if (o.active) { known.activeTriple = parseFormatId(o.active); known.active = '(override) ' + toID(o.active); }

  const live = o.net === false ? null : await liveFormats();
  const dex  = dexFormats();
  const play = o.net === false ? null : await recentTraffic();

  /* One row per format id, merged across whichever authorities answered. */
  const rows = new Map();
  const feed = (arr, where) => {
    if (!arr) return 0;
    let n = 0;
    for (const f of arr) {
      const t = parseFormatId(f.id);
      if (!t) continue;
      /* Corroborate the shape with what the authority declares, where it declares anything. A
       * Champions VGC regulation is a doubles format on a champions mod; refusing on a MISSING
       * field would drop rows from an authority that simply does not carry it. */
      if (f.mod && !/^champions/.test(f.mod)) continue;
      if (f.gameType && f.gameType !== 'doubles') continue;
      n++;
      const r = rows.get(t.id) || Object.assign({ name: f.name || null, seen_in: [], ruleset: [] }, t);
      if (!r.seen_in.includes(where)) r.seen_in.push(where);
      if (f.ruleset && f.ruleset.length) {
        r.ruleset = f.ruleset;
        /* The ruleset is the AUTHORITY on bo3, not the id spelling. Record which one decided, so a
         * fallback to the id suffix is visible rather than assumed. */
        const bo3 = f.ruleset.some(x => /^Best of\s*=\s*3$/i.test(String(x)));
        if (bo3 !== r.bo3) { r.bo3 = bo3; }
        r.bo3_source = 'ruleset';
        r.open_team_sheets = f.ruleset.some(x => /Open Team Sheets/i.test(String(x)))
          ? (f.ruleset.some(x => /Force Open Team Sheets/i.test(String(x))) ? 'forced' : 'optional')
          : 'none';
      }
      if (!r.name && f.name) r.name = f.name;
      rows.set(t.id, r);
    }
    return n;
  };

  const nLive = feed(live, 'live');
  const nDex  = feed(dex, 'dex');

  /* THE REPLAY-SEARCH ARM. Only ids the other two authorities did NOT list are fed from it, so a
   * format that is in formats.js gains nothing here and the ingest artifact's signature — which
   * records seen_in — cannot flicker with whichever 51 replays the global sample held this run. */
  const search = o.replaySearch || (o.net === false ? null : replaySearch);
  const replay = search ? await replayFormats(known.activeTriple, search, play) : null;
  const replayNew = replay ? replay.rows.filter(f => { const t = parseFormatId(f.id); return t && !rows.has(t.id); }) : null;
  const nReplay = feed(replayNew, 'replay');
  if (replay) for (const f of replay.rows) { const r = rows.get(parseFormatId(f.id).id); if (r && r.seen_in.includes('replay')) { r.replay_games = f.replay_games; r.replay_newest = f.replay_newest; } }

  for (const r of rows.values()) {
    r.known = known.ids.has(r.id);
    r.later_than_active = laterThan(r, known.activeTriple);
    r.classification = r.known ? 'known'
      : (r.later_than_active ? 'candidate' : 'superseded');
    r.recent_replays = play ? (play.tally[r.id] || 0) : null;
    r.simulatable = r.seen_in.includes('dex');
    /* A replay is a battle the server accepted. That is the whole meaning of collectable. */
    r.collectable = r.seen_in.includes('live') || r.seen_in.includes('dex') || r.seen_in.includes('replay');
  }

  const all = [...rows.values()].sort((a, b) =>
    a.gen - b.gen || a.year - b.year || a.token.localeCompare(b.token) || (a.bo3 ? 1 : 0) - (b.bo3 ? 1 : 0));

  const candidates = all.filter(r => r.classification === 'candidate');
  const unknown    = all.filter(r => !r.known);

  /* THE LAG THAT WILL ACTUALLY BITE. A format on the live server and not in the pinned checkout can
   * be collected and cannot be simulated. That is not an error and it must not read as one — but it
   * is the thing somebody has to act on, so it gets its own counter. */
  const collectable_not_simulatable = all.filter(r => r.collectable && !r.seen_in.includes('dex'));
  /* The client bundle lagging the server: a format with games in its replay pool that formats.js
   * does not list. This is the case that was missed on 2026-09-09 and it gets its own counter. */
  const replay_only = all.filter(r => r.seen_in.includes('replay') && !r.seen_in.includes('live'));

  return {
    generated: new Date().toISOString(),
    authorities: {
      live: { url: LIVE_FORMATS_URL, reached: !!live, formats_listed: live ? live.length : 0, vgc_reg_rows: nLive },
      dex:  { path: process.env.SHOWDOWN_PATH || null, reached: !!dex, formats_listed: dex ? dex.length : 0, vgc_reg_rows: nDex },
      replays: play ? { url: REPLAY_RECENT_URL, sample: play.sample } : { url: REPLAY_RECENT_URL, reached: false },
      replay_search: replay
        ? { url: REPLAY_SEARCH_URL + '<id>', probed: replay.probed, hits: replay.hits, vgc_reg_rows: nReplay }
        : { url: REPLAY_SEARCH_URL + '<id>', reached: false, probed: [] }
    },
    active_regulation: known.active,
    active_format: known.activeTriple ? known.activeTriple.id : null,
    known_format_ids: [...known.ids].sort(),
    counters: {
      vgc_regulation_formats_detected: all.length,
      known: all.filter(r => r.known).length,
      unknown: unknown.length,
      candidates: candidates.length,
      superseded: all.filter(r => r.classification === 'superseded').length,
      collectable_not_simulatable: collectable_not_simulatable.length,
      replay_only: replay_only.length,
      problems: PROBLEMS.length
    },
    formats: all,
    candidates,
    problems: PROBLEMS.slice()
  };
}

/* ---- the paste-ready config block, derived ------------------------------------------------------
 * On the day, somebody has to add the regulation to data/regulations.json and flip `active`. This
 * prints exactly what to paste, read off the authority. It deliberately does NOT write the file:
 * flipping `active` re-points the LADDER collector, which is the one edit that could stop the
 * existing corpus growing, and that is a person's decision. */
function configBlock(res) {
  const bo1 = res.candidates.filter(r => !r.bo3);
  if (!bo1.length) return null;
  const out = {};
  for (const r of bo1) {
    const bo3 = res.candidates.find(x => x.bo3 && x.token === r.token && x.year === r.year && x.gen === r.gen);
    out['reg' + r.token] = {
      label: r.name || null,
      showdownFormat: r.id,
      bo3Format: bo3 ? bo3.id : null,
      openTeamSheets: r.open_team_sheets ? r.open_team_sheets !== 'none' : null,
      started: null,
      started_evidence: 'FILL IN — first replay uploadtime in data/games.' + r.id + '.jsonl',
      status: 'active'
    };
  }
  return out;
}

function report(res) {
  const c = res.counters;
  console.log('NEXT REGULATION — detected from the format authorities, not from a constant');
  console.log('');
  console.log(`  live formats.js : ${res.authorities.live.reached ? res.authorities.live.formats_listed + ' formats listed' : 'NOT REACHED'}`);
  console.log(`  local dex       : ${res.authorities.dex.reached ? res.authorities.dex.formats_listed + ' formats listed' : 'NOT REACHED'}  ${res.authorities.dex.path || ''}`);
  console.log(`  active in config: ${res.active_format || 'NONE'}  (data/regulations.json -> ${res.active_regulation})`);
  const rs = res.authorities.replay_search;
  console.log(`  replay search   : ${rs && rs.probed && rs.probed.length ? rs.probed.length + ' derived id(s) probed, ' + (rs.hits || []).length + ' with games' : 'NOT PROBED'}`);
  console.log('');
  console.log(`  Champions VGC regulation formats detected: ${c.vgc_regulation_formats_detected}`);
  for (const r of res.formats) {
    const where = r.seen_in.join('+');
    const traffic = r.recent_replays === null ? '' : `  ${r.recent_replays} of the last 51 replays`;
    const pool = r.replay_games ? `  ${r.replay_games} in its search pool${r.replay_newest ? ', newest ' + r.replay_newest : ''}` : '';
    console.log(`    ${r.id.padEnd(32)} ${r.classification.padEnd(10)} [${where}]${traffic}${pool}`);
  }
  console.log('');
  if (c.replay_only) {
    console.log(`  ::warning::${c.replay_only} format(s) have games on the replay server and are NOT in formats.js yet.`);
    console.log('  The client bundle lags the server; a replay is a battle the server accepted. Collectable now.');
    console.log('');
  }

  /* THE ZERO THAT IS AN ALARM. Nothing detected means the AUTHORITY broke, not that the game
   * changed — there has never been a moment with no Champions VGC format. */
  if (c.vgc_regulation_formats_detected === 0) {
    console.log('  ::error::NO CHAMPIONS VGC REGULATION FORMAT WAS DETECTED AT ALL.');
    console.log('  That is not a rotation; it is the detector failing. Neither authority answered with');
    console.log('  a format matching gen<N>championsvgc<YYYY>reg<token>. Nothing was collected.');
  } else if (c.candidates === 0) {
    console.log('  THE NEXT REGULATION DOES NOT EXIST YET. Nothing to collect, and nothing collected.');
    console.log(`  Every detected format is already in the config or sorts before ${res.active_format},`);
    console.log(`  and none of the ${rs && rs.probed ? rs.probed.length : 0} derived next-letter id(s) has a replay.`);
    console.log('  This is the expected state until Showdown ships the format. It is not an error.');
  } else {
    console.log('  ::warning::A NEW CHAMPIONS VGC REGULATION IS LIVE.');
    for (const r of res.candidates) {
      console.log(`    ${r.id}  ${r.name || ''}`);
      console.log(`      seen in ${r.seen_in.join('+')}; ${r.simulatable ? 'in the local dex' : 'NOT in the local dex — collectable, NOT simulatable'}`);
      if (r.open_team_sheets) console.log(`      open team sheets: ${r.open_team_sheets}`);
    }
    const blk = configBlock(res);
    if (blk) {
      console.log('');
      console.log('  Paste into data/regulations.json -> regulations, then set "active" BY HAND:');
      console.log(JSON.stringify(blk, null, 2).split('\n').map(l => '    ' + l).join('\n'));
    }
  }

  if (c.collectable_not_simulatable) {
    console.log('');
    console.log(`  ::warning::${c.collectable_not_simulatable} format(s) are on the live server and NOT in the pinned checkout.`);
    console.log('  Replays can be collected today; the simulator cannot play them until somebody pulls');
    console.log('  pokemon-showdown. Those are two different jobs and only the first one is automatic.');
  }

  /* Unknown-and-superseded is the case where the ordering rule could be wrong. Say it out loud. */
  const oddballs = res.formats.filter(r => !r.known && r.classification === 'superseded');
  if (oddballs.length) {
    console.log('');
    console.log(`  ${oddballs.length} format(s) are unknown to the config and sort BEFORE the active regulation,`);
    console.log('  so they are treated as superseded and are NOT collected:');
    for (const r of oddballs) console.log(`    ${r.id}  ${r.name || ''}`);
  }

  if (res.problems.length) {
    console.log('');
    console.log(`  ${res.problems.length} problem(s) while reading the authorities:`);
    for (const p of res.problems) console.log('    - ' + p);
  }
}

/* ---- THE FLIP IS ONE EDIT AND IT MOVES EVERYTHING AT ONCE ---------------------------------------
 *
 * Setting `active` in data/regulations.json simultaneously re-points the ladder collector, re-labels
 * data/meta-usage.json (which CHOMP reads), re-points CS.FORMAT for both live bots, and re-points the
 * simulator at a format the pinned checkout may not carry. NOTHING SEQUENCES THOSE, and the report
 * above deliberately leaves the edit to a person — correctly, but a person with no procedure.
 *
 * THE BLAST RADIUS IS DERIVED, THE ORDER IS A JUDGEMENT. The file list below is read out of the
 * source on every run, so it cannot go stale the way a typed checklist would (this repository's
 * fourteen handoffs and its ban list of four are what a typed one is worth). The ORDER is prose,
 * because it follows the invalidation graph in docs/DIVISIONS.md and no scan can derive that.
 *
 * IT IS A PROCEDURE, NOT A GATE. Nothing here refuses anything; the gates that do are named in it. */
/* THE RADIUS BELOW CANNOT SEE A TYPED FORMAT ID, BY CONSTRUCTION. It derives what the flip touches
 * from files that READ data/regulations.json or take the format from champions_sim. A file with the
 * id typed into it does NEITHER, so it is invisible to the derivation that exists to be complete —
 * and it keeps working after the flip, about the previous regulation, reporting success. The
 * predicate is engine/format_id_scan.js and is not restated here. */
const FORMAT_IDS = require(path.join(__dirname, 'format_id_scan.js'));

const UNREADABLE_DIRS = [];
function readersOfActive() {
  const dirs = ['engine', 'build', 'tests', 'web', path.join('.github', 'workflows')];
  const direct = [], viaSim = [];
  const walk = (d, out = []) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); }
    catch (e) {
      /* NOT SILENT. A directory this cannot read is a BLIND SPOT IN THE BLAST RADIUS, and the
       * whole point of the checklist is that it derives the radius rather than listing it. A
       * silent skip would under-report what the flip touches, which is the one failure this
       * procedure exists to prevent. */
      UNREADABLE_DIRS.push(d + ': ' + e.message);
      return out;
    }
    for (const e of ents) {
      if (e.isDirectory()) { if (!['node_modules', '.git'].includes(e.name)) walk(path.join(d, e.name), out); }
      else if (/\.(js|py|yml|yaml)$/.test(e.name)) out.push(path.join(d, e.name));
    }
    return out;
  };
  for (const dir of dirs) {
    for (const f of walk(path.join(ROOT, dir))) {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      if (rel.startsWith('engine/next_regulation')) continue;      // this file and its ingest
      let t = '';
      /* NOT SILENT, same reason as the directory walk: a file this cannot read is a file whose
       * relationship to the flip is UNKNOWN, not absent. */
      try { t = fs.readFileSync(f, 'utf8'); }
      catch (e) { UNREADABLE_DIRS.push(rel + ': ' + e.message); continue; }
      /* A READ, not a mention: the config name on the same line as a read or a require. Prose about
       * data/regulations.json is not a reader, and several files in this repository carry a lot of it. */
      const reads = t.split('\n').some(l => /regulations\.json/.test(l) && /(readFileSync|require|json\.load|open\()/i.test(l));
      const usesFormat = /champions_sim/.test(t) && /(\.FORMAT\b|dexFor\s*\()/.test(t);
      const writesData = /writeFileSync/.test(t) && /['"`]?data\//.test(t);
      const net = /(replay|play)\.pokemonshowdown\.com/.test(t);
      if (reads) direct.push({ rel, writesData, net });
      else if (usesFormat) viaSim.push({ rel, writesData, net });
    }
  }
  const bySize = (a, b) => a.rel.localeCompare(b.rel);
  return { direct: direct.sort(bySize), viaSim: viaSim.sort(bySize) };
}

function checklist(res) {
  const R = readersOfActive();
  const PINS = FORMAT_IDS.liveCallSites(['tests']);
  const PINNED_FILES = new Set(PINS.hits.map(h => h.split(':')[0])).size;
  console.log('THE FLIP — what must happen in the same pass, and in this order\n');
  const viaWriters = R.viaSim.filter(x => x.writesData).length;
  console.log(`  ${R.direct.length} file(s) read data/regulations.json directly. ${R.viaSim.length} more take the`);
  /* A COUNTER NOTHING READS IS NOT A COUNTER. An unreadable directory is a hole in a radius
   * this command exists to DERIVE, so it is named here rather than skipped. */
  if (UNREADABLE_DIRS.length) console.log('  ' + UNREADABLE_DIRS.length
    + ' DIRECTORY/IES COULD NOT BE READ, so the radius below is INCOMPLETE: '
    + UNREADABLE_DIRS.join('; '));
  console.log(`  format from champions_sim (CS.FORMAT / dexFor), ${viaWriters} of which write a data/ artifact —`);
  console.log('  those need no edit and are not listed: they follow the config by construction, which is');
  console.log('  exactly why one edit has this blast radius.\n');
  console.log('  The DIRECT readers that write an artifact are the ones to run and check by hand:\n');
  for (const f of R.direct.filter(x => x.writesData)) console.log(`    WRITES   ${f.rel}${f.net ? '   [network]' : ''}`);
  const quiet = R.direct.filter(x => !x.writesData);
  console.log(`\n  and ${quiet.length} direct reader(s) write nothing: ` +
    quiet.map(f => f.rel).join(', ') + '\n');

  const steps = [
    ['ARCHIVE THE OUTGOING REGULATION FIRST — it is the one unrecoverable step.',
      ['node build/triggers.js            # says whether the archive is already due',
       'node build/archive-regulation.js  # snapshots store + raw logs + models into data/archive/<reg>/']],
    ['ASK WHETHER THE NEW FORMAT IS SIMULATABLE, NOT MERELY COLLECTABLE. These are two different',
      ['authorities and the pinned checkout LAGS the server by days.',
       'node engine/next_regulation.js    # "collectable, NOT simulatable" means pull pokemon-showdown first',
       'node engine/champions_sim.js      # must print FOUND for the NEW id after the flip;',
       '                                  # champions_sim.dexFor REFUSES an unknown id, so 228 call sites stop']]  ,
    ['EDIT data/regulations.json: paste the block this script prints, then set "active".',
      ['The label and the Showdown id must name the SAME regulation —',
       'engine/durable-ingest.js activeStoreFormat() throws if they disagree, because the store rows',
       'are keyed on a token derived from the label.']],
    ['REBUILD WHAT THE FORMAT DECIDES, in the same pass. Every one of these is a frozen release source',
      ['or an input to one, so a release cut before they settle freezes the previous regulation:',
       'node build/build_browser_data.js         # data/mega-formes.js, data/move-effects.js',
       'node engine/switchin_order.js --write    # data/switchin-order.json',
       'node engine/tag_dex.js && node build/build_tags_js.js   # data/tags.json, data/abra-tags.js',
       'node build/build_engine_data.js && node engine/merge_mega_into_engine.js  # data/engine-data.js',
       'node engine/artifact_audit.js            # check H FAILS until every new mega has a row with bs']],
    ['RE-POINT THE STORE AND THE MODEL.',
      ['The new regulation has been collected into data/games.<newformat>.jsonl since the day it shipped',
       '(engine/next_regulation_ingest.js). Decide which store is "the ladder" and say so.',
       'node engine/analyze.js                   # REFUSES if the store holds no row of the active regulation',
       'node build/triggers.js                   # the rotation alarm can only fire once rows carry the new token']],
    ['DECIDE EVERY FORMAT ID TYPED UNDER tests/. ' + PINS.hits.length + ' live call site(s) across ' + PINNED_FILES + ' file(s)',
      ['name a format directly instead of following the config, so after the flip each one keeps',
       'passing about the PREVIOUS regulation. Most are legitimate pins on what was MEASURED and',
       'rewriting those would be editing the record — so this is a DECISION per site, not a',
       'find-and-replace, and it is the one step here that nothing else in this repository schedules.',
       'node tests/probe_format_id_derivation.js  # lists them; engine/ and build/ are the GATE and are 0',
       'ids named today: ' + FORMAT_IDS.idsNamed(PINS.hits).join(', ')]],
    ['ONLY THEN CUT A RELEASE AND RE-MEASURE.',
      ['Every release cut before this describes the previous regulation.',
       'node engine/status.js                    # what is stale, what is quarantined, what is owed',
       'node engine/provenance.js']],
  ];
  steps.forEach(([head, rest], i) => {
    console.log(`  ${i + 1}. ${head}`);
    for (const l of rest) console.log('     ' + l);
    console.log('');
  });

  const blk = configBlock(res);
  if (blk) {
    console.log('  The block to paste at step 3, read off the authority:');
    console.log(JSON.stringify(blk, null, 2).split('\n').map(l => '    ' + l).join('\n'));
  } else {
    console.log('  No candidate regulation is live yet, so there is no block to paste at step 3.');
  }
}

async function main() {
  const net = !process.argv.includes('--no-net');
  const res = await detect({ net });
  if (process.argv.includes('--json')) { console.log(JSON.stringify(res, null, 1)); return; }
  if (process.argv.includes('--checklist')) { checklist(res); return; }
  report(res);
  console.log('');
  console.log('  (report only — the artifact is written by engine/next_regulation_ingest.js)');
  console.log('  node engine/next_regulation.js --checklist   what the flip itself must move, in order');
}

if (require.main === module) main();
module.exports = { detect, parseFormatId, laterThan, toID, configBlock, report, VGC_REG, probeIds, PROBE_LETTERS };
