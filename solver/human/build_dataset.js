/* solver/human/build_dataset.js — the Reg M-C open-sheet HUMAN DECISION dataset.
 *
 *   cmd.exe /c tools\lownode.cmd solver\human\build_dataset.js [--limit N] [--out solver/out/human]
 *
 * Reads the tracked raw-log shards of the Reg M-C bo3 stream (the open-sheet ladder), parses every
 * game with solver/human/parse_game.js, filters, and writes:
 *   games.jsonl       one kept game per line: { game, turns }
 *   exclusions.jsonl  one excluded game per line: { id, reason, reasons, detail }
 *   manifest.json     every input file (path, bytes, sha256), the Showdown checkout, the filter
 *                     rules, and every count this run produced
 *
 * THE STORE MOVES HOURLY. Each shard is read into memory ONCE and hashed from those same bytes, so
 * the manifest describes exactly what was parsed; a shard written after the listing is not read.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const X = require('./dex.js');
const { parseGame, parseShowteam, ParseError } = require('./parse_game.js');
const { extract } = require('../../engine/durable-ingest.js');
/* THE STORE'S QUALITY RULES ARE engine/quality.js's, CALLED, NEVER COPIED (2026-09-30). This file used to read
 * min_games / max_distinct_teams out of data/quality-filter.json and run its own behavioural-bot rule, so when MEASURE
 * added the Reg M-C tempo clause (abra/regmc 1.36.0) the copy kept the old rule. Every game is now turned into the
 * store's own row shape by durable-ingest extract() and charged by Q.reasons(g, cfg, Q.behaviouralBots(...)): the bot
 * set, the forfeit rule, the bring rule, the Reg M-C legality verdict and the custom-ruleset verdict, as they are today. */
const Q = require('../../engine/quality.js');

const ROOT = path.join(__dirname, '..', '..');
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const LIMIT = +arg('limit', 0) || 0;
const OUT = path.resolve(ROOT, arg('out', 'solver/out/human'));
const RAWDIR = path.join(ROOT, 'data', 'raw', 'games.' + X.FORMAT);
/* OPEN-SHEET BO3 PLAY, NOT THE bo3 FORMAT ALONE (Will, 2026-10-01). engine/quality.js isOpenSheetBo3() admits the bo3
 * format and bo1-format rooms whose custom rules are exactly `Force Open Team Sheets` + `Best of = 3`. So the bo1 raw
 * shards are read too, and a bo1 row is kept at read time only when its own infobox makes it that game; every other
 * bo1 row is dropped before it is held in memory and is not counted here (it is not part of this stream). A bo1 room is
 * judged by the behavioural-bot set of the bo1 store it sits in, as loadGames() judges each store. */
/* 2026-10-01, Will's second decision: this is a TURN-LEVEL dataset (MAG, DODUO, the human prior, GARY, MILTANK's human
 * KL), so it takes OPEN-SHEET TURN PLAY, engine/quality.js isOpenSheetTurnPlay(): the bo3 format, plus every bo1-format
 * game in which both sheets were shown (offered and accepted, or forced) under no rule other than a sheet or best-of
 * rule. Every kept game carries `open_sheet_bo3` (isOpenSheetBo3) so a SERIES-LEVEL reader (CHOMP, XATU's bring model,
 * the arena's sheet pool, ROTOM's team candidates) keeps only the series games. */
const BO1_FORMAT = X.SINGLES_FORMAT;               // misnamed in dex.js: the bo1 DOUBLES format id, read from regulations.json
const RAWDIR_BO1 = path.join(ROOT, 'data', 'raw', 'games.' + BO1_FORMAT);
const CUSTOM_BOX = /<strong>\s*(\d+)\s+custom rules?:<\/strong>\s*<\/summary>\s*([^<]*)/i;

/* Our own accounts are declared once, in data/quality-filter.json rules.exclude_own_accounts (2026-10-01), and read
 * through engine/quality.js. The typed list that stood here named MAG2, which no file shows we used. */
const isOwn = n => Q.isOwnAccount(n);

