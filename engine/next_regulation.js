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
 *   PLAY  replay.pokemonshowdown.com/search.json — evidence anybody is actually playing it.
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
  const tally = {};
  for (const x of arr) {
    const fid = String(x && x.id || '').replace(/-\d+$/, '');
    if (fid) tally[fid] = (tally[fid] || 0) + 1;
  }
  return { sample: arr.length, tally };
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

  for (const r of rows.values()) {
    r.known = known.ids.has(r.id);
    r.later_than_active = laterThan(r, known.activeTriple);
    r.classification = r.known ? 'known'
      : (r.later_than_active ? 'candidate' : 'superseded');
    r.recent_replays = play ? (play.tally[r.id] || 0) : null;
    r.simulatable = r.seen_in.includes('dex');
    r.collectable = r.seen_in.includes('live') || r.seen_in.includes('dex');
  }

  const all = [...rows.values()].sort((a, b) =>
    a.gen - b.gen || a.year - b.year || a.token.localeCompare(b.token) || (a.bo3 ? 1 : 0) - (b.bo3 ? 1 : 0));

  const candidates = all.filter(r => r.classification === 'candidate');
  const unknown    = all.filter(r => !r.known);

  /* THE LAG THAT WILL ACTUALLY BITE. A format on the live server and not in the pinned checkout can
   * be collected and cannot be simulated. That is not an error and it must not read as one — but it
   * is the thing somebody has to act on, so it gets its own counter. */
  const collectable_not_simulatable = all.filter(r => r.seen_in.includes('live') && !r.seen_in.includes('dex'));

  return {
    generated: new Date().toISOString(),
    authorities: {
      live: { url: LIVE_FORMATS_URL, reached: !!live, formats_listed: live ? live.length : 0, vgc_reg_rows: nLive },
      dex:  { path: process.env.SHOWDOWN_PATH || null, reached: !!dex, formats_listed: dex ? dex.length : 0, vgc_reg_rows: nDex },
      replays: play ? { url: REPLAY_RECENT_URL, sample: play.sample } : { url: REPLAY_RECENT_URL, reached: false }
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
  console.log('');
  console.log(`  Champions VGC regulation formats detected: ${c.vgc_regulation_formats_detected}`);
  for (const r of res.formats) {
    const where = r.seen_in.join('+');
    const traffic = r.recent_replays === null ? '' : `  ${r.recent_replays} of the last 51 replays`;
    console.log(`    ${r.id.padEnd(32)} ${r.classification.padEnd(10)} [${where}]${traffic}`);
  }
  console.log('');

  /* THE ZERO THAT IS AN ALARM. Nothing detected means the AUTHORITY broke, not that the game
   * changed — there has never been a moment with no Champions VGC format. */
  if (c.vgc_regulation_formats_detected === 0) {
    console.log('  ::error::NO CHAMPIONS VGC REGULATION FORMAT WAS DETECTED AT ALL.');
    console.log('  That is not a rotation; it is the detector failing. Neither authority answered with');
    console.log('  a format matching gen<N>championsvgc<YYYY>reg<token>. Nothing was collected.');
  } else if (c.candidates === 0) {
    console.log('  THE NEXT REGULATION DOES NOT EXIST YET. Nothing to collect, and nothing collected.');
    console.log(`  Every detected format is already in the config or sorts before ${res.active_format}.`);
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

async function main() {
  const net = !process.argv.includes('--no-net');
  const res = await detect({ net });
  if (process.argv.includes('--json')) { console.log(JSON.stringify(res, null, 1)); return; }
  report(res);
  console.log('');
  console.log('  (report only — the artifact is written by engine/next_regulation_ingest.js)');
}

if (require.main === module) main();
module.exports = { detect, parseFormatId, laterThan, toID, configBlock, report, VGC_REG };
