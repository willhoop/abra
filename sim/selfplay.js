/* Self-play in the REAL Champions engine — the proof that the open sim runs and
 * that two agents can battle each other. Uses the Champions Random Battle format
 * so teams auto-generate (no hand-authoring); pass packed teams for Reg M-B.
 *
 *   cd sim && npm install pokemon-showdown && node selfplay.js [numGames]
 *   FORMAT=gen9championsvgc2026regmb node selfplay.js   # (needs packed teams)
 */
const { playBattle } = require('./champions-battle');
const { defaultAgent, randomBringAgent } = require('./agents');
let PS; try { PS = require('pokemon-showdown'); } catch (e) {
  console.error("pokemon-showdown not installed. Run:  cd sim && npm install pokemon-showdown"); process.exit(1);
}

const N = +(process.argv[2] || 20);
const FORMAT = process.env.FORMAT || 'gen9championsrandombattle';   // auto-generates teams

(async () => {
  const t0 = Date.now(); let w = { P1: 0, P2: 0, other: 0 }, turns = 0, ok = 0;
  for (let i = 0; i < N; i++) {
    let t1, t2;
    try { t1 = PS.Teams.generate(FORMAT); t2 = PS.Teams.generate(FORMAT); }
    catch (e) { console.error(`Teams.generate failed for ${FORMAT}: ${e.message}\nFor Reg M-B, pass packed teams instead.`); process.exit(1); }
    const r = await playBattle(t1, t2, defaultAgent, randomBringAgent, { format: FORMAT });
    if (r.winner === 'P1') w.P1++; else if (r.winner === 'P2') w.P2++; else w.other++;
    if (r.winner) ok++; turns += r.turns;
  }
  console.log(`\n${N} self-play Champions battles in the REAL Showdown engine (${FORMAT})`);
  console.log(`  resolved: ${ok}/${N}   avg ${(turns / N).toFixed(1)} turns/game   ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  P1 (default) ${w.P1}  ·  P2 (randomBring) ${w.P2}  ·  draws/other ${w.other}`);
  console.log(`\nThe engine runs. Next: plug MEDICHAM/SLOWKING policies in place of the placeholder agents.`);
})();