/* The eject rule is the frozen pool's (data/team-pool-frozen-regmc/FROZEN.md): a game before the
 * boundary in which an Eject Button is declared was played under the pre-fix rule. */
const EJECT_BOUNDARY = Date.parse('2026-09-14T00:00:00Z') / 1000;

/* quality.js reason codes: `bot` and `behavioural_bot` keep this file's historical names (named_bot, behavioural_bot);
 * every other code is charged as `quality:<code>`. A code quality.js adds later is still recorded, after this order. */
const QUALITY_NAME = code => code === 'bot' ? 'named_bot' : code === 'behavioural_bot' ? 'behavioural_bot' : 'quality:' + code;
/* GAME-SHAPE codes are quality.js's and are COUNTED, NOT CHARGED. They judge whether a game is a complete record
 * (forfeit before any action, under 3 turns, fewer than four revealed per side), not whether it is a legitimate human game;
 * a DECISION dataset keeps a partial game's decisions and has its own `no_action` rule. Charging them removed 1,016 of the
 * first 3,000 bo3 rows (partial_bring), measured 2026-09-30 — a change to MAG/DODUO's data nobody decided. Every
 * population code (bots, legality, declared and detected custom rules, corrupt winner) is charged. */
const GAME_SHAPE = new Set(['forfeit_no_action', 'short', 'partial_bring']);
const REASON_ORDER = ['duplicate_id', 'wrong_format', 'no_open_sheet', 'custom_rules', 'own_account', 'named_bot',
  'behavioural_bot', 'quality:illegal_team',
  'quality:corrupt_winner', 'quality:nonstandard_ruleset', 'quality:custom_ruleset', 'quality:unreadable',
  'illegal_entity', 'pre_ejectbutton_fix', 'illusion_on_sheet', 'no_result', 'no_action', 'parse_error'];

const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

function readShards() {
  const inputs = [], rows = [];
  let bo1Read = 0, bo1Kept = 0;
  for (const [dir, bo1] of [[RAWDIR, false], [RAWDIR_BO1, true]]) {
    if (bo1 && !fs.existsSync(dir)) { console.error('build_dataset: no bo1 raw shards at ' + rel(dir) + '; its open-sheet bo3 rooms are NOT read'); continue; }
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl.gz')).sort()) {
      const abs = path.join(dir, f);
      const buf = fs.readFileSync(abs);
      inputs.push({ path: rel(abs), bytes: buf.length, sha256: sha256(buf) });
      const txt = zlib.gunzipSync(buf).toString('utf8');
      let n = 0;
      for (const line of txt.split('\n')) {
        if (!line.trim()) continue;
        if (bo1) {
          bo1Read++;
          /* a bo1 row enters this stream only as open-sheet turn play; the classifier reads its own infobox and whether
           * both sheets were shown (both `|showteam|` lines; in the bo1 format they appear only when both accept) */
          const m = CUSTOM_BOX.exec(line);
          const id = (/^\{"id":"([^"]+)"/.exec(line) || [])[1];
          const sheetsShown = line.includes('|showteam|p1|') && line.includes('|showteam|p2|');
          if (!id || !Q.isOpenSheetTurnPlay({ id, sheetsShown }, m ? m[2].replace(/\\n/g, ' ').trim() : null)) continue;
          bo1Kept++;
        }
        try { rows.push(Object.assign(JSON.parse(line), { _shard: f, _bo1: bo1 })); n++; }
        catch (e) { rows.push({ id: null, _bad_json: true, _shard: f }); }
      }
      inputs[inputs.length - 1].rows = n;
    }
  }
  return { inputs, rows, bo1: { rows_read: bo1Read, open_sheet_bo3_rooms_kept: bo1Kept } };
}

