/* Grow the dataset with SELF-PLAY on the open engine — the bias-free answer to
 * "we just need more games." Public ladder replays are a small, self-selected
 * (win-biased) slice; engine self-play is unlimited and unbiased by construction.
 *
 * Each game is written to data/games.selfplay.jsonl in the SAME schema as
 * data/games.ladder.jsonl, so JOLTEON / eval_harness / SLOWKING can train on the
 * union with no new plumbing. Games are tagged source:"selfplay" so they can be
 * kept separate from human ladder games when that matters (e.g. JOLTEON, which
 * predicts *human* play, may want humans-only; the engine-grounded models don't care).
 *
 *   cd sim
 *   npm install pokemon-showdown          # once
 *   node generate-dataset.js 500          # 500 self-play games -> appended to the store
 *   FORMAT=gen9championsvgc2026regmb node generate-dataset.js 500   # (needs packed teams)
 *
 * Default format is the Champions RANDOM battle, which auto-generates VALID teams
 * (the same path selfplay.js proved works). Swap FORMAT + a team pool for Reg M-B.
 */
const fs = require('fs');
const path = require('path');
const { playBattle } = require('./champions-battle');
const { makeGreedyAgent } = require('./agents');
let PS; try { PS = require('pokemon-showdown'); } catch (e) {
  console.error('pokemon-showdown not installed. Run:  cd sim && npm install pokemon-showdown'); process.exit(1);
}

const N = +(process.argv[2] || 200);
const FORMAT = process.env.FORMAT || 'gen9championsrandombattle';
const OUT = path.join(__dirname, '../data/games.selfplay.jsonl');

// pull the species list (the "six") out of a packed team
function speciesOf(packed) {
  try { return PS.Teams.unpack(packed).map(s => (s.species || s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')); }
  catch (e) { return []; }
}
// which mons each side actually brought / led, parsed from the protocol log
function bringsFromLog(log) {
  const seen = { p1: [], p2: [] }, lead = { p1: [], p2: [] };
  for (const line of log) {
    const m = /^\|(switch|drag)\|(p[12])[a-c]: [^|]+\|([^,|]+)/.exec(line);
    if (!m) continue;
    const side = m[2], sp = m[3].trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen[side].includes(sp)) {
      if (seen[side].length < 2) lead[side].push(sp);   // first two out = the lead
      seen[side].push(sp);
    }
  }
  return { brought: seen, lead };
}

(async () => {
  const t0 = Date.now();
  const stream = fs.createWriteStream(OUT, { flags: 'a' });
  let ok = 0, w = { p1: 0, p2: 0, other: 0 };
  for (let i = 0; i < N; i++) {
    let t1, t2;
    try { t1 = PS.Teams.generate(FORMAT); t2 = PS.Teams.generate(FORMAT); }
    catch (e) { console.error(`Teams.generate failed for ${FORMAT}: ${e.message}\nFor Reg M-B pass packed teams.`); process.exit(1); }
    const p1 = PS.Teams.pack(t1), p2 = PS.Teams.pack(t2);
    // fresh greedy agents each game (they track foe reveals internally)
    const g1 = makeGreedyAgent(), g2 = makeGreedyAgent();
    const r = await playBattle(p1, p2, g1, g2, { format: FORMAT, name1: 'SP1', name2: 'SP2' });
    const { brought, lead } = bringsFromLog(r.log);
    const winnerSide = r.winner === 'SP1' ? 'p1' : r.winner === 'SP2' ? 'p2' : null;
    if (winnerSide) ok++; if (winnerSide === 'p1') w.p1++; else if (winnerSide === 'p2') w.p2++; else w.other++;
    const rec = {
      id: `selfplay-${FORMAT}-${Date.now()}-${i}`,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      format: FORMAT.includes('regmb') ? 'champions-regmb' : FORMAT,
      openSheet: false, source: 'selfplay',
      p1: { name: 'SP1', rating: null, bot: true },
      p2: { name: 'SP2', rating: null, bot: true },
      winner: winnerSide === 'p1' ? 'SP1' : winnerSide === 'p2' ? 'SP2' : null,
      six: { p1: speciesOf(p1), p2: speciesOf(p2) },
      brought, lead, turns: r.turns
    };
    stream.write(JSON.stringify(rec) + '\n');
    if ((i + 1) % 25 === 0) process.stdout.write(`  ${i + 1}/${N} games\r`);
  }
  stream.end();
  console.log(`\nwrote ${ok}/${N} resolved self-play games -> ${OUT}`);
  console.log(`  P1 ${w.p1} · P2 ${w.p2} · draws/other ${w.other}   ${(Date.now() - t0) / 1000}s`);
  console.log(`  (P1≈P2 is the sanity check — greedy vs greedy should be ~50/50 with no side bias)`);
  console.log(`\nNext: re-run training on the union, e.g.\n  cat data/games.ladder.jsonl data/games.selfplay.jsonl > /tmp/all.jsonl && python engine/jolteon.py train /tmp/all.jsonl`);
})();
