/* quality.js - the shared definition of a usable game (JavaScript side).
 *
 * There is ONE definition, in data/quality-filter.json. This module and engine/quality.py are thin
 * readers of that file; neither hard-codes a threshold. tests/test-quality.js asserts that both
 * readers select the IDENTICAL set of game ids, which is the only thing that stops the two drifting.
 *
 *   const Q = require('./quality.js');
 *   const games = Q.loadGames();            // clean only
 *   const all   = Q.loadGames({clean:false});
 *   console.log(Q.funnel());
 */
'use strict';
const fs = require('fs');
const path = require('path');

const STORE = path.join(__dirname, '..', 'data', 'games.ladder.jsonl');
const CONFIG = path.join(__dirname, '..', 'data', 'quality-filter.json');

/* Memoised. `reasons()` is called once per game, and re-reading + re-parsing the config file on each
 * call turned a 1-second filter into a multi-minute one. Cached after the first read. */
let _cfg = null;
function config() { if (!_cfg) _cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); return _cfg; }

/* Deduplicate by id, first occurrence wins - the same order-preserving rule as dedupe_store.py, so
 * an un-deduped file on disk cannot silently change a result. */
function readStore(p) {
  const seen = new Set(), out = [];
  for (const line of fs.readFileSync(p || STORE, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s) continue;
    let g; try { g = JSON.parse(s); } catch (e) { continue; }
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}

/* Accounts that BEHAVE like bots regardless of their name. The decisive signal is team invariance:
 * an account playing hundreds of games without ever changing a slot is running a script. Computed
 * once over the whole store, because it is a property of an ACCOUNT and not of a game. */
function behaviouralBots(games, cfg) {
  cfg = cfg || config();
  const r = cfg.rules.exclude_behavioural_bots;
  if (!r || !r.on) return new Set();
  const count = new Map(), teams = new Map();
  for (const g of games) {
    for (const s of ['p1', 'p2']) {
      const n = (g[s] || {}).name;
      if (!n) continue;
      count.set(n, (count.get(n) || 0) + 1);
      const six = ((g.six || {})[s] || []).slice().sort().join('|');
      if (six) { if (!teams.has(n)) teams.set(n, new Set()); teams.get(n).add(six); }
    }
  }
  const out = new Set();
  for (const [n, c] of count) {
    const t = teams.get(n);
    if (c >= r.min_games && t && t.size <= r.max_distinct_teams) out.add(n);
  }
  return out;
}

// every reason this game is unusable; empty means clean
function reasons(g, cfg, bots) {
  cfg = cfg || config();
  const r = cfg.rules, bad = [];
  if (r.exclude_bot_games.on && ((g.p1 && g.p1.bot) || (g.p2 && g.p2.bot))) bad.push('bot');
  if (bots && ((g.p1 && bots.has(g.p1.name)) || (g.p2 && bots.has(g.p2.name)))) bad.push('behavioural_bot');
  if (r.exclude_forfeits.on && g.forfeit) bad.push('forfeit');
  if (r.min_turns.on && (g.turns || []).length < r.min_turns.value) bad.push('short');
  if (r.require_full_bring.on) {
    const br = g.brought || {};
    if ((br.p1 || []).length !== 4 || (br.p2 || []).length !== 4) bad.push('partial_bring');
  }
  return bad;
}

const isClean = (g, cfg, bots) => reasons(g, cfg, bots).length === 0;

function loadGames(opts) {
  /* A NON-OBJECT ARGUMENT IS A PROGRAMMING ERROR, NOT A CORPUS SELECTOR.
   *
   * `engine/stab_audit.js` called `loadGames('ots')`, meaning "the open-team-sheet store". A string has
   * no `.path`, so `readStore(undefined)` silently fell back to STORE — the closed-sheet LADDER store.
   * The audit then reported "2,245 clean open-sheet games" when data/games.ots.jsonl holds 4,167 games
   * that are 100% sheeted; what it had actually read was clean LADDER games, of which 116 (5.2%) happen
   * to carry a sheet. Its stated premise — "all four moves public, no revelation bias" — was false for
   * 95% of the sample, and the resulting figure looked entirely plausible.
   *
   * There is no honest default to pick here: guessing which store a caller meant is what produced the
   * defect. Throwing costs one stack trace and stops a wrong number reaching a document. */
  if (opts != null && (typeof opts !== 'object' || Array.isArray(opts))) {
    throw new TypeError(
      `loadGames() takes an options object, not ${JSON.stringify(opts)}. ` +
      `To choose a corpus, pass its path: loadGames({ path: 'data/games.ots.jsonl' }). ` +
      `A bare string silently read the default ladder store and produced a published figure ` +
      `computed on the wrong corpus.`);
  }
  const o = opts || {};
  const games = readStore(o.path);
  if (o.clean === false) return games;
  const cfg = config();
  const bots = behaviouralBots(games, cfg);
  return games.filter(g => isClean(g, cfg, bots));
}

function funnel(p) {
  const games = readStore(p), cfg = config(), r = cfg.rules;
  const out = { collected: games.length };
  let cur = games;
  if (r.exclude_bot_games.on) {
    cur = cur.filter(g => !((g.p1 && g.p1.bot) || (g.p2 && g.p2.bot)));
    out.after_bot_filter = cur.length;
  }
  const bots = behaviouralBots(games, cfg);
  if (bots.size) {
    cur = cur.filter(g => !(bots.has((g.p1 || {}).name) || bots.has((g.p2 || {}).name)));
    out.after_behavioural_bots = cur.length;
  }
  if (r.exclude_forfeits.on) {
    cur = cur.filter(g => !g.forfeit);
    out.after_forfeit_filter = cur.length;
  }
  if (r.min_turns.on) {
    cur = cur.filter(g => (g.turns || []).length >= r.min_turns.value);
    out.after_min_turns = cur.length;
  }
  if (r.require_full_bring.on) {
    cur = cur.filter(g => ((g.brought || {}).p1 || []).length === 4 && ((g.brought || {}).p2 || []).length === 4);
    out.after_full_bring = cur.length;
  }
  out.clean = cur.length;
  return out;
}

module.exports = { config, readStore, reasons, isClean, loadGames, funnel, behaviouralBots, STORE, CONFIG };

if (require.main === module) {
  const f = funnel(), t = f.collected;
  console.log('GAME QUALITY FUNNEL');
  const rows = [['collected', 'collected from Showdown'],
                ['after_bot_filter', 'after removing NAMED bot games'],
                ['after_behavioural_bots', 'after removing accounts that behave like bots'],
                ['after_forfeit_filter', 'after removing forfeits'],
                ['after_min_turns', 'after removing games under 3 turns'],
                ['after_full_bring', 'after requiring all four brought to be revealed']];
  let prev = t;
  for (const [k, label] of rows) {
    if (!(k in f)) continue;
    const n = f[k], drop = prev - n;
    console.log(`  ${label.padEnd(48)} ${String(n).padStart(6)}  (${(100 * n / t).toFixed(1)}% of collected)` + (drop ? `   -${drop}` : ''));
    prev = n;
  }
  console.log(`\n  USABLE: ${f.clean} of ${t} (${(100 * f.clean / t).toFixed(1)}%)`);
}
