/* HOW OFTEN IS EACH MOVE ACTUALLY CLICKED — counted from the store, which is the authority.
 *
 * WHY THIS FILE EXISTS. `data/tags.json` carries a `uses` field per move, and it UNDERCOUNTS. Measured
 * 2026-08-10 over the whole store: Toxic reads 1,132 there and 3,640 here; Terrain Pulse reads 9 and
 * 77; Copycat 10 and 78. The largest ratio in the blocking set is 8.6x. That is ROADMAP #70 —
 * "two usage numbers disagree by up to 13x" — and it is not academic: the MEDICHAM gate was about to
 * shelve thirteen move rows as "nobody clicks these" on the strength of the smaller number, and eleven
 * of them are clicked between 16 and 78 times in real games.
 *
 * A THRESHOLD IS ONLY HONEST IF IT IS APPLIED TO THE RIGHT NUMBER. So the roster's usage deferral
 * reads this file and nothing else. `tags.json.uses` keeps its own meaning for whatever derived it;
 * it is simply not the count of clicks, and must not be used as one.
 *
 * WHAT THIS DOES NOT COVER. Abilities and items are NOT counted here and deliberately so. A move is
 * clicked and the store records the click; an ability merely sits on a body, and the store does not
 * know which ability a body had unless the game carried an open sheet — 891 of 52,377. There is no
 * honest store-derived usage count for an ability, so this file does not invent one, and the roster
 * does not defer ability rows on usage.
 *
 *   node engine/click_counts.js            # rebuild data/click-counts.json
 *   node engine/click_counts.js --top 30   # and print the busiest moves
 *
 * Read-only over the store. Writes exactly one artifact. */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const STORE = path.join(ROOT, 'data', 'games.ladder.jsonl');
const OUT = path.join(ROOT, 'data', 'click-counts.json');
const TOP = (() => { const i = process.argv.indexOf('--top'); return i >= 0 ? +process.argv[i + 1] || 20 : 0; })();

const id = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function build() {
  return new Promise((resolve, reject) => {
    const moves = Object.create(null);
    let games = 0, clicks = 0, turns = 0, badLines = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(STORE), crlfDelay: Infinity });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let g;
      try { g = JSON.parse(line); } catch (e) { badLines++; return; }
      games++;
      for (const t of (g.turns || [])) {
        turns++;
        for (const e of (t.ev || [])) {
          /* `t: 'm'` is a MOVE EVENT — the store records that this body used this move. A move that
             was chosen and then prevented (flinch, sleep, full paralysis) leaves a `t: 'c'` instead,
             so this counts moves that RESOLVED, not intents. That is the right denominator for
             "does the engine handle this move", which is what the gate asks. */
          if (e.t === 'm' && e.mv) { const k = id(e.mv); moves[k] = (moves[k] || 0) + 1; clicks++; }
        }
      }
    });
    rl.on('close', () => resolve({ moves, games, clicks, turns, badLines }));
    rl.on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(STORE)) { console.error('  no store at ' + STORE); process.exit(1); }
  const r = await build();
  const art = {
    generated: new Date().toISOString(),
    by: 'engine/click_counts.js',
    what: 'How many times each move RESOLVED across every stored game. The authoritative click count; '
        + 'the MEDICHAM gate\'s usage deferral reads this and not data/tags.json, which undercounts by '
        + 'up to 8.6x on the rows that matter (ROADMAP #70).',
    scope: 'every game in data/games.ladder.jsonl, no rating or bot filter — a move the engine must '
         + 'simulate correctly does not care who clicked it',
    not_covered: 'abilities and items. The store records a move CLICK; it does not record which ability '
               + 'a body carried unless the game had an open sheet (891 of 52,377). No honest '
               + 'store-derived usage exists for those, so none is invented and the roster does not '
               + 'defer ability or item rows on usage.',
    store_games: r.games,
    store_turns: r.turns,
    total_clicks: r.clicks,
    distinct_moves: Object.keys(r.moves).length,
    unparsable_lines: r.badLines,
    moves: Object.fromEntries(Object.entries(r.moves).sort((a, b) => b[1] - a[1])),
  };
  fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');
  console.log('  ' + r.games.toLocaleString() + ' games, ' + r.turns.toLocaleString() + ' turns, '
            + r.clicks.toLocaleString() + ' move clicks across ' + art.distinct_moves + ' distinct moves');
  if (TOP) {
    console.log('');
    for (const [k, v] of Object.entries(art.moves).slice(0, TOP))
      console.log('    ' + String(v).padStart(7) + '  ' + k);
  }
  console.log('\n  wrote ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));
}

/* Exported so the roster reads the SAME numbers rather than re-deriving them — one implementation of
 * one fact, per the FACTS ARE GLOBAL rule. Returns null if the artifact was never built, and the
 * caller must treat that as "cannot defer", never as "zero clicks". */
function load() {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return null; }
}
function clicksFor(moveId) {
  const a = load();
  if (!a) return null;
  return a.moves[id(moveId)] || 0;
}

module.exports = { load, clicksFor, OUT_PATH: OUT };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
