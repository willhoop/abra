/* solver/tests/test-mega-rate.js — every solver bot megas at a RATE near the humans', not merely "at least once".
 *
 *   node solver/tests/test-mega-rate.js [--no-red] [--fast]      exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND
 *   env MEGA_TEST_RELEASE=<id>   the frozen release to play (default eaa5becc54eb, the Reg M-C gate release)
 *
 * WHY (CLAUDE.md, "Non-zero is not always a strong enough bar"): mega once passed "at least one happened" while it
 * ran at 56% of sides against the correct 85%. So the bar is a rate floor taken from the human rate, per bot.
 *
 *   DEFN     the engine's capability (`megaTargetFor`) and the Dex's (`items.get(item).megaStone[species]`, filtered
 *            to the regulation) agree on EVERY brought body of the arena's team pairs — the arena and the human rate
 *            count the same thing.
 *   HUMAN    the floor's HUMAN_RATE is a measurement, not a typed number: the first 3,000 human games give a rate
 *            within 0.03 of it (the full-dataset figure is solver/out/mega/human-rate.json).
 *   ROTOM    ROTOM's per-game path (parse_game.js on a raw battle log, then mega_rate.parsedGame) yields a record for
 *            both sides of every game of a tracked raw shard, and some capable side megas.
 *   RATE     arena games on the frozen release, paired seating: for each bot held to the floor (prior, doduo, mag,
 *            miltank at a short budget, and the self-play champion solver/machamp/league/gen5.json at a short
 *            budget), the upper end of the Wilson 95% interval of megas / capable sides is at or above the floor
 *            (HUMAN_RATE − MARGIN, solver/arena/mega_rate.js). Fewer than MIN_CAPABLE capable sides = CANNOT ANSWER.
 *            No mega was chosen that did not happen, and none happened on a side that could not mega.
 *            `random` is not a player and is not held to the floor.
 *
 * RED, unless --no-red: ARENA_BREAK=nevermega (every mega request stripped) must fail RATE. The red run plays only
 * the fast pair (doduo vs mag) — the break acts on every bot identically.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const cp = require('child_process');
const REL = process.env.MEGA_TEST_RELEASE || 'eaa5becc54eb';
const ROOT = path.join(__dirname, '..', '..');
process.env.SOLVER_RELEASE = REL;
const NO_RED = process.argv.includes('--no-red');
const FAST = process.argv.includes('--fast');

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log('  FAIL [' + clause + '] ' + msg); } };
const cannot = msg => { console.log('CANNOT ANSWER: ' + msg); process.exit(2); };

if (!fs.existsSync(path.join(ROOT, 'data', 'releases', REL, 'release.json'))) cannot('release ' + REL + ' is not on disk (data/releases/' + REL + ')');
require('../arena/env.js');
const MR = require('../arena/mega_rate.js');
const AR = require('../arena/arena.js');
const T = require('../arena/teams.js');
if (!fs.existsSync(T.DEFAULT_FILE)) cannot('no human dataset at ' + T.DEFAULT_FILE);
const FLOOR = MR.floor();

(async () => {
/* ---------------- DEFN ---------------- */
if (!FAST) {
  const E = require('../arena/engine.js').load(REL);
  const X = require('../human/dex.js');
  const L = T.loadGames({ n: 200, seed: 1, M: E.API.M });
  let bodies = 0, eng = 0, dis = 0; const ex = [];
  for (const G of L.games) for (const sd of ['p1', 'p2']) {
    const t = T.buildTeam(E.API.M, G, sd);
    t.team.forEach((b, k) => {
      const row = G.sheets[sd][t.sheetOf[k]];
      const it = X.D.items.get(row.item), sp = X.D.species.get(row.species);
      const f = it && it.exists && it.megaStone && it.megaStone[sp.name];
      const d = !!(f && X.legal(X.D.species.get(f)));
      const e = !!E.API.M.megaTargetFor(b);
      bodies++; if (e) eng++;
      if (d !== e) { dis++; if (ex.length < 5) ex.push(row.species + '@' + row.item + ' engine=' + e + ' dex=' + d); }
    });
  }
  ok('DEFN', bodies > 1000 && eng > 100, 'too few bodies to judge: ' + bodies + ' bodies, ' + eng + ' capable');
  ok('DEFN', dis === 0, dis + ' bodies where engine and Dex disagree on mega capability: ' + ex.join('; '));
  console.log('  DEFN ' + bodies + ' bodies, ' + eng + ' mega-capable, ' + dis + ' disagreements');
}

/* ---------------- HUMAN ---------------- */
if (!FAST) {
  const h = MR.humanRate(T.DEFAULT_FILE, { limit: 3000 }).turn_start;
  ok('HUMAN', h.capable > 2000, 'only ' + h.capable + ' capable sides in 3,000 human games');
  ok('HUMAN', Math.abs(h.rate - MR.HUMAN_RATE) < 0.03, 'first 3,000 games rate ' + h.rate + ' vs HUMAN_RATE ' + MR.HUMAN_RATE);
  console.log('  HUMAN first 3000 games: ' + h.megas + '/' + h.capable + ' = ' + h.rate + '  (HUMAN_RATE ' + MR.HUMAN_RATE + ', floor ' + FLOOR + ')');
}