/* Header-only read used for bot detection and cheap filters (no turn parse). */
function header(row) {
  const h = { p1: null, p2: null, sheets: {}, custom: null, tier: null };
  for (const line of String(row.log || '').split('\n')) {
    if (line.startsWith('|player|')) { const p = line.split('|'); if (p[3] && !h[p[2]]) h[p[2]] = p[3]; }
    else if (line.startsWith('|showteam|')) { const p = line.split('|'); h.sheets[p[2]] = parseShowteam(p.slice(3).join('|')); }
    else if (line.startsWith('|tier|')) h.tier = line.slice(6);
    else if (/custom rules?:<\/strong>/i.test(line)) { const m = /<strong>\s*(\d+)\s+custom rules?:<\/strong>\s*<\/summary>\s*([^<]*)/i.exec(line); h.custom = m ? m[2].trim() : 'unparsed'; }
    else if (line.startsWith('|start')) break;
  }
  return h;
}

function illegalEntities(sheets) {
  const bad = [];
  for (const s of ['p1', 'p2']) for (const m of sheets[s] || []) {
    if (!X.legal(X.species(m.species))) bad.push('species:' + m.species);
    if (m.item && !X.legal(X.item(m.item))) bad.push('item:' + m.item);
    if (m.ability && !X.legal(X.ability(m.ability))) bad.push('ability:' + m.ability);
    for (const mv of m.moves) if (!X.legal(X.move(mv))) bad.push('move:' + mv);
  }
  return bad;
}

function baseId(sp) { const s = X.species(sp); return s.exists ? X.toID(s.baseSpecies) : X.toID(sp); }

