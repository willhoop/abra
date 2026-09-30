/* solver/porygon2/v2/extract.js — build PORYGON2 v2's position datasets from the Reg M-C stores. Store-only: no simulator.
 *
 *   cmd.exe /c tools\lownode.cmd solver\porygon2\v2\extract.js --fmt bo1|bo3 [--root <checkout>] [--out <dir>] [--limit N]
 *
 *   bo1  the closed-sheet stream   data/games.gen9championsvgc2026regmc.jsonl.gz     + data/raw/games.gen9championsvgc2026regmc/
 *   bo3  the open-sheet stream     data/games.gen9championsvgc2026regmcbo3.jsonl.gz  + data/raw/games.gen9championsvgc2026regmcbo3/
 *
 * THE PARSED STORE DECIDES WHICH GAMES; THE RAW LOG DECIDES WHAT EACH POSITION SHOWS. The parsed `.gz` store is read
 * EXPLICITLY by path (engine/quality.js storePath() would prefer a stale plain file beside it) and every game is put
 * through engine/quality.js reasons() with the behavioural-bot set computed over the same file (quality.js
 * behaviouralBots) — the rules loadGames() applies, bot rules included. The parsed store has no per-turn item or
 * ability events, so the positions are rebuilt from the raw replay log (solver/porygon2/v2/reveal.js), joined on id.
 *
 * FURTHER EXCLUSIONS, in this order after quality: own_account; no_raw_log; wrong_format; illusion_possible (a preview
 * species that can hold Illusion in the Reg M-C dex — the log shows the disguise, the project's declared exclusion;
 * checked on the preview BEFORE the parse, because a disguise can surface as a parse error); parse_error; custom_rules
 * (Showdown's own infobox in the raw log: quality's custom-rule list keys on Reg M-B ids and removes nothing here);
 * illegal_entity (a preview species, or a revealed / sheet item, ability or move outside the regulation);
 * pre_ejectbutton_fix (before 2026-09-14 with an Eject Button on the sheet (bo3) or revealed (bo1): the frozen pool's
 * rule); no_result; no_position.
 *
 * OUTPUT (solver/out/porygon2-v2/<fmt>/, gitignored): games.jsonl.gz, one kept game per line —
 *   { id, fmt, date, uploadtime, shard (the raw-log file it was read from), players:{p1,p2}, rating:{p1,p2}, split, band:{min,max}, labels:{z,end,turns,final},
 *     positions:[ { n, x, y:{ turns_left, next_ko } } ] }
 * `x` is the input (reveal.js); `y` and `labels` are targets and are never inside `x`. manifest.json names every file
 * read (bytes, sha256; the parsed store also by git blob id) and written, the code digests, the rules and every count.
 * A copy of the manifest is written to solver/porygon2/v2/manifest-<fmt>.json (tracked, small).
 *
 * SPLIT. By player, with MAG/DODUO's salt (solver/prior/build_features.js: sha256("abra-prior-v0:" + toID(name)) mod
 * 100: < 80 train, < 90 val, else test), lifted to the GAME so no game is on both sides of the line: test if either
 * player is a test player, else val if either is a val player, else train. A value net shares one outcome between the
 * two chairs of a game, so a per-player split of positions would put the same result in train and test.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

/* BelowNormal from inside the process as well, for a harness that cannot launch tools\lownode.cmd (the same class the
 * wrapper sets; a failure to lower is printed, never fatal). */