/* ---------------- ROTOM ---------------- */
if (!FAST) {
  const { parseGame } = require('../human/parse_game.js');
  const dir = path.join(ROOT, 'data', 'raw', 'games.gen9championsvgc2026regmcbo3');
  const shard = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.jsonl.gz')).sort()[0] : null;
  if (!shard) cannot('no tracked raw Reg M-C shard under ' + dir);
  const rows = zlib.gunzipSync(fs.readFileSync(path.join(dir, shard))).toString('utf8').split('\n').filter(Boolean).slice(0, 200).map(l => JSON.parse(l));
  let games = 0, recs = 0, cap = 0, megas = 0;
  for (const r of rows) {
    let p; try { p = parseGame(r); } catch (e) { continue; }
    games++;
    const m = MR.parsedGame(p, 'p1');
    if (m && m.p1 && m.p2 && m.mine === m.p1) recs++;
    for (const P of ['p1', 'p2']) if (m && m[P].capable) { cap++; if (m[P].mega) megas++; }
  }
  ok('ROTOM', games > 50 && recs === games, recs + ' mega records for ' + games + ' parsed games of ' + shard);
  ok('ROTOM', cap > 0 && megas > 0, 'no capable side megaed in ' + shard + ' (' + megas + '/' + cap + ')');
  console.log('  ROTOM ' + shard + ': ' + recs + '/' + games + ' games carry a mega record; ' + megas + '/' + cap + ' capable sides megaed');
}

/* ---------------- RATE ---------------- */
/* the champion at a short budget: this is a capability test, not the strength spec. The spec is copied into the
 * scratch output dir with only budgetMs changed. */
const champSrc = path.join(ROOT, 'solver', 'machamp', 'league', 'gen5.json');
const champ = path.join(ROOT, 'solver', 'out', 'mega', 'test-gen5-short.json');
fs.mkdirSync(path.dirname(champ), { recursive: true });
fs.writeFileSync(champ, JSON.stringify(Object.assign(JSON.parse(fs.readFileSync(champSrc, 'utf8')), { name: 'gen5-short', budgetMs: 150 })));
const matches = FAST ? [['doduo', 'mag']] : [['doduo', 'mag'], ['prior', 'miltank'], [champ, 'random']];
const held = new Set(['prior', 'doduo', 'mag', 'miltank', champ]);
const label = n => (n === champ ? 'gen5 (champion, 150 ms)' : n);
const G = 28;   // 28 games -> 28 sides per bot; ~88% capable in the arena's team pairs
const seen = {};
for (const [x, y] of matches) {
  const r = await AR.run({ x, y, games: G, seed: 7, budget: 150, depth: 1, k1: 4, k2: 4, cap: 60, workers: 0 });
  ok('RATE', r.result.errors === 0, x + ' vs ' + y + ': ' + r.result.errors + ' errored games');
  for (const [k, n] of [['x', x], ['y', y]]) {
    const m = r.mega[k];
    seen[label(n)] = m;
    console.log('  RATE ' + label(n).padEnd(24) + ' megaed ' + m.megas + '/' + m.capable + ' capable sides = ' + m.rate + '  CI ' + JSON.stringify(m.ci95) + '  turn p50 ' + m.turn_p50 + (held.has(n) ? '' : '  (not held to the floor)'));
    ok('RATE', m.chose_not_happened === 0 && m.mega_not_capable === 0, label(n) + ': chose-not-happened ' + m.chose_not_happened + ', mega-not-capable ' + m.mega_not_capable);
    if (!held.has(n)) continue;
    if (m.capable < MR.MIN_CAPABLE) cannot(label(n) + ' had only ' + m.capable + ' capable sides (need ' + MR.MIN_CAPABLE + ')');
    ok('RATE', m.ci95[1] >= FLOOR, label(n) + ' megaed on ' + m.megas + '/' + m.capable + ' capable sides; CI upper ' + m.ci95[1] + ' < floor ' + FLOOR + ' (human ' + MR.HUMAN_RATE + ' − ' + MR.MARGIN + ')');
  }
}

console.log('test-mega-rate: ' + (checks - fails) + '/' + checks + ' checks  release ' + REL + '  floor ' + FLOOR + (AR.BROKEN ? '  [BREAK ' + AR.BROKEN + ']' : '') + '  failed clauses: ' + ([...failed].join(',') || 'none'));
if (!NO_RED && !AR.BROKEN) {
  const res = cp.spawnSync(process.execPath, [__filename, '--no-red', '--fast'], { env: Object.assign({}, process.env, { ARENA_BREAK: 'nevermega' }), encoding: 'utf8' });
  const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-mega-rate:')) || '';
  const seen = /failed clauses: .*\bRATE\b/.test(line) && res.status === 1;
  console.log('  RED ARENA_BREAK=nevermega -> RATE: ' + (seen ? 'fails as required' : 'STAYED GREEN (blind)') + '   [' + line.trim() + ']');
  if (!seen) process.exit(3);
}
process.exit(fails ? 1 : 0);
})().catch(e => { console.log('CANNOT ANSWER: ' + (e && e.stack || e)); process.exit(2); });