function main() {
  const t0 = Date.now();
  fs.mkdirSync(OUT, { recursive: true });
  const cfg = Q.config();

  const { inputs, rows: allRows, bo1: bo1Stream } = readShards();
  const rows = LIMIT ? allRows.slice(0, LIMIT) : allRows;
  const byReason = {}, allReasons = {}, parseCodes = {}, parseExamples = {}, qualityShapeNotCharged = {};
  const excl = new Map();                 // id-or-index -> {reasons:[], detail}
  const addEx = (key, r, d) => { let e = excl.get(key); if (!e) excl.set(key, e = { reasons: [], detail: {} }); if (!e.reasons.includes(r)) e.reasons.push(r); if (d) e.detail[r] = d; };

  // ---- pass 1: dedupe + headers + account stats
  const seen = new Map(), uniq = [];
  let dupConflict = 0;
  for (let k = 0; k < rows.length; k++) {
    const r = rows[k];
    if (r._bad_json || !r.id) { addEx('#' + k, 'parse_error', 'bad_json'); inc(parseCodes, 'bad_json'); continue; }
    if (seen.has(r.id)) { if (seen.get(r.id).log !== r.log) dupConflict++; addEx(r.id + '#dup' + k, 'duplicate_id'); continue; }
    seen.set(r.id, r); uniq.push(r);
  }
  /* the store-shaped row of every unique game (durable-ingest extract, the ingest's own parser), slim, for the bot set;
   * the full row is re-made in pass 2 and charged there */
  const H = new Map(), qSlim = [];
  let qUnreadable = 0;
  for (const r of uniq) {
    H.set(r.id, header(r));
    let g = null; try { g = extract(r.id, r.uploadtime, r.log); } catch (e) { qUnreadable++; }
    if (g && !r._bo1) qSlim.push({ id: g.id, date: g.date, p1: g.p1, p2: g.p2, six: g.six });
  }
  const behaviouralBots = Q.behaviouralBots(qSlim, cfg);
  /* the bo1 store's own bot set, for the bo1 rooms (an account property, judged over the store the room sits in) */
  let bo1Bots = new Set(), bo1BotsFrom = null;
  if (uniq.some(r => r._bo1)) {
    const p = path.join(ROOT, 'data', 'games.' + BO1_FORMAT + '.jsonl');
    bo1BotsFrom = rel(Q.storePath(p));
    bo1Bots = Q.behaviouralBots(Q.readStore(p), cfg);
  }

  // ---- pass 2: filter + parse + write
  const gOut = fs.openSync(path.join(OUT, 'games.jsonl.tmp'), 'w');
  const stats = { games_kept: 0, turns: 0, side_turn_decisions: 0, slot_actions: 0, by_kind: {}, hidden_reasons: {}, locked_reasons: {},
    joint_fully_observed: 0, joint_with_hidden: 0, target_uncertain: 0, targeted_moves: 0, mega_actions: 0,
    midturn_switch_choices: 0, midturn_by_reason: {}, forced_replacements: 0, aux_moves: 0, target_filled_from_anim: 0,
    midturn_switch_unattributed: 0, terminal_turns: 0, open_sheet_bo3: 0, open_sheet_turn_play_only: 0, open_sheet_bo3_by_consent: 0, rated: 0, unrated: 0, end: {}, with_series: 0,
    extract_crosscheck: { games: 0, leads_agree: 0, brought_agree: 0, disagree_examples: [] } };
  const accountsKept = new Set();
  for (const r of uniq) {
    const h = H.get(r.id);
    const id = r.id;
    const fmtOk = r._bo1 ? id.startsWith(BO1_FORMAT + '-') && (!h.tier || /Reg M-C/.test(h.tier))
                         : id.startsWith(X.FORMAT + '-') && (!h.tier || /Reg M-C \(Bo3\)/.test(h.tier));
    const regime = Q.openSheetRegime({ id, sheetsShown: !!(h.sheets.p1 && h.sheets.p2) }, h.custom || null);
    if (!fmtOk || !regime.turn_play) addEx(id, 'wrong_format', h.tier);
    if (!h.sheets.p1 || !h.sheets.p2) addEx(id, 'no_open_sheet');
    /* a custom rule other than a sheet or best-of rule excludes the room (Will, 2026-10-01) */
    if (h.custom && !Q.sheetRulesOnly(regime)) addEx(id, 'custom_rules', h.custom);
    const names = [h.p1, h.p2].filter(Boolean);
    if (names.some(isOwn)) addEx(id, 'own_account', names.filter(isOwn).join(','));
    let ex = null;
    try { ex = extract(id, r.uploadtime, r.log); } catch (e) { /* charged below as quality:unreadable */ }
    if (!ex) addEx(id, 'quality:unreadable');
    else for (const code of Q.reasons(ex, cfg, r._bo1 ? bo1Bots : behaviouralBots)) {
      if (GAME_SHAPE.has(code)) { inc(qualityShapeNotCharged, code); continue; }
      if (code === 'own_account') continue;            /* charged above, under this file's own name */
      addEx(id, QUALITY_NAME(code), code === 'bot' || code === 'behavioural_bot' ? names.join(',') : null);
    }
    if (h.sheets.p1 && h.sheets.p2) {
      const bad = illegalEntities(h.sheets);
      if (bad.length) addEx(id, 'illegal_entity', bad.join(';'));
      const all = [...h.sheets.p1, ...h.sheets.p2];
      if (r.uploadtime && r.uploadtime < EJECT_BOUNDARY && all.some(m => X.toID(m.item) === 'ejectbutton')) addEx(id, 'pre_ejectbutton_fix');
      if (all.some(m => X.toID(m.ability) === 'illusion')) addEx(id, 'illusion_on_sheet');
    }
    let parsed = null;
    try { parsed = parseGame(r); }
    catch (e) {
      const code = e instanceof ParseError ? e.code : 'exception:' + (e.message || '').split('\n')[0].slice(0, 60);
      addEx(id, 'parse_error', code + (e.detail ? ' — ' + e.detail : ''));
      inc(parseCodes, code);
      (parseExamples[code] = parseExamples[code] || []).length < 5 && parseExamples[code].push({ id, detail: e.detail || e.message });
    }
    if (parsed) {
      const g = parsed.game;
      if (!g.winner && !g.tie) addEx(id, 'no_result', g.end);
      const anyAction = parsed.turns.some(t => ['p1', 'p2'].some(s => ['a', 'b'].some(p => t.actions[s][p] && t.actions[s][p].kind !== 'hidden')));
      if (!anyAction) addEx(id, 'no_action', 'turns=' + parsed.turns.length);
    }
    const e = excl.get(id);
    if (e) continue;

    // ---- kept
    const { game: g, turns, counts } = parsed;
    /* the series answer, for series-level readers (see BO1_FORMAT above) */
    g.open_sheet_bo3 = regime.bo3;
    g.open_sheet_bo3_by_consent = regime.bo3_by_consent;
    regime.bo3 ? stats.open_sheet_bo3++ : stats.open_sheet_turn_play_only++;
    if (regime.bo3_by_consent) stats.open_sheet_bo3_by_consent++;
    stats.games_kept++; stats.turns += turns.length;
    stats.aux_moves += counts.aux_moves; stats.target_filled_from_anim += counts.target_filled_from_anim;
    stats.midturn_switch_unattributed += counts.midturn_switch_unattributed;
    g.rated ? stats.rated++ : stats.unrated++;
    inc(stats.end, g.end || 'none');
    if (g.series) stats.with_series++;
    accountsKept.add(g.players.p1 && g.players.p1.name); accountsKept.add(g.players.p2 && g.players.p2.name);
    for (const t of turns) {
      if (t.terminal) stats.terminal_turns++;
      for (const s of ['p1', 'p2']) {
        const acts = ['a', 'b'].map(p => t.actions[s][p]).filter(Boolean);
        if (!acts.length) continue;
        stats.side_turn_decisions++;
        if (acts.every(a => a.kind === 'move' || a.kind === 'switch')) stats.joint_fully_observed++;
        if (acts.some(a => a.kind === 'hidden')) stats.joint_with_hidden++;
        for (const a of acts) {
          stats.slot_actions++; inc(stats.by_kind, a.kind);
          if (a.kind === 'hidden') inc(stats.hidden_reasons, a.reason);
          if (a.kind === 'locked') inc(stats.locked_reasons, a.reason);
          if (a.mega) stats.mega_actions++;
          if (a.kind === 'move' && X.choosable(a.move)) { stats.targeted_moves++; if (!a.target_certain) stats.target_uncertain++; }
        }
      }
      stats.forced_replacements += t.replacements.length;
      stats.midturn_switch_choices += t.midturn_switches.filter(m => !/^drag/.test(m.reason)).length;
      for (const m of t.midturn_switches) inc(stats.midturn_by_reason, m.reason);
    }
    // independent cross-check against the repo's extractor
    if (ex) {
      const cx = stats.extract_crosscheck; cx.games++;
      const mine = s => ({ lead: g.leads[s].map(i => baseId(g.sheets[s][i].species)).sort().join(','), brought: g.brought_seen[s].map(i => baseId(g.sheets[s][i].species)).sort().join(',') });
      const theirs = s => ({ lead: (ex.lead[s] || []).map(baseId).sort().join(','), brought: (ex.brought[s] || []).map(baseId).sort().join(',') });
      const la = ['p1', 'p2'].every(s => mine(s).lead === theirs(s).lead), ba = ['p1', 'p2'].every(s => mine(s).brought === theirs(s).brought);
      if (la) cx.leads_agree++; if (ba) cx.brought_agree++;
      if ((!la || !ba) && cx.disagree_examples.length < 10) cx.disagree_examples.push({ id, mine: { p1: mine('p1'), p2: mine('p2') }, extract: { p1: theirs('p1'), p2: theirs('p2') } });
    }
    fs.writeSync(gOut, JSON.stringify({ game: g, turns }) + '\n');
  }
  fs.closeSync(gOut);
  fs.renameSync(path.join(OUT, 'games.jsonl.tmp'), path.join(OUT, 'games.jsonl'));

  // ---- exclusions
  const xOut = fs.openSync(path.join(OUT, 'exclusions.jsonl'), 'w');
  for (const [key, e] of excl) {
    const primary = REASON_ORDER.find(r => e.reasons.includes(r)) || e.reasons[0];
    inc(byReason, primary);
    for (const r of e.reasons) inc(allReasons, r);
    fs.writeSync(xOut, JSON.stringify({ id: key.replace(/#.*$/, ''), reason: primary, reasons: e.reasons, detail: e.detail }) + '\n');
  }
  fs.closeSync(xOut);

  const outFiles = ['games.jsonl', 'exclusions.jsonl'].map(f => { const b = fs.readFileSync(path.join(OUT, f)); return { path: rel(path.join(OUT, f)), bytes: b.length, sha256: sha256(b) }; });
  const manifest = {
    generated: new Date().toISOString(),
    generator: 'solver/human/build_dataset.js',
    schema_version: 1,
    format: X.FORMAT,
    source: { kind: 'raw-log shards (tracked, written by the next-regulation collector)', dir: rel(RAWDIR), dir_bo1: rel(RAWDIR_BO1), shards: inputs.length,
              rows: allRows.length, rows_used: rows.length, limit: LIMIT || null, bo1_stream: bo1Stream, inputs },
    open_sheet_bo3: 'engine/quality.js isOpenSheetBo3(), carried per game as game.open_sheet_bo3: the bo3 format, bo1-format rooms under exactly Force Open Team Sheets + Best of = 3, and bo1-format Best of = 3 rooms where both players accepted the sheets (Will, 2026-10-01)',
    open_sheet_turn_play: 'engine/quality.js isOpenSheetTurnPlay(), the admission rule of this dataset: open-sheet bo3 plus every bo1-format game with both sheets shown under no rule other than a sheet or best-of rule (Will, 2026-10-01). Series-level readers keep game.open_sheet_bo3 only.',
    showdown: { path: X.SHOWDOWN_PATH, head_commit: X.checkoutCommit(), pinned_commit_in_regulations_json: X.PINNED_COMMIT },
    filters: {
      order: REASON_ORDER,
      own_accounts: [...Q.ownAccounts()], own_accounts_from: 'data/quality-filter.json rules.exclude_own_accounts',
      quality: { rule: 'engine/quality.js reasons(g, cfg, behaviouralBots(...)) on the durable-ingest extract() row of every game; bot -> named_bot, behavioural_bot -> behavioural_bot, any other code -> quality:<code>',
        config_version: cfg.version || null, quality_js_sha256: sha256(fs.readFileSync(path.join(ROOT, 'engine', 'quality.js'))),
        quality_filter_sha256: sha256(fs.readFileSync(path.join(ROOT, 'data', 'quality-filter.json'))),
        behavioural_bot_rule: cfg.rules.exclude_behavioural_bots, computed_over: 'every unique game in this stream (' + qSlim.length + ' readable, ' + qUnreadable + ' unreadable)',
        behavioural_bot_accounts: [...behaviouralBots].sort(), bo1_rooms_judged_by_bots_of: bo1BotsFrom, bo1_behavioural_bot_accounts: [...bo1Bots].sort(), game_shape_codes_counted_not_charged: [...GAME_SHAPE], game_shape_not_charged_counts: qualityShapeNotCharged },
      custom_rules: 'Showdown infobox `N custom rule(s):` in the raw log',
      illegal_entity: 'any sheet species/item/ability/move with isNonstandard or tier Illegal under Dex.forFormat(' + X.FORMAT + ') — learnsets NOT checked',
      pre_ejectbutton_fix: 'uploadtime < 2026-09-14T00:00Z AND Eject Button on either sheet (data/team-pool-frozen-regmc/FROZEN.md)',
      illusion_on_sheet: 'an Illusion ability on either sheet — the log shows the disguise, so switch decisions and state would be wrong (Illusion is the declared exclusion)',
      no_result: 'no |win| and no |tie|', no_action: 'no observed move/switch/locked action in any turn',
    },
    counts: {
      rows_in: rows.length, unique_games: uniq.length, duplicate_rows: rows.length - uniq.length - (parseCodes.bad_json || 0), duplicate_conflicting_logs: dupConflict,
      games_kept: stats.games_kept, games_excluded: uniq.length - stats.games_kept,
      excluded_by_primary_reason: byReason, excluded_any_reason: allReasons, parse_error_codes: parseCodes,
      distinct_accounts_kept: accountsKept.size, ...stats,
    },
    parse_error_examples: parseExamples,
    outputs: outFiles,
    seconds: Math.round((Date.now() - t0) / 1000),
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(JSON.stringify(manifest.counts, null, 1));
  console.log('wrote', OUT, 'in', manifest.seconds, 's');
}

if (require.main === module) main();
module.exports = { header, illegalEntities };