try { require('os').setPriority(0, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { console.error('could not lower priority: ' + e.message); }
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const FMT = flag('fmt', 'bo1');
if (FMT !== 'bo1' && FMT !== 'bo3') { console.error('--fmt bo1|bo3'); process.exit(2); }
const MAIN = 'C:/Users/willj/Projects/Pokemon/ABRA';
const DATA_ROOT = path.resolve(flag('root', MAIN));
const REPO = path.join(__dirname, '..', '..', '..');
const OUT = path.resolve(REPO, flag('out', 'solver/out/porygon2-v2'), FMT);
const LIMIT = +flag('limit', 0) || 0;
if (!process.env.SHOWDOWN_PATH) {
  const sib = path.join(DATA_ROOT, '..', 'pokemon-showdown-mc');
  if (fs.existsSync(path.join(sib, 'dist', 'sim'))) process.env.SHOWDOWN_PATH = sib;
}
const X = require('../../human/dex.js');
const R = require('./reveal.js');
const Q = require('../../../engine/quality.js');

const REG = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'regulations.json'), 'utf8')).runtime.regmc;
const FORMAT_ID = FMT === 'bo3' ? REG.bo3Format : REG.bo3Format.replace(/bo3$/, '');
const STORE = path.join(DATA_ROOT, 'data', 'games.' + FORMAT_ID + '.jsonl.gz');
const RAWDIR = path.join(DATA_ROOT, 'data', 'raw', 'games.' + FORMAT_ID);
const RAWPLAIN = path.join(DATA_ROOT, 'data', 'games.' + FORMAT_ID + '.raw-logs.jsonl');

const OWN = new Set(['medicham32', 'willhoop', 'mag', 'mag2', 'miltank', 'miltank2']);   // solver/meta/extract.js OWN
const EJECT_BOUNDARY = Date.parse('2026-09-14T00:00:00Z') / 1000;                       // data/team-pool-frozen-regmc
const SALT = 'abra-prior-v0';
const BANDS = [[null, 'unrated'], [0, '<1100'], [1100, '1100-1199'], [1200, '1200-1299'], [1300, '1300-1399'], [1400, '1400-1499'], [1500, '1500-1599'], [1600, '>=1600']];
const THRESH = [1300, 1400, 1500, 1600];

const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const blobId = b => crypto.createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const rel = p => path.relative(REPO, p).replace(/\\/g, '/');
const splitOfPlayer = name => { const h = crypto.createHash('sha256').update(SALT + ':' + X.toID(name)).digest().readUInt32BE(0) % 100; return h < 80 ? 'train' : h < 90 ? 'val' : 'test'; };
const splitOfGame = (a, b) => { const s = [splitOfPlayer(a), splitOfPlayer(b)]; return s.includes('test') ? 'test' : s.includes('val') ? 'val' : 'train'; };
function band(r) { if (r == null || !isFinite(r)) return 'unrated'; let b = BANDS[1][1]; for (const [lo, name] of BANDS.slice(1)) if (r >= lo) b = name; return b; }

function eachLine(txt, fn) {
  let i = 0;
  while (i < txt.length) { let j = txt.indexOf('\n', i); if (j < 0) j = txt.length; const line = txt.slice(i, j); i = j + 1; if (line.trim()) fn(line); }
}

/* Illusion holders, derived from the regulation (never typed) */
const ILLUSION = new Set(X.D.species.all().filter(X.legal).filter(s => Object.values(s.abilities || {}).includes('Illusion')).map(s => s.baseSpecies));

