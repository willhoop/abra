/* solver/dusk/measure_endgames.js — DUSK's meta measurement: what endgames occur in Reg M-C, and how big they are.
 * Store-only: no simulator is loaded, no game is played.
 *
 *   cmd.exe /c tools\lownode.cmd solver/dusk/measure_endgames.js --fmt bo3|bo1 [--root <checkout>] [--out <dir>] [--limit N]
 *
 *   bo3  the open-sheet stream    data/games.gen9championsvgc2026regmcbo3.jsonl.gz + data/raw/games.gen9championsvgc2026regmcbo3/
 *   bo1  the closed-sheet stream  data/games.gen9championsvgc2026regmc.jsonl.gz    + data/raw/games.gen9championsvgc2026regmc/
 *
 * THE PARSED STORE DECIDES WHICH GAMES; THE RAW LOG DECIDES WHAT EACH POSITION SHOWS (the PORYGON2 v2 rule,
 * solver/porygon2/v2/extract.js). The parsed `.gz` store is read explicitly by path, and EVERY engine/quality.js reasons()
 * code excludes a game (bots and behavioural bots included, the bot set computed over the same file). Then: own accounts;
 * no raw log; wrong format; a preview Illusion holder (the project's declared exclusion); a parse error; custom rules;
 * no result. Positions are rebuilt from the raw log by solver/porygon2/v2/reveal.js (one forward pass, the public state
 * at each `|turn|n` line).
 *
 * DEFINITIONS (the endgame is a START-OF-TURN position, after replacements):
 *   alive(side)  teamsize − fainted members (a brought member never seen counts alive)
 *   E2  both sides have ≤ 2 alive. In doubles every live member is then on the field: no bench, no switch. PRIMARY.
 *   E4  ≤ 4 alive in total (adds 3v1).            E1  1v1.
 * The FIRST position meeting a definition is the endgame's entry. "Ahead" = more alive; the tiebreak where noted is the
 * summed displayed HP % of the alive members.
 *
 * ABSTRACTION KEYS (canonical: tokens sorted within a side, the two sides sorted, so the key is colour-blind):
 *   K0      the species matchup (current forme, so a mega counts as its mega forme)
 *   K0set   + each member's set: item now, ability now, the four known moves (bo3; in bo1 the moves seen so far)
 *   K1q     K0 + HP in quarters (0-25, 25-50, 50-75, 75-100)         K1d   K0 + HP in tenths
 *   K2      K1d + status + nonzero stat stages + key volatiles (substitute, perish, encore, taunt, confusion, …)
 *   K3      K2 + the field: weather, terrain, Trick Room, each side's Tailwind / screens
 *   K3set   K0set + HP exact (displayed %) + status + boosts + volatiles + field: the exact public state minus timers
 * A TABLE HIT RATE is measured chronologically: the keys of the first 80% of endgames (by upload time) against the last 20%.
 *
 * OUTPUT (gitignored): solver/out/dusk/endgames-<fmt>.json (every count) and solver/out/dusk/positions-<fmt>.jsonl.gz (each
 * game's E2 entry position, with id, ratings and result: the bank the DUSK "must beat" test draws its starts from).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

try { require('os').setPriority(0, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { console.error('could not lower priority: ' + e.message); }
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const FMT = flag('fmt', 'bo3');
if (FMT !== 'bo1' && FMT !== 'bo3') { console.error('--fmt bo1|bo3'); process.exit(2); }
const MAIN = 'C:/Users/willj/Projects/Pokemon/ABRA';
const DATA_ROOT = path.resolve(flag('root', MAIN));
const REPO = path.join(__dirname, '..', '..');
const OUT = path.resolve(REPO, flag('out', 'solver/out/dusk'));
const LIMIT = +flag('limit', 0) || 0;
/* SENSITIVITY ARM. --keep-game-shape records quality's game-shape codes (forfeit_no_action, short, partial_bring) and does
 * not charge them, the PORYGON2 v2 rule: a game that ended before all four of a side were seen is a real game, and dropping
 * it biases "how often is an endgame reached" upward. The headline run charges every reasons() code, as the brief asks. */
const KEEP_SHAPE = argv.includes('--keep-game-shape');
const GAME_SHAPE = new Set(['forfeit_no_action', 'short', 'partial_bring']);
const TAG = KEEP_SHAPE ? '-allshape' : '';
if (!process.env.SHOWDOWN_PATH) {
  const sib = path.join(DATA_ROOT, '..', 'pokemon-showdown-mc');
  if (fs.existsSync(path.join(sib, 'dist', 'sim'))) process.env.SHOWDOWN_PATH = sib;
}
const X = require('../human/dex.js');
const R = require('../porygon2/v2/reveal.js');
const Q = require('../../engine/quality.js');
const L = require('./lib.js');

