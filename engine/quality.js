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

function config() { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); }

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

// every reason this game is unusable; empty means clean
function reasons(g, cfg) {
  cfg = cfg || config();
  const r = cfg.rules, bad = [];
  if (r.exclude_bot_games.on && ((g.p1 && g.p1.bot) || (g.p2 && g.p2.bot))) bad.push('bot');
  if (r.exclude_forfeits.on && g.forfeit) bad.push('forfeit');
  if (r.min_turns.on && (g.turns || []).length < r.min_turns.value) bad.push('short');
  if (r.require_full_bring.on) {
    const br = g.brought || {};
    if ((br.p1 || []).length !== 4 || (br.p2 || []).length !== 4) bad.push('partial_bring');
  }
  return bad;
}

const isClean = (g, cfg) => reasons(g, cfg).length === 0;

function loadGames(opts) {
  const o = opts || {};
  const games = readStore(o.path);
  if (o.clean === false) return games;
  const cfg = config();
  return games.filter(g => isClean(g, cfg));
}

function funnel(p) {
  const games = readStore(p), cfg = config(), r = cfg.rules;
  const out = { collected: games.length };
  let cur = games;
  if (r.exclude_bot_games.on) {
    cur = cur.filter(g => !((g.p1 && g.p1.bot) || (g.p2 && g.p2.bot)));
    out.after_bot_filter = cur.length;
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

module.exports = { config, readStore, reasons, isClean, loadGames, funnel, STORE, CONFIG };

if (require.main === module) {
  const f = funnel(), t = f.collected;
  console.log('GAME QUALITY FUNNEL');
  const rows = [['collected', 'collected from Showdown'],
                ['after_bot_filter', 'after removing bot games'],
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
