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
/* BOTH HUMAN STORES, AND READING ONLY ONE OF THEM WAS THE ERROR THIS FILE WAS BORN WITH.
 *
 * `games.ladder.jsonl` is the bo1 ladder. `games.bo3.jsonl` is a SEPARATE Showdown format
 * (`gen9championsvgc2026regmbbo3-…`), running in parallel over the identical window — 2026-07-23
 * onward, roughly 640 games a day, still ingesting. It is not a subset and not a tournament sample;
 * it is a second ladder, and because bo3 forces open team sheets, 99.9% of it carries a declared team
 * against the bo1 ladder's 1.7%.
 *
 * Counting clicks from the bo1 store alone undercounts every move by the whole bo3 population, and the
 * MEDICHAM gate's usage shelf reads this file to decide what may be shelved. A shelf computed on a
 * partial corpus shelves rows people actually click — which is the exact defect this file was created
 * to fix in `tags.json`, reproduced one layer up.
 *
 * The h2h and selfplay stores are deliberately NOT here: those are OUR bot's clicks, and "how often is
 * this move clicked" means by players, not by us. A store that does not exist is skipped and SAID, so
 * a missing file can never read as zero clicks. */
const STORES = ['games.ladder.jsonl', 'games.bo3.jsonl']
  .map(f => path.join(ROOT, 'data', f))
  .filter(p => fs.existsSync(p));
const STORE = STORES[0];
const OUT = path.join(ROOT, 'data', 'click-counts.json');
const TOP = (() => { const i = process.argv.indexOf('--top'); return i >= 0 ? +process.argv[i + 1] || 20 : 0; })();

const id = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function readOne(file, acc) {
  return new Promise((resolve, reject) => {
    let games = 0, clicks = 0, turns = 0, badLines = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
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
          if (e.t === 'm' && e.mv) { const k = id(e.mv); acc[k] = (acc[k] || 0) + 1; clicks++; }
        }
      }
    });
    rl.on('close', () => resolve({ games, clicks, turns, badLines }));
    rl.on('error', reject);
  });
}

async function build() {
  const moves = Object.create(null);
  const per = [];
  let games = 0, clicks = 0, turns = 0, badLines = 0;
  for (const f of STORES) {
    const r = await readOne(f, moves);
    per.push({ store: path.basename(f), games: r.games, clicks: r.clicks, turns: r.turns });
    games += r.games; clicks += r.clicks; turns += r.turns; badLines += r.badLines;
  }
  return { moves, games, clicks, turns, badLines, per };
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
    scope: 'every game in BOTH human stores — the bo1 ladder and the bo3 ladder, which is a separate '
         + 'Showdown format running in parallel over the same window. No rating or bot filter: a move '
         + 'the engine must simulate correctly does not care who clicked it. Our own h2h and self-play '
         + 'stores are excluded, because "how often is this clicked" means by players, not by us.',
    stores: STORES.map(p => path.relative(ROOT, p).replace(/\\/g, '/')),
    per_store: r.per,
    stores_note: 'READING ONLY THE BO1 LADDER WAS THIS FILE\'S ORIGINAL DEFECT, and it is the same '
               + 'shape as the tags.json undercount it was written to fix: a usage figure taken from '
               + 'part of the corpus, used to decide what may be shelved. The bo3 store is roughly a '
               + 'fifth of the games and is still ingesting daily.',
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