const REG = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'regulations.json'), 'utf8')).runtime.regmc;
const FORMAT_ID = FMT === 'bo3' ? REG.bo3Format : REG.bo3Format.replace(/bo3$/, '');
const STORE = path.join(DATA_ROOT, 'data', 'games.' + FORMAT_ID + '.jsonl.gz');
const RAWDIR = path.join(DATA_ROOT, 'data', 'raw', 'games.' + FORMAT_ID);
const RAWPLAIN = path.join(DATA_ROOT, 'data', 'games.' + FORMAT_ID + '.raw-logs.jsonl');
const OWN = new Set(['medicham32', 'willhoop', 'mag', 'mag2', 'miltank', 'miltank2']);   // solver/meta/extract.js OWN

const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
function eachLine(txt, fn) { let i = 0; while (i < txt.length) { let j = txt.indexOf('\n', i); if (j < 0) j = txt.length; const line = txt.slice(i, j); i = j + 1; if (line.trim()) fn(line); } }
const ILLUSION = new Set(X.D.species.all().filter(X.legal).filter(s => Object.values(s.abilities || {}).includes('Illusion')).map(s => s.baseSpecies));

function main() {
  const t0 = Date.now();
  fs.mkdirSync(OUT, { recursive: true });
  const cfg = Q.config();
  const inputs = [];
  // ---------------------------------------------------------------- 1. the parsed store, explicitly the .gz
  const sbuf = fs.readFileSync(STORE);
  inputs.push({ role: 'parsed_store', path: STORE.replace(/\\/g, '/'), bytes: sbuf.length, sha256: sha256(sbuf), mtime: fs.statSync(STORE).mtime.toISOString() });
  const slim = []; let storeRows = 0, storeBad = 0;
  eachLine(zlib.gunzipSync(sbuf).toString('utf8'), line => {
    storeRows++;
    let g; try { g = JSON.parse(line); } catch (e) { storeBad++; return; }
    slim.push({ id: g.id, date: g.date, p1: g.p1, p2: g.p2, winner: g.winner, forfeit: g.forfeit, six: g.six, brought: g.brought,
      turns: (g.turns || []).map(t => ({ ev: (t.ev || []).filter(e => e.t === 'm' || e.t === 's').slice(0, 1) })) });
  });
  const seen = new Set(); let dup = 0;
  const games = slim.filter(g => { if (seen.has(g.id)) { dup++; return false; } seen.add(g.id); return true; });
  const bots = Q.behaviouralBots(games, cfg);
  const funnel = { store_rows: storeRows, store_bad_json: storeBad, store_duplicate_ids: dup, store_games: games.length };
  const qFirst = {}, want = new Map();
  for (const g of games) {
    const rs = Q.reasons(g, cfg, bots).filter(r => !(KEEP_SHAPE && GAME_SHAPE.has(r)));
    const names = [g.p1 && g.p1.name, g.p2 && g.p2.name].filter(Boolean);
    if (names.some(n => OWN.has(X.toID(n)))) rs.push('own_account');
    if (rs.length) { inc(qFirst, rs[0]); continue; }
    want.set(g.id, g);
  }
  funnel.excluded_by_first_reason = qFirst;
  funnel.after_quality_and_own = want.size;
  if (LIMIT) { const keep = new Set([...want.keys()].slice(0, LIMIT)); for (const id of [...want.keys()]) if (!keep.has(id)) want.delete(id); }

  // ---------------------------------------------------------------- 2. raw logs joined on id
  const rawFiles = [];
  if (fs.existsSync(RAWDIR)) for (const f of fs.readdirSync(RAWDIR).filter(f => f.endsWith('.jsonl.gz')).sort()) rawFiles.push(path.join(RAWDIR, f));
  if (fs.existsSync(RAWPLAIN)) rawFiles.push(RAWPLAIN);
  const excl = {}, parseCodes = {};
  const done = new Set();
  const rows = [];                                   // one compact row per kept game (endgame facts only)
  const posOut = path.join(OUT, 'positions-' + FMT + TAG + '.jsonl.gz');
  const posTmp = posOut + '.tmp'; if (fs.existsSync(posTmp)) fs.unlinkSync(posTmp);
  let posBuf = [];
  const flush = () => { if (posBuf.length) { fs.appendFileSync(posTmp, zlib.gzipSync(Buffer.from(posBuf.join('\n') + '\n', 'utf8'))); posBuf = []; } };
  const exclude = (why, code) => { inc(excl, why); if (code) inc(parseCodes, code); };
  for (const f of rawFiles) {
    const b = fs.readFileSync(f);
    const rec = { role: 'raw_log', path: f.replace(/\\/g, '/'), bytes: b.length, sha256: sha256(b), rows: 0 };
    inputs.push(rec);
    const txt = f.endsWith('.gz') ? zlib.gunzipSync(b).toString('utf8') : b.toString('utf8');
    eachLine(txt, line => {
      let r; try { r = JSON.parse(line); } catch (e) { return; }
      rec.rows++;
      if (!r.id || !want.has(r.id) || done.has(r.id)) return;
      done.add(r.id);
      const sg = want.get(r.id);
      const log = String(r.log || '');
      const tier = (/\|tier\|([^\n]*)/.exec(log) || [])[1] || '';
      if (!/Reg M-C/.test(tier) || (FMT === 'bo3') !== /\(Bo3\)/.test(tier)) return exclude('wrong_format');
      const preview = [...log.matchAll(/\n\|poke\|p[12]\|([^,|\n]+)/g)].map(x => x[1].trim());
      if (preview.some(sp => ILLUSION.has(X.species(sp).baseSpecies))) return exclude('illusion_possible');
      let g;
      try { g = R.extract(log, { mode: FMT }); }
      catch (e) { return exclude(e.code === 'illusion_replace' ? 'illusion_possible' : 'parse_error', e.code || 'exception'); }
      if (g.game.custom_rules) return exclude('custom_rules');
      const lab = R.labels(g);
      if (lab.z == null) return exclude('no_result');
      if (!g.positions.length) return exclude('no_position');
      const rp1 = sg.p1 && sg.p1.rating != null ? +sg.p1.rating : null, rp2 = sg.p2 && sg.p2.rating != null ? +sg.p2.rating : null;
      const row = L.gameRow(g, lab, { id: r.id, uploadtime: r.uploadtime || null, date: sg.date, rating: { p1: rp1, p2: rp2 }, fmt: FMT });
      rows.push(row);
      if (row.e2) { posBuf.push(JSON.stringify({ id: r.id, fmt: FMT, uploadtime: r.uploadtime || null, rating: row.rating, band: row.band, z: lab.z, end: lab.end, turns: lab.turns, entry_n: row.e2.n, x: g.positions[row.e2.k].x })); if (posBuf.length >= 2000) flush(); }
    });
  }
  flush();
  if (fs.existsSync(posTmp)) fs.renameSync(posTmp, posOut);
  funnel.excluded_after_quality = excl; funnel.parse_codes = parseCodes;
  funnel.no_raw_log = [...want.keys()].filter(id => !done.has(id)).length;
  funnel.kept = rows.length;

  const result = L.summarise(rows, { fmt: FMT });
  const out = {
    what: 'DUSK meta measurement: Reg M-C endgames from the human stores (store-only, no simulator)',
    generated: new Date().toISOString(), fmt: FMT, game_shape_codes: KEEP_SHAPE ? 'recorded, not charged (sensitivity arm)' : 'charged (every reasons() code excludes)', format_id: FORMAT_ID,
    code: ['solver/dusk/measure_endgames.js', 'solver/dusk/lib.js', 'solver/porygon2/v2/reveal.js', 'engine/quality.js'].map(p => ({ path: p, sha256: sha256(fs.readFileSync(path.join(REPO, p))) })),
    quality_config_version: cfg.version || null, behavioural_bot_accounts: [...bots].length,
    definitions: L.DEFINITIONS, inputs: inputs.map(i => ({ ...i, path: i.path.replace(DATA_ROOT.replace(/\\/g, '/'), '<root>') })), funnel,
    positions_file: path.relative(REPO, posOut).replace(/\\/g, '/'),
    ...result, seconds: Math.round((Date.now() - t0) / 1000),
  };
  const of = path.join(OUT, 'endgames-' + FMT + TAG + '.json');
  fs.writeFileSync(of, JSON.stringify(out, null, 1));
  console.log('wrote ' + of + ' : kept ' + rows.length + ' games, E2 reached ' + result.reach.E2.k + ', ' + out.seconds + ' s');
}
main();