function main() {
  const t0 = Date.now();
  fs.mkdirSync(OUT, { recursive: true });
  const cfg = Q.config();
  const inputs = [];

  // ---------------------------------------------------------------- 1. the parsed store, explicitly the .gz
  const sbuf = fs.readFileSync(STORE);
  inputs.push({ role: 'parsed_store', path: STORE.replace(/\\/g, '/'), bytes: sbuf.length, sha256: sha256(sbuf), git_blob: blobId(sbuf), mtime: fs.statSync(STORE).mtime.toISOString() });
  const stxt = zlib.gunzipSync(sbuf).toString('utf8');
  const slim = [], storeSets = new Map();
  let storeRows = 0, storeBad = 0;
  eachLine(stxt, line => {
    storeRows++;
    let g; try { g = JSON.parse(line); } catch (e) { storeBad++; return; }
    slim.push({ id: g.id, date: g.date, p1: g.p1, p2: g.p2, winner: g.winner, forfeit: g.forfeit, six: g.six, brought: g.brought,
      turns: (g.turns || []).map(t => ({ ev: (t.ev || []).filter(e => e.t === 'm' || e.t === 's').slice(0, 1) })) });
    if (FMT === 'bo1') storeSets.set(g.id, g.sets || {});
  });
  const seenIds = new Set(); let dupStore = 0;
  const games = slim.filter(g => { if (seenIds.has(g.id)) { dupStore++; return false; } seenIds.add(g.id); return true; });
  const bots = Q.behaviouralBots(games, cfg);
  const funnel = { store_rows: storeRows, store_bad_json: storeBad, store_duplicate_ids: dupStore, store_games: games.length };
  const qFirst = {}, qAll = {};
  const want = new Map();                        // id -> slim game that passed quality + own
  /* GAME-SHAPE CODES ARE RECORDED, NOT CHARGED (Will, 2026-09-30): for the VALUE-NET datasets a forfeit, a short game
   * and a partial bring are real outcomes, so quality.js's forfeit_no_action / short / partial_bring do not exclude a
   * game here. Each kept row carries its quality reasons in `quality_reasons`, so the rule can be revisited by a filter
   * rather than a rebuild. Bots, illegal teams and custom-rule games stay excluded. */
  const GAME_SHAPE = new Set(['forfeit_no_action', 'short', 'partial_bring']);
  const qShape = {};
  for (const g of games) {
    const all = Q.reasons(g, cfg, bots);
    const rs = all.filter(r => !GAME_SHAPE.has(r));
    g.quality_reasons = all;
    for (const r of all) if (GAME_SHAPE.has(r)) inc(qShape, r);
    const names = [g.p1 && g.p1.name, g.p2 && g.p2.name].filter(Boolean);
    if (names.some(n => OWN.has(X.toID(n)))) rs.push('own_account');
    if (rs.length) { inc(qFirst, rs[0]); for (const r of rs) inc(qAll, r); continue; }
    want.set(g.id, g);
  }
  funnel.quality_clean = games.length - Object.entries(qFirst).filter(([k]) => k !== 'own_account').reduce((a, [, v]) => a + v, 0);
  funnel.after_own_account = want.size;
  funnel.game_shape_codes_recorded_not_charged = { codes: [...GAME_SHAPE], store_games_carrying: qShape };
  const behaviouralBotAccounts = [...bots].sort();
  if (LIMIT) { const keep = [...want.keys()].slice(0, LIMIT); for (const id of [...want.keys()]) if (!keep.includes(id)) want.delete(id); }

  // ---------------------------------------------------------------- 2. the raw logs, joined on id
  /* the dated shards first, the old plain archive last: a game in both is credited to its shard */
  const rawFiles = [];
  if (fs.existsSync(RAWDIR)) for (const f of fs.readdirSync(RAWDIR).filter(f => f.endsWith('.jsonl.gz')).sort()) rawFiles.push(path.join(RAWDIR, f));
  if (fs.existsSync(RAWPLAIN)) rawFiles.push(RAWPLAIN);
  /* GATE (a) ELIGIBILITY. PORYGON2 v1 trained on the human dataset (solver/out/human/, main checkout), whose manifest
   * lists every raw shard it read. A bo3 game read from a shard NOT on that list was never seen by v1, so the paired
   * v1-vs-v2 held-out comparison is fair to both only on those games (design §6). Recorded per game as `v1_unseen`. */
  const V1_MANIFEST = path.join(DATA_ROOT, 'solver', 'out', 'human', 'manifest.json');
  let v1Shards = null;
  if (FMT === 'bo3' && fs.existsSync(V1_MANIFEST)) {
    const vb = fs.readFileSync(V1_MANIFEST);
    inputs.push({ role: 'v1_human_dataset_manifest', path: V1_MANIFEST.replace(/\\/g, '/'), bytes: vb.length, sha256: sha256(vb) });
    v1Shards = new Set(JSON.parse(vb.toString('utf8')).source.inputs.map(x => path.basename(x.path)));
  }
  const outFile = path.join(OUT, 'games.jsonl.gz');
  const tmpFile = outFile + '.tmp';
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  const done = new Set();
  const excl = {}, parseCodes = {}, parseExamples = {};
  const tally = { games: 0, positions: 0, split: { train: { games: 0, positions: 0 }, val: { games: 0, positions: 0 }, test: { games: 0, positions: 0 } },
    by_band_min: {}, by_band_max: {}, min_at_least: {}, max_at_least: {}, both_rated: 0, end: {}, z: {} };
  const counters = {};
  const reveal = { brought_members: 0, moves_known: 0, item_orig_known: 0, ability_base_known: 0, ability_by_dex: 0, by_turn: {} };
  const xcheck = { members: 0, moves_equal: 0, moves_subset_of_store: 0, store_subset_of_moves: 0, item_compared: 0, item_equal: 0, ability_compared: 0, ability_equal: 0, disagree_examples: [] };
  let buf = [], rawRows = 0, rawDup = 0, rawConflict = 0;
  const rawLog = new Map();
  const flush = () => { if (buf.length) { fs.appendFileSync(tmpFile, zlib.gzipSync(Buffer.from(buf.join('\n') + '\n', 'utf8'))); buf = []; } };
  const exclude = (id, why, detail) => { inc(excl, why); if (detail && why === 'parse_error') { inc(parseCodes, detail); (parseExamples[detail] = parseExamples[detail] || []).length < 5 && parseExamples[detail].push(id); } };

  for (const f of rawFiles) {
    const b = fs.readFileSync(f);
    const rec = { role: 'raw_log', path: f.replace(/\\/g, '/'), bytes: b.length, sha256: sha256(b), rows: 0 };
    inputs.push(rec);
    const txt = f.endsWith('.gz') ? zlib.gunzipSync(b).toString('utf8') : b.toString('utf8');
    eachLine(txt, line => {
      let r; try { r = JSON.parse(line); } catch (e) { return; }
      rec.rows++; rawRows++;
      if (!r.id || !want.has(r.id)) return;
      if (done.has(r.id)) { rawDup++; if (rawLog.get(r.id) !== sha256(r.log || '')) rawConflict++; return; }
      done.add(r.id); rawLog.set(r.id, sha256(r.log || ''));
      const sg = want.get(r.id);
      const log = String(r.log || '');
      // header filters
      const tier = (/\|tier\|([^\n]*)/.exec(log) || [])[1] || '';
      if (!/Reg M-C/.test(tier) || (FMT === 'bo3') !== /\(Bo3\)/.test(tier)) return exclude(r.id, 'wrong_format');
      /* Illusion first, from the preview alone: a disguised member's lines are credited to the member it copies, which
       * can surface as a parse error (five members with more than four moves) before any later check would see it. */
      const preview = [...log.matchAll(/\n\|poke\|p[12]\|([^,|\n]+)/g)].map(x => x[1].trim());
      if (preview.some(sp => ILLUSION.has(X.species(sp).baseSpecies))) return exclude(r.id, 'illusion_possible');
      let g;
      try { g = R.extract(log, { mode: FMT }); }
      catch (e) { return exclude(r.id, e.code === 'illusion_replace' ? 'illusion_possible' : 'parse_error', e.code || ('exception:' + String(e.message).slice(0, 60))); }
      if (g.game.custom_rules) return exclude(r.id, 'custom_rules');
      const fin = g.final_state;
      const previewSp = ['p1', 'p2'].flatMap(s => fin[s].map(m => m.species));
      if (previewSp.some(sp => ILLUSION.has(X.species(sp).baseSpecies))) return exclude(r.id, 'illusion_possible');
      const bad = [];
      for (const s of ['p1', 'p2']) for (const m of fin[s]) {
        if (!X.legal(X.species(m.species))) bad.push('species:' + m.species);
        for (const it of [m.item.orig, m.item.now]) if (it && it !== R.UNK && !X.legal(X.item(it))) bad.push('item:' + it);
        if (m.ability.base !== R.UNK && m.ability.base && !X.legal(X.ability(m.ability.base))) bad.push('ability:' + m.ability.base);
        for (const mv of m.moves) if (mv !== R.UNK && !X.legal(X.move(mv))) bad.push('move:' + mv);
      }
      if (bad.length) return exclude(r.id, 'illegal_entity');
      const ups = r.uploadtime || null;
      if (ups && ups < EJECT_BOUNDARY && ['p1', 'p2'].some(s => fin[s].some(m => m.item.orig === 'Eject Button' || m.item.now === 'Eject Button'))) return exclude(r.id, 'pre_ejectbutton_fix');
      const L = R.labels(g);
      if (L.z == null) return exclude(r.id, 'no_result');
      if (!g.positions.length) return exclude(r.id, 'no_position');

      // ---- kept
      const rp1 = sg.p1 && sg.p1.rating != null ? +sg.p1.rating : null, rp2 = sg.p2 && sg.p2.rating != null ? +sg.p2.rating : null;
      const rated = rp1 != null && rp2 != null && isFinite(rp1) && isFinite(rp2);
      const lo = rated ? Math.min(rp1, rp2) : null, hi = rated ? Math.max(rp1, rp2) : null;
      const split = splitOfGame(sg.p1.name, sg.p2.name);
      for (const k in g.counts) inc(counters, k, g.counts[k]);
      const row = { id: r.id, fmt: FMT, date: sg.date, uploadtime: ups, shard: path.basename(f), v1_unseen: v1Shards ? (f !== RAWPLAIN && !v1Shards.has(path.basename(f))) : null, players: { p1: sg.p1.name, p2: sg.p2.name }, rating: { p1: rp1, p2: rp2 },
        split, band: { min: band(lo), max: band(hi) }, sheets_public: g.game.sheets_public, quality_reasons: sg.quality_reasons || [], labels: { z: L.z, end: L.end, turns: L.turns, final: L.final },
        positions: g.positions.map((p, k) => ({ n: p.n, x: p.x, y: { turns_left: L.per[k].turns_left, next_ko: L.per[k].next_ko } })) };
      buf.push(JSON.stringify(row));
      if (buf.length >= 500) flush();
      const np = row.positions.length;
      tally.games++; tally.positions += np; tally.split[split].games++; tally.split[split].positions += np;
      if (row.v1_unseen) { const o = tally.gate_a_eligible = tally.gate_a_eligible || { all: { games: 0, positions: 0 }, test: { games: 0, positions: 0 }, test_by_band_min: {} };
        o.all.games++; o.all.positions += np;
        if (split === 'test') { o.test.games++; o.test.positions += np; const b = o.test_by_band_min[row.band.min] = o.test_by_band_min[row.band.min] || { games: 0, positions: 0 }; b.games++; b.positions += np; } }
      if (rated) tally.both_rated++;
      if (g.game.sheets_public) tally.sheets_public = (tally.sheets_public || 0) + 1;
      for (const [key, b] of [['by_band_min', row.band.min], ['by_band_max', row.band.max]]) { const o = tally[key][b] = tally[key][b] || { games: 0, positions: 0, test_games: 0, test_positions: 0 }; o.games++; o.positions += np; if (split === 'test') { o.test_games++; o.test_positions += np; } }
      for (const t of THRESH) {
        if (lo != null && lo >= t) { const o = tally.min_at_least[t] = tally.min_at_least[t] || { games: 0, positions: 0, test_games: 0 }; o.games++; o.positions += np; if (split === 'test') o.test_games++; }
        if (hi != null && hi >= t) { const o = tally.max_at_least[t] = tally.max_at_least[t] || { games: 0, positions: 0, test_games: 0 }; o.games++; o.positions += np; if (split === 'test') o.test_games++; }
      }
      inc(tally.end, L.end || 'none'); inc(tally.z, String(L.z));
      // reveal statistics: at game end, and by turn bucket (members that have taken the field)
      for (const s of ['p1', 'p2']) for (const m of fin[s]) if (m.brought === true) {
        reveal.brought_members++;
        reveal.moves_known += m.moves.filter(x => x !== R.UNK).length;
        if (m.item.orig !== R.UNK) reveal.item_orig_known++;
        if (m.ability.base !== R.UNK) reveal.ability_base_known++;
        if (m.ability_src === 'dex') reveal.ability_by_dex++;
      }
      for (const p of row.positions) {
        const bk = p.n <= 3 ? 't' + p.n : p.n <= 5 ? 't4-5' : p.n <= 8 ? 't6-8' : 't9+';
        const o = reveal.by_turn[bk] = reveal.by_turn[bk] || { positions: 0, members_on_field_so_far: 0, moves_known: 0, item_orig_known: 0, ability_base_known: 0 };
        o.positions++;
        for (const s of ['p1', 'p2']) for (const m of p.x.sides[s].mons) if (m.brought === true) {
          o.members_on_field_so_far++; o.moves_known += m.moves.filter(x => x !== R.UNK).length;
          if (m.item.orig !== R.UNK) o.item_orig_known++; if (m.ability.base !== R.UNK) o.ability_base_known++;
        }
      }
      // cross-check the end-of-game reveals against the parsed store's own `sets` (bo1): an independent parser
      if (FMT === 'bo1' && !g.game.sheets_public) {       // a room with public sheets would agree with the store trivially
        const sets = storeSets.get(r.id) || {};
        const sp1 = new Set(fin.p1.map(m => X.toID(m.species))), sp2 = new Set(fin.p2.map(m => X.toID(m.species)));
        for (const s of ['p1', 'p2']) for (const m of fin[s]) {
          if (m.brought !== true) continue;
          const key = X.toID(m.species);
          if (sp1.has(key) && sp2.has(key)) continue;           // a mirror species shares one store entry
          const st = sets[key]; if (!st) continue;
          const megaKeys = Object.keys(sets).filter(k => k !== key && k.startsWith(key) && /mega/.test(k.slice(key.length)));
          const storeMoves = new Set([...(st.moves || []), ...megaKeys.flatMap(k => sets[k].moves || [])].map(x => X.move(x).name || x));
          const mine = new Set(m.moves.filter(x => x !== R.UNK));
          xcheck.members++;
          const eq = mine.size === storeMoves.size && [...mine].every(x => storeMoves.has(x));
          if (eq) xcheck.moves_equal++;
          if ([...mine].every(x => storeMoves.has(x))) xcheck.moves_subset_of_store++;
          if ([...storeMoves].every(x => mine.has(x))) xcheck.store_subset_of_moves++;
          if (st.item) { xcheck.item_compared++; if (m.item.orig === st.item) xcheck.item_equal++; else if (xcheck.disagree_examples.length < 12) xcheck.disagree_examples.push({ id: r.id, species: m.species, field: 'item', store: st.item, ours: m.item.orig }); }
          if (st.ability) { xcheck.ability_compared++; if (m.ability.base === st.ability) xcheck.ability_equal++; else if (xcheck.disagree_examples.length < 12) xcheck.disagree_examples.push({ id: r.id, species: m.species, field: 'ability', store: st.ability, ours: m.ability.base }); }
          if (!eq && xcheck.disagree_examples.length < 12) xcheck.disagree_examples.push({ id: r.id, species: m.species, field: 'moves', store: [...storeMoves], ours: [...mine] });
        }
      }
    });
  }
  flush();
  for (const id of want.keys()) if (!done.has(id)) inc(excl, 'no_raw_log');
  if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  if (fs.existsSync(tmpFile)) fs.renameSync(tmpFile, outFile);
  const obuf = fs.existsSync(outFile) ? fs.readFileSync(outFile) : Buffer.alloc(0);

  const code = {};
  for (const f of ['solver/porygon2/v2/reveal.js', 'solver/porygon2/v2/extract.js', 'engine/quality.js', 'data/quality-filter.json', 'solver/human/dex.js'])
    code[f] = sha256(fs.readFileSync(path.join(REPO, f)));
  const m = {
    what: 'PORYGON2 v2 position dataset, ' + FMT + ' (' + FORMAT_ID + '): the public state at the start of every turn, per-field reveal state, both pre-game ratings, outcome and auxiliary labels',
    built: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), node: process.version, argv,
    format: FORMAT_ID, mode: FMT, data_root: DATA_ROOT.replace(/\\/g, '/'),
    showdown: { path: X.SHOWDOWN_PATH.replace(/\\/g, '/'), commit: X.checkoutCommit(), pinned: X.PINNED_COMMIT },
    code, inputs, quality: { config_version: cfg.version || null, behavioural_bot_accounts: behaviouralBotAccounts.length, behavioural_bot_names: behaviouralBotAccounts,
      excluded_first_reason: qFirst, excluded_any_reason: qAll },
    filters: { order: ['quality reasons() incl. bot + behavioural_bot (game-shape codes forfeit_no_action / short / partial_bring recorded in quality_reasons, not charged)', 'own_account', 'no_raw_log', 'wrong_format', 'illusion_possible (preview)', 'parse_error', 'custom_rules', 'illegal_entity', 'pre_ejectbutton_fix', 'no_result', 'no_position'],
      own_accounts: [...OWN], illusion_species: [...ILLUSION], eject_boundary: '2026-09-14T00:00:00Z',
      split: 'player split sha256("' + SALT + ':" + toID(name)) mod 100 (<80 train, <90 val, else test), lifted to the game: test if either player is test, else val if either is val, else train' },
    funnel: Object.assign(funnel, { raw_rows_read: rawRows, raw_duplicate_ids: rawDup, raw_duplicate_conflicting_logs: rawConflict, excluded_after_quality: excl, kept: tally.games }),
    parse_errors: parseCodes, parse_examples: parseExamples,
    counts: tally, reveal_counters: counters, reveal_at_game_end: Object.assign({}, reveal, {
      moves_known_per_brought_member: reveal.brought_members ? +(reveal.moves_known / reveal.brought_members).toFixed(3) : null,
      item_orig_known_share: reveal.brought_members ? +(reveal.item_orig_known / reveal.brought_members).toFixed(4) : null,
      ability_base_known_share: reveal.brought_members ? +(reveal.ability_base_known / reveal.brought_members).toFixed(4) : null }),
    crosscheck_vs_store_sets: FMT === 'bo1' ? xcheck : 'n/a (bo3 sheets are complete)',
    outputs: [{ path: rel(outFile), bytes: obuf.length, sha256: sha256(obuf), games: tally.games, positions: tally.positions }],
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(m, null, 1));
  if (!LIMIT) fs.writeFileSync(path.join(__dirname, 'manifest-' + FMT + '.json'), JSON.stringify(m, null, 1) + '\n');
  console.log(JSON.stringify({ fmt: FMT, funnel: m.funnel, split: tally.split, by_band_min: tally.by_band_min, min_at_least: tally.min_at_least, max_at_least: tally.max_at_least,
    reveal: m.reveal_at_game_end.moves_known_per_brought_member, xcheck: FMT === 'bo1' ? { members: xcheck.members, moves_equal: xcheck.moves_equal, item: [xcheck.item_equal, xcheck.item_compared], ability: [xcheck.ability_equal, xcheck.ability_compared] } : null,
    out: m.outputs[0], seconds: m.seconds }, null, 1));
}

main();
